/**
 * 物を持つ仕組みの共通の道具（持てる物・受け・パズルの部品が使う）。
 *
 * - 持てる物（carryItem / carryBody）の状態の形（ItemState）と、フロアの持てる物・受けの一覧（フロアごとに 1 度だけ作る）
 * - 名札（tag）の照合: 'parcel.red' は 'parcel' にも 'parcel.red' にも合う（'*' は何でも）
 * - 当たり判定から、置く所の支え（いちばん高い上面）・視線や投げた物の通り道の塞がりを調べる
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Quat } from '../../../math/quat.ts';
import type { Vec3 } from '../../../math/vec.ts';
import type { EntitySpec, FloorLayout, Json } from '../../../world/layout.ts';
import type { ColliderIndex } from '../../collision.ts';
import type { PartState } from '../../part.ts';

/** 持てる物の種類（部品の type） */
export const ITEM_TYPES: ReadonlySet<string> = new Set(['carryItem', 'carryBody']);
/** 置き台・枠などの受けの種類（持てる物が置くときに、ここの枠へ吸い付く） */
export const RECEIVER_TYPES: ReadonlySet<string> = new Set(['carryReceiver']);

/** mode: 0 = 置いてある（止まっている）/ 1 = 持っている / 2 = 飛んでいる・転がっている */
export const REST = 0, HELD = 1, FLY = 2;

/** 持てる物の状態（JSON にできる値だけ） */
export interface ItemState extends PartState {
  /** 中心の位置と向き [x, y, z, qx, qy, qz, qw]（countSensor など、転がる物の山と同じ形で読める） */
  poses: number[];
  yaw: number;
  /** 持っているプレイヤーの id */
  held: string | null;
  mode: number;
  /** 投げた物の速度（物理を使わない物） */
  vel: number[];
  /** 剛体（carryBody）。無ければ -1 */
  handle: number;
  /** 一度でも動かしたか（置いた物が残る: 保存する物） */
  moved: number;
  /** 持って運んだ道のり（m） */
  carried: number;
  /** 運ぶと変わる物の段（0 から） */
  stage: number;
  /** 水の量 0..1（水を運ぶ） */
  fill: number;
  /** 満杯にしてからこぼしたか */
  spilled: number;
  /** 元の部屋（homeRegion）の外へ出たことがあるか */
  away: number;
  /** 持っている人の前の tick の位置（運んだ道のり）・宙にいた秒数（着地でこぼれる） */
  last: number[];
  air: number;
  /** 入れ替え: 手に取った物の元の置き場所 [x, 底の y, z, yaw] と、その tick */
  swap: number[] | null;
  swapTick: number;
  /** 飛んでいる秒数 */
  flyT: number;
  /** 入力の前の値（立ち上がりを見る） */
  prevReset: number;
  prevScatter: number;
  /** こぼれる音の間隔 */
  spillT: number;
  /** 前の tick の中心（投げた物が的を通り抜けたかを、線分で見る） */
  prev: number[];
}

export interface CarryIndex {
  /** 持てる物の id（宣言順） */
  items: string[];
  /** 受けの部品 */
  receivers: EntitySpec[];
  specs: Map<string, EntitySpec>;
}

const INDEX = new WeakMap<FloorLayout, CarryIndex>();

/** フロアの持てる物と受けの一覧（フロアごとに 1 度だけ作る） */
export function carryIndex(floor: FloorLayout): CarryIndex {
  let ix = INDEX.get(floor);
  if (!ix) {
    const items = floor.entities.filter((e) => ITEM_TYPES.has(e.type));
    ix = { items: items.map((e) => e.id), receivers: floor.entities.filter((e) => RECEIVER_TYPES.has(e.type)), specs: new Map(items.map((e) => [e.id, e])) };
    INDEX.set(floor, ix);
  }
  return ix;
}

/** 名札 tag が patterns のどれかに合うか（無ければ何でも合う）。'parcel' は 'parcel.red' に合う。'*' は何でも */
export function tagMatch(tag: string, patterns: readonly string[] | null | undefined): boolean {
  if (!patterns || !patterns.length) return true;
  return patterns.some((p) => p === '*' || p === tag || tag.startsWith(`${p}.`));
}

export function strList(v: Json | undefined): string[] | null {
  if (typeof v === 'string') return [v];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
}

export const quatYaw = (yaw: number): Quat => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

/** 向き yaw に回した半分の寸法の、軸に平行な外形（斜めなら大きい方で囲む） */
export function yawHalf(half: Vec3, yaw: number): Vec3 {
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  return [half[0] * c + half[2] * s, half[1], half[0] * s + half[2] * c];
}

export function centerOf(st: { poses: number[] }): Vec3 {
  return [st.poses[0]!, st.poses[1]!, st.poses[2]!];
}

