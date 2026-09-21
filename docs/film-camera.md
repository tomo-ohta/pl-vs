# カメラ挙動（手持ち感・視線の遅れ・撮像 pass への入力）— 担当 F2（2026-09-22）

対象: `src/player/PlayerController.ts`（手持ち感・視線の遅れ・ズームのゆらぎ。`CAMERA_FEEL` / `CAMERA_PRESETS`）、`src/game/Game.ts`
（設定の配線、撮像 pass への毎フレーム入力、REC 表示）、`src/core/Settings.ts` / `src/ui/SettingsPanel.ts`（設定項目）、
`src/audio/AudioEngine.ts`（`ambientLevel`）。`src/render/PostFX.ts` / `LensPass.ts` / `VideoPass.ts` / `RecOverlay.ts` は触っていない
（PostFX の公開 API `setCameraMotion` / `setAudioNoise` / `setStillness` / `notifyRoomEnter` / `videoPass.params.frameHold` を呼ぶだけ）。

## 1. 方針

- **表示カメラだけを動かす。** 手持ち感・視線の遅れ・ズームのゆらぎは `PlayerController.syncCamera()` で `camera.position / rotation / fov`
  に合成するオフセット。`pos`（当たり判定）・`yaw` / `pitch`（入力値。移動方向・セーブ・PlayerProxy・Modifier の `ctx.player.yaw`・
  AudioEngine のリスナー向き）は一切変えない。PlayerProxy（鏡像・PastWindow）は `player.pos / yaw / pitch` を読むので影響なし。
- **弱く、すべて設定で切れる。** 酔いの原因になるので数値は控えめ（上下動 1.5 cm・ロール 0.3°・ふらつき 0.08°・FOV ±0.5°）。
  `handheld` 0 で揺れ・ロール・呼吸・ふらつき・ズームが完全に無効（オフセットは厳密に 0、FOV は基準値に戻して以後 `updateProjectionMatrix` を呼ばない）。
  `cameraLag` off で表示 yaw / pitch は入力値と一致。
- **乗車中（`state === 'riding'`）と E03（`layout.roll`）では掛けない。** Game が毎フレーム `player.cameraFeelSuppressed` を立て、
  `syncCamera` は入力値どおり（PlayerRide の微振動・ロールと競合しない）。抑制の解除時は表示 yaw / pitch を入力値にスナップ（振り戻しなし）。
- **決定論に関与しない。** `Math.random` は位相の起点（ふらつき・呼吸のロール・ズームの周期 7〜11 s）にだけ使い、コンストラクタで 1 回。
  世界生成（RoomGraph / generateLayout / Modifier）には触れない。`node tools/seam-stats.mjs --seeds 3 --rooms 40` → deterministic true。
- rotation は `'YXZ'`（Y = yaw、X = pitch、Z = roll）。PlayerRide と同じ順序。

## 2. 数値（`CAMERA_FEEL`。`handheld` 0〜1 でスケール。既定 0.6）

| 項目 | 値（handheld 1） | 備考 |
|---|---|---|
| 歩行の上下動 | 振幅 1.5 cm、1 歩 1 周期 | 位相 = `strideAcc / 歩幅`（足音 `onStride` と同じ累積器）。`-cos` で足音の瞬間が最下点。歩行 3 m/s / 0.75 m = 4 歩/s、ダッシュ 5.5 / 1.1 = 5 歩/s |
| 歩行のロール | ±0.3°、2 歩 1 周期 | `sin(π (歩数 + 位相))` で左右の足が交互。停止時は 0 に収まる |
| 立ち上がり / 収まり | 0.2 s / 0.3 s | 包絡。停止中は最後の位相を保って包絡だけ落とす |
| 出力の平滑 | 1 次ローパス 50 ms | 停止・再開・歩幅切替（`strideAcc / 歩幅` の位相の飛び）の段差を消す。歩調の周波数での減衰 `1/√(1+(ωτ)²)` はあらかじめ掛け戻す（上限 2.5 倍） |
| 姿勢 | しゃがみ ×0.6、ダッシュ ×1.4 | 呼吸にもしゃがみの 0.6 を掛ける |
| 呼吸 | 上下 3 mm・周期 4.5 s、ロール 0.1°・周期 6.3 s | 常時（静止で弱めない） |
| 手持ちのふらつき | yaw / pitch ±0.08° | 周期 3.1 / 1.3 s（yaw）、2.3 / 0.9 s（pitch）の正弦の 0.6 : 0.4 合成。72° FOV・1080p で約 1 px |
| 静止 | 3 s 以上で上下動・ロール・ふらつきを 0.3 倍 | 1 s で落とし、入力があれば 0.5 s で戻す。呼吸は残す。静止 = 移動入力・視線入力なし かつ実速度 < 0.3 m/s（Game.updateStillness） |
| 視線の遅れ | 時定数 50 ms の指数追従 | `disp += (input - disp) (1 - e^{-dt/0.05})`。1.2 rad/s の振り向きで定常 3.4° 遅れる。テレポート・抑制解除でスナップ |
| ズームのゆらぎ | FOV ±0.5°、周期 7〜11 s（起点ランダム） | `camera.fov = baseFov + offset` → 変化があるフレームだけ `updateProjectionMatrix`。基準 `player.baseFov` は生成時の `camera.fov`（72） |

