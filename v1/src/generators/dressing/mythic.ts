/**
 * Mythic の部屋別ドレッシング（担当 M。docs/reference-rarities-analysis.md の MYTHIC 表 + docs/reference-mythic.md）。
 * generateLayout で Generator 直後・Modifier の layout フックより前に呼ばれる。定義 ID で分岐し、
 * 「文字（L.signs）と少数の大物・光」で第一印象を作る。
 *
 * 規約:
 *  - 乱数は渡された rng（p.rng.fork('dress')）だけ。footprint・ソケット・扉前 1.8 m（doorZones）・動線は変えない。
 *  - 追加は 箱 +300 / ライト +2 / サイン合計 44 枚以内（後段の Modifier が足す分を残す）。反復物は L.instances。
 *  - 後段の Modifier と重ならないよう、相手の配置規則をここで再現して避ける（M01 SelfMap の地図板、M16 GraphReference の額縁）。
 *  - M12 は ScaleAnomaly（×4）で全て拡大されるので、人の寸法で見せたい物は 1/s で置く。M13 は RenderStyle が内装を全部捨てるので追加しない。
 *  - M18 だけ外殻（シェル）を窓の擬似ソケットで組み直す（壁を実際に抜く。MultiEdge / ScaleAnomaly と同じ手順。L.sockets には入れない）。
 */
import { aabbFromCenter, type AABB } from '../../core/aabb';
import type { Rng } from '../../core/rng';
import { dirVec, type Dir, type Socket, type Vec3 } from '../../core/types';
import { OMITTED_ROOMS } from '../../data';
import { wallSlots } from '../../modifiers/mods/GraphReference.wall';
import { forwardSocket } from '../../modifiers/mods/LoopTopology.shared';
import { wallBands } from '../common';
import { along, across, buildShell, inFootprint, type Rect } from '../footprint';
import { alongFace, chair, keepOutZones, freeRuns, hitsZone, innerFaces, insideRects, signAt, type Face } from '../furniture';
import { box, HOLE_SIZE, WALL_T, type Box, type GenParams, type InstanceSpec, type MatId, type RoomLayout, type SignSpec } from '../layout';

// ---------------------------------------------------------------- 共通

/** 部屋あたりの追加予算 */
const BOX_BUDGET = 300;
const LIGHT_BUDGET = 2;
/** サインの合計上限（SignAtlas は 48。後段の Modifier の分を残す） */
const SIGN_CAP = 44;

interface Ctx {
  L: RoomLayout;
  p: GenParams;
  rng: Rng;
  h: number;
  /** シェル（床・天井・外壁）の箱数。内装はこれ以降 */
  shell: number;
  rects: Rect[];
  faces: Face[];
  /** 扉前・床穴・着地点の禁止領域 */
  zones: AABB[];
  entry: Socket | undefined;
  budget: { boxes: number; lights: number };
}

type Run = [number, number];

function mkCtx(L: RoomLayout, p: GenParams, rng: Rng): Ctx {
  const entry = L.sockets.find((s) => s.id === 'entry');
  const landing = entry?.type === 'hole' ? aabbFromCenter(entry.pos[0], 0, entry.pos[2], 1.2, 1, 1.2) : null;
  return {
    L, p, rng, h: L.height, shell: L.shellCount ?? L.boxes.length, rects: L.footprint, faces: innerFaces(L.footprint),
    zones: keepOutZones(L, landing), entry, budget: { boxes: BOX_BUDGET, lights: LIGHT_BUDGET },
  };
}

function overlaps(a: Box | AABB, b: Box | AABB, gap = 0): boolean {
  return a.min[0] < b.max[0] + gap && a.max[0] > b.min[0] - gap && a.min[1] < b.max[1] + gap && a.max[1] > b.min[1] - gap && a.min[2] < b.max[2] + gap && a.max[2] > b.min[2] - gap;
}

function interiorSolids(c: Ctx): Box[] {
  const out: Box[] = [];
  for (let i = c.shell; i < c.L.boxes.length; i++) if (c.L.boxes[i].solid) out.push(c.L.boxes[i]);
  return out;
}

/** ユニット（箱の集合）が置けるか: ソリッド箱は 禁止領域外・足跡内・既存ソリッドと重ならない。margin < 0 で壁厚の中も許す（M12） */
function canPlace(c: Ctx, boxes: Box[], o: { margin?: number; gap?: number; clearance?: number } = {}): boolean {
  if (boxes.length > c.budget.boxes) return false;
  const solids = interiorSolids(c);
  const margin = o.margin ?? 0.14;
  for (const b of boxes) {
    if (!b.solid) continue;
    if (hitsZone(c.zones, b)) return false;
    if (!insideRects(c.rects, b, margin)) return false;
    for (const s of solids) if (overlaps(s, b, o.gap ?? 0.05)) return false;
    if (o.clearance) {
      // 周囲に歩ける余白（他のソリッドとの距離）
      for (const s of solids) if (overlaps(s, b, o.clearance)) return false;
    }
  }
  return true;
}

function add(c: Ctx, boxes: Box[]): boolean {
  if (boxes.length > c.budget.boxes) return false;
  c.L.boxes.push(...boxes);
  c.budget.boxes -= boxes.length;
  return true;
}

/** 置けるときだけ追加する */
function placeUnit(c: Ctx, boxes: Box[], o: { margin?: number; gap?: number; clearance?: number } = {}): boolean {
  if (!canPlace(c, boxes, o)) return false;
  return add(c, boxes);
}

function addLight(c: Ctx, pos: Vec3, color: number, intensity: number, distance: number): void {
  if (c.budget.lights <= 0) return;
  c.L.lights.push({ pos, color, intensity, distance });
  c.budget.lights--;
}

function signCount(L: RoomLayout): number {
  return L.signs?.length ?? 0;
}

/** サイン（上限つき）。o.offset は室内面からの出 */
function sign(c: Ctx, f: Face, at: number, y: number, width: number, text: string, o: { kind?: SignSpec['kind']; color?: number; background?: number; offset?: number; sub?: string; id?: string } = {}): boolean {
  if (signCount(c.L) >= SIGN_CAP) return false;
  signAt(c.L, f, at, y, width, text, o);
  return true;
}

/** InstancedMesh の反復配置（transforms は後で足す。空なら最後に捨てる） */
function inst(c: Ctx, mat: MatId, size: Vec3, solid = false): InstanceSpec {
  const spec: InstanceSpec = { mat, size, transforms: [] };
  if (solid) spec.solid = true;
  (c.L.instances ??= []).push(spec);
  return spec;
}

function dropEmptyInstances(L: RoomLayout): void {
  if (!L.instances) return;
  L.instances = L.instances.filter((s) => s.transforms.length > 0);
  if (L.instances.length === 0) L.instances = undefined;
}

/** 面 f 上の位置（辺に沿って at、室内面から d、高さ y） */
function facePos(f: Face, at: number, d: number, y: number): Vec3 {
  const n = f.face + f.inward * d;
  return f.horizontal ? [at, y, n] : [n, y, at];
}

/** 面に平行なインスタンスの yaw（size は yaw=0 で x = 辺に沿う長さ） */
function faceYaw(f: Face): number {
  return f.horizontal ? 0 : Math.PI / 2;
}

function subtractRuns(runs: Run[], cuts: Run[]): Run[] {
  const out: Run[] = [];
  for (const [p0, q0] of runs) {
    let pieces: Run[] = [[p0, q0]];
    for (const [a, b] of cuts) {
      pieces = pieces.flatMap(([p, q]): Run[] => (b <= p || a >= q ? [[p, q]] : [[p, Math.min(q, a)], [Math.max(p, b), q]]));
    }
    out.push(...pieces.filter(([p, q]) => q - p > 0.05));
  }
  return out;
}

/**
 * 面 f の空き区間: 開口（ソケット ± pad）と、面の手前 depth 以内にある内装箱（装飾扉・窓・帯・家具。y0..y1 に掛かるもの）を除く。
 * 角（直交する壁の厚み）も corner だけ除く
 */
