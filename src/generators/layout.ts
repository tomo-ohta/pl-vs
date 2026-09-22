/** Generator の出力 = RoomLayout（純データ）。RoomBuilder が Three.js に変換する。 */
import type { Dir, PortalType, RoomDefinition, RoomInstance, Socket, TemplateDef, Vec3 } from '../core/types';
import type { Rng } from '../core/rng';
import type { AABB } from '../core/aabb';
import type { Rect } from './footprint';

export type MatId =
  | 'floorCarpetRed' | 'floorCarpetGrey' | 'floorLino' | 'floorConcrete' | 'floorTile' | 'floorWood'
  | 'wallBeige' | 'wallWhite' | 'wallCream' | 'wallConcrete' | 'wallGreen' | 'wallDark'
  | 'ceilingWhite' | 'ceilingDark' | 'ceilingTile'
  | 'doorWood' | 'doorMetal' | 'trim' | 'glass' | 'lightPanel' | 'lightWarm' | 'lightOff' | 'ledBlue'
  | 'columnConcrete' | 'furnitureDark' | 'furnitureLight' | 'metal' | 'yellowLine' | 'placeholder' | 'void'
  | 'seatBlue' | 'lockerGreen' | 'metalDark' | 'wainscotCream' | 'noticeGreen' | 'handrailWood' | 'windowNight'
  // 参考画像（Uncommon〜Mythic）向けの部屋別ドレッシング用（v1.3 第6回）
  | 'marbleFloor' | 'woodPanel' | 'bookshelfWood' | 'carpetPattern' | 'redShutter' | 'neonRed' | 'neonBlue' | 'goldTrim' | 'stainless'
  | 'whiteFabric' | 'plasticRed' | 'plasticYellow' | 'plasticBlue' | 'chalkboard' | 'aquariumBlue' | 'skyDay' | 'seatRed' | 'lockerBlue' | 'screenDark'
  | 'screenLcd' | 'marbleWhite' | 'paintWhite'
  | 'plantLeaf' | 'plantSoil' | 'shelfMetal' | 'boxCardboard' | 'plant' | 'water' | 'carPaint' | 'carGlass' | 'rubber' | 'upholstery'
  // Phase 2 Modifier / 未実装 Generator 向け（v1.3 追加）
  | 'lightGreen' | 'lightYellow' | 'screenGlow' | 'skyOvercast' | 'skyDusk' | 'skyNoon'
  | 'waterShallow' | 'waterWall' | 'puddle' | 'shadowDecal' | 'untextured'
  | 'floorAsphalt' | 'wallBrick' | 'windowLit' | 'windowDark' | 'sodiumLight' | 'signPlate' | 'signEmissive'
  | 'ice' | 'snow' | 'grass';

export interface Box {
  min: Vec3;
  max: Vec3;
  mat: MatId;
  /** Render-only environmental mask: kind (1=Z corridor dust, -1=X, 2=wet band), center/level, half width, floor Y. */
  environment?: [number, number, number, number];
  /** コライダにするか */
  solid: boolean;
  /**
   * 意味タグ（見た目専用）。RoomBuilder が PropCatalog の glTF モデルに置き換える対象を示す。当たり判定・生成・地図は箱のまま。
   * 例: 'desk' | 'chair' | 'table' | 'cabinet' | 'shelf' | 'sofa' | 'plant' | 'bin' | 'sign.wetFloor' | 'extinguisher' | 'vending' | 'lockers' |
   *     'cart' | 'crate' | 'box' | 'laptop' | 'papers' | 'clock' | 'camera' | 'fireAlarm' | 'payphone' | 'tv' | 'microwave' | 'ladder' | 'lightFixture'
   */
  kind?: string;
  /** 車両の表示用グループ。衝突形状・生成乱数には影響しない。 */
  vehicle?: { id: string; body: boolean };
  /** 複数箱から成る鉢植えの表示用グループ。 */
  propGroup?: string;
}

export interface LightSpec {
  pos: Vec3;
  color: number;
  intensity: number;
  distance: number;
}

export interface LabelSpec {
  pos: Vec3;
  dir: Dir;
  text: string;
  sub?: string;
  width: number;
}

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

// ---------------------------------------------------------------- v1.3 拡張フィールドの型（すべて任意・純データ。座標はローカル）

/** プレイヤー / 地図 / Modifier が参照する論理領域。
 *  water: 浅水（params.slow）/ friction: 滑る床（params.friction）/ force: 外力（vector, params.speed）/
 *  lane: 進行レーン（予約）/ theme: ゾーン別テーマ（ZoneThemeShuffle。params.preset）/ crawl: しゃがみ通路（頭上が低い）/ ride: 乗車トリガー（params.rideId） */
