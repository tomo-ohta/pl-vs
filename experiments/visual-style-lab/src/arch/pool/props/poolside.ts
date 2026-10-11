import type { V3 } from '../../../scenes/Builder.ts';
import type { Prop, V2 } from '../../../props/kit.ts';
import { PC } from './mats.ts';
import { bend, R1 } from './shape.ts';

/**
 * プールサイドの小物（監視台・はしご・手すり・救命具の板・時計・スタート台・コースロープ・背泳ぎの旗・寝椅子・パラソル）。
 * 正面 +z、床 y = 0（プールサイドの床。はしご・手すりは y < 0 が水の中）。
 * 寸法の根拠: 監視台 座面の高さ 1.6〜1.9 m・管 φ42 mm。はしごの手すり φ43 mm・床から 0.9 m・踏み板の間 0.25〜0.3 m。
 * スタート台 水面から 0.5〜0.75 m・上面 0.5 × 0.5 m・前へ 10° 下がる。コースロープ 浮きの直径 0.11〜0.15 m。
 * 背泳ぎの旗 壁から 5 m・水面から 1.8 m。寝椅子 長さ 1.9 m・幅 0.66 m・座面 0.3 m
 */

const TUBE = 0.022;

/** 監視台（白い管の脚・後ろのはしご・青緑の台・白い成形の座面と背・肘掛け・救助用の浮きと掛け紐・前の札） */
export function lifeguardChair(p: Prop, o: { h?: number } = {}): void {
  const H = o.h ?? 1.75;
  const fr = PC.white;
  // 脚: 床では広く、座面の下では狭い（局所の t = 高さの割合）
  const at = (sx: number, front: boolean, t: number): V3 => {
    const xb = 0.44;
    const xt = 0.3;
    const zb = front ? 0.42 : -0.6;
    const zt = front ? 0.24 : -0.3;
    return [sx * (xb + (xt - xb) * t), t * (H - 0.05), zb + (zt - zb) * t];
  };
  for (const sx of [-1, 1])
    for (const front of [false, true]) {
      p.rod(fr, at(sx, front, 0), at(sx, front, 1), TUBE, { radial: 8 });
      const f = at(sx, front, 0);
      p.cyl(PC.rubber, [f[0], 0.015, f[2]], 0.036, 0.03, { seg: 10 });
    }
  // 横のつなぎ・前のつなぎ・足掛け
  for (const sx of [-1, 1]) for (const t of [0.22, 0.6]) p.rod(fr, at(sx, false, t), at(sx, true, t), TUBE * 0.85, { radial: 6 });
  p.rod(fr, at(-1, true, 0.22), at(1, true, 0.22), TUBE * 0.85, { radial: 6 });
  p.rod(fr, at(-1, true, 0.66), at(1, true, 0.66), TUBE, { radial: 8 });
  // 後ろのはしご（横棒と踏み板）
  for (const t of [0.16, 0.33, 0.5, 0.67, 0.84]) {
    const a = at(-1, false, t);
    const b = at(1, false, t);
    p.rod(fr, a, b, TUBE * 0.8, { radial: 6 });
    p.box(PC.teal, [a[0] + 0.03, a[1] + 0.012, a[2] - 0.035], [b[0] - 0.03, a[1] + 0.03, a[2] + 0.035], { ...R1(0.006), shadow: 'receive' });
  }
  // 座面の台（青緑の板）と、白い成形の座面と背（横から見た輪郭を押し出す）
  p.box(PC.teal, [-0.35, H - 0.06, -0.34], [0.35, H, 0.3], R1(0.02));
  const seat: V2[] = [[0.27, 0.0], [0.27, 0.05], [-0.2, 0.06], [-0.27, 0.55], [-0.34, 0.56], [-0.3, 0.0]];
  p.extrude(fr, seat.map(([z, y]) => [z, H + y] as V2), 'zy', -0.29, 0.29, { bevel: 0.014 });
  // 背の支柱・肘掛け（管の輪）
  for (const sx of [-1, 1]) {
    p.rod(fr, [sx * 0.31, H - 0.05, -0.31], [sx * 0.31, H + 0.5, -0.36], TUBE, { radial: 8 });
    p.tube(fr, bend([[sx * 0.33, H, -0.28], [sx * 0.34, H + 0.27, -0.26], [sx * 0.34, H + 0.27, 0.13], [sx * 0.33, H, 0.22]], 0.06), TUBE * 0.9, { seg: 40, radial: 6 });
  }
  // 救助用の浮き（赤い筒）を右の肘掛けに掛ける。掛け紐（黄）
  // 救助用の浮き（赤い筒）を右の肘掛けに二つ折りに掛ける（内と外へ垂れる）。掛け紐（黄）
  p.tube(PC.red, [[0.27, H + 0.08, 0.0], [0.29, H + 0.24, 0.0], [0.34, H + 0.33, 0.0], [0.4, H + 0.26, 0.0], [0.43, H + 0.02, 0.01], [0.44, H - 0.32, 0.03]], 0.05, { seg: 24, radial: 8 });
  p.box(PC.ink, [0.39, H - 0.1, -0.055], [0.49, H - 0.08, 0.075], { shadow: false });
  p.tube(PC.yellow, [[0.44, H - 0.32, 0.03], [0.46, H - 0.5, 0.08], [0.43, H - 0.7, 0.12], [0.4, H - 0.8, 0.1]], 0.008, { seg: 12, radial: 4, shadow: false });
  // 前の札（白い板と赤い帯）
  const fz = at(1, true, 0.75)[2] + 0.03;
  p.box(PC.white, [-0.19, H * 0.62, fz], [0.19, H * 0.62 + 0.2, fz + 0.015], R1(0.006));
  p.box(PC.red, [-0.19, H * 0.62 + 0.15, fz + 0.015], [0.19, H * 0.62 + 0.2, fz + 0.018], { shadow: false });
  p.collide([-0.47, 0, -0.64], [0.47, H + 0.56, 0.46]);
}