function faceRuns(c: Ctx, f: Face, o: { pad?: number; depth?: number; y0?: number; y1?: number; corner?: number; from?: number } = {}): Run[] {
  const pad = o.pad ?? 0.8, depth = o.depth ?? 0.35, y0 = o.y0 ?? 0.05, y1 = o.y1 ?? c.h - 0.05, corner = o.corner ?? 0.2;
  const n0 = Math.min(f.face, f.face + f.inward * depth), n1 = Math.max(f.face, f.face + f.inward * depth);
  const cuts: Run[] = [];
  for (let i = o.from ?? c.shell; i < c.L.boxes.length; i++) {
    const b = c.L.boxes[i];
    if (b.max[1] <= y0 || b.min[1] >= y1) continue;
    const bn0 = f.horizontal ? b.min[2] : b.min[0], bn1 = f.horizontal ? b.max[2] : b.max[0];
    if (bn1 <= n0 || bn0 >= n1) continue;
    const a0 = f.horizontal ? b.min[0] : b.min[2], a1 = f.horizontal ? b.max[0] : b.max[2];
    if (a1 <= f.a0 || a0 >= f.a1) continue;
    cuts.push([a0 - 0.15, a1 + 0.15]);
  }
  const base: Run[] = freeRuns(f, c.L.sockets, pad).map(([p, q]): Run => [Math.abs(p - f.a0) < 1e-6 ? p + corner : p, Math.abs(q - f.a1) < 1e-6 ? q - corner : q]).filter(([p, q]) => q - p > 0.05);
  return subtractRuns(base, cuts);
}

function longest(runs: Run[]): Run | null {
  let best: Run | null = null;
  for (const r of runs) if (!best || r[1] - r[0] > best[1] - best[0]) best = r;
  return best;
}

function faceLen(f: Face): number {
  return f.a1 - f.a0;
}

/** ソケットが載っている面 */
function faceOfSocket(c: Ctx, s: Socket): Face | undefined {
  const t = along(s.dir, s.pos[0], s.pos[2]);
  return c.faces.find((f) => f.dir === s.dir && Math.abs(f.coord - across(s.dir, s.pos[0], s.pos[2])) < 0.05 && t >= f.a0 - 0.01 && t <= f.a1 + 0.01);
}

/** 面の中央から入口までの距離（面の並び順に使う） */
function faceDistFromEntry(c: Ctx, f: Face): number {
  if (!c.entry) return 0;
  const mid = facePos(f, (f.a0 + f.a1) / 2, 0, 0);
  return Math.hypot(mid[0] - c.entry.pos[0], mid[2] - c.entry.pos[2]);
}

/** 汎用パターンの家具島（SmallRoom の patternIslands = 0.45〜1.1 m の低い塊）を取り除く。シェル・器具・帯はそのまま */
function stripIslands(c: Ctx): void {
  const keep = c.L.boxes.slice(0, c.shell);
  for (let i = c.shell; i < c.L.boxes.length; i++) {
    const b = c.L.boxes[i];
    const island = b.solid && !b.kind && (b.mat === 'furnitureLight' || b.mat === 'furnitureDark') && b.min[1] < 0.05 && b.max[1] <= 1.15
      && b.max[0] - b.min[0] >= 0.9 && b.max[2] - b.min[2] >= 0.9;
    if (!island) keep.push(b);
  }
  c.L.boxes = keep;
}

/** シェルの材質を差し替える（パレットも合わせる。後段の Modifier が外殻を組み直すときも同じ材質になる） */
function recolorShell(c: Ctx, m: { floor?: MatId; wall?: MatId; ceiling?: MatId }): void {
  const L = c.L;
  const pal = L.palette;
  for (let i = 0; i < c.shell; i++) {
    const b = L.boxes[i];
    if (m.floor && b.mat === pal.floor && b.max[1] <= 0.001) L.boxes[i] = { ...b, mat: m.floor };
    else if (m.ceiling && b.mat === pal.ceiling && b.min[1] >= c.h - 0.001) L.boxes[i] = { ...b, mat: m.ceiling };
    else if (m.wall && b.mat === pal.wall) L.boxes[i] = { ...b, mat: m.wall };
  }
  L.palette = { ...pal, floor: m.floor ?? pal.floor, wall: m.wall ?? pal.wall, ceiling: m.ceiling ?? pal.ceiling };
}

/** 山形矢印（2 本の棒。tip が先端、heading は +x を 0 として y 軸まわり。RoomBuilder の rotation.y と同じ向き） */
function chevron(spec: InstanceSpec, tip: Vec3, heading: number): void {
  const len = spec.size[0];
  for (const s of [-1, 1]) {
    const yaw = heading + s * Math.PI / 4;
    const dx = Math.cos(yaw), dz = -Math.sin(yaw);
    spec.transforms.push({ pos: [tip[0] - dx * len / 2, tip[1], tip[2] - dz * len / 2], yaw });
  }
}

/** ScaleAnomaly（mode room）の倍率。無ければ 1 */
function roomScaleOf(p: GenParams): number {
  const ref = (p.def.modifiers ?? []).find((m) => m.id === 'ScaleAnomaly');
  if (!ref) return 1;
  const params = ref.params ?? {};
  if ((params.mode ?? 'room') !== 'room') return 1;
  const s = params.scale;
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : 1;
}

// ---------------------------------------------------------------- 入口

export function dressMythic(L: RoomLayout, p: GenParams, rng: Rng): void {
  if (L.footprint.length === 0) return;
  const c = mkCtx(L, p, rng.fork(p.def.id));
  switch (p.def.id) {
    case 'M01': dressM01(c); break;
    case 'M02': dressM02(c); break;
    case 'M03': dressM03(c); break;
    case 'M04': dressM04(c); break;
    case 'M07': dressM07(c); break;
    case 'M08': dressM08(c); break;
    case 'M11': dressM11(c); break;
    case 'M12': dressM12(c); break;
    case 'M13': dressM13(c); break;
    case 'M14': dressM14(c); break;
    case 'M16': dressM16(c); break;
    case 'M17': dressM17(c); break;
    case 'M18': dressM18(c); break;
    case 'M19': dressM19(c); break;
    default: return;
  }
  dropEmptyInstances(L);
}

// ---------------------------------------------------------------- M01 地図室

/** SelfMap（M01）が地図板を掛ける壁面スロットを同じ規則で先読みする（板の幅 3.0 → 2.4 → 1.8）。この区間には何も置かない */
function selfMapReserve(L: RoomLayout): { dir: Dir; coord: number; t: number; half: number } | null {
  const SIGN_Y = 0.55, SIGN_H = 0.9 / 4, ASPECT = 1024 / 580;
  for (const width of [3.0, 2.4, 1.8]) {
    const maxH = L.height - (SIGN_Y + SIGN_H / 2 + 0.1) - 0.15;
    const ph = Math.min(width / ASPECT, maxH);
    if (ph < 0.8) continue;
    const y = SIGN_Y + SIGN_H / 2 + 0.1 + ph / 2;
    const slot = wallSlots(L, { width: width + 0.2, height: ph + SIGN_H + 0.4, y: (y + SIGN_Y) / 2, orderFromEntry: false, max: 1, socketClearance: 0.6, depth: 1.2 })[0];
    if (!slot) continue;
    return { dir: slot.span.edge.dir, coord: slot.span.edge.coord, t: slot.t, half: width / 2 + 0.6 };
  }
  return null;
}

