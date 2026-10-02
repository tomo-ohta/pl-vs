/**
 * 駅のホームと車両（F35。style 'platform'。v1 VehicleRide の発展）。
 *
 * - ホーム（広間）の奥の帯が線路。真ん中に車両が止まっている（車両は穴の区画: 中は座席の並ぶ部屋。外壁は車体の色）。
 *   線路の帯の車両の外は溝（1.1 m 下。両端に上がる段）。ホームの両端の壁に、トンネルの黒い口
 * - 車両に乗ってしばらくすると扉が閉まり、窓の外を灯りが流れる（client/views/structure/train.ts）。着くと次のフロア（隣の駅）へ
 *   （FloorExit 'train'。次のフロアも駅なら、その車両の中に着く: 部品の params.arrive）
 * - 部品は core/sim/parts/structure/train.ts（trainRide）
 */
import type { Rng } from '../../../math/rng.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type Box } from '../../../world/layout.ts';
import type { Skeleton } from '../skeleton.ts';
import { aabbJson, snap, type GeoBuild, type Placed } from '../geometry.ts';
import { carveInner, holeJoin, holeWindow, type StyleEnv } from './styles.ts';
import { isStation, stationContinues } from '../profile.ts';

const CAR_DEPTH = 3.2, CAR_H = 2.35, TRENCH = 1.1;

