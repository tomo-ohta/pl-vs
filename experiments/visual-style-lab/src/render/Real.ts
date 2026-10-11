import { styleUniforms } from './Style.ts';

/**
 * リアルな照明（試し）。ボタン 1 つ（J キー・パネル・URL の real=1）で、場面の作りはそのままに照明の見せ方だけを写実寄りにする。
 * 切っているときは今までの塗りの照明（段落とし・クワハラ・線）のままで、材質の計算も描画の結果も変わらない。
 *
 * 入れる手法（docs/09-realistic-lighting.md）:
 * - 材質: 段落としを止めて、なめらかな照明。環境光を弱め、日光と灯りを強める（光源の近くが明るく、無い所は暗い）。
 *   灯りは距離の 2 乗で弱まる（端で 0 になる窓付き。UE4 の減衰）。光る面（照明を使わない明るい面）は HDR へ持ち上げる
 * - 画面: 物の隅の暗さ（SAO）・光芒（日光の影の地図を視線に沿って調べる体積光）・灯りのまわりの空気の光（点光源の散乱を式で積分）・
 *   スポットライトの光の円錐・しきい値の無いブルーム（何段にもぼかして混ぜる）・自動露出（明るさの対数平均に目を慣らす）・色の濃さを保つトーン（Khronos PBR Neutral）
 */
export interface RealSettings {
  enabled: boolean;
  /** 環境光（半球光・照り返し）の倍率。小さいほど光源の無い所が暗い */
  ambient: number;
  /** 日光（平行光源・スポット）の倍率 */
  sun: number;
  /** 灯り（ctx.addLamp）の強さの倍率 */
  lamps: number;
  /** 灯りの届く距離の倍率 */
  lampRange: number;
  /** 光る面（照明を使わない明るい面・照明器具・画面）の明るさの倍率（ブルームで光る） */
  emissive: number;
  /** 照明器具（照明を使わない明るい小さな面）を灯りにする */
  fixtures: boolean;
  /** 塗りの材質（淡色の廊下・校舎の間）の、灯りの無い所の明るさ */
  paint: number;
  /** 環境光に空の色（場面の霧の天頂の色）を帯びさせる割合（屋外の陰の青み） */
  skyTint: number;
  /** 光芒（日光の筋）の強さ */
  shafts: number;
  /**
   * 光芒の基準（0〜1）。0 = 日の当たる空気をそのまま明るくする（室内の窓からの筋）。
   * 1 = 場面の霧を「日の当たった空気」とみなし、影の中を通る所だけ暗くする（屋外で一面の白い膜にならない）
   */
  shaftBase: number;
  /** 灯りのまわりの空気の光（グロウ）の強さ */
  airGlow: number;
  /** スポットライトの光の円錐の強さ */
  beams: number;
  /** 空気の濃さ（光芒・グロウの散乱の量。1/m） */
  density: number;
  /** 前方散乱（0 = どの向きにも同じ、0.8 = 光源の方を見ると強い） */
  anisotropy: number;
  /** 光芒を調べる距離（m） */
  maxDist: number;
  /** ブルーム（明るい所のにじみ）の混ぜる割合 */
  bloom: number;
  /** 物の隅の暗さ（AO）の強さと半径（m） */
  ao: number;
  aoRadius: number;
  /** 自動露出（false で exposure の値のまま） */
  autoExposure: boolean;
  /** 露出の補正（EV。+1 で 2 倍明るい） */
  exposure: number;
  /** 線を残す割合（0 で消す） */
  lines: number;
  /** 場面の色調整（彩度・色相・色の偏り）を残す割合 */
  grade: number;
}

