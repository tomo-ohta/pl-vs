/**
 * VehicleRide の補助: 乗車ソケットの選択と、車両（train / boat / monorail）の箱を組む純関数群。
 * 座標はすべて部屋ローカル。ソケット s（外向き dir）を基準に「壁に沿う u / 外向きの v / 高さ y」の 3 軸で寸法を書き、
 * frame() で x/z へ写す。RoomBuilder はローカル箱を placement で回すので、ここでは向きを気にしない。
 */
import type { Dir, Socket, Vec3 } from '../../core/types';
import { addDir, dirVec } from '../../core/types';
import type { AABB } from '../../core/aabb';
import { box, type Box, type LightSpec, type RoomLayout } from '../../generators/layout';
import { rectsOverlap, type Rect } from '../../generators/footprint';

export type Vehicle = 'train' | 'boat' | 'monorail';

/** 車両の基本寸法（m） */
export interface VehicleDims {
  /** 壁に沿った全長 */
  len: number;
  /** 外向きの奥行（車体） */
  depth: number;
  /** 車内の天井高 */
  height: number;
  /** 壁外面と車体の隙間 */
  gap: number;
  /** 窓帯の下端 / 上端 */
  winY0: number;
  winY1: number;
  /** 車外の背景（暗幕）までの距離（車体外面から） */
  backdrop: number;
}

export function vehicleDims(v: Vehicle): VehicleDims {
  switch (v) {
    case 'boat': return { len: 7.0, depth: 2.6, height: 2.1, gap: 0.2, winY0: 0.9, winY1: 2.0, backdrop: 4.5 };
    case 'monorail': return { len: 12.0, depth: 2.6, height: 2.3, gap: 0.15, winY0: 0.9, winY1: 2.0, backdrop: 4.0 };
    default: return { len: 14.0, depth: 2.8, height: 2.4, gap: 0.15, winY0: 1.0, winY1: 1.9, backdrop: 4.0 };
  }
}

/** ソケット基準の局所フレーム。u: 壁に沿う（dir+1 方向）/ v: 外向き / y: 高さ */
export interface Frame {
  origin: Vec3;
  n: Vec3;
  t: Vec3;
  dir: Dir;
}

export function frameOf(s: Socket): Frame {
  return { origin: [s.pos[0], 0, s.pos[2]], n: dirVec(s.dir), t: dirVec(addDir(s.dir, 1)), dir: s.dir };
}

/** (u, y, v) → ローカル座標 */
export function pt(f: Frame, u: number, y: number, v: number): Vec3 {
  return [f.origin[0] + f.t[0] * u + f.n[0] * v, y, f.origin[2] + f.t[2] * u + f.n[2] * v];
}

/** u/y/v の範囲から箱を作る（box() が min/max を正規化する） */
export function fbox(f: Frame, u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, mat: Box['mat'], solid = true): Box {
  return box(pt(f, u0, y0, v0), pt(f, u1, y1, v1), mat, solid);
}

/** u/v 範囲の床面矩形（footprint との干渉判定用） */
export function frect(f: Frame, u0: number, u1: number, v0: number, v1: number): Rect {
  const a = pt(f, u0, 0, v0);
  const b = pt(f, u1, 0, v1);
  return { x0: Math.min(a[0], b[0]), z0: Math.min(a[2], b[2]), x1: Math.max(a[0], b[0]), z1: Math.max(a[2], b[2]) };
}

export function rectToAABB(r: Rect, y0: number, y1: number): AABB {
  return { min: [r.x0, y0, r.z0], max: [r.x1, y1, r.z1] };
}

/** 車両 + 背景が占める床面矩形（バウンズ拡張・干渉判定に使う） */
export function vehicleRegion(f: Frame, d: VehicleDims): Rect {
  const margin = 3.4; // 側面の暗幕（±(len/2 + 3.3)）まで含める
  return frect(f, -d.len / 2 - margin, d.len / 2 + margin, 0, d.gap + d.depth + d.backdrop + 0.4);
}

// ---------------------------------------------------------------- ソケット選択

export interface Candidate {
  socket: Socket;
  conflicts: number;
  distFromEntry: number;
}

/**
 * 乗車ソケットを選ぶ。条件: entry 以外の通常扉（sill / crawl 無し・追加ソケットでない）。
 * 車両領域が自分の footprint と重なる候補は除外し、同じ壁外側に他の出口が出る候補は conflicts として数える
 * （その出口の先は置けなくなるので、少ないものを優先）。同点は entry から遠い順 → id 順（決定論）。
 */
