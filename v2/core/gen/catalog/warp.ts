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
  { idea: 'W13', name: '4 回曲がっても戻らない', status: 'deferred', impl: [], note: TODO },
  { idea: 'W07', name: '曲がると変わる景色', status: 'deferred', impl: [], note: TODO },
  { idea: 'O05', name: '振り返ると変わる', status: 'deferred', impl: [], note: TODO },
  { idea: 'W12', name: '2 つの扉が同じ部屋へ', status: 'deferred', impl: [], note: TODO },
  { idea: 'T04', name: '時間で入れ替わる扉', status: 'deferred', impl: [], note: TODO },
  { idea: 'F27', name: '時間で変わる接続', status: 'deferred', impl: [], note: TODO },
  { idea: 'W03', name: '距離を飛び越える扉', status: 'deferred', impl: [], note: TODO },
  { idea: 'BX03', name: '距離を飛び越える扉の、枠の裏側から入る', status: 'deferred', impl: [], note: TODO },
  { idea: 'W08', name: '窓の向こうの自分', status: 'deferred', impl: [], note: TODO },
  { idea: 'BX08', name: '窓の前で長く立ち止まる', status: 'deferred', impl: [], note: TODO },
  { idea: 'W11', name: '回転する部屋', status: 'deferred', impl: [], note: TODO },
  { idea: 'F30', name: '前の階に戻る輪', status: 'deferred', impl: [], note: TODO },
];
