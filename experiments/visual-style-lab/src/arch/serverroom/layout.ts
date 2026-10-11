/**
 * サーバールームの配置の数値。座標は場面と同じ（m。x 東・z 南・y 上。北 = -Z）。
 * 床はどこも y = 0（サーバー室は二重床の上面。スラブを 0.6 m 下げてあるので、廊下と同じ高さで出入りできる）。
 *
 * 建物: 通信ビルの 3 階（データセンターの 1 フロア。41 × 30 m）。南北に長いサーバー室 3 つ（A・B・C）を西から東へ並べ、
 * 北の共用廊下で結ぶ。サーバー室の扉は各室の通路（コールドアイル）の北の突き当たり。
 * 参考画像 serverroom-0 / 1 / 2 は B / C / A のコールドアイルから北の扉を見た視点。
 * - 廊下の北: 荷物用エレベーター・消火ガスのボンベ室・UPS 室・蓄電池室・電気室
 * - 西の棟: 開梱室（搬入した機器を箱から出す）・荷捌き場（トラックの着く低い床と荷台の高さの床）
 * - 東の棟: 監視室（NOC）・階段とエレベーターのホール（上の階へ）
 * - 南: 空調機械室（サーバー室の床下へ冷気を送る空調機の列と、点検用の中 2 階の通路）
 */

export type Rect = [number, number, number, number];
export type V2 = [number, number];
export type RoomId = 'A' | 'B' | 'C';

/** サーバー室の北の壁（内側の面）・南の壁（内側の面） */
export const NORTH = -12;
export const SOUTH = 4;
/** 壁の厚さ */
export const WALL = 0.2;

export interface RoomSpec {
  id: RoomId;
  view: string;
  label: string;
  /** 通路（コールドアイル）の中心の x */
  cx: number;
  /** 室の内側の x の範囲 */
  x0: number;
  x1: number;
  /** 通路の幅（向かい合うラックの前面のガラスの間） */
  aisle: number;
  /** ラックの奥行き（扉を含む）・高さ */
  depth: number;
  rackH: number;
  /** ラックの列の北の端・南の端（z） */
  rowN: number;
  rowS: number;
  /** 天井（照明の面）の高さ */
  ceil: number;
  /** 北の扉（中心の x・幅・高さ） */
  doorX: number;
  doorW: number;
  doorH: number;
  /** 照明の型: panel = 通路の真上の四角い器具、strip = 通路を横切る線の器具、tray = ケーブルラックの間の小さな器具 */
  lights: 'panel' | 'strip' | 'tray';
}

/** 3 室。数値は参考画像の視点のカメラから逆算（docs/stages/serverroom.md） */
export const ROOMS: Record<RoomId, RoomSpec> = {
  A: { id: 'A', view: 'serverroom-2', label: 'サーバー室 A（インロー空調の列）', cx: -7.4, x0: -11, x1: -3.8, aisle: 2.6, depth: 1.1, rackH: 2.25, rowN: -11.4, rowS: 1.6, ceil: 3.1, doorX: -7.29, doorW: 0.97, doorH: 2.0, lights: 'strip' },
  B: { id: 'B', view: 'serverroom-0', label: 'サーバー室 B（ガラス扉のラック）', cx: 0, x0: -3.6, x1: 3.6, aisle: 2.0, depth: 1.1, rackH: 2.2, rowN: -10.75, rowS: 1.6, ceil: 3.0, doorX: 0, doorW: 0.85, doorH: 2.1, lights: 'panel' },
  C: { id: 'C', view: 'serverroom-1', label: 'サーバー室 C（背の高いラック）', cx: 7.4, x0: 3.8, x1: 11, aisle: 2.1, depth: 1.1, rackH: 2.5, rowN: -10.65, rowS: 1.6, ceil: 3.15, doorX: 7.23, doorW: 0.86, doorH: 2.0, lights: 'tray' },
};

export const ROOM_IDS: RoomId[] = ['A', 'B', 'C'];

// ---------------------------------------------------------------- 建物の全体

export type SpaceKind = 'server' | 'corridor' | 'ups' | 'battery' | 'gas' | 'lift' | 'elec' | 'staging' | 'dock' | 'noc' | 'stair' | 'ahu';

