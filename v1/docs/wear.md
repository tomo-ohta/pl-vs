# 低確率の破れ・窓の夜景・壁色プリセット（担当 W・2026-09-16）

写実化第 2 段のうち「全部屋共通の破れ」「窓の外の夜景」「壁色のプリセット」「前回の申し送り（食堂・倉庫・バックヤード・トイレ）」の実装記録。

変更ファイル: `src/generators/wear.ts`（レイアウト側。スタブ → 実装）、`src/render/wearEffects.ts`（ランタイム側。スタブ → 実装）、
`src/generators/CorridorGenerator.ts`（学校・マンションの窓を実際の開口に）、`src/generators/RoomGenerator.ts`（食堂の窓と机間、トイレの小便器）、
`src/generators/furniture.ts`（窓の開口・ガラス・夜景、カゴ車、小便器）、`src/generators/presets.ts`（オフィス・病院の壁色）、
`src/generators/GridGenerator.ts`（倉庫の棚の高さ = 段板ピッチ、C12 のカゴ車）、`docs/wear-shots/*.jpg`（確認のスクリーンショット）。共有ファイル（layout.ts / footprint.ts / common.ts / RoomBuilder / MaterialLibrary / Modifier）は編集していない。

## 1. 破れ（wear）

### 種類と確率

対象部屋の **38%**（`WEAR_CHANCE`）に何か 1 つ。1 部屋に 2 種以上は入れない。種類は「その部屋に適用できる種類」の中から重み付きで選ぶ（指示の 25 / 15 / 20 / 20 / 10）。
天井板の空きが無いなどで置けなければ次の候補へ回る。

| 種類 | 重み | 内容 | 見た目 |
|---|---|---|---|
| flicker | 25 | 器具（頭上の薄い発光箔: トロファー / 露出管 / ダウンライト / 吊り灯）**1 本だけ**を切れかけに。箔は `lightYellow`（黄ばんだ管）に差し替え、`kind: 'wear.flicker'` を付ける。点光源を持つ器具を 8 割で優先 | ランタイムで明滅（下記）。管ペアの片方だけが黄ばんで明滅する |
| lightOff | 15 | 器具 1 本（管ペアなら両方）を `lightOff` に。対応する LightSpec（水平 0.7 m・高さ 1.2 m 以内）を除く | 列の中に 1 つだけ暗い器具 |
| ceilingMissing | 20 | 天井板 1 枚の欠落。天井格子（0.6 m。ローカル座標の倍数）に揃えた 0.6 m 角の `void` 箔を天井面の 6 mm 下に置く（上端は天井スラブの中に埋めて側面を隠す）= 暗い天井裏の穴。6 割で外れた板（天井材の縦の薄板 0.6 m）が 1 辺から垂れ下がる。ランタイムで穴の材質を金属 1.0 + 黒（鏡面反射なし）の部屋専用複製に差し替える | 格子の中の黒い 1 枡と垂れた板 |
| ceilingStain | 20 | 天井板 1 枚の黄ばみ。同じ格子に揃えた 0.6 m 角の `wainscotCream` 箔を天井直下 5 mm に | 1 枡だけ黄褐色（担当 D の「シミ」デカールとは役割を分ける: こちらは板全体） |
| signTilt | 10 | 幅 0.4 m 以上の壁面サイン（吊り下げ板は除く）1 枚を 2〜4° 傾ける。SignSpec に回転が無いので角度を `wear.tiltDeg` に記録し、RoomBuilder 後に `wearEffects` が Mesh を面の法線まわりに回す | 僅かに傾いた案内板 |

適用できる部屋の条件: flicker / lightOff は器具（非ソリッド・厚 12 cm 未満・床上 1.9 m 以上かつ天井から 1.6 m 以内・面積 0.01〜1.5 m²）がある部屋、
ceiling* は `palette.ceiling` が `ceilingTile` / `ceilingWhite`（板の天井）でシェルに天井がある部屋、signTilt は幅 0.4 m 以上の壁サインがある部屋。
天井板の位置は 0.6 m 格子（ローカル座標の倍数）に揃え、壁から 0.6 m 以上、天井付近の内装（器具のトレイ・吊り看板・ダクト）から 0.15 m、発光する器具からは少なくとも一方の軸で 0.7 m、穴ソケットから 1.6 m 離す（24 回試して無ければ別の種類へ）。

