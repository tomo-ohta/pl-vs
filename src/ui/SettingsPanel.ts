/**
 * 設定パネル（音量 3 本 + 視点感度のスライダー、描画効果・カメラ挙動の選択）。DOM を生成して #settings-slot に入れる。
 * #settings-slot が無ければ #menu .panel の .buttons の直前に自分で作る。
 *
 * 統合担当向け: 呼び出し方
 *   const settings = Settings.load();
 *   const panel = new SettingsPanel(settings);        // Game.bindMenu の後に作る（#quality の change を Settings.tier と同期させるため）
 *   panel.refresh();                                  // 外部から settings を変えた後に表示を合わせる（onChange で自動追従するので通常不要）
 * 値の反映先は Settings.onChange で購読する（AudioEngine は自分で購読する。視点感度は InputController 側で
 * pcSensitivity / mobileSensitivity に lookSensitivity を掛ける配線が必要 → phase1-requests.md 参照）。
 * カメラ挙動（手持ち感 / 視線の遅れ / 表示 fps / REC 表示）は Game.applyCameraSettings が購読する（docs/film-camera.md）。
 */
import type { Settings, SettingsData } from '../core/Settings';

type SliderKey = keyof Pick<SettingsData, 'masterVolume' | 'ambientVolume' | 'sfxVolume' | 'lookSensitivity' | 'handheld' | 'vhsStrength'>;
type SelectKey = keyof Pick<SettingsData, 'postfx' | 'frameHold' | 'toneMapping' | 'cameraLag' | 'recOverlay'>;

interface SliderDef {
  kind: 'slider';
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

/** 選択式の設定。bool: true なら選択肢は 'on' / 'off' で、Settings には boolean として書く */
interface SelectDef {
  kind: 'select';
  key: SelectKey;
  label: string;
  options: { value: string; label: string }[];
  /** 右列の注記 */
  note?: string;
  bool?: boolean;
}

type RowDef = SliderDef | SelectDef;

const ON_OFF = [{ value: 'on', label: 'オン' }, { value: 'off', label: 'オフ' }];
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** 表示順。音 → 視点 → 描画効果とカメラ挙動 → 開発用 */
const ROWS: RowDef[] = [
  { kind: 'slider', key: 'masterVolume', label: '全体音量', min: 0, max: 1, step: 0.01, format: pct },
  { kind: 'slider', key: 'ambientVolume', label: '環境音', min: 0, max: 1, step: 0.01, format: pct },
  { kind: 'slider', key: 'sfxVolume', label: '効果音', min: 0, max: 1, step: 0.01, format: pct },
  { kind: 'slider', key: 'lookSensitivity', label: '視点感度', min: 0.3, max: 3, step: 0.05, format: (v) => `×${v.toFixed(2)}` },
  {
    kind: 'select', key: 'postfx', label: '描画効果',
    options: [
      { value: 'off', label: 'オフ（直接描画）' },
      { value: 'clean', label: 'クリーン' },
      { value: 'homeVideo', label: 'ホームビデオ' },
      { value: 'tape', label: 'テープ（走査線・揺れ）' },
    ],
  },
  { kind: 'slider', key: 'vhsStrength', label: 'VHS 効果', min: 0, max: 2, step: 0.05, format: (v) => (v <= 0 ? 'オフ' : `${Math.round(v * 100)}%`) },
  { kind: 'slider', key: 'handheld', label: '手持ち感', min: 0, max: 1, step: 0.05, format: (v) => (v <= 0 ? 'オフ' : pct(v)) },
  { kind: 'select', key: 'cameraLag', label: '視線の遅れ', options: ON_OFF, bool: true, note: '50 ms' },
  {
    kind: 'select', key: 'frameHold', label: '表示 fps',
    options: [
      { value: 'off', label: 'プリセットに従う' },
      { value: '30', label: '30 fps に間引く' },
      { value: '24', label: '24 fps に間引く' },
    ],
    note: 'テープ向け',
  },
  { kind: 'select', key: 'recOverlay', label: 'REC 表示', options: ON_OFF, bool: true },
  {
    kind: 'select', key: 'toneMapping', label: 'トーンマップ',
    options: [
      { value: 'agx', label: 'AgX' },
      { value: 'aces', label: 'ACES Filmic' },
    ],
    note: '開発用',
  },
];

export class SettingsPanel {
  readonly el: HTMLElement;
  private readonly settings: Settings;
  private readonly inputs = new Map<string, { range: HTMLInputElement; value: HTMLElement; def: SliderDef }>();
  private readonly selects = new Map<string, { select: HTMLSelectElement; def: SelectDef }>();
  private readonly unsubscribe: () => void;

  constructor(settings: Settings, opts: { slot?: HTMLElement | null } = {}) {
    this.settings = settings;
    injectStyle();
    this.el = document.createElement('div');
    this.el.id = 'settings-panel';
    const title = document.createElement('div');
    title.className = 'settings-title';
    title.textContent = '設定';
    this.el.appendChild(title);
    for (const def of ROWS) this.el.appendChild(def.kind === 'slider' ? this.makeRow(def) : this.makeSelectRow(def));

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'settings-reset';
    reset.textContent = '既定に戻す';
    reset.addEventListener('click', () => this.settings.reset());
    this.el.appendChild(reset);

    const slot = opts.slot ?? findSlot();
    if (slot) slot.appendChild(this.el);

    this.syncQualitySelect();
    this.unsubscribe = settings.onChange(() => this.refresh());
    this.refresh();
  }

