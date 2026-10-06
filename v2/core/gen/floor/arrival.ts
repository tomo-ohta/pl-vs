/**
 * エレベーターで着いたフロア（床と足場・装置の担当のエレベーター liftCabin で、押していない階に止まって移ったとき）:
 * 入口の階段（entryStairs）の手前をエレベーターのかごに作り替え、かごの中から始める。
 * かご: 階段の口から奥行き 2.2 m に奥の壁（階段はその向こうに隠れる）・ステンレスの壁と天井・灯り・引き戸（自動扉。中にいると開く）。
 * 区画・開口・地図は変えない（フロアの形と保存はふつうに着いたときと同じ）。入口の階段の形でないフロアでは何もしない
 */
import { WALL_T, box, type FloorLayout } from '../../world/layout.ts';

/** かごの奥行き（階段の口の壁の内側から） */
const CABIN_D = 2.2;
const CABIN_H = 2.45;

export function liftArrival(floor: FloorLayout): boolean {
  const cell = floor.cells.find((c) => c.id === 'entryStairs');
  const portal = floor.portals.find((p) => p.id === 'p:entryStairs');
  if (!cell || !portal || cell.footprint.length !== 1) return false;
  const fp = cell.footprint[0]!;
  const y = cell.floorY;
  // 口は区画の z の小さい側の壁（entryStairs: 階段は +z へ上る）
  const z0 = fp.z0, zi = z0 + WALL_T, zb = zi + CABIN_D;
  if (zb + WALL_T > fp.z1 - 0.5) return false;
  const x0 = fp.x0 + WALL_T, x1 = fp.x1 - WALL_T, cx = (portal.aabb.min[0] + portal.aabb.max[0]) / 2;
  const openW = portal.aabb.max[0] - portal.aabb.min[0], openH = portal.aabb.max[1] - portal.aabb.min[1];
  // かごの中の段・手すり・照明を外す（奥の壁の向こうの階段は残す。見えない）
  cell.boxes = cell.boxes.filter((b) => !(b.min[2] < zb + WALL_T && b.max[2] > zi + 0.01 && b.max[1] > y + 0.01 && b.min[1] < y + CABIN_H + 0.3 && (b.kind === 'stairStep' || b.kind === 'landing' || !b.solid)));
  const B = [
    // 奥の壁（天井まで）・かごの天井・床・壁の板
    box([x0, y, zb], [x1, y + cell.height, zb + WALL_T], 'stainless'),
    box([x0, y + CABIN_H, zi], [x1, y + CABIN_H + 0.08, zb], 'stainless'),
    box([x0, y, zi], [x1, y + 0.01, zb], 'metalDark', false),
    box([x0, y + 0.01, zi], [x0 + 0.02, y + CABIN_H, zb], 'stainless', false),
    box([x1 - 0.02, y + 0.01, zi], [x1, y + CABIN_H, zb], 'stainless', false),
    box([x0 + 0.02, y + 0.01, zb - 0.02], [x1 - 0.02, y + CABIN_H, zb], 'stainless', false),
    // 天井の灯り・操作盤（光る階の表示）・戸の上の欄間
    box([cx - 0.3, y + CABIN_H - 0.02, zi + 0.7], [cx + 0.3, y + CABIN_H, zi + 1.5], 'lightPanel', false),
    box([x1 - 0.04, y + 0.95, zi + 0.25], [x1 - 0.02, y + 1.45, zi + 0.5], 'metalDark', false),
    box([x1 - 0.045, y + 1.32, zi + 0.3], [x1 - 0.04, y + 1.4, zi + 0.45], 'screenLcd', false),
    box([portal.aabb.min[0], y + Math.min(2.1, openH), z0], [portal.aabb.max[0], y + openH, zi], 'stainless'),
  ];
  cell.boxes.push(...B);
  cell.lights.push({ pos: [cx, y + CABIN_H - 0.25, zi + CABIN_D / 2], color: 0xf4f0e6, intensity: 0.6, distance: 4 });
  // 引き戸（自動扉）: かごの中か戸の前に人がいると開く
  floor.entities.push({
    id: 'arrival:door', type: 'autoDoor', cell: cell.id,
    params: {
      panel: { min: [cx - openW / 2, y, z0 + 0.05], max: [cx + openW / 2, y + Math.min(2.1, openH), z0 + 0.1] },
      sensor: { min: [x0, y - 0.2, z0 - 1.4], max: [x1, y + 2, zb] },
      slide: [1, 0, 0], mat: 'stainless', flaky: 0,
    },
  });
  // かごの中から、戸の方を向いて始める
  floor.spawn = { pos: [cx, y + 0.02, zi + CABIN_D * 0.55], yaw: 0, cell: cell.id };
  return true;
}
