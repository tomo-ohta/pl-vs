# 素材のバリエーション・2 層タイリング混合・部屋トーン・視差・窓の夜景（担当 M）

作成日: 2026-09-16。所有: `src/render/MaterialLibrary.ts`、`src/render/cc0Materials.ts`、`src/render/SurfaceDetail.ts`、`tools/build-cc0-materials.mjs`、本書、`docs/cc0-pipeline.md`。
CC0 素材の取得・ビルド・読込の流れは `docs/cc0-pipeline.md`。本書は「見え方をどう変えているか」。

## 1. 用途ごとの複数セットと部屋 seed による選択

`src/render/cc0Materials.ts` の `CC0_VARIANTS: Partial<Record<MatId, Cc0Variant[]>>`。MatId ごとに 1〜4 の候補（`set / meters / tint / albedo / normalScale / metalness / aoIntensity / rotate / blend / parallax`）。
36 MatId / 93 候補 / 56 セット（ambientCG 42 + Poly Haven 14。既存 42 セットに `docs/cc0-assets-plan-v2.md` の 27 セットを加えた 69 セットのうち 56 を参照）。

### 対応表

| MatId | 候補（番号: セット (実寸, 付記)） |
|---|---|
| floorCarpetGrey | 0: Fabric028 (2.4 m)<br>1: Carpet016 (1.5 m)<br>2: Carpet003 (4 m, 混合 [1, 0.375, 0.625]) |
| floorCarpetRed | 0: Carpet015 (1 m)<br>1: Carpet016 (1.5 m)<br>2: dirty_carpet (2 m) |
| floorLino | 0: linoleum_brown (2 m, 視差 0.004)<br>1: old_linoleum_flooring_01 (2.4 m, 視差 0.004, 混合 [1, 0.5, 0.25])<br>2: Tiles040 (2.4 m, 視差 0.01, 混合 [1, 0.375, 0.625])<br>3: Terrazzo005 (2 m) |
| floorConcrete | 0: Concrete048 (2 m)<br>1: concrete_floor_worn_001 (2.5 m)<br>2: Concrete034 (2 m) |
| floorTile | 0: Tiles107 (2.4 m, 視差 0.012, 混合 [1, 0.375, 0.625])<br>1: Tiles141 (2.4 m, 視差 0.012, 混合 [1, 0.5, 0.333])<br>2: floor_tiles_06 (2.4 m, 視差 0.01, 混合 [1, 0.5, 0.5])<br>3: Tiles133A (2.4 m, 視差 0.01, 混合 [1, 0.5, 0.25]) |
| floorWood | 0: WoodFloor051 (1.2 m, 回転, 視差 0.005, 混合 [1, 0.31, 0.429])<br>1: laminate_floor_02 (1.2 m, 回転, 視差 0.004, 混合 [1, 0.31, 0.375])<br>2: Wood049 (1.2 m, 回転, 混合 [1, 0.37, 0.5]) |
| floorAsphalt | 0: Asphalt031 (2 m) |
| wallBeige | 0: Wallpaper001A (1 m)<br>1: beige_wall_002 (2 m)<br>2: Wallpaper002A (1 m) |
| wallWhite | 0: PaintedPlaster017 (2 m, tint を暖かい生成り 0xd8d4c8 へ)<br>1: painted_plaster_wall (2 m)<br>2: Plaster003 (2 m) |
| wallCream | 0: Plaster001 (2 m)<br>1: beige_wall_001 (2 m)<br>2: PaintedPlaster016 (2 m) |
| wallConcrete | 0: Concrete046 (2 m)<br>1: Concrete034 (2 m)<br>2: concrete_floor_worn_001 (2.5 m) |
| wallGreen | 0: Plaster001 (2 m, 緑に補正)<br>1: painted_concrete (2 m)<br>2: PaintedPlaster016 (2 m, 緑に補正) |
| wallDark | 0: Plaster007 (2 m)<br>1: PaintedPlaster010 (2 m)<br>2: Concrete046 (2 m, 暗く) |
| wallBrick | 0: Bricks101 (1 m, 視差 0.01, 混合 [1, 0.5, 0.333]) |
| columnConcrete | 0: Concrete047A (2 m)<br>1: Concrete046 (2 m)<br>2: Concrete048 (2 m) |
| wainscotCream | 0: PaintedPlaster017 (1.2 m)<br>1: beige_wall_001 (1.5 m)<br>2: Plaster003 (1.2 m) |
| ceilingWhite | 0: OfficeCeiling001 (3.6 m = 0.6 m 格子, 視差 0.015, 混合 [1, 0.5, 0.333])<br>1: Plaster003 (2 m, 目地無し)<br>2: OfficeCeiling001 (3 m = 0.5 m 格子, 視差 0.015) |
| ceilingTile | 0: OfficeCeiling001 (3.6 m, 視差 0.015)<br>1: OfficeCeiling001 (3 m, 視差 0.015)<br>2: PaintedPlaster017 (2 m, 平天井) |
| ceilingDark | 0: Concrete034 (2 m)<br>1: Concrete046 (2 m)<br>2: concrete_floor_worn_001 (2.5 m) |
| doorWood | 0: Wood049 (1 m, 回転)<br>1: laminate_floor_02 (1.2 m, 回転)<br>2: american_walnut_veneer (1 m, 回転) |
| trim | 0: Wood049 (1 m, 回転)<br>1: american_walnut_veneer (1 m, 回転) |
| furnitureDark | 0: Wood051 (1 m, 回転)<br>1: dark_paneled_wood (1.2 m, 混合 [1, 0.5, 0.333])<br>2: american_walnut_veneer (1 m, 回転) |
| furnitureLight | 0: Wood049 (1 m, 回転, 明るく)<br>1: laminate_floor_02 (1.2 m, 回転)<br>2: american_walnut_veneer (1 m, 回転) |
| handrailWood | 0: Wood049 (1.1 m, 回転)<br>1: american_walnut_veneer (1.1 m, 回転) |
| metal | 0: Metal009 (1 m, metalness .9)<br>1: Metal038 (1 m, metalness .9) |
| doorMetal | 0: Metal027 (塗装)<br>1: PaintedMetal013 (塗装)<br>2: metal_plate (塗装, 混合 [1, 0.5, 0.5]) |
| shelfMetal | 0: Metal038 (塗装)<br>1: Metal027 (塗装)<br>2: PaintedMetal004 (塗装) |
| lockerGreen | 0: Metal027 (塗装)<br>1: PaintedMetal004 (塗装) |
| metalDark | 0: Metal027 (0.6 m, 塗装)<br>1: metal_plate (0.6 m, 塗装) |
| seatBlue | 0: Fabric030 (0.6 m)<br>1: Fabric022 (0.6 m)<br>2: Carpet012 (0.8 m) |
| upholstery | 0: Fabric030 (0.5 m)<br>1: Fabric027 (0.5 m)<br>2: Leather037 (0.8 m) |
| noticeGreen | 0: Fabric030 (0.6 m, 緑フェルト)<br>1: Cork003 (0.8 m, コルク) |
| rubber | 0: Rubber004 (0.5 m)<br>1: rubber_tiles (1 m, 混合 [1, 0.5, 0.25]) |
| grass / snow / ice | Grass005 / Snow010A / Marble012（1 種） |

