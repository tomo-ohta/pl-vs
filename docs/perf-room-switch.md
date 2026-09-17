# 部屋切り替え時の停止時間（フリーズ）対策と計測（担当 L2、2026-09-17）

対象: `src/render/MaterialLibrary.ts`（ImageBitmapLoader・先行アップロード待ち行列・2 hop 先の先読み・事前コンパイル用材質）、
`src/streaming/RoomStreamingManager.ts`（分割構築の駆動・precompile の条件合わせ）、`src/render/RoomBuilder.ts`（構築のステップ分解・
ライトマップ反映の待ち行列化・materialPlan）、`src/game/Game.ts`（計測・先読みの配線・アップロードの流し込み・toggleDoor）。
見た目（ライトマップ・素材・デカール・ドレッシング）と決定論・セーブ整合は変えない。`src/generators/**` は触っていない。

## 1. 計測基盤

- `game.perf().roomSwitch`: 直近 24 回の入室 / 開扉について、同期部分の最大 ms、以後 30 フレームの最大 ms（中央値も）、
  追跡テクスチャのアップロード回数、新規 GL テクスチャ数、新規シェーダプログラム数、100 ms 超のフレーム数。`uploadsPending` は待ち行列の残り。
- `window.__roomSwitchProfile`（最新 120 件、`RoomSwitchSample`）: 1 回ごとに `kind`（enter / door）、部屋 / 向こうの部屋と定義 id、
  `syncMs`（enterRoom / toggleDoor 本体。見えている部屋の同期構築と世界生成 `prepareRoom` を含む）、`syncBuilds` / `syncPrograms`、
  `firstFrameMs`（直後の 1 フレーム = 初回描画）、`maxFrameMs`（30 フレームの最大）、`over100` / `over50`、
  `uploads`（`texture.onUpdate` で数えた CC0 / ライトマップ / サイン・ラベルのアップロード回数）、`textures`（`renderer.info.memory.textures` の増分）、
  `programs`（`renderer.info.programs.length` の増分）、`deferredBuilds` / `splitBuilds`（窓内の後回し構築とそのうち分割されたもの）、`lightmaps`（反映数）。
- フレーム時間は `Game.step` 全体（更新 + `renderFrame` の CPU 時間）。GPU の待ちは含まないが、同期アップロード・シェーダのリンク待ち・
  同期構築はここに乗る。
- `game.toggleDoor(roomId, portalId)`: E / タップと同じ経路（施錠・Modifier の拒否・乗車・Seam・開閉）を外から呼べる（`interactRay` もこれを使う）。
- `window.__buildProfile`（最新 200 件）に `steps` / `frames`（分割構築の中断回数・またいだフレーム数）を追加。
- 前後比較のスイッチ: URL `?l2=off` で本作業の機能を全て無効（`?l2=bitmap,queue,prefetch,split,precompile` で個別に無効）。
  同じビルドで「修正前」相当の数値が取れる（`L2_FLAGS`、`window.__l2flags`）。

### 計測手順（自動）

開発サーバーは他担当の保存で HMR の全リロードが入るので、`npm run build` + `npx vite preview --port 4174` の本番ビルドで計測した
（`?nolock=1&new=1&seed=7`、修正前は `&l2=off`）。コンソールで実行するスクリプト（`scratchpad/perf-run.js` 相当）:
seed 7 / 11 / 23 について `game.newWorld(seed)` → 12 回 { 現在の部屋の扉を 1 つ `toggleDoor` で開ける（未訪問の部屋へ通じる扉を優先）→ 1.5 s →
開けた扉の先（無ければ配置済み隣接）へ `player.teleport` + `enterRoom` → 1.5 s }。フレームは自前のループで回す（可視なら rAF、
非表示タブでは MessageChannel / busy-wait で 16.7 ms 刻み）。結果は `window.__perfResult`（seed ごとの途中結果は `localStorage.__perfPartial`）。
環境: MacBook / Chrome、Tier high（`gtao×0.4+bloom+msaa2`）、Claude Browser pane（幅 800 px）。

## 2. 修正前の停止要因（計測から）

1. **大部屋の後回し構築を 1 フレームで行う**: 食堂 / 倉庫 C12 / C13（箱 1,830〜1,920）が 808〜1,005 ms（`bake` 626〜768 ms）。
   入室の 1〜2 フレーム後に `buildPending` が 1 部屋を一気に構築するので、入室直後に約 0.8 s 止まる（seed 23 C12 入室: 直後 814 ms）。
