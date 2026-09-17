/** StreetGenerator（StreetGrid: R04 / L01 / L10 / L17 / L20、RoadGraph: L15）。
 *
 *  屋外風の屋内街区（StreetGrid）と屋内高速道路のジャンクション（RoadGraph）。実装は補助ファイルに分ける:
 *  - StreetGenerator.grid.ts   … 街路格子 + 島ブロック（建物ファサード / 団地 / パビリオン）+ 街灯・車・路面標示。zones 'theme'（L20）
 *  - StreetGenerator.road.ts   … 本線 + T 字ランプ + 立体ランプ（上階出口）+ 車線 zones 'lane'（ExternalForce が受ける）+ 標識 signs
 *  - StreetGenerator.facade.ts … 面に貼る窓帯・偽扉・外装板・看板、街灯、車、白線、段、手すりの純データ生成
 *
 *  共通の約束: footprint 単一矩形（RoadGraph は矩形連結）、buildShell で外殻 → L.shellCount、出口は外壁上（街路端 'street' / 玄関 'door' / 'ramp'）、
 *  上階出口は pos[1] = 3.6 のソケット（buildShell の Opening.y 対応）。天井は暗い高天井 'ceilingDark'（FakeSky が L.palette.ceiling を見て空に差し替える）。
 *  L.chunkSize = 32（RoomBuilder のチャンク分割）。バリアント 0 = 最大（64 m / 本線 70 m）で 6 段。Hole 落下先（ROOMLIKE）として天井穴入口に対応。 */
import type { GenParams, RoomLayout } from './layout';
import { generateStreetGrid } from './StreetGenerator.grid';
import { generateRoadGraph } from './StreetGenerator.road';

/** バリアント数（WorldManager が 0..n-1 を大きい順に試す）: StreetGrid 64/48/40/32/24/20 m、RoadGraph 本線 70/56/44/36/28/22 m */
export const variants = 6;

export function generateStreet(p: GenParams): RoomLayout {
  if (p.template.id === 'RoadGraph' || p.def.baseTemplate === 'RoadGraph') return generateRoadGraph(p);
  return generateStreetGrid(p);
}
