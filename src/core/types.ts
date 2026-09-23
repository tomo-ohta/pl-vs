/** 仕様書 11 章 / 設計表 05 シートに対応する型 */

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
export const RARITIES: readonly Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

export type PortalType =
  | 'door' | 'stairs' | 'elevator' | 'escalator' | 'hole' | 'ladder' | 'tunnel' | 'water'
  | 'train' | 'boat' | 'street' | 'path' | 'ramp' | 'gate' | 'bridge';

export interface ModifierRef {
  id: string;
  params?: Record<string, unknown>;
}

export interface RoomDefinition {
  id: string;
  rarity: Rarity;
  weight: number;
  name: string;
  category: string;
  baseTemplate: string;
  generator: string;
  lightingPreset: string;
  audioPreset: string;
  primaryPortal: PortalType;
  minExits: number;
  maxExits: number;
  connectionRule: string;
  mapShape: string;
  /** 参考タグ。実装は参照しない（D2） */
  dangerTag?: number;
  effectLabel: string;
  modifiers: ModifierRef[];
  layoutHints: string[];
  recipe?: string;
  notes?: string | null;
}

export interface TemplateDef {
  id: string;
  generator: string;
  kind: 'base' | 'derived';
  baseTemplate: string | null;
  phase: number;
  use: string;
  modules: string;
  dimensions: string;
  portalSockets: string;
  parameters: string;
  mobileNotes: string;
}

/** 0:+Z 1:+X 2:-Z 3:-X。yaw の 1/4 回転数と同じ単位 */
export type Dir = 0 | 1 | 2 | 3;
export type Vec3 = [number, number, number];

export interface Socket {
  id: string;
  type: PortalType;
  /** ローカル座標。壁面の床位置（hole は床面の中心） */
  pos: Vec3;
  /** 外向き方向 */
  dir: Dir;
  width: number;
  height: number;
  /** 開口の下端の高さ（床から）。0 なら床面。E03 横倒し扉の「高い横長スロット」に使う */
  sill?: number;
  /** しゃがんで通る低い開口（高さ 1.0〜1.2 m）。R16 小型扉 / E03 横倒し扉 */
  crawl?: boolean;
}

export interface MapCell {
  gx: number;
  gy: number;
  w: number;
  h: number;
  rot: 0 | 90 | 180 | 270;
  projected: boolean;
  /** 階層（y / 3.6 を丸めたもの）。地図の重なり判定に使う */
  level: number;
  /** 多層の巨大部屋が占めるフロア数（既定 1） */
  levelSpan?: number;
  /** 地図から隠す（MapErase）。発見数は減らさない */
  hidden?: boolean;
}

export interface Placement {
  position: Vec3;
  yawQ: Dir;
}

export interface Portal {
  portalId: string;
  type: PortalType;
  socketId: string;
  targetRoomId?: string;
  targetPortalId?: string;
  locked: boolean;
  oneWay: boolean;
  /** true: 通過時に座標遷移（hole / elevator / Epic 以上）。物理配置しない */
  seam: boolean;
  open: boolean;
  closeDelaySec: number;
  /** 戻り Portal（親へ） */
  isReturn: boolean;
  /** 地図に投影できたか（false なら「？」） */
  projected: boolean;
  /** 通過した時刻（自動閉扉用）。runtime */
  passedAt?: number;
  /** 遠距離接続（FarLink / FakeExit）。Seam で一方通行 */
  far?: boolean;
  /** MultiEdge: 開閉状態を共有する主 Portal の id */
  mirrorOf?: string;
  /** しゃがんで通る低い開口 */
  crawl?: boolean;
  /** VehicleRide: 乗車 Portal（到着先は初回乗車で確定） */
  ride?: boolean;
  /** 扉パネル付きの床穴（E03 GravityAxis）。閉じている間（open=false）は歩いて渡れ、下の部屋は見えない。開けると落ちる */
  covered?: boolean;
}

export interface RoomStateDiff {
  openedDoors: string[];
  localFlags: Record<string, unknown>;
  /** Modifier ごとの永続状態（JSON 化可能な値のみ） */
  modifierState?: Record<string, unknown>;
}

/** crawl: しゃがみ通路（片側が低い開口、反対側が通常扉） / platform: 乗り物の到着ホーム */
export type AdapterKind = 'vestibule' | 'stairs' | 'ramp' | 'elevatorCar' | 'crawl' | 'platform';

