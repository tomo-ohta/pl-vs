import * as THREE from 'three';
import { Prop, shade, type PropMats, type V2 } from '../../../props/kit.ts';
import { cardboardBox } from '../../../props/lib/index.ts';

/**
 * 校舎の外の小物（裏庭・中庭・駐輪場・壁ぞいの設備）。実物の寸法と部位で作り、色は実物の色で頼む（場所の色へは alleyMats が写す）。
 * 正面 +z、背 -z、床 y = 0（壁に付ける物は、壁の面が z = 0）。
 * 寸法の根拠: ドラム缶 200 L（直径 0.585 m・高さ 0.88 m・胴の 2 本の輪）、パレット 1.1 × 1.1 × 0.144 m（JIS の T11 型）、
 * 一輪車（全長 1.4 m・幅 0.6 m・箱 85 L）、45 L のごみ袋、キュービクル（幅 3.2 m・奥行き 1.3 m・高さ 2.3 m）、
 * エアコンの室外機（0.8 × 0.55 × 0.29 m）、電力量計（0.18 × 0.24 m）、空き缶の回収箱（0.5 × 0.4 × 0.86 m）、
 * 前輪を差す駐輪ラック（1 台 0.5〜0.6 m）、屋外のベンチ（長さ 1.8 m・座の高さ 0.42 m）、台車（0.9 × 0.6 m）
 */

const DARK = '#2b302e';
const RUBBER = '#26292a';
const STEEL = '#a3aaa6';
const PAPER = '#eeede4';

/** 形の面を平らに（回転体を角張った形に使うとき、面ごとの塗りが面の中で変わらないように） */
function flat(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('normal');
  n.computeVertexNormals();
  return n;
}

/** ドラム缶（胴・2 本の輪・上下の縁・ふたの 2 つの栓・注意の札） */
export function drum(p: Prop, col = '#3d6f9a', o: { label?: boolean } = {}): void {
  const R = 0.29;
  const H = 0.88;
  const prof: V2[] = [[0, 0], [R - 0.02, 0], [R - 0.004, 0.006], [R, 0.022], [R, 0.282], [R + 0.009, 0.29], [R + 0.009, 0.3], [R, 0.308], [R, 0.572], [R + 0.009, 0.58], [R + 0.009, 0.59], [R, 0.598], [R, H - 0.022], [R + 0.004, H - 0.01], [R + 0.004, H], [R - 0.014, H], [R - 0.018, H - 0.012], [0, H - 0.012]];
  p.lathe(col, prof, [0, 0, 0], { seg: 20, collide: true });
  // 胴の 2 本の輪と上の縁（少し明るい）
  for (const y of [0.295, 0.585]) p.torus(shade(col, 0.2), [0, y, 0], R + 0.004, 0.008, { axis: 'y', seg: 16 });
  p.torus(shade(col, 0.2), [0, H - 0.006, 0], R - 0.004, 0.007, { axis: 'y', seg: 16 });
  p.cyl(shade(col, -0.3), [0.15, H - 0.006, 0.08], 0.03, 0.014, { seg: 10 });
  p.cyl(shade(col, -0.3), [-0.17, H - 0.008, 0.04], 0.018, 0.01, { seg: 8 });
  if (o.label !== false) p.plate(PAPER, [0, 0.44, R + 0.002], 0.14, 0.18, '+z', { shadow: false });
}

/** パレット（木の 3 本の桁・上の 7 枚・下の 3 枚の板。板ごとに少し色が違う） */
export function pallet(p: Prop, o: { wood?: string; w?: number; d?: number } = {}): void {
  const wood = o.wood ?? '#a89a80';
  const W = o.w ?? 1.1;
  const D = o.d ?? 1.1;
  for (const x of [-W / 2 + 0.04, 0, W / 2 - 0.04]) p.box(shade(wood, -0.15), [x - 0.038, 0.022, -D / 2], [x + 0.038, 0.122, D / 2]);
  for (let i = 0; i < 7; i++) {
    const z = -D / 2 + 0.05 + (i * (D - 0.1)) / 6;
    p.box(shade(wood, (p.r() - 0.5) * 0.4), [-W / 2, 0.122, z - 0.05], [W / 2, 0.144, z + 0.05]);
  }
  for (const z of [-D / 2 + 0.05, 0, D / 2 - 0.05]) p.box(shade(wood, (p.r() - 0.5) * 0.4), [-W / 2, 0, z - 0.05], [W / 2, 0.022, z + 0.05]);
}

/** 土・肥料の袋（ふくらんだ袋・両端の閉じ目・上の印刷の帯） */
export function sack(p: Prop, o: { col?: string; band?: string } = {}): void {
  const col = o.col ?? '#d9d3be';
  const band = o.band ?? '#4f8a4a';
  p.box(col, [-0.3, 0, -0.2], [0.3, 0.13, 0.2], { r: 0.05, seg: 1 });
  for (const s of [-1, 1]) p.box(shade(col, -0.2), [s * 0.3 - 0.025, 0.035, -0.17], [s * 0.3 + 0.012, 0.095, 0.17], { r: 0.012, seg: 1 });
  p.plate(band, [0, 0.1302, 0], 0.32, 0.26, '+y', { shadow: false });
  p.plate(PAPER, [-0.05, 0.1306, 0.03], 0.16, 0.08, '+y', { shadow: false });
}