2. **シェーダの初回コンパイル**: 入室 / 開扉直後のフレームで 20〜23 プログラム → 364〜920 ms（seed 7 U12）、9 プログラム → 1,385 ms
   （開発サーバー計測、seed 11 R15 = MaterialGradient の別プログラム族）。既存の `precompile`（構築直後の `compileAsync`）は効いていなかった。原因は 2 つ:
   - EffectComposer 使用時（clean / archival）は RenderPass が RenderTarget へ描くので、材質プログラムは「トーンマップ無し・線形出力」になる。
     `compile` を RenderTarget を束縛せずに呼ぶと「AgX・sRGB」の別プログラム（直接描画用）を作るだけで、実描画では改めて同期コンパイルされる。
   - `renderer.compile(group, camera, scene)` は scene と group の両方を `traverseVisible` するので、部屋の可視ライトが二重に数えられ
     `numPointLights` 8 → 12、`numPointLightShadows` 1 → 2 の別プログラムになる。
   （検証: 描画済みの部屋を RT 無しで compile すると 12 プログラム増。cache key の差分は outputColorSpace `srgb-linear → srgb`、toneMapping `0 → 6`、
   numPointLights `8 → 12`、numPointLightShadows `1 → 2` の 4 箇所だけ）
3. **テクスチャの初回アップロード**: 部屋 seed で変わる CC0 セット（1024² Color / Normal + 512² Roughness / AO / Height）が扉を開けた瞬間 /
   入室直後のフレームに同期でアップロードされる（JPEG のデコードも main thread）。直後の 1 フレームに 21〜33 枚（U04 開扉 327 ms、C07 開扉 321 ms）。
4. **ライトマップ**（512² RGBA HalfFloat = 2 MB）の到着が同じフレームに複数部屋分重なる。
5. **見えている部屋の同期構築と世界生成**（扉を開けた瞬間に向こうの 2 部屋 = 412〜511 ms、入室時の `prepareRoom` + 構築 = 556 ms）。
   本作業の目標の対象外（「見えている部屋の同期構築を除いて」）。世界生成（2 hop 先の配置）は WorldManager 側。

## 3. 方式

### 3.1 テクスチャ: 別スレッドのデコードと分割アップロード（MaterialLibrary）

- CC0 セットの画像は `THREE.ImageBitmapLoader`（`imageOrientation: 'flipY'`, `premultiplyAlpha: 'none'`）で読む。`createImageBitmap` は別スレッドで
  デコードする。three は ImageBitmap の `flipY` を無視するので、TextureLoader（flipY = true）と同じ向きにするために `imageOrientation: 'flipY'` を使う。
  検証: 同じ JPEG（Asphalt031 Color 1024²）を Image + UNPACK_FLIP_Y と ImageBitmap(flipY) で WebGL2 にアップロードして読み戻し、全画素が一致（差 0。
  UNPACK_FLIP_Y の状態は ImageBitmap には効かない = three の前提どおり）。`createImageBitmap` の無い環境では従来の TextureLoader。
  読込前の 1 px 平均色、到着時の dispose（texStorage2D の寸法違い対策）は従来どおり。派生 clone（repeat / 回転）は flipY も元と揃え、GPU 上は 1 枚のまま。
- `materials.uploads`（`TextureUploadQueue`）: 読込が終わったテクスチャを待ち行列に入れ、`Game.step` の末尾（描画の直前）で
  更新の CPU 時間が 8 ms 未満なら 2 単位、40 ms 未満なら 1 単位、それ以上なら 0（ただし 1.5 s 以上待った項目は 1 つ通す）だけ
  `renderer.initTexture` で先に GPU に載せる（1024² 級 = 1 単位、512² = 0.5 単位。分割構築中の 24 ms のフレームでも 1 枚は通す）。
  優先度: 0 = 見えている部屋のライトマップ、1 = 構築済み / 構築待ちの部屋の素材とサインのアトラス・ラベル、2 = 2 hop 先の先読み。
  描かれる前に載せ切れなかった分は three が従来どおり同期で載せる（見た目は変わらない）。evict 済みのセットが再び使われるときも待ち行列に戻す
  （従来は最初の描画で全枚数を同期アップロード）。
