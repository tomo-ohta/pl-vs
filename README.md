# pro_Liminal — リミナルスペース探索 Web ゲーム（Phase 1 垂直スライス + v1.3 基盤 + Phase 2 Modifier / Generator）

仕様書 v1.3（`liminal_space_ai_implementation_spec.docx` / `liminal_procedural_generation_design.xlsx`）に基づく実装。
TypeScript + Three.js + WebGL2。PC ブラウザとスマホを同一コードで動かす。

## 起動

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ に本番ビルド
npm run typecheck  # tsc --noEmit
npm run seamstats  # tools/seam-stats.mjs: headless で 10 seed × 100 部屋を踏破し Seam / 施錠行き止まりを計測（docs/seam-stats.md）
```

URL パラメータ: `?seed=42` で worldSeed を固定、`?new=1` でセーブを無視して新規開始、`?nolock=1` で Pointer Lock を使わない（自動テスト・埋め込みブラウザ向け）、`?force=<ROOM_ID>`（開発用）で次の部屋抽選をその定義に固定（配置に成功した時点で解除。`node.forcedDefinitionId` に残るのでセーブ・再生成でも同じ定義になる）。

CC0 素材（Poly Haven のモデル 69 点、ambientCG の PBR 素材 42 点。`assets/cc0/`、出典は `assets/cc0/manifest.json`）を使う場合:

```bash
python3 tools/fetch-cc0-assets.py   # assets/cc0/ へ取得（再実行で再開。約 654 MB）
npm run build:cc0                   # public/cc0/materials へ書き出し（ambientCG 54 + Poly Haven テクスチャ 15。無ければ従来の生成テクスチャで動く）
```

glTF プロップ置換は既定オフ（小物はノイズになるため。`?props=1` で有効。モデルは `tools/fetch-cc0-assets.py --models` で取得）。詳細は `docs/cc0-pipeline.md`（素材）と `docs/cc0-props.md`（プロップ）。
参考画像に基づくテンプレートの作り込みは `docs/reference-common-analysis.md`（分析と配置方針）、`docs/reference-corridors.md`（廊下 9 種）、`docs/reference-rooms.md`（部屋 8 種、スクリーンショット付き）。

## 操作（仕様 17 章）

| PC | スマホ |
|---|---|
| WASD 移動 / マウス視点（クリックで Pointer Lock） | 画面スワイプで視点 / 左下スティックで移動 |
| Space ジャンプ / Shift ダッシュ | 右下 DASH・JUMP ボタン |
| 左 Ctrl または C しゃがみ（押している間） | 右下 CROUCH（JUMP の上。タップで切替） |
| E で扉・エレベーターを操作、乗車中は E で到着を早める（5 秒後） | 扉やボタンを直接タップ |
| Esc メニュー | 右上ハンバーガー |

しゃがみ（v1.3 D11）: 当たり判定 0.85 m / 視点 0.75 m（0.15 s 補間）/ 移動速度 ×0.5 / ダッシュ不可 / ジャンプ可。頭上が塞がっていれば立ち上がれない。低い開口（crawl。高さ 1.0〜1.2 m）はしゃがんで通る。E03 の横長スロット（幅 2.1 × 高 1.0 m、下端 0.6 m）はジャンプで乗ってからしゃがむ。PC の Ctrl+W はブラウザが奪うので案内は C キーが主。

## 実装済み

### 世界生成（Phase 1）
- **RoomGraph 正本**: `src/world/RoomGraph.ts`。ノード = RoomInstance、エッジ = Portal。発見数（visitedCount）が進行の唯一の指標（D3）。`visitLog`（上限 64）/ `prevRoomId` を保存に含む（AmbientCarryover / GraphReference 用）。
- **決定論**: `worldSeed + roomId` から `Rng` を fork（`src/core/rng.ts`）。レイアウトは (definitionId, seed, variant, extraSockets, removedSockets, mainRect, holeLocal) の決定論的関数。Modifier の乱数は `rng.fork('mod:<id>')`。
- **入室時に接続先確定 + 1 hop 物理配置**: `src/world/WorldManager.ts`。生成器ごとのサイズ・形状バリアントを大きい順に試して空き空間に合わせ、配置後は主矩形を隣の部屋に当たるまで 0.5 m 刻みで成長させる（直線廊下への適用 SEAM-7 は `CorridorGenerator.USE_CORRIDOR_MAIN_RECT` で既定オフ。計測で施錠行き止まりが 41 → 50 に悪化したため）。扉の外側に既存の部屋があれば直結し、配置直後の部屋は壁を共有する部屋と最大 2 本まで扉で直結する。
- **Seam の方針（v1.3 Q3 = B, D14）**: 進行用扉は「全 Variant の通常抽選 + 直結 → 新設ソケット → 一段小さい定義で再抽選 → 前室 Adapter（4/6/8/3/2 m） → 施錠」の順で確保し、置けなければ**施錠して行き止まり**にする（`WARN dead-end lock at <room>/<portals>`。閉じ込めは許容）。緊急 Seam フォールバック（座標テレポート）は廃止。Seam は意図的な用途にのみ使う: エレベーター / Legendary 巨大部屋の遠方配置 / FarLink / FakeExit / LoopTopology / MultiEdge / ObservationRewire / DynamicMapNode / VehicleRide / NonEuclideanVolume。施錠して行き先の無い扉は 3/4 を壁へ戻し（`removedSockets`）、扉パネルを持たない開口（stairs / ramp / street / gate）は確率に依らず常に壁へ戻す（向こうに何も無い開口を残さない）。10 seed × 100 部屋の計測で Seam + 施錠行き止まりは 4.66 → 0.84 / 100 ノード（`docs/seam-stats.md`）。
- **接続フック**: `world.connectHooks`（接続抽選の直前。ConnectDirective で forceDefinitionId / prefer / seam / lock / smallOnly / role / targetExisting / repeat を指示）と `world.nodeHooks`（ノード生成直後）。Game が `src/modifiers` の `collectConnectDirective` / `notifyNodeCreated` を登録する。
- **足跡 = 矩形の集合**: `src/generators/footprint.ts`。折れ曲がる廊下（直線 / L / Z / U）、翼付きの部屋（L / T 字）を矩形の連結で表し、外周にだけ壁を立てる。開口は `Socket.sill / height / crawl` を反映（腰壁付きの高いスロット、低い小型扉）。
- **Generator クラス（10 実装 / 12）**: Corridor / Room / Parking / Vertical / Grid / Atrium（Phase 1）+ Pool / Street / MegaStructure / DynamicGrid（Phase 2。下記）。GraphMacro / Hub は v1.3 で保留（M05 / M20 オミット）。各 Generator は `L.shellCount` を埋める（Modifier がシェルと内装を区別する境界。旧式の VerticalGenerator だけ未設定で、Modifier 側は undefined を許容する）。バリアント数は各 Generator ファイルの `export const variants` を `generators/index.ts` が `registerVariants` で束ねる（Corridor 16 / Room 24 / Parking 6 / Vertical 1 / Grid 12 / Atrium 8 / Pool 18 / Street 6 / MegaStructure 20 / DynamicGrid 6）。
- **Portal**: door（E / タップで開閉。通過後 4 秒で自動閉扉）、stairs・ramp（3.6 m 上下する Adapter）、elevator（籠 Adapter を別階層に配置し、閉扉 + フェードで遷移）、hole（真下に天井穴付きの部屋を物理配置。実際に落ちる）、**crawl 開口**（先に 'crawl' Adapter = しゃがみ通路。床 sill → 段 → 0 m、反対側は通常扉）、**ride**（VehicleRide。'platform' Adapter を遠方に置き一方通行 Seam）、far（一方通行の遠距離接続）。
- **入室時の確定**: 部屋に入った時点で隣接部屋（1 hop）の接続先も確定し 2 hop 先まで配置する。見えている部屋（構築済み・訪問済み）は凍結して新しい開口を追加しないので、入室後に扉や家具が変わらない（`WorldManager.frozen` / `canRelayout`）。

### 描画・部屋（v1.3 基盤）
- **RoomBuilder**（`src/render/RoomBuilder.ts`）: 材質ごとにジオメトリを結合。v1.3 で **チャンク分割**（`layout.chunkSize` 既定 28 m の軸並行格子。チャンクごとに Group + AABB。格子をまたぐ箔（床・天井・外壁）は格子で分割して各チャンクへ入れ、面取り材質は分割せずチャンク AABB を実ジオメトリまで広げる。1 チャンクの部屋は従来と同じ 1 Group。`RoomStreamingManager.updateChunks` が距離で表示切替）、ライトは全て PointLight（`updateLights` が可視本数を Tier の maxLights にダミーで固定し、three.js の numPointLights 変化による材質再コンパイルを防ぐ）、InstancedMesh（`layout.instances`。Tier の instanceScale で間引き）、Points パーティクル（`layout.particles`。particleCap）、SignAtlas サイン（`layout.signs`。`built.updateSign(id, text)`）、可動要素（`layout.dynamics` → `built.dynamicColliders`）、デカール（Tier decals）、ゾーン（`layout.zones` → `built.zones` ワールド AABB）、E03 の見た目ロール（`layout.roll`）、`built.effects`（Modifier の毎フレーム効果。dispose 連動）。
- **MaterialLibrary.variant(id, overrides)**: wetness / colorMask / untextured / legacy / gradient / roomFog の材質バリアント（量子化キー + LRU 96）。roomFog は材質側で部屋別の霧を描く（FogDepth 案 B）。`precompile()` で事前コンパイル可。テクスチャは `public/textures/liminal/<id>.jpg`。例外は `'sky'`（FakeSky の空箔 sky*。起動時に生成する 256 px の雲ノイズ CanvasTexture）。板サイン（SignAtlas plate）は暗い部屋でも読めるよう弱い自己発光。
- **SnapshotService**（`src/render/SnapshotService.ts`）: 256×144 RenderTarget プールと Tier 別更新周期（PastWindow / GraphReference / MirrorOffset 用）。Game が 1 つ所有（`game.snapshots`）。
- **環境の補間**: 入室時に `BuiltRoom.fog`（FogDepth）→ `layout.render.fog` → `palette.fog` の順で目標を決め、scene.fog（far は Tier の fogFar でクランプ）・background・半球光（palette.ambient）を 0.8 s で補間する（FogDepth 案 A。案 B の材質側 fog と併用）。
- **描画パイプライン（v1.3 第5回）**: `src/render/PostFX.ts`（three 付属の EffectComposer / GTAOPass / UnrealBloomPass / OutputPass。AgX トーンマップ、露出 1.0、Tier 別に GTAO・ブルーム・MSAA・影 1 灯を切替、撮像プリセット `postfx: off / clean / homeVideo / tape`（`src/render/FilmPreset.ts`。homeVideo / tape は LensPass（線形 HDR: 歪み・色収差・軟焦点・露出追従）と VideoPass（表示域: 色のにじみ・暗部ノイズ・走査線・フレーム間引き）を追加。旧設定 'archival' は homeVideo に読み替え）。`game.perf()` で CPU / GPU 時間。
- **カメラ挙動（担当 F2。`docs/film-camera.md`）**: `PlayerController` が表示カメラだけに手持ち感（歩調に同期した上下動 1.5 cm・ロール 0.3°、呼吸 3 mm、ふらつき 0.08°、FOV ±0.5° のゆらぎ）と視線の遅れ（50 ms）を掛ける。`pos` / `yaw` / `pitch` / 当たり判定 / PlayerProxy は不変。乗車中と E03（`layout.roll`）では掛けない。Game は毎フレーム 表示カメラの回転速度・静止秒数・環境音の大きさ（`AudioEngine.ambientLevel`）を PostFX に渡し、入室で `notifyRoomEnter`。
- **ライトマップ**: `src/render/Lightmap.ts` + `lightmap.worker.ts`。外殻と大きな家具の面を 0.25 m（high）/ 0.5 m（mid）テクセルで Web Worker が焼く（面光源サンプル + 遮蔽レイ + 半球 AO）。到着まで頂点焼き込みで描き、到着後は材質の `lightMap`（uv1）へ差し替え。環境マップの拡散と動的光の拡散は材質側の uniform で抑え、一様な明るさを避ける（`docs/lighting-lightmap.md`）。
- **素材バリエーション**: `src/render/cc0Materials.ts` の `CC0_VARIANTS` を部屋 seed で選択（36 MatId / 93 候補 / 56 セット）。2 層タイリング混合、色相・明度のトーン、Displacement による視差（high）。`materials.forRoom(id, { roomId, seed, lightMap })`（`docs/material-variation.md`）。
- **デカール層**: `src/render/DecalLayer.ts` / `DecalAtlas.ts` / `src/generators/decals.ts`。コンセント・スイッチ・非常口・貼り紙・ポスター・床の擦れ・扉下端の汚れ・壁際の埃・入隅・天井のシミを手続き描画のアトラスで貼る（`docs/decals.md`）。
- **破れ**: `src/generators/wear.ts` / `src/render/wearEffects.ts`。約 35〜39% の部屋に 1 種だけ（切れかけの管の明滅 / 消灯 / 天井板の欠落・黄ばみ / 傾いた案内板）。窓の外は `windowNight`（生成した夜景。面の奥 12 m / 45 m の層を視線で視差サンプルし、動くと近いビルだけがずれる。`docs/night-parallax.md`）（`docs/wear.md`）。
- **判断の記録**: ライティング関係は `docs/visual-improvement-spec.md` の「第5回」節に V04〜V07 との対応と採用理由を記載。
- **部屋別ドレッシング（v1.3 第6回・参考ボード対応）**: `src/generators/dressing/index.ts` が `generateRaw` の直後（Modifier より前）に希少度別の `dressUncommon / dressRare / dressEpic / dressLegendary / dressMythic`（`src/generators/dressing/*.ts`）を呼び、定義 ID ごとに参考ボード（`docs/reference-<rarity>.md`、分析表 `docs/reference-rarities-analysis.md`）へ寄せた家具・色・光を足す。乱数は `p.rng.fork('dress')` だけを使い、箔 +300 / 三角形 +4 万 / ライト +2 の予算内、繰り返し物は `layout.instances`。`?nodress=1` で Rare、`globalThis.__epicDressingOff = true` で Epic のドレッシングを切って比較できる。
- **謎の物体（モニュメント）**: `src/generators/monument/`（6 系統の文法をシードで組み立て）→ `src/render/MonumentGeometry.ts`（プリミティブを材質ごとに結合）。奇妙さ生成の `space.monument` が屋内の中央に 1 基、屋外系に 1〜3 基置く（`docs/monument.md`）。
- **奇妙さ生成（oddity）**: `src/generators/oddity/` がドレッシングの後・Modifier の前に、部屋ごとに主題 1 つ + 添え物 1〜2 つ（間取り / 配置 / 表面 / 光 / 痕跡の 20 種）を足す。Common は 18% だけ正常な部屋。主題は入口正面に置く。`?noodd=1` で無効、`layoutFor(node).oddity` に記録（`docs/oddity.md`）。
- **家具の専用形状（V05 第 2 段）**: `src/render/props/FurnitureShapes.ts` が `detailedBoxes` から呼ばれ、`propGroup` + `kind`（chair / linkedSeats / bench / lockerBank / vending / 机上の画面箔）の箔の集合を、座枠・鋼管脚・扉目地・通気口・ベゼルを持つ形状に置き換える（レイアウトと当たり判定は不変）。ドレッシングの箔は `kind: 'dress:*'` を付けると Modifier の後処理（removeFills / removeInterior / NonEuclideanVolume）に捨てられない。`layout.particles` は複数スロット（`src/generators/particles.ts` の addParticles / particleList）。
- **テクスチャの取得（`src/render/textureQueue.ts`）**: CC0 テクスチャは同時 6 件までの待ち行列で取り、503 / 429 / 通信エラーは指数バックオフで 3 回まで読み直す（配信元のレート制限対策）。起動時の一括先読みはせず、初回使用と 2 hop 先の先読みで読む。タイトル画面は最初の部屋が要る分（`materials.imagesReady()`）だけ待つ。`?l2=throttle` で無効化。詳細は `docs/texture-loading.md`。
- **部屋切替の軽量化（L2）**: テクスチャは `fetch` + `createImageBitmap` で別スレッドにデコードし `materials.uploads`（TextureUploadQueue）が 1 フレームあたりの GPU アップロードを分割、2 hop 先の材質を `prefetchAhead` / `precompileAhead`（RenderTarget と光の本数を固定した `compileWith`）で先読み・事前コンパイル、大部屋は `RoomBuildJob` で 24 ms ずつ分割構築する。`?l2=off` で全て無効化、`window.__roomSwitchProfile` / `game.perf().roomSwitch` で入室・開扉のフレーム時間を確認（`docs/perf-room-switch.md`）。
- **構築のフリーズ対策（v1.3）**: 焼き込み（`SurfaceLighting.bake`）は接触陰影を箔の近傍 0.5 m の遮蔽体だけ、光の遮蔽判定を「最小辺 8 cm 以上・体積 0.05 m³ 以上の箱」だけで行い、対角 1.2 m 未満の小箱は遮蔽を箱ごとに 1 回で評価する（箱 3,700 個の食堂で 3.5 s → 0.3 s）。構築済みの部屋は隣接から外れても即 dispose せず 8 部屋 / 200 万三角形まで非表示で保持する（行き来のたびの再構築を防ぐ）。入室時は現在の部屋と見えている部屋だけを同期構築し、閉じた扉の先の部屋は次のフレーム以降に 1 部屋ずつ構築、構築直後に `renderer.compileAsync` で材質シェーダを非同期コンパイルする。段階別の計時は `window.__buildProfile`（最新 50 件）で確認できる。
- **ストリーミングと可視性**: 現在 Room + 1 hop に加え、「向こうが見える Portal」（開いた扉・ガラス扉・扉の無い通路 stairs / ramp / street）で 3 hop 以内に届く部屋を 3D 化して表示する（`Game.seeThrough` / `seeThroughReach`）。閉じた不透明な扉の向こうは描画しない。扉が閉じた時点で見えなくなった部屋を dispose。扉パネルは所有部屋のグループから独立させ、両側どちらかの部屋が見えていれば描く。Seam 扉は閉じた扉として描き、E で開けた瞬間にフェードして遷移する（閉じたパネルに体を寄せても遷移しない。`checkSeamCrossing` はパネルの無い street / gate 開口か開いた Seam 扉の面を越えたときだけ働く）。開いた扉の向こう（2 hop 先）は `ensurePrepared` で接続先を確定してから構築し、見えた後に prune / 床穴撤去で変わらないようにする。

### Modifier パイプライン（`src/modifiers/`）
- **レジストリ**: `src/modifiers/index.ts` が `import.meta.glob('./mods/*.ts', { eager: true })` で自動登録する。**追加方法**: `src/modifiers/mods/<Id>.ts` を作り、`ModifierImpl`（`src/modifiers/types.ts`）を default export する（`id` はファイル名 = 設計表の Modifier ID）。index.ts の編集は不要。補助ファイルは `<Id>.<name>.ts`（basename にドット。例 `ShallowWater.geom.ts`）として同じディレクトリに置くと登録対象から外れる。実装済み: 43 種（deferred 3 種を除く全部。下記「Phase 2」）。オミット: RewindState / DiscoveryGate / FutureAudio（`OMITTED_MODIFIERS`）。フックの配線は `src/modifiers/hooks.ts` の `installWorldHooks(world)`（Game と `tools/seam-stats.mjs` が共用。エレベーター籠 Adapter の 'end' は籠を出した部屋の定義で onConnect を呼ぶ = RepeatDestination U18）。オミット部屋 E10 / M05 / M06 / M10 / M15 / M20 は抽選から除外（`OMITTED_ROOMS`。ID は欠番として残す）。
- **フック**（すべて任意）: `layout(L, p, params, rng)`（generateLayout 直後の決定論 post-pass。RoomLayout を書き換える唯一の場所）/ `onNodeCreated` / `onConnect(ctx) → ConnectDirective` / `build(built, L, ctx)`（RoomBuilder.build 末尾。`built.effects` に RoomEffect を追加）/ `onEnter` / `onExit` / `update(dt, ctx, params)`（毎フレーム。現在部屋 + 可視部屋）/ `canOpen(portal, ctx, params)`（施錠扱いと HUD ヒント）。
- **RuntimeContext**: `{ world, node, built, layout, player{pos,yaw,crouching}, scene, camera, tier, audio, hud.hint() / hud.busy(), now, def, game, interacting? }`（`interacting` は canOpen がユーザー操作から呼ばれたとき true。`hud.busy()` は扉・エレベーターの操作案内が HUD を使っている間 true）。`game`（GameServices）から `proxy`（PlayerProxy + 30 s 姿勢履歴）/ `snapshots` / `ride` / `mapView`（MapRotation / MapErase の書き込み先）/ `startRide()` / `prepare(roomId)`（開いた扉の向こうの構築 = ensurePrepared）/ `transition()` / `enterRoomAt()` を使う。layout フックには `GenParams.node`（生成対象ノード。`modifierState` / `role` / `repeat` の読み出し用）と `GenParams.role` が渡る（Node ハーネスでは undefined）。
- **ゾーン**: `layout.zones[]`（kind: water / friction / force / lane / theme / crawl / ride、ローカル AABB）。RoomBuilder がワールド化し、Game が water / friction / force / lane を `PlayerZone` として PlayerController に渡す（水は速度 ×slow、friction は加減速 ×friction²、force は vector×speed の外力）。地図はゾーンの内訳線を描く（water は青）。
- **params**: `tools/modifier_params.json` → `data/rooms.json` の `modifiers[].params`。`impl.defaults` ← params の順で上書き。`modParams(def, id)` / `hasModifier(def, id)`。

### プレイヤー・入力・乗車
- **PlayerController**: AABB プレイヤー。しゃがみ（上記）、ゾーン効果、`onStride / onLand / onJump` コールバック、`moveRank`。`PlayerRide`（`src/player/PlayerRide.ts`）: 乗車のスクリプト移動（Q5 = C。車内で durationSec 待つ、微振動、視点のみ操作可、5 秒後に E / タップでスキップ）。Game は `state 'riding'` の間、部屋判定・穴・Seam 判定をスキップし、到着で `world.resolveRide` の platform Adapter へ遷移する。`PlayerProxy`: layers 1 の不可視カプセル + `PoseHistory.poseAt(sec)`。
- **入力**: `src/input/InputController.ts`。PC とタッチを同じ `InputState`（crouch を含む）に統一。`sensitivityScale` に設定の視点感度を掛ける。開発用に `game.devInput = { crouch: true }` で入力を上書きできる。

### 音（`src/audio/`。v1.3 Q8 = C）
- **AudioEngine**: WebAudio 手続き合成の単一入口。Game が 1 つ所有（`game.audio`）。開始クリックで `unlock()`、入室で `setRoom(def, layout, tier, { roomId, hints, wet })`（audioPreset ラベル → 合成レイヤー、Sabine 近似の残響 5 段階、床材で足音）、毎フレーム `setListener / update`。ボイス予算 low 8 / mid 12 / high 20。`public/audio/manifest.json` にファイルがあれば合成レイヤーを差し替える（無ければ合成フォールバック）。
- 効果音: 足音（歩幅 0.75 / ダッシュ 1.1 m、しゃがみ -8 dB、水）、着地、扉 open / close / locked（施錠音は Portal ごとに 1 回）、エレベーター move / bell、UI。Modifier 向け: `audio.play(kind, { pos, loop, gain })`、`beacon`、`overridePreset`、`setNeighborLeak`、`requestMic` / `loudnessLevel`（E17）、`events.between`（E12）。
- **設定**（`src/core/Settings.ts` / `src/ui/SettingsPanel.ts`）: 音量 3 本・視点感度・品質 Tier・描画効果（撮像プリセット。既定 tape）・VHS 効果（0〜200%。既定 200%）・手持ち感（0〜1。既定 0.6、0 で無効）・視線の遅れ（既定 on）・表示 fps（プリセットに従う / 30 / 24 に間引く。tape 以外でも指定可）・REC 表示（既定 on）・トーンマップ（開発用）を `localStorage 'liminal.settings.v3'`（v2 / v1 から移行。VHS 効果は新しい既定に） に保存し起動時に復元。メニューの「設定」パネル（`#settings-slot`）。カメラ挙動の数値は `docs/film-camera.md`。

### 地図（D6）
- `src/map/GridProjector.ts` が実座標から 4 m セルへ投影（Legendary 巨大部屋は上限 80 セル）。**部屋は footprint の実形で描く**（折れ廊下・翼付き部屋の矩形ごと）。多層の巨大部屋は `MapCell.levelSpan` で全フロアに描く（非基準階は薄く、Map3D は厚み分）。ゾーン内訳線。グリフ: crawl（下半分の矩形）/ street・gate（太い扉印）/ water（波線）/ 乗車（▣）/ Seam・far（？）/ 施錠（赤）。ミニマップは現在いるフロアだけ、メニューではフロアタブ + 「全体 3D」（`src/ui/Map3D.ts`）。MapRotation / MapErase は表示側のみ実装済み（`game.mapView.rotation` / `hiddenRoomIds`、または `mapCell.hidden = true`。書き手は Phase 2 の Modifier）。

### その他
- **品質 Tier**: low / mid / high（内部解像度 0.65 / 0.8 / 1.0、ライト上限、フォグ距離、rtUpdateHz、flicker、decals、instanceScale、particleCap、convolver）。自動モードはフレーム時間で昇降。設定で固定可。
- **セーブ**: localStorage に RoomGraph（ノード・配置・Portal・追加ソケット・visitLog・modifierState）+ プレイヤー位置。レイアウトは seed から再生成する。乗車中はセーブしない。

## Phase 2（Modifier 43 種 + Generator 4 種）

`docs/implementation-analysis.md` の「仕様 / 方針 / 前提」を基準に、20 担当が並列実装したものを統合した。各 Modifier は `src/modifiers/mods/<Id>.ts`（補助ファイルは `<Id>.<name>.ts`）。ジオメトリは layout フックで確定し、build / update は位置・可視性・uniform・テクスチャだけ動かす（「入室後に部屋が変わらない」不変条件）。グラフ状態に依存する選択は `node.state.modifierState[<Id>]` に保存する。

### 実装済み Modifier（部屋）

| 分類 | Modifier（部屋） |
|---|---|
| 照明・空 | LightingPhase（U01 seedPhase / R02 unpowered / E04 daylight / L10 allWindowsLit / M14 singleLight）、FakeSky（U20 / R04 / E04）、InvertedShadow（E06）、TemperatureField（E19。照明色 + HUD の温度） |
| 材質・描画 | ColorMissing（E20）、RenderStyle（M13 untextured / M17 legacy）、MaterialGradient（R15）、FogDepth（U13 / R03 / R05 / R06 / L01 / L19 / M14）、Wetness（U07 / U08 / U13 / L09） |
| 水・粒子・ゾーン | ShallowWater（R01 / R14 / L02 桟橋）、ParticleDetail（U07 rain / U12・R19 steam / L09 mist / L19 snow）、SurfaceFriction（C11 / U08 / L19 ice）、ExternalForce（U03 conveyor / R18 wind / L15 lanes）、WaterWall（E09） |
| 外殻・寸法 | GravityAxis（E03 見た目のロール + スロット扉 + 床扉。床扉はパネル付き: E で開けて落ちる。`Portal.covered` の穴は閉じている間は歩いて渡れ、下の部屋は描かれない。4 秒自動閉扉なし）、ScaleAnomaly（R13 ×3 / M12 ×4 / L17 ×1.5 / R16・L12 perProp） |
| 内装の反復 | InstanceOvergrowth（R07 / L03 wheat / L14）、PropRepetition（U11 / U15 / R03 / R20 / L13 / L17）、PropOrientation（U10） |
| テーマ | EraPreset（R11 / E02）、ZoneThemeShuffle（L05 / L20）、AmbientCarryover（M18） |
| 可動 | MovingWalls（E18 lining / M07 blocks。RoomBuilder.buildDynamics に挟み込み防止の停止規則）、DynamicLength（E13 遠ざかる突き当たり。CorridorGenerator が E13 を直線 60/48/36/24 m に） |
| 鏡・スナップショット | MirrorOffset（U09）、PastWindow（R09 3 秒遅延の固定カメラ / E12 過去窓）、GraphReference（E14 / L16 / M16）、SelfMap（M01） |
| サイン | DuplicateNumber（U02 / U16 / R20）、FakeSignage（U04 / U05 / U06 / U17 / R10 / E15 / E16） |
| 接続（onConnect） | LoopTopology（E01 / L08 / L11）、RepeatDestination（R17 / U18 エレベーター籠）、FarLink（M08）、FakeExit（M04）、ObservationRewire（E07）、DynamicMapNode（M03 / M07）、MultiEdge（M11）、NonEuclideanVolume（E08 殻 + 内部の 2 ノード）、VehicleRide（E11 train / L02 boat / L11 monorail） |
| 音・扉・地図 | AudioEvent（U19 / R08 oneShot、U14 beacon）、NoiseGate（E17 静・歩・走の 3 扉 + マイク）、MapErase（M02）、MapRotation（M19） |

### Generator（Phase 2）

- **PoolGenerator**（R01。18 variants）: 幅 3〜12 m のタイル回廊を直線 / L / Z / U / T / 十字で折る。デッキ・手すり・レーンライン・排水溝。水面と水域ゾーンは ShallowWater が敷く。
- **StreetGenerator**（R04 / L01 / L10 / L17 / L20 = StreetGrid、L15 = RoadGraph。6 variants）: 街区格子（外周は街路、島ブロックはソリッド建物 + 窓帯、'street' 常開ゲート）と本線 + T 字分岐 + 立体ランプ（'ramp' 上階出口、車線 'lane' ゾーン）。`growToFill` の対象（StreetGrid、maxDim 64）。
- **MegaStructureGenerator**（L02 / L03 / L12 = MegaHall、L04 / L05 / L07 / L09 / L11 / L14 / L19 = MegaAtrium。20 variants = サイズ 5 段 × 入口位置 4）: 60〜180 m 級。多層は回廊 + 直階段 + 橋、上階外壁にも出口。`L.levels`（歩ける階数）を地図の levelSpan に使う。
- **DynamicGridGenerator**（M07。6 variants）: 3 m セル格子に白ブロック、行・列から最大 8 個を `L.dynamics`（id `MovingWalls:grid<n>`）でスライド。

### 検証手順

- `?force=<ROOM_ID>` で次の部屋抽選をその定義に固定し（例 `http://localhost:5173/?nolock=1&new=1&seed=7&force=E17`）、`docs/phase2-verify.md` の部屋ごとの確認内容（見た目の期待・`window.game` から評価する JS 式）で確認する。
- Node: `npm run seamstats`（Modifier の layout / onNodeCreated / onConnect を含む世界。`--no-mods` で Modifier 無しと比較）。Phase 2 統合時: 10 seed × 100 部屋で Modifier 43 登録、施錠行き止まり 29（Modifier 無し 39）、Seam fallback 0、部屋の重なり 0、決定論 OK、ロード整合 0 / 0、行き先の無い非扉開口 0、connect hook の失敗 0。
- レイアウト: `docs/phase2-layout-check.md`（全 112 部屋 × seed 3 × variant 0/2 = 672 ケースで例外 0、bounds ≤ 200 m、boxes ≤ 8000、sockets ≥ 1、決定論 OK）。
- ブラウザ（統合時）: `?nolock=1&new=1&seed=7` → seed 7 / 11 / 23 × 15 部屋を `game.step` 同期で踏破し、コンソールエラー 0、`ERROR` ログ 0、入室前後で boxes 数が変わった部屋 0。PastWindow の表示面は `SNAPSHOT_EXCLUDE_LAYER`（3）だけに置き、メインカメラがレイヤ 3 を見る（キャプチャ時の GL フィードバックループを解消）。

## データ

`data/*.json` は設計表（xlsx v1.3）から `python3 tools/xlsx_to_json.py <xlsx> data` で生成する（標準ライブラリのみ）。

- `rooms.json`: `{ version, source, rooms[], omitted[] }`。有効 112 RoomDefinition（E05 / M09 は欠番、v1.3 オミット E10 / M05 / M06 / M10 / M15 / M20 は `omitted[]` に分離。`ROOM_BY_ID` では解決できるが抽選には出ない）。`modifiers[]`（ModifierRef）と `layoutHints[]` が実装の正本。`effectLabel` と `dangerTag` は参照しない。
- `templates.json`: 41 テンプレートと 12 Generator クラス（`status` 付き。GraphMacro / Hub は保留）。
- `modifiers.json`: 46 Modifier（`status` / `deferred` 付き。保留 FutureAudio / RewindState / DiscoveryGate）。
- `rules.json`: レア度ルール、性能予算、Portal 型、レイアウト指示語彙、配置ルール 18 件、地図ルール 10 件、操作仕様（しゃがみブロックを含む）。
- `tools/modifier_params.json`: 部屋ごとの Modifier パラメータ初期値（E03 visualOnly / rollDeg、R16 smallDoor、E11 / L02 / L11 skipAfterSec など）。

## テスト方法

ブラウザの DevTools コンソールから `window.game` にアクセスできる。

```js
game.hud.toggleDebug();                       // draw calls / triangles / rooms / chunks / effects / crouch / audio state
game.world.graph.nodes;                       // LogicalRoomGraph
game.world.log;                               // 配置の警告（'WARN dead-end lock' など。'WARN seam fallback' は出ない）
game.newWorld(42);                            // seed 固定で再生成 → 決定論の確認
game.step(1 / 60);                            // 1 フレーム進める（rAF に依存しない同期テスト用）
game.devInput = { crouch: true };             // 入力を上書き（しゃがみの強制。null で解除）
game.world.ensureNeighbors(game.currentRoomId); // 隣接部屋を先に生成（配置統計の計測に）
game.audio.debug();                           // 音のバス・ボイス・プリセット・残響の状態
game.mapView.rotation = Math.PI / 2;          // 地図の回転（MapRotation の表示確認）
```

確認済み（v1.3 統合時、seed 7 / 11 / 23 / 42 / 99 × 15 部屋のテレポート踏破）: コンソールエラー 0、`ERROR` ログ 0、入室前後でレイアウト（boxes 数）が変わった部屋 0、`WARN seam fallback` 0（dead-end lock は 5 seed で 1 件）、しゃがみで当たり判定 1.7 → 0.85 m・視点 1.6 → 0.75 m・速度 1.44 m/s（ダッシュ無効）、FogDepth 部屋（R06）で scene.fog / background が 0.8 s で目標色へ補間、`?force=R16` で depth 1 に R16 が配置、AudioContext が開始クリック後 `running`、メニューの設定パネル表示と footprint 実形の地図。headless（`npm run seamstats`）: 10 seed × 100 部屋で Seam + 施錠行き止まり 32 件（0.84 / 100 ノード）、閉じ込めなし、決定論 OK、ロード整合（ソケット / 箱・照明）0 / 0、施錠され行き先の無い非扉開口 0。

レビュー修正後の再確認（seed 7 / 11 / 23 × 10 部屋、`game.step` 同期実行）: `ERROR` ログ 0、コンソールエラー 0、入室前後で boxes 数が変わった部屋 0、可視 PointLight 本数が常に maxLights（8）、複数チャンク部屋 1609 メッシュ全てがチャンク AABB 内、乗車中のタップで到着短縮、platform の乗降口が施錠ヒント、閉じた Seam 扉への接近で遷移なし / 開いた Seam 扉の面越えで遷移。床穴の乱数は専用 fork（`vr.fork('hole')`）に分離したので v1.3 統合時とレイアウトは一致しない（既存セーブは新しい世界で開始する）。

## 既知の制約

- 素材は生成画像 12 種を共有する PBR 材質。造形は箱を基礎にした簡略モデル。GLB / KTX2 は未導入。素材と全マップの確認は開発サーバーの `/visual-review.html`（[ビジュアル刷新](docs/visual-refresh.md)）。
- Phase 2 の Modifier / Generator はブラウザでの見た目・バランスの確認が未完（検証項目は `docs/phase2-verify.md`。各担当の Node 検証と統合時の踏破確認のみ）。Modifier 間の重なり（例: E03 の GravityAxis と他の L.lights を読む Modifier）は現状のデータでは起きない前提。
- return-seam（E07 / M03 / M07 の先から元の扉へ戻る経路）、`RoomLayout.particles` の複数領域、SignAtlas の小セル（R20 の 48 枚超のサイン）、Pointer Lock のマイク許可後の再取得は Phase 3（`docs/phase2-requests.md` の処理記録を参照）。
- 音は全て合成の仮バランス。実聴での調整と `public/audio/manifest.json` による差し替えは今後。
- 進行用扉がどうしても置けない場合は施錠して行き止まりになる（v1.3 D14。10 seed × 100 部屋で 32 件。主因は前室末端の袋小路と細い隙間）。閉じ込められた場合はメニューの「新しい世界」。
- 実機スマホでの性能計測・CROUCH ボタン位置の確認は未実施。品質 Tier の閾値は仮。
- 部屋別ドレッシングで参考ボードの雰囲気に届いていない部屋（E08 の NonEuclideanVolume 再構築、M02 の画素分解、L01 の塔の高さなど）は `docs/reference-rarities-analysis.md` の「保留」表と各 `docs/reference-<rarity>.md` に理由を記載。
- Rare 以上の部屋の材質バリアントを 2 hop 先で事前コンパイルする `materials.precompile` は未配線（初回構築時に数十〜数百 ms のコンパイルが起き得る）。

- **素材とプロップ**: CC0 セットがあれば PBR 素材と glTF プロップに置き換わる（`docs/cc0-pipeline.md` / `docs/cc0-props.md`）。
