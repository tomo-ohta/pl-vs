# 写実化第 2 段（照明・素材・デカール・破れ）の担当間連絡

各担当は所有ファイル以外を編集しない。共有ファイルへの変更依頼はここに追記（append）し、統合時に反映する。
担当: L1 = ライトマップ・焼き込み（SurfaceGeometry / RoomBuilder / Lightmap*）、P = ポスト処理・トーンマップ・影（PostFX / Game / Settings / LightBudget / RoomStreamingManager / types）、M = 素材バリエーション（MaterialLibrary / cc0Materials / SurfaceDetail / build-cc0-materials）、D = デカール（DecalLayer / DecalAtlas / generators/decals）、W = 破れ・窓・プリセット（generators/wear / wearEffects / CorridorGenerator / RoomGenerator / furniture / presets）。

## P → L1（RoomBuilder / Lightmap）: 影の受け渡し（2026-09-16）

- `renderer.shadowMap.enabled = true`（PCFSoft）を有効にし、可視 PointLight のうちプレイヤーに近い **1 灯（mid）/ 2 灯（high）** だけ `castShadow = true` になる（`RoomStreamingManager.updateLights` の影スロット。mapSize 1024 / 512、near 0.3、far = light.distance、bias −0.004 / normalBias 0.04、ヒステリシス + `shadow.intensity` のフェードで受け渡し）。**Mesh 側の `castShadow` / `receiveShadow` は RoomBuilder で立ててほしい。** 立っていない間は影が出ない（P の検証では一時的に `scene.traverse` で立てた）。
  - 推奨: 殻（床・壁・天井の結合メッシュ）は `receiveShadow = true` のみ、家具・柱・扉パネル・プロップ（InstancedMesh 含む）は `castShadow = receiveShadow = true`。殻を caster にすると PointLight のキューブ影（6 面）で描画回数が増えるだけで見た目の利得が小さい。
  - **器具の筐体（発光材質 lightPanel / lightWarm など）は `castShadow = false` に**。PointLight は器具の内側や直下に置かれるので、筐体が caster だと全方向が遮蔽されて部屋全体が真っ暗になる。光源が筐体の箱の内部にある場合は光源位置を筐体の下面より 5 cm 以上下げるか、筐体を caster から外す。
  - 三角形の多い部屋（C06 駐車場 466 draw calls）では影パスが 6 面 × 2 灯ぶん増える。近傍 15 m 以内だけ caster にする等の間引きが必要なら P 側で light.distance を使ったカリングを検討する。
- 影マップの GPU メモリ（キューブ深度 1024²×6 = 24 MB / 灯）は `RoomStreamingManager` が部屋の破棄・スロット解放時に `light.shadow.map.dispose()` する。`RoomBuilder.dispose` 側では触らなくてよい。

## P → M（MaterialLibrary）: 部屋別 fog（roomFog）の色空間（2026-09-16・優先）

- EffectComposer（RenderPass → GTAO → bloom → OutputPass）を導入した。RenderTarget へ描く間、three.js は材質側のトーンマップと sRGB 変換を無効化し、`scene.fog` の色も **線形**（working color space）で uniform に入れる（`getUnlitUniformColorSpace`）。
- `MaterialLibrary.variant` / `adoptExternal` の roomFog は色を **sRGB 固定**（`getRGB(fogColor, SRGBColorSpace)`）で `fog_fragment` の後に混ぜているため、composer 使用時（mid / high）は sRGB 値が線形として扱われ、霧が設計より大きく明るく浮く（例: 0x262a28 → 表示で #73 前後。scene.background の同じ色は #1f 前後）。
- **依頼:** uniform は線形（`new THREE.Color(fogSpec.color)` のまま。sRGB 変換をしない）で入れ、シェーダ側で `linearToOutputTexel(vec4(roomFogColor, 1.0)).rgb` を混ぜる（`colorspace_pars_fragment` の関数。画面描画では sRGB 符号化、RT 描画では恒等になるので、直接描画 / composer のどちらでも `scene.fog` と同じ扱いになる）。
- 暫定: `RoomStreamingManager.syncFogMaterial` が `renderer.properties.get(material).uniforms.roomFogColor.value` を composer 使用時だけ sRGB → 線形に変換する shim を入れている（`fogColorSpace`）。上記を反映したら **shim を削除する**（残すと二重変換になる）。連絡してほしい。
- 参考: composer 使用時は `toneMapped: false` の材質（SignAtlas の板サイン、FakeSignage）も OutputPass でトーンマップされる（AgX で白 1.0 → 約 0.8）。板サインの自己発光をやや上げる余地あり。

## 担当 M（素材バリエーション）からの依頼（2026-09-16）

1. **担当 P（Game.ts）**: `Game.setTier(id)` の中で `this.materials.setTier(this.tier)` を呼んでください（`builder.setTier` / `audio.setTier` と並べて）。
   MaterialLibrary 側は uniform（high 2 / mid 1 / low 0）を切り替えるだけで再コンパイルしません。high: 目地の視差（POM 8〜16 ステップ）+ 2 層タイリング混合、mid: 2 層混合のみ、low: どちらも無し。
   未配線の間は既定の high で動きます（mid / low 端末でも視差が入る）。
2. **担当 L1（RoomBuilder.ts）**: `materialFor` の `forRoom(mat, { roomId, seed: node.seed, overrides, lightMap })` 化は確認しました（`?seed=7` で `floorCarpetGrey#v1t1@r1` 等）。`doorMaterialFor`（doorWood / doorMetal）・trim・metal・shelfMetal は共有材質のままなので、扉や巾木も部屋ごとに変えるなら同じく `forRoom` に切り替えてください（seed 無しなら先頭候補・トーン 0 = 従来の見え方）。
   `seed` から CC0 セットのバリエーション（`CC0_VARIANTS[mat]` の候補）と色相・明度のトーン（5 段）を決定論的に選びます。`variant()` のままだと常に先頭候補（従来の見え方）です。
   `RoomBuilder.dispose` → `materials.releaseRoom(roomId)` は既に入っているので、そのままで遅延セットの GPU 解放が働きます。
   `materials.pick(mat, seed)` で選ばれる番号を確認できます（`{ variant, tone }`）。lightMap 付き clone のキーは `(MatId, 上書き, バリエーション, トーン, lightMap.uuid)` です。
3. **担当 W（窓）**: `windowNight` は 8 m × 4 m の生成テクスチャ（空〜建物のシルエット・窓明かり）を白い emissive（.9）で薄く光らせる材質になりました。
   UV は他の材質と同じ 1 m 単位（SURFACES.meters = 4。テクスチャ側で repeat.x = .5）なので、窓の裏板の箔は **床から y = 1.0〜2.8 m の帯**に置くと建物の上端と空が見えます（v = y / 4。v ≥ 1 は空の上端色、v ≤ 0 は地面色に固定）。
   裏板の手前に `glass`（透過 .9 + 弱い反射）を置く構成で、透過越しに夜景が見えます（transmission の再描画パスは従来どおり 1 回）。
4. **任意（担当 P: RoomStreamingManager）**: 2 hop 先の部屋の palette と seed が分かる時点で `materials.pick(mat, seed)` → 候補が決まるので、`materials.forRoom(mat, { roomId, seed })` を一度呼んでおくとその部屋の遅延セットの読込が先に始まります（現状は扉が開いて構築される時点で読み始める。ローカルでは十分間に合う）。

## 担当 W（破れ・窓・プリセット）→ 各担当への要望（2026-09-16）

実装の記録は `docs/wear.md`。以下は所有外のファイルへの依頼。

- **担当 M（MaterialLibrary / cc0Materials）**
  - `windowNight` のテクスチャは現在 1 種（都市の窓明かり）。箔は壁の外面側（室内面から約 13 cm 奥、ガラスから約 9 cm）に置き、寸法は 学校 = 高さ 1.0 m（y 1.2〜2.2）× 壁区間の長さ（最長 25 m）/ マンション = 高さ 1.43 m（1.15〜2.58）/ 食堂 = 高さ 1.4 m（1.0〜2.4）。
    UV は位置基準（`meters` 周期）なので、地平線（暗い運動場 / 街の屋根の線）を y ≈ 1.4〜1.6 m に置きたい場合は `meters` を 4 の倍数のままにして v のオフセットを材質側で調整してほしい。可能なら学校（暗い運動場と遠くの街灯 = 明かりが少なく低い）・食堂（駐車場の街灯 = 橙の点）・マンション（夜の街 = 現状）の 3 variant（`SURFACES` の色替えでも可）。
  - `wallCream`（Plaster001）の斑が強く、オフィス廊下では「ベージュ無地」に見えなかった（wallBeige に変更済み）。病院外来廊下（wallCream）と学校（wallCream）に残るので、斑を弱める（PaintedPlaster017 系に生成りの tint）と参考画像に近づく。
  - 病院の腰壁 `wainscotCream`（PaintedPlaster017 tint .92/.9/.82）と壁 `wallCream` の明度差が小さい。腰壁の tint を 10〜15% 落としてほしい。
  - 破れの「黄ばんだ天井板」は `wainscotCream`、「黒い穴」は `void`、「切れかけの管」は `lightYellow` を流用している。`lightYellow` の色（0xf6e6a0）を少し灰色寄り（古い管の色）にするか、専用の MatId（`lightAged`）を layout.ts に足せると LightingPhase の黄相と区別できる。
- **担当 L1（RoomBuilder / ArchitecturalDetails / SurfaceGeometry）**
  - 倉庫の段板ピッチ `Math.max(.9, h / 3)`（ArchitecturalDetails）を `h / 4` にすると 4.2 m の棚でも 4 段になる。今回は棚の高さを 3.3 m にして 1.1 m ピッチ（段板 4 枚）にした。`rack()`（furniture.ts）の式も同じ値を参照しているので、変える場合は両方。
  - `SignSpec` に面内回転（`roll?: number`、度）があれば「傾いた案内板」（wear.signTilt）をレイアウト側で完結できる。現在は `wearEffects` が RoomBuilder 後に `mesh.rotateZ` している。
  - 天井板の欠落（wear.ceilingMissing）は天井直下の黒い箔。`buildShell` の `ceilingHoles` に小穴（0.6 m 角、非ソケット）を渡せる経路があれば本物の穴（天井裏の暗さ + 側面）にできる（footprint.ts は担当外）。
  - 窓の開口は `buildShell` に擬似ソケット（`type: 'door'`、`sill`）を渡して壁を抜いている（`L.sockets` には入れない）。ShellOptions に `windows?: Opening[]` のような明示的な引数があるとよい。
- **担当 P（Game / LightBudget）**
  - `wearEffects` の明滅は PointLight の `userData.baseIntensity` を揺らし、暗くなる方向だけ `intensity` を即時に下げる（予算のフェードアウトを妨げないため）。LightBudget に「即時反映してよいライト」の印（`userData.flicker = true` で alpha を 1 に）があれば、明るくなる方向も鋭くできる。
- **担当 D（decals）**
  - 破れの計画は `wearOf(L)`（`src/generators/wear.ts`）で読める。`ceilingStain`（板全体の黄ばみ 0.6 m 角）と `ceilingMissing` の位置 `wear.pos` の周囲 1 m には天井のシミデカールを重ねないほうが自然。

## P → M（MaterialLibrary / cc0Materials）: GL_INVALID_VALUE の発生源（2026-09-17）

