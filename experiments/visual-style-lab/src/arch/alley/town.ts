import * as THREE from 'three';
import { paint } from './paint.ts';
import type { PaintOptions } from '../../render/PaintMaterial.ts';
import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';

/**
 * 塀の向こうの町並み（家・アパート）。東（+x）を向いた正面に、階ごとの窓（枠・桟・庇・カーテン）・玄関と庇・
 * 2 階のベランダ（手すりの格子・室外機・物干し）・たて樋・メーター。壁は横張りの外壁材の目地、屋根は切妻で瓦の筋。
 * 色は参考画像の明るさの段（暗い青緑の段から明るい淡い緑まで）で、日（西南西）の向きで面ごとに分ける:
 * 日の当たる南と西の面・屋根は明るく、正面（東）と北の面は暗い陰。ガラスは暗い板と、空を映した平らな明るい板。
 * 庇・ベランダ・軒の下は暗い（影）。中景なので霧は少し弱く掛ける（明暗の対比を残す）
 */

const P = (o: PaintOptions): THREE.ShaderMaterial => paint(o);

interface TownMats {
  wall: THREE.ShaderMaterial;
  wall2: THREE.ShaderMaterial;
  roof: THREE.ShaderMaterial;
  frame: THREE.ShaderMaterial;
  glass: THREE.ShaderMaterial;
  glass2: THREE.ShaderMaterial;
  curtain: THREE.ShaderMaterial;
  dark: THREE.ShaderMaterial;
  rail: THREE.ShaderMaterial;
  ac: THREE.ShaderMaterial;
  shade: THREE.ShaderMaterial;
}

function mats(fog0: number): TownMats {
  const fog = fog0 * 0.65;
  return {
    // 外壁: 東・北は陰、南・西は日なた。横張りの目地
    wall: P({ color: { px: '#16323b', nz: '#152f37', nx: '#386b6f', pz: '#5f9790', py: '#386b6f', ny: '#0c1e25' }, layers: [{ color: { px: '#16323b', nz: '#152f37', nx: '#386b6f', pz: '#5f9790' }, scale: 1, threshold: -2, only: 'wall' }], grid: { layer: 0, size: [50, 0.32], width: 0.018, color: '#112730' }, fog }),
    wall2: P({ color: { px: '#1b3b44', nz: '#18363f', nx: '#386b6f', pz: '#5f9790', py: '#386b6f', ny: '#0c1e25' }, fog }),
    roof: P({ color: { py: '#386b6f', side: '#122a33', ny: '#0c1e25' }, layers: [{ color: '#386b6f', scale: 1, threshold: -2, only: 'floor' }], grid: { layer: 0, size: [0.3, 50], width: 0.03, color: '#1f454d' }, fog }),
    frame: P({ color: { px: '#27535c', nz: '#1f454d', side: '#1f454d', pz: '#5f9790', nx: '#5f9790', py: '#386b6f' }, fog }),
    glass: P({ color: { side: '#0d2129', px: '#0f242d' }, fog }),
    glass2: P({ color: { side: '#5f9790', px: '#b9e8d2' }, fog }),
    curtain: P({ color: { side: '#27535c', px: '#386b6f' }, fog }),
    dark: P({ color: { side: '#0c1e25', py: '#122a33' }, fog }),
    rail: P({ color: { side: '#1b3b44', py: '#27535c', pz: '#5f9790' }, fog }),
    ac: P({ color: { side: '#27535c', px: '#386b6f', py: '#5f9790', pz: '#5f9790' }, fog }),
    // 庇・ベランダの下の壁に落ちる影の帯
    shade: P({ color: '#0c1e25', fog }),
  };
}

