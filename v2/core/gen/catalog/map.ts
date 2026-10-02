/**
 * 案の台帳・地図と道案内・図鑑・調査率（docs/stage4-workstreams.md）。この担当だけがこのファイルを書き換える。
 * 受け持つ案の番号は index.ts の OWNERS。書き方は types.ts。
 */
import type { CatalogEntry } from './types.ts';

const WIP = '作業中（段階 4 の map の担当が作る）';

export const MAP_CATALOG: CatalogEntry[] = [
  { idea: 'N01', name: '調査率', status: 'deferred', impl: [], note: WIP },
  { idea: 'N02', name: '地図が消える', status: 'deferred', impl: [], note: WIP },
  { idea: 'N03', name: '地図が回る', status: 'deferred', impl: [], note: WIP },
  { idea: 'N04', name: '現在地の看板', status: 'deferred', impl: [], note: WIP },
  { idea: 'N05', name: 'ランドマーク', status: 'deferred', impl: [], note: WIP },
  { idea: 'N06', name: '足跡で帰る', status: 'deferred', impl: [], note: WIP },
  { idea: 'N07', name: 'フロア案内図', status: 'deferred', impl: [], note: WIP },
  { idea: 'N08', name: '地図にない部屋', status: 'deferred', impl: [], note: WIP },
  { idea: 'N09', name: '他人の地図', status: 'deferred', impl: [], note: WIP },
  { idea: 'BX04', name: '地図の空白の場所の壁', status: 'deferred', impl: [], note: WIP },
];