- seed 7 の 10 部屋踏破（C02 C06 ADAPTER C17 C16 C16 C09 U07 R10 U03 C19）で `gl.getError()` が `INVALID_VALUE (1281)` を 4 部屋分返した。全 gl 呼び出しを計装した結果、発生源は three.js の `WebGLTextures.uploadTexture → texSubImage2D(TEXTURE_2D, 0, 0, 0, RGBA, UNSIGNED_BYTE, HTMLImageElement 1024×1024 / 512×512)`（6 件すべて）。既に `texStorage2D` で確保済みのテクスチャに、寸法の違う画像を `texture.image` に差し替えて `needsUpdate` した場合に起きる（例: 512 の仮画像 → 1024 の本画像、または cc0 セットの遅延読み込みで同じ Texture を再利用）。描画は続くが、その画像は更新されない可能性がある。
- 対処案: 画像の差し替え時は `texture.dispose()` してから新しい Texture を作る（または寸法が変わらないよう最初から最終寸法で確保する）。P の composer / 影 / Tier 切替 / newWorld を計装した再現では GL エラー 0 件。
- **担当 P（PostFX）追記**: 天井の欠けた板（黒い箔、`void` を金属 1.0 + 黒にして鏡面反射も 0）が `postfx: 'clean'`（GTAO + bloom + MSAA）では 110/255 の灰色に浮き、`'off'` では 23/255。露出過多のトロファー（emission 2.5）からの bloom（threshold 1.1 / strength 0.22 / radius 0.35）の滲みが原因（seed 9 の開始部屋 r1 で計測）。閾値を上げるか radius を小さくすると、黒い穴・窓の夜景・暗い器具（lightOff）のコントラストが戻る。こちらは穴の位置を器具から少なくとも一方の軸で 0.7 m 離す規則で軽減した（0.8 m 離れた例でも 111/255 のまま）。

## D（デカール）から

- 情報共有（L1 / ArchitecturalDetails）: デカール層は自動の巾木（高さ 0.015〜0.125 m、出 0.018 m）と廻り縁（上端 0.055 m、出 0.009 m）の寸法を `src/generators/decals.ts` の定数（SKIRT_TOP / SKIRT_OUT / CROWN_H / CROWN_OUT）として見込み、壁際の帯と設備をその外側に浮かせている。ArchitecturalDetails の寸法や適用条件（wall* 材質の外壁）を変えるときは D に連絡してほしい。
- 依頼（W / Generator）: 壁付きの消火器を置くときは箱に `kind: 'extinguisher'` を付けてほしい。デカール層がその真上に「消火器」札を貼る（無い部屋は扉脇に置く）。ベンチ・連結椅子は `kind: 'chair' | 'sofa'` または材質 seatBlue / upholstery を維持してほしい（背もたれ上のこすれの判定に使う）。
- 情報共有（W / SurfaceAppearance）: デカール層は C02 の単一矩形の長辺では壁際の埃を出さず、CorridorOffice では床の擦れを出さない（材質側の C02 埃・歩行帯と二重にしない）。材質側の埃・歩行帯を他テンプレートへ広げる場合は `PROFILES`（decals.ts）の該当項目を 0 にする必要があるので連絡してほしい。
- 依頼なし（P / Tier）: `tier.decals=false`（low）では汚れ系だけを省き、設備・誘導灯・貼り紙は全 Tier で描く。三角形は部屋あたり最大 +1,462、構築時間 0.7〜4.8 ms。

## L1（ライトマップ・焼き込み）からの依頼（2026-09-17）

前提: 焼き込みの照度は `docs/lighting-lightmap.md` の「露出の前提」に合わせて決めた（器具直下の床 ≈ 0.95、器具の間 ≈ 0.42、突き当たり ≈ 0.05）。
現状の画面は焼き込み以外の一様な光が強く、ライトマップの勾配（器具直下の明るさ、器具の間・突き当たりの沈み、隅の AO、天井の滲み）が
ほとんど見えない。検証は `game.scene` の半球光 0.06 / `toneMappingExposure` 1.0 / 全材質 `envMapIntensity` 0 / 動的光 ×1 で行った
（`docs/lighting-lightmap.md` の「検証」）。

- **担当 M（MaterialLibrary）**: envMap（RoomEnvironment、`envMapIntensity .24`）の**拡散成分（IBL irradiance）を 0〜0.05 に**。
  `getIBLIrradiance` が全面に一様な照度（焼き込みの環境光の約 2 倍）を足していて、これが「全体が明るく均一」の最大要因。鏡面（`iblRadiance`）は残してよい。
  実装案: `onBeforeCompile` で `#include <lights_fragment_maps>` の直後に `iblIrradiance *= iblDiffuseScale;`（uniform、既定 1.0）を挿し、
  RoomBuilder から `forRoom(id, { ..., iblDiffuseScale: 0 })` のように部屋単位で渡せると、ライトマップの無い low Tier では従来どおりにできる。
  暫定なら `envMapIntensity` を .24 → .06 に下げるだけでも効く（鏡面も弱くなる）。
- **担当 M**: 動的 PointLight の拡散成分を落とす `directDiffuseScale`（uniform、既定 1.0。`#include <lights_fragment_end>` の直後に
  `reflectedLight.directDiffuse *= directDiffuseScale;`）。直接光の拡散は焼き込みが持つので、動的光は床の鏡面反射（器具の映り込み）だけを
  担わせたい。これが入れば RoomBuilder の `DYNAMIC_LIGHT_SCALE`（暫定 1.5。従来 5）を 3〜5 に戻し、鏡面を強くできる。
- **担当 P（Game / PostFX）**: `HemisphereLight` 0.32 → **0.06 程度**（palette.ambient に比例させるなら 0.2 倍）。半球光も一様な照度で、
  焼き込みの突き当たりの沈みを埋めてしまう。`toneMappingExposure` は 1.25 → 1.0（焼き込みの値はこれを前提に決めた）。
- **担当 P**: GTAO は隅の二重の暗さになりやすい（ライトマップに 24 本の半球レイ AO が入っている）。ライトマップ有り（high / mid）では
  GTAO の強度を半分程度に、または近距離（< 0.5 m）の接触成分だけに絞ってほしい。シャドウマップの光は「最寄りの器具の PointLight」で、
  外殻・家具の Mesh には `castShadow` / `receiveShadow` を設定済み（InstancedMesh / プロップ / デカール / 発光箔は受影のみ）。
- **担当 W（任意）**: 器具のピッチ（廊下 3.0〜3.6 m）では床の「器具直下 : 器具の間」は物理的に 1 : 0.45（線形）より暗くならない。
  参考写真の暗さ（1 : 0.45 表示値）に寄せるなら、テンプレートによってピッチ 4.5〜5.4 m か消灯率（`dim`）を上げる選択肢がある。

## R（Rare 部屋別ドレッシング `src/generators/dressing/rare.ts`）→ 各担当への要望（2026-09-17）

- **PropRepetition（storageDoor）/ DuplicateNumber の担当（R20）**: ドレッシングは Modifier より前に走るので、R20 の赤いシャッターは Modifier が後で置く doorMetal の扉板（面から 0.02〜0.07）・枡（0〜0.08）・横筋（〜0.095）・番号（≈0.082）の手前 0.10〜0.116 に `redShutter` のソリッド箔を重ねて隠している（`removeFills` がブロック 0.15 m 以内の非ソリッド箔を捨てるためソリッド）。取手（0.07〜0.13）だけが手前に出る。位置は同じ規則（pitch max(1.2, 2.4/density)、幅 min(pitch−0.2, 2.3)、中央寄せ）で再計算している。
  依頼: `PropRepetition` の storageDoor に `doorMat`（例 `'redShutter'`）と DuplicateNumber の番号板の色を params で選べるようにするか、`dressing` を Modifier の後に呼ぶフック（`applyDressing` の post 版）を用意してほしい。どちらかが入れば R20 の重ね箔（最大 260 箔 + 隠れた灰色の扉）と規則の二重実装を外せる。
- **PropRepetition（banquetTable）の担当（R03）**: 丸卓は Modifier の格子（margin 1.2 / pitch max(2.6, 3.2/density) / 位相 0・1 / doorwayZones eps 0.01 / 直線帯 0.6+0.1）を先に埋め、当たり判定を `whiteFabric` のソリッド箔（FURNITURE_MATS 外）にして `overlapsSolid` に見せている。格子の規則・除去対象の材質・扉前ゾーンの寸法を変えるときは R に連絡してほしい（変わると空きセルに角卓が立つ）。
- **rooms.json / 分析表の担当（R04）**: 参考ボードの核「オフィスの格子天井 + 蛍光灯（屋内感）」と rooms.json の `FakeSky(dusk)`（天井を夕空に差し替え、天井付近のパネルを取り除く）が真向から矛盾する。ドレッシングは FakeSky が付いている間は生垣だけを足し、FakeSky が外れた定義になれば吊り天井 + トロファーを張る分岐にしてある。どちらを R04 の正とするか決めてほしい（FakeSky を外す場合は `lightingPreset` の「蛍光灯」で StreetGenerator 側の天井灯も復活する）。
- **RoomBuilder / 三角形予算の担当**: `InstanceSpec.solid` の instances は Tier の instanceScale で間引かれると当たり判定も一緒に消える（既存の契約）。構造として通り抜けを防ぐ物（R08 の書架の段板、R20 のシャッター）は L.boxes に置いた。もし「間引かない instances」（`thin: false` のような印）が入れば R08 の段板（最大 240 箱）を instances に移せる。
- **MaterialLibrary の担当（任意）**: `redShutter` の grid [.12, 3] は横筋が読めるが、扉 1 枚（2.3 m 幅）に対して縦の継ぎ目が無い。`whiteFabric` を丸卓のクロスに使うと carpet テクスチャの起毛が強く見える（tile 系の滑らかな白があればそちらに寄せたい）。`skyDay` を教室の窓箔（R14）に使うと emission 1.6 で白飛びに近い（窓用に 1.0 前後の昼光材質があると良い）。

## M（Mythic 部屋別ドレッシング: src/generators/dressing/mythic.ts）→ 各担当への要望（2026-09-17）

実装の記録は `docs/reference-mythic.md`。以下は所有外のファイルへの依頼（無くても現状の近似で動く）。

- **M → P（PostFX / Game）**: M13（未描画空間）は `L.lighting.occlusion = false` で焼き込みの接触陰影・隅の AO を切り「白い虚空」にしたが、high Tier の GTAO（画面空間 AO）が床際と隅に薄い影を戻す。`layout.render.style === 'untextured'` の部屋にいる間は GTAO を無効化（または強度 0）してほしい。
- **M → L1（RoomBuilder / SurfaceGeometry）**: 発光箔（lightWarm 等）は 1 枚ずつ SurfaceLighting の面光源（器具）になるため、M11 の扉灯 122 枚で構築が 37 → 112 ms になった（今は 12 枚だけ箔、残りは InstancedMesh で「光って見えるだけ」）。InstancedMesh の発光インスタンスも器具に数える経路、または箔ごとに「器具に数えない」印（`Box.kind: 'glowOnly'` など）があると、多数の小さな灯りを安く置ける。
- **M → L1（RoomBuilder）**: M18（天候記憶室）の窓は壁を抜いて夜景 + 雨の Points を開口の中に置いたが、手前に `glass` のガラス板を置くと transmission の描き直しに Points が乗らない可能性があるので入れていない（今はガラス無しの開口 + 方立て）。透過材質越しに Points / 発光箔が見えることが確認できれば `glass` を足す。
- **M → 材質（MaterialLibrary）**: `skyDay`（emission 1.6）は M04 の偽出口・M08 のランマで露出が飽和して白く抜ける（青空に見えない）。emission を 1.0〜1.2 に下げるか、`skyNoon` と同じ雲ノイズ（doubleSide 不要）を使えるようにしてほしい。
- **M → SelfMap / GraphReference（M-snapshot）**: M01 と M16 では、板・額縁の壁面スロットを `wallSlots` を同じ引数で呼んで先読みし、その区間を空けている（`selfMapReserve`、`dressM16`）。SelfMap の `panelGeom` / スロット引数、GraphReference の PHOTO_W / SIGN_Y / spacing を変えるときは mythic.ts 側の定数も合わせる必要がある（共有ヘルパに寄せられるなら `wallSlots` の引数を export してほしい）。
- **M → W / D（wear / decals）**: 製図紙（M01 の `untextured` 箔）や表示板（M03 の `screenDark`）の上にコンセント・サーモスタットのデカールが載ることがある（出 3 cm 以下の箔は「浮かせ」扱い）。1 cm 以下でも面積の大きい箔（0.5 m² 以上）はブロック扱いにしてもらえると自然。

