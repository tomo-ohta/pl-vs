/**
 * 小物の作り方の表: 種類（PropSpec.kind）→ 形の関数。
 *
 * PropSpec は置き場所と引数だけのデータ（関数を持たない）なので、Worker（props.worker.ts）へそのまま送れる。
 * 置き場所は place(o, yaw, s)（局所の +z が yaw の向きの前。shape.ts）。乱数は seed から（同じ種で同じ形）。
 */
import { place, Rand, type ShapeSink, type V3 } from './shape.ts';
import { dracaena, ficus, sansevieria, shrub } from './gen/plants.ts';
import { bookRow } from './gen/books.ts';
import { goodsRow, vendingDisplay, type GoodsKind } from './gen/goods.ts';
import { curtain, duvet, futon, pillow } from './gen/fabric.ts';
import { ballPit, cone, coolerBottle, deskLamp, extinguisherStand, hoop, sculpture, trophy, wallClock } from './gen/objects.ts';
import { urinal } from './gen/porcelain.ts';
import { kitchenTop, sconce, toilet, wallBasin } from './gen/fixtures.ts';
import { pinnedSheet } from './gen/paper.ts';
import { bucketWater, CARRY_GEN, smallVase, toy, type CarryColors } from './gen/carry.ts';

/** 引数（Worker へ送れる値だけ） */
export type PropArg = number | string | boolean | number[] | number[][] | null;

export interface PropSpec {
  /** 作り方の種類（GEN のキー） */
  kind: string;
  /** 置き場所: 原点・向き・大きさ */
  o: V3;
  yaw: number;
  s: number;
  /** 種類ごとの引数 */
  a: Record<string, PropArg>;
  /** 乱数の種 */
  seed: number;
}

type Xf = (p: V3) => V3;
type Gen = (S: ShapeSink, R: Rand, xf: Xf, a: Record<string, PropArg>) => void;

const n = (v: PropArg | undefined, fb = 0): number => (typeof v === 'number' ? v : fb);
const v3 = (v: PropArg | undefined): V3 => (Array.isArray(v) ? [Number(v[0]), Number(v[1]), Number(v[2])] : [0, 0, 0]);
const colors = (a: Record<string, PropArg>): CarryColors => ({ main: n(a.main, 0xcccccc), label: n(a.label, 0xd23a34), glass: n(a.glass, 0xffd29a), dots: n(a.dots, 1) });

const PLANTS: Record<string, (S: ShapeSink, R: Rand, xf: Xf) => void> = { ficus, dracaena, sansevieria };

export const GEN: Record<string, Gen> = {
  plant: (S, R, xf, a) => (PLANTS[String(a.species)] ?? dracaena)(S, R, xf),
  /** 植え込みの低木（boxes: [中心 x, y, z, 半径 x, y, z] の並び。座標は xf の中の座標） */
  shrubs: (S, R, xf, a) => { for (const b of (a.boxes as number[][] | null) ?? []) shrub(S, R, xf, [b[0]!, b[1]!, b[2]!], [b[3]!, b[4]!, b[5]!]); },
  bookRow: (S, R, xf, a) => bookRow(S, R, xf, { x0: n(a.x0), x1: n(a.x1), zBack: n(a.zBack), zFront: n(a.zFront), maxH: n(a.maxH), binders: !!a.binders }),
  goodsRow: (S, R, xf, a) => goodsRow(S, R, xf, { x0: n(a.x0), x1: n(a.x1), zFront: n(a.zFront), maxH: n(a.maxH), kind: String(a.goods) as GoodsKind }),
  /** 寝具: 掛け布団と枕（幅 w・奥行き d・マットレスの上面 top） */
  bed: (S, R, xf, a) => {
    const w = n(a.w), top = n(a.top);
    duvet(S, R, xf, { x0: 0, x1: w, z0: 0, z1: n(a.d), top, color: n(a.color, 0x5a7aa8), pattern: !!a.pattern });
    if (w > 1.2) { pillow(S, R, xf, [w * 0.28, top + 0.062, 0.25], 0.5, 0.36); pillow(S, R, xf, [w * 0.72, top + 0.062, 0.25], 0.5, 0.36, 0xe8e2d4); }
    else pillow(S, R, xf, [w * 0.5, top + 0.062, 0.25], Math.min(0.6, w - 0.2), 0.36);
  },
  pillow: (S, R, xf, a) => pillow(S, R, xf, v3(a.c), n(a.w, 0.62), n(a.d, 0.42), n(a.color, 0xf3f0ea)),
  coolerBottle: (S, R, xf) => coolerBottle(S, R, xf),
  trophy: (S, R, xf) => trophy(S, R, xf),
  sculpture: (S, R, xf) => sculpture(S, R, xf),
  smallVase: (S, R, xf, a) => smallVase(S, R, xf, v3(a.h), colors(a)),
  toy: (S, R, xf, a) => toy(S, R, xf, v3(a.h), colors(a)),
  cone: (S, R, xf) => cone(S, R, xf),
  urinal: (S, R, xf) => urinal(S, R, xf),
  wallBasin: (S, R, xf) => wallBasin(S, R, xf),
  toilet: (S, R, xf, a) => toilet(S, R, xf, !!a.lidUp),
  kitchenTop: (S, R, xf, a) => kitchenTop(S, R, xf, { len: n(a.len), depth: n(a.depth, 0.62), sink: v3(a.sink).slice(0, 2) as [number, number], hobs: (a.hobs as number[] | null) ?? [] }),
  vendingDisplay: (S, R, xf, a) => vendingDisplay(S, R, xf, { width: n(a.width), rows: (a.rows as number[] | null) ?? [], perRow: n(a.perRow, 6) }),
  deskLamp: (S, R, xf) => deskLamp(S, R, xf),
  wallClock: (S, R, xf, a) => wallClock(S, R, xf, n(a.hour, 10), n(a.minute, 8)),
  sconce: (S, R, xf) => sconce(S, R, xf),
  extinguisherStand: (S, R, xf) => extinguisherStand(S, R, xf),
  pinnedSheet: (S, R, xf, a) => pinnedSheet(S, R, xf, 0, 0, n(a.w, 0.21), n(a.h, 0.297)),
  futon: (S, R, xf) => futon(S, R, xf, [0, 0, 0]),
  curtain: (S, R, xf, a) => curtain(S, R, xf, { x0: 0, x1: n(a.w), y0: n(a.y0), y1: n(a.y1), z: 0, color: n(a.color, 0xe8e6e0) }),
  hoop: (S, R, xf) => hoop(S, R, xf),
  ballPit: (S, R, xf, a) => ballPit(S, R, xf, n(a.w), n(a.d), n(a.top)),
  /** 持てる物（v2 の carryItem / carryBody の kind。h は半分の大きさ） */
  carry: (S, R, xf, a) => CARRY_GEN[String(a.item)]?.(S, R, xf, v3(a.h), colors(a)),
  /** バケツの水面（持てる物の bucket と別の物。高さを動かす） */
  carryWater: (S, R, xf, a) => bucketWater(S, R, xf, v3(a.h)),
};

/** 持てる物の kind のうち、形の関数がある物 */
export const hasCarryShape = (item: string): boolean => item in CARRY_GEN;

/** 作り方を 1 つ実行する（無い種類は何もしない） */
export function runSpec(S: ShapeSink, spec: PropSpec): void {
  GEN[spec.kind]?.(S, new Rand(spec.seed), place(spec.o, spec.yaw, spec.s), spec.a);
}
