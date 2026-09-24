/**
 * MatId → CC0 PBR セット（ambientCG / Poly Haven）の対応表。用途ごとに 2〜4 種のバリエーションを持つ。
 *
 * - 素材本体は `assets/cc0/materials/<Id>/`（ambientCG）と `assets/cc0/textures/<id>/`（Poly Haven）。
 *   取得: tools/fetch-cc0-assets.py → `npm run build:cc0` で `public/cc0/materials/<Id>/` と `public/cc0/materials/index.json` に書き出す。
 * - MaterialLibrary は起動時に index.json を fetch し、ここに載っていて index にも存在するセットだけを使う。
 *   `CC0_VARIANTS[id]` の先頭から順に「index にあるもの」が候補になり、`forRoom(id, { seed })` の seed から決定論的に 1 つ選ぶ
 *   （`variant()` / `get()` は常に先頭の候補）。候補が 1 つも無ければ従来の生成テクスチャ（SurfaceDetail）に戻る。
 * - `meters` は 1 タイルの実寸。ジオメトリの UV は SURFACES.meters 単位（applyMetricUV / writeSurfaceCoordinates）なので、
 *   材質側で texture.repeat = SURFACES.meters / meters を掛けて「1 タイル = meters m」に揃える。
 * - `tint` は線形空間の色倍率（material.color）。目標色（SURFACES.color、wallWhite は暖かい生成り 0xd8d4c8）÷ Color マップの平均色を
 *   最大 1.4（暗いセットは 1.8〜2.2）に丸めたもの（scratchpad/cc0/tints2.mjs）。木・布は色相を保つよう手で寄せた。
 * - `albedo: false` は塗装面（doorMetal / shelfMetal / lockerGreen / metalDark）: Color を使わず SURFACES.color の単色に法線・粗さだけ重ねる。
 * - `rotate` は UV を 90° 回す（木目が u 方向に走る素材を、writeSurfaceCoordinates が v に置く木目軸へ合わせる）。
 * - `blend` は 2 層タイリング混合（docs/material-variation.md）の [scale, du, dv]。2 層目は uv * scale + (du, dv) でサンプルし、
 *   部屋座標の低周波ノイズ（約 4.5 m）で混ぜる。目地・板・格子・煉瓦のある素材は scale 1 + 格子に揃うオフセット（k/N）にして、
 *   混合部で半端なタイルが出ないようにする。無地（コンクリート・漆喰・布）は既定の [0.61, 0.31, 0.77]。false で無効。
 * - `parallax` は視差（POM）の高さ（m 相当。high Tier のみ。Displacement マップがあるセットだけ有効）。
 */
import type { MatId } from '../generators/layout';

export interface Cc0Binding {
  /** セットの Id（assets/cc0/manifest.json の materials / textures キー = index.json のキー） */
  set: string;
  /** 1 タイルの実寸（m） */
  meters: number;
  /** 線形空間の色倍率（既定 [1,1,1]） */
  tint?: [number, number, number];
  /** false なら Color を使わず SURFACES.color を塗る（塗装面） */
  albedo?: boolean;
  /** normalScale（既定 1.0。カーペット等で強すぎるときは 0.6） */
  normalScale?: number;
  /** metalness（既定 0。露出金属のみ 0.6〜0.9） */
  metalness?: number;
  /** AO の強さ（既定 1） */
  aoIntensity?: number;
  /** UV を 90° 回す（木目の向き） */
  rotate?: boolean;
}

export interface Cc0Variant extends Cc0Binding {
  /** 2 層タイリング混合 [scale, du, dv]。省略時は無地向けの既定。false で無効 */
  blend?: [number, number, number] | false;
  /** 視差の高さ（m 相当）。0 / 省略で無効 */
  parallax?: number;
  /** 備考（docs 用） */
  note?: string;
}

/** public/cc0/materials/index.json の 1 項目（tools/build-cc0-materials.mjs が書く） */
export interface Cc0IndexEntry {
  color: string;
  normal: string;
  roughness: string;
  ao?: string;
  displacement?: string;
  resolution: string;
  maxSize?: number;
  /** Color の平均色 "#rrggbb"（読込完了前の 1 px 代替色） */
  avg?: string;
  kind?: 'ambientcg' | 'polyhaven';
  source?: string;
  license?: string;
  /** KTX2（Basis ETC1S）版のパス（tools/build-ktx2.mjs。color / normal / roughness が揃ったセットだけ）。無ければ JPEG を読む */
  ktx2?: { color: string; normal: string; roughness: string; ao?: string; displacement?: string };
}
export type Cc0Index = Record<string, Cc0IndexEntry>;

