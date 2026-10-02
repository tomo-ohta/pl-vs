/**
 * 物を運ぶ担当の描画の共通の道具: 焼き込み陰影の頂点属性（bakedLight）付きの形・区画の陰影を測る・音（合成）。
 * views.ts の同じ役目の補助は外に出ていないので、ここに小さく持つ。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { surfaceBox } from '../../render/SurfaceGeometry.ts';
import { cellAt, sampleCellLight } from '../../world/FloorBuilder.ts';
import type { ViewContext } from '../views.ts';

/** bakedLight の属性を足す（材質は焼き込み陰影を頂点の色として読む） */
export function withBaked<T extends THREE.BufferGeometry>(g: T, v = 0.6): T {
  if (!g.getAttribute('bakedLight')) g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(v), 3));
  return g;
}

/** 原点中心の箱 */
export function boxGeo(size: [number, number, number], mat: MatId): THREE.BufferGeometry {
  return withBaked(surfaceBox({ min: [-size[0] / 2, -size[1] / 2, -size[2] / 2], max: [size[0] / 2, size[1] / 2, size[2] / 2], mat, solid: false }));
}

export function setBaked(g: THREE.BufferGeometry, rgb: [number, number, number]): void {
  const attr = g.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
  if (!attr) return;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) { arr[i] = rgb[0]; arr[i + 1] = rgb[1]; arr[i + 2] = rgb[2]; }
  attr.needsUpdate = true;
}

/** 点 at の区画の陰影（区画の外なら暗め） */
export function lightAt(ctx: ViewContext, at: [number, number, number]): [number, number, number] {
  const cell = cellAt(ctx.built, at);
  return cell ? sampleCellLight(cell, at, ctx.levelOf) : [0.2, 0.2, 0.2];
}

/** 形を組む入れ物: 部品のメッシュと、捨てるジオメトリ */
export class Parts {
  readonly group = new THREE.Group();
  readonly geos: THREE.BufferGeometry[] = [];
  private readonly ctx: ViewContext;
  constructor(ctx: ViewContext) { this.ctx = ctx; }

  add(g: THREE.BufferGeometry, mat: MatId | THREE.Material, at: [number, number, number] = [0, 0, 0], parent: THREE.Object3D = this.group): THREE.Mesh {
    withBaked(g);
    this.geos.push(g);
    const m = new THREE.Mesh(g, typeof mat === 'string' ? this.ctx.materials.get(mat) : mat);
    m.position.set(...at);
    parent.add(m);
    return m;
  }

  box(size: [number, number, number], mat: MatId | THREE.Material, at: [number, number, number] = [0, 0, 0], parent?: THREE.Object3D): THREE.Mesh {
    return this.add(boxGeo(size, typeof mat === 'string' ? mat : 'paintWhite'), mat, at, parent);
  }

  relight(rgb: [number, number, number]): void {
    for (const g of this.geos) setBaked(g, rgb);
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
  }
}

// ---------------------------------------------------------------- 音（WebAudio の合成。鐘・鍵盤の高さのある音）
/**
 * 高さのある音（鐘・鍵盤・正解の音）。AudioEngine の一発音には高さを変えられる鐘が無いので、ここで小さく合成する。
 * 音量は設定の効果音の音量を通らない（全体の音量 0.25 に合わせて控えめ）
 */
export function playTone(ctx: ViewContext, freq: number, o: { pos?: readonly number[]; dur?: number; gain?: number; type?: OscillatorType; bell?: boolean } = {}): void {
  const ac = ctx.audio?.context;
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime;
  const dur = o.dur ?? 1.4;
  const out = ac.createGain();
  out.gain.value = (o.gain ?? 0.5) * 0.12;
  let node: AudioNode = out;
  if (o.pos) {
    const pan = ac.createPanner();
    pan.panningModel = 'equalpower';
    pan.distanceModel = 'inverse';
    pan.refDistance = 2;
    pan.positionX.value = o.pos[0]!; pan.positionY.value = o.pos[1]!; pan.positionZ.value = o.pos[2]!;
    out.connect(pan);
    node = pan;
  }
  node.connect(ac.destination);
  const partials: [number, number][] = o.bell ? [[1, 1], [2.76, 0.35], [5.4, 0.12], [8.9, 0.05]] : [[1, 1], [2, 0.25], [3, 0.1]];
  for (const [k, a] of partials) {
    const osc = ac.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.value = freq * k;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / Math.sqrt(k));
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  }
  setTimeout(() => { out.disconnect(); node.disconnect(); }, (dur + 0.2) * 1000);
}

/** 音階（ド = 0 から半音 n 上）の周波数（C5 = 523.25 Hz 基準） */
export const noteHz = (n: number, base = 523.25): number => base * 2 ** (n / 12);

/** シミュレーションのイベントのうち、この部品の Cue を受け取る */
export function onCue(ctx: ViewContext, id: string, f: (name: string, e: import('../../../core/sim/types.ts').SimEvent) => void): () => void {
  return ctx.onEvent?.((e) => { if (e.type === 'cue' && e.entity === id) f(String(e.data?.name ?? ''), e); }) ?? (() => {});
}
