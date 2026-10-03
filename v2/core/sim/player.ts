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
 *
 * 段階 4（移動と身体の担当）で足したもの。数値は調整表 move.*（core/config/tuning/move.ts）:
 * - はしご（climb ゾーン: はしごへ押すと上る・離れる向きで下りる・跳ぶと離れる）
 * - 深い水（swim ゾーン: 浮いて泳ぐ・しゃがむで潜る・跳ぶで浮く・縁へ押すと這い上がる）
 * - 上昇気流（force の vector の上向き）・宙にいる間だけ強い風（force の air）・泥（sink: 目が下がる）・落ちる速さの上限（drag）・
 *   重い部屋（gravity の scale > 1）・低い所（crawl ゾーン）では自動でしゃがむ
 * - 乗り物（ride）: 乗っている間、位置と速度は部品が決める（ジップライン・台車・玉乗り）
 * - 身体の大きさ（scale）: 当たり判定・目の高さ・段差・歩く速さ・跳ぶ高さ・歩幅が比例する。大きくなるのは周りに余裕があるときだけ
 * - 重力の向き（grav）: x か z の軸のまわりの 90° 単位だけ。当たり判定は「上が +Y」の計算のまま、近くの箱を回した座標で
 *   同じ移動を回す（90° 回した箱は箱のまま）。磁力の面（magnet ゾーン）へ向かって押し続けると、その面が床になる。
 *   磁力の面から足が離れると普通の重力に戻る（落ちる）
 * - 前の tick の操作（input）を状態に残す（部品が読む）
 */
import type { AABB } from '../math/aabb.ts';
import { approach, clamp, lookDir, type Vec3 } from '../math/vec.ts';
import { TUNING_SPEC, type Tuning, type TuningKey } from '../config/tuning.ts';
import type { SupportSurface, Zone } from '../world/layout.ts';
import { inRect } from '../world/footprint.ts';
import { ColliderIndex } from './collision.ts';
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
    zoneGravity: 1,
    zoneForce: [0, 0, 0],
    carry: [0, 0, 0],
    stillSec: 0,
    surfaceId: null,
    respawn: { pos: [pos[0], pos[1], pos[2]], yaw },
    lastGround: [pos[0], pos[1], pos[2]],
    interactedId: null,
    flashlight: false,
    dropPressed: false,
    holding: null,
    input: { x: 0, y: 0, jump: false, dash: false, crouch: false },
    scale: 1,
    scaleTo: 1,
    ride: null,
    climbing: false,
    swimming: false,
    mantle: null,
    grav: null,
    gravHold: 0,
    gravLeave: 0,
    zoneSink: 0,
  };
}

/** 身体の大きさの倍率（1 が普通） */
export const bodyScale = (p: PlayerState): number => p.scale ?? 1;

export function playerHeight(p: PlayerState): number {
  return (p.crouching ? PLAYER.crouchHeight : PLAYER.height) * bodyScale(p);
}

/** 当たり判定の半幅（身体の大きさに比例） */
export function playerRadius(p: PlayerState): number {
  return PLAYER.radius * bodyScale(p);
}

/** 登れる段差（身体の大きさに比例） */
const stepOf = (p: PlayerState): number => PLAYER.step * bodyScale(p);
/** 歩く速さの倍率（小さいと遅く、大きいと速い。大きさに比例はさせない） */
const speedScale = (s: number): number => 0.45 + 0.55 * s;

export function horizontalSpeed(p: PlayerState): number {
  return Math.hypot(p.vel[0], p.vel[2]);
}

/** 移動処理が引く世界（当たり判定・ゾーン・面） */
export interface PlayerWorld {
  colliders: ColliderIndex;
  zones: Iterable<Zone>;
  surfaces: Iterable<SupportSurface>;
  /** 調整表（段階 4 の動きの数値 move.*。無ければ既定値） */
  tuning?: Tuning;
}

const tv = (w: PlayerWorld, k: TuningKey): number => Number(w.tuning?.[k] ?? TUNING_SPEC[k].default);

/** 面の点 (x, z) での高さ */
export function surfaceY(s: SupportSurface, x: number, z: number): number {
  const n = s.normal;
  if (Math.abs(n[1]) < 1e-6) return -Infinity;
  return s.origin[1] - (n[0] * (x - s.origin[0]) + n[2] * (z - s.origin[2])) / n[1];
}

// ---------------------------------------------------------------- 重力の向き（90° 単位）
export type GravAxis = 'x' | 'z';

/** v を軸 axis（'x' / 'z'）のまわりに k × 90° 回す（右手系の反時計回り。誤差の出ない入れ替え） */
export function rotQuarter(v: Readonly<Vec3>, axis: GravAxis, k: number): Vec3 {
  const q = ((k % 4) + 4) % 4;
  // + 0: -0 を 0 にする（状態を JSON にしたときに揃える）
  const x = v[0] + 0, y = v[1] + 0, z = v[2] + 0;
  if (axis === 'z') return q === 0 ? [x, y, z] : q === 1 ? [0 - y, x, z] : q === 2 ? [0 - x, 0 - y, z] : [y, 0 - x, z];
  return q === 0 ? [x, y, z] : q === 1 ? [x, 0 - z, y] : q === 2 ? [x, 0 - y, 0 - z] : [x, z, 0 - y];
}

/** 箱を回す（90° 回した箱は箱のまま） */
export function rotAabb(a: AABB, axis: GravAxis, k: number): AABB {
  const p = rotQuarter(a.min, axis, k), q = rotQuarter(a.max, axis, k);
  return { min: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], max: [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])] };
}

