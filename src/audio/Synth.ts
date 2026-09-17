/**
 * 手続き合成レイヤー工場。共有ノイズバッファ（white / pink / brown 各 1 本）を BiquadFilter・LFO・
 * 予定再生のワンショットで色付けして約 70 種の環境音レイヤーを作る。音声ファイルは使わない。
 *
 * - LAYER_BUILDERS[id](kit) が LayerGraph を返す。Layer クラスが gain / fader / lowpass / send / 定位を付けて
 *   ambient バス・リバーブ send に接続する。
 * - 乱数は Math.random（環境音はゲーム進行に影響しないため決定論に含めない）。
 * - AudioContext を受け取ってから初めてノードを作る（import 時に Web Audio へ触れない。Node でも読み込める）。
 * - Sfx.ts も tone / burst / voice の一発音ヘルパーを共用する。
 */
import { LAYER_IDS, type LayerId, type LayerSpec } from './presetMap';

// ---------------------------------------------------------------- 共有ノイズ
export interface SharedSources {
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
}

/** 4 秒のノイズバッファ 3 種を 1 回だけ生成する */
export function createShared(ctx: BaseAudioContext): SharedSources {
  const n = Math.floor(ctx.sampleRate * 4);
  const mk = (fill: (out: Float32Array) => void): AudioBuffer => {
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    fill(buf.getChannelData(0));
    return buf;
  };
  const white = mk((o) => { for (let i = 0; i < n; i++) o[i] = Math.random() * 2 - 1; });
  // Paul Kellet 近似のピンクノイズ
  const pink = mk((o) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  });
  const brown = mk((o) => {
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      o[i] = last * 3.5;
    }
  });
  return { white, pink, brown };
}

export type NoiseKind = keyof SharedSources;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------- 一発音ヘルパー（Sfx と共用）
export interface ToneOpts {
  freq: number;
  /** 終端周波数（ピッチスイープ） */
  freqTo?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  attack?: number;
  /** 倍音（相対周波数 → 相対ゲイン）。ピアノ・チャイム用 */
  partials?: [number, number][];
}

/** 時刻 t にオシレータの一発音を dest へ鳴らす。終了時刻を返す */
export function tone(ctx: BaseAudioContext, dest: AudioNode, t: number, o: ToneOpts): number {
  const g = ctx.createGain();
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  g.connect(dest);
  const partials = o.partials ?? [[1, 1]];
  for (const [rel, amp] of partials) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq * rel, t);
    if (o.freqTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo * rel), t + o.dur);
    const pg = ctx.createGain();
    pg.gain.value = amp;
    osc.connect(pg).connect(g);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
    osc.onended = () => { osc.disconnect(); pg.disconnect(); };
  }
  setTimeout(() => g.disconnect(), Math.max(0, (t + o.dur + 0.2 - ctx.currentTime) * 1000));
  return t + o.dur;
}

export interface BurstOpts {
  kind?: NoiseKind;
  dur: number;
  gain: number;
  attack?: number;
  /** バンドパス中心（Hz）。省略時は hp/lp のみ */
  bp?: number;
  q?: number;
  hp?: number;
  lp?: number;
  /** バンドパス / ローパスの終端周波数（スイープ） */
  sweepTo?: number;
  rate?: number;
}

/** 時刻 t にノイズの一発音を dest へ鳴らす。終了時刻を返す */
export function burst(ctx: BaseAudioContext, sh: SharedSources, dest: AudioNode, t: number, o: BurstOpts): number {
  const src = ctx.createBufferSource();
  src.buffer = sh[o.kind ?? 'white'];
  src.loop = true;
  src.loopStart = Math.random() * 3;
  src.playbackRate.value = o.rate ?? 1;
  let node: AudioNode = src;
  const chain: AudioNode[] = [];
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; chain.push(f); }
  if (o.bp) {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(o.bp, t); f.Q.value = o.q ?? 1;
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + o.dur);
    node.connect(f); node = f; chain.push(f);
  }
  if (o.lp) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); f.Q.value = o.q ?? 0.7;
    if (o.sweepTo && !o.bp) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + o.dur);
    node.connect(f); node = f; chain.push(f);
  }
  const g = ctx.createGain();
  const a = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  node.connect(g).connect(dest);
  src.start(t, src.loopStart);
  src.stop(t + o.dur + 0.05);
  src.onended = () => { src.disconnect(); for (const c of chain) c.disconnect(); g.disconnect(); };
  return t + o.dur;
}

export interface VoiceOpts {
  /** 基本周波数（Hz） */
  f0: number;
  dur: number;
  gain: number;
  /** 音節の平均長（秒）。短いほど早口 */
  syllable?: number;
  /** 音節ごとのピッチ揺れ（半音） */
  drift?: number;
  /** フォルマント帯の範囲（F1, F2 のそれぞれ [min, max]） */
  f1?: [number, number];
  f2?: [number, number];
  /** 帯域制限（PA スピーカー風など） */
  lp?: number;
  hp?: number;
}

/** 言葉にならない「声」（フォルマント合成）。時刻 t から dur 秒。終了時刻を返す */
export function voice(ctx: BaseAudioContext, dest: AudioNode, t: number, o: VoiceOpts): number {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const syl = o.syllable ?? 0.16;
  const drift = o.drift ?? 3;
  const f1r = o.f1 ?? [350, 800];
  const f2r = o.f2 ?? [1000, 2200];
  const formants = [f1r, f2r, [2400, 3000] as [number, number]].map(([lo, hi], i) => {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = i === 2 ? 6 : 8;
    f.frequency.setValueAtTime(rnd(lo, hi), t);
    return { f, lo, hi };
  });
  const sum = ctx.createGain();
  sum.gain.value = 1;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  for (const { f } of formants) osc.connect(f).connect(sum);
  let tail: AudioNode = sum;
  const extra: AudioNode[] = [];
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; tail.connect(f); tail = f; extra.push(f); }
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; tail.connect(f); tail = f; extra.push(f); }
  tail.connect(env).connect(dest);
  // 音節ごとにピッチとフォルマントを動かし、振幅を脈動させる
  let tt = t;
  let f0 = o.f0;
  osc.frequency.setValueAtTime(f0, t);
  while (tt < t + o.dur) {
    const len = syl * rnd(0.6, 1.5);
    f0 *= Math.pow(2, rnd(-drift, drift) / 12);
    f0 = Math.min(o.f0 * 1.8, Math.max(o.f0 * 0.6, f0));
    osc.frequency.linearRampToValueAtTime(f0, tt + len);
    for (const { f, lo, hi } of formants) f.frequency.linearRampToValueAtTime(rnd(lo, hi), tt + len * 0.7);
    const peak = o.gain * rnd(0.5, 1);
    env.gain.linearRampToValueAtTime(peak, tt + len * 0.35);
    env.gain.linearRampToValueAtTime(peak * 0.25, tt + len * 0.9);
    tt += len;
  }
  env.gain.linearRampToValueAtTime(0.0001, tt + 0.08);
  osc.start(t);
  osc.stop(tt + 0.1);
  osc.onended = () => { osc.disconnect(); for (const { f } of formants) f.disconnect(); sum.disconnect(); env.disconnect(); for (const e of extra) e.disconnect(); };
  return tt;
}

