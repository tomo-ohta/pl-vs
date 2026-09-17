# Phase 2 レイアウトチェック（統合時）

生成: `generateLayout`（Modifier layout フック込み）を Node（Vite SSR ビルド）で実行。全 112 部屋 × seed {1, 42, 777} × variant {0, 2} = 672 ケース。入口 door 1.0、exits = max(1, minExits)、allowHole。

## 集計

| 指標 | 値 |
|---|---|
| ケース数 | 672 |
| 例外 | 0 |
| Modifier layout フックの失敗（console.warn） | 0 |
| bounds が 200 m 超（幅または奥行） | 0 |
| boxes > 8000 | 0 |
| sockets < 1 | 0 |
| shellCount 未設定 | 24 |
| 非決定論（同入力 2 回で JSON 不一致） | 0 |
| Modifier 登録数 / 期待（deferred・オミット除く） | 43 / 43（欠落: なし） |

## 部屋別

| ID | Generator | Template | variants | ケース | 例外 | 最大 boxes | 最大 bounds 幅×奥行 (m) | 最小 sockets | shellCount 未設定 | 非決定論 | mod warn | 最大 ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | CorridorGenerator | CorridorSchool | 16 | 6 | 0 | 40 | 20.0×25.5 | 4 | 0 | 0 | 0 | 1.4 |
| C02 | CorridorGenerator | CorridorOffice | 16 | 6 | 0 | 38 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.2 |
| C03 | CorridorGenerator | CorridorHotel | 16 | 6 | 0 | 56 | 19.0×25.5 | 4 | 0 | 0 | 0 | 0.0 |
| C04 | CorridorGenerator | CorridorService | 16 | 6 | 0 | 35 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.0 |
| C05 | CorridorGenerator | CorridorHospital | 16 | 6 | 0 | 53 | 20.0×25.5 | 4 | 0 | 0 | 0 | 0.0 |
| C06 | ParkingGenerator | ParkingGrid | 6 | 6 | 0 | 172 | 57.0×36.0 | 6 | 0 | 0 | 0 | 0.4 |
| C07 | CorridorGenerator | TransitCorridor | 16 | 6 | 0 | 36 | 21.0×25.5 | 5 | 0 | 0 | 0 | 0.0 |
| C08 | CorridorGenerator | ApartmentCorridor | 16 | 6 | 0 | 48 | 19.0×25.5 | 4 | 0 | 0 | 0 | 0.1 |
| C09 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 124 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.4 |
| C10 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 120 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| C11 | RoomGenerator | LockerRoom | 24 | 6 | 0 | 69 | 27.0×25.5 | 4 | 0 | 0 | 0 | 0.1 |
| C12 | GridGenerator | WarehouseGrid | 12 | 6 | 0 | 323 | 31.0×36.0 | 5 | 0 | 0 | 0 | 0.4 |
| C13 | GridGenerator | WarehouseGrid | 12 | 6 | 0 | 323 | 31.0×36.0 | 5 | 0 | 0 | 0 | 0.0 |
| C14 | RoomGenerator | SmallRoom | 24 | 6 | 0 | 26 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.0 |
| C15 | RoomGenerator | RetailRoom | 24 | 6 | 0 | 71 | 27.0×25.5 | 4 | 0 | 0 | 0 | 0.0 |
| C16 | RoomGenerator | Restroom | 24 | 6 | 0 | 37 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.0 |
| C17 | CorridorGenerator | CorridorEntertainment | 16 | 6 | 0 | 51 | 19.0×25.5 | 4 | 0 | 0 | 0 | 1.2 |
| C18 | AtriumGenerator | AtriumLobby | 8 | 6 | 0 | 123 | 52.0×41.0 | 6 | 0 | 0 | 0 | 0.2 |
| C19 | CorridorGenerator | TransitCorridor | 16 | 6 | 0 | 36 | 21.0×25.5 | 5 | 0 | 0 | 0 | 0.0 |
| C20 | VerticalGenerator | VerticalCore | 1 | 6 | 0 | 47 | 8.3×8.3 | 3 | 6 | 0 | 0 | 0.3 |
| U01 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 32 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.2 |
| U02 | CorridorGenerator | CorridorHotel | 16 | 6 | 0 | 56 | 19.0×25.5 | 4 | 0 | 0 | 0 | 0.5 |
| U03 | AtriumGenerator | AtriumLobby | 8 | 6 | 0 | 126 | 52.0×41.0 | 6 | 0 | 0 | 0 | 0.3 |
| U04 | RoomGenerator | SmallRoom | 24 | 6 | 0 | 112 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.4 |
| U05 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 36 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.2 |
| U06 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 121 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.6 |
| U07 | AtriumGenerator | AtriumLobby | 8 | 6 | 0 | 124 | 52.0×41.0 | 6 | 0 | 0 | 0 | 0.4 |
| U08 | CorridorGenerator | CorridorHotel | 16 | 6 | 0 | 56 | 19.0×25.5 | 4 | 0 | 0 | 0 | 0.2 |
| U09 | RoomGenerator | Restroom | 24 | 6 | 0 | 58 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.4 |
| U10 | RoomGenerator | Classroom | 24 | 6 | 0 | 235 | 27.0×25.5 | 4 | 0 | 0 | 0 | 1.1 |
| U11 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 136 | 46.0×46.0 | 5 | 0 | 0 | 0 | 1.2 |
| U12 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 120 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| U13 | RoomGenerator | LockerRoom | 24 | 6 | 0 | 69 | 27.0×25.5 | 4 | 0 | 0 | 0 | 0.2 |
| U14 | RoomGenerator | OfficeGrid | 24 | 6 | 0 | 179 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.0 |
| U15 | GridGenerator | RetailGrid | 12 | 6 | 0 | 100 | 31.0×36.0 | 5 | 0 | 0 | 0 | 0.7 |
| U16 | ParkingGenerator | ParkingGrid | 6 | 6 | 0 | 172 | 57.0×36.0 | 6 | 0 | 0 | 0 | 0.3 |
| U17 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 156 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.2 |
| U18 | VerticalGenerator | VerticalCore | 1 | 6 | 0 | 47 | 8.3×8.3 | 3 | 6 | 0 | 0 | 0.2 |
| U19 | RoomGenerator | PlayArea | 24 | 6 | 0 | 117 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.0 |
| U20 | AtriumGenerator | AtriumLobby | 8 | 6 | 0 | 144 | 52.0×41.0 | 6 | 0 | 0 | 0 | 0.3 |
| R01 | PoolGenerator | PoolCorridor | 18 | 6 | 0 | 156 | 27.0×28.0 | 3 | 0 | 0 | 0 | 1.0 |
| R02 | GridGenerator | RetailGrid | 12 | 6 | 0 | 241 | 31.0×36.0 | 5 | 0 | 0 | 0 | 0.2 |
| R03 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 165 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.6 |
| R04 | StreetGenerator | StreetGrid | 6 | 6 | 0 | 590 | 48.0×44.5 | 4 | 0 | 0 | 0 | 1.4 |
| R05 | CorridorGenerator | Bridge | 16 | 6 | 0 | 17 | 19.5×25.5 | 4 | 0 | 0 | 0 | 0.0 |
| R06 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 32 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.0 |
| R07 | RoomGenerator | OrganicZone | 24 | 6 | 0 | 173 | 46.0×46.0 | 5 | 0 | 0 | 0 | 5.7 |
| R08 | GridGenerator | ShelfGrid | 12 | 6 | 0 | 241 | 31.0×36.0 | 5 | 0 | 0 | 0 | 0.0 |
| R09 | RoomGenerator | Theater | 24 | 6 | 0 | 119 | 35.0×37.0 | 5 | 0 | 0 | 0 | 0.2 |
| R10 | AtriumGenerator | Terminal | 8 | 6 | 0 | 183 | 36.0×66.0 | 6 | 0 | 0 | 0 | 0.3 |
| R11 | CorridorGenerator | CorridorHotel | 16 | 6 | 0 | 69 | 19.0×25.5 | 4 | 0 | 0 | 0 | 0.5 |
| R12 | RoomGenerator | Gallery | 24 | 6 | 0 | 101 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| R13 | RoomGenerator | PlayArea | 24 | 6 | 0 | 117 | 138.0×138.0 | 5 | 0 | 0 | 0 | 0.3 |
| R14 | RoomGenerator | GenericRoom | 24 | 6 | 0 | 170 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| R15 | CorridorGenerator | CorridorService | 16 | 6 | 0 | 34 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.2 |
| R16 | RoomGenerator | OfficeGrid | 24 | 6 | 0 | 188 | 46.0×46.0 | 5 | 0 | 0 | 0 | 1.0 |
| R17 | CorridorGenerator | CorridorHospital | 16 | 6 | 0 | 53 | 20.0×25.5 | 4 | 0 | 0 | 0 | 0.1 |
| R18 | RoomGenerator | GenericRoom | 24 | 6 | 0 | 131 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.0 |
| R19 | RoomGenerator | RetailRoom | 24 | 6 | 0 | 71 | 27.0×25.5 | 4 | 0 | 0 | 0 | 0.0 |
| R20 | GridGenerator | StorageGrid | 12 | 6 | 0 | 288 | 31.0×36.0 | 5 | 0 | 0 | 0 | 0.8 |
| E01 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 32 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.1 |
| E02 | VerticalGenerator | VerticalCore | 1 | 6 | 0 | 56 | 8.3×8.3 | 3 | 6 | 0 | 0 | 0.2 |
| E03 | CorridorGenerator | CorridorHotel | 16 | 6 | 0 | 66 | 19.0×25.5 | 5 | 0 | 0 | 0 | 0.6 |
| E04 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 85 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| E06 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 177 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.3 |
| E07 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 32 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.1 |
| E08 | RoomGenerator | SmallRoom | 24 | 6 | 0 | 11 | 4.0×4.0 | 2 | 0 | 0 | 0 | 0.2 |
| E09 | RoomGenerator | OfficeGrid | 24 | 6 | 0 | 181 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.3 |
| E11 | AtriumGenerator | Terminal | 8 | 6 | 0 | 213 | 40.4×73.3 | 6 | 0 | 0 | 0 | 0.4 |
| E12 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 47 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.4 |
| E13 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 34 | 2.5×63.5 | 5 | 0 | 0 | 0 | 0.1 |
| E14 | RoomGenerator | Gallery | 24 | 6 | 0 | 117 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.2 |
| E15 | VerticalGenerator | VerticalCore | 1 | 6 | 0 | 47 | 8.3×8.3 | 3 | 6 | 0 | 0 | 0.1 |
| E16 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 44 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.2 |
| E17 | RoomGenerator | GenericRoom | 24 | 6 | 0 | 129 | 46.0×46.0 | 4 | 0 | 0 | 0 | 0.4 |
| E18 | CorridorGenerator | CorridorHotel | 16 | 6 | 0 | 56 | 19.0×19.5 | 4 | 0 | 0 | 0 | 0.3 |
| E19 | GridGenerator | MazeGrid | 12 | 6 | 0 | 148 | 31.0×36.0 | 5 | 0 | 0 | 0 | 0.5 |
| E20 | RoomGenerator | GenericRoom | 24 | 6 | 0 | 131 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| L01 | StreetGenerator | StreetGrid | 6 | 6 | 0 | 1360 | 64.0×59.5 | 6 | 0 | 0 | 0 | 0.3 |
| L02 | MegaStructureGenerator | MegaHall | 20 | 6 | 0 | 710 | 178.2×144.5 | 5 | 0 | 0 | 0 | 2.0 |
| L03 | MegaStructureGenerator | MegaHall | 20 | 6 | 0 | 455 | 191.5×162.5 | 6 | 0 | 0 | 0 | 9.7 |
| L04 | MegaStructureGenerator | MegaAtrium | 20 | 6 | 0 | 3024 | 172.4×107.5 | 6 | 0 | 0 | 0 | 3.1 |
| L05 | MegaStructureGenerator | MegaAtrium | 20 | 6 | 0 | 1324 | 170.5×136.0 | 5 | 0 | 0 | 0 | 1.4 |
| L06 | AtriumGenerator | Terminal | 8 | 6 | 0 | 181 | 36.0×66.0 | 6 | 0 | 0 | 0 | 0.1 |
| L07 | MegaStructureGenerator | MegaAtrium | 20 | 6 | 0 | 1270 | 58.0×97.4 | 7 | 0 | 0 | 0 | 0.4 |
| L08 | AtriumGenerator | Terminal | 8 | 6 | 0 | 181 | 36.0×66.0 | 6 | 0 | 0 | 0 | 0.0 |
| L09 | MegaStructureGenerator | MegaAtrium | 20 | 6 | 0 | 1530 | 170.5×127.5 | 5 | 0 | 0 | 0 | 0.7 |
| L10 | StreetGenerator | StreetGrid | 6 | 6 | 0 | 1373 | 64.0×59.5 | 6 | 0 | 0 | 0 | 0.5 |
| L11 | MegaStructureGenerator | MegaAtrium | 20 | 6 | 0 | 1111 | 175.7×173.2 | 5 | 0 | 0 | 0 | 0.9 |
| L12 | MegaStructureGenerator | MegaHall | 20 | 6 | 0 | 576 | 61.0×170.5 | 5 | 0 | 0 | 0 | 0.8 |
| L13 | GridGenerator | ServerGrid | 12 | 6 | 0 | 113 | 31.0×36.0 | 5 | 0 | 0 | 0 | 0.7 |
| L14 | MegaStructureGenerator | MegaAtrium | 20 | 6 | 0 | 2103 | 170.5×153.0 | 6 | 0 | 0 | 0 | 132.5 |
| L15 | StreetGenerator | RoadGraph | 6 | 6 | 0 | 381 | 46.4×70.0 | 4 | 0 | 0 | 0 | 1.1 |
| L16 | RoomGenerator | Gallery | 24 | 6 | 0 | 133 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| L17 | StreetGenerator | StreetGrid | 6 | 6 | 0 | 1361 | 96.0×89.3 | 5 | 0 | 0 | 0 | 0.6 |
| L18 | ParkingGenerator | ParkingGrid | 6 | 6 | 0 | 172 | 57.0×36.0 | 6 | 0 | 0 | 0 | 0.0 |
| L19 | MegaStructureGenerator | MegaAtrium | 20 | 6 | 0 | 638 | 175.5×90.5 | 5 | 0 | 0 | 0 | 0.5 |
| L20 | StreetGenerator | StreetGrid | 6 | 6 | 0 | 1069 | 64.0×59.5 | 5 | 0 | 0 | 0 | 0.5 |
| M01 | RoomGenerator | SmallRoom | 24 | 6 | 0 | 33 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.2 |
| M02 | RoomGenerator | SmallRoom | 24 | 6 | 0 | 26 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.0 |
| M03 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 32 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.0 |
| M04 | RoomGenerator | SmallRoom | 24 | 6 | 0 | 26 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.0 |
| M07 | DynamicGridGenerator | DynamicGrid | 6 | 6 | 0 | 124 | 30.0×33.0 | 4 | 0 | 0 | 0 | 1.1 |
| M08 | RoomGenerator | SmallRoom | 24 | 6 | 0 | 26 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.0 |
| M11 | AtriumGenerator | AtriumLobby | 8 | 6 | 0 | 126 | 52.0×41.0 | 6 | 0 | 0 | 0 | 0.1 |
| M12 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 32 | 64.0×110.0 | 4 | 0 | 0 | 0 | 0.0 |
| M13 | RoomGenerator | LargeRoom | 24 | 6 | 0 | 25 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| M14 | CorridorGenerator | Bridge | 16 | 6 | 0 | 21 | 19.5×25.5 | 4 | 0 | 0 | 0 | 0.1 |
| M16 | RoomGenerator | Gallery | 24 | 6 | 0 | 149 | 46.0×46.0 | 5 | 0 | 0 | 0 | 0.1 |
| M17 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 32 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.1 |
| M18 | RoomGenerator | SmallRoom | 24 | 6 | 0 | 26 | 10.5×11.0 | 3 | 0 | 0 | 0 | 0.0 |
| M19 | CorridorGenerator | GenericCorridor | 16 | 6 | 0 | 32 | 16.0×27.5 | 4 | 0 | 0 | 0 | 0.0 |

