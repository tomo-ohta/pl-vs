# Epic 部屋の部屋別ドレッシング（担当 E・2026-09-17）

`docs/reference-rarities-analysis.md` の EPIC 表を目標に、`src/generators/dressing/epic.ts`（スタブ → 実装）で E01〜E20（E05 / E10 は欠番・オミット）の
「ぱっと見の印象」を決める大物・サイン・光を足した。編集したのはこのファイルだけ（共有ファイル・Generator・Modifier・材質は変えていない）。
共有ファイルへの要望は `docs/visual-requests.md` の「E →」節。

## 方針

- 呼び出し: `generateLayout` で Generator の直後・Modifier の layout フックの前（`dressing/index.ts` → `dressEpic(L, p, rng)`）。乱数は `p.rng.fork('dress')` だけ。
- 不変条件: footprint・ソケット・扉前 1.6 m（`furniture.doorZones`）・動線 1.2 m は変えない。ソリッドを置くときは `canPlace`（足跡の内側・扉前・床穴・既存ソリッドとの重なり）を通し、
  ユニット単位で置く（`placeUnit`）。壁に貼る箔はすべて非ソリッド。
- 予算（部屋あたり 箱 +300 / 三角形 +40k / ライト +2）は `Ctx` のカウンタで守り、超える分は置かない。反復物は `L.instances`（E06 の市松、E09 の台座、E20 の座面・背）。
  サインは Modifier（FakeSignage / NoiseGate / GraphReference / ObservationRewire）の分を残して 40 枚まで。
- Modifier との分担: Modifier が既に出す演出（FakeSky の空、InvertedShadow の単一光と逆影、WaterWall の水面、VehicleRide の車両、PastWindow の窓、GraphReference の額、
  FakeSignage / NoiseGate のサイン、MovingWalls のパネル、TemperatureField の照明色、ColorMissing のマスク）は重ねない。Modifier が後から読む値（FakeSky が差し替える
  `palette.ceiling` の天井箔、`shellCount`、InvertedShadow が置き換える `L.lights`）は壊さない。
- Modifier と表示を揃えるため、その Modifier が使う乱数列の先頭（`p.rng.fork('mod:<Id>')`）を「読むだけ」の箇所が 3 つある: E02 の年代（EraPreset `pickIndices`）、
  E15 の階数 n（FakeSignage `fractionalFloors`）、E19 の温度勾配の向き（TemperatureField `hotExit`）。fork は状態を進めないので他の乱数列には影響しない。
  Modifier 側の乱数の使い方が変わると表示が食い違うだけで、破綻はしない（コード内コメントに明記）。
- 検証用スイッチ: `globalThis.__epicDressingOff = true` でドレッシングを丸ごと省く（ブラウザで構築時間・箱数の増分を同じ部屋で比べるため。通常は未定義）。

## 検証

- `npx tsc --noEmit -p .`: `epic.ts` のエラー 0（同時刻に他担当が編集中の `src/render/RoomBuilder.ts` / `dressing/mythic.ts` にだけエラーがある）。
- Node ハーネス（scratchpad `p6/epic/`。`compare/` と同じ Vite SSR ビルド → Node。Modifier 43 種登録済み）: E01〜E20（E05 / E10 除く）× seed 7 / 11 / 23 × variant 0 / 2
  （VerticalCore は variant 1 種）= 99 ケース。**例外 0、決定論（同条件 2 回の JSON 一致。ドレッシング直後と generateLayout 全体の両方）0 件の不一致、
  予算超過 0、扉前のソリッドの増加 0（Generator 直後 vs ドレッシング後、および Modifier 込みのドレッシング無し vs 有り）、サイン 48 枚超 0。**
  三角形は surfaceBox の規則（面取り材質 108 / 1.25 m テッセレーション）を ArchitecturalDetails の表示箱に当てた推定値。