function dressM01(c: Ctx): void {
  const { L, rng, h } = c;
  stripIslands(c);
  // 1) 制御卓（机 + CRT + 椅子）: 入口側の壁を優先（SelfMap は入口から遠い壁を選ぶ）
  const order = [...c.faces].sort((a, b) => (a.dir === 2 ? -1 : b.dir === 2 ? 1 : (a.dir === 0 ? 1 : b.dir === 0 ? -1 : 0)));
  let deskDone = false;
  for (const f of order) {
    if (deskDone) break;
    for (const run of faceRuns(c, f, { pad: 0.7 }).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))) {
      const len = run[1] - run[0];
      if (len < 1.9) continue;
      const deskW = Math.min(2.2, len - 0.3);
      const at = run[0] + (len - deskW) / 2;
      const unit: Box[] = [alongFace(f, at, deskW, 0.06, 0.76, 0, 0.72, 'furnitureDark', true)];
      const n = deskW >= 1.9 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const cx = at + deskW / 2 + (n === 2 ? (k === 0 ? -0.5 : 0.5) : 0);
        unit.push(alongFace(f, cx - 0.21, 0.42, 0.2, 0.6, 0.72, 1.1, 'furnitureLight', false));
        unit.push(alongFace(f, cx - 0.17, 0.34, 0.6, 0.607, 0.78, 1.04, 'screenDark', false));
        unit.push(alongFace(f, cx - 0.22, 0.44, 0.62, 0.76, 0.72, 0.745, 'furnitureLight', false));
      }
      if (!placeUnit(c, unit)) continue;
      // 椅子（机の前。置けなければ無し）
      const cc = facePos(f, at + deskW / 2 + (n === 2 ? -0.5 : 0), 0.76 + 0.4, 0);
      const chairBoxes: Box[] = [];
      chair(chairBoxes, cc[0], cc[2], f.dir);
      placeUnit(c, chairBoxes);
      deskDone = true;
      break;
    }
  }
  // 2) SelfMap の地図板の位置を先読みし、その壁面は空けておく
  const reserve = selfMapReserve(L);
  // 3) 壁一面の地図格子: 白い製図紙（untextured の箔）+ 青い細線・部屋の輪郭・出入口の赤点（全部 instances。箱は製図紙だけ）
  const sheetY0 = 0.85, sheetY1 = h - 0.25;
  const vBars = inst(c, 'plasticBlue', [0.012, sheetY1 - sheetY0 - 0.1, 0.006]);
  const hBars = inst(c, 'plasticBlue', [0.5, 0.012, 0.006]);
  const th = 0.028;
  const thick = new Map<string, InstanceSpec>();
  const bar = (w: number, hh: number): InstanceSpec => {
    const key = `${w}x${hh}`;
    let s = thick.get(key);
    if (!s) { s = inst(c, 'plasticBlue', [w, hh, 0.006]); thick.set(key, s); }
    return s;
  };
  const dots = inst(c, 'plasticRed', [0.05, 0.05, 0.009]);
  let outlines = 0;
  for (const f of c.faces) {
    let runs = faceRuns(c, f, { pad: 0.35, depth: 0.3, y0: sheetY0, y1: sheetY1 });
    if (reserve && f.dir === reserve.dir && Math.abs(f.coord - reserve.coord) < 0.05) runs = subtractRuns(runs, [[reserve.t - reserve.half, reserve.t + reserve.half]]);
    for (const [p0, q0] of runs) {
      if (q0 - p0 < 1.0) continue;
      if (!add(c, [alongFace(f, p0, q0 - p0, 0.004, 0.01, sheetY0, sheetY1, 'untextured', false)])) continue;
      const yaw = faceYaw(f);
      // 格子 0.5 m
      for (let t = p0 + 0.25; t <= q0 - 0.2; t += 0.5) vBars.transforms.push({ pos: facePos(f, t, 0.013, sheetY0 + 0.05), yaw });
      for (let y = sheetY0 + 0.05; y <= sheetY1 - 0.06; y += 0.5) {
        for (let t = p0 + 0.25; t + 0.5 <= q0 - 0.2; t += 0.5) hBars.transforms.push({ pos: facePos(f, t + 0.25, 0.013, y), yaw });
      }
      // 部屋の輪郭（太い青線の矩形。幅 0.5 / 1.0 / 1.5 × 高 0.5 / 0.75 の組に量子化して InstancedMesh を共有する）
      const nRect = Math.min(5, Math.max(1, Math.round((q0 - p0) / 1.2)));
      for (let k = 0; k < nRect && outlines < 40; k++) {
        const rw = 0.5 * rng.int(1, 3), rh = rng.chance(0.5) ? 0.5 : 0.75;
        const t0 = p0 + 0.25 + 0.25 * rng.int(0, Math.max(0, Math.floor((q0 - p0 - 0.5 - rw) / 0.25)));
        const yy = sheetY0 + 0.05 + 0.25 * rng.int(0, Math.max(0, Math.floor((sheetY1 - sheetY0 - 0.15 - rh) / 0.25)));
        if (t0 + rw > q0 - 0.2 || yy + rh > sheetY1 - 0.05) continue;
        const d = 0.014;
        bar(rw, th).transforms.push({ pos: facePos(f, t0 + rw / 2, d, yy), yaw }, { pos: facePos(f, t0 + rw / 2, d, yy + rh - th), yaw });
        bar(th, rh).transforms.push({ pos: facePos(f, t0 + th / 2, d, yy), yaw }, { pos: facePos(f, t0 + rw - th / 2, d, yy), yaw });
        // 出入口の印（辺の途中の赤い点）
        if (rng.chance(0.5)) dots.transforms.push({ pos: facePos(f, t0 + rw * rng.float(0.2, 0.8), 0.015, yy - 0.01), yaw });
        outlines++;
      }
    }
  }
}

// ---------------------------------------------------------------- M02 未記録室

