/**
 * AudioEngine — WebAudio 手続き合成の単一入口。Game が 1 つ所有し、Modifier / Generator はこの API だけ触る。
 *
 * グラフ: 各音源 → ambientBus / sfxBus → master → destination。
 *        各音源の send → reverbSend → IReverb（Convolver または フィードバックディレイ）→ reverbReturn → master。
 * ボイス予算: tier low 8 / mid 12 / high 20（rules.json「音」行）。環境音は予算 - 4（効果音用）に収める。
 *
 * ---------------------------------------------------------------- 統合担当向け: 呼び出し方
 *   import { AudioEngine } from '../audio/AudioEngine';
 *   import { Settings } from '../core/Settings';
 *   import { SettingsPanel } from '../ui/SettingsPanel';
 *
 *   const settings = Settings.load();
 *   const audio = new AudioEngine(settings);          // AudioContext はまだ作らない（import / new は Node でも安全）
 *   new SettingsPanel(settings);                       // #settings-slot（無ければ #menu .panel の .buttons 直前）にスライダーを生成
 *   (window as any).game.audio = audio;                // デバッグ: game.audio.debug()
 *
 *   // 1. 開始オーバーレイのクリック/タップ（Game.onStartClick。ユーザージェスチャ内）
 *   audio.unlock();
 *
 *   // 2. 入室（Game.enterRoom の末尾。layout は streaming.built / builder が持つ RoomLayout。Adapter は def=null）
 *   audio.setRoom(def, layout, this.tier, { roomId, hints: def?.layoutHints, wet: <Wetness/ShallowWater を持つ部屋> });
 *
 *   // 3. プレイヤー（PlayerController に onStride / onLand コールバックを追加してもらう想定）
 *   player.onStride = (rank, crouching) => audio.footstep(undefined, rank, crouching);   // 歩行 0.65 m / ダッシュ 0.8 m ごと
 *   player.onLand = (speed) => audio.land(speed);                                          // 着地時の |vel.y|
 *
 *   // 4. 扉（Game.interactRay で開閉トグル / RoomStreamingManager.updateDoors で angle が 0 に到達した瞬間 / 施錠ヒント表示時）
 *   audio.door('open' | 'close' | 'locked', layout.palette.door, doorCenterWorld);
 *
 *   // 5. エレベーター（Game.tryElevator: 遷移開始で 'move'、到着で 'bell'）
 *   audio.elevator('move'); audio.elevator('bell');
 *
 *   // 6. 毎フレーム（Game.step の末尾）
 *   audio.setListener([cam.x, cam.y, cam.z], player.yaw, player.pitch);
 *   audio.update(dt);
 *
 *   // 7. 品質 Tier の変更（Game.setTier）
 *   audio.setTier(this.tier);
 *
 *   // 8. 任意の音: audio.play('pageTurn', { pos }) / audio.beacon('phoneRing', portalPosWorld) → Handle.stop()
 *   //    E17 マイク: await audio.requestMic(); audio.loudnessLevel()（許可が無ければ移動由来の代替値）
 *   //    E12 過去音: audio.events.between(audio.now, 31, 29)
 *   //    隣室の漏れ音（任意）: audio.setNeighborLeak(neighborDef, doorCenterWorld, doorOpen) / audio.clearNeighborLeak()
 *
 *   // 9. 新しい世界 / ロード: audio.clearRoom()
 */
import type { QualityTier, RoomDefinition, Vec3 } from '../core/types';
import { QUALITY_TIERS } from '../core/types';
import type { RoomLayout } from '../generators/layout';
import type { Settings, SettingsData } from '../core/Settings';
import { AmbientMixer, makeVoice, type AmbientVoice } from './AmbientMixer';
import { AssetManifest, playSample } from './AssetManifest';
import { EventLog } from './EventLog';
import { LoudnessSource, type MovementRank } from './LoudnessSource';
import { mapPreset, isLayerId, type PresetMix } from './presetMap';
import { createReverb, estimateRT60, type IReverb } from './Reverb';
import {
  doorMatOf, floorKindOf, isSfxKind, playDoor, playElevator, playFootstep, playLand, playNamed, playUi,
  type DoorMat, type DoorSfxKind, type ElevatorSfxKind, type FloorKind, type MoveRank, type SfxContext, type UiSfxKind,
} from './Sfx';
import { createShared, type LayerDest, type SharedSources } from './Synth';

