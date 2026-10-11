import { solveFromVanishingPoint, ViewCam } from '../../core/ViewCam.ts';
import { NORTH, ROOMS } from './layout.ts';

/**
 * 参考画像の視点のカメラ（画素 → 座標）。消失点と既知の寸法（扉 2.0〜2.1 m・床のタイル 0.6 m・吹き出しの床の間隔 1.2 m）から解いた。
 * - serverroom-0（B）: 消失点 (731, 400)。天井の器具の並び（中心 x 731）と右の列のラックの上端の線。扉 205 px = 2.1 m → 壁まで 8.96 m・目 1.23 m
 * - serverroom-2（A）: 消失点 (711, 369)。吹き出しの床の外側の縁 2 本。吹き出しの間隔 1.2 m・タイル 0.6 m → 焦点 1141 px（縦 39.4°）・目 1.29 m・壁まで 9.26 m
 * - serverroom-1（C）: 消失点 (765, 480)。上のケーブルラックの縁と床の暗い升の縁。扉 187 px = 2.0 m → 壁まで 9.36 m・目 1.16 m
 */

function cam(vp: [number, number], fov: number, eye: [number, number, number]): ViewCam {
  const s = solveFromVanishingPoint(vp, fov);
  return new ViewCam(eye, s.yaw, s.pitch, fov);
}

export const CAM_B = cam([731, 400], 50, [ROOMS.B.cx, 1.23, NORTH + 8.96]);
export const CAM_A = cam([703, 369], 39.4, [ROOMS.A.cx, 1.29, NORTH + 9.26]);
export const CAM_C = cam([765, 480], 50, [ROOMS.C.cx, 1.16, NORTH + 9.36]);
