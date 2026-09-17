/**
 * 効果音（一発音）の手続き合成。足音（床材別）、着地、扉、エレベーター、UI、AudioEvent 用の名前付き音。
 * すべて Synth.ts の tone / burst / voice を組み合わせる。位置付きなら PannerNode（equalpower）で定位。
 */
import type { MatId } from '../generators/layout';
import { burst, tone, voice, setPannerPos, type LayerDest, type SharedSources } from './Synth';

export type FloorKind = 'carpet' | 'lino' | 'tile' | 'concrete' | 'wood' | 'water' | 'wet';
export type MoveRank = 'walk' | 'dash';
export type DoorSfxKind = 'open' | 'close' | 'locked' | 'knock';
export type DoorMat = 'wood' | 'metal' | 'glass';
export type ElevatorSfxKind = 'bell' | 'move';
export type UiSfxKind = 'click' | 'confirm' | 'cancel' | 'error' | 'open' | 'close';

/** AudioEvent などが名前で呼ぶ一発音 */
export const SFX_KINDS = ['phoneRing', 'children', 'pageTurn', 'beep', 'knock', 'chime', 'clank', 'drip', 'laugh', 'thud', 'shutter'] as const;
export type SfxKind = (typeof SFX_KINDS)[number];
const SFX_SET: ReadonlySet<string> = new Set(SFX_KINDS);
export function isSfxKind(s: string): s is SfxKind {
  return SFX_SET.has(s);
}

/** palette.floor → 足音の床種。wet は Wetness Modifier 等で上書き */
export function floorKindOf(mat: MatId | string, wet = false): FloorKind {
  if (wet) return 'wet';
  switch (mat) {
    case 'floorCarpetRed':
    case 'floorCarpetGrey':
    case 'carpetPattern':
    case 'upholstery':
      return 'carpet';
    case 'floorLino':
    case 'rubber':
      return 'lino';
    case 'floorTile':
    case 'marbleFloor':
    case 'marbleWhite':
    case 'glass':
      return 'tile';
    case 'floorWood':
    case 'woodPanel':
    case 'bookshelfWood':
      return 'wood';
    case 'water':
      return 'water';
    default:
      return 'concrete';
  }
}

/** palette.door → 扉音の材質 */
export function doorMatOf(mat: MatId | string): DoorMat {
  if (mat === 'doorMetal' || mat === 'metal' || mat === 'shelfMetal') return 'metal';
  if (mat === 'glass' || mat === 'carGlass') return 'glass';
  return 'wood';
}

export interface SfxContext {
  ctx: BaseAudioContext;
  sh: SharedSources;
  dest: LayerDest;
  /** 再生開始時の通知（ボイス数の計上用） */
  onVoice?: (durationSec: number) => void;
}

export interface ShotOpts {
  pos?: [number, number, number];
  gain?: number;
  /** リバーブ send（0〜1） */
  send?: number;
  /** ステレオ定位（-1〜1。pos が無いとき） */
  pan?: number;
  /** ピッチ倍率 */
  pitch?: number;
}

