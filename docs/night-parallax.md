# 夜景窓の視差（windowNight）

作成: 2026-09-17。実装は `src/render/MaterialLibrary.ts`（`createMaterial` の `night` 分岐、`NIGHT_PARS_GLSL`、`createNightLayers`、`nightLayers()`）。

## 方式
- `windowNight` の箔（`texture: 'night'`。legacy / untextured 以外）は 1 枚貼りの emissiveMap をやめ、`onBeforeCompile` で視差サンプリングを注入する。`customProgramCacheKey` に `-night` を足し、他の材質とプログラムを共有しない。
- 頂点で world 位置 `vNightWorld` と world 法線 `vNightNormal`（`modelMatrix`）を渡す。フラグメントで視線 D = normalize(worldPos − cameraPosition)、面の法線 N（視線に向く側へ反転）から、面の奥 d メートルの平面との交点 P' = worldPos + D · (d / max(−dot(D, N), 0.08)) を求め、接線軸（T = up × N、B = up）に射影して層の UV にする。
- 層は 2 枚（起動後 1 回だけ生成する CanvasTexture 1024 × 512。u 方向は周期、v はクランプ）:
  - 遠景 `nightFar`（奥 45 m、80 m × 40 m）: 空のグラデーション・地平線の街灯の滲み・遠いビル 2 列（窓 2 px、10% 点灯）・地面の暗さ。
  - 近景 `nightNear`（奥 12 m、40 m × 40 m、アルファ）: 手前のビルのシルエット（高さ 地平線 −3〜+9 m、幅 5〜12 m、6 割で 2〜7 m の隙間）と窓（4 × 5 px、9% 点灯。暖色 7 : 寒色 3）。
- 地平線はカメラの目の高さ − 0.2 m（無限遠の地平線は常に目の高さ。しゃがみでも自然に下がる）。多層階の部屋でも床の高さに依存しない。
- 出力は `totalEmissiveRadiance *= liminalNight()`（emissive 白 × emission .9 は従来どおり）。層は sRGB のまま描いているので pow 2.2 で線形に戻す。
- ガラス（transmission）越しでも emissive なので視差が働く。裏面から見た場合は法線を反転して同じ式（左右が鏡像になるだけ）。

## 確認（2026-09-17）
- C01 閉館後の学校廊下（窓帯）: 窓の正面 1.8 m で 2 m 横に移動すると近景のシルエットが遠景・空に対してずれる。斜めから見ると奥行きが読める。コンソールエラー 0。`game.perf()` cpu 中央値 0.7 ms / gpu 5.3 ms（Tier high・1 部屋）。
- 従来の `createNightTexture()`（8 m × 4 m の 1 枚）は legacy / untextured と Node 環境の代替として残している。

## 残課題
- 層は固定シード 1 種類。部屋ごとに位相をずらす（u オフセットの uniform）と同じ街並みが並ばない。
- 雨（M18）や霧（FogDepth）と組み合わせた見え方は未調整。
