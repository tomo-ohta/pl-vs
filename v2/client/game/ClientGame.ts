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
import { createView, type EntityView } from '../views/views.ts';
import { applyLampLevels, cellAt, FloorBuilder, type BuiltFloor } from '../world/FloorBuilder.ts';
import { LightManager } from '../world/LightManager.ts';
import { Visibility } from '../world/Visibility.ts';

const TONE_MAPPINGS = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping } as const;
/** 環境（霧・空の色）の補間時間 */
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
  readonly rig: CameraRig;
  readonly materials = new MaterialLibrary();
  readonly settings: Settings;
  readonly audio: AudioEngine;
  readonly input: InputController;
  readonly postfx: PostFX;
  readonly tuning: Tuning;
  readonly ui: UiRefs;
  sim: Sim | null = null;
  built: BuiltFloor | null = null;
  tier: QualityTier;
  paused = true;
  /** フロアの出口に入った（main がつぎのフロアを読む） */
  onFloorExit: ((exitId: string, kind: string, to: string | null) => void) | null = null;

  private readonly hemi = new THREE.HemisphereLight(0xe5e4d5, 0x6c665a, 0.1);
  private lightsPool: LightManager;
  private views = new Map<string, EntityView>();
  private visibility: Visibility | null = null;
  /** 見える区画（cell and portal）。開発用に ?cull=off で全部描く */
  cull = typeof location === 'undefined' || new URLSearchParams(location.search).get('cull') !== 'off';
  private yaw = 0;
  private pitch = 0;
  private acc = 0;
  private last = 0;
  private pendingJump = false;
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
    setBevelQuality(this.tier.id);
    this.scene.fog = new THREE.Fog(0x0b0d14, 8, 46);
    this.scene.background = new THREE.Color(0x050608);
    this.scene.add(this.hemi);
    this.scene.add(this.camera);
    this.rig = new CameraRig(this.camera);
    this.lightsPool = new LightManager(this.scene, this.tier.maxLights);
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
  async loadFloor(floor: FloorLayout): Promise<void> {
    this.unloadFloor();
    const needsPhysics = floor.entities.some((e) => partDef(e.type)?.physics);
    const physics = needsPhysics ? new PhysicsWorld(await loadRapier(), 1 / this.tuning['physics.tickHz']) : null;
    this.sim = new Sim(floor, { tuning: this.tuning, physics });
    this.built = new FloorBuilder(this.materials).build(floor);
    this.scene.add(this.built.root);
    this.visibility = new Visibility(floor);
    const ctx = { root: this.built.root, materials: this.materials, built: this.built, sim: this.sim, levelOf: this.lampLevel };
    for (const e of floor.entities) {
      const v = createView(e, ctx);
      if (v) this.views.set(e.id, v);
    }
    const p = this.sim.players[0]!;
    this.yaw = p.yaw;
    this.pitch = p.pitch;
    this.prevPos = [...p.pos];
    if (floor.fog) {
      this.envTo.fog.setHex(floor.fog.color);
      this.envTo.near = floor.fog.near;
      this.envTo.far = floor.fog.far;
    }
    this.enterCell(true);
    this.rig.snap(this.subject(1));
  }

  unloadFloor(): void {
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    this.built?.dispose();
    this.built = null;
    this.visibility = null;
    this.sim?.physics?.dispose();
    this.sim = null;
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

  /** テスト用: 1 tick 進める（ペインが隠れて rAF が止まるときの確認用） */
  stepOnce(cmd: Partial<InputCommand> = {}): void {
    if (!this.sim) return;
    const p = this.sim.players[0]!;
    this.sim.step([{ moveX: 0, moveY: 0, yaw: p.yaw, pitch: p.pitch, jump: false, dash: false, crouch: false, interact: null, ...cmd }]);
    this.handleEvents(this.sim.drainEvents());
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const sim = this.sim;
    const input = this.input.poll();
    // メニュー（Esc / 右上）: 開くだけ。閉じるのは一時停止の画面の「再開」（Pointer Lock はユーザー操作の中でしか取れない）
    if (input.menu && !this.paused) { this.pause(); this.ui.setPauseVisible(true); this.audio.ui('open'); }
    if (sim && !this.paused) {
      this.yaw -= input.lookDX;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch - input.lookDY));
      if (input.jump) this.pendingJump = true;
      if (input.interact) this.pendingInteract = { yaw: this.yaw, pitch: this.pitch };
      if (input.tap) this.pendingInteract = this.tapDirection(input.tap);
      this.acc += dt;
      const step = sim.dt;
      let n = 0;
      while (this.acc >= step && n < 8) {
        this.prevPos = [...sim.players[0]!.pos];
        sim.step([this.command(input)]);
        this.pendingJump = false;
        this.pendingInteract = null;
        this.acc -= step;
        n++;
      }
      if (n === 8) this.acc = 0;
      this.handleEvents(sim.drainEvents());
    }
    this.render(dt);
  }

  private command(input: InputState): InputCommand {
    return { moveX: input.moveX, moveY: input.moveY, yaw: this.yaw, pitch: this.pitch, jump: this.pendingJump, dash: input.dash, crouch: input.crouch, interact: this.pendingInteract };
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
    };
  }

  // ---------------------------------------------------------------- イベント → 音・見た目
  private handleEvents(events: SimEvent[]): void {
    const sim = this.sim;
    if (!sim || !this.built) return;
    for (const e of events) {
      switch (e.type) {
        case 'player.stride': {
          const mat = e.data?.water ? 'waterShallow' : this.surfaceUnder();
          this.audio.footstep(mat, (e.data?.rank as 'walk' | 'dash') ?? 'walk', !!e.data?.crouch);
          break;
        }
        case 'player.land': this.audio.land(Number(e.data?.speed ?? 2), this.surfaceUnder()); break;
        case 'player.jump': this.audio.jump(this.surfaceUnder()); break;
        case 'player.respawn': this.rig.snap(this.subject(1)); this.prevPos = [...sim.players[0]!.pos]; this.yaw = sim.players[0]!.yaw; this.pitch = 0; break;
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
          break;
        }
        case 'reveal': this.onReveal(String(e.data?.group ?? ''), String(e.data?.style ?? 'fadeIn')); break;
        case 'floor.exit': this.onFloorExit?.(String(e.data?.exit ?? ''), String(e.data?.kind ?? ''), sim.floor.exits.find((x) => x.id === e.data?.exit)?.to?.floor ?? null); break;
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

  /** 足元の床の材質（足音）。現在の区画の箱から、足の高さに上面がある箱を探す */
  private surfaceUnder(): MatId {
    const sim = this.sim;
    const built = this.built;
    if (!sim || !built) return 'floorConcrete';
    const p = sim.players[0]!;
    if (p.surfaceId) {
      const id = p.surfaceId.split(':')[0]!;
      const mat = sim.floor.entities.find((e) => e.id === id)?.params.mat;
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
    this.audio.setRoom({ audioPreset: L.audioPreset ?? '', layoutHints: [] }, L, this.tier, { roomId: L.id, hints: [], wet: !!(L.render?.wetness || L.render?.floorWetness) });
    if (!immediate) this.postfx.notifyRoomEnter();
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
      for (const [id, v] of this.views) {
        const st = sim.stateOf(id);
        if (st) v.update(st, dt);
      }
      for (const c of built.cells.values()) if (c.lamps.length) applyLampLevels(c, this.lampLevel);
      this.updateRevealAnim(dt);
      const visible = this.cull && this.visibility ? this.visibility.update(built, sim, this.camera) : null;
      this.lightsPool.update(built, this.camera.position, this.lampLevel, visible, dt);
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
    this.postfx.render();
    this.materials.uploads.flush(this.renderer, performance.now() - t0);
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
