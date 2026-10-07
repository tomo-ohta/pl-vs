import type { App } from '../App.ts';
import { drawPlan } from '../arch/plan.ts';
import { FilmPanel } from './FilmPanel.ts';

type CompareMode = 'off' | 'overlay' | 'swipe' | 'diff' | 'ref';
const MODES: CompareMode[] = ['off', 'overlay', 'swipe', 'diff', 'ref'];
const MODE_LABEL: Record<CompareMode, string> = { off: 'なし', overlay: '重ねる', swipe: '左右で切る', diff: '差分', ref: '参考画像だけ' };
const DEBUG_LABEL = ['完成', '後処理なし', '法線', 'ID・線の重み', '深度', '線'];

/** 画面の操作パネル（場面・視点・参考画像との比較・後処理の切り替え） */
export class Panel {
  readonly el: HTMLDivElement;
  private readonly refImg: HTMLImageElement;
  private readonly sceneSel: HTMLSelectElement;
  private readonly viewSel: HTMLSelectElement;
  private readonly modeSel: HTMLSelectElement;
  private readonly opacity: HTMLInputElement;
  private readonly debugSel: HTMLSelectElement;
  private readonly info: HTMLDivElement;
  private readonly help: HTMLDivElement;
  private readonly filmPanel: FilmPanel;
  private readonly minimap: HTMLCanvasElement;
  private minimapOn = false;
  mode: CompareMode = 'off';
  private swipeX = 0.5;
  private refId = '';

  constructor(private readonly app: App, root: HTMLElement) {
    this.refImg = document.createElement('img');
    this.refImg.className = 'ref';
    root.appendChild(this.refImg);

    this.el = document.createElement('div');
    this.el.className = 'panel';
    this.el.innerHTML = `
      <div class="title">見た目の検証ステージ</div>
      <div class="variant"></div>
      <label>場面 <select data-k="scene"></select></label>
      <label>視点 <select data-k="view"></select></label>
      <label>比較 <select data-k="mode"></select></label>
      <label>濃さ <input data-k="opacity" type="range" min="0" max="1" step="0.01" value="0.5"></label>
      <div class="row">
        <label><input type="checkbox" data-p="kuwahara" checked>クワハラ</label>
        <label><input type="checkbox" data-p="lines" checked>線</label>
        <label><input type="checkbox" data-p="bloom" checked>にじみ</label>
        <label><input type="checkbox" data-p="grade" checked>色調整</label>
      </div>
      <label>表示 <select data-k="debug"></select></label>
      <div class="info"></div>
      <button data-k="copy">カメラの値をコピー</button>`;
    root.appendChild(this.el);
    const arch = app.variant === 'arch';
    (this.el.querySelector('.title') as HTMLElement).textContent = arch ? '見た目の検証ステージ（建築版）' : '見た目の検証ステージ';
    (this.el.querySelector('.variant') as HTMLElement).innerHTML = arch
      ? '間取り図から作った版 ・ <a href="index.html">元の版へ</a> ・ M 間取り図'
      : '<a href="arch.html">建築版（間取り図から作った版）へ</a>';
    this.minimap = document.createElement('canvas');
    this.minimap.className = 'minimap';
    root.appendChild(this.minimap);
    setInterval(() => this.drawMinimap(), 100);
    this.filmPanel = new FilmPanel(app.film, this.el);
    this.help = document.createElement('div');
    this.help.className = 'help';
    this.help.innerHTML =
      'クリックで視点操作 ・ WASD 移動 ・ Shift 走る ・ C しゃがむ ・ Space ジャンプ ・ F 飛行<br>' +
      '1〜6 場面 ・ [ ] 視点 ・ V 比較 ・ G 表示 ・ K カメラ効果 ・ L 画面いっぱい ・ R 視点に戻る ・ H 隠す';
    root.appendChild(this.help);

    const q = <T extends HTMLElement>(k: string): T => this.el.querySelector(`[data-k="${k}"]`) as T;
    this.sceneSel = q('scene');
    this.viewSel = q('view');
    this.modeSel = q('mode');
    this.opacity = q('opacity');
    this.debugSel = q('debug');
    this.info = this.el.querySelector('.info') as HTMLDivElement;
    for (const s of app.scenes) this.sceneSel.add(new Option(s.label, s.id));
    for (const m of MODES) this.modeSel.add(new Option(MODE_LABEL[m], m));
    DEBUG_LABEL.forEach((l, i) => this.debugSel.add(new Option(l, String(i))));

    this.sceneSel.onchange = () => {
      void app.load(this.sceneSel.value);
      this.sceneSel.blur();
    };
    this.viewSel.onchange = () => {
      app.setView(this.viewSel.value || null);
      this.viewSel.blur();
    };
    this.modeSel.onchange = () => {
      this.setMode(this.modeSel.value as CompareMode);
      this.modeSel.blur();
    };
    this.opacity.oninput = () => this.updateRef();
    this.debugSel.onchange = () => {
      app.post.debug = Number(this.debugSel.value);
      this.debugSel.blur();
    };
    this.el.querySelectorAll<HTMLInputElement>('[data-p]').forEach((cb) => {
      cb.onchange = () => {
        (app.post.enable as Record<string, boolean>)[cb.dataset.p!] = cb.checked;
        cb.blur();
      };
    });
    q<HTMLButtonElement>('copy').onclick = () => {
      void navigator.clipboard?.writeText(this.cameraText());
      console.log(this.cameraText());
    };
    root.addEventListener('mousemove', (e) => {
      if (this.mode !== 'swipe' || app.input.locked) return;
      const r = app.renderer.domElement.getBoundingClientRect();
      this.swipeX = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      this.updateRef();
    });
    window.addEventListener('keydown', (e) => this.key(e));
    app.onChange = () => this.sync();
    this.sync();
    setInterval(() => this.tick(), 250);
  }

