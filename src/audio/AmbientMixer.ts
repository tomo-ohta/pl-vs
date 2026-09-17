/**
 * 環境音ミキサー。部屋遷移で現在部屋の環境音レイヤー集合へ 1.2 s クロスフェードする。
 * 扉越しの漏れ音（隣室の環境音を扉中心に定位 + lowpass 600 Hz + -12 dB の 1 本ミックス）は API だけ用意（setLeak）。
 * ボイス予算（setBudget）を超えるレイヤーはゲインの小さいものから落とす。
 * アセット（AssetManifest）にレイヤー id があればサンプルループ（SampleLayer）に差し替える。
 */
import type { Vec3 } from '../core/types';
import { AssetManifest, SampleLayer } from './AssetManifest';
import type { LayerSpec, PresetMix } from './presetMap';
import { DEFAULT_SEND, Layer, type LayerDest, type SharedSources } from './Synth';

/** Layer / SampleLayer 共通の操作系 */
export interface AmbientVoice {
  readonly id: string;
  start(fadeSec?: number): void;
  stop(fadeSec?: number): void;
  setGain(v: number, fadeSec?: number): void;
  update(now: number): void;
  dispose(): void;
  readonly isStopped: boolean;
}

export interface VoiceOptions {
  pos?: Vec3;
  lowpassHz?: number;
  /** ゲイン倍率（漏れ音の -12 dB など） */
  gainMul?: number;
}

/** LayerSpec から 1 本の環境音を作る（アセットがあればサンプル、無ければ合成） */
export function makeVoice(ctx: BaseAudioContext, sh: SharedSources, dest: LayerDest, assets: AssetManifest | null, spec: LayerSpec, opts: VoiceOptions = {}): AmbientVoice {
  const gain = spec.gain * (opts.gainMul ?? 1);
  const buf = assets?.get(spec.id);
  if (buf) {
    return new SampleLayer(ctx, spec.id, buf, dest, {
      gain,
      lowpassHz: Math.min(spec.lowpassHz ?? Infinity, opts.lowpassHz ?? Infinity) < Infinity ? Math.min(spec.lowpassHz ?? Infinity, opts.lowpassHz ?? Infinity) : undefined,
      reverbSend: spec.reverbSend ?? DEFAULT_SEND[spec.id],
      pos: opts.pos,
    });
  }
  return new Layer(ctx, sh, { ...spec, gain }, dest, { pos: opts.pos, lowpassHz: opts.lowpassHz });
}

interface Bed {
  label: string;
  mix: PresetMix;
  voices: AmbientVoice[];
  startedAt: number;
  followUpDone: boolean;
}

export const CROSSFADE_SEC = 1.2;
export const LEAK_LOWPASS_HZ = 600;
export const LEAK_GAIN = Math.pow(10, -12 / 20);

export class AmbientMixer {
  private readonly ctx: BaseAudioContext;
  private readonly sh: SharedSources;
  private readonly dest: LayerDest;
  private readonly assets: AssetManifest | null;
  private current: Bed | null = null;
  private leak: { label: string; voices: AmbientVoice[]; pos: Vec3 } | null = null;
  private budget = 16;
  /** 部屋内 1 点に定位するレイヤー（「局所的な雨音」）の位置を決める */
  private localPos: Vec3 | undefined;

  constructor(ctx: BaseAudioContext, sh: SharedSources, dest: LayerDest, assets: AssetManifest | null = null) {
    this.ctx = ctx;
    this.sh = sh;
    this.dest = dest;
    this.assets = assets;
  }

  get currentLabel(): string {
    return this.current?.label ?? '';
  }

  get currentMix(): PresetMix | null {
    return this.current?.mix ?? null;
  }

  /** 稼働中のボイス数（漏れ音を含む） */
  get voiceCount(): number {
    return (this.current?.voices.length ?? 0) + (this.leak?.voices.length ?? 0);
  }

  layerIds(): string[] {
    return this.current?.voices.map((v) => v.id) ?? [];
  }

