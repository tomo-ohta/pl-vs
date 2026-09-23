# 照明の焼き込みとライトマップ（担当 L1、2026-09-17）

対象: `src/render/SurfaceGeometry.ts`（頂点焼き込み `SurfaceLighting`）、`src/render/Lightmap.ts`（アトラス・uv1・DataTexture・Worker 通信）、
`src/render/lightmap.worker.ts`（計算カーネル + Worker 入口）、`src/render/RoomBuilder.ts`（結合ループへの組み込み・影の受け口・動的光）。
V04（器具に対応した光と遮蔽）の手順 2〜6 と V05 の「接地」を、頂点焼き込みの改良とテクセル単位のライトマップで扱う。GI ではなく静的な近似。

## 1. 方式

### 1.1 共有カーネル（`lightmap.worker.ts`）

three に依存しない純関数。頂点焼き込み（メインスレッド）と Worker（テクセル）が同じ関数を使うので、到着前後で照明の意味が変わらない。

- **器具（fixture）** = 発光箔（`SURFACES[mat].emission` のある箱）を面光源として packed（`FIXTURE_STRIDE = 16`: 発光面の中心、発光矩形の半径、発光法線、色、パワー、配光、サンプル数）。
  - 水平の薄いパネル（高さ < .3 m）: 下向き（床から 0.8 m 未満なら上向き）。トロファー / ダウンライトは **tight 配光** `D(c) = 0.1c + 0.9c⁸`、
    アスペクト ≥ 5 の露出管は **wide 配光** `D(c) = 0.45c + 0.55c³`（c = 発光法線と方向の cos）。
  - 壁の薄いプレート（最小辺 < .1、高さ < .6。壁灯・非常口サイン）: 室内側（footprint の内側）へ向いた wide 配光。パワーの下限は 0.06 m² 相当。
  - それ以外の発光箱（筐体・窓・スクリーン）は `LightingOverrides.areaEmitters` のときだけ中心 1 点の全方向放射（従来どおり）。E03 ロールは全て全方向放射。
  - パワー = `7 × clamp(面積, .35, 1.6) × (emission / 2.5) × powerScale(1.6)`。1.2 × 0.6 m トロファー ≈ 8.1。
  - **面サンプル**: 発光矩形を `ceil(辺 / 0.35)` で 1×1〜4×2 点に分け、`d < 3 × 器具の最大辺` の近い器具だけ面として積分（遠い器具は中心 1 点。差が出ない）。
    頂点焼き込みは 2×2 まで、Worker は 4×2。
- **距離減衰** `1 / (0.5 + d²) × (1 − d² / 14²)²`（14 m で滑らかに 0）。
- **反射光の広がり**（環境光の器具依存）: `B = Σ (パワー / 8) / (1 + d² / 4²)`、`S = 0.15 + 0.85 × (1 − exp(−B / 2.5))`。
  環境光 = `palette.ambient × 0.7 × S × (0.65 + 0.35 × max(0, ny))`。器具から遠い突き当たりは 0.15 倍まで沈む（従来は一定 × 0.75）。
- **遮蔽**: 直接光は器具ごとに線分判定（遮られると 0.06 倍）、反射光は同じ結果で 0.5 倍。
- **滲み（halo）**: 発光面より奥（天井側）0.35 m 以内の面に、器具の縁からの面内距離 r で `パワー × H / (1 + (r / 0.4)²)^1.5`（tight H = 0.035、wide 0.07、1.6 m で打ち切り）。
  トロファーの周りの天井が 0.3〜1 m だけ明るくなり、それより先で急に暗くなる。壁灯の周りの壁にも出る。
- **平行光**（FakeSky）と **空の環境光** は従来どおり（Worker では AO を掛ける）。

### 1.2 頂点焼き込み（`SurfaceLighting.bake`）

全ての箱に従来どおり `bakedLight` 属性を書く（ライトマップ到着前の表示 / low Tier / 小さな家具・プロップの最終値）。

- 器具は上の共有カーネルで評価。遮蔽判定は器具ごとに 1 本（従来 CorridorOffice の 4 点 × 4 本より安い）。
- 見た目用の細部（机の天板・棚板・柱）も遮蔽体に含める（V04 手順 3）。光を遮る判定は `isOccluder`（最小辺 8 cm、体積 0.05 m³）で絞る。
- 小さな箱（対角 < 1.2 m）: 距離依存の項（配光・減衰・遮蔽・反射光）を箱の中心で器具ごとに 1 回評価し、頂点では法線との内積だけ（対角 < 0.6 m は方向も中心固定）。
- 大きな箱（外殻・長机）: 頂点ごとに評価。遮蔽と接触陰影は「壁・柱・床・天井・体積 0.4 m³ 以上」だけを相手にする（椅子 2,000 脚との総当たりを避ける。椅子の影は Worker のテクセルが出す）。
- 滲みは頂点密度が足りる小さな箱（器具の金属トレイなど）だけ。天井スラブの滲みは Worker が担う（頂点 1.25 m 間隔では丸い光斑になるため出さない）。
- `sample(at)`（InstancedMesh / 可動箱）も同じカーネル（遮蔽なし、上向き面の 0.6 倍）。

### 1.3 ライトマップ（`Lightmap.ts` + Worker）

