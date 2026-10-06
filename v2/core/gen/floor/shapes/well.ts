/**
 * 階段室（骨組みの kind 'well'）: 階をまたぐ折り返し階段の、背の高い 1 つの区画（縦に積んだビル・エレベーターホール・立体交差）。
 *
 * 形（流れの向き a・外向き o。手前の行の階段室なら a = z・o = +1）:
 *   踊り場（各階の床。区画の中心線の上・奥行き LD）→ 左半分を外へ上る段（半階）→ 折り返しの踊り場（半階）→ 右半分を内へ上る段 →
 *   1 つ上の階の踊り場（下の階の踊り場の真上）。左右の段の間は壁（飛び移れない）。いちばん上の階の踊り場の脇には手すり
 * - 各階の出入り口は踊り場の横の壁（中心線の上）か、踊り場の奥の壁（内向きのつなぎ）。開口の大きさは扉 1 枚分（防火扉）
 * - 段は浮いた板（厚さ 0.25 m）。下の階の段の上を、上の階の段が通る（階の高さ分あく）
 * - いちばん下の階の右半分（下りの段の下）は塞ぐ（頭をぶつける低い所に入らない）
 * 高さ: 区画の床はいちばん下の階の床、天井はいちばん上の階の床 + hc
 */
import type { Rng } from '../../../math/rng.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type Box, type CellLayout } from '../../../world/layout.ts';
import type { Skeleton, SkelNode } from '../skeleton.ts';
import { famOf, RISER_MAX, snap, TREAD, type GeoBuild, type Placed } from '../geometry.ts';

/** 階段室の寸法 */
export const WELL = {
  /** 横の幅（m。段 2 列 + 間の壁 + 外壁） */
  width: 3.2,
  /** 各階の踊り場の奥行き（m。扉の前に立てる） */
  landing: 2.0,
  /** 折り返しの踊り場の奥行き（m） */
  mid: 1.3,
  /** 段の板の厚さ */
  slab: 0.25,
} as const;

export interface WellEnv { x: number; z: number; S: number; SH: number; top: number; bottom: number; hc: number; rng: Rng }

/** 階段室の向き: 外周のどの辺にあるか（段は外へ伸びる） */
export function wellAxis(sk: Skeleton, n: SkelNode): { a: 'x' | 'z'; o: 1 | -1 } {
  if (n.row === 0) return { a: 'z', o: 1 };
  if (n.row === sk.rows - 1) return { a: 'z', o: -1 };
  if (n.col === 0) return { a: 'x', o: -1 };
  return { a: 'x', o: 1 };
}

/** 階段室の段の数（半階ごと） */
export function wellSteps(SH: number): number {
  return Math.ceil(SH / 2 / RISER_MAX - 1e-9);
}

export function buildWell(g: GeoBuild, sk: Skeleton, n: SkelNode, members: SkelNode[], e: WellEnv): Placed {
  const { a, o } = wellAxis(sk, n);
  const steps = wellSteps(e.SH);
  const run = steps * TREAD;
  const LD = WELL.landing, W = WELL.width;
  const ca = a === 'z' ? e.z : e.x, cl = a === 'z' ? e.x : e.z;
  const inner = ca - o * (LD / 2), outer = ca + o * (LD / 2 + run + WELL.mid);
  const rect: Rect = a === 'z'
    ? { x0: snap(cl - W / 2), x1: snap(cl + W / 2), z0: snap(Math.min(inner, outer)), z1: snap(Math.max(inner, outer)) }
    : { x0: snap(Math.min(inner, outer)), x1: snap(Math.max(inner, outer)), z0: snap(cl - W / 2), z1: snap(cl + W / 2) };
  const yBottom = -e.bottom * e.SH, yTop = -e.top * e.SH;
  const hcw = Math.max(e.hc, 2.7);
  const id = `well${n.well ?? n.id}`;
  const f = famOf(g.p, n);
  const pl: Placed = {
    node: n, rect, y: yBottom, height: snap(yTop - yBottom + hcw), theme: 'CorridorService', kind: 'stairs', cellId: id, fam: f,
    opts: { name: '階段室', audio: '換気・反響', role: 'connector', lights: 'none' },
    post: [(cell) => wellBoxes(cell, { a, o, ca, cl, steps, run, yBottom, yTop, SH: e.SH, hcw, rail: g.t['structure.railM'] })],
  };
  // 中身（家具）は置かない（段の前を塞がない）。手すりは区画の中身（dressStairs）が段に沿って付ける
  g.keep(id, { min: [rect.x0, yBottom - 0.1, rect.z0], max: [rect.x1, yTop + hcw, rect.z1] });
  void members;
  return pl;
}

