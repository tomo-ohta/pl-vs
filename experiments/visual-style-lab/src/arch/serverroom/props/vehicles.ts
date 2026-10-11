import type { Prop, V2 } from '../../../props/kit.ts';

/**
 * 荷捌き場のトラック（2 t のアルミバン。キャブオーバー）。前が +z、床 y = 0。作り方は共通の軽トラック（props/lib/vehicles.ts）と同じ:
 * 横から見た輪郭を押し出した本体・ガラスの板・車輪（タイヤの断面を回す）・部位の箱。
 * 寸法の根拠: 2 t 標準のアルミバン 全長 6.2 m・全幅 1.88 m（荷箱 1.95 m）・全高 3.0 m・荷箱の床 1.0 m・ホイールベース 3.4 m・
 * タイヤ 205/85R16（直径 0.73 m）・後輪は 2 本ずつ（ダブルタイヤ）。
 * 色は造りに従う: キャブ（淡い塗り）・前の黒い格子とバンパー・荷箱のアルミの板と柱・後ろの扉の鍵の棒・会社の帯（荷箱の横の帯）。
 */

const NB = { shadow: false as const };

/** 弧の点（中心 c・半径 r・角度 a0 → a1。(z, y) の平面） */
function arc(c: V2, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

/** 車輪（タイヤの断面を軸のまわりに回す・ホイールの皿・ハブ・ナット）。x はタイヤの外の面、side = ±1 */
function wheel(p: Prop, z: number, x: number, side: number, R: number, Wt: number, rim: string): void {
  const h = Wt / 2;
  const prof: V2[] = [[R * 0.6, -h * 0.9], [R * 0.9, -h], [R, -h * 0.7], [R, h * 0.7], [R * 0.9, h], [R * 0.6, h * 0.9]];
  p.lathe('#1c2426', prof, [x - side * h, R, z], { axis: 'x', seg: 22 });
  p.cyl(rim, [x - side * 0.02, R, z], R * 0.6, 0.03, { axis: 'x', seg: 20 });
  p.cyl('#5e6c70', [x - side * 0.004, R, z], R * 0.22, 0.03, { axis: 'x', seg: 12 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    p.cyl('#2c3638', [x + side * 0.005, R + Math.sin(a) * R * 0.3, z + Math.cos(a) * R * 0.3], 0.018, 0.02, { axis: 'x', seg: 6, shadow: false });
  }
}

export function boxTruck(p: Prop, o: { cab?: string; box?: string; stripe?: string } = {}): void {
  // 場所の絵柄に合わせて、白・アルミも少し青緑に寄せる（参考画像の色の段）
  const cab = o.cab ?? '#acd6e0';
  const alu = o.box ?? '#8dbfcc';
  const post = '#b2dce6';
  const stripe = o.stripe ?? '#2f6fa0';
  const trim = '#24404a';
  const glass = '#1a3e4c';
  const W = 1.86;
  const BW = 1.95;
  const R = 0.365;
  const zf = 2.25; // 前輪
  const zr = -1.15; // 後輪（2 本ずつ）
  const zFront = 3.1;
  const zBack = -3.1;
  const cabRear = 1.38;
  p.collide([-BW / 2, 0, zBack], [BW / 2, 3.05, zFront + 0.05]);

  // ---- キャブ（横から見た輪郭: 前輪の穴・ほぼ垂直の前・前のガラス・屋根） ----
  const yb = 0.5;
  const ar = 0.45;
  const th = Math.asin((yb - R) / ar);
  const out: V2[] = [[cabRear, yb], ...arc([zf, R], ar, Math.PI - th, th, 14), [zFront - 0.06, yb], [zFront, 0.62], [zFront, 1.28], [zFront - 0.04, 1.38], [zFront - 0.12, 2.08], [zFront - 0.22, 2.22], [cabRear + 0.05, 2.26], [cabRear, 2.18]];
  p.extrude(cab, out, 'zy', -W / 2, W / 2, { bevel: 0.05 });
  p.box('#121a1c', [-W / 2 + 0.16, yb - 0.1, zf - ar], [W / 2 - 0.16, R + ar * 0.9, zf + ar], NB);
  // 前のガラス（2 枚の板の継ぎ目の柱）・ワイパー
  p.extrude(glass, [[zFront - 0.035, 1.42], [zFront - 0.025, 1.42], [zFront - 0.105, 2.06], [zFront - 0.115, 2.06]], 'zy', -W / 2 + 0.1, W / 2 - 0.1, { kind: 'solid', ...NB });
  p.box(trim, [-0.02, 1.42, zFront - 0.12], [0.02, 2.06, zFront - 0.02], NB);
  for (const x of [-0.55, 0.15]) p.rod(trim, [x, 1.46, zFront - 0.02], [x + 0.45, 1.6, zFront - 0.035], 0.009, { radial: 5, shadow: false });
  // 前: 黒い格子（横の羽根）・ライト・方向指示器・バンパー・ナンバー・社名の札
  p.box('#1a2426', [-0.62, 0.86, zFront - 0.01], [0.62, 1.24, zFront + 0.012], { r: 0.02 });
  for (let y = 0.9; y < 1.22; y += 0.055) p.box('#3c4a4e', [-0.58, y, zFront + 0.012], [0.58, y + 0.022, zFront + 0.02], NB);
  for (const s of [-1, 1]) {
    p.box('#e8f2f0', [s * 0.78 - 0.13, 0.72, zFront - 0.04], [s * 0.78 + 0.13, 0.84, zFront + 0.015], { r: 0.02 });
    p.box('#f2fbfa', [s * 0.78 - 0.1, 0.745, zFront + 0.015], [s * 0.78 + 0.1, 0.815, zFront + 0.02], { kind: 'glow', ...NB });
    p.box('#e3a54a', [s * 0.86 - 0.05, 0.9, zFront - 0.04], [s * 0.86 + 0.05, 0.98, zFront + 0.015], { r: 0.01 });
  }
  p.box('#5c6c70', [-W / 2 - 0.02, 0.42, zFront - 0.12], [W / 2 + 0.02, 0.66, zFront + 0.07], { r: 0.03 });
  p.box('#3a474a', [-W / 2 - 0.02, 0.42, zFront + 0.05], [W / 2 + 0.02, 0.47, zFront + 0.075], NB);
  p.box('#f4f4ee', [-0.165, 0.47, zFront + 0.07], [0.165, 0.63, zFront + 0.08], { r: 0.008 });
  p.box('#5a7a52', [-0.15, 0.51, zFront + 0.08], [0.15, 0.59, zFront + 0.083], NB);
  p.box(stripe, [-0.5, 1.3, zFront - 0.035], [0.5, 1.36, zFront + 0.008], NB);
  // 横: ドアの継ぎ目・窓・取っ手・乗り込みの段・大きなミラー（支えの棒）
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.003);
    const xs = (a: number): [number, number] => [Math.min(x, x + s * a), Math.max(x, x + s * a)];
    p.extrude(glass, [[1.95, 1.42], [zFront - 0.18, 1.42], [zFront - 0.24, 2.05], [1.95, 2.05]], 'zy', ...xs(0.008), NB);
    p.box(trim, [xs(0.006)[0], 0.62, 1.88], [xs(0.006)[1], 2.14, 1.9], NB);
    p.box(trim, [xs(0.006)[0], 2.12, 1.88], [xs(0.006)[1], 2.14, zFront - 0.2], NB);
    p.box(trim, [xs(0.03)[0], 1.25, 2.0], [xs(0.03)[1], 1.29, 2.16], { r: 0.008, ...NB });
    const st0 = Math.min(s * (W / 2 - 0.25), s * (W / 2 + 0.02));
    const st1 = Math.max(s * (W / 2 - 0.25), s * (W / 2 + 0.02));
    p.box('#20292b', [st0, 0.5, 1.95], [st1, 0.56, 2.85], NB);
    p.box(stripe, [xs(0.006)[0], 1.3, 1.95], [xs(0.006)[1], 1.36, zFront - 0.06], NB);
    // ミラー（キャブの横から出た支えと縦長の鏡）
    const mx = s * (W / 2 + 0.22);
    p.rod(trim, [s * (W / 2), 1.95, zFront - 0.25], [mx, 1.95, zFront - 0.2], 0.012, { radial: 6, shadow: false });
    p.rod(trim, [s * (W / 2), 1.45, zFront - 0.25], [mx, 1.5, zFront - 0.2], 0.012, { radial: 6, shadow: false });
    p.box(trim, [mx - 0.05, 1.45, zFront - 0.24], [mx + 0.05, 1.98, zFront - 0.16], { r: 0.02 });
    p.box('#8fb8c2', [mx - 0.04, 1.5, zFront - 0.16], [mx + 0.04, 1.93, zFront - 0.155], NB);
  }
  // 屋根の上の小さなマーカーの灯
  for (const x of [-0.6, 0, 0.6]) p.box('#e3a54a', [x - 0.05, 2.26, zFront - 0.35], [x + 0.05, 2.3, zFront - 0.28], { r: 0.01, ...NB });

  // ---- 車台（縦の桁・燃料のタンク・電池の箱・後ろの車軸） ----
  for (const x of [-0.42, 0.34]) p.box('#1e2a2e', [x, 0.48, zBack + 0.25], [x + 0.08, 0.72, cabRear], NB);
  p.cyl('#7f939a', [-0.72, 0.58, 0.35], 0.2, 0.75, { axis: 'z', seg: 16 });
  for (const zz of [0.06, 0.64]) p.cyl('#2c3c42', [-0.72, 0.58, zz], 0.205, 0.04, { axis: 'z', seg: 16, shadow: false });
  p.box('#2c3c42', [0.55, 0.42, 0.2], [0.85, 0.7, 0.7], { r: 0.01 });
  p.cyl('#1e2a2e', [0, R, zr], 0.07, BW - 0.3, { axis: 'x', seg: 10 });
  // 後ろの輪の泥よけ
  for (const s of [-1, 1]) p.box('#1e2a2e', [s * (BW / 2 - 0.02) - 0.004, 0.25, zr - 0.5], [s * (BW / 2 - 0.02) + 0.004, 0.9, zr + 0.5], NB);

  // ---- 荷箱（アルミの板・縦の柱 0.6 m おき・上下の縁の枠・角の柱・横の帯・後ろの扉） ----
  const fy = 0.98;
  const top = 3.02;
  const b0 = zBack;
  const b1 = cabRear - 0.06;
  p.box(alu, [-BW / 2, fy, b0], [BW / 2, top, b1], { r: 0.01 });
  p.box('#36464a', [-BW / 2 + 0.03, fy - 0.12, b0 + 0.05], [BW / 2 - 0.03, fy, b1 - 0.05], NB);
  for (const s of [-1, 1]) {
    const x = s * (BW / 2);
    const xs = (a: number): [number, number] => [Math.min(x, x + s * a), Math.max(x, x + s * a)];
    // アルミの板の縦の柱（0.6 m おき・太い）と、間の板の継ぎ目のリブ（細い）
    for (let z = b0 + 0.6; z < b1 - 0.2; z += 0.6) p.box(post, [xs(0.016)[0], fy + 0.08, z - 0.03], [xs(0.016)[1], top - 0.08, z + 0.03], NB);
    for (let z = b0 + 0.3; z < b1 - 0.2; z += 0.6) p.box('#86a4ac', [xs(0.008)[0], fy + 0.1, z - 0.008], [xs(0.008)[1], top - 0.1, z + 0.008], NB);
    // 横の巻き込み防止の柵（前輪と後輪の間・2 本の横の棒と支え）
    for (const y of [0.45, 0.7]) p.box('#2c3c42', [xs(0.03)[0] - s * 0.06, y, zr + 0.5], [xs(0.03)[1] - s * 0.06, y + 0.06, zf - 0.55], NB);
    for (const z of [zr + 0.6, (zr + zf) / 2, zf - 0.65]) p.box('#2c3c42', [xs(0.02)[0] - s * 0.1, 0.45, z - 0.025], [xs(0.02)[1] - s * 0.06, fy, z + 0.025], NB);
    p.box('#8aa8b0', [xs(0.02)[0], top - 0.1, b0], [xs(0.02)[1], top, b1], NB);
    p.box('#8aa8b0', [xs(0.02)[0], fy, b0], [xs(0.02)[1], fy + 0.1, b1], NB);
    p.box(stripe, [xs(0.016)[0], fy + 0.55, b0 + 0.1], [xs(0.016)[1], fy + 0.75, b1 - 0.1], NB);
    p.box('#d8eef0', [xs(0.018)[0], fy + 0.6, b0 + 1.0], [xs(0.018)[1], fy + 0.7, b0 + 2.6], NB);
    // 会社の印（荷箱の横の上: 丸い印・社名の文字の帯 2 段・電話番号の帯）と、下の擦れ止めの帯
    const lz = b0 + 2.2;
    p.cyl(stripe, [x + s * 0.019, fy + 1.45, lz], 0.32, 0.006, { axis: 'x', seg: 20, shadow: false });
    p.cyl('#d8eef0', [x + s * 0.021, fy + 1.45, lz], 0.2, 0.006, { axis: 'x', seg: 20, shadow: false });
    p.box(stripe, [xs(0.022)[0], fy + 1.38, lz - 0.12], [xs(0.022)[1], fy + 1.52, lz + 0.12], NB);
    p.box('#24404a', [xs(0.018)[0], fy + 1.5, lz - 0.45 - 1.5], [xs(0.018)[1], fy + 1.68, lz - 0.45], NB);
    p.box('#24404a', [xs(0.018)[0], fy + 1.22, lz - 0.45 - 1.1], [xs(0.018)[1], fy + 1.32, lz - 0.45], NB);
    p.box(stripe, [xs(0.018)[0], fy + 0.95, lz - 0.45 - 0.8], [xs(0.018)[1], fy + 1.02, lz - 0.45], NB);
    p.box('#5c6c70', [xs(0.03)[0], fy + 0.12, b0 + 0.1], [xs(0.03)[1], fy + 0.2, b1 - 0.1], NB);
    // 横の灯（荷箱の下の縁の橙の小さな灯）
    for (let z = b0 + 0.5; z < b1; z += 1.2) p.box('#e3a54a', [xs(0.025)[0], fy + 0.02, z], [xs(0.025)[1], fy + 0.07, z + 0.06], { kind: 'glow', ...NB });
    // 角の柱（後ろ・前）
    for (const z of [b0, b1 - 0.06]) p.box('#8aa8b0', [xs(0.025)[0], fy, z], [xs(0.025)[1], top, z + 0.06], NB);
  }
  // 屋根の縁の枠
  p.box('#8aa8b0', [-BW / 2, top - 0.02, b0], [BW / 2, top + 0.02, b0 + 0.06], NB);
  // 後ろの扉（観音開きの 2 枚・4 本の鍵の棒と取っ手・丁番・ゴムの縁・灯・下の突入防止の枠）
  const zb = b0 - 0.006;
  p.box('#8aa8b0', [-BW / 2, fy, zb], [BW / 2, top, zb + 0.006], NB);
  p.box(alu, [-BW / 2 + 0.05, fy + 0.06, zb - 0.01], [-0.012, top - 0.07, zb], NB);
  p.box(alu, [0.012, fy + 0.06, zb - 0.01], [BW / 2 - 0.05, top - 0.07, zb], NB);
  p.box('#1e2a2e', [-0.012, fy + 0.06, zb - 0.012], [0.012, top - 0.07, zb], NB);
  for (const x of [-0.75, -0.25, 0.25, 0.75]) {
    p.rod('#c8d4d6', [x, fy + 0.04, zb - 0.03], [x, top - 0.04, zb - 0.03], 0.012, { radial: 6, shadow: false });
    p.box('#c8d4d6', [x - 0.01, fy + 0.85, zb - 0.06], [x + 0.13, fy + 0.89, zb - 0.025], { r: 0.008, ...NB });
  }
  for (const s of [-1, 1]) for (const y of [fy + 0.3, fy + 1.0, top - 0.35]) p.box('#5c6c70', [s * (BW / 2 - 0.04) - 0.04, y, zb - 0.02], [s * (BW / 2 - 0.04) + 0.04, y + 0.12, zb], NB);
  for (const s of [-1, 1]) {
    p.box('#c8463f', [s * 0.82 - 0.09, 0.62, b0 - 0.02], [s * 0.82 + 0.09, 0.82, b0 + 0.04], { r: 0.01 });
    p.box('#e3a54a', [s * 0.62 - 0.05, 0.66, b0 - 0.02], [s * 0.62 + 0.05, 0.78, b0 + 0.04], { r: 0.01 });
  }
  p.box('#3a474a', [-0.85, 0.4, b0 + 0.05], [0.85, 0.5, b0 + 0.12], NB);
  for (const x of [-0.7, 0.7]) p.box('#3a474a', [x - 0.03, 0.45, b0 + 0.08], [x + 0.03, fy - 0.12, b0 + 0.14], NB);
  p.box('#f4f4ee', [-0.165, 0.55, b0 - 0.02], [0.165, 0.71, b0 - 0.01], { r: 0.008 });

  // ---- 車輪（前 1 本ずつ・後ろ 2 本ずつ） ----
  for (const s of [-1, 1]) {
    wheel(p, zf, s * (W / 2 - 0.05), s, R, 0.2, '#c9d2d0');
    wheel(p, zr, s * (BW / 2 - 0.06), s, R, 0.2, '#c9d2d0');
    wheel(p, zr, s * (BW / 2 - 0.29), s, R, 0.2, '#9aa6a6');
  }
}
