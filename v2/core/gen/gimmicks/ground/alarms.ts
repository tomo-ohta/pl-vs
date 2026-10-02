/**
 * 壁の装置（回転灯と警報 D09・ブレーカー D10・ダイヤル錠 D11・呼び出しボタン D12）。どれも隠しが無いと成り立たないので、置いたら隠しを付ける。
 *
 * - alarmRoom 回転灯と警報: 壁のガラスの蓋の付いた赤いボタン。押すと警報が鳴り、回転灯が回って部屋が赤くなる。鳴っている間だけ、
 *   別の壁の鋼鉄の扉が開く（alarm.door・存在型。中からは近づけばいつでも開く）
 * - breakerRoom ブレーカー: 壁の分電盤のレバーを下ろすと、部屋の照明が全部消え、非常口の印と床の蓄光の矢印だけが光る。矢印の先の、
 *   非常口の印の下の壁が開く（breaker.exit・出現型）。レバーを戻すと明かりが戻る
 * - dialSafe ダイヤル錠: 壁の大きな金庫の扉に、赤・青・緑のダイヤル。部屋の壁のあちこちに同じ色の数字（ポスター・張り紙）。
 *   色の数字に合わせると扉が開いて、中の小部屋へ（safe.open・出現型）。開けなくても先へ進める
 * - callBell 呼び出しボタン: 入口の近くの呼び出しボタン。押すと、しばらくして部屋の遠くでベルが 3 回鳴り、その方の壁に扉が開いて明かりが漏れる
 *   （bell.door・出現型。音の向きで扉を探す）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Json } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, freeWallSpan, hitsDoorZones, innerRect, wallFrame, type WallFrame } from '../util.ts';
import { botHint, linkRoomLights, snap } from './common.ts';

interface WallSpot { d: Dir; at: number; F: WallFrame }

/** 開口の無い壁の区間（長さ need・前に depth の床）。avoid の壁は使わない。far があれば、その点から遠い所を先に */
function wallSpots(ctx: GimmickContext, need: number, depth: number, o: { avoid?: Dir[]; far?: [number, number]; near?: [number, number] } = {}): WallSpot[] {
  const s = ctx.slot;
  const out: WallSpot[] = [];
  for (const d of [0, 1, 2, 3] as Dir[]) {
    if (o.avoid?.includes(d)) continue;
    const span = freeWallSpan(s, d, need, 0.9);
    if (!span) continue;
    const F = wallFrame(innerRect(s), d);
    if (F.depth < depth + 0.6) continue;
    // 区間の中で、何か所か
    const n = Math.max(1, Math.floor((span.a1 - span.a0 - need) / 0.8) + 1);
    for (let k = 0; k < n; k++) {
      const at = snap(n === 1 ? span.at : span.a0 + need / 2 + ((span.a1 - span.a0 - need) * k) / (n - 1));
      const r = F.rect(at - need / 2, 0, at + need / 2, depth);
      if (hitsDoorZones(s, r, 1.3)) continue;
      out.push({ d, at, F });
    }
  }
  const pt = (w: WallSpot): [number, number] => w.F.point(w.at, 0.5);
  const shuffled = ctx.rng.shuffle(out);
  if (o.far) return shuffled.sort((a, b) => Math.hypot(pt(b)[0] - o.far![0], pt(b)[1] - o.far![1]) - Math.hypot(pt(a)[0] - o.far![0], pt(a)[1] - o.far![1]));
  if (o.near) return shuffled.sort((a, b) => Math.hypot(pt(a)[0] - o.near![0], pt(a)[1] - o.near![1]) - Math.hypot(pt(b)[0] - o.near![0], pt(b)[1] - o.near![1]));
  return shuffled;
}

/** 壁の点（壁から v・高さ h） */
const wallPoint = (w: WallSpot, u: number, v: number, h: number, y: number): [number, number, number] => { const p = w.F.point(u, v); return [p[0], y + h, p[1]]; };

/** 壁の押しボタン（中心 u・高さ h）。id・中心・前に立つ点 */
function button(ctx: GimmickContext, w: WallSpot, name: string, u: number, h: number, half: number, o: { mat?: string; glow?: number; litSec?: number; range?: number; disable?: string } = {}): { id: string; center: [number, number, number]; stand: [number, number, number] } {
  const y = ctx.slot.cell.floorY;
  const r = w.F.rect(u - half, 0, u + half, 0.05);
  const id = ctx.addEntity(name, { type: 'pushButton', params: { box: aabbJson({ min: [r.x0, y + h - half, r.z0], max: [r.x1, y + h + half, r.z1] }), mat: o.mat ?? 'plasticRed', glow: o.glow ?? 0xff4030, litSec: o.litSec ?? 0.6, range: o.range ?? 2.2 }, ...(o.disable ? { inputs: { disable: o.disable } } : {}) });
  return { id, center: wallPoint(w, u, 0.04, h, y), stand: wallPoint(w, u, 0.8, 0, y) };
}

