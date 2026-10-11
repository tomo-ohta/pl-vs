import type * as THREE from 'three';
import type { LBox } from './author.ts';
import { cqBox, type Env } from './env.ts';
import type { Frame } from './frame.ts';
import { seenFromViews } from './frontage.ts';

/**
 * 天井と張り出しの下（決まり）: 歩廊から見上げる面を 1 枚の平らな板にしない。
 * - 回廊の天井: 柱の列ごとの梁（柱から奥の壁まで）と、奥の壁ぎわの通しの梁（打ち放しの梁の下面に型枠の目地）
 * - 積んだ箱の張り出しの下: 1.2 m ごとのリブと、先端の縁の梁
 * 参考画像の視点から近くに見える所には付けない（near m）
 */

/** 回廊の梁: 局所の x の範囲（柱の外の面 → 奥の壁）、柱の z（柱の手前の面 z1 と奥の面 z0）、天井の下面 y、梁の背 depth */
export function colonnadeBeams(
  env: Env,
  f: Frame,
  m: THREE.Material,
  o: { x0: number; x1: number; cols: [number, number][]; y: number; depth?: number; near?: number; avoid?: LBox[]; wallX?: number },
): void {
  const d = o.depth ?? 0.45;
  const near = o.near ?? 40;
  const hit = (b: LBox): boolean => (o.avoid ?? []).some((a) => [0, 1, 2].every((i) => a.max[i] > b.min[i] + 0.01 && a.min[i] < b.max[i] - 0.01));
  const put = (b: LBox): void => {
    if (hit(b)) return;
    const w = f.box(b.min, b.max);
    if (seenFromViews(w.min, w.max, near)) return;
    cqBox(env.b, m, w.min, w.max, { shadow: true });
  };
  const xa = Math.min(o.x0, o.x1);
  const xb = Math.max(o.x0, o.x1);
  for (const [z0, z1] of o.cols) put({ min: [xa, o.y - d, z0 - 0.02], max: [xb, o.y, z1 + 0.02] });
  // 柱と柱の間に小梁（2 本の梁の真ん中。背は半分）
  const zs = [...o.cols].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i + 1 < zs.length; i++) {
    const zm = (zs[i][1] + zs[i + 1][0]) / 2;
    if (zs[i + 1][0] - zs[i][1] < 2.5) continue;
    put({ min: [xa, o.y - d * 0.5, zm - 0.12], max: [xb, o.y, zm + 0.12] });
  }
  // 奥の壁ぎわの通しの梁（壁から 0.4 m）
  if (o.wallX !== undefined) {
    const wx = o.wallX;
    const s = wx < (xa + xb) / 2 ? 1 : -1;
    const z0 = Math.min(...o.cols.map((c) => c[0]));
    const z1 = Math.max(...o.cols.map((c) => c[1]));
    for (let z = z0; z < z1; z += 6) put({ min: [Math.min(wx, wx + s * 0.4), o.y - 0.3, z], max: [Math.max(wx, wx + s * 0.4), o.y, Math.min(z + 6, z1)] });
  }
}

/**
 * 積んだ箱の張り出しの下のリブと縁の梁。blocks は決まりで積んだ箱（局所）、X は壁の面、side は壁の向き（'L' は +x へ出る）。
 * 張り出しの下端が yMin〜yMax の箱だけ（歩廊から見上げる高さ）
 */
export function overhangRibs(env: Env, f: Frame, mat: (b: LBox) => THREE.Material, blocks: LBox[], X: number, side: 'L' | 'R', o: { yMin?: number; yMax?: number; near?: number } = {}): void {
  const s = side === 'L' ? 1 : -1;
  const yMin = o.yMin ?? 2.5;
  const yMax = o.yMax ?? 16;
  const big = blocks.filter((b) => b.max[1] - b.min[1] > 1.5);
  for (const b of big) {
    const y = b.min[1];
    if (y < yMin || y > yMax) continue;
    const face = s > 0 ? b.max[0] : b.min[0];
    // 真下の箱の面（張り出しの付け根）
    let base = X;
    for (const c of big) {
      if (c === b || c.max[1] < y - 0.4 || c.max[1] > y + 0.02 || c.max[2] <= b.min[2] || c.min[2] >= b.max[2]) continue;
      const cf = s > 0 ? c.max[0] : c.min[0];
      base = s > 0 ? Math.max(base, cf) : Math.min(base, cf);
    }
    const span = (face - base) * s;
    if (span < 0.8) continue;
    const all = f.box([Math.min(base, face), y - 0.4, b.min[2]], [Math.max(base, face), y, b.max[2]]);
    if (seenFromViews(all.min, all.max, o.near ?? 40)) continue;
    const m = mat(b);
    const put = (bx: LBox): void => {
      const w = f.box(bx.min, bx.max);
      cqBox(env.b, m, w.min, w.max, { shadow: true });
    };
    const xa = Math.min(base, face - s * 0.3);
    const xb = Math.max(base, face - s * 0.3);
    for (let z = b.min[2] + 0.6; z < b.max[2] - 0.3; z += 1.2) put({ min: [xa, y - 0.22, z - 0.07], max: [xb, y, z + 0.07] });
    // 先端の縁の梁（下へ 0.35 m）
    const ea = Math.min(face, face - s * 0.3);
    const eb = Math.max(face, face - s * 0.3);
    put({ min: [ea, y - 0.35, b.min[2] + 0.02], max: [eb, y, b.max[2] - 0.02] });
  }
}

/**
 * 手で置いた張り出しの下面のリブ（歩廊の上へ低く張り出す箱）。リブは局所の x の向き（歩廊を横切る）に 1.2 m ごと、
 * 水の側の縁（edgeX）に縁の梁。x0〜x1 は歩廊の上の範囲
 */
export function undersideRibs(env: Env, f: Frame, m: THREE.Material, o: { x0: number; x1: number; z0: number; z1: number; y: number; edgeX?: number; near?: number }): void {
  const near = o.near ?? 40;
  const put = (min: [number, number, number], max: [number, number, number]): void => {
    const w = f.box(min, max);
    if (seenFromViews(w.min, w.max, near)) return;
    cqBox(env.b, m, w.min, w.max, { shadow: true });
  };
  for (let z = o.z0 + 0.6; z < o.z1 - 0.3; z += 1.2) put([o.x0, o.y - 0.24, z - 0.08], [o.x1, o.y, z + 0.08]);
  if (o.edgeX !== undefined) put([Math.min(o.edgeX, o.edgeX - 0.35), o.y - 0.4, o.z0], [Math.max(o.edgeX, o.edgeX - 0.35), o.y, o.z1]);
}