export interface SpaceDef {
  id: string;
  label: string;
  kind: SpaceKind;
  rect: Rect;
  /** 天井の高さ（天井の板の下面） */
  ceil: number;
  closed?: boolean;
  note: string;
}

/** 建物の外壁の外の面 */
export const BLDG: Rect = [-21.6, -21.2, 19.6, 8.9];
/** 共用廊下 */
export const CORR: Rect = [-21.4, -14.6, 19.4, -12.2];
/** トラックの着く低い床の高さ（荷捌き場） */
export const BAY_Y = -1.1;
/** 空調機械室の中 2 階の通路の床 */
export const CATWALK_Y = 2.4;
/** 2 階の踊り場（階段の上） */
export const LANDING_Y = 2.25;

export const SPACES: SpaceDef[] = [
  { id: 'A', label: ROOMS.A.label, kind: 'server', rect: [-11, -12, -3.8, 4], ceil: 3.1, note: 'serverroom-2 の視点。インロー空調機の列・天井から垂れたケーブル・横に渡る線の照明' },
  { id: 'B', label: ROOMS.B.label, kind: 'server', rect: [-3.6, -12, 3.6, 4], ceil: 3.0, note: 'serverroom-0 の視点。ガラス扉のラック・通路の真上の四角い照明・床のケーブルの輪' },
  { id: 'C', label: ROOMS.C.label, kind: 'server', rect: [3.8, -12, 11, 4], ceil: 3.15, note: 'serverroom-1 の視点。背の高いラック・通路の上の幅の広いケーブルラック・床の点検口・淡い分電盤' },
  { id: 'CORR', label: '共用廊下', kind: 'corridor', rect: CORR, ceil: 2.7, note: 'サーバー室・機械室・監視室・開梱室をつなぐ。扉の横にカードの読み取り機' },
  { id: 'LIFT', label: '荷物用エレベーター', kind: 'lift', rect: [-21.4, -21, -18.2, -14.8], ceil: 3.0, closed: true, note: '扉は閉じている（かごは別の階）' },
  { id: 'GAS', label: '消火ガスのボンベ室', kind: 'gas', rect: [-18, -21, -12.6, -14.8], ceil: 3.0, note: 'ボンベの列・集合管・起動の箱。行き止まり' },
  { id: 'UPS', label: 'UPS 室', kind: 'ups', rect: [-12.4, -21, -1.2, -14.8], ceil: 3.2, note: '無停電電源装置の盤の列・分電盤・天井のケーブルラック' },
  { id: 'BAT', label: '蓄電池室', kind: 'battery', rect: [-1, -21, 8.4, -14.8], ceil: 3.2, note: '蓄電池の架台の列・洗眼器・注意の表示' },
  { id: 'ELEC', label: '電気室', kind: 'elec', rect: [8.6, -21, 19.4, -14.8], ceil: 3.2, note: '受変電の盤の列・計器・床のケーブルピット' },
  { id: 'STG', label: '開梱室', kind: 'staging', rect: [-21.4, -12, -11.2, -2], ceil: 3.2, note: '搬入した機器の箱・棚・作業台・ラックの梱包' },
  { id: 'DOCK', label: '荷捌き場', kind: 'dock', rect: [-21.4, -1.8, -11.2, 8.6], ceil: 4.6, note: '西の半分はトラックの着く低い床（-1.1 m）・東は荷台の高さの床。南のシャッターは閉じている' },
  { id: 'NOC', label: '監視室（NOC）', kind: 'noc', rect: [11.2, -12, 19.4, -4], ceil: 2.8, note: '監視の机の列・壁の大きな画面' },
  { id: 'STAIR', label: '階段とエレベーターのホール', kind: 'stair', rect: [11.2, -3.8, 19.4, 8.6], ceil: 6.0, note: '上の階への階段（踊り場まで）・エレベーター' },
  { id: 'AHU', label: '空調機械室', kind: 'ahu', rect: [-11, 4.2, 11, 8.6], ceil: 5.2, note: '空調機の列（サーバー室の床下へ送る）・冷水の配管・中 2 階の点検通路' },
];

