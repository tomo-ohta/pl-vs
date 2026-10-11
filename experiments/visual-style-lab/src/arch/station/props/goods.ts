import type { Prop, V2 } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';
import { cardboardBox } from '../../../props/lib/index.ts';

/**
 * 旧貨物ホーム・構外の荷と道具（ドラム缶・パレット・米袋の山・段ボールの荷・ロールベール・カラーコーン・A 形のバリケード・リヤカー）。
 * 正面 +z、床 y = 0。
 * 寸法の根拠:
 * - ドラム缶（200 L）: 直径 0.585 m・高さ 0.88 m。上下の縁（巻き締め）・胴の 2 本の輪（転がす帯）・ふたの大小の栓
 * - 木のパレット（T11）: 1.1 m 角・高さ 0.144 m。上の板 7 枚・桁の板 3 本・ブロック 9 個・下の板 3 枚
 * - 米袋（30 kg の紙袋）: 0.85 × 0.5 m・厚さ 0.14 m。両端の縫い目・刷った帯。段ごとに向きを変えて積む
 * - ロールベール（ラップした稲わら）: 直径 1.2 m・幅 1.2 m。角の丸い円柱・フィルムの重なりの帯
 * - カラーコーン: 高さ 0.7 m・台 0.38 m 角。白い反射の帯 2 本
 * - A 形のバリケード: 幅 1.2 m・高さ 0.8 m。鉄の管の脚・縞の板・下の横の管
 * - リヤカー: 荷台 1.2 × 0.8 m・車輪の直径 0.5 m・引き手のコの字の管
 * - 外した枕木（PC 枕木）: 長さ 2.0 m・幅 0.2 m・高さ 0.14 m。上の面に締結の穴。外したレール（50 kg レール: 高さ 0.15 m・底 0.13 m・頭 0.065 m）
 */

/** ドラム缶（立てる。lying で横に寝かせる） */
export function drum(p: Prop, o: { color?: string; lying?: boolean } = {}): void {
  const col = o.color ?? '#3d6f9a';
  const R = 0.2925;
  const H = 0.88;
  const q = o.lying ? p.sub([0, R, 0], 0, { pitch: Math.PI / 2 }).sub([0, -H / 2, 0]) : p;
  const prof: V2[] = [
    [0, 0.004], [R - 0.02, 0.004], [R - 0.003, 0.012], [R, 0.024], [R - 0.008, 0.034],
    [R - 0.008, 0.285], [R + 0.002, 0.295], [R + 0.002, 0.312], [R - 0.008, 0.322],
    [R - 0.008, 0.558], [R + 0.002, 0.568], [R + 0.002, 0.585], [R - 0.008, 0.595],
    [R - 0.008, H - 0.034], [R, H - 0.024], [R - 0.003, H - 0.006], [R - 0.012, H], [R - 0.018, H - 0.012], [0, H - 0.012],
  ];
  q.lathe(col, prof, [0, 0, 0], { seg: 18 });
  // 転がす帯・上下の縁は明るい筋で見せる（なめらかな回転体の段は霧の光ではほとんど見えない）
  for (const y of [0.3035, 0.5765]) q.torus(shade(col, 0.35), [0, y, 0], R - 0.002, 0.007, { axis: 'y', seg: 20, shadow: false });
  q.torus(shade(col, 0.45), [0, H - 0.012, 0], R - 0.012, 0.009, { axis: 'y', seg: 20, shadow: false });
  // ふたの栓（大・小）
  q.cyl(shade(col, -0.5), [0.14, H - 0.006, 0.05], 0.03, 0.012, { seg: 10, shadow: false });
  q.cyl(shade(col, -0.5), [-0.15, H - 0.006, -0.05], 0.018, 0.012, { seg: 8, shadow: false });
  if (o.lying) p.collide([-R, 0, -H / 2], [R, R * 2, H / 2]);
  else p.collide([-R, 0, -R], [R, H, R]);
}

