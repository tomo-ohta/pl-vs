/**
 * 部屋系テンプレートの「大物」家具をコード生成の箱で本物の比率に組むヘルパーと、壁面サイン（L.signs）の配置。
 * 参考画像の分析（docs/reference-common-analysis.md）に従い、細かい小物は作らない。
 *
 * - 家具は「当たり判定になる少数のソリッド箱 + 見た目の非ソリッド薄箱」。RoomBuilder / ArchitecturalDetails の自動細部
 *   （shelfMetal スラブ → 支柱 + 段板、薄い lightPanel → 金属トレイ + 2 管のリブ、wall* → 巾木・廻り縁）を前提に寸法を選ぶ。
 * - 扉前の空間は clearDoorways に任せず、ここで doorZones() を見て「ユニットごと」置かない（非ソリッドの細部だけ残るのを防ぐ）。
 * - 乱数は呼び出し側の専用 fork（rng.fork('ref')）を受け取る。
 */
import { aabbFromCenter, type AABB } from '../core/aabb';
import type { Dir, Socket, Vec3 } from '../core/types';
import type { Rng } from '../core/rng';
import { across, along, wallSpans, type Rect } from './footprint';
import { box, WALL_T, type Box, type MatId, type RoomLayout, type SignSpec } from './layout';

// ---------------------------------------------------------------- 表示用の意味タグ

/**
 * ヘルパが push した箱（from 以降）に表示用グループ id（Box.propGroup）を付け、主箱（primary）に kind を付ける。
 * RoomBuilder → ArchitecturalDetails（props/FurnitureShapes）がグループ単位で専用形状に描き替える。当たり判定・乱数・セーブ形式は変えない。
 */
export function tagGroup(B: Box[], from: number, group: string, kind: string, primary = from): void {
  for (let i = from; i < B.length; i++) B[i].propGroup = group;
  if (primary >= from && primary < B.length) B[primary].kind = kind;
}

const gid = (kind: string, ...v: number[]): string => `${kind}@${v.map((x) => x.toFixed(2)).join(',')}`;

// ---------------------------------------------------------------- 壁の室内面

/** 壁の室内面。dir は壁の外向き（footprint の Edge.dir）、face は室内面の座標（horizontal なら z、縦なら x）、inward は室内向きの符号 */
export interface Face {
  dir: Dir;
  horizontal: boolean;
  face: number;
  inward: 1 | -1;
  a0: number;
  a1: number;
  /** 壁の外面座標（ソケットの照合用） */
  coord: number;
}

export function innerFaces(rects: Rect[]): Face[] {
  return wallSpans(rects).map((s) => {
    const d = s.edge.dir;
    const inward: 1 | -1 = d === 0 || d === 1 ? -1 : 1;
    return { dir: d, horizontal: d === 0 || d === 2, face: s.edge.coord + inward * WALL_T, inward, a0: s.a0, a1: s.a1, coord: s.edge.coord };
  });
}

/** 面 f 上で開口（同じ壁のソケット ± pad）を除いた区間 */
export function freeRuns(f: Face, sockets: Socket[], pad = 1.0): [number, number][] {
  const cuts: [number, number][] = sockets
    .filter((s) => s.type !== 'hole' && s.dir === f.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - f.coord) < 0.05)
    .map((s) => [along(s.dir, s.pos[0], s.pos[2]) - s.width / 2 - pad, along(s.dir, s.pos[0], s.pos[2]) + s.width / 2 + pad] as [number, number])
    .sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = f.a0;
  for (const [p, q] of cuts) {
    if (p > cur + 1e-6) out.push([cur, Math.min(p, f.a1)]);
    cur = Math.max(cur, q);
    if (cur >= f.a1) break;
  }
  if (f.a1 > cur + 1e-6) out.push([cur, f.a1]);
  return out.filter(([p, q]) => q - p > 0.05);
}

/** 面 f の室内面から d0..d1 離れ、辺に沿って at..at+len、高さ y0..y1 の箱 */
export function alongFace(f: Face, at: number, len: number, d0: number, d1: number, y0: number, y1: number, mat: MatId, solid = true): Box {
  const n0 = f.face + f.inward * d0;
  const n1 = f.face + f.inward * d1;
  return f.horizontal
    ? box([at, y0, Math.min(n0, n1)], [at + len, y1, Math.max(n0, n1)], mat, solid)
    : box([Math.min(n0, n1), y0, at], [Math.max(n0, n1), y1, at + len], mat, solid);
}

