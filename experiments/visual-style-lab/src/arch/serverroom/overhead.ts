import type { Prop } from '../../props/kit.ts';
import type { V3 } from '../../scenes/Builder.ts';
import { NORTH, SOUTH, type RoomSpec } from './layout.ts';
import { PAL } from './mats.ts';

/**
 * 天井まわりの設備（サーバー室の上の空間。参考画像の上半分の情報量の大半）。
 * - はしご形のケーブルラック（側の桁 + 0.3 m ごとの桟）と、中に積んだケーブルの塊
 * - 吊りボルト（全ねじの棒）・電源のバスダクト・天井から吊った箱（分岐の箱・空調の吹き出し・ファンコイル）
 * - ラックへ下りるケーブル・ラックの上で垂れたケーブルのたるみ（カーテンのような束）
 * 物の座標は場面の座標（Prop は部屋の原点に置いた座標系）。
 */

/** z の向きに伸びるはしご形のケーブルラック（中心 x・高さ y・z0〜z1・幅 w） */
export function ladderZ(p: Prop, x: number, y: number, z0: number, z1: number, w: number, o: { load?: number; rungs?: number } = {}): void {
  const hw = w / 2;
  const rail = 0.09;
  p.box(PAL.trayHi, [x - hw, y, z0], [x - hw + 0.02, y + rail, z1], { shadow: false });
  p.box(PAL.trayHi, [x + hw - 0.02, y, z0], [x + hw, y + rail, z1], { shadow: false });
  const step = o.rungs ?? 0.3;
  for (let z = z0 + step / 2; z < z1; z += step) p.box(PAL.tray, [x - hw + 0.02, y, z - 0.012], [x + hw - 0.02, y + 0.018, z + 0.012], { shadow: false });
  // 中のケーブルの塊（角の丸い低い箱を、長さを分けて少しずつ高さを変える）
  const load = o.load ?? 0.6;
  if (load > 0) {
    for (let z = z0; z < z1 - 0.2; z += 1.2 + p.r() * 0.8) {
      const len = Math.min(z1 - z, 1.0 + p.r() * 1.6);
      const h = 0.04 + load * (0.05 + p.r() * 0.05);
      p.box(PAL.cable, [x - hw + 0.04, y + 0.018, z], [x + hw - 0.04, y + 0.018 + h, z + len], { r: Math.min(0.03, h / 2 - 0.001), shadow: false });
    }
  }
}

/** x の向きに伸びるはしご形のケーブルラック（渡り） */
export function ladderX(p: Prop, z: number, y: number, x0: number, x1: number, w: number): void {
  const hw = w / 2;
  p.box(PAL.trayHi, [x0, y, z - hw], [x1, y + 0.08, z - hw + 0.02], { shadow: false });
  p.box(PAL.trayHi, [x0, y, z + hw - 0.02], [x1, y + 0.08, z + hw], { shadow: false });
  for (let x = x0 + 0.15; x < x1; x += 0.3) p.box(PAL.tray, [x - 0.012, y, z - hw + 0.02], [x + 0.012, y + 0.018, z + hw - 0.02], { shadow: false });
  p.box(PAL.cable, [x0 + 0.1, y + 0.018, z - hw + 0.05], [x1 - 0.1, y + 0.06, z + hw - 0.05], { r: 0.015, shadow: false });
}

/** 吊りボルト（天井から下の物まで） */
export function rod(p: Prop, x: number, z: number, y0: number, y1: number): void {
  p.box(PAL.steelDark, [x - 0.006, y0, z - 0.006], [x + 0.006, y1, z + 0.006], { shadow: false });
}

/** 垂れたケーブル（a から b へ、真ん中が sag だけ下がる。曲線の管） */
export function sagCable(p: Prop, a: V3, b: V3, sag: number, r: number, color: string = PAL.cable): void {
  const pts: V3[] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = 4 * t * (1 - t);
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * s, a[2] + (b[2] - a[2]) * t]);
  }
  p.tube(color, pts, r, { radial: 5, seg: 16, shadow: false });
}

/** 天井から吊った箱（分岐の箱・機器）。側面に点検の蓋の線 */
export function hangBox(p: Prop, c: V3, s: V3, color: string, ceil: number): void {
  const [x, y, z] = c;
  p.box(color, [x - s[0] / 2, y - s[1] / 2, z - s[2] / 2], [x + s[0] / 2, y + s[1] / 2, z + s[2] / 2], { r: 0.01, shadow: false });
  p.box(PAL.black, [x - s[0] / 2 - 0.002, y - s[1] / 2 + 0.03, z - s[2] / 2 + 0.03], [x + s[0] / 2 + 0.002, y - s[1] / 2 + 0.036, z + s[2] / 2 - 0.03], { shadow: false });
  rod(p, x - s[0] / 2 + 0.05, z, y + s[1] / 2, ceil);
  rod(p, x + s[0] / 2 - 0.05, z, y + s[1] / 2, ceil);
}