/** パレットの積み（空のパレット 1〜2 枚の上に、袋の積み・段ボール） */
export function palletStack(p: Prop, o: { base?: number; load?: 'sacks' | 'boxes' } = {}): void {
  const n = o.base ?? 2;
  for (let i = 0; i < n; i++) pallet(p.sub([(p.r() - 0.5) * 0.04, i * 0.144, (p.r() - 0.5) * 0.04], (p.r() - 0.5) * 0.05));
  let y = n * 0.144;
  if (o.load === 'boxes') {
    cardboardBox(p.sub([-0.25, y, -0.2], 0.05), 0.5, 0.36, 0.5);
    cardboardBox(p.sub([0.27, y, -0.22], -0.08), 0.48, 0.3, 0.46);
    cardboardBox(p.sub([-0.2, y + 0.36, -0.18], 0.2), 0.42, 0.26, 0.4);
    cardboardBox(p.sub([0.2, y, 0.3], 0.02), 0.6, 0.24, 0.42);
    y += 0.62;
  } else if (o.load === 'sacks') {
    for (let k = 0; k < 3; k++) {
      const yaw = k % 2 ? Math.PI / 2 : 0;
      for (const s of [-1, 1]) {
        const off: [number, number, number] = k % 2 ? [s * 0.22, 0, 0] : [0, 0, s * 0.22];
        sack(p.sub([off[0] + (p.r() - 0.5) * 0.04, y, off[2] + (p.r() - 0.5) * 0.04], yaw + (p.r() - 0.5) * 0.1));
      }
      y += 0.125;
    }
  }
  p.collide([-0.56, 0, -0.56], [0.56, Math.max(y, 0.3), 0.56]);
}

/** 一輪車（鉄の箱・縁の管・管の枠と持ち手・握り・脚・空気の入ったタイヤ） */
export function wheelbarrow(p: Prop, o: { tray?: string; frame?: string } = {}): void {
  const tray = o.tray ?? '#3f7a5a';
  const fr = o.frame ?? '#3a3f3e';
  // 箱: 4 つの辺の回転体（角の 4 つの所を外へ）を横長に伸ばし、面を平らに
  const prof = [[0, 0], [0.31, 0], [0.5, 0.29], [0.52, 0.3], [0.52, 0.315], [0.485, 0.315], [0.295, 0.016], [0, 0.016]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 4, Math.PI / 4);
  g.scale(0.85, 1, 1.3);
  g.translate(0, 0.33, 0.02);
  p.put(flat(g), tray);
  // 車輪（前）
  const zw = 0.6;
  const R = 0.19;
  p.torus(RUBBER, [0, R, zw], R - 0.045, 0.045, { axis: 'x', seg: 18 });
  p.cyl(STEEL, [0, R, zw], 0.07, 0.07, { axis: 'x', seg: 12 });
  p.cyl(DARK, [0, R, zw], 0.012, 0.16, { axis: 'x', seg: 6 });
  // 枠: 車軸から箱の下を通って後ろの持ち手へ（左右 2 本）
  for (const s of [-1, 1]) {
    p.tube(fr, [[s * 0.07, R, zw], [s * 0.17, 0.31, 0.25], [s * 0.24, 0.36, -0.2], [s * 0.3, 0.52, -0.82]], 0.016, { seg: 16, radial: 6 });
    p.rod(RUBBER, [s * 0.285, 0.5, -0.74], [s * 0.305, 0.53, -0.88], 0.02, { radial: 6 });
    // 脚と足
    p.rod(fr, [s * 0.22, 0.35, -0.12], [s * 0.24, 0.0, -0.2], 0.012, { radial: 6 });
    p.box(fr, [s * 0.24 - 0.02, 0, -0.26], [s * 0.24 + 0.02, 0.012, -0.14]);
  }
  p.rod(fr, [-0.22, 0.12, -0.17], [0.22, 0.12, -0.17], 0.01, { radial: 6 });
  p.collide([-0.33, 0, -0.9], [0.33, 0.65, 0.8]);
}

/** ごみ袋（45 L の半透明の袋: 下の広いふくらんだ胴・絞った短い首・結び目の 2 つの耳） */
export function garbageBag(p: Prop, col = '#dfe4de'): void {
  p.ball(col, [0, 0.19, 0], [0.25, 0.2, 0.22], { seg: 12 });
  p.lathe(col, [[0.2, 0.27], [0.13, 0.36], [0.05, 0.42], [0.03, 0.45], [0, 0.45]], [0, 0, 0], { seg: 10 });
  p.sub([0.035, 0.46, 0], 0.2, { roll: -0.6 }).ball(col, [0, 0, 0], [0.055, 0.016, 0.03], { seg: 8 });
  p.sub([-0.03, 0.465, 0.01], -0.3, { roll: 0.7 }).ball(col, [0, 0, 0], [0.05, 0.016, 0.028], { seg: 8 });
}