// ---------------------------------------------------------------- Kit（レイヤー構築用の小道具）
export interface LayerGraph {
  out: AudioNode;
  /** 毎フレーム呼ばれる（ctx.currentTime）。予定再生を進める */
  update?: (now: number) => void;
  dispose: () => void;
}

interface Pulser {
  next: number;
  mean: number;
  jitter: number;
  fire: (t: number) => void;
}

export class Kit {
  readonly ctx: BaseAudioContext;
  readonly sh: SharedSources;
  /** 周波数倍率（「低い」= 0.5） */
  readonly pitch: number;
  private readonly pitchOct: number;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly pulsers: Pulser[] = [];
  private readonly subs: LayerGraph[] = [];

  constructor(ctx: BaseAudioContext, sh: SharedSources, pitchOct = 0) {
    this.ctx = ctx;
    this.sh = sh;
    this.pitchOct = pitchOct;
    this.pitch = Math.pow(2, pitchOct);
  }

  /** 周波数にピッチ倍率を掛ける */
  f(hz: number): number {
    return hz * this.pitch;
  }

  track<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  noise(kind: NoiseKind, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.sh[kind];
    s.loop = true;
    s.playbackRate.value = rate * this.pitch;
    s.start(this.ctx.currentTime, Math.random() * 3.5);
    this.sources.push(s);
    return this.track(s);
  }

  osc(type: OscillatorType, freq: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = this.f(freq);
    o.detune.value = detune;
    o.start();
    this.sources.push(o);
    return this.track(o);
  }

  filter(input: AudioNode, type: BiquadFilterType, freq: number, q = 0.7, gainDb = 0): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = this.f(freq);
    f.Q.value = q;
    f.gain.value = gainDb;
    input.connect(f);
    return this.track(f);
  }

  lp(input: AudioNode, freq: number, q = 0.7): BiquadFilterNode { return this.filter(input, 'lowpass', freq, q); }
  hp(input: AudioNode, freq: number, q = 0.7): BiquadFilterNode { return this.filter(input, 'highpass', freq, q); }
  bp(input: AudioNode, freq: number, q = 1): BiquadFilterNode { return this.filter(input, 'bandpass', freq, q); }

  gain(input: AudioNode | null, value: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    if (input) input.connect(g);
    return this.track(g);
  }

  /** 複数ノードを 1 つの GainNode に集める */
  mix(...inputs: AudioNode[]): GainNode {
    const g = this.gain(null, 1);
    for (const i of inputs) i.connect(g);
    return g;
  }

  /** LFO: param に hz の揺れを depth だけ加える */
  lfo(param: AudioParam, hz: number, depth: number, type: OscillatorType = 'sine'): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    const g = this.ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    this.sources.push(o);
    this.track(g);
    return this.track(o);
  }

  /** 平均 mean 秒（±jitter 比率）ごとに fire(t) を予定する */
  pulser(mean: number, jitter: number, fire: (t: number) => void, firstDelay?: number): void {
    this.pulsers.push({ next: this.ctx.currentTime + (firstDelay ?? Math.random() * mean), mean, jitter, fire });
  }

  tone(dest: AudioNode, t: number, o: ToneOpts): number {
    return tone(this.ctx, dest, t, { ...o, freq: this.f(o.freq), freqTo: o.freqTo !== undefined ? this.f(o.freqTo) : undefined });
  }

  burst(dest: AudioNode, t: number, o: BurstOpts): number {
    const s = (v?: number) => (v === undefined ? undefined : this.f(v));
    return burst(this.ctx, this.sh, dest, t, { ...o, bp: s(o.bp), hp: s(o.hp), lp: s(o.lp), sweepTo: s(o.sweepTo) });
  }

  voice(dest: AudioNode, t: number, o: VoiceOpts): number {
    return voice(this.ctx, dest, t, { ...o, f0: this.f(o.f0) });
  }

  /** 他のレイヤーを部品として組み込む（屋外環境音など）。子 Kit で構築し、update / dispose を連鎖させる */
  sub(id: LayerId, gain: number): GainNode {
    const child = new Kit(this.ctx, this.sh, this.pitchOct);
    const g = LAYER_BUILDERS[id](child);
    this.subs.push(g);
    return this.gain(g.out, gain);
  }

  /** 構築結果をまとめる */
  done(out: AudioNode): LayerGraph {
    const pulsers = this.pulsers;
    const subs = this.subs;
    return {
      out,
      update: pulsers.length || subs.some((s) => s.update)
        ? (now) => {
          for (const p of pulsers) {
            if (p.next < now - 1) p.next = now + Math.random() * 0.5; // タブ非表示などで遅れたら追いつかない
            while (p.next < now + 0.3) {
              p.fire(p.next);
              p.next += Math.max(0.02, p.mean * (1 + p.jitter * (Math.random() * 2 - 1)));
            }
          }
          for (const s of subs) s.update?.(now);
        }
        : undefined,
      dispose: () => {
        for (const s of this.sources) { try { s.stop(); } catch { /* 既に停止 */ } }
        for (const n of this.nodes) n.disconnect();
        for (const s of subs) s.dispose();
        pulsers.length = 0;
      },
    };
  }
}

// ---------------------------------------------------------------- レイヤー定義
type Builder = (k: Kit) => LayerGraph;

/** レイヤー既定のリバーブ send（未記載は 0.2） */
export const DEFAULT_SEND: Partial<Record<LayerId, number>> = {
  reverbTail: 0.9, footstepsEcho: 0.85, wetFootsteps: 0.8, waterDrip: 0.7, metalClank: 0.6, knock: 0.5, dishes: 0.5,
  chime: 0.6, piano: 0.6, paAnnounce: 0.6, laughter: 0.6, children: 0.6, iceCrack: 0.7, delayEcho: 0.6, numberCall: 0.5,
  pipeKnock: 0.5, doorCreak: 0.4, wallScrape: 0.4, cameraShutter: 0.4, shutter: 0.4, elevatorHum: 0.3, clockTick: 0.35,
  hvac: 0.1, subRumble: 0.05, electricHum: 0.05, fluorescentHum: 0.05, fluorescentHumDetuned: 0.05, muzak: 0.3,
  crowdMurmur: 0.4, dogBark: 0.5, birds: 0.3, insects: 0.1, rain: 0.1, wind: 0.05, windStrong: 0.05, breeze: 0.05,
};