- **対象**: `isLightmapTarget` — 外殻（材質 floor / ceiling / wall / column で最大面 ≥ 1 m²）と対角 2 m 以上のソリッド箱。発光箔・ガラス・水・空・デカール・プロップ置換箱・特殊形状（円柱・球）は対象外（頂点焼き込みのまま）。
  legacy（M17）、E03 ロール、low Tier、Worker の無い環境ではライトマップ無し。
- **アトラス**（`allocateLightmapAtlas`）: 対象箱の 6 面ごとに矩形。見えない面は捨てる（面の中心 + 法線 12 cm の点が bounds の外 / footprint の外 / 外殻の箱の中、面積 < 0.02 m²）。
  内側 `ceil(w / texel) × ceil(h / texel)` + 外側 1 テクセルの縁。高さ優先の shelf packing、幅は 2 の冪、`maxSize` を超えたらテクセルを 1.3 倍して再試行。黒テクセル 2×2 を 1 つ確保。
- **uv1**（`writeLightmapUV`）: 結合前の BoxGeometry / RoundedBoxGeometry の各面グループ（materialIndex 0..5）に面内座標から書く。対象外の面・箱は黒テクセルを指す。
  three r186 の lightMap は `texture.channel = 1` で属性 `uv1` を読む。結合する全ジオメトリに uv1 を付ける（mergeGeometries の属性集合を揃える）。
- **テクスチャ**: `DataTexture(RGBA, HalfFloat)`、`NoColorSpace`、Linear、mipmap 無し、0 埋めで構築時に作る。材質は `materials.forRoom(mat, { roomId, seed, overrides, lightMap, lightMapIntensity: 1 })`
  を**構築時に**付ける（到着時に材質を差し替えるとプログラムが再コンパイルされて数十〜数百 ms 止まるため。0 埋めの lightMap は何も足さないので到着前は頂点焼き込みだけで描かれる）。
- **Worker**（`lightmap.worker.ts`、`new Worker(new URL('./lightmap.worker.ts', import.meta.url), { type: 'module' })`、1〜2 本のプール）: 面矩形・器具・遮蔽体（フラグ: 光の遮蔽 / AO）・平行光・環境光・bounds を転送。
  テクセルごとに: 埋まり判定（遮蔽体の中に入るテクセル = 壁の下の床など。近傍の有効テクセルで埋める dilation）→ AO（cos 重み付き半球レイ 24 本（mid 16）、到達 2.2 m、距離重み、3×3 ぼかし、下限 0.15）
  → 環境光 × S × AO + 直接光（近い器具は面サンプル + 縁 4 本の遮蔽レイ、7 m 以内は 1 本、遠い器具と反射光だけの組は 2 m セル × 器具のキャッシュで判定）+ 滲み + 平行光。
  遮蔽体は xz 2 m グリッド（CSR）を 2D DDA で辿る。結果は RGBA half float（`toHalf`）。
- **到着**: `texture.image.data` を差し替えて `needsUpdate`、ライトマップ対象の頂点範囲の `bakedLight` を 0 に（二重加算を避ける。範囲は結合時に記録）。材質・ジオメトリの再構築は無い。
  見えている部屋（`group.visible`）の job を先に処理する。
- **キャンセル / 破棄**: `RoomBuilder.dispose` が job を cancel（結果は捨てる）、テクスチャを dispose、`materials.releaseRoom` で部屋専用材質を捨てる。
- **決定論**: アトラス順序は箱の生成順、AO のレイ回転は面 / テクセルのハッシュ。ライトマップは (layout, tier) の関数。
- **検証用**: `built.lightmap`（`RoomLightmap`: width / height / texel / texels / faces / ready / workerMs / latencyMs / rays / vertexMean / texelMean / debug.rects）、
  `window.__lightmapBaker.stats`（done / cancelled / failed / workerMs）と `.pending`。

### 1.4 影の受け口（担当 P のシャドウマップ用）

外殻・家具の結合メッシュ: `castShadow = true`（発光箔・ガラス・水・空・デカールは false）、`receiveShadow = true`（発光箔は false）。扉パネル・扉枠・可動箱は投影・受影。
InstancedMesh（反復配置・プロップ）は受影のみ。`renderer.shadowMap` とライトの `castShadow` は Game / LightBudget 側。

### 1.5 動的光

PointLight は残す（床の鏡面反射用）。強度倍率 `DYNAMIC_LIGHT_SCALE` を 5 → 1.5（直接光の拡散は焼き込みが持つ。V04 手順 5）。
担当 M の `directDiffuseScale` が入れば 3〜5 に戻して拡散成分だけを落とす（`docs/visual-requests.md`）。

## 2. 調整値（`LIGHT_TUNING`）と輝度比

| 項目 | 値 | 意味 |
|---|---|---|
| powerScale | 1.6 | 器具パワーの倍率（露出 1.0 / 半球光 0.06 / envMap 拡散 0 の前提で、器具直下の床が旧方式の約 0.6 倍） |
| range | 14 m | 器具の到達距離（窓関数で滑らかに 0） |
| falloffC | 0.5 | 1 / (c + d²) |
| nearFactor | 3 | d < 3 × 器具の最大辺 で面サンプル |
| ambientScale | 0.7 | palette.ambient の係数（従来 .75。反射光 S で 0.15〜1 倍に変調） |
| bounceFloor / P0 / R0 / K | 0.15 / 8 / 4 m / 2.5 | 環境光の下限、正規化、広がり、飽和 |
| beamTight (mix, exp) | 0.1, 8 | 埋め込み器具の配光 |
| beamWide (mix, exp) | 0.45, 3 | 露出管・壁灯の配光 |
| occludedDirect / occludedBounce | 0.06 / 0.5 | 遮蔽時の残り |
| halo R / band / tight / wide / cutoff | 0.4 m / 0.35 m / 0.035 / 0.07 / 1.6 m | 天井の滲み |
| aoRadius / aoFloor | 2.2 m / 0.15 | AO |
| hemiBase | 0.65 | 上向き重み |

