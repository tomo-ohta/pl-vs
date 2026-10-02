/**
 * 画面の部品（DOM）を作る。v1 は index.html に HUD・スマホの操作・メニューの枠を書いていた（v1 index.html）。v2 ではコードで作る。
 * 見た目は ui/style.css（v1 src/style.css から移植）。このファイルは CSS を import しない（main.ts で `import './ui/style.css';`）。
 *
 * 作るもの（すべて layer = root に足した 1 つの div の下。位置は各要素の position: fixed）:
 *   - 照準の点（#reticle）と 1 行の案内（#hud-hint。空なら隠れる）
 *   - スマホの操作（#touch-ui。PC では hidden。InputController がスマホと判定したら出す）:
 *     左下スティック、右下 しゃがむ（切替）・ジャンプ・ダッシュ、右上 メニュー。ビデオカメラの画面の四隅の枠 + 人型ピクトグラム（v1 と同じ SVG）
 *   - 一時停止の画面（#pause。最初は hidden）: ❚❚ PAUSE・題（title）・「再開」・設定パネルの差し込み口（#settings-slot）・操作の案内
 *   - RecOverlay の親（recParent。RecOverlay が自分で #rec-overlay を作る）
 * v1 にあって作らないもの: 部屋名 HUD・ミニマップ・デバッグ表示・暗転（#fade）・開始画面・マップ / フロアリストのタブ（v1 WorldManager に依存。作り直す）
 *
 * 統合担当向け: 呼び出し方
 *   import './ui/style.css';
 *   const ui = mountUi(document.body);
 *   const input = new InputController(canvas, ui.input);
 *   const rec = new RecOverlay(ui.recParent);
 *   const panel = new SettingsPanel(settings, { slot: ui.settingsSlot });
 *   ui.pause.resume.addEventListener('click', () => { audio.unlock(); input.requestLock(); ui.setPauseVisible(false); ... });  // ユーザージェスチャ内
 *   ui.setPauseVisible(true);                // メニューを開く（v1: input.enabled = false; input.exitLock(); audio.ui('open')）
 *   ui.pause.title.textContent = 'B2F …';    // 題（既定 'LIMINAL'。v1 は今いるフロアの名前を出していた）
 *   ui.pause.resumeLabel.textContent = '始める'; // ボタンの文字（resume.textContent を書き換えると ▶ が消える）
 *   ui.setHint('E: 扉を開ける');             // '' で消す
 */
import type { InputUi } from '../input/InputController.ts';

export interface PauseRefs {
  /** 一時停止の画面の一番外側（#pause。表示は UiRefs.setPauseVisible） */
  readonly root: HTMLElement;
  /** 題（❚❚ PAUSE の右。textContent を書き換えてよい） */
  readonly title: HTMLElement;
  /** 「再開 ▶」ボタン（click はゲーム側で受ける） */
  readonly resume: HTMLButtonElement;
  /** ボタンの文字（「再開」。開始前の「始める」などに書き換えるときはこちら。▶ は残る） */
  readonly resumeLabel: HTMLElement;
  /** 操作の案内（右列。書き換え・hidden にしてよい） */
  readonly help: HTMLElement;
  /** 一番下の 1 行（キーの案内。スマホでは隠れる） */
  readonly foot: HTMLElement;
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
  /** SettingsPanel の差し込み口（一時停止の画面の中。new SettingsPanel(settings, { slot: ui.settingsSlot })） */
  readonly settingsSlot: HTMLElement;
  readonly pause: PauseRefs;
  /** 案内を出す（'' で消す。同じ文字列なら DOM を触らない） */
  setHint(text: string): void;
  /** 一時停止の画面を出す / 隠す */
  setPauseVisible(visible: boolean): void;
  readonly pauseVisible: boolean;
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

/** 操作の案内（v1 の開始画面と同じ文言） */
const HELP_LINES: [string, string][] = [
  ['PC', 'WASD 移動 / マウス 視点 / Space ジャンプ / Shift ダッシュ / Ctrl または C しゃがみ / E 扉を開ける / R 懐中電灯 / Esc メニュー'],
  ['スマホ', 'スワイプ 視点 / 左下スティック 移動 / 扉をタップ / 右下 ダッシュ・ジャンプ・しゃがむ（切替） / 右上 メニュー'],
];
const FOOT_TEXT = 'Esc 再開 ・ 設定はすぐに保存されます';

/** 画面の部品を作って root（ふつうは document.body）に足す */
export function mountUi(root: HTMLElement): UiRefs {
  const doc = root.ownerDocument;
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
  touchRoot.append(stick, crouch, jump, dash, menu);

  // ---- 一時停止の画面（v1 第21回のメニューの枠: 四隅の枠・❚❚ PAUSE・走査線）
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
  head.append(osd);
  const body = el('main', { className: 'menu-body' });
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
  body.append(grid);
  const foot = el('footer', { className: 'menu-foot mono', text: FOOT_TEXT });
  frame.append(head, body, foot);
  pauseRoot.append(frame);
  // 一時停止の画面の操作が視点入力へ漏れないように（v1 MenuUI と同じ）
  for (const ev of ['pointerdown', 'touchstart', 'touchmove'] as const) pauseRoot.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  layer.append(reticle, hint, recParent, touchRoot, pauseRoot);
  root.append(layer);

  let lastHint = '';
  return {
    layer,
    input: { touchRoot, stick, knob, jump, dash, menu, crouch },
    recParent,
    reticle,
    hint,
    settingsSlot,
    pause: { root: pauseRoot, title, resume, resumeLabel, help, foot },
    setHint(text: string): void {
      if (text === lastHint) return;
      lastHint = text;
      hint.textContent = text;
    },
    setPauseVisible(visible: boolean): void {
      pauseRoot.hidden = !visible;
    },
    get pauseVisible(): boolean {
      return !pauseRoot.hidden;
    },
    dispose(): void {
      layer.remove();
    },
  };
}
