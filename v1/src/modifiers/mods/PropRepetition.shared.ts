/**
 * M-instances 担当（InstanceOvergrowth / PropRepetition / PropOrientation）の共通ヘルパ。
 * 通路の確保（ソケット前 ±1.6 m + 入口→各出口の直線帯 1.2 m）、箱の重なり判定、家具の除去、壁の向き判定。
 * 純関数のみ（乱数は呼び出し側の rng）。ModifierImpl ではないので default export は無い。
 */
import type { AABB } from '../../core/aabb';
import { aabbOverlap } from '../../core/aabb';
import type { Dir, Socket, Vec3 } from '../../core/types';
import { across, along, wallSpans, type Rect } from '../../generators/footprint';
import { WALL_T, type Box, type InstanceSpec, type MatId, type RoomLayout } from '../../generators/layout';
import type { Rng } from '../../core/rng';

/** 通路帯の半幅（1.2 m 帯） */
export const LANE_HALF = 0.6;

export interface Lane {
  a: [number, number];
  b: [number, number];
  /** 帯の半幅 */
  half: number;
}

/** 空けておく領域: ソケット前の箱 + 入口→各出口の直線帯 */
export interface Clearance {
  zones: AABB[];
  lanes: Lane[];
  /** 床穴（上に物を置かない） */
  holes: AABB[];
}

/** 出入口の 2D 位置（hole 型は床 / 天井穴の中心） */
function socketXZ(s: Socket): [number, number] {
  return [s.pos[0], s.pos[2]];
}

/** ソケット前後 1.8 m × 幅（w + 0.6、最低 1.6）× 高 2.2 m（common.ts の clearDoorways と同じ寸法）。hole 型は全高の半径 1.3 m の柱 */
export function doorwayZones(L: RoomLayout): AABB[] {
  const out: AABB[] = [];
  for (const s of L.sockets) {
    if (s.type === 'hole') {
      out.push({ min: [s.pos[0] - 1.3, -0.2, s.pos[2] - 1.3], max: [s.pos[0] + 1.3, L.height + 0.4, s.pos[2] + 1.3] });
      continue;
    }
    const half = Math.max(0.8, s.width / 2 + 0.3);
    const inward = s.dir === 0 ? [0, -1] : s.dir === 1 ? [-1, 0] : s.dir === 2 ? [0, 1] : [1, 0];
    const cx = s.pos[0] + inward[0] * 0.9;
    const cz = s.pos[2] + inward[1] * 0.9;
    const hx = s.dir === 0 || s.dir === 2 ? half : 0.9;
    const hz = s.dir === 0 || s.dir === 2 ? 0.9 : half;
    out.push({ min: [cx - hx, s.pos[1] - 0.1, cz - hz], max: [cx + hx, s.pos[1] + (s.sill ?? 0) + 2.2, cz + hz] });
  }
  return out;
}

/** 入口（無ければ最初のソケット）から各出口への直線帯 */
export function progressLanes(L: RoomLayout, half = LANE_HALF): Lane[] {
  const entry = L.sockets.find((s) => s.id === 'entry') ?? L.sockets[0];
  if (!entry) return [];
  const a = socketXZ(entry);
  const out: Lane[] = [];
  for (const s of L.sockets) {
    if (s === entry) continue;
    out.push({ a, b: socketXZ(s), half });
  }
  return out;
}

/** 扉前 + 通り抜けの予約（L.passages。間仕切りの開口）+ 直線帯 + 床穴 */
export function clearanceOf(L: RoomLayout, laneHalf = LANE_HALF): Clearance {
  return { zones: [...doorwayZones(L), ...(L.passages ?? [])], lanes: progressLanes(L, laneHalf), holes: L.holes.slice() };
}

/** 点と線分の 2D 距離 */
export function pointSegDist2D(px: number, pz: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  let t = len2 > 1e-9 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}

