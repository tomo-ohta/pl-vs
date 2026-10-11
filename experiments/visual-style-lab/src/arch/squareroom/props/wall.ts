import type { V3 } from '../../../scenes/Builder.ts';
import type { Prop } from '../../../props/kit.ts';
import { roundRect, shade } from '../../../props/kit.ts';
import { SC, SG } from './mats.ts';

/**
 * 歩廊の壁の設備（写っていない所の壁の中くらいの形）。どれも壁の面 z = 0 から +z へ出る。床 y = 0。
 * 電線管と継ぎ箱・竪樋・壁のはしご（背かご）・計器の箱・係船柱・窓の格子・番号の札
 */

/**
 * 電線管: 壁に沿って x の向きに長さ L（中心が原点）、高さ y。留め金具 1.2 m ごと、継ぎ箱 boxEvery ごと。
 * drops の x の継ぎ箱からは、下のスイッチの箱（1.4 m）まで縦の管を下ろす
 */
export function conduitRun(p: Prop, L: number, y: number, o: { boxEvery?: number; drops?: number[]; r?: number } = {}): void {
  const r = o.r ?? 0.024;
  const z = 0.045;
  p.rod(SC.steel, [-L / 2, y, z], [L / 2, y, z], r, { shadow: 'receive', radial: 6 });
  for (let x = -L / 2 + 0.3; x < L / 2; x += 1.2) p.box(SC.steelDark, [x - 0.02, y - r - 0.012, 0], [x + 0.02, y + r + 0.012, z + r + 0.008], { shadow: 'receive' });
  const every = o.boxEvery ?? 4.8;
  for (let x = -L / 2 + every / 2; x < L / 2 - 0.2; x += every) {
    p.box(SC.paintPale, [x - 0.11, y - 0.12, 0], [x + 0.11, y + 0.12, 0.1], { r: 0.008 });
    p.box(shade(SC.paintPale, -0.12), [x - 0.12, y - 0.13, 0.085], [x + 0.12, y + 0.13, 0.105], { r: 0.006, shadow: 'receive' });
  }
  for (const x of o.drops ?? []) {
    p.rod(SC.steel, [x, y - 0.12, z], [x, 1.55, z], r * 0.8, { shadow: 'receive', radial: 6 });
    p.box(SC.paintPale, [x - 0.07, 1.3, 0], [x + 0.07, 1.55, 0.07], { r: 0.008, shadow: 'receive' });
    p.box(SC.steelDark, [x - 0.015, 1.4, 0.07], [x + 0.015, 1.46, 0.09], { shadow: 'receive' });
  }
}

/** 竪樋（上の箱から下りる雨の管）: 上の集水器・1.8 m ごとの留め金具・下の曲がり（水の方へ吐く）。top は管の上端 */
export function downpipe(p: Prop, top: number, o: { r?: number; color?: string } = {}): void {
  const r = o.r ?? 0.055;
  const c = o.color ?? SC.steel;
  const z = 0.11;
  // 集水器（上が広い箱）と、壁から出る呑み口
  p.box(c, [-0.16, top - 0.05, 0.01], [0.16, top + 0.22, 0.26], { r: 0.01 });
  p.box(shade(c, -0.15), [-0.17, top + 0.2, 0.0], [0.17, top + 0.24, 0.27], { shadow: 'receive' });
  p.cyl(c, [0, top - 0.12, z], r * 0.9, 0.18, { radiusTop: r * 1.6, seg: 10, shadow: 'receive' });
  p.rod(c, [0, 0.32, z], [0, top - 0.2, z], r, { radial: 10 });
  for (let y = 1.0; y < top - 0.4; y += 1.8) {
    p.torus(SC.steelDark, [0, y, z], r + 0.008, 0.009, { axis: 'y', seg: 14, radial: 4, shadow: 'receive' });
    p.box(SC.steelDark, [-0.012, y - 0.012, 0], [0.012, y + 0.012, z - r], { shadow: 'receive' });
  }
  // 下の曲がり（シュー）
  p.bend(c, [[0, 0.4, z], [0, 0.14, z], [0, 0.08, z + 0.22]], r, 0.08, { radial: 10 });
}

/** 壁のはしご（背かご付き）: 縦の桁 2 本・踏み桟 0.3 m ごと・壁への腕 1.5 m ごと・2.4 m より上に背かごの輪と縦の帯。h は上端 */
export function catLadder(p: Prop, h: number, bottom = 0.3): void {
  const w = 0.22;
  const z = 0.2;
  for (const x of [-w, w]) {
    p.rod(SC.steel, [x, bottom, z], [x, h, z], 0.022, { radial: 6 });
    for (let y = bottom + 0.4; y < h; y += 1.5) p.box(SC.steelDark, [x - 0.015, y - 0.02, 0], [x + 0.015, y + 0.02, z], { shadow: 'receive' });
  }
  for (let y = bottom + 0.25; y < h - 0.05; y += 0.3) p.rod(SC.steel, [-w, y, z], [w, y, z], 0.014, { radial: 5, shadow: 'receive' });
  if (h - bottom > 3) {
    const R = 0.36;
    for (let y = bottom + 2.4; y < h; y += 0.9) {
      const pts: V3[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;
        pts.push([Math.cos(a) * R, y, z + Math.sin(a) * R * 1.4]);
      }
      p.tube(SC.steel, pts, 0.012, { radial: 5, seg: 12, shadow: 'receive' });
    }
    for (const a of [0.35, Math.PI / 2, Math.PI - 0.35]) p.rod(SC.steel, [Math.cos(a) * R, bottom + 2.4, z + Math.sin(a) * R * 1.4], [Math.cos(a) * R, h, z + Math.sin(a) * R * 1.4], 0.01, { radial: 4, shadow: 'receive' });
  }
}

