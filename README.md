# pro_Liminal

リミナルスペース探索 Web ゲーム。版ごとにディレクトリを分け、重い素材だけを共有する（npm workspaces）。

```
pro_Liminal/
├─ package.json   workspaces のルート（依存は直下の node_modules にまとめて入る）
├─ shared/        v1 / v2 共通の素材
│   ├─ assets/    素材の原本（CC0・Adobe・提供素材。大半は git 管理外 → shared/tools で再取得）
│   ├─ public/    ゲームが読む変換済み素材（cc0 / textures / audio / basis）。各版の Vite の publicDir
│   └─ tools/     素材の取得・変換（build-*.mjs / fetch-*.py）
├─ v1/            現行版（Phase 1〜第22回）。凍結: 不具合修正のみ。分割直前はタグ v1-final
└─ v2/            拡張版（マルチプレイ・体力・新しい部屋生成）。v1 は複製せず、継承計画に沿って移植する
```

## 使い方

```bash
npm install                      # 直下で 1 回（全 workspace の依存が入る）
npm run dev:v1                   # v1 の開発サーバー（http://localhost:5173）
npm run typecheck:v1
npm run deploy:v1                # v1 を GitHub Pages（/pl-vs/）へ
npm run build:cc0 -w shared      # 素材の変換（他は shared/package.json）
```

各版の詳細は `v1/README.md`、v2 の方針は `v2/README.md` と `v2/docs/inheritance-plan.md`。

## 分け方の決まり

- **shared に置くもの**: 版をまたいで同じ物を使う重い素材と、その変換ツールだけ。コードは置かない（共通化が必要になったら、v2 で設計し直したものを `shared/` 配下のパッケージとして切り出す）。
- **版ごとに持つもの**: ソース・データ（xlsx から作る JSON）・テスト・資料・撮影画像・作業用 scratch。
- **ブラウザ保存の名前**: v1 と v2 は同じ公開元（tomo-ohta.github.io）に置くので、localStorage / IndexedDB の保存領域を共有する。v1 は `liminal.*` / `liminal-codex`、v2 は `liminal2.*` などの別の接頭辞を使い、混ざらないようにする。
- **公開**: v1 は今の URL（/pl-vs/）、v2 は /pl-vs/v2/。素材は二重に置かない（v2 は素材の配信元を設定で指定できるようにする。詳細は継承計画）。
  - 注意: v1 の `deploy:pages` は gh-pages ブランチを丸ごと置き換える。v2 を公開した後は、両方の版をまとめて 1 回で公開する手順に切り替える。
