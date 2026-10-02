/**
 * 案の台帳・光・音・視線・時間（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 */
import type { CatalogEntry } from './types.ts';

const g = (id: string): { kind: 'gimmick'; id: string } => ({ kind: 'gimmick', id });
const a = (id: string): { kind: 'anomaly'; id: string } => ({ kind: 'anomaly', id });
const p = (id: string): { kind: 'part'; id: string } => ({ kind: 'part', id });
/** 作っている途中（段階 4 の作業中だけ。終わりには無くす） */
const wip = (idea: string, name: string): CatalogEntry => ({ idea, name, status: 'deferred', impl: [], note: '作成中（段階 4 の作業中）' });

export const SENSE_CATALOG: CatalogEntry[] = [
  // ---------------------------------------------------------------- 2.6 光と闇
  { idea: 'L01', name: '人感センサー', status: 'existing', impl: [g('sensorLights')], note: '廊下の照明が歩いた所だけつく（段階 3）。裏の振る舞いは BL01（sneakLights）' },
  { idea: 'L02', name: '消える照明', status: 'done', impl: [g('blinkoutHall'), p('darkHazard'), p('pattern')], note: '部屋の照明が周期で消える（消える前に瞬く）。暗闇に 1.3 秒いると闇に捕まって入口へ。道に沿った消えない灯りの島で待ち、点いている間に次の島へ。懐中電灯の光は数えない（闇は小さな光を恐れない）' },
  { idea: 'L03', name: '動く照明の範囲', status: 'done', impl: [g('spotRide'), p('lightFloor')], note: '真っ暗な穴の部屋。天井の光の円が入口と出口の間を往復し（両端で止まる・L 字もある）、円の中だけ床がある。円を待って一緒に歩く。外れると穴の底（階段で入口へ）' },
  { idea: 'L04', name: 'サーチライト', status: 'done', impl: [g('searchlight'), p('searchlight')], note: '入口から出口への道を横切る帯（黄色い線）が 1〜3 本。帯ごとに天井の光の円が往復する（速さが違う）。円に入ると警報が鳴り、その帯の手前へ戻される（少し戻される）。円が遠ざかった隙に渡る' },
  { idea: 'L05', name: '鏡で光を導く', status: 'done', impl: [g('mirrorBeam'), p('mirror'), p('beam')], note: '壁の光源から腰の高さの光の筋。部屋の鏡（2〜3 枚。調べると ／ と ＼ が入れ替わる）で筋を曲げ、出口の扉の脇の受光器に当てると扉の鍵が開く（開いたまま）。筋は家具でも止まる（解の筋の上には家具を置かない）。鍵は部屋の中の人にだけ掛かる' },
  { idea: 'L06', name: '非常電源', status: 'done', impl: [g('emergencyPower'), p('lever')], note: '停電した暗い部屋。入口の脇の非常電源のレバーを引くと赤い非常灯が点き、出口の扉の鍵が開く。電源は 7〜14 秒（レバーから出口までを歩く時間の 1.25 倍 + 2 秒）しか持たず、レバーが少しずつ戻る。残り 4 秒から警告音。走れば余裕・歩くと際どい' },
  { idea: 'L07', name: '霧の誘導灯', status: 'done', impl: [g('fogBeacons'), p('senseFx')], note: '濃い霧（3 m 先が見えない）の深い穴の部屋。入口と出口の床の間を細い道が折れながら渡る。道の脇の誘導灯が出口の向きへ順に流れるように点滅し、霧の先の灯りがぼんやり見える。道を外れると穴の底（階段で入口へ）' },
  { idea: 'L08', name: '灯りを追う', status: 'existing', impl: [g('guideLight')], note: '導く光の迷路（段階 3）' },
  { idea: 'L09', name: '懐中電灯だけ', status: 'existing', impl: [a('dark')], note: '暗闇の異変（段階 3）。懐中電灯（R）が要る' },
  { idea: 'L10', name: '明滅の位相', status: 'done', impl: [g('lightWave'), p('darkHazard'), p('pattern')], note: '細長い区画の照明が、入口の側から出口の側へ波のように点いては消える。光の帯の中を帯と一緒に歩く（追い越しても遅れても闇に捕まって入口へ）。入口と出口の前は消えない灯りで、次の波を待てる' },
  { idea: 'L11', name: '色の照明', status: 'done', impl: [a('rgbRoom'), a('tint'), p('lamp'), p('pattern')], note: '異変 rgbRoom: 照明が赤・緑・青に 4 秒ずつ切り替わる。壁の色の印（手形・矢印・数え線）は同じ色の光の下では消え、ほかの色の光では黒く浮かぶ。段階 3 の異変 tint（真っ赤な照明）はそのまま' },
  { idea: 'L12', name: '影だけ動く', status: 'done', impl: [a('walkingShadow'), p('senseFx')], note: '異変: 誰もいないのに人の影が壁を歩いて往復する（壁際から足音も）。じっと見ると止まって薄れる' },
  { idea: 'L13', name: '光の当たる所だけ実体', status: 'done', impl: [g('beamFloor'), p('lightFloor')], note: '真っ暗な穴の部屋。懐中電灯で照らした床板だけが現れ、照らすのをやめて 1.4 秒で消える。足元の先を照らしながら渡る（止まるなら足元を照らす）。懐中電灯を消すと渡れない' },
  { idea: 'L14', name: '暗闇で光る印', status: 'done', impl: [g('glowCurtains'), p('senseFx')], note: '真っ暗な部屋の出口の手前に、厚い幕の下がった 3 つの口。本物の口だけが出口へ、ほかの奥へ入ると暗転して入口へ戻される。床の蓄光の矢印が本物の口へ導くが、懐中電灯を消している間だけ見える（点けると光に紛れる）' },
  { idea: 'L15', name: '窓の光の向き', status: 'done', impl: [a('sunbeam'), p('senseFx')], note: '異変: 窓の外は夜なのに、窓から日の光の筒が差し込み、床の日だまりが早回しのように動く（日の向きが 36 秒で往復）' },
  { idea: 'L16', name: '雷', status: 'done', impl: [a('lightning'), p('lightning'), p('lamp')], note: '異変: 窓の無い暗い部屋に、4〜10 秒ごとに稲光（照明が青白く 2〜3 回瞬く）。少し遅れて雷鳴' },
  { idea: 'L17', name: '照明を消すと現れる扉', status: 'done', impl: [g('switchOffDoor'), p('lever'), p('senseFx')], note: '入口の脇に照明のスイッチ。消すと暗がりに扉の形の光る縁が浮かび、1 秒で壁が開く（出現型・必ず付ける）' },
  { idea: 'L18', name: '光の帯の上だけ歩ける', status: 'done', impl: [g('lightBands'), p('lightFloor')], note: '天井の細い隙間から落ちる光の帯が穴に橋を架ける。帯は順に点いては消える（消える前に瞬く）。点いたばかりの帯を選んで渡る（L02 の「点いている間に進む」の要素も持つ）' },
  // ---------------------------------------------------------------- 2.7 音
  { idea: 'A01', name: '音の道しるべ', status: 'existing', impl: [g('soundGuide')], note: '暗い部屋で出口の前の音をたどる（段階 3）。裏の振る舞いは BA01（silentCorner）' },
  { idea: 'A02', name: '音をつなぐ扉', status: 'done', impl: [g('chimeOrder'), p('chime'), p('melody'), p('sequence')], note: '行き止まりの部屋の壁に、高さの違う 5 つの鐘。入ると鐘の並びの旋律が流れる（鳴る鐘が光る。音を消していても見て分かる）。同じ順に鳴らすと隠しの扉（必ず付ける）。間違えると最初から。行き止まりなので回り道は要らない' },
  { idea: 'A03', name: '完全な無音', status: 'done', impl: [a('silence'), p('senseFx')], note: '異変: 壁と天井が吸音の楔で覆われ、部屋に入ると一切の音が消える（自分の足音も）。BA01 の無音の隅も同じ効果' },
  { idea: 'A04', name: 'マイクで開く扉', status: 'done', impl: [g('loudGate'), p('noiseGate')], note: '出口の扉に音の鍵。扉の前で大きな音を出すと開く。扉を調べたときにマイクを尋ね、使えれば声の大きさ（音量だけ。外へ送らない。InputCommand.voice）、使えなければ足音（走る・跳んで着地）で代わり。扉の脇に音量の目盛り。v1 E17 の 3 つの扉は、1 つの扉と静かにする扉（A10）に分けた' },
  { idea: 'A05', name: '足音が遅れて聞こえる', status: 'done', impl: [a('lateSteps'), p('senseFx')], note: '異変: 足音が 0.45 秒遅れて聞こえ、床の足跡も同じだけ遅れて現れる（音を消していても見て分かる）' },
  { idea: 'A06', name: '足音が増える', status: 'done', impl: [g('extraSteps'), p('ghostSteps')], note: '歩くと、自分の足音のすぐ後ろにもう一人の足音（1.2 秒前の自分の位置をたどる。同じ床の音）' },
  { idea: 'A07', name: '反響で形が分かる', status: 'done', impl: [g('echoMaze'), p('senseFx')], note: '真っ暗な部屋の、光を返さない黒い仕切りの迷路（懐中電灯では何も見えない）。音を立てると反響の輪が広がり、仕切りの縁が一瞬光る。手を叩く操作は無いので、跳んで着地する音を手を叩く代わり（大きな輪）にした。出口の前の水の音からも小さな輪' },
  { idea: 'A08', name: '音が見える', status: 'merged', impl: [g('echoMaze')], note: 'A07 にまとめた: 足音・着地・水の音が、床に広がる光の輪として見える（しゃがみ歩きは音が無いので輪も無い）' },
  { idea: 'A09', name: '遠くの館内放送', status: 'done', impl: [g('paChase'), p('paChase')], note: '意味の取れない放送（チャイム + くぐもった声）が壁のスピーカーから流れ、近づくと止んで別のスピーカーから流れる。最後まで追うと、そのスピーカーの脇に隠しの扉（存在型・出現型）' },
  { idea: 'A10', name: '静かにすると開く', status: 'done', impl: [g('quietGate'), p('noiseGate')], note: '出口の扉の前で、動かず音を立てずに 3 秒いると開く（マイクがあれば本当に静かに）。鍵は部屋の中の人にだけ掛かる' },
  { idea: 'A11', name: '音の高さの部屋', status: 'done', impl: [g('pitchMaze'), p('senseFx')], note: '濃い霧の迷路（懐中電灯は霧に吸われる）。部屋に低い音が鳴り続け、出口に（迷路の道のりで）近いほど高くなる。音で場所が分かる。「部屋ごとに音の高さが違う」を、1 つの部屋の中の場所ごとにした' },
  { idea: 'A12', name: '壁の向こうの生活音', status: 'done', impl: [g('livingWall'), p('senseFx')], note: '壁の向こうから食器・テレビ・ノック（くぐもった音）。隠しの扉が付けば、入るとそこは誰もいない部屋' },
  // ---------------------------------------------------------------- 2.8 視線と観測
  { idea: 'O01', name: '視線のマネキン', status: 'existing', impl: [g('mannequin')], note: '段階 3。裏の振る舞いは BO01（mannequinGaze）' },
  { idea: 'O02', name: 'だるまさんがころんだ', status: 'done', impl: [g('daruma'), p('daruma')], note: '出口の脇で壁を向いた鬼が数え歌を歌う（10 の音。長さは毎回違う）。歌が終わると振り返って 2〜3 秒こちらを見る。見られている間に動くと捕まって入口へ。開口の前の床は安全' },
  { idea: 'O03', name: '時計を見る / 見ない', status: 'done', impl: [g('watchClock'), p('watchClock')], note: '壁の時計は見ていない間だけ進む（見ていない間はコチコチと速い音）。出口の扉は鍵が掛かっていて、12 時の前後に時計を見ると 6 秒だけ開く（扉の上の灯りが緑）。見ないで待ち、ちらっと見て、12 時で見つめて止め、扉へ。鍵は部屋の中の人にだけ掛かる' },
  { idea: 'O04', name: 'ズームで注視', status: 'done', impl: [g('zoomSign'), p('gazeSensor')], note: '長い部屋の奥の壁に小さな札。立ち止まって見つめると撮像がズームし（スマホでも同じ操作: 止まって見つめる）、札の小さな数字が読める。横の壁の番号付きの扉の形のうち、その番号が隠しの扉（必ず付ける）' },
  { idea: 'O06', name: '見ていない間に動く家具', status: 'done', impl: [a('turningChairs'), p('senseFx')], note: '異変: 部屋の椅子（3〜8 脚）は見ていない間に向きを変え、振り返ると全部こちらを向いている。当たり判定は元の場所のまま（向きだけ変わる）' },
  { idea: 'O07', name: '見ている間だけある橋', status: 'done', impl: [g('lookBridge'), p('lightFloor')], note: '穴に架かる橋（L 字もある）は、画面に映っている間だけある（目を離して 0.9 秒で消える）。前を見て（少し下を見て）渡る。振り返る・横を見続けると落ちる' },
  { idea: 'O08', name: '写真に写るもの', status: 'done', impl: [g('photoBooth'), p('photoCam'), p('senseFx')], note: '入口の脇の三脚のカメラを調べると、部屋の奥を撮った写真が隣の額に出る。写真には肉眼で見えない物が写る（隠しの扉があれば開いて光が漏れている扉、無ければ部屋の真ん中に立つ人影）。写真は別のカメラで描く（画質の段で解像度を落とす）' },
  { idea: 'O09', name: '監視カメラの映像', status: 'done', impl: [g('cctvRoom'), p('gazeSensor'), p('senseFx')], note: '机のモニターに、天井の隅の監視カメラの映像（この部屋。自分が映る）。映像では自分の後ろに人が立っていて、奥の壁の扉が開いている。映像は画質の段で 5〜10 枚/秒（低い段は入ったときに 1 枚）' },
  { idea: 'O10', name: '鏡の中だけの扉', status: 'done', impl: [g('mirrorDoor'), p('gazeSensor'), p('senseFx')], note: '壁一面の鏡に、向かいの壁の開いた扉が映る（振り向くと壁しかない）。鏡を見ながら後ろ向きにその壁へ下がると壁が開く（出現型・必ず付ける）。鏡は Reflector（高い段 512 px・中 320 px・低い段は暗いガラスに扉の縁がうっすら）' },
  { idea: 'O11', name: '目を閉じる', status: 'done', impl: [g('blindCurtains'), p('gazeSensor'), p('senseFx')], note: '幕の 3 つの口のどれが本物か分からない部屋。目を閉じる（真下を見て止まる。スマホでも同じ）と画面が暗くなって音が遠のき、本物の口の奥から鈴が鳴る。違う口の奥へ入ると入口へ戻される' },
  { idea: 'O12', name: '視界の端の人影', status: 'done', impl: [a('edgeFigure'), p('senseFx')], note: '異変: 視界の端（視線から 34〜50°）にだけ黒い人影が立つ。そちらを見ると（20° 以内）消えて、ささやきが聞こえる' },
  // ---------------------------------------------------------------- 2.9 時間
  { idea: 'T01', name: '止まる時間', status: 'existing', impl: [g('appearPath')], note: '立ち止まると見える道（段階 3）' },
  wip('T03', '増水'),
  wip('T05', '巻き戻る部屋'),
  { idea: 'T06', name: '遅い部屋', status: 'done', impl: [a('slowTime'), p('senseFx')], note: '異変: 部屋の中では動きが半分の速さになり（重さは変えない。軽い部屋と分ける）、足音が低くこもって聞こえ、塵がゆっくり舞う' },
  wip('T07', '同じ 1 分のくり返し'),
  wip('T10', '閉店のアナウンス'),
  // ---------------------------------------------------------------- 4.7 裏の振る舞い（光と闇・音・視線と観測・移動と身体の BM11）
  { idea: 'BL01', name: '人感センサーの灯りをつけずに進む', status: 'done', impl: [g('sneakLights'), p('speedSensor')], note: '廊下の灯りは速く（2 m/s より速く）動いた区間だけつく。しゃがみ歩きで一度も灯りをつけずに奥まで進むと、暗がりに光る縁が浮かび壁が開く（出現型・必ず付ける）。廊下を出ると数え直す。L01（sensorLights）は段階 3 のまま変えず、裏の振る舞いのある廊下を別の仕掛けにした' },
  { idea: 'BL02', name: '消える照明の真っ暗な間に進む', status: 'done', impl: [g('blinkoutHall'), p('senseFx')], note: '真っ暗な間にだけ、遠い壁に扉の形の光る縁が浮かぶ（存在型 = 扉は最初からある・出現型 = 真っ暗な間にその壁の前に 0.5 秒いると壁が開く。闇に捕まる前に入る）' },
  { idea: 'BL03', name: '鏡の光を何もない壁に当てる', status: 'done', impl: [g('mirrorBeam')], note: '解でない鏡の並びのうち 1 つで、筋が何も無い壁（うっすら焦げた丸い跡）に当たる。1 秒当て続けると壁が開く（出現型）' },
  { idea: 'BL04', name: '懐中電灯を消すと見える目印', status: 'done', impl: [g('glowCurtains'), p('flashlightSensor')], note: '懐中電灯を消すと、横の壁に光る手形が浮かぶ。手形の壁に隠しの扉（存在型 = 最初からある・出現型 = 消したまま手形の前に 2 秒いると壁が開く）' },
  { idea: 'BL05', name: 'サーチライトにわざと見つかる', status: 'done', impl: [g('searchlight')], note: '2 回見つかると、戻される先が部屋の隅（木箱の陰）に変わり、そこに隠しの扉（存在型 = 最初からある・出現型 = 隅へ送られたときに開く）' },
  { idea: 'BL06', name: '霧の誘導灯の偽の灯りをたどる', status: 'done', impl: [g('fogBeacons')], note: '道の途中から横の壁へ分かれ道。分かれ道の灯りは少し黄色く、逆の向きに違う間隔で流れる（偽の灯り）。その先の壁に隠しの扉（存在型・出現型 = 道の端に立つと開く）。隠しが付かなければ行き止まり' },
  { idea: 'BA01', name: '音の道しるべと逆の無音の方へ', status: 'done', impl: [g('silentCorner'), p('soundBeacon'), p('senseFx')], note: '暗い部屋で出口の前の音が鳴る（音の道しるべと同じ）。音と反対の隅は一切の音が消える（A03 の効果）。その無音の隅で 3 秒止まると扉が現れる（存在型 = 暗がりに最初からある）' },
  { idea: 'BA02', name: 'しゃがみ歩きで通ると別の扉の気配', status: 'done', impl: [g('extraSteps')], note: 'しゃがんで音を立てずに 3 秒歩き続けると、もう一人の足音だけが離れて壁まで歩き、壁を 3 回叩く。そこに隠しの扉（存在型・出現型）' },
  { idea: 'BA03', name: '音をつなぐ扉を逆順に鳴らす', status: 'done', impl: [g('chimeOrder')], note: '旋律を逆の順に鳴らすと、別の壁に別の扉（出現型）' },
  { idea: 'BA04', name: '生活音の壁にもたれて止まる', status: 'done', impl: [g('livingWall'), p('dwellSensor')], note: '音のする壁の前で止まって 4 秒いると、壁が扉になる（出現型。存在型 = 壁と同じ色の扉が最初からある）' },
  { idea: 'BO01', name: 'マネキンの視線の先', status: 'done', impl: [g('mannequinGaze'), p('gazeSensor'), p('senseFx')], note: '部屋の白いマネキンが全員、壁の同じ一点を見つめている（目を離すとこちらへ首を向け、見ると一点へ戻る）。その一点に隠しの扉（存在型・出現型 = 同じ所を見つめると開く）' },
  { idea: 'BO02', name: 'だるまさんでわざと捕まる', status: 'done', impl: [g('daruma')], note: '3 回捕まると入口ではなく部屋の隅へ連れて行かれる。そこに隠しの扉（存在型・出現型。体力は減らさない）' },
  { idea: 'BO03', name: '時計を見ないまま長くいる', status: 'done', impl: [g('watchClock')], note: '一度も時計を見ないまま 45 秒いると、時計が消え、時計の跡（壁の日焼けの四角）が扉になる（出現型）' },
  { idea: 'BO04', name: '遠くの看板の小さな文字', status: 'done', impl: [g('zoomSign')], note: '札の小さな数字が、隠しの扉の番号（存在型 = その番号の扉だけ本物・出現型 = 読み終えると開く）。エレベーターの番号の代わりに、同じ部屋の番号の壁にした（エレベーターは別の担当）' },
  { idea: 'BO05', name: '出口の前で振り返る', status: 'done', impl: [g('lookBack'), p('lookSensor')], note: '廊下の出口の前で振り返って来た道を 1 秒見ると、来た道の横の壁に扉が現れる（出現型・必ず付ける）' },
  { idea: 'BO06', name: '写真にだけ写る扉', status: 'done', impl: [g('photoBooth')], note: '写真を撮ってから、写っていた扉の所へ行くと壁が開く（出現型。存在型 = 壁と同じ色の扉が最初からある）' },
  { idea: 'BO07', name: 'モニターで自分のいない部屋の扉を見る', status: 'done', impl: [g('cctvRoom')], note: 'モニターで開いている扉を 2 秒見つめると、その扉が本当に開く（出現型。存在型 = 扉は最初からあり、映像では開いて見える）。「自分のいない部屋」は同じ部屋の自分の見ていない側にした（仕掛けは 1 つの区画に組むので）' },
  wip('BM11', '増水を待って天井近くの開口へ'),
];