スキップ: Mythic / Legendary、`LightingPhase` 付き（U01 / R02 / E04 / L10 / M14。照明演出が競合）、E03 ロール（`L.roll`）、RenderStyle（`L.render.style`）。
Adapter は generateLayout を通らないので対象外。

### 実装方式

- **レイアウト側** `applyWearLayout(L, p)`（generateLayout の末尾、Modifier と デカールの間）: 乱数は `p.rng.fork('wear')` だけ（fork は状態を進めないので他の乱数列に影響しない）。
  footprint・ソケット・ソリッド（当たり判定）は変えない。追加する箔はすべて非ソリッド。結果は `RoomLayout` の拡張フィールド `wear: WearPlan`（型は `WearLayout`。layout.ts は編集しないので wear.ts 側で定義）。
  `wearOf(L)` / `wearCandidates(L)` / `planWear(L, rng)` / `wearSkipped(L, p)` を公開（集計・検証用）。
- **ランタイム側** `applyWearEffects(built, layout, ctx)`（RoomBuilder.build の末尾）:
  - flicker: 対象箔は部屋で唯一の `lightYellow` なので、材質別の結合メッシュがその箔だけになる。`built.group` を traverse し、ジオメトリの AABB が箔 + 6 cm に収まる発光材質の Mesh を探して材質を部屋専用に複製（`onBeforeCompile` / `customProgramCacheKey` を付け直す。`userData.disposable` に登録して RoomBuilder.dispose で解放）、`emissiveIntensity` を揺らす。
    対応する PointLight（`built.lights[wear.lightIndex]`。位置で照合）は `userData.baseIntensity` を揺らし、**暗くなる方向だけ** `intensity` を即時に下げる（明るくなる方向は LightBudget の補間 ≈ 0.13 s に任せる。予算がフェードアウト中のライトを止めない）。管ペアの片方だけのときは点光源の振幅を半分にする。
    明滅の形: 定常 0.9（古い管。±3% のうねり）→ 1.5〜6 s おきに「連続チラつき（2〜7 回。消 0.03〜0.12 s / 点 0.04〜0.16 s、再点灯は 1.0〜1.15 倍）」55% /「消灯 0.25〜1.2 s（0.03〜0.08）→ 6 割でチラつきながら復帰」25% /「1 回の短い減光」20%。位相は Math.random（決定論の対象外。LightingPhase の seedPhase ±15% より不規則で強い）。
    `tier.flicker === false`（Low）では RoomEffect を作らない（箔は黄ばんだまま点灯）。dispose で baseIntensity / emissiveIntensity を戻す。
  - signTilt: `built.signs` から spec を探し `mesh.rotateZ(tiltDeg)`（一度だけ。全 Tier）。
  - ceilingMissing: 穴の `void` 箔を含む結合メッシュの材質を部屋専用に複製し、金属 1.0 + 黒 + envMap 0 にする（非金属の F0 = 4% の鏡面反射で灰色に浮くのを防ぐ。一度だけ。全 Tier）。
  - lightOff / ceilingStain: レイアウト側の箔だけで完結（ランタイム処理なし）。

### 出現率（Node 集計）

- 踏破（`WorldManager` を seam-stats と同じ手順で 8 seed × 30 部屋 = 240 部屋。実際の抽選重みで部屋が出る）: **34.6%（83 / 240）に何か 1 つ**。内訳 flicker 39 / lightOff 26 / ceilingMissing 6 / ceilingStain 4 / signTilt 8。
  板の天井を持たないテンプレート（駐車場・倉庫・サービス通路・カラオケ・ホテル / マンションの塗り天井）では ceiling* が候補に入らず、廊下では器具から 0.7 m 離れた格子の空きが少ないため、flicker / lightOff の比率が名目より高い。