const doorAt = (w: WallSpot): number => { const p = w.F.point(w.at, 0); return w.d % 2 === 0 ? p[0] : p[1]; };

defineGimmick({
  id: 'alarmRoom', name: '回転灯と警報', axes: ['sound', 'light'], kinds: ['room', 'hall'], minSize: [4.4, 5.0], minHeight: 2.4, weight: 0.4, intensity: 1, offersSecret: true, requiresSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY, H = s.cell.height;
    const bw = wallSpots(ctx, 1.2, 1.2)[0];
    if (!bw) return;
    const bp = bw.F.point(bw.at, 0.5);
    const dw = wallSpots(ctx, 1.8, 1.4, { far: bp }).find((w) => w.d !== bw.d || Math.abs(w.at - bw.at) > 3);
    if (!dw) return;
    // 赤いボタン（ガラスの蓋の枠）
    { const r = bw.F.rect(bw.at - 0.16, 0, bw.at + 0.16, 0.08); ctx.addBox(box([r.x0, y + 1.05, r.z0], [r.x1, y + 1.37, r.z1], 'metalDark', false)); }
    const btn = button(ctx, bw, 'button', bw.at, 1.21, 0.07, { mat: 'plasticRed', glow: 0xff2a1a });
    const alarm = ctx.addEntity('alarm', { type: 'alarm', params: { sec: t['ground.alarm.sec'], beacons: [wallPoint(bw, bw.at, 0.12, Math.min(H - 0.25, 2.4), y), wallPoint(dw, dw.at + 0.95, 0.12, Math.min(H - 0.25, 2.3), y)] as Json }, inputs: { press: `${btn.id}.pressed` } });
    // 照明: 鳴っている間は部屋の照明が消え、赤い灯り
    const main = ctx.addEntity('lampMain', { type: 'lamp', params: { on: true, rate: 6 }, inputs: { on: `${alarm}.off` } });
    linkRoomLights(ctx, main);
    const red = ctx.addEntity('lampRed', { type: 'lamp', params: { on: false, rate: 6 }, inputs: { on: `${alarm}.on` } });
    const r0 = innerRect(s);
    s.cell.lights.push({ pos: [(r0.x0 + r0.x1) / 2, y + H - 0.3, (r0.z0 + r0.z1) / 2], color: 0xff2010, intensity: 0.9, distance: Math.max(7, Math.hypot(r0.x1 - r0.x0, r0.z1 - r0.z0)), lampId: red });
    // 鋼鉄の扉（隠しの入口の内側）。警報が鳴っている間・中から近づいたときに開く
    const pr = dw.F.rect(dw.at - 0.58, 0.0, dw.at + 0.58, 0.07);
    const fr = dw.F.rect(dw.at - 0.72, 0.0, dw.at + 0.72, 0.1);
    ctx.addBox(box([fr.x0, y + 2.12, fr.z0], [fr.x1, y + 2.3, fr.z1], 'metalDark', false));
    const out = ((): [number, number] => { const a = dw.F.point(dw.at, 0), b = dw.F.point(dw.at, 1); return [a[0] - b[0], a[1] - b[1]]; })();
    const door = ctx.addEntity('door', { type: 'securityDoor', params: { panel: aabbJson({ min: [pr.x0, y, pr.z0], max: [pr.x1, y + 2.12, pr.z1] }), out: out as Json, slide: (dw.d % 2 === 0 ? [1, 0, 0] : [0, 0, 1]) as Json }, inputs: { open: `${alarm}.on` } });
    const front = wallPoint(dw, dw.at, 0.9, 0, y);
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([{ at: btn.stand, look: btn.center, wait: 0.4 }, { at: front, until: `${door}.open` }], { only: 'secret' }) } });
    ctx.offerSecret({ hook: 'alarm.door', modes: ['present'], weight: 1, required: true, doorway: { dir: dw.d, at: doorAt(dw), y, width: 1.0, height: 2.0 }, tell: '警報の鳴っている間だけ開く鋼鉄の扉' });
    for (const w of [bw, dw]) { const k = w.F.rect(w.at - 1.0, 0, w.at + 1.0, 1.4); ctx.keepOut({ min: [k.x0, y, k.z0], max: [k.x1, y + 2.6, k.z1] }); }
  },
});

