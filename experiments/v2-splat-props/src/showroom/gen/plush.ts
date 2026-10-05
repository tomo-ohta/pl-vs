/**
 * ぬいぐるみ（スプラット）。布の面（不透明）+ 毛羽（法線の外へ少し浮かせた半透明の小さな粒）。
 * 目はつやのあるビーズ、鼻は刺しゅう、首にはリボン。局所の座標は足元の中心が原点、正面が +z。
 */
import { blobby, ellipsoid, fbm, LOOK, lin, mix3, norm, Rand, scale3, tube, type BlobPart, type Surfels, type V3 } from '../surfel.ts';

type Xf = (p: V3) => V3;

/** 部品の回転（中心 c のまま、x 軸まわり ax・z 軸まわり az） */
function rot(c: V3, ax: number, az: number, xf: Xf): Xf {
  const cx = Math.cos(ax), sx = Math.sin(ax), cz = Math.cos(az), sz = Math.sin(az);
  return (p) => {
    let x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    return xf([x + c[0], y + c[1], z + c[2]]);
  };
}

/** 直前に置いた粒（from..）に毛羽を足す */
function fuzz(S: Surfels, R: Rand, from: number, len: number, density = 0.9, opacity = 0.5): void {
  const to = S.n;
  for (let i = from; i < to; i++) {
    if (R.next() > density) continue;
    const n: V3 = [S.normal[i * 3]!, S.normal[i * 3 + 1]!, S.normal[i * 3 + 2]!];
    const off = R.range(0.2, 1) * len;
    const tilt = norm([n[0] + R.range(-0.7, 0.7), n[1] + R.range(-0.7, 0.7), n[2] + R.range(-0.7, 0.7)]);
    const p: V3 = [S.center[i * 3]! + n[0] * off, S.center[i * 3 + 1]! + n[1] * off, S.center[i * 3 + 2]! + n[2] * off];
    const k = R.range(0.92, 1.15);
    const c: V3 = [S.albedo[i * 3]! * k, S.albedo[i * 3 + 1]! * k, S.albedo[i * 3 + 2]! * k];
    const t: V3 = [R.range(-1, 1), R.range(-1, 1), R.range(-1, 1)];
    S.push(p, tilt, t, S.scale[i * 2]! * 0.75, S.scale[i * 2 + 1]! * 0.3, c, LOOK.fabric, opacity);
  }
}

/** 布のむら（毛足の向きのむら） */
const nap = (color: (d: V3, p: V3) => V3) => (d: V3, p: V3): V3 => scale3(color(d, p), 0.9 + 0.18 * fbm(p[0] * 120, p[1] * 120, p[2] * 120));

/**
 * 胴・頭・手足を滑らかにつないだ 1 つの布の面（継ぎ目に丸い肉が付く。縫い合わせたぬいぐるみの形）。
 * fur は部位ごとの毛羽の長さ（スプラットだけ。メッシュには出ない）
 */
function body(S: Surfels, R: Rand, xf: Xf, parts: (BlobPart & { fur?: number })[]): void {
  blobby(S, parts.map((q) => ({ ...q, color: nap(q.color) })), {
    k: 0.018, spacing: 0.0055, look: LOOK.fabric, rand: R, xf,
    after: (i, from) => fuzz(S, R, from, parts[i]!.fur ?? 0.004),
  });
}

function bead(S: Surfels, R: Rand, xf: Xf, c: V3, r: number, hex = 0x0c0a09): void {
  ellipsoid(S, c, [r, r, r * 0.8], { spacing: 0.0018, look: { ...LOOK.glossy, rough: 0.08 }, rand: R, xf, color: () => lin(hex) });
}

/** 縫い目・刺しゅうの線 */
function stitch(S: Surfels, R: Rand, xf: Xf, path: (t: number) => V3, hex: number, r = 0.0016): void {
  tube(S, path, () => r, { spacing: 0.0015, look: LOOK.fabric, rand: R, xf, color: () => lin(hex) });
}

