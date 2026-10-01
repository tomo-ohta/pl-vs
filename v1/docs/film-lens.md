# 撮像系 pass（LensPass）: 方式・数値・確認結果（担当 F1a、2026-09-22）

対象: `src/render/LensPass.ts`（統合のスタブを実装）、`src/render/shaders/LensShader.ts`（新規）。PostFX の配線（`src/render/PostFX.ts`）は統合担当のまま。
composer の並び: RenderPass → GTAOPass → UnrealBloomPass → **LensPass** → OutputPass（AgX + sRGB）→ VideoPass（F1b）。LensPass は線形 HDR の
`readBuffer.texture` を読み `writeBuffer` に書く。トーンマップ・出力変換はしない。

## 1. 構成

```
render(renderer, writeBuffer, readBuffer)
  [深度]   setDepthTexture(t) が null で dof / haze > 0 のときだけ: scene を半解像度（DEPTH_SCALE 0.5）の DepthTexture 付き RT に
           MeshDepthMaterial（colorWrite false、DoubleSide）の overrideMaterial で描く。GTAO の深度（GTAOPass.depthTexture、0.4 解像度）があればそれを使う
  [1/4]    LensDownsampleShader: 入力を 4 タップの箱型で 1/4 に（HalfFloat）。にじみと統計の共通入力。glow / flare / autoExposure / autoWhiteBalance / haze / dof のどれかが > 0 のとき
  [1/8]    LensBrightShader: 1/4 → 1/8 + 明部抽出（閾値 0.8、膝 0.5）→ LensBlurShader（分離ガウス 5 タップ、spread 1.5）を H/V 2 往復（A ⇄ B のピンポン）
  [フレア] 1 往復目の後に LensFlareShader（1/8 → rtFlare）: 横ストリーク 13 タップ + 中心対称ゴースト 2 個。flare > 0 のとき
  [統計]   4 フレームごと（読み戻しが宙に浮いていないとき）: LensStatShader（1/4 → 固定 32×18、セル内 4×4 の層化タップ、rgb = 平均色、a = log2 輝度の平均）
           → LensReduceShader（→ 2×1 Float RT。px0 = 全体平均、px1 = 視線中央 5 点の距離 min / mean）→ renderer.readRenderTargetPixelsAsync（PBO + fenceSync。同期読みは使わない）
  [合成]   LensCompositeShader を 1 枚（writeBuffer か画面）
```

RT: quarter / eighthA / eighthB / flare は HalfFloat・Linear、stat は 32×18 HalfFloat、reduce は 2×1 Float（`EXT_color_buffer_float` が無ければ HalfFloat を `DataUtils.fromHalfFloat` で復号）、
depth は UnsignedByte 色 + `DepthTexture(DepthStencilFormat / UnsignedInt248Type)`。`setSize` で作り直す（stat / reduce は固定）。`dispose` で全部解放。
uniform への反映は `update(dt, frame)`（CPU だけ）、GPU の描画は `render`。強さ 0 の効果は RT の描画を飛ばし、合成シェーダ内も uniform の分岐で飛ばす（全画面一様なので実質スキップ）。

## 2. 効果ごとの方式と数値（`LENS_TUNING` と LensCompositeShader）

