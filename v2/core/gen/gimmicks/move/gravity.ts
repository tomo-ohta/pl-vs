/**
 * 重力の向きが変わる部屋（gravityHall）。プレイヤーの重力の向きは 90° ずつ（player.ts の grav）。
 *
 * - loop 重力の回廊 [W01・M08]・磁力の靴 [M33]: 部屋を横切る金属の帯が、床 → 横の壁 → 天井 → 反対の壁 → 床とひと回りしている。
 *     帯の上だけ磁力の靴が効き、壁へ向かって押し続けると壁が床になる（magnet ゾーン）。歩いて天井を渡り、反対の壁を下りて床へ戻る。
 *     隠し grav.ceiling [BM05]（存在型 / 出現型）: 天井の帯から横の壁の上の方へ延びる枝の先に、天井近くの横道の扉
 *     （床からは届かない高さ。出現型は天井をしばらく歩くと開く）
 * - maze 重力の迷路 [W02]: 床は腰より高い仕切りの迷路（歩いて抜けられる）。入口の近くの壁の帯から天井へ上がれば、天井全体が
 *     磁力の面で、迷路の上をまっすぐ渡って出口の近くの壁の帯から下りられる（上にも下にも道がある）
 * - tube 筒の通路 [M26]: 部屋の真ん中を通る四角い筒。筒の中は区切りごとに重力が 90° ずつ回り（twist ゾーン）、歩いているうちに
 *     壁 → 天井 → 反対の壁 → 床と立つ面が変わる。どの面も同じ見た目（照明も四面）で、窓の外の部屋だけが傾いて見える
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Box, Zone } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson } from '../util.ts';
import { hallAabb, hallBox, hallOf, hallPoint, removeLightsIn, sideDir, wallAt, type Hall } from './common.ts';

type Variant = 'loop' | 'maze' | 'tube';
const opposite = (s: { entrance: { dir: number } | null; exit: { dir: number } | null }): boolean => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4;

/** 部屋の座標の向き（横 = u が増える向き）を世界の向きへ */
const sideVec = (H: Hall, sg: number): Vec3 => [H.side[0] * sg, 0, H.side[2] * sg];
const fwdAxis = (H: Hall): 'x' | 'z' => (Math.abs(H.fwd[0]) > 0.5 ? 'x' : 'z');

/** 磁力の面のゾーン（面から 1 m の厚み）と、面に貼った金属の帯（見た目） */
function magnet(ctx: GimmickContext, H: Hall, face: 'lo' | 'hi' | 'ceil' | 'floor', v0: number, v1: number, u0 = H.F.u0, u1 = H.F.u1): void {
  const axis = fwdAxis(H);
  let z: Zone;
  let strip: Box;
  if (face === 'lo') {
    z = { kind: 'magnet', aabb: hallAabb(H, H.F.u0, v0, H.F.u0 + 1, v1, 0, H.h), vector: sideVec(H, 1), params: { axis } };
    strip = hallBox(H, H.F.u0, v0, H.F.u0 + 0.008, v1, 0.02, H.h - 0.02, 'stainless', false);
  } else if (face === 'hi') {
    z = { kind: 'magnet', aabb: hallAabb(H, H.F.u1 - 1, v0, H.F.u1, v1, 0, H.h), vector: sideVec(H, -1), params: { axis } };
    strip = hallBox(H, H.F.u1 - 0.008, v0, H.F.u1, v1, 0.02, H.h - 0.02, 'stainless', false);
  } else if (face === 'ceil') {
    z = { kind: 'magnet', aabb: hallAabb(H, u0, v0, u1, v1, H.h - 1, H.h), vector: [0, -1, 0], params: { axis } };
    strip = hallBox(H, u0, v0, u1, v1, H.h - 0.008, H.h, 'stainless', false);
  } else {
    z = { kind: 'magnet', aabb: hallAabb(H, u0, v0, u1, v1, 0, 1), vector: [0, 1, 0], params: { axis } };
    strip = hallBox(H, u0, v0, u1, v1, 0, 0.006, 'stainless', false);
  }
  ctx.addZone(z);
  strip.kind = 'magnetStrip';
  ctx.addBox(strip);
}