/** 木のパレット（1.1 m 角） */
export function pallet(p: Prop, o: { wood?: string } = {}): void {
  const w = o.wood ?? '#a58f6c';
  const S = 1.1;
  const h = S / 2;
  for (let i = 0; i < 7; i++) {
    const z = -h + 0.05 + (i * (S - 0.1)) / 6;
    p.box(i % 3 === 1 ? shade(w, -0.12) : w, [-h, 0.124, z - 0.05], [h, 0.144, z + 0.05], { shadow: 'receive' });
  }
  for (const x of [-h + 0.05, 0, h - 0.05]) {
    p.box(shade(w, -0.2), [x - 0.05, 0.104, -h], [x + 0.05, 0.124, h], { shadow: false });
    p.box(shade(w, -0.25), [x - 0.05, 0, -h], [x + 0.05, 0.02, h], { shadow: false });
    for (const z of [-h + 0.05, 0, h - 0.05]) p.box(shade(w, -0.35), [x - 0.05, 0.02, z - 0.05], [x + 0.05, 0.104, z + 0.05], { shadow: false });
  }
}

/** パレットに積んだ米袋（layers 段。段ごとに向きを変える） */
export function sackPallet(p: Prop, o: { layers?: number; bag?: string; band?: string; wood?: string } = {}): void {
  pallet(p, { wood: o.wood });
  const bag = o.bag ?? '#e6e1d0';
  const band = o.band ?? '#3f8f5f';
  const n = o.layers ?? 5;
  const L = 0.84;
  const B = 0.5;
  const T = 0.14;
  for (let k = 0; k < n; k++) {
    const yaw = (k % 2) * (Math.PI / 2) + (p.r() - 0.5) * 0.04;
    const layer = p.sub([(p.r() - 0.5) * 0.03, 0.144 + k * (T - 0.012), (p.r() - 0.5) * 0.03], yaw);
    for (const s of [-1, 1]) {
      if (k === n - 1 && s > 0 && p.r() < 0.5) continue;
      const b = layer.sub([0, 0, s * (B / 2 + 0.01)], (p.r() - 0.5) * 0.05);
      const c = p.r() < 0.25 ? shade(bag, -0.15) : bag;
      b.box(c, [-L / 2, 0, -B / 2], [L / 2, T, B / 2], { r: 0.05, shadow: k === n - 1 ? true : 'receive' });
      // 両端の縫い目（少し出た耳）と、刷った帯（上と前へ回る）
      for (const e of [-1, 1]) b.box(shade(c, -0.2), [e * L / 2 - 0.02, 0.03, -B / 2 + 0.03], [e * L / 2 + 0.012, T - 0.03, B / 2 - 0.03], { shadow: false });
      b.box(band, [-0.08, T - 0.002, -B / 2 + 0.06], [0.08, T + 0.002, B / 2 - 0.06], { shadow: false });
      b.box(band, [-0.08, 0.03, B / 2 - 0.004], [0.08, T - 0.03, B / 2 + 0.002], { shadow: false });
    }
  }
  p.collide([-0.56, 0, -0.56], [0.56, 0.144 + n * (T - 0.012), 0.56]);
}

/** パレットに積んだ段ボールの荷（升目に並べ、上の段は欠ける） */
export function parcelPallet(p: Prop, o: { layers?: number; colors?: string[]; wood?: string } = {}): void {
  pallet(p, { wood: o.wood });
  const n = o.layers ?? 3;
  const bw = 0.52;
  const bd = 0.36;
  const bh = 0.3;
  let top = 0.144;
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) {
        if (k === n - 1 && p.r() < 0.35) continue;
        const x = -0.27 + i * (bw + 0.02);
        const z = -0.37 + j * (bd + 0.01);
        cardboardBox(p.sub([x, 0.144 + k * bh, z], (p.r() - 0.5) * 0.04), bw, bh - 0.005, bd, o.colors);
        top = Math.max(top, 0.144 + (k + 1) * bh);
      }
    }
  }
  p.collide([-0.56, 0, -0.56], [0.56, top, 0.56]);
}

/** 空のパレットの山 */
export function palletStack(p: Prop, o: { n?: number; wood?: string } = {}): void {
  const n = o.n ?? 6;
  for (let k = 0; k < n; k++) pallet(p.sub([(p.r() - 0.5) * 0.06, k * 0.146, (p.r() - 0.5) * 0.06], (p.r() - 0.5) * 0.05), { wood: o.wood });
  p.collide([-0.58, 0, -0.58], [0.58, n * 0.146, 0.58]);
}

