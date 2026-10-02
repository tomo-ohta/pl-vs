/**
 * サーチライトの部屋（段階 4・担当 sense）[L04]。入口と出口が向かい合う、暗い部屋。入口から出口へ向かう道を、横切る帯（黄色い線で縁取り）が
 * 1〜3 本。帯ごとに天井の光の円が帯に沿って往復する（速さは帯ごとに違う）。円に入ると警報が鳴り、その帯の手前へ戻される（少し戻される）。
 * 帯の間の床は安全。光が遠ざかった隙に渡る。
 * 裏の振る舞い [BL05]: わざと何度も（catchesToCorner 回）見つかると、戻される先が部屋の隅に変わる。そこに隠しの扉
 * （存在型 = 隅の木箱の陰に最初からある・出現型 = 隅へ送られたときに壁が開く）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { innerRect, wallFrame } from '../util.ts';
import { darkenRoom } from './util.ts';

defineGimmick({
  id: 'searchlight', name: 'サーチライト', axes: ['light', 'sight'], kinds: ['room', 'hall'], minSize: [4.2, 8], weight: 0.45, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const F = wallFrame(innerRect(s), s.entrance!.dir);
    const strip = t['sense.search.stripM'], laneW = t['sense.search.laneM'], safe = t['sense.search.safeM'];
    const mid = F.depth - 2 * strip;
    // 帯の数: 帯と帯の間・帯と入口 / 出口の床の間に、どれも safe 以上の安全な床が残る数
    const n = Math.min(3, Math.floor((mid - safe) / (laneW + safe)));
    if (n < 1 || F.u1 - F.u0 < 3.5) return;
    // 帯の並び: 残りの床を安全な床に等しく分ける
    const gap = (mid - n * laneW) / (n + 1);
    const R = t['sense.search.radiusM'];
    const lanes: number[][] = [], laneRects: number[][] = [], backs: number[][] = [];
    const yawFwd = (() => { const p = F.point(0, 0), q = F.point(0, 1); return Math.atan2(-(q[0] - p[0]), -(q[1] - p[1])); })();
    const B: Box[] = [];
    for (let k = 0; k < n; k++) {
      const v0 = strip + gap * (k + 1) + laneW * k, v1 = v0 + laneW, vc = (v0 + v1) / 2;
      const a = F.point(F.u0 + R * 0.6, vc), b = F.point(F.u1 - R * 0.6, vc);
      const speed = ctx.rng.float(t['sense.search.speedMin'], t['sense.search.speedMax']);
      lanes.push([a[0], a[1], b[0], b[1], speed, ctx.rng.float(0, 10)]);
      const lr = F.rect(F.u0, v0, F.u1, v1);
      laneRects.push([lr.x0, lr.z0, lr.x1, lr.z1]);
      // 帯の手前の床（戻される先）
      const bv0 = k === 0 ? 0.6 : v0 - gap + 0.2, bv1 = v0 - 0.25;
      const br = F.rect(F.u0, bv0, F.u1, bv1);
      backs.push([br.x0, br.z0, br.x1, br.z1, yawFwd]);
      // 帯の縁の黄色い線と、両側の壁のサーチライトの器具
      for (const v of [v0, v1]) { const r = F.rect(F.u0, v - 0.03, F.u1, v + 0.03); B.push(box([r.x0, y, r.z0], [r.x1, y + 0.006, r.z1], 'yellowLine', false)); }
      for (const u of [F.u0, F.u1]) {
        const inward = u === F.u0 ? 1 : -1;
        const h = F.rect(u, vc - 0.18, u + inward * 0.32, vc + 0.18);
        B.push(box([h.x0, y + 2.05, h.z0], [h.x1, y + 2.35, h.z1], 'metalDark', false));
        const lens = F.rect(u + inward * 0.32, vc - 0.13, u + inward * 0.35, vc + 0.13);
        B.push(box([lens.x0, y + 2.1, lens.z0], [lens.x1, y + 2.3, lens.z1], 'lightYellow', false));
      }
    }
    for (const b of B) ctx.addBox(b);
    darkenRoom(ctx);
    // 安全な床の両端の木箱（隠れる所に見える。渡る道は塞がない）
    const crate = (u: number, v: number, w: number): void => {
      const r = F.rect(u - w / 2, v - w / 2, u + w / 2, v + w / 2);
      const c = box([r.x0, y, r.z0], [r.x1, y + w * 0.9, r.z1], 'boxCardboard');
      c.propGroup = `${s.cell.id}/${ctx.id}.crate${Math.round(u * 10)}_${Math.round(v * 10)}`;
      ctx.addBox(c);
    };
    // 隅（BL05）: 最後の帯の手前の安全な床の、入口から遠い横の壁の際。扉の両脇に木箱（陰）
    const e = s.entrance!;
    const eu = F.u(e.pos[0], e.pos[2]);
    const sideU = Math.abs(eu - F.u0) > Math.abs(eu - F.u1) ? F.u0 : F.u1;
    const inward = sideU === F.u0 ? 1 : -1;
    const lastV0 = strip + gap * n + laneW * (n - 1);
    const backLo = n > 1 ? lastV0 - gap : 0.3, backHi = lastV0;
    const cv = (backLo + backHi) / 2;
    const cornerPt = F.point(sideU + inward * 0.8, cv);
    const cornerYaw = (() => { const q = F.point(sideU, cv); return Math.atan2(-(q[0] - cornerPt[0]), -(q[1] - cornerPt[1])); })();
    if (backHi - backLo >= 2.6) for (const dv of [-0.95, 0.95]) crate(sideU + inward * 0.32, cv + dv, 0.5);
    const opp = sideU === F.u0 ? F.u1 : F.u0;
    crate(opp - inward * 0.4, cv, 0.55);
    // 渡る道（試験の歩く人の手がかり）: 部屋の真ん中を入口の床から出口の床へ
    const uc = (F.u0 + F.u1) / 2;
    const cross = [F.point(uc, strip * 0.5), F.point(uc, F.depth - strip * 0.5)];
    ctx.addEntity('lights', { type: 'searchlight', params: { lanes, laneRects, backs, cross, radius: R, y, corner: [cornerPt[0], cornerPt[1], cornerYaw], catchesToCorner: t['sense.search.catchesToCorner'], ceilingY: y + s.cell.height } });
    // 隠しの扉: 隅の横の壁（壁 dir は横の壁の外向き）
    const wallDir = sideDir(F.d, sideU === F.u0);
    const at = F.d === 0 || F.d === 2 ? cornerPt[1] : cornerPt[0];
    ctx.offerSecret({ hook: 'search.caught', modes: ['present', 'appear'], weight: 1, revealOutput: `${ctx.id}.lights.corner`, doorway: { dir: wallDir, at, y, width: 1.0, height: 2.0 }, tell: '捕まって戻される隅の、木箱の陰' });
    const all = F.rect(F.u0, 0, F.u1, F.depth);
    ctx.keepOut({ min: [all.x0, y, all.z0], max: [all.x1, y + 3, all.z1] });
  },
});

/** 入口の壁 d の、壁に沿った座標の小さい側（low = true）/ 大きい側の横の壁の向き（外向き） */
function sideDir(d: Dir, low: boolean): Dir {
  // 入口の壁が x に沿う（d = 0 / 2）なら横の壁は x の両端: 小さい側は -X（3）、大きい側は +X（1）。z に沿うなら -Z（2）/ +Z（0）
  if (d === 0 || d === 2) return low ? 3 : 1;
  return low ? 2 : 0;
}
