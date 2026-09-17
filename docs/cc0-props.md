# CC0 プロップ置換（kind 付きの箱 → Poly Haven glTF）

> **2026-09-17 更新:** 通常起動時の置換を再有効化。現行配布はmetal_office_desk / pachira_aquatica_01 / dining_tableの3モデル。以下の広範なkind一覧はカタログ設計の履歴であり、全モデルの導入・全家具の置換が済んだ意味ではない。最新の適用範囲・検証・制限は[ V05実装記録](visual-v05/README.md)を参照。

見た目の垂直スライス。生成器が出す家具・小物の直方体（`Box`）に意味タグ `kind` を付け、RoomBuilder が描画時にだけ CC0 の glTF モデルへ置き換える。
**当たり判定・レイアウト・地図・乱数列は箱のまま**（不変条件）。素材の取得は `tools/fetch-cc0-assets.py`、書き出しは `npm run build:cc0:models`（`tools/build-cc0-models.mjs`）。

```
assets/cc0/manifest.json ──build-cc0-models──▶ public/cc0/models/<id>/<id>_1k.gltf (+ .bin, textures/*.jpg)
                                                public/cc0/models/index.json  { id: { gltf, group, size, min, max, triangles, part? } }
Generator（Box.kind）─▶ RoomBuilder.planProps（seed 決定論・同期）─▶ installProps（InstancedMesh。未読込なら箱の仮表示 → 到着後に差し替え）
                                    ▲
                     PropCatalog（index.json → 候補表 / GLTFLoader 遅延読込 / 正規化 / bakedLight 注入 / 共有保持）
```

## kind 一覧（Box.kind）

| kind | 意味 | 付けている場所 |
|---|---|---|
| `desk` | 机の列 | RoomGenerator: Classroom / OfficeGrid の `patternRows`、`furnishGeneric('office')` の rows |
| `table` | テーブル | `furnishGeneric` の rows（office 以外）・islands（soft 以外）、C09 の長机、既存の机相当の箱（`isTableLike`） |
| `chair` | 椅子 | C09 `furnishCafeteriaProps`（机の長辺両側） |
| `cabinet` | 収納・カウンター | RetailRoom のレジ台、`furnishGeneric` perimeter（retail 以外）、C09 の配膳カウンター |
| `shelf` | 棚 | RetailRoom の rows / perimeter、`furnishGeneric('retail')` の perimeter |
| `sofa` | ソファ・肘掛椅子 | `furnishGeneric('soft')` の islands |
| `plant` | 観葉植物 | OrganicZone の islands、C02 廊下、C09 の隅 |
| `bin` | ゴミ箱 | C02 廊下、C09 自販機脇 |
| `extinguisher` | 消火器（床置き） | C02 廊下 |
| `sign.wetFloor` | 注意看板 | C02 廊下 |
| `box` / `crate` | 段ボール / プラコンテナ | C02 廊下 |
| `clock` / `fireAlarm` / `camera` | 壁付き（時計・火災報知器・監視カメラ） | C02 廊下（非ソリッド） |
| `papers` / `crate` | カウンター上の小物（非ソリッド） | C09 配膳カウンター |
| `vending` / `lockers` | 自販機 / ロッカー | SmallRoom 自販機、C09、LockerRoom。**対応モデル無し = 箱のまま** |
| `laptop` `cart` `tv` `ladder` `lightFixture` `payphone` | 予約（カタログにはある。生成器はまだ付けていない） | — |

kind を付けた箔の寸法・位置は従来と同じ。C02（CorridorOffice）と C09（category に「食堂」）だけは、既存の乱数列の**後ろで** `rng.fork('props')` を使って kind 付きの箱を**追加**している（`officeProps` / `furnishCafeteriaProps`）。既存の箱の配置は変わらない。追加箱は床置きなら solid（コライダ）、壁付き・カウンター上の小物は非ソリッド。ソケット周辺（1.1〜1.6 m）と既存ソリッド箱との重なりは避ける。RoomGenerator では追加後に `clearDoorways` が扉前の家具を取り除く。

## カタログ対応表（PropCatalog.PROP_KINDS）

