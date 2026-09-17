# Uncommon 20 部屋の部屋別ドレッシング（担当 U・2026-09-17）

`docs/reference-rarities-analysis.md` の UNCOMMON 表を `src/generators/dressing/uncommon.ts`（`dressUncommon`。generateLayout で Generator 直後・Modifier の前に呼ばれる）に実装した記録。
変更ファイルはこの 1 本とドキュメント（本書、`docs/reference-uncommon/*.jpg`、`docs/visual-requests.md` の「U →」）だけ。Generator / Modifier / 材質 / RoomBuilder / 他レア度の dressing は編集していない。

## 共通の作り

- 乱数は `p.rng.fork('dress')`（index.ts が渡す）だけ。footprint・ソケットは変えない。ソリッドを置くときは `placeUnit` が「扉前 1.8 m（furniture.doorZones）/ 入口→各出口の直線帯 1.2 m / 既存ソリッド / 足跡の内側 0.14 m」を全て判定し、掛かるユニットはまるごと置かない。大物の置き場は `findSpot`（中心に近い順の格子探索）で柱・机の隙間を拾う。
- Modifier は dressing の後に走る。Modifier が乱数で決める位置は同じ fork（`p.rng.fork('mod:<Id>')`。fork は状態を進めないので Modifier 側の乱数列は変わらない）で先読みして合わせる: U01 の色相区画（LightingPhase.planSegments）、U04 の複製台数（FakeSignage の `rng.int(1,3)`）、U07 の雨域（ParticleDetail の rain）。Modifier がレイアウトから読む目印（U02 の `palette.door`、U04 の furnitureDark + lightPanel 前面、U11 の shelfMetal 棚）は壊さない。U05 の FakeSignage はシェルを palette で組み直すので palette 側も書く。U11 の PropRepetition は家具材質（metal / rubber / upholstery …）を捨てるので、ターンテーブルは stainless / metalDark / seatRed で組む。U15 の PropRepetition は棚に掛かる非ソリッドの箔を捨てる（値札レールは試したが構築時間が +45% になり外した）。
- 反復物は `L.instances`（U03 の段差灯・手すり、U09 のボトル、U12 の逆さの椅子、U14 の CRT・電話、U16 の矢印の鏃、U19 のボール、U20 の扉・枡・窓・支柱・寝椅子）。器具の箔（lightWarm / lightGreen / screenGlow / ledBlue）は焼き込みの面光源になるので箱のまま置く（数は構築時間に直結する。U20 は壁灯を最大 16 に制限）。
- 足音・残響は `palette.floor` を読む（Sfx.floorKindOf は carpetPattern を知らない）ので、U02 / U08 の模様カーペットはシェルの箔だけ差し替え palette は floorCarpetRed のまま（足音は carpet）。他（floorLino / floorTile / floorConcrete）は palette も差し替える。
- 予算（Node ハーネス `scratchpad/p6/uncommon/check.mjs`、U01〜U20 × seed 7/11/23 × variant 0/2 = 117 ケース、Modifier 込み）: dressing が足した箔の最大 +114（U12）、三角形の見積り最大 +15.6k（U20。箔は RoomBuilder の 1.25 m 分割近似、instances は 12 × 個数）、追加ライト最大 +2（U03 / U12 / U17 は既存の器具を消して 2 灯以内を足す）。例外 0、決定論（2 回生成の JSON 一致）0 差、扉前ゾーンのソリッド増分 0、動線帯のソリッド増分 0。全 variant（1,041 ケース）でも例外 0・非決定 0・予算超過 0（小さな variant では大物を省く。下記）。
- ブラウザでは開発用 `?nodress=1` で dressing を無効化できる（構築時間の基準測定用）。

## 部屋別（実装した要素 / Node 計測）

