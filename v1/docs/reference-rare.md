# Rare 20 部屋の部屋別ドレッシング（担当 R・2026-09-17）

`docs/reference-rarities-analysis.md` の RARE の表を目標に、`src/generators/dressing/rare.ts`（`dressRare(L, p, rng)`。generateLayout で Generator の直後・Modifier の前）で定義 ID ごとに「その部屋らしさを決める 1〜3 の大物 + サイン + 光の色・配置」を足した。既存の Generator / Modifier / 材質・他ファイルは変えていない（共有ファイルへの要望は `docs/visual-requests.md` の「R →」）。

## 共通の約束と検証

- 乱数は `p.rng.fork('dress')` だけ。footprint・ソケット・bounds・height・穴は不変（ハーネスで JSON 一致を確認）。扉前ゾーン（`furniture.doorZones`、1.8 m × 幅 +0.1）と入口→各出口の直線帯（半幅 0.6 + 0.1）は `canPlace` で避ける。壁に張り付く薄物（腰壁・スコンス・箔）だけ直線帯の判定を外す。
- 反復物は `L.instances`。ただし **通り抜けを防ぐ構造材は L.boxes**（Tier の instanceScale で間引かれると当たり判定も消えるため）: R08 の書架の段板、R10 の座席の梁、R20 のシャッター、R03 の卓の当たり判定。
- 予算（部屋あたり 箱 +300 / 三角形 +40k / ライト +2）: Node ハーネス（`scratchpad/p6/rare/check.mjs`。rolldown で束ね、Modifier 43 種を手動登録。「ドレッシング無し」は `def.rarity` を Common にして同じ generateLayout を呼ぶ）で R01〜R20 × seed {1, 42, 777} × variant {0, 1, 3, 5} = 240 ケース: 例外 0、決定論一致（同 seed 2 回で JSON 一致）、footprint / sockets / holes / bounds / height 不変、扉前に新たなソリッド 0、予算超過 0。三角形の見積りは `ArchitecturalDetails.detailedBoxes` + `surfaceBox` と同じ分割式（面取り材質 108、他は 1.25 m 分割）+ instances。

| ID | 箱 Δ（最大） | 三角形 Δ（最大） | ライト Δ | サイン | instances | 備考 |
|---|---|---|---|---|---|---|
| R01 | +102 | +2.6k | +2 | 1 | 0 | |
| R02 | −44 | +3.4k | +2（Modifier の青灯） | 1 | 960 | 棚 → 筐体で箱は減る |
| R03 | +10 | +25.9k | 0 | 0 | 2,477 | 卓・椅子・シャンデリアは instances |
| R04 | 0 | +1.6k | 0 | 10（街の看板） | 136 | 生垣のみ |
| R05 | +106 | +5.0k | +2 | 0 | 0 | |
| R06 | +66 | +3.0k | 0 | 1 | 0 | |
| R07 | +28 | +9.7k | 0 | 0 | 1,836 | |
| R08 | +43 | +2.0k | +2 | 1 | 396 | 詰め物を捨てて段板を足すので箱は少し増えるだけ |
| R09 | +60 | +1.2k | 0 | 0 | 0 | |
| R10 | +99 | +7.3k | 0 | 22（FakeSignage 含む） | 764 | |
| R11 | +27 | +0.3k | 0 | 15 | 0 | |
| R12 | +103 | +3.9k | 0 | 9 | 0 | |
| R13 | +28 | +33.5k | 0 | 0 | 340 | ×3 後の 3 m タイルの分割で三角形が増える。タイルは 300 枚まで |
| R14 | +54 | +8.7k | 0 | 2 | 600 | |
| R15 | +17 | +0.3k | 0 | 3 | 0 | |
| R16 | +5 | +0.3k | 0 | 5 | 0 | |
| R17 | 0 | +0.5k | 0 | 14 | 56 | ベンチを外してベッドを置く |
| R18 | +9 | +2.0k | 0 | 1 | 45 | |
| R19 | +57 | +2.9k | +2 | 2 | 142 | |
| R20 | −20〜−41（器具を外す） | +0.4〜1.0k | 0 | 0（番号板は DuplicateNumber の 48） | 0 | A1 整理後（2026-09-21） |

