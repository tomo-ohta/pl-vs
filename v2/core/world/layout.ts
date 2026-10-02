/**
 * フロアのデータ（純データ。サーバーとクライアントで共有する）。生成（core/gen）が作り、
 * シミュレーション（core/sim）が当たり判定・ゾーン・仕掛けの部品に、描画（client/render）がメッシュに変換する。
 *
 * - 座標はすべてフロア座標（m、y が上）。v1 のような「部屋ごとのローカル座標 + 配置」は使わない（フロアを丸ごと作るため）
 * - 材質の ID（MatId）・箱（Box）・色の組（Palette）は v1 と同じ形にしてある（v1 の材質ライブラリ・焼き込み照明をそのまま使うため）
 * - 仕掛けの部品は entities（EntitySpec）に入る。中身の型は部品の種類ごとに core/sim/parts で決まる
 */
import type { AABB } from '../math/aabb.ts';
import type { Dir, Vec3 } from '../math/vec.ts';
import type { Rect } from './footprint.ts';

// ---------------------------------------------------------------- 材質（v1 generators/layout.ts と同じ並び）
export type MatId =
  | 'floorCarpetRed' | 'floorCarpetGrey' | 'floorLino' | 'floorConcrete' | 'floorTile' | 'floorWood'
  | 'wallBeige' | 'wallWhite' | 'wallCream' | 'wallConcrete' | 'wallGreen' | 'wallDark'
  | 'ceilingWhite' | 'ceilingDark' | 'ceilingTile'
  | 'doorWood' | 'doorMetal' | 'trim' | 'glass' | 'lightPanel' | 'lightWarm' | 'lightOff' | 'ledBlue'
  | 'columnConcrete' | 'furnitureDark' | 'furnitureLight' | 'metal' | 'yellowLine' | 'placeholder' | 'void'
  | 'seatBlue' | 'lockerGreen' | 'metalDark' | 'wainscotCream' | 'noticeGreen' | 'handrailWood' | 'windowNight'
  | 'marbleFloor' | 'woodPanel' | 'bookshelfWood' | 'carpetPattern' | 'redShutter' | 'neonRed' | 'neonBlue' | 'goldTrim' | 'stainless'
  | 'whiteFabric' | 'plasticRed' | 'plasticYellow' | 'plasticBlue' | 'chalkboard' | 'aquariumBlue' | 'skyDay' | 'seatRed' | 'lockerBlue' | 'screenDark'
  | 'screenLcd' | 'marbleWhite' | 'paintWhite'
  | 'plantLeaf' | 'plantSoil' | 'shelfMetal' | 'boxCardboard' | 'plant' | 'water' | 'carPaint' | 'carGlass' | 'rubber' | 'upholstery'
  | 'lightGreen' | 'lightYellow' | 'screenGlow' | 'skyOvercast' | 'skyDusk' | 'skyNoon'
  | 'waterShallow' | 'waterWall' | 'waterFilm' | 'outsideView' | 'puddle' | 'shadowDecal' | 'untextured'
  | 'floorAsphalt' | 'wallBrick' | 'windowLit' | 'windowDark' | 'sodiumLight' | 'signPlate' | 'signEmissive'
  | 'ice' | 'snow' | 'grass'
  | 'sidingWood' | 'sidingMetal'
  | 'screenArcade' | 'screenPc' | 'canLabel'
  | 'wheat';

/** 箱（描画と当たり判定の基本単位） */
export interface Box {
  min: Vec3;
  max: Vec3;
  mat: MatId;
  /** 当たり判定にするか */
  solid: boolean;
  /**
   * 意味タグ。描画は見た目の置き換え（v1 の glTF プロップ）に、生成は配置の判定に使う。
   * 'colliderOnly'（描かない当たり判定）/ 'emitOnly'（描かない光源）は v1 と同じ意味
   */
  kind?: string;
  /** 複数の箱で 1 つの物（椅子・鉢植え）。描画と乱れの判定でまとめて扱う */
  propGroup?: string;
  /** 描画専用の環境マスク（v1 と同じ: kind, 中心, 半幅, 床の高さ） */
  environment?: [number, number, number, number];
  /** 出現型の隠し（v2-plan.md 4.1）: この組が「現れた」ときだけ描画・当たり判定に入る */
  revealGroup?: string;
  /** 出現型の隠し: この組が「現れた」ときに消える（行き止まりの壁が開く）。それまでは描画・当たり判定に入る */
  concealGroup?: string;
  /**
   * 傾けた箱（描画だけ。階段の手すり・斜めの梁など）: 軸 axis の向きに、min[axis] で 0・max[axis] で rise だけ上下がずれる平行六面体。
   * min / max は傾ける前（低い端の高さ）の箱。当たり判定は付けない（solid は false にする）
   */
  slope?: { axis: 'x' | 'z'; rise: number };
}