/** 声系の短い上昇音列（笑い・歓声） */
function giggle(k: Kit, dest: AudioNode, t: number, f0: number, count: number, gain: number): number {
  let tt = t;
  for (let i = 0; i < count; i++) {
    const len = rnd(0.09, 0.16);
    k.voice(dest, tt, { f0: f0 * Math.pow(2, (count - i) * -0.03), dur: len, gain, syllable: len, drift: 1, f1: [500, 900], f2: [1400, 2200], lp: 3200 });
    tt += len + rnd(0.02, 0.06);
  }
  return tt;
}

function windLike(k: Kit, lo: number, hi: number, whistle: boolean, level: number): LayerGraph {
  const n = k.noise('brown');
  const f = k.bp(n, (lo + hi) / 2, 0.8);
  const g = k.gain(f, level);
  const out = k.mix(g);
  // 数秒ごとに帯域と強さを別の値へ滑らかに動かす（風の息）
  k.pulser(2.5, 0.6, (t) => {
    f.frequency.setTargetAtTime(k.f(rnd(lo, hi)), t, 1.2);
    g.gain.setTargetAtTime(level * rnd(0.35, 1.3), t, 1.0);
  }, 0);
  if (whistle) {
    const w = k.bp(k.noise('white'), 900, 12);
    const wg = k.gain(w, 0.08);
    wg.connect(out);
    k.pulser(4, 0.7, (t) => {
      w.frequency.setTargetAtTime(k.f(rnd(500, 1400)), t, 1.5);
      wg.gain.setTargetAtTime(rnd(0, 0.16), t, 1.5);
    }, 1);
  }
  return k.done(out);
}

function hum(k: Kit, base: number, level: number): GainNode {
  const o1 = k.osc('sine', base);
  const o2 = k.osc('sine', base * 2);
  const o3 = k.osc('sine', base * 3);
  const m = k.mix(k.gain(o1, 1), k.gain(o2, 0.5), k.gain(o3, 0.25));
  return k.gain(m, level);
}

