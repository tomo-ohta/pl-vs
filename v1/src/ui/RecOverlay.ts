/**
 * REC・タイムコード表示（DOM。ポスト処理の外なのでノイズや走査線は乗らない）。担当 F1b。
 * 右上に ●REC（赤丸が 1 s 周期で点滅）、左下に日付 + タイムコード（起動からの経過 HH:MM:SS:FF、FF は 30 fps）。
 * 等幅・小さめ・白 80%、ポインタイベント無効、既定オフ（設定で Game / F2 がオン / オフする。世界観の押し付けにならないよう）。
 * DOM は最初に表示したときに作る（非表示のまま dispose するなら何も作らない）。document が無い環境（Node）では何もしない。
 *
 * Game との契約（公開 API。変えない）: `new RecOverlay(parent)` / `setVisible(v)` / `isVisible` / `update(dt)` / `dispose()`。
 * 追加: `date`（表示する日付。既定は架空日付。`'auto'` で `new Date()` の年月日）、`elapsed`（タイムコードの秒。書き換え可）
 */
export class RecOverlay {
  private visible = false;
  readonly parent: HTMLElement | null;
  /** 表示する日付（既定は架空日付。'auto' なら new Date() の年月日を YYYY.MM.DD で出す） */
  date: string = '2003.07.14';
  /** タイムコードの元になる経過秒（update(dt) の累計。起動からの経過。書き換え可） */
  elapsed = 0;
  private root: HTMLElement | null = null;
  private dot: HTMLElement | null = null;
  private tc: HTMLElement | null = null;
  private lastTc = '';
  private lastDotOn = true;

  constructor(parent: HTMLElement | null = typeof document !== 'undefined' ? document.body : null) { this.parent = parent; }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    if (v) {
      const root = this.ensureDom();
      if (root) {
        root.style.display = '';
        this.lastTc = '';
        this.refresh();
      }
    } else if (this.root) {
      this.root.style.display = 'none';
    }
  }

  get isVisible(): boolean { return this.visible; }

  /** 毎フレーム呼ぶ。経過は非表示中も進める（起動からの経過）。DOM は表示中だけ触る */
  update(dt: number): void {
    this.elapsed += Math.max(0, dt);
    if (!this.visible || !this.root) return;
    this.refresh();
  }

  dispose(): void {
    this.root?.remove();
    this.root = null;
    this.dot = null;
    this.tc = null;
    this.visible = false;
  }

  // ------------------------------------------------------------ 内部

  private ensureDom(): HTMLElement | null {
    if (this.root) return this.root;
    if (!this.parent || typeof document === 'undefined') return null;
    const doc = this.parent.ownerDocument ?? document;
    const root = doc.createElement('div');
    root.id = 'rec-overlay';
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = [
      'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:5', 'user-select:none',
      'font:12px/1 ui-monospace, Menlo, Consolas, "Courier New", monospace', 'letter-spacing:0.08em',
      'color:rgba(255,255,255,0.8)', 'text-shadow:0 1px 2px rgba(0,0,0,0.7)',
    ].join(';');

    const rec = doc.createElement('div');
    rec.style.cssText = 'position:absolute;right:calc(16px + env(safe-area-inset-right, 0px));top:calc(14px + env(safe-area-inset-top, 0px));display:flex;align-items:center;gap:6px';
    const dot = doc.createElement('span');
    dot.style.cssText = 'display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff2b2b;box-shadow:0 0 6px rgba(255,43,43,0.7)';
    const label = doc.createElement('span');
    label.textContent = 'REC';
    rec.append(dot, label);

    const tc = doc.createElement('div');
    tc.style.cssText = 'position:absolute;left:calc(16px + env(safe-area-inset-left, 0px));bottom:calc(16px + env(safe-area-inset-bottom, 0px));white-space:pre';

    root.append(rec, tc);
    this.parent.appendChild(root);
    this.root = root;
    this.dot = dot;
    this.tc = tc;
    return root;
  }

  private refresh(): void {
    if (!this.dot || !this.tc) return;
    const dotOn = this.elapsed % 1 < 0.5;
    if (dotOn !== this.lastDotOn) {
      this.lastDotOn = dotOn;
      this.dot.style.opacity = dotOn ? '1' : '0';
    }
    const text = `${this.dateText()}  ${formatTimecode(this.elapsed)}`;
    if (text !== this.lastTc) {
      this.lastTc = text;
      this.tc.textContent = text;
    }
  }

  private dateText(): string {
    if (this.date !== 'auto') return this.date;
    const d = new Date();
    return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  }
}

/** HH:MM:SS:FF（FF は 30 fps のフレーム番号 00〜29） */
export function formatTimecode(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600) % 100;
  const m = Math.floor(s / 60) % 60;
  const ss = Math.floor(s) % 60;
  const ff = Math.floor((s - Math.floor(s)) * 30) % 30;
  return `${pad2(h)}:${pad2(m)}:${pad2(ss)}:${pad2(ff)}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
