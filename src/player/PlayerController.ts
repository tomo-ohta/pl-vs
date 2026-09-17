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
 */
import * as THREE from 'three';
import type { AABB } from '../core/aabb';
import type { Vec3 } from '../core/types';
import type { InputState } from '../input/InputController';

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

  private readonly camera: THREE.PerspectiveCamera;
  private lastCollisionCount = 0;
  private _crouching = false;
  private eyeNow = PLAYER.eye;
  private _moveRank: MoveRank = 'still';
  private strideAcc = 0;
  private wasOnGround = false;
  /** ゾーン合成結果（デバッグ・HUD 用） */
  private zoneSlow = 1;
  private zoneFriction = 1;
  private inWater = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
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
    this.syncCamera();
  }

  syncCamera(): void {
    this.camera.position.set(this.pos.x, this.pos.y + this.eyeNow, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
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
