/** 奇妙さ生成: 内容物の配置と欠落（担当 O2）。shared.ts のヘルパだけを使う。各 Oddity は applicable / apply（strong = 主題、weak = 添え物）を持つ */
import {
  ODD_KIND, WALL_T,
  alongFace, budgetOk, canPlace, commit, facing, freeRuns, inFocus, innerFaces, insideRects, interior,
  mainRect, oddBox, onFace, pick, propGroups, pushSign, put, removeInterior, shifted, spec, yawOfDir,
  type Box, type Ctx, type Dir, type Face, type InstanceSpec, type MatId, type Oddity, type Rect, type Strength, type Vec3,
} from './shared';

// ---------------------------------------------------------------- 家具グループ

/** 家具 1 台分。propGroup の付いたグループと、propGroup の無い 1 箱家具（common.ts の kinded 椅子・机）の両方 */
interface FGroup {
  /** propGroup の id（1 箱家具は 'solo#n'） */
  id: string;
  kind: string | undefined;
  boxes: Box[];
  min: Vec3;
  max: Vec3;
}

/** propGroup の無い 1 箱家具でもグループとして扱う kind */
const SOLO_KINDS = new Set(['chair', 'table', 'desk', 'bench', 'vending', 'cabinet']);
/** 椅子らしい kind */
const SEAT_KINDS = new Set(['chair', 'linkedSeats', 'bench']);
/** ロッカーらしい kind（furniture.lockerBank は 'lockers'） */
const LOCKER_KINDS = new Set(['lockers', 'lockerBank']);

function groupsOf(c: Ctx): FGroup[] {
  const out: FGroup[] = [];
  for (const [id, g] of propGroups(c.L)) out.push({ id, kind: g.kind, boxes: g.boxes, min: g.min, max: g.max });
  let n = 0;
  for (const b of interior(c.L)) {
    if (b.propGroup || !b.kind || !SOLO_KINDS.has(b.kind)) continue;
    out.push({ id: `solo#${n++}`, kind: b.kind, boxes: [b], min: [...b.min] as Vec3, max: [...b.max] as Vec3 });
  }
  return out;
}

function seatGroups(c: Ctx, gs = groupsOf(c)): FGroup[] {
  return gs.filter((g) => g.kind !== undefined && SEAT_KINDS.has(g.kind));
}
function lockerGroups(c: Ctx, gs = groupsOf(c)): FGroup[] {
  return gs.filter((g) => g.kind !== undefined && LOCKER_KINDS.has(g.kind));
}

/** グループの外接矩形を計算し直す */
function reenvelope(g: FGroup): void {
  g.min = [Infinity, Infinity, Infinity];
  g.max = [-Infinity, -Infinity, -Infinity];
  for (const b of g.boxes) for (let k = 0; k < 3; k++) { g.min[k] = Math.min(g.min[k], b.min[k]); g.max[k] = Math.max(g.max[k], b.max[k]); }
}

/** グループの箱を新しい箱の列で差し替える（c.L.boxes の該当要素を置き換える） */
function applyGroup(c: Ctx, g: FGroup, next: Box[]): void {
  for (let i = 0; i < g.boxes.length; i++) {
    const at = c.L.boxes.indexOf(g.boxes[i]);
    if (at >= 0) c.L.boxes[at] = next[i];
  }
  g.boxes = next;
  reenvelope(g);
}

/** 動かした（回した）結果が置けるか。自分自身と except の箱は無視 */
function fits(c: Ctx, g: FGroup, next: Box[], o: { lanes?: boolean; gap?: number; except?: Set<Box> } = {}): boolean {
  const own = new Set(g.boxes);
  for (const b of next) {
    if (!b.solid) continue;
    if (!canPlace(c, b, { gap: o.gap ?? 0.02, lanes: o.lanes ?? true, ignore: (q) => own.has(q) || (o.except?.has(q) ?? false) })) return false;
  }
  return true;
}

function tryMove(c: Ctx, g: FGroup, dx: number, dy: number, dz: number, o: { lanes?: boolean; gap?: number } = {}): boolean {
  const next = g.boxes.map((b) => shifted(b, dx, dy, dz));
  if (!fits(c, g, next, o)) return false;
  applyGroup(c, g, next);
  return true;
}

// ---------------------------------------------------------------- 90° 回転

/** 点 (x, z) を (cx, cz) まわりに +90° 回す */
function rot90(x: number, z: number, cx: number, cz: number): [number, number] {
  return [cx - (z - cz), cz + (x - cx)];
}

/** グループの外接矩形の中心まわりに k × 90° 回した箱の列（propGroup / kind / mat / solid は保つ） */
function rotatedBoxes(g: FGroup, k: number): Box[] {
  const cx = (g.min[0] + g.max[0]) / 2, cz = (g.min[2] + g.max[2]) / 2;
  const turns = ((k % 4) + 4) % 4;
  return g.boxes.map((b) => {
    let p0: [number, number] = [b.min[0], b.min[2]];
    let p1: [number, number] = [b.max[0], b.max[2]];
    for (let i = 0; i < turns; i++) { p0 = rot90(p0[0], p0[1], cx, cz); p1 = rot90(p1[0], p1[1], cx, cz); }
    return {
      ...b,
      min: [Math.min(p0[0], p1[0]), b.min[1], Math.min(p0[1], p1[1])] as Vec3,
      max: [Math.max(p0[0], p1[0]), b.max[1], Math.max(p0[1], p1[1])] as Vec3,
      kind: b.kind ?? ODD_KIND,
    };
  });
}

/** +90° 回すと向きは (dir + 3) % 4 へ移る。現在 cur から目標 want にするための回転回数 */
function turnsFor(cur: Dir, want: Dir): number { return (cur - want + 4) % 4; }