/** 一発音の出力チェーン（gain → panner/stereo → dry + send）。dur 秒後に自動で切断 */
function chain(sc: SfxContext, o: ShotOpts, send: number, dur: number): GainNode {
  const { ctx } = sc;
  const g = ctx.createGain();
  g.gain.value = o.gain ?? 1;
  let tail: AudioNode = g;
  const nodes: AudioNode[] = [g];
  if (o.pos) {
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 2;
    p.maxDistance = 40;
    setPannerPos(p, o.pos, ctx.currentTime);
    tail.connect(p);
    tail = p;
    nodes.push(p);
  } else if (o.pan !== undefined && ctx.createStereoPanner) {
    const s = ctx.createStereoPanner();
    s.pan.value = Math.max(-1, Math.min(1, o.pan));
    tail.connect(s);
    tail = s;
    nodes.push(s);
  }
  tail.connect(sc.dest.dry);
  const sg = ctx.createGain();
  sg.gain.value = o.send ?? send;
  tail.connect(sg).connect(sc.dest.reverb);
  nodes.push(sg);
  setTimeout(() => { for (const n of nodes) n.disconnect(); }, (dur + 0.3) * 1000);
  sc.onVoice?.(dur);
  return g;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

// ---------------------------------------------------------------- 足音 / 着地
/** 床材ごとの足音。rank で音量・長さ、crouching で音量 -8 dB、wet で水しぶきを混ぜる。持続秒を返す */
export function playFootstep(sc: SfxContext, floor: FloorKind, rank: MoveRank, crouching: boolean, wet: boolean, o: ShotOpts = {}): number {
  const { ctx, sh } = sc;
  const t = ctx.currentTime;
  const pitch = (o.pitch ?? 1) * rnd(0.94, 1.06);
  const vel = rank === 'dash' ? 1 : 0.7;
  const level = (crouching ? 0.4 : 1) * vel;
  const kind: FloorKind = wet && (floor === 'lino' || floor === 'tile' || floor === 'concrete') ? 'wet' : floor;
  const sends: Record<FloorKind, number> = { carpet: 0.15, lino: 0.5, tile: 0.8, concrete: 0.7, wood: 0.4, water: 0.6, wet: 0.6 };
  let dur = 0.12;
  const g = chain(sc, { ...o, gain: (o.gain ?? 1) * level }, sends[kind], 0.5);
  switch (kind) {
    case 'carpet':
      burst(ctx, sh, g, t, { kind: 'pink', bp: 500 * pitch, q: 0.8, dur: 0.06, gain: 0.25, attack: 0.008 });
      burst(ctx, sh, g, t + 0.01, { kind: 'brown', lp: 250 * pitch, dur: 0.07, gain: 0.3 });
      dur = 0.08;
      break;
    case 'lino':
      burst(ctx, sh, g, t, { hp: 2000 * pitch, dur: 0.02, gain: 0.35 });
      tone(ctx, g, t, { freq: 500 * pitch, freqTo: 300 * pitch, dur: 0.06, gain: 0.12 });
      dur = 0.08;
      break;
    case 'tile':
      burst(ctx, sh, g, t, { hp: 2500 * pitch, dur: 0.025, gain: 0.4 });
      tone(ctx, g, t, { freq: 1800 * pitch, freqTo: 900 * pitch, dur: 0.09, gain: 0.08 });
      burst(ctx, sh, g, t + 0.005, { kind: 'pink', bp: 1200 * pitch, q: 2, dur: 0.1, gain: 0.15 });
      dur = 0.12;
      break;
    case 'concrete':
      burst(ctx, sh, g, t, { kind: 'pink', bp: 400 * pitch, q: 1, dur: 0.08, gain: 0.35, attack: 0.004 });
      burst(ctx, sh, g, t + 0.01, { hp: 1500, lp: 5000, dur: 0.04, gain: 0.12 }); // 砂利
      dur = 0.1;
      break;
    case 'wood':
      tone(ctx, g, t, { freq: 160 * pitch, freqTo: 90 * pitch, dur: 0.1, gain: 0.25, type: 'triangle' });
      burst(ctx, sh, g, t, { kind: 'brown', lp: 200 * pitch, dur: 0.09, gain: 0.3 });
      if (Math.random() < 0.1) tone(ctx, g, t + 0.05, { freq: 700 * pitch, freqTo: 900 * pitch, dur: 0.25, gain: 0.03, type: 'sawtooth', attack: 0.05 }); // 軋み
      dur = 0.12;
      break;
    case 'water':
      burst(ctx, sh, g, t, { lp: 4000, sweepTo: 800, dur: 0.15, gain: 0.35, attack: 0.01 });
      tone(ctx, g, t + 0.06, { freq: rnd(900, 1600), freqTo: 500, dur: 0.1, gain: 0.05 });
      dur = 0.2;
      break;
    case 'wet':
      burst(ctx, sh, g, t, { hp: 2000 * pitch, dur: 0.02, gain: 0.25 });
      burst(ctx, sh, g, t + 0.005, { lp: 4000, sweepTo: 800, dur: 0.12, gain: 0.18, attack: 0.01 });
      dur = 0.15;
      break;
  }
  return dur;
}

/** 着地。speed = 着地時の |vel.y|（m/s）。4 m/s 程度が通常のジャンプ、Hole 落下は 10 以上 */
export function playLand(sc: SfxContext, speed: number, floor: FloorKind, o: ShotOpts = {}): number {
  const { ctx, sh } = sc;
  const t = ctx.currentTime;
  const k = Math.min(1, Math.max(0, (speed - 1.5) / 9));
  if (k <= 0) return 0;
  const g = chain(sc, { ...o, gain: (o.gain ?? 1) * (0.4 + 0.8 * k) }, floor === 'carpet' ? 0.2 : 0.6, 0.6);
  burst(ctx, sh, g, t, { kind: 'brown', lp: 220, dur: 0.12 + 0.15 * k, gain: 0.6, attack: 0.004 });
  const lp = floor === 'carpet' ? 300 : floor === 'tile' || floor === 'lino' ? 3000 : 1200;
  burst(ctx, sh, g, t, { kind: 'pink', lp, dur: 0.08 + 0.08 * k, gain: 0.35 });
  if (floor === 'water' || floor === 'wet') burst(ctx, sh, g, t + 0.02, { lp: 4000, sweepTo: 700, dur: 0.3, gain: 0.4, attack: 0.02 });
  if (k > 0.5) tone(ctx, g, t, { freq: 60, freqTo: 35, dur: 0.3, gain: 0.3 * k });
  return 0.4;
}

// ---------------------------------------------------------------- 扉 / エレベーター
function metalRing(sc: SfxContext, g: AudioNode, t: number, gain: number): void {
  burst(sc.ctx, sc.sh, g, t, { kind: 'pink', bp: 1800, q: 25, dur: 0.5, gain });
}

export function playDoor(sc: SfxContext, kind: DoorSfxKind, mat: DoorMat = 'wood', o: ShotOpts = {}): number {
  const { ctx, sh } = sc;
  const t = ctx.currentTime;
  const g = chain(sc, o, 0.6, 1.2);
  const body = mat === 'metal' ? 220 : mat === 'glass' ? 900 : 150;
  switch (kind) {
    case 'open':
      // ラッチ + 蝶番の掃引ノイズ
      burst(ctx, sh, g, t, { hp: 2500, dur: 0.02, gain: 0.3 });
      tone(ctx, g, t + 0.005, { freq: body * 2, freqTo: body, dur: 0.08, gain: 0.12, type: 'triangle' });
      burst(ctx, sh, g, t + 0.08, { kind: 'pink', bp: mat === 'metal' ? 1400 : 700, q: 2, sweepTo: mat === 'metal' ? 900 : 450, dur: 0.4, gain: 0.08, attack: 0.1 });
      if (mat === 'metal') metalRing(sc, g, t, 0.06);
      return 0.5;
    case 'close':
      burst(ctx, sh, g, t, { kind: 'brown', lp: body * 2, dur: 0.12, gain: 0.5, attack: 0.002 });
      tone(ctx, g, t, { freq: body, freqTo: body * 0.6, dur: 0.12, gain: 0.2 });
      burst(ctx, sh, g, t + 0.06, { hp: 2000, dur: 0.03, gain: 0.35 }); // ラッチ
      if (mat === 'metal') metalRing(sc, g, t, 0.15);
      if (mat === 'glass') tone(ctx, g, t, { freq: 2400, dur: 0.15, gain: 0.05 });
      return 0.4;
    case 'locked':
      // ガタつき 2 連クリック
      burst(ctx, sh, g, t, { hp: 1500, lp: 5000, dur: 0.03, gain: 0.3 });
      tone(ctx, g, t, { freq: body * 1.5, dur: 0.05, gain: 0.08, type: 'triangle' });
      burst(ctx, sh, g, t + 0.13, { hp: 1500, lp: 5000, dur: 0.03, gain: 0.25 });
      if (mat === 'metal') metalRing(sc, g, t + 0.13, 0.05);
      return 0.25;
    case 'knock': {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        burst(ctx, sh, g, t + i * 0.28, { kind: 'brown', lp: 350, dur: 0.08, gain: 0.5 });
        tone(ctx, g, t + i * 0.28, { freq: 130, freqTo: 85, dur: 0.08, gain: 0.15 });
      }
      return n * 0.28;
    }
  }
}