/**
 * プールのはしご（2 本の曲げた手すり・踏み板・壁の当て）。背 -z がプールサイド（床 y = 0）、z = 0 がプールの縁、+z が水の中。
 * depth = 床からプールの底まで
 */
export function poolLadder(p: Prop, depth: number): void {
  const fr = PC.chrome;
  const bot = -depth + 0.05;
  for (const x of [-0.25, 0.25]) {
    p.tube(fr, bend([[x, 0, -0.34], [x, 0.9, -0.34], [x, 0.9, 0.15], [x, bot, 0.15]], 0.14), 0.021, { seg: 60, radial: 8 });
    p.cyl(fr, [x, 0.005, -0.34], 0.045, 0.01, { seg: 12, shadow: 'receive' });
    p.cyl(PC.rubber, [x, bot - 0.02, 0.15], 0.028, 0.04, { seg: 8 });
    // 壁の当て（ゴム）
    p.rod(PC.rubber, [x, -0.42, 0.015], [x, -0.42, 0.14], 0.016, { radial: 6 });
  }
  for (let i = 0; ; i++) {
    const y = -0.3 - i * 0.27;
    if (y < bot + 0.12) break;
    p.box(fr, [-0.25, y - 0.025, 0.04], [0.25, y, 0.19], R1(0.008));
    p.box(PC.steel, [-0.22, y, 0.06], [0.22, y + 0.003, 0.17], { shadow: false });
  }
  p.collide([-0.28, 0, -0.38], [0.28, 0.95, 0.0]);
}

/** 入水の階段の手すり（床から立ち上がり、水の中へ斜めに下りる 1 本の曲げた管）。len = 前への長さ、drop = 下がる高さ */
export function stairRail(p: Prop, len: number, drop: number): void {
  const fr = PC.chrome;
  p.tube(fr, bend([[0, 0, -0.15], [0, 0.9, -0.15], [0, 0.9 - drop, len - 0.15], [0, -drop, len - 0.15]], 0.16), 0.022, { seg: 60, radial: 8 });
  p.cyl(fr, [0, 0.005, -0.15], 0.045, 0.01, { seg: 12, shadow: 'receive' });
  p.cyl(fr, [0, -drop + 0.005, len - 0.15], 0.045, 0.01, { seg: 12, shadow: 'receive' });
  p.collide([-0.05, 0, -0.2], [0.05, 0.95, 0.0]);
}