- ライトマップの反映（Worker の結果 → `texture.image.data` 差し替え + `needsUpdate` + 対象頂点の `bakedLight` 0 化）も同じ待ち行列で
  1 フレームに 1 部屋分だけ行う（差し替えと 0 化は同じフレーム）。見えるようになった部屋の反映は優先度 0 に上げる。
  部屋の dispose・分割構築の取り消しは待ち行列の項目も外す。

### 3.2 2 hop 先の先読みと事前コンパイル（Game.prefetchAhead）

- 入室時（`refreshStreaming` の後）と扉を開けた直後（`ensurePrepared` の後）に、配置済みで未構築の部屋（隣接 + 隣接の隣接）について
  `RoomBuilder.materialPlan(node, layout, tier)` で「構築時に `forRoom`（部屋 seed のバリエーション + lightMap）で作られる MatId」を求め、
  `materials.prefetchRoom(roomId, ids, seed)` で `pick(id, seed)` が選ぶ CC0 セットの読込を始める（材質は作らない。世界の乱数は消費しない）。
  対象から外れた部屋は `dropPrefetch` で外し、構築済みの部屋からも先読みからも参照されないセットだけ evict する。
- `materialPlan` は build と同じ判定（Tier のライトマップ設定、legacy / ロール / Worker、`detailedBoxes`、Theater の張地、`isLightmapTarget`）。
  `ids`（forRoom）の他に `shared`（variant(mat, overrides): 小さな箱・扉パネル・枠・可動要素・デカール）と `instanced`（InstancedMesh）を返す。
  layout オブジェクト × Tier ごとにキャッシュ（WeakMap）。
- 事前コンパイル: `materials.probeMaterials(ids, seed, overrides, shared)` が共有 variant と「lightMap 付き clone の代表」（2×2 のダミーライトマップ。
  プログラムは lightMap の有無で決まる）を返し、Game が小さな箱（Mesh / InstancedMesh）に付けて `renderer.compileAsync` する。
  代表 clone はプログラムの参照を保つため MaterialLibrary が LRU（96）で保持する（dispose するとプログラムが捨てられる）。
  上書き（roomfog / gradient / legacy / colorMask）を持つ部屋は全材質が別プログラム族になるので、`shared` も含めて先にコンパイルする。
- compile の条件合わせ（`RoomStreamingManager.compileWith`。既存の `precompile` にも適用）: composer 使用時は 4×4 のダミー RenderTarget を
  束縛したまま compile し、部屋の実ライトを全て非表示、ダミーライトを `tier.maxLights` 本（castShadow は先頭 `tier.shadowLights` 本）だけ表示して
  `numPointLights` / `numPointLightShadows` を実描画の定常状態に固定する（影スロットの受け渡し中は castShadow が 0 本になる瞬間があり、
  newWorld 直後はダミーがまだ無いので、そのまま compile すると無駄な別プログラムになる）。
  検証（seed 7、C06 → U12）: 扉を開けた直後のフレームで新プログラム 0（GTAO の法線パスを除く）、U12 入室の初回描画で新プログラム 0。
  修正前は同じ場面で 20〜23 プログラムが初回描画で同期コンパイルされていた。

### 3.3 大部屋の構築の分割（RoomBuilder / RoomStreamingManager）

- `RoomBuilder.build` を generator（`buildSteps`）に分解し、`beginBuild(node, layout)` が `RoomBuildJob` を返す。中断点は
  準備の後 / 箱の結合ループ 24 箱ごと / 結合メッシュの後 / デカールの後 / 反復配置の後 / プロップの後。`job.step(deadline)` は deadline
  （`performance.now()` 基準）を過ぎたら次の中断点で戻り、`job.run()` は残りを一気に進める。`build()` は `beginBuild().run()`（従来と同じ同期構築）。
  箱の処理順・乱数（`node.seed` の fork）は変えないので出力は同じ。
- `RoomStreamingManager.buildPending(budget)`: 後回しの部屋を `BUILD_BUDGET_MS`（24 ms）の予算で進める（従来は最低 1 部屋を一気に）。
  途中の部屋が見える必要になったら（`ensure`）残りを同期で進める。対象から外れた / レイアウトが変わった部屋の途中のジョブは `cancel`
  （途中で確保した部屋専用材質・CC0 セットの参照・ライトマップ job・サイン / ラベルのテクスチャを解放）。
