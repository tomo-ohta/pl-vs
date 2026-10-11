import { solveFromVanishingPoint, ViewCam } from '../../core/ViewCam.ts';

/**
 * 海の見える教室（建築版）の寸法。間取り図（plan.ts）と形（build）の両方がこの数を使う。
 *
 * 建物: 岬の先の崖の上に建つ、離島の小さな小中学校（分校）の 3 階建ての校舎（RC の壁式構造・片廊下型）。
 * 座標: x = 南（海・窓）→ 北（廊下・陸）。南の窓の壁の内側の面が x = 0。z = 西（岬の先・海）→ 東。西の端の壁の内側の面が z = 0。
 * 参考画像の 2 枚とも、西の端の教室で南の窓の壁に沿って西（-Z）を見ている（窓が左）。
 *   classroom-0 = 2 階の西の端の「小さな教室」（幅 4.1 m。北に教材室）
 *   classroom-1 = 3 階の西の端の普通教室（幅 7.2 m）
 * 2 枚は窓・天井・机の並びが違う（生成画像どうしの矛盾）ので、同じ部屋にせず上下の階の別の部屋にした。
 */

export type Rect = [number, number, number, number]; // x0, z0, x1, z1

/** 階の床の高さ（1 階・2 階・3 階・屋上） */
export const FL = [0, 3.6, 7.2, 10.8];
/** 天井の高さ（床から） */
export const CH = 3.0;
/** 外壁の厚さ */
export const T_EXT = 0.25;
/** 間仕切りの厚さ */
export const T_IN = 0.12;
/** 教室の奥行き（南の窓の壁から廊下の壁まで） */
export const ROOM_D = 7.2;
/** 廊下（北）: x の範囲 */
export const CORR: [number, number] = [ROOM_D + T_IN, ROOM_D + T_IN + 2.7];
/** 北の外壁の内側の面 */
export const XN = CORR[1];
/** 南の窓の柱の間隔（壁柱の中心から中心。2 枚の参考画像とも 2.3 m 前後） */
export const MODULE = 2.3;
/** 東の端の壁の内側の面（その向こうは別の棟。防火戸は鍵） */
export const Z_EAST = 30.88;
/** 海面の高さ（崖の上の 1 階の床から） */
export const SEA_Y = -10.5;
/** 北の階段室・便所（廊下の北へ出た塔）: x の範囲と z の範囲 */
export const STAIR: Rect = [XN + T_EXT, 15.6, XN + T_EXT + 5.2, 20.4];
export const WC: Rect = [XN + T_EXT, 20.52, XN + T_EXT + 5.2, 24.9];
/**
 * 西の端の外の避難階段（北西の角の鉄の階段）と、2・3 階の西のバルコニー（建物の西の面に沿う）。
 * 階段を北西に置いたのは、参考画像の視点から南の窓越しに見えないように（南の窓の外は海と岩だけ）
 */
export const ESC: Rect = [XN + T_EXT, -5.6, XN + T_EXT + 3.35, -0.25];
export const BALC: Rect = [-0.25, -1.4, XN + T_EXT + 3.35, -0.25];
// ---------------------------------------------------------------- 参考画像の視点

export interface ViewSolve {
  /** 部屋の長い軸（-Z）の消失点（画素） */
  vp: [number, number];
  fov: number;
  /** 目の高さ（床から） */
  eye: number;
}

/**
 * classroom-0（2 階の小さな教室）: 窓の壁の窓の上端（325,50）（550,105）（710,145）と、2 つ目の窓の下端（332,497）（450,470）の
 * 2 本の線の交点が消失点 (1265, 282)。海の水平線 y ≈ 275 とほぼ合う。目の高さは奥の壁（床 y 440・天井 y 100・水平線 282）から 1.39 m。
 * 奥の壁は正面向きに描かれていて（生成画像の矛盾）、窓の壁の線の消失点とは合わない。窓の壁を優先した。
 */
export const S0: ViewSolve = { vp: [1265, 282], fov: 42, eye: 1.39 };
/** classroom-1（3 階の教室）: 窓の下端の線（350,625）（670,480）と窓の上の帯（550,5）（750,115）の交点 (1104, 312)。水平線 y ≈ 322 */
export const S1: ViewSolve = { vp: [1104, 314], fov: 44, eye: 1.45 };
/** classroom-1 の窓の下端（ガラスの下の縁）の高さ。窓ぎわの机の天板（0.70 m）が窓の壁に付く位置になる高さ */
export const SILL1 = 0.76;

/** 部屋の座標（目の真下が原点・奥が -Z）のカメラ */
function localCam(s: ViewSolve): ViewCam {
  const { yaw, pitch } = solveFromVanishingPoint(s.vp, s.fov);
  return new ViewCam([0, s.eye, 0], yaw, pitch, s.fov);
}

export const LC0 = localCam(S0);
export const LC1 = localCam(S1);

/** classroom-0: 奥の壁（床の線 y 440）までの距離・窓の壁（奥の角 x 880）までの距離 */
const D0 = -LC0.hit(1000, 440, 'y', 0)[2];
const A0 = -LC0.hit(880, 300, 'z', -D0)[0];
/** classroom-0 の右の壁（教材室との間仕切り。右上の掲示板の上端 (1456, 0) を天井 3.0 m に当てた位置） */
const R0 = LC0.hit(1456, 0, 'y', CH)[0];