/** キュービクル（高圧の受電設備）: コンクリートの台・鉄の台枠・箱・はみ出した屋根・4 枚の扉（上下の通気の鎧戸・取っ手）・危険の札・横の鎧戸 */
export function cubicle(p: Prop, o: { w?: number; d?: number; h?: number; body?: string } = {}): void {
  const W = o.w ?? 3.2;
  const D = o.d ?? 1.3;
  const H = o.h ?? 2.3;
  const body = o.body ?? '#c9cdbf';
  const y0 = 0.2;
  p.box('#9a9c94', [-W / 2 - 0.06, 0, -D / 2 - 0.06], [W / 2 + 0.06, 0.12, D / 2 + 0.06]);
  p.box(DARK, [-W / 2 + 0.02, 0.12, -D / 2 + 0.02], [W / 2 - 0.02, y0, D / 2 - 0.02]);
  p.box(shade(body, -0.2), [-W / 2, y0, -D / 2], [W / 2, H - 0.06, D / 2 - 0.012], { collide: true });
  p.box(body, [-W / 2 - 0.05, H - 0.06, -D / 2 - 0.05], [W / 2 + 0.05, H, D / 2 + 0.06], { r: 0.012, seg: 1 });
  const n = 4;
  const dw = (W - 0.08) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + 0.04 + i * dw + 0.006;
    const x1 = x0 + dw - 0.012;
    p.box(body, [x0, y0 + 0.04, D / 2 - 0.012], [x1, H - 0.1, D / 2], { r: 0.005, seg: 1 });
    // 通気の鎧戸（上と下）: 暗い口と、前へ出た羽根
    for (const yb of [y0 + 0.18, H - 0.45]) {
      p.box(DARK, [x0 + 0.1, yb, D / 2], [x1 - 0.1, yb + 0.2, D / 2 + 0.003], { shadow: false });
      for (let k = 0; k < 5; k++) p.box(body, [x0 + 0.1, yb + 0.012 + k * 0.04, D / 2 + 0.003], [x1 - 0.1, yb + 0.03 + k * 0.04, D / 2 + 0.022]);
    }
    // 取っ手（ハンドルの台と握り）
    p.box(STEEL, [x1 - 0.07, 1.05, D / 2], [x1 - 0.04, 1.3, D / 2 + 0.012], { r: 0.005, seg: 1 });
    p.box(DARK, [x1 - 0.064, 1.12, D / 2 + 0.012], [x1 - 0.046, 1.24, D / 2 + 0.04], { r: 0.006, seg: 1 });
    if (i === 1) {
      // 危険の札（黄の地・黒の帯・赤の字の帯）
      const xc = (x0 + x1) / 2;
      p.plate('#e8c63e', [xc, 1.55, D / 2 + 0.002], 0.32, 0.22, '+z', { shadow: false });
      p.plate('#1f1f1f', [xc, 1.6, D / 2 + 0.003], 0.28, 0.05, '+z', { shadow: false });
      p.plate('#c83a32', [xc, 1.5, D / 2 + 0.003], 0.28, 0.05, '+z', { shadow: false });
    }
    if (i === 2) p.plate(PAPER, [(x0 + x1) / 2, 1.6, D / 2 + 0.002], 0.2, 0.12, '+z', { shadow: false });
  }
  // 横の面の鎧戸
  for (const s of [-1, 1]) {
    const x = s * (W / 2);
    p.box(DARK, [x - 0.002, H - 0.6, -0.35], [x + 0.002, H - 0.35, 0.35], { shadow: false });
    for (let k = 0; k < 6; k++) p.box(shade(body, -0.2), [x + (s < 0 ? -0.02 : 0), H - 0.59 + k * 0.04, -0.35], [x + (s < 0 ? 0 : 0.02), H - 0.575 + k * 0.04, 0.35]);
  }
}

