/**
 * 送風の通路（windTunnel）[QR M20]・人の流れ（変種 crowd）[M28]。
 *
 * wind: 細長い部屋の奥の壁（出口の側）に大きな送風機。風は奥から入口へ吹き、周期で突風になる（ダッシュより強い。予告に
 *   送風機がうなり、紙くずが舞い始める）。突風の間に開けた所にいると入口の方へ押し戻される（失敗の代償 = 位置を失う）。
 *   横の壁から張り出した仕切りの陰（風下の側）は風が来ない「風よけ」で、突風をやり過ごせる。止んでいる間に次の風よけまで走る。
 *   宙にいると風に強く飛ばされる（air）。
 *   隠し（出現型 wind.blown）: 突風の中でわざと跳び、飛ばされ続けると、入口近くの横の壁の通気口（扉）が開く。
 *   本来の案は「上の通気口」だが、隠し扉の大きさ（高さ 2.1 m）が天井に収まらないので、床の高さの通気口にした
 * crowd: 駅の通路のように、見えない群衆の流れが部屋を横切る（流れの帯ごとに周期で強まる・向きは交互）。押されて横へ流される。
 *   足音と床の影（描画）で流れが見える。歩く速さより弱いので、流されながらでも渡れる（走ると楽）
 */
import type { GimmickContext } from '../types.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, fillRects } from '../util.ts';
import { hallAabb, hallBox, hallDir, hallOf, hallPoint, sideDir, wallAt, type Hall } from './common.ts';

defineGimmick({
  id: 'windTunnel', name: '送風の通路', axes: ['move'], kinds: ['room', 'hall', 'corridor'], minSize: [2.0, 7.0], weight: 0.9, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4,
  build(ctx) {
    const H = hallOf(ctx.slot);
    if (!H || H.L < 7) return;
    const crowd = H.W >= 3.0 && ctx.slot.kind !== 'corridor' && ctx.rng.chance(ctx.tuning['move.crowd.chance']);
    if (crowd) buildCrowd(ctx, H); else buildWind(ctx, H);
  },
});

