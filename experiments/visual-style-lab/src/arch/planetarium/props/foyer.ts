import type { Prop } from '../../../props/kit.ts';

/**
 * 回廊（ホワイエ）の作り付けと展示の小物（実寸。局所の座標: 床 y = 0、正面 +z、背 -z）。部位ごとに色を分ける（色は造りに従う）。
 * - オーラリー（太陽系の模型）: 丸い台・軸・太陽（光る）・腕・8 つの惑星（土星の環）・軌道の輪
 * - 吊った惑星の模型: 天井の受け・吊り棒・球（環つき）
 * - コインロッカー: 本体の枠・扉 1 枚ずつ（隙間）・鍵と番号の札・台輪・上の光る料金の板
 * - 作り付けの長椅子の小部屋: 座の台・座のクッション 2 つ・背のクッション 2 つ・両脇の袖の板・上の棚と下向きの光の帯
 * - 扉の板（開いて壁に沿う）: 板・押し板・取っ手の棒・蹴り板・蝶番
 * - 出入口の上の案内の箱（光る題の帯と番号）・誘導灯（緑の箱と白い絵）・案内図の電飾の板
 * - 壁の手すり（受けの金物と丸い棒）は場面で弧に沿って置く
 */

const C = {
  base: '#1d2c35',
  baseDark: '#0e181e',
  metal: '#6f8792',
  steel: '#8ea2ac',
  brass: '#8c7a55',
  sunGlow: '#a8783a',
  cool: '#bfe8ff',
  // 案内の箱の光る題（大ドームの水色。白く飛ばない明るさ）
  sign: '#6fb8d8',
  warm: '#ffe6c0',
  white: '#d9e2e6',
  lockerBody: '#2f4652',
  lockerDoor: '#3d5866',
  lockerDoor2: '#36505e',
  fabric: '#22404e',
  fabric2: '#1b3542',
  wood: '#5a4636',
  door: '#1a2f3b',
  exit: '#2f9a68',
};

/** 惑星の色（水星〜海王星）・半径（模型の m） */
const PLANETS: [string, number][] = [
  ['#9a948c', 0.03],
  ['#d6bf8a', 0.05],
  ['#5f9fd0', 0.055],
  ['#c27454', 0.04],
  ['#d2b08a', 0.13],
  ['#dcc898', 0.11],
  ['#9fd4dc', 0.075],
  ['#5f84d4', 0.072],
];

/** オーラリー（太陽系の模型）: 台の直径 1.6 m・高さ 2.0 m。腕の長さは外ほど長く、角度は決まった乱数 */
export function orrery(p: Prop): void {
  // 台（2 段の丸い台と縁の真鍮の帯）
  p.lathe(C.baseDark, [[0, 0], [0.8, 0], [0.8, 0.08], [0.74, 0.1], [0.72, 0.62], [0.78, 0.66], [0.78, 0.72], [0, 0.72]], [0, 0, 0], { seg: 48, collide: true });
  p.torus(C.brass, [0, 0.69, 0], 0.78, 0.012, { axis: 'y', seg: 48, radial: 5 });
  // 台の上の暦の目盛りの輪（真鍮の板の細い輪）
  p.torus(C.brass, [0, 0.725, 0], 0.62, 0.008, { axis: 'y', seg: 40, radial: 4 });
  // 軸と太陽
  p.cyl(C.metal, [0, 1.1, 0], 0.025, 0.76, { seg: 12 });
  p.ball(C.sunGlow, [0, 1.62, 0], 0.13, { kind: 'glow', seg: 24, shadow: false });
  // 惑星: 軸から腕で（腕の高さを少しずつ変える）
  for (let i = 0; i < PLANETS.length; i++) {
    const [col, r] = PLANETS[i];
    const R = 0.28 + i * 0.13;
    const t = p.r() * Math.PI * 2;
    const y = 1.12 + i * 0.045;
    const x = Math.cos(t) * R;
    const z = Math.sin(t) * R;
    p.rod(C.metal, [0, y, 0], [x, y, z], 0.006, { shadow: false });
    p.rod(C.metal, [x, y, z], [x, y + 0.06 + r, z], 0.005, { shadow: false });
    p.ball(col, [x, y + 0.06 + r * 2, z], r, { seg: 16 });
    if (i === 5) {
      const s = p.sub([x, y + 0.06 + r * 2, z], 0.3, { roll: 0.45 });
      s.torus('#c9b88a', [0, 0, 0], r * 1.9, r * 0.25, { axis: 'y', seg: 32 });
    }
    // 軌道の輪（細い真鍮の輪。台の上の高さ）
    p.torus(C.brass, [0, 0.74, 0], R, 0.004, { axis: 'y', seg: 40, radial: 4, shadow: false });
  }
  // 台の前の説明の板
  const tag = p.sub([0, 0.6, 0.79], 0, { pitch: -0.5 });
  tag.box(C.brass, [-0.22, -0.08, 0], [0.22, 0.08, 0.01], { shadow: false });
  tag.box(C.baseDark, [-0.17, 0.02, 0.011], [0.12, 0.035, 0.013], { shadow: false });
  tag.box(C.baseDark, [-0.17, -0.02, 0.011], [0.17, -0.01, 0.013], { shadow: false });
}