export interface AdapterSpec {
  kind: AdapterKind;
  /** stairs/ramp/elevatorCar: 上(+1)/下(-1)。vestibule は 0 */
  direction: 1 | -1 | 0;
  /** vestibule: 転回（0 直進 / 1 右 / 3 左） */
  turn: 0 | 1 | 3;
  length: number;
  /** パレットを借りる部屋 */
  paletteFrom: string;
}

export interface EntryReq {
  type: PortalType;
  width: number;
  /** 通常扉以外の開口（低い開口・高いスロット） */
  height?: number;
  sill?: number;
  crawl?: boolean;
}

export interface RoomInstance {
  roomId: string;
  /** RoomDefinition.id。アダプタは 'ADAPTER' */
  definitionId: string;
  seed: number;
  depth: number;
  portals: Portal[];
  mapCell?: MapCell;
  placement?: Placement;
  visited: boolean;
  isAdapter: boolean;
  adapter?: AdapterSpec;
  parentRoomId?: string;
  entryPortalId?: string;
  /** 入口ソケット要件（レイアウト再生成に必要） */
  entryReq: EntryReq | null;
  /** 戻り以外の出口数 */
  exitCount: number;
  /** 配置試行のバリアント（サイズ・形状・入口位置）。決定論のため保存する */
  variant: number;
  /** 部屋同士の直結で後から追加された壁面ソケット（ローカル座標） */
  extraSockets: Socket[];
  /** 行き先を置けず取り除いた出口ソケット id（施錠扉を減らす） */
  removedSockets: string[];
  /** 空き空間へ成長させた主矩形（ローカル。生成器がサイズの代わりに使う） */
  mainRect?: { x0: number; z0: number; x1: number; z1: number };
  /** 床穴の位置（ローカル）。真下に部屋を置いた後はレイアウトを再生成しても動かさない */
  holeLocal?: Vec3;
  /** 未実装 Generator の定義を LargeRoom で代替したか */
  fallback: boolean;
  /** hole 到達などで親への戻りが無い部屋 */
  entryIsReturn: boolean;
  /** 特別な役割（例: 'loop' LoopTopology の周期ノード、'interior' NonEuclidean の内部、'repeat' RepeatDestination の反復先） */
  role?: string;
  /** RepeatDestination: 何回目の反復か（0 起点） */
  repeat?: number;
  /** 抽選を固定して生成した定義（?force= や Modifier による強制）。決定論のため保存する */
  forcedDefinitionId?: string;
  state: RoomStateDiff;
}

export interface GeneratorContext {
  worldSeed: number;
  depth: number;
  recentRarities: Rarity[];
  discoveredIds: Set<string>;
  visitedCount: number;
  roomsSinceRare: number;
}