| # | 効果 | param | 方式 | 数値 |
|---|---|---|---|---|
| 1 | レンズ歪み | `distortion` = k1 | 出力座標 p（アスペクト補正）で `src = p (1 + k1 r²) · s`。樽型（端の直線が外に膨らむ） | s = 1 / (1 + k1 rc²)、rc² = (aspect² + 1) / 4。四隅がちょうど元画像の隅に載るので欠けが出ない（16:9・k1 0.03 で 3.0% 縮小、辺の中央は 2.3%） |
| 2 | 色収差 | `chroma` px @1080p | 中心からの放射方向に R を +off、B を −off で読み、中心タップとの差分をぼかし結果に足す（3 回ぼかさない近似） | off = (src − 0.5) × chroma·2/‖resolution‖ → 四隅でちょうど chroma px。実 px は height/1080 で換算 |
| 3 | 周辺減光 | `vignette` | 楕円 rr = ‖(uv − 0.5)·2‖² / 2 の `smoothstep(0.1, 1.0, rr)` | 四隅で vignette、辺の中央で約 0.4 倍 |
| 4 | 軟焦点 | `softFocus` px | ぼかし核の半径 R < 1.25 px: 対角 4 タップ ±(a ± b)（線形補間で 3×3 テント相当） | 0.5 px（homeVideo）/ 0.7 px（tape）。回転ブラー・迷い・DoF と同じ核（下記） |
| — | 共通ぼかし核 | — | 軸 A / B（px）で楕円に伸ばす。R ≥ 1.25 px は中心 0.2 + 内リング 0.55R × 4（0.125）+ 外リング R × 4（0.075）の 9 タップ | A = 速度方向 × (soft + hunt + motion/2)、B = 直交 × (soft + hunt)。DoF の錯乱円は両軸に足す |
| 5 | にじみ + ハレーション | `glow`, `halation` | 明部抽出は Unity 型の二次の膝（閾値 0.8・膝 0.5 → 0.3〜1.3 を立ち上げ、以上は輝度 − 0.8 の分だけ通す）。1/8 でガウス 2 往復（σ ≈ 3.8 texel ≈ 30 px @1080p、裾 ±90 px）。`col += glow · mix(g, lum(g)·(1.45, 0.9, 0.5), halation)` | glow 0.35 / 0.45。C01 の器具面は 1/4 平均で最大 1.46（資料の 2.3〜2.8 より暗い）なので閾値 1.0 では効かず、0.8 に下げた |
| 6 | レンズフレア | `flare` | ガウス 1 往復後の明部から、横 13 タップ（間隔 3 texel = 24 px、重み 1/(1 + 0.7\|k\|)、STREAK_GAIN 1.2、やや寒色）+ ゴースト（中心対称に 1.8 倍 / 3.2 倍縮小、寒色 0.30 / 暖色 0.20、元座標が画面外の部分はマスク） | flare 0.3。間隔 5 texel ではコム状の段が見えた |
| 7 | 接写 DoF | `dof` | 統計の px1（中央 5 点の最小距離）を CPU で見て、DOF_NEAR 0.9 m 未満・急変（0.2 m / 統計間隔）や回転（0.5 rad/s）や入室直後（0.35 s）でなければ有効。`coc = dofAmount · 3 px · smoothstep(1.3 f, 4 f, dist)`（f = 焦点距離 m） | フェード τ 0.25 s、焦点の追従 τ 0.15 s。並進速度は PostFX から来ないので深度の急変で判断 |
| 8 | フォーカスの迷い | `focusHunt` | `notifyRoomEnter()` から 0.3 s、ぼかし核に `focusHunt · 2.5 px · \|sin(2π t / 0.3)\| · (1 − t / 0.3)` を足す（2 山、減衰） | 0.6 → 最大 1.5 px。実測 1.65 px @67 ms → 0.55 @147 → 0.93 @204 → 0.5（軟焦点）@300 ms |
| 9 | かすみ | `haze` | 深度 → 距離 [m] を `min(dist, hazeClamp)` で止め、`h = haze · dist / 20`。彩度は `mix(col, lum, min(1, 1.5 h))`、明度は `mix(col, hazeLevel, h)` | hazeClamp = min(scene.fog.far, 40)（R06 の FogDepth では 35）。hazeLevel = clamp(平均輝度 × 4, 0.02, 0.8)（暗い部屋では暗い灰へ寄る） |
| 10 | フリッカー | `flicker` | CPU: `1 + flicker (0.7 sin(2π·60 t + φ) + 0.6 (rand − 0.5))`、φ はフレームごとに ±0.6 の乱歩（フレームレートとの折り返しで一定値に張り付かない） | 0.01 → 実測 gain の σ 0.55%、幅 0.957〜0.975 |
| 11 | 回転ブラー | `motionBlur` | yaw / pitch [rad/s] × 露光 1/60 s × 焦点距離 [px]（= 0.5 h / tan(fov/2)）を τ 0.06 s で平滑 → 長さ L（上限 24 px @1080p）。核の軸 A を速度方向に L/2 伸ばす。並進は無視 | 3 rad/s・motionBlur 0.5 で軸 A = 12 px（1080p, fov 72° の焦点距離 743 px） |
| 12 | 露出の追従 | `autoExposure` | 幾何平均輝度 L（log2 の平均）→ 目標 `clamp((0.045 / L)^0.45, 0.6, 1.8)` を log 域で τ 1.7 s。gain を色に掛ける（トーンマップ前） | 基準 0.045 は seed 7 の実測（§4）。統計は 4 フレームごと + 非同期読み戻し（1〜2 フレーム遅れ） |
| 13 | WB の追従 | `autoWhiteBalance` | 平均色の灰色仮定 `g_c = (L / mean_c)^0.6` → 輝度で正規化 → ±8% に制限 → τ 3 s | 暖色の部屋（C02: 平均 (0.058, 0.052, 0.033)）で (0.946, 1.007, 1.09)、青い R06 で (1.04, 1.0, 0.92) |