ライト Δ の ±1 は `wear.ts` の lightOff（器具が変わると当たり方が変わる）による差で、ドレッシングが足すのは R01 / R05 / R08 / R19 の 2 灯まで。

ブラウザ（`?nolock=1&new=1&seed=7&force=<ID>`、high Tier、960 px の縮小 JPEG。代表 26 枚を `docs/reference-rare/` に置いた。全枚は `scratchpad/p6/rare/shots/`）: 全 20 部屋で `game.world.log` の ERROR 0、入室後の console error 0（タブに残っていたエラーは他担当の HMR 途中のもの）。構築時間 `window.__buildProfile.total`（同 seed で `&nodress=1` と比較。1 回計測なので ±30 ms 程度の揺れがある）:

| ID | dress (ms) | nodress (ms) | ID | dress | nodress |
|---|---|---|---|---|---|
| R01 | 127 | 116 | R11 | 40 | 35 |
| R02 | 95 | 153 | R12 | 90 / 66 | 107 |
| R03 | 90 | 105 | R13 | 147 / 104 | 154 |
| R04 | 240 | 332 | R14 | 209 | 146 |
| R05 | 25 | 16 | R15 | 48 | 25 |
| R06 | 35 / 26 | 16 / 12 | R16 | 124 | 162 |
| R07 | 189 / 215 / 134 | 124 / 101 | R17 | 15 | 26 |
| R08 | 76 | 500 | R18 | 50 | 58 |
| R09 | 132 / 154 | 348 | R19 | 23 | 40 |
| R10 | 107 / 75 | 263 | R20 | 118 | 166 |

比率で +30% を超えるのは R05 / R06 / R15（絶対値 +10〜25 ms。細長い廊下で元が 12〜25 ms）、R07（+30〜60 ms。当初は全面の空の箔が面光源になって +50% だったので厚さ 0.32 の箔にして面光源から外した）、R14（+60 ms。窓の点光源 + 机 120 台）。他はドレッシングの方が速いか同程度（棚の詰め物・島を捨てる部屋）。

## 部屋別

### R01 浅水タイル回廊（PoolGenerator + ShallowWater）
- 実装: 各セグメントに 3.6 m ピッチで白タイル（floorTile）のアーチ = 柱 2 本（0.35 角、デッキの上に載ることは許す）+ 上部の 3 段の箔（全幅 / 22% / 9%）で丸みを近似。アーチ下の中央に lightWarm の小箔（下向きの面光源として焼き込み）、入口側 2 つのアーチに暖色の点光源。天井パネルを lightWarm、点光源を暖色に。
- 見えたもの（`R01-s7-entry` / `-diag`）: 白タイルの壁に段状のアーチが奥へ反復し、暖色のパネルが水面に映る。デッキと手すりの間に柱が立つ。
- 参考との差: アーチは段状（丸くない）。水面の反射は ShallowWater 側のまま。柱がデッキに埋まる箇所がある。

### R02 無電源アーケード（GridGenerator RetailGrid + LightingPhase unpowered）
- 実装: 棚のスラブと詰め物を捨て、背中合わせの筐体列（screenDark のソリッド instances 0.72 × 1.8 × 0.7、前面の画面 screenGlow / neonRed / neonBlue の箔、看板、操作卓 rubber。最大 240 台）。艶床（wetness 0.3）、ネオン看板「GAME CENTER」。器具の消灯と青い点光源 4〜6 灯は LightingPhase が行う（画面箔は薄いので Modifier の筐体候補にはならず、候補が無いので Modifier が壁沿いに 6 台の筐体を足す）。
- 見えたもの（`R02-s7-entry`）: 暗い天井（トロファー消灯）の下に黒い筐体と青白い画面の列、艶タイルに映り込み。
- 参考との差: 画面が screenGlow（青白）中心でネオン赤・青の比率が低く、参考の「カラフル」より単調。筐体は直方体で庇が無い。

