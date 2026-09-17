# CC0 素材の取得計画（案）

すべて CC0（著作権表示不要・商用可）。出典: Poly Haven（https://polyhaven.com/license）、ambientCG（https://ambientcg.com/license）。
保存先: `assets/cc0/models/<id>/`（glTF + bin + テクスチャ）、`assets/cc0/materials/<id>/`（zip を展開: Color / NormalGL / Roughness / AmbientOcclusion / Displacement）。`assets/cc0/manifest.json` に出典 URL・ライセンス・取得日・サイズを記録する。ゲームへの組み込みは別途 KTX2 化・縮小して `public/` へ書き出す。

## モデル（Poly Haven、glTF 1K テクスチャ）

| 分類 | ID | サイズ | 取得元 |
|---|---|---|---|
| safety/signage | WetFloorSign_01 | 0.3 MB | https://polyhaven.com/a/WetFloorSign_01 |
| safety/signage | korean_fire_extinguisher_01 | 1.6 MB | https://polyhaven.com/a/korean_fire_extinguisher_01 |
| safety/signage | fire_alarm | 1.9 MB | https://polyhaven.com/a/fire_alarm |
| safety/signage | security_camera_01 | 1.8 MB | https://polyhaven.com/a/security_camera_01 |
| safety/signage | wall_clock | 1.6 MB | https://polyhaven.com/a/wall_clock |
| safety/signage | power_box_01 | 2.7 MB | https://polyhaven.com/a/power_box_01 |
| safety/signage | utility_box_01 | 2.0 MB | https://polyhaven.com/a/utility_box_01 |
| waste/plants | metal_trash_can | 5.0 MB | https://polyhaven.com/a/metal_trash_can |
| waste/plants | trashbag | 1.7 MB | https://polyhaven.com/a/trashbag |
| waste/plants | potted_plant_01 | 6.3 MB | https://polyhaven.com/a/potted_plant_01 |
| waste/plants | potted_plant_02 | 2.6 MB | https://polyhaven.com/a/potted_plant_02 |
| waste/plants | potted_plant_04 | 2.1 MB | https://polyhaven.com/a/potted_plant_04 |
| waste/plants | pachira_aquatica_01 | 5.1 MB | https://polyhaven.com/a/pachira_aquatica_01 |
| seating | SchoolChair_01 | 0.5 MB | https://polyhaven.com/a/SchoolChair_01 |
| seating | plastic_monobloc_chair_01 | 2.0 MB | https://polyhaven.com/a/plastic_monobloc_chair_01 |
| seating | dining_chair_02 | 0.9 MB | https://polyhaven.com/a/dining_chair_02 |
| seating | sofa_02 | 0.4 MB | https://polyhaven.com/a/sofa_02 |
| seating | modern_arm_chair_01 | 2.7 MB | https://polyhaven.com/a/modern_arm_chair_01 |
| seating | mid_century_lounge_chair | 2.1 MB | https://polyhaven.com/a/mid_century_lounge_chair |
| seating | modular_street_seating | 7.6 MB | https://polyhaven.com/a/modular_street_seating |
| seating | wheelchair_01 | 1.7 MB | https://polyhaven.com/a/wheelchair_01 |
| tables/desks | SchoolDesk_01 | 0.4 MB | https://polyhaven.com/a/SchoolDesk_01 |
| tables/desks | dining_table | 2.3 MB | https://polyhaven.com/a/dining_table |
| tables/desks | coffee_table_round_01 | 1.6 MB | https://polyhaven.com/a/coffee_table_round_01 |
| tables/desks | modern_coffee_table_01 | 1.3 MB | https://polyhaven.com/a/modern_coffee_table_01 |
| tables/desks | side_table_01 | 0.5 MB | https://polyhaven.com/a/side_table_01 |
| tables/desks | metal_office_desk | 1.6 MB | https://polyhaven.com/a/metal_office_desk |
| storage | drawer_cabinet | 1.1 MB | https://polyhaven.com/a/drawer_cabinet |
| storage | modern_wooden_cabinet | 2.9 MB | https://polyhaven.com/a/modern_wooden_cabinet |
| storage | vintage_wooden_drawer_01 | 0.8 MB | https://polyhaven.com/a/vintage_wooden_drawer_01 |
| storage | steel_frame_shelves_01 | 1.6 MB | https://polyhaven.com/a/steel_frame_shelves_01 |
| storage | steel_frame_shelves_02 | 0.5 MB | https://polyhaven.com/a/steel_frame_shelves_02 |
| storage | wooden_display_shelves_01 | 0.5 MB | https://polyhaven.com/a/wooden_display_shelves_01 |
| storage | Shelf_01 | 0.6 MB | https://polyhaven.com/a/Shelf_01 |
| storage | worn_metal_rack | 2.0 MB | https://polyhaven.com/a/worn_metal_rack |
| storage | cardboard_box_01 | 2.2 MB | https://polyhaven.com/a/cardboard_box_01 |
| storage | plastic_crate_01 | 3.2 MB | https://polyhaven.com/a/plastic_crate_01 |
| storage | plastic_crate_02 | 1.8 MB | https://polyhaven.com/a/plastic_crate_02 |
| storage | plastic_container | 1.3 MB | https://polyhaven.com/a/plastic_container |
| lighting/mep | mounted_fluorescent_lights | 1.9 MB | https://polyhaven.com/a/mounted_fluorescent_lights |
| lighting/mep | caged_hanging_light | 3.1 MB | https://polyhaven.com/a/caged_hanging_light |
| lighting/mep | hanging_industrial_lamp | 3.2 MB | https://polyhaven.com/a/hanging_industrial_lamp |
| lighting/mep | industrial_wall_lamp | 3.8 MB | https://polyhaven.com/a/industrial_wall_lamp |
| lighting/mep | ceiling_fan | 1.9 MB | https://polyhaven.com/a/ceiling_fan |
| lighting/mep | modular_airduct_rectangular_01 | 2.8 MB | https://polyhaven.com/a/modular_airduct_rectangular_01 |
| lighting/mep | modular_pipes | 5.8 MB | https://polyhaven.com/a/modular_pipes |
| lighting/mep | exterior_aircon_unit | 7.7 MB | https://polyhaven.com/a/exterior_aircon_unit |
| lighting/mep | street_lamp_01 | 2.2 MB | https://polyhaven.com/a/street_lamp_01 |
| office small | office_notepads | 1.3 MB | https://polyhaven.com/a/office_notepads |
| office small | stationery_supplies | 2.0 MB | https://polyhaven.com/a/stationery_supplies |
| office small | clipboard | 1.8 MB | https://polyhaven.com/a/clipboard |
| office small | classic_laptop | 2.2 MB | https://polyhaven.com/a/classic_laptop |
| office small | projector_screen | 3.1 MB | https://polyhaven.com/a/projector_screen |
| office small | vintage_stapler | 2.3 MB | https://polyhaven.com/a/vintage_stapler |
| office small | binder_notebook | 1.9 MB | https://polyhaven.com/a/binder_notebook |
| office small | book_encyclopedia_set_01 | 3.3 MB | https://polyhaven.com/a/book_encyclopedia_set_01 |
| office small | standing_chalkboard_01 | 2.6 MB | https://polyhaven.com/a/standing_chalkboard_01 |
| appliances/misc | CoffeeCart_01 | 1.8 MB | https://polyhaven.com/a/CoffeeCart_01 |
| appliances/misc | vintage_microwave | 1.6 MB | https://polyhaven.com/a/vintage_microwave |
| appliances/misc | television_02 | 1.2 MB | https://polyhaven.com/a/television_02 |
| appliances/misc | Television_01 | 0.5 MB | https://polyhaven.com/a/Television_01 |
| appliances/misc | korean_public_payphone_01 | 5.6 MB | https://polyhaven.com/a/korean_public_payphone_01 |
| appliances/misc | boombox | 3.1 MB | https://polyhaven.com/a/boombox |
| appliances/misc | hand_truck | 3.2 MB | https://polyhaven.com/a/hand_truck |
| appliances/misc | ladder_sectioned_01 | 2.6 MB | https://polyhaven.com/a/ladder_sectioned_01 |
| appliances/misc | wooden_ladder | 2.6 MB | https://polyhaven.com/a/wooden_ladder |
| appliances/misc | rollershutter_door | 2.3 MB | https://polyhaven.com/a/rollershutter_door |
| appliances/misc | all_purpose_cleaner | 1.1 MB | https://polyhaven.com/a/all_purpose_cleaner |
| appliances/misc | plunger | 1.8 MB | https://polyhaven.com/a/plunger |

