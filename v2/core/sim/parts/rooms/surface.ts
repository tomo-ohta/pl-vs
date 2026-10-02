/**
 * 部屋の形の部品: 動かない面（傾いた部屋の床・坂）。フロアの静的な面（FloorLayout.surfaces）と同じ働きを、部品として置く
 * （部屋の形の段はフロアを組み立てる前に区画を作るので、部品に面を持たせる）。見た目は箱（Box.slope）で描く。
 *
 * params: rect（{ x0, z0, x1, z1 }）・origin（[x, y, z]）・normal（[x, y, z]）・thickness（任意）
 */
import type { Rect } from '../../../world/footprint.ts';
import type { Vec3 } from '../../../math/vec.ts';
import { definePart, pNum, pVec } from '../../part.ts';

definePart({
  type: 'roomSurface',
  init(ctx) {
    const r = ctx.spec.params.rect as unknown as Rect;
    const origin: Vec3 = pVec(ctx.spec, 'origin');
    const normal: Vec3 = pVec(ctx.spec, 'normal');
    const th = pNum(ctx.spec, 'thickness', 0.6);
    ctx.setSurface('floor', { id: `${ctx.id}:floor`, rect: { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 }, origin, normal, thickness: th });
    return {};
  },
});