### R03 無限宴会場（RoomGenerator LargeRoom + PropRepetition banquetTable + FogDepth）
- 実装: 家具を捨て、床を carpetPattern、腰壁 woodPanel + goldTrim の見切り。PropRepetition の格子（margin 1.2 / pitch 3.2 / 位相 0・1 / doorwayZones eps 0.01 / 直線帯）を同じ規則で先に埋め、丸卓 = whiteFabric のソリッド箔（当たり判定。Modifier の overlapsSolid に見える）+ 45° ずらしたクロスと天板 2 枚（八角形近似）、椅子 6 脚（seatRed の座・背 + metalDark の脚）、蝋燭。天井パネルをシャンデリア（goldTrim の環 4 本 + 腕 + 蝋燭 8 本 + 下向きの lightWarm の灯）に置き換え、点光源をその高さへ。
- 見えたもの（`R03-s7-entry` / `-diag`）: 赤い模様カーペットに八角形の卓と赤い椅子が格子に並び、シャンデリアが奥へ反復、霧で沈む。Modifier の角卓は 0（ハーネス 24 ケース）。
- 参考との差: クロスが whiteFabric（carpet テクスチャ）で灰色に見える。壁面の装飾（鏡・カーテン）無し。ステージ無し。

### R04 屋内住宅街（StreetGenerator + FakeSky dusk）— 一部保留
- 実装: 各ブロックの歩道の縁に生垣（plant の instances 0.55 × 0.85 × 0.9、角と辺の中央は空ける）。FakeSky が無い定義になったときだけ吊り天井（ceilingTile）+ トロファー列を張る分岐。
- 見えたもの（`R04-s7-entry` / `-diag`）: 夕空と梁の下、家並みの前に生垣の列、街灯、車。
- 保留（理由）: 参考の核「オフィスの格子天井 + 蛍光灯」は rooms.json の FakeSky(dusk)（天井を夕空に、天井付近のパネルを撤去）と真向から矛盾する。Modifier を壊さない範囲では両立できないので判断を依頼（visual-requests.md）。

### R05 空中連絡橋（CorridorGenerator Bridge + FogDepth）
- 実装: 屋根（ceilingDark）、手すり壁の上に glass の側壁、外側に windowNight（y 1.0〜2.9）、方立て 2.4 m、扉脇の方立てと上部の梁、床際と天井のライン光（lightPanel 細箔。床は上向き・天井は下向きの面光源）、点光源 2。
- 見えたもの（`R05-s7-entry` / `-diag`）: 細長いガラスの橋、夜景の窓明かり、床と天井の白いライン、突き当たりの扉。参考にかなり近い。
- 参考との差: 屋根がコンクリート（参考は金属フレーム）。ガラスの反射は弱い。

### R06 青い水族館通路（GenericCorridor + FogDepth）
- 実装: 装飾扉を外し、両側を aquariumBlue の厚い水槽面（3 m ごとに分割、metalDark の台輪・方立て・上枡）に。areaEmitters で青い光を焼き込み、パネルを ledBlue、床の濡れ 0.6、青い薄霧（mist）、看板「AQUARIUM」。
- 見えたもの（`R06-s7-entry` / `-diag`）: 両側が青白く光る面、青い天井灯、濡れた床の反射。
- 参考との差: 水槽面が明るく均一で「水の中」より「乳白色のライトボックス」に見える（aquariumBlue の emission 0.9 + 青い環境光）。魚影・水の揺らぎは無し（不要と分析済み）。

### R07 地下温室（RoomGenerator OrganicZone + InstanceOvergrowth）
- 実装: 天井パネルを外し、ガラス天井の直下に厚さ 0.32 の skyOvercast の箔（明るい曇天。面光源にはしない）、shelfMetal の段状リブと柱を 3 m ピッチ、リブから垂れる植物（plant の instances）、床の水たまり（decals）、skyAmbient、濡れ 0.35。
- 見えたもの（`R07-s7-entry` / `R07b-s7-entry`）: 白い空の天井とリブ、吊られた葉の塊、床の植生（InstanceOvergrowth）。
- 参考との差: 植物は箔の箔（立方体）で「垂れる」感じが弱い。アーチは段状。床の水は水たまりの箔のみ。

