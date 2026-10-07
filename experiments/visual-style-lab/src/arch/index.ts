import type { SceneEntry } from '../scenes/index.ts';

/**
 * 建築版の場面の一覧（arch.html）。参考画像の場所が「現実にあったらどういう建物か」を間取り図（plan）で決めてから作った版。
 * 元の版（index.html の場面）はそのまま残す。視点の名前（参考画像）は元の版と同じ。
 */
export const ARCH_SCENES: SceneEntry[] = [
  { id: 'corridor', label: '病院の病棟（建築版）', load: async () => (await import('./corridor.ts')).corridor },
  { id: 'station', label: '霧の駅（建築版）', load: async () => (await import('./station.ts')).station },
  { id: 'pool', label: '屋内プール（建築版）', load: async () => (await import('./pool.ts')).pool },
  { id: 'alley', label: '校舎の間の通路（建築版）', load: async () => (await import('./alley.ts')).alley },
  { id: 'pastel', label: '淡色の廊下（建築版）', load: async () => (await import('./pastel.ts')).pastel },
];