木目の候補（Wood049 / Wood051 / walnut）の混合は `[1, 0.37, 0.5]`（拡縮せず位相だけ）。表に無い候補の混合は既定 `[0.61, 0.31, 0.77]`。

- **塗装（albedo false）**: doorMetal / shelfMetal / lockerGreen / metalDark は Color を使わず SURFACES.color の単色 + セットの法線・粗さ。PaintedMetal004（赤い塗装）や metal_plate（縞鋼板）も法線・粗さだけなので色は出ない。
- **不採用**: OfficeCeiling002 / 003 / 005 / 006（照明・器具が Color に焼き込み）、Tiles132A（水色モザイク）、dirty_tiles（暗い茶の市松）、Road007（車線）。天井の変化は格子寸法（0.6 / 0.5 m）と無地の漆喰・塗装で出す。
- **リノリウム**: Poly Haven の linoleum_brown / old_linoleum_flooring_01 を先頭 2 候補に、Tiles040（テラゾー。従来の代用）は第 3、Terrazzo005 は第 4。
- **tint** は `scratchpad/cc0/tints2.mjs`（目標色 ÷ Color 平均色を線形空間で。最大 1.4、暗いセットは 1.8〜2.2）。wallWhite の目標色は白すぎた 0xe2e3d8 ではなく暖かい生成り 0xd8d4c8（PaintedPlaster017 の tint [1.35, 1.28, 1.18]）。

### 選択規則（決定論）

