# Legendary 20 部屋の部屋別ドレッシング（担当 L・2026-09-17）

`docs/reference-rarities-analysis.md` の LEGENDARY 表を目標に、`src/generators/dressing/legendary.ts`（スタブ → 実装）だけを編集した。
generateLayout で Generator の直後・Modifier の前に `dressLegendary(L, p, rng)` が呼ばれ、定義 ID で分岐して「少数の大物 + 反復（instances）+ 色（材質の差し替え・palette）」を足す。
Generator（MegaStructure / Street / Atrium / Grid / Parking / Room）と Modifier、共有ヘルパ（furniture / common / footprint / facade）は読むだけで変更していない。
共有ファイルへの要望は `docs/visual-requests.md` の「L →」節。

## 共通の方針と制約の守り方

- 乱数は `p.rng.fork('dress')` → `fork(定義 ID)` → 要素ごとの fork（`'canal'` / `'towers'` / `'sofa'` …）だけ。要素を足しても他の要素の乱数が動かない。
- footprint / sockets / bounds / holes / elevators は触らない（Node ハーネスで base と JSON 一致を確認）。ソリッドを置く前に `canPlace`（足跡の内側・扉前 `doorZones`・入口→各出口の直線動線 1.4 m・既存ソリッドとの重なり）で照合する。細い柱・杭・ポール（xz 1 m 未満）は動線を塞がないので動線判定を免除。
- 予算: 箱 +300 / 三角形 +40k / ライト +2（`MAX_LIGHTS`）/ サイン 46 枚まで。反復物（窓格子・つらら・LED・杭・シャンデリアの飾り）は `L.instances`。
- 三角形は RoomBuilder の実装に合わせて見積もる: 面取り材質（door* / furniture* / shelf* / boxCardboard / metal* / column* / car*）は 1 箱 108、それ以外は 1.25 m 刻みのテッセレーション + チャンク分割（巨大な床箔は 28 m 格子で割られて 1 枚 3〜30k になる。L09 の大浴場の底の箔がこれで、他の箔は面積で制限した）。
- Modifier が内装を書き換える部屋（L12 ScaleAnomaly perProp / L13 PropRepetition / L03 InstanceOvergrowth の家具撤去）では、装飾を `shellPush` でシェル側（`L.shellCount` より前）に入れる。その分の扉前クリアは自分で保証する。
- Generator / Modifier が既に出す要素（ゾーン・桟橋・麦・雪・霧・モノレール車両・団地の棟）は重複させず、不足分と色だけ。
- サインは `RoomBuilder` が先頭 48 枚しか描かないので、Generator が既に 48 枚以上出す部屋（L04）では `unshift` で先頭に入れる。

## 部屋別（seed 7 / variant 0 のスクリーンショットは `docs/reference-legendary/`）

### L01 永久薄明都市（StreetGrid city）

- 実装: 消灯窓の 45% を点灯（windowDark → windowLit）。屋上にアンテナマスト + 赤い航空障害灯 + 給水塔（非ソリッド）。低い建物の屋上に「上階の塔」（暗い箔 + 窓明かりの instances。天井の闇に消えて高層に見せる）。街区が 2 段以上あるときは内側の横街路 1 本を運河に（水面 waterShallow + kind 'water' ゾーンで足音と減速、岸壁の低い縁石、縦街路ごとの橋 0.32 m + 手すり、小舟 1〜3、「CANAL ST.」の発光サイン）。運河に掛かる車・路面標示は取り除く。
- 見えたもの（`L01-s7-entry.jpg` / `L01-s7-bridge.jpg`）: 夜の街区、点灯窓、青白い街灯、橋の上から運河と小舟、両岸の建物と街灯の水面反射。
- 参考との差: 建物は 7〜11 m で「高層」ではない（室高 12 m）。青い霧は FogDepth（near 30 / far 160）が 64 m の街区では掛からない。
- 保留: 20〜40 m の塔（室高の制約。屋上の塔箔とマストで示唆）、青い霧の強さ（データ側の値。visual-requests に記載）。

