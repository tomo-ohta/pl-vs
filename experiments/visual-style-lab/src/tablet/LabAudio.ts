/**
 * タブレットの音（v2 の AudioEngine のうちタブレットが使う所: ui の操作音・シャッター・効果音の入口）。
 * このステージには音の仕組みが無いので、WebAudio で短い音を合成する（初めて鳴らすときに AudioContext を作る）
 */
type UiKind = 'click' | 'cancel' | 'confirm' | 'error' | 'open' | 'close';

export class LabAudio {
  private ac: AudioContext | null = null;
  private out: GainNode | null = null;

  /** 効果音の入口（タブレットの「覗き込む音」がここへつなぐ） */
  get sfxInput(): GainNode | null {
    return this.ensure();
  }

  ui(kind: UiKind): void {
    const tones: Record<UiKind, [number, number, number][]> = {
      click: [[1320, 0, 0.035]],
      confirm: [[880, 0, 0.05], [1320, 0.05, 0.06]],
      cancel: [[660, 0, 0.05], [440, 0.05, 0.06]],
      error: [[220, 0, 0.09], [196, 0.1, 0.12]],
      open: [[520, 0, 0.06], [780, 0.05, 0.08]],
      close: [[780, 0, 0.05], [520, 0.05, 0.07]],
    };
    for (const [f, at, len] of tones[kind]) this.tone(f, at, len, kind === 'error' ? 0.05 : 0.035);
  }

  /** シャッター（2 回のはじける音） */
  play(name: string, o: { gain?: number } = {}): void {
    if (name !== 'shutter') return;
    this.noise(0, 0.025, 0.25 * (o.gain ?? 1));
    this.noise(0.07, 0.035, 0.18 * (o.gain ?? 1));
  }

  /** 環境音を絞る・戻す（このステージには環境音が無い） */
  fadeAmbient(): void {}

  private ensure(): GainNode | null {
    if (this.out) {
      if (this.ac?.state === 'suspended') void this.ac.resume();
      return this.out;
    }
    try {
      this.ac = new AudioContext();
      this.out = this.ac.createGain();
      this.out.gain.value = 0.8;
      this.out.connect(this.ac.destination);
      return this.out;
    } catch {
      return null;
    }
  }

  private tone(freq: number, at: number, len: number, gain: number): void {
    const out = this.ensure();
    const ac = this.ac;
    if (!out || !ac) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  private noise(at: number, len: number, gain: number): void {
    const out = this.ensure();
    const ac = this.ac;
    if (!out || !ac) return;
    const t = ac.currentTime + at;
    const n = Math.max(1, Math.floor(ac.sampleRate * len));
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(hp).connect(g).connect(out);
    src.start(t);
  }
}
