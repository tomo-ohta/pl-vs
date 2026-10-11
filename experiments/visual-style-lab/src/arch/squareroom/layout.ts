import { ViewCam, solveFromVanishingPoint } from '../../core/ViewCam.ts';

/**
 * 立方体の大広間と水路（squareroom）の配置の数値。
 *
 * 建物: 立方体の住戸（一辺 3〜4 m の打ち放しの箱）を 40〜50 m の高さまで積み上げた巨大な集合体が、浅い貯水池の上に建つ。
 * 地上は道の代わりに水路（深さ 0.45 m。歩いて渡れる）と、その両側の歩廊。中央に四角い水庭（squareroom の名の「四角い広間」）があり、
 * 4 本の水路が風車形（卍）に出ていく。水路の先は外周の門で、外の明るい霧の湖へ開く。
 *
 * 座標: x 東・z 南・y 上（m）。水面 y = 0。参考画像の視点はどれも中央の水庭を背にして、水路の先の門を見る:
 * - squareroom-0 … B（南へ。浸水した通り。奥の高い門と上の切れ目）
 * - squareroom-1 … D（西へ。細く暗い水路。奥の水際の扉と窓）
 * - squareroom-2 … A（東へ。柱の歩廊のある大運河。奥の四角い開口）
 * - squareroom-3 … C（北へ。日の差す水路と飛び石。奥の大きな門と外の段々）
 *
 * 水路ごとに「局所の座標」（目が原点・-z が奥・+x が右）で形を書き、Frame で世界へ回して置く（参考画像の画素から測った値がそのまま読める）。
 */

/** 水面の高さ */
export const WATER = 0;
/** 水路の底（水深 0.45 m: 膝まで。歩いて渡れる） */
export const BED = -0.45;
/** 歩廊の高さ（水面から 0.3 m） */
export const WALK = 0.3;
/** 浸水した通り（B）の床（水面と同じ。乾いた板石の所だけ水面より上に出る） */
export const STREET = 0.0;

/** 中央の水庭: 水面 [-14, 14]²、まわりの歩廊 [-18, 18]² */
export const BASIN = { water: 14, walk: 18 };

/** 水路の局所の座標を世界へ: 回す回数 k（yaw = k·π/2。0 = 北を向く）と原点 */
export interface FrameDef {
  k: 0 | 1 | 2 | 3;
  ox: number;
  oz: number;
}

/** 視点の測った値（消失点・縦の画角・目の高さ） */
export interface ViewSpec {
  id: string;
  label: string;
  /** 奥へ向かう水平な線の消失点（画素） */
  vp: [number, number];
  fov: number;
  /** 目の高さ（世界の y） */
  eyeY: number;
  frame: FrameDef;
}

/**
 * 視点。消失点は床と壁の境目・歩廊の縁・水際の線から（docs/stages/squareroom.md の表）。
 * 画角はどの画像も 45°（既知の寸法: 扉・歩廊の段・型枠の割付けから無理のない値）
 */
export const VIEWS: Record<'v0' | 'v1' | 'v2' | 'v3', ViewSpec> = {
  v0: { id: 'squareroom-0', label: 'B 浸水した通りから南の高い門', vp: [760, 390], fov: 45, eyeY: STREET + 1.6, frame: { k: 2, ox: 9, oz: 30 } },
  v1: { id: 'squareroom-1', label: 'D 細い水路から西の水際の扉', vp: [780, 550], fov: 45, eyeY: BED + 1.6, frame: { k: 1, ox: -30, oz: 9.6 } },
  v2: { id: 'squareroom-2', label: 'A 柱の歩廊の大運河から東の開口', vp: [720, 525], fov: 45, eyeY: BED + 1.6, frame: { k: 3, ox: 30, oz: -9.3 } },
  v3: { id: 'squareroom-3', label: 'C 日の差す水路から北の門', vp: [955, 542], fov: 45, eyeY: BED + 1.6, frame: { k: 0, ox: -8.6, oz: -30 } },
};

/** 視点の局所のカメラ（目が原点。y は世界の高さ） */
export function localCam(v: ViewSpec): ViewCam {
  const s = solveFromVanishingPoint(v.vp, v.fov);
  return new ViewCam([0, v.eyeY, 0], s.yaw, s.pitch, v.fov);
}

/** 視点の世界の値（ViewDef に入れる） */
export function worldView(v: ViewSpec): { eye: [number, number, number]; yaw: number; pitch: number; fov: number } {
  const s = solveFromVanishingPoint(v.vp, v.fov);
  return { eye: [v.frame.ox, v.eyeY, v.frame.oz], yaw: s.yaw + (v.frame.k * Math.PI) / 2, pitch: s.pitch, fov: v.fov };
}