/** 救命浮環（赤い輪に白い帯 4 つ・まわりの掴み綱）。輪の穴は z の向き。原点は輪の中心 */
export function ringBuoy(p: Prop, R = 0.29, t = 0.066): void {
  p.torus(PC.red, [0, 0, 0], R, t, { seg: 24 });
  for (let k = 0; k < 4; k++) p.sub([0, 0, 0], 0, { roll: Math.PI / 4 + (k * Math.PI) / 2 - 0.16 }).torus(PC.white, [0, 0, 0], R, t + 0.003, { seg: 4, arc: 0.32 });
  // 掴み綱: 4 か所で留めて、間は輪の外へ少したるむ
  for (let k = 0; k < 4; k++) {
    const a0 = Math.PI / 4 + (k * Math.PI) / 2;
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      const sag = Math.sin((i / 6) * Math.PI) * 0.045;
      pts.push([Math.cos(a) * (R + t + sag), Math.sin(a) * (R + t + sag), 0.01]);
    }
    p.tube(PC.white, pts, 0.007, { seg: 10, radial: 4, shadow: false });
  }
}

/** 救助用の浮き（レスキューチューブ: 赤い発泡の筒・黄の掛け紐・金具）。局所 x の向きに横たえる。原点は下の面の中心 */
export function rescueTube(p: Prop, L = 0.95): void {
  p.box(PC.red, [-L / 2, 0, -0.07], [L / 2, 0.09, 0.07], { r: 0.04, seg: 2 });
  for (const x of [-L / 2 + 0.12, L / 2 - 0.12]) p.box(PC.ink, [x - 0.012, 0.0, -0.072], [x + 0.012, 0.092, 0.072], { shadow: false });
  p.box(PC.white, [-0.18, 0.09, -0.05], [0.18, 0.093, 0.05], { shadow: false });
  p.cyl(PC.chrome, [L / 2 + 0.03, 0.045, 0], 0.02, 0.05, { axis: 'x', seg: 8 });
  p.tube(PC.yellow, [[-L / 2, 0.06, 0], [-L / 2 - 0.12, 0.05, 0.06], [-L / 2 - 0.08, 0.01, 0.16], [-L / 2 + 0.1, 0.005, 0.18]], 0.008, { seg: 10, radial: 4, shadow: false });
}

/** 救命具の板（壁に付ける。背の板・赤い見出しの帯・浮環と掛けの金具・横に寝かせたレスキューチューブ・巻いた綱）。原点は壁の上の床 */
export function rescueBoard(p: Prop): void {
  p.box(PC.pale, [-0.46, 0.95, 0.0], [0.46, 2.08, 0.03], R1(0.01));
  p.box(PC.red, [-0.46, 1.93, 0.03], [0.46, 2.08, 0.034], { shadow: false });
  p.box(PC.white, [-0.3, 1.96, 0.034], [0.3, 2.05, 0.037], { shadow: false });
  // 浮環を掛ける金具（上の釘）
  p.rod(PC.chrome, [0, 1.84, 0.03], [0, 1.84, 0.13], 0.012, { radial: 6 });
  p.rod(PC.chrome, [0, 1.84, 0.13], [0, 1.88, 0.15], 0.012, { radial: 6 });
  ringBuoy(p.sub([0, 1.52, 0.1]));
  // レスキューチューブ（2 本の釘の上に横たえる）と巻いた綱
  for (const x of [-0.3, 0.3]) p.rod(PC.chrome, [x, 1.08, 0.03], [x, 1.08, 0.17], 0.01, { radial: 6 });
  rescueTube(p.sub([0, 1.09, 0.1]), 0.86);
  for (let k = 0; k < 3; k++) p.torus(PC.white, [0.36, 1.0 - k * 0.004, 0.06], 0.075 - k * 0.006, 0.008, { seg: 14 });
  p.collide([-0.46, 0.95, 0], [0.46, 2.08, 0.18]);
}

