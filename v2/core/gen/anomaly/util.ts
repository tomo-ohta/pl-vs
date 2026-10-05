/**
 * 異変を作るための補助: 区画の内側・開口の前・家具のまとまり・箱の変形（拡大・回転・倒す・上下反転）・光る材質。
 * 高さはすべてフロア座標（床 = cell.floorY）。区画の中身（core/gen/dress）の作業座標（床 = 0）とは違うので注意。
 */
import type { AABB } from '../../math/aabb.ts';
import type { Rect } from '../../world/footprint.ts';
import { WALL_T, type Box, type CellLayout, type MatId, type WallOpening } from '../../world/layout.ts';

/** 立ったまま通れる高さ（PLAYER.height 1.7 + 余裕）。これより低い所に底がある宙の箱は、くぐるのにしゃがみが要る */
export const STAND_H = 1.8;

/** 壁の内側の矩形（足跡の矩形ごと。margin は壁からさらに空ける距離） */
export function innerRects(cell: CellLayout, margin = 0): Rect[] {
  const m = WALL_T + margin;
  return cell.footprint
    .map((r) => ({ x0: r.x0 + m, z0: r.z0 + m, x1: r.x1 - m, z1: r.z1 - m }))
    .filter((r) => r.x1 - r.x0 > 0.1 && r.z1 - r.z0 > 0.1);
}

/** 主の矩形（足跡の最大の矩形） */
export function mainRect(cell: CellLayout): Rect {
  return cell.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
}

export const rectArea = (r: Rect): number => (r.x1 - r.x0) * (r.z1 - r.z0);

/** 開口の内向きの単位ベクトル [x, z]（開口の dir は外向き） */
export function inwardOf(o: WallOpening): [number, number] {
  return o.dir === 0 ? [0, -1] : o.dir === 1 ? [-1, 0] : o.dir === 2 ? [0, 1] : [1, 0];
}

/** 開口の前の点（区画の内側へ depth m。フロア座標） */
export function frontPoint(o: WallOpening, depth: number): [number, number] {
  const [ix, iz] = inwardOf(o);
  return [o.pos[0] + ix * depth, o.pos[2] + iz * depth];
}

/**
 * 開口の前の空けておく範囲（フロア座標）。幅は開口 + 両側 pad（最小 1.6 m）、奥行きは壁の外面から WALL_T + depth。
 * 高さは床の少し下から、開口の上端 + 0.1 か床 + 2.2 m の高い方まで（区画の中身の doorZones と同じ形）
 */
export function doorFronts(cell: CellLayout, openings: readonly WallOpening[], depth = 1.5, pad = 0.35): AABB[] {
  return openings.map((s): AABB => {
    const half = Math.max(0.8, s.width / 2 + pad);
    const base = s.pos[1] + (s.sill ?? 0);
    const y0 = Math.min(cell.floorY, base) - 0.1;
    const y1 = Math.max(cell.floorY + 2.2, base + s.height + 0.1);
    const reach = WALL_T + depth;
    const [x, z] = [s.pos[0], s.pos[2]];
    switch (s.dir) {
      case 0: return { min: [x - half, y0, z - reach], max: [x + half, y1, z] };
      case 2: return { min: [x - half, y0, z], max: [x + half, y1, z + reach] };
      case 1: return { min: [x - reach, y0, z - half], max: [x, y1, z + half] };
      default: return { min: [x, y0, z - half], max: [x + reach, y1, z + half] };
    }
  });
}

/** 箱が範囲のどれかに掛かるか（接するだけは掛からない） */
export function hitsAny(zones: readonly AABB[], b: Box | AABB, eps = 1e-4): boolean {
  return zones.some((z) => b.min[0] < z.max[0] - eps && b.max[0] > z.min[0] + eps && b.min[1] < z.max[1] - eps && b.max[1] > z.min[1] + eps && b.min[2] < z.max[2] - eps && b.max[2] > z.min[2] + eps);
}

/** 箱どうしの重なり（gap だけ広げて見る） */
export function overlaps(a: Box | AABB, b: Box | AABB, gap = 0): boolean {
  return a.min[0] < b.max[0] + gap && a.max[0] > b.min[0] - gap && a.min[1] < b.max[1] + gap && a.max[1] > b.min[1] - gap && a.min[2] < b.max[2] + gap && a.max[2] > b.min[2] - gap;
}

/** 箱の水平の範囲が矩形のどれかに収まるか */
export function insideRects(rects: readonly Rect[], b: Box | AABB, margin = 0): boolean {
  return rects.some((r) => b.min[0] >= r.x0 + margin - 1e-6 && b.max[0] <= r.x1 - margin + 1e-6 && b.min[2] >= r.z0 + margin - 1e-6 && b.max[2] <= r.z1 - margin + 1e-6);
}

/** 点が矩形のどれかに入るか */
export function inRects(rects: readonly Rect[], x: number, z: number, margin = 0): boolean {
  return rects.some((r) => x >= r.x0 + margin && x <= r.x1 - margin && z >= r.z0 + margin && z <= r.z1 - margin);
}

