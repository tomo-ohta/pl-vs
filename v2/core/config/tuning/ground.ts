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
  // 沈む床（sinkFloor）・せり上がる床（riseFloor）・天秤の床（balanceRoom）・床下の明かり（underHatch）
  'ground.sink.depthM': num(3.0, 2.0, 6, '沈む床: 縦穴の深さ（m）'),
  'ground.sink.speed': num(0.35, 0.1, 1.5, '沈む床: 沈む・戻る速さ（m/s。ゆっくり）'),
  'ground.sink.gotoSec': num(1.2, 0.2, 5, '沈む床: 底で止まっていて、1 つ下のフロアへ移るまで（秒）'),
  'ground.rise.maxM': num(2.0, 1.3, 3, 'せり上がる床: 高い扉の高さの上限（m。天井の高さ − 2.25 m まで）'),
  'ground.rise.speed': num(0.45, 0.1, 1.5, 'せり上がる床: 上下の速さ（m/s）'),
  'ground.balance.holdSec': num(2, 0.5, 8, '天秤の床: 釣り合ってから間の床が下がり始めるまで（秒）'),
  'ground.hatch.depthM': num(2.4, 1.8, 3.05, '床下の明かり: 地下の小部屋の深さ（m）'),
  // 踏むと鳴る床（chimeTiles）・踏まない区画（avoidTiles）
  'ground.chime.tileM': num(1.1, 0.8, 1.6, '踏むと鳴る床: 升目の大きさ（m）'),
  'ground.chime.length': num(4, 3, 8, '踏むと鳴る床: 節の長さ（升目の数）', true),
  'ground.chime.demoSec': num(5, 2, 20, '踏むと鳴る床: 節を見せたあと、次に見せるまでの間（秒）'),
  'ground.avoid.tileM': num(1.0, 0.8, 1.6, '踏まない区画: 升目の大きさ（m）'),
  'ground.avoid.decoy': num(0.12, 0, 0.6, '踏まない区画: 道の外の升目のうち、白い（踏んでよい）おとりの割合'),
  'ground.visit.stopSec': num(0.6, 0.2, 3, '順番の区画: 印の上で立ち止まって「訪れた」になるまで（秒）'),
  // 光る床の迷路（glowMaze）・足跡が残る床（footLoop）・他人の足跡（strangerTrail）・水たまりの鏡（mirrorPuddle）
  'ground.glow.fadeSec': num(30, 5, 120, '光る床: 踏んだ所が光って消えるまで（秒）'),
  'ground.trail.stopSec': num(1.5, 0.5, 6, '足跡: 足跡の終わりで立ち止まって扉が現れるまで（秒）'),
  'ground.loop.corridorM': num(1.5, 1.2, 2.5, '足跡が残る床: 真ん中の塊のまわりの通路の幅（m）'),
  'ground.loop.prints': num(320, 40, 800, '足跡が残る床: 残る足跡の数の上限（古い物から消える）', true),
  'ground.mirror.gazeSec': num(1.2, 0.3, 5, '水たまりの鏡: 水面に映った扉を見続けて、本当の扉が現れるまで（秒）'),
  // 落ちてくる天井（ceilingPress）
  'ground.press.bandM': num(1.2, 0.8, 2.0, '落ちてくる天井: 落ちる天井の帯の奥行き（m）'),
  'ground.press.stripeM': num(1.0, 0.9, 2.0, '落ちてくる天井: 帯と帯の間の、落ちてこない床の幅（m。黄色の線の間）'),
  'ground.press.upSec': num(2.6, 1.6, 8, '落ちてくる天井: 上がっている間（秒）'),
  'ground.press.warnSec': num(1.0, 0.5, 3, '落ちてくる天井: 影と粉で予告する間（秒）'),
  'ground.press.fallSec': num(0.25, 0.1, 1, '落ちてくる天井: 落ち切るまで（秒）'),
  'ground.press.holdSec': num(0.9, 0.3, 3, '落ちてくる天井: 下りている間（秒）'),
  'ground.press.riseSec': num(1.4, 0.5, 4, '落ちてくる天井: 上がり切るまで（秒）'),
  'ground.press.safeSec': num(1.2, 0.8, 3, '落ちてくる天井: 歩く人が渡り始める、落ちてくるまでの残りの秒（予告の前）'),
  // 回る円盤（turntable）
  'ground.turn.depthM': num(2.0, 1.6, 3.05, '回る円盤: 穴の深さ（m）'),
  'ground.turn.pauseSec': num(4.5, 2.5, 10, '回る円盤: 橋が止まっている間（秒）'),
  'ground.turn.turnSec': num(5, 2, 12, '回る円盤: 橋が 90° 回るのに掛かる秒'),
  'ground.turn.needSec': num(2.6, 1.5, 5, '回る円盤: 歩く人が乗り降りを始める、止まっている残りの秒'),
  // 動く床タイル（slideTiles）
  'ground.slide.tileM': num(1.2, 1.0, 1.8, '動く床タイル: 床板の升目の大きさ（m）'),
  'ground.slide.depthM': num(2.4, 1.8, 3.05, '動く床タイル: 床板の下の溝の深さ（m）'),
  'ground.slide.holes': num(0.22, 0.1, 0.4, '動く床タイル: 空いた升目の割合'),
  'ground.slide.moveSec': num(1.2, 0.5, 4, '動く床タイル: 床板が隣の升目へ滑るのに掛かる秒'),
  'ground.slide.pauseSec': num(0.5, 0, 4, '動く床タイル: 滑り終えてから次の床板が滑り出すまで（秒）'),
} as const satisfies Record<string, Spec>;
