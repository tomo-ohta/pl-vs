/**
 * 案の台帳・地図と道案内・図鑑・調査率（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 */
import type { CatalogEntry } from './types.ts';

const WIP = '作業中（段階 4 の map の担当が作る）';

export const MAP_CATALOG: CatalogEntry[] = [
  {
    idea: 'N01', name: '調査率', status: 'done', impl: [{ kind: 'client', id: 'client/map/MapModel.ts（survey）' }, { kind: 'client', id: 'client/ui/Minimap.ts・MapPanel.ts' }, { kind: 'client', id: 'client/map/Codex.ts（フロアの記録）' }],
    note: '区画の床を 2 m の升目に分け、歩いた所から 3 m を調べたことにする。区画は 85% で調べ終わり（隅まで歩かなくてよい）。地図では調べていない升目に影が残り、埋めていく楽しさになる。100% でフロアの記録が完成し、図鑑にそのフロアの隠しの数が出る（隠し探しの手がかり）',
  },
  { idea: 'N02', name: '地図が消える', status: 'deferred', impl: [], note: WIP },
  { idea: 'N03', name: '地図が回る', status: 'deferred', impl: [], note: WIP },
  { idea: 'N04', name: '現在地の看板', status: 'deferred', impl: [], note: WIP },
  { idea: 'N05', name: 'ランドマーク', status: 'deferred', impl: [], note: WIP },
  {
    idea: 'N06', name: '足跡で帰る', status: 'done', impl: [{ kind: 'client', id: 'client/map/MapModel.ts（trail）' }, { kind: 'client', id: 'client/map/draw.ts' }],
    note: '歩いた跡を 1.2 m ごとに点で地図に残す（新しいほど濃い）。地図が消える部屋（N02）でも足跡は残るので、足跡をたどって帰れる。世界の床に残る足跡は ground の G12',
  },
  { idea: 'N07', name: 'フロア案内図', status: 'deferred', impl: [], note: WIP },
  { idea: 'N08', name: '地図にない部屋', status: 'deferred', impl: [], note: WIP },
  { idea: 'N09', name: '他人の地図', status: 'deferred', impl: [], note: WIP },
  { idea: 'BX04', name: '地図の空白の場所の壁', status: 'deferred', impl: [], note: WIP },
];