モデル合計: 159 MB（69 点、各 4〜6 ファイル）

## PBR 素材（ambientCG、JPG zip）

| 分類 | ID | 解像度 | サイズ | 取得元 |
|---|---|---|---|---|
| carpet | Carpet016 | 2K | 31.2 MB | https://ambientcg.com/a/Carpet016 |
| carpet | Carpet004 | 2K | 36.3 MB | https://ambientcg.com/a/Carpet004 |
| carpet | Carpet012 | 1K | 10.9 MB | https://ambientcg.com/a/Carpet012 |
| carpet | Carpet015 | 1K | 9.9 MB | https://ambientcg.com/a/Carpet015 |
| carpet | Fabric028 | 1K | 8.2 MB | https://ambientcg.com/a/Fabric028 |
| carpet | Fabric029 | 1K | 8.2 MB | https://ambientcg.com/a/Fabric029 |
| ceiling | OfficeCeiling001 | 2K | 26.2 MB | https://ambientcg.com/a/OfficeCeiling001 |
| ceiling | OfficeCeiling002 | 2K | 25.1 MB | https://ambientcg.com/a/OfficeCeiling002 |
| ceiling | OfficeCeiling005 | 1K | 7.3 MB | https://ambientcg.com/a/OfficeCeiling005 |
| wall | Wallpaper001A | 2K | 20.3 MB | https://ambientcg.com/a/Wallpaper001A |
| wall | Wallpaper001B | 1K | 6.5 MB | https://ambientcg.com/a/Wallpaper001B |
| wall | PaintedPlaster017 | 2K | 14.9 MB | https://ambientcg.com/a/PaintedPlaster017 |
| wall | Plaster001 | 2K | 26.1 MB | https://ambientcg.com/a/Plaster001 |
| wall | Plaster007 | 1K | 8.1 MB | https://ambientcg.com/a/Plaster007 |
| wall | Concrete034 | 1K | 3.7 MB | https://ambientcg.com/a/Concrete034 |
| wall | Concrete046 | 1K | 6.0 MB | https://ambientcg.com/a/Concrete046 |
| wall | Bricks101 | 1K | 7.8 MB | https://ambientcg.com/a/Bricks101 |
| floor | Tiles107 | 2K | 6.7 MB | https://ambientcg.com/a/Tiles107 |
| floor | Tiles133A | 1K | 4.8 MB | https://ambientcg.com/a/Tiles133A |
| floor | Tiles141 | 2K | 16.9 MB | https://ambientcg.com/a/Tiles141 |
| floor | Tiles040 | 1K | 6.5 MB | https://ambientcg.com/a/Tiles040 |
| floor | Tiles132A | 1K | 5.3 MB | https://ambientcg.com/a/Tiles132A |
| floor | Concrete048 | 2K | 29.0 MB | https://ambientcg.com/a/Concrete048 |
| floor | Concrete047A | 1K | 8.6 MB | https://ambientcg.com/a/Concrete047A |
| floor | WoodFloor051 | 1K | 5.1 MB | https://ambientcg.com/a/WoodFloor051 |
| floor | Rubber004 | 1K | 8.4 MB | https://ambientcg.com/a/Rubber004 |
| floor | Asphalt031 | 1K | 8.7 MB | https://ambientcg.com/a/Asphalt031 |
| floor | Road007 | 1K | 6.5 MB | https://ambientcg.com/a/Road007 |
| floor | PavingStones136 | 1K | 6.5 MB | https://ambientcg.com/a/PavingStones136 |
| floor | Marble012 | 1K | 4.7 MB | https://ambientcg.com/a/Marble012 |
| furniture/metal | Wood049 | 2K | 23.2 MB | https://ambientcg.com/a/Wood049 |
| furniture/metal | Wood051 | 1K | 6.7 MB | https://ambientcg.com/a/Wood051 |
| furniture/metal | Metal009 | 1K | 4.8 MB | https://ambientcg.com/a/Metal009 |
| furniture/metal | Metal027 | 2K | 24.9 MB | https://ambientcg.com/a/Metal027 |
| furniture/metal | Metal038 | 1K | 5.3 MB | https://ambientcg.com/a/Metal038 |
| furniture/metal | DiamondPlate009 | 1K | 9.8 MB | https://ambientcg.com/a/DiamondPlate009 |
| furniture/metal | Plastic010 | 1K | 3.5 MB | https://ambientcg.com/a/Plastic010 |
| furniture/metal | Fabric030 | 1K | 11.1 MB | https://ambientcg.com/a/Fabric030 |
| furniture/metal | Leather037 | 1K | 7.3 MB | https://ambientcg.com/a/Leather037 |
| furniture/metal | Cork003 | 1K | 7.4 MB | https://ambientcg.com/a/Cork003 |
| nature | Grass005 | 1K | 10.4 MB | https://ambientcg.com/a/Grass005 |
| nature | Snow010A | 1K | 6.6 MB | https://ambientcg.com/a/Snow010A |

素材合計: 495 MB（42 点。C02/C09 の主要面 12 点は 2K、その他は 1K）

総計: 約 654 MB