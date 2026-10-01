# Phase 1 並列作業: 共有ファイルへの変更依頼

各担当が末尾に追記する（上書き禁止）。統合担当が配線する。

## F2 プレイヤー・入力・しゃがみ / src/game/Game.ts / InputController の ui に crouch ボタンを渡す
- 変更: `new InputController(canvas, { ..., crouch: document.getElementById('btn-crouch')! })`。
- 理由: スマホの CROUCH トグル（index.html に #btn-crouch 追加済み。JUMP の上）。省略時はスマホのしゃがみが使えないだけで型エラーにはならない。

## F2 / src/game/Game.ts / Game.step でゾーンを PlayerController に渡す
- 変更: `this.player.update(dt, input, colliders, zones)`。zones は現在部屋 + 1 hop の BuiltRoom.zones（ローカル AABB）を `aabbToWorld(zone.aabb, node.placement)` でワールド化し、`PlayerZone`（src/player/PlayerController.ts から export。kind 'water'|'friction'|'force'|'lane', aabb, vector?, params?: { slow?, friction?, speed? }）へ変換したもの。force の vector は placement の yaw で回してワールド方向にする。
- 理由: ShallowWater（×slow）、SurfaceFriction（accel × friction²）、ExternalForce（コンベア/風）の効果。colliders と同様に毎フレーム配列を組めばよい（数は少ない）。

## F2 / src/game/Game.ts / PlayerRide（乗車）の配線
- 変更: `readonly ride = new PlayerRide(this.player, this.camera)`。Game.step で `if (this.ride.riding) this.ride.update(dt, input); else this.player.update(...)`。VehicleRide の車両扉をインタラクトしたら `ride.start({ path, durationSec, allowSkipAfterSec: 5, shake: 0.015, onArrive })` と `state = 'riding'`（メニュー・セーブは state === 'playing' のときだけ）。onArrive で fade → resolveVehicle → teleport → enterRoom(platform) → state = 'playing'。`newWorld` / `load` では `ride.cancel()`。HUD: `ride.canSkip` のとき「E: 到着を早める」/「タップ: 到着を早める」。
- 理由: Q5-C（車内で durationSec 待ち、5 秒後にスキップ可）。乗車中は detectRoom / checkHole / checkSeamCrossing をスキップするのが安全（車内位置は部屋境界の外に出ることがある）。

## F2 / src/game/Game.ts / PlayerProxy の配線
- 変更: `readonly proxy = new PlayerProxy(); this.scene.add(this.proxy.mesh);` Game.step の player/ride 更新後に `this.proxy.update(dt, this.player)`。`newWorld` / `load` で `this.proxy.history.clear()`。
- 理由: MirrorOffset / PastWindow / InvertedShadow（Phase 2）が `proxy.history.poseAt(sec)` と `proxy.mesh`（layers 1）を使う。通常カメラは layer 0 のみなので描画への影響なし。

## F2 / src/game/Game.ts / 音（F5）向けフック
- 変更: AudioEngine 側で `player.onStride = (rank) => …`、`player.onLand = (speed) => …`、`player.onJump = () => …` を設定し、`player.moveRank` / `player.crouching` / `player.inWaterZone` を参照する。
- 理由: 足音（歩幅 0.75 / ダッシュ 1.1 m）、着地音、E17 NoiseGate の移動音量。しゃがみ中は moveRank が 'walk'（実速度 1.5 m/s）になるので、静音扱いにしたければ `player.crouching` を併用する。

## F2 / README.md / 操作表の更新
- 変更: 操作表に「左 Ctrl / C しゃがみ（押している間）」「スマホ: 右下 CROUCH（タップで切替）」を追加。
- 理由: v1.3 のしゃがみ追加。index.html の #start の説明は更新済み。

## F5 地図側の受け口（Minimap / Map3D / MapPanel / GridProjector）からの依頼