/** ホースの巻き取り（管の枠・2 枚の円板と芯・3 段 3 列に巻いたホース・回す取っ手・先のノズル） */
export function hoseReel(p: Prop, o: { hose?: string; frame?: string } = {}): void {
  const hose = o.hose ?? '#4a8a5a';
  const fr = o.frame ?? '#8e9994';
  const y = 0.32;
  for (const s of [-1, 1]) {
    p.cyl(fr, [s * 0.13, y, 0], 0.2, 0.012, { axis: 'x', seg: 18 });
    p.tube(fr, [[s * 0.18, 0, 0.16], [s * 0.18, y, 0], [s * 0.18, 0, -0.16]], 0.011, { sharp: true, radial: 6, seg: 5 });
    p.rod(fr, [s * 0.18, 0.01, -0.16], [s * 0.18, 0.01, 0.16], 0.01, { radial: 6 });
  }
  p.cyl(STEEL, [0, y, 0], 0.07, 0.25, { axis: 'x', seg: 12 });
  for (let k = 0; k < 2; k++) for (let j = -1; j <= 1; j++) p.torus(hose, [j * 0.075, y, 0], 0.1 + k * 0.032, 0.016, { axis: 'x', seg: 12 });
  // 持ち手（上を渡る管）と回す取っ手
  p.tube(fr, [[-0.18, y, 0], [-0.18, 0.7, -0.08], [0.18, 0.7, -0.08], [0.18, y, 0]], 0.011, { sharp: true, radial: 6, seg: 5 });
  p.rod(fr, [0.19, y, 0], [0.24, y, 0], 0.008, { radial: 6 });
  p.rod(fr, [0.24, y, 0], [0.24, y + 0.1, 0.02], 0.008, { radial: 6 });
  p.cyl(DARK, [0.27, y + 0.1, 0.02], 0.014, 0.05, { axis: 'x', seg: 6 });
  // ほどいたホースの先とノズル
  p.tube(hose, [[0.05, y + 0.17, 0.05], [0.12, 0.2, 0.2], [0.2, 0.02, 0.32], [0.42, 0.015, 0.36]], 0.014, { seg: 16, radial: 6 });
  p.cyl(DARK, [0.47, 0.016, 0.37], 0.016, 0.1, { axis: 'x', seg: 8 });
  p.collide([-0.22, 0, -0.2], [0.22, 0.72, 0.2]);
}

/** 散水栓・壁の蛇口（立ち上がりの管・本体・吐水口・十字の取っ手）。壁の面 z = 0、本体の中心 y = 0 */
export function faucet(p: Prop, o: { metal?: string; handle?: string; up?: boolean; riser?: number } = {}): void {
  const metal = o.metal ?? '#c4c9c4';
  const handle = o.handle ?? '#4a7ac0';
  const riser = o.riser ?? 0.0;
  if (riser > 0) p.rod(metal, [0, -riser, 0.03], [0, 0, 0.03], 0.011, { radial: 6 });
  else p.rod(metal, [0, 0, 0], [0, 0, 0.04], 0.012, { radial: 6 });
  p.ball(metal, [0, 0, 0.04], 0.022, { seg: 8 });
  if (o.up) p.tube(metal, [[0, 0, 0.04], [0, 0, 0.09], [0, 0.04, 0.1]], 0.009, { sharp: true, radial: 6, seg: 5 });
  else p.tube(metal, [[0, 0, 0.04], [0, 0, 0.1], [0, -0.05, 0.11]], 0.009, { sharp: true, radial: 6, seg: 5 });
  p.rod(metal, [0, 0.015, 0.04], [0, 0.04, 0.04], 0.006, { radial: 6 });
  for (const a of [0, Math.PI / 2]) p.sub([0, 0.044, 0.04], a).box(handle, [-0.035, 0, -0.006], [0.035, 0.009, 0.006], { r: 0.003, seg: 1 });
}

/** 台車（鉄の荷台・縁のゴム・滑り止めの筋・折りたたみの持ち手・4 つの自在車） */
export function handCart(p: Prop, o: { deck?: string; frame?: string } = {}): void {
  const deck = o.deck ?? '#5a7a9a';
  const fr = o.frame ?? STEEL;
  const W = 0.6;
  const L = 0.9;
  const yd = 0.13;
  p.box(deck, [-W / 2, yd, -L / 2], [W / 2, yd + 0.03, L / 2], { r: 0.008, seg: 1 });
  for (let k = -2; k <= 2; k++) p.box(shade(deck, -0.25), [k * 0.1 - 0.012, yd + 0.03, -L / 2 + 0.06], [k * 0.1 + 0.012, yd + 0.035, L / 2 - 0.04], { shadow: false });
  // 四隅のゴムの当て
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.box(RUBBER, [sx < 0 ? -W / 2 - 0.01 : W / 2 - 0.04, yd, sz < 0 ? -L / 2 - 0.01 : L / 2 - 0.05], [sx < 0 ? -W / 2 + 0.04 : W / 2 + 0.01, yd + 0.042, sz < 0 ? -L / 2 + 0.05 : L / 2 + 0.01], { r: 0.008, seg: 1 });
  p.tube(fr, [[-0.26, yd + 0.03, -L / 2 + 0.02], [-0.26, 0.9, -L / 2 - 0.02], [0.26, 0.9, -L / 2 - 0.02], [0.26, yd + 0.03, -L / 2 + 0.02]], 0.012, { sharp: true, radial: 6, seg: 5 });
  p.rod(RUBBER, [-0.12, 0.9, -L / 2 - 0.02], [0.12, 0.9, -L / 2 - 0.02], 0.018, { radial: 6 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (W / 2 - 0.07);
      const z = sz * (L / 2 - 0.08);
      p.box(fr, [x - 0.03, yd - 0.02, z - 0.03], [x + 0.03, yd, z + 0.03]);
      p.box(fr, [x - 0.025, 0.05, z - 0.008], [x + 0.025, yd - 0.02, z + 0.008]);
      p.cyl(RUBBER, [x, 0.05, z + 0.01], 0.05, 0.03, { axis: 'x', seg: 12 });
    }
  }
  p.collide([-W / 2, 0, -L / 2 - 0.04], [W / 2, 0.92, L / 2]);
}

