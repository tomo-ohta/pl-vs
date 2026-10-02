/**
 * ドミノの橋（dominoBridge）[QR G06]・違う向きに倒す（BG03）。
 *
 * 部屋を横切る深い溝の手前の縁に、背の高い棚が 1 列に並ぶ。列の端には溝の縁に立つ「橋の棚」（溝を横切る向きに倒れる長い棚）。
 * 棚を押すと（E / タップ。押した人から離れる向きに倒れる）隣を倒しながら倒れていき、端の橋の棚が溝に倒れて橋になる。
 * - 目標: 出口の側の橋の棚まで倒して溝を渡る。規則: 押した棚は押した向きに倒れ、隣を倒す（見て分かる）
 * - 失敗: 橋から足を踏み外すと溝の底。溝の中の階段で手前へ戻れる。棚はどれも押せるので、倒し損ねても残りを押せばよい（閉じ込めない）
 * - 溝の縁は柵（跳んで越えられない）。渡れるのは橋の所だけ（走って跳べば溝を越えられてしまうので）
 * - 帰り道: 溝の向こうのレバーで、手前の橋の棚を向こうへ倒せる（出口の側から来た人）
 * - 隠し（domino.reverse）: 向こう岸は仕切りで分かれていて、出口と反対の側は小部屋。列を出口と逆の向きに倒すと、反対の端の橋の棚が
 *   小部屋へ倒れる。小部屋の横の壁に扉（存在型 = 最初からある / 出現型 = 小部屋への橋が架かると現れる）
 *   （案は「違う順に倒す」。押した棚から両側へ倒れる鎖では順は効かないので「違う向きに倒す」にした）
 * - 行き止まりの部屋（開口が 1 つ）にも置く。そのときは出口の側の橋の先の奥の壁にも隠しの扉（domino.across）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_W, type Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson } from '../util.ts';
import { botHint, buildTrench, enterAt, entranceFrame, onRectWall, planTrench, railLine } from './common.ts';

/** 入口の壁を手前にした座標で、u0 の側・u1 の側の横の壁の向き */
const sideDir = (d: Dir, side: -1 | 1): Dir => (d % 2 === 0 ? (side < 0 ? 3 : 1) : (side < 0 ? 2 : 0));

