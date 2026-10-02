/**
 * AudioEngine — WebAudio 手続き合成の単一入口（v1 audio/AudioEngine.ts から移植）。ゲーム（client/game）が 1 つ所有する。
 *
 * グラフ: 各音源 → ambientBus / sfxBus → master → 音割れ防止（limiter）→ destination。
 *        各音源の send → reverbSend → IReverb（Convolver または フィードバックディレイ）→ reverbReturn → master。
 * ボイス予算: tier low 8 / mid 12 / high 20（v1 rules.json「音」行）。環境音は予算 - 4（効果音用）に収める。
 *
 * v2 での変更（鳴り方・音量・数値は v1 と同じ）:
 *   - 部屋定義（v1 RoomDefinition）の代わりに AudioRoomInfo（audioPreset と layoutHints の 2 つだけ）を受け取る
 *   - 部屋の layout（v1 RoomLayout）の代わりに AudioLayout（bounds と palette の床・壁・天井・扉だけ）。v2 の CellLayout をそのまま渡せる
 *   - 設定は client/settings/Settings.ts、品質 Tier は client/render/quality.ts、素材の場所は client/env.ts の ASSET_BASE（AssetManifest）
 *
 * ---------------------------------------------------------------- 統合担当向け: 呼び出し方
 *   import { AudioEngine } from './audio/AudioEngine.ts';
 *   import { Settings } from './settings/Settings.ts';
 *
 *   const settings = Settings.load();
 *   const audio = new AudioEngine(settings);          // AudioContext はまだ作らない（import / new は Node でも安全）。音量は settings を自分で購読する
 *   (window as any).audio = audio;                     // デバッグ: audio.debug()
 *
 *   // 1. 開始・再開のクリック/タップ（ユーザージェスチャ内。pointerdown の時点でも呼ぶと iOS Safari で確実。何度呼んでも安全）
 *   audio.unlock();
 *
 *   // 2. 区画に入ったとき（cell = core/world/layout.ts の CellLayout。info = null なら環境音はそのままで床材と残響だけ変える）
 *   audio.setRoom({ audioPreset: cell.audioPreset ?? '', layoutHints: [] }, cell, tier, { roomId: cell.id, wet: <濡れた床の区画> });
 *
 *   // 3. プレイヤーの動作音（rank 'walk' | 'dash'。floorMat は足元の材質 MatId、省略で区画の床。水の中は 'waterShallow'）
 *   audio.footstep(floorMat, rank, crouching);   // 歩行 0.65 m / ダッシュ 0.8 m ごと（v1 PlayerController.onStride）
 *   audio.land(speedY, floorMat);                // 着地時の |vel.y|
 *   audio.jump(floorMat);  audio.rustle(strength, undefined, tall);
 *   //    他プレイヤーの足音: audio.footstep(floorMat, rank, crouching, wet, pos)（pos を渡すと PannerNode で定位する）
 *
 *   // 4. 扉（開閉・自動で閉じきった瞬間・施錠）: audio.door('open' | 'close' | 'locked', cell.palette.door, doorCenter)
 *   //    エレベーター: audio.elevator('move')（遷移開始）/ audio.elevator('bell')（到着）
 *   // 5. UI: audio.ui('open' | 'close' | 'confirm' | 'cancel' | 'error' | 'click')（v1 はメニューの開閉で open / close）
 *
 *   // 6. 毎フレーム（描画の更新の末尾）
 *   audio.setListener([cam.x, cam.y, cam.z], yaw, pitch);
 *   audio.update(dt);
 *
 *   // 7. 品質 Tier の変更: audio.setTier(tier)（render/quality.ts の QUALITY_TIERS[id]。スマホは mobileTier(...)。convolver で残響の実装が変わる）
 *
 *   // 8. 任意の音: audio.play('pageTurn', { pos }) / audio.beacon('phoneRing', pos) → SoundHandle.stop()
 *   //    マイク: await audio.requestMic(); audio.loudnessLevel()（許可が無ければ移動由来の代替値）
 *   //    過去音: audio.events.between(audio.now, 31, 29)
 *   //    隣室の漏れ音（任意）: audio.setNeighborLeak({ audioPreset }, doorCenter, doorOpen) / audio.clearNeighborLeak()
 *   //    撮像の暗部ノイズ: postfx.setAudioNoise(audio.ambientLevel)
 *
 *   // 9. 新しい世界 / ロード: audio.clearRoom()
 */
