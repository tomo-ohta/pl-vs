/**
 * v2 の区画の箱から「作り込む小物」を見つけ、形の関数での作り方に置き換える計画を作る（v2 の世界で差し替える版）。
 *
 * 見つけ方は v2 の中身（core/gen/dress）の作りに合わせる:
 * - 家具・設備は propGroup（tagGroup）で 1 つの物にまとまっている。種類は propGroup の id から（props.ts の propTypeOf）
 * - 壁の小物（時計・灯り・消火器の箱・掲示の紙）と部屋に直に置かれる物（布団・座布団・カーテン・ボールプール・リング）は
 *   propGroup が無いので、材質と寸法で見つける
 * 向き（壁の側・前）は、物の中の部品の位置（背板・鏡・タンク・吊り戸棚）か、区画の足跡の近い方の縁から決める。
 * 隠す箱（hide）は描画の写しで v2 の箱のメッシュを分けるのに使い、当たり判定（シミュレーション）は元のまま。
 * 異変・仕掛けの見た目を変える区画（cell.render のある区画）と、出現・傾き・模様の写しの箱は触らない。
 */
import type { Box, CellLayout, MatId } from '../../../../v2/core/world/layout.ts';
import { SURFACES } from '../../../../v2/client/render/MaterialLibrary.ts';
import { propTypeOf } from '../props.ts';
import { place, type Rand, type Surfels, type V3 } from '../showroom/surfel.ts';
import { dracaena, ficus, sansevieria, shrub } from '../showroom/gen/plants.ts';
import { bookRow } from '../showroom/gen/books.ts';
import { goodsRow, vendingDisplay, type GoodsKind } from '../showroom/gen/goods.ts';
import { curtain, duvet, futon, pillow } from '../showroom/gen/fabric.ts';
import { cone, coolerBottle, deskLamp, extinguisherStand, hoop, sculpture, trophy, wallClock, ballPit } from '../showroom/gen/objects.ts';
import { urinal } from '../showroom/gen/porcelain.ts';
import { kitchenTop, sconce, toilet, wallBasin } from '../showroom/gen/fixtures.ts';
import { pinnedSheet } from '../showroom/gen/paper.ts';
import { smallVase, toy } from '../showroom/gen/carry.ts';
import { cutHole } from '../showroom/layoutExtra.ts';

export interface PlanItem {
  /** 種類（数えるとき・確かめるとき用） */
  label: string;
  /** 形の関数で置き換える v2 の箱（差し替え中は隠す） */
  hide: Box[];
  /** 差し替え中だけ出す箱（流しの下を抜いた台など） */
  add: Box[];
  gen: (S: Surfels, R: Rand) => void;
  seed: number;
}

type Ax = 0 | 2;
const dims = (b: Box): V3 => [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
const ctr = (b: Box): V3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const near = (a: number, b: number, eps: number): boolean => Math.abs(a - b) <= eps;
const other = (a: Ax): Ax => (a === 0 ? 2 : 0);
const hashStr = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
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
  const seed = hashStr(id);
  // 高さで種類を選ぶ（自然の高さで縮める）
  const pick = h >= 1.7 ? (seed % 2 ? ficus : dracaena) : h >= 1.2 ? (seed % 3 ? dracaena : sansevieria) : sansevieria;
  const natural = pick === ficus ? 1.9 : pick === dracaena ? 1.5 : 1.0;
  const k = Math.max(0.6, Math.min(1.3, h / natural));
  return { label: 'plant', hide: B.filter((b) => b.kind !== 'colliderOnly'), add: [], seed, gen: (S, R) => pick(S, R, place([c[0], floorY, c[2]], (seed % 628) / 100, k)) };
}

function planterItem(id: string, B: Box[]): PlanItem | null {
  const leaves = B.filter((b) => b.mat === 'plantLeaf');
  if (!leaves.length) return null;
  return {
    label: 'planter', hide: leaves, add: [], seed: hashStr(id),
    gen: (S, R) => { for (const b of leaves) { const d = dims(b), c = ctr(b); shrub(S, R, place([0, 0, 0]), [c[0], b.min[1] + d[1] * 0.45, c[2]], [d[0] * 0.48, d[1] * 0.5, d[2] * 0.48]); } },
  };
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
    const seed = hashStr(`${id}#${i}`);
    return {
      label: kind === 'goods' ? 'goods' : 'books', hide: [f], add: [], seed,
      gen: (S, R) => {
        const xf = place(fr.origin, fr.yaw);
        if (kind === 'goods') goodsRow(S, R, xf, { x0: 0.005, x1: fr.w - 0.005, zFront: fr.d + 0.02, maxH: room, kind: goodsKinds[seed % goodsKinds.length]! });
        else bookRow(S, R, xf, { x0: 0.005, x1: fr.w - 0.005, zBack: -0.01, zFront: fr.d + 0.01, maxH: room, binders: kind === 'binders' });
      },
    };
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
  const seed = hashStr(id);
  return {
    label: 'bed', hide: soft, add: [], seed,
    gen: (S, R) => {
      const xf = place(fr.origin, fr.yaw);
      duvet(S, R, xf, { x0: 0, x1: fr.w, z0: 0, z1: fr.d, top, color, pattern: seed % 2 === 0 });
      if (fr.w > 1.2) { pillow(S, R, xf, [fr.w * 0.28, top + 0.062, 0.25], 0.5, 0.36); pillow(S, R, xf, [fr.w * 0.72, top + 0.062, 0.25], 0.5, 0.36, 0xe8e2d4); }
      else pillow(S, R, xf, [fr.w * 0.5, top + 0.062, 0.25], Math.min(0.6, fr.w - 0.2), 0.36);
    },
  };
}

