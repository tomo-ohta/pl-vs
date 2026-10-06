/**
 * 区画の箱から「作り込む小物」を見つけ、形の関数での作り方（PropSpec）に置き換える計画を作る。
 *
 * 見つけ方は v2 の中身（core/gen/dress）の作りに合わせる:
 * - 家具・設備は propGroup（tagGroup）で 1 つの物にまとまっている。種類は propGroup の id から（props.ts の propTypeOf）
 * - 壁の小物（時計・灯り・消火器の箱・掲示の紙）と部屋に直に置かれる物（布団・座布団・カーテン・ボールプール・リング）は
 *   propGroup が無いので、材質と寸法で見つける
 * 向き（壁の側・前）は、物の中の部品の位置（背板・鏡・タンク・吊り戸棚）か、区画の足跡の近い方の縁から決める。
 * 隠す箱（hide）は描画で別のメッシュに分け、形の関数の物ができたら隠す（当たり判定・シミュレーションは元の箱のまま）。
 * 作り方は PropSpec（データ）なので、Worker（props.worker.ts）で作れる。
 */
import type { Box, CellLayout, MatId, UvFrame } from '../../core/world/layout.ts';
import { rotQ } from '../../core/math/vec.ts';
import { frameSource } from '../world/FloorBuilder.ts';
import { SURFACES } from '../render/MaterialLibrary.ts';
import type { V3 } from './shape.ts';
import type { PropSpec } from './registry.ts';
import type { GoodsKind } from './gen/goods.ts';

export interface PlanItem {
  /** 種類（数えるとき・確かめるとき用） */
  label: string;
  /** 形の関数で置き換える箱（作った物を出している間は隠す） */
  hide: Box[];
  /** 作った物を出している間だけ出す箱（流しの下を抜いた台など） */
  add: Box[];
  spec: PropSpec;
}

/** propGroup（`<区画>#<区域>/<印>-<種類>@<位置>:m` など）から種類を読む */
export function propTypeOf(group: string): string {
  let t = group.slice(group.lastIndexOf('/') + 1);
  t = t.split('@')[0]!.replace(/^([a-z0-9]+-)+/i, '');
  if (t.includes('.')) t = t.slice(t.lastIndexOf('.') + 1);
  return t;
}

/** 箱 b から穴（xz の四角）を y0 より上だけ抜いた箱の並び（流しの下の台） */
export function cutHole(b: Box, hole: { x0: number; x1: number; z0: number; z1: number }, y0: number): Box[] {
  const out: Box[] = [];
  const mk = (min: V3, max: V3): void => { if (max[0] - min[0] > 1e-4 && max[1] - min[1] > 1e-4 && max[2] - min[2] > 1e-4) out.push({ ...b, min, max }); };
  const [X0, Y0, Z0] = b.min, [X1, Y1, Z1] = b.max;
  const hx0 = Math.max(X0, hole.x0), hx1 = Math.min(X1, hole.x1), hz0 = Math.max(Z0, hole.z0), hz1 = Math.min(Z1, hole.z1);
  mk([X0, Y0, Z0], [X1, y0, Z1]);
  mk([X0, y0, Z0], [X1, Y1, hz0]);
  mk([X0, y0, hz1], [X1, Y1, Z1]);
  mk([X0, y0, hz0], [hx0, Y1, hz1]);
  mk([hx1, y0, hz0], [X1, Y1, hz1]);
  return out;
}

/** 作り方のデータ */
const spec = (kind: string, o: V3, yaw: number, seed: number, a: PropSpec['a'] = {}, s = 1): PropSpec => ({ kind, o: [o[0], o[1], o[2]], yaw, s, a, seed });

