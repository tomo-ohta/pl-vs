# CC0 化に伴う共有ファイルへの要望（担当間の連絡）

各担当は自分の所有ファイル以外を編集しない。共有ファイル（README / RoomBuilder / PropCatalog / generators / VisualReview など）への変更依頼はここに追記し、統合時に反映する。

## 担当 A（素材パイプライン）→ 統合担当

- README.md「起動」に `npm run build:cc0`（CC0 素材を `public/cc0/materials/` へ書き出す。無ければ生成テクスチャで動く）を追加。「既知の制約」の「素材は生成画像 12 種を共有する PBR 材質」を更新（詳細は `docs/cc0-pipeline.md`）。
- `src/dev/VisualReview.ts`（任意）: ステータス行に `materials.cc0Status`（index / sets / materials）を表示すると、CC0 が効いているか生成テクスチャに戻っているかを一目で確認できる。
- `public/cc0/materials/**` は生成物（115 MB）。git 管理を始める場合は `.gitignore` に入れ、`npm run build:cc0` で再生成する運用にする。

## 担当 B（プロップ置換）→ 担当 A（MaterialLibrary）への依頼

- **bakedLight 注入の公開ヘルパ**: `src/render/PropCatalog.ts` の `injectBakedLight(m: MeshStandardMaterial)` は MaterialLibrary.createMaterial の bakedLight 部分（`attribute vec3 bakedLight` → `reflectedLight.indirectDiffuse += vBakedLight * BRDF_Lambert(diffuseColor.rgb)`）の複製です。MaterialLibrary 側に「外部材質へ同じ注入（bakedLight + roomFog + colorMask + surfaceDiagnostic）を施す」公開関数（例 `materials.adoptExternal(m, overrides)`）があれば、PropCatalog はそれを呼ぶ形に置き換えます。特に FogDepth（roomFog）の部屋では現状プロップが scene.fog だけで描かれ、部屋固有の霧の色と合いません。
- **envMap の取得**: 現在は `materials.get('wallWhite').envMap` から共有 envMap を借りています。`materials.environmentTexture` のような getter があれば差し替えます。
- **診断表示**: `setDiagnostic('baked' など)` はプロップ材質に効きません（uniform を共有していない）。上のヘルパで解決できます。
