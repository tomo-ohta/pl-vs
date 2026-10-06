/**
 * 遊ぶ人の名前（?name= か、設定の名前。無ければ既定の呼び名「あなた」）。部屋の異変「自分の名前」の掲示・SNS の投稿者名に使う
 */
import { cleanName, Settings } from './Settings.ts';

export const DEFAULT_PLAYER_NAME = 'あなた';

export function playerName(): string {
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('name') : null;
    if (q && cleanName(q)) return cleanName(q);
    const s = typeof localStorage !== 'undefined' ? Settings.load().data.playerName : '';
    if (s) return s;
  } catch { /* 保存先が無い */ }
  return DEFAULT_PLAYER_NAME;
}
