/**
 * 光・音・視線・時間の仕掛けの効果音（段階 4・担当 sense）。手続き合成だけ（素材は使わない）。
 * AudioEngine.play(kind, { pos, gain, pitch }) から呼ぶ（SFX_KINDS と同じ一発音の扱い。予算を超えたら落とす）。
 *
 * heartbeat 鼓動 / alarm 警報 / syllable 数え歌の 1 音（pitch で高さ）/ shout 鬼の声 / rewind 巻き戻し / thunder 雷 /
 * bell 澄んだ鐘（pitch で高さ）/ clap 手を叩く / whisper ささやき / tick 時計の音 / sonar 反響の音 / paChime 館内放送のチャイム /
 * paVoice 意味の取れない放送 / creak きしみ / knockWall 壁の向こうのノック / dish 食器の音 / tv テレビのざわめき / splash 水音 / shutterClick 写真の音
 */
import type { SfxContext, ShotOpts } from './Sfx.ts';
import { burst, setPannerPos, tone, voice } from './Synth.ts';

export const SENSE_SFX = ['heartbeat', 'alarm', 'syllable', 'shout', 'rewind', 'thunder', 'bell', 'clap', 'whisper', 'tick', 'sonar', 'paChime', 'paVoice', 'creak', 'knockWall', 'dish', 'tv', 'splash', 'shutterClick'] as const;
export type SenseSfxKind = (typeof SENSE_SFX)[number];
const SET: ReadonlySet<string> = new Set(SENSE_SFX);
export const isSenseSfx = (s: string): s is SenseSfxKind => SET.has(s);

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** 出力のつなぎ（gain → 定位 → dry + 残響）。dur 秒後に切る */
function out(sc: SfxContext, o: ShotOpts, send: number, dur: number): GainNode {
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
  setTimeout(() => { for (const n of nodes) n.disconnect(); }, (dur + 0.4) * 1000);
  sc.onVoice?.(dur);
  return g;
}