export function pickRideSocket(L: RoomLayout, extraIds: ReadonlySet<string>, d: VehicleDims): Socket | null {
  const entry = L.sockets.find((s) => s.id === 'entry');
  const cands: Candidate[] = [];
  for (const s of L.sockets) {
    if (s.id === 'entry' || s.type !== 'door' || s.crawl || (s.sill ?? 0) > 0 || extraIds.has(s.id)) continue;
    const f = frameOf(s);
    const region = vehicleRegion(f, d);
    if (L.footprint.some((r) => rectsOverlap(r, region, 0.1))) continue;
    let conflicts = 0;
    for (const o of L.sockets) {
      if (o === s || o.type === 'hole') continue;
      const on = dirVec(o.dir);
      const outside: Vec3 = [o.pos[0] + on[0] * 1.0, 0, o.pos[2] + on[2] * 1.0];
      if (outside[0] > region.x0 && outside[0] < region.x1 && outside[2] > region.z0 && outside[2] < region.z1) conflicts++;
    }
    const distFromEntry = entry ? Math.hypot(s.pos[0] - entry.pos[0], s.pos[2] - entry.pos[2]) : 0;
    cands.push({ socket: s, conflicts, distFromEntry });
  }
  if (cands.length === 0) return null;
  cands.sort((a, b) => a.conflicts - b.conflicts || b.distFromEntry - a.distFromEntry || (a.socket.id < b.socket.id ? -1 : 1));
  return cands[0].socket;
}

// ---------------------------------------------------------------- 車両の箱

export interface VehicleBuild {
  boxes: Box[];
  lights: LightSpec[];
  /** 車内ボリューム（ローカル AABB。ride ゾーン） */
  interior: AABB;
  /** 車内の待機位置（足元） */
  seat: Vec3;
}

const T = 0.08; // 車体の板厚

/** 車両の箱を組む。ソケットの開口（幅 doorW・高さ doorH）に合わせて手前側の壁を開ける */
export function buildVehicle(v: Vehicle, s: Socket, d: VehicleDims, roomHeight: number, lightColor: number): VehicleBuild {
  const f = frameOf(s);
  const out: Box[] = [];
  const lights: LightSpec[] = [];
  const v0 = d.gap; // 車体の手前面
  const v1 = d.gap + d.depth; // 車体の奥面
  const hu = d.len / 2;
  const doorHW = Math.min(hu - 0.6, s.width / 2 + 0.1);
  const doorH = Math.min(d.height - 0.1, s.height);

  // 乗降口の敷板（壁外面と車体の隙間を渡す。段差なし）
  out.push(fbox(f, -doorHW - 0.1, doorHW + 0.1, -0.06, 0, -0.02, v0 + 0.02, 'rubber'));

  if (v === 'boat') {
    buildBoat(f, out, lights, d, v0, v1, hu, doorHW, lightColor);
  } else {
    buildRailcar(v, f, out, lights, d, v0, v1, hu, doorHW, doorH, lightColor);
  }

  // 車外の背景: 暗幕（非ソリッド。窓外の流光はこの手前を流れる）と足元の暗い床面
  const bv = v1 + d.backdrop;
  const yTop = Math.max(roomHeight, d.height) + 0.2;
  out.push(fbox(f, -hu - 3, hu + 3, -0.6, yTop, bv, bv + 0.3, 'void', false));
  out.push(fbox(f, -hu - 3, hu + 3, -0.6, -0.55, v0 - 0.05, bv, v === 'boat' ? 'water' : 'floorAsphalt', false));
  // 側面の暗幕（背景の端が見えないように）
  out.push(fbox(f, -hu - 3.3, -hu - 3, -0.6, yTop, 0, bv + 0.3, 'void', false));
  out.push(fbox(f, hu + 3, hu + 3.3, -0.6, yTop, 0, bv + 0.3, 'void', false));

  const interiorRect = frect(f, -hu + T, hu - T, v0 + T, v1 - T);
  const seat = pt(f, 0, 0, v0 + d.depth * 0.5);
  return { boxes: out, lights, interior: rectToAABB(interiorRect, 0, d.height), seat };
}