type Ax = 0 | 2;
const dims = (b: Box): V3 => [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
const ctr = (b: Box): V3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const near = (a: number, b: number, eps: number): boolean => Math.abs(a - b) <= eps;
const other = (a: Ax): Ax => (a === 0 ? 2 : 0);
const hashStr = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/**
 * 物の乱数の種: propGroup から区画・区域の名前と写しの印を除いた所（`<区画>#<区域>/` ・鏡写し `:m`・縮むくり返し `:k1`・
 * 異変の鏡の写し `~m`・階の写し `L2-`）。写した物（warp の双子・鏡写しの半分・くり返し）が元の物と同じ見た目になる
 */
export const groupSeed = (id: string, extra = ''): number => hashStr(normalGroup(id) + extra);
export function normalGroup(id: string): string {
  return id.slice(id.lastIndexOf('/') + 1).replace(/~.*$/, '').replace(/(:m|:k\d+)+$/, '').replace(/^L\d+-/, '');
}
/** 壁・床の小物（propGroup が無い）の種: 寸法と床からの高さ（位置は使わない。写した物と同じ見た目になる） */
const looseSeed = (tag: string, b: Box, floorY: number): number => hashStr(`${tag}@${[b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].map((v) => v.toFixed(2)).sort().join(',')}/${(b.min[1] - floorY).toFixed(2)}`);
const hex = (m: MatId | undefined, fb = 0xcccccc): number => (m && SURFACES[m] ? SURFACES[m].color : fb);
/** 局所の +z が world の軸 axis の sign の向きになる place の向き */
const yawFor = (axis: Ax, sign: number): number => (axis === 0 ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (sign > 0 ? 0 : Math.PI));

/**
 * 前（局所 +z）が axis の sign の向き。箱の範囲 [min, max] の「後ろの面・局所 x の始まりの端」を原点にした置き方。
 * 返り値の w は局所 x の幅、d は局所 z の奥行き、xOf は world の座標（もう 1 つの軸）→ 局所 x
 */
function frameOf(axis: Ax, sign: number, min: V3, max: V3, y: number): { yaw: number; origin: V3; w: number; d: number; xOf: (c: number) => number } {
  const yaw = yawFor(axis, sign);
  const o = other(axis);
  // 局所 +x の world の向き = (cos yaw, −sin yaw)
  const dx = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const pos = dx[o]! > 0;
  const origin: V3 = [0, y, 0];
  origin[axis] = sign > 0 ? min[axis]! : max[axis]!;
  origin[o] = pos ? min[o]! : max[o]!;
  return { yaw, origin, w: max[o]! - min[o]!, d: max[axis]! - min[axis]!, xOf: (c) => (pos ? c - min[o]! : max[o]! - c) };
}

/** 区画の足跡の中で、点 c から軸 axis の近い方の縁（壁）。返り値は室内の向き（+1 = 壁は小さい側） */
function wallSign(cell: CellLayout, c: V3, axis: Ax): number {
  let best = Infinity, sign = 1;
  for (const r of cell.footprint) {
    if (c[0] < r.x0 - 0.3 || c[0] > r.x1 + 0.3 || c[2] < r.z0 - 0.3 || c[2] > r.z1 + 0.3) continue;
    const lo = axis === 0 ? c[0] - r.x0 : c[2] - r.z0, hi = axis === 0 ? r.x1 - c[0] : r.z1 - c[2];
    if (lo < best) { best = lo; sign = 1; }
    if (hi < best) { best = hi; sign = -1; }
  }
  return sign;
}

// ---------------------------------------------------------------- 家具・設備（propGroup）

function plantItem(id: string, B: Box[], floorY: number): PlanItem | null {
  const pot = B.find((b) => b.solid && b.kind === 'plant');
  const leaves = B.filter((b) => b.mat === 'plantLeaf');
  if (!pot || !leaves.length) return null;
  const c = ctr(pot);
  const h = Math.max(...leaves.map((b) => b.max[1])) - floorY;
  const seed = groupSeed(id);
  // 高さで種類を選ぶ（自然の高さで縮める）
  const species = h >= 1.7 ? (seed % 2 ? 'ficus' : 'dracaena') : h >= 1.2 ? (seed % 3 ? 'dracaena' : 'sansevieria') : 'sansevieria';
  const natural = species === 'ficus' ? 1.9 : species === 'dracaena' ? 1.5 : 1.0;
  const k = Math.max(0.6, Math.min(1.3, h / natural));
  return { label: 'plant', hide: B.filter((b) => b.kind !== 'colliderOnly'), add: [], spec: spec('plant', [c[0], floorY, c[2]], (seed % 628) / 100, seed, { species }, k) };
}

function planterItem(id: string, B: Box[]): PlanItem | null {
  const leaves = B.filter((b) => b.mat === 'plantLeaf');
  if (!leaves.length) return null;
  const boxes = leaves.map((b) => { const d = dims(b), c = ctr(b); return [c[0], b.min[1] + d[1] * 0.45, c[2], d[0] * 0.48, d[1] * 0.5, d[2] * 0.48]; });
  return { label: 'planter', hide: leaves, add: [], spec: spec('shrubs', [0, 0, 0], 0, groupSeed(id), { boxes }) };
}

const GOODS_ONLY = new Set<MatId>(['plasticYellow', 'canLabel']);
const BOOKS_ONLY = new Set<MatId>(['seatRed', 'seatBlue', 'upholstery', 'whiteFabric', 'chalkboard']);
const BOXES = new Set<MatId>(['boxCardboard', 'paintWhite']);

/** 棚（壁付け・島・冷蔵ケース）の中身: 背板（背骨）から前の向きを決め、中身の塊ごとに本・商品の列にする */
function shelfItems(id: string, B: Box[], floorY: number, forceGoods = false, theme = ''): PlanItem[] {
  const parts = B.filter((b) => b.kind !== 'colliderOnly');
  if (!parts.length) return [];
  const top = Math.max(...parts.map((b) => b.max[1]));
  const H = top - floorY;
  // 背骨: 縦に高く（高さの 60% 以上）、水平の片方が薄い（3.5 cm 以下）、もう片方が一番長い板
  let spine: Box | null = null, spineLen = 0, axis: Ax = 0;
  for (const b of parts) {
    const d = dims(b);
    if (d[1] < H * 0.6) continue;
    for (const a of [0, 2] as Ax[]) {
      const o = other(a);
      if (d[a] <= 0.035 && d[o] > spineLen) { spine = b; spineLen = d[o]; axis = a; }
    }
  }
  if (!spine) return [];
  const frameMat = spine.mat;
  const boards = parts.filter((b) => dims(b)[1] <= 0.03 && dims(b)[other(axis)] > spineLen * 0.5);
  // 中身の塊: 枠の材質でない・どの辺も 6 cm 以上・床の台輪より上・天板より下・奥行きが 55 cm まで（冷蔵ケースの上の箱を除く）
  const fills = parts.filter((b) => { const d = dims(b); return b.mat !== frameMat && Math.min(d[0], d[1], d[2]) >= 0.06 && b.min[1] >= floorY + 0.09 && d[1] < 0.6 && b.max[1] < top - 0.01 && d[axis] <= 0.55 && b !== spine; });
  if (!fills.length) return [];
  const mats = new Set(fills.map((b) => b.mat));
  let kind: 'books' | 'binders' | 'goods' | 'boxes' = 'books';
  // 中身の材質だけでは本と商品の見分けがつかないことがある（赤・青・白は両方にある）: 店の部屋・金属の棚は商品
  const shop = /Retail/.test(theme) || frameMat === 'shelfMetal';
  if ([...mats].every((m) => BOXES.has(m))) kind = 'boxes';
  else if (forceGoods || shop || [...mats].some((m) => GOODS_ONLY.has(m))) kind = 'goods';
  else if ([...mats].some((m) => BOOKS_ONLY.has(m))) kind = 'books';
  else if ([...mats].every((m) => BOXES.has(m))) kind = 'boxes';
  else if (mats.has('plasticBlue')) kind = 'binders';
  if (kind === 'boxes') return [];
  const sc = ctr(spine);
  const goodsKinds: GoodsKind[] = forceGoods ? ['drinks', 'cans', 'drinks'] : ['drinks', 'cans', 'snacks', 'cartons', 'mixed'];
  return fills.map((f, i): PlanItem => {
    const c = ctr(f);
    const sign = c[axis] >= sc[axis] ? 1 : -1;
    // 段の高さ: 中身の上の一番近い板まで
    const above = boards.filter((b) => b.min[1] > f.min[1] + 0.05 && b.min[0] < f.max[0] && b.max[0] > f.min[0] && b.min[2] < f.max[2] && b.max[2] > f.min[2]).map((b) => b.min[1]);
    const ceil = above.length ? Math.min(...above) : top - 0.025;
    const room = ceil - f.min[1] - 0.012;
    const fr = frameOf(axis, sign, f.min, f.max, f.min[1]);
    const seed = groupSeed(id, `#${i}`);
    return kind === 'goods'
      ? { label: 'goods', hide: [f], add: [], spec: spec('goodsRow', fr.origin, fr.yaw, seed, { x0: 0.005, x1: fr.w - 0.005, zFront: fr.d + 0.02, maxH: room, goods: goodsKinds[seed % goodsKinds.length]! }) }
      : { label: 'books', hide: [f], add: [], spec: spec('bookRow', fr.origin, fr.yaw, seed, { x0: 0.005, x1: fr.w - 0.005, zBack: -0.01, zFront: fr.d + 0.01, maxH: room, binders: kind === 'binders' }) };
  });
}

function bedItem(id: string, B: Box[]): PlanItem | null {
  const head = B.find((b) => b.solid && dims(b)[1] >= 0.85 && Math.min(dims(b)[0], dims(b)[2]) <= 0.07);
  const mat = B.find((b) => b.solid && b.mat === 'whiteFabric');
  const soft = B.filter((b) => !b.solid);
  if (!head || !mat) return null;
  const hd = dims(head);
  const axis: Ax = hd[0] <= hd[2] ? 0 : 2;
  const sign = ctr(mat)[axis] > ctr(head)[axis] ? 1 : -1;
  const fr = frameOf(axis, sign, mat.min, mat.max, 0);
  const top = mat.max[1];
  const cover = soft.find((b) => b.mat !== 'whiteFabric');
  const color = hex(cover?.mat, 0x5a7aa8);
  const seed = groupSeed(id);
  return { label: 'bed', hide: soft, add: [], spec: spec('bed', fr.origin, fr.yaw, seed, { w: fr.w, d: fr.d, top, color, pattern: seed % 2 === 0 }) };
}

function examPillow(id: string, B: Box[]): PlanItem | null {
  const p = B.find((b) => !b.solid && b.mat === 'whiteFabric' && dims(b)[1] < 0.09);
  if (!p) return null;
  const c = ctr(p), d = dims(p);
  const yaw = d[0] > d[2] ? 0 : Math.PI / 2;
  return { label: 'pillow', hide: [p], add: [], spec: spec('pillow', [c[0], p.min[1], c[2]], yaw, groupSeed(id), { c: [0, 0.035, 0], w: Math.max(d[0], d[2]) + 0.04, d: Math.min(d[0], d[2]) + 0.02 }) };
}

function coolerBottleItem(id: string, B: Box[]): PlanItem | null {
  const b = B.find((x) => x.mat === 'aquariumBlue');
  if (!b) return null;
  const c = ctr(b);
  return { label: 'waterCooler', hide: [b], add: [], spec: spec('coolerBottle', [c[0], b.min[1], c[2]], 0, groupSeed(id)) };
}

function plinthItem(id: string, B: Box[]): PlanItem | null {
  const ped = B.find((b) => b.solid);
  const obj = B.filter((b) => !b.solid && ped && b.min[1] >= ped.max[1] - 0.001).pop();
  if (!ped || !obj) return null;
  const c = ctr(obj), d = dims(obj);
  const seed = groupSeed(id);
  const base = obj.min[1];
  if (obj.mat === 'goldTrim') return { label: 'plinthObj', hide: [obj], add: [], spec: spec('trophy', [c[0], base, c[2]], 0, seed, {}, d[1] / 0.3) };
  if (obj.mat === 'metal' || obj.mat === 'stainless') return { label: 'plinthObj', hide: [obj], add: [], spec: spec('sculpture', [c[0], base, c[2]], (seed % 628) / 100, seed, {}, d[1] / 0.36) };
  if (obj.mat === 'plasticRed' || obj.mat === 'aquariumBlue' || obj.mat === 'marbleWhite') {
    const h: V3 = [d[0] / 2, d[1] / 2, d[2] / 2];
    return { label: 'plinthObj', hide: [obj], add: [], spec: spec('smallVase', [c[0], base + h[1], c[2]], 0, seed, { h, main: hex(obj.mat) }) };
  }
  return null;
}

function vitrineItem(id: string, B: Box[]): PlanItem | null {
  const obj = B.filter((b) => !b.solid && b.mat !== 'glass' && b.mat !== 'metalDark').pop();
  if (!obj) return null;
  const c = ctr(obj), d = dims(obj);
  const seed = groupSeed(id);
  const h: V3 = [d[0] / 2, d[1] / 2, d[2] / 2];
  const furs = [0x9b6a43, 0xe8e2d4, 0x8d8a84, 0xc79a6a];
  if (seed % 3 === 0) return { label: 'vitrineObj', hide: [obj], add: [], spec: spec('trophy', [c[0], obj.min[1], c[2]], 0, seed, {}, d[1] / 0.3) };
  return { label: 'vitrineObj', hide: [obj], add: [], spec: spec('toy', [c[0], obj.min[1] + h[1], c[2]], 0, seed, { h: [h[0], h[1] * 1.15, h[2]], main: furs[seed % furs.length]! }) };
}

function coneItem(id: string, B: Box[]): PlanItem | null {
  const base = B.find((b) => b.mat === 'rubber');
  if (!base) return null;
  const c = ctr(base);
  const seed = groupSeed(id);
  return { label: 'cone', hide: B.filter((b) => b.kind !== 'colliderOnly'), add: [], spec: spec('cone', [c[0], base.min[1], c[2]], (seed % 628) / 100, seed) };
}

function urinalItem(id: string, B: Box[], floorY: number): PlanItem | null {
  const bowl = B.find((b) => b.solid && b.mat === 'marbleWhite');
  if (!bowl) return null;
  const pipe = B.find((b) => b.mat === 'metal' && dims(b)[1] > 0.2);
  const lip = B.find((b) => b.mat === 'metalDark' && b.min[1] < bowl.max[1]);
  if (!pipe || !lip) return null;
  const pc = ctr(pipe), lc = ctr(lip), bc = ctr(bowl);
  const axis: Ax = Math.abs(lc[0] - pc[0]) > Math.abs(lc[2] - pc[2]) ? 0 : 2;
  const sign = lc[axis] > pc[axis] ? 1 : -1;
  const wall = (sign > 0 ? bowl.min[axis] : bowl.max[axis]) - sign * 0.02;
  const o: V3 = [bc[0], floorY, bc[2]];
  o[axis] = wall;
  return { label: 'urinal', hide: B.filter((b) => b.kind !== 'colliderOnly' && b.mat !== 'furnitureLight'), add: [], spec: spec('urinal', o, yawFor(axis, sign), groupSeed(id)) };
}

function sinkItems(id: string, B: Box[], floorY: number): PlanItem[] {
  const mirror = B.find((b) => b.mat === 'carGlass');
  const basins = B.filter((b) => b.solid && b.mat === 'marbleWhite');
  if (!mirror || !basins.length) return [];
  const md = dims(mirror);
  const axis: Ax = md[0] < md[2] ? 0 : 2;
  const o = other(axis);
  return basins.map((bs, i): PlanItem => {
    const bc = ctr(bs);
    const sign = bc[axis] > ctr(mirror)[axis] ? 1 : -1;
    const lo = bs.min[o]! - 0.13, hi = bs.max[o]! + 0.13;
    const parts = B.filter((b) => (b.mat === 'marbleWhite' || b.mat === 'metal') && ctr(b)[o]! > lo && ctr(b)[o]! < hi);
    const org: V3 = [bc[0], floorY, bc[2]];
    org[axis] = (sign > 0 ? bs.min[axis] : bs.max[axis]) - sign * 0.02;
    return { label: 'sink', hide: parts, add: [], spec: spec('wallBasin', org, yawFor(axis, sign), groupSeed(id, `#${i}`)) };
  });
}

function toiletItems(id: string, B: Box[], floorY: number): PlanItem[] {
  const white = B.filter((b) => b.mat === 'marbleWhite');
  const tanks = white.filter((b) => b.min[1] > floorY + 0.3);
  const out: PlanItem[] = [];
  tanks.forEach((tank, i) => {
    const tc = ctr(tank);
    const bowl = white.find((b) => b !== tank && b.min[1] <= floorY + 0.01 && Math.hypot(ctr(b)[0] - tc[0], ctr(b)[2] - tc[2]) < 0.5);
    if (!bowl) return;
    const bc = ctr(bowl);
    const axis: Ax = Math.abs(bc[0] - tc[0]) > Math.abs(bc[2] - tc[2]) ? 0 : 2;
    const sign = bc[axis] > tc[axis] ? 1 : -1;
    const org: V3 = [tc[0], floorY, tc[2]];
    org[axis] = (sign > 0 ? tank.min[axis] : tank.max[axis]) - sign * 0.02;
    const seed = groupSeed(id, `#${i}`);
    out.push({ label: 'toilet', hide: [tank, bowl], add: [], spec: spec('toilet', org, yawFor(axis, sign), seed, { lidUp: seed % 2 === 0 }) });
  });
  return out;
}

function kitchenItem(id: string, B: Box[], floorY: number): PlanItem | null {
  const body = B.find((b) => b.solid && b.mat === 'furnitureLight' && b.max[1] < floorY + 0.83);
  const top = B.find((b) => b.mat === 'stainless');
  const cup = B.find((b) => b.mat === 'furnitureLight' && b.min[1] > floorY + 1.4 && dims(b)[1] > 0.5);
  if (!body || !top || !cup) return null;
  const bd = dims(body);
  const axis: Ax = bd[0] < bd[2] ? 0 : 2;
  const o = other(axis);
  const sign = ctr(body)[axis] > ctr(cup)[axis] ? 1 : -1;
  const sinkPlate = B.find((b) => b.mat === 'metalDark' && near(dims(b)[1], 0.007, 0.002));
  const faucet = B.find((b) => b.mat === 'metal' && b.min[1] >= floorY + 0.84 && b.max[1] <= floorY + 1.13);
  const hobs = B.filter((b) => b.mat === 'metalDark' && near(dims(b)[1], 0.018, 0.003));
  if (!sinkPlate) return null;
  // 壁の面 = 台の後ろの面 − 0.02
  const min: V3 = [...body.min], max: V3 = [...body.max];
  if (sign > 0) min[axis] = body.min[axis]! - 0.02; else max[axis] = body.max[axis]! + 0.02;
  const fr = frameOf(axis, sign, min, max, top.max[1]);
  const xs = [fr.xOf(sinkPlate.min[o]!), fr.xOf(sinkPlate.max[o]!)].sort((a, b) => a - b) as [number, number];
  const hx = hobs.map((h) => fr.xOf(ctr(h)[o]!));
  // 流しの下を抜いた台（描画の写しだけ）
  const hole = axis === 0
    ? { x0: sign > 0 ? min[0] + 0.12 : max[0] - (0.62 - 0.1), x1: sign > 0 ? min[0] + (0.62 - 0.1) : max[0] - 0.12, z0: sinkPlate.min[2], z1: sinkPlate.max[2] }
    : { x0: sinkPlate.min[0], x1: sinkPlate.max[0], z0: sign > 0 ? min[2] + 0.12 : max[2] - (0.62 - 0.1), z1: sign > 0 ? min[2] + (0.62 - 0.1) : max[2] - 0.12 };
  const add = cutHole(body, hole, top.max[1] - 0.2).map((b) => ({ ...b, solid: false }));
  return { label: 'kitchen', hide: [top, sinkPlate, ...(faucet ? [faucet] : []), ...hobs, body], add, spec: spec('kitchenTop', fr.origin, fr.yaw, groupSeed(id), { len: fr.w, depth: 0.62, sink: xs, hobs: hx }) };
}

function vendingItem(id: string, B: Box[], floorY: number): PlanItem | null {
  const body = B.find((b) => b.solid);
  const glow = B.find((b) => !b.solid && dims(b)[1] > 0.8 && Math.min(dims(b)[0], dims(b)[2]) < 0.02);
  if (!body || !glow) return null;
  const gd = dims(glow);
  const axis: Ax = gd[0] < gd[2] ? 0 : 2;
  const sign = ctr(glow)[axis] > ctr(body)[axis] ? 1 : -1;
  const gc = ctr(glow);
  const org: V3 = [gc[0], floorY, gc[2]];
  org[axis] = sign > 0 ? glow.max[axis] : glow.min[axis];
  const w = gd[other(axis)] - 0.04;
  return { label: 'vending', hide: [], add: [], spec: spec('vendingDisplay', org, yawFor(axis, sign), groupSeed(id), { width: w, rows: [glow.min[1] - floorY + 0.42, glow.min[1] - floorY + 0.68], perRow: 6 }) };
}

/** 机の上の電気スタンド（lamp: 光る笠 0.22 × 0.14 × 0.22・細い柱・台）。propGroup が無い */
function lampItems(boxes: Box[]): PlanItem[] {
  const out: PlanItem[] = [];
  for (const sh of boxes) {
    if (sh.mat !== 'lightWarm' || !near(dims(sh)[0], 0.22, 0.01) || !near(dims(sh)[1], 0.14, 0.01) || !near(dims(sh)[2], 0.22, 0.01)) continue;
    const c = ctr(sh);
    const y0 = sh.min[1] - 0.32;
    const parts = boxes.filter((b) => b.mat === 'metalDark' && near(ctr(b)[0], c[0], 0.01) && near(ctr(b)[2], c[2], 0.01) && b.min[1] >= y0 - 0.005 && b.max[1] <= sh.min[1] + 0.005);
    const seed = looseSeed('lamp', sh, sh.min[1] - 0.32);
    out.push({ label: 'lamp', hide: [sh, ...parts], add: [], spec: spec('deskLamp', [c[0], y0, c[2]], (seed % 628) / 100, seed) });
  }
  return out;
}

// ---------------------------------------------------------------- 壁の小物・部屋に直に置かれる物（propGroup 無し）

function decorItems(cell: CellLayout, boxes: Box[]): PlanItem[] {
  const out: PlanItem[] = [];
  const floorY = cell.floorY;
  const used = new Set<Box>();
  const take = (bs: Box[]): Box[] => { for (const b of bs) used.add(b); return bs; };
  for (const b of boxes) {
    if (used.has(b)) continue;
    const d = dims(b), c = ctr(b);
    const thinA: Ax = d[0] <= d[2] ? 0 : 2;
    const thin = d[thinA], wide = d[other(thinA)];
    // 壁の時計: 文字盤（signPlate の薄い正方形）+ 後ろの縁（metalDark の 3 cm）+ 針
    if (b.mat === 'signPlate' && thin <= 0.007 && near(wide, d[1], 0.01) && wide >= 0.14 && wide <= 0.6) {
      const size = wide + 0.04;
      const bezel = boxes.find((x) => x.mat === 'metalDark' && near(dims(x)[1], size, 0.01) && near(dims(x)[other(thinA)], size, 0.01) && near(ctr(x)[1], c[1], 0.01) && near(ctr(x)[other(thinA)]!, c[other(thinA)]!, 0.01));
      if (bezel) {
        const sign = ctr(b)[thinA] > ctr(bezel)[thinA] ? 1 : -1;
        const hands = boxes.filter((x) => x.mat === 'metalDark' && x !== bezel && Math.max(...dims(x)) < size * 0.6 && Math.abs(ctr(x)[1] - c[1]) < size / 2 && Math.abs(ctr(x)[other(thinA)]! - c[other(thinA)]!) < size / 2 && Math.abs(ctr(x)[thinA]! - c[thinA]!) < 0.03);
        const org: V3 = [c[0], c[1], c[2]];
        org[thinA] = sign > 0 ? bezel.min[thinA] : bezel.max[thinA];
        const seed = looseSeed('clock', b, floorY);
        // 時刻は v2 の針の箱から（長針は真上、短針は横の箱）。短針が見る人の右なら 3 時、左なら 9 時
        const yaw = yawFor(thinA, sign);
        const hourHand = hands.find((x) => dims(x)[other(thinA)]! > dims(x)[1]);
        const right = hourHand ? (ctr(hourHand)[0] - c[0]) * Math.cos(yaw) - (ctr(hourHand)[2] - c[2]) * Math.sin(yaw) : 1;
        out.push({ label: 'clock', hide: take([b, bezel, ...hands]), add: [], spec: spec('wallClock', org, yaw, seed, { hour: right >= 0 ? 3 : 9, minute: 0 }, size / 0.344) });
        continue;
      }
    }
    // 壁の灯り: 光る箔（0.14 × 0.08 × 0.22）+ 後ろの金の座金
    if (b.mat === 'lightWarm' && near(d[1], 0.22, 0.01) && near(thin, 0.08, 0.01) && near(wide, 0.14, 0.01)) {
      const plate = boxes.find((x) => x.mat === 'goldTrim' && near(dims(x)[1], 0.1, 0.01) && Math.hypot(ctr(x)[0] - c[0], ctr(x)[2] - c[2]) < 0.12);
      if (plate) {
        const sign = c[thinA] > ctr(plate)[thinA] ? 1 : -1;
        const org: V3 = [c[0], b.min[1], c[2]];
        org[thinA] = sign > 0 ? plate.min[thinA] : plate.max[thinA];
        out.push({ label: 'sconce', hide: take([b, plate]), add: [], spec: spec('sconce', org, yawFor(thinA, sign), looseSeed('sconce', b, floorY)) });
        continue;
      }
    }
    // 消火器の箱（床の赤い箱 0.44 × 0.16 × 0.65）+ 前の白い帯
    if (b.mat === 'plasticRed' && !b.solid && near(d[1], 0.65, 0.01) && near(thin, 0.16, 0.01) && near(wide, 0.44, 0.01) && near(b.min[1], floorY, 0.01)) {
      const band = boxes.find((x) => x.mat === 'paintWhite' && near(dims(x)[1], 0.08, 0.005) && Math.hypot(ctr(x)[0] - c[0], ctr(x)[2] - c[2]) < 0.15);
      const sign = band ? (ctr(band)[thinA] > c[thinA] ? 1 : -1) : wallSign(cell, c, thinA);
      const org: V3 = [c[0], floorY, c[2]];
      org[thinA] = sign > 0 ? b.min[thinA] : b.max[thinA];
      out.push({ label: 'extinguisher', hide: take(band ? [b, band] : [b]), add: [], spec: spec('extinguisherStand', org, yawFor(thinA, sign), looseSeed('ext', b, floorY)) });
      continue;
    }
    // 掲示板の紙（signPlate の 4 mm の板 0.21〜0.3 × 0.297）
    if (b.mat === 'signPlate' && thin <= 0.005 && near(d[1], 0.297, 0.005) && wide >= 0.2 && wide <= 0.31) {
      const sign = wallSign(cell, c, thinA);
      const org: V3 = [c[0], c[1], c[2]];
      org[thinA] = sign > 0 ? b.min[thinA] : b.max[thinA];
      out.push({ label: 'paper', hide: take([b]), add: [], spec: spec('pinnedSheet', org, yawFor(thinA, sign), looseSeed('paper', b, floorY), { w: wide, h: d[1] }) });
      continue;
    }
    // 布団（床の白い布 1.0 × 1.95 × 0.12）
    if (b.mat === 'whiteFabric' && near(d[1], 0.12, 0.01) && near(b.min[1], floorY, 0.01) && near(Math.min(d[0], d[2]), 1.0, 0.05) && near(Math.max(d[0], d[2]), 1.95, 0.08)) {
      out.push({ label: 'futon', hide: take([b]), add: [], spec: spec('futon', [c[0], floorY, c[2]], d[0] > d[2] ? Math.PI / 2 : 0, looseSeed('futon', b, floorY)) });
      continue;
    }
    // 座布団（床の 0.5 × 0.5 × 0.08）
    if (!b.solid && b.mat === 'seatBlue' && near(d[1], 0.08, 0.005) && near(d[0], 0.5, 0.01) && near(d[2], 0.5, 0.01) && near(b.min[1], floorY, 0.01)) {
      out.push({ label: 'cushion', hide: take([b]), add: [], spec: spec('pillow', [c[0], floorY, c[2]], 0.1, looseSeed('zab', b, floorY), { c: [0, 0.045, 0], w: 0.5, d: 0.5, color: hex('seatBlue') }) });
      continue;
    }
    // 仕切りのカーテン（白い布 2.1 × 0.03 × 高さ 1.5 以上）と上のレール
    if (!b.solid && b.mat === 'whiteFabric' && thin <= 0.035 && d[1] >= 1.5 && wide >= 1.5) {
      const rail = boxes.find((x) => x.mat === 'metal' && near(x.min[1], b.max[1], 0.01) && near(dims(x)[other(thinA)], wide, 0.02));
      const o = other(thinA);
      const org: V3 = [c[0], floorY, c[2]];
      org[o] = b.min[o]!;
      out.push({ label: 'curtain', hide: take(rail ? [b, rail] : [b]), add: [], spec: spec('curtain', org, o === 0 ? 0 : -Math.PI / 2, looseSeed('cur', b, floorY), { w: wide, y0: b.min[1] - floorY, y1: b.max[1] - floorY, color: 0xe8e6e0 }) });
      continue;
    }
    // バスケットのリング（赤い板 0.46 × 0.43 × 0.02、高い所）
    if (b.mat === 'plasticRed' && near(d[1], 0.02, 0.003) && b.min[1] > floorY + 2.5 && near(Math.max(d[0], d[2]), 0.46, 0.01) && near(Math.min(d[0], d[2]), 0.43, 0.01)) {
      const axis: Ax = d[0] < d[2] ? 0 : 2;
      const sign = wallSign(cell, c, axis);
      const org: V3 = [c[0], b.min[1] + 0.01, c[2]];
      org[axis] = sign > 0 ? b.min[axis] : b.max[axis];
      out.push({ label: 'hoop', hide: take([b]), add: [], spec: spec('hoop', org, yawFor(axis, sign), looseSeed('hoop', b, floorY)) });
      continue;
    }
  }
  // ボールプール（色の層 3 枚: 2.08 角 × 0.12 を 0.11 ずつ）
  const layers = boxes.filter((b) => !b.solid && (b.mat === 'plasticRed' || b.mat === 'plasticYellow' || b.mat === 'plasticBlue') && near(dims(b)[1], 0.12, 0.005) && dims(b)[0] > 1.5 && dims(b)[2] > 1.5);
  const bottoms = layers.filter((b) => near(b.min[1], floorY, 0.01));
  for (const l0 of bottoms) {
    const stack = layers.filter((b) => near(b.min[0], l0.min[0], 0.01) && near(b.min[2], l0.min[2], 0.01));
    const c = ctr(l0), d = dims(l0);
    const topY = Math.max(...stack.map((b) => b.max[1])) - floorY;
    out.push({ label: 'ballPit', hide: take(stack), add: [], spec: spec('ballPit', [c[0], floorY, c[2]], 0, looseSeed('pit', l0, floorY), { w: d[0], d: d[2], top: topY }) });
  }
  return out;
}

// ---------------------------------------------------------------- 区画全体

/** 区画の差し替えの計画（作り込む小物が無ければ空） */
export function planCell(cell: CellLayout): PlanItem[] {
  // 模様なし・旧版風の見た目の区画（異変・部屋の形）は箱のまま
  if (cell.render?.style) return [];
  // warp の双子（箱の uvFrame・区画の uvFrame）: 元の位置へ戻してから見つけ、作り方を同じ写し方で写す（元の部屋と同じ見た目）。
  // frame 'group' の区画（階段室）は FloorBuilder が局所の座標の写しを渡すので、ここでは写さない
  const cellFrame = cell.frame === 'group' ? undefined : cell.uvFrame;
  const byFrame = new Map<string, { f: UvFrame | undefined; boxes: Box[] }>();
  for (const b of cell.boxes) {
    const f = b.slope ? undefined : (b.uvFrame ?? cellFrame);
    const key = f ? `${f.q}|${f.offset.join(',')}|${(f.pivot ?? [0, 0, 0]).join(',')}` : '';
    let e = byFrame.get(key);
    if (!e) byFrame.set(key, e = { f, boxes: [] });
    e.boxes.push(b);
  }
  const items: PlanItem[] = [];
  for (const { f, boxes } of byFrame.values()) {
    if (!f) { items.push(...planBoxes(cell, boxes)); continue; }
    const back = new Map<Box, Box>();
    const src = boxes.map((b) => { const s = frameSource(b, f); back.set(s, b); return s; });
    const srcCell: CellLayout = { ...cell, boxes: src, floorY: cell.floorY - f.offset[1], footprint: cell.footprint.map((r) => { const x = frameSource({ min: [r.x0, 0, r.z0], max: [r.x1, 0, r.z1], mat: 'void', solid: false }, f); return { x0: x.min[0], z0: x.min[2], x1: x.max[0], z1: x.max[2] }; }) };
    for (const it of planBoxes(srcCell, src)) items.push({ ...it, hide: it.hide.map((b) => back.get(b) ?? b), add: it.add.map((b) => ({ ...toFrame(b, f), uvFrame: f })), spec: frameSpec(it.spec, f) });
  }
  return untouched(cell, items);
}

/** 写し方 f で箱を写す（frameSource の逆。1/4 回転なので軸に平行な箱のまま） */
function toFrame(b: Box, f: UvFrame): Box {
  const pv = f.pivot ?? [0, 0, 0];
  const fwd = (p: readonly number[]): V3 => { const r = rotQ([p[0]! - pv[0], p[1]! - pv[1], p[2]! - pv[2]], f.q); return [r[0] + pv[0] + f.offset[0], r[1] + pv[1] + f.offset[1], r[2] + pv[2] + f.offset[2]]; };
  const a = fwd(b.min), c = fwd(b.max);
  return { ...b, min: [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], max: [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])] };
}