  private makeRow(def: SliderDef): HTMLElement {
    const row = document.createElement('label');
    row.className = 'settings-row';
    const name = document.createElement('span');
    name.className = 'settings-label';
    name.textContent = def.label;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(def.min);
    range.max = String(def.max);
    range.step = String(def.step);
    range.setAttribute('aria-label', def.label);
    const value = document.createElement('span');
    value.className = 'settings-value mono';
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      if (Number.isFinite(v)) this.settings.set({ [def.key]: v } as Partial<SettingsData>);
    });
    // スライダー操作中に Pointer Lock / タッチ視点へ入力が漏れないよう伝播を止める
    for (const ev of ['pointerdown', 'touchstart', 'touchmove', 'keydown'] as const) range.addEventListener(ev, (e) => e.stopPropagation());
    row.append(name, range, value);
    this.inputs.set(def.key, { range, value, def });
    return row;
  }

  private makeSelectRow(def: SelectDef): HTMLElement {
    const row = document.createElement('label');
    row.className = 'settings-row';
    const name = document.createElement('span');
    name.className = 'settings-label';
    name.textContent = def.label;
    const select = document.createElement('select');
    select.setAttribute('aria-label', def.label);
    for (const o of def.options) select.add(new Option(o.label, o.value));
    select.addEventListener('change', () => {
      const v: string | boolean = def.bool ? select.value === 'on' : select.value;
      this.settings.set({ [def.key]: v } as Partial<SettingsData>);
    });
    for (const ev of ['pointerdown', 'touchstart', 'touchmove', 'keydown'] as const) select.addEventListener(ev, (e) => e.stopPropagation());
    const note = document.createElement('span');
    note.className = 'settings-value mono';
    note.textContent = def.note ?? '';
    row.append(name, select, note);
    this.selects.set(def.key, { select, def });
    return row;
  }

  /** 既存の #quality（Game.bindMenu が所有）と Settings.tier を同期する */
  private syncQualitySelect(): void {
    const q = document.getElementById('quality') as HTMLSelectElement | null;
    if (!q) return;
    const saved = this.settings.data.tier;
    if (q.value !== saved && [...q.options].some((o) => o.value === saved)) {
      q.value = saved;
      // Game の change リスナーに Tier を適用させる
      q.dispatchEvent(new Event('change', { bubbles: true }));
    }
    q.addEventListener('change', () => {
      const v = q.value;
      if (v === 'auto' || v === 'low' || v === 'mid' || v === 'high') this.settings.set({ tier: v });
    });
  }

  /** settings の値を表示に合わせる */
  refresh(): void {
    const d = this.settings.data;
    for (const { range, value, def } of this.inputs.values()) {
      const v = d[def.key];
      if (parseFloat(range.value) !== v) range.value = String(v);
      value.textContent = def.format(v);
    }
    for (const { select, def } of this.selects.values()) {
      const cur = d[def.key];
      const v = def.bool ? (cur ? 'on' : 'off') : String(cur);
      if (select.value !== v) select.value = v;
    }
    const q = document.getElementById('quality') as HTMLSelectElement | null;
    if (q && q.value !== d.tier && [...q.options].some((o) => o.value === d.tier)) q.value = d.tier;
  }

  dispose(): void {
    this.unsubscribe();
    this.el.remove();
  }
}

function findSlot(): HTMLElement | null {
  const slot = document.getElementById('settings-slot');
  if (slot) return slot;
  const panel = document.querySelector<HTMLElement>('#menu .panel');
  if (!panel) return null;
  const made = document.createElement('div');
  made.id = 'settings-slot';
  const buttons = panel.querySelector('.buttons');
  if (buttons) panel.insertBefore(made, buttons);
  else panel.appendChild(made);
  return made;
}

function injectStyle(): void {
  if (document.getElementById('settings-panel-style')) return;
  const st = document.createElement('style');
  st.id = 'settings-panel-style';
  st.textContent = `
#settings-panel { margin: 10px 0 12px; padding: 10px 12px; border: 1px solid #2a2f3d; border-radius: 8px; text-align: left; }
#settings-panel .settings-title { font-size: 12px; color: var(--ui-dim, #9aa3b2); margin-bottom: 6px; letter-spacing: 0.1em; }
#settings-panel .settings-row { display: grid; grid-template-columns: 5.5em 1fr 3.5em; align-items: center; gap: 10px; padding: 4px 0; font-size: 14px; }
#settings-panel .settings-value { font-family: ui-monospace, Menlo, monospace; font-size: 12px; text-align: right; color: var(--ui-dim, #9aa3b2); }
#settings-panel input[type=range] { width: 100%; min-width: 0; accent-color: var(--accent, #f2c14e); touch-action: pan-x; }
#settings-panel select { width: 100%; min-width: 0; font-size: 13px; }
#settings-panel .settings-reset { margin-top: 6px; font-size: 12px; background: transparent; color: var(--ui-dim, #9aa3b2); border: 1px solid #3a4054; border-radius: 6px; padding: 3px 8px; cursor: pointer; }
#settings-panel .settings-reset:hover { border-color: var(--accent, #f2c14e); color: var(--ui-fg, #e6e8ee); }
`;
  document.head.appendChild(st);
}