- 担当: F5 / 対象: src/game/Game.ts / 変更: (1) Game.step のミニマップ `drawMap(..., view)` の view に `rotation`（MapRotation の現在角。ラジアン。`degToRad(90)` を GridProjector から import 可）と `hiddenRoomIds`（MapErase の集合。`mapCell.hidden=true` を使うなら省略可）を渡す。(2) `openMenu` の `mapPanel.show(world, roomId, player, { rotation, hiddenRoomIds })`、メニュー表示中は毎フレーム `mapPanel.setView({ rotation, hiddenRoomIds })`（値が変わったときだけ再描画する）。 / 理由: MapRotation（M19）・MapErase（M02）の表示側配線。既存呼び出しは省略可能引数なので不変。
- 担当: F5 / 対象: src/world/WorldManager.ts（projector.assign の 3 か所） / 変更: 多層の巨大部屋（Mega / Street の多層アトリウム等）では `this.projector.assign(roomId, wb, parentCell, dir, seam, { levelSpan })` の第 6 引数に階数を渡す。階数は Generator / 定義側が知っている値（layout.levels 等）を使い、無ければ `levelSpanOf(wb)`（GridProjector export。天井高 +0.5 m を 3.6 で割る。吹き抜けの単層ホールも 2 になり得るので多層と分かる部屋にだけ使う）。単層は従来どおり省略。 / 理由: MapCell.levelSpan を設定しないと上階の出口先の部屋が地図で宙に浮く。Minimap / Map3D は levelSpan を見て多層部屋を全フロアに描く（非基準階は薄く、Map3D は厚み levelSpan 分）。
- 担当: F5 / 対象: src/generators/layout.ts（RoomLayout.zones の型を確定する担当） / 変更: Minimap は `layout.zones` を構造的に読む: `{ kind?: string; aabb?: AABB（ローカル）; rect?: Rect（ローカル xz）; level?: number（基準階からの相対階） }`。`aabb` か `rect` のどちらかがあれば内訳線を描く。`kind` が 'friction' / 'force' は描かない、'water' は青、それ以外は白の薄線。 / 理由: Legendary 巨大部屋のゾーン内訳線（Q2-B）。型が確定したら Minimap 側の `ZoneLike` を正式型の import に置き換えてよい（フィールド名が上記と違う場合は F5 に連絡）。
- 担当: F5 / 対象: Modifier 実装（MapErase M02） / 変更: 退室時に `node.mapCell.hidden = true` を書く（SaveManager が mapCell をそのまま保存するので永続化される）か、Game が `hiddenRoomIds` を組み立てて渡す。どちらでも Minimap / Map3D / MapPanel は隠す。現在部屋が隠し対象のときは破線の外形とプレイヤー矢印だけ描く。発見数は変えない。 / 理由: MapErase の表示側は実装済み。フラグの書き手だけ必要。
- 担当: F5 / 対象: README.md（地図の節） / 変更: 「部屋は footprint の実形で描く。多層部屋は levelSpan。Legendary は最大 80 セル + ゾーン内訳線。グリフ: crawl（低い開口＝下半分の矩形）/ street・gate（太い扉印）/ water（波線）/ 乗車（▣）/ Seam・far（？）/ 施錠（赤）。MapRotation / MapErase は表示側のみ」を追記。 / 理由: 仕様の反映。
- 担当: F5 / 補足: layout.ts に `Zone { kind: ZoneKind; aabb: AABB }` が入ったので Minimap は正式型を import して読むように変更済み（上の zones 依頼は不要。friction / force は描かず、water は青、lane / theme / crawl / ride は白の薄線。相対階は aabb.min.y から算出）。

## F1 Modifier パイプライン・RoomLayout / RoomBuilder 拡張・材質バリアントからの依頼

