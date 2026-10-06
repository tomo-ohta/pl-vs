/**
 * 段階 4・地図と道案内・図鑑・調査率（2.14）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'map.<仕掛け・異変>.<数値>'（例: 'map.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import { num, type Spec } from '../spec.ts';

export const MAP_TUNING = {
  // ---- 地図（client/map。見た所だけ描く）----
  'map.seen.distM': num(14, 4, 40, '地図: 開口の向こうの区画を「見た」にする距離（開口まで m）'),
  'map.seen.coneDeg': num(65, 20, 180, '地図: 開口が視線からこの角度の中にあれば向こうを見たことにする（度。すぐ近くの開口は向きによらない）'),
  'map.seen.hops': num(2, 1, 4, '地図: 扉の無い開口を続けてたどる数（扉の向こうは 1 つだけ）', true),
  'map.seen.doorOpen': num(0.25, 0.02, 1, '地図: 扉がこれより開いていれば向こうが見える（開く角度の割合）'),
  'map.layer.riseM': num(1.8, 1, 6, '地図: 上下に重なる区画を別の層に分ける高さの差（m。これより小さい段差は同じ層）'),
  // ---- 調査率（N01）----
  'map.survey.tileM': num(2, 1, 4, '調査率: 区画の床を分ける升目の大きさ（m）'),
  'map.survey.radiusM': num(3, 1, 8, '調査率: 歩いた所からこの距離の升目を調べたことにする（m）'),
  'map.survey.cellFull': num(0.85, 0.5, 1, '調査率: 区画の升目のこの割合を調べると、その区画は調べ終わり（隅まで歩かなくてよい）'),
  // ---- 足跡（N06）----
  'map.trail.stepM': num(1.2, 0.4, 4, '足跡: 地図に足跡を 1 つ残す間隔（歩いた m）'),
  'map.trail.max': num(1500, 100, 6000, '足跡: 1 フロアに残す足跡の数の上限（古いものから消える）', true),
  // ---- 保存 ----
  'map.save.floors': num(160, 1, 400, '地図の保存: 覚えておくフロア（果てしない階は区域）の数（古いものから忘れる）', true),
  'map.save.regions': num(150, 1, 400, '地図の保存: 階の地図（果てしない階）に覚えておく区域の数（古いものから忘れる）', true),
  'map.save.trail': num(600, 50, 6000, '地図の保存: 区域・フロアごとに保存する足跡の数（新しいものから）', true),
  'map.story.keep': num(40, 2, 200, '階の地図: 地図の元を持っておく区域の数（超えたら古い区域から、見た所だけの写しにする）', true),
  'map.save.intervalSec': num(4, 1, 60, '地図の保存: 歩いている間の保存の間隔（秒）'),
  // ---- 地図が消える（N02 mapErase）----
  'map.erase.all': num(3, 0, 10, '地図が消える: 今いる部屋のほかを全部消す（重み）'),
  'map.erase.half': num(2, 0, 10, '地図が消える: 半分を消す（重み）'),
  'map.erase.far': num(2, 0, 10, '地図が消える: 遠くの部屋を消す（重み）'),
  'map.erase.farM': num(16, 4, 60, '地図が消える（遠く）: これより遠い区画を消す（m）'),
  'map.erase.sheets': num(48, 8, 120, '地図が消える: 壁と床の白紙の数の上限（箱の数）', true),
  // ---- 地図が回る（N03 mapRotate）----
  'map.rotate.driftDeg': num(20, 0, 60, '地図が回る: 部屋の中で地図がゆれる幅（度）'),
  'map.rotate.driftSec': num(24, 4, 120, '地図が回る: ゆれの周期（秒）'),
  'map.rotate.easeSec': num(0.8, 0.1, 5, '地図が回る: 回り始め・戻りの時間（秒）'),
  'map.rotate.holdSec': num(30, 0, 300, '地図が回る: 部屋を出てから地図が戻り始めるまで（秒。出てしばらくは回ったまま）'),
  // ---- 案内図（N07）・現在地の看板（N04）・他人の地図（N09）----
  'map.guide.chance': num(0.85, 0, 1, '案内図: 入口の部屋に案内図を置く確率'),
  'map.guide.hops': num(4, 1, 30, '案内図: 入口から開口をたどる数（これより先の廊下は描かない。フロア全部を描くと探す楽しみが減る）', true),
  'map.guide.lie.secret': num(3, 0, 10, '案内図の嘘: 隠し部屋の所に部屋を描く（重み。隠しのあるフロアだけ）'),
  'map.guide.lie.exit': num(1, 0, 10, '案内図の嘘: 出口の印を別の場所に描く（重み）'),
  'map.guide.lie.phantom': num(1.5, 0, 10, '案内図の嘘: 無い廊下を描く（重み）'),
  'map.guide.lie.missing': num(1.5, 0, 10, '案内図の嘘: ある廊下を描かない（重み）'),
  'map.here.chance': num(0.55, 0, 1, '現在地の看板: 1 フロアに置く確率'),
  'map.here.max': num(2, 0, 6, '現在地の看板: 1 フロアの数の上限', true),
  'map.here.radiusM': num(16, 6, 40, '現在地の看板: 看板に描く範囲の半径（m）'),
  'map.note.chance': num(0.45, 0, 1, '他人の地図: 1 フロアに落ちている確率'),
  'map.note.coverage': num(0.5, 0.1, 1, '他人の地図: 誰かが描いた区画の割合（入口から歩いた範囲）'),
  'map.note.wrongChance': num(0.3, 0, 1, '他人の地図: 書き込みの 1 つが勘違い（違う所に「出口」）になる確率'),
  // ---- 霧の中の塔（N05 fogTower）----
  'map.fogTower.fogNearM': num(0, 0, 5, '霧の中の塔: 霧が掛かり始める距離（m）'),
  'map.fogTower.fogFarM': num(10, 2, 20, '霧の中の塔: 何も見えなくなる距離（m。塔の灯りだけは霧を通して見える）'),
  'map.fogTower.pillarPer10': num(2.2, 0, 8, '霧の中の塔: 床 10 m² あたり 1 本の背の高い仕切り・柱の数（迷わせる）'),
  'map.fogTower.awayM': num(9, 3, 30, '霧の中の塔（出現型の隠し）: 塔からこれより離れて'),
  'map.fogTower.awaySec': num(8, 1, 60, '霧の中の塔（出現型の隠し）: 霧の奥にいる秒数'),
  'map.fogTower.blinkSec': num(1.6, 0.3, 6, '霧の中の塔: 塔の灯りの明滅の周期（秒）'),
  // ---- 地図の空白の壁（BX04 mapBlank）----
  'map.blank.dwellSec': num(1.5, 0.3, 10, '地図の空白: 空白の壁の前で立ち止まって、壁が扉になるまでの秒数（調べても開く）'),
} as const satisfies Record<string, Spec>;
