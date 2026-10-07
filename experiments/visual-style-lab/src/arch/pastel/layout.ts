/**
 * 淡色の廊下（建築版）の寸法。間取り図（plan.ts）と形（build）の両方がこの数を使う。
 * 座標は元の版と同じ: 参考画像の目の真下が原点、奥（北）が -Z、右（東）が +X、床 y = 0。
 *
 * 建物: 昭和初期の鉄筋コンクリート 2 階建ての町の診療所（1 階が外来）。天井が高い（廊下・待合 4.45 m）。
 * 南の玄関 → 待合（参考画像の目の位置）→ 北へまっすぐの廊下（東に診察室 2・処置室、西に受付・薬局と医局）
 * → 奥のホール（クリーム色・検査室の窓口・便所・階段の口）→ 通用口。
 */

export type Rect = [number, number, number, number]; // x0, z0, x1, z1（x0 < x1, z0 < z1。z0 が北）
export type Side = 'n' | 's' | 'w' | 'e';

export type RoomKind =
  | 'lobby' // 待合・玄関ホール
  | 'vest' // 風除室
  | 'corridor' // 廊下（参考画像の視点の区画）
  | 'back' // 奥のホール（参考画像の奥のクリームの区画）
  | 'office' // 受付・薬局
  | 'doctor' // 医局・院長室
  | 'store' // 倉庫（カルテ・物品）
  | 'consult' // 診察室
  | 'treat' // 処置室
  | 'lab' // 検査室
  | 'toilet' // 便所
  | 'stair' // 階段室
  | 'pantry' // 給湯室
  | 'porch'; // 通用口

/** 雪の吹き込み: 外への開口（壊れた窓・扉）からの近さ。0〜1（1 = 吹きだまりが多い） */
export interface RoomDef {
  id: string;
  label: string;
  kind: RoomKind;
  rect: Rect;
  /** 天井の高さ */
  ceil: number;
  /** 雪の多さ（0〜1） */
  snow: number;
  /** 参考画像の区画（形は view.ts が作る） */
  view?: boolean;
  /** 入れない（見えるだけ・鍵） */
  closed?: boolean;
  note?: string;
}

export const T_EXT = 0.3;
export const CEIL = 4.45;
/** 2 階の床の高さ（階段の上の踊り場） */
export const FLOOR2 = 4.9;

export const ROOMS: RoomDef[] = [
  { id: 'LOBBY', label: '玄関ホール・待合', kind: 'lobby', rect: [-7.2, -4.18, 7.2, 2.6], ceil: CEIL, snow: 1, note: '参考画像の目の位置。北の壁の 2 つの塊の間が廊下の口。西の塊に受付と薬の窓口、南に風除室' },
  { id: 'VEST', label: '風除室', kind: 'vest', rect: [-1.5, 2.9, 1.5, 4.9], ceil: 2.8, snow: 1, note: '内の引き戸は開いたまま。外の扉は鍵（割れたガラスから雪が吹き込む）' },
  { id: 'COR', label: '廊下（pastel-0）', kind: 'corridor', rect: [-1.76, -12.9, 1.82, -4.46], ceil: CEIL, snow: 0.7, view: true, note: '参考画像の廊下。東の壁の柱型の陰に診察室・処置室の扉（参考画像からは見えない）' },
  { id: 'BACK', label: '奥のホール', kind: 'back', rect: [-1.41, -21.0, 1.43, -12.9], ceil: 4.1, snow: 0.7, view: true, note: '参考画像の奥のクリームの区画。突き当たりの白い扉が通用口' },
  { id: 'W1', label: '受付・薬局', kind: 'office', rect: [-7.2, -9.75, -2.2, -4.46], ceil: CEIL, snow: 0.35, note: '待合へ受付と薬の窓口' },
  { id: 'W2A', label: '医局（院長室）', kind: 'doctor', rect: [-7.2, -15.1, -4.6, -9.9], ceil: CEIL, snow: 0.3 },
  { id: 'W2B', label: '倉庫（カルテ・物品）', kind: 'store', rect: [-4.45, -15.1, -2.2, -9.9], ceil: CEIL, snow: 0.15 },
  { id: 'E1', label: '第一診察室', kind: 'consult', rect: [2.3, -7.65, 7.2, -4.73], ceil: CEIL, snow: 0.35 },
  { id: 'E2', label: '第二診察室', kind: 'consult', rect: [2.3, -10.85, 7.2, -7.8], ceil: CEIL, snow: 0.8, note: '東の窓が 1 枚割れている（雪の吹きだまり）' },
  { id: 'E3', label: '処置室', kind: 'treat', rect: [2.3, -15.25, 7.2, -11.0], ceil: CEIL, snow: 0.35 },
  { id: 'E4', label: '検査室', kind: 'lab', rect: [1.73, -17.9, 7.2, -15.4], ceil: 3.2, snow: 0.3, note: '奥のホールへ検体の受付の窓（参考画像の右の低い台）' },
  { id: 'E5', label: '便所', kind: 'toilet', rect: [1.73, -21.0, 7.2, -18.05], ceil: 2.9, snow: 0.4 },
  { id: 'STAIR', label: '階段室', kind: 'stair', rect: [-7.2, -21.0, -1.71, -15.4], ceil: FLOOR2 + 3.3, snow: 0.6, note: '折り返し階段（2 階の扉は鍵）。奥のホールとは柱型の陰の口でつながる' },
  { id: 'PANTRY', label: '給湯室', kind: 'pantry', rect: [-4.6, -21.0, -1.71, -18.05], ceil: 2.7, snow: 0.25 },
  { id: 'PORCH', label: '通用口', kind: 'porch', rect: [-1.5, -23.2, 1.5, -21.3], ceil: 2.6, snow: 1, note: '外の扉は鍵' },
];

