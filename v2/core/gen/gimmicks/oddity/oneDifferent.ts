/**
 * 一つだけ違う（X02 + 4.7 BX05 同じ部屋が並ぶ所で、1 つだけ違う部屋の違う家具に触れる。段階 4・oddity）。
 *
 * 部屋の開口の無い壁沿いに、天井までの仕切りで同じ小部屋（ブース）が 3〜5 つ並ぶ。どのブースも机・椅子・電気スタンド・額・鉢植え・
 * ごみ箱が同じ並び。ただ 1 つのブースだけ、1 つの家具が違う（椅子の色・椅子の向き・灯りの点き方・額の絵・机の上の赤い玉）。
 * - 表の振る舞い: 並びを眺めて通り過ぎる
 * - 裏の振る舞い: 違う家具に触れる（調べる E / タップ）→ そのブースの奥の壁に隠しの扉（出現型）。
 *   存在型では、違うブースの奥の壁に初めから壁と同じ色の扉がある（違いに気づいた人だけが奥を見る）
 * 閉じ込めない: ブースは前が開いていて、ブースの前の通り道で開口どうしがつながる（tryBuild が確かめる）
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Dir } from '../../../math/vec.ts';
import { box, type Box } from '../../../world/layout.ts';
import { bin, lamp, plant } from '../../dress/props.ts';
import { chair } from '../../dress/furniture.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, innerRect, wallFrame } from '../util.ts';

/** 違いの種類 */
const DIFFS = ['chairColor', 'chairTurned', 'lamp', 'picture', 'extra'] as const;
/** ブースの幅の下限: 机と椅子（左から 1.37 m）の右に、隠しの扉へ通る道（0.8 m）が残る幅 */
const BOOTH_MIN = 2.25;
type Diff = (typeof DIFFS)[number];

/** 床から（作業座標 y = 0）作った箱をフロア座標へ */
function up(B: Box[], fy: number): Box[] {
  for (const b of B) { b.min = [b.min[0], b.min[1] + fy, b.min[2]]; b.max = [b.max[0], b.max[1] + fy, b.max[2]]; }
  return B;
}

const bbOf = (B: readonly Box[]): { min: [number, number, number]; max: [number, number, number] } => ({
  min: [Math.min(...B.map((b) => b.min[0])), Math.min(...B.map((b) => b.min[1])), Math.min(...B.map((b) => b.min[2]))],
  max: [Math.max(...B.map((b) => b.max[0])), Math.max(...B.map((b) => b.max[1])), Math.max(...B.map((b) => b.max[2]))],
});

