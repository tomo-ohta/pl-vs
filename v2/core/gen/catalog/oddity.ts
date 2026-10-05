/**
 * 案の台帳・部屋まるごとの異変の拡充（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 *
 * 異変は core/gen/anomaly/defs/oddity/*.ts、仕掛けは core/gen/gimmicks/oddity/*.ts、部品は core/sim/parts/oddity/room.ts、
 * 描画（粒・煙・画面の色・文字の札）は client/views/oddity/*.ts と client/render/RoomGrade.ts（PostFX の部屋の画面効果）。
 */
import type { CatalogEntry } from './types.ts';

const A = (id: string): { kind: 'anomaly'; id: string } => ({ kind: 'anomaly', id });
const P = (id: string): { kind: 'part'; id: string } => ({ kind: 'part', id });
const V = (id: string): { kind: 'view'; id: string } => ({ kind: 'view', id });

export const ODDITY_CATALOG: CatalogEntry[] = [
  // ---- 2.12 水と環境 ----
  { idea: 'E01', name: '浅い水', status: 'existing', impl: [A('flood')], note: '浸水（膝の深さの水・水の足音・遅い）で足りる。足音の変わる水たまりは雨漏り（leak）にもある' },
  {
    idea: 'E02', name: '炎と煙', status: 'done', impl: [A('smoke'), V('oddRoom')],
    note: '部屋の上半分（床上 1.15〜1.3 m から天井）が煙の層。立つと目が煙の中で前が見えない（霧と画面のかすみ）、しゃがむと煙の下が見える。床近くの緑の誘導灯が先の開口へ続く。奥にくすぶるごみ箱。体力は減らさない（危険は後回しの体力の規則で）',
  },
  { idea: 'E03', name: '雨漏り', status: 'done', impl: [A('leak'), V('oddRoom')], note: '部屋じゅうに天井から雨（雨の筋と床の波紋）。天井の雨染みの下に水たまり（机の上にも）とバケツ。水たまりは水の足音で少し遅い。床が濡れて照明が映る・雨音' },
  { idea: 'E04', name: '雪の室内', status: 'done', impl: [A('snow'), P('oddTrail'), V('oddTrail')], note: '床一面と家具の天板に雪・壁際の吹きだまり・つらら・降り続ける雪・青白い光。歩くと雪に足跡が残る（部品 oddTrail が記録。足音も雪）' },
  { idea: 'E05', name: '草原・ひまわり畑', status: 'done', impl: [A('meadow')], note: '床は草、天井は青空。ひまわり（全部が入口を向く）・麦・野の花の 3 通り。家具は草に埋もれて立つ（草原になった教室）。草木は通り抜けられる。鳥の声' },
  { idea: 'E06', name: '霧', status: 'existing', impl: [A('fog')], note: '霧（部屋の中だけ 3〜4 m 先が見えない）で足りる' },
  {
    idea: 'E07', name: '温度', status: 'done', impl: [A('thermal'), V('oddRoom')],
    note: '冷たい白い霧で先の開口が見えない部屋。入口の側は床が凍り、つららと青白い光。先の開口の側は暖房の橙の灯り。画面の縁が凍る（寒い）・赤みが差す（暖かい）ので、暖かい方へ進めば先の開口に着く。寒い所では白い息',
  },
  { idea: 'E08', name: '風の向き', status: 'done', impl: [A('wind')], note: '入口から先の開口へ風が吹き抜ける。紙・葉が先の開口へ流れ、天井の吹き流しが同じ向きになびき、風下の壁際に紙が吹き寄せられている。体が少し押される（弱い外力）。開口の多い広間では風下が先へ進む開口' },
  { idea: 'E09', name: '水の壁', status: 'done', impl: [A('waterWall')], note: '壁一面を水が流れ落ちる（壁が水面）。開口の内側に水の幕が下り、くぐると画面が揺らいで青くかすむ。壁際の床に水が溜まる' },
  { idea: 'E10', name: '室内の海', status: 'done', impl: [A('sea'), P('oddWaves'), V('oddWaves')], note: '入口の側は砂浜、奥は膝より深い海。奥の壁と天井は空と水平線。波が寄せては返し、寄せる間は浜へ押し戻される（部品 oddWaves）。奥の家具は海に立つ。先の開口が海の側なら水をかき分けて進む' },
  { idea: 'E11', name: '砂の部屋', status: 'done', impl: [A('sand'), P('oddTrail')], note: '天井の割れ目から砂が流れ落ちて床に砂の山（低い段で登れる）。床一面の砂の風紋がゆっくり流れて形を変える（描画）。家具の脚が砂に埋もれ、歩くと遅く、足跡が残る。舞う砂埃' },
  { idea: 'E12', name: '植物に覆われる', status: 'done', impl: [A('overgrowth')], note: '入口のあたりは普通の部屋。奥へ進むほど苔・茂み・壁の蔦・天井から垂れる蔓が増え、先の開口の周りは緑に埋もれる。家具の上にも葉・奥の照明は緑がかる。植物は通り抜けられる' },
  // ---- 2.13 認知の異変 ----
  {
    idea: 'X02', name: '一つだけ違う', status: 'done', impl: [{ kind: 'gimmick', id: 'oneDifferent' }, P('oddTouch')],
    note: '隠しを差し出すので仕掛けにした（BX05 とまとめた）。開口の無い壁沿いに、天井までの仕切りで同じ小部屋（ブース）が 3〜5 つ並ぶ。1 つだけ、1 つの家具が違う（椅子の色・椅子の向き・灯り・額の絵・机の上の赤い玉）',
  },
  { idea: 'X03', name: '数が合わない', status: 'done', impl: [A('miscount'), V('oddRoom')], note: '部屋でいちばん多い家具（椅子・机 …）の 1 つずつに大きな番号札。どこかで同じ番号が 2 回出て、数が 1 つ多い。壁の掲示は「この部屋の◯◯ N」（実際は N + 1）。家具の少ない部屋は壁一面の番号付きロッカー（同じ番号が 2 つ）' },
  { idea: 'X04', name: '案内の嘘', status: 'done', impl: [A('fakeSigns'), V('oddRoom')], note: '床の矢印と壁の「出口 →」が、開口の無い壁の偽の扉（非常口の灯り付き・開かない）を指す。本当の先の開口の上には「関係者以外立入禁止」。閉じ込めない（本物の開口は普通に通れる）' },
  { idea: 'X05', name: '自分の名前', status: 'done', impl: [A('nameplate'), V('oddRoom')], note: '向かいの壁に大きく「{name} さん　おかえりなさい」、家具の 1 つずつに名札、先の開口の上に「{name} 様　お呼び出しです」。名前は ?name= か設定の「名前」（どちらも無ければ既定の呼び名「あなた」）' },
  { idea: 'X06', name: '前の部屋の物', status: 'done', impl: [A('carryover')], note: 'さっき通った部屋（本道なら本道の前の部屋。AnomalyContext.prev）の大きな家具が、同じ並びでこの部屋にもある。床・壁・照明の色・環境音も前の部屋と同じ。「戻った？」と思わせて扉の位置が違う。裏のフロアでは前の部屋だけ調子が変わるので表のフロアだけ（frontOnly）' },
  { idea: 'X07', name: '色が抜ける', status: 'done', impl: [A('missingColor'), V('oddRoom')], note: '赤・緑・青のどれか 1 色だけが部屋から消えている（赤いはずの消火器・緑の鉢植え・青いごみ箱が灰色）。中に入ると、目に映る物からもその色だけが抜ける（画面の色 hueKill）' },
  { idea: 'X08', name: '単色の部屋', status: 'done', impl: [A('mono'), A('tint'), V('oddRoom')], note: '黒一色（艶のある黒。照明の映り込みで形だけが見える）か、1 色だけの部屋（全部が 1 つの色の無地。画面もその色だけ）を足した。白一色は既存の色の異変（tint）' },
  { idea: 'X09', name: '壁と床が欠ける', status: 'done', impl: [A('void')], note: '開口の無い壁沿いの床が帯状に崩れ落ち、その上の壁と天井も消えて黒い虚空が覗く。床の真ん中にも穴。落ちると虚空の底で入口へ戻される（失敗の代償は位置と時間）。開口どうしを結ぶ床は必ず残す' },
  { idea: 'X10', name: '家具が一か所に集まる', status: 'done', impl: [A('huddle')], note: '積み上げ（stack: 真ん中に塔）とは別に作った。家具が全部、入口からいちばん遠い隅にぎっしり寄せられ、部屋の残りはがらんと空き、床には隅へ向かう引きずった跡' },
  { idea: 'X11', name: '回転と大きさ', status: 'done', impl: [A('oddScale'), V('oddRoom')], note: '普通の部屋の中で、1 つだけ巨大（2.2〜2.8 倍）、1 つは頭の上の宙でゆっくり回っている（描画）。ほかにも逆さま・横倒しの物が混じる' },
  { idea: 'X12', name: '別の部屋の家具', status: 'done', impl: [A('misplaced')], note: '部屋の一角が、まるごとよその部屋になっている（プールに書庫の本棚、事務所に劇場の座席 …）。その一角だけ床もよその部屋の床。よその部屋の中身はそのテーマの作り方（区画の中身）でそのまま置く' },
  { idea: 'X13', name: '正しい出口の印', status: 'done', impl: [A('exitSign'), V('oddRoom')], note: '壁に開かない扉が並び、どの扉の上にも非常口の印。人が走る向きは全部同じなのに、本当の先の開口の印だけ逆を向いている' },
  // ---- 2.5 空間のゆがみ（見た目） ----
  { idea: 'W04', name: '中が広い部屋', status: 'done', impl: [A('vast')], note: '扉は普通なのに、中の天井が 9〜14 m（部屋の上の空きを確かめて決める）。照明は遥か上、太い柱が並び、よく響く。W09・W18 も同じ異変の変種' },
  { idea: 'W09', name: '扉の大きさと中の大きさ', status: 'merged', impl: [A('vast')], note: '中が広い部屋の変種: 入口のすぐ内側が狭く低い通り口（幅 1.7 m・高さ 1.95 m。立ったまま通れる）で、抜けた途端に巨大な空間が開ける（anomaly.vast.narrow の割合）' },
  { idea: 'W10', name: '天地が逆の部屋', status: 'existing', impl: [A('upsideDown')], note: '逆さま（家具が天井・照明は床・重力はそのまま）で足りる' },
  { idea: 'W15', name: '遠近法の錯覚', status: 'done', impl: [A('perspective'), V('oddRoom')], note: '奥へ家具の列・天井の照明・絨毯・腰壁が少しずつ小さく低くなり、天井も下がる。入口から見ると何倍も奥深い。奥の壁の小さな扉は、遠くからは小さく、近づくと普通の大きさになる（描画 grow）。奥の家具は人形の大きさ' },
  { idea: 'W16', name: '鏡の部屋', status: 'done', impl: [A('mirror'), V('oddRoom')], note: '部屋の真ん中に大きな鏡の枠。向こうは、こちらの半分の鏡写し（家具・飾り・開かない扉）。でも自分が映らず、影のような人影がこちらと鏡写しに動く。枠をくぐると鏡の中の部屋に入れ、人影はこちら側に現れる' },
  { idea: 'W17', name: '縦横が入れ替わる部屋', status: 'done', impl: [A('sideways')], note: '横倒しの部屋: 開口の無い壁の 1 枚が床（床材）で、家具がそこから横向きに生える。向かいの壁が天井（照明が縦に光る）。床と天井は壁紙、壁の飾りは床に寝ている。重力はそのまま' },
  { idea: 'W18', name: '地図と合わない部屋', status: 'merged', impl: [A('vast')], note: '中が広い部屋に、地図に出す見かけの足跡 CellLayout.map.apparent（主の矩形を 0.55 倍に縮めた小部屋。地図の担当の CellMapInfo）を付けた。地図はその形で描く' },
  // ---- 2.9 時間 ----
  { idea: 'T02', name: '時刻が進む部屋', status: 'done', impl: [A('dayCycle'), P('oddClock'), P('oddLevel'), V('oddClock')], note: '大きな窓のある部屋。中にいる間だけ時刻が進み、1 分半で朝 → 昼 → 夕焼け → 夜。窓の空の色・差し込む日の筋・部屋の明るさ（日の光の照明）が移り、日が暮れると天井の照明が点く。壁の時計の針が速く回る。出ると止まり、入ると続き' },
  { idea: 'T08', name: '古くなる廊下', status: 'done', impl: [A('aging'), V('oddRoom')], note: '異変は部屋・広間に掛けるので「古くなる部屋」にした。入口は新しく、奥ほど年代が古い（壁紙の黄ばみ → 染み → 剥がれた漆喰と煉瓦、照明は黄ばんで暗く、奥は切れている、家具は倒れて埃・蜘蛛の巣）。舞う埃・画面も奥ほど褪せる' },
  { idea: 'T09', name: '去った人の残り', status: 'done', impl: [A('justLeft'), V('oddRoom')], note: '誰もいないのに、湯気の立つコーヒー・食べかけの皿・点いたままの画面・まだ回っている椅子・回る卓上扇風機。部屋にいる間、どこかで電話が鳴り続ける（部品 soundBeacon を部屋の部品 oddRoom の in につなぐ）' },
  // ---- 4.7 裏の振る舞い（空間と認知）----
  {
    idea: 'BX05', name: '同じ部屋が並ぶ所で、1 つだけ違う部屋の違う家具に触れる', status: 'merged', impl: [{ kind: 'gimmick', id: 'oneDifferent' }, P('oddTouch')],
    note: '一つだけ違う（X02）の隠し: 違う家具に触れる（調べる）と、そのブースの奥の壁に扉が現れる（出現型）。存在型では違うブースの奥に初めから壁と同じ色の扉',
  },
];
