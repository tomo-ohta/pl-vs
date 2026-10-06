/**
 * 調整表: 生成と仕掛けの数値をすべてここに置く（コードに数値を直書きしない。v2-plan.md 6.5）。
 *
 * - 値を恒久的に変える: 下の TUNING_SPEC の default を書き換える
 * - 一時的に上書きする: URL `?tune=secrets.perFloorMean=2,secrets.visibilityCheck=false`（parseTuneParam）
 * - 項目を足す: TUNING_SPEC に 1 行足すだけ（型・既定値・範囲・説明）。使う側は tuning['キー'] で読む
 *   段階 4 の担当ごとの項目は tuning/<担当>.ts に置き、下で TUNING_SPEC に重ねる（並行して書き換えてもぶつからないように）
 *
 * tuningVersion() は値の組から作る短い識別子。フロアの生成結果の保存に含め、値を変えても
 * 遊んでいる世界が勝手に作り変わらないようにする。
 */

import { bool, num, type BooleanSpec, type NumberSpec, type Spec } from './spec.ts';
import { MOVE_TUNING } from './tuning/move.ts';
import { GROUND_TUNING } from './tuning/ground.ts';
import { SENSE_TUNING } from './tuning/sense.ts';
import { ODDITY_TUNING } from './tuning/oddity.ts';
import { CARRY_TUNING } from './tuning/carry.ts';
import { WARP_TUNING } from './tuning/warp.ts';
import { STRUCTURE_TUNING } from './tuning/structure.ts';
import { ROOMS_TUNING } from './tuning/rooms.ts';
import { MAP_TUNING } from './tuning/map.ts';
import { WORLD_TUNING } from './tuning/world.ts';

