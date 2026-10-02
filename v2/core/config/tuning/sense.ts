/**
 * 段階 4・光・音・視線・時間（2.6〜2.9）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'sense.<仕掛け・異変>.<数値>'（例: 'sense.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import { num, type Spec } from '../spec.ts';

export const SENSE_TUNING = {
  // ---- 光の床の部屋（gimmicks/sense/lightfloor.ts）----
  'sense.lightPit.depthM': num(2.4, 2.0, 3.0, '光の床の部屋: 穴の深さ（m）'),
  'sense.beamFloor.tileM': num(0.6, 0.4, 1.2, '照らした所だけある床: 床板の大きさ（m）'),
  'sense.beamFloor.graceSec': num(1.4, 0.3, 4, '照らした所だけある床: 照らすのをやめてから床板が消えるまで（秒。歩いて足元まで来る間はある）'),
  'sense.beamFloor.deg': num(26, 10, 40, '照らした所だけある床: 床を作る光の円錐の半角（度。懐中電灯の明るい芯の大きさ）'),
  'sense.beamFloor.rangeM': num(8, 3, 20, '照らした所だけある床: 床を作る光の届く距離（m）'),
  'sense.spotRide.radiusM': num(1.05, 0.7, 2, '動く光の中だけ床: 光の円の半径（m）'),
  'sense.spotRide.speed': num(0.85, 0.3, 2.5, '動く光の中だけ床: 光の円の速さ（m/s。歩くより遅い）'),
  'sense.spotRide.pauseSec': num(2.5, 0.5, 8, '動く光の中だけ床: 両端で止まる秒数（乗り降りする間）'),
  'sense.spotRide.tileM': num(0.5, 0.3, 1, '動く光の中だけ床: 床板の大きさ（m）'),
  'sense.lightBands.widthM': num(0.75, 0.5, 1.4, '光の帯の橋: 帯の幅（m）'),
  'sense.lightBands.gapM': num(0.45, 0.2, 1.2, '光の帯の橋: 帯の間（m。隣の帯へ乗り移れる）'),
  'sense.lightBands.onSec': num(4.5, 2, 12, '光の帯の橋: 帯が点いている秒数（長い穴では、歩いて渡り切れる長さまで延ばす）'),
  'sense.lightBands.offSec': num(2.5, 0.5, 8, '光の帯の橋: 帯が消えている秒数'),
  'sense.lightBands.warnSec': num(1.0, 0, 3, '光の帯の橋: 消える前に瞬く秒数'),
  'sense.lookBridge.widthM': num(1.0, 0.6, 1.6, '見ている間だけある橋: 橋の幅（m）'),
  'sense.lookBridge.graceSec': num(0.9, 0.2, 3, '見ている間だけある橋: 目を離してから橋の板が消えるまで（秒）'),

  // ---- 闇に捕まる部屋（gimmicks/sense/dark.ts）----
  'sense.blinkout.onSec': num(5.5, 2, 15, '消える照明: 照明が点いている秒数'),
  'sense.blinkout.offSec': num(3.0, 1, 10, '消える照明: 照明が消えている秒数'),
  'sense.blinkout.flickerSec': num(0.9, 0, 3, '消える照明: 消える前に瞬く秒数（合図）'),
  'sense.blinkout.graceSec': num(1.3, 0.5, 5, '消える照明: 暗闇にこれだけいると闇に捕まる（秒）'),
  'sense.blinkout.poolM': num(1.1, 0.7, 2, '消える照明: 消えない灯りの島の半径（m）'),
  'sense.blinkout.spacingM': num(4.2, 2.5, 8, '消える照明: 消えない灯りの島の間隔（道に沿って m）'),
  'sense.lightWave.segmentM': num(2.0, 1, 4, '明滅の位相: 照明の区間の長さ（m）'),
  'sense.lightWave.speed': num(1.5, 0.6, 2.6, '明滅の位相: 光の波の速さ（m/s。歩くより遅い）'),
  'sense.lightWave.windowM': num(3.2, 2, 6, '明滅の位相: 点いている帯の長さ（m）'),
  'sense.lightWave.restSec': num(3, 0, 10, '明滅の位相: 波と波の間の、全部消えている秒数'),
  'sense.lightWave.graceSec': num(1.0, 0.4, 4, '明滅の位相: 暗闇にこれだけいると闇に捕まる（秒）'),
  'sense.lightWave.doorPoolM': num(1.3, 0.8, 2, '明滅の位相: 開口の前の消えない灯りの半径（m）'),

  // ---- サーチライト（gimmicks/sense/search.ts）----
  'sense.search.stripM': num(1.6, 1.2, 3, 'サーチライト: 入口・出口の壁沿いの安全な床の奥行き（m）'),
  'sense.search.laneM': num(1.8, 1.2, 3, 'サーチライト: 光の円が往復する帯の幅（m）'),
  'sense.search.safeM': num(1.4, 1, 3, 'サーチライト: 帯と帯の間の安全な床の最小の幅（m）'),
  'sense.search.radiusM': num(0.9, 0.5, 1.6, 'サーチライト: 光の円の半径（m）'),
  'sense.search.speedMin': num(1.6, 0.5, 5, 'サーチライト: 光の円の速さの下限（m/s）'),
  'sense.search.speedMax': num(2.6, 0.5, 6, 'サーチライト: 光の円の速さの上限（m/s）'),
  'sense.search.catchesToCorner': num(2, 1, 10, 'サーチライト: これだけ見つかると、戻される先が隅（隠しの扉の前）になる', true),

  // ---- 幕の部屋（gimmicks/sense/curtains.ts）----
  'sense.curtains.spacingM': num(1.5, 1.2, 2.5, '幕の部屋: 幕の口の間隔（m）'),

  // ---- 視線と観測（gimmicks/sense/sight.ts）----
  'sense.daruma.chantMin': num(2.4, 1, 8, 'だるまさん: 数え歌の長さの下限（秒）'),
  'sense.daruma.chantMax': num(5.0, 1, 10, 'だるまさん: 数え歌の長さの上限（秒）'),
  'sense.daruma.watchMin': num(1.8, 0.5, 6, 'だるまさん: 振り返って見ている長さの下限（秒）'),
  'sense.daruma.watchMax': num(3.2, 0.5, 8, 'だるまさん: 振り返って見ている長さの上限（秒）'),
  'sense.daruma.tolM': num(0.15, 0.05, 0.6, 'だるまさん: 見られている間に動いてよい距離（m。止まりきれない分）'),
  'sense.daruma.catchesToCorner': num(3, 1, 10, 'だるまさん: これだけ捕まると、入口ではなく隅（隠しの扉の前）へ連れて行かれる', true),
  'sense.clock.cycleSec': num(30, 10, 120, '見ていない間だけ進む時計: 見ていない間に針が 12 時間回る秒数'),
  'sense.clock.windowH': num(0.35, 0.1, 1.5, '見ていない間だけ進む時計: 12 時の前後この時間（時）の間に見ると、扉の鍵が開く'),
  'sense.clock.openSec': num(6, 2, 20, '見ていない間だけ進む時計: 鍵が開いている秒数'),
  'sense.clock.goneSec': num(45, 10, 180, '見ていない間だけ進む時計（BO03）: 一度も見ないまま部屋にこれだけいると、時計が消えて跡が扉になる'),
  'sense.zoom.sec': num(1.5, 0.5, 5, 'ズームで注視: 立ち止まって看板を見つめ続ける秒数（撮像がズームして小さな文字が読める）'),
  'sense.zoom.deg': num(4, 1.5, 10, 'ズームで注視: 看板を見つめている判定の角度（度）'),
  'sense.gaze.sec': num(1.6, 0.5, 5, 'マネキンの視線の先・鏡の扉など: 見つめ続ける秒数'),
  'sense.lookBack.sec': num(1.0, 0.3, 4, '出口の前で振り返る: 来た道を見ている秒数'),
  'sense.cctv.watchSec': num(2.0, 0.5, 6, '監視カメラ: モニターを見つめる秒数（自分のいない所の扉が開いているのを見る）'),

  // ---- 音（gimmicks/sense/sound.ts）----
  'sense.chime.intervalSec': num(0.7, 0.3, 2, '音をつなぐ扉: 旋律の音と音の間（秒）'),
  'sense.chime.periodSec': num(11, 5, 40, '音をつなぐ扉: 旋律をくり返す間隔（秒）'),
  'sense.gate.loudLevel': num(0.55, 0.2, 0.95, 'マイクで開く扉: 開く音量（0..1。走る 0.7・跳んで着地 1.0・歩く 0.35）'),
  'sense.gate.quietLevel': num(0.08, 0.01, 0.3, '静かにすると開く: これより静かな間を数える（0..1）'),
  'sense.gate.quietSec': num(3, 1, 10, '静かにすると開く: 静かにしている秒数'),
  'sense.steps.sneakSec': num(3, 1, 10, '足音が増える（BA02）: しゃがんで歩き続ける秒数'),
  'sense.pa.periodSec': num(6, 3, 20, '遠くの館内放送: 放送をくり返す間隔（秒）'),
  'sense.living.leanSec': num(4, 1.5, 12, '壁の向こうの生活音（BA04）: 壁にもたれて止まる秒数'),
  'sense.silent.sec': num(3, 1, 10, '無音の隅（BA01）: 無音の隅で止まる秒数'),
  'sense.maze.cellM': num(1.8, 1.6, 2.4, '音で形を知る迷路: 迷路の 1 マス（m）'),
  'sense.maze.dripSec': num(2.2, 0.8, 6, '反響で形が分かる: 出口の前の水の音の間隔（秒）'),
  'sense.pitch.fogNear': num(0.4, 0, 2, '音の高さの部屋: 霧の掛かり始め（m）'),
  'sense.pitch.fogFar': num(2.8, 1.5, 8, '音の高さの部屋: 何も見えなくなる距離（m）'),
} as const satisfies Record<string, Spec>;
