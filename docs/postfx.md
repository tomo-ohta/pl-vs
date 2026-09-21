# ポスト処理・トーンマップ・露出・影・撮像プリセット（担当 P、2026-09-16〜17）

対象: `src/render/PostFX.ts`（新規）、`src/render/shaders/AnalogCameraShader.ts`（新規）、`src/game/Game.ts`、`src/core/types.ts`（QualityTier）、`src/core/Settings.ts`、`src/ui/SettingsPanel.ts`、`src/render/LightBudget.ts`、`src/streaming/RoomStreamingManager.ts`。
three.js 0.186 付属の `three/addons/postprocessing/*` だけを使う（外部パッケージなし）。

## 1. パイプライン

```
renderer.render 相当（毎フレーム Game.renderFrame → PostFX.render）
  RenderPass            scene → HalfFloat RenderTarget（MSAA samples = Tier.postfx.msaa。線形、トーンマップなし）
  GTAOPass              法線 / 深度パスを Tier.postfx.gtaoScale（0.5）の解像度で描き、AO を計算・Poisson デノイズ → 乗算合成（scene.background は法線パスの間だけ外す）
  UnrealBloomPass       閾値 1.1・強度 0.22・半径 0.35。明部抽出とミップ鎖は実解像度 × 1/2 → 1/4 から（発光箔 emission 2.3〜2.8 だけが滲む。壁面 < 1.0 は対象外）
  ShaderPass(Analog)    設定 postfx = 'archival' のときだけ（線形 HDR のまま。§5）
  OutputPass            renderer.toneMapping（AgX）+ sRGB 変換を **ここで 1 回だけ**
```

- トーンマップの二重適用はしない: three.js は RenderTarget へ描く材質のトーンマップと出力色空間変換を自動で無効化する（`WebGLRenderer.getProgram` の `toneMapping` / `outputColorSpace` は画面描画時のみ有効）。`renderer.toneMapping` は直接描画では材質側で、composer 使用時は OutputPass だけで働く。
- `Tier.postfx` の gtao / bloom が false で msaa = 0、かつ撮像 pass が無いときは composer を作らず `renderer.render` で直接描画する（low Tier と設定「オフ」）。
- resize / DPR / Tier / 設定変更: `Game.resize` → `PostFX.setSize`（RenderTarget と各 pass を整数ピクセルで作り直す。375 css px × 1.5 = 562.5 のような端数を作らない）。pass 構成や MSAA が変わるときは `PostFX.configure` が composer を dispose して作り直す（`PostFX.dispose` で全解放）。Tier を low → mid → high と 3 周しても `renderer.info.memory.textures` は 29 / 43 / 50 で一定。
- 影マップの更新は `renderFrame` でだけ（`shadowMap.autoUpdate = false` + フレーム先頭で `needsUpdate = true`）。SnapshotService の RT 描画や GTAO の法線パスでは再描画しない。
- `renderer.info` は `autoReset = false` にしてフレーム先頭でリセットし、影パス・法線パス・全 pass を合算した draw calls をデバッグ HUD に出す。
- HUD / ミニマップ / メニューは DOM なので撮像効果の外側。

## 2. トーンマップ: AgX を採用（ACES Filmic から変更）

同じ視点（C02 / C09 / C06、high、露出 1.0）で `settings.toneMapping` を切り替えて比較した（画像は `docs/visual-postfx/`。§11）。

| 観点 | ACES Filmic | AgX（採用） |
|---|---|---|
| 彩度 | 暖色の床（C09 のヘリンボーン）と黄色帯（C06 柱）が橙〜黄に寄る | 低彩度のまま。参考資料の「彩度は低く、差し色 1 つ」に合う |
| 発光箔（器具） | 白に張り付き、縁が硬い | 滑らかにロールオフし、bloom の滲みが段階的に見える |
| 暗部・霧 | 暗部を締めて青みが付く（fog 0x262a28 が #13 前後まで沈む） | 霧色をほぼ設計値で保つ（#1f 前後）。突き当たりのグレー階調が残る |
| 総合 | コントラストが高く「ゲーム的」 | 少し眠いが、古い撮像・低彩度の方向性に合う |

副作用: AgX は同じ露出で中間調がわずかに暗い。露出は 0.9 ではなく **1.0**（旧 1.25）にして、L1 の焼き込み調整（器具直下 : 器具の間 : 突き当たり ≈ 1 : 0.45 : 0.15）が入る前でも経路が読めるようにした。切替は設定パネル「トーンマップ」（開発用）に残し、`Settings.toneMapping`（既定 'agx'）で永続化する。

