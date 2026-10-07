import * as THREE from 'three';
import { shiftColor } from '../../render/Style.ts';
import type { StyleMaterialOptions } from '../../render/StyleMaterial.ts';
import type { V3 } from '../Builder.ts';
import { rand, type Seg } from './kit.ts';

/**
 * 廊下の小物（記号的な形: 箱と円柱の組み合わせ）。寸法は実物に合わせる。
 * 材質は呼ぶ側の区域で作って渡す（区域ごとに色が違う）。
 */

type M = THREE.Material;

/**
 * 色指定の材質の値。照明の段は「床・上を向いた面は日なた / 影」「壁・天井は常に日なた」になるように組んであるので、
 * 見えている色を color に入れる。shade は床の影・物の上面の影の色。
 */
export function flat(color: string, shade?: string, extra: Partial<StyleMaterialOptions> = {}): StyleMaterialOptions {
  return {
    color,
    shade: shade ?? shiftColor(color, [0.8, 0.95, 6]),
    dark: shiftColor(shade ?? color, [0.75, 0.95, 6]),
    hi: color,
    ...extra,
  };
}

/** 天井の蛍光灯（横長の箱。下面が光る） */
export function lamp(s: Seg, body: M, lens: M, c: V3, len: number, depth: number, thick = 0.07, rim = 0.035): void {
  const [x, y, z] = c;
  // 本体（天井から少し下がる）
  s.faces([x - len / 2, y - thick, z - depth / 2], [x + len / 2, y, z + depth / 2], { pz: body, nx: body, px: body, ny: null, py: null, nz: null }, { shadow: false });
  // 下面: 縁と光る面
  s.faces([x - len / 2, y - thick - 0.004, z - depth / 2], [x + len / 2, y - thick, z + depth / 2], { ny: body }, { shadow: false });
  s.faces([x - len / 2 + rim, y - thick - 0.012, z - depth / 2 + rim], [x + len / 2 - rim, y - thick - 0.004, z + depth / 2 - rim], { ny: lens, pz: lens }, { shadow: false });
}

/** 天井の監視カメラ（取り付け台・腕・暗い丸） */
export function domeCam(s: Seg, body: M, dark: M, c: V3, scale = 1): void {
  const [x, y, z] = c;
  const k = scale;
  s.cyl(body, [x, y - 0.02 * k, z], 0.09 * k, 0.04 * k, { shadow: false, segments: 20 });
  s.box(body, [x - 0.025 * k, y - 0.13 * k, z - 0.025 * k], [x + 0.025 * k, y - 0.03 * k, z + 0.025 * k], { shadow: false });
  s.box(body, [x - 0.1 * k, y - 0.2 * k, z - 0.07 * k], [x + 0.1 * k, y - 0.13 * k, z + 0.07 * k], { shadow: false });
  s.cyl(dark, [x, y - 0.235 * k, z], 0.075 * k, 0.07 * k, { shadow: false, segments: 20 });
}

/** 煙の感知器（小さな円柱） */
export function smoke(s: Seg, body: M, c: V3, r = 0.045, h = 0.1): void {
  s.cyl(body, [c[0], c[1] - h / 2, c[2]], r, h, { shadow: false, segments: 14 });
}

/** 白いポール（ベルトパーティション）: 台・柱・色の付いた頭 */
export function bollard(s: Seg, white: M, top: M, base: M, x: number, z: number, h = 0.92, r = 0.03, baseR = 0.16): void {
  s.cyl(base, [x, 0.012, z], baseR, 0.024, { segments: 24 });
  s.cyl(white, [x, h / 2, z], r, h - 0.08, { segments: 12, radiusTop: r * 0.9 });
  s.cyl(top, [x, h - 0.04, z], r * 1.08, 0.08, { segments: 12 });
}

/** キャスター（暗い車輪と金具） */
export function caster(s: Seg, wheel: M, metal: M, x: number, z: number, r = 0.05, w = 0.035, axis: 'x' | 'z' = 'x'): void {
  s.cyl(wheel, [x, r, z], r, w, { axis, segments: 16 });
  s.box(metal, [x - 0.02, r, z - 0.02], [x + 0.02, r * 2 + 0.03, z + 0.02]);
}

/** 箱型のカート（4 輪）: 本体の面ごとの材質・取っ手は省略可 */
export function boxCart(
  s: Seg,
  m: { front: M; side: M; top: M; back?: M; wheel: M; metal: M; base?: M },
  min: V3,
  max: V3,
  o: { wheelR?: number; inset?: number; baseH?: number } = {},
): void {
  const wr = o.wheelR ?? 0.05;
  const bh = o.baseH ?? 0.06;
  const y0 = wr * 2 + 0.04;
  const ins = o.inset ?? 0.05;
  // 台
  if (m.base) s.faces([min[0], y0, min[2]], [max[0], y0 + bh, max[2]], { pz: m.base, nx: m.base, px: m.base, nz: m.base, py: null, ny: m.base });
  // 本体
  s.faces([min[0] + ins * 0.4, y0 + bh, min[2] + ins * 0.4], [max[0] - ins * 0.4, max[1], max[2] - ins * 0.4], { pz: m.front, nx: m.side, px: m.side, nz: m.back ?? m.side, py: m.top, ny: null }, { collide: true });
  const cx = [min[0] + ins, max[0] - ins];
  const cz = [min[2] + ins, max[2] - ins];
  for (const x of cx) for (const z of cz) caster(s, m.wheel, m.metal, x, z, wr);
}