/** 1 室の天井まわり */
export function overhead(p: Prop, r: RoomSpec, rowEnds: { n: number; s: number }): void {
  const ceil = r.ceil;
  const H = r.rackH;
  const zN = rowEnds.n;
  const zS = rowEnds.s;
  for (const side of [-1, 1]) {
    const xf = r.cx + (side * r.aisle) / 2;
    const xm = xf + side * r.depth * 0.5;
    const xb = xf + side * r.depth;
    // 列の上: 通信のはしご形ラック（低い）と電源のバスダクト（高い・背の側）
    const ty = Math.min(H + 0.32, ceil - 0.5);
    ladderZ(p, xm - side * 0.12, ty, zN, zS, 0.5, { load: r.id === 'C' ? 0.9 : 0.7 });
    p.box(PAL.duct, [xb - side * 0.28 - 0.09, ceil - 0.42, zN], [xb - side * 0.28 + 0.09, ceil - 0.3, zS], { r: 0.01, shadow: false });
    for (let z = zN + 0.6; z < zS; z += 1.8) {
      rod(p, xm - side * 0.12 - 0.27, z, ty, ceil);
      rod(p, xm - side * 0.12 + 0.27, z, ty, ceil);
      // バスダクトの差し込みの箱（ラックの上へ下りる電源）
      if (r.id !== 'A') {
        p.box(PAL.box, [xb - side * 0.28 - 0.12, ceil - 0.62, z - 0.12], [xb - side * 0.28 + 0.12, ceil - 0.42, z + 0.12], { r: 0.01, shadow: false });
        p.tube(PAL.cable, [[xb - side * 0.28, ceil - 0.62, z], [xb - side * 0.28, H + 0.3, z + 0.05], [xb - side * 0.3, H + 0.01, z + 0.1]], 0.018, { radial: 5, seg: 10, shadow: false });
      }
    }
    // ラックへ下りるケーブル（ラックラックからラックの天板の口へ。2〜4 本の束）
    for (let z = zN + 0.3; z < zS; z += 0.6) {
      if (p.r() < 0.3) continue;
      const k = 2 + Math.floor(p.r() * 3);
      for (let i = 0; i < k; i++) {
        const x0 = xm - side * 0.12 + (p.r() - 0.5) * 0.3;
        const z0 = z + (p.r() - 0.5) * 0.3;
        const xr = xf + side * (0.25 + p.r() * 0.15);
        p.tube(PAL.cable, [[x0, ty + 0.05, z0], [x0 + (xr - x0) * 0.5, ty - 0.02 - p.r() * 0.08, z0 + 0.04], [xr, H + 0.005, z0 + 0.06]], 0.008 + p.r() * 0.006, { radial: 4, seg: 8, shadow: false });
      }
    }
    // B: 通路の縁の上に吊った設備の塊（serverroom-0 の天井: 箱の積み重ね・垂れたケーブルの輪・下りる電線管・低いケーブルラック）
    if (r.id === 'B') clutterB(p, r, side as 1 | -1, zN, zS);
    // A: 天井の高いラックから、通路の縁でカーテンのように垂れたケーブル（参考画像 serverroom-2 の上）
    if (r.id === 'A') {
      const hy = ceil - 0.15;
      ladderZ(p, xf - side * 0.15, hy - 0.05, zN, zS, 0.4, { load: 0.4 });
      for (let z = zN + 0.2; z < zS - 0.4; z += 0.35 + p.r() * 0.25) {
        const span = 0.5 + p.r() * 1.4;
        const sag = 0.25 + p.r() * 0.6;
        const xx = xf - side * (0.05 + p.r() * 0.25);
        const n = 2 + Math.floor(p.r() * 4);
        for (let i = 0; i < n; i++) {
          const dx = (p.r() - 0.5) * 0.12;
          sagCable(p, [xx + dx, hy, z], [xx + dx + side * p.r() * 0.15, hy, z + span], sag * (0.8 + p.r() * 0.4), 0.007 + p.r() * 0.005);
        }
      }
      // ファンコイル（白い箱）
      for (let z = zN + 1.4; z < zS; z += 4.2) hangBox(p, [xb - side * 0.2, ceil - 0.35, z], [0.9, 0.35, 0.7], PAL.boxPale, ceil);
    }
  }
  // 通路を横切る渡りのラック
  const ty = Math.min(H + 0.32, ceil - 0.5);
  for (let z = zN + 1.5; z < zS; z += 3.6) {
    ladderX(p, z, ty + 0.12, r.cx - r.aisle / 2 - r.depth * 0.5, r.cx + r.aisle / 2 + r.depth * 0.5, 0.3);
  }
  // C: 通路の真上の幅の広いはしご形のラック（参考画像 serverroom-1 の上の灰色の格子）
  if (r.id === 'C') {
    ladderZ(p, r.cx - 0.68, ceil - 0.42, NORTH + 0.6, SOUTH - 0.6, 0.95, { load: 0.0, rungs: 0.35 });
    for (let z = NORTH + 1.2; z < SOUTH; z += 1.8) {
      rod(p, r.cx - 0.68 - 0.49, z, ceil - 0.42, ceil);
      rod(p, r.cx - 0.68 + 0.49, z, ceil - 0.42, ceil);
    }
  }
}