function tryRotate(c: Ctx, g: FGroup, k: number, o: { lanes?: boolean; gap?: number } = {}): boolean {
  if (((k % 4) + 4) % 4 === 0) return false;
  const next = rotatedBoxes(g, k);
  if (!fits(c, g, next, o)) return false;
  applyGroup(c, g, next);
  return true;
}

/** 椅子の向き（座った人が向く方向）。座（kind 'chair'）と背（同じ材質で高い箱）の位置関係から読む */
function chairFacing(g: FGroup): Dir | null {
  const seat = g.boxes.find((b) => b.kind === 'chair') ?? g.boxes.find((b) => b.solid && b.max[1] < 0.6 && b.max[1] > 0.3);
  if (!seat) return null;
  const back = g.boxes.find((b) => b !== seat && b.mat === seat.mat && b.max[1] > seat.max[1] + 0.1);
  if (!back) return null;
  const dx = (seat.min[0] + seat.max[0]) / 2 - (back.min[0] + back.max[0]) / 2;
  const dz = (seat.min[2] + seat.max[2]) / 2 - (back.min[2] + back.max[2]) / 2;
  if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return null;
  return Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? 1 : 3) : (dz >= 0 ? 0 : 2);
}

// ---------------------------------------------------------------- ロッカーの前面

interface LockerInfo {
  body: Box;
  /** 前面の法線軸（0 = X / 2 = Z）と符号 */
  k: 0 | 2;
  sign: 1 | -1;
  /** 壁に沿った軸 */
  a: 0 | 2;
  /** 前面の座標 */
  F: number;
  A0: number; A1: number; y0: number; H: number;
  n: number; doorW: number;
}

/** ロッカー列の本体と前面の向き（FurnitureShapes.lockerGroup と同じ読み方） */
function lockerInfo(g: FGroup): LockerInfo | null {
  const body = g.boxes.find((b) => b.kind === 'lockers') ?? g.boxes.find((b) => b.solid && b.max[1] - b.min[1] > 1.2);
  if (!body) return null;
  let k: 0 | 2 | null = null;
  let sign: 1 | -1 = 1;
  for (const m of g.boxes) {
    if (m === body) continue;
    for (const ax of [0, 2] as const) {
      if (m.max[ax] > body.max[ax] + 1e-4) { k = ax; sign = 1; break; }
      if (m.min[ax] < body.min[ax] - 1e-4) { k = ax; sign = -1; break; }
    }
    if (k !== null) break;
  }
  if (k === null) return null;
  const a: 0 | 2 = k === 0 ? 2 : 0;
  const F = sign > 0 ? body.max[k] : body.min[k];
  const A0 = body.min[a], A1 = body.max[a];
  const n = Math.max(1, Math.round((A1 - A0) / 0.4));
  return { body, k, sign, a, F, A0, A1, y0: body.min[1], H: body.max[1], n, doorW: (A1 - A0) / n };
}

/** 法線軸 k の面に沿った箱（a0..a1 が壁に沿った範囲、n0..n1 が法線方向の範囲） */
function faceBox(k: 0 | 2, a0: number, a1: number, n0: number, n1: number, y0: number, y1: number, mat: MatId, solid = false): Box {
  return k === 2
    ? oddBox([a0, y0, Math.min(n0, n1)], [a1, y1, Math.max(n0, n1)], mat, solid)
    : oddBox([Math.min(n0, n1), y0, a0], [Math.max(n0, n1), y1, a1], mat, solid);
}

/** 前面が向く方向（室内側）の Dir */
function lockerDir(li: LockerInfo): Dir {
  return li.k === 2 ? (li.sign > 0 ? 0 : 2) : (li.sign > 0 ? 1 : 3);
}

/** 扉板 instance（size [0.38, h, 0.02]）を高さごとに使い回す */
type DoorSpecs = Map<string, InstanceSpec>;
function doorSpec(specs: DoorSpecs, mat: MatId, w: number, h: number): InstanceSpec {
  const key = `${mat}|${w.toFixed(3)}|${h.toFixed(3)}`;
  let s = specs.get(key);
  if (!s) { s = spec(mat, [w, h, 0.02]); specs.set(key, s); }
  return s;
}

/**
 * ロッカー 1 台の扉を angle（rad）だけ開ける。扉板 instance（蝶番のまわりを回す）と、開いた中の暗い箔を足す。
 * 足した箱の数を返す
 */
function openDoor(c: Ctx, li: LockerInfo, i: number, angle: number, specs: DoorSpecs, withVoid: boolean): { ok: boolean; boxes: number } {
  const d0 = li.A0 + i * li.doorW, d1 = d0 + li.doorW;
  const w = Math.max(0.2, li.doorW - 0.02);
  const y0 = li.y0 + 0.09;
  const h = Math.max(0.6, li.H - 0.04 - y0);
  const closedYaw = yawOfDir(lockerDir(li));
  // 閉じた扉の幅方向の単位ベクトル（yaw で local +X が向く先）
  const au: [number, number] = [Math.cos(closedYaw), -Math.sin(closedYaw)];
  const openYaw = closedYaw - angle; // マイナス方向が室内側へ開く
  const ou: [number, number] = [Math.cos(openYaw), -Math.sin(openYaw)];
  // 閉じたときの扉の中心（前面から 1.5 cm 手前）
  const cA = (d0 + d1) / 2;
  const cx0 = li.k === 2 ? cA : li.F + li.sign * 0.015;
  const cz0 = li.k === 2 ? li.F + li.sign * 0.015 : cA;
  // 蝶番 = 閉じた中心から幅の半分だけ戻った点
  const hx = cx0 - au[0] * (w / 2), hz = cz0 - au[1] * (w / 2);
  const px = hx + ou[0] * (w / 2), pz = hz + ou[1] * (w / 2);
  if (!insideRects(c.rects, oddBox([px - 0.25, y0, pz - 0.25], [px + 0.25, y0 + h, pz + 0.25], 'void', false), WALL_T - 0.02)) return { ok: false, boxes: 0 };
  put(doorSpec(specs, li.body.mat, w, h), [px, y0, pz], openYaw);
  if (!withVoid) return { ok: true, boxes: 0 };
  c.L.boxes.push(faceBox(li.k, d0 + 0.012, d1 - 0.012, li.F + li.sign * 0.004, li.F + li.sign * 0.012, y0 + 0.01, li.H - 0.05, 'void', false));
  return { ok: true, boxes: 1 };
}

