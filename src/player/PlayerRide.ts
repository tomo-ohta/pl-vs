/**
 * スクリプト移動（乗車）。VehicleRide（E11 / L02 / L11 の列車・ボート・モノレール）が使う。
 * 入力の移動を無効化し、path をイージングで補間してプレイヤー位置を進める。視点だけは操作できる。
 * 窓の流光は材質側（surfaceTime）で表現し、ここではカメラの微振動（shake）だけを担当する。
 *
 * 統合担当向け: 呼び出し方（Game）
 * - 生成: `const ride = new PlayerRide(player, camera);`（Game が 1 つ所有）
 * - 乗車開始（車両扉をインタラクトしたとき）:
 *     ride.start({
 *       path: [carInside, carInside],            // ワールド座標の足元位置。1 点なら「その場に固定」（車内で待つ Q5-C 方式）
 *       durationSec: portal.rideSec ?? 25,
 *       allowSkipAfterSec: 5,                    // 5 秒後は E / タップで到着を早められる
 *       shake: 0.015,                            // 走行中の微振動振幅（m）。0 で無し
 *       onArrive: () => this.finishVehicleRide(portal),  // fade → resolveVehicle → teleport → enterRoom(platform)
 *     });
 *     Game.state = 'riding'（乗車中はメニュー・セーブ不可。openMenu は state==='playing' のみ許可）。
 * - 毎フレーム（Game.step）: `if (ride.riding) ride.update(dt, input); else player.update(dt, input, colliders, zones);`
 *   update は input.interact（E / タップ）を skip 要求として扱う。到着（時間経過または skip）で onArrive を 1 回呼び、riding=false になる。
 * - 途中中断: `ride.cancel()`（onArrive を呼ばない。新しい世界の生成などで使う）。
 * - `ride.canSkip` を HUD ヒント（「E: 到着を早める」）の表示に使える。`ride.progress`（0..1）は演出用。
 * - camera up の補間（roll）は将来の GravityAxis 用に `roll: (t01) => radians` を任意で受け付ける。省略時は 0。
 *   乗車終了時は roll 0 に戻す。
 */
import * as THREE from 'three';
import type { Vec3 } from '../core/types';
import type { InputState } from '../input/InputController';
import { PlayerController } from './PlayerController';

export interface RideOptions {
  /** ワールド座標の足元位置の列。1 点ならその場に固定 */
  path: Vec3[];
  /** 乗車時間（秒） */
  durationSec: number;
  /** この秒数を過ぎたら interact で到着を早められる。既定 5。負値でスキップ不可 */
  allowSkipAfterSec?: number;
  /** 到着時に 1 回呼ばれる */
  onArrive?: () => void;
  /** カメラの微振動振幅（m）。既定 0.015。0 で無し */
  shake?: number;
  /** 位置補間のイージング。既定 smoothstep（加速→等速→減速に近い） */
  ease?: (t: number) => number;
  /** カメラのロール（ラジアン）。t01 は 0..1 の進行率。将来の GravityAxis 用 */
  roll?: (t01: number) => number;
  /** 乗車中にしゃがみを解除して立たせる。既定 true */
  standUp?: boolean;
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export class PlayerRide {
  /** 乗車中か */
  riding = false;
  /** 経過秒 */
  elapsed = 0;

  private opts: RideOptions | null = null;
  private cumulative: number[] = [];
  private totalLen = 0;
  private shakePhase = 0;
  private rollNow = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly player: PlayerController,
    private readonly camera: THREE.PerspectiveCamera,
  ) {}

  /** 進行率 0..1（イージング前の時間比） */
  get progress(): number {
    if (!this.opts) return 0;
    return Math.min(1, this.elapsed / Math.max(1e-3, this.opts.durationSec));
  }

  /** 今 interact で到着を早められるか */
  get canSkip(): boolean {
    if (!this.riding || !this.opts) return false;
    const after = this.opts.allowSkipAfterSec ?? 5;
    return after >= 0 && this.elapsed + 1e-6 >= after;
  }

