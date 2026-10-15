/**
 * 設定（localStorage。読めないときは既定）: タブレットの見せ方・マウスの感度・音量。URL の ?tablet=holo|glass が先
 */
import type { TabletMode } from '../tablet/TabletView.ts';

export interface Settings {
  tablet: TabletMode;
  sensitivity: number;
  volume: number;
}

const KEY = 'phl.settings.v1';
const DEFAULTS: Settings = { tablet: 'holo', sensitivity: 1, volume: 0.7 };

export function loadSettings(params: URLSearchParams): Settings {
  let s: Settings = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* 既定のまま */
  }
  const t = params.get('tablet');
  if (t === 'holo' || t === 'glass') s.tablet = t;
  if (s.tablet !== 'holo' && s.tablet !== 'glass') s.tablet = 'holo';
  return s;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 保存できない環境 */
  }
}
