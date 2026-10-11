/**
 * 配置の数値（ワールドの座標。x 右・z 手前・y 上。北 = -z）。
 * 地下 2 階のプール階に 4 つの広間（A〜D）が東西に並び、南の「プールサイドの通路」でつながる。
 * 広間ごとの局所の座標（参考画像の視点の目を原点の近くに置いて測った座標）を、o（原点）だけずらしてワールドに置く。
 */
export type Rect = [number, number, number, number];
export type HallId = 'A' | 'B' | 'C' | 'D';

export interface HallLayout {
  /** 局所 → ワールドのずれ（x, z） */
  o: [number, number];
  /** 局所の座標の広間の内側（x0, z0, x1, z1） */
  rect: Rect;
  /** 天井（空の絵）の高さ */
  ceil: number;
}

export const HALL: Record<HallId, HallLayout> = {
  // A: スライダーの大広間（waterpark-0）。東西の回廊（2 階）とダクト、2 本の螺旋のスライダー
  A: { o: [0, 0], rect: [-17, -32, 16, 10], ceil: 10 },
  // B: 流れの水路の長い広間（waterpark-1）。西に低い天井のアーケード
  B: { o: [-40, 2], rect: [-3.5, -60, 22.5, 8], ceil: 11 },
  // C: 円いプールの広間（waterpark-2）
  C: { o: [25.5, 1], rect: [-8.5, -31, 14, 9], ceil: 10.4 },
  // D: 夕焼けの広間（waterpark-3）
  D: { o: [52.5, 2], rect: [-12, -40, 11, 8], ceil: 9 },
};

/** 南の通路（プールサイドの通路）: 広間の南の壁の外。天井 4.0 m */
export const PROM: Rect = [-43.5, 10.5, 63.5, 17];
export const PROM_CEIL = 4.0;
/** 2 階の観覧通路（通路の上、床 4.4 m）: A の東の回廊の南の端から D まで */
export const UPPER: Rect = [10.6, 10.5, 63.5, 15];
export const UPPER_Y = 4.4;
/** 更衣室とシャワー室（通路の南、A の入口の正面） */
export const SHOWER: Rect = [-7, 17.5, 7, 22];
export const LOCKER: Rect = [-9, 22.5, 9, 33];
/** 広間の南の壁の開口（ワールドの x の範囲）。視点の目の真後ろ（参考画像には写らない） */
export const SOUTH_OPEN: Record<HallId, [number, number]> = { A: [-4, 4], B: [-38.5, -32.5], C: [22.5, 28.5], D: [49.5, 55.5] };
/** 広間の南の壁の 2 階の開口（観覧通路へ。A は東の回廊、C・D は階段の上の観覧席） */
export const SOUTH_OPEN_UP: Partial<Record<HallId, [number, number]>> = { A: [11.2, 15.5], C: [17.5, 22.0], D: [58.5, 63] };

/** 局所の座標 → ワールド */
export function W(id: HallId, x: number, z: number): [number, number] {
  const o = HALL[id].o;
  return [o[0] + x, o[1] + z];
}

/** 広間の内側（ワールド） */
export function hallRectW(id: HallId): Rect {
  const h = HALL[id];
  return [h.o[0] + h.rect[0], h.o[1] + h.rect[1], h.o[0] + h.rect[2], h.o[1] + h.rect[3]];
}
