import type { Prop, V2 } from '../kit.ts';

/**
 * 車・自転車（日本の地方の駅前・学校の駐輪場）。前が +z、床 y = 0。
 * 寸法の根拠: 軽自動車 全長 3.39 m・全幅 1.47 m。背の高い軽（ワゴン）全高 1.65〜1.8 m、セダン型の軽 1.5 m。
 * 軽トラック 全高 1.8 m・荷台の床 0.65 m・あおり 0.3 m。タイヤ 145/80R12 ≈ 直径 0.56 m。ママチャリ 26 型（車輪の直径 0.66 m）
 */

export interface CarOpts {
  body?: string;
  /** 'wagon' = 背の高い軽（箱型）、'hatch' = 背の低い軽 */
  type?: 'wagon' | 'hatch';
  glass?: string;
  trim?: string;
}

/** 弧の点（中心 c・半径 r・角度 a0 → a1。(z, y) の平面） */
function arc(c: V2, r: number, a0: number, a1: number, n: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return out;
}

/** 車輪（タイヤ・ホイール・ハブの穴）。x はホイールの外の面の位置、side = ±1（外の向き） */
function wheel(p: Prop, z: number, x: number, side: number, R = 0.28, Wt = 0.155, rim = '#c9cfcc'): void {
  const tire = '#1f2626';
  // タイヤの断面を軸（x）のまわりに回す: 内側の縁 → 肩 → 接地面 → 肩 → 外側の縁
  const h = Wt / 2;
  const prof: V2[] = [[R * 0.62, -h * 0.9], [R * 0.9, -h], [R, -h * 0.7], [R, h * 0.7], [R * 0.9, h], [R * 0.62, h * 0.9]];
  p.lathe(tire, prof, [x - side * h, R, z], { axis: 'x', seg: 22 });
  // ホイール（皿）と穴・ナット
  p.cyl(rim, [x - side * 0.01, R, z], R * 0.6, 0.03, { axis: 'x', seg: 20 });
  p.cyl('#7b8683', [x + side * 0.008, R, z], R * 0.18, 0.02, { axis: 'x', seg: 12 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    p.cyl('#3a4444', [x + side * 0.006, R + Math.sin(a) * R * 0.38, z + Math.cos(a) * R * 0.38], R * 0.09, 0.02, { axis: 'x', seg: 8 });
  }
}

/** 薄い板（2 点 a → b の線分を、外の向き n へ off だけ出して、x の範囲へ押し出す。窓ガラス・あおり） */
function skin(p: Prop, color: string, a: V2, b: V2, x0: number, x1: number, off: number, t: number, kind?: 'glass' | 'solid'): void {
  const dz = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dz, dy);
  // 外の向き: 線分の進む向きを右へ 90°（輪郭は反時計回りなので外）
  const nz = dy / l;
  const ny = -dz / l;
  const o1 = off;
  const o2 = off + t;
  p.extrude(color, [[a[0] + nz * o1, a[1] + ny * o1], [b[0] + nz * o1, b[1] + ny * o1], [b[0] + nz * o2, b[1] + ny * o2], [a[0] + nz * o2, a[1] + ny * o2]], 'zy', x0, x1, { kind, shadow: false });
}