function dressM02(c: Ctx): void {
  const { L, rng, h } = c;
  stripIslands(c);
  recolorShell(c, { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark' });
  // 入口から最も遠い面に「記録されていません」、その面の両端（隅）からピクセルに溶ける
  const faces = [...c.faces].filter((f) => faceLen(f) >= 2.4).sort((a, b) => faceDistFromEntry(c, b) - faceDistFromEntry(c, a));
  const target = faces[0] ?? c.faces[0];
  if (!target) return;
  let signAt0: number | null = null;
  const run = longest(faceRuns(c, target, { pad: 0.6, y0: 1.2, y1: 2.1 }));
  if (run && run[1] - run[0] >= 1.6) {
    signAt0 = (run[0] + run[1]) / 2;
    sign(c, target, signAt0, 1.62, Math.min(1.8, run[1] - run[0] - 0.2), 'この部屋は記録されていません', { sub: 'THIS ROOM IS NOT RECORDED', color: 0x3a3d42, background: 0xd9d9d3 });
  }
  const cube = inst(c, 'void', [0.16, 0.16, 0.16]);
  const grey = inst(c, 'wallDark', [0.16, 0.16, 0.16]);
  const pale = inst(c, 'columnConcrete', [0.12, 0.12, 0.12]);
  const hole = inst(c, 'void', [0.32, 0.32, 0.012]);
  let count = 0;
  const MAX = 340;
  const pick = (u: number) => (u < 0.5 ? cube : u < 0.8 ? grey : pale);
  /** 面 f を、focus（辺に沿った座標）に近いほど密に崩す */
  const dissolve = (f: Face, focus: number[], reach: number) => {
    const yaw = faceYaw(f);
    const runs = faceRuns(c, f, { pad: 0.5, depth: 0.25, y0: 0.1, y1: h - 0.05, corner: 0.16 });
    for (const [p0, q0] of runs) {
      for (let t = p0 + 0.08; t < q0 - 0.08; t += 0.16) {
        const d = Math.min(...focus.map((x) => Math.abs(x - t)));
        const u = Math.max(0, 1 - d / reach);
        if (u <= 0) continue;
        for (let y = 0.16; y < h - 0.16; y += 0.16) {
          if (count >= MAX) return;
          if (signAt0 !== null && f === target && Math.abs(t - signAt0) < 1.1 && y > 1.2 && y < 2.1) continue;
          const pTop = u * u * (0.35 + 0.65 * (y / h));
          const r = rng.next();
          if (r < pTop * 0.55) {
            // 壁から少し飛び出した立方体
            pick(rng.next()).transforms.push({ pos: facePos(f, t, -0.02, y - 0.08), yaw });
            count++;
          } else if (r < pTop * 0.75) {
            hole.transforms.push({ pos: facePos(f, t, 0.006, y - 0.16), yaw });
            count++;
          }
        }
      }
      // 壁から離れて漂う立方体（隅の近く）
      for (const x of focus) {
        if (x < p0 - 0.5 || x > q0 + 0.5) continue;
        const n = rng.int(3, 6);
        for (let k = 0; k < n && count < MAX; k++) {
          const t = x + rng.float(-1.2, 1.2);
          if (t < p0 || t > q0) continue;
          pick(rng.next()).transforms.push({ pos: facePos(f, t, rng.float(0.2, 0.9), rng.float(0.3, h - 0.5)), yaw: rng.float(0, Math.PI) });
          count++;
        }
      }
    }
  };
  const reach = Math.min(3.5, Math.max(1.6, faceLen(target) * 0.42));
  dissolve(target, [target.a0, target.a1], reach);
  // 隣接する面（同じ隅を共有する）も隅から 1.5 m ほど崩す
  for (const f of c.faces) {
    if (f === target || f.horizontal === target.horizontal) continue;
    // 直交する面の端のうち、対象の壁の外面座標に一致する側が共有する隅
    const cornerT = Math.abs(f.a0 - target.coord) < 0.3 ? f.a0 : Math.abs(f.a1 - target.coord) < 0.3 ? f.a1 : null;
    if (cornerT === null) continue;
    dissolve(f, [cornerT], 1.6);
  }
  // 床・天井の隅にも半分沈んだ立方体
  const corners: [number, number][] = [];
  for (const x of [target.a0 + 0.2, target.a1 - 0.2]) {
    const q = facePos(target, x, 0.2, 0);
    corners.push([q[0], q[2]]);
  }
  for (const [cx, cz] of corners) {
    for (let k = 0; k < 14 && count < MAX; k++) {
      const x = cx + rng.float(-1.4, 1.4), z = cz + rng.float(-1.4, 1.4);
      if (!inFootprint(c.rects, x, z, WALL_T + 0.1)) continue;
      const onCeiling = rng.chance(0.4);
      pick(rng.next()).transforms.push({ pos: [x, onCeiling ? h - 0.1 : -0.09, z], yaw: rng.float(0, Math.PI) });
      count++;
    }
  }
  L.palette = { ...L.palette, ambient: 0x7a7c80 };
}

// ---------------------------------------------------------------- M03 移動座標室

function dressM03(c: Ctx): void {
  const { rng } = c;
  let x = rng.int(-2400, 2400), y = rng.int(-80, 140), z = rng.int(-900, 900);
  let placed = 0;
  for (const r of c.rects) {
    if (placed >= 4) break;
    // このセグメントの長い側面
    const longAxisX = r.x1 - r.x0 >= r.z1 - r.z0;
    const sides = c.faces.filter((f) => f.horizontal === longAxisX && onRect(f, r));
    const cands: { f: Face; run: Run }[] = [];
    for (const f of sides) for (const run of faceRuns(c, f, { pad: 0.9, depth: 0.4, y0: 1.0, y1: 2.3 })) if (run[1] - run[0] >= 2.0) cands.push({ f, run });
    cands.sort((a, b) => (b.run[1] - b.run[0]) - (a.run[1] - a.run[0]));
    const pick = cands[0];
    if (!pick) continue;
    const { f, run } = pick;
    const spots = run[1] - run[0] >= 9 ? [run[0] + (run[1] - run[0]) / 3, run[0] + (run[1] - run[0]) * 2 / 3] : [(run[0] + run[1]) / 2];
    for (const t of spots) {
      if (placed >= 4) break;
      const housing: Box[] = [
        alongFace(f, t - 0.86, 1.72, 0.02, 0.07, 1.22, 1.9, 'screenDark', false),
        alongFace(f, t + 0.7, 0.06, 0.07, 0.085, 1.8, 1.84, 'ledBlue', false),
      ];
      if (!add(c, housing)) return;
      sign(c, f, t, 1.56, 1.6, `現在地  X: ${x}  Y: ${y}  Z: ${z}`, { kind: 'emissive', sub: '→ 移動中…', color: 0xdff3ff, background: 0x04070c, offset: 0.075 });
      placed++;
      // 次の表示板では座標がずれている
      x += rng.int(3, 40) * (rng.chance(0.5) ? 1 : -1);
      z += rng.int(2, 25) * (rng.chance(0.5) ? 1 : -1);
      if (rng.chance(0.3)) y += rng.int(-6, 6);
    }
  }
}

/** 面 f が矩形 r の辺か */
function onRect(f: Face, r: Rect): boolean {
  if (f.horizontal) return (Math.abs(f.coord - r.z0) < 0.01 || Math.abs(f.coord - r.z1) < 0.01) && f.a0 >= r.x0 - 0.01 && f.a1 <= r.x1 + 0.01;
  return (Math.abs(f.coord - r.x0) < 0.01 || Math.abs(f.coord - r.x1) < 0.01) && f.a0 >= r.z0 - 0.01 && f.a1 <= r.z1 + 0.01;
}

// ---------------------------------------------------------------- M04 偽帰還口

function dressM04(c: Ctx): void {
  const { L, h } = c;
  stripIslands(c);
  const fwd = forwardSocket(L);
  const fwdFace = fwd ? faceOfSocket(c, fwd) : undefined;
  // 偽の出口（開いた扉の向こうに晴れた住宅街。全天球の写真の投影）: 進行用扉と同じ壁を優先し、無ければ入口から遠い壁
  const others = c.faces.filter((f) => f !== fwdFace && !(c.entry && c.entry.type !== 'hole' && f.dir === 2)).sort((a, b) => faceDistFromEntry(c, b) - faceDistFromEntry(c, a));
  const cands = fwdFace ? [fwdFace, ...others] : others;
  let dioramaFace: Face | null = null;
  let dioramaT = 0;
  for (const f of cands) {
    const runs = faceRuns(c, f, { pad: 0.9, depth: 0.5, y0: 0, y1: 2.4 }).filter((r) => r[1] - r[0] >= 1.5);
    if (!runs.length) continue;
    let run = runs[0];
    if (fwd && f === fwdFace) {
      const ft = along(fwd.dir, fwd.pos[0], fwd.pos[2]);
      run = runs.sort((a, b) => Math.abs((a[0] + a[1]) / 2 - ft) - Math.abs((b[0] + b[1]) / 2 - ft))[0];
    } else run = longest(runs)!;
    const t = (run[0] + run[1]) / 2;
    const dw = 0.96, dh = Math.min(2.08, h - 0.4);
    const unit: Box[] = [
      alongFace(f, t - dw / 2 - 0.1, 0.1, 0, 0.16, 0, dh + 0.1, 'trim', false),
      alongFace(f, t + dw / 2, 0.1, 0, 0.16, 0, dh + 0.1, 'trim', false),
      alongFace(f, t - dw / 2 - 0.1, dw + 0.2, 0, 0.16, dh, dh + 0.1, 'trim', false),
      // 扉の向こうの外（第22回）: 全天球の写真を地面の平らなドームに投影する板（src/render/OutsideView.ts）。見る位置で外の遠近が変わる。
      // 旧: 空の箔・草・アスファルト・白い箱の家を 5 cm の厚みに重ねた絵（仮の素材に見えた）
      alongFace(f, t - dw / 2, dw, 0.004, 0.012, 0.0, dh, 'outsideView', false),
      // 敷居（外の地面と室内の床の境）
      alongFace(f, t - dw / 2, dw, 0.012, 0.16, 0.0, 0.015, 'floorConcrete', false),
    ];
    if (!add(c, unit)) return;
    // 開いた扉のパネル（枡に直交して室内へ。扉前・動線に掛かるなら置かない）
    placeUnit(c, [alongFace(f, t + dw / 2 - 0.04, 0.04, 0.16, 0.16 + dw - 0.06, 0.02, dh - 0.02, 'doorWood', true)]);
    dioramaFace = f;
    dioramaT = t;
    // 日射（偽の外から室内へ低く差す）と空の環境光、扉前の明かり
    const n = dirVec(((f.dir + 2) % 4) as Dir);
    const alt = (32 * Math.PI) / 180;
    L.lighting = { ...(L.lighting ?? {}), directional: [...(L.lighting?.directional ?? []), { dir: [n[0] * Math.cos(alt), -Math.sin(alt), n[2] * Math.cos(alt)], color: 0xfff1d4, intensity: 0.85 }], skyAmbient: L.lighting?.skyAmbient ?? { color: 0xd6e4ff, intensity: 0.3 } };
    addLight(c, facePos(f, t, 0.7, Math.min(h - 0.3, 1.8)), 0xfff0d8, 0.9, 7);
    break;
  }
  // 「ここは、外ではありません。」: 偽出口と別の壁（無ければ同じ壁）
  const signFaces = c.faces.filter((f) => f !== dioramaFace).sort((a, b) => faceDistFromEntry(c, b) - faceDistFromEntry(c, a));
  for (const f of [...signFaces, ...(dioramaFace ? [dioramaFace] : [])]) {
    const runs = faceRuns(c, f, { pad: 0.6, y0: 1.3, y1: 2.1 }).filter((r) => r[1] - r[0] >= 1.6 && !(f === dioramaFace && Math.abs((r[0] + r[1]) / 2 - dioramaT) < 1.4));
    const run = longest(runs);
    if (!run) continue;
    sign(c, f, (run[0] + run[1]) / 2, 1.72, Math.min(1.7, run[1] - run[0] - 0.2), 'ここは、外ではありません。', { sub: 'ALMOST REAL.', color: 0x1f2328, background: 0xf4f1ea });
    break;
  }
  // 進行用扉の上に緑の「出口」
  if (fwd && fwdFace) {
    const top = fwd.pos[1] + (fwd.sill ?? 0) + fwd.height;
    if (h - top >= 0.28) sign(c, fwdFace, along(fwd.dir, fwd.pos[0], fwd.pos[2]), top + 0.06 + 0.075, 0.6, '出口', { kind: 'emissive', sub: 'EXIT' });
  }
  L.palette = { ...L.palette, ambient: 0xa4b2c6 };
}

// ---------------------------------------------------------------- M07 動くマップタイル

function dressM07(c: Ctx): void {
  const { L } = c;
  const r = c.rects[0];
  // 回廊と可動域の境界の黄線から内部フィールドの範囲を読む
  let fx0 = Infinity, fx1 = -Infinity, fz0 = Infinity, fz1 = -Infinity;
  for (let i = c.shell; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.mat !== 'yellowLine' || b.solid) continue;
    fx0 = Math.min(fx0, b.min[0]); fx1 = Math.max(fx1, b.max[0]); fz0 = Math.min(fz0, b.min[2]); fz1 = Math.max(fz1, b.max[2]);
  }
  if (!Number.isFinite(fx0) || fx1 - fx0 < 3 || fz1 - fz0 < 3) return;
  const spec = inst(c, 'plasticYellow', [0.42, 0.006, 0.07]);
  const west = (r.x0 + WALL_T + fx0) / 2, east = (fx1 + r.x1 - WALL_T) / 2, south = (r.z0 + WALL_T + fz0) / 2, north = (fz1 + r.z1 - WALL_T) / 2;
  const ok = (x: number, z: number) => !hitsZone(c.zones, box([x - 0.35, 0, z - 0.35], [x + 0.35, 0.3, z + 0.35], 'metal')) && !L.sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < 1.6);
  // 時計回り（上から見て）: 南辺 +x → 東辺 +z → 北辺 -x → 西辺 -z。heading は +x が 0、-z 方向が +π/2
  const edges: { from: [number, number]; to: [number, number]; heading: number }[] = [
    { from: [west, south], to: [east, south], heading: 0 },
    { from: [east, south], to: [east, north], heading: -Math.PI / 2 },
    { from: [east, north], to: [west, north], heading: Math.PI },
    { from: [west, north], to: [west, south], heading: Math.PI / 2 },
  ];
  for (const e of edges) {
    const len = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]);
    const n = Math.max(1, Math.floor(len / 3));
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      const x = e.from[0] + (e.to[0] - e.from[0]) * u, z = e.from[1] + (e.to[1] - e.from[1]) * u;
      if (!ok(x, z)) continue;
      chevron(spec, [x, 0.008, z], e.heading);
    }
  }
  // 入口脇の注意サイン
  const entryFace = c.entry && c.entry.type !== 'hole' ? faceOfSocket(c, c.entry) : undefined;
  if (entryFace && c.entry) {
    const et = along(c.entry.dir, c.entry.pos[0], c.entry.pos[2]);
    const runs = faceRuns(c, entryFace, { pad: 0.4, y0: 1.3, y1: 1.9 }).filter((q) => q[1] - q[0] >= 1.2).sort((a, b) => Math.abs((a[0] + a[1]) / 2 - et) - Math.abs((b[0] + b[1]) / 2 - et));
    if (runs[0]) {
      const q = runs[0];
      const t = q[0] + q[1] > 2 * et ? Math.min(q[1] - 0.6, Math.max(q[0] + 0.6, et + c.entry.width / 2 + 0.4 + 0.6)) : Math.max(q[0] + 0.6, Math.min(q[1] - 0.6, et - c.entry.width / 2 - 0.4 - 0.6));
      sign(c, entryFace, t, 1.6, 1.1, 'FLOOR IN MOTION', { kind: 'emissive', sub: '床が動きます', color: 0xffd23a, background: 0x141210 });
    }
  }
}

