/**
 * 床と足場・装置（ground）の描画の共通の道具: 箱のジオメトリ（頂点の明るさ付き）・区画の陰影の測り方・
 * 文字の板（CanvasTexture。エレベーターのボタン・ダイヤルの数字・駅名）・合成音（WebAudio。音は合成だけ）。
 */
import * as THREE from 'three';
import type { AABB } from '../../../core/math/aabb.ts';
import type { Json, MatId } from '../../../core/world/layout.ts';
import type { AudioEngine } from '../../audio/AudioEngine.ts';
import { surfaceBox } from '../../render/SurfaceGeometry.ts';
import { cellAt, sampleCellLight } from '../../world/FloorBuilder.ts';
import type { ViewContext } from '../views.ts';

export function aabbOf(v: Json | undefined): AABB {
  const o = v as { min: number[]; max: number[] };
  return { min: [o.min[0]!, o.min[1]!, o.min[2]!], max: [o.max[0]!, o.max[1]!, o.max[2]!] };
}

/** 箱のジオメトリ（原点中心）と頂点の明るさの属性 */
export function boxGeo(size: [number, number, number], mat: MatId): THREE.BufferGeometry {
  const g = surfaceBox({ min: [-size[0] / 2, -size[1] / 2, -size[2] / 2], max: [size[0] / 2, size[1] / 2, size[2] / 2], mat, solid: false });
  if (!g.getAttribute('bakedLight')) g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
  return g;
}

/** three の標準のジオメトリ（球・円柱）に頂点の明るさの属性を付ける */
export function withBaked<T extends THREE.BufferGeometry>(g: T): T {
  if (!g.getAttribute('bakedLight')) g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3));
  return g;
}

export function setBaked(g: THREE.BufferGeometry, rgb: [number, number, number]): void {
  const attr = g.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
  if (!attr) return;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) { arr[i] = rgb[0]; arr[i + 1] = rgb[1]; arr[i + 2] = rgb[2]; }
  attr.needsUpdate = true;
}

/** 区画の焼き込み陰影をその位置で測る（動く物が浮いて見えないように） */
export function lightAt(ctx: ViewContext, at: [number, number, number]): [number, number, number] {
  const cell = cellAt(ctx.built, at);
  return cell ? sampleCellLight(cell, at, ctx.levelOf) : [0.2, 0.2, 0.2];
}

/** 照明に依らない色の材質（光る物・目印） */
export function glowMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, fog: true });
}

/**
 * 文字の板（CanvasTexture）: 幅 w・高さ h（m）の板に text を描く。document の無い環境（試験）では色だけの板
 */
