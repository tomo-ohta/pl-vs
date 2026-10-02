/**
 * プレイヤーの移動（v1 player/PlayerController.ts の移動と当たり判定を、固定 tick の純粋な関数として移植）。
 * カプセル代わりの AABB を軸ごとに動かして箱から押し出す。段差 0.35 m までは自動で登る。
 * しゃがみ（当たり判定 0.85 m / 視点 0.75 m / 速度 ×0.5 / ダッシュ不可）とゾーン（水・滑る床・外力）は v1 と同じ数値。
 *
 * v2 で足したもの:
 * - 面（SupportSurface: 坂・傾く床）。面の範囲では、床の代わりに面の高さに立つ
 * - 乗っている動く物の速度（carry）
 * - 足音・着地・ジャンプは戻り値ではなくイベントで返す（音はクライアントが鳴らす）
 * カメラの演出（手持ち感・視線の遅れ）はクライアント（client/camera）に分けた。
 */
import type { AABB } from '../math/aabb.ts';
import { clamp, type Vec3 } from '../math/vec.ts';
import type { SupportSurface, Zone } from '../world/layout.ts';
import { inRect } from '../world/footprint.ts';
import type { ColliderIndex } from './collision.ts';
import type { InputCommand, PlayerState, SimEvent } from './types.ts';

export const PLAYER = {
  height: 1.7,
  eye: 1.6,
  crouchHeight: 0.85,
  crouchEye: 0.75,
  crouchSpeed: 0.5,
  eyeLerpSec: 0.15,
  radius: 0.35,
  walk: 3.0,
  dash: 5.5,
  jump: 4.2,
  gravity: 9.8,
  step: 0.35,
  strideWalk: 0.75,
  strideDash: 1.1,
  /** 面（坂）に吸い付く高さ（下り坂で浮かないように） */
  surfaceSnap: 0.35,
  /** 面の下から突き抜けて乗らないための幅 */
  surfaceThickness: 0.6,
  /** 落下の上限速度 */
  maxFall: 25,
} as const;

export function createPlayer(id: string, pos: Vec3, yaw: number): PlayerState {
  return {
    id,
    pos: [pos[0], pos[1], pos[2]],
    vel: [0, 0, 0],
    yaw,
    pitch: 0,
    onGround: false,
    crouching: false,
    eye: PLAYER.eye,
    moveRank: 'still',
    strideAcc: 0,
    strideCount: 0,
    inWater: false,
    zoneSlow: 1,
    zoneFriction: 1,
    zoneForce: [0, 0, 0],
    carry: [0, 0, 0],
    stillSec: 0,
    surfaceId: null,
    respawn: { pos: [pos[0], pos[1], pos[2]], yaw },
    lastGround: [pos[0], pos[1], pos[2]],
    interactedId: null,
  };
}

export function playerHeight(p: PlayerState): number {
  return p.crouching ? PLAYER.crouchHeight : PLAYER.height;
}

export function horizontalSpeed(p: PlayerState): number {
  return Math.hypot(p.vel[0], p.vel[2]);
}

/** 移動処理が引く世界（当たり判定・ゾーン・面） */
export interface PlayerWorld {
  colliders: ColliderIndex;
  zones: Iterable<Zone>;
  surfaces: Iterable<SupportSurface>;
}

/** 面の点 (x, z) での高さ */
export function surfaceY(s: SupportSurface, x: number, z: number): number {
  const n = s.normal;
  if (Math.abs(n[1]) < 1e-6) return -Infinity;
  return s.origin[1] - (n[0] * (x - s.origin[0]) + n[2] * (z - s.origin[2])) / n[1];
}

