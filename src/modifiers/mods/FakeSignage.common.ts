/**
 * M-signs 共通ヘルパ（DuplicateNumber / FakeSignage / TemperatureField が共用）。
 * 壁面サイン（L.signs）の位置決め、偽扉の箔、空き壁スロット、出口ソケット、決定論ノイズ。
 * すべて純関数（乱数は呼び手が渡す。L の内容だけで結果が決まる）。
 *
 * 座標の約束: ソケットの pos は壁の「外面」の床位置、dir は外向き。壁帯は外面から WALL_T だけ室内側にある。
 * サインは壁の内面より FACE_OFFSET 室内側に置き、表面は室内（dir の反対）を向く。
 */
import type { AABB } from '../../core/aabb';
import { addDir, dirVec, type Dir, type Socket, type Vec3 } from '../../core/types';
import { across, along, spanForSocket, wallSpans, type WallSpan } from '../../generators/footprint';
import { box, WALL_T, type Box, type MatId, type RoomLayout, type SignSpec } from '../../generators/layout';

/** SignAtlas のセル比（幅 : 高さ = 4 : 1）。高さ h のサインは幅 h × SIGN_ASPECT */
export const SIGN_ASPECT = 4;
/** RoomBuilder が 1 部屋に描けるサイン数（アトラス 3 枚 × 16 セル）。超えた分は黙って捨てられる */
export const MAX_SIGNS = 48;
/** 壁内面からの浮かせ量（z-fighting 防止） */
export const FACE_OFFSET = 0.012;

export function opposite(d: Dir): Dir {
  return addDir(d, 2);
}

export function isZWall(d: Dir): boolean {
  return d === 0 || d === 2;
}

export function addScaled(a: Vec3, b: Vec3, k: number): Vec3 {
  return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
}

/** 外面位置 outerPos から、壁内面より inset だけ室内側の点（y は outerPos のまま） */
export function insideWall(outerPos: Vec3, outward: Dir, inset = WALL_T + FACE_OFFSET): Vec3 {
  return addScaled(outerPos, dirVec(outward), -inset);
}

/** 壁面サイン（内面に貼り、室内を向く）。outerPos は壁の外面上の位置（y は無視して引数 y を使う） */
export function wallSign(outerPos: Vec3, outward: Dir, y: number, width: number, text: string, o: Partial<SignSpec> = {}): SignSpec {
  const p = insideWall(outerPos, outward);
  return { text, pos: [p[0], y, p[2]], dir: opposite(outward), width, kind: 'plate', ...o };
}

/** 壁沿い座標 t と壁の外面座標 coord から外面の床位置を作る */
export function outerPosAt(outward: Dir, coord: number, t: number, y = 0): Vec3 {
  return isZWall(outward) ? [t, y, coord] : [coord, y, t];
}

/** 同じ壁の上で、区間 [t - half, t + half] に掛かるソケットがあるか */
export function socketOnWallNear(sockets: Socket[], outward: Dir, coord: number, t: number, half: number, except?: Socket): boolean {
  return sockets.some((s) => s !== except && s.type !== 'hole' && s.dir === outward
    && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - coord) < 0.06
    && Math.abs(along(s.dir, s.pos[0], s.pos[2]) - t) < s.width / 2 + half);
}

/**
 * ソケット（扉）の脇に銘板を置く。扉の右側（壁沿い座標 +）を優先し、壁区間の端や他のソケットに掛かれば左側を試す。
 * 壁区間が特定できない Generator（VerticalGenerator は footprint を持たない）では端の検査を省く。どちらにも置けなければ null
 */
export function signBesideSocket(L: RoomLayout, s: Socket, width: number, y: number, text: string, o: Partial<SignSpec> = {}): SignSpec | null {
  const spans = L.footprint.length ? wallSpans(L.footprint) : [];
  const span = spans.length ? spanForSocket(spans, s) : undefined;
  // 足跡があるのに壁区間に載っていないソケット（不正な extraSocket など）には貼らない
  if (spans.length && !span) return null;
  const coord = across(s.dir, s.pos[0], s.pos[2]);
  const t0 = along(s.dir, s.pos[0], s.pos[2]);
  for (const side of [1, -1]) {
    const t = t0 + side * (s.width / 2 + width / 2 + 0.12);
    if (span && (t - width / 2 < span.a0 + 0.08 || t + width / 2 > span.a1 - 0.08)) continue;
    if (socketOnWallNear(L.sockets, s.dir, coord, t, width / 2 + 0.05, s)) continue;
    return wallSign(outerPosAt(s.dir, coord, t), s.dir, y, width, text, o);
  }
  return null;
}

