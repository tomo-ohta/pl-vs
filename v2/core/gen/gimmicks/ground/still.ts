/**
 * 立ち止まると見える道・2 本目（stillPaths）[WS G08 の発展・BG04]: 部屋を横切る深い溝。手前の縁の光の四角で止まっていると、
 * 見えない橋が溝に現れる（ground.still.firstSec）。さらに長く止まっていると（ground.still.secondSec）、2 本目の橋が仕切りの向こうの小部屋へ現れる。
 * - 本道に置ける（入口と出口が向かい合う部屋）。出口の側から来た人のために、向こう岸の縁にも光の四角（1 本目の橋が現れる）
 * - 溝の上は下がり天井（走って跳んでも越えられない）。落ちたら溝の階段で手前へ
 * - 隠し（still.longer）: 小部屋の横の壁の扉（存在型 = 最初からある / 出現型 = 2 本目の橋と一緒に現れる）。
 *   行き止まりの部屋では、1 本目の橋の先の奥の壁にも扉（still.across）
 * （既存の appearPath は行き止まりの部屋に置く 1 本だけの道。こちらは本道にも置け、2 本目の道で隠しへ行ける）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, DOOR_W, type Box, type Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson } from '../util.ts';
import { botHint, buildTrench, enterAt, entranceFrame, onRectWall, planTrench, soffit } from './common.ts';

const sideDir = (d: Dir, side: -1 | 1): Dir => (d % 2 === 0 ? (side < 0 ? 3 : 1) : (side < 0 ? 2 : 0));

defineGimmick({
  id: 'stillPaths', name: '立ち止まると見える道', axes: ['time', 'sight'], kinds: ['room', 'hall'], minSize: [5.0, 6.0], minHeight: 2.4, weight: 0.7, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && (s.openings.length === 1 || (!!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4)),
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const ent = s.entrance!;
    const ex = s.openings.length === 1 ? null : s.exit!;
    if (!s.openings.every((o) => onRectWall(s, o))) return;
    const F = entranceFrame(s);
    const W = t['ground.still.trenchM'];
    const vt0 = 2.6, vt1 = vt0 + W;
    if (F.depth - vt1 < (ex ? 1.6 : 1.3)) return;
    for (const o of s.openings) if (o !== ent && o !== ex && F.v(o.pos[0], o.pos[2]) > vt0 - 1.4) return;
    const ue = ex ? F.u(ex.pos[0], ex.pos[2]) : F.u0 + (F.u1 - F.u0) * (ctx.rng.chance(0.5) ? 0.7 : 0.3);
    const ew = ex ? ex.width : 1.0;
    // 向こう岸の小部屋（出口から遠い側）
    const roomMinus = ue - ew / 2 - 0.45 - F.u0, roomPlus = F.u1 - (ue + ew / 2 + 0.45);
    const aSide: -1 | 1 = roomMinus >= roomPlus ? -1 : 1;
    const aRoom = aSide < 0 ? roomMinus : roomPlus;
    const hasAlcove = aRoom >= 1.6 + 1.5 && F.depth - vt1 >= 1.9;
    const uPart = hasAlcove ? (aSide < 0 ? F.u0 + Math.min(aRoom - 1.6, 2.4) : F.u1 - Math.min(aRoom - 1.6, 2.4)) : NaN;
    const exLo = hasAlcove && aSide < 0 ? uPart + 0.1 : F.u0, exHi = hasAlcove && aSide > 0 ? uPart - 0.1 : F.u1;
    const u1 = Math.min(Math.max(ue, exLo + 0.8), exHi - 0.8);
    const u2 = hasAlcove ? (aSide < 0 ? (F.u0 + uPart) / 2 : (uPart + F.u1) / 2) : NaN;
    // 溝の階段は、橋から遠い方の端
    const farUs = [u1, ...(hasAlcove ? [u2] : [])];
    const sideScore = (sd: -1 | 1): number => Math.min(...farUs.map((u) => Math.abs(u - (sd < 0 ? F.u0 : F.u1))));
    const stairSide: -1 | 1 = sideScore(-1) >= sideScore(1) ? -1 : 1;
    const plan = planTrench(ctx, { v0: vt0, v1: vt1, depth: t['ground.still.depthM'], stairSide });
    if (!plan) return;
    // 橋は床の高さ、階段は溝の中（橋の下を通る）なので、重なってよい
    buildTrench(ctx, plan);
    soffit(ctx, F.rect(F.u0, vt0 - 0.8, F.u1, vt1 + 0.8), t['ground.still.soffitM']);
    if (hasAlcove) {
      const pr = F.rect(uPart - 0.075, vt1, uPart + 0.075, F.depth);
      ctx.addBox(box([pr.x0, y, pr.z0], [pr.x1, y + s.cell.height, pr.z1], s.cell.palette.wall));
    }
    // 見えない橋（出現型の箱）
    const bridge = (u: number, group: string): void => {
      const r = F.rect(u - 0.5, vt0 - 0.02, u + 0.5, vt1 + 0.02);
      const b: Box = box([r.x0, y - 0.1, r.z0], [r.x1, y, r.z1], 'glass');
      b.revealGroup = group;
      ctx.addBox(b);
    };
    const g1 = `${ctx.id}.bridge1`, g2 = `${ctx.id}.bridge2`;
    bridge(u1, g1);
    if (hasAlcove) bridge(u2, g2);
    // 光の四角: 1 本目の橋の手前（縁から 1.0 m）。出口のある部屋は向こう岸にも
    const pad = (u: number, v: number, name: string, sec: number): string => {
      const p = F.point(u, v);
      const b = box([p[0] - 0.5, y, p[1] - 0.5], [p[0] + 0.5, y + 0.012, p[1] + 0.5], 'screenGlow', false);
      b.kind = 'pad';
      ctx.addBox(b);
      return ctx.addEntity(name, { type: 'dwellSensor', params: { aabb: aabbJson({ min: [p[0] - 0.5, y - 0.1, p[1] - 0.5], max: [p[0] + 0.5, y + 1.5, p[1] + 0.5] }), sec, still: true } });
    };
    const vPad = vt0 - 1.0;
    const d1 = pad(u1, vPad, 'pad', t['ground.still.firstSec']);
    // 2 本目: 同じ四角でさらに長く（止まっている間だけ数える。動いたら最初から）
    const d2 = hasAlcove ? ctx.addEntity('padLong', { type: 'dwellSensor', params: { aabb: aabbJson((() => { const p = F.point(u1, vPad); return { min: [p[0] - 0.5, y - 0.1, p[1] - 0.5], max: [p[0] + 0.5, y + 1.5, p[1] + 0.5] }; })()), sec: t['ground.still.secondSec'], still: true } }) : null;
    const showFrom: string[] = [`${d1}.done`];
    let d3: string | null = null;
    if (ex) { d3 = pad(u1, vt1 + 1.0, 'padFar', t['ground.still.firstSec']); showFrom.push(`${d3}.done`); }
    const mid = F.point(u1, (vt0 + vt1) / 2);
    const r1 = ctx.addEntity('reveal1', { type: 'reveal', params: { group: g1, pos: [mid[0], y, mid[1]], style: 'fadeIn' }, inputs: { show: { from: showFrom } } });
    let r2: string | null = null;
    if (d2) { const m2 = F.point(u2, (vt0 + vt1) / 2); r2 = ctx.addEntity('reveal2', { type: 'reveal', params: { group: g2, pos: [m2[0], y, m2[1]], style: 'fadeIn' }, inputs: { show: `${d2}.done` } }); }
    // 歩く人: 四角の上で、橋が現れるまで止まって待つ
    const pp = F.point(u1, vPad), pf = F.point(u1, vt1 + 1.0);
    const hints: Json[] = [botHint([{ at: [pp[0], y, pp[1]], wait: 0.3, until: `${r1}.shown` }], { enterAt: enterAt(ent), doneIf: `${r1}.shown` })];
    if (r2) hints.push(botHint([{ at: [pp[0], y, pp[1]], wait: 0.3, until: `${r2}.shown` }], { only: 'secret', doneIf: `${r2}.shown` }));
    if (ex) hints.push(botHint([{ at: [pf[0], y, pf[1]], wait: 0.3, until: `${r1}.shown` }], { enterAt: enterAt(ex), doneIf: `${r1}.shown` }));
    ctx.addEntity('hints', { type: 'constant', params: { value: 0, bot: hints } });
    // 隠し
    if (hasAlcove && r2) {
      const sd = sideDir(F.d, aSide);
      const vm = (vt1 + 0.1 + F.depth) / 2;
      const p = F.point(aSide < 0 ? F.u0 : F.u1, vm);
      const at = sd === 1 || sd === 3 ? p[1] : p[0];
      const clash = s.openings.some((o) => o.dir === sd && Math.abs((sd % 2 === 0 ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + DOOR_W / 2 + 0.6);
      if (!clash && F.depth - vt1 - 0.1 >= DOOR_W + 0.7) ctx.offerSecret({ hook: 'still.longer', modes: ['present', 'appear'], weight: 1.2, revealOutput: `${r2}.shown`, doorway: { dir: sd, at, y, width: 1.0, height: 2.0 }, tell: '光の四角の上で長く待つと、溝の向こうの小部屋の床がかすかに光る' });
    }
    if (!ex) {
      const fd = ((F.d + 2) % 4) as Dir;
      const p = F.point(u1, F.depth);
      ctx.offerSecret({ hook: 'still.across', modes: ['present', 'appear'], weight: 0.9, revealOutput: `${r1}.shown`, doorway: { dir: fd, at: fd % 2 === 0 ? p[0] : p[1], y, width: 1.0, height: 2.0 }, tell: '溝の向こうの壁の継ぎ目' });
    }
    const keep = F.rect(F.u0, vPad - 0.8, F.u1, F.depth);
    ctx.keepOut({ min: [keep.x0, y - 3, keep.z0], max: [keep.x1, y + 3, keep.z1] });
  },
});