```
avail   = CC0_VARIANTS[id] のうち index.json にあって読込に失敗していない候補の添字（順序保持）
variant = avail[ variantHash(seed, id, 'set')  % avail.length ]     （avail が空なら -1 = 生成テクスチャ）
tone    =        variantHash(seed, id, 'tone') % 5
variantHash = FNV-1a(`${seed>>>0}|${id}|${salt}`) に最終混合（xorshift-multiply）を掛けた 32 bit
```

- `seed` は `forRoom(id, ctx)` の `ctx.seed`（RoomBuilder が `node.seed` を渡す。担当 L1 の配線は 2026-09-17 時点で床・壁・天井に入っており、シム無しの `?seed=7` で材質名 `floorCarpetGrey#v1t1@r1` / `wallBeige#v0t2@r1` / `ceilingTile#v0t4@r1` を確認。doorWood / trim / metal / shelfMetal は共有材質（`variant()` / `get()`）のまま）。世界の乱数列は消費しない。
- `get(id)` / `variant(id, o)` は常に先頭候補・トーン 0（従来の見え方）。`materials.pick(id, seed)` で選ばれる番号を確認できる。
- 材質は `(MatId, 上書き, variant, tone)` で共有（LRU 上限 256。10 部屋の踏破で 150〜160 個になる）。部屋ごとに増えるのは lightMap 付きの clone だけ（`releaseRoom` で破棄）。
- seed 3000 個で 4 候補が各 25% ± 20% 以内（`scratchpad/cc0/check-cc0-variants.mjs`）。
- 候補が index に無い（取得前 / ビルド前）ときはその候補だけ外れる。全部無ければ従来の生成テクスチャ。読込中は index の平均色 1 px（法線平坦・粗さ 0.7）で描く。

## 2. 2 層タイリング混合（CC0 セットのみ）

同じマップを別スケール・別オフセットでもう 1 回サンプルし、部屋座標の低周波ノイズで混ぜる。カラー・法線・粗さ・AO の全サンプルが同じ関数を通るので、混合部でも法線と色がずれない。

```glsl
// 宣言（#include <common> の後）
vec4 liminalSample(sampler2D s, vec2 uv) {
  uv += tileUvOffset;                                   // 視差（3.）の UV オフセット。無ければ 0
  vec4 a = texture2D(s, uv);
  if (tileMixWeight > 0.001) a = mix(a, texture2D(s, uv * blend.x + blend.yz), tileMixWeight);
  return a;
}
// main、map_fragment の直前で 1 回
tileMixWeight = smoothstep(0.35, 0.65, valueNoise(vRoomPos / 4.5 + tileSeed)) * surfaceVariation * step(0.5, materialQuality);
```

- `vRoomPos` は部屋座標（`transformed`。injectCommon の varying）。値ノイズの格子 4.5 m なので 3〜6 m の斑になる。チャンク分割・箱の境目で連続。
- `tileSeed` は (variant, tone) から決まる uniform（同じ材質を共有する部屋は同じ位相。部屋の原点が違うので見えは異なる）。
- `blend = [scale, du, dv]`（`Cc0Variant.blend`）。無地の既定は `[0.61, 0.31, 0.77]`（2 層目は 1.64 倍の大きさ + 位相ずらし。周期 2 m のコンクリートと 3.3 m の 2 層目をノイズで混ぜるので、遠景で周期が揃わない）。
  目地・板・格子・煉瓦は `scale = 1` で **格子に揃うオフセット k/N**（Tiles107 8×8 → (3/8, 5/8)、OfficeCeiling001 6×6 → (1/2, 1/3)、Tiles133A 12×12 → (1/2, 1/4)、市松 floor_tiles_06 → (1/2, 1/2) で白黒の位相を保つ、板 7 列 WoodFloor051 → (0.31 自由, 3/7)、煉瓦 → (半煉瓦, 4 段)）。半端なタイルが混合部に出ない。
- 差し替えは `onBeforeCompile` の最後に、`map_fragment / roughnessmap_fragment / metalnessmap_fragment / normal_fragment_maps / aomap_fragment` を展開してから `texture2D( map | normalMap | roughnessMap | aoMap | metalnessMap ,` を正規表現で `liminalSample(` に置き換える。SurfaceAppearance（担当外。摩耗・埃・湿気・マクロ変化）が展開した map_fragment のサンプルも同じく置き換わる。
- on/off: `setSurfaceVariation(false)`（従来の V03 トグルと同じ uniform）と Tier（low で無効）。プログラム族は増えない（cc0 / cc0paint の全材質に入る。`customProgramCacheKey` の `tile`）。
- 生成テクスチャ（CC0 の無い MatId）は従来どおり（SurfaceAppearance のマクロ変化のみ）。