defineGimmick({
  id: 'gravityHall', name: '重力の向きが変わる部屋', axes: ['move', 'body'], kinds: ['room', 'hall'], minSize: [3.2, 7.0], minHeight: 2.7, weight: 0.6, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const H = hallOf(s, false);
    if (!H) return;
    const ok: Variant[] = [];
    const exU = H.exitU ?? H.entU;
    if (H.h >= 3.0 && H.W >= 3.6) ok.push('loop');
    // 迷路・筒は入口と出口が向かい合う部屋だけ（回廊の帯は、出口がどこでも通り道を塞がない）
    if (opposite(s) && H.h >= t['move.grav.mazeMinH'] && H.W >= 4.2 && H.L >= 9) ok.push('maze');
    if (opposite(s) && Math.abs(H.entU - exU) < 0.45 && H.W >= 3.2 && H.L >= 7.5) ok.push('tube');
    if (!ok.length) return;
    const v = ctx.rng.weighted(ok, (k) => t[`move.grav.w.${k}`] + 1e-6);
    const sideOpen = (hi: boolean, v0: number, v1: number): boolean => s.openings.some((o) => o.dir === sideDir(H, hi) && (() => { const ov = H.F.v(o.pos[0], o.pos[2]); return ov > v0 - o.width / 2 - 0.4 && ov < v1 + o.width / 2 + 0.4; })());
    if (v === 'loop') buildLoop(ctx, H, sideOpen);
    else if (v === 'maze') buildMaze(ctx, H, sideOpen);
    else buildTube(ctx, H, sideOpen);
  },
});

function buildLoop(ctx: GimmickContext, H: Hall, sideOpen: (hi: boolean, v0: number, v1: number) => boolean): void {
  const t = ctx.tuning;
  const BW = 1.6;
  const vb = H.L / 2;
  const v0 = vb - BW / 2, v1 = vb + BW / 2;
  if (sideOpen(false, v0, v1 + 2.4) || sideOpen(true, v0, v1 + 2.4)) return;
  magnet(ctx, H, 'floor', v0, v1);
  magnet(ctx, H, 'lo', v0, v1);
  magnet(ctx, H, 'ceil', v0, v1);
  magnet(ctx, H, 'hi', v0, v1);
  // 帯の上の矢印（床から壁へ）
  const arrow = ctx.addBox(hallBox(H, H.F.u0 + 0.6, vb - 0.06, H.F.u0 + 1.2, vb + 0.06, 0.007, 0.01, 'paintWhite', false));
  arrow.kind = 'magnetArrow';
  // 隠し: 天井の帯から横の壁の上の方へ延びる枝の先の横道（天井の近く。床からは届かない）
  const hiSide = ctx.rng.chance(0.5);
  const dir: Dir = sideDir(H, hiSide);
  const dv = v1 + 1.0;
  const doorY = H.h - 2.1;
  if (doorY >= 1.2 && dv + 0.8 < H.L - 1.0) {
    magnet(ctx, H, 'ceil', v1, dv + 0.6, hiSide ? H.F.u1 - 1.2 : H.F.u0, hiSide ? H.F.u1 : H.F.u0 + 1.2);
    const wallU = hiSide ? H.F.u1 : H.F.u0;
    const sensor = ctx.addEntity('ceiling', { type: 'stateSensor', params: { aabb: aabbJson(hallAabb(H, H.F.u0, v0, H.F.u1, v1, H.h - 1.2, H.h + 0.3)), when: ['gravUp:0,-1,0'], sec: t['move.grav.ceilingSec'] } });
    ctx.offerSecret({ hook: 'grav.ceiling', modes: ['present', 'appear'], weight: 1.0, revealOutput: `${sensor}.done`, doorway: { dir, at: wallAt(H, dir, wallU, dv), y: H.y + doorY, width: 1.0, height: 2.0 }, floorY: H.y + doorY, tell: '天井の帯の枝が、壁の上の方の暗い所へ延びている' });
  }
  ctx.keepOut(hallAabb(H, H.F.u0, v0 - 0.8, H.F.u1, v1 + 2.2, -0.1, H.h));
}

function buildMaze(ctx: GimmickContext, H: Hall, sideOpen: (hi: boolean, v0: number, v1: number) => boolean): void {
  const s = ctx.slot;
  const land = 1.4;
  const m0 = land + 1.9, m1 = H.L - land - 1.9;
  if (sideOpen(false, land, H.L - land) || sideOpen(true, land, H.L - land)) return;
  // 床の迷路: 腰より高い仕切りを横に並べ、通り口を左右交互に
  const BH = 1.4, gap = 1.1;
  const n = Math.max(2, Math.floor((m1 - m0) / 1.8) + 1);
  let left = ctx.rng.chance(0.5);
  for (let i = 0; i < n; i++) {
    const v = m0 + ((m1 - m0) * i) / Math.max(1, n - 1);
    const a = left ? H.F.u0 + gap : H.F.u0, b = left ? H.F.u1 : H.F.u1 - gap;
    const p = ctx.addBox(hallBox(H, a, v - 0.1, b, v + 0.1, 0, BH, s.cell.palette.wall));
    p.kind = 'mazeWall';
    left = !left;
  }
  // 壁の帯（入口の近く: 入口の床の横の壁 / 出口の近く: 反対の壁）と、天井一面の磁力の面
  const entHi = ctx.rng.chance(0.5);
  magnet(ctx, H, entHi ? 'hi' : 'lo', land, land + 1.2);
  magnet(ctx, H, 'ceil', land, H.L - land);
  magnet(ctx, H, entHi ? 'lo' : 'hi', H.L - land - 1.2, H.L - land);
  magnet(ctx, H, 'floor', H.L - land - 1.2, H.L - land);
  magnet(ctx, H, 'floor', land, land + 1.2);
  ctx.keepOut(hallAabb(H, H.F.u0, land - 0.2, H.F.u1, H.L - land + 0.2, -0.1, H.h));
}