// ---------------------------------------------------------------- M08 不可能なショートカット

function dressM08(c: Ctx): void {
  const { L, rng, h } = c;
  stripIslands(c);
  recolorShell(c, { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark' });
  // 地下駐車場風の黄帯
  const before = L.boxes.length;
  wallBands(L, c.rects, L.sockets, [{ y0: 0.86, y1: 0.98, mat: 'yellowLine', depth: 0.012 }]);
  c.budget.boxes -= L.boxes.length - before;
  const fwd = forwardSocket(L);
  const f = fwd ? faceOfSocket(c, fwd) : undefined;
  if (fwd && f) {
    const t = along(fwd.dir, fwd.pos[0], fwd.pos[2]);
    const top = fwd.pos[1] + (fwd.sill ?? 0) + fwd.height;
    // 扉の上のランマに青空と街のシルエット（屋上へ出る扉）
    if (h - top >= 0.42) {
      const y0 = top + 0.14, y1 = h - 0.1;
      const unit: Box[] = [
        alongFace(f, t - 0.64, 1.28, 0.0, 0.06, y0 - 0.05, y1 + 0.05, 'metalDark', false),
        alongFace(f, t - 0.56, 1.12, 0.06, 0.07, y0, y1, 'skyDay', false),
        alongFace(f, t - 0.012, 0.024, 0.06, 0.09, y0, y1, 'metalDark', false),
      ];
      let u = t - 0.54;
      while (u + 0.1 < t + 0.54) {
        const bw = rng.float(0.1, 0.22), bh = rng.float(0.06, Math.min(0.2, (y1 - y0) * 0.55));
        unit.push(alongFace(f, u, Math.min(bw, t + 0.55 - u), 0.07, 0.08, y0, y0 + bh, 'metalDark', false));
        u += bw + rng.float(0.02, 0.08);
      }
      add(c, unit);
      // 空の色の環境光と、ランマの下の青白い点灯（平行光は焼き込みの遮蔽判定が増えて構築が遅くなるので使わない。ランマは小さいので点光源で足りる）
      L.lighting = { ...(L.lighting ?? {}), skyAmbient: L.lighting?.skyAmbient ?? { color: 0xbcd0f0, intensity: 0.2 } };
      addLight(c, facePos(f, t, 0.5, h - 0.3), 0xd8e6ff, 0.7, 6);
    }
    // 扉の脇に「屋上」
    const runs = faceRuns(c, f, { pad: 0.25, y0: 1.7, y1: 2.1 }).filter((q) => q[1] - q[0] >= 0.9);
    const side = runs.sort((a, b) => Math.abs((a[0] + a[1]) / 2 - t) - Math.abs((b[0] + b[1]) / 2 - t))[0];
    if (side) {
      const st = side[0] + side[1] > 2 * t ? Math.min(side[1] - 0.45, Math.max(side[0] + 0.45, t + fwd.width / 2 + 0.3 + 0.4)) : Math.max(side[0] + 0.45, Math.min(side[1] - 0.45, t - fwd.width / 2 - 0.3 - 0.4));
      sign(c, f, st, 1.9, 0.8, '屋上 ↑', { kind: 'emissive', sub: 'ROOFTOP', color: 0xffffff, background: 0x1b2a44 });
    }
  }
  // 他の壁に「B1」
  let n = 0;
  for (const g of [...c.faces].filter((x) => x !== f).sort((a, b) => faceLen(b) - faceLen(a))) {
    if (n >= 2) break;
    const run = longest(faceRuns(c, g, { pad: 0.5, y0: 1.5, y1: 2.05 }));
    if (!run || run[1] - run[0] < 1.0) continue;
    sign(c, g, (run[0] + run[1]) / 2, 1.78, 0.6, 'B1', { color: 0xf0f0e8, background: 0x2a2c2e });
    n++;
  }
}

// ---------------------------------------------------------------- M11 多重扉室

function dressM11(c: Ctx): void {
  const { L, h } = c;
  const tiers: number[] = [0];
  if (h >= 6.2) tiers.push(3.75);
  if (h >= 8.4) tiers.push(6.0);
  const panel = inst(c, 'doorWood', [0.9, 2.05, 0.03]);
  const frame = inst(c, 'trim', [1.03, 2.14, 0.05]);
  const knob = inst(c, 'metal', [0.1, 0.03, 0.05]);
  // 扉灯: 発光箔は SurfaceLighting の面光源（器具）になり、吹抜では 1 枚あたり焼き込みが約 2.5 ms 増える（122 灯で構築 37 → 112 ms）。
  // そこで扉灯は `kind: 'glowOnly'`（担当 P3。SurfaceGeometry.isGlowOnly）の箔にして器具に数えず、見た目だけ光らせる。
  // 壁の暖色は下の点光源 2 灯に任せる。faceRuns（面の手前 0.5 m の箱で区間を切る）に影響しないよう、箔は全ての段を置いた後にまとめて足す。
  // 上階の足元の床線は箱ではなく扉ごとの InstancedMesh（長い箔は 1.25 m 刻みの頂点が増えて焼き込みが重い）
  const lamps: Box[] = [];
  const pitch = 3.0;
  const ledge = inst(c, 'trim', [pitch, 0.06, 0.14]);
  let numbers = 0;
  const faces = [...c.faces].sort((a, b) => faceLen(b) - faceLen(a));
  tiers.forEach((y0, ti) => {
    let seq = 1;
    for (const f of faces) {
      const runs = ti === 0
        ? faceRuns(c, f, { pad: 1.3, depth: 0.5, y0: 0, y1: 2.4 })
        : faceRuns(c, f, { pad: 0.3, depth: 0.5, y0, y1: y0 + 2.3, corner: 0.6 });
      const yaw = faceYaw(f);
      for (const [p0, q0] of runs) {
        const len = q0 - p0;
        const n = Math.floor((len - 0.6) / pitch);
        if (n <= 0) continue;
        const start = (p0 + q0) / 2 - ((n - 1) * pitch) / 2;
        for (let i = 0; i < n; i++) {
          const t = start + i * pitch;
          frame.transforms.push({ pos: facePos(f, t, 0.025, y0), yaw });
          panel.transforms.push({ pos: facePos(f, t, 0.065, y0 + 0.02), yaw });
          knob.transforms.push({ pos: facePos(f, t + 0.35, 0.105, y0 + 1.0), yaw });
          // 上階の扉の足元に床線
          if (ti > 0) ledge.transforms.push({ pos: facePos(f, t, 0.07, y0 - 0.06), yaw });
          // 扉灯（旧 InstancedMesh の位置 = 底面中心 t − 0.745、面から 0.06、高さ 1.76 と同じ箔 0.14 × 0.24 × 0.06）
          lamps.push({ ...alongFace(f, t - 0.45 - 0.065 - 0.23 - 0.07, 0.14, 0.03, 0.09, y0 + 1.76, y0 + 2.0, 'lightWarm', false), kind: 'glowOnly' });
          // 番号札は 1 階だけ、1 枚おき（SignAtlas 1 枚 = 16 セルに収める）
          if (ti === 0 && i % 2 === 1 && numbers < 16) {
            if (sign(c, f, t, y0 + 2.31, 0.3, `${ti + 2}${String(seq).padStart(2, '0')}`, { offset: 0.03 })) numbers++;
          }
          seq++;
        }
      }
    }
  });
  // 扉灯の箔をまとめて足す（非ソリッド。予算を超える分は落とす）
  if (lamps.length) add(c, lamps.slice(0, Math.max(0, c.budget.boxes)));
  // 上階の扉灯の温もり（2 灯）
  if (tiers.length > 1) {
    for (const f of faces.slice(0, 2)) {
      const t = (f.a0 + f.a1) / 2;
      addLight(c, facePos(f, t, 1.4, tiers[1] + 1.2), 0xffc98a, 0.9, 14);
    }
  }
  void L;
}

// ---------------------------------------------------------------- M12 巨大 Common

function dressM12(c: Ctx): void {
  const s = roomScaleOf(c.p);
  /** 拡大後の壁面からの距離 d_post を、拡大前の室内面基準（alongFace の d）に写す */
  const dpre = (dPost: number) => (WALL_T + dPost) / s - WALL_T;
  const r = c.rects[0];
  const longAxisX = r.x1 - r.x0 >= r.z1 - r.z0;
  const sides = c.faces.filter((f) => f.horizontal === longAxisX && onRect(f, r)).sort((a, b) => faceDistFromEntry(c, a) - faceDistFromEntry(c, b));
  let signDone = false, benchDone = false;
  for (const f of sides) {
    const runs = faceRuns(c, f, { pad: 0.6, depth: 0.4, y0: 0, y1: 2.4 }).filter((q) => q[1] - q[0] >= 1.2).sort((a, b) => a[0] - b[0]);
    for (const run of runs) {
      // 入口から拡大後 3.6 m ほど入った位置（拡大前 0.9 m）。区間に収まらなければ区間の端寄り
      const near = c.entry ? along(f.dir, c.entry.pos[0], c.entry.pos[2]) + 0.9 : (run[0] + run[1]) / 2;
      const t = Math.min(run[1] - 0.5, Math.max(run[0] + 0.5, near));
      if (!signDone) {
        // 人の寸法（拡大後 1.6 m 幅・目の高さ）の小さなサイン
        sign(c, f, t, 1.6 / s, 1.6 / s, 'いつもの通路が、こんなにも大きい。', { sub: 'THE USUAL HALLWAY. THIS BIG.', offset: dpre(0.012), color: 0x22252b, background: 0xf2efe6 });
        signDone = true;
        continue;
      }
      if (!benchDone) {
        // 等身大の連結椅子（3 席）。拡大前は 1/s の寸法で壁厚の中まで入る（margin < 0）
        const t0 = t - 0.8 / s;
        const unit: Box[] = [
          alongFace(f, t0, 1.6 / s, dpre(0.1), dpre(0.55), 0.42 / s, 0.48 / s, 'seatBlue', true),
          alongFace(f, t0, 1.6 / s, dpre(0.08), dpre(0.16), 0.48 / s, 0.86 / s, 'seatBlue', true),
          alongFace(f, t0 + 0.1 / s, 1.4 / s, dpre(0.26), dpre(0.34), 0, 0.42 / s, 'metalDark', true),
        ];
        if (placeUnit(c, unit, { margin: -WALL_T })) benchDone = true;
      }
      if (signDone && benchDone) break;
    }
    if (signDone && benchDone) break;
  }
}

// ---------------------------------------------------------------- M13 未描画空間

function dressM13(c: Ctx): void {
  // RenderStyle（untextured）が内装・照明・サインを全部捨てるので何も足さない。床際の接触陰影・隅の AO も切って純白の虚空にする
  c.L.lighting = { ...(c.L.lighting ?? {}), occlusion: false };
}

// ---------------------------------------------------------------- M14 照明一本の虚空

function dressM14(c: Ctx): void {
  const { L } = c;
  // Bridge の手すり壁（metal 1.05 m）を暗い金属にし、天端に笠木、支柱を等間隔に
  const posts = inst(c, 'metalDark', [0.05, 1.0, 0.05]);
  const rails: Box[] = [];
  for (let i = 0; i < c.shell; i++) {
    const b = L.boxes[i];
    if (b.mat !== 'metal' || !b.solid || b.min[1] > 0.01 || b.max[1] - b.min[1] > 1.3) continue;
    L.boxes[i] = { ...b, mat: 'metalDark' };
    const alongX = b.max[0] - b.min[0] >= b.max[2] - b.min[2];
    const top = b.max[1];
    const len = alongX ? b.max[0] - b.min[0] : b.max[2] - b.min[2];
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    const inwardSign = alongX ? (inFootprint(c.rects, cx, cz + 0.4, 0.05) ? 1 : -1) : (inFootprint(c.rects, cx + 0.4, cz, 0.05) ? 1 : -1);
    // 笠木: 壁厚の上に載せ、室内側だけ 4 cm 張り出す（外側は足跡の外になるので出さない）
    const inn = inwardSign > 0 ? 0.04 : 0, outn = inwardSign > 0 ? 0 : 0.04;
    rails.push(alongX ? box([b.min[0], top, b.min[2] - outn], [b.max[0], top + 0.05, b.max[2] + inn], 'metalDark', false) : box([b.min[0] - outn, top, b.min[2]], [b.max[0] + inn, top + 0.05, b.max[2]], 'metalDark', false));
    // 支柱: 室内側の面に沿って 2 m ごと
    const n = Math.max(1, Math.round(len / 2));
    for (let k = 0; k < n; k++) {
      const a = (alongX ? b.min[0] : b.min[2]) + (len * (k + 0.5)) / n;
      const pos: Vec3 = alongX ? [a, 0, cz + inwardSign * (0.075 + 0.03)] : [cx + inwardSign * (0.075 + 0.03), 0, a];
      posts.transforms.push({ pos, yaw: 0 });
    }
  }
  add(c, rails);
}

// ---------------------------------------------------------------- M16 没部屋博物館

function dressM16(c: Ctx): void {
  const { L, rng, h } = c;
  stripIslands(c);
  const entry = c.entry;
  const r = c.rects[0];
  // 1) 展示ケース: 台座 + ガラス + 没部屋の小さな模型 + 名札。オミットされた定義（E10 / M05 / M06 / M10 / M15 / M20）を展示する
  const exhibits = OMITTED_ROOMS.filter((d) => d.id !== c.p.def.id);
  const cands: { x: number; z: number; d: number }[] = [];
  const ex = entry?.pos[0] ?? (r.x0 + r.x1) / 2, ez = entry?.pos[2] ?? r.z0;
  for (let x = r.x0 + 2.4; x <= r.x1 - 2.4; x += 3.0) {
    for (let z = r.z0 + 2.4; z <= r.z1 - 2.4; z += 3.0) {
      const d = Math.hypot(x - ex, z - ez);
      if (d < 4.5) continue;
      cands.push({ x, z, d });
    }
  }
  cands.sort((a, b) => a.d - b.d);
  const placed: { x: number; z: number }[] = [];
  const signDir: Dir = entry && entry.type !== 'hole' ? entry.dir : 2;
  const n = dirVec(signDir);
  for (const cand of cands) {
    if (placed.length >= exhibits.length) break;
    const { x, z } = cand;
    if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 2.9)) continue;
    const k = placed.length;
    const def = exhibits[k];
    const longX = rng.chance(0.5);
    const mw = longX ? rng.float(0.34, 0.44) : rng.float(0.2, 0.28), md = longX ? rng.float(0.2, 0.28) : rng.float(0.34, 0.44);
    const unit: Box[] = [
      box([x - 0.35, 0, z - 0.35], [x + 0.35, 0.85, z + 0.35], 'furnitureDark', true),
      box([x - 0.37, 0.85, z - 0.37], [x + 0.37, 0.875, z + 0.37], 'metalDark', false),
      box([x - 0.31, 0.905, z - 0.31], [x + 0.31, 1.42, z + 0.31], 'glass', false),
      box([x - 0.27, 0.875, z - 0.27], [x + 0.27, 0.905, z + 0.27], 'untextured', false),
      // 模型: 床 + 3 方の壁（手前は開く）+ 小さな扉
      box([x - mw / 2, 0.905, z - md / 2], [x + mw / 2, 0.915, z + md / 2], 'floorCarpetGrey', false),
      box([x - mw / 2, 0.915, z + md / 2 - 0.012], [x + mw / 2, 1.04, z + md / 2], 'wallDark', false),
      box([x - mw / 2, 0.915, z - md / 2], [x - mw / 2 + 0.012, 1.04, z + md / 2], 'wallDark', false),
      box([x + mw / 2 - 0.012, 0.915, z - md / 2], [x + mw / 2, 1.04, z + md / 2], 'wallDark', false),
      box([x - 0.02, 0.915, z + md / 2 - 0.016], [x + 0.02, 0.985, z + md / 2 - 0.012], 'doorWood', false),
    ];
    if (!placeUnit(c, unit, { clearance: 0.9 })) continue;
    placed.push({ x, z });
    // 名札（入口の側を向く面）
    const spos: Vec3 = [x + n[0] * (0.35 + 0.012), 0.6, z + n[2] * (0.35 + 0.012)];
    if (signCount(L) < SIGN_CAP) (L.signs ??= []).push({ text: def.name, sub: `${def.category}・没`, pos: spos, dir: signDir, width: 0.56, kind: 'plate', color: 0x2a2c30, background: 0xe9e6dc });
    if (k < 2) addLight(c, [x, Math.min(h - 0.3, 2.7), z], 0xfff0d8, 0.7, 5);
  }
  // 2) タイトル壁（入口の正面に自立する暗い壁。置けなければ壁面へ）
  let titled = false;
  if (entry && entry.type !== 'hole') {
    const inward = dirVec(((entry.dir + 2) % 4) as Dir);
    const cx = entry.pos[0] + inward[0] * 3.4, cz = entry.pos[2] + inward[2] * 3.4;
    const alongX = entry.dir === 0 || entry.dir === 2;
    const wall = alongX ? box([cx - 1.5, 0, cz - 0.075], [cx + 1.5, 2.4, cz + 0.075], 'wallDark', true) : box([cx - 0.075, 0, cz - 1.5], [cx + 0.075, 2.4, cz + 1.5], 'wallDark', true);
    if (placeUnit(c, [wall], { clearance: 0.8 })) {
      const front: Vec3 = [cx - inward[0] * (0.075 + 0.012), 1.75, cz - inward[2] * (0.075 + 0.012)];
      const back: Vec3 = [cx + inward[0] * (0.075 + 0.012), 1.75, cz + inward[2] * (0.075 + 0.012)];
      (L.signs ??= []).push({ text: 'SCRAPPED SPACES', sub: 'つくられるはずだった世界たち。', pos: front, dir: entry.dir, width: 2.4, kind: 'plate', color: 0xf2eee6, background: 0x14161c });
      (L.signs ??= []).push({ text: '没部屋博物館', sub: 'MUSEUM OF SCRAPPED ROOMS', pos: back, dir: ((entry.dir + 2) % 4) as Dir, width: 1.6, kind: 'plate', color: 0xf2eee6, background: 0x14161c });
      titled = true;
    }
  }
  if (!titled) {
    // GraphReference（M16）の額縁スロットを先読みして避け、空いた壁にタイトルを貼る
    const slots = wallSlots(L, { width: 1.5, height: 0.9 + 0.225 + 0.5, y: (1.1 + 0.225 / 2 + 0.12 + 0.45 + 1.1) / 2, spacing: 2.4, max: 12, socketClearance: 0.8 });
    for (const f of [...c.faces].sort((a, b) => faceDistFromEntry(c, b) - faceDistFromEntry(c, a))) {
      const cuts: Run[] = slots.filter((s) => s.span.edge.dir === f.dir && Math.abs(s.span.edge.coord - f.coord) < 0.05).map((s) => [s.t - 0.95, s.t + 0.95]);
      const run = longest(subtractRuns(faceRuns(c, f, { pad: 0.6, y0: 1.4, y1: 2.2 }), cuts));
      if (!run || run[1] - run[0] < 2.6) continue;
      sign(c, f, (run[0] + run[1]) / 2, 1.8, 2.4, 'SCRAPPED SPACES', { sub: 'つくられるはずだった世界たち。', color: 0xf2eee6, background: 0x14161c });
      break;
    }
  }
}

