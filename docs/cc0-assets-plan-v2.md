# CC0 素材の追加取得計画（v2: 用途ごとのバリエーション）

目的: 材質カテゴリごとに 2〜3 種の実測 PBR セットを持ち、部屋 seed で選んで反復感を消す。リノリウム相当の素材（現在テラゾーで代用）も追加する。すべて CC0 1.0。
保存先: `assets/cc0/textures/<id>/`（Poly Haven のテクスチャセット: Diffuse / nor_gl / Rough / AO / Displacement の 1K JPG）、`assets/cc0/materials/<Id>/`（ambientCG の 1K-JPG zip を展開）。`assets/cc0/manifest.json` に追記。

## Poly Haven テクスチャ（1K）

| 用途 | ID | サイズ | 取得元 |
|---|---|---|---|
| linoleum | linoleum_brown | 3.4 MB | https://polyhaven.com/a/linoleum_brown |
| linoleum | old_linoleum_flooring_01 | 2.8 MB | https://polyhaven.com/a/old_linoleum_flooring_01 |
| carpet | dirty_carpet | 5.2 MB | https://polyhaven.com/a/dirty_carpet |
| wall | beige_wall_001 | 0.7 MB | https://polyhaven.com/a/beige_wall_001 |
| wall | beige_wall_002 | 0.3 MB | https://polyhaven.com/a/beige_wall_002 |
| wall | painted_plaster_wall | 3.5 MB | https://polyhaven.com/a/painted_plaster_wall |
| concrete | concrete_floor_worn_001 | 0.8 MB | https://polyhaven.com/a/concrete_floor_worn_001 |
| concrete | painted_concrete | 4.1 MB | https://polyhaven.com/a/painted_concrete |
| tile | dirty_tiles | 2.7 MB | https://polyhaven.com/a/dirty_tiles |
| tile | floor_tiles_06 | 0.9 MB | https://polyhaven.com/a/floor_tiles_06 |
| wood | laminate_floor_02 | 3.4 MB | https://polyhaven.com/a/laminate_floor_02 |
| wood | american_walnut_veneer | 3.2 MB | https://polyhaven.com/a/american_walnut_veneer |
| wood | dark_paneled_wood | 3.8 MB | https://polyhaven.com/a/dark_paneled_wood |
| metal | metal_plate | 4.2 MB | https://polyhaven.com/a/metal_plate |
| rubber | rubber_tiles | 2.5 MB | https://polyhaven.com/a/rubber_tiles |

小計 41 MB（15 セット）

## ambientCG 素材（1K-JPG）

| ID | サイズ | 取得元 |
|---|---|---|
| Plaster003 | 7.9 MB | https://ambientcg.com/a/Plaster003 |
| Fabric022 | 8.5 MB | https://ambientcg.com/a/Fabric022 |
| Wallpaper002A | 6.5 MB | https://ambientcg.com/a/Wallpaper002A |
| PaintedPlaster016 | 9.4 MB | https://ambientcg.com/a/PaintedPlaster016 |
| PaintedPlaster010 | 9.5 MB | https://ambientcg.com/a/PaintedPlaster010 |
| PaintedMetal004 | 8.5 MB | https://ambientcg.com/a/PaintedMetal004 |
| Terrazzo005 | 7.0 MB | https://ambientcg.com/a/Terrazzo005 |
| Carpet003 | 9.3 MB | https://ambientcg.com/a/Carpet003 |
| Fabric027 | 8.6 MB | https://ambientcg.com/a/Fabric027 |
| PaintedMetal013 | 10.3 MB | https://ambientcg.com/a/PaintedMetal013 |
| OfficeCeiling003 | 7.2 MB | https://ambientcg.com/a/OfficeCeiling003 |
| OfficeCeiling006 | 7.3 MB | https://ambientcg.com/a/OfficeCeiling006 |

小計 100 MB（12 セット）

総計 約 141 MB

## 割り当て案（カテゴリ → セット）

- リノリウム（floorLino）: linoleum_brown / old_linoleum_flooring_01 / Terrazzo005（既存 Tiles040 は保持）
- カーペット（floorCarpetGrey/Red）: Fabric028（既存）/ Carpet003 / Fabric027 / Fabric022 / dirty_carpet / Carpet015（既存）
- 壁（wallWhite/Cream/Beige）: PaintedPlaster017・Plaster001・Wallpaper001A（既存）/ PaintedPlaster016 / PaintedPlaster010 / Plaster003 / Wallpaper002A / beige_wall_001 / beige_wall_002 / painted_plaster_wall
- 天井（ceilingWhite/Tile）: OfficeCeiling001・002・005（既存）/ OfficeCeiling003 / OfficeCeiling006
- コンクリート（floor/wall/column）: Concrete034・046・047A・048（既存）/ concrete_floor_worn_001 / painted_concrete
- タイル（floorTile）: Tiles107・133A・141（既存）/ dirty_tiles / floor_tiles_06
- 木（door/trim/furniture）: Wood049・051・WoodFloor051（既存）/ laminate_floor_02 / american_walnut_veneer / dark_paneled_wood
- 金属（塗装）: Metal027・038（既存）/ PaintedMetal004 / PaintedMetal013 / metal_plate
- ゴム: Rubber004（既存）/ rubber_tiles