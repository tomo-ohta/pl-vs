/**
 * 段階 4・部屋まるごとの異変の拡充（2.2・2.5 の見た目・2.12・2.13）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'anomaly.<仕掛け・異変>.<数値>'（例: 'anomaly.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 * 異変ごとの出やすさは 'anomaly.w.<id>'（相対値。core/gen/anomaly/index.ts の anomalyWeight が読む）。
 */
import { num, type Spec } from '../spec.ts';

export const ODDITY_TUNING = {
  // ---- 出やすさ（相対値）----
  'anomaly.w.smoke': num(0.7, 0, 10, '煙の層（E02）'),
  'anomaly.w.leak': num(0.85, 0, 10, '雨漏り（E03）'),
  'anomaly.w.snow': num(0.75, 0, 10, '雪の室内（E04）'),
  'anomaly.w.wind': num(0.85, 0, 10, '風の向き（E08）'),
  'anomaly.w.thermal': num(0.95, 0, 10, '温度（E07）'),
  'anomaly.w.meadow': num(0.7, 0, 10, '草原・ひまわり畑（E05）'),
  'anomaly.w.overgrowth': num(0.75, 0, 10, '植物に覆われる（E12）'),
  'anomaly.w.sand': num(0.6, 0, 10, '砂の部屋（E11）'),
  'anomaly.w.sea': num(0.9, 0, 10, '室内の海（E10）'),
  'anomaly.w.waterWall': num(0.75, 0, 10, '水の壁（E09）'),
  'anomaly.w.miscount': num(0.75, 0, 10, '数が合わない（X03）'),
  'anomaly.w.fakeSigns': num(1.3, 0, 10, '案内の嘘（X04）'),
  'anomaly.w.nameplate': num(0.65, 0, 10, '自分の名前（X05）'),
  'anomaly.w.exitSign': num(0.7, 0, 10, '正しい出口の印（X13）'),
  'anomaly.w.missingColor': num(0.75, 0, 10, '色が抜ける（X07）'),
  'anomaly.w.mono': num(0.5, 0, 10, '単色の部屋（X08。黒一色・1 色だけ）'),
  'anomaly.w.huddle': num(0.7, 0, 10, '家具が一か所に集まる（X10）'),
  'anomaly.w.oddScale': num(0.95, 0, 10, '回転と大きさ（X11）'),
  'anomaly.w.misplaced': num(0.8, 0, 10, '別の部屋の家具（X12）'),
  'anomaly.w.carryover': num(0.65, 0, 10, '前の部屋の物（X06）'),
  'anomaly.w.void': num(0.75, 0, 10, '壁と床が欠ける（X09）'),
  'anomaly.w.vast': num(0.65, 0, 10, '中が広い部屋（W04・W09・W18）'),
  'anomaly.w.mirror': num(1.1, 0, 10, '鏡の部屋（W16）'),
  'anomaly.w.sideways': num(0.75, 0, 10, '横倒しの部屋（W17）'),
  'anomaly.w.perspective': num(0.8, 0, 10, '遠近法の錯覚（W15）'),
  'anomaly.w.dayCycle': num(0.6, 0, 10, '時刻が進む部屋（T02）'),
  'anomaly.w.aging': num(0.8, 0, 10, '古くなる部屋（T08）'),
  'anomaly.w.justLeft': num(0.65, 0, 10, '去った人の残り（T09）'),

  // ---- 煙の層（smoke）----
  'anomaly.smoke.bottomMin': num(1.15, 0.9, 1.5, '煙の層: 煙の底の高さの下限（床から m。しゃがんだ目 0.75 m より上・立った目 1.6 m より下）'),
  'anomaly.smoke.bottomMax': num(1.3, 0.9, 1.5, '煙の層: 煙の底の高さの上限（床から m）'),
  'anomaly.smoke.far': num(1.6, 0.5, 6, '煙の層: 目が煙の中にあるときの見える距離（m）'),
  // ---- 雨漏り（leak）----
  'anomaly.leak.dripsMax': num(10, 1, 30, '雨漏り: 雨染みと水たまりの数の上限', true),
  'anomaly.leak.dropsMax': num(500, 50, 2000, '雨漏り: 雨の筋の数の上限（描画の粒）', true),
  'anomaly.leak.slow': num(0.9, 0.5, 1, '雨漏り: 水たまりの中の歩く速さの倍率'),
  // ---- 雪の室内（snow）----
  'anomaly.snow.depth': num(0.05, 0.01, 0.15, '雪の室内: 床の雪の厚さ（m。当たらない。足が少し埋まって見える）'),
  'anomaly.snow.prints': num(180, 20, 600, '雪の室内: 残す足跡の数の上限（古い物から消える）', true),
  'anomaly.snow.flakesMax': num(450, 50, 2000, '雪の室内: 降る雪の粒の数の上限（描画）', true),
  'anomaly.snow.fogFar': num(16, 6, 40, '雪の室内: 部屋の白い霞の見える距離（m）'),
  // ---- 風の向き（wind）----
  'anomaly.wind.push': num(0.6, 0, 2.5, '風の向き: 体を押す風の強さ（m/s。歩く速さ 3.0 より十分弱く）'),
  'anomaly.wind.itemsMax': num(90, 10, 300, '風の向き: 流れる紙・葉の数の上限（描画）', true),
  // ---- 温度（thermal）----
  'anomaly.thermal.fogFar': num(5.5, 2, 12, '温度: 冷たい霧の見える距離（m。先の開口は入口から見えない）'),
  'anomaly.thermal.frost': num(0.85, 0, 1, '温度: いちばん寒い所の画面の霜の強さ'),
  // ---- 草原（meadow）----
  'anomaly.meadow.sunflower': num(1, 0, 10, '草原: ひまわり畑（全部が入口を向く）の重み'),
  'anomaly.meadow.wheat': num(0.8, 0, 10, '草原: 麦畑の重み'),
  'anomaly.meadow.flowers': num(0.8, 0, 10, '草原: 野の花の重み'),
  'anomaly.meadow.boxesMax': num(700, 100, 1400, '草原: 草木の箱の数の上限（描画の量）', true),
  // ---- 植物に覆われる（overgrowth）----
  'anomaly.overgrowth.boxesMax': num(600, 100, 1400, '植物に覆われる: 草木の箱の数の上限', true),
  // ---- 砂の部屋（sand）----
  'anomaly.sand.slow': num(0.85, 0.5, 1, '砂の部屋: 砂の上の歩く速さの倍率'),
  'anomaly.sand.shift': num(0.025, 0, 0.2, '砂の部屋: 床の風紋が流れる速さ（m/s。描画）'),
  // ---- 室内の海（sea）----
  'anomaly.sea.depth': num(0.5, 0.2, 0.7, '室内の海: 海の深さ（m）'),
  'anomaly.sea.slow': num(0.5, 0.2, 1, '室内の海: 海の中の歩く速さの倍率'),
  'anomaly.sea.push': num(1.1, 0, 2.5, '室内の海: 寄せる波が浜へ押し戻す強さ（m/s。海の中を歩く速さ 1.5 より弱く）'),
  'anomaly.sea.period': num(6.5, 3, 15, '室内の海: 波の周期（秒）'),
  // ---- 単色の部屋（mono）----
  'anomaly.mono.black': num(0.5, 0, 1, '単色の部屋: 黒一色にする割合（残りは 1 色だけの部屋）'),
  // ---- 回転と大きさ（oddScale）----
  'anomaly.oddScale.spin': num(0.35, 0, 3, '回転と大きさ: 宙で回る家具の回る速さ（rad/s。描画）'),
  'anomaly.oddScale.giantMin': num(2.2, 1.5, 4, '回転と大きさ: 巨大な家具の倍率の下限'),
  'anomaly.oddScale.giantMax': num(2.8, 1.5, 4, '回転と大きさ: 巨大な家具の倍率の上限'),
  // ---- 前の部屋の物（carryover）----
  'anomaly.carryover.items': num(4, 1, 10, '前の部屋の物: 写す家具の数の上限（大きい順）', true),
  // ---- 壁と床が欠ける（void）----
  'anomaly.void.depth': num(2.8, 1.5, 3.05, '壁と床が欠ける: 虚空の穴の深さ（m。3.1 m 以上は隣の区画の下に入り込む）'),
  // ---- 中が広い部屋（vast）----
  'anomaly.vast.heightMin': num(9, 6, 20, '中が広い部屋: 天井の高さの下限（m。部屋の上の空きが足りなければ低くする）'),
  'anomaly.vast.heightMax': num(14, 6, 20, '中が広い部屋: 天井の高さの上限（m）'),
  'anomaly.vast.pillarSpacing': num(4.5, 2.5, 10, '中が広い部屋: 太い柱の間隔の目安（m）'),
  'anomaly.vast.narrow': num(0.5, 0, 1, '中が広い部屋: 入口のすぐ内側を狭く低い通り口にする割合（W09）'),
  'anomaly.vast.mapScale': num(0.55, 0.2, 1, '中が広い部屋: 地図に出す見かけの大きさ（主の矩形の辺の倍率。W18）'),
  // ---- 遠近法の錯覚（perspective）----
  'anomaly.perspective.bands': num(5, 3, 8, '遠近法の錯覚: 奥行きを分ける帯の数', true),
  'anomaly.perspective.minScale': num(0.45, 0.2, 0.9, '遠近法の錯覚: いちばん奥の家具・照明の大きさの倍率'),
  'anomaly.perspective.ceilMin': num(2.25, 2.21, 3, '遠近法の錯覚: いちばん奥の天井の高さ（m。開口の前の空ける高さ 2.2 m より上）'),
  'anomaly.perspective.doorFar': num(0.5, 0.2, 1, '遠近法の錯覚: 奥の扉の、遠くから見た大きさの倍率'),
  // ---- 時刻が進む部屋（dayCycle）----
  'anomaly.dayCycle.daySec': num(90, 20, 600, '時刻が進む部屋: 部屋の中で朝から次の朝までの秒数（部屋にいる間だけ進む）'),
  // ---- 去った人の残り（justLeft）----
  'anomaly.justLeft.chairSpin': num(0.7, 0, 4, '去った人の残り: まだ回っている椅子の回る速さ（rad/s。描画）'),
  // ---- 一つだけ違う（仕掛け oneDifferent。X02・BX05）----
  'anomaly.oneDifferent.depthM': num(2.3, 2.0, 3.2, '一つだけ違う: ブースの奥行き（m）'),
  'anomaly.oneDifferent.boothM': num(2.2, 2.1, 3.2, '一つだけ違う: ブースの幅の目安（m。壁の長さをこの幅で割って 3〜5 つ）'),
} as const satisfies Record<string, Spec>;