export type ZoneKind = 'water' | 'friction' | 'force' | 'lane' | 'theme' | 'crawl' | 'ride';
export interface Zone {
  kind: ZoneKind;
  aabb: AABB;
  /** force / lane の方向（ローカル。RoomBuilder が yaw で回してワールド化する） */
  vector?: Vec3;
  params?: Record<string, unknown>;
}

/** 同一形状の反復配置（InstancedMesh）。pos は底面中心、size は yaw=0 のときの寸法。Tier の instanceScale で個数を間引く */
export interface InstanceSpec {
  mat: MatId;
  size: Vec3;
  transforms: { pos: Vec3; yaw: number; scale?: number }[];
  /** true なら各インスタンスの AABB をコライダにする */
  solid?: boolean;
}

export type ParticleType = 'steam' | 'mist' | 'rain' | 'snow' | 'dust';
export interface ParticleSpec {
  type: ParticleType;
  /** 1 m³ あたりの粒数（Tier の particleCap で上限） */
  density: number;
  /** 発生領域（省略時は部屋の bounds） */
  aabb?: AABB;
  color?: number;
  /** 粒の見かけの大きさ（m）。省略時は type ごとの既定 */
  size?: number;
}

/** 壁面サイン（CanvasTexture）。plate: 銘板 / emissive: 発光サイン（非常口・ネオン）/ clock: 時計表示（text が時刻文字列） */
export interface SignSpec {
  /** 動的更新用（BuiltRoom.updateSign(id, text)）。省略時は更新不可 */
  id?: string;
  text: string;
  sub?: string;
  pos: Vec3;
  /** 表面が向く方向 */
  dir: Dir;
  width: number;
  kind: 'plate' | 'emissive' | 'clock';
  /** 文字色・地色（省略時は kind ごとの既定） */
  color?: number;
  background?: number;
  /** 左右反転（RenderStyle backside 相当。現状は未使用） */
  mirror?: boolean;
}

/** 床・壁に貼る薄い箔（水たまり・影・汚れ）。RoomBuilder は非ソリッドの薄い箱として描く（Tier の decals=false なら省略） */
export interface DecalSpec {
  mat: MatId;
  /** 中心 */
  pos: Vec3;
  /** 面に沿った寸法 [w, d] */
  size: [number, number];
  /** 貼る面の法線方向。'y' が床 / 'x' 'z' は壁 */
  normal: 'x' | 'y' | 'z';
  yaw?: number;
}

/** 可動要素（MovingWalls / DynamicLength / M07 タイル）。box は位相 0 の位置。RoomBuilder が個別 Mesh + 動くコライダにする */
export interface DynamicSpec {
  id: string;
  box: Box;
  motion: {
    /** slide: 三角波の往復 / oscillate: 正弦波 / rotate: axis まわりの回転（コライダは掃引範囲の AABB） */
    kind: 'slide' | 'oscillate' | 'rotate';
    axis: Vec3;
    /** slide / oscillate: 移動量（m）。rotate: 回転角（rad。period ごとに 1 往復） */
    amplitude: number;
    /** 周期（秒） */
    period: number;
    /** 位相（0..1） */
    phase: number;
  };
  solid: boolean;
}

/** 材質・描画の部屋別上書き。RoomBuilder が MaterialLibrary.variant に渡す */
export interface RenderOverrides {
  /** 濡れ（0..1）。roughness を下げ envMap を強める（壁・天井・家具にも掛かる） */
  wetness?: number;
  /** 床だけの濡れ（0..1）。床材（floor* / marbleFloor）にだけ掛かる（E01 / E07 / E09 の艶床）。wetness と併用時は強い方 */
  floorWetness?: number;
  /** 色欠損（ColorMissing）。乗算マスク */
  colorMask?: [number, number, number];
  /** untextured: 白無地（扉パネルは通常材質）/ legacy: 低解像度 NearestFilter + 量子化陰影 */
  style?: 'untextured' | 'legacy';
  /** 進行軸 axis に沿って from → to の色へ遷移（MaterialGradient） */
  gradient?: { from: MatId; to: MatId; axis: Vec3 };
  /** 部屋固有の霧（FogDepth 案 B）。材質側で scene.fog を無視してこの値を使う。BuiltRoom.fog にも保持（案 A の補間用） */
  fog?: { color: number; near: number; far: number };
  /** 偽の空（FakeSky）。RoomBuilder は天井材質を sky* に差し替えるのではなく、生成側が天井箔を置く。ここは環境色の指示 */
  sky?: { preset: string; lightColor: number };
}