export const LAYER_BUILDERS: Record<LayerId, Builder> = {
  // ---------------- 空調・機械
  hvac: (k) => {
    const low = k.gain(k.lp(k.noise('brown'), 250), 0.55);
    const air = k.gain(k.lp(k.noise('pink'), 900), 0.12);
    k.lfo(low.gain, 0.08, 0.12);
    return k.done(k.mix(low, air));
  },
  ventFan: (k) => {
    const f = k.bp(k.noise('pink'), 420, 1.2);
    const g = k.gain(f, 0.35);
    k.lfo(g.gain, 23, 0.09);
    k.lfo(f.frequency, 0.3, 40);
    return k.done(k.mix(g, k.gain(k.lp(k.noise('brown'), 180), 0.2)));
  },
  fanArray: (k) => {
    const out = k.mix();
    for (const [freq, blade] of [[350, 21.5], [520, 24.2], [700, 27.1]] as const) {
      const g = k.gain(k.bp(k.noise('pink'), freq, 1.5), 0.18);
      k.lfo(g.gain, blade, 0.05);
      g.connect(out);
    }
    k.gain(k.lp(k.noise('brown'), 150), 0.25).connect(out);
    return k.done(out);
  },
  pcFan: (k) => {
    const g = k.gain(k.bp(k.noise('pink'), 1200, 2), 0.12);
    k.lfo(g.gain, 61, 0.04);
    const whine = k.gain(k.osc('sine', 2400), 0.012);
    return k.done(k.mix(g, whine, k.gain(k.lp(k.noise('brown'), 200), 0.08)));
  },
  compressor: (k) => {
    const motor = k.gain(k.lp(k.osc('sawtooth', 55), 300), 0.14);
    const body = k.gain(k.lp(k.noise('brown'), 120), 0.3);
    const cycle = k.gain(k.mix(motor, body), 1);
    // 12〜25 秒ごとに ON/OFF
    let on = true;
    k.pulser(16, 0.5, (t) => { on = !on; cycle.gain.setTargetAtTime(on ? 1 : 0.15, t, 0.6); });
    return k.done(k.mix(cycle, k.gain(k.lp(k.noise('pink'), 500), 0.05)));
  },
  refrigerator: (k) => {
    const m = k.gain(k.lp(k.osc('sawtooth', 60), 220), 0.12);
    const hiss = k.gain(k.lp(k.noise('pink'), 600), 0.09);
    const out = k.mix(m, hiss);
    k.pulser(18, 0.6, (t) => { k.burst(out, t, { kind: 'pink', bp: 180, q: 3, dur: 0.25, gain: 0.2 }); k.burst(out, t + 0.08, { kind: 'pink', bp: 260, q: 3, dur: 0.18, gain: 0.12 }); });
    return k.done(out);
  },
  vendingMachine: (k) => {
    const m = k.gain(k.lp(k.osc('sawtooth', 59), 500), 0.08);
    const h = hum(k, 120, 0.05);
    const buzz = k.gain(k.hp(k.noise('white'), 5000), 0.012);
    const out = k.mix(m, h, buzz);
    k.pulser(30, 0.5, (t) => k.burst(out, t, { kind: 'pink', bp: 900, q: 2, dur: 0.6, gain: 0.08 }));
    return k.done(out);
  },
  dryer: (k) => {
    const rumble = k.gain(k.lp(k.noise('brown'), 150), 0.5);
    k.lfo(rumble.gain, 1.1, 0.12);
    const out = k.mix(rumble, k.gain(k.lp(k.osc('sawtooth', 48), 200), 0.1));
    k.pulser(0.92, 0.15, (t) => k.burst(out, t, { kind: 'pink', lp: 260, dur: 0.12, gain: rnd(0.08, 0.2) }));
    return k.done(out);
  },
  conveyor: (k) => {
    const roll = k.gain(k.bp(k.noise('pink'), 800, 0.8), 0.2);
    k.lfo(roll.gain, 3.2, 0.08);
    const motor = k.gain(k.lp(k.osc('sawtooth', 47), 200), 0.1);
    return k.done(k.mix(roll, motor));
  },
  cart: (k) => {
    const rumble = k.gain(k.lp(k.noise('brown'), 220), 0.15);
    k.lfo(rumble.gain, 6, 0.05);
    const out = k.mix(rumble);
    k.pulser(1.4, 0.5, (t) => {
      k.tone(out, t, { type: 'sawtooth', freq: rnd(1500, 2100), freqTo: rnd(1000, 1400), dur: 0.18, gain: 0.03, attack: 0.03 });
      k.burst(out, t + 0.05, { kind: 'pink', bp: 700, q: 2, dur: 0.1, gain: 0.08 });
    });
    return k.done(out);
  },
  machinery: (k) => {
    const base = k.gain(k.lp(k.mix(k.osc('sawtooth', 70), k.gain(k.osc('square', 140), 0.4)), 400), 0.1);
    const whineF = k.bp(k.noise('pink'), 1200, 3);
    const whine = k.gain(whineF, 0.12);
    k.lfo(base.gain, 0.5, 0.03);
    k.lfo(whineF.frequency, 0.13, 150);
    return k.done(k.mix(base, whine));
  },
  machineryLow: (k) => {
    const m = k.gain(k.lp(k.mix(k.osc('sawtooth', 40), k.osc('sine', 40)), 120), 0.16);
    const body = k.gain(k.lp(k.noise('brown'), 90), 0.4);
    k.lfo(body.gain, 0.2, 0.1);
    return k.done(k.mix(m, body));
  },
  driveHum: (k) => {
    const o = k.osc('sawtooth', 90);
    k.lfo(o.frequency, 4, 2.5);
    const m = k.gain(k.lp(o, 350), 0.1);
    return k.done(k.mix(m, k.gain(k.lp(k.noise('brown'), 150), 0.3)));
  },
  elevatorHum: (k) => {
    const m = k.gain(k.lp(k.mix(k.osc('sine', 55), k.gain(k.osc('sawtooth', 110), 0.4)), 300), 0.12);
    const out = k.mix(m, k.gain(k.lp(k.noise('brown'), 200), 0.15));
    k.pulser(3, 0.7, (t) => k.burst(out, t, { kind: 'pink', bp: 1400, q: 4, dur: 0.15, gain: 0.05 }));
    return k.done(out);
  },
  outdoorUnit: (k) => {
    const m = k.gain(k.lp(k.osc('sawtooth', 50), 250), 0.1);
    const fan = k.gain(k.bp(k.noise('pink'), 600, 1), 0.22);
    k.lfo(fan.gain, 19, 0.06);
    return k.done(k.mix(m, fan));
  },
  projector: (k) => {
    const motor = k.gain(k.bp(k.noise('pink'), 900, 1.5), 0.12);
    k.lfo(motor.gain, 24, 0.05);
    const out = k.mix(motor);
    k.pulser(1 / 24, 0, (t) => k.burst(out, t, { hp: 3000, dur: 0.006, gain: 0.05 }));
    return k.done(out);
  },
  // ---------------- 電気・ハム・低周波
  fluorescentHum: (k) => {
    const sq = k.gain(k.lp(k.osc('square', 100), 800), 0.12);
    const buzz = k.gain(k.hp(k.noise('white'), 6000), 0.02);
    k.lfo(sq.gain, 0.3, 0.02);
    return k.done(k.mix(sq, buzz));
  },
  fluorescentHumDetuned: (k) => {
    // 2 灯のハムがわずかにずれて唸る
    const a = k.gain(k.lp(k.osc('square', 100), 800), 0.08);
    const b = k.gain(k.lp(k.osc('square', 100.7), 800), 0.08);
    const c = k.gain(k.lp(k.osc('square', 120), 700), 0.03);
    const buzz = k.gain(k.hp(k.noise('white'), 6500), 0.02);
    return k.done(k.mix(a, b, c, buzz));
  },
  electricHum: (k) => k.done(hum(k, 60, 0.12)),
  subRumble: (k) => {
    const g = k.gain(k.lp(k.noise('brown'), 60, 1), 1.2);
    k.lfo(g.gain, 0.05, 0.25);
    return k.done(g);
  },
  resonanceLow: (k) => {
    const o = k.gain(k.osc('sine', 48), 0.14);
    const res = k.gain(k.bp(k.noise('pink'), 96, 20), 0.6);
    k.lfo(res.gain, 0.09, 0.2);
    return k.done(k.mix(o, res));
  },
  cableHum: (k) => {
    const h = hum(k, 50, 0.06);
    const saw = k.gain(k.lp(k.osc('sawtooth', 100), 400), 0.02);
    const out = k.mix(h, saw);
    k.pulser(0.7, 0.9, (t) => { if (Math.random() < 0.5) k.burst(out, t, { hp: 4000, dur: 0.01, gain: 0.03 }); });
    return k.done(out);
  },
  pipeKnock: (k) => {
    const hiss = k.gain(k.bp(k.noise('pink'), 1800, 1), 0.03);
    const out = k.mix(hiss);
    k.pulser(6, 0.8, (t) => {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const tt = t + i * rnd(0.15, 0.4);
        k.tone(out, tt, { type: 'triangle', freq: rnd(160, 220), freqTo: 90, dur: 0.3, gain: 0.12 });
        k.burst(out, tt, { kind: 'pink', bp: 900, q: 2, dur: 0.06, gain: 0.1 });
      }
    });
    return k.done(out);
  },
  monitorWhine: (k) => {
    const w = k.gain(k.osc('sine', 12000), 0.006);
    const h = hum(k, 60, 0.03);
    const hiss = k.gain(k.hp(k.noise('white'), 7000), 0.008);
    return k.done(k.mix(w, h, hiss));
  },
  crtWhine: (k) => {
    const w = k.gain(k.osc('sine', 15625), 0.006);
    const h = hum(k, 60, 0.04);
    return k.done(k.mix(w, h));
  },
  radioHiss: (k) => {
    const f = k.bp(k.noise('white'), 2500, 0.5);
    const g = k.gain(f, 0.08);
    k.lfo(g.gain, 0.4, 0.02);
    const out = k.mix(g);
    k.pulser(7, 0.6, (t) => k.voice(out, t, { f0: 130, dur: rnd(0.6, 1.6), gain: 0.03, hp: 500, lp: 2500 }));
    return k.done(out);
  },
  phoneLineNoise: (k) => {
    const band = k.gain(k.lp(k.hp(k.noise('pink'), 300), 3400), 0.06);
    const h = hum(k, 60, 0.02);
    const out = k.mix(band, h);
    k.pulser(1.5, 0.9, (t) => { if (Math.random() < 0.6) k.burst(out, t, { hp: 1500, lp: 3400, dur: 0.02, gain: 0.05 }); });
    return k.done(out);
  },
  // ---------------- 水・天候・屋外
  waterDrip: (k) => {
    const out = k.mix();
    k.pulser(2.2, 0.8, (t) => {
      const f = rnd(900, 2400);
      k.burst(out, t, { hp: 3000, dur: 0.012, gain: 0.12 });
      k.tone(out, t + 0.004, { freq: f, freqTo: f * 0.55, dur: 0.14, gain: 0.16, attack: 0.002 });
    });
    return k.done(out);
  },
  waterFlow: (k) => {
    const hi = k.bp(k.noise('pink'), 1200, 0.6);
    const hg = k.gain(hi, 0.22);
    const lo = k.gain(k.lp(k.noise('brown'), 400), 0.25);
    k.lfo(hi.frequency, 0.2, 250);
    k.lfo(lo.gain, 0.4, 0.06);
    return k.done(k.mix(hg, lo));
  },
  waterPressure: (k) => {
    const g = k.gain(k.lp(k.noise('brown'), 80), 0.9);
    const o = k.gain(k.osc('sawtooth', 30), 0.05);
    k.lfo(g.gain, 0.1, 0.2);
    return k.done(k.mix(g, o));
  },
  waves: (k) => {
    const f = k.lp(k.noise('pink'), 800);
    const g = k.gain(f, 0.35);
    // 8 秒周期で寄せて返す
    k.lfo(f.frequency, 0.12, 600);
    k.lfo(g.gain, 0.12, 0.2);
    const deep = k.gain(k.lp(k.noise('brown'), 200), 0.3);
    return k.done(k.mix(g, deep));
  },
  fountain: (k) => {
    const s = k.gain(k.bp(k.noise('pink'), 2500, 0.5), 0.14);
    const m = k.gain(k.bp(k.noise('pink'), 800, 0.8), 0.12);
    const out = k.mix(s, m);
    k.pulser(0.5, 0.9, (t) => k.tone(out, t, { freq: rnd(1200, 3000), freqTo: 700, dur: 0.08, gain: 0.03 }));
    return k.done(out);
  },
  rain: (k) => {
    const sheet = k.gain(k.bp(k.noise('white'), 3000, 0.3), 0.14);
    k.lfo(sheet.gain, 0.17, 0.03);
    const low = k.gain(k.lp(k.noise('brown'), 400), 0.12);
    const out = k.mix(sheet, low);
    k.pulser(0.12, 0.9, (t) => k.burst(out, t, { hp: 4000, dur: 0.008, gain: rnd(0.02, 0.08) }));
    return k.done(out);
  },
  wind: (k) => windLike(k, 200, 900, false, 0.45),
  windStrong: (k) => windLike(k, 300, 1600, true, 0.9),
  breeze: (k) => {
    const g = k.gain(k.lp(k.noise('pink'), 600), 0.12);
    k.lfo(g.gain, 0.15, 0.05);
    return k.done(g);
  },
  grassRustle: (k) => {
    const f = k.bp(k.hp(k.noise('white'), 2000), 4000, 0.8);
    const g = k.gain(f, 0.06);
    k.pulser(1.6, 0.7, (t) => g.gain.setTargetAtTime(rnd(0.02, 0.14), t, 0.5), 0);
    return k.done(g);
  },
  distantTraffic: (k) => {
    const bed = k.gain(k.lp(k.noise('brown'), 300), 0.35);
    const mid = k.bp(k.noise('pink'), 500, 0.8);
    const swell = k.gain(mid, 0.05);
    const out = k.mix(bed, swell);
    k.pulser(7, 0.6, (t) => {
      swell.gain.setTargetAtTime(rnd(0.12, 0.25), t, 0.9);
      swell.gain.setTargetAtTime(0.05, t + 1.6, 1.0);
      mid.frequency.setValueAtTime(k.f(700), t);
      mid.frequency.exponentialRampToValueAtTime(k.f(380), t + 3);
    });
    return k.done(out);
  },
  distantTrain: (k) => {
    const rumble = k.gain(k.lp(k.noise('brown'), 200), 0.12);
    const out = k.mix(rumble);
    k.pulser(25, 0.4, (t) => {
      rumble.gain.setTargetAtTime(0.5, t, 2.5);
      rumble.gain.setTargetAtTime(0.12, t + 7, 2.5);
      if (Math.random() < 0.6) k.tone(out, t + 2, { freq: 311, dur: 1.3, gain: 0.05, attack: 0.15, partials: [[1, 1], [1.19, 0.8], [2, 0.2]] });
    });
    return k.done(out);
  },
  trainApproach: (k) => {
    const rumble = k.gain(k.lp(k.noise('brown'), 250), 0.15);
    const out = k.mix(rumble);
    let clackUntil = 0;
    k.pulser(40, 0.3, (t) => {
      rumble.gain.setTargetAtTime(0.9, t, 5);
      rumble.gain.setTargetAtTime(0.15, t + 13, 3);
      clackUntil = t + 16;
      k.tone(out, t + 6, { freq: 370, dur: 1.5, gain: 0.08, attack: 0.1, partials: [[1, 1], [1.26, 0.7]] });
    });
    k.pulser(0.36, 0.05, (t) => { if (t < clackUntil) k.burst(out, t, { kind: 'pink', bp: 1500, q: 2, dur: 0.05, gain: 0.08 }); });
    return k.done(out);
  },
  distantCity: (k) => {
    const bed = k.gain(k.lp(k.noise('brown'), 400), 0.3);
    const air = k.gain(k.bp(k.noise('pink'), 800, 0.7), 0.06);
    k.lfo(air.gain, 0.07, 0.03);
    const out = k.mix(bed, air);
    k.pulser(15, 0.6, (t) => k.tone(out, t, { type: 'square', freq: rnd(380, 460), dur: rnd(0.3, 0.8), gain: 0.02, attack: 0.05 }));
    return k.done(out);
  },
  outdoorAmbience: (k) => k.done(k.mix(k.sub('breeze', 1), k.sub('birds', 0.5), k.sub('distantTraffic', 0.35))),
  iceCrack: (k) => {
    const out = k.mix();
    k.pulser(5, 0.8, (t) => {
      k.burst(out, t, { hp: 2000, dur: 0.05, gain: 0.12 });
      k.tone(out, t, { type: 'square', freq: 1400, freqTo: 300, dur: 0.12, gain: 0.05 });
      k.tone(out, t + 0.03, { freq: rnd(120, 180), freqTo: 60, dur: 1.6, gain: 0.12, attack: 0.02 });
    });
    return k.done(out);
  },
  // ---------------- 電子音・時計
  clockTick: (k) => {
    const out = k.mix();
    let tock = false;
    k.pulser(1.0, 0, (t) => {
      tock = !tock;
      k.burst(out, t, { hp: 2500, lp: 6000, dur: 0.012, gain: 0.2 });
      k.tone(out, t, { freq: tock ? 2600 : 3200, dur: 0.025, gain: 0.06 });
    });
    return k.done(out);
  },
  electronicBeep: (k) => {
    const out = k.mix();
    k.pulser(6, 0.7, (t) => {
      const n = Math.random() < 0.3 ? 2 : 1;
      for (let i = 0; i < n; i++) k.tone(out, t + i * 0.15, { type: 'square', freq: pick([1000, 1250, 1500]), dur: 0.08, gain: 0.05, attack: 0.002 });
    });
    return k.done(out);
  },
  displayBeep: (k) => {
    const out = k.mix();
    k.pulser(3, 0.6, (t) => {
      k.tone(out, t, { freq: 2100, dur: 0.05, gain: 0.04, attack: 0.002 });
      if (Math.random() < 0.3) k.burst(out, t + 0.3, { kind: 'pink', bp: 1200, q: 4, dur: 0.02, gain: 0.05 });
    });
    return k.done(out);
  },
  numberCall: (k) => {
    const out = k.mix();
    k.pulser(14, 0.4, (t) => {
      k.tone(out, t, { freq: 880, dur: 0.5, gain: 0.08, partials: [[1, 1], [2, 0.3]] });
      k.tone(out, t + 0.45, { freq: 1108, dur: 0.7, gain: 0.08, partials: [[1, 1], [2, 0.3]] });
      k.voice(out, t + 1.3, { f0: 140, dur: rnd(1.2, 2.0), gain: 0.05, syllable: 0.18, hp: 400, lp: 2800 });
    });
    return k.done(out);
  },
  delayEcho: (k) => {
    const d = k.track(k.ctx.createDelay(1));
    d.delayTime.value = 0.32;
    const fb = k.gain(d, 0.5);
    fb.connect(d);
    const dry = k.mix();
    dry.connect(d);
    const out = k.mix(dry, k.gain(d, 0.7));
    k.pulser(8, 0.6, (t) => k.burst(dry, t, { kind: 'pink', bp: 1500, q: 2, dur: 0.05, gain: 0.15 }));
    return k.done(out);
  },
  retroSfx: (k) => {
    const out = k.mix();
    k.pulser(9, 0.6, (t) => {
      const base = pick([440, 523, 660]);
      const n = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) k.tone(out, t + i * 0.07, { type: 'square', freq: base * Math.pow(2, i * 4 / 12), dur: 0.07, gain: 0.03, attack: 0.002 });
    });
    return k.done(out);
  },
  phoneRing: (k) => {
    // 400 Hz を 16 Hz で振幅変調。1 s 鳴動 / 2 s 休止（日本の呼出音）
    const o = k.osc('sine', 400);
    const am = k.gain(o, 0.5);
    k.lfo(am.gain, 16, 0.5);
    const gate = k.gain(am, 0);
    k.pulser(3, 0, (t) => {
      gate.gain.setTargetAtTime(0.25, t, 0.01);
      gate.gain.setTargetAtTime(0, t + 1, 0.02);
    }, 0);
    return k.done(gate);
  },
  // ---------------- 楽音・声・生物
  chime: (k) => {
    const out = k.mix();
    k.pulser(25, 0.3, (t) => {
      const seq = pick([[659, 523, 587, 392], [392, 587, 659, 523], [523, 659, 587, 392]]);
      seq.forEach((f, i) => k.tone(out, t + i * 0.55, { freq: f, dur: 2.2, gain: 0.07, attack: 0.01, partials: [[1, 1], [2.76, 0.25], [5.4, 0.08]] }));
    });
    return k.done(out);
  },
  muzak: (k) => {
    // 4 和音パッド（各声部 2 本デチューン）を lowpass 800 Hz で流す「聞き取れないムード音楽」
    const chords = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 415.3], [174.6, 220, 261.6, 349.2], [196, 246.9, 293.7, 392]];
    const oscs: OscillatorNode[] = [];
    const sum = k.mix();
    for (let v = 0; v < 4; v++) {
      for (const det of [-6, 6]) {
        const o = k.osc('triangle', chords[0][v], det);
        oscs.push(o);
        k.gain(o, 0.05).connect(sum);
      }
    }
    const f = k.lp(sum, 800, 0.5);
    const g = k.gain(f, 0.6);
    k.lfo(g.gain, 0.11, 0.12);
    let ci = 0;
    k.pulser(6, 0.15, (t) => {
      ci = (ci + 1) % chords.length;
      oscs.forEach((o, i) => o.frequency.setTargetAtTime(k.f(chords[ci][i >> 1]), t, 0.25));
    });
    return k.done(g);
  },
  piano: (k) => {
    const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
    const f = k.lp(k.mix(), 1500);
    const out = k.gain(f, 1);
    const src = f;
    k.pulser(4, 0.6, (t) => {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) k.tone(src, t + i * rnd(0.25, 0.6), { freq: pick(scale), dur: 1.6, gain: 0.08, attack: 0.004, partials: [[1, 1], [2, 0.4], [3, 0.15], [4, 0.05]] });
    });
    return k.done(out);
  },
  paAnnounce: (k) => {
    const out = k.mix();
    k.pulser(22, 0.4, (t) => {
      k.tone(out, t, { freq: 784, dur: 0.6, gain: 0.05, partials: [[1, 1], [2, 0.2]] });
      k.tone(out, t + 0.5, { freq: 1046, dur: 0.8, gain: 0.05, partials: [[1, 1], [2, 0.2]] });
      const end = k.voice(out, t + 1.5, { f0: rnd(110, 170), dur: rnd(2, 3.5), gain: 0.06, syllable: 0.17, drift: 2.5, hp: 300, lp: 3000 });
      if (Math.random() < 0.5) k.voice(out, end + 0.4, { f0: rnd(110, 170), dur: rnd(1, 2), gain: 0.05, syllable: 0.17, drift: 2.5, hp: 300, lp: 3000 });
    });
    return k.done(out);
  },
  crowdMurmur: (k) => {
    const bed = k.gain(k.bp(k.noise('pink'), 800, 0.6), 0.06);
    const out = k.mix(bed);
    k.pulser(0.9, 0.8, (t) => k.voice(out, t, { f0: rnd(95, 220), dur: rnd(0.4, 1.4), gain: 0.02, syllable: 0.14, drift: 2, lp: 2000 }));
    return k.done(out);
  },
  laughter: (k) => {
    const out = k.mix();
    k.pulser(18, 0.5, (t) => {
      const f0 = rnd(180, 320);
      const end = giggle(k, out, t, f0, 4 + Math.floor(Math.random() * 4), 0.05);
      if (Math.random() < 0.4) giggle(k, out, end + 0.3, f0 * 1.15, 3, 0.04);
    });
    return k.done(out);
  },
  children: (k) => {
    const out = k.mix();
    k.pulser(14, 0.5, (t) => {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) k.voice(out, t + i * rnd(0.3, 0.8), { f0: rnd(300, 450), dur: rnd(0.25, 0.7), gain: 0.04, syllable: 0.2, drift: 4, f1: [600, 1000], f2: [1800, 2800], lp: 3500 });
      // ブランコの軋み
      if (Math.random() < 0.5) k.tone(out, t + 0.5, { type: 'sawtooth', freq: 900, freqTo: 1300, dur: 0.6, gain: 0.012, attack: 0.2 });
    });
    return k.done(out);
  },
  dogBark: (k) => {
    const out = k.mix();
    k.pulser(12, 0.7, (t) => {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const tt = t + i * rnd(0.3, 0.45);
        k.voice(out, tt, { f0: rnd(150, 220), dur: 0.16, gain: 0.08, syllable: 0.16, drift: 0.5, f1: [500, 700], f2: [1100, 1400], lp: 2500 });
      }
    });
    return k.done(out);
  },
  birds: (k) => {
    const out = k.mix();
    k.pulser(3.5, 0.7, (t) => {
      const n = 2 + Math.floor(Math.random() * 3);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = rnd(2400, 3800);
        k.tone(out, tt, { freq: f, freqTo: f * rnd(1.15, 1.5), dur: 0.09, gain: 0.04, attack: 0.01 });
        tt += rnd(0.1, 0.22);
      }
    });
    return k.done(out);
  },
  insects: (k) => {
    const a = k.gain(k.bp(k.noise('white'), 4500, 10), 0.08);
    k.lfo(a.gain, 40, 0.08, 'square');
    const b = k.gain(k.bp(k.noise('white'), 6200, 12), 0.05);
    k.lfo(b.gain, 5.5, 0.05);
    const out = k.mix(a, b);
    k.pulser(3, 0.6, (t) => a.gain.setTargetAtTime(rnd(0.03, 0.1), t, 0.8), 0);
    return k.done(out);
  },
  // ---------------- 物音
  footstepsEcho: (k) => {
    const out = k.mix();
    k.pulser(9, 0.5, (t) => {
      const n = 6 + Math.floor(Math.random() * 5);
      const step = rnd(0.5, 0.62);
      for (let i = 0; i < n; i++) k.burst(out, t + i * step, { kind: 'pink', bp: 400, q: 1.5, dur: 0.08, gain: 0.12 * rnd(0.7, 1) });
    });
    return k.done(out);
  },
  wetFootsteps: (k) => {
    const out = k.mix();
    k.pulser(10, 0.5, (t) => {
      const n = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const tt = t + i * 0.58;
        k.burst(out, tt, { kind: 'pink', bp: 400, q: 1.5, dur: 0.07, gain: 0.08 });
        k.burst(out, tt + 0.01, { lp: 4000, sweepTo: 800, dur: 0.15, gain: 0.07 });
      }
    });
    return k.done(out);
  },
  metalClank: (k) => {
    const out = k.mix();
    k.pulser(11, 0.8, (t) => {
      k.burst(out, t, { kind: 'pink', bp: 1830, q: 30, dur: 0.6, gain: 0.3 });
      k.tone(out, t, { freq: 1830, dur: 0.8, gain: 0.06, partials: [[1, 1], [1.5, 0.5], [2.3, 0.3]] });
      k.burst(out, t, { kind: 'brown', lp: 300, dur: 0.1, gain: 0.25 });
    });
    return k.done(out);
  },
  dishes: (k) => {
    const out = k.mix();
    k.pulser(5, 0.7, (t) => {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const tt = t + i * rnd(0.08, 0.3);
        k.tone(out, tt, { freq: pick([2700, 3200, 4100, 3600]), dur: 0.14, gain: 0.05, partials: [[1, 1], [2.4, 0.3]] });
        k.burst(out, tt, { hp: 3000, dur: 0.01, gain: 0.08 });
      }
    });
    return k.done(out);
  },
  coffeeMachine: (k) => {
    const pump = k.gain(k.lp(k.osc('sawtooth', 52), 250), 0.03);
    const out = k.mix(pump);
    k.pulser(20, 0.4, (t) => {
      k.burst(out, t, { kind: 'pink', bp: 900, q: 1, dur: 2.5, gain: 0.12, attack: 0.2 });
      k.burst(out, t + 3, { hp: 3000, dur: 1.8, gain: 0.06, attack: 0.3 });
    });
    return k.done(out);
  },
  pageTurn: (k) => {
    const out = k.mix();
    k.pulser(12, 0.5, (t) => {
      k.burst(out, t, { hp: 1500, lp: 6000, dur: 0.18, gain: 0.08, attack: 0.05 });
      k.burst(out, t + 0.16, { hp: 2000, lp: 7000, dur: 0.14, gain: 0.06, attack: 0.02 });
    });
    return k.done(out);
  },
  paperRustle: (k) => {
    const out = k.mix();
    k.pulser(4, 0.7, (t) => {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) k.burst(out, t + i * 0.12, { hp: 2500, dur: rnd(0.08, 0.3), gain: 0.05, attack: 0.03 });
    });
    return k.done(out);
  },
  knock: (k) => {
    const out = k.mix();
    k.pulser(15, 0.5, (t) => {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const tt = t + i * 0.3;
        k.burst(out, tt, { kind: 'brown', lp: 300, dur: 0.08, gain: 0.3 });
        k.tone(out, tt, { freq: 120, freqTo: 80, dur: 0.08, gain: 0.1 });
      }
    });
    return k.done(out);
  },
  doorCreak: (k) => {
    const out = k.mix();
    k.pulser(12, 0.6, (t) => {
      const g = k.ctx.createGain();
      g.gain.value = 1;
      g.connect(out);
      const lfo = k.ctx.createOscillator();
      lfo.frequency.value = 11;
      const lg = k.ctx.createGain();
      lg.gain.value = 0.5;
      lfo.connect(lg).connect(g.gain);
      lfo.start(t);
      lfo.stop(t + 1.4);
      lfo.onended = () => { lfo.disconnect(); lg.disconnect(); g.disconnect(); };
      k.tone(g, t, { type: 'sawtooth', freq: 400, freqTo: 650, dur: 1.2, gain: 0.02, attack: 0.3 });
    });
    return k.done(out);
  },
  wallScrape: (k) => {
    const out = k.mix();
    k.pulser(7, 0.6, (t) => k.burst(out, t, { kind: 'pink', bp: 1200, q: 3, sweepTo: 700, dur: 1.5, gain: 0.08, attack: 0.4 }));
    return k.done(out);
  },
  shutter: (k) => {
    const out = k.mix();
    k.pulser(20, 0.5, (t) => {
      const g = k.ctx.createGain();
      g.gain.value = 1;
      g.connect(out);
      const lfo = k.ctx.createOscillator();
      lfo.frequency.value = 14;
      const lg = k.ctx.createGain();
      lg.gain.value = 0.6;
      lfo.connect(lg).connect(g.gain);
      lfo.start(t);
      lfo.stop(t + 2);
      lfo.onended = () => { lfo.disconnect(); lg.disconnect(); g.disconnect(); };
      k.burst(g, t, { kind: 'pink', bp: 700, q: 1.5, dur: 1.8, gain: 0.12, attack: 0.1 });
      k.burst(out, t + 1.8, { kind: 'pink', bp: 1500, q: 8, dur: 0.4, gain: 0.15 });
    });
    return k.done(out);
  },
  cameraShutter: (k) => {
    const out = k.mix();
    k.pulser(6, 0.6, (t) => {
      k.burst(out, t, { hp: 2000, dur: 0.01, gain: 0.12 });
      k.burst(out, t + 0.06, { hp: 1500, dur: 0.012, gain: 0.1 });
      k.burst(out, t + 0.08, { kind: 'pink', bp: 2500, q: 2, dur: 0.1, gain: 0.03 });
    });
    return k.done(out);
  },
  reverbTail: (k) => {
    const g = k.gain(k.lp(k.noise('pink'), 1500), 0.08);
    k.lfo(g.gain, 0.06, 0.03);
    return k.done(g);
  },
};