/**
 * 壁内面に貼る薄板。t0 / t1 は outerPos を基準にした壁沿いの相対座標、inset は内面からの距離、thick は板厚（室内側へ）
 * （CorridorGenerator.decorate の wallBand と同じ置き方）
 */
export function innerBand(outerPos: Vec3, outward: Dir, t0: number, t1: number, y0: number, y1: number, inset: number, thick: number, mat: MatId, solid = false): Box {
  const coord = across(outward, outerPos[0], outerPos[2]);
  const c = along(outward, outerPos[0], outerPos[2]);
  // dir 0 / 1 は座標の大きい側が外。内面は coord - WALL_T
  const lo = outward === 0 || outward === 1 ? coord - WALL_T - inset - thick : coord + WALL_T + inset;
  const hi = lo + thick;
  return isZWall(outward) ? box([c + t0, y0, lo], [c + t1, y1, hi], mat, solid) : box([lo, y0, c + t0], [hi, y1, c + t1], mat, solid);
}

/** 開かない偽扉（扉パネルの箔 + 枡）。壁は塞がったままなので通れない */
export function fakeDoorBoxes(outerPos: Vec3, outward: Dir, doorMat: MatId, w = 0.9, h = 2.05): Box[] {
  return [
    innerBand(outerPos, outward, -w / 2, w / 2, 0, h, 0, 0.03, doorMat),
    innerBand(outerPos, outward, -w / 2 - 0.08, w / 2 + 0.08, h, h + 0.1, 0, 0.06, 'trim'),
    innerBand(outerPos, outward, -w / 2 - 0.08, -w / 2, 0, h, 0, 0.06, 'trim'),
    innerBand(outerPos, outward, w / 2, w / 2 + 0.08, 0, h, 0, 0.06, 'trim'),
  ];
}

// ---------------------------------------------------------------- AABB / 内装

export function overlapsAABB(a: AABB, b: AABB, pad = 0): boolean {
  return a.min[0] < b.max[0] + pad && a.max[0] > b.min[0] - pad
    && a.min[1] < b.max[1] + pad && a.max[1] > b.min[1] - pad
    && a.min[2] < b.max[2] + pad && a.max[2] > b.min[2] - pad;
}

export function centerOf(b: AABB): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

export function sizeOf(b: AABB): Vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

/** シェル以降のソリッド箱 */
export function interiorSolids(L: RoomLayout): Box[] {
  return L.boxes.slice(L.shellCount ?? 0).filter((b) => b.solid);
}

/** 扉の前後 1.8 m × 幅（+0.6）× 高 2.2 m の通路帯（common.clearDoorways と同じ領域）に掛かるか */
export function blocksDoorway(bb: AABB, sockets: Socket[]): boolean {
  for (const s of sockets) {
    if (s.type === 'hole') {
      const z: AABB = { min: [s.pos[0] - 1.3, -0.1, s.pos[2] - 1.3], max: [s.pos[0] + 1.3, 2.3, s.pos[2] + 1.3] };
      if (overlapsAABB(z, bb)) return true;
      continue;
    }
    const half = Math.max(0.8, s.width / 2 + 0.3);
    const inward = dirVec(opposite(s.dir));
    const cx = s.pos[0] + inward[0] * 0.9;
    const cz = s.pos[2] + inward[2] * 0.9;
    const hx = isZWall(s.dir) ? half : 0.9;
    const hz = isZWall(s.dir) ? 0.9 : half;
    const z: AABB = { min: [cx - hx, s.pos[1] - 0.1, cz - hz], max: [cx + hx, s.pos[1] + 2.2, cz + hz] };
    if (overlapsAABB(z, bb)) return true;
  }
  return false;
}

/** AABB が足跡のいずれかの矩形に（壁厚 + margin を除いて）収まるか */
export function insideFootprint(L: RoomLayout, bb: AABB, margin = WALL_T): boolean {
  return L.footprint.some((r) => bb.min[0] >= r.x0 + margin && bb.max[0] <= r.x1 - margin && bb.min[2] >= r.z0 + margin && bb.max[2] <= r.z1 - margin);
}