/** 家（正面は +x）。x0〜x1・z0〜z1 の箱、高さ h（階 2 なら 5.6〜6.5 m）。floors = 階の数 */
export function house(b: Builder, x0: number, z0: number, x1: number, z1: number, h: number, floors: number, seed: number, fog = 0.7): void {
  const m = mats(fog);
  const r = rng(seed);
  const box = (mat: THREE.Material, min: V3, max: V3): void => {
    b.boxMM(mat, min, max, { shadow: false });
  };
  box(r() < 0.5 ? m.wall : m.wall2, [x0, 0, z0], [x1, h, z1]);
  // 切妻の屋根（棟は z の向き。軒の出 0.45 m・勾配 4/10）
  const dx = (x1 - x0) / 2 + 0.45;
  const rise = dx * 0.4;
  const len = Math.hypot(dx, rise);
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(len, 0.12, z1 - z0 + 0.7);
    g.rotateZ(s * Math.atan2(rise, dx));
    g.translate((x0 + x1) / 2 - (s * dx) / 2, h + rise / 2, (z0 + z1) / 2);
    b.mesh(g, m.roof, [0, 0, 0], { shadow: false });
  }
  // 軒の下の影（正面の壁の上の帯）
  box(m.shade, [x1 + 0.002, h - 0.45, z0], [x1 + 0.005, h, z1]);
  // 妻の三角の壁
  const tri = new THREE.Shape();
  tri.moveTo(x0, h);
  tri.lineTo(x1, h);
  tri.lineTo((x0 + x1) / 2, h + rise * 0.95);
  tri.closePath();
  for (const z of [z0, z1]) {
    const g = new THREE.ShapeGeometry(tri);
    // ShapeGeometry は xy 面。z の位置に置く（向きは外向き）
    if (z === z0) g.rotateY(Math.PI).translate(x0 + x1, 0, 0);
    g.translate(0, 0, z);
    b.mesh(g, m.wall2, [0, 0, 0], { shadow: false });
  }
  // 正面の窓（階ごと。枠・中の桟・上の小さな庇・半分はカーテン）
  const fh = h / floors;
  const front = x1;
  const nWin = Math.max(1, Math.floor((z1 - z0 - 1) / 2.6));
  for (let f = 0; f < floors; f++) {
    const y0 = f * fh + (f === 0 ? 0.9 : 0.95);
    const wh = f === 0 ? 1.15 : 1.1;
    for (let i = 0; i < nWin; i++) {
      const zc = z0 + ((i + 0.5) * (z1 - z0)) / nWin + (r() - 0.5) * 0.3;
      if (f === 0 && i === nWin - 1 && nWin > 1) {
        // 玄関の扉と庇
        box(m.dark, [front, 0, zc - 0.45], [front + 0.04, 2.0, zc + 0.45]);
        box(m.frame, [front, 2.0, zc - 0.5], [front + 0.05, 2.06, zc + 0.5]);
        box(m.wall2, [front, 2.25, zc - 0.8], [front + 0.75, 2.33, zc + 0.8]);
        box(m.shade, [front + 0.002, 1.95, zc - 0.8], [front + 0.005, 2.25, zc + 0.8]);
        box(m.frame, [front + 0.04, 1.0, zc + 0.25], [front + 0.06, 1.08, zc + 0.32]);
        continue;
      }
      const ww = 1.2 + r() * 0.5;
      box(m.frame, [front, y0 - 0.05, zc - ww / 2 - 0.05], [front + 0.04, y0 + wh + 0.05, zc + ww / 2 + 0.05]);
      box(r() < 0.4 ? m.glass2 : m.glass, [front + 0.04, y0, zc - ww / 2], [front + 0.045, y0 + wh, zc + ww / 2]);
      box(m.frame, [front + 0.045, y0, zc - 0.02], [front + 0.06, y0 + wh, zc + 0.02]);
      if (r() < 0.5) box(m.curtain, [front + 0.046, y0 + 0.05, zc - ww / 2 + 0.05], [front + 0.05, y0 + wh - 0.05, zc - ww / 2 + 0.05 + ww * (0.2 + r() * 0.3)]);
      // 窓の上の小さな庇・下の手すり（2 階）
      box(m.wall2, [front, y0 + wh + 0.12, zc - ww / 2 - 0.2], [front + 0.35, y0 + wh + 0.17, zc + ww / 2 + 0.2]);
      box(m.shade, [front + 0.002, y0 + wh - 0.12, zc - ww / 2 - 0.2], [front + 0.005, y0 + wh + 0.12, zc + ww / 2 + 0.2]);
      if (f > 0 && r() < 0.5) for (let z = zc - ww / 2; z <= zc + ww / 2 + 1e-3; z += 0.12) box(m.rail, [front + 0.12, y0, z - 0.012], [front + 0.14, y0 + 0.45, z + 0.012]);
    }
  }
  // 2 階のベランダ（ある家だけ）: 床の板・手すりの格子・室外機・物干し竿
  if (floors >= 2 && r() < 0.65) {
    const by = fh;
    const bz0 = z0 + 0.6;
    const bz1 = Math.min(z1 - 0.6, bz0 + 3.6);
    box(m.wall2, [front, by - 0.12, bz0], [front + 0.95, by, bz1]);
    box(m.shade, [front + 0.002, by - 0.6, bz0], [front + 0.005, by - 0.12, bz1]);
    box(m.rail, [front + 0.9, by + 0.95, bz0], [front + 0.95, by + 1.0, bz1]);
    for (let z = bz0; z <= bz1 + 1e-3; z += 0.11) box(m.rail, [front + 0.91, by, z - 0.01], [front + 0.93, by + 0.95, z + 0.01]);
    box(m.ac, [front + 0.1, by, bz1 - 0.9], [front + 0.4, by + 0.55, bz1 - 0.15]);
    box(m.dark, [front + 0.4, by + 0.12, bz1 - 0.72], [front + 0.401, by + 0.45, bz1 - 0.38]);
    box(m.rail, [front + 0.5, by + 1.55, bz0 + 0.1], [front + 0.53, by + 1.58, bz1 - 0.1]);
  }
  // たて樋・メーター・地面の室外機
  box(m.rail, [front - 0.12, 0, z0 + 0.05], [front - 0.04, h, z0 + 0.13]);
  box(m.ac, [front - 1.6, 0, z0 - 0.35], [front - 0.8, 0.6, z0]);
  box(m.frame, [front - 2.4, 1.0, z0 - 0.12], [front - 2.1, 1.4, z0]);
  // 横の面の小さな窓
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 1.3;
    for (const z of [z0, z1]) {
      const s = z === z0 ? -1 : 1;
      box(m.frame, [x0 + 1.5, y, z + s * 0.0], [x0 + 2.3, y + 0.7, z + s * 0.04]);
      box(m.glass, [x0 + 1.55, y + 0.05, z + s * 0.04], [x0 + 2.25, y + 0.65, z + s * 0.045]);
    }
  }
}

