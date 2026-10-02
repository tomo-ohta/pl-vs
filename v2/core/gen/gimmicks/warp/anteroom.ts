/**
 * 控え室（別の空間への入口）を組む。部品は core/sim/parts/warp/anteroom.ts（warpAnteroom）。
 *
 * 仕掛けの部屋 R（入口 A・出口 B。どちらも扉）の空いた壁に 3 枚目の扉 pod を付ける。R の中身（家具）はここで置き、
 * R の真上の別の空間に双子の部屋 R' を写す（扉も同じ）。pod は「ほかの扉が全部閉じているときだけ」開き、
 * 開けた瞬間に R' へ継ぎ目なく移る。R' の pod の向こうに、仕掛けが別の空間を作る（openPod の位置と向き）。
 * 別の空間の終わりには addCopy でもう 1 つの双子の部屋 Q' を置ける（Q' の pod が別の空間の終わりの扉）。
 * R'・Q' の A・B は、R の A・B へ戻す扉（来た扉からはいつでも出られる）。
 *
 * 使い方: planAnteroom → buildAnteroom（R・R' と pod）→ 別の空間を作る → addCopy（Q'）→ finish（部品を置いて扉を配線）
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import { opening } from '../../../world/build.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type EntitySpec, type Json, type MatId, type WallOpening } from '../../../world/layout.ts';
import { plant, sofa } from '../../dress/props.ts';
import { reachOpenings } from '../../reach.ts';
import { xBox, xJson, xPoint, xVec, type Xform } from '../../../sim/parts/warp/util.ts';
import type { GimmickContext } from '../types.ts';
import { doorZone, freeWallSpan, innerRect } from '../util.ts';
import { addPocketCell, axisOf, canPocket, carveDoorway, copyCell, doorSpec, frontPoint, isBSide, joinCells, nextPocketRise, signOf, xOpening } from './pocket.ts';

export interface AnteroomPlan {
  host: CellLayout;
  /** 部屋の扉（入口が先） */
  doors: { o: WallOpening; door: EntitySpec }[];
  /** 入口の扉（doors[0]） */
  a: { o: WallOpening; door: EntitySpec };
  /** 3 枚目の扉（R の壁の外面の床位置・外向き）。pods[0] と同じ */
  pod: { pos: Vec3; dir: Dir };
  /** 足す扉の全部（count 枚。同じ壁に spacing m おき） */
  pods: { pos: Vec3; dir: Dir }[];
  rise: number;
}

export interface AnteroomOptions {
  /** pod の壁に沿った位置をこの刻みの倍数にする（双子の模様を揃える。0 なら刻まない） */
  snap?: number;
  /** pod の外向きの位置に足す値（snap と合わせて、別の空間の座標を刻みに乗せる） */
  snapOffset?: number;
  /** pod の外向き（決めるなら） */
  dir?: Dir;
  /** 足す扉の枚数（同じ壁に並べる。既定 1） */
  count?: number;
  /** 並べる扉の真ん中どうしの間隔（m） */
  spacing?: number;
}

/** 扉が付いていない開口があれば null（R の中が外から見えると、双子の部屋と見分けがつく） */
export function planAnteroom(ctx: GimmickContext, o: AnteroomOptions = {}): AnteroomPlan | null {
  if (!canPocket(ctx) || isBSide(ctx)) return null;
  const s = ctx.slot;
  if (s.kind !== 'room' || !s.entrance || s.cell.footprint.length !== 1) return null;
  const doors = s.openings.map((op) => ({ o: op, door: ctx.doorAt(op) }));
  if (doors.some((d) => !d.door) || doors.length > 4) return null;
  const a = doors.find((d) => d.o === s.entrance)!;
  const all = [a, ...doors.filter((d) => d !== a)].map((d) => ({ o: d.o, door: d.door! }));
  // pod: A から遠い壁（向かいの壁を先に）
  const order: Dir[] = o.dir !== undefined ? [o.dir] : ([((s.entrance.dir + 2) % 4) as Dir, ((s.entrance.dir + 1) % 4) as Dir, ((s.entrance.dir + 3) % 4) as Dir, s.entrance.dir]);
  const y = s.cell.floorY;
  const count = Math.max(1, o.count ?? 1), spacing = o.spacing ?? 2.4;
  const extra = (count - 1) * spacing;
  for (const d of order) {
    const span = freeWallSpan(s, d, DOOR_W + 1.2 + extra, 0.9);
    if (!span) continue;
    const lo = span.a0 + DOOR_W / 2 + 0.6, hi = span.a1 - DOOR_W / 2 - 0.6 - extra;
    if (hi < lo) continue;
    let at = Math.round(((lo + hi) / 2) * 20) / 20;
    if (o.snap) {
      const off = o.snapOffset ?? 0;
      const k0 = Math.ceil((lo - off) / o.snap), k1 = Math.floor((hi - off) / o.snap);
      if (k1 < k0) continue;
      at = (Math.round((k0 + k1) / 2) * o.snap) + off;
    }
    const r = s.rect;
    const posAt = (a: number): Vec3 => d === 0 ? [a, y, r.z1] : d === 2 ? [a, y, r.z0] : d === 1 ? [r.x1, y, a] : [r.x0, y, a];
    const pods = Array.from({ length: count }, (_v, i) => ({ pos: posAt(at + i * spacing), dir: d }));
    return { host: s.cell, doors: all, a: all[0]!, pod: pods[0]!, pods, rise: nextPocketRise(ctx) };
  }
  return null;
}