/** 壁の時計（青緑の枠・白い文字盤・時の目盛り・針）。pace = ペースクロック（大きな秒の目盛りと赤い長い針）。原点は壁の上の、時計の中心の高さ 0 */
export function wallClock(p: Prop, y: number, r: number, o: { pace?: boolean } = {}): void {
  const rim = o.pace ? PC.yellow : PC.tealDark;
  p.lathe(rim, [[0, 0], [r + 0.012, 0], [r + 0.018, 0.012], [r + 0.016, 0.055], [r - 0.008, 0.065], [r - 0.012, 0.05], [0, 0.05]], [0, y, 0], { axis: 'z', seg: 32 });
  p.cyl(PC.white, [0, y, 0.054], r - 0.012, 0.004, { axis: 'z', seg: 32, shadow: 'receive' });
  const zf = 0.057;
  const n = o.pace ? 60 : 12;
  for (let i = 0; i < n; i++) {
    const big = !o.pace || i % 5 === 0;
    const s = p.sub([0, y, zf], 0, { roll: (i / n) * Math.PI * 2 });
    s.box(PC.ink, [big ? -r * 0.022 : -r * 0.008, r * (big ? 0.74 : 0.82), 0], [big ? r * 0.022 : r * 0.008, r * 0.9, 0.003], { shadow: false });
  }
  const t = p.r();
  const hand = (a: number, len: number, w: number, color: string, dz: number): void => {
    p.sub([0, y, zf + dz], 0, { roll: -a }).box(color, [-w / 2, -len * 0.18, 0], [w / 2, len, 0.004], { shadow: false });
  };
  if (o.pace) {
    hand(t * Math.PI * 2, r * 0.86, r * 0.035, PC.red, 0.004);
    hand(t * 37 * Math.PI * 2, r * 0.7, r * 0.03, PC.ink, 0.009);
  } else {
    hand(t * Math.PI * 2, r * 0.5, r * 0.06, PC.ink, 0.004);
    hand(t * 12 * Math.PI * 2, r * 0.76, r * 0.04, PC.ink, 0.009);
    hand(t * 400 * Math.PI * 2, r * 0.8, r * 0.012, PC.red, 0.014);
  }
  p.cyl(PC.ink, [0, y, zf + 0.016], r * 0.04, 0.008, { axis: 'z', seg: 10, shadow: false });
}

/** スタート台（台座・前へ傾いた上の台・後ろの蹴り板・横の握り・背泳ぎの握り・番号の札）。背 -z がプールサイド、+z が水の上 */
export function startBlock(p: Prop): void {
  // 台座（下へ広がる柱）と床の板
  p.box(PC.rubber, [-0.27, 0, -0.44], [0.27, 0.02, 0.1], R1(0.008));
  p.extrude(PC.white, [[-0.4, 0.02], [0.08, 0.02], [0.06, 0.62], [-0.3, 0.66], [-0.38, 0.6]], 'zy', -0.21, 0.21, { bevel: 0.015 });
  // 上の台（前へ 10° 下がる）・滑り止めの面・後ろの蹴り板
  const top = p.sub([0, 0.68, -0.08], 0, { pitch: 0.17 });
  top.box(PC.teal, [-0.26, -0.03, -0.3], [0.26, 0.03, 0.26], R1(0.015));
  top.box(PC.tealDark, [-0.23, 0.03, -0.27], [0.23, 0.034, 0.23], { shadow: 'receive' });
  top.sub([0, 0.03, -0.18], 0, { pitch: -0.55 }).box(PC.steel, [-0.22, 0, -0.02], [0.22, 0.09, 0.0], R1(0.006));
  top.box(PC.steel, [-0.03, 0.03, -0.24], [0.03, 0.06, -0.12], R1(0.006));
  // 横の握り（管）
  for (const sx of [-1, 1]) top.tube(PC.chrome, bend([[sx * 0.25, 0.0, -0.22], [sx * 0.3, 0.06, -0.2], [sx * 0.3, 0.06, 0.1], [sx * 0.25, 0.0, 0.14]], 0.04), 0.016, { seg: 30, radial: 6 });
  // 背泳ぎの握り（前の下: 横の棒と縦の棒）
  p.rod(PC.chrome, [-0.2, 0.52, 0.13], [0.2, 0.52, 0.13], 0.014, { radial: 6 });
  for (const sx of [-1, 1]) {
    p.rod(PC.chrome, [sx * 0.2, 0.52, 0.13], [sx * 0.2, 0.52, 0.07], 0.014, { radial: 6 });
    p.rod(PC.chrome, [sx * 0.14, 0.2, 0.08], [sx * 0.14, 0.46, 0.08], 0.014, { radial: 6 });
  }
  // 番号の札（前と横の白い板）
  p.box(PC.white, [-0.13, 0.3, 0.07], [0.13, 0.48, 0.085], R1(0.006));
  for (const sx of [-1, 1]) p.box(PC.white, [sx * 0.215 - 0.004, 0.36, -0.28], [sx * 0.215 + 0.004, 0.52, -0.06], { shadow: false });
  p.collide([-0.31, 0, -0.44], [0.31, 0.8, 0.14]);
}