function buildTube(ctx: GimmickContext, H: Hall, sideOpen: (hi: boolean, v0: number, v1: number) => boolean): void {
  const s = ctx.slot, t = ctx.tuning;
  const half = 1.2, th = 0.12;
  const cu = Math.min(H.F.u1 - half - th, Math.max(H.F.u0 + half + th, (H.entU + (H.exitU ?? H.entU)) / 2));
  const t0 = 1.4, t1 = H.L - 1.4;
  if (t1 - t0 < 4.8 || H.h < 2 * half + th + 0.1) return;
  if (sideOpen(false, t0, t1) || sideOpen(true, t0, t1)) return;
  // 筒の壁: 横の 2 枚と天井。所々にガラスの窓（当たる）
  const mat = 'wallWhite';
  const win = (va: number, vb: number): boolean => Math.floor(((va + vb) / 2 - t0) / 1.2) % 2 === 1;
  for (let va = t0; va < t1 - 1e-6; va += 0.6) {
    const vb = Math.min(t1, va + 0.6);
    for (const side of [-1, 1]) {
      const ua = side < 0 ? cu - half - th : cu + half, ub = side < 0 ? cu - half : cu + half + th;
      if (win(va, vb)) {
        ctx.addBox(hallBox(H, ua, va, ub, vb, 0, 0.9, mat));
        ctx.addBox(hallBox(H, ua, va, ub, vb, 0.9, 1.5, 'glass'));
        ctx.addBox(hallBox(H, ua, va, ub, vb, 1.5, 2 * half, mat));
      } else ctx.addBox(hallBox(H, ua, va, ub, vb, 0, 2 * half, mat));
    }
    ctx.addBox(hallBox(H, cu - half - th, va, cu + half + th, vb, 2 * half, 2 * half + th, mat));
  }
  // 区切り: 入口の側 0 → 1 → 2 → 3 → 0（出口の側）。真ん中の線は筒の中心
  const axis = fwdAxis(H);
  const cpt = hallPoint(H, cu, 0, half);
  const lat = axis === 'z' ? cpt[0] : cpt[2];
  const dirSign = ctx.rng.chance(0.5) ? 1 : -1;
  const end = 0.9;
  const cuts = [t0, t0 + end, ...[1, 2].map((i) => t0 + end + ((t1 - t0 - 2 * end) * i) / 3), t1 - end, t1];
  for (let i = 0; i < cuts.length - 1; i++) {
    const k = i === 0 || i === cuts.length - 2 ? 0 : ((i * dirSign) % 4 + 4) % 4;
    ctx.addZone({ kind: 'twist', aabb: hallAabb(H, cu - half, cuts[i]!, cu + half, cuts[i + 1]!, 0, 2 * half), params: { k, axis, center: [lat, H.y + half] } });
  }
  // 筒の中の照明: 四面の真ん中に同じ灯りの帯（どの面に立っても同じに見える）
  removeLightsIn(ctx, (x, z) => { const vv = H.F.v(x, z); return vv > t0 - 0.2 && vv < t1 + 0.2; });
  for (let vv = t0 + 0.6; vv < t1 - 0.3; vv += 1.2) {
    const L: Box[] = [
      hallBox(H, cu - 0.12, vv - 0.3, cu + 0.12, vv + 0.3, 2 * half - 0.02, 2 * half, 'lightPanel', false),
      hallBox(H, cu - 0.12, vv - 0.3, cu + 0.12, vv + 0.3, 0, 0.004, 'lightPanel', false),
      hallBox(H, cu - half, vv - 0.3, cu - half + 0.02, vv + 0.3, half - 0.12, half + 0.12, 'lightPanel', false),
      hallBox(H, cu + half - 0.02, vv - 0.3, cu + half, vv + 0.3, half - 0.12, half + 0.12, 'lightPanel', false),
    ];
    for (const b of L) { b.kind = 'tubeLight'; ctx.addBox(b); }
    const c = hallPoint(H, cu, vv, half);
    s.cell.lights.push({ pos: c, color: s.cell.palette.lightColor, intensity: s.cell.palette.lightIntensity * 0.7, distance: 3.2 });
  }
  void t;
  ctx.keepOut(hallAabb(H, H.F.u0, t0 - 0.3, H.F.u1, t1 + 0.3, -0.1, H.h));
}