/**
 * B の天井の設備の塊（通路の縁の上 x ±0.55〜1.5・高さ 2.25〜2.9）。0.5〜0.9 m ごとに、箱の積み重ね・垂れたケーブルの輪・
 * 下りる電線管のどれかを置き、縁に沿って低いケーブルラックを通す。通路の中心（器具の列）は空ける
 */
function clutterB(p: Prop, r: RoomSpec, side: 1 | -1, zN: number, zS: number): void {
  const ceil = r.ceil;
  const H = r.rackH;
  const COLS = ['#2a6c88', '#3a86a4', '#1f5670', '#2f7896', '#4a96b0'];
  // 縁に沿う低いケーブルラック（束を載せる）
  ladderZ(p, side * 0.95, 2.72, zN, zS, 0.36, { load: 0.8 });
  for (let z = zN + 0.4; z < zS; z += 1.2) {
    rod(p, side * 0.77, z, 2.72, ceil);
    rod(p, side * 1.13, z, 2.72, ceil);
  }
  // 天井に近い細いケーブルラック（器具の列の脇）と、そこから垂れる束・小さな箱
  ladderZ(p, side * 0.48, 2.86, zN, zS, 0.26, { load: 0.9 });
  for (let z = zN + 0.2; z < zS - 0.4; z += 0.7 + p.r() * 0.9) {
    if (p.r() < 0.5) {
      const n = 2 + Math.floor(p.r() * 3);
      const span = 0.3 + p.r() * 0.6;
      for (let k = 0; k < n; k++) sagCable(p, [side * (0.42 + k * 0.03), 2.87, z], [side * (0.5 + k * 0.03), 2.87, z + span], 0.12 + p.r() * 0.3, 0.006 + p.r() * 0.004);
    } else {
      const s: V3 = [0.18 + p.r() * 0.2, 0.1 + p.r() * 0.12, 0.2 + p.r() * 0.3];
      const x = side * (0.5 + p.r() * 0.15);
      p.box(COLS[Math.floor(p.r() * COLS.length)], [x - s[0] / 2, 2.86 - s[1], z - s[2] / 2], [x + s[0] / 2, 2.86, z + s[2] / 2], { r: 0.006, shadow: false });
    }
  }
  let i = 0;
  for (let z = zN + 0.3; z < zS - 0.3; z += 0.5 + p.r() * 0.4) {
    const pick = (i++ + Math.floor(p.r() * 3)) % 4;
    if (pick === 0 || pick === 1) {
      // 箱の積み重ね（上ほど小さい。天井から吊る）
      let y = 2.25 + p.r() * 0.25;
      const n = 1 + Math.floor(p.r() * 3);
      const x = side * (0.75 + p.r() * 0.6);
      for (let k = 0; k < n && y < ceil - 0.1; k++) {
        const s: V3 = [0.25 + p.r() * 0.4, 0.12 + p.r() * 0.2, 0.25 + p.r() * 0.45];
        const col = COLS[Math.floor(p.r() * COLS.length)];
        p.box(col, [x - s[0] / 2, y, z - s[2] / 2], [x + s[0] / 2, y + s[1], z + s[2] / 2], { r: 0.008, shadow: false });
        // 前の面の点検の蓋の線と小さな表示
        p.box('#123848', [x - s[0] / 2 + 0.02, y + s[1] * 0.3, z + s[2] / 2], [x + s[0] / 2 - 0.02, y + s[1] * 0.34, z + s[2] / 2 + 0.003], { shadow: false });
        if (p.r() < 0.4) p.box(PAL.led, [x - 0.02, y + s[1] * 0.6, z + s[2] / 2], [x + 0.01, y + s[1] * 0.6 + 0.015, z + s[2] / 2 + 0.004], { kind: 'glow', shadow: false });
        y += s[1] + 0.02;
      }
      rod(p, x, z, y, ceil);
    } else if (pick === 2) {
      // 垂れたケーブルの輪（低いラックから列の天板へ・3〜6 本）
      const n = 3 + Math.floor(p.r() * 4);
      const span = 0.4 + p.r() * 0.7;
      for (let k = 0; k < n; k++) {
        const x0 = side * (0.85 + p.r() * 0.2);
        sagCable(p, [x0, 2.74, z + k * 0.02], [side * (1.05 + p.r() * 0.3), H + 0.02, z + span + k * 0.03], 0.18 + p.r() * 0.35, 0.007 + p.r() * 0.006, p.r() < 0.3 ? PAL.cableBlue : PAL.cable);
      }
    } else {
      // 下りる電線管（天井から列の天板へ。2〜3 本）と途中の分岐の箱
      const x = side * (1.0 + p.r() * 0.3);
      for (let k = 0; k < 2 + Math.floor(p.r() * 2); k++) p.box('#5f9fb2', [x + k * 0.05, H, z - 0.012], [x + k * 0.05 + 0.024, ceil, z + 0.012], { shadow: false });
      p.box('#2f7896', [x - 0.06, 2.45, z - 0.1], [x + 0.18, 2.62, z + 0.1], { r: 0.008, shadow: false });
    }
  }
}