### L02 室内海洋（MegaHall sea）

- 実装: 床スラブを暗い緑黒（chalkboard）に差し替えて水面の透け色を深い青緑に。乾いた前庭（ShallowWater の apron と同じ寸法）には元の床色の箔。入口→中央の桟橋の軸に沿って両脇に杭柱の列（columnConcrete 0.7 m、天井まで、上端に笠）。天井に桟橋の梁（短手方向 12 m ごと）。palette の fog / ambient を暗い青に。
- 見えたもの（`L02-s7-pier.jpg` / `L02-s7-sea.jpg`）: 木の桟橋の両側に杭柱の列、暗い緑黒の海面、天井の梁と吊り灯。参考の「コンクリートの桟橋天井と柱、下は海」に一致。
- 参考との差: 波は水面材質の flow のみ。

### L03 倉庫内麦畑（MegaHall field）

- 実装: 畑の地面の箔（grass）を yellowLine（乾いた黄土色）に、高所灯を lightWarm に、L.lights と palette を暖色に。出口脇にサイロ 2 基（シェル側。InstanceOvergrowth が家具材質を捨てるため）。
- 見えたもの（`L03-s7-close.jpg`）: 茎（InstanceOvergrowth の grass 0.07 m）+ 穂（boxCardboard）が畑を埋め、地面は黄土色、天井は暖色。遠景では茎が細くて暗緑の面に見える。
- 参考との差: 茎が緑で「黄金」に読めない。茎の色は Modifier 側（ドレッシングは前段）なので変えられない。
- 保留: 麦の色（visual-requests: InstanceOvergrowth の wheat を plasticYellow の幅 0.12〜0.16 m に）。自前で黄色い茎を足す案は 9,000 本に対して三角形予算内（≤ 3,000 本）では点描にしかならず不採用。
- **2026-09-21（A2・InstanceOvergrowth 側で解消）**: 茎を plasticYellow の薄い箔（幅 0.14 / 0.16 m × 高 1.05 m × 厚 0.04 m、yaw ランダム）、穂を plasticYellow の小箱に変更。
  茎が箱（12 三角形）になったので上限を 9,000 → 30,000 本にし、間隔を「上限本数で畑全体が埋まる値」まで広げた（seed 7 の 197 × 113 m では 0.86 m。以前は 9,000 本で
  西端の 10 m 幅の帯だけが埋まり、入口からは畑が見えなかった）。入口から見ると黄金色の箔の列が奥まで続き、中央に農道が抜ける。三角形は 1.2M → 0.67M（茎 + 穂 55,800 本）。

### L04 無限グランドホテル（MegaAtrium hotel）

- 実装: ロビーの床箔を marbleFloor に、回廊・橋の手すり（metal 1.05 m）を goldTrim に。シャンデリア 2 基（ロビー / 宴会場。天井から吊り棒で 8.6 m まで下げ、金の 3 段の枠 + 暖色の飾り instances 42 個 + 中央の灯体 + 暖色 PointLight 2.2）。橋・スラブに掛かるときは x をずらす。ロビーに赤いソファ組（seatRed × 2 + 低い机 + 金の天板）を最大 4 組。受付机に「GRAND HOTEL」の金文字サイン（先頭に unshift）。
- 見えたもの（`L04-s7-chandelier2.jpg` / `L04-s7-lobby2.jpg`）: 大理石の床に暖色の光が落ち、長い吊り棒のシャンデリア、金色の回廊の縁。
- 参考との差: ロビー全体はまだ暗い（吹抜 20 m の天窓照明が遠い）。ソファは暗赤で黒っぽく見える。
- 保留: 天井高 20 m の吹抜に対する照明量（ライト +2 の予算内ではシャンデリアの 2 灯まで）。

### L05 屋内学園都市（MegaAtrium campus）