## 3. 露出と霧

- `renderer.toneMappingExposure = 1.0`（`PostFX.DEFAULT_EXPOSURE`）。
- `scene.fog`（`Game.applyEnvironment` の既定値。部屋別 fog / `layout.fogFar` / FogDepth があればそれを優先し、far は Tier の `fogFar` でクランプ）:

| Tier | fogNear | fogDefaultFar | fogFar（クランプ・チャンク表示） |
|---|---|---|---|
| low | 6 | 40 | 40 |
| mid | 6 | 44 | 60 |
| high | 6 | 48 | 90 |

旧: near 12 / far = fogFar（90）。霧色は palette.fog（既定 0x0b0d14）のまま。

注意（three.js の仕様）: 画面へ直接描くとき `fog_fragment` は**出力色空間（トーンマップ後）**で混ぜるが、RenderTarget へ描くときは**線形**で混ぜてから OutputPass でトーンマップする。同じ near / far でも composer 使用時のほうが知覚的に霧が薄い（C09 の突き当たり: 直接描画は暗いグレー、composer では明るめのグレー）。上の値は composer（mid / high）で「突き当たりが沈む」ように選び、直接描画の low はやや濃く見える（fogFar 40 のカリングに合わせて 40 m で 100%）。L1 の焼き込みが入った後に再調整する前提。

部屋別 fog（MaterialLibrary の roomFog、FogDepth 案 B）は uniform 色が sRGB 固定なので、composer 使用時は霧が明るく浮く。`RoomStreamingManager.fogColorSpace`（'linear' / 'srgb'）の shim が `renderer.properties.get(material).uniforms.roomFogColor` の Color を変換して合わせている（R06 で確認: 線形 0.0103 ↔ sRGB 0.102、突き当たりと背景の色が揃う）。MaterialLibrary 側で `linearToOutputTexel` を使う恒久対応を `docs/visual-requests.md` に依頼済み。反映されたら shim を削除する。

## 4. 影

- `renderer.shadowMap.enabled = true`、`PCFSoftShadowMap`。PointLight の影は three.js 0.186 ではキューブ深度テクスチャ（各面 mapSize²、6 面）。
- **影スロット**（`LightBudget.ts` の `ShadowSlots`、`RoomStreamingManager.updateLights`）: 点灯中（`updateLightBudget` の desired）の可視 PointLight のうちプレイヤーに近い `Tier.shadowLights` 灯（mid 1 / high 2 / low 0）だけ `castShadow = true`。mapSize 1024（high）/ 512（mid）、camera.near 0.3（far は three が `light.distance` に合わせる）、bias −0.004、normalBias 0.04、radius 1.5。
- ヒステリシス（V04 手順 7）: 挑戦者は最も遠い保持ライトの距離² × 0.6（距離で約 0.77 倍）より近く、それが 0.4 s 続いたときだけ交代を始める。交代は「保持側の `shadow.intensity` を 0.35 s で 0 へ → castShadow を外す → 挑戦者に castShadow を立てて 0 → 1 へ 0.35 s」。同時に 1 件だけ。退出中（減衰中）のライトは先に影を消す。
- 影を落とすライトの**本数を Tier の値に固定**する: three.js は `numPointLightShadows` もプログラムキーに含めるため、本数が揺れると画面内の全材質が再コンパイルされる。実ライトが不足する分はダミー（`padVisibleLights`。intensity 0、遠方、16 px のキューブ影を最初に 1 回だけ描いて以後更新しない）に castShadow を立てる。C02 を 20 m 歩く検証で castShadow 総数は常に 2、`renderer.info.programs.length` は 76 → 76（再コンパイルなし）、受け渡し 1 回 + 進行中 1 回、最小 shadow.intensity 0.1（フェードが働いている）。
- 影マップの解放: 部屋の evict / rebuild / clear とスロット解放時に `shadow.map.depthTexture.dispose()` + `shadow.map.dispose()`（`RoomBuilder.dispose` は light.shadow.map を見ない）。同 seed で `newWorld` を 5 回繰り返しても geometries 30 / textures 58 / programs 56 で一定。
- **Mesh 側の castShadow / receiveShadow は L1（RoomBuilder）が立てる。** 立っていない現状では影は描かれない。検証では `scene.traverse` で発光材質以外の Mesh に一時的に立てた（C09 195 個、C06 268 個、C11 104 個）。器具の筐体を caster にすると光源が筐体内にあるため全方向が遮蔽される点を依頼に書いた。

