/**
 * 視線と観測の仕掛け（段階 4・担当 sense）。
 *
 * - daruma だるまさんがころんだ [O02]: 出口の脇に、壁を向いた鬼が立つ。鬼が数え歌を歌う間に進み、歌が終わって振り返ったら止まる。
 *     見られている間に動くと捕まって入口へ戻される（開口の前の床は安全）。歌の長さは毎回違う（短い歌もある）。
 *     裏の振る舞い [BO02]: わざと何度も（3 回）捕まると、入口ではなく部屋の隅へ連れて行かれる。そこに隠しの扉
 *     （存在型 = 隅に最初からある・出現型 = 連れて行かれたときに壁が開く）
 */
import { box, type Box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { doorZone, freeWallSpan, frontOf, innerRect } from '../util.ts';
import { roomRegion, routeBetween, routeRects, wallPoint } from './util.ts';

defineGimmick({
  id: 'daruma', name: 'だるまさんがころんだ', axes: ['sight', 'time'], kinds: ['room', 'hall'], minSize: [5, 7.5], weight: 0.45, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit && s.exit.dir !== s.entrance.dir,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const ex = s.exit!, en = s.entrance!;
    // 鬼: 出口の壁の際、出口の脇 1.3 m。壁を向く（背中を部屋へ）
    const r = innerRect(s);
    const along = ex.dir % 2 === 0 ? ex.pos[0] : ex.pos[2];
    const lo = ex.dir % 2 === 0 ? r.x0 : r.z0, hi = ex.dir % 2 === 0 ? r.x1 : r.z1;
    const side = along - lo > hi - along ? -1 : 1;
    const at = Math.min(hi - 0.5, Math.max(lo + 0.5, along + side * (ex.width / 2 + 0.9)));
    const [ox, oz] = wallPoint(ctx, ex.dir, at, 0.45);
    const [wx, wz] = wallPoint(ctx, ex.dir, at, 0);
    const yawWall = Math.atan2(wx - ox, wz - oz);
    const ent = frontOf(en, 0.8);
    const yawRoom = Math.atan2(ent[0] - ox, ent[2] - oz);
    // 安全な床: 開口の前（入ってすぐ・出る直前は捕まらない）
    const safe = s.openings.map((o) => { const z = doorZone(o, y, 1.3, 0.35); return [z.min[0], z.min[2], z.max[0], z.max[2]]; });
    // 隅（BO02）: 開口の無い壁の、鬼から遠い所
    let corner: number[] | null = null;
    const walls = ([0, 1, 2, 3] as const).filter((d) => !s.openings.some((o) => o.dir === d) && d !== ex.dir);
    for (const d of walls) {
      const span = freeWallSpan(s, d, 1.6, 0.8);
      if (!span) continue;
      const [cx, cz] = wallPoint(ctx, d, span.at, 0.8);
      const [qx, qz] = wallPoint(ctx, d, span.at, 0);
      corner = [cx, y + 0.02, cz, Math.atan2(-(qx - cx), -(qz - cz))];
      ctx.offerSecret({ hook: 'daruma.caught', modes: ['present', 'appear'], weight: 1, revealOutput: `${ctx.id}.oni.corner`, doorway: { dir: d, at: span.at, y, width: 1.0, height: 2.0 }, tell: '何度も捕まると連れて行かれる隅' });
      ctx.keepOut({ min: [cx - 0.9, y, cz - 0.9], max: [cx + 0.9, y + 2.5, cz + 0.9] });
      break;
    }
    ctx.addEntity('oni', {
      type: 'daruma',
      params: {
        pos: [ox, y, oz], yaw: yawWall, yawRoom, region: roomRegion(s), safe, seed: ctx.rng.int(1, 1e9),
        chantMin: t['sense.daruma.chantMin'], chantMax: t['sense.daruma.chantMax'], watchMin: t['sense.daruma.watchMin'], watchMax: t['sense.daruma.watchMax'], turnSec: 0.35, tol: t['sense.daruma.tolM'],
        to: [ent[0], y + 0.02, ent[2]], toYaw: Math.atan2(-(ox - ent[0]), -(oz - ent[2])), ...(corner ? { corner, catchesToCorner: t['sense.daruma.catchesToCorner'] } : {}),
      },
    });
    // 鬼の足元の台（立ち位置が分かる）と、鬼の周りは家具を置かない
    const B: Box[] = [box([ox - 0.35, y, oz - 0.35], [ox + 0.35, y + 0.03, oz + 0.35], 'carpetPattern', false)];
    for (const b of B) ctx.addBox(b);
    ctx.keepOut({ min: [ox - 1, y, oz - 1], max: [ox + 1, y + 3, oz + 1] });
    // 入口から出口への道は空ける（隠れる物は道の脇に残る）
    const route = routeBetween(s, 1.0);
    if (route) for (const q of routeRects(route, 1.2)) ctx.keepOut({ min: [q.x0, y, q.z0], max: [q.x1, y + 2.5, q.z1] });
  },
});
