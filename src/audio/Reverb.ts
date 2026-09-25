/**
 * 残響。部屋の体積と材質から Sabine 近似で RT60 を求め、5 段階（0.4 / 0.8 / 1.5 / 2.5 / 4.0 s）に量子化する。
 * 実装は 2 種を IReverb で差し替える:
 *   - ConvolverReverb: 手続き生成インパルス（指数減衰ノイズ + 高域減衰）の A/B 2 本を 1.2 s でクロスフェード。IR は段階ごとにキャッシュ
 *   - DelayReverb: 4 comb + 2 allpass のフィードバックディレイ（QualityTier.convolver = false のとき）
 * 残響は現在部屋 1 つ分のみ。隣室の音も現在部屋のリバーブを通す。
 */
import type { AABB } from '../core/aabb';
import type { MatId, Palette } from '../generators/layout';

export const RT60_STEPS: readonly number[] = [0.4, 0.8, 1.5, 2.5, 4.0];
export const RT60_MIN = 0.3;
export const RT60_MAX = 4.5;

/** 吸音率（Sabine の α）。材質表に無いものは 0.1 */
const ABSORPTION: Partial<Record<MatId, number>> = {
  floorTile: 0.05, floorConcrete: 0.05, floorLino: 0.08, floorWood: 0.15, floorCarpetRed: 0.3, floorCarpetGrey: 0.3,
  wallConcrete: 0.05, wallBeige: 0.1, wallWhite: 0.1, wallCream: 0.1, wallGreen: 0.1, wallDark: 0.1, glass: 0.04,
  ceilingTile: 0.3, ceilingWhite: 0.1, ceilingDark: 0.1,
  water: 0.02, placeholder: 0.1,
};

export interface ReverbEstimate {
  /** クランプ前の RT60（秒） */
  rt60: number;
  /** 量子化後（RT60_STEPS のいずれか） */
  quantized: number;
  /** プリディレイ（秒）= 最短辺 / 343 */
  preDelay: number;
}

/**
 * RT60 = 0.161·V / (S·α)。hints に 'reverbHigh' があれば ×1.6、floorSec（「巨大反響」など）で下限を持ち上げる。
 */
export function estimateRT60(bounds: AABB, palette: Palette, opts: { hints?: readonly string[]; floorSec?: number } = {}): ReverbEstimate {
  const w = Math.max(0.5, bounds.max[0] - bounds.min[0]);
  const h = Math.max(0.5, bounds.max[1] - bounds.min[1]);
  const d = Math.max(0.5, bounds.max[2] - bounds.min[2]);
  const V = w * h * d;
  const floorA = w * d;
  const wallA = 2 * (w + d) * h;
  const a = (m: MatId): number => ABSORPTION[m] ?? 0.1;
  // 面積加重の吸音（床・天井・壁）
  const absorption = floorA * a(palette.floor) + floorA * a(palette.ceiling) + wallA * a(palette.wall);
  let rt60 = (0.161 * V) / Math.max(1e-3, absorption);
  if (opts.hints?.includes('reverbHigh')) rt60 *= 1.6;
  if (opts.floorSec !== undefined) rt60 = Math.max(rt60, opts.floorSec);
  rt60 = Math.min(RT60_MAX, Math.max(RT60_MIN, rt60));
  return { rt60, quantized: quantizeRT60(rt60), preDelay: Math.min(w, h, d) / 343 };
}

/** 最も近い段階へ量子化 */
export function quantizeRT60(sec: number): number {
  let best = RT60_STEPS[0];
  for (const s of RT60_STEPS) if (Math.abs(s - sec) < Math.abs(best - sec)) best = s;
  return best;
}

export interface IReverb {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** RT60（RT60_STEPS のいずれかに丸められる）とプリディレイを切り替える */
  setRT60(sec: number, preDelaySec?: number, fadeSec?: number): void;
  readonly rt60: number;
  dispose(): void;
}

export function createReverb(ctx: BaseAudioContext, convolver: boolean): IReverb {
  return convolver ? new ConvolverReverb(ctx) : new DelayReverb(ctx);
}