/** 吊った惑星の模型（y = 0 が天井。吊りの長さ L・半径 r・色・環） */
export function hangingPlanet(p: Prop, L: number, r: number, col: string, ring = false, noBall = false): void {
  // 天井の受け・吊りの線（見える太さの金属の線）・球の上の留め金
  p.cyl(C.baseDark, [0, -0.015, 0], 0.06, 0.03, { shadow: false });
  p.rod(C.steel, [0, -0.02, 0], [0, -L + r, 0], 0.006, { shadow: false });
  p.cyl(C.metal, [0, -L + r + 0.01, 0], 0.012, 0.025, { seg: 8, shadow: false });
  if (!noBall) p.ball(col, [0, -L, 0], r, { seg: 22 });
  if (ring) {
    const s = p.sub([0, -L, 0], 0.4, { roll: 0.35 });
    s.torus('#c9b88a', [0, 0, 0], r * 1.8, r * 0.18, { axis: 'y', seg: 32, radial: 5 });
    s.torus('#a8986e', [0, 0, 0], r * 1.45, r * 0.1, { axis: 'y', seg: 32, radial: 4 });
  }
}

/** コインロッカー（幅 cols × 0.38 m・高さ 1.85 m・奥行き 0.5 m）。扉 1 枚ずつ（2 色を交互: 扉の型の違い）と鍵・番号の札 */
export function lockers(p: Prop, cols = 5, rows = 4): void {
  const cw = 0.38;
  const W = cols * cw;
  const h0 = 0.1;
  const H = 1.85;
  const rh = (H - h0 - 0.12) / rows;
  // 台輪・本体・上の板
  p.box(C.baseDark, [-W / 2 + 0.02, 0, -0.48], [W / 2 - 0.02, h0, -0.02]);
  p.box(C.lockerBody, [-W / 2, h0, -0.5], [W / 2, H, -0.02], { collide: true });
  p.box(C.lockerBody, [-W / 2 - 0.01, H - 0.12, -0.5], [W / 2 + 0.01, H, 0.0], { r: 0.008 });
  // 上の光る料金の板
  p.box(C.cool, [-W / 2 + 0.2, H - 0.09, 0.001], [-W / 2 + 0.9, H - 0.04, 0.006], { kind: 'glow', shadow: false });
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x0 = -W / 2 + c * cw + 0.012;
      const x1 = x0 + cw - 0.024;
      const y0 = h0 + r * rh + 0.012;
      const y1 = y0 + rh - 0.024;
      p.box((c + r) % 2 ? C.lockerDoor : C.lockerDoor2, [x0, y0, -0.025], [x1, y1, -0.005], { shadow: false });
      // 鍵（丸い頭）・番号の札・通気の溝
      p.cyl(C.steel, [x1 - 0.06, (y0 + y1) / 2, 0.0], 0.018, 0.012, { axis: 'z', seg: 6, shadow: false });
      p.box(C.white, [x0 + 0.03, y1 - 0.06, -0.005], [x0 + 0.1, y1 - 0.03, -0.002], { shadow: false });
      p.box(C.lockerBody, [x0 + 0.04, y0 + 0.05, -0.0048], [x1 - 0.1, y0 + 0.065, -0.003], { shadow: false });
    }
}