- ブラウザ（Tier high、`?nolock=1&new=1&seed=7&force=<ID>`。入口からの構図と要点の近接を `docs/reference-epic/<ID>-s7-*.jpg` に保存）: 全部屋で `world.log` の ERROR 0、
  window error 0。構築時間は同じ部屋を `__epicDressingOff` 有り / 無しで 5 回ずつ `builder.build` して中央値を比較（他担当の HMR リロードが頻発していたため計測にはノイズがある）。

### 予算の実測（Node ハーネス。Δ = ドレッシングによる増分、avg / max は 6 ケース。構築 ms はブラウザ seed 7 の中央値 off → on）

| ID | Δ箱 avg / max | Δ三角形 avg / max | Δ灯 | Δサイン max | instances | 構築 ms off → on |
|---|---|---|---|---|---|---|
| E01 | +5 / +7 | +79 / +116 | 0 | 2 | 0 | 5.0 → 5.9（+18%） |
| E02 | +13 / +13 | +333 / +336 | +1 | 3 | 0 | 9.6 → 13.0（+3 ms。SignAtlas が新設される分） |
| E03 | +10 / +14 | +508 / +720 | 0 | 0 | 0 | 7.3 → 9.0（+23%） |
| E04 | −11 / +9 | −2989 / 0 | 0 | 0 | 0 | 28.2 → 19.5（家具を捨てるので減る） |
| E06 | +55 / +68 | +4238 / +6232 | 0 | 0 | 318 | 39.6 → 34.6 |
| E07 | +6 / +12 | +104 / +208 | 0 | 0 | 0 | 6.4 → 6.3 |
| E08 | 0 | 0 | 0 | 0 | 0 | （保留） |
| E09 | +32 / +32 | +768 / +768 | 0 | 0 | 32 | 62.8 → 70.6（+12%。画面 40 枚全点灯の時点では 62.5 → 90.4 = +45% だった） |
| E11 | +18 / +21 | +1294 / +1716 | +1 | 2 | 0 | 137.4 → 147.4（+7%） |
| E12 | +8 / +9 | +96 / +108 | +1 | 0 | 0 | 8.2 → 8.0 |
| E13 | +10 / +11 | +122 / +132 | 0 | 0 | 0 | 12.5 → 13.1（+5%） |
| E14 | +39 / +39 | +484 / +484 | +1 | 0 | 0 | 46.4 → 47.5（+2%） |
| E15 | +13 / +13 | +244 / +244 | +1 | 3 | 0 | 9.4 → 11.5（+22%） |
| E16 | 0 | 0 | 0 | 2 | 0 | 4.8 → 4.5 |
| E17 | +21 / +21 | +252 / +252 | 0 | 1 | 0 | 52.2 → 54.6（+5%） |
| E18 | +6 / +7 | +202 / +220 | 0 | 0 | 0 | 15.4 → 16.0（+4%） |
| E19 | +6 / +8 | +795 / +896 | 0 | 2 | 0 | 120.8 → 136.4（+13%） |
| E20 | +123 / +128 | +3920 / +4136 | 0 | 1 | 360 | 54.5 → 44.7（家具を捨てて椅子列に置き換える） |

構築時間で効くのは箱の数より**発光体（焼き込みの光源）の数**で、E09 は画面 40 枚を全部 screenGlow にした時点で +45% になった（焼き込みは光源数 × 頂点数）。
16 枚点灯 / 16 枚消灯に減らして収めた。E02 / E03 / E15 は絶対値 +2〜3 ms（サインのアトラス 1 枚 + 壁灯十数個）で、相対値だけが 20〜35% に見える。

## 部屋別

各項目: 実装した要素 / 見えたもの（ブラウザ seed 7） / 参考との差 / 保留（理由）。

### E01 閉ループ廊下（GenericCorridor + LoopTopology）
- 実装: CorridorGenerator の slots と同じ規則（4.0 m ピッチ・隅 1.2 m・開口 ± 1.6 m）で左壁の扉位置を求め、同じ位置に右壁の装飾扉を足して「同じ扉のペア」にする。
  ペアの中間に両側とも非常口灯（signEmissive の発光箔 + emissive サイン「非常口」。上限 8）。`render.wetness` 0.25 で艶床。
