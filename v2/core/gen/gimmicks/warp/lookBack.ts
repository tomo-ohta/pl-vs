/**
 * 振り返ると変わる（lookBack: O05。v1 E07 の発展）。部品は swapSet（見ていない間に差し替える）。
 *
 * 遊び方: 扉を開けると、壁沿いに仕切りで区切った小部屋（間口の開いた区画）が並ぶ部屋。肘掛け椅子と灯り・机・寝台・段ボール・
 * 壁を向いた椅子・白い人の形 …。一度見た小部屋は、目を離している間に別の場面に変わる（変わるとき、背後で小さな物音がする）。
 * 部屋を歩いて振り返るたびに、背後の小部屋が全部違う。見ている間は決して変わらない（見え方は視野と見通しで調べる）。
 * 閉じ込めない: 小部屋は壁沿いだけで、開口の前は空けてある（開口どうしは歩いてつながる）。
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import type { Dir } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { freeWallSpan, innerRect } from '../util.ts';
import { makeFrame, type Frame } from './pocket.ts';
import { scene, SCENES, type SceneId } from './scenes.ts';

const BW = 2.0, BD = 1.25, PT = 0.12;

defineGimmick({
  id: 'lookBack', name: '振り返ると変わる', axes: ['sight'], kinds: ['room', 'hall'], minSize: [5, 5.5], minHeight: 2.5, weight: WARP_TUNING['warp.lookBack.weight'].default, intensity: 1,
  onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    if (s.cell.footprint.length !== 1) return;
    const r = innerRect(s);
    const y = s.cell.floorY, H = s.cell.height;
    const max = ctx.tuning['warp.lookBack.booths'];
    // 小部屋の置き場所を先に決める（3 つ以上置けなければ組まない）
    const frames: Frame[] = [];
    for (const d of ctx.rng.shuffle([0, 1, 2, 3] as Dir[])) {
      const span = freeWallSpan(s, d, BW + 0.2, 1.4);
      if (!span) continue;
      const n = Math.min(2, Math.floor((span.a1 - span.a0) / (BW + 0.4)));
      for (let k = 0; k < n && frames.length < max; k++) {
        const at = span.a0 + ((span.a1 - span.a0) * (k + 0.5)) / n;
        const wallC = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
        frames.push(makeFrame(d === 0 || d === 2 ? [at, y, wallC] : [wallC, y, at], ((d + 2) % 4) as Dir));
      }
    }
    if (frames.length < 3) return;
    const slots: Json[] = [];
    for (const f of frames) {
      // 仕切り（両側）と、間口の上の垂れ壁
      ctx.addBox(f.box(0, 0, -BW / 2, BD, H, -BW / 2 + PT, s.cell.palette.wall));
      ctx.addBox(f.box(0, 0, BW / 2 - PT, BD, H, BW / 2, s.cell.palette.wall));
      ctx.addBox(f.box(BD - PT, 2.35, -BW / 2 + PT, BD, H, BW / 2 - PT, s.cell.palette.wall));
      const region = f.aabb(0.05, 0.05, -BW / 2 + PT + 0.05, BD - 0.05, 2.2, BW / 2 - PT - 0.05);
      // この小部屋の場面（決まった順に 4 つ。最初は落ち着いた場面）
      const pool = ctx.rng.shuffle(SCENES.filter((x) => x !== 'empty') as SceneId[]);
      const first = pool.find((x) => x !== 'figure' && x !== 'chairWall')!;
      const order: SceneId[] = [first, ...pool.filter((x) => x !== first).slice(0, 3)];
      slots.push({ region: { min: [...region.min], max: [...region.max] }, variants: order.map((id) => scene(f, id, BD - PT, BW - 2 * PT)) as unknown as Json, init: 0 });
      const keep = f.aabb(0, -0.1, -BW / 2, BD + 1.0, 3, BW / 2);
      ctx.keepOut({ min: [...keep.min], max: [...keep.max] });
    }
    ctx.addEntity('swap', { type: 'swapSet', params: { slots, mode: 'random', minUnseen: ctx.tuning['warp.lookBack.unseenSec'], chance: 1, every: 4 } });
  },
});