/** 前輪を差す駐輪ラック（床の 2 本の管と、台ごとに前輪をはさむ 2 本の曲げた管）。x の向きに n 台、自転車は +z から差す */
export function bikeRack(p: Prop, o: { n?: number; pitch?: number; frame?: string } = {}): void {
  const n = o.n ?? 10;
  const pitch = o.pitch ?? 0.6;
  const fr = o.frame ?? STEEL;
  const L = n * pitch;
  for (const z of [-0.16, 0.12]) p.rod(fr, [-L / 2, 0.025, z], [L / 2, 0.025, z], 0.016, { radial: 6 });
  for (const s of [-1, 1]) p.box(fr, [s * L / 2 - 0.03, 0, -0.2], [s * L / 2 + 0.03, 0.012, 0.16]);
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * pitch;
    for (const dx of [-0.035, 0.035]) p.tube(fr, [[x + dx, 0.025, 0.12], [x + dx, 0.28, 0.07], [x + dx, 0.34, -0.04], [x + dx, 0.025, -0.16]], 0.009, { seg: 12, radial: 5 });
  }
  p.collide([-L / 2, 0, -0.2], [L / 2, 0.36, 0.16]);
}

/** 空き缶・ペットボトルの回収箱（樹脂の箱・丸い屋根のふた・前の丸い口とその縁・札と色の帯・台） */
export function canBin(p: Prop, o: { body?: string; band?: string; label?: string } = {}): void {
  const body = o.body ?? '#3f78b0';
  const band = o.band ?? '#e2c23e';
  p.box(DARK, [-0.23, 0, -0.18], [0.23, 0.04, 0.18]);
  p.box(body, [-0.25, 0.04, -0.2], [0.25, 0.74, 0.2], { r: 0.02, seg: 1, collide: true });
  p.extrude(body, [[-0.21, 0.73], [0.21, 0.73], [0.21, 0.79], [0.13, 0.855], [-0.13, 0.855], [-0.21, 0.79]], 'zy', -0.255, 0.255, { bevel: 0.012 });
  // 口（ふたの前の面の丸い口）
  const m = p.sub([0, 0.8, 0.175], 0, { pitch: -0.68 });
  m.cyl(DARK, [0, 0, 0.0], 0.055, 0.012, { axis: 'z', seg: 16, shadow: false });
  m.torus(shade(body, 0.35), [0, 0, 0.006], 0.058, 0.009, { axis: 'z', seg: 16 });
  // 札（白い地・色の帯・字の線）
  p.plate(PAPER, [0, 0.47, 0.2015], 0.36, 0.22, '+z', { shadow: false });
  p.plate(band, [0, 0.545, 0.202], 0.36, 0.07, '+z', { shadow: false });
  for (let k = 0; k < 2; k++) p.plate('#3a4040', [-0.03, 0.47 - k * 0.04, 0.202], 0.22 - k * 0.06, 0.016, '+z', { shadow: false });
  p.plate(shade(body, -0.25), [0, 0.2, 0.2015], 0.3, 0.08, '+z', { shadow: false });
}

/** 屋外のベンチ（背もたれ付き: 鋳物の横の枠・座の 4 枚・背の 3 枚の板） */
export function parkBench(p: Prop, o: { w?: number; wood?: string; iron?: string } = {}): void {
  const W = o.w ?? 1.8;
  const wood = o.wood ?? '#9a7a54';
  const iron = o.iron ?? '#2f3634';
  const side: V2[] = [[0.18, 0], [0.24, 0], [0.205, 0.37], [0.25, 0.37], [0.25, 0.405], [-0.17, 0.405], [-0.27, 0.82], [-0.31, 0.81], [-0.215, 0.39], [-0.24, 0], [-0.18, 0], [-0.155, 0.33], [0.17, 0.33]];
  for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) p.extrude(iron, side, 'zy', x - 0.022, x + 0.022, { bevel: 0.006 });
  for (const z of [0.2, 0.09, -0.02, -0.13]) p.box(shade(wood, (p.r() - 0.5) * 0.2), [-W / 2, 0.405, z - 0.045], [W / 2, 0.44, z + 0.045], { r: 0.008, seg: 1 });
  const pitch = -Math.atan2(0.1, 0.41);
  for (const t of [0.35, 0.62, 0.88]) {
    const z = -0.17 + (-0.27 + 0.17) * t + 0.026;
    const y = 0.405 + (0.82 - 0.405) * t;
    p.sub([0, y, z], 0, { pitch }).box(shade(wood, (p.r() - 0.5) * 0.2), [-W / 2 + 0.02, -0.042, -0.012], [W / 2 - 0.02, 0.042, 0.012], { r: 0.008, seg: 1 });
  }
  p.collide([-W / 2, 0, -0.31], [W / 2, 0.82, 0.25]);
}

/**
 * エアコンの室外機（角の丸い箱・前の扇の口（暗い円・同心の輪の格子・十字の桟・真ん中の帽子）・右の点検の板・左の面の放熱の筋・
 * 足の 2 本の溝形鋼・右の配管の口と、壁を上る配管のカバー）。壁の面 z = 0、床（台）y = 0。sx = 配管の出る側（+1 = 物の +x）
 */