- 見えたもの（`E01-s7-entry.jpg`）: 両側に同じ木扉が向かい合い、その間に緑の非常口灯が繰り返す艶のある廊下。参考の「対称性」はそのまま出た。
- 差: 参考はもう少し扉が密（3 m 前後）。Generator の左扉に揃えたので 4 m ピッチ。壁色（wallCream）と床（カーペット）は参考の白壁 + リノリウムより暖かい。

### E02 年代階段（VerticalCore + EraPreset）
- 実装: EraPreset が選ぶ 2 年代（下が古い）を同じ乱数列で読み、階ごとに 年代サイン（+Z 壁 y 2.0）・壁色の帯（1.1〜1.3 m。1960 = 黄 plasticYellow / 1980 = 赤紫 carpetPattern /
  2000 = 青 plasticBlue / 2020 = ステンレス）・壁灯 2（EraPreset が年代の器具に塗り替える）、階段の壁の中ほどに「↑ 2020 / ↓ 1960」、階段の途中に暖色の点光源 1。
- 見えたもの（`E02-s7-lower.jpg` / `E02-s7-upper.jpg`）: 下階は緑の壁（1960s）に黄色の帯と「1960」、上階は白い壁に「2020」・ステンレスの帯・青白 LED の壁灯。年代の切り替わりが階で読める。
- 差: 参考は 3 階分（1980 / 1990 / 2000）だが VerticalCore は 2 レベル固定なので 2 年代 + 階段途中の案内で表現。帯の色は年代テーブル（4 年代）に写した。

### E03 横向きホテル（CorridorHotel + GravityAxis）
- 実装（最小限）: GravityAxis のロール（断面の非等方伸縮 → 進行軸まわり 90°）の逆写像で、回転後に壁面下部（高さ 0.55 m）へ来る壁灯 lightWarm を旧床 / 旧天井に 3 m ピッチで置く（14 個）。
- 見えたもの（`E03-s7-entry.jpg`）: 床と天井に倒れた客室扉の列の間で、左右の壁の低い位置に暖色の小さな壁灯が並ぶ。「横向き」の手掛かりが 1 つ増えた。
- 差 / 保留: 表の「保留候補」どおり追加はこれだけ。カーペット・扉列は Generator のまま（床は回さないので carpetRed のまま）。

### E04 地下の昼光室（LargeRoom + FakeSky noonSun + LightingPhase daylight）
- 実装: 家具を捨て（柱は残す）、外殻をコンクリート（wallConcrete / floorConcrete）に。主矩形の天井箔を「周囲のコンクリート 4 枚 + 中央の正方形（一辺 2.4〜6 m）」に割り、
  中央だけ `palette.ceiling` のまま残す → FakeSky がそこだけ空（skyNoon）に差し替える（FakeSky の全面の空箔は palette.ceiling の箔が 0 のときだけ足されるので重複しない）。
  開口の縁に梁 4 本、真下にプランター + 幹 + 葉の球 3（plant は描画側で球になる）+ プランター内の上向き灯。`L.lighting.directional / skyAmbient` は FakeSky が無いときの既定値。
- 見えたもの（`E04-s7-entry.jpg` / `E04-s7-skylight.jpg`）: 暗いコンクリートの箱の中央に四角い空、床に日射の明るい矩形、その下に小さな木。参考の構図そのもの。
- 差: 木の葉が暗い（plant の albedo が低く、光が上からしか来ない。プランター内の上向き灯で少し持ち上げた）。FakeSky の梁が天窓の上を横切る（FakeSky の beams は E04 のパラメータで
  切れない。docs/visual-requests.md に要望）。skyDay の MatId は使っていない（FakeSky の skyNoon がその役）。

