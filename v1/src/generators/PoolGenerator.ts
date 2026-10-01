/** PoolGenerator（PoolCorridor: R01 浅水タイル回廊）。
 *  幅 3〜12 m のタイル回廊を 直線 / L / Z / U / T / 十字 の折れで作り（曲率の近似。斜め・円弧は作らない）、
 *  水路交差点（T / cross の腕の末端）と主線の末端に出口ソケットを置く（connectionRule「水路交差点に出口」）。
 *  床は y = 0 のタイルのまま。水面・水深・kind 'water' ゾーンは同じ部屋に付く ShallowWater Modifier が敷く
 *  （Generator は歩道デッキ・手すり・柱列・低い仕切り・排水溝・レーンライン・タイル色帯だけを作り、Modifier が無くても
 *  「水を抜いたプール回廊」として成立する）。Hole 落下先（ROOMLIKE）には使わない。growToFill の対象外（mainRect は読まない）。
 *
 *  バリアント 18 = 形状 6 種（cross / T / U / Z / L / straight。面積の大きい順）× 長さ 3 段（28 / 18 / 12 m。幅の上限 12 / 8 / 5 m）。
 *  0 が最大で、WorldManager が大 → 小に試す。幅・高さ・色帯などは seed 共有（variant で変わらない）。 */
import type { Socket } from '../core/types';
import { buildShell, footprintAABB, rectArea } from './footprint';
import { clearDoorways, dropRemovedHole, labelAtEntry, lightGrid, makeEntry, placeExits, placeHole } from './common';
import { bonusExits, emptyLayout, snap, type GenParams, type MatId, type Palette, type RoomLayout } from './layout';
import { chainPath, endSocket, poolPlan, type PoolShape } from './PoolGenerator.shapes';
import { decoratePool, type PoolStyle } from './PoolGenerator.decor';

/** バリアント数（WorldManager が 0..n-1 を大きい順に試す） */
export const variants = 18;

/** 形状（面積の大きい順） */
const SHAPES: PoolShape[] = ['cross', 'T', 'U', 'Z', 'L', 'straight'];
/** 長さの段（総延長 m と幅の上限 m） */
const TIERS: { len: number; wCap: number }[] = [
  { len: 28, wCap: 12 },
  { len: 18, wCap: 8 },
  { len: 12, wCap: 5 },
];

/** ShallowWater の水深（R01 params.depth）。サイン表示に使うだけで、水面そのものは Modifier が敷く */
function waterDepthOf(p: GenParams): number {
  const m = p.def.modifiers.find((x) => x.id === 'ShallowWater');
  const d = m?.params && typeof (m.params as Record<string, unknown>).depth === 'number' ? ((m.params as Record<string, unknown>).depth as number) : 0.25;
  return Math.min(1.5, Math.max(0.05, d));
}