// ---------------------------------------------------------------- 壁面ヘルパ

/** 壁の室内面のうち、長さ need 以上の空き区間を持つもの（[面, a0, a1] の列） */
function wallRuns(c: Ctx, need: number, pad = 0.9): { f: Face; a0: number; a1: number }[] {
  const out: { f: Face; a0: number; a1: number }[] = [];
  for (const f of innerFaces(c.rects)) {
    for (const [a0, a1] of freeRuns(f, c.sockets, pad)) if (a1 - a0 >= need) out.push({ f, a0, a1 });
  }
  return out;
}

/** 非ソリッドの壁付け箔（動線は見ない。足跡・扉前・既存ソリッドは見る） */
function wallDeco(c: Ctx, b: Box): boolean {
  if (!canPlace(c, b, { lanes: false, margin: WALL_T - 0.02, gap: 0.0 })) return false;
  c.L.boxes.push({ ...b, kind: b.kind ?? ODD_KIND });
  return true;
}

function odd(b: Box): Box { return { ...b, kind: ODD_KIND }; }

/** 非ソリッドの複製が足跡の内側にあり、扉前と既存のソリッドに刺さっていないか（元のグループは除く） */
function clearOfSolids(c: Ctx, boxes: Box[], own: Set<Box>): boolean {
  return boxes.every((b) => canPlace(c, b, { lanes: false, gap: 0.0, margin: WALL_T - 0.02, ignore: (q) => own.has(q) }));
}

/** rect の 4 隅（内側に margin 寄せ） */
function cornersOf(r: Rect, margin: number): [number, number, 1 | -1, 1 | -1][] {
  return [
    [r.x0 + margin, r.z0 + margin, 1, 1],
    [r.x1 - margin, r.z0 + margin, -1, 1],
    [r.x0 + margin, r.z1 - margin, 1, -1],
    [r.x1 - margin, r.z1 - margin, -1, -1],
  ];
}

/** strong なら focus と交差する領域（狭すぎれば主矩形） */
function region(c: Ctx, strength: Strength): Rect {
  const m = mainRect(c);
  if (strength !== 'strong') return m;
  const r = { x0: Math.max(m.x0, c.focus.x0), x1: Math.min(m.x1, c.focus.x1), z0: Math.max(m.z0, c.focus.z0), z1: Math.min(m.z1, c.focus.z1) };
  return r.x1 - r.x0 > 2.5 && r.z1 - r.z0 > 2.5 ? r : m;
}

/** strong なら focus の中のグループを先に、weak なら乱数順 */
function ordered(c: Ctx, gs: FGroup[], strength: Strength): FGroup[] {
  const shuffled = c.rng.shuffle([...gs]);
  if (strength !== 'strong') return shuffled;
  const a = shuffled.filter((g) => inFocus(c, { min: g.min, max: g.max }));
  const b = shuffled.filter((g) => !inFocus(c, { min: g.min, max: g.max }));
  return [...a, ...b];
}

/**
 * 家具の複製（壁・天井へ回すとき）。propGroup を外し kind を 'dress:odd' にして描画側の作り直しを止める。
 * 描き替えが効かないぶん座面 4 cm・背 5 cm の薄板がただの板に見えるので、金属以外の薄い箱は 10 cm まで厚くする（plump）
 */
function detached(b: Box, min: Vec3, max: Vec3, solid: boolean, plump = false): Box {
  const lo: Vec3 = [...min] as Vec3, hi: Vec3 = [...max] as Vec3;
  if (plump && !/^metal/.test(b.mat)) {
    let k = 0, thin = Infinity;
    for (const ax of [0, 1, 2] as const) { const d = hi[ax] - lo[ax]; if (d < thin) { thin = d; k = ax; } }
    if (thin < 0.09) { const grow = (0.1 - thin) / 2; lo[k] -= grow; hi[k] += grow; }
  }
  return { min: lo, max: hi, mat: b.mat, solid, kind: ODD_KIND };
}

// ================================================================ 1. 規則からの 1 つの逸脱