export type QualityTierId = 'low' | 'mid' | 'high';
/** ポスト処理（EffectComposer）の Tier 別機能。gtao / bloom が false で msaa 0 なら直接描画（src/render/PostFX.ts） */
export interface PostFxTier {
  /** 画面空間の遮蔽（GTAOPass） */
  gtao: boolean;
  /** 控えめなブルーム（UnrealBloomPass） */
  bloom: boolean;
  /** composer の RenderTarget の MSAA サンプル数（0 = なし） */
  msaa: number;
  /** GTAO の解像度倍率（0.5 = 半解像度） */
  gtaoScale: number;
}
export interface QualityTier {
  id: QualityTierId;
  renderScale: number;
  /** ポスト処理（composer）使用時の devicePixelRatio 上限（直接描画は従来どおり 2）。HiDPI で GTAO / bloom / MSAA の負荷を抑える */
  maxPixelRatio: number;
  maxLights: number;
  /** 視程の上限（scene.fog.far のクランプ・チャンク表示・camera.far） */
  fogFar: number;
  /** 霧の既定値（Game.applyEnvironment。部屋別 fog / layout.fogFar / FogDepth が無いときの near / far。far ≤ fogFar） */
  fogNear: number;
  fogDefaultFar: number;
  /** 影を落とす可視 PointLight の数（プレイヤーに近い順。0 = 影なし）と影マップの一辺（px。PointLight はキューブの各面） */
  shadowLights: number;
  shadowMapSize: number;
  postfx: PostFxTier;
  /** RenderTarget（監視映像・スナップショット）の更新頻度（Hz）。0 は静止キャプチャのみ */
  rtUpdateHz: number;
  /** 照明の明滅アニメーションを許可 */
  flicker: boolean;
  /** 水たまり・デカールなどの装飾箔を出す */
  decals: boolean;
  /** InstancedMesh の個数倍率（0〜1） */
  instanceScale: number;
  /** パーティクル上限 */
  particleCap: number;
  /** 残響に Convolver を使う（false ならフィードバックディレイ） */
  convolver: boolean;
}
export const QUALITY_TIERS: Record<QualityTierId, QualityTier> = {
  low: {
    id: 'low', renderScale: 0.65, maxPixelRatio: 2, maxLights: 2, fogFar: 40, fogNear: 6, fogDefaultFar: 40, shadowLights: 0, shadowMapSize: 0,
    rtUpdateHz: 0, flicker: false, decals: false, instanceScale: 0.4, particleCap: 150, convolver: false,
    postfx: { gtao: false, bloom: false, msaa: 0, gtaoScale: 0.5 },
  },
  mid: {
    id: 'mid', renderScale: 0.8, maxPixelRatio: 2, maxLights: 4, fogFar: 60, fogNear: 6, fogDefaultFar: 44, shadowLights: 1, shadowMapSize: 512,
    rtUpdateHz: 15, flicker: true, decals: true, instanceScale: 0.7, particleCap: 400, convolver: true,
    postfx: { gtao: false, bloom: true, msaa: 2, gtaoScale: 0.5 },
  },
  high: {
    id: 'high', renderScale: 1.0, maxPixelRatio: 1.25, maxLights: 8, fogFar: 90, fogNear: 6, fogDefaultFar: 48, shadowLights: 1, shadowMapSize: 1024,
    rtUpdateHz: 60, flicker: true, decals: true, instanceScale: 1.0, particleCap: 1000, convolver: true,
    postfx: { gtao: true, bloom: true, msaa: 2, gtaoScale: 0.4 },
  },
};

/**
 * スマホ（pointer: coarse）で使う Tier の上書き。PC より小さい GPU で同じ部屋を描くための差分だけを持つ。
 * - 画素密度は CSS ピクセル 1:1 まで（HiDPI の 2〜3 倍は撮像効果の軟焦点・走査線で見分けられない）
 * - 影（PointLight のキューブ影 = シーンを 6 回追加描画）・MSAA・GTAO は切る。ブルームは mid 以上だけ残す
 * - 監視映像・スナップショットの RenderTarget 更新は 10 Hz まで
 */
export function mobileTier(t: QualityTier): QualityTier {
  return {
    ...t,
    renderScale: t.id === 'low' ? 0.75 : 1.0,
    maxPixelRatio: 1,
    shadowLights: 0,
    shadowMapSize: 0,
    rtUpdateHz: Math.min(t.rtUpdateHz, 10),
    postfx: { ...t.postfx, gtao: false, msaa: 0 },
  };
}

export function dirVec(d: Dir): Vec3 {
  switch (d) {
    case 0: return [0, 0, 1];
    case 1: return [1, 0, 0];
    case 2: return [0, 0, -1];
    case 3: return [-1, 0, 0];
  }
}

export function addDir(a: Dir, b: number): Dir {
  return ((((a + b) % 4) + 4) % 4) as Dir;
}

/** ローカル座標を yawQ (1/4 回転) だけ回す。THREE の rotation.y = yawQ * PI/2 と一致 */
export function rotQ(v: Vec3, q: Dir): Vec3 {
  let [x, y, z] = v;
  for (let i = 0; i < q; i++) {
    const nx = z;
    const nz = -x;
    x = nx;
    z = nz;
  }
  return [x, y, z];
}

export function toWorld(p: Placement, local: Vec3): Vec3 {
  const r = rotQ(local, p.yawQ);
  return [r[0] + p.position[0], r[1] + p.position[1], r[2] + p.position[2]];
}

export function toLocal(p: Placement, world: Vec3): Vec3 {
  const d: Vec3 = [world[0] - p.position[0], world[1] - p.position[1], world[2] - p.position[2]];
  return rotQ(d, ((4 - p.yawQ) % 4) as Dir);
}
