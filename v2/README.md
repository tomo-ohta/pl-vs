# pro_Liminal v2（拡張版）

マルチプレイ・体力・新しい部屋生成を入れる拡張版。**v1 のコードは複製しない**。新しい骨組みを先に作り、v1 から必要なモジュールを直したうえで 1 つずつ移す。

- **全体計画（決まったこと・進め方）: [`docs/v2-plan.md`](docs/v2-plan.md)**
- 引き継ぎ方と移植台帳: [`docs/inheritance-plan.md`](docs/inheritance-plan.md)
- 特殊ギミックとフロア構造（案の一覧と実装方式）: [`docs/gimmicks-and-structures.md`](docs/gimmicks-and-structures.md)
- v1 の元: `../v1/`（凍結。タグ `v1-final`）
- 共通素材: `../shared/public/`（開発時は Vite の publicDir。本番は v1 と同じ /pl-vs/ の素材を読む予定）

## 決まり（抜粋。詳細は継承計画の 2 章）

- `core/` は three.js / DOM を import しない（サーバーとクライアントで共有）。
- 1 人で遊ぶときも「手元で動くサーバー」経由にする。
- シミュレーションは固定 tick、描画は補間。
- 部屋 ID の直書き禁止。違いは型付きのデータで表す。
- ブラウザの保存名は `liminal2.*`（v1 の `liminal.*` と混ざらないように）。
