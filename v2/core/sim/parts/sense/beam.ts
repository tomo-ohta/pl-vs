/**
 * 光の筋と鏡の部品（段階 4・担当 sense）。
 * - mirror: 調べると向きが変わる鏡（状態 0 = 「／」: +x ↔ +z・1 = 「＼」: +x ↔ -z）。出力 state
 * - beam: 光源 emitter から光の筋を出し、鏡（入力 m0..m5 = 鏡の state）で 90° ずつ曲げる。筋は区画の壁（rects の外）か
 *     当たる箱（区画の静的な箱の、筋の高さに掛かる物）で止まる。止まった所が受光器 receptor の印に近ければ lit、
 *     何も無い壁の印 target に近ければ target。状態 path に筋の折れ点（[x, z] の列。描画が読む）
 */
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, type PartContext } from '../../part.ts';
import { cellSolids } from './common.ts';

definePart<{ s: number }>({
  type: 'mirror',
  outputs: ['state'],
  init(ctx) {
    ctx.setInteractable(pAabb(ctx.spec, 'box'), 2.4);
    return { s: pNum(ctx.spec, 'initial', 0) ? 1 : 0 };
  },
  step(s, ctx) {
    if (ctx.interactedBy()) {
      s.s = s.s ? 0 : 1;
      const b = pAabb(ctx.spec, 'box');
      ctx.cue('mirror.turn', [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2], { state: s.s });
    }
    ctx.output('state', s.s);
  },
});

/** 鏡で曲げる: 状態 0 は (dx, dz) → (dz, dx)・1 は (dx, dz) → (-dz, -dx) */
export const reflect = (d: readonly number[], state: number): [number, number] => (state ? [-d[1]!, -d[0]!] : [d[1]!, d[0]!]);

/** 軸に沿った向き d で、点 p から矩形の集まり rects の外へ出るまでの距離（中に無ければ 0） */
export function exitDistance(p: readonly number[], d: readonly number[], rects: readonly number[][]): number {
  let x = p[0]!, z = p[1]!, total = 0;
  for (let guard = 0; guard < 8; guard++) {
    const r = rects.find((q) => x >= q[0]! - 1e-6 && x <= q[2]! + 1e-6 && z >= q[1]! - 1e-6 && z <= q[3]! + 1e-6 && (
      d[0]! > 0 ? x < q[2]! - 1e-6 : d[0]! < 0 ? x > q[0]! + 1e-6 : d[1]! > 0 ? z < q[3]! - 1e-6 : z > q[1]! + 1e-6));
    if (!r) break;
    const step = d[0]! > 0 ? r[2]! - x : d[0]! < 0 ? x - r[0]! : d[1]! > 0 ? r[3]! - z : z - r[1]!;
    total += step;
    x += d[0]! * step;
    z += d[1]! * step;
  }
  return total;
}

/**
 * 光の筋をたどる（部品と生成の両方が使う）。emitter [x, z, dx, dz]・鏡の位置 mirrors [x, z] と向き states・止める箱 solids（2 次元 [x0, z0, x1, z1]）。
 * 戻り値は折れ点の列（最初は光源・最後は止まった所）と、最後の向き
 */
export function traceBeam(emitter: readonly number[], mirrors: readonly number[][], states: readonly number[], rects: readonly number[][], solids: readonly number[][] = []): { path: number[][]; dir: [number, number] } {
  let p = [emitter[0]!, emitter[1]!];
  let d: [number, number] = [emitter[2]!, emitter[3]!];
  const path = [[p[0]!, p[1]!]];
  let last = -1;
  for (let bounce = 0; bounce < 16; bounce++) {
    const wall = exitDistance(p, d, rects);
    let best = wall, hit = -1;
    mirrors.forEach((m, i) => {
      if (i === last) return;
      const t = (m[0]! - p[0]!) * d[0] + (m[1]! - p[1]!) * d[1];
      const off = Math.abs((m[0]! - p[0]!) * d[1] - (m[1]! - p[1]!) * d[0]);
      if (t > 0.05 && off < 0.06 && t < best) { best = t; hit = i; }
    });
    for (const b of solids) {
      // 軸に沿った筋と矩形: 筋の通る横の座標が矩形の中なら、矩形の手前の面までの距離
      const across = d[0] !== 0 ? p[1]! : p[0]!;
      const lo = d[0] !== 0 ? b[1]! : b[0]!, hi = d[0] !== 0 ? b[3]! : b[2]!;
      if (across <= lo || across >= hi) continue;
      const near = d[0] > 0 ? b[0]! - p[0]! : d[0] < 0 ? p[0]! - b[2]! : d[1] > 0 ? b[1]! - p[1]! : p[1]! - b[3]!;
      if (near > 0.02 && near < best) { best = near; hit = -2; }
    }
    p = [p[0]! + d[0] * best, p[1]! + d[1] * best];
    path.push([p[0]!, p[1]!]);
    if (hit < 0) break;
    d = reflect(d, states[hit] ?? 0);
    last = hit;
  }
  return { path, dir: d };
}

interface BeamState { key: string; path: Json; lit: number; target: number; [k: string]: Json }

function solids2d(ctx: PartContext, y: number): number[][] {
  const cell = ctx.spec.cell;
  if (!cell) return [];
  return cellSolids(ctx.floor, cell).filter((b) => b.min[1] < y && b.max[1] > y).map((b) => [b.min[0], b.min[2], b.max[0], b.max[2]]);
}

const SOLIDS = new WeakMap<object, number[][]>();

definePart<BeamState>({
  type: 'beam',
  outputs: ['lit', 'target'],
  inputs: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'],
  init: () => ({ key: '', path: [], lit: 0, target: 0 }),
  step(s, ctx) {
    const mirrors = (ctx.spec.params.mirrors as number[][] | undefined) ?? [];
    const states = mirrors.map((_m, i) => (ctx.input(`m${i}`) > 0.5 ? 1 : 0));
    const key = states.join('');
    if (key !== s.key) {
      s.key = key;
      const y = pNum(ctx.spec, 'y', 1);
      let solids = SOLIDS.get(ctx.spec);
      if (!solids) SOLIDS.set(ctx.spec, (solids = solids2d(ctx, y)));
      const r = traceBeam(ctx.spec.params.emitter as number[], mirrors, states, ctx.spec.params.rects as number[][], solids);
      s.path = r.path;
      const end = r.path[r.path.length - 1]!;
      const near = (q: unknown): number => {
        const v = q as number[] | null | undefined;
        return v ? (Math.hypot(end[0]! - v[0]!, end[1]! - v[1]!) <= (v[2] ?? 0.3) ? 1 : 0) : 0;
      };
      s.lit = near(ctx.spec.params.receptor);
      s.target = near(ctx.spec.params.target);
      if (s.lit) ctx.cue('beam.lit', [end[0]!, y, end[1]!]);
    }
    ctx.output('lit', s.lit);
    ctx.output('target', s.target);
  },
});