## 3. 部屋ごとの色相・明度ずらし（トーン）

`TONE_TABLE`（5 段。番号 = `pick().tone`）: `{0°, 0}`, `{+3°, +4%}`, `{-3°, -4%}`, `{+2°, -3%}`, `{-2°, +3%}`。

```
liminalTone = R(hue) × (1 + light)     R: 線形 RGB の灰軸まわりの回転行列（Rodrigues）
diffuseColor.rgb = max(0, liminalTone * diffuseColor.rgb)     （map_fragment の直後。colorMask / 勾配と同じ場所）
```

- 中立な tint を回しても効かないので、材質色ではなくシェーダで **map の色に** 3×3 行列を掛ける（uniform。全 textured 材質に入り、トーン 0 は単位行列）。
- CC0 の無い MatId（生成テクスチャ）にも効く。legacy / untextured は 0 固定。
- 部屋の seed が違えば同じテンプレートでも壁がわずかに暖かく / 冷たく、明るく / 暗くなる（隣室で ±3°・±4%）。

## 4. 目地の視差（POM）

`Cc0Variant.parallax`（m 相当の高さ）を持つ候補（タイル 4 / リノリウム 3 / 木床 2 / 天井格子 4 / 煉瓦 1 = 14 候補、9 セット）で、セットの Displacement（512 px）を `parallaxMap` に読む。

- 高さ（UV 単位）= `parallax / meters`（Tiles107: 0.012 / 2.4 = 0.005）。実際の目地の深さ（2〜3 mm）より誇張してある（0.005 UV で目地の奥行きが読め、0.01 UV では目地の縁が階段状になる。C11 の Tiles133A で計測: 0 → 0.00167 / 0.0033 / 0.005 / 0.01 UV で変化画素 2.2 / 5.3 / 7.1 / 9.8%）。
- `getTangentFrame(-vViewPosition, normalize(vNormal), vNormalMapUv)`（three の法線マップと同じ接空間）で視線を接空間へ。線形探索 **16 → 8 ステップ**（距離 2 → 10 m で減らす）+ 直前層との補間。`textureGrad` で LOD を固定（ループ内の微分が未定義になるのを避ける）。視線が寝るときは `z ≥ 0.3` で移動量を抑える。6〜14 m でフェードアウト（遠景の揺れ防止 + コスト）。
- 求めた `tileUvOffset` を `liminalSample` が全マップに足すので、カラー・法線・粗さ・AO・2 層目が同じ視差を受ける。
- **Tier**: `materialQuality ≥ 2`（high）のみ実行（uniform 分岐。mid は法線のみ、low は 2 層混合も無し）。`setTier` は担当 P が `Game.setTier` から呼ぶ（依頼済み）。
- プログラム族は `pom` の 1 族だけ増える（`customProgramCacheKey` の `pom / nopom`。塗装・無地は `nopom`）。

## 5. 窓の外（夜景）: `windowNight`

- `TextureId 'night'`: `createNightTexture()`（CanvasTexture 512 × 256 = **8 m × 4 m**。材質側で `repeat.x = 0.5`、`wrapS = Repeat`、`wrapT = ClampToEdge`）。
  上: 暗い青灰の空（#0a0e17 → #151b29 → 地平線 #262a36 → #3a332f の光害）、遠い街灯の橙の滲み 7 個（地平線付近、radialGradient）、建物 2 列（奥 #12161f・手前 #05070b、高さ 1.1〜2.8 m 相当）、窓 4 × 5 px を約 13% 点灯（暖色 rgba(255, 196〜236, 120〜180) 7 : 寒色 rgba(150〜190, 200〜230, 255) 3、明るさ 0.45〜1.0。約 60 個）、最下段は地面色。左右の端をまたぐ建物・窓は両側に描いてシームレス。固定シード。
- `SURFACES.windowNight = { texture: 'night', color: 0x0b0e14（diffuse は暗く）, emission: .9, emissiveColor: 0xffffff（新設。map をそのまま光らせる）, roughness: 1, meters: 4 }`。周囲より少し明るいが眩しくない（点灯窓の放射 ≈ 0.9、照明パネルは 2.3〜2.5）。
- UV は他と同じ 1 m 単位（`v = y / 4`）。窓の裏板は床から 1.0〜2.8 m の帯に置くと建物の上端と空が見える。担当 W が使う（`docs/visual-requests.md`）。
- `document` の無い Node では 1 px の暗色（tests / seam-stats で落ちない）。

## 6. ガラスの分離（V06 手順 1 の最小）

