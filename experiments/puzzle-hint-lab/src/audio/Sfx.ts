/**
 * 効果音（WebAudio の合成。素材のファイルは使わない）: ボタン・正解・不正解・ヒントの解放・タブレット・部屋に初めて入った
 */
type Wave = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private vol = 0.7;

  /** 最初のクリックで呼ぶ（ブラウザの決まりで、操作の後でないと音が出ない） */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.vol;
      // 軽く圧縮して、重なっても割れないように
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  set volume(v: number) {
    this.vol = v;
    if (this.master) this.master.gain.value = v;
  }
  get volume(): number {
    return this.vol;
  }

  private tone(freq: number, at: number, dur: number, gain: number, wave: Wave = 'sine', slideTo?: number): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(at: number, dur: number, gain: number, from: number, to: number): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + at;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  /** ボタンを押した（押した順で音の高さを上げる） */
  press(order: number): void {
    this.noise(0, 0.05, 0.25, 2500, 1200);
    const notes = [523.25, 587.33, 659.25, 783.99, 880];
    this.tone(notes[Math.min(order, notes.length) - 1], 0.01, 0.22, 0.22, 'triangle');
  }

  /** 制圧済みのボタン・押せないとき */
  dull(): void {
    this.tone(220, 0, 0.08, 0.12, 'triangle');
  }

  solved(): void {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.tone(f, 0.05 + i * 0.07, 0.5, 0.16, 'sine'));
    this.tone(523.25, 0.05, 0.9, 0.1, 'triangle');
    this.noise(0.05, 0.6, 0.06, 6000, 9000);
  }

  wrong(): void {
    this.tone(150, 0.05, 0.22, 0.2, 'square', 110);
    this.tone(120, 0.32, 0.3, 0.2, 'square', 80);
  }

  /** ヒントの解放 */
  unlock(): void {
    [659.25, 830.6, 987.77, 1318.5, 1661.2].forEach((f, i) => this.tone(f, i * 0.09, 0.9, 0.12, 'sine'));
    this.noise(0, 1.2, 0.08, 3000, 12000);
  }

  /** 初めて入った部屋 */
  discover(): void {
    this.tone(1760, 0, 0.18, 0.05, 'sine');
    this.tone(2637, 0.06, 0.25, 0.04, 'sine');
  }

  tabletOpen(): void {
    this.noise(0, 0.32, 0.12, 400, 5000);
    this.tone(440, 0.02, 0.25, 0.08, 'sine', 1320);
    this.tone(1760, 0.22, 0.16, 0.05, 'sine');
  }

  tabletClose(): void {
    this.noise(0, 0.22, 0.09, 4000, 500);
    this.tone(990, 0, 0.2, 0.06, 'sine', 330);
  }

  tab(): void {
    this.tone(1320, 0, 0.06, 0.06, 'square');
    this.noise(0, 0.05, 0.05, 5000, 3000);
  }
}