export function addTrain(g: GeoBuild, pl: Placed, _sk: Skeleton, _e: StyleEnv, rng: Rng): void {
  const t = g.t;
  g.reserved.add(pl.cellId);
  pl.theme = 'Terminal';
  pl.height = Math.max(pl.height, 4.2);
  pl.opts = { ...(pl.opts ?? {}), name: 'ホーム', role: 'landmark', audio: '換気・遠い列車音' };
  const r = pl.rect;
  const y = pl.y;
  const len = snap(Math.min(16, r.x1 - r.x0 - 7));
  const cx = snap((r.x0 + r.x1) / 2 + rng.float(-1, 1) * Math.max(0, (r.x1 - r.x0 - len) / 2 - 3.5));
  const car: Rect = { x0: snap(cx - len / 2), x1: snap(cx + len / 2), z0: r.z0, z1: snap(r.z0 + CAR_DEPTH) };
  const inner = carveInner(g, pl, car, { node: { ...pl.node, id: -1, kind: 'room' }, y, height: CAR_H, theme: 'Train', kind: 'room', cellId: `${pl.cellId}car`, fam: pl.fam, opts: { name: '車両', role: 'side', audio: '換気・遠い列車音', lightSpacing: 2.0, palette: { floor: 'floorLino', wall: 'paintWhite', ceiling: 'paintWhite', door: 'stainless', light: 'lightPanel', lightColor: 0xeef2ff, lightIntensity: 1.0 } } }, 'carPaint');
  g.reserved.add(inner.cellId);
  g.keep(inner.cellId, { min: [car.x0, y - 0.1, car.z0], max: [car.x1, y + CAR_H, car.z1] });
  // 扉（ホームの側に 2 つ）と、扉の間の窓
  const doorAt = [snap(car.x0 + len * 0.25), snap(car.x1 - len * 0.25)];
  const rideId = `${pl.cellId}.train`;
  const doors: string[] = [];
  for (const [i, at] of doorAt.entries()) {
    const id = holeJoin(g, pl, inner, 0, at, y, { mat: 'stainless', id: `door:${inner.cellId}:${i}`, startOpen: false })!;
    doors.push(id);
  }
  for (const at of [car.x0 + len * 0.08 + 0.6, (doorAt[0]! + doorAt[1]!) / 2, car.x1 - len * 0.08 - 0.6]) holeWindow(g, pl, inner, 0, snap(at), y, 1.4, 0.85, 0.9);
  // 部品: 乗って dwellSec で扉が閉まり、rideSec で次の駅へ
  const interior = { min: [car.x0 + WALL_T, y - 0.1, car.z0 + WALL_T], max: [car.x1 - WALL_T, y + CAR_H - 0.1, car.z1 - WALL_T] };
  const exitAt: [number, number, number] = [cx, y - 3.0, (car.z0 + car.z1) / 2];
  // 線の終わりの駅（次の深さは駅でない）: 車両は終点で止まったまま（扉は開いたまま・走らない）。乗っても次の駅へ行かない
  // （次のフロアのふつうの入口に出てしまうので）。見本の ?shape=station（線の外の駅）は走る
  const key = g.p.key;
  const terminal = isStation(key.world, key.depth, t) && !stationContinues(key.world, key.depth, t);
  g.out.entities.push({
    id: rideId, type: 'trainRide', cell: inner.cellId,
    params: {
      aabb: aabbJson(interior as { min: [number, number, number]; max: [number, number, number] }), dwellSec: t['structure.station.dwellSec'], rideSec: t['structure.station.rideSec'], closeSec: 1.2, arriveSec: 2.5,
      exit: [...exitAt], arrive: { pos: [cx, y + 0.02, (car.z0 + car.z1) / 2 + 0.3], yaw: Math.PI },
      windows: { x0: car.x0, x1: car.x1, z: car.z0 - 0.6, y0: y + 0.9, y1: y + 1.9 },
      ...(terminal ? { terminal: true, sign: [cx, y + CAR_H - 0.25, car.z1 + WALL_T + 0.03] } : {}),
    },
  });
  for (const d of doors) { const e = g.out.entities.find((x) => x.id === d); if (e) e.inputs = { open: `${rideId}.open` }; }
  if (!terminal) g.out.exits.push({ id: 'train', kind: 'door', aabb: { min: [exitAt[0] - 0.8, exitAt[1] - 1.5, exitAt[2] - 0.8], max: [exitAt[0] + 0.8, exitAt[1] + 0.6, exitAt[2] + 0.8] }, to: { floor: `${g.p.key.depth + 1}.0`, exitId: 'train' } });
  // 車両の中: 奥の壁沿いの座席・つり革の棒・奥の窓（外は暗いトンネル）
  (inner.post ??= []).push((cell) => {
    const z0 = car.z0 + WALL_T;
    for (let x = car.x0 + 0.6; x + 1.6 < car.x1 - 0.4; x += 2.2) {
      cell.boxes.push(box([x, y, z0], [x + 1.6, y + 0.45, z0 + 0.5], 'seatBlue'));
      cell.boxes.push(box([x, y + 0.45, z0], [x + 1.6, y + 0.9, z0 + 0.1], 'seatBlue'));
    }
    for (let x = car.x0 + 1.4; x < car.x1 - 1; x += 2.6) cell.boxes.push(box([x - 0.02, y, car.z1 - 1.1], [x + 0.02, y + CAR_H, car.z1 - 1.06], 'stainless', false));
    // 奥の壁の窓（ガラス。外は暗い）
    for (let x = car.x0 + 1.0; x + 1.2 < car.x1 - 0.6; x += 2.2) cell.boxes.push(box([x, y + 0.95, car.z0 - 0.01], [x + 1.2, y + 1.75, car.z0 + 0.02], 'windowDark', false));
  });
  // 線路の溝（車両の外の帯）: 床を外し、溝の底・レール・ホームの縁・両端の段・トンネルの口
  (pl.post ??= []).push((cell) => {
    const trench: Rect[] = [{ x0: r.x0, x1: car.x0, z0: car.z0, z1: car.z1 }, { x0: car.x1, x1: r.x1, z0: car.z0, z1: car.z1 }];
    const B: Box[] = [];
    cell.boxes = cell.boxes.filter((b) => !(b.solid && Math.abs(b.max[1] - y) < 1e-3 && b.max[1] - b.min[1] <= 0.25 && trench.some((q) => b.min[0] >= q.x0 - 1e-3 && b.max[0] <= q.x1 + 1e-3 && b.min[2] >= q.z0 - 1e-3 && b.max[2] <= q.z1 + 1e-3)));
    for (const q of trench) {
      if (q.x1 - q.x0 < 0.5) continue;
      B.push(box([q.x0, y - TRENCH - 0.2, q.z0], [q.x1, y - TRENCH, q.z1], 'floorConcrete'));
      for (const rz of [q.z0 + 0.9, q.z1 - 0.9]) B.push(box([q.x0, y - TRENCH, rz - 0.04], [q.x1, y - TRENCH + 0.14, rz + 0.04], 'metalDark', false));
      // 溝の外まわりの壁（床を外した所の下）
      B.push(box([q.x0, y - TRENCH, q.z0], [q.x1, y, q.z0 + WALL_T], 'wallConcrete'));
      B.push(box([q.x0, y - TRENCH, q.z1 - 0.02], [q.x1, y, q.z1], 'wallConcrete'));
      const endX = q.x0 < car.x0 ? q.x0 : q.x1;
      B.push(endX === q.x0 ? box([q.x0, y - TRENCH, q.z0], [q.x0 + WALL_T, y, q.z1], 'wallConcrete') : box([q.x1 - WALL_T, y - TRENCH, q.z0], [q.x1, y, q.z1], 'wallConcrete'));
      // ホームの縁の黄色い線
      B.push(box([q.x0, y, q.z1], [q.x1, y + 0.005, q.z1 + 0.3], 'yellowLine', false));
      // 溝から上がる段（端の壁際）
      const sx = endX === q.x0 ? q.x0 + WALL_T : q.x1 - WALL_T - 0.9;
      for (let i = 0; i < 4; i++) B.push(box([sx, y - TRENCH, q.z1 - 0.3 - (4 - i) * 0.3], [sx + 0.9, y - TRENCH + (i + 1) * (TRENCH / 4), q.z1 - 0.3 - (3 - i) * 0.3], 'columnConcrete'));
      // トンネルの口（端の壁の黒い四角）
      B.push(endX === q.x0 ? box([q.x0 + WALL_T, y - TRENCH, q.z0 + 0.2], [q.x0 + WALL_T + 0.02, y + 2.6, q.z1 - 0.2], 'void', false) : box([q.x1 - WALL_T - 0.02, y - TRENCH, q.z0 + 0.2], [q.x1 - WALL_T, y + 2.6, q.z1 - 0.2], 'void', false));
    }
    cell.boxes.push(...B);
    // 外形を溝の底まで広げる（外形の外の箱は、焼き込みの照明と見える範囲の外になる）
    const cb = cell.bounds;
    cell.bounds = { min: [cb.min[0], Math.min(cb.min[1], ...B.map((b) => b.min[1])), cb.min[2]], max: [cb.max[0], cb.max[1], cb.max[2]] };
  });
}
