import type { V3 } from '../../scenes/Builder.ts';

/**
 * 病棟の階の配置の数値（間取り図と形の両方が使う）。座標は場面の座標（m、x 右・z 手前・y 上。図では上が奥 -Z = 北）。
 *
 * 環状の廊下（複廊下型の看護単位）: 中央のコア（ナースステーション・エレベーター・スタッフの部屋）を
 * 4 本の廊下（脚 A〜D）が反時計回りに囲み、外側に病室が並ぶ。各脚の突き当たりの赤い扉は防火・防煙区画の扉で、
 * 扉の先の角を左へ曲がると次の脚が始まる。参考画像 corridor-0〜3 はそれぞれの脚の始まりから突き当たりの扉を見た視点。
 *
 *   脚 A（東・北へ）  = corridor-0  … 区域の向き yaw 0
 *   脚 B（北・西へ）  = corridor-1  … yaw +π/2
 *   脚 C（西・南へ）  = corridor-2  … yaw π
 *   脚 D（南・東へ）  = corridor-3  … yaw -π/2
 *
 * 各脚の区域の座標は元の版と同じ（目の真下が原点、奥が -Z、左 = コアの側）。脚の手前の端（BACK）から先は角（CORNER）で、
 * 角の左側は前の脚の突き当たりの壁（扉の裏）。角の右と奥は外側の部屋・階段へ。
 */

export type LegId = 'A' | 'B' | 'C' | 'D';

export interface LegDef {
  id: LegId;
  view: string;
  /** 区域の原点（目の真下）の場面の座標 */
  origin: V3;
  yaw: number;
  /** 突き当たりの扉の壁の表（区域の z） */
  end: number;
  /** 突き当たりの壁の裏（区域の z）= 次の角の始まり */
  endBack: number;
  /** 区域の z: 脚の手前の端（角の始まり） */
  back: number;
  /** 区域の z: 角の奥の壁 */
  cornerEnd: number;
  /** 廊下の左右の壁の面（区域の x） */
  left: number;
  right: number;
  /** 天井の高さ */
  ceil: number;
}

// 脚の原点（間取り図で閉じるように決めた。導き方は plan.ts の notes）
export const LEGS: Record<LegId, LegDef> = {
  A: { id: 'A', view: 'corridor-0', origin: [0, 0, 0], yaw: 0, end: -17.19, endBack: -17.49, back: 3.26, cornerEnd: 5.55, left: -1.72, right: 1.5, ceil: 2.95 },
  B: { id: 'B', view: 'corridor-1', origin: [-7.72, 0, -19.09], yaw: Math.PI / 2, end: -10.13, endBack: -10.43, back: 6.0, cornerEnd: 9.22, left: -1.6, right: 1.45, ceil: 2.84 },
  C: { id: 'C', view: 'corridor-2', origin: [-19.5, 0, -13.49], yaw: Math.PI, end: -16.45, endBack: -16.75, back: 4.0, cornerEnd: 7.05, left: -1.35, right: 1.6, ceil: 2.9 },
  D: { id: 'D', view: 'corridor-3', origin: [-14.26, 0, 4.38], yaw: -Math.PI / 2, end: -12.24, endBack: -12.54, back: 3.89, cornerEnd: 6.84, left: -1.12, right: 1.17, ceil: 2.75 },
};

/** 区域の点 → 場面の点 */
export function toWorld(leg: LegDef, p: V3): V3 {
  const c = Math.round(Math.cos(leg.yaw));
  const s = Math.round(Math.sin(leg.yaw));
  return [p[0] * c + p[2] * s + leg.origin[0], p[1] + leg.origin[1], -p[0] * s + p[2] * c + leg.origin[2]];
}

/** 区域の長方形（x0, z0, x1, z1）→ 場面の長方形（小さい方から） */
export function rectWorld(leg: LegDef, r: [number, number, number, number]): [number, number, number, number] {
  const a = toWorld(leg, [r[0], 0, r[1]]);
  const b = toWorld(leg, [r[2], 0, r[3]]);
  return [Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2])];
}

/** 区域の yaw（区域の -Z を向く）→ 場面の yaw */
export function yawWorld(leg: LegDef, yawLocal: number): number {
  return leg.yaw + yawLocal;
}

// 建物の外形（外壁の内側の面）と、外側の部屋の奥行き
export const OUT = { x0: -27.4, x1: 7.8, z0: -26.84, z1: 11.85 };

// ---------------------------------------------------------------- 部屋

export type Side = 'n' | 's' | 'w' | 'e';

