/** PoolGenerator の内装: 歩道デッキ・手すり・はしご・柱列・低い仕切り・レーンライン・排水溝・タイル色帯・サイン。
 *  水面は出さない（ShallowWater Modifier が footprint 全面に 0.25 m の水面と kind 'water' ゾーンを敷く）。
 *  水面を前提に高さを決める: デッキ上面 0.32（水面 0.25 より上、段差 0.35 以下で登れる）、仕切り 0.6、色帯 1.05〜1.25、
 *  水面下の箔（レーンライン・排水溝・グレーチング）は床すぐ上の非ソリッド。Modifier が無くても「水を抜いたプール回廊」として成立する。
 *  全ジオメトリは layout 段階で確定する（乱数は渡された rng のみ）。 */
import type { Dir, Socket } from '../core/types';
import type { Rng } from '../core/rng';
import type { AABB } from '../core/aabb';
import { across, along, clearOfSockets, wallSpans, type Rect, type WallSpan } from './footprint';
import { box, WALL_T, type Box, type MatId, type RoomLayout, type SignSpec } from './layout';
import { segAlong, segWidth, type PoolPlan, type PoolSeg } from './PoolGenerator.shapes';

/** デッキ上面（ShallowWater の前庭の縁 0.3 とほぼ同じ高さ。PlayerController の段差 0.35 未満） */
export const DECK_TOP = 0.32;
/** 低い仕切りの高さ（水面 0.25 の上に出る） */
const DIVIDER_H = 0.6;
const RAIL_TOP = 1.05;
const BAND_Y0 = 1.05;
const BAND_Y1 = 1.25;
/** デッキを分割する長さ（clearDoorways が塊ごと消しても被害を小さくする。チャンク境界にも優しい） */
const DECK_CHUNK = 6.0;

export interface PoolStyle {
  /** タイル色帯の材質 */
  bandMat: MatId;
  columnMat: MatId;
  dividerMat: MatId;
  /** 水深（サイン表示用。ShallowWater の params.depth と揃える） */
  depth: number;
}

/** 区間 [a0, a1] から cuts を引く */
function subtractIntervals(a0: number, a1: number, cuts: [number, number][]): [number, number][] {
  const sorted = cuts.filter(([p, q]) => q > p).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = a0;
  for (const [p, q] of sorted) {
    if (p > cur + 0.02) out.push([cur, Math.min(p, a1)]);
    cur = Math.max(cur, q);
    if (cur >= a1) break;
  }
  if (a1 > cur + 0.02) out.push([cur, a1]);
  return out;
}

/** 壁区間上のソケットが占める区間（pad は両側の余白） */
function socketCuts(span: WallSpan, sockets: Socket[], pad: number): [number, number][] {
  const d = span.edge.dir;
  return sockets
    .filter((s) => s.type !== 'hole' && s.dir === d && Math.abs(across(d, s.pos[0], s.pos[2]) - span.edge.coord) < 0.05)
    .map((s) => {
      const t = along(d, s.pos[0], s.pos[2]);
      return [t - s.width / 2 - pad, t + s.width / 2 + pad] as [number, number];
    });
}

/** 壁の内面から inset 離した位置に、辺に沿った箱を置く（depth は室内側への厚み） */
function alongEdgeBox(out: Box[], d: Dir, coord: number, t0: number, t1: number, inset: number, depth: number, y0: number, y1: number, mat: MatId, solid: boolean): void {
  // 内面: dir 0/1 は coord - WALL_T、dir 2/3 は coord + WALL_T
  switch (d) {
    case 0: out.push(box([t0, y0, coord - WALL_T - inset - depth], [t1, y1, coord - WALL_T - inset], mat, solid)); break;
    case 2: out.push(box([t0, y0, coord + WALL_T + inset], [t1, y1, coord + WALL_T + inset + depth], mat, solid)); break;
    case 1: out.push(box([coord - WALL_T - inset - depth, y0, t0], [coord - WALL_T - inset, y1, t1], mat, solid)); break;
    default: out.push(box([coord + WALL_T + inset, y0, t0], [coord + WALL_T + inset + depth, y1, t1], mat, solid)); break;
  }
}