import type { AABB } from '../../core/math/aabb.ts';
import type { Vec3 } from '../../core/math/vec.ts';
import type { CellLayout, Palette } from '../../core/world/layout.ts';
import { QUALITY_TIERS, type QualityTier, type QualityTierId } from '../render/quality.ts';
import type { Settings, SettingsData } from '../settings/Settings.ts';
import { AmbientMixer, CROSSFADE_SEC, makeVoice, type AmbientVoice } from './AmbientMixer.ts';
import { AssetManifest, playSample } from './AssetManifest.ts';
import { EventLog } from './EventLog.ts';
import { LoudnessSource, type MovementRank } from './LoudnessSource.ts';
import { mapPreset, isLayerId, type PresetMix } from './presetMap.ts';
import { createReverb, estimateRT60, type IReverb } from './Reverb.ts';
import {
  doorMatOf, floorKindOf, isSfxKind, playDoor, playElevator, playFootstep, playJump, playLand, playNamed, playRustle, playUi,
  type DoorMat, type DoorSfxKind, type ElevatorSfxKind, type FloorKind, type MoveRank, type SfxContext, type UiSfxKind,
} from './Sfx.ts';

import { createShared, type LayerDest, type SharedSources } from './Synth.ts';
import { isSenseSfx, playSense } from './SenseSfx.ts';

/** 区画の音の設定（v1 RoomDefinition のうち AudioEngine が読む 2 つだけ） */
export interface AudioRoomInfo {
  /** 環境音の種類（日本語ラベル。presetMap.ts の mapPreset が読む。v2 では CellLayout.audioPreset） */
  audioPreset: string;
  /** 残響のヒント（'reverbHigh' があれば RT60 ×1.6）。setRoom の opts.hints が優先 */
  layoutHints: readonly string[];
}

/** 区画の形と材質（v1 RoomLayout のうち AudioEngine が読むものだけ）。v2 の CellLayout は構造的にそのまま渡せる */
export interface AudioLayout {
  /** 残響の体積と面積（Sabine 近似）・「局所的な」環境音の定位点を取る範囲 */
  bounds: AABB;
  /** floor: 足音の床種 / door: 扉の音の材質 / floor・wall・ceiling: 残響の吸音 */
  palette: Pick<Palette, 'floor' | 'wall' | 'ceiling' | 'door'>;
}

// 型の確認だけ（実行時は何もしない）: CellLayout が AudioLayout として渡せること。core の形が変わって合わなくなったらここで型エラーになる
const cellFitsAudioLayout = (cell: CellLayout): AudioLayout => cell;
void cellFitsAudioLayout;

/** 全体音量の既定値（Settings の DEFAULT_SETTINGS.masterVolume と同じ）。ambientLevel の換算の基準 */
const NOISE_REF_MASTER = 0.25;
/** 残響の出力がこれを超えたら暴走とみなす（通常の出力は 1 未満。振り切れた録音でも内部値は数十〜Infinity になる） */
const REVERB_RUNAWAY = 4;
/** 足音は環境音より何 dB 上に聞こえてほしいか（全体の出力で測った値の目安） */
const STEP_MARGIN_DB = 12;
/** 環境音バスの一律の下げ幅（線形。0.71 = -3 dB） */
const AMBIENT_TRIM = 0.71;
/** 足音の自動の持ち上げの上限（dB） */
const STEP_BOOST_MAX_DB = 18;
/** 持ち上げ前の歩きの一歩の大きさ（ambientBus の RMS と同じ尺度。素材 -13 dBFS × 基準 0.55 × 定位 -3 dB） */
const STEP_REF_DB = -22;
/** プレイヤーの動作音（足音・着地・ジャンプ・擦れ）の一律の下げ幅（線形。0.71 = -3 dB。第22回「全体的にもう少し小さくてよい」） */
const PLAYER_SFX_TRIM = 0.71;