export function acUnit(p: Prop, o: { body?: string; up?: number; sx?: number; stand?: number; bracket?: boolean } = {}): void {
  const body = o.body ?? '#d9dbd2';
  const sx = o.sx ?? 1;
  const up = o.up ?? 1.4;
  const st = o.stand ?? 0;
  if (st > 0) {
    // 置き台（ブロックの上の鉄の台）
    for (const x of [-0.33, 0.33]) p.box('#8a8c86', [x - 0.06, 0, 0.04], [x + 0.06, st, 0.36]);
  }
  if (o.bracket) {
    // 壁に付ける金物（壁から出る 2 本の腕と、斜めの支え）
    for (const x of [-0.3, 0.3]) {
      p.box(STEEL, [x - 0.02, -0.04, 0], [x + 0.02, 0.0, 0.4]);
      p.rod(STEEL, [x, -0.38, 0.01], [x, -0.03, 0.36], 0.012, { radial: 5 });
      p.box(STEEL, [x - 0.03, -0.42, 0], [x + 0.03, -0.3, 0.01]);
    }
  }
  const y0 = st;
  for (const x of [-0.3, 0.3]) p.box(DARK, [x - 0.03, y0, 0.03], [x + 0.03, y0 + 0.04, 0.35]);
  p.box(body, [-0.4, y0 + 0.04, 0.04], [0.4, y0 + 0.6, 0.33], { r: 0.015, seg: 1 });
  const fx = -0.09 * sx;
  const fy = y0 + 0.32;
  p.cyl(DARK, [fx, fy, 0.331], 0.205, 0.004, { axis: 'z', seg: 24, shadow: false });
  p.torus(shade(body, -0.1), [fx, fy, 0.334], 0.208, 0.009, { axis: 'z', seg: 18 });
  for (const r of [0.07, 0.135]) p.torus(shade(body, -0.2), [fx, fy, 0.336], r, 0.0035, { axis: 'z', seg: 14, shadow: false });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    p.rod(shade(body, -0.2), [fx, fy, 0.337], [fx + Math.cos(a) * 0.2, fy + Math.sin(a) * 0.2, 0.337], 0.003, { radial: 4, shadow: false });
  }
  p.cyl(shade(body, -0.1), [fx, fy, 0.338], 0.035, 0.01, { axis: 'z', seg: 12 });
  // 点検の板と銘板
  p.box(shade(body, 0.1), [sx > 0 ? 0.22 : -0.385, y0 + 0.12, 0.33], [sx > 0 ? 0.385 : -0.22, y0 + 0.52, 0.336], { r: 0.004, seg: 1 });
  p.box('#c8ccc6', [sx > 0 ? 0.26 : -0.34, y0 + 0.44, 0.336], [sx > 0 ? 0.34 : -0.26, y0 + 0.48, 0.338], { shadow: false });
  // 反対側の面の放熱の筋
  const xs = -0.401 * sx;
  for (let k = 0; k < 9; k++) p.box(DARK, [xs - 0.002, y0 + 0.1 + k * 0.05, 0.08], [xs + 0.002, y0 + 0.12 + k * 0.05, 0.3], { shadow: false });
  // 配管の口（バルブのカバー）と、壁を上る配管のカバー
  const xp = sx * 0.47;
  p.box(shade(body, -0.05), [sx > 0 ? 0.4 : -0.43, y0 + 0.1, 0.12], [sx > 0 ? 0.43 : -0.4, y0 + 0.3, 0.26], { r: 0.006, seg: 1 });
  p.box(body, [Math.min(xp - 0.05, sx * 0.4), y0 + 0.16, 0.0], [Math.max(xp + 0.05, sx * 0.4), y0 + 0.26, 0.11], { r: 0.008, seg: 1 });
  p.box(body, [xp - 0.05, y0 + 0.16, 0.0], [xp + 0.05, y0 + 0.26 + up, 0.09], { r: 0.008, seg: 1 });
  // 排水の管（下へ）
  p.tube(DARK, [[sx * 0.2, y0 + 0.05, 0.2], [sx * 0.25, y0 + 0.02, 0.28], [sx * 0.3, 0.005, 0.42]], 0.008, { seg: 8, radial: 4 });
}