function buildWind(ctx: GimmickContext, H: Hall): void {
  const s = ctx.slot;
  const t = ctx.tuning;
  const land0 = t['move.wind.landingM'], land1 = 1.3;
  const v1 = H.L - land1;
  // 仕切りの長さ: 互い違いの仕切りの間をまっすぐ通れる幅（0.9 m）を残す（細い通路では仕切りが短い）
  const finLen = Math.min(1.1, Math.max(0.55, H.W * 0.3), (H.W - 0.9) / 2);
  if (finLen < 0.5) return;
  // 横の開口（広間の 3 つ目の出入り口）の前には仕切りを置かない
  const sideOps = s.openings.filter((o) => o !== s.entrance && o !== s.exit).map((o) => ({ dir: o.dir, v: H.F.v(o.pos[0], o.pos[2]) }));
  const fins: { v: number; hi: boolean }[] = [];
  let hi = ctx.rng.chance(0.5);
  for (let v = land0 + 1.3; v + 0.15 <= v1 - 0.9; v += t['move.wind.pitchM'] * ctx.rng.float(0.9, 1.1)) {
    const dir = sideDir(H, hi);
    if (!sideOps.some((o) => o.dir === dir && Math.abs(o.v - v) < 1.6)) fins.push({ v, hi });
    hi = !hi;
  }
  if (!fins.length) return;
  const u0 = H.F.u0, u1 = H.F.u1;
  // 風よけ: 仕切りの風下（入口の側）。仕切りは床から天井まで
  const pockets = fins.map((f) => ({ a: f.hi ? u1 - finLen : u0, b: f.hi ? u1 : u0 + finLen, v0: f.v - 1.15, v1: f.v + 0.15 }));
  fins.forEach((f, i) => {
    const p = pockets[i]!;
    ctx.addBox(hallBox(H, p.a, f.v, p.b, f.v + 0.15, 0, H.h, s.cell.palette.wall));
    // 仕切りの先の吹き流しの付け根（風の強さが見える。なびく布は flowZone の描画）
    const tip = f.hi ? p.a : p.b;
    ctx.addBox(hallBox(H, tip - 0.03, f.v + 0.04, tip + 0.03, f.v + 0.11, 1.55, 1.95, 'plasticRed', false));
  });
  // 風: 風の範囲から仕切りと風よけを除いた所。突風と弱い風の周期は全部の帯で同じ
  const holes = pockets.map((p) => H.F.rect(p.a, p.v0, p.b, p.v1));
  const rects = fillRects(H.F.rect(u0, land0, u1, v1), holes);
  const toward = hallDir(H, 0, -1);
  const phase = ctx.rng.float(0, t['move.wind.period']);
  // 送風機（出口の扉の両側の壁）: 枠。描画は回る羽根
  const fans: number[][] = [];
  const exitU = H.exitU ?? (u0 + u1) / 2;
  const rad = Math.min(0.6, H.W / 6, (H.h - 0.5) / 2);
  const fanY = Math.min(H.h - rad - 0.2, 1.5);
  for (const side of [-1, 1]) {
    const cu = exitU + side * (0.5 + rad + 0.25);
    if (cu - rad < u0 + 0.05 || cu + rad > u1 - 0.05) continue;
    ctx.addBox(hallBox(H, cu - rad - 0.05, H.L - 0.12, cu + rad + 0.05, H.L, fanY - rad - 0.05, fanY + rad + 0.05, 'metalDark', true));
    const c = hallPoint(H, cu, H.L - 0.16, fanY);
    fans.push([c[0], c[1], c[2], rad, toward[0], toward[2]]);
  }
  const gust = `${ctx.id}.gust0`;
  rects.forEach((r, i) => {
    ctx.addEntity(`gust${i}`, {
      type: 'flowZone', params: {
        aabb: aabbJson({ min: [r.x0, H.y - 0.1, r.z0], max: [r.x1, H.y + H.h, r.z1] }), vector: toward,
        speed: t['move.wind.gust'], base: t['move.wind.breeze'], period: t['move.wind.period'], duty: t['move.wind.duty'], warn: t['move.wind.warn'], phase,
        air: t['move.wind.air'], visual: 'wind', cue: i === 0, ...(i === 0 ? { fans } : {}),
      },
    });
  });
  // 隠し（出現型）: 突風の中で宙にいる（わざと跳んで飛ばされる）と、入口近くの横の壁の通気口が開く
  // （飛ばされて入口の前まで来ても数える）
  const blown = ctx.addEntity('blown', { type: 'stateSensor', params: { aabb: aabbJson(hallAabb(H, u0, 0, u1, v1, -0.1, H.h)), when: ['air'], sec: t['move.wind.blownSec'] }, inputs: { enable: `${gust}.on` } });
  for (const hiSide of ctx.rng.shuffle([true, false])) {
    const dir = sideDir(H, hiSide);
    const v = 0.95;
    if (s.openings.some((o) => o.dir === dir && Math.abs(H.F.v(o.pos[0], o.pos[2]) - v) < 1.6)) continue;
    if (Math.abs(H.entU - (hiSide ? u1 : u0)) < 1.3) continue;
    ctx.offerSecret({ hook: 'wind.blown', modes: ['appear'], weight: 1.0, revealOutput: `${blown}.done`, doorway: { dir, at: wallAt(H, dir, hiSide ? u1 : u0, v), y: H.y, width: 1.0, height: 2.0 }, tell: '突風のたびに入口近くの通気口の格子が鳴る' });
    break;
  }
  ctx.keepOut(hallAabb(H, u0, land0 - 0.2, u1, H.L, -0.1, H.h));
}

function buildCrowd(ctx: GimmickContext, H: Hall): void {
  const t = ctx.tuning;
  const laneW = t['move.crowd.laneM'];
  const land0 = 1.5, land1 = 1.4;
  const lanes: number[] = [];
  for (let v = land0 + 0.2; v + laneW <= H.L - land1; v += laneW + ctx.rng.float(0.5, 0.9)) lanes.push(v);
  if (lanes.length < 2) return;
  let dir = ctx.rng.chance(0.5) ? 1 : -1;
  const period = t['move.crowd.period'];
  lanes.forEach((v, i) => {
    ctx.addEntity(`lane${i}`, {
      type: 'flowZone', params: {
        aabb: aabbJson(hallAabb(H, H.F.u0, v, H.F.u1, v + laneW, -0.1, 2.0)), vector: hallDir(H, dir, 0),
        speed: t['move.crowd.speed'], base: 0, period, duty: t['move.crowd.duty'], warn: 0.6, phase: ctx.rng.float(0, period),
        visual: 'crowd', cue: true,
      },
    });
    // 流れの帯の縁の目印（駅の床の黄色い線）
    ctx.addBox(hallBox(H, H.F.u0, v - 0.04, H.F.u1, v, 0, 0.004, 'yellowLine', false));
    dir = -dir;
  });
}
