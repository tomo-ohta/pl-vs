/**
 * 機械（エレベーター D04・BX06 / 自販機 D05・BX07）。
 *
 * - liftCabin エレベーター: 部屋がエレベーターホールになり、壁際にかご（仕切りの中。ステンレスの内張り・手すり・階の表示・引き戸）。
 *   外の ▼ を押すと、しばらくでかごが来て戸が開く。中の階のボタンを押すと戸が閉まって動き出し、表示の数字が流れて「押していない階」に
 *   止まる（1 つ下の表のフロア。1 つ下を押すと 1 つ下の裏のフロア）。盤には存在しない階のボタンが 3 つあり、横に引っかき傷（1〜3 本）。
 *   傷の数の順に押すと、かごの奥の壁が開く（lift.ghost・出現型）。乗っている人がいなければ動かない（人がいれば戸は開いている）
 * - vendingRoom 自販機: 壁際の自販機（光る正面・3 色のボタン・取り出し口）。押すと缶が落ちてきて、部屋の照明がその缶の色に変わる
 *   （出てくる物で部屋が変わる）。同じボタンを 5 回続けて押すと、缶の代わりに鍵が落ちてくる。取り出し口を調べて鍵を取ると、
 *   自販機の横の壁の点検口が開く（vend.key・出現型）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Json } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, freeWallSpan, hitsDoorZones, innerRect, wallFrame, type WallFrame } from '../util.ts';
import { botHint, linkRoomLights, snap } from './common.ts';

/** 壁（座標系 F の v = 0 の壁）に付いた押しボタン（中心 u・高さ h。壁から 0.03 m 出る） */
function wallButton(ctx: GimmickContext, F: WallFrame, name: string, u: number, h: number, o: { size?: number; mat?: string; glow?: number; label?: string; range?: number; litSec?: number } = {}): { id: string; center: [number, number, number]; stand: (dist: number) => [number, number, number] } {
  const y = ctx.slot.cell.floorY;
  const half = (o.size ?? 0.07) / 2;
  const r = F.rect(u - half, 0, u + half, 0.03);
  const id = ctx.addEntity(name, { type: 'pushButton', params: { box: aabbJson({ min: [r.x0, y + h - half, r.z0], max: [r.x1, y + h + half, r.z1] }), mat: o.mat ?? 'stainless', glow: o.glow ?? 0xffd890, range: o.range ?? 2.2, litSec: o.litSec ?? 0.6, ...(o.label ? { label: o.label } : {}) } });
  const c = F.point(u, 0.02);
  return { id, center: [c[0], y + h, c[1]], stand: (dist) => { const p = F.point(u, dist); return [p[0], y, p[1]]; } };
}

const FAKES = ['B0', '13', 'R2', 'B44', 'M3', '0', 'B∞'];