export const room = (id: string): RoomDef => {
  const r = ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`room ${id}`);
  return r;
};

/** 建物の外壁の内側の面 */
export const BLDG = { x0: -7.2, x1: 7.2, z0: -21.0, z1: 2.6 };

// ---------------------------------------------------------------- 開口

export type DoorKind = 'slide' | 'swing' | 'double' | 'opening' | 'window' | 'pass';

export interface DoorDef {
  id: string;
  kind: DoorKind;
  /** 開口が付く壁: 'x' = x に沿った壁（z 一定）、'z' = z に沿った壁（x 一定） */
  wall: 'x' | 'z';
  /** 壁の中心線の座標（'x' なら z、'z' なら x） */
  line: number;
  /** 壁の厚さ（両面の間） */
  thick: number;
  /** 開口の範囲（壁に沿った座標）と高さ */
  a: number;
  b: number;
  y0: number;
  y1: number;
  /** 'open' = いつも開いている、'auto' = 近づくと開く、'locked' = 鍵 */
  state: 'open' | 'auto' | 'locked';
  /** つなぐ部屋（図・見えない所を描かない判定） */
  rooms: [string, string];
  /** 開き戸の吊り元（a か b）と開く向き（+1 = 壁の座標の + 側へ） */
  hinge?: 'a' | 'b';
  toward?: 1 | -1;
  /** 引き戸の引く向き（-1 = a の側へ、+1 = b の側へ） */
  slideDir?: 1 | -1;
  label?: string;
  note?: string;
}