- `Game.enterRoom` の `frozen`（新しい開口を追加しない部屋）に構築待ち（後回し・分割構築の途中）の部屋も含める。従来は入室までに
  1 部屋 / フレームで構築が終わっていたので凍結されていた部屋が、分割で間に合わなくても世界の生成結果（`tryNewExit` の対象）が変わらないようにする。
- 計時: `__buildProfile` の段階別 ms は中断中の待ち時間を含まない。

## 4. 前後比較

本番ビルド（`vite preview`）、seed 7 / 11 / 23 × 12 部屋、各部屋で扉 1 つ。修正前 = 同じビルドの `?l2=off`。newWorld 直後の最初の入室
（起動扱い）は除く。「窓」= 入室 / 開扉から 30 フレーム。踏破経路は前後で一致（seed 7: C02 C06 U12 C17 C02 C03 C01 R07 U08 C11 C01 U04 E09 /
seed 11: C02 C12 U10 C07 C07 C19 R07 R16 R15 ADAPTER R15 R16 R07 / seed 23: C02 C14 U05 C06 U02 C09 U14 C01 U15 C12 C04 U19 C16）。

| 入室（36 回） | 修正前 | 修正後 |
|---|---:|---:|
| 以後 30 フレームの最大 ms（全回の最大） | 920 | 375 |
| 同（p95） | 814 | 118 |
| 同（中央値） | 48 | 27 |
| 直後 1 フレーム（初回描画）の最大 ms | 814 | 108 |
| 同期部分（enterRoom 本体）の最大 / 中央値 ms | 556 / 29 | 366 / 26 |
| 100 ms 超のフレーム数（合計） | 13 | 3 |
| 50 ms 超のフレーム数（合計） | 25 | 9 |
| 追跡テクスチャのアップロード回数（窓内合計） | 96 | 389 |
| 新規 GL テクスチャ数（窓内合計） | 99 | 388 |
| 新規シェーダプログラム数（窓内合計） | 151 | 60（うち同期部分の非同期コンパイル 52） |

| 開扉（35 回） | 修正前 | 修正後 |
|---|---:|---:|
| 以後 30 フレームの最大 ms（全回の最大） | 327 | 222 |
| 同（p95） | 321 | 103 |
| 同（中央値） | 37 | 4 |
| 直後 1 フレーム（初回描画）の最大 ms | 327 | 222 |
| 同期部分（toggleDoor 本体）の最大 ms | 511 | 331 |
| 100 ms 超のフレーム数（合計） | 11 | 2 |
| 50 ms 超のフレーム数（合計） | 13 | 4 |
| 追跡テクスチャのアップロード回数（窓内合計） | 270 | 112 |
| 新規 GL テクスチャ数（窓内合計） | 269 | 76 |
| 新規シェーダプログラム数（窓内合計） | 17 | 5 |

| 全体 | 修正前 | 修正後 |
|---|---:|---:|
| 100 ms 超のフレーム（全窓） | 29 | 7 |
| 追跡テクスチャのアップロード回数（起動含む） | 422 | 787（待ち行列経由 712、ライトマップ反映 91、予算超過の強制通過 0） |
| 構築した部屋 / 複数フレームに分割した構築 | 31 / 0 | 31 / 12 |
| 終了時の常駐 CC0 セット / GL テクスチャ / プログラム | 43 / 208 / 138 | 45 / 273 / 129 |
| エラー（world.log ERROR + console.error） | 0 | 0 |

アップロード回数が増えるのは、修正前は入室後の窓の外（扉を開ける前の 1.5 s の待ち）や初回描画の同期アップロードとして数えられていた分が
待ち行列に移り、加えて 2 hop 先の先読みで使われないセットも載せるため（3.2）。停止時間の指標（最大 / p95 / 100 ms 超）は入室・開扉とも下がった。

大部屋の後回し構築（修正後）: C12 1,922 箱 694 ms → 24 フレーム、C12 1,888 箱 691 ms → 23 フレーム、C13 1,830 箱 680 ms → 23 フレーム、
C15 1,320 箱 151 ms → 6 フレーム、C09 2,706 箱 101 ms → 5 フレーム、C11 2,796 箱 99 ms → 5 フレーム（1 フレームあたり ≈ 24〜35 ms。
修正前は C12 / C13 が 1 フレームで 808〜1,005 ms）。