## U → 各担当への依頼（Uncommon の部屋別ドレッシング・2026-09-17）

実装の記録は `docs/reference-uncommon.md`（`src/generators/dressing/uncommon.ts`）。以下は所有外のファイルへの依頼。

- **データ / FakeSky（U20 屋内モーテル中庭）**: `data/rooms.json` の U20 は `FakeSky { skyPreset: 'overcastNoon' }` だが、lightingPreset は「人工夕暮れ」で参考画像も夕暮れ。`skyPreset: 'dusk'` にすると FakeSky の dusk プリセット（skyDusk + 暖色の日射）になり、dressing の暖色の壁灯・ヤシ・プールと合う。dressing からは Modifier の params を変えられない。
- **PropRepetition sameProduct（U15 単一商品スーパー）**: 商品の材質は `rng.pick` の 6 種（boxCardboard / carPaint / wallGreen / yellowLine / upholstery / lightGreen）で、参考の「同じ白いボトル」にならない。`params.mat`（例 'signPlate'）と `params.size`（細い円柱近似 0.08 × 0.24 × 0.08）を受け付けてほしい。また `removeFills` が棚ブロックに掛かる非ソリッド箔を全て捨てるので、dressing は棚に何も足せない（値札レールをソリッドで置く案は構築時間 +45% で見送り。`kind` が `dress:` で始まる箔は捨てない、のような印があれば非ソリッドで足せる）。
- **PropRepetition luggage（U11 手荷物受取所）**: `removeInterior(isFurniture)` が FURNITURE_MATS（metal / rubber / upholstery …）の箔を捨てるため、dressing のターンテーブルは stainless / metalDark / seatRed で組んでいる。dressing が置いた箱を残す印（例: `kind` が `dress:` で始まる箱は捨てない）があると材質の選択肢が広がる。参考画像は「スーツケース 1 つ」なので、`density` を下げた U11 専用の見え方（周囲のリングを 1 本、スーツケースを数個）も検討してほしい。
- **FakeSignage productLabel（U04）**: 複製台数 `rng.int(1,3)` は dressing 側で同じ fork を先読みして合わせている。複製の候補位置に dressing の自販機（同じ furnitureDark + lightPanel 前面）があれば飛ばす現状の動きで問題ないが、扉前判定（blocksDoorway）だけで入口→出口の直線帯を見ないため、dressing が置いた台と入れ替わりで動線に掛かる位置へ複製されることがある（Node で 1 例）。canPlaceSolid に PropRepetition.shared の `boxBlocked`（lanes）を足すと揃う。
- **FakeSignage exitSign（U05）**: 参考画像は「扉は無い」が、fakeExit は EXIT サインの下に偽扉（箔 + 枡）を置く。U05 に限り偽扉を省く（サインだけ）選択肢があると参考に近づく。dressing 側は壁・床をコンクリートにし装飾扉を全て外している。
- **LightingPhase seedPhase（U01）**: dressing は `planSegments` と同じ式・同じ fork で色帯を置いている（実装が変わると帯と器具の色相がずれる）。区画の割り方を変えるときは連絡してほしい。Node では 1,041 ケース中 1 ケース（L 字の折れ目にある器具）で帯と器具の色相が 1 か所ずれた。
- **RoomBuilder / ArchitecturalDetails（任意）**: 丸時計（U06 / U10）は白い薄板 7 段 + 黒い縁の近似（17 箔 / 個）。`SignSpec.kind: 'analog'`（文字盤の CanvasTexture + 針の角度）があれば 1 枚で済み、FakeSignage の秒針とも統一できる。

## E（Epic ドレッシング）→ 各担当への要望（2026-09-17）

実装の記録は `docs/reference-epic.md`。以下は所有外のファイルへの依頼（`src/generators/dressing/epic.ts` 以外は編集していない）。

- **E → NonEuclideanVolume（M-connect / 担当 Modifier）**: E08 の layout フックは殻・内部の両方で `L.boxes = shell` と組み直すため、Modifier より前に走るドレッシングの箔は全て捨てられる（L.signs だけ残り、位置も旧レイアウト基準になる）。
  「会議机の上のノート PC（screenDark 薄箔 + furnitureLight）」「ホワイトボード」「ガラス窓（glass）の向こうの暗い大空間（void + 遠くの点灯の小箔）」を出すには、
  (a) `expandInterior` / `buildShellRoom` の末尾で `dressing/epic.ts` の関数（例: `dressE08Interior(L)` を export）を呼ぶ、または (b) ドレッシングの箱に印（`kind: 'dress'`）を付けたものは捨てずに残す、のどちらかが要る。E08 は保留中。
- **E → データ（xlsx / rooms.json）**: E20 の ColorMissing は `channel: "red"`（rooms.json / tools/modifier_params.json）だが、分析表・参考画像は「青のない世界」（黄色い椅子）。
  red 欠損のままだと黄色は緑に見えるため、ドレッシングは params から欠損色を読んで「赤のない世界 + 青い椅子」にしている。参考どおりにするなら `channel: "blue"` へ（ドレッシングはそのまま黄色い椅子 / 青のない世界に切り替わる）。
- **E → FakeSky（Modifier）**: E04 では天井の中央だけを `palette.ceiling` のまま残して天窓にしている（FakeSky はその箔だけ skyNoon に差し替え、palette.ceiling の箔が 0 のときだけ全面の空箔を足す）。
  この契約（「palette.ceiling の箔を差し替える / 無ければ全面」）は維持してほしい。加えて、`beams` の桁・梁が空の箔（sky*）の真下を横切るときはその梁を省くか、E04 の params に `beams: false` を渡せると天窓が四角く抜ける。
- **E → M（MaterialLibrary / cc0Materials）**:
  - `plant` は albedo が低く、上からの光しか無い部屋（E04 の木）では葉がほぼ黒に見える。少し明るい葉色（または `plant` の emissive 0.1 前後）が欲しい。
  - `screenGlow`（emission 1.6）は E09 のモニターに使うと「白い板」に見える。青白い LCD 用に emission 0.8〜1.0・色 0x9fc8ff の `screenLcd` 系があると机の上の画面らしくなる。
  - `whiteFabric` の胸像（E06）は単一光の部屋で黒いシルエットになる。大理石の像に使える明るく少し艶のある白（`marbleWhite`）があると参考に近い。
  - 電車の白い車体（E11）は `signPlate`（リノリウム地の白）で代用した。塗装の白（`paintWhite`。carPaint の detail 'paint' で色 0xe8e9e4）があれば車体・自販機などに使える。
- **E → L1（RoomBuilder / SurfaceGeometry）**: `render.wetness` は部屋の全材質（壁・天井も）に掛かる。艶床（E01 / E07 / E09）には床だけに効く `render.floorWetness`（または wetness の対象材質の指定）が欲しい。
  また焼き込みのコストは発光体（emission のある箔）の数 × 頂点数で増える（E09 でモニター 40 枚を全点灯にすると構築時間 +45%）。発光箔の面積が小さいもの（< 0.2 m²）は 1 点サンプルにするなどの間引きがあると、小さな発光小物を増やしやすい。
- **E → Game / dev（任意）**: ドレッシングの効果を同じ部屋で比べる検証用に `globalThis.__epicDressingOff` を `epic.ts` に置いた（true で何もしない。通常は未定義）。不要なら削除してよい。

## L（Legendary 部屋別ドレッシング）→ 各担当への要望（2026-09-17）

実装の記録は `docs/reference-legendary.md`。`src/generators/dressing/legendary.ts` だけを編集した。以下は所有外のファイルへの依頼。

- **担当 InstanceOvergrowth（`src/modifiers/mods/InstanceOvergrowth.ts`）**: L03 の麦（propId 'wheat'）は茎 'grass'（0.07 m 幅、緑）+ 穂 'boxCardboard' で、
  高所灯の下では緑の細い線がほとんど見えず「黄金の麦畑」に読めない。ドレッシングは Modifier より前に走るため茎の色は変えられない。
  茎を `plasticYellow`（または yellowLine）の 0.12〜0.16 m 幅の箔に、穂を `plasticYellow` にしてほしい（Tier 間引きはそのまま）。
  ドレッシング側は畑の地面（'grass' の箔）を yellowLine に、高所灯を lightWarm に、環境色を暖色にして黄金色に寄せている。
- **担当 M（MaterialLibrary）**: `plant` の球（'plant' の箔を RoomBuilder が球体に描く）が現状の照明ではほぼ黒く見える
  （L01 / L05 / L14 / L17 の樹冠・植栽が黒い球になる。参考は明るい緑）。foliage テクスチャの明度か emissive 0.1〜0.2 を検討してほしい。
- **担当 ParticleDetail / RoomLayout（`layout.ts` の `particles`）**: L09 の湯気（steam）は ParticleDetail の mist が `L.particles` を使うため足せない
  （単一スロット）。`particles?: ParticleSpec[]` の複数領域対応（README の Phase 3 項目）が入れば浴槽ごとの湯気を出す。
- **担当 FogDepth / rooms.json（L01）**: `FogDepth` の near 30 / far 160 は 64 m の街区では霧がほとんど掛からない。
  「青い薄明」を出すには near 10 / far 70 程度が要る（データ側の値。ドレッシングは触らない）。
- **担当 RoomBuilder / SignAtlas**: L04（無限グランドホテル）は Generator の客室番号板が 110 枚以上あり 48 枚の上限で後半が描かれない。
  ドレッシングの館名サインは `unshift` で先頭に入れている。上限をアトラス 4 枚（64）にするか、番号板の signEvery を大きくしてほしい。
- **担当 P（Game / 環境）**: `L.palette.ambient` / `fog` をドレッシングで部屋ごとに変えている（L02 / L03 / L09 / L12 / L13 / L16 など）。
  palette.fog は FogDepth の無い部屋で scene.fog の色になる想定で設定した。もし palette.fog が参照されていなければ連絡してほしい。

## 統合担当の処理記録（第6回ドレッシング後・2026-09-17）

反映したもの（所有ファイルの制約が外れた統合時にまとめて処理）:

- **U20 → データ**: `data/rooms.json` / `tools/modifier_params.json` の U20 FakeSky を `skyPreset: 'dusk'` に変更（lightingPreset「人工夕暮れ」と参考ボードに合わせた。xlsx の 03_Modifier 側は次回の資料更新で同じ値にする）。
- **L01 → データ**: L01 FogDepth を near 10 / far 70 に変更（64 m の街区で青い薄明が掛かる距離）。同じく xlsx へ反映待ち。
- **E / L → MaterialLibrary**: `plant` の葉色を 0xa5b988 → 0xc6d9a8（粗さ .6）。emissive は焼き込みの器具に数えられて構築コストが増えるため使わない。
- **R / M → MaterialLibrary**: `skyDay` の emission 1.6 → 1.1（R14 の窓、M04 / M08 の偽出口で白飛びしない）。
- **E → MaterialLibrary / epic.ts**: `screenLcd`（青白い弱発光 0.9。E09 のモニター）、`marbleWhite`（E06 の胸像。Marble012 の明るいトーン）、`paintWhite`（塗装の白。E11 の車体）を追加し epic.ts で差し替えた。
- **L → SignAtlas**: `MAX_ATLASES_PER_ROOM` 3 → 4（部屋あたり 64 サイン。L04 の客室番号板）。
- **M → PostFX / Game**: `PostFX.setAoSuppressed()` を追加。`layout.render.style === 'untextured'` の部屋に入っている間は GTAOPass を無効化（M13 の白い虚空に隅の影が戻らない）。
- **足音**: `Sfx.floorKindOf` に carpetPattern（carpet）/ marbleFloor・marbleWhite（tile）/ woodPanel・bookshelfWood（wood）を追加。
- **palette.fog（L の確認）**: Game.applyEnvironment は `BuiltRoom.fog` → `layout.render.fog` → `palette.fog` の順で scene.fog / background の目標色にしている（README「環境の補間」）。FogDepth の無い部屋では palette.fog が使われる。

