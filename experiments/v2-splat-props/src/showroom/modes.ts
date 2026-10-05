/** 見本の部屋の表示（P で順に切り替える） */
export type Mode = 'splat' | 'mesh' | 'v2';
export const MODES: Mode[] = ['splat', 'mesh', 'v2'];
export const MODE_NAMES: Record<Mode, string> = { splat: 'スプラット（v2 の部屋 + 粒の物）', mesh: '同じ形のメッシュ（v2 の材質・照明）', v2: 'v2 の箱（いまの v2 の作り）' };
