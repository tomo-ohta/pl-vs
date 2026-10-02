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
  // ドミノの橋（dominoBridge）
  'ground.domino.trenchM': num(1.9, 1.4, 2.6, 'ドミノの橋: 溝の幅（m。橋の棚の長さ = 幅 + 0.65 が天井に収まること）'),
  'ground.domino.depthM': num(2.4, 1.8, 3.05, 'ドミノの橋: 溝の深さ（m）'),
  'ground.domino.heightM': num(1.8, 1.2, 2.4, 'ドミノの橋: 鎖の棚の高さ（m。隣の棚との間 1 m より高く）'),
  // 箱の橋（crateBridge）
  'ground.crate.cellM': num(1.2, 1.2, 1.5, '箱の橋: 升目の大きさ（m。溝は 2 升の幅。下がり天井の下で、しゃがんで跳んでも 2.4 m は越えられない）'),
  'ground.crate.heightM': num(0.9, 0.6, 1.2, '箱の橋: 箱の高さ（m。溝の深さ = 高さ + 5 cm。落ちた箱の上面が床の高さ）'),
  'ground.crate.soffitM': num(1.8, 1.74, 1.9, '箱の橋: 溝の上の下がり天井の高さ（m。走って跳んでも頭が当たって溝を越えられない）'),
  'ground.crate.minPush': num(4, 1, 20, '箱の橋: 解くのに要る押す回数の下限', true),
  'ground.crate.maxPush': num(14, 2, 40, '箱の橋: 解くのに要る押す回数の上限', true),
  // 重りの床（weightBridge）
  'ground.weight.trenchM': num(2.4, 2.4, 3.2, '重りの床: 溝の幅（m。下がり天井の下で、跳んでも 2.4 m は越えられない）'),
  'ground.weight.depthM': num(1.8, 1.2, 3.0, '重りの床: 溝の深さ（m）'),
  'ground.weight.soffitM': num(1.8, 1.74, 1.9, '重りの床: 溝の上の下がり天井の高さ（m）'),
  'ground.weight.holdSec': num(0.8, 0.2, 4, '重りの床: 印から降りてから床板が沈み始めるまで（秒。走れば渡れ、歩くと沈む）'),
  'ground.weight.speed': num(1.6, 0.5, 4, '重りの床: 床板の上下の速さ（m/s）'),
  'ground.weight.buttonSec': num(6, 2, 20, '重りの床: 向こう岸のボタンで床板が上がっている秒数'),
  // 立ち止まると見える道・2 本目（stillPaths）
  'ground.still.trenchM': num(2.4, 2.4, 3.2, '立ち止まると見える道: 溝の幅（m）'),
  'ground.still.depthM': num(2.2, 1.6, 3.0, '立ち止まると見える道: 溝の深さ（m）'),
  'ground.still.soffitM': num(1.8, 1.74, 1.9, '立ち止まると見える道: 溝の上の下がり天井の高さ（m）'),
  'ground.still.firstSec': num(1.5, 0.5, 5, '立ち止まると見える道: 光の四角で止まって 1 本目の橋が現れるまで（秒）'),
  'ground.still.secondSec': num(6, 3, 20, '立ち止まると見える道: さらに長く止まって 2 本目の橋が現れるまで（秒。止まり始めてから）'),
} as const satisfies Record<string, Spec>;