/** 辺に沿った位置 t・内面からの距離 off の床位置 */
function pointOnEdge(d: Dir, coord: number, t: number, off: number): [number, number] {
  switch (d) {
    case 0: return [t, coord - WALL_T - off];
    case 2: return [t, coord + WALL_T + off];
    case 1: return [coord - WALL_T - off, t];
    default: return [coord + WALL_T + off, t];
  }
}

/** 区間を DECK_CHUNK ごとに刻む（端数 1.5 m 未満は前の塊に足す） */
function chunks(a0: number, a1: number): [number, number][] {
  const out: [number, number][] = [];
  let cur = a0;
  while (a1 - cur > DECK_CHUNK + 1.5) {
    out.push([cur, cur + DECK_CHUNK]);
    cur += DECK_CHUNK;
  }
  out.push([cur, a1]);
  return out;
}

/** 歩道デッキの幅（回廊幅 5 m 未満は無し） */
export function deckWidthFor(width: number): number {
  if (width < 5) return 0;
  return Math.min(2.0, Math.max(1.0, Math.round(width * 0.2 * 2) / 2));
}

/** 辺がセグメントの長手側か */
function isLongEdge(seg: PoolSeg, d: Dir): boolean {
  return seg.axis === 'z' ? d === 1 || d === 3 : d === 0 || d === 2;
}

/** 床穴が辺に沿った区間で占める範囲（デッキ・仕切りと重ならないように） */
function holeCut(hole: AABB | undefined, d: Dir, coord: number, depthFromWall: number, pad = 0.3): [number, number] | null {
  if (!hole) return null;
  const isZ = d === 0 || d === 2;
  // 帯の across 範囲
  const [b0, b1] = d === 0 ? [coord - WALL_T - depthFromWall, coord] : d === 2 ? [coord, coord + WALL_T + depthFromWall] : d === 1 ? [coord - WALL_T - depthFromWall, coord] : [coord, coord + WALL_T + depthFromWall];
  const hAcross: [number, number] = isZ ? [hole.min[2], hole.max[2]] : [hole.min[0], hole.max[0]];
  if (hAcross[1] + pad < b0 || hAcross[0] - pad > b1) return null;
  return isZ ? [hole.min[0] - pad, hole.max[0] + pad] : [hole.min[2] - pad, hole.max[2] + pad];
}

