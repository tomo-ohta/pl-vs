/**
 * warpPastWindow: 窓の向こうの自分（W08・BX08）。部屋の中のプレイヤーの位置と向きを覚え、delay 秒前の姿（幽霊）を状態に出す。
 * 描画（client/views/warp/past.ts）は、窓の向こうに「同じ部屋」を描き、そこにだけ幽霊を描く（本当の部屋には見えない）。
 *
 * BX08: 窓の前（stand）でほとんど動かずに stillSec 秒立っていると、幽霊は覚えた道をたどるのをやめ、隠しの扉の前（spot）へ歩いて壁を叩く
 * （合図 'past.knock'。本当の部屋のその所で音がする）。叩き終えると出力 reveal が 1 になり、隠しの扉が現れる（窓の向こうでも、本当の部屋でも）。
 * 隠しの現す部品が reveal を読んでいないとき（隠しが付かなかった）は、幽霊は道をたどるだけ。
 *
 * params: room（部屋の中の範囲）・delay（秒）・every（覚える間隔 tick）・stand（窓の前の範囲）・stillSec・spot（[x, y, z, yaw]）
 * 状態: buf（[x, z, yaw, 部屋の中なら 1] を every tick ごと）・ghost（[x, z, yaw, 見えるなら 1]）・mode（0 たどる / 1 歩く / 2 叩く / 3 待つ）
 * outputs: reveal・mode
 */
import { definePart, pNum } from '../../part.ts';
import { inBox, readAabb } from './util.ts';

type S = { buf: number[]; ghost: number[]; mode: number; still: number; t: number; last: number[]; reveal: number };

const WALK = 0.9;

definePart<S>({
  type: 'warpPastWindow',
  outputs: ['reveal', 'mode'],
  init: () => ({ buf: [], ghost: [0, 0, 0, 0], mode: 0, still: 0, t: 0, last: [], reveal: 0 }),
  step(s, ctx) {
    const room = readAabb(ctx.spec.params.room);
    const stand = readAabb(ctx.spec.params.stand);
    const every = Math.max(1, Math.round(pNum(ctx.spec, 'every', 6)));
    const n = Math.max(2, Math.round((pNum(ctx.spec, 'delay', 4) * 60) / every) + 1);
    const spot = ctx.spec.params.spot as number[] | undefined;
    const p = ctx.players[0];
    if (!p) return;
    const inRoom = inBox([p.pos[0], p.pos[1] + 0.1, p.pos[2]], room) ? 1 : 0;
    if (ctx.tick % every === 0) {
      s.buf.push(p.pos[0], p.pos[2], p.yaw, inRoom);
      while (s.buf.length > n * 4) s.buf.splice(0, 4);
    }
    // 隠しが付いているか（隠しの現す部品が reveal を読んでいる）
    const me = `${ctx.id}.reveal`;
    const armed = !!spot && ctx.floor.entities.some((e) => e.type === 'reveal' && Object.values(e.inputs ?? {}).includes(me));
    if (s.mode === 0) {
      // 覚えた道をたどる（delay 秒前。覚えが足りない間は見えない）
      if (s.buf.length >= n * 4) {
        const k = (ctx.tick % every) / every;
        const a = s.buf.slice(0, 4), b = s.buf.slice(4, 8);
        let dy = (b[2] ?? a[2]!) - a[2]!;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        s.ghost = [a[0]! + ((b[0] ?? a[0]!) - a[0]!) * k, a[1]! + ((b[1] ?? a[1]!) - a[1]!) * k, a[2]! + dy * k, a[3]!];
      } else s.ghost = [s.ghost[0]!, s.ghost[1]!, s.ghost[2]!, 0];
      // BX08: 窓の前でほとんど動かずに立っている
      const moved = s.last.length ? Math.hypot(p.pos[0] - s.last[0]!, p.pos[2] - s.last[1]!) : 0;
      const standing = inBox([p.pos[0], p.pos[1] + 0.1, p.pos[2]], stand) && moved < 0.25 * ctx.dt;
      s.still = armed && standing ? s.still + ctx.dt : 0;
      if (armed && s.still >= pNum(ctx.spec, 'stillSec', 18) && s.ghost[3]) { s.mode = 1; s.t = 0; }
    } else if (s.mode === 1 && spot) {
      // 隠しの扉の前へ歩く（幽霊は物を通り抜ける）
      const dx = spot[0]! - s.ghost[0]!, dz = spot[2]! - s.ghost[1]!;
      const d = Math.hypot(dx, dz);
      const st = WALK * ctx.dt;
      if (d <= st) { s.ghost = [spot[0]!, spot[2]!, spot[3]!, 1]; s.mode = 2; s.t = 0; }
      else s.ghost = [s.ghost[0]! + (dx / d) * st, s.ghost[1]! + (dz / d) * st, Math.atan2(-dx, -dz), 1];
    } else if (s.mode === 2 && spot) {
      // 壁を 3 回叩く（0.6 秒おき）。叩き終えたら現す
      const before = Math.floor(s.t / 0.6);
      s.t += ctx.dt;
      const now = Math.floor(s.t / 0.6);
      if (now > before && now <= 3) ctx.cue('past.knock', [spot[0]!, spot[1]! + 1.2, spot[2]!], { n: now });
      if (s.t >= 2.2) { s.reveal = 1; s.mode = 3; s.t = 0; }
    } else if (s.mode === 3) {
      // 開いた扉を見て立ち、しばらくして消える（そのあとはまた道をたどる）
      s.t += ctx.dt;
      if (s.t >= 8) { s.mode = 0; s.still = 0; }
    }
    s.last = [p.pos[0], p.pos[2]];
    ctx.output('reveal', s.reveal);
    ctx.output('mode', s.mode);
  },
});