/** Tier ごとの同時発音上限（rules.json 性能予算「音」行） */
export const VOICE_BUDGET: Record<QualityTier['id'], number> = { low: 8, mid: 12, high: 20 };
/** 効果音のために環境音予算から取り分ける本数 */
const SFX_RESERVE = 4;

export interface PlayOptions {
  pos?: Vec3;
  loop?: boolean;
  gain?: number;
  pan?: number;
  pitch?: number;
  /** リバーブ send 0〜1 */
  send?: number;
  /** 追加ローパス（「遠い過去音」など） */
  lowpassHz?: number;
  /** イベントログに記録しない（過去音の再生など） */
  silentLog?: boolean;
  roomId?: string;
}

export interface SoundHandle {
  readonly kind: string;
  readonly active: boolean;
  stop(fadeSec?: number): void;
  setGain(v: number, fadeSec?: number): void;
  setPos(pos: Vec3): void;
}

export interface RoomAudioOptions {
  roomId?: string;
  /** layoutHints（'reverbHigh' を見る）。省略時は def.layoutHints */
  hints?: readonly string[];
  /** Wetness / ShallowWater を持つ部屋（足音を wet / water に） */
  wet?: boolean;
  /** audioPreset の上書き（Modifier: EraPreset / AmbientCarryover など） */
  presetOverride?: string;
}

interface RoomState {
  roomId: string | undefined;
  floor: FloorKind;
  doorMat: DoorMat;
  silent: boolean;
  label: string;
}

const NOOP_HANDLE = (kind: string): SoundHandle => ({ kind, active: false, stop() {}, setGain() {}, setPos() {} });

export class AudioEngine {
  readonly events = new EventLog(60);
  readonly assets = new AssetManifest();
  readonly loudness: LoudnessSource;

  private ctx: AudioContext | null = null;
  private sh: SharedSources | null = null;
  private master: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private reverbReturn: GainNode | null = null;
  private reverb: IReverb | null = null;
  private mixer: AmbientMixer | null = null;
  private tier: QualityTier = QUALITY_TIERS.high;
  private volumes = { masterVolume: 0.8, ambientVolume: 1.0, sfxVolume: 1.0 };
  private hidden = false;
  private room: RoomState = { roomId: undefined, floor: 'concrete', doorMat: 'wood', silent: false, label: '' };
  private pendingRoom: { def: RoomDefinition | null; layout: RoomLayout; opts: RoomAudioOptions } | null = null;
  private pendingReverb: { rt60: number; preDelay: number } | null = null;
  private stepSide = 1;
  /** 効果音の稼働ボイス（終了時刻） */
  private sfxActive: number[] = [];
  private loops = new Set<{ voice: AmbientVoice; handle: SoundHandle }>();
  private listenerPos: Vec3 = [0, 0, 0];
  private listenerYaw = 0;
  private listenerPitch = 0;
  private unsubscribeSettings: (() => void) | null = null;
  private assetsLoaded = false;
  private readonly boundResume = (): void => { void this.tryResume(); };
  private readonly boundVisibility = (): void => this.onVisibility();

  constructor(settings?: Settings) {
    this.loudness = new LoudnessSource(() => this.ctx);
    if (settings) {
      this.applySettings(settings.data);
      this.unsubscribeSettings = settings.onChange((d) => this.applySettings(d));
    }
    // マニフェストは早めに読む（デコードは ctx 生成後）
    void this.assets.load().then(() => { this.assetsLoaded = true; if (this.ctx) void this.assets.decodeAll(this.ctx); });
  }