### R08 無書籍図書館（GridGenerator ShelfGrid + AudioEvent）
- 実装: 棚のスラブと詰め物を捨て、空の木製書架 = 段板 5 枚（bookshelfWood、ソリッド、L.boxes）+ 背板（長さ別 instances）+ 支柱（instances）。通路の中心線に天窓風の長いストリップ（lightPanel）。入口側の帯に閲覧机 2 台 + 緑のバンカーズランプ（noticeGreen の傘 + lightWarm + 暖色の点光源）。サイン「QUIET PLEASE / お静かに」。
- 見えたもの（`R08-s7-entry` / `-diag`）: 空の暗い木の書架が列をなし、頭上の白いストリップが奥へ続く。参考に近い。
- 参考との差: 天井は 3.0 m のまま（参考は高い天井）。机は入口側の帯に置けたときだけ（seed 7 では見えない位置）。

### R09 監視映画館（RoomGenerator Theater + PastWindow screen）— 一部保留
- 実装: 座席（ソリッドの furnitureDark）を seatRed に、天井パネルは 3 枚に 1 枚だけ暖色の場内灯として残し他は消灯、点光源 ×0.5 暖色、側壁のスコンス（3 m）、側通路の足元灯（上向きの小箔）、環境光を暗く。スクリーン（wallWhite の非ソリッド箔）は触らない（PastWindow が 'void' に差し替え、ハーネスで 1/1 を確認）。
- 見えたもの（`R09d-front` = 前方から後列を見る / `R09d-aisle` = 側通路からスクリーン方向）: 暗い場内に暗赤色の座席の段が続き、3 枚に 1 枚の暖色の場内灯、側壁のスコンス、側通路の足元灯の列。入口は最後列の背後にあるので、入口からの構図は座席の背（2 m の段）で塞がる（Theater 生成器の配置）。
- 保留（理由）: 映像内容は PastWindow のキャプチャ依存（分析表どおり）。暗さは意図どおりだが座席の赤は近づかないと読めない。

### R10 ゲートのない空港（AtriumGenerator Terminal + FakeSignage flightBoard）
- 実装: 座席スラブを青い連結椅子（metalDark のソリッドの梁 0.36 高 = 段差超えで通り抜け不可、seatBlue の座・背 instances、列ごとに向きを交互）に。入口の 7 m 先に発着案内板（screenDark 4.8 × 1.9 + 発光サイン 5 行 × 3 列 = 出発 / 行先 / GATE・REMARKS。便名は架空、GATE --- が並ぶ）、吊り下げの案内プレート 2 枚、艶床（wetness 0.25）。FakeSignage の案内板スタンドはソリッドの梁を避けて置かれる。
- 見えたもの（`R10b-s7-entry` / `R10-s7-diag`）: 入口正面に大きな発着案内板、青い椅子の列が奥へ、艶タイル、Modifier の DEPARTURES スタンド。
- 参考との差: 板の文字が大きく（行高 0.375 m）、参考の細い行より看板的。ガラスの外壁・飛行機は無し。

### R11 年代混在ホテル（CorridorHotel + EraPreset）
- 実装: 装飾扉の両脇に壁灯（lightWarm のプレート。既存の灯と重ならない位置）、番号プレートを 0.42 幅に。区画ごとの床・壁・扉は EraPreset のまま。
- 見えたもの（`R11-s7-entry`）: 扉ごとに暖色の壁灯が両側に並び、区画で床が変わる。
- 参考との差: 壁紙の柄は EraPreset の材質差（色温度）のみ。

