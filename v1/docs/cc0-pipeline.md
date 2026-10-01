# CC0 PBR 素材パイプライン（ambientCG / Poly Haven → public/cc0 → MaterialLibrary）

作成日: 2026-09-16。担当 A（素材パイプライン）→ 担当 M（素材のバリエーション・タイリング混合・視差・窓の遠景）が更新。
所有: `tools/build-cc0-materials.mjs`、`src/render/cc0Materials.ts`、`src/render/MaterialLibrary.ts`、`src/render/SurfaceDetail.ts`、`public/cc0/materials/**`（生成物）、本書、`docs/material-variation.md`。

ユーザー決定: **CC0 素材のみ**で写実化を進める。これまでの材質は AI 生成の 1 枚画像（`public/textures/liminal/*.jpg`）に近似の微細構造（`SurfaceDetail.ts`。計測データではない）を重ねたもの。本パイプラインは、それを ambientCG / Poly Haven の写真計測 PBR セット（Color / NormalGL / Roughness / AmbientOcclusion / Displacement）へ置き換える。

## 流れ

```
ambientCG (zip, CC0)             assets/cc0/materials/<Id>/*.jpg   ┐ tools/fetch-cc0-assets.py
Poly Haven (jpg, CC0)            assets/cc0/textures/<id>/*.jpg    ┘ + assets/cc0/manifest.json（git 管理外の原本。1.0 GB / 54 + 15 素材 + 69 モデル）
        └→ npm run build:cc0            tools/build-cc0-materials.mjs
              └→ public/cc0/materials/<Id>/*.jpg + index.json      （ゲームが読む。1024 / 512 px に縮小して 184 MB / 69 セット）
                    └→ 起動時 fetch      src/render/MaterialLibrary.ts（index.json → 対応表 CC0_VARIANTS → TextureLoader）
```

1. **取得** `python3 tools/fetch-cc0-assets.py`（標準ライブラリのみ。再実行で再開）。完了すると `assets/cc0/manifest.json` の
   `materials[<Id>].maps`（ambientCG）と `textures[<id>].maps`（Poly Haven。fetch 側で `Color / NormalGL / Roughness / AmbientOcclusion / Displacement / ARM` に正規化）
   に相対パスが入る。選定と出典は `docs/cc0-assets-plan.md`（初回 42 セット）と `docs/cc0-assets-plan-v2.md`（バリエーション用に追加した 27 セット）。
2. **ビルド** `npm run build:cc0`（= `node tools/build-cc0-materials.mjs --max 1024 --aux 512`）。
   - Node 標準モジュールのみ。manifest の `materials` と `textures` を同じ一覧にし（Id 衝突は materials 優先）、各セットの Color / NormalGL / Roughness / AmbientOcclusion / Displacement を
     `public/cc0/materials/<Id>/` へ書き出し、`public/cc0/materials/index.json` を書く。Poly Haven の元のキー名（Diffuse / diff / nor_gl / Rough / AO / disp）も受け付ける。
   - `--max <px>` / `--aux <px>`: macOS 付属の `sips` があれば Color / NormalGL を `--max` 以下、Roughness / AO / Displacement を `--aux` 以下の長辺へ縮小する（JPEG 品質 88。縮小時は拡張子も .jpg）。
     `sips` が無い環境や引数無しでは**そのままコピー**。
   - `sips` があれば Color の平均色を `avg`（"#rrggbb"）として index に書く（読込完了前の 1 px 代替色。無ければ灰）。
   - `--only Carpet004,linoleum_brown` で対象を絞る（既存の index に合流する）。`--clean` で出力を消してから書く。同じサイズ / 解像度の出力があればスキップ。
   - Color / NormalGL / Roughness が揃わない素材は index に載せない（`SKIP` 表示）。AO・Displacement は任意。
3. **参照** `MaterialLibrary` のコンストラクタが `${BASE_URL}cc0/materials/index.json` を fetch する（`src/render/cc0Materials.ts` の `CC0_INDEX_URL`）。
   `ready` は「生成テクスチャの読込 → index → **先頭候補**の CC0 セットの読込（同じ LoadingManager）→ legacy 縮小の生成」の順で解決するので、`main.ts` / `VisualReview.ts` の `await materials.ready` はそのまま動く。
   seed で選ばれる 2 番目以降の候補は**初回使用時に読む**（後述）。

`index.json` の形（パスは `public/cc0/materials/` からの相対。ambientCG / Poly Haven とも同じ形。`kind` で出典を区別できるが MaterialLibrary は区別しない）:

