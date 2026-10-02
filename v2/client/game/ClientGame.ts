/**
 * クライアントのゲーム本体（v1 game/Game.ts の作り直し。継承計画 3 章の C 区分）。
 *
 * 1 フレームの流れ:
 *   入力（マウスの差分を視線に積算）→ 固定 tick でシミュレーションを進める（足りない分は次のフレームへ）→
 *   イベント（足音・扉・出現）を音と見た目に → プレイヤーの位置を tick の間で補間 → カメラの演出 → 部品の見た目 →
 *   照明（プール）→ 撮像ルック（PostFX）で描く
 *
 * シミュレーションはクライアントの中で回す（1 人で遊ぶときの「手元のサーバー」。継承計画 2 章）。
 * 描画・音・入力は v1 から移したモジュール（client/render・audio・input・ui）を使う。
 */
import * as THREE from 'three';
import type { Tuning } from '../../core/config/tuning.ts';
import { PhysicsWorld } from '../../core/physics/world.ts';
import { loadRapier } from '../../core/physics/rapier.ts';
import { partDef } from '../../core/sim/part.ts';
import '../../core/sim/parts/index.ts';
import { horizontalSpeed } from '../../core/sim/player.ts';
import { Sim } from '../../core/sim/sim.ts';
import type { InputCommand, SimEvent } from '../../core/sim/types.ts';
import type { FloorLayout, MatId } from '../../core/world/layout.ts';
import { AudioEngine } from '../audio/AudioEngine.ts';
import { CameraRig } from '../camera/CameraRig.ts';
import { IS_MOBILE } from '../device.ts';
import { InputController, type InputState } from '../input/InputController.ts';
import { MaterialLibrary } from '../render/MaterialLibrary.ts';
import { DEFAULT_EXPOSURE, PostFX, type PostFXConfig } from '../render/PostFX.ts';
import { setBevelQuality } from '../render/SurfaceGeometry.ts';
import type { FilmPreset } from '../render/FilmPreset.ts';
import { mobileTier, QUALITY_TIERS, type QualityTier, type QualityTierId } from '../render/quality.ts';
import { Settings } from '../settings/Settings.ts';
import type { UiRefs } from '../ui/dom.ts';
import { PlayerFlashlight } from '../render/PlayerFlashlight.ts';
import type { ViewContext } from '../views/index.ts';
import { PortalRenderer } from '../world/Portals.ts';
import { applyLampLevels, cellAt, FloorBuilder, type BuiltFloor } from '../world/FloorBuilder.ts';
import { LightManager } from '../world/LightManager.ts';
import { restoreCarry, watchCarry } from './carryStore.ts';
import { StoryView } from '../world/StoryView.ts';
import type { StoryWorld } from '../../core/stream/story.ts';
import type { StoryChange, WorldSession } from '../../core/stream/session.ts';

const TONE_MAPPINGS = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping } as const;
/** 環境（霧・空の色）の補間時間 */
/** 縦穴の中の霧の色 */
const BLACK = new THREE.Color(0, 0, 0);
const ENV_LERP_SEC = 0.8;

export interface GameOptions {
  canvas: HTMLCanvasElement;
  ui: UiRefs;
  tuning: Tuning;
}