/** 重力の向きの「上」（世界の座標） */
export function gravUp(g: PlayerState['grav']): Vec3 {
  return g ? rotQuarter([0, 1, 0], g.axis, g.k) : [0, 1, 0];
}

const sameDir = (a: Readonly<Vec3>, b: Readonly<Vec3>): boolean => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0.9;

/** 上が up になる回し方（+Y なら null）。±X は z 軸、±Z は x 軸、-Y は axis のまわり */
export function gravFor(up: Readonly<Vec3>, axis: GravAxis): PlayerState['grav'] {
  if (sameDir(up, [0, 1, 0])) return null;
  const axes: GravAxis[] = Math.abs(up[1]) > 0.5 ? [axis] : Math.abs(up[0]) > 0.5 ? ['z'] : ['x'];
  for (const a of axes) for (let k = 1; k < 4; k++) if (sameDir(rotQuarter([0, 1, 0], a, k), up)) return { axis: a, k };
  return null;
}

/** 目の位置（世界の座標。重力の向き・身体の大きさを含む） */
export function playerEye(p: PlayerState): Vec3 {
  const up = gravUp(p.grav);
  return [p.pos[0] + up[0] * p.eye, p.pos[1] + up[1] * p.eye, p.pos[2] + up[2] * p.eye];
}

/** 視線の向き（世界の座標。yaw / pitch は重力の向きの中での値） */
export function playerLook(p: PlayerState, yaw: number, pitch: number): Vec3 {
  const d = lookDir(yaw, pitch);
  return p.grav ? rotQuarter(d, p.grav.axis, p.grav.k) : d;
}

/** 身体の箱（世界の座標） */
export function bodyAabb(p: PlayerState): AABB {
  const r = playerRadius(p), h = playerHeight(p);
  if (!p.grav) return { min: [p.pos[0] - r, p.pos[1], p.pos[2] - r], max: [p.pos[0] + r, p.pos[1] + h, p.pos[2] + r] };
  const l = rotQuarter(p.pos, p.grav.axis, 4 - p.grav.k);
  return rotAabb({ min: [l[0] - r, l[1], l[2] - r], max: [l[0] + r, l[1] + h, l[2] + r] }, p.grav.axis, p.grav.k);
}

// ---------------------------------------------------------------- 1 tick
/** プレイヤーを 1 tick 進める（p を書き換える）。起きたことは events に足す */
export function stepPlayer(p: PlayerState, cmd: InputCommand, world: PlayerWorld, dt: number, tick: number, events: SimEvent[]): void {
  // 部品が次の tick に読む操作
  p.input = { x: clamp(cmd.moveX, -1, 1), y: clamp(cmd.moveY, -1, 1), jump: !!cmd.jump, dash: !!cmd.dash, crouch: !!cmd.crouch };
  const inTwist = !p.ride && twistStep(p, world, tick, events);
  if (p.grav) stepFramed(p, cmd, world, dt, tick, events);
  else stepUpright(p, cmd, world, dt, tick, events);
  if (!p.ride && !inTwist) magnetStep(p, world, dt, tick, events);
}

/**
 * 筒の通路（twist ゾーン）: 区切りごとに重力の向きが決まっている（params.k: 筒の軸 params.axis のまわりの 90° の回数）。
 * 違う向きの区切りへ入ると、筒の真ん中の線（params.center = 軸に垂直な横の座標と高さ）のまわりに身体ごと回す
 * （四角い筒なので、回した先は隣の面の上）。twist ゾーンの中にいる間は磁力の面の判定をしない。戻り値は twist ゾーンの中か
 */
function twistStep(p: PlayerState, world: PlayerWorld, tick: number, events: SimEvent[]): boolean {
  const b = bodyAabb(p);
  const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  for (const z of world.zones) {
    if (z.kind !== 'twist') continue;
    const a = z.aabb;
    if (c[0] < a.min[0] || c[0] > a.max[0] || c[1] < a.min[1] || c[1] > a.max[1] || c[2] < a.min[2] || c[2] > a.max[2]) continue;
    const axis: GravAxis = z.params?.axis === 'x' ? 'x' : 'z';
    const k = ((Math.round(Number(z.params?.k ?? 0)) % 4) + 4) % 4;
    const cur = p.grav ? (p.grav.axis === axis ? p.grav.k : -1) : 0;
    if (cur < 0 || cur === k) return true;
    const d = k - cur;
    const cen = (z.params?.center as number[] | undefined) ?? [0, 0];
    const o: Vec3 = axis === 'z' ? [p.pos[0] - cen[0]!, p.pos[1] - cen[1]!, 0] : [0, p.pos[1] - cen[1]!, p.pos[2] - cen[0]!];
    const r = rotQuarter(o, axis, d);
    p.pos = axis === 'z' ? [cen[0]! + r[0], cen[1]! + r[1], p.pos[2]] : [p.pos[0], cen[1]! + r[1], cen[0]! + r[2]];
    p.vel = rotQuarter(p.vel, axis, d);
    p.carry = rotQuarter(p.carry, axis, d);
    p.grav = k === 0 ? null : { axis, k };
    p.onGround = false;
    p.surfaceId = null;
    p.gravHold = 0; p.gravLeave = 0;
    events.push({ type: 'player.gravity', tick, player: p.id, pos: [...p.pos], data: { up: gravUp(p.grav).join(','), twist: true } });
    return true;
  }
  return false;
}