/** 内部の線（島など）を Face として扱う。horizontal なら z = face の線、inward 側に家具を出す */
export function lineFace(horizontal: boolean, face: number, inward: 1 | -1, a0: number, a1: number): Face {
  return { dir: horizontal ? (inward > 0 ? 2 : 0) : (inward > 0 ? 3 : 1), horizontal, face, inward, a0, a1, coord: face - inward * WALL_T };
}

// ---------------------------------------------------------------- 扉前・着地点の禁止領域

/** clearDoorways と同じ扉前 1.8 m × 幅（ソケット幅 + 0.6、最小 1.6）の領域 + 床穴 + 着地点。ここに掛かる家具ユニットは置かない */
export function doorZones(sockets: Socket[], landing?: AABB | null, extra = 0.1): AABB[] {
  const zones: AABB[] = [];
  for (const s of sockets) {
    if (s.type === 'hole') {
      zones.push(aabbFromCenter(s.pos[0], 1.1, s.pos[2], 1.3 + extra, 1.2, 1.3 + extra));
      continue;
    }
    const half = Math.max(0.8, s.width / 2 + 0.3) + extra;
    const inward = s.dir === 0 ? [0, -1] : s.dir === 1 ? [-1, 0] : s.dir === 2 ? [0, 1] : [1, 0];
    const cx = s.pos[0] + inward[0] * 0.95;
    const cz = s.pos[2] + inward[1] * 0.95;
    const hx = s.dir === 0 || s.dir === 2 ? half : 0.95 + extra;
    const hz = s.dir === 0 || s.dir === 2 ? 0.95 + extra : half;
    zones.push({ min: [cx - hx, s.pos[1] - 0.1, cz - hz], max: [cx + hx, s.pos[1] + 2.2, cz + hz] });
  }
  if (landing) zones.push({ min: [landing.min[0] - 0.8, -0.1, landing.min[2] - 0.8], max: [landing.max[0] + 0.8, 2.2, landing.max[2] + 0.8] });
  return zones;
}

export function hitsZone(zones: AABB[], b: Box): boolean {
  return zones.some((z) => b.min[0] < z.max[0] && b.max[0] > z.min[0] && b.min[1] < z.max[1] && b.max[1] > z.min[1] && b.min[2] < z.max[2] && b.max[2] > z.min[2]);
}

/** 箱が足跡のどれかの矩形の内側（margin）に収まるか */
export function insideRects(rects: Rect[], b: Box, margin = WALL_T): boolean {
  return rects.some((r) => b.min[0] >= r.x0 + margin - 1e-6 && b.max[0] <= r.x1 - margin + 1e-6 && b.min[2] >= r.z0 + margin - 1e-6 && b.max[2] <= r.z1 - margin + 1e-6);
}

// ---------------------------------------------------------------- サイン

/** 面 f の位置 at（中心）・高さ y（中心）に幅 width のサインを貼る。offset は室内面からの出（帯の手前に出す） */
export function signAt(L: RoomLayout, f: Face, at: number, y: number, width: number, text: string, o: { kind?: SignSpec['kind']; color?: number; background?: number; offset?: number; sub?: string; id?: string } = {}): void {
  const off = f.face + f.inward * (o.offset ?? 0.035);
  const pos: [number, number, number] = f.horizontal ? [at, y, off] : [off, y, at];
  const dir = ((f.dir + 2) % 4) as Dir;
  const spec: SignSpec = { text, pos, dir, width, kind: o.kind ?? 'plate' };
  if (o.color !== undefined) spec.color = o.color;
  if (o.background !== undefined) spec.background = o.background;
  if (o.sub) spec.sub = o.sub;
  if (o.id) spec.id = o.id;
  (L.signs ??= []).push(spec);
}

/** 開口を避けた最長区間の中央にサインを 1 枚。prefer に挙げた壁の向き（外向き dir）を優先する */
export function signOnWall(L: RoomLayout, faces: Face[], sockets: Socket[], text: string, o: { y: number; width: number; prefer?: Dir[]; kind?: SignSpec['kind']; color?: number; background?: number; offset?: number; sub?: string }): boolean {
  const cands: { f: Face; a0: number; a1: number; rank: number }[] = [];
  for (const f of faces) {
    for (const [a0, a1] of freeRuns(f, sockets, 0.6)) {
      if (a1 - a0 < o.width + 0.4) continue;
      const pi = o.prefer ? o.prefer.indexOf(f.dir) : -1;
      cands.push({ f, a0, a1, rank: pi >= 0 ? pi : 99 });
    }
  }
  if (cands.length === 0) return false;
  cands.sort((p, q) => p.rank - q.rank || (q.a1 - q.a0) - (p.a1 - p.a0));
  const c = cands[0];
  signAt(L, c.f, (c.a0 + c.a1) / 2, o.y, o.width, text, o);
  return true;
}