**輝度比（床の中心線、照度の線形値。合成廊下 幅 2.4 × 高 2.7 × 長 30 m、1.2 × 0.6 トロファー 3.6 m ピッチ、最後の器具から突き当たりまで 8.4 m。`scratchpad/kernel-ratio.mts` 相当の Node 計測）**

| 位置 | 照度 | 比（線形） | 比（表示値の目安、γ2.2） |
|---|---:|---:|---:|
| 器具直下 | 0.95 | 1 | 1 |
| 器具の間 | 0.42 | 0.44 | 0.69 |
| 突き当たり −3 m | 0.078 | 0.083 | 0.32 |
| 突き当たり | 0.044 | 0.046 | 0.25 |

目標の「1 : 0.45 : 0.15」（写真の表示値）に対し、器具の間は物理的にこれ以上暗くならない（隣の 2 台が照らす。3.6 m ピッチでは線形 0.45 が下限に近い）。
突き当たりは 0.25〜0.3 で、写真より明るいが真っ黒にはしない方針。トーンマップの露出は担当 P が 1.0 に下げる前提。

実部屋（C02 seed 7、床の中心線、Worker の結果）: 器具直下 0.61、器具の間 0.34、端の壁際 0.20（AO）。

## 3. Tier 別の挙動

| Tier | テクセル | アトラス上限 | AO レイ | 備考 |
|---|---|---|---|---|
| high | 0.25 m | 512² | 24 | 巨大部屋は 0.33 / 0.42 m… と粗くして 512² に収める |
| mid | 0.5 m | 256² | 16 | |
| low | 無し | — | — | 頂点焼き込みのみ（天井の滲み無し、遮蔽は近傍だけ） |

メモリ: RGBA16F で 128² = 128 KB、256² = 512 KB、512² = 2 MB / 部屋。保持部屋 16 で最大 32 MB。

## 4. 計測（MacBook / Chrome、開発サーバー）

同期構築（`window.__buildProfile`）。基準は本作業前（2026-09-16 夜）の同 seed。

| 部屋 | 箱 | bake 従来 | bake 現在 | ライトマップ計画 + uv1 | 備考 |
|---|---:|---:|---:|---:|---|
| C02 seed7 | 61〜66 | 13〜16 ms | 2〜5 ms | 0.2 + 0.2 ms | |
| C09 seed9 | 2,728 / 3,484（従来計測時 3,754） | 290 ms（0.077 ms / 箱） | 57 / 70 ms（0.020 ms / 箱） | 1.7〜3.4 + 1.5 ms | 大箱の遮蔽・接触を大きな遮蔽体に限定 |
| C06 seed9 | 389 | 36〜55 ms | 44 ms | 0.9 + 0.4 ms | 梁（大箱）が多い |
| C11 seed9 | 2,714 | 53 ms | 56 ms | 1.7 + 1.0 ms | |
| C15 seed9 | 1,235 | 80 ms | 95 ms | 0.6 + 0.8 ms | 棚の荷物（中箱）の頂点が多い（+19%） |
| C17 | 74 | 0.8 ms | 1 ms | | |

Worker（`built.lightmap.workerMs`、1 job あたり）: C02 5.1k テクセル 25〜100 ms、C14 6.9k 63〜82 ms、C15 22k 330〜630 ms、C11 33k 380〜530 ms、C09 53k 700〜1,300 ms（2 job 同時実行時 1.8 s）、C06 93k 290〜700 ms。
到着までの遅延は同時に構築された部屋数で 0.1〜2.2 s。

到着前後の平均輝度（対象頂点の bakedLight 平均 vs テクセル平均）: C02 0.15 → 0.23、C09 0.10 → 0.17、C06 0.036 → 0.078。
テクセル側が 1.5〜2 倍明るいのは天井の滲みと、大きな面の頂点焼き込みが接触陰影で全体に暗いため。画面の平均は破綻せず（C09 到着前後のスクリーンショットで確認）。

3 seed（7 / 11 / 23）× 10 部屋の踏破（`game.newWorld` + 隣接へテレポート、`game.step` 同期）: コンソールエラー 0、`world.log` の ERROR 0、Worker job 91 完了 / 13 取消 / 0 失敗、
`renderer.info.memory.textures` は同じ踏破を 2 回繰り返しても増えない（125 → 125。初回の増加はプロップ・CC0 素材の遅延読込）。`node tools/seam-stats.mjs --seeds 3 --rooms 40` 通過（Worker 無しの経路）。

## 5. スクリーンショットで確認したこと（`scratchpad/shots-l1/`、半球光 0.06 / 露出 1.0 / envMap 0 / 動的光 ×1 の前提値で撮影）