/**
 * 重力の向きが回っているとき: 近くの箱・ゾーンを「上が +Y」になる座標へ回し、同じ移動の計算を回して戻す。
 * 視線（yaw / pitch）は回した座標の中の値のまま（クライアントのカメラが向きを回して見せる）
 */
function stepFramed(p: PlayerState, cmd: InputCommand, world: PlayerWorld, dt: number, tick: number, events: SimEvent[]): void {
  const g = p.grav!;
  const inv = 4 - g.k;
  const toL = (v: Readonly<Vec3>): Vec3 => rotQuarter(v, g.axis, inv);
  const toW = (v: Readonly<Vec3>): Vec3 => rotQuarter(v, g.axis, g.k);
  const R = 2.8;
  const local = new ColliderIndex();
  for (const b of world.colliders.query(p.pos[0] - R, p.pos[1] - R, p.pos[2] - R, p.pos[0] + R, p.pos[1] + R, p.pos[2] + R)) local.addStatic(rotAabb(b, g.axis, inv));
  const zones: Zone[] = [];
  for (const z of world.zones) {
    const a = z.aabb;
    if (a.max[0] < p.pos[0] - R || a.min[0] > p.pos[0] + R || a.max[1] < p.pos[1] - R || a.min[1] > p.pos[1] + R || a.max[2] < p.pos[2] - R || a.min[2] > p.pos[2] + R) continue;
    const lz: Zone = { ...z, aabb: rotAabb(a, g.axis, inv) };
    if (z.vector) lz.vector = toL(z.vector);
    zones.push(lz);
  }
  const q: PlayerState = { ...p, pos: toL(p.pos), vel: toL(p.vel), lastGround: toL(p.lastGround), zoneForce: toL(p.zoneForce), carry: toL(p.carry), grav: null };
  const ev: SimEvent[] = [];
  stepUpright(q, cmd, { colliders: local, zones, surfaces: [], ...(world.tuning ? { tuning: world.tuning } : {}) }, dt, tick, ev);
  Object.assign(p, q, { pos: toW(q.pos), vel: toW(q.vel), lastGround: toW(q.lastGround), zoneForce: toW(q.zoneForce), carry: toW(q.carry), grav: g });
  for (const e of ev) { if (e.pos) e.pos = toW(e.pos); events.push(e); }
}

/** 足元のゾーンを合成した結果のうち、移動の中だけで使うもの */
interface ZoneInfo {
  /** はしごへ向かう向き */
  climb: Vec3 | null;
  /** 深い水の水面 */
  swim: number | null;
  crawl: boolean;
  /** 落ちる速さの上限（0 なら無し） */
  drag: number;
}