// ---------------------------------------------------------------- 家具ユニット（寸法は実物）

/** ロッカー列: 幅 0.4 単位 × 奥 0.5 × 高 1.8。本体 1 箱（ソリッド）+ 扉の溝（暗い細帯）・通気口・取っ手（非ソリッド）。
 *  a0 から n 台。standoff は室内面からの離れ（腰壁の帯の厚み分） */
export function lockerBank(B: Box[], f: Face, a0: number, n: number, standoff = 0.02, depth = 0.5, height = 1.8): void {
  if (n <= 0) return;
  const w = n * 0.4;
  const front = standoff + depth;
  const from = B.length;
  B.push(alongFace(f, a0, w, standoff, front, 0, height, 'lockerGreen', true));
  // 台輪（暗い足元）と天板の縁
  B.push(alongFace(f, a0, w, front - 0.01, front + 0.004, 0, 0.08, 'metalDark', false));
  B.push(alongFace(f, a0, w, front - 0.01, front + 0.004, height - 0.03, height, 'metalDark', false));
  for (let k = 0; k <= n; k++) {
    // 扉の縁の溝
    B.push(alongFace(f, a0 + k * 0.4 - 0.007, 0.014, front - 0.01, front + 0.003, 0.08, height - 0.03, 'metalDark', false));
  }
  for (let k = 0; k < n; k++) {
    const a = a0 + k * 0.4;
    // 通気口（上下に 2 段の横溝）
    for (const y of [0.32, 0.38, 1.42, 1.48]) B.push(alongFace(f, a + 0.11, 0.18, front - 0.006, front + 0.004, y, y + 0.022, 'metalDark', false));
    // 取っ手（右寄り）
    B.push(alongFace(f, a + 0.31, 0.03, front, front + 0.02, 0.98, 1.1, 'metalDark', false));
  }
  // 表示用タグ: 本体（from）が kind 'lockers'。描画側は本体の寸法と前面（取っ手の側）から扉・通気口・取っ手を描き直し、ここの薄箔は重ねない
  tagGroup(B, from, gid('lockers', f.dir, a0, f.face), 'lockers');
}

/** ロッカーを a0..a1 に 0.4 単位で並べる。禁止領域に掛かる台は飛ばし、連続する台をまとめて 1 列にする。置いた台数を返す */
export function lockersAlong(B: Box[], f: Face, a0: number, a1: number, zones: AABB[], rects: Rect[], standoff = 0.02): number {
  const n = Math.floor((a1 - a0 - 0.1) / 0.4);
  if (n <= 0) return 0;
  const start = a0 + (a1 - a0 - n * 0.4) / 2;
  let run = -1;
  let placed = 0;
  const flush = (end: number) => {
    if (run >= 0 && end > run) lockerBank(B, f, start + run * 0.4, end - run, standoff);
    placed += run >= 0 ? end - run : 0;
    run = -1;
  };
  for (let k = 0; k < n; k++) {
    const unit = alongFace(f, start + k * 0.4, 0.4, standoff, standoff + 0.5, 0, 1.8, 'lockerGreen');
    const ok = !hitsZone(zones, unit) && insideRects(rects, unit, WALL_T - 0.001);
    if (ok && run < 0) run = k;
    if (!ok) flush(k);
  }
  flush(n);
  return placed;
}

/** 木のベンチ: 天板 handrailWood 0.35 幅 × 高 0.45（ソリッド）、metalDark の脚（非ソリッド） */
export function bench(B: Box[], alongX: boolean, cx: number, cz: number, len: number): void {
  const hw = 0.175;
  const from = B.length;
  const top = alongX ? box([cx - len / 2, 0.4, cz - hw], [cx + len / 2, 0.45, cz + hw], 'handrailWood') : box([cx - hw, 0.4, cz - len / 2], [cx + hw, 0.45, cz + len / 2], 'handrailWood');
  B.push(top);
  const legs = Math.max(2, Math.ceil(len / 1.5) + 1);
  for (let i = 0; i < legs; i++) {
    const t = -len / 2 + 0.2 + (len - 0.4) * (legs === 1 ? 0.5 : i / (legs - 1));
    const lx = alongX ? cx + t : cx;
    const lz = alongX ? cz : cz + t;
    if (alongX) B.push(box([lx - 0.02, 0, lz - hw + 0.03], [lx + 0.02, 0.4, lz + hw - 0.03], 'metalDark', false));
    else B.push(box([lx - hw + 0.03, 0, lz - 0.02], [lx + hw - 0.03, 0.4, lz + 0.02], 'metalDark', false));
  }
  tagGroup(B, from, gid('bench', cx, cz), 'bench');
}

