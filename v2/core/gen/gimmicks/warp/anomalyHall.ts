/**
 * 異変の廊下（anomalyHall: X01・BX01。8 番出口型）。部品は warpLapHall（core/sim/parts/warp/lap.ts）。
 *
 * 遊び方: 控え室のもう 1 枚の扉の先に、白いタイルの地下通路。入口の短い廊下 P の掲示「おかしな所があれば引き返す。なければ進む」。
 * 左へ曲がり、右へ曲がると、掲示・長椅子・消火器・扉の並ぶまっすぐな廊下 C0（天井から周の数の札）。突き当たりで左・右と曲がると、
 * また C0 の始まりに戻っている（次の周）。周ごとに C0 に異変が 1 つあるか無いか（掲示の色・掲示が無い・扉が増える・天井が下がる・
 * 赤い照明・人が立っている …。小さく見つけにくい物から大きな物まで 16 種）。異変があれば引き返し、無ければ進む。正しければ札の数が増え、
 * 間違えると 0 に戻る。goal 回続けて正しいと、次の周は札が「出口」になり、突き当たりの先へ進める（最初の部屋の双子 → 元の部屋）。
 * 閉じ込めない: 数が 0 の周は異変が無く、引き返すと来た道（控え室）へ戻れる。間違えれば 0 に戻るので、いつでも出られる。
 * 隠し（BX01）: 一度も引き返さずに、異変のある周を 3 回進むと、C0 の壁に異変の部屋の扉が現れる（出現型）。
 *
 * 形（局所の座標 u: もう 1 枚の扉の外向き、v: 左。幅 w・曲がりの間 s・見る廊下の長さ L）:
 *   P  [0, Lp] × [−w/2, w/2]・S0 [Lp, Lp+w] × [−w/2, w/2+s+w]・C0 [Lp+w, Lp+w+L] × [w/2+s, w/2+s+w]・
 *   S1 = S0 + (w+L, w+s)・C1 = C0 の始まり + (w+L, w+s)
 * S0 の真ん中から曲がり角の先は 2.5 m までしか見えない（廊下の幅²/角までの距離）。異変は C0 の両端から 3.5 m より内側だけに置く。
 * 1 周のずれ (w+L, w+s) と S0 の真ん中（180° の中心）は 6 m・3 m の刻みに乗せる（床・壁のタイルの目地が揃う）
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import type { Vec3 } from '../../../math/vec.ts';
import { opening } from '../../../world/build.ts';
import { WALL_T, type Box, type CellLayout, type Json, type MatId, type Palette, type WallOpening } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import type { SwapBox } from '../../../sim/parts/warp/swap.ts';
import { xJson } from '../../../sim/parts/warp/util.ts';
import { defineGimmick } from '../types.ts';
import { attachToPod, buildAnteroom, planAnteroom } from './anteroom.ts';
import { addPocketCell, axisOf, ceilingLight, joinCells, makeFrame, openingPair, pocketCell, splitAlong, type Frame } from './pocket.ts';

const W = 2.4, S = 3.6, L = 15.6, LC1 = 5, H = 2.7;
/** 異変を置ける C0 の範囲（C0 の始まりからの距離） */
const ZONE0 = 3.5, ZONE1 = L - 3.5;

const sb = (b: Box): SwapBox => ({ min: [...b.min], max: [...b.max], mat: b.mat, solid: b.solid });