/** プレイヤーを 1 tick 進める（p を書き換える）。起きたことは events に足す */
export function stepPlayer(p: PlayerState, cmd: InputCommand, world: PlayerWorld, dt: number, tick: number, events: SimEvent[]): void {
  // 視線は絶対値（クライアントが積算した値）
  const lookMoved = Math.abs(cmd.yaw - p.yaw) + Math.abs(cmd.pitch - p.pitch) > 1e-4;
  p.yaw = cmd.yaw;
  const lim = Math.PI / 2 - 0.05;
  p.pitch = clamp(cmd.pitch, -lim, lim);

  const near = broadphase(p, world.colliders);
  // 動く箱（扉・動く壁）に入り込まれていたら、いちばん浅い向きへ押し出す
  depenetrate(p, near);

  // 姿勢: しゃがみ入力があれば即しゃがむ。立つときは標準の高さの箱が塞がれていないこと
  if (cmd.crouch) p.crouching = true;
  else if (p.crouching && !overlapsAt(p.pos[0], p.pos[1], p.pos[2], PLAYER.height, near)) p.crouching = false;
  updateEye(p, dt);

  applyZones(p, world.zones);

  // 水平速度
  let speed = cmd.dash && !p.crouching ? PLAYER.dash : PLAYER.walk;
  if (p.crouching) speed *= PLAYER.crouchSpeed;
  speed *= p.zoneSlow;
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  // 前方 = -Z を yaw で回した方向
  const fx = -sin, fz = -cos, rx = cos, rz = -sin;
  const mx = clamp(cmd.moveX, -1, 1);
  const my = clamp(cmd.moveY, -1, 1);
  const targetX = (fx * my + rx * mx) * speed + p.zoneForce[0] + p.carry[0];
  const targetZ = (fz * my + rz * mx) * speed + p.zoneForce[2] + p.carry[2];
  const accel = (p.onGround ? 18 : 6) * p.zoneFriction * p.zoneFriction;
  const k = Math.min(1, accel * dt);
  p.vel[0] += (targetX - p.vel[0]) * k;
  p.vel[2] += (targetZ - p.vel[2]) * k;

  if (cmd.jump && p.onGround) {
    p.vel[1] = PLAYER.jump;
    p.onGround = false;
    p.surfaceId = null;
    events.push({ type: 'player.jump', tick, player: p.id, pos: [...p.pos] });
  }
  p.vel[1] -= PLAYER.gravity * dt;
  if (p.vel[1] < -PLAYER.maxFall) p.vel[1] = -PLAYER.maxFall;

  const dx = p.vel[0] * dt;
  const dz = p.vel[2] * dt;
  const dy = p.vel[1] * dt + p.carry[1] * dt;

  // 水平移動（段差登り付き）
  const start: Vec3 = [p.pos[0], p.pos[1], p.pos[2]];
  const wasOnGround = p.onGround;
  const blocked = moveHorizontal(p, dx, dz, near);
  if (blocked && wasOnGround) {
    const afterFlat: Vec3 = [p.pos[0], p.pos[1], p.pos[2]];
    p.pos[0] = start[0]; p.pos[1] = start[1] + PLAYER.step; p.pos[2] = start[2];
    const blocked2 = moveHorizontal(p, dx, dz, near);
    // 上がった位置から下へ戻す
    const hit = moveAxis(p, 1, -PLAYER.step, near);
    if (blocked2 || !hit || p.pos[1] < start[1] - 0.001) {
      // 登れなかった → 平面移動の結果に戻す
      p.pos[0] = afterFlat[0]; p.pos[1] = afterFlat[1]; p.pos[2] = afterFlat[2];
    }
  }

  // 垂直
  const fallSpeed = -p.vel[1];
  p.onGround = false;
  const hitY = moveAxis(p, 1, dy, near);
  if (hitY) {
    // 下向きに当たった、または上がってきた床に乗せられた（landedOnRise）なら接地
    if (dy < 0 || landedOnRise) p.onGround = true;
    p.vel[1] = 0;
  }
  p.surfaceId = null;

  // 面（坂・傾く床）: 範囲の中で面の高さより下、または少し上（地面にいた直後）なら面に立つ
  let best: { s: SupportSurface; y: number } | null = null;
  for (const s of world.surfaces) {
    if (!inRect(s.rect, p.pos[0], p.pos[2])) continue;
    const y = surfaceY(s, p.pos[0], p.pos[2]);
    const below = p.pos[1] <= y + 1e-4 && p.pos[1] >= y - (s.thickness ?? PLAYER.surfaceThickness);
    const snapDown = wasOnGround && p.vel[1] <= 0 && p.pos[1] > y && p.pos[1] - y < PLAYER.surfaceSnap;
    if (!(below || snapDown)) continue;
    if (!best || y > best.y) best = { s, y };
  }
  if (best && p.vel[1] <= 0.01) {
    // 頭上が塞がっていなければ面の高さへ
    if (!overlapsAt(p.pos[0], best.y, p.pos[2], playerHeight(p), near)) {
      p.pos[1] = best.y;
      p.vel[1] = 0;
      p.onGround = true;
      p.surfaceId = best.s.id;
    }
  }

  if (p.onGround) {
    if (!wasOnGround && fallSpeed > 0.5) events.push({ type: 'player.land', tick, player: p.id, pos: [...p.pos], data: { speed: fallSpeed } });
    p.lastGround = [p.pos[0], p.pos[1], p.pos[2]];
  }

  updateStride(p, start, tick, events);
  const moving = p.moveRank !== 'still' || Math.abs(mx) + Math.abs(my) > 0.05;
  p.stillSec = moving || lookMoved || cmd.jump ? 0 : p.stillSec + dt;
}

