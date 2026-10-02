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
  'rooms.w.grandHall': num(3.0, 0, 10, 'S02 大広間（広間だけ）'),
  'rooms.w.tallHall': num(0.6, 0, 10, 'S03 縦長ホール'),
  'rooms.w.ceilingWells': num(0.9, 0, 10, 'S05 天井井戸'),
  'rooms.w.lowRoom': num(0.7, 0, 10, 'S10 低すぎる天井（形の id は lowRoom。仕掛けの lowCeiling と分ける）'),
  'rooms.w.highCeiling': num(0.6, 0, 10, 'S11 高すぎる天井'),
  'rooms.w.waveCeiling': num(0.8, 0, 10, 'S30 天井の高さが場所で変わる'),
  'rooms.w.splitHall': num(1.0, 0, 10, 'S06 分割ホール'),
  'rooms.w.bentRoom': num(1.2, 0, 10, 'S07 L 字・コの字・ロの字'),
  'rooms.w.doubleWall': num(0.9, 0, 10, 'S13 二重壁'),
  'rooms.w.halfBasement': num(0.8, 0, 10, 'S16 半地下'),
  'rooms.w.slantWalls': num(0.9, 0, 10, 'S17 斜めの壁'),
  'rooms.w.windows': num(0.9, 0, 10, 'S23 窓だらけ'),
  'rooms.w.hut': num(0.8, 0, 10, 'S21 部屋の中の小屋'),
  'rooms.w.eelBed': num(3.0, 0, 10, 'S12 うなぎの寝床（長い区画だけ）'),
  'rooms.w.endless': num(1.0, 0, 10, 'S26 果てしない通路（表のフロアだけ）'),
  'rooms.w.roundRoom': num(1.8, 0, 10, 'S18 円形の部屋（開口が区画の中心線の上にあるとき）'),

  'rooms.w.centerHole': num(1.8, 0, 10, 'S15 中央の穴'),
  'rooms.w.pitGallery': num(2.0, 0, 10, 'S04 穴の回廊'),
  'rooms.w.grating': num(0.7, 0, 10, 'S14 全面グレーチングの床'),
  'rooms.w.sunkenWater': num(0.9, 0, 10, 'S28 水没した下半分'),
  'rooms.w.terraces': num(2.4, 0, 10, 'S08 段々の部屋'),

  'rooms.w.theater': num(2.4, 0, 10, 'S09 半円の劇場'),
  'rooms.w.loft': num(1.0, 0, 10, 'S20 ロフト付き'),
  'rooms.w.scaffold': num(2.0, 0, 10, 'S22 足場の部屋'),
  'rooms.w.layers': num(1.4, 0, 10, 'S27 一つの部屋が何層も'),
  'rooms.w.stairsOnly': num(1.8, 0, 10, 'S29 階段だけの部屋'),
  'rooms.w.atticStair': num(0.9, 0, 10, 'S19 天井から下がる階段'),
  'rooms.w.tilted': num(0.9, 0, 10, 'S25 傾いた部屋（開口が 1 本の線の上にあるとき）'),

  // ---- S25 傾いた部屋 ----
  'rooms.tilt.deg': num(6, 2, 12, '傾いた部屋: 傾き（度）'),

  // ---- S09 半円の劇場 ----
  'rooms.theater.stageD': num(2.0, 1.4, 3.5, '半円の劇場: 舞台の奥行き（m）'),
  'rooms.theater.stageH': num(0.7, 0.35, 1.0, '半円の劇場: 舞台の高さ（m。前の段 2 段で上がる）'),

  // ---- S15 中央の穴 ----
  'rooms.hole.rimM': num(1.25, 1.1, 2.5, '中央の穴: 縁の幅の下限（m。開口のある壁の側は扉の前を空ける広さ）'),
  'rooms.hole.depthM': num(2.2, 1.0, 3.0, '中央の穴: 穴の深さ（m。落ちたら壁沿いの段で戻る）'),
  // ---- S04 穴の回廊 ----
  'rooms.gallery.widthM': num(1.3, 1.1, 2.5, '穴の回廊: 回廊の幅（m）'),
  'rooms.gallery.depthM': num(2.6, 2.0, 3.05, '穴の回廊: 吹き抜けの深さ（m。下の部屋の高さ。3.1 m 以上は隣の区画の下に入り込みやすい）'),
  // ---- S14 全面グレーチング ----
  'rooms.grating.depthM': num(2.4, 1.2, 3.05, '全面グレーチング: 格子の下の空間の深さ（m）'),
  'rooms.grating.pitchM': num(0.12, 0.06, 0.4, '全面グレーチング: 格子の棒の間隔（m）'),
  // ---- S28 水没した下半分 ----
  'rooms.sunken.depthM': num(1.4, 0.8, 2.2, '水没した下半分: 床が下がる深さ（m。水は板の道の 0.15 m 下まで）'),
  'rooms.sunken.walkM': num(1.0, 0.8, 1.6, '水没した下半分: 板の道の幅（m）'),
  'rooms.sunken.slow': num(0.45, 0.2, 1, '水没した下半分: 水の中の歩く速さの倍率'),
  // ---- S08 段々の部屋 ----
  'rooms.terrace.riseM': num(0.33, 0.2, 0.35, '段々の部屋: 1 段の高さ（m。歩いて上れる 0.35 m 以下）'),
  'rooms.terrace.treadM': num(0.85, 0.7, 1.2, '段々の部屋: 1 段の奥行き（m。座席の列が載る）'),
  'rooms.terrace.max': num(6, 2, 10, '段々の部屋: 段の数の上限', true),

  // ---- S12 うなぎの寝床 ----
  'rooms.eel.widthM': num(1.2, 0.9, 1.8, 'うなぎの寝床: 帯の幅（m。壁の内側）'),
  // ---- S26 果てしない通路 ----
  'rooms.endless.widthMin': num(1.9, 1.4, 3, '果てしない通路: 通路の幅の下限（m）'),
  'rooms.endless.widthMax': num(2.4, 1.4, 3.5, '果てしない通路: 通路の幅の上限（m）'),
  'rooms.endless.fogMinM': num(7, 2, 20, '果てしない通路: 霧で何も見えなくなる距離の下限（m）'),
  'rooms.endless.fogMaxM': num(13, 4, 40, '果てしない通路: 霧で何も見えなくなる距離の上限（m。通路の長さの 6 割まで）'),
  // ---- S18 円形の部屋 ----
  'rooms.round.minR': num(2.4, 1.8, 6, '円形の部屋: 丸の半径の下限（m）'),

  // ---- S13 二重壁 ----
  'rooms.double.gapM': num(0.85, 0.75, 1.4, '二重壁: 壁と壁の間の幅（m。体の幅 0.7 m より少し広い）'),

  // ---- S01 柱林 ----
  'rooms.pillars.sizeMin': num(0.45, 0.3, 1.2, '柱林: 柱の太さの下限（m）'),
  'rooms.pillars.sizeMax': num(0.75, 0.3, 1.2, '柱林: 柱の太さの上限（m）'),
  'rooms.pillars.gapM': num(1.15, 1.0, 3, '柱林: 柱と柱の間（m。体の幅 0.7 m より広く）'),

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