/** 長机 1.8 × 0.75 × 高 0.72: 天板 3 cm（ソリッド）+ 幕板（非ソリッド）+ metalDark の脚 5 cm（ソリッド） */
export function longTable(B: Box[], cx: number, cz: number, alongX: boolean, len = 1.8, dep = 0.75, h = 0.72): void {
  const hx = alongX ? len / 2 : dep / 2;
  const hz = alongX ? dep / 2 : len / 2;
  B.push(box([cx - hx, h - 0.03, cz - hz], [cx + hx, h, cz + hz], 'furnitureLight'));
  B.push(box([cx - hx + 0.1, h - 0.1, cz - hz + 0.1], [cx + hx - 0.1, h - 0.03, cz + hz - 0.1], 'furnitureLight', false));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = cx + sx * (hx - 0.08);
    const lz = cz + sz * (hz - 0.08);
    B.push(box([lx - 0.025, 0, lz - 0.025], [lx + 0.025, h - 0.03, lz + 0.025], 'metalDark'));
  }
}

/** 椅子: 座 0.45 × 0.45 高 0.45 + 背 0.4（seatBlue、ソリッド）、metalDark の脚（非ソリッド）。facing は座った人が向く方向 */
export function chair(B: Box[], cx: number, cz: number, facing: Dir): void {
  const s = 0.225;
  const from = B.length;
  B.push(box([cx - s, 0.41, cz - s], [cx + s, 0.45, cz + s], 'seatBlue'));
  const back = (): Box => {
    switch (facing) {
      case 0: return box([cx - s, 0.45, cz - s], [cx + s, 0.85, cz - s + 0.05], 'seatBlue');
      case 2: return box([cx - s, 0.45, cz + s - 0.05], [cx + s, 0.85, cz + s], 'seatBlue');
      case 1: return box([cx - s, 0.45, cz - s], [cx - s + 0.05, 0.85, cz + s], 'seatBlue');
      default: return box([cx + s - 0.05, 0.45, cz - s], [cx + s, 0.85, cz + s], 'seatBlue');
    }
  };
  B.push(back());
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = cx + sx * (s - 0.04);
    const lz = cz + sz * (s - 0.04);
    B.push(box([lx - 0.015, 0, lz - 0.015], [lx + 0.015, 0.41, lz + 0.015], 'metalDark', false));
  }
  // 表示用タグ: 座（from）が kind 'chair'。向きは背の箱の位置から描画側が読む
  tagGroup(B, from, gid('chair', cx, cz), 'chair');
}

/** 連結椅子（待合ベンチ）: n 席 × 0.5 ピッチ。座 0.45 × 0.45 高 0.45 + 背 0.4、metalDark の梁と脚。facing は座った人が向く方向 */
export function linkedSeats(B: Box[], cx: number, cz: number, n: number, facing: Dir): void {
  const len = n * 0.5;
  const alongX = facing === 0 || facing === 2; // 列は facing と直交
  const s = 0.225;
  const from = B.length;
  // 梁（床上 0.33〜0.38）と両端の脚
  if (alongX) B.push(box([cx - len / 2 + 0.05, 0.33, cz - 0.03], [cx + len / 2 - 0.05, 0.38, cz + 0.03], 'metalDark', false));
  else B.push(box([cx - 0.03, 0.33, cz - len / 2 + 0.05], [cx + 0.03, 0.38, cz + len / 2 - 0.05], 'metalDark', false));
  for (const e of [-1, 1]) {
    const t = e * (len / 2 - 0.12);
    if (alongX) B.push(box([cx + t - 0.02, 0, cz - s + 0.02], [cx + t + 0.02, 0.33, cz + s - 0.02], 'metalDark', false));
    else B.push(box([cx - s + 0.02, 0, cz + t - 0.02], [cx + s - 0.02, 0.33, cz + t + 0.02], 'metalDark', false));
  }
  for (let k = 0; k < n; k++) {
    const t = -len / 2 + 0.25 + k * 0.5;
    const ux = alongX ? cx + t : cx;
    const uz = alongX ? cz : cz + t;
    B.push(box([ux - s, 0.38, uz - s], [ux + s, 0.45, uz + s], 'seatBlue'));
    switch (facing) {
      case 0: B.push(box([ux - s, 0.45, uz - s], [ux + s, 0.85, uz - s + 0.06], 'seatBlue')); break;
      case 2: B.push(box([ux - s, 0.45, uz + s - 0.06], [ux + s, 0.85, uz + s], 'seatBlue')); break;
      case 1: B.push(box([ux - s, 0.45, uz - s], [ux - s + 0.06, 0.85, uz + s], 'seatBlue')); break;
      default: B.push(box([ux + s - 0.06, 0.45, uz - s], [ux + s, 0.85, uz + s], 'seatBlue')); break;
    }
  }
  // 表示用タグ: 梁（from）が kind 'linkedSeats'。席数は列の長さ / 0.5、向きは背の箱の位置から描画側が読む
  tagGroup(B, from, gid('linkedSeats', cx, cz), 'linkedSeats');
}