// ---------------------------------------------------------------- Convolver
/** 指数減衰ノイズに高域減衰を掛けたステレオ IR を生成する（OfflineAudioContext 不要） */
export function generateImpulse(ctx: BaseAudioContext, rt60: number, preDelay: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * (rt60 * 1.05 + preDelay)) + 1;
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(preDelay * sr);
  // -60 dB に rt60 秒で到達する減衰
  const decay = Math.log(1000) / (rt60 * sr);
  for (let ch = 0; ch < 2; ch++) {
    const o = buf.getChannelData(ch);
    // 高域を時間とともに落とす 1 極ローパス（残響後半をこもらせる）
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const n = i - pre;
      const env = Math.exp(-decay * n);
      const coef = 0.15 + 0.6 * (n / (len - pre)); // 前半 0.15 → 後半 0.75（強いローパス）
      const w = Math.random() * 2 - 1;
      lp += (w - lp) * (1 - coef);
      // 直後の初期反射を少し濃くする
      const early = n < sr * 0.08 ? 1.6 : 1;
      o[i] = lp * env * early;
    }
    // 正規化
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(o[i]));
    const norm = peak > 0 ? 0.5 / peak : 1;
    for (let i = 0; i < len; i++) o[i] *= norm;
  }
  return buf;
}

export class ConvolverReverb implements IReverb {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly ctx: BaseAudioContext;
  private readonly a: { conv: ConvolverNode; gain: GainNode };
  private readonly b: { conv: ConvolverNode; gain: GainNode };
  private useA = true;
  private readonly cache = new Map<string, AudioBuffer>();
  private _rt60 = 0;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    const mk = () => {
      const conv = ctx.createConvolver();
      conv.normalize = false;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      this.input.connect(conv).connect(gain).connect(this.output);
      return { conv, gain };
    };
    this.a = mk();
    this.b = mk();
  }

  get rt60(): number {
    return this._rt60;
  }

  setRT60(sec: number, preDelaySec = 0.01, fadeSec = 1.2): void {
    const q = quantizeRT60(sec);
    const pd = Math.round(Math.min(0.08, Math.max(0.002, preDelaySec)) * 100) / 100;
    if (q === this._rt60 && this.cacheKey(q, pd) === this.currentKey) return;
    const key = this.cacheKey(q, pd);
    let ir = this.cache.get(key);
    if (!ir) {
      ir = generateImpulse(this.ctx, q, pd);
      this.cache.set(key, ir);
    }
    const from = this.useA ? this.a : this.b;
    const to = this.useA ? this.b : this.a;
    to.conv.buffer = ir;
    const t = this.ctx.currentTime;
    to.gain.gain.cancelScheduledValues(t);
    to.gain.gain.setValueAtTime(to.gain.gain.value, t);
    to.gain.gain.linearRampToValueAtTime(1, t + fadeSec);
    from.gain.gain.cancelScheduledValues(t);
    from.gain.gain.setValueAtTime(from.gain.gain.value, t);
    from.gain.gain.linearRampToValueAtTime(0, t + fadeSec);
    this.useA = !this.useA;
    this._rt60 = q;
    this.currentKey = key;
  }

  private currentKey = '';
  private cacheKey(q: number, pd: number): string {
    return `${q}:${pd}`;
  }

  dispose(): void {
    for (const s of [this.a, this.b]) { s.conv.disconnect(); s.gain.disconnect(); }
    this.input.disconnect();
    this.output.disconnect();
    this.cache.clear();
  }
}

// ---------------------------------------------------------------- フィードバックディレイ（tier low）
const COMB_DELAYS = [0.0297, 0.0371, 0.0411, 0.0437];
const ALLPASS_DELAYS = [0.005, 0.0017];
/** comb の高域減衰の遮断周波数（Hz）。RT60 > 2 s は暗く（DAMP_DARK）、それ以下は明るく（DAMP_BRIGHT） */
const DAMP_DARK = 2500;
const DAMP_BRIGHT = 3500;

/**
 * comb のループ内の高域減衰: どの周波数でも利得 ≤ 1 の 1 次ローパス（IIRFilterNode）。
 * 第19回の不具合: 以前は BiquadFilter の lowpass（既定 Q = 1 dB）で、遮断周波数の近くに +2 dB の山があり、
 * フィードバック 0.97 と掛けてループ利得が 1 を超えた（RT60 1.5 s で 1.09 → 約 2.7 kHz が毎秒 +26 dB で増え、
 * 振り切れて音割れ → 数値が Infinity / NaN になって全体が無音）。tier low（スマホで重いとき）だけで起きた。
 * IIRFilterNode が無い環境は Butterworth（Q = -3.01 dB。山なし）の biquad
 */
