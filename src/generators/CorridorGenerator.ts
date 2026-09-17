/** 廊下系。直線 / L 字 / Z 字 / U 字の折れ曲がりを矩形の連結で表す。派生テンプレートは幅・装飾のプリセット差分。
 *  装飾は docs/reference-common-analysis.md の視覚文法（壁の二段構成・扉のリズム・照明の列・短いサイン・小物は置かない）に沿う。
 *  実装した要素とスクリーンショットの所見は docs/reference-corridors.md。 */
import type { Dir, PortalType, Socket, Vec3 } from '../core/types';
import type { Rng } from '../core/rng';
import { buildShell, footprintAABB, rect, rectsOverlap, rectArea, wallSpans, along, across, type Rect } from './footprint';
import { dropRemovedHole, labelAtEntry, makeEntry, placeExits, placeHole, wallBands } from './common';
import { box, bonusExits, emptyLayout, lightPanel, snap, WALL_T, WIDE_W, DOOR_W, DOOR_H, type Box, type GenParams, type MatId, type RoomLayout, type SignSpec } from './layout';

type Shape = 'straight' | 'L' | 'Z' | 'U';

interface Segment {
  rect: Rect;
  heading: Dir;
}

/** 折れ廊下の矩形列を作る。最初のセグメントは原点から +Z へ。 */
function corridorSegments(rng: Rng, shape: Shape, total: number, w: number): Segment[] {
  const segs: Segment[] = [];
  const minSeg = w + 1.5;
  let lengths: number[];
  let turns: number[];
  switch (shape) {
    case 'straight': lengths = [total]; turns = []; break;
    case 'L': {
      const a = Math.max(minSeg, total * rng.float(0.35, 0.65));
      lengths = [a, Math.max(minSeg, total - a)];
      turns = [rng.chance(0.5) ? 1 : -1];
      break;
    }
    case 'Z': {
      const a = Math.max(minSeg, total * rng.float(0.3, 0.4));
      const b = Math.max(minSeg, total * rng.float(0.2, 0.35));
      lengths = [a, b, Math.max(minSeg, total - a - b)];
      const t = rng.chance(0.5) ? 1 : -1;
      turns = [t, -t];
      break;
    }
    case 'U': {
      const a = Math.max(minSeg, total * rng.float(0.3, 0.4));
      const b = Math.max(minSeg, total * rng.float(0.25, 0.35));
      lengths = [a, b, Math.max(minSeg, total - a - b)];
      const t = rng.chance(0.5) ? 1 : -1;
      turns = [t, t];
      break;
    }
  }
  lengths = lengths.map((l) => Math.max(minSeg, Math.round(l * 2) / 2));
  // 最初のセグメント
  let heading: Dir = 0;
  let r = rect(-w / 2, 0, w / 2, lengths[0]);
  segs.push({ rect: r, heading });
  for (let i = 1; i < lengths.length; i++) {
    const turn = turns[i - 1];
    heading = ((heading + (turn === 1 ? 1 : 3)) % 4) as Dir;
    // 直前セグメント末端の w×w の正方形
    const prev = segs[i - 1];
    const sq = endSquare(prev, w);
    const L = lengths[i];
    let nr: Rect;
    switch (heading) {
      case 1: nr = rect(sq.x1, sq.z0, sq.x1 + L, sq.z1); break;
      case 3: nr = rect(sq.x0 - L, sq.z0, sq.x0, sq.z1); break;
      case 0: nr = rect(sq.x0, sq.z1, sq.x1, sq.z1 + L); break;
      default: nr = rect(sq.x0, sq.z0 - L, sq.x1, sq.z0); break;
    }
    if (segs.some((s) => rectsOverlap(s.rect, nr))) break; // 自己交差 → そこで打ち切り
    segs.push({ rect: nr, heading });
  }
  return segs;
}

function endSquare(s: Segment, w: number): Rect {
  const r = s.rect;
  switch (s.heading) {
    case 0: return rect(r.x0, r.z1 - w, r.x1, r.z1);
    case 2: return rect(r.x0, r.z0, r.x1, r.z0 + w);
    case 1: return rect(r.x1 - w, r.z0, r.x1, r.z1);
    default: return rect(r.x0, r.z0, r.x0 + w, r.z1);
  }
}

/** 直線廊下で mainRect（grow-to-fill）を反映するか。統合時の A/B 計測で悪化（41 → 50 件）したため既定 false */
export const USE_CORRIDOR_MAIN_RECT = false;