/** 内装のソリッド・扉前・足跡外・床穴に掛からない置き場か */
export function canPlaceSolid(L: RoomLayout, bb: AABB, solids: Box[] = interiorSolids(L), pad = 0.1): boolean {
  if (!insideFootprint(L, bb)) return false;
  if (blocksDoorway(bb, L.sockets)) return false;
  if (L.holes.some((h) => overlapsAABB({ min: [h.min[0], -1, h.min[2]], max: [h.max[0], 3, h.max[2]] }, bb, 0.6))) return false;
  return !solids.some((s) => overlapsAABB(s, bb, pad));
}

// ---------------------------------------------------------------- 壁スロット

/** 空き壁のスロット。pos は壁外面の床位置、dir は外向き */
export interface WallSlot {
  pos: Vec3;
  dir: Dir;
  t: number;
  span: WallSpan;
}

/**
 * ソケット・内装ソリッドを避けた壁面の空きスロットを spacing 間隔で列挙する（決定論。wallSpans の順）。
 * width × height の面を y（中心高）に掛け、壁の手前 depth に solid が無いことを確認する
 */
export function blankWallSlots(L: RoomLayout, o: { width: number; height: number; y: number; clearance?: number; depth?: number; spacing?: number; margin?: number }): WallSlot[] {
  const out: WallSlot[] = [];
  const solids = interiorSolids(L);
  const clearance = o.clearance ?? 0.6;
  const depth = o.depth ?? 0.6;
  const spacing = o.spacing ?? 1.5;
  const margin = o.margin ?? 0.5;
  for (const span of wallSpans(L.footprint)) {
    const d = span.edge.dir;
    const coord = span.edge.coord;
    if (span.a1 - span.a0 < o.width + margin * 2) continue;
    for (let t = span.a0 + margin + o.width / 2; t <= span.a1 - margin - o.width / 2 + 1e-6; t += spacing) {
      if (socketOnWallNear(L.sockets, d, coord, t, o.width / 2 + clearance)) continue;
      const pos = outerPosAt(d, coord, t);
      const inner = insideWall(pos, d, WALL_T);
      const n = dirVec(opposite(d));
      const far = addScaled(inner, n, depth);
      const bb: AABB = {
        min: [Math.min(inner[0], far[0]) - (isZWall(d) ? o.width / 2 : 0), o.y - o.height / 2, Math.min(inner[2], far[2]) - (isZWall(d) ? 0 : o.width / 2)],
        max: [Math.max(inner[0], far[0]) + (isZWall(d) ? o.width / 2 : 0), o.y + o.height / 2, Math.max(inner[2], far[2]) + (isZWall(d) ? 0 : o.width / 2)],
      };
      if (solids.some((s) => overlapsAABB(s, bb))) continue;
      out.push({ pos, dir: d, t, span });
    }
  }
  return out;
}

// ---------------------------------------------------------------- ソケット

/** 入口・床穴以外のソケット（進行に使い得る開口。施錠は layout 時点では未確定） */
export function exitSockets(L: RoomLayout): Socket[] {
  return L.sockets.filter((s) => s.id !== 'entry' && s.type !== 'hole');
}

export function entrySocket(L: RoomLayout): Socket | undefined {
  return L.sockets.find((s) => s.id === 'entry');
}

/** 点 from から点 to への支配的な方向（|dx| と |dz| の大きい方） */
export function dominantDir(from: Vec3, to: Vec3): Dir {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 1 : 3;
  return dz >= 0 ? 0 : 2;
}

export function dist2D(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

// ---------------------------------------------------------------- 決定論ノイズ

/** 整数格子 (ix, iz) と salt から [0, 1) の値（呼ぶたび同じ） */
export function hash01(ix: number, iz: number, salt: number): number {
  let h = (salt ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (ix + 0x7fff), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (iz + 0x3fff), 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 0xRRGGBB を t（0..1）で線形補間 */
export function lerpColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** L.signs へ追加（上限 MAX_SIGNS を超える分は捨てる）。追加できた数を返す */
export function pushSigns(L: RoomLayout, signs: SignSpec[]): number {
  if (!L.signs) L.signs = [];
  let n = 0;
  for (const s of signs) {
    if (L.signs.length >= MAX_SIGNS) break;
    L.signs.push(s);
    n++;
  }
  return n;
}
