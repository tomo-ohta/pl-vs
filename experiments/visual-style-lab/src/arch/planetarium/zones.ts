import { onDrum } from './hall.ts';
import { DOORS, RING } from './layout.ts';
import { inLobby } from './outer.ts';

/**
 * 回廊（ホワイエ）の区画の決まり。回廊を 7.5° の柱の間（ベイ）48 に分け、ベイごとに種類を決める（どの階・どのベイにも同じ決まり）:
 * - entrance（客席への出入口のベイと両隣）: 扉の額縁・開いた扉・上の案内の箱と番号・誘導灯・壁の手すり・扉の前の床の象眼と光だまり
 * - exhibit（出入口の間の展示の区間）: 展示のケース・図の電飾の板・太陽系の模型（オーラリー）・吊った惑星・格天井とスポット
 * - rest（休む区間）: 作り付けの長椅子の小部屋・コインロッカー・水飲み・鉢植え・間接照明の帯・吊った灯り
 * - lobby（玄関ホールにかかるベイ）: 外の壁が無い（吹き抜けの縁）
 * 出入口の間の区間は、ドームの中心のまわりの順に [展示 A, 休む, 展示 B, 休む, 展示 C …] と交互にする
 */
export type BayZone = 'entrance' | 'exhibit' | 'rest' | 'lobby';

export const BAYS = 48;
export const BAY_DEG = 360 / BAYS;

export interface BayInfo {
  zone: BayZone;
  /** 区間の通し番号（展示の題を変える） */
  seg: number;
  /** 区間の中の位置（0 から）と区間のベイの数 */
  k: number;
  n: number;
  /** 出入口のベイなら、その扉の φ（度） */
  door?: number;
}

/** ベイの中心の φ（ラジアン） */
export function bayPhi(i: number): number {
  return ((i + 0.5) * BAY_DEG * Math.PI) / 180;
}

const cache = new Map<number, BayInfo[]>();

/** 階（1 = 平土間と同じ高さの回廊、2 = 2 階の回廊）のベイの一覧 */
export function bays(level: 1 | 2): BayInfo[] {
  const hit = cache.get(level);
  if (hit) return hit;
  const doors = level === 1 ? DOORS.ground : DOORS.upper;
  const rOut = level === 1 ? RING.r1 : RING.r2;
  const doorBay = doors.map((d) => Math.floor((((d % 360) + 360) % 360) / BAY_DEG));
  const base: { zone: BayZone; door?: number }[] = [];
  for (let i = 0; i < BAYS; i++) {
    const w = onDrum(rOut - 0.02, bayPhi(i), 0);
    const lob = inLobby(w[0], w[2], 1.0);
    const di = doorBay.findIndex((b) => b === i);
    const near = doorBay.some((b) => Math.min(Math.abs(b - i), BAYS - Math.abs(b - i)) <= 1);
    base.push({ zone: lob ? 'lobby' : near ? 'entrance' : 'exhibit', door: di >= 0 ? doors[di] : undefined });
    // 玄関ホールの中でも、扉のベイは額縁と案内を付ける（ドラムの面の側だけ）
    if (lob && di >= 0) base[i] = { zone: 'lobby', door: doors[di] };
  }
  // 出入口・玄関ホールの間の区間に番号を振り、交互に展示 / 休む
  const out: BayInfo[] = base.map((b) => ({ zone: b.zone, seg: -1, k: 0, n: 1, door: b.door }));
  // 区間の始まり（前のベイが区間でない所）から順に
  let start = out.findIndex((b, i) => b.zone === 'exhibit' && out[(i + BAYS - 1) % BAYS].zone !== 'exhibit');
  if (start < 0) start = 0;
  let seg = 0;
  for (let s = 0; s < BAYS; s++) {
    const i = (start + s) % BAYS;
    if (out[i].zone !== 'exhibit' || out[i].seg >= 0) continue;
    const run: number[] = [];
    for (let j = i; out[j % BAYS].zone === 'exhibit' && run.length < BAYS; j++) run.push(j % BAYS);
    const zone: BayZone = seg % 2 === 0 ? 'exhibit' : 'rest';
    run.forEach((j, k) => {
      out[j] = { ...out[j], zone, seg, k, n: run.length };
    });
    seg++;
  }
  cache.set(level, out);
  return out;
}

/** φ（ラジアン）のベイ */
export function bayAt(level: 1 | 2, phi: number): BayInfo {
  const deg = ((((phi * 180) / Math.PI) % 360) + 360) % 360;
  return bays(level)[Math.floor(deg / BAY_DEG) % BAYS];
}
