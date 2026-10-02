/**
 * 霧の誘導灯 [L07]（段階 4・担当 sense）。
 * 濃い霧の、深い穴の部屋。入口と出口の床の間を、細い道（手すりの無い床）が折れながら渡る。道の角と途中に誘導灯が立ち、
 * 出口の向きへ順に流れるように点滅する（霧の先の灯りがぼんやり見える）。道を外れると穴の底（階段で入口へ）。
 * 裏の振る舞い [BL06]: 道の途中から、横の壁へ向かう分かれ道。分かれ道の灯りは少し黄色く、逆の向きに流れる（偽の灯り）。
 *     その先の壁に隠しの扉（存在型 = 最初からある・出現型 = 道の端に立つと壁が開く）
 */
import { box, type Box } from '../../../world/layout.ts';
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, rectGap } from '../util.ts';
import { buildPit, lightPit } from './util.ts';

defineGimmick({
  id: 'fogBeacons', name: '霧の誘導灯', axes: ['light', 'floor'], kinds: ['room', 'hall'], minSize: [4.5, 7], weight: 0.45, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit && s.cell.footprint.length === 1,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const plan = lightPit(ctx, t['sense.beacon.depthM']);
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    const v0 = landD, v1 = F.depth - landD;
    if (v1 - v0 < 3.5) return;
    const W = t['sense.beacon.walkM'];
    // 階段（横の壁沿い）の側は空ける
    const lu = [F.u(plan.lane.x0, plan.lane.z0), F.u(plan.lane.x1, plan.lane.z1)];
    const laneLow = Math.min(...lu) - F.u0 < F.u1 - Math.max(...lu);
    let uMin = F.u0 + 0.9, uMax = F.u1 - 0.9;
    if (laneLow) uMin = Math.max(uMin, Math.max(...lu) + W / 2 + 0.5);
    else uMax = Math.min(uMax, Math.min(...lu) - W / 2 - 0.5);
    if (uMax - uMin < 0) return;
    // 本当の道: 入口の床の縁 → 折れ点 → 出口の床の縁（u・v の折れ線）
    const turns = uMax - uMin < 1.3 ? 0 : v1 - v0 >= 6 ? 2 : 1;
    const U = (): number => ctx.rng.float(uMin, uMax);
    let u = U();
    const pts: [number, number][] = [[u, v0 - 0.2]];
    for (let k = 1; k <= turns; k++) {
      const vk = v0 + ((v1 - v0) * k) / (turns + 1) + ctx.rng.float(-0.4, 0.4);
      pts.push([u, vk]);
      let nu = U();
      for (let g = 0; g < 6 && Math.abs(nu - u) < 1.6; g++) nu = U();
      if (Math.abs(nu - u) < 1.2) nu = u < (uMin + uMax) / 2 ? Math.min(uMax, u + 1.6) : Math.max(uMin, u - 1.6);
      u = nu;
      pts.push([u, vk]);
    }
    pts.push([u, v1 + 0.2]);
    // 道の床板（細い板。下は空いていて、落ちても底を歩いて階段へ）
    const rectOf = (a: [number, number], b: [number, number]): Rect => F.rect(Math.min(a[0], b[0]) - W / 2, Math.min(a[1], b[1]) - (a[0] === b[0] ? 0 : W / 2), Math.max(a[0], b[0]) + W / 2, Math.max(a[1], b[1]) + (a[0] === b[0] ? 0 : W / 2));
    const walk: Rect[] = [];
    for (let i = 1; i < pts.length; i++) walk.push(rectOf(pts[i - 1]!, pts[i]!));
    // 道が階段の上の固い所（入口・出口の床を除く）に掛からない
    const stairs = plan.solidTop.filter((q) => !plan.landings.some((l) => l.rect === q));
    if (walk.some((w) => stairs.some((q) => rectGap(q, w) < 0.4))) return;
    // 偽の道（BL06）: 道の途中（縦の区間の真ん中）か角から、横の壁へまっすぐ。ほかの区間・階段・開口の床から離す
    let fake: { from: [number, number]; to: [number, number]; dir: Dir; at: number } | null = null;
    const starts: { p: [number, number]; skip: number[] }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!, q = pts[i]!;
      if (p[0] === q[0] && Math.abs(q[1] - p[1]) > 1.6) starts.push({ p: [p[0], (p[1] + q[1]) / 2], skip: [i - 1] });
      // 角（区間 i-1 と i の間の点 p）。最初と最後の点は開口の床の上なので除く
      if (i >= 2) starts.push({ p, skip: [i - 2, i - 1] });
    }
    for (const st of ctx.rng.shuffle(starts)) {
      for (const toLow of ctx.rng.shuffle([true, false])) {
        const wallU = toLow ? F.u0 : F.u1;
        if (Math.abs(wallU - st.p[0]) < 1.2) continue;
        const br = F.rect(Math.min(st.p[0], wallU), st.p[1] - W / 2, Math.max(st.p[0], wallU), st.p[1] + W / 2);
        if (walk.some((w, k) => !st.skip.includes(k) && rectGap(w, br) < 0.5)) continue;
        // 角から出す道は、角の横の区間と重ならない向き（角の先へまっすぐ）
        if (st.skip.length === 2 && st.skip.some((k) => { const a = pts[k]!, b = pts[k + 1]!; return a[1] === b[1] && (Math.min(a[0], b[0]) < Math.max(st.p[0], wallU) - 0.05 && Math.max(a[0], b[0]) > Math.min(st.p[0], wallU) + 0.05); })) continue;
        if (stairs.some((x) => rectGap(x, br) < 0.4) || plan.landings.some((l) => rectGap(l.rect, br) < 0.6)) continue;
        // 横の壁の向き（u の小さい側 / 大きい側）
        const alongX = F.d === 0 || F.d === 2;
        const dir: Dir = alongX ? (toLow ? 3 : 1) : (toLow ? 2 : 0);
        const wp = F.point(wallU, st.p[1]);
        fake = { from: st.p, to: [wallU, st.p[1]], dir, at: alongX ? wp[1] : wp[0] };
        walk.push(br);
        break;
      }
      if (fake) break;
    }
    buildPit(ctx, plan);
    const B: Box[] = [];
    for (const r of walk) B.push(box([r.x0, y - 0.2, r.z0], [r.x1, y, r.z1], s.cell.palette.floor));
    // 誘導灯: 本当の道の角と途中（spacing ごと）。道の脇に立つ細い柱と光る頭
    const beacons: { pos: number[]; order: number; fake: boolean }[] = [];
    const sp = t['sense.beacon.spacingM'];
    let order = 0;
    const post = (uu: number, vv: number, isFake: boolean): void => {
      const [x, z] = F.point(uu, vv);
      B.push(box([x - 0.03, y, z - 0.03], [x + 0.03, y + 0.9, z + 0.03], 'metalDark', false));
      beacons.push({ pos: [x, y + 0.98, z], order: isFake ? -1 : order++, fake: isFake });
    };
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!, q = pts[i]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const m = Math.max(1, Math.round(len / sp));
      for (let k = i === 1 ? 0 : 1; k <= m; k++) {
        const f = k / m;
        const uu = p[0] + (q[0] - p[0]) * f, vv = p[1] + (q[1] - p[1]) * f;
        // 道の縁（進む向きの右）に立てる
        const side = p[0] === q[0] ? [W / 2 - 0.08, 0] : [0, W / 2 - 0.08];
        post(uu + side[0]!, vv + side[1]!, false);
      }
    }
    if (fake) {
      const len = Math.abs(fake.to[0] - fake.from[0]);
      const m = Math.max(2, Math.round(len / sp));
      const fb: number[] = [];
      for (let k = 1; k <= m; k++) fb.push(fake.from[0] + ((fake.to[0] - fake.from[0]) * (k - 0.3)) / m);
      fb.forEach((uu, k) => { post(uu, fake!.from[1] + W / 2 - 0.08, true); beacons[beacons.length - 1]!.order = -(k + 1); });
    }
    for (const b of B) ctx.addBox(b);
    // 濃い霧（部屋の中だけ）
    const fogColor = 0xa9b0b4;
    s.cell.render = { ...s.cell.render, fog: { color: fogColor, near: t['sense.beacon.fogNear'], far: t['sense.beacon.fogFar'] } };
    s.cell.palette = { ...s.cell.palette, fog: fogColor };
    ctx.addEntity('beacons', { type: 'senseFx', params: { fx: 'beacons', beacons, path: pts.map(([uu, vv]) => F.point(uu, vv)), ...(fake ? { fake: [F.point(fake.from[0], fake.from[1]), F.point(fake.to[0], fake.to[1])] } : {}) } });
    // 家具は穴の上・道の上に置かない
    ctx.keepOut({ min: [plan.hole.x0, y - plan.depth, plan.hole.z0], max: [plan.hole.x1, y + 2.6, plan.hole.z1] });
    if (fake) {
      const [ex, ez] = F.point(fake.to[0] + (fake.to[0] > fake.from[0] ? -0.6 : 0.6), fake.from[1]);
      const zone = ctx.addEntity('fakeEnd', { type: 'zoneSensor', params: { aabb: aabbJson({ min: [ex - 0.7, y - 0.1, ez - 0.7], max: [ex + 0.7, y + 2, ez + 0.7] }) } });
      const hold = ctx.addEntity('fakeHold', { type: 'timer', params: { onDelay: 0.8, offDelay: 0 }, inputs: { in: `${zone}.in` } });
      ctx.offerSecret({ hook: 'beacon.fake', modes: ['present', 'appear'], weight: 1, revealOutput: `${hold}.out`, doorway: { dir: fake.dir, at: fake.at, y, width: 1.0, height: 2.0 }, tell: '少し黄色く、逆の向きに流れる誘導灯の先' });
    }
  },
});