/** 作り付けの長椅子の小部屋（幅 w・奥行き 0.75 m・高さ 2.2 m）。背の側（-z）が壁 */
export function seatAlcove(p: Prop, w = 2.4): void {
  const d = 0.72;
  // 袖の板（両脇）と上の棚（下向きの光の帯）
  for (const s of [-1, 1]) p.box(C.wood, [s * (w / 2) - 0.04, 0, -d], [s * (w / 2) + 0.04, 2.15, 0.02], { r: 0.008, collide: true });
  p.box(C.wood, [-w / 2 - 0.04, 2.15, -d], [w / 2 + 0.04, 2.22, 0.06], { r: 0.008 });
  p.box('#8a7258', [-w / 2 + 0.1, 2.135, -0.02], [w / 2 - 0.1, 2.15, 0.03], { kind: 'glow', shadow: false });
  // 背の板（壁の前）
  p.box(C.base, [-w / 2 + 0.04, 0, -d], [w / 2 - 0.04, 2.15, -d + 0.04]);
  // 座の台と座・背のクッション（2 つずつ。継ぎ目で分かれる）
  p.box(C.baseDark, [-w / 2 + 0.04, 0, -d + 0.04], [w / 2 - 0.04, 0.32, -0.12]);
  p.box(C.baseDark, [-w / 2 + 0.06, 0.0, -0.14], [w / 2 - 0.06, 0.06, -0.1]);
  const half = (w - 0.12) / 2;
  for (let i = 0; i < 2; i++) {
    const x0 = -w / 2 + 0.06 + i * half;
    p.box(i ? C.fabric : C.fabric2, [x0 + 0.01, 0.32, -d + 0.1], [x0 + half - 0.01, 0.45, -0.08], { r: 0.035 });
    const back = p.sub([x0 + half / 2, 0.47, -d + 0.08], 0, { pitch: -0.12 });
    back.box(i ? C.fabric2 : C.fabric, [-half / 2 + 0.01, 0, 0], [half / 2 - 0.01, 0.55, 0.12], { r: 0.04 });
  }
  // 読書灯（袖の内側の小さな腕と笠）
  for (const s of [-1, 1]) {
    const a = p.sub([s * (w / 2 - 0.05), 1.45, -0.35], s > 0 ? -Math.PI / 2 : Math.PI / 2);
    a.rod(C.metal, [0, 0, 0], [0, 0.05, 0.16], 0.008, { shadow: false });
    a.cyl(C.baseDark, [0, 0.03, 0.2], 0.05, 0.07, { radiusTop: 0.025, seg: 14, shadow: false });
    a.cyl(C.warm, [0, -0.008, 0.2], 0.04, 0.004, { kind: 'glow', seg: 14, shadow: false });
  }
}

