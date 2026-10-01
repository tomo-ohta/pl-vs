/**
 * カプセル代わりの AABB プレイヤー。軸ごとに移動して静的 AABB と解決する。段差 0.35m までは自動で登る。
 * しゃがみ（当たり判定 0.85 m / 視点 0.75 m / 速度 ×0.5 / ダッシュ不可）とゾーン効果（水・滑る床・外力）を持つ。
 *
 * 統合担当向け: 呼び出し方（Game.step）
 * - `player.update(dt, input, colliders, zones)`: 第 4 引数は省略可。BuiltRoom.zones（ローカル AABB）を
 *   `aabbToWorld(zone.aabb, node.placement)` でワールド化し、`PlayerZone` に変換して現在部屋 + 1 hop 分を渡す。
 *   変換例: `{ kind: 'water', aabb: worldAabb, params: { slow: 0.7 } }` /
 *   `{ kind: 'force', aabb, vector: [1, 0, 0], params: { speed: 1.5 } }`（vector はワールド方向。placement の yaw で回す）/
 *   `{ kind: 'friction', aabb, params: { friction: 0.3 } }`。
 *   ゾーンの判定点は足元（pos.y + 0.1）。同種ゾーンが重なれば water は最小 slow、friction は最小、force は加算。
 * - `player.crouching` / `player.heightNow`: 現在の姿勢と当たり判定の高さ（Hole 判定やカメラ演出で参照可）。
 * - 音（F5 AudioEngine）向け: `player.moveRank`（'still'|'walk'|'dash'）、`player.onStride = (rank) => …`、
 *   `player.onLand = (fallSpeed) => …`、`player.onJump = () => …`。着地速度は m/s（正の値）。
 * - `player.external`（動く床・風の恒常速度）は従来どおり外部から設定できる。ゾーンによる外力は毎フレーム再計算し、
 *   ゾーン外では自動的に 0 になる（`player.zoneForce` で参照可）。
 * - 乗車中は `PlayerRide.update` を呼び、`player.update` は呼ばない（PlayerRide.ts を参照）。
 *
 * カメラ挙動（担当 F2。docs/film-camera.md）: 手持ち感（歩調に同期した上下動・ロール、呼吸、ふらつき、ズームのゆらぎ）と
 * 視線の遅れは **表示カメラだけ** に掛ける（`syncCamera` で合成）。`pos` / 当たり判定 / `yaw` `pitch` の入力値、PlayerProxy、
 * セーブ、移動方向は変わらない。設定は `player.feel`（Game が Settings から写す。handheld 0 で揺れ・ロール・ズームが完全に無効）、
 * 乗車中と E03（layout.roll）は Game が `cameraFeelSuppressed = true` にして入力値どおりのカメラにする。
 */
import * as THREE from 'three';
import type { AABB } from '../core/aabb';
import type { Vec3 } from '../core/types';
import type { InputState } from '../input/InputController';
import type { FilmPreset } from '../render/FilmPreset';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/**
 * 手持ちカメラの挙動の数値（設定 handheld 0〜1 でスケール。すべて見た目だけ）。
 * 酔いの原因になるので弱く: 上下動 1.5 cm・ロール 0.3°・呼吸 3 mm / 0.1°・ふらつき 0.08°・FOV ±0.5°
 */
export const CAMERA_FEEL = {
  /** 歩行の上下動の振幅（m）。1 歩 1 周期、足音（strideAcc）の位相に同期 */
  bobY: 0.015,
  /** 歩行のロール（rad）。左右の足で交互（2 歩 1 周期） */
  bobRoll: 0.3 * DEG,
  /** 歩行の揺れの立ち上がり / 収まり / 出力の平滑（s。平滑の減衰は歩調の周波数で掛け戻す） */
  bobAttackSec: 0.2,
  bobReleaseSec: 0.3,
  bobSmoothSec: 0.05,
  /** しゃがみ / ダッシュの振幅倍率 */
  crouchMul: 0.6,
  dashMul: 1.4,
  /** 呼吸: 上下（m）とロール（rad）。周期は 4〜5 s（ロールは非整数比でずらす） */
  breathSec: 4.5,
  breathY: 0.003,
  breathRollSec: 6.3,
  breathRoll: 0.1 * DEG,
  /** 手持ちのふらつき（yaw / pitch の rad。非整数比の 2 周期の合成 × 2 軸） */
  wobble: 0.08 * DEG,
  wobbleSec: [3.1, 1.3, 2.3, 0.9] as const,
  /** 静止（移動・視線入力なし）が stillAfterSec 以上続いたら揺れを stillMul 倍へ（呼吸は残す）。落とすのに fall 秒、戻すのに rise 秒 */
  stillAfterSec: 3,
  stillMul: 0.3,
  stillFallSec: 1.0,
  stillRiseSec: 0.5,
  /** 視線の遅れの時定数（s）。表示 yaw / pitch を入力値へ指数追従 */
  lagSec: 0.05,
  /** ズームのゆらぎ: FOV の振幅（deg）と周期の範囲（s。起点はランダム） */
  zoomDeg: 0.5,
  zoomSecMin: 7,
  zoomSecMax: 11,
};