/** BASE_URL からの相対 */
export const CC0_INDEX_URL = 'cc0/materials/index.json';
export const CC0_MATERIALS_URL = 'cc0/materials/';
/** スマホ向けの縮小版（tools/build-mobile-textures.mjs。Color / NormalGL 512 px・補助 256 px。パスは materials/ と同じ） */
export const CC0_SMALL_MATERIALS_URL = 'cc0/materials-sm/';
export const CC0_INDEX_FILE = 'index.json';

/** 無地素材の既定の 2 層混合（2 層目は 1/0.61 ≈ 1.6 倍の大きさ、位相ずらし） */
export const DEFAULT_BLEND: [number, number, number] = [0.61, 0.31, 0.77];

// 格子に揃うオフセット（テクスチャ 1 枚あたりのタイル数 N → k/N）
const G8: [number, number, number] = [1, 0.375, 0.625];      // 8×8（Tiles107 / Tiles040 / Carpet003）
const G6: [number, number, number] = [1, 0.5, 1 / 3];        // 6×6（OfficeCeiling001 / Tiles141 / dark_paneled_wood）
const G4: [number, number, number] = [1, 0.5, 0.25];         // 4×4（rubber_tiles）
const G12: [number, number, number] = [1, 0.5, 0.25];        // 12×12（Tiles133A / old_linoleum_flooring_01）
const CHECKER: [number, number, number] = [1, 0.5, 0.5];     // 市松（floor_tiles_06）: 2 タイルずらしで白黒の位相を保つ
const PLANK7: [number, number, number] = [1, 0.31, 3 / 7];   // 板 7 列（WoodFloor051）: 板幅方向は k/7、板長方向は自由
const PLANK8: [number, number, number] = [1, 0.31, 0.375];   // 板 8 列（laminate_floor_02）
const BRICK: [number, number, number] = [1, 0.5, 1 / 3];     // 煉瓦 4 個 × 12 段: 半煉瓦・4 段ずらし
const GRAIN: [number, number, number] = [1, 0.37, 0.5];      // 一枚板の木目（Wood049 / Wood051 / walnut）: 拡縮せず位相だけ

