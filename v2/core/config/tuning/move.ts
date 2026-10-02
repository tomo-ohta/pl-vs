/**
 * 段階 4・移動と身体（gimmicks-and-structures.md 2.3）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'move.<仕掛け・異変>.<数値>'（例: 'move.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import { num, type Spec } from '../spec.ts';

export const MOVE_TUNING = {
  // ---- プレイヤーの動きの拡張（core/sim/player.ts）----
  'move.climb.speed': num(2.0, 0.5, 5, 'はしご: 上り下りの速さ（m/s）'),
  'move.swim.speed': num(1.9, 0.5, 5, '泳ぐ: 水平の速さ（m/s）'),
  'move.swim.dashSpeed': num(2.5, 0.5, 6, '泳ぐ: 走る操作のときの水平の速さ（m/s）'),
  'move.swim.depth': num(1.2, 0.6, 2, '泳ぐ: 足元から水面までがこれより深いと泳ぐ（m。浅ければ水の中を歩く）'),
  'move.swim.float': num(1.38, 1, 1.7, '泳ぐ: 浮いたときの足元の深さ（m。目が水面の少し上に出る）'),
  'move.swim.rise': num(1.7, 0.5, 4, '泳ぐ: 跳ぶ操作で浮き上がる速さ（m/s）'),
  'move.swim.dive': num(1.6, 0.5, 4, '泳ぐ: しゃがむ操作で潜る速さ（m/s）'),
  'move.swim.mantle': num(0.65, 0.2, 1.2, '泳ぐ: 水面からこの高さまでの縁なら、前へ押すと這い上がれる（m）'),
  'move.grav.holdSec': num(0.2, 0.05, 1, '重力の向き: 磁力の面へ向かって押し続けると乗り移るまでの秒数'),
  'move.grav.leaveSec': num(0.15, 0.05, 1, '重力の向き: 磁力の面から足が離れて、普通の重力に戻るまでの秒数'),
  'move.scale.rate': num(1.6, 0.2, 6, '身体の大きさ: 大きさが変わる速さ（倍率 / 秒）'),
  'move.updraft.accel': num(4, 0.5, 20, '上昇気流: 上向きの流れの速さへ近づく強さ（/ 秒）'),

  // ---- 送風の通路（windTunnel）[M20]・人の流れ [M28] ----
  'move.wind.gust': num(4.6, 3, 12, '送風の通路: 突風の速さ（m/s）。歩く（3）より強いので開けた所では押し戻され、立ち止まると入口まで飛ばされる。ダッシュ（5.5）なら少しずつ進める'),
  'move.wind.breeze': num(0.6, 0, 3, '送風の通路: 突風の間の弱い風（m/s）'),
  'move.wind.period': num(4.6, 2, 12, '送風の通路: 突風の周期（秒）'),
  'move.wind.duty': num(0.4, 0.1, 0.8, '送風の通路: 周期のうち突風の割合'),
  'move.wind.warn': num(0.9, 0, 3, '送風の通路: 突風の予告（送風機がうなる）の秒数'),
  'move.wind.air': num(1.6, 1, 4, '送風の通路: 宙にいる間の風の倍率（跳ぶと飛ばされる）'),
  'move.wind.landingM': num(1.4, 1.0, 2.5, '送風の通路: 入口の前の風の来ない奥行き（m）'),
  'move.wind.pitchM': num(2.6, 1.8, 4, '送風の通路: 風よけの仕切りの間隔（m）'),
  'move.wind.blownSec': num(0.45, 0.2, 3, '送風の通路（出現型の隠し）: 突風の中で宙にいる秒数'),
  'move.crowd.chance': num(0.35, 0, 1, '送風の通路: 人の流れ（見えない群衆）の変種になる確率（幅 3 m 以上の部屋）'),
  'move.crowd.speed': num(2.2, 0.5, 2.6, '人の流れ: 横切る流れの速さ（m/s）。歩く速さより弱く（流されながら渡れる）'),
  'move.crowd.laneM': num(1.3, 0.8, 2.5, '人の流れ: 流れの帯の幅（m）'),
  'move.crowd.period': num(3.4, 1.5, 10, '人の流れ: 流れが強まる周期（秒）'),
  'move.crowd.duty': num(0.5, 0.1, 0.9, '人の流れ: 周期のうち流れのある割合'),

  // ---- 足元の部屋（footingRoom）: 氷 [M32]・滑る床 [M10]・泥 [M31] ----
  'move.foot.w.ice': num(0.45, 0, 10, '足元の部屋: 氷の重み'),
  'move.foot.w.wax': num(0.25, 0, 10, '足元の部屋: 磨いて濡れた床の重み'),
  'move.foot.w.mud': num(0.3, 0, 10, '足元の部屋: 泥の重み'),
  'move.foot.iceFriction': num(0.22, 0.05, 1, '氷: 足の効き（1 が普通。小さいほど止まれない）'),
  'move.foot.waxFriction': num(0.35, 0.05, 1, '滑る床: 足の効き'),
  'move.foot.holeDepthM': num(1.2, 0.6, 2.5, '氷・滑る床: 落ちると入口からの穴の深さ（m）'),
  'move.foot.matM': num(0.95, 0.6, 1.6, '氷・滑る床: 止まれる敷物の大きさ（m）'),
  'move.foot.mats': num(5, 1, 12, '氷・滑る床: 止まれる敷物の数の上限', true),
  'move.foot.mudSlow': num(0.4, 0.15, 0.9, '泥: 歩く速さの倍率'),
  'move.foot.mudSink': num(0.2, 0, 0.6, '泥: 足が沈む深さ（m。目が下がる）'),
  'move.foot.quickM': num(1.4, 0.8, 2.5, '泥: 流砂の大きさ（m）'),
  'move.foot.quickSec': num(1.8, 0.5, 6, '泥: 流砂で立ち止まって飲み込まれるまでの秒数'),

  // ---- 這う部屋（crawlTunnel）: 縮むトンネル [M27]・ダクト [M24] ----
  'move.crawl.shrinkChance': num(0.5, 0, 1, '這う部屋: 縮むトンネルになる確率（入口と出口が向かい合う細長い部屋。ほかはダクト）'),
  'move.crawl.widthM': num(0.95, 0.8, 1.4, '這う部屋: 這う所の幅（m）'),
  'move.crawl.heightM': num(1.0, 0.9, 1.3, '這う部屋: 這う所の高さ（m。しゃがみの高さ 0.85 m より高く）'),
  'move.crawl.backwardSec': num(2.0, 0.5, 8, '縮むトンネル（出現型の隠し）: 立ったまま後ろ向きに歩き続ける秒数'),
  // ---- 後ろ向きの通路（backwardHall）[M42]・伸びる廊下（stretchHall）[M41] ----
  'move.backward.push': num(5.0, 3.2, 10, '後ろ向きの通路: 前を向いたときに押し戻す速さ（m/s。歩く 3 より強く）'),
  'move.backward.coneDeg': num(65, 30, 89, '後ろ向きの通路: 前からこの角度の内を向いていると押される'),
  'move.stretch.periodM': num(1.8, 1.2, 3, '伸びる廊下: 柱と照明の間隔（m）。歩いて境目を越えると、この長さだけ戻される'),
  'move.stretch.stillSec': num(1.0, 0.3, 4, '伸びる廊下: 立ち止まってから前へ滑り始めるまでの秒数'),
  'move.stretch.glide': num(1.3, 0.5, 3, '伸びる廊下: 立ち止まっている間に前へ滑る速さ（m/s）'),

  // ---- 溝・穴を渡る部屋: 走ると抜ける床 [M43]・見えない足場 [M44]・吊り橋 [M15]・振り子 [M39] ----
  'move.chasm.depthM': num(2.7, 2.2, 3.05, '溝・穴の部屋: 穴の深さ（m。3.1 m 以上は隠し部屋が隣の区画の下に入り込む）'),
  'move.chasm.tileM': num(1.0, 0.6, 1.6, '走ると抜ける床: 床板の大きさ（m）'),
  'move.chasm.trapSpeed': num(4.0, 3.2, 5.4, '走ると抜ける床: これより速く動くと床板が開く（m/s。歩く 3.0 と走る 5.5 の間）'),
  'move.chasm.trapOpenSec': num(3, 1, 10, '走ると抜ける床: 開いた床板が閉じるまで（秒）'),
  'move.chasm.ghostCellM': num(0.95, 0.9, 1.4, '見えない足場: 足場の 1 升の大きさ（m）'),
  'move.chasm.bridgeW': num(0.85, 0.75, 1.4, '吊り橋: 橋板の幅（m）'),
  'move.chasm.swayGain': num(4, 0.5, 20, '吊り橋: 歩くより速く動いたときに揺れが大きくなる強さ（度 / 秒 /（m/s）²）'),
  'move.chasm.swayMaxDeg': num(16, 4, 30, '吊り橋: 揺れの傾きの上限（度）'),
  'move.chasm.swayPush': num(0.6, 0.1, 2, '吊り橋: 傾きで横へ押す強さ（重さに対する割合）'),
  'move.chasm.walkW': num(1.2, 0.9, 2, '振り子の通路: 橋の幅（m）'),
  'move.chasm.pendulumPitch': num(1.9, 1.5, 3, '振り子の通路: 振り子の間隔（m。間で待てる）'),
  'move.chasm.pendulumPeriod': num(2.6, 1.6, 5, '振り子の通路: 振り子の周期（秒）'),
  'move.chasm.rideSec': num(1.2, 0.3, 5, '振り子の通路（出現型の隠し）: 振り子の板に乗っている秒数'),

  // ---- 高い所へ上がる部屋（riseHall）: ばね床の連続 [M36]・上昇気流 [M21]・はしご [M13] ----
  'move.rise.w.springs': num(0.4, 0, 10, '高い所へ上がる部屋: 弾む床の重み'),
  'move.rise.w.updraft': num(0.3, 0, 10, '高い所へ上がる部屋: 上昇気流の重み'),
  'move.rise.w.ladder': num(0.3, 0, 10, '高い所へ上がる部屋: はしごの重み'),
  'move.rise.stepM': num(1.25, 1.0, 1.8, '高い所へ上がる部屋: 棚 1 段の高さ（m。跳んで届く 0.9 m より高く）'),
  'move.rise.ledgeDepthM': num(1.5, 1.1, 2.2, '高い所へ上がる部屋: 棚の奥行き（m）'),
  'move.rise.ledgeLenM': num(2.0, 1.6, 3, '高い所へ上がる部屋: 棚 1 段の長さ（m）'),
  'move.rise.overshootM': num(0.7, 0.3, 1.5, '弾む床: 次の棚より高く跳ね上がる分（m）'),
  'move.rise.updraftSpeed': num(3.2, 1.5, 6, '上昇気流: 吹き上がる速さ（m/s）'),

  // ---- 逆走エスカレーター [M09]・滑り台 [M14・M12] ----
  'move.escalator.depthM': num(2.2, 1.6, 3.0, '逆走エスカレーター: 穴の深さ（m。エスカレーターで上る高さ）'),
  'move.escalator.speed': num(2.3, 1.0, 2.39, '逆走エスカレーター: 下りに動く速さ（m/s）。歩く 3.0 より少し遅く（歩くと少しずつ、走るとゆっくり上れる）'),
  'move.escalator.landingM': num(0.9, 0.7, 1.6, '逆走エスカレーター: 途中の踊り場の長さ（m）'),
  'move.escalator.stillSec': num(2.5, 0.5, 8, '逆走エスカレーター（出現型の隠し）: 踊り場で立ち止まる秒数'),
  'move.slide.depthM': num(2.4, 1.8, 3.0, '滑り台: 穴の深さ（m）'),
  'move.slide.waterChance': num(0.5, 0, 1, '滑り台: 水の流れる滑り台（ウォータースライダー）になる確率'),
  'move.slide.slopeDeg': num(38, 25, 45, '滑り台: 傾き（度）'),
  'move.slide.speed': num(4.5, 2.5, 8, '滑り台: 滑り落ちる流れの速さ（m/s。歩く速さより強く、上へは戻れない）'),
  'move.slide.chuteSpeed': num(3.0, 2.5, 6, '滑り台（隠し）: 横の溝の流れの速さ（m/s）'),

  // ---- 回る・動く床と壁: 回る床 [M11]・回転扉 [M34]・押せる壁 [M35]・傾いていく部屋 [M37] ----
  'move.turn.radiusMaxM': num(3.2, 1.9, 5, '回る床: 円盤の半径の上限（m）'),
  'move.turn.omega': num(0.42, 0.1, 1.2, '回る床: 回る速さ（rad/s。縁で約 1.3 m/s）'),
  'move.turn.rimSec': num(9, 2, 30, '回る床（出現型の隠し）: 縁に乗り続ける秒数'),
  'move.revolve.radiusM': num(1.6, 1.3, 2.2, '回転扉: 筒の半径（m）'),
  'move.revolve.walkW': num(1.3, 0.4, 3, '回転扉: 歩いて押したときの回る速さの上限（rad/s）'),
  'move.revolve.runW': num(2.8, 1, 5, '回転扉: 走って押したときの回る速さの上限（rad/s）'),
  'move.revolve.damp': num(0.9, 0.2, 4, '回転扉: 手を離した後に回る勢いが弱まる速さ（/ 秒）'),
  'move.push.travelM': num(1.8, 1.2, 3, '押せる壁: 板が動く距離（m）'),
  'move.push.speed': num(0.7, 0.2, 2, '押せる壁: 押しているときに動く速さ（m/s）'),
  'move.tilt.maxDeg': num(12, 4, 20, '傾いていく部屋: 床の傾きの上限（度）'),
  'move.tilt.rate': num(1.1, 0.2, 5, '傾いていく部屋: 傾いていく速さ（度 / 秒。人がいなくなると半分の速さで戻る）'),
  'move.tilt.push': num(0.35, 0, 1, '傾いていく部屋: 傾きで低い側へ押す強さ（重さに対する割合）'),

  // ---- 吹き抜けを渡る部屋（atrium）: ロープ渡り [M16]・ジップライン [M17]・台車 [M29]・ゴンドラ [M30] ----
  'move.atrium.depthM': num(2.6, 1.8, 3.4, '吹き抜け: 穴の深さ（m）'),
  'move.atrium.w.rope': num(0.3, 0, 10, '吹き抜け: ロープ渡りの重み'),
  'move.atrium.w.zip': num(0.25, 0, 10, '吹き抜け: ジップラインの重み'),
  'move.atrium.w.cart': num(0.2, 0, 10, '吹き抜け: 台車の重み'),
  'move.atrium.w.gondola': num(0.25, 0, 10, '吹き抜け: ゴンドラの重み'),
  'move.atrium.ropeSpeed': num(1.1, 0.4, 3, 'ロープ渡り: つかまって進む速さ（m/s）'),
  'move.atrium.zipAccel': num(3, 0.5, 10, 'ジップライン: 加速（m/s²）'),
  'move.atrium.zipMax': num(6, 2, 12, 'ジップライン: 速さの上限（m/s）'),
  'move.atrium.cartDeg': num(28, 15, 40, '台車: 坂の傾き（度）'),
  'move.atrium.cartMax': num(7, 2, 12, '台車: 速さの上限（m/s）'),
  'move.atrium.carWait': num(3, 1, 10, 'ゴンドラ: 乗り場で待つ秒数'),
} as const satisfies Record<string, Spec>;