/** 置いてある物の外形 */
export function itemAabb(st: { poses: number[]; yaw: number }, half: Vec3): AABB {
  const h = yawHalf(half, st.yaw);
  const c = centerOf(st);
  return { min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]], max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]] };
}

/** 外形 a と重なる当たり判定の箱があるか（skip は除く: 物そのものの当たり判定） */
export function overlapsAny(colliders: ColliderIndex, a: AABB, skip?: AABB | null, eps = 0.01): boolean {
  for (const b of colliders.query(a.min[0], a.min[1], a.min[2], a.max[0], a.max[1], a.max[2])) {
    if (skip && b.min[0] === skip.min[0] && b.min[1] === skip.min[1] && b.min[2] === skip.min[2] && b.max[0] === skip.max[0] && b.max[1] === skip.max[1] && b.max[2] === skip.max[2]) continue;
    if (a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps && a.min[1] < b.max[1] - eps && a.max[1] > b.min[1] + eps && a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps) return true;
  }
  return false;
}

/**
 * 点 (x, z) の半幅 (hx, hz) の柱の中で、yTop 以下のいちばん高い上面（置く物の支え）。yMin より下は見ない。無ければ null
 */
export function supportBelow(colliders: ColliderIndex, x: number, z: number, hx: number, hz: number, yTop: number, yMin: number): number | null {
  let best: number | null = null;
  for (const b of colliders.query(x - hx, yMin, z - hz, x + hx, yTop, z + hz)) {
    if (b.max[0] <= x - hx + 1e-4 || b.min[0] >= x + hx - 1e-4 || b.max[2] <= z - hz + 1e-4 || b.min[2] >= z + hz - 1e-4) continue;
    if (b.max[1] > yTop + 1e-4 || b.max[1] < yMin) continue;
    if (best === null || b.max[1] > best) best = b.max[1];
  }
  return best;
}

/** 線分 a → b の途中が箱に入っているか（step m ごとに見る） */
export function segmentBlocked(colliders: ColliderIndex, a: Vec3, b: Vec3, step = 0.08): boolean {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(1, Math.ceil(d / step));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    if (colliders.pointBlocked(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k)) return true;
  }
  return false;
}

/** 線分 a → b と箱の当たり（投げた物が的を通り抜けたか） */
export function segmentHitsAabb(a: Vec3, b: Vec3, box: AABB): boolean {
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) {
    const o = a[k]!, d = b[k]! - a[k]!;
    if (Math.abs(d) < 1e-12) { if (o < box.min[k]! || o > box.max[k]!) return false; continue; }
    let ta = (box.min[k]! - o) / d, tb = (box.max[k]! - o) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** 角度 a を step ごとに丸める（置いた物の向き） */
export function snapAngle(a: number, step: number): number {
  if (step <= 0) return a;
  const r = Math.round(a / step) * step;
  // -π..π に収める
  return Math.atan2(Math.sin(r), Math.cos(r));
}

/** 2 つの向きの差（0..π） */
export function angleDiff(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/** params の [x, y, z, yaw] の並び */
export function poseList(v: Json | undefined): [number, number, number, number][] {
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is number[] => Array.isArray(p) && p.length >= 3 && p.every((x) => typeof x === 'number')).map((p) => [p[0]!, p[1]!, p[2]!, p[3] ?? 0]);
}

/** params の AABB（無ければ null） */
export function aabbParam(v: Json | undefined): AABB | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as { [k: string]: Json };
  const min = o.min, max = o.max;
  if (Array.isArray(min) && Array.isArray(max) && min.length === 3 && max.length === 3) return { min: [min[0] as number, min[1] as number, min[2] as number], max: [max[0] as number, max[1] as number, max[2] as number] };
  return null;
}

/** 受けの枠（params.slots の 1 つ） */
export interface Slot {
  /** 置いた物の底の中心 */
  pos: Vec3;
  /** 吸い付く半径（水平） */
  r: number;
  /** 吸い付く物の名札（無ければ受けの accept） */
  accept: string[] | null;
  /** 正しい物の名札（ok の出力。無ければ accept） */
  want: string[] | null;
  /** 置いた物の向きを決める（無ければ持っていた人の向き） */
  yaw: number | null;
}

export function slotsOf(spec: EntitySpec): Slot[] {
  const raw = spec.params.slots;
  if (!Array.isArray(raw)) return [];
  const acc = strList(spec.params.accept);
  return raw.map((s) => {
    const o = s as { [k: string]: Json };
    const p = o.pos as number[];
    return {
      pos: [p[0]!, p[1]!, p[2]!],
      r: typeof o.r === 'number' ? o.r : 0.45,
      accept: strList(o.accept) ?? acc,
      want: strList(o.want) ?? strList(o.accept) ?? acc,
      yaw: typeof o.yaw === 'number' ? o.yaw : null,
    };
  });
}
