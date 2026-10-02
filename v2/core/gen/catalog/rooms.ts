/**
 * 案の台帳・部屋の形（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 *
 * 部屋の形は core/gen/rooms（defineRoomShape。impl の kind は 'room'、id は形の id）。フロアの生成が仕掛けと異変を決めた後・
 * 区画の中身を置く前に、普通の部屋（と重ねてよい異変の部屋）に掛ける。見本: ?try=<形の id か案の番号>（例 ?try=S08,pillars）
 */
import type { CatalogEntry } from './types.ts';

const room = (id: string): CatalogEntry['impl'] => [{ kind: 'room', id }];
/** 作成中（作り終えたら done にする） */
const wip = (idea: string, name: string, id: string): CatalogEntry => ({ idea, name, status: 'deferred', impl: room(id), note: '作成中（段階 4 の rooms で作る）' });

export const ROOMS_CATALOG: CatalogEntry[] = [
  { idea: 'S01', name: '柱林', status: 'done', impl: room('pillars'), note: '部屋いっぱいの柱の格子（柱の間は体より広い）。柱の陰で先が見えず縫って進む。照明は柱の間の升目ごと。家具は壁際だけ。暗闇・霧・色・家具の異変と重なる' },
  { idea: 'S02', name: '大広間', status: 'done', impl: room('grandHall'), note: '広間だけ。天井 1.8 倍・壁から 1.5 m の列柱（扉の前は空ける）・絨毯の道・シャンデリア・腰板。広い床は空け、道の脇に長椅子' },
  { idea: 'S03', name: '縦長ホール', status: 'done', impl: room('tallHall'), note: '幅の 2 倍以上（9〜15 m）の高さ。長い壁に縦の光の筋、高い所の窓（奥に別の部屋）、届かない高さの扉、長さの違う吊り照明' },
  wip('S04', '穴の回廊', 'pitGallery'),
  { idea: 'S05', name: '天井井戸', status: 'done', impl: room('ceilingWells'), note: '天井に縦穴（4〜9 m）がいくつも開き、上の灯りが床に光の溜まりを落とす（部屋の照明はそれだけ）。井戸の下に椅子が 1 脚' },
  { idea: 'S06', name: '分割ホール', status: 'done', impl: room('splitHall'), note: '奥行きの向きに仕切り壁で 2〜4 室。仕切りの通り口は左右互い違いで先が見えず、室ごとに壁の色が違う（いくつ部屋が続くのか）' },
  { idea: 'S07', name: 'L 字・コの字・ロの字', status: 'done', impl: room('bentRoom'), note: '足跡の角を欠く（L。入口から出口が見えない角を選ぶ）・壁の真ん中を欠く（コ）・真ん中に天井までの塊（ロ。塊の面に開かない扉）。足跡ごと作り直すので家具は新しい壁にも付く' },
  wip('S08', '段々の部屋', 'terraces'),
  wip('S09', '半円の劇場', 'theater'),
  { idea: 'S10', name: '低すぎる天井', status: 'done', impl: room('lowCeiling'), note: '天井 1.6 m（体は 1.7 m）。扉の前だけ普通の高さで、中はしゃがんで進む（スマホはしゃがむボタン）。家具も低い物だけ' },
  { idea: 'S11', name: '高すぎる天井', status: 'done', impl: room('highCeiling'), note: '天井 30 m（空きが無ければ低く）。照明は天井の蛍光灯 1 本だけで床は薄暗い。家具は普通の部屋のまま' },
  wip('S12', 'うなぎの寝床', 'eelBed'),
  { idea: 'S13', name: '二重壁', status: 'done', impl: room('doubleWall'), note: '開口の無い壁の内側にもう 1 枚の壁。割れ目（立って / しゃがんで）から幅 0.85 m の暗い隙間に入れ、奥に誰かの痕跡（椅子・正の字・紙・ラジオ）。普通でない振る舞いのご褒美' },
  wip('S14', '全面グレーチングの床', 'grating'),
  wip('S15', '中央の穴', 'centerHole'),
  { idea: 'S16', name: '半地下', status: 'done', impl: room('halfBasement'), note: '天井際の細長い窓の外が地面の高さ（外の景色の板は窓の下端が地面）。格子とコンクリートの抱き・昼の光・天井の配管・湿った壁' },
  { idea: 'S17', name: '斜めの壁', status: 'done', impl: room('slantWalls'), note: '開口の無い壁（向かい合う 2 枚のことも）が床から天井へ傾く。屋根裏（内へ。頭が当たる。屋根の窓）か、すり鉢（外へ。床が狭い）。傾けた板（描画）+ 段の当たり判定' },
  wip('S18', '円形の部屋', 'roundRoom'),
  wip('S19', '天井から下がる階段', 'atticStair'),
  wip('S20', 'ロフト付き', 'loft'),
  wip('S21', '部屋の中の小屋', 'hut'),
  wip('S22', '足場の部屋', 'scaffold'),
  { idea: 'S23', name: '窓だらけ', status: 'done', impl: room('windows'), note: '壁一面の窓（天井が高ければ 2 段）。どの窓の奥にも別の部屋が見える（窓の奥の部屋の描画）。開口の無い壁は床から天井までのガラスのことも。窓に重なる家具は置かない' },
  { idea: 'S24', name: '扉だらけ', status: 'existing', impl: [{ kind: 'anomaly', id: 'doors' }], note: '段階 3 の異変 doors（壁が開かない扉で埋まる。天井と床にも扉。隠しの扉のある部屋では本物が 1 つ混じる）で足りる' },
  wip('S25', '傾いた部屋', 'tilted'),
  wip('S26', '果てしない通路', 'endless'),
  wip('S27', '一つの部屋が何層も', 'layers'),
  wip('S28', '水没した下半分', 'sunkenWater'),
  wip('S29', '階段だけの部屋', 'stairsOnly'),
  { idea: 'S30', name: '天井の高さが場所で変わる', status: 'done', impl: room('waveCeiling'), note: '奥行きの向きに天井が波打つ（低い所 1.9 m・高い所は元より 2〜3 m 上）。傾けた天井の板（描画）+ 当たり判定の箱。開口の前は扉より高い' },
];