/** クマ（座った姿・高さ約 0.4 m）。fur は毛の色、patch はお腹・口元・足の裏 */
export function bear(S: Surfels, R: Rand, xf: Xf, fur = 0x9b6a43, patch = 0xd9b88f, ribbon = 0xb4232c): void {
  const F = lin(fur), P = lin(patch);
  // 胴（正面の下側にお腹の明るい布）・頭・口元・耳・腕（少し前へ傾ける）・脚（前へ投げ出す。足の裏は明るい布）
  body(S, R, xf, [
    { c: [0, 0.14, 0], r: [0.11, 0.13, 0.095], color: (d) => (d[2] > 0.45 && d[1] < 0.55 ? mix3(F, P, Math.min(1, (d[2] - 0.45) * 4)) : F) },
    { c: [0, 0.31, 0.01], r: [0.09, 0.083, 0.08], color: () => F },
    { c: [0, 0.292, 0.078], r: [0.042, 0.032, 0.03], color: () => P, fur: 0.002 },
    ...[-1, 1].flatMap((sx): (BlobPart & { fur?: number })[] => [
      { c: [sx * 0.064, 0.378, 0], r: [0.033, 0.031, 0.016], az: sx * -0.3, color: (d) => (d[2] > 0.3 ? P : F) },
      { c: [sx * 0.105, 0.17, 0.035], r: [0.034, 0.068, 0.034], ax: -0.5, az: sx * 0.35, color: (d) => (d[1] < -0.7 ? P : F) },
      { c: [sx * 0.06, 0.045, 0.07], r: [0.042, 0.06, 0.04], ax: -1.35, color: (d) => (d[1] > 0.75 ? P : F) },
    ]),
  ]);
  for (const sx of [-1, 1]) {
    bead(S, R, xf, [sx * 0.031, 0.322, 0.082], 0.0095);
  }
  // 鼻（刺しゅう）と口
  ellipsoid(S, [0, 0.302, 0.104], [0.015, 0.0105, 0.008], { spacing: 0.0016, look: LOOK.fabric, rand: R, xf, color: (_u, v) => scale3(lin(0x2a1b14), Math.sin(v * 22) > 0 ? 1 : 0.7) });
  stitch(S, R, xf, (t) => [0, 0.291 - t * 0.016, 0.106 - t * 0.002], 0x2a1b14);
  for (const sx of [-1, 1]) stitch(S, R, xf, (t) => [sx * t * 0.016, 0.275 + Math.sin(t * Math.PI) * 0.004 - t * 0.003, 0.104 - t * 0.008], 0x2a1b14);
  // 頭のてっぺんの縫い目
  stitch(S, R, xf, (t) => { const a = -0.2 + t * 2.3; return [0, 0.31 + Math.cos(a) * 0.085, 0.01 + Math.sin(a) * 0.082]; }, fur === 0x9b6a43 ? 0x6e4a2e : 0x888888, 0.0012);
  // 首のリボン（つやのある布）
  const rib = lin(ribbon);
  const satin = { ...LOOK.glossy, rough: 0.28 };
  tube(S, (t) => { const a = t * Math.PI * 2; return [Math.sin(a) * 0.083, 0.255, Math.cos(a) * 0.072]; }, () => 0.009, { spacing: 0.003, look: satin, rand: R, xf, color: () => rib });
  for (const sx of [-1, 1]) {
    ellipsoid(S, [sx * 0.03, 0.262, 0.088], [0.03, 0.02, 0.008], { spacing: 0.0028, look: satin, rand: R, xf: rot([sx * 0.03, 0.262, 0.088], 0, sx * 0.35, xf), color: (_u, v) => scale3(rib, 0.8 + 0.3 * Math.sin(v * 3)) });
    tube(S, (t) => [sx * (0.008 + t * 0.022), 0.25 - t * 0.04, 0.09], () => 0.006, { spacing: 0.003, look: satin, rand: R, xf, color: () => scale3(rib, 0.9) });
  }
  ellipsoid(S, [0, 0.258, 0.092], [0.011, 0.012, 0.008], { spacing: 0.0025, look: satin, rand: R, xf, color: () => scale3(rib, 0.85) });
}

