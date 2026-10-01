/**
 * 音源アセットの差し替え表。public/audio/manifest.json = { "<layerId または sfxKind>": "file.mp3", ... }。
 * 起動時に fetch し、AudioContext ができたら decodeAudioData で AudioBuffer にする。
 * キーがあればサンプル再生（SampleLayer / playSample）、無ければ合成にフォールバックする。空 {} で出荷。
 * ファイル形式は mp3（Safari / Chrome / Firefox で共通にデコードできる）。mono、ループ素材は 10〜20 s を推奨。
 */
import type { LayerDest } from './Synth';
import { setPannerPos } from './Synth';

export class AssetManifest {
  private readonly url: string;
  private files = new Map<string, string>();
  private buffers = new Map<string, AudioBuffer>();
  private loaded = false;
  private decoding: Promise<void> | null = null;
  private readonly variantCache = new Map<string, { size: number; list: AudioBuffer[] }>();

  constructor(url?: string) {
    this.url = url ?? `${baseUrl()}audio/manifest.json`;
  }

  /** manifest.json を読む。無い・壊れている場合は空表（合成のみ） */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch(this.url, { cache: 'no-cache' });
      if (!res.ok) return;
      const json = (await res.json()) as unknown;
      if (json && typeof json === 'object') {
        for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
          if (typeof v === 'string' && v) this.files.set(k, v);
        }
      }
    } catch {
      /* 表なし = 全合成 */
    }
    // 足音・動作音（第20回。tools/build-footsteps.mjs が作る steps/index.json。キーは step.<床種>.<n> / move.<動作>.<n>）。無ければ合成の足音
    try {
      const dir = this.url.slice(0, this.url.lastIndexOf('/') + 1);
      const res = await fetch(`${dir}steps/index.json`, { cache: 'no-cache' });
      if (res.ok) {
        const json = (await res.json()) as unknown;
        if (json && typeof json === 'object') {
          for (const [k, v] of Object.entries(json as Record<string, unknown>)) if (typeof v === 'string' && v && !this.files.has(k)) this.files.set(k, v);
        }
      }
    } catch {
      /* 足音の表なし */
    }
  }

  /** 表にあるファイルをすべてデコードする（ctx が必要）。失敗したキーは合成にフォールバック */
  decodeAll(ctx: BaseAudioContext): Promise<void> {
    if (this.decoding) return this.decoding;
    this.decoding = (async () => {
      const dir = this.url.slice(0, this.url.lastIndexOf('/') + 1);
      await Promise.all([...this.files.entries()].map(async ([key, file]) => {
        if (this.buffers.has(key)) return;
        try {
          const res = await fetch(/^(https?:)?\//.test(file) ? file : dir + file);
          if (!res.ok) return;
          const data = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(data);
          this.buffers.set(key, buf);
        } catch (e) {
          console.warn(`[audio] アセットをデコードできません (${key}: ${file})。合成で代替します`, e);
        }
      }));
    })();
    return this.decoding;
  }

  /** デコード済みのバッファ（無ければ undefined → 合成） */
  get(key: string): AudioBuffer | undefined {
    return this.buffers.get(key);
  }

  has(key: string): boolean {
    return this.buffers.has(key);
  }

  /** キーの頭が prefix のデコード済みバッファ（足音の変種 step.concrete.* など）。結果はキャッシュ（デコードが進むと作り直す） */
  variants(prefix: string): AudioBuffer[] {
    const hit = this.variantCache.get(prefix);
    if (hit && hit.size === this.buffers.size) return hit.list;
    const list: AudioBuffer[] = [];
    for (const [k, b] of this.buffers) if (k.startsWith(prefix)) list.push(b);
    this.variantCache.set(prefix, { size: this.buffers.size, list });
    return list;
  }

  get keys(): string[] {
    return [...this.files.keys()];
  }

  get decodedCount(): number {
    return this.buffers.size;
  }
}

function baseUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
    return env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
}

/** Layer と同じ操作系で扱えるサンプルループ（アセットがあるレイヤーの差し替え） */
export class SampleLayer {
  readonly id: string;
  private readonly ctx: BaseAudioContext;
  private readonly src: AudioBufferSourceNode;
  private readonly gainNode: GainNode;
  private readonly fader: GainNode;
  private readonly nodes: AudioNode[] = [];
  private stopped = false;

  constructor(ctx: BaseAudioContext, id: string, buffer: AudioBuffer, dest: LayerDest, opts: { gain: number; lowpassHz?: number; reverbSend?: number; pos?: [number, number, number] }) {
    this.ctx = ctx;
    this.id = id;
    this.src = ctx.createBufferSource();
    this.src.buffer = buffer;
    this.src.loop = true;
    let node: AudioNode = this.src;
    if (opts.lowpassHz) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.lowpassHz;
      node.connect(f);
      node = f;
      this.nodes.push(f);
    }
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = opts.gain;
    this.fader = ctx.createGain();
    this.fader.gain.value = 0;
    node.connect(this.gainNode).connect(this.fader);
    let tail: AudioNode = this.fader;
    if (opts.pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 2;
      p.maxDistance = 40;
      setPannerPos(p, opts.pos, ctx.currentTime);
      tail.connect(p);
      tail = p;
      this.nodes.push(p);
    }
    tail.connect(dest.dry);
    const send = ctx.createGain();
    send.gain.value = opts.reverbSend ?? 0.2;
    tail.connect(send).connect(dest.reverb);
    this.nodes.push(this.gainNode, this.fader, send);
    this.src.start(ctx.currentTime, Math.random() * buffer.duration);
  }

  start(fadeSec = 0): void {
    const t = this.ctx.currentTime;
    this.fader.gain.cancelScheduledValues(t);
    this.fader.gain.setValueAtTime(this.fader.gain.value, t);
    this.fader.gain.linearRampToValueAtTime(1, t + Math.max(0.01, fadeSec));
  }

  stop(fadeSec = 1.2): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.fader.gain.cancelScheduledValues(t);
    this.fader.gain.setValueAtTime(this.fader.gain.value, t);
    this.fader.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fadeSec));
    setTimeout(() => this.dispose(), fadeSec * 1000 + 80);
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  setGain(v: number, fadeSec = 0.3): void {
    const t = this.ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(t);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, t);
    this.gainNode.gain.linearRampToValueAtTime(v, t + Math.max(0.01, fadeSec));
  }

  update(_now: number): void {
    /* サンプルは予定再生なし */
  }

  dispose(): void {
    this.stopped = true;
    try { this.src.stop(); } catch { /* 既に停止 */ }
    this.src.disconnect();
    for (const n of this.nodes) n.disconnect();
  }
}

/** サンプルの一発音。持続秒を返す */
export function playSample(ctx: BaseAudioContext, buffer: AudioBuffer, dest: LayerDest, opts: { gain?: number; send?: number; pos?: [number, number, number]; pitch?: number } = {}): number {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = opts.pitch ?? 1;
  const g = ctx.createGain();
  g.gain.value = opts.gain ?? 1;
  let tail: AudioNode = g;
  const nodes: AudioNode[] = [g];
  if (opts.pos) {
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 2;
    p.maxDistance = 40;
    setPannerPos(p, opts.pos, ctx.currentTime);
    tail.connect(p);
    tail = p;
    nodes.push(p);
  }
  src.connect(g);
  tail.connect(dest.dry);
  const send = ctx.createGain();
  send.gain.value = opts.send ?? 0.3;
  tail.connect(send).connect(dest.reverb);
  nodes.push(send);
  src.start();
  src.onended = () => { src.disconnect(); for (const n of nodes) n.disconnect(); };
  return buffer.duration / (opts.pitch ?? 1);
}