export function generateCorridor(p: GenParams): RoomLayout {
  const { rng, template, palette } = p;
  const L = emptyLayout(palette);
  const tid = template.id;

  // 共有の乱数（バリアントに依存しない）
  let width = rng.float(2.2, 3.2);
  if (tid === 'CorridorHotel' || tid === 'ApartmentCorridor' || tid === 'CorridorEntertainment') width = rng.float(1.9, 2.6);
  if (tid === 'TransitCorridor') width = rng.float(3.2, 5.0);
  if (tid === 'CorridorSchool' || tid === 'CorridorHospital') width = rng.float(2.6, 3.6);
  if (tid === 'Bridge') width = rng.float(2.0, 3.4);
  const hasMod = (id: string) => !!p.def.modifiers?.some((m) => m.id === id);
  // GravityAxis（E03 横向きホテル）は廊下幅 2.4 m 以上にクランプ（v1.3 前提）。床扉の穴（1.1 m）の横にプレイヤー（0.7 m）が
  // 通れる 0.8 m 以上の通路を残し、横倒し後の天井高（旧幅）も確保する。乱数の消費は変えない
  if (hasMod('GravityAxis')) width = Math.max(2.4, width);
  width = snap(width);
  const h = tid === 'TransitCorridor' ? 3.2 : tid === 'Bridge' ? 3.0 : 2.7;
  // Modifier 付き定義の形状制約（Phase 2）: DynamicLength（E13）は「遠ざかる突き当たり」のため長い直線のみ、
  // MovingWalls 付きの廊下（E18）は可変蛇行のため直線を除く。rng.shuffle は常に 1 回呼び、共有乱数の消費を揃える
  const dynLength = hasMod('DynamicLength');
  const shuffled: Shape[] = rng.shuffle(['straight', 'L', 'Z', 'U']);
  const shapes: Shape[] = dynLength ? ['straight', 'straight', 'straight', 'straight'] : hasMod('MovingWalls') ? shuffled.map((s) => (s === 'straight' ? 'Z' : s)) : shuffled;
  const lengths = dynLength ? [60, 48, 36, 24] : [26, 20, 14, 9];

  // バリアント固有
  const vr = rng.fork(`v${p.variant}`);
  const shape = shapes[p.variant % 4];
  const total = snap(lengths[Math.floor(p.variant / 4) % lengths.length] * vr.float(0.9, 1.1));
  const segs = corridorSegments(vr, shape, total, width);
  // SEAM-7: 直線廊下は WorldManager が空き空間へ成長させた主矩形（mainRect）をそのまま使う（大部屋との隙間を埋める）。
  // 計測（tools/seam-stats.mjs 10 seed × 100 部屋）では有効化で施錠行き止まりが 41 → 50 に悪化したため既定はオフ（USE_CORRIDOR_MAIN_RECT）
  if (USE_CORRIDOR_MAIN_RECT && segs.length === 1 && p.mainRect) {
    const mr = p.mainRect;
    if (mr.x0 <= 0 && 0 <= mr.x1 && mr.z1 > mr.z0 + 2) {
      segs[0].rect = { x0: mr.x0, z0: mr.z0, x1: mr.x1, z1: mr.z1 };
      width = segs[0].heading === 0 || segs[0].heading === 2 ? mr.x1 - mr.x0 : mr.z1 - mr.z0;
    }
  }
  const rects = segs.map((s) => s.rect);
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  const area = rects.reduce((a, r) => a + rectArea(r), 0);

  // ソケット
  const { entry } = makeEntry(p, rects[0], 0, h);
  const last = segs[segs.length - 1];
  const endType: PortalType = pickEndType(p, rng);
  const endW = endType === 'door' ? DOOR_W : WIDE_W;
  const endH = endType === 'door' ? DOOR_H : h - 0.3;
  const er = last.rect;
  const mid = (a: number, b: number) => Math.min(b - endW / 2 - 0.3, Math.max(a + endW / 2 + 0.3, snap((a + b) / 2)));
  let endSocket: Socket;
  switch (last.heading) {
    case 0: endSocket = { id: 'end', type: endType, pos: [mid(er.x0, er.x1), 0, er.z1], dir: 0, width: endW, height: endH }; break;
    case 1: endSocket = { id: 'end', type: endType, pos: [er.x1, 0, mid(er.z0, er.z1)], dir: 1, width: endW, height: endH }; break;
    case 3: endSocket = { id: 'end', type: endType, pos: [er.x0, 0, mid(er.z0, er.z1)], dir: 3, width: endW, height: endH }; break;
    default: endSocket = { id: 'end', type: endType, pos: [mid(er.x0, er.x1), 0, er.z0], dir: 2, width: endW, height: endH }; break;
  }
  let sockets: Socket[] = [entry, endSocket, ...p.extraSockets];
  const sideWanted = Math.min(4, Math.max(0, p.exits - 1) + Math.min(2, Math.floor(total / 10)) + bonusExits(area));
  sockets.push(...placeExits(rects, sockets, vr, { count: sideWanted, minGap: 3.0 }, 'side'));
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));
  L.sockets = sockets;

  // 床穴（廊下では低確率）。判定・配置は専用 fork（holeLocal の有無で vr の消費量を変えない）
  const hr = vr.fork('hole');
  const wantHole = p.allowHole && tid !== 'Bridge' && hr.chance(0.08);
  if (p.holeLocal || wantHole) {
    const hole = placeHole(rects, sockets, hr, p.holeLocal);
    if (hole) {
      L.holes.push(hole.hole);
      L.sockets.push(hole.socket);
    }
  }

  dropRemovedHole(L, p);
  // 窓（学校の窓帯 / マンションの手すり壁の上）: シェルの壁を実際に抜く。擬似ソケットは buildShell にだけ渡す（L.sockets には入れない）
  const walls = wallsOf(segs, L.sockets);
  const windows = tid === 'Bridge' ? [] : planWindows(tid, walls, h);
  // シェル
  if (tid === 'Bridge') {
    // 手すりだけの歩廊。天井なし
    buildShell(L.boxes, rects, 1.05, sockets, { floor: palette.floor, wall: 'metal', ceiling: palette.ceiling, floorHoles: L.holes, noCeiling: true });
  } else {
    buildShell(L.boxes, rects, h, [...sockets, ...windowSockets(windows)], { floor: palette.floor, wall: palette.wall, ceiling: palette.ceiling, floorHoles: L.holes });
  }
  L.shellCount = L.boxes.length;

  // 装飾 + 照明の列（参考画像の文法）。乱数は専用 fork（ソケット・足跡・穴の乱数列は変えない）
  const dim = /一部消灯|低照度|暗/.test(p.def.lightingPreset) ? 0.3 : 0.05;
  if (tid === 'Bridge') L.lights.push({ pos: [0, 2.0, total / 2], color: 0xbfc7d8, intensity: 0.5, distance: 20 });
  else decorate({ L, tid, defId: p.def.id, segs, h, width, sockets: L.sockets, walls, windows, rng: vr.fork('ref'), dim, counter: 0 });

  labelAtEntry(L, entry, Math.min(width - 0.4, 2.2), p.label);
  return L;
}