/** SurfaceLighting（焼き込み陰影）の部屋別上書き */
export interface LightingOverrides {
  /** 平行光（FakeSky の日射）。dir は光の進む向き */
  directional?: { dir: Vec3; color: number; intensity: number }[];
  /** 空の環境光（法線 y 重み付き） */
  skyAmbient?: { color: number; intensity: number };
  /** 遮蔽判定（false で InvertedShadow: 焼き込み影を作らない） */
  occlusion?: boolean;
  /** 薄いパネル以外の発光箱も光源にする */
  areaEmitters?: boolean;
}

/** 乗車（VehicleRide）。socketId は乗車扉、path は車内の足元位置列（1 点ならその場で待つ） */
export interface RideSpec {
  id: string;
  socketId: string;
  path: Vec3[];
  durationSec: number;
  vehicle: 'train' | 'boat' | 'monorail';
}

/** 鏡面（MirrorOffset）。面の中心・法線方向・寸法。鏡裏の空間予約は接続側 */
export interface MirrorSpec {
  id: string;
  pos: Vec3;
  dir: Dir;
  size: [number, number];
  offset?: number;
  delaySec?: number;
}

/** 水の壁（WaterWall）。socketId の開口を水面で塞ぐ */
export interface WaterWallSpec {
  socketId: string;
  height: number;
  flow?: number;
}

export interface RoomLayout {
  bounds: AABB;
  /** 足跡（外形矩形の集合。壁は矩形の内側） */
  footprint: Rect[];
  height: number;
  sockets: Socket[];
  boxes: Box[];
  lights: LightSpec[];
  labels: LabelSpec[];
  palette: Palette;
  /** 床穴（hole ソケット）の床面 AABB（トリガー判定用） */
  holes: AABB[];
  /** エレベーター籠の内部ボリューム（トリガー） */
  elevators: { socketId: string; volume: AABB; button: Vec3; buttonDir: Dir }[];

  // ---- 以下は v1.3 の任意フィールド（Modifier / 新 Generator が設定。既定は undefined） ----
  /** boxes のうち先頭 shellCount 個がシェル（床・天井・外壁）。Modifier が内装だけを対象にするときの境界 */
  shellCount?: number;
  zones?: Zone[];
  instances?: InstanceSpec[];
  /**
   * パーティクル。単一（従来）または複数スロット（L09 の浴槽ごとの湯気 + 全体の mist など）。
   * 読むときは `particleList(L)`（generators/particles.ts）で配列に正規化する。RoomBuilder はスロットごとに Points を作り、
   * 粒数の合計を Tier の particleCap に収める（超えるときは各スロットを比例で削る）。
   */
  particles?: ParticleSpec | ParticleSpec[];
  signs?: SignSpec[];
  decals?: DecalSpec[];
  dynamics?: DynamicSpec[];
  render?: RenderOverrides;
  lighting?: LightingOverrides;
  /** 進行軸（入口→主出口の折れ線。MaterialGradient / TemperatureField / VehicleRide が使う） */
  path?: Vec3[];
  /** 部屋固有の視程（Game が scene.fog.far のクランプに使う） */
  fogFar?: number;
  /** チャンク格子の一辺（m）。既定 28。1 チャンクに収まる部屋は従来と同じ 1 Group */
  chunkSize?: number;
  /** 歩ける階の数（多層の Mega / Street が設定）。地図の levelSpan に使う（無ければ WorldManager が世界 AABB の高さから丸める） */
  levels?: number;
  mirrors?: MirrorSpec[];
  waterWalls?: WaterWallSpec[];
  rides?: RideSpec[];
  /** E03 見た目のロール（1/4 回転数）。RoomBuilder が rollFrom 以降の箱・照明・サインを進行軸まわりに回して構築し、コライダも回転後の箱で作る */
  roll?: 0 | 1 | 2 | 3;
  /** ロールの軸。'z' = 最初の廊下セグメントの進行方向（既定）/ 'x' */
  rollAxis?: 'x' | 'z';
  /** ロールする箱の開始インデックス（既定: shellCount ?? 0。シェルは回さない） */
  rollFrom?: number;
  /** ロールの回転中心（既定: footprint 断面の中心 [cx, height/2, cz]） */
  rollPivot?: Vec3;
}

export interface EntryRequirement {
  type: PortalType;
  width: number;
}