保留（判断待ち・別担当の設計変更が要る）:

- **E20 の channel（red / blue）**: データは `red`（設計資料どおり）。参考ボードは「青のない世界 + 黄色い椅子」。ドレッシングは params に追従するので、資料側を `blue` に変えればそのまま参考どおりになる。企画判断を待つ。
- **R04 の FakeSky(dusk) と格子天井**: 参考ボードの核（オフィスの格子天井 + 蛍光灯）と FakeSky が矛盾。現状は FakeSky を尊重し生垣だけ。企画判断を待つ。
- **PropRepetition の params 拡張（U15 `mat`/`size`、R20 `doorMat`）、`kind: 'dress:*'` の箔を removeFills / removeInterior / NonEuclideanVolume で残す印（U11 / U15 / E08）**: Modifier 側の契約変更。次回の Modifier 作業でまとめて入れる。
- **FakeSignage exitSign の偽扉省略（U05）**、**InstanceOvergrowth の麦の色（L03）**、**`particles` の複数スロット（L09）**、**`SignSpec.kind: 'analog'`（U06 / U10）**、**発光箔を器具に数えない印 / 面積の小さい発光体の 1 点サンプル（M11 / E09）**、**`render.floorWetness`（E01 / E07 / E09）**: いずれも所有担当の次回作業へ。
- **E04 の FakeSky beams**: 天窓の真下を横切る梁を省く（または `beams: false`）は FakeSky の次回作業へ。

## 見た目の不具合修正（2026-09-17・ユーザー指摘 7 件）

- **灰色のタイル調の床**: `floorCarpetGrey` の第 3 候補 Carpet003（0.5 m 格子のタイルカーペット）を不採用にし、無地の Carpet012（暖灰に補正）へ置換（`src/render/cc0Materials.ts`）。参考 COMMON の「カーペットは均一で模様が主張しない」に合わせた。
- **扉の深い茶の格子模様**: `woodPanel` の dark_paneled_wood を Wood051（無地のダークウォールナット）へ、`furnitureDark` の第 2 候補 dark_paneled_wood を laminate_floor_02（暗いオーク）へ置換。U02 など `palette.door = 'woodPanel'` の部屋は無地の濃い木扉になる。
- **監視映画館（R09）の宙に浮く座席**: `RoomGenerator` Theater に段床（列ごとに床から rise までのカーペットの箱）を追加。入口が床レベルのため段は最大 0.9 m（3 段）に抑え、入口から座席越しにスクリーンが見える。
- **密閉風洞廊下（R18）の白線**: 静止した風の筋（lightPanel の帯 26 本）を削除（`rare.ts` dressR18）。風は ExternalForce の押し出しと音で伝える。
- **鏡（MirrorOffset）の菱形**: 全幅 11.7 m の暗いガラス帯を、stainless の枡付き長方形パネル（0.7 m 幅・1.0 m ピッチ、カウンター範囲）に分割。斜めから見ても個々の鏡は長方形に読める。
- **扉上の黒枠（C03 など）**: 入口の部屋名ラベル（`RoomBuilder.buildLabel`）が焼き込みの対象外で動的光だけでは黒く見えていた。板サインと同じ弱い自己発光（emissiveMap × .28）を持たせた。
- **夜景の視差**: `windowNight` を層別の視差サンプリング（遠景 45 m / 近景 12 m）に変更。`docs/night-parallax.md` 参照。

## A2 → 各担当（Modifier: FakeSignage / InstanceOvergrowth / FakeSky / ParticleDetail・2026-09-21）

処理したもの（所有ファイル内で完結）:

- **U05 FakeSignage exitSign の偽扉省略**: params `fakeDoor`（既定 true）を追加。`data/rooms.json` / `tools/modifier_params.json` の U05 は統合担当が `fakeDoor: false` を入れ済みで、EXIT サイン + 緑の非常灯だけが何も無い末端壁を指す。
- **L03 InstanceOvergrowth の麦**: 茎 = plasticYellow の箔（0.14 / 0.16 × 1.05 × 0.04 m）、穂 = plasticYellow。上限 9,000 → 30,000 本、間隔は畑全体が埋まる値に自動で広がる（以前は巨大倉庫で西端の帯しか埋まらなかった）。三角形は 1.2M → 0.67M。
- **E04 FakeSky の梁**: `beams: false` はデータ側で有効。加えて beams=true でも天井の一部だけが空（被覆 90% 未満 = 天窓）のときは、空箔の真下を横切る桁・梁を省く（seed 7 の E04 で確認: 6 × 6 m の天窓を横切る梁 2 本 + 大梁 1 本が抜け、ring と他の梁は残る）。全面が空の天井（U20 / R04）は従来どおり。契約「palette.ceiling の箔を差し替える / 無ければ全面」は維持。
- **`particles` の複数スロット**: `RoomLayout.particles: ParticleSpec | ParticleSpec[]`。ヘルパは `src/generators/particles.ts`（`particleList(L)` / `addParticles(L, ...specs)` / `replaceParticles(L, type, spec)`）。RoomBuilder はスロットごとに Points を作り、粒数の合計を Tier の particleCap に比例で収める。ParticleDetail は同 type だけ置き換える（別 type のスロットは残す）。dressL09 が浴槽ごとの steam を足した。

各担当への要望・周知:

- **A1（rare.ts / NonEuclideanVolume）・mythic.ts・PoolGenerator の担当**: 単一代入（`L.particles = {...}` / `= undefined`）はそのまま型が通るので変更不要。ただし `if (!L.particles) L.particles = {...}`（rare.ts 622 行）は「既にスロットがあれば足さない」の意味になる。複数スロットを共存させたいときは `addParticles(L, spec)` を使ってほしい。`L.particles.type` / `.aabb` の直接読み取りは配列だと壊れるので `particleList(L)` で読む（Wetness / ScaleAnomaly は A2 が直した）。
- **データ / 資料（統合担当）**: xlsx の 03_Modifier に U05 `fakeDoor: false`、E04 `beams: false` を反映（JSON 側は済）。
- **B（ArchitecturalDetails / 家具形状）**: 麦の茎は plasticYellow の薄い箔で、`detailedBoxes` の対象になる材質ではない（InstancedMesh は surfaceBox）。plasticYellow に面取りや装飾を足す予定があれば InstancedMesh 側（RoomBuilder.buildInstances）は影響を受けない点だけ周知。
- **MaterialLibrary の担当（任意）**: plasticYellow（roughness .35）は高所灯の下で少し艶が出る。麦らしい乾いた質感が欲しければ roughness .6 前後の黄金色（例: `strawYellow`）があると茎に使いたい。現状は plasticYellow で「黄金色の面」として読めているので必須ではない。

## A1（Modifier: PropRepetition / NonEuclideanVolume + dressing U11 / U15 / R20 / E08）→ 各担当（2026-09-21）

反映したもの（所有ファイル: `src/modifiers/mods/PropRepetition.ts` / `PropRepetition.shared.ts` / `NonEuclideanVolume.ts`、`src/generators/dressing/uncommon.ts` / `rare.ts` / `epic.ts`）:

- **契約: `Box.kind` が `'dress:'` で始まる箱は Modifier が捨てない**（`PropRepetition.shared.isDress` / `DRESS_KIND_PREFIX`）。`removeInterior`（PropRepetition / InstanceOvergrowth / PropOrientation が共用）と `PropRepetition.removeFills` はその箱を残す。NonEuclideanVolume は殻・内部の組み直し後に戻す（内部は中心 × s に写して殻の内側に clip）。ドレッシングは U11 `dress:carousel`、U15 `dress:rail`、E08 `dress:laptop` / `dress:whiteboard` / `dress:window` を付けた。RoomBuilder の kind → glTF 置換は `catalog.candidates` が空を返すので `dress:*` は素通り（確認済み）。
- **PropRepetition sameProduct**: params `mat`（MatId）/ `size`（[w, h, d]。scale を掛ける）。w < 0.12 は箔 2 枚を 45° ずらした 8 角柱近似（同じ順序の transforms なので Tier の等間隔間引きで 2 枚が同じ個体に残る）。上限は合計 12,000（6,000 × 2）。
- **PropRepetition storageDoor**: params `doorMat`。doorMetal 以外のときは doorMetal の裏板（0.02〜0.068）の手前に doorMat の化粧板（0.069〜0.074）。番号板の規則は変えていない（DuplicateNumber は doorMetal の非 solid 箱を扉と見る。番号板は 0.080 = 化粧板の 6 mm 手前）。横筋（ribs）は化粧板のときは省く。

依頼（所有外）:

- **DuplicateNumber（M-sign 担当）**: storage モードの扉検出が `mat === 'doorMetal'` 固定のため、storageDoor は doorMat のとき裏板の doorMetal 箱を 1 枚余分に出している（R20 で 200 箔）。扉板に `kind: 'storageDoor'` を付けて検出する契約にしてもらえれば裏板を外せる（PropRepetition 側はすぐ対応できる）。
- **データ（U11）**: 参考ボードは「スーツケース 1 つ」。PropRepetition luggage の `density: 0.8` のままだと周囲のリングに 80 個並ぶ。`density: 0.3` 程度に下げると疎になる（Modifier の変更は不要）。
- **データ / RoomBuilder（U15）**: 値札レールは signPlate（白）で棚板 shelfMetal（明灰）とのコントラストが低い。レールに使える細い赤帯（`plasticRed`）にするか、`signPlate` より白い材質があれば差し替える。現状は白のまま。
- **RoomBuilder（任意・InstanceSpec）**: 円柱形状の InstanceSpec（`shape: 'cylinder'` など）があれば、U15 のボトルを 1 枚で描け、6,000 × 2 の上限を 12,000 × 1 に戻せる。
- **統合担当**: `docs/reference-uncommon/U11-s7-after.jpg` / `U15-s7-after.jpg`、`docs/reference-rare/R20-s7-after.jpg`、`docs/reference-epic/E08-s7-after-table.jpg` / `E08-s7-after-window.jpg` を追加した（seed 7、Tier high）。構築時間（`__buildProfile.total`、同 seed、変更前 = 自分の 6 ファイルだけ HEAD に戻したコピー）: U15 209 → 237 ms、R20 125 → 95 ms、U11 103 → 89〜132 ms、E08 内部 56 → 71 ms（遠景の灯 12）→ 9 灯に減らして再計測 43 ms。

## B（造形: 残る家具 / `src/render/props/FurnitureShapes.ts`）→ RoomBuilder（2026-09-21）

第 2 段で椅子・連結椅子・ベンチ・ロッカー・机上モニターを `detailedBoxes` の箱の組に描き替えた（`docs/visual-v05/README.md` 第 2 段）。
箱しか渡せないので「背の傾き」「鋼管の円柱」「CRT 前面の膨らみ」はまだ出ない。次の 3 点を RoomBuilder 側で受けてほしい。