```json
{ "Carpet004": { "color": "Carpet004/Carpet004_2K-JPG_Color.jpg", "normal": "…_NormalGL.jpg", "roughness": "…_Roughness.jpg",
                 "ao": "…_AmbientOcclusion.jpg", "displacement": "…_Displacement.jpg", "resolution": "2K", "maxSize": 1024, "avg": "#6d6e6f",
                 "kind": "ambientcg", "source": "https://ambientcg.com/a/Carpet004", "license": "CC0-1.0" },
  "linoleum_brown": { "color": "linoleum_brown/linoleum_brown_diff_1k.jpg", "normal": "…_nor_gl_1k.jpg", "roughness": "…_rough_1k.jpg",
                 "ao": "…_ao_1k.jpg", "displacement": "…_disp_1k.jpg", "resolution": "1K", "maxSize": 1024, "avg": "#987a58",
                 "kind": "polyhaven", "source": "https://polyhaven.com/a/linoleum_brown", "license": "CC0-1.0" } }
```

## 対応表（`src/render/cc0Materials.ts` の `CC0_VARIANTS`）

`CC0_VARIANTS: Partial<Record<MatId, Cc0Variant[]>>` — MatId ごとに 1〜4 の候補（`set / meters / tint / albedo / normalScale / metalness / aoIntensity / rotate / blend / parallax`）。
`CC0_MATERIALS` は互換用で各 MatId の先頭候補（`get()` / `variant()` が使うもの）。候補の一覧・選択規則・混合と色相ずらしの式・視差の設定は **`docs/material-variation.md`**。

- `meters` = 1 タイルの実寸（Color 画像のタイル数から決めた）。ジオメトリの UV は `SURFACES.meters` 単位（`applyMetricUV` / `writeSurfaceCoordinates`）なので、材質側で
  `texture.repeat = SURFACES.meters / meters` を掛けて「1 タイル = meters m」に揃える（SURFACES と共有ファイルは変えない）。
- `tint` は線形空間の色倍率（`material.color`）。目標色（SURFACES.color。wallWhite は暖かい生成り 0xd8d4c8）÷ Color 平均色（scratchpad の `avg-color2.mjs` / `tints2.mjs`）を最大 1.4（暗いセットは 1.8〜2.2）で丸め、木・布は色相を保つよう手で寄せた。
- 木目の向き: Wood049 / Wood051 / WoodFloor051 / laminate_floor_02 / american_walnut_veneer は木目が u 方向に走る。`writeSurfaceCoordinates` は木部の木目軸を v に置くので、CC0 側で `texture.rotation = π/2`（全マップ）を掛けて合わせる（`rotate: true`）。three r186 の法線マップは `vNormalMapUv` の微分から接空間を作る（`getTangentFrame`）ため、UV を回しても法線の向きは正しい。
- CC0 対象外（従来どおり生成テクスチャ）: boxCardboard / plant / yellowLine / placeholder / signPlate / carPaint（セットが無い）、発光（light* / led / sign / windowLit / sodium / screenGlow）、ガラス（glass / carGlass / windowDark）、水（water*）、空箔（sky*）、夜景（windowNight は生成テクスチャ 'night'）、shadowDecal、untextured、void。
- 不採用: OfficeCeiling002 / 003 / 005 / 006（照明パネルや器具が Color に焼き込まれていて、部屋の照明位置と合わない）、Tiles132A（水色モザイク。プール専用の色）、dirty_tiles（暗い茶の市松。パレットから遠い）、Road007（車線が描かれている）。

## MaterialLibrary の挙動

- `createMaterial(id, o, variant, tone)` は候補の CC0 セットがあれば `map`（Color、sRGB、RepeatWrapping）/ `normalMap`（NormalGL。OpenGL 規約なのでそのまま。`normalScale` 既定 1.0）/ `roughnessMap`（Roughness そのまま。`roughness` 係数 = 1 × 部屋別倍率）/ `aoMap`（AmbientOcclusion。`channel = 0` にして `uv` を使う）を使う。`metalness` は対応表の値（既定 0。Metal009 / Metal038 のみ .9）。目地の暗線（`grid`）と生成側の `detail` は使わない。
- repeat / 回転 / albedo 有無が違う派生テクスチャは `Texture.clone()`（Source 共有。GPU 上は 1 枚）でセットごとにキャッシュする。
- **読込の分割**: 各 MatId の先頭候補（30 セット）は起動時に読み `ready` で待つ（従来どおり）。seed で選ばれる 2 番目以降の候補（残り 26 セット）は `forRoom` で初めて使われたときに読む。
  読込前・失敗時は index の `avg`（法線は平坦、粗さ 0.7、AO 白）の 1 px を入れてあるので黒くならず単色で描ける（1 hop 先の部屋は扉が開いた時点で構築されるので、通常は歩いて入る前に届く）。
- **GPU からの解放**: `forRoom(id, { roomId })` で部屋が使うセットを記録し、`releaseRoom(roomId)`（RoomBuilder.dispose）で参照の無くなった遅延セットは `evict()`（`texture.dispose()`。Image と Texture オブジェクトは保持）する。再び使われれば three が再アップロードする。先頭候補は解放しない。
  GPU 常駐は「先頭候補 30 セット + 生きている部屋が使う遅延セット」に収まる（1 セット ≈ 14 MB。1024 px Color / Normal + 512 px Roughness / AO (/ Displacement)）。
