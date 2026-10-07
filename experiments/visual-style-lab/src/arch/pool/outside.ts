import * as THREE from 'three';
import { T } from '../../scenes/pool/kit.ts';
import type { Kit } from '../../scenes/pool/kit.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Frame } from './frame.ts';
import { TERRACE } from './layout.ts';
import { plant, type Dress } from './props.ts';

/**
 * A の西の屋外テラス（外。冬は閉めている）: タイルの床・腰の高さの壁・シートを掛けた屋外プール・重ねたデッキチェア・閉じたパラソル・植え込み。
 * A の西の壁のガラス戸（参考画像の画角の外）から見える。日の光は屋根が無いのでそのまま当たる（影の範囲の外 = 明るい）。
 */
export function buildTerrace(k: Kit, ctx: SceneContext, d: Dress): void {
  const m = ctx.mat;
  const b = k.b;
  const floor = m({ name: 't-floor', color: '#e6ebdf', shade: '#b7c6bb', dark: '#9fb3a7', hi: '#f0f3ea', tiles: { size: 0.3, line: 0.012, color: '#c2cec4', jitter: 0.03 } });
  const wall = m({ name: 't-wall', color: '#eef2e7', shade: '#bccbc1', dark: '#a2b6ab', hi: '#f6f8f1', tiles: { size: 2 * T, line: 0.01, color: '#cdd8cd' } });
  const tarp = m({ name: 't-tarp', color: '#5f8790', shade: '#4d727a', dark: '#3f6168', hi: '#6c95a0' });
  const coping = m({ name: 't-coping', color: '#d6e3db', shade: '#a9c0b5', dark: '#8fa89c', hi: '#e2ebe5' });
  const [x0, z0, x1, z1] = TERRACE;
  k.deck(floor, x0, z0, x1, z1, 0.15);
  // 腰の高さの壁（北・西・南）
  k.box(wall, [x0 - 0.25, 0.15, z0 - 0.25], [x1, 1.15, z0], { collide: true });
  k.box(wall, [x0 - 0.25, 0.15, z1], [x1, 1.15, z1 + 0.25], { collide: true });
  k.box(wall, [x0 - 0.25, 0.15, z0], [x0, 1.15, z1], { collide: true });
  // シートを掛けた屋外プール（8 × 16 m）。縁石とシートを留める綱
  const P = [-30.5, -24, -22.5, -8];
  b.boxMM(coping, [P[0] - 0.4, 0.15, P[1] - 0.4], [P[2] + 0.4, 0.2, P[3] + 0.4], { shadow: true });
  b.boxMM(tarp, [P[0], 0.2, P[1]], [P[2], 0.24, P[3]], { shadow: true });
  for (let z = P[1] + 1; z < P[3]; z += 2) b.boxMM(d.p.rope, [P[0] - 0.3, 0.24, z - 0.02], [P[2] + 0.3, 0.26, z + 0.02], { shadow: false });
  // 重ねたデッキチェア・閉じたパラソル・植え込み
  for (const [x, z] of [[-26, -3], [-23.5, -3], [-21, -3]] as [number, number][]) {
    const f = new Frame(b, [x, 0.15, z], 0);
    for (let i = 0; i < 5; i++) f.box(d.p.white, [-0.33, 0.2 + i * 0.1, -0.9], [0.33, 0.25 + i * 0.1, 0.9], { shadow: true });
    for (const sx of [-0.3, 0.3]) f.box(d.p.metal, [sx - 0.02, 0, -0.85], [sx + 0.02, 0.7, -0.8], { shadow: true });
  }
  for (const [x, z] of [[-32, -27], [-32, -16], [-32, -5]] as [number, number][]) {
    const f = new Frame(b, [x, 0.15, z], 0);
    f.cyl(d.p.white, [0, 0.15, 0], 0.35, 0.3, { segments: 12, shadow: true });
    f.cyl(d.p.metal, [0, 1.3, 0], 0.03, 2.3, { segments: 6, shadow: true });
    f.cyl(d.p.teal, [0, 1.6, 0], 0.14, 1.2, { radiusTop: 0.05, segments: 8, shadow: true });
  }
  for (const z of [-28.5, -20, -11]) plant(d, new Frame(b, [-20.0, 0.15, z], 0), 1.3);
  // 腰壁の上の段々の笠木（タイルの塊を 2 段）と、2.5 m おきの柱型
  const cap = m({ name: 't-cap', color: '#f2f5ec', shade: '#a9c2b6', dark: '#8faea3', hi: '#f8f9f4', tiles: { size: T, line: 0.012, color: '#cdd8cd' } });
  const runs: [number, number, number, number][] = [[x0 - 0.25, z0 - 0.25, x1, z0], [x0 - 0.25, z1, x1, z1 + 0.25], [x0 - 0.25, z0, x0, z1]];
  for (const [ax, az, bx, bz] of runs) {
    b.boxMM(cap, [ax - 0.08, 1.15, az - 0.08], [bx + 0.08, 1.27, bz + 0.08], { shadow: true });
    b.boxMM(cap, [ax - 0.02, 1.27, az - 0.02], [bx + 0.02, 1.35, bz + 0.02], { shadow: true });
  }
  for (let x = x0 + 1.5; x < x1 - 0.5; x += 2.5) for (const z of [z0 - 0.25, z1]) b.boxMM(wall, [x - 0.25, 0.15, z - 0.12], [x + 0.25, 1.6, z + 0.37], { shadow: true, collide: true });
  for (let z = z0 + 1.5; z < z1 - 0.5; z += 2.5) b.boxMM(wall, [x0 - 0.37, 0.15, z - 0.25], [x0 + 0.12, 1.6, z + 0.25], { shadow: true, collide: true });
  // パーゴラ（テラスの東の端、建物の壁ぞい）: 段々の端を持つ梁と角柱
  const pg = m({ name: 't-pergola', color: '#eef2e7', shade: '#9fbab0', dark: '#86a69c', hi: '#f6f8f1', tiles: { size: 2 * T, line: 0.01, color: '#cdd8cd' } });
  const px0 = x1 - 4.0;
  for (const z of [z0 + 2.0, (z0 + z1) / 2, z1 - 2.0]) b.boxMM(pg, [px0 - 0.25, 0.15, z - 0.25], [px0 + 0.25, 2.9, z + 0.25], { shadow: true, collide: true });
  b.boxMM(pg, [px0 - 0.35, 2.9, z0 + 1.6], [px0 + 0.35, 3.3, z1 - 1.6], { shadow: true });
  for (let z = z0 + 2.0; z < z1 - 1.8; z += 1.0) {
    b.boxMM(pg, [px0 - 0.6, 3.3, z - 0.12], [x1, 3.55, z + 0.12], { shadow: true });
    b.boxMM(pg, [px0 - 0.85, 3.3, z - 0.12], [px0 - 0.6, 3.42, z + 0.12], { shadow: true });
  }
  // 敷地の外の木立（暗い青緑の塊。参考画像の天窓に映る木の影と同じ色）と生け垣
  const leaf = m({ name: 't-leaf', color: '#4e7f7a', shade: '#3c6b68', dark: '#2f5956', hi: '#6a9a92', line: 0.2 });
  const hedge = m({ name: 't-hedge', color: '#5f8f86', shade: '#4a7a74', dark: '#3d6b67', hi: '#78a69c', line: 0.2 });
  b.boxMM(hedge, [x0 - 1.6, 0.0, z0 - 1.0], [x0 - 0.5, 1.6, z1 + 1.0], { shadow: false });
  let rs = 11;
  const rnd = (): number => ((rs = (rs * 9301 + 49297) % 233280) / 233280);
  for (let z = z0 - 4; z < z1 + 4; z += 3.2) {
    const cx = x0 - 4.5 - rnd() * 3;
    const h = 5 + rnd() * 3;
    b.cyl(d.p.tealDark, [cx, h * 0.3, z], 0.18, h * 0.6, { segments: 6, shadow: false });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.SphereGeometry(1.4 + rnd() * 0.8, 18, 12);
      g.scale(1, 0.8, 1);
      b.mesh(g, leaf, [cx + (rnd() - 0.5) * 1.6, h * 0.6 + i * 0.9, z + (rnd() - 0.5) * 1.6], { shadow: false });
    }
  }
}