function dampingFilter(ctx: BaseAudioContext, fc: number): AudioNode {
  const a = Math.exp((-2 * Math.PI * fc) / ctx.sampleRate);
  const iir = (ctx as BaseAudioContext & { createIIRFilter?: BaseAudioContext['createIIRFilter'] }).createIIRFilter;
  if (typeof iir === 'function') return iir.call(ctx, [1 - a], [1, -a]); // y[n] = (1-a)·x[n] + a·y[n-1]（DC 利得 1、単調減少）
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = fc;
  f.Q.value = -3.0103;
  return f;
}

export class DelayReverb implements IReverb {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly ctx: BaseAudioContext;
  /** dark / bright: 2 つの減衰フィルターの混合比（和は 1。利得 ≤ 1 のフィルターの凸結合なので、混ぜても ≤ 1） */
  private readonly combs: { delay: DelayNode; fb: GainNode; dark: GainNode; bright: GainNode }[] = [];
  private readonly nodes: AudioNode[] = [];
  private readonly pre: DelayNode;
  private _rt60 = 0;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.pre = ctx.createDelay(0.1);
    this.pre.delayTime.value = 0.01;
    this.input.connect(this.pre);
    const sum = ctx.createGain();
    sum.gain.value = 0.3;
    this.nodes.push(sum);
    for (const d of COMB_DELAYS) {
      const delay = ctx.createDelay(0.1);
      delay.delayTime.value = d;
      const fb = ctx.createGain();
      // ループ: delay → (暗い減衰 × dark + 明るい減衰 × bright) → fb（≤ 0.97）→ delay。ループ利得はどの周波数でも ≤ 0.97
      const lpDark = dampingFilter(ctx, DAMP_DARK), lpBright = dampingFilter(ctx, DAMP_BRIGHT);
      const dark = ctx.createGain(), bright = ctx.createGain();
      dark.gain.value = 0;
      bright.gain.value = 1;
      this.pre.connect(delay);
      delay.connect(lpDark).connect(dark).connect(fb);
      delay.connect(lpBright).connect(bright).connect(fb);
      fb.connect(delay);
      delay.connect(sum);
      this.combs.push({ delay, fb, dark, bright });
      this.nodes.push(delay, fb, lpDark, lpBright, dark, bright);
    }
    // allpass 2 段（拡散）
    let node: AudioNode = sum;
    for (const d of ALLPASS_DELAYS) {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = d;
      const fb = ctx.createGain();
      fb.gain.value = 0.5;
      const ff = ctx.createGain();
      ff.gain.value = -0.5;
      const out = ctx.createGain();
      node.connect(ff).connect(out);
      node.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(out);
      this.nodes.push(delay, fb, ff, out);
      node = out;
    }
    node.connect(this.output);
    this.setRT60(0.8);
  }

  get rt60(): number {
    return this._rt60;
  }

  setRT60(sec: number, preDelaySec = 0.01, fadeSec = 1.2): void {
    const q = quantizeRT60(sec);
    this._rt60 = q;
    const t = this.ctx.currentTime;
    this.pre.delayTime.setTargetAtTime(Math.min(0.08, Math.max(0.002, preDelaySec)), t, fadeSec / 3);
    for (const c of this.combs) {
      // g = 10^(-3·delay / RT60)
      const g = Math.pow(10, (-3 * c.delay.delayTime.value) / q);
      c.fb.gain.setTargetAtTime(Math.min(0.97, g), t, fadeSec / 3);
      // 暗さの切り替えは混合比で（和を 1 に保つ = ループ利得 ≤ 0.97 のまま）
      const k = q > 2 ? 1 : 0;
      c.dark.gain.setTargetAtTime(k, t, fadeSec / 3);
      c.bright.gain.setTargetAtTime(1 - k, t, fadeSec / 3);
    }
  }

  dispose(): void {
    for (const n of this.nodes) n.disconnect();
    this.pre.disconnect();
    this.input.disconnect();
    this.output.disconnect();
  }
}