export const TUNING_SPEC = {
  // ---- 隠し発見（v2-plan.md 4 章）----
  'secrets.perFloorMean': num(1.2, 0, 10, '1 フロアあたりの隠しの平均（ポアソン分布で引く。0 個のフロアもある）'),
  'secrets.perFloorMax': num(4, 0, 16, '1 フロアの隠しの上限', true),
  'secrets.depthGain': num(0, 0, 1, '深さ 1 階あたり、平均に足す量'),
  'secrets.rarityBonusLegendary': num(1, 0, 5, 'Legendary 以上のフロアで平均に足す量'),
  'secrets.nestChance': num(0.15, 0, 1, '隠し先の中に、さらに隠しを仕込む確率'),
  'secrets.maxNestDepth': num(2, 0, 4, '入れ子の深さの上限', true),
  'secrets.visibilityCheck': bool(true, '隠し場所が本道から見えないかを確かめる（時間がかかるなら省いてよい。ユーザー了承済み）'),
  'secrets.visibilityBudgetMs': num(4, 0, 200, '1 フロアの視線検査に使える時間（ms）。超えたら残りの検査を省く'),
  'secrets.visibilitySamples': num(64, 1, 1024, '本道の上で視線を調べる点の数', true),

  // 隠し方の型の重み（v2-plan.md 4.1。両方を使える仕掛けで引く。相対値）
  'secrets.mode.present': num(70, 0, 100, '存在型: 扉や穴は最初からあり、見えにくいだけ'),
  'secrets.mode.appear': num(30, 0, 100, '出現型: 条件を満たして初めて道や扉が現れる'),

  // 隠し先の中身の重み（v2-plan.md 4.6。相対値）
  'secrets.dest.rareRoom': num(25, 0, 100, '行き止まりのレア部屋'),
  'secrets.dest.passageRare': num(25, 0, 100, '隠し通路の先にレア部屋'),
  'secrets.dest.loop': num(30, 0, 100, '隠し通路がフロアの別の部屋へ抜ける（通り抜け）'),
  'secrets.dest.floorLink': num(12, 0, 100, '下のフロア（2 つ先）への穴'),
  'secrets.dest.bFloor': num(8, 0, 100, '裏のフロアへの穴'),
  'secrets.throughMin': num(1, 0, 4, '隠しが 2 つ以上のフロアで、行き止まりでない隠し（通り抜け・穴）の最低数', true),
  'secrets.passage.widthM': num(1.3, 1.0, 2.4, '隠し通路の幅（内側）'),
  'secrets.passage.maxLenM': num(14, 4, 30, '隠し通路の長さの上限（1 本の直線）'),
  'secrets.rare.white': num(14, 0, 100, 'レア部屋: 白い私室（大きすぎる椅子）'),
  'secrets.rare.theater': num(12, 0, 100, 'レア部屋: 小さな劇場'),
  'secrets.rare.pool': num(12, 0, 100, 'レア部屋: 水の部屋'),
  'secrets.rare.gallery': num(12, 0, 100, 'レア部屋: 展示室'),
  'secrets.rare.library': num(12, 0, 100, 'レア部屋: 書庫'),
  'secrets.rare.machine': num(10, 0, 100, 'レア部屋: 機械の部屋'),
  'secrets.rare.play': num(10, 0, 100, 'レア部屋: 遊戯室'),
  'secrets.rare.garden': num(10, 0, 100, 'レア部屋: 温室'),
  'secrets.rare.chapel': num(8, 0, 100, 'レア部屋: 長椅子の並ぶ部屋'),
  'secrets.rare.nook': num(4, 0, 100, 'レア部屋: 灯りの小部屋（ほかの部屋が収まらないときにも使う）'),

  // ---- フロア（v2-plan.md 5 章）----
  'floor.sizeM': num(70, 30, 200, '1 フロアの一辺の目安（m）'),
  'floor.baySpacingM': num(11, 6, 24, '区画の間隔（m）。部屋はこの中に収まり、残りが廊下になる [QR は 8]'),
  'floor.colsMin': num(3, 1, 12, '区画の格子の列の数（最小）', true),
  'floor.colsMax': num(5, 1, 12, '区画の格子の列の数（最大）', true),
  'floor.rowsMin': num(3, 1, 12, '区画の格子の行の数（最小）', true),
  'floor.rowsMax': num(5, 1, 12, '区画の格子の行の数（最大）', true),
  'floor.loopsPer10': num(2, 0, 10, '区画 10 個あたりに足すループの数（行き止まりばかりにしない）'),
  'floor.junctionChance': num(0.3, 0, 1, '部屋の代わりに曲がり角（廊下の交差）にする確率'),
  'floor.levelHeightM': num(1.6, 0.6, 4, '高さの違う区画の段差（m）。階段でつなぐ'),
  'floor.genRetries': num(6, 1, 30, '検証に通らなかったときに作り直す回数', true),
  'floor.roomDoorChance': num(0.92, 0, 1, '部屋（入口・出口の部屋を除く）の出入り口を扉にする確率（扉を開けるまで中が見えない）'),
  'floor.hallDoorChance': num(0.35, 0, 1, '広間の出入り口を扉にする確率'),

  // ---- 希少度（v1 第12回の値。v2-plan.md 2 章）。階によらず同じ重み（2026-10-06。前は Rare 以上に出る最小の深さがあった）----
  'rarity.w.common': num(33, 0, 100, 'Common の重み'),
  'rarity.w.uncommon': num(24, 0, 100, 'Uncommon の重み'),
  'rarity.w.rare': num(19, 0, 100, 'Rare の重み'),
  'rarity.w.epic': num(18, 0, 100, 'Epic の重み'),
  'rarity.w.legendary': num(4, 0, 100, 'Legendary の重み'),
  'rarity.w.mythic': num(6.5, 0, 100, 'Mythic の重み'),

  // ---- 仕掛けの置き方（gimmicks-and-structures.md 4.2・4.5）----
  'gimmick.chance.main': num(0.36, 0, 1, '本道の上の部屋に仕掛けを置く確率'),
  'gimmick.chance.side': num(0.45, 0, 1, '脇道の部屋（行き止まり・寄り道）に置く確率'),
  'gimmick.chance.hall': num(0.7, 0, 1, '広間に置く確率'),
  'gimmick.chance.corridor': num(0.3, 0, 1, '廊下に置く確率'),
  'gimmick.physicsMax': num(2, 0, 10, '1 フロアの物理を使う仕掛けの上限（重さ）', true),
  'gimmick.sameAxisMul': num(0.3, 0, 1, '本道で直前の仕掛けと作用の軸が同じときの重みの倍率'),
  'gimmick.intenseRunMul': num(0.4, 0, 1, '本道で強い仕掛け（強さ 2 以上）が続くときの重みの倍率'),
  'gimmick.secretBoost': num(3, 1, 20, '隠しの数に空きがある間、隠しを差し出す仕掛けの重みに掛ける倍率'),
  'gimmick.buildTries': num(3, 1, 8, '選んだ仕掛けがその部屋に組めないとき、次の候補を試す数（大きな仕掛けで部屋を空けない）', true),
  'gimmick.repeatMul': num(0.35, 0, 1, '同じフロアに同じ仕掛けがすでにあるとき、1 つごとに重みに掛ける倍率（同じものが続かないように）'),
  'gimmick.tilt.slideAt': num(0.55, 0.1, 1, '傾く床: 物が滑り出す傾き（最大の傾きに対する割合。摩擦をこの傾きに合わせる）'),
  'gimmick.tilt.maxDeg': num(24, 6, 40, '傾く床: 傾きの最大（度）'),
  'gimmick.tilt.rateDeg': num(4, 1, 15, '傾く床: 傾く速さ（度/秒。立ち止まらずに渡れば大きくは傾かない）'),
  'gimmick.tilt.slipDeg': num(13, 5, 40, '傾く床: この傾きを超えると、乗っている人が低い方へ滑る（度）'),
  'gimmick.tilt.slipSpeed': num(3.5, 0.5, 8, '傾く床: 最大の傾きで滑る速さ（m/s。歩いて登るのがやっと）'),
  'gimmick.tilt.trenchM': num(0.9, 0.6, 1.6, '傾く床: 開口も隠しも無い壁と板の間の、落ちる溝の幅（m）'),

  // ---- 仕掛けの作り（各仕掛けの数値。core/gen/gimmicks。仕掛けの担当がここに足す）----
  // 導く光の迷路（guideLight）
  'gimmick.maze.cellM': num(1.8, 1.6, 2.2, '導く光の迷路: 迷路の 1 マスの大きさ（m）。仕切りは天井まで'),
  'gimmick.maze.lightSpeed': num(1.2, 0.4, 3, '導く光の迷路: 光が進む速さ（m/s）'),
  'gimmick.maze.lead': num(2.2, 1, 6, '導く光の迷路: 光が先を行く距離（道に沿って m）。これより近づくと進む'),
  'gimmick.maze.waitDist': num(4, 2, 12, '導く光の迷路: これより遅れる・道から外れると光が待つ（道に沿って m）'),
  'gimmick.maze.ignoreSec': num(6, 1, 30, '導く光の迷路（出現型）: 迷路の中で光について行かない（道を外れる・遅れる）まま、行き止まりの扉が現れるまでの秒数'),
  'gimmick.maze.lightRange': num(4.5, 2, 10, '導く光の迷路: 光が照らす距離（m。仕切りの向こうへ漏れにくいよう短め）'),
  // 一方通行の歩道迷路（beltMaze）
  'gimmick.belt.speed': num(6.2, 5.8, 12, '一方通行の歩道: 帯の速さ（m/s）。ダッシュ（5.5）より速いので逆には進めない'),
  'gimmick.belt.padM': num(1.4, 1.2, 2, '一方通行の歩道: 乗り換えの床（分かれ目）の幅（m）'),
  'gimmick.belt.doorPadM': num(1.5, 1.3, 2.5, '一方通行の歩道: 開口の前の乗り換えの床の奥行き（m。扉を開ける間に帯へ流されない）'),
  'gimmick.belt.lenM': num(2.0, 1.0, 4, '一方通行の歩道: 帯の長さの目安（m）'),
  'gimmick.belt.railH': num(1.1, 0.95, 1.6, '一方通行の歩道: 柵の高さ（m）。跳んだ高さ（約 0.9 m）より高く'),
  'gimmick.belt.blockChance': num(0.25, 0, 0.6, '一方通行の歩道: 道順に要らない帯を柵で塞ぐ割合'),
  'gimmick.belt.fightSec': num(2.5, 0.5, 10, '一方通行の歩道（出現型）: 行き止まりの帯に逆らって歩き続けると扉が現れるまでの秒数'),
  // 穴の部屋（崩れる床・細い梁の網）
  'gimmick.pit.landingM': num(1.7, 1.3, 2.5, '穴の部屋: 開口の前の固い床の奥行き（m）'),
  'gimmick.pit.stairRise': num(0.24, 0.15, 0.33, '穴の部屋: 戻る階段の 1 段の高さの上限（m）'),
  'gimmick.pit.stairTread': num(0.3, 0.24, 0.45, '穴の部屋: 戻る階段の踏み面（m）'),
  'gimmick.pit.litM': num(3.4, 2.6, 6, '落ちる穴（14 章）: 穴の側壁のうち部屋の壁の続きの深さ（m。その下は暗い縦穴）'),
  'gimmick.pit.minGapM': num(5.6, 3, 9, '落ちる穴: 開口の前の固い床どうしがこれより近ければ、穴の上に低い下がり壁を付ける（m。走って跳んでも届かない間）'),
  'gimmick.pit.soffitM': num(2.05, 1.95, 2.4, '落ちる穴: 低い下がり壁の高さ（床から m。跳ぶと頭がつかえて遠くへ跳べない。歩いては通れる）'),
  'gimmick.pit.catwalkChance': num(0.5, 0, 1, '落ちる穴: 穴の中に下の細い足場（隠しへの道）がある確率'),
  'gimmick.pit.catwalkDepthM': num(2.4, 1.6, 3, '落ちる穴: 下の細い足場の深さ（床から m）'),
  // 崩れる床（crumbleFloor）
  'gimmick.crumble.depthM': num(2.8, 2.5, 3.05, '崩れる床: 穴の深さ（m。3.1 m 以上にすると隠し部屋が隣の区画の下に入り込む）'),
  'gimmick.crumble.tileM': num(0.9, 0.6, 1.5, '崩れる床: 床板の大きさ（m）'),
  'gimmick.crumble.gapM': num(0.09, 0.02, 0.2, '崩れる床: 床板の隙間（下の暗い穴が見える）'),
  'gimmick.crumble.standSec': num(0.3, 0.1, 2, '崩れる床: 道の床板に乗ってから揺れ始めるまで（秒。離れても止まらない。歩いて渡れば 1 枚あたり約 0.33 秒）'),
  'gimmick.crumble.shakeSec': num(0.45, 0.2, 3, '崩れる床: 揺れてから落ちるまで（秒）'),
  'gimmick.crumble.decoyChance': num(0.65, 0, 1, '崩れる床: 道でない所が、見せかけの床板（ひび。乗るとすぐ抜ける）である確率（残りは抜けている）'),
  'gimmick.crumble.restChance': num(0.5, 0, 1, '崩れる床: 道の真ん中に一息つける崩れない床板がある確率'),
  'gimmick.crumble.respawnSec': num(7, 2, 60, '崩れる床: 落ちた床板が戻るまで（秒。落ちて階段を上るあいだに戻る）'),
  // 細い道（narrowPath）・細い梁の網（beamNetwork）
  'gimmick.narrow.depthM': num(2.6, 2.1, 3.05, '細い道・梁の網: 溝の深さ（m）'),
  'gimmick.beams.widthM': num(0.46, 0.3, 0.8, '細い梁の網: 梁の幅（m）'),
  'gimmick.beams.platformM': num(1.0, 0.7, 1.6, '細い梁の網: 分かれ目の足場の大きさ（m）'),
  'gimmick.beams.gapM': num(1.7, 1.0, 3, '細い梁の網: 梁の長さの目安（m）'),
  'gimmick.beams.loopChance': num(0.12, 0, 0.5, '細い梁の網: 木の形の網に足す余分な梁の割合（回り道）'),

  // ---- 部屋まるごとの異変（docs/game-design.md 3 章。core/gen/anomaly。異変の担当がここに足す）----
  'anomaly.share.main': num(0.42, 0, 1, '本道の扉の向こうの部屋（仕掛けの部屋を含む）のうち、異変の部屋にする割合の目安。空いた部屋の数で確率を割り戻す'),
  'anomaly.share.side': num(0.35, 0, 1, '脇道の扉の向こうの部屋のうち、異変の部屋にする割合の目安'),
  'anomaly.chanceMax': num(0.9, 0, 1, '空いた部屋 1 つに異変を掛ける確率の上限'),
  'anomaly.openMul': num(0.25, 0, 1, '入口に扉の無い部屋・広間の確率の倍率（扉を開けた瞬間の驚きを優先する）'),
  'anomaly.runChanceMul': num(0.6, 0, 1, '本道で直前の部屋が異変の部屋のときの確率の倍率（間に普通の部屋を挟む）'),
  'anomaly.intenseAfterMul': num(0.25, 0, 1, '本道で直前の部屋が強い仕掛け・強い異変（強さ 2 以上）のとき、強い異変の重みの倍率'),
  'anomaly.sameRunMul': num(0, 0, 1, '本道で直前の部屋と同じ異変の重みの倍率（0 = 続けない）'),
  'anomaly.repeatMul': num(0.3, 0, 1, '同じフロアに同じ異変がすでにあるとき、1 つごとに重みに掛ける倍率'),
  // 異変ごとの出やすさ（相対値）
  'anomaly.w.flood': num(1, 0, 10, '浸水'),
  'anomaly.w.giant': num(1, 0, 10, '巨大な家具'),
  'anomaly.w.tiny': num(0.8, 0, 10, '小さな家具'),
  'anomaly.w.multiply': num(1, 0, 10, '増殖'),
  'anomaly.w.upsideDown': num(0.8, 0, 10, '逆さま（Uncommon 以上）'),
  'anomaly.w.stack': num(0.8, 0, 10, '積み上げ'),
  'anomaly.w.dark': num(1, 0, 10, '暗闇'),
  'anomaly.w.fog': num(0.9, 0, 10, '霧'),
  'anomaly.w.doors': num(0.7, 0, 10, '扉だらけ（Uncommon 以上）'),
  'anomaly.w.lowGravity': num(0.8, 0, 10, '軽い部屋'),
  'anomaly.w.ballSea': num(0.7, 0, 10, '物の海（物理を使う）'),
  'anomaly.w.tint': num(0.9, 0, 10, '色の異変'),
  'anomaly.w.scatter': num(0.9, 0, 10, '散乱'),
  'anomaly.w.clocks': num(0.5, 0, 10, '時計だらけ'),
  // 異変ごとの数値
  'anomaly.flood.depthMin': num(0.3, 0.1, 0.6, '浸水: 水深の下限（m）'),
  'anomaly.flood.depthMax': num(0.45, 0.1, 0.6, '浸水: 水深の上限（m）'),
  'anomaly.flood.slow': num(0.55, 0.2, 1, '浸水: 水の中の歩く速さの倍率'),
  'anomaly.giant.scaleMin': num(2.5, 1.5, 4, '巨大な家具: 倍率の下限'),
  'anomaly.giant.scaleMax': num(3, 1.5, 4, '巨大な家具: 倍率の上限'),
  'anomaly.giant.max': num(5, 1, 12, '巨大な家具: 残す家具の数の上限（残りは片付ける）', true),
  'anomaly.tiny.scale': num(0.3, 0.15, 0.6, '小さな家具: 倍率'),
  'anomaly.multiply.pitchMin': num(0.75, 0.6, 2, '増殖: 並べる間隔の下限（m）'),
  'anomaly.multiply.pitchMax': num(0.95, 0.6, 2, '増殖: 並べる間隔の上限（m）'),
  'anomaly.multiply.aisle': num(1.1, 0.9, 3, '増殖: 開口から開口への通路の幅（m）'),
  'anomaly.multiply.max': num(150, 10, 400, '増殖: 並べる数の上限（広い部屋は間隔を広げる）', true),
  'anomaly.stack.towers': num(3, 1, 4, '積み上げ: 塔の数の上限（収まらない家具は片付ける）', true),
  'anomaly.dark.lampIntensity': num(0.35, 0, 2, '暗闇: 遠くの小さな灯りの明るさ'),
  'anomaly.fog.near': num(0, 0, 5, '霧: 霧が掛かり始める距離（m。0 で目の前から少しずつ。近くはなんとか見える）'),
  'anomaly.fog.far': num(11, 1, 20, '霧: 何も見えなくなる距離（m。4 m で 3 割・7 m で 7 割ほど霞む）'),
  'anomaly.tint.red': num(1, 0, 10, '色の異変: 真っ赤な照明の重み'),
  'anomaly.tint.white': num(1, 0, 10, '色の異変: 色が抜けた（白い）部屋の重み'),
  'anomaly.lowGravity.scaleMin': num(0.35, 0.1, 1, '軽い部屋: 重さの倍率の下限'),
  'anomaly.lowGravity.scaleMax': num(0.45, 0.1, 1, '軽い部屋: 重さの倍率の上限'),
  'anomaly.lowGravity.float': num(4, 0, 12, '軽い部屋: 宙に浮かせる家具の数の上限', true),
  'anomaly.lowGravity.platformMinH': num(3.4, 2.5, 8, '軽い部屋: 宙の足場を置く天井の高さの下限（m）'),
  'anomaly.ballSea.max': num(100, 10, 300, '物の海: 転がる物（剛体）の数の上限', true),
  'anomaly.ballSea.sizeMin': num(0.5, 0.2, 0.8, '物の海: 玉の直径の下限（m）'),
  'anomaly.ballSea.sizeMax': num(0.65, 0.2, 0.8, '物の海: 玉の直径の上限（m）'),
  'anomaly.ballSea.doorClear': num(1.6, 1.2, 3, '物の海: 開口の前で玉を置かない奥行き（m）'),
  'anomaly.scatter.tipChance': num(0.6, 0, 1, '散乱: 家具を倒す確率'),
  'anomaly.scatter.moveM': num(1.2, 0, 3, '散乱: 家具をずらす距離の上限（m）'),
  'anomaly.doors.gap': num(0.25, 0.05, 1, '扉だらけ: 扉と扉の間（m）'),

  // ---- 物理（v2-plan.md 6.1）----
  'physics.tickHz': num(60, 30, 120, 'シミュレーションの固定 tick', true),
  'physics.maxBodiesDesktop': num(400, 0, 4000, '同時に動かす剛体の上限（PC）', true),
  'physics.maxBodiesMobile': num(120, 0, 2000, '同時に動かす剛体の上限（スマホ）', true),

  // ---- 段階 4 の担当ごとの調整値（tuning/*.ts）----
  ...MOVE_TUNING,
  ...GROUND_TUNING,
  ...SENSE_TUNING,
  ...ODDITY_TUNING,
  ...CARRY_TUNING,
  ...WARP_TUNING,
  ...STRUCTURE_TUNING,
  ...ROOMS_TUNING,
  ...MAP_TUNING,
  // 果てしない階（docs/endless-world.md）
  ...WORLD_TUNING,
} as const satisfies Record<string, Spec>;