- C02: 器具直下の床の明るさの勾配、天井の器具まわりの滲み（0.3〜1 m で急に暗くなる）、壁の上下の勾配、突き当たりの壁が沈む、扉・巾木の足元の接触陰影。
- C09（4 チャンク）: 到着前（頂点）と到着後（テクセル）で平均の明るさが飛ばない。チャンク境界の床・天井に段差無し（境界の両側のテクセル差 平均 1〜4%、天井 ≈ 10%（値 0.05 前後の暗部））。
- C11: ロッカー列の足元と天井際が暗い、床の鏡面反射（動的光）が残る。
- C06: 器具（露出管相当）の下の床だけ明るく、間は暗い。天井（暗いコンクリート）はほぼ滲みのみ。
- 現状の統合状態（半球光 0.32 / 露出 1.25 / envMap .24）では上の勾配がほとんど見えない（一様な光が焼き込みの 2〜3 倍）。担当 M / P への依頼を `docs/visual-requests.md` に記載。

## 6. V04 との対応

| 手順 | 状態 |
|---|---|
| 1 器具定義の統合 | 一部: 発光箔から位置・面積・向き・色・パワー・配光を 1 つの packed 器具に導出（`buildFixtures`）。安定 ID は無い（箔の生成順） |
| 2 発光面の数点サンプル | 対応: 全器具 1×1〜4×2 点（近い器具のみ）。単一点の丸い光斑は解消 |
| 3 見た目用の遮蔽形状 | 対応: 見た目用の細部を遮蔽体に含め（AO は薄い部品も）、光の遮蔽は体積で絞る。自己遮蔽除外はオブジェクト参照（Worker はレイの開始点を面から 2 cm 浮かせて不要） |
| 4 線分全域の遮蔽体 | Worker: 対応（2 m グリッドを DDA）。頂点焼き込み: 近傍のみ（従来どおり。コストのため） |
| 5 焼き込みと動的光の役割 | 対応（本書）。動的光の拡散を材質側で落とす uniform は担当 M へ依頼 |
| 6 頂点密度 | テクセル（0.25 / 0.5 m）で置き換え。頂点分割は変えない |
| 7 ライト選択のヒステリシス | 担当 P（LightBudget） |
| 8 扉開閉の光漏れ | 対応（担当 P1、2026-09-21）: 焼き込みは変えず、加算合成クワッド `src/render/DoorLeak.ts` で開いた扉の床・壁に落とす（本書 8 章） |
| 9 色温度・明滅 | 色温度は対応（担当 P1、2026-09-21）: テンプレート別の色温度範囲から部屋 seed で選ぶ（本書 9 章）。明滅は担当 W の wear |

V05「接地」: 家具の足元・壁の入隅は AO レイと接触陰影で暗くなる。浮いて見える家具の位置そのものは対象外。

## 7. 未対応・既知の制約

- glTF プロップ（PropCatalog）と InstancedMesh は到着前はインスタンスごとの一定値（`sample`）、到着後は足元の床のライトマップ値（第 8 節。頂点単位のライトマップは無い）。
- 到着時は 0.5 s のクロスフェード（第 8 節）。見えていない部屋は最初の描画前に確定する。
- 隠れ面の判定はヒューリスティック（bounds の外 / footprint の外 / 外殻の中）。多層の Mega では中間スラブの両面を焼く。
- 面の縁のテクセルは 5 mm 内側で評価し、壁の下に埋まるテクセルは近傍で埋める。壁と床の入隅の暗さは AO 由来（接触陰影は頂点焼き込みのみ）。
- 頂点焼き込みの遮蔽は箱の近傍だけ（遠い壁を透過し得る）。ライトマップ到着後は Worker の結果で置き換わるが、low Tier では残る。
- 部屋あたりの材質 clone は「ライトマップ対象を含む材質」の数（4〜25）。プログラムは `-lm` 族で共有。
- 巨大部屋（Mega）のテクセルは 0.33〜0.5 m まで粗くなる。AO レイ 24 本は 3×3 ぼかし前提。
- `src/generators/decals.ts` の未使用 import（担当 D）で `tsc` に 1 件エラーが出る（本作業と無関係）。

## 8. 扉の光漏れ（V04 手順 8。担当 P1、2026-09-21）

ファイル: `src/render/DoorLeak.ts`（新規）、配線は `src/game/Game.ts`（`doorLeaks` / `syncDoorLeaks` / `leakRarityOf`）。

### 8.1 方式

- **PointLight は増やさない**（可視ライト本数は `padVisibleLights` で Tier 固定、影は 1 灯のまま）。焼き込み（頂点 / ライトマップ）も変えない。
- 開いた扉ごとに、**その床がある部屋 X の側**へ 1 件の Leak を置く（キー `X/portalId`）。向こうの部屋 Y の側は Y 自身の戻り Portal を辿ったときに作られる
  （両側の部屋がそれぞれ「向こうの色」を受ける。片側にしか Portal が無い直結は片側だけ）。
- 形状（socket のローカル座標。+Z 外向き、部屋の内側は -Z、壁の内面 z = -0.15）:
  - 床の扇形: 台形 3×2 分割 = 12 三角形。扉側 z = -0.16、奥へ L = clamp(2.5 + (幅 - 1)·0.8, 2.5, 3.5) m、半幅は 幅/2 + 0.1 → 幅/2 + 0.9 L（約 42° の広がり）。床から 1.2 cm。
  - 壁の洗い: 開口の両脇（枡の見付の外側 12 cm から）0.4 m 幅 × 開口高 + 0.25 m の縦の帯 2 枚 = 4 三角形。壁面から 2 cm。
  - Seam 扉: 洗い 4 + 縦枡の流れ 8（開口内側の枡面 2 枚 + 見付の室内側の縦帯 2 枚）+ 床の乗算 12 = 24 三角形。
  - 予算: 扉 1 枚（片側）16 三角形、Seam 24、同時 ≤ 24 枚（`MAX_LEAKS`）。Legendary の火花は Points 16 点（三角形数に含めない）。
