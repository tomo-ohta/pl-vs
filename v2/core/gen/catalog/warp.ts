/**
 * 案の台帳・空間のゆがみと輪（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 *
 * 共通の作り:
 * - 控え室（core/gen/gimmicks/warp/anteroom.ts・部品 warpAnteroom）: 部屋に 3 枚目の扉を付け、「ほかの扉が全部閉じているときだけ」開く。
 *   開けた瞬間に部屋の真上の双子の部屋へ継ぎ目なく移り、その先に別の空間（フロアの上空。長い廊下・階段）を作る。双子の部屋の扉は元の部屋へ戻す
 * - 継ぎ目の無い移動（PartContext.warp）は、移す前と後の見える範囲の箱が同じ所どうしだけ（tests/helpers/warp.ts の twinMismatch で確かめる）
 * - 見ていない間に作り替える（部品 swapSet）: 視野の円錐と見通し（PartContext.sightClear）で、見えていない間だけ差し替える
 */
import type { CatalogEntry } from './types.ts';

const TODO = '作成中（この段階の作業の途中。終わったら done にする）';

export const WARP_CATALOG: CatalogEntry[] = [
  { idea: 'W06', name: '閉じた輪の廊下', status: 'done', impl: [{ kind: 'gimmick', id: 'loopHall' }, { kind: 'part', id: 'warpTreadmill' }, { kind: 'part', id: 'warpAnteroom' }],
    note: '控え室の 3 枚目の扉の先のまっすぐな廊下。同じ椅子・扉・照明が 12 m ごとにくり返し（霧で先は見えない）、前へ 4 周すると輪がほどけて奥の扉が現れ、開けると最初の部屋（の双子）に出る。まっすぐ進んだのに元の場所に戻る。80 秒でほどける' },
  { idea: 'BX02', name: '閉じた輪の廊下を逆向きに何周もする', status: 'done', impl: [{ kind: 'gimmick', id: 'loopHall' }, { kind: 'secret', id: 'loop.backward' }],
    note: '1 周すると後ろも輪になる（輪が閉じる）。後ろへ 3 周すると後ろの輪がほどけ、廊下の入口の壁に隠しの扉が現れる（出現型）' },
  { idea: 'W05', name: '遠ざかる廊下', status: 'done', impl: [{ kind: 'gimmick', id: 'recedingHall' }, { kind: 'part', id: 'warpRecede' }, { kind: 'view', id: 'warpRecede' }],
    note: '控え室の 3 枚目の扉を開けると、すぐ先に非常口の扉。近づくほど突き当たりが遠ざかり、椅子・扉・照明が陰から現れて廊下が伸びていく（残りの距離は 1 m ごとに 0.5 m 伸びる。v1 E13 の式）。ある所まで歩くと偽の突き当たりが本物に重なって消え、扉の先は最初の部屋（の双子）。戻ると近づく' },
  { idea: 'X01', name: '異変の廊下', status: 'done', impl: [{ kind: 'gimmick', id: 'anomalyHall' }, { kind: 'part', id: 'warpLapHall' }, { kind: 'view', id: 'warpLapHall' }, { kind: 'part', id: 'warpSign' }],
    note: '控え室の先の白いタイルの地下通路（8 番出口型）。左・右と曲がるとまっすぐな廊下、その先の左・右でまた廊下の始まり（S0/S1 は 1 周ずらした双子、S0 は 180° 回しても同じ）。周ごとに異変が 1 つあるか無いか（16 種: 掲示の色・掲示が無い・手形・通気口の目・札の数字が逆さ・くず入れが倒れる・掲示が増える・長椅子が無い・赤い扉・扉が増える・大きな消火器・水たまり・人が立つ・天井が下がる・赤い照明・扉だらけ）。異変があれば引き返す・無ければ進む。正しければ天井の札の数が増え、間違えると 0。5 回で札が「出口」になり奥へ。数が 0 の周は引き返すと来た道へ（閉じ込めない）' },
  { idea: 'BX01', name: '異変の廊下で、異変を見つけてもそのまま進む', status: 'done', impl: [{ kind: 'gimmick', id: 'anomalyHall' }, { kind: 'secret', id: 'lap.keepGoing' }],
    note: '一度も引き返さずに、異変のある周を 3 回進むと、見る廊下の壁に異変の部屋の扉が現れる（出現型。移した tick に現れるので、現れる所は見えない）' },
  { idea: 'W14', name: '階段の数', status: 'done', impl: [{ kind: 'gimmick', id: 'endlessStairs' }, { kind: 'part', id: 'warpStairs' }],
    note: '控え室の先の折り返し階段の階段室。上っても上っても同じ扉・同じ階の札（B○F）の踊り場（2 階目の上りの途中で 1 階ぶん真下へ移す。右と左の段の間は壁で、見えるのは上下 1 階ぶんだけ）。6 回上ると次の踊り場の札が 1 つ上の階になり、扉の先は最初の部屋の真上の双子の部屋。下りれば上った分だけで来た扉へ戻る。150 秒で必ず抜ける' },
  { idea: 'W13', name: '4 回曲がっても戻らない', status: 'done', impl: [{ kind: 'gimmick', id: 'fourRights' }, { kind: 'part', id: 'warpRing' }, { kind: 'part', id: 'swapSet' }, { kind: 'secret', id: 'ring.right' }],
    note: '部屋の真ん中を天井までの塊が占め、まわりを通路が囲む（4 面に同じ額）。右へ 4 回曲がって 1 周すると、来た扉の穴が壁で埋まっている（半周を越えたところで決まり、扉が見えない間に埋まる。外から開けようとしても鍵の音）。左へ 1 周すれば戻る（右へ何周しても左へ 1 周）。ほかの開口はいつでも使える。隠しが付けば、1 周したあと向かいの壁に見たことのない扉が現れる（出現型。見ていない間に現れる）' },
  { idea: 'W07', name: '曲がると変わる景色', status: 'done', impl: [{ kind: 'gimmick', id: 'cornerSwap' }, { kind: 'part', id: 'swapSet' }, { kind: 'view', id: 'swapSet' }],
    note: '扉を開けると目の前に天井までの仕切り。扉の壁との間の細い通路を歩き、端の切れ目を曲がって部屋の奥へ出る。角を曲がって背を向けると、通ってきた切れ目は壁になり反対の端に切れ目が移る。のぞくと、来た通路は別の部屋（ロッカーの更衣室・本棚と赤い絨毯の書斎・椅子の並ぶ待合）。出て戻るたびに次の部屋（4 つを順に）。来た扉はいつも同じ所。通路と切れ目のどちらも見えていない間だけ変わり、通路の中にいる間は変わらない' },
  { idea: 'O05', name: '振り返ると変わる', status: 'done', impl: [{ kind: 'gimmick', id: 'lookBack' }, { kind: 'part', id: 'swapSet' }, { kind: 'view', id: 'swapSet' }],
    note: '壁沿いに仕切りで区切った小部屋が 3〜6 並ぶ部屋（肘掛け椅子と灯り・机・寝台・段ボール・テレビ・長椅子と鉢植え・壁を向いた椅子・白い人の形）。一度見た小部屋は、目を離して 0.6 秒たつと別の場面に変わる（背後で小さな物音）。見ている間は決して変わらない（視野の円錐と見通しで調べ、変える直前にも調べ直す）。最初の場面は落ち着いた物（人の形・壁を向いた椅子は 2 回目から）' },
  { idea: 'W12', name: '2 つの扉が同じ部屋へ', status: 'done', impl: [{ kind: 'gimmick', id: 'twoDoors' }, { kind: 'part', id: 'warpAnteroom' }],
    note: '部屋の壁に並んだ 2 枚の扉。左の扉を開けると赤い絨毯と緑の壁の居間、右の扉を開けると同じ居間に反対側の壁から入る（並んだ扉が同じ部屋の両端につながる）。居間を通り抜けると、もう一方の扉から元の部屋に出る。居間は 1 つだけ（v1 MultiEdge の発展。控え室の扉 2 枚・双子の部屋 2 つ（片方は 180° 回す）。双子の部屋のつながっていない扉は、もう一方の双子の部屋へ移す）' },
  { idea: 'T04', name: '時間で入れ替わる扉', status: 'done', impl: [{ kind: 'gimmick', id: 'timedDoors' }, { kind: 'part', id: 'warpAnteroom' }, { kind: 'part', id: 'warpPhaseLamp' }, { kind: 'view', id: 'warpPhaseLamp' }, { kind: 'secret', id: 'timed.amber' }],
    note: '部屋の壁に並んだ 2 枚の扉。扉の上の細い灯りが青と琥珀に光り、青の扉は白い壁に青い帯の部屋へ、琥珀の扉は木の床と本棚の琥珀の部屋へ。30 秒ごとに小さなチャイムが鳴って灯りの色が入れ替わり、行き先も入れ替わる。同じ扉で 2 つの部屋へ行くと（入れ替わりに気づくと）、琥珀の部屋の奥の壁に隠しの扉が現れる（出現型。現れるのは双子の部屋へ移した tick）。青い部屋・琥珀の部屋は向かい合う 2 枚の扉で、いつでも元の部屋（の双子）へ戻れる（双子の部屋 4 つ・控え室の行き先を時間で入れ替える）' },
  { idea: 'F27', name: '時間で変わる接続', status: 'merged', impl: [{ kind: 'gimmick', id: 'timedDoors' }, { kind: 'part', id: 'warpAnteroom' }],
    note: 'T04 時間で入れ替わる扉と同じ仕組み（一定時間ごとに扉の行き先が入れ替わる。控え室の phase）' },
  { idea: 'W03', name: '距離を飛び越える扉', status: 'done', impl: [{ kind: 'gimmick', id: 'lightFrame' }, { kind: 'part', id: 'warpGate' }, { kind: 'part', id: 'warpPortal' }, { kind: 'view', id: 'warpPortal' }, { kind: 'client', id: 'Portals' }],
    note: '部屋の真ん中に白く光る枠が 1 つ立ち、枠の中には夕暮れの展望室（大きな窓・長椅子）が見える。くぐると展望室へ（振り返ると枠の向こうに元の部屋）、もう一度くぐれば戻る。枠の横・外を回っても何も起きない。枠の向こうは窓・枠の描画（client/world/Portals.ts: 写したカメラで描いた画像を板に画面の座標で貼る。手前は傾けた近くの面で切る）' },
  { idea: 'BX03', name: '距離を飛び越える扉の、枠の裏側から入る', status: 'done', impl: [{ kind: 'gimmick', id: 'lightFrame' }, { kind: 'secret', id: 'frame.back' }],
    note: '隠しが付くと、枠の裏からは別の所（白い短い廊下）が見える。裏からくぐると廊下に出て、くぐった tick に突き当たりの壁が開く（出現型）。隠しが付かなければ裏はただの枠（くぐっても何も起きない）' },
  { idea: 'W08', name: '窓の向こうの自分', status: 'deferred', impl: [], note: TODO },
  { idea: 'BX08', name: '窓の前で長く立ち止まる', status: 'deferred', impl: [], note: TODO },
  { idea: 'W11', name: '回転する部屋', status: 'done', impl: [{ kind: 'gimmick', id: 'turnRoom' }, { kind: 'part', id: 'warpTurnRoom' }, { kind: 'view', id: 'warpTurnRoom' }],
    note: '広い部屋の真ん中に、木の板張りの丸い部屋（筒・肘掛け椅子 4 脚と灯り・額・赤い床）が 1 回り 40 秒でゆっくり回る。筒の外の通路は 4 枚の仕切りで区切られ、向かいの扉へは筒の中を通るしかない（入口は向かい合う 2 か所。目の前に来たら乗り、行きたい扉の前に来たら降りる）。仕切りは入口と出口が別の区切りになる所に置き、隠しが付けば筒を通らないと行けない区切りの壁に壁の色の扉（存在型）。筒の中では床と一緒に回り（向きも回る）、真ん中から離れるほど外へ押される（真ん中にいれば立っていられる）。入口はどの区切りの前にも回ってくる（閉じ込めない）' },
  { idea: 'F30', name: '前の階に戻る輪', status: 'deferred', impl: [], note: TODO },
];