// ---------------------------------------------------------------- M17 旧バージョン階

function dressM17(c: Ctx): void {
  const { L, rng } = c;
  // 装飾扉の板は旧材質（placeholder）。本物の扉は palette.door のまま（唯一の手掛かり）
  for (let i = c.shell; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    const thin = Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) <= 0.035;
    if (!b.solid && b.mat === L.palette.door && thin && b.max[1] - b.min[1] >= 1.8) L.boxes[i] = { ...b, mat: 'placeholder' };
  }
  // サイン: 入口の近くに v0.1.0、最も長い空きに一文、残りに TODO 札
  const spots: { f: Face; run: Run; d: number }[] = [];
  for (const f of c.faces) for (const run of faceRuns(c, f, { pad: 0.9, depth: 0.4, y0: 1.2, y1: 2.2 })) if (run[1] - run[0] >= 1.2) spots.push({ f, run, d: c.entry ? Math.hypot(facePos(f, (run[0] + run[1]) / 2, 0, 0)[0] - c.entry.pos[0], facePos(f, (run[0] + run[1]) / 2, 0, 0)[2] - c.entry.pos[2]) : 0 });
  spots.sort((a, b) => a.d - b.d);
  const first = spots[0];
  if (first) sign(c, first.f, (first.run[0] + first.run[1]) / 2, 1.75, 0.8, 'v0.1.0', { color: 0x202020, background: 0xf0f0e8 });
  const rest = spots.slice(1).sort((a, b) => (b.run[1] - b.run[0]) - (a.run[1] - a.run[0]));
  if (rest[0] && rest[0].run[1] - rest[0].run[0] >= 2.2) sign(c, rest[0].f, (rest[0].run[0] + rest[0].run[1]) / 2, 1.7, 2.2, 'あの頃の、まだ完成していなかった世界。', { sub: 'BUILD 0.1.0 — UNFINISHED', color: 0x202020, background: 0xf0f0e8 });
  const todo = ['TODO: 壁材', 'PLACEHOLDER', '// TODO: door', 'MISSING TEXTURE'];
  let k = 0;
  for (const s of rest.slice(1, 4)) sign(c, s.f, (s.run[0] + s.run[1]) / 2, 1.85, 0.7, todo[k++ % todo.length], { color: 0x808080, background: 0xffffff });
  // まだ置かれていないプロップ（白い低ポリの箱）を通路の脇に 2〜3 個
  const r = c.rects[0];
  const longAxisX = r.x1 - r.x0 >= r.z1 - r.z0;
  const sides = c.faces.filter((f) => f.horizontal === longAxisX && onRect(f, r));
  let n = 0;
  for (const f of sides) {
    for (const run of faceRuns(c, f, { pad: 1.2, depth: 0.9, y0: 0, y1: 1.0 })) {
      if (n >= 3 || run[1] - run[0] < 2.0) continue;
      const t = rng.float(run[0] + 0.6, run[1] - 0.6);
      const sz = rng.float(0.5, 0.8);
      if (placeUnit(c, [alongFace(f, t - sz / 2, sz, 0.08, 0.08 + sz, 0, sz, 'untextured', true)])) n++;
    }
  }
}