export interface GenParams {
  def: RoomDefinition;
  template: TemplateDef;
  rng: Rng;
  /** 親から入ってくるソケットの要件。開始部屋は null */
  entry: EntryRequirement | null;
  /** 戻り以外の出口数（最低値。生成器は広さに応じて増やしてよい） */
  exits: number;
  /** 配置試行のバリアント（0 = 最大サイズ）。生成器がサイズ・形状・入口位置に解釈する */
  variant: number;
  palette: Palette;
  /** 部屋名などのサイン表示 */
  label?: { text: string; sub?: string };
  /** hole ソケットを許可するか */
  allowHole: boolean;
  /** 後から追加された壁面ソケット（部屋同士の直結）。開口として組み込む */
  extraSockets: Socket[];
  /** 取り除く出口ソケット id（壁を塞ぐ） */
  removedSockets: string[];
  /** 主矩形の上書き（空き空間へ成長させた結果） */
  mainRect?: Rect;
  /** 床穴の固定位置（真下の部屋を配置済み。再生成で動かさない） */
  holeLocal?: Vec3;
  /** 接続指示で付いた役割（RoomInstance.role。'interior' / 'repeat' / 'fakeStart' など）。開始部屋・Node ハーネスでは undefined */
  role?: string;
  /**
   * 生成対象のノード（WorldManager.layoutFor が渡す。Node ハーネス・precompile では undefined）。
   * Modifier の layout フックが onNodeCreated で保存した `node.state.modifierState` / `node.role` / `node.repeat` を読むために使う。
   * レイアウトの決定論は (definitionId, seed, variant, extraSockets, removedSockets, mainRect, holeLocal) + ここから読んだ保存値の関数のまま
   */
  node?: RoomInstance;
}

/** 0.5m グリッドへ丸める（部屋同士の壁を揃えて直結しやすくする） */
export function snap(v: number, step = 0.5): number {
  return Math.round(v / step) * step;
}

export const WALL_T = 0.15;
export const DOOR_W = 1.0;
export const DOOR_H = 2.1;
export const WIDE_W = 2.2;
export const HOLE_SIZE = 1.4;

export function box(min: Vec3, max: Vec3, mat: MatId, solid = true): Box {
  return {
    min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])],
    max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])],
    mat,
    solid,
  };
}

/** kind 付きの箱（見た目だけ glTF プロップに置き換わる。寸法・コライダは box と同じ） */
export function kinded(min: Vec3, max: Vec3, mat: MatId, kind: string, solid = true): Box {
  const b = box(min, max, mat, solid);
  b.kind = kind;
  return b;
}

export interface Opening {
  /** 壁に沿った位置（X 壁なら x、Z 壁なら z） */
  at: number;
  width: number;
  height: number;
  /** 開口下端の高さ（床から。Socket.sill）。省略時 0。壁の下部（0..y）は残す */
  y?: number;
}

/** ソケットを Opening に変換する（sill を y に写す） */
export function openingOf(s: Socket, axis: 0 | 2): Opening {
  return { at: s.pos[axis], width: s.width, height: s.height, y: s.sill ?? 0 };
}

/** しゃがみ開口（R16 小型扉 0.7 × 1.2 / E03 横長スロット 2.1 × 1.0、sill 0.6）の既定寸法 */
export const CRAWL_DOOR_W = 0.7;
export const CRAWL_DOOR_H = 1.2;
export const SLOT_W = 2.1;
export const SLOT_H = 1.0;
export const SLOT_SILL = 0.6;

/** 天井の発光パネル（非ソリッド） */
export function lightPanel(out: Box[], cx: number, cz: number, w: number, d: number, h: number, mat: MatId): void {
  out.push(box([cx - w / 2, h - 0.04, cz - d / 2], [cx + w / 2, h - 0.005, cz + d / 2], mat, false));
}

/** 壁面ソケットを作る（pos は壁面の床位置、dir は外向き）。opts.sill / opts.crawl は低い開口・高いスロット用（省略時は付けない） */
export function socket(id: string, type: PortalType, pos: Vec3, dir: Dir, width = DOOR_W, height = DOOR_H, opts?: { sill?: number; crawl?: boolean }): Socket {
  const s: Socket = { id, type, pos, dir, width, height };
  if (opts?.sill) s.sill = opts.sill;
  if (opts?.crawl) s.crawl = true;
  return s;
}