- 全定義 × seed 5 × variant 3 = 1,770 レイアウト（Mythic / Legendary / LightingPhase の 630 を含む）: 例外 0、非決定論 0。対象部屋 1,140 のうち 39.3% に破れ（ゲート 38% + 置けずに別種へ回った分）。
  確率判定を外して種類だけ集計（456 レイアウト）: flicker 33.1% / lightOff 25.5% / ceilingMissing 14.6% / ceilingStain 18.5% / signTilt 8.3%、候補が無い定義は VerticalCore（C20 / E02 / E10 / E15）と Bridge（R05）のみ。
- 三角形: flicker / lightOff / signTilt は +0、ceilingStain +12、ceilingMissing +12〜24（箔 1〜2 枚。RoomBuilder の 1.25 m テッセレーションで 0.6 m の箔は 12 三角形）。上限 +200 の内側。

### ブラウザ確認（Tier high、`?nolock=1&new=1&seed=<S>&force=<ID>`）

- seed 7 r12（U06 待合室）flicker: 対象メッシュ検出 OK（材質名 `lightYellow`、部屋専用 clone）、RoomEffect 登録 OK。8 秒間の時系列: emissiveIntensity 0.42〜2.75（定常 2.05〜2.29）、PointLight.intensity 0.52〜2.77。消灯 → 即時に 0.5 まで落ち、復帰は 0.13 s の補間でじわっと戻る（`docs/wear-shots/W-U06-flicker-r12.jpg`: 他の白いトロファーの中で 1 台だけ黄ばんだ器具）。
- seed 7 r8（C03 ホテル廊下）lightOff: 対象位置の LightSpec 0、ダウンライト 1 つが暗い。
- seed 9 r1（C02 開始部屋）ceilingMissing: 格子に揃った暗い 1 枡と垂れた板（`docs/wear-shots/W-C02-ceilingMissing-r1.jpg`）。穴の箔は `postfx: 'off'` では 23/255 の黒だが、既定の `'clean'`（GTAO + bloom + MSAA）では 111/255 の灰色に浮く。原因は隣のトロファー（emission 2.5、0.8 m）からの bloom の滲み（材質側の要因ではない: 穴の材質を金属 1.0 + 黒 + envMap 0 にして鏡面反射を消しても、また PointLight を除いても値は変わらず、postfx を切ると黒になる）。担当 P への要望（bloom の閾値 / 半径）を `docs/visual-requests.md` に記載。こちらは器具から 0.7 m 以上離す規則で軽減。
- 踏破 3 seed × 10 部屋（seed 9 / 7 / 23）: `world.log` の ERROR 0、window error 0（下記「検証」）。

## 2. 窓の外の夜景

指示は「ガラスの裏の void 箔を windowNight に差し替え、ガラス面から 0.3〜0.6 m 奥に置く」だったが、窓帯は厚 0.15 m の外壁の**室内面に貼った箔**で、壁は不透明なので奥に置いても見えない。
足跡（footprint）の外へ箔を出すと隣接して配置される部屋の中に現れる。そこで **シェルの壁を実際に抜く** 方式にした:

- 窓の開口を `buildShell` に**擬似ソケット**（`type: 'door'`、`sill` = 窓の下端、`height` = 窓の高さ）として渡し、壁を下端〜上端で抜く。擬似ソケットは `L.sockets` には入れない（接続・地図・扉には使わない）。
  壁の下（腰壁）と上（まぐさ）は残るので当たり判定はそのまま。プレイヤーのジャンプ高は 0.9 m（`PLAYER.jump` 4.2 / 9.8）で、下端 1.0 m 以上の開口には入れない。学校・食堂はさらに**ガラスをソリッド**（開口を塞ぐ当たり判定）にしてある。
- 夜景 `windowNight` の箔は壁の**外面側**（室内面から WALL_T − 6〜12 mm 奥。足跡の内側）に置き、開口より上下左右に 0.12〜0.15 m 大きくする（余白は残った壁の中に隠れる）。ガラスから約 9 cm、室内面から約 13 cm 奥。壁厚ぶんの見付（ジャンブ）が見えて「壁に開いた窓」に見える。
  0.3〜0.6 m の奥行きは壁厚 0.15 m の制約で出せない（要望は `docs/visual-requests.md`）。