// ---------------------------------------------------------------- M18 天候記憶室

/** シェル（床・天井・外壁）を追加の擬似ソケット（窓）込みで組み直す。L.sockets は変えない */
function rebuildShellWith(c: Ctx, extra: Socket[]): void {
  const { L, h } = c;
  const entry = c.entry;
  const ceilingHoles: AABB[] = entry && entry.type === 'hole' ? [aabbFromCenter(entry.pos[0], h + 0.1, entry.pos[2], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2)] : [];
  const fresh: Box[] = [];
  buildShell(fresh, c.rects, h, [...L.sockets, ...extra], { floor: L.palette.floor, wall: L.palette.wall, ceiling: L.palette.ceiling, floorHoles: L.holes, ceilingHoles });
  L.boxes.splice(0, c.shell, ...fresh);
  L.shellCount = fresh.length;
  c.shell = fresh.length;
}

function dressM18(c: Ctx): void {
  const { L, h } = c;
  stripIslands(c);
  // 1) 大きな窓: 入口の反対の壁を優先。壁を実際に抜き（擬似ソケット）、外側に夜景、開口の中に雨
  const byPref = [...c.faces].sort((a, b) => (Number(b.dir === 0) - Number(a.dir === 0)) || (faceLen(b) - faceLen(a)));
  let win: { f: Face; a0: number; a1: number; y0: number; y1: number } | null = null;
  for (const f of byPref) {
    if (c.entry && c.entry.type !== 'hole' && f.dir === c.entry.dir) continue;
    const run = longest(faceRuns(c, f, { pad: 0.7, depth: 1.0, y0: 0.8, y1: h - 0.3 }));
    if (!run || run[1] - run[0] < 2.2) continue;
    const w = Math.min(3.6, run[1] - run[0] - 0.5);
    const mid = (run[0] + run[1]) / 2;
    win = { f, a0: mid - w / 2, a1: mid + w / 2, y0: 0.9, y1: Math.min(h - 0.4, 2.3) };
    break;
  }
  if (win) {
    const { f, a0, a1, y0, y1 } = win;
    const w = a1 - a0, mid = (a0 + a1) / 2;
    const sock: Socket = { id: 'mwin', type: 'door', pos: f.horizontal ? [mid, 0, f.coord] : [f.coord, 0, mid], dir: f.dir, width: w, height: y1 - y0, sill: y0 };
    rebuildShellWith(c, [sock]);
    const unit: Box[] = [
      alongFace(f, a0 - 0.15, w + 0.3, -(WALL_T - 0.006), -(WALL_T - 0.012), y0 - 0.12, y1 + 0.12, 'windowNight', false),
      alongFace(f, a0 - 0.03, w + 0.06, -(WALL_T - 0.005), 0.09, y0, y0 + 0.03, 'trim', false),
      alongFace(f, a0, w, 0.0, 0.065, y1 - 0.05, y1, 'metalDark', false),
    ];
    const nm = Math.max(1, Math.round(w / 1.2));
    for (let k = 0; k <= nm; k++) {
      const a = a0 + (w * k) / nm;
      unit.push(alongFace(f, Math.min(a1 - 0.04, Math.max(a0, a - 0.02)), 0.04, 0.0, 0.065, y0, y1, 'metalDark', false));
    }
    add(c, unit);
    // 雨: 開口の中（夜景の手前）だけに降らせる。密度は「1 m³ あたり」なので目標粒数から換算
    const n0 = f.face + f.inward * -0.13, n1 = f.face + f.inward * -0.02;
    const aabb: AABB = f.horizontal
      ? { min: [a0 + 0.05, y0 + 0.03, Math.min(n0, n1)], max: [a1 - 0.05, y1 - 0.03, Math.max(n0, n1)] }
      : { min: [Math.min(n0, n1), y0 + 0.03, a0 + 0.05], max: [Math.max(n0, n1), y1 - 0.03, a1 - 0.05] };
    const vol = Math.max(0.001, (aabb.max[0] - aabb.min[0]) * (aabb.max[1] - aabb.min[1]) * (aabb.max[2] - aabb.min[2]));
    L.particles = { type: 'rain', density: 240 / vol, aabb, size: 0.04, color: 0xbcd2e6 };
    addLight(c, facePos(f, mid, 0.6, y1 - 0.15), 0x9fb6d8, 0.45, 6);
    // 窓に向いた机と椅子
    const deskC = facePos(f, mid, 1.2, 0);
    const desk = f.horizontal ? box([deskC[0] - 0.7, 0, deskC[2] - 0.35], [deskC[0] + 0.7, 0.72, deskC[2] + 0.35], 'furnitureDark', true) : box([deskC[0] - 0.35, 0, deskC[2] - 0.7], [deskC[0] + 0.35, 0.72, deskC[2] + 0.7], 'furnitureDark', true);
    if (placeUnit(c, [desk])) {
      const cc = facePos(f, mid, 1.2 + 0.35 + 0.4, 0);
      const chairBoxes: Box[] = [];
      chair(chairBoxes, cc[0], cc[2], f.dir);
      placeUnit(c, chairBoxes);
      // 机の上の小さな器（暗い箱）
      add(c, [alongFace(f, mid - 0.06, 0.12, 1.15, 1.27, 0.72, 0.82, 'metalDark', false)]);
    }
  }
  // 2) 天候のリスト（黒い盤に発光文字を 6 段）: 窓と別の壁
  const texts: [string, number, number][] = [['RAIN', 0xffffff, 0x1b3a5c], ['SNOW', 0x9fb2c8, 0x0a0e14], ['FOG', 0x9fb2c8, 0x0a0e14], ['THUNDER', 0x9fb2c8, 0x0a0e14], ['SUNSET', 0x9fb2c8, 0x0a0e14], ['(PLAYING…)', 0x7dff9a, 0x0a0e14]];
  for (const f of [...c.faces].filter((x) => x !== win?.f).sort((a, b) => faceLen(b) - faceLen(a))) {
    const run = longest(faceRuns(c, f, { pad: 0.5, y0: 1.0, y1: 2.3 }));
    if (!run || run[1] - run[0] < 1.0) continue;
    const t = (run[0] + run[1]) / 2;
    if (!add(c, [alongFace(f, t - 0.42, 0.84, 0.02, 0.06, 1.02, 2.2, 'screenDark', false)])) break;
    texts.forEach(([txt, fg, bg], i) => sign(c, f, t, 2.08 - i * 0.185, 0.62, txt, { kind: 'emissive', color: fg, background: bg, offset: 0.065 }));
    break;
  }
  // 3) 濡れた床（窓の外の雨の反射）
  L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, 0.4) };
}