/** ウサギ（座った姿・耳まで約 0.42 m）。白い毛、耳の内側は薄い桃色 */
export function rabbit(S: Surfels, R: Rand, xf: Xf): void {
  const W = lin(0xf2efe8), Pk = lin(0xe8b4b8);
  // 胴・頭・口元・長い耳（少し外へ開いて後ろへ倒す。内側は桃色）・足・腕・丸いしっぽ
  body(S, R, xf, [
    { c: [0, 0.12, -0.01], r: [0.1, 0.12, 0.11], color: () => W, fur: 0.005 },
    { c: [0, 0.27, 0.03], r: [0.075, 0.07, 0.07], color: () => W, fur: 0.005 },
    { c: [0, 0.255, 0.088], r: [0.034, 0.025, 0.022], color: () => W, fur: 0.003 },
    ...[-1, 1].flatMap((sx): (BlobPart & { fur?: number })[] => [
      { c: [sx * 0.032, 0.39, 0.0], r: [0.026, 0.085, 0.012], ax: 0.25, az: sx * -0.18, color: (d) => (d[2] > 0.2 && Math.abs(d[0]) < 0.7 ? Pk : W), fur: 0.003 },
      { c: [sx * 0.07, 0.045, 0.06], r: [0.035, 0.065, 0.03], ax: -1.4, color: () => W },
      { c: [sx * 0.085, 0.15, 0.06], r: [0.026, 0.05, 0.026], ax: -0.4, az: sx * 0.25, color: () => W },
    ]),
    { c: [0, 0.07, -0.115], r: [0.035, 0.035, 0.03], color: () => W, fur: 0.008 },
  ]);
  for (const sx of [-1, 1]) {
    bead(S, R, xf, [sx * 0.03, 0.285, 0.083], 0.008, 0x3a1416);
  }
  ellipsoid(S, [0, 0.262, 0.108], [0.009, 0.006, 0.005], { spacing: 0.0015, look: LOOK.fabric, rand: R, xf, color: () => lin(0xd98c96) });
}

/** ネコ（座った姿・約 0.32 m）。灰色の縞（トラ猫）と長いしっぽ */
export function cat(S: Surfels, R: Rand, xf: Xf): void {
  const G = lin(0x8d8a84), D = lin(0x4a4744), Wh = lin(0xe8e4dc);
  const tabby = (d: V3, p: V3): V3 => {
    if (d[2] > 0.55 && d[1] < 0.2) return Wh;
    const s = Math.sin(p[1] * 140 + fbm(p[0] * 30, p[1] * 30, p[2] * 30) * 6);
    return s > 0.45 ? D : G;
  };
  // 胴・頭（口元は白）・前足（白い靴下）
  body(S, R, xf, [
    { c: [0, 0.11, 0], r: [0.085, 0.11, 0.1], color: tabby },
    { c: [0, 0.245, 0.04], r: [0.068, 0.06, 0.06], color: (d, p) => (d[2] > 0.6 && d[1] < -0.1 ? Wh : tabby(d, p)) },
    ...[-1, 1].map((sx): BlobPart & { fur?: number } => ({ c: [sx * 0.04, 0.05, 0.08], r: [0.026, 0.05, 0.024], ax: -1.3, color: () => Wh, fur: 0.003 })),
  ]);
  for (const sx of [-1, 1]) {
    // 三角の耳（つぶした楕円体を上へ尖らせる）
    ellipsoid(S, [sx * 0.04, 0.3, 0.035], [0.022, 0.035, 0.008], {
      spacing: 0.003, look: LOOK.fabric, rand: R, xf: rot([sx * 0.04, 0.3, 0.035], 0, sx * -0.25, xf),
      warp: (p, d) => [p[0] * (1 - Math.max(0, d[1]) * 0.85) + sx * 0.04 * Math.max(0, d[1]) * 0.85, p[1], p[2]],
      color: (_u, v) => (v < 1.2 ? D : lin(0xd9a8a0)),
    });
    bead(S, R, xf, [sx * 0.025, 0.258, 0.094], 0.0085, 0x6b7a2a);
  }
  ellipsoid(S, [0, 0.242, 0.1], [0.008, 0.006, 0.005], { spacing: 0.0015, look: LOOK.fabric, rand: R, xf, color: () => lin(0xc98a86) });
  // しっぽ（床を回って前へ）
  const from = S.n;
  tube(S, (t) => { const a = Math.PI * (0.55 + t * 0.9); return [Math.cos(a) * 0.11, 0.018 + Math.sin(t * Math.PI) * 0.01, -0.02 + Math.sin(a) * 0.1]; }, (t) => 0.017 - t * 0.006, {
    spacing: 0.0045, look: LOOK.fabric, rand: R, xf, color: (_u, v) => (Math.sin(v * 30) > 0.3 ? D : G),
  });
  fuzz(S, R, from, 0.004);
  // ひげ（細い白い線）
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) tube(S, (t) => [sx * (0.02 + t * 0.06), 0.24 + (k - 1) * 0.006 - t * 0.008 * (k - 1), 0.1 - t * 0.01], () => 0.0005, { spacing: 0.0015, look: LOOK.glossy, rand: R, xf, color: () => lin(0xf0eee8) });
}
