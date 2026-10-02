/**
 * 段階 4・部屋の形（gimmicks-and-structures.md 2.2）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'rooms.<部屋の形>.<数値>'（例: 'rooms.example.heightM'）。項目の作り方は spec.ts（num / bool）。
 * 形を選ぶ段は core/gen/rooms/index.ts、形の定義は core/gen/rooms/shapes/*.ts。
 */
import { num, type Spec } from '../spec.ts';

export const ROOMS_TUNING = {
  // ---- 形を掛ける部屋の選び方（core/gen/rooms/index.ts）----
  'rooms.chance.room': num(0.55, 0, 1, '普通の部屋（仕掛け・異変の無い部屋）に部屋の形を掛ける確率'),
  'rooms.chance.hall': num(0.6, 0, 1, '普通の広間に部屋の形を掛ける確率'),
  'rooms.chance.anomaly': num(0.3, 0, 1, '異変の部屋（中身を置く前の段の無い異変）に、重ねてよい形を掛ける確率'),
  'rooms.openMul': num(0.6, 0, 1, '入口に扉の無い部屋の確率の倍率（扉を開けた瞬間の驚きを優先する）'),
  'rooms.repeatMul': num(0.3, 0, 1, '同じフロアに同じ形がすでにあるとき、1 つごとに重みに掛ける倍率'),
  'rooms.buildTries': num(3, 1, 8, '選んだ形がその部屋に組めないとき、次の候補を試す数', true),
  'rooms.maxBoxes': num(900, 100, 4000, '1 つの形が区画に足す箱の上限（描画の三角形と焼き込みの時間。中身の家具は別に dress の上限）', true),
  'rooms.maxLights': num(18, 4, 64, '形を掛けた区画の点光源の上限（元の数より多くはしない。スマホの灯りの予算）', true),

  // ---- 形ごとの出やすさ（相対値）----
  'rooms.w.pillars': num(1.2, 0, 10, 'S01 柱林'),
  'rooms.w.grandHall': num(1.2, 0, 10, 'S02 大広間（広間だけ）'),
  'rooms.w.tallHall': num(0.8, 0, 10, 'S03 縦長ホール'),
  'rooms.w.ceilingWells': num(0.9, 0, 10, 'S05 天井井戸'),
  'rooms.w.lowCeiling': num(0.7, 0, 10, 'S10 低すぎる天井'),
  'rooms.w.highCeiling': num(0.6, 0, 10, 'S11 高すぎる天井'),
  'rooms.w.waveCeiling': num(0.8, 0, 10, 'S30 天井の高さが場所で変わる'),
  'rooms.w.splitHall': num(1.0, 0, 10, 'S06 分割ホール'),
  'rooms.w.bentRoom': num(1.2, 0, 10, 'S07 L 字・コの字・ロの字'),
  'rooms.w.doubleWall': num(0.9, 0, 10, 'S13 二重壁'),
  'rooms.w.halfBasement': num(0.8, 0, 10, 'S16 半地下'),
  'rooms.w.slantWalls': num(0.9, 0, 10, 'S17 斜めの壁'),
  'rooms.w.windows': num(0.9, 0, 10, 'S23 窓だらけ'),

  // ---- S13 二重壁 ----
  'rooms.double.gapM': num(0.85, 0.75, 1.4, '二重壁: 壁と壁の間の幅（m。体の幅 0.7 m より少し広い）'),

  // ---- S01 柱林 ----
  'rooms.pillars.sizeMin': num(0.45, 0.3, 1.2, '柱林: 柱の太さの下限（m）'),
  'rooms.pillars.sizeMax': num(0.75, 0.3, 1.2, '柱林: 柱の太さの上限（m）'),
  'rooms.pillars.gapM': num(1.25, 1.0, 3, '柱林: 柱と柱の間（m。体の幅 0.7 m より広く）'),

  // ---- S02 大広間 ----
  'rooms.grand.heightMul': num(1.8, 1.2, 3, '大広間: 天井の高さの倍率'),
  'rooms.grand.heightMaxM': num(10, 4, 20, '大広間: 天井の高さの上限（m）'),
  'rooms.grand.columnPitchM': num(3.2, 2, 6, '大広間: 列柱の間隔（m）'),
  'rooms.grand.chandelier': num(1.4, 0, 4, '大広間: シャンデリアの明るさ（区画の照明の明るさに掛ける）'),

  // ---- S03 縦長ホール ----
  'rooms.tall.heightMinM': num(9, 5, 20, '縦長ホール: 天井の高さの下限（m）'),
  'rooms.tall.heightMaxM': num(15, 5, 30, '縦長ホール: 天井の高さの上限（m）'),
  'rooms.tall.ratio': num(2.2, 1, 5, '縦長ホール: 天井の高さ ÷ 部屋の幅（狭い方）'),

  // ---- S05 天井井戸 ----
  'rooms.wells.sizeMin': num(1.4, 0.8, 4, '天井井戸: 井戸の一辺の下限（m）'),
  'rooms.wells.sizeMax': num(2.4, 0.8, 4, '天井井戸: 井戸の一辺の上限（m）'),
  'rooms.wells.depthMin': num(4, 1.5, 15, '天井井戸: 井戸の高さ（天井から上）の下限（m）'),
  'rooms.wells.depthMax': num(9, 1.5, 15, '天井井戸: 井戸の高さの上限（m）'),
  'rooms.wells.max': num(4, 1, 9, '天井井戸: 井戸の数の上限', true),
  'rooms.wells.light': num(1.6, 0, 5, '天井井戸: 井戸の上の灯りの明るさ（区画の照明の明るさに掛ける）'),

  // ---- S10 低すぎる天井 ----
  'rooms.low.heightM': num(1.6, 1.1, 2.0, '低すぎる天井: 天井の高さ（m。プレイヤーは 1.7 m なのでしゃがんで進む）'),
  'rooms.low.vestibuleM': num(1.4, 1.2, 2.5, '低すぎる天井: 開口の前の普通の高さの所の奥行き（m）'),

  // ---- S11 高すぎる天井 ----
  'rooms.high.heightM': num(30, 8, 40, '高すぎる天井: 天井の高さ（m）'),
  'rooms.high.light': num(3.2, 0.5, 10, '高すぎる天井: 天井の蛍光灯 1 本の点光源の明るさ（区画の照明の明るさに掛ける）'),

  // ---- S30 天井の高さが場所で変わる ----
  'rooms.wave.stepM': num(1.1, 0.6, 2.5, '天井の高さが変わる: 高さを変える間隔（m。部屋の奥行きの向き）'),
  'rooms.wave.lowM': num(1.9, 1.75, 2.4, '天井の高さが変わる: いちばん低い所（m。しゃがまずに通れる）'),
  'rooms.wave.highAddM': num(2.6, 0.5, 6, '天井の高さが変わる: いちばん高い所（元の天井から上へ m）'),
} as const satisfies Record<string, Spec>;
