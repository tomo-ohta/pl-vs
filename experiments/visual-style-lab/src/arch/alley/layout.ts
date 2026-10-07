/**
 * 校舎の間の通路（建築版）の寸法。間取り図（plan.ts）と形（build の各ファイル）は、ここの数だけを使う。
 * 座標: x 東・y 上・z 南（-z が北）。参考画像 alley-0 の目の位置の真下が原点、通路の路面が y = 0（m）。
 *
 * 敷地の読み: 都市部の高等学校。南北に長い 2 つの校舎（西棟・東棟）の廊下側どうしが向き合い、その間が管理用の通路。
 * 通路の北の端は裏庭（倉庫・通用門・道路）、南の端は中庭（渡り廊下・本館）。
 */

export type V2 = [number, number];
export type V3 = [number, number, number];

/** 参考画像の視点（元の版と同じ） */
export const VIEW = { eye: [0, 1.6, 0] as V3, yaw: -0.0167, pitch: 0.0984, fov: 48.8 };

/** 校舎の外壁の座標系（u: 壁に沿って、y: 上、w: 外へ。外壁の面が w = 0） */
export interface WingFrame {
  /** u = 0・w = 0 の点（x, z） */
  origin: V2;
  /** 壁に沿った向き（単位） */
  tangent: V2;
  /** 外向きの法線（単位。通路の側） */
  normal: V2;
}

export function wpos(f: WingFrame, u: number, w: number): V2 {
  return [f.origin[0] + f.tangent[0] * u + f.normal[0] * w, f.origin[1] + f.tangent[1] * u + f.normal[1] * w];
}

// ---------------------------------------------------------------- 西棟（参考画像の左）
// 通路側の外壁の線 x = L0 + LK・d（d = -z）。北へ行くほど通路に寄る（敷地の西の境界が斜めなのに合わせて建てた）
export const L0 = -7.73;
export const LK = 0.198;
export const LN = Math.hypot(1, LK);
export const westX = (z: number): number => L0 + LK * -z;

export const WEST: WingFrame & {
  u0: number;
  u1: number;
  depth: number;
  fl: number[];
  roof: number;
  parapet: number;
  slope: { u0: number; h0: number; k: number };
} = {
  origin: [L0, 0],
  tangent: [LK / LN, -1 / LN],
  normal: [1 / LN, LK / LN],
  /** 南の端（z = +18）・北の角（z = -33.6） */
  u0: -18 * LN,
  u1: 33.6 * LN,
  depth: 11.5,
  /** 各階の床（1 階は高い: 特別教室・昇降口。2 階より上は 4.2 m の鉄骨の大きな窓の階） */
  fl: [0, 4.5, 8.7, 12.9, 17.1],
  roof: 20.9,
  parapet: 21.8,
  /** 北の端の道路斜線（u0 から北へ、1 m で k 下がる屋根の線） */
  slope: { u0: 19.2, h0: 21.8, k: 0.785 },
};

// ---------------------------------------------------------------- 東棟（参考画像の右）
export const EAST: WingFrame & {
  u0: number;
  u1: number;
  depth: number;
  fl: number[];
  roof: number;
  parapet: number;
  slope: { u0: number; h0: number; k: number };
} = {
  origin: [2.5, 0],
  tangent: [0, -1],
  normal: [-1, 0],
  u0: -18,
  u1: 35,
  depth: 11.5,
  /** 1 階は半地下（敷地が東へ下がる。通路から 0.9 m 低い）。2 階より上は 3.4 m */
  fl: [-0.9, 2.5, 5.9, 9.3, 12.7],
  roof: 16.1,
  parapet: 17.0,
  slope: { u0: 15.5, h0: 17.0, k: 0.41 },
};

/** 屋根の線（parapet の上端）。北の端は道路斜線で下がる */
export function roofAt(wing: typeof WEST, u: number): number {
  const s = wing.slope;
  return u <= s.u0 ? wing.parapet : Math.max(4, s.h0 - (u - s.u0) * s.k);
}

