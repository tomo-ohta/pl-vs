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