/** アパート（正面は +x）。各階のベランダの並び（手すり・仕切り・掃き出しの窓・室外機） */
export function apartment(b: Builder, x0: number, z0: number, x1: number, z1: number, h: number, floors: number, seed: number, fog = 0.7): void {
  const m = mats(fog);
  const r = rng(seed);
  const box = (mat: THREE.Material, min: V3, max: V3): void => {
    b.boxMM(mat, min, max, { shadow: false });
  };
  box(m.wall2, [x0, 0, z0], [x1, h, z1]);
  box(m.dark, [x0 - 0.1, h, z0 - 0.1], [x1 + 0.1, h + 0.35, z1 + 0.1]);
  const fh = h / floors;
  const units = Math.max(2, Math.floor((z1 - z0) / 3.3));
  const uw = (z1 - z0) / units;
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    for (let i = 0; i < units; i++) {
      const a = z0 + i * uw;
      const c = a + uw;
      // 掃き出しの窓（2 枚）とカーテン
      box(m.frame, [x1, y + 0.1, a + 0.35], [x1 + 0.04, y + 2.15, c - 0.35]);
      box(r() < 0.4 ? m.glass2 : m.glass, [x1 + 0.04, y + 0.15, a + 0.4], [x1 + 0.045, y + 2.1, c - 0.4]);
      if (r() < 0.6) box(m.curtain, [x1 + 0.046, y + 0.2, a + 0.45], [x1 + 0.05, y + 2.05, a + 0.45 + (c - a - 0.9) * (0.2 + r() * 0.4)]);
      box(m.frame, [x1 + 0.045, y + 0.15, (a + c) / 2 - 0.02], [x1 + 0.06, y + 2.1, (a + c) / 2 + 0.02]);
      if (f > 0 || r() < 0.3) {
        // ベランダ（床・手すり・仕切り板）
        box(m.wall2, [x1, y - 0.12, a + 0.05], [x1 + 1.1, y, c - 0.05]);
        if (f > 0) box(m.shade, [x1 + 0.002, y - 0.55, a + 0.05], [x1 + 0.005, y - 0.12, c - 0.05]);
        box(m.wall, [x1 + 1.0, y, a + 0.05], [x1 + 1.1, y + 1.0, c - 0.05]);
        box(m.rail, [x1 + 0.98, y + 1.0, a + 0.05], [x1 + 1.12, y + 1.06, c - 0.05]);
        box(m.frame, [x1, y, a + 0.02], [x1 + 1.05, y + 1.8, a + 0.06]);
        if (r() < 0.7) box(m.ac, [x1 + 0.15, y, c - 0.95], [x1 + 0.45, y + 0.55, c - 0.2]);
        if (r() < 0.4) box(m.rail, [x1 + 0.55, y + 1.6, a + 0.2], [x1 + 0.58, y + 1.63, c - 0.2]);
      }
    }
  }
  // 外階段の側の窓と非常の札
  for (let f = 0; f < floors; f++) box(m.frame, [x0 + 1, f * fh + 1.2, z0 - 0.04], [x0 + 2.2, f * fh + 2.0, z0]);
}