/** 自販機 0.9 × 0.8 × 1.85: 暗い筐体（ソリッド）+ 前面の発光箔 + 下部の取り出し口 */
export function vending(B: Box[], f: Face, at: number, glow: MatId = 'lightPanel'): void {
  const d0 = 0.05, d1 = 0.85;
  const from = B.length;
  B.push(alongFace(f, at, 0.9, d0, d1, 0, 1.85, 'metalDark', true));
  B.push(alongFace(f, at + 0.08, 0.66, d1, d1 + 0.012, 0.78, 1.72, glow, false));
  B.push(alongFace(f, at + 0.08, 0.66, d1, d1 + 0.01, 0.55, 0.72, 'shelfMetal', false));
  B.push(alongFace(f, at + 0.16, 0.5, d1, d1 + 0.012, 0.18, 0.42, 'metal', false));
  B.push(alongFace(f, at + 0.76, 0.1, d1, d1 + 0.018, 1.0, 1.35, 'shelfMetal', false));
  // 表示用タグ（kind 'vending'。前面の箔は既に方向付きなので描画側はそのまま描く）
  tagGroup(B, from, gid('vending', f.dir, at, f.face), 'vending');
}

/** カウンター（返却台・受付）: 本体（ソリッド）+ 天板 3 cm */
export function counter(B: Box[], f: Face, at: number, len: number, depth = 0.6, h = 0.9, base: MatId = 'shelfMetal', top: MatId = 'metal', standoff = 0.02): void {
  B.push(alongFace(f, at, len, standoff, standoff + depth, 0, h - 0.03, base, true));
  B.push(alongFace(f, at - 0.02, len + 0.04, standoff, standoff + depth + 0.03, h - 0.03, h, top, false));
}

// ---------------------------------------------------------------- 窓（壁を実際に抜き、外に夜景を置く）

/** 窓の開口。面 f（壁の室内面）の a0..a1、高さ y0..y1。buildShell に windowSocket() を渡して壁を抜き、シェルの後に windowGlazing() で埋める */
export interface WindowOpening {
  face: Face;
  a0: number;
  a1: number;
  y0: number;
  y1: number;
}

/** buildShell 用の擬似ソケット（壁の外面座標に置く）。L.sockets には入れない（接続には使わない） */
export function windowSocket(o: WindowOpening, id: string): Socket {
  const f = o.face;
  const t = (o.a0 + o.a1) / 2;
  const pos: Vec3 = f.horizontal ? [t, 0, f.coord] : [f.coord, 0, t];
  return { id, type: 'door', pos, dir: f.dir, width: o.a1 - o.a0, height: o.y1 - o.y0, sill: o.y0 };
}

/** 夜景の箔の位置（壁の外面側。室内面から WALL_T − 6〜12 mm 奥 = ガラスから約 9 cm 奥） */
export const WINDOW_NIGHT_INSET: [number, number] = [-(WALL_T - 0.006), -(WALL_T - 0.012)];

/**
 * 窓の中身（開口は buildShell 側で抜いてある前提）:
 *   夜景 'windowNight'（開口より上下左右に大きく。余白は壁の中に隠れる）/ ガラス（ソリッド: 開口を塞ぐ当たり判定。透過は材質の opacity）/
 *   窓台（壁の上端を覆い 9 cm 室内へ出る）/ 上桟 / metalDark の方立 1.5 m 間隔
 * 外の見え方（暗い駐車場と街灯など）は担当 M の windowNight テクスチャに委ねる
 */
