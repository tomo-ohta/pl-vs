/** 自動挿入される前室アダプタ。
 *  - vestibule: 短い直線廊下（干渉回避・向き転回）。最短 2.0 m（ミニ前室。転回時は側面扉を中央に置く「戸袋」型）
 *  - stairs: 3.6m 上下する直階段
 *  - ramp: 3.6m 上下する緩いスロープ（低い段の階段状で近似）
 *  - elevatorCar: エレベーター籠（入口側は閉じた扉 = Seam、出口側が次の部屋への扉）
 *  - crawl: しゃがみ通路。入口側は EntryReq の width/height/sill/crawl に一致する低い開口、
 *           床は sill の高さから段（0.3 m × 2）で 0 へ、通路の内部高さ 1.2 m、反対側は通常扉 DOOR_W×DOOR_H
 *           （E03 横倒し扉の横長スロット / R16 小型扉の抜け道）
 *  - platform: 乗り物の到着ホーム（幅 4 m × 長さ 8 m）。長辺の片側に 'ride' 用の広い開口、短辺の端に通常扉
 *
 *  統合担当向け: WorldManager.layoutFor が node.entryReq から entryHeight / entrySill / entryCrawl を渡す。
 */
import type { PortalType, Socket } from '../core/types';
import type { AdapterKind } from '../core/types';
import { aabb, aabbFromCenter } from '../core/aabb';
import { box, ceiling, DOOR_H, DOOR_W, emptyLayout, socket, wallAlongX, wallAlongZ, WALL_T, WIDE_W, type Palette, type RoomLayout } from './layout';

export const FLOOR_HEIGHT = 3.6;
/** vestibule の最短長（ミニ前室） */
export const VESTIBULE_MIN_LEN = 2.0;
/** crawl 通路の長さ（低い区間）と内部高さ */
export const CRAWL_LEN = 2.4;
export const CRAWL_H = 1.2;
/** crawl 通路の出口側（通常扉が立つ全高の踊り場）の長さ */
export const CRAWL_LANDING = 1.0;
/** platform の寸法 */
export const PLATFORM_W = 4.0;
export const PLATFORM_LEN = 8.0;

export interface AdapterParams {
  kind: AdapterKind;
  entryType: PortalType;
  entryWidth: number;
  /** 入口開口の高さ（crawl / 高いスロット）。省略時は扉 DOOR_H または全高 */
  entryHeight?: number;
  /** 入口開口の下端（床から）。crawl の床はこの高さから段で 0 へ下がる */
  entrySill?: number;
  /** しゃがみ開口 */
  entryCrawl?: boolean;
  direction: 1 | -1 | 0;
  length: number;
  turn: 0 | 1 | 3;
  palette: Palette;
}