/** Tier ごとの同時発音上限（v1 rules.json 性能予算「音」行） */
export const VOICE_BUDGET: Record<QualityTierId, number> = { low: 8, mid: 12, high: 20 };
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
  /** 効果音のイベントログに記録する区画の id（v2 では CellLayout.id） */
  roomId?: string;
  /** layoutHints（'reverbHigh' を見る）。省略時は info.layoutHints */
  hints?: readonly string[];
  /** 濡れた床の区画（v1 の Wetness / ShallowWater。足音を wet に） */
  wet?: boolean;
  /** audioPreset の上書き（v1 では Modifier の EraPreset / AmbientCarryover など）。info=null でも環境音を切り替える */
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
  /** 残響の出力の監視（第19回。暴走・NaN を見つけたら残響を作り直す）。0.25 s ごとに 256 サンプルを見る */
  private reverbProbe: AnalyserNode | null = null;
  /** 環境音の実測（第20回の 2 回目。足音を埋もれさせない自動の持ち上げ量の入力）。0.2 s ごとに ambientBus の RMS を測り、τ 1.5 s で追従 */
  private ambientProbe: AnalyserNode | null = null;
  private ambientProbeBuf: Float32Array<ArrayBuffer> | null = null;
  private ambientProbeNext = 0;
  private ambientDb = -80;
  /** 全体の出力の音割れ防止（足音を持ち上げても全体音量 100% で割れない） */
  private limiter: DynamicsCompressorNode | null = null;
  /** 部屋の音の効果（担当 sense）: 全体の音量の絞り（無音の部屋）と、こもり（水の中・壁の向こう）。キーごとに重ね、いちばん強いものが効く */
  private duckNode: GainNode | null = null;
  private muffleNode: BiquadFilterNode | null = null;
  private readonly ducks = new Map<string, number>();
  private readonly muffles = new Map<string, number>();
  /** 足音を遅らせる秒数（足音が遅れて聞こえる部屋）と、足音の高さの倍率（遅い部屋） */
  stepDelaySec = 0;
  stepPitch = 1;
  private reverbProbeBuf: Float32Array<ArrayBuffer> | null = null;
  private reverbProbeNext = 0;
  private reverbResets = 0;
  private reverb: IReverb | null = null;
  private mixer: AmbientMixer | null = null;
  private tier: QualityTier = QUALITY_TIERS.high;
  private volumes = { masterVolume: 0.25, ambientVolume: 1.0, sfxVolume: 1.0 };
  private hidden = false;
  private room: RoomState = { roomId: undefined, floor: 'concrete', doorMat: 'wood', silent: false, label: '' };
  private pendingRoom: { info: AudioRoomInfo | null; layout: AudioLayout; opts: RoomAudioOptions } | null = null;
  private pendingReverb: { rt60: number; preDelay: number } | null = null;
  private stepSide = 1;
  /** 効果音の稼働ボイス（終了時刻） */
  private sfxActive: number[] = [];
  private loops = new Set<{ voice: AmbientVoice; handle: SoundHandle; gain: number }>();
  /** 環境音バスの大きさの推定値（0〜1。update で追従。ambientLevel） */
  private ambientLevelNow = 0;
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
  /** AudioContext を生成して再生を開始する。ユーザージェスチャ内で呼ぶ（開始・再開のタップ）。2 回目以降は復帰（resume）だけ試す */
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
    // 全体の出力 → 音割れ防止（ほぼ素通し。-2 dBFS を超えるときだけ強く抑える）→ スピーカー
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;
    // 全体の出力 → 部屋の効果（絞り・こもり。ふだんは素通し）→ 音割れ防止
    this.duckNode = ctx.createGain();
    this.muffleNode = ctx.createBiquadFilter();
    this.muffleNode.type = 'lowpass';
    this.muffleNode.frequency.value = 20000;
    this.muffleNode.Q.value = 0.5;
    this.master.connect(this.duckNode).connect(this.muffleNode).connect(this.limiter).connect(ctx.destination);
    this.applyRoomFx(0);
    this.ambientProbe = ctx.createAnalyser();
    this.ambientProbe.fftSize = 2048;
    this.ambientProbeBuf = new Float32Array(this.ambientProbe.fftSize);
    this.ambientBus.connect(this.ambientProbe);
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
      this.setRoom(p.info, p.layout, undefined, p.opts);
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
    // 環境音は -3 dB（第20回の 2 回目。足音に対して大きすぎ、空調の部屋で足音が埋もれていた）
    ramp(this.ambientBus, this.hidden ? 0 : this.volumes.ambientVolume ** 2 * AMBIENT_TRIM);
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
    this.reverbProbe?.disconnect();
    this.reverbProbe = ctx.createAnalyser();
    this.reverbProbe.fftSize = 256;
    this.reverbProbeBuf = new Float32Array(this.reverbProbe.fftSize);
    this.reverb.output.connect(this.reverbProbe);
    const rt = this.pendingReverb ?? (keep ? { rt60: keep.rt60, preDelay: 0.01 } : { rt60: 0.8, preDelay: 0.01 });
    this.reverb.setRT60(rt.rt60, rt.preDelay, 0.01);
    this.pendingReverb = null;
  }

  // ---------------------------------------------------------------- リスナー / 更新
  /** 聞き手（カメラ）の位置と向き（yaw 0 で -Z を向く。three.js のカメラと同じ。pitch 任意）。毎フレーム呼ぶ */
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

  /** 毎フレーム（描画の更新の末尾） */
  update(dt: number): void {
    this.loudness.update(dt);
    // 環境音の大きさの推定はクロスフェード（1.2 s）と同じ時定数で追従（VideoPass の暗部ノイズの入力）
    this.ambientLevelNow += (this.estimateAmbientLevel() - this.ambientLevelNow) * Math.min(1, dt / CROSSFADE_SEC);
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
    this.watchReverb(now);
    this.measureAmbient(now);
  }

  private measureAmbient(now: number): void {
    const probe = this.ambientProbe, buf = this.ambientProbeBuf;
    if (!probe || !buf || now < this.ambientProbeNext) return;
    const dt = this.ambientProbeNext > 0 ? Math.min(1, now - this.ambientProbeNext + 0.2) : 1;
    this.ambientProbeNext = now + 0.2;
    probe.getFloatTimeDomainData(buf);
    let e = 0;
    for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i];
    const db = 10 * Math.log10(e / buf.length + 1e-12);
    if (!Number.isFinite(db)) return;
    this.ambientDb += (db - this.ambientDb) * Math.min(1, dt / 1.5);
  }

  /**
   * プレイヤーの動作音（足音・着地・ジャンプ・擦れ）の持ち上げ量（線形倍率）。環境音の実測 + STEP_MARGIN_DB を、
   * 通常の歩きの一歩の大きさ（STEP_REF_DB）が下回る分だけ上げる（0〜+STEP_BOOST_MAX_DB）。静かな部屋では 1（持ち上げない）。
   * 第20回の 2 回目: 部屋によって環境音が 20 dB 以上違い、空調の大きい部屋では足音が環境音 +1.5 dB しかなく埋もれていた
   */
  get stepBoost(): number {
    const db = Math.max(0, Math.min(STEP_BOOST_MAX_DB, this.ambientDb + STEP_MARGIN_DB - STEP_REF_DB));
    return Math.pow(10, db / 20);
  }

  /** プレイヤーの動作音に掛ける倍率（stepBoost × 一律の下げ幅） */
  private get playerGain(): number {
    return this.stepBoost * PLAYER_SFX_TRIM;
  }

  /**
   * 残響の見張り（保険）: 出力に NaN / Infinity、または |x| > REVERB_RUNAWAY（通常は 1 未満）があれば、残響を作り直す。
   * 出力側は Gain だけなので、残響の中で数値が壊れると全体が無音のままになる（第19回の不具合の後半）。作り直せばすぐ戻る
   */
  private watchReverb(now: number): void {
    const probe = this.reverbProbe, buf = this.reverbProbeBuf;
    if (!probe || !buf || now < this.reverbProbeNext) return;
    this.reverbProbeNext = now + 0.25;
    probe.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      if (!Number.isFinite(v)) { peak = Infinity; break; }
      peak = Math.max(peak, Math.abs(v));
    }
    if (peak <= REVERB_RUNAWAY) return;
    this.reverbResets++;
    console.warn(`[AudioEngine] reverb runaway (peak ${peak}) → rebuild #${this.reverbResets}`);
    this.buildReverb(this.tier.convolver);
  }

  // ---------------------------------------------------------------- 部屋
  /**
   * 入室時に環境音・残響・足音の床材を切り替える。info=null（v1 の Adapter = 通路）は環境音を維持し、床材と残響だけ更新する。
   * ctx 未生成（開始前）なら保留し unlock 時に適用する
   */
  setRoom(info: AudioRoomInfo | null, layout: AudioLayout, tier?: QualityTier, opts: RoomAudioOptions = {}): void {
    if (tier) this.setTier(tier);
    this.room.roomId = opts.roomId;
    this.room.floor = floorKindOf(layout.palette.floor, opts.wet);
    this.room.doorMat = doorMatOf(layout.palette.door);
    let mix: PresetMix | null = null;
    if (info || opts.presetOverride) {
      mix = mapPreset(opts.presetOverride ?? info?.audioPreset ?? '');
      this.room.silent = !!mix.silent;
      this.room.label = mix.label;
    }
    const est = estimateRT60(layout.bounds, layout.palette, { hints: opts.hints ?? info?.layoutHints, floorSec: mix?.reverbFloorSec });
    if (!this.ctx || !this.mixer) {
      this.pendingRoom = { info, layout, opts };
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

  /** 区画の audioPreset を後から差し替える（v1 では Modifier の EraPreset / AmbientCarryover / FarLink 混在などが使った） */
  overridePreset(label: string, gainMul = 1): void {
    if (!this.mixer) return;
    const mix = mapPreset(label);
    if (gainMul !== 1) for (const l of mix.layers) l.gain *= gainMul;
    this.room.label = mix.label;
    this.room.silent = !!mix.silent;
    this.mixer.setPreset(mix, { force: true });
  }

  /** 隣室の漏れ音（扉中心に定位）。API のみ — 統合側で呼ばなければ何もしない。info=null で止める */
  setNeighborLeak(info: Pick<AudioRoomInfo, 'audioPreset'> | null, doorPos: Vec3, open: boolean): void {
    if (!this.mixer) return;
    this.mixer.setLeak(info ? mapPreset(info.audioPreset) : null, doorPos, open);
  }

  clearNeighborLeak(): void {
    this.mixer?.setLeak(null, [0, 0, 0], false);
  }

  // ---------------------------------------------------------------- 効果音
  /** priority: 足音・着地・ジャンプ（プレイヤー自身の動作音）は予算を超えても鳴らす（落ちると「鳴ったり鳴らなかったり」に聞こえる。短く、同時に 2〜3 本まで） */
  private sfx(priority = false): SfxContext | null {
    if (!this.ctx || !this.sh || !this.sfxBus || !this.reverbSend) return null;
    if (!priority && this.sfxActive.length >= VOICE_BUDGET[this.tier.id]) return null; // 予算超過: 一発音は落とす
    const ctx = this.ctx;
    return {
      ctx,
      sh: this.sh,
      dest: { dry: this.sfxBus, reverb: this.reverbSend },
      onVoice: (dur) => this.sfxActive.push(ctx.currentTime + dur),
      samples: (prefix) => this.assets.variants(prefix),
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
    // 足音が遅れて聞こえる部屋（担当 sense）: 鳴らすのを遅らせる（他人の足音 = pos 付きは遅らせない）
    if (this.stepDelaySec > 0 && !pos) {
      const d = this.stepDelaySec;
      setTimeout(() => this.footstepNow(floorMat, rank, crouching, wet, pos), d * 1000);
      return;
    }
    this.footstepNow(floorMat, rank, crouching, wet, pos);
  }

  private footstepNow(floorMat: string | undefined, rank: MoveRank, crouching = false, wet?: boolean, pos?: Vec3): void {
    const sc = this.sfx(true);
    if (!sc) return;
    const floor = floorMat ? floorKindOf(floorMat, wet) : (wet ? 'wet' : this.room.floor);
    this.stepSide = -this.stepSide;
    const send = this.room.silent ? 0.9 : undefined;
    playFootstep(sc, floor, rank, crouching, wet ?? this.room.floor === 'wet', { pos, pan: pos ? undefined : 0.15 * this.stepSide, send, gain: this.playerGain, ...(this.stepPitch !== 1 ? { pitch: this.stepPitch } : {}) });
    this.log(`footstep:${floor}:${rank}`, pos ?? this.listenerPos);
  }

  /** ジャンプの踏み切り（第20回）。floorMat は足元の材質（無ければ部屋の床） */
  jump(floorMat?: string, pos?: Vec3): void {
    const sc = this.sfx(true);
    if (!sc) return;
    const floor = floorMat ? floorKindOf(floorMat) : this.room.floor;
    playJump(sc, floor, { pos, pan: pos ? undefined : 0, gain: this.playerGain });
    this.log(`jump:${floor}`, pos ?? this.listenerPos);
  }

  /** 草木を通り抜ける擦れ（第20回）。strength 0〜1（走ると強い） */
  rustle(strength: number, pos?: Vec3, tall = false): void {
    const sc = this.sfx(true);
    if (!sc) return;
    playRustle(sc, strength, { pos, pan: pos ? undefined : 0.2 * this.stepSide, gain: Math.sqrt(this.stepBoost) * PLAYER_SFX_TRIM }, tall);
    this.log('rustle', pos ?? this.listenerPos, strength);
  }

  /** 着地。speed = 着地時の |vel.y|（m/s） */
  land(speed: number, floorMat?: string, pos?: Vec3): void {
    const sc = this.sfx(true);
    if (!sc) return;
    const floor = floorMat ? floorKindOf(floorMat) : this.room.floor;
    if (playLand(sc, speed, floor, { pos, gain: this.playerGain }) > 0) this.log(`land:${floor}`, pos ?? this.listenerPos, speed);
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
      const entry = { voice, handle, gain: opts.gain ?? 1 };
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
    } else if (isSenseSfx(kind)) {
      dur = playSense(sc, kind, { pos: opts.pos, gain: opts.gain, pan: opts.pan, send: opts.send, pitch: opts.pitch });
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

  // ---------------------------------------------------------------- 環境音の大きさ（撮像 pass の暗部ノイズ用。VideoPass.setAudioNoise）
  /**
   * 環境音バスの現在の大きさの推定（0〜1）。解析ノードは使わず、稼働中の環境音レイヤー（プリセットの gain 上位 budget 本、
   * 幻聴を除く）とループ再生（play(loop) の gain）の gain の二乗和の平方根 bus を `1 - exp(-bus / 1.4)` で 0〜1 に写し、
   * 環境音・全体音量（線形）を掛けたもの。非表示（ambientBus 0）・ctx 未生成 / 停止中は 0。入室のクロスフェードと同じ 1.2 s で追従。
   * 目安（全体音量が既定 0.25 以上 = 旧既定 0.8 相当）: 「無音に近い」（subRumble -30 dB）≈ 0.02 / hvac 1 本（gain 0.5）≈ 0.24 / レイヤー 1 本 gain 1 ≈ 0.41 /
   * 空調 + ハム + PC ファンの 3 本 ≈ 0.57 / 乗車のループ音（gain 0.7）が重なると +0.1 前後
   */
  get ambientLevel(): number {
    return this.ambientLevelNow;
  }

  private estimateAmbientLevel(): number {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.hidden || !this.mixer) return 0;
    let sum = 0;
    const mix = this.mixer.currentMix;
    if (mix) {
      const specs = mix.followUp ? [...mix.layers, ...mix.followUp.layers] : mix.layers;
      for (const id of this.mixer.layerIds()) {
        const spec = specs.find((l) => l.id === id);
        if (!spec || spec.phantom) continue;
        sum += spec.gain * spec.gain;
      }
    }
    for (const l of this.loops) if (l.handle.active) sum += l.gain * l.gain;
    const bus = Math.sqrt(sum);
    // 画面のノイズ連動（VideoPass.setAudioNoise）の調整は旧既定の全体音量 0.8 で行ったので、全体音量は既定（0.25）以上で 0.8 相当、
    // それより下は比例して弱める（既定の見た目を保ったまま、消音ではノイズの連動も消える）
    const vol = this.volumes.ambientVolume * Math.min(1, this.volumes.masterVolume / NOISE_REF_MASTER) * 0.8;
    return Math.max(0, Math.min(1, (1 - Math.exp(-bus / 1.4)) * vol));
  }

  // ---------------------------------------------------------------- マイク / 音量（v1 E17 NoiseGate）
  /** マイク利用を要求（v1 E17 の扉操作時。ユーザージェスチャ内）。許可が無い / 非 HTTPS なら false */
  requestMic(): Promise<boolean> {
    return this.loudness.requestMic();
  }

  /** プレイヤーの移動ランクを渡して現在の音量（0〜1）を得る。マイクがあればマイク音量 */
  loudnessLevel(rank: MovementRank = 'still', jumped = false): number {
    this.loudness.movementLoudness(rank, jumped);
    return this.loudness.level();
  }

  // ---------------------------------------------------------------- 部屋の音の効果（担当 sense）
  /** 全体の音量を絞る（key ごと。gain 1 で外す）。無音の部屋・目を閉じる など */
  setDuck(key: string, gain: number, fadeSec = 0.4): void {
    if (gain >= 0.999) this.ducks.delete(key); else this.ducks.set(key, Math.max(0, gain));
    this.applyRoomFx(fadeSec);
  }

  /** こもらせる（key ごと。hz 以下だけ通す。null で外す）。水の中・壁の向こう など */
  setMuffle(key: string, hz: number | null, fadeSec = 0.3): void {
    if (hz === null) this.muffles.delete(key); else this.muffles.set(key, Math.max(80, hz));
    this.applyRoomFx(fadeSec);
  }

  private applyRoomFx(fadeSec: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.duckNode || !this.muffleNode) return;
    const t = ctx.currentTime;
    let g = 1;
    for (const v of this.ducks.values()) g = Math.min(g, v);
    let hz = 20000;
    for (const v of this.muffles.values()) hz = Math.min(hz, v);
    const ramp = (p: AudioParam, v: number): void => { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + Math.max(0.01, fadeSec)); };
    ramp(this.duckNode.gain, g);
    ramp(this.muffleNode.frequency, hz);
  }

  // ---------------------------------------------------------------- デバッグ
  /** デバッグ表示用（audio.debug()） */
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