- 外の見え方（暗い運動場と街灯 / 夜の街 / 駐車場の街灯）は担当 M の `windowNight` テクスチャに委ねる。箔の寸法: 学校 = 高さ 1.0 m（1.2〜2.2）+ 余白、長さは壁区間ごとに最長 25 m / マンション = 高さ 1.43 m（1.15〜2.58）/ 食堂 = 高さ 1.4 m（1.0〜2.4）。

| 場所 | 開口 | 中身 |
|---|---|---|
| 学校廊下（CorridorSchool。右側の壁） | 1.2〜2.2 m。壁区間の両端 0.3 m と扉開口 ±0.3 m は壁のまま | 夜景 + ガラス（ソリッド。室内面から 4.5〜6 cm）+ 窓台（壁の上端を覆い 6 cm 室内へ出る木）+ 方立て 2.4 m ごと + 上桟（木） |
| マンション共用廊下（ApartmentCorridor。右側の手すり壁の上） | 1.15〜h−0.12 m（ガラス無し = 外気） | 夜景 + 壁の上端を覆う金属の笠木（既存の 1.1〜1.15 m の帯と連続） |
| 社員食堂（LargeRoom 食堂。入口の反対の長辺） | 1.0〜min(h−0.5, 2.4) m。空き区間（ソケット ±0.7）の両端 0.4 m は壁 | 夜景 + ガラス（ソリッド）+ 窓台（9 cm 出る）+ metalDark の方立 1.5 m ごと + 上桟（0.065 までガラスより前に出し z-fight を避ける） |

Node 検証（4 seed × 全 variant）: C01 64 ケース全てに windowNight ≥ 1 枚 / ソリッドのガラス = 夜景の枚数、夜景の中央を覆う壁箱 0（壁が抜けている）。C08 64 ケース、C09 96 ケースも同じ。
ブラウザ: seed 11 C01（`docs/wear-shots/W-C01-window-diag.jpg` / `W-C01-window-close.jpg`）は緑の腰壁の上に見付のある窓帯、外は暗い青灰に点々の明かり。seed 11 C08（`docs/wear-shots/W-C08-night-diag.jpg`）は手すり壁と笠木の上に夜の街のシルエット。seed 9 C09（`docs/wear-shots/W-C09-window-mid.jpg` / `W-C09-window-close.jpg`）は机の列の向こうに窓帯。

## 3. 壁色のプリセット（presets.ts）

| テンプレート | 前 | 後 | 理由 |
|---|---|---|---|
| CorridorOffice | wallWhite | **wallBeige** | 参考 2「ベージュ無地」。wallCream で試したが CC0 の Plaster001 は斑が強く「無地」に見えなかった（`docs/wear-shots/W-C02-wall-cream-entry.jpg`）。wallBeige（Wallpaper001A）は無地の黄褐（`docs/wear-shots/W-C02-wall-beige-entry.jpg`）。albedo の明度は wallWhite 比 −16%（指示の −10% を超える）が、トロファー 1.0 の照明下では十分明るく、担当 M の wallWhite 暖色化とは重ならない |
| CorridorHospital | wallWhite | **wallCream** | 参考 5「生成り」。腰壁 wainscotCream との差が小さい点は材質側の要望に |
| 待合室（LargeRoom）/ 休憩室（SmallRoom wallCream）/ 学校（wallCream） | — | 現状維持 | 担当 M が wallWhite を暖かい生成りへ寄せる分と二重に暗くしない |

RoomGenerator 内の差し替え（更衣室 wall → wallWhite、食堂 / 待合室 floor → floorLino）は `p.palette` のスプレッドなので BASE の変更と整合する。

## 4. 前回の申し送り

