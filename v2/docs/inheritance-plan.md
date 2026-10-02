# v2 継承計画（v1 からの引き継ぎ方）

2026-10-01 作成。v1（`v1/`、タグ `v1-final`）のコードを調べ、v2 の新機能（マルチプレイ・体力・新しい部屋生成）に合わせてどう引き継ぐかを決めるための資料。
v1 は**複製しない**。下の台帳に沿って、モジュールごとに「新しい設計に合わせて直したうえで移す」。

---

## 1. v1 を調べて分かったこと（要点）

### 良いところ（そのまま土台になる）
- **論理データと描画が分かれている**: 世界の正本 `RoomGraph`（`v1/src/world/RoomGraph.ts`）と部屋の中身 `RoomLayout`（`v1/src/generators/layout.ts:230`）は three.js を使わない純データ。`tools/seam-stats.mjs` が Node 上で生成を丸ごと動かしている＝サーバーで動く実績がある。
- **部屋 1 つの生成は決定論**: 乱数は `Rng`（mulberry32 + `fork(tag)`、`v1/src/core/rng.ts`）を `roomSeed(worldSeed, roomId)` から分岐。生成の各段（生成器 → 装飾 → 奇妙さ → Modifier → 汚れ → デカール）が別の乱数列を使う。
- **描画・音はデータを受け取るだけ**: `render/` と `audio/` は Game / WorldManager を import しない。撮像ルック（PostFX / LensPass / VideoPass）や音の合成はほぼそのまま使える。
- **移動と当たり判定の中身は数値計算だけ**: AABB の軸ごとの押し出し（`v1/src/player/PlayerController.ts:390-616`）。

### マルチプレイの妨げになるところ（v2 で設計し直す）
1. **世界の形が「歩いた順番」で決まる**: 部屋 ID が作成順の連番（`r${nextId++}`）で、抽選の重みはプレイヤーの履歴（直近のレア度・発見済み）で変わり、配置は既存部屋との干渉で決まり、後から他の部屋の扉を足す・消す。さらに「描画済みの部屋は作り直さない」（`frozen`）が生成結果を左右する。→ 2 人が別方向へ歩くと世界が食い違う。
2. **「プレイヤー 1 人 = カメラ」が前提**: `Game.ts`（1,770 行）が 1 人分の player / camera / currentRoomId / ride / state を持ち、ループ・世界の変更・描画・UI・音を 1 か所で回している。読み込み範囲（今の部屋 + 1 hop）、自動閉扉（4 秒・1 人からの距離）、エレベーター・乗り物、Modifier の onEnter / update も 1 人基準。
3. **当たり判定が描画側にある**: コライダとゾーンのワールド座標化は `RoomBuilder`（描画）の中（`v1/src/render/RoomBuilder.ts:390-448, 900`）。扉の当たり判定は扉アニメの角度で決まる。→ サーバーでは描画せずに当たり判定を作れない。
4. **可変フレームで進む**: `dt = min(0.05, delta)`。加速・重力がフレームレート次第。→ サーバーとクライアントの結果が合わない。
5. **部屋 ID ごとの特殊処理が多い**: 生成系約 36k 行のうち約 25% が部屋 ID 別（`dressing/` 7.6k 行は 100% ID 別）。日本語の自由記述を正規表現で読む箇所が約 20。
6. **セーブが 1 枠**: localStorage の 1 スロットに世界とプレイヤーを一緒に入れている。

### 体力の受け皿
v1 は「HP なし」（決定 D1）なので受け皿が無い。`RoomDefinition.dangerTag` は表示だけ。ゾーン（`ZoneKind`: water / friction / force / lane …）の仕組みに `hazard` を足すのが自然。

---

## 2. v2 の骨組み（提案）