export function windowGlazing(B: Box[], o: WindowOpening): void {
  const { face: f, a0, a1, y0, y1 } = o;
  const len = a1 - a0;
  if (len < 0.3) return;
  B.push(alongFace(f, a0 - 0.15, len + 0.3, WINDOW_NIGHT_INSET[0], WINDOW_NIGHT_INSET[1], y0 - 0.12, y1 + 0.12, 'windowNight', false));
  B.push(alongFace(f, a0, len, 0.045, 0.06, y0, y1, 'glass', true));
  B.push(alongFace(f, a0 - 0.03, len + 0.06, -(WALL_T - 0.005), 0.09, y0, y0 + 0.025, 'trim', false));
  // 上桟・方立ては 0.065 までガラス（0.06）より手前に出す（同一平面にすると z-fight で縞が出る）
  B.push(alongFace(f, a0, len, 0.0, 0.065, y1 - 0.05, y1, 'metalDark', false));
  const n = Math.max(1, Math.round(len / 1.5));
  for (let k = 0; k <= n; k++) {
    const a = a0 + (len * k) / n;
    B.push(alongFace(f, Math.min(a1 - 0.04, Math.max(a0, a - 0.02)), 0.04, 0.0, 0.065, y0, y1, 'metalDark', false));
  }
}

// ---------------------------------------------------------------- バックヤード・トイレの大物

/**
 * カゴ車（ロールボックスパレット）0.8 × 1.1 × 1.7: 壁沿い、長辺（1.1）を壁に平行に。
 * 当たり判定はデッキ（床上 0.18〜0.22）と中の段ボール（ソリッド）。金属の格子は細い非ソリッド箱（支柱 4 + 横桟 5 段 × 3 面 + 縦桟）。
 */
export function rollCage(B: Box[], rng: Rng, f: Face, at: number, standoff = 0.06): void {
  const w = 1.1, d = 0.8, h = 1.7;
  const d0 = standoff, d1 = standoff + d;
  // デッキとキャスター
  B.push(alongFace(f, at, w, d0, d1, 0.18, 0.22, 'metalDark', true));
  for (const [u, v] of [[0.05, 0.05], [w - 0.13, 0.05], [0.05, d - 0.13], [w - 0.13, d - 0.13]]) B.push(alongFace(f, at + u, 0.08, d0 + v, d0 + v + 0.08, 0.04, 0.18, 'metalDark', false));
  // 支柱（4 隅）
  for (const [u, v] of [[0, 0], [w - 0.03, 0], [0, d - 0.03], [w - 0.03, d - 0.03]]) B.push(alongFace(f, at + u, 0.03, d0 + v, d0 + v + 0.03, 0.18, h, 'metal', false));
  // 横桟: 背面（壁側）と両側面。前面は開いている
  for (const y of [0.45, 0.75, 1.05, 1.35, 1.65]) {
    B.push(alongFace(f, at + 0.03, w - 0.06, d0, d0 + 0.015, y, y + 0.015, 'metal', false));
    B.push(alongFace(f, at, 0.015, d0 + 0.03, d1 - 0.03, y, y + 0.015, 'metal', false));
    B.push(alongFace(f, at + w - 0.015, 0.015, d0 + 0.03, d1 - 0.03, y, y + 0.015, 'metal', false));
  }
  // 縦桟（背面 4 本・側面 2 本ずつ）
  for (let k = 1; k <= 4; k++) B.push(alongFace(f, at + (w * k) / 5 - 0.006, 0.012, d0, d0 + 0.012, 0.22, h - 0.02, 'metal', false));
  for (let k = 1; k <= 2; k++) {
    const v = d0 + (d * k) / 3;
    B.push(alongFace(f, at, 0.012, v - 0.006, v + 0.006, 0.22, h - 0.02, 'metal', false));
    B.push(alongFace(f, at + w - 0.012, 0.012, v - 0.006, v + 0.006, 0.22, h - 0.02, 'metal', false));
  }
  // 中身: 段ボール 1〜2 段（ソリッド。中に入り込めないようにする）
  const bh = rng.float(0.45, 0.7);
  B.push(alongFace(f, at + 0.06, w - 0.12, d0 + 0.05, d1 - 0.05, 0.22, 0.22 + bh, 'boxCardboard', true));
  if (rng.chance(0.7)) {
    const bw = rng.float(0.5, w - 0.16);
    B.push(alongFace(f, at + 0.08 + rng.float(0, w - 0.16 - bw), bw, d0 + 0.08, d1 - 0.1, 0.22 + bh, Math.min(h - 0.15, 0.22 + bh + rng.float(0.35, 0.6)), 'boxCardboard', true));
  }
}

