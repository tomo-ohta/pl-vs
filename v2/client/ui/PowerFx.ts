/**
 * ビデオの電源が落ちる・入る演出（タブレットの「探索」で部屋を移るとき・ゲームを始めるとき）。
 * off: 画面（ゲームの canvas）が横 1 本の線に潰れ、点になって消える → 暗い中に LOADING。dark: 初めから暗い中に LOADING（始める前の読み込み）。
 * on: 線から画面が開く。間の HUD（REC・小さな地図・照準・スマホのボタン）は隠す。音は WebAudio の合成（効果音の音量に従う）
 */

const CSS = `
body.fx-power #rec-slot, body.fx-power #hud-map, body.fx-power #reticle, body.fx-power #hud-hint, body.fx-power #hud-device,
body.fx-power #hud-toast, body.fx-power #touch-ui { visibility: hidden !important; }
.fx-power-root { position: fixed; inset: 0; z-index: 940; pointer-events: none; }
.fx-power-root .line { position: absolute; left: 0; right: 0; top: 50%; height: 4px; margin-top: -2px; background: #fff;
  box-shadow: 0 0 22px 8px rgba(190, 215, 255, 0.85); opacity: 0; transform-origin: 50% 50%; }
.fx-power-root .dot { position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 28px 12px rgba(190, 215, 255, 0.9); opacity: 0; }
.fx-power-root .loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  font-family: var(--mono); color: #dfe5ec; letter-spacing: 0.24em; opacity: 0; transition: opacity 0.2s; }
.fx-power-root .loading .t { font-size: 15px; animation: fx-blink 1s steps(2, start) infinite; }
.fx-power-root .loading .id { font-size: 22px; color: #f2c14e; letter-spacing: 0.18em; }
.fx-power-root .loading .bar { width: min(280px, 60vw); height: 6px; border: 1px solid rgba(223, 229, 236, 0.5); position: relative; overflow: hidden; }
.fx-power-root .loading .bar i { position: absolute; top: 0; bottom: 0; width: 30%; background: rgba(223, 229, 236, 0.85); animation: fx-slide 0.9s linear infinite; }
.fx-power-root .loading .tc { font-size: 12px; color: rgba(223, 229, 236, 0.6); }
@keyframes fx-blink { to { visibility: hidden; } }
@keyframes fx-slide { from { left: -30%; } to { left: 100%; } }
`;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class PowerFx {
  private readonly canvas: HTMLCanvasElement;
  private readonly sfx: () => AudioNode | null;
  private readonly root: HTMLDivElement;
  private readonly line: HTMLDivElement;
  private readonly dot: HTMLDivElement;
  private readonly loading: HTMLDivElement;
  private readonly idEl: HTMLDivElement;
  private readonly tcEl: HTMLDivElement;
  private tcTimer = 0;

  /** canvas: ゲームの canvas・sfx: 効果音の入口（AudioEngine.sfxInput。鳴らせなければ null） */
  constructor(canvas: HTMLCanvasElement, sfx: () => AudioNode | null) {
    this.canvas = canvas;
    this.sfx = sfx;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
    this.root = document.createElement('div');
    this.root.className = 'fx-power-root';
    this.root.hidden = true;
    this.line = document.createElement('div');
    this.line.className = 'line';
    this.dot = document.createElement('div');
    this.dot.className = 'dot';
    this.loading = document.createElement('div');
    this.loading.className = 'loading';
    const t = document.createElement('div');
    t.className = 't';
    t.textContent = 'LOADING';
    this.idEl = document.createElement('div');
    this.idEl.className = 'id';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.append(document.createElement('i'));
    this.tcEl = document.createElement('div');
    this.tcEl.className = 'tc';
    this.loading.append(this.idEl, bar, t, this.tcEl);
    this.root.append(this.line, this.dot, this.loading);
    document.body.append(this.root);
  }

  /** 初めから真っ暗で LOADING（ゲームを始める前の読み込み。終わったら on で一人称の画面に） */
  dark(label: string): void {
    this.root.hidden = false;
    document.body.classList.add('fx-power');
    this.idEl.textContent = label;
    this.canvas.style.opacity = '0';
    this.loading.style.opacity = '1';
    this.startCounter();
  }

  private startCounter(): void {
    clearInterval(this.tcTimer);
    let n = 0;
    this.tcEl.textContent = '';
    this.tcTimer = window.setInterval(() => { n++; this.tcEl.textContent = `▶▶ ${String(Math.floor(n / 10)).padStart(2, '0')}:${String((n % 10) * 6).padStart(2, '0')}`; }, 100);
  }

  /** 電源が落ちる（終わると真っ暗で LOADING） */
  async off(label: string): Promise<void> {
    const c = this.canvas.style;
    this.root.hidden = false;
    document.body.classList.add('fx-power');
    this.idEl.textContent = label;
    this.sound('off');
    c.transformOrigin = '50% 50%';
    c.transition = 'transform 170ms cubic-bezier(0.55, 0, 0.9, 0.45), filter 170ms';
    c.transform = 'scale(1.03, 0.005)';
    c.filter = 'brightness(3.2) contrast(1.3)';
    await sleep(175);
    this.line.style.transition = 'none';
    this.line.style.transform = 'scaleX(1)';
    this.line.style.opacity = '1';
    c.opacity = '0';
    await sleep(16);
    this.line.style.transition = 'transform 130ms ease-in, opacity 130ms';
    this.line.style.transform = 'scaleX(0.004)';
    await sleep(135);
    this.line.style.opacity = '0';
    this.dot.style.transition = 'none';
    this.dot.style.opacity = '1';
    await sleep(16);
    this.dot.style.transition = 'opacity 380ms ease-out, transform 380ms ease-out';
    this.dot.style.opacity = '0';
    this.dot.style.transform = 'scale(0.4)';
    await sleep(420);
    this.loading.style.opacity = '1';
    this.startCounter();
  }

  /** 電源が入る（一人称の画面に戻る） */
  async on(): Promise<void> {
    const c = this.canvas.style;
    clearInterval(this.tcTimer);
    this.loading.style.opacity = '0';
    await sleep(200);
    this.sound('on');
    this.dot.style.transform = '';
    this.line.style.transition = 'none';
    this.line.style.transform = 'scaleX(1)';
    this.line.style.opacity = '1';
    c.transition = 'none';
    c.transform = 'scale(1, 0.005)';
    c.filter = 'brightness(3.2)';
    c.opacity = '1';
    void this.canvas.offsetWidth;
    await sleep(30);
    this.line.style.transition = 'opacity 200ms';
    this.line.style.opacity = '0';
    c.transition = 'transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1.15), filter 520ms ease-out';
    c.transform = 'scale(1, 1)';
    c.filter = 'brightness(1)';
    await sleep(540);
    c.transition = '';
    c.transform = '';
    c.filter = '';
    c.transformOrigin = '';
    document.body.classList.remove('fx-power');
    this.root.hidden = true;
  }

  /** 電源の音（落ちる: 高い音が下がる + ぷつっ / 入る: 低いうなりと砂嵐） */
  private sound(kind: 'off' | 'on'): void {
    const dest = this.sfx();
    if (!dest) return;
    const ac = dest.context as AudioContext;
    const t = ac.currentTime;
    try {
      const g = ac.createGain();
      g.connect(dest);
      if (kind === 'off') {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(1400, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.3);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.36);
        this.noise(ac, dest, t + 0.31, 0.05, 0.25);
      } else {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(48, t);
        o.frequency.exponentialRampToValueAtTime(110, t + 0.35);
        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 400;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(lp).connect(g);
        o.start(t);
        o.stop(t + 0.52);
        this.noise(ac, dest, t, 0.35, 0.12);
      }
    } catch {
      // 音は出せなくてよい
    }
  }

  private noise(ac: AudioContext, dest: AudioNode, t: number, dur: number, gain: number): void {
    const n = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = gain;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    src.connect(hp).connect(g).connect(dest);
    src.start(t);
  }
}
