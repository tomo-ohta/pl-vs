# 場面の作り方（作業の手引き）

## 動かし方

```bash
npm run dev --prefix experiments/visual-style-lab     # http://localhost:5176/
node experiments/visual-style-lab/tools/capture.mjs station        # 場面の全視点を撮って参考画像と比べる
node experiments/visual-style-lab/tools/capture.mjs pool-2 pool-3  # 視点を指定
node experiments/visual-style-lab/tools/capture.mjs --analyze station                     # 参考画像を測る（明度・彩度・色相・平坦率・上位 16 色・10 色）
node experiments/visual-style-lab/tools/capture.mjs --sample station-1 100,200 640,410  # 参考画像の色（7×7 平均）
node experiments/visual-style-lab/tools/capture.mjs --sample-both station-1 100,200       # 描画と参考画像の色を同じ位置で並べる
node experiments/visual-style-lab/tools/capture.mjs station-1 --grid 8x4 --perf            # 地域を細かく・重さも測る
node experiments/visual-style-lab/tools/capture.mjs station-1 --params 'set=post.bloom.strength=1.2&debug=5'  # 見た目の値・表示を一時的に上書き（JSON の値は ; 区切りで）
```

撮影結果は `scratch/captures/`（git 管理外）に出る。`--perf` を付けると 1 フレームの重さ（ms）・描画の回数・三角形の数も出る（目安: 1456×816 で 8 ms 以下）。

- `<view>.png`: 1456×816 の描画（参考画像と同じ寸法）
- `<view>-cmp.png`: 左に描画、右に参考画像（半分の大きさ）
- `<view>-edges.png`: 輪郭の重なり（参考 = 赤、描画 = 水色、重なり = 白）。**カメラと形のずれ**を見る。数値は「構図 F」（×100。70 以上でよく合っている）
- `<view>-diff.png`: 差の地図（半分の大きさ。赤 = 描画が明るい、青 = 暗い、緑 = 色みの差。下に参考画像を薄く敷く）
- `metrics.json`: OKLab の色差 ΔE（×100）、明度の差 ΔL（正 = 描画が明るい）、彩度、4×3 の地域ごとの ΔE / ΔL（左上から右へ、行ごと）

ブラウザでの操作:

- クリックで視点操作、WASD、Shift、C、Space、F（飛行）
- `[` `]` で参考画像の視点へ移る
- V で比較（重ねる / 左右で切る / 差分 / 参考画像だけ）
- G で表示（後処理なし・法線・ID・深度・線）
- 「カメラの値をコピー」で今の視点を `ViewDef` の形で得る

## カメラ効果（VHS）

`src/render/Film.ts` が v2 の LensPass・VideoPass・CameraRig・RecOverlay をつなぐ（README の「カメラ効果」）。
撮影ツールでは `--params 'film=tape&vhs=2'` で掛けた状態を撮れる（ノイズの種は固定）。既定はオフなので、参考画像との比較の数値には影響しない。

## しくみ

| ファイル | 役割 |
|---|---|
| `src/render/Style.ts` | 場面の見た目の設定 `StylePreset`（霧・段落とし・線・ブルーム・ディフュージョン・パラ / フレア・色調整・影の升目） |
| `src/core/ViewCam.ts` | 参考画像の視点のカメラ。`hit(x, y, axis, v)` で画素 → 面の上の点、`proj(p)` で点 → 画素、`rectOn` で外接矩形 → 面の上の長方形、`solveFromVanishingPoint(vp, fov)` で消失点から向き |
| `src/render/PaintMaterial.ts` | 照明なしの面ごとの色（平らな場面の標準）。腰壁・塗りの層・上から見た分布の絵 |
| `src/render/Decal.ts` | 縁のちぎれた貼り絵（描いた影・床の光・幅木の帯）。インクの縁・白い傷・階段状のちぎれ |
| `src/render/StyleMaterial.ts` | 材質 `ctx.mat({...})`。色指定（日なた・陰・暗部・ハイライト）、模様（タイル・かすれ・白い斑・水たまり）、映り込み、水面下の吸収 |
| `src/render/Post.ts` | 後処理（クワハラ → ブルーム・ディフュージョン → 線・パラ・色調整 → sRGB）。クワハラは原寸で約 6 ms、`kuwahara.scale: 0.5` で約 1/4 |
| `src/render/PlanarReflector.ts` | 平面の鏡像。`ctx.addReflector(point)` で作り、材質の `reflection: { texture: r.target.texture, matrix: r.matrix, ... }` で読む。反射する面自体は `r.hide.push(mesh)` |
| `src/render/Sky.ts` | 空のドーム（霧の色の関数と同じ。継ぎ目が出ない）。`SceneDef.sky` で雲の帯 |
| `src/scenes/Builder.ts` | 箱・円柱・板を置く。`collide: true` で当たり判定、最後に `finalize()` で材質ごとにまとめる。`layer: 1` = 映り込みに出さない、`layer: 2` = 映り込みにだけ出す |
| `src/scenes/types.ts` | `SceneDef`（場面）・`ViewDef`（参考画像 1 枚の視点）・`SceneContext` |
| `src/core/*` | 歩行（Player）・入力・当たり判定（軸に沿った箱。床の上面が歩ける高さ） |