- 実装: 中庭（無ければ体育館）ゾーンに陸上トラック（赤茶 floorCarpetRed の環 4 レーン + 白線 + 芝の内野。トラック帯に掛かる島は撤去）と支柱付きの掲示板「TRACK & FIELD / 第一運動場」。プールの水面の下に青い底（plasticBlue）、縁に青い帯、コースロープ（plasticRed）。天窓を skyDay（青空）に。
- 見えたもの（`L05-s7-track2.jpg` / `L05-s7-pool.jpg`）: 青い天窓の下に赤茶のトラックと白線、緑の内野、青いプールと赤いコースロープ。
- 参考との差: ゾーンの用途は ZoneThemeShuffle が後で並べ替えるため、トラックの位置と最終テーマ名は一致しないことがある（ドレッシングは Generator のゾーン名を見る）。

### L06 地下鉄ショッピングシティ（AtriumGenerator Terminal）

- 実装: 長辺の壁に店舗正面ユニット（6.6 m: 白い柱型 2 + ガラス + 暗い店内 + 白い帯 + 発光看板帯 = 6 箱、店名の発光サイン 16 種を 1 軒おき）を最大 10（初版 20 軒 8 箱 + 24 サインは構築時間 +80% だったので削減）。コンコースの中央に吊り下げの両面「出口 EXIT」案内。床の艶（render.wetness 0.25）。palette を商業照明の暖白に。
- 見えたもの（`L06-s7-entry.jpg` / `L06-s7-shops.jpg`）: 両側に暗いガラスの店先と色違いの店名看板、緑の出口案内が奥へ続く。
- 参考との差: 店内は暗い板で奥行きが無い。エスカレーターは無い。

### L07 垂直オフィス世界（MegaAtrium office）

- 実装: 各階の壁面（西のオフィス帯以外）にオフィスの窓格子（windowLit 62% / windowDark の instances 1.2 × 1.5 m、1.6 m ピッチ。階段・出口・EV に掛かる位置は避ける）。北壁に階表示「nF / LEVEL n · OFFICES」。palette の fog を冷色に。
- 見えたもの（`L07-s7-lookup.jpg` / `L07-s7-gallery.jpg`）: 吹抜を見上げると各階に窓明かりの列が延々と続き、橋が横切る。
- 参考との差: 参考の「見上げの縦穴」はこの吹抜の高さ（最大 23.4 m）まで。
- 保留: 縦穴の高さ（Generator の階数上限に依存）。

### L08 終着しない国際空港（AtriumGenerator Terminal）

- 実装: 座席列を seatBlue に。北壁のカウンターの発光板に「GATE nn / 搭乗口」。自立式の発着案内板 2 基（screenDark の板 + screenGlow の行 + 「DEPARTURES 出発 / ALL FLIGHTS DELAYED」）。幅 18 m × 奥行 40 m × 高さ 8.4 m 以上の変種では飛行機 1 機（白い胴体 3.4 m 径 × 28 m を 7 段の箱で、黒い窓帯、扉、後退翼 3 段、水平・垂直尾翼、吊り下げエンジン、脚 + ゴムの車輪（RoomBuilder が円柱に描く）、赤 / 緑の航法灯、ボーディングブリッジ、機体を照らす白色灯 2）。胴体は床上 2.5 m、エンジン下端 2.0 m で下を歩ける。脚の下の低い座席は撤去、機体に掛かる吊り灯は撤去。床の艶 0.15。
- 見えたもの（`L08-s7-nose2.jpg` / `L08-s7-under.jpg`）: 青い座席列と発着案内板、頭上の白い胴体・翼・エンジン。
- 参考との差: 飛行機は箱の近似（丸みが無い）。小さい変種（幅 < 18 m）では飛行機を置かない。
- 保留: 飛行機の造形（箔・箱のみで曲面が作れない。参考画像の「屋内に飛行機」の第一印象は出る）。

### L09 無限温浴施設（MegaAtrium bath）