/** 小便器の列: 壁掛けの白い器（0.35 × 0.6 × 0.4、床上 0.55、ソリッド）+ 洗浄管 + センサー板 + 間の仕切り板。ピッチ 0.75 */
export function urinalRow(B: Box[], f: Face, a0: number, n: number): void {
  if (n <= 0) return;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * 0.75;
    B.push(alongFace(f, a + 0.2, 0.35, 0.02, 0.42, 0.55, 1.15, 'signPlate', true));
    B.push(alongFace(f, a + 0.2 + 0.04, 0.27, 0.42, 0.44, 0.62, 0.72, 'metalDark', false));
    B.push(alongFace(f, a + 0.36, 0.03, 0.02, 0.05, 1.15, 1.45, 'metal', false));
    B.push(alongFace(f, a + 0.3, 0.15, 0.0, 0.02, 1.45, 1.6, 'metal', false));
    if (k < n - 1) B.push(alongFace(f, a + 0.735, 0.03, 0.0, 0.45, 0.6, 1.5, 'furnitureLight', false));
  }
}

/** 洗濯機 0.6 × 0.6 × 0.85（白い筐体）+ 丸窓（glass、裏はドラムの暗色）+ 操作パネル。stacked なら上に乾燥機を重ねる */
export function washer(B: Box[], f: Face, at: number, stacked = false): void {
  const d0 = 0.03, d1 = 0.63;
  const unit = (y: number, dryer: boolean) => {
    B.push(alongFace(f, at, 0.6, d0, d1, y, y + 0.85, 'shelfMetal', true));
    B.push(alongFace(f, at + 0.12, 0.36, d1, d1 + 0.012, y + 0.2, y + 0.56, 'metalDark', false));
    // 丸窓は暗い艶ガラス（carGlass）。透過ガラス（glass）は transmission の再描画パスを増やすので使わない
    B.push(alongFace(f, at + 0.15, 0.3, d1, d1 + 0.02, y + 0.23, y + 0.53, 'carGlass', false));
    B.push(alongFace(f, at + 0.05, 0.5, d1, d1 + 0.01, y + (dryer ? 0.06 : 0.7), y + (dryer ? 0.16 : 0.8), 'metalDark', false));
  };
  unit(0, false);
  if (stacked) unit(0.85, true);
}

/** トイレブース: 幅 0.9 × 奥 1.4、間仕切りは床から 0.15 浮き、高さ 2.05（扉 0.7 幅 × 高 1.9）。n 室を a0 から */
export function booths(B: Box[], f: Face, a0: number, n: number, depth = 1.4, mat: MatId = 'furnitureLight'): void {
  if (n <= 0) return;
  const w = 0.9, t = 0.03, yb = 0.15, yt = 2.05;
  for (let k = 0; k <= n; k++) {
    const a = a0 + k * w;
    B.push(alongFace(f, a - t / 2, t, 0.0, depth, yb, yt, mat, true));
  }
  for (let k = 0; k < n; k++) {
    const a = a0 + k * w;
    // 前板: 固定部 0.1 + 扉 0.7 + 固定部 0.1。扉は少し奥に引く
    B.push(alongFace(f, a, 0.11, depth - t, depth, yb, yt, mat, true));
    B.push(alongFace(f, a + 0.79, 0.11, depth - t, depth, yb, yt, mat, true));
    B.push(alongFace(f, a + 0.11, 0.68, depth - t - 0.015, depth - 0.015, yb, yt, mat, true));
    B.push(alongFace(f, a + 0.108, 0.006, depth - t - 0.02, depth - 0.01, yb, yt, 'metalDark', false));
    B.push(alongFace(f, a + 0.786, 0.006, depth - t - 0.02, depth - 0.01, yb, yt, 'metalDark', false));
    B.push(alongFace(f, a + 0.7, 0.05, depth - 0.015, depth + 0.012, 1.0, 1.06, 'metal', false));
  }
  // 上部の笠木
  B.push(alongFace(f, a0 - t / 2, n * w + t, 0.0, depth, yt, yt + 0.04, 'metalDark', false));
}

/** 洗面台の列: 壁掛けの白い洗面器（0.5 × 0.45 × 0.2）+ 蛇口 + 上の鏡帯。ピッチ 0.75 */
export function sinkRow(B: Box[], f: Face, a0: number, n: number): void {
  if (n <= 0) return;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * 0.75;
    B.push(alongFace(f, a + 0.125, 0.5, 0.02, 0.47, 0.72, 0.9, 'wallWhite', true));
    B.push(alongFace(f, a + 0.125 + 0.05, 0.4, 0.06, 0.42, 0.9, 0.915, 'wallWhite', false));
    B.push(alongFace(f, a + 0.36, 0.03, 0.05, 0.08, 0.9, 1.03, 'metal', false));
    B.push(alongFace(f, a + 0.32, 0.11, 0.06, 0.2, 1.0, 1.03, 'metal', false));
    B.push(alongFace(f, a + 0.35, 0.05, 0.02, 0.06, 0.2, 0.72, 'metal', false));
  }
  B.push(alongFace(f, a0 + 0.08, n * 0.75 - 0.16, 0.004, 0.016, 1.1, 1.9, 'carGlass', false));
  B.push(alongFace(f, a0 + 0.06, n * 0.75 - 0.12, 0.0, 0.02, 1.9, 1.93, 'metalDark', false));
  B.push(alongFace(f, a0 + 0.06, n * 0.75 - 0.12, 0.0, 0.02, 1.07, 1.1, 'metalDark', false));
}