function segsIntersect(p0: [number, number], p1: [number, number], q0: [number, number], q1: [number, number]): boolean {
  const o = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = o(q0, q1, p0), d2 = o(q0, q1, p1), d3 = o(p0, p1, q0), d4 = o(p0, p1, q1);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** 線分と XZ 矩形の 2D 距離（交差・内包なら 0） */
export function segRectDist2D(a: [number, number], b: [number, number], x0: number, z0: number, x1: number, z1: number): number {
  const inside = (p: [number, number]) => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1;
  if (inside(a) || inside(b)) return 0;
  const corners: [number, number][] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (let i = 0; i < 4; i++) if (segsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return 0;
  let d = Infinity;
  for (const c of corners) d = Math.min(d, pointSegDist2D(c[0], c[1], a, b));
  const clampPt = (p: [number, number]) => Math.hypot(p[0] - Math.max(x0, Math.min(x1, p[0])), p[1] - Math.max(z0, Math.min(z1, p[1])));
  return Math.min(d, clampPt(a), clampPt(b));
}

/** 箱が通路（扉前 / 直線帯 / 床穴）に掛かるか。margin は帯・穴に足す余白 */
export function boxBlocked(c: Clearance, b: AABB, margin = 0): boolean {
  for (const z of c.zones) if (aabbOverlap(z, b, 0.01)) return true;
  for (const h of c.holes) {
    if (b.min[0] < h.max[0] + margin && b.max[0] > h.min[0] - margin && b.min[2] < h.max[2] + margin && b.max[2] > h.min[2] - margin) return true;
  }
  for (const l of c.lanes) if (segRectDist2D(l.a, l.b, b.min[0], b.min[2], b.max[0], b.max[2]) < l.half + margin) return true;
  return false;
}

/** 点（床上の小片）が通路に掛かるか。y は床基準の高さ（帯・扉前判定に使う） */
export function pointBlocked(c: Clearance, x: number, z: number, margin = 0, y = 0.3): boolean {
  for (const zn of c.zones) {
    if (x > zn.min[0] - margin && x < zn.max[0] + margin && z > zn.min[2] - margin && z < zn.max[2] + margin && y > zn.min[1] - 0.05 && y < zn.max[1]) return true;
  }
  for (const h of c.holes) if (x > h.min[0] - margin - 0.3 && x < h.max[0] + margin + 0.3 && z > h.min[2] - margin - 0.3 && z < h.max[2] + margin + 0.3) return true;
  for (const l of c.lanes) if (pointSegDist2D(x, z, l.a, l.b) < l.half + margin) return true;
  return false;
}

/** 点が箱の XZ 範囲内か */
export function pointInBoxXZ(b: AABB, x: number, z: number, margin = 0): boolean {
  return x > b.min[0] - margin && x < b.max[0] + margin && z > b.min[2] - margin && z < b.max[2] + margin;
}

/** レイアウトのソリッド箱（from 以降。既定はシェル以降）と重なるか */
export function overlapsSolid(L: RoomLayout, b: AABB, from = L.shellCount ?? 0, eps = 0.02): boolean {
  const boxes = L.boxes;
  for (let i = from; i < boxes.length; i++) {
    const o = boxes[i];
    if (o.solid && aabbOverlap(o, b, eps)) return true;
  }
  return false;
}

/** 家具として差し替え対象になる材質（構造材 wall* / column / 照明 / 床線は残す） */
export const FURNITURE_MATS: ReadonlySet<MatId> = new Set<MatId>([
  'furnitureDark', 'furnitureLight', 'shelfMetal', 'boxCardboard', 'upholstery', 'metal', 'doorMetal', 'ledBlue', 'rubber', 'carPaint', 'carGlass', 'screenGlow',
]);

export function isFurniture(b: Box): boolean {
  return FURNITURE_MATS.has(b.mat);
}

/**
 * 部屋別ドレッシング（generators/dressing。Modifier より前に走る）が置いた箱の印。`kind` が 'dress:' で始まる箱は
 * Modifier の家具差し替え・詰め物除去（removeInterior / PropRepetition.removeFills / NonEuclideanVolume の組み直し）で捨てない。
 * ドレッシング側は Modifier が後で置くものと重ならない位置・材質で置く責任を持つ（docs/visual-requests.md「A1 → 各担当」）
 */
export const DRESS_KIND_PREFIX = 'dress:';

export function isDress(b: Box): boolean {
  return typeof b.kind === 'string' && b.kind.startsWith(DRESS_KIND_PREFIX);
}

/** シェル以降の箱から pred に合うものを取り除き、取り除いた箱を返す（shellCount より前と、ドレッシングの箱 `dress:*` は触らない） */
export function removeInterior(L: RoomLayout, pred: (b: Box) => boolean): Box[] {
  const from = L.shellCount ?? 0;
  const keep = L.boxes.slice(0, from);
  const removed: Box[] = [];
  for (const b of L.boxes.slice(from)) {
    if (!isDress(b) && pred(b)) removed.push(b);
    else keep.push(b);
  }
  L.boxes = keep;
  return removed;
}

/** シェル以降の箱（読み取り用） */
export function interiorBoxesOf(L: RoomLayout): Box[] {
  return L.boxes.slice(L.shellCount ?? 0);
}

/** 内側矩形（壁厚 + margin） */
export function innerRect(r: Rect, margin: number): Rect {
  const m = WALL_T + margin;
  return { x0: r.x0 + m, z0: r.z0 + m, x1: r.x1 - m, z1: r.z1 - m };
}

/** 各方向の「ソケットの無い外壁区間」の合計長さと、ソケット数 */
export function wallStatsByDir(L: RoomLayout): { freeLen: number[]; sockets: number[] } {
  const freeLen = [0, 0, 0, 0];
  const sockets = [0, 0, 0, 0];
  const wall = L.sockets.filter((s) => s.type !== 'hole');
  for (const s of wall) sockets[s.dir]++;
  for (const sp of wallSpans(L.footprint)) {
    const d = sp.edge.dir;
    const has = wall.some((s) => s.dir === d && Math.abs(across(d, s.pos[0], s.pos[2]) - sp.edge.coord) < 0.05 && along(d, s.pos[0], s.pos[2]) >= sp.a0 - 0.01 && along(d, s.pos[0], s.pos[2]) <= sp.a1 + 0.01);
    if (!has) freeLen[d] += sp.a1 - sp.a0;
  }
  return { freeLen, sockets };
}

/** 「ソケットの無い最長の壁」の方向。全辺にソケットがあればソケット最少の辺。同点は 0 → 1 → 2 → 3 */
export function socketFreeWallDir(L: RoomLayout): Dir {
  const { freeLen, sockets } = wallStatsByDir(L);
  let best: Dir = 0;
  let bestLen = -1;
  for (const d of [0, 1, 2, 3] as Dir[]) {
    if (freeLen[d] > bestLen + 0.01) { best = d; bestLen = freeLen[d]; }
  }
  if (bestLen > 0.5) return best;
  let bestCount = Infinity;
  for (const d of [0, 1, 2, 3] as Dir[]) {
    if (sockets[d] < bestCount) { best = d; bestCount = sockets[d]; }
  }
  return best;
}

/** 方向の単位ベクトル（XZ） */
export function dirXZ(d: Dir): [number, number] {
  return d === 0 ? [0, 1] : d === 1 ? [1, 0] : d === 2 ? [0, -1] : [-1, 0];
}

/** 方向 d を向く yaw（InstanceSpec.transforms.yaw。RoomBuilder は yaw=0 で size をそのまま置き、ローカル +Z が d=0） */
export function yawOfDir(d: Dir): number {
  return (d * Math.PI) / 2;
}

/** InstanceSpec を追加する（transforms を rng で決定論的にシャッフルし、Tier の等間隔間引きが空間的に均一になるようにする） */
export function pushInstances(L: RoomLayout, rng: Rng, spec: InstanceSpec): void {
  if (spec.transforms.length === 0) return;
  rng.shuffle(spec.transforms);
  if (!L.instances) L.instances = [];
  L.instances.push(spec);
}

/** 箔の AABB を作る（底面中心 + 寸法 + yaw 1/4 回転） */
export function footprintAABB(cx: number, cz: number, y0: number, size: Vec3, yaw: number): AABB {
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const hx = (c * size[0] + s * size[2]) / 2;
  const hz = (s * size[0] + c * size[2]) / 2;
  return { min: [cx - hx, y0, cz - hz], max: [cx + hx, y0 + size[1], cz + hz] };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