const oneDeviation: Oddity = {
  id: 'contents.oneDeviation', category: 'contents', weight: 4, theme: true,
  applicable(c) {
    const gs = groupsOf(c);
    if (seatGroups(c, gs).length >= 6) return true;
    return lockerGroups(c, gs).reduce((a, g) => a + (lockerInfo(g)?.n ?? 0), 0) >= 6;
  },
  apply(c, strength) {
    const gs = groupsOf(c);
    const seats = seatGroups(c, gs);
    const lockers = lockerGroups(c, gs).filter((g) => (lockerInfo(g)?.n ?? 0) >= 2);
    const useLocker = lockers.length > 0 && (seats.length < 6 || c.rng.chance(0.45));
    if (useLocker) {
      const specs: DoorSpecs = new Map();
      for (const g of ordered(c, lockers, strength)) {
        const li = lockerInfo(g);
        if (!li) continue;
        const i = c.rng.int(0, li.n - 1);
        const angle = c.rng.float(1.05, 1.4); // 60〜80°
        if (!openDoor(c, li, i, angle, specs, true).ok) continue;
        commit(c.L, ...specs.values());
        c.note(`oneDeviation: locker door ${i}/${li.n}`);
        return true;
      }
      if (seats.length < 6) return false;
    }
    for (const g of ordered(c, seats, strength)) {
      // 90° / 180° 回す
      const turns = c.rng.chance(0.55) ? [c.rng.chance(0.5) ? 1 : 3, 2] : [2, 1];
      for (const k of turns) if (tryRotate(c, g, k)) { c.note(`oneDeviation: turn ${k * 90}deg (${g.kind})`); return true; }
      // 通路側へ 0.5〜0.7 m 出す
      const d = c.rng.float(0.5, 0.7);
      const dirs: [number, number][] = c.rng.shuffle([[d, 0], [-d, 0], [0, d], [0, -d]]);
      for (const [dx, dz] of dirs) if (tryMove(c, g, dx, 0, dz, { lanes: false, gap: 0.03 })) { c.note(`oneDeviation: push ${d.toFixed(2)}m (${g.kind})`); return true; }
    }
    return false;
  },
};

// ================================================================ 2. 集積と空白

/** 売場の商品らしい小箱 */
function isProduct(b: Box): boolean {
  if (b.solid || !/^(boxCardboard|plastic|signPlate)/.test(b.mat)) return false;
  if (b.min[1] < 0.15) return false;
  const w = b.max[0] - b.min[0], d = b.max[2] - b.min[2], h = b.max[1] - b.min[1];
  return w < 1.0 && d < 1.0 && h < 0.8;
}

const clusterAndVoid: Oddity = {
  id: 'contents.clusterAndVoid', category: 'contents', weight: 3, theme: true,
  applicable(c) {
    if (seatGroups(c).length >= 8) return true;
    return interior(c.L).filter(isProduct).length >= 12;
  },
  apply(c, strength) {
    const seats = seatGroups(c);
    if (seats.length >= 8 && clusterSeats(c, seats, strength)) return true;
    return thinProducts(c);
  },
};

function clusterSeats(c: Ctx, seats: FGroup[], strength: Strength): boolean {
  // 同じ kind の中で最も多いものだけを寄せる（寸法をそろえるため）
  const byKind = new Map<string, FGroup[]>();
  for (const g of seats) {
    const list = byKind.get(g.kind ?? '') ?? [];
    list.push(g);
    byKind.set(g.kind ?? '', list);
  }
  let target: FGroup[] = [];
  for (const list of byKind.values()) if (list.length > target.length) target = list;
  if (target.length < 6) return false;
  const gw = Math.max(...target.map((g) => g.max[0] - g.min[0]));
  const gd = Math.max(...target.map((g) => g.max[2] - g.min[2]));
  const cw = gw + 0.05, cd = gd + 0.05;
  const r = region(c, strength);
  const corner = pick(c.rng, cornersOf(r, WALL_T + 0.2));
  const [bx, bz, sx, sz] = corner;
  // 「一角」に収める: 塊は最大 4.5 m 角（残りは捨てる = 空白になる）
  const span = 4.5;
  const cols = Math.max(1, Math.min(Math.floor(span / cw), Math.floor((r.x1 - r.x0 - 2 * WALL_T - 0.4) / cw)));
  const rows = Math.max(1, Math.min(Math.floor(span / cd), Math.floor((r.z1 - r.z0 - 2 * WALL_T - 0.4) / cd)));
  const perLayer = cols * rows;
  // 元の位置から全部取り除く
  const ids = new Set(target.map((g) => g.id));
  const soloBoxes = new Set(target.filter((g) => g.id.startsWith('solo#')).flatMap((g) => g.boxes));
  removeInterior(c.L, (b) => (b.propGroup !== undefined && ids.has(b.propGroup)) || soloBoxes.has(b));
  // 一角へ 0.05 m 間隔の密な格子で置き直す
  const placed = new Set<Box>();
  let ok = 0;
  for (let i = 0; i < target.length; i++) {
    if (!budgetOk(c, 8)) break;
    const g = target[i];
    const layer = Math.floor(i / perLayer);
    if (layer > 1) break; // 2 層まで
    const t = i % perLayer;
    const col = t % cols, row = Math.floor(t / cols);
    const ox = sx > 0 ? bx + col * cw : bx - col * cw - (g.max[0] - g.min[0]);
    const oz = sz > 0 ? bz + row * cd : bz - row * cd - (g.max[2] - g.min[2]);
    const next = g.boxes.map((b) => shifted(b, ox - g.min[0], layer * 0.45, oz - g.min[2]));
    if (next.some((b) => b.solid && !canPlace(c, b, { gap: 0.0, ignore: (q) => placed.has(q) }))) continue;
    for (const b of next) { c.L.boxes.push(b); placed.add(b); }
    ok++;
  }
  c.note(`clusterAndVoid: ${ok}/${target.length} ${target[0].kind} in ${cols}x${rows}`);
  return ok >= 4;
}

/** 棚の商品を 1 列だけ残して取り除く */
function thinProducts(c: Ctx): boolean {
  const prods = interior(c.L).filter(isProduct);
  if (prods.length < 12) return false;
  const keep = pick(c.rng, prods);
  // 棚の並びの長い方の軸に沿って、残す帯（幅 1.2 m）を 1 本だけ決める
  const spanX = Math.max(...prods.map((b) => b.max[0])) - Math.min(...prods.map((b) => b.min[0]));
  const spanZ = Math.max(...prods.map((b) => b.max[2])) - Math.min(...prods.map((b) => b.min[2]));
  const ax: 0 | 2 = spanX >= spanZ ? 0 : 2;
  const mid = (keep.min[ax] + keep.max[ax]) / 2;
  const n = removeInterior(c.L, (b) => isProduct(b) && Math.abs((b.min[ax] + b.max[ax]) / 2 - mid) > 0.6);
  c.note(`clusterAndVoid: products ${prods.length} -> ${prods.length - n}`);
  return n >= 8;
}