/** コースロープ（浮きの円盤の列）。局所 x の向きに長さ len、原点は真ん中・水面。端の 5 m は赤、間は青と白が 1 m ごと */
export function laneRope(p: Prop, len: number): void {
  const pitch = 0.12;
  const n = Math.floor(len / pitch);
  const x0 = -len / 2 + (len - n * pitch) / 2;
  const sect: { a: number; b: number; color: string }[] = [];
  const endN = Math.round(5 / pitch);
  const midN = 8;
  let i = 0;
  while (i < n) {
    let j: number;
    let color: string;
    if (i < endN) [j, color] = [endN, PC.red];
    else if (i >= n - endN) [j, color] = [n, PC.red];
    else {
      const k = Math.floor((i - endN) / midN);
      j = Math.min(endN + (k + 1) * midN, n - endN);
      color = k % 2 === 0 ? PC.blue : PC.white;
    }
    sect.push({ a: i, b: j, color });
    i = j;
  }
  for (const s of sect) {
    const prof: V2[] = [];
    for (let k = s.a; k < s.b; k++) {
      const x = (k - s.a) * pitch;
      prof.push([0.014, x], [0.054, x + 0.02], [0.054, x + 0.085], [0.014, x + 0.105]);
    }
    p.lathe(s.color, prof, [x0 + s.a * pitch, 0, 0], { axis: 'x', seg: 6, shadow: 'receive' });
  }
  // 両端の綱と留め金
  for (const sx of [-1, 1]) {
    p.rod(PC.steel, [sx * (len / 2 - 0.02), 0, 0], [sx * (len / 2 - 0.25), 0, 0], 0.008, { radial: 4 });
    p.cyl(PC.chrome, [sx * (len / 2 - 0.02), 0.0, 0], 0.035, 0.03, { axis: 'x', seg: 10 });
  }
}

/** 背泳ぎの旗（2 本の柱・たるんだ綱・三角の旗が赤・白・青で並ぶ）。局所 x の向きに span、原点は真ん中の床 */
export function backstrokeFlags(p: Prop, span: number, h = 1.8): void {
  for (const sx of [-1, 1]) {
    const x = (sx * span) / 2;
    p.cyl(PC.chrome, [x, h / 2, 0], 0.028, h + 0.06, { seg: 10 });
    p.cyl(PC.steel, [x, 0.01, 0], 0.06, 0.02, { seg: 12, shadow: 'receive' });
    p.ball(PC.chrome, [x, h + 0.04, 0], 0.035, { seg: 8 });
  }
  const sag = 0.1;
  const yAt = (x: number): number => h - sag * (1 - ((2 * x) / span) ** 2);
  const rope: V3[] = [];
  for (let i = 0; i <= 10; i++) {
    const x = -span / 2 + (span * i) / 10;
    rope.push([x, yAt(x), 0]);
  }
  p.tube(PC.white, rope, 0.006, { seg: 40, radial: 4, shadow: false });
  // 三角の旗（薄い板。綱のたるみに沿って下げる）
  const cols = [PC.red, PC.white, PC.blue];
  let k = 0;
  for (let x = -span / 2 + 0.25; x < span / 2 - 0.15; x += 0.3) p.sub([x, yAt(x), 0]).extrude(cols[k++ % 3], [[-0.1, 0], [0, -0.22], [0.1, 0]], 'xy', -0.002, 0.002, { shadow: false });
}