export class ClientGame {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.05, 150);
  /** 窓・枠の向こうに別の所を描く（段階 4 warp で足した） */
  private readonly portals = new PortalRenderer();
  private mainVisible: ReadonlySet<string> | null = null;
  readonly rig: CameraRig;
  readonly materials = new MaterialLibrary();
  readonly settings: Settings;
  readonly audio: AudioEngine;
  readonly input: InputController;
  readonly postfx: PostFX;
  readonly tuning: Tuning;
  readonly ui: UiRefs;
  /** フロア（フロア単位の生成）の Sim。果てしない階では session の今の階の Sim */
  private legacySim: Sim | null = null;
  /** 果てしない階（docs/endless-world.md）。フロアを遊ぶときは null */
  session: WorldSession | null = null;
  /** 今の階（フロア）の描画 */
  story: StoryView | null = null;
  /** 階段室の向こうの階の描画（作っておく） */
  private readonly beyondViews = new Map<StoryWorld, StoryView>();
  private readonly builder: FloorBuilder;
  /** 階を移った（main が地図・表示を替える） */
  onStoryChange: ((c: StoryChange) => void) | null = null;
  /** Sim のイベントを全部受け取る（main が置いた物の保存に使う） */
  readonly eventTaps = new Set<(e: SimEvent) => void>();
  tier: QualityTier;
  paused = true;
  /** フロアの出口に入った（main がつぎのフロアを読む） */
  onFloorExit: ((exitId: string, kind: string, to: string | null) => void) | null = null;
  /** 毎フレーム（入力を読んでシミュレーションを進めた後・描く前）。地図（client/map/MapController）が使う */
  onFrame: ((input: InputState, dt: number) => void) | null = null;

  private readonly hemi = new THREE.HemisphereLight(0xe5e4d5, 0x6c665a, 0.1);
  private lightsPool: LightManager;
  /** 見える区画（cell and portal）。開発用に ?cull=off で全部描く */
  cull = typeof location === 'undefined' || new URLSearchParams(location.search).get('cull') !== 'off';
  private yaw = 0;
  private pitch = 0;
  private acc = 0;
  private last = 0;
  private pendingJump = false;
  private pendingDrop = false;
  /** 懐中電灯（v1 と同じく最初は点いている。R で切り替え） */
  private flashlight: PlayerFlashlight | null = null;
  flashlightOn = true;
  /** 置いた物の保存をやめて書く（フロアを離れるとき） */
  private carryWatch: (() => void) | null = null;
  private pendingInteract: { yaw: number; pitch: number } | null = null;
  private prevPos: [number, number, number] = [0, 0, 0];
  private currentCell: string | null = null;
  private env = { fog: new THREE.Color(0x0b0d14), near: 8, far: 46, sky: new THREE.Color(0x8a90a0), ground: new THREE.Color(0x60646f) };
  private envFrom = { ...this.env, fog: this.env.fog.clone(), sky: this.env.sky.clone(), ground: this.env.ground.clone() };
  private envTo = { ...this.env, fog: this.env.fog.clone(), sky: this.env.sky.clone(), ground: this.env.ground.clone() };
  private envT = ENV_LERP_SEC;
  private prevCamYaw = 0;
  private prevCamPitch = 0;
  private revealAnim: { meshes: THREE.Mesh[]; t: number; style: string; hide: boolean }[] = [];
  private readonly lampLevel = (id: string): number => {
    const v = this.sim?.outputOf(id, 'level');
    return v === undefined ? 1 : v;
  };

  /** 今の Sim（フロアか、果てしない階の今の階） */
  get sim(): Sim | null {
    return this.session ? this.session.active.sim : this.legacySim;
  }

  /** 今の階の区画（作った物） */
  get built(): BuiltFloor | null {
    return this.story?.built ?? null;
  }

  constructor(o: GameOptions) {
    this.tuning = o.tuning;
    this.ui = o.ui;
    this.renderer = new THREE.WebGLRenderer({ canvas: o.canvas, antialias: !IS_MOBILE, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMappingExposure = DEFAULT_EXPOSURE;
    this.renderer.shadowMap.enabled = false;
    this.settings = Settings.load();
    this.tier = this.tierFor(this.settings.data.tier === 'auto' ? (IS_MOBILE ? 'mid' : 'high') : this.settings.data.tier);
    this.materials.configure(this.renderer);
    this.materials.setTier(this.tier);
    this.builder = new FloorBuilder(this.materials, { tier: this.tier.id });
    setBevelQuality(this.tier.id);
    this.scene.fog = new THREE.Fog(0x0b0d14, 8, 46);
    this.scene.background = new THREE.Color(0x050608);
    this.scene.add(this.hemi);
    this.scene.add(this.camera);
    this.rig = new CameraRig(this.camera);
    this.lightsPool = new LightManager(this.scene, this.tier.maxLights);
    this.flashlight = new PlayerFlashlight(this.scene);
    // v2 は影を光の焼き込み（ライトマップ）で表すので、懐中電灯も影を落とさない（影マップを作らない）
    this.flashlight.light.castShadow = false;
    this.audio = new AudioEngine(this.settings);
    this.input = new InputController(o.canvas, o.ui.input);
    this.input.sensitivityScale = this.settings.data.lookSensitivity;
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);
    this.settings.onChange((d, changed) => {
      this.input.sensitivityScale = d.lookSensitivity;
      if (changed.includes('tier')) this.setTier(d.tier === 'auto' ? (IS_MOBILE ? 'mid' : 'high') : d.tier);
      else this.applyPostFxConfig();
    });
    this.applyPostFxConfig();
    addEventListener('resize', () => this.resize());
  }

  private tierFor(id: QualityTierId): QualityTier {
    return IS_MOBILE ? mobileTier(QUALITY_TIERS[id]) : QUALITY_TIERS[id];
  }

  setTier(id: QualityTierId): void {
    this.tier = this.tierFor(id);
    this.materials.setTier(this.tier);
    this.builder.tier = this.tier.id;
    setBevelQuality(this.tier.id);
    this.audio.setTier(this.tier);
    this.lightsPool.resize(this.tier.maxLights);
    this.camera.far = this.tier.fogFar + 10;
    this.camera.updateProjectionMatrix();
    this.applyPostFxConfig();
  }

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
    this.rig.feel.handheld = d.handheld;
    this.rig.feel.lag = d.cameraLag;
    this.rig.feel.preset = this.postfx.config.film;
    this.resize();
  }

  private resize(): void {
    const cap = this.postfx.active || IS_MOBILE ? this.tier.maxPixelRatio : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, cap) * this.tier.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.postfx.setSize(window.innerWidth, window.innerHeight, dpr);
  }

  // ---------------------------------------------------------------- フロア
  /** 部品の描画の入れ物（root）から ViewContext を作る（StoryView が区域ごとに使う） */
  private viewContext(root: THREE.Group, built: BuiltFloor, sim: Sim, onEvent: NonNullable<ViewContext['onEvent']>): ViewContext {
    return { root, materials: this.materials, built, sim, levelOf: this.lampLevel, audio: this.audio, postfx: this.postfx, camera: this.camera, scene: this.scene, onEvent, quality: () => this.tier, portals: this.portals };
  }

  private storyView(world: StoryWorld | null, sim: () => Sim, name: string): StoryView {
    return new StoryView({ builder: this.builder, renderer: this.renderer, scene: this.scene, camera: this.camera, viewContext: (r, b, s, f) => this.viewContext(r, b, s, f) }, world, sim, name);
  }

  /**
   * フロアを読む。saveKey: 置いた物が残る（I09）の保存の鍵（世界の seed・フロア・調整表の版。見本・実験場では渡さない）
   */
  async loadFloor(floor: FloorLayout, opts: { saveKey?: string } = {}): Promise<void> {
    this.unloadFloor();
    const needsPhysics = floor.entities.some((e) => partDef(e.type)?.physics);
    const physics = needsPhysics ? new PhysicsWorld(await loadRapier(), 1 / this.tuning['physics.tickHz']) : null;
    const sim = new Sim(floor, { tuning: this.tuning, physics });
    this.legacySim = sim;
    // 置いた物の保存を、最初の tick の前に戻す
    if (opts.saveKey) restoreCarry(sim, opts.saveKey);
    // 部品の描画は部品ごとの入れ物に入れ、区画と一緒に隠す（見えない区画の物が暗闇に浮いて見えないように。描く量も減る）
    const story = this.storyView(null, () => sim, floor.id);
    story.addRegion('', floor);
    story.buildAll();
    this.story = story;
    this.scene.add(story.root);
    if (opts.saveKey) this.carryWatch = watchCarry(sim, opts.saveKey, (f) => { story.listeners.add(f); return () => story.listeners.delete(f); });
    this.warmUp(story.root);
    this.afterLoad(floor.fog);
  }

  /**
   * 果てしない階を始める（docs/endless-world.md）。session は最初の区域を受け取った後のもの。最初の区域は今すぐ作り、ほかは毎フレーム少しずつ
   */
  startWorld(session: WorldSession): void {
    this.unloadFloor();
    this.session = session;
    const w = session.active;
    const story = this.storyView(w, () => w.sim, `${w.story.depth}.${w.story.variant}`);
    w.ready = (id) => story.regionReady(id);
    this.story = story;
    this.scene.add(story.root);
    this.syncStory(story, Infinity);
    story.buildAll();
    story.syncGates();
    this.warmUp(story.root);
    this.afterLoad(w.sim.floor.fog);
  }

  private afterLoad(fog: FloorLayout['fog']): void {
    const p = this.sim!.players[0]!;
    this.yaw = p.yaw;
    this.pitch = p.pitch;
    this.prevPos = [...p.pos];
    if (fog) {
      this.envTo.fog.setHex(fog.color);
      this.envTo.near = fog.near;
      this.envTo.far = fog.far;
    }
    this.currentCell = null;
    this.enterCell(true);
    this.rig.snap(this.subject(1));
  }

  /** 階の区域の出し入れを描画に写し、時間 budget まで作る（今いる区域を先に） */
  private syncStory(view: StoryView, budget: number): number {
    const w = view.world;
    if (!w) return 0;
    for (const c of w.drainChanges()) {
      if (c.type === 'add') { const L = w.regionLayout(c.id); if (L) view.addRegion(c.id, L); }
      else view.removeRegion(c.id);
    }
    // 入ってすぐ（変わったことを取り出す前）の区域も足す
    for (const r of w.regions) view.addRegion(r.plan.id, r.layout);
    const p = w.sim.players[0];
    const cur = p ? w.planAt(p.pos[0], p.pos[2]).id : undefined;
    const used = budget > 0 ? view.pump(budget, cur) : 0;
    view.syncGates();
    return used;
  }

  /** 果てしない階の毎フレームの描画の用意: 今の階と、作ってある向こうの階 */
  private syncWorld(): void {
    const s = this.session;
    if (!s || !this.story) return;
    const budget = this.tuning['world.buildMs'] * (IS_MOBILE ? 0.6 : 1);
    const used = this.syncStory(this.story, budget);
    // 向こうの階: 作り始めた階に描画を付け、捨てた階の描画を捨てる。残りの時間で作る
    const worlds = new Set(s.beyondWorlds());
    for (const [w, v] of this.beyondViews) if (!worlds.has(w)) { v.dispose(); this.beyondViews.delete(w); }
    let left = budget - used;
    for (const w of worlds) {
      let v = this.beyondViews.get(w);
      if (!v) {
        v = this.storyView(w, () => w.sim, `${w.story.depth}.${w.story.variant}`);
        const view = v;
        w.ready = (id) => view.regionReady(id);
        this.beyondViews.set(w, v);
      }
      left -= this.syncStory(v, Math.max(1, left));
    }
  }

  /** 向こうの階を見せられるか（区域を全部作り終えた。session の ready） */
  storyReady(w: StoryWorld): boolean {
    const v = this.beyondViews.get(w);
    return !!v && v.allReady() && w.regions.every((r) => v.regionReady(r.plan.id));
  }

  /** 階を移った: 描画を入れ替え、カメラを同じだけずらす（同じ形の階段室の中なので見た目は変わらない） */
  private swapStory(c: StoryChange): void {
    const s = this.session;
    if (!s || !this.story) return;
    const next = this.beyondViews.get(s.active);
    if (!next) return;
    const prev = this.story;
    this.beyondViews.delete(s.active);
    const prevWorld = prev.world;
    if (prevWorld) this.beyondViews.set(prevWorld, prev);
    prev.root.removeFromParent();
    this.scene.add(next.root);
    this.story = next;
    if (c.seamless) {
      this.prevPos = [this.prevPos[0] + c.dx, this.prevPos[1] + c.dy, this.prevPos[2] + c.dz];
      this.yaw += c.dYaw;
      this.rig.shiftYaw(c.dYaw);
      this.prevCamYaw += c.dYaw;
    } else {
      // 暗転して移った: 視点をそのまま新しい所へ
      const p = s.active.sim.players[0]!;
      this.prevPos = [...p.pos];
      this.yaw = p.yaw;
      this.pitch = 0;
      this.rig.snap(this.subject(1));
    }
    this.flashlight?.reset();
    this.currentCell = null;
    this.enterCell(true);
    // 照明の割り当ても、新しい階の同じ形の階段室の照明へすぐに（なめらかに替えると一瞬暗くなる）
    const cam = new THREE.Vector3(this.camera.position.x + c.dx, this.camera.position.y + c.dy, this.camera.position.z + c.dz);
    const cell = cellAt(next.built, [cam.x, cam.y - 1.5, cam.z]);
    this.lightsPool.snap(next.built, cam, this.lampLevel, cell ? new Set([cell.id]) : null);
    this.onStoryChange?.(c);
  }

  /**
   * 読み込みの最後に、全部を 1 度描いてシェーダを作り、テクスチャを GPU へ送っておく（画面は暗転か一時停止の画面の下）。
   * これをしないと、まだ見ていない区画が初めて見えたとき（扉を開けた瞬間など）にその場で作るので 0.3〜0.5 秒止まる
   */
  private warmUp(root: THREE.Object3D): void {
    const saved: { o: THREE.Object3D; visible: boolean; culled: boolean }[] = [];
    root.traverse((o) => {
      saved.push({ o, visible: o.visible, culled: o.frustumCulled });
      o.visible = true;
      o.frustumCulled = false;
    });
    const textures = new Set<THREE.Texture>();
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
      }
    });
    for (const t of textures) this.renderer.initTexture(t);
    // 懐中電灯は消灯中も強度 0 で点けておく（灯の数が変わると全材質のシェーダが作り直される）
    if (this.flashlight) this.flashlight.light.visible = true;
    this.postfx.render();
    for (const s of saved) { s.o.visible = s.visible; s.o.frustumCulled = s.culled; }
  }

  unloadFloor(): void {
    // 置いた物を保存してから捨てる
    this.carryWatch?.();
    this.carryWatch = null;
    this.story?.dispose();
    this.story = null;
    for (const v of this.beyondViews.values()) v.dispose();
    this.beyondViews.clear();
    this.legacySim?.physics?.dispose();
    this.legacySim = null;
    if (this.session) {
      this.session.active.sim.physics?.dispose();
      for (const w of this.session.beyondWorlds()) w.sim.physics?.dispose();
      this.session = null;
    }
    this.currentCell = null;
  }

  // ---------------------------------------------------------------- ループ
  start(): void {
    this.last = performance.now();
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  /** 開始・再開（ユーザー操作の中で呼ぶ: 音の解錠と Pointer Lock） */
  async resume(): Promise<void> {
    this.audio.unlock();
    this.paused = false;
    this.input.enabled = true;
    await this.input.requestLock();
  }

  pause(): void {
    this.paused = true;
    this.input.enabled = false;
    this.input.exitLock();
  }

  /** 開発用: プレイヤーを pos へ移す（見本のフロアのワープ）。視点もすぐ合わせる */
  teleport(pos: readonly [number, number, number], yaw: number): void {
    if (!this.sim) return;
    this.sim.teleport(0, [pos[0], pos[1], pos[2]], yaw);
    this.acc = 0;
    this.handleEvents(this.sim.drainEvents());
  }

  /** テスト用: 1 tick 進める（ペインが隠れて rAF が止まるときの確認用）。果てしない階では区域の描画も少し作る */
  stepOnce(cmd: Partial<InputCommand> = {}): void {
    if (!this.sim) return;
    const p = this.sim.players[0]!;
    this.syncWorld();
    this.tick([{ moveX: 0, moveY: 0, yaw: p.yaw, pitch: p.pitch, jump: false, dash: false, crouch: false, interact: null, flashlight: this.flashlightOn, ...cmd }]);
  }

  /** 1 tick 進め、イベントを受ける。果てしない階では階の入れ替えも */
  private tick(cmds: InputCommand[]): void {
    const s = this.session;
    if (s) {
      const before = s.active;
      s.step(cmds);
      this.handleEvents(before.sim.drainEvents());
      for (const c of s.drainChanges()) this.swapStory(c);
    } else this.legacySim?.step(cmds);
    if (this.sim) this.handleEvents(this.sim.drainEvents());
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.syncWorld();
    const sim = this.sim;
    const input = this.input.poll();
    // メニュー（Esc / 右上）: 開くだけ。閉じるのは一時停止の画面の「再開」（Pointer Lock はユーザー操作の中でしか取れない）
    if (input.menu && !this.paused) { this.pause(); this.ui.setPauseVisible(true); this.audio.ui('open'); }
    if (sim && !this.paused) {
      this.yaw -= input.lookDX;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch - input.lookDY));
      if (input.jump) this.pendingJump = true;
      if (input.drop) this.pendingDrop = true;
      if (input.flashlight) {
        this.flashlightOn = !this.flashlightOn;
        this.ui.setHint(this.flashlightOn ? '懐中電灯: オン' : '懐中電灯: オフ');
        window.setTimeout(() => this.ui.setHint(''), 1500);
      }
      if (input.interact) this.pendingInteract = { yaw: this.yaw, pitch: this.pitch };
      if (input.tap) this.pendingInteract = this.tapDirection(input.tap);
      this.acc += dt;
      const step = sim.dt;
      let n = 0;
      while (this.acc >= step && n < 8) {
        this.prevPos = [...this.sim!.players[0]!.pos];
        // tick ごとにイベントを受ける（継ぎ目の無い移動の補間の始点・向きを、次の tick の前に直すため。warp で足した）
        this.tick([this.command(input)]);
        this.pendingJump = false;
        this.pendingDrop = false;
        this.pendingInteract = null;
        this.acc -= step;
        n++;
      }
      if (n === 8) this.acc = 0;
      if (this.sim) this.handleEvents(this.sim.drainEvents());
    }
    this.onFrame?.(input, dt);
    this.render(dt);
  }

  private command(input: InputState): InputCommand {
    return { moveX: input.moveX, moveY: input.moveY, yaw: this.yaw, pitch: this.pitch, jump: this.pendingJump, dash: input.dash, crouch: input.crouch, interact: this.pendingInteract, drop: this.pendingDrop, flashlight: this.flashlightOn, ...(this.audio.loudness.micAvailable ? { voice: this.audio.loudness.level() } : {}) };
  }

  /** タップした画面の位置（NDC）を、視線の向きにする */
  private tapDirection(tap: { x: number; y: number }): { yaw: number; pitch: number } {
    const v = new THREE.Vector3(tap.x, tap.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return { yaw: Math.atan2(-v.x, -v.z), pitch: Math.asin(Math.max(-1, Math.min(1, v.y))) };
  }

  private subject(alpha: number) {
    const p = this.sim!.players[0]!;
    const a = Math.max(0, Math.min(1, alpha));
    return {
      pos: [this.prevPos[0] + (p.pos[0] - this.prevPos[0]) * a, this.prevPos[1] + (p.pos[1] - this.prevPos[1]) * a, this.prevPos[2] + (p.pos[2] - this.prevPos[2]) * a] as [number, number, number],
      eye: p.eye,
      // 視線は入力のまま（tick を待たずに回す）
      yaw: this.paused ? p.yaw : this.yaw,
      pitch: this.paused ? p.pitch : this.pitch,
      onGround: p.onGround,
      crouching: p.crouching,
      moveRank: p.moveRank,
      strideAcc: p.strideAcc,
      strideCount: p.strideCount,
      horizontalSpeed: horizontalSpeed(p),
      stillSec: p.stillSec,
      // 段階 4・移動と身体: 重力の向き（壁・天井を歩いている間、カメラを回す）
      grav: p.grav,
    };
  }

  // ---------------------------------------------------------------- イベント → 音・見た目
  private handleEvents(events: SimEvent[]): void {
    const sim = this.sim;
    if (!sim || !this.built) return;
    const listeners = this.story?.listeners;
    for (const e of events) {
      if (listeners) for (const f of listeners) f(e);
      for (const f of this.eventTaps) f(e);
      switch (e.type) {
        case 'player.stride': {
          const mat = e.data?.water ? 'waterShallow' : this.surfaceUnder();
          this.audio.footstep(mat, (e.data?.rank as 'walk' | 'dash') ?? 'walk', !!e.data?.crouch);
          break;
        }
        case 'player.land': this.audio.land(Number(e.data?.speed ?? 2), this.surfaceUnder()); break;
        case 'player.jump': this.audio.jump(this.surfaceUnder()); break;
        case 'player.respawn': {
          if (e.data?.cause === 'warp' && e.data?.seamless) {
            // 継ぎ目なく移す: 補間の始点を同じだけずらし、カメラは切り替えない（同じ形の所どうしなので見た目が変わらない）
            this.prevPos = [this.prevPos[0] + Number(e.data.dx ?? 0), this.prevPos[1] + Number(e.data.dy ?? 0), this.prevPos[2] + Number(e.data.dz ?? 0)];
            this.yaw += Number(e.data.dYaw ?? 0);
            this.flashlight?.reset();
            // 表示の視線の遅れと撮像の回転の速さも同じだけ回し、移った先の区画をすぐ今の区画にする（入室の演出を出さない）
            this.rig.shiftYaw(Number(e.data.dYaw ?? 0));
            this.prevCamYaw += Number(e.data.dYaw ?? 0);
            this.enterCell(true);
            break;
          }
          this.rig.snap(this.subject(1)); this.prevPos = [...sim.players[0]!.pos]; this.yaw = sim.players[0]!.yaw; this.pitch = 0;
          this.flashlight?.reset();
          break;
        }
        case 'cue': {
          const name = String(e.data?.name ?? '');
          if (name === 'door.open' || name === 'door.close' || name === 'door.locked') {
            this.audio.door(name.slice(5) as 'open' | 'close' | 'locked', String(e.data?.mat ?? 'doorWood') as MatId, e.pos);
          } else if (name === 'button.press') this.audio.ui('confirm');
          else if (name === 'beacon') this.audio.play(String(e.data?.kind ?? 'chime'), { pos: e.pos, gain: Number(e.data?.gain ?? 0.8) });
          else if (name === 'bounce') this.audio.play('thud', { pos: e.pos, gain: 0.6 });
          else if (name === 'crumble.shake') this.audio.play('clank', { pos: e.pos, gain: 0.35 });
          else if (name === 'crumble.fall') this.audio.play('thud', { pos: e.pos, gain: 0.8 });
          else if (name === 'mannequin.caught') { this.audio.play('shutter', { gain: 0.9 }); this.postfx.videoPass?.forceJitter?.(); }
          else if (name === 'guide.arrive') this.audio.play('chime', { pos: e.pos, gain: 0.4 });
          else if (name === 'lamp.on') this.audio.play('clank', { pos: e.pos, gain: 0.15 });
          // 部品が頼むフロアの移動（エレベーター・沈む床。段階 4 の ground）: data.to は 'depth.variant'（無ければ 1 つ下の表のフロア）
          else if (name === 'floor.goto') this.onFloorExit?.(String(e.entity ?? ''), String(e.data?.kind ?? 'elevator'), e.data?.to ? String(e.data.to) : null);
          break;
        }
        case 'reveal': this.onReveal(String(e.data?.group ?? ''), String(e.data?.style ?? 'fadeIn')); break;
        case 'floor.exit': {
          const ex = sim.exitById(String(e.data?.exit ?? ''));
          // 果てしない階の階段室は session が入れ替える（ここでは何もしない）
          if (ex?.airlock) break;
          this.onFloorExit?.(String(e.data?.exit ?? ''), String(e.data?.kind ?? ''), ex?.to?.floor ?? null);
          break;
        }
        default: break;
      }
    }
  }

  private onReveal(group: string, style: string): void {
    if (!this.built) return;
    for (const c of this.built.cells.values()) {
      const show = c.reveal.get(group);
      if (show) { for (const m of show) m.visible = true; this.revealAnim.push({ meshes: show, t: 0, style, hide: false }); }
      const hide = c.conceal.get(group);
      if (hide) this.revealAnim.push({ meshes: hide, t: 0, style, hide: true });
    }
    this.audio.ui('open');
  }

  /**
   * 懐中電灯の光が当たる面までの距離（視線の線と当たり判定の箱の交わり。照度を一定に保つのに使う。v1 と同じ役目）。
   * 点を細かくたどると壁（厚み 0.15 m）を飛び越えるので、箱ごとに線との交わりを求める
   */
  private flashlightHit(): number {
    const sim = this.sim;
    if (!sim || !this.flashlightOn) return Infinity;
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const o = this.camera.position;
    const L = 12;
    const ex = o.x + d.x * L, ey = o.y + d.y * L, ez = o.z + d.z * L;
    let best = Infinity;
    for (const b of sim.colliders.query(Math.min(o.x, ex), Math.min(o.y, ey), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.y, ey), Math.max(o.z, ez))) {
      let t0 = 0, t1 = L;
      const os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z];
      for (let k = 0; k < 3 && t0 <= t1; k++) {
        if (Math.abs(ds[k]!) < 1e-9) { if (os[k]! < b.min[k]! || os[k]! > b.max[k]!) t0 = Infinity; continue; }
        const a0 = (b.min[k]! - os[k]!) / ds[k]!, a1 = (b.max[k]! - os[k]!) / ds[k]!;
        t0 = Math.max(t0, Math.min(a0, a1)); t1 = Math.min(t1, Math.max(a0, a1));
      }
      if (t0 <= t1 && t0 > 0.05 && t0 < best) best = t0;
    }
    return best;
  }

  /** 足元の床の材質（足音）。現在の区画の箱から、足の高さに上面がある箱を探す */
  private surfaceUnder(): MatId {
    const sim = this.sim;
    const built = this.built;
    if (!sim || !built) return 'floorConcrete';
    const p = sim.players[0]!;
    if (p.surfaceId) {
      const id = p.surfaceId.split(':')[0]!;
      const mat = sim.entitySpec(id)?.params.mat;
      if (typeof mat === 'string') return mat as MatId;
    }
    const cell = cellAt(built, p.pos);
    if (!cell) return 'floorConcrete';
    let best: MatId = cell.layout.palette.floor;
    let bestD = Infinity;
    for (const b of cell.layout.boxes) {
      if (p.pos[0] < b.min[0] - 0.02 || p.pos[0] > b.max[0] + 0.02 || p.pos[2] < b.min[2] - 0.02 || p.pos[2] > b.max[2] + 0.02) continue;
      const d = Math.abs(p.pos[1] - b.max[1]);
      if (b.max[1] - b.min[1] < 0.1 && !b.solid && d < 0.12 && d < bestD) { bestD = d - 0.05; best = b.mat; continue; }
      if (b.solid && d < 0.3 && d < bestD) { bestD = d; best = b.mat; }
    }
    return best;
  }

  // ---------------------------------------------------------------- 区画（霧・環境音）
  private enterCell(immediate = false): void {
    const sim = this.sim, built = this.built;
    if (!sim || !built) return;
    const cell = cellAt(built, sim.players[0]!.pos);
    if (!cell || cell.id === this.currentCell) return;
    this.currentCell = cell.id;
    const L = cell.layout;
    const fog = L.render?.fog ?? sim.floor.fog ?? { color: L.palette.fog, near: this.tier.fogNear, far: this.tier.fogDefaultFar };
    this.envFrom = { fog: this.env.fog.clone(), near: this.env.near, far: this.env.far, sky: this.env.sky.clone(), ground: this.env.ground.clone() };
    const sky = new THREE.Color(L.palette.ambient);
    this.envTo = { fog: new THREE.Color(fog.color), near: fog.near, far: fog.far, sky, ground: sky.clone().multiplyScalar(0.7) };
    this.envT = immediate ? ENV_LERP_SEC : 0;
    // wet は床全体が濡れた区画だけ（一歩ごとの水は足音の材質 waterShallow で出す。v1 と同じ）
    // 階段室（局所の座標で作る区画）は上下の階の写しで同じ部屋として扱う（移ったときに音が切り替わらない）
    const roomId = L.frame === 'group' && L.materialKey ? L.materialKey : L.id;
    this.audio.setRoom({ audioPreset: L.audioPreset ?? '', layoutHints: [] }, L, this.tier, { roomId, hints: [], wet: !!(L.render?.wetness || L.render?.floorWetness) });
    if (!immediate) this.postfx.notifyRoomEnter();
  }

  /** 縦穴の中の暗さ（0..1。隠しの穴の縦穴・着く部屋の天井の上の縦穴。階を移っても続く） */
  private darkK = 0;

  /** 点 eye が縦穴の中か（docs/endless-world.md 13 章） */
  private inShaft(eye: THREE.Vector3): boolean {
    const layouts = this.session ? this.session.active.regions.map((r) => r.layout) : this.sim ? [this.sim.floor] : [];
    const inside = (a: { min: number[]; max: number[] }): boolean => eye.x >= a.min[0]! && eye.x <= a.max[0]! && eye.y >= a.min[1]! && eye.y <= a.max[1]! && eye.z >= a.min[2]! && eye.z <= a.max[2]!;
    for (const L of layouts) {
      for (const x of L.exits) if (x.shaft && inside(x.shaft.zone)) return true;
      for (const l of L.region?.landings ?? []) if (inside(l.zone)) return true;
    }
    return false;
  }

  private updateEnvironment(dt: number): void {
    this.envT = Math.min(ENV_LERP_SEC, this.envT + dt);
    const k = this.envT / ENV_LERP_SEC;
    const s = k * k * (3 - 2 * k);
    this.env.fog.copy(this.envFrom.fog).lerp(this.envTo.fog, s);
    this.env.near = this.envFrom.near + (this.envTo.near - this.envFrom.near) * s;
    this.env.far = this.envFrom.far + (this.envTo.far - this.envFrom.far) * s;
    this.env.sky.copy(this.envFrom.sky).lerp(this.envTo.sky, s);
    this.env.ground.copy(this.envFrom.ground).lerp(this.envTo.ground, s);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.env.fog);
    fog.near = this.env.near;
    fog.far = Math.min(this.env.far, this.tier.fogFar);
    (this.scene.background as THREE.Color).copy(this.env.fog);
    this.hemi.color.copy(this.env.sky);
    this.hemi.groundColor.copy(this.env.ground);
    // 縦穴の中は真っ暗（数 m 先は何も見えない）。落ちてきた穴・落ちていく先の部屋は、縦穴を出ると見えてくる
    const dark = this.inShaft(this.camera.position);
    this.darkK = dark ? Math.min(1, this.darkK + dt / 0.2) : Math.max(0, this.darkK - dt / 0.8);
    if (this.darkK > 0) {
      const k = this.darkK;
      fog.color.lerp(BLACK, k);
      fog.near *= 1 - k;
      fog.far += (this.tuning['world.hole.darkFarM'] - fog.far) * k;
      (this.scene.background as THREE.Color).copy(fog.color);
      this.hemi.color.multiplyScalar(1 - 0.9 * k);
      this.hemi.groundColor.multiplyScalar(1 - 0.9 * k);
    }
  }

  // ---------------------------------------------------------------- 描画
  private render(dt: number): void {
    const sim = this.sim, built = this.built;
    if (sim && built) {
      const alpha = this.paused ? 1 : this.acc / sim.dt;
      const subj = this.subject(alpha);
      this.rig.update(dt, subj);
      this.enterCell();
      this.updateEnvironment(dt);
      const story = this.story!;
      const raw = this.cull ? story.visibility.update(built, sim, this.camera) : null;
      // まだ作り終えていない区域の区画は見えない扱い（照明も付けない）
      const visible = raw ? new Set([...raw].filter((id) => story.cellReady(id))) : null;
      if (!raw) for (const [id, c] of built.cells) c.group.visible = story.cellReady(id);
      this.mainVisible = visible;
      story.forEachView((id, v, vr) => {
        const shown = !visible || !vr.cells.length || vr.cells.some((c) => visible.has(c));
        vr.root.visible = shown;
        if (!shown) return;
        const st = sim.stateOf(id);
        if (st) v.update(st, dt);
      });
      // 見えている区画だけ（頂点の焼き込みを毎フレーム書き直すので、見えない区画は飛ばす）
      for (const c of built.cells.values()) if (c.lamps.length && c.group.visible) applyLampLevels(c, this.lampLevel);
      this.updateRevealAnim(dt);
      this.lightsPool.update(built, this.camera.position, this.lampLevel, visible, dt);
      if (this.flashlight) {
        this.flashlight.update(this.camera, this.paused ? 0 : dt, this.flashlightOn, this.tier.id === 'low', this.flashlightHit());
      }
      // 撮像の入力（回転の速さ・静止）
      const yawRate = (this.rig.out.yaw - this.prevCamYaw) / Math.max(1e-3, dt);
      const pitchRate = (this.rig.out.pitch - this.prevCamPitch) / Math.max(1e-3, dt);
      this.prevCamYaw = this.rig.out.yaw;
      this.prevCamPitch = this.rig.out.pitch;
      this.postfx.setCameraMotion(yawRate, pitchRate);
      this.postfx.setStillness(subj.stillSec);
      this.audio.setListener([this.camera.position.x, this.camera.position.y, this.camera.position.z], this.yaw, this.pitch);
      this.audio.update(dt);
      this.postfx.setAudioNoise(this.audio.ambientLevel);
      this.ui.reticle.classList.toggle('focus', !!sim.focusedInteractable());
    }
    const t0 = performance.now();
    this.materials.update(dt);
    this.renderPortals();
    this.postfx.render();
    this.materials.uploads.flush(this.renderer, performance.now() - t0);
  }

  /** 窓・枠の向こうを描く（場面を描く前。区画の見え方を面ごとに替えて、終わったら戻す。段階 4 warp で足した） */
  private renderPortals(): void {
    const sim = this.sim, built = this.built;
    if (!sim || !built || !this.portals.surfaces.size) return;
    const story = this.story!;
    const apply = (cells: ReadonlySet<string> | null): void => {
      const vis = cells ?? this.mainVisible;
      for (const [id, c] of built.cells) c.group.visible = (!vis || vis.has(id)) && story.cellReady(id);
      for (const vr of story.viewRootsAll()) vr.root.visible = !vis || !vr.cells.length || vr.cells.some((c) => vis.has(c));
    };
    this.portals.render(this.renderer, this.scene, this.camera, {
      applyCells: apply,
      visibleFrom: (cam) => story.visibility.compute(built, sim, cam),
    });
  }

  private updateRevealAnim(dt: number): void {
    for (const a of this.revealAnim) {
      a.t = Math.min(1, a.t + dt / 1.2);
      for (const m of a.meshes) {
        if (a.hide) {
          if (a.style === 'slideOpen') { m.position.y = -2.2 * a.t * a.t; m.updateMatrix(); }
          if (a.t >= 1) m.visible = false;
        }
      }
    }
    this.revealAnim = this.revealAnim.filter((a) => a.t < 1);
  }
}