/** 軽自動車（背の高いワゴン型 / 背の低い型） */
export function car(p: Prop, o: CarOpts = {}): void {
  const body = o.body ?? '#e7ebe6';
  const glass = o.glass ?? '#2b3e45';
  const trim = o.trim ?? '#2a3233';
  const tall = (o.type ?? 'wagon') === 'wagon';
  const W = 1.47;
  const L = 3.39;
  const R = 0.28; // タイヤの半径
  const zf = 1.13; // 前輪
  const zr = -1.12; // 後輪
  const ar = 0.34; // 輪の穴の半径
  const yb = 0.2; // 車体の下の高さ
  const roof = tall ? 1.66 : 1.5;
  const belt = tall ? 1.02 : 0.95; // 窓の下の線
  const hood = tall ? 0.98 : 0.86;
  const ws: V2 = tall ? [1.2, 1.02] : [1.05, 0.92]; // 前のガラスの下
  const wt: V2 = tall ? [0.62, roof - 0.04] : [0.15, roof - 0.04]; // 前のガラスの上
  // 横から見た輪郭（後ろの下から前へ・輪の穴を上に回り・前を上がって・屋根を後ろへ・後ろを下る）
  const outline: V2[] = [[-L / 2 + 0.06, yb]];
  // 輪の穴: 車体の下の高さ yb で円を切る角（負の角）。z の小さい側（π - th）から上を回って大きい側（th）へ
  const th = Math.asin((yb - R) / ar);
  outline.push(...arc([zr, R], ar, Math.PI - th, th, 12));
  outline.push(...arc([zf, R], ar, Math.PI - th, th, 12));
  outline.push(
    [L / 2 - 0.06, yb + 0.02],
    [L / 2, 0.36],
    [L / 2, 0.62],
    [L / 2 - 0.05, hood - 0.08],
    [L / 2 - 0.3, hood],
    ws,
    wt,
    [wt[0] - 0.2, roof],
    [-L / 2 + 0.22, roof],
    [-L / 2 + 0.06, roof - 0.07],
    [-L / 2, belt - 0.05],
    [-L / 2, 0.42],
    [-L / 2 + 0.04, yb + 0.03],
  );
  p.extrude(body, outline, 'zy', -W / 2, W / 2, { bevel: 0.05, collide: true });
  // 輪の奥（暗い）: 輪の穴から向こうが見えないように
  for (const z of [zf, zr]) p.box('#141c1c', [-W / 2 + 0.14, yb, z - ar], [W / 2 - 0.14, R + ar * 0.9, z + ar], { shadow: false });
  // 窓: 前のガラス・後ろのガラス・横の窓（前のドア・後ろのドア・後ろの小窓）
  skin(p, glass, ws, wt, -W / 2 + 0.09, W / 2 - 0.09, 0.004, 0.006, 'solid');
  p.box(glass, [-W / 2 + 0.12, belt + 0.08, -L / 2 - 0.006], [W / 2 - 0.12, roof - 0.12, -L / 2 + 0.01], { shadow: false });
  const side = (z0: number, z1: number, topF = 0): void => {
    for (const s of [-1, 1]) {
      const x0 = s * (W / 2 + 0.002);
      p.extrude(glass, [[z0, belt + 0.03], [z1, belt + 0.03], [z1 - topF, roof - 0.1], [z0, roof - 0.1]], 'zy', Math.min(x0, x0 + s * 0.006), Math.max(x0, x0 + s * 0.006), { shadow: false });
    }
  };
  const wsTopZ = wt[0];
  side(0.12, ws[0] - 0.08, ws[0] - 0.08 - wsTopZ - 0.05);
  side(-0.98, 0.0);
  side(-L / 2 + 0.18, -1.08);
  // ドアの継ぎ目（縦の線）・取っ手
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.003);
    for (const z of [0.06, -1.03]) p.box(trim, [x - 0.003, yb + 0.12, z - 0.006], [x + 0.003, roof - 0.08, z + 0.006], { shadow: false });
    for (const z of [-0.05, -0.92]) p.box(trim, [x - s * 0.004 - 0.006, belt - 0.12, z - 0.07], [x + s * 0.004 + 0.006, belt - 0.09, z + 0.07], { r: 0.008, shadow: false });
    // 窓の下の黒い縁（ベルトモール）
    p.box(trim, [x - 0.006, belt + 0.01, -L / 2 + 0.15], [x + 0.006, belt + 0.035, ws[0] - 0.06], { shadow: false });
    // ミラー
    const m = p.sub([s * (W / 2 + 0.08), belt + 0.06, ws[0] - 0.22]);
    m.box(trim, [-0.07, 0, -0.03], [0.07, 0.03, 0.03], { r: 0.01 });
    m.box(body, [-0.08, 0.03, -0.05], [0.08, 0.15, 0.04], { r: 0.03 });
  }
  // 前: バンパー・グリル・ライト・ナンバー・ワイパー
  p.box(trim, [-W / 2 + 0.02, 0.24, L / 2 - 0.06], [W / 2 - 0.02, 0.46, L / 2 + 0.035], { r: 0.05 });
  p.box('#1a2222', [-0.36, 0.52, L / 2 - 0.02], [0.36, 0.66, L / 2 + 0.012], { r: 0.02 });
  for (const s of [-1, 1]) {
    p.box('#eef3ea', [s * 0.48 - 0.16, 0.66, L / 2 - 0.12], [s * 0.48 + 0.16, 0.8, L / 2 + 0.005], { r: 0.035 });
    p.box('#e3a54a', [s * 0.62 - 0.05, 0.6, L / 2 - 0.05], [s * 0.62 + 0.05, 0.64, L / 2 + 0.012], { r: 0.01 });
  }
  p.box('#f4f4ee', [-0.165, 0.29, L / 2 + 0.035], [0.165, 0.455, L / 2 + 0.045], { r: 0.008 });
  p.box('#5a7a52', [-0.15, 0.33, L / 2 + 0.045], [0.15, 0.42, L / 2 + 0.048], { shadow: false });
  for (const s of [-1, 1]) {
    const a: V2 = [ws[0] - 0.03, ws[1] + 0.02];
    const x0 = s * 0.08;
    p.rod(trim, [x0, a[1] + 0.02, a[0] - 0.04], [x0 + s * 0.5, a[1] + 0.06, a[0] - 0.08], 0.008);
  }
  // 後ろ: バンパー・縦長のテールランプ・ナンバー・ガラスの上のひさし
  p.box(trim, [-W / 2 + 0.02, 0.24, -L / 2 - 0.035], [W / 2 - 0.02, 0.48, -L / 2 + 0.06], { r: 0.05 });
  for (const s of [-1, 1]) p.box('#c8463f', [s * (W / 2 - 0.07) - 0.05, 0.62, -L / 2 - 0.01], [s * (W / 2 - 0.07) + 0.05, belt + (tall ? 0.15 : 0.02), -L / 2 + 0.03], { r: 0.02 });
  p.box('#f4f4ee', [-0.165, 0.5, -L / 2 - 0.02], [0.165, 0.665, -L / 2 - 0.01], { r: 0.008 });
  p.box(body, [-W / 2 + 0.1, roof - 0.1, -L / 2 - 0.05], [W / 2 - 0.1, roof - 0.04, -L / 2 + 0.1], { r: 0.02 });
  // 車輪
  for (const z of [zf, zr]) for (const s of [-1, 1]) wheel(p, z, s * (W / 2 - 0.03), s, R);
}