  // ---------------------------------------------------------------- ライフサイクル
  /** AudioContext を生成して再生を開始する。ユーザージェスチャ内で呼ぶ（開始オーバーレイのタップ） */
  unlock(): void {
    if (this.ctx) { void this.tryResume(); return; }
    const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) { console.warn('[audio] Web Audio 非対応環境。無音で続行します'); return; }
    let ctx: AudioContext;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      ctx = new AC();
    }
    this.ctx = ctx;
    this.sh = createShared(ctx);
    this.master = ctx.createGain();
    this.ambientBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.reverbSend = ctx.createGain();
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.7;
    this.ambientBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.reverbReturn.connect(this.master);
    this.master.connect(ctx.destination);
    this.buildReverb(this.tier.convolver);
    this.mixer = new AmbientMixer(ctx, this.sh, { dry: this.ambientBus, reverb: this.reverbSend }, this.assets);
    this.mixer.setBudget(Math.max(2, VOICE_BUDGET[this.tier.id] - SFX_RESERVE));
    this.applyVolumes(0);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibility);
      window.addEventListener('focus', this.boundResume);
      window.addEventListener('pointerdown', this.boundResume, { passive: true });
      window.addEventListener('touchend', this.boundResume, { passive: true });
      window.addEventListener('keydown', this.boundResume);
      this.hidden = document.hidden;
    }
    void this.tryResume();
    if (this.assetsLoaded) void this.assets.decodeAll(ctx);
    if (this.pendingRoom) {
      const p = this.pendingRoom;
      this.pendingRoom = null;
      this.setRoom(p.def, p.layout, undefined, p.opts);
    }
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /** AudioContext.currentTime（ctx 未生成なら 0） */
  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** iOS の 'interrupted' / 'suspended' からの復帰を試みる */
  private async tryResume(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    if ((ctx.state as string) !== 'running' && (ctx.state as string) !== 'closed') {
      try { await ctx.resume(); } catch { /* 次のジェスチャで再試行 */ }
    }
  }

  private onVisibility(): void {
    this.hidden = typeof document !== 'undefined' && document.hidden;
    // 非表示時は環境音を 0 にフェード（ctx は suspend しない: 復帰時のクリック音を避ける）
    this.applyVolumes(0.4);
    if (!this.hidden) void this.tryResume();
  }

  dispose(): void {
    this.unsubscribeSettings?.();
    this.mixer?.dispose();
    for (const l of this.loops) l.voice.dispose();
    this.loops.clear();
    this.reverb?.dispose();
    this.loudness.dispose();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibility);
      window.removeEventListener('focus', this.boundResume);
      window.removeEventListener('pointerdown', this.boundResume);
      window.removeEventListener('touchend', this.boundResume);
      window.removeEventListener('keydown', this.boundResume);
    }
    void this.ctx?.close();
    this.ctx = null;
    this.mixer = null;
    this.reverb = null;
  }

  // ---------------------------------------------------------------- 音量 / Tier
  private applySettings(d: Readonly<SettingsData>): void {
    this.setVolumes({ masterVolume: d.masterVolume, ambientVolume: d.ambientVolume, sfxVolume: d.sfxVolume });
  }

  setVolumes(v: Partial<{ masterVolume: number; ambientVolume: number; sfxVolume: number }>): void {
    Object.assign(this.volumes, v);
    this.applyVolumes(0.05);
  }

  private applyVolumes(fadeSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.ambientBus || !this.sfxBus) return;
    const t = ctx.currentTime;
    const ramp = (g: GainNode, v: number): void => {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(v, t + Math.max(0.01, fadeSec));
    };
    // 音量スライダーは聴感に合わせて 2 乗
    ramp(this.master, this.volumes.masterVolume ** 2);
    ramp(this.ambientBus, this.hidden ? 0 : this.volumes.ambientVolume ** 2);
    ramp(this.sfxBus, this.volumes.sfxVolume ** 2);
  }

  /** 品質 Tier の変更（ボイス予算・リバーブ実装の切替） */
  setTier(tier: QualityTier): void {
    const prev = this.tier;
    this.tier = tier;
    this.mixer?.setBudget(Math.max(2, VOICE_BUDGET[tier.id] - SFX_RESERVE));
    if (this.ctx && prev.convolver !== tier.convolver) this.buildReverb(tier.convolver);
  }

  private buildReverb(convolver: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.reverbSend || !this.reverbReturn) return;
    const keep = this.reverb ? { rt60: this.reverb.rt60 } : this.pendingReverb;
    this.reverb?.dispose();
    this.reverbSend.disconnect();
    this.reverb = createReverb(ctx, convolver);
    this.reverbSend.connect(this.reverb.input);
    this.reverb.output.connect(this.reverbReturn);
    const rt = this.pendingReverb ?? (keep ? { rt60: keep.rt60, preDelay: 0.01 } : { rt60: 0.8, preDelay: 0.01 });
    this.reverb.setRT60(rt.rt60, rt.preDelay, 0.01);
    this.pendingReverb = null;
  }

  // ---------------------------------------------------------------- リスナー / 更新
  /** カメラ位置と向き（yaw: PlayerController.yaw、pitch 任意）。毎フレーム呼ぶ */
  setListener(pos: Vec3, yaw: number, pitch = 0): void {
    this.listenerPos = pos;
    this.listenerYaw = yaw;
    this.listenerPitch = pitch;
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const cp = Math.cos(pitch);
    // 前方 = -Z を yaw で回した方向（THREE のカメラは -Z を向く）
    const fx = -Math.sin(yaw) * cp;
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * cp;
    const t = ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos[0], t);
      l.positionY.setValueAtTime(pos[1], t);
      l.positionZ.setValueAtTime(pos[2], t);
      l.forwardX.setValueAtTime(fx, t);
      l.forwardY.setValueAtTime(fy, t);
      l.forwardZ.setValueAtTime(fz, t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      const legacy = l as unknown as { setPosition(x: number, y: number, z: number): void; setOrientation(x: number, y: number, z: number, ux: number, uy: number, uz: number): void };
      legacy.setPosition(pos[0], pos[1], pos[2]);
      legacy.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  /** 毎フレーム（Game.step の末尾） */
  update(dt: number): void {
    this.loudness.update(dt);
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.mixer?.update(now);
    for (const l of this.loops) {
      if (l.voice.isStopped) this.loops.delete(l);
      else l.voice.update(now);
    }
    if (this.sfxActive.length) this.sfxActive = this.sfxActive.filter((end) => end > now);
    this.events.prune(now);
  }

  // ---------------------------------------------------------------- 部屋
  /**
   * 入室時に環境音・残響・足音の床材を切り替える。def=null（Adapter）は環境音を維持し、床材と残響だけ更新する。
   * ctx 未生成（開始前）なら保留し unlock 時に適用する
   */
  setRoom(def: RoomDefinition | null, layout: RoomLayout, tier?: QualityTier, opts: RoomAudioOptions = {}): void {
    if (tier) this.setTier(tier);
    this.room.roomId = opts.roomId;
    this.room.floor = floorKindOf(layout.palette.floor, opts.wet);
    this.room.doorMat = doorMatOf(layout.palette.door);
    let mix: PresetMix | null = null;
    if (def || opts.presetOverride) {
      mix = mapPreset(opts.presetOverride ?? def?.audioPreset ?? '');
      this.room.silent = !!mix.silent;
      this.room.label = mix.label;
    }
    const est = estimateRT60(layout.bounds, layout.palette, { hints: opts.hints ?? def?.layoutHints, floorSec: mix?.reverbFloorSec });
    if (!this.ctx || !this.mixer) {
      this.pendingRoom = { def, layout, opts };
      this.pendingReverb = { rt60: est.quantized, preDelay: est.preDelay };
      return;
    }
    this.reverb?.setRT60(est.quantized, est.preDelay);
    if (mix) {
      // 「局所的な」レイヤーの定位点: bounds 内のランダムな 1 点（高さ 1.5 m）
      const b = layout.bounds;
      const localPos: Vec3 = [b.min[0] + Math.random() * (b.max[0] - b.min[0]), b.min[1] + 1.5, b.min[2] + Math.random() * (b.max[2] - b.min[2])];
      this.mixer.setPreset(mix, { localPos });
    }
  }

  /** 現在の環境音を止める（新しい世界 / ロード直前） */
  clearRoom(): void {
    this.mixer?.clear();
    this.pendingRoom = null;
    this.room.label = '';
  }

  /** 現在部屋の足音の床種 */
  get currentFloor(): FloorKind {
    return this.room.floor;
  }

  /** 現在の環境音ラベル（audioPreset） */
  get currentPreset(): string {
    return this.room.label;
  }

  /** 部屋の audioPreset を Modifier から差し替える（EraPreset / AmbientCarryover / FarLink 混在など） */
  overridePreset(label: string, gainMul = 1): void {
    if (!this.mixer) return;
    const mix = mapPreset(label);
    if (gainMul !== 1) for (const l of mix.layers) l.gain *= gainMul;
    this.room.label = mix.label;
    this.room.silent = !!mix.silent;
    this.mixer.setPreset(mix, { force: true });
  }

  /** 隣室の漏れ音（扉中心に定位）。API のみ — 統合側で呼ばなければ何もしない */
  setNeighborLeak(def: RoomDefinition | null, doorPos: Vec3, open: boolean): void {
    if (!this.mixer) return;
    this.mixer.setLeak(def ? mapPreset(def.audioPreset) : null, doorPos, open);
  }

  clearNeighborLeak(): void {
    this.mixer?.setLeak(null, [0, 0, 0], false);
  }

  // ---------------------------------------------------------------- 効果音
  private sfx(): SfxContext | null {
    if (!this.ctx || !this.sh || !this.sfxBus || !this.reverbSend) return null;
    if (this.sfxActive.length >= VOICE_BUDGET[this.tier.id]) return null; // 予算超過: 一発音は落とす
    const ctx = this.ctx;
    return {
      ctx,
      sh: this.sh,
      dest: { dry: this.sfxBus, reverb: this.reverbSend },
      onVoice: (dur) => this.sfxActive.push(ctx.currentTime + dur),
    };
  }

  private log(kind: string, pos: Vec3 | undefined, gain?: number): void {
    this.events.push({ kind, pos, roomId: this.room.roomId, t: this.now, gain });
  }

  /**
   * 足音。floorMat 省略時は現在部屋の床材。rank 'walk' | 'dash'、crouching で -8 dB、wet で水しぶき混合。
   * 左右 ±0.15 の定位を交互に、ピッチ ±6% ランダム
   */
  footstep(floorMat: string | undefined, rank: MoveRank, crouching = false, wet?: boolean, pos?: Vec3): void {
    const sc = this.sfx();
    if (!sc) return;
    const floor = floorMat ? floorKindOf(floorMat, wet) : (wet ? 'wet' : this.room.floor);
    this.stepSide = -this.stepSide;
    const send = this.room.silent ? 0.9 : undefined;
    playFootstep(sc, floor, rank, crouching, wet ?? this.room.floor === 'wet', { pos, pan: pos ? undefined : 0.15 * this.stepSide, send });
    this.log(`footstep:${floor}:${rank}`, pos ?? this.listenerPos);
  }

  /** 着地。speed = 着地時の |vel.y|（m/s） */
  land(speed: number, floorMat?: string, pos?: Vec3): void {
    const sc = this.sfx();
    if (!sc) return;
    const floor = floorMat ? floorKindOf(floorMat) : this.room.floor;
    if (playLand(sc, speed, floor, { pos }) > 0) this.log(`land:${floor}`, pos ?? this.listenerPos, speed);
  }

  /** 扉。mat は palette.door（doorWood / doorMetal / glass）または 'wood' | 'metal' | 'glass'。pos は DoorObject.center */
  door(kind: DoorSfxKind, mat?: string, pos?: Vec3): void {
    const sc = this.sfx();
    if (!sc) return;
    const m: DoorMat = mat === 'wood' || mat === 'metal' || mat === 'glass' ? mat : mat ? doorMatOf(mat) : this.room.doorMat;
    playDoor(sc, kind, m, { pos });
    this.log(`door:${kind}`, pos);
  }

  elevator(kind: ElevatorSfxKind, pos?: Vec3): void {
    const sc = this.sfx();
    if (!sc) return;
    playElevator(sc, kind, { pos });
    this.log(`elevator:${kind}`, pos);
  }

  ui(kind: UiSfxKind): void {
    const sc = this.sfx();
    if (!sc) return;
    playUi(sc, kind);
  }

  /**
   * 名前で鳴らす。kind は SFX_KINDS（phoneRing / children / pageTurn / beep / knock / chime / clank / drip / laugh / thud / shutter）、
   * LAYER_IDS（loop=true でループ、false なら 3 秒だけ）、またはアセットのキー。未知の kind は beep + console.warn
   */
  play(kind: string, opts: PlayOptions = {}): SoundHandle {
    const ctx = this.ctx;
    if (!ctx || !this.sh || !this.sfxBus || !this.ambientBus || !this.reverbSend) return NOOP_HANDLE(kind);
    if (!opts.silentLog) this.log(kind, opts.pos, opts.gain);
    const buf = this.assets.get(kind);
    // ループ（レイヤー / アセット）。pageTurn / knock / chime などレイヤーと一発音の両方にある名前は loop 指定が無ければ一発音
    if (opts.loop || (isLayerId(kind) && !isSfxKind(kind) && !buf)) {
      if (!isLayerId(kind) && !buf) {
        warnOnce(kind);
        return this.play('beep', { ...opts, loop: false, silentLog: true });
      }
      const dest: LayerDest = { dry: this.ambientBus, reverb: this.reverbSend };
      const voice = makeVoice(ctx, this.sh, dest, this.assets, {
        id: isLayerId(kind) ? kind : 'hvac',
        gain: opts.gain ?? 1,
        reverbSend: opts.send,
      }, { pos: opts.pos, lowpassHz: opts.lowpassHz });
      voice.start(0.3);
      const handle: SoundHandle = {
        kind,
        get active() { return !voice.isStopped; },
        stop: (fade = 0.8) => voice.stop(fade),
        setGain: (v, fade) => voice.setGain(v, fade),
        setPos: (pos) => { if (voice instanceof Object && 'setPosition' in voice) (voice as { setPosition(p: Vec3): void }).setPosition(pos); },
      };
      const entry = { voice, handle };
      this.loops.add(entry);
      if (!opts.loop) setTimeout(() => voice.stop(1.0), 3000);
      return handle;
    }
    // 一発音
    const sc = this.sfx();
    if (!sc) return NOOP_HANDLE(kind);
    let dur = 0;
    if (buf) {
      dur = playSample(ctx, buf, sc.dest, { gain: opts.gain, send: opts.send, pos: opts.pos, pitch: opts.pitch });
      sc.onVoice?.(dur);
    } else if (isSfxKind(kind)) {
      dur = playNamed(sc, kind, { pos: opts.pos, gain: opts.gain, pan: opts.pan, send: opts.send, pitch: opts.pitch });
    } else {
      warnOnce(kind);
      dur = playNamed(sc, 'beep', { pos: opts.pos, gain: opts.gain });
    }
    const end = ctx.currentTime + dur;
    return { kind, get active() { return ctx.currentTime < end; }, stop() {}, setGain() {}, setPos() {} };
  }

  /** 定常音源（誘導音）。pos に PannerNode（equalpower）で置く。kind はレイヤー id（phoneRing 等）またはアセットキー */
  beacon(kind: string, pos: Vec3, gain = 1): SoundHandle {
    return this.play(kind, { pos, loop: true, gain });
  }

  // ---------------------------------------------------------------- E17 マイク / 音量
  /** マイク利用を要求（E17 の扉操作時。ユーザージェスチャ内）。許可が無い / 非 HTTPS なら false */
  requestMic(): Promise<boolean> {
    return this.loudness.requestMic();
  }

  /** プレイヤーの移動ランクを渡して現在の音量（0〜1）を得る。マイクがあればマイク音量 */
  loudnessLevel(rank: MovementRank = 'still', jumped = false): number {
    this.loudness.movementLoudness(rank, jumped);
    return this.loudness.level();
  }

  // ---------------------------------------------------------------- デバッグ
  /** game.audio.debug() 用 */
  debug(): string {
    const ctx = this.ctx;
    if (!ctx) return 'audio: not unlocked';
    const layers = this.mixer?.layerIds() ?? [];
    return [
      `audio: ${ctx.state} sr=${ctx.sampleRate} tier=${this.tier.id} budget=${VOICE_BUDGET[this.tier.id]}`,
      `voices: ambient ${this.mixer?.voiceCount ?? 0} + loops ${this.loops.size} + sfx ${this.sfxActive.length}`,
      `preset: ${this.room.label || '-'} [${layers.join(', ')}]`,
      `reverb: ${this.reverb ? `${this.reverb.rt60}s ${this.tier.convolver ? 'convolver' : 'delay'}` : '-'} floor=${this.room.floor} door=${this.room.doorMat}${this.room.silent ? ' silent' : ''}`,
      `listener: ${this.listenerPos.map((v) => v.toFixed(1)).join(',')} yaw=${this.listenerYaw.toFixed(2)} pitch=${this.listenerPitch.toFixed(2)}`,
      `assets: ${this.assets.decodedCount}/${this.assets.keys.length} decoded  mic=${this.loudness.micAvailable} level=${this.loudness.level().toFixed(2)}  events=${this.events.size}`,
    ].join('\n');
  }
}

const warnedKinds = new Set<string>();
function warnOnce(kind: string): void {
  if (warnedKinds.has(kind)) return;
  warnedKinds.add(kind);
  console.warn(`[audio] 未知の sound 名 '${kind}' → beep にフォールバック`);
}