深度 → 距離: `dist = near·far / (far − d (far − near))`（d = ウィンドウ深度 .x。GTAO の DepthTexture と自前の DepthTexture で同じ式）。near / far は毎フレーム camera から写す。

## 3. プリセット（`LENS_PRESETS`。意図はコード内コメント）

| | off | clean | homeVideo | tape |
|---|---|---|---|---|
| distortion / chroma / vignette | 0 | 0 | 0.03 / 0.5 px / 0.08 | 0.04 / 0.7 px / 0.10 |
| softFocus / focusHunt / dof | 0 | 0 | 0.5 px / 0.6 / 0.6 | 0.7 px / 0.8 / 0.6 |
| glow / halation / flare | 0 | 0 | 0.35 / 0.6 / 0.3 | 0.45 / 0.8 / 0.3 |
| haze / flicker / motionBlur | 0 | 0.03 / 0 / 0 | 0.06 / 0.01 / 0.5 | 0.06 / 0.015 / 0.6 |
| autoExposure / autoWhiteBalance | 0 | 1 / 1 | 1 / 1 | 1 / 1 |

`glow` の意味を「ぼかした明部の超過分に掛ける倍率（0〜0.6）」に変えた（当初の目安 0〜0.08 では見えない）。他のフィールドの意味は統合の定義どおり。

## 4. 露出の較正（seed 7、Tier high、1920×1080、入室直後の視点）

| 部屋 | 幾何平均輝度 L | 目標ゲイン (0.045/L)^0.45 |
|---|---:|---:|
| C02 オフィス廊下 | 0.046 | 0.99 |
| C01 閉館後の学校廊下（夜） | 0.043 | 1.02 |
| C05 病院外来廊下 | 0.060 | 0.88 |
| C12 / C08 | 0.022 | 1.38 |
| C13 / C18 | 0.030 | 1.20 |
| C15 | 0.051 | 0.95 |
| C16 | 0.075 | 0.79 |
| E06 逆影広間 | 0.0255 | 1.29 |
| R06 青い水族館通路 | 0.109 | 0.67 |

最初 0.18（教科書的な中間灰）にしていたが、AgX + 露出 1.0 で設計された部屋の log 平均は 0.02〜0.11 で、全部屋が上限 1.8 に張り付いた。中央値 0.045 を基準にし、
補正は log 域で 45%（2 倍暗い部屋で 1.37 倍、上限 1.8 は極端な暗室だけ）にした。明るい部屋（R06）は 0.67 まで下がる。強すぎれば `LENS_TUNING.EXPOSURE_ADAPT` を 0.3 前後へ。

## 5. 確認結果

環境: macOS、Chrome（Claude Browser ペイン）、Tier high、seed 7、`?nolock=1&new=1&seed=7&force=<ID>` + 部屋へテレポート。`npx tsc --noEmit -p .` は 0 エラー。
コンソールエラーは 0（テスト用に流した計測スクリプト自身の TypeError 1 件だけ。ゲーム側の警告なし）。統計の読み戻しは 2000 回超で失敗 0。

- **C01（夜の学校廊下、1920×1080）** homeVideo / lens 無効: 天井の直線がわずかに外へ膨らみ、四隅が 8% 落ち、突き当たりが灰へ寄る（かすみ）。器具の周りにうっすら暖色の輪。
  誇張テスト（k1 0.15・色収差 6 px・減光 0.5、glow 1・flare 3、軟焦点 4 px、yaw 3 rad/s）で各効果の方向を確認: 樽型・縁の色ずれ・横一線のストリーク・横ぼかしが出る。
- **C05（艶床と器具、833×490）** homeVideo: 器具の縮小反射の周りにも柔らかいにじみ。tape: 軟焦点 0.7 と減光 10% で一段眠くなる（走査線等は VideoPass 側）。
- **R06（FogDepth、fog far 35）**: `hazeClamp` が 35 に追従（40 ではない）。部屋が明るい（L 0.109）ので露出が 0.67〜0.70 へ下がり、WB が青を −8% 戻す。
- **E06 へ入室（露出の追従）**: C02（L 0.067、gain 0.84）→ E06（L 0.0255）。`exposureGain` は 0.839（0 s）→ 0.875（0.36 s）→ 0.97（0.9 s）→ 1.04（1.4 s）→ 1.10（1.9 s）→ 1.14（2.3 s）→
  1.18（2.8 s）→ 1.20（3.3 s）→ 1.225（3.8 s、目標 1.29）。入室直後の画面は暗く、3 秒後の画面は目に見えて明るい。