```
v2/
├─ core/     純 TypeScript（three・DOM 禁止。サーバーとクライアントで共有）
│   ├─ math/       rng・aabb・幾何
│   ├─ world/      世界グラフ（順番に依存しない ID）・永続化の型
│   ├─ gen/        新しい部屋生成（RoomLayout を返す純関数）
│   ├─ sim/        固定 tick のシミュレーション: 移動・当たり判定・扉・体力・ゾーン
│   └─ protocol/   通信メッセージの型（入力・差分・イベント）
├─ client/   Vite + three.js: 描画・音・UI・入力・通信・予測と補間
├─ server/   権威サーバー: ワールドの tick・永続化・入室管理
├─ data/     定義データ（新しいスキーマ。型付きの列だけ）
└─ docs/
```

### 守る決まり
- **core は three / DOM を import しない**。tsconfig を分けて（`lib` に DOM を入れない・`types` に three を入れない）型チェックで機械的に守る。v1 では `modifiers/types.ts` が描画層の型を引き込み、境界が崩れていた。
- **1 人で遊ぶときもサーバー経由**: シングルプレイは「手元（Web Worker か同じタブ内）で動くサーバー」に 1 人が繋がる形にする。最初からこの形にしておけば、マルチプレイのために作り直さずに済む。
- **シミュレーションは固定 tick**（例: 30 Hz）。描画は補間。カメラの演出（手持ち感・視線の遅れ）はクライアントだけの層に置く。
- **世界の形は「どこにあるか」で決める**: 部屋の ID を作成順ではなく、親の部屋とソケット（または空間の区画）から導く。抽選はプレイヤーの履歴に依存させない（必要ならワールド単位の状態にする）。配置の衝突はサーバーが先着で確定する。
- **当たり判定は layout + 配置から作る純関数**（core/sim）。描画はその結果を見るだけ。扉の当たり判定は論理状態（open / closed）で決める。
- **部屋 ID の直書きは禁止**。違いはデータ（型付きの params）で表す。
- **保存領域の名前は `liminal2.*`**（v1 と同じ公開元に置くため）。
- **素材の配信元は設定で指定する**: `VITE_ASSET_BASE`（既定は BASE_URL）。本番は v1 と同じ `/pl-vs/` の素材を読み、v2 のビルドには素材を複写しない（`publicDir` は開発時だけ `../shared/public`）。

---

## 3. 移植台帳

区分: **A** = ほぼそのまま移す（直すのはグローバル変数・素材の場所・保存名だけ）／ **B** = 分解・書き直して移す ／ **C** = 作り直す（v1 は参考のみ）。
移すときは、この表の「v2 の行き先」と状態を更新し、移した元（`v1/src/...` と `v1-final`）をファイルの先頭に書く。

### 土台（core）

| v1 | 区分 | v2 の行き先 | やること |
|---|---|---|---|
| `core/rng.ts` | A | core/math | `randomWorldSeed` だけクライアント側へ |
| `core/aabb.ts` | A | core/math | — |
| `core/types.ts` | B | core/world・client | 画質・描画効果の型はクライアントへ。実行時だけの値（`passedAt`）は分ける |
| `world/RoomGraph.ts` | B | core/world | 構造は流用。ID を位置由来に、個人の履歴（visitLog・発見済み）を PlayerState へ |
| `world/RarityGenerator.ts` | B | core/gen | 純関数として流用。入力をワールド単位に、`forcedRoomId`（import 時に URL を読む）を除く |
| `world/WorldManager.ts` | C | core/world・core/gen | 配置・成長・再レイアウトは作り直す。`placementFor` / `socketWorld` / `spawnPointOf` / `portalOpen` などの幾何の補助だけ抜き出す |
| `save/SaveManager.ts` | C | server | WorldSave（seed・グラフ・扉・Modifier 状態）と PlayerSave（位置・部屋・HP・履歴）に分ける。生成器とデータの版のハッシュを必ず入れる |

### シミュレーション（core/sim）

