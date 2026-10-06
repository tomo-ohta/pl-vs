/**
 * warpLapHall: 異変の廊下（X01・BX01。8 番出口型）の周回。
 *
 * 廊下の形（core/gen/gimmicks/warp/anomalyHall.ts）: 入口の短い廊下 P → 曲がり S0 → 見る廊下 C0 → 曲がり S1 → 出口の短い廊下 C1。
 * S0 と S1、P と C0 の端、C1 と C0 の始まりは同じ形（S1 = S0 + 1 周のずれ。S0 は真ん中を中心に 180° 回しても同じ）。
 * - 進む: S1 の真ん中の面を前へ越えたら、1 周ぶん戻して S0 の真ん中へ（次の周の始まり）
 * - 引き返す: S0 の真ん中の面を後ろへ越えたら、S0 の真ん中を中心に 180° 回す（前を向いて次の周の始まりへ）
 * どちらも C0 の真ん中（異変を置く所）は見えない所なので、移した tick に次の周の異変を差し替える。
 * 判定: 異変があるのに進む・無いのに引き返すと数が 0 に戻る。正しければ 1 つ増える。数が goal に着くと、次の周は出口（S1 の先へ進める）。
 * 数が 0 で異変の無い周は、引き返すと来た道へ戻れる（閉じ込めない）。間違えた次の周は異変なし。
 * 隠し（BX01）: 一度も引き返さずに、異変のある周を secretRun 回進むと、出力 secret が 1 になる（異変の部屋の扉が現れる）。
 *
 * params:
 *   g1 / g0 … { center, dir, box }（S1・S0 の真ん中の面。dir は進む向き / 引き返す向き）
 *   lap … S1 → S0 の写し方 / turn … S0 の 180° の写し方
 *   objects … [{ boxes }]（ふつうの物。異変で隠す物も含む）・anomalies … [{ id, size, hide: [物の番号], boxes, fx? }]
 *   goal・chance（周に異変がある確率）・secretRun
 * 状態: anomaly（今の周の異変の番号。-1 は無し）・count・exit・wrongRun・secret・bag（まだ出していない異変の並び）・laps・last
 */
import { aabbCenter } from '../../../math/aabb.ts';
import type { Dir } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, type PartContext } from '../../part.ts';
import type { SwapBox } from './swap.ts';
import { inBox, readAabb, readXform, sideOf, xPoint, xYaw } from './util.ts';

interface LapObj { boxes: SwapBox[] }
interface LapAnomaly { id: string; size: number; hide: number[]; boxes: SwapBox[]; fx?: string }

interface LapState {
  [k: string]: Json | undefined;
  anomaly: number; count: number; exit: number; wrongRun: number; secret: number; bag: number[]; laps: number; last: number;
  side1: Record<string, number>; side0: Record<string, number>;
}

const objsOf = (ctx: PartContext): LapObj[] => (ctx.spec.params.objects as unknown as LapObj[] | undefined) ?? [];
const anomsOf = (ctx: PartContext): LapAnomaly[] => (ctx.spec.params.anomalies as unknown as LapAnomaly[] | undefined) ?? [];

/** 今の周の当たる物を置き直す（ふつうの物のうち隠していない物・異変の物） */
function setColliders(ctx: PartContext, s: LapState): void {
  const objs = objsOf(ctx), anoms = anomsOf(ctx);
  const a = s.anomaly >= 0 ? anoms[s.anomaly] : undefined;
  const hidden = new Set(a?.hide ?? []);
  objs.forEach((o, i) => o.boxes.forEach((b, j) => ctx.setCollider(`o${i}:${j}`, !hidden.has(i) && b.solid ? { min: [b.min[0]!, b.min[1]!, b.min[2]!], max: [b.max[0]!, b.max[1]!, b.max[2]!] } : null)));
  anoms.forEach((x, i) => x.boxes.forEach((b, j) => ctx.setCollider(`a${i}:${j}`, i === s.anomaly && b.solid ? { min: [b.min[0]!, b.min[1]!, b.min[2]!], max: [b.max[0]!, b.max[1]!, b.max[2]!] } : null)));
}

/** 次の周の異変を決める（袋から順に。袋が空なら詰め直して混ぜる） */
function nextAnomaly(ctx: PartContext, s: LapState, forceNone: boolean): void {
  const n = anomsOf(ctx).length;
  if (forceNone || !n || ctx.random() >= pNum(ctx.spec, 'chance', 0.5)) { s.anomaly = -1; return; }
  if (!s.bag.length) {
    s.bag = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(ctx.random() * (i + 1)); [s.bag[i], s.bag[j]] = [s.bag[j]!, s.bag[i]!]; }
  }
  s.anomaly = s.bag.shift()!;
}

