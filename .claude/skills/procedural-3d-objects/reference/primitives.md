# 形の部品の使い方（surfel.ts）

場所: `experiments/v2-splat-props/src/showroom/surfel.ts`。形の関数は `(S: Surfels, R: Rand, xf: (p: V3) => V3, …) => void` の形で書く。

## 約束

| | |
|---|---|
| 単位 | m |
| 局所の座標 | 原点は底の中心（壁に掛ける物は壁の面）、**正面は +z**、上は +y |
| 置き場所 | `place(原点, yaw, 大きさ)` が局所 → 部屋の写し。yaw は局所の +z が向く向き（0 で +z、π/2 で +x、−π/2 で −x） |
| 色 | 線形 RGB（`lin(0xRRGGBB, 倍率)`）。光る分は `look.emit`（線形・HDR 可） |
| 面の表 | 外向き。`revolve`・`ellipsoid`・`superellipsoid` は外向きになる。内側を表にするなら `flip: true` |
| 乱数 | `Rand`（種つき）。`Math.random` は使わない（同じ種で同じ物になる） |
| 置く順 | 曲面はその場で計算される（後から変わる変数を閉じ込めても良いが、置いた時点の値が使われる） |

## 曲面 `surface(S, o)` と共通の引数

すべての部品は `surface()` を通る。粒（スプラット）を置き、`S.patches` があれば同じ形のメッシュの三角形とテクスチャも書き足す。v・u とも**長さで等間隔**に置く。

| 引数 | 意味 |
|---|---|
| `u`, `v` | パラメータの範囲 |
| `pos(u, v)` | 位置（局所） |
| `color(u, v, p, n)` | 色（線形）。模様は (u, v) で決める |
| `spacing` | 粒の間隔（m）。メッシュの頂点は 2.5 倍、テクスチャは同じ細かさ |
| `look` | 材質（下の LOOK）。`opacity` < 1 は透ける物 |
| `rough(u, v, p)` | 場所ごとの粗さ（省略で look.rough） |
| `flip` | 表裏を逆に（器の内側など） |
| `twoSided`, `backColor` | 裏にも面を置く・裏の色（葉・紙・布） |
| `skip(u, v, p)` | true の所は置かない（開口・ぎざぎざの縁） |
| `xf` | 局所 → 部屋の写し（`place(...)` を渡す） |
| `rand` | 乱数（`R`） |
| `jitter`, `size` | 粒の位置のばらつき・広がり（スプラットだけ） |

## 形の部品

| 部品 | 使い道 | (u, v) の意味 |
|---|---|---|
| `revolve(S, 中心, prof, o)` | 瓶・缶・花瓶・鉢・器・笠・脚（回転体）。`prof(t) = [半径, 高さ]`、t = 0..1 | u = 角度（0..2π。**正面 +z は u = π/2**）、v = 輪郭の t |
| `ellipsoid(S, 中心, 半径[3], o)` | ぬいぐるみの部位・丸めた紙・茂み。`warp(p, d)` で形を崩す | u = 経度、v = 天頂角（0 = 上） |
| `superellipsoid(S, 中心, 半径[3], e1, e2, o)` | 枕・クッション・タオル・袋・角の丸い箱（e が小さいほど角張る。0.1〜1） | 色の関数には経度 u・緯度 v（赤道 v = 0）を渡す。中は立方体の面から写しているので角張っていても粒が欠けない |
| `tube(S, path(t), rad(t), o)` | 茎・枝・ホース・取っ手・針金・縫い目 | u = 周、v = 中心線の t |
| `quad(S, 原点, a, b, o)` | 紙・本の面・板・ラベル。表は a × b の向き | u・v = 0..1 |
| `boxFaces(S, min, max, '+x-y…', color, o)` | 見える面だけの箱（本の天・紙パック） | 面ごと。色の関数には面の (s, t) を渡す |
| `blobby(S, parts, { k, spacing, look, rand, xf, margin, after })` | ぬいぐるみの胴と手足・頭と耳のように、部位が**なめらかにつながる**物（楕円体のなめらかな和。k がつなぎ目の丸み、0.015〜0.03 m） | 部位ごとの `color(d, p)`（d は部位の中心からの向き） |