function pickEndType(p: GenParams, rng: Rng): PortalType {
  const primary = p.def.primaryPortal;
  if (primary === 'stairs' || primary === 'ramp') return rng.chance(0.6) ? primary : 'door';
  if (primary === 'escalator') return 'stairs';
  return 'door';
}

// ---------------------------------------------------------------- 参考画像に沿った装飾（docs/reference-common-analysis.md）

interface DecorCtx {
  L: RoomLayout;
  tid: string;
  defId: string;
  segs: Segment[];
  h: number;
  width: number;
  sockets: Socket[];
  /** 外壁の区間（wallsOf。シェルの前に計算済み） */
  walls: Wall[];
  /** シェルで抜いた窓の開口（学校 / マンション）。ガラス・夜景・枠は decorate で埋める */
  windows: WindowSpan[];
  rng: Rng;
  /** 消灯確率（lightingPreset の「一部消灯」） */
  dim: number;
  /** 番号プレートの連番 */
  counter: number;
}

/** 壁の内向き法線（dir 0 = +Z 壁 → 内側は -Z） */
const INWARD: Record<Dir, 1 | -1> = { 0: -1, 1: -1, 2: 1, 3: 1 };

/** 外壁の 1 区間。face は壁の室内面座標、coord は外面座標（ソケットの照合用）、cuts は同じ壁の開口区間（辺に沿った座標）、side は進行方向に対する左右 */
interface Wall {
  dir: Dir;
  face: number;
  coord: number;
  a0: number;
  a1: number;
  cuts: [number, number][];
  side: 'left' | 'right' | 'end';
  heading: Dir;
}

function wallsOf(segs: Segment[], sockets: Socket[]): Wall[] {
  const out: Wall[] = [];
  for (const sp of wallSpans(segs.map((s) => s.rect))) {
    const e = sp.edge;
    const hd = segs.find((s) => s.rect === e.rect)?.heading ?? 0;
    // 進行方向 hd を向いたときの右手は (hd + 3) % 4（+Z を向くと右手は -X）
    const side = e.dir === (hd + 1) % 4 ? 'left' : e.dir === (hd + 3) % 4 ? 'right' : 'end';
    const cuts = sockets
      .filter((s) => s.type !== 'hole' && s.dir === e.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - e.coord) < 0.05)
      .map((s) => { const t = along(s.dir, s.pos[0], s.pos[2]); return [t - s.width / 2, t + s.width / 2] as [number, number]; });
    out.push({ dir: e.dir, face: e.coord + INWARD[e.dir] * WALL_T, coord: e.coord, a0: sp.a0, a1: sp.a1, cuts, side, heading: hd });
  }
  return out;
}

// ---------------------------------------------------------------- 窓（壁を実際に抜き、外に夜景を置く）

/** 窓の開口: 壁 w の辺に沿って t0..t1、高さ y0..y1 */
interface WindowSpan {
  w: Wall;
  t0: number;
  t1: number;
  y0: number;
  y1: number;
}

/** 学校: 右側の窓帯 1.2〜2.2 m / マンション: 右側の手すり壁の上 1.15〜h−0.12 m（外は夜の街）。壁区間の両端 0.3 m と扉開口 ±0.3 m は壁のまま残す */
function planWindows(tid: string, walls: Wall[], h: number): WindowSpan[] {
  const band: [number, number] | null = tid === 'CorridorSchool' ? [1.2, 2.2] : tid === 'ApartmentCorridor' ? [1.15, h - 0.12] : null;
  if (!band) return [];
  const out: WindowSpan[] = [];
  for (const w of walls) {
    if (w.side !== 'right' || w.a1 - w.a0 < 3) continue;
    for (const [p, q] of openSegments(w, 0.3)) {
      const t0 = p + 0.3, t1 = q - 0.3;
      if (t1 - t0 >= 0.9) out.push({ w, t0, t1, y0: band[0], y1: band[1] });
    }
  }
  return out;
}

