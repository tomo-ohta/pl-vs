/**
 * 壁面スロット探索の共通ヘルパ（M-snapshot 担当: GraphReference / PastWindow / SelfMap が共用）。
 * 外壁区間（footprint.wallSpans）から、ソケット（扉）と内装のソリッド箱を避けて「壁の内面に掛ける」位置を決める。
 * 乱数は使わない（レイアウトの決定論は L の内容だけで決まる）。build フックからも同じ結果が得られるので、
 * 位置の受け渡しに L.signs の id をアンカーとして使える。
 */
import type { AABB } from '../../core/aabb';
import { dirVec, type Dir, type Socket, type Vec3 } from '../../core/types';
import { along, wallSpans, type WallSpan } from '../../generators/footprint';
import { box, WALL_T, type Box, type MatId, type RoomLayout } from '../../generators/layout';

/** 壁面スロット。pos は壁の内面上の中心（床から y）。dir は表面が向く方向（部屋の内側） */
export interface WallSlot {
  pos: Vec3;
  dir: Dir;
  /** 辺に沿った座標 */
  t: number;
  span: WallSpan;
  /** 入口からの距離（m。並び順の決定に使う） */
  distFromEntry: number;
}

/** 辺の向き（外向き）→ 内側を向く表面の方向 */
export function inwardOf(edgeDir: Dir): Dir {
  return ((edgeDir + 2) % 4) as Dir;
}

/** 辺の内面座標（壁は矩形の内側 WALL_T） */
export function innerFace(span: WallSpan): number {
  const d = span.edge.dir;
  return d === 0 || d === 1 ? span.edge.coord - WALL_T : span.edge.coord + WALL_T;
}

/** 壁内面と同一平面にならないよう室内側へ出す量（サイン・箔の z-fighting 防止） */
export const FACE_OFFSET = 0.012;

function slotPos(span: WallSpan, t: number, y: number): Vec3 {
  const d = span.edge.dir;
  const n = dirVec(inwardOf(d));
  const face = innerFace(span) + (d === 0 || d === 2 ? n[2] : n[0]) * FACE_OFFSET;
  return d === 0 || d === 2 ? [t, y, face] : [face, y, t];
}

/** スロットの AABB（壁面に沿った w × h、奥行き depth） */
export function slotAABB(pos: Vec3, dir: Dir, w: number, h: number, depth: number, yCenter = true): AABB {
  const n = dirVec(dir);
  const y0 = yCenter ? pos[1] - h / 2 : pos[1];
  const y1 = y0 + h;
  if (dir === 0 || dir === 2) {
    const z0 = Math.min(pos[2], pos[2] + n[2] * depth);
    return { min: [pos[0] - w / 2, y0, z0], max: [pos[0] + w / 2, y1, z0 + depth] };
  }
  const x0 = Math.min(pos[0], pos[0] + n[0] * depth);
  return { min: [x0, y0, pos[2] - w / 2], max: [x0 + depth, y1, pos[2] + w / 2] };
}

function overlaps(a: AABB, b: AABB): boolean {
  return a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2];
}

export interface SlotOptions {
  /** 掛ける物の幅（m） */
  width: number;
  /** 掛ける物の高さ（m） */
  height: number;
  /** 中心の高さ（床から） */
  y: number;
  /** 同じ壁の中でのスロット間隔（中心間） */
  spacing?: number;
  /** ソケット（扉）からの最小距離（辺に沿って、開口の端から） */
  socketClearance?: number;
  /** 角からの最小距離 */
  cornerClearance?: number;
  /** 内装ソリッド箱との干渉判定に使う奥行き */
  depth?: number;
  /** この区間だけを使う（省略時は全外壁） */
  spans?: WallSpan[];
  /** 最大個数（省略時は全候補） */
  max?: number;
  /** 入口からの距離順に並べる（true: 近い順 / false: 遠い順）。省略時は長い壁の中央から */
  orderFromEntry?: boolean;
}

/**
 * 壁面スロットの候補を返す。
 * 長い壁を優先し、各壁では中央から外へ向かって spacing 間隔で置く。ソケット・角・内装ソリッド箱と干渉する位置は捨てる。
 */