/** 電力量計（台の板・本体・透明のふた・目盛りの板・表示・端子のふた・下へ出る電線の管）。壁の面 z = 0、本体の下 y = 0 */
export function meterBox(p: Prop, o: { body?: string } = {}): void {
  const body = o.body ?? '#cfd2c8';
  p.box(shade(body, -0.15), [-0.13, -0.04, 0], [0.13, 0.36, 0.02], { r: 0.004, seg: 1 });
  p.box(body, [-0.09, 0.06, 0.02], [0.09, 0.3, 0.1], { r: 0.014, seg: 1 });
  p.box(DARK, [-0.08, 0.02, 0.02], [0.08, 0.06, 0.09], { r: 0.006, seg: 1 });
  p.box(PAPER, [-0.07, 0.15, 0.1], [0.07, 0.27, 0.103], { shadow: false });
  p.box(DARK, [-0.05, 0.2, 0.103], [0.03, 0.225, 0.105], { shadow: false });
  p.box('#c84a40', [0.035, 0.205, 0.103], [0.055, 0.22, 0.105], { shadow: false });
  p.box('#e6eeea', [-0.085, 0.1, 0.1], [0.085, 0.29, 0.125], { kind: 'glass', r: 0.012, seg: 1, shadow: false });
  p.rod(shade(body, -0.25), [0, 0.02, 0.05], [0, -0.55, 0.05], 0.016, { radial: 6 });
}

const DRINK_COLORS = ['#c94a45', '#3a6fb0', '#e8e4d6', '#d9a43a', '#4f9a64', '#e07b39', '#2d3f55', '#b8d7e3', '#8a5a3b', '#f0d24a'];

/**
 * 飲料の自動販売機（共通の小物 vendingMachine を写して直した版）。共通の版は筐体の箱が見本の窓の前の面（z1）まで詰まっていて、
 * 光る背の板と見本が箱の中に隠れる（窓が筐体の色の板に見える）。ここでは筐体を窓の所だけ空けた（背・左右・上下の板）。
 * 缶・ボトルの丸みの分割も少し減らした（場面に 2 台並ぶ）。inner を渡すと、窓の中の棚と見本をその材質で作る
 * （見本は中の灯りで照らされて明るい: 場所では日なたの段の材質を渡す）
 */