// ================================================================ 3. 積み上げ

/** 天板らしい箱（高さ 0.7〜0.78 の上面を持つソリッド） */
function isTableTop(b: Box): boolean {
  return b.solid && b.max[1] > 0.68 && b.max[1] < 0.8 && b.max[0] - b.min[0] > 0.5 && b.max[2] - b.min[2] > 0.4;
}

/** 天板の真下にある脚など（XZ が天板に収まる箱）を集める */
function tableAssembly(c: Ctx, top: Box): Box[] {
  const out = [top];
  for (const b of interior(c.L)) {
    if (b === top || b.max[1] > top.max[1] + 0.01) continue;
    if (b.min[0] >= top.min[0] - 0.06 && b.max[0] <= top.max[0] + 0.06 && b.min[2] >= top.min[2] - 0.06 && b.max[2] <= top.max[2] + 0.06) out.push(b);
  }
  return out;
}

const stacking: Oddity = {
  id: 'contents.stacking', category: 'contents', weight: 2, theme: true,
  applicable(c) {
    const gs = groupsOf(c);
    if (seatGroups(c, gs).length >= 1) return true;
    if (lockerGroups(c, gs).length >= 1) return true;
    return interior(c.L).some(isTableTop);
  },
  apply(c, strength) {
    const gs = groupsOf(c);
    const seats = seatGroups(c, gs).filter((g) => g.kind === 'chair');
    const lockers = lockerGroups(c, gs);
    const tops = interior(c.L).filter(isTableTop);
    const order = c.rng.shuffle(['chair', 'table', 'locker']);
    for (const v of order) {
      if (v === 'chair' && seats.length && stackChairs(c, seats, strength)) return true;
      if (v === 'table' && tops.length && stackTables(c, tops, strength)) return true;
      if (v === 'locker' && lockers.length && tipLockers(c, lockers, strength)) return true;
    }
    return false;
  },
};

function stackChairs(c: Ctx, seats: FGroup[], strength: Strength): boolean {
  for (const g of ordered(c, seats, strength)) {
    const h = g.max[1] - g.min[1];
    const seatStep = 0.45;
    const room = Math.floor((c.h - 0.25 - (g.min[1] + h)) / seatStep);
    const n = Math.min(strength === 'strong' ? 5 : 4, Math.max(3, room));
    if (n < 3) continue;
    if (!budgetOk(c, g.boxes.length * n)) continue;
    const add: Box[] = [];
    for (let k = 1; k <= n; k++) {
      for (const b of g.boxes) {
        const dy = seatStep * k;
        add.push(detached(b, [b.min[0], b.min[1] + dy, b.min[2]], [b.max[0], b.max[1] + dy, b.max[2]], false, true));
      }
    }
    if (!clearOfSolids(c, add, new Set(g.boxes))) continue;
    c.L.boxes.push(...add);
    c.note(`stacking: ${n} chairs on one`);
    return true;
  }
  return false;
}

function stackTables(c: Ctx, tops: Box[], strength: Strength): boolean {
  const order = strength === 'strong' ? [...tops.filter((b) => inFocus(c, b)), ...tops.filter((b) => !inFocus(c, b))] : c.rng.shuffle([...tops]);
  for (const top of order) {
    const asm = tableAssembly(c, top);
    const base = Math.min(...asm.map((b) => b.min[1]));
    const h = top.max[1] - base;
    if (h < 0.5) continue;
    const tiers = Math.min(2, Math.max(1, Math.floor((c.h - 0.3 - top.max[1]) / h)));
    if (tiers < 1 || !budgetOk(c, asm.length * tiers)) continue;
    const add: Box[] = [];
    for (let k = 1; k <= tiers; k++) for (const b of asm) {
      const dy = h * k;
      add.push(detached(b, [b.min[0], b.min[1] + dy, b.min[2]], [b.max[0], b.max[1] + dy, b.max[2]], false));
    }
    if (!clearOfSolids(c, add, new Set(asm))) continue;
    c.L.boxes.push(...add);
    c.note(`stacking: table x${tiers}`);
    return true;
  }
  return false;
}

/** ロッカー 1〜2 台を横倒し（y の範囲と奥行きの範囲を入れ替える） */
function tipLockers(c: Ctx, lockers: FGroup[], strength: Strength): boolean {
  let done = 0;
  const want = strength === 'strong' ? 2 : 1;
  for (const g of ordered(c, lockers, strength)) {
    if (done >= want) break;
    const li = lockerInfo(g);
    if (!li) continue;
    const back = li.F - li.sign * (li.body.max[li.k] - li.body.min[li.k]); // 壁側の面
    const next = g.boxes.map((b) => {
      const d0 = li.sign * (b.min[li.k] - back), d1 = li.sign * (b.max[li.k] - back); // 壁からの距離 → 新しい高さ
      const n0 = back + li.sign * (b.min[1] - li.y0), n1 = back + li.sign * (b.max[1] - li.y0); // 元の高さ → 室内への出
      const min: Vec3 = [...b.min] as Vec3;
      const max: Vec3 = [...b.max] as Vec3;
      min[1] = Math.min(d0, d1); max[1] = Math.max(d0, d1);
      min[li.k] = Math.min(n0, n1); max[li.k] = Math.max(n0, n1);
      return detached(b, min, max, b.solid);
    });
    if (!fits(c, g, next, { gap: 0.03 })) continue;
    applyGroup(c, g, next);
    done++;
  }
  if (!done) return false;
  c.note(`stacking: ${done} locker bank(s) tipped over`);
  return true;
}