### E06 逆影広間（LargeRoom + InvertedShadow）
- 実装: 家具を捨て、床を marbleFloor に差し替え、黒い正方形（screenDark 1.2 m）を InstancedMesh で市松に敷く。長軸に沿って柱の列 2 本（4 m ピッチ、columnConcrete 0.56 角）、
  長い壁沿いに胸像（whiteFabric の台座 + 肩 + 頭）を 4 m ピッチ、全周の床際に lightPanel の帯（床上 5〜11 cm。buildFixtures は床近くの水平パネルを上向き光源にする）。
  単一光・逆影・天井灯の消灯は InvertedShadow がそのまま行う（L.lights は置き換えられるので追加しない）。
- 見えたもの（`E06-s7-entry.jpg` / `E06-s7-diag.jpg`）: 白黒の市松、柱の列、床際の白い光の帯、天井の 1 灯だけが明るい広間。柱の足元に逆向きの影。胸像は壁際の暗いシルエット。
- 差: 参考の胸像は白く照らされるが、単一光が遠いので暗い（床際の帯の光は届くが弱い）。Low Tier は instanceScale で市松の黒が 4 割に間引かれる。

### E07 観測依存廊下（GenericCorridor + ObservationRewire）
- 実装（最小限）: Generator の左扉を右壁へ写して両側の扉列に、艶床 0.18。ObservationRewire の扉上サインはそのまま。
- 見えたもの（`E07-s7-entry.jpg`）: 普通の廊下（表の「普通に見えることが正解」）。

### E08 内部拡張会議室（SmallRoom + NonEuclideanVolume）— 保留
- NonEuclideanVolume の layout フックは殻ノード（4 × 4 の閉じた箱）でも内部ノード（拡大した会議室）でも `L.boxes` を丸ごと組み直す（`L.boxes = shell`）ので、
  ドレッシングで置いた会議机・ノート PC・ホワイトボード・ガラス窓の向こうの見せかけは全て捨てられる（残るのは L.signs だけで、それも位置が旧レイアウト基準になる）。
  Modifier より前に走る仕組みでは印象を出せないため保留。内部ノードの家具（長机・椅子・キャビネット・ホワイトボード）は NEV 側の実装に任せ、
  「机上のノート PC / ガラス窓と奥の大空間」を NEV の expandInterior から呼べる形にする要望を docs/visual-requests.md に記載。

### E09 垂直水面オフィス（OfficeGrid + WaterWall）
- 実装: Generator の机（kind 'desk'）の上に 1.6 m ピッチ・背中合わせでモニター（画面 0.52 × 0.32 の箔。1 枚おきに点灯 screenGlow / 消灯 screenDark、上限 32）、
  台座は InstancedMesh。水壁の前 1.6 m のソリッドを WaterWall が捨てるので、出口の 2.9 m 以内の机には置かない（浮いたモニターを避ける）。`render.wetness` 0.3 で床に青い反射。
- 見えたもの（`E09-s7-entry.jpg` / `E09-s7-desk.jpg`）: 机の列に白く光る画面が並び、奥の壁の一枚が青い水面（WaterWall）。床が濡れたように光を返す。
- 差: screenGlow の発光が強く「青白の画面」より「白い板」に見える（emission 1.6。素材側の要望）。椅子は置いていない（参考にも少ない）。

### E11 線路のないホーム（Terminal + VehicleRide）
- 実装: 長い壁のうち開口を避けた最長区間を持つ面に、柱の列の内側（壁から 3.6 m）へ電車を置く: 白い車体（signPlate）12 m × 2 両、屋根、コンコース側は点灯した窓帯（windowLit）と
  ステンレスの扉 3 枚 / 両、壁側は暗い窓帯、前照灯 lightWarm 2 + 尾灯 neonRed 2、床には車体の影の箔（線路は無く浮いて見える）。コンコース側にホーム端の白線と黄色の点字帯、
  ホームの上に両面の LED 看板「つぎが まいります / The next train is arriving」（emissive）、前照灯側に暖色の点光源 1。掛かる座席列は捨てる（柱に掛かるときは 1 m 内側へ）。