- 実装: 浴槽の縁（floorTile 0.3 m）を石（columnConcrete）に、区画の腰壁（floorTile 1.2 m）を木の間仕切り（woodPanel）に。最大の水面（大浴場）と小さな浴槽の下に温かい木色の底（floorWood）。浴槽の四隅に植栽（石の台 + plant）。入口側の壁に赤い発光サイン「ゆ」。L.lights と palette を暖色に。
- 見えたもの（`L09-s7-bath2.jpg` / `L09-s7-tub2.jpg`）: 石縁の浴槽、木の格子の間仕切り、暖色の吊り灯の列。
- 参考との差: 湯は薄い緑灰で「暖色の湯」までは行かない（水面材質の色は変えられない）。湯気は ParticleDetail の mist が `L.particles`（単一スロット）を使うため足せない。
- 保留: 湯気（particles の複数領域対応待ち）、湯の色（水面材質側）。
- **2026-09-21（A2）**: `RoomLayout.particles` を `ParticleSpec | ParticleSpec[]` にし（`generators/particles.ts` の particleList / addParticles / replaceParticles）、
  dressL09 が浴槽ごと（大浴場 + 40 m² 以下の小浴槽、最大 12 基）の水面直上 0〜1.3 m に steam スロットを足す（大浴場 24〜320 粒、小浴槽 18〜40 粒、size 0.8、暖白 0xfff1e2）。
  後段の ParticleDetail(mist) は同 type だけ置き換えるので mist 120 粒は残る。RoomBuilder はスロットごとに Points を作り、合計（seed 7: 320 + 9 × 19 + 120 = 611）を Tier の
  particleCap（high 1000 / mid 400 / low 150）に比例で収める。小浴槽の上に白い柔らかい塊が立ち上る。大浴場は広すぎて 320 粒では薄い（意図どおり「遠くに漂う」程度）。

### L10 夜間郊外住宅地（StreetGrid suburb）

- 実装: 消灯窓の 15% を TV の青白い光（screenGlow。LightingPhase allWindowsLit は windowDark だけを点灯するので先に差し替え）。建物のある街区の歩道の内側に白い低い塀（0.9 m、辺ごとに 1.3 m の入口）。palette の fog / ambient を夜の青に。
- 見えたもの（`L10-s7-entry.jpg` / `L10-s7-fence.jpg`）: ナトリウム灯の夜の住宅街、点灯窓、家の前の低い塀。
- 参考との差: 「俯瞰」と「地平の都市」は室内では出せない。
- 保留: 俯瞰（プレイヤー視点固定）、地平の都市（外周の窓帯 windowNight は y 1〜2.8 m の帯でしか地平線が出ない）。

### L11 環状モノレール都市（MegaAtrium ring）

- 実装: 南北の帯の軌道桁の上にモノレール車両（白い車体 14 m + 前後の運転台、点灯した窓帯 windowLit、青い LED 帯、前照灯 / 尾灯、「LOOP LINE / 環状線」のサイン）。ホーム（y 3.6）の縁に黄線。外壁の店舗と看板帯の上（3.6〜9.3 m）に夜景の塔（暗い箔 + 窓明かりの点の instances + 航空障害灯）。
- 見えたもの（`L11-s7-train2.jpg` / `L11-s7-platform2.jpg`）: 青い LED の暗い駅、桁の上に窓の灯ったモノレール、ホームから車両。
- 参考との差: 塔は壁面の箔（立体の塔ではない）。車両は VehicleRide の乗車車両とは別の「停まっている編成」。
- 保留: 中庭側に立体の塔（中庭は footprint の外で壁が windowDark の暗いガラスのため見えない）。

### L12 設備大聖堂（MegaHall nave）

- 実装: 身廊の柱ごとにステンレスの配管束 3 本 + 笠（instances）、柱列に沿う主管と身廊を渡る枝管（シェル側）。両端の壁に 5 連の縦長ステンドグラス（aquariumBlue / neonBlue / neonRed の帯 + 金属の桟）、側壁に 16 m ごとの高窓。青（北）と赤（南）の PointLight 2 灯。ScaleAnomaly perProp が内装を 3〜8 倍にするため全てシェル側。
- 見えたもの（`L12-s7-rose.jpg` / `L12-s7-pipes.jpg`）: 巨大化した設備の奥に青赤の縦長窓、柱の脇の配管束と横引き管。
- 参考との差: ステンドグラスは縦縞の近似。巨大設備（Modifier）が視界の大半を占める。