- 食堂の机間 0.3 → **0.9 m**（`furnishCafeteria` の unit 2.1 → 2.7）。独立した 4 人掛けに見える（`docs/wear-shots/W-C09-entry.jpg`。seed 9 で机 90 台、隣接机の最小間隔 0.90）。
- 倉庫の段板ピッチ: 描画側（ArchitecturalDetails の `max(0.9, h/3)`）は担当 L1 のファイルなので、棚の高さを 4.2 → **3.3 m** にして段板ピッチを 1.4 → 1.1 m、段板 4 枚（0.25 / 1.35 / 2.45 / 3.25）にした。`rack()` の段ボールの段も同じ式で追従。
- C12 バックヤードの**カゴ車**（`furniture.rollCage`）: 1.1 × 0.8 × 1.7 m。デッキ + キャスター + 支柱 4 + 横桟 5 段 × 3 面 + 縦桟、中に段ボール 1〜2 段（ソリッド。中に入り込めない）。棚列と平行な壁沿いの空き区間に 2〜3 台（扉前・穴・棚から 0.35 m 以上）。乱数は `p.rng.fork('v<variant>').fork('cages')`（棚・照明の乱数列は変えない）。seed 9 で 2 台（`docs/wear-shots/W-C12-cage.jpg`）。
- トイレの**小便器**（`furniture.urinalRow`）: 壁掛けの白い器 0.35 × 0.6 × 0.4（床上 0.55、`signPlate` = 半艶の白、ソリッド）+ 洗浄管 + センサー板 + 間の仕切り板、ピッチ 0.75、3〜4 台。ブース・洗面器と別の面（洗面器の向かいを優先）。seed 9 C16 で 4 台（`docs/wear-shots/W-C16-urinals.jpg`）。
- 待合室の掲示ポスターは担当 D のデカールに任せる（未実装）。
- 病院のベンチの隅の余白を 1.8 → 2.0 m（直交する壁の扉前 1.8 m にベンチの端が掛かる 1 例 R17 seed 777 v0 を解消）。

## 5. Tier

| Tier | flicker | その他の破れ | 窓 |
|---|---|---|---|
| low | 明滅なし（黄ばんだ箔は点灯したまま。RoomEffect 0） | 箔・傾きはそのまま | 同じ |
| mid / high | 明滅あり（`tier.flicker`） | 同じ | 同じ |

## 6. 検証

- `npx tsc --noEmit -p .`: 本担当のファイルはエラー 0（`src/generators/decals.ts` の未使用 import は担当 D の編集中）。
- `node tools/seam-stats.mjs --seeds 3 --rooms 40`: deterministic true、loadMismatch 0 / 0、overlap 0、voidOpenings 0、deadEnd 0。
- Node ハーネス（scratchpad `wear-check.mjs`。全定義 × seed 5 × variant 3）: 例外 0、非決定論 0、扉前ゾーンのソリッド（新規）0（検出された 76 件は VerticalGenerator の床スラブと EraPreset の床箔、既存）。
- ブラウザ（Tier high）: seed 9 / 7 / 23 × 10 部屋の踏破（各部屋へ spawnPointOf → teleport → enterRoom → 60 step、最後に 120 step）で `world.log` ERROR 0、window error 0、コンソール error 0。踏破中の破れ: seed 9 = ceilingMissing / lightOff ×2 / signTilt、seed 7 = lightOff / ceilingStain、seed 23 = flicker ×3 / lightOff / ceilingMissing / signTilt。

## 7. 未対応・制約

- 窓の奥行きは壁厚 0.15 m が上限（ガラスから約 9 cm）。「0.3〜0.6 m 奥」には footprint の外に箔を出すか、生成器側で壁を室内へ 0.3 m 厚くする必要がある（隣室との干渉・廊下幅の減少のため今回は見送り）。
- signTilt は SignSpec に回転が無いため、RoomBuilder 後に Mesh を回している（レイアウトは角度を記録するだけ）。`SignSpec.roll` が入れば layout 側で完結する。
- ceilingMissing の穴は箔（平らな黒）で奥行きは無い。天井スラブを抜く（footprint.ts の天井穴）ほうが本物だが共有ファイルのため見送り。
- 破れの出現はテンプレート依存: 板の天井が無い部屋は照明系のみ、VerticalCore / Bridge には入らない。
- 窓の夜景テクスチャ（担当 M）は現在 1 種（都市の窓明かり）。学校（暗い運動場と街灯）・食堂（駐車場）向けの差し替えは要望に。
