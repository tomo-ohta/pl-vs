/**
 * 段階 4・床と足場・装置（2.4・2.11）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'ground.<仕掛け・異変>.<数値>'（例: 'ground.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import { num, type Spec } from '../spec.ts';

export const GROUND_TUNING = {
  // 崩れていく帰り道（collapseRun）
  'ground.collapse.depthM': num(2.8, 2.4, 3.05, '崩れていく帰り道: 穴の深さ（m）'),
  'ground.collapse.tileM': num(1.0, 0.6, 1.6, '崩れていく帰り道: 床板の大きさ（m）'),
  'ground.collapse.delaySec': num(0.1, 0, 2, '崩れていく帰り道: 装置に触れてから崩れ始めるまで（秒）'),
  'ground.collapse.shakeSec': num(0.3, 0.1, 2, '崩れていく帰り道: 崩れの前線が来てから床板が落ちるまで（秒。揺れて見せる）'),
  'ground.collapse.margin': num(0.5, 0, 1, '崩れていく帰り道: 前線の速さ（0 = 歩く人をぎりぎり捕まえる / 1 = 走る人をぎりぎり逃がす。部屋の奥行きから速さを決める）'),
  'ground.collapse.speedMin': num(3.4, 2, 8, '崩れていく帰り道: 前線の速さの下限（m/s）'),
  'ground.collapse.speedMax': num(10, 2, 14, '崩れていく帰り道: 前線の速さの上限（m/s。浅い部屋ほど速い）'),
  'ground.collapse.restoreSec': num(8, 2, 60, '崩れていく帰り道: 全部落ちてから床板が戻るまで（秒。落ちて階段を上るあいだに戻る）'),
} as const satisfies Record<string, Spec>;