### L13 サーバー森林（GridGenerator ServerGrid）

- 実装: ラック（furnitureDark ブロック）の通路に面する長辺 2 面に黒い化粧板（screenDark 12 mm。PropRepetition の LED 帯とレールはその上に載る。シェル側。初版の 5 面は構築時間 +47% だったので 2 面に）。天井の LED パネルの 60% を消灯、L.lights を暗い青に 0.55 倍、palette を暗く冷たく。入口側の壁に「SERVER FOREST · 3F」。
- 見えたもの（`L13-s7-entry.jpg` / `L13-s7-aisle.jpg`）: 黒いラックの列と青い LED 帯、暗い天井。参考に近い。
- 参考との差: ラック本体を screenDark に差し替えると PropRepetition がラックを見失うので化粧板方式にした。ラックの端面（短辺）は元の furnitureDark のまま。

### L14 温室都市（MegaAtrium greenhouse）

- 実装: 吹抜の中央（候補 9 点から橋・スラブに当たらない場所）に天井から落ちる滝（waterWall の交差する 2 面 + 天井の金属枡 + 石の水盤 + 水面 + 白い泡 + kind 'water' ゾーン + 霧の粒子 + 白色灯 + 銘板「RAIN VORTEX」）。庭園ゾーンの花壇に椰子（幹 + 球の樹冠。シェル側。橋に当たれば低くする）。回廊の吹抜側の縁から垂れるつる（plant の instances）。
- 見えたもの（`L14-s7-fall.jpg` / `L14-s7-basin.jpg`）: 天井から水盤へ落ちる暗い水柱と霧、周囲に植栽の球、上階の回廊。
- 参考との差: 植栽の球（plant）が現行の照明で黒く見える（材質側。visual-requests）。
- 保留: 熱帯植物の形（球と箱の近似）。

### L15 屋内高速道路（RoadGraph）

- 実装: 本線 0.42 付近にガントリー（柱 2 + 梁）と緑の大型標識 2 枚「東 ↑ EAST」「西 ↑ WEST」（noticeGreen の板 + 白文字）。天井のジェットファン 4 基。壁の非常電話（plasticYellow + 「SOS」）。
- 見えたもの（`L15-s7-gantry.jpg`）: ナトリウム灯のトンネルに緑の方面標識と既存の出口標識。
- 参考との差: 無し（ナトリウム灯・車線・車は Generator）。

### L16 空間博物館（RoomGenerator Gallery）

- 実装: 外壁を wallDark に、天井灯の 75% を消灯、L.lights を 0.4 倍。島（furnitureLight）を展示ケースに（黒い台 screenDark + ガラス + 部屋の模型（白い小箱 + 灯った小窓 + 小さな扉）+ 展示名の銘板「閉館後の学校廊下 / EXHIBIT 01」…）。大きい 2 ケースに暖色スポット 2 灯。入口の反対の壁上部に題字「まだ見ぬ世界たち / WORLDS YET UNSEEN」。palette を暗く。
- 見えたもの（`L16-s7-case.jpg` / `L16-s7-title.jpg`）: 暗い壁の博物館、ガラスの中の小さな部屋の模型、題字。
- 参考との差: 写真の額（GraphReference）は訪問ログが空だと「—」の額になる（Modifier 側）。

### L17 無限団地（StreetGrid danchi）

- 実装: 歩道に街路樹（幹 handrailWood + 球の樹冠 plant、8 m ごと、街灯の柱は避ける）。棟の長辺の各階（2.7 m）に共用廊下の灯（lightWarm の小箔の instances、3.2 m ピッチ）。ScaleAnomaly（×1.5）が後段で全体を拡大するので寸法は拡大前で設計。
- 見えたもの（`L17-s7-entry.jpg`）: 街路の両側に街路樹、点灯窓の棟、暖色の街灯。
- 参考との差: 樹冠が黒く見える（plant 材質。visual-requests）。棟の反復は Generator。

### L18 駐車場メガストラクチャ（ParkingGenerator）