/** 作り方を写し方 f で写す（置き場所の原点を回してずらし、向きに 1/4 回転を足す） */
function frameSpec(sp: PropSpec, f: UvFrame): PropSpec {
  const pv = f.pivot ?? [0, 0, 0];
  const r = rotQ([sp.o[0] - pv[0], sp.o[1] - pv[1], sp.o[2] - pv[2]], f.q);
  return { ...sp, o: [r[0] + pv[0] + f.offset[0], r[1] + pv[1] + f.offset[1], r[2] + pv[2] + f.offset[2]], yaw: sp.yaw + (f.q * Math.PI) / 2 };
}

/**
 * 異変が変えた・足した箱（Box.odd）に関わる物を外す: その箱を含む物、その箱に触れる物（上に積もった埃・雪・置いたマグ・
 * 引きずった跡）、異変の鏡の写し（`<元>~m`）の元の物。傾けた・裏返した・大きさや色を変えた物は箱のまま（異変の見た目を保つ）
 */
function untouched(cell: CellLayout, items: PlanItem[]): PlanItem[] {
  const odd = cell.boxes.filter((b) => b.odd);
  if (!odd.length) return items;
  const oddGroups = new Set<string>();
  for (const b of odd) if (b.propGroup) { oddGroups.add(b.propGroup); oddGroups.add(b.propGroup.replace(/~.*$/, '')); }
  const groupOf = new Map<Box, string>();
  for (const b of cell.boxes) if (b.propGroup) groupOf.set(b, b.propGroup);
  const E = 0.02;
  const touches = (b: Box): boolean => odd.some((o) => o !== b && b.min[0] < o.max[0] + E && b.max[0] > o.min[0] - E && b.min[1] < o.max[1] + E && b.max[1] > o.min[1] - E && b.min[2] < o.max[2] + E && b.max[2] > o.min[2] - E);
  return items.filter((it) => !it.hide.some((b) => b.odd || oddGroups.has(groupOf.get(b) ?? '') || touches(b)));
}