/** 扉の部品の params を写す（板・蝶番の側・開く向きを、写した先でも同じ見た目になるように） */
export function xDoorParams(x: Xform, p: EntitySpec['params']): EntitySpec['params'] {
  const pn = p.panel as { min: number[]; max: number[] };
  const panel = { min: [pn.min[0]!, pn.min[1]!, pn.min[2]!] as Vec3, max: [pn.max[0]!, pn.max[1]!, pn.max[2]!] as Vec3 };
  const axis = p.axis === 'x' ? 'x' : 'z';
  const hinge = p.hinge === 1 ? 1 : -1;
  const swing = typeof p.swing === 'number' ? p.swing : 1;
  const c: Vec3 = [(panel.min[0] + panel.max[0]) / 2, panel.min[1], (panel.min[2] + panel.max[2]) / 2];
  // 蝶番の端（'z' の扉は x の端、'x' の扉は z の端）と、開く向き（'x' の扉は swing +1 で +x、'z' の扉は swing +1 で -z）
  const hp: Vec3 = axis === 'z' ? [hinge > 0 ? panel.max[0] : panel.min[0], c[1], c[2]] : [c[0], c[1], hinge > 0 ? panel.max[2] : panel.min[2]];
  const sw: Vec3 = axis === 'x' ? [swing, 0, 0] : [0, 0, -swing];
  const np = xBox(x, panel);
  const nc = xPoint(x, c), nh = xPoint(x, hp), ns = xVec(x, sw);
  const nAxis = Math.abs(np.max[0] - np.min[0]) > Math.abs(np.max[2] - np.min[2]) ? 'z' : 'x';
  const nHinge = nAxis === 'z' ? (nh[0] > nc[0] ? 1 : -1) : (nh[2] > nc[2] ? 1 : -1);
  const nSwing = nAxis === 'x' ? Math.sign(ns[0]) || 1 : -(Math.sign(ns[2]) || 1);
  return { ...p, panel: { min: [...np.min], max: [...np.max] }, axis: nAxis, hinge: nHinge, swing: nSwing };
}

export interface RoomCopy {
  cell: CellLayout;
  xform: Xform;
  /** 部屋の扉の双子（plan.doors と同じ並び。a は入口の双子） */
  doors: string[];
  a: string;
  /** pod の双子（pods[0]） */
  pod: string;
  /** 足した扉の全部の双子（plan.pods と同じ並び） */
  pods: string[];
  /** pod の開口（写した先の壁の外面・外向き）。podOuts[0] */
  podOut: { pos: Vec3; dir: Dir };
  podOuts: { pos: Vec3; dir: Dir }[];
  /** 入口の双子の部屋か */
  entry: boolean;
}

export interface Anteroom {
  plan: AnteroomPlan;
  ctrl: string;
  podDoor: string;
  /** 足した扉の全部（plan.pods と同じ並び） */
  podDoors: string[];
  /** 入口の双子の部屋 R'（真上） */
  entry: RoomCopy;
  copies: RoomCopy[];
  /**
   * R から写し方 x で、もう 1 つの双子の部屋を置く（id の末尾 suffix）。既定は別の空間の終わりの Q'（pod はいつも向こうへつながる）。
   * entry なら入口の双子の部屋（pod は、finish の entries でその部屋が行き先のときだけ向こうへつながる）
   */
  addCopy(x: Xform, suffix: string, o?: { entry?: boolean }): RoomCopy;
  /**
   * 部品を置き、扉を配線する（最後に 1 回）。entries は pod ごとの行き先の copies の番号（既定 [0]）、
   * phase は時間で入れ替える行き先（{ sec, entries: [[…], …] }）
   */
  finish(extra?: { warpLinks?: Json[]; entries?: number[]; phase?: { sec: number; entries: number[][] } }): void;
}