// ================================================================ 4. 壁に付いた家具

const wallFurniture: Oddity = {
  id: 'contents.wallFurniture', category: 'contents', weight: 2, theme: true,
  applicable(c) { return seatGroups(c).length >= 1; },
  apply(c, strength) {
    const seats = ordered(c, seatGroups(c), strength);
    if (!seats.length) return false;
    const want = strength === 'strong' ? c.rng.int(2, 3) : c.rng.int(1, 2);
    const onWall = strength === 'strong' ? c.rng.chance(0.65) : c.rng.chance(0.4);
    const n = onWall ? chairsOnWall(c, seats, want, strength) : chairsOnCeiling(c, seats, want, strength);
    if (!n) return (onWall ? chairsOnCeiling(c, seats, want, strength) : chairsOnWall(c, seats, want, strength)) > 0;
    c.note(`wallFurniture: ${n} chair(s) on ${onWall ? 'wall' : 'ceiling'}`);
    return true;
  },
};

function chairsOnCeiling(c: Ctx, seats: FGroup[], want: number, strength: Strength): number {
  const r = region(c, strength);
  let done = 0;
  for (let i = 0; i < want; i++) {
    const g = seats[i % seats.length];
    const gw = g.max[0] - g.min[0], gd = g.max[2] - g.min[2];
    let placed = false;
    for (let t = 0; t < 12 && !placed; t++) {
      const x = c.rng.float(r.x0 + WALL_T + 0.3, Math.max(r.x0 + WALL_T + 0.3, r.x1 - WALL_T - 0.3 - gw));
      const z = c.rng.float(r.z0 + WALL_T + 0.3, Math.max(r.z0 + WALL_T + 0.3, r.z1 - WALL_T - 0.3 - gd));
      const add = g.boxes.map((b) => detached(b,
        [b.min[0] - g.min[0] + x, c.h - (b.max[1] - g.min[1]), b.min[2] - g.min[2] + z],
        [b.max[0] - g.min[0] + x, c.h - (b.min[1] - g.min[1]), b.max[2] - g.min[2] + z], false, true));
      if (add.some((b) => !insideRects(c.rects, b, WALL_T - 0.01))) continue;
      if (!clearOfSolids(c, add, new Set(g.boxes))) continue;
      if (!budgetOk(c, add.length)) return done;
      c.L.boxes.push(...add);
      placed = true;
      done++;
    }
  }
  return done;
}

function chairsOnWall(c: Ctx, seats: FGroup[], want: number, strength: Strength): number {
  const need = 0.8;
  let runs = wallRuns(c, need, 1.0);
  if (!runs.length) return 0;
  if (strength === 'strong') {
    const front = runs.filter(({ f, a0, a1 }) => inFocus(c, { min: onFace(f, a0, 0.1, 0), max: onFace(f, a1, 0.2, 1) }));
    if (front.length) runs = front;
  }
  let done = 0;
  for (let i = 0; i < want * 6 && done < want; i++) {
    const g = seats[i % seats.length];
    const { f, a0, a1 } = pick(c.rng, runs);
    const k: 0 | 2 = f.horizontal ? 2 : 0;
    const gAlong = f.horizontal ? g.max[0] - g.min[0] : g.max[2] - g.min[2];
    const gAcross = f.horizontal ? g.max[2] - g.min[2] : g.max[0] - g.min[0];
    if (a1 - a0 < gAlong + 0.3) continue;
    const at = c.rng.float(a0 + 0.15, a1 - gAlong - 0.15);
    const hiY = Math.min(2.0, c.h - 0.4 - gAcross);
    if (hiY < 1.2) continue;
    const baseY = c.rng.float(1.2, hiY);
    // 高さの範囲 ↔ 壁に垂直な軸の範囲を入れ替えて、壁から生えた椅子にする
    const add = g.boxes.map((b) => {
      const alongMin = (f.horizontal ? b.min[0] - g.min[0] : b.min[2] - g.min[2]) + at;
      const alongMax = (f.horizontal ? b.max[0] - g.min[0] : b.max[2] - g.min[2]) + at;
      const outMin = f.face + f.inward * (b.min[1] - g.min[1]);
      const outMax = f.face + f.inward * (b.max[1] - g.min[1]);
      const yMin = baseY + (b.min[k] - g.min[k]);
      const yMax = baseY + (b.max[k] - g.min[k]);
      const min: Vec3 = [0, Math.min(yMin, yMax), 0];
      const max: Vec3 = [0, Math.max(yMin, yMax), 0];
      if (f.horizontal) { min[0] = alongMin; max[0] = alongMax; min[2] = Math.min(outMin, outMax); max[2] = Math.max(outMin, outMax); }
      else { min[2] = alongMin; max[2] = alongMax; min[0] = Math.min(outMin, outMax); max[0] = Math.max(outMin, outMax); }
      return detached(b, min, max, false, true);
    });
    // 厚くした分が壁の中へ入らないように、壁面より奥に出た箱は室内側へ押し戻す
    for (const b of add) {
      const behind = f.inward > 0 ? f.face - b.min[k] : b.max[k] - f.face;
      if (behind > 0) { b.min[k] += f.inward * behind; b.max[k] += f.inward * behind; }
    }
    if (add.some((b) => !insideRects(c.rects, b, WALL_T - 0.02))) continue;
    if (!clearOfSolids(c, add, new Set(g.boxes))) continue;
    if (!budgetOk(c, add.length)) break;
    c.L.boxes.push(...add);
    done++;
  }
  return done;
}

// ================================================================ 5. 向きの統一の狂い