  start(opts: RideOptions): void {
    if (opts.path.length === 0) throw new Error('PlayerRide.start: path が空です');
    this.opts = { ...opts };
    this.riding = true;
    this.elapsed = 0;
    this.shakePhase = 0;
    this.rollNow = 0;
    // 弧長テーブル
    this.cumulative = [0];
    this.totalLen = 0;
    for (let i = 1; i < opts.path.length; i++) {
      const a = opts.path[i - 1];
      const b = opts.path[i];
      this.totalLen += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      this.cumulative.push(this.totalLen);
    }
    if (opts.standUp !== false) this.player.setCrouching(false);
    this.player.vel.set(0, 0, 0);
    this.player.zoneForce.set(0, 0, 0);
    this.player.onGround = true;
    const p0 = opts.path[0];
    this.player.pos.set(p0[0], p0[1], p0[2]);
    this.player.syncCamera();
  }

  /** onArrive を呼ばずに中断する */
  cancel(): void {
    this.riding = false;
    this.opts = null;
    this.resetCameraRoll();
  }

  /** 到着を即時に確定する（onArrive を呼ぶ） */
  finish(): void {
    if (!this.riding || !this.opts) return;
    const opts = this.opts;
    const last = opts.path[opts.path.length - 1];
    this.player.pos.set(last[0], last[1], last[2]);
    this.player.vel.set(0, 0, 0);
    this.riding = false;
    this.opts = null;
    this.resetCameraRoll();
    this.player.syncCamera();
    opts.onArrive?.();
  }

  update(dt: number, input: InputState): void {
    if (!this.riding || !this.opts) return;
    const opts = this.opts;
    this.elapsed += dt;

    // 視点だけ操作可。視点高さは補間を続ける
    this.player.applyLook(input);
    this.player.updateEye(dt);

    // skip 要求
    if (input.interact && this.canSkip) {
      this.finish();
      return;
    }
    if (this.elapsed >= opts.durationSec) {
      this.finish();
      return;
    }

    // 位置: イージングした進行率を弧長で path に写す
    const t = (opts.ease ?? smoothstep)(this.progress);
    this.sampleAt(t, this.tmp);
    this.player.pos.copy(this.tmp);
    this.player.syncCamera();

    // 走行感: 微振動（走行中央部で最大、発着で弱める）
    const shake = opts.shake ?? 0.015;
    if (shake > 0) {
      this.shakePhase += dt;
      const env = Math.sin(Math.PI * this.progress); // 0 → 1 → 0
      const a = shake * (0.35 + 0.65 * env);
      const ph = this.shakePhase;
      this.camera.position.x += a * Math.sin(ph * 23.0) * 0.6;
      this.camera.position.y += a * (Math.sin(ph * 31.0) + 0.5 * Math.sin(ph * 7.3));
      this.camera.position.z += a * Math.sin(ph * 19.0) * 0.6;
    }

    // ロール（任意）
    if (opts.roll) {
      this.rollNow = opts.roll(this.progress);
      this.camera.rotation.set(this.player.pitch, this.player.yaw, this.rollNow, 'YXZ');
    }
  }

  /** 弧長比 t（0..1）の位置を path 上から取る */
  private sampleAt(t: number, out: THREE.Vector3): void {
    const path = this.opts!.path;
    if (path.length === 1 || this.totalLen <= 1e-6) {
      out.set(path[0][0], path[0][1], path[0][2]);
      return;
    }
    const s = t * this.totalLen;
    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i] < s) i++;
    const s0 = this.cumulative[i - 1];
    const s1 = this.cumulative[i];
    const k = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    const a = path[i - 1];
    const b = path[i];
    out.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
  }

  private resetCameraRoll(): void {
    if (this.rollNow !== 0) {
      this.rollNow = 0;
      this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
    }
  }
}