| ID | 実装した要素 | Node 計測（dress 分。variant 0/2 × seed 3） |
|---|---|---|
| U01 蛍光灯位相廊下 | 床を艶のあるリノリウム（floorLino）に。LightingPhase と同じ 6 m 区画で腰壁 1.2 m の色帯（緑 wallGreen / 白 wallWhite / 黄 wainscotCream）+ 見切り。右側にも装飾扉（4 m ピッチ。GenericCorridor は左だけ） | 箔 +33〜46 |
| U02 重複客室階 | 模様カーペット（carpetPattern）、扉を暗い木（woodPanel。palette.door も）に、Generator の小さな番号板を外して DuplicateNumber の大きな板（1.9 m）だけに、右側の枡にも暖色の壁灯 | 箔 +1〜5 |
| U03 無人エスカレーター | 天窓帯・吊りパネルを消灯、点光源を捨てて青白 2 灯。側壁に上るエスカレーター（床から積んだ段 + ステンレスの腰板 + ledBlue の段差灯・手すり灯・足元の輪郭灯 + 上の踊り場。上る高さ 3.4 → 2.6 → 2.0 m の順に側壁の長さへ合わせる）。ExternalForce のベルト帯（先読み）と停止ベルト候補は避ける。「2F ↑」 | 箔 +45、instances 79、ライト −2〜0 |
| U04 無名自販機室 | 灰タイル（floorTile）、自販機の列を 4 台に（FakeSignage の複製 extra を先読みし、複製が置ける数を同じ判定で見積もって、その先の位置へ置く。列が伸ばせなければ向かいの壁）、ゴミ箱、冷白色を強める | 箔 +0〜7 |
| U05 出口のない EXIT | 壁・床をコンクリートに（palette も = FakeSignage の rebuildShell 後も残る）、装飾扉を全て外す、トロファー全消灯、薄緑白の非常灯 2 灯 + 壁の小さな非常灯箔、ambient を暗く。EXIT サイン・偽扉・緑灯は FakeSignage | 箔 −16〜−1、ライト −2 |
| U06 3:17 の待合室 | 壁の丸時計 5 個（白い円盤 9 段 + 黒い縁、針は 3 の側へ 2 本）、掲示板、観葉植物 2。上 2 段をソリッドにして FakeSignage のデジタル時計スロットと重ねない | 箔 +57〜111 |
| U07 室内雨漏り広場 | ParticleDetail の雨域（先読み）に落水の柱（waterShallow の細い箔 6 本）、天井のシミ、濡れ床看板（kind sign.wetFloor）、雨域に近い壁のプランター 3、青灰の光、render.wetness 0.3（反射）、北壁に「2F」 | 箔 +9〜14 |
| U08 湿ったホテル廊下 | 模様カーペット、ダウンライトの 35% を消灯（点光源も外す）、暖色を濃く暗く、右側にも壁灯 | 箔 +0〜4 |
| U09 鏡のずれる洗面所 | 白い光を強める、洗面器ごとのソープボトル（instances）、ペーパータオル・ハンドドライヤー | 箔 +0〜4、instances 12 |
| U10 壁向き教室 | トロファーを露出蛍光管ペアに差し替え、机が向く壁（PropOrientation の socketFreeWallDir を同じ規則で先読み）の反対の壁にランドセル棚 + 丸時計 | 箔 +33〜34 |
| U11 手荷物受取所 | 汎用家具を外し（PropRepetition も捨てる）、床をタイルに、柱の間に収まる段付きステンレスのターンテーブル（台座 0.72 + 暗いベルト面 + 段状の島 + 投入口。5.4 × 3.6 → 4.2 × 3.0 → 3.6 × 2.8 の順に置き場を探す）とスーツケース 1、上に「3」の黄色い吊り看板、北壁に「3 手荷物受取所 / Baggage Claim」。周囲のリングコンベア + 多数のスーツケースは PropRepetition | 箔 +32（家具 −13 込み） |
| U12 営業時間外フードコート | 汎用家具を外し、全消灯 + 暗い ambient、店舗 2〜4（暗い間口 + ステンレス天板のカウンター + ショーケース + 明るいメニュー板 screenGlow + 赤い店名帯とサイン）、店の前の暖色 2 灯、卓 30 までと逆さの椅子（instances 3 種） | 箔 +63〜114、instances 324、ライト −13 |
| U13 プールのない更衣室 | ロッカーを青（lockerBlue）に、「シャワーをご利用ください」、出口の無い壁（無ければ最長の空き区間）に「プール →」 | 箔 0 |
| U14 受話器の上がったオフィス | 机ごとの CRT（本体 + 暗い画面）・キーボード・電話（受話器は立てて置く）を instances で、本棚 3、観葉植物 2 | 箔 +19、instances 1,008 |
| U15 単一商品スーパー | 消灯パネルを点け高照度に、全通路に同じ「5 日用品 / Daily Goods」の吊り看板（両面）。棚の縁の値札レール（ソリッド 250 個）は構築時間が +45% になったので外した | 箔 +18、サイン +12 |
| U16 番号異常駐車場 | 柱の「B1」板を B3 / B1 / 101… に、車止めから区画を読んで車 2〜3 台（carPaint の車体 + carGlass のキャビン + ゴムのタイヤ）、通路の床に黄色の矢印（鏃は instances） | 箔 +15〜28、instances 20 |
| U17 終了後の展示会場 | トロファーを 3 つに 1 つに、三脚の作業灯 2 基（暖色 2 灯。置き場は findSpot）+ 床のケーブル、FakeSignage のブース格子と同じ位置に養生テープの枡と「A-1 … B-6」の吊り札、壁に立てた白いパネル 3 枚と巻いたカーペット | 箔 +95〜102、ライト −10 |
| U18 反復エレベーター | 籠の壁を木目パネル、床をカーペット、天井灯を暖色、ボタン盤「3 3 3 3」、籠内と扉上の階表示「3」（赤 LED）。「N F」は RepeatDestination | 箔 0、サイン +3 |
| U19 無人キッズスペース | 汎用の島を外し、ボールプール（青い枡 + 3 色の球 instances）、黄色いトンネル（内法 0.9 = しゃがんで通れる）、滑り台（赤い台 + 青い段 + 黄の階段）、ソフトブロック 8、雲の壁画 4（signPlate）、「みんな なかよく あそぼう」 | 箔 +0〜10（島 −19 込み）、instances 196 |
| U20 屋内モーテル中庭 | 受付島と中二階の帯を外し、2 層（h < 7.8 なら 1 層）のバルコニー（床・木の笠木・中桟・支柱）、全周に客室扉（枡・扉板・レバー・窓は instances、壁灯は 3 枡に 1 つ・最大 16 の箔、番号板 18 枚まで）、プール（縁石 + 青い底 + 浅水 + 噴水。water ゾーン）、ヤシの木 4、寝椅子、「POOL」。空は FakeSky | 箔 +86、instances 926 |