| v1 | 区分 | v2 の行き先 | やること |
|---|---|---|---|
| `player/PlayerController.ts` | B | core/sim（移動）＋ client（カメラ） | 固定 tick の純粋な移動処理と、カメラの演出（`cameraFeel`・`syncCamera`）に分ける。クライアントの予測にも同じ移動処理を使う |
| `RoomBuilder.ts` のコライダ・ゾーンのワールド化（390-448, 900） | C | core/sim | `collidersOf(layout, placement)` / `zonesOf(...)` という純関数として作り直す |
| `streaming/RoomStreamingManager.ts` | B | client | 描画の読み込み管理は流用。自動閉扉と当たり判定の取得は sim へ。読み込み範囲は「自分の位置基準」と明記する |
| `player/PlayerRide.ts` | B | core/sim・client | 進行はサーバーの時刻で決め、補間と揺れはクライアント |
| `player/PlayerProxy.ts` | B | client | 姿勢履歴（PoseHistory）はリモートプレイヤーの補間に流用 |
| `input/InputController.ts` | B | client | 入力に連番と tick を付け、`tap`（画面座標）を「この扉を開けたい」という論理的な要求に変える |
| `game/Game.ts` | C | server・client | サーバーの tick、クライアントの予測、描画の 3 つに分けて作り直す |

### 部屋生成（core/gen）

| v1 | 区分 | v2 の行き先 | やること |
|---|---|---|---|
| `generators/layout.ts`（型） | B | core/gen | 核として残す。描画用のヒントを分け、`hazard` ゾーン・`spawns[]` を足す |
| `generators/footprint.ts`・`reach.ts` | A | core/gen | 矩形・壁区間・ソケット・到達判定。出現位置の検証にも使う |
| `generators/common.ts`・`furniture.ts` | B | core/gen | 部品は汎用。v1 固有の家具配置を除く |
| `generators/index.ts`（段の並び） | B | core/gen | 「段ごとに乱数を分ける」構成は流用。部屋 ID 前提の段を外す |
| `oddity/index.ts`・`shared.ts` | B | core/gen | 「適用 → 到達確認 → だめなら取り消す」カタログ方式は流用価値が高い。中身は選んで移す |
| `decals.ts`・`wear.ts`・`presets.ts` | B | core/gen | ルール型は流用。ID 例外と日本語正規表現を型付きデータに |
| `modifiers/index.ts`・`types.ts`・`hooks.ts` | B | core/gen・client | 登録の仕組みは流用。型を共有側（layout / connect）と描画側（build / 実行時）に分ける |
| layout だけの Modifier（ShallowWater・SurfaceFriction・ScaleAnomaly・PropRepetition・FogDepth など） | B | core/gen | データ変換として流用。ID 直書きを params に |
| 観測で世界を変える Modifier（ObservationRewire・NoiseGate・MapErase・DynamicMapNode・FakeExit） | C | — | 「誰の観測か」を共有世界向けに決め直してから |
| 生成器（Corridor / Room / Grid / Atrium / Parking / Vertical / Mega / Street / Pool / DynamicGrid） | C | — | 新しい生成方式で置き換える。部屋割りの手法だけ参考 |
| `generators/dressing/*`（7.6k 行） | C | — | 100% 部屋 ID 別。見た目の参考 |
| `monument/*`・oddity の中身 | C（選んで移す） | core/gen | ID 依存は無い。v2 の美術方針に合うものだけ |
| `data/index.ts`・`tools/xlsx_to_json.py` | B | data | 読み込みの形は流用。自由記述の列を型付きの列に |

### 描画・音・UI（client）