export function generateAdapter(a: AdapterParams): RoomLayout {
  const L = emptyLayout(a.palette);
  const h = 2.7;
  const sockets: Socket[] = [];

  if (a.kind === 'elevatorCar') {
    // 籠: 1.8 x 1.8。-Z 側が籠の扉（Seam。閉じた金属扉）、+Z 側が出口の扉
    const hw = 0.9;
    const hl = 0.9;
    const ch = 2.3;
    L.bounds = aabb([-hw - WALL_T, -0.2, -hl - WALL_T], [hw + WALL_T, ch + 0.4, hl + WALL_T]);
    L.height = ch;
    sockets.push(socket('entry', 'elevator', [0, 0, -hl - WALL_T], 2, 1.2, 2.2));
    sockets.push(socket('end', 'door', [0, 0, hl + WALL_T], 0));
    L.sockets = sockets;
    L.boxes.push(box([-hw - WALL_T, -0.2, -hl - WALL_T], [hw + WALL_T, 0, hl + WALL_T], 'metal'));
    L.boxes.push(box([-hw - WALL_T, ch, -hl - WALL_T], [hw + WALL_T, ch + 0.2, hl + WALL_T], 'metal'));
    L.boxes.push(box([hw, 0, -hl - WALL_T], [hw + WALL_T, ch, hl + WALL_T], 'metal'));
    L.boxes.push(box([-hw - WALL_T, 0, -hl - WALL_T], [-hw, ch, hl + WALL_T], 'metal'));
    // 入口側: 閉じた扉（ソリッド）
    L.boxes.push(box([-hw - WALL_T, 0, -hl - WALL_T], [hw + WALL_T, ch, -hl], 'doorMetal'));
    wallAlongX(L.boxes, -hw - WALL_T, hw + WALL_T, hl, 1, ch, 'metal', [{ at: 0, width: DOOR_W, height: DOOR_H }]);
    L.boxes.push(box([-0.4, ch - 0.04, -0.4], [0.4, ch - 0.005, 0.4], 'lightPanel', false));
    L.boxes.push(box([hw - 0.02, 1.0, -0.2], [hw, 1.4, 0.0], 'lightWarm', false));
    L.lights.push({ pos: [0, ch - 0.3, 0], color: 0xfff2dd, intensity: 0.6, distance: 5 });
    L.elevators.push({ socketId: 'entry', volume: aabbFromCenter(0, 1.1, 0, 0.9, 1.1, 0.9), button: [hw - 0.03, 1.2, -0.1], buttonDir: 3 });
    return L;
  }

  if (a.kind === 'crawl') return generateCrawl(a, L);
  if (a.kind === 'platform') return generatePlatform(a, L);

  const width = a.kind === 'ramp' ? 3.0 : Math.max(a.entryWidth, DOOR_W) + 1.0;
  const hw = width / 2;

  if (a.kind === 'vestibule') {
    const len = Math.max(VESTIBULE_MIN_LEN, a.length);
    const hl = len / 2;
    L.bounds = aabb([-hw - WALL_T, -0.2, -hl - WALL_T], [hw + WALL_T, h + 0.2, hl + WALL_T]);
    L.height = h;
    sockets.push(socket('entry', a.entryType, [0, 0, -hl - WALL_T], 2, a.entryWidth, a.entryType === 'door' ? DOOR_H : h - 0.3));
    // 側面扉の位置: 通常は末端から 1.0 m 手前、ミニ前室（2.5 m 以下）では中央（戸袋型）
    const sideAt = len <= 2.5 ? 0 : hl - 1.0;
    if (a.turn === 0) {
      sockets.push(socket('end', 'door', [0, 0, hl + WALL_T], 0));
    } else {
      const x = a.turn === 1 ? hw + WALL_T : -hw - WALL_T;
      sockets.push(socket('end', 'door', [x, 0, sideAt], a.turn));
    }
    L.sockets = sockets;
    L.boxes.push(box([-hw - WALL_T, -0.2, -hl - WALL_T], [hw + WALL_T, 0, hl + WALL_T], a.palette.floor));
    ceiling(L.boxes, -hw - WALL_T, -hl - WALL_T, hw + WALL_T, hl + WALL_T, h, a.palette.ceiling);
    wallAlongX(L.boxes, -hw - WALL_T, hw + WALL_T, -hl, -1, h, a.palette.wall, [{ at: 0, width: a.entryWidth, height: sockets[0].height }]);
    wallAlongX(L.boxes, -hw - WALL_T, hw + WALL_T, hl, 1, h, a.palette.wall, a.turn === 0 ? [{ at: 0, width: DOOR_W, height: DOOR_H }] : []);
    wallAlongZ(L.boxes, -hl, hl, hw, 1, h, a.palette.wall, a.turn === 1 ? [{ at: sideAt, width: DOOR_W, height: DOOR_H }] : []);
    wallAlongZ(L.boxes, -hl, hl, -hw, -1, h, a.palette.wall, a.turn === 3 ? [{ at: sideAt, width: DOOR_W, height: DOOR_H }] : []);
    L.boxes.push(box([-0.4, h - 0.04, -0.6], [0.4, h - 0.005, 0.6], a.palette.light, false));
    L.lights.push({ pos: [0, h - 0.3, 0], color: a.palette.lightColor, intensity: 0.7, distance: 8 });
    return L;
  }

  // stairs / ramp: -Z 端が入口（y=0）、+Z 端が出口（y = ±FLOOR_HEIGHT）
  const rise = FLOOR_HEIGHT;
  const stepH = a.kind === 'stairs' ? 0.18 : 0.09;
  const stepD = a.kind === 'stairs' ? 0.3 : 0.45;
  const steps = Math.ceil(rise / stepH);
  const runLen = steps * stepD;
  const landing = 1.5;
  const len = landing * 2 + runLen;
  const hl = len / 2;
  const up = a.direction >= 0;
  const yEnd = up ? rise : -rise;
  const yMin = Math.min(0, yEnd) - 0.2;
  const yMax = Math.max(0, yEnd) + h + 0.2;
  L.bounds = aabb([-hw - WALL_T, yMin, -hl - WALL_T], [hw + WALL_T, yMax, hl + WALL_T]);
  L.height = yMax - yMin;
  const openW = a.kind === 'ramp' ? WIDE_W : Math.max(a.entryWidth, DOOR_W);
  const openType: PortalType = a.kind === 'ramp' ? 'ramp' : 'stairs';
  sockets.push(socket('entry', a.entryType, [0, 0, -hl - WALL_T], 2, a.entryWidth, a.entryType === 'door' ? DOOR_H : h - 0.3));
  sockets.push(socket('end', openType, [0, yEnd, hl + WALL_T], 0, openW, h - 0.3));
  L.sockets = sockets;

  L.boxes.push(box([-hw - WALL_T, -0.2, -hl - WALL_T], [hw + WALL_T, 0, -hl + landing], a.palette.floor));
  for (let i = 0; i < steps; i++) {
    const z0 = -hl + landing + i * stepD;
    const yTop = up ? Math.min(rise, (i + 1) * stepH) : -Math.min(rise, (i + 1) * stepH);
    if (up) L.boxes.push(box([-hw, -0.2, z0], [hw, yTop, z0 + stepD], 'floorConcrete'));
    else L.boxes.push(box([-hw, yTop - 0.2, z0], [hw, yTop, z0 + stepD], 'floorConcrete'));
  }
  L.boxes.push(box([-hw - WALL_T, yEnd - 0.2, hl - landing], [hw + WALL_T, yEnd, hl + WALL_T], a.palette.floor));
  L.boxes.push(box([hw, yMin, -hl - WALL_T], [hw + WALL_T, yMax, hl + WALL_T], a.palette.wall));
  L.boxes.push(box([-hw - WALL_T, yMin, -hl - WALL_T], [-hw, yMax, hl + WALL_T], a.palette.wall));
  wallAlongX(L.boxes, -hw - WALL_T, hw + WALL_T, -hl, -1, h, a.palette.wall, [{ at: 0, width: a.entryWidth, height: sockets[0].height }]);
  // 入口壁の上部（yEnd が上なら入口壁を天井まで伸ばす）
  if (up) L.boxes.push(box([-hw - WALL_T, h, -hl - WALL_T], [hw + WALL_T, yMax, -hl], a.palette.wall));
  const endWallBoxes: typeof L.boxes = [];
  wallAlongX(endWallBoxes, -hw - WALL_T, hw + WALL_T, hl, 1, h, a.palette.wall, [{ at: 0, width: openW, height: h - 0.3 }]);
  for (const b of endWallBoxes) {
    b.min[1] += yEnd;
    b.max[1] += yEnd;
    L.boxes.push(b);
  }
  if (!up) L.boxes.push(box([-hw - WALL_T, yEnd + h, hl], [hw + WALL_T, yMax, hl + WALL_T], a.palette.wall));
  L.boxes.push(box([-hw - WALL_T, yMax - 0.2, -hl - WALL_T], [hw + WALL_T, yMax, hl + WALL_T], a.palette.ceiling));
  // 下る階段では入口側の床下も塞ぐ
  if (!up) L.boxes.push(box([-hw - WALL_T, yMin, -hl - WALL_T], [hw + WALL_T, -0.2, -hl + landing], a.palette.wall));
  L.boxes.push(box([hw - 0.06, yMin + 0.2, -hl + landing], [hw, yMax - 0.5, hl - landing], 'metal', false));
  L.lights.push({ pos: [0, Math.max(0, yEnd) + h - 0.4, 0], color: a.palette.lightColor, intensity: 0.8, distance: 10 });
  L.boxes.push(box([-0.5, yMax - 0.24, -0.6], [0.5, yMax - 0.205, 0.6], a.palette.light, false));
  return L;
}