export function playElevator(sc: SfxContext, kind: ElevatorSfxKind, o: ShotOpts = {}): number {
  const { ctx, sh } = sc;
  const t = ctx.currentTime;
  if (kind === 'bell') {
    const g = chain(sc, o, 0.5, 1.6);
    tone(ctx, g, t, { freq: 1046, dur: 1.2, gain: 0.12, partials: [[1, 1], [2.4, 0.3], [3.1, 0.1]] });
    tone(ctx, g, t + 0.35, { freq: 784, dur: 1.4, gain: 0.12, partials: [[1, 1], [2.4, 0.3], [3.1, 0.1]] });
    return 1.8;
  }
  // 扉のゴロゴロ + モーター低音（遷移 430 ms に合わせて 0.8 s）
  const g = chain(sc, o, 0.4, 1.0);
  burst(ctx, sh, g, t, { kind: 'pink', bp: 350, q: 1.5, dur: 0.6, gain: 0.25, attack: 0.05 });
  tone(ctx, g, t, { freq: 55, dur: 0.8, gain: 0.25, type: 'sawtooth', attack: 0.1 });
  burst(ctx, sh, g, t + 0.55, { kind: 'brown', lp: 300, dur: 0.1, gain: 0.3 });
  return 0.8;
}

// ---------------------------------------------------------------- UI
export function playUi(sc: SfxContext, kind: UiSfxKind, o: ShotOpts = {}): number {
  const { ctx } = sc;
  const t = ctx.currentTime;
  const g = chain(sc, { ...o, gain: (o.gain ?? 1) * 0.5 }, 0, 0.4);
  switch (kind) {
    case 'click':
      tone(ctx, g, t, { freq: 1800, dur: 0.03, gain: 0.15, attack: 0.001 });
      return 0.03;
    case 'confirm':
      tone(ctx, g, t, { freq: 880, dur: 0.08, gain: 0.12 });
      tone(ctx, g, t + 0.07, { freq: 1320, dur: 0.12, gain: 0.12 });
      return 0.2;
    case 'cancel':
      tone(ctx, g, t, { freq: 660, dur: 0.08, gain: 0.12 });
      tone(ctx, g, t + 0.07, { freq: 440, dur: 0.12, gain: 0.12 });
      return 0.2;
    case 'error':
      tone(ctx, g, t, { freq: 220, dur: 0.15, gain: 0.15, type: 'square' });
      return 0.15;
    case 'open':
      tone(ctx, g, t, { freq: 600, freqTo: 1200, dur: 0.12, gain: 0.1, type: 'triangle' });
      return 0.12;
    case 'close':
      tone(ctx, g, t, { freq: 1200, freqTo: 600, dur: 0.12, gain: 0.1, type: 'triangle' });
      return 0.12;
  }
}