function updateEye(p: PlayerState, dt: number): void {
  const target = p.crouching ? PLAYER.crouchEye : PLAYER.eye;
  const maxStep = ((PLAYER.eye - PLAYER.crouchEye) / PLAYER.eyeLerpSec) * dt;
  p.eye += clamp(target - p.eye, -maxStep, maxStep);
}

/** ゾーンの合成（足元 pos.y + 0.1）。同じ種類が重なれば water は最小 slow、friction は最小、force は加算 */
function applyZones(p: PlayerState, zones: Iterable<Zone>): void {
  p.zoneSlow = 1;
  p.zoneFriction = 1;
  p.zoneForce = [0, 0, 0];
  p.inWater = false;
  const px = p.pos[0];
  const py = p.pos[1] + 0.1;
  const pz = p.pos[2];
  for (const z of zones) {
    const a = z.aabb;
    if (px < a.min[0] || px > a.max[0] || py < a.min[1] || py > a.max[1] || pz < a.min[2] || pz > a.max[2]) continue;
    switch (z.kind) {
      case 'water':
        p.zoneSlow = Math.min(p.zoneSlow, z.params?.slow ?? 0.7);
        p.inWater = true;
        break;
      case 'friction':
        p.zoneFriction = Math.min(p.zoneFriction, Math.max(0.05, z.params?.friction ?? 0.35));
        break;
      case 'force': {
        const v = z.vector;
        if (!v) break;
        const len = Math.hypot(v[0], v[1], v[2]);
        if (len < 1e-6) break;
        const s = (z.params?.speed ?? 1.0) / len;
        p.zoneForce[0] += v[0] * s;
        p.zoneForce[1] += v[1] * s;
        p.zoneForce[2] += v[2] * s;
        break;
      }
      default:
        break;
    }
  }
}

function updateStride(p: PlayerState, start: Vec3, tick: number, events: SimEvent[]): void {
  const hs = horizontalSpeed(p);
  const prev = p.moveRank;
  p.moveRank = hs < 0.3 ? 'still' : hs < (PLAYER.walk + PLAYER.dash) / 2 ? 'walk' : 'dash';
  if (!p.onGround || p.moveRank === 'still') {
    if (p.moveRank === 'still' && prev !== 'still') p.strideAcc = 0;
    return;
  }
  const moved = Math.hypot(p.pos[0] - start[0], p.pos[2] - start[2]);
  if (moved < 1e-4) return;
  p.strideAcc += moved;
  const stride = p.moveRank === 'dash' ? PLAYER.strideDash : PLAYER.strideWalk;
  if (p.strideAcc >= stride) {
    p.strideAcc -= stride;
    p.strideCount++;
    events.push({ type: 'player.stride', tick, player: p.id, pos: [...p.pos], data: { rank: p.moveRank, crouch: p.crouching, water: p.inWater, surface: p.surfaceId } });
  }
}

// ---------------------------------------------------------------- 衝突（v1 と同じ）
const nearBuf: AABB[] = [];

function broadphase(p: PlayerState, colliders: ColliderIndex): AABB[] {
  const r = 2.0;
  return colliders.query(p.pos[0] - r, p.pos[1] - 1.5, p.pos[2] - r, p.pos[0] + r, p.pos[1] + PLAYER.height + 1.5, p.pos[2] + r, nearBuf);
}

function moveHorizontal(p: PlayerState, dx: number, dz: number, near: AABB[]): boolean {
  let blocked = false;
  if (moveAxis(p, 0, dx, near)) { blocked = true; p.vel[0] = 0; }
  if (moveAxis(p, 2, dz, near)) { blocked = true; p.vel[2] = 0; }
  return blocked;
}