- 担当: F1 / 対象: src/generators/footprint.ts（buildShell / wallOnEdge） / 変更: ソケット → Opening の変換を `openingOf(s, axis)`（layout.ts export。`{ at, width, height, y: s.sill ?? 0 }`）にし、wallOnEdge で `op.y > 0` なら開口の下（y .. y+op.y）にも壁帯を残し、上部は `y + op.y + op.height .. y + h` にする（layout.ts の wallAlongX / wallAlongZ は同じ対応済み。参考実装）。 / 理由: E03 横倒しホテルの横長スロット（幅 2.1 × 高 1.0、sill 0.6）と R16 小型扉（0.7 × 1.2）。RoomBuilder 側の扉パネル・枠・コライダは Socket.sill / height / crawl を既に反映している。
- 担当: F1 / 対象: src/generators/RoomGenerator.ts / CorridorGenerator.ts / GridGenerator.ts / ParkingGenerator.ts / AtriumGenerator.ts / VerticalGenerator.ts / 変更: buildShell の直後にある `const shellCount = L.boxes.length;` を `L.shellCount = L.boxes.length;`（または両方）にして RoomLayout.shellCount を埋める。 / 理由: Modifier の layout フック（ScaleAnomaly / PropOrientation / RenderStyle untextured / E03 roll の rollFrom 既定値）が「シェル以外の内装だけ」を対象にするための境界。無くても動く（全箱が対象になる）が精度が落ちる。
- 担当: F1 / 対象: src/generators/*Generator.ts（E03 / R16 の Generator 側） / 変更: 低い開口・スロットは `socket(id, 'door', pos, dir, SLOT_W, SLOT_H, { sill: SLOT_SILL, crawl: true })` / `socket(id, 'door', pos, dir, CRAWL_DOOR_W, CRAWL_DOOR_H, { crawl: true })`（定数は layout.ts）。makeEntry は EntryReq.height / sill / crawl を引き継いでソケットに写す（common.ts。現状は DOOR_H 固定）。 / 理由: しゃがみ通路の入口側（'crawl' Adapter の反対側は通常扉）。
- 担当: F1 / 対象: src/streaming/RoomStreamingManager.ts（統合） / 変更: (1) Game の Tier 変更時に `builder.setTier(tier)`。(2) 毎フレーム、可視部屋ごとに `for (const e of b.effects) e.update(dt, ctx)`（ctx は modifiers/types.ts の RuntimeContext。現在部屋 + built のみ）と `RoomBuilder.updateChunkVisibility(b, camera.position, tier.fogFar + (b.layout.chunkSize ?? 28))`（1 チャンクの部屋は即 return）。(3) `colliders()` に `b.dynamicColliders.filter(d => d.solid).map(d => d.aabb)` を足す。(4) `updateLights` は `b.group.visible` に加えて各ライトの親チャンクの visible も見ると無駄が減る（任意）。 / 理由: 巨大部屋のチャンク表示切替（Q2-B）、可動要素（MovingWalls / DynamicLength）、パーティクル時間更新。
- 担当: F1 / 対象: src/game/Game.ts（統合） / 変更: (1) enterRoom: 目標 fog = `built.fog ?? { color: layout.palette.fog, near: 12, far: tier.fogFar }`、far を `Math.min(far, tier.fogFar)` でクランプして scene.fog と scene.background を 0.8 s で補間（案 A。材質側の roomFog（案 B）は RoomBuilder が自動適用済みなので、扉口では隣室固有の霧が見える）。(2) enterRoom の前後で `runExit(ctxPrev, defPrev)` / `runEnter(ctx, def)`、step で現在部屋 + built の各部屋に `runUpdate(dt, ctx, def)`（src/modifiers/index.ts）。(3) 扉インタラクト / ヒント: `checkCanOpen(portal, ctx, def)` が ok=false なら開けず hint を HUD に出す（既定「この扉は開かなそうだ」）。(4) `readonly snapshots = new SnapshotService(renderer)`、Tier 変更で `snapshots.setTier(tier)`、newWorld で dispose。ctx に渡せるよう `RuntimeContext` に含めたい場合は F1 に連絡（現状は Modifier が Game 経由で取得する想定）。(5) 任意: Rare 以上の部屋が 2 hop 先で確定したとき `materials.precompile(renderer, scene, camera, overrides)`（overrides は layoutFor(node).render から RoomBuilder と同じ規則で作る。省くと初回構築時に数十〜数百 ms のコンパイルが起きる）。(6) ゾーン: `built.zones` は既にワールド AABB / ワールド vector なので、`kind` が 'water'|'friction'|'force'|'lane' のものをそのまま PlayerZone として渡せる（F2 依頼の aabbToWorld 変換は不要）。 / 理由: FogDepth（Q4）、Modifier のランタイムフック、SnapshotService（PastWindow / GraphReference）。
- 担当: F1 / 対象: src/world/WorldManager.ts（F3） / 変更: ノード生成直後に `notifyNodeCreated(node, def, this)`、接続抽選の直前に `const d = collectConnectDirective({ world: this, node, def, portal, socket, depth, rng })` を connectHooks の 1 つとして呼び、`d?.forceDefinitionId / prefer / seam / lock / smallOnly / far / role / oneWay / skip` を抽選に反映する（型は src/modifiers/types.ts の ConnectContext / ConnectDirective）。RarityGenerator は `OMITTED_ROOMS`（src/modifiers/index.ts）を抽選から除外する。 / 理由: 接続系 Modifier（RepeatDestination / FarLink / LoopTopology / FakeExit / MultiEdge …）の受け口。オミット部屋 E10 / M05 / M06 / M10 / M15 / M20。
- 担当: F1 / 対象: src/data/index.ts / 変更: Phase 3 で Pool / Street / MegaStructure / DynamicGrid の本実装が入ったら IMPLEMENTED_GENERATORS（と Pool / Street は ROOMLIKE_GENERATORS）に追加する。スタブ（generateRoom へ委譲）と switch / VARIANTS の登録は generators/index.ts に済み。 / 理由: 未実装 Generator の受け皿。
- 担当: F1 / 対象: src/dev/VisualReview.ts / 変更: `generateAdapter({ kind: id as AdapterKind, ... })` に型を合わせる（既に通っているので任意）。/visual-review に `?room=` で FogDepth 部屋（R05 / M14）を選ぶと材質側 roomFog が確認できる。 / 理由: 情報共有のみ。
- 担当: F1 / 対象: README.md（統合） / 変更: 「実装済み」に「Modifier パイプライン（src/modifiers/、import.meta.glob 自動登録、FogDepth 実装済み）/ RoomLayout 拡張フィールド / RoomBuilder のチャンク分割・InstancedMesh・Points・SignAtlas・可動要素 / MaterialLibrary.variant（wetness / colorMask / untextured / legacy / gradient / roomFog）/ SnapshotService」を追記し、「Modifier は未適用」「Pool / Street / MegaStructure / DynamicGrid は未実装（LargeRoom 代替）」の記述を更新（スタブあり・data/index.ts 未登録）。 / 理由: 仕様の反映。

## F4 AudioEngine / 設定パネル からの依頼

### F4 / src/game/Game.ts / AudioEngine・Settings・SettingsPanel の配線
- 理由: 音は Game が所有する AudioEngine 経由でのみ鳴らす設計（docs/implementation-analysis.md「音響システム全体」）。呼び出し方の詳細は `src/audio/AudioEngine.ts` 先頭コメント。
- 変更:
  1. `import { AudioEngine } from '../audio/AudioEngine'; import { Settings } from '../core/Settings'; import { SettingsPanel } from '../ui/SettingsPanel';`
  2. コンストラクタ: `this.settings = Settings.load(); this.audio = new AudioEngine(this.settings);` → `bindMenu()` の後に `new SettingsPanel(this.settings);`（#quality の change を Settings.tier と同期させるため bindMenu の後）。`window.game.audio` として公開（`game.audio.debug()`）。
  3. 起動時の Tier: `this.settings.data.tier` が 'auto' 以外なら `autoTier=false; setTier(tier)`（SettingsPanel が #quality に値を入れて change を dispatch するので、bindMenu 済みなら自動で反映される）。
  4. `onStartClick()` 内（ユーザージェスチャ）で `this.audio.unlock();`
  5. `enterRoom(roomId)` の末尾: `this.audio.setRoom(def, layout, this.tier, { roomId, hints: def?.layoutHints, wet: <Wetness/ShallowWater 持ち> })`。layout は `this.streaming.built.get(roomId)?.layout`（無ければ builder が持つ RoomLayout。Adapter は def=null で渡す = 環境音は維持し床材・残響のみ更新）。
  6. `step(dt)` の末尾（render 前）: `this.audio.setListener([cam.x, cam.y, cam.z], this.player.yaw, this.player.pitch); this.audio.update(dt);`
  7. `setTier(id)` 内: `this.audio.setTier(this.tier);`（ボイス予算 low 8 / mid 12 / high 20 と Convolver⇄ディレイ切替）。
  8. `interactRay` の扉トグル: 開くとき `this.audio.door('open', layout.palette.door, doorCenterWorld)`、施錠ヒント表示時（初回のみ）`this.audio.door('locked', ...)`。
  9. `tryElevator`: 遷移開始で `this.audio.elevator('move')`、到着で `this.audio.elevator('bell')`。
  10. `newWorld()` / `loadWorld()` の先頭で `this.audio.clearRoom();`
  11. メニュー開閉で `this.audio.ui('open' | 'close')`（任意）。

### F4 / src/player/PlayerController.ts / 足音・着地・しゃがみのコールバック公開（F? プレイヤー担当）
- 理由: 足音は歩幅（歩行 0.65 m / ダッシュ 0.8 m / しゃがみ 0.5 m）ごとに 1 発、着地は着地速度で音量を変える。E17 NoiseGate のマイク代替（移動音量）も同じ値を使う。
- 変更（後方互換。フィールド追加のみ）:
  - `onStride?: (rank: 'walk' | 'dash', crouching: boolean) => void` — onGround 中の水平移動距離を累積し、閾値ごとに呼んでリセット。
  - `onLand?: (speed: number) => void` — onGround が false→true になったフレームで直前の |vel.y| を渡す。
  - `moveRank: 'still' | 'walk' | 'dash' | 'jump'`（読み取り用）と `crouching: boolean`。
  - Game 側: `player.onStride = (rank, crouching) => this.audio.footstep(undefined, rank, crouching); player.onLand = (speed) => this.audio.land(speed);`
  - E17 用: `this.audio.loudnessLevel(player.moveRank, landedThisFrame)` を毎フレーム呼ぶ（マイク許可があればマイク音量が返る）。

### F4 / src/streaming/RoomStreamingManager.ts / 閉扉の瞬間の通知
- 理由: 閉扉音は angle が 0 に到達したフレームのエッジで 1 回だけ鳴らす（所有側のみ。isReturn パネルでは鳴らさない）。
- 変更: `updateDoors` に `onDoorClosed?: (roomId: string, portalId: string, center: Vec3, doorMat: MatId) => void` コールバック（またはクローズした扉の配列を戻り値に含める）を追加。Game 側で `this.audio.door('close', doorMat, center)`。

### F4 / src/input/InputController.ts / 視点感度倍率
- 理由: SettingsPanel の「視点感度」（Settings.lookSensitivity 0.3〜3、既定 1）を反映する先が無い。
- 変更: `sensitivityScale = 1` フィールドを追加し、`lookDX += e.movementX * this.pcSensitivity * this.sensitivityScale`（タッチも同様）。Game 側で `this.settings.onChange((d) => { this.input.sensitivityScale = d.lookSensitivity; })` と起動時の初期化。

### F4 / index.html / 設定スロット（F2）
- 理由: SettingsPanel は `#settings-slot` にスライダーを生成する。無ければ `#menu .panel .buttons` の直前に自分で `<div id="settings-slot">` を作るので必須ではない。
- 変更（任意）: `#menu .panel` 内、`<canvas id="map3d">` の後・`.buttons` の前に `<div id="settings-slot"></div>` を置く。

### F4 / Modifier 担当（src/modifiers/**）向けの提供 API（依頼ではなく案内）
- AudioEvent: `audio.play('pageTurn' | 'children' | 'phoneRing' | 'beep' | 'knock' | 'chime' | 'clank' | 'drip' | 'laugh' | 'thud' | 'shutter', { pos })`、beacon は `audio.beacon('phoneRing', portalWorldPos)` → `handle.stop()`。
- E02 EraPreset / M18 AmbientCarryover / M08 FarLink 混在: `audio.overridePreset(label, gainMul)`（label は audioPreset と同じ日本語ラベル。例 '蛍光灯ハム・低いハム'）。年代用に `radioHiss` / `crtWhine` レイヤーも用意済み（ラベル例は presetMap の KEYWORDS に無いので、`audio.play('radioHiss', { loop: true })` で直接）。
- E12 遠い過去音: `audio.events.between(audio.now, 31, 29)` で 30 秒前のイベントを取り、`audio.play(kind, { pos, gain: 0.25, lowpassHz: 1200, silentLog: true })`。
- E17 NoiseGate: 扉操作時に `await audio.requestMic()`、毎フレーム `audio.loudnessLevel(rank, jumped)`。
- C17 audioZones（扉ごとの漏れ音）: `audio.setNeighborLeak(neighborDef, doorCenterWorld, open)` / `audio.clearNeighborLeak()`（1 本のみ）。

## F6（設計資料 v1.3 / JSON 再生成）からの依頼

- 担当: F6 / 対象: README.md（統合担当所有）/ 変更: 「データ」節の件数と形を v1.3 に更新 — `rooms.json`: 有効 112 RoomDefinition（E05・M09 欠番 + v1.3 オミット E10 / M05 / M06 / M10 / M15 / M20 は `omitted[]` に分離）、`modifiers.json`: 46 Modifier（`status` / `deferred` 付き。保留 FutureAudio / RewindState / DiscoveryGate）、`templates.json`: generators / templates に `status`（GraphMacro / Hub は保留）、`rules.json`: `controls` にしゃがみブロック、`placementRules` 18 件。「既知の制約」の「進行用 Portal がどうしても配置できない場合の Seam 化は稀に発生する」を「施錠して行き止まり（v1.3 D14）」に差し替え。/ 理由: data/*.json の再生成で内容が変わったため。
- 担当: F6 / 対象: src/data/index.ts（現在の所有者）/ 変更（任意）: `ModifierDef` に `status?: string | null; deferred?: boolean;` を追加し、`(roomsJson as { rooms: RoomDefinition[]; omitted?: RoomDefinition[] })` として `OMITTED_ROOMS` を公開できるようにする。`OMITTED_ROOM_IDS` のハードコードは残してよい（rooms.json 側でも除外済み）。/ 理由: rooms.json は `omitted[]` を持つ形になった。セーブ済みノードが E10 等を参照する場合、`ROOM_BY_ID` では解決できないので、必要なら `omitted[]` も Map に入れる（抽選候補には入れない）。
- 担当: F6 / 対象: src/game/Game.ts, src/streaming/RoomStreamingManager.ts（統合担当所有）/ 変更: なし（情報共有）。v1.3 の資料上、Seam の許可用途は「エレベーター / Legendary 遠方配置 / FarLink / FakeExit / LoopTopology / MultiEdge / ObservationRewire / DynamicMapNode / VehicleRide / NonEuclideanVolume」のみで、置けない進行用扉は施錠（閉じ込め許容）。`game.world.log` の 'WARN seam fallback' が出なくなる想定なので、README のテスト手順の文言も合わせて更新してほしい。/ 理由: D14。

## F3（WorldManager / Seam 削減 / crawl Adapter）からの依頼

### F3 / src/generators/CorridorGenerator.ts / `p.mainRect` を直線廊下に反映
- 必要な変更: `generateCorridor` で `p.mainRect` があり、かつ shape が直線（セグメント 1 本）のとき、`rects[0]` を `rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1)` で置き換える（`width` もその矩形幅に合わせる。折れ廊下では無視してよい）。entry は `makeEntry(p, rects[0], 0, h)` のまま（x=0 が矩形内に残ることは WorldManager 側で保証: x0 ≤ 0 ≤ x1 のときだけ成長させている）。
- 理由: SEAM-7。WorldManager.growToFill は直線廊下にも `node.mainRect`（長手 z1 と幅 ≤ 5.0 m の成長）を書くようになったが、生成器が読まないと効果が出ない（大部屋と廊下の間の 1〜3 m の隙間が「扉の外は空いているが何も入らない」施錠行き止まりの主因。docs/seam-stats.md 残件 5 件）。

### F3 / src/generators/layout.ts / `VARIANTS` にスタブ Generator を登録
- 必要な変更: `VARIANTS` に `PoolGenerator`, `StreetGenerator`, `MegaStructureGenerator`, `DynamicGridGenerator` の段数を追加する（スタブが generateRoom 委譲なら 24）。
- 理由: data/index.ts の IMPLEMENTED_GENERATORS に 4 つを追加したため fallback=false で抽選される。未登録の間は WorldManager が `VARIANTS.RoomGenerator` を既定として使うので動くが、独自 Generator に置き換えた時点で正しい段数が必要。

### F3 / src/render/RoomBuilder.ts / 扉パネルと当たり判定に Socket.sill / height / crawl を反映
- 必要な変更: `buildDoor` のパネル高さ `DOOR_H` を `socket.height`（crawl 開口なら 1.0〜1.2 m）に、位置を `pos[1] + (socket.sill ?? 0)` に。E03 の横長スロット（幅 2.1 × 高 1.0、sill 0.6）は「90° 回転した扉パネル」の見た目、R16 小型扉（0.7 × 1.2、sill 0）は小さな扉。当たり判定 AABB も同じ寸法に。壁の開口自体は footprint.buildShell が sill / height を反映済み（開口下端 = 床 + sill、上端 = sill + height）。
- 理由: crawl 開口の先には WorldManager が 'crawl' Adapter（しゃがみ通路。床 sill → 段 0.3 m × 2 → 0、内部高さ 1.2 m、反対側は通常扉）を必ず挟む。Portal.crawl = true が立つ。

### F3 / src/game/Game.ts / Seam 分岐・ride・far の扱い（統合担当）
- 必要な変更:
  1. 緊急 Seam（`WARN seam fallback`）は廃止した。`portal.seam && portal.type === 'door'` は全て意図的 Seam（Legendary 前室の end / ConnectHook の seam・targetExisting / resolveSeamTarget 済み）なので、`checkSeamCrossing` と interact の Seam 分岐はそのままで「意図的 Seam のみ」を扱う形になる。変更不要だが、README の「緊急 Seam」記述は「意図的 Seam」に直す。
  2. `portal.ride === true` の扉/開口は `world.resolveRide(node, portal)` を呼ぶ（'platform' Adapter を遠方に置き `{ platform, spawn, yaw }` を返す）。VehicleRide（Q5 = C）の車内演出後に `player.teleport(spawn, yaw)` → `enterRoom(platform.roomId)`。
  3. `portal.far === true`（targetExisting / ride）は戻り Portal が無い一方通行。遷移後に戻れない前提で HUD 文言などを出す場合の目印。
  4. 施錠行き止まりの文言は従来の「この扉は開かなそうだ」で良い。`world.log` に `WARN dead-end lock at <room>/<portals>` が残る。
  5. `world.connectHooks.push(hook)` は Game 生成時（Modifier 登録時）に行う。hook は決定論（node.seed 由来の Rng）で書く。
- 理由: Q3 = B、Q5 = C の反映。

### F3 / package.json / `seamstats` スクリプト
- 必要な変更: `"seamstats": "node tools/seam-stats.mjs"` を scripts に追加。
- 理由: 計測ツールの入口（docs/seam-stats.md 参照）。

### F3 / src/ui/Map3D.ts, src/ui/Minimap.ts, src/ui/MapPanel.ts / far Portal の表示
- 必要な変更: `portal.far === true` または `projected === false` の接続は既存の Seam と同じ「？」で描く（Legendary 遠方配置は `mapCell` を `projector.assign(..., seam=true)` で作っている）。
- 理由: Legendary 巨大部屋の遠方配置・FarLink の一方通行接続を地図で誤って線で結ばないため。

## 統合担当 / 処理記録（v1.3 統合時）

上記の依頼はすべて処理済み（依頼先ファイルの所有者は作業終了しているため統合担当が直接編集）。

- F2 → Game.ts: crouch ボタン / ゾーン → PlayerZone / PlayerRide（state 'riding'）/ PlayerProxy / 音フック: **済**。README 操作表: **済**。
- F5 → Game.ts: drawMap / MapPanel に `game.mapView`（rotation / hiddenRoomIds）を渡す: **済**。WorldManager の `levelSpan`: Mega / Street Generator の部屋だけ `levelSpanOf(wb)` を渡す形で **済**。README 地図の節: **済**。
- F1 → footprint.ts（sill）: F3 が対応済みを確認。各 Generator `L.shellCount`: **済**（Corridor / Room / Grid / Parking / Atrium）。RoomStreamingManager（setTier / effects / chunks / dynamicColliders）: **済**。Game（fog 補間 / runEnter / runExit / runUpdate / checkCanOpen / SnapshotService）: **済**。`precompile`: 未配線（任意）。WorldManager（notifyNodeCreated / collectConnectDirective）: `world.nodeHooks` を追加し、Game が両フックを登録する形で **済**（modifiers の ConnectDirective → WorldManager の ConnectDirective は Game.registerWorldHooks で写す。skip は lock として扱う）。README: **済**。
- F4 → Game.ts（AudioEngine / Settings / SettingsPanel）: **済**。PlayerController のコールバック: F2 が実装済み（onStride の第 2 引数は無いので `player.crouching` を参照）。RoomStreamingManager `onDoorClosed`: **済**。InputController `sensitivityScale`: **済**。
- F6 → README データ節 / 既知の制約: **済**。data/index.ts: F3 が対応済みを確認。
- F3 → CorridorGenerator `p.mainRect`（SEAM-7）: 実装したが **既定オフ**（`USE_CORRIDOR_MAIN_RECT = false`）。`node tools/seam-stats.mjs`（10 seed × 100 部屋）の A/B で有効時 deadEnd 50（1.31 / 100 ノード、nodes 3807）、無効時 41（0.98 / 100 ノード、nodes 4201）と悪化したため。layout.ts VARIANTS: generators/index.ts の registerVariants で登録済みを確認。RoomBuilder の sill / crawl: F1 が対応済みを確認。Game.ts の Seam / ride / far: **済**（`portal.ride` → `startRide` → `resolveRide`、checkSeamCrossing は ride / locked を除外）。package.json `seamstats`: **済**。Map3D / Minimap の far: F5 が対応済みを確認。
- 追加（統合担当）: `src/modifiers/types.ts` に `RuntimeContext.def / game`、`GameServices`、`MapViewState`、`ConnectDirective.targetExisting / repeat / roomLikeOnly` を追加。`AudioEngineLike` は `AudioEngine` 型に。