/** classroom-1: 窓の下端（350,625）を腰の高さ SILL1 に当てた窓の壁までの距離・奥の角（x 960）から奥の壁まで */
function solveA1(): number {
  let a = 1;
  for (let i = 0; i < 80; i++) {
    const p = LC1.hit(350, 625, 'x', -a);
    a *= p[1] < SILL1 ? 0.98 : 1.02;
  }
  return a;
}
const A1 = solveA1();
const D1 = -LC1.hit(960, 300, 'x', -A1)[2];

/** 小さな教室（2 階・classroom-0）の幅（窓の壁から教材室の間仕切りまで） */
export const SMALL_W = Math.round((A0 + R0) * 100) / 100;

/** 視点の目の位置（場面の座標） */
export const EYE0: [number, number, number] = [A0, FL[1] + S0.eye, D0];
export const EYE1: [number, number, number] = [A1, FL[2] + S1.eye, D1];

/** 場面の座標のカメラ（画素 → 場面の点） */
export const CAM0 = new ViewCam(EYE0, LC0.yaw, LC0.pitch, S0.fov);
export const CAM1 = new ViewCam(EYE1, LC1.yaw, LC1.pitch, S1.fov);

export const SOLVED = { A0, D0, R0, A1, D1 };

// ---------------------------------------------------------------- 南の窓（階ごと）

export interface FacadeSpec {
  /** ガラスの下端・上端（床から） */
  sill: number;
  head: number;
  /** 欄間の窓（下端・上端） */
  transom: [number, number];
  /** 壁柱の中心のどれか 1 つ（z）と幅 */
  pier0: number;
  pierW: number;
  /** 柱の間のガラスの枚数と、間の竪框（たてがまち）の幅 */
  sashes: number;
  mullW: number;
  /** 壁柱が部屋の内へ出る量 */
  pierProj: number;
  /** 窓台（内側の棚）の奥行き（壁の内の面から部屋へ） */
  ledge: number;
  /** 竪框の位置（区画の西の端からの割合。sashes - 1 個。既定は等分） */
  split?: number[];
  /** 連窓（壁柱の代わりに太い竪框。腰と上の梁だけが壁）。3 階のアルミの窓 */
  ribbon?: boolean;
}

/** 窓の壁（x = 0）の上で、画素の列 x がどの z か */
const zAt = (c: ViewCam, x: number, y: number): number => c.hit(x, y, 'x', 0)[2];

/**
 * 2 階: classroom-0 の 3 つ目の壁柱（x 450〜530）と、窓 2 枚の間の太い竪框（x 290〜330）。窓 2 枚ずつ・壁柱 0.6 m。
 * 腰は低く（0.55 m）、内側に深い窓台（泡の溜まる棚）
 */
const P2a = zAt(CAM0, 530, 300);
const P2b = zAt(CAM0, 450, 300);
/**
 * 3 階: classroom-1 の壁柱（x 520〜580）。窓 3 枚ずつ・細い竪框（アルミのサッシ）・壁柱 0.3 m
 */
const P3a = CAM1.hit(580, 420, 'x', -0.12)[2];
const P3b = CAM1.hit(520, 420, 'x', -0.12)[2];

export const FACADE: { 2: FacadeSpec; 3: FacadeSpec } = {
  2: { sill: 0.45, head: 2.4, transom: [2.5, 2.88], pier0: (P2a + P2b) / 2 + 0.03, pierW: 0.5, sashes: 2, mullW: 0.15, pierProj: 0, ledge: 0.3, split: [0.43] },
  3: { sill: SILL1, head: 2.35, transom: [2.45, 2.82], pier0: (P3a + P3b) / 2, pierW: 0.12, sashes: 2, mullW: 0.07, pierProj: 0.0, ledge: 0.08, split: [0.42], ribbon: true },
};

/** 階の壁柱の中心（z0〜z1 の範囲） */
export function piersIn(f: FacadeSpec, z0: number, z1: number): number[] {
  const out: number[] = [];
  const k0 = Math.ceil((z0 - f.pier0) / MODULE - 1e-6);
  for (let k = k0; f.pier0 + k * MODULE <= z1 + 1e-6; k++) out.push(f.pier0 + k * MODULE);
  return out;
}

// ---------------------------------------------------------------- 部屋（階ごと）

export type RoomKind = 'small' | 'classroom' | 'material' | 'corridor' | 'stair' | 'wc' | 'balcony' | 'escape';

export interface DoorDef {
  /** 'cw' = 教室と廊下の間の壁（x = ROOM_D）、'w' = 西の外壁、'mat' = 小さな教室と教材室の間仕切り（x = SMALL_W）、'n' = 廊下の北の壁 */
  wall: 'cw' | 'w' | 'mat' | 'n' | 'e';
  /** 壁に沿った中心（cw・mat・n は z、w・e は x） */
  at: number;
  width: number;
  height?: number;
  locked?: boolean;
  /** 引き戸（教室）・開き戸（外・便所・防火戸） */
  kind: 'slide' | 'swing' | 'double';
}