defineGimmick({
  id: 'oneDifferent', name: '一つだけ違う', axes: ['sight', 'puzzle'], kinds: ['room', 'hall'], minSize: [4.6, 6.6], minHeight: 2.4, weight: 0.8, intensity: 1, offersSecret: true, onMainPath: true,
  build(ctx: GimmickContext) {
    const s = ctx.slot, t = ctx.tuning, cell = s.cell, fy = cell.floorY, h = cell.height;
    const r = innerRect(s);
    const D = t['anomaly.oneDifferent.depthM'];
    // ブースを並べる壁: 主の矩形の、開口の無い壁のうち長い物。横の壁の開口がブースの帯に掛からないこと
    const walls = ([0, 1, 2, 3] as const).filter((d) => !s.openings.some((o) => o.dir === d && Math.abs((d === 0 || d === 2 ? o.pos[2] : o.pos[0]) - (d === 0 ? s.rect.z1 : d === 2 ? s.rect.z0 : d === 1 ? s.rect.x1 : s.rect.x0)) < 0.05));
    const cands = walls.map((d) => ({ d, F: wallFrame(r, d) })).filter(({ d, F }) => {
      if (F.depth < D + 2.0 || F.u1 - F.u0 < 3 * BOOTH_MIN) return false;
      return s.openings.every((o) => {
        const v = F.v(o.pos[0], o.pos[2]);
        // 横の壁の開口: 開口の前の空ける範囲（幅の半分 0.8 m 以上）がブースの奥行きより前
        return o.dir === (d + 2) % 4 || v > D + Math.max(0.8, o.width / 2 + 0.35) + 0.05;
      });
    }).sort((a, b) => b.F.u1 - b.F.u0 - (a.F.u1 - a.F.u0));
    const c = cands[0];
    if (!c) return;
    const { d, F } = c;
    const L = F.u1 - F.u0;
    const n = Math.max(3, Math.min(5, Math.floor(L / Math.max(BOOTH_MIN, t['anomaly.oneDifferent.boothM']))));
    const w = L / n;
    const odd = ctx.rng.int(0, n - 1);
    const diff: Diff = ctx.rng.pick(DIFFS);
    // ブースの中の向き: 左の仕切りを向いて座る（u が増える向きを「右」）
    const toward = (sign: number): Dir => {
      // 床の向き (du, 0) を Dir に
      const [x0, z0] = F.point(0, 0), [x1, z1] = F.point(sign, 0);
      const dx = x1 - x0, dz = z1 - z0;
      return (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2) as Dir;
    };
    const wallMat = cell.palette.wall;
    for (let i = 0; i < n; i++) {
      const u0 = F.u0 + i * w, u1 = u0 + w, uc = (u0 + u1) / 2;
      // 仕切り（天井まで）と、前の袖壁
      if (i > 0) { const R = F.rect(u0 - 0.05, 0, u0 + 0.05, D); ctx.addBox(box([R.x0, fy, R.z0], [R.x1, fy + h, R.z1], wallMat)); }
      for (const [a0, a1] of [[u0 + 0.05, u0 + 0.32], [u1 - 0.32, u1 - 0.05]] as const) {
        if ((i === 0 && a0 < u0 + 0.1) || (i === n - 1 && a1 > u1 - 0.1)) continue;
        const R = F.rect(a0, D - 0.1, a1, D);
        ctx.addBox(box([R.x0, fy, R.z0], [R.x1, fy + h, R.z1], wallMat));
      }
      // ブースの上の梁（同じ小部屋が並んで見えるように）
      { const R = F.rect(u0 + 0.05, D - 0.1, u1 - 0.05, D); ctx.addBox(box([R.x0, fy + 2.25, R.z0], [R.x1, fy + h, R.z1], wallMat, false)); }
      const isOdd = i === odd;
      // 机（左の仕切りに沿って）・椅子・電気スタンド・額・鉢植え・ごみ箱
      const deskU = u0 + 0.5, deskV = 0.95;
      const deskR = F.rect(deskU - 0.32, deskV - 0.6, deskU + 0.32, deskV + 0.6);
      const B: Box[] = [box([deskR.x0, 0.7, deskR.z0], [deskR.x1, 0.73, deskR.z1], 'furnitureLight', true)];
      for (const [vv] of [[deskV - 0.55], [deskV + 0.55]] as const) {
        const L2 = F.rect(deskU - 0.3, vv - 0.03, deskU + 0.3, vv + 0.03);
        B.push(box([L2.x0, 0, L2.z0], [L2.x1, 0.7, L2.z1], 'furnitureLight', false));
      }
      const desk = up(B, fy);
      for (const b of desk) { b.propGroup = `${cell.id}/g-od-desk${i}`; ctx.addBox(b); }
      // 椅子（違い: 色・向き）
      const [cx, cz] = F.point(deskU + 0.62, deskV);
      const C: Box[] = [];
      chair(C, cx, cz, toward(isOdd && diff === 'chairTurned' ? 1 : -1), isOdd && diff === 'chairColor' ? 'seatRed' : 'seatBlue');
      up(C, fy);
      for (const b of C) { b.propGroup = `${cell.id}/g-od-chair${i}`; ctx.addBox(b); }
      // 電気スタンド（違い: そのブースだけ点いている）
      const Lm: Box[] = [];
      const [lx, lz] = F.point(deskU, deskV - 0.35);
      lamp(Lm, lx, lz, 0.73);
      up(Lm, fy);
      const lit = isOdd && diff === 'lamp';
      for (const b of Lm) { if (b.mat === 'lightWarm' && !lit) b.mat = 'lightOff'; b.propGroup = `${cell.id}/g-od-lamp${i}`; ctx.addBox(b); }
      if (lit) cell.lights.push({ pos: [lx, fy + 1.2, lz], color: 0xffc27a, intensity: 0.35, distance: 3 });
      // 額（左の仕切りの面。違い: 絵の色）
      const pv0 = deskV - 0.4, pv1 = deskV + 0.4;
      const fr = F.rect(u0 + 0.05, pv0, u0 + 0.08, pv1), pic = F.rect(u0 + 0.08, pv0 + 0.05, u0 + 0.09, pv1 - 0.05);
      const P = [box([fr.x0, fy + 1.3, fr.z0], [fr.x1, fy + 1.9, fr.z1], 'trim', false), box([pic.x0, fy + 1.35, pic.z0], [pic.x1, fy + 1.85, pic.z1], isOdd && diff === 'picture' ? 'skyDusk' : 'skyOvercast', false)];
      for (const b of P) { b.propGroup = `${cell.id}/g-od-pic${i}`; ctx.addBox(b); }
      // 鉢植え（前の左の隅）とごみ箱
      const Pl: Box[] = [];
      const [px, pz] = F.point(u0 + 0.4, D - 0.5);
      plant(Pl, px, pz, 0.4, 1.1);
      const [bx, bz] = F.point(deskU + 0.15, deskV + 0.75);
      bin(Pl, bx, bz, 'metalDark', 0.3, 0.45);
      up(Pl, fy);
      for (const b of Pl) { b.propGroup = `${cell.id}/g-od-plant${i}`; ctx.addBox(b); }
      // 違い: 机の上の赤い玉
      let extra: Box[] = [];
      if (isOdd && diff === 'extra') {
        const [ex, ez] = F.point(deskU, deskV + 0.25);
        extra = [box([ex - 0.09, fy + 0.73, ez - 0.09], [ex + 0.09, fy + 0.91, ez + 0.09], 'plasticRed', false)];
        for (const b of extra) { b.propGroup = `${cell.id}/g-od-extra`; ctx.addBox(b); }
      }
      if (isOdd) {
        const target = diff === 'chairColor' || diff === 'chairTurned' ? C : diff === 'lamp' ? Lm : diff === 'picture' ? P : extra;
        const bb = bbOf(target);
        const touchBox: AABB = { min: [bb.min[0] - 0.05, bb.min[1], bb.min[2] - 0.05], max: [bb.max[0] + 0.05, bb.max[1] + 0.05, bb.max[2] + 0.05] };
        // 隠しの扉の前は空ける（右半分の奥）。扉は右の仕切りに寄せ、椅子の右から仕切りまでの通り道（体の幅 + 余裕）が無いブースには付けない
        // （狭いブースで、椅子が扉の前を塞いで入れないことがあった）
        const chairRight = deskU + 0.62 + 0.25;
        const doorAt = Math.min(uc + w / 4, u1 - 0.62);
        ctx.addEntity('touch', { type: 'oddTouch', params: { box: aabbJson(touchBox), range: 2.6 } });
        if (u1 - 0.05 - chairRight >= 0.8) {
          const K = F.rect(chairRight, 0, u1 - 0.1, 1.4);
          ctx.keepOut({ min: [K.x0, fy, K.z0], max: [K.x1, fy + 2.2, K.z1] });
          ctx.offerSecret({
            hook: `oneDifferent.${diff}`, modes: ['present', 'appear'], weight: 1.2, revealOutput: `${ctx.id}.touch.touched`,
            doorway: { dir: d, at: doorAt, y: fy, width: 1.0, height: 2.0 }, tell: '1 つだけ違う家具',
          });
        }
      }
    }
    // ブースの帯には区画の中身を置かない
    const K = F.rect(F.u0, 0, F.u1, D + 0.4);
    ctx.keepOut({ min: [K.x0, fy - 0.1, K.z0], max: [K.x1, fy + h, K.z1] });
  },
});