/**
 * 撮像プリセットごとのカメラ挙動の倍率（LensPass.LENS_PRESETS / VideoPass.VIDEO_PRESETS と対）。
 * wobble: ふらつきの倍率 / zoom: ズームのゆらぎの倍率（0 = 無し。off / clean はレンズのサーボの癖を付けない）
 */
export const CAMERA_PRESETS: Record<FilmPreset, { wobble: number; zoom: number }> = {
  off: { wobble: 1, zoom: 0 },
  clean: { wobble: 1, zoom: 0 },
  homeVideo: { wobble: 1, zoom: 1 },
  tape: { wobble: 1.2, zoom: 1.2 },
};

/** カメラ挙動の設定（Game が Settings から写す） */
export interface CameraFeelSettings {
  /** 手持ち感 0〜1（0 で完全無効） */
  handheld: number;
  /** 視線の遅れ */
  lag: boolean;
  /** 撮像プリセット（CAMERA_PRESETS の倍率） */
  preset: FilmPreset;
}

/** 表示カメラに足しているオフセット（デバッグ HUD 用）。yaw / pitch は表示値（遅れ + ふらつき） */
export interface CameraFeelOut {
  /** 視点高さへの加算（m） */
  y: number;
  /** ロール（rad） */
  roll: number;
  yaw: number;
  pitch: number;
  /** FOV への加算（deg） */
  fov: number;
}

export const PLAYER = {
  height: 1.7,
  eye: 1.6,
  /** しゃがみ時の当たり判定の高さ */
  crouchHeight: 0.85,
  /** しゃがみ時の視点高さ */
  crouchEye: 0.75,
  /** しゃがみ時の移動速度倍率 */
  crouchSpeed: 0.5,
  /** 視点高さの補間時間（秒） */
  eyeLerpSec: 0.15,
  radius: 0.35,
  walk: 3.0,
  dash: 5.5,
  jump: 4.2,
  gravity: 9.8,
  step: 0.35,
  /** 足音の歩幅（m）。歩行 / ダッシュ */
  strideWalk: 0.75,
  strideDash: 1.1,
};

/** プレイヤーに効くゾーン（ワールド AABB）。BuiltRoom.zones からの変換は統合担当 */
export interface PlayerZone {
  /** water: 水平速度 ×slow / friction: 加減速 ×friction² / force: vector×speed を外力に加算 / lane: 予約（現状は効果なし） */
  kind: 'water' | 'friction' | 'force' | 'lane';
  aabb: AABB;
  /** force / lane の方向（ワールド。正規化されていなくてもよい） */
  vector?: Vec3;
  params?: {
    /** water: 速度倍率。既定 0.7 */
    slow?: number;
    /** friction: 加減速係数の倍率（0..1。小さいほど滑る）。既定 0.35 */
    friction?: number;
    /** force: 外力の速さ（m/s）。既定 1.0 */
    speed?: number;
  };
}

export type MoveRank = 'still' | 'walk' | 'dash';

export class PlayerController {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  /** 外部速度（動く床・風。外部が恒常的に設定するもの） */
  readonly external = new THREE.Vector3();
  /** ゾーン（force）由来の外力。毎フレーム再計算され、ゾーン外では 0 */
  readonly zoneForce = new THREE.Vector3();