export type RoomKind =
  | 'ward' // 病室（beds 床）
  | 'obs' // 重症観察室
  | 'day' // デイルーム
  | 'ns' // ナースステーション
  | 'ev' // エレベーターホール
  | 'conf' // カンファレンス室
  | 'treat' // 処置室
  | 'equip' // 器材庫
  | 'staff' // スタッフ室
  | 'locker' // 更衣室
  | 'med' // 薬剤準備室
  | 'clean' // 清潔材料庫
  | 'linen' // リネン庫
  | 'dirty' // 汚物処理室
  | 'toilet' // トイレ
  | 'dress' // 脱衣室
  | 'bath' // 浴室
  | 'stair' // 階段室（階段と一時待避の場所）
  | 'shaft'; // エレベーターの昇降路・配管（入れない）

/**
 * 部屋の壁の開口（扉・通り抜け）。a〜b は辺に沿った座標（n / s 辺なら x、w / e 辺なら z）。
 * depth は部屋の壁の面から向こうの面までの厚さ（開口の内側の面＝枠を作る）。
 * leaf: 'slide' = 部屋の側で引き戸を作る（参考画像に写らない扉）、'swing2' = 両開きの防火戸（階段）、
 * 'leg' = 扉は廊下の側（参考画像の見た目どおり）で作る、'open' = 扉なし（通り抜け）
 */
export interface DoorDef {
  side: Side;
  a: number;
  b: number;
  top: number;
  depth: number;
  leaf: 'slide' | 'swing2' | 'leg' | 'open' | 'locked';
  /** 引き戸の滑る向き（辺の座標の + か -） */
  dir?: 1 | -1;
  /** 開き戸の開く側（部屋の内へ = 'in'） */
  swingIn?: boolean;
  /** 扉の色（省略で部屋の決まり） */
  color?: string;
}

/** 廊下の壁の窓（部屋の側から見た裏の面。参考画像の窓の裏） */
export interface GlazeDef {
  side: Side;
  a: number;
  b: number;
  y0: number;
  y1: number;
  depth: number;
  color: string;
}

export interface RoomDef {
  id: string;
  label: string;
  kind: RoomKind;
  zone: LegId;
  /** 内法の長方形 [x0, z0, x1, z1]（場面の座標） */
  rect: [number, number, number, number];
  /** 天井の高さ */
  h: number;
  doors: DoorDef[];
  /** 外壁の辺（窓を並べる） */
  ext?: Side[];
  glaze?: GlazeDef[];
  beds?: number;
  closed?: boolean;
  /** 置く物の向き（家具の並びの基準の辺。省略で最初の外壁） */
  note?: string;
}

const H_ROOM = 2.6;

// 廊下の壁の開口（区域の座標で決めて、部屋の側は場面の座標に直して使う）
export const A_DOORS = {
  treat: { z: [-8.2, -6.95] as [number, number], top: 2.15 },
  bays: [
    { room: 'E2', z: [-8.19, -7.32] as [number, number] },
    { room: 'E3', z: [-12.89, -12.02] as [number, number] },
    { room: 'E4', z: [-15.24, -14.37] as [number, number] },
  ],
  bayTop: 2.03,
  e1b: [-2.2, -1.2] as [number, number],
  e1: [0.7, 1.9] as [number, number],
  bath: [-0.9, 0.5] as [number, number],
};
export const C_DOORS = { w3: [-9.2, -8.3] as [number, number], w3Top: 2.3, linen: [-16.2, -15.3] as [number, number], linenTop: 2.2 };
export const D_DOORS = {
  l1: [-2.0, -0.9] as [number, number],
  l1Top: 2.0,
  l2: [-6.73, -5.78] as [number, number],
  l3: [-8.46, -7.22] as [number, number],
  r1: [-6.22, -5.14] as [number, number],
  jambTop: 2.25,
};

/** 廊下の扉の区域の z → 場面の座標の範囲（辺の座標） */
function legSpan(leg: LegDef, z: [number, number], x: number): [number, number] {
  const p = toWorld(leg, [x, 0, z[0]]);
  const q = toWorld(leg, [x, 0, z[1]]);
  const useX = Math.abs(p[0] - q[0]) > Math.abs(p[2] - q[2]);
  const a = useX ? p[0] : p[2];
  const b = useX ? q[0] : q[2];
  return [Math.min(a, b), Math.max(a, b)];
}

const LA = LEGS.A;
const LB = LEGS.B;
const LC = LEGS.C;
const LD = LEGS.D;