`Surface.glass: { transmission, ior, thickness, reflect }` を新設し、`s.detail === 'glass'` の決め打ち（全部 transmission .85）をやめた。透明体に金属度で反射を足す代用はしない（全て metalness 0。反射量は共有 envMap の強度 `.24 × reflect`、フレネルは PBR 側）。

| MatId | 用途 | transmission | roughness | reflect | color |
|---|---|---|---|---|---|
| glass | 通常の窓・扉ガラス | .9 | .06 | 1.6 | 0xdce8e4 |
| carGlass | 車窓（濃い色ガラス） | .45 | .10 | 2.2 | 0x2c3638 |
| windowDark | 外から見た消灯した窓 | .2 | .08 | 2.2 | 0x1a2024 |
| lightPanel 系 | 照明の拡散板 | — （MeshStandardMaterial + 'diffuser' テクスチャ + emission。透過しない） | | | |

`physical = !!s.glass || id === 'carPaint'`（MeshPhysicalMaterial）。透過の再描画パスは従来どおり。曇りガラス・部屋別 envMap（V06 手順 2〜4）は未対応。

## 7. Tier 別

| | low (0) | mid (1) | high (2) |
|---|---|---|---|
| CC0 セット・バリエーション・トーン | ○ | ○ | ○ |
| 2 層タイリング混合 | × | ○ | ○ |
| 目地の視差（POM） | × | ×（法線のみ） | ○（8〜16 ステップ、6〜14 m でフェード） |

`materials.setTier(tier)`（uniform のみ。再コンパイル無し）。未配線の間は high。

## 8. V02 / V06 との対応

- V02（素材一式）: 実測スキャン化（任意扱いだった）を CC0 セットで実施。`albedo / normal / roughness / ao / (displacement) / metalness / meters / uvOrientation(rotate) / tint` の分離（手順 1）、非金属の金属度 0（手順 5）、粗さは実測マップ（手順 6・8）、sRGB / NoColorSpace / AO は uv0（手順 7）。
- V06 手順 1（通常ガラス・車窓・拡散板の別定義、金属度での代用廃止）: 本書 6. 曇りガラスは未定義。手順 2〜5（clearcoat 比較・部屋別 CubeCamera・キャッシュ・水面）は未対応。

## 9. 検証（2026-09-16）

- `npx tsc --noEmit -p .`: 所有ファイルのエラー 0。`node tools/build-cc0-materials.mjs --max 1024 --aux 512`: 69 セット / 318 ファイル / 184 MB、index に `avg` 付き。
- `scratchpad/cc0/check-cc0-variants.mjs`: 対応表 ↔ manifest ↔ index の整合、格子オフセット、tint 上限、カテゴリごと 2 種以上、選択の決定論と分布。`tests/*.mjs` 3 本は従来どおり。
- ブラウザ（検証の前半は RoomBuilder が `forRoom` を呼ぶ前だったので、`builder.build` 中の `variant()` を `forRoom(node.seed)` へ流すシムをページ内で当てた。後半は担当 L1 の配線が入り、シム無しでも同じ選択になることを材質名で確認）:
  - `?nolock=1&new=1&seed=7` C02: 床 Carpet016（灰に補正）/ 壁 Wallpaper001A トーン 2 / 扉 laminate_floor_02 / 天井 OfficeCeiling001 トーン 4。`seed=11` C02: 扉 american_walnut_veneer、天井トーン 0、壁トーン 2（床・壁のセットは偶然同じ）。壁・床の近接（0.6 m）で継ぎ目・半端なタイル無し。
  - `force=C09`: 床 old_linoleum_flooring_01（格子混合 + 視差）/ 壁 Plaster003 / トーン 4。`force=C06`（駐車場）: 床 Concrete034 / 壁 concrete_floor_worn_001 / 天井 concrete_floor_worn_001（暗）/ 扉 metal_plate（塗装）。遠景の床に周期は見えない。
  - `cc0Status`: index loaded、sets 56、materials 36、variants 93、loaded 30（起動時。先頭候補 26 + 隣室の遅延セット）→ 38〜44（10 部屋を踏破後）。読込エラー 0、コンソールエラー 0。
  - 3 seed（7 / 11 / 23）× 10 部屋のテレポート踏破（C02 C06 ADAPTER U12 C07 C08 C12 C17 C03 / C02 C12 C13 U10 C09 C16 C20 U07 U16 / C02 C14 U10 U05 U01 C06 C15 ADAPTER）: `ERROR` ログ 0、`WARN` 0、例外 0。共有 variant 157〜160 個（→ LRU 上限を 256 に）。
  - 夜景: 現在の部屋の正面 3 m に `windowNight` の裏板（4 × 2.5 m）+ `glass` を置いて確認。暗い青灰の空・黒い建物・暖色 / 寒色の窓明かり・地平線の橙の滲みが透過越しに見え、照明パネルより暗い。
  - プログラム族: `cc0/nopom`・`cc0paint/nopom`・`authored`・`external` に加えて **`cc0/pom` が 2 プログラム**（AO 有無で 2 通り。C11 で 10 部屋分の材質が生きている状態でも 2）。2 層混合とトーンは族を増やさない。
  - 視差の Tier 切替: C11 の Tiles133A 床（カメラ高 1.6 m、俯角 24°）で high → mid（`setTier('mid')`）にすると 6.3% の画素が変化し、`parallaxHeight = 0` にした場合と一致（POM が uniform で止まる）。0.02 UV では 10.6%。
