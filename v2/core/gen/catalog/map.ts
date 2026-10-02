/**
 * 案の台帳・地図と道案内・図鑑・調査率（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 */
import type { CatalogEntry } from './types.ts';

export const MAP_CATALOG: CatalogEntry[] = [
  {
    idea: 'N01', name: '調査率', status: 'done', impl: [{ kind: 'client', id: 'client/map/MapModel.ts（survey）' }, { kind: 'client', id: 'client/ui/Minimap.ts・MapPanel.ts' }, { kind: 'client', id: 'client/map/Codex.ts（フロアの記録）' }],
    note: '区画の床を 2 m の升目に分け、歩いた所から 3 m を調べたことにする。区画は 85% で調べ終わり（隅まで歩かなくてよい）。地図では調べていない升目に影が残り、埋めていく楽しさになる。100% でフロアの記録が完成し、図鑑にそのフロアの隠しの数が出る（隠し探しの手がかり）',
  },
  {
    idea: 'N02', name: '地図が消える', status: 'done', impl: [{ kind: 'anomaly', id: 'mapErase' }, { kind: 'part', id: 'mapFx' }, { kind: 'client', id: 'client/map/MapModel.ts（erase）' }],
    note: '扉を開けると壁一面と床に白紙が散らばる部屋（紙擦れの音）。入った瞬間に自分の地図が明滅して消える（今いる部屋のほか全部 / 半分 / 遠くの部屋。調整表 map.erase.*）。調べた記録と足跡は残り、もう一度見ると戻る。v1 MapErase の発展',
  },
  {
    idea: 'N03', name: '地図が回る', status: 'done', impl: [{ kind: 'anomaly', id: 'mapRotate' }, { kind: 'part', id: 'mapFx' }, { kind: 'client', id: 'client/map/MapModel.ts（rotation）' }],
    note: '床に大きな方位盤。盤の北の赤い矢印が本当の北から 90〜270° ずれている（規則が見て分かる）。中にいる間は地図がその角度へ回ってゆれ、出ても 30 秒は回ったまま（地図を信じて歩くと逆へ行く）。小さな地図の N の印も回る。v1 MapRotation の発展',
  },
  {
    idea: 'N04', name: '現在地の看板', status: 'done', impl: [{ kind: 'part', id: 'mapBoard' }, { kind: 'client', id: 'core/gen/gimmicks/map/signs.ts（here）' }, { kind: 'view', id: 'mapBoard' }],
    note: '廊下・曲がり角・広間の壁に、まわりの地図の看板。赤い「現在地」の丸が自分のいない場所を指す。指す先は、誰かの地図が落ちている所 → 隠しのある部屋 → 遠くの部屋（嘘の先に何かがある。確かめに行く楽しさ）。調べると「現在地？」ごと自分の地図に写る',
  },
  {
    idea: 'N05', name: 'ランドマーク', status: 'done', impl: [{ kind: 'gimmick', id: 'fogTower' }, { kind: 'part', id: 'landmark' }, { kind: 'view', id: 'landmark' }],
    note: '霧の中の塔: 部屋まるごとが濃い霧（5.5 m 先が見えない）で、背の高い仕切りと柱が立ち並ぶ。出口の近くの塔の赤い灯りだけが霧を通して明滅して見え、それを目印に歩く。失敗は迷うこと（時間）。隠し（landmark.away）は塔から離れて霧のいちばん奥へ行く（存在型 = 霧に隠れた扉 / 出現型 = 8 秒いると開く）。塔は地図に ▲。裏のフロアは霧が調子で上書きされるので表だけ',
  },
  {
    idea: 'N06', name: '足跡で帰る', status: 'done', impl: [{ kind: 'client', id: 'client/map/MapModel.ts（trail）' }, { kind: 'client', id: 'client/map/draw.ts' }],
    note: '歩いた跡を 1.2 m ごとに点で地図に残す（新しいほど濃い）。地図が消える部屋（N02）でも足跡は残るので、足跡をたどって帰れる。世界の床に残る足跡は ground の G12',
  },
  {
    idea: 'N07', name: 'フロア案内図', status: 'done', impl: [{ kind: 'part', id: 'mapBoard' }, { kind: 'client', id: 'core/gen/gimmicks/map/signs.ts（guide）' }, { kind: 'view', id: 'mapBoard' }],
    note: '入口の部屋の壁の案内図。廊下・広間・階段・出口だけを描く（部屋は扉の向こうの楽しみに残す）。調べると点線の写しが自分の地図に入る。一部だけ嘘: 隠し場所に部屋を描く（あるはずの部屋が無い → 隠しの手がかり）/ 出口の印が別の部屋 / 無い廊下 / 描かれない廊下（重み map.guide.lie.*）',
  },
  {
    idea: 'N08', name: '地図にない部屋', status: 'done', impl: [{ kind: 'anomaly', id: 'unmapped' }, { kind: 'part', id: 'mapFx' }, { kind: 'client', id: 'client/map/MapInfo.ts（hidden）' }],
    note: '家具も音も無い真っ白な空き部屋（v1 M02 未記録室）。入っても見ても地図に残らず、中にいる間の小さな地図は「NO DATA」。調査率にも数えない。地図を見返すと、そこだけ空いている。区画の地図の情報 CellLayout.map.hidden でも同じに扱う',
  },
  {
    idea: 'N09', name: '他人の地図', status: 'done', impl: [{ kind: 'part', id: 'mapNote' }, { kind: 'client', id: 'core/gen/gimmicks/map/signs.ts（note）' }, { kind: 'view', id: 'mapNote' }],
    note: '脇道の部屋の床に落ちている、作り置きの「誰か」（K. など）の地図。調べると、誰かが歩いた範囲・歩いた跡・書き込み（出口・落ちた・ここで迷った・壁の向こうから音がする = 隠しの手がかり）が赤鉛筆で自分の地図に写る。書き込みの 1 つは勘違いのことがある。書き込みの形（marks / trail / cells / author / date）は非同期マルチプレイの他人の地図と同じにした。持ち運ぶ仕組み（carry）とは後でつなぐ（いまは調べると読める）',
  },
  {
    idea: 'BX04', name: '地図の空白の場所の壁', status: 'done', impl: [{ kind: 'gimmick', id: 'mapBlank' }, { kind: 'part', id: 'mapWall' }, { kind: 'part', id: 'mapBoard' }, { kind: 'secret', id: 'map.blank' }],
    note: '測量室: 壁一面の図面と、真ん中の製図台の地図。地図のこの部屋の壁の向こうだけが白く抜けていて（自分の地図でも、この部屋を見ると白い空白が出る）、壁に 1 枚だけ白紙。空白の壁の前で立ち止まる / 白紙を調べると壁が扉になる（出現型）。存在型は壁と同じ色の扉。隠しが無いと成り立たないので必ず隠しを付ける',
  },
];