撮像プリセット別の倍率（`CAMERA_PRESETS`。LensPass / VideoPass のプリセットと対）: off / clean は **ズームのゆらぎ無し**（レンズのサーボの癖を付けない）、
homeVideo はふらつき ×1・ズーム ×1、tape はふらつき ×1.2・ズーム ×1.2。手持ちの上下動・ロール・呼吸・遅れはプリセットに依らず設定どおり。

FOV を他所が触っていないことを確認: `camera.fov` を書くのは `src/dev/VisualReview.ts`（別カメラ）だけ。`Game.setTier` / `resize` は far / aspect を変えて
`updateProjectionMatrix` を呼ぶが fov は変えない（ゆらぎ中の値をそのまま使う）。ScaleAnomaly 等の Modifier は FOV を変えていない。

## 3. 設定（`Settings.ts` / `SettingsPanel.ts`。localStorage `liminal.settings.v1`）

| キー | 型 / 既定 | パネル | 反映 |
|---|---|---|---|
| `postfx` | `FilmPreset`（off / clean / homeVideo / tape）。既定 **homeVideo** | 描画効果 | `Game.applyPostFxConfig` → `PostFX.configure({ film })`。low Tier の clean は off（直接描画）。旧値 `'archival'` は sanitize で homeVideo |
| `handheld` | 0〜1、既定 0.6 | 手持ち感（スライダー。0 は「オフ」表示） | `player.feel.handheld` |
| `cameraLag` | boolean、既定 on | 視線の遅れ（オン / オフ） | `player.feel.lag` |
| `frameHold` | `'off' \| '30' \| '24'`、既定 off | 表示 fps（プリセットに従う / 30 / 24） | `videoPass.params.frameHold`。off = `VIDEO_PRESETS[film].frameHold`（tape は 30、他は 0）に戻す。30 / 24 はプリセットに関係なく上書き |
| `recOverlay` | boolean、既定 off | REC 表示（オン / オフ） | `RecOverlay.setVisible`（playing / riding / transition のときだけ表示。メニュー・開始画面では隠す） |

`Settings.onChange`: `postfx` / `toneMapping` は `applyPostFxConfig`（composer の組み直し → 末尾で `applyCameraSettings`）、
`handheld` / `cameraLag` / `recOverlay` / `frameHold` は `applyCameraSettings` だけ（pass も RenderTarget も作り直さない）。
パネルの選択式は `SelectDef.bool` で 'on' / 'off' を boolean に読み替える。行の並びは 音 → 視点 → 描画効果とカメラ挙動 → トーンマップ（開発用）。

## 4. 撮像 pass への入力（Game.stepBody。毎フレーム）

- `postfx.setCameraMotion(yawRate, pitchRate)`: 表示カメラ（`camera.rotation`。遅れ・ふらつきを含む）の前フレームとの差 / dt（rad/s。差は (-π, π] に畳む）。
  テレポート（`player.teleportSerial` の変化）と入室（`enterRoom` で部屋が変わった）のフレームは 0。乗車中もそのまま（PlayerRide の視点操作が入る）。
- `postfx.setStillness(sec)` / `player.setStillness(sec)`: playing / riding の間だけ数える。メニュー中は保持。
- `postfx.setAudioNoise(audio.ambientLevel)`: `AudioEngine.ambientLevel`（§5）。
- `postfx.notifyRoomEnter()`: `enterRoom` で `prev !== roomId` のとき（最初の部屋も含む）。同時に `roomHasRoll = !!layout.roll`（E03 の抑制）。
- `recOverlay.update(dt)`: 毎フレーム。表示切替は状態と設定から計算して変化時だけ `setVisible`。
- デバッグ HUD（メニュー「デバッグ HUD」）に 1 行追加: `cam bob <mm> roll <deg> fov <deg> rate <yaw> <pitch> rad/s still <s> noise <0..1> lens exp <gain> (feel off)`。

## 5. AudioEngine.ambientLevel（環境音の大きさ 0〜1）

解析ノードは増やさない。稼働中の環境音レイヤー（`mixer.layerIds()` と `currentMix.layers`（followUp 含む）の gain。幻聴は除く）と
`play(kind, { loop })` のループ（gain を記録）の gain の二乗和の平方根 `bus` を `1 - exp(-bus / 1.4)` で 0〜1 に写し、環境音・全体音量（線形）を掛ける。
非表示タブ（ambientBus 0）・ctx 未生成 / 停止中は 0。`update(dt)` でクロスフェードと同じ 1.2 s の時定数で追従。
目安（既定音量 0.8）: 「無音に近い」≈ 0.02、hvac 1 本（gain 0.5）≈ 0.24、レイヤー 1 本 gain 1 ≈ 0.41、空調 + ハム + PC ファンの 3 本 ≈ 0.57。

