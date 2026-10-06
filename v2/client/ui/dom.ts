/**
 * 画面の部品（DOM）を作る。v1 は index.html に HUD・スマホの操作・メニューの枠を書いていた（v1 index.html）。v2 ではコードで作る。
 * 見た目は ui/style.css（v1 src/style.css から移植）。このファイルは CSS を import しない（main.ts で `import './ui/style.css';`）。
 *
 * 作るもの（すべて layer = root に足した 1 つの div の下。位置は各要素の position: fixed）:
 *   - 照準の点（#reticle）と 1 行の案内（#hud-hint。空なら隠れる）・知らせ（#hud-toast。図鑑に記録・調査の完成。数秒で消える）
 *   - 小さな地図（#minimap の canvas。中身は ui/Minimap.ts）と調査率（#hud-survey）
 *   - スマホの操作（#touch-ui。PC では hidden。InputController がスマホと判定したら出す）:
 *     左下スティック、右下 しゃがむ（切替）・ジャンプ・ダッシュ・置く（Q）、右上 メニュー・地図・懐中電灯（R）。
 *     ビデオカメラの画面の四隅の枠 + 人型ピクトグラム（v1 と同じ SVG）
 *   - 一時停止の画面（#pause。最初は hidden）: ❚❚ PAUSE・題（title）・「再開」・タブ（地図 / 図鑑 / 設定。v1 第21回のメニューと同じ並び）。
 *     地図のタブの中身は ui/MapPanel.ts、図鑑は ui/CodexPanel.ts、設定のタブに設定パネルの差し込み口（#settings-slot）と操作の案内
 *   - RecOverlay の親（recParent。RecOverlay が自分で #rec-overlay を作る）
 * v1 にあって作らないもの: 部屋名 HUD・デバッグ表示・暗転（#fade）・開始画面
 *
 * 統合担当向け: 呼び出し方
 *   import './ui/style.css';
 *   const ui = mountUi(document.body);
 *   const input = new InputController(canvas, ui.input);
 *   const rec = new RecOverlay(ui.recParent);
 *   const panel = new SettingsPanel(settings, { slot: ui.settingsSlot });
 *   ui.pause.resume.addEventListener('click', () => { audio.unlock(); input.requestLock(); ui.setPauseVisible(false); ... });  // ユーザージェスチャ内
 *   ui.setPauseVisible(true);                // メニューを開く（v1: input.enabled = false; input.exitLock(); audio.ui('open')）
 *   ui.setTab('map');                        // タブ（'map' | 'codex' | 'settings'）。開いている間は 1 / 2 / 3 キーでも切り替わる
 *   ui.pause.title.textContent = 'B2F …';    // 題（既定 'LIMINAL'。v1 は今いるフロアの名前を出していた）
 *   ui.pause.resumeLabel.textContent = '始める'; // ボタンの文字（resume.textContent を書き換えると ▶ が消える）
 *   ui.setHint('E: 扉を開ける');             // '' で消す
 *   ui.toast('図鑑に記録: 傾く床');           // 数秒で消える知らせ
 */
import type { InputUi } from '../input/InputController.ts';
import { DEFAULT_KEYMAP, keyLabel, keysLabel, type KeyMap } from '../input/keymap.ts';

export type PauseTab = 'map' | 'codex' | 'settings';
export const PAUSE_TABS: readonly PauseTab[] = ['map', 'codex', 'settings'];

export interface PauseRefs {
  /** 一時停止の画面の一番外側（#pause。表示は UiRefs.setPauseVisible） */
  readonly root: HTMLElement;
  /** 題（❚❚ PAUSE の右。textContent を書き換えてよい） */
  readonly title: HTMLElement;
  /** 「再開 ▶」ボタン（click はゲーム側で受ける） */
  readonly resume: HTMLButtonElement;
  /** ボタンの文字（「再開」。開始前の「始める」などに書き換えるときはこちら。▶ は残る） */
  readonly resumeLabel: HTMLElement;
  /** 操作の案内（設定のタブの右列。書き換え・hidden にしてよい） */
  readonly help: HTMLElement;
  /** 一番下の 1 行（キーの案内。スマホでは隠れる） */
  readonly foot: HTMLElement;
  /** タブのボタン */
  readonly tabs: Readonly<Record<PauseTab, HTMLButtonElement>>;
  /** タブの中身の入れ物（地図・図鑑は空。MapPanel・CodexPanel が中身を作る） */
  readonly panes: Readonly<Record<PauseTab, HTMLElement>>;
}