export const DOORS: DoorDef[] = [
  // 玄関
  { id: 'vestIn', kind: 'double', wall: 'x', line: 2.75, thick: 0.3, a: -1.2, b: 1.2, y0: 0, y1: 2.4, state: 'open', rooms: ['LOBBY', 'VEST'], label: '風除室の内の引き戸', note: '開いたまま止まっている' },
  { id: 'vestOut', kind: 'double', wall: 'x', line: 4.975, thick: 0.15, a: -1.2, b: 1.2, y0: 0, y1: 2.4, state: 'locked', rooms: ['VEST', 'OUT'], label: '玄関の扉（鍵）', note: '右の戸のガラスが割れていて、雪が吹き込む' },
  // 診察室・処置室（廊下の東の壁。柱型の陰で参考画像からは見えない）
  { id: 'E1', kind: 'slide', wall: 'z', line: 2.06, thick: 0.48, a: -6.4, b: -5.3, y0: 0, y1: 2.15, state: 'auto', rooms: ['COR', 'E1'], slideDir: -1, label: '第一診察室' },
  { id: 'E2', kind: 'slide', wall: 'z', line: 2.06, thick: 0.48, a: -9.5, b: -8.2, y0: 0, y1: 2.15, state: 'auto', rooms: ['COR', 'E2'], slideDir: -1, label: '第二診察室' },
  { id: 'E3', kind: 'slide', wall: 'z', line: 2.06, thick: 0.48, a: -12.5, b: -11.3, y0: 0, y1: 2.15, state: 'auto', rooms: ['COR', 'E3'], slideDir: -1, label: '処置室' },
  // 診察室どうし・処置室・検査室（奥の職員の通り道）
  { id: 'E12', kind: 'swing', wall: 'x', line: -7.725, thick: 0.15, a: 5.9, b: 6.75, y0: 0, y1: 2.05, state: 'auto', rooms: ['E1', 'E2'], hinge: 'b', toward: -1 },
  { id: 'E23', kind: 'swing', wall: 'x', line: -10.925, thick: 0.15, a: 5.9, b: 6.75, y0: 0, y1: 2.05, state: 'auto', rooms: ['E2', 'E3'], hinge: 'b', toward: -1 },
  { id: 'E34', kind: 'swing', wall: 'x', line: -15.325, thick: 0.15, a: 5.6, b: 6.45, y0: 0, y1: 2.05, state: 'auto', rooms: ['E3', 'E4'], hinge: 'b', toward: -1 },
  // 奥のホールの東（参考画像の右の低い台の上が検体の窓。その先に便所の扉。どちらも柱型の陰）
  { id: 'labWin', kind: 'pass', wall: 'z', line: 1.58, thick: 0.3, a: -17.62, b: -16.68, y0: 0.95, y1: 1.95, state: 'open', rooms: ['BACK', 'E4'], label: '検体の受付の窓' },
  { id: 'E5', kind: 'swing', wall: 'z', line: 1.58, thick: 0.3, a: -19.15, b: -18.2, y0: 0, y1: 2.05, state: 'auto', rooms: ['BACK', 'E5'], hinge: 'a', toward: 1, label: '便所' },
  { id: 'pass45', kind: 'pass', wall: 'x', line: -17.975, thick: 0.15, a: 6.2, b: 6.6, y0: 1.0, y1: 1.32, state: 'open', rooms: ['E4', 'E5'], label: '採尿の小窓' },
  // 通用口（参考画像の突き当たりの白い戸。参考画像では閉じている）
  { id: 'back', kind: 'swing', wall: 'x', line: -21.15, thick: 0.3, a: -0.64, b: 0.34, y0: 0, y1: 2.05, state: 'auto', rooms: ['BACK', 'PORCH'], hinge: 'b', toward: -1, label: '通用口' },
  { id: 'porchOut', kind: 'swing', wall: 'x', line: -23.275, thick: 0.15, a: -0.5, b: 0.5, y0: 0, y1: 2.05, state: 'locked', rooms: ['PORCH', 'OUT'], hinge: 'b', toward: -1, label: '通用口の外の扉（鍵）' },
  // 階段室（奥のホールの西。手前の枠の陰の口）
  { id: 'stairOpen', kind: 'opening', wall: 'z', line: -1.56, thick: 0.3, a: -17.2, b: -15.55, y0: 0, y1: 3.0, state: 'open', rooms: ['BACK', 'STAIR'], label: '階段室の口' },
  { id: 'pantry', kind: 'swing', wall: 'x', line: -17.975, thick: 0.15, a: -3.85, b: -3.0, y0: 0, y1: 2.0, state: 'auto', rooms: ['STAIR', 'PANTRY'], hinge: 'a', toward: -1, label: '給湯室' },
  // 倉庫の扉は外開き（中の棚の場所を空けるため。倉庫・物入れの扉の普通の付け方）
  { id: 'W2B', kind: 'swing', wall: 'x', line: -15.25, thick: 0.3, a: -3.7, b: -2.85, y0: 0, y1: 2.05, state: 'auto', rooms: ['STAIR', 'W2B'], hinge: 'b', toward: -1, label: '倉庫' },
  { id: 'W2A', kind: 'swing', wall: 'x', line: -15.25, thick: 0.3, a: -5.85, b: -4.95, y0: 0, y1: 2.05, state: 'auto', rooms: ['STAIR', 'W2A'], hinge: 'a', toward: 1, label: '医局' },
  { id: 'W12', kind: 'swing', wall: 'x', line: -9.825, thick: 0.15, a: -6.6, b: -5.75, y0: 0, y1: 2.05, state: 'auto', rooms: ['W1', 'W2A'], hinge: 'a', toward: 1 },
  { id: 'W1B', kind: 'swing', wall: 'x', line: -9.825, thick: 0.15, a: -3.65, b: -2.8, y0: 0, y1: 2.05, state: 'auto', rooms: ['W1', 'W2B'], hinge: 'b', toward: -1 },
  // 受付と薬の窓口（待合の北の壁の西の塊。参考画像の画角の外 x < -3.3）
  { id: 'recep', kind: 'pass', wall: 'x', line: -4.32, thick: 0.28, a: -5.5, b: -4.2, y0: 0.95, y1: 1.95, state: 'open', rooms: ['LOBBY', 'W1'], label: '受付の窓口' },
  { id: 'drug', kind: 'pass', wall: 'x', line: -4.32, thick: 0.28, a: -6.85, b: -6.0, y0: 0.95, y1: 1.8, state: 'open', rooms: ['LOBBY', 'W1'], label: '薬の窓口' },
  // 2 階の扉・階段の下の物入れ（鍵）
  { id: 'up', kind: 'swing', wall: 'x', line: -15.25, thick: 0.3, a: -7.0, b: -6.05, y0: FLOOR2, y1: FLOOR2 + 2.05, state: 'locked', rooms: ['STAIR', 'F2'], hinge: 'a', toward: 1, label: '2 階（病室）への扉（鍵）' },
  { id: 'closet', kind: 'swing', wall: 'x', line: -16.6, thick: 0.1, a: -5.75, b: -5.05, y0: 0, y1: 1.85, state: 'locked', rooms: ['STAIR', 'CLOSET'], hinge: 'a', toward: -1, label: '階段の下の物入れ（鍵）' },
];

