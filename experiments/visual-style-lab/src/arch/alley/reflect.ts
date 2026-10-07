import * as THREE from 'three';
import { FacadePainter, refCamera, type FacadeTile } from '../../scenes/alley/facade.ts';
import { paintLeft, paintRight } from '../../scenes/alley/layout.ts';
import type { ViewDef } from '../../scenes/types.ts';
import type { PaintTile } from './glass.ts';
import { EAST, L0, LK, type V3 } from './layout.ts';
import { lineClear } from './sun.ts';

/**
 * 窓の映り込みの絵（元の版の壁面の絵をそのまま使う。読むだけ）。
 * 元の版は壁の平面に「参考画像の視点で見える形」を描いて壁に貼っていた。建築版では、この絵をガラスの中の映り込みとして
 * 引く（glass.ts。参考画像の目ではちょうど元の絵になり、ほかの所からは鏡の中の世界の絵として視線に合わせてずれる）。
 * 壁・柱・枠は本当の形が手前に来るので、絵の壁の部分はガラスの所でだけ見える（向かいの壁の映り込みに見える）。
 */

export interface FacadePaint {
  tiles: PaintTile[];
  eye: [number, number, number];
  viewProj: THREE.Matrix4;
}

function tilesOf(fp: FacadePainter, tiles: FacadeTile[]): PaintTile[] {
  return tiles.map((t) => ({ texture: fp.raster(t), rect: [t.u[0], t.y[0], t.u[1], t.y[1]] as [number, number, number, number] }));
}

function vp(view: ViewDef): THREE.Matrix4 {
  const cam = refCamera(view);
  return new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
}

/** 右（東棟）の映り込みの絵 */
export function paintEast(view: ViewDef): FacadePaint {
  const cam = refCamera(view);
  const fp = new FacadePainter({ origin: [EAST.origin[0], 0, EAST.origin[1]], tangent: [0, 0, -1], normal: [-1, 0, 0] }, cam, 11);
  paintRight(fp);
  const tiles = tilesOf(fp, [
    { u: [-6, 1], y: [-1, 21], ppm: 20 },
    { u: [1, 5], y: [-1, 6], ppm: 160 },
    { u: [1, 5], y: [6, 21], ppm: 40 },
    { u: [5, 9], y: [-1, 21], ppm: 90 },
    { u: [9, 16], y: [-1, 21], ppm: 56 },
    { u: [16, 40], y: [-1, 21], ppm: 32 },
  ]);
  return { tiles, eye: [...view.eye], viewProj: vp(view) };
}

/** 左（西棟）の映り込みの絵 */
export function paintWest(view: ViewDef): FacadePaint {
  const cam = refCamera(view);
  const fp = new FacadePainter({ origin: [L0, 0, 0], tangent: [LK, 0, -1], normal: [1, 0, LK] }, cam, 5);
  paintLeft(fp);
  const tiles = tilesOf(fp, [
    { u: [-12, 5.5], y: [-1, 26], ppm: 20 },
    { u: [5.5, 12], y: [-1, 26], ppm: 90 },
    { u: [12, 20], y: [-1, 26], ppm: 64 },
    { u: [20, 36], y: [-1, 26], ppm: 40 },
  ]);
  return { tiles, eye: [...view.eye], viewProj: vp(view) };
}

/**
 * 東棟の壁の日なたの形（u・y の絵。白 = 日なた）。
 * 西棟の北の端は道路斜線で低いので、午後の日がその上を越えて東棟の壁の北の方に当たる。下の縁は西棟の斜めの屋根の影、
 * 縁のちぎれは裏庭の木の葉の影（元の版の絵の形を、参考画像の視点の画素で書いて壁に戻した）
 */
export function sunMaskEast(view: ViewDef): { texture: THREE.Texture; rect: [number, number, number, number] } {
  const cam = refCamera(view);
  const fp = new FacadePainter({ origin: [EAST.origin[0], 0, EAST.origin[1]], tangent: [0, 0, -1], normal: [-1, 0, 0] }, cam, 21);
  const W = '#ffffff';
  const B = '#000000';
  // 木の葉の影の中（空の光と照り返しで、通路の陰よりは明るい）
  const L = '#585858';
  fp.rectF(8, -1, 40, 22, B);
  fp.fill([[770, -400], [880, -400], [880, 380], [770, 380]], W);
  fp.foliage(
    [
      [880, 110],
      [872, 150],
      [860, 200],
      [846, 228],
      [834, 258],
      [820, 278],
      [810, 300],
      [800, 330],
      [790, 360],
      [780, 380],
      [880, 380],
    ],
    L,
    { leafPx: 6, edge: 2.2, spread: 1.6 },
  );
  fp.foliage([[830, 160], [850, 150], [856, 180], [836, 195]], L, { leafPx: 5, edge: 1.4 });
  fp.foliage([[800, 230], [818, 222], [822, 250], [804, 258]], L, { leafPx: 4, edge: 1.4 });
  // 下の縁（1 階の高さ）は西棟の影
  fp.fill([[760, 380], [960, 372], [960, 900], [760, 900]], B);
  const rect: [number, number, number, number] = [8, -1, 40, 22];
  const texture = fp.raster({ u: [rect[0], rect[2]], y: [rect[1], rect[3]], ppm: 24 });
  texture.colorSpace = THREE.NoColorSpace;
  return { texture, rect };
}


/**
 * 参考画像の視点から点 p が見えるか（画角の中で、建物・塀・木の冠に遮られない）。
 * 参考画像の視点に写る所の見た目を変えないために、足す物をここで選り分ける
 */
export function refSees(view: ViewDef, p: V3, margin = 0.3, spread = 0.6): boolean {
  const cam = refCamera(view);
  // 物の大きさの分だけまわりの点も調べる（どれか 1 つでも見えれば「見える」）
  for (const [dx, dy] of [
    [0, 0],
    [spread, 0],
    [-spread, 0],
    [0, spread],
    [0, -spread],
  ]) {
    const q: V3 = [p[0] + dx, p[1] + dy, p[2]];
    const v = new THREE.Vector3(...q).project(cam);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
    if (lineClear(view.eye, q, margin)) return true;
  }
  return false;
}