- テクスチャ: 共有 CanvasTexture 1 枚（256×128 のアトラス。左半分 = 扇形の alpha: 横は余弦窓^1.4、奥行きは (1 - v)^1.9。右半分 = 洗い: 枡側から (1 - u)^2.2 × (0.12 + 0.88 (1 - v)^1.5)）、
  Seam の流れ用 32×128（縦に繰り返し）、火花用 32×32。
- 材質: 小さな `ShaderMaterial`（uMap / uColor / uAlpha / uOffset、頂点色で左右 2 色）。加算は `AdditiveBlending` + `tonemapping_fragment` / `colorspace_fragment`
  （composer の RenderTarget 描画中は three が無効化するので、線形 RT に加算 → まとめてトーンマップ。直接描画のときは `setDirectRender(true)` で強度 ×0.6）。
  床の乗算（Seam）は `MultiplyBlending` + `premultipliedAlpha`（r186 は `out = dst × (src.rgb + 1 - src.a)` なので src = (color·m, m)）。
- **GTAO からの除外**: GTAOPass は Points / Line だけを隠し Mesh は `scene.overrideMaterial` で不透明に描くため、床から 1 cm 浮いたクワッドが AO に「面」として写り、硬い縁の明るい矩形が出た。
  `onBeforeRender` で渡された material が自分のものでない（override 中）ときだけ `geometry.setDrawRange(0, 0)` にして描かず、`onAfterRender` で戻す（PostFX は触らない）。
- 開閉との同期: `Game.updateVisibility` の末尾で `syncDoorLeaks()`（扉の開閉 `toggleDoor`、自動閉扉 → `refreshStreaming`、入室、後回し構築の完了、Modifier が開けた扉 → `doorsChanged` の全経路）。
  0.3 s（`FADE_SEC`、smoothstep）でフェードイン / アウト。部屋が dispose された（`streaming.built` に無い）Leak は即座に消す。`newWorld` / `loadWorld` は `clear()`。
- 置かない条件: 閉じた扉（`world.portalOpen` false）、Seam 以外で向こうが未配置、E03（`layout.roll` のある部屋）、door 以外の Portal（穴・階段・street は開口が常に開いていて向こうも描かれる）。
- アダプタ（前室・階段）の向こうは、そのアダプタがパレットを借りている部屋（`adapter.paletteFrom`）のレア度で色を決める。Legendary の前室へ続く Common の扉が金色に光る。

### 8.2 レア度別の色と動き（`LEAK_STYLE`。alpha = 扇形中心の加算強度、洗いはテクスチャ側で同じ最大値）

| 向こうの部屋 | 色 | alpha | 動き |
|---|---|---|---|
| Common | 向こうの `palette.lightColor`（最大チャンネルを 1 に正規化） | 0.14 | なし |
| Uncommon | 0xe4ffcc（わずかに黄緑がかった白） | 0.20 | なし |
| Rare | 0x58ecff（澄んだシアン） | 0.28 | なし |
| Epic | 0x8f4dff ↔ 0xff4fd6（紫〜マゼンタ） | 0.34 | 6 s で色を往復、3 s の弱い脈動（0.9〜1.0） |
| Legendary | 0xffc548（金） | 0.42 | 2 s の脈動（0.7〜1.0）+ 床の光の中に漂う金の火花（Points 16、0.1〜0.24 m/s で上昇、0.4〜0.7 m で再生成） |
| Mythic | HSL(hue, 1, 0.62) | 0.48 | 4 s 周期で色相が 1 周 + 1.2 s の強い脈動（0.55〜1.0） |
| Seam 扉（開） | 左 0x3ae6ff シアン / 右 0xff3ad2 マゼンタ（部屋の内側から見て） | 流れ 0.42 / 洗い 0.25 | 縦枡を上へ流れる（UV 0.9 /s）、30 Hz の時刻 hash フリッカー（0.55〜1.0、8% で 0.15 へ落ちる）。床は乗算で暗く（色 (0.35, 0.4, 0.55)、強さ 0.6 × (0.75 + 0.25 フリッカー)） |
| Seam 扉（閉、6 m 以内） | 同じ 2 色 | 床の帯 0.31 / 流れ 0.14 | 8.5 節。パネル下端の隙間から床へ 0.25 m の 2 色の帯 + 枡に沿う幅 4 cm の細い流れ（開いた Seam の 1/3）。同じフリッカー |

- Low Tier（`tier.flicker` false）: 脈動は中央値で固定、火花なし。色相回転と Seam の流れは uniform だけなので残す。
- 上限の目安: Legendary の扇形中心で +0.42 × 金（線形）。器具直下の床（焼き込み 0.5〜0.8）より少し明るい程度で、飽和はしない（composer では bloom が少し乗る）。

### 8.3 確認（2026-09-21、MacBook / Chrome、high Tier `gtao×0.4+bloom+msaa2`）