/** ロールベール（ラップした稲わら。円の面が ±x。upright で円の面を上に） */
export function bale(p: Prop, o: { film?: string; upright?: boolean; r?: number } = {}): void {
  const film = o.film ?? '#e8ebe5';
  const R = o.r ?? 0.6;
  const Wd = R * 2;
  const prof: V2[] = [[0, -Wd / 2], [R * 0.82, -Wd / 2], [R * 0.95, -Wd / 2 + R * 0.04], [R * 1.0, -Wd / 2 + R * 0.14], [R * 1.02, 0], [R * 1.0, Wd / 2 - R * 0.14], [R * 0.95, Wd / 2 - R * 0.04], [R * 0.82, Wd / 2], [0, Wd / 2]];
  if (o.upright) {
    p.lathe(film, prof, [0, Wd / 2, 0], { seg: 22 });
    p.cyl(shade(film, -0.15), [0, Wd / 2 + 0.12, 0], R * 1.022, 0.1, { seg: 22, open: true, shadow: false });
    p.collide([-R, 0, -R], [R, Wd, R]);
    return;
  }
  p.lathe(film, prof, [0, R, 0], { axis: 'x', seg: 22 });
  // フィルムの重なりの帯（少し暗い帯を 2 本）と、円の面の巻きの渦（輪）
  for (const x of [-0.22, 0.3]) p.cyl(shade(film, -0.15), [x * R, R, 0], R * 1.022, 0.12, { axis: 'x', seg: 22, open: true, shadow: false });
  for (const s of [-1, 1]) p.torus(shade(film, -0.12), [s * (Wd / 2 + 0.002), R, 0], R * 0.45, 0.012, { axis: 'x', seg: 18, shadow: false });
  p.collide([-Wd / 2, 0, -R], [Wd / 2, R * 2, R]);
}

/** カラーコーン（赤・白い反射の帯 2 本・黒い台） */
export function cone(p: Prop, o: { red?: string } = {}): void {
  const red = o.red ?? '#d8553f';
  p.box('#2a3233', [-0.19, 0, -0.19], [0.19, 0.035, 0.19], { r: 0.012 });
  p.lathe(red, [[0, 0.035], [0.16, 0.035], [0.15, 0.08], [0.045, 0.66], [0.03, 0.7], [0, 0.7]], [0, 0, 0], { seg: 16 });
  for (const [y0, y1] of [[0.3, 0.38], [0.48, 0.55]] as const) {
    const r0 = 0.15 - ((y0 - 0.08) * (0.105 / 0.58)) + 0.003;
    const r1 = 0.15 - ((y1 - 0.08) * (0.105 / 0.58)) + 0.003;
    p.cyl('#f4f4ee', [0, (y0 + y1) / 2, 0], r0, y1 - y0, { radiusTop: r1, seg: 16, open: true, shadow: false });
  }
  p.collide([-0.19, 0, -0.19], [0.19, 0.7, 0.19]);
}

/** A 形のバリケード（幅 1.2 m。縞の板は前 +z と後ろの両面） */
export function barricade(p: Prop, o: { frame?: string; a?: string; b?: string } = {}): void {
  const fr = o.frame ?? '#d8d8cf';
  const ca = o.a ?? '#d8553f';
  const cb = o.b ?? '#f0efe8';
  const W = 1.2;
  // 脚（両端に A 形）・下の横の管・足の板
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) {
    p.rod(fr, [x, 0.8, 0], [x, 0.0, 0.28], 0.018);
    p.rod(fr, [x, 0.8, 0], [x, 0.0, -0.28], 0.018);
    p.rod(fr, [x, 0.25, 0.19], [x, 0.25, -0.19], 0.012);
    for (const z of [-0.28, 0.28]) p.box('#2a3233', [x - 0.04, 0, z - 0.06], [x + 0.04, 0.02, z + 0.06], { r: 0.005 });
  }
  p.rod(fr, [-W / 2 + 0.05, 0.25, 0.19], [W / 2 - 0.05, 0.25, 0.19], 0.014);
  // 上の縞の板（色の帯を交互に）
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + (i * W) / n;
    p.box(i % 2 ? cb : ca, [x0, 0.62, -0.02], [x0 + W / n, 0.78, 0.02], { r: 0.004 });
  }
  p.box(fr, [-W / 2, 0.6, -0.025], [W / 2, 0.62, 0.025], { r: 0.004 });
  p.collide([-W / 2, 0, -0.3], [W / 2, 0.8, 0.3]);
}