1. **家具ジオメトリのフック（車と同じ経路）**: `vehicleSurfaces` と並べて、propGroup 単位の任意ジオメトリを受ける。B は
   `src/render/props/FurnitureGeometry.ts` に `furnitureSurfaces(boxes: Box[]): { box: Box; geometry: THREE.BufferGeometry; members: Box[] }[]`
   を用意する（`box` は材質と AABB、`members` は置き換えた元の箔）。パッチ（`RoomBuilder.build`）:
   ```ts
   // const vehicles = ... の直後
   const shaped = !legacy && !roll ? furnitureSurfaces(work.boxes) : [];
   cleanup.push(() => shaped.forEach((s) => s.geometry.dispose()));
   // const replaced = ... の直後
   for (const s of shaped) for (const m of s.members) replaced.add(m);
   // for (const v of vehicles) parts.push(...) の直後
   for (const s of shaped) parts.push({ b: s.box, special: true, target: -1, geometry: s.geometry });
   ```
   `bake` の遮蔽体は `replaced` を足しているので追加変更は不要。フックが入ったら B は椅子の背を 8° 傾け、脚を 8 角の円柱にし、
   CRT 前面を RoundedBox の膨らみにする（三角形は 1 台 400 以下を維持）。
2. **propGroup の glTF 置換で消す箔**: `replaced` の構築（`pp.box.propGroup ? propGroups.get(...).filter(b => b.mat === 'plant') : [pp.box]`）は
   鉢植え前提で、`plant` 以外のグループ（`chair` など）に将来モデルが入ると元の箔と二重描きになる。
   `.filter(b => pp.box.kind === 'plant' ? b.mat === 'plant' : true)` にしてほしい（現状 chair モデルは配布されていないので影響なし）。
3. **`special = !!themed.propGroup`**: propGroup 付きの箱を全てチャンク分割・ライトマップの対象外にしている。B の detailedBoxes は
   置き換えた箱から propGroup を外して出すので今は影響しないが、グループが欠けて元の箔を描くときだけ special になる。
   `themed.kind === 'plant'` に限定するのが安全。

B が付けた kind（`Box.kind`）: `chair`（座）/ `linkedSeats`（梁）/ `bench`（天板）/ `lockers`（本体）/ `vending`（本体）/ `decorDoor`（廊下の装飾扉の扉箔）。
`PropCatalog.candidates` は既知の 7 kind 以外を空で返すので、planProps には影響しない。

## 統合担当の処理記録（第7回・2026-09-21: Modifier 契約変更 + 家具の輪郭）

反映済み:
- **データ**（統合が事前に変更。xlsx の 03_Modifier へ反映待ち）: U15 PropRepetition `mat: 'signPlate'`, `size: [0.08, 0.24, 0.08]`／R20 PropRepetition `doorMat: 'redShutter'`／U05 FakeSignage `fakeDoor: false`／E04 FakeSky `beams: false`／U11 PropRepetition `density: 0.3`（A1 の依頼。参考は「スーツケース 1 つ」）。
- **A1**: PropRepetition `mat` / `size` / `doorMat`、`kind: 'dress:*'` の箔を removeFills / removeInterior / NonEuclideanVolume で保持、U11 / U15 / R20 / E08 のドレッシング追従。E08 は保留を解除。
- **A2**: FakeSignage `fakeDoor`、InstanceOvergrowth の麦を黄色 + 上限 3 万本、FakeSky の天窓下の梁省略、`particles` の複数スロット（`src/generators/particles.ts`）、L09 の浴槽ごとの湯気。
- **B**: `src/render/props/FurnitureShapes.ts`（椅子・連結椅子・ベンチ・ロッカー・LCD/CRT・売場棚）と `furniture.ts` / `CorridorGenerator.ts` の kind 付与。部屋の三角形は最大 1.2 倍。
- **統合**: 劇場の側通路に段床に沿う階段（RoomGenerator）、鏡の反射側にも枡（MirrorOffset）。「植栽が球」は V05 の葉群ジオメトリで既に解消していることを R07 で確認。

未対応（次回へ）:
- DuplicateNumber の storage 扉検出を `kind: 'storageDoor'` に（R20 の裏板 200 箔を外せる）。
- RoomBuilder: propGroup 単位の任意ジオメトリを受けるフック（B の要望 1〜3。背の傾斜・8 角柱の脚・CRT の膨らみ・円柱 InstanceSpec はこれ待ち）。
- ソファ（L04 / furnishGeneric）、背なし座席列（U11 / L08）、U14 の CRT インスタンスの専用形状。
- 大浴場（L09）の湯気は cap 内で薄い。麦用の艶の低い黄金色材質。U15 値札レールの色（白 → 赤帯）は判断待ち。

## P1 → 各担当（第7回・2026-09-21: 色温度と扉の光漏れ）

P1 の変更: `src/generators/presets.ts`（`KELVIN_RANGE` / `applyLightKelvin`）、`src/generators/index.ts`（generateLayout の先頭で呼ぶ）、`src/render/DoorLeak.ts`（新規）、`src/game/Game.ts`（配線）。記録は `docs/lighting-lightmap.md` 8・9 章。

1. **P3（`SurfaceGeometry.buildFixtures` / lightmap.worker）: 焼き込みの器具色を `palette.lightColor` に追従させてほしい。**
   現状は `const color = new THREE.Color(s.color)`（`SURFACES[b.mat].color`。lightPanel 0xedf0d9 / lightWarm 0xffd29a 固定）なので、部屋ごとに選んだ色温度が床・壁の焼き込みに出ない
   （効くのは動的 PointLight の鏡面反射・`palette.ambient`・半球光だけ）。案: `b.mat === 'lightPanel' || b.mat === 'lightWarm'` のとき
   `color.setHex(layout.palette.lightColor)`（lightPanel の輝度 0xedf0d9 との比を保つなら `color.setHex(layout.palette.lightColor).multiplyScalar(lum(s.color) / lum(lightColor))`）。
   ledBlue / lightGreen / lightYellow / sodiumLight / screenGlow は材質の色のまま。EraPreset / ZoneThemeShuffle の `recolorLights` は L.lights の色を変えるが発光箔の材質は差し替えるので、そちらは現状どおり材質色で良い。
2. **P2（`MaterialLibrary` / `layout.ts` の render 型）: 器具の面（lightPanel / lightWarm の発光色）を部屋の `palette.lightColor` に寄せる仕組み。**
   案: `RenderOverrides.lightTint?: number`（P1 が generateLayout で `L.render.lightTint = palette.lightColor` を入れる）を variant のキーに含め、
   lightPanel / lightWarm の `emissive` を `SURFACES.color × lightTint / 0xffffff` に。1 部屋あたり発光材質 1〜2 個の clone。これが入るまでは器具面は白のまま（色温度は床の反射と漏れ光でしか分からない）。
3. **PostFX（担当未定 / 統合）: GTAOPass の法線 / 深度パスから「加算 / 乗算の装飾クワッド」を外す共通手段。**
   P1 は `mesh.onBeforeRender` で override 中だけ `geometry.setDrawRange(0, 0)` にして回避した（`DoorLeak.ts` の `excludeFromOverridePasses`）。
   同種の透明箔（水面・デカール・ガラス）にも AO の縁が出ているなら、`RoomGTAOPass._overrideVisibility` を拡張して `material.transparent && material.depthWrite === false` の Mesh を隠す方が一括で済む。
4. **統合: Seam 扉の open。** `Game.toggleDoor` は Seam 扉を開けずに遷移するので、`DoorLeak` の Seam 演出（2 色の流れ + 暗い床）は Modifier が `portal.open = true` にした Seam 扉にしか出ない（現状その Modifier は無い）。
   「閉じた Seam 扉の下端 2 cm に細い 2 色の漏れを出す」か「遷移のフェード前 0.3 s だけ開けて見せる」かは仕様判断待ち。


## P2（材質: 部屋別 envMap / clearcoat / floorWetness / 水面 / 夜景位相）→ 各担当（2026-09-21）

反映したもの（所有: `src/render/MaterialLibrary.ts`、`src/render/cc0Materials.ts`、`src/generators/layout.ts` の `RenderOverrides.floorWetness`、`src/generators/dressing/epic.ts` の E01 / E07 / E09。RoomBuilder は `forRoom` に `palette: layout.palette, height: layout.height` を渡す 1 箇所と `overridesFor` の `floorWetness` 1 行）: `docs/material-variation.md` 11、`docs/night-parallax.md`、`docs/postfx.md` 12。

依頼（所有外）:

- **Game（P1）`prefetchAhead`**: 2 hop 先の先読みで `this.materials.roomEnvironment(id, layout.palette, layout.height)` を 1 回呼ぶと、部屋別 envMap（1 枚 3〜4 ms）を構築フレームから外せる。参照は `releaseRoom` で外れるが、先読みだけで構築されなかった部屋の参照は残るので、`dropPrefetch` と同じタイミングで `materials.releaseRoom(id)` を呼ぶか、`roomEnvironment` に `retain: false` を足す（P2 側で対応可。要望があれば実装する）。
- **PropCatalog（P1 / P3）`adoptExternal`**: glTF プロップは共有の RoomEnvironment のまま。部屋別にするなら `adoptExternal(m, overrides, envMap)` の引数を足して `materials.roomEnvironment(...)` の戻りを渡す（P2 側で引数追加は可）。
- **RoomBuilder（P3）**: 水面の材質は `variant()` 経由（ライトマップ対象外）なので部屋別 envMap を受けない。水面に部屋の色を映すなら、`materialFor` で `/^water/` の MatId だけ `forRoom(..., { palette, height })`（lightMap 無し）に流してほしい（プログラムは増えない）。
- **DoorLeak（P1）**: E09 の水壁の扉（Portal が常時開）で、隣室 C07 の床に紫（マゼンタ）の光漏れが出る（変更前の HEAD では無し。水面材質を隠しても残るので P2 の変更ではない）。水壁の Portal は `portal.open = true` を毎フレーム維持するので、漏れの色が「向こうの部屋のレア度」なら E09 側の色が正しいか確認をお願いしたい。
- **Lightmap / lightmap.worker（P3）**: 水面（`water*`）は `isLightmapTarget` で除外のまま。透過になったので水面下の床のライトマップがそのまま見える（問題なし）。
- **データ（統合）**: E06 .6 / E08 .35 / E11 .25 / E19 .3 の `render.wetness` は壁・天井にも掛かる。床だけの意図なら `floorWetness` に切り替える（epic.ts の該当行を `setFloorWetness` に変えるだけ。P2 で対応可）。
- **Tier（P1）**: 部屋別 envMap は `materials.setTier('low')` で無効（共有 1 枚）。clearcoat / 透過は Tier で切っていない（uniform 化できないため。low で重ければ `gloss` / `water` を Standard に落とす分岐を P2 が足す）。
- **P1 依頼の器具色追従は実装済み**（`docs/material-variation.md` 11.7）: `overridesFor` が `palette.lightColor` を `overrides.lightTint` に写し、器具材質の emissive に正規化 tint を掛ける。`wearEffects`（明滅 / 黄ばみ）が器具材質を clone する経路があれば、clone は variant の emissive を引き継ぐので追加対応は不要のはず（未確認）。
- **Game（P1）**: 作業中の Game.ts で `ReferenceError: isLightFixtureMat is not defined`（Game.ts:453）がコンソールに出る（2026-09-21 01:50 時点。P2 の変更とは無関係）。

## P3 → 各担当（第 7 回・2026-09-21: ライトマップ）

- **P1（ParkingGenerator / VerticalGenerator / dressing の LightSpec 色）**: 焼き込み・ライトマップの器具色を「材質色 × palette.lightColor」にした（`SurfaceGeometry.buildFixtures`）。
  `ParkingGenerator.ts:110`・`VerticalGenerator.ts:96-97`・`legendary.ts:1307`・`rare.ts:586` の LightSpec は `0xdfe8ff` 固定なので、C06（seed 7、palette fff2e4）では
  動的 PointLight（冷）と焼き込み（暖）の色が合わない。LightSpec の color を `L.palette.lightColor` にしてほしい（CorridorGenerator / RoomGenerator は既にそうなっている）。