- seed 7: `?force=E06` / `L16` / `M01` で開始部屋 C02 の扉の先を Epic / Legendary（前室）/ Mythic にして開扉。マゼンタ / 金 + 火花 / 色相回転を確認。探索で見つけた Rare（R06）はシアン。
- Seam: `r1.portals.find(p => p.seam).open = true` で強制して確認（実プレイでは Seam 扉は開けた瞬間に遷移するので open にならない。8.4）。
- 掃除: 閉扉 → 30 フレームで Leak 0、`newWorld` → 0、scene に `leak:*` の残りなし。
- perf（120 フレーム中央値）: 漏れ 2 枚あり cpu 5.4 ms / gpu 9.09 ms、なし cpu 5.4 ms / gpu 9.09 ms。差なし。コンソールエラー 0。

### 8.4 残課題

- 開いた Seam 扉の演出（8.2 の「開」）は Modifier が `portal.open = true` にした Seam 扉にしか出ない（`toggleDoor` は開けずに遷移。現状その Modifier は無い）。本編で見えるのは 8.5 の閉じた Seam 扉の漏れ。
- 火花・脈動は Points / uniform のみで、床の焼き込みに動きは入れていない。
- 扉パネル自体の面（開いたパネルの裏面）に落ちる光は未対応。

### 8.5 閉じた Seam 扉の漏れ（統合の仕様判断、2026-09-21）

閉じた扉に漏れを置くのは Seam 扉（`portal.seam`、door 型）だけ。他のレア度の閉じた扉には何も置かない。

- 形状（8 三角形）: パネル下端の隙間から床へ漏れる 2 色の帯 2 枚（左半分シアン / 右半分マゼンタ。幅 = 扉幅の半分ずつ、扉側 z = -0.16 から奥行き 0.25 m。アトラスの扇形の片側を使い、中央が明るく外側と奥へフェード）+
  枡の見付に沿う縦の細い流れ 2 枚（幅 0.04 m = 開いた Seam の 1/3、開口高 + 0.05 m、既存の流れテクスチャを上へ流す）。`createSeamClosed` / `updateSeamClosed`。
- 強度: 床の帯 0.14 × 2.2 = 0.31、流れ 0.14（開いた Seam の 1/3）。30 Hz の時刻 hash フリッカーは開いた Seam と同じ式。
- 表示条件: プレイヤーの足元から socket まで水平 6 m 以内（`SEAM_CLOSED_RANGE`）。扉イベントが無くても近づく / 離れるで出し入れするため、`Game.stepBody` が 0.25 s ごとに `syncDoorLeaks()` を呼ぶ（範囲外になった Leak は 0.3 s でフェードアウト）。
  同期は可視の構築済み部屋の Portal を舐めるだけ（seed 7 で cpu 中央値に差なし）。
- 確認（seed 7 `?force=L16`、開始部屋 r1 の `entry` が Legendary 遠方配置の Seam 扉）: 8 m → Leak 0、2.4 m → `r1/entry seamClosed` 1 件（8 tri）、7.5 m へ離れて 45 フレーム → 0。
  スクリーンショット: 閉じたパネルの両脇に細いシアン / マゼンタの縦の筋、パネル下端の床にシアン | マゼンタの短い帯。コンソールに P1 由来のエラー無し。

## 9. 色温度（V04 手順 9。担当 P1、2026-09-21）

ファイル: `src/generators/presets.ts`（`KELVIN_RANGE` / `blackbodyRgb` / `kelvinToLightColor` / `kelvinRangeFor` / `applyLightKelvin`）、呼び出しは `src/generators/index.ts` の `generateLayout`（Generator の前）。

- テンプレートごとに色温度範囲 [Kmin, Kmax] を持ち、部屋 seed の専用 fork `p.rng.fork('kelvin')` で 1 値（10 K 刻み）を選ぶ。既存の乱数列は消費しないので他の生成結果は変わらない
  （`node tools/seam-stats.mjs --seeds 3 --rooms 40`: deterministic true / overlap 0 / loadMismatch 0）。
- 黒体近似は Tanner Helland の式。**白バランス 4,600 K**（その色温度が無彩色の白）で割り、最大チャンネルを 1 に正規化（明るさは色温度で変えない）。
  既存パレットの「病院 0xf3f6ff がわずかに青、ホテル 0xffc98a が電球色」に一致する。
- `palette.lightColor` を置き換え、`palette.ambient` は輝度を保ったまま色味を 45% 器具色へ寄せる（焼き込みの環境光 = `palette.ambient` と半球光が追従する）。
- 対象外（色温度化しない）: lightingPreset が 青 / 水族 / 水中、器具が lightPanel / lightWarm 以外（ledBlue / sodium など）。
  lightingPreset の語が範囲を上書き: 暖色 / 電球 / 橙 / 夕 / 琥珀 → 2,700〜3,100、冷白 / 均一 → 4,200〜4,800、蛍光 / 白色 → 3,900〜4,500。
- 順序は 生成（ここで決定）→ dressing → Modifier。FakeSky / LightingPhase / EraPreset / ZoneThemeShuffle / MaterialGradient / Mythic・Legendary のドレッシングの上書きはそのまま残る。