### R12 日用品博物館（RoomGenerator Gallery）
- 実装: 壁と間仕切りを wallDark、島（patternIslands）を暗い台 + glass のケース + 日用品（ケトル stainless / 椒子 plasticYellow / 電話 plasticRed / バケツ plasticBlue / ラジオ）、壁沿いに 4 m ごとの台 + ケース + 説明文（'KETTLE, c. 1998' 等）、各ケースの真上に 0.3 角のスポット（下向きの面光源）、パネル消灯・点光源 ×0.45、題字「THE MUSEUM OF ORDINARY THINGS」。
- 見えたもの（`R12-s7-entry` / `R12b-s7-entry`）: 暗い部屋にガラスケースと台、黄色い椒子とケトル、天井の小さな灯。
- 参考との差: 暗すぎてケースが浮かない（スポットの焼き込みが弱い）。wallDark は CC0 セットで石壁のように見える。

### R13 巨大児童遊園（RoomGenerator PlayArea + ScaleAnomaly ×3）
- 実装（×3 前の寸法）: 島を捨て、原色の遊具（plasticRed のチューブ + plasticBlue の脚 / plasticYellow の踊り場と段状の滑り台 / plasticBlue のボールプール + ボール instances）を 4.5 m 格子から最大 5 つ、市松の床（plasticBlue の箔 300 枚）、腰壁 plasticBlue + plasticYellow、天井パネルを 2.2 倍に広げ環境光を明るく。ScaleAnomaly が全体を 3 倍にする。
- 見えたもの（`R13-s7` / `R13b-s7`）: 巨大な青赤の市松床、赤いチューブ、段状の滑り台。天井 15 m は暗い。
- 参考との差: 参考の「柔らかい光」より暗い（15 m 上の器具）。チューブは直線のみ。

### R14 浸水学校（RoomGenerator GenericRoom + ShallowWater 0.3）
- 実装: 内装を捨て、床 floorWood・壁 wallCream・緑の腰壁、黒板（chalkboard + trim の枡、日付のサイン）を北側優先の壁に、黒板を向く机（furnitureLight の天板 = ソリッド instances、側板、椒子）を 1.1 × 1.4 m 格子で最大 120 台、反対の壁に昼光の窓（skyDay の箔 + 木枡。areaEmitters で光る）、教室名「2-B」。水面・前庭・濡れ帯は ShallowWater。
- 見えたもの（`R14-s7-entry` / `-diag`）: 水面の広い部屋に机の列が並ぶ。黒板・窓は入口からは遠い。
- 参考との差: 部屋が 36 × 36 の大部屋なので「教室」より「浸水した講堂」。窓の昼光は箔の光のみ（分析表の保留どおり）。

### R15 絨毯化する設備通路（CorridorService + MaterialGradient）
- 実装: 進行度 t（入口→end の軸で bounds を射影）で、床に carpetPattern の箔を t 0.35〜0.55 で疎らに・0.55 以降で全面に敷き、保護レール（黄帯・金属帯）を t 0.6 で切り、奥半分に木の腰壁 + 見切りと暖色の壁灯。
- 見えたもの（`R15-s7-entry` / `-diag`）: 灰のコンクリートから赤い模様カーペットへ床が変わり、奥は壁灯の暖色。
- 参考との差: 天井の配管は MaterialGradient が t > 0.6 で間引く既存の挙動。壁材の遷移は色味のブレンドのみ。

### R16 縮尺異常オフィス（RoomGenerator OfficeGrid + ScaleAnomaly perProp）
- 実装: 空いた壁面に大きさの揃わない偽扉（0.5 × 1.15 / 0.9 × 2.05 / 1.25 × 2.7。1 箱 = perProp が一体で拡縮）と番号プレート、艶床（wetness 0.3）。小型扉（しゃがみ）と巨大扉は ScaleAnomaly（ハーネスで crawl 1 を確認）。
- 見えたもの（`R16-s7-entry` / `-diag`）: 机が拡縮したオフィス。偽扉は壁面（入口からは遠い）。
- 参考との差: モニターなど机上の小物は perProp が別倍率にするため置かない。

