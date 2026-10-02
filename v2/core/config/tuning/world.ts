/**
 * 果てしない階（区域の流し込み。docs/endless-world.md）の調整値。キーは 'world.<項目>'。
 * 項目の作り方は spec.ts（num / bool）。
 */
import { num } from '../spec.ts';

export const WORLD_TUNING = {
  // ---- 升目と区域（3 章）----
  'world.slotM': num(64, 40, 120, '升目の一辺（m）。区域は 1 × 1・2 × 1・1 × 2・2 × 2 升目', true),
  'world.marginM': num(4.5, 3, 8, '区域の縁の帯（m）。境目の扉までの道を通す'),
  'world.split.quad': num(50, 0, 100, '超ブロック（2 × 2 升目）の分け方の重み: 1 × 1 が 4 つ'),
  'world.split.pair': num(15, 0, 100, '超ブロックの分け方の重み: 2 × 1 が 2 つ・1 × 2 が 2 つ（合わせて）'),
  'world.split.mix': num(12, 0, 100, '超ブロックの分け方の重み: 2 × 1（か 1 × 2）1 つと 1 × 1 が 2 つ（合わせて）'),
  'world.split.big': num(8, 0, 100, '超ブロックの分け方の重み: 2 × 2 が 1 つ'),
  'world.kind.district': num(65, 0, 100, '区域の種類の重み: 街区（v2 のフロアの型。似た雰囲気が続く）'),
  'world.kind.patchwork': num(35, 0, 100, '区域の種類の重み: 寄せ集め（v1 風。部屋ごとに雰囲気と大きさが違う）'),
  'world.wardSlots': num(3, 1, 12, '町（似た雰囲気のまとまり）の一辺の升目の数', true),
  'world.wardCoherence': num(0.6, 0, 1, '街区が町の系統を使う確率（残りは区域ごとにばらばら）'),
  'world.wildcardRoomChance': num(0.15, 0, 1, '街区の部屋が別の系統のテーマになる確率（扉を開けると急に別の施設）'),
  // ---- 境目の扉（3.1）----
  'world.gate.extraChance': num(0.35, 0, 1, '升目 2 つ以上の長い境目に、2 つ目の扉を付ける確率'),
  'world.gate.cornerM': num(8, 3, 20, '境目の扉を升目の角からこれ以上離す（m）'),
  'world.gate.stubWidthM': num(2.0, 1.4, 3.2, '区域の部屋から境目の扉までの廊下の幅（m）'),
  // ---- 階段室（3.2）----
  'world.airlock.widthM': num(1.6, 1.4, 2.4, '階段室の幅（壁を含む。m）'),
  'world.airlock.closeSec': num(1.5, 0.5, 4, '階段室の扉が閉まるまで（秒）'),
  // ---- 読み込み（5.2）----
  'world.load.gateM': num(32, 8, 80, '境目の扉からこの距離に入ったら、向こうの区域を読む（m）'),
  'world.unload.gateM': num(72, 20, 200, 'どの境目の扉からもこれより遠い区域は外す（m）'),
  'world.maxRegions': num(6, 2, 16, '同時に持つ区域の数の上限', true),
  'world.cache.regions': num(6, 0, 32, '外した区域の layout を覚えておく数（行き来で作り直さない）', true),
  'world.prepare.airlockM': num(20, 4, 60, '下りの階段室の扉からこの距離に入ったら、下の階を裏で作り始める（m）'),
  // ---- 描画（5.3）----
  'world.build.hops': num(3, 1, 8, '区画を作る範囲: 今の区画から portal をたどる数', true),
  'world.dispose.hops': num(5, 2, 12, '区画を捨てる範囲: これより遠い区画は捨てる', true),
  'world.buildMs': num(10, 2, 40, '1 フレームに区画を作る時間（ms）'),
  // ---- 寄せ集め（4 章）----
  'world.patch.minM': num(3.6, 3, 6, '寄せ集め: 部屋の短い辺の最小（m）'),
  'world.patch.hallM': num(18, 10, 40, '寄せ集め: この大きさを超える部屋は広間（天井が高い）'),
  'world.patch.keepBig': num(0.3, 0, 1, '寄せ集め: 大きい部屋をそれ以上分けずに残す確率'),
  'world.patch.corridor': num(0.22, 0, 1, '寄せ集め: 細長い通路の部屋を切り出す確率（分けるごと）'),
  'world.patch.loops': num(0.35, 0, 1, '寄せ集め: 木のつながりに足す扉の割合（行き止まりばかりにしない）'),
  'world.patch.openChance': num(0.15, 0, 1, '寄せ集め: 部屋どうしの出入り口を扉でなく開口にする確率'),
} as const;
