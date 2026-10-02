/**
 * 水・球の中を渡る部屋（2 種）。
 *
 * - poolRoom 深いプール（pit.ts の planPit で床ほぼ全体が穴。水面は床の 0.35 m 下）。入口の床からは水の中の階段で下りる。
 *     swim 泳ぐ [M23]: 泳いで渡り、出口の床の縁へ前へ押して這い上がる。底のレーンの線と水面のロープ
 *     stones 跳び石 [M25]: 水面から少し出た石の柱が向こう岸までジグザグに並ぶ。跳んで渡る（落ちても泳いで石・岸へ上がれる）
 * - ballPool ボールプール [QR M40]: 部屋の中が色とりどりの球で埋まっている。浅い道（膝まで）を選べば普通に近い速さで進めるが、
 *     深い所（胸まで）は遅く、球に押されてよろける。隠し balls.dive [BM14]（出現型）: 壁際のいちばん深い所でしゃがんで
 *     じっとしている（潜る）と、球の下の壁に扉が開く
 */
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box } from '../../../world/layout.ts';
import { buildPit, planPit } from '../pit.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, fillRects, rectGap } from '../util.ts';
import { hallAabb, hallBox, hallOf, sideDir, wallAt } from './common.ts';

const opposite = (s: { entrance: { dir: number } | null; exit: { dir: number } | null }): boolean => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4;

// ---------------------------------------------------------------- 深いプール
defineGimmick({
  id: 'poolRoom', name: '深いプール', axes: ['move'], kinds: ['room', 'hall'], minSize: [4.6, 7.0], minHeight: 2.6, weight: 1.0, intensity: 1, onMainPath: true,
  fits: opposite,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning, y = s.cell.floorY;
    const depth = t['move.pool.depthM'];
    const plan = planPit(ctx, { depth, strips: true });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const vt = F.depth - landD;
    if (vt - landD < 2.4) return;
    const surf = y - t['move.pool.surfaceM'];
    const ent = s.entrance!, ex = s.exit!;
    const entU = F.u(ent.pos[0], ent.pos[2]), exU = F.u(ex.pos[0], ex.pos[2]);
    // 跳び石の並び（置けなければ泳ぐ）
    let stones: Rect[] = [];
    if (ctx.rng.chance(t['move.pool.stoneChance'])) {
      const S = 0.75;
      const a = landD + 0.15 + S / 2, b = vt - 0.15 - S / 2;
      const n = Math.max(2, Math.ceil((b - a) / 1.3) + 1);
      const side = ctx.rng.chance(0.5) ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const v = a + (b - a) * k;
        let u = entU + (exU - entU) * k + (i % 2 === 0 ? 0.5 : -0.5) * side;
        u = Math.min(F.u1 - 0.5 - S / 2, Math.max(F.u0 + 0.5 + S / 2, u));
        const r = F.rect(u - S / 2, v - S / 2, u + S / 2, v + S / 2);
        if (rectGap(r, plan.lane) < 0.4 || (plan.ledge && rectGap(r, plan.ledge) < 0.4)) { stones = []; break; }
        stones.push(r);
      }
    }
    buildPit(ctx, plan);
    const hole = plan.hole;
    // 水面（当たらない）と、泳ぐゾーン
    const water: Box = box([hole.x0, surf - 0.02, hole.z0], [hole.x1, surf, hole.z1], 'puddle', false);
    water.kind = 'poolWater';
    ctx.addBox(water);
    s.cell.zones.push({ kind: 'swim', aabb: { min: [hole.x0, y - depth - 0.1, hole.z0], max: [hole.x1, surf + 0.6, hole.z1] }, params: { surface: surf } });
    if (stones.length) {
      for (const r of stones) {
        const b = ctx.addBox(box([r.x0, y - depth, r.z0], [r.x1, y - 0.12, r.z1], 'columnConcrete'));
        b.kind = 'steppingStone';
      }
    } else {
      // 底のレーンの線と、水面のロープ（浮き）
      for (let u = F.u0 + 1.6; u < F.u1 - 0.8; u += 1.6) {
        const lr = F.rect(u - 0.06, landD + 0.4, u + 0.06, vt - 0.4);
        ctx.addBox(box([lr.x0, y - depth, lr.z0], [lr.x1, y - depth + 0.005, lr.z1], 'trim', false));
        const fr = F.rect(u - 0.05, landD, u + 0.05, vt);
        const f = ctx.addBox(box([fr.x0, surf - 0.03, fr.z0], [fr.x1, surf + 0.05, fr.z1], 'plasticRed', false));
        f.kind = 'laneRope';
      }
    }
    // 水の中の灯り
    const c = F.point((F.u0 + F.u1) / 2, (landD + vt) / 2);
    s.cell.lights.push({ pos: [c[0], y - depth + 0.4, c[1]], color: 0x7fc8ff, intensity: 0.45, distance: 7 });
    ctx.keepOut({ min: [hole.x0, y - depth, hole.z0], max: [hole.x1, y + 2.5, hole.z1] });
  },
});

