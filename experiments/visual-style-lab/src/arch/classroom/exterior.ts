import * as THREE from 'three';
import { rng, type Builder } from '../../scenes/Builder.ts';
import { CH, CORR, FL, STAIR, T_EXT, WC, XN, Z_EAST } from './layout.ts';
import type { Mats } from './mats.ts';
import { levelMats, wallRects, type RectHole } from './shell.ts';

/**
 * 建物の外: 1 階の外壁（窓は暗いガラス。中には入れない）・屋上（パラペット・階段室の塔屋・高架水槽）・
 * 崖の上の地面（草と土の斑・崖の縁の柵）・北の校庭（体育館・フェンス・風で傾いた松・電柱・旗竿）・内陸の丘。
 * 窓から見える所（廊下の北の窓・バルコニー・外の避難階段）を同じ絵柄で埋める。遠くは室内と同じ水の霞で淡くなる
 */

export function buildExterior(b: Builder, mats: Mats): void {
  const lm = levelMats(mats, 'deep');
  const r = rng(41);
  // ---- 1 階の外壁（窓 = 暗いガラス）と、1 階の床・天井（2 階の床の下）
  const darkGlass = mats.get('deep', '#1c3a50', { shade: '#16304a', dark: '#122a40', key: 'dglass' });
  const fl = FL[0];
  const winHoles = (u0: number, u1: number, step: number, w: number, sill: number, head: number): RectHole[] => {
    const out: RectHole[] = [];
    for (let u = u0 + step / 2; u + w / 2 < u1; u += step) out.push({ u0: u - w / 2, u1: u + w / 2, y0: fl + sill, y1: fl + head });
    return out;
  };
  // 南（窓の大きい教室）・北（廊下）・西・東
  const sH = winHoles(0, Z_EAST, 2.3, 1.6, 0.8, 2.3);
  wallRects(b, lm.ext, 'z', -T_EXT / 2, -T_EXT, Z_EAST + T_EXT, fl, fl + 3.3, T_EXT, sH);
  const nH = winHoles(0, Z_EAST, 2.3, 1.4, 0.9, 2.2).filter((h) => h.u1 < STAIR[1] - 0.3 || h.u0 > WC[3] + 0.3);
  wallRects(b, lm.ext, 'z', XN + T_EXT / 2, -T_EXT, Z_EAST + T_EXT, fl, fl + 3.3, T_EXT, nH);
  wallRects(b, lm.ext, 'x', -T_EXT / 2, 0, XN, fl, fl + 3.3, T_EXT, [{ u0: 1.2, u1: 2.8, y0: fl + 0.8, y1: fl + 2.3 }]);
  wallRects(b, lm.ext, 'x', Z_EAST + T_EXT / 2, 0, XN, fl, fl + 3.3, T_EXT, []);
  for (const h of sH) b.boxMM(darkGlass, [-0.14, h.y0, h.u0], [-0.1, h.y1, h.u1], { shadow: 'receive' });
  for (const h of nH) b.boxMM(darkGlass, [XN + 0.1, h.y0, h.u0], [XN + 0.14, h.y1, h.u1], { shadow: 'receive' });
  // 2 階の床の下（1 階の天井。外から見える軒の裏はバルコニーで隠れる）
  b.boxMM(lm.ceil, [0, fl + 3.3 - 0.02, 0], [XN, fl + 3.3, Z_EAST], { shadow: true });
  // 庇（1 階の南の窓の上）
  b.boxMM(lm.ext, [-1.0, fl + 2.6, 0], [-T_EXT, fl + 2.72, Z_EAST], { shadow: true });

  // ---- 屋上（3 階の上）: スラブ・パラペット・塔屋（階段室の上）・高架水槽
  const roof = FL[3];
  b.boxMM(lm.ext, [-T_EXT, roof - 0.3, -T_EXT], [XN + T_EXT, roof, Z_EAST + T_EXT], { shadow: true });
  const roofTop = mats.get('deep', '#3f7894', { key: 'roof', tiles: { size: [0.6, 0.6], line: 0.01, color: '#2b5c76' } });
  b.boxMM(roofTop, [0, roof, 0], [XN, roof + 0.05, Z_EAST], { shadow: true });
  for (const [a, c] of [
    [[-T_EXT, -T_EXT], [XN + T_EXT, 0]],
    [[-T_EXT, Z_EAST], [XN + T_EXT, Z_EAST + T_EXT]],
    [[-T_EXT, 0], [0, Z_EAST]],
    [[XN, 0], [XN + T_EXT, Z_EAST]],
  ] as [[number, number], [number, number]][]) {
    b.boxMM(lm.ext, [a[0], roof, a[1]], [c[0], roof + 0.9, c[1]], { shadow: true });
    b.boxMM(lm.sill, [a[0] - 0.03, roof + 0.9, a[1] - 0.03], [c[0] + 0.03, roof + 0.96, c[1] + 0.03], { shadow: true });
  }
  // 高架水槽（鉄の架台と青い箱）
  const tank = mats.get('deep', '#5a9cb8', { key: 'tank', tiles: { size: [1, 1], line: 0.015, color: '#3a7894' } });
  b.boxMM(tank, [3, roof + 1.6, 22], [5.6, roof + 3.4, 25], { shadow: true });
  for (const [x, z] of [[3.1, 22.1], [5.4, 22.1], [3.1, 24.8], [5.4, 24.8]]) b.boxMM(lm.frame, [x - 0.05, roof, z - 0.05], [x + 0.05, roof + 1.6, z + 0.05], { shadow: true });

  // ---- 崖の上の地面（草の面と土の斑）・崖の縁の柵
  // 崖の上の草（暗い緑灰・草の短い明るい葉）と、北の校庭の土（決まった区画: 建物と体育館の間・体育館の北）。
  // 草と土の境は区画の縁（面の上に斑の模様は描かない）
  const grass = mats.get('deep', '#3f7a70', { shade: '#2c5c5e', dark: '#224c54', key: 'grass', flecks: { scale: 6, density: 0.25, color: '#5f9a88', length: 0.4, width: 0.06 } });
  b.boxMM(grass, [-5, -0.4, -6.5], [45.5, -0.05, 59.5], { collide: true, shadow: 'receive' });
  const dirt = mats.get('deep', '#4f6f6c', { shade: '#34545a', dark: '#2a4850', key: 'dirt', flecks: { scale: 3, density: 0.12, color: '#6f8f88', length: 0.12, width: 0.08 } });
  for (const [x0, z0, x1, z1] of [[12.5, -2, 25.2, 50], [25.2, 31, 43.5, 50], [25.2, -2, 43.5, 5.2]] as [number, number, number, number][]) b.boxMM(dirt, [x0, -0.06, z0], [x1, -0.045, z1], { shadow: 'receive' });
  const fence = mats.get('deep', '#3f7894', { key: 'fence' });
  const post = (x: number, z: number): void => {
    b.boxMM(fence, [x - 0.03, -0.05, z - 0.03], [x + 0.03, 1.1, z + 0.03], { shadow: true });
  };
  for (let z = -6.2; z < 59; z += 2.0) post(-4.8, z);
  for (let x = -4.8; x < 45; x += 2.0) post(x, -6.3);
  for (const y of [0.4, 1.05]) {
    b.boxMM(fence, [-4.82, y, -6.3], [-4.78, y + 0.04, 59.5], { shadow: true });
    b.boxMM(fence, [-4.8, y, -6.32], [45.5, y + 0.04, -6.28], { shadow: true });
  }

  // ---- 北の校庭: 体育館（かまぼこ屋根）・フェンス・松・電柱・旗竿
  const gymWall = mats.get('deep', '#4f8098', { shade: '#355f76', dark: '#2a5068', key: 'gym' });
  const gymRoof = mats.get('deep', '#3a6a80', { shade: '#2c566c', dark: '#244a60', hi: '#4a7a90', key: 'gymroof', tiles: { size: [0.5, 30], line: 0.02, color: '#2a5468' } });
  const gx0 = 26;
  const gx1 = 40;
  const gz0 = 6;
  const gz1 = 30;
  b.boxMM(gymWall, [gx0, -0.05, gz0], [gx1, 6.5, gz1], { collide: true, shadow: true });
  const arc = new THREE.CylinderGeometry((gx1 - gx0) / 2 / Math.sin(0.9), (gx1 - gx0) / 2 / Math.sin(0.9), gz1 - gz0 + 0.6, 24, 1, false, -0.9, 1.8);
  arc.rotateX(Math.PI / 2);
  const rr = (gx1 - gx0) / 2 / Math.sin(0.9);
  b.mesh(arc, gymRoof, [(gx0 + gx1) / 2, 6.5 - rr * Math.cos(0.9), (gz0 + gz1) / 2], { shadow: true });
  // 体育館の外壁の部材（どの面も同じ決まり）: 柱型 4 m おき・上の窓の列（枠と竪框）・腰の水切り・下の換気口と扉・縦樋
  const gymFrame = mats.get('deep', '#5f90a6', { shade: '#3f6a80', dark: '#2f5a70', key: 'gymframe' });
  const gymBase = mats.get('deep', '#3f6a80', { shade: '#2c566c', dark: '#244a60', key: 'gymbase' });
  for (let z = gz0; z <= gz1 + 0.01; z += 4) b.boxMM(gymFrame, [gx0 - 0.25, -0.05, z - 0.25], [gx0, 6.6, z + 0.25], { shadow: true });
  for (let x = gx0; x <= gx1 + 0.01; x += 3.5) b.boxMM(gymFrame, [x - 0.25, -0.05, gz0 - 0.25], [x + 0.25, 6.6, gz0], { shadow: true });
  b.boxMM(gymBase, [gx0 - 0.08, -0.05, gz0 - 0.08], [gx0, 1.0, gz1 + 0.08], { shadow: true });
  b.boxMM(gymBase, [gx0 - 0.08, -0.05, gz0 - 0.08], [gx1 + 0.08, 1.0, gz0], { shadow: true });
  b.boxMM(gymFrame, [gx0 - 0.12, 1.0, gz0 - 0.12], [gx0, 1.06, gz1 + 0.12], { shadow: true });
  for (let z = gz0 + 0.5; z < gz1 - 0.4; z += 4) {
    for (let k = 0; k < 3; k++) {
      const za = z + 0.25 + k * 1.1;
      b.boxMM(darkGlass, [gx0 - 0.03, 3.6, za], [gx0 - 0.01, 5.6, za + 1.0], { shadow: 'receive' });
      b.boxMM(gymFrame, [gx0 - 0.06, 4.55, za], [gx0 - 0.02, 4.6, za + 1.0], { shadow: false });
    }
    b.boxMM(gymFrame, [gx0 - 0.08, 3.55, z + 0.2], [gx0, 3.62, z + 3.6], { shadow: true });
    // 下の換気口（ガラリ）
    for (let k = 0; k < 4; k++) b.boxMM(gymBase, [gx0 - 0.04, 0.35 + k * 0.07, z + 1.6], [gx0, 0.38 + k * 0.07, z + 2.4], { shadow: false });
  }
  for (let x = gx0 + 0.5; x < gx1 - 0.4; x += 3.5) for (let k = 0; k < 3; k++) b.boxMM(darkGlass, [x + 0.2 + k * 0.95, 3.6, gz0 - 0.03], [x + 1.05 + k * 0.95, 5.6, gz0 - 0.01], { shadow: 'receive' });
  // 扉（鉄の両開き・上の庇）と縦樋
  b.boxMM(darkGlass, [gx0 - 0.03, 0, 16.5], [gx0 - 0.01, 2.4, 18.3], { shadow: 'receive' });
  b.boxMM(gymFrame, [gx0 - 0.9, 2.5, 16.2], [gx0, 2.62, 18.6], { shadow: true });
  for (const z of [gz0 + 0.35, gz1 - 0.35, 17.4 + 4]) b.cyl(gymBase, [gx0 - 0.12, 3.2, z], 0.05, 6.4, { shadow: true });
  // 校庭のフェンス（北と東）
  for (let z = -2; z < 50; z += 3) b.boxMM(fence, [44 - 0.04, -0.05, z - 0.04], [44 + 0.04, 3.5, z + 0.04], { shadow: true });
  b.boxMM(mats.get('deep', '#5a92a8', { key: 'net', transparent: true, opacity: 0.35, depthWrite: false }), [43.98, 0, -2], [44.02, 3.4, 50], { shadow: false });
  // 風で傾いた松（幹と、平たく重なる葉の塊）
  const trunk = mats.get('deep', '#3d6676', { key: 'trunk' });
  const leaf = mats.get('deep', '#3f8a86', { shade: '#285e6a', dark: '#1f4c5c', key: 'pine' });
  for (const [x, z, h] of [[22, 1, 6.5], [24, 10, 5.5], [17, 36, 7], [22, 44, 6], [-2, 42, 5.5], [9, 52, 6.2]] as [number, number, number][]) {
    const lean = 0.35 + r() * 0.2;
    const tg = new THREE.CylinderGeometry(0.12, 0.2, h, 7);
    tg.translate(0, h / 2, 0);
    tg.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, lean, 0, 0, 0));
    b.mesh(tg, trunk, [x, -0.05, z], { shadow: true });
    // 葉の塊: 枝の先ごとに小さな平たい塊を数個ずつ（ちぎれた縁の雲のような松の葉）
    for (let k = 0; k < 7; k++) {
      const hy = h * (0.5 + k * 0.08);
      const cx = x + hy * lean * 0.95 + (r() - 0.5) * 2.2;
      const cz = z + (r() - 0.5) * 2.4;
      for (let j = 0; j < 7; j++) {
        const g = new THREE.IcosahedronGeometry(1, 0);
        const s = 0.3 + r() * 0.45;
        g.scale(s * (1.1 + r() * 0.5), s * (0.6 + r() * 0.35), s * (1.0 + r() * 0.5));
        g.rotateY(r() * 3);
        g.translate(cx + (r() - 0.5) * 1.6, hy + (r() - 0.5) * 0.5, cz + (r() - 0.5) * 1.6);
        b.mesh(g, leaf, [0, 0, 0], { shadow: true });
      }
    }
  }
  // 電柱と電線・旗竿
  const pole = mats.get('deep', '#4f8aa2', { key: 'pole' });
  for (const z of [-3, 22, 47]) {
    b.cyl(pole, [48, 4.5, z], 0.14, 9, { shadow: true });
    b.boxMM(pole, [47.2, 8.2, z - 0.06], [48.8, 8.3, z + 0.06], { shadow: true });
  }
  for (const y of [8.3, 7.6]) b.boxMM(pole, [48.6, y - 0.01, -3], [48.62, y + 0.01, 47], { shadow: false });
  b.cyl(pole, [22, 4.5, 30], 0.05, 9, { shadow: true });
  void CH;
  void CORR;
}