export function generatePool(p: GenParams): RoomLayout {
  const { rng, palette } = p;
  // パレット: タイル床・タイル壁・白天井・金属扉。照明は lightingPreset 由来（拡散白色）をそのまま使う
  const pal: Palette = { ...palette, floor: 'floorTile', wall: 'floorTile', ceiling: 'ceilingWhite', door: 'doorMetal', ambient: 0x88a0a6, fog: 0x0b1418 };
  const L = emptyLayout(pal);

  // ---- seed 共有（バリアントに依存しない）
  // 幅は整数 m（原点中心の ±w/2 が 0.5 m グリッドに乗る。腕幅も整数）
  const baseW = Math.round(rng.float(3, 12));
  const h = rng.pick([3.4, 3.8, 4.2]);
  const bandMat: MatId = rng.pick(['wallGreen', 'wallDark', 'trim'] as MatId[]);
  const columnMat: MatId = rng.chance(0.5) ? 'floorTile' : 'columnConcrete';
  const dividerMat: MatId = rng.chance(0.5) ? bandMat : 'floorTile';
  const style: PoolStyle = { bandMat, columnMat, dividerMat, depth: waterDepthOf(p) };

  // ---- バリアント固有
  const tier = TIERS[Math.floor(p.variant / SHAPES.length) % TIERS.length];
  const shape = SHAPES[p.variant % SHAPES.length];
  const vr = rng.fork(`v${p.variant}`);
  const w = Math.max(3, Math.min(baseW, tier.wCap));
  const total = snap(tier.len * vr.float(0.9, 1.1));
  const plan = poolPlan(vr, shape, total, w);
  const rects = plan.segs.map((s) => s.rect);
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  const area = rects.reduce((a, r) => a + rectArea(r), 0);

  // ---- ソケット: 入口（南辺中央）+ 主線末端 + 腕の末端（水路交差点の出口）+ 直結 + 側面
  const { entry, ceilingHole } = makeEntry(p, rects[0], 0, h);
  const mains = plan.segs.filter((s) => s.role === 'main');
  const arms = plan.segs.filter((s) => s.role === 'arm');
  const fixed: Socket[] = [endSocket('end', mains[mains.length - 1]), ...arms.map((a, i) => endSocket(`arm${i}`, a))];
  let sockets: Socket[] = [entry, ...fixed, ...p.extraSockets];
  const sideWanted = Math.max(0, Math.min(2, p.exits + bonusExits(area) - fixed.length));
  sockets.push(...placeExits(rects, sockets, vr, { count: sideWanted, minGap: 3.5 }, 'side'));
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));

  // 床穴（低確率。判定・配置は専用 fork で vr の消費量を変えない）
  const hr = vr.fork('hole');
  const wantHole = p.allowHole && hr.chance(0.05);
  if (p.holeLocal || wantHole) {
    const hole = placeHole(rects, sockets, hr, p.holeLocal);
    if (hole) {
      L.holes.push(hole.hole);
      sockets.push(hole.socket);
    }
  }
  L.sockets = sockets;
  dropRemovedHole(L, p);
  sockets = L.sockets;

  // ---- シェル（タイル床・タイル壁・白天井）
  buildShell(L.boxes, rects, h, sockets, {
    floor: pal.floor, wall: pal.wall, ceiling: pal.ceiling, floorHoles: L.holes, ceilingHoles: ceilingHole ? [ceilingHole] : [],
  });
  const shellCount = L.boxes.length;
  L.shellCount = shellCount;

  // ---- 内装（デッキ・手すり・柱・仕切り・排水溝・色帯・サイン）→ 扉前を空ける
  decoratePool(L, plan, sockets, h, vr, style);
  clearDoorways(L, sockets, shellCount);

  // ---- 照明: 拡散白色のパネルを 4 m 間隔
  const dim = /一部消灯|低照度|暗/.test(p.def.lightingPreset) ? 0.3 : 0.04;
  lightGrid(L, rects, h, 4, dim, vr, pal.light, pal.lightColor, pal.lightIntensity, area > 200 ? 4 : 3);

  // ---- 進行軸・薄い水蒸気・ラベル
  const endS = sockets.find((s) => s.id === 'end') ?? null;
  L.path = chainPath(plan.segs, w, endS);
  const mistCount = Math.min(100, Math.max(30, Math.round(area * 0.15)));
  // 発生領域は主線の最初の矩形（bounds 全体だと L / T の外側の空間にも粒が出る）
  const r0 = rects[0];
  const mistBox = { min: [r0.x0, 0.0, r0.z0] as [number, number, number], max: [r0.x1, 0.8, r0.z1] as [number, number, number] };
  const mistVol = Math.max(1, (mistBox.max[0] - mistBox.min[0]) * 0.8 * (mistBox.max[2] - mistBox.min[2]));
  L.particles = { type: 'mist', density: mistCount / mistVol, aabb: mistBox, size: 2.0, color: 0xcfe3ea };
  labelAtEntry(L, entry, Math.min(w - 0.4, 2.4), p.label);
  return L;
}