export interface DoorDef {
  id: string;
  label: string;
  /** 'x' = z 一定の壁（x に沿う）・'z' = x 一定の壁 */
  wall: 'x' | 'z';
  /** 壁の線（z か x） */
  line: number;
  /** 壁に沿った範囲 */
  a: number;
  b: number;
  /** 床の高さ・扉の高さ */
  y0: number;
  h: number;
  /** auto = 近づくと開く・locked = 鍵・open = 開口 */
  state: 'auto' | 'locked' | 'open';
  kind: 'single' | 'double' | 'shutter' | 'lift' | 'opening';
  /** 開く向き（壁の法線の +1 / -1 の側へ） */
  swing?: 1 | -1;
}

const rd = (id: RoomId): [number, number] => [ROOMS[id].doorX - ROOMS[id].doorW / 2, ROOMS[id].doorX + ROOMS[id].doorW / 2];

export const DOORS: DoorDef[] = [
  // サーバー室の北の扉（参考画像の突き当たりの扉。廊下の側へ開く）
  { id: 'dA', label: 'サーバー室 A の扉', wall: 'x', line: -12.1, a: rd('A')[0], b: rd('A')[1], y0: 0, h: ROOMS.A.doorH, state: 'auto', kind: 'single', swing: -1 },
  { id: 'dB', label: 'サーバー室 B の扉', wall: 'x', line: -12.1, a: rd('B')[0], b: rd('B')[1], y0: 0, h: ROOMS.B.doorH, state: 'auto', kind: 'single', swing: -1 },
  { id: 'dC', label: 'サーバー室 C の扉', wall: 'x', line: -12.1, a: rd('C')[0], b: rd('C')[1], y0: 0, h: ROOMS.C.doorH, state: 'auto', kind: 'single', swing: -1 },
  // サーバー室の南の扉（西のホットアイルの端から空調機械室へ）
  { id: 'sA', label: 'A から空調機械室', wall: 'x', line: 4.1, a: -10.8, b: -9.9, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  { id: 'sB', label: 'B から空調機械室', wall: 'x', line: 4.1, a: -3.4, b: -2.5, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  { id: 'sC', label: 'C から空調機械室', wall: 'x', line: 4.1, a: 10.0, b: 10.9, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  // 廊下の北の部屋（機械室の扉は外開き = 廊下の側へ開く。避難の向き）
  { id: 'nLift', label: '荷物用エレベーター', wall: 'x', line: -14.7, a: -20.6, b: -19.0, y0: 0, h: 2.4, state: 'locked', kind: 'lift' },
  { id: 'nGas', label: 'ボンベ室', wall: 'x', line: -14.7, a: -15.6, b: -14.7, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  { id: 'nUps', label: 'UPS 室', wall: 'x', line: -14.7, a: -7.6, b: -5.8, y0: 0, h: 2.2, state: 'auto', kind: 'double', swing: 1 },
  { id: 'nBat', label: '蓄電池室', wall: 'x', line: -14.7, a: 3.0, b: 4.0, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  { id: 'nElec', label: '電気室', wall: 'x', line: -14.7, a: 13.2, b: 15.0, y0: 0, h: 2.2, state: 'auto', kind: 'double', swing: 1 },
  // 廊下の端
  { id: 'wExit', label: '非常口（西）', wall: 'z', line: -21.5, a: -13.9, b: -12.9, y0: 0, h: 2.1, state: 'locked', kind: 'single' },
  { id: 'eOffice', label: '事務所の棟へ（東）', wall: 'z', line: 19.5, a: -13.9, b: -12.9, y0: 0, h: 2.1, state: 'locked', kind: 'single' },
  // 廊下の南: 開梱室・監視室
  { id: 'cStg', label: '開梱室', wall: 'x', line: -12.1, a: -15.4, b: -13.6, y0: 0, h: 2.4, state: 'auto', kind: 'double', swing: 1 },
  { id: 'cNoc', label: '監視室', wall: 'x', line: -12.1, a: 13.0, b: 14.0, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  // 西の棟・東の棟の中
  { id: 'stgDock', label: '開梱室から荷捌き場', wall: 'x', line: -1.9, a: -14.8, b: -12.4, y0: 0, h: 2.6, state: 'open', kind: 'opening' },
  { id: 'dockAhu', label: '荷捌き場から空調機械室', wall: 'z', line: -11.1, a: 5.6, b: 6.6, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  { id: 'nocStair', label: '監視室から階段のホール', wall: 'x', line: -3.9, a: 12.0, b: 13.0, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  { id: 'ahuStair', label: '空調機械室から階段のホール', wall: 'z', line: 11.1, a: 5.6, b: 6.6, y0: 0, h: 2.1, state: 'auto', kind: 'single', swing: 1 },
  { id: 'shutter', label: '荷捌き場のシャッター', wall: 'x', line: 8.75, a: -20.8, b: -17.2, y0: BAY_Y, h: 3.6, state: 'locked', kind: 'shutter' },
  { id: 'liftP', label: '人の乗るエレベーター', wall: 'z', line: 19.5, a: 0.6, b: 1.8, y0: 0, h: 2.2, state: 'locked', kind: 'lift' },
  { id: 'liftP2', label: '人の乗るエレベーター（2 号機）', wall: 'z', line: 19.5, a: -1.6, b: -0.4, y0: 0, h: 2.2, state: 'locked', kind: 'lift' },
  { id: 'upDoor', label: '上の階への扉（鍵）', wall: 'z', line: 19.5, a: 7.3, b: 8.3, y0: LANDING_Y * 2, h: 2.1, state: 'locked', kind: 'single' },
];

export interface WallDef {
  a: V2;
  b: V2;
  /** 壁の下端・上端 */
  y0: number;
  y1: number;
  /** 外壁 */
  outer?: boolean;
}

/** 壁の中心線（厚さ WALL）。扉の穴は DOORS から求める。サーバー室の壁もここ（隣の室と同じ壁を 2 回作らない） */
export const WALLS: WallDef[] = [
  // 外壁
  { a: [-21.5, -21.1], b: [19.5, -21.1], y0: -1.2, y1: 6.4, outer: true },
  { a: [-21.5, 8.75], b: [19.5, 8.75], y0: -1.2, y1: 6.4, outer: true },
  { a: [-21.5, -21.1], b: [-21.5, 8.75], y0: -1.2, y1: 6.4, outer: true },
  { a: [19.5, -21.1], b: [19.5, 8.75], y0: -1.2, y1: 6.4, outer: true },
  // 廊下の両側
  { a: [-21.4, -12.1], b: [19.4, -12.1], y0: 0, y1: 3.45 },
  { a: [-21.4, -14.7], b: [19.4, -14.7], y0: 0, y1: 3.45 },
  // 廊下の北の部屋の間仕切り
  { a: [-18.1, -21.0], b: [-18.1, -14.8], y0: 0, y1: 3.45 },
  { a: [-12.5, -21.0], b: [-12.5, -14.8], y0: 0, y1: 3.45 },
  { a: [-1.1, -21.0], b: [-1.1, -14.8], y0: 0, y1: 3.45 },
  { a: [8.5, -21.0], b: [8.5, -14.8], y0: 0, y1: 3.45 },
  // サーバー室の間・両端（西の棟・東の棟との間）
  { a: [-11.1, -12.0], b: [-11.1, 8.65], y0: -1.2, y1: 5.6 },
  { a: [-3.7, -12.0], b: [-3.7, 4.0], y0: 0, y1: 3.45 },
  { a: [3.7, -12.0], b: [3.7, 4.0], y0: 0, y1: 3.45 },
  { a: [11.1, -12.0], b: [11.1, 8.65], y0: 0, y1: 6.4 },
  // サーバー室の南（空調機械室との間）
  { a: [-11.0, 4.1], b: [11.0, 4.1], y0: 0, y1: 5.6 },
  // 西の棟: 開梱室と荷捌き場の間
  { a: [-21.4, -1.9], b: [-11.2, -1.9], y0: -1.2, y1: 4.8 },
  // 東の棟: 監視室と階段のホールの間
  { a: [11.2, -3.9], b: [19.4, -3.9], y0: 0, y1: 6.4 },
];

/** 区域ごとの見た目の箱（カメラがどの部屋にいるか） */
export function spaceAt(x: number, z: number): SpaceDef | undefined {
  return SPACES.find((s) => x >= s.rect[0] - 0.12 && x <= s.rect[2] + 0.12 && z >= s.rect[1] - 0.12 && z <= s.rect[3] + 0.12);
}