- **DoF**: 壁の 0.6 m 手前で 45° 振り（中央 0.82 m）: dofBlock 0.35 s の後 `dofAmount` 0 → 0.21（0.47 s）→ 0.45（0.71 s）→ 0.56（1.0 s）→ 0.60（1.9 s）、焦点 0.82 m。
  背景（廊下の奥）が最大 1.8 px 甘くなる（0.52 倍のスクリーンショットでは判別しにくい程度）。
- **フォーカスの迷い / フリッカー / 回転ブラー**: §2 の実測値どおり。
- **自前深度パス**（`setDepthTexture(null)` で強制）: 417×245 の DepthTexture が作られ、中央距離 8.35 m は GTAO 深度のときと一致。draw calls +18（C02）。

## 6. GPU 時間

計測は LensPass.render だけを `EXT_disjoint_timer_query_webgl2` で囲ったもの（FrameTimer を一時停止）。**他タブが同時に描画していて GPU が時分割されるため
中央値は params=off でも 9 ms 前後に膨れ、意味を持たない。min と p25 で読む**（docs/postfx.md 7 章と同じ扱い）。

| 条件（1920×1080、high、C01） | n | min ms | p25 ms | 中央値 ms |
|---|---:|---:|---:|---:|
| params = off（全効果を分岐で飛ばした固定コスト = 全画面 1 パス + MSAA resolve） | 238 / 246 | 0.82 / 0.83 | 1.61 / 2.03 | 9.2 / 9.1 |
| clean（統計 + かすみ） | 247 | 0.85 | 2.02 | 9.3 |
| homeVideo（全効果） | 241 / 223 | 0.96 / 0.98 | 2.27 / 2.16 | 9.3 / 9.5 |
| tape | 156 | 0.97 | 2.58 | 9.1 |

効果ぶんの増分（homeVideo − off）は min で +0.15 ms、p25 で +0.3〜0.6 ms。固定コストの大半は composer の RT が MSAA（samples 2）で、フルスクリーン pass の出力ごとに
resolve blit が入ること（スタブの CopyShader でも同じ）。目標の 1.5 ms 以内。全フレームの A/B（`lensPass.enabled` の切替、`game.perf().gpu.median`）は 33〜37 ms で両者の差が揺れに埋もれた。

自前深度パス（833×490、C02 = 18 draw calls）: 深度あり p25 1.53 / 1.89 ms、なし（haze = dof = 0）0.95 / 1.34 ms → **+0.5〜0.6 ms**。C06 のような 400〜1000 calls の部屋では
それ以上になる。GTAO のある high では発生しない。mid で重ければ `LENS_TUNING.DEPTH_SCALE` を 0.35 に、または haze / dof を mid のプリセットで 0 に。

## 7. 残課題・統合への要望（docs/visual-requests.md にも記載）

- `PostFX.setAoSuppressed(true)`（untextured の部屋）で GTAO が止まると `GTAOPass.depthTexture` が更新されず、かすみ / DoF が前の部屋の深度を見る。
  `setAoSuppressed` か `render` で `lensPass.setDepthTexture(gtaoPass.enabled ? gtaoPass.depthTexture : null)` を呼んでほしい（null なら自前パスに切り替わる）。
- 入室フレームの `setCameraMotion` は 0（F2）なので、迷いと回転ブラーが重なるのは入室後に振り向いた 0.3 s だけ。核は同じディスクなので合成は破綻しない（見た目の確認は F2 と）。
- 露出の基準 0.045 は seed 7 の 9 部屋の実測。ライトマップの再調整で部屋の平均が変わったら §4 を測り直す。
- DoF の「歩行中は無効」は深度中央値の急変（0.2 m / 4 フレーム）と回転速度で判断しているので、壁に向かってゆっくり近づくと 0.9 m を切った時点で掛かる。並進速度を渡す API を足すなら `setCameraMotion` に第 3 引数。
- 統計の読み戻しは 4 フレームごとに 1 回（`STAT_INTERVAL`）。iOS Safari の `readRenderTargetPixelsAsync` は未確認（失敗が 3 回続くと露出 / WB を止めてゲイン 1 に戻す）。
- 色収差はぼかし結果への差分加算の近似で、DoF / 回転ブラーが強いときは R / B の縁がぼかしより硬い。0.5〜0.7 px では判別できない。
- スクリーンショット比較は Browser ペインの縮小表示（0.52 倍）でしか確認していない。原寸の比較画像は保存していない（`docs/visual-postfx/` に追加するなら P の手順で）。
