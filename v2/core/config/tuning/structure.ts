/**
 * 段階 4・フロアの形・部屋の形（2.1・2.2 の構造）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'structure.<仕掛け・異変>.<数値>'（例: 'structure.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 *
 * フロアの形の型（core/gen/floor/themes.ts の PatternId）の出やすさは、系統（FloorFamily.patterns）の重み × structure.w.<型>。
 * 珍しい型は珍しいフロアにだけ出る（themes.ts の PATTERN_INFO の minRarity）。
 */
import { num, type Spec } from '../spec.ts';

export const STRUCTURE_TUNING = {
  // ---- 型ごとの出やすさの倍率（系統の重みに掛ける。0 で出ない）----
  'structure.w.chain': num(1, 0, 10, 'くねる部屋の連なり（F03）'),
  'structure.w.courtyard': num(1, 0, 10, '中庭を囲む（F05）'),
  'structure.w.shortcut': num(1, 0, 10, '二重ループ・奥から開く近道（F06）'),
  'structure.w.loops': num(1, 0, 10, '入れ子のループ（F07）'),
  'structure.w.concentric': num(1, 0, 10, '同心円（F11）'),
  'structure.w.spiral': num(1, 0, 10, '螺旋（F12）'),
  'structure.w.skip': num(1, 0, 10, 'スキップフロア（F13）'),
  'structure.w.gallery': num(1, 0, 10, '中二階（F14）'),
  'structure.w.crossing': num(1, 0, 10, '立体交差（F15）'),
  'structure.w.islands': num(1, 0, 10, '島と橋（F16）'),
  'structure.w.nest': num(1, 0, 10, '入れ子の部屋（F17）'),
  'structure.w.megahall': num(1, 0, 10, '巨大空間の中の建物（F18）'),
  'structure.w.mirror': num(1, 0, 10, '鏡写し（F19）'),
  'structure.w.shrink': num(1, 0, 10, '縮むくり返し（F20）'),
  'structure.w.staff': num(1, 0, 10, '表と裏の動線（F21）'),
  'structure.w.crawl': num(1, 0, 10, '天井裏の這う網（F22）'),
  'structure.w.tower': num(1, 0, 10, '縦に積んだビル（F23）'),
  'structure.w.elevator': num(1, 0, 10, 'エレベーターホールの中心（F24）'),
  'structure.w.descent': num(1, 0, 10, '下るだけのフロア（F29）'),
  'structure.w.shaft': num(1, 0, 10, '吹き抜けの縦穴（F31）'),
  'structure.w.rooftop': num(1, 0, 10, '屋上（F33）'),
  'structure.w.arcade': num(1, 0, 10, '地下街（F34）'),
  'structure.w.wings': num(1, 0, 10, '分棟（F02）'),

  // ---- 上下に重なる形（縦に積んだビル・螺旋・立体交差・中二階・天井裏）----
  'structure.storyHeightM': num(4.4, 4.0, 6, '階の高さ（床から上の階の床まで。m）。上下に重なる区画の間は、天井 + 床板 + 余裕'),
  'structure.towerStoriesMin': num(2, 2, 4, '縦に積んだビル・エレベーターホールの階の数（最小）', true),
  'structure.towerStoriesMax': num(3, 2, 4, '縦に積んだビル・エレベーターホールの階の数（最大）', true),
  'structure.wellDoorChance': num(0.8, 0, 1, '階段室の出入り口を防火扉にする確率（扉でないときは開口）'),

  // ---- 区画をつなぐ（廊下の無い型・屋外の渡り廊下・橋）----
  'structure.chain.spacingM': num(8.5, 7, 12, 'くねる部屋の連なり・中庭を囲む部屋の区画の間隔（m）。部屋は区画いっぱいで、隣と壁 1 枚でつながる'),
  'structure.chain.branchChance': num(0.25, 0, 1, 'くねる部屋の連なり: 本道の部屋から、行き止まりの部屋へ枝分かれする確率'),
  'structure.chain.loopChance': num(0.12, 0, 1, 'くねる部屋の連なり: 隣り合う部屋どうしに、もう 1 つ扉を足す確率（回り道）'),
  'structure.railM': num(1.1, 1.0, 1.4, '手すり・胸壁の高さ（m）。跳んだ足の高さ（約 0.9 m）より高く、越えられない'),
  'structure.walkway.widthM': num(2.2, 1.6, 3.2, '分棟の渡り廊下の幅（m）'),
  'structure.bridge.widthM': num(1.7, 1.4, 2.4, '島と橋の橋の幅（m）'),
  'structure.outdoor.fogNear': num(3, 0, 20, '屋外（渡り廊下・屋上）の霧の始まり（m）'),
  'structure.outdoor.fogFar': num(26, 8, 80, '屋外（渡り廊下・屋上）の霧の果て（m）'),

  // ---- 型ごとの数値 ----
  'structure.concentric.innerWidthM': num(1.5, 1.2, 2.4, '同心円: いちばん内側の輪の廊下の幅（m）'),
  'structure.concentric.innerLight': num(0.35, 0.05, 1, '同心円: いちばん内側の明るさの倍率（外ほど 1 に近い）'),
  'structure.skip.spacingM': num(13, 11, 18, 'スキップフロア: 区画の間隔（m。半階の階段が収まるように広め）'),
  'structure.staff.widthM': num(1.4, 1.2, 2.0, '表と裏の動線: 従業員用の通路の幅（m）'),
  'structure.staff.heightM': num(2.3, 2.1, 2.6, '表と裏の動線: 従業員用の通路の天井の高さ（m）'),
  'structure.staff.backDoorChance': num(0.5, 0, 1, '表と裏の動線: 客用の部屋に、裏の通路への扉を付ける確率'),
  'structure.descent.dropM': num(1.6, 1.3, 3.2, '下るだけのフロア: 1 回の飛び降りの高さ（m。跳んでも上がれない）'),
  'structure.descent.spacingM': num(12, 10, 16, '下るだけのフロア: 区画の間隔（m）'),
  'structure.maze.extraExits': num(2, 0, 3, '迷路フロア: 出口の階段の数（本来の出口に足す数。それぞれ行き先が違う）', true),
  'structure.linear.narrowWidthM': num(1.25, 1.1, 2.0, '緊張と解放: 狭い通路の幅（m）'),
  'structure.linear.narrowHeightM': num(2.15, 2.0, 2.6, '緊張と解放: 狭い通路の天井の高さ（m）'),
  'structure.linear.wideHeightM': num(6, 4, 10, '緊張と解放: 広い空間の天井の高さ（m）'),
  'structure.arcade.widthM': num(4.0, 3.6, 5.5, '地下街: 通路の幅の下限（m。真ん中に柱の列が立つ）'),
  'structure.arcade.heightM': num(2.75, 2.4, 3.2, '地下街: 通路の天井の高さの上限（m。広くて低い）'),
  'structure.nest.depth': num(3, 2, 4, '入れ子の部屋: 部屋の入れ子の数（いちばん外の部屋を含む）', true),
  'structure.megahall.heightM': num(9, 6, 14, '巨大空間: 天井の高さ（m）'),
  'structure.building.heightM': num(2.6, 2.4, 3.2, '巨大空間の中の建物・屋上の小屋の天井の高さ（m）'),
  'structure.mirror.diffs': num(1, 1, 3, '鏡写し: 左右で違う所の数', true),
  'structure.mirror.cleanPairs': num(2, 0, 4, '鏡写し: 仕掛け・異変を置かず、家具まで鏡に写す対の部屋の数（入口に近い順）', true),
  'structure.shrink.ratio': num(0.84, 0.7, 0.95, '縮むくり返し: くり返すたびに掛ける大きさの倍率'),
  'structure.shrink.count': num(5, 3, 7, '縮むくり返し: くり返しの数', true),
  'structure.shrink.minHeightM': num(1.15, 1.0, 1.6, '縮むくり返し: 天井の高さの下限（m。しゃがむ高さ 0.85 m より高く）'),
  'structure.shrink.lastHeightM': num(1.5, 1.15, 1.65, '縮むくり返し: 最後の部屋の天井の高さの目安（m。立った高さ 1.7 m より低く、しゃがんで進む）'),
  'structure.crawl.heightM': num(1.0, 0.95, 1.3, '天井裏の這う網: 這う通路の天井の高さ（m。立てない）'),
  'structure.crawl.widthM': num(1.2, 1.0, 1.6, '天井裏の這う網: 這う通路の幅（m）'),
  'structure.crawl.hatches': num(3, 2, 5, '天井裏の這う網: 天井の点検口（上り下りの梯子段）の数', true),
  'structure.gallery.upperRooms': num(3, 1, 5, '中二階: 中二階から入る上の階の部屋の数', true),
  'structure.shaft.levels': num(3, 1, 5, '吹き抜けの縦穴: 上と下に見える、ほかの階の回廊の数（それぞれ）', true),
  'structure.spiral.laps': num(3, 2, 4, '螺旋: 吹き抜けの周りを回る数', true),
  'structure.spiral.voidM': num(7, 5, 12, '螺旋: 吹き抜けの一辺（m）'),
  'structure.elevator.rideSec': num(3.5, 1, 10, 'エレベーター: 乗っている時間（秒）'),
  'structure.elevator.closeSec': num(1.2, 0.5, 4, 'エレベーター: 扉が閉まるまで（秒）'),
  'structure.station.chance': num(0.2, 0, 1, '駅: 駅の続く線が始まる確率（深さ 1・5・9 … の 4 フロアごとの枠ごと。始まると 2〜3 フロア続けて駅）'),
  'structure.station.dwellSec': num(4, 1, 20, '駅: 車両に乗ってから扉が閉まるまで（秒）'),
  'structure.station.rideSec': num(9, 3, 30, '駅: 次の駅に着くまで（秒）'),
  'structure.privateRoom.parts': num(3, 2, 4, '別室: 1 つの部屋に重ねる異変の数', true),
} as const satisfies Record<string, Spec>;
