import type { App } from '../App.ts';
import { REAL_SLIDERS, type RealSettings } from '../render/Real.ts';

/**
 * リアルな照明（render/Real.ts）のパネル。ボタン 1 つ（J キー）で入り切りし、値は場面ごとの既定から動かせる。
 * 切っているときは今までの塗りの照明のまま。
 */
export class RealPanel {
  readonly el: HTMLDetailsElement;
  private readonly toggle: HTMLButtonElement;
  private readonly auto: HTMLInputElement;
  private readonly fixtures: HTMLInputElement;
  private readonly inputs = new Map<keyof RealSettings, { input: HTMLInputElement; out: HTMLSpanElement }>();

  constructor(private readonly app: App, parent: HTMLElement) {
    this.el = document.createElement('details');
    this.el.className = 'film real';
    this.el.open = true;
    this.el.innerHTML = `
      <summary>リアルな照明（J）</summary>
      <button data-r="toggle" class="real-toggle"></button>
      <div class="real-body">
        <div class="row"><label><input type="checkbox" data-r="auto">自動露出</label><label><input type="checkbox" data-r="fixtures">照明器具を灯りに</label></div>
        <div class="row"><button data-r="reset">場面の既定に戻す</button></div>
      </div>
      <div class="note">光源の近くが明るく、光源の無い所は暗い照明（距離の 2 乗で弱まる灯り・環境光を弱める）に、物の隅の暗さ（AO）・光芒（日光の筋）・灯りのまわりの空気の光（グロウ）・スポットの光の円錐・ブルーム・自動露出を重ねる。切ると今までの塗りの照明に戻る</div>`;
    parent.appendChild(this.el);
    this.toggle = this.el.querySelector('[data-r="toggle"]') as HTMLButtonElement;
    this.auto = this.el.querySelector('[data-r="auto"]') as HTMLInputElement;
    this.fixtures = this.el.querySelector('[data-r="fixtures"]') as HTMLInputElement;
    const body = this.el.querySelector('.real-body') as HTMLDivElement;
    for (const s of REAL_SLIDERS) {
      const label = document.createElement('label');
      label.innerHTML = `${s.label} <input type="range" min="${s.min}" max="${s.max}" step="${s.step}"><span></span>`;
      const input = label.querySelector('input') as HTMLInputElement;
      const out = label.querySelector('span') as HTMLSpanElement;
      input.oninput = () => app.setReal({ [s.key]: Number(input.value) } as Partial<RealSettings>);
      input.addEventListener('change', () => input.blur());
      body.appendChild(label);
      this.inputs.set(s.key, { input, out });
    }
    this.toggle.onclick = () => {
      app.setReal({ enabled: !app.post.real.settings.enabled });
      this.toggle.blur();
    };
    this.auto.onchange = () => {
      app.setReal({ autoExposure: this.auto.checked });
      this.auto.blur();
    };
    this.fixtures.onchange = () => {
      app.setReal({ fixtures: this.fixtures.checked });
      this.fixtures.blur();
    };
    (this.el.querySelector('[data-r="reset"]') as HTMLButtonElement).onclick = (e) => {
      app.resetReal();
      (e.target as HTMLElement).blur();
    };
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
      if (e.code === 'KeyJ') app.setReal({ enabled: !app.post.real.settings.enabled });
    });
    this.sync();
  }

  /** 設定の値を表示に写す */
  sync(): void {
    const r = this.app.post.real.settings;
    this.toggle.textContent = r.enabled ? 'リアルな照明: オン' : 'リアルな照明: オフ（塗りの照明）';
    this.toggle.classList.toggle('on', r.enabled);
    this.auto.checked = r.autoExposure;
    this.fixtures.checked = r.fixtures;
    this.fixtures.disabled = !r.enabled;
    for (const [k, { input, out }] of this.inputs) {
      const v = r[k] as number;
      input.value = String(v);
      out.textContent = k === 'exposure' ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}` : String(Math.round(v * 1000) / 1000);
      input.disabled = !r.enabled;
    }
    this.auto.disabled = !r.enabled;
  }
}