- GPU メモリ（画像の実寸から見積り。ミップ込み ×1.333。1 セット ≈ 9〜15 MB = 1024² Color + Normal (5.6 MB × 2) + 512² Roughness / AO / Displacement (1.4 MB × 1〜3)）: 先頭候補 26 セット（従来と同数。linoleum_brown ほかに入れ替え）、10 部屋踏破後の常駐 42 セット ≈ **380 MB**（従来 26 セットで約 360 MB → +20〜60 MB。目標の +150 MB 以内）。遅延セットは生きている部屋の分だけ常駐し、部屋の dispose で解放。

## 10. 未対応・注意

- `Game.setTier → materials.setTier`（担当 P）が入るまで Tier は high 相当（mid / low でも視差・2 層混合が有効）。RoomBuilder の `forRoom` 配線は床・壁・天井に入った（扉・巾木・金属は共有材質のまま。seed で変えるなら L1 側で `forRoom` に）。
- 遅延セットは扉が開いて隣室が構築される時点で読み始める。低速回線では入室直後に平均色の単色 → 数百 ms で実測素材に変わる（黒くはならない）。先読みは `docs/visual-requests.md` 4 に提案。
- 2 層混合は SurfaceAppearance のマクロ変化（色の位相ずらし）と重ねて掛かる（wall* / floorCarpet* / floorConcrete / columnConcrete）。染みの強い Plaster001（wallCream 0）では斑が目立つことがある → 候補 1・2（beige_wall_001 / PaintedPlaster016）で緩和。必要なら Plaster001 に `blend: false`。
- POM は自己遮蔽（影）無し。両面材質・legacy・生成テクスチャでは無効。DOUBLE_SIDED の裏面は法線を反転して扱う。
- 天井の器具入りセット（OfficeCeiling002/003/005/006）は Emission / マスクを作れば照明パネルの見た目に使える（未着手）。
- KTX2（GPU メモリ 1/8）は未着手（`docs/cc0-pipeline.md` 今後）。

## 11. V06 手順 2〜5: 部屋別 envMap・艶床の clearcoat・床だけの濡れ・水面の透過（担当 P2、2026-09-21）

所有: `src/render/MaterialLibrary.ts`（`roomEnvironment` / `bakeRoomEnvironment` / `roomEnvKey` / `ROOM_ENV_SIZE`、`GlossSpec` / `WaterSpec`、`isFloorMat` / `resolveOverrides`）、
`src/generators/layout.ts`（`RenderOverrides.floorWetness`）、`src/generators/dressing/epic.ts`（`setFloorWetness`。E01 / E07 / E09）。RoomBuilder は `forRoom` に `palette` / `height` を渡す 1 箇所と `overridesFor` の `floorWetness` 1 行だけ。

### 11.1 部屋別 envMap（手順 3〜4）

