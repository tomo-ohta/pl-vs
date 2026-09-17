/** PoolGenerator の足跡（折れ回廊 + 水路交差点）。
 *  「曲率」は矩形 footprint で表せないので、直線 / L / Z / U の折れと、直線の中間に直交する腕を足した T / 十字（cross）で近似する。
 *  最初のセグメントは原点から +Z へ伸び、入口は z = 0 の南辺中央（makeEntry の規約）。
 *  CorridorGenerator.corridorSegments は export されていないため、同じ規約でここに実装する（Pool 固有の T / cross を追加）。 */
import type { Dir, Socket } from '../core/types';
import type { Rng } from '../core/rng';
import { rect, rectsOverlap, type Rect } from './footprint';
import { DOOR_H, DOOR_W, snap } from './layout';

export type PoolShape = 'cross' | 'T' | 'U' | 'Z' | 'L' | 'straight';

export interface PoolSeg {
  rect: Rect;
  /** 進行方向（rect の長手が伸びる向き。腕は主線から外へ向かう向き） */
  heading: Dir;
  /** 長手軸 */
  axis: 'x' | 'z';
  /** main: 入口から末端へ続く鎖 / arm: T / cross の腕（末端に出口） */
  role: 'main' | 'arm';
}

export interface PoolPlan {
  shape: PoolShape;
  segs: PoolSeg[];
  /** 水路交差点（主線と腕が交わる矩形。T / cross のみ）。装飾が仕切りや柱を避ける・中央排水を置く */
  junction: Rect | null;
  /** 主線の幅 */
  width: number;
}

/** 直線 / L / Z / U の鎖（CorridorGenerator と同じ規約） */
function chain(rng: Rng, shape: 'straight' | 'L' | 'Z' | 'U', total: number, w: number): PoolSeg[] {
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
    default: {
      const a = Math.max(minSeg, total * rng.float(0.3, 0.4));
      const b = Math.max(minSeg, total * rng.float(0.25, 0.35));
      lengths = [a, b, Math.max(minSeg, total - a - b)];
      const t = rng.chance(0.5) ? 1 : -1;
      turns = [t, t];
      break;
    }
  }
  lengths = lengths.map((l) => Math.max(minSeg, snap(l)));
  const segs: PoolSeg[] = [];
  let heading: Dir = 0;
  segs.push({ rect: rect(-w / 2, 0, w / 2, lengths[0]), heading, axis: 'z', role: 'main' });
  for (let i = 1; i < lengths.length; i++) {
    const turn = turns[i - 1];
    heading = ((heading + (turn === 1 ? 1 : 3)) % 4) as Dir;
    const sq = endSquare(segs[i - 1], w);
    const len = lengths[i];
    let nr: Rect;
    switch (heading) {
      case 1: nr = rect(sq.x1, sq.z0, sq.x1 + len, sq.z1); break;
      case 3: nr = rect(sq.x0 - len, sq.z0, sq.x0, sq.z1); break;
      case 0: nr = rect(sq.x0, sq.z1, sq.x1, sq.z1 + len); break;
      default: nr = rect(sq.x0, sq.z0 - len, sq.x1, sq.z0); break;
    }
    if (segs.some((s) => rectsOverlap(s.rect, nr))) break; // 自己交差 → そこで打ち切り
    segs.push({ rect: nr, heading, axis: heading === 0 || heading === 2 ? 'z' : 'x', role: 'main' });
  }
  return segs;
}

/** セグメント末端の w × w の正方形（折れ曲がりの角） */
export function endSquare(s: PoolSeg, w: number): Rect {
  const r = s.rect;
  switch (s.heading) {
    case 0: return rect(r.x0, r.z1 - w, r.x1, r.z1);
    case 2: return rect(r.x0, r.z0, r.x1, r.z0 + w);
    case 1: return rect(r.x1 - w, r.z0, r.x1, r.z1);
    default: return rect(r.x0, r.z0, r.x0 + w, r.z1);
  }
}

/** 足跡を作る。T / cross は直線の主線 + 直交する腕。腕が置けない短い主線は直線に落とす。
 *  乱数の消費量は shape ごとに固定（分岐の結果で変えない）。 */
