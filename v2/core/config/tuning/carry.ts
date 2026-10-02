/**
 * 段階 4・物を運ぶ・パズル・ミニゲーム（2.10・4.7 のパズル・2.15）の調整値。この担当だけがこのファイルを書き換える（docs/stage4-workstreams.md）。
 * キーは 'carry.<仕掛け・異変>.<数値>'（例: 'carry.example.speedM'）。項目の作り方は spec.ts（num / bool）。
 */
import { num, type Spec } from '../spec.ts';

export const CARRY_TUNING = {
  // ---- 物を持つ仕組み（core/sim/parts/carry/item.ts）----
  'carry.item.range': num(2.6, 1.2, 4, '持てる物: 調べて（E / タップ）拾える距離（m）'),
  'carry.item.dropM': num(0.8, 0.4, 1.5, '持てる物: Q で置く所（体の前 m）'),
  'carry.item.placeTopM': num(1.25, 0.6, 2, '持てる物: Q で上に置ける台の高さの上限（足元から m。机・棚の上）'),
  'carry.item.slotAimM': num(2.8, 1, 5, '持てる物: 置き台・受けの枠を視線で狙える距離（m）'),
  'carry.item.throwSpeed': num(7.5, 2, 16, '持てる物: 投げる速さ（m/s。走っている速さを足す）'),
  'carry.item.throwPitch': num(0.3, 0, 1.2, '持てる物: この角度（rad）より上を向いて Q なら投げる（走っていても投げる）'),
  'carry.item.runPitch': num(0.18, 0, 0.8, '持てる物: 走りながら投げるときの、いちばん低い投げ上げの角度（rad）'),
  'carry.item.gravity': num(9.8, 1, 20, '持てる物（物理を使わない物）: 投げた物に掛かる重さ（m/s²）'),
  'carry.item.flySec': num(8, 1, 30, '持てる物: 投げた物が止まらないとき、元の所へ戻すまでの秒数'),
  // ---- 水を運ぶ（I01）----
  'carry.water.safeSpeed': num(1.9, 0.8, 3.5, '水を運ぶ: この速さ（m/s）より速く歩くとこぼれる（しゃがみ歩き 1.5・歩き 3.0・走り 5.5）'),
  'carry.water.spillRate': num(0.12, 0.05, 2, '水を運ぶ: 速さの超えた分 1 m/s あたり、1 秒にこぼれる割合'),
  'carry.water.jumpSpill': num(0.22, 0, 1, '水を運ぶ: 跳んで着地したときにこぼれる割合'),
  'carry.water.fillSec': num(1.2, 0.2, 5, '水を運ぶ: 蛇口の下で満杯になるまでの秒数'),
  // ---- 荷物と待つ扉（I02）----
  'carry.parcel.waitSec': num(2.5, 0.5, 10, '荷物と待つ扉: 荷物を持って枠の中で待つ秒数'),
  // ---- 床下収納（BI04・I10 の穴）----
  'carry.hatch.depthM': num(2.4, 2.2, 3.0, '床下収納: 穴の深さ（m。底の壁に高さ 2 m の扉が入る）'),
  // ---- 重さで開く（I10）----
  'carry.weight.need': num(3, 1, 10, '重さで開く: 板の上に要る重さ（重い木箱 1 つ = これ。軽い箱 2 つで足りる）'),
  'carry.weight.plateM': num(3.5, 2, 8, '重さで開く: 板と蓋の間の距離の下限（m。板から降りて走っても間に合わない）'),
  'carry.weight.closeSec': num(0.6, 0.1, 3, '重さで開く: 重さが無くなってから蓋が閉まり始めるまでの秒数'),
  // ---- 物を置くと増える（I08）・元の部屋の物（I11・BI06）----
  'carry.replica.pitchM': num(0.7, 0.4, 1.5, '物を置くと増える: 並べる間隔（m）'),
  'carry.replica.max': num(64, 8, 200, '物を置くと増える: 並べる数の上限', true),
  'carry.home.stageM': num(12, 3, 60, '運ぶと変わる物: この道のり（m）を運ぶごとに次の形になる（4 段。最後は鍵）'),
  // ---- パズル ----
  'carry.balance.min': num(4, 1, 10, '天秤: 釣り合わせる片側の重さの下限（軽い箱 1 つずつでは開かない）'),
  // ---- ミニゲーム ----
  'carry.pinball.push': num(1.2, 0.3, 2.8, 'ピンボール: 床が手前へ押す速さ（m/s。歩き 3.0 より遅いので逆らって歩ける）'),
  'carry.pinball.friction': num(0.45, 0.05, 1, 'ピンボール: 床の滑りやすさ（小さいほど滑る）'),
  'carry.pinball.kick': num(6.5, 2, 12, 'ピンボール: 丸い柱が弾く速さ（m/s）'),
  'carry.cart.speed': num(1.4, 0.5, 4, 'カートの坂: 台車の速さ（m/s）'),
  'carry.cart.laps': num(3, 1, 10, 'カートの坂: 降りずに乗り続けると隠しが現れる周の数', true),
  'carry.memory.showSec': num(10, 3, 30, '記憶の部屋: 照明が消えるまで見せる秒数'),
  'carry.memory.patientSec': num(20, 5, 90, '記憶の部屋: 暗い間に物に触れずにじっとしていると隠しが現れる秒数'),
  // ---- 本を集める（I03）----
  'carry.book.pickR': num(0.45, 0.2, 1, '本を集める: 本を拾う半径（体の中心から水平に m）'),
  'carry.book.routeClear': num(0.45, 0.2, 1.2, '本を集める: 1 冊も拾わずに返却台へ行く道から、本を離す余裕（拾う半径に足す m）'),
} as const satisfies Record<string, Spec>;
