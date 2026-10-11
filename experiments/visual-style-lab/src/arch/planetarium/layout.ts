import { ViewCam } from '../../core/ViewCam.ts';

/**
 * プラネタリウム（大ドーム劇場）の配置（m）。平土間の床が y = 0、舞台の中心が原点、参考画像の奥（舞台の向こう）が -Z（北）、右が +X（東）。
 * 間取りの考え方は plan.ts（typology・notes）。ここは数値だけ。
 *
 *                     北（奥）
 *            ╭──── ドラムの壁（円・中心 DOME）────╮
 *          ╱  段床（北西）   裏の段床・塔（扉）    ╲
 *   西    │  平土間（机つきの席の弧）  ○ 舞台      │  東（ドラムの壁が近い）
 *          ╲    操作卓 ▭   正面の席の塊          ╱
 *            ╰──────────── ● カメラ（南東の 1 階の回廊）
 *   ドラムのまわり: 回廊（ホワイエ）・出入口・階段・便所・投影室（3 階）・舞台裏
 */

/**
 * 参考画像の視点（planetarium-0）。舞台の楕円・扉の高さ（2.1 m）・近くの席の幅（0.6 m）から画角 60.5°（焦点距離 700 画素）を選び、
 * 舞台と扉に当てはめて目の位置・向きを解いた（docs/stages/planetarium.md）。目は 1 階の回廊（床 3.6 m）の上 1.6 m
 */
export const VIEW = {
  eye: [0, 5.2, 26.99] as [number, number, number],
  yaw: -0.1001,
  pitch: 0.0803,
  fov: (2 * Math.atan(408 / 700) * 180) / Math.PI,
};
export const CAM = new ViewCam(VIEW.eye, VIEW.yaw, VIEW.pitch, VIEW.fov);

/** 舞台（円形・上面 y = 0.3） */
export const STAGE = { r: 8.1, top: 0.3 };

/**
 * 投影ドーム。輪（手すりの上端）の中心・半径・高さ。参考画像の輪の手すりの曲線を y = 16 の円に当てはめた（ずれ 0.6 m）。
 * 輪はカメラのほぼ真上を通る（カメラはドラムの壁ぎわの回廊に立つ）。舞台はドームの中心から 12.4 m 東へ寄る
 */
export const DOME = { cx: -11.46, cz: 4.75, ringY: 16.0, R: 24.6 };
/** ドラムの壁の内側の半径（輪の通路の幅 2.0 m） */
export const DRUM_R = DOME.R + 2.0;
/** 輪の通路の床 */
export const CATWALK_Y = DOME.ringY - 1.1;

/**
 * ドラムの壁の回廊（桟敷）: 1 階（カメラ。全周）・2 階（柱と手すり。北〜東南東だけ。φ の範囲）。depth = 壁からの奥行き。
 * φ はドームの中心のまわりの角度（-Z が 0、+X が正、度）
 */
export const LOGE = { l1: 3.6, l1R: DOME.R, l2: 6.8, l2Depth: 2.4, l2Phi: [-32, 128] as [number, number] };

/** 投影室の塔（ドラムの壁から張り出す。輪の通路はこの両脇で塔に入る）。φ の範囲（度）・張り出し・下端と上端 */
export const BOOTH = { phi: [98, 145] as [number, number], depth: 2.6, y0: 10.6, y1: 24.5 };

/** 平土間（舞台の中心からの半径。舞台のまわりの通路の外から席） */
export const FLOOR = { r0: 9.1 };

/** 段床（舞台の中心のまわりの輪の段）。tread = 踏み面、rise = 蹴上げ、top = 上の回廊の高さ、cross = 途中の横の通路（高さ・幅） */
export interface TierDef {
  a0: number;
  a1: number;
  tread: number;
  rise: number;
  top: number;
  cross?: { y: number; w: number };
}

/**
 * 段床: 舞台の裏（急な段。1 階の高さで横の通路、2 階の柱の回廊まで上がる）と、北西の壁ぎわ（1 階の回廊まで）。
 * 角度は舞台の中心から見て -Z が 0、+X が正（ラジアン）
 */
export const TIERS = {
  back: { a0: -1.05, a1: 1.15, r0: 9.1, tread: 0.62, rise: 0.4, top: LOGE.l2, cross: { y: LOGE.l1, w: 1.2 } } as TierDef & { r0: number },
  west: { a0: -2.25, a1: -1.05, depth: 9.0, tread: 0.85, rise: 0.4, top: LOGE.l1 } as TierDef & { depth: number },
};

/**
 * カメラの立つ所: 1 階の回廊のうち、カメラのまわり（φ ± zone 度）は壁ぎわの細い通路（手すりの半径 narrowR）で、
 * そこから丸い演台（操作席のバルコニー）が張り出す。演台の中心は目の ahead m 前（ドームの中心の向き）、半径 r。
 * 回廊の手すりが参考画像の右下に写らないように（参考画像の右の灯りの列は、離れた所の回廊の手すり）
 */
export const PULPIT = { zone: 22, narrowR: DRUM_R - 1.5, ahead: -0.1, r: 1.1 };

/** 舞台の照明（ドームの中心の下に吊った照明の輪からのスポットライト。煙に光の筋が見える） */
export const BEAM = {
  apex: [-13.18, 30.3, 10.9] as [number, number, number],
  /** 舞台の奥の段床の下の方（光の筋の両側の輪郭の二等分の面の上） */
  target: [-2.0, 1.2, -10.96] as [number, number, number],
  /** 半分の開き角（度）。参考画像の光の筋の両側の輪郭（2 本の線）に接する */
  half: 19.9,
};

/**
 * ドラムのまわりの建物（写っていない所）: 1 階の回廊（ホワイエ。平土間と同じ高さ）・2 階の回廊（1 階の桟敷と同じ高さ）・
 * 南の玄関ホール（吹き抜け・券売・展示・階段）・舞台裏の前室。半径はドームの中心から
 */
export const RING = {
  /** ドラムの壁の外の面 */
  wallOut: DRUM_R + 0.6,
  /** 1 階の回廊の外の壁・天井 */
  r1: DRUM_R + 0.6 + 5.0,
  ceil1: 3.2,
  /** 2 階の回廊の外の壁・床・天井 */
  r2: DRUM_R + 0.6 + 4.2,
  floor2: LOGE.l1,
  ceil2: LOGE.l1 + 3.0,
};

/** ドラムの壁の出入口（φ 度）: 平土間へ（1 階の回廊から）・1 階の桟敷へ（2 階の回廊から） */
export const DOORS = {
  ground: [196, 252, 318, 28, 88],
  upper: [178, 232, 296, 8, 62],
  /** 出入口の幅・高さ */
  w: 2.0,
  h: 2.5,
};

/** 南の玄関ホール（吹き抜け）: x・z の範囲（ドラムの南の外）と天井 */
export const LOBBY = { x0: -26, x1: 3, z0: 33.5, z1: 47, ceil: 7.2 };

/** 舞台の裏の塔（舞台裏の前室）の外形（x・z）と屋上の高さ。中は光る壁の前室 */
export const HOUSE = { x0: -3.0, x1: 2.0, front: -8.6, back: -14.5, top: 4.0, portal: [-1.95, 0.35] as [number, number], portalDepth: 0.9, portalTop: 3.0 };
export function inHouse(x: number, z: number, pad = 0): boolean {
  return x > HOUSE.x0 - pad && x < HOUSE.x1 + pad && z > HOUSE.back - pad && z < HOUSE.front + pad;
}
