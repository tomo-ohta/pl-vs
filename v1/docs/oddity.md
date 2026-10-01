# 奇妙さ生成（oddity）

作成: 2026-09-22。「見慣れた場所なのに何かおかしい」を、怪異を直接描かずに間取り・配置・表面・光の仕掛けで出す層。
実装は `src/generators/oddity/`（`index.ts` 予算と主題の選択、`shared.ts` 共通ヘルパ、`layout.ts` 間取り、`contents.ts` 配置と欠落、`surfaces.ts` 床・壁・天井・水、`traces.ts` 光・時間・痕跡）。

## 位置づけ
`generateLayout`: generateRaw → applyDressing（希少度別の部屋らしさ）→ **applyOddity** → Modifier → wear → decals。
Common の部屋にも掛かる唯一の「非日常」の層。足す箱は `kind: 'dress:odd'` で、Modifier の removeFills / removeInterior に捨てられない。

## 予算と主題（ユーザー指示 5 章）
| 希少度 | 何も無い部屋 | 主題（strong） | 添え物（weak） |
|---|---|---|---|
| Common | 18% | 必ず 1 つ | 1〜2（主題と別カテゴリ） |
| Uncommon | 10% | 50% | 1〜2 |
| Rare | 10% | 35% | 1 |
| Epic / Legendary | 30% | なし（Modifier が主題） | 1 |
| Mythic | 100% | なし | なし |

- 1 部屋 1 主題。主題は入口から見た正面（`Ctx.focus` = 入口の向きに 12 m × ±5 m）に置く（視線誘導）。
- 乱数は `p.rng.fork('odd')` だけ。footprint・ソケット（扉の位置と高さ）・入口→出口の動線・扉前ゾーンは変えない。
- 予算: 箱 +250 / ライト +2 / サイン +8。プレイヤーの段差登り 0.35 m・しゃがみ 0.85 m・ジャンプを守る。
- 開発用: `?noodd=1` で無効。結果は `layoutFor(node).oddity`（theme / accents / notes）。
- 見えない光源 `Box.kind: 'emitOnly'`（描かないが焼き込みの器具に数える。RoomBuilder が表示から除く）。既存の `glowOnly`（光って見えるが光源にならない）と対。

## 仕掛けの一覧（id / 主題可 / 重み）

| カテゴリ | id | 内容 |
|---|---|---|
| layout | `layout.openingOffset` ○ 3 | 下端 0.4 m の浮いた飾り扉、天井近くの 0.6 m 角の暗い出口 + EXIT、廊下の突き当たりの横向き扉 |
| layout | `layout.roomInRoom` ○ 2 | 60 m² 以上の部屋に 2.5〜4 m 角の窓の無い小部屋（5 割で外壁と 0.7 m の隙間通路、天井 −0.4 の隙間） |
| layout | `layout.windowInward` × 2 | 夜景の窓を途中で壁に切る / 黒 + ガラス + 暖色の帯で「向こうに明るい廊下」 |
| layout | `layout.corridorTaper` ○ 2 | 廊下の両壁を 1 m 刻みで厚くし最狭 1.3 m まで絞る（strong は入口から線形） |
| layout | `layout.pillars` ○ 2 | 中央の孤立柱（天井 −0.35 で届かない）、下端 0.45 m の吊り柱、格子から 0.6〜0.9 m ずれた柱 |
| contents | `contents.oneDeviation` ○ 4 | 椅子 1 脚だけ回転 / 通路へ、ロッカー 1 台だけ扉が開く |
| contents | `contents.clusterAndVoid` ○ 3 | 椅子を全部隅に密集（2 層）、売場の商品を 1 帯だけ残す |
| contents | `contents.stacking` ○ 2 | 机の 2 段積み、椅子の塔（天井まで）、横倒しのロッカー |
| contents | `contents.wallFurniture` ○ 2 | 天井に逆さの椅子、壁に付いた椅子 |
| contents | `contents.uniformFacing` ○ 2 | 全椅子が入口を見る、全ロッカーが 50° 半開き |
| contents | `contents.countAnomaly` ○ 2 | 消火器 8 本、時計 5 個（別時刻）、非常口サインだらけ |
| contents | `contents.uselessFixtures` × 3 | 行き止まりパイプ、途中で終わる手すり、ボタンの無い盤、押せないボタン列 |
| surface | `surface.ceilingGaps` ○ 3 | 天井板 4〜6 枚の欠落（暗い空隙とダクト）、吊り下がった蛍光灯 |
| surface | `surface.wallHoles` × 2 | 壁の黒い穴と奥の同じ壁紙 |
| surface | `surface.water` × 3 | 出所の無い水たまり（water ゾーン）、天井の黄ばみ、壁下端の濡れ |
| light | `light.mismatch` ○ 3 | 光源の無い明るい隅（emitOnly）、点いて見えるが暗い器具（glowOnly）、1 本だけ違う色温度 |
| light | `light.timeMix` × 2 | 昼の窓と夜の窓、別時刻の時計 3 個 |
| space | `space.pillarGrid` ○ 3 | 規則的な柱の格子（4.2〜6 m ピッチ）、1 本だけ抜け / 0.7 m ずれる |
| space | `space.partitions` ○ 3 | 壁材の間仕切り 3〜10 枚（天井 −0.5 か全高、3 割で L 字）。動線は塞がない |
| space | `space.lonelyObject` ○ 2 | 中央に 1 つだけ: 壁を向く椰子 / 椰子 1 脚の長机 / 向き合う 2 脚。真上に見えない光源 |
| space | `space.regularArray` ○ 3 | 同じ向きの椰子の格子（≤ 36）か段ボール箱の格子（≤ 240、strong は 2 段） |
| space | `space.scatter` ○ 2 | 段ボール・椰子・机がばらばらの向きで 8〜34 個 |
| trace | `trace.marks` ○ 3 | 引きずり跡だけ、机から引かれた椅子、食後の皿とコップ、放置カート |

## 広い部屋の扱い（2026-09-23）
主矩形 ≥ 90 m² で、足跡 0.25 m² 以上・高さ 0.4 m 以上のソリッド内装が 40 m² あたり 1 つ未満の部屋は「広くて空」とみなし、
正常判定を飛ばして `space` の主題を必ず 1 つ入れる（Legendary / Mythic は除外 = 広い空間を許容）。`space.*` は通常の主題候補にも入る。

## 統合時の判断
- `surface.shallowPits`（浅い穴）はユーザー指示で削除（2026-09-23）。
- 水たまりは 1 箱 = 1 つとし、RoomBuilder が 28 頂点の不定形の面（`puddleGeometry`）として描く（箱を重ねたボクセル状の見た目を解消）。
- `layout.steps`（床の段差だけの異変）はユーザー指示で削除（2026-09-23）。浅い穴（shallowPits）は残す。
- 水たまりは透過（transmission）を持たない `puddle` 材質にした（Common の部屋で毎フレームの透過パスが増えないように）。
- `trace` カテゴリを追加（痕跡が contents の添え物枠と競合しないように）。`countAnomaly` はほぼ全部屋で成立するので重み 3 → 2。
- MirrorOffset（U09）の `clipBox` / `reflectBox` が `kind` を落として奇妙さの箔が消えていたので `kind` / `propGroup` を保つよう修正。
- 残課題: `steps`(a) は instances / decals を持ち上げない。壁・天井の椅子は propGroup を外すため素の板になる（描画側に任意姿勢の入口があれば改善）。時計サインの文字は 2 m で読めない。吊り灯は箔 2 枚の近似。