  private key(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
    const app = this.app;
    const views = app.def?.views ?? [];
    const idx = views.findIndex((v) => v.id === (app.view?.id ?? this.refId));
    if (/^Digit[1-9]$/.test(e.code)) {
      const s = app.scenes[Number(e.code.slice(5)) - 1];
      if (s) void app.load(s.id);
    } else if (e.code === 'BracketRight' && views.length) app.setView(views[(idx + 1) % views.length].id);
    else if (e.code === 'BracketLeft' && views.length) app.setView(views[(idx - 1 + views.length) % views.length].id);
    else if (e.code === 'KeyV') this.setMode(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]);
    else if (e.code === 'KeyG') {
      app.post.debug = (app.post.debug + 1) % DEBUG_LABEL.length;
      this.debugSel.value = String(app.post.debug);
    } else if (e.code === 'KeyL') {
      app.letterbox = !app.letterbox;
      app.resize();
    } else if (e.code === 'KeyR') {
      if (this.refId) app.setView(this.refId);
      else app.player.respawn();
    } else if (e.code === 'KeyM') {
      this.minimapOn = !this.minimapOn && !!app.def?.plan;
      this.minimap.style.display = this.minimapOn ? 'block' : 'none';
    } else if (e.code === 'KeyH') {
      const hide = this.el.style.display !== 'none';
      this.el.style.display = hide ? 'none' : '';
      this.help.style.display = hide ? 'none' : '';
    }
  }

  setMode(m: CompareMode): void {
    this.mode = m;
    this.modeSel.value = m;
    this.updateRef();
  }

  private sync(): void {
    const app = this.app;
    this.filmPanel?.sync();
    if (!app.def) return;
    this.sceneSel.value = app.def.id;
    this.viewSel.innerHTML = '';
    this.viewSel.add(new Option('（自由に歩く）', ''));
    for (const v of app.def.views) this.viewSel.add(new Option(`${v.id}  ${v.label}`, v.id));
    if (app.view) this.refId = app.view.id;
    else if (!app.def.views.some((v) => v.id === this.refId)) this.refId = app.def.views[0]?.id ?? '';
    this.viewSel.value = app.view?.id ?? '';
    this.updateRef();
  }

  private updateRef(): void {
    const img = this.refImg;
    if (this.mode === 'off' || !this.refId) {
      img.style.display = 'none';
      return;
    }
    const src = `refs/${this.refId}.jpg`;
    if (!img.src.endsWith(src)) img.src = src;
    img.style.display = 'block';
    img.style.opacity = this.mode === 'overlay' ? this.opacity.value : '1';
    img.style.mixBlendMode = this.mode === 'diff' ? 'difference' : 'normal';
    img.style.clipPath = this.mode === 'swipe' ? `inset(0 0 0 ${(this.swipeX * 100).toFixed(1)}%)` : 'none';
  }

  /** 間取り図のミニマップ（M キー）。今の位置と向き、参考画像の視点を描く */
  private drawMinimap(): void {
    const plan = this.app.def?.plan;
    if (!this.minimapOn || !plan) {
      if (this.minimapOn && !plan) this.minimap.style.display = 'none';
      return;
    }
    const p = this.app.player;
    drawPlan(plan, this.minimap, {
      compact: true,
      px: 340,
      views: (this.app.def?.views ?? []).map((v) => ({ id: v.id, eye: v.eye, yaw: v.yaw, fov: v.fov })),
      player: { x: p.pos.x, z: p.pos.z, yaw: p.yaw },
    });
  }

  cameraText(): string {
    const p = this.app.player;
    const c = this.app.camera;
    const f = (v: number): string => v.toFixed(3);
    return `eye: [${f(c.position.x)}, ${f(c.position.y)}, ${f(c.position.z)}], yaw: ${f(p.yaw)}, pitch: ${f(p.pitch)}, fov: ${c.fov.toFixed(1)}`;
  }

  private tick(): void {
    const app = this.app;
    const r = app.renderer.info.render;
    this.info.textContent = `${app.fps.toFixed(0)} fps ・ 描画 ${r.calls} 回 ・ ${(r.triangles / 1000).toFixed(0)}k 三角形\n${this.cameraText()}\n比較: ${this.refId || '-'}${app.player.fly ? ' ・ 飛行中' : ''}`;
  }
}
