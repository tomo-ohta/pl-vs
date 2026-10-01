/** 建築用途別の素材・照明パレット。共通PBR素材で全生成器をカバーする。 */
import type { RoomDefinition, TemplateDef } from '../core/types';
import type { Rng } from '../core/rng';
import type { Palette } from './layout';

const BASE: Record<string, Partial<Palette>> = {
  // ビジネスホテル廊下（参考 3）: 低い無地の天井（グリッド天井ではなく塗り天井）
  CorridorHotel: { floor: 'floorCarpetRed', wall: 'wallBeige', ceiling: 'wallWhite', door: 'doorWood' },
  // マンション共用廊下（参考 8）: 軒天は塗り（グリッド天井ではない）
  ApartmentCorridor: { floor: 'floorConcrete', wall: 'wallCream', ceiling: 'wallWhite', door: 'doorMetal' },
  // カラオケ店廊下（参考 17）: 赤茶の布張り壁 + 黒い扉
  CorridorEntertainment: { floor: 'floorCarpetRed', wall: 'upholstery', ceiling: 'ceilingDark', door: 'metalDark' },
  // オフィス廊下（参考 2）: ベージュ無地の壁（wallBeige）。wallCream は CC0 の Plaster001 の斑が強く「無地」に見えないため不採用。
  // 担当 M が wallWhite 自体を暖かい生成りへ寄せるので、wallWhite のままの待合室 / 休憩室 / 汎用廊下と二重に暗くしない
  CorridorOffice: { floor: 'floorCarpetGrey', wall: 'wallBeige', ceiling: 'ceilingTile', door: 'doorWood' },
  CorridorSchool: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  // 病院外来廊下（参考 5）: 生成りの壁 + wainscotCream の腰壁 + 木目の手すり
  CorridorHospital: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingTile', door: 'doorWood' },
  CorridorService: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  // 駅の連絡通路 / 地下歩道（参考 7・19）: 白タイルの壁
  TransitCorridor: { floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', door: 'doorMetal' },
  GenericCorridor: { floor: 'floorCarpetGrey', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  Bridge: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  LargeRoom: { floor: 'floorCarpetGrey', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorWood' },
  SmallRoom: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  GenericRoom: { floor: 'floorLino', wall: 'wallWhite', ceiling: 'ceilingWhite', door: 'doorWood' },
  Classroom: { floor: 'floorWood', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  Restroom: { floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', door: 'doorWood' },
  LockerRoom: { floor: 'floorTile', wall: 'wallGreen', ceiling: 'ceilingWhite', door: 'doorMetal' },
  RetailRoom: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'glass' },
  Theater: { floor: 'floorCarpetRed', wall: 'wallDark', ceiling: 'ceilingDark', door: 'doorWood' },
  Gallery: { floor: 'floorWood', wall: 'wallWhite', ceiling: 'ceilingWhite', door: 'doorWood' },
  OfficeGrid: { floor: 'floorCarpetGrey', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorWood' },
  PlayArea: { floor: 'floorCarpetRed', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  OrganicZone: { floor: 'floorConcrete', wall: 'glass', ceiling: 'glass', door: 'doorMetal' },
  ParkingGrid: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  WarehouseGrid: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  ShelfGrid: { floor: 'floorWood', wall: 'wallCream', ceiling: 'ceilingTile', door: 'doorWood' },
  RetailGrid: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'glass' },
  StorageGrid: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  MazeGrid: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingTile', door: 'doorMetal' },
  ServerGrid: { floor: 'floorLino', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorMetal' },
  ServiceMaze: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  AtriumLobby: { floor: 'floorTile', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood' },
  Terminal: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'glass' },
  VerticalCore: { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  // Phase 2 の新 Generator（各 Generator は layout.palette を自分でも上書きする。ここは paletteFor を直接読む側・前室との整合用）
  PoolCorridor: { floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', door: 'doorMetal' },
  DynamicGrid: { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorMetal' },
  StreetGrid: { floor: 'floorAsphalt', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
  RoadGraph: { floor: 'floorAsphalt', wall: 'wallConcrete', ceiling: 'ceilingDark', door: 'doorMetal' },
};

/** 廊下系テンプレートの照明（器具の種類・色・強さ・環境光）。lightingPreset の語による推定より優先する
 *  （docs/reference-common-analysis.md: 器具の列は全体で少し暗め、ホテル / カラオケは暖色の点光源、病院は高照度の白） */
const CORRIDOR_LIGHT: Record<string, Partial<Palette>> = {
  CorridorOffice: { light: 'lightPanel', lightColor: 0xe9f0ff, lightIntensity: 1.0 },
  CorridorSchool: { light: 'lightPanel', lightColor: 0xdde8ff, lightIntensity: 0.85 },
  CorridorHospital: { light: 'lightPanel', lightColor: 0xf3f6ff, lightIntensity: 1.15, ambient: 0x9a9eaa },
  CorridorHotel: { light: 'lightWarm', lightColor: 0xffc98a, lightIntensity: 0.7, ambient: 0x6b5a47 },
  CorridorEntertainment: { light: 'lightWarm', lightColor: 0xffb070, lightIntensity: 0.5, ambient: 0x3a2826, fog: 0x0c0608 },
  CorridorService: { light: 'lightPanel', lightColor: 0xe2ecff, lightIntensity: 0.9 },
  ApartmentCorridor: { light: 'lightWarm', lightColor: 0xffd9a0, lightIntensity: 0.7, ambient: 0x6e6658 },
  TransitCorridor: { light: 'lightPanel', lightColor: 0xf0f4ff, lightIntensity: 1.0 },
};

const DEFAULT: Palette = {
  floor: 'floorCarpetGrey', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood',
  light: 'lightPanel', lightColor: 0xdfe8ff, lightIntensity: 1.0, ambient: 0x8a90a0, fog: 0x0b0d14,
};

export function paletteFor(def: RoomDefinition, template: TemplateDef, fallback: boolean): Palette {
  const base = { ...DEFAULT, ...(BASE[template.id] ?? BASE[template.baseTemplate ?? ''] ?? {}) };
  const l = def.lightingPreset;
  if (/暖色|電球|橙|夕|琥珀/.test(l)) {
    base.light = 'lightWarm';
    base.lightColor = 0xffd9a0;
    base.ambient = 0x8f7a60;
  } else if (/冷白|蛍光|白色|均一/.test(l)) {
    base.light = 'lightPanel';
    base.lightColor = 0xe9f0ff;
    base.ambient = 0x8a90a0;
  }
  if (/低照度|暗|一部消灯|非常灯|薄明/.test(l)) {
    base.lightIntensity = 0.55;
    base.ambient = 0x50545e;
  }
  if (/青|水族|水中/.test(l)) {
    base.lightColor = 0x9fc8ff;
    base.fog = 0x0a1a33;
  }
  Object.assign(base, CORRIDOR_LIGHT[template.id] ?? CORRIDOR_LIGHT[template.baseTemplate ?? ''] ?? {});
  if (fallback) {
    base.floor = 'placeholder';
    base.wall = 'wallWhite';
  }
  return base;
}

// ---------------------------------------------------------------- 色温度（V04 手順 9。担当 P1）
/**
 * テンプレート別の色温度範囲 [Kmin, Kmax]（ケルビン）。同じテンプレートでも部屋ごとに 1 値を選び、同じ白が全室に並ばないようにする。
 * 範囲は狭く（2,700〜5,000 K の中で 300〜700 K 幅）: オフィス 4,000〜4,600 / 学校 3,800〜4,400 / 病院 4,300〜5,000 / ホテル 2,700〜3,100 /
 * 住居 2,800〜3,200 / 地下・設備 3,400〜4,000 / 店舗 3,600〜4,200 / 駐車場 3,900〜4,500。キーは template.id（無ければ baseTemplate）
 */
export const KELVIN_RANGE: Record<string, [number, number]> = {
  // 廊下系
  CorridorOffice: [4000, 4600],
  CorridorSchool: [3800, 4400],
  CorridorHospital: [4300, 5000],
  CorridorHotel: [2700, 3100],
  CorridorEntertainment: [2700, 3000],
  CorridorService: [3400, 4000],
  ApartmentCorridor: [2800, 3200],
  TransitCorridor: [3900, 4500],
  GenericCorridor: [3700, 4300],
  Bridge: [3400, 4000],
  PoolCorridor: [4000, 4600],
  // 部屋系
  LargeRoom: [3900, 4500],
  SmallRoom: [3700, 4300],
  GenericRoom: [3800, 4400],
  Classroom: [3800, 4400],
  Restroom: [4000, 4600],
  LockerRoom: [3800, 4400],
  RetailRoom: [3600, 4200],
  Theater: [2700, 3100],
  Gallery: [3200, 3800],
  OfficeGrid: [4000, 4600],
  PlayArea: [3000, 3600],
  OrganicZone: [3600, 4200],
  ParkingGrid: [3900, 4500],
  WarehouseGrid: [3600, 4200],
  ShelfGrid: [3300, 3900],
  RetailGrid: [3600, 4200],
  StorageGrid: [3400, 4000],
  MazeGrid: [3600, 4200],
  ServerGrid: [4200, 4800],
  ServiceMaze: [3400, 4000],
  AtriumLobby: [3400, 4000],
  Terminal: [3900, 4500],
  VerticalCore: [3400, 4000],
  DynamicGrid: [3800, 4400],
  StreetGrid: [3400, 4000],
  RoadGraph: [3400, 4000],
};
/** lightingPreset の語で決まる範囲（テンプレートより優先。暖色系の語は器具が lightWarm になるので必ず電球色の帯に入れる） */
const KELVIN_BY_PRESET: [RegExp, [number, number]][] = [
  [/暖色|電球|橙|夕|琥珀/, [2700, 3100]],
  [/冷白|均一/, [4200, 4800]],
  [/蛍光|白色/, [3900, 4500]],
];
const KELVIN_DEFAULT: [number, number] = [3800, 4400];
/** ホワイトバランス。この色温度が無彩色の白になる（4,600 K: 既存パレットの「病院 0xf3f6ff がわずかに青、ホテル 0xffc98a が電球色」に一致） */
const KELVIN_WHITE_BALANCE = 4600;

/** 黒体近似（Tanner Helland の式）。ケルビン → 0..1 の RGB（白バランス無し。6,600 K 付近が白） */
export function blackbodyRgb(kelvin: number): [number, number, number] {
  const t = Math.min(400, Math.max(10, kelvin / 100));
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

/** ケルビン → 器具色（0xRRGGBB）。白バランス KELVIN_WHITE_BALANCE で割り、最大チャンネルを 1 に正規化する（明るさは色温度で変えない） */
export function kelvinToLightColor(kelvin: number, whiteBalance = KELVIN_WHITE_BALANCE): number {
  const c = blackbodyRgb(kelvin);
  const w = blackbodyRgb(whiteBalance);
  const rgb = [c[0] / Math.max(1e-3, w[0]), c[1] / Math.max(1e-3, w[1]), c[2] / Math.max(1e-3, w[2])];
  const m = Math.max(rgb[0], rgb[1], rgb[2], 1e-3);
  const q = (v: number) => Math.round(Math.min(1, Math.max(0, v / m)) * 255);
  return (q(rgb[0]) << 16) | (q(rgb[1]) << 8) | q(rgb[2]);
}

/** この定義・テンプレートに使う色温度範囲。青系の演出（水族館・水中）や器具が lightPanel / lightWarm 以外の部屋は null（色温度化しない） */
export function kelvinRangeFor(def: RoomDefinition, template: TemplateDef, palette: Palette): [number, number] | null {
  if (palette.light !== 'lightPanel' && palette.light !== 'lightWarm') return null;
  const l = def.lightingPreset;
  if (/青|水族|水中/.test(l)) return null;
  for (const [re, range] of KELVIN_BY_PRESET) if (re.test(l)) return range;
  return KELVIN_RANGE[template.id] ?? KELVIN_RANGE[template.baseTemplate ?? ''] ?? KELVIN_DEFAULT;
}

/**
 * 部屋ごとの色温度を選んで palette.lightColor（と ambient の色味）を決める。generateLayout が Generator の前に呼ぶ
 * （生成 → dressing → Modifier の順なので、Mythic / Legendary のドレッシングや FakeSky / LightingPhase / EraPreset の上書きはそのまま残る）。
 * rng は専用 fork（p.rng.fork('kelvin')）を渡す: 既存の乱数列を消費せず、他の生成結果は変わらない。
 * ambient は既存の色（テンプレートの雰囲気）を保ちつつ 45% だけ器具色へ寄せる（焼き込みの環境光と半球光が器具色に追従する）。
 * 戻り値は選んだケルビン（対象外なら null）
 */
export function applyLightKelvin(palette: Palette, def: RoomDefinition, template: TemplateDef, rng: Rng): number | null {
  const range = kelvinRangeFor(def, template, palette);
  if (!range) return null;
  const kelvin = Math.round(rng.float(range[0], range[1]) / 10) * 10;
  palette.lightColor = kelvinToLightColor(kelvin);
  palette.ambient = tintTowards(palette.ambient, palette.lightColor, 0.45);
  return kelvin;
}

/** base の輝度を保ちつつ色味を tint へ k だけ寄せる */
function tintTowards(base: number, tint: number, k: number): number {
  const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255;
  const tr = (tint >> 16) & 255, tg = (tint >> 8) & 255, tb = tint & 255;
  const lum = 0.299 * br + 0.587 * bg + 0.114 * bb;
  const tl = Math.max(1, 0.299 * tr + 0.587 * tg + 0.114 * tb);
  const s = lum / tl;
  const mix = (b: number, t: number) => Math.round(Math.min(255, Math.max(0, b * (1 - k) + t * s * k)));
  return (mix(br, tr) << 16) | (mix(bg, tg) << 8) | mix(bb, tb);
}