/** 軽トラック（キャブ・荷台・あおり・鳥居（荷台の前の柵）） */
export function keiTruck(p: Prop, o: { body?: string; glass?: string; trim?: string } = {}): void {
  const body = o.body ?? '#eef0ea';
  const glass = o.glass ?? '#2b3e45';
  const trim = o.trim ?? '#2a3233';
  const W = 1.47;
  const L = 3.39;
  const R = 0.27;
  const zf = 1.2;
  const zr = -1.02;
  const ar = 0.33;
  const yb = 0.22;
  const th = Math.asin((yb - R) / ar);
  // キャブ（横から見た輪郭。前輪の穴つき）
  const cab: V2[] = [
    [0.42, yb],
    ...arc([zf, R], ar, Math.PI - th, th, 12),
    [L / 2 - 0.04, yb + 0.02],
    [L / 2, 0.38],
    [L / 2, 0.82],
    [L / 2 - 0.06, 1.0],
    [L / 2 - 0.16, 1.7],
    [L / 2 - 0.3, 1.82],
    [0.5, 1.82],
    [0.42, 1.72],
  ];
  p.extrude(body, cab, 'zy', -W / 2, W / 2, { bevel: 0.04, collide: true });
  p.box('#141c1c', [-W / 2 + 0.14, yb, zf - ar], [W / 2 - 0.14, R + ar * 0.9, zf + ar], { shadow: false });
  // 前のガラス・横の窓・後ろの窓
  skin(p, glass, [L / 2 - 0.07, 1.04], [L / 2 - 0.17, 1.68], -W / 2 + 0.1, W / 2 - 0.1, 0.004, 0.006, 'solid');
  for (const s of [-1, 1]) {
    const x0 = s * (W / 2 + 0.002);
    p.extrude(glass, [[0.62, 1.08], [L / 2 - 0.2, 1.08], [L / 2 - 0.26, 1.7], [0.62, 1.7]], 'zy', Math.min(x0, x0 + s * 0.006), Math.max(x0, x0 + s * 0.006), { shadow: false });
    p.box(trim, [s * (W / 2 + 0.003) - 0.003, yb + 0.15, 0.58], [s * (W / 2 + 0.003) + 0.003, 1.75, 0.59], { shadow: false });
    const m = p.sub([s * (W / 2 + 0.08), 1.1, L / 2 - 0.3]);
    m.box(trim, [-0.07, 0, -0.03], [0.07, 0.03, 0.03], { r: 0.01 });
    m.box(body, [-0.08, 0.03, -0.05], [0.08, 0.15, 0.04], { r: 0.03 });
  }
  p.box(glass, [-W / 2 + 0.2, 1.25, 0.415], [W / 2 - 0.2, 1.65, 0.43], { shadow: false });
  // 前: バンパー・ライト・グリル・ナンバー
  p.box(trim, [-W / 2 + 0.02, 0.24, L / 2 - 0.05], [W / 2 - 0.02, 0.44, L / 2 + 0.035], { r: 0.04 });
  for (const s of [-1, 1]) p.box('#eef3ea', [s * 0.5 - 0.13, 0.62, L / 2 - 0.08], [s * 0.5 + 0.13, 0.76, L / 2 + 0.005], { r: 0.03 });
  p.box('#1a2222', [-0.3, 0.5, L / 2 - 0.02], [0.3, 0.6, L / 2 + 0.01], { r: 0.015 });
  p.box('#f4f4ee', [-0.165, 0.27, L / 2 + 0.035], [0.165, 0.435, L / 2 + 0.045], { r: 0.008 });
  // 荷台: 床・あおり（左右・後ろ）・鳥居・車台・後ろのランプ
  const bz0 = -L / 2;
  const bz1 = 0.4;
  const fy = 0.66;
  p.box(trim, [-W / 2 + 0.1, 0.3, bz0 + 0.1], [W / 2 - 0.1, fy - 0.04, bz1], {});
  p.box(body, [-W / 2, fy - 0.04, bz0], [W / 2, fy, bz1], { r: 0.01, collide: true });
  for (const s of [-1, 1]) {
    p.box(body, [s * W / 2 - 0.02, fy, bz0 + 0.02], [s * W / 2 + 0.02, fy + 0.3, bz1 - 0.02], { r: 0.008 });
    for (const z of [bz0 + 0.6, bz0 + 1.25]) p.box(trim, [s * (W / 2 + 0.02) - 0.004, fy + 0.02, z - 0.03], [s * (W / 2 + 0.02) + 0.004, fy + 0.28, z + 0.03], { shadow: false });
  }
  p.box(body, [-W / 2 + 0.02, fy, bz0], [W / 2 - 0.02, fy + 0.3, bz0 + 0.04], { r: 0.008 });
  p.box('#c8463f', [-W / 2 + 0.05, 0.42, bz0 - 0.02], [-W / 2 + 0.25, 0.56, bz0 + 0.02], { r: 0.01 });
  p.box('#c8463f', [W / 2 - 0.25, 0.42, bz0 - 0.02], [W / 2 - 0.05, 0.56, bz0 + 0.02], { r: 0.01 });
  // 鳥居（キャブの後ろの柵）
  const ty = 1.86;
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) p.rod(trim, [x, fy, bz1 - 0.04], [x, ty, bz1 - 0.04], 0.022);
  p.rod(trim, [-W / 2 + 0.06, ty, bz1 - 0.04], [W / 2 - 0.06, ty, bz1 - 0.04], 0.022);
  for (let i = 1; i < 7; i++) p.rod(trim, [-W / 2 + 0.06 + (i * (W - 0.12)) / 7, fy + 0.3, bz1 - 0.04], [-W / 2 + 0.06 + (i * (W - 0.12)) / 7, ty, bz1 - 0.04], 0.01);
  // 荷台の後輪の上の輪の囲い
  for (const s of [-1, 1]) p.box(trim, [s * (W / 2 - 0.08) - 0.08, yb, zr - ar], [s * (W / 2 - 0.08) + 0.08, fy - 0.04, zr + ar], {});
  for (const z of [zf, zr]) for (const s of [-1, 1]) wheel(p, z, s * (W / 2 - 0.03), s, R);
}