- **層の注意（型変更は不要）**: `Box.kind` に `'glowOnly'`（または `glow:` 接頭）を付けた発光箔は器具に数えない。装飾の発光体（扉灯・LED 列・サイン列）を大量に置くときはこれを付けること。
- **P2 への要望は無し**: クロスフェードは three 標準の `lightMapIntensity` uniform + 頂点属性の減衰で実装したので、`cloneWithLightMap` / シェーダ注入の変更は不要。
  将来フェード中の属性再アップロード（0.5 s、見えている外殻メッシュのみ）を無くしたければ、uniform `lightmapBlend` で `vBakedLight * (1 − blend)` にする案がある（任意）。

## 統合担当の処理記録（第8回・2026-09-21: 光と材質の仕上げ）

反映済み:
- **P1**: テンプレート別の色温度（`presets.ts` の `KELVIN_RANGE` / `applyLightKelvin`。`generateLayout` 先頭で専用 fork）、扉の光漏れ（`src/render/DoorLeak.ts`。レア度別の色と動き、Seam は開閉ともに特殊。PointLight は増やさない）。
- **P2**: 部屋別 envMap（パレット色の箱部屋を PMREM、LRU 8）、艶床の clearcoat、`render.floorWetness`（E01 / E07 / E09）、水面の透過・フレネル・水深減衰、夜景の部屋別位相、器具面の emissive を lightColor に追従。
- **P3**: ライトマップ到着の 0.5 s クロスフェード、InstancedMesh / glTF の足元照度、`kind: 'glowOnly'` の発光箔（M11 の扉灯 139 枚を器具に数えない）、小発光体の 1 点サンプル、焼き込みの器具色 × lightColor。
- **統合**: ParkingGenerator / VerticalGenerator の固定 0xdfe8ff を `palette.lightColor` に。

未対応（次回へ）:
- 開いた Seam 扉の演出は Modifier が open にした扉にしか出ない（本編では閉じた Seam の漏れのみ）。
- 区画ごとの器具色差し替え（EraPreset / ZoneThemeShuffle）は palette 1 色。
- glTF（adoptExternal）と水面（variant 経由）は共有 envMap のまま。prefetchAhead で roomEnvironment を先に焼く余地。
- E06 / E08 / E11 / E19 の `wetness` を床だけにするかは判断待ち。clearcoat / 透過の Tier 切り替え。
- フェード中 0.5 s の属性再アップロードを uniform 化する案。
- **統合の調整**: 部屋別 envMap の LRU を 8 → 24 枚、キーの高さを 1 m 刻みに（8 枚では seed 7 の 13 部屋踏破で 104 枚の焼き直し ≈ 390 ms が入室フレームに乗った。24 枚で 3 seed × 12 部屋の焼き直し 50 枚、命中 607）。
- **統合後の計測**（3 seed × 12 部屋、Tier high）: ERROR 0 / コンソールエラー 0、100 ms 超フレーム 11 / 75（第7回 8、第6回 3）、入室中央値 30 ms、開扉中央値 4 ms、最大 298 ms（U04 開扉の後回し構築）、GPU 中央値 11.9 ms（第6回 9.4。clearcoat・透過・漏れ光の分）。

## F2（カメラ挙動: 手持ち感 / 視線の遅れ / 撮像 pass への入力）→ 統合（2026-09-22）

編集: `src/player/PlayerController.ts`（`CAMERA_FEEL` / `CAMERA_PRESETS`、`feel` / `cameraFeelSuppressed` / `setStillness` / `teleportSerial`、`syncCamera` の合成）、
`src/game/Game.ts`（`applyCameraSettings` / `updateStillness` / `updateCameraMotion` / `updateRecOverlay`、`enterRoom` の `notifyRoomEnter`）、
`src/core/Settings.ts`（`postfx: FilmPreset`、`handheld` / `cameraLag` / `recOverlay` / `frameHold`）、`src/ui/SettingsPanel.ts`、`src/audio/AudioEngine.ts`（`ambientLevel`）。記録は `docs/film-camera.md`。

1. **`Game.applyPostFxConfig` の暫定 `'archival' → 'homeVideo'` は外した**（Settings の sanitize に移し、Game は `film = d.postfx`、low Tier の clean は off）。
2. **`videoPass.params.frameHold` の上書き**は `PostFX.configure`（`applyPreset` が値を写す）の直後に `Game.applyCameraSettings` で書き戻している。
   PostFX が他のタイミングで `applyPreset` を呼ぶようになったら `applyCameraSettings()` を呼ぶか、`PostFX` に `frameHoldOverride: number | null` を持たせてほしい。
3. **`RecOverlay` の親は `document.body`**（`Game.recOverlay = new RecOverlay(document.body)`）。表示は設定 `recOverlay` かつ playing / riding / transition のときだけ
   `setVisible(true)`（メニュー・開始画面では false）。F1b が別の親（`#hud` など）や「メニュー中も表示」を想定しているなら Game の `updateRecOverlay` を直す。
4. `postfx.setCameraMotion` には表示カメラ（遅れ・ふらつき込み）の rad/s を渡している。テレポート・入室のフレームは 0。LensPass 側で「入室直後のフォーカスの迷い」と
   回転ブラーが重なる瞬間の見え方は F1a と一緒に確認したい。
5. `AudioEngine.ambientLevel` は推定値（レイヤー gain の合成 → `1 - exp(-bus/1.4)` × 音量）で、非表示タブでは 0。VideoPass の暗部ノイズの係数はこの範囲
   （無音 0.02 / 1 本 0.41 / 3 本 0.57）で合わせてほしい（F1b）。

## F1a（撮像 pass: `src/render/LensPass.ts` / `src/render/shaders/LensShader.ts`）→ 統合（2026-09-22）

実装の記録は `docs/film-lens.md`。公開 API（`params` / `applyPreset` / `setDepthTexture` / `setCameraMotion` / `notifyRoomEnter` / `update` / `exposureGain` / `luminance`）は変えていない。
`LensParams.glow` の意味だけ「ぼかした明部の超過分に掛ける倍率（0〜0.6）」に変えた（目安 0〜0.08 では見えなかった。プリセットは 0.35 / 0.45）。

1. **GTAO 停止時の深度**: `PostFX.setAoSuppressed(true)`（untextured の部屋）で GTAOPass が enabled = false になると `GTAOPass.depthTexture` は更新されず、LensPass のかすみ / DoF が
   前の部屋の深度を見続ける。`setAoSuppressed` の中（か `render` の先頭）で `this.lensPass?.setDepthTexture(this.gtaoPass?.enabled ? this.gtaoPass.depthTexture : null)` を
   呼んでほしい。null を渡せば LensPass が自前の半解像度深度パスに切り替わる（C02 で +0.5〜0.6 ms、+18 calls）。
2. **デバッグ HUD**: `lensPass.exposureGain` / `luminance`（幾何平均、線形）に加えて `whiteBalance`（Vector3）/ `centerDistance`（m）/ `statReads` / `statErrors` を公開した。
   1 行足すなら `lens gain 1.23 L 0.043 wb 0.95/1.01/1.09 d 8.3m`。
3. **固定コストの情報**: composer の RT が MSAA（samples 2）なので、フルスクリーン pass 1 枚ごとに resolve blit が入り、効果を全部切っても LensPass は min 0.82 ms（1080p）。
   効果ぶんの増分は min +0.15 / p25 +0.3〜0.6 ms。VideoPass も同じ固定コストを払うはずなので、RenderPass だけ MSAA の RT に描いて以後は非 MSAA でピンポンする構成
   （EffectComposer を使わず自前で回す）にすれば pass あたり 0.5 ms 前後浮く見込み。優先度は低い。
4. **mid Tier**: GTAO が無いので LensPass が自前深度パスを毎フレーム描く（haze / dof > 0 のとき）。重ければ mid の `LENS_PRESETS` 側で haze / dof を 0 にするか、
   `LENS_TUNING.DEPTH_SCALE` を 0.35 に。恒久策は composer の RT に DepthTexture を付けて RenderPass の深度を GTAO / Lens で共有すること（PostFX 側の変更）。
5. **F2 へ**: `setCameraMotion` は表示カメラの rad/s のままで良い（1/60 s × 焦点距離 px に換算、上限 24 px @1080p、τ 0.06 s で平滑）。入室フレームが 0 なら迷い（0.3 s）と
   回転ブラーが重なるのは入室後に振り向いたときだけで、同じディスク核に足すだけなので破綻しない。DoF は回転 0.5 rad/s 以上で止めている。
6. **露出の基準**: `LENS_TUNING.EXPOSURE_KEY = 0.045`（seed 7 の 9 部屋の幾何平均輝度 0.02〜0.11 の中央）。ライトマップの再調整で部屋の平均が変わったら測り直す
   （`game.postfx.lensPass.luminance` を各部屋で読むだけ）。補正の強さは `EXPOSURE_ADAPT = 0.45`（R06 のような明るい部屋で 0.67 まで下がる。強ければ 0.3 へ）。

## F1b（映像記録系 VideoPass / RecOverlay）→ 統合・F2（2026-09-22）

実装したもの（所有: `src/render/VideoPass.ts`、`src/render/shaders/VideoShader.ts`、`src/ui/RecOverlay.ts`。記録 `docs/film-video.md`、画像 `docs/film-video/`）: 公開 API は不変。`VideoParams.frameBlend`（間引き時の残像 0〜0.5）と確認用 `forceJitter(frames)` / `forceHeadSwitch(frames)`、`RecOverlay.date`（既定 '2003.07.14'、'auto' で今日）/ `elapsed` を追加。

依頼（所有外）:

- **PostFX（統合）: composer の RT が 2× MSAA の HalfFloat で、後段の全 pass（GTAO / Bloom / Lens / Output）がそこへ書く。** VideoPass を置くと OutputPass が画面ではなく MSAA RT へ描き、解決（resolve）+ 16 MB の書き読みで whole-frame が 2.5〜4 ms 増える（LensPass 追加でも ≈1 ms。VideoPass 自体は 1080p で 0.2〜1.0 ms。`docs/film-video.md` §3）。
  案: (a) RenderPass だけ MSAA の専用 RT に描いて非 MSAA の composer RT へ 1 回コピー（CopyShader 0.2 ms）、(b) `EffectComposer` に渡す rt を非 MSAA にして RenderPass 側で MSAA → resolve、(c) OutputPass 以降は UnsignedByte で足りるので、VideoPass の入力だけ別の 8 bit RT にする。(a) か (b) が効く。
- **Game（F2）: 設定 `frameHold` で homeVideo / clean に間引きを強制するとき `frameBlend` も入れてほしい**（`video.params.frameBlend = 0.3` 程度。プリセット値 0 のままだと残像の無い純粋なコマ落ちになる）。tape は既に 0.3。
- **Game / スクリーンショット系（統合）**: `postfx.frozenSeed` に数値を入れると VideoPass はノイズの種を固定し、揺れ・ヘッド切替の新規イベントも起こさない（`force*` は数える）。比較画像を撮る経路があれば設定を。
- **RecOverlay の配置（F2）**: タイムコード（左下）はスマホの左スティック領域と視覚的に重なる（pointer-events は無効なので操作は妨げない）。スマホでは非表示にするか、位置を変えるなら `RecOverlay` 側で対応するので指示をほしい。
- **観察（統合）**: ホットリロード直後に 1 回だけ部屋が真っ暗（器具面が消え、ライトマップ無し）になり `GL_INVALID_OPERATION: Mismatch between texture format and sampler type` が 256 件出た。`film: 'off'` でも暗いままで再読み込みで解消（再現せず）。VideoPass 無しで起きるので別要因（depth / shadow / 整数テクスチャのサンプラ不一致）。

## 統合担当の処理記録（第9回・2026-09-22: 撮像効果）