/** buildShell 用の擬似ソケット（壁の外面座標に置く）。L.sockets には入れない */
function windowSockets(spans: WindowSpan[]): Socket[] {
  return spans.map((s, i): Socket => {
    const t = (s.t0 + s.t1) / 2;
    const pos: Vec3 = s.w.dir === 0 || s.w.dir === 2 ? [t, 0, s.w.coord] : [s.w.coord, 0, t];
    return { id: `win${i}`, type: 'door', pos, dir: s.w.dir, width: s.t1 - s.t0, height: s.y1 - s.y0, sill: s.y0 };
  });
}

/** 夜景の箔: 壁の外面側（室内面から WALL_T − 6〜12 mm 奥）。開口より上下左右に大きく、余白は残った壁の中に隠れる */
function nightView(c: DecorCtx, s: WindowSpan): void {
  c.L.boxes.push(plate(s.w, s.t0 - 0.15, s.t1 + 0.15, s.y0 - 0.12, s.y1 + 0.12, -(WALL_T - 0.012), 0.006, 'windowNight'));
}

/** 学校の窓: 夜景 + ガラス（ソリッド。開口を塞ぐ当たり判定）+ 窓台（壁の上端を覆い 6 cm 室内へ）+ 方立て 2.4 m ごと + 上桟（木） */
function schoolWindow(c: DecorCtx, s: WindowSpan): void {
  const { w, t0, t1, y0, y1 } = s;
  const B = c.L.boxes;
  nightView(c, s);
  B.push(plate(w, t0, t1, y0, y1, 0.045, 0.015, 'glass', true));
  B.push(plate(w, t0 - 0.03, t1 + 0.03, y0, y0 + 0.025, -(WALL_T - 0.005), WALL_T - 0.005 + 0.06, 'trim'));
  for (let t = t0; t < t1 - 0.3; t += 2.4) B.push(plate(w, t, t + 0.06, y0, y1, 0, 0.05, 'trim'));
  B.push(plate(w, t1 - 0.06, t1, y0, y1, 0, 0.05, 'trim'));
  B.push(plate(w, t0, t1, y1 - 0.05, y1, 0, 0.05, 'trim'));
}

/** マンションの手すり壁の上: 開口（ガラス無し = 外気）+ 夜景 + 壁の上端を覆う金属の笠木 */
function balconyOpening(c: DecorCtx, s: WindowSpan): void {
  const { w, t0, t1, y0 } = s;
  nightView(c, s);
  c.L.boxes.push(plate(w, t0 - 0.02, t1 + 0.02, y0, y0 + 0.015, -(WALL_T - 0.004), WALL_T - 0.004 + 0.07, 'metalDark'));
}

/** 壁の室内面から inset 離した薄板（辺に沿って t0..t1、高さ y0..y1、厚さ thick）。既定は非ソリッド */
function plate(w: Wall, t0: number, t1: number, y0: number, y1: number, inset: number, thick: number, mat: MatId, solid = false): Box {
  const inw = INWARD[w.dir];
  const lo = w.face + inw * inset, hi = w.face + inw * (inset + thick);
  return w.dir === 0 || w.dir === 2 ? box([t0, y0, lo], [t1, y1, hi], mat, solid) : box([lo, y0, t0], [hi, y1, t1], mat, solid);
}

