/**
 * I03 本を集める [QR] + BI03 本を 1 冊も集めない / 全部集める → それぞれ別の扉。
 *
 * 書庫: 床一面に本が散らばっている（6〜10 冊）。歩いて本の上を通ると拾う（腕の中に積み上がる）。奥の壁際に返却台。
 * - 遊び方: 本を拾い集めて、返却台の前に立つ（全部そろうと台の灯りがつく）。集めなくても部屋は普通に通れる
 * - 隠し（出現型）: 全部集めて返却台の前に立つ → 返却台の横の扉 / 1 冊も拾わずに返却台まで行く → 別の壁の扉。
 *   本は返却台までの道に散らばっていて、拾わずに行くには本の間の細い道を探して歩く（その道は必ず 1 本ある）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { frontOf, innerRect } from '../util.ts';
import { distToRoute, freeSpans, gridRoute, offer, onMainWall, snap, thinRoute, wallBox, wallPoint } from './util.ts';

const COVERS: MatId[] = ['plasticRed', 'plasticBlue', 'lightGreen', 'plasticYellow', 'furnitureDark', 'woodPanel'];

defineGimmick({
  id: 'bookCollect', name: '本を集める', axes: ['carry'], kinds: ['room', 'hall'], minSize: [5, 6], weight: 0.22, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    const e0 = frontOf(ent, 1.0);
    // 返却台: 入口から遠い壁の区間（台 1.4 m + 横に扉）
    let desk: { d: Dir; at: number; doorAt: number; far: number } | null = null;
    for (const d of [0, 1, 2, 3] as Dir[]) for (const sp of freeSpans(r, s.openings, d, 2.9, 0.8)) for (const side of [-1, 1]) {
      const at = side < 0 ? sp.a0 + 0.8 : sp.a1 - 0.8;
      const doorAt = at - side * 1.5;
      const p = wallPoint(r, d, at, 1.0, y);
      const far = Math.hypot(p[0] - e0[0], p[2] - e0[2]);
      if (!desk || far > desk.far) desk = { d, at, doorAt, far };
    }
    if (!desk || desk.far < 4) return;
    // 1 冊も拾わない方の扉: 別の壁
    let none: { d: Dir; at: number } | null = null;
    for (const d of ctx.rng.shuffle([0, 1, 2, 3] as Dir[])) {
      if (d === desk.d) continue;
      const sp = freeSpans(r, s.openings, d, 1.4, 0.8)[0];
      if (sp) { none = { d, at: sp.at }; break; }
    }
    // 返却台（当たる）と台の灯り
    const dk = wallBox(r, desk.d, desk.at, 0.7, y, y + 0.85, 0.6, 'woodPanel', true);
    ctx.addBox(dk);
    ctx.addBox(wallBox(r, desk.d, desk.at, 0.72, y + 0.85, y + 0.89, 0.62, 'furnitureDark', true));
    ctx.addBox(wallBox(r, desk.d, desk.at, 0.3, y + 1.6, y + 1.78, 0.03, 'signPlate'));
    const dz0 = wallPoint(r, desk.d, desk.at - 0.8, 0.6, y), dz1 = wallPoint(r, desk.d, desk.at + 0.8, 1.7, y);
    const deskZone = { min: [Math.min(dz0[0], dz1[0]), y - 0.3, Math.min(dz0[2], dz1[2])], max: [Math.max(dz0[0], dz1[0]), y + 2, Math.max(dz0[2], dz1[2])] };
    const deskRect: Rect = { x0: dk.min[0], x1: dk.max[0], z0: dk.min[2], z1: dk.max[2] };
    // 低い本棚（2〜3 個。当たる）: 返却台と開口の前を避ける
    const shelves: Rect[] = [];
    const zones = s.openings.map((o) => { const f = frontOf(o, 0); const g = frontOf(o, 1.8); return { x0: Math.min(f[0], g[0]) - o.width / 2 - 0.4, x1: Math.max(f[0], g[0]) + o.width / 2 + 0.4, z0: Math.min(f[2], g[2]) - o.width / 2 - 0.4, z1: Math.max(f[2], g[2]) + o.width / 2 + 0.4 }; });
    const deskKeep: Rect = { x0: deskZone.min[0]! - 0.6, x1: deskZone.max[0]! + 0.6, z0: deskZone.min[2]! - 0.6, z1: deskZone.max[2]! + 0.6 };
    const hit = (a: Rect, b: Rect, m = 0): boolean => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
    const nShelf = ctx.rng.int(2, 3);
    for (let k = 0; k < 60 && shelves.length < nShelf; k++) {
      const alongX = ctx.rng.chance(0.5);
      const L = ctx.rng.float(1.2, 1.8), Dp = 0.4;
      const cx = snap(ctx.rng.float(r.x0 + 1.2, r.x1 - 1.2)), cz = snap(ctx.rng.float(r.z0 + 1.2, r.z1 - 1.2));
      const sh: Rect = alongX ? { x0: cx - L / 2, x1: cx + L / 2, z0: cz - Dp / 2, z1: cz + Dp / 2 } : { x0: cx - Dp / 2, x1: cx + Dp / 2, z0: cz - L / 2, z1: cz + L / 2 };
      if (sh.x0 < r.x0 + 0.9 || sh.x1 > r.x1 - 0.9 || sh.z0 < r.z0 + 0.9 || sh.z1 > r.z1 - 0.9) continue;
      if (zones.some((z) => hit(z, sh)) || hit(deskKeep, sh) || shelves.some((o) => hit(o, sh, 1.2))) continue;
      shelves.push(sh);
    }
    // 拾わずに返却台へ行く道: 入口の前 → 部屋の中の 1 点 → 返却台の前（本棚を避ける）
    const blocks = [...shelves, deskRect];
    const deskFront = wallPoint(r, desk.d, desk.at, 1.15, y);
    let route: [number, number][] | null = null;
    for (let k = 0; k < 8 && !route; k++) {
      const via: [number, number] = [ctx.rng.float(r.x0 + 1, r.x1 - 1), ctx.rng.float(r.z0 + 1, r.z1 - 1)];
      const a = gridRoute(r, blocks, [e0[0], e0[2]], via), b = a && gridRoute(r, blocks, via, [deskFront[0], deskFront[2]]);
      if (a && b) route = [...a, ...b.slice(1)];
    }
    route ??= gridRoute(r, blocks, [e0[0], e0[2]], [deskFront[0], deskFront[2]]);
    if (!route) return;
    // 開口から入口の前までも道に入れる
    const door = frontOf(ent, 0.05);
    route.unshift([door[0], door[2]]);
    // 本: 道から離して（拾う半径 + 体の余裕）、部屋に散らす。返却台の前・開口の前にも少し
    const pickR = ctx.tuning['carry.book.pickR'];
    const clear = pickR + ctx.tuning['carry.book.routeClear'];
    const n = ctx.rng.int(6, 10);
    const books: [number, number, number, number][] = [];
    for (let k = 0; k < 600 && books.length < n; k++) {
      const x = snap(ctx.rng.float(r.x0 + 0.35, r.x1 - 0.35)), z = snap(ctx.rng.float(r.z0 + 0.35, r.z1 - 0.35));
      if (distToRoute(route, x, z) < clear) continue;
      if (blocks.some((b) => x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3)) continue;
      if (books.some((b) => Math.hypot(b[0] - x, b[2] - z) < 0.75)) continue;
      // 拾える（体を置ける）所: 壁から 0.35 m・本棚から 0.3 m 離した
      books.push([x, y, z, ctx.rng.float(-Math.PI, Math.PI)]);
    }
    if (books.length < 5) return;
    // 本棚（当たる箱 + 本の並び）
    for (const sh of shelves) {
      ctx.addBox(box([sh.x0, y, sh.z0], [sh.x1, y + 1.05, sh.z1], 'bookshelfWood'));
      const alongX = sh.x1 - sh.x0 > sh.z1 - sh.z0;
      for (const hy of [0.12, 0.55]) {
        let a = alongX ? sh.x0 + 0.06 : sh.z0 + 0.06;
        const end = alongX ? sh.x1 - 0.06 : sh.z1 - 0.06;
        while (a < end - 0.06) {
          const w = Math.min(end - a, ctx.rng.float(0.04, 0.09));
          const mat = ctx.rng.pick(COVERS);
          const hgt = ctx.rng.float(0.24, 0.36);
          ctx.addBox(alongX ? box([a, y + hy, sh.z0 - 0.005], [a + w - 0.004, y + hy + hgt, sh.z1 + 0.005], mat, false) : box([sh.x0 - 0.005, y + hy, a], [sh.x1 + 0.005, y + hy + hgt, a + w - 0.004], mat, false));
          a += w;
        }
      }
    }
    const set = ctx.addEntity('books', { type: 'collectSet', params: { items: books, r: pickR, desk: deskZone, deskSec: 1.2, kind: 'book', mats: books.map(() => ctx.rng.pick(COVERS)), route: thinRoute(route).map(([x, z]) => [x, y, z]), lamp: wallPoint(r, desk.d, desk.at, 0.3, y + 0.95) } });
    offer(ctx, { hook: 'carry.books.all', modes: ['appear'], weight: 1, revealOutput: `${set}.all`, doorway: { dir: desk.d, at: desk.doorAt, y, width: 1.0, height: 2.0 }, tell: '返却台の空の棚' });
    if (none) offer(ctx, { hook: 'carry.books.none', modes: ['appear'], weight: 0.9, revealOutput: `${set}.none`, doorway: { dir: none.d, at: none.at, y, width: 1.0, height: 2.0 }, tell: '本の落ちていない細い道' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});