## 5. 撮像プリセット（V07 の最小実装）

`Settings.postfx: 'off' | 'clean' | 'archival'`（既定 'clean'）。設定パネル「描画効果」。Tier とは独立。

| 値 | 内容 |
|---|---|
| off | 直接描画（composer 無し。Tier に関わらず GTAO / bloom / MSAA RT も無し） |
| clean | Tier の gtao / bloom / msaa だけ（撮像 pass なし。素材品質の確認用の基準） |
| archival | clean + `AnalogCameraShader`（OutputPass の前、線形 HDR のまま） |

`AnalogCameraShader` の内容と既定値（`ANALOG_PRESETS.archival`。`game.postfx.analog` で実行中に変更可）:

| 効果 | 実装 | 既定 | 範囲（仕様 V07 手順 5） |
|---|---|---|---|
| 暗部に偏る微粒子ノイズ | 出力ピクセル座標 + seed のハッシュ。知覚域（pow 1/2.2）で加算、暗部 1.0 / 明部 0.35 の重み | 0.012 | 0〜0.015 |
| 弱い彩度低下 | 輝度との mix | 0.10 | — |
| 周辺減光 | アスペクト補正した半径² の smoothstep(0.12, 0.85) | 6% | 0〜8% |
| 色成分だけの微小ずれ | R / B を画面中心から放射方向に逆向きにずらす。1080p 基準 px を実解像度に換算 | 0.35 px | 0〜0.5 px |

- 走査線・画面歪み・追従遅延・手ブレ・周期的な暗転は入れていない（手順 6）。
- 知覚域での加減は近似で、出力変換（トーンマップ + sRGB）は OutputPass の 1 回だけ（手順 2・3）。
- ノイズは `gl_FragCoord` 基準なので解像度・DPR で振幅が変わらず、seed は毎フレーム更新。スクリーンショットは `game.postfx.frozenSeed = 17` で固定できる（手順 7）。
- 確認: C02 / C11 で扉・段差・サインが読める。効果は 0.5 倍縮小の JPEG ではほぼ判別できない程度（原寸で周辺減光と粒子が分かる）。

## 6. Tier 別の機能

| Tier | 描画 | GTAO | bloom | MSAA | 影ライト / mapSize | DPR 上限（composer 時） | 内部解像度（1280×720 css、DPR 2） |
|---|---|---|---|---|---|---|---|
| low | 直接描画 | – | – | –（canvas の antialias） | 0 | –（2 × renderScale 0.65） | 1664×936 |
| mid | composer | – | ○ | 2 | 1 / 512 | 2 × renderScale 0.8 | 2048×1152 |
| high | composer | ○（×0.5） | ○ | 4 | 2 / 1024 | **1.5** × renderScale 1.0 | 1920×1080 |

`QualityTier.maxPixelRatio` を追加した（composer 使用時だけ効く。直接描画は従来の上限 2）。high で DPR 2 のまま（2560×1440）だと下記のとおり GPU 22〜25 ms になるため、MSAA 4 で補って 1.5 に抑えた。1× ディスプレイの PC には影響しない。

## 7. 計測

環境: macOS、Chrome（Claude Browser ペイン）、1280×720 css / DPR 2、high、seed 7。GPU 時間は `EXT_disjoint_timer_query_webgl2`（`game.perf()` / デバッグ HUD の `render cpu … gpu …`）、CPU は `renderFrame` の所要時間。**他の担当のタブが同時に描画・シェーダコンパイルしていたため中央値は大きく揺れる（min の 2〜3 倍）。パイプライン固有の負荷は min（80 フレーム）を基準に読む。**

変更前（直接描画、ACES、露出 1.25、2560×1440、影なし。20 フレームの中央値）:

| 部屋 | GPU ms | CPU 送信 ms | draw calls |
|---|---:|---:|---:|
| C02 | 3.7 | 0.1 | 17 |
| C09 | 11.5 | 0.4 | 128 |
| C06 | 14.8 | 1.3 | 466 |
| C11 | 5.0 | 0.1 | 19 |

