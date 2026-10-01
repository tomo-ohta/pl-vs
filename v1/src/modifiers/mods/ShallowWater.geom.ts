/**
 * ShallowWater / Wetness / ParticleDetail（担当 M-water）が共有する矩形・壁面の小さな幾何ヘルパ。
 * ModifierImpl ではないので default export を持たない（レジストリの glob は警告して読み飛ばす）。
 * すべて純関数。座標はレイアウトのローカル座標。
 */
import type { AABB } from '../../core/aabb';
import type { Dir, Socket } from '../../core/types';
import { across, along, rect, wallSpans, type Rect } from '../../generators/footprint';
import { WALL_T, type Box, type RoomLayout } from '../../generators/layout';

const EPS = 0.02;

export function rectArea2(r: Rect): number {
  return Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0);
}

/** AABB の xz 投影 */
export function rectOfAabb(a: AABB, pad = 0): Rect {
  return rect(a.min[0] - pad, a.min[2] - pad, a.max[0] + pad, a.max[2] + pad);
}

/** 2 矩形の共通部分（無ければ null） */
export function rectIntersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x0, b.x0);
  const z0 = Math.max(a.z0, b.z0);
  const x1 = Math.min(a.x1, b.x1);
  const z1 = Math.min(a.z1, b.z1);
  if (x1 - x0 < EPS || z1 - z0 < EPS) return null;
  return { x0, z0, x1, z1 };
}

export function rectOverlaps(a: Rect, b: Rect, eps = EPS): boolean {
  return a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.z0 < b.z1 - eps && a.z1 > b.z0 + eps;
}

/** 矩形の集合から cut を引いた被覆（重ならない矩形の集合）。上下左右の 4 片に分ける */
export function subtractRects(pieces: Rect[], cut: Rect): Rect[] {
  const out: Rect[] = [];
  for (const p of pieces) {
    if (!rectOverlaps(p, cut)) {
      out.push(p);
      continue;
    }
    const push = (x0: number, z0: number, x1: number, z1: number) => {
      if (x1 - x0 > EPS && z1 - z0 > EPS) out.push({ x0, z0, x1, z1 });
    };
    // 下（-Z 側）と上（+Z 側）は全幅、左右は cut の z 範囲だけ
    if (cut.z0 > p.z0) push(p.x0, p.z0, p.x1, Math.min(p.z1, cut.z0));
    if (cut.z1 < p.z1) push(p.x0, Math.max(p.z0, cut.z1), p.x1, p.z1);
    const zz0 = Math.max(p.z0, cut.z0);
    const zz1 = Math.min(p.z1, cut.z1);
    if (cut.x0 > p.x0) push(p.x0, zz0, Math.min(p.x1, cut.x0), zz1);
    if (cut.x1 < p.x1) push(Math.max(p.x0, cut.x1), zz0, p.x1, zz1);
  }
  return out;
}

/** 開口の内側の前庭（apron）矩形。壁の外面（socket.pos）から室内側へ depth、幅は開口幅 + 2·pad。containing に切り詰める */
export function socketApron(s: Socket, depth: number, pad: number, containing: Rect | null): Rect | null {
  const hw = s.width / 2 + pad;
  let r: Rect;
  switch (s.dir) {
    case 0: r = rect(s.pos[0] - hw, s.pos[2] - depth, s.pos[0] + hw, s.pos[2]); break;
    case 2: r = rect(s.pos[0] - hw, s.pos[2], s.pos[0] + hw, s.pos[2] + depth); break;
    case 1: r = rect(s.pos[0] - depth, s.pos[2] - hw, s.pos[0], s.pos[2] + hw); break;
    default: r = rect(s.pos[0], s.pos[2] - hw, s.pos[0] + depth, s.pos[2] + hw); break;
  }
  return containing ? rectIntersect(r, containing) : r;
}

/** ソケット（壁の外面上の点）を含む足跡矩形。境界上なので少し膨らませて判定する */
export function rectContainingSocket(rects: Rect[], s: Socket): Rect | null {
  const inward = inwardVec(s.dir);
  const x = s.pos[0] + inward[0] * 0.3;
  const z = s.pos[2] + inward[1] * 0.3;
  return rects.find((r) => x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS) ?? null;
}

/** 方向 d の室内向き単位ベクトル [x, z] */
export function inwardVec(d: Dir): [number, number] {
  return d === 0 ? [0, -1] : d === 1 ? [-1, 0] : d === 2 ? [0, 1] : [1, 0];
}

/** 外壁の内面に沿った帯の区間。開口（hole 以外のソケット、幅 + 2·gapPad）を除く */
export interface WallBandSegment {
  dir: Dir;
  /** 壁の座標（外面） */
  coord: number;
  /** 壁に沿った区間 */
  a0: number;
  a1: number;
}

export function wallBandSegments(rects: Rect[], sockets: Socket[], gapPad = 0.15): WallBandSegment[] {
  const out: WallBandSegment[] = [];
  for (const span of wallSpans(rects)) {
    const e = span.edge;
    const cuts: [number, number][] = sockets
      .filter((s) => s.type !== 'hole' && s.dir === e.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - e.coord) < 0.05)
      .map((s) => {
        const t = along(s.dir, s.pos[0], s.pos[2]);
        return [t - s.width / 2 - gapPad, t + s.width / 2 + gapPad] as [number, number];
      })
      .sort((p, q) => p[0] - q[0]);
    let cur = span.a0;
    for (const [c0, c1] of cuts) {
      if (c0 > cur + EPS) out.push({ dir: e.dir, coord: e.coord, a0: cur, a1: Math.min(c0, span.a1) });
      cur = Math.max(cur, c1);
      if (cur >= span.a1) break;
    }
    if (span.a1 > cur + EPS) out.push({ dir: e.dir, coord: e.coord, a0: cur, a1: span.a1 });
  }
  return out;
}

/** 帯区間を、壁の内面から gap だけ室内側へ離した厚さ t の箱にする */
export function bandBox(seg: WallBandSegment, y0: number, y1: number, mat: Box['mat'], t = 0.006, gap = 0.002): Box {
  // 壁帯は矩形の内側 WALL_T（footprint.wallOnEdge と同じ）
  const innerFace = seg.dir === 0 || seg.dir === 1 ? seg.coord - WALL_T : seg.coord + WALL_T;
  const lo = seg.dir === 0 || seg.dir === 1 ? innerFace - gap - t : innerFace + gap;
  const hi = lo + t;
  if (seg.dir === 0 || seg.dir === 2) return { min: [seg.a0, y0, lo], max: [seg.a1, y1, hi], mat, solid: false };
  return { min: [lo, y0, seg.a0], max: [hi, y1, seg.a1], mat, solid: false };
}

/** 内装（shellCount 以降）のソリッド箱の足元に (x, z) が入っているか */
export function insideInteriorSolid(L: RoomLayout, x: number, z: number, pad = 0.15, maxBottom = 1.2): boolean {
  const from = L.shellCount ?? 0;
  for (let i = from; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!b.solid || b.min[1] > maxBottom) continue;
    if (x > b.min[0] - pad && x < b.max[0] + pad && z > b.min[2] - pad && z < b.max[2] + pad) return true;
  }
  return false;
}

/** 足跡が無いレイアウト（旧式 Generator）向けに bounds から 1 矩形を作る */
export function footprintOrBounds(L: RoomLayout): Rect[] {
  if (L.footprint.length > 0) return L.footprint;
  return [rect(L.bounds.min[0], L.bounds.min[2], L.bounds.max[0], L.bounds.max[2])];
}