  /** 足音: 歩幅ごとに呼ばれる */
  onStride: ((rank: MoveRank) => void) | null = null;
  /** 着地: 落下速度（m/s、正）を渡す */
  onLand: ((speed: number) => void) | null = null;
  /** ジャンプ開始 */
  onJump: (() => void) | null = null;

  /** カメラ挙動の設定（Game が Settings から写す。docs/film-camera.md） */
  readonly feel: CameraFeelSettings = { handheld: 0.6, lag: true, preset: 'homeVideo' };
  /** true の間は揺れ・ロール・遅れ・ズームを掛けず、カメラを入力値どおりにする（乗車中・E03。Game が毎フレーム設定） */
  cameraFeelSuppressed = false;
  /** ズームのゆらぎの中心 FOV（deg）。他が FOV を変えるときはここも更新する */
  baseFov: number;
  /** teleport のたびに増える（Game が回転ブラーの入力をそのフレームだけ 0 にする） */
  teleportSerial = 0;
  /** 表示カメラのオフセット（デバッグ HUD 用。毎フレーム更新） */
  readonly cameraFeel: CameraFeelOut = { y: 0, roll: 0, yaw: 0, pitch: 0, fov: 0 };

  private readonly camera: THREE.PerspectiveCamera;
  private lastCollisionCount = 0;
  private _crouching = false;
  private eyeNow = PLAYER.eye;
  private _moveRank: MoveRank = 'still';
  private strideAcc = 0;
  /** 足音の通算歩数（ロールの左右交互に使う） */
  private strideCount = 0;
  private wasOnGround = false;
  /** ゾーン合成結果（デバッグ・HUD 用） */
  private zoneSlow = 1;
  private zoneFriction = 1;
  private inWater = false;
  // --- カメラ挙動の内部状態（見た目だけ。乱数は位相の起点にのみ使い、世界生成には関与しない）
  private dispYaw = 0;
  private dispPitch = 0;
  private feelTime = 0;
  private feelWasSuppressed = false;
  private stillSec = 0;
  private stillScale = 1;
  private bobEnv = 0;
  private gaitPhase = 0;
  private gaitStep = 0;
  private bobY = 0;
  private bobRoll = 0;
  private fovOffsetNow = 0;
  private readonly feelPhase = [0, 1, 2, 3, 4].map(() => Math.random() * TAU);
  private readonly zoomPeriod = CAMERA_FEEL.zoomSecMin + Math.random() * (CAMERA_FEEL.zoomSecMax - CAMERA_FEEL.zoomSecMin);

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.baseFov = camera.fov;
  }

  /** しゃがみ中か */
  get crouching(): boolean {
    return this._crouching;
  }

  /** 現在の当たり判定の高さ（1.7 / 0.85） */
  get heightNow(): number {
    return this._crouching ? PLAYER.crouchHeight : PLAYER.height;
  }

  /** 現在の視点高さ（補間中の値） */
  get eyeHeight(): number {
    return this.eyeNow;
  }

  /** 実速度による移動ランク（still / walk / dash） */
  get moveRank(): MoveRank {
    return this._moveRank;
  }

  /** 水ゾーンに立っているか */
  get inWaterZone(): boolean {
    return this.inWater;
  }

  /** 水平速度の大きさ（m/s） */
  get horizontalSpeed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  teleport(pos: [number, number, number], yaw?: number): void {
    this.pos.set(pos[0], pos[1], pos[2]);
    this.vel.set(0, 0, 0);
    this.zoneForce.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.pitch = 0;
    this.eyeNow = this._crouching ? PLAYER.crouchEye : PLAYER.eye;
    this.strideAcc = 0;
    this.teleportSerial++;
    // 視線の遅れを跨がせない（遷移先で視点が滑らない）
    this.snapCameraFeel();
    this.syncCamera();
  }

  /**
   * カメラを現在の姿勢に合わせる。手持ち感（上下動・ロール・呼吸・ふらつき）と視線の遅れは表示値（cameraFeel）で合成し、
   * 抑制中（乗車 / E03）は入力値どおり。rotation は 'YXZ'（Y = yaw, X = pitch, Z = roll）
   */
  syncCamera(): void {
    if (this.cameraFeelSuppressed) {
      this.camera.position.set(this.pos.x, this.pos.y + this.eyeNow, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.applyFov(0);
      return;
    }
    const o = this.cameraFeel;
    this.camera.position.set(this.pos.x, this.pos.y + this.eyeNow + o.y, this.pos.z);
    this.camera.rotation.set(o.pitch, o.yaw, o.roll, 'YXZ');
    this.applyFov(o.fov);
  }

  /** 静止（移動・視線入力なし）の継続秒数（Game が毎フレーム渡す）。3 s 以上で揺れを弱める（呼吸は残す） */
  setStillness(sec: number): void {
    this.stillSec = Math.max(0, sec);
  }

  /** 表示 yaw / pitch を入力値に一致させる（テレポート・抑制の解除時） */
  private snapCameraFeel(): void {
    this.dispYaw = this.yaw;
    this.dispPitch = this.pitch;
    this.cameraFeel.yaw = this.yaw;
    this.cameraFeel.pitch = this.pitch;
  }

  /** FOV のオフセット（deg）を写す。変化があるときだけ updateProjectionMatrix */
  private applyFov(offsetDeg: number): void {
    if (offsetDeg === this.fovOffsetNow) return;
    this.fovOffsetNow = offsetDeg;
    this.camera.fov = this.baseFov + offsetDeg;
    this.camera.updateProjectionMatrix();
  }

  /**
   * 手持ち感と視線の遅れの表示値を更新する（update の末尾、syncCamera の前）。
   * - 視線の遅れ: 表示 yaw / pitch を入力値へ時定数 50 ms で指数追従（off なら即時）
   * - 歩行: 位相 = strideAcc / 歩幅（足音と同期）。上下 -cos（足音の瞬間が最下点）、ロールは 2 歩 1 周期で左右交互。
   *   立ち上がり 0.2 s / 収まり 0.3 s の包絡、60 ms の平滑で停止・再開の段差を消す。しゃがみ ×0.6、ダッシュ ×1.4
   * - 静止 3 s 以上で歩行の揺れとふらつきを 0.3 倍へ（1 s で落とし、動けば 0.5 s で戻す）。呼吸は残す
   * - 呼吸（常時）とふらつき（yaw / pitch）は非整数比の正弦の合成。ズームは FOV ±0.5°・周期 7〜11 s
   */
  private updateCameraFeel(dt: number): void {
    const F = CAMERA_FEEL;
    const suppressed = this.cameraFeelSuppressed;
    // 表示 yaw / pitch
    if (suppressed || this.feelWasSuppressed || !this.feel.lag) {
      this.dispYaw = this.yaw;
      this.dispPitch = this.pitch;
    } else {
      const k = 1 - Math.exp(-dt / F.lagSec);
      this.dispYaw += (this.yaw - this.dispYaw) * k;
      this.dispPitch += (this.pitch - this.dispPitch) * k;
    }
    this.feelWasSuppressed = suppressed;
    this.feelTime += dt;
    const t = this.feelTime;
    const amp = suppressed ? 0 : Math.max(0, Math.min(1, this.feel.handheld));
    const preset = CAMERA_PRESETS[this.feel.preset] ?? CAMERA_PRESETS.homeVideo;

    // 静止で弱める
    const stillTarget = this.stillSec >= F.stillAfterSec ? F.stillMul : 1;
    const stillRate = (1 - F.stillMul) / (stillTarget < this.stillScale ? F.stillFallSec : F.stillRiseSec);
    this.stillScale = approach(this.stillScale, stillTarget, stillRate * dt);

    // 歩行の上下動とロール（足音の位相に同期。停止中は最後の位相を保って包絡だけ落とす）
    const moving = this.onGround && this._moveRank !== 'still';
    let stepsPerSec = 0;
    if (moving) {
      const stride = this._moveRank === 'dash' ? PLAYER.strideDash : PLAYER.strideWalk;
      this.gaitPhase = this.strideAcc / stride;
      this.gaitStep = this.strideCount;
      stepsPerSec = this.horizontalSpeed / stride; // 歩行 3 m/s / 0.75 m = 4 歩/s、ダッシュ 5 歩/s
      this.bobEnv += (1 - this.bobEnv) * Math.min(1, dt / F.bobAttackSec);
    } else {
      this.bobEnv -= this.bobEnv * Math.min(1, dt / F.bobReleaseSec);
    }
    const posture = (this._crouching ? F.crouchMul : 1) * (moving && this._moveRank === 'dash' ? F.dashMul : 1);
    const bobA = amp * this.bobEnv * posture * this.stillScale;
    // 出力の平滑（1 次ローパス）は停止・再開・歩幅切替（strideAcc / 歩幅の位相の飛び）の段差を消すためのもの。
    // 歩調の周波数での減衰 1/√(1+(ωτ)²) をあらかじめ掛け戻して、振幅を CAMERA_FEEL の値に保つ（上下動は 1 歩 1 周期、ロールは 2 歩 1 周期）
    const ks = Math.min(1, dt / F.bobSmoothSec);
    const gainY = Math.min(2.5, Math.sqrt(1 + (TAU * stepsPerSec * F.bobSmoothSec) ** 2));
    const gainRoll = Math.min(2.5, Math.sqrt(1 + (Math.PI * stepsPerSec * F.bobSmoothSec) ** 2));
    this.bobY += (-F.bobY * gainY * bobA * Math.cos(TAU * this.gaitPhase) - this.bobY) * ks;
    this.bobRoll += (F.bobRoll * gainRoll * bobA * Math.sin(Math.PI * (this.gaitStep + this.gaitPhase)) - this.bobRoll) * ks;

    // 呼吸（常時。しゃがみで 0.6 倍。静止でも残す）
    const breathMul = amp * (this._crouching ? F.crouchMul : 1);
    const breathY = F.breathY * breathMul * Math.sin((TAU * t) / F.breathSec);
    const breathRoll = F.breathRoll * breathMul * Math.sin((TAU * t) / F.breathRollSec + this.feelPhase[4]);

    // 手持ちのふらつき（yaw / pitch。静止で 0.3 倍）
    const p = this.feelPhase;
    const w = F.wobble * amp * preset.wobble * this.stillScale;
    const wobYaw = w * (0.6 * Math.sin((TAU * t) / F.wobbleSec[0] + p[0]) + 0.4 * Math.sin((TAU * t) / F.wobbleSec[1] + p[1]));
    const wobPitch = w * (0.6 * Math.sin((TAU * t) / F.wobbleSec[2] + p[2]) + 0.4 * Math.sin((TAU * t) / F.wobbleSec[3] + p[3]));

    // ズームのゆらぎ（handheld 0 / off・clean プリセットでは 0 → applyFov が基準 FOV に戻す）
    const zoom = F.zoomDeg * amp * preset.zoom;
    const fov = zoom > 0 ? zoom * Math.sin((TAU * t) / this.zoomPeriod + p[0]) : 0;

    const o = this.cameraFeel;
    o.y = this.bobY + breathY;
    o.roll = this.bobRoll + breathRoll;
    o.yaw = this.dispYaw + wobYaw;
    o.pitch = this.dispPitch + wobPitch;
    o.fov = fov;
  }

  get feet(): [number, number, number] {
    return [this.pos.x, this.pos.y, this.pos.z];
  }

  /** 視点だけを入力で回す（乗車中に PlayerRide から呼ぶ） */
  applyLook(input: InputState): void {
    this.yaw -= input.lookDX;
    this.pitch -= input.lookDY;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  /** 視点高さを目標へ補間する（乗車中も呼べる） */
  updateEye(dt: number): void {
    const target = this._crouching ? PLAYER.crouchEye : PLAYER.eye;
    const maxStep = ((PLAYER.eye - PLAYER.crouchEye) / PLAYER.eyeLerpSec) * dt;
    const d = target - this.eyeNow;
    this.eyeNow += Math.max(-maxStep, Math.min(maxStep, d));
  }

  /** 姿勢を強制する（乗車開始時に立たせる等）。立ち上がりの頭上判定は行わない */
  setCrouching(v: boolean): void {
    this._crouching = v;
  }

  update(dt: number, input: InputState, colliders: AABB[], zones?: PlayerZone[]): void {
    // 視点
    this.applyLook(input);

    const near = this.broadphase(colliders);

    // 姿勢: しゃがみ入力があれば即しゃがむ。立つときは標準高さの AABB が塞がれていないことを確認
    if (input.crouch) {
      this._crouching = true;
    } else if (this._crouching) {
      if (!this.overlapsAt(this.pos.x, this.pos.y, this.pos.z, PLAYER.height, near)) this._crouching = false;
    }
    this.updateEye(dt);

    // ゾーン合成（足元 pos.y + 0.1）
    this.applyZones(zones);

    // 水平速度
    const crouch = this._crouching;
    let speed = input.dash && !crouch ? PLAYER.dash : PLAYER.walk;
    if (crouch) speed *= PLAYER.crouchSpeed;
    speed *= this.zoneSlow;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // 前方 = -Z を yaw で回した方向（THREE のカメラは -Z を向く）
    const fx = -sin;
    const fz = -cos;
    const rx = cos;
    const rz = -sin;
    const targetX = (fx * input.moveY + rx * input.moveX) * speed + this.external.x + this.zoneForce.x;
    const targetZ = (fz * input.moveY + rz * input.moveX) * speed + this.external.z + this.zoneForce.z;
    const accel = (this.onGround ? 18 : 6) * this.zoneFriction * this.zoneFriction;
    this.vel.x += (targetX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetZ - this.vel.z) * Math.min(1, accel * dt);

    if (input.jump && this.onGround) {
      this.vel.y = PLAYER.jump;
      this.onGround = false;
      this.onJump?.();
    }
    this.vel.y -= PLAYER.gravity * dt;
    if (this.vel.y < -25) this.vel.y = -25;

    const dx = this.vel.x * dt;
    const dz = this.vel.z * dt;
    const dy = this.vel.y * dt;

    // 水平移動（段差登り付き）
    const start = this.pos.clone();
    const blocked = this.moveHorizontal(dx, dz, near);
    if (blocked && this.onGround) {
      const afterFlat = this.pos.clone();
      this.pos.copy(start);
      this.pos.y += PLAYER.step;
      const blocked2 = this.moveHorizontal(dx, dz, near);
      // 上がった位置から下へ戻す
      const hit = this.moveAxis(1, -PLAYER.step, near);
      if (blocked2 || !hit || this.pos.y < start.y - 0.001) {
        // 登れなかった → 平面移動の結果に戻す
        this.pos.copy(afterFlat);
      }
    }

    // 垂直
    const fallSpeed = -this.vel.y;
    this.wasOnGround = this.onGround;
    this.onGround = false;
    const hitY = this.moveAxis(1, dy, near);
    if (hitY) {
      if (dy < 0) {
        this.onGround = true;
        if (!this.wasOnGround && fallSpeed > 0.5) this.onLand?.(fallSpeed);
      }
      this.vel.y = 0;
    }

    // 移動ランクと足音
    this.updateStride(start, dt);
    // 表示カメラ（手持ち感・視線の遅れ）。pos / yaw / pitch は変えない
    this.updateCameraFeel(dt);
    this.syncCamera();
  }

  // ---------------------------------------------------------------- ゾーン
  private applyZones(zones: PlayerZone[] | undefined): void {
    this.zoneSlow = 1;
    this.zoneFriction = 1;
    this.zoneForce.set(0, 0, 0);
    this.inWater = false;
    if (!zones || zones.length === 0) return;
    const px = this.pos.x;
    const py = this.pos.y + 0.1;
    const pz = this.pos.z;
    for (const z of zones) {
      const a = z.aabb;
      if (px < a.min[0] || px > a.max[0] || py < a.min[1] || py > a.max[1] || pz < a.min[2] || pz > a.max[2]) continue;
      switch (z.kind) {
        case 'water':
          this.zoneSlow = Math.min(this.zoneSlow, z.params?.slow ?? 0.7);
          this.inWater = true;
          break;
        case 'friction':
          this.zoneFriction = Math.min(this.zoneFriction, Math.max(0.05, z.params?.friction ?? 0.35));
          break;
        case 'force': {
          const v = z.vector;
          if (!v) break;
          const len = Math.hypot(v[0], v[1], v[2]);
          if (len < 1e-6) break;
          const s = (z.params?.speed ?? 1.0) / len;
          this.zoneForce.x += v[0] * s;
          this.zoneForce.y += v[1] * s;
          this.zoneForce.z += v[2] * s;
          break;
        }
        case 'lane':
          // 予約: 乗車レーン等。PlayerController では効果なし
          break;
      }
    }
  }

  // ---------------------------------------------------------------- 足音
  private updateStride(start: THREE.Vector3, dt: number): void {
    const hs = this.horizontalSpeed;
    const prev = this._moveRank;
    // 実速度で判定（しゃがみ歩行 1.5 m/s も walk 扱い）
    this._moveRank = hs < 0.3 ? 'still' : hs < (PLAYER.walk + PLAYER.dash) / 2 ? 'walk' : 'dash';
    if (!this.onGround || this._moveRank === 'still') {
      if (this._moveRank === 'still' && prev !== 'still') this.strideAcc = 0;
      return;
    }
    const moved = Math.hypot(this.pos.x - start.x, this.pos.z - start.z);
    if (moved < 1e-4 || dt <= 0) return;
    this.strideAcc += moved;
    const stride = this._moveRank === 'dash' ? PLAYER.strideDash : PLAYER.strideWalk;
    if (this.strideAcc >= stride) {
      this.strideAcc -= stride;
      this.strideCount++;
      this.onStride?.(this._moveRank);
    }
  }

  // ---------------------------------------------------------------- 衝突
  private moveHorizontal(dx: number, dz: number, near: AABB[]): boolean {
    let blocked = false;
    if (this.moveAxis(0, dx, near)) {
      blocked = true;
      this.vel.x = 0;
    }
    if (this.moveAxis(2, dz, near)) {
      blocked = true;
      this.vel.z = 0;
    }
    return blocked;
  }

  private broadphase(colliders: AABB[]): AABB[] {
    const out: AABB[] = [];
    const px = this.pos.x;
    const py = this.pos.y;
    const pz = this.pos.z;
    const r = 2.0;
    for (const c of colliders) {
      if (c.max[0] < px - r || c.min[0] > px + r) continue;
      if (c.max[2] < pz - r || c.min[2] > pz + r) continue;
      if (c.max[1] < py - 1.5 || c.min[1] > py + PLAYER.height + 1.5) continue;
      out.push(c);
    }
    this.lastCollisionCount = out.length;
    return out;
  }

  get debugColliders(): number {
    return this.lastCollisionCount;
  }

  /** 位置 (x, y, z) に高さ h の AABB を置いたとき、near のいずれかと重なるか（立ち上がり判定用） */
  private overlapsAt(x: number, y: number, z: number, h: number, near: AABB[]): boolean {
    const r = PLAYER.radius;
    const minX = x - r;
    const maxX = x + r;
    const minZ = z - r;
    const maxZ = z + r;
    // 床との接触を「塞がれている」と誤判定しないよう下端を少し持ち上げる
    const minY = y + 0.02;
    const maxY = y + h;
    for (const c of near) {
      if (minX < c.max[0] && maxX > c.min[0] && minY < c.max[1] && maxY > c.min[1] && minZ < c.max[2] && maxZ > c.min[2]) return true;
    }
    return false;
  }

  /** 軸 axis に delta 移動し、重なった AABB から押し出す。何かに当たれば true */
  private moveAxis(axis: 0 | 1 | 2, delta: number, near: AABB[]): boolean {
    if (delta === 0) return false;
    const p = [this.pos.x, this.pos.y, this.pos.z];
    p[axis] += delta;
    const r = PLAYER.radius;
    const h = this.heightNow;
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      const min = [p[0] - r, p[1], p[2] - r];
      const max = [p[0] + r, p[1] + h, p[2] + r];
      for (const c of near) {
        if (min[0] < c.max[0] && max[0] > c.min[0] && min[1] < c.max[1] && max[1] > c.min[1] && min[2] < c.max[2] && max[2] > c.min[2]) {
          any = true;
          hit = true;
          if (axis === 1) {
            p[1] = delta < 0 ? c.max[1] : c.min[1] - h;
          } else {
            p[axis] = delta < 0 ? c.max[axis] + r : c.min[axis] - r;
          }
          min[0] = p[0] - r;
          min[1] = p[1];
          min[2] = p[2] - r;
          max[0] = p[0] + r;
          max[1] = p[1] + h;
          max[2] = p[2] + r;
        }
      }
      if (!any) break;
    }
    this.pos.set(p[0], p[1], p[2]);
    return hit;
  }
}

/** v を target へ最大 step だけ近づける */
function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
