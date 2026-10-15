# 謎とヒントの検証デモ（puzzle-hint-lab）

100 部屋を一人称で巡り、部屋ごとの謎（ボタン）と、制圧数に応じて解放されるヒントの出し方を試すデモ。
v1 / v2 / shared のファイルは使わない（three だけリポジトリ直下の node_modules の物）。計画と決めたことは [docs/00-plan.md](docs/00-plan.md)。

## 起動

```bash
npm run dev --prefix experiments/puzzle-hint-lab
```

→ http://localhost:5181/ （`.claude/launch.json` の `puzzle-hint-lab`）。画面をクリックすると始まる（Pointer Lock）。

## 公開（GitHub Pages）

https://tomo-ohta.github.io/pl-vs/hint/ （v1・`lab/`・`v2/` と同じ公開物に `hint/` を足す。noindex 付き）

- main の中身を公開する: main を git worktree に出し（node_modules はリポジトリ直下への symlink）、そこで `npm run deploy:pages --prefix experiments/puzzle-hint-lab`
  （`vite build --base /pl-vs/hint/` → `gh-pages -d dist --add --dest hint`。ほかのフォルダは消さない）
- v1 を出し直す（`npm run deploy:v1`）と公開物が入れ替わり `hint/` も消える → その後に出し直す（`lab/`・`v2/` と同じ）

## 操作

| キー | 働き |
|---|---|
| W A S D / 矢印 | 移動（Shift で走る） |
| マウス | 見回す |
| クリック / E | 照準の先のボタンを押す（届くのは 2.7 m まで） |
| Tab | タブレットを出す・しまう（出している間は歩く・見回すだけ。ボタンは押せない） |
| 1 / 2 / ホイール | タブレットのタブ（1 MAP: 全体マップと進行率バー / 2 HINT: 今いる部屋のヒント） |
| V | タブレットの見せ方を替える（空中のホログラム ↔ 手に持つガラスの端末） |
| N | デバッグ: 次のヒント段階まで制圧を進める |
| Esc | 一時停止（設定・デバッグ） |

## 決まり

- 部屋ごとに **踏破**（一度でも入った）と **制圧**（謎を解いた）。制圧した部屋は踏破も立つ
- 難易度 0 / 1 / 2 / 3 をちょうど 50 / 25 / 20 / 5 部屋（スタートの ROOM 001 は難易度 0）
- ボタンは難易度 0〜3 で 1 / 3 / 4 / 5 個。難易度 0 は押せば制圧。ほかは全部押してから判定し、違えば赤く点滅して戻る
- ヒント 1（抽象）/ 2（具体）/ 3（核心）は、制圧 50 / 75 / 95 部屋で全部屋に同時に解放
- 進行と位置はこのブラウザに保存（seed ごと。`phl.progress.v1.<seed>`）。初期化は Esc → デバッグ

### 謎の型（部屋の中の手がかり）

| 難易度 | 型 | 手がかり | 正しい順 |
|---|---|---|---|
| 0 | single | なし | 押すだけ |
| 1 | pips | ボタンの上の点の数 | 少ない順 |
| 1 | height | ボタンが付いている高さ | 低い順 |
| 1 | blink | ボタンの上の灯りの点滅の回数 | 少ない順 |
| 2 | stripes | 別の壁の色の帯 | 帯の左から |
| 2 | symbols | 別の壁の記号の札 | 札の上から |
| 2 | words | 別の壁の言葉の札（空・森・炎…） | 言葉が表す色の順 |
| 2 | lights | 別の壁の、色を変える灯り | 灯る色の順（暗い後が始まり） |
| 3 | remote | 扉でつながった隣の部屋の色の帯（札に「ROOM 015」のように持ち主の番号） | 帯の左から |
| 3 | legend | 記号の並びの札 ＋ 記号 → 色の対応表 | 並びを色に置き換えた順 |

- 型と難易度の対応・ボタンの数: `src/gen/puzzles.ts` の `KINDS_BY_DIFFICULTY` / `BUTTON_COUNT`
- ヒントの文: `src/gen/hints.ts` の `TEMPLATES`（型ごとに 1〜3。部屋の方角・色・記号・隣の部屋の番号が入る）
- 正しい順は「左から順」「右から順」にならないようにしている

## URL の値

| 値 | 中身 |
|---|---|
| `?seed=1015` | 世界の seed（既定 1015。同じ seed なら同じ地図・謎・ヒント） |
| `?tablet=holo` / `glass` | タブレットの見せ方（設定より先） |
| `?h1=50&h2=75&h3=95` | ヒント 1 / 2 / 3 を解放する制圧の部屋の数 |
| `?test=1` | Pointer Lock を使わない（自動の確かめ用。見回しはできない） |

## デバッグ（コンソール）

```js
debug.nextStage()   // 次のヒント段階まで制圧を進める（未制圧を難易度の低い順に。今いる部屋は後回し）
debug.reset()       // 進行の初期化
debug.visitAll()    // 全部屋を踏破
debug.answer()      // 今の部屋の答え
debug.warp(25)      // ROOM 025 へ移る
debug.face('buttons') / debug.face(0) / debug.face('other')  // ボタン・手がかりの方を向く
debug.press(0)      // 今の部屋の左から 0 番目のボタンを押す
```

## 作り

| 所 | 中身 |
|---|---|
| `src/gen/` | DOM / three を使わない生成と計算（Node の試験の対象）。`mapgen`（100 部屋を接ぎ足して育てる・扉・回り道）・`difficulty`・`puzzles`（謎と手がかりと壁の空き）・`hints`・`progress`（段階・デバッグの選び方）・`world` |
| `src/world/` | 3D。`WorldView`（床・壁・天井・扉の枠・札・状態の帯・当たり判定・座標 → 部屋）・`PuzzleView`（ボタン・灯り・判定）・`Glyphs`（文字と記号の絵）・`MeshBuilder` |
| `src/player/` | 入力と一人称の移動（円と箱の当たり判定） |
| `src/game/Progress.ts` | 踏破・制圧・ヒントの段階・新着・保存 |
| `src/tablet/` | `TabletScreen`（画面の絵: canvas 1920 × 1200）・`TabletView`（空中のホログラム / ガラスの端末・開く演出・シェーダー）・`holo`（描く道具） |
| `src/ui/` | HUD（照準・部屋の札・方位・通知）・開始と一時停止の画面・設定・CSS |
| `src/audio/Sfx.ts` | 効果音（WebAudio の合成） |

## 試験・確かめ

```bash
npm test --prefix experiments/puzzle-hint-lab
```

```bash
npm run typecheck --prefix experiments/puzzle-hint-lab
```

画面を撮る（裏の Chrome。開発サーバーが要る。出力は `scratch/shots/`、git に入らない）:

```bash
node experiments/puzzle-hint-lab/tools/shot.mjs tab --key Tab@0.5 --at 1.6
```