/**
 * 控え室の中身（待合室: 壁際の長椅子・隅の鉢植え・壁の額）。区画の中身の作り方（dress）は使わない
 * （中身の有無で区画の形が変わらないように・双子の部屋へ写す前に決める）。扉の前は空け、置いたあと全部の扉へ歩けなければ外す
 */
function furnishAnteroom(ctx: GimmickContext, R: CellLayout, ops: WallOpening[]): void {
  const s = ctx.slot;
  const y = R.floorY;
  const r = innerRect(s);
  const zones = ops.map((o) => doorZone(o, y, 1.4, 0.45));
  const clear = (x0: number, z0: number, x1: number, z1: number): boolean => !zones.some((z) => x0 < z.max[0] && x1 > z.min[0] && z0 < z.max[2] && z1 > z.min[2]) && x0 >= r.x0 - 1e-6 && z0 >= r.z0 - 1e-6 && x1 <= r.x1 + 1e-6 && z1 <= r.z1 + 1e-6;
  const before = R.boxes.length;
  const B: Box[] = [];
  const lift = (from: number, group: string): void => {
    for (let i = from; i < B.length; i++) { const b = B[i]!; b.min[1] += y; b.max[1] += y; b.propGroup = `${R.id}/${group}`; }
  };
  // 長椅子: 開口から離れた壁際（長い方の壁から）
  const walls = ([0, 1, 2, 3] as Dir[]).sort((a, b) => ((b % 2 === 0) === ((r.x1 - r.x0) >= (r.z1 - r.z0)) ? 1 : 0) - ((a % 2 === 0) === ((r.x1 - r.x0) >= (r.z1 - r.z0)) ? 1 : 0));
  for (const d of walls) {
    const span = freeWallSpan(s, d, 2.0, 1.2);
    if (!span) continue;
    const len = Math.min(2.4, span.a1 - span.a0 - 0.2);
    if (len < 1.4) continue;
    const depth = 0.8;
    const along = d === 0 || d === 2;
    const wallC = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
    const sg = d === 0 || d === 1 ? -1 : 1;
    const c = wallC + sg * (depth / 2 + 0.02);
    const [cx, cz] = along ? [span.at, c] : [c, span.at];
    const [x0, z0, x1, z1] = along ? [cx - len / 2, cz - depth / 2, cx + len / 2, cz + depth / 2] : [cx - depth / 2, cz - len / 2, cx + depth / 2, cz + len / 2];
    if (!clear(x0, z0, x1, z1)) continue;
    const from = B.length;
    sofa(B, cx, cz, len, ((d + 2) % 4) as Dir, 'upholstery', depth);
    lift(from, `sofa@${cx.toFixed(2)},${cz.toFixed(2)}`);
    // 額（長椅子の上の壁）
    const fy = y + 1.45;
    const fr = along ? box([cx - 0.45, fy, Math.min(wallC, wallC + sg * 0.03)], [cx + 0.45, fy + 0.6, Math.max(wallC, wallC + sg * 0.03)], 'woodPanel', false)
      : box([Math.min(wallC, wallC + sg * 0.03), fy, cz - 0.45], [Math.max(wallC, wallC + sg * 0.03), fy + 0.6, cz + 0.45], 'woodPanel', false);
    const pic = along ? box([cx - 0.38, fy + 0.07, Math.min(wallC + sg * 0.03, wallC + sg * 0.042)], [cx + 0.38, fy + 0.53, Math.max(wallC + sg * 0.03, wallC + sg * 0.042)], 'skyOvercast', false)
      : box([Math.min(wallC + sg * 0.03, wallC + sg * 0.042), fy + 0.07, cz - 0.38], [Math.max(wallC + sg * 0.03, wallC + sg * 0.042), fy + 0.53, cz + 0.38], 'skyOvercast', false);
    B.push(fr, pic);
    break;
  }
  // 鉢植え: 開口から最も遠い隅
  const corners: [number, number][] = [[r.x0 + 0.4, r.z0 + 0.4], [r.x1 - 0.4, r.z0 + 0.4], [r.x0 + 0.4, r.z1 - 0.4], [r.x1 - 0.4, r.z1 - 0.4]];
  const far = (p: [number, number]): number => Math.min(...ops.map((o) => Math.hypot(o.pos[0] - p[0], o.pos[2] - p[1])));
  for (const [x, z] of corners.sort((a, b) => far(b) - far(a))) {
    if (!clear(x - 0.3, z - 0.3, x + 0.3, z + 0.3) || B.some((b) => b.solid && b.min[0] < x + 0.35 && b.max[0] > x - 0.35 && b.min[2] < z + 0.35 && b.max[2] > z - 0.35)) continue;
    const from = B.length;
    plant(B, x, z, 0.5, 1.3);
    lift(from, `plant@${x.toFixed(2)},${z.toFixed(2)}`);
    break;
  }
  R.boxes.push(...B);
  // 全部の扉（3 枚目を含む）へ歩けなければ外す
  const reach = reachOpenings({ footprint: R.footprint, floorY: y, boxes: R.boxes }, ops, 0.1);
  if (reach && reach.blocked.length) R.boxes.length = before;
}