export function decoratePool(L: RoomLayout, plan: PoolPlan, sockets: Socket[], h: number, rng: Rng, style: PoolStyle): void {
  const B = L.boxes;
  const rects = plan.segs.map((s) => s.rect);
  const spans = wallSpans(rects);
  const segOf = (r: Rect) => plan.segs.find((s) => s.rect === r)!;
  const hole = L.holes[0];
  const junction = plan.junction;

  // ---- 壁区間ごと: デッキ / 手すり / はしご / 柱 / 排水溝 / 色帯
  let signSpan: { span: WallSpan; piece: [number, number] } | null = null;
  for (const sp of spans) {
    const seg = segOf(sp.edge.rect);
    const d = sp.edge.dir;
    const c = sp.edge.coord;
    const width = segWidth(seg);
    const long = isLongEdge(seg, d);
    const deckW = long ? deckWidthFor(width) : 0;

    // 色帯（全辺。開口は避ける）
    for (const [t0, t1] of subtractIntervals(sp.a0 + 0.05, sp.a1 - 0.05, socketCuts(sp, sockets, 0.35))) {
      if (t1 - t0 < 0.4) continue;
      alongEdgeBox(B, d, c, t0, t1, 0, 0.012, BAND_Y0, BAND_Y1, style.bandMat, false);
      if (long && t1 - t0 >= 3.2 && (!signSpan || t1 - t0 > signSpan.piece[1] - signSpan.piece[0])) signSpan = { span: sp, piece: [t0, t1] };
    }

    if (!long) continue;

    // デッキ（扉の前は前庭幅 = 扉幅 + 0.8 だけ空ける。床穴の脇も空ける）
    const cuts = socketCuts(sp, sockets, 0.4);
    const hc = deckW > 0 ? holeCut(hole, d, c, deckW) : null;
    if (hc) cuts.push(hc);
    const pieces = deckW > 0 ? subtractIntervals(sp.a0, sp.a1, cuts) : [];
    for (const [p0, p1] of pieces) {
      if (p1 - p0 < 0.8) continue;
      for (const [q0, q1] of chunks(p0, p1)) alongEdgeBox(B, d, c, q0, q1, 0, deckW, 0, DECK_TOP, 'floorTile', true);
      // 手すり（長い区画の中ほど。両端 1.2 m は開けて水路へ降りられる）
      if (p1 - p0 >= 4.5 && rng.chance(0.55)) {
        const r0 = p0 + 1.2;
        const r1 = p1 - 1.2;
        alongEdgeBox(B, d, c, r0, r1, deckW - 0.1, 0.05, RAIL_TOP - 0.05, RAIL_TOP, 'metal', true);
        alongEdgeBox(B, d, c, r0, r1, deckW - 0.09, 0.03, 0.66, 0.7, 'metal', false);
        const n = Math.max(2, Math.round((r1 - r0) / 1.6));
        for (let i = 0; i <= n; i++) {
          const t = r0 + ((r1 - r0) * i) / n;
          alongEdgeBox(B, d, c, t - 0.03, t + 0.03, deckW - 0.1, 0.06, DECK_TOP, RAIL_TOP - 0.05, 'metal', true);
        }
      }
      // はしご（デッキの縁から水路へ。非ソリッドの細い金物）
      if (p1 - p0 >= 6 && rng.chance(0.45)) {
        const t = Math.round((p0 + 0.6) * 2) / 2;
        alongEdgeBox(B, d, c, t - 0.25, t - 0.21, deckW, 0.04, 0.05, DECK_TOP + 0.6, 'metal', false);
        alongEdgeBox(B, d, c, t + 0.21, t + 0.25, deckW, 0.04, 0.05, DECK_TOP + 0.6, 'metal', false);
        alongEdgeBox(B, d, c, t - 0.25, t + 0.25, deckW, 0.04, 0.12, 0.15, 'metal', false);
        alongEdgeBox(B, d, c, t - 0.25, t + 0.25, deckW, 0.04, 0.42, 0.45, 'metal', false);
        alongEdgeBox(B, d, c, t - 0.25, t + 0.25, deckW - 0.2, 0.24, DECK_TOP + 0.57, DECK_TOP + 0.6, 'metal', false);
      }
      // 柱列（幅 6 m 以上。デッキの縁に立つ）
      if (width >= 6) {
        for (let t = p0 + 2.2; t <= p1 - 2.2; t += 4.5) {
          const [x, z] = pointOnEdge(d, c, t, deckW - 0.2);
          if (!clearOfSockets(sockets, x, z, 1.7)) continue;
          if (junction && x > junction.x0 - 0.6 && x < junction.x1 + 0.6 && z > junction.z0 - 0.6 && z < junction.z1 + 0.6) continue;
          B.push(box([x - 0.25, 0, z - 0.25], [x + 0.25, h, z + 0.25], style.columnMat));
        }
      }
    }

    // 排水溝（デッキの縁、無ければ壁際。水面下の暗い帯）
    for (const [t0, t1] of subtractIntervals(sp.a0 + 0.1, sp.a1 - 0.1, socketCuts(sp, sockets, 0.5))) {
      if (t1 - t0 < 0.6) continue;
      alongEdgeBox(B, d, c, t0, t1, deckW, 0.3, 0.002, 0.012, 'wallDark', false);
    }

    // 狭い回廊（デッキ無し）: タイルのベンチ
    if (deckW === 0 && sp.a1 - sp.a0 >= 6 && rng.chance(0.5)) {
      const t = Math.round(rng.float(sp.a0 + 1.5, sp.a1 - 1.5) * 2) / 2;
      const [x, z] = pointOnEdge(d, c, t, 0.2);
      if (clearOfSockets(sockets, x, z, 2.0)) alongEdgeBox(B, d, c, t - 1.0, t + 1.0, 0, 0.4, 0, 0.45, 'floorTile', true);
    }
  }

  // ---- セグメントごと: レーンライン / 仕切り / グレーチング
  for (const seg of plan.segs) {
    const width = segWidth(seg);
    const deckW = deckWidthFor(width);
    const channelW = width - 2 * deckW;
    const [a0, a1] = segAlong(seg);
    const center = seg.axis === 'z' ? (seg.rect.x0 + seg.rect.x1) / 2 : (seg.rect.z0 + seg.rect.z1) / 2;
    // 交差点は避ける
    const cutJ: [number, number][] = [];
    if (junction && seg.role === 'main') cutJ.push(seg.axis === 'z' ? [junction.z0 - 0.3, junction.z1 + 0.3] : [junction.x0 - 0.3, junction.x1 + 0.3]);
    if (hole) cutJ.push(seg.axis === 'z' ? [hole.min[2] - 0.5, hole.max[2] + 0.5] : [hole.min[0] - 0.5, hole.max[0] + 0.5]);
    const laneBox = (off: number, t0: number, t1: number, w: number, y0: number, y1: number, mat: MatId, solid: boolean) => {
      if (seg.axis === 'z') B.push(box([center + off - w / 2, y0, t0], [center + off + w / 2, y1, t1], mat, solid));
      else B.push(box([t0, y0, center + off - w / 2], [t1, y1, center + off + w / 2], mat, solid));
    };
    // レーンライン（水面下の白線）
    const laneOffsets = channelW >= 5 ? [-channelW / 4, channelW / 4] : [0];
    for (const [t0, t1] of subtractIntervals(a0 + 1.0, a1 - 1.0, cutJ)) {
      if (t1 - t0 < 1.0) continue;
      for (const off of laneOffsets) laneBox(off, t0, t1, 0.12, 0.004, 0.014, 'wallWhite', false);
    }
    // 低い仕切り（広い水路の中央。扉前は 2.5 m、折れ角（次のセグメントへ曲がる末端の w × w）は幅ぶん空ける）
    if (channelW >= 5) {
      const mains = plan.segs.filter((s) => s.role === 'main');
      const turnsAtEnd = seg.role === 'main' && mains.indexOf(seg) < mains.length - 1;
      const insetStart = 2.5;
      const insetEnd = turnsAtEnd ? Math.max(2.5, width) : 2.5;
      // 進行方向が負（heading 2 / 3）のセグメントは a0 側が末端
      const neg = seg.heading === 2 || seg.heading === 3;
      const lo = a0 + (neg ? insetEnd : insetStart);
      const hi = a1 - (neg ? insetStart : insetEnd);
      for (const [t0, t1] of subtractIntervals(lo, hi, cutJ)) {
        for (let s = t0; s + 1.5 <= t1; s += 5.5) {
          const e = Math.min(t1, s + 3.5);
          laneBox(0, s, e, 0.15, 0, DIVIDER_H, style.dividerMat, true);
        }
      }
    }
    // グレーチング（6 m おき）
    for (const [t0, t1] of subtractIntervals(a0 + 2.0, a1 - 2.0, cutJ)) {
      for (let t = t0 + 1.0; t + 0.6 <= t1; t += 6) laneBox(0, t, t + 0.6, 0.6, 0.003, 0.02, 'metal', false);
    }
  }

  // ---- 交差点: 中央の大きな排水口 + 内角の柱
  if (junction) {
    const cx = (junction.x0 + junction.x1) / 2;
    const cz = (junction.z0 + junction.z1) / 2;
    B.push(box([cx - 0.6, 0.003, cz - 0.6], [cx + 0.6, 0.02, cz + 0.6], 'metal', false));
    B.push(box([cx - 0.75, 0.002, cz - 0.75], [cx + 0.75, 0.012, cz + 0.75], 'wallDark', false));
    for (const seg of plan.segs) {
      if (seg.role !== 'arm') continue;
      const sx = seg.heading === 1 ? junction.x1 - 0.35 : junction.x0 + 0.35;
      for (const sz of [junction.z0 + 0.35, junction.z1 - 0.35]) {
        if (!clearOfSockets(sockets, sx, sz, 1.5)) continue;
        B.push(box([sx - 0.25, 0, sz - 0.25], [sx + 0.25, h, sz + 0.25], style.columnMat));
      }
    }
  }

  // ---- サイン（最長の壁区間に 1 枚）
  if (signSpan) {
    const { span, piece } = signSpan;
    const t = Math.round(((piece[0] + piece[1]) / 2) * 2) / 2;
    const [x, z] = pointOnEdge(span.edge.dir, span.edge.coord, t, 0.02);
    const facing = ((span.edge.dir + 2) % 4) as Dir;
    const sign: SignSpec = {
      id: 'pool-notice', text: 'NO DIVING', sub: `SHALLOW WATER  ${style.depth.toFixed(2)} m`, pos: [x, 1.75, z], dir: facing, width: 1.1, kind: 'plate',
      color: 0xf4f7fa, background: 0x2f6f9a,
    };
    L.signs = [...(L.signs ?? []), sign];
  }
}