export interface RoomDef {
  id: string;
  label: string;
  kind: RoomKind;
  level: 1 | 2 | 3;
  rect: Rect;
  /** L 字の部屋のもう 1 つの長方形 */
  rect2?: Rect;
  /** 入れない（鍵） */
  closed?: boolean;
  /** 参考画像の視点の部屋 */
  view?: 0 | 1;
  note?: string;
}

/** 2 階の小さな教室の、教材室の北の端（L 字の折れ） */
export const MAT_Z1 = 6.78;
const P2 = (k: number): number => FACADE[2].pier0 + k * MODULE;
const P3 = (k: number): number => FACADE[3].pier0 + k * MODULE;
/** 教室の間仕切り（壁柱の中心）。2 階・3 階で壁柱の位置が違う（窓の割り付けが違う）ので階ごと */
export const PART2 = [P2(3), P2(7)];
export const PART3 = [P3(2), P3(6)];

const h = T_IN / 2;
export const ROOMS: RoomDef[] = [
  // ---- 2 階
  { id: 'S2A', label: '2 階 小さな教室（classroom-0）', kind: 'small', level: 2, rect: [0, 0, SMALL_W, MAT_Z1 + T_IN], rect2: [0, MAT_Z1 + T_IN, ROOM_D, PART2[0] - h], view: 0, note: '複式学級の小さな教室。窓の列の机は海の方へ向きがずれている。西の扉は外の避難階段へ' },
  { id: 'M2', label: '2 階 教材室', kind: 'material', level: 2, rect: [SMALL_W + T_IN, 0, ROOM_D, MAT_Z1], note: '地図・模型・地球儀・段ボールの棚。小さな教室とは引き戸でつながる' },
  { id: 'C2B', label: '2 階 教室 2-B', kind: 'classroom', level: 2, rect: [0, PART2[0] + h, ROOM_D, PART2[1] - h] },
  { id: 'C2C', label: '2 階 教室 2-C（鍵）', kind: 'classroom', level: 2, rect: [0, PART2[1] + h, ROOM_D, Z_EAST], closed: true },
  { id: 'H2', label: '2 階 廊下', kind: 'corridor', level: 2, rect: [CORR[0], 0, CORR[1], Z_EAST] },
  // ---- 3 階
  { id: 'C3A', label: '3 階 教室 3-A（classroom-1）', kind: 'classroom', level: 3, rect: [0, 0, ROOM_D, PART3[0] - h], view: 1, note: '西の端の普通教室。前（西）の壁に窓と黒板' },
  { id: 'C3B', label: '3 階 教室 3-B', kind: 'classroom', level: 3, rect: [0, PART3[0] + h, ROOM_D, PART3[1] - h] },
  { id: 'C3C', label: '3 階 教室 3-C（鍵）', kind: 'classroom', level: 3, rect: [0, PART3[1] + h, ROOM_D, Z_EAST], closed: true },
  { id: 'H3', label: '3 階 廊下', kind: 'corridor', level: 3, rect: [CORR[0], 0, CORR[1], Z_EAST] },
];

/** 扉（階ごと）。教室は廊下側の前と後ろに引き戸 */
export const DOORS: Record<2 | 3, DoorDef[]> = {
  2: [
    { wall: 'w', at: 1.7, width: 0.85, height: 2.0, kind: 'swing' }, // 小さな教室の西の扉（右の 1 枚。左の 1 枚は書庫でふさがる）
    { wall: 'mat', at: 3.6, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: 2.0, width: 0.9, kind: 'slide' }, // 教材室
    { wall: 'cw', at: MAT_Z1 + 1.1, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: PART2[0] - 1.0, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: PART2[0] + 1.0, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: PART2[1] - 1.0, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: PART2[1] + 1.0, width: 0.9, kind: 'slide', locked: true },
    { wall: 'cw', at: Z_EAST - 1.0, width: 0.9, kind: 'slide', locked: true },
    { wall: 'w', at: (CORR[0] + CORR[1]) / 2, width: 0.9, height: 2.0, kind: 'swing' }, // 廊下の西の端の扉（バルコニーへ）
    { wall: 'e', at: (CORR[0] + CORR[1]) / 2, width: 1.8, height: 2.1, kind: 'double', locked: true }, // 東の防火戸
  ],
  3: [
    { wall: 'cw', at: 1.4, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: PART3[0] - 1.0, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: PART3[0] + 1.0, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: PART3[1] - 1.0, width: 0.9, kind: 'slide' },
    { wall: 'cw', at: PART3[1] + 1.0, width: 0.9, kind: 'slide', locked: true },
    { wall: 'cw', at: Z_EAST - 1.0, width: 0.9, kind: 'slide', locked: true },
    { wall: 'w', at: (CORR[0] + CORR[1]) / 2, width: 0.9, height: 2.0, kind: 'swing' },
    { wall: 'e', at: (CORR[0] + CORR[1]) / 2, width: 1.8, height: 2.1, kind: 'double', locked: true },
  ],
};
