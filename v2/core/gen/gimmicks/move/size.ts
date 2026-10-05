/**
 * 身体の大きさが変わる部屋（sizeRoom）[M07 身体の大きさ・M45 縮小して通る穴]。
 * 入口の側に「小」「大」の札の付いた門が 2 つ。くぐると身体が小さく（約 1/3）・大きく（約 1.35 倍）なる。部屋の開口の前の床を
 * 踏むと元の大きさに戻る。部屋の真ん中を仕切る壁には、普通の通り口のほかに、床すれすれのネズミの穴（小さい身体だけ通れる近道）。
 * 小さいと家具は見上げるほど大きく、大きいと天井が低い（通り口ではかがむ）。
 * 隠し size.under [BM06]（出現型）: 横の壁際の脚の長い戸棚の下（床から 0.7 m）に、小さいまま潜り込むと、戸棚の脇の壁に扉が開く
 * （戸棚の下の壁には小さな穴が描いてある）
 */
import type { Dir } from '../../../math/vec.ts';
import { box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, doorZone, fillRects } from '../util.ts';
import { hallAabb, hallBox, hallOf, hallPoint, sideDir, wallAt } from './common.ts';


defineGimmick({
  id: 'sizeRoom', name: '身体の大きさが変わる部屋', axes: ['body', 'sight'], kinds: ['room', 'hall'], minSize: [4.4, 7.0], minHeight: 2.6, weight: 0.6, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const H = hallOf(s, false);
    if (!H || H.W < 4.4 || H.L < 7) return;
    const y = H.y;
    const T = 0.3;
    const vp = Math.round(H.L * 0.55 * 10) / 10;
    // 仕切りの範囲に横の開口があれば置かない
    if (s.openings.some((o) => o !== s.entrance && Math.abs(H.F.v(o.pos[0], o.pos[2]) - vp) < o.width / 2 + 0.6)) return;
    // 仕切り: 普通の通り口（出口の側の横の壁寄り）と、真ん中のネズミの穴
    const exitU = H.exitU ?? H.entU;
    const gw = 1.1;
    const gu = exitU > (H.F.u0 + H.F.u1) / 2 ? Math.min(H.F.u1 - gw / 2 - 0.1, exitU + 0.4) : Math.max(H.F.u0 + gw / 2 + 0.1, exitU - 0.4);
    const holeU = gu > (H.F.u0 + H.F.u1) / 2 ? H.F.u0 + (gu - gw / 2 - H.F.u0) / 2 : gu + gw / 2 + (H.F.u1 - gu - gw / 2) / 2;
    const HW = 0.55, HH = 0.7;
    if (Math.abs(holeU - gu) < gw / 2 + HW / 2 + 0.5) return;
    const wall = H.F.rect(H.F.u0, vp, H.F.u1, vp + T);
    const gap = H.F.rect(gu - gw / 2, vp, gu + gw / 2, vp + T);
    const hole = H.F.rect(holeU - HW / 2, vp, holeU + HW / 2, vp + T);
    for (const q of fillRects(wall, [gap, hole])) ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + H.h, q.z1], s.cell.palette.wall));
    // 通り口とネズミの穴の上（通り口は普通の扉の高さ。穴は床から 0.7 m）
    ctx.addBox(box([gap.x0, y + 2.1, gap.z0], [gap.x1, y + H.h, gap.z1], s.cell.palette.wall));
    ctx.addBox(box([hole.x0, y + HH, hole.z0], [hole.x1, y + H.h, hole.z1], s.cell.palette.wall));
    // 穴の縁取り（アーチの影）
    ctx.addBox(hallBox(H, holeU - HW / 2 - 0.04, vp - 0.01, holeU + HW / 2 + 0.04, vp, HH, HH + 0.05, 'trim', false));
    // 門（「小」「大」）: 入口の側の、入口の前を外した左右
    const gv = Math.max(1.6, Math.min(vp - 1.2, 2.2));
    const gates: { min: number[]; max: number[]; scale: number }[] = [];
    const small = t['move.size.small'], large = t['move.size.large'];
    // 門は横の壁寄り（入口から通り口へまっすぐ歩く線から 1 m 以上離す。知らずにくぐらない）
    const side = (k: number): number => (k < 0 ? H.F.u0 + 0.75 : H.F.u1 - 0.75);
    const lineD = (u: number): number => {
      const ax = H.entU, av = 0.5, bx = gu, bv = vp - 0.2;
      const ex = bx - ax, ev = bv - av, l2 = ex * ex + ev * ev;
      const k = Math.max(0, Math.min(1, ((u - ax) * ex + (gv - av) * ev) / l2));
      return Math.hypot(ax + ex * k - u, av + ev * k - gv);
    };
    const arch = (u: number, scale: number): void => {
      const w = 1.0;
      ctx.addBox(hallBox(H, u - w / 2 - 0.1, gv - 0.1, u - w / 2, gv + 0.1, 0, 2.2, 'goldTrim'));
      ctx.addBox(hallBox(H, u + w / 2, gv - 0.1, u + w / 2 + 0.1, gv + 0.1, 0, 2.2, 'goldTrim'));
      ctx.addBox(hallBox(H, u - w / 2 - 0.1, gv - 0.1, u + w / 2 + 0.1, gv + 0.1, 2.2, 2.35, 'goldTrim'));
      const sign = ctx.addBox(hallBox(H, u - 0.18, gv - 0.12, u + 0.18, gv - 0.11, 2.4, 2.58, 'signPlate', false));
      sign.kind = scale < 1 ? 'sizeSignSmall' : 'sizeSignLarge';
      gates.push({ ...aabbJson(hallAabb(H, u - w / 2 + 0.05, gv - 0.1, u + w / 2 - 0.05, gv + 0.1, -0.1, 2.2)) as { min: number[]; max: number[] }, scale });
    };
    const lo = side(-1), hi = side(1);
    if (hi - lo < 2.2 || lineD(lo) < 1.0 || lineD(hi) < 1.0) return;
    const smallLeft = ctx.rng.chance(0.5);
    arch(smallLeft ? lo : hi, small);
    arch(smallLeft ? hi : lo, large);
    // 開口の前の床で元の大きさへ
    for (const o of s.openings) gates.push({ ...aabbJson(doorZone(o, y, 1.3, 0.2)) as { min: number[]; max: number[] }, scale: 1 });
    ctx.addEntity('gates', { type: 'sizeGate', params: { gates } });
    // 隠し（出現型）: 横の壁際の脚の長い戸棚。下に小さいまま潜ると、戸棚の脇の壁に扉
    for (const hiSide of ctx.rng.shuffle([true, false])) {
      const dir: Dir = sideDir(H, hiSide);
      if (s.openings.some((o) => o.dir === dir)) continue;
      const wallU = hiSide ? H.F.u1 : H.F.u0;
      const cw = 1.6, cd = 0.6;
      const cv0 = vp + T + 0.8, cv1 = cv0 + cw;
      const dv = cv1 + 0.9;
      if (dv + 0.6 > H.L - 1.3) continue;
      const cu0 = hiSide ? wallU - cd : wallU, cu1 = hiSide ? wallU : wallU + cd;
      ctx.addBox(hallBox(H, cu0, cv0, cu1, cv1, 0.7, 1.7, 'woodPanel'));
      for (const lu of [cu0 + 0.05, cu1 - 0.1]) for (const lv of [cv0 + 0.05, cv1 - 0.1]) ctx.addBox(hallBox(H, lu, lv, lu + 0.05, lv + 0.05, 0, 0.7, 'woodPanel', false));
      // 壁の小さな穴（戸棚の下）
      const wu = hiSide ? wallU - 0.01 : wallU;
      const mh = ctx.addBox(hallBox(H, wu, (cv0 + cv1) / 2 - 0.13, wu + 0.01, (cv0 + cv1) / 2 + 0.13, 0, 0.22, 'shadowDecal', false));
      mh.kind = 'mouseHole';
      const sensor = ctx.addEntity('under', { type: 'stateSensor', params: { aabb: aabbJson(hallAabb(H, cu0, cv0, cu1, cv1, -0.1, 0.65)), when: [`scaleBelow:${(small + 1) / 2}`], sec: t['move.size.underSec'] } });
      ctx.offerSecret({ hook: 'size.under', modes: ['appear'], weight: 1.0, revealOutput: `${sensor}.done`, doorway: { dir, at: wallAt(H, dir, wallU, dv), y, width: 1.0, height: 2.0 }, tell: '脚の長い戸棚の下の壁に、小さな穴' });
      // 戸棚のまわりと、扉の前には物を置かない
      ctx.keepOut(hallAabb(H, Math.min(cu0, cu1) - 0.9, cv0 - 0.6, Math.max(cu0, cu1) + 0.9, dv + 0.8, -0.1, H.h));
      break;
    }
    // 門の上の照明
    const c = hallPoint(H, (H.F.u0 + H.F.u1) / 2, gv, H.h - 0.3);
    s.cell.lights.push({ pos: c, color: 0xffe2b8, intensity: 0.4, distance: 4 });
    ctx.keepOut(hallAabb(H, H.F.u0, gv - 0.8, H.F.u1, gv + 0.8, -0.1, H.h));
    ctx.keepOut(hallAabb(H, H.F.u0, vp - 1.0, H.F.u1, vp + T + 1.0, -0.1, H.h));
  },
});