| テンプレート | K 範囲 | 目安の色（4,600 K 白バランス） |
|---|---|---|
| CorridorOffice / OfficeGrid / Restroom / PoolCorridor | 4,000〜4,600 | 0xffefdd〜0xffffff |
| CorridorSchool / Classroom / LockerRoom / GenericRoom / DynamicGrid | 3,800〜4,400 | 0xffe9d1〜0xfffaf4 |
| CorridorHospital | 4,300〜5,000 | 0xfff7ef〜0xedf6ff |
| ServerGrid | 4,200〜4,800 | 0xfff5eb〜0xf5faff |
| CorridorHotel / Theater | 2,700〜3,100 | 0xffc174〜0xffd19b |
| CorridorEntertainment | 2,700〜3,000 | 0xffc174〜0xffce92 |
| ApartmentCorridor（住居） | 2,800〜3,200 | 0xffc67f〜0xffd5a4 |
| CorridorService / Bridge / StorageGrid / ServiceMaze / VerticalCore / StreetGrid / RoadGraph（地下・設備） | 3,400〜4,000 | 0xffdcb4〜0xffefdd |
| RetailRoom / RetailGrid / WarehouseGrid / MazeGrid / OrganicZone（店舗・倉庫） | 3,600〜4,200 | 0xffe3c3〜0xfff4e9 |
| ParkingGrid / TransitCorridor / Terminal / LargeRoom | 3,900〜4,500 | 0xffecd7〜0xfffcfa |
| GenericCorridor / SmallRoom | 3,700〜4,300 | 0xffe6ca〜0xfff7ef |
| AtriumLobby | 3,400〜4,000 | 0xffdcb4〜0xffefdd |
| Gallery | 3,200〜3,800 | 0xffd5a4〜0xffe9d1 |
| ShelfGrid | 3,300〜3,900 | 0xffd9ac〜0xffecd7 |
| PlayArea | 3,000〜3,600 | 0xffce92〜0xffe3c3 |
| （未定義） | 3,800〜4,400 | |

確認（seed 7）: C02 0xfffefc、C06 0xfff2e4 と 0xfffbf7（同じテンプレートで異なる）、C16 0xfff8f1、C15 0xfff3e6、C17（ホテル系）0xffcd92。

**制約**: 焼き込み（`SurfaceGeometry.buildFixtures`）は発光箔の色を `SURFACES[mat].color`（lightPanel 0xedf0d9 固定）から取り、器具の面の色も材質側で固定なので、
色温度が効くのは動的 PointLight（鏡面反射）・`palette.ambient` 由来の環境光・半球光・光漏れ（Common の色）まで。焼き込みと器具面を `palette.lightColor` に追従させる依頼を `docs/visual-requests.md`「P1 → 各担当」に記載。


## 8. 第 7 回（2026-09-21、担当 P3）: クロスフェード / インスタンス照明 / glowOnly / 色温度

### 8.1 到着前後のクロスフェード（`Lightmap.ts: startLightmapCrossfade`, `LIGHTMAP_FADE_MS = 500`）

- 到着（`apply`）時に対象頂点の bakedLight を 0 埋めせず、材質の `lightMapIntensity` を 0 にしてから、見えているメッシュの `onBeforeRender` で
  `lightMapIntensity = t`・対象頂点の `bakedLight = 元の値 × (1 − t)`（t: 0 → 1、0.5 s）を書く。両方とも indirectDiffuse に線形に足されるので明るさの合計は一定。
- シェーダ注入は不要（`lightMapIntensity` は three の標準 uniform）。頂点属性の GPU 反映は書いた次のフレームなので、uniform には前フレームに書いた t を使う（`renderer.info.render.frame` で 1 フレーム 1 回進める）。
- 完了で対象頂点を 0 埋め・intensity 1・フックを外す。見えていない間に完了時刻を過ぎたメッシュは最初の描画前に確定（共有材質の intensity を巻き戻さない）。
- コスト: フェード中の 0.5 s だけ、見えている対象メッシュの bakedLight 属性を毎フレーム再アップロード（M11 で CPU median 1.4 ms、変化なし）。
- 計測（M11 を `game.streaming.rebuild` で見ながら再構築、rAF で `lightMapIntensity` を記録）: 到着 599 ms → 606 ms 0.009 → 652 ms 0.105 → 766 ms 0.332（0.5 s の直線）。
  同時にインスタンスの値も 0.0577 → 0.0536 → 0.0452（目標）へ補間。到着前 / 途中 / 後のスクリーンショットに段差なし。
- 検証用: `RoomLightmap.fadeMs / appliedAt`、対象メッシュの `userData.lightmapFadeDoneAt`。

### 8.2 InstancedMesh / glTF プロップの照明（`Lightmap.ts: LightmapSampler, InstanceLighting`）

- 反復配置（`buildInstances`）と glTF プロップ（`installProps`）の `bakedLight`（InstancedBufferAttribute、インスタンスごとの一様値）を部屋の `InstanceLighting` に登録する。
  登録時に [x, 底面 y, z, 半幅 x, 半幅 z] のプローブを持つ。
- 到着時: `LightmapSampler`（atlas.faces の上向き面 = 床・大きな家具の天板を CPU で双一次サンプル）で「底面中心 + 足跡の外周 4 点（半幅 + 0.25 m）」の床の値の平均を目標にする。
  真下だけでなく周囲を見ることで、器具の間 / 隅 / 大きな遮蔽の影は拾い、自分の接地 AO で全体が沈むのは避ける。
- 目標値には「旧値（`sample` の定数）の平均輝度 / 床の値の平均輝度」（0.5〜1.2 にクランプ）を掛け、部屋全体の明るさは変えずに位置による濃淡だけを足す。
  E09（seed 11）: 96/96 インスタンスが床を拾い、比 1.01。机の値が 0.185〜0.334（到着前 0.14〜0.31）。M11: 511 中 135（1 階の扉のみ。上階の扉は真下 2.5 m 以内に床が無い）、比 1.2（クランプ）。