- `forRoom(id, { …, palette, height })` が `roomEnvironment(roomId, palette, height)` を呼び、返ったテクスチャをその部屋の材質 clone の `envMap` にする（lightMap 付き clone はそのまま、lightMap 無しでも palette があれば `cloneShared` で部屋専用 clone）。共有 variant（扉・枠・小箱・水面・`variant()` 経由）と glTF（`adoptExternal`）は共有の RoomEnvironment のまま。
- 焼き方（`bakeRoomEnvironment`）: CubeCamera でシーンを描くのではなく、**パレットの色で塗った箱部屋を JS で解析的にキューブマップへ書く**（6 面 × 128² HalfFloat。目の高さ 1.6 m、天井 = `layout.height`、壁 4 m 先。床 = `SURFACES[palette.floor].color` × 器具色 × 0.5、壁 = 壁色 × 0.6〜0.9 の縦勾配、天井 = 天井色 × 0.7 + 器具色 × 6 の 0.6 × 1.2 m 面が 4 m 格子（(±2, ±2) の 4 灯）+ 弱い滲み、環境色 `palette.ambient` × 0.1〜0.15 を加算）→ `PMREMGenerator.fromCubemap`。未ロード部屋・自身・再帰の映り込みは構造上起きない。
- 費用: JS 1〜2 ms + PMREM 十数 draw で **1 枚 3.3〜3.6 ms**（`envStats.ms`。初回は cubemap 変換シェーダのコンパイルで 30〜40 ms かかっていたので `configure` で `compileCubemapShader()` を先に呼ぶ）。GPU メモリは PMREM 384 × 512 HalfFloat ≈ 1.5 MB / 枚。
- キャッシュ: `roomEnvKey` = 床 / 壁 / 天井の MatId + 器具色・環境色を各チャンネル 5 段階 + 高さ 0.5 m 刻み。LRU **8 枚**、ただし参照中（`rooms` が空でない）のものは捨てない。`releaseRoom` で参照を外す。10 部屋の踏破で built 6〜7 / hits 50〜60。
- **重要（プログラム数）**: three は PMREM の高さ（`envMapCubeUVHeight`）をプログラムキーに入れるので、共有 envMap と部屋別 envMap は同じ立方体サイズで焼く必要がある。共有 RoomEnvironment も `fromScene(room, .06, .1, 100, { size: ROOM_ENV_SIZE = 128 })`（旧 256）にした。envMap の差替えでプログラムは増えない（確認: envMap を差した lightMap clone と共有 variant のプログラム数は同じ）。
- low Tier（`materialQuality = 0`）/ legacy / untextured / `flat` / envMap を持たない材質は null（共有のまま）。

### 11.2 艶床の clearcoat（手順 2）

- `Surface.gloss: { clearcoat, roughness }` を床材に付ける（`MeshPhysicalMaterial` になる。全材質は Physical にしない）: floorLino .35 / .25、floorTile .45 / .2、floorWood .3 / .3、marbleFloor .6 / .15、marbleWhite .4 / .2。
- 濡れ（`roughnessScale` から `wetnessOf` で逆算）で `clearcoat += .35 × wet`、`clearcoatRoughness × (1 − .5 × wet)`。
- プログラム族: `customProgramCacheKey` の末尾に `-gloss` / `-water` / `-water-depth` / `-glass` / `-coat`（three 側のキーでも clearcoat / transmission の有無で分かれる）。床は同じ CC0 族の壁とプログラムを共有していたので、gloss 床の分だけ族が増える（C05 で 68 → 77。R01 は 87 → 同数程度）。

### 11.3 床だけの濡れ `floorWetness`（手順 2 の補助。E01 / E07 / E09）

- `RenderOverrides.floorWetness`（0..1）→ `MaterialOverrides.floorWetness` → `resolveOverrides(id, o)` が **床材（`isFloorMat`: `floor*` と marbleFloor）にだけ** `wetnessOverrides` を畳む（既存の `wetness` と強い方）。床以外はキーから消えるので共有 variant のまま（E01 で確認: 床 `floorCarpetGrey|r0.8|c0.95|e1.75#…`、壁 `wallCream#v1t1`、天井 `ceilingWhite#v1t0`）。
- epic.ts の E01 .25 / E07 .18 / E09 .3 を `setFloorWetness` に切替。E06 .6 / E08 .35 / E11 .25 / E19 .3 は全材質の `wetness` のまま（意図が壁を含むか未確認なので触っていない）。

### 11.4 水面（手順 5: R01 / R14 / E09）