interface WellShape { a: 'x' | 'z'; o: 1 | -1; ca: number; cl: number; steps: number; run: number; yBottom: number; yTop: number; SH: number; hcw: number; rail: number }

/** 段・踊り場・間の壁・照明（区画を作った後に足す） */
function wellBoxes(cell: CellLayout, w: WellShape): void {
  const { a, o, ca, cl, steps, run, yBottom, yTop, SH } = w;
  const LD = WELL.landing, W = WELL.width, T = WELL.slab;
  const pal = cell.palette;
  const riser = SH / 2 / steps;
  // 流れの向きの座標（踊り場の中心から外へ d）→ 区画の座標。横は l（中心から）
  const A = (d: number): number => ca + o * d;
  const put = (d0: number, d1: number, l0: number, l1: number, y0: number, y1: number, mat: Box['mat'], kind?: string, solid = true): void => {
    const p = Math.min(A(d0), A(d1)), q = Math.max(A(d0), A(d1));
    const b = a === 'z' ? box([cl + l0, y0, p], [cl + l1, y1, q], mat, solid) : box([p, y0, cl + l0], [q, y1, cl + l1], mat, solid);
    if (kind) b.kind = kind;
    cell.boxes.push(b);
  };
  // 左右の半分（外を向いて左が上り）。横の座標の向きは、流れの向きと外向きで決まる
  const half = W / 2 - WALL_T;
  const left: [number, number] = [-half, -0.06], right: [number, number] = [0.06, half];
  const nStories = Math.round((yTop - yBottom) / SH);
  for (let k = 0; k < nStories; k++) {
    const yLo = yBottom + k * SH, yHi = yLo + SH, yMid = yLo + SH / 2;
    // 上り（左）: 踊り場の端から外へ
    for (let i = 1; i <= steps; i++) {
      const top = yLo + i * riser;
      put(LD / 2 + (i - 1) * TREAD, LD / 2 + i * TREAD, left[0], left[1], Math.max(yLo, top - T), top, pal.floor, 'stairStep');
    }
    // 折り返しの踊り場
    put(LD / 2 + run, LD / 2 + run + WELL.mid - WALL_T, -half, half, yMid - T, yMid, pal.floor, 'landing');
    // 上り（右）: 折り返しから内へ
    for (let i = 1; i <= steps; i++) {
      const top = yMid + i * riser;
      put(LD / 2 + run - i * TREAD, LD / 2 + run - (i - 1) * TREAD, right[0], right[1], top - T, top, pal.floor, 'stairStep');
    }
    // 上の階の踊り場
    put(-LD / 2 + WALL_T, LD / 2, -half, half, yHi - 0.2, yHi, pal.floor, 'landing');
    // 踊り場の照明（上の踊り場の裏）
    cell.lights.push({ pos: a === 'z' ? [cl, yHi - 0.6, A(0)] : [A(0), yHi - 0.6, cl], color: pal.lightColor, intensity: pal.lightIntensity * 0.8, distance: 6 });
    put(-0.3, 0.3, -0.3, 0.3, yHi - 0.24, yHi - 0.2, pal.light, undefined, false);
    // 折り返しの踊り場の壁の灯り
    cell.lights.push({ pos: a === 'z' ? [cl, yMid + 1.8, A(LD / 2 + run + WELL.mid * 0.5)] : [A(LD / 2 + run + WELL.mid * 0.5), yMid + 1.8, cl], color: pal.lightColor, intensity: pal.lightIntensity * 0.5, distance: 5 });
  }
  // 左右の段の間の壁（飛び移れない）
  put(LD / 2, LD / 2 + run, -0.06, 0.06, yBottom, yTop + w.hcw, pal.wall);
  // いちばん下の階の下り段の下を塞ぐ
  put(LD / 2, LD / 2 + run, right[0], right[1], yBottom, yBottom + SH / 2 - 0.35, pal.wall);
  // いちばん上の階の踊り場の脇（左半分の先は下の階の段まで落ちる）に手すり
  put(LD / 2, LD / 2 + 0.06, left[0], left[1], yTop, yTop + w.rail, 'metal');
  // いちばん上の階の天井の照明
  cell.lights.push({ pos: a === 'z' ? [cl, yTop + w.hcw - 0.4, A(0)] : [A(0), yTop + w.hcw - 0.4, cl], color: pal.lightColor, intensity: pal.lightIntensity * 0.8, distance: 6 });
  put(-0.3, 0.3, -0.3, 0.3, yTop + w.hcw - 0.04, yTop + w.hcw - 0.005, pal.light, undefined, false);
}