export const DEFAULT_REAL: RealSettings = {
  enabled: false,
  ambient: 0.4,
  sun: 1.25,
  lamps: 2.5,
  lampRange: 1.6,
  emissive: 3,
  fixtures: true,
  paint: 0.55,
  skyTint: 0.6,
  shafts: 1,
  shaftBase: 0,
  airGlow: 0.4,
  beams: 1,
  density: 0.01,
  anisotropy: 0.5,
  maxDist: 40,
  bloom: 0.08,
  ao: 0.7,
  aoRadius: 0.6,
  autoExposure: true,
  exposure: 0,
  lines: 0,
  grade: 1,
};

/** 数値の項目（パネル・URL の上書き用。名前・最小・最大・刻み） */
export const REAL_SLIDERS: { key: keyof RealSettings; label: string; min: number; max: number; step: number }[] = [
  { key: 'exposure', label: '露出の補正（EV）', min: -3, max: 3, step: 0.1 },
  { key: 'ambient', label: '環境光', min: 0, max: 1.5, step: 0.05 },
  { key: 'sun', label: '日光', min: 0, max: 4, step: 0.1 },
  { key: 'lamps', label: '灯り', min: 0, max: 8, step: 0.1 },
  { key: 'lampRange', label: '灯りの届く距離', min: 0.5, max: 4, step: 0.1 },
  { key: 'emissive', label: '光る面', min: 1, max: 10, step: 0.5 },
  { key: 'skyTint', label: '陰の空の色', min: 0, max: 1, step: 0.05 },
  { key: 'shafts', label: '光芒', min: 0, max: 4, step: 0.1 },
  { key: 'airGlow', label: '空気の光（グロウ）', min: 0, max: 4, step: 0.1 },
  { key: 'beams', label: 'スポットの光の円錐', min: 0, max: 4, step: 0.1 },
  { key: 'density', label: '空気の濃さ', min: 0, max: 0.2, step: 0.005 },
  { key: 'bloom', label: 'ブルーム', min: 0, max: 0.3, step: 0.01 },
  { key: 'ao', label: '物の隅の暗さ（AO）', min: 0, max: 1.5, step: 0.05 },
  { key: 'lines', label: '線を残す', min: 0, max: 1, step: 0.05 },
];

/**
 * 場面ごとの既定の上書き（場面のファイルは触らずにここで決める）。
 * 室内で平行光源を天井の明かりの代わりにしている場面は、日光を弱めて灯りで照らす（光芒は出さない）
 */
export const REAL_SCENES: Record<string, Partial<RealSettings>> = {
  // 屋外（霧の濃い場面）: 空気を薄く（光芒が一面の白い膜にならないように）
  station: { density: 0.004 },
  alley: { density: 0.004, paint: 0.7 },
  whiteroom: { density: 0.003 },
  squareroom: { density: 0.005, shafts: 0.8 },
  // 室内で平行光源を天井の明かりの代わりにしている場面: 日光を弱め、灯りで照らす
  corridor: { sun: 0.7, lamps: 4 },
  // 窓の外（海）が白く飛ばないように露出を少し下げる
  // 窓の外（日の当たる海）の空気を数えないように、光芒を調べる距離を教室の大きさまでにする
  classroom: { exposure: -0.2, maxDist: 9 },
  // 塗りの場面
  pastel: { paint: 0.7 },
  // 灯りの多い室内: 空気の光を控えめに
  serverroom: { airGlow: 0.25 },
  waterpark: { airGlow: 0.2 },
  planetarium: { airGlow: 0.1, beams: 0.4, density: 0.01, exposure: -0.6 },
};

export function realFor(sceneId: string | undefined, base: Partial<RealSettings> = {}): RealSettings {
  return { ...DEFAULT_REAL, ...(sceneId ? REAL_SCENES[sceneId] : {}), ...base };
}

/** 材質が使う値を uniform へ */
export function applyRealUniforms(r: RealSettings): void {
  const u = styleUniforms;
  u.uReal.value = r.enabled ? 1 : 0;
  u.uRealLight.value.set(r.ambient, r.sun, r.lamps, r.lampRange);
  u.uRealExtra.value.set(r.emissive, r.paint, r.skyTint, 0);
}