### 色の決め方（色彩設計）

`ctx.mat({ color, shade, dark, hi })` の 4 色は、参考画像から `--sample` で拾った色をそのまま入れる。
照明（平行光源・半球光・点光源・影）は **どの色を使うかを選ぶためだけ** に使う。

| 照明の倍率 F | 塗る色 |
|---|---|
| F > しきい値[0]（`toon.thresholds[0]`） | `hi` |
| F > しきい値[1] | `color`（日なた） |
| F > しきい値[2] | `shade`（陰） |
| それ未満 | `dark`（暗部） |

F は、照明の明るさを色指定に対する倍率で表したもの（= 色指定のままなら 1）。
平行光源の強さ π で真正面から当たると F = 1、半球光の強さ I なら F ≈ I / π。
省略した色は、場面の `toon.shade / dark / hi`（OKLab の明度の倍率・彩度の倍率・色相の回転）で自動に作る。

境目はワールド座標のねじったノイズでずれる（`toon.noiseAmp`・`noiseScale`、材質ごとに `noise: [強さ倍率, 大きさ倍率]`）。
`toon: 0` で普通の描画（駅のような半写実の所）。`unlit: true` で照明なし（光る板・看板）。

### 模様

- `tiles`: 面の向きに合わせたタイル目地（大きさ・目地の幅と色・ばらつき・途切れ）
- `flecks`: 壁の短い傷（かすれ）。2 色目で暗い傷
- `blotch`: ねじったノイズの斑。`yRange` と `yGain` で上ほど少なく、`grad` で位置によって増減。`only: 'floor' | 'wall'`
- `puddle`: 水たまりの形。`reflection.puddleOnly` と組み合わせる
- `underwater`: 水面より下の色の吸収とコースティクス
- `map`: テクスチャ（掲示物・看板など。キャンバスで描いて `THREE.CanvasTexture`）

足りない表現は、場面のファイルの中で `THREE.ShaderMaterial` を書いてよい。
霧と同じ色にするには `FOG_GLSL`（`sl_applyFog`）と `styleUniforms` を使い、2 枚目の出力 `layout(location = 1) out highp vec4 gInfo;` に `vec4(法線.xy*0.5+0.5, ID, 線の重み)` を書く（`Sky.ts` が例）。

### 色をその場で試す

材質に `name` を付けると、開発中のページの console で
`__lab.mats()`（名前 → 材質）・`__lab.setColors('wall', { color: '#...', shade: '#...' })` で色を変えて確かめられる（再読み込み不要）。

### 光の影

- `ctx.setSun(light)`: 影を升目に丸める（`style.shadowQuant`、m）・ずらす（`style.shadowJitter`、m）ときの基準の平行光源。材質の `shadowQuant: false` でその材質だけ使わない
- 影のカメラは場面に合わせて固定する（歩いても段が動かない）。`mapSize` 2048〜4096

### 場面の毎フレームの処理と区域

- `update(dt, t, camera)`: 歩いている間の毎フレーム（撮影中は呼ばれない）
- `beforeRender(camera)`: 描く直前に毎回（撮影中も）。カメラの位置に合わせた光・影の範囲の切り替えなど
- `styleZones: [{ min, max, style }]`: カメラが箱に入るとその見た目にする（先に書いた方が優先。どこにも入っていなければそのまま）。
  材質の自動の陰の色は場面の見た目で一度だけ作るので、区域で色を変えるときは材質に色を直接書く
- `toon.bounce`（場面）・材質の `bounce`: 下向きの面に照り返しを足す（梁の裏・天井を 1 段明るく）
- `staticShadows: true`: 影の地図を毎フレーム描かない（4096 の影で約 6 ms 軽くなる）。太陽を動かしたら `ctx.updateShadows()`
- `b.shadowCaster(中心, 寸法)`: 影だけを落とす見えない箱（光源では作れない形の「描いた影」）
- 材質の `reflection.key`: 明るい映り込みだけを出す（白い筋の映り込み）

### 視点（ViewDef）

`eye`（目の位置）・`yaw`（0 で -Z、正で左へ回る）・`pitch`（正で上）・`fov`（縦の画角、度）。
参考画像の消失点・地平線・物の位置を、比較の「重ねる」と撮影ツールで合わせる。
視点ごとに `style` を上書きできる（同じ場面でも画像ごとに色調が違う時）。

## 合わせ込みの手順

全体の流れと理由は [05-method.md](05-method.md)、合格の条件つきの手順は スキル `.claude/skills/reference-stage/`。下は短い版。

1. 参考画像を見て、物の配置・寸法を決める（人の目の高さ 1.5〜1.6 m、扉 2.0〜2.1 m、天井 2.5〜3 m などから逆算）
2. 粗い箱で配置し、視点の画角と位置を合わせる（線・角が重なるまで）
3. `--sample` で各面の色を拾い、材質に入れる（日なた・陰・暗部）
4. 光の向きを決め、どの面がどの段になるかを参考画像に合わせる
5. 霧・線・ブルーム・色調整を合わせる
6. 小物・模様を足す
7. 撮影ツールの ΔE と地域ごとの ΔE が大きい所から直す。数値だけでなく、比較画像を目で見て形・色・質感を確かめる
