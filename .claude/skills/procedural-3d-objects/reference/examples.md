# 見本の形の関数と実測の数

場所: `experiments/v2-splat-props/src/showroom/gen/`。新しい物は、近い見本を読んで同じ書き方で作る。
数は見本の部屋の実測（2026-10-05。三角形は「同じ形のメッシュ」、粒はスプラット）。

| 種類 | 関数（ファイル） | 見どころの技法 | 三角形 | 粒 |
|---|---|---|---|---|
| 鉢植え | `dracaena`・`sansevieria`・`ficus`・`succulent`・`pothos`（plants.ts） | `pot` の鉢、`leaf` の葉（垂れ・ねじれ・縁の色）、黄金角のロゼット、編んだ幹（`tube`）、垂れるつる | 0.6 万〜6.9 万 | 1.2 万〜14 万 |
| 植え込み | `shrub`（plants.ts） | 楕円体の芯 + 表面の小さな葉 | 3 つで 15 万 | 28 万 |
| ぬいぐるみ | `bear`・`rabbit`・`cat`（plush.ts） | 部位の楕円体を回して組む、毛羽（スプラットだけ）、ビーズの目、縫い目の管、リボン | 0.5 万〜1 万 | 1.7 万〜3.1 万 |
| 本の列 | `bookRow`・`openBook`（books.ts） | 1 冊ずつ（厚み・高さ・色・背の帯・題名の札）、シリーズ、傾き、平積み、見える面だけ | 壁の本棚 1 台 3 万〜8.4 万（両面の島 17 万） | 8.7 万〜25 万（島 49 万） |
| 棚の商品 | `goodsRow`・`petBottle`・`can`・`snackBag`・`carton`・`cupNoodle`（goods.ts） | 透ける本体と中身、巻いたラベル（u = π/2 が正面）、ぎざぎざのふた、袋のしわ | 棚 1 台 7 万〜25 万 | 20 万〜72 万 |
| 寝具・布 | `duvet`・`pillow`・`cushion`・`throwBlanket`・`curtain`・`towelStack`・`futon`（fabric.ts） | 垂れる縁、折り返し、ふくらみ（`superellipsoid` + `warp`）、ひだ、パイピング | 1 万〜4 万 | 3 万〜15 万 |
| 紙 | `sheet`・`paperStack`・`crumpled`・`scattered`・`binTrash`（paper.ts） | 文字の行の模様、反り、ずれて重なる束、しわの玉 | 0.6 万〜1.7 万 | 1.2 万〜5 万 |
| 丸い物・設備 | `cone`・`extinguisher`・`wallClock`・`coolerBottle`・`deskLamp`・`vaseFlowers`・`sculpture`・`trophy`・`toiletRoll`（objects.ts） | 回転体の輪郭、反射帯、目盛りと針、光る笠の内側、結び目（`tube` の閉じた曲線）、金属のつや | 0.15 万〜1.9 万 | 0.4 万〜3.4 万 |
| 陶器 | `vesselSink`・`urinal`（porcelain.ts） | 器のくぼみ（内側は `flip`）、`skip` で開口、金属の蛇口 | 1.8 万〜2.5 万（3 つで） | 4 万〜7.6 万 |
| 設備 | `wallBasin`・`toilet`・`sconce`・`kitchenTop`（fixtures.ts）、`vendingDisplay`（goods.ts）、`pinnedSheet`（paper.ts）、`extinguisherStand`・`hoop`・`plate`・`ballPit`（objects.ts） | 壁付けの器と S 字の排水管、便座とふた（開け閉め）、光る笠、流しの形に穴を抜いた天板（`skip`）、見本の後ろの板と光る帯、画びょう、網（斜めに交わる細い `tube`） | 設備の部屋 10 点で 13.9 万 | 44 万 |
| 持てる物 | `CARRY_GEN`（carry.ts。v2 の kind ごとに 19 種） | v2 の持てる物の大きさ `half` に合わせる。帯・テープ・札は面の (s, t)、重りの点は (u, v) で描く（部屋の座標 p は使わない）。バケツの水面は別の物（高さを動かす） | 持てる物の部屋 20 点で 14.7 万 | 54 万 |

見本の部屋全体（7 部屋・64 点）: 三角形 約 124 万・テクスチャ 約 1,060 万画素（GPU 約 186 MB、無圧縮）/ 粒 約 443 万（GPU 約 473 MB）。平らな面の頂点を減らす前は、持てる物の部屋で 19.9 万・本の多い所で約 3.6 倍あった。ぬいぐるみの数は `blobby` にする前の物。

## 置き方の見本（layout.ts）

- 台座の上: `onPlinth(...)`。v2 の `plinth` の上の箱を外して、同じ所に形の関数で置く
- 棚の中身: v2 の `wallShelf` / `shelfIsland` を中身なし（`'none'`）で置き、段の高さ（`shelfLevels`）ごとに `bookRow` / `goodsRow` を並べる。v2 の中身の箱は見比べ用（`cmp:`）
- ベッド・ソファの上: v2 の `bed` / `sofa` の柔らかい箱を外し、上面の高さに合わせて布を置く
- 展示物の登録: `add({ id, name, room, group, note, gen, own, proxy, collider, compare, view })`。`view` は立つ位置と見る点（N / B で移る）

## ゲームの世界で差し替える見本（world.html）

- 見つける: `src/procedural/recognize.ts` の `planCell(cell)` が、区画の箱の propGroup と形（大きさ・材質・並び・向き）から `{ label, hide, add, gen, seed }` の一覧を作る。`hide` は隠す元の箱、`add` は差し替え中だけ足す箱（流しの下を抜いた台）、`gen` は部屋の座標に置いた形の関数
- 元の箱を分ける: 描画の写しで `hide` の箱に印（revealGroup）を付けて区画を作らせると、元の箱が小物ごとの別のメッシュになる。当たり判定は元のまま
- 照明: 区画ごとに 1 回 `exhibitLighting(写し, 隣)` を作って、区切りの間で使い回す（印の付いた元の箱は遮蔽に入れない）
- 持てる物: v2 の描画の登録（`defineView`）をそのページの中でだけ上書きし、v2 の振る舞い（位置・持つ・水・運ぶと変わる・音）を写したうえで、見た目だけ形の関数の物にする