export const CC0_VARIANTS: Partial<Record<MatId, Cc0Variant[]>> = {
  // ---- 部屋別ドレッシング（参考画像 Uncommon〜Mythic。第6回）----
  marbleFloor: [{ set: 'Marble012', meters: 1.2, tint: [1, 1, 1], parallax: 0.003 }],
  marbleWhite: [{ set: 'Marble012', meters: 1.2, tint: [1.12, 1.1, 1.06] }],
  // dark_paneled_wood（深い茶の格子パネル）は扉に使うと不自然なため不採用（2026-09-17）。無地のダークウォールナット突板に
  woodPanel: [{ set: 'Wood051', meters: 1, tint: [1.15, 1.12, 1.08], rotate: true, blend: GRAIN, note: 'ダークウォールナット（無地）' }],
  bookshelfWood: [{ set: 'american_walnut_veneer', meters: 1.1, tint: [1, .98, .95] }],
  carpetPattern: [{ set: 'Carpet015', meters: .9, tint: [.62, .58, .62], normalScale: .6 }],
  stainless: [{ set: 'Metal009', meters: .6, tint: [1.05, 1.05, 1.04], metalness: .9 }],
  whiteFabric: [{ set: 'Fabric030', meters: .6, tint: [1.55, 1.55, 1.5], normalScale: .6 }],
  seatRed: [{ set: 'Fabric030', meters: .45, tint: [1.15, .5, .55], normalScale: .6 }],
  lockerBlue: [{ set: 'Metal027', meters: 1, albedo: false, normalScale: .5, metalness: .25 }],
  redShutter: [{ set: 'PaintedMetal013', meters: 1, albedo: false, normalScale: .6, metalness: .3 }],
  // ---- 床: カーペット ----
  floorCarpetGrey: [
    { set: 'Fabric028', meters: 2.4, tint: [.86, .86, .92], normalScale: .5, note: '均一な短毛タイルカーペット（暖灰）' },
    { set: 'Carpet016', meters: 1.5, tint: [.57, .67, .93], normalScale: .6, note: 'ベージュの短毛を灰に補正' },
    // Carpet003（0.5 m の格子タイルカーペット）は「灰色のタイル調の床」に見えるため不採用（2026-09-17）。無地の短毛（暗い青灰を暖灰に補正）に置き換え
    { set: 'Carpet012', meters: 2.0, tint: [1.45, 1.38, 1.22], normalScale: .5, note: '無地の短毛カーペット（青灰を暖灰に補正）' },
  ],
  floorCarpetRed: [
    { set: 'Carpet015', meters: 1, tint: [.7, .82, 1.05], normalScale: .6, note: '織りカーペット' },
    { set: 'Carpet016', meters: 1.5, tint: [.43, .2, .23], normalScale: .6, note: '短毛を赤茶に補正' },
    { set: 'dirty_carpet', meters: 2, tint: [2.2, 1.1, 1.31], normalScale: .6, note: '汚れた暗い赤茶（ホテル廊下）' },
  ],
  // ---- 床: リノリウム（Poly Haven の linoleum を主に、テラゾーは第 3・4 候補） ----
  floorLino: [
    { set: 'linoleum_brown', meters: 2, tint: [1.15, 1.12, 1.05], parallax: .004, note: '茶のリノリウム（学校・病院）' },
    { set: 'old_linoleum_flooring_01', meters: 2.4, tint: [.95, 1, 1.05], blend: G12, parallax: .004, note: '0.2 m 角の古いリノリウムタイル' },
    { set: 'Tiles040', meters: 2.4, tint: [.7, .8, .56], blend: G8, parallax: .01, note: '0.3 m テラゾータイルを緑に補正' },
    { set: 'Terrazzo005', meters: 2, tint: [.89, 1.05, .76], note: '目地の無いテラゾー' },
  ],
  // ---- 床: コンクリート ----
  floorConcrete: [
    { set: 'Concrete048', meters: 2, tint: [1.06, 1.21, 1.4] },
    { set: 'concrete_floor_worn_001', meters: 2.5, tint: [2.2, 2.1, 1.97], note: '摩耗した暗いコンクリート床' },
    { set: 'Concrete034', meters: 2, tint: [1, .98, .87], note: '滑らかな灰' },
  ],
  // ---- 床: タイル ----
  floorTile: [
    { set: 'Tiles107', meters: 2.4, tint: [.82, .86, .78], blend: G8, parallax: .012, note: '0.3 m の白タイル × 8' },
    { set: 'Tiles141', meters: 2.4, tint: [1.09, 1.09, 1.1], blend: G6, parallax: .012, note: '0.4 m の石目タイル × 6' },
    { set: 'floor_tiles_06', meters: 2.4, tint: [1.33, 1.37, 1.4], blend: CHECKER, parallax: .01, note: '0.6 m の大理石市松' },
    { set: 'Tiles133A', meters: 2.4, tint: [1.01, 1.01, 1.01], blend: G12, parallax: .01, note: '0.2 m の青灰モザイク' },
  ],
  // ---- 床: 木 ----
  floorWood: [
    { set: 'WoodFloor051', meters: 1.2, tint: [1.25, 1.3, 1.25], rotate: true, blend: PLANK7, parallax: .005, note: '板幅 ≈ .17 m × 7' },
    { set: 'laminate_floor_02', meters: 1.2, tint: [1.28, 1.4, 1.32], rotate: true, blend: PLANK8, parallax: .004, note: 'オークのラミネート 8 列' },
    { set: 'Wood049', meters: 1.2, tint: [1.22, 1.4, 1.29], rotate: true, blend: GRAIN, note: '無垢板' },
  ],
  floorAsphalt: [{ set: 'Asphalt031', meters: 2, tint: [.5, .52, .55] }],
  // ---- 壁 ----
  wallBeige: [
    { set: 'Wallpaper001A', meters: 1, tint: [.88, .67, .34] },
    { set: 'beige_wall_002', meters: 2, tint: [1.63, 1.8, 1.48], note: '塗装したベージュの壁' },
    { set: 'Wallpaper002A', meters: 1, tint: [.88, .67, .34], note: '細かい織り目の壁紙' },
  ],
  wallWhite: [
    { set: 'PaintedPlaster017', meters: 2, tint: [1.35, 1.28, 1.18], note: '暖かい生成り（0xd8d4c8）へ寄せる' },
    { set: 'painted_plaster_wall', meters: 2, tint: [1.33, 1.4, 1.3], note: '塗装漆喰（刷毛目）' },
    { set: 'Plaster003', meters: 2, tint: [1.02, 1.01, .93], note: '荒い漆喰' },
  ],
  wallCream: [
    { set: 'PaintedPlaster017', meters: 2, tint: [1.4, 1.27, .96], note: '生成りの塗装漆喰（無地）。Plaster001 は斑が強いので 3 番手へ' },
    { set: 'beige_wall_001', meters: 2, tint: [1.58, 1.8, 1.62], note: '塗装したベージュ（明）' },
    { set: 'PaintedPlaster016', meters: 2, tint: [1.8, 1.71, 1.35], note: 'まだらな塗装漆喰' },
    { set: 'Plaster001', meters: 2, tint: [1.12, 1.01, .68], note: '斑の強い漆喰' },
  ],
  wallConcrete: [
    { set: 'Concrete046', meters: 2, tint: [.88, .85, .96] },
    { set: 'Concrete034', meters: 2, tint: [1.1, 1.09, .96] },
    { set: 'concrete_floor_worn_001', meters: 2.5, tint: [2.2, 2.12, 1.98], note: '摩耗した暗いコンクリート' },
  ],
  wallGreen: [
    { set: 'Plaster001', meters: 2, tint: [.4, .52, .36], note: '漆喰を緑に補正' },
    { set: 'painted_concrete', meters: 2, tint: [1.4, .84, 1.01], note: '緑の塗装コンクリート（剥がれ）' },
    { set: 'PaintedPlaster016', meters: 2, tint: [.95, 1.4, 1.12], note: 'まだらな塗装漆喰を緑に補正' },
  ],
  wallDark: [
    { set: 'Plaster007', meters: 2, tint: [.22, .18, .22] },
    { set: 'PaintedPlaster010', meters: 2, tint: [.48, .47, .7], note: '錆色の塗装漆喰を暗く' },
    { set: 'Concrete046', meters: 2, tint: [.18, .15, .2], note: 'コンクリートを暗く' },
  ],
  // 住宅の外壁: 提供素材（AI 生成。assets/generated/1.、tools/build-user-materials.mjs）の日本の窯業系サイディング・タイル・吹付け。1 枚 = 2 m 四方
  sidingWood: [
    { set: 'JP_SidingWoodWhite', meters: 2, tint: [1, 1, 1], note: '木目調サイディング（白）' },
    { set: 'JP_SidingStoneGrey', meters: 2, tint: [1, 1, 1], note: '石目調サイディング（明るい灰）' },
    { set: 'JP_TileBrickBeige', meters: 2, tint: [1, 1, 1], note: 'タイル調サイディング（ベージュ）' },
    { set: 'JP_Fukitsuke', meters: 2, tint: [1, 1, 1], note: 'モルタル吹付け（白）' },
    { set: 'WoodSiding013', meters: 2, tint: [1.5, 1.48, 1.42], note: '木の板張り（灰褐色。CC0）' },
  ],
  sidingMetal: [
    { set: 'JP_SidingRibbedBrown', meters: 2, tint: [1, 1, 1], note: '縦リブのサイディング（焦げ茶）' },
    { set: 'CorrugatedSteel005', meters: 1.5, tint: [1, 1, 1], note: 'トタンの波板（CC0）' },
  ],
  wallBrick: [{ set: 'Bricks101', meters: 1, tint: [.93, .87, .93], blend: BRICK, parallax: .01, note: '煉瓦 約 4 個 × 12 段 ≈ 1 m' }],
  columnConcrete: [
    { set: 'Concrete047A', meters: 2, tint: [1, 1.15, 1.4] },
    { set: 'Concrete046', meters: 2, tint: [.96, .94, 1.02] },
    { set: 'Concrete048', meters: 2, tint: [1.07, 1.25, 1.4] },
  ],
  wainscotCream: [
    { set: 'PaintedPlaster017', meters: 1.2, tint: [.8, .78, .7], note: '壁より 12〜15% 暗く（病院の腰壁との明度差）' },
    { set: 'beige_wall_001', meters: 1.5, tint: [1.2, 1.45, 1.55] },
    { set: 'Plaster003', meters: 1.2, tint: [.81, .77, .62] },
  ],
  // ---- 天井（OfficeCeiling002/003/005/006 は照明・器具が Color に焼き込まれているので不採用。格子の寸法と無地の漆喰で変える） ----
  ceilingWhite: [
    { set: 'OfficeCeiling001', meters: 3.6, tint: [.87, .83, .7], blend: G6, parallax: .015, note: '0.6 m 格子 × 6' },
    { set: 'Plaster003', meters: 2, tint: [1.02, 1.01, .93], note: '目地の無い漆喰天井' },
    { set: 'OfficeCeiling001', meters: 3, tint: [.9, .85, .74], blend: G6, parallax: .015, note: '0.5 m 格子 × 6' },
  ],
  ceilingTile: [
    { set: 'OfficeCeiling001', meters: 3.6, tint: [.81, .83, .74], blend: G6, parallax: .015, note: '0.6 m 格子 × 6' },
    { set: 'OfficeCeiling001', meters: 3, tint: [.84, .84, .76], blend: G6, parallax: .015, note: '0.5 m 格子 × 6' },
    { set: 'PaintedPlaster017', meters: 2, tint: [1.1, 1.08, .98], note: '塗装した平天井' },
  ],
  ceilingDark: [
    { set: 'Concrete034', meters: 2, tint: [.38, .41, .39] },
    { set: 'Concrete046', meters: 2, tint: [.31, .32, .39] },
    { set: 'concrete_floor_worn_001', meters: 2.5, tint: [2.03, 2.13, 2.12] },
  ],
  // ---- 扉・木部・家具（木目が u 方向のセットは rotate） ----
  doorWood: [
    { set: 'Wood049', meters: 1, tint: [1.3, 1.35, 1.3], rotate: true, blend: GRAIN, note: '中間色のオーク' },
    { set: 'laminate_floor_02', meters: 1.2, tint: [1.28, 1.34, 1.4], rotate: true, blend: PLANK8, note: 'オーク突板' },
    { set: 'american_walnut_veneer', meters: 1, tint: [1.4, 1.05, .7], rotate: true, blend: GRAIN, note: 'ウォールナット突板' },
  ],
  trim: [
    { set: 'Wood049', meters: 1, tint: [.95, 1.02, 1.05], rotate: true, blend: GRAIN },
    { set: 'american_walnut_veneer', meters: 1, tint: [1.1, .85, .61], rotate: true, blend: GRAIN },
  ],
  furnitureDark: [
    { set: 'Wood051', meters: 1, tint: [1.3, 1.35, 1.3], rotate: true, blend: GRAIN, note: 'ダークウォールナット' },
    { set: 'laminate_floor_02', meters: 1.2, tint: [.9, .82, .74], rotate: true, blend: PLANK8, note: '暗いオーク突板（格子パネル dark_paneled_wood は不採用）' },
    { set: 'american_walnut_veneer', meters: 1, tint: [1.04, .89, .64], rotate: true, blend: GRAIN },
  ],
  furnitureLight: [
    { set: 'Wood049', meters: 1, tint: [1.3, 1.35, 1.3], rotate: true, blend: GRAIN, note: '明るく補正' },
    { set: 'laminate_floor_02', meters: 1.2, tint: [1.06, 1.27, 1.4], rotate: true, blend: PLANK8 },
    { set: 'american_walnut_veneer', meters: 1, tint: [1.4, 1.2, .84], rotate: true, blend: GRAIN },
  ],
  handrailWood: [
    { set: 'Wood049', meters: 1.1, tint: [.9, .78, .62], rotate: true, blend: GRAIN },
    { set: 'american_walnut_veneer', meters: 1.1, tint: [1.4, .82, .44], rotate: true, blend: GRAIN },
  ],
  // ---- 金属（塗装面は albedo false: 法線・粗さだけ） ----
  metal: [
    { set: 'Metal009', meters: 1, tint: [1.3, 1.3, 1.2], metalness: .9, note: '露出金属' },
    { set: 'Metal038', meters: 1, tint: [1.4, 1.4, 1.34], metalness: .9, note: '暗いヘアライン' },
  ],
  doorMetal: [
    { set: 'Metal027', meters: 1, albedo: false },
    { set: 'PaintedMetal013', meters: 1, albedo: false, normalScale: .6, note: '剥がれのある塗装' },
    { set: 'metal_plate', meters: 1, albedo: false, normalScale: .5, blend: [1, .5, .5], note: '縞鋼板の凹凸（弱）' },
  ],
  shelfMetal: [
    { set: 'Metal038', meters: 1, albedo: false },
    { set: 'Metal027', meters: 1, albedo: false },
    { set: 'PaintedMetal004', meters: 1, albedo: false, normalScale: .6, note: '傷のある塗装' },
  ],
  lockerGreen: [
    { set: 'Metal027', meters: 1, albedo: false, normalScale: .5, metalness: .25 },
    { set: 'PaintedMetal004', meters: 1, albedo: false, normalScale: .5, metalness: .25, note: '傷のある塗装' },
  ],
  metalDark: [
    { set: 'Metal027', meters: .6, albedo: false, normalScale: .6, metalness: .6 },
    { set: 'metal_plate', meters: .6, albedo: false, normalScale: .7, metalness: .6, blend: [1, .5, .5], note: '縞鋼板' },
  ],
  // ---- 布・ゴム・掲示板・屋外 ----
  seatBlue: [
    { set: 'Fabric030', meters: .6, tint: [.55, .7, 1.0], normalScale: .6 },
    { set: 'Fabric022', meters: .6, tint: [1.68, 1.73, 2.2], normalScale: .6, note: '紺の布' },
    { set: 'Carpet012', meters: .8, tint: [.97, 1.58, 2.2], normalScale: .5, note: '紺の短毛' },
  ],
  upholstery: [
    { set: 'Fabric030', meters: .5, tint: [1.4, .62, .53], normalScale: .6 },
    { set: 'Fabric027', meters: .5, tint: [.95, .45, .92], normalScale: .6, note: '籠目織り' },
    { set: 'Leather037', meters: .8, tint: [1.2, 1.2, 1.2], normalScale: .6, note: '暗い革' },
  ],
  noticeGreen: [
    { set: 'Fabric030', meters: .6, tint: [.42, .58, .46], normalScale: .5, note: '緑のフェルト' },
    { set: 'Cork003', meters: .8, tint: [.95, .95, .95], normalScale: .6, note: 'コルク地' },
  ],
  rubber: [
    { set: 'Rubber004', meters: .5, tint: [.8, .8, .57] },
    { set: 'rubber_tiles', meters: 1, tint: [1.29, 1.27, 1], blend: G4, note: 'ゴムタイル' },
  ],
  grass: [{ set: 'Grass005', meters: 2, tint: [.9, .9, .9] }],
  snow: [{ set: 'Snow010A', meters: 2, tint: [1.2, 1.08, 1] }],
  ice: [{ set: 'Marble012', meters: 2, tint: [1.12, 1.4, 1.4] }],
  // boxCardboard / plant / yellowLine / placeholder / signPlate / 発光・ガラス・水・空: CC0 セットが無いので従来の生成テクスチャ
};

