# 特徴 → 手法 → 道具の対応表

段階 1 で使う。左の列の特徴が参考画像にあれば、右の道具で作る。出典と理由は `experiments/visual-style-lab/docs/02-techniques.md`。

## 色と面

| 特徴 | 手法 | 道具（`experiments/visual-style-lab/src/`） |
|---|---|---|
| 色数が少ない・色指定どおり | 色彩設計: 物ごとに日なた・陰・暗部・ハイライトの色を参考画像から直接指定。照明は段を選ぶだけ | `ctx.mat({ color, shade, dark, hi })`（StyleMaterial） |
| 影がほとんど無い平らな色面 | 照明なし。面の向き（±X・±Y・±Z）ごとに色を塗る。腰壁・塗りの層 | `createPaint({ color: { px, nx, py, ... }, band, layers, cov })`（PaintMaterial） |
| 陰が色相ごと変わる（クリーム → セージ） | OKLab で明度を下げて色相を回す既定値 + 拾えた色は直接 | `style.toon.shade / dark / hi`（[明度倍率, 彩度倍率, 色相°]） |
| 光と影の境目がちぎれている | 段のしきい値をワールド座標のねじったノイズでずらす | `style.toon.noiseAmp / noiseScale`、材質の `noise: [強さ倍率, 大きさ倍率]` |
| 影の縁がちぎれている | 影を調べる位置を面に沿ってノイズでずらす | `style.shadowJitter`（m）+ `ctx.setSun(light)` |
| 影がタイル単位で階段状 | 影を調べる位置を升目の中心に丸める | `style.shadowQuant`（m）、材質ごとに `shadowQuant: false` |
| 光源で出ない影・光の形 | 縁のちぎれた貼り絵、影だけを落とす板 | `decalMaterial(...)`（Decal）、`b.shadowCaster(中心, 寸法)` |
| 梁の裏・天井が明るい（照り返し） | 下向きの面の F に足す | `style.toon.bounce`、材質の `bounce` |
| 白い塗り・雪・粉の斑 | ねじったノイズのしきい値。高さ・位置で増減 | `blotch: { scale, threshold, yRange, yGain, grad, only }` |
| 壁の短い傷・かすれ | 升目ごとの短い線 | `flecks: { scale, density, color, length, width, color2 }` |
| タイル・目地 | 面の向きに合わせた座標の升目 | `tiles: { size, line, color, jitter, broken }` |
| 掲示物・看板 | 1 枚のキャンバスにまとめて描き `map` で貼る | `THREE.CanvasTexture` + `ctx.mat({ map })` |
| 絵の具の塊（細部をつぶす） | 異方性クワハラ | `style.post.kuwahara`（`scale: 0.5` で約 1/4 の重さ） |

## 線

| 特徴 | 手法 | 道具 |
|---|---|---|
| 物の外形にだけ細い線 | 深度・法線・ID の段差。材質ごとの線の重み | `style.post.lines`、材質の `line` |
| 線が黒でなく暗い色 | 線の色を指定 | `lines.color` |
| 手描きの線の途切れ | ワールド座標のノイズで途切れさせる | `lines.breakup` |
| 長い廊下の床・壁に線が出ない | 浅い角度でしきい値を上げる（入れ済み） | — |

## 空気・光

| 特徴 | 手法 | 道具 |
|---|---|---|
| 奥が明るく淡い・濃い霧 | 距離と高さの霧。霧の色 = 空の色（同じ関数） | `style.fog`（density・heightFalloff・baseHeight・start・max・horizon・zenith・ground） |
| 中距離がシアンに寄る | RGB ごとの減衰 | `fog.extinction: [r, g, b]` |
| 光源の方向の霧が明るい | 霧の色に光源方向のにじみ | `fog.glow` |
| 霧が段になっている（平らな絵） | 霧の量を段に（境目はノイズ） | `fog.steps` |
| 曇りの日の柔らかい明るさ | 空がどれだけ見えるか（屋根の長方形が隠す割合） | 場面の材質（`src/scenes/station/mat.ts` が例） |
| 蛍光灯のにじみ | 光る板（放射 2〜15）+ ブルーム（しきい値 1.0） | `emissive` + `style.post.bloom` |
| 明るい所が暗い所へにじむ（新海誠作品の空気） | ディフュージョン（スクリーン合成） | `style.post.diffusion` |
| 画面の上が暗い・光が差す | パラ（乗算）・フレア（加算）のグラデーション | `style.post.gradients` |
| 全体の色調 | OKLab の lift / gamma / gain・彩度・色相・色の偏り | `style.post.grade` |
| 画像ごとに色調が違う | 視点の見た目・区域ごとの見た目 | `ViewDef.style`・`BuiltScene.styleZones` |

## 水・反射

| 特徴 | 手法 | 道具 |
|---|---|---|
| 濡れた床の水たまり | 平面の鏡像 + ノイズの水たまりの形の中だけ映す | `ctx.addReflector(point)` + `puddle` + `reflection.puddleOnly` |
| ちぎれた色面の反射 | 映り込みの明るさを段に・ゆがみ | `reflection.posterize / distort` |
| 明るい物だけが映る（白い筋） | 映り込みの明るさのしきい値 | `reflection.key / keySoft` |
| 水底のタイルが見える | 解析的な屈折（水底の高さの升目をたどる）+ 深さの吸収 | 場面の水の材質（`src/scenes/pool/water.ts` が例）、簡単には `underwater` |
| 画面には無いが映る物 | 映り込みにだけ出す層 | `b.box(..., { layer: 2 })`（1 = 映り込みに出さない） |

## カメラ効果

| 特徴 | 手法 | 道具 |
|---|---|---|
| 家庭用ビデオ・VHS | v2 の LensPass / VideoPass / CameraRig / RecOverlay | パネルの「カメラ効果」・`?film=tape&vhs=..`（`src/render/Film.ts`） |

## 採用しない物

| 手法 | 理由 |
|---|---|
| カメラマッピング（参考画像を視点から形へ投影） | その視点でしか合わない。歩けない。様式として再利用できない |
| 画面空間の反射（SSR） | 画面外の物が映らない。平らな床 1 枚なら鏡像が正確 |
| 体積の霧 | 重い。解析的な霧で足りる |
| TAA | 動くと線がにじむ |