/** スチール棚（支柱 + 段板は ArchitecturalDetails が shelfMetal スラブから描く）+ 段に段ボール箱（幅・高さに揺らぎ、隙間あり）。
 *  段の高さは描画側と同じ式（y + 0.25 から max(0.9, h/3) ごと） */
export function rack(B: Box[], rng: Rng, x0: number, z0: number, x1: number, z1: number, height: number, fillChance = 0.78): void {
  B.push(box([x0, 0, z0], [x1, height, z1], 'shelfMetal'));
  const alongX = x1 - x0 >= z1 - z0;
  const len = alongX ? x1 - x0 : z1 - z0;
  const depth = alongX ? z1 - z0 : x1 - x0;
  const step = Math.max(0.9, height / 3);
  for (let level = 0.25; level + 0.05 + 0.3 < height - 0.05; level += step) {
    const top = level + 0.05;
    const room = Math.min(step, height - 0.05 - top) - 0.06; // この段に積める高さ
    let t = 0.06;
    while (t + 0.35 <= len - 0.06) {
      const bw = rng.float(0.5, 0.9);
      if (t + bw > len - 0.06) break;
      const bd = Math.max(0.4, depth - rng.float(0.08, 0.25));
      const c = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
      if (rng.chance(fillChance)) {
        // 1〜2 段に積む（下は大きく、上は少し小さい）
        const tiers = room > 0.9 && rng.chance(0.45) ? 2 : 1;
        let y = top;
        for (let k = 0; k < tiers; k++) {
          const maxH = Math.max(0.3, (room - (y - top)) - (tiers - k - 1) * 0.3 - 0.04);
          const bh = Math.min(maxH, rng.float(0.35, tiers === 1 ? 0.7 : 0.55));
          const w2 = k === 0 ? bw : bw * rng.float(0.75, 1.0);
          const d2 = k === 0 ? bd : bd * rng.float(0.8, 1.0);
          const off = (bd - d2) / 2;
          if (alongX) B.push(box([x0 + t + (bw - w2) / 2, y, c - bd / 2 + off], [x0 + t + (bw - w2) / 2 + w2, y + bh, c - bd / 2 + off + d2], 'boxCardboard', false));
          else B.push(box([c - bd / 2 + off, y, z0 + t + (bw - w2) / 2], [c - bd / 2 + off + d2, y + bh, z0 + t + (bw - w2) / 2 + w2], 'boxCardboard', false));
          y += bh;
          if (y + 0.3 > top + room) break;
        }
      }
      t += bw + rng.float(0.03, 0.18);
    }
  }
}

/** 露出蛍光管ペア（天井から 10 cm 下がる。ArchitecturalDetails が金属トレイと中央のリブを付ける） */
export function tubePair(B: Box[], x: number, z: number, alongX: boolean, h: number, mat: MatId = 'lightPanel', len = 1.2): void {
  const hx = alongX ? len / 2 : 0.15;
  const hz = alongX ? 0.15 : len / 2;
  B.push(box([x - hx, h - 0.13, z - hz], [x + hx, h - 0.09, z + hz], mat, false));
}

/** 吊り灯（倉庫の高所灯）: 吊り棒 + 笠 + 発光面 */
export function pendant(B: Box[], x: number, z: number, h: number, drop = 1.0, mat: MatId = 'lightPanel'): void {
  const y = h - drop;
  B.push(box([x - 0.015, y + 0.22, z - 0.015], [x + 0.015, h, z + 0.015], 'metalDark', false));
  B.push(box([x - 0.26, y, z - 0.26], [x + 0.26, y + 0.22, z + 0.26], 'metalDark', false));
  B.push(box([x - 0.21, y - 0.02, z - 0.21], [x + 0.21, y, z + 0.21], mat, false));
}

/** 床の線（白線・黄線）。非ソリッドの薄い箔 */
export function floorLine(B: Box[], x0: number, z0: number, x1: number, z1: number, mat: MatId): void {
  B.push(box([Math.min(x0, x1), 0.001, Math.min(z0, z1)], [Math.max(x0, x1), 0.012, Math.max(z0, z1)], mat, false));
}