| v1 | 区分 | v2 の行き先 | やること |
|---|---|---|---|
| `PostFX`・`LensPass`・`VideoPass`・`shaders/*`・`FilmPreset`（約 2.2k 行） | A | client/render | three だけに依存。被弾の演出に `forceJitter` / `setAudioNoise` が使える |
| `textureQueue`・`ChamferBox`・`SurfaceGrime`・`OutsideView`・`IceTexture`・`Wheat`・`SurfaceDetail` | A | client/render | — |
| `Lightmap` + worker・`SnapshotService`・`DoorLeak` | A | client/render | 型だけ新しい layout に合わせる |
| `MaterialLibrary`（2.4k 行）+ `cc0Materials` + `SurfaceAppearance` | B | client/render | ローダー・材質定義・特殊シェーダに分ける。端末判定と素材の場所を外から渡す（下記 4 か所） |
| `PropCatalog`・`props/*`・`SurfaceGeometry`・`ObjectGeometry` など | B | client/render | 新しい Box / MatId の形に合わせる |
| `RoomBuilder`（1.75k 行） | C | client/render | 分割構築・ライトマップ・インスタンス化の流れだけ参考にする |
| `DecalLayer`・`SignAtlas`・`wearEffects`・`WindowRoom`・`LightBudget` | C | client/render | v1 の生成データが前提。アトラス描画の部分は流用できる |
| `PlayerFlashlight` | B | client/render | カメラ固定から「姿勢を受け取る」形へ（他プレイヤーの懐中電灯も描けるように） |
| 他プレイヤーの姿 | 新規 | client/render | v1 にキャラクターの概念は無い。`RemoteAvatarManager`（id → 姿・補間）を新しく作る |
| `audio/` の Synth・Reverb・AmbientMixer・AssetManifest・presetMap・Sfx・足音（約 2.9k 行） | A | client/audio | 足音は位置を受け取れる（`Sfx.ts:219`）ので他プレイヤーの足音にも使える |
| `AudioEngine` | B | client/audio | 部屋定義と設定への依存を最小限に絞る。聞き手とローカルプレイヤーを分け、他プレイヤーの音源を足す |
| `RecOverlay`・`SettingsPanel`・`FloorCodex` | A | client/ui | 保存名を `liminal2.*` に |
| `MenuUI`・`MapPanel`・`Map3D`・`Minimap`・`map/GridProjector` | B | client/ui | WorldManager への直接依存を `MapDataSource`（グラフ・layout・ソケット位置・扉状態・範囲）に置き換える |
| `Hud` | B | client/ui | 体力の表示を足す（ほぼ作り直し） |

**素材の場所を決めている所（v2 で `ASSET_BASE` に寄せる）**: `MaterialLibrary.ts:2079`（内部関数）・同 `:500`（BASE_URL を直接使用）・`PropCatalog.ts:138`（既定値）・`AssetManifest.ts:103`。調べた範囲ではこれで全部。

### 3.1 移植の状況（2026-10-02・段階 3 まで）

| v1 | 状態 | v2 の場所 | 備考 |
|---|---|---|---|
| `core/rng.ts`・`core/aabb.ts` | 移植済み | `core/math/rng.ts`・`aabb.ts` | `Rng` に poisson・fork・状態の保存を足した |
| `PlayerController.ts`（移動） | 移植済み | `core/sim/player.ts` | 固定 tick の純関数。押し戻す面を「動く前にいた側」で決めるよう直した（v1 は動いた向きで決めていたため、角をかすめると家具を突き抜け、下向きの移動では背の高い棚の上へ乗った）。頭の上の大きな箱から横へ何 m も押し出さない |
| `PlayerController.ts`（カメラ） | 移植済み | `client/camera/CameraRig.ts` | |
| `generators/footprint.ts`・`reach.ts` | 移植済み | `core/world/footprint.ts`・`core/gen/reach.ts` | ソケットの代わりに開口（WallOpening） |
| `generators/common.ts`・`furniture.ts` | 移植済み | `core/gen/dress/`（`furniture.ts`・`patterns.ts`・`geom.ts`・`decor.ts`・`props.ts`） | 置いたあと開口どうしの到達を確かめ、塞いだ物だけを外す |
| `generators/dressing/*` | 作り直し | `core/gen/dress/kits/*` | 部屋 ID ではなく、テーマ（35 種）× 区画の種類（7 種）で中身を選ぶ |
| 生成器・`RarityGenerator.ts`・`WorldManager.ts` | 作り直し | `core/gen/floor/*` | フロア単位の生成（V2-1）。希少度は `profile.ts` |
| `PostFX`・`LensPass`・`VideoPass`・`shaders/*`・`FilmPreset` ほか A 区分の描画 | 移植済み | `client/render/` | |
| `Lightmap` + worker | 移植済み・組み込み済み | `client/render/Lightmap.ts`・`client/world/FloorBuilder.ts` | 区画ごとに焼く（mid / high）。部品で入切する照明のある区画は頂点焼き込みのまま |
| `MaterialLibrary` + `cc0Materials` + `SurfaceAppearance`・`SurfaceGeometry` | 移植済み | `client/render/` | |
| `WindowRoom`・`LightBudget`・`PlayerFlashlight` | 移植済み | `client/render/` | |
| `RoomBuilder` | 作り直し | `client/world/FloorBuilder.ts` | 区画ごとの Group・出現型の隠し・部品で入切する照明・ライトマップ |
| `streaming/RoomStreamingManager.ts` | 作り直し | `client/world/Visibility.ts`・`LightManager.ts` | フロアを丸ごと読み、区画と開口で見える所だけ描く |
| `audio/*`・`AudioEngine` | 移植済み | `client/audio/` | |
| `RecOverlay`・`SettingsPanel`・`Settings`・`InputController` | 移植済み | `client/ui/`・`client/settings/`・`client/input/` | 保存名は `liminal2.*` |
| `game/Game.ts` | 作り直し | `core/sim/sim.ts`（手元のサーバー）・`client/game/ClientGame.ts` | |
| まだ移していない | — | — | `MenuUI`・地図（`MapPanel`・`Map3D`・`Minimap`）・`Hud`・`FloorCodex`・`SnapshotService`・`DoorLeak`・`PropCatalog`・`props/*`・`ObjectGeometry`・`DecalLayer`・`SignAtlas`・`wearEffects`・oddity・Modifier・monument・`data/index.ts`・`SaveManager`・`PlayerRide`・`PlayerProxy` |