/** しゃがみ通路。-Z 端が低い入口開口（床 = sill）、通路 CRAWL_LEN の間に段で 0 へ下り、+Z 端は全高の踊り場と通常扉 */
function generateCrawl(a: AdapterParams, L: RoomLayout): RoomLayout {
  const h = 2.7;
  const sill = Math.max(0, a.entrySill ?? 0);
  const openH = Math.max(1.0, Math.min(CRAWL_H, a.entryHeight ?? CRAWL_H));
  const entryW = Math.max(0.6, a.entryWidth);
  const width = Math.max(entryW, DOOR_W) + 0.8;
  const hw = width / 2;
  const total = CRAWL_LEN + CRAWL_LANDING;
  const z0 = 0; // 入口壁の内面
  const zCrawlEnd = z0 + CRAWL_LEN;
  const z1 = z0 + total; // 出口壁の内面
  const wall = a.palette.wall;
  const floor = a.palette.floor;
  L.bounds = aabb([-hw - WALL_T, -0.2, z0 - WALL_T], [hw + WALL_T, h + 0.2, z1 + WALL_T]);
  L.height = h;
  const entry = socket('entry', a.entryType, [0, 0, z0 - WALL_T], 2, entryW, openH);
  if (sill > 0) entry.sill = sill;
  entry.crawl = true;
  L.sockets = [entry, socket('end', 'door', [0, 0, z1 + WALL_T], 0)];

  // 床: 入口側は sill の高さ、段（0.3 m × n）で 0 へ。段はそれぞれ 0.4 m 奥行
  const stepH = 0.3;
  const steps = Math.max(0, Math.round(sill / stepH));
  const stepD = 0.4;
  let z = z0 - WALL_T;
  // 入口の敷居〜最初の段までは sill の高さの床
  const flatLen = Math.max(0.4, CRAWL_LEN - steps * stepD - 0.4);
  L.boxes.push(box([-hw - WALL_T, -0.2, z], [hw + WALL_T, sill, z + flatLen + WALL_T], floor));
  z += flatLen + WALL_T;
  for (let i = 0; i < steps; i++) {
    const top = Math.max(0, sill - stepH * (i + 1));
    L.boxes.push(box([-hw - WALL_T, -0.2, z], [hw + WALL_T, top, z + stepD], 'floorConcrete'));
    z += stepD;
  }
  L.boxes.push(box([-hw - WALL_T, -0.2, z], [hw + WALL_T, 0, z1 + WALL_T], floor));
  // 天井: 低い区間は床（sill）+ CRAWL_H、踊り場は全高
  const lowCeil = sill + CRAWL_H;
  L.boxes.push(box([-hw - WALL_T, lowCeil, z0 - WALL_T], [hw + WALL_T, h + 0.2, zCrawlEnd], a.palette.ceiling));
  ceiling(L.boxes, -hw - WALL_T, zCrawlEnd, hw + WALL_T, z1 + WALL_T, h, a.palette.ceiling);
  // 側壁
  L.boxes.push(box([hw, -0.2, z0 - WALL_T], [hw + WALL_T, h + 0.2, z1 + WALL_T], wall));
  L.boxes.push(box([-hw - WALL_T, -0.2, z0 - WALL_T], [-hw, h + 0.2, z1 + WALL_T], wall));
  // 入口壁: 開口は sill〜sill+openH。下は腰壁（sill > 0 のとき）
  wallAlongX(L.boxes, -hw - WALL_T, hw + WALL_T, z0, -1, h, wall, [{ at: 0, width: entryW, height: sill + openH }]);
  if (sill > 0) L.boxes.push(box([-entryW / 2, 0, z0 - WALL_T], [entryW / 2, sill, z0], wall));
  // 出口壁: 通常扉
  wallAlongX(L.boxes, -hw - WALL_T, hw + WALL_T, z1, 1, h, wall, [{ at: 0, width: DOOR_W, height: DOOR_H }]);
  // 照明: 低い区間は壁の足元灯、踊り場は天井灯
  L.boxes.push(box([hw - 0.03, sill + 0.3, z0 + 0.6], [hw, sill + 0.5, z0 + 1.4], a.palette.light, false));
  L.lights.push({ pos: [0, lowCeil - 0.2, (z0 + zCrawlEnd) / 2], color: a.palette.lightColor, intensity: 0.45, distance: 5 });
  L.boxes.push(box([-0.3, h - 0.04, zCrawlEnd + 0.2], [0.3, h - 0.005, z1 - 0.2], a.palette.light, false));
  L.lights.push({ pos: [0, h - 0.3, (zCrawlEnd + z1) / 2], color: a.palette.lightColor, intensity: 0.6, distance: 6 });
  return L;
}