- 実装: 区画線（wallWhite の床線）から駐車区画を復元し 42% に車（`car()` の箱の車。車止めとは重なってよい）を最大 36 台。柱の階表示を「B3 / B6」に（柱ごとに乱択）。ランプ脇に「↑ B2 ↓ B4」の発光案内。
- 見えたもの（`L18-s7-entry.jpg` / `L18-s7-cars.jpg`）: 柱グリッドの間に停まった車の列、B3 / B6 の柱、蛍光灯の列。
- 参考との差: 多層感は 1 フロアのみ（Generator）。

### L19 凍結リゾート（MegaAtrium resort）

- 実装: 凍結プールの ice 箔の上に青く光る薄い箔（aquariumBlue）と青い PointLight。天井のつらら（ice の instances、クラスタ 4〜14 か所）。雪面側の外壁に氷壁（ice 2〜4 m × 2.2〜6 m + 雪の縁）。主矩形の壁の上部（4.6 / 7.2 m）に暖色の室内窓（windowLit の instances）。青白い PointLight 1。
- 見えたもの（`L19-s7-entry.jpg` / `L19-s7-pool.jpg`）: 白い霧の中に青いプール、天井のつらら、壁に暖色の窓、雪の床。参考に近い。
- 参考との差: 氷の洞窟の曲面は無い（板の氷壁）。

### L20 永久万博会場（StreetGrid expo）

- 実装: 入口街路のゲート（白い塔門 + 赤い帯 + 両面の発光バナー「THE NEXT HORIZON / EXPO ∞」）。街路の両側に旗竿と原色の旗（plasticRed / Blue / Yellow）。広場ブロックがあればその中央に、無ければ屋上に余裕のある最大のパビリオンの上に多段ドーム（白 4 段 + 青の帯 + ステンレスの頂部 + 赤い標識灯）。パビリオンの展示カラーの帯を原色に。
- 見えたもの（`L20-s7-entry.jpg` / `L20-s7-dome3.jpg`）: 入口のゲートとバナー、旗の列、パビリオンの屋上に段状のドーム。
- 参考との差: ドームは段状の箱の近似（球は重い）。
- 保留: 曲面のドーム。

## Node ハーネス（`scratchpad/p6/legendary/`: Vite SSR ビルドで base（スタブ）と new を比較）

L01〜L20 × seed {1, 42, 777} × variant {0, 最終（最小）} = 120 ケース。入口 door 1.0、exits = max(1, minExits)、allowHole。Modifier 43 種込み。

| 項目 | 結果 |
|---|---|
| 例外 | 0 |
| 非決定論（同入力 2 回で JSON 不一致） | 0 |
| footprint / sockets / bounds / holes / elevators / height の base との不一致 | 0 |
| 予算超過（箱 +300 / 三角形 +40k / ライト +2 / サイン 48） | 0 |
| 扉前 1.8 m のソリッド（base より増えたケース） | 0 |
| 生成時間の増分（中央値、5 回） | 最大 +1.8 ms（L14 seed 1 v0 のみ +18.7 ms だが base 255 ms の InstanceOvergrowth のばらつき内。他の seed は −50〜+1 ms） |