function stepUpright(p: PlayerState, cmd: InputCommand, world: PlayerWorld, dt: number, tick: number, events: SimEvent[]): void {
  // 視線は絶対値（クライアントが積算した値）
  const lookMoved = Math.abs(cmd.yaw - p.yaw) + Math.abs(cmd.pitch - p.pitch) > 1e-4;
  p.yaw = cmd.yaw;
  const lim = Math.PI / 2 - 0.05;
  p.pitch = clamp(cmd.pitch, -lim, lim);
  const s = bodyScale(p);

  const near = broadphase(p, world.colliders);
  // 動く箱（扉・動く壁）に入り込まれていたら、いちばん浅い向きへ押し出す
  depenetrate(p, near);

  const zi = applyZones(p, world.zones);

  // 姿勢: しゃがみ入力・低い所（crawl ゾーン）では即しゃがむ。立つときは標準の高さの箱が塞がれていないこと
  if (cmd.crouch || zi.crawl) p.crouching = true;
  else if (p.crouching && !overlapsAt(p.pos[0], p.pos[1], p.pos[2], PLAYER.height * s, near, playerRadius(p))) p.crouching = false;
  updateScale(p, near, world, dt);
  updateEye(p, dt);

  // 乗り物: 位置と速度は部品が決める（この tick の移動はしない）
  if (p.ride) {
    p.climbing = false; p.swimming = false; p.mantle = null;
    p.stillSec = Math.abs(cmd.moveX) + Math.abs(cmd.moveY) > 0.05 || lookMoved || cmd.jump ? 0 : p.stillSec + dt;
    return;
  }

  // 水から這い上がっている途中（縁を越えた・着地した・落ち戻ったら終わる）
  if (p.mantle !== null && (p.onGround || p.pos[1] > p.mantle + 0.05 || (p.vel[1] < 0 && p.pos[1] < p.mantle - 1.0))) p.mantle = null;
  const depth = zi.swim !== null ? zi.swim - p.pos[1] : 0;
  p.swimming = zi.swim !== null && p.mantle === null && depth > tv(world, 'move.swim.depth') * s;

  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  // 前方 = -Z を yaw で回した方向
  const fx = -sin, fz = -cos, rx = cos, rz = -sin;
  const mx = clamp(cmd.moveX, -1, 1);
  const my = clamp(cmd.moveY, -1, 1);
  const ix = fx * my + rx * mx, iz = fz * my + rz * mx;

  // はしご: はしごへ押すと上る（水の中からでもつかまれる）。つかまっている間は、はしごから離れる向きには動かない（下りる）
  let climbV: number | null = null;
  if (zi.climb) {
    const cv = zi.climb;
    const il = Math.max(1, Math.hypot(ix, iz));
    const push = (ix * cv[0] + iz * cv[2]) / il;
    const cs = tv(world, 'move.climb.speed') * Math.sqrt(s);
    if (push > 0.3) climbV = cs * Math.min(1, push * 1.3);
    else if (!p.onGround && !p.swimming && (p.climbing || push < -0.3)) climbV = push < -0.3 ? -cs : 0;
  }
  p.climbing = climbV !== null;
  if (p.climbing) p.swimming = false;

  // 水平速度
  let speed = cmd.dash && !p.crouching ? PLAYER.dash : PLAYER.walk;
  if (p.crouching) speed *= PLAYER.crouchSpeed;
  speed *= p.zoneSlow * speedScale(s);
  if (p.swimming) speed = (cmd.dash ? tv(world, 'move.swim.dashSpeed') : tv(world, 'move.swim.speed')) * speedScale(s);
  let tx = ix * speed, tz = iz * speed;
  if (p.climbing) {
    const cv = zi.climb!;
    const along = tx * cv[0] + tz * cv[2];
    if (along < 0) { tx -= along * cv[0]; tz -= along * cv[2]; }
    tx += cv[0] * 0.4; tz += cv[2] * 0.4;
  }

  const targetX = tx + p.zoneForce[0] + p.carry[0];
  const targetZ = tz + p.zoneForce[2] + p.carry[2];
  const accel = p.swimming ? 5 : (p.onGround || p.climbing ? 18 : 6) * p.zoneFriction * p.zoneFriction;
  const k = Math.min(1, accel * dt);
  p.vel[0] += (targetX - p.vel[0]) * k;
  p.vel[2] += (targetZ - p.vel[2]) * k;

  if (p.climbing) {
    if (cmd.jump) {
      // 跳ぶ: はしごから離れる
      const cv = zi.climb!;
      p.vel = [-cv[0] * 2.4, PLAYER.jump * 0.6 * Math.sqrt(s), -cv[2] * 2.4];
      p.climbing = false;
      events.push({ type: 'player.jump', tick, player: p.id, pos: [...p.pos] });
    } else p.vel[1] = climbV!;
  } else if (p.swimming) {
    // 浮く: 浮いた高さ（水面 - float）へ寄る。しゃがむと潜る・跳ぶと浮き上がる
    let vt: number;
    if (cmd.crouch) vt = -tv(world, 'move.swim.dive');
    else if (cmd.jump) vt = tv(world, 'move.swim.rise');
    else vt = clamp((zi.swim! - tv(world, 'move.swim.float') * s - p.pos[1]) * 2.5, -1.5, 1.5);
    p.vel[1] += (vt - p.vel[1]) * Math.min(1, 4 * dt);
    p.onGround = false;
  } else {
    if (cmd.jump && p.onGround) {
      p.vel[1] = PLAYER.jump * Math.sqrt(s);
      p.onGround = false;
      p.surfaceId = null;
      events.push({ type: 'player.jump', tick, player: p.id, pos: [...p.pos] });
    }
    // 上昇気流: 上向きの流れの中では、重さの代わりに流れの速さへ近づく（流れの上端を出ると落ち始める）
    if (p.zoneForce[1] > 1e-6) p.vel[1] += (p.zoneForce[1] - p.vel[1]) * Math.min(1, tv(world, 'move.updraft.accel') * dt);
    else p.vel[1] -= PLAYER.gravity * p.zoneGravity * dt;
    if (zi.drag > 0 && p.vel[1] < -zi.drag) p.vel[1] = -zi.drag;
    if (p.vel[1] < -PLAYER.maxFall) p.vel[1] = -PLAYER.maxFall;
  }

  const dx = p.vel[0] * dt;
  const dz = p.vel[2] * dt;
  const dy = p.vel[1] * dt + p.carry[1] * dt;

  // 水平移動（段差登り付き）
  const start: Vec3 = [p.pos[0], p.pos[1], p.pos[2]];
  const wasOnGround = p.onGround;
  const blocked = moveHorizontal(p, dx, dz, near);
  const rise = blocked && wasOnGround ? stepNeeded(start, dx, dz, near, playerHeight(p), playerRadius(p), stepOf(p)) : 0;
  if (rise > 0) {
    const afterFlat: Vec3 = [p.pos[0], p.pos[1], p.pos[2]];
    // 越えるのに要る高さだけ持ち上げる（v1 は一律 0.35 m 上げていたので、低い開口では頭が上の壁に当たって数 cm の段も越えられなかった）
    p.pos[0] = start[0]; p.pos[1] = start[1] + rise; p.pos[2] = start[2];
    const blocked2 = moveHorizontal(p, dx, dz, near);
    // 上がった位置から下へ戻す
    const hit = moveAxis(p, 1, -rise, near);
    if (blocked2 || !hit || p.pos[1] < start[1] - 0.001) {
      // 登れなかった → 平面移動の結果に戻す
      p.pos[0] = afterFlat[0]; p.pos[1] = afterFlat[1]; p.pos[2] = afterFlat[2];
    }
  }
  // 泳いでいて縁に当たった: 縁へ押していれば（前でも横でも）、水面から move.swim.mantle までの縁へ這い上がる
  if (blocked && p.swimming && Math.hypot(ix, iz) > 0.3) {
    const top = ledgeTop(start, dx, dz, near, playerRadius(p), zi.swim! + tv(world, 'move.swim.mantle') - start[1]);
    if (top !== null && !overlapsAt(start[0], top, start[2], playerHeight(p), near, playerRadius(p))) {
      p.mantle = top;
      p.swimming = false;
      p.vel[1] = Math.sqrt(2 * PLAYER.gravity * Math.max(0.05, top - p.pos[1] + 0.15));
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
  for (const sf of world.surfaces) {
    if (!inRect(sf.rect, p.pos[0], p.pos[2])) continue;
    const y = surfaceY(sf, p.pos[0], p.pos[2]);
    const below = p.pos[1] <= y + 1e-4 && p.pos[1] >= y - (sf.thickness ?? PLAYER.surfaceThickness);
    const snapDown = wasOnGround && p.vel[1] <= 0 && p.pos[1] > y && p.pos[1] - y < PLAYER.surfaceSnap;
    if (!(below || snapDown)) continue;
    if (!best || y > best.y) best = { s: sf, y };
  }
  if (best && p.vel[1] <= 0.01) {
    // 頭上が塞がっていなければ面の高さへ
    if (!overlapsAt(p.pos[0], best.y, p.pos[2], playerHeight(p), near, playerRadius(p))) {
      p.pos[1] = best.y;
      p.vel[1] = 0;
      p.onGround = true;
      p.surfaceId = best.s.id;
    }
  }

  if (p.onGround) {
    if (!wasOnGround && fallSpeed > 0.5) events.push({ type: 'player.land', tick, player: p.id, pos: [...p.pos], data: { speed: fallSpeed } });
    p.lastGround = [p.pos[0], p.pos[1], p.pos[2]];
    p.climbing = false;
  }

  updateStride(p, start, tick, events, Math.abs(mx) + Math.abs(my) > 0.05);
  const moving = p.moveRank !== 'still' || Math.abs(mx) + Math.abs(my) > 0.05;
  p.stillSec = moving || lookMoved || cmd.jump ? 0 : p.stillSec + dt;
}

function updateEye(p: PlayerState, dt: number): void {
  const s = bodyScale(p);
  const target = Math.max(0.15 * s, (p.crouching ? PLAYER.crouchEye : PLAYER.eye) * s - p.zoneSink);
  const maxStep = ((PLAYER.eye - PLAYER.crouchEye) / PLAYER.eyeLerpSec) * dt * Math.max(1, s);
  p.eye += clamp(target - p.eye, -maxStep, maxStep);
}

/** 身体の大きさを scaleTo へ近づける。大きくなるのは、大きくなった身体が箱に埋まらないときだけ */
function updateScale(p: PlayerState, near: AABB[], world: PlayerWorld, dt: number): void {
  if (Math.abs(p.scaleTo - p.scale) < 1e-6) return;
  const next = approach(p.scale, p.scaleTo, tv(world, 'move.scale.rate') * dt);
  if (next > p.scale && overlapsAt(p.pos[0], p.pos[1], p.pos[2], (p.crouching ? PLAYER.crouchHeight : PLAYER.height) * next, near, PLAYER.radius * next)) return;
  p.scale = next;
}

/**
 * ゾーンの合成（足元 pos.y + 0.1）。同じ種類が重なれば water は最小 slow、friction は最小、force は加算、
 * gravity は 1 から遠い方（軽い部屋・重い部屋）、sink は最大、drag は最小
 */
function applyZones(p: PlayerState, zones: Iterable<Zone>): ZoneInfo {
  p.zoneSlow = 1;
  p.zoneFriction = 1;
  p.zoneGravity = 1;
  p.zoneForce = [0, 0, 0];
  p.zoneSink = 0;
  p.inWater = false;
  const info: ZoneInfo = { climb: null, swim: null, crawl: false, drag: 0 };
  const px = p.pos[0];
  const py = p.pos[1] + 0.1;
  const pz = p.pos[2];
  // はしごは身体の真ん中で見る（上り切る直前に足がゾーンの上へ出ても、つかまったまま）
  const cy = p.pos[1] + playerHeight(p) * 0.5;
  // 低い所は、頭がつかえる前（体の幅 + 0.25 m 手前）からしゃがむ
  const cm = playerRadius(p) + 0.25;
  for (const z of zones) {
    const a = z.aabb;
    if (z.kind === 'crawl') {
      if (px >= a.min[0] - cm && px <= a.max[0] + cm && pz >= a.min[2] - cm && pz <= a.max[2] + cm && py >= a.min[1] && py <= a.max[1]) info.crawl = true;
      continue;
    }
    if (px < a.min[0] || px > a.max[0] || pz < a.min[2] || pz > a.max[2]) continue;
    if (z.kind === 'climb') {
      if ((py >= a.min[1] && py <= a.max[1]) || (cy >= a.min[1] && cy <= a.max[1])) if (z.vector) info.climb = z.vector;
      continue;
    }
    if (py < a.min[1] || py > a.max[1]) continue;
    const prm = z.params;
    if (typeof prm?.sink === 'number') p.zoneSink = Math.max(p.zoneSink, prm.sink);
    if (typeof prm?.drag === 'number' && prm.drag > 0) info.drag = info.drag > 0 ? Math.min(info.drag, prm.drag) : prm.drag;
    switch (z.kind) {
      case 'water':
        p.zoneSlow = Math.min(p.zoneSlow, z.params?.slow ?? 0.7);
        // dry: 水ではないが足が取られる所（物の海など）。遅くなるだけで水の足音にしない。
        // submerged: 水槽の無い水（部屋ごと水の中）。水の足音にする
        if (!z.params?.dry || z.params?.submerged) p.inWater = true;
        break;
      case 'swim': {
        const surf = typeof prm?.surface === 'number' ? prm.surface : a.max[1];
        info.swim = info.swim === null ? surf : Math.max(info.swim, surf);
        if (typeof prm?.slow === 'number') p.zoneSlow = Math.min(p.zoneSlow, prm.slow);
        if (!prm?.dry) p.inWater = true;
        break;
      }
      case 'friction':
        p.zoneFriction = Math.min(p.zoneFriction, Math.max(0.05, z.params?.friction ?? 0.35));
        break;
      case 'gravity': {
        const sc = clamp(Number(z.params?.scale ?? 0.4), 0.1, 3);
        if (Math.abs(sc - 1) > Math.abs(p.zoneGravity - 1)) p.zoneGravity = sc;
        // 重い部屋: 歩きも重い（slow）
        if (typeof prm?.slow === 'number') p.zoneSlow = Math.min(p.zoneSlow, prm.slow);
        break;
      }
      case 'force': {
        const v = z.vector;
        if (!v) break;
        const len = Math.hypot(v[0], v[1], v[2]);
        if (len < 1e-6) break;
        // air: 宙にいる間の倍率（風に飛ばされる）
        const air = !p.onGround && typeof prm?.air === 'number' ? prm.air : 1;
        const s = ((z.params?.speed ?? 1.0) / len) * air;
        p.zoneForce[0] += v[0] * s;
        p.zoneForce[1] += v[1] * s;
        p.zoneForce[2] += v[2] * s;
        break;
      }
      default:
        break;
    }
  }
  return info;
}

/**
 * 磁力の面（magnet ゾーン。磁力の靴・重力の回廊）: 今の上と違う向きの面に身体が触れていて、その面へ向かって押し続けたら
 * （move.grav.holdSec）、その面を床にする。今の上の向きの面から足が離れたら（move.grav.leaveSec）普通の重力に戻る
 */
function magnetStep(p: PlayerState, world: PlayerWorld, dt: number, tick: number, events: SimEvent[]): void {
  let any = false;
  const up = gravUp(p.grav);
  const body = bodyAabb(p);
  // 操作の向き（世界の座標）
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const local: Vec3 = [-sin * p.input.y + cos * p.input.x, 0, -cos * p.input.y - sin * p.input.x];
  const dir = p.grav ? rotQuarter(local, p.grav.axis, p.grav.k) : local;
  let support = false;
  let best: { z: Zone; s: number } | null = null;
  for (const z of world.zones) {
    if (z.kind !== 'magnet' || !z.vector) continue;
    any = true;
    const v = z.vector;
    if (sameDir(v, up)) {
      const a = z.aabb, e = 0.05;
      if (p.pos[0] >= a.min[0] - e && p.pos[0] <= a.max[0] + e && p.pos[1] >= a.min[1] - e && p.pos[1] <= a.max[1] + e && p.pos[2] >= a.min[2] - e && p.pos[2] <= a.max[2] + e) support = true;
      continue;
    }
    if (!touchesFace(body, z)) continue;
    const s = -(dir[0] * v[0] + dir[1] * v[1] + dir[2] * v[2]);
    if (s > 0.6 && (!best || s > best.s)) best = { z, s };
  }
  if (!any) { p.gravHold = 0; p.gravLeave = 0; if (p.grav) revertGravity(p, world, tick, events); return; }
  if (best) {
    p.gravHold += dt;
    if (p.gravHold >= tv(world, 'move.grav.holdSec') && flipTo(p, best.z, world)) {
      p.gravHold = 0; p.gravLeave = 0;
      events.push({ type: 'player.gravity', tick, player: p.id, pos: [...p.pos], data: { up: gravUp(p.grav).join(',') } });
      return;
    }
  } else p.gravHold = 0;
  if (p.grav && !support) {
    p.gravLeave += dt;
    if (p.gravLeave >= tv(world, 'move.grav.leaveSec')) revertGravity(p, world, tick, events);
  } else p.gravLeave = 0;
}

/** 身体の箱が、磁力のゾーンの面（向き vector の裏側の面）に触れている */
function touchesFace(body: AABB, z: Zone): boolean {
  const v = z.vector!, a = z.aabb, e = 0.06;
  const ax = Math.abs(v[0]) > 0.5 ? 0 : Math.abs(v[1]) > 0.5 ? 1 : 2;
  const plane = v[ax]! > 0 ? a.min[ax]! : a.max[ax]!;
  const d = v[ax]! > 0 ? body.min[ax]! - plane : plane - body.max[ax]!;
  if (d < -e || d > e) return false;
  for (let i = 0; i < 3; i++) if (i !== ax && (body.max[i]! <= a.min[i]! || body.min[i]! >= a.max[i]!)) return false;
  return true;
}

function bodyBlocked(p: PlayerState, world: PlayerWorld): boolean {
  const b = bodyAabb(p);
  const e = 0.01;
  for (const c of world.colliders.query(b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2])) {
    if (b.min[0] + e < c.max[0] && b.max[0] - e > c.min[0] && b.min[1] + e < c.max[1] && b.max[1] - e > c.min[1] && b.min[2] + e < c.max[2] && b.max[2] - e > c.min[2]) return true;
  }
  return false;
}

/** 面 z を床にする: 足元を、身体の真ん中を面へ下ろした所にする。新しい向きの身体が箱に埋まるならやめる */
function flipTo(p: PlayerState, z: Zone, world: PlayerWorld): boolean {
  const v = z.vector!;
  const axis = (z.params?.axis === 'x' ? 'x' : z.params?.axis === 'z' ? 'z' : p.grav?.axis ?? 'z') as GravAxis;
  const g = gravFor(v, axis);
  const b = bodyAabb(p);
  const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const ax = Math.abs(v[0]) > 0.5 ? 0 : Math.abs(v[1]) > 0.5 ? 1 : 2;
  const f: Vec3 = [...c];
  f[ax] = (v[ax]! > 0 ? z.aabb.min[ax]! : z.aabb.max[ax]!) + Math.sign(v[ax]!) * 0.002;
  const trial: PlayerState = { ...p, pos: f, grav: g };
  if (bodyBlocked(trial, world)) return false;
  p.pos = f;
  p.vel = [0, 0, 0];
  p.grav = g;
  p.onGround = false;
  p.surfaceId = null;
  p.climbing = false;
  p.swimming = false;
  p.mantle = null;
  return true;
}

/** 普通の重力に戻す（身体の真ん中は同じ所のまま、立った向きにする。そのまま下へ落ちる） */
function revertGravity(p: PlayerState, world: PlayerWorld, tick: number, events: SimEvent[]): void {
  const b = bodyAabb(p);
  const h = playerHeight(p);
  const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const vel = p.vel;
  p.grav = null;
  p.pos = [c[0], c[1] - h / 2, c[2]];
  // 立った向きの身体が埋まるなら、少し上・下を試す（壁に立っていた身体を起こすと床・天井に掛かることがある）
  for (const dy of [0, 0.3, -0.3, 0.6, -0.6]) {
    const trial: PlayerState = { ...p, pos: [c[0], c[1] - h / 2 + dy, c[2]] };
    if (!bodyBlocked(trial, world)) { p.pos = trial.pos; break; }
  }
  p.vel = [vel[0] * 0.3, Math.min(0, vel[1]), vel[2] * 0.3];
  p.onGround = false;
  p.gravHold = 0;
  p.gravLeave = 0;
  events.push({ type: 'player.gravity', tick, player: p.id, pos: [...p.pos], data: { up: '0,1,0' } });
}

/** 歩幅と足音。stepping: 歩く操作をしているか（段階 4: 操作が無いのに運ばれている間 = 動く歩道・縮む廊下は足音にしない） */
function updateStride(p: PlayerState, start: Vec3, tick: number, events: SimEvent[], stepping = true): void {
  const hs = horizontalSpeed(p);
  const prev = p.moveRank;
  p.moveRank = hs < 0.3 ? 'still' : hs < (PLAYER.walk + PLAYER.dash) / 2 ? 'walk' : 'dash';
  if (!p.onGround || p.moveRank === 'still' || !stepping) {
    if (p.moveRank === 'still' && prev !== 'still') p.strideAcc = 0;
    return;
  }
  const moved = Math.hypot(p.pos[0] - start[0], p.pos[2] - start[2]);
  if (moved < 1e-4) return;
  p.strideAcc += moved;
  const stride = (p.moveRank === 'dash' ? PLAYER.strideDash : PLAYER.strideWalk) * bodyScale(p);
  if (p.strideAcc >= stride) {
    p.strideAcc -= stride;
    p.strideCount++;
    events.push({ type: 'player.stride', tick, player: p.id, pos: [...p.pos], data: { rank: p.moveRank, crouch: p.crouching, water: p.inWater, surface: p.surfaceId } });
  }
}

// ---------------------------------------------------------------- 衝突（v1 と同じ。身体の大きさだけ足した）
const nearBuf: AABB[] = [];

function broadphase(p: PlayerState, colliders: ColliderIndex): AABB[] {
  const r = 2.0 * Math.max(1, bodyScale(p));
  return colliders.query(p.pos[0] - r, p.pos[1] - 1.5, p.pos[2] - r, p.pos[0] + r, p.pos[1] + playerHeight(p) + 1.5, p.pos[2] + r, nearBuf);
}

/**
 * 段を越えるのに要る高さ（0 なら越えられない）: 動いた先で足元から段差（0.35 m）以内の高さに上面がある箱の、いちばん高い上面まで。
 * 段差より高い箱にも当たるなら 0（壁）
 */
function stepNeeded(start: Vec3, dx: number, dz: number, near: AABB[], h: number, r: number = PLAYER.radius, step: number = PLAYER.step): number {
  const x = start[0] + dx, z = start[2] + dz, y = start[1];
  let need = 0;
  for (const c of near) {
    if (!(x - r < c.max[0] && x + r > c.min[0] && z - r < c.max[2] && z + r > c.min[2] && y < c.max[1] && y + h > c.min[1])) continue;
    const up = c.max[1] - y;
    if (up > step) return 0;
    if (up > need) need = up;
  }
  return need > 0 ? Math.min(step, need + 0.005) : 0;
}

/**
 * 泳いでいて当たった縁の上面（足元から maxRise 以内）。前に当たる箱のうちいちばん高い上面。
 * それより高い箱（壁）にも当たる・何にも当たらないなら null
 */
function ledgeTop(start: Vec3, dx: number, dz: number, near: AABB[], r: number, maxRise: number): number | null {
  const l = Math.hypot(dx, dz);
  if (l < 1e-6 || maxRise <= 0) return null;
  // 少し先（0.08 m）まで伸ばして、触れている縁を拾う
  const x = start[0] + (dx / l) * 0.08, z = start[2] + (dz / l) * 0.08, y = start[1];
  let top: number | null = null;
  for (const c of near) {
    if (!(x - r < c.max[0] && x + r > c.min[0] && z - r < c.max[2] && z + r > c.min[2] && c.max[1] > y + 0.05 && c.min[1] < y + maxRise + 1.7)) continue;
    const up = c.max[1] - y;
    if (up > maxRise) return null;
    if (top === null || c.max[1] > top) top = c.max[1];
  }
  return top;
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
  const r = playerRadius(p);
  const h = playerHeight(p);
  const step = stepOf(p);
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const c of near) {
      const minX = p.pos[0] - r, maxX = p.pos[0] + r, minY = p.pos[1] + 0.001, maxY = p.pos[1] + h, minZ = p.pos[2] - r, maxZ = p.pos[2] + r;
      if (!(minX < c.max[0] && maxX > c.min[0] && minY < c.max[1] && maxY > c.min[1] && minZ < c.max[2] && maxZ > c.min[2])) continue;
      const up = c.max[1] - p.pos[1];
      if (up > 0 && up <= step) { p.pos[1] = c.max[1]; moved = true; continue; }
      const px = Math.min(maxX - c.min[0], c.max[0] - minX);
      const pz = Math.min(maxZ - c.min[2], c.max[2] - minZ);
      // 横へ体の幅より大きく押し出すことになる箱（頭の上の天井・大きな床板）は横へは押さない。腰より上の箱なら下へ押す
      // （昇降台で天井へ押し付けられたときに、天井の端まで何 m も飛ばない）
      if (Math.min(px, pz) > 2 * r) {
        if (c.min[1] > p.pos[1] + h * 0.5) { p.pos[1] = c.min[1] - h; moved = true; }
        continue;
      }
      if (px <= pz) p.pos[0] += maxX - c.min[0] < c.max[0] - minX ? -(maxX - c.min[0]) : c.max[0] - minX;
      else p.pos[2] += maxZ - c.min[2] < c.max[2] - minZ ? -(maxZ - c.min[2]) : c.max[2] - minZ;
      moved = true;
    }
    if (!moved) break;
  }
}

