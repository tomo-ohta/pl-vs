# 映像記録系（VideoPass）— ビデオの質感（担当 F1b、2026-09-22）

対象: `src/render/VideoPass.ts`（統合担当のスタブを実装。公開 API は不変、`VideoParams.frameBlend` と確認用 `forceJitter` / `forceHeadSwitch` を追加）、
`src/render/shaders/VideoShader.ts`（新規）、`src/ui/RecOverlay.ts`（スタブを実装。公開 API 不変、`date` / `elapsed` を追加）。
`src/render/PostFX.ts` は触っていない（依頼は `docs/visual-requests.md` 末尾「F1b → 統合」）。画像は `docs/film-video/`。

## 1. 位置づけと描画経路

composer: RenderPass → GTAO → Bloom → LensPass（F1a、線形 HDR）→ OutputPass（AgX + sRGB）→ **VideoPass（最後。画面へ）**。
入力 `readBuffer.texture` は sRGB の表示域 0〜1。この pass の演算はすべて表示域で行う（トーンマップ・色空間変換はしない）。

```
needsPrev = params.interlace > 0 || params.frameHold > 0
  false（clean / homeVideo）: single 材質  tDiffuse ─────────────────────────────→ 画面      … 1 draw、RT なし
  true （tape）            : color 材質   tDiffuse + tPrev(RT_a) → RT_b（色段）
                             final 材質   RT_b ────────────────────────────────→ 画面      … 2 draw（取り込みフレーム）
                             保持フレーム（frameHold 中で取り込まない）: final だけ描く    … 1 draw
```

- 同じ GLSL ソースを define（`COLOR_STAGE` / `HAS_PREV` / `FINAL_STAGE`）で 3 通りにコンパイルし、uniform オブジェクトは共有する（描く直前に `tDiffuse` / `tPrev` / `interlaceMix` / `frameBlend` を差し替える）。
- 前フレーム RT は出力と同解像度の UnsignedByte RGBA × 2（ping-pong。1920×1080 で 8.3 MB × 2）。要らないプリセットに切り替えると解放。`setSize` で作り直し（`prevValid = false` → 次の取り込みは前フレームを混ぜない）。
- 色段（内容に属する効果: 1・2・4・5・10 と前フレームの混合 6・9）→ 最終段（再生機・表示に属する効果: 7・8 の座標ずれ → 6 走査線 → 3 粒子）。
  揺れ・ヘッド切替は最終段で座標をずらしてから採るので、粒子・走査線は動かない（記録された絵だけがずれる）。
- ノイズはすべて出力ピクセル座標（`gl_FragCoord`）+ seed の整数ハッシュ（PCG、uint。three は WebGL2 で `#version 300 es` を付ける）。解像度・DPR で振幅は変わらない。
  seed = `frozenSeed ?? frame` を 4096 で折り返す（float uniform の精度のため）。距離を持つ効果（色差ぼかし・横ずれ）は 1080p 基準 px を `resolution.y / 1080` で換算する（LensPass の色収差と同じ流儀）。

## 2. 効果ごとの方式と数値