- 見えたもの（`E11-s7-train.jpg` / `E11-s7-platform.jpg`）: 白い車体と暖色に光る窓の列、黄色の帯、前方に浮かぶ「つぎが まいります」。VehicleRide の乗車用の車両（出口の外）とは別物。
- 差: 参考の地下鉄ホームは天井が低く暗いが Terminal は天井 9 m の明るいコンコース。車体は箱の集合（丸みなし）。

### E12 過去窓回廊（GenericCorridor + PastWindow）
- 実装: 天井パネルと点光源を暖色に、右壁に額（trim の枡 + screenDark の暗い画像。枡はソリッドにして PastWindow の壁スロット探索が重ねないようにする）2〜3 枚と壁灯、
  暖色の点光源 1。Generator の扉箔も扉前に掛からないものだけソリッドにして、PastWindow の窓が扉に重ならないようにした。窓は PastWindow に任せる。
- 見えたもの（`E12-s7-entry.jpg` / `E12-s7-frames.jpg`）: 暖色の廊下、右壁の額と壁灯、左壁に PastWindow の窓。
- 差: 額の中は黒（過去の写真ではない）。

### E13 遠ざかる廊下（GenericCorridor 直線 + DynamicLength）
- 実装（最小限）: 扉と扉の中間に壁灯を左右交互（60 m で 10 前後）。DynamicLength の偽の突き当たりは壁灯の手前を滑る。
- 見えたもの（`E13-s7-entry.jpg`）: 壁灯の反復と偽の突き当たり。長さの体感は DynamicLength に依存（表の保留候補どおり）。

### E14 予測写真室（Gallery + GraphReference adjacent 4）
- 実装: 長軸に直交する壁（短い壁）に額 2 段（0.7 × 0.5、上限 12。枡はソリッド）、中央付近に机（長机 1.5 m）+ バンカーズランプ（暖色の発光笠 = 下向き光源）+ 椅子、暖色の点光源 1。
  GraphReference は最長の壁を使うので額が重ならない。
- 見えたもの（`E14-s7-entry.jpg` / `E14-s7-frames.jpg` / `E14-s7-desk.jpg`）: 壁一面の額装、机のランプ、奥の壁に GraphReference の 4 枚（名札付き）。
- 差: 額の中は黒（廊下の写真は無い）。

### E15 小数階フロア（VerticalCore + FakeSignage fractional）
- 実装: +X 壁の下階に本物のエレベーターと並べてステンレスの装飾扉 2 枚（枡 + 2 枚の戸 + 中央の合わせ目 + 呼びボタン）、各扉の上に LED 表示（kind clock）「n」「n.1」「n.11」
  （n は FakeSignage と同じ乱数列で読む）と暖色のダウンライト帯、点光源 1。
- 見えたもの（`E15-s7-elevators.jpg`）: 3 枚のエレベーター扉と「9 / 9.1 / 9.11」。FakeSignage の「9.1F」「9.11F」「9.111」とも n が一致。
- 差: 装飾扉は開かない（籠は本物だけ）。

### E16 虚偽案内区域（GenericCorridor + FakeSignage misleading）
- 実装: 壁付きの銘板 2 枚「こちらが出口 →（行き止まりです）」「← こちらは出口（まだ先にあります）」を最初のセグメントの 30% / 70% に（FakeSignage の吊り案内板 = 中央の天井、偽扉 = 壁の中央とは分ける）。
- 見えたもの（`E16-s7-sign.jpg`）: 銘板と、天井の「← 階段」「→ 階段」（FakeSignage）が同時に読める。