// ---------------------------------------------------------------- 名前付き一発音（AudioEvent oneShot / play(kind)）
export function playNamed(sc: SfxContext, kind: SfxKind, o: ShotOpts = {}): number {
  const { ctx, sh } = sc;
  const t = ctx.currentTime;
  switch (kind) {
    case 'phoneRing': {
      // 1 s 鳴動（400 Hz × 16 Hz AM）
      const g = chain(sc, o, 0.4, 1.2);
      const osc = ctx.createOscillator();
      osc.frequency.value = 400;
      const am = ctx.createGain();
      am.gain.value = 0.12;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 16;
      const lg = ctx.createGain();
      lg.gain.value = 0.12;
      lfo.connect(lg).connect(am.gain);
      osc.connect(am).connect(g);
      osc.start(t); lfo.start(t);
      osc.stop(t + 1); lfo.stop(t + 1);
      osc.onended = () => { osc.disconnect(); am.disconnect(); lfo.disconnect(); lg.disconnect(); };
      return 1;
    }
    case 'children': {
      const g = chain(sc, o, 0.6, 2.5);
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) voice(ctx, g, t + i * rnd(0.3, 0.8), { f0: rnd(300, 450), dur: rnd(0.25, 0.7), gain: 0.06, syllable: 0.2, drift: 4, f1: [600, 1000], f2: [1800, 2800], lp: 3500 });
      return 2.2;
    }
    case 'laugh': {
      const g = chain(sc, o, 0.6, 2);
      const f0 = rnd(180, 320);
      let tt = t;
      for (let i = 0; i < 5; i++) {
        const len = rnd(0.09, 0.16);
        voice(ctx, g, tt, { f0: f0 * Math.pow(2, -i * 0.03), dur: len, gain: 0.07, syllable: len, drift: 1, f1: [500, 900], f2: [1400, 2200], lp: 3200 });
        tt += len + rnd(0.02, 0.06);
      }
      return tt - t;
    }
    case 'pageTurn': {
      const g = chain(sc, o, 0.3, 0.6);
      burst(ctx, sh, g, t, { hp: 1500, lp: 6000, dur: 0.18, gain: 0.12, attack: 0.05 });
      burst(ctx, sh, g, t + 0.16, { hp: 2000, lp: 7000, dur: 0.14, gain: 0.09, attack: 0.02 });
      return 0.35;
    }
    case 'beep': {
      const g = chain(sc, o, 0.2, 0.3);
      tone(ctx, g, t, { freq: 1250, dur: 0.08, gain: 0.08, type: 'square', attack: 0.002 });
      return 0.1;
    }
    case 'knock':
      return playDoor(sc, 'knock', 'wood', o);
    case 'chime': {
      const g = chain(sc, o, 0.6, 3);
      [659, 523, 587, 392].forEach((f, i) => tone(ctx, g, t + i * 0.55, { freq: f, dur: 2.2, gain: 0.08, partials: [[1, 1], [2.76, 0.25], [5.4, 0.08]] }));
      return 3.8;
    }
    case 'clank': {
      const g = chain(sc, o, 0.6, 1);
      burst(ctx, sh, g, t, { kind: 'pink', bp: 1830, q: 30, dur: 0.6, gain: 0.35 });
      burst(ctx, sh, g, t, { kind: 'brown', lp: 300, dur: 0.1, gain: 0.3 });
      return 0.7;
    }
    case 'drip': {
      const g = chain(sc, o, 0.7, 0.4);
      const f = rnd(900, 2400);
      burst(ctx, sh, g, t, { hp: 3000, dur: 0.012, gain: 0.15 });
      tone(ctx, g, t + 0.004, { freq: f, freqTo: f * 0.55, dur: 0.14, gain: 0.2, attack: 0.002 });
      return 0.15;
    }
    case 'thud': {
      const g = chain(sc, o, 0.5, 0.5);
      burst(ctx, sh, g, t, { kind: 'brown', lp: 200, dur: 0.2, gain: 0.6 });
      tone(ctx, g, t, { freq: 70, freqTo: 40, dur: 0.25, gain: 0.3 });
      return 0.3;
    }
    case 'shutter': {
      const g = chain(sc, o, 0.4, 2.5);
      burst(ctx, sh, g, t, { kind: 'pink', bp: 700, q: 1.5, dur: 1.8, gain: 0.15, attack: 0.1 });
      burst(ctx, sh, g, t + 1.8, { kind: 'pink', bp: 1500, q: 8, dur: 0.4, gain: 0.18 });
      return 2.2;
    }
  }
}
