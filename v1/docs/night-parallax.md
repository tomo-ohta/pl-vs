# 夜景窓の視差（windowNight）

作成: 2026-09-17。更新: 2026-09-21（部屋ごとの位相）。実装は `src/render/MaterialLibrary.ts`（`createMaterial` の `night` 分岐、`NIGHT_PARS_GLSL`、`createNightLayers`、`nightLayers()`）。

## 方式
- `windowNight` の箔（`texture: 'night'`。legacy / untextured 以外）は 1 枚貼りの emissiveMap をやめ、`onBeforeCompile` で視差サンプリングを注入する。`customProgramCacheKey` に `-night` を足し、他の材質とプログラムを共有しない。
- 頂点で world 位置 `vNightWorld` と world 法線 `vNightNormal`（`modelMatrix`）を渡す。フラグメントで視線 D = normalize(worldPos − cameraPosition)、面の法線 N（視線に向く側へ反転）から、面の奥 d メートルの平面との交点 P' = worldPos + D · (d / max(−dot(D, N), 0.08)) を求め、接線軸（T = up × N、B = up）に射影して層の UV にする。
- 層は 2 枚（起動後 1 回だけ生成する CanvasTexture 1024 × 512。u 方向は周期、v はクランプ）:
  - 遠景 `nightFar`（奥 45 m、80 m × 40 m）: 空のグラデーション・地平線の街灯の滲み・遠いビル 2 列（窓 2 px、10% 点灯）・地面の暗さ。
  - 近景 `nightNear`（奥 12 m、40 m × 40 m、アルファ）: 手前のビルのシルエット（高さ 地平線 −3〜+9 m、幅 5〜12 m、6 割で 2〜7 m の隙間）と窓（4 × 5 px、9% 点灯。暖色 7 : 寒色 3）。
- 地平線はカメラの目の高さ − 0.2 m（無限遠の地平線は常に目の高さ。しゃがみでも自然に下がる）。多層階の部屋でも床の高さに依存しない。
- 出力は `totalEmissiveRadiance *= liminalNight()`（emissive 白 × emission .9 は従来どおり）。層は sRGB のまま描いているので pow 2.2 で線形に戻す。
- ガラス（transmission）越しでも emissive なので視差が働く。裏面から見た場合は法線を反転して同じ式（左右が鏡像になるだけ）。

## 部屋ごとの位相（2026-09-21）
- `windowNight` は共有 variant（ライトマップ対象外なので `forRoom` を通らず、部屋ごとの uniform を持てない）。代わりに頂点シェーダで部屋グループの world 位置（`modelMatrix[3].xz` を 2 m 格子に丸める）のハッシュ `vNightPhase`（0..1）を出し、遠景の u に `+vNightPhase`、近景の u に `+1.7 × vNightPhase` を足す。配置は seed から決定論なので位相も決定論。
- 隣の部屋の窓には別の街並み（建物の重なりも変わる）が並び、同じ部屋の窓帯は連続した街並みのまま。C01（seed 7）で変更前と建物の配置が変わることを確認。

## 雨・霧との組み合わせ（2026-09-21）
- 霧: emissive も `fog_fragment`（scene.fog）と roomFog（材質側、`linearToOutputTexel` 後）で沈むので、遠い窓は霧色に溶ける（M18: fog 0x0b0d14 near 6 / far 48。窓まで 3.5 m では沈まない）。順序の調整は不要だった。
- 雨（ParticleDetail rain の Points）: 窓の手前に白い粒が重なり、夜景の窓明かりと区別できる。Points は霧を受けないが、雨域は最大 8 m 角なので目立たない。

## 確認（2026-09-17）
- C01 閉館後の学校廊下（窓帯）: 窓の正面 1.8 m で 2 m 横に移動すると近景のシルエットが遠景・空に対してずれる。斜めから見ると奥行きが読める。コンソールエラー 0。`game.perf()` cpu 中央値 0.7 ms / gpu 5.3 ms（Tier high・1 部屋）。
- 従来の `createNightTexture()`（8 m × 4 m の 1 枚）は legacy / untextured と Node 環境の代替として残している。

## 残課題
- 層は固定シード 1 種類（位相だけ変わる）。建物の形そのものを部屋で変えるなら層を 2〜3 種類生成して位相で選ぶ。
- 雨で窓が滲む表現（窓ガラスの水滴・流れ）は未着手。