/** 開口（cuts を pad だけ広げた区間）を除いた区間列 */
function openSegments(w: Wall, pad: number): [number, number][] {
  const sorted = w.cuts.map(([p, q]) => [p - pad, q + pad] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = w.a0;
  for (const [p, q] of sorted) {
    if (p > cur + 1e-6) out.push([cur, Math.min(p, w.a1)]);
    cur = Math.max(cur, q);
    if (cur >= w.a1) break;
  }
  if (w.a1 > cur + 1e-6) out.push([cur, w.a1]);
  return out.filter(([p, q]) => q - p > 0.05);
}

/** 開口を避けた帯（窓帯・手すり壁など片側だけの帯に使う。全周の帯は common.wallBands） */
function bandOn(c: DecorCtx, w: Wall, y0: number, y1: number, inset: number, thick: number, mat: MatId, pad = 0.1): void {
  for (const [p, q] of openSegments(w, pad)) c.L.boxes.push(plate(w, p, q, y0, y1, inset, thick, mat));
}

/** 壁に沿った等間隔の位置（中央寄せ）。隅 margin と、開口 + 扉前 1.6 m を避ける。i は等間隔グリッドの番号（役割の交代に使う） */
function slots(w: Wall, pitch: number, halfW: number, margin: number): { t: number; i: number }[] {
  const usable = w.a1 - w.a0 - 2 * (margin + halfW);
  if (usable < 0) return [];
  const n = Math.floor(usable / pitch) + 1;
  const start = w.a0 + margin + halfW + (usable - (n - 1) * pitch) / 2;
  const out: { t: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = start + i * pitch;
    if (w.cuts.some(([p, q]) => t + halfW > p - 1.6 && t - halfW < q + 1.6)) continue;
    out.push({ t, i });
  }
  return out;
}

/** 壁面サイン（SignAtlas）。off は壁面からの出。表面は室内側を向く。部屋あたり 44 枚まで */
function wallSign(c: DecorCtx, w: Wall, t: number, y: number, off: number, width: number, s: Omit<SignSpec, 'pos' | 'dir' | 'width'>): void {
  if ((c.L.signs?.length ?? 0) >= 44) return;
  const n = w.face + INWARD[w.dir] * off;
  const pos: Vec3 = w.dir === 0 || w.dir === 2 ? [t, y, n] : [n, y, t];
  (c.L.signs ??= []).push({ ...s, pos, dir: ((w.dir + 2) % 4) as Dir, width });
}

/** 装飾扉（開かない）: 枡（frameMat）の上に 5 cm 浮かせた扉箔 + レバーハンドル。番号 / 室名は呼び出し側 */
function decorDoor(c: DecorCtx, w: Wall, t: number, mat: MatId, dw = 0.9, dh = 2.05, frameMat: MatId = 'trim'): void {
  const B = c.L.boxes;
  B.push(plate(w, t - dw / 2 - 0.065, t + dw / 2 + 0.065, 0, dh + 0.065, 0, 0.05, frameMat));
  B.push(plate(w, t - dw / 2, t + dw / 2, 0.01, dh, 0.05, 0.03, mat));
  B.push(plate(w, t + dw / 2 - 0.16, t + dw / 2 - 0.05, 0.99, 1.02, 0.08, 0.05, 'metal'));
}

/** 番号 / 室名プレート（扉の脇、高さ 1.55 m） */
function doorPlate(c: DecorCtx, w: Wall, t: number, text: string, dw = 0.9, width = 0.26): void {
  wallSign(c, w, t + dw / 2 + 0.065 + 0.08 + width / 2, 1.55, 0.012, width, { text, kind: 'plate' });
}

/** 掲示板 / 額装ポスター（枡 + 面） */
function board(c: DecorCtx, w: Wall, t: number, bw: number, y0: number, y1: number, faceMat: MatId, frameMat: MatId = 'trim'): void {
  c.L.boxes.push(plate(w, t - bw / 2 - 0.04, t + bw / 2 + 0.04, y0 - 0.04, y1 + 0.04, 0, 0.02, frameMat));
  c.L.boxes.push(plate(w, t - bw / 2, t + bw / 2, y0, y1, 0.02, 0.012, faceMat));
}

/** 連結椅子（3 人掛け 1.6 m。座面 seatBlue、脚梁 metalDark）。壁付き。ソリッド */
function bench(c: DecorCtx, w: Wall, t: number): void {
  const B = c.L.boxes;
  B.push(plate(w, t - 0.8, t + 0.8, 0.42, 0.48, 0.12, 0.45, 'seatBlue', true));
  B.push(plate(w, t - 0.8, t + 0.8, 0.48, 0.86, 0.08, 0.08, 'seatBlue', true));
  B.push(plate(w, t - 0.7, t + 0.7, 0.0, 0.42, 0.26, 0.08, 'metalDark', true));
}

const DIRV: Record<Dir, [number, number]> = { 0: [0, 1], 1: [1, 0], 2: [0, -1], 3: [-1, 0] };

/** 吊り下げ案内板: セグメントの中心線上、入口側から frac の位置。進行方向の逆（入口側）を向く。板 + 吊り金具 2 本 */
function hangingSign(c: DecorCtx, seg: Segment, frac: number, width: number, s: Omit<SignSpec, 'pos' | 'dir' | 'width'>): void {
  if ((c.L.signs?.length ?? 0) >= 44) return;
  const r = seg.rect, hd = seg.heading;
  const alongZ = hd === 0 || hd === 2;
  const len = alongZ ? r.z1 - r.z0 : r.x1 - r.x0;
  const from = hd === 0 ? r.z0 : hd === 2 ? r.z1 : hd === 1 ? r.x0 : r.x1;
  const a = from + (hd === 0 || hd === 1 ? 1 : -1) * len * frac;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const hgt = width / 4;
  const y = c.h - 0.42 - hgt / 2;
  const face = ((hd + 2) % 4) as Dir;
  const [nx, nz] = DIRV[face];
  const pos: Vec3 = alongZ ? [cx, y, a] : [a, y, cz];
  (c.L.signs ??= []).push({ ...s, pos: [pos[0] + nx * 0.011, y, pos[2] + nz * 0.011], dir: face, width });
  const B = c.L.boxes;
  const hw = width / 2;
  if (alongZ) {
    B.push(box([cx - hw, y - hgt / 2, a - 0.01], [cx + hw, y + hgt / 2, a + 0.01], 'signPlate', false));
    for (const o of [-hw * 0.7, hw * 0.7]) B.push(box([cx + o - 0.01, y + hgt / 2, a - 0.01], [cx + o + 0.01, c.h, a + 0.01], 'metalDark', false));
  } else {
    B.push(box([a - 0.01, y - hgt / 2, cz - hw], [a + 0.01, y + hgt / 2, cz + hw], 'signPlate', false));
    for (const o of [-hw * 0.7, hw * 0.7]) B.push(box([a - 0.01, y + hgt / 2, cz + o - 0.01], [a + 0.01, c.h, cz + o + 0.01], 'metalDark', false));
  }
}

/** 照明の列: 中心線に等間隔 1 列（幅 3 m 超は 2 列）。troffer = グリッド天井の埋め込み、tubes = 露出蛍光管ペア（器具箱 + 管 2 本を天井から 8 cm 下げ）、downlight = 小さな丸灯 */
function lightRow(c: DecorCtx, kind: 'troffer' | 'tubes' | 'downlight', pitch: number, maxRows = 2): void {
  const { L, h } = c;
  const mat = L.palette.light;
  let i = 0;
  for (const seg of c.segs) {
    const r = seg.rect;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const alongZ = d >= w;
    const len = alongZ ? d : w, wid = alongZ ? w : d;
    const n = Math.max(1, Math.round(len / pitch));
    const rows = wid > 3.0 && maxRows > 1 ? [-wid / 4, wid / 4] : [0];
    for (let k = 0; k < n; k++) {
      const a = (alongZ ? r.z0 : r.x0) + (k + 0.5) * (len / n);
      for (const o of rows) {
        const x = alongZ ? (r.x0 + r.x1) / 2 + o : a;
        const z = alongZ ? a : (r.z0 + r.z1) / 2 + o;
        const off = c.rng.chance(c.dim);
        const m: MatId = off ? 'lightOff' : mat;
        if (kind === 'troffer') lightPanel(L.boxes, x, z, alongZ ? 0.6 : 1.2, alongZ ? 1.2 : 0.6, h, m);
        else if (kind === 'downlight') lightPanel(L.boxes, x, z, 0.12, 0.12, h, m); // 0.12 m: ArchitecturalDetails の金属トレイ（幅 0.15 超）を付けない
        else {
          const hl = 0.65, hb = 0.15;
          L.boxes.push(alongZ ? box([x - hb, h - 0.08, z - hl], [x + hb, h, z + hl], 'metalDark', false) : box([x - hl, h - 0.08, z - hb], [x + hl, h, z + hb], 'metalDark', false));
          for (const s of [-0.07, 0.07]) {
            L.boxes.push(alongZ ? box([x + s - 0.045, h - 0.1, z - 0.6], [x + s + 0.045, h - 0.08, z + 0.6], m, false) : box([x - 0.6, h - 0.1, z + s - 0.045], [x + 0.6, h - 0.08, z + s + 0.045], m, false));
          }
        }
        if (!off && i % 2 === 0) L.lights.push({ pos: [x, h - 0.4, z], color: L.palette.lightColor, intensity: L.palette.lightIntensity, distance: pitch * 2.6 });
        i++;
      }
    }
  }
}

/** 床の点字帯（黄）: 各セグメントの中心線、幅 0.3 m。床穴は避ける */
function tactileStrip(c: DecorCtx): void {
  for (const seg of c.segs) {
    const r = seg.rect;
    const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    let parts: [number, number][] = [alongZ ? [r.z0 + 0.3, r.z1 - 0.3] : [r.x0 + 0.3, r.x1 - 0.3]];
    for (const hole of c.L.holes) {
      const lo = alongZ ? hole.min[2] - 0.2 : hole.min[0] - 0.2, hi = alongZ ? hole.max[2] + 0.2 : hole.max[0] + 0.2;
      const cross = alongZ ? cx > hole.min[0] - 0.2 && cx < hole.max[0] + 0.2 : cz > hole.min[2] - 0.2 && cz < hole.max[2] + 0.2;
      if (!cross) continue;
      parts = parts.flatMap(([p, q]): [number, number][] => (q <= lo || p >= hi ? [[p, q]] : [[p, Math.min(q, lo)], [Math.max(p, hi), q]])).filter(([p, q]) => q - p > 0.3);
    }
    for (const [p, q] of parts) {
      c.L.boxes.push(alongZ ? box([cx - 0.15, 0, p], [cx + 0.15, 0.007, q], 'yellowLine', false) : box([p, 0, cz - 0.15], [q, 0.007, cz + 0.15], 'yellowLine', false));
    }
  }
}

/** テンプレートごとの装飾（壁の二段構成・扉のリズム・照明の列・サイン）。小物は置かない */
function decorate(c: DecorCtx): void {
  const { L, tid, h, walls } = c;
  const rects = c.segs.map((s) => s.rect);
  const sides = walls.filter((w) => w.side !== 'end' && w.a1 - w.a0 >= 3);
  const left = sides.filter((w) => w.side === 'left');
  const right = sides.filter((w) => w.side === 'right');
  const floorNo = c.rng.int(2, 9);
  const num = (pad = 2) => `${floorNo}${String(++c.counter).padStart(pad, '0')}`;

  switch (tid) {
    case 'CorridorSchool': {
      // 壁: 緑の腰壁 1.2 m（薄い 1.2 cm。巾木 0.11 m と廻り縁は RoomBuilder の ArchitecturalDetails が壁箱ごとに自動で付け、腰壁より前に出る）
      wallBands(L, rects, c.sockets, [{ y0: 0, y1: 1.2, mat: 'wallGreen', depth: 0.012 }]);
      // 左: 教室扉（木 + 上部の小窓）と緑の掲示板（3 枡ごと）
      const names = ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3', '理科室', '音楽室', '3-1', '3-2', '図書室', '美術室'];
      let k = 0;
      for (const w of left) {
        for (const { t, i } of slots(w, 3.0, 0.55, 1.2)) {
          if (i % 3 === 2) { board(c, w, t, 1.8, 0.95, 2.15, 'noticeGreen'); continue; }
          decorDoor(c, w, t, 'doorWood');
          L.boxes.push(plate(w, t - 0.2, t + 0.2, 1.45, 1.85, 0.08, 0.006, 'windowDark'));
          wallSign(c, w, t, 2.3, 0.012, 0.7, { text: names[k++ % names.length], kind: 'plate' });
        }
      }
      // 右: 窓帯 1.2〜2.2 m。壁は planWindows / buildShell で実際に抜いてあり、ここでガラス・夜景（暗い運動場と遠くの街灯）・窓台・方立てを埋める
      for (const s of c.windows) schoolWindow(c, s);
      lightRow(c, 'tubes', 3.2);
      break;
    }
    case 'CorridorHospital': {
      // 壁: クリームの腰壁 1.0 m + 木目の手すり 0.8〜0.85 m（6 cm 出す）。巾木・廻り縁は自動
      wallBands(L, rects, c.sockets, [
        { y0: 0, y1: 1.0, mat: 'wainscotCream', depth: 0.012 },
        { y0: 0.8, y1: 0.85, mat: 'handrailWood', depth: 0.06 },
      ]);
      const names = ['診察室 1', '診察室 2', '処置室', '検査室', '診察室 3', '相談室', 'X 線室', '点滴室'];
      let k = 0;
      for (const w of left) for (const { t } of slots(w, 3.2, 0.55, 1.2)) { decorDoor(c, w, t, 'doorWood'); doorPlate(c, w, t, names[k++ % names.length], 0.9, 0.34); }
      // 右: 待合ベンチ（青の連結椅子）を 6.4 m ごと。隅 2.0 m は空ける（直交する壁の扉前 1.8 m にベンチの端が掛からない）
      for (const w of right) for (const { t, i } of slots(w, 3.2, 0.85, 2.0)) if (i % 2 === 0) bench(c, w, t);
      // 吊り下げ案内板
      const texts = ['外来 →', '← 避難口', '受付 ↑', '非常口 →'];
      c.segs.forEach((seg, j) => hangingSign(c, seg, j === 0 ? 0.45 : 0.5, 1.3, { text: texts[j % texts.length], kind: 'emissive', color: 0x1d6b3f, background: 0xf2f4ee }));
      lightRow(c, 'troffer', 3.6);
      break;
    }
    case 'CorridorHotel': {
      // 濃い木の腰壁 0.9 m + 笠木。巾木・廻り縁は自動
      wallBands(L, rects, c.sockets, [
        { y0: 0, y1: 0.9, mat: 'furnitureDark', depth: 0.012 },
        { y0: 0.9, y1: 0.94, mat: 'trim', depth: 0.03 },
      ]);
      // 両側に客室扉 3.0 m 間隔 + 客室番号。左側は 1 枡おきに壁灯
      for (const w of sides) {
        for (const { t, i } of slots(w, 3.0, 0.55, 1.2)) {
          decorDoor(c, w, t, 'doorWood');
          doorPlate(c, w, t, num(), 0.9, 0.3);
          if (w.side === 'left' && i % 2 === 1) L.boxes.push(plate(w, t - 0.45 - 0.065 - 0.5, t - 0.45 - 0.065 - 0.36, 1.6, 1.82, 0.03, 0.08, 'lightWarm'));
        }
      }
      lightRow(c, 'downlight', 3.6, 1);
      break;
    }
    case 'CorridorEntertainment': {
      // 濃色の腰壁 + 黒い巾木（自動の木巾木より前に出す）
      wallBands(L, rects, c.sockets, [
        { y0: 0.1, y1: 0.9, mat: 'wallDark', depth: 0.02 },
        { y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.035 },
      ]);
      // 両側に黒い番号扉（番号は扉面の上部）。右側の 2 番目の枡は標語
      let n = 100;
      for (const w of sides) {
        for (const { t, i } of slots(w, 3.0, 0.55, 1.2)) {
          if (w.side === 'right' && i === 1) { wallSign(c, w, t, 1.8, 0.012, 1.6, { text: 'MUSIC MAKES A BETTER DAY', kind: 'emissive', color: 0xff6a5a, background: 0x140a0a }); continue; }
          decorDoor(c, w, t, 'metalDark', 0.9, 2.05, 'metalDark');
          wallSign(c, w, t, 1.75, 0.085, 0.3, { text: String(++n), kind: 'plate', color: 0xf0e0c0, background: 0x202020 });
        }
      }
      // 突き当たりの非常口サイン（lightingPreset の非常灯）
      const end = c.sockets.find((s) => s.id === 'end');
      const ew = end && walls.find((w) => w.dir === end.dir && Math.abs(w.face - (across(end.dir, end.pos[0], end.pos[2]) + INWARD[end.dir] * WALL_T)) < 0.01);
      if (end && ew) wallSign(c, ew, along(end.dir, end.pos[0], end.pos[2]), Math.min(h - 0.15, end.height + 0.28), 0.012, 0.5, { text: '非常口', kind: 'emissive' });
      lightRow(c, 'downlight', 3.6, 1);
      break;
    }
    case 'CorridorService': {
      // 保護レール 2 段（下 metalDark、上 黄）+ 金属の巾木。露出天井にダクトと配管
      wallBands(L, rects, c.sockets, [
        { y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.03 },
        { y0: 0.25, y1: 0.33, mat: 'metalDark', depth: 0.06 },
        { y0: 0.85, y1: 0.93, mat: 'yellowLine', depth: 0.06 },
      ]);
      for (const w of left) for (const { t, i } of slots(w, 3.2, 0.55, 1.2)) if (i % 2 === 0) decorDoor(c, w, t, 'doorMetal', 0.9, 2.05, 'metalDark');
      for (const w of right) {
        const ss = slots(w, 3.2, 0.5, 1.2);
        ss.forEach(({ t }, j) => { if (j % 3 === 1 || ss.length === 1) wallSign(c, w, t, 1.75, 0.012, 0.8, { text: '従業員専用', sub: 'STAFF ONLY', kind: 'plate', color: 0xb02020 }); });
      }
      for (const seg of c.segs) {
        const r = seg.rect;
        const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
        const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
        const o = (alongZ ? r.x1 - r.x0 : r.z1 - r.z0) / 4;
        if (alongZ) {
          L.boxes.push(box([cx + o - 0.22, h - 0.38, r.z0 + 0.2], [cx + o + 0.22, h - 0.06, r.z1 - 0.2], 'metal', false));
          L.boxes.push(box([cx - o - 0.05, h - 0.22, r.z0 + 0.2], [cx - o + 0.05, h - 0.12, r.z1 - 0.2], 'metalDark', false));
        } else {
          L.boxes.push(box([r.x0 + 0.2, h - 0.38, cz + o - 0.22], [r.x1 - 0.2, h - 0.06, cz + o + 0.22], 'metal', false));
          L.boxes.push(box([r.x0 + 0.2, h - 0.22, cz - o - 0.05], [r.x1 - 0.2, h - 0.12, cz - o + 0.05], 'metalDark', false));
        }
      }
      lightRow(c, 'tubes', 3.6, 1);
      break;
    }
    case 'ApartmentCorridor': {
      // 左: 鉄の玄関扉 + メーターボックス + 部屋番号。右: 手すり壁 1.1 m + 上は夜の黒（void）
      wallBands(L, rects, c.sockets, [{ y0: 0, y1: 0.1, mat: 'trim', depth: 0.03 }]);
      for (const w of left) {
        for (const { t } of slots(w, 3.2, 0.75, 1.2)) {
          decorDoor(c, w, t, 'doorMetal', 0.9, 2.05, 'metalDark');
          L.boxes.push(plate(w, t + 0.45 + 0.065 + 0.5, t + 0.45 + 0.065 + 0.9, 1.15, 1.75, 0, 0.1, 'doorMetal'));
          doorPlate(c, w, t, num(), 0.9, 0.28);
        }
      }
      // 右: 手すり壁 1.1 m + 金属の笠木。その上はシェルで抜いた開口（planWindows）で、外は夜の街（windowNight）
      for (const w of right) {
        bandOn(c, w, 0.1, 1.1, 0, 0.03, 'wallConcrete', 0.1);
        bandOn(c, w, 1.1, 1.15, 0, 0.07, 'metalDark', 0.1);
      }
      for (const s of c.windows) balconyOpening(c, s);
      lightRow(c, 'downlight', 3.2, 1);
      break;
    }
    case 'TransitCorridor': {
      tactileStrip(c);
      wallBands(L, rects, c.sockets, [{ y0: 0, y1: 0.1, mat: 'metalDark', depth: 0.025 }]);
      if (c.defId === 'C19') {
        // 地下歩道: 額装ポスター（暗い無地）を 6 m ごとに両側。文字は 1 枚だけ
        let first = true;
        for (const w of sides) {
          for (const { t, i } of slots(w, 3.0, 0.5, 1.2)) {
            if (i % 2 === 1) continue;
            board(c, w, t, 0.9, 1.1, 2.4, 'wallDark');
            if (first) { wallSign(c, w, t, 1.75, 0.04, 0.85, { text: 'どこかで、きっと、また。', kind: 'plate', color: 0xe8e4d8, background: 0x2a2f3a }); first = false; }
          }
        }
      } else {
        // 駅の連絡通路: 吊り下げ案内板だけ。物は置かない
        const texts = ['← 1-4    5-8 →', '↑ 出口 / EXIT', '← 1-4    5-8 →'];
        c.segs.forEach((seg, j) => hangingSign(c, seg, j === 0 ? 0.4 : 0.5, 1.8, { text: texts[j % texts.length], kind: 'emissive', color: 0xffffff, background: 0x1b2a44 }));
      }
      lightRow(c, 'tubes', 3.0);
      break;
    }
    case 'CorridorOffice':
    default: {
      // オフィス廊下: 両側に木製扉（濃い枡）3.2 m 間隔 + 小さな番号プレート。汎用廊下（U01 / E13 など）は左側だけ 4 m 間隔。
      // グリッド天井 + トロファー 1 列。巾木・廻り縁は自動
      const office = tid === 'CorridorOffice';
      for (const w of office ? sides : left) for (const { t } of slots(w, office ? 3.2 : 4.0, 0.55, 1.2)) { decorDoor(c, w, t, L.palette.door); if (office) doorPlate(c, w, t, num()); }
      lightRow(c, 'troffer', 3.6);
      break;
    }
  }
}