/** 区画の中の当たる物（床板・天井板・外壁を除く。先に置かれた仕掛け・隠しの物・家具） */
export function interiorSolids(cell: CellLayout, except?: ReadonlySet<Box>): Box[] {
  const fy = cell.floorY, h = cell.height;
  const ins = innerRects(cell);
  return cell.boxes.filter((b) => b.solid && !except?.has(b) && b.max[1] > fy + 0.01 && b.min[1] < fy + h - 0.01 && ins.some((q) => b.min[0] < q.x1 - 1e-4 && b.max[0] > q.x0 + 1e-4 && b.min[2] < q.z1 - 1e-4 && b.max[2] > q.z0 + 1e-4));
}

// ---------------------------------------------------------------- 家具のまとまり

/** 1 つの物（Box.propGroup が同じ箱の組。組の無い箱は 1 つで 1 つの物） */
export interface Group {
  key: string;
  boxes: Box[];
  /** 当たる箱を含むか */
  solid: boolean;
}

export function bbOf(boxes: readonly (Box | AABB)[]): AABB {
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, b.min[k]!); max[k] = Math.max(max[k]!, b.max[k]!); }
  return { min, max };
}

/** 箱を物ごとにまとめる（並びは最初に出た順） */
export function groupsOf(boxes: readonly Box[]): Group[] {
  const by = new Map<string, Group>();
  boxes.forEach((b, i) => {
    const key = b.propGroup ?? `#${i}`;
    let g = by.get(key);
    if (!g) by.set(key, (g = { key, boxes: [], solid: false }));
    g.boxes.push(b);
    if (b.solid) g.solid = true;
  });
  return [...by.values()];
}

/** 壁に貼った飾り（当たらない薄い物が壁の室内面に付いている: 腰壁・掲示板・額・窓・時計） */
export function isWallDecor(g: Group, cell: CellLayout): boolean {
  if (g.solid) return false;
  const bb = bbOf(g.boxes);
  const near = 0.08;
  return innerRects(cell).some((r) =>
    ((Math.abs(bb.min[0] - r.x0) < near || Math.abs(bb.max[0] - r.x1) < near) && bb.max[0] - bb.min[0] < 0.25) ||
    ((Math.abs(bb.min[2] - r.z0) < near || Math.abs(bb.max[2] - r.z1) < near) && bb.max[2] - bb.min[2] < 0.25));
}

/** 水の材質（水面・浅い水・水たまり） */
const WATER_MATS: ReadonlySet<MatId> = new Set<MatId>(['water', 'waterShallow', 'puddle']);

/**
 * 床の造作（区画の中身が床に沈めた水槽: kind 'basin' / 'basinSlab'）と水。家具として動かさない・裏返さない・片付けない
 */
export function isFloorFixture(b: Box): boolean {
  return b.kind === 'basin' || b.kind === 'basinSlab' || WATER_MATS.has(b.mat);
}

/**
 * 動かせる物（propGroup の付いた、当たる箱を含む物）。組の無い当たる箱は造作（迷路の壁・間仕切り・柱・プールのデッキ）として外す。
 * 床の造作（水槽・水）を含む組も外す
 */
export function objectGroups(furniture: readonly Box[], cell: CellLayout): Group[] {
  return groupsOf(furniture).filter((g) => g.solid && g.boxes.every((b) => b.propGroup && !isFloorFixture(b)) && !isWallDecor(g, cell));
}

/** 組の箱をまとめて取り除く印（ctx.removeBoxes に渡す） */
export function boxSet(groups: readonly Group[]): Set<Box> {
  return new Set(groups.flatMap((g) => g.boxes));
}

// ---------------------------------------------------------------- 箱の変形（その場で書き換える）

/** 箱の座標を写し取る / 戻す（変形を試して戻すため） */
export function saveCoords(boxes: readonly Box[]): number[][] {
  return boxes.map((b) => [...b.min, ...b.max, b.solid ? 1 : 0]);
}

export function loadCoords(boxes: readonly Box[], saved: readonly number[][]): void {
  boxes.forEach((b, i) => {
    const s = saved[i]!;
    b.min = [s[0]!, s[1]!, s[2]!];
    b.max = [s[3]!, s[4]!, s[5]!];
    b.solid = s[6] === 1;
  });
}

export function moveBox(b: Box, dx: number, dy: number, dz: number): void {
  b.min = [b.min[0] + dx, b.min[1] + dy, b.min[2] + dz];
  b.max = [b.max[0] + dx, b.max[1] + dy, b.max[2] + dz];
}

/** 点 (ax, ay, az) を中心に s 倍 */
export function scaleBox(b: Box, s: number, ax: number, ay: number, az: number): void {
  b.min = [ax + (b.min[0] - ax) * s, ay + (b.min[1] - ay) * s, az + (b.min[2] - az) * s];
  b.max = [ax + (b.max[0] - ax) * s, ay + (b.max[1] - ay) * s, az + (b.max[2] - az) * s];
  if (b.slope) b.slope = { ...b.slope, rise: b.slope.rise * s };
}