export interface UiRefs {
  /** mountUi が root に足した入れ物（作った要素はすべてこの下） */
  readonly layer: HTMLElement;
  /** InputController の第 2 引数（new InputController(canvas, ui.input)） */
  readonly input: Required<InputUi>;
  /** RecOverlay の親（new RecOverlay(ui.recParent)） */
  readonly recParent: HTMLElement;
  /** 画面中央の照準の点 */
  readonly reticle: HTMLElement;
  /** 1 行の案内（書くときは setHint） */
  readonly hint: HTMLElement;
  /** 画面の下の操作の案内（タブレットを持っている間。'' で消す） */
  setDeviceHint(text: string): void;
  /** SettingsPanel の差し込み口（一時停止の画面の中。new SettingsPanel(settings, { slot: ui.settingsSlot })） */
  readonly settingsSlot: HTMLElement;
  readonly pause: PauseRefs;
  /** 小さな地図の canvas（ui/Minimap.ts が描く） */
  readonly minimap: HTMLCanvasElement;
  /** 調査率の表示（小さな地図の下） */
  readonly survey: HTMLElement;
  /** 案内を出す（'' で消す。同じ文字列なら DOM を触らない） */
  setHint(text: string): void;
  /** 知らせを出す（ms 後に消える。続けて出すと後の物に置き換わる） */
  toast(text: string, ms?: number): void;
  /** 一時停止の画面を出す / 隠す */
  setPauseVisible(visible: boolean): void;
  readonly pauseVisible: boolean;
  /** 一時停止の画面のタブ */
  setTab(tab: PauseTab): void;
  readonly tab: PauseTab;
  /** タブが変わった（地図のタブを開いたら描き直す など） */
  onTabChange: ((tab: PauseTab) => void) | null;
  /** 作った要素をすべて外す */
  dispose(): void;
}

// ---------------------------------------------------------------- スマホのボタンの絵（v1 index.html と同じ SVG。固定の文字列だけ）
/** ビデオカメラの画面の四隅の枠 */
const FRAME_SVG = '<svg class="tframe" viewBox="0 0 72 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square"><path d="M4 14V4h10M58 4h10v10M68 58v10H58M14 68H4V58"/></svg>';
/** しゃがむ: 低い天井（ハッチ）の下で身をかがめる人 */
const CROUCH_SVG = '<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5h42" stroke-width="3.2" stroke-linecap="butt"/><g stroke-width="1.5" opacity=".8"><path d="M7 5.6l2.6-3.4M14 5.6l2.6-3.4M21 5.6l2.6-3.4M28 5.6l2.6-3.4M35 5.6l2.6-3.4M42 5.6l2.4-3.2"/></g><circle cx="28.5" cy="19" r="4.2" fill="currentColor" stroke="none"/><g stroke-width="4.4"><path d="M18 36.5q1-8 6-12"/><path d="M24 26l6.5 3.5"/><path d="M18 36.5 31 30l-.5 13.5h4.5"/><path d="M18 36.5l6 7"/><path d="M24 43.5 14 41l-3.5 3"/></g><path d="M3 46h42" stroke-width="1.8" opacity=".6"/></svg>';
/** ジャンプ: 両腕を上げて跳ぶ人と影 */
const JUMP_SVG = '<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="8" r="4.3" fill="currentColor" stroke="none"/><g stroke-width="4.6"><path d="M24 17v9"/><path d="M24 18.5 14 12"/><path d="M24 18.5 34 12"/><path d="M24 26l-6.5 3.5 1.5 6.5"/><path d="M24 26l6.5 3.5-1.5 6.5"/></g><ellipse cx="24" cy="44.5" rx="8.5" ry="1.8" fill="currentColor" stroke="none" opacity=".5"/></svg>';
/** ダッシュ: 走る人と速度の線（非常口の案内表示と同じ系統） */
const DASH_SVG = '<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="31" cy="8" r="4.3" fill="currentColor" stroke="none"/><g stroke-width="4.6"><path d="M28.5 15.5 23 27"/><path d="M27 17l6.5 4 4.5-3.5"/><path d="M26 17.5l-7 1.5-4 5"/><path d="M23 27l6.5 5-1.5 9"/><path d="M23 27l-5.5 7-8 .5"/></g><g stroke-width="2.2" opacity=".85"><path d="M3 15h8"/><path d="M1 22h9"/><path d="M4 29h6"/></g></svg>';
/** メニュー: 3 本線 */
const MENU_SVG = '<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M11 14h26"/><path d="M11 24h26"/><path d="M11 34h26"/></svg>';
/** 地図: 三つ折りの地図 */
const MAP_SVG = '<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round"><path d="M6 11l11-4 14 4 11-4v30l-11 4-14-4-11 4z"/><path d="M17 7v30M31 11v30" stroke-width="2.4"/></svg>';
/** 懐中電灯: 筒と光 */
const FLASH_SVG = '<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8 30l12-12 10 10-12 12z" stroke-width="3.6"/><path d="M20 18l6-6 10 10-6 6" stroke-width="3.6"/><g stroke-width="2.4" opacity=".85"><path d="M33 9l3-5M38 14l6-2M37 7l5-4"/></g></svg>';
/** 置く・投げる: 手と、手から離れる箱 */
const DROP_SVG = '<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="17" y="24" width="14" height="13" fill="currentColor" stroke="none"/><path d="M10 14q4-6 10-5h9q6 0 9 5" stroke-width="3.8"/><path d="M24 15v5M19 18l5 4 5-4" stroke-width="2.6"/><path d="M8 44h32" stroke-width="2" opacity=".6"/></svg>';