/** 白いタイルの地下通路の色の組（タイルの目地は 1.2 m・天井 0.6 m: 6 m の刻みで揃う） */
function hallPalette(): Palette {
  return { ...themePalette('TransitCorridor'), floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', light: 'lightPanel', door: 'doorMetal', lightColor: 0xf4f6f0, lightIntensity: 1.05, fog: 0x0a0b0c };
}

defineGimmick({
  id: 'anomalyHall', name: '異変の廊下', axes: ['sight', 'puzzle'], kinds: ['room'], minSize: [3.8, 3.8], weight: WARP_TUNING['warp.lapHall.weight'].default, intensity: 2,
  offersSecret: true, onMainPath: true,
  build(ctx) {
    const t = ctx.tuning;
    // もう 1 枚の扉の横の位置を 3 m の刻みに（S0 の真ん中を刻みに乗せる）
    const plan = planAnteroom(ctx, { snap: 3 });
    if (!plan) return;
    const ante = buildAnteroom(ctx, plan);
    const R1 = ante.entry;
    const n = plan.pod.dir;
    const pod = R1.podOut.pos;
    // P の長さ: S0 の真ん中（前へ Lp + w/2）が 3 m の刻みに乗る、4.5 m 以上 7.5 m 未満
    // （S の真ん中から P の奥は 3 m ほどしか見えない。P の終わりの 4 m が C0 の終わりの 4 m と同じになる長さ）
    const along = axisOf(n) === 'x' ? 0 : 2;
    const sgn = n === 0 || n === 1 ? 1 : -1;
    let Lp = 4.5;
    for (let k = 0; k < 60; k++) {
      const cand = 4.5 + k * 0.05;
      const c = pod[along]! + sgn * (cand + W / 2);
      if (Math.abs(c / 3 - Math.round(c / 3)) < 1e-6) { Lp = cand; break; }
    }
    Lp = Math.round(Lp * 100) / 100;
    const f = makeFrame(pod, n);
    const y = R1.cell.floorY;
    const pal = hallPalette();
    const key = `${ctx.id}:lap`;
    const id = (s: string): string => `${plan.host.id}~x${s}`;
    // ---- 区画
    const u = { p1: Lp, s0: Lp, c0: Lp + W, c0e: Lp + W + L, s1: Lp + W + L, c1: Lp + 2 * W + L, c1e: Lp + 2 * W + L + LC1 };
    const v = { s0: -W / 2, c0: W / 2 + S, s1: W / 2 + S, s1e: W / 2 + 2 * S + 2 * W, c1: W / 2 + 2 * S + W };
    const rects: Record<string, [number, number, number, number]> = {
      P: [0, -W / 2, u.p1, W / 2],
      S0: [u.s0, v.s0, u.s0 + W, W / 2 + S + W],
      C0: [u.c0, v.c0, u.c0e, v.c0 + W],
      S1: [u.s1, v.s1, u.s1 + W, v.s1e],
      C1: [u.c1, v.c1, u.c1e, v.c1 + W],
    };
    const ops = new Map<string, WallOpening[]>(Object.keys(rects).map((k) => [k, []]));
    const join = (a: string, b: string, pos: Vec3): void => {
      const [oa, ob] = openingPair(id(a), id(b), pos, f.dir(0), W, H);
      ops.get(a)!.push(oa);
      ops.get(b)!.push(ob);
    };
    // R' の扉（P の始まり）と、Q' の扉（C1 の終わり）の開口
    ops.get('P')!.push(opening(`${id('P')}:in`, f.p(0, 0, 0), f.dir(2)));
    ops.get('C1')!.push(opening(`${id('C1')}:out`, f.p(u.c1e, 0, v.c1 + W / 2), f.dir(0)));
    join('P', 'S0', f.p(u.p1, 0, 0));
    join('S0', 'C0', f.p(u.c0, 0, v.c0 + W / 2));
    join('C0', 'S1', f.p(u.c0e, 0, v.c0 + W / 2));
    join('S1', 'C1', f.p(u.c1, 0, v.c1 + W / 2));
    const cells: Record<string, CellLayout> = {};
    for (const [k, r] of Object.entries(rects)) {
      cells[k] = pocketCell({ id: id(k), pocket: ctx.id, rects: [f.rect(r[0], r[1], r[2], r[3])], height: H, floorY: y, palette: pal, openings: ops.get(k)!, theme: 'TransitCorridor', name: '地下通路', materialKey: key, audio: '地下通路' });
    }
    // ---- 照明（S0・S1 は曲がり角と真ん中。C0 は 2.6 m ごと（真ん中に対して対称）。P・C1 は C0 の端と同じ並び）
    const sLights = (c: CellLayout, u0: number, v0: number): void => {
      for (const vv of [v0 + W / 2, v0 + W + S / 2, v0 + W + S + W / 2]) ceilingLight(c, f, u0 + W / 2, vv, H, false, true, 0.9, 5);
    };
    sLights(cells.S0!, u.s0, v.s0);
    sLights(cells.S1!, u.s1, v.s1);
    for (let k = 0; k < 6; k++) ceilingLight(cells.C0!, f, u.c0 + 1.3 + 2.6 * k, v.c0 + W / 2, H, true, true, 1, 5);
    for (const d of [1.3, 3.9]) {
      if (u.p1 - d > 0.4) ceilingLight(cells.P!, f, u.p1 - d, 0, H, true, true, 1, 5);
      ceilingLight(cells.C1!, f, u.c1 + d, v.c1 + W / 2, H, true, true, 1, 5);
    }
    // 床・天井・壁を C0 の端から 4 m・P の終わりの 4 m・C1 の始まりの 4 m で切る（双子の所の箱の分け方を揃える）
    splitAlong(cells.C0!, f, [u.c0 + 4, u.c0e - 4]);
    splitAlong(cells.P!, f, [u.p1 - 4]);
    splitAlong(cells.C1!, f, [u.c1 + 4]);
    for (const k of Object.keys(rects)) addPocketCell(ctx, cells[k]!, 'corridor', ops.get(k)!);
    for (const [a, b, pos] of [['P', 'S0', f.p(u.p1, 0, 0)], ['S0', 'C0', f.p(u.c0, 0, v.c0 + W / 2)], ['C0', 'S1', f.p(u.c0e, 0, v.c0 + W / 2)], ['S1', 'C1', f.p(u.c1, 0, v.c1 + W / 2)]] as const) {
      joinCells(ctx, id(a), id(b), pos, f.dir(0), W, H);
    }
    attachToPod(ctx, R1, id('P'));
    const Q = ante.addCopy({ from: plan.pod.pos, to: f.p(u.c1e, 0, v.c1 + W / 2), q: 2 }, 'xq');
    attachToPod(ctx, Q, id('C1'));

    // ---- 見る廊下 C0 のふつうの物と異変
    const { objects, anomalies, sign } = decor(f, u.c0, v.c0, pal);
    // S0・S1 の真ん中（曲がり角と曲がり角の間の真ん中）
    const s0c = f.p(u.s0 + W / 2, 0, v.s0 + W + S / 2);
    const s1center = f.p(u.s1 + W / 2, 0, v.s1 + W + S / 2);
    const gateBox = (c: Vec3): Json => ({ min: [c[0] - W / 2, y - 0.5, c[2] - W / 2], max: [c[0] + W / 2, y + 3, c[2] + W / 2] });
    const lap = f.xform([0, 0, 0], [-(W + L), 0, -(W + S)], 0);
    const turn = { from: s0c, to: s0c, q: 2 as const };
    const ctrl = ctx.addEntity('lap', {
      type: 'warpLapHall', cell: id('C0'),
      params: {
        g1: { center: s1center, dir: f.dir(1), box: gateBox(s1center) },
        g0: { center: s0c, dir: f.dir(3), box: gateBox(s0c) },
        lap: xJson(lap), turn: xJson(turn),
        objects: objects as unknown as Json, anomalies: anomalies as unknown as Json,
        goal: t['warp.lapHall.goal'], chance: t['warp.lapHall.chance'], secretRun: t['warp.lapHall.secretRun'],
        sign: sign as unknown as Json,
        zone: (() => { const a = f.aabb(u.c0 + ZONE0, 0, v.c0, u.c0 + ZONE1, H, v.c0 + W); return { min: [...a.min], max: [...a.max] }; })(),
      },
    });
    // 入口の短い廊下の掲示（遊び方）
    const bp = f.p(0.9, 1.25, -W / 2 + WALL_T + 0.02);
    ctx.addEntity('rule', { type: 'warpSign', cell: id('P'), params: { pos: bp, dir: f.dir(1), w: 1.1, h: 0.75, lines: ['おかしな所があれば、引き返す', 'なければ、進む', '出口まで'], style: 'board' } });
    // 隠し（BX01）: C0 の左の壁（異変を置く所の真ん中）に、異変の部屋の扉が現れる
    const sd = f.dir(1);
    const sp = f.p(u.c0 + L / 2 + 0.6, 0, v.c0 + W);
    ctx.offerSecret({ hook: 'lap.keepGoing', modes: ['appear'], weight: t['warp.lapHall.secretWeight'], revealOutput: `${ctrl}.secret`, doorway: { dir: sd, at: axisOf(sd) === 'x' ? sp[2] : sp[0], y, width: 1.0, height: 2.0 }, cell: id('C0'), tell: '同じ壁の掲示だけ、いつも少し傾いている' });
    ante.finish();
  },
});

/**
 * C0 のふつうの物（掲示 4 枚・長椅子・消火器・扉・通気口・くず入れ）と、異変 16 種（小さく見つけにくい物から大きな物まで）。
 * 局所の座標: C0 の始まり u0・右の壁 v0（左の壁は v0 + W）。物はすべて異変を置ける範囲（ZONE0..ZONE1）の中
 */
function decor(f: Frame, u0: number, v0: number, pal: Palette): { objects: { boxes: SwapBox[] }[]; anomalies: { id: string; size: number; hide: number[]; boxes: SwapBox[]; fx?: string }[]; sign: Json } {
  const iL = v0 + W - WALL_T, iR = v0 + WALL_T;
  const B = (a0: number, y0: number, b0: number, a1: number, y1: number, b1: number, mat: MatId, solid = false): SwapBox => sb(f.box(u0 + a0, y0, b0, u0 + a1, y1, b1, mat, solid));
  const objects: { boxes: SwapBox[] }[] = [];
  const add = (boxes: SwapBox[]): number => { objects.push({ boxes }); return objects.length - 1; };
  // 掲示（左の壁）: 枠と絵
  const posterAt = [4.6, 6.6, 8.6, 10.6];
  const imgs: MatId[] = ['plasticBlue', 'plasticYellow', 'noticeGreen', 'plasticRed'];
  const posters = posterAt.map((c, i) => add([B(c - 0.38, 1.15, iL - 0.02, c + 0.38, 2.15, iL, 'signPlate'), B(c - 0.3, 1.25, iL - 0.03, c + 0.3, 1.85, iL - 0.02, imgs[i]!)]));
  const bench = add([B(5.0, 0, iR, 6.6, 0.4, iR + 0.4, 'metalDark', true), B(5.0, 0.4, iR, 6.6, 0.46, iR + 0.42, 'stainless', true)]);
  const ext = add([B(11.5, 0, iR, 11.75, 0.62, iR + 0.22, 'plasticRed', true)]);
  const door = add([B(9.1, 0, iR, 10.1, 2.1, iR + 0.05, 'doorMetal'), B(9.95, 0.95, iR + 0.05, 10.0, 1.05, iR + 0.1, 'metal')]);
  const vent = add([B(7.3, H - 0.02, v0 + W / 2 - 0.3, 7.9, H - 0.005, v0 + W / 2 + 0.3, 'metalDark')]);
  const bin = add([B(6.9, 0, iR, 7.25, 0.55, iR + 0.32, 'stainless', true)]);
  // 天井から下がる周の数の札（描画が数字を出す）
  const sign = { pos: f.p(u0 + ZONE0 + 0.2, H - 0.55, v0 + W / 2), dir: f.dir(2), w: 0.9, h: 0.38 } as unknown as Json;
  const anomalies: { id: string; size: number; hide: number[]; boxes: SwapBox[]; fx?: string }[] = [];
  const A = (id: string, size: number, hide: number[], boxes: SwapBox[], fx?: string): void => { anomalies.push({ id, size, hide, boxes, ...(fx ? { fx } : {}) }); };
  // 小さい（よく見ないと分からない）
  A('posterColor', 0, [posters[1]!], [B(6.6 - 0.38, 1.15, iL - 0.02, 6.6 + 0.38, 2.15, iL, 'signPlate'), B(6.6 - 0.3, 1.25, iL - 0.03, 6.6 + 0.3, 1.85, iL - 0.02, 'plasticRed')]);
  A('posterGone', 0, [posters[2]!], []);
  A('handprints', 0, [], [0, 1, 2].map((k) => B(7.1 + k * 0.32, 1.0 + k * 0.12, iL - 0.006, 7.3 + k * 0.32, 1.22 + k * 0.12, iL - 0.004, 'shadowDecal')));
  A('ventEyes', 0, [], [B(7.5, H - 0.03, v0 + W / 2 - 0.12, 7.56, H - 0.025, v0 + W / 2 - 0.06, 'neonRed'), B(7.64, H - 0.03, v0 + W / 2 - 0.12, 7.7, H - 0.025, v0 + W / 2 - 0.06, 'neonRed')]);
  A('signWrong', 0, [], [], 'sign');
  A('binTipped', 0, [bin], [B(6.75, 0, iR + 0.05, 7.3, 0.33, iR + 0.4, 'stainless', true), B(7.3, 0, iR + 0.25, 7.6, 0.01, iR + 0.6, 'boxCardboard')]);
  // 中くらい
  A('posterExtra', 1, [], [B(11.8 - 0.38, 1.15, iL - 0.02, 11.8 + 0.38, 2.15, iL, 'signPlate'), B(11.8 - 0.3, 1.25, iL - 0.03, 11.8 + 0.3, 1.85, iL - 0.02, 'plasticYellow')]);
  A('benchGone', 1, [bench], []);
  A('doorRed', 1, [door], [B(9.1, 0, iR, 10.1, 2.1, iR + 0.05, 'plasticRed'), B(9.95, 0.95, iR + 0.05, 10.0, 1.05, iR + 0.1, 'metal')]);
  A('extraDoor', 1, [], [B(7.1, 0, iL - 0.05, 8.1, 2.1, iL, 'doorMetal'), B(7.15, 0.95, iL - 0.1, 7.2, 1.05, iL - 0.05, 'metal')]);
  A('extinguisherBig', 1, [ext], [B(11.15, 0, iR, 11.9, 1.85, iR + 0.66, 'plasticRed', true)]);
  A('puddle', 1, [], [B(6.0, 0, v0 + 0.6, 9.0, 0.004, v0 + W - 0.6, 'puddle')]);
  // 大きい（扉を開けた瞬間に分かる）
  // 人が立っている（見た目の箱 + 描かない当たり判定の箱 mat 'colliderOnly'）
  const fc = 9.9, fv = v0 + W / 2;
  const figure: SwapBox[] = [
    B(fc - 0.06, 0, fv - 0.12, fc + 0.06, 0.85, fv - 0.02, 'whiteFabric'), B(fc - 0.06, 0, fv + 0.02, fc + 0.06, 0.85, fv + 0.12, 'whiteFabric'),
    B(fc - 0.11, 0.85, fv - 0.2, fc + 0.11, 1.45, fv + 0.2, 'whiteFabric'), B(fc - 0.08, 1.45, fv - 0.1, fc + 0.08, 1.68, fv + 0.1, 'marbleWhite'),
    B(fc - 0.05, 0.8, fv - 0.28, fc + 0.05, 1.42, fv - 0.2, 'whiteFabric'), B(fc - 0.05, 0.8, fv + 0.2, fc + 0.05, 1.42, fv + 0.28, 'whiteFabric'),
    { ...B(fc - 0.2, 0, fv - 0.3, fc + 0.2, 1.7, fv + 0.3, 'whiteFabric', true), mat: 'colliderOnly' },
  ];
  A('figure', 2, [], figure);
  A('lowCeiling', 2, [vent], [B(6.0, 2.0, v0 + WALL_T, 10.0, H, v0 + W - WALL_T, pal.ceiling, true)]);
  // 赤い照明: 異変を置ける範囲の照明（C0 の始まりから 6.5・9.1 m）を赤く、両の壁の天井際に赤い光の帯
  A('redLight', 2, [], [
    ...[6.5, 9.1].map((c) => B(c - 0.62, H - 0.05, v0 + W / 2 - 0.32, c + 0.62, H - 0.041, v0 + W / 2 + 0.32, 'neonRed')),
    B(5.2, H - 0.12, iL - 0.04, 10.4, H - 0.06, iL, 'neonRed'), B(5.2, H - 0.12, iR, 10.4, H - 0.06, iR + 0.04, 'neonRed'),
  ], 'red');
  A('manyDoors', 2, [door, ...posters], [4.6, 6.0, 7.4, 8.8, 10.2, 11.6].map((c, k) => (k % 2 ? B(c - 0.5, 0, iL - 0.05, c + 0.5, 2.1, iL, 'doorMetal') : B(c - 0.5, 0, iR, c + 0.5, 2.1, iR + 0.05, 'doorMetal'))));
  return { objects, anomalies, sign };
}

/** 試験用: 局所の座標の定数 */
export const LAP_DIMS = { W, S, L, LC1, H, ZONE0, ZONE1 };