defineGimmick({
  id: 'breakerRoom', name: 'ブレーカー', axes: ['light'], kinds: ['room', 'hall'], minSize: [4.0, 4.6], minHeight: 2.3, weight: 0.4, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const bw = wallSpots(ctx, 1.0, 1.0)[0];
    if (!bw) return;
    const bp = bw.F.point(bw.at, 0.5);
    const ew = wallSpots(ctx, 1.6, 1.2, { far: bp }).find((w) => w.d !== bw.d || Math.abs(w.at - bw.at) > 2.5);
    if (!ew) return;
    // 分電盤とレバー
    { const r = bw.F.rect(bw.at - 0.25, 0, bw.at + 0.25, 0.12); ctx.addBox(box([r.x0, y + 1.15, r.z0], [r.x1, y + 1.85, r.z1], 'metal')); }
    const lever = button(ctx, bw, 'lever', bw.at, 1.5, 0.06, { mat: 'metalDark', glow: 0xffd24a, litSec: 0.3 });
    const brkId = `${ctx.id}.breaker`;
    const main = ctx.addEntity('lampMain', { type: 'lamp', params: { on: true, rate: 12 }, inputs: { on: `${brkId}.on` } });
    linkRoomLights(ctx, main);
    // 非常口の印（開口の上と、隠しの壁の上）と、床の蓄光の矢印（部屋の真ん中から隠しの壁へ）
    const signs: number[][] = [];
    for (const o of s.openings) { const f = ctx.frontOf(o, 0.08); signs.push([f[0], y + 2.25, f[2], [0, Math.PI / 2, Math.PI, -Math.PI / 2][o.dir]!]); }
    const ep = wallPoint(ew, ew.at, 0.08, 2.25, y);
    signs.push([ep[0], ep[1], ep[2], [0, Math.PI / 2, Math.PI, -Math.PI / 2][ew.d]!]);
    const r = innerRect(s);
    const c: [number, number] = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
    const goal = ew.F.point(ew.at, 0.8);
    const arrows: number[][] = [];
    const L = Math.hypot(goal[0] - c[0], goal[1] - c[1]);
    for (let k = 0.6; k < L - 0.3; k += 0.9) arrows.push([c[0] + ((goal[0] - c[0]) * k) / L, y + 0.006, c[1] + ((goal[1] - c[1]) * k) / L, Math.atan2(goal[0] - c[0], goal[1] - c[1])]);
    const brk = ctx.addEntity('breaker', { type: 'breaker', params: { lever: lever.center, signs: signs as Json, arrows: arrows as Json }, inputs: { press: `${lever.id}.pressed` } });
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([{ at: lever.stand, look: lever.center, wait: 0.6, until: `${brk}.off` }], { only: 'secret', doneIf: `${brk}.off` }) } });
    ctx.offerSecret({ hook: 'breaker.exit', modes: ['appear'], weight: 1, required: true, revealOutput: `${brk}.off`, doorway: { dir: ew.d, at: doorAt(ew), y, width: 1.0, height: 2.0 }, tell: '明かりを消すと光る、非常口の印と床の矢印' });
    for (const w of [bw, ew]) { const k = w.F.rect(w.at - 0.9, 0, w.at + 0.9, 1.3); ctx.keepOut({ min: [k.x0, y, k.z0], max: [k.x1, y + 2.6, k.z1] }); }
  },
});