小さな variant（RoomGenerator の v15 以降 = 6 × 7 m 以下、Atrium の 18 m 級 + 翼）では大物を省く: U04 の列（1〜2 台）、U06 の時計（3〜4 個）、U09 のボトル（洗面器なし）、U11 のターンテーブル、U12 の店（1 店）、U14 の CRT（机なし）、U16 の車（区画なし）、U19 のボールプール、U20 のプール（17 × 18 m）。いずれも Generator 側の家具も出ない大きさで、動線を優先した。

## ブラウザ確認（Tier high、`?nolock=1&new=1&seed=7&force=<ID>`。開始 → 隣接生成 → 入口へテレポート → 120 step。スクリーンショットは `docs/reference-uncommon/<ID>-s7-*.jpg`）

| ID | 見えたもの | 参考との差 |
|---|---|---|
| U01 | 艶のあるリノリウムに緑・白・黄の器具が映り、区画ごとに腰壁の色帯が切り替わる。両側に木扉（`U01-s7-entry.jpg`） | 参考は壁面全体が染まる。ここは腰壁 1.2 m の帯 + 焼き込みの色（上部の壁はクリームのまま） |
| U02 | 暗い木の扉の列、大きな番号板（201 / 202 / 201 …）、両側の壁灯、赤いカーペット（`U02-s7-entry.jpg`） | カーペットの模様は材質のスケールでは細かく、無地に近い |
| U03 | 暗い吹抜、床の光る帯（ExternalForce のベルト）、側壁に青白の段差灯と手すり灯で光る段付きのエスカレーターと踊り場（`U03-s7-entry.jpg` / `U03-s7-esc2.jpg`） | 段の傾斜は箱の階段状。手すりは 2 段ごとの折れ線。ExternalForce の帯は床のトラベレータとして残る |
| U04 | 白く光る前面 + 白無地ラベルの自販機が 4 台の列（元の 1 台 + FakeSignage の複製 + dressing）、ゴミ箱、灰タイル（`U04-s7-vend.jpg`） | 筐体は暗色（FakeSignage が furnitureDark を目印にする）。部屋は主矩形の成長で 12 × 12 m と広い |
| U05 | 暗いコンクリートの廊下、器具は全消灯、突き当たりに緑の EXIT と非常灯の緑、偽扉（FakeSignage）（`U05-s7-exit.jpg`） | 参考の「扉は無い」に対し FakeSignage の偽扉が残る（依頼済み）。消灯した器具は非常灯の反射で灯っているように見える |
| U06 | 青い連結椅子の列の壁に丸時計（黒縁・針は 3）、赤 LED の 3:17、掲示板、観葉植物（`U06-s7-clock2.jpg`） | 円盤は 9 段の階段近似。36 × 36 m の大部屋では時計が小さく、間隔も広い |
| U07 | 雨粒の下に緑がかった半透明の落水の柱、床の水溜まり（Wetness）、濡れ床の看板、青灰の光と床の反射、北壁の「2F」（`U07-s7-rain.jpg`） | 柱はガラス管のように見える（waterShallow の流れは動く）。プランターは既存の植栽の島と区別しにくい |
| U08 | 濡れて反射する赤いカーペット、両側の壁灯、暗いダウンライト（`U08-s7-entry.jpg`） | — |
| U09 | 3 台の洗面器の上にソープボトル、右にペーパータオル、暗い鏡帯（`U09-s7-sink.jpg`） | タイルは青灰（floorTile の variant）。鏡は MirrorOffset の鏡像側 |
| U10 | 机が全て同じ壁を向き、露出管ペアの器具、後ろの壁にランドセル棚と丸時計（`U10-s7-entry.jpg`） | 器具は ArchitecturalDetails のトレイが付きトロファー寄り。黒板は PropOrientation の向いた壁 |
| U11 | 中央に段付きステンレスのターンテーブル（島・投入口・赤いスーツケース 1）と黄色い「3」の吊り看板、周囲に PropRepetition のリングコンベア + 多数のスーツケース（`U11-s7-carousel.jpg`） | 2 種のコンベアが同居する。床は白系タイル（参考は暗い） |
| U12 | 暗いフードコート、4 店の明るいメニュー板と赤い店名帯（麺 NOODLE / CURRY HOUSE / BURGER / CAFE & SWEETS）、卓の上の逆さの赤い椅子、湯気（`U12-s7-shops.jpg` / `U12-s7-tables.jpg`） | メニュー板は写真ではなく白い発光面 |
| U13 | 青いロッカー列、木ベンチ、濡れたタイル、霧（`U13-s7-entry.jpg`） | 「プール →」はロッカー島の陰で入口からは見えない位置になることがある |
| U14 | 机の列にベージュの CRT と暗い画面、キーボード、立てた受話器の電話（`U14-s7-desk.jpg`） | 本棚 3 台は壁沿い（画面外）。プロップは箱の近似 |
| U15 | 同一の商品（この seed は lightGreen）で埋まった棚、各通路に「5 日用品」の青い吊り看板、白い高照度（`U15-s7-aisle.jpg`） | 商品は白いボトルではない（PropRepetition の材質。依頼済み）。値札レールは外した |
| U16 | 丸みのある車体 + 傾いたガラスの車 3 台、柱の B3 / B1 / 103 …、床の黄色い矢印、黄帯（`U16-s7-car.jpg` / `U16-s7-diag.jpg`） | 車は 2 箱 + タイヤの近似。黄帯は照明で茶色寄りに見える |
| U17 | 白いブースパネルの列、吊り札 A-1 …、床の養生テープの枡、三脚の作業灯、ケーブル、間引かれたトロファー（`U17-s7-lamp.jpg`） | 「A-7」は列が 7 枡以上のときだけ出る（この seed は A-1〜6 / B-1〜6） |
| U18 | 木目パネルの籠、暖色の天井灯、ボタン盤「3 3 3 3」、籠内と扉上の赤い「3」（`U18-s7-car.jpg`） | 籠は VerticalGenerator の 1.8 m 角のまま |
| U19 | 赤・黄・青の遊具（滑り台、ソフトブロック、ボールプール、トンネル）、壁の雲、「みんな なかよく あそぼう」（`U19-s7-pit.jpg` / `U19-s7-cloud.jpg`） | 36 × 36 m の大部屋に対して遊具の塊は小さい。雲は白い段付きの箔 |
| U20 | 2 層のバルコニーと客室扉の列（灯りの点いた窓）、ヤシ、プールと噴水、寝椅子、曇天の空と梁、暖色のペンダント（`U20-s7-pool.jpg` / `U20-s7-balcony.jpg`） | 空は曇天（rooms.json の overcastNoon。依頼済み）。バルコニーへは上れない |