export function emptyLayout(palette: Palette): RoomLayout {
  return { bounds: { min: [0, 0, 0], max: [0, 0, 0] }, footprint: [], height: 2.7, sockets: [], boxes: [], lights: [], labels: [], palette, holes: [], elevators: [] };
}

/** 面積に応じた出口数の増分（密度を上げるための横道） */
export function bonusExits(area: number): number {
  if (area > 400) return 3;
  if (area > 200) return 2;
  if (area > 80) return 1;
  return 0;
}

/** 生成器ごとのバリアント数（WorldManager が 0..n-1 を順に試す）。
 *  既定値をここに置き、各 Generator ファイルが export する `variants` を generators/index.ts が registerVariants で束ねる
 *  （index.ts を読み込めば同じ値で上書きされる。新 Generator は自分のファイルに variants を書けばよい） */
export const VARIANTS: Record<string, number> = {
  CorridorGenerator: 16,
  RoomGenerator: 24,
  ParkingGenerator: 6,
  VerticalGenerator: 1,
  GridGenerator: 12,
  AtriumGenerator: 8,
};

export function registerVariants(table: Record<string, number>): void {
  for (const [k, v] of Object.entries(table)) if (v > 0) VARIANTS[k] = v;
}

// ---------------------------------------------------------------- 旧式ヘルパー（VerticalGenerator / AdapterGenerator 用）
/** X 軸に平行な壁（z 固定）。zInner は室内側の面、outward=+1 なら壁は zInner..zInner+t */
export function wallAlongX(out: Box[], x0: number, x1: number, zInner: number, outward: 1 | -1, h: number, mat: MatId, openings: Opening[] = [], t = WALL_T): void {
  const za = outward > 0 ? zInner : zInner - t;
  const zb = outward > 0 ? zInner + t : zInner;
  legacySegments(x0, x1, openings).forEach(([a, b]) => out.push(box([a, 0, za], [b, h, zb], mat)));
  for (const o of openings) {
    const a = Math.max(x0, o.at - o.width / 2);
    const b = Math.min(x1, o.at + o.width / 2);
    const y0 = o.y ?? 0;
    if (y0 > 0.005) out.push(box([a, 0, za], [b, y0, zb], mat));
    if (y0 + o.height < h) out.push(box([a, y0 + o.height, za], [b, h, zb], mat));
  }
}

/** Z 軸に平行な壁（x 固定） */
export function wallAlongZ(out: Box[], z0: number, z1: number, xInner: number, outward: 1 | -1, h: number, mat: MatId, openings: Opening[] = [], t = WALL_T): void {
  const xa = outward > 0 ? xInner : xInner - t;
  const xb = outward > 0 ? xInner + t : xInner;
  legacySegments(z0, z1, openings).forEach(([a, b]) => out.push(box([xa, 0, a], [xb, h, b], mat)));
  for (const o of openings) {
    const a = Math.max(z0, o.at - o.width / 2);
    const b = Math.min(z1, o.at + o.width / 2);
    const y0 = o.y ?? 0;
    if (y0 > 0.005) out.push(box([xa, 0, a], [xb, y0, b], mat));
    if (y0 + o.height < h) out.push(box([xa, y0 + o.height, a], [xb, h, b], mat));
  }
}

function legacySegments(a0: number, a1: number, openings: Opening[]): [number, number][] {
  const cuts = openings
    .map((o) => [Math.max(a0, o.at - o.width / 2), Math.min(a1, o.at + o.width / 2)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0]);
  const segs: [number, number][] = [];
  let cur = a0;
  for (const [a, b] of cuts) {
    if (a > cur + 0.01) segs.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (a1 > cur + 0.01) segs.push([cur, a1]);
  return segs;
}

export function floorWithHoles(out: Box[], x0: number, z0: number, x1: number, z1: number, mat: MatId, holes: AABB[], thickness = 0.2): void {
  if (holes.length === 0) {
    out.push(box([x0, -thickness, z0], [x1, 0, z1], mat));
    return;
  }
  const h = holes[0];
  out.push(box([x0, -thickness, z0], [x1, 0, h.min[2]], mat));
  out.push(box([x0, -thickness, h.max[2]], [x1, 0, z1], mat));
  out.push(box([x0, -thickness, h.min[2]], [h.min[0], 0, h.max[2]], mat));
  out.push(box([h.max[0], -thickness, h.min[2]], [x1, 0, h.max[2]], mat));
}

export function ceiling(out: Box[], x0: number, z0: number, x1: number, z1: number, h: number, mat: MatId, thickness = 0.2): void {
  out.push(box([x0, h, z0], [x1, h + thickness, z1], mat));
}