defineGimmick({
  id: 'liftCabin', name: 'エレベーター', axes: ['puzzle', 'sound'], kinds: ['room', 'hall'], minSize: [4.0, 4.6], minHeight: 2.4, weight: 0.3, intensity: 1, offersSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY, H = s.cell.height;
    // かご（幅 2.1・奥行き 1.95）を置く壁: 開口の無い区間（入口の壁は避ける）。かごの前に 2 m 以上の床
    const dirs = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).sort((a, b) => Number(a === s.entrance?.dir) - Number(b === s.entrance?.dir));
    let pick: { d: Dir; at: number; F: WallFrame } | null = null;
    for (const d of dirs) {
      const span = freeWallSpan(s, d, 2.5, 0.9);
      if (!span) continue;
      const F = wallFrame(innerRect(s), d);
      if (F.depth < 4.0) continue;
      const at = snap(span.at);
      if (hitsDoorZones(s, F.rect(at - 1.2, 0, at + 1.2, 3.3), 1.4)) continue;
      pick = { d, at, F };
      break;
    }
    if (!pick) return;
    const { d, at, F } = pick;
    const T = 0.12, IN = 1.83, FR = IN + T, half = 1.05;
    // 仕切り: 横の壁 2 枚・前の壁（扉の所を空ける）。天井まで
    const wall = s.cell.palette.wall;
    for (const [u0, u1, v0, v1] of [[at - half, at - half + T, 0, FR], [at + half - T, at + half, 0, FR], [at - half + T, at - 0.46, IN, FR], [at + 0.46, at + half - T, IN, FR]] as const) {
      const r = F.rect(u0, v0, u1, v1);
      ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + H, r.z1], wall));
    }
    { const r = F.rect(at - 0.46, IN, at + 0.46, FR); ctx.addBox(box([r.x0, y + 2.15, r.z0], [r.x1, y + H, r.z1], wall)); }
    // 天井の照明はかごの上を外し、点光源はかごの前へ
    const cab = F.rect(at - half, 0, at + half, FR);
    ctx.removeBoxes((b) => !b.solid && b.min[1] > y + H - 0.3 && b.max[0] > cab.x0 && b.min[0] < cab.x1 && b.max[2] > cab.z0 && b.min[2] < cab.z1);
    for (const l of s.cell.lights) {
      if (l.pos[0] < cab.x0 - 0.2 || l.pos[0] > cab.x1 + 0.2 || l.pos[2] < cab.z0 - 0.2 || l.pos[2] > cab.z1 + 0.2) continue;
      const p = F.point(F.u(l.pos[0], l.pos[2]), FR + 0.8);
      l.pos = [p[0], l.pos[1], p[1]];
    }
    // かごの中: ステンレスの内張り（奥の壁の真ん中は空ける）・手すり・床・灯り
    const inner = F.rect(at - half + T, 0, at + half - T, IN);
    const iu0 = at - half + T, iu1 = at + half - T;
    const lining = (u0: number, v0: number, u1: number, v1: number): void => { const r = F.rect(u0, v0, u1, v1); ctx.addBox(box([r.x0, y + 0.06, r.z0], [r.x1, y + Math.min(H, 2.6) - 0.02, r.z1], 'stainless', false)); };
    lining(iu0, 0, at - 0.55, 0.01); lining(at + 0.55, 0, iu1, 0.01);
    lining(iu0, 0, iu0 + 0.01, IN); lining(iu1 - 0.01, 0, iu1, IN);
    for (const [u0, u1, v0, v1] of [[iu0 + 0.01, iu0 + 0.06, 0.25, IN - 0.25], [iu1 - 0.06, iu1 - 0.01, 0.25, IN - 0.25]] as const) { const r = F.rect(u0, v0, u1, v1); ctx.addBox(box([r.x0, y + 0.88, r.z0], [r.x1, y + 0.93, r.z1], 'handrailWood', false)); }
    ctx.addBox(box([inner.x0, y, inner.z0], [inner.x1, y + 0.004, inner.z1], 'carpetPattern', false));
    { const r = F.rect(at - 0.5, 0.6, at + 0.5, 1.2); ctx.addBox(box([r.x0, y + Math.min(H, 2.6) - 0.03, r.z0], [r.x1, y + Math.min(H, 2.6), r.z1], 'lightPanel', false)); }
    if (H > 2.65) { const r = F.rect(iu0, 0, iu1, IN); ctx.addBox(box([r.x0, y + 2.6, r.z0], [r.x1, y + 2.68, r.z1], 'metalDark')); }
    const cl = F.point(at, IN / 2);
    // 階のボタン（かごの中、前の壁の内側・扉の横）: 今の階の前後の表の階と、存在しない階 3 つ
    const dd = ctx.floor.depth;
    const real: { label: string; to: string | null; cur?: boolean }[] = [{ label: '1', to: null }];
    for (let n = Math.max(0, dd - 2); n <= dd + 3; n++) real.push({ label: `B${n + 1}`, to: n === dd + 1 ? `${dd + 1}.1` : null, ...(n === dd ? { cur: true } : {}) });
    const fakes = ctx.rng.shuffle([...FAKES]).slice(0, 3);
    const all: { label: string; to: string | null; cur?: boolean; fake: boolean }[] = ctx.rng.shuffle([...real.map((r) => ({ ...r, fake: false })), ...fakes.map((f) => ({ label: f, to: null, fake: true }))]);
    const order = ctx.rng.shuffle([0, 1, 2]);
    const inF = wallFrame(F.rect(iu0, 0, iu1, IN), ((d + 2) % 4) as Dir);
    const side = ctx.rng.chance(0.5) ? -1 : 1;
    const pu = at + side * 0.72;
    const buttons = all.map((b, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const bt = wallButton(ctx, inF, `b${i}`, pu + (col - 0.5) * 0.17, 1.66 - row * 0.2, { label: b.label, size: 0.05, range: 2.0, litSec: 0.5 });
      return { ...b, ...bt, scratches: b.fake ? order.indexOf(fakes.indexOf(b.label)) + 1 : 0 };
    });
    // 呼ぶボタン（外、扉の横）
    const outF = wallFrame(F.rect(F.u0, FR, F.u1, F.depth), d);
    const call = wallButton(ctx, outF, 'call', at - side * 0.72, 1.15, { label: '▼', size: 0.07, range: 2.2, litSec: 3, glow: 0xffb050 });
    const gapR = F.rect(at - 0.5, IN - 0.35, at + 0.5, FR + 0.35);
    const panelR = F.rect(at - 0.46, IN + 0.02, at + 0.46, FR - 0.02);
    const inputs: { [k: string]: string } = { call: `${call.id}.pressed` };
    buttons.forEach((b, i) => { inputs[`b${i}`] = `${b.id}.pressed`; });
    const cabin = ctx.addEntity('cabin', { type: 'liftCabin', inputs, params: {
      gap: aabbJson({ min: [gapR.x0, y, gapR.z0], max: [gapR.x1, y + 2.2, gapR.z1] }),
      panel: aabbJson({ min: [panelR.x0, y, panelR.z0], max: [panelR.x1, y + 2.15, panelR.z1] }),
      inside: aabbJson({ min: [inner.x0, y - 0.2, inner.z0], max: [inner.x1, y + 2, inner.z1] }),
      buttons: buttons.map((b) => ({ label: b.label, to: b.to, cur: !!b.cur, fake: b.fake, scratches: b.scratches, center: b.center })) as unknown as Json,
      order: order.map((k) => buttons.findIndex((b) => b.label === fakes[k])),
      rideSec: 5, arriveSec: 2.5, slide: (d % 2 === 0 ? [1, 0, 0] : [0, 0, 1]) as Json, cur: `B${dd + 1}`, call: call.center,
      indicator: (() => { const p = F.point(at, FR + 0.02); return [p[0], y + 2.32, p[1]]; })(),
      facing: (() => { const a = F.point(at, 1), b = F.point(at, 0); return [a[0] - b[0], 0, a[1] - b[1]]; })(),
    } });
    const lamp = ctx.addEntity('lamp', { type: 'lamp', params: { on: true, rate: 20 }, inputs: { on: `${cabin}.lit` } });
    s.cell.lights.push({ pos: [cl[0], y + 2.3, cl[1]], color: 0xf4f0e6, intensity: 0.5, distance: 3, lampId: lamp });
    // 隠し: かごの奥の壁（部屋の壁）。歩く人は、呼んで、乗って、存在しない階を傷の数の順に押す
    const back = F.point(at, 0);
    const fakeSeq = order.map((k) => buttons.find((b) => b.label === fakes[k])!);
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([
      { at: call.stand(0.75), look: call.center, wait: 0.5, until: `${cabin}.open` },
      ...fakeSeq.map((b) => ({ at: b.stand(0.7), look: b.center, wait: 0.7 })),
    ], { only: 'secret', doneIf: `${cabin}.secret` }) } });
    ctx.offerSecret({ hook: 'lift.ghost', modes: ['appear'], weight: 1, revealOutput: `${cabin}.secret`, doorway: { dir: d, at: d % 2 === 0 ? back[0] : back[1], y, width: 0.9, height: 2.0 }, tell: '案内板に無い階のボタンと、その横の引っかき傷' });
    const k0 = F.rect(at - half - 0.3, 0, at + half + 0.3, FR + 1.4);
    ctx.keepOut({ min: [k0.x0, y, k0.z0], max: [k0.x1, y + H, k0.z1] });
  },
});