- `Surface.water: WaterSpec` で `MeshPhysicalMaterial`: transmission（水面 .9 / 浅水 .88 / 水壁 .85）、ior 1.33、roughness .05〜.08、`attenuationColor` / `attenuationDistance`（水 0x3f8a80 / 1.2 m、浅水 0x5aa39a / 1.0 m、水壁 0x2f7a74 / 0.6 m）、反射は envMapIntensity × reflect（1.4〜1.8）でフレネルは PBR 側。金属度 0、opacity 1、depthWrite false、水平の水面は FrontSide（箱の底面が二重に描かれない）、水壁は DoubleSide。
- 水深: `depthFromFloor` の材質は onBeforeCompile で three の `transmission_fragment` を展開し、`material.thickness = thickness × clamp(vRoomPos.y, 0.003, 4)`（部屋座標の y = 床 0 からの高さ = 水深）、`material.transmission = mix(1, transmission, smoothstep(0, .3, vRoomPos.y))`（岸際 = 透明）に置き換える。ShallowWater の水面 y = depth（R01 .25 / R14 .3 / L02 .5）、WaterWall の濡れ箔 y = .008、床の水たまりデカール y = .004 はほぼ透明な反射面になる。
- 透過光に掛かる拡散色（水色 × 波紋 map）は `albedoMix`（.5〜.65）だけ効かせる（`material.diffuseContribution = mix(1, diffuseContribution, albedoMix)`）。そのままだと床が波紋の模様に埋もれて不透明に見えた。
- 調整の経緯: 仕様の transmission .5〜.7 では (1 − transmission) の拡散が乳白色の膜になり床が見えなかった（R14 で確認）。.88〜.92 + 減衰色で「床が見え、深いほど青緑、遠くは天井を映す」になる。白飛びは envMapIntensity（wetness の e1.75 が掛かる）を reflect 1.4〜1.8 に下げて解消。
- 費用: three の透過は不透明物を transmission RT にもう 1 回描く（`transmissionResolutionScale` 1.0）。ガラス（窓・扉）が見える部屋では既に払っているコスト。水だけの部屋（R14）では GPU 中央値 13.8 ms（変更後）vs 19.8 ms（変更前。別タブと同時計測のため参考値）。
- 既知: 水壁（DoubleSide）は three が透過パスで裏面を RT に描く（`renderTransmissionPass`）ので、裏側から見ると 2 重の減衰になる。水中の物（柱の根元）は減衰と波紋で見えにくい。

### 11.5 夜景の位相（`docs/night-parallax.md` 残課題）

- `windowNight` は共有 variant（ライトマップ対象外）なので uniform ではなく、頂点で `vNightPhase = hash(floor(modelMatrix[3].xz × 0.5))`（部屋グループの world 位置を 2 m 格子に丸めたハッシュ）を出し、遠景の u に `+phase`、近景の u に `+1.7 × phase` を足す。隣室の窓は別の街並みになる（C01 で変更前と配置が変わることを確認）。同じ部屋の窓は同じ位相（連続した街並み）。

### 11.6 確認（2026-09-21、seed 7、Tier high、変更前は HEAD の worktree を 5174 で並走）

- `npx tsc --noEmit -p .` 0（他担当の DoorLeak.ts の未使用変数は別）。`node tools/seam-stats.mjs --seeds 3 --rooms 40` deterministic true。
- R01: 近くの水は床タイルが透けて青緑、遠くは天井を映す灰。R14: 木床が透け、柱の根元が見える。E09: 水壁は青緑の波紋越しに隣室が見える。E01: 床だけ艶、壁は共有 variant。C05: リノリウムに器具の映り込みの筋。C01 / M18: 夜景の位相が変わり、雨（Points）は夜景の手前に重なる。
- 部屋別 envMap: `envStats` built 6〜7 / hits 52〜57 / 1 枚 3.3〜3.6 ms。プログラム数は envMap の差替えで増えない。
- 残: 器具の実位置を反映しない（4 m 格子の代表）。CubeCamera 版（実シーン）は費用対効果を見て未採用。water の `map`（波紋）は生成テクスチャのままで法線の波は弱い。

### 11.7 器具の発光面を palette.lightColor に追従（P1 依頼、2026-09-21）

- `MaterialOverrides.lightTint`（sRGB hex）。RoomBuilder の `overridesFor` が `layout.palette.lightColor` を入れ、`resolveOverrides` が **器具材質（`isFixtureMat`: lightPanel / lightWarm / lightTube* / lightGreen / lightYellow で emission 付き）だけ**に残す（サイン・画面・空箔・ネオン・街灯・他の材質はキーから落ちて共有材質のまま）。
- `createMaterial` で `emissive = 材質の発光色 × normalizedTint(lightColor)`（最大チャンネル 1 に正規化した線形色。明るさは変えない）。legacy は対象外。キーは `t` + 1/16 刻みの 3 桁 hex（白 'fff' は落とす）。
- 確認: R01（lightColor 0xfff2e4）で `lightWarm|tfdc` emissive #ffc789（変更前 #ffd29a）。器具材質の variant が部屋の色温度ごとに 1 つ増える（LRU 256 の範囲）。