植物・ぬいぐるみ用（`gen/` の中）:

| 部品 | 使い道 |
|---|---|
| `leaf(S, R, xf, { base, dir, length, width, droop, shape, color, cup, twist })`（plants.ts） | 葉 1 枚（両面）。shape は lance / heart / sword / oval。color(s, t, edge) |
| `pot(S, R, xf, { r0, r1, h, color, rim, soil })`（plants.ts） | 丸い鉢と土。返り値は土の高さ |
| `part(...)`・`fuzz(...)`・`bead(...)`・`stitch(...)`（plush.ts の中） | 毛のある部位・毛羽（スプラットだけ）・つやのある目・縫い目 |

## 材質 `LOOK`

| 型 | 粗さ | 材質の番号 | 使い道 |
|---|---|---|---|
| `matte` | 0.85 | 0 | 塗装・紙の箱 |
| `fabric` | 0.95 | 0 | 布・ぬいぐるみ |
| `plastic` | 0.38 | 1（薄いクリアコート） | プラスチック |
| `glossy` | 0.2 | 1 | つやのあるプラスチック・塗装 |
| `ceramic` | 0.3 | 2（釉薬のクリアコート） | 陶器・大理石 |
| `metal` | 0.3 | 3 | 金属（metal 1） |
| `leaf` | 0.55 | 0 | 葉 |
| `paper` | 0.9 | 0 | 紙 |
| `clear` | 0.08 | 4（クリアコート・透ける） | ペットボトル・ガラス・液体（opacity < 1） |

部位ごとに `{ ...LOOK.plastic, rough: 0.3 }` のように上書きしてよい。

## 細かさとメッシュだけの作成

- `detail.spacingScale`（既定 1）: すべての曲面の間隔に掛ける倍率。遠くの物・数の多い物を粗く作るときに、形の関数の前後で一時的に変える（`world.html` は既定 1.5、棚の中身の遠い区切りは 3）
- `S.patches = []` でメッシュの曲面を記録、`S.noSplats = true` で粒を作らない（メッシュだけ。形の関数は同じ）
- 平らな面は自動で頂点を減らす（`isAffine`。`skip` のある面・閉じた面は除く）

## 道具

- `lin(hex, k)`・`mix3(a, b, t)`・`scale3(a, k)`・`norm(v)`
- `noise3(x, y, z)`・`fbm(x, y, z, oct)`（0..1 のなめらかなノイズ。しわ・むら・汚れ）
- `Rand`: `next()`・`range(a, b)`・`int(a, b)`・`pick(arr)`・`chance(p)`

## 書き方の例（ペットボトルの要点）

```ts
export function petBottle(S: Surfels, R: Rand, xf: Xf, kind = R.int(0, DRINKS.length - 1)): void {
  const body = (t: number): [number, number] => { /* 高さ t × 0.185 m の輪郭: 底の丸み・くびれ・肩・口 */ };
  revolve(S, [0, 0, 0], body, { spacing: 0.006, look: { ...LOOK.clear, opacity: 0.32 }, rand: R, xf, color: () => lin(0xe8f0f2, 0.9) }); // 透ける本体
  revolve(S, [0, 0, 0], (t) => { const [r, y] = body(t * fill / 0.185); return [r - 0.0015, y]; }, { ... });                         // 中身（少し内側）
  revolve(S, [0, 0, 0], (t) => [0.0335, 0.045 + t * 0.06], { ..., color: (u, v) => label(u, v, …) });                                // ラベル（u = π/2 が正面）
  revolve(S, [0, 0, 0], (t) => [0.0148 + (Math.sin(t * 60) > 0 ? 0.0004 : 0), 0.185 + t * 0.02], { ... });                           // ぎざぎざのふた
}
```

全体は `gen/goods.ts`。