defineGimmick({
  id: 'vendingRoom', name: '自販機', axes: ['light', 'puzzle'], kinds: ['room', 'hall'], minSize: [3.0, 3.4], minHeight: 2.3, weight: 0.18, intensity: 0, offersSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    // 自販機（幅 1.0）と点検口（幅 1.0）の並ぶ壁（入口の正面か横）
    const dirs = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).filter((d) => !s.entrance || d !== s.entrance.dir);
    let pick: { d: Dir; at: number; F: WallFrame } | null = null;
    for (const d of dirs) {
      const span = freeWallSpan(s, d, 2.6, 0.8);
      if (!span) continue;
      const F = wallFrame(innerRect(s), d);
      if (F.depth < 2.6) continue;
      const r = F.rect(span.at - 1.3, 0, span.at + 1.3, 1.6);
      if (hitsDoorZones(s, r, 1.3)) continue;
      pick = { d, at: span.at, F };
      break;
    }
    if (!pick) return;
    const { d, at, F } = pick;
    const side = ctx.rng.chance(0.5) ? -1 : 1;
    const mu = at + side * 0.6, hu = at - side * 0.7;
    const m = F.rect(mu - 0.5, 0, mu + 0.5, 0.8);
    // 本体（当たり判定）・光る正面・取り出し口
    ctx.addBox(box([m.x0, y, m.z0], [m.x1, y + 1.85, m.z1], ctx.rng.pick(['plasticRed', 'plasticBlue', 'paintWhite'] as const)));
    const face = F.rect(mu - 0.42, 0.8, mu + 0.18, 0.81);
    ctx.addBox(box([face.x0, y + 0.95, face.z0], [face.x1, y + 1.75, face.z1], 'screenGlow', false));
    const slot = F.rect(mu - 0.3, 0.8, mu + 0.3, 0.83);
    ctx.addBox(box([slot.x0, y + 0.18, slot.z0], [slot.x1, y + 0.36, slot.z1], 'metalDark', false));
    // 自販機の灯り（正面の明かり）
    { const p = F.point(mu, 1.3); s.cell.lights.push({ pos: [p[0], y + 1.3, p[1]], color: 0xdfe8ff, intensity: 0.35, distance: 3.5 }); }
    // 3 色のボタン（正面の右寄り、縦に）
    const colors = [0xff3b30, 0x2f7bff, 0x34c759];
    const mats = ['plasticRed', 'plasticBlue', 'lightGreen'] as const;
    const G = wallFrame(innerRect(s), d);
    const btns = colors.map((c, i) => {
      const p = G.rect(mu + 0.28, 0.8, mu + 0.36, 0.83);
      const h = 1.5 - i * 0.22;
      const id = ctx.addEntity(`b${i}`, { type: 'pushButton', params: { box: aabbJson({ min: [p.x0, y + h - 0.04, p.z0], max: [p.x1, y + h + 0.04, p.z1] }), mat: mats[i]!, glow: c, range: 2.2, litSec: 0.5 } });
      const cc = G.point(mu + 0.32, 0.82);
      return { id, center: [cc[0], y + h, cc[1]] as [number, number, number] };
    });
    const sc = G.point(mu, 0.81);
    const slotBtn = ctx.addEntity('slot', { type: 'pushButton', params: { box: aabbJson({ min: [Math.min(slot.x0, slot.x1), y + 0.18, Math.min(slot.z0, slot.z1)], max: [Math.max(slot.x0, slot.x1), y + 0.36, Math.max(slot.z0, slot.z1)] }), mat: 'metalDark', glow: 0xffd24a, range: 2.0, litSec: 0, hidden: true } });
    const inputs: { [k: string]: string } = { slot: `${slotBtn}.pressed` };
    btns.forEach((b, i) => { inputs[`b${i}`] = `${b.id}.pressed`; });
    const vend = ctx.addEntity('vend', { type: 'vending', inputs, params: { colors, keyAfter: t['ground.vend.keyAfter'], slot: [sc[0], y + 0.27, sc[1]], dir: [G.point(mu, 1)[0] - G.point(mu, 0)[0], 0, G.point(mu, 1)[1] - G.point(mu, 0)[1]] } });
    // 部屋の照明: いつもの照明（缶の色が付いていない間）と、3 色の照明
    const main = ctx.addEntity('lampMain', { type: 'lamp', params: { on: true, rate: 3 }, inputs: { on: `${vend}.c0` } });
    linkRoomLights(ctx, main);
    const r = innerRect(s);
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    colors.forEach((c, i) => {
      const lamp = ctx.addEntity(`lamp${i + 1}`, { type: 'lamp', params: { on: false, rate: 3 }, inputs: { on: `${vend}.c${i + 1}` } });
      s.cell.lights.push({ pos: [cx, y + s.cell.height - 0.3, cz], color: c, intensity: 0.9, distance: Math.max(6, Math.hypot(r.x1 - r.x0, r.z1 - r.z0)), lampId: lamp });
    });
    // 隠し: 自販機の横の点検口
    const hp = F.point(hu, 0);
    const k = ctx.rng.int(0, 2);
    const stand = (u: number): [number, number, number] => { const p = G.point(u, 1.55); return [p[0], y, p[1]]; };
    const steps = Array.from({ length: t['ground.vend.keyAfter'] }, () => ({ at: stand(mu + 0.32), look: btns[k]!.center, wait: 0.6 }));
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([...steps, { at: stand(mu), look: [sc[0], y + 0.27, sc[1]], wait: 1.0 }], { only: 'secret', doneIf: `${vend}.taken` }) } });
    ctx.offerSecret({ hook: 'vend.key', modes: ['appear'], weight: 1, revealOutput: `${vend}.taken`, doorway: { dir: d, at: d % 2 === 0 ? hp[0] : hp[1], y, width: 0.9, height: 1.9 }, tell: '自販機の横の、鍵穴のある点検口' });
    ctx.keepOut({ min: [Math.min(m.x0, m.x1) - 1.4, y, Math.min(m.z0, m.z1) - 1.4], max: [Math.max(m.x0, m.x1) + 1.4, y + 2.5, Math.max(m.z0, m.z1) + 1.4] });
  },
});
