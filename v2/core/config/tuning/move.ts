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
} as const satisfies Record<string, Spec>;