/** 手すり（壁から少し離れた丸棒と金具）。壁の向き n: +1 = 壁が -x 側（左の壁） */
export function handrail(s: Seg, rail: M, bracket: M, wallX: number, side: 1 | -1, y: number, z0: number, z1: number, step = 1.2, off = 0.07, r = 0.022, start?: number): void {
  const x = wallX + side * off;
  s.cyl(rail, [x, y, (z0 + z1) / 2], r, Math.abs(z1 - z0), { axis: 'z', segments: 10 });
  const zs = Math.min(z0, z1);
  const ze = Math.max(z0, z1);
  // 金具の位置: start（z）を通る step おき
  const first = start !== undefined ? start + Math.floor((ze - 0.1 - start) / step) * step : ze - 0.2;
  for (let z = first; z > zs; z -= step) {
    s.box(bracket, [Math.min(wallX, x), y - 0.07, z - 0.012], [Math.max(wallX, x) - (side > 0 ? 0.012 : -0.012), y - 0.05, z + 0.012]);
    s.box(bracket, [x - 0.008, y - 0.07, z - 0.012], [x + 0.008, y, z + 0.012]);
  }
}

/** ごみ箱（下がすぼまった四角） */
export function bin(s: Seg, body: M, rim: M, x: number, z: number, top = 0.32, bottom = 0.24, h = 0.42): void {
  const g = new THREE.CylinderGeometry(top / Math.SQRT2, bottom / Math.SQRT2, h, 4, 1, true).rotateY(Math.PI / 4);
  s.mesh(g, body, [x, h / 2, z]);
  const rg = new THREE.CylinderGeometry((top + 0.02) / Math.SQRT2, top / Math.SQRT2, 0.04, 4, 1, false).rotateY(Math.PI / 4);
  s.mesh(rg, rim, [x, h - 0.02, z]);
}

/**
 * 壁の白いかすれ（細長い貼り絵を散らす）。壁は x = wx の面、n = +1 なら +X 向き（左の壁）。
 * len・wid は長さ・幅の範囲（m）、tilt は傾きの範囲（ラジアン、水平から）。
 */
export function wallFlecks(
  s: Seg,
  mat: THREE.Material,
  wx: number,
  n: 1 | -1,
  zr: [number, number],
  yr: [number, number],
  count: number,
  seed: number,
  len: [number, number],
  wid: [number, number],
  tilt: [number, number],
): void {
  const r = rand(seed);
  const lerp = (a: [number, number], t: number): number => a[0] + (a[1] - a[0]) * t;
  for (let i = 0; i < count; i++) {
    const cz = lerp(zr, r());
    const cy = lerp(yr, r());
    const L = lerp(len, r() * r());
    const W = lerp(wid, r());
    const th = lerp(tilt, r()) * (r() < 0.5 ? 1 : -1);
    // 見る人から見た右・上の 2D（+X 向きの壁では右 = -Z）
    const right = n > 0 ? -cz : cz;
    const d = [Math.cos(th), Math.sin(th)];
    const p = [-Math.sin(th), Math.cos(th)];
    const pt = (a: number, b: number): V3 => {
      const rx = right + d[0] * a + p[0] * b;
      const uy = cy + d[1] * a + p[1] * b;
      return [wx + n * 0.004, uy, n > 0 ? -rx : rx];
    };
    s.quad(mat, pt(-L / 2, -W / 2), pt(L / 2, -W / 2), pt(L / 2, W / 2), pt(-L / 2, W / 2));
  }
}

/**
 * 壁の足元の床の帯（暗い帯と、その外の淡い影の帯。外側の縁がちぎれる）。
 * wx は壁の面の x、n = +1 は左の壁（帯は +X へ伸びる）、-1 は右の壁。z0 < z1。
 */
export function floorBand(s: Seg, wx: number, n: 1 | -1, z0: number, z1: number, dark: THREE.Material, w1: number, light?: THREE.Material, w2 = 0): void {
  const q = (x0: number, x1: number, mat: THREE.Material, y: number): void => {
    // u = 0 が壁側、u = 1 が外側（ちぎれる縁）
    const a: V3 = [wx + n * x0, y, z1];
    const b: V3 = [wx + n * x1, y, z1];
    const c: V3 = [wx + n * x1, y, z0];
    const d: V3 = [wx + n * x0, y, z0];
    if (n > 0) s.quad(mat, a, b, c, d);
    else s.quad(mat, d, c, b, a, {}, [1, 0, 0, 1]);
  };
  if (light && w2 > 0) q(Math.max(0, w1 - 0.03), w1 + w2, light, 0.0015);
  q(0, w1, dark, 0.003);
}

/** 前（+Z）を向いた壁の足元の床の帯（柱型の前など）。wz は壁の面の z、x0 < x1 */
export function floorBandZ(s: Seg, wz: number, x0: number, x1: number, dark: THREE.Material, w1: number): void {
  // u = 0 が壁側、u = 1 が手前（ちぎれる縁）
  s.quad(dark, [x1, 0.003, wz], [x1, 0.003, wz + w1], [x0, 0.003, wz + w1], [x0, 0.003, wz]);
}
