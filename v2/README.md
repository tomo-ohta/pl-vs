# pro_Liminal v2（拡張版）

マルチプレイ・体力・新しい部屋生成を入れる拡張版。**v1 のコードは複製しない**。新しい骨組みを先に作り、v1 から必要なモジュールを直したうえで 1 つずつ移す。

- **全体計画（決まったこと・進め方）: [`docs/v2-plan.md`](docs/v2-plan.md)**
- 引き継ぎ方と移植台帳: [`docs/inheritance-plan.md`](docs/inheritance-plan.md)
- 特殊ギミックとフロア構造（案の一覧と実装方式）: [`docs/gimmicks-and-structures.md`](docs/gimmicks-and-structures.md)
- v1 の元: `../v1/`（凍結。タグ `v1-final`）
- 共通素材: `../shared/public/`（開発時は Vite の publicDir。本番は v1 と同じ /pl-vs/ の素材を読む予定）

## 構成とコマンド

```
v2/
├─ core/       純 TypeScript（three.js・DOM 禁止。サーバーとクライアントで共有）
│   ├─ config/tuning.ts   調整表（生成と仕掛けの数値はすべてここ。URL ?tune=キー=値,… で上書き）
│   └─ physics/rapier.ts  Rapier（決定論版）の読み込み
├─ client/     Vite + three.js（いまは起動確認の画面だけ）
├─ tests/      node --test（*.test.ts を Node がそのまま実行）
└─ tools/check-boundaries.mjs  core/ が three・client・vite を import していないかの確認
```

```bash
npm run dev:v2      # 直下から。http://localhost:5174
npm run verify:v2   # 型チェック（core は DOM なし / client）+ 境界の確認 + テスト
```

- import は拡張子 `.ts` まで書く（Vite と Node の両方でそのまま動かすため）。
- 本番ビルドで `VITE_ASSET_BASE=/pl-vs/` を渡すと、素材を複写せず v1 と同じ素材を読む（`BASE_PATH=/pl-vs/v2/` と一緒に使う）。

## 決まり（抜粋。詳細は継承計画の 2 章）

- `core/` は three.js / DOM を import しない（サーバーとクライアントで共有）。
- 1 人で遊ぶときも「手元で動くサーバー」経由にする。
- シミュレーションは固定 tick、描画は補間。
- 部屋 ID の直書き禁止。違いは型付きのデータで表す。
- ブラウザの保存名は `liminal2.*`（v1 の `liminal.*` と混ざらないように）。