export type TuningKey = keyof typeof TUNING_SPEC;
type ValueOf<S> = S extends NumberSpec ? number : S extends BooleanSpec ? boolean : never;
export type Tuning = { readonly [K in TuningKey]: ValueOf<(typeof TUNING_SPEC)[K]> };
export type TuningOverrides = { -readonly [K in TuningKey]?: Tuning[K] };

const KEYS = Object.keys(TUNING_SPEC) as TuningKey[];
const isKey = (k: string): k is TuningKey => Object.hasOwn(TUNING_SPEC, k);

export function defaultTuning(): Tuning {
  const t: Record<string, number | boolean> = {};
  for (const k of KEYS) t[k] = TUNING_SPEC[k].default;
  return t as Tuning;
}

/** 1 項目を検査して正規化する。範囲外は端に寄せず誤りにする（気づかないまま別の値で回らないように） */
function coerce(key: TuningKey, raw: unknown): { value?: number | boolean; error?: string } {
  const spec: Spec = TUNING_SPEC[key];
  if (spec.kind === 'boolean') {
    if (typeof raw === 'boolean') return { value: raw };
    if (raw === 'true' || raw === '1') return { value: true };
    if (raw === 'false' || raw === '0') return { value: false };
    return { error: `${key}: true / false を指定してください（${String(raw)}）` };
  }
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return { error: `${key}: 数値を指定してください（${String(raw)}）` };
  if (n < spec.min || n > spec.max) return { error: `${key}: ${spec.min}〜${spec.max} の範囲で指定してください（${n}）` };
  if (spec.integer && !Number.isInteger(n)) return { error: `${key}: 整数を指定してください（${n}）` };
  return { value: n };
}

