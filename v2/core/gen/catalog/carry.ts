/**
 * 案の台帳・物を運ぶ・パズル・ミニゲーム（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 *
 * 共通の部品（core/sim/parts/carry）: 持てる物 carryItem（物理なし）/ carryBody（剛体）・受け carryReceiver（枠・範囲・重さ・向き）・
 * 持って待つ枠 carrySensor。調べる（E）で拾い、Q で置く（枠へ吸い付く）、走りながら・上を向いて Q で投げる。持ったまま別の物を調べると入れ替え。
 * 報酬は置かない: 運ばなくても普通に通れる。運ぶ・普通と違う遊び方をすると隠し（v2-plan.md 4 章）。
 */
import type { CatalogEntry } from './types.ts';

const WIP = '作業中（段階 4 の carry で作る）';

export const CARRY_CATALOG: CatalogEntry[] = [
  // ---- 2.10 物を運ぶ・置く ----
  {
    idea: 'I01', name: '水を運ぶ', status: 'done', impl: [{ kind: 'gimmick', id: 'carryWater' }, { kind: 'part', id: 'carryItem' }, { kind: 'part', id: 'carryLevel' }],
    note: '入口の近くの蛇口でバケツを満たし、奥の台の皿へ注ぐ（置くと注がれてバケツは蛇口へ戻る。何度でも）。速く歩く・跳ぶとこぼれる（しずくと音。carry.water.*）。皿に溜まった量が見えるので「少し足りない」が分かる。運ばなくても通れる',
  },
  {
    idea: 'I02', name: '荷物と待つ扉', status: 'done', impl: [{ kind: 'gimmick', id: 'parcelGate' }, { kind: 'part', id: 'carrySensor' }],
    note: '配達の部屋: 棚に色の札の荷物 3 つ、別の壁に色の札の受け取り口と床の枠。札と同じ色の荷物を持って枠で待つと枠の灯りが満ちて壁が開く（出現型・必ず付ける。requiresSecret）。何も持たずに待っても何も起きない',
  },
  {
    idea: 'I03', name: '本を集める', status: 'done', impl: [{ kind: 'gimmick', id: 'bookCollect' }, { kind: 'part', id: 'collectSet' }],
    note: '書庫の床一面に本（6〜10 冊）。歩いて上を通ると拾う（操作は要らない。腕の中に積み上がる）。奥に返却台。全部そろうと台の灯りがつく（記録が埋まる感じ。報酬ではない）。拾う操作を E にしなかったのは、BI03 の「1 冊も拾わない」を遊びにするため',
  },
  {
    idea: 'I04', name: '椅子を戻す', status: 'done', impl: [{ kind: 'gimmick', id: 'chairRoom' }],
    note: '机の並んだ教室に椅子が散らばる（向きもばらばら）。机の後ろの床に椅子の印。拾って印に置くと吸い付いて机の方を向く。全部そろうとチャイム（片付いた合図。報酬ではない）。押すのではなく持ち上げて運ぶ形にした（スマホでも同じ操作）',
  },
  {
    idea: 'I05', name: '鍵ではない鍵', status: 'done', impl: [{ kind: 'gimmick', id: 'keycardGate' }, { kind: 'part', id: 'carrySensor' }],
    note: '壁際に改札（機械 2 台・赤い読み取り口）。同じフロアの別の部屋（clueCells）に社員証か切符が落ちている。持って改札の間に立つと読み取り口が緑になり、扉の板が消えて壁が開く（出現型・必ず付ける）。行き先が通り抜けなら近道になる。廊下にも置ける',
  },
  {
    idea: 'I06', name: '落とし物を届ける', status: 'done', impl: [{ kind: 'gimmick', id: 'lostItem' }],
    note: '机の上と壁に色の名札がある部屋（脇道の部屋）。同じ色の札の傘・鞄・人形が、別の部屋（2 つ以上先）に落ちている。机の上に置くと壁が開く（出現型・必ず付ける）。部屋は扉の向こうなので、名札の色を探して扉を開けて回る',
  },
  {
    idea: 'I07', name: '電球を付け替える', status: 'done', impl: [{ kind: 'gimmick', id: 'bulbRoom' }],
    note: '照明が全部消えた部屋（懐中電灯で進める）。真ん中の電気スタンドの受け口が空。別の部屋の電球を運んで差すと、部屋じゅうの照明がつく。隠し: 暗がりの壁の扉（存在型 = 暗くて見えない / 出現型 = 明るくなると現れる）',
  },
  {
    idea: 'I08', name: '物を置くと増える', status: 'done', impl: [{ kind: 'gimmick', id: 'replicaRoom' }, { kind: 'part', id: 'replicaField' }],
    note: '手前の部屋（隣の区画）の小さな台に何か置いてから扉を開けると、この部屋の床一面に同じ物がずらりと並ぶ（並ぶのは部屋に誰もいない間に）。並んだ列の間に扉が現れる（出現型）。台の脇に置けそうな物（コップ・花瓶 …）があるが、ほかの仕掛けの物（バケツ・椅子）を置けばそれで埋まる',
  },
  {
    idea: 'I09', name: '置いた物が残る', status: 'done',
    impl: [{ kind: 'part', id: 'carryItem' }, { kind: 'part', id: 'carryBody' }, { kind: 'client', id: 'client/views/carry/persist.ts' }],
    note: '動かして置いた物の位置をフロアの id ごとに保存（localStorage。core/sim/parts/carry/persist.ts の carrySave / carryRestore）。次に同じフロアを作ったら、生成の後に部品の状態へ戻す（core は決定的なまま）。保存は {部品 id: [x, 底の y, z, yaw]} だけで小さい。フロアの id・生成器と調整表の版が違えば戻さない',
  },
  {
    idea: 'I10', name: '重さで開く', status: 'done', impl: [{ kind: 'gimmick', id: 'weightHatch' }],
    note: '壁際の床に蓋、離れた所に金属の板。板に乗っている間だけ蓋が左右へずれて開く（降りると閉まり、走っても間に合わない）。重い木箱（か軽い箱 2 つ）を板に載せると開いたままになり、穴の階段の下の壁に扉（存在型）。穴の中に人がいる間は閉まらない',
  },
  {
    idea: 'I11', name: '運ぶと変わる物', status: 'done', impl: [{ kind: 'gimmick', id: 'homeObject' }, { kind: 'part', id: 'carryItem' }],
    note: '台の上のコップ。持って歩くと carry.home.stageM m ごとに形が変わる（コップ → 花瓶 → 鳥の置物 → 鍵。変わるたびに鈴の音）。鍵になってから元の台に戻すと台の横の壁が開く（出現型）。元の部屋の物（homeObject）の変種 morph',
  },
  // ---- 4.7 裏の振る舞い: 物を運ぶ・置く ----
  { idea: 'BI01', name: '水を一滴もこぼさず満杯で運ぶ → 台が沈んで扉', status: 'done', impl: [{ kind: 'gimmick', id: 'carryWater' }], note: '満杯（一度もこぼさず）で注ぐと台が沈み、台の横に扉が現れる（出現型 carry.water.full）。こぼさずに運ぶにはしゃがみ歩き（スマホなら少しだけ倒した移動）でゆっくり。普通に歩くと少しこぼれるので現れない（試験で確かめる）' },
  { idea: 'BI02', name: '待つ扉で違う荷物を持って待つ → 別の扉', status: 'done', impl: [{ kind: 'gimmick', id: 'parcelGate' }], note: '違う色の荷物を持って枠で待つと、受け取り口ではなく別の壁の「返品口」が開く（出現型 carry.parcel.wrong。付けば）' },
  { idea: 'BI03', name: '本を 1 冊も集めない / 全部集める → それぞれ別の扉', status: 'done', impl: [{ kind: 'gimmick', id: 'bookCollect' }], note: '全部集めて返却台の前 → 台の横の扉（carry.books.all）/ 1 冊も拾わずに返却台まで行く → 別の壁の扉（carry.books.none）。本は返却台までの道に散らばり、拾わずに行ける細い道が必ず 1 本ある（生成で道を先に決め、本を道から離す）' },
  {
    idea: 'BI04', name: '椅子を全部どかす → 床下収納', status: 'done', impl: [{ kind: 'gimmick', id: 'chairRoom' }],
    note: '椅子を全部、部屋の外へ運び出すと、壁際の床の蓋（継ぎ目の線が目印）が沈んで開き、階段の下の壁に扉（存在型）。片付けて印に戻すだけでは開かない（試験で確かめる）',
  },
  {
    idea: 'BI05', name: '物を全部同じ向きにそろえる → 壁の一部がずれる', status: 'done', impl: [{ kind: 'gimmick', id: 'alignChairs' }],
    note: '待合室の椅子の向きがばらばら。置くと持っていた人と同じ向き（90° 刻み）に置かれる。部屋の椅子を全部同じ向きにそろえると、壁の一部がずれて扉が現れる（出現型）',
  },
  {
    idea: 'BI06', name: '拾った物を元の部屋に戻す → 戻した部屋に新しい扉', status: 'done', impl: [{ kind: 'gimmick', id: 'homeObject' }],
    note: '台の上のオルゴール。部屋の外へ持ち出してから戻して置くと、戻した部屋に新しい扉（出現型。持てる物の出力 returned）。持ち出さずに置き直しても何も起きない。元の部屋の物（homeObject）の変種 return',
  },
  // ---- 4.7 パズル（行き止まりの部屋。解くと隠し）----
  {
    idea: 'PZ01', name: '手がかりが別の部屋にある数字錠', status: 'done', impl: [{ kind: 'gimmick', id: 'dialLock' }, { kind: 'part', id: 'dial' }],
    note: '行き止まりの部屋の扉の横に 3 桁のダイヤル（調べると 1 進む。7 本の線の数字）。同じ色の枠の 3 桁の番号の札が、同じフロアの別の部屋（廊下・曲がり角・入口と出口の部屋を先に）の壁にある（clueCells / addToCell）。合わせると扉（出現型・必ず付ける）',
  },
  {
    idea: 'PZ02', name: '色の照明を混ぜて決まった色にする', status: 'done', impl: [{ kind: 'gimmick', id: 'colorMix' }, { kind: 'part', id: 'matchBits' }],
    note: '暗い部屋に赤・緑・青の灯りと 3 つのスイッチ（押すたびに入切）。灯りは本当に混ざる（3 つの点光源）。別の部屋の壁の「色の扉の絵」と同じ色（黄・紫・水色・白のどれか）にすると扉',
  },
  {
    idea: 'PZ03', name: '部屋中の時計の針を同じ時刻に合わせる', status: 'done', impl: [{ kind: 'gimmick', id: 'clockRoom' }, { kind: 'part', id: 'dial' }, { kind: 'part', id: 'sameValue' }],
    note: '部屋の壁の時計 4〜5 つがばらばらの時刻。調べると 1 時間進む。全部を同じ時刻に（別の部屋に止まった時計を置けたときは、その時刻に）すると扉',
  },
  {
    idea: 'PZ04', name: '床のタイルを入れ替えて絵を完成させる', status: 'done', impl: [{ kind: 'gimmick', id: 'tilePicture' }, { kind: 'part', id: 'carryReceiver' }],
    note: '床の 3×3 の升目のタイルの絵がばらばら（自分の升目にあるタイルは無い）。タイルを持って別のタイルを調べると入れ替わる（持てる物の入れ替え）。絵がつながると扉。完成した絵は別の部屋の額（canvas の絵。seed で決まる）',
  },
  {
    idea: 'PZ05', name: '影絵: 照明と物の位置を合わせ、扉の形の影を作る', status: 'done', impl: [{ kind: 'gimmick', id: 'shadowPuzzle' }, { kind: 'part', id: 'carryDecor' }],
    note: '壁際の低い強い灯りと、向かいの壁の扉の形の線。間に高さの同じ台が 3 つ。扉の形の切り抜きを正しい台に置くと、壁に落ちる影（灯りから 4 隅を写した四角。持って動かすと影も動く）が線にぴったり重なり、影が扉になる',
  },
  {
    idea: 'PZ06', name: '鏡を並べて光を部屋の奥へ通す', status: 'done', impl: [{ kind: 'gimmick', id: 'mirrorBeam' }, { kind: 'part', id: 'beamGrid' }],
    note: '壁の穴から床の升目に沿って光の筋。柱で止まっている。鏡（持てる物）は置いた人の向き（45° 刻み）に置かれ、斜めに置くと光が曲がる。光を壁の目に届けると、目の横に扉。解き方は生成のときに決めて、鏡の升目のまわりに柱を置かない（斜めに立って置ける）',
  },
  {
    idea: 'PZ07', name: '音の高さの順にベルを鳴らす', status: 'done', impl: [{ kind: 'gimmick', id: 'bellOrder' }, { kind: 'part', id: 'bell' }],
    note: '大きさの違う鐘 4〜5 つ（調べると鳴る。WebAudio の合成の鐘の音）。音の低い順（大きい順）に鳴らすと扉。間違えると最初から（逆の順では開かない: 試験で確かめる）',
  },
  {
    idea: 'PZ08', name: '家具の配置を壁の写真と同じにする', status: 'done', impl: [{ kind: 'gimmick', id: 'furnitureMatch' }],
    note: '椅子・丸椅子・鉢植え・電気スタンドのうち 3 つ。壁の写真（上から見た部屋の図。写真の壁が上・入口と扉の印・家具の形の印）と同じ所に置くと扉',
  },
  {
    idea: 'PZ09', name: '重さの違う箱を天秤の両側で釣り合わせる', status: 'done', impl: [{ kind: 'gimmick', id: 'balanceScale' }],
    note: '天秤の両側の皿と、点の数が重さの箱 4 つ（重さ 1〜4。大きさは重さと関係ない）。竿が重さの差で傾く。両側を同じ重さ（片側 4 以上: carry.balance.min）にすると扉。1 と 2 では開かない',
  },
  {
    idea: 'PZ10', name: '迷路の模型で球を転がし、本物の迷路の隠し出口を知る', status: 'done', impl: [{ kind: 'gimmick', id: 'mazeModel' }, { kind: 'part', id: 'marbleModel' }],
    note: '部屋の奥は天井までの迷路、手前の机に同じ迷路の模型と玉。机の辺に立つと模型がそちらへ傾き、玉は壁まで転がる（氷の迷路）。模型の行き止まりの 1 つに穴。玉が落ちると、本物の迷路の同じ行き止まりに扉が現れる。玉が転がって届く穴だけ選ぶ（slideSolve）',
  },
  {
    idea: 'PZ11', name: '消えた照明を、電球を運んで元の順に戻す', status: 'done', impl: [{ kind: 'gimmick', id: 'bulbOrder' }],
    note: '壁の吊り灯り 3〜4 つの受け口が空。色の電球が同じフロアの別の部屋に散らばる。別の部屋の古い写真（灯りの色の並び）の順に差すと扉。差すと受け口がその色に灯る',
  },
  {
    idea: 'PZ12', name: '足跡の模様どおりに床を踏む', status: 'done', impl: [{ kind: 'gimmick', id: 'footPattern' }, { kind: 'part', id: 'stepPattern' }],
    note: '床の 4×4 の升目。別の部屋の足跡の図（入口の側が下）の順に踏むと扉。踏めた升目が灯り、違う升目を踏むと赤く光って最初から（逆から踏んでも開かない）',
  },
  // ---- 2.15 自由に遊べるミニゲーム（脇の部屋。いつでも出られる・失敗は区間の最初へ・報酬なし・普通と違う遊び方で隠し）----
  { idea: 'U01', name: '球を穴に入れる（床を傾ける）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U02', name: 'ボウリングの廊下', status: 'deferred', impl: [], note: WIP },
  { idea: 'U03', name: 'ゴルフの部屋（1 打で入れる）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U04', name: '鬼ごっこする灯り', status: 'deferred', impl: [], note: WIP },
  { idea: 'U05', name: 'かくれんぼ（灯りが探しに来る）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U06', name: 'ピンボールの吹き抜け（自分が球）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U07', name: 'カートの坂', status: 'deferred', impl: [], note: WIP },
  { idea: 'U08', name: '的当て（物を投げる）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U09', name: '記憶の部屋（10 秒見たあと照明が消え、同じ所に物を戻す）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U10', name: '影絵（光と物を合わせて形を作る）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U11', name: '音合わせ（ピアノの床）', status: 'deferred', impl: [], note: WIP },
  { idea: 'U12', name: '無重力の部屋で浮かぶ輪をくぐる', status: 'deferred', impl: [], note: WIP },
];
