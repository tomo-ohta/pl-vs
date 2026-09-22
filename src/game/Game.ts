/**
 * ゲームループと状態遷移。RoomGraph 正本 / 1 hop 物理配置 / 意図的 Seam 遷移（hole, elevator, ride, far）/ 地図 / HUD / セーブ。
 *
 * v1.3 で配線したもの（統合担当）:
 * - しゃがみ（InputState.crouch → PlayerController）、ゾーン（BuiltRoom.zones → PlayerZone）、乗車（PlayerRide, state 'riding'）、PlayerProxy
 * - Modifier パイプライン: world.nodeHooks / connectHooks（notifyNodeCreated / collectConnectDirective）、enterRoom の runExit / runEnter、
 *   step の runUpdate（現在 + 可視部屋）と BuiltRoom.effects、扉の checkCanOpen
 * - 環境: 入室時に fog / background / hemi を 0.8 s 補間（BuiltRoom.fog → layout.render.fog → palette.fog）。部屋別 fog（材質 variant）は RoomBuilder 側
 * - 音: AudioEngine（unlock は開始クリック、setRoom は入室、setListener / update は毎フレーム、扉・足音・着地・エレベーター）
 * - 設定: Settings / SettingsPanel（音量・視点感度・Tier の復元）
 * - カメラ挙動（担当 F2。docs/film-camera.md）: 設定 handheld / cameraLag / postfx を PlayerController.feel に写し、乗車中と E03 では
 *   cameraFeelSuppressed で揺れを止める。毎フレーム 表示カメラの回転速度 → postfx.setCameraMotion、静止秒数 → setStillness /
 *   player.setStillness、環境音の大きさ → setAudioNoise、入室 → notifyRoomEnter、REC 表示（RecOverlay）の表示切替と update
 * - 地図: mapView（MapViewState。Modifier が rotation / hiddenRoomIds を書く）を Minimap / MapPanel へ
 * - Seam: `portal.seam && type === 'door'` は全て意図的 Seam（緊急 Seam は廃止）。置けない進行用扉は施錠（dead-end lock）
 *
 * Phase 2（Modifier 実装）向け: RuntimeContext.game（GameServices）から proxy / snapshots / ride / mapView / startRide / transition を使う。
 * 開発用: `game.devInput = { crouch: true }` で入力を上書き（テスト。null で解除）。`game.step(1/60)` は同期 1 フレーム。
 */
import * as THREE from 'three';
import { aabbContains } from '../core/aabb';
import { QUALITY_TIERS, dirVec, toWorld, type QualityTier, type QualityTierId, type Rarity, type RoomDefinition, type RoomInstance, type Portal, type Vec3 } from '../core/types';
import { randomWorldSeed } from '../core/rng';
import { ROOM_BY_ID } from '../data';
import { InputController, type InputState } from '../input/InputController';
import { PlayerController, type PlayerZone } from '../player/PlayerController';
import { PlayerRide } from '../player/PlayerRide';
import { PlayerProxy } from '../player/PlayerProxy';
import { MaterialLibrary, L2_FLAGS } from '../render/MaterialLibrary';
import { PostFX, TONE_MAPPINGS, DEFAULT_EXPOSURE, type PostFXConfig } from '../render/PostFX';
import { VIDEO_PRESETS } from '../render/VideoPass';
import type { FilmPreset } from '../render/FilmPreset';
import { PlayerFlashlight } from '../render/PlayerFlashlight';
import { RecOverlay } from '../ui/RecOverlay';
import { RoomBuilder, type BuiltRoom } from '../render/RoomBuilder';
import { DoorLeakSystem, SEAM_CLOSED_RANGE, CLOSED_RANGE, type DoorLeakEntry, type LeakStyle } from '../render/DoorLeak';
import { SnapshotService, SNAPSHOT_EXCLUDE_LAYER } from '../render/SnapshotService';
import { SaveManager } from '../save/SaveManager';
import { RoomStreamingManager } from '../streaming/RoomStreamingManager';
import { Hud } from '../ui/Hud';
import { drawMap, levelOf } from '../ui/Minimap';
import { MapPanel } from '../ui/MapPanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import { RoomGraph } from '../world/RoomGraph';
import { WorldManager, isDoorLike } from '../world/WorldManager';
import { AudioEngine, type SoundHandle } from '../audio/AudioEngine';
import { Settings } from '../core/Settings';
import { checkCanOpen, hasModifier, modParams, runEnter, runExit, runUpdate, DEFAULT_LOCKED_HINT } from '../modifiers';
import { installWorldHooks } from '../modifiers/hooks';
import type { GameServices, MapViewState, RuntimeContext } from '../modifiers/types';
import type { RoomLayout } from '../generators/layout';

type State = 'start' | 'playing' | 'menu' | 'transition' | 'riding';

/** 環境（霧・背景・半球光）の補間目標 */
interface EnvTarget {
  fog: THREE.Color;
  near: number;
  /** 設計値（Tier でクランプする前） */
  designFar: number;
  sky: THREE.Color;
  ground: THREE.Color;
}

const ENV_LERP_SEC = 0.8;
const PLAYER_ZONE_KINDS = new Set(['water', 'friction', 'force', 'lane']);

/** 角度差を (-π, π] に畳む（camera.rotation の差分から回転速度を取るとき用） */
function wrapAngle(a: number): number {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
}

/**
 * 部屋切り替え（入室 / 開扉）1 回分の計測（担当 L2。docs/perf-room-switch.md）。
 * `window.__roomSwitchProfile` に最新 KEEP 件、`game.perf().roomSwitch` に直近の要約
 */
export interface RoomSwitchSample {
  kind: 'enter' | 'door';
  /** 入室先 / 扉を所有する部屋 */
  room: string;
  /** 開扉: 扉の向こうの部屋 */
  target?: string;
  /** 部屋の定義 id（入室先 / 向こうの部屋） */
  def?: string;
  at: number;
  /** 同期部分（enterRoom / toggleDoor 本体。見えている部屋の同期構築を含む）ms */
  syncMs: number;
  /** 同期部分で構築した部屋数 */
  syncBuilds: number;
  /** 同期部分で増えたシェーダプログラム数 */
  syncPrograms: number;
  /** 直後の 1 フレーム（step 全体 = 更新 + 描画。初回描画のアップロード・コンパイルが乗る）ms */
  firstFrameMs: number;
  /** 以後 WINDOW フレームの最大 ms（firstFrame を含む） */
  maxFrameMs: number;
  /** 窓の中で 100 ms / 50 ms を超えたフレーム数 */
  over100: number;
  over50: number;
  frames: number;
  /** 窓の中で追跡テクスチャ（CC0 / ライトマップ / アトラス）がアップロードされた回数 */
  uploads: number;
  /** 窓の中で増えた GL テクスチャ数（renderer.info.memory.textures） */
  textures: number;
  /** 窓の中で増えたシェーダプログラム数 */
  programs: number;
  /** 窓の中で後回し構築が走った部屋数と、そのうち複数フレームに分割されたもの */
  deferredBuilds: number;
  splitBuilds: number;
  /** 窓の中でライトマップが反映された部屋数 */
  lightmaps: number;
  done: boolean;
}

interface ActiveSwitch {
  s: RoomSwitchSample;
  textures0: number;
  programs0: number;
  uploads0: number;
  builds0: number;
  splits0: number;
  lightmaps0: number;
}

/** 計測の外部カウンタ（RoomStreamingManager / MaterialLibrary の累計値を読む） */
interface SwitchCounters {
  textures(): number;
  programs(): number;
  uploads(): number;
  builds(): number;
  splitBuilds(): number;
  lightmaps(): number;
}

export class RoomSwitchProfiler {
  static WINDOW = 30;
  static KEEP = 120;
  readonly samples: RoomSwitchSample[] = [];
  private readonly active: ActiveSwitch[] = [];
  private readonly c: SwitchCounters;

  constructor(counters: SwitchCounters) {
    this.c = counters;
  }

  begin(kind: RoomSwitchSample['kind'], room: string, target?: string, def?: string): RoomSwitchSample {
    const s: RoomSwitchSample = {
      kind, room, target, def, at: performance.now(), syncMs: 0, syncBuilds: 0, syncPrograms: 0,
      firstFrameMs: 0, maxFrameMs: 0, over100: 0, over50: 0, frames: 0, uploads: 0, textures: 0, programs: 0,
      deferredBuilds: 0, splitBuilds: 0, lightmaps: 0, done: false,
    };
    const a: ActiveSwitch = { s, textures0: this.c.textures(), programs0: this.c.programs(), uploads0: this.c.uploads(), builds0: this.c.builds(), splits0: this.c.splitBuilds(), lightmaps0: this.c.lightmaps() };
    this.active.push(a);
    this.samples.push(s);
    if (this.samples.length > RoomSwitchProfiler.KEEP) this.samples.splice(0, this.samples.length - RoomSwitchProfiler.KEEP);
    return s;
  }

  /** 同期部分の終わり（構築数・プログラム数の増分を記録し、以後のカウンタ基準を進める） */
  endSync(s: RoomSwitchSample): void {
    const a = this.active.find((x) => x.s === s);
    if (!a) return;
    s.syncMs = performance.now() - s.at;
    s.syncBuilds = this.c.builds() - a.builds0;
    s.syncPrograms = this.c.programs() - a.programs0;
    a.builds0 = this.c.builds();
    a.programs0 = this.c.programs();
    a.textures0 = this.c.textures();
    a.uploads0 = this.c.uploads();
  }