### 修正後に残った 100 ms 超（7 件）

| seed | 種別 | 部屋 | 直後 ms | 最大 ms | 内訳 |
|---|---|---|---:|---:|---|
| 7 | 入室 | U12 | 108 | 375 | 開いた扉 2 枚の先に見える C12（箱 854）を `updateVisibility` が同期構築（267 ms）。見えている部屋の同期構築 |
| 7 | 開扉 | U04 | 222 | 222 | 向こうの U04 は同期構築（60 ms）、その先の部屋の分割構築が途中で `ensure` が残りを同期で進めた + 29 枚のアップロード |
| 23 | 入室 | U02 | 27 | 118 | 新プログラム 10（U02 の Modifier 材質。先読みの対象外） |
| 11 | 開扉 | C07 | 103 | 103 | 後回し構築 1 部屋のフレーム + アップロード 6 |
| 23 | 入室 | C12 | 100 | 100 | 後回し構築 2 部屋（C12 1,910 箱の分割 25 フレームの先頭） |
| 11 | 入室 | C02（起動） | 87 | 101 | 起動直後 |
| 7 | 入室 | C02（起動） | 275 | 275 | 起動直後（初回の 99 枚アップロード + 34 プログラム。対象外） |

## 5. 決定論・見た目の不変確認

### 決定論

seed 23 を同じ操作列（12 部屋の踏破 + 各部屋で扉 1 つ）で `l2=off` と全機能有効の 2 通り踏破し、ノードの構造（roomId / 定義 / 配置 / Portal の
接続先・施錠・Seam）の FNV ハッシュを比較した。フレームを 16.7 ms 刻みで回した場合: 両方 `4f9847a5`（52 ノード）、経路
`C02 C14 U05 C06 U02 C09 U14 C01 U15 C12 C04 U19 C16` で一致（最初の計測の経路とも一致）。`node tools/seam-stats.mjs --seeds 3 --rooms 40`
（Worker 無し・Node の経路）は deterministic=true / loadMismatch=0 / overlap=0 のまま。

注意（従来からの性質）: 世界の生成結果は実時間に依存する。扉は通過後 4 s（`CLOSE_DELAY_SEC`）で自動的に閉じ、そのとき `refreshStreaming` →
`disposeExcept` が保持部屋を捨てるので、次の入室時の `frozen`（`tryNewExit` の対象外になる部屋 = 構築済み + 訪問済み）の集合がタイミングで変わる。
非表示タブ（rAF 停止・タイマー 1 s 間引き）で回した踏破では `l2=off` / on とも `d9449c62`（72 ノード、経路 …U02 U01 R08…）になり、
可視タブの結果とは違ったが、同じタイミングなら同じ世界になる。分割構築で構築が入室に間に合わない場合に備え、`frozen` には構築待ちの部屋も含めた
（3.3。今回の踏破では入室時の構築待ちは常に 0 部屋だった）。

### 見た目

開発サーバーで同じ seed・同じ視点（開始位置）を `l2=off` と全機能有効で描き、素材の読込・ライトマップの反映が終わるのを 3 s 待ってから
キャンバスを読み戻して比較した（730 × 490 px、32 × 18 の格子平均色）。PNG は `docs/visual-baselines/` に保存（`/__visual-baseline`）。

| 場面 | 修正前 | 修正後 | 格子の最大差 / 平均差（0〜255） | 差 8 超のセル |
|---|---|---|---:|---:|
| C02（seed 7 開始位置、ライトマップ反映済み） | `before-1789578854530`（平均輝度 83.62） | `after-1789580113792`（83.61） | 1 / 0.03 | 0 / 576 |
| C09 社員食堂（seed 9 `force=C09`、箱 2,728、反映済み） | `before-1789580124040`（54.51） | `after-1789580134355`（54.51） | 1 / 0.08 | 0 / 576 |

差 1 は明滅（wear）・パーティクルの位相によるもの。ImageBitmap の向き（3.1）、分割構築の出力（箱の処理順・乱数は同じ）、
ライトマップの反映内容（差し替えと 0 化を同じフレームで行う）はいずれも変わっていない。