/** 箱の並び（同じ写し方の箱）から作り込む小物を見つける */
function planBoxes(cell: CellLayout, all: Box[]): PlanItem[] {
  const usable = (b: Box): boolean => !b.revealGroup && !b.concealGroup && !b.slope && !b.odd && !b.kind?.startsWith('lamp:');
  // 異変が触った箱を含む物の組は、組ごと箱のまま
  const oddGroups = new Set(all.filter((b) => b.odd && b.propGroup).map((b) => b.propGroup!));
  const boxes = all.filter((b) => usable(b) && b.kind !== 'colliderOnly' && b.kind !== 'emitOnly');
  const groups = new Map<string, Box[]>();
  const loose: Box[] = [];
  for (const b of boxes) {
    if (!b.propGroup) { loose.push(b); continue; }
    if (oddGroups.has(b.propGroup)) continue;
    let g = groups.get(b.propGroup);
    if (!g) groups.set(b.propGroup, g = []);
    g.push(b);
  }
  const items: PlanItem[] = [];
  const fy = cell.floorY;
  for (const [id, B] of groups) {
    // 異変の物（壁の時計の群れ「a-clock」など）・別の部屋から持ち込んだ物（c-・x-）は触らない
    if (/\/(a|c|x)-/.test(id)) continue;
    const type = propTypeOf(id);
    const add = (x: PlanItem | PlanItem[] | null): void => { if (Array.isArray(x)) items.push(...x); else if (x) items.push(x); };
    switch (type) {
      case 'plant': add(plantItem(id, B, fy)); break;
      case 'planter': add(planterItem(id, B)); break;
      case 'shelf': add(shelfItems(id, B, fy, false, cell.theme ?? '')); break;
      case 'cooler': add(shelfItems(id, B, fy, true, cell.theme ?? '')); break;
      case 'bed': add(bedItem(id, B)); break;
      case 'examBed': add(examPillow(id, B)); break;
      case 'waterCooler': add(coolerBottleItem(id, B)); break;
      case 'plinth': add(plinthItem(id, B)); break;
      case 'vitrine': add(vitrineItem(id, B)); break;
      case 'cone': add(coneItem(id, B)); break;
      case 'urinal': add(urinalItem(id, B, fy)); break;
      case 'sinks': add(sinkItems(id, B, fy)); break;
      case 'booths': add(toiletItems(id, B, fy)); break;
      case 'kitchen': add(kitchenItem(id, B, fy)); break;
      case 'vending': add(vendingItem(id, B, fy)); break;
      default: break;
    }
  }
  items.push(...lampItems(loose), ...decorItems(cell, loose));
  return items;
}