---

## 4. 進め方（段階）

| 段階 | 内容 | 終わりの目安 |
|---|---|---|
| P0 | 器を作る（このブランチ）: v1 / shared / v2 の分割 | v1 が今までどおり動く ✅ |
| P1 | core の土台: math・世界の型・固定 tick の移動と当たり判定（純関数）。Node でのテスト | 決まった layout の上を、ヘッドレスで歩ける |
| P2 | client の縦切り: 試験用の部屋 1 つを、移植した MaterialLibrary・PostFX・音で描画。手元のサーバー経由で 1 人で歩く | v1 と同じ質感の部屋を、新しい骨組みで歩ける |
| P3 | 新しい部屋生成: 順番に依存しない世界グラフ + layout の純関数 | 2 つの経路で歩いても同じ世界になることをテストで確かめる |
| P4 | マルチプレイ: サーバー・入室管理・扉の同期・他プレイヤーの姿と足音 | 2 つのブラウザで同じ部屋に入り、扉が同期する |
| P5 | 体力: hazard ゾーン・落下・0 になったときの扱い・HUD・被弾の演出 | 決めた規則どおりに減って、戻る |

P1・P2 の間は v2 を公開しない。

---

## 5. 決めていただきたいこと（v2 の企画判断）

1. **マルチプレイの置き場所**: GitHub Pages は静的な配信だけなので、リアルタイム通信には別のサーバーが要る。案: (a) Cloudflare Workers + Durable Objects（世界ごとに 1 つ。無料枠あり）、(b) 自前サーバー（VPS + Colyseus など）、(c) 1 人がホストになる P2P（WebRTC。サーバー代は最小だが、ホストが抜けると止まる）。
2. **遊び方**: 同じ世界を一緒に探索する協力か、競う要素があるか。1 つの世界に何人まで入れるか。
3. **体力の規則**: 何で減るか（危険な部屋・落下・何かに襲われる）、0 になったらどうなるか（入口へ戻る・世界をやり直す・観戦）、回復の手段。v1 の決定 D1（HP・失敗なし）と D2（危険度に効果なし）を v2 では取り消すことになる。
4. **部屋の定義**: v1 の 118 部屋の定義（xlsx）を引き継ぐか、新しい定義表を作るか。
5. **企画資料の版**: v2 用に xlsx / docx を新しく起こすか、v1.3 から枝分かれさせるか。