/**
 * 重なっている箱から押し出す（動く箱がプレイヤーに入り込んだとき。静止した箱だけなら何もしない）。
 * 水平の 2 軸と上向きのうち、いちばん浅い向きへ押す。足元の床（上面が足から 0.35 m 以内）は上へ押すだけにする
 */
function depenetrate(p: PlayerState, near: AABB[]): void {
  const r = PLAYER.radius;
  const h = playerHeight(p);
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const c of near) {
      const minX = p.pos[0] - r, maxX = p.pos[0] + r, minY = p.pos[1] + 0.001, maxY = p.pos[1] + h, minZ = p.pos[2] - r, maxZ = p.pos[2] + r;
      if (!(minX < c.max[0] && maxX > c.min[0] && minY < c.max[1] && maxY > c.min[1] && minZ < c.max[2] && maxZ > c.min[2])) continue;
      const up = c.max[1] - p.pos[1];
      if (up > 0 && up <= PLAYER.step) { p.pos[1] = c.max[1]; moved = true; continue; }
      const px = Math.min(maxX - c.min[0], c.max[0] - minX);
      const pz = Math.min(maxZ - c.min[2], c.max[2] - minZ);
      if (px <= pz) p.pos[0] += maxX - c.min[0] < c.max[0] - minX ? -(maxX - c.min[0]) : c.max[0] - minX;
      else p.pos[2] += maxZ - c.min[2] < c.max[2] - minZ ? -(maxZ - c.min[2]) : c.max[2] - minZ;
      moved = true;
    }
    if (!moved) break;
  }
}

/** 位置 (x, y, z) に高さ h の箱を置いたとき near のどれかと重なるか（立ち上がり・面に立つ判定） */
export function overlapsAt(x: number, y: number, z: number, h: number, near: AABB[]): boolean {
  const r = PLAYER.radius;
  const minX = x - r, maxX = x + r, minZ = z - r, maxZ = z + r;
  // 床との接触を「塞がれている」と誤判定しないよう下端を少し持ち上げる
  const minY = y + 0.02, maxY = y + h;
  for (const c of near) {
    if (minX < c.max[0] && maxX > c.min[0] && minY < c.max[1] && maxY > c.min[1] && minZ < c.max[2] && maxZ > c.min[2]) return true;
  }
  return false;
}

/** 直前の moveAxis(1, +) で、上がってきた床の上へ押し上げたか */
let landedOnRise = false;

/**
 * 軸 axis に delta 動かし、重なった箱から押し出す。何かに当たれば true。
 * 上向きの移動でも、箱の上面が足元から段差（0.35 m）以内なら上へ押し上げる（下からせり上がる床に乗っている）
 */
function moveAxis(p: PlayerState, axis: 0 | 1 | 2, delta: number, near: AABB[]): boolean {
  if (axis === 1) landedOnRise = false;
  if (delta === 0) return false;
  const q: Vec3 = [p.pos[0], p.pos[1], p.pos[2]];
  q[axis] += delta;
  const r = PLAYER.radius;
  const h = playerHeight(p);
  let hit = false;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    let minX = q[0] - r, minY = q[1], minZ = q[2] - r;
    let maxX = q[0] + r, maxY = q[1] + h, maxZ = q[2] + r;
    for (const c of near) {
      if (minX < c.max[0] && maxX > c.min[0] && minY < c.max[1] && maxY > c.min[1] && minZ < c.max[2] && maxZ > c.min[2]) {
        any = true;
        hit = true;
        if (axis === 1) {
          const rise = delta > 0 && c.max[1] - q[1] <= PLAYER.step && c.max[1] - p.pos[1] <= PLAYER.step;
          if (delta < 0 || rise) { q[1] = c.max[1]; if (rise) landedOnRise = true; }
          else q[1] = c.min[1] - h;
        } else q[axis] = delta < 0 ? c.max[axis] + r : c.min[axis] - r;
        minX = q[0] - r; minY = q[1]; minZ = q[2] - r;
        maxX = q[0] + r; maxY = q[1] + h; maxZ = q[2] + r;
      }
    }
    if (!any) break;
  }
  p.pos[0] = q[0]; p.pos[1] = q[1]; p.pos[2] = q[2];
  return hit;
}