## 6. 未解決・注意

- 見えている部屋の同期構築と世界生成（`prepareRoom`）は対象外のまま。開いた扉の先（2〜3 hop）に見える部屋は `updateVisibility` → `ensurePrepared`
  が同期構築する（U12 入室で C12 854 箱 = 267 ms）。また、扉を開けた瞬間に向こうの部屋の分割構築が終わっていなければ残りを同期で進める
  （入室から 1.5 s 以内に扉を開ける計測条件では U04 開扉で 222 ms。歩いて扉まで行く実プレイでは構築が先に終わる）。
  対策候補: 開いた扉の先 2 hop の部屋も後回し構築（pending）の対象にする / `BUILD_BUDGET_MS` を可視部屋数に応じて上げる。
- Modifier が付ける材質（U02 で 10 プログラム）や `adoptExternal`（デカール・プロップ）の族は `materialPlan` の対象外なので初回描画でコンパイルされ得る。
- 先読みで常駐する CC0 セット（43 → 45）とアップロード総数（422 → 787）が増える。GPU メモリは参照の無くなったセットの evict で抑える。
  低速回線では先読みが帯域を使うので、mid Tier（スマホ）では 2 hop 先を止めて 1 hop だけにする余地がある。
- PropCatalog（glTF）のテクスチャ・材質、ワーカーの計算時間（`workerMs`）、`?props=1` は対象外。
- 世界の生成結果は従来から実時間に依存する（扉の自動閉扉 4 s → `refreshStreaming` → 保持部屋の evict → `frozen` の集合が変わる。5.）。
- 影を落とすライトの本数は `padVisibleLights` で Tier の値に固定しているが、実ライトが maxLights 本以上見えていて影スロットが空の瞬間
  （受け渡し中）は `numPointLightShadows` が 0 になり、その組のプログラムが別に作られる（担当 P の LightBudget。今回は compile 側だけ定常状態に固定した）。
- 計測は Claude Browser pane（他担当と共有。タブが非表示になると rAF が止まる）で行ったので、フレームは自前のループで回した。実機の 60 fps ループでは
  待ち行列の流量（フレームあたり 1〜2 枚）はそのまま、フレーム間の実時間が伸びる分だけ先読みが間に合いやすい。

## 付録: 計測スクリプトの骨子

```js
// 本番ビルド（vite preview）で ?nolock=1&new=1&seed=7（修正前は &l2=off）を開き、コンソールで実行
const g = game; g.onStartClick(); g.renderer.setAnimationLoop(null);
const yieldTask = () => new Promise((r) => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
const runFor = async (ms) => { const t0 = performance.now(); let next = t0; while (performance.now() - t0 < ms) { while (performance.now() < next) {} g.step(1 / 60); next += 1000 / 60; if (performance.now() > next) next = performance.now(); await yieldTask(); } };
for (const seed of [7, 11, 23]) {
  g.newWorld(seed); await runFor(1500);
  const visited = new Set([g.currentRoomId]);
  for (let i = 0; i < 12; i++) {
    const cur = g.currentRoomId, node = g.world.graph.get(cur);
    const doors = node.portals.filter((p) => p.type === 'door' && !p.locked && !p.seam && !p.ride && p.targetRoomId && g.world.graph.nodes.get(p.targetRoomId)?.placement && !p.open)
      .sort((a, b) => (visited.has(a.targetRoomId) ? 1 : 0) - (visited.has(b.targetRoomId) ? 1 : 0));
    let next = null;
    if (doors.length) { g.toggleDoor(cur, doors[0].portalId); if (doors[0].open) next = doors[0].targetRoomId; await runFor(1500); }
    const nb = g.world.graph.placedNeighbors(cur); if (!nb.length) break;
    if (!next) next = (nb.filter((n) => !visited.has(n))[0] ?? nb[0]);
    const sp = g.world.spawnPointOf(g.world.graph.get(next)); g.player.teleport(sp.spawn, sp.yaw); g.enterRoom(next); visited.add(next);
    await runFor(1500);
  }
}
g.start();
console.table(window.__roomSwitchProfile.map((s) => ({ kind: s.kind, def: s.def, sync: s.syncMs | 0, first: s.firstFrameMs | 0, max: s.maxFrameMs | 0, up: s.uploads, prog: s.programs })));
```