/** 既定値に上書きを重ねる。誤った項目は無視して errors に返す */
export function makeTuning(overrides: Readonly<Record<string, unknown>> = {}): { tuning: Tuning; errors: string[] } {
  const t = defaultTuning() as Record<string, number | boolean>;
  const errors: string[] = [];
  for (const [k, raw] of Object.entries(overrides)) {
    if (!isKey(k)) { errors.push(`${k}: 調整表にない項目です`); continue; }
    const { value, error } = coerce(k, raw);
    if (error) errors.push(error); else if (value !== undefined) t[k] = value;
  }
  return { tuning: t as Tuning, errors };
}

/** URL の tune パラメータ（`a=1,b=false`）を上書きの組にする */
export function parseTuneParam(param: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (param ?? '').split(',')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/** 既定値と違う項目だけを取り出す（JSON への書き出し用） */
export function diffFromDefault(t: Tuning): TuningOverrides {
  const out: Record<string, number | boolean> = {};
  for (const k of KEYS) if (t[k] !== TUNING_SPEC[k].default) out[k] = t[k];
  return out as TuningOverrides;
}

/** 値の組の識別子（FNV-1a 32bit。キー順を固定して計算するので、項目の並びを変えても同じ値なら同じ） */
export function tuningVersion(t: Tuning): string {
  let h = 0x811c9dc5;
  for (const k of [...KEYS].sort()) {
    const s = `${k}=${t[k]};`;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  }
  return h.toString(16).padStart(8, '0');
}
