import * as THREE from 'three';
import { paint } from './paint.ts';
import type { PaintOptions } from '../../render/PaintMaterial.ts';
import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';
import type { ViewDef } from '../../scenes/types.ts';
import { notice } from './dress.ts';
import { LocalFrame } from './frame.ts';
import { FAR, type WingFrame } from './layout.ts';
import { refSees } from './reflect.ts';

/**
 * 道路の向こうの明るい建物の作り込み（参考画像の突き当たりの白く霞んだ高い建物。前の面の壁の絵は元の版のまま）。
 * 近く（裏庭・通用門）から見ても平らな板に見えないように、形を足す:
 * - 窓の帯の縦の桟（出のある方立て。日の当たる西の側は明るく、東の側は陰）・窓の帯の上の庇の下の影
 * - 階ごとの室外機（腰壁の前の架台）・屋上の塔屋・高架水槽・アンテナ
 * - 1 階の店先（暗いガラス・庇・明るい看板・入口）・東の面は陰の色で窓の帯
 * 参考画像の視点から見える所（refSees）には、壁の絵と見え方の変わる物（影の帯・室外機）を置かない。
 */

const P = (o: PaintOptions): THREE.ShaderMaterial => paint(o);

export function buildFarRelief(b: Builder, view: ViewDef): void {
  const r = rng(808);
  const box = (m: THREE.Material, min: V3, max: V3): void => {
    b.boxMM(m, min, max, { shadow: false });
  };
  const [x0, x1] = FAR.x;
  const zf = FAR.z[1]; // 前の面（南）
  const storey = 3.6;
  // 明るい建物の色（参考画像の #ccf8e3 の段）。日なた・陰・暗い所
  const fin = P({ color: { pz: '#9fcdb9', nx: '#ccf8e3', px: '#5f9790', py: '#b9e8d2', ny: '#5f9790' }, fog: 0 });
  const shade = P({ color: '#86b8a6', fog: 0 });
  const unit = P({ color: { pz: '#b9e8d2', side: '#7fb3a8', py: '#ccf8e3', ny: '#5f9790' }, fog: 0 });
  const unitDark = P({ color: { pz: '#386b6f', side: '#386b6f' }, fog: 0 });
  const sees = (p: V3): boolean => refSees(view, p, 0.5);
  const ledge = P({ color: { pz: '#b4e4cc', py: '#ccf8e3', ny: '#7fb3a8', side: '#a6d6c0' }, fog: 0 });
  /** 1 つの建物の前の面（x0〜x1・z = zf・高さ h）の窓の帯ごとの形。addLedge = 窓の下の庇を足す（元の版に無い建物） */
  const facade = (bx0: number, bx1: number, zf: number, h: number, st: number, gl: [number, number], mull: number, addLedge: boolean): void => {
    for (let k = 1; k * st + gl[1] < h - 1; k++) {
      const g0 = k * st + gl[0];
      const g1 = k * st + gl[1];
      for (let x = bx0 + mull; x < bx1 - 0.3; x += mull) {
        if (sees([x, (g0 + g1) / 2, zf + 0.2])) continue;
        box(fin, [x - 0.04, g0, zf], [x + 0.04, g1, zf + 0.16]);
      }
      for (let x = bx0 + 0.4; x < bx1 - 0.5; x += 2.0) {
        const e = Math.min(bx1 - 0.2, x + 2.0);
        // 窓の下の庇と、その下の腰壁に落ちる影（日の高さから 0.4 m ほど）
        if (addLedge && !sees([(x + e) / 2, g0, zf + 0.2])) box(ledge, [x, g0 - 0.14, zf], [e, g0, zf + 0.22]);
        if (!sees([(x + e) / 2, g0 - 0.5, zf + 0.05])) box(shade, [x, g0 - 0.6, zf + 0.002], [e, g0 - 0.14, zf + 0.006]);
      }
      // 室外機（腰壁の前の架台。ところどころ）
      for (let x = bx0 + 1.0; x < bx1 - 1.2; x += 2.5) {
        if (r() > 0.28) continue;
        const y = k * st + 0.35;
        if (sees([x + 0.4, y + 0.3, zf + 0.3])) continue;
        box(unit, [x, y, zf], [x + 0.8, y + 0.6, zf + 0.32]);
        b.cyl(unitDark, [x + 0.3, y + 0.32, zf + 0.325], 0.19, 0.01, { axis: 'z', segments: 16, shadow: false });
        box(unitDark, [x - 0.02, y - 0.05, zf], [x + 0.82, y, zf + 0.36]);
      }
    }
  };
  facade(x0, x1, zf, FAR.h, storey, [1.9, 3.3], 1.25, false);
  facade(FAR.left.x[0], FAR.left.x[1], FAR.z[1] + 3, FAR.left.h, 3.4, [1.6, 3.0], 1.4, true);
  // ---- 1 階の店先（暗いガラス・桟・庇・明るい看板・入口）
  const glassD = P({ color: { pz: '#1f454d', side: '#18363f' }, fog: 0 });
  const glassB = P({ color: { pz: '#5f9790' }, fog: 0 });
  const frameM = P({ color: { pz: '#386b6f', side: '#27535c', py: '#5f9790' }, fog: 0 });
  const canopy = P({ color: { py: '#b9e8d2', ny: '#27535c', pz: '#86b8a6', side: '#86b8a6' }, fog: 0 });
  const sign = P({ color: { pz: '#ccf8e3', side: '#86b8a6' }, fog: 0 });
  box(glassD, [x0 + 0.5, 0, zf + 0.01], [x1 - 0.5, 3.0, zf + 0.02]);
  for (let x = x0 + 0.5; x < x1 - 0.5; x += 1.6) {
    box(frameM, [x - 0.04, 0, zf], [x + 0.04, 3.0, zf + 0.06]);
    if (r() < 0.35) box(glassB, [x + 0.08, 0.4, zf + 0.021], [x + 1.52, 2.5, zf + 0.025]);
  }
  box(frameM, [x0 + 0.5, 2.3, zf], [x1 - 0.5, 2.36, zf + 0.06]);
  for (let x = x0 + 3; x < x1 - 2; x += 6) box(frameM, [x - 0.25, 0, zf], [x + 0.25, 4.3, zf + 0.3]);
  // 庇と、その下の影
  box(canopy, [x0 + 0.3, 3.0, zf], [x1 - 0.3, 3.15, zf + 1.1]);
  box(P({ color: '#27535c', fog: 0 }), [x0 + 0.5, 2.5, zf + 0.022], [x1 - 0.5, 3.0, zf + 0.026]);
  // 看板（明るい板に暗い字のくねり）
  const fr = new LocalFrame({ origin: [x0, zf], tangent: [1, 0], normal: [0, 1] } as WingFrame);
  for (const [a, c] of [
    [1.0, 7.2],
    [9.0, 15.5],
    [17.5, 23.2],
  ] as [number, number][]) {
    box(sign, [x0 + a, 3.3, zf], [x0 + c, 4.2, zf + 0.12]);
    notice(b, fr, 'w', 0.125, a + 0.3, c - 0.3, 3.45, 4.05, 1, 24 + Math.floor(r() * 4), 0);
  }
  // 入口（両開きのガラス戸）
  box(P({ color: { pz: '#0f242d' }, fog: 0 }), [x0 + 10.6, 0, zf + 0.026], [x0 + 12.4, 2.3, zf + 0.03]);
  // ---- 東の面（陰）: 窓の帯
  const eastWall = P({ color: { px: '#5f9790' }, fog: 0.2 });
  const eastGlass = P({ color: { px: '#386b6f' }, fog: 0.2 });
  box(eastWall, [x1, 0.01, FAR.z[0] + 0.01], [x1 + 0.01, FAR.h - 0.01, zf - 0.01]);
  for (let k = 1; k * storey + 3.3 < FAR.h - 1; k++) box(eastGlass, [x1 + 0.01, k * storey + 1.9, FAR.z[0] + 0.6], [x1 + 0.02, k * storey + 3.3, zf - 0.6]);
  // ---- 屋上: 笠木・塔屋・高架水槽・アンテナ
  const roofM = P({ color: { py: '#b9e8d2', pz: '#9fcdb9', nx: '#ccf8e3', px: '#5f9790', nz: '#5f9790' }, fog: 0 });
  box(roofM, [x0, FAR.h, FAR.z[0]], [x1, FAR.h + 0.6, zf]);
  box(roofM, [x0 + 3, FAR.h, FAR.z[0] + 2], [x0 + 9, FAR.h + 3.4, FAR.z[0] + 7]);
  box(roofM, [x1 - 7, FAR.h + 0.6, FAR.z[0] + 3], [x1 - 3.5, FAR.h + 2.6, FAR.z[0] + 6]);
  for (const [x, z] of [
    [x1 - 6.6, FAR.z[0] + 3.4],
    [x1 - 3.9, FAR.z[0] + 3.4],
    [x1 - 6.6, FAR.z[0] + 5.6],
    [x1 - 3.9, FAR.z[0] + 5.6],
  ] as [number, number][])
    box(unitDark, [x - 0.05, FAR.h + 0.6, z - 0.05], [x + 0.05, FAR.h + 1.2, z + 0.05]);
  box(unitDark, [x0 + 5.9, FAR.h + 3.4, FAR.z[0] + 4.4], [x0 + 6.0, FAR.h + 8.0, FAR.z[0] + 4.5]);
  box(unitDark, [x0 + 5.0, FAR.h + 6.5, FAR.z[0] + 4.42], [x0 + 6.9, FAR.h + 6.56, FAR.z[0] + 4.48]);
  // ---- 左の建物の 1 階（店先と庇）
  const [lx0, lx1] = FAR.left.x;
  const lz = FAR.z[1] + 3;
  box(glassD, [lx0 + 0.5, 0, lz + 0.01], [lx1 - 0.5, 2.9, lz + 0.02]);
  for (let x = lx0 + 0.5; x < lx1 - 0.5; x += 1.8) box(frameM, [x - 0.04, 0, lz], [x + 0.04, 2.9, lz + 0.06]);
  box(canopy, [lx0 + 0.3, 2.9, lz], [lx1 - 0.3, 3.05, lz + 0.9]);
  const fr2 = new LocalFrame({ origin: [lx0, lz], tangent: [1, 0], normal: [0, 1] } as WingFrame);
  for (const [a, c] of [
    [lx1 - lx0 - 9, lx1 - lx0 - 2],
    [3, 11],
    [14, 19],
  ] as [number, number][]) {
    box(sign, [lx0 + a, 3.2, lz], [lx0 + c, 4.0, lz + 0.1]);
    notice(b, fr2, 'w', 0.105, a + 0.3, c - 0.3, 3.32, 3.88, 1, 24 + Math.floor(r() * 4), 0);
  }
  // 左の建物の東の面は参考画像の視点から細く見えるので、元の版の色のまま
  void THREE;
}