export function drinkVending(p: Prop, o: { body?: string; accent?: string; lit?: string; cold?: string; hot?: string; goodsColors?: string[]; inner?: PropMats } = {}): void {
  const body = o.body ?? '#e9ece6';
  const accent = o.accent ?? '#3d78b8';
  const lit = o.lit ?? '#f4f7ee';
  const dark = '#22302f';
  const W = 1.0;
  const H = 1.83;
  const z0 = -0.36;
  const z1 = 0.33; // 筐体の前の面
  const zf = 0.36; // 扉の前の面
  const wx = W / 2 - 0.06;
  const wy0 = 0.98;
  const wy1 = 1.72;
  const back = z1 - 0.06;
  // 筐体（窓の奥の背の箱・窓の左右と上下の板）・台座・天板のひさし
  p.box(body, [-W / 2, 0.06, z0], [W / 2, H, back - 0.01], { r: 0.025 });
  for (const s of [-1, 1]) p.box(body, [s < 0 ? -W / 2 : wx, 0.06, back - 0.02], [s < 0 ? -wx : W / 2, H, z1]);
  p.box(body, [-wx, 0.06, back - 0.02], [wx, wy0, z1]);
  p.box(body, [-wx, wy1, back - 0.02], [wx, H, z1]);
  p.box(dark, [-W / 2 + 0.02, 0, z0 + 0.02], [W / 2 - 0.02, 0.07, z1 - 0.02], { r: 0.01 });
  p.box(body, [-W / 2 - 0.005, H - 0.05, z0 - 0.005], [W / 2 + 0.005, H + 0.01, zf + 0.01], { r: 0.012 });
  // 側面の広告の板（縦の帯）
  for (const s of [-1, 1]) {
    p.box(accent, [s * (W / 2) - 0.004, 0.25, -0.25], [s * (W / 2) + 0.004, 1.55, 0.2], { r: 0.003 });
    p.box(body, [s * (W / 2) - 0.006, 1.3, -0.2], [s * (W / 2) + 0.006, 1.42, 0.15]);
  }
  // 扉（見本の窓の周りの枠 + 窓の下の板）
  p.box(body, [-W / 2 + 0.01, wy1, z1], [W / 2 - 0.01, H - 0.05, zf], { r: 0.01 });
  p.box(body, [-W / 2 + 0.01, wy0, z1], [-wx, wy1, zf], { r: 0.008 });
  p.box(body, [wx, wy0, z1], [W / 2 - 0.01, wy1, zf], { r: 0.008 });
  p.box(body, [-W / 2 + 0.01, 0.07, z1], [W / 2 - 0.01, wy0, zf], { r: 0.012 });
  // 上の帯（銘柄の帯・光る）
  p.box(accent, [-wx, wy1 + 0.015, zf], [wx, H - 0.07, zf + 0.008], { r: 0.004 });
  p.box(lit, [-wx + 0.05, wy1 + 0.035, zf + 0.008], [wx - 0.05, H - 0.09, zf + 0.012], { kind: 'glow', shadow: false });
  // 見本の窓の中: 光る背の板・3 段の棚・見本・値札・押しボタン
  p.box(lit, [-wx, wy0, back - 0.01], [wx, wy1, back], { kind: 'glow', shadow: false });
  const rows = 3;
  const per = 9;
  const cols = o.goodsColors ?? DRINK_COLORS;
  const rowH = (wy1 - wy0) / rows;
  const g = o.inner ? new Prop(p.sink, o.inner, p.m) : p;
  (g as { r: () => number }).r = p.r;
  for (let i = 0; i < rows; i++) {
    const y = wy0 + i * rowH;
    g.box('#cfd6d2', [-wx, y, back], [wx, y + 0.012, z1 + 0.01]);
    p.box('#fbfdf8', [-wx, y + 0.012, z1 - 0.005], [wx, y + 0.032, z1 + 0.012], { kind: 'glow', shadow: false });
    const step = (2 * wx - 0.04) / per;
    for (let j = 0; j < per; j++) {
      const cx = -wx + 0.02 + step * (j + 0.5);
      const col = cols[Math.floor(p.r() * cols.length)];
      const cap = p.r() < 0.5 ? '#f2f2ec' : col;
      const s = g.sub([cx, y + 0.034, (back + z1) / 2]);
      if (p.r() < 0.45) {
        // 缶（350 ml: 直径 66 mm・高さ 122 mm）
        const r = 0.033;
        s.lathe(col, [[0, 0], [r * 0.85, 0], [r, 0.01], [r, 0.115], [r * 0.82, 0.13], [0, 0.13]], [0, 0, 0], { seg: 12, shadow: false });
      } else {
        // ペットボトル（500 ml: 直径 65 mm・高さ 205 mm）: 胴・ラベル・肩・首・ふた
        const r = 0.032;
        const prof: V2[] = [[0, 0], [r * 0.9, 0], [r, 0.012], [r, 0.12], [r * 0.95, 0.14], [r * 0.45, 0.185], [r * 0.4, 0.2], [0, 0.2]];
        s.lathe('#d8e6e6', prof, [0, 0, 0], { seg: 12, shadow: false });
        s.cyl(col, [0, 0.07, 0], r + 0.002, 0.07, { seg: 12, shadow: false });
        s.cyl(cap, [0, 0.207, 0], r * 0.42, 0.018, { seg: 8, shadow: false });
      }
      // 押しボタン（見本の下。冷たい = 青、温かい = 赤。下の段は温かいが多い）
      const hot = i === 0 && p.r() < 0.6;
      p.box(hot ? (o.hot ?? '#d9504a') : (o.cold ?? '#3d7fd0'), [cx - step * 0.28, y + 0.014, z1 + 0.012], [cx + step * 0.28, y + 0.028, z1 + 0.016], { kind: 'glow', shadow: false });
    }
  }
  // 窓のガラス（扉の前の面より少し奥）
  p.box('#dcebea', [-wx, wy0, zf - 0.012], [wx, wy1, zf - 0.006], { kind: 'glass', shadow: false });
  // 窓の下: 左に広告の板、右に投入口の板（硬貨・紙幣・返却レバー・表示・釣り銭の口）
  p.box(accent, [-wx, 0.62, zf], [0.02, 0.92, zf + 0.008], { r: 0.006 });
  p.box('#ffffff', [-wx + 0.04, 0.72, zf + 0.008], [-0.05, 0.84, zf + 0.011], { shadow: false });
  const coin = p.sub([0.26, 0, zf]);
  coin.box('#3a4646', [-0.18, 0.6, 0], [0.18, 0.94, 0.012], { r: 0.008 });
  coin.box('#9fb0aa', [-0.15, 0.86, 0.012], [-0.03, 0.91, 0.018], { r: 0.004 });
  coin.box('#111a1a', [-0.13, 0.875, 0.018], [-0.05, 0.882, 0.02]);
  coin.box('#9fb0aa', [0.0, 0.78, 0.012], [0.15, 0.84, 0.02], { r: 0.004 });
  coin.box('#111a1a', [0.02, 0.8, 0.02], [0.13, 0.812, 0.022]);
  coin.box('#3fb07a', [-0.15, 0.7, 0.012], [-0.03, 0.76, 0.016], { kind: 'glow', shadow: false });
  coin.box('#c8d0cc', [0.04, 0.66, 0.012], [0.12, 0.74, 0.03], { r: 0.008 });
  coin.box('#111a1a', [-0.14, 0.62, 0.012], [-0.04, 0.66, 0.025], { r: 0.006 });
  // 取り出し口（暗い口・ふた・枠・札）・鍵穴の板
  p.box('#5f6c6a', [-0.4, 0.12, zf], [0.22, 0.44, zf + 0.012], { r: 0.012 });
  p.box('#0f1717', [-0.36, 0.16, zf + 0.004], [0.18, 0.4, zf + 0.014]);
  p.box('#76837f', [-0.355, 0.165, zf + 0.012], [0.175, 0.39, zf + 0.022], { r: 0.008 });
  p.box('#ffffff', [-0.3, 0.46, zf], [0.12, 0.5, zf + 0.008]);
  p.box(dark, [0.28, 0.14, zf], [0.42, 0.26, zf + 0.008], { r: 0.004 });
  p.cyl('#c8d0cc', [0.35, 0.2, zf + 0.012], 0.018, 0.012, { axis: 'z', seg: 10 });
  p.collide([-W / 2, 0, z0], [W / 2, H + 0.01, zf]);
}
