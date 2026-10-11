import type { V3 } from '../../../scenes/Builder.ts';
import type { V2 } from '../../../props/kit.ts';

/**
 * 小物の形の小さな道具（プールの小物で共通に使う）。
 */

/** 角の丸い箱の頼み方（面取りの段は 1。繰り返す小さな部品の三角形を増やしすぎない） */
export const R1 = (r: number): { r: number; seg: number } => ({ r, seg: 1 });

/**
 * 折れ線の角を丸めた点の列（管を曲げて作る: 手すり・はしご・パイプ椅子）。rad は曲げの半径のめやす。
 * まっすぐな所にも点を足して、曲線（Catmull-Rom）がふくらまないようにする
 */
export function bend(pts: V3[], rad: number): V3[] {
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
  const add = (a: V3, d: V3, k: number): V3 => [a[0] + d[0] * k, a[1] + d[1] * k, a[2] + d[2] * k];
  const corners: V3[][] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const da = sub(a, b);
    const dc = sub(c, b);
    const la = len(da);
    const lc = len(dc);
    const k = Math.min(rad, la * 0.45, lc * 0.45);
    const p1 = add(b, da, k / la);
    const p2 = add(b, dc, k / lc);
    const mid: V3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
    const m = add(mid, sub(b, mid), 0.42);
    corners.push([p1, m, p2]);
  }
  const out: V3[] = [pts[0]];
  const straight = (a: V3, b: V3): void => {
    const d = sub(b, a);
    for (const t of [0.34, 0.67]) out.push(add(a, d, t));
  };
  let prev = pts[0];
  for (const [p1, m, p2] of corners) {
    straight(prev, p1);
    out.push(p1, m, p2);
    prev = p2;
  }
  const last = pts[pts.length - 1];
  straight(prev, last);
  out.push(last);
  return out;
}

/** 角の丸い長方形の輪郭（反時計回り）。中心 c・幅 w・高さ h・角の半径 r */
export function roundRect(c: V2, w: number, h: number, r: number, n = 3): V2[] {
  const out: V2[] = [];
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const cs: [number, number, number][] = [
    [c[0] + w / 2 - rr, c[1] - h / 2 + rr, -Math.PI / 2],
    [c[0] + w / 2 - rr, c[1] + h / 2 - rr, 0],
    [c[0] - w / 2 + rr, c[1] + h / 2 - rr, Math.PI / 2],
    [c[0] - w / 2 + rr, c[1] - h / 2 + rr, Math.PI],
  ];
  for (const [x, y, a0] of cs) for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI / 2);
    out.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return out;
}

/** 弧の点（中心 c・半径 r・角度 a0 → a1） */
export function arc(c: V2, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

/** 輪郭の向きを逆に（穴は時計回り） */
export function cw(pts: V2[]): V2[] {
  return [...pts].reverse();
}