## Modifier 登録一覧

AmbientCarryover, AudioEvent, ColorMissing, DuplicateNumber, DynamicLength, DynamicMapNode, EraPreset, ExternalForce, FakeExit, FakeSignage, FakeSky, FarLink, FogDepth, GraphReference, GravityAxis, InstanceOvergrowth, InvertedShadow, LightingPhase, LoopTopology, MapErase, MapRotation, MaterialGradient, MirrorOffset, MovingWalls, MultiEdge, NoiseGate, NonEuclideanVolume, ObservationRewire, ParticleDetail, PastWindow, PropOrientation, PropRepetition, RenderStyle, RepeatDestination, ScaleAnomaly, SelfMap, ShallowWater, SurfaceFriction, TemperatureField, VehicleRide, WaterWall, Wetness, ZoneThemeShuffle

## 注記

- `shellCount 未設定` の 24 ケースは VerticalGenerator の 4 部屋（C20 / U18 / E02 / E15）。旧式 Generator でシェルと内装が 1 つの配列に混在しており、`shellCount` は任意フィールドのまま（EraPreset.shellSplit は undefined を「旧式」として扱う実装済み。これらの部屋の Modifier（RepeatDestination / EraPreset / FakeSignage）は shellCount に依存しない）。
- L03（MegaHall xl）は統合時に基準長辺を 200 → 180 m にして、jitter +10% でも bounds が 200 m 以下になるようにした（当初 213 m のケースがあった）。
- variant は各 Generator の `variants`（表の variants 列）で折り返す。VerticalGenerator は 1 のみなので variant 0 / 2 は同一レイアウト。