| kind | 候補モデル（先頭ほど優先。箱に収まる候補から seed で選ぶ） |
|---|---|
| chair | SchoolChair_01, plastic_monobloc_chair_01, dining_chair_02 |
| desk | metal_office_desk, SchoolDesk_01 |
| table | dining_table, modern_coffee_table_01, coffee_table_round_01 |
| cabinet | drawer_cabinet, modern_wooden_cabinet, vintage_wooden_drawer_01 |
| shelf | steel_frame_shelves_02, wooden_display_shelves_01, Shelf_01, worn_metal_rack（steel_frame_shelves_01 は書き出しが 11 × 21 m で壊れているため除外） |
| sofa | sofa_02, modern_arm_chair_01, mid_century_lounge_chair |
| plant | potted_plant_02, potted_plant_04, pachira_aquatica_01（`_a` の 1 本だけ）。potted_plant_01 は 176k 三角形で上限超え（除外） |
| bin | metal_trash_can（錆びていない 1 缶だけ）, trashbag |
| extinguisher | korean_fire_extinguisher_01 |
| sign.wetFloor | WetFloorSign_01 |
| crate | plastic_crate_01, plastic_crate_02, plastic_container |
| box | cardboard_box_01 |
| cart | CoffeeCart_01, hand_truck |
| laptop | classic_laptop |
| papers | office_notepads, stationery_supplies, clipboard, binder_notebook |
| clock / camera / fireAlarm | wall_clock / security_camera_01 / fire_alarm（壁付き） |
| tv | television_02, Television_01 |
| microwave | vintage_microwave |
| ladder | ladder_sectioned_01, wooden_ladder |
| lightFixture | mounted_fluorescent_lights（`_d` の 1 灯）, caged_hanging_light（天井付き） |
| payphone | korean_public_payphone_01 |
| lockers / vending | （無し） |

複数体入りモデル（metal_trash_can / pachira_aquatica_01 / mounted_fluorescent_lights）は `index.json.part`（ノード名の正規表現）で 1 体だけ使う。実寸・三角形数もその部分で計算する。

## 配置規則（RoomBuilder.planProps / fitProp）

- 対象: `Box.kind` があり、`PropCatalog.ready`（index.json 到着済み、`?props=0` でない）で、部屋が legacy / untextured / E03 ロールでないとき。
- 決定論: `new Rng(node.seed).fork('props')` を箱 index で fork。同じ seed なら同じモデル・同じ揺らぎ。
- 向き: 候補 yaw は 90° 刻み。優先は「椅子 → 最寄りの机（1.8 m 以内）に正対」「壁際（外壁面から 0.35 m 以内）→ 壁に背を向ける」「それ以外 → 部屋の中心へ」。箱もモデルも細長い（比 1.3 超）ときは長辺を揃える。モデルの前面は +Z（Blender -Y。Poly Haven の慣例）。
- スケール: 一様。`s = min(box.w / model.w, box.d / model.d, box.h / model.h)` が 0.75〜1.25 に入る候補だけ（小さすぎるモデルの拡大も、大きすぎるモデルの縮小もしない）。候補が無ければ箱のまま描く。列（TILED_KINDS）だけは断面比 1.6 まで許し 1.25 にクランプして並べる（カウンター 0.9 m に 0.55 m の引出しなど）。
- 列（`TILED_KINDS` = desk / table / shelf / cabinet / sofa / lockers）: 断面（奥行き・高さ）でスケールを決め、長辺方向に `floor(長さ / モデル長)` 体を等間隔に並べる。
- 接地: floor = 箱の底面中心、wall（clock / camera / fireAlarm）= 箱の壁側の面の中心（モデルは背面 z=0 に正規化）、ceiling（lightFixture）= 箱の上面中心（モデルは上面 y=0）。
- 揺らぎ: yaw ±5°、位置 ±3 cm（箱の余白内。壁際は壁から離れる向きだけ）。壁付きは揺らさない。
- 選択: 収まる候補のうち充填率（体積比）が最大の 0.6 倍以上のものから seed で 1 つ。同じ kind が 13 箱以上ある部屋は最軽量の 1.6 倍以内の候補から部屋ごとに 1 モデルへ統一。
- 三角形予算: 1 部屋 750k（`PROP_TRIANGLE_BUDGET`。最大級の食堂 29 × 51 m で椅子 139 脚 + 長机 40 + 植栽 3 ≈ 640k が収まる値）、1 モデル 90k（`PROP_MODEL_TRIANGLE_MAX`）。超えるときは使用量の多い kind から「最軽量へ切替 → 1 つおきに間引き」。
- 描画: モデル × チャンクごとに InstancedMesh（プリミティブ別）。焼き込み光は `SurfaceLighting.sample(箱中心)` を InstancedBufferAttribute `bakedLight` で渡し、材質側の注入（`injectBakedLight`）で indirectDiffuse に足す。envMap は MaterialLibrary 共有材質のもの。置換した箱は焼き込みの遮蔽体には残す。
- チャンク: 箱中心（列は各体の位置）のチャンクに属する。
- 読込: 遅延 + 非同期。未読込のモデルは箱を仮表示し、到着で差し替える（部屋が dispose 済みなら捨てる）。ジオメトリ・材質・テクスチャはカタログが保持し、部屋の dispose では clone したジオメトリだけ破棄する。