const uniformFacing: Oddity = {
  id: 'contents.uniformFacing', category: 'contents', weight: 2, theme: true,
  applicable(c) {
    const gs = groupsOf(c);
    if (seatGroups(c, gs).filter((g) => chairFacing(g) !== null).length >= 6) return true;
    return lockerGroups(c, gs).reduce((a, g) => a + (lockerInfo(g)?.n ?? 0), 0) >= 8;
  },
  apply(c, strength) {
    const gs = groupsOf(c);
    const chairs = seatGroups(c, gs).filter((g) => chairFacing(g) !== null);
    const lockers = lockerGroups(c, gs);
    const doors = lockers.reduce((a, g) => a + (lockerInfo(g)?.n ?? 0), 0);
    if (chairs.length >= 6) {
      // 目標の 1 方向: strong は入口（入ってきた扉）を見る向き、weak は乱数
      const want: Dir = strength === 'strong' && c.entry ? c.entry.dir : (c.rng.int(0, 3) as Dir);
      let n = 0;
      for (const g of chairs) {
        const cur = chairFacing(g);
        if (cur === null) continue;
        const k = turnsFor(cur, want);
        if (k === 0) { n++; continue; }
        if (tryRotate(c, g, k, { lanes: false, gap: 0.0 })) n++;
      }
      if (n >= Math.ceil(chairs.length * 0.7)) { c.note(`uniformFacing: ${n}/${chairs.length} chairs -> dir ${want}`); return true; }
    }
    if (doors >= 8) {
      const specs: DoorSpecs = new Map();
      const angle = 0.873; // 50°
      let n = 0, boxes = 0;
      for (const g of lockers) {
        const li = lockerInfo(g);
        if (!li) continue;
        for (let i = 0; i < li.n && n < 120; i++) {
          const r = openDoor(c, li, i, angle, specs, boxes < 60 && budgetOk(c, 2));
          boxes += r.boxes;
          if (r.ok) n++;
        }
      }
      if (n >= 8) { commit(c.L, ...specs.values()); c.note(`uniformFacing: ${n} locker doors at 50deg`); return true; }
    }
    return false;
  },
};

// ================================================================ 6. 数の異常

const CLOCK_TIMES = ['3:17', '2:04', '11:48', '6:33', '9:21', '7:55', '1:09', '4:42', '12:26', '8:13'];

const countAnomaly: Oddity = {
  id: 'contents.countAnomaly', category: 'contents', weight: 2, theme: true, // ほぼ全部屋で成立するので重みを下げる（統合）
  applicable(c) { return innerFaces(c.rects).length > 0 && c.h > 2.2; },
  apply(c, strength) {
    const order = c.rng.shuffle(['ext', 'clock', 'exit']);
    for (const v of order) {
      if (v === 'ext' && manyExtinguishers(c, strength)) return true;
      if (v === 'clock' && manyClocks(c, strength)) return true;
      if (v === 'exit' && manyExitSigns(c)) return true;
    }
    return false;
  },
};

/** strong なら入口正面の壁を優先して区間を選ぶ */
function pickRun(c: Ctx, need: number, strength: Strength, pad = 0.9): { f: Face; a0: number; a1: number } | null {
  let runs = wallRuns(c, need, pad);
  if (!runs.length) return null;
  if (strength === 'strong') {
    const front = runs.filter(({ f, a0, a1 }) => inFocus(c, { min: onFace(f, a0, 0.05, 0), max: onFace(f, a1, 0.25, 1) }));
    if (front.length) runs = front;
  }
  return pick(c.rng, runs);
}

/** (a) 消火器 8 本: 1 つの壁面に 0.5 m 間隔 */
function manyExtinguishers(c: Ctx, strength: Strength): boolean {
  const n = 8;
  const run = pickRun(c, n * 0.5 + 0.3, strength);
  if (!run) return false;
  const { f, a0, a1 } = run;
  const start = (a0 + a1) / 2 - (n * 0.5) / 2 + 0.17;
  let done = 0;
  for (let k = 0; k < n; k++) {
    if (!budgetOk(c, 2)) break;
    const at = start + k * 0.5;
    const body = odd(alongFace(f, at, 0.16, 0.01, 0.17, 0.5, 1.0, 'plasticRed', false));
    if (!wallDeco(c, body)) continue;
    c.L.boxes.push(odd(alongFace(f, at + 0.06, 0.04, 0.01, 0.07, 1.0, 1.04, 'metalDark', false)));
    done++;
  }
  if (done < 5) return false;
  c.note(`countAnomaly: ${done} extinguishers`);
  return true;
}

/** (b) 時計 5 個: 1 つの壁に 0.8 m 間隔（時刻は全部違う） */
function manyClocks(c: Ctx, strength: Strength): boolean {
  const n = 5;
  const run = pickRun(c, n * 0.8 + 0.4, strength);
  if (!run) return false;
  const { f, a0, a1 } = run;
  const y = Math.min(c.h - 0.5, 2.2);
  if (y < 1.6) return false;
  const start = (a0 + a1) / 2 - (n * 0.8) / 2 + 0.4;
  const times = c.rng.shuffle([...CLOCK_TIMES]).slice(0, n);
  let done = 0;
  for (let k = 0; k < n; k++) {
    if (!pushSign(c, { text: times[k], kind: 'clock', pos: onFace(f, start + k * 0.8, 0.04, y), dir: facing(f), width: 0.45 })) break;
    done++;
  }
  if (done < 3) return false;
  c.note(`countAnomaly: ${done} clocks`);
  return true;
}