  /** 環境音レイヤーに使える上限本数 */
  setBudget(n: number): void {
    this.budget = Math.max(1, n);
    if (this.current && this.current.voices.length > this.budget) {
      // 超過分（ゲインの小さい順に並んでいる末尾）を落とす
      const drop = this.current.voices.splice(this.budget);
      for (const v of drop) v.stop(0.8);
    }
  }

  /** 現在部屋の環境音を切り替える（同じラベルなら何もしない） */
  setPreset(mix: PresetMix, opts: { fadeSec?: number; localPos?: Vec3; force?: boolean } = {}): void {
    const fade = opts.fadeSec ?? CROSSFADE_SEC;
    this.localPos = opts.localPos;
    if (this.current && this.current.label === mix.label && !opts.force) return;
    const prev = this.current;
    if (prev) for (const v of prev.voices) v.stop(fade);
    const voices = this.spawn(mix.layers, this.budget);
    for (const v of voices) v.start(fade);
    this.current = { label: mix.label, mix, voices, startedAt: this.ctx.currentTime, followUpDone: !mix.followUp };
  }

  /** 全停止（メニューの「新しい世界」など） */
  clear(fadeSec = CROSSFADE_SEC): void {
    if (this.current) for (const v of this.current.voices) v.stop(fadeSec);
    this.current = null;
    this.setLeak(null, [0, 0, 0], false, fadeSec);
  }

  /**
   * 扉越しの漏れ音。隣室の preset を扉中心 doorPos に定位した 1 本のミックス（最大ゲインのレイヤー 1 本）で置く。
   * open=false なら lowpass 600 Hz + -12 dB、open=true なら lowpass 無し -6 dB。mix=null で停止
   */
  setLeak(mix: PresetMix | null, doorPos: Vec3, open: boolean, fadeSec = CROSSFADE_SEC): void {
    const label = mix ? `${mix.label}${open ? '+' : '-'}` : '';
    if (this.leak && this.leak.label === label) {
      return;
    }
    if (this.leak) for (const v of this.leak.voices) v.stop(fadeSec);
    this.leak = null;
    if (!mix || mix.layers.length === 0) return;
    // 幻聴・ワンショット系を避け、連続音の中で最も大きい 1 本
    const cand = [...mix.layers].filter((l) => !l.phantom).sort((a, b) => b.gain - a.gain)[0] ?? mix.layers[0];
    const v = makeVoice(this.ctx, this.sh, this.dest, this.assets, cand, {
      pos: doorPos,
      lowpassHz: open ? undefined : LEAK_LOWPASS_HZ,
      gainMul: open ? Math.pow(10, -6 / 20) : LEAK_GAIN,
    });
    v.start(fadeSec);
    this.leak = { label, voices: [v], pos: doorPos };
  }

  update(now: number): void {
    const cur = this.current;
    if (cur) {
      for (const v of cur.voices) v.update(now);
      // 「A→B」: 30 秒後に B へクロスフェード
      if (!cur.followUpDone && cur.mix.followUp && now - cur.startedAt >= cur.mix.followUp.afterSec) {
        cur.followUpDone = true;
        for (const v of cur.voices) v.stop(CROSSFADE_SEC * 2);
        cur.voices = this.spawn(cur.mix.followUp.layers, this.budget);
        for (const v of cur.voices) v.start(CROSSFADE_SEC * 2);
      }
    }
    if (this.leak) for (const v of this.leak.voices) v.update(now);
  }

  dispose(): void {
    if (this.current) for (const v of this.current.voices) v.dispose();
    if (this.leak) for (const v of this.leak.voices) v.dispose();
    this.current = null;
    this.leak = null;
  }

  private spawn(layers: LayerSpec[], budget: number): AmbientVoice[] {
    const sorted = [...layers].sort((a, b) => b.gain - a.gain).slice(0, budget);
    return sorted.map((spec) => makeVoice(this.ctx, this.sh, this.dest, this.assets, spec, { pos: spec.localized ? this.localPos : undefined }));
  }
}