export interface LightSpec {
  pos: Vec3;
  color: number;
  intensity: number;
  distance: number;
  /** 部品から点灯・消灯できる照明（lamp 部品の id）。無ければ常に点灯 */
  lampId?: string;
}

/** 部屋の色の組（v1 と同じ） */
export interface Palette {
  floor: MatId;
  wall: MatId;
  ceiling: MatId;
  door: MatId;
  light: MatId;
  lightColor: number;
  lightIntensity: number;
  ambient: number;
  fog: number;
}

/** 焼き込み陰影の上書き（v1 と同じ） */
export interface LightingOverrides {
  directional?: { dir: Vec3; color: number; intensity: number }[];
  skyAmbient?: { color: number; intensity: number };
  occlusion?: boolean;
  areaEmitters?: boolean;
}

/** 材質・描画の上書き（v1 の RenderOverrides の一部） */
export interface RenderOverrides {
  wetness?: number;
  floorWetness?: number;
  colorMask?: [number, number, number];
  style?: 'untextured' | 'legacy';
  fog?: { color: number; near: number; far: number };
}

// ---------------------------------------------------------------- ゾーン
/**
 * プレイヤーに効く領域（フロア座標）。
 * water: 水平速度 ×slow / friction: 滑る（params.friction）/ force: 外力（vector × params.speed）/ crawl: しゃがみ通路 /
 * hazard: 体力（v2 の後半。今は効果なし）/ marker: 効果なし（地図・部品の目印）
 */
/** gravity: 重さの倍率（params.scale。0.4 なら軽い部屋）。ほかは v1 と同じ */
/**
 * 段階 4（移動と身体）で足した種類:
 * climb: はしご（vector = はしごへ向かう水平の向き。そちらへ押すと上る・離れる向きで下りる）/
 * swim: 深い水（params.surface = 水面の高さ。無ければ aabb の上端。深ければ浮いて泳ぐ・しゃがむで潜る・跳ぶで浮く・縁へ押すと這い上がる）/
 * magnet: 磁力の面（vector = 面の外向き = その面に立ったときの上。aabb は面から 1 m の厚み。向かって歩くと乗り移る）。
 * water / force のほかの params: sink（足が沈む深さ m）・drag（落ちる速さの上限 m/s）・air（force: 宙にいる間の倍率）。
 * force の vector の上向きの成分は、上昇気流（上へ向かう速さ）として効く。gravity の scale は 1 より大きくてもよい（重い部屋。
 * params.slow で歩きも遅く）。water の submerged: 水槽の無い水（dry と一緒に使い、水の足音にする。部屋ごと水の中）
 */
export type ZoneKind = 'water' | 'friction' | 'force' | 'crawl' | 'hazard' | 'marker' | 'gravity' | 'climb' | 'swim' | 'magnet';
export interface Zone {
  id?: string;
  kind: ZoneKind;
  aabb: AABB;
  vector?: Vec3;
  params?: { slow?: number; friction?: number; speed?: number; [k: string]: unknown };
}

/** 床の代わりに立てる面（坂・傾く床）。rect の範囲で、点 origin を通り法線 normal の平面に立つ。両面とも上から乗るだけ */
export interface SupportSurface {
  id: string;
  rect: Rect;
  origin: Vec3;
  normal: Vec3;
  /** この面より下には落ちない厚み（m）。下から突き抜けて乗らないための判定幅 */
  thickness?: number;
}

// ---------------------------------------------------------------- 区画（部屋）
export type CellRole = 'entry' | 'exit' | 'hub' | 'connector' | 'gimmick' | 'landmark' | 'rest' | 'side' | 'secret' | 'lab';

/**
 * フロアの中の 1 区画（描画のセル・地図の部屋・焼き込み照明の単位）。
 * 箱は区画ごとに持つ（cell and portal の描画で、見えない区画を丸ごと飛ばすため）
 */