// ---------------------------------------------------------------- 通路
export const LANE = {
  /** 通路の南の端（中庭の入口）・北の端（倉庫の前） */
  z0: 18,
  z1: -35.5,
  /** 東の歩道（敷石）: x 0.85〜2.5 */
  walkX: [0.85, 2.5] as V2,
  /** 歩道の白線 */
  walkLine: [1.29, 1.34] as V2,
  /** 車路の西の白線 */
  edgeLine: [-0.4, -0.33] as V2,
  /** 車路（アスファルト）の西の端（その西は植え込み・駐輪場） */
  asphaltW: -2.6,
};

/** 東棟の壁ぞいの花壇（低い台）と分電盤 */
export const PLANTER = { x: [2.05, 2.5] as V2, z: [-16, -3.5] as V2, h: 0.85 };
export const CABINETS: [number, number, number, number][] = [
  // x0, z0, z1, 高さ
  [1.92, -4.85, -5.45, 0.55],
  [1.95, -5.6, -6.6, 0.58],
  [1.95, -11.3, -12.1, 0.7],
];

// ---------------------------------------------------------------- 北の端（裏庭・倉庫・通用門）
/** 倉庫（用務員作業室・倉庫）。南の面が通路の突き当たり */
export const ANNEX = { x: [-2.0, 3.3] as V2, z: [-40, -35.5] as V2, h: 3.6, door: [0.85, 2.15] as V2 };
/** 北東の部室棟（2 階建て）。西の面が参考画像の右奥の明るい壁 */
export const CLUB = { x: [3.3, 14] as V2, z: [-47, -35] as V2, h: 9 };
/** 裏庭の大きな木（ケヤキ） */
export const TREE = { x: 0.6, z: -42.2, h: 11.5 };
/** 敷地の北の境界（フェンス）・通用門 */
export const NORTH = { fenceZ: -48, x0: -16.5, x1: 3.3, gate: [-9.5, -4.5] as V2 };
/** 道路（敷地の外）と向かいの建物 */
export const STREET = { z: [-56, -48.4] as V2, walk: 2.0 };
export const FAR = { z: [-70, -57] as V2, x: [-2.2, 21.8] as V2, h: 46, left: { x: [-30, -2.2] as V2, h: 40 } };

// ---------------------------------------------------------------- 南の端（中庭・本館）
export const COURT = { x: [-24, 14] as V2, z: [18, 40] as V2 };
/** 本館（4 階建て。北の面が廊下側） */
export const MAIN = { x: [-24, 30] as V2, z: [40, 51.5] as V2, fl: [0, 3.9, 7.7, 11.5], roof: 15.3, parapet: 16.2 };
/** 渡り廊下（屋根だけの通路）: 通路の南の端から本館の入口まで */
export const WALKWAY = { x: [-0.9, 2.1] as V2, z: [11, 40] as V2, h: 2.75 };
/** 駐輪場（西棟と車路の間の三角の土地） */
export const BIKES = { x: [-7.3, -3.1] as V2, z: [1.5, 14.5] as V2 };

// ---------------------------------------------------------------- 西棟 1 階（入れる所）
/** 西棟の柱の間隔（通路側。u = 9.6 + 4.1 k） */
export const WBAY = { u0: 9.6, w: 4.1 };
/** 裏口（通路から廊下へ）。u の範囲 */
export const BACKDOOR = { u: [13.95, 14.85] as V2 };
/** 1 階の廊下（u の範囲・幅）。w は外壁の内側から */
export const W_CORR = { u: [5.4, 26.0] as V2, wIn: -0.3, wOut: -3.0, ceil: 3.3 };
/** 入れる教室（u の範囲・奥行き） */
export const W_ROOM = { u: [9.6, 17.8] as V2, w: [-3.2, -11.2] as V2, ceil: 3.3 };