変更後（high = GTAO×0.5 + bloom + MSAA 4 + 影 2 灯、AgX、露出 1.0、**1920×1080**。GPU は min / p25 / 中央値）:

| 部屋 | 条件 | GPU ms | CPU ms | draw calls（影・法線パス込み） |
|---|---|---:|---:|---:|
| C02 | clean（Mesh の影なし） | 15.1 / 17.5 / 20.1 | 0.2 | 154 |
| C02 | archival | 11.5 / 16.0 / 17.8 | 0.3 | 155 |
| C02 | off（直接描画 2560×1440） | 6.4 / 11.9 / 15.6 | 0.1 | 118 |
| C09 | clean + Mesh 195 個が caster | 16.5 / 26.0 / 28.2 | 1.2 | 434 |
| C09 | 同・影ライト 0 | 15.6 / 21.4 / 25.3 | 0.4 | 231 |
| C06 | clean + caster 268 個 | 16.6 / 21.4 / 25.0 | 2.2 | 1067 |
| C06 | off（直接描画 2560×1440）+ 影 2 灯 | 15.3 / 35.0 / 45.3 | 9.1（コンパイル込み） | 793 |
| C11 | clean + caster 104 個 | 12.8 / 14.4 / 15.2 | 0.3 | 182 |

要素別（C02、2560×1440、min）: 直接描画 2.7〜4.3 / HalfFloat RT + OutputPass 5.6 / MSAA 2 4.0 / MSAA 4 7.4 / GTAO×0.5 7.6 / GTAO×0.35 6.6 / bloom（当時は 1/2 基準）10.2 / GTAO + bloom + MSAA 4 + 影 2 灯 24.6 / GTAO + bloom + MSAA 2 + 影 1 灯 15.7。この結果から bloom の基準解像度を 1/2 → 1/4 に、high の DPR 上限を 1.5 にした。

結論: 1920×1080 では high の min が 13〜17 ms で 16 ms の境目。他タブの負荷が無ければ余裕が見込めるが保証はしない。次の調整ノブは `Tier.postfx.gtaoScale`（0.5 → 0.35 で約 −1 ms）、`postfx.msaa`（4 → 2 で約 −1.5 ms）、`maxPixelRatio`（1.5 → 1.25 で約 −30%）、L1 側の caster の間引き（C06 の影パスは 6 面 × 2 灯で +270 calls）。自動 Tier は平均 34 ms 超で mid へ落ちる（従来どおり）。

メモリ: Tier 3 周で textures 29 / 43 / 50 一定、同 seed `newWorld` × 5 で 30 / 58 / 56（geometries / textures / programs）一定。踏破 10 部屋後 textures 175〜187、programs 167〜219（材質バリアントの増加。MaterialLibrary の LRU 管理下）。

## 8. 検証

- `npx tsc --noEmit -p .`: 担当 P のファイルはエラー 0（同時作業中の `src/generators/*`、`src/render/MaterialLibrary.ts` に他担当の一時的なエラーあり）。`node --experimental-strip-types tests/light-budget.mjs` 通過（`updateLightBudget` は戻り値に desired 集合を返すよう拡張、互換）。
- ブラウザ（`?nolock=1&new=1&seed=7`、`&force=C09 / C06 / C11 / R06`）: ACES / AgX、GTAO on / off、bloom on / off（構成切替）、archival on / off、影 on / off（Mesh の castShadow を一時的に立てる）のスクリーンショット比較。resize（375×812 → 1280×720）で canvas / composer RT / GTAO / bloom の寸法が追従（1920×1080 / 960×540 / 480×270）、Tier 切替 3 周・`newWorld` 5 回でエラー 0・リークなし。seed 7 / 11 / 23 × 10 部屋の踏破（`game.step` 同期）で `world.log` の ERROR 0、入室前後で boxes 数が変わった部屋 0、castShadow 総数 2 で不変。
- GL エラー: 踏破中に `INVALID_VALUE` を観測したが、全 gl 呼び出しを計装して特定した発生源は three.js の `texSubImage2D(HTMLImageElement 1024² / 512²)`（既存テクスチャの image を別寸法の画像に差し替えた後の再アップロード = 材質側）。composer / 影 / Tier 切替 / newWorld を計装した再現では 0 件。`docs/visual-requests.md` で M に報告。

## 9. V07 手順との対応