// ---------------------------------------------------------------- M19 方位破壊区画

function dressM19(c: Ctx): void {
  const { rng } = c;
  const used = new Map<Face, Run[]>();
  const mark = (f: Face, a: number, b: number) => { (used.get(f) ?? used.set(f, []).get(f)!).push([a, b]); };
  // 1) 一文: 最も長い空き
  const all: { f: Face; run: Run }[] = [];
  for (const f of c.faces) for (const run of faceRuns(c, f, { pad: 0.8, depth: 0.4, y0: 1.4, y1: 2.2 })) if (run[1] - run[0] >= 1.0) all.push({ f, run });
  all.sort((a, b) => (b.run[1] - b.run[0]) - (a.run[1] - a.run[0]));
  if (all[0] && all[0].run[1] - all[0].run[0] >= 2.6) {
    const { f, run } = all[0];
    const t = (run[0] + run[1]) / 2;
    sign(c, f, t, 1.62, 2.2, 'どこへ進んでも、どちらでもある。', { sub: 'EVERY WAY IS EVERY OTHER WAY.', color: 0x22252b, background: 0xf2efe6 });
    mark(f, t - 1.3, t + 1.3);
  }
  // 2) 矛盾する方位板: 4 m ごと、隣り合う板で向きと文字が合わない
  const letters = ['N', 'S', 'E', 'W'];
  const arrows = ['↑', '→', '↓', '←'];
  let count = 0;
  let prev = -1;
  for (const { f, run } of all) {
    if (count >= 14) break;
    const [p0, q0] = subtractRuns([run], used.get(f) ?? [])[0] ?? [0, 0];
    if (q0 - p0 < 1.0) continue;
    const n = Math.max(1, Math.floor((q0 - p0) / 4));
    const start = (p0 + q0) / 2 - ((n - 1) * 4) / 2;
    for (let i = 0; i < n && count < 14; i++) {
      const t = start + i * 4;
      let li = rng.int(0, 3);
      if (li === prev) li = (li + 1) % 4;
      prev = li;
      sign(c, f, t, 1.92, 0.5, `${arrows[rng.int(0, 3)]} ${letters[li]}`, { color: 0x1c1e24, background: 0xf4f4ee });
      mark(f, t - 0.4, t + 0.4);
      count++;
    }
  }
  // 3) 床の白い山形矢印: セグメントの中心線に 3 m ごと、向きは前後ランダム
  const spec = inst(c, 'signPlate', [0.5, 0.006, 0.09]);
  for (const r of c.rects) {
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const n = Math.max(1, Math.floor((len - 1.0) / 3));
    for (let k = 0; k < n; k++) {
      const a = (alongX ? r.x0 : r.z0) + 0.5 + (len - 1.0) * (k + 0.5) / n;
      const x = alongX ? a : cx, z = alongX ? cz : a;
      if (c.L.sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < 1.8)) continue;
      if (c.L.holes.some((hh) => x > hh.min[0] - 0.8 && x < hh.max[0] + 0.8 && z > hh.min[2] - 0.8 && z < hh.max[2] + 0.8)) continue;
      const fwd = rng.chance(0.5);
      const heading = alongX ? (fwd ? 0 : Math.PI) : (fwd ? -Math.PI / 2 : Math.PI / 2);
      chevron(spec, [x, 0.008, z], heading);
    }
  }
}