defineGimmick({
  id: 'dominoBridge', name: 'ドミノの橋', axes: ['floor', 'puzzle'], kinds: ['room', 'hall'], minSize: [4.6, 6.6], minHeight: 2.7, weight: 0.8, intensity: 1, offersSecret: true, onMainPath: true,
  // 入口と出口が向かい合う部屋（溝を渡って出口へ）か、行き止まりの部屋（向こう岸に隠し）
  fits: (s) => !!s.entrance && (s.openings.length === 1 || (!!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4)),
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const ent = s.entrance!;
    const ex = s.openings.length === 1 ? null : s.exit!;
    if (!s.openings.every((o) => onRectWall(s, o))) return;
    const F = entranceFrame(s);
    const D = F.depth;
    const W = t['ground.domino.trenchM'];
    // 棚の列（入口の扉の前 1.3 m は空ける）・溝・向こう岸（出口の扉の前 1.3 m + 柵）
    const vr = 1.75, vt0 = vr + 0.6, vt1 = vt0 + W;
    if (D - vt1 < 1.6) return;
    // 横の壁の開口は手前の側だけ（向こう岸の小部屋・出口の側を外とつながない）
    for (const o of s.openings) if (o !== ent && o !== ex && F.v(o.pos[0], o.pos[2]) > vt0 - 1.4) return;
    // 行き止まりの部屋では、出口の代わりに向こう岸の片側（橋の着く所）
    const ue = ex ? F.u(ex.pos[0], ex.pos[2]) : F.u0 + (F.u1 - F.u0) * (ctx.rng.chance(0.5) ? 0.72 : 0.28);
    const ew = ex ? ex.width : 1.0;
    // 向こう岸の小部屋: 出口から遠い側。幅 1.5 m 以上・出口の側も 1.6 m 以上
    const roomMinus = ue - ew / 2 - 0.45 - F.u0, roomPlus = F.u1 - (ue + ew / 2 + 0.45);
    const aSide: -1 | 1 = roomMinus >= roomPlus ? -1 : 1;
    const aRoom = aSide < 0 ? roomMinus : roomPlus;
    const hasAlcove = aRoom >= 1.6 + 1.5 && D - vt1 >= 1.9;
    // 仕切り（向こう岸を出口の側と小部屋に分ける）・橋の棚の位置
    const uPart = hasAlcove ? (aSide < 0 ? F.u0 + Math.min(aRoom - 1.6, 2.4) : F.u1 - Math.min(aRoom - 1.6, 2.4)) : NaN;
    const exLo = hasAlcove && aSide < 0 ? uPart + 0.1 : F.u0, exHi = hasAlcove && aSide > 0 ? uPart - 0.1 : F.u1;
    // 出口の側の橋: 出口に近い所（両端から 0.65 m・仕切りから 0.7 m 空ける）
    const um = Math.min(Math.max(ue, exLo + 0.7), exHi - 0.7);
    const us = hasAlcove ? (aSide < 0 ? (F.u0 + uPart) / 2 : (uPart + F.u1) / 2) : NaN;
    // 鎖の端（小部屋が無ければ、出口と反対の壁の手前）
    const uEnd = hasAlcove ? us : (aSide < 0 ? F.u0 + 0.5 : F.u1 - 0.5);
    const sgn = Math.sign(um - uEnd) as 1 | -1;
    const span = Math.abs(um - uEnd) - 1.8;
    if (span < 0.9) return;
    const nChain = Math.max(2, Math.floor(span / 1.0) + 1);
    const pitch = span / (nChain - 1);
    if (pitch > 1.2 || pitch < 0.75) return;
    // 溝の階段: 橋（向こう岸の着く所）から遠い方の壁の端
    const farGaps = [um, ...(hasAlcove ? [us] : [])];
    const sideScore = (sd: -1 | 1): number => Math.min(...farGaps.map((u) => Math.abs(u - (sd < 0 ? F.u0 : F.u1))));
    const stairSide: -1 | 1 = sideScore(-1) >= sideScore(1) ? -1 : 1;
    if (sideScore(stairSide) < 2.2) return;
    const hC = Math.min(t['ground.domino.heightM'], s.cell.height - 0.25);
    const Lb = W + 0.65;
    if (Lb > s.cell.height - 0.15) return;
    const plan = planTrench(ctx, { v0: vt0, v1: vt1, depth: t['ground.domino.depthM'], stairSide });
    if (!plan) return;
    const tr = buildTrench(ctx, plan);
    const rect3 = (r: Rect, y0: number, y1: number): Json => aabbJson({ min: [r.x0, y0, r.z0], max: [r.x1, y1, r.z1] });
    // 棚: [小部屋の橋の棚] + 鎖 + [出口の側の橋の棚]（鎖の並びは uEnd → um）
    type Piece = { stand: Json; lieP: Json; lieN?: Json; push: boolean; fixed?: number; u: number; kind: string };
    const pieces: Piece[] = [];
    const bridgePiece = (u: number): Piece => ({
      stand: rect3(F.rect(u - 0.45, vt0 - 0.35, u + 0.45, vt0 - 0.05), y, y + Lb),
      lieP: rect3(F.rect(u - 0.45, vt0 - 0.35, u + 0.45, vt0 - 0.35 + Lb), y, y + 0.3),
      push: false, fixed: 1, u, kind: 'bridge',
    });
    if (hasAlcove) pieces.push(bridgePiece(us));
    for (let i = 0; i < nChain; i++) {
      const u = uEnd + sgn * (0.9 + i * pitch);
      const T = 0.25;
      // 倒れる向き: lieP = 鎖の並びの次（出口の側）へ / lieN = 前（小部屋の側）へ
      const fwd = F.rect(Math.min(u - sgn * T / 2, u - sgn * T / 2 + sgn * hC), vr - 0.4, Math.max(u - sgn * T / 2, u - sgn * T / 2 + sgn * hC), vr + 0.4);
      const bwd = F.rect(Math.min(u + sgn * T / 2, u + sgn * T / 2 - sgn * hC), vr - 0.4, Math.max(u + sgn * T / 2, u + sgn * T / 2 - sgn * hC), vr + 0.4);
      pieces.push({ stand: rect3(F.rect(u - T / 2, vr - 0.4, u + T / 2, vr + 0.4), y, y + hC), lieP: rect3(fwd, y, y + T), lieN: rect3(bwd, y, y + T), push: true, u, kind: 'shelf' });
    }
    pieces.push(bridgePiece(um));
    // 柵: 手前の縁（橋の棚・階段の出口を空ける）と向こうの縁（橋が架かる所を空ける）。小部屋の仕切り
    const gapsNear: [number, number][] = [[um - 0.5, um + 0.5], tr.stairGap, ...(hasAlcove ? [[us - 0.5, us + 0.5] as [number, number]] : [])];
    railLine(ctx, F, vt0 - 0.1, vt0, F.u0, F.u1, gapsNear);
    const gapsFar: [number, number][] = [[um - 0.5, um + 0.5], ...(hasAlcove ? [[us - 0.5, us + 0.5] as [number, number]] : [])];
    railLine(ctx, F, vt1, vt1 + 0.1, F.u0, F.u1, gapsFar);
    if (hasAlcove) {
      const pr = F.rect(uPart - 0.075, vt1, uPart + 0.075, D);
      ctx.addBox(box([pr.x0, y, pr.z0], [pr.x1, y + s.cell.height, pr.z1], s.cell.palette.wall));
    }
    // 帰り道のレバー: 向こう岸の、橋が架かる所の横の柵の柱
    const lu = Math.abs(um + 0.75 - (hasAlcove ? uPart : Infinity)) > 0.4 && um + 0.75 < exHi - 0.15 ? um + 0.75 : um - 0.75;
    const lr = F.rect(lu - 0.09, vt1 + 0.1, lu + 0.09, vt1 + 0.2);
    const lever = ex ? ctx.addEntity('lever', { type: 'button', params: { box: rect3(lr, y + 0.95, y + 1.2), mat: 'plasticRed', range: 1.6 } }) : null;
    // 棚は 1 枚ずつの部品（p0 .. pn）。並びの次の棚が軸の + の側か
    const pid = (i: number): string => `${ctx.id}.p${i}`;
    const fwd = sgn;
    const mainId = pid(pieces.length - 1), secId = hasAlcove ? pid(0) : null;
    // 歩く人: 手前から = 出口の側の橋の棚の手前の棚を、出口の側へ押す / 向こうから = レバー / 隠し = 小部屋の側の棚を小部屋の側へ押す
    const last = pieces[pieces.length - 2]!, first = pieces[hasAlcove ? 1 : 0]!;
    const standFor = (p: Piece, dir: number): [number, number, number] => { const q = F.point(p.u - dir * 0.6, vr - 1.05); return [q[0], y, q[1]]; };
    const lookAt = (p: Piece): [number, number, number] => { const q = F.point(p.u, vr); return [q[0], y + 1.2, q[1]]; };
    const leverStand = F.point(lu, vt1 + 1.0), leverAt = F.point(lu, vt1 + 0.15);
    const hints: Json[] = [botHint([{ at: standFor(last, sgn), look: lookAt(last), wait: 2.5 }], { enterAt: enterAt(ent), doneIf: `${mainId}.fallen` })];
    if (secId) hints.push(botHint([{ at: standFor(first, -sgn), look: lookAt(first), wait: 2.5 }], { only: 'secret', doneIf: `${secId}.fallen` }));
    if (ex) hints.push(botHint([{ at: [leverStand[0], y, leverStand[1]], look: [leverAt[0], y + 1.07, leverAt[1]], wait: 2.5 }], { enterAt: enterAt(ex), doneIf: `${mainId}.fallen` }));
    for (const o of s.openings) if (o !== ent && o !== ex) hints.push(botHint([{ at: standFor(last, sgn), look: lookAt(last), wait: 2.5 }], { enterAt: enterAt(o), doneIf: `${mainId}.fallen` }));
    const mat = ctx.rng.pick(['bookshelfWood', 'shelfMetal', 'furnitureDark'] as const);
    pieces.forEach((p, i) => {
      const params: { [k: string]: Json } = { stand: p.stand, lieP: p.lieP, push: p.push, kind: p.kind, axis: F.d % 2 === 0 ? 'x' : 'z', fwd, mat: p.kind === 'bridge' ? 'woodPanel' : mat };
      if (p.lieN) params.lieN = p.lieN;
      if (p.fixed !== undefined) params.fixed = p.fixed;
      if (i > 0) params.prev = pid(i - 1);
      if (i + 1 < pieces.length) params.next = pid(i + 1);
      if (i === pieces.length - 1) params.bot = hints;
      ctx.addEntity(`p${i}`, { type: 'domino', params, ...(i === pieces.length - 1 && lever ? { inputs: { drop: `${lever}.pressed` } } : {}) });
    });
    if (hasAlcove) {
      // 小部屋の横の壁の扉
      const sd = sideDir(F.d, aSide);
      const vm = (vt1 + 0.1 + D) / 2;
      const p = F.point(aSide < 0 ? F.u0 : F.u1, vm);
      const at = sd === 1 || sd === 3 ? p[1] : p[0];
      const clash = s.openings.some((o) => o.dir === sd && Math.abs((sd % 2 === 0 ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + DOOR_W / 2 + 0.6);
      if (!clash && D - vt1 - 0.1 >= DOOR_W + 0.7) ctx.offerSecret({ hook: 'domino.reverse', modes: ['present', 'appear'], weight: 1.2, revealOutput: `${secId}.fallen`, doorway: { dir: sd, at, y, width: 1.0, height: 2.0 }, tell: '向こう岸の小部屋の床に、細い光の筋' });
    }
    // 行き止まりの部屋: 出口の側の橋の先（奥の壁）にも扉（存在型 / 出現型 = 橋が架かると現れる）
    if (!ex) {
      const fd = ((F.d + 2) % 4) as Dir;
      const p = F.point(um, D);
      ctx.offerSecret({ hook: 'domino.across', modes: ['present', 'appear'], weight: 1.0, revealOutput: `${mainId}.fallen`, doorway: { dir: fd, at: fd % 2 === 0 ? p[0] : p[1], y, width: 1.0, height: 2.0 }, tell: '溝の向こうの壁の継ぎ目' });
    }
    // 棚の列の手前を空ける（家具を置かない）
    const keep = F.rect(F.u0, vr - 1.6, F.u1, D);
    ctx.keepOut({ min: [keep.x0, y - 3, keep.z0], max: [keep.x1, y + 3, keep.z1] });
  },
});