export function wallSlots(L: RoomLayout, o: SlotOptions): WallSlot[] {
  const spacing = o.spacing ?? o.width + 0.6;
  const socketClear = o.socketClearance ?? 0.9;
  const cornerClear = o.cornerClearance ?? 0.5;
  const depth = o.depth ?? 0.35;
  const spans = (o.spans ?? wallSpans(L.footprint)).filter((s) => s.a1 - s.a0 >= o.width + cornerClear * 2).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0));
  const entry = L.sockets.find((s) => s.id === 'entry');
  const solids: AABB[] = L.boxes.slice(L.shellCount ?? 0).filter((b) => b.solid);
  const out: WallSlot[] = [];
  for (const span of spans) {
    const d = span.edge.dir;
    const onEdge: Socket[] = L.sockets.filter((s) => s.type !== 'hole' && s.dir === d && Math.abs((d === 0 || d === 2 ? s.pos[2] : s.pos[0]) - span.edge.coord) < 0.05);
    const lo = span.a0 + cornerClear + o.width / 2;
    const hi = span.a1 - cornerClear - o.width / 2;
    if (hi < lo) continue;
    const mid = (span.a0 + span.a1) / 2;
    const n = Math.floor((hi - lo) / spacing) + 1;
    // 中央から外へ
    const ts: number[] = [];
    const start = mid - ((n - 1) * spacing) / 2;
    for (let i = 0; i < n; i++) ts.push(start + i * spacing);
    ts.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    for (const t of ts) {
      if (t < lo || t > hi) continue;
      if (onEdge.some((s) => Math.abs(along(d, s.pos[0], s.pos[2]) - t) < s.width / 2 + o.width / 2 + socketClear)) continue;
      const pos = slotPos(span, t, o.y);
      const dir = inwardOf(d);
      const bb = slotAABB(pos, dir, o.width + 0.2, o.height + 0.2, depth);
      if (solids.some((b) => overlaps(b, bb))) continue;
      const distFromEntry = entry ? Math.hypot(pos[0] - entry.pos[0], pos[2] - entry.pos[2]) : 0;
      out.push({ pos, dir, t, span, distFromEntry });
    }
  }
  if (o.orderFromEntry !== undefined) out.sort((a, b) => (o.orderFromEntry ? a.distFromEntry - b.distFromEntry : b.distFromEntry - a.distFromEntry));
  return o.max !== undefined ? out.slice(0, o.max) : out;
}

/** 壁面に貼る薄い箔（非ソリッド）。pos は壁内面上の中心、offset だけ室内側へ出す */
export function foilBox(pos: Vec3, dir: Dir, w: number, h: number, thick: number, mat: MatId, offset = 0): Box {
  const n = dirVec(dir);
  const c: Vec3 = [pos[0] + n[0] * (offset + thick / 2), pos[1], pos[2] + n[2] * (offset + thick / 2)];
  const hw = dir === 0 || dir === 2 ? w / 2 : thick / 2;
  const hd = dir === 0 || dir === 2 ? thick / 2 : w / 2;
  return box([c[0] - hw, c[1] - h / 2, c[2] - hd], [c[0] + hw, c[1] + h / 2, c[2] + hd], mat, false);
}

/** 額縁（4 本の細い箔）。inner の外側に t 幅の枠を depth の厚みで作る */
export function frameBoxes(pos: Vec3, dir: Dir, innerW: number, innerH: number, t: number, depth: number, mat: MatId): Box[] {
  const n = dirVec(dir);
  const out: Box[] = [];
  // 壁に沿った横方向の単位ベクトル
  const u: Vec3 = dir === 0 || dir === 2 ? [1, 0, 0] : [0, 0, 1];
  const place = (cu: number, cy: number, w: number, h: number) => {
    const c: Vec3 = [pos[0] + u[0] * cu + n[0] * depth / 2, pos[1] + cy, pos[2] + u[2] * cu + n[2] * depth / 2];
    const hw = dir === 0 || dir === 2 ? w / 2 : depth / 2;
    const hd = dir === 0 || dir === 2 ? depth / 2 : w / 2;
    out.push(box([c[0] - hw, c[1] - h / 2, c[2] - hd], [c[0] + hw, c[1] + h / 2, c[2] + hd], mat, false));
  };
  place(0, innerH / 2 + t / 2, innerW + t * 2, t); // 上
  place(0, -innerH / 2 - t / 2, innerW + t * 2, t); // 下
  place(-innerW / 2 - t / 2, 0, t, innerH); // 左
  place(innerW / 2 + t / 2, 0, t, innerH); // 右
  return out;
}

/** 面の向き dir の Mesh 回転（PlaneGeometry の +Z 法線を dir に向ける）。RoomBuilder の facing と同じ */
export function yawOf(dir: Dir): number {
  return (dir * Math.PI) / 2;
}

/** 壁内面から offset だけ室内側へずらした点 */
export function offsetFromWall(pos: Vec3, dir: Dir, offset: number): Vec3 {
  const n = dirVec(dir);
  return [pos[0] + n[0] * offset, pos[1], pos[2] + n[2] * offset];
}

/** ソケットの扉前ゾーン（clearDoorways と同じ寸法）と AABB が重なるか */
export function blocksDoorway(bb: AABB, sockets: Socket[]): boolean {
  for (const s of sockets) {
    let zone: AABB;
    if (s.type === 'hole') {
      zone = { min: [s.pos[0] - 1.3, -0.1, s.pos[2] - 1.3], max: [s.pos[0] + 1.3, 2.3, s.pos[2] + 1.3] };
    } else {
      const half = Math.max(0.8, s.width / 2 + 0.3);
      const inward = dirVec(inwardOf(s.dir));
      const cx = s.pos[0] + inward[0] * 0.9;
      const cz = s.pos[2] + inward[2] * 0.9;
      const hx = s.dir === 0 || s.dir === 2 ? half : 0.9;
      const hz = s.dir === 0 || s.dir === 2 ? 0.9 : half;
      zone = { min: [cx - hx, s.pos[1] - 0.1, cz - hz], max: [cx + hx, s.pos[1] + 2.2, cz + hz] };
    }
    if (overlaps(bb, zone)) return true;
  }
  return false;
}

export { overlaps as aabbOverlaps };