function examPillow(id: string, B: Box[]): PlanItem | null {
  const p = B.find((b) => !b.solid && b.mat === 'whiteFabric' && dims(b)[1] < 0.09);
  if (!p) return null;
  const c = ctr(p), d = dims(p);
  const yaw = d[0] > d[2] ? 0 : Math.PI / 2;
  return { label: 'pillow', hide: [p], add: [], seed: hashStr(id), gen: (S, R) => pillow(S, R, place([c[0], p.min[1], c[2]], yaw), [0, 0.035, 0], Math.max(d[0], d[2]) + 0.04, Math.min(d[0], d[2]) + 0.02) };
}

function coolerBottleItem(id: string, B: Box[]): PlanItem | null {
  const b = B.find((x) => x.mat === 'aquariumBlue');
  if (!b) return null;
  const c = ctr(b);
  return { label: 'waterCooler', hide: [b], add: [], seed: hashStr(id), gen: (S, R) => coolerBottle(S, R, place([c[0], b.min[1], c[2]], 0)) };
}

function plinthItem(id: string, B: Box[]): PlanItem | null {
  const ped = B.find((b) => b.solid);
  const obj = B.filter((b) => !b.solid && ped && b.min[1] >= ped.max[1] - 0.001).pop();
  if (!ped || !obj) return null;
  const c = ctr(obj), d = dims(obj);
  const seed = hashStr(id);
  const base = obj.min[1];
  if (obj.mat === 'goldTrim') return { label: 'plinthObj', hide: [obj], add: [], seed, gen: (S, R) => trophy(S, R, place([c[0], base, c[2]], 0, d[1] / 0.3)) };
  if (obj.mat === 'metal' || obj.mat === 'stainless') return { label: 'plinthObj', hide: [obj], add: [], seed, gen: (S, R) => sculpture(S, R, place([c[0], base, c[2]], (seed % 628) / 100, d[1] / 0.36)) };
  if (obj.mat === 'plasticRed' || obj.mat === 'aquariumBlue' || obj.mat === 'marbleWhite') {
    const h: V3 = [d[0] / 2, d[1] / 2, d[2] / 2];
    return { label: 'plinthObj', hide: [obj], add: [], seed, gen: (S, R) => smallVase(S, R, place([c[0], base + h[1], c[2]], 0), h, { main: hex(obj.mat), label: 0, glass: 0, dots: 0 }) };
  }
  return null;
}

function vitrineItem(id: string, B: Box[]): PlanItem | null {
  const obj = B.filter((b) => !b.solid && b.mat !== 'glass' && b.mat !== 'metalDark').pop();
  if (!obj) return null;
  const c = ctr(obj), d = dims(obj);
  const seed = hashStr(id);
  const h: V3 = [d[0] / 2, d[1] / 2, d[2] / 2];
  const furs = [0x9b6a43, 0xe8e2d4, 0x8d8a84, 0xc79a6a];
  if (seed % 3 === 0) return { label: 'vitrineObj', hide: [obj], add: [], seed, gen: (S, R) => trophy(S, R, place([c[0], obj.min[1], c[2]], 0, d[1] / 0.3)) };
  return { label: 'vitrineObj', hide: [obj], add: [], seed, gen: (S, R) => toy(S, R, place([c[0], obj.min[1] + h[1], c[2]], 0), [h[0], h[1] * 1.15, h[2]], { main: furs[seed % furs.length]!, label: 0, glass: 0, dots: 0 }) };
}