/** 位置 (x, y, z) に高さ h・半幅 r の箱を置いたとき near のどれかと重なるか（立ち上がり・面に立つ判定） */
export function overlapsAt(x: number, y: number, z: number, h: number, near: AABB[], r: number = PLAYER.radius): boolean {
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
 * 上向きの移動でも、箱の上面が足元から段差（0.35 m）以内なら上へ押し上げる（下からせり上がる床に乗っている）。
 * 押し戻す面は「動く前にいた側」で決める。動く前からこの軸で重なっていた箱（別の軸の動きで角をかすめた・前からの重なり）は
 * ここでは押さない（重なりは次の tick の depenetrate が最小の量で直す）。
 * v1 は動いた向きで面を決めていたので、角をかすめると箱の反対側まで飛んで続く箱も突き抜け、下向きの移動では背の高い棚の上へ乗った
 */
/** 細い足場の端の余裕（体の真ん中が上面からこれだけはみ出しても乗っている） */
const NARROW_M = 0.08;
const pre1 = (p: PlayerState): number => p.pos[1];

function moveAxis(p: PlayerState, axis: 0 | 1 | 2, delta: number, near: AABB[]): boolean {
  if (axis === 1) landedOnRise = false;
  if (delta === 0) return false;
  const q: Vec3 = [p.pos[0], p.pos[1], p.pos[2]];
  q[axis] += delta;
  const r = playerRadius(p);
  const h = playerHeight(p);
  const step = stepOf(p);
  let hit = false;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    let minX = q[0] - r, minY = q[1], minZ = q[2] - r;
    let maxX = q[0] + r, maxY = q[1] + h, maxZ = q[2] + r;
    for (const c of near) {
      if (minX < c.max[0] && maxX > c.min[0] && minY < c.max[1] && maxY > c.min[1] && minZ < c.max[2] && maxZ > c.min[2]) {
        if (axis === 1) {
          // 細い足場（narrow）: 体の真ん中が上面の上に無ければ乗れない（体の端が掛かっただけで渡れる幅にしない。14 章）
          if (c.narrow && (q[0] < c.min[0] - NARROW_M || q[0] > c.max[0] + NARROW_M || q[2] < c.min[2] - NARROW_M || q[2] > c.max[2] + NARROW_M) && pre1(p) >= c.max[1] - 0.05) continue;
          // 縦も動く前にいた側で決める: 上から降りた（足が上面から段差以内）なら上に乗る / せり上がる床に押し上げられる / 下から頭を打つ。
          // 横から重なっていた箱（背の高い棚・机の天板の横）には乗らない（v1 は下向きの移動なら高さに関係なく上面へ乗せていた）
          const pre = p.pos[1];
          const rise = delta > 0 && c.max[1] - q[1] <= step && c.max[1] - pre <= step;
          if (rise || (delta < 0 && pre >= c.max[1] - step)) { q[1] = c.max[1]; if (rise) landedOnRise = true; }
          else if (delta > 0 && pre + h <= c.min[1] + 1e-6) q[1] = c.min[1] - h;
          else continue;
        } else {
          const pre = p.pos[axis];
          if (pre + r <= c.min[axis] + 1e-6) q[axis] = c.min[axis] - r;
          else if (pre - r >= c.max[axis] - 1e-6) q[axis] = c.max[axis] + r;
          else continue;
        }
        any = true;
        hit = true;
        minX = q[0] - r; minY = q[1]; minZ = q[2] - r;
        maxX = q[0] + r; maxY = q[1] + h; maxZ = q[2] + r;
      }
    }
    if (!any) break;
  }
  p.pos[0] = q[0]; p.pos[1] = q[1]; p.pos[2] = q[2];
  return hit;
}
