/**
 * 案の台帳・床と足場・装置（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 */
import type { CatalogEntry } from './types.ts';

const WIP = '段階 4 で作っている途中';

export const GROUND_CATALOG: CatalogEntry[] = [
  // ---------------------------------------------------------------- 2.4 床と足場
  { idea: 'G01', name: '床の素材', status: 'existing', impl: [{ kind: 'client', id: 'AudioEngine.footstep' }], note: '足元の箱の材質で足音が変わる（ClientGame.surfaceUnder → AudioEngine.footstep。v1 と同じ）' },
  { idea: 'G02', name: '崩れる床', status: 'existing', impl: [{ kind: 'gimmick', id: 'crumbleFloor' }, { kind: 'part', id: 'crumbleTile' }] },
  { idea: 'G03', name: '崩れていく帰り道', status: 'done', impl: [{ kind: 'gimmick', id: 'collapseRun' }, { kind: 'part', id: 'collapseFloor' }, { kind: 'view', id: 'collapseFloor' }],
    note: '行き止まりの部屋の床全部が深い穴の上の床板。奥の装置に触れると警報・赤い照明、装置の足元から入口へ床が崩れてくる。前線の速さは部屋の奥行きから「走れば間に合い歩くと捕まる」に決める。落ちたら底の階段で入口へ。しばらくで戻る' },
  { idea: 'G04', name: '傾く足場', status: 'existing', impl: [{ kind: 'gimmick', id: 'tiltRoom' }, { kind: 'part', id: 'tiltFloor' }] },
  { idea: 'G05', name: '落ちてくる天井', status: 'deferred', impl: [], note: WIP },
  { idea: 'G06', name: 'ドミノの橋', status: 'done', impl: [{ kind: 'gimmick', id: 'dominoBridge' }, { kind: 'part', id: 'domino' }, { kind: 'view', id: 'domino' }],
    note: '溝の手前の縁に背の高い棚の列。押すと押した向きに倒れて隣を倒し、端の橋の棚が溝に倒れて橋になる。溝の縁は柵（走って跳んでも越えられない）。落ちたら溝の階段で手前へ。向こう岸のレバーで橋を倒せる（帰り道）。物理を使わない決まった動き' },
  { idea: 'G07', name: '箱の橋', status: 'deferred', impl: [], note: WIP },
  { idea: 'G08', name: '立ち止まると見える道', status: 'existing', impl: [{ kind: 'gimmick', id: 'appearPath' }] },
  { idea: 'G09', name: '踏むと鳴る床', status: 'deferred', impl: [], note: WIP },
  { idea: 'G10', name: '重りの床', status: 'deferred', impl: [], note: WIP },
  { idea: 'G11', name: '光る床', status: 'deferred', impl: [], note: WIP },
  { idea: 'G12', name: '足跡が残る床', status: 'deferred', impl: [], note: WIP },
  { idea: 'G13', name: '他人の足跡', status: 'deferred', impl: [], note: WIP },
  { idea: 'G14', name: '水たまりの鏡', status: 'deferred', impl: [], note: WIP },
  { idea: 'G15', name: '床下の明かり', status: 'deferred', impl: [], note: WIP },
  { idea: 'G16', name: '沈む床', status: 'deferred', impl: [], note: WIP },
  { idea: 'G17', name: 'せり上がる床', status: 'deferred', impl: [], note: WIP },
  { idea: 'G18', name: '動く床タイル', status: 'deferred', impl: [], note: WIP },
  { idea: 'G19', name: '回る円盤', status: 'deferred', impl: [], note: WIP },
  { idea: 'G20', name: 'ベルトの迷路', status: 'existing', impl: [{ kind: 'gimmick', id: 'beltMaze' }, { kind: 'part', id: 'forceZone' }] },
  // ---------------------------------------------------------------- 2.11 装置と仕掛け
  { idea: 'D01', name: 'スイッチと近道', status: 'existing', impl: [{ kind: 'gimmick', id: 'switchDoor' }, { kind: 'part', id: 'button' }] },
  { idea: 'D02', name: '順番の区画', status: 'deferred', impl: [], note: WIP },
  { idea: 'D03', name: '踏まない区画', status: 'deferred', impl: [], note: WIP },
  { idea: 'D04', name: 'エレベーターの階ボタン', status: 'deferred', impl: [], note: WIP },
  { idea: 'D05', name: '自販機', status: 'deferred', impl: [], note: WIP },
  { idea: 'D06', name: '改札', status: 'deferred', impl: [], note: WIP },
  { idea: 'D07', name: '自動扉', status: 'deferred', impl: [], note: WIP },
  { idea: 'D08', name: 'シャッター', status: 'deferred', impl: [], note: WIP },
  { idea: 'D09', name: '回転灯と警報', status: 'deferred', impl: [], note: WIP },
  { idea: 'D10', name: 'ブレーカー', status: 'deferred', impl: [], note: WIP },
  { idea: 'D11', name: 'ダイヤル錠', status: 'deferred', impl: [], note: WIP },
  { idea: 'D12', name: '呼び出しボタン', status: 'deferred', impl: [], note: WIP },
  // ---------------------------------------------------------------- 4.7 裏の振る舞い（床と足場）
  { idea: 'BG01', name: '崩れる床をわざと崩して落ちる', status: 'existing', impl: [{ kind: 'gimmick', id: 'crumbleFloor' }, { kind: 'secret', id: 'crumble.fall' }] },
  { idea: 'BG02', name: '崩れていく帰り道で帰らずに奥へ', status: 'merged', impl: [{ kind: 'gimmick', id: 'collapseRun' }, { kind: 'secret', id: 'collapse.deep' }],
    note: 'G03 の隠し。装置の下の穴の底の壁に扉（存在型 = 床板の下で見えない / 出現型 = 崩れている間に装置の近くの底へ落ちると現れる）' },
  { idea: 'BG03', name: 'ドミノを違う順に倒す', status: 'merged', impl: [{ kind: 'gimmick', id: 'dominoBridge' }, { kind: 'secret', id: 'domino.reverse' }],
    note: 'G06 の隠し。向こう岸は仕切りで出口の側と小部屋に分かれ、列を出口と逆の向きに倒すと小部屋へ橋が架かる（小部屋の横の壁の扉: 存在型 / 出現型）。押した棚から両側へ倒れる鎖では「順」が効かないので「向き」にした。行き止まりの部屋では橋の先の奥の壁にも扉（domino.across）' },
  { idea: 'BG04', name: '立ち止まると見える道でさらに長く止まる', status: 'deferred', impl: [], note: WIP },
  { idea: 'BG05', name: '足跡のループを逆回り', status: 'deferred', impl: [], note: WIP },
  { idea: 'BG06', name: '天秤の床を釣り合わせる', status: 'deferred', impl: [], note: WIP },
  // ---------------------------------------------------------------- 4.7 裏の振る舞い（空間と認知）の受け持ち
  { idea: 'BX06', name: 'エレベーターで存在しない階のボタンの順に押す', status: 'deferred', impl: [], note: WIP },
  { idea: 'BX07', name: '自販機の同じボタンを何度も押す', status: 'deferred', impl: [], note: WIP },
];
