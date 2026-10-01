# テクスチャ取得の流量制御と遅延読込

公開先（GitHub Pages）で起動時に「一部の素材を読み込めませんでした。再読み込みしてください。」が出る問題への対応。
担当ファイル: `src/render/textureQueue.ts`（新規）、`src/render/MaterialLibrary.ts`、`src/main.ts`。

## 何が起きていたか

`MaterialLibrary.startCc0` は材質 ID ごとの先頭候補 46 セットを「起動時に必ず読む」対象（`eager`）にし、
`materials.ready` がその完了を待っていた。`main.ts` はこの `ready` を待つ間タイトル画面の開始を押せなくしている。

結果として、ページを開いた瞬間に CC0 テクスチャ 139 枚・約 75 MB のリクエストがほぼ同時に飛ぶ。
GitHub Pages はこのバーストをレート制限し、数件が HTTP 503 を返す。three の `ImageBitmapLoader` は
ステータスを表に出さないので再試行もされず、そのセットは `failed` となって単色のまま残っていた。

## 対応

### 1. 並列数の制限（`ImageRequestQueue`）

`fetch` + `createImageBitmap` を自前で呼ぶ待ち行列を用意し、同時に走らせるのは `CC0_MAX_CONCURRENT`（6）件までにした。
`createImageBitmap` が無い環境（Node のテスト・古いブラウザ）では `fallbackLoad`（three の `TextureLoader`）へ退避する。

優先度は 2 段階。構築済みの部屋が参照するセットと初回使用（`derive`）が 0、2 hop 先の先読み（`prefetchRoom`）が 1。
同じ優先度の中では投入順を保つ。

### 2. 指数バックオフ付きリトライ

`fetch` を自前で呼ぶのでステータスが読める。408 / 425 / 429 / 500 / 502 / 503 / 504 と通信エラーだけを
`CC0_MAX_RETRIES`（3）回まで読み直す。待ち時間は 300 ms × 2ⁿ にジッタ（0.5〜1.5 倍）を掛けたもの。
`Retry-After` があればそれを優先する。上限は 8 s。404 のような恒久的な失敗は読み直さない。

### 3. 起動時の一括先読みの廃止

`eager` の概念をやめ、CC0 セットは初回使用時（`derive`）と 2 hop 先の先読みでだけ読むようにした。
`main.ts` は「`ready`（生成テクスチャ + index.json + legacy）を待つ → 世界を作る → 最初の部屋が要るテクスチャだけ待つ
（`materials.imagesReady()` = 優先度 0 の待ちが尽きるまで。15 s で打ち切り）→ 開始を押せるようにする」の順になった。

最初の部屋の面は今までどおり読み込み済みの状態で出る。2 部屋目以降は既存の 2 hop 先読みが賄う。
先読みが間に合わない場合は `index.json` の平均色の 1 px が出る（法線は平坦、粗さ 0.7）。

## 計測（`vite preview`、`?nolock=1&new=1&seed=7`、本番ビルド）

| | 修正前 | 修正後 |
|---|---|---|
| 起動時の CC0 リクエスト | 139 枚 | 76 枚 |
| 起動時の転送量（CC0） | 75.0 MB | 37.8 MB |
| 同時リクエスト数のピーク | 46 以上（一斉） | 6 |
| 失敗 | 配信元によっては数件 503 | 0（再試行込み） |

修正後の 76 枚には 2 hop 先の先読みも含む。最初の部屋そのものが要るのは 21 セット。

## スイッチ

`?l2=throttle` で流量制御と再試行を無効化できる（`?l2=off` で L2 の全機能を無効）。前後比較の計測用。
`?l2=bitmap` は従来どおり `createImageBitmap` を使わず `TextureLoader` へ落とす。

## デバッグ

- `game.materials.imageQueueStatus` → `{ waiting, running, retries, failures, loaded }`
- `game.materials.cc0Status` → `{ index, sets, loaded, materials, variants }`
- `game.materials.prefetchStatus` → `{ rooms, sets }`

## テスト

`node --import ./tests/ts-resolve.mjs tests/texture-queue.mjs`。
`fetch` / `createImageBitmap` を差し替えて、並列数の上限・503 の再試行・404 を再試行しないこと・
再試行を使い切ったときの失敗・優先度の追い越し・`fallbackLoad` への退避を確認する。

## 残っている課題

CC0 テクスチャは平均 553 KB（2K JPEG が中心）で、最初の部屋だけでも 20 MB 前後になる。
さらに減らすなら `npm run build:cc0 -- --max 1024 --aux 512` で書き出し直すか、KTX2 / Basis 化する。
配信を GitHub Pages から移す場合は `docs/` の公開メモを参照。