| ID | Template | boxes Δmax（合計） | tris Δmax（合計） | lights Δ | signs | instances Δ |
|---|---|---|---|---|---|---|
| L01 | StreetGrid | +20 (1445) | +5.1k (104k) | 0 | 16 | +32 |
| L02 | MegaHall | +46 (811) | +5.0k (328k) | 0 | 5 | 0 |
| L03 | MegaHall | +6 (457) | +5.0k (956k) | 0 | 0 | 0 |
| L04 | MegaAtrium | +34 (3001) | +16.5k (730k) | +2 | 123（Generator 由来 110 枚超。館名は先頭） | +84 |
| L05 | MegaAtrium | +12 (1306) | +21.7k (843k) | 0 | 1 | 0 |
| L06 | Terminal | +62 (231) | +3.7k (59k) | 0 | 7 | 0 |
| L07 | MegaAtrium | +0 (1268) | +14.4k (404k) | 0 | 6 | +721 |
| L08 | Terminal | +50 (219) | −0.2k (50k) | +2 | 8 | 0 |
| L09 | MegaAtrium | +41 (1548) | +38.7k (553k) | 0 | 1 | 0 |
| L10 | StreetGrid | +72 (1450) | +2.1k (92k) | 0 | 11 | 0 |
| L11 | MegaAtrium | +155 (1262) | +25.9k (638k) | 0 | 6 | +732 |
| L12 | MegaHall | +199 (805) | +26.9k (206k) | +2 | 0 | +192 |
| L13 | ServerGrid | +115 (180) | +19.8k (127k) | 0 | 1 | 0 |
| L14 | MegaAtrium | +36 (2235) | +7.2k (1480k) | +1 | 1 | +266 |
| L15 | RoadGraph | +17 (406) | +1.3k (37k) | 0 | 11 | 0 |
| L16 | Gallery | +56 (182) | +0 (46k) | +2 | 17 | 0 |
| L17 | StreetGrid | +72 (1427) | +9.2k (189k) | 0 | 9 | +95 |
| L18 | ParkingGrid | +112 (508) | +8.3k (70k) | 0 | 25 | 0 |
| L19 | MegaAtrium | +17 (664) | +20.4k (320k) | +2 | 19 | +520 |
| L20 | StreetGrid | +40 (1134) | +2.8k (96k) | 0 | 19 | 0 |

三角形は RoomBuilder の surfaceBox（面取り 108 / テッセレーション）+ チャンク分割 + 主な自動細部を再現した見積もり。

## ブラウザ確認（Tier high、`?nolock=1&new=1&seed=7&force=<ID>` → `ensureNeighbors` → `spawnPointOf` → `teleport` → `enterRoom` → 90 step）

- 20 部屋すべてで `world.log` の ERROR 0、コンソールの error 0（Chrome 拡張の read_console_messages）。入室後の boxes 数は変わらない。
- Browser ペインはタブ上限（他担当のタブ 9 枚）で開けなかったため Chrome 拡張（claude-in-chrome）の自前タブで実行し、`renderer.domElement` を 1024 px の JPEG にしてローカルの HTTP サーバー（5197）へ保存した。
- `window.__buildProfile` の total（seed 7、ドレッシング込み。同じ部屋の 2 回の入室で ±30% ばらつく）: L01 0.83〜0.90 s / L02 2.2 s / L03 1.1 s / L04 5.5〜6.0 s / L05 2.2〜3.3 s / L06 0.54 s / L07 3.9 s / L08 0.52〜0.65 s / L09 3.2〜3.4 s / L10 1.4 s / L11 1.8〜2.0 s / L12 1.4 s / L13 0.49 s / L14 4.6 s / L15 0.37 s / L16 0.30 s / L17 1.0 s / L18 0.63 s / L19 1.4 s / L20 0.9〜1.3 s。
- ドレッシング無し（スタブ）との比較は下記「構築時間の A/B」。

## 構築時間の A/B（スタブとの比較）

`legendary.ts` を一時的にスタブに戻して同じ seed 7 の同じ部屋を `game.streaming.rebuild(roomId)` で 3〜8 回再構築し、`__buildProfile.total` の中央値を比べた（ms。Tier high、同じタブ・同じ世界。再構築の時間は ±30% ばらつく）。

| 部屋 | スタブ（中央値） | ドレッシング（中央値） | 差 | 箱 | 備考 |
|---|---|---|---|---|---|
| L04 無限グランドホテル | 4,731 | 4,728 | ±0% | 2973 → 3007 | Generator の 3,000 箱が支配 |
| L06 地下鉄ショッピングシティ | 282（8 回、最小 246） | 367（8 回、最小 345） | +30% | 163 → 225 | 店舗 20 軒 8 箱 + 24 サインの初版は +80% だったので 10 軒 6 箱 + サイン 7 枚（アトラス 1 枚）に削減 |
| L11 環状モノレール都市 | 1,337 | 1,569 | +17% | 1119 → 1276 | bake 段（702 → 1,034 ms）が塔の箔ぶん増える |
| L13 サーバー森林 | 284 | 358 | +26% | 62 → 180 | 化粧板 5 面/ラック（+47%）→ 通路側 2 面/ラックに削減 |
| L18 駐車場メガストラクチャ | 432 | 468 | +8% | 363 → 475 | 車 16 台（面取り箱） |