- `world.log` の ERROR 0（全室）。コンソールの error は本担当のコードでは 0。作業中に `ERROR frame: ReferenceError: QUALITY_TIERS is not defined at RoomStreamingManager.precompile` が 3 回出たが、これは同時に編集中の `RoomStreamingManager.ts`（担当 P）の HMR 途中の状態で、dressing とは無関係（`?nodress=1` でも同じ）。
- 構築時間（`window.__buildProfile` の total。同じ seed / 部屋を `?nodress=1` と比べた 1 サンプルずつ。焼き込み（bake）が支配的で run ごとに ±20% ほど揺れる）: U03 64 → 48〜65 ms、U06 100 → 88〜104 ms、U12 95 → 43 ms（消灯で焼き込みが減る）、U15 114 → 113 ms（ソリッドの値札レール 250 個があった間は 139〜165 ms = +22〜45% だったので外した）、U20 97 → 104 ms（壁灯を 16 に制限する前は 153 ms = +58% だったので制限した）。いずれも +30% 以内。
- 入室直後と 120 step 後で boxes 数が変わった部屋 0。

## 保留

- U18: 籠内の狭さ・木目の質感は VerticalGenerator の籠（1.8 × 1.8 × 2.3 m）のまま。ボタン盤と階表示のサイン、木目パネル・カーペット・暖色で代替した。籠 Adapter（elevatorCar）は generateLayout を通らないので dressing の対象外。
- U20: rooms.json の FakeSky は `overcastNoon`（曇天）で、参考の「夕暮れ」にならない（lightingPreset は「人工夕暮れ」）。dressing からは変えられないので `docs/visual-requests.md` に依頼。
- U15: 商品は PropRepetition（sameProduct）が seed で 6 材質から選ぶ（白いボトルにはならない）。dressing が棚に置いた非ソリッドは PropRepetition が捨てるため、棚そのものには何も足していない（ソリッドの値札レールは構築時間の理由で外した）。依頼を記載。
- U05: FakeSignage の偽扉（EXIT の下）は残る。参考の「扉は無い」には FakeSignage 側の変更が要る（依頼を記載）。
- U01: L 字の折れ目にある器具 1 つの色相が、帯の色相とずれることがある（1,041 ケース中 1 ケース）。
