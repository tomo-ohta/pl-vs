/**
 * 表示カメラ（v1 player/PlayerController.ts のカメラ挙動を、シミュレーションから切り離して移植）。
 * 手持ち感（歩調に同期した上下動・ロール、呼吸、ふらつき、ズームのゆらぎ）と視線の遅れは表示カメラだけに掛ける。
 * プレイヤーの位置・当たり判定・移動方向・保存される視線は変わらない（すべて見た目だけ）。数値は v1 と同じ（docs/film-camera.md）。
 */
import * as THREE from 'three';
import type { FilmPreset } from '../render/FilmPreset.ts';
import { PLAYER } from '../../core/sim/player.ts';
import type { MoveRank } from '../../core/sim/types.ts';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

export const CAMERA_FEEL = {
  bobY: 0.015,
  bobRoll: 0.3 * DEG,
  bobAttackSec: 0.2,
  bobReleaseSec: 0.3,
  bobSmoothSec: 0.05,
  crouchMul: 0.6,
  dashMul: 1.4,
  breathSec: 4.5,
  breathY: 0.003,
  breathRollSec: 6.3,
  breathRoll: 0.1 * DEG,
  wobble: 0.08 * DEG,
  wobbleSec: [3.1, 1.3, 2.3, 0.9] as const,
  stillAfterSec: 3,
  stillMul: 0.3,
  stillFallSec: 1.0,
  stillRiseSec: 0.5,
  lagSec: 0.05,
  zoomDeg: 0.5,
  zoomSecMin: 7,
  zoomSecMax: 11,
};

export const CAMERA_PRESETS: Record<FilmPreset, { wobble: number; zoom: number }> = {
  off: { wobble: 1, zoom: 0 },
  clean: { wobble: 1, zoom: 0 },
  homeVideo: { wobble: 1, zoom: 1 },
  tape: { wobble: 1.2, zoom: 1.2 },
};

export interface CameraFeelSettings {
  handheld: number;
  lag: boolean;
  preset: FilmPreset;
}

/** カメラが読むプレイヤーの姿（補間済みの位置と、歩きの状態） */
export interface CameraSubject {
  pos: [number, number, number];
  eye: number;
  yaw: number;
  pitch: number;
  onGround: boolean;
  crouching: boolean;
  moveRank: MoveRank;
  strideAcc: number;
  strideCount: number;
  horizontalSpeed: number;
  stillSec: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly feel: CameraFeelSettings = { handheld: 0.6, lag: true, preset: 'homeVideo' };
  /** true の間は揺れ・遅れを掛けない（乗車中など） */
  suppressed = false;
  baseFov: number;
  /** 表示値（デバッグ用） */
  readonly out = { y: 0, roll: 0, yaw: 0, pitch: 0, fov: 0 };

