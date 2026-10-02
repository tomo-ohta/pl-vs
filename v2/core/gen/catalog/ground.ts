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
  { idea: 'G07', name: '箱の橋', status: 'done', impl: [{ kind: 'gimmick', id: 'crateBridge' }, { kind: 'part', id: 'crate' }, { kind: 'view', id: 'crate' }],
    note: '「触れると橋が架かる」では遊びにならないので、箱を押して幅 2 升の溝を埋める小さなパズルにした（同じ列に 2 つ落とすと渡れる）。解けることを生成時に幅優先で確かめる。溝の上は下がり天井（走っても、しゃがんで跳んでも越えられない）。戻すボタン 2 つ（入口・溝の段の出口）。向こう岸のボタンで板が伸びる（帰り道）。行き止まりでは向こうの壁に隠し（crate.across）' },
  { idea: 'G08', name: '立ち止まると見える道', status: 'existing', impl: [{ kind: 'gimmick', id: 'appearPath' }, { kind: 'gimmick', id: 'stillPaths' }],
    note: '行き止まりの appearPath（段階 3）に加えて、本道にも置ける stillPaths（BG04 の 2 本目の道つき）を作った' },
  { idea: 'G09', name: '踏むと鳴る床', status: 'done', impl: [{ kind: 'gimmick', id: 'chimeTiles' }, { kind: 'part', id: 'chimeFloor' }, { kind: 'view', id: 'chimeFloor' }],
    note: '部屋の床いっぱいの升目。升目ごとに音の高さが違い、部屋に入ると升目が順に光って鳴って短い節を見せる（隣どうしの升目をたどる節）。同じ順に踏むと和音が鳴って扉が現れる（chime.melody・出現型）。間違えると最初から。通り抜けるだけなら何も起きない（「回り道」は不要）' },
  { idea: 'G10', name: '重りの床', status: 'done', impl: [{ kind: 'gimmick', id: 'weightBridge' }, { kind: 'part', id: 'loadPlate' }, { kind: 'part', id: 'crate' }, { kind: 'part', id: 'mover' }],
    note: '溝の底の鉄の床板が、手前の重りの印に重さが載っている間だけ縁までせり上がる。印に乗ってから走れば渡れ（歩くと沈む床板と一緒に底へ）、横の重い箱を印へ押せば上がったまま。下がり天井で跳び越せない。向こう岸のボタンで上がる（帰り道）。行き止まりでは向こうの壁に隠し（weight.across）' },
  { idea: 'G11', name: '光る床', status: 'deferred', impl: [], note: WIP },
  { idea: 'G12', name: '足跡が残る床', status: 'deferred', impl: [], note: WIP },
  { idea: 'G13', name: '他人の足跡', status: 'deferred', impl: [], note: WIP },
  { idea: 'G14', name: '水たまりの鏡', status: 'deferred', impl: [], note: WIP },
  { idea: 'G15', name: '床下の明かり', status: 'done', impl: [{ kind: 'gimmick', id: 'underHatch' }, { kind: 'part', id: 'hatch' }, { kind: 'view', id: 'hatch' }],
    note: '床の継ぎ目から暖かい光が漏れる四角い蓋（隠しの目印）。調べると蓋が滑って開き、階段で地下の小部屋へ。地下の壁に扉（hatch.under・存在型・必ず付ける）。蓋は開いたまま' },
  { idea: 'G16', name: '沈む床', status: 'done', impl: [{ kind: 'gimmick', id: 'sinkFloor' }, { kind: 'part', id: 'stillLift' }, { kind: 'part', id: 'floorGoto' }, { kind: 'view', id: 'stillLift' }],
    note: '継ぎ目で縁取られた 2 m 四方の床板。止まって立っていると縦穴へゆっくり沈み（歩き回ると戻る）、底で止まっていると 1 つ下のフロアへ（Cue floor.goto → ClientGame.onFloorExit。エレベーター代わり）。通り抜けるだけの人は沈まない' },
  { idea: 'G17', name: 'せり上がる床', status: 'done', impl: [{ kind: 'gimmick', id: 'riseFloor' }, { kind: 'part', id: 'stillLift' }, { kind: 'view', id: 'stillLift' }],
    note: '壁の高い所に入口の無い扉（どこへも行けない扉）。その下の床板の上で止まって立つと扉の高さまでせり上がる（歩くと戻る）。扉の先が隠し（rise.high・存在型・必ず付ける）。戻りは飛び降りる' },
  { idea: 'G18', name: '動く床タイル', status: 'deferred', impl: [], note: WIP },
  { idea: 'G19', name: '回る円盤', status: 'deferred', impl: [], note: WIP },
  { idea: 'G20', name: 'ベルトの迷路', status: 'existing', impl: [{ kind: 'gimmick', id: 'beltMaze' }, { kind: 'part', id: 'forceZone' }] },
  // ---------------------------------------------------------------- 2.11 装置と仕掛け
  { idea: 'D01', name: 'スイッチと近道', status: 'existing', impl: [{ kind: 'gimmick', id: 'switchDoor' }, { kind: 'part', id: 'button' }] },
  { idea: 'D02', name: '順番の区画', status: 'done', impl: [{ kind: 'gimmick', id: 'visitOrder' }, { kind: 'part', id: 'visitOrder' }, { kind: 'view', id: 'visitOrder' }],
    note: '部屋の床に色の付いた 3〜4 か所の印（柱の上の灯り）。壁の板に色の並び（左から順）。その順に印の上で立ち止まると灯りが点いていき、全部点くと扉が現れる（visit.order・出現型）。「記録が埋まる」は報酬を置かない決まりなので隠しにした。区画はフロアの部屋ではなく部屋の中の印（同じ部屋で手がかりと答えが見える形）' },
  { idea: 'D03', name: '踏まない区画', status: 'done', impl: [{ kind: 'gimmick', id: 'avoidTiles' }, { kind: 'part', id: 'avoidFloor' }, { kind: 'view', id: 'avoidFloor' }],
    note: '赤い升目と白い升目の床。入口の前の黄色い印に立ってから、赤を 1 つも踏まずに奥の光る印まで行くと扉が現れる（avoid.clean・出現型）。白い升目は迷路の 1 本道（まっすぐ歩くと赤を踏む道を選ぶ）。赤を踏むと低い音で失敗、印からやり直し' },
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
  { idea: 'BG04', name: '立ち止まると見える道でさらに長く止まる', status: 'done', impl: [{ kind: 'gimmick', id: 'stillPaths' }, { kind: 'secret', id: 'still.longer' }],
    note: '溝の手前の光の四角で止まると 1 本目の見えない橋、さらに長く止まると（6 秒）2 本目の橋が仕切りの向こうの小部屋へ。小部屋の横の壁に扉（存在型 / 出現型）。向こう岸にも四角（1 本目）。下がり天井で跳び越せない。行き止まりでは 1 本目の先の壁にも扉（still.across）' },
  { idea: 'BG05', name: '足跡のループを逆回り', status: 'deferred', impl: [], note: WIP },
  { idea: 'BG06', name: '天秤の床を釣り合わせる', status: 'done', impl: [{ kind: 'gimmick', id: 'balanceRoom' }, { kind: 'part', id: 'balanceScale' }, { kind: 'part', id: 'crate' }, { kind: 'secret', id: 'balance.even' }],
    note: '壁際の天秤の 2 枚の皿（重い方が下がる）と間の床。重い箱（2）と軽い箱（1）を押して皿に載せても傾いたまま。軽い方に自分も乗る（1 + 1）と釣り合い、間の床が 2 段に下がって壁の低い扉が現れる（出現型・必ず付ける）。物を持つ仕組みは使わず、押せる箱の重さで釣り合わせる' },
  // ---------------------------------------------------------------- 4.7 裏の振る舞い（空間と認知）の受け持ち
  { idea: 'BX06', name: 'エレベーターで存在しない階のボタンの順に押す', status: 'deferred', impl: [], note: WIP },
  { idea: 'BX07', name: '自販機の同じボタンを何度も押す', status: 'deferred', impl: [], note: WIP },
];
