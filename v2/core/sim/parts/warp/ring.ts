/**
 * warpRing: 4 回曲がっても戻らない（W13）の、部屋の真ん中の塊のまわりを回った角度。
 *
 * 塊のまわりを右回り（右へ曲がり続ける）に回った角度を足していき、半周を越えたら段 level = 1（左回りで引く）。
 * 角度は −π..3π − 0.4 に留める（右へ何周しても、左へ 1 周すれば戻る。左へ先に回っても借りにならない）。
 * 段が 1 の間は、来た扉を壁で隠し（出力 a = 1）、別の所の扉を出す（出力 n = 1）。差し替えは swapSet が見ていない間に行う。
 * 来た扉が開いている間は、隠すかどうかを今のまま変えない（入力 a = 今の差し替えの組。開いた扉に壁が重ならないように）。
 *
 * params: center（塊の真ん中 [x, z]）・door（来た扉の部品の id）・box（塊のまわりの通路の範囲。この中で回った角度だけ数える）
 * outputs: level・a・n・turns（足した角度 / 2π）
 */
import { definePart } from '../../part.ts';
import { inBox, readAabb } from './util.ts';

// 上は 3π より少し手前（右へ何周もしたあと左へ 1 周で、半周の境より確かに手前へ戻るように）
const MIN = -Math.PI, MAX = 3 * Math.PI - 0.4;

definePart<{ theta: Record<string, number>; wind: number; level: number }>({
  type: 'warpRing',
  outputs: ['level', 'a', 'n', 'turns'],
  inputs: ['a'],
  init: () => ({ theta: {}, wind: 0, level: 0 }),
  step(s, ctx) {
    const c = ctx.spec.params.center as number[];
    const box = readAabb(ctx.spec.params.box);
    for (const p of ctx.players) {
      if (!inBox([p.pos[0], p.pos[1] + 0.1, p.pos[2]], box)) { delete s.theta[p.id]; continue; }
      // 角度 atan2(z, x) が増える向き = 右回り（右へ曲がり続ける。core/math/vec.ts の向き）
      const th = Math.atan2(p.pos[2] - c[1]!, p.pos[0] - c[0]!);
      const prev = s.theta[p.id];
      s.theta[p.id] = th;
      if (prev === undefined) continue;
      let d = th - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      s.wind = Math.max(MIN, Math.min(MAX, s.wind + d));
    }
    // 半周を越えたら段を変える（そこからは来た扉が見えない）
    s.level = s.wind >= Math.PI ? 1 : 0;
    const door = typeof ctx.spec.params.door === 'string' ? ctx.spec.params.door : null;
    const closed = !door || Number(ctx.stateOf(door)?.angle ?? 0) < 0.02;
    const want = s.level;
    const a = closed ? want : ctx.wired('a') ? ctx.input('a') : 0;
    ctx.output('level', s.level);
    ctx.output('a', a);
    ctx.output('n', s.level);
    ctx.output('turns', s.wind / (2 * Math.PI));
  },
});