/**
 * 寝椅子（白い樹脂: 横の枠・座面の板の並び・起こした背・脚と頭の側の車輪）。背 -z が頭。
 * flat = 背を倒した形（重ねて置く）
 */
export function lounger(p: Prop, o: { flat?: boolean; color?: string } = {}): void {
  const c = o.color ?? PC.white;
  const y = 0.3;
  for (const sx of [-1, 1]) p.box(c, [sx * 0.31 - 0.022, y - 0.06, -0.95], [sx * 0.31 + 0.022, y, 0.95], R1(0.012));
  for (let z = -0.36; z < 0.9; z += 0.085) p.box(c, [-0.3, y - 0.012, z], [0.3, y + 0.012, z + 0.06]);
  const back = p.sub([0, y, -0.4], 0, { pitch: o.flat ? 0 : 0.85 });
  for (const sx of [-1, 1]) back.box(c, [sx * 0.31 - 0.022, -0.05, -0.56], [sx * 0.31 + 0.022, 0.01, 0.0], R1(0.012));
  for (let z = -0.06; z > -0.56; z -= 0.085) back.box(c, [-0.3, -0.012, z - 0.06], [0.3, 0.012, z]);
  if (!o.flat) back.box(PC.pale, [-0.24, 0.012, -0.5], [0.24, 0.05, -0.38], R1(0.02));
  // 脚（足の側）と、頭の側の車輪
  for (const sx of [-1, 1]) {
    p.box(c, [sx * 0.31 - 0.025, 0, 0.78], [sx * 0.31 + 0.025, y - 0.05, 0.86], R1(0.01));
    p.box(c, [sx * 0.31 - 0.025, 0.06, -0.86], [sx * 0.31 + 0.025, y - 0.05, -0.78], R1(0.01));
    p.cyl(PC.rubber, [sx * 0.33, 0.065, -0.84], 0.065, 0.035, { axis: 'x', seg: 12 });
  }
  p.collide([-0.36, 0, -0.97], [0.36, o.flat ? y + 0.05 : 0.75, 0.97]);
}

/** 閉じたパラソル（重しの台・柱・たたんだ布の膨らみ・留め帯・頂の飾り）。原点は床 */
export function parasol(p: Prop, o: { cloth?: string } = {}): void {
  const cloth = o.cloth ?? PC.teal;
  p.lathe(PC.white, [[0, 0], [0.3, 0], [0.3, 0.07], [0.14, 0.13], [0.05, 0.15], [0, 0.15]], [0, 0, 0], { seg: 18, collide: true });
  p.rod(PC.chrome, [0, 0.1, 0], [0, 2.45, 0], 0.022, { radial: 8 });
  p.box(PC.steel, [-0.03, 1.2, -0.03], [0.03, 1.28, 0.06], R1(0.01));
  p.lathe(cloth, [[0.026, 0], [0.07, 0.12], [0.12, 0.62], [0.11, 1.08], [0.06, 1.34], [0.03, 1.44], [0.0, 1.46]], [0, 1.0, 0], { seg: 8 });
  p.torus(PC.tealDark, [0, 1.6, 0], 0.115, 0.012, { axis: 'y', seg: 12 });
  p.ball(PC.white, [0, 2.5, 0], 0.04, { seg: 8 });
}