function coneItem(id: string, B: Box[]): PlanItem | null {
  const base = B.find((b) => b.mat === 'rubber');
  if (!base) return null;
  const c = ctr(base);
  const seed = hashStr(id);
  return { label: 'cone', hide: B.filter((b) => b.kind !== 'colliderOnly'), add: [], seed, gen: (S, R) => cone(S, R, place([c[0], base.min[1], c[2]], (seed % 628) / 100)) };
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
  return { label: 'urinal', hide: B.filter((b) => b.kind !== 'colliderOnly' && b.mat !== 'furnitureLight'), add: [], seed: hashStr(id), gen: (S, R) => urinal(S, R, place(o, yawFor(axis, sign))) };
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
    return { label: 'sink', hide: parts, add: [], seed: hashStr(`${id}#${i}`), gen: (S, R) => wallBasin(S, R, place(org, yawFor(axis, sign))) };
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
    const seed = hashStr(`${id}#${i}`);
    out.push({ label: 'toilet', hide: [tank, bowl], add: [], seed, gen: (S, R) => toilet(S, R, place(org, yawFor(axis, sign)), seed % 2 === 0) });
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
  return {
    label: 'kitchen', hide: [top, sinkPlate, ...(faucet ? [faucet] : []), ...hobs, body], add, seed: hashStr(id),
    gen: (S, R) => kitchenTop(S, R, place(fr.origin, fr.yaw), { len: fr.w, depth: 0.62, sink: xs, hobs: hx }),
  };
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
  return { label: 'vending', hide: [], add: [], seed: hashStr(id), gen: (S, R) => vendingDisplay(S, R, place(org, yawFor(axis, sign)), { width: w, rows: [glow.min[1] - floorY + 0.42, glow.min[1] - floorY + 0.68], perRow: 6 }) };
}