/** 計器の箱（電気のメーター・分電盤）: 鉄の箱・扉の合わせ目・小窓・羽根・掛け金。下端 y0 */
export function meterCabinet(p: Prop, y0 = 0.9, w = 0.55, h = 0.75): void {
  const d = 0.22;
  p.box(SC.paintPale, [-w / 2, y0, 0], [w / 2, y0 + h, d], { r: 0.012 });
  p.box(shade(SC.paintPale, -0.1), [-w / 2 - 0.02, y0 + h, -0.0], [w / 2 + 0.02, y0 + h + 0.04, d + 0.03], { r: 0.008, shadow: 'receive' });
  p.box(SC.steelDark, [-0.004, y0 + 0.05, d], [0.004, y0 + h - 0.05, d + 0.004], { shadow: 'receive' });
  p.box(SC.rubber, [-w / 2 + 0.07, y0 + h - 0.24, d], [-0.05, y0 + h - 0.1, d + 0.006], { shadow: 'receive' });
  p.box(SC.glass, [-w / 2 + 0.09, y0 + h - 0.22, d + 0.006], [-0.07, y0 + h - 0.12, d + 0.009], { shadow: 'receive' });
  for (let i = 0; i < 4; i++) p.box(SC.steelDark, [0.05, y0 + 0.1 + i * 0.05, d], [w / 2 - 0.07, y0 + 0.12 + i * 0.05, d + 0.008], { shadow: 'receive' });
  p.box(SC.steel, [0.02, y0 + h * 0.5 - 0.05, d], [0.05, y0 + h * 0.5 + 0.05, d + 0.03], { r: 0.006, shadow: 'receive' });
  // 上へ出る電線管
  p.rod(SC.steel, [0, y0 + h + 0.04, 0.06], [0, y0 + h + 0.9, 0.06], 0.02, { radial: 6, shadow: 'receive' });
}

/** 係船柱（鋳物の笠のついた短い柱）。歩廊の上面 y = 0 */
export function bollard(p: Prop): void {
  p.box(SC.steelDark, [-0.17, 0, -0.17], [0.17, 0.03, 0.17], { r: 0.01 });
  for (const [x, z] of [
    [-0.13, -0.13],
    [0.13, -0.13],
    [-0.13, 0.13],
    [0.13, 0.13],
  ] as [number, number][])
    p.cyl(SC.steel, [x, 0.035, z], 0.018, 0.015, { seg: 6, shadow: 'receive' });
  p.lathe(SC.rustDark, [[0, 0.03], [0.12, 0.03], [0.11, 0.08], [0.095, 0.3], [0.1, 0.36], [0.16, 0.4], [0.165, 0.44], [0.13, 0.47], [0, 0.48]], [0, 0, 0], { seg: 18, collide: true });
  p.torus(SC.rust, [0, 0.36, 0], 0.1, 0.012, { axis: 'y', seg: 18, radial: 5, shadow: 'receive' });
}

/** 窓の格子（縦の鉄の棒と、上下の横桟）。w × h、下端 y0、壁の面から dz 出る */
export function windowGrille(p: Prop, w: number, h: number, y0: number, dz = 0.06): void {
  const n = Math.max(3, Math.round(w / 0.13));
  for (let i = 1; i < n; i++) {
    const x = -w / 2 + (i * w) / n;
    p.rod(SC.steelDark, [x, y0, dz], [x, y0 + h, dz], 0.011, { radial: 5, shadow: 'receive' });
  }
  for (const y of [y0 + 0.08, y0 + h - 0.08]) p.box(SC.steelDark, [-w / 2, y - 0.015, dz - 0.012], [w / 2, y + 0.015, dz + 0.012], { shadow: 'receive' });
}

/** 番号の札（ほうろうの板・縁・数字の代わりの太い帯 2 本）。中心の高さ y */
export function signPlate(p: Prop, y: number, w = 0.32, h = 0.18, color: string = SC.white): void {
  p.extrude(SC.steelDark, roundRect(0, y, w + 0.02, h + 0.02, 0.012), 'xy', 0, 0.012, { shadow: 'receive' });
  p.extrude(color, roundRect(0, y, w, h, 0.01), 'xy', 0.012, 0.016, { shadow: 'receive' });
  p.box(SC.binder, [-w * 0.32, y - h * 0.22, 0.016], [-w * 0.05, y + h * 0.22, 0.019], { shadow: 'receive' });
  p.box(SC.binder, [w * 0.02, y - h * 0.22, 0.016], [w * 0.3, y + h * 0.22, 0.019], { shadow: 'receive' });
}

/** 戸口の上の小さな庇の灯り（ブラケットの丸い器具と保護の籠）。中心の高さ y */
export function bulkheadLamp(p: Prop, y: number): void {
  p.box(SC.steelDark, [-0.1, y - 0.07, 0], [0.1, y + 0.07, 0.04], { r: 0.012, shadow: 'receive' });
  p.ball(SG.lamp, [0, y, 0.06], [0.08, 0.05, 0.04], { kind: 'glow', seg: 10, shadow: 'receive' });
  for (const dy of [-0.025, 0.025]) p.box(SC.steelDark, [-0.1, y + dy - 0.006, 0.09], [0.1, y + dy + 0.006, 0.1], { shadow: 'receive' });
}