/** (c) 非常口サインだらけ: 全壁面の天井直下に 1.5 m 間隔（上限 8 枚） */
function manyExitSigns(c: Ctx): boolean {
  const y = c.h - 0.35;
  if (y < 1.9) return false;
  let done = 0;
  let full = false;
  for (const f of innerFaces(c.rects)) {
    for (const [a0, a1] of freeRuns(f, c.sockets, 0.5)) {
      for (let at = a0 + 0.5; at <= a1 - 0.5 && done < 8; at += 1.5) {
        if (!pushSign(c, { text: '非常口', kind: 'emissive', pos: onFace(f, at, 0.05, y), dir: facing(f), width: 0.5 })) { full = true; break; }
        done++;
      }
      if (done >= 8 || full) break;
    }
    if (done >= 8 || full) break;
  }
  if (done < 4) return false;
  c.note(`countAnomaly: ${done} exit signs`);
  return true;
}

// ================================================================ 7. 用途不明の設備

const uselessFixtures: Oddity = {
  id: 'contents.uselessFixtures', category: 'contents', weight: 3, theme: false,
  applicable(c) { return wallRuns(c, 1.2, 0.8).length > 0; },
  apply(c, strength) {
    const kinds = c.rng.shuffle(['pipe', 'rail', 'panel', 'buttons']);
    const want = c.rng.int(1, 2);
    let done = 0;
    const names: string[] = [];
    for (const v of kinds) {
      if (done >= want) break;
      const ok = v === 'pipe' ? deadPipe(c, strength)
        : v === 'rail' ? deadRail(c, strength)
          : v === 'panel' ? deadPanel(c, strength)
            : deadButtons(c, strength);
      if (ok) { done++; names.push(v); }
    }
    if (!done) return false;
    c.note(`uselessFixtures: ${names.join('+')}`);
    return true;
  },
};

/** (a) 何もつながっていないパイプ: 高さ 2.1 m を 2〜3 m 走り、途中で直角に 0.5 m 下がって終わる */
function deadPipe(c: Ctx, strength: Strength): boolean {
  if (c.h < 2.5) return false;
  const len = c.rng.float(2.0, 3.0);
  const run = pickRun(c, len + 0.5, strength, 0.8);
  if (!run) return false;
  const { f, a0, a1 } = run;
  const at = c.rng.float(a0 + 0.2, a1 - len - 0.2);
  const y = Math.min(2.1, c.h - 0.35);
  const main = odd(alongFace(f, at, len, 0.06, 0.14, y, y + 0.08, 'metalDark', false));
  if (!wallDeco(c, main)) return false;
  const endAt = c.rng.chance(0.5) ? at : at + len - 0.08;
  c.L.boxes.push(odd(alongFace(f, endAt, 0.08, 0.06, 0.14, y - 0.5, y + 0.08, 'metalDark', false)));
  c.L.boxes.push(odd(alongFace(f, endAt - 0.01, 0.1, 0.05, 0.15, y - 0.55, y - 0.5, 'metal', false)));
  return true;
}

/** (b) 壁の途中で終わる手すり: 高さ 0.85 m に 1.5〜2.5 m、両端に何も無い */
function deadRail(c: Ctx, strength: Strength): boolean {
  const len = c.rng.float(1.5, 2.5);
  const run = pickRun(c, len + 0.4, strength, 0.8);
  if (!run) return false;
  const { f, a0, a1 } = run;
  const at = c.rng.float(a0 + 0.2, a1 - len - 0.2);
  const rail = odd(alongFace(f, at, len, 0.04, 0.09, 0.85, 0.93, 'handrailWood', false));
  if (!wallDeco(c, rail)) return false;
  for (const t of [at + 0.15, at + len - 0.19]) c.L.boxes.push(odd(alongFace(f, t, 0.04, 0.0, 0.05, 0.86, 0.9, 'metalDark', false)));
  return true;
}

/** (c) ボタンの無いエレベーター盤: stainless 0.25 × 0.35 を高さ 1.1 m に、上に小さな枠だけ */
function deadPanel(c: Ctx, strength: Strength): boolean {
  const run = pickRun(c, 0.9, strength, 0.8);
  if (!run) return false;
  const { f, a0, a1 } = run;
  const at = c.rng.float(a0 + 0.2, a1 - 0.45);
  const plate = odd(alongFace(f, at, 0.25, 0.0, 0.01, 0.925, 1.275, 'stainless', false));
  if (!wallDeco(c, plate)) return false;
  c.L.boxes.push(odd(alongFace(f, at + 0.04, 0.17, 0.01, 0.018, 1.33, 1.44, 'metalDark', false)));
  c.L.boxes.push(odd(alongFace(f, at + 0.055, 0.14, 0.018, 0.022, 1.35, 1.42, 'void', false)));
  return true;
}

/** (d) 押せない自販機ボタンの列: 0.05 m 角を縦 6 × 横 2、機械本体は無い */
function deadButtons(c: Ctx, strength: Strength): boolean {
  const run = pickRun(c, 0.8, strength, 0.8);
  if (!run) return false;
  const { f, a0, a1 } = run;
  const at = c.rng.float(a0 + 0.2, a1 - 0.5);
  const mats: MatId[] = ['plasticRed', 'plasticBlue', 'plasticYellow'];
  let done = 0;
  for (let col = 0; col < 2; col++) {
    for (let row = 0; row < 6; row++) {
      if (!budgetOk(c, 1)) break;
      const y = 1.0 + row * 0.09;
      const b = odd(alongFace(f, at + col * 0.09, 0.05, 0.0, 0.025, y, y + 0.05, mats[(row + col) % 3], false));
      if (col === 0 && row === 0) { if (!wallDeco(c, b)) return false; }
      else c.L.boxes.push(b);
      done++;
    }
  }
  return done >= 8;
}

export const CONTENT_ODDITIES: Oddity[] = [oneDeviation, clusterAndVoid, stacking, wallFurniture, uniformFacing, countAnomaly, uselessFixtures];