/** 乗り物の到着ホーム。x ∈ [-2, 2]、z ∈ [0, 8]。-X 側の長辺中央に乗降口（entry。'ride' 用の広い開口）、+Z 端に通常扉（end） */
function generatePlatform(a: AdapterParams, L: RoomLayout): RoomLayout {
  const h = 3.2;
  const hw = PLATFORM_W / 2;
  const len = PLATFORM_LEN;
  const wall = a.palette.wall;
  const openW = Math.max(a.entryWidth, WIDE_W);
  const openH = a.entryHeight ?? h - 0.3;
  L.bounds = aabb([-hw - WALL_T, -0.2, -WALL_T], [hw + WALL_T, h + 0.2, len + WALL_T]);
  L.height = h;
  L.sockets = [
    socket('entry', a.entryType, [-hw - WALL_T, 0, len / 2], 3, openW, openH),
    socket('end', 'door', [0, 0, len + WALL_T], 0),
  ];
  L.boxes.push(box([-hw - WALL_T, -0.2, -WALL_T], [hw + WALL_T, 0, len + WALL_T], a.palette.floor));
  ceiling(L.boxes, -hw - WALL_T, -WALL_T, hw + WALL_T, len + WALL_T, h, a.palette.ceiling);
  // 乗降口側（-X）: 中央に広い開口。反対側（+X）は壁
  wallAlongZ(L.boxes, -WALL_T, len + WALL_T, -hw, -1, h, wall, [{ at: len / 2, width: openW, height: openH }]);
  wallAlongZ(L.boxes, -WALL_T, len + WALL_T, hw, 1, h, wall);
  // 短辺: -Z は壁、+Z は通常扉
  wallAlongX(L.boxes, -hw - WALL_T, hw + WALL_T, 0, -1, h, wall);
  wallAlongX(L.boxes, -hw - WALL_T, hw + WALL_T, len, 1, h, wall, [{ at: 0, width: DOOR_W, height: DOOR_H }]);
  // ホーム縁の黄線と待合ベンチ
  L.boxes.push(box([-hw + 0.05, 0.001, 0.3], [-hw + 0.35, 0.006, len - 0.3], 'yellowLine', false));
  L.boxes.push(box([hw - 0.6, 0, 2.0], [hw - 0.15, 0.45, 3.6], 'furnitureDark'));
  L.boxes.push(box([hw - 0.6, 0, len - 3.6], [hw - 0.15, 0.45, len - 2.0], 'furnitureDark'));
  for (const zc of [len * 0.25, len * 0.75]) {
    L.boxes.push(box([-0.6, h - 0.04, zc - 0.3], [0.6, h - 0.005, zc + 0.3], a.palette.light, false));
    L.lights.push({ pos: [0, h - 0.3, zc], color: a.palette.lightColor, intensity: 0.7, distance: 8 });
  }
  return L;
}
