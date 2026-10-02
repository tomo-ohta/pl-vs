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
} as const satisfies Record<string, Spec>;