/** リヤカー（荷台の枠・床の板・車輪・引き手）。引き手が +z */
export function handcart(p: Prop, o: { frame?: string; deck?: string } = {}): void {
  const fr = o.frame ?? '#8a9692';
  const deck = o.deck ?? '#9a8466';
  const L = 1.2;
  const B = 0.8;
  const y = 0.48;
  // 床の板（荷台）と枠の管
  for (let i = 0; i < 6; i++) {
    const x = -B / 2 + 0.07 + (i * (B - 0.14)) / 5;
    p.box(i % 2 ? shade(deck, -0.12) : deck, [x - 0.06, y, -L / 2], [x + 0.06, y + 0.02, L / 2], { shadow: 'receive' });
  }
  for (const s of [-1, 1]) {
    p.rod(fr, [s * B / 2, y + 0.02, -L / 2], [s * B / 2, y + 0.02, L / 2], 0.016);
    // 横のあおり（低い柵）
    p.rod(fr, [s * B / 2, y + 0.22, -L / 2], [s * B / 2, y + 0.22, L / 2], 0.012);
    for (const z of [-L / 2, -L / 6, L / 6, L / 2]) p.rod(fr, [s * B / 2, y + 0.02, z], [s * B / 2, y + 0.22, z], 0.01);
    // 引き手（前へ伸びて、先で横の管につながる）
    p.rod(fr, [s * B / 2, y + 0.02, L / 2], [s * 0.3, y + 0.38, L / 2 + 0.75], 0.016);
    // 車輪（タイヤ・リム・スポーク）と、車軸の受け
    const wx = s * (B / 2 + 0.07);
    p.torus('#1f2626', [wx, 0.25, 0], 0.225, 0.028, { axis: 'x', seg: 20 });
    p.torus('#b7c1bd', [wx, 0.25, 0], 0.19, 0.01, { axis: 'x', seg: 18 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      p.rod('#b7c1bd', [wx, 0.25, 0], [wx, 0.25 + Math.sin(a) * 0.19, Math.cos(a) * 0.19], 0.004, { radial: 4, shadow: false });
    }
    p.rod(fr, [wx, 0.25, 0], [s * B / 2, y, 0], 0.014);
  }
  for (const z of [-L / 2, L / 2]) p.rod(fr, [-B / 2, y + 0.02, z], [B / 2, y + 0.02, z], 0.016);
  p.rod(fr, [-0.3, y + 0.38, L / 2 + 0.75], [0.3, y + 0.38, L / 2 + 0.75], 0.018);
  p.rod('#141c1c', [-0.12, y + 0.38, L / 2 + 0.75], [0.12, y + 0.38, L / 2 + 0.75], 0.022);
  // 前の支え（荷台を水平に止める脚）
  p.rod(fr, [0, y, L / 2 - 0.05], [0, 0, L / 2 + 0.1], 0.014);
  p.collide([-B / 2 - 0.1, 0, -L / 2], [B / 2 + 0.1, y + 0.4, L / 2 + 0.8]);
}

/** 外した枕木の山（長手 z。段ごとに本数が減る）と、脇の外したレール（rails 本・長さ 8 m・+x の側に z 0〜8 m） */
export function sleeperPile(p: Prop, o: { sleeper?: string; rail?: string; rails?: number } = {}): void {
  const sl = o.sleeper ?? '#5d6a66';
  const rail = o.rail ?? '#6a5a4a';
  const per = [5, 5, 4, 4, 3];
  per.forEach((n, k) => {
    for (let i = 0; i < n; i++) {
      const s = p.sub([(i - (n - 1) / 2) * 0.24 + (k % 2) * 0.05, k * 0.145, (k % 2) * 0.1 + (p.r() - 0.5) * 0.12], (p.r() - 0.5) * 0.03);
      s.box(p.r() < 0.3 ? shade(sl, -0.15) : sl, [-0.1, 0, -1.0], [0.1, 0.14, 1.0], { r: 0.012, seg: 1, shadow: k === per.length - 1 ? true : 'receive' });
      if (k === per.length - 1) for (const e of [-0.55, 0.55]) s.box('#1f2626', [-0.05, 0.14, e - 0.03], [0.05, 0.143, e + 0.03], { shadow: false });
    }
  });
  p.collide([-0.65, 0, -1.1], [0.65, per.length * 0.145, 1.1]);
  for (let k = 0; k < (o.rails ?? 4); k++) {
    const x = 1.6 + k * 0.16;
    p.box(rail, [x - 0.065, 0, 0], [x + 0.065, 0.03, 8], { shadow: false });
    p.box(rail, [x - 0.01, 0.03, 0], [x + 0.01, 0.11, 8], { shadow: false });
    p.box(shade(rail, 0.2), [x - 0.033, 0.11, 0], [x + 0.033, 0.15, 8], { shadow: false });
  }
}