/** 互換用: 各 MatId の先頭候補（`variant()` / `get()` が使うもの。旧 `CC0_MATERIALS` と同じ形） */
export const CC0_MATERIALS: Partial<Record<MatId, Cc0Binding>> = Object.fromEntries(
  (Object.entries(CC0_VARIANTS) as [MatId, Cc0Variant[]][]).map(([id, list]) => [id, list[0]]),
) as Partial<Record<MatId, Cc0Binding>>;

/**
 * 部屋ごとの色相・明度ずらしの固定表（トーン番号 = seed から選ぶ）。0 は無変化（共有材質と同じ見え方）。
 * hue: 度、light: 明度の倍率差分（±4%）。材質 clone を部屋ごとに増やさず (MatId, バリエーション, トーン) で共有する。
 */
export const TONE_TABLE: readonly { hue: number; light: number }[] = [
  { hue: 0, light: 0 },
  { hue: 3, light: .04 },
  { hue: -3, light: -.04 },
  { hue: 2, light: -.03 },
  { hue: -2, light: .03 },
];

/** 部屋 seed・MatId・用途から決定論的な 32 bit ハッシュ（FNV-1a）。世界の乱数列は消費しない */
export function variantHash(seed: number, id: string, salt: string): number {
  const key = `${seed >>> 0}|${id}|${salt}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  // 最終混合（連番 seed で下位ビットが偏らないように）
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}