/** 机の上の電気スタンド（lamp: 光る笠 0.22 × 0.14 × 0.22・細い柱・台）。propGroup が無い */
function lampItems(boxes: Box[]): PlanItem[] {
  const out: PlanItem[] = [];
  for (const sh of boxes) {
    if (sh.mat !== 'lightWarm' || !near(dims(sh)[0], 0.22, 0.01) || !near(dims(sh)[1], 0.14, 0.01) || !near(dims(sh)[2], 0.22, 0.01)) continue;
    const c = ctr(sh);
    const y0 = sh.min[1] - 0.32;
    const parts = boxes.filter((b) => b.mat === 'metalDark' && near(ctr(b)[0], c[0], 0.01) && near(ctr(b)[2], c[2], 0.01) && b.min[1] >= y0 - 0.005 && b.max[1] <= sh.min[1] + 0.005);
    const seed = hashStr(`lamp@${c[0].toFixed(2)},${c[2].toFixed(2)}`);
    out.push({ label: 'lamp', hide: [sh, ...parts], add: [], seed, gen: (S, R) => deskLamp(S, R, place([c[0], y0, c[2]], (seed % 628) / 100)) });
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
        const seed = hashStr(`clock@${c.map((v) => v.toFixed(2))}`);
        out.push({ label: 'clock', hide: take([b, bezel, ...hands]), add: [], seed, gen: (S, R) => wallClock(S, R, place(org, yawFor(thinA, sign), size / 0.344), seed % 12, (seed >> 4) % 60) });
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
        out.push({ label: 'sconce', hide: take([b, plate]), add: [], seed: hashStr(`sconce@${c.map((v) => v.toFixed(2))}`), gen: (S, R) => sconce(S, R, place(org, yawFor(thinA, sign))) });
        continue;
      }
    }
    // 消火器の箱（床の赤い箱 0.44 × 0.16 × 0.65）+ 前の白い帯
    if (b.mat === 'plasticRed' && !b.solid && near(d[1], 0.65, 0.01) && near(thin, 0.16, 0.01) && near(wide, 0.44, 0.01) && near(b.min[1], floorY, 0.01)) {
      const band = boxes.find((x) => x.mat === 'paintWhite' && near(dims(x)[1], 0.08, 0.005) && Math.hypot(ctr(x)[0] - c[0], ctr(x)[2] - c[2]) < 0.15);
      const sign = band ? (ctr(band)[thinA] > c[thinA] ? 1 : -1) : wallSign(cell, c, thinA);
      const org: V3 = [c[0], floorY, c[2]];
      org[thinA] = sign > 0 ? b.min[thinA] : b.max[thinA];
      out.push({ label: 'extinguisher', hide: take(band ? [b, band] : [b]), add: [], seed: hashStr(`ext@${c.map((v) => v.toFixed(2))}`), gen: (S, R) => extinguisherStand(S, R, place(org, yawFor(thinA, sign))) });
      continue;
    }
    // 掲示板の紙（signPlate の 4 mm の板 0.21〜0.3 × 0.297）
    if (b.mat === 'signPlate' && thin <= 0.005 && near(d[1], 0.297, 0.005) && wide >= 0.2 && wide <= 0.31) {
      const sign = wallSign(cell, c, thinA);
      const org: V3 = [c[0], c[1], c[2]];
      org[thinA] = sign > 0 ? b.min[thinA] : b.max[thinA];
      out.push({ label: 'paper', hide: take([b]), add: [], seed: hashStr(`paper@${c.map((v) => v.toFixed(3))}`), gen: (S, R) => pinnedSheet(S, R, place(org, yawFor(thinA, sign)), 0, 0, wide, d[1]) });
      continue;
    }
    // 布団（床の白い布 1.0 × 1.95 × 0.12）
    if (b.mat === 'whiteFabric' && near(d[1], 0.12, 0.01) && near(b.min[1], floorY, 0.01) && near(Math.min(d[0], d[2]), 1.0, 0.05) && near(Math.max(d[0], d[2]), 1.95, 0.08)) {
      out.push({ label: 'futon', hide: take([b]), add: [], seed: hashStr(`futon@${c.map((v) => v.toFixed(2))}`), gen: (S, R) => futon(S, R, place([c[0], floorY, c[2]], d[0] > d[2] ? Math.PI / 2 : 0), [0, 0, 0]) });
      continue;
    }
    // 座布団（床の 0.5 × 0.5 × 0.08）
    if (!b.solid && b.mat === 'seatBlue' && near(d[1], 0.08, 0.005) && near(d[0], 0.5, 0.01) && near(d[2], 0.5, 0.01) && near(b.min[1], floorY, 0.01)) {
      out.push({ label: 'cushion', hide: take([b]), add: [], seed: hashStr(`zab@${c.map((v) => v.toFixed(2))}`), gen: (S, R) => pillow(S, R, place([c[0], floorY, c[2]], 0.1), [0, 0.045, 0], 0.5, 0.5, hex('seatBlue')) });
      continue;
    }
    // 仕切りのカーテン（白い布 2.1 × 0.03 × 高さ 1.5 以上）と上のレール
    if (!b.solid && b.mat === 'whiteFabric' && thin <= 0.035 && d[1] >= 1.5 && wide >= 1.5) {
      const rail = boxes.find((x) => x.mat === 'metal' && near(x.min[1], b.max[1], 0.01) && near(dims(x)[other(thinA)], wide, 0.02));
      const o = other(thinA);
      const org: V3 = [c[0], floorY, c[2]];
      org[o] = b.min[o]!;
      out.push({ label: 'curtain', hide: take(rail ? [b, rail] : [b]), add: [], seed: hashStr(`cur@${c.map((v) => v.toFixed(2))}`), gen: (S, R) => curtain(S, R, place(org, o === 0 ? 0 : -Math.PI / 2), { x0: 0, x1: wide, y0: b.min[1] - floorY, y1: b.max[1] - floorY, z: 0, color: 0xe8e6e0 }) });
      continue;
    }
    // バスケットのリング（赤い板 0.46 × 0.43 × 0.02、高い所）
    if (b.mat === 'plasticRed' && near(d[1], 0.02, 0.003) && b.min[1] > floorY + 2.5 && near(Math.max(d[0], d[2]), 0.46, 0.01) && near(Math.min(d[0], d[2]), 0.43, 0.01)) {
      const axis: Ax = d[0] < d[2] ? 0 : 2;
      const sign = wallSign(cell, c, axis);
      const org: V3 = [c[0], b.min[1] + 0.01, c[2]];
      org[axis] = sign > 0 ? b.min[axis] : b.max[axis];
      out.push({ label: 'hoop', hide: take([b]), add: [], seed: hashStr(`hoop@${c.map((v) => v.toFixed(2))}`), gen: (S, R) => hoop(S, R, place(org, yawFor(axis, sign))) });
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
    out.push({ label: 'ballPit', hide: take(stack), add: [], seed: hashStr(`pit@${c.map((v) => v.toFixed(2))}`), gen: (S, R) => ballPit(S, R, place([c[0], floorY, c[2]]), d[0], d[2], topY) });
  }
  return out;
}

// ---------------------------------------------------------------- 区画全体

/** 区画の差し替えの計画（作り込む小物が無ければ空） */
export function planCell(cell: CellLayout): PlanItem[] {
  if (cell.render) return [];
  const usable = (b: Box): boolean => !b.revealGroup && !b.concealGroup && !b.slope && !b.uvFrame && !b.kind?.startsWith('lamp:');
  const boxes = cell.boxes.filter((b) => usable(b) && b.kind !== 'colliderOnly' && b.kind !== 'emitOnly');
  const groups = new Map<string, Box[]>();
  const loose: Box[] = [];
  for (const b of boxes) {
    if (!b.propGroup) { loose.push(b); continue; }
    let g = groups.get(b.propGroup);
    if (!g) groups.set(b.propGroup, g = []);
    g.push(b);
  }
  const items: PlanItem[] = [];
  const fy = cell.floorY;
  for (const [id, B] of groups) {
    // 異変の物（壁の時計の群れ「a-clock」など）は触らない
    if (/\/a-/.test(id)) continue;
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
