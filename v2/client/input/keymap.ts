/**
 * 操作のキーの割り当て（1 か所にまとめる。将来、設定でキーを変えられるようにするための入口）。
 * 値は KeyboardEvent.code。1 つの操作に複数のキーを割り当てられる。InputController.keymap を差し替えると、その割り当てで読む。
 * 案内の文字（操作の説明・タブレットの案内）も keyLabel / keysLabel でここから作る（割り当てを変えても案内がずれない）
 */

export type KeyAction =
  | 'forward' | 'back' | 'left' | 'right'
  | 'jump' | 'dash' | 'crouch'
  | 'interact' | 'flashlight' | 'drop' | 'menu' | 'map'
  /** タブレットを出す・しまう */
  | 'tablet'
  /** タブレットの画面で戻る（数字を入れている間は 1 文字消す） */
  | 'tabletBack'
  /** タブレットの画面で決める（探索の「移動」） */
  | 'tabletEnter';

export type KeyMap = Record<KeyAction, readonly string[]>;

export const DEFAULT_KEYMAP: Readonly<KeyMap> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  dash: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  interact: ['KeyE'],
  flashlight: ['KeyR'],
  drop: ['KeyQ'],
  menu: ['Escape'],
  map: ['KeyM'],
  tablet: ['Tab'],
  tabletBack: ['Backspace'],
  tabletEnter: ['Enter', 'NumpadEnter'],
};

/** 割り当ての写し（差し替える前に一部だけ変えるとき） */
export const copyKeymap = (m: Readonly<KeyMap> = DEFAULT_KEYMAP): KeyMap => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]])) as unknown as KeyMap;

/** code の操作（無ければ空） */
export function actionsOf(m: Readonly<KeyMap>, code: string): KeyAction[] {
  return (Object.keys(m) as KeyAction[]).filter((a) => m[a].includes(code));
}

const NAMES: Record<string, string> = {
  Space: 'Space', Escape: 'Esc', Tab: 'Tab', Backspace: 'Backspace', Enter: 'Enter', NumpadEnter: 'Enter',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

/** キーの表示名（KeyE → E・Digit1 → 1・Tab → Tab） */
export function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code];
  const m = /^(?:Key|Digit|Numpad)(.+)$/.exec(code);
  return m ? m[1]! : code;
}

/** 操作の最初のキーの表示名（案内用） */
export const keysLabel = (m: Readonly<KeyMap>, a: KeyAction): string => (m[a][0] ? keyLabel(m[a][0]) : '—');
