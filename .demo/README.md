# Demo Hubへの公開

このリポジトリの2つの検証デモを、共通の限定公開サイトへ別々に公開します。

| デモ | ID | 入口 | 検証・ビルド対象 |
| --- | --- | --- | --- |
| ビジュアルデモ | `visual-demo` | `arch.html`（建築版） | `experiments/visual-style-lab` |
| ヒントデモ | `hint-demo` | `index.html` | `experiments/puzzle-hint-lab` |

mainへマージすると、GitHub Actionsの「Publish demos」が型検証・テスト・ビルドを実行し、成功した公開ファイルを共通基盤へ送ります。PRでは検証とビルドだけを行います。Cloudflareの秘密情報をこのリポジトリへ登録する必要はありません。

日常の変更はそれぞれの元のフォルダで行ってください。ビジュアルデモの元の版・小物見本帳も同じデモ内に含めます。ヒントデモのフォントはライセンスとともに同梱し、外部フォントサービスへ接続しません。

一覧: https://game-demo-hub.tomo-ohta-demos.workers.dev/ （管理者の共有リンクで認証）。一覧の「デモを開く」から各デモへ移動できます。

手動でmainの再公開を依頼する場合（GitHub CLIへのログインが必要）:

```sh
npm run demo:publish -- --demo visual-demo
npm run demo:publish -- --demo hint-demo
```

手元の未コミット変更は公開されません。完了はGitHub Actionsで確認します。以前のRelease IDに戻す場合は、同じコマンドへ `--rollback SHA-RUN_ID-ATTEMPT` を追加します。

設定は `demo.config.json`、公開元の許可・一覧の説明・公開中の版は共通基盤側で管理します。既存のGitHub Pages公開設定は従来どおりです。
