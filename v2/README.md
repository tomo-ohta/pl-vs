# pro_Liminal v2（拡張版）

マルチプレイ・体力・新しい部屋生成を入れる拡張版。**v1 のコードは複製しない**。新しい骨組みを先に作り、v1 から必要なモジュールを直したうえで 1 つずつ移す。

- **全体計画（決まったこと・進め方）: [`docs/v2-plan.md`](docs/v2-plan.md)**
- 引き継ぎ方と移植台帳: [`docs/inheritance-plan.md`](docs/inheritance-plan.md)
- 特殊ギミックとフロア構造（案の一覧と実装方式）: [`docs/gimmicks-and-structures.md`](docs/gimmicks-and-structures.md)
- 作り込む小物（植物・棚の中身・寝具・便器などを形の関数で作る）: [`docs/props.md`](docs/props.md)
- v1 の元: `../v1/`（凍結。タグ `v1-final`）
- 共通素材: `../shared/public/`（開発時は Vite の publicDir。本番は v1 と同じ /pl-vs/ の素材を読む予定）

## 構成とコマンド

```
v2/
├─ core/       純 TypeScript（three.js・DOM 禁止。サーバーとクライアントで共有）
│   ├─ config/tuning.ts   調整表（生成と仕掛けの数値はすべてここ。URL ?tune=キー=値,… で上書き）
│   ├─ math/ world/       数学・世界の型（FloorLayout・区画・開口・箱）
│   ├─ sim/               固定 tick のシミュレーション（移動・当たり判定・部品 parts/）
│   ├─ physics/           Rapier（決定論版）の包み
│   ├─ gen/floor/         フロアの生成（性質 → 骨組み → 形 → 仕掛け → 隠し → 中身 → 検証）・裏のフロア・見本のフロア
│   ├─ gen/gimmicks/      仕掛けの定義（部品の配線）
│   ├─ gen/secrets/       隠し部屋を付ける（存在型 / 出現型）
│   ├─ gen/dress/         区画の中身（家具・設備。テーマ × 区画の種類）
│   └─ lab/               段階 1 の実験場
├─ client/     Vite + three.js（描画・音・入力・UI。シミュレーションの結果を見せるだけ）
│   └─ props/             作り込む小物（形の関数・区画の箱から見つける・Worker で作る・近い所から差し替える。docs/props.md）
├─ tests/      node --test（*.test.ts を Node がそのまま実行。tests/helpers/bot.ts は歩く人）
└─ tools/check-boundaries.mjs  core/ が three・client・vite を import していないかの確認
```

```bash
npm run dev:v2      # 直下から。http://localhost:5174/
npm run verify:v2   # 型チェック（core は DOM なし / client）+ 境界の確認 + テスト
```

URL の指定（開発用）:

| 指定 | 内容 |
|---|---|
| （指定なし） | トップページ（仮）: ルーム ID を入れる・ランダムな部屋・はじめから |
| `?id=1234` | その番号の部屋から始める（ルーム ID。無い番号は「通信エラー」→ トップページ。遊んでいる間、部屋を移るたびにアドレスとタブの名前が変わる。`docs/endless-world.md` 15 章） |
| （遊んでいる間）Tab | タブレット（カメラ・探索・マップ・SNS・ギャラリー・設定。`docs/tablet.md`）。スマホは右の「端末」ボタン |
| `?seed=3&depth=2` | 世界の seed と始める深さ（ふつうは果てしない階。`docs/endless-world.md`）。seed だけならトップページ（その seed の世界） |
| `?floor=1` | 果てしない階でなく、今までのフロア（フロア単位の生成・出口の階段で次のフロアを読む）で遊ぶ |
| `?variant=1` | 裏のフロアから始める（`?floor=1` のとき） |
| `?showcase=1` / `?showcase=2` | 段階 3 の見本のフロア（仕掛け 14 種・異変 14 種・隠し全部。2 は隠しの型が逆）。G / Shift+G で仕掛けの入口へ移る |
| `?try=id,id,…` | 指定した仕掛け・異変・部屋の形（id か案の番号。例 `?try=windTunnel,snow,S08`）だけを置いた見本のフロア。1 つのフロアに 8 種くらいまで |
| `?group=<担当>` | 担当（move・ground・sense・oddity・carry・warp・structure・rooms・map）の仕掛け・異変を置ける分だけ置いた見本 |
| `?shape=<型>` | フロアの形の型を決めて作る（spiral・tower・station・islands・rooftop・megahall …。`core/gen/floor/themes.ts`）。フロアで遊ぶ |
| `?name=…` | 名札・掲示に出す名前（異変「自分の名前」） |
| `?dev=1` | ふつうのフロアでも G で仕掛けを見て回れる |
| `?tune=キー=値,…` | 調整表の上書き（例: `?tune=secrets.perFloorMean=3`） |
| `?nodress=1` | 区画の中身（家具）を置かない |
| `?props=0` | 作り込む小物を形の関数の物にしない（箱のまま。見比べ用）。見本・`?dev=1` では P で切り替え |
| `?lab=1` | 段階 1 の実験場 |

- 果てしない階の開発用: `window.session`（core/stream/session.ts の WorldSession。`session.active` が今の階の StoryWorld）。
  区域は Worker で作り、作った区域を `[区域]` で console に出す
- 作り込む小物の開発用: `game.props.stats()`（区切り・小物・三角形・GPU の量）・`game.props.setEnabled(false)`（箱に戻す）
- import は拡張子 `.ts` まで書く（Vite と Node の両方でそのまま動かすため）。
- 本番ビルドで `VITE_ASSET_BASE=/pl-vs/` を渡すと、素材を複写せず v1 と同じ素材を読む（`BASE_PATH=/pl-vs/v2/` と一緒に使う）。

## 決まり（抜粋。詳細は継承計画の 2 章）

- `core/` は three.js / DOM を import しない（サーバーとクライアントで共有）。
- 1 人で遊ぶときも「手元で動くサーバー」経由にする。
- シミュレーションは固定 tick、描画は補間。
- 部屋 ID の直書き禁止。違いは型付きのデータで表す。
- ブラウザの保存名は `liminal2.*`（v1 の `liminal.*` と混ざらないように）。
