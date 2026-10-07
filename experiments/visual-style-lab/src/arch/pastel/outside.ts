import type { Builder } from '../../scenes/Builder.ts';
import { rng } from '../../scenes/Builder.ts';
import { BLDG, T_EXT } from './layout.ts';
import { hex, Paints } from './paint.ts';
import { shiftColor } from '../../render/Style.ts';
import { snowSurface } from './shell.ts';

/**
 * 建物の外（窓からだけ見える）: 雪の野原・曇りの空・遠くの木立と家並み・塀。どれも参考画像の画角の外。
 * 色は淡い白〜セージ（雪の日の平らな色面）
 */
export function buildOutside(b: Builder, p: Paints): void {
  const snow = snowSurface(p);
  const o = { shadow: false } as const;
  // 地面（建物の床より 0.25 m 低い）。建物の下は抜く（床が二重にならない）
  const X0 = BLDG.x0 - T_EXT;
  const X1 = BLDG.x1 + T_EXT;
  const R = 90;
  // 1 枚（建物の下は床の板の中に隠れる）
  b.boxMM(snow, [-R, -0.6, -R], [R, -0.25, R], o);
  // 建物の土台（外から見える立ち上がり）
  const plinth = p.solid('#b9c3b8', 0.5);
  // 上の面は床（y = 0）より下（床と重ならない）
  b.boxMM(plinth, [X0 - 0.05, -0.25, BLDG.z0 - T_EXT - 0.05], [X1 + 0.05, -0.03, BLDG.z1 + T_EXT + 0.05], o);
  b.boxMM(plinth, [-1.7, -0.25, BLDG.z1 + T_EXT], [1.7, -0.03, 5.1], o);
  b.boxMM(plinth, [-1.7, -0.25, -23.4], [1.7, -0.03, BLDG.z0 - T_EXT], o);
  // 空（曇り。内向きの大きな箱の 5 面）
  const sky = p.glow('#e2e8dc');
  const skyTop = p.glow('#e9ede3');
  b.boxMM(sky, [-R, -1, -R - 1], [R, 40, -R], o);
  b.boxMM(sky, [-R, -1, R], [R, 40, R + 1], o);
  b.boxMM(sky, [-R - 1, -1, -R], [-R, 40, R], o);
  b.boxMM(sky, [R, -1, -R], [R + 1, 40, R], o);
  b.boxMM(skyTop, [-R, 40, -R], [R, 41, R], o);
  // 遠くの木立（淡いセージの縦長の塊。奥ほど淡い）と雪の積もった低い塀・家並み
  const r = rng(77);
  // 木立は中間の灰緑（参考画像の色の表の #a7b8b2・#bac7bc あたり）。窓の外にも明るさの段が出る（奥の輪ほど淡い）
  const treeC = ['#9fb2aa', '#a7b8b2', '#b0c0b6', '#97aaa4'];
  const ring = (dist: number, n: number, hMin: number, hMax: number, k: number): void => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.2;
      const d = dist + r() * 12;
      const x = Math.sin(a) * d;
      const z = Math.cos(a) * d - 8;
      const h = hMin + r() * (hMax - hMin);
      const w = 1.4 + r() * 2.2;
      const m = p.solid(k === 0 ? treeC[(i + k) % treeC.length] : hex(shiftColor(treeC[(i + k) % treeC.length], [1.08, 0.8, 0])), 0.4);
      // 針葉樹（幹と、上ほど細い 3 段の円錐。段の上に雪）
      b.cyl(p.solid('#a9b6ad', 0.4), [x, h * 0.1, z], w * 0.08, h * 0.25, { segments: 6, shadow: false });
      for (let t = 0; t < 3; t++) {
        const r0 = (w / 2) * (1 - t * 0.25);
        const y0 = h * (0.15 + t * 0.27);
        b.cyl(m, [x, y0 + h * 0.22, z], r0, h * 0.45, { radiusTop: r0 * 0.15, segments: 7, shadow: false });
        b.cyl(p.solid('#eef1e6', 0.3), [x, y0 + h * 0.05, z], r0 * 0.75, h * 0.03, { segments: 7, shadow: false });
      }
    }
  };
  ring(30, 40, 5, 11, 0);
  ring(48, 50, 7, 15, 2);
  // 家並み（遠くの低い箱と屋根の雪）
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const d = 38 + r() * 8;
    const x = Math.sin(a) * d;
    const z = Math.cos(a) * d - 8;
    const w = 5 + r() * 5;
    const h = 3 + r() * 4;
    b.boxMM(p.solid('#c9d2c8', 0.5), [x - w / 2, -0.3, z - 3], [x + w / 2, h, z + 3], o);
    b.boxMM(p.solid('#f0f3ea', 0.3), [x - w / 2 - 0.3, h, z - 3.3], [x + w / 2 + 0.3, h + 0.35, z + 3.3], o);
  }
  // 敷地の塀（雪をかぶったブロック塀）
  const wallC = p.solid('#c8d0c4', 0.6);
  const cap = p.solid('#f2f5ec', 0.3);
  for (const [a, c] of [
    [[-16, -32], [16, -32]],
    [[16, -32], [16, 14]],
    [[-16, 14], [-16, -32]],
    [[-16, 14], [-3, 14]],
    [[3, 14], [16, 14]],
  ] as [[number, number], [number, number]][]) {
    const x0 = Math.min(a[0], c[0]) - 0.1;
    const x1 = Math.max(a[0], c[0]) + 0.1;
    const z0 = Math.min(a[1], c[1]) - 0.1;
    const z1 = Math.max(a[1], c[1]) + 0.1;
    b.boxMM(wallC, [x0, -0.3, z0], [x1, 1.3, z1], o);
    b.boxMM(cap, [x0 - 0.04, 1.3, z0 - 0.04], [x1 + 0.04, 1.42, z1 + 0.04], o);
  }
  // 玄関の前の門柱と、雪に埋もれた自転車置き場の屋根
  b.boxMM(wallC, [-3.4, -0.3, 13.6], [-2.8, 1.8, 14.4], o);
  b.boxMM(wallC, [2.8, -0.3, 13.6], [3.4, 1.8, 14.4], o);
  b.boxMM(p.solid('#a9b6ad', 0.5), [8.5, 2.0, 2], [12.5, 2.1, 6], o);
  b.boxMM(cap, [8.4, 2.1, 1.9], [12.6, 2.35, 6.1], o);
  for (const [x, z] of [[8.6, 2.1], [12.4, 2.1], [8.6, 5.9], [12.4, 5.9]]) b.boxMM(p.solid('#8d9c96', 0.5), [x - 0.04, -0.3, z - 0.04], [x + 0.04, 2.0, z + 0.04], o);
}