export function poolPlan(rng: Rng, shape: PoolShape, total: number, w: number): PoolPlan {
  if (shape !== 'T' && shape !== 'cross') {
    return { shape, segs: chain(rng, shape, total, w), junction: null, width: w };
  }
  // 腕の寸法（先に全部引いておく）
  // 腕幅は整数 m（tz は 0.5 グリッドなので腕の辺も 0.5 グリッドに乗る）
  const armW = Math.round(Math.min(w, Math.max(3, w * rng.float(0.6, 1.0))));
  const armLen0 = snap(Math.min(14, Math.max(armW + 1.5, total * rng.float(0.3, 0.5))));
  const armLen1 = snap(Math.min(14, Math.max(armW + 1.5, total * rng.float(0.3, 0.5))));
  const tRatio = rng.float(0.4, 0.65);
  const side: 1 | 3 = rng.chance(0.5) ? 1 : 3;
  // 交差点の位置: 入口の前庭（2.5 m）と末端扉の前（2.5 m）を空ける
  const lo = armW / 2 + 2.5;
  const hi = total - armW / 2 - 2.5;
  const main: PoolSeg = { rect: rect(-w / 2, 0, w / 2, total), heading: 0, axis: 'z', role: 'main' };
  if (hi - lo < 0.5) return { shape: 'straight', segs: [main], junction: null, width: w };
  const tz = snap(Math.min(hi, Math.max(lo, total * tRatio)));
  const segs: PoolSeg[] = [main];
  const armPlus: PoolSeg = { rect: rect(w / 2, tz - armW / 2, w / 2 + armLen0, tz + armW / 2), heading: 1, axis: 'x', role: 'arm' };
  const armMinus: PoolSeg = { rect: rect(-w / 2 - (shape === 'cross' ? armLen1 : armLen0), tz - armW / 2, -w / 2, tz + armW / 2), heading: 3, axis: 'x', role: 'arm' };
  if (shape === 'cross') segs.push(armPlus, armMinus);
  else segs.push(side === 1 ? armPlus : armMinus);
  return { shape, segs, junction: rect(-w / 2, tz - armW / 2, w / 2, tz + armW / 2), width: w };
}

/** セグメント末端の辺の中央に扉ソケットを置く（CorridorGenerator の end と同じ規約。0.5 m グリッド） */
export function endSocket(id: string, s: PoolSeg, width = DOOR_W, height = DOOR_H): Socket {
  const r = s.rect;
  const mid = (a: number, b: number) => Math.min(b - width / 2 - 0.3, Math.max(a + width / 2 + 0.3, snap((a + b) / 2)));
  switch (s.heading) {
    case 0: return { id, type: 'door', pos: [mid(r.x0, r.x1), 0, r.z1], dir: 0, width, height };
    case 1: return { id, type: 'door', pos: [r.x1, 0, mid(r.z0, r.z1)], dir: 1, width, height };
    case 3: return { id, type: 'door', pos: [r.x0, 0, mid(r.z0, r.z1)], dir: 3, width, height };
    default: return { id, type: 'door', pos: [mid(r.x0, r.x1), 0, r.z0], dir: 2, width, height };
  }
}

/** 矩形の短辺（回廊の幅） */
export function segWidth(s: PoolSeg): number {
  return s.axis === 'z' ? s.rect.x1 - s.rect.x0 : s.rect.z1 - s.rect.z0;
}

/** 長手方向の区間 [a0, a1] */
export function segAlong(s: PoolSeg): [number, number] {
  return s.axis === 'z' ? [s.rect.z0, s.rect.z1] : [s.rect.x0, s.rect.x1];
}

/** 進行軸（入口 → 折れ角の中心 → 末端扉）。MaterialGradient などが使う */
export function chainPath(segs: PoolSeg[], w: number, end: Socket | null): [number, number, number][] {
  const pts: [number, number, number][] = [[0, 0, 0]];
  const mains = segs.filter((s) => s.role === 'main');
  for (let i = 0; i < mains.length - 1; i++) {
    const sq = endSquare(mains[i], w);
    pts.push([(sq.x0 + sq.x1) / 2, 0, (sq.z0 + sq.z1) / 2]);
  }
  if (end) pts.push([end.pos[0], 0, end.pos[2]]);
  return pts;
}