/** タブレット: 板の端末 */
const TABLET_SVG = '<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-linejoin="round"><rect x="6" y="11" width="36" height="26" rx="3.5" stroke-width="3.2"/><rect x="11" y="15.5" width="26" height="17" rx="1" fill="currentColor" stroke="none" opacity=".35"/><circle cx="24" cy="13.2" r=".9" fill="currentColor" stroke="none"/></svg>';

/** 操作の案内（v1 の開始画面と同じ文言 + v2 の地図・懐中電灯・置く・タブレット）。PC のキーは割り当て（input/keymap.ts）から作る */
function helpLines(m: Readonly<KeyMap> = DEFAULT_KEYMAP): [string, string][] {
  const k = (a: Parameters<typeof keysLabel>[1]): string => keysLabel(m, a);
  return [
    ['PC', `${k('forward')}${k('left')}${k('back')}${k('right')} 移動 / マウス 視点 / ${k('jump')} ジャンプ / ${k('dash')} ダッシュ / ${m.crouch.map(keyLabel).reverse().join(' または ')} しゃがみ / ${k('interact')} 扉を開ける・調べる / ${k('drop')} 置く・投げる / ${k('flashlight')} 懐中電灯 / ${k('map')} 地図 / ${k('tablet')} タブレット / ${k('menu')} メニュー`],
    ['スマホ', 'スワイプ 視点 / 左下スティック 移動 / 扉をタップ / 右下 ダッシュ・ジャンプ・しゃがむ（切替）・置く / 右上 メニュー・地図・懐中電灯・端末（タブレット）'],
  ];
}
const HELP_LINES = helpLines();
const TAB_LABEL: Record<PauseTab, string> = { map: '地図', codex: '図鑑', settings: '設定' };
const FOOT_TEXT: Record<PauseTab, string> = {
  map: 'Esc 再開 ・ 1–3 タブ ・ ↑↓ 高さの層 ・ 見た所だけが地図に残る',
  codex: 'Esc 再開 ・ 1–3 タブ ・ 見つけた物が記録される',
  settings: 'Esc 再開 ・ 1–3 タブ ・ 設定はすぐに保存されます',
};

