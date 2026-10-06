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
  'world.kind.district': num(50, 0, 100, '区域の種類の重み: 街区（v2 のフロアの型。似た雰囲気が続く）'),
  'world.kind.patchwork': num(50, 0, 100, '区域の種類の重み: 寄せ集め（v1 風。部屋ごとに雰囲気と大きさが違う）'),
  'world.wardSlots': num(3, 1, 12, '町（似た雰囲気のまとまり）の一辺の升目の数', true),
  'world.wardCoherence': num(0.4, 0, 1, '街区が町の系統を使う確率（残りは区域ごとにばらばら）'),
  'world.wildcardRoomChance': num(0.3, 0, 1, '街区の部屋が別の系統のテーマになる確率（扉を開けると急に別の施設）'),
  // ---- 境目の扉（3.1）----
  'world.gate.perEdge': num(3, 1, 5, '境目の扉の数: 隣の区域と接する升目の辺 1 つあたり（寄せ集めどうし）', true),
  'world.gate.perEdgeDistrict': num(2, 1, 4, '境目の扉の数: 升目の辺 1 つあたり（どちらかが街区。境目の扉まで廊下を引く）', true),
  'world.gate.cornerM': num(8, 3, 20, '境目の扉を升目の角からこれ以上離す（m）'),
  'world.door.moodMats': num(2, 1, 3, '区域の開口を扉にする雰囲気の違い: 床・壁・天井の材質がこの数以上違えば扉（系統が違えばいつも扉）', true),
  'world.gate.stubWidthM': num(2.0, 1.4, 3.2, '区域の部屋から境目の扉までの廊下の幅（m）'),
  // ---- 階段室（3.2）----
  'world.airlock.widthM': num(1.6, 1.4, 2.4, '階段室の幅（壁を含む。m）'),
  'world.airlock.closeSec': num(1.5, 0.5, 4, '階段室の扉が閉まるまで（秒）'),
  'world.connector.lift': num(0.4, 0, 1, '升目ごとの下りが、階段室でなくエレベーターになる確率'),
  'world.lift.widthM': num(2.4, 2.0, 3.2, 'エレベーター: かごの外の一辺（壁を含む。m）'),
  'world.lift.rideSec': num(4, 1, 15, 'エレベーター: 戸が閉まってから着くまで（秒）'),
  'world.lift.arriveSec': num(1.2, 0.3, 5, 'エレベーター: 着いてから戸が開くまで（秒）'),
  // ---- 隠しの穴（13 章）: 落ちる縦穴の途中で、行き先の階の着く部屋の天井の上の縦穴へ移る（暗転しない）----
  'world.hole.sizeM': num(1.4, 1, 2.4, '隠しの穴・着く部屋の天井の穴の一辺（m）'),
  'world.hole.depthM': num(30, 12, 60, '隠しの穴の縦穴の深さ（m）。底の手前まで移れなければ暗転して移る'),
  'world.hole.transferM': num(7, 2, 12, '隠しの穴の床からこの深さまで落ちたら、行き先の階の縦穴へ移る（m）'),
  'world.hole.shaftM': num(11, 6, 24, '着く部屋の天井の上の縦穴の高さ（m）。移った所から天井まで shaftM − transferM 落ちる'),
  'world.landing.sizeM': num(2.2, 1.6, 3, '着く部屋の天井の穴の一辺（m。沈む床の床板 2 m が通る）'),
  'world.hole.liftSpeed': num(1.0, 0.3, 3, '沈む床・着く部屋の床板が下りる速さ（m/s）'),
  'world.hole.openSizeM': num(1.6, 1, 3, '床の穴（v1 の Hole）の一辺（m）'),
  'world.hole.open': num(0.7, 0, 1, '升目ごとに床の穴が 1 つある確率'),
  'world.hole.open2': num(0.25, 0, 1, '升目ごとに床の穴がもう 1 つある確率'),
  'world.hole.prepareM': num(14, 4, 40, '隠しの穴からこの距離に入ったら、行き先の階を裏で作り始める（m）'),
  'world.hole.holdSec': num(8, 0, 30, '行き先の階が用意できるまで、暗い縦穴の中で落ち続ける長さの上限（秒）'),
  'world.hole.darkFarM': num(4, 1, 12, '縦穴の中の暗さ: 霧で何も見えなくなる距離（m）'),
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
  'world.patch.corridor': num(0.3, 0, 1, '寄せ集め: 細長い通路の部屋を切り出す確率（分けるごと）'),
  'world.patch.loops': num(0.5, 0, 1, '寄せ集め: 木のつながりに足す扉の割合（行き止まりばかりにしない）'),
  'world.patch.deadEndFix': num(0.85, 0, 1, '寄せ集め: 扉が 1 つだけの部屋に、隣の部屋への扉を足す確率'),
  'world.patch.maxAspect': num(3, 1.5, 8, '寄せ集め: 部屋の長い辺 / 短い辺の上限（これより細長い部屋はもう一度切る）'),
  'world.patch.corridorMaxM': num(28, 12, 64, '寄せ集め: 通路を切り出す矩形の長い辺の上限（m。長い矩形は先に切り分ける）'),
  'world.patch.shape.straight': num(1, 0, 10, '寄せ集め: 通路の形の重み: まっすぐ'),
  'world.patch.shape.bend': num(1.4, 0, 10, '寄せ集め: 通路の形の重み: L 字の曲がり角'),
  'world.patch.shape.branch': num(1.2, 0, 10, '寄せ集め: 通路の形の重み: T 字の分かれ道'),
  'world.patch.shape.cross': num(0.5, 0, 10, '寄せ集め: 通路の形の重み: 十字路'),
  'world.patch.dimChance': num(0.16, 0, 1, '寄せ集め: 部屋が暗い（照明 0.3〜0.55 倍）確率'),
  'world.patch.brightChance': num(0.1, 0, 1, '寄せ集め: 部屋がまぶしい（照明 1.25〜1.6 倍）確率'),
  'world.patch.tallChance': num(0.14, 0, 1, '寄せ集め: 部屋・広間の天井が 1.5〜3.5 m 高い確率'),
  'world.patch.lowChance': num(0.08, 0, 1, '寄せ集め: 部屋の天井が低い（2.3〜2.5 m）確率'),
  'world.patch.openChance': num(0.15, 0, 1, '寄せ集め: 部屋どうしの出入り口を扉でなく開口にする確率'),
} as const;