反映済み:
- **土台（統合）**: `src/render/FilmPreset.ts`（off / clean / homeVideo / tape）、`LensPass`（OutputPass の前・線形 HDR）と `VideoPass`（OutputPass の後・表示域）を composer に配線、PostFX に `setCameraMotion` / `setAudioNoise` / `setStillness` / `notifyRoomEnter` を追加。旧 `AnalogCameraShader`（archival）は VideoPass に置き換え（設定 'archival' は homeVideo に読み替え）。
- **MSAA の限定（F1a / F1b の依頼）**: `MsaaRenderPass` でシーン描画だけを MSAA RT に描き 1 回 resolve、composer の ping-pong は非マルチサンプル・深度なし（後段 pass ごとの resolve 2.5〜4 ms を削減）。
- **F1a**（`LensPass.ts` / `shaders/LensShader.ts`、`docs/film-lens.md`）: 歪み・色収差・減光・軟焦点・開口部のにじみとハレーション・フレア・接写 DoF・フォーカスの迷い・かすみ・フリッカー・回転ブラー・露出 / WB の追従（2×1 Float RT の非同期読み戻し）。
- **F1b**（`VideoPass.ts` / `shaders/VideoShader.ts` / `ui/RecOverlay.ts`、`docs/film-video.md`）: 色調整・色差の横ぼかし・音量連動の暗部ノイズ・黒の浮き・ニー・走査線とコーミング・水平同期ずれ・ヘッド切替・間引きと残像・DCT・REC / タイムコード。
- **F2**（`Game.ts` / `PlayerController.ts` / `Settings.ts` / `SettingsPanel.ts` / `AudioEngine.ts`、`docs/film-camera.md`）: 設定 5 項目（プリセット既定 homeVideo・手持ち感・視線の遅れ・表示 fps・REC 表示）、歩行と呼吸の手持ち揺れ、視線の遅れ 50 ms、FOV ゆらぎ、回転速度と環境音の供給、静止 3 s の時間停止感、入室通知。
- **統合の追加**: GTAO 停止中（M13）は LensPass に深度 null を渡して自前深度へ、設定で間引きを強制したときは残像 0.3 を入れる。

未対応（次回へ）:
- 色収差は差分加算の近似（強い DoF / ブラー時に R/B の縁が硬い）。DoF の歩行中無効は深度の急変と回転で判定（並進速度の API 無し）。
- iOS Safari の非同期読み戻し未確認（失敗 3 回で追従停止・ゲイン 1）。mid Tier は自前深度パスが毎フレーム走る（+0.5 ms）。
- 手持ち感の横揺れ、ゲームパッドのドリフトで静止に入らない可能性、メニューの縦の長さ。DCT は粒子に埋もれてほぼ見えない。ヘッド切替を常時薄く出すかは演出判断待ち。

## 統合追加（2026-09-22: 暗さ・懐中電灯・VHS）

全室の基準露出を 0.55 に変更し、暗さを戻し過ぎない自動露出へ調整。Game に歩行揺れ／追従遅れ／影付きの常時携行ライトを追加。homeVideo / tape の撮像効果を強化。上記第9回以前のパラメータ値は実装当時の記録。現在値・検証・残課題は `visual-improvement-spec.md` 冒頭の「暗い基準露出・携行ライト・VHS強化」を参照。

## O3 → 統合（2026-09-22: 奇妙さ生成 surfaces.ts / traces.ts）

実装したもの（`src/generators/oddity/surfaces.ts` = `SURFACE_ODDITIES`、`src/generators/oddity/traces.ts` = `TRACE_ODDITIES`）:
- `surface.shallowPits`（theme / weight 4）/ `surface.ceilingGaps`（theme / weight 3）/ `surface.wallHoles`（weight 2）/ `surface.water`（weight 3）
- `light.mismatch`（theme / weight 3）/ `light.timeMix`（weight 2）/ `trace.marks`（theme / weight 3）

仕様からずらした点（要確認）:
- **`trace.marks` の category は `'contents'`**。`OddCategory` に `'trace'` が無いため（`shared.ts` は編集禁止）。結果として O2 の contents 系と添え物の枠を取り合う。`'trace'` を足すなら `shared.ts` 側の追加が要る。
- **天井の空隙に「裾」を 4 枚足した**。指示どおり穴の 0.35 m 上に `void` の板（各辺 +0.1 m）を置くだけだと、斜めから見たとき板の外側の明るい空が見えてしまう。天井スラブ上端（h+0.18）から板までを塞ぐ厚さ 0.02 の `void` を穴の周囲 4 辺に追加した（1 穴あたり +4 箱）。
- **ダクトは天井スラブに埋まる**。0.25 m 角を空隙（h+0.2〜h+0.35）に収められないので、y を h+0.06〜h+0.31 にして穴から見える部分だけ露出させている。穴の外側はスラブの中（非ソリッド）。
- **カートの箱は 9 個**。指示は「0.03 の枠 8 本 + ソリッドは外形の箱 1 つ」だが、外形の箱をソリッドかつ可視で置くと枠に見えないので、支柱 4 本をソリッド・上端の枠 4 本を非ソリッドにし、すり抜け防止に底の棚板 1 枚（ソリッド）を足した。`canPlace` は指示どおり外形の箱 1 つで確認している。
- **`surface.water` の weak は 1〜2 個**（theme: false なので strong は来ない。1 個だけだと弱かった）。

置けない / 出にくい条件:
- `surface.shallowPits`: 主矩形の短辺が 2.0 m 未満の部屋は `applicable` で除外。穴は各辺から 0.5 m 以上内側 + 扉前ゾーン + 既存ソリッドを避けるので、家具の多い部屋では strong でも 1〜3 個しか置けないことがある（動線は塞いでよい設定）。
- `surface.ceilingGaps`: 天井高 2.2 m 未満と天井シェルの無い部屋は除外。吊り下げ蛍光灯は器具箔の 0.5 m 下が 1.9 m 未満になる部屋では出ない（天井 2.5 m 級の部屋は空隙だけになる）。
- `trace.marks` の「引かれた椅子」が非常に稀（seed 11 の 499 部屋で 5 室、seed 23 の 303 部屋で 2 室）。`kind: 'chair'` の propGroup と、高さ 0.68〜0.80 m のソリッド天板が 2.2 m 以内に同居する部屋がほとんど無いため。机の天板の判定を広げるか、`furniture.ts` 側で机にも `kind: 'desk'` の propGroup を付けてもらえると増やせる。
- `light.timeMix` の窓差し替えは `windowNight` の箔が 2 枚以上ある部屋だけ（seed 23 で 2 室）。ほとんどは時計 3 個の側に落ちる。

見た目が弱いもの（統合側で調整してもらえると良い点）:
- **時計サイン（`kind: 'clock'`、width 0.45）の文字が小さく、2 m 先から時刻が読めない**。3 個並べても「小さい暗い板が 3 枚」に見える。clock の CanvasTexture の文字倍率を上げるか、width の下限を引き上げたい。
- **吊り下がった蛍光灯が「段差のある 2 枚のパネル」に見える**（箔 2 枚で傾きを近似しているため）。箔を回転できる手段（`DecalSpec.yaw` 相当か、箱の yaw）があれば本物の傾きにしたい。鎖（0.02 m 角）も細くてほぼ見えない。
- **壁の穴**は暗い部屋（C03 ビジネスホテル廊下など）では黒い `void` デカールが背景に溶けて判別できない。強い部屋（コインランドリー等）では良好。
- 浅い穴の黒い正方形デカール（抜けたタイル）は `tier.decals = false` の Tier では全部消える。穴本体は箱なので残る。

検証: `npx tsc --noEmit -p .` 0 エラー / `node tools/seam-stats.mjs --seeds 7,11,23 --rooms 40` で `deterministic=true` `overlap=0` / 実機 seed 7・11・23 で 7 種すべて出現、コンソールエラー 0。浅い穴は `devInput.moveY` で歩いて出入りできることを確認（y が −0.15 まで下がって戻る）。

## O2 → 統合（内容物の配置と欠落 / `src/generators/oddity/contents.ts` = `CONTENT_ODDITIES`）

実装したもの（7 種）:
- `contents.oneDeviation`（theme / weight 4）/ `contents.clusterAndVoid`（theme / weight 3）/ `contents.stacking`（theme / weight 2）/
  `contents.wallFurniture`（theme / weight 2）/ `contents.uniformFacing`（theme / weight 2）/ `contents.countAnomaly`（theme / weight 3）/ `contents.uselessFixtures`（theme 不可 / weight 3）

仕様からずらした点（要確認）:
- **`propGroup` の無い 1 箱家具もグループとして扱う**。`common.ts` の `furnishCafeteriaProps` は椅子・机を `kinded()` の 1 箱で置く（`propGroup` が無いので `propGroups()` に出ない）。`contents.ts` 内で `kind` が `chair` / `table` / `desk` / `bench` / `vending` / `cabinet` の単独箱を `solo#n` という擬似グループにして拾っている。`furniture.ts` 側でここにも `tagGroup` を付けてもらえれば擬似グループは不要になる。
- **ロッカーの kind は `'lockers'`**（指示の `'lockerBank'` は実在しない）。両方を受けるようにしてある。
- **集積（`clusterAndVoid`）の塊は最大 4.5 m 角に制限**。指示どおり全グループを格子に詰めると C09 の 238 脚が 17 × 22 の格子になって部屋をほぼ埋めたので、「一角」に収まるよう格子の辺を 4.5 m で打ち切り、入らない分は捨てている（例: C09 で 42/42、238 脚の部屋では 80 脚を残して 158 脚が消える = 空白になる）。
- **複製した家具の薄板を 10 cm まで厚くしている**（`detached(..., plump)`）。指示どおり `propGroup` を外すと `FurnitureShapes` の描き替えが効かず、素の箱（座面 4 cm・背 5 cm の薄板 + 3 cm の脚）になって「板」に見えたため、金属以外の薄い箱だけ 10 cm に膨らませた。壁付きの複製は膨らんだ分が壁に埋まらないよう室内側へ押し戻している。
- **`uniformFacing` のロッカーは 1 部屋 120 扉まで**（C11 は 480 扉あるため）。開いた中の暗い `void` 箔は先頭 60 扉だけ（箱予算 +150 を守るため）。
- **`countAnomaly` の非常口サインは 8 枚で打ち切り**（`pushSign` 自体の上限は 44 だが指示どおり 8 に自制）。
- **`uselessFixtures` の壁付け箔は `canPlace(..., { lanes: false })`**。非ソリッドなので動線帯は見ず、足跡・扉前ゾーン・既存ソリッドだけ見ている。

置けない / 出にくい条件:
- `contents.oneDeviation`: 椅子系グループ 6 つ以上、またはロッカーの扉 6 枚以上の部屋だけ。C09 / C10 / C11 / U06 / U13 に集中する。90°/180° 回転は連結椅子（2.0 m）では周囲に当たって落ちることが多く、その場合は「通路側へ 0.5〜0.7 m 出す」に落ちる。
- `contents.clusterAndVoid`: 椅子系 8 グループ以上か、商品らしい小箱 12 個以上。商品側の判定は「非ソリッド・`boxCardboard`/`plastic*`/`signPlate`・XZ 1.0 m 未満・高さ 0.8 m 未満・y 0.15 以上」。売場（C12 / C13 / U17 / R12）でよく出る。
- `contents.stacking`: ロッカーの横倒しは壁際 1.8 m の張り出しが `canPlace` を通らない部屋が多く、実際は「机の 2 段重ね」と「椅子 3〜5 脚の塔」がほとんど。机は `kind` が無い（`furniture.longTable` は `tagGroup` を呼ばない）ので高さ 0.68〜0.80 の天板で拾っている。
- `contents.wallFurniture`: 天井版は h − 0.85 が家具に当たらない部屋のみ。壁版は壁の空き区間 0.8 m 以上かつ `1.2 ≤ baseY ≤ h − 0.4 − 椅子の奥行` が成り立つ部屋のみ（天井 2.2 m 級の廊下では出ない）。
- `contents.uniformFacing`: 椅子は「向きが読める」グループ 6 つ以上（座 + 同じ材質の高い背が要る）。回転後に 70% 以上が成功しないと諦めて次の候補へ落ちる。
- `contents.countAnomaly`: 消火器は空き区間 4.3 m 以上、時計は 4.4 m 以上の壁が要る。無ければ非常口サインに落ちる（ほぼ全部屋で成立するので発生回数が多い。seed 7 / 11 / 23 の 120 部屋踏破で 68〜128 件）。weight を下げたい場合は統合側で調整可。