  /** 1 フレーム（step 全体）の所要時間を積む */
  frame(ms: number): void {
    if (!this.active.length) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      const s = a.s;
      if (s.frames === 0) s.firstFrameMs = ms;
      s.frames++;
      if (ms > s.maxFrameMs) s.maxFrameMs = ms;
      if (ms > 100) s.over100++;
      if (ms > 50) s.over50++;
      s.uploads = this.c.uploads() - a.uploads0;
      s.textures = this.c.textures() - a.textures0;
      s.programs = this.c.programs() - a.programs0;
      s.deferredBuilds = this.c.builds() - a.builds0;
      s.splitBuilds = this.c.splitBuilds() - a.splits0;
      s.lightmaps = this.c.lightmaps() - a.lightmaps0;
      if (s.frames >= RoomSwitchProfiler.WINDOW) { s.done = true; this.active.splice(i, 1); }
    }
  }

  /** 直近 n 件の要約（perf() 用） */
  summary(n = 24): { samples: number; enter: { n: number; maxFrame: number; maxSync: number; medianFrame: number }; door: { n: number; maxFrame: number; maxSync: number; medianFrame: number }; uploads: number; textures: number; programs: number; over100: number } {
    const recent = this.samples.slice(-n);
    const agg = (kind: RoomSwitchSample['kind']) => {
      const list = recent.filter((s) => s.kind === kind);
      const frames = list.map((s) => s.maxFrameMs).sort((a, b) => a - b);
      return { n: list.length, maxFrame: frames.length ? frames[frames.length - 1] : 0, maxSync: list.reduce((m, s) => Math.max(m, s.syncMs), 0), medianFrame: frames.length ? frames[frames.length >> 1] : 0 };
    };
    return {
      samples: recent.length, enter: agg('enter'), door: agg('door'),
      uploads: recent.reduce((a, s) => a + s.uploads, 0), textures: recent.reduce((a, s) => a + s.textures, 0),
      programs: recent.reduce((a, s) => a + s.programs + s.syncPrograms, 0), over100: recent.reduce((a, s) => a + s.over100, 0),
    };
  }
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly input: InputController;
  readonly player: PlayerController;
  readonly ride: PlayerRide;
  readonly proxy = new PlayerProxy();
  readonly hud = new Hud();
  readonly materials = new MaterialLibrary();
  readonly builder = new RoomBuilder(this.materials, { worldSeed: () => this.world.graph.worldSeed });
  readonly snapshots: SnapshotService;
  readonly settings: Settings;
  readonly audio: AudioEngine;
  readonly settingsPanel: SettingsPanel;
  /** ポスト処理（GTAO / bloom / 撮像 pass / OutputPass）と描画時間の計測。Tier と設定 postfx から applyPostFxConfig が組む */
  readonly postfx: PostFX;
  readonly flashlight = new PlayerFlashlight(this.scene);
  /** 懐中電灯のオン / オフ（R キー。既定オン） */
  flashlightOn = true;
  /** REC・タイムコード表示（DOM。設定 recOverlay。playing / riding / transition の間だけ見せる） */
  readonly recOverlay = new RecOverlay(document.body);
  /** 地図の表示状態（MapRotation / MapErase が書く。参照は固定） */
  readonly mapView: MapViewState = { rotation: 0 };
  // --- カメラ挙動 → 撮像 pass への入力（担当 F2）
  /** 移動入力も視線入力も無い（かつ実速度がほぼ 0）時間（s）。postfx.setStillness / player.setStillness へ */
  private stillSec = 0;
  /** 表示カメラの回転速度（rad/s。前フレームの camera.rotation との差。デバッグ HUD 用に保持） */
  private camRates: [number, number] = [0, 0];
  private prevCamYaw = 0;
  private prevCamPitch = 0;
  private camMotionValid = false;
  private lastTeleportSerial = 0;
  /** このフレーム（または次のフレーム）に入室した: 回転ブラーの入力を 0 にする */
  private roomEnteredFrame = false;
  /** 現在部屋が E03（layout.roll）: カメラ揺れとロールを掛けない */
  private roomHasRoll = false;
  /** 開いた扉の光漏れ（加算合成クワッド。担当 P1。PointLight は増やさない）。updateVisibility の末尾で同期し、毎フレーム update */
  readonly doorLeaks = new DoorLeakSystem(this.scene);
  /** 閉じた Seam 扉の漏れは距離で出し入れするので、扉イベントが無くても 0.25 s ごとに同期する */
  private leakSyncAcc = 0;
  world!: WorldManager;
  streaming!: RoomStreamingManager;
  currentRoomId: string | null = null;
  state: State = 'start';
  tierId: QualityTierId = 'high';
  autoTier = true;
  /** 開発用: poll した入力に上書きする（テストでしゃがみ等を強制。null で無効） */
  devInput: Partial<InputState> | null = null;
  private tier: QualityTier = QUALITY_TIERS.high;
  private readonly timer = new THREE.Timer();
  private readonly raycaster = new THREE.Raycaster();
  private frameTimes: number[] = [];
  private tierCooldown = 0;
  private readonly minimap = document.getElementById('minimap') as HTMLCanvasElement;
  private readonly mapPanel = new MapPanel(document.getElementById('map-tabs')!, document.getElementById('fullmap') as HTMLCanvasElement, document.getElementById('map3d') as HTMLCanvasElement);
  private readonly fade = document.getElementById('fade')!;
  private readonly menuEl = document.getElementById('menu')!;
  private readonly startEl = document.getElementById('start')!;
  private debugOn = false;
  // 半球光は一様な照度で焼き込みの明暗（器具の間・突き当たりの沈み）を埋めるので弱く（0.32 → 0.06）
  private hemi = new THREE.HemisphereLight(0xe5e4d5, 0x6c665a, 0.1);
  private env: { from: EnvTarget; to: EnvTarget; t: number } | null = null;
  private envNow: EnvTarget = { fog: new THREE.Color(0x262a28), near: QUALITY_TIERS.high.fogNear, designFar: QUALITY_TIERS.high.fogDefaultFar, sky: new THREE.Color(0xe5e4d5), ground: new THREE.Color(0x6c665a) };
  /** Modifier / 施錠が出した一時ヒント（updateHint が他に出すものが無いときに表示） */
  private extHint: { text: string; until: number } | null = null;
  /** 施錠音を鳴らした Portal（部屋ごとに 1 回） */
  private readonly lockedPlayed = new Set<string>();
  private rideSound: SoundHandle | null = null;
  private readonly services: GameServices;
  /** updateHint が扉・エレベーターの操作案内（施錠ヒント含む）を出しているフレームは true（Modifier の hud.busy()） */
  private hintBusy = false;
  private readonly hudHint = {
    hint: (text: string) => { this.extHint = { text, until: performance.now() / 1000 + 1.5 }; },
    busy: () => this.hintBusy,
  };
  private readonly zoneCache: PlayerZone[] = [];
  /** 部屋切り替え（入室 / 開扉）の停止時間の計測（window.__roomSwitchProfile / perf().roomSwitch） */
  readonly switchProfiler: RoomSwitchProfiler;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // トーンマップは設定（既定 AgX。applyPostFxConfig が反映）。直接描画では材質側、EffectComposer 使用時は OutputPass だけが
    // 適用する（RenderTarget 描画中は three.js が材質側のトーンマップと出力変換を無効化するので二重にならない。src/render/PostFX.ts）
    this.renderer.toneMapping = TONE_MAPPINGS.agx;
    this.renderer.toneMappingExposure = DEFAULT_EXPOSURE;
    // 影: 可視 PointLight のうち近い 1〜2 灯だけ（RoomStreamingManager.updateLights の影スロット）。影マップの更新は renderFrame でだけ行う
    // （SnapshotService の RT 描画や GTAO の法線パスで再描画しない）
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.materials.configure(this.renderer);
    this.switchProfiler = new RoomSwitchProfiler({
      textures: () => this.renderer.info.memory.textures,
      programs: () => this.renderer.info.programs?.length ?? 0,
      uploads: () => this.materials.uploadStats.count,
      builds: () => this.streaming?.buildCount ?? 0,
      splitBuilds: () => this.streaming?.splitBuildCount ?? 0,
      lightmaps: () => this.materials.uploadStats.lightmaps,
    });
    (window as unknown as { __roomSwitchProfile?: RoomSwitchSample[]; __l2flags?: typeof L2_FLAGS }).__roomSwitchProfile = this.switchProfiler.samples;
    (window as unknown as { __l2flags?: typeof L2_FLAGS }).__l2flags = L2_FLAGS;
    this.snapshots = new SnapshotService(this.renderer);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 150);
    // スナップショット表示面（PastWindow の窓・スクリーン）はレイヤ 3 だけに置かれる。メインカメラはそれを見る（キャプチャ時だけ外す）
    this.camera.layers.enable(SNAPSHOT_EXCLUDE_LAYER);
    this.player = new PlayerController(this.camera);
    this.ride = new PlayerRide(this.player, this.camera);
    this.input = new InputController(canvas, {
      touchRoot: document.getElementById('touch-ui')!,
      stick: document.getElementById('stick')!,
      knob: document.getElementById('stick-knob')!,
      jump: document.getElementById('btn-jump')!,
      dash: document.getElementById('btn-dash')!,
      menu: document.getElementById('btn-menu')!,
      crouch: document.getElementById('btn-crouch') ?? undefined,
    });
    // 設定と音（AudioContext は開始クリックの unlock まで作らない）
    this.settings = Settings.load();
    this.audio = new AudioEngine(this.settings);
    this.input.sensitivityScale = this.settings.data.lookSensitivity;
    this.settings.onChange((d, changed) => {
      this.input.sensitivityScale = d.lookSensitivity;
      // postfx は composer を組み直す（末尾で applyCameraSettings も呼ぶ）。カメラ挙動だけの変更は pass を作り直さない
      if (changed.includes('postfx') || changed.includes('toneMapping')) this.applyPostFxConfig();
      else if (changed.some((k) => k === 'handheld' || k === 'cameraLag' || k === 'recOverlay' || k === 'frameHold' || k === 'vhsStrength')) this.applyCameraSettings();
    });
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);
    this.player.onStride = (rank) => {
      if (rank === 'still') return;
      this.audio.footstep(undefined, rank, this.player.crouching, this.player.inWaterZone || undefined);
      // 水の中の一歩ごとに水面へ波紋（MaterialLibrary の水材質の共有 uniform）
      if (this.player.inWaterZone) this.materials.addRipple(this.player.pos.x, this.player.pos.z, rank === 'dash' ? 1.4 : 1.0);
    };
    this.player.onLand = (speed) => this.audio.land(speed);

    this.scene.add(this.hemi);
    this.scene.add(this.proxy.mesh);
    this.scene.background = new THREE.Color(0x0b0d14);
    this.scene.fog = new THREE.Fog(0x262a28, this.tier.fogNear, this.tier.fogFar);
    if (this.input.mode === 'mobile') this.setTier('mid');
    window.addEventListener('resize', () => this.resize());
    this.applyPostFxConfig(); // composer を組んで resize も行う
    this.bindMenu();
    // SettingsPanel は bindMenu の後（保存済み Tier を #quality に入れて change を dispatch する）
    this.settingsPanel = new SettingsPanel(this.settings);
    this.startEl.addEventListener('click', () => this.onStartClick());
    this.startEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.onStartClick();
    }, { passive: false });

    const game = this;
    this.services = {
      proxy: this.proxy,
      snapshots: this.snapshots,
      ride: this.ride,
      materials: this.materials,
      renderer: this.renderer,
      mapView: this.mapView,
      get currentRoomId() { return game.currentRoomId; },
      get inputMode() { return game.input.mode; },
      startRide: (node, portal, opts) => this.startRide(node, portal, opts),
      prepare: (roomId) => { if (this.state === 'playing' && this.world?.graph.has(roomId)) this.ensurePrepared(roomId); },
      transition: (fn) => this.transition(fn),
      enterRoomAt: (roomId, spawn, yaw) => { this.player.teleport(spawn, yaw); this.enterRoom(roomId); },
    };
  }

  // ------------------------------------------------------------ setup
  newWorld(seed = randomWorldSeed()): void {
    this.teardownWorld();
    this.world = new WorldManager(new RoomGraph(seed));
    this.registerWorldHooks();
    this.streaming = new RoomStreamingManager(this.scene, this.builder, this.world);
    const start = this.world.createStartRoom();
    // 入口ソケットの 1.5m 内側から開始（外接矩形の中心は折れ廊下では部屋の外になり得る）
    const sp = this.world.spawnPointOf(start);
    this.player.teleport(sp.spawn, sp.yaw);
    this.enterRoom(start.roomId);
    this.updateSeedUi();
  }

  loadWorld(): boolean {
    const d = SaveManager.load();
    if (!d) return false;
    this.teardownWorld();
    this.world = new WorldManager(RoomGraph.fromJSON(d.graph));
    this.registerWorldHooks();
    this.streaming = new RoomStreamingManager(this.scene, this.builder, this.world);
    this.player.teleport(d.player.pos, d.player.yaw);
    this.player.pitch = d.player.pitch;
    this.currentRoomId = null;
    this.enterRoom(d.currentRoomId);
    this.updateSeedUi();
    return true;
  }

  save(): boolean {
    if (!this.currentRoomId || this.state === 'riding') return false;
    return SaveManager.save({
      version: 1,
      savedAt: new Date().toISOString(),
      graph: this.world.graph.toJSON(),
      currentRoomId: this.currentRoomId,
      player: { pos: this.player.feet, yaw: this.player.yaw, pitch: this.player.pitch },
    });
  }

  private teardownWorld(): void {
    if (this.streaming) this.streaming.clear();
    this.doorLeaks.clear();
    this.materials.dropPrefetch(new Set());
    if (this.ride.riding) this.ride.cancel();
    this.rideSound?.stop(0.2);
    this.rideSound = null;
    this.audio.clearRoom();
    this.proxy.history.clear();
    this.lockedPlayed.clear();
    this.extHint = null;
    this.mapView.rotation = 0;
    this.mapView.hiddenRoomIds = undefined;
    if (this.state === 'riding') this.state = 'playing';
    this.currentRoomId = null;
  }

  /** Modifier のノード生成フック・接続フックを WorldManager に登録する（世界の生成・ロード直後、最初の部屋を作る前） */
  /** Modifier の nodeHooks / connectHooks を WorldManager に登録する（写像は modifiers/hooks.ts。tools/seam-stats.mjs も同じものを使う） */
  private registerWorldHooks(): void {
    installWorldHooks(this.world);
  }

  private updateSeedUi(): void {
    const el = document.getElementById('menu-seed');
    if (el) el.textContent = String(this.world.graph.worldSeed);
  }

  // ------------------------------------------------------------ rooms
  private defOf(node: RoomInstance): RoomDefinition | null {
    return node.isAdapter ? null : ROOM_BY_ID.get(node.definitionId) ?? null;
  }

  /** Modifier のランタイムコンテキスト（部屋が無ければ null） */
  ctxFor(roomId: string, built: BuiltRoom | null = this.streaming?.built.get(roomId) ?? null, now = performance.now() / 1000): RuntimeContext | null {
    if (!this.world || !this.world.graph.has(roomId)) return null;
    const node = this.world.graph.get(roomId);
    return {
      world: this.world,
      node,
      built,
      layout: this.world.layoutFor(node),
      player: { pos: this.player.feet, yaw: this.player.yaw, crouching: this.player.crouching },
      scene: this.scene,
      camera: this.camera,
      tier: this.tier,
      audio: this.audio,
      hud: this.hudHint,
      now,
      def: this.defOf(node),
      game: this.services,
    };
  }

  enterRoom(roomId: string): void {
    const node = this.world.graph.get(roomId);
    const prev = this.currentRoomId;
    const sample = prev !== roomId ? this.switchProfiler.begin('enter', roomId, undefined, node.definitionId) : null;
    if (prev && prev !== roomId && this.world.graph.has(prev)) {
      // 退室フック（現在部屋が変わるときだけ）
      const prevNode = this.world.graph.get(prev);
      try {
        const ctx = this.ctxFor(prev);
        if (ctx) runExit(ctx, this.defOf(prevNode));
      } catch (e) {
        console.warn('[modifiers] onExit failed', e);
      }
    }
    this.currentRoomId = roomId;
    const def = this.defOf(node);
    if (prev !== roomId) this.flashlight.reset();
    // 訪問ログ（visitLog / prevRoomId）は markVisited が更新する
    this.world.graph.markVisited(roomId, node.definitionId, def?.rarity ?? null);
    // 見えている部屋（構築済み）と訪問済みの部屋は凍結し、新しい開口を追加しない。
    // 構築待ち（後回し・分割構築の途中）の部屋も含める: 従来は入室までに 1 部屋 / フレームで構築が終わっていたので凍結されていた。
    // 分割構築で構築が入室に間に合わなくても世界の生成結果（tryNewExit の対象）が変わらないようにする
    this.world.frozen = new Set<string>([roomId, ...this.streaming.built.keys(), ...this.streaming.pendingIds, ...[...this.world.graph.nodes.values()].filter((n) => n.visited).map((n) => n.roomId)]);
    // 入室時: 現在の部屋と隣接部屋の接続先を確定（2 hop 先まで配置）
    this.world.prepareRoom(roomId);
    // 通過した扉に時刻を記録（自動閉扉）
    if (prev) {
      const now = performance.now() / 1000;
      const prevNode = this.world.graph.get(prev);
      for (const p of prevNode.portals) if (p.type === 'door' && p.targetRoomId === roomId && p.open) p.passedAt = now;
      for (const p of node.portals) if (p.type === 'door' && p.targetRoomId === prev && p.open) p.passedAt = now;
    }
    this.refreshStreaming();
    this.hud.setRoom(def, node.isAdapter, node.fallback);
    // 環境（霧・背景・半球光）と音
    const built = this.streaming.built.get(roomId) ?? null;
    const layout = this.world.layoutFor(node);
    this.applyEnvironment(built, layout, prev === null);
    this.postfx.setAoSuppressed(layout.render?.style === 'untextured');
    // 撮像: 入室直後のオートフォーカスの迷い（部屋が変わるときだけ）。回転ブラーの入力はこのフレーム 0。E03 では手持ち揺れを止める
    if (prev !== roomId) {
      this.postfx.notifyRoomEnter();
      this.roomEnteredFrame = true;
    }
    this.roomHasRoll = !!layout.roll;
    const wet = !!layout.render?.wetness || !!layout.zones?.some((z) => z.kind === 'water') || hasModifier(def, 'ShallowWater') || hasModifier(def, 'Wetness');
    this.audio.setRoom(def, layout, this.tier, { roomId, hints: def?.layoutHints, wet });
    // 入室フック
    if (prev !== roomId) {
      try {
        const ctx = this.ctxFor(roomId, built);
        if (ctx) runEnter(ctx, def);
      } catch (e) {
        console.warn('[modifiers] onEnter failed', e);
      }
    }
    if (sample) this.switchProfiler.endSync(sample);
  }

  /**
   * 入室時の環境目標を決めて 0.8 s の補間を開始する。目標: BuiltRoom.fog → layout.render.fog → palette.fog
   * （near / far は Tier の既定 fogNear / fogDefaultFar。layout.fogFar があれば far に使う。far は updateEnvironment で Tier の fogFar にクランプ）
   */
  private applyEnvironment(built: BuiltRoom | null, layout: RoomLayout, immediate = false): void {
    const f = built?.fog ?? layout.render?.fog ?? { color: layout.palette.fog, near: this.tier.fogNear, far: layout.fogFar ?? this.tier.fogDefaultFar };
    const sky = new THREE.Color(layout.palette.ambient);
    const to: EnvTarget = { fog: new THREE.Color(f.color), near: f.near, designFar: f.far, sky, ground: sky.clone().multiplyScalar(0.7) };
    const from: EnvTarget = { fog: this.envNow.fog.clone(), near: this.envNow.near, designFar: this.envNow.designFar, sky: this.envNow.sky.clone(), ground: this.envNow.ground.clone() };
    this.env = { from, to, t: 0 };
    if (immediate) this.env.t = ENV_LERP_SEC; // 最初の部屋（新規 / ロード直後）は即時
    this.updateEnvironment(0);
  }

  private updateEnvironment(dt: number): void {
    if (!this.env) return;
    this.env.t = Math.min(ENV_LERP_SEC, this.env.t + dt);
    const k = this.env.t / ENV_LERP_SEC;
    const s = k * k * (3 - 2 * k);
    const { from, to } = this.env;
    this.envNow.fog.copy(from.fog).lerp(to.fog, s);
    this.envNow.near = from.near + (to.near - from.near) * s;
    this.envNow.designFar = from.designFar + (to.designFar - from.designFar) * s;
    this.envNow.sky.copy(from.sky).lerp(to.sky, s);
    this.envNow.ground.copy(from.ground).lerp(to.ground, s);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.envNow.fog);
    fog.near = this.envNow.near;
    fog.far = Math.min(this.envNow.designFar, this.tier.fogFar);
    (this.scene.background as THREE.Color).copy(this.envNow.fog);
    this.hemi.color.copy(this.envNow.sky);
    this.hemi.groundColor.copy(this.envNow.ground);
    if (k >= 1) this.env = null;
  }

  private refreshStreaming(): void {
    if (!this.currentRoomId) return;
    const keep = new Set<string>([this.currentRoomId, ...this.world.graph.placedNeighbors(this.currentRoomId)]);
    // 開いた扉・ガラス扉・扉の無い通路の先に見える部屋も構築しておく（見えるはずの部屋が真っ暗にならない）
    for (const id of this.seeThroughReach()) keep.add(id);
    // 現在いる部屋は再構築しない（目の前で扉や家具が変わらないように）。必要な部屋は作り直し、保持中（keep 外）の部屋は捨てるだけ
    for (const id of [...this.world.dirty]) {
      if (id === this.currentRoomId) continue;
      if (keep.has(id)) this.streaming.rebuild(id);
      else this.streaming.evict(id);
      this.world.dirty.delete(id);
    }
    // いま見える部屋（現在 + 開いた扉・ガラス・通路の先）だけ同期的に構築し、閉じた扉の先は次のフレーム以降に 1 部屋ずつ構築する
    // （入室時のフリーズを分散。扉を開けた瞬間は ensurePrepared が同期構築する）
    const visibleNow = new Set<string>([this.currentRoomId, ...this.seeThroughReach()]);
    this.streaming.dropPending(keep);
    for (const id of keep) {
      if (visibleNow.has(id)) this.streaming.ensure(id);
      else this.streaming.enqueue(id);
    }
    this.streaming.disposeExcept(keep);
    this.updateVisibility();
    this.prefetchAhead();
  }

  // ------------------------------------------------------------ 先読み（担当 L2。docs/perf-room-switch.md）
  /** 部屋ごとの材質の見込み（layout オブジェクトと Tier が同じ間は再計算しない） */
  private readonly materialPlans = new WeakMap<RoomLayout, { tier: QualityTierId; plan: ReturnType<typeof RoomBuilder.materialPlan> }>();
  /** 事前コンパイルに使う小さな箱（bakedLight / uv1 付き。プログラムは属性に依らないが警告を避ける） */
  private probeGeometry: THREE.BufferGeometry | null = null;
  /** compile を EffectComposer の RenderPass と同じ条件（RenderTarget へ描く）にするためのダミー RT */
  private compileTarget: THREE.WebGLRenderTarget | null = null;

  /**
   * 2 hop 先（配置済み・未構築）と、後回しにした隣接部屋について、部屋 seed で選ばれる CC0 セットの読込と
   * 材質シェーダのコンパイルを先に始める。入室時（prepareRoom の後）と扉を開けた直後（ensureNeighbors の後）に呼ぶ。
   * 読込が終わったテクスチャは materials.uploads が余裕のあるフレームで GPU に載せる。対象から外れた部屋の先読みは外す
   */
  private prefetchAhead(): void {
    if (!this.currentRoomId || (!L2_FLAGS.prefetch && !L2_FLAGS.precompile)) return;
    const near = new Set<string>([this.currentRoomId, ...this.world.graph.placedNeighbors(this.currentRoomId)]);
    const reach = new Set<string>();
    for (const id of near) if (!this.streaming.built.has(id)) reach.add(id);
    for (const id of near) for (const nid of this.world.graph.placedNeighbors(id)) if (!near.has(nid) && !this.streaming.built.has(nid)) reach.add(nid);
    const keep = new Set<string>();
    for (const id of reach) {
      const node = this.world.graph.get(id);
      if (!node.placement) continue;
      let layout: RoomLayout;
      try { layout = this.world.layoutFor(node); } catch { continue; }
      let cached = this.materialPlans.get(layout);
      if (!cached || cached.tier !== this.tierId) { cached = { tier: this.tierId, plan: RoomBuilder.materialPlan(node, layout, this.tier) }; this.materialPlans.set(layout, cached); }
      const plan = cached.plan;
      if (plan.lit && plan.ids.length) {
        keep.add(id);
        if (L2_FLAGS.prefetch) this.materials.prefetchRoom(id, plan.ids, node.seed);
      }
      if (L2_FLAGS.precompile) this.precompileAhead(plan, node.seed);
    }
    this.materials.dropPrefetch(keep);
  }

  /** 2 hop 先の材質（共有 variant・lightMap 付き clone の代表・反復配置の InstancedMesh 版）を実描画と同じ条件で非同期コンパイルする */
  private precompileAhead(plan: ReturnType<typeof RoomBuilder.materialPlan>, seed: number): void {
    const mats = this.materials.probeMaterials(plan.lit ? plan.ids : [], seed, plan.overrides, plan.shared).filter((m) => !m.userData.precompiled);
    const inst = plan.instanced.length ? this.materials.probeMaterials([], seed, plan.overrides, plan.instanced).filter((m) => !m.userData.precompiledInstanced) : [];
    if (!mats.length && !inst.length) return;
    if (!this.probeGeometry) {
      const g = new THREE.BoxGeometry(.1, .1, .1);
      const n = g.getAttribute('position').count;
      g.setAttribute('bakedLight', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('uv1', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
      this.probeGeometry = g;
    }
    const probe = new THREE.Group();
    for (const m of mats) {
      m.userData.precompiled = true;
      const mesh = new THREE.Mesh(this.probeGeometry, m);
      mesh.receiveShadow = true;
      probe.add(mesh);
    }
    for (const m of inst) {
      m.userData.precompiledInstanced = true;
      const mesh = new THREE.InstancedMesh(this.probeGeometry, m, 1);
      mesh.receiveShadow = true;
      probe.add(mesh);
    }
    // 実描画と同じ条件（composer の RenderTarget、可視ライト maxLights 本・影 shadowLights 本）で非同期コンパイル
    this.streaming.compileWith(this.renderer, this.compileRenderTarget(), this.tier, () => {
      try {
        void this.renderer.compileAsync(probe, this.camera, this.scene).catch(() => { /* 途中で dispose された等は無視 */ });
      } catch { /* WebGL コンテキスト喪失などは無視 */ }
    });
  }

  /** composer 使用時は RenderTarget へ描くプログラム（トーンマップ無し・線形出力）が使われるので、compile も同じ条件にする */
  private compileRenderTarget(): THREE.WebGLRenderTarget | null {
    if (!this.postfx.active) return null;
    if (!this.compileTarget) this.compileTarget = new THREE.WebGLRenderTarget(4, 4);
    return this.compileTarget;
  }

  /** この Portal の向こうが見えるか: 開いた扉 / ガラス扉（施錠なし）/ 扉の無い開口（stairs・ramp・street・穴）。Seam は不可 */
  private seeThrough(node: RoomInstance, p: Portal): boolean {
    if (!p.targetRoomId || p.seam || !this.world.graph.has(p.targetRoomId)) return false;
    const target = this.world.graph.get(p.targetRoomId);
    if (!target.placement) return false;
    if (this.world.portalOpen(node, p)) return true;
    if (p.type !== 'door' || p.locked) return false;
    // ガラス扉: パネルは所有側（isReturn でない側）のパレットで作られる
    const owner = p.isReturn ? target : node;
    try {
      return this.world.layoutFor(owner).palette.door === 'glass';
    } catch {
      return false;
    }
  }

  /** 現在 Room から「向こうが見える Portal」だけを辿って届く部屋（最大 maxHops）。配置済みの部屋のみ */
  private seeThroughReach(maxHops = 3): Set<string> {
    const out = new Set<string>();
    if (!this.currentRoomId) return out;
    const visited = new Set<string>([this.currentRoomId]);
    let frontier = [this.currentRoomId];
    for (let hop = 0; hop < maxHops && frontier.length; hop++) {
      const next: string[] = [];
      for (const id of frontier) {
        const n = this.world.graph.get(id);
        for (const p of n.portals) {
          if (!this.seeThrough(n, p) || visited.has(p.targetRoomId!)) continue;
          visited.add(p.targetRoomId!);
          out.add(p.targetRoomId!);
          next.push(p.targetRoomId!);
        }
        // 反対側だけが Portal を持つ接続（直結で片側にしか Portal が無い場合）
        for (const oid of this.streaming.built.keys()) {
          if (visited.has(oid)) continue;
          const other = this.world.graph.get(oid);
          if (other.portals.some((p) => p.targetRoomId === id && this.seeThrough(other, p))) {
            visited.add(oid);
            out.add(oid);
            next.push(oid);
          }
        }
      }
      frontier = next;
    }
    return out;
  }

  /** 閉じた扉の向こうは描かない: 現在 Room から「向こうが見える Portal」（開いた扉・ガラス扉・扉の無い通路）で 3 hop 以内に届く部屋だけ表示 */
  private updateVisibility(): void {
    if (!this.currentRoomId) return;
    const visible = new Set<string>([this.currentRoomId]);
    for (const id of this.seeThroughReach()) {
      visible.add(id);
      // 見えるはずの部屋が未構築なら（扉を開けた直後など）接続を確定してから構築する
      if (!this.streaming.built.has(id)) this.ensurePrepared(id);
    }
    for (const [id, b] of this.streaming.built) {
      const wasVisible = b.group.visible;
      b.group.visible = visible.has(id);
      // 見えるようになった部屋のライトマップ反映を先に（待ち行列の優先度 0）
      if (b.group.visible && !wasVisible && b.lightmap?.upload) this.materials.uploads.promote(b.lightmap.texture, 0);
      // 扉は所有部屋が非表示でも、反対側の部屋が見えていれば描く（裏から見て真っ暗にならない）
      for (const d of b.doors.values()) {
        const other = d.portal.targetRoomId;
        // 戻り側パネルは所有部屋が構築済みなら所有側のパネルに任せる
        if (d.portal.isReturn && other && this.streaming.built.has(other)) { d.root.visible = false; continue; }
        d.root.visible = visible.has(id) || (!!other && visible.has(other));
      }
    }
    this.syncDoorLeaks();
  }

  /**
   * 開いた扉の光漏れの目標状態を DoorLeakSystem に渡す（updateVisibility の末尾 = 扉の開閉・自動閉扉・入室・後回し構築の完了）。
   * 見えている構築済み部屋 X の開いた door Portal ごとに、X 側の床・壁へ「向こうの部屋 Y のレア度」の色で 1 件。
   * Y 側は Y 自身の戻り Portal を辿ったときに作られる。Seam 扉は 'seam'。E03（layout.roll）の部屋は位置がずれるので置かない
   */
  private syncDoorLeaks(): void {
    const entries: DoorLeakEntry[] = [];
    const feet = this.player.feet;
    this.leakSyncAcc = 0;
    for (const [id, b] of this.streaming.built) {
      if (!b.group.visible || !this.world.graph.has(id)) continue;
      const node = this.world.graph.get(id);
      if (!node.placement) continue;
      let layout: RoomLayout;
      try { layout = this.world.layoutFor(node); } catch { continue; }
      if (layout.roll) continue;
      for (const p of node.portals) {
        if (p.type !== 'door' || !p.targetRoomId || !this.world.graph.has(p.targetRoomId)) continue;
        const s = layout.sockets.find((x) => x.id === p.socketId);
        if (!s) continue;
        const target = this.world.graph.get(p.targetRoomId);
        let style: LeakStyle;
        let lightColor = layout.palette.lightColor;
        const open = this.world.portalOpen(node, p);
        if (p.seam) {
          // Seam 扉は toggleDoor で開かず遷移するので、閉じたままでもパネル下端の隙間の漏れを置く（プレイヤーが 6 m 以内のときだけ）
          if (open) style = 'seam';
          else {
            const w = toWorld(node.placement, s.pos);
            if (Math.hypot(feet[0] - w[0], feet[2] - w[2]) > SEAM_CLOSED_RANGE) continue;
            style = 'seamClosed';
          }
        } else {
          if (!target.placement) continue;
          if (!open) {
            // 閉じた通常扉: 隙間から僅かに漏れる帯（レア度の色）。近い扉だけ
            const w = toWorld(node.placement, s.pos);
            if (Math.hypot(feet[0] - w[0], feet[2] - w[2]) > CLOSED_RANGE) continue;
          }
          style = this.leakRarityOf(target) ?? 'Common';
          try { lightColor = this.world.layoutFor(target).palette.lightColor; } catch { /* 向こうの layout が作れなければこの部屋の器具色 */ }
        }
        const sw = this.world.socketWorld(node, p.socketId);
        const closed = !open && !p.seam;
        entries.push({ key: `${id}/${p.portalId}${closed ? '/c' : ''}`, roomId: id, pos: sw.pos, dir: sw.dir, width: s.width, height: s.height, sill: s.sill ?? 0, style, lightColor, closed });
      }
    }
    this.doorLeaks.sync(entries, (roomId) => this.streaming.built.has(roomId));
  }

  /** 光漏れの色に使うレア度。アダプタ（前室・階段）はパレットを借りている部屋のレア度（その部屋へ続く扉として見せる） */
  private leakRarityOf(node: RoomInstance): Rarity | null {
    if (!node.isAdapter) return this.defOf(node)?.rarity ?? null;
    const from = node.adapter?.paletteFrom;
    if (from && this.world.graph.has(from)) return this.defOf(this.world.graph.get(from))?.rarity ?? null;
    return null;
  }

  /** プレイヤーの足元を含む部屋（現在 → 隣接の順） */
  private detectRoom(): string | null {
    if (!this.currentRoomId) return null;
    const feet = this.player.feet;
    const probe: [number, number, number] = [feet[0], feet[1] + 0.6, feet[2]];
    const cur = this.world.worldBounds.get(this.currentRoomId);
    if (cur && aabbContains(cur, probe, -0.2)) return this.currentRoomId;
    for (const id of this.world.graph.placedNeighbors(this.currentRoomId)) {
      const b = this.world.worldBounds.get(id);
      if (b && aabbContains(b, probe, -0.2)) return id;
    }
    // 隣接の隣接（扉が開いたまま 2 hop へ進んだ場合）
    for (const id of this.streaming.built.keys()) {
      const b = this.world.worldBounds.get(id);
      if (b && aabbContains(b, probe, -0.2)) return id;
    }
    return this.currentRoomId;
  }

  /** 現在部屋 + 隣接の BuiltRoom.zones（ワールド AABB）を PlayerZone に変換する（物理に効く kind だけ） */
  private playerZones(ids: string[]): PlayerZone[] {
    this.zoneCache.length = 0;
    for (const id of ids) {
      for (const z of this.streaming.zonesOf(id)) {
        if (!PLAYER_ZONE_KINDS.has(z.kind)) continue;
        this.zoneCache.push({ kind: z.kind as PlayerZone['kind'], aabb: z.aabb, vector: z.vector, params: z.params as PlayerZone['params'] });
      }
    }
    return this.zoneCache;
  }

  // ------------------------------------------------------------ interaction
  private interactRay(ndc: { x: number; y: number }): void {
    if (!this.currentRoomId) return;
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
    this.raycaster.far = 2.5;
    const hits = this.raycaster.intersectObjects(this.streaming.interactables(), false);
    if (hits.length > 0) {
      const ud = hits[0].object.userData as { roomId: string; portalId: string; kind: string };
      if (ud.kind === 'elevator') {
        this.tryElevator();
        return;
      }
      if (ud.kind === 'door') {
        this.toggleDoor(ud.roomId, ud.portalId);
        return;
      }
    }
    // エレベーター（籠の中で E）
    this.tryElevator();
  }

  /**
   * 扉パネルへの操作（E / タップ）。施錠・Modifier の拒否・乗車・Seam 遷移・通常の開閉を扱う。
   * 開発用スクリプトからも呼べる（interactRay と同じ経路。開扉の停止時間は switchProfiler に 'door' として残る）
   */
  toggleDoor(roomId: string, portalId: string): void {
    const portal = this.ownerPortal(roomId, portalId);
    const owner = this.ownerRoom(roomId, portalId);
    const door = this.streaming.built.get(roomId)?.doors.get(portalId);
    const doorMat = this.world.layoutFor(owner).palette.door;
    // 戻り側 Portal 自身の施錠（platform の乗降口「戻れない」など）は所有側に解決しても残す
    if (portal.locked || this.rawLocked(roomId, portalId)) {
      this.lockedHint(portal, DEFAULT_LOCKED_HINT, doorMat, door?.center);
      return;
    }
    // Modifier による開扉拒否（NoiseGate / ObservationRewire など）。interacting = ユーザー操作（ヒント表示の canOpen と区別）
    const ctx = this.ctxFor(owner.roomId);
    const can = ctx ? checkCanOpen(portal, { ...ctx, interacting: true }, this.defOf(owner)) : { ok: true as const };
    if (!can.ok) {
      this.lockedHint(portal, can.hint ?? DEFAULT_LOCKED_HINT, doorMat, door?.center);
      return;
    }
    if (portal.ride) {
      // VehicleRide: 車内で待ってから platform Adapter へ
      this.startRide(owner, portal);
      return;
    }
    if (portal.seam) {
      // 意図的 Seam 扉（Legendary 遠方配置 / FarLink / FakeExit …）: 開けた瞬間に向こう側へ座標遷移する
      this.audio.door('open', doorMat, door?.center);
      this.transition(() => {
        const res = this.world.resolveSeamTarget(owner, portal);
        this.player.teleport(res.spawn, res.yaw);
        this.enterRoom(res.target.roomId);
      });
      return;
    }
    portal.open = !portal.open;
    if (!portal.open) portal.passedAt = undefined;
    this.audio.door(portal.open ? 'open' : 'close', doorMat, door?.center);
    const target = portal.open && portal.targetRoomId ? portal.targetRoomId : null;
    const sample = target ? this.switchProfiler.begin('door', owner.roomId, target, this.world.graph.nodes.get(target)?.definitionId) : null;
    if (target) this.ensurePrepared(target);
    this.updateVisibility();
    // 開けた扉の先の隣接（ensureNeighbors で新たに配置された部屋）の素材を先に読む
    if (target) this.prefetchAhead();
    if (sample) this.switchProfiler.endSync(sample);
  }

  /** 施錠ヒント + 施錠音（Portal ごとに 1 回） */
  private lockedHint(portal: Portal, text: string, doorMat: string, center?: Vec3): void {
    this.hudHint.hint(text);
    const key = `${portal.portalId}@${portal.targetRoomId ?? ''}`;
    if (!this.lockedPlayed.has(key)) {
      this.lockedPlayed.add(key);
      this.audio.door('locked', doorMat, center);
    }
  }

  /**
   * 開いた扉の向こうの部屋を構築する。2 hop 先（隣室の隣）は prepareRoom では ensureNeighbors されていないことがあり、
   * 生の layout で構築すると後で prune / 床穴撤去 → rebuild が起きて目の前で部屋が変わる。先に接続先を確定してから構築する
   */
  private ensurePrepared(roomId: string): void {
    if (!this.streaming.built.has(roomId)) {
      this.world.ensureNeighbors(roomId);
      for (const id of [...this.world.dirty]) {
        if (id === this.currentRoomId) continue;
        // 見えている部屋だけ作り直す。保持中の非表示部屋は捨てて、必要になったときに構築する
        const b = this.streaming.built.get(id);
        if (b && b.group.visible) this.streaming.rebuild(id);
        else this.streaming.evict(id);
        this.world.dirty.delete(id);
      }
    }
    this.streaming.ensure(roomId);
  }

  /** 生の（戻り側を所有側に解決する前の）Portal が施錠されているか */
  private rawLocked(roomId: string, portalId: string): boolean {
    return !!this.world.graph.portal(roomId, portalId).locked;
  }

  /** 戻り側の Portal なら所有側（開閉状態を持つ側）の Portal に解決する */
  private ownerPortal(roomId: string, portalId: string) {
    const p = this.world.graph.portal(roomId, portalId);
    if (p.isReturn && p.targetRoomId && p.targetPortalId && this.world.graph.has(p.targetRoomId)) {
      const t = this.world.graph.get(p.targetRoomId).portals.find((x) => x.portalId === p.targetPortalId);
      if (t) return t;
    }
    return p;
  }

  /** Portal を所有する部屋（戻り側なら反対側） */
  private ownerRoom(roomId: string, portalId: string): RoomInstance {
    const p = this.world.graph.portal(roomId, portalId);
    if (p.isReturn && p.targetRoomId && this.world.graph.has(p.targetRoomId)) return this.world.graph.get(p.targetRoomId);
    return this.world.graph.get(roomId);
  }

  private elevatorHere(): { node: RoomInstance; portalId: string } | null {
    if (!this.currentRoomId) return null;
    const feet = this.player.feet;
    const probe: [number, number, number] = [feet[0], feet[1] + 1.0, feet[2]];
    for (const id of [this.currentRoomId, ...this.world.graph.placedNeighbors(this.currentRoomId)]) {
      const b = this.streaming.built.get(id);
      if (!b) continue;
      for (const e of b.elevators) {
        if (aabbContains(e.volume, probe, 0.1)) return { node: this.world.graph.get(id), portalId: e.socketId };
      }
    }
    return null;
  }

  private tryElevator(): void {
    const here = this.elevatorHere();
    if (!here) return;
    const portal = here.node.portals.find((p) => p.portalId === here.portalId);
    if (!portal) return;
    this.audio.elevator('move');
    this.transition(() => {
      if (here.node.isAdapter && portal.isReturn && portal.targetRoomId) {
        // 籠から元の階段室へ戻る
        const back = this.world.graph.get(portal.targetRoomId);
        const b = this.streaming.ensure(back.roomId);
        const vol = b?.elevators[0]?.volume;
        if (vol) {
          const c: [number, number, number] = [(vol.min[0] + vol.max[0]) / 2, vol.min[1] - 1.05, (vol.min[2] + vol.max[2]) / 2];
          this.player.teleport(c, this.player.yaw + Math.PI);
        } else {
          const sp = this.world.spawnPointOf(back);
          this.player.teleport(sp.spawn, sp.yaw);
        }
        this.enterRoom(back.roomId);
      } else {
        const res = this.world.resolveElevator(here.node, portal);
        this.player.teleport(res.spawn, res.yaw);
        this.enterRoom(res.car.roomId);
      }
      this.audio.elevator('bell');
    });
  }

  // ------------------------------------------------------------ ride (VehicleRide, Q5 = C)
  /**
   * 乗車を開始する。path / durationSec は layout.rides（socketId 一致）から、無ければその場で待つ 25 秒。
   * 到着（時間経過、または 5 秒後の E / タップ）で world.resolveRide の platform Adapter へ遷移する
   */
  startRide(node: RoomInstance, portal: Portal, opts: { path?: Vec3[]; durationSec?: number; allowSkipAfterSec?: number; shake?: number } = {}): boolean {
    if (this.state !== 'playing' || this.ride.riding || !node.placement) return false;
    const layout = this.world.layoutFor(node);
    const spec = layout.rides?.find((r) => r.socketId === portal.socketId);
    const placement = node.placement;
    const path = opts.path ?? (spec && spec.path.length > 0 ? spec.path.map((p) => toWorld(placement, p)) : [this.player.feet]);
    const durationSec = opts.durationSec ?? spec?.durationSec ?? 25;
    this.state = 'riding';
    // 乗車中の微振動は PlayerRide が担当。手持ち揺れ・ロール・視線の遅れは止める（stepBody でも毎フレーム同期）
    this.player.cameraFeelSuppressed = true;
    this.input.resetCrouchToggle();
    this.rideSound?.stop(0.2);
    this.rideSound = this.audio.play(spec?.vehicle === 'boat' ? 'waterFlow' : 'distantTrain', { loop: true, gain: 0.7 });
    // 既定値は rooms.json の VehicleRide params（skipAfterSec / shake）から。無ければ 5 s / 0.015
    const mp = modParams(this.defOf(node), 'VehicleRide');
    const numOr = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    this.ride.start({
      path,
      durationSec,
      allowSkipAfterSec: opts.allowSkipAfterSec ?? numOr(mp?.skipAfterSec, 5),
      shake: opts.shake ?? numOr(mp?.shake, 0.015),
      onArrive: () => this.finishRide(node, portal),
    });
    this.world.log.push(`INFO ride start ${node.roomId}/${portal.portalId} (${durationSec}s)`);
    return true;
  }

  private finishRide(node: RoomInstance, portal: Portal): void {
    this.rideSound?.stop(0.6);
    this.rideSound = null;
    this.state = 'playing';
    this.transition(() => {
      const res = this.world.resolveRide(node, portal);
      this.player.teleport(res.spawn, res.yaw);
      this.enterRoom(res.platform.roomId);
    });
  }

  /** 穴は真下の部屋へ物理的に落ちる。想定外に世界の外へ落ちた場合だけ入口へ戻す */
  private checkHole(): void {
    if (!this.currentRoomId || this.state !== 'playing') return;
    const node = this.world.graph.get(this.currentRoomId);
    const b = this.world.worldBounds.get(this.currentRoomId);
    if (!b) return;
    if (this.player.pos.y < b.min[1] - 8) {
      const sp = this.world.spawnPointOf(node);
      this.player.teleport(sp.spawn, sp.yaw);
    }
  }

  /**
   * 意図的 Seam の開口（street / gate など扉パネルの無い開口、または Modifier が開けた Seam 扉）を「壁面を越えて」通ったら座標遷移する。
   * 閉じた Seam 扉（Legendary 前室の end / FarLink）は対象外: E での開扉パス（checkCanOpen・開扉音）を経て interactRay が遷移する。
   * ride / 施錠は対象外
   */
  private checkSeamCrossing(): void {
    if (!this.currentRoomId || this.state !== 'playing') return;
    const node = this.world.graph.get(this.currentRoomId);
    const feet = this.player.feet;
    for (const p of node.portals) {
      if (!p.seam || !isDoorLike(p.type) || p.isReturn || p.ride || p.locked) continue;
      if (p.type === 'door' && !p.open) continue;
      const { pos, dir } = this.world.socketWorld(node, p.socketId);
      const out = dirVec(dir);
      const dx = feet[0] - pos[0];
      const dz = feet[2] - pos[2];
      // 外向き法線に沿った符号付き距離（面を越えたか）と、開口幅の中にいるか
      const along = dx * out[0] + dz * out[2];
      const across = dx * out[2] - dz * out[0];
      const halfW = this.world.socketOf(node, p.socketId).width / 2 + 0.3;
      if (along > 0.05 && along < 1.2 && Math.abs(across) < halfW && Math.abs(feet[1] - pos[1]) < 1.5) {
        this.transition(() => {
          const res = this.world.resolveSeamTarget(node, p);
          this.player.teleport(res.spawn, res.yaw);
          this.enterRoom(res.target.roomId);
        });
        return;
      }
    }
  }

  /** フェード付きの座標遷移（state 'playing' のときだけ） */
  transition(fn: () => void): void {
    if (this.state !== 'playing') return;
    this.state = 'transition';
    this.input.enabled = false;
    this.fade.style.opacity = '1';
    setTimeout(() => {
      try {
        fn();
      } catch (err) {
        const msg = `ERROR transition: ${err instanceof Error ? err.stack ?? err.message : String(err)}`;
        this.world?.log.push(msg);
        console.error(msg);
      }
      setTimeout(() => {
        this.fade.style.opacity = '0';
        this.state = 'playing';
        this.input.enabled = true;
      }, 150);
    }, 280);
  }

  // ------------------------------------------------------------ menu / start
  private onStartClick(): void {
    if (this.state !== 'start') return;
    // ユーザージェスチャ内で AudioContext を作る
    this.audio.unlock();
    this.startEl.hidden = true;
    this.state = 'playing';
    this.input.enabled = true;
    this.input.requestLock();
    this.timer.update();
  }

  private bindMenu(): void {
    const q = document.getElementById('quality') as HTMLSelectElement;
    q.addEventListener('change', () => {
      if (q.value === 'auto') {
        this.autoTier = true;
      } else {
        this.autoTier = false;
        this.setTier(q.value as QualityTierId);
      }
    });
    document.getElementById('menu-resume')!.addEventListener('click', () => this.closeMenu());
    document.getElementById('menu-save')!.addEventListener('click', () => {
      const ok = this.save();
      this.hud.setHint(ok ? 'セーブしました' : 'セーブに失敗しました');
      this.audio.ui(ok ? 'confirm' : 'error');
      this.closeMenu();
    });
    document.getElementById('menu-load')!.addEventListener('click', () => {
      if (this.loadWorld()) this.closeMenu();
      else this.hud.setHint('セーブデータがありません');
    });
    document.getElementById('menu-new')!.addEventListener('click', () => {
      this.newWorld();
      this.closeMenu();
    });
    document.getElementById('menu-debug')!.addEventListener('click', () => {
      this.debugOn = this.hud.toggleDebug();
    });
  }

  private mapPanelOpts() {
    return { rotation: this.mapView.rotation, hiddenRoomIds: this.mapView.hiddenRoomIds };
  }

  openMenu(): void {
    if (this.state !== 'playing') return;
    this.state = 'menu';
    this.input.enabled = false;
    this.input.exitLock();
    this.menuEl.hidden = false;
    this.audio.ui('open');
    document.getElementById('menu-count')!.textContent = String(this.world.graph.visitedCount);
    this.mapPanel.show(this.world, this.currentRoomId, { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw }, this.mapPanelOpts());
  }

  closeMenu(): void {
    if (this.state !== 'menu') return;
    this.mapPanel.hide();
    this.menuEl.hidden = true;
    this.state = 'playing';
    this.input.enabled = true;
    // Esc キーで閉じた場合はブラウザが Pointer Lock の再取得を拒否する（ユーザー操作扱いにならない）。
    // その場合は画面クリックで取り直せることを案内する（InputController の mousedown が requestLock する）
    void this.input.requestLock().then((ok) => {
      if (!ok && this.state === 'playing' && this.input.mode === 'pc' && this.input.useLock) this.hud.setHint('画面をクリックすると視点操作を再開します');
    });
    this.audio.ui('close');
    this.timer.update();
  }

  // ------------------------------------------------------------ quality
  setTier(id: QualityTierId): void {
    this.tierId = id;
    this.tier = QUALITY_TIERS[id];
    // applyPostFxConfig が composer を組み直してから resize（DPR 上限は composer の有無で変わる）
    this.applyPostFxConfig();
    (this.scene.fog as THREE.Fog).far = Math.min(this.envNow.designFar, this.tier.fogFar);
    this.camera.far = this.tier.fogFar + 10;
    this.camera.updateProjectionMatrix();
    this.builder.setTier(this.tier);
    this.materials.setTier(this.tier);
    this.doorLeaks.setTier(this.tier);
    this.audio.setTier(this.tier);
    this.snapshots.setTier(this.tier);
  }

  private resize(): void {
    // composer 使用時は Tier の maxPixelRatio で DPR を抑える（HiDPI での GTAO / bloom / MSAA の負荷。直接描画は従来の上限 2）
    const cap = this.postfx.active ? this.tier.maxPixelRatio : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, cap) * this.tier.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    // composer の RenderTarget（と GTAO / bloom の中間 RT）も同じ寸法・DPR で作り直す
    this.postfx.setSize(window.innerWidth, window.innerHeight, dpr);
  }

  /**
   * 設定（描画効果 / トーンマップ）と Tier からポスト処理を組む。
   * off = 直接描画 / clean = Tier の gtao・bloom・msaa / homeVideo・tape = clean + 撮像 pass（LensPass / VideoPass）。
   * low は Tier 側が全部 false なので直接描画（low の 'clean' は composer を組む価値が無いので film も off）
   */
  private applyPostFxConfig(): void {
    const d = this.settings.data;
    this.renderer.toneMapping = TONE_MAPPINGS[d.toneMapping];
    const t = this.tier.postfx;
    let film: FilmPreset = d.postfx;
    if (this.tier.id === 'low' && film === 'clean') film = 'off';
    const cfg: PostFXConfig = d.postfx === 'off'
      ? { gtao: false, bloom: false, msaa: 0, gtaoScale: t.gtaoScale, film: 'off' }
      : { gtao: t.gtao, bloom: t.bloom, msaa: t.msaa, gtaoScale: t.gtaoScale, film };
    this.postfx.configure(cfg);
    // 光漏れの加算強度は描画経路（composer の有無）で揃える
    this.doorLeaks.setDirectRender(!this.postfx.active);
    // DPR 上限が composer の有無で変わるので寸法を作り直す
    this.resize();
    // プリセットに連動するカメラ挙動と、pass の数値の設定による上書き（frameHold）
    this.applyCameraSettings();
  }

  /**
   * 設定（手持ち感 / 視線の遅れ / REC 表示 / 表示 fps）をカメラ挙動・撮像 pass に写す（担当 F2。docs/film-camera.md）。
   * composer は作り直さない。REC 表示の実際の表示切替は state を見て stepBody（updateRecOverlay）が行う
   */
  private applyCameraSettings(): void {
    const d = this.settings.data;
    this.player.feel.handheld = d.handheld;
    this.player.feel.lag = d.cameraLag;
    this.player.feel.preset = this.postfx.config.film;
    // 表示フレームレートの間引き: 'off' はプリセット値（configure / applyPreset が写した値）に戻す。'30' / '24' はプリセットに関係なく上書き
    const video = this.postfx.videoPass;
    if (video) {
      video.strength = d.vhsStrength;
      const preset = VIDEO_PRESETS[this.postfx.config.film];
      video.params.frameHold = d.frameHold === 'off' ? preset.frameHold : Number(d.frameHold);
      // 設定で間引きを強制したときは残像のブレンドも入れる（プリセットが 0 のままだと保持フレームが硬く切り替わる。担当 F1b の依頼）
      video.params.frameBlend = video.params.frameHold > 0 ? Math.max(preset.frameBlend, 0.06) : preset.frameBlend;
    }
    this.updateRecOverlay(0);
  }

  /** REC・タイムコード表示: 設定 recOverlay かつ playing / riding / transition のときだけ見せる。毎フレーム update */
  private updateRecOverlay(dt: number): void {
    const on = this.settings.data.recOverlay && (this.state === 'playing' || this.state === 'riding' || this.state === 'transition');
    if (on !== this.recOverlay.isVisible) this.recOverlay.setVisible(on);
    if (dt > 0) this.recOverlay.update(dt);
  }

  /**
   * 静止（移動入力も視線入力も無く、実速度もほぼ 0）の継続秒数。playing / riding の間だけ数え、メニュー中は保持する。
   * VideoPass（時間停止感）と PlayerController（手持ち揺れを 3 s で弱める）へ
   */
  private updateStillness(dt: number, input: InputState): void {
    if (this.state === 'playing' || this.state === 'riding') {
      const moving = Math.abs(input.moveX) > 0.01 || Math.abs(input.moveY) > 0.01 || input.jump || (this.state === 'playing' && this.player.horizontalSpeed > 0.3);
      const looking = input.lookDX !== 0 || input.lookDY !== 0;
      this.stillSec = moving || looking ? 0 : this.stillSec + dt;
    }
    this.postfx.setStillness(this.stillSec);
    this.player.setStillness(this.stillSec);
  }

  /**
   * 表示カメラ（遅れ・揺れを含む camera.rotation）の回転速度を LensPass の回転ブラーへ渡す（rad/s）。
   * テレポート（player.teleportSerial）と入室のフレームは 0（座標遷移を「振り向き」と誤認させない）
   */
  private updateCameraMotion(dt: number): void {
    const rot = this.camera.rotation;
    const jumped = this.player.teleportSerial !== this.lastTeleportSerial || this.roomEnteredFrame;
    this.lastTeleportSerial = this.player.teleportSerial;
    this.roomEnteredFrame = false;
    let yawRate = 0;
    let pitchRate = 0;
    if (!jumped && this.camMotionValid && dt > 0) {
      yawRate = wrapAngle(rot.y - this.prevCamYaw) / dt;
      pitchRate = wrapAngle(rot.x - this.prevCamPitch) / dt;
    }
    this.prevCamYaw = rot.y;
    this.prevCamPitch = rot.x;
    this.camMotionValid = true;
    this.camRates[0] = yawRate;
    this.camRates[1] = pitchRate;
    this.postfx.setCameraMotion(yawRate, pitchRate);
  }

  /**
   * 1 フレーム描画（直接描画か EffectComposer。PostFX が選ぶ）。影マップの更新はここでだけ行う。
   * 計測: postfx.timer に CPU 時間と GPU 時間（EXT_disjoint_timer_query_webgl2 があれば）を積む → game.perf()
   */
  renderFrame(): void {
    this.renderer.shadowMap.needsUpdate = true;
    this.postfx.timer.begin();
    this.postfx.render();
    this.postfx.timer.end();
  }

  /**
   * 直近 120 フレームの描画時間（ms。median / p95 / max）。gpu は拡張が無ければ null。
   * roomSwitch: 直近 24 回の入室 / 開扉について、同期部分と以後 30 フレームの最大 ms、追跡テクスチャのアップロード回数、
   * 新規 GL テクスチャ数、シェーダプログラムのコンパイル数（個別の記録は window.__roomSwitchProfile）
   */
  perf(): ReturnType<PostFX['timer']['stats']> & { pipeline: string; shadows: number; roomSwitch: ReturnType<RoomSwitchProfiler['summary']>; uploadsPending: number } {
    this.postfx.timer.poll();
    return { ...this.postfx.timer.stats(), pipeline: this.postfx.describe(), shadows: (this.streaming?.shadowCount ?? 0) + Number(this.flashlight.light.visible && this.flashlight.light.castShadow), roomSwitch: this.switchProfiler.summary(), uploadsPending: this.materials.uploads.pending };
  }

  private autoQuality(dt: number): void {
    if (!this.autoTier) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    this.tierCooldown -= 1;
    if (this.tierCooldown > 0) return;
    const order: QualityTierId[] = ['low', 'mid', 'high'];
    const i = order.indexOf(this.tierId);
    if (avg > 0.034 && i > 0) {
      this.setTier(order[i - 1]);
      this.tierCooldown = 3;
    } else if (avg < 0.012 && i < 2 && this.input.mode === 'pc') {
      this.setTier(order[i + 1]);
      this.tierCooldown = 3;
    }
  }

  // ------------------------------------------------------------ loop
  start(): void {
    this.renderer.setAnimationLoop(() => {
      try {
        this.frame();
      } catch (err) {
        // ループを止めない。原因は world.log とコンソールに残す
        const msg = `ERROR frame: ${err instanceof Error ? err.stack ?? err.message : String(err)}`;
        if (this.world && this.world.log[this.world.log.length - 1] !== msg) {
          this.world.log.push(msg);
          console.error(msg);
        }
      }
    });
  }

  private frame(): void {
    this.timer.update();
    this.step(Math.min(0.05, this.timer.getDelta()));
  }

  /** 1 フレーム分の更新（テストから同期的に呼べる。rAF に依存しない） */
  step(dt: number): void {
    const stepStart = performance.now();
    this.stepBody(dt, stepStart);
    this.switchProfiler.frame(performance.now() - stepStart);
  }

  private stepBody(dt: number, stepStart: number): void {
    const polled = this.input.poll();
    const input: InputState = this.devInput ? { ...polled, ...this.devInput } : polled;
    // R で懐中電灯のオン / オフ（メニュー中は無視）
    if (input.flashlight && this.state === 'playing') { this.flashlightOn = !this.flashlightOn; this.hud.setHint(this.flashlightOn ? '懐中電灯: オン' : '懐中電灯: オフ'); }
    if (input.menu) {
      if (this.state === 'playing') this.openMenu();
      else if (this.state === 'menu') this.closeMenu();
    }
    const now = performance.now() / 1000;
    // 手持ち揺れ・ロール・視線の遅れは乗車中（PlayerRide が微振動を担当）と E03（layout.roll）では掛けない
    this.player.cameraFeelSuppressed = this.state === 'riding' || this.roomHasRoll;
    this.updateStillness(dt, input);
    if (this.state === 'riding' && this.currentRoomId) {
      // 乗車中: 視点のみ。部屋判定・穴・Seam はスキップ（車内位置は部屋境界の外に出ることがある）
      // スマホのタップ（input.tap）も E と同じ「到着を早める」要求として扱う
      this.ride.update(dt, input.tap ? { ...input, interact: true } : input);
      this.proxy.update(dt, this.player);
      this.hud.setHint(this.ride.riding && this.ride.canSkip ? (this.input.mode === 'pc' ? 'E: 到着を早める' : 'タップ: 到着を早める') : (this.ride.riding ? '…' : ''));
    } else if (this.state === 'playing' && this.currentRoomId) {
      const ids = [this.currentRoomId, ...this.world.graph.placedNeighbors(this.currentRoomId)];
      const colliders = this.streaming.colliders(ids);
      const zones = this.playerZones(ids);
      this.player.update(dt, input, colliders, zones);
      this.proxy.update(dt, this.player);
      if (input.interact) this.interactRay({ x: 0, y: 0 });
      if (input.tap) this.interactRay(input.tap);
      const detected = this.detectRoom();
      if (detected && detected !== this.currentRoomId) this.enterRoom(detected);
      const closed = this.streaming.updateDoors(dt, now, this.player.pos, (_roomId, _portalId, center, doorMat) => this.audio.door('close', doorMat, center));
      if (closed > 0) this.refreshStreaming();
      else if (this.streaming.doorsChanged) this.updateVisibility();
      this.checkHole();
      this.checkSeamCrossing();
      this.updateHint();
      this.autoQuality(dt);
    }
    if (this.currentRoomId) {
      // Modifier のランタイム更新（現在部屋 + 可視部屋）と BuiltRoom.effects
      if (this.state === 'playing' || this.state === 'riding') {
        this.runModifierUpdates(dt, now);
      }
      // 後回しにした隣接部屋をフレーム予算の範囲で構築し（大きな部屋は複数フレームに分割）、新しい材質のシェーダは
      // 実描画と同じ条件（composer の RenderTarget）で非同期にコンパイルしておく
      if (this.streaming.pendingCount > 0 && this.streaming.buildPending(L2_FLAGS.split ? RoomStreamingManager.BUILD_BUDGET_MS : 4) > 0) this.updateVisibility();
      this.streaming.precompile(this.renderer, this.camera, this.compileRenderTarget(), this.tier);
      this.streaming.updateChunks(this.camera.position, this.tier.fogFar);
      this.streaming.updateLights(this.camera.position, this.tier, dt);
      this.updateEnvironment(dt);
      this.leakSyncAcc += dt;
      if (this.leakSyncAcc >= 0.25 && this.state === 'playing') this.syncDoorLeaks();
      this.doorLeaks.update(dt, now);
      this.hud.setCount(this.world.graph.visitedCount);
      // ミニマップは現在いるフロアだけ（左上にフロア名）
      drawMap(this.minimap, this.world, this.currentRoomId, { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw }, {
        center: [this.player.pos.x, this.player.pos.z], pxPerCell: 7, level: levelOf(this.world, this.currentRoomId), label: true,
        rotation: this.mapView.rotation || undefined, hiddenRoomIds: this.mapView.hiddenRoomIds,
      });
      if (this.debugOn) this.updateDebug(dt);
    }
    if (this.state === 'menu') {
      this.mapPanel.setView(this.mapPanelOpts());
      this.mapPanel.update();
    }
    this.materials.update(dt);
    const cam = this.camera.position;
    this.audio.setListener([cam.x, cam.y, cam.z], this.player.yaw, this.player.pitch);
    this.audio.update(dt);
    // 撮像 pass への入力: 表示カメラの回転速度（回転ブラー）・環境音の大きさ（暗部ノイズ）。REC 表示の更新
    this.flashlight.update(this.camera, this.state === 'menu' ? 0 : dt, this.flashlightOn && !!this.currentRoomId && this.state !== 'start', this.tier.id === 'low');
    this.updateCameraMotion(dt);
    this.postfx.setAudioNoise(this.audio.ambientLevel);
    this.updateRecOverlay(dt);
    // 読込済みテクスチャの先行アップロード（1 フレームに数枚。更新に余裕があるフレームだけ。docs/perf-room-switch.md）
    this.materials.uploads.flush(this.renderer, performance.now() - stepStart);
    this.renderFrame();
  }

  private runModifierUpdates(dt: number, now: number): void {
    const cur = this.currentRoomId!;
    // 現在部屋（未構築でも呼ぶ）
    const curCtx = this.ctxFor(cur, this.streaming.built.get(cur) ?? null, now);
    if (curCtx) {
      try { runUpdate(dt, curCtx, curCtx.def ?? null); } catch (e) { console.warn('[modifiers] update failed', cur, e); }
    }
    // 可視部屋
    for (const [id, b] of this.streaming.built) {
      if (id === cur || !b.group.visible) continue;
      const ctx = this.ctxFor(id, b, now);
      if (!ctx) continue;
      try { runUpdate(dt, ctx, ctx.def ?? null); } catch (e) { console.warn('[modifiers] update failed', id, e); }
    }
    this.streaming.updateEffects(dt, (id, b) => this.ctxFor(id, b, now));
  }

  private updateHint(): void {
    if (this.state !== 'playing') return;
    const now = performance.now() / 1000;
    const pc = this.input.mode === 'pc';
    const key = pc ? 'E' : 'タップ';
    // interactRay と同じ優先順: 視線上の扉/ボタン → 籠の中なら乗車
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 2.5;
    const hits = this.raycaster.intersectObjects(this.streaming.interactables(), false);
    this.hintBusy = hits.length > 0;
    if (hits.length > 0) {
      const ud = hits[0].object.userData as { roomId: string; portalId: string; kind: string; crawl?: boolean };
      if (ud.kind === 'elevator') {
        this.hud.setHint(`${key}: エレベーターに乗る`);
        return;
      }
      const portal = this.ownerPortal(ud.roomId, ud.portalId);
      if (portal.locked || this.rawLocked(ud.roomId, ud.portalId)) { this.hud.setHint(DEFAULT_LOCKED_HINT); return; }
      const owner = this.ownerRoom(ud.roomId, ud.portalId);
      const ctx = this.ctxFor(owner.roomId);
      const can = ctx ? checkCanOpen(portal, ctx, this.defOf(owner)) : { ok: true as const };
      if (!can.ok) { this.hud.setHint(can.hint ?? DEFAULT_LOCKED_HINT); return; }
      if (portal.ride) { this.hud.setHint(`${key}: 乗る`); return; }
      const crawl = portal.crawl || ud.crawl;
      this.hud.setHint(portal.open ? `${key}: 扉を閉める` : `${key}: 扉を開ける${crawl ? '（しゃがんで通る）' : ''}`);
      return;
    }
    if (this.elevatorHere()) {
      this.hintBusy = true;
      this.hud.setHint(`${key}: エレベーターに乗る`);
      return;
    }
    if (this.extHint && this.extHint.until > now) {
      this.hud.setHint(this.extHint.text);
      return;
    }
    this.extHint = null;
    this.hud.setHint('');
  }

  private updateDebug(dt: number): void {
    const info = this.renderer.info;
    const st = this.streaming.stats();
    const p = this.perf();
    const ms = (s: { median: number; p95: number } | null) => (s ? `${s.median.toFixed(1)} (p95 ${s.p95.toFixed(1)})` : 'n/a');
    this.hud.setDebug(
      `fps ${(1 / Math.max(dt, 1e-4)).toFixed(0)}  tier ${this.tierId}${this.autoTier ? ' (auto)' : ''}  state ${this.state}\n` +
      `calls ${info.render.calls}  tris ${info.render.triangles}\n` +
      `render cpu ${ms(p.cpu)} ms  gpu ${ms(p.gpu)} ms  ${p.pipeline}  shadows ${p.shadows}  tm ${this.settings.data.toneMapping} exp ${this.renderer.toneMappingExposure}\n` +
      `rooms built ${st.rooms}  chunks ${st.chunks}  effects ${st.effects}  nodes ${this.world.graph.nodes.size}  leaks ${this.doorLeaks.count} (${this.doorLeaks.triangles} tris)\n` +
      `colliders near ${this.player.debugColliders}  crouch ${this.player.crouching ? 'yes' : 'no'}  h ${this.player.heightNow.toFixed(2)}\n` +
      `room ${this.currentRoomId}  pos ${this.player.pos.x.toFixed(1)} ${this.player.pos.y.toFixed(1)} ${this.player.pos.z.toFixed(1)}\n` +
      `cam bob ${(this.player.cameraFeel.y * 1000).toFixed(1)} mm  roll ${(this.player.cameraFeel.roll * 180 / Math.PI).toFixed(2)}°  fov ${this.camera.fov.toFixed(2)}  ` +
      `rate ${this.camRates[0].toFixed(2)} ${this.camRates[1].toFixed(2)} rad/s  still ${this.stillSec.toFixed(1)} s  noise ${this.audio.ambientLevel.toFixed(2)}  ` +
      `lens exp ${this.postfx.lensPass ? this.postfx.lensPass.exposureGain.toFixed(2) : '-'}${this.player.cameraFeelSuppressed ? '  (feel off)' : ''}\n` +
      `audio ${this.audio.context?.state ?? 'none'}  preset ${this.audio.currentPreset}\n` +
      (this.world.log.length ? `log ${this.world.log[this.world.log.length - 1]}` : ''),
    );
  }
}
