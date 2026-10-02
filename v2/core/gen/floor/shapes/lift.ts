/**
 * エレベーターホール（F24。style 'lobby'）: どの階もホールの奥の壁に 2 基のエレベーター。かごは各階の同じ場所にある小さな区画
 * （上下に重なる）。かごの中のボタンを押すと扉が閉まり、しばらく揺れて、次の階（1 つ下。いちばん下からは上へ）のかごに着く。
 * 移るのは継ぎ目の無い移動（同じ形のかごどうし）。部品は core/sim/parts/structure/lift.ts（shaftLift）。
 * 歩く人（試験）と、乗らない人のために、階段室も別にある（patterns.ts）。
 */
import type { Rng } from '../../../math/rng.ts';
import { opening, portal, portalAabb } from '../../../world/build.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_H, WALL_T, type EntitySpec } from '../../../world/layout.ts';
import type { Skeleton } from '../skeleton.ts';
import { aabbJson, snap, type GeoBuild, type Placed } from '../geometry.ts';
import type { StyleEnv } from './styles.ts';

/** かごの寸法（内側 + 壁） */
const CAR_W = 2.0, CAR_D = 2.2, CAR_H = 2.45, CAR_DOOR = 0.95;

interface Shaft { id: string; x: number; stops: { y: number; cell: string; hall: string; door: string; button: string; aabb: EntitySpec['params'][string]; zIn: number; zOut: number }[] }

/** フロアのエレベーター（かごの列ごと。階をまたいで集めてから部品を作る） */
const SHAFTS = new WeakMap<GeoBuild, Map<number, Shaft>>();

export function addLift(g: GeoBuild, pl: Placed, _sk: Skeleton, _placed: Map<number, Placed>, _e: StyleEnv, _rng: Rng): void {
  g.reserved.add(pl.cellId);
  pl.opts = { ...(pl.opts ?? {}), name: 'エレベーターホール', role: 'landmark' };
  pl.theme = pl.fam.halls.some(([th]) => th === 'AtriumLobby') ? 'AtriumLobby' : pl.theme;
  // ホールの奥（-z）の帯をかごにする
  const r = pl.rect;
  const back = r.z0;
  pl.rect = { ...r, z0: snap(back + CAR_D + 0.2) };
  const cx = (r.x0 + r.x1) / 2;
  let shafts = SHAFTS.get(g);
  if (!shafts) {
    shafts = new Map();
    SHAFTS.set(g, shafts);
    g.finishers.push((gb) => finishLifts(gb, SHAFTS.get(gb)!));
  }
  for (const k of [0, 1]) {
    const x = snap(cx + (k === 0 ? -1 : 1) * (CAR_W / 2 + 0.35));
    const car: Rect = { x0: snap(x - CAR_W / 2), x1: snap(x + CAR_W / 2), z0: snap(back + 0.2), z1: pl.rect.z0 };
    const id = `${pl.cellId}car${k}`;
    const cp: Placed = {
      node: { ...pl.node, id: -1, kind: 'room' }, rect: car, y: pl.y, height: CAR_H, theme: 'ElevatorCar', kind: 'room', cellId: id, fam: pl.fam,
      opts: { name: 'エレベーター', role: 'side', audio: '空調', lightSpacing: 1.6, palette: { floor: 'floorTile', wall: 'stainless', ceiling: 'paintWhite', door: 'stainless', light: 'lightPanel', lightColor: 0xf2f4ff, lightIntensity: 0.9 } },
    };
    g.cell(cp);
    g.reserved.add(id);
    g.keep(id, { min: [car.x0, pl.y - 0.1, car.z0], max: [car.x1, pl.y + CAR_H, car.z1] });
    // かごとホールの間の扉（部品の出力で開け閉めする。ふだんは開いている）
    const pos: [number, number, number] = [x, pl.y, car.z1];
    g.addOpening(id, opening(`${id}:hall`, pos, 0, CAR_DOOR, DOOR_H));
    g.addOpening(pl.cellId, opening(`${pl.cellId}:${id}`, pos, 2, CAR_DOOR, DOOR_H));
    const doorId = `door:${id}`;
    const liftId = `lift:${pl.node.col}.${pl.node.row}.${k}`;
    g.door(doorId, 'z', car.z1, x, pl.y, { cell: id, mat: 'stainless', swing: 1, hinge: 1, startOpen: true, autoCloseSec: 0 }, CAR_DOOR, DOOR_H);
    g.out.portals.push(portal(`p:${pl.cellId}:${id}`, pl.cellId, id, portalAabb('z', car.z1, x, CAR_DOOR, pl.y, DOOR_H), 2, 'door', doorId));
    // かごの中のボタン（扉の脇の壁）
    const bx = x + CAR_DOOR / 2 + 0.25;
    const btn = { min: [bx - 0.08, pl.y + 1.05, car.z1 - WALL_T - 0.04], max: [bx + 0.08, pl.y + 1.3, car.z1 - WALL_T] } as const;
    const buttonId = `${liftId}.button${pl.node.story}`;
    g.out.entities.push({ id: buttonId, type: 'button', cell: id, params: { box: aabbJson({ min: [...btn.min], max: [...btn.max] }) } });
    g.addBox(id, box([...btn.min], [...btn.max], 'neonBlue', false));
    // 階の表示（扉の上の帯。色だけ。階ごとに違う色）
    const tint = (['neonBlue', 'lightGreen', 'neonRed', 'lightYellow'] as const)[pl.node.story % 4]!;
    g.addBox(id, box([x - 0.3, pl.y + DOOR_H + 0.08, car.z1 - WALL_T - 0.02], [x + 0.3, pl.y + DOOR_H + 0.18, car.z1 - WALL_T], tint, false));
    g.addBox(pl.cellId, box([x - 0.3, pl.y + DOOR_H + 0.08, car.z1 + WALL_T], [x + 0.3, pl.y + DOOR_H + 0.18, car.z1 + WALL_T + 0.02], tint, false));
    const sh = shafts.get(k) ?? { id: liftId, x, stops: [] };
    sh.stops.push({ y: pl.y, cell: id, hall: pl.cellId, zIn: car.z1 - WALL_T - 0.035, zOut: car.z1 + WALL_T + 0.035, door: doorId, button: buttonId, aabb: aabbJson({ min: [car.x0 + WALL_T, pl.y - 0.1, car.z0 + WALL_T], max: [car.x1 - WALL_T, pl.y + CAR_H - 0.1, car.z1 - WALL_T] }) });
    shafts.set(k, sh);
  }
}

