import type { SceneDef } from './types.ts';

/** 場面の一覧（1〜6 キーの順）。場面ごとに遅れて読み込む（1 つの場面の不具合が他を止めない） */
export interface SceneEntry {
  id: string;
  label: string;
  load: () => Promise<SceneDef>;
}

export const SCENES: SceneEntry[] = [
  { id: 'station', label: '霧の駅', load: async () => (await import('./station.ts')).station },
  { id: 'pool', label: '屋内プール', load: async () => (await import('./pool.ts')).pool },
  { id: 'corridor', label: '病院の廊下', load: async () => (await import('./corridor.ts')).corridor },
  { id: 'pastel', label: '淡色の廊下', load: async () => (await import('./pastel.ts')).pastel },
  { id: 'alley', label: '校舎の間の通路', load: async () => (await import('./alley.ts')).alley },
  { id: 'test', label: '基盤の確認', load: async () => (await import('./test.ts')).test },
];
