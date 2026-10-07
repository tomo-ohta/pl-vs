import { FILM_PRESET_IDS, type Film, type FilmPreset, type FrameHoldId } from '../render/Film.ts';

const PRESET_LABEL: Record<FilmPreset, string> = {
  off: 'オフ',
  clean: 'クリーン',
  homeVideo: 'ホームビデオ',
  tape: 'テープ（走査線・揺れ）',
};

/**
 * カメラ効果（v1 / v2 の「描画効果」と同じ項目）のパネル。操作パネルの下に付ける。
 * K キーで描画効果を順に切り替える。
 */
export class FilmPanel {
  readonly el: HTMLDetailsElement;
  private readonly preset: HTMLSelectElement;
  private readonly vhs: HTMLInputElement;
  private readonly vhsOut: HTMLSpanElement;
  private readonly keep: HTMLInputElement;
  private readonly keepOut: HTMLSpanElement;
  private readonly handheld: HTMLInputElement;
  private readonly handheldOut: HTMLSpanElement;
  private readonly lag: HTMLInputElement;
  private readonly hold: HTMLSelectElement;
  private readonly rec: HTMLInputElement;
  private readonly ae: HTMLInputElement;
  private readonly awb: HTMLInputElement;

  constructor(private readonly film: Film, parent: HTMLElement) {
    this.el = document.createElement('details');
    this.el.className = 'film';
    this.el.open = true;
    this.el.innerHTML = `
      <summary>カメラ効果（VHS）</summary>
      <label>描画効果 <select data-f="preset"></select></label>
      <label>VHS 効果 <input data-f="vhs" type="range" min="0" max="2" step="0.05"><span data-o="vhs"></span></label>
      <label>元の色を残す <input data-f="keep" type="range" min="0" max="1" step="0.05"><span data-o="keep"></span></label>
      <label>手持ち感 <input data-f="handheld" type="range" min="0" max="1" step="0.05"><span data-o="handheld"></span></label>
      <label>表示 fps <select data-f="hold">
        <option value="off">プリセットに従う</option><option value="30">30 fps</option><option value="24">24 fps</option>
      </select></label>
      <div class="row">
        <label><input type="checkbox" data-f="lag">視線の遅れ</label>
        <label><input type="checkbox" data-f="rec">REC 表示</label>
        <label><input type="checkbox" data-f="ae">露出の追従</label>
        <label><input type="checkbox" data-f="awb">色の追従</label>
      </div>
      <div class="note">オフ以外で、手持ち感・視線の遅れ・REC も入る。露出・色の追従はゲーム向けの値なので、ここでは既定で切っている。「元の色を残す」は VHS の色調整で消える色を元の映像から戻す（走査線・揺れ・色のにじみ・ノイズは残る）</div>`;
    parent.appendChild(this.el);
    const q = <T extends HTMLElement>(k: string): T => this.el.querySelector(`[data-f="${k}"]`) as T;
    const o = (k: string): HTMLSpanElement => this.el.querySelector(`[data-o="${k}"]`) as HTMLSpanElement;
    this.preset = q('preset');
    this.vhs = q('vhs');
    this.vhsOut = o('vhs');
    this.keep = q('keep');
    this.keepOut = o('keep');
    this.handheld = q('handheld');
    this.handheldOut = o('handheld');
    this.lag = q('lag');
    this.hold = q('hold');
    this.rec = q('rec');
    this.ae = q('ae');
    this.awb = q('awb');
    for (const id of FILM_PRESET_IDS) this.preset.add(new Option(PRESET_LABEL[id], id));

    const blur = (e: Event): void => (e.target as HTMLElement).blur();
    this.preset.onchange = (e) => {
      film.set({ preset: this.preset.value as FilmPreset });
      blur(e);
    };
    this.vhs.oninput = () => film.set({ vhsStrength: Number(this.vhs.value) });
    this.keep.oninput = () => film.set({ colorKeep: Number(this.keep.value) });
    this.handheld.oninput = () => film.set({ handheld: Number(this.handheld.value) });
    this.hold.onchange = (e) => {
      film.set({ frameHold: this.hold.value as FrameHoldId });
      blur(e);
    };
    this.lag.onchange = (e) => {
      film.set({ cameraLag: this.lag.checked });
      blur(e);
    };
    this.rec.onchange = (e) => {
      film.set({ rec: this.rec.checked });
      blur(e);
    };
    this.ae.onchange = (e) => {
      film.set({ autoExposure: this.ae.checked });
      blur(e);
    };
    this.awb.onchange = (e) => {
      film.set({ autoWhiteBalance: this.awb.checked });
      blur(e);
    };
    for (const r of [this.vhs, this.keep, this.handheld]) r.addEventListener('change', blur);
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
      if (e.code === 'KeyK') {
        const i = FILM_PRESET_IDS.indexOf(film.settings.preset);
        film.set({ preset: FILM_PRESET_IDS[(i + 1) % FILM_PRESET_IDS.length] });
      }
    });
    this.sync();
  }

  /** 設定の値を表示に写す */
  sync(): void {
    const s = this.film.settings;
    this.preset.value = s.preset;
    this.vhs.value = String(s.vhsStrength);
    this.vhsOut.textContent = s.vhsStrength <= 0 ? 'オフ' : `${Math.round(s.vhsStrength * 100)}%`;
    this.keep.value = String(s.colorKeep);
    this.keepOut.textContent = s.colorKeep <= 0 ? 'オフ（ゲームと同じ）' : `${Math.round(s.colorKeep * 100)}%`;
    this.handheld.value = String(s.handheld);
    this.handheldOut.textContent = s.handheld <= 0 ? 'オフ' : `${Math.round(s.handheld * 100)}%`;
    this.hold.value = s.frameHold;
    this.lag.checked = s.cameraLag;
    this.rec.checked = s.rec;
    this.ae.checked = s.autoExposure;
    this.awb.checked = s.autoWhiteBalance;
    const off = s.preset === 'off';
    for (const el of [this.vhs, this.keep, this.handheld, this.hold, this.lag, this.rec, this.ae, this.awb]) el.disabled = off;
  }
}
