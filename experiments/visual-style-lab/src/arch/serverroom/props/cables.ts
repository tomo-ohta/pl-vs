import type { Prop } from '../../../props/kit.ts';
import type { V3 } from '../../../scenes/Builder.ts';
import { PAL } from '../mats.ts';

/**
 * 床のケーブル（参考画像の床の黒い輪）。物の座標: 原点は床の上の輪の中心。
 */

/**
 * 床に置いたケーブルの輪（2〜4 巻きのゆるい輪と、ラックへ伸びる端）。輪は少しずつずれて重なる（参考画像の床の黒い線の輪）
 */
export function cableCoil(p: Prop, o: { r?: number; loops?: number; tail?: V3 | null; color?: string } = {}): void {
  const R = o.r ?? 0.35;
  const loops = o.loops ?? 3;
  const color = o.color ?? PAL.cable;
  const rad = 0.008;
  const pts: V3[] = [];
  const n = 18 * loops;
  for (let i = 0; i <= n; i++) {
    const t = i / 18;
    const a = t * Math.PI * 2;
    // 巻きごとに中心と半径が少しずれる（ゆるい輪）・平たい楕円
    const rr = R * (0.85 + 0.15 * Math.sin(t * 1.7 + 0.5)) * (1 + 0.08 * Math.floor(t));
    const cx = 0.06 * Math.sin(t * 0.9);
    const cz = 0.05 * Math.cos(t * 1.3);
    pts.push([cx + Math.cos(a) * rr * 1.25, rad + 0.002 + 0.006 * Math.abs(Math.sin(a * 2.0 + t)), cz + Math.sin(a) * rr * 0.75]);
  }
  p.tube(color, pts, rad, { radial: 5, seg: n * 2, shadow: false });
  // ラックへ伸びる端
  if (o.tail !== null) {
    const end = pts[pts.length - 1];
    const tail = o.tail ?? [R * 2.4, 0, -0.1];
    p.tube(color, [end, [(end[0] + tail[0]) / 2, rad + 0.002, (end[2] + tail[2]) / 2 + 0.08], [tail[0], tail[1] + rad + 0.002, tail[2]]], rad, { radial: 5, seg: 12, shadow: false });
  }
}

/** 床置きのケーブルダクト（ラックの前に沿う低い樋。蓋・継ぎ目・端の斜面）。長さは x の向き */
export function cableTrough(p: Prop, o: { len?: number; w?: number; h?: number; color?: string } = {}): void {
  const len = o.len ?? 2.0;
  const w = o.w ?? 0.26;
  const h = o.h ?? 0.16;
  const hl = len / 2;
  p.extrude(
    o.color ?? '#7fb0c2',
    [
      [-w / 2, 0],
      [w / 2, 0],
      [w / 2 - 0.05, h],
      [-w / 2 + 0.05, h],
    ],
    'zy',
    -hl,
    hl,
    { bevel: 0.006 },
  );
  // 蓋の継ぎ目（0.5 m ごと）と端の口
  for (let x = -hl + 0.5; x < hl; x += 0.5) p.box(PAL.black, [x - 0.004, h - 0.002, -w / 2 + 0.05], [x + 0.004, h + 0.003, w / 2 - 0.05], { shadow: false });
  p.box(PAL.black, [-hl - 0.002, 0.02, -w / 2 + 0.06], [-hl + 0.002, h - 0.03, w / 2 - 0.06], { shadow: false });
  // 端から出るケーブル
  p.tube(PAL.cable, [[-hl, 0.05, 0], [-hl - 0.15, 0.012, 0.05], [-hl - 0.35, 0.01, 0.0]], 0.01, { radial: 5, seg: 10, shadow: false });
}