defineGimmick({
  id: 'dialSafe', name: 'ダイヤル錠', axes: ['puzzle', 'sight'], kinds: ['room', 'hall'], minSize: [4.0, 4.8], minHeight: 2.4, weight: 0.35, intensity: 1, offersSecret: true, requiresSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const vw = wallSpots(ctx, 2.0, 1.4)[0];
    if (!vw) return;
    const vp = vw.F.point(vw.at, 0.5);
    // 手がかりの張り紙 3 枚（金庫の壁から離れた所、別々の場所）
    const cands = wallSpots(ctx, 0.8, 0.6, { far: vp }).filter((w) => w.d !== vw.d || Math.abs(w.at - vw.at) > 1.8);
    const clues: WallSpot[] = [];
    for (const w of cands) { if (clues.every((x) => x.d !== w.d || Math.abs(x.at - w.at) > 1.2)) clues.push(w); if (clues.length === 3) break; }
    if (clues.length < 3) return;
    const code = [ctx.rng.int(1, 9), ctx.rng.int(1, 9), ctx.rng.int(1, 9)];
    const colors = [0xd83a2e, 0x2f6fd8, 0x2f9e4f];
    // 金庫の扉の枠（隠しの入口の前）
    { const r = vw.F.rect(vw.at - 0.85, 0, vw.at + 0.85, 0.12); ctx.addBox(box([r.x0, y + 2.1, r.z0], [r.x1, y + 2.3, r.z1], 'metalDark', false)); }
    // 開いたらダイヤルは調べられない（後ろの扉を調べられるように）
    const lockId = `${ctx.id}.lock`;
    const dials = colors.map((c, i) => button(ctx, vw, `dial${i}`, vw.at - 0.28 + i * 0.28, 1.25, 0.05, { mat: (['plasticRed', 'plasticBlue', 'lightGreen'] as const)[i]!, glow: c, litSec: 0.15, range: 2.0, disable: `${lockId}.open` }));
    const inputs: { [k: string]: string } = {};
    dials.forEach((d, i) => { inputs[`d${i}`] = `${d.id}.pressed`; });
    const lock = ctx.addEntity('lock', { type: 'dialLock', inputs, params: { code, dials: dials.map((d) => d.center) as Json, colors, vault: wallPoint(vw, vw.at, 0.1, 1.05, y) as Json, out: ((): number[] => { const a = vw.F.point(vw.at, 1), b = vw.F.point(vw.at, 0); return [a[0] - b[0], 0, a[1] - b[1]]; })(), clues: clues.map((w, i) => [...wallPoint(w, w.at, 0.015, ctx.rng.float(1.3, 1.7), y), [0, Math.PI / 2, Math.PI, -Math.PI / 2][w.d]!, i]) as Json } });
    const steps = dials.flatMap((d, i) => Array.from({ length: code[i]! }, () => ({ at: d.stand, look: d.center, wait: 0.25 })));
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint(steps, { only: 'secret', doneIf: `${lock}.open` }) } });
    ctx.offerSecret({ hook: 'safe.open', modes: ['appear'], weight: 1, required: true, revealOutput: `${lock}.open`, doorway: { dir: vw.d, at: doorAt(vw), y, width: 1.0, height: 2.0 }, tell: '色の付いた数字の張り紙と、同じ色のダイヤル' });
    for (const w of [vw, ...clues]) { const k = w.F.rect(w.at - 0.9, 0, w.at + 0.9, 1.2); ctx.keepOut({ min: [k.x0, y, k.z0], max: [k.x1, y + 2.6, k.z1] }); }
  },
});

defineGimmick({
  id: 'callBell', name: '呼び出しボタン', axes: ['sound'], kinds: ['room', 'hall'], minSize: [5.0, 6.6], minHeight: 2.4, weight: 0.45, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const ent = s.entrance;
    if (!ent) return;
    const ep = ctx.frontOf(ent, 1.0);
    const bw = wallSpots(ctx, 0.8, 0.9, { near: [ep[0], ep[2]] })[0];
    if (!bw) return;
    const bp = bw.F.point(bw.at, 0.5);
    const dw = wallSpots(ctx, 1.6, 1.4, { far: bp })[0];
    if (!dw) return;
    const dp = dw.F.point(dw.at, 0.5);
    if (Math.hypot(dp[0] - bp[0], dp[1] - bp[1]) < 4.5) return;
    // 呼び出しの箱（インターホン）とボタン
    { const r = bw.F.rect(bw.at - 0.12, 0, bw.at + 0.12, 0.06); ctx.addBox(box([r.x0, y + 1.1, r.z0], [r.x1, y + 1.5, r.z1], 'paintWhite', false)); }
    const btn = button(ctx, bw, 'button', bw.at, 1.22, 0.035, { mat: 'plasticYellow', glow: 0xffd24a, litSec: 2 });
    const bell = ctx.addEntity('bell', { type: 'callBell', params: { delay: t['ground.bell.delaySec'], at: wallPoint(dw, dw.at, 0.2, 2.0, y) as Json }, inputs: { press: `${btn.id}.pressed` } });
    const lamp = ctx.addEntity('lamp', { type: 'lamp', params: { on: false, rate: 1.5 }, inputs: { on: `${bell}.open` } });
    const lp = wallPoint(dw, dw.at, 0.6, 2.1, y);
    s.cell.lights.push({ pos: lp, color: 0xffc070, intensity: 0.7, distance: 4, lampId: lamp });
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([{ at: btn.stand, look: btn.center, wait: 0.5, until: `${bell}.open` }], { only: 'secret', doneIf: `${bell}.open` }) } });
    ctx.offerSecret({ hook: 'bell.door', modes: ['appear'], weight: 1, required: true, revealOutput: `${bell}.open`, doorway: { dir: dw.d, at: doorAt(dw), y, width: 1.0, height: 2.0 }, tell: '遠くで鳴るベル' });
    // 何も置かない広い部屋（仕切りや棚で音の方へ歩けなくならないように。暗がりの広さで、音の向きだけが頼り）
    const all = innerRect(s);
    ctx.keepOut({ min: [all.x0, y, all.z0], max: [all.x1, y + s.cell.height, all.z1] });
  },
});