/** 自転車（ママチャリ: 低いまたぎ・前かご・泥よけ・チェーンのカバー・スタンド） */
export function bicycle(p: Prop, o: { frame?: string; basket?: string; standing?: boolean; detail?: 'full' | 'low' } = {}): void {
  // low: 駐輪場に何十台も並べるとき（スポークなし・輪を粗く・かごの縦の桟を減らす。三角形 約 1/4）
  const low = o.detail === 'low';
  const fr = o.frame ?? '#cfd9d6';
  const dark = '#1f2626';
  const metal = '#b7c1bd';
  const R = 0.33;
  const za = -0.52; // 後輪
  const zb = 0.55; // 前輪
  for (const z of [za, zb]) {
    p.torus(dark, [0, R, z], R - 0.018, 0.02, { axis: 'x', seg: low ? 16 : 28 });
    p.torus(metal, [0, R, z], R - 0.045, 0.008, { axis: 'x', seg: low ? 12 : 24 });
    for (let k = 0; k < (low ? 0 : 12); k++) {
      const a = (k / 12) * Math.PI * 2;
      p.rod(metal, [0, R, z], [0, R + Math.sin(a) * (R - 0.05), z + Math.cos(a) * (R - 0.05)], 0.0025, { radial: 4, shadow: false });
    }
    p.cyl(metal, [0, R, z], 0.03, 0.09, { axis: 'x', seg: 10 });
    // 泥よけ（上半分の弧）
    p.torus(fr, [0, R, z], R + 0.025, 0.018, { axis: 'x', seg: 18, arc: Math.PI * 0.95 });
  }
  const crank: [number, number, number] = [0, 0.3, -0.05];
  const seat: [number, number, number] = [0, 0.82, -0.28];
  const head: [number, number, number] = [0, 0.86, 0.38];
  const headLow: [number, number, number] = [0, 0.66, 0.43];
  // 低いまたぎの曲がった下の管・後ろの三角
  p.tube(fr, [headLow, [0, 0.42, 0.22], [0, 0.3, 0.05], crank], 0.02, { seg: 18 });
  p.rod(fr, crank, seat, 0.018);
  p.rod(fr, crank, [0, R, za], 0.012);
  p.rod(fr, seat, [0, R, za], 0.011);
  p.rod(fr, head, headLow, 0.022);
  // 前のフォーク・ハンドル（後ろへ曲がる）・握り
  p.rod(metal, headLow, [0, R, zb], 0.013);
  p.rod(metal, head, [0, 1.02, 0.36], 0.012);
  p.tube(metal, [[-0.3, 1.02, 0.22], [-0.2, 1.03, 0.33], [0, 1.03, 0.36], [0.2, 1.03, 0.33], [0.3, 1.02, 0.22]], 0.011, { seg: 16 });
  for (const s of [-1, 1]) p.cyl(dark, [s * 0.32, 1.02, 0.21], 0.016, 0.1, { axis: 'z', seg: 8 });
  // サドル・シートポスト
  p.rod(metal, seat, [0, 0.95, -0.31], 0.012);
  p.box(dark, [-0.08, 0.95, -0.42], [0.08, 1.0, -0.18], { r: 0.025 });
  // チェーンのカバー・ペダル・前かご・後ろの荷台・スタンド
  p.box(fr, [0.03, 0.24, -0.58], [0.05, 0.38, 0.06], { r: 0.012 });
  p.cyl(metal, [0.06, 0.3, -0.05], 0.09, 0.02, { axis: 'x', seg: 16 });
  for (const s of [-1, 1]) p.box(dark, [s * 0.14 - 0.05, 0.3 + s * 0.12, -0.05 - 0.03], [s * 0.14 + 0.05, 0.32 + s * 0.12, -0.05 + 0.03], { r: 0.005 });
  const bk = p.sub([0, 0.86, 0.62]);
  const bc = o.basket ?? metal;
  for (const y of [0, 0.22]) {
    bk.rod(bc, [-0.17, y, -0.12], [0.17, y, -0.12], 0.005, { radial: 4 });
    bk.rod(bc, [-0.17, y, 0.14], [0.17, y, 0.14], 0.005, { radial: 4 });
    bk.rod(bc, [-0.17, y, -0.12], [-0.17, y, 0.14], 0.005, { radial: 4 });
    bk.rod(bc, [0.17, y, -0.12], [0.17, y, 0.14], 0.005, { radial: 4 });
  }
  for (let i = 0; i <= (low ? 2 : 6); i++) {
    const x = -0.17 + (i * 0.34) / (low ? 2 : 6);
    bk.rod(bc, [x, 0, 0.14], [x, 0.22, 0.14], 0.004, { radial: 4, shadow: false });
    bk.rod(bc, [x, 0, -0.12], [x, 0.22, -0.12], 0.004, { radial: 4, shadow: false });
  }
  bk.box(bc, [-0.17, -0.005, -0.12], [0.17, 0.005, 0.14], { shadow: false });
  p.box(metal, [-0.08, 0.72, -0.78], [0.08, 0.74, -0.42], {});
  for (const s of [-1, 1]) p.rod(metal, [s * 0.08, 0.72, -0.5], [s * 0.06, R, za], 0.006);
  if (o.standing !== false) for (const s of [-1, 1]) p.rod(metal, [s * 0.06, R - 0.02, za + 0.05], [s * 0.16, 0.0, za + 0.1], 0.008);
  p.collide([-0.32, 0, -0.9], [0.32, 1.05, 0.9]);
}