/** 扉の板（幅 w・高さ h。正面 +z が回廊の側）: 押し板・取っ手の棒・蹴り板・蝶番 */
export function doorLeaf(p: Prop, w = 0.98, h = 2.42, hingeLeft = true): void {
  p.box(C.door, [-w / 2, 0.01, -0.025], [w / 2, h, 0.025], { r: 0.006 });
  // 縁の金物（細い框）
  p.box(C.baseDark, [-w / 2, 0.01, 0.025], [w / 2, 0.04, 0.03], { shadow: false });
  // 蹴り板
  p.box(C.steel, [-w / 2 + 0.04, 0.03, 0.025], [w / 2 - 0.04, 0.28, 0.029], { shadow: false });
  // 框組みの扉: 上下 2 つの鏡板の縁の見切り（細い枠）
  for (const [y0, y1] of [
    [0.36, 1.0],
    [1.55, h - 0.12],
  ] as [number, number][]) {
    const x0 = -w / 2 + 0.1;
    const x1 = w / 2 - 0.1;
    p.box(C.baseDark, [x0, y0, 0.025], [x1, y0 + 0.025, 0.035], { shadow: false });
    p.box(C.baseDark, [x0, y1 - 0.025, 0.025], [x1, y1, 0.035], { shadow: false });
    p.box(C.baseDark, [x0, y0, 0.025], [x0 + 0.025, y1, 0.035], { shadow: false });
    p.box(C.baseDark, [x1 - 0.025, y0, 0.025], [x1, y1, 0.035], { shadow: false });
  }
  // 押し板と取っ手の棒（取っ手は蝶番の反対の側）
  const s = hingeLeft ? 1 : -1;
  p.box(C.steel, [s * (w / 2 - 0.16) - 0.06, 1.15, 0.025], [s * (w / 2 - 0.16) + 0.06, 1.45, 0.029], { shadow: false });
  p.rod(C.steel, [-w / 2 + 0.12, 1.0, 0.07], [w / 2 - 0.12, 1.0, 0.07], 0.016, { shadow: false });
  for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) p.rod(C.steel, [x, 1.0, 0.025], [x, 1.0, 0.075], 0.012, { shadow: false });
  // 蝶番（3 つ）
  for (const y of [0.25, 1.2, 2.15]) p.cyl(C.metal, [-s * (w / 2), y, 0.0], 0.012, 0.1, { seg: 8, shadow: false });
  // 遮光の詰め物の縁（ゴムの帯）
  p.box(C.baseDark, [-s * (w / 2) - 0.004, 0.02, -0.025], [-s * (w / 2) + 0.004, h - 0.02, 0.025], { shadow: false });
}

/** 出入口の上の案内の箱（幅 w。正面 +z）: 箱・光る題の帯・番号の丸・下の縁 */
export function doorHeader(p: Prop, w: number, n: number): void {
  p.box(C.baseDark, [-w / 2, 0, -0.12], [w / 2, 0.42, 0.0], { r: 0.01 });
  p.box(C.brass, [-w / 2, -0.02, -0.12], [w / 2, 0.0, 0.01], { shadow: false });
  // 題の帯（光る細い帯 2 本: 大きい題と小さい行）
  p.box(C.sign, [-w / 2 + 0.55, 0.22, 0.001], [w / 2 - 0.25, 0.3, 0.005], { kind: 'glow', shadow: false });
  p.box(C.sign, [-w / 2 + 0.55, 0.11, 0.001], [-w / 2 + 0.55 + (w - 0.8) * 0.55, 0.14, 0.005], { kind: 'glow', shadow: false });
  // 番号の丸（光る円と、数の数だけの小さな点）
  p.cyl(C.sign, [-w / 2 + 0.27, 0.21, 0.002], 0.15, 0.006, { axis: 'z', kind: 'glow', seg: 24, shadow: false });
  p.cyl(C.baseDark, [-w / 2 + 0.27, 0.21, 0.006], 0.12, 0.004, { axis: 'z', seg: 24, shadow: false });
  for (let i = 0; i < n; i++) p.box(C.sign, [-w / 2 + 0.27 - 0.07 + i * 0.035, 0.19, 0.009], [-w / 2 + 0.27 - 0.05 + i * 0.035, 0.24, 0.011], { kind: 'glow', shadow: false });
}

/** 誘導灯（避難口。緑の地に白い絵。0.4 × 0.15） */
export function exitSign(p: Prop): void {
  p.box(C.baseDark, [-0.22, -0.09, -0.06], [0.22, 0.09, 0.0], { r: 0.008, shadow: false });
  p.box(C.exit, [-0.2, -0.075, 0.0], [0.2, 0.075, 0.004], { kind: 'glow', shadow: false });
  // 白い絵（走る人と扉の形の代わりの、白い 2 つの形）
  p.box(C.white, [-0.17, -0.05, 0.0045], [-0.06, 0.05, 0.006], { kind: 'glow', shadow: false });
  p.box(C.white, [0.0, -0.012, 0.0045], [0.15, 0.012, 0.006], { kind: 'glow', shadow: false });
}