// ---------------------------------------------------------------- ボールプール
defineGimmick({
  id: 'ballPool', name: 'ボールプール', axes: ['move', 'body'], kinds: ['room', 'hall'], minSize: [4.0, 6.0], weight: 0.7, intensity: 1, offersSecret: true, onMainPath: true,
  fits: opposite,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const H = hallOf(s);
    if (!H) return;
    const land = 1.2, v0 = land, v1 = H.L - land;
    if (v1 - v0 < 3 || H.W < 3.6) return;
    // 横の開口の前（ボールの中に扉が無いように）は外す
    if (s.openings.some((o) => o !== s.entrance && o !== s.exit && (() => { const v = H.F.v(o.pos[0], o.pos[2]); return v > v0 - 0.6 && v < v1 + 0.6; })())) return;
    const hw = 0.6;
    const cl = (u: number): number => Math.min(H.F.u1 - hw - 0.1, Math.max(H.F.u0 + hw + 0.1, u));
    const eu = cl(H.entU), xu = cl(H.exitU ?? H.entU);
    // 浅い道: 入口の前から奥へ → 横へ（寄り道） → 奥へ → 出口の前へ
    const um = cl(ctx.rng.chance(0.5) ? H.F.u0 + hw + 0.4 : H.F.u1 - hw - 0.4);
    const va = v0 + (v1 - v0) * ctx.rng.float(0.25, 0.4), vb = v0 + (v1 - v0) * ctx.rng.float(0.6, 0.75);
    const seg = (ua: number, va_: number, ub: number, vb_: number): Rect => H.F.rect(Math.min(ua, ub) - hw, Math.min(va_, vb_) - hw, Math.max(ua, ub) + hw, Math.max(va_, vb_) + hw);
    const pool = H.F.rect(H.F.u0, v0, H.F.u1, v1);
    const clip = (r: Rect): Rect => ({ x0: Math.max(pool.x0, r.x0), z0: Math.max(pool.z0, r.z0), x1: Math.min(pool.x1, r.x1), z1: Math.min(pool.z1, r.z1) });
    const lanes = [seg(eu, v0, eu, va), seg(eu, va, um, va), seg(um, va, um, vb), seg(um, vb, xu, vb), seg(xu, vb, xu, v1)].map(clip).filter((r) => r.x1 - r.x0 > 0.05 && r.z1 - r.z0 > 0.05);
    // いちばん深い所: 寄り道と反対の横の壁際の、真ん中あたり
    const hi = um < (H.F.u0 + H.F.u1) / 2;
    const pw = 1.6;
    const pu0 = hi ? H.F.u1 - pw : H.F.u0, pu1 = hi ? H.F.u1 : H.F.u0 + pw;
    const pv = (va + vb) / 2;
    const pocket = H.F.rect(pu0, pv - pw / 2, pu1, pv + pw / 2);
    const pocketOk = !lanes.some((l) => rectGap(l, pocket) < 0.2);
    const deep = fillRects(pool, [...lanes, ...(pocketOk ? [pocket] : [])]);
    const y = H.y;
    const zone = (r: Rect, slow: number, sink: number): void => { s.cell.zones.push({ kind: 'water', aabb: { min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 1.2, r.z1] }, params: { dry: true, slow, sink } }); };
    const rects: { x0: number; z0: number; x1: number; z1: number; depth: number }[] = [];
    // 浅い道は重ならないように、深い所・ほかの道と分けてゾーンにする（道どうしの重なりは同じ値なので構わない）
    for (const r of lanes) { zone(r, t['move.balls.shallowSlow'], 0.08); rects.push({ ...r, depth: 0.35 }); }
    for (const r of deep) { zone(r, t['move.balls.deepSlow'], 0.4); rects.push({ ...r, depth: 0.95 }); }
    if (pocketOk) { zone(pocket, t['move.balls.deepSlow'] * 0.8, 0.7); rects.push({ ...pocket, depth: 1.45 }); }
    ctx.addEntity('balls', { type: 'ballPit', params: { rects, y, jostle: t['move.balls.jostle'], seed: ctx.rng.int(1, 1e6) } });
    // 縁のクッション（低いので跨げる）
    for (const v of [v0 - 0.2, v1]) ctx.addBox(hallBox(H, H.F.u0, v, H.F.u1, v + 0.2, 0, 0.12, 'plasticBlue'));
    // 隠し（出現型）: いちばん深い所でしゃがんでじっとしている → その壁の、球の下の扉
    if (pocketOk) {
      const sensor = ctx.addEntity('dive', { type: 'stateSensor', params: { aabb: aabbJson({ min: [pocket.x0, y - 0.1, pocket.z0], max: [pocket.x1, y + 1.0, pocket.z1] }), when: ['crouch', 'idle', 'ground'], sec: t['move.balls.diveSec'] } });
      const dir = sideDir(H, hi);
      ctx.offerSecret({ hook: 'balls.dive', modes: ['appear'], weight: 1.0, revealOutput: `${sensor}.done`, doorway: { dir, at: wallAt(H, dir, hi ? H.F.u1 : H.F.u0, pv), y, width: 1.0, height: 2.0 }, tell: '壁際のいちばん深い所だけ、球の色が濃い' });
    }
    ctx.keepOut(hallAabb(H, H.F.u0, v0 - 0.2, H.F.u1, v1 + 0.2, -0.1, H.h));
  },
});