## Tier 方針

- プロップ数は Tier で間引かない（見た目の完成度優先）。`layout.instances` の `instanceScale` 間引きは従来どおり。
- low で重ければ `PROP_TRIANGLE_BUDGET` を Tier ごとに下げるのが次の手（現状は一定）。
- `?props=0` で置換を無効化（A/B 計測用）。

## 検証（2026-09-16、開発サーバー）

- `npx tsc --noEmit -p .` エラー 0。`node tools/build-cc0-models.mjs` → 69 モデル・419 ファイル・160 MB を `public/cc0/models/` に書き出し（index.json 69 件。カタログ採用 67 件 = steel_frame_shelves_01 除外 + potted_plant_01 三角形上限超え）。
- C02（`?seed=7`、U 字廊下）: kind 付き箱 14（wetFloor 2 / camera / plant 2 / crate 2 / clock 2 / extinguisher / bin / box 2 / fireAlarm）→ 全て glTF に置換（WetFloorSign / security_camera / pachira / potted_plant_02 / plastic_crate_02 / wall_clock / korean_fire_extinguisher / trashbag / cardboard_box / fire_alarm）。床置きは床に接地、壁付きは壁面に密着、扉前の動線は箱と同じ（追加箱はソケットから 1.5 m 以上）。boxes 30 → 44（追加はすべて `rng.fork('props')`。既存 30 箱の配置は不変）。部屋三角形 37k → 180k。
- C09（`?seed=9&force=C09`、29 × 51 m の最大バリアント）: 長机 20（dining_table × 2 体ずつ = 40）/ 椅子 139（plastic_monobloc_chair_01 に統一）/ 配膳カウンター（vintage_wooden_drawer_01 × 3）+ 書類（binder_notebook）+ トレイ（plastic_crate_02）/ 自販機 1（箱のまま）/ ゴミ箱 2（trashbag）/ 植栽 3（pachira_aquatica_01）。boxes 269（シェル 22）。部屋三角形 ≈ 620k（予算 750k 内、間引き無し）。
- 3 seed（7 / 11 / 23）× 10 部屋の踏破（spawnPointOf → teleport → enterRoom → step、部屋ごとに 350 ms 待ち）: 例外 0、`world.log` の ERROR 0、入室前後で boxes 数が変わった部屋 0 / 27。props 有無で経路・boxes 数は同一。
- フレーム時間（`game.step` × 120 の performance.now 差、部屋ごと）: props 有 / 無で seed 7: 488 / 503 ms、seed 11: 263 / 247 ms、seed 23: 469 / 462 ms（10 部屋合計。差はノイズ範囲）。C09 での描画（`renderer.render` × 30 + `gl.finish`）: 6.0 ms（props 有、draw call 56、描画三角形 563k）/ 6.8 ms（無、53、43k）。
- コンソール: プロップ由来のエラー 0、glTF 読込エラー 0。観測した既存の 1 件（`ERROR frame: socket not found r1/entry`）は開始部屋の外（虚空）へ手でテレポートしたときの `Game.checkHole → spawnPointOf(開始部屋)`（開始部屋は entry ソケットが除去済み）で、踏破中には出ない。`loadCc0Index is not defined` は担当 A の `src/main.ts` 編集中に出たもの。

## 今後

- **LOD / decimate**: potted_plant_01（176k）・potted_plant_02（70k）・modular_pipes（95k）は重い。gltf-transform で 1/4 に間引いた `_lod1` を用意し、距離で切替。
- **KTX2**: 1K JPG × 3 枚 / モデルを KTX2（ETC1S）に。`GLTFLoader.setKTX2Loader`。
- **追加モデル**: 自販機・ロッカー・電子レンジ（小型）・事務椅子・オフィスパーティション（Poly Haven に無いので他の CC0 元）。
- **他の Generator**: Grid / Atrium / Parking / Pool / Street / Mega の箱に kind を付ける（この段階では触っていない）。`laptop` / `papers` を机の上に置く（OfficeGrid）。
- **roomFog**: 部屋固有の霧（FogDepth）の材質側処理はプロップ材質に未注入（scene.fog は効く）。MaterialLibrary 側に注入ヘルパが公開されれば置き換える（`docs/cc0-requests.md`）。
- **影**: 焼き込みは箱中心 1 点の定数。机の下の接触陰影などは無い。