見た目が弱いもの（統合側 / 描画側に相談したい点）:
- **壁・天井に付けた椅子が「板」に見える**。`propGroup` を外すと `FurnitureShapes.chairGroup` の描き替えが効かず、素の薄板になる。10 cm に膨らませて多少改善したが、正面から見ると棚板のよう。描画側に「任意の姿勢の椅子」を描く入口（例: `kind: 'dress:oddChair'` + 向きベクトル）があれば大きく良くなる。天井吊り（上下反転）は脚が見えるので比較的読める。
- **押せない自販機ボタン（0.05 m 角 × 12）が小さく、明るい壁では飛ぶ**。指示どおり「機械本体は無い」ので後ろに板を置いていない。暗い裏板を 1 枚許してもらえれば読みやすくなる。
- **ロッカーの扉板 instance は当たり判定を持たない**（`spec(..., solid: false)`）。50〜80° 開いた扉の中をすり抜けられる。`InstanceSpec.solid` を true にすると yaw 込みの AABB（0.38 × 0.02 の外接 = ほぼ 0.3 m 角）がコライダになり通路を塞ぐので、意図的に非ソリッドにしている。
- **横倒しのロッカーは高さ 0.5 m のソリッド**で、`PLAYER.step`（0.35 m）を超えるため乗り越えられない。動線・扉前は `canPlace` で避けている。

検証: `npx tsc --noEmit -p .` 0 エラー / `node tools/seam-stats.mjs --seeds 3 --rooms 40` と `--seeds 7,11,23 --rooms 40` で `deterministic=true` `overlap=0`（`deadEnd=5` は本仕掛けを外しても同じ = 既存）。実機 seed 7 / 11 / 23 で 7 種すべて出現、コンソールエラー 0。

## O1 → 統合（間取りの不自然さ / `src/generators/oddity/layout.ts` = `LAYOUT_ODDITIES`）

実装したもの（6 種）:
- `layout.openingOffset`（theme / weight 3）: (a) 浮いた扉（幅 0.9 × 高 2.05、下端 0.4 m、枡 0〜0.05・扉板 0.05〜0.08・取っ手 metal）/ (b) 天井近くの小さな出口（0.6 角の `void` を壁面から 1 cm、周囲 4 本の `trim` 枡、上 0.12 m に幅 0.4 の緑 EXIT サイン。開口上端 = h − 0.3）/ (c) 突き当たりの横向き扉（`isCorridor` の短辺の壁に 2.05 × 0.9 を y 0.6〜1.5）。strong は (a) か (c) を正面 + 別の壁に (b)、weak はどれか 1 つ。
- `layout.roomInRoom`（theme / weight 2）: 主矩形 ≥ 60 m² かつ短辺 ≥ 7 m。2.5〜4.0 m 角・壁厚 `WALL_T`・高さ h か h − 0.4（5 割）。壁 4 枚（ソリッド・部屋の壁材）+ 天井板（非ソリッド、h − 0.4 のときだけ top〜top+0.12）。5 割で外壁との隙間 0.7 m。入口側の面に飾り扉 1 つ。最大 20 回試行、strong は最初の 16 回だけ `c.focus` 内に限定。
- `layout.steps`（theme / weight 3）: (a) 主矩形の長辺を半分に割り、ソケットの無い側に床材 0〜0.3 のソリッド + その中に完全に入る内装を `shifted(b, 0, 0.3, 0)` / (b) 廊下の 1.5 m 区間を `cutShell` で切って床上面 −0.15（厚 0.2）+ 切り口 2 辺に壁材の立ち上がり（非ソリッド）/ (c) 3 段上り（0.15 × 0.3 m）→ 1.2 m 踊り場（0.45）→ 2 段下り、計 2.7 m。strong は (c) → (a)、weak は (b) → (a)。
- `layout.windowInward`（theme 不可 / weight 2）: 3 割で夜景箔を短くして残りを壁材で塞ぐ（壁材は窓の奥面から室内側 +0.24、ただし内面 +0.08 で頭打ち）/ 7 割で夜景 → `void` + 2 cm 手前に `glass` + 0.6 cm 手前に幅 60% × 高さ 0.06 の `lightWarm` 帯。
- `layout.corridorTaper`（theme / weight 2）: `isCorridor` かつ内法幅 ≥ 2.2 m。長辺の両面に 1 m 刻みの壁（床〜天井・ソリッド）を足して最狭 1.3 m まで絞る。strong は入口側から奥へ線形に、weak は中央 ±2 m だけ最大厚。
- `layout.pillars`（theme / weight 2）: strong は 4 割で (d) 天井から下がって下端 0.45 m の柱、外れたら (a)+(c) 天井 −0.35 の孤立柱。weak は 6.5 割で (b) 既存の `columnConcrete` 柱（4 本以上あるとき）を 0.6〜0.9 m ずらす、外れたら (c)。

仕様からずらした点（要確認）:
- **壁に密着する箱は `canPlace(..., { margin: WALL_T - 0.001 })`**。`canPlace` の既定 margin は `WALL_T + 0.02` なので、壁面に貼り付く `corridorTaper` の絞り壁は既定では必ず落ちる（最初の実装では 1 本も置けなかった）。
- **`corridorTaper` の隣り合う 1 m の箱は `ignore` で自分同士を無視**。`canPlace` の `gap`（既定 0.05）は接している箱を重なりと見なすため、無視しないと 1 個おきにしか置けず櫛状になる。
- **`steps` (a) の段差板は `canPlace(..., { lanes: false, ignore: () => true })`**（足跡と扉前ゾーンだけ見る）。上げる側の内装は一緒に 0.3 m 持ち上げるので既存ソリッドとの重なり判定は無意味。分割線を 0.15 m 超えてまたぐソリッド内装がある比率（0.5 → 0.45 → 0.55 → 0.42 → 0.58）は飛ばす。
- **`steps` (a) は `instances` と `decals` を持ち上げていない**。`L.instances` のロッカー扉や床デカールが上がった半分にあると床に埋まる。統合側で「矩形内の instance を y+0.3」する共通ヘルパがあると正確になる。
- **飾り扉の枡は `y0 − 0.065` が負にならないよう `Math.max(0, ...)`**。横向き扉（y0 = 0.6）や浮いた扉（y0 = 0.4）では素直に下へ 6.5 cm 伸ばしている。

置けない / 出にくい条件:
- `layout.roomInRoom`: 主矩形 ≥ 60 m² かつ短辺 ≥ 7 m の部屋だけ。C11 / C15 のような細長い大部屋では 20 回試して全滅し `roomInRoom: no space` のログが残る（主に既存家具と動線帯に当たる）。
- `layout.corridorTaper`: 廊下（短辺 ≤ 3.2 m・長辺 ≥ 8 m）かつ内法幅 ≥ 2.2 m。実質 C01 / C04 / C05 / C17 級のみ。ソケットが多い廊下では `freeRuns(f, sockets, 0.8)` が細切れになり、weak（中央 4 m）で 1 箱しか置けないことがある（例: seed 7 の C17 で `4 m pinch to 1.3 m (1 boxes)`）。幅を絞る演出としては弱いので、1 箱しか置けないときは諦めて別の仕掛けに落とす方が良いかもしれない。
- `layout.steps` (b)(c): 廊下かつ全ソケットから 2 m 以上離れた 1.5 m / 2.7 m の帯が要る。短い廊下（長辺 < 6 m / < 4.7 m）では出ない。
- `layout.steps` (a): ソケットが分割線の両側にある部屋は不可（廊下の途中に扉がある部屋はほぼ全滅）。実際に出るのは端に扉が寄った大部屋（C09 / C14 / U02）。
- `layout.windowInward`: `mat === 'windowNight'` の箔がある部屋だけ（C08 / C09 / R05 など）。踏破 505 部屋で 3〜4 件と少ない。
- `layout.pillars` (b): 天井まで届く `columnConcrete` のソリッド柱が 4 本以上ある部屋だけ（駐車場・倉庫系）。

見た目が弱いもの（統合側 / 描画側に相談したい点）:
- **U09 の部屋では奇妙さの箱が全部消える**。seed 7 の r174 / r291 / r301 / r732 / r842 / r2994（すべて U09）は `notes` に仕掛けが載っているのに最終レイアウトの `kind` が全滅（`dress:odd` が 0 個、家具の `kind` も全部 undefined）。U09 に掛かる Modifier がレイアウトを作り直していると思われる。**これは layout 以外のカテゴリも同じはず**なので統合側で確認してほしい。
- **`steps` (b) の 1 段下がり（0.15 m）は明るい廊下だと目立たない**。切り口の立ち上がりを壁材にしているが、床材と近い色だと段差に見えない。切り口だけ暗い材（`metalDark` など）にする案がある。
- **`pillars` (b) 格子からずれた柱は、柱が 4 本（2 × 2）しかない部屋だと「格子」に見えず気づけない**。6 本以上を条件にした方が効くかもしれない。
- **`openingOffset` (b) の EXIT サインは幅 0.4 m で文字が小さい**（`SignAtlas` は width × 1/4 の高さ）。開口が 0.6 m 角なので釣り合いは取れているが、遠目では緑の板に見える。
- **飾り扉の材質は `L.palette.door` そのまま**なので、本物の扉と区別が付かない部屋がある（浮いた扉は下端 0.4 m で違和感が出るが、横向き扉は「横長のパネル」に見えることがある）。Modifier 側で「偽扉を数える」処理（DuplicateNumber 等）がこの扉も数えることになる点も確認してほしい。

検証: `npx tsc --noEmit -p .` 0 エラー / `node tools/seam-stats.mjs --seeds 3 --rooms 40` と `--seeds 7,11,23 --rooms 40` で `deterministic=true` `overlap=0` `loadMismatch=0/0`（`deadEnd=5` は `LAYOUT_ODDITIES` を空にしても同じ = 既存）。実機 seed 7 で (a) 浮いた扉 = r125 C07 / (b) 天井近くの出口 = r1 C02 / (c) 横向き扉 = r1 C02 / 部屋の中の部屋 = r116 C16 / 階段 = r10 C08 / 1 段下がり = r46 C05 / 半分高い床 = r745 C09 / 内側を向く窓 = r70 C09 / 廊下の絞り = r49 C17 / 天井に届かない柱 = r97 C06 を目視確認、コンソールエラー 0。seed 7 / 11 / 23 で 6 種すべて出現。


## 統合担当の処理記録（第10回・2026-09-22: 奇妙さ生成）

- **土台**: `src/generators/oddity/`（index / shared + layout / contents / surfaces / traces）。予算表と主題の規則は `docs/oddity.md`。RoomBuilder に `kind: 'emitOnly'`（描かない光源）。
- **O1 / O2 / O3** の 20 種を統合。`trace` カテゴリ追加、`countAnomaly` 重み 2、MirrorOffset の clipBox / reflectBox で kind を保持（U09 で箔が消える問題）。
- 未対応: `steps`(a) の instances / decals の持ち上げ、任意姿勢の椅子の描画（壁・天井の椅子が板に見える）、`common.ts` の椰子・机への propGroup 付与、時計サインの可読性、吊り灯の傾き（箔の yaw）。