// ---------------------------------------------------------------- 外の窓

export interface WinDef {
  /** 壁: 'x' = z 一定の壁、'z' = x 一定の壁。line は壁の中心線 */
  wall: 'x' | 'z';
  line: number;
  thick: number;
  a: number;
  b: number;
  y0: number;
  y1: number;
  room: string;
  /** 窓の外の向き（+1 = 壁の座標の + 側が外） */
  out: 1 | -1;
  /** ガラスの割れた窓（雪が吹き込む） */
  broken?: boolean;
  /** 縦の桟の数・横の桟の高さ */
  cols?: number;
  rails?: number[];
}

const WX = -7.35; // 西の外壁の中心線
const EX = 7.35;
export const WINDOWS: WinDef[] = [
  // 待合（西・東・南）
  { wall: 'z', line: WX, thick: T_EXT, a: -2.6, b: -0.6, y0: 0.9, y1: 3.2, room: 'LOBBY', out: -1, cols: 2, rails: [2.3] },
  { wall: 'z', line: WX, thick: T_EXT, a: 0.0, b: 2.0, y0: 0.9, y1: 3.2, room: 'LOBBY', out: -1, cols: 2, rails: [2.3] },
  { wall: 'z', line: EX, thick: T_EXT, a: -2.6, b: -0.6, y0: 0.9, y1: 3.2, room: 'LOBBY', out: 1, cols: 2, rails: [2.3] },
  { wall: 'z', line: EX, thick: T_EXT, a: 0.0, b: 2.0, y0: 0.9, y1: 3.2, room: 'LOBBY', out: 1, cols: 2, rails: [2.3], broken: true },
  { wall: 'x', line: 2.75, thick: T_EXT, a: -6.2, b: -3.4, y0: 0.9, y1: 3.2, room: 'LOBBY', out: 1, cols: 3, rails: [2.3] },
  { wall: 'x', line: 2.75, thick: T_EXT, a: 3.4, b: 6.2, y0: 0.9, y1: 3.2, room: 'LOBBY', out: 1, cols: 3, rails: [2.3] },
  // 受付・薬局・医局（西）
  { wall: 'z', line: WX, thick: T_EXT, a: -8.6, b: -6.8, y0: 0.9, y1: 3.0, room: 'W1', out: -1, cols: 2, rails: [2.2] },
  { wall: 'z', line: WX, thick: T_EXT, a: -13.8, b: -11.2, y0: 0.9, y1: 3.0, room: 'W2A', out: -1, cols: 3, rails: [2.2] },
  // 診察室・処置室・検査室・便所（東）
  { wall: 'z', line: EX, thick: T_EXT, a: -7.0, b: -5.4, y0: 0.9, y1: 3.0, room: 'E1', out: 1, cols: 2, rails: [2.2] },
  { wall: 'z', line: EX, thick: T_EXT, a: -10.2, b: -8.5, y0: 0.9, y1: 3.0, room: 'E2', out: 1, cols: 2, rails: [2.2], broken: true },
  { wall: 'z', line: EX, thick: T_EXT, a: -14.6, b: -11.7, y0: 0.9, y1: 3.0, room: 'E3', out: 1, cols: 3, rails: [2.2] },
  { wall: 'z', line: EX, thick: T_EXT, a: -17.4, b: -15.9, y0: 1.0, y1: 2.6, room: 'E4', out: 1, cols: 2 },
  { wall: 'z', line: EX, thick: T_EXT, a: -20.4, b: -18.6, y0: 1.7, y1: 2.5, room: 'E5', out: 1, cols: 2 },
  // 階段室（踊り場の北・2 階の西）・給湯室・通用口
  { wall: 'x', line: -21.15, thick: T_EXT, a: -6.9, b: -5.0, y0: 3.0, y1: 4.7, room: 'STAIR', out: -1, cols: 2, broken: true },
  { wall: 'z', line: WX, thick: T_EXT, a: -18.6, b: -16.9, y0: 5.7, y1: 7.5, room: 'STAIR', out: -1, cols: 2 },
  { wall: 'z', line: WX, thick: T_EXT, a: -19.5, b: -18.0, y0: 2.3, y1: 3.7, room: 'STAIR', out: -1, cols: 2 },
  { wall: 'x', line: -21.15, thick: T_EXT, a: -3.9, b: -2.6, y0: 1.2, y1: 2.2, room: 'PANTRY', out: -1, cols: 2 },
  // 階段室の吹き抜けの北東の隅（給湯室の屋根の上）の縦長の窓
  { wall: 'x', line: -21.15, thick: T_EXT, a: -4.0, b: -2.3, y0: 3.7, y1: 7.6, room: 'STAIR', out: -1, cols: 2, rails: [5.0, 6.3] },
  { wall: 'z', line: 1.575, thick: 0.15, a: -22.8, b: -21.9, y0: 1.2, y1: 2.0, room: 'PORCH', out: 1, cols: 1 },
];

/** 階段（折り返し）。1 段 0.175 m・踏み面 0.25 m・14 段で 2.45 m */
export const STAIR = {
  riser: 0.175,
  tread: 0.25,
  mid: 2.45,
  /** 上りの 1 本目（西の壁ぎわを北へ）と 2 本目（南へ戻る） */
  f1: { x0: -7.2, x1: -6.0, zBottom: -16.55 },
  f2: { x0: -5.9, x1: -4.7, zBottom: -19.8 },
  /** 踊り場（北の端）と 2 階の踊り場（南の端） */
  landing: { z0: -21.0, z1: -19.8 },
  top: { z0: -16.55, z1: -15.4 },
  /** 吹き抜けの天井 */
  ceil: FLOOR2 + 3.3,
};