### E17 音声認証扉（GenericRoom + NoiseGate）
- 実装: NoiseGate の placeGates と同じ規則で 3 扉の位置を求め、各扉の脇に音声検知パネル（screenDark + neonBlue の波形 5 本 + LED。removedSockets で壁に戻った扉には付けない）、
  扉の壁と直交する壁に銘板「小声 → 図書室 ／ 通常 → オフィス（大声 → 屋上）」。NoiseGate の扉上サイン（y 2.45）・メーター（y 1.75）とは高さを分けた（パネル y 1.02〜1.46）。
- 見えたもの（`E17-s7-panel.jpg`）: 扉、上の「🔈 静」、脇の青い波形パネル、隣の LEVEL メーター。
- 差: 波形は固定の 5 本（音量に追従しない）。

### E18 動く壁紙区画（CorridorHotel + MovingWalls lining）
- 実装（最小限）: 右壁にも壁灯（MovingWalls のパネルの張り出し 0.14 より内側）、中央に模様カーペットのランナー 1.2 m（床穴は避ける）。壁紙のうねりは MovingWalls。
- 見えたもの（`E18-s7-entry.jpg`）: 暖色のホテル廊下にランナーと両側の壁灯、滑る壁パネル。
- 差 / 保留: 「花柄の壁紙」は該当 MatId が無く保留（wallBeige のまま）。

### E19 温度座標迷宮（MazeGrid + TemperatureField）
- 実装: TemperatureField と同じ場（入口からの距離 − 最寄り出口への距離。勾配の向きは同じ乱数列で読む）で外壁の上部（2.46〜2.58 m。迷路壁 2.4 m の上）に発光管を色分け
  （寒い側 neonBlue / 暖かい側 neonRed。同色の区間はまとめて 6〜8 本）、最も寒い / 暖かい壁に温度表示「8℃」「30℃」（TemperatureField の cold / hot と同じ値。HUD の表示と矛盾しない）。
- 見えたもの（`E19-s7-strips.jpg`）: 赤く光る管が暖かい半分の壁の上を走り、HUD の温度（27.5℃）と一致。反対側は青。
- 差: 表の「10℃ / 35℃」ではなく TemperatureField の 8 / 30℃ を使った（HUD と揃える）。

### E20 色欠損フロア（GenericRoom + ColorMissing）
- 実装: rooms.json の ColorMissing は `channel: red`（分析表の「青が無い」とは異なる）なので、欠損チャンネルを params から読み、残る色の椅子（red 欠損 → plasticBlue、blue 欠損 → plasticYellow）と
  灰の椅子（doorMetal）を行ごとに交互に並べる（座面・背は solid な InstancedMesh、梁・脚は箔。最大 8 行 × 6 組）。銘板「赤のない世界 / このフロアには赤という色が存在しません」。
  Generator の家具は捨てる（柱は残す）。
- 見えたもの（`E20-s7-entry.jpg` / `E20-s7-diag.jpg`）: 赤の抜けた青緑の待合室に青い椅子と灰の椅子の列。
- 差 / 未解決: 参考は「黄色い椅子 + 青のない世界」。データが red のままなら黄色は緑に見えるため出せない（`docs/visual-requests.md` にデータ側への確認を記載）。

## 保留・既知の制約

- E08: 上記のとおり NonEuclideanVolume が L.boxes を組み直すため保留。
- E07 / E13 / E18 / E03: 表の方針どおり最小限（普通に見えることが正解 / Modifier 依存）。
- E18 の花柄壁紙・E20 の黄色い椅子は現行 MatId / データでは出せない。
- Low Tier では InstancedMesh が instanceScale（0.4）で間引かれる（E06 の市松の黒、E09 の台座、E20 の椅子が疎になる）。
- 木（E04）の葉、胸像（E06）は光源が遠く暗く見える。
- 同時刻に他担当が `RoomBuilder.ts` / `mythic.ts` を編集中で、ブラウザ計測中に HMR の全体リロードが数回入った。構築時間の比較は同じページ内で連続して測っているので相対比較としては有効。
