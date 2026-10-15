/**
 * 開始の画面と一時停止の画面（Esc）。一時停止の画面に設定（タブレットの見せ方・マウスの感度・音量）とデバッグをまとめる
 */
import type { TabletMode } from '../tablet/TabletView.ts';
import type { Settings } from './settings.ts';

export interface OverlayHooks {
  /** 開始・再開（クリックの中で Pointer Lock を付ける） */
  resume(): void;
  settings: Settings;
  changed(): void;
  stats(): { visited: number; solved: number; total: number; stage: number; next: number | null; seed: number };
  debugNext(): string;
  debugVisitAll(): string;
  debugReset(): string;
  debugAnswer(): string;
  debugWarp(id: number): string;
}

const CONTROLS: [string, string][] = [
  ['W A S D', '移動'],
  ['MOUSE', '見回す'],
  ['SHIFT', '走る'],
  ['CLICK / E', 'ボタンを押す'],
  ['TAB', 'タブレットを出す・しまう'],
  ['1 / 2 / WHEEL', 'タブ（地図 / ヒント）'],
  ['V', 'タブレットの見せ方を替える'],
  ['ESC', '一時停止・設定・デバッグ'],
];

export class Overlay {
  readonly el = document.createElement('div');
  private readonly hooks: OverlayHooks;

  constructor(parent: HTMLElement, hooks: OverlayHooks) {
    this.hooks = hooks;
    this.el.id = 'overlay';
    parent.append(this.el);
  }

  get shown(): boolean {
    return !this.el.classList.contains('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  showStart(resumed: boolean): void {
    const s = this.hooks.stats();
    this.el.classList.remove('hidden');
    this.el.innerHTML = `
      <div class="card holo-panel">
        <h1>PUZZLE &amp; HINT LAB<small>謎とヒントの検証</small></h1>
        <p>${s.total} の部屋を歩いて巡り、部屋ごとの謎（ボタン）を解いて制圧していく。ヒントは全部屋の制圧数に応じて解放される
        （制圧 ${s.total / 2} 部屋でヒント 1・以降 2・3）。タブレットで地図と、今いる部屋のヒントを見られる。</p>
        <h2>CONTROLS <span>操作</span></h2>
        <div class="controls">${CONTROLS.map(([k, v]) => `<div><kbd>${k}</kbd>${v}</div>`).join('')}</div>
        ${resumed ? `<h2>PROGRESS <span>続きから</span></h2>${this.statsHtml()}` : ''}
        <div class="start-row">
          <button class="btn primary" data-act="go">CLICK TO ${resumed ? 'RESUME' : 'START'}<span class="jp">　${resumed ? '続ける' : '始める'}</span></button>
          <span class="note">SEED ${s.seed} ・ 進行はこのブラウザに保存されます</span>
        </div>
      </div>`;
    this.bind();
  }

  showPause(): void {
    const set = this.hooks.settings;
    this.el.classList.remove('hidden');
    const mode = (m: TabletMode, label: string): string => `<button class="btn ${set.tablet === m ? 'on' : ''}" data-mode="${m}"><span class="jp">${label}</span></button>`;
    this.el.innerHTML = `
      <div class="card holo-panel">
        <h1>PAUSED<small>一時停止</small></h1>
        <h2>PROGRESS <span>進行</span></h2>
        ${this.statsHtml()}
        <h2>SETTINGS <span>設定</span></h2>
        <div class="setting"><span>タブレットの見せ方</span><div class="actions">${mode('holo', '空中に映すホログラム')}${mode('glass', '手に持つガラスの端末')}</div></div>
        <div class="setting"><span>マウスの感度</span><input type="range" min="0.3" max="2.5" step="0.05" value="${set.sensitivity}" data-set="sensitivity" /></div>
        <div class="setting"><span>音量</span><input type="range" min="0" max="1" step="0.05" value="${set.volume}" data-set="volume" /></div>
        <h2>DEBUG <span>デバッグ</span></h2>
        <div class="actions">
          <button class="btn" data-dbg="next"><span class="jp">次のヒント段階へ（N）</span></button>
          <button class="btn" data-dbg="visit"><span class="jp">全部屋を踏破</span></button>
          <button class="btn" data-dbg="answer"><span class="jp">今の部屋の答え</span></button>
          <span class="setting" style="margin:0;grid-template-columns:auto auto auto"><input type="number" min="1" max="${this.hooks.stats().total}" placeholder="001" data-warp />
          <button class="btn" data-dbg="warp"><span class="jp">番号の部屋へ移る</span></button></span>
          <button class="btn danger" data-dbg="reset"><span class="jp">進行を初期化</span></button>
        </div>
        <div class="debug-out" data-out></div>
        <div class="start-row">
          <button class="btn primary" data-act="go">CLICK TO RESUME<span class="jp">　再開</span></button>
          <span class="note">ゲームの画面をクリックしても再開します</span>
        </div>
      </div>`;
    this.bind();
  }

  private statsHtml(): string {
    const s = this.hooks.stats();
    const next = s.next === null ? 'すべて解放済み' : `次のヒントまで 制圧あと ${s.next - s.solved} 部屋`;
    return `<div class="stats">
      <span class="v">踏破<b>${s.visited}</b> / ${s.total}</span>
      <span class="s">制圧<b>${s.solved}</b> / ${s.total}</span>
      <span class="h">ヒントの段階<b>${s.stage}</b> / 3</span>
      <span>${next}</span>
    </div>`;
  }

  private bind(): void {
    const q = <T extends Element>(sel: string): T | null => this.el.querySelector<T>(sel);
    q<HTMLButtonElement>('[data-act="go"]')?.addEventListener('click', () => this.hooks.resume());
    const out = q<HTMLElement>('[data-out]');
    const say = (msg: string): void => {
      if (out) out.textContent = msg;
      const stats = this.el.querySelector('.stats');
      if (stats) stats.outerHTML = this.statsHtml();
    };
    this.el.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        this.hooks.settings.tablet = b.dataset.mode as TabletMode;
        this.hooks.changed();
        this.el.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
      }),
    );
    this.el.querySelectorAll<HTMLInputElement>('[data-set]').forEach((inp) =>
      inp.addEventListener('input', () => {
        const k = inp.dataset.set as 'sensitivity' | 'volume';
        this.hooks.settings[k] = Number(inp.value);
        this.hooks.changed();
      }),
    );
    let armed = 0;
    this.el.querySelectorAll<HTMLButtonElement>('[data-dbg]').forEach((b) =>
      b.addEventListener('click', () => {
        switch (b.dataset.dbg) {
          case 'next':
            say(this.hooks.debugNext());
            break;
          case 'visit':
            say(this.hooks.debugVisitAll());
            break;
          case 'answer':
            say(this.hooks.debugAnswer());
            break;
          case 'warp': {
            const v = Number(q<HTMLInputElement>('[data-warp]')?.value);
            say(this.hooks.debugWarp(v));
            break;
          }
          case 'reset':
            // 2 回押して初期化（押し間違いを防ぐ）
            if (Date.now() - armed < 2500) {
              say(this.hooks.debugReset());
              armed = 0;
              b.classList.remove('armed');
            } else {
              armed = Date.now();
              b.classList.add('armed');
              say('もう一度押すと、踏破・制圧・ヒントの新着をすべて消します');
            }
            break;
        }
      }),
    );
  }
}
