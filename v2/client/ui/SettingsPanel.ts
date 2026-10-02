/**
 * 設定パネル（v1 ui/SettingsPanel.ts から移植）。音量 3 本 + 視点感度のスライダー、品質・描画効果・カメラ挙動の選択。
 * DOM を生成して slot（既定は #settings-slot。ui/dom.ts の mountUi が一時停止の画面の中に作る）に入れる。
 *
 * v2 での変更:
 *   - 「品質」（Settings.tier）をこのパネルの行にした。v1 は Game が持つ #quality の select と同期していた（change を dispatch して Tier を適用させていた）。
 *     v2 では Tier の適用は Settings.onChange（changed に 'tier'）と起動時の settings.data.tier で行う
 *   - 見た目は ui/style.css（v1 は自分で <style> を差し込んでいた）
 *
 * 統合担当向け: 呼び出し方
 *   const panel = new SettingsPanel(settings, { slot: ui.settingsSlot });
 *   panel.refresh();                                  // 外部から settings を変えた後に表示を合わせる（onChange で自動追従するので通常不要）
 * 値の反映先は Settings.onChange で購読する（AudioEngine は自分で購読する。視点感度は InputController.sensitivityScale、
 * 品質は Tier の切替、カメラ挙動（手持ち感 / 視線の遅れ / 表示 fps / REC 表示 / VHS 効果）と描画効果はカメラ・撮像の側）。
 */
import type { Settings, SettingsData } from '../settings/Settings.ts';

type SliderKey = keyof Pick<SettingsData, 'masterVolume' | 'ambientVolume' | 'sfxVolume' | 'lookSensitivity' | 'handheld' | 'vhsStrength'>;
type SelectKey = keyof Pick<SettingsData, 'tier' | 'postfx' | 'frameHold' | 'toneMapping' | 'cameraLag' | 'recOverlay'>;

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

/** 見出し（v1 第21回: メニューの「設定」タブで 音 / 操作 / 映像 / 開発 に分ける） */
interface HeadDef { kind: 'head'; label: string }

type RowDef = SliderDef | SelectDef | HeadDef;

const ON_OFF = [{ value: 'on', label: 'オン' }, { value: 'off', label: 'オフ' }];
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** 表示順。音 → 視点 → 品質・描画効果とカメラ挙動 → 開発用 */
const ROWS: RowDef[] = [
  { kind: 'head', label: '音' },
  { kind: 'slider', key: 'masterVolume', label: '全体音量', min: 0, max: 1, step: 0.01, format: pct },
  { kind: 'slider', key: 'ambientVolume', label: '環境音', min: 0, max: 1, step: 0.01, format: pct },
  { kind: 'slider', key: 'sfxVolume', label: '効果音', min: 0, max: 1, step: 0.01, format: pct },
  { kind: 'head', label: '操作' },
  { kind: 'slider', key: 'lookSensitivity', label: '視点感度', min: 0.3, max: 3, step: 0.05, format: (v) => `×${v.toFixed(2)}` },
  { kind: 'head', label: '映像' },
  // v1 では設定タブの右列「映像の品質」にあった #quality（選択肢と表記は同じ）
  {
    kind: 'select', key: 'tier', label: '品質',
    options: [
      { value: 'auto', label: '自動' },
      { value: 'low', label: '軽量' },
      { value: 'mid', label: '標準' },
      { value: 'high', label: '高品質（PC）' },
    ],
  },
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
  { kind: 'head', label: '開発' },
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

  /** slot: 入れる先（省略時は #settings-slot。無ければ el を作るだけで、どこにも入れない） */
  constructor(settings: Settings, opts: { slot?: HTMLElement | null } = {}) {
    this.settings = settings;
    this.el = document.createElement('div');
    this.el.id = 'settings-panel';
    for (const def of ROWS) {
      if (def.kind === 'head') { const h = document.createElement('h3'); h.className = 'set-h'; h.textContent = def.label; this.el.appendChild(h); continue; }
      this.el.appendChild(def.kind === 'slider' ? this.makeRow(def) : this.makeSelectRow(def));
    }

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'settings-reset';
    reset.textContent = '設定を既定に戻す';
    reset.addEventListener('click', () => this.settings.reset());
    this.el.appendChild(reset);

    const slot = opts.slot ?? document.getElementById('settings-slot');
    if (slot) slot.appendChild(this.el);

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
  }

  dispose(): void {
    this.unsubscribe();
    this.el.remove();
  }
}