| 手順 | 状態 |
|---|---|
| 1 clean / archival、強度 0 で OFF、Tier とは別設定 | 済（'off' も追加。Settings.postfx） |
| 2 scene → bloom → 色調整 → OutputPass の順、出力変換を再実行しない専用 pass | 済（GTAO を bloom の前に追加） |
| 3 トーンマップと sRGB は 1 回、clean の明るさ維持 | 済（露出は 1.25 → 1.0 に意図的に下げた。§2） |
| 4 暗部ノイズ・彩度低下・周辺減光・色ずれ | 済 |
| 5 調整値の範囲 | 済（既定は範囲の中央付近） |
| 6 走査線・歪み・遅延・手ブレ・暗転は 0 | 済（実装していない） |
| 7 HUD は外側、seed 固定 | 済（`frozenSeed`） |
| 8 resize / DPR / 品質変更 / dispose / 直接描画フォールバック | 済 |

## 10. 未対応・保留

- Mesh の castShadow / receiveShadow（L1）。器具筐体の除外、caster の間引き。
- roomFog の色空間の恒久対応（M）。反映後に `RoomStreamingManager` の shim を削除。
- `toneMapped: false` の材質（板サイン）は composer 使用時にトーンマップされる（AgX で白が約 0.8）。板サインの自己発光の再調整は M / D 側。
- SMAA は未導入（MSAA 4 で十分と判断。スペキュラのエイリアスが気になれば `SMAAPass` を OutputPass の前に追加できる）。
- GPU 時間は他タブとの競合下の計測。単独環境と実機スマホでの再計測、p95 と長時間の増加傾向は未実施（V08 手順 1・2・7）。
- 自動 Tier の閾値は従来のまま（composer 導入で high の負荷が上がったので、平均 34 ms 超 → mid の閾値見直しは検討）。
- 部屋別の露出 / 霧の再調整は L1 の焼き込み（1 : 0.45 : 0.15）が入ってから行う。

## 11. 比較画像（`docs/visual-postfx/`、canvas を 0.5 倍に縮小した JPEG。HUD なし、`frozenSeed = 17`）

作業中に他担当が壁材質・パレットを差し替えていたため、**同じファイル名の組（同じページ読み込み内）だけ**を比較する。before-* は変更前（ACES、露出 1.25、直接描画、2560×1440、near 12 / far 90）。

| 比較 | 画像 |
|---|---|
| 変更前 | `before-C02.jpg` / `before-C09.jpg` / `before-C06.jpg` / `before-C11.jpg` |
| AgX vs ACES（C02、2560×1440、同材質） | `C02-agx.jpg` / `C02-aces.jpg` |
| off / clean / archival（C02、1920×1080 と 2560×1440） | `C02-off.jpg` / `C02-clean.jpg` / `C02-archival.jpg` |
| 影あり / なし・GTAO なし・ACES（C09、Mesh 195 個が caster） | `C09-clean-shadows.jpg` / `C09-clean-noshadow.jpg` / `C09-clean-nogtao.jpg` / `C09-clean-aces.jpg` |
| AgX vs ACES、直接描画（C06） | `C06-clean-agx.jpg` / `C06-clean-aces.jpg` / `C06-off.jpg` |
| GTAO あり / なし（C11） | `C11-clean.jpg` / `C11-nogtao.jpg` |
| 部屋別 fog の shim（R06、composer / 直接描画） | `R06-clean.jpg` / `R06-off.jpg` |

## 12. 水面の透過パスと霧の順序（P2、2026-09-21）

- `water` / `waterShallow` / `waterWall` が `MeshPhysicalMaterial`（transmission）になった（`docs/material-variation.md` 11.4）。three は透過物が見えるフレームで不透明物を transmission RT にもう 1 回描く（`renderer.transmissionResolutionScale` は既定 1.0。ガラスが見える部屋では従来から発生）。GPU が厳しければ `transmissionResolutionScale = 0.5` を Game 側で設定できる（水面のぼかしが粗くなるだけ）。
- RenderPass の RT へ描くときも透過パスはカメラごとの RT に描かれ、GTAO の法線パス（overrideMaterial）では省かれる。
- 霧の順序: 夜景（`windowNight` の emissive）と水面はどちらも `fog_fragment`（scene.fog）→ roomFog（`linearToOutputTexel` 後の mix）の順で霧に沈む。雨の Points は材質側で霧を受けないので、遠い雨は霧に沈まない（M18 では窓まで 3.5 m なので目立たない）。