- 到着後の登録（遅延読込の glTF）は目標値を即書く。フェードは 8.1 と同じ 0.5 s（各 InstancedMesh の onBeforeRender）。
- 注意: `BakeRequest.faces` は Worker へ転送されて元配列が空になるので、RoomBuilder は `atlas.faces.slice()` を渡す（サンプラは元の atlas を使う）。
- 検証用: `RoomLightmap.instances = { ratio, sampled, total }`。

### 8.3 見た目だけ光る発光箔（`SurfaceGeometry.ts: isGlowOnly`）と小発光体の間引き

- `Box.kind === 'glowOnly'` または `kind` が `glow:` で始まる発光箔は器具（面光源）に数えない（emissive はそのまま）。器具の収集は `buildFixtures` だけなので、
  頂点焼き込み（`bake` / `sample`）と Worker（packed 器具を受け取る）は自動的に同じ判定になる。`PropCatalog.candidates` は未知の kind を空で返すので planProps に影響なし。
- M11（`mythic.ts: dressM11`）の扉灯を InstancedMesh から 122〜139 枚の glowOnly 箔に戻した（faceRuns に影響しないよう全段の配置後にまとめて `add`）。
  構築時間（seed 7、bake / total ms、初回 + rebuild ×2）: 箔なし（旧 InstancedMesh 相当）98/170, 66/104, 65/103 → glowOnly 139 枚 117/200, 82/130, 70/108 → 同じ 139 枚を器具に数えると 353/444, 233/290, 211/256、Worker 155〜194 → 387〜416 ms。
  glowOnly は箔なしとほぼ同じ（+5〜15 ms は 139 箱のジオメトリ分）。
- 発光面積 < 0.2 m²（`LIGHT_TUNING.smallEmitterArea`）の器具は距離に関わらず中心 1 点でサンプル（`buildFixtures` の nu/nv と `fixtureIsNear` が同じ閾値）。
  E09 のモニター（screenLcd 0.52 × 0.32 = 0.17 m²、16 枚）が 2 → 1 サンプルになる。E09 の計測は 16 枚では差がノイズ（bake 47〜60 ms、Worker 231〜238 ms、レイ数同じ）。小発光体が多い部屋（サイン列・LED）向け。

### 8.4 器具の光の色 = 材質色 × palette.lightColor（P1 の色温度）

- `buildFixtures` で器具材質（lightPanel / lightWarm / lightCool / lightYellow / lightGreen / ledBlue / sodiumLight。`isLightFixtureMat`）の色に
  `layout.palette.lightColor`（`kelvinToLightColor` で白バランス済み）を掛ける。スクリーン・サイン・窓は材質色のまま。packed 器具が Worker へ渡るのでライトマップも同じ色。
- 確認（seed 7、ライトマップの上位 20 テクセルの R/B）: C02 fffefc 1.18（材質のみの期待 1.22）、C06 fff2e4 1.55（期待 1.57）、C07 fffbf7 1.28（期待 1.31）、C08 ffc47c + lightWarm 10.2（材質のみ 3.1）。
- 未対応: 区画ごとに器具色を差し替える Modifier（EraPreset / ZoneThemeShuffle の recolorLights）の区画別の色（palette は部屋に 1 つ）。
  ParkingGenerator / VerticalGenerator の LightSpec は 0xdfe8ff 固定なので、C06 では動的光（冷）と焼き込み（palette の暖）の色が合わない → P1 へ依頼（docs/visual-requests.md）。

### 8.6 変更（2026-09-22）: 閉じた扉の隙間の漏れ / 開いた扉は向こうの器具色

- 閉じた通常扉（8 m 以内）: パネル下端の隙間から床へ 0.25 m の帯を置き、レア度の色（8.2 の表の色・動き）で僅かに光る（alpha は表の 1/2、火花なし。`DoorLeak.createClosedRarity`、`CLOSED_LEAK_SCALE` / `CLOSED_RANGE`）。
- 開いた扉: 扇形と壁の洗いは残すが、色は向こうの部屋の `palette.lightColor`、強度は `OPEN_LEAK_ALPHA` 0.08 の一定（脈動・色相回転・火花なし）。レア度の演出は閉じた扉の隙間だけに残る。
- Seam 扉（開・閉）は 8.5 のまま。エントリのキーは開閉で分け（`…/c`）、状態が変わると 0.3 s でフェードして入れ替わる。

### 10. 懐中電灯の拡散（2026-09-22）
`PlayerFlashlight`: 半角 26° → 43°、ペナンブラ 0.78 → 1.0、放射状の減衰マップ（芯 exp(−(r/0.34)²) × 0.7 + 裾 (1 − r)^1.6 × 0.3、縁で 0）を `SpotLight.map` に投影。照らした場所の円形の縁が消え、周囲がわずかに明るくなる。中心の明るさを保つため intensity × 1.4。

### 10.1 近接減光（2026-09-23）
視線方向の最寄りのソリッド（現在の部屋 + 隣接の当たり判定、スラブ法で 6 m まで）までの距離 d を毎フレーム求め、懐中電灯の強度に `clamp((d/3)^1.8, 0.07, 1)` を掛ける（0.12 s で追従）。扉や壁に近づいても照らした面が白飛びしない。基本強度も × 1.4 → × 1.2 に下げた。