他の部屋は箱の増分が Generator の箱数の 1〜10% で、上表の L04 / L18 と同じ傾向（+10% 未満）と見込む。1 箱あたりの構築コストはこの環境で 0.5〜0.7 ms（geo + bake + flat + merge）、サインはアトラス 1 枚（16 枚まで）ごとに 40〜50 ms（Canvas → テクスチャ）。

## 保留と理由（まとめ）

| 部屋 | 保留 | 理由 |
|---|---|---|
| L01 | 20〜40 m の塔、青い霧 | 室高 12 m。FogDepth の near/far はデータ側 |
| L03 | ~~麦の黄金色~~（2026-09-21 解消） | InstanceOvergrowth の wheat を plasticYellow の箔に変更 |
| L07 | 見上げの縦穴 | MegaAtrium の階数上限（最大 6 層 23.4 m）に依存 |
| L08 | 飛行機の造形 | 箔・箱のみで曲面が作れない。18 × 40 × 8.4 m 未満の変種では置かない |
| L09 | ~~湯気~~（2026-09-21 解消）、湯の色 | particles を複数スロット化し浴槽ごとの steam を追加。水面材質の色は共有（未解消） |
| L10 | 俯瞰、地平の都市 | プレイヤー視点固定。windowNight の地平線は y 1〜2.8 m 帯限定 |
| L11 | 中庭側の立体の塔 | 中庭は footprint 外で壁は暗いガラス |
| L14 / L17 / L05 / L01 | 植栽が黒い球 | plant 材質の照明（材質側。visual-requests） |
| L20 | 曲面のドーム | 段状の箱で近似 |

## A2 の追記（2026-09-21・Modifier 側の対応: L03 麦 / L09 湯気 / U05 偽扉 / E04 梁）

- 編集: `src/modifiers/mods/InstanceOvergrowth.ts`（layoutWheat）、`src/modifiers/mods/FakeSignage.ts`（fakeExit に `fakeDoor`）、`src/modifiers/mods/FakeSky.ts`（addBeams が天窓の真下を抜く）、
  `src/modifiers/mods/ParticleDetail.ts`（replaceParticles）、`src/generators/layout.ts`（`particles` の型）、`src/generators/particles.ts`（新規ヘルパ）、`src/render/RoomBuilder.ts`（particles の読み取りのみ）、
  `src/modifiers/mods/Wetness.ts` / `ScaleAnomaly.ts`（particleList で読む）、`src/generators/dressing/legendary.ts`（dressL09 の steam）。
- 確認: `npx tsc --noEmit -p .` 0 エラー、`node tools/seam-stats.mjs --seeds 3 --rooms 40` deterministic true / overlap 0。ブラウザ（Tier high、seed 7）で U05 / L03 / E04 / L09 の `world.log` ERROR 0、コンソール error 0。
- 構築時間 A/B（`window.__buildProfile` total、seed 7、同条件の 1 回ずつ。±30% のばらつきあり）:

| 部屋 | 変更前 | 変更後 | 備考 |
|---|---|---|---|
| U05 | 9 ms（28 箱） | 8 ms（24 箱） | 偽扉 4 箔が無くなった |
| L03 | 366 ms（instances 9,000 + 4,500） | 236〜318 ms（instances 27,884 + 27,884。instances 段 37 ms） | 草ジオメトリ（132 三角形 / 本）→ 箱（12）で bake / geo が軽くなった |
| E04 | 45 ms（47 箱） | 57 ms（47 箱） | beams=false はデータ側で既に有効。差はばらつき |
| L09 | 929 ms（1524 箱、Points 1） | 580〜764 ms（1524 箱、Points 11） | particles 段 0.6 ms。差はばらつき |

