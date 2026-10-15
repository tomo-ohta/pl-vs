/**
 * 地図の座標: 単位 m。x は東へ +、z は南へ +（three.js の -z が北）。部屋の床は 1 m の升目にそろう
 */
export type Side = 'N' | 'E' | 'S' | 'W';
export const SIDES: readonly Side[] = ['N', 'E', 'S', 'W'];

/** 部屋の床の長方形。x は西の端、z は北の端、w は東西の幅、d は南北の奥行き */
export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** 2 部屋の境目の扉（開口） */
export interface Door {
  /** つなぐ 2 部屋の添字 */
  a: number;
  b: number;
  /** true: 境目が x = at の南北の線（扉は南北に幅を持つ）/ false: 境目が z = at の東西の線 */
  vertical: boolean;
  at: number;
  /** 境目に沿った扉の真ん中（vertical なら z、そうでなければ x） */
  c: number;
  width: number;
}

export type Difficulty = 0 | 1 | 2 | 3;

/** 部屋ごとの壁の厚み（m）。隣の部屋と背中合わせで 0.2 m になる */
export const WALL_T = 0.1;
/** 天井の高さ（m） */
export const CEIL_H = 3;

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;

export const contains = (r: Rect, x: number, z: number): boolean => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d;

/** 部屋の番号の表示（001〜） */
export const fmtId = (id: number): string => String(id).padStart(3, '0');