/** エレベーターの部品（かごの列ごと）: 上の階から順に止まる所。ボタンの配線 */
function finishLifts(g: GeoBuild, shafts: Map<number, Shaft>): void {
  for (const sh of shafts.values()) {
    if (sh.stops.length < 2) continue;
    sh.stops.sort((a, b) => b.y - a.y);
    const liftId = sh.id;
    // 扉は、上から何番目の止まる所かの出力に従う
    sh.stops.forEach((s, i) => { const d = g.out.entities.find((e) => e.id === s.door); if (d) d.inputs = { open: `${liftId}.open${i}` }; });
    const inputs: NonNullable<EntitySpec['inputs']> = {};
    sh.stops.forEach((s, i) => { inputs[`call${i}`] = `${s.button}.pressed`; });
    // 階の表示（扉の上の色の帯の前に、上から 1・2・3 … の数字。かごの中と、ホールの側）
    const sy = (y: number): number => y + DOOR_H + 0.13;
    sh.stops.forEach((s, i) => {
      const label = `${i + 1}`;
      g.out.entities.push({ id: `${s.cell}:signIn`, type: 'liftSign', cell: s.cell, params: { label, pos: [sh.x, sy(s.y), s.zIn], facing: -1 } });
      g.out.entities.push({ id: `${s.cell}:signOut`, type: 'liftSign', cell: s.hall, params: { label, pos: [sh.x, sy(s.y), s.zOut], facing: 1 } });
    });
    g.out.entities.push({
      id: liftId, type: 'shaftLift', cell: sh.stops[0]!.cell,
      params: { stops: sh.stops.map((s) => ({ y: s.y, aabb: s.aabb })), closeSec: g.t['structure.elevator.closeSec'], rideSec: g.t['structure.elevator.rideSec'] },
      inputs,
    });
  }
}