### R17 無限病棟（CorridorHospital + RepeatDestination）
- 実装: 床と腰壁を白タイル、ベンチを外し、右壁（幅 ≥ 3.4 m なら左壁にも）に白いベッド（whiteFabric のマットレス = ソリッド instances、metalDark の枠・脚・ヘッドボード、枕）を 2.7 m ピッチ、扉のプレートとベッドの上の番号を 301 / 302 の交互（階は 3 + 反復回数 `node.repeat`）。
- 見えたもの（`R17-s7-entry` / `-diag`）: 白タイルの廊下の片側にベッドが並び、冷白色の器具。
- 参考との差: 廊下幅 2.6〜3.6 m のため両側にベッドを置けるのは幅 3.4 m 以上のときだけ（seed 7 は片側）。カーテンレール・点滴スタンドは無し。

### R18 密閉風洞廊下（RoomGenerator GenericRoom + ExternalForce wind）
- 実装: 内装を捨て、床 floorConcrete・壁 wallConcrete・天井 ceilingDark。風向（ExternalForce と同じ規則）の風上の端壁に換気グリル（void の裏地 + metalDark の格子 instances + 枡）、風下に四角い大型ファン（シュラウド + ハブ + 十字の羽根。幅があれば 2 台）、風の筋（lightPanel の細い instances 26 本）、冷白色、看板「WIND TUNNEL 03」。
- 見えたもの（`R18-s7-entry` / `-diag`）: 灰色の空洞に白い風の筋が浮く。グリルとファンは端壁。
- 参考との差: ファンは十字の羽根（円形ではない。instances の yaw では鉛直面の回転ができない）。

### R19 無人喫茶店（RoomGenerator RetailRoom + ParticleDetail steam）
- 実装: 棚を捨て、床 floorWood・壁 wallCream・woodPanel の腰壁、カウンター（furnitureDark + woodPanel の天板、stainless のエスプレッソマシン、bookshelfWood の棚とカップ instances、黒板「GOOD COFFEE / STILL HERE」）、丸机（45° ずらした天板 2 枚、metalDark の脚）+ 椒子 2 脚 + カップ、机ごとのペンダント（metalDark の傘 + lightWarm）、パネル消灯、暖色の点光源 2、ネオン「OPEN」。湯気は ParticleDetail（カウンターの天板が発生源になる）。
- 見えたもの（`R19-s7-entry` / `-diag`）: 木の床にペンダントの下の丸机と椒子、暗い天井。
- 参考との差: 机は最大 12 卓なので大きな部屋では中央に寄る。カップの湯気は Modifier の位置依存。

### R20 巨大トランクルーム（GridGenerator StorageGrid + PropRepetition storageDoor + DuplicateNumber）
- 実装（2026-09-21 A1 で整理）: 赤いシャッターは PropRepetition storageDoor の params `doorMat: 'redShutter'`（rooms.json）で Modifier 側が出す（doorMetal の裏板 0.02〜0.068 = DuplicateNumber の扉検出用 + redShutter の化粧板 0.069〜0.074、番号板は 0.080、横筋は省く。取手・枡はそのまま）。ドレッシングは通路の中心線の蛍光灯ライン（長い lightPanel）と灰の ambient だけ。以前の redShutter のソリッド箔（最大 260）と自前の番号板（規則の二重実装）は外した。
- 見えたもの（`R20-s7-entry` / `-diag` → A1 後 `R20-s7-after.jpg`）: 両側に赤いシャッターの列と DuplicateNumber の番号板、取手、頭上の蛍光灯ライン。見た目は整理前と同じ。
- 構築時間 seed 7: 125 → 95 ms（横筋 800 instances とソリッド箔 200 が無くなった分）。箔 673 → 673（裏板 + 化粧板 = 以前のソリッド箔と同数）。

## 保留（まとめ）
- R04: 格子天井 + 蛍光灯は FakeSky(dusk) と矛盾 → 生垣のみ。判断待ち。
- R09: 映像内容は PastWindow 依存。暗さの最終調整は実機で。
- R14: 水の透明度・昼光は箔の近似（分析表の保留どおり）。

## 開発用
- `?nodress=1` で Rare のドレッシングを外せる（`rare.ts` の先頭。構築時間・見た目の比較用）。
- Node ハーネス: `node scratchpad/p6/rare/check.mjs R01,R02 1,42 0,3`（引数: ID 列 / seed 列 / variant 列）。