/** 列車 / モノレール: 箱形車体 + 窓帯 + ロングシート + 天井灯。モノレールは足元に軌道桁 */
function buildRailcar(v: Vehicle, f: Frame, out: Box[], lights: LightSpec[], d: VehicleDims, v0: number, v1: number, hu: number, doorHW: number, doorH: number, lightColor: number): void {
  const h = d.height;
  const body = 'carPaint';
  // 床（上面 y=0）と床下機器
  out.push(fbox(f, -hu, hu, -0.12, 0, v0, v1, 'floorLino'));
  out.push(fbox(f, -hu + 0.4, hu - 0.4, -0.35, -0.12, v0 + 0.3, v1 - 0.3, 'metal'));
  // 屋根
  out.push(fbox(f, -hu, hu, h, h + 0.12, v0, v1, body));
  out.push(fbox(f, -hu + 0.3, hu - 0.3, h + 0.12, h + 0.22, v0 + 0.3, v1 - 0.3, 'metal', false));
  // 端面
  out.push(fbox(f, -hu, -hu + T, 0, h, v0, v1, body));
  out.push(fbox(f, hu - T, hu, 0, h, v0, v1, body));
  // 奥側: 腰板 / 窓帯 / 幕板
  out.push(fbox(f, -hu, hu, 0, d.winY0, v1 - T, v1, body));
  out.push(fbox(f, -hu, hu, d.winY0, d.winY1, v1 - T, v1, 'glass'));
  out.push(fbox(f, -hu, hu, d.winY1, h, v1 - T, v1, body));
  // 奥側の窓柱
  for (let u = -hu + 2.0; u < hu - 1.0; u += 2.0) out.push(fbox(f, u - 0.05, u + 0.05, d.winY0, d.winY1, v1 - T - 0.01, v1, body));
  // 手前側: 乗降口を開けた腰板 / 窓帯 / 幕板
  for (const [a, b] of [[-hu, -doorHW], [doorHW, hu]] as [number, number][]) {
    out.push(fbox(f, a, b, 0, d.winY0, v0, v0 + T, body));
    out.push(fbox(f, a, b, d.winY0, d.winY1, v0, v0 + T, 'glass'));
    out.push(fbox(f, a, b, d.winY1, h, v0, v0 + T, body));
  }
  if (doorH < h - 0.01) out.push(fbox(f, -doorHW, doorHW, doorH, h, v0, v0 + T, body));
  // ロングシート（奥側）と手すり
  out.push(fbox(f, -hu + 0.5, hu - 0.5, 0, 0.45, v1 - T - 0.55, v1 - T, 'upholstery'));
  out.push(fbox(f, -hu + 0.5, hu - 0.5, 0.45, 1.05, v1 - T - 0.12, v1 - T, 'upholstery'));
  for (const u of [-hu * 0.5, hu * 0.5]) out.push(fbox(f, u - 0.02, u + 0.02, 0, h, v0 + d.depth * 0.5 - 0.02, v0 + d.depth * 0.5 + 0.02, 'metal'));
  // 天井灯（発光箔 + ライト 1 本）
  out.push(fbox(f, -hu + 0.6, hu - 0.6, h - 0.04, h - 0.005, v0 + d.depth * 0.5 - 0.15, v0 + d.depth * 0.5 + 0.15, v === 'monorail' ? 'lightPanel' : 'lightWarm', false));
  lights.push({ pos: pt(f, 0, h - 0.3, v0 + d.depth * 0.5), color: lightColor, intensity: 0.8, distance: Math.max(8, d.len * 0.7) });
  if (v === 'monorail') {
    // 軌道桁（車体の下を通り、車両より先まで続く）
    out.push(fbox(f, -hu - 3, hu + 3, -0.6, -0.36, v0 + d.depth * 0.5 - 0.4, v0 + d.depth * 0.5 + 0.4, 'metal', false));
  }
}

/** ボート: 舷側の低い船体 + 木の甲板 + 屋根付きの開放キャビン（窓は無く、舷側の上が開いている） */
function buildBoat(f: Frame, out: Box[], lights: LightSpec[], d: VehicleDims, v0: number, v1: number, hu: number, doorHW: number, lightColor: number): void {
  const h = d.height;
  const gunwale = 0.95;
  // 船体（水面 y=0 に甲板。喫水 0.5 m）
  out.push(fbox(f, -hu, hu, -0.5, -0.1, v0 + 0.15, v1 - 0.15, 'carPaint'));
  out.push(fbox(f, -hu, hu, -0.1, 0, v0, v1, 'floorWood'));
  // 舷側（手前は乗降口を開ける）
  out.push(fbox(f, -hu, hu, 0, gunwale, v1 - T, v1, 'carPaint'));
  out.push(fbox(f, -hu, -hu + T, 0, gunwale, v0, v1, 'carPaint'));
  out.push(fbox(f, hu - T, hu, 0, gunwale, v0, v1, 'carPaint'));
  for (const [a, b] of [[-hu, -doorHW], [doorHW, hu]] as [number, number][]) out.push(fbox(f, a, b, 0, gunwale, v0, v0 + T, 'carPaint'));
  // 船首・船尾の張り出し（装飾）
  out.push(fbox(f, hu, hu + 1.0, -0.3, 0.6, v0 + 0.6, v1 - 0.6, 'carPaint', false));
  out.push(fbox(f, -hu - 0.6, -hu, -0.3, 0.6, v0 + 0.4, v1 - 0.4, 'carPaint', false));
  // 屋根と柱
  out.push(fbox(f, -hu + 0.3, hu - 0.3, h, h + 0.08, v0 + 0.1, v1 - 0.1, 'furnitureDark'));
  for (const u of [-hu + 0.5, hu - 0.5]) for (const vv of [v0 + 0.2, v1 - 0.2]) out.push(fbox(f, u - 0.04, u + 0.04, 0, h, vv - 0.04, vv + 0.04, 'metal'));
  // ベンチ（奥側）と吊り灯
  out.push(fbox(f, -hu + 0.6, hu - 0.6, 0, 0.42, v1 - T - 0.45, v1 - T, 'furnitureDark'));
  out.push(fbox(f, -0.3, 0.3, h - 0.3, h - 0.02, v0 + d.depth * 0.5 - 0.3, v0 + d.depth * 0.5 + 0.3, 'lightWarm', false));
  lights.push({ pos: pt(f, 0, h - 0.5, v0 + d.depth * 0.5), color: lightColor, intensity: 0.6, distance: 7 });
}