// 全 LAYER_IDS に builder があることを実行時にも確認（型では Record で保証）
for (const id of LAYER_IDS) if (!LAYER_BUILDERS[id]) throw new Error(`layer builder missing: ${id}`);

// ---------------------------------------------------------------- Layer（バスへ接続された 1 本の環境音）
export interface LayerDest {
  /** ドライ出力先（ambient バス） */
  dry: AudioNode;
  /** リバーブ send 先 */
  reverb: AudioNode;
}

export interface LayerOptions {
  /** 位置（世界座標）。指定すると PannerNode で定位する */
  pos?: [number, number, number];
  /** 追加のローパス（扉越しの漏れ音など） */
  lowpassHz?: number;
}

export class Layer {
  readonly id: LayerId;
  readonly spec: LayerSpec;
  /** レイヤー音量（spec.gain 相当。setGain で変更） */
  readonly gain: GainNode;
  private readonly ctx: BaseAudioContext;
  private readonly graph: LayerGraph;
  private readonly fader: GainNode;
  private readonly send: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly panner: PannerNode | null = null;
  private readonly stereo: StereoPannerNode | null = null;
  private phantomNext = 0;
  private stopped = false;
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: BaseAudioContext, sh: SharedSources, spec: LayerSpec, dest: LayerDest, opts: LayerOptions = {}) {
    this.ctx = ctx;
    this.id = spec.id;
    this.spec = spec;
    const kit = new Kit(ctx, sh, spec.pitchOct ?? 0);
    this.graph = LAYER_BUILDERS[spec.id](kit);
    let node: AudioNode = this.graph.out;
    const lpHz = Math.min(spec.lowpassHz ?? Infinity, opts.lowpassHz ?? Infinity);
    if (Number.isFinite(lpHz)) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lpHz;
      node.connect(f);
      node = f;
      this.nodes.push(f);
    }
    this.gain = ctx.createGain();
    this.gain.gain.value = spec.gain;
    node.connect(this.gain);
    this.fader = ctx.createGain();
    this.fader.gain.value = 0;
    this.gain.connect(this.fader);
    let tail: AudioNode = this.fader;
    if (opts.pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 2;
      p.maxDistance = 40;
      p.rolloffFactor = 1;
      setPannerPos(p, opts.pos, ctx.currentTime);
      tail.connect(p);
      tail = p;
      this.panner = p;
      this.nodes.push(p);
    } else if (spec.phantom) {
      const s = ctx.createStereoPanner();
      tail.connect(s);
      tail = s;
      this.stereo = s;
      this.nodes.push(s);
    }
    tail.connect(dest.dry);
    this.send = ctx.createGain();
    this.send.gain.value = spec.reverbSend ?? DEFAULT_SEND[spec.id] ?? 0.2;
    tail.connect(this.send).connect(dest.reverb);
    this.nodes.push(this.gain, this.fader, this.send);
    if (spec.phantom) this.phantomNext = ctx.currentTime + Math.random() * spec.phantom.meanIntervalSec;
  }

  start(fadeSec = 0): void {
    if (this.stopped) return;
    if (this.spec.phantom) return; // 幻聴は update が開閉する
    const t = this.ctx.currentTime;
    this.fader.gain.cancelScheduledValues(t);
    this.fader.gain.setValueAtTime(this.fader.gain.value, t);
    this.fader.gain.linearRampToValueAtTime(1, t + Math.max(0.01, fadeSec));
  }

  /** フェードアウトして破棄する */
  stop(fadeSec = 1.2): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.fader.gain.cancelScheduledValues(t);
    this.fader.gain.setValueAtTime(this.fader.gain.value, t);
    this.fader.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fadeSec));
    this.disposeTimer = setTimeout(() => this.dispose(), fadeSec * 1000 + 80);
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  setGain(v: number, fadeSec = 0.3): void {
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(v, t + Math.max(0.01, fadeSec));
  }

  setPosition(pos: [number, number, number]): void {
    if (this.panner) setPannerPos(this.panner, pos, this.ctx.currentTime);
  }

  update(now: number): void {
    if (this.stopped) return;
    this.graph.update?.(now);
    const ph = this.spec.phantom;
    if (ph && now >= this.phantomNext) {
      this.phantomNext = now + ph.meanIntervalSec * (0.5 + Math.random());
      if (Math.random() < ph.probability) {
        if (this.stereo) this.stereo.pan.setValueAtTime(Math.random() * 1.6 - 0.8, now);
        const g = this.fader.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(0, now);
        g.linearRampToValueAtTime(1, now + 0.4);
        g.setValueAtTime(1, now + 2.4);
        g.linearRampToValueAtTime(0, now + 3.0);
      }
    }
  }

  dispose(): void {
    if (this.disposeTimer) clearTimeout(this.disposeTimer);
    this.disposeTimer = null;
    this.stopped = true;
    this.graph.dispose();
    for (const n of this.nodes) n.disconnect();
  }
}

/** PannerNode の位置を設定（AudioParam が無い旧 Safari は setPosition） */
export function setPannerPos(p: PannerNode, pos: [number, number, number], t: number): void {
  if (p.positionX) {
    p.positionX.setValueAtTime(pos[0], t);
    p.positionY.setValueAtTime(pos[1], t);
    p.positionZ.setValueAtTime(pos[2], t);
  } else {
    (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(pos[0], pos[1], pos[2]);
  }
}