/** 一発音を鳴らす。長さ（秒）を返す */
export function playSense(sc: SfxContext, kind: SenseSfxKind, o: ShotOpts = {}): number {
  const { ctx, sh } = sc;
  const t = ctx.currentTime;
  const pitch = o.pitch ?? 1;
  switch (kind) {
    case 'heartbeat': {
      const g = out(sc, o, 0.1, 0.8);
      for (const [dt, a] of [[0, 1], [0.22, 0.7]] as const) {
        tone(ctx, g, t + dt, { freq: 58, freqTo: 40, dur: 0.18, gain: 0.5 * a, attack: 0.01 });
        burst(ctx, sh, g, t + dt, { kind: 'brown', lp: 140, dur: 0.12, gain: 0.35 * a });
      }
      return 0.6;
    }
    case 'alarm': {
      const g = out(sc, o, 0.5, 1.6);
      for (let i = 0; i < 2; i++) tone(ctx, g, t + i * 0.7, { freq: 620, freqTo: 1180, dur: 0.62, gain: 0.09, type: 'square', attack: 0.02 });
      return 1.4;
    }
    case 'syllable': {
      const g = out(sc, o, 0.45, 0.5);
      voice(ctx, g, t, { f0: 210 * pitch, dur: 0.2, gain: 0.11, syllable: 0.2, drift: 0.5, f1: [500, 800], f2: [1100, 1700], lp: 3200 });
      return 0.3;
    }
    case 'shout': {
      const g = out(sc, o, 0.6, 1.2);
      voice(ctx, g, t, { f0: 260, dur: 0.75, gain: 0.16, syllable: 0.25, drift: 2, f1: [600, 900], f2: [1200, 2000], lp: 3800 });
      return 0.9;
    }
    case 'rewind': {
      const g = out(sc, o, 0.2, 1.0);
      burst(ctx, sh, g, t, { kind: 'pink', bp: 900, q: 2, sweepTo: 3600, dur: 0.7, gain: 0.18, attack: 0.05 });
      tone(ctx, g, t, { freq: 440, freqTo: 1800, dur: 0.6, gain: 0.05, type: 'sawtooth', attack: 0.03 });
      return 0.8;
    }
    case 'thunder': {
      const g = out(sc, o, 0.8, 4.5);
      burst(ctx, sh, g, t, { kind: 'brown', lp: 320, sweepTo: 90, dur: 3.6, gain: 0.7, attack: 0.04 });
      burst(ctx, sh, g, t + 0.05, { kind: 'pink', bp: 180, q: 0.8, dur: 1.2, gain: 0.25, attack: 0.01 });
      for (let i = 0; i < 3; i++) burst(ctx, sh, g, t + rnd(0.3, 1.8), { kind: 'brown', lp: 200, dur: rnd(0.4, 0.9), gain: 0.35 });
      return 4;
    }
    case 'bell': {
      const g = out(sc, o, 0.6, 3);
      tone(ctx, g, t, { freq: 523 * pitch, dur: 2.4, gain: 0.12, partials: [[1, 1], [2.0, 0.35], [2.76, 0.22], [5.4, 0.06]] });
      return 2.5;
    }
    case 'clap': {
      const g = out(sc, o, 0.9, 0.5);
      burst(ctx, sh, g, t, { hp: 900, lp: 6000, dur: 0.06, gain: 0.5, attack: 0.001 });
      burst(ctx, sh, g, t + 0.012, { kind: 'pink', bp: 1400, q: 1.5, dur: 0.05, gain: 0.3 });
      return 0.15;
    }
    case 'whisper': {
      const g = out(sc, o, 0.5, 1.6);
      burst(ctx, sh, g, t, { kind: 'pink', bp: 2600, q: 3, dur: 0.5, gain: 0.08, attack: 0.08 });
      burst(ctx, sh, g, t + 0.45, { kind: 'pink', bp: 3300, q: 4, dur: 0.6, gain: 0.07, attack: 0.1 });
      return 1.2;
    }
    case 'tick': {
      const g = out(sc, o, 0.3, 0.2);
      burst(ctx, sh, g, t, { hp: 3000, dur: 0.012, gain: 0.25 * pitch, attack: 0.001 });
      tone(ctx, g, t, { freq: 2600, dur: 0.03, gain: 0.04 });
      return 0.05;
    }
    case 'sonar': {
      const g = out(sc, o, 0.95, 2.2);
      tone(ctx, g, t, { freq: 980 * pitch, freqTo: 900 * pitch, dur: 1.4, gain: 0.07, partials: [[1, 1], [2.02, 0.2]] });
      return 1.5;
    }
    case 'paChime': {
      const g = out(sc, o, 0.6, 2.4);
      [784, 659, 523, 392].forEach((f, i) => tone(ctx, g, t + i * 0.36, { freq: f, dur: 1.2, gain: 0.07, partials: [[1, 1], [2, 0.2]] }));
      return 2.2;
    }
    case 'paVoice': {
      const g = out(sc, o, 0.7, 3.5);
      voice(ctx, g, t, { f0: 190, dur: 2.8, gain: 0.1, syllable: 0.14, drift: 3, hp: 450, lp: 2600 });
      return 3;
    }
    case 'creak': {
      const g = out(sc, o, 0.5, 1);
      tone(ctx, g, t, { freq: 160, freqTo: 230, dur: 0.5, gain: 0.05, type: 'sawtooth', attack: 0.06 });
      burst(ctx, sh, g, t, { kind: 'pink', bp: 700, q: 6, dur: 0.45, gain: 0.06 });
      return 0.6;
    }
    case 'knockWall': {
      const g = out(sc, o, 0.4, 1.2);
      for (let i = 0; i < 3; i++) {
        burst(ctx, sh, g, t + i * 0.22, { kind: 'brown', lp: 380, dur: 0.07, gain: 0.5, attack: 0.002 });
        tone(ctx, g, t + i * 0.22, { freq: 140, freqTo: 90, dur: 0.09, gain: 0.18 });
      }
      return 0.8;
    }
    case 'dish': {
      const g = out(sc, o, 0.4, 0.8);
      for (let i = 0; i < 2; i++) tone(ctx, g, t + i * rnd(0.08, 0.2), { freq: rnd(2200, 3400), dur: 0.35, gain: 0.04, partials: [[1, 1], [2.3, 0.4], [3.9, 0.2]] });
      return 0.6;
    }
    case 'tv': {
      const g = out(sc, o, 0.3, 2.6);
      voice(ctx, g, t, { f0: rnd(150, 230), dur: 2.0, gain: 0.07, syllable: 0.12, drift: 4, hp: 300, lp: 1800 });
      burst(ctx, sh, g, t, { kind: 'pink', hp: 2000, lp: 5000, dur: 2.0, gain: 0.015, attack: 0.2 });
      return 2.2;
    }
    case 'splash': {
      const g = out(sc, o, 0.6, 1);
      burst(ctx, sh, g, t, { lp: 2400, sweepTo: 500, dur: 0.5, gain: 0.35, attack: 0.01 });
      return 0.6;
    }
    case 'shutterClick': {
      const g = out(sc, o, 0.3, 0.4);
      burst(ctx, sh, g, t, { hp: 2000, dur: 0.02, gain: 0.4, attack: 0.001 });
      burst(ctx, sh, g, t + 0.09, { hp: 1500, dur: 0.03, gain: 0.3, attack: 0.001 });
      return 0.2;
    }
  }
}