  private dispYaw = 0;
  private dispPitch = 0;
  private time = 0;
  private wasSuppressed = false;
  private stillScale = 1;
  private bobEnv = 0;
  private gaitPhase = 0;
  private gaitStep = 0;
  private bobY = 0;
  private bobRoll = 0;
  private fovNow = 0;
  // 位相の起点（見た目だけ。世界の生成と同期には関わらないので Math.random でよい）
  private readonly phase = [0, 1, 2, 3, 4].map(() => Math.random() * TAU);
  private readonly zoomPeriod = CAMERA_FEEL.zoomSecMin + Math.random() * (CAMERA_FEEL.zoomSecMax - CAMERA_FEEL.zoomSecMin);

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.baseFov = camera.fov;
  }

  /** テレポート・戻された直後: 視線の遅れを跨がせない */
  snap(s: CameraSubject): void {
    this.dispYaw = s.yaw;
    this.dispPitch = s.pitch;
  }

  update(dt: number, s: CameraSubject): void {
    const F = CAMERA_FEEL;
    const sup = this.suppressed;
    if (sup || this.wasSuppressed || !this.feel.lag) {
      this.dispYaw = s.yaw;
      this.dispPitch = s.pitch;
    } else {
      const k = 1 - Math.exp(-dt / F.lagSec);
      // yaw は周回を考えずに追う（積算値なので折り返さない）
      this.dispYaw += (s.yaw - this.dispYaw) * k;
      this.dispPitch += (s.pitch - this.dispPitch) * k;
    }
    this.wasSuppressed = sup;
    this.time += dt;
    const t = this.time;
    const amp = sup ? 0 : Math.max(0, Math.min(1, this.feel.handheld));
    const preset = CAMERA_PRESETS[this.feel.preset] ?? CAMERA_PRESETS.homeVideo;

    const stillTarget = s.stillSec >= F.stillAfterSec ? F.stillMul : 1;
    const stillRate = (1 - F.stillMul) / (stillTarget < this.stillScale ? F.stillFallSec : F.stillRiseSec);
    this.stillScale = approach(this.stillScale, stillTarget, stillRate * dt);

    const moving = s.onGround && s.moveRank !== 'still';
    let stepsPerSec = 0;
    if (moving) {
      const stride = s.moveRank === 'dash' ? PLAYER.strideDash : PLAYER.strideWalk;
      this.gaitPhase = s.strideAcc / stride;
      this.gaitStep = s.strideCount;
      stepsPerSec = s.horizontalSpeed / stride;
      this.bobEnv += (1 - this.bobEnv) * Math.min(1, dt / F.bobAttackSec);
    } else {
      this.bobEnv -= this.bobEnv * Math.min(1, dt / F.bobReleaseSec);
    }
    const posture = (s.crouching ? F.crouchMul : 1) * (moving && s.moveRank === 'dash' ? F.dashMul : 1);
    const bobA = amp * this.bobEnv * posture * this.stillScale;
    const ks = Math.min(1, dt / F.bobSmoothSec);
    const gainY = Math.min(2.5, Math.sqrt(1 + (TAU * stepsPerSec * F.bobSmoothSec) ** 2));
    const gainRoll = Math.min(2.5, Math.sqrt(1 + (Math.PI * stepsPerSec * F.bobSmoothSec) ** 2));
    this.bobY += (-F.bobY * gainY * bobA * Math.cos(TAU * this.gaitPhase) - this.bobY) * ks;
    this.bobRoll += (F.bobRoll * gainRoll * bobA * Math.sin(Math.PI * (this.gaitStep + this.gaitPhase)) - this.bobRoll) * ks;

    const breathMul = amp * (s.crouching ? F.crouchMul : 1);
    const breathY = F.breathY * breathMul * Math.sin((TAU * t) / F.breathSec);
    const breathRoll = F.breathRoll * breathMul * Math.sin((TAU * t) / F.breathRollSec + this.phase[4]!);

    const p = this.phase;
    const w = F.wobble * amp * preset.wobble * this.stillScale;
    const wobYaw = w * (0.6 * Math.sin((TAU * t) / F.wobbleSec[0] + p[0]!) + 0.4 * Math.sin((TAU * t) / F.wobbleSec[1] + p[1]!));
    const wobPitch = w * (0.6 * Math.sin((TAU * t) / F.wobbleSec[2] + p[2]!) + 0.4 * Math.sin((TAU * t) / F.wobbleSec[3] + p[3]!));
    const zoom = F.zoomDeg * amp * preset.zoom;
    const fov = zoom > 0 ? zoom * Math.sin((TAU * t) / this.zoomPeriod + p[0]!) : 0;

    const o = this.out;
    o.y = this.bobY + breathY;
    o.roll = this.bobRoll + breathRoll;
    o.yaw = this.dispYaw + wobYaw;
    o.pitch = this.dispPitch + wobPitch;
    o.fov = fov;

    this.camera.position.set(s.pos[0], s.pos[1] + s.eye + (sup ? 0 : o.y), s.pos[2]);
    if (sup) this.camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
    else this.camera.rotation.set(o.pitch, o.yaw, o.roll, 'YXZ');
    const f = sup ? 0 : o.fov;
    if (f !== this.fovNow) {
      this.fovNow = f;
      this.camera.fov = this.baseFov + f;
      this.camera.updateProjectionMatrix();
    }
  }
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