## 6. 確認結果（2026-09-22。Chrome、`?nolock=1&new=1&seed=7`、`game.onStartClick()` → `game.devInput` → `game.step(1/60)`）

- `npx tsc --noEmit -p .` 0 エラー。`node tools/seam-stats.mjs --seeds 3 --rooms 40` deterministic true（seam 0、deadEnd 0）。コンソールエラー 0。
- 歩行 2 s（`moveY: 1`、handheld 0.6）: カメラ y オフセット −9.2〜+11.8 mm、roll −0.24〜+0.17°、FOV 72.09〜72.30、yaw の表示差 ±0.04°（ふらつき）。
  `player.yaw / pitch` は不変、`pos` は 5.9 m 前進（2.94 m/s）。
- ダッシュ 2 s: y ±15 mm、roll ±0.27°（×1.4）。しゃがみ歩行 2 s（1.51 m/s）: y ±6.5 mm、roll −0.15〜+0.08°（×0.6）。
- `handheld: 0`: 歩行中でも y / roll / yaw 差 / 回転速度が厳密に 0、FOV 72.000。
- 視線の遅れ: `lookDX 0.02 / frame`（1.2 rad/s）で表示 yaw が最大 2.9° 遅れ（定常 3.4° へ収束途中）、入力を止めて 20 フレームで 0.04° に収束。
  `cameraLag: false` では差 ≤ 0.03°（ふらつき分のみ）。回転速度の入力は −1.20 rad/s。
- 静止: 3.5 s で stillScale 0.65（3 s から 1 s で 0.3 へ）、4.8 s で 0.30、ふらつき ±0.013°（0.048° × 0.3）。移動入力から 0.67 s で 1.0。
- 表示 fps: homeVideo + '30' → `frameHold 30`、'off' → 0、tape + 'off' → 30（プリセット）、tape + '24' → 24、clean + '24' → 24（上書き）、off → direct。
  clean では FOV 72.000 固定（ズーム無し）、homeVideo に戻すと再びゆらぐ。
- REC 表示: 設定 on で playing 中 `isVisible true`、メニューを開くと false、設定 off で false（F1b 実装後は DOM の見え方も確認が必要）。
- 設定パネル: 10 行（全体音量 / 環境音 / 効果音 / 視点感度 / 描画効果 / 手持ち感 / 視線の遅れ / 表示 fps / REC 表示 / トーンマップ）。
  DOM の change / input から `localStorage` に `cameraLag: false, handheld: 0.35` が保存され `player.feel` に即反映。「既定に戻す」で homeVideo / 0.6 / on / off / off。
- テレポートのフレーム: 振り向き中（−0.97 rad/s）に `teleport` → そのフレームの回転速度 0、次フレームから再開。
- E03 相当（`roomHasRoll` を強制）: 歩行中でもオフセット 0・roll 0・`camera.rotation.y === player.yaw`・FOV 72。解除後 0.5 s で揺れが戻る（スナップで振り戻し無し）。
- 非表示タブでは `ambientLevel` 0（ambientBus が 0 なので正しい）。`hidden` を外した推定: 空調 + ハム + PC ファン（gain 1 × 3）→ 0.57。

## 7. 残課題

- 乗車中（`state === 'riding'`）の抑制はフラグの経路が E03 と同じで、実乗車での目視は未確認（E11 / L02 / L11 が seed 7 の近傍に無い）。
- 手持ちの横方向（x）の揺れは付けていない（上下 + ロールのみ。酔い対策）。必要なら `CAMERA_FEEL` に 1 項目足せばよい。
- 静止の判定はキーボード / スティック / マウス入力と実速度から。ゲームパッドのわずかなドリフトがあると静止に入らない可能性。
- 設定パネルの行が 10 本になりメニューが縦に長い。スマホ縦持ちでは `#menu .panel` のスクロールに依存（既存のまま）。
- `FilmPreset.ts` のコメントにある「PlayerController 側の CAMERA_PRESETS」は wobble / zoom の 2 倍率だけ（プリセットで手持ちの強さは変えていない）。

## 8. 統合への要望（docs/visual-requests.md にも記載）

- `Game.applyPostFxConfig` の暫定の `'archival' → 'homeVideo'` は Settings 側の sanitize に移したので、Game 側は `film = d.postfx` だけになっている（整理済み）。
- PostFX 側で `configure` が `applyPreset` を呼び直すと `videoPass.params.frameHold` の上書きが消えるので、Game は `configure` の直後に `applyCameraSettings` で書き戻している。
  PostFX が将来 `applyPreset` を他のタイミングで呼ぶなら、Game の `applyCameraSettings()` を呼ぶか、`PostFX` に `frameHoldOverride` を持たせてほしい。
- `RecOverlay` の親は `document.body`（`new RecOverlay(document.body)`）。F1b が `#hud` など別の親を想定しているなら Game の 1 行を変える。