- `variant()`（wetness / colorMask / roomFog / gradient / legacy / untextured）と `onBeforeCompile` の注入（bakedLight / colorMask / roomFog / gradient / diagnostic / SurfaceAppearance の摩耗・埃・湿気）はそのまま。`legacy` / `untextured` は従来の経路（生成テクスチャの 32 px 縮小 / 無地）で、バリエーションもトーンも使わない。
  `customProgramCacheKey` の family は `cc0` / `cc0paint`、加えて `tile / notile`（2 層混合）と `pom / nopom`（視差）。プログラムが増えるのは pom の 1 族だけ（2 層混合は cc0 全体に入るので族は増えない）。
- `setTier(tier)`: 品質 Tier を uniform に入れる（high 2 / mid 1 / low 0）。2 層混合は mid 以上、視差は high のみ。切替で再コンパイルはしない。**Game.setTier からの呼び出しは担当 P に依頼中**（docs/visual-requests.md）。既定は high。
- **フォールバック**（必ず従来の生成テクスチャで動く）: index.json が無い（`npm run build:cc0` 前。Vite dev は 404 または index.html を返すので `content-type` が JSON でなければ無視）/ fetch 失敗 / JSON 不正 / 対応表のセットが index に無い（その候補だけ外れる）/ セットのいずれかの画像が読めない（`failed` にして以後の選択から外す。作成済みの材質は代替の単色のまま）/ Node 環境（`document` / `fetch` が無い）。
  状態は `materials.cc0Status`（`index: 'pending'|'loaded'|'missing'`、`sets`（対応表から参照できるセット数）、`materials`（CC0 で描ける MatId 数）、`loaded`（GPU 常駐数）、`variants`（候補総数））と `materials.usesCc0(id)` / `materials.pick(id, seed)` で確認できる（`window.game.materials.cc0Status`）。
- 読込エラーは従来どおり `LoadingManager.onError` → `materials.errors` に入り、開始画面が「一部の素材を読み込めませんでした」を出す（先頭候補のみ。遅延セットの失敗は単色フォールバック）。

## 物理的な整合

- Roughness はそのまま roughnessMap（three は G チャンネルを読む。ambientCG / Poly Haven の Roughness はグレースケール）。
- Displacement は視差（POM。`docs/material-variation.md`）に使う。`parallax` を持つ候補のセットだけ読む（14 候補 / 9 セット）。Metalness / Emission（OfficeCeiling*、Metal*）と Poly Haven の ARM は未使用。
- normalScale は 1.0 を既定にし、カーペット・布は 0.4〜0.6。
- 色: Color は sRGB として読み、`tint` は線形空間で乗算（`Color.setRGB(r,g,b, LinearSRGBColorSpace)`）。`colorScale`（濡れ）は tint にさらに掛かる。部屋トーン（色相 ±3°・明度 ±4%）はシェーダ側の 3×3 行列。

## 検証（2026-09-16、担当 M）

- `npx tsc --noEmit -p .`: 所有ファイルのエラー 0（`src/generators/decals.ts` の未使用 import は担当 D の作業中）。
- `npm run build:cc0` → `public/cc0/materials/` 69 素材（ambientCG 54 / Poly Haven 15）/ 318 ファイル / 184 MB、index.json 69 件（Color / NormalGL 1024 px、Roughness / AO / Displacement 512 px、avg 付き）。
- scratchpad `cc0/check-cc0-variants.mjs`（rolldown で束ねて `CC0_VARIANTS` と `SURFACES` を読む）: 36 MatId / 93 候補 → 56 セット（視差付き 14）。全 MatId が SURFACES に存在し CC0 対象外の種類を含まない、全セットが manifest（69 件）と index に存在、index が指すファイルが実在、格子オフセットが k/N、tint ≤ 2.2、各カテゴリ 2 種以上、seed 3000 個で候補 4 種が均等（±20%）に選ばれる。
- `tests/*.mjs` 3 本: 従来どおり通る。
- ブラウザ（`?nolock=1&new=1&seed=7`）: `cc0Status = { index: 'loaded', sets: 56, materials: 36, loaded: 30, variants: 93 }`、読込エラー 0、コンソールエラー 0。見た目の確認は `docs/material-variation.md`。

## 今後

- **KTX2 化**: `toktx` / `basisu` で ETC1S または UASTC に変換し、index.json の拡張子を `.ktx2` に、MaterialLibrary の loader を `KTX2Loader` へ切り替える。GPU メモリは 1024 px RGBA 5.6 MB → ETC1S 0.7 MB 程度。スマホ Tier では `--max 512` の別ビルドか KTX2 が必要。
- 遅延セットの先読み: 2 hop 先の部屋の palette と seed が分かれば `materials.pick(id, seed)` で候補が決まるので、`forRoom` を呼ぶ前に読込を始められる（RoomStreamingManager 側。現状は扉が開いて構築される時点）。
- OfficeCeiling002 の Emission を lightPanel に使う経路、Poly Haven の ARM（AO / Roughness / Metalness 一括）の利用。