| # | 効果 | params | 方式 | homeVideo | tape |
|---|---|---|---|---|---|
| 1 | 色調整 | `desaturate` / `tint` | BT.601 輝度との mix、RGB ゲイン | 0.12 / [1, 1, 0.97] | 0.15 / [1, 1.02, 0.96]（黄緑寄り） |
| 2 | 色のにじみ | `chromaBlur`（1080p 基準 px） | YCbCr(601) に分け、Y は中心 1 タップ、Cb/Cr は横 7 タップ（重み 1 2 3 4 3 2 1 / 16、間隔 r/3）。色差を輝度より右に 0.35 r 遅らせる | 2.5 px | 3.5 px |
| 3 | 暗部ノイズ | `noise` / `colorNoise` | 振幅 = noise × 音量ゲイン × (0.3 + 0.7 dark) × 2（peak-to-peak）、dark = 1 − smoothstep(0.04, 0.6, luma)。色ノイズは R/G/B 独立ハッシュ × (0.8, 0.7, 1.3) を `colorNoise` で混ぜる | 0.012 / 0.3 | 0.018 / 0.4 |
|   | 音量連動 | `setAudioNoise(x)` | x = `AudioEngine.ambientLevel`（実測 無音 0.02 / 環境音 1 本 0.41 / 3 本 0.57）。gain = 1 + 0.6 × clamp((x − 0.02) / 0.58, 0, 1) → 0.02 で 1.0、≈0.45 で 1.4、≥0.6 で 1.6 倍。0.25 s で追従（F2 指定） | | |
|   | 静止 | `setStillness(sec)` | 3 s 超で 7・8 の新規イベントを止め、進行中も消す（粒子だけが動く）。`force*` で出したものは除く | | |
| 4 | 黒レベルの浮き | `blackLift` | x' = lift + (1 − lift) x のあと、toe 0.22 以下に + 1.5 lift × (toe − x')² / toe（0 での傾き ≈ 1 − 3 lift） | 0.025 | 0.035 |
| 5 | ハイライトのニー | `knee` | 折れ点 kp = mix(0.92, 0.85, knee)、kp 以上の傾き = 1 − 0.75 knee。チャンネル別（白に近い色は少し色が残る） | 0.4（kp 0.892、傾き 0.7、上限 0.968） | 0.6（kp 0.878、傾き 0.55、上限 0.945） |
| 6 | 走査線 | `scanlines` | 奇数出力行を × (1 − 0.12 scanlines)。`SCANLINE_DEPTH` 0.12（0.22 では白い器具面の縞が露骨だった。§4） | 0 | 0.35（4.2%） |
|   | コーミング | `interlace` | 色段で奇数行だけ前フレーム RT を `interlace` 混ぜる（動いたものに横縞のゴースト。静止時は同一） | 0 | 0.4 |
| 7 | テープの揺れ | `jitter` | 期待発生 = jitter × 4 回/s。帯の高さ 2〜12%、横ずれ ±2〜6 px（1080p）、1 フレーム（40% で 2）。帯の上端で最大、下へ t^1.5 で戻る（同期の復帰） | 0 | 0.15（0.6 回/s） |
| 8 | ヘッド切替 | `headSwitch` | 期待発生 = headSwitch × 3 回/s。画面下端 2〜3% の帯、2〜5 フレーム。行ごとに横ずれ 4〜12 px（下ほど大きい、行ノイズ ±40%）、行の明滅 ±60% × flicker(0.6〜1)、粗いノイズ ±0.2、上端に 1 px の裂け目 | 0 | 0.2（0.6 回/s） |
| 9 | フレーム間引き | `frameHold` / `frameBlend` | 累積 dt が周期 × 0.75 を超えたフレームで取り込み（60 Hz: 30 → 2 フレームごと、24 → 2, 3, 2, 3…。120 Hz 実測 `1000 1000…`）。取り込み時に前フレームを `frameBlend` 混ぜる（残像は幾何級数で減衰）。保持フレームは色段を飛ばす | 0 | 30 / 0.3 |
| 10 | DCT ブロック | `dctBlocks` | 8 px（出力）ブロックごとに量子化（1/128 = 2/255 刻み）の位相を ±0.5 段ずらし、DC を ±0.75/255 ずらす。dark = 1 − smoothstep(0.06, 0.35, luma) と `dctBlocks` で mix。位相の種は 0.5 s ごと（GOP のつもり） | 0 | 0.3（暗部で ≈1/255 の段差） |
| 11 | REC・タイムコード | `RecOverlay` | DOM（`#rec-overlay`、z-index 5、pointer-events none、ui-monospace 12 px、白 80%、影）。右上 ●REC（赤丸 9 px、1 s 周期 50% で点滅）、左下 `2003.07.14  HH:MM:SS:FF`（FF は 30 fps）。日付は `date`（既定は架空日付、`'auto'` で今日）。経過は `update(dt)` の累計（非表示中も進む）。DOM は最初の `setVisible(true)` で作り、`dispose` で外す。document が無ければ何もしない | 既定オフ（設定 `recOverlay`。Game が playing / riding / transition の間だけ表示） | |

`clean` は desaturate 0.05 だけ（他は 0。single 材質の素通し + 彩度）。`off` では PostFX が pass を置かない。

## 3. GPU 時間（1920×1080 = 1536×864 css × DPR 1.25、Tier high、C02、M 系 Mac、120 Hz）

計測方法: `VideoPass.render` を N = 1 と 17 回呼ぶよう差し替え、`game.perf().gpu.median` の差 / 16 を pass 1 回のコストとする（GPU タイマーで pass 単体を囲むと、ANGLE/Metal ではキューの待ち時間が乗って 5 ms 前後の値になり使えなかった）。
他担当が同時に GPU を使っていたため基準フレームが 12 → 22〜33 ms と揺れ、値は ±0.3 ms 程度の幅を持つ（**静かな環境での再計測を推奨**。手順は上記）。

| 経路 | pass 1 回 | 備考 |
|---|---|---|
| clean（single、彩度のみ） | 0.19〜0.21 ms | 素通し 1 draw の下限 |
| homeVideo（single: 色差 7 タップ + 粒子 + ニー等） | 0.44〜0.86 ms | |
| tape single（interlace 0 / frameHold 0 に落とした場合） | 0.43〜0.46 ms | |
| tape 取り込みフレーム（色段 → RT → 最終段） | 0.68〜1.03 ms | RT 書き 8 MB + 読み。目標 1 ms の上限付近 |
| tape 保持フレーム（最終段のみ） | 未計測（負荷で失敗） | 1 タップ + 粒子なので single より軽い見込み |

whole-frame の A/B（VideoPass `enabled` の on / off）では差が 2.5〜4 ms と大きく出た。原因は composer の RT が **2× MSAA の HalfFloat**であること: VideoPass が居ると OutputPass が画面ではなく MSAA RT へ描き、その解決（resolve）と 16 MB の書き読みが乗る（LensPass の追加でも同様に ≈1 ms）。pass 自体のコストではないので統合へ依頼（`docs/visual-requests.md`）。