/** 案内図の電飾の板（幅 1.6・高さ 1.1。客席の区画の円と扉の番号）。絵は場面の図の板の材質で別に貼る。ここは枠と脚 */
export function guideFrame(p: Prop, w = 1.6, h = 1.1, y0 = 1.0): void {
  p.box(C.baseDark, [-w / 2 - 0.05, y0 - 0.05, -0.08], [w / 2 + 0.05, y0 + h + 0.05, -0.01], { r: 0.01 });
  p.box(C.brass, [-w / 2 - 0.05, y0 - 0.07, -0.08], [w / 2 + 0.05, y0 - 0.05, 0.0], { shadow: false });
}

/** 壁の手すりの受けの金物（壁から 9 cm） */
export function railBracket(p: Prop, y: number): void {
  p.box(C.metal, [-0.03, y - 0.05, -0.01], [0.03, y + 0.05, 0.0], { shadow: false });
  p.rod(C.steel, [0, y - 0.02, 0.0], [0, y - 0.02, 0.07], 0.008, { shadow: false });
  p.rod(C.steel, [0, y - 0.02, 0.07], [0, y, 0.09], 0.008, { shadow: false });
}

/**
 * 壁の陳列棚（幅 w・高さ h・出 0.2 m。局所の原点は棚の下の中心・壁の面、正面 +z）: 枠・明るい奥の板（中から照らす）・
 * ガラス・2 段の棚板・小さな展示物（隕石のかけら・小さな惑星・レンズ）と名札
 */
export function wallVitrine(p: Prop, w = 1.0, h = 1.1): void {
  const d = 0.2;
  // 枠（4 辺）と奥の板
  p.box(C.baseDark, [-w / 2 - 0.05, -0.05, 0], [w / 2 + 0.05, 0, d], { shadow: false });
  p.box(C.baseDark, [-w / 2 - 0.05, h, 0], [w / 2 + 0.05, h + 0.05, d], { shadow: false });
  for (const s of [-1, 1]) p.box(C.baseDark, [s * (w / 2) - 0.025, 0, 0], [s * (w / 2) + 0.025, h, d], { shadow: false });
  p.box('#2f4a58', [-w / 2, 0, 0.0], [w / 2, h, 0.01], { kind: 'glow', shadow: false });
  // 上の灯りの帯（ガラスの中を照らす）
  p.box(C.warm, [-w / 2 + 0.05, h - 0.03, 0.04], [w / 2 - 0.05, h - 0.015, d - 0.04], { kind: 'glow', shadow: false });
  // 棚板 2 段と小さな展示物
  for (const [k, y] of [[0, 0.02], [1, h * 0.52]] as [number, number][]) {
    p.box(C.steel, [-w / 2 + 0.03, y, 0.012], [w / 2 - 0.03, y + 0.012, d - 0.02], { shadow: false });
    const s = p.sub([0, y + 0.012, d / 2]);
    if (k === 0) {
      s.ball('#4a4440', [-0.28, 0.05, 0], [0.07, 0.05, 0.05], { seg: 8 });
      s.ball('#6a6058', [-0.05, 0.035, 0], [0.05, 0.035, 0.04], { seg: 8 });
      s.ball('#3d3a38', [0.22, 0.06, 0], [0.08, 0.06, 0.06], { seg: 8 });
    } else {
      s.cyl(C.metal, [-0.25, 0.04, 0], 0.008, 0.08, { seg: 6 });
      s.ball('#5f9fd0', [-0.25, 0.12, 0], 0.045, { seg: 12 });
      s.cyl(C.metal, [0.0, 0.04, 0], 0.008, 0.08, { seg: 6 });
      s.ball('#c27454', [0.0, 0.11, 0], 0.035, { seg: 12 });
      s.cyl(C.brass, [0.25, 0.07, 0], 0.05, 0.02, { axis: 'z', seg: 16 });
      s.box(C.baseDark, [0.22, 0, -0.02], [0.28, 0.05, 0.02]);
    }
    for (const x of [-0.25, 0.0, 0.25]) s.box(C.white, [x - 0.04, 0.001, d / 2 - 0.035], [x + 0.04, 0.004, d / 2 - 0.015], { shadow: false });
  }
  // ガラス
  p.box('#a8d8ea', [-w / 2 + 0.02, 0, d - 0.012], [w / 2 - 0.02, h, d - 0.006], { kind: 'glass', shadow: false });
}
