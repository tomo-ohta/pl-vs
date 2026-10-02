/**
 * 案の台帳・部屋の形（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 *
 * 部屋の形は core/gen/rooms（defineRoomShape。impl の kind は 'room'、id は形の id）。フロアの生成が仕掛けと異変を決めた後・
 * 区画の中身を置く前に、普通の部屋（と重ねてよい異変の部屋）に掛ける。見本: ?try=<形の id か案の番号>（例 ?try=S08,pillars）
 */
import type { CatalogEntry } from './types.ts';

const room = (id: string): CatalogEntry['impl'] => [{ kind: 'room', id }];

export const ROOMS_CATALOG: CatalogEntry[] = [
  { idea: 'S01', name: '柱林', status: 'done', impl: room('pillars'), note: '部屋いっぱいの柱の格子（柱の間は体より広い）。柱の陰で先が見えず縫って進む。照明は柱の間の升目ごと。家具は壁際だけ。暗闇・霧・色・家具の異変と重なる' },
  { idea: 'S02', name: '大広間', status: 'done', impl: room('grandHall'), note: '広間だけ。天井 1.8 倍・壁から 1.5 m の列柱（扉の前は空ける）・絨毯の道・シャンデリア・腰板。広い床は空け、道の脇に長椅子' },
  { idea: 'S03', name: '縦長ホール', status: 'done', impl: room('tallHall'), note: '幅の 2 倍以上（9〜15 m）の高さ。長い壁に縦の光の筋、高い所の窓（奥に別の部屋）、届かない高さの扉、長さの違う吊り照明' },
  { idea: 'S04', name: '穴の回廊', status: 'done', impl: room('pitGallery'), note: '部屋のほとんどが深さ 3 m の吹き抜け。手すりの回廊が囲み、下は家具の置かれた別の部屋（壁沿いの段で下りられる。段の上の横だけ手すりが開く）' },
  { idea: 'S05', name: '天井井戸', status: 'done', impl: room('ceilingWells'), note: '天井に縦穴（4〜9 m）がいくつも開き、上の灯りが床に光の溜まりを落とす（部屋の照明はそれだけ）。井戸の下に椅子が 1 脚' },
  { idea: 'S06', name: '分割ホール', status: 'done', impl: room('splitHall'), note: '奥行きの向きに仕切り壁で 2〜4 室。仕切りの通り口は左右互い違いで先が見えず、室ごとに壁の色が違う（いくつ部屋が続くのか）' },
  { idea: 'S07', name: 'L 字・コの字・ロの字', status: 'done', impl: room('bentRoom'), note: '足跡の角を欠く（L。入口から出口が見えない角を選ぶ）・壁の真ん中を欠く（コ）・真ん中に天井までの塊（ロ。塊の面に開かない扉）。足跡ごと作り直すので家具は新しい壁にも付く' },
  { idea: 'S08', name: '段々の部屋', status: 'done', impl: room('terraces'), note: '講堂のすり鉢: 開口の側から舞台へ 0.33 m ずつ段が下がり、段ごとに座席の列（両端が通路）。底に低い舞台・幕・演台。上の縁に手すり。段で上り下りできる' },
  { idea: 'S09', name: '半円の劇場', status: 'done', impl: room('theater'), note: '舞台（0.7 m）・幕・足元の灯り・舞台を囲む半円の座席（舞台を向く）。舞台の奥の扉の向こうに楽屋（鏡と電球・衣装掛け。区画を足す。空きが無ければ開かない扉）' },
  { idea: 'S10', name: '低すぎる天井', status: 'done', impl: room('lowCeiling'), note: '天井 1.6 m（体は 1.7 m）。扉の前だけ普通の高さで、中はしゃがんで進む（スマホはしゃがむボタン）。家具も低い物だけ' },
  { idea: 'S11', name: '高すぎる天井', status: 'done', impl: room('highCeiling'), note: '天井 30 m（空きが無ければ低く）。照明は天井の蛍光灯 1 本だけで床は薄暗い。家具は普通の部屋のまま' },
  { idea: 'S12', name: 'うなぎの寝床', status: 'done', impl: room('eelBed'), note: '長い区画（広間）だけ。幅 1.2 m の帯の足跡に作り直し、ほかの開口へは細い枝。一定の間隔の鴨居・続く絨毯・額、奥に椅子が 1 脚こちらを向く' },
  { idea: 'S13', name: '二重壁', status: 'done', impl: room('doubleWall'), note: '開口の無い壁の内側にもう 1 枚の壁。割れ目（立って / しゃがんで）から幅 0.85 m の暗い隙間に入れ、奥に誰かの痕跡（椅子・正の字・紙・ラジオ）。普通でない振る舞いのご褒美' },
  { idea: 'S14', name: '全面グレーチングの床', status: 'done', impl: room('grating'), note: '床が全部、鉄の格子（見えない当たりの板 + 格子の棒）。2.4 m 下の設備（配管・ポンプ・タンク・水たまり・橙の灯り）が透けて見える。家具は格子の上に普通に置く' },
  { idea: 'S15', name: '中央の穴', status: 'done', impl: room('centerHole'), note: '部屋の真ん中が深さ 2.2 m の穴（手すり無し・縁に注意の線）。縁（1.25 m 以上）を回る。落ちたら壁沿いの段で縁へ戻る。底の隅に落とし物' },
  { idea: 'S16', name: '半地下', status: 'done', impl: room('halfBasement'), note: '天井際の細長い窓の外が地面の高さ（外の景色の板は窓の下端が地面）。格子とコンクリートの抱き・昼の光・天井の配管・湿った壁' },
  { idea: 'S17', name: '斜めの壁', status: 'done', impl: room('slantWalls'), note: '開口の無い壁（向かい合う 2 枚のことも）が床から天井へ傾く。屋根裏（内へ。頭が当たる。屋根の窓）か、すり鉢（外へ。床が狭い）。傾けた板（描画）+ 段の当たり判定' },
  { idea: 'S18', name: '円形の部屋', status: 'done', impl: room('roundRoom'), note: '開口が区画の中心線の上にあるときだけ。丸い壁（細かい段の箱）に等間隔の通り口が 8 つ: 入口・出口のほかは開かない扉（調べると鍵）。どれが本物か。真ん中に台' },
  { idea: 'S19', name: '天井から下がる階段', status: 'done', impl: room('atticStair'), note: '棟の下の天井の口から、宙に浮いた急な踏み板の階段。上は屋根裏（切妻の屋根・古い箱・裸電球・小さな窓。棟の下以外はしゃがむ）' },
  { idea: 'S20', name: 'ロフト付き', status: 'done', impl: room('loft'), note: '壁際の 1.5〜1.9 m の台の上に寝床（布団・枕・小さな灯り・本）。急な段で上がり、天井が近いのでしゃがんで入る。台の下は家具が置ける' },
  { idea: 'S21', name: '部屋の中の小屋', status: 'done', impl: room('hut'), note: '部屋の真ん中に別の場所の建物: 電話ボックス（中に電話と灯り）・プレハブ（扉の穴と窓、中に机と電気スタンド）・誰もいない屋台（提灯・丸椅子）。周りは回れる' },
  { idea: 'S22', name: '足場の部屋', status: 'done', impl: room('scaffold'), note: '壁沿いの鉄骨の足場（高さ 2.15 m の通路。天井が低ければ上げる）。両端に段があり、上って回って下りられる。筋交い・作業灯。足場の下は立って通れる' },
  { idea: 'S23', name: '窓だらけ', status: 'done', impl: room('windows'), note: '壁一面の窓（天井が高ければ 2 段）。どの窓の奥にも別の部屋が見える（窓の奥の部屋の描画）。開口の無い壁は床から天井までのガラスのことも。窓に重なる家具は置かない' },
  { idea: 'S24', name: '扉だらけ', status: 'existing', impl: [{ kind: 'anomaly', id: 'doors' }], note: '段階 3 の異変 doors（壁が開かない扉で埋まる。天井と床にも扉。隠しの扉のある部屋では本物が 1 つ混じる）で足りる' },
  { idea: 'S25', name: '傾いた部屋', status: 'done', impl: room('tilted'), note: '開口が 1 本の線の上にあるとき、その線を軸に部屋ごと 6° 傾く。床（部品 roomSurface の斜めの面）と天井は平行、家具も剪断して傾き、軽い物は低い壁際に寄っている' },
  { idea: 'S26', name: '果てしない通路', status: 'done', impl: room('endless'), note: '幅 2 m ほどの長い通路の足跡に作り直し、霧で先が見えない（通路の長さの 6 割で何も見えない）。同じ額・同じ灯りがくり返す。表のフロアだけ（裏は霧が上書きされる）' },
  { idea: 'S27', name: '一つの部屋が何層も', status: 'done', impl: room('layers'), note: '天井を上げて同じ部屋を 2〜3 層に重ねる。どの層にも 0 層と同じ家具・同じ所に扉（上の層の扉は開かない）。向かい合う壁沿いの段で上の層へ' },
  { idea: 'S28', name: '水没した下半分', status: 'done', impl: room('sunkenWater'), note: '床が 1.4 m 下がって水に沈み、家具は水の中（背の高い物は水から出る）。扉の前の台と、台をつなぐ板の道を歩く。落ちたら遅い水の中を歩いて段で台へ。水面に紙' },
  { idea: 'S29', name: '階段だけの部屋', status: 'done', impl: room('stairsOnly'), note: '壁際に折り返して上る階段の塔（宙に浮く段と踊り場）。上りきると開かない扉。どこへも行かない階段・天井に逆さの階段・壁を横に走る階段（描画だけ）。家具は無し' },
  { idea: 'S30', name: '天井の高さが場所で変わる', status: 'done', impl: room('waveCeiling'), note: '奥行きの向きに天井が波打つ（低い所 1.9 m・高い所は元より 2〜3 m 上）。傾けた天井の板（描画）+ 当たり判定の箱。開口の前は扉より高い' },
];