## 4. 確認結果（`docs/film-video/`。full は canvas 0.5× の JPEG、crop は等倍〜3× の PNG。`frozenSeed = 17`、`?nolock=1&new=1&seed=7&force=C08`）

| 画像 | 内容 / 所見 |
|---|---|
| `C02-off.jpg` / `C02-homeVideo.jpg` / `C02-tape.jpg` | オフィス廊下。homeVideo は彩度 −12%・黒の浮き・器具面が平らに潰れる・かすかな粒子で「家庭用ビデオの 1 コマ」に見える（LensPass の歪み・減光と喧嘩しない）。tape は黄緑寄りの白 + 走査線 + 粒子で明確にテープ |
| `C02-tape-jitter-headswitch.jpg`、`crop-tape-jitter.png`、`crop-tape-headswitch.png` | `forceJitter(900)` / `forceHeadSwitch(900)`。中央の帯（uv 0.42〜0.5）で扉の縁が右へ 4 px、上端で最大・下で戻る。下端 2.5% の帯は行ごとの横ずれ + 明滅 + ノイズ（撮影時はノイズ ±0.25。その後 ±0.2 に下げた） |
| `crop-tape-light-knee.png`（3×） | 器具面がニーで平らに潰れる。**撮影時は走査線 0.22 で白面に縞が露骨** → `SCANLINE_DEPTH` 0.12 に下げた（tape で 4.2%） |
| `crop-tape-floor-dark.png` / `crop-off-floor-dark.png`（2×） | 壁の中間調。tape は走査線（旧 0.22）と細粒ノイズ、off は素の材質 |
| `C08-off.jpg` / `C08-homeVideo.jpg` / `C08-tape.jpg` | マンション共用廊下（夜景の窓）。tape は暖色の廊下が黄緑寄りに、コントラストが寝る |
| `C08-night-*.jpg`、`crop-C08-night-*.png`（2×） | 夜景の窓に正対。off は完全な黒、homeVideo / tape は黒が浮き（0.025 / 0.035）、暗部に色付きの粒子、窓明かりの左右の縁に色差のにじみ（暖色の窓で分かりやすい）。tape の窓明かりには 4% の走査線 |
| `crop-C08-interlace-motion.png`（2×） | frameHold 0・interlace 0.4 で yaw を 0.03 rad 動かした直後。窓明かりの元の位置に横縞のゴースト（奇数行だけ前フレーム）= コーミング |

- コンソールエラー 0（自分の pass に起因するもの無し）。`npx tsc --noEmit -p .` は自分の 3 ファイルで 0 エラー（F2 編集中の Game.ts / PlayerController.ts の TS6133 等は対象外）。
- frameHold 30 の取り込みパターン（120 Hz、rAF で `captureThisFrame` を 16 フレーム記録）: `1100100010001001`（4 フレームに 1 回。先頭の 11 は手動 renderFrame の影響）。
- RecOverlay: 赤丸の opacity が `elapsed % 1 < 0.5` で 1 / 0 に切り替わる、`2003.07.14  00:00:01:25` の書式、設定オフで `display: none` を確認。DOM はキャンバスの外なので canvas のキャプチャには乗らない。
- 赤い消火器サイン（C08）は seed 7 の配置では視界に無く、材質の色でも見つからなかった（アトラスのテクスチャと思われる）。色差のにじみは夜景の窓明かりで確認した。
- 一度だけ、ホットリロード直後に部屋が真っ暗（器具の面が消え、ライトマップ無し）になり、コンソールに `GL_INVALID_OPERATION: Mismatch between texture format and sampler type` が 256 件出た。`film: 'off'`（VideoPass 無し）でも暗いままで、再読み込みで解消・再現せず。VideoPass とは無関係だが統合へ観察として報告。

## 5. 残課題

- GPU 時間の静かな環境での再計測（§3 の手順）。保持フレーム（final のみ）の値。
- MSAA HalfFloat RT に後段 pass が全て乗る構造（統合へ依頼）。
- DCT ブロック（tape 0.3）は粒子に埋もれてほぼ見えない。気配を強めるなら 0.5。
- ヘッド切替は仕様どおり低確率イベントにしたが、実機の VHS は常時下端に帯が出る。常時薄く出す `headSwitch` の使い方（例: 帯の強さを常時 0.3、イベント時 1.0）は演出判断待ち。
- RecOverlay のタイムコード（左下）はスマホの左スティック領域と視覚的に重なる（pointer-events は無効）。スマホでは非表示にするか右下寄せに（設定側 F2）。
- 設定 `frameHold` で homeVideo / clean に間引きを強制した場合、`frameBlend` はプリセット値 0 のまま（残像なし）。強制時は 0.3 程度を併せて入れると tape と同じ見えになる（F2）。
- 色差ぼかしの単位は 1080p 基準 px（docstring を「1080p 基準」に直した）。4K 出力では実 px が 2 倍になる。