export interface CellLayout {
  id: string;
  role: CellRole;
  /** 区画の外形（フロア座標） */
  bounds: AABB;
  /** 足跡（床の矩形の集合）。焼き込み照明と地図に使う */
  footprint: Rect[];
  /** 天井の高さ（床から） */
  height: number;
  /** 床の高さ（フロア座標の y） */
  floorY: number;
  palette: Palette;
  boxes: Box[];
  lights: LightSpec[];
  zones: Zone[];
  lighting?: LightingOverrides;
  render?: RenderOverrides;
  /** 施設のテーマ（オフィス・ホテル …）。音・家具・材質の選び方に使う */
  theme?: string;
  /** 環境音の種類（v1 の audioPreset と同じ語彙） */
  audioPreset?: string;
  /** 地図・図鑑に出す名前 */
  name?: string;
  /**
   * 素材の選び方の鍵（無ければ id）。広い開口でつながって 1 つの空間に見える区画どうしは同じ鍵にして、
   * 床・壁の素材の柄と色合いを揃える（区画の境目で色が切り替わらないように）
   */
  materialKey?: string;
}

/** 区画どうしの開口（cell and portal の描画で、ここを通して隣の区画が見える） */
export interface PortalSpec {
  id: string;
  /** つないでいる 2 つの区画 */
  cells: [string, string];
  /** 開口の範囲（フロア座標。壁の厚みを含む薄い箱） */
  aabb: AABB;
  /** 開口が向いている方向（cells[0] から cells[1] へ） */
  dir: Dir;
  kind: 'opening' | 'door' | 'window' | 'hole';
  /** 扉の部品（door 部品の id）。閉じている間は向こうを描かない */
  doorId?: string;
}

// ---------------------------------------------------------------- 仕掛けの部品（中身は core/sim/parts の部品ごと）
/** JSON にできる値（部品の params・状態に使う） */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** 入力の配線: 別の部品の出力 `部品ID.出力名`。invert で反転、複数なら OR（最大値） */
export type PortRef = string;
export type InputWire = PortRef | { from: PortRef | PortRef[]; invert?: boolean };

export interface EntitySpec {
  /** フロアの中で一意 */
  id: string;
  /** 部品の種類（core/sim/parts で登録された名前） */
  type: string;
  /** 置かれている区画 */
  cell?: string;
  /** 部品ごとの設定（JSON） */
  params: { [k: string]: Json };
  /** 入力の配線（入力名 → 出力） */
  inputs?: { [input: string]: InputWire };
}

// ---------------------------------------------------------------- フロア
export interface FloorExit {
  id: string;
  /** 出口の範囲（ここに入ると次のフロアへ） */
  aabb: AABB;
  kind: 'stairs' | 'elevator' | 'hole' | 'door' | 'slide' | 'secret';
  /** 行き先のフロアの座標（未定なら生成時に決める） */
  to?: { floor: string; exitId?: string };
}

export interface FloorLayout {
  id: string;
  seed: number;
  /** 生成器の版（保存の互換確認に使う） */
  genVersion: string;
  /** 調整表の版（core/config/tuning.ts の tuningVersion） */
  tuningVersion: string;
  bounds: AABB;
  cells: CellLayout[];
  portals: PortalSpec[];
  entities: EntitySpec[];
  /** 静的な坂（傾く床などの動く面は部品が持つ） */
  surfaces: SupportSurface[];
  spawn: { pos: Vec3; yaw: number; cell: string };
  exits: FloorExit[];
  /** 環境音・霧など、フロア全体の既定 */
  fog?: { color: number; near: number; far: number };
}

// ---------------------------------------------------------------- 寸法と作るための補助（v1 と同じ値）
export const WALL_T = 0.15;
export const DOOR_W = 1.0;
export const DOOR_H = 2.1;
export const WIDE_W = 2.2;
export const CRAWL_DOOR_W = 0.7;
export const CRAWL_DOOR_H = 1.2;

export function box(min: Vec3, max: Vec3, mat: MatId, solid = true): Box {
  return {
    min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])],
    max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])],
    mat,
    solid,
  };
}

/** kind 付きの箱 */
export function kinded(min: Vec3, max: Vec3, mat: MatId, kind: string, solid = true): Box {
  const b = box(min, max, mat, solid);
  b.kind = kind;
  return b;
}

/** 壁の開口（v1 と同じ） */
export interface Opening {
  at: number;
  width: number;
  height: number;
  y?: number;
}

/** 壁の開口の作り方（v1 Socket の一部。footprint.buildShell が読む） */
export interface WallOpening {
  id: string;
  /** 外面の床位置 */
  pos: Vec3;
  /** 外向き */
  dir: Dir;
  width: number;
  height: number;
  sill?: number;
}

/** 通り抜けられる草木の材質（v1 第18回。当たり判定を作らない） */
export const PASSABLE_VEGETATION: ReadonlySet<MatId> = new Set<MatId>(['plant', 'plantLeaf', 'grass', 'wheat']);
