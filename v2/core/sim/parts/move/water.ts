/**
 * 移動と身体の部品: 水・球の中。
 * - ballPit: ボールプール。rects（矩形ごとの球の深さ depth）の中では、深いほど球に押されてよろける（ゆっくり向きの変わる押し）。
 *     遅さ・沈み（目の高さ）はゾーン（water の dry）が受け持つ。描画は矩形ごとの深さまで球を積む
 */
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum } from '../../part.ts';

interface PitRect { x0: number; z0: number; x1: number; z1: number; depth: number }

/** 点の球の深さ（矩形の外は 0） */
export function ballDepthAt(rects: readonly PitRect[], x: number, z: number): number {
  let d = 0;
  for (const r of rects) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) d = Math.max(d, r.depth);
  return d;
}

definePart<{ [k: string]: Json | undefined }>({
  type: 'ballPit',
  outputs: ['depth'],
  init: () => ({}),
  step(_s, ctx) {
    const rects = (ctx.spec.params.rects as unknown as PitRect[] | undefined) ?? [];
    const y = pNum(ctx.spec, 'y', 0);
    const k = pNum(ctx.spec, 'jostle', 0.7);
    let deepest = 0;
    ctx.players.forEach((p, i) => {
      if (p.pos[1] > y + 0.5 || p.pos[1] < y - 0.3) return;
      const d = ballDepthAt(rects, p.pos[0], p.pos[2]);
      deepest = Math.max(deepest, d);
      if (d < 0.05) return;
      // 球に押される: ゆっくり向きの変わる押し（深さに比例。決定的: 時刻と位置だけで決まる）
      const t = ctx.time;
      const a = Math.sin(t * 0.9 + p.pos[0] * 0.7 + i) * 1.7 + Math.sin(t * 0.37 + p.pos[2] * 0.5) * 2.1;
      const m = k * Math.min(1, d / 1.2) * (0.6 + 0.4 * Math.sin(t * 1.7 + p.pos[2]));
      p.carry = [p.carry[0] + Math.cos(a) * m, p.carry[1], p.carry[2] + Math.sin(a) * m];
    });
    ctx.output('depth', deepest);
  },
});