export function textPlate(text: string, w: number, h: number, o: { fg?: string; bg?: string; px?: number; font?: string } = {}): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  let mat: THREE.Material;
  if (typeof document !== 'undefined') {
    const px = o.px ?? 128;
    const cv = document.createElement('canvas');
    cv.width = Math.max(16, Math.round(px * (w / h)));
    cv.height = px;
    const g = cv.getContext('2d')!;
    g.fillStyle = o.bg ?? '#1a1c20';
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = o.fg ?? '#f2f0e6';
    g.font = o.font ?? `bold ${Math.round(px * 0.62)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, cv.width / 2, cv.height / 2 + px * 0.04);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshBasicMaterial({ map: tex, fog: true });
  } else mat = new THREE.MeshBasicMaterial({ color: 0x777777 });
  return new THREE.Mesh(geo, mat);
}

export function disposeMesh(m: THREE.Object3D): void {
  m.removeFromParent();
  m.traverse((x) => {
    const mesh = x as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const mm of mats) { (mm as THREE.MeshBasicMaterial).map?.dispose(); mm.dispose(); }
  });
}

// ---------------------------------------------------------------- 合成音

/** 効果音の出口（音量の設定に従う効果音のバス。無ければ出力へ直接） */
function sfxOut(audio: AudioEngine): { ctx: AudioContext; dest: AudioNode } | null {
  const ctx = audio.context;
  if (!ctx || ctx.state === 'closed') return null;
  const bus = (audio as unknown as { sfxBus?: GainNode | null }).sfxBus;
  return { ctx, dest: bus ?? ctx.destination };
}

function panned(ctx: AudioContext, dest: AudioNode, pos?: readonly number[]): AudioNode {
  if (!pos) return dest;
  const p = ctx.createPanner();
  p.panningModel = 'equalpower';
  p.distanceModel = 'inverse';
  p.refDistance = 2;
  p.maxDistance = 40;
  p.positionX.value = pos[0]!; p.positionY.value = pos[1]!; p.positionZ.value = pos[2]!;
  p.connect(dest);
  return p;
}

/** 音程のある短い音（踏むと鳴る床・ボタン・ベル） */
export function tone(audio: AudioEngine | undefined, freq: number, o: { pos?: readonly number[]; gain?: number; dur?: number; type?: OscillatorType; attack?: number; freqTo?: number; partials?: [number, number][]; delay?: number } = {}): void {
  if (!audio) return;
  const out = sfxOut(audio);
  if (!out) return;
  const { ctx, dest } = out;
  const t = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.15, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(panned(ctx, dest, o.pos));
  for (const [mul, amp] of o.partials ?? [[1, 1]]) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq * mul, t);
    if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo * mul, t + dur);
    const og = ctx.createGain();
    og.gain.value = amp;
    osc.connect(og).connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => { osc.disconnect(); og.disconnect(); };
  }
  setTimeout(() => g.disconnect(), (dur + (o.delay ?? 0) + 0.2) * 1000);
}

/** 雑音の短い音（崩れる・落ちる・擦れる） */
export function noise(audio: AudioEngine | undefined, o: { pos?: readonly number[]; gain?: number; dur?: number; lowpass?: number; highpass?: number; attack?: number; delay?: number } = {}): void {
  if (!audio) return;
  const out = sfxOut(audio);
  if (!out) return;
  const { ctx, dest } = out;
  const t = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.4;
  const n = Math.max(1, Math.round(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let k = 12345;
  for (let i = 0; i < n; i++) { k = (k * 16807) % 2147483647; d[i] = (k / 2147483647) * 2 - 1; }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.2, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = src;
  if (o.lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass; node.connect(f); node = f; }
  if (o.highpass) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.highpass; node.connect(f); node = f; }
  node.connect(g).connect(panned(ctx, dest, o.pos));
  src.start(t);
  src.stop(t + dur + 0.05);
  src.onended = () => { src.disconnect(); g.disconnect(); };
}

/** 鳴り続ける音（警報・唸り）。stop() で止める */
export interface Drone { stop(): void; setGain(v: number): void }
export function drone(audio: AudioEngine | undefined, o: { pos?: readonly number[]; gain?: number; freq: number; type?: OscillatorType; lfoHz?: number; lfoDepth?: number }): Drone {
  const none: Drone = { stop() {}, setGain() {} };
  if (!audio) return none;
  const out = sfxOut(audio);
  if (!out) return none;
  const { ctx, dest } = out;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.08, t + 0.2);
  g.connect(panned(ctx, dest, o.pos));
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sawtooth';
  osc.frequency.value = o.freq;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = o.lfoHz ?? 0.8;
  const lg = ctx.createGain();
  lg.gain.value = o.lfoDepth ?? o.freq * 0.25;
  lfo.connect(lg).connect(osc.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  osc.connect(lp).connect(g);
  osc.start(t); lfo.start(t);
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.stop(now + 0.45); lfo.stop(now + 0.45);
      setTimeout(() => { osc.disconnect(); lfo.disconnect(); lg.disconnect(); lp.disconnect(); g.disconnect(); }, 600);
    },
    setGain(v) { if (!stopped) g.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
  };
}

/** この部品のイベント（Cue）を受け取る。戻り値でやめる */
export function onCue(ctx: ViewContext, entity: string, f: (name: string, pos: [number, number, number] | undefined, data: { [k: string]: string | number | boolean | null }) => void): () => void {
  if (!ctx.onEvent) return () => {};
  return ctx.onEvent((e) => {
    if (e.type !== 'cue' || e.entity !== entity) return;
    f(String(e.data?.name ?? ''), e.pos ? [e.pos[0], e.pos[1], e.pos[2]] : undefined, e.data ?? {});
  });
}