/** (cx, cz) を中心に y 軸まわりへ 90°×k 回す（傾けた箱は回さない。呼ぶ側で除く） */
export function rotBoxY(b: Box, k: number, cx: number, cz: number): void {
  const q = ((k % 4) + 4) % 4;
  if (!q) return;
  const rot = (x: number, z: number): [number, number] => {
    const dx = x - cx, dz = z - cz;
    return q === 1 ? [cx - dz, cz + dx] : q === 2 ? [cx - dx, cz - dz] : [cx + dz, cz - dx];
  };
  const a = rot(b.min[0], b.min[2]), c = rot(b.max[0], b.max[2]);
  b.min = [Math.min(a[0], c[0]), b.min[1], Math.min(a[1], c[1])];
  b.max = [Math.max(a[0], c[0]), b.max[1], Math.max(a[1], c[1])];
}

/**
 * 倒す: 水平な軸のまわりに 90° 回す。toward の向き（'x' / 'z' 軸の sign 側）へ、点 (p, py)（倒れる側の下の辺）を支点に倒れる。
 * 上にあった点は toward の側の床に、支点の反対側の床にあった点は持ち上がる
 */
export function tipBox(b: Box, axis: 'x' | 'z', sign: 1 | -1, p: number, py: number): void {
  const k = axis === 'x' ? 0 : 2;
  const map = (u: number, y: number): [number, number] => [p + sign * (y - py), py - sign * (u - p)];
  const a = map(b.min[k]!, b.min[1]), c = map(b.max[k]!, b.max[1]);
  const min = [...b.min] as [number, number, number], max = [...b.max] as [number, number, number];
  min[k] = Math.min(a[0], c[0]); max[k] = Math.max(a[0], c[0]);
  min[1] = Math.min(a[1], c[1]); max[1] = Math.max(a[1], c[1]);
  b.min = min;
  b.max = max;
}

/** 上下を反転する（床 fy・天井 fy + h の間で鏡写し） */
export function mirrorBoxY(b: Box, fy: number, h: number): void {
  const m = (y: number): number => 2 * fy + h - y;
  const y0 = m(b.max[1]), y1 = m(b.min[1]);
  b.min = [b.min[0], y0, b.min[2]];
  b.max = [b.max[0], y1, b.max[2]];
  if (b.slope) b.slope = { ...b.slope, rise: -b.slope.rise };
}

// ---------------------------------------------------------------- 材質

/** 光る材質と、消したときの材質（client/render/MaterialLibrary の emission のある材質） */
export const LIGHT_OFF: Partial<Record<MatId, MatId>> = {
  lightPanel: 'lightOff', lightWarm: 'lightOff', lightGreen: 'lightOff', lightYellow: 'lightOff', ledBlue: 'lightOff', sodiumLight: 'lightOff',
  screenGlow: 'screenDark', screenLcd: 'screenDark', screenArcade: 'screenDark', screenPc: 'screenDark', aquariumBlue: 'screenDark',
  neonRed: 'metalDark', neonBlue: 'metalDark', signEmissive: 'signPlate', canLabel: 'metalDark',
  windowNight: 'windowDark', windowLit: 'windowDark',
};

/** 色を抜かない材質（光る物・水・ガラス・空。白い部屋でも光り方と透け方は残す） */
export const KEEP_COLOR: ReadonlySet<MatId> = new Set<MatId>([
  ...(Object.keys(LIGHT_OFF) as MatId[]), 'lightOff', 'glass', 'carGlass', 'water', 'waterShallow', 'waterWall', 'waterFilm', 'puddle', 'shadowDecal',
  'skyDay', 'skyOvercast', 'skyDusk', 'skyNoon', 'outsideView', 'void',
]);

/** 天井の照明パネル（区画の殻が付けた物。部品で入切する照明は除く） */
export function isCeilingPanel(cell: CellLayout, b: Box): boolean {
  return !b.solid && b.mat === cell.palette.light && !b.kind?.startsWith('lamp:') && b.min[1] > cell.floorY + cell.height - 0.12;
}

/** 区画の殻の床板・天井板（足跡の矩形を覆う当たる板） */
export function isFloorSlab(cell: CellLayout, b: Box): boolean {
  return b.solid && Math.abs(b.max[1] - cell.floorY) < 1e-3 && b.min[1] < cell.floorY - 0.1;
}

export function isCeilingSlab(cell: CellLayout, b: Box): boolean {
  return b.solid && Math.abs(b.min[1] - (cell.floorY + cell.height)) < 1e-3 && b.max[1] > cell.floorY + cell.height + 0.1;
}

/** 2 つの色（0xRRGGBB）を t で混ぜる */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (c: number, s: number): number => (c >> s) & 0xff;
  const m = (s: number): number => Math.round(ch(a, s) * (1 - t) + ch(b, s) * t) << s;
  return m(16) | m(8) | m(0);
}