/** 画面の部品を作って root（ふつうは document.body）に足す */
export function mountUi(root: HTMLElement): UiRefs {
  const doc = root.ownerDocument;
  const listeners = new AbortController();
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: { id?: string; className?: string; text?: string } = {}): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag);
    if (props.id) e.id = props.id;
    if (props.className) e.className = props.className;
    if (props.text !== undefined) e.textContent = props.text;
    return e;
  };

  const layer = el('div', { id: 'ui-layer' });

  // ---- HUD
  const reticle = el('div', { id: 'reticle' });
  reticle.setAttribute('aria-hidden', 'true');
  const hint = el('div', { id: 'hud-hint' });
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  const deviceHint = el('div', { id: 'hud-device', className: 'mono' });
  deviceHint.setAttribute('aria-live', 'polite');
  const toastEl = el('div', { id: 'hud-toast' });
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  const mapBox = el('div', { id: 'hud-map' });
  const minimap = el('canvas', { id: 'minimap' });
  minimap.width = 220;
  minimap.height = 220;
  minimap.setAttribute('aria-hidden', 'true');
  const survey = el('div', { id: 'hud-survey', className: 'mono' });
  mapBox.append(minimap, survey);

  // ---- RecOverlay の親（中身は RecOverlay が作る）
  const recParent = el('div', { id: 'rec-slot' });

  // ---- スマホの操作
  const touchRoot = el('div', { id: 'touch-ui' });
  touchRoot.hidden = true;
  const stick = el('div', { id: 'stick' });
  const knob = el('div', { id: 'stick-knob' });
  stick.append(knob);
  const button = (id: string, label: string, aria: string, icon: string): HTMLButtonElement => {
    const b = el('button', { id, className: 'tbtn' });
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.innerHTML = FRAME_SVG + icon; // 固定の SVG だけ（外からの文字列は入れない）
    b.append(el('span', { className: 'tlabel', text: label }));
    return b;
  };
  const crouch = button('btn-crouch', 'しゃがむ', 'しゃがむ（切替）', CROUCH_SVG);
  crouch.setAttribute('aria-pressed', 'false');
  const jump = button('btn-jump', 'ジャンプ', 'ジャンプ', JUMP_SVG);
  const dash = button('btn-dash', 'ダッシュ', 'ダッシュ', DASH_SVG);
  const menu = button('btn-menu', 'メニュー', 'メニュー', MENU_SVG);
  const mapBtn = button('btn-map', '地図', '地図', MAP_SVG);
  const flashlight = button('btn-flash', 'ライト', '懐中電灯（切替）', FLASH_SVG);
  const drop = button('btn-drop', '置く', '置く・投げる', DROP_SVG);
  const tabletBtn = button('btn-tablet', '端末', 'タブレット（出す・しまう）', TABLET_SVG);
  touchRoot.append(stick, crouch, jump, dash, drop, menu, mapBtn, flashlight, tabletBtn);

  // ---- 一時停止の画面（v1 第21回のメニューの枠: 四隅の枠・❚❚ PAUSE・走査線・タブ）
  const pauseRoot = el('div', { id: 'pause' });
  pauseRoot.hidden = true;
  pauseRoot.setAttribute('role', 'dialog');
  pauseRoot.setAttribute('aria-modal', 'true');
  pauseRoot.setAttribute('aria-label', '一時停止');
  const frame = el('div', { className: 'menu-frame' });
  for (const c of ['tl', 'tr', 'bl', 'br']) frame.append(el('i', { className: `mf-corner ${c}` }));
  const head = el('header', { className: 'menu-head' });
  const osd = el('div', { className: 'menu-osd' });
  const title = el('span', { id: 'pause-title', className: 'osd-where', text: 'LIMINAL' });
  const resume = el('button', { id: 'pause-resume', className: 'menu-resume' });
  resume.type = 'button';
  const resumeLabel = el('span', { text: '再開' }); // ボタンの名前（読み上げ）もこの文字になる
  const arrow = el('span', { text: '▶' });
  arrow.setAttribute('aria-hidden', 'true');
  resume.append(resumeLabel, doc.createTextNode(' '), arrow);
  osd.append(el('span', { className: 'osd-pause mono', text: '❚❚ PAUSE' }), title, resume);
  const nav = el('nav', { className: 'menu-tabs' });
  nav.setAttribute('role', 'tablist');
  const tabs = {} as Record<PauseTab, HTMLButtonElement>;
  PAUSE_TABS.forEach((t, i) => {
    const b = el('button', { className: 'menu-tab' });
    b.type = 'button';
    b.dataset.tab = t;
    b.setAttribute('role', 'tab');
    b.append(el('span', { className: 'tab-no mono', text: String(i + 1) }), doc.createTextNode(TAB_LABEL[t]));
    tabs[t] = b;
    nav.append(b);
  });
  head.append(osd, nav);
  const body = el('main', { className: 'menu-body' });
  const panes = {} as Record<PauseTab, HTMLElement>;
  for (const t of PAUSE_TABS) {
    const p = el('section', { className: 'menu-pane' });
    p.dataset.pane = t;
    p.setAttribute('role', 'tabpanel');
    panes[t] = p;
    body.append(p);
  }
  const grid = el('div', { className: 'set-grid' });
  const settingsCol = el('div', { className: 'set-col' });
  const settingsSlot = el('div', { id: 'settings-slot' });
  settingsCol.append(settingsSlot);
  const help = el('div', { className: 'set-col pause-help' });
  help.append(el('h3', { className: 'set-h', text: '操作の案内' }));
  for (const [who, text] of HELP_LINES) {
    const p = el('p');
    p.append(el('b', { className: 'mono', text: who }), doc.createTextNode(text));
    help.append(p);
  }
  grid.append(settingsCol, help);
  panes.settings.append(grid);
  const foot = el('footer', { className: 'menu-foot mono', text: FOOT_TEXT.settings });
  frame.append(head, body, foot);
  pauseRoot.append(frame);
  // 一時停止の画面の操作が視点入力へ漏れないように（v1 MenuUI と同じ）
  for (const ev of ['pointerdown', 'touchstart', 'touchmove'] as const) pauseRoot.addEventListener(ev, (e) => e.stopPropagation(), { passive: true, signal: listeners.signal });

  layer.append(reticle, hint, deviceHint, toastEl, mapBox, recParent, touchRoot, pauseRoot);
  root.append(layer);

  let lastHint = '';
  let tab: PauseTab = 'settings';
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const refs: UiRefs = {
    layer,
    input: { touchRoot, stick, knob, jump, dash, menu, crouch, map: mapBtn, flashlight, drop, tablet: tabletBtn },
    recParent,
    reticle,
    hint,
    settingsSlot,
    pause: { root: pauseRoot, title, resume, resumeLabel, help, foot, tabs, panes },
    minimap,
    survey,
    setHint(text: string): void {
      if (text === lastHint) return;
      lastHint = text;
      hint.textContent = text;
    },
    setDeviceHint(text: string): void {
      if (deviceHint.textContent !== text) deviceHint.textContent = text;
    },
    toast(text: string, ms = 3200): void {
      toastEl.textContent = text;
      toastEl.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.classList.remove('show'); toastTimer = null; }, ms);
    },
    setPauseVisible(visible: boolean): void {
      pauseRoot.hidden = !visible;
      mapBox.classList.toggle('under-pause', visible);
    },
    get pauseVisible(): boolean {
      return !pauseRoot.hidden;
    },
    setTab(t: PauseTab): void {
      tab = t;
      for (const x of PAUSE_TABS) {
        const on = x === t;
        tabs[x].classList.toggle('on', on);
        tabs[x].setAttribute('aria-selected', String(on));
        panes[x].hidden = !on;
      }
      frame.dataset.tab = t;
      foot.textContent = FOOT_TEXT[t];
      refs.onTabChange?.(t);
    },
    get tab(): PauseTab {
      return tab;
    },
    onTabChange: null,
    dispose(): void {
      listeners.abort();
      if (toastTimer) clearTimeout(toastTimer);
      layer.remove();
    },
  };
  for (const t of PAUSE_TABS) tabs[t].addEventListener('click', () => refs.setTab(t), { signal: listeners.signal });
  // 開いている間は 1 / 2 / 3 でタブ（選択欄・スライダーの操作中は除く）
  doc.defaultView?.addEventListener('keydown', (e) => {
    if (pauseRoot.hidden) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'SELECT' || target.tagName === 'INPUT')) return;
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0) { refs.setTab(PAUSE_TABS[i]!); e.preventDefault(); }
  }, { signal: listeners.signal });
  refs.setTab('settings');
  return refs;
}