definePart<LapState>({
  type: 'warpLapHall',
  outputs: ['count', 'exit', 'anomaly', 'secret', 'laps', 'last'],
  init(ctx) {
    const s: LapState = { anomaly: -1, count: 0, exit: 0, wrongRun: 0, secret: 0, bag: [], laps: 0, last: -1, side1: {}, side0: {} };
    setColliders(ctx, s);
    return s;
  },
  step(s, ctx) {
    const P = ctx.spec.params;
    const g1 = P.g1 as { center: number[]; dir: number; box: Json }, g0 = P.g0 as { center: number[]; dir: number; box: Json };
    const b1 = readAabb(g1.box), b0 = readAabb(g0.box);
    const lap = readXform(P.lap), turn = readXform(P.turn);
    const goal = pNum(ctx.spec, 'goal', 5), run = pNum(ctx.spec, 'secretRun', 3);
    for (const p of ctx.players) {
      const foot = [p.pos[0], p.pos[1] + 0.1, p.pos[2]];
      const n1 = sideOf(g1.center, (g1.dir & 3) as Dir, p.pos), n0 = sideOf(g0.center, (g0.dir & 3) as Dir, p.pos);
      const p1 = s.side1[p.id], p0 = s.side0[p.id];
      s.side1[p.id] = n1;
      s.side0[p.id] = n0;
      const crossed1 = p1 !== undefined && Math.abs(n1 - p1) < 1 && p1 < 0 && n1 >= 0 && inBox(foot, b1);
      const crossed0 = p0 !== undefined && Math.abs(n0 - p0) < 1 && p0 < 0 && n0 >= 0 && inBox(foot, b0);
      if (crossed1) {
        // 進んだ: 出口の周ならそのまま。そうでなければ判定して 1 周戻す
        if (s.exit) continue;
        const ok = s.anomaly < 0;
        // 異変を見ても進み続けた数（引き返すと数え直し。異変の無い周を進むのは数え直さない）
        if (!ok) s.wrongRun++;
        if (s.wrongRun >= run && !s.secret) { s.secret = 1; ctx.cue('lap.secret', p.pos); }
        s.count = ok ? s.count + 1 : 0;
        s.last = ok ? 1 : 0;
        s.laps++;
        if (s.count >= goal) { s.exit = 1; ctx.cue('lap.exit', p.pos); }
        nextAnomaly(ctx, s, !ok || !!s.exit);
        const to = xPoint(lap, p.pos);
        ctx.warp(p, to, xYaw(lap, p.yaw));
        s.side1[p.id] = sideOf(g1.center, (g1.dir & 3) as Dir, to);
        s.side0[p.id] = sideOf(g0.center, (g0.dir & 3) as Dir, to);
        setColliders(ctx, s);
      } else if (crossed0) {
        // 引き返した: 数が 0 で異変の無い周は、来た道へ（そのまま）。そうでなければ判定して 180° 回す
        if (s.count === 0 && s.anomaly < 0) continue;
        const ok = s.anomaly >= 0;
        s.wrongRun = 0;
        s.count = ok ? s.count + 1 : 0;
        s.last = ok ? 1 : 0;
        s.laps++;
        s.exit = s.count >= goal ? 1 : 0;
        if (s.exit) ctx.cue('lap.exit', p.pos);
        nextAnomaly(ctx, s, !ok || !!s.exit);
        const to = xPoint(turn, p.pos);
        ctx.warp(p, to, xYaw(turn, p.yaw));
        s.side1[p.id] = sideOf(g1.center, (g1.dir & 3) as Dir, to);
        s.side0[p.id] = sideOf(g0.center, (g0.dir & 3) as Dir, to);
        setColliders(ctx, s);
      }
    }
    ctx.output('count', s.count);
    ctx.output('exit', s.exit);
    ctx.output('anomaly', s.anomaly);
    ctx.output('secret', s.secret);
    ctx.output('laps', s.laps);
    ctx.output('last', s.last);
  },
});

/** 箱の組の真ん中（試験・描画の補助） */
export const boxesCenter = (boxes: readonly SwapBox[]): number[] => aabbCenter({ min: [Math.min(...boxes.map((b) => b.min[0]!)), Math.min(...boxes.map((b) => b.min[1]!)), Math.min(...boxes.map((b) => b.min[2]!))], max: [Math.max(...boxes.map((b) => b.max[0]!)), Math.max(...boxes.map((b) => b.max[1]!)), Math.max(...boxes.map((b) => b.max[2]!))] });
