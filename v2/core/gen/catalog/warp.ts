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
  { idea: 'W05', name: '遠ざかる廊下', status: 'deferred', impl: [], note: TODO },
  { idea: 'X01', name: '異変の廊下', status: 'deferred', impl: [], note: TODO },
  { idea: 'BX01', name: '異変の廊下で、異変を見つけてもそのまま進む', status: 'deferred', impl: [], note: TODO },
  { idea: 'W14', name: '階段の数', status: 'deferred', impl: [], note: TODO },
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