/** pod の扉の開く向き（外へ開く） */
const outwardSwing = (d: Dir): number => (axisOf(d) === 'x' ? signOf(d) : -signOf(d));

export function buildAnteroom(ctx: GimmickContext, plan: AnteroomPlan): Anteroom {
  const R = plan.host;
  const y = R.floorY;
  const ctrl = `${ctx.id}.ante`;
  const doorMat = (plan.a.door.params.mat as MatId | undefined) ?? R.palette.door;
  // 足した扉の入力（finish で控え室の部品の出力へ配線する。ctx.addEntity は浅く写すので、同じ物を後から書き換えられる）
  const inputs = new Map<string, Record<string, Json>>();
  const addDoor = (name: string, cell: string, params: EntitySpec['params']): string => {
    const inp: Record<string, Json> = {};
    const id = ctx.addEntity(name, { type: 'door', cell, params, inputs: inp as EntitySpec['inputs'] });
    inputs.set(id, inp);
    return id;
  };
  // pod の穴を開け、R の中身を置く（pod の前も空ける）
  const podOps = plan.pods.map((pd, i) => {
    carveDoorway(R, pd.pos, pd.dir);
    return opening(`${R.id}:pod${i ? i : ''}`, [...pd.pos], pd.dir, DOOR_W, DOOR_H);
  });
  furnishAnteroom(ctx, R, [...ctx.slot.openings, ...podOps]);
  ctx.noDress!();
  const podParams = plan.pods.map((pd) => {
    const axis = axisOf(pd.dir);
    const coord = axis === 'x' ? pd.pos[0] : pd.pos[2];
    const at = axis === 'x' ? pd.pos[2] : pd.pos[0];
    return doorSpec(axis, coord, at, y, doorMat, { hinge: (plan.a.door.params.hinge as number) ?? 1, swing: outwardSwing(pd.dir), autoCloseSec: 6 }).params;
  });
  const podDoors = podParams.map((pp, i) => addDoor(i ? `pod${i}` : 'pod', R.id, pp));
  const podDoor = podDoors[0]!;
  // 灯り（pod の上。入れるとき緑）
  const lampAt = (pos: Vec3, dir: Dir, cell: string, wired: boolean, name: string): void => {
    const f = frontPoint({ pos, dir }, WALL_T + 0.03);
    ctx.addEntity(name, { type: 'warpIndicator', cell, params: { pos: [f[0], pos[1] + DOOR_H + 0.18, f[2]], dir }, ...(wired ? { inputs: { on: `${ctrl}.ready` } } : {}) });
  };
  plan.pods.forEach((pd, i) => lampAt(pd.pos, pd.dir, R.id, true, i ? `lamp0p${i}` : 'lamp0'));

  const copies: RoomCopy[] = [];
  const makeCopy = (x: Xform, suffix: string, o: { entry?: boolean } = {}): RoomCopy => {
    const id = `${R.id}~${suffix}`;
    const cell = copyCell(R, x, { id, pocket: ctx.id, name: R.name ?? '部屋' });
    const ops = [...ctx.slot.openings.map((o, i) => xOpening(x, o, `${id}:o${i}`)), ...podOps.map((po, i) => xOpening(x, po, `${id}:pod${i ? i : ''}`))];
    addPocketCell(ctx, cell, 'room', ops);
    const twins = plan.doors.map((d, i) => addDoor(`${suffix}.${i === 0 ? 'a' : `d${i}`}`, id, { ...xDoorParams(x, d.door.params), autoCloseSec: 0 }));
    const pods = podParams.map((pp, i) => addDoor(`${suffix}.pod${i ? i : ''}`, id, { ...xDoorParams(x, pp), autoCloseSec: 6 }));
    const podOuts = plan.pods.map((pd) => ({ pos: xPoint(x, pd.pos), dir: ((pd.dir + x.q) % 4) as Dir }));
    podOuts.forEach((po, i) => lampAt(po.pos, po.dir, id, false, `${suffix}.lamp${i ? i : ''}`));
    const c: RoomCopy = { cell, xform: x, doors: twins, a: twins[0]!, pod: pods[0]!, pods, podOut: podOuts[0]!, podOuts, entry: !!o.entry };
    copies.push(c);
    return c;
  };
  const entry = makeCopy({ from: [0, 0, 0], to: [0, plan.rise, 0], q: 0 }, 'a1', { entry: true });

  return {
    plan, ctrl, podDoor, podDoors, entry, copies,
    addCopy: makeCopy,
    finish(extra = {}) {
      // 足した扉（pod・双子の部屋の扉）はこの部品が開け閉めする（入力 open を d<i> へ）
      const managed: string[] = [...podDoors, ...copies.flatMap((c) => [...c.doors, ...c.pods])];
      const auto: Record<string, Json> = {};
      for (const id of managed) auto[id] = 6;
      for (const id of podDoors) auto[id] = 0;
      for (const c of copies) for (const dd of c.doors) auto[dd] = 0;
      managed.forEach((id, i) => { const inp = inputs.get(id); if (inp) inp.open = `${ctrl}.d${i}`; });
      // 部屋の扉はふつうの扉のまま。入力 lock をいつも 0 の出力につなぎ、この部品の後に動くようにする（双子の部屋から戻した tick に開くため）
      for (const { door: e } of plan.doors) e.inputs = { ...(e.inputs ?? {}), lock: `${ctrl}.free` };
      const room = innerRect(ctx.slot, 0);
      // 歩く人（試験）の道順: pod を調べると行き先の双子の部屋、双子の部屋の A を調べると R
      const entries = extra.entries ?? extra.phase?.entries[0] ?? [0];
      const links: Json[] = plan.pods.map((pd, j) => ({ from: R.id, to: (copies[entries[j] ?? 0] ?? entry).cell.id, at: [...frontPoint(pd, 0.75)], interact: podDoors[j]! }));
      for (const c of copies) {
        const ao = { pos: xPoint(c.xform, plan.a.o.pos), dir: ((plan.a.o.dir + c.xform.q) % 4) as Dir };
        links.push({ from: c.cell.id, to: R.id, at: [...frontPoint(ao, 0.75)], interact: c.a });
      }
      ctx.addEntity('ante', {
        type: 'warpAnteroom',
        params: {
          managed, auto,
          room: { min: [room.x0, y - 0.3, room.z0], max: [room.x1, y + 2.5, room.z1] },
          doors: { real: plan.doors.map((d) => d.door.id), pod: podDoor, ...(podDoors.length > 1 ? { pods: podDoors } : {}) },
          copies: copies.map((c) => ({ doors: c.doors, pod: c.pod, ...(c.pods.length > 1 ? { pods: c.pods } : {}), xform: xJson(c.xform), ...(c.entry ? { entry: true } : {}) })),
          ...(extra.entries ? { entries: extra.entries } : {}),
          ...(extra.phase ? { phase: extra.phase as unknown as Json } : {}),
          warpLinks: [...links, ...(extra.warpLinks ?? [])],
        },
      });
    },
  };
}

/** 双子の部屋の pod と、別の空間の最初の区画をつなぐ（開口と portal。扉は pod） */
export function attachToPod(ctx: GimmickContext, copy: RoomCopy, cell: string): void {
  joinCells(ctx, copy.cell.id, cell, copy.podOut.pos, copy.podOut.dir, DOOR_W, DOOR_H, copy.pod);
}