export const ROOMS: RoomDef[] = [
  // ---- 東（脚 A の外側）: 病室 ----
  { id: 'E5', label: '個室 507', kind: 'ward', beds: 1, zone: 'B', rect: [1.8, -20.765, 7.5, -17.565], h: H_ROOM, ext: ['e'], doors: [{ side: 'w', a: -19.8, b: -18.7, top: 2.1, depth: 0.3, leaf: 'slide', dir: 1 }] },
  { id: 'E4', label: '個室 506', kind: 'ward', beds: 1, zone: 'A', rect: [1.8, -17.415, 7.5, -14.27], h: H_ROOM, ext: ['e'], doors: [{ side: 'w', a: A_DOORS.bays[2].z[0], b: A_DOORS.bays[2].z[1], top: A_DOORS.bayTop, depth: 0.3, leaf: 'leg' }] },
  { id: 'E3', label: '2 床室 505', kind: 'ward', beds: 2, zone: 'A', rect: [1.8, -14.12, 7.5, -9.57], h: H_ROOM, ext: ['e'], doors: [{ side: 'w', a: A_DOORS.bays[1].z[0], b: A_DOORS.bays[1].z[1], top: A_DOORS.bayTop, depth: 0.3, leaf: 'leg' }] },
  { id: 'E2', label: '4 床室 503', kind: 'ward', beds: 4, zone: 'A', rect: [1.8, -9.42, 7.5, -3.25], h: H_ROOM, ext: ['e'], doors: [{ side: 'w', a: A_DOORS.bays[0].z[0], b: A_DOORS.bays[0].z[1], top: A_DOORS.bayTop, depth: 0.3, leaf: 'leg' }] },
  { id: 'E1b', label: '多目的トイレ', kind: 'toilet', zone: 'A', rect: [2.6, -2.65, 7.5, -0.375], h: H_ROOM, ext: ['e'], doors: [{ side: 'w', a: A_DOORS.e1b[0], b: A_DOORS.e1b[1], top: 2.1, depth: 0.3, leaf: 'slide', dir: -1 }] },
  { id: 'E1', label: '4 床室 501', kind: 'ward', beds: 4, zone: 'A', rect: [2.6, -0.225, 7.5, 5.775], h: H_ROOM, ext: ['e'], doors: [{ side: 'w', a: A_DOORS.e1[0], b: A_DOORS.e1[1], top: 2.1, depth: 0.3, leaf: 'slide', dir: 1 }] },
  // 浴室（南東の角）
  { id: 'DRS', label: '脱衣室', kind: 'dress', zone: 'A', rect: [-4.425, 5.925, 1.0, 11.55], h: H_ROOM, ext: ['s'], doors: [{ side: 'n', a: A_DOORS.bath[0], b: A_DOORS.bath[1], top: 2.1, depth: 0.375, leaf: 'slide', dir: -1 }, { side: 'e', a: 8.0, b: 9.2, top: 2.1, depth: 0.15, leaf: 'slide', dir: 1 }] },
  { id: 'BTH', label: '浴室（機械浴）', kind: 'bath', zone: 'A', rect: [1.15, 5.925, 7.5, 11.55], h: H_ROOM, ext: ['s', 'e'], doors: [{ side: 'w', a: 8.0, b: 9.2, top: 2.1, depth: 0.15, leaf: 'open' }] },

  // ---- 北（脚 B の外側） ----
  { id: 'STN', label: '北階段・一時待避', kind: 'stair', zone: 'B', rect: [-1.645, -26.54, 7.5, -20.915], h: 2.84, ext: ['n'], doors: [{ side: 's', a: -1.2, b: 1.0, top: 2.1, depth: 0.375, leaf: 'swing2' }] },
  { id: 'N1', label: '4 床室 510', kind: 'ward', beds: 4, zone: 'B', rect: [-7.125, -26.54, -1.795, -20.84], h: H_ROOM, ext: ['n'], doors: [{ side: 's', a: -4.4, b: -3.2, top: 2.1, depth: 0.3, leaf: 'slide', dir: 1 }] },
  {
    id: 'N3', label: '重症観察室', kind: 'obs', beds: 4, zone: 'B', rect: [-13.545, -26.54, -7.275, -20.84], h: H_ROOM, ext: ['n'],
    doors: [{ side: 's', a: -8.45, b: -7.45, top: 2.1, depth: 0.3, leaf: 'slide', dir: -1 }],
    // 廊下の窓（corridor-1 の右の窓。区域 z -5.65〜-3.55 → 場面 x）
    glaze: [{ side: 's', a: LB.origin[0] - 5.65, b: LB.origin[0] - 3.55, y0: 1.35, y1: 2.5, depth: 0.3, color: '#a9bdb0' }],
  },
  { id: 'DAY', label: 'デイルーム', kind: 'day', zone: 'C', rect: [-27.1, -26.54, -13.695, -20.84], h: 2.7, ext: ['n', 'w'], doors: [{ side: 's', a: -20.6, b: -18.6, top: 2.4, depth: 0.3, leaf: 'open' }] },

  // ---- 西（脚 C の外側） ----
  { id: 'W1', label: '4 床室 512', kind: 'ward', beds: 4, zone: 'C', rect: [-27.1, -20.765, -21.4, -14.915], h: H_ROOM, ext: ['w'], doors: [{ side: 'e', a: -19.7, b: -18.5, top: 2.1, depth: 0.47, leaf: 'slide', dir: 1 }] },
  { id: 'W2', label: '4 床室 513', kind: 'ward', beds: 4, zone: 'C', rect: [-27.1, -14.765, -21.4, -9.675], h: H_ROOM, ext: ['w'], doors: [{ side: 'e', a: -14.6, b: -13.6, top: 2.1, depth: 0.47, leaf: 'slide', dir: -1 }] },
  {
    id: 'W3', label: '4 床室 515', kind: 'ward', beds: 4, zone: 'C', rect: [-27.1, -9.525, -21.4, -2.415], h: H_ROOM, ext: ['w'],
    doors: [
      { side: 'e', a: legSpan(LC, C_DOORS.w3, 1.6)[0], b: legSpan(LC, C_DOORS.w3, 1.6)[1], top: C_DOORS.w3Top, depth: 0.3, leaf: 'leg' },
      { side: 's', a: -24.2, b: -23.4, top: 2.0, depth: 0.15, leaf: 'slide', dir: -1 },
    ],
  },
  { id: 'W3t', label: '病室のトイレ', kind: 'toilet', zone: 'C', rect: [-27.1, -2.265, -21.4, -0.375], h: H_ROOM, ext: ['w'], doors: [{ side: 'n', a: -24.2, b: -23.4, top: 2.0, depth: 0.15, leaf: 'open' }] },
  { id: 'W4', label: '4 床室 516', kind: 'ward', beds: 4, zone: 'D', rect: [-27.1, -0.225, -21.4, 5.775], h: H_ROOM, ext: ['w'], doors: [{ side: 'e', a: 3.6, b: 4.8, top: 2.1, depth: 0.3, leaf: 'slide', dir: -1 }] },

  // ---- 南（脚 D の外側）: 階段・汚物処理・器材 ----
  { id: 'STS', label: '南階段・一時待避', kind: 'stair', zone: 'D', rect: [-27.1, 5.925, -17.975, 11.55], h: 2.75, ext: ['s'], doors: [{ side: 'n', a: -20.6, b: -18.6, top: 2.1, depth: 0.375, leaf: 'swing2' }] },
  { id: 'S1', label: '汚物処理室', kind: 'dirty', zone: 'D', rect: [-17.825, 5.925, -12.075, 11.55], h: H_ROOM, ext: ['s'], doors: [{ side: 'n', a: -16.4, b: -15.3, top: 2.1, depth: 0.375, leaf: 'slide', dir: 1 }] },
  { id: 'S2', label: '器材庫', kind: 'equip', zone: 'D', rect: [-11.925, 5.925, -4.575, 11.55], h: H_ROOM, ext: ['s'], doors: [{ side: 'n', a: legSpan(LD, D_DOORS.r1, 1.17)[0], b: legSpan(LD, D_DOORS.r1, 1.17)[1], top: D_DOORS.jambTop, depth: 0.375, leaf: 'leg' }] },

  // ---- コア ----
  {
    id: 'NS', label: 'ナースステーション', kind: 'ns', zone: 'B', rect: [-17.85, -17.19, -10.275, -11.275], h: H_ROOM,
    doors: [
      { side: 'w', a: -16.4, b: -15.3, top: 2.1, depth: 0.3, leaf: 'slide', dir: 1 },
      { side: 'e', a: -12.6, b: -11.6, top: 2.1, depth: 0.15, leaf: 'slide', dir: -1 },
      { side: 's', a: -12.4, b: -11.4, top: 2.1, depth: 0.15, leaf: 'slide', dir: 1 },
    ],
    // 廊下の窓（corridor-1 の左の窓。区域 z -6.95〜-4.8）
    glaze: [{ side: 'n', a: LB.origin[0] - 6.95, b: LB.origin[0] - 4.8, y0: 1.32, y1: 2.6, depth: 0.3, color: '#a9bdb0' }],
  },
  { id: 'EV', label: 'エレベーターホール', kind: 'ev', zone: 'B', rect: [-10.125, -16.99, -2.02, -11.275], h: 2.7, doors: [{ side: 'n', a: legSpan(LB, [2.72, 5.42], -2.1)[0], b: legSpan(LB, [2.72, 5.42], -2.1)[1], top: 2.5, depth: 0.3, leaf: 'open' }, { side: 'w', a: -12.6, b: -11.6, top: 2.1, depth: 0.15, leaf: 'open' }] },
  { id: 'EVS', label: 'エレベーター昇降路', kind: 'shaft', zone: 'B', rect: [-9.8, -11.125, -4.5, -8.6], h: H_ROOM, closed: true, doors: [] },
  { id: 'PS', label: 'PS・EPS', kind: 'shaft', zone: 'A', rect: [-4.35, -11.125, -2.02, -8.6], h: H_ROOM, closed: true, doors: [] },
  { id: 'CONF', label: 'カンファレンス室', kind: 'conf', zone: 'B', rect: [-17.85, -11.125, -10.275, -6.6], h: H_ROOM, doors: [{ side: 'n', a: -12.4, b: -11.4, top: 2.1, depth: 0.15, leaf: 'open' }] },
  { id: 'LOCK', label: '更衣室', kind: 'locker', zone: 'D', rect: [-17.85, -6.45, -10.275, -3.375], h: H_ROOM, doors: [{ side: 's', a: -13.4, b: -12.6, top: 2.0, depth: 0.15, leaf: 'open' }] },
  { id: 'TRT', label: '処置室', kind: 'treat', zone: 'A', rect: [-8.0, -8.45, -2.02, -3.375], h: H_ROOM, doors: [{ side: 'e', a: A_DOORS.treat.z[0], b: A_DOORS.treat.z[1], top: A_DOORS.treat.top, depth: 0.3, leaf: 'leg' }, { side: 'w', a: -6.6, b: -5.6, top: 2.0, depth: 0.15, leaf: 'slide', dir: 1 }] },
  { id: 'EQC', label: '物品庫', kind: 'equip', zone: 'A', rect: [-10.125, -8.45, -8.15, -3.375], h: H_ROOM, doors: [{ side: 'e', a: -6.6, b: -5.6, top: 2.0, depth: 0.15, leaf: 'open' }] },
  { id: 'LIN', label: 'リネン庫', kind: 'linen', zone: 'C', rect: [-17.85, -3.225, -14.575, 2.96], h: H_ROOM, doors: [{ side: 'w', a: legSpan(LC, C_DOORS.linen, -1.4)[0], b: legSpan(LC, C_DOORS.linen, -1.4)[1], top: C_DOORS.linenTop, depth: 0.25, leaf: 'leg' }] },
  { id: 'STF', label: 'スタッフ室', kind: 'staff', zone: 'D', rect: [-14.425, -3.225, -10.775, 2.96], h: H_ROOM, doors: [{ side: 's', a: legSpan(LD, D_DOORS.l1, -1.12)[0], b: legSpan(LD, D_DOORS.l1, -1.12)[1], top: D_DOORS.l1Top, depth: 0.3, leaf: 'leg' }, { side: 'n', a: -13.4, b: -12.6, top: 2.0, depth: 0.15, leaf: 'slide', dir: 1 }] },
  { id: 'MED', label: '薬剤準備室', kind: 'med', zone: 'D', rect: [-10.625, -3.225, -7.365, 2.96], h: H_ROOM, doors: [{ side: 's', a: legSpan(LD, D_DOORS.l2, -1.12)[0], b: legSpan(LD, D_DOORS.l2, -1.12)[1], top: D_DOORS.jambTop, depth: 0.3, leaf: 'leg' }] },
  { id: 'CLN', label: '清潔材料庫', kind: 'clean', zone: 'D', rect: [-7.215, -3.225, -2.02, 2.96], h: H_ROOM, doors: [{ side: 's', a: legSpan(LD, D_DOORS.l3, -1.12)[0], b: legSpan(LD, D_DOORS.l3, -1.12)[1], top: D_DOORS.jambTop, depth: 0.3, leaf: 'leg' }] },
];

export function roomById(id: string): RoomDef {
  const r = ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`部屋が無い: ${id}`);
  return r;
}

export { LA, LB, LC, LD };
