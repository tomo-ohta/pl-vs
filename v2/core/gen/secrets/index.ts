/**
 * 隠し発見の仕組み（v2-plan.md 4.3）: 仕掛けが差し出した隠しの元（SecretOffer）に、隠し場所を付ける。
 *
 * - 隠し場所は、入口（壁の開口）の向こうに新しい区画（role 'secret'）として置く。ほかの区画と重ならない所を探す
 * - 存在型: 入口は最初から開いている（見えにくいだけ）/ 出現型: 入口を concealGroup の箱で塞ぎ、reveal 部品を
 *   裏の振る舞いの出力（offer.revealOutput）につなぐ
 * - 隠し先の中身は調整表の重み（secrets.dest.*）で引く: 隠し部屋・特殊個室・別のフロアへの抜け道・裏のフロア（・手がかり＝隠し部屋）
 * - 区画を作れなければ false（その隠しは付けない）
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import type { Rng } from '../../math/rng.ts';
import type { Dir } from '../../math/vec.ts';
import { lightPanel, makeCell, opening, portal, portalAabb } from '../../world/build.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, WALL_T, type Box, type CellLayout, type EntitySpec, type FloorExit, type PortalSpec, type WallOpening } from '../../world/layout.ts';
import { themePalette } from '../../world/palettes.ts';
import type { GeoCell } from '../floor/geometry.ts';
import type { SecretMode, SecretOffer } from '../gimmicks/types.ts';

export type SecretDest = 'passage' | 'room' | 'privateRoom' | 'rareRoom' | 'floorLink' | 'bFloor' | 'clue';
const DESTS: SecretDest[] = ['passage', 'room', 'privateRoom', 'rareRoom', 'floorLink', 'bFloor', 'clue'];

export interface SecretWorld {
  cells: GeoCell[];
  portals: PortalSpec[];
  entities: EntitySpec[];
  exits: FloorExit[];
  depth: number;
}

export interface PlacedSecret { id: string; host: string; hook: string; mode: SecretMode; dest: SecretDest; cell: string }

const snap = (v: number): number => Math.round(v * 20) / 20;

/** 候補の矩形がほかの区画と重ならないか（高さの範囲が重なる区画だけ見る） */
function free(world: SecretWorld, r: Rect, y0: number, y1: number, ignore: string): boolean {
  for (const g of world.cells) {
    const b = g.cell.bounds;
    if (g.cell.id === ignore) {
      // 入口の区画とは、壁の面で接するだけ（中に食い込まない）
      continue;
    }
    if (b.max[1] <= y0 || b.min[1] >= y1) continue;
    if (r.x0 < b.max[0] - 0.02 && r.x1 > b.min[0] + 0.02 && r.z0 < b.max[2] - 0.02 && r.z1 > b.min[2] + 0.02) return false;
  }
  return true;
}

/** forceDest: 行き先を決めて付ける（見本のフロア用。既定は調整表 secrets.dest.* の重みで引く） */
export function attachSecret(world: SecretWorld, host: GeoCell, offer: SecretOffer, mode: SecretMode, rng: Rng, t: Tuning, index: number, forceDest?: SecretDest): PlacedSecret | null {
  const d = offer.doorway;
  const hr = host.cell.footprint.reduce((a, r) => ((r.x1 - r.x0) * (r.z1 - r.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? r : a));
  const edge = d.dir === 0 ? hr.z1 : d.dir === 2 ? hr.z0 : d.dir === 1 ? hr.x1 : hr.x0;
  const sgn = d.dir === 0 || d.dir === 1 ? 1 : -1;
  const y = offer.floorY ?? d.y;
  const height = 2.6;
  // 大きさを変えながら置ける所を探す（奥行き 4.2 → 2.6）
  let rect: Rect | null = null;
  for (const [depth, width] of [[4.2, 4.6], [3.6, 4.0], [3.0, 3.4], [2.6, 2.8], [2.2, 2.4]] as const) {
    const a0 = edge, a1 = edge + sgn * depth;
    const c = d.at;
    const r: Rect = d.dir === 0 || d.dir === 2
      ? { x0: snap(c - width / 2), x1: snap(c + width / 2), z0: snap(Math.min(a0, a1)), z1: snap(Math.max(a0, a1)) }
      : { x0: snap(Math.min(a0, a1)), x1: snap(Math.max(a0, a1)), z0: snap(c - width / 2), z1: snap(c + width / 2) };
    if (free(world, r, y - 0.3, y + height + 0.3, host.cell.id)) { rect = r; break; }
  }
  if (!rect) return null;
  const id = `secret${index}`;
  const dest = forceDest ?? rng.weighted(DESTS, (k) => t[`secrets.dest.${k}` as const]);
  const back = ((d.dir + 2) % 4) as Dir;
  const doorPos: [number, number, number] = d.dir === 0 || d.dir === 2 ? [d.at, d.y, edge] : [edge, d.y, d.at];
  const ops: WallOpening[] = [opening(`${id}:in`, doorPos, back, d.width, d.height)];
  const palette = dest === 'privateRoom' ? { ...themePalette('Gallery'), wall: 'paintWhite' as const, floor: 'marbleWhite' as const, ceiling: 'paintWhite' as const } : { ...themePalette('Gallery'), light: 'lightWarm' as const, lightColor: 0xffd29a, lightIntensity: 0.75 };
  const cell: CellLayout = makeCell({ id, role: 'secret', rects: [rect], height, floorY: y, palette, theme: 'Gallery', name: '隠し部屋', audioPreset: '静かな空調', openings: ops, lightSpacing: 2.6 });
  // 入口の区画の壁を開ける（入口の前後 0.35 m の箱を、開口の範囲だけ切り取る）
  const cut: AABB = d.dir === 0 || d.dir === 2
    ? { min: [d.at - d.width / 2, d.y + 0.01, Math.min(edge, edge - sgn * 0.35)], max: [d.at + d.width / 2, d.y + d.height, Math.max(edge, edge - sgn * 0.35)] }
    : { min: [Math.min(edge, edge - sgn * 0.35), d.y + 0.01, d.at - d.width / 2], max: [Math.max(edge, edge - sgn * 0.35), d.y + d.height, d.at + d.width / 2] };
  carve(host.cell, cut);
  host.openings.push(opening(`${host.cell.id}:${id}`, doorPos, d.dir, d.width, d.height));
  // 出現型: 入口を塞ぐ箱（入口の区画の壁の厚み + 隠し部屋の壁の厚み）
  if (mode === 'appear') {
    const group = `${id}.wall`;
    const plug = (cellRef: CellLayout, a: number, b: number): void => {
      const pb: Box = d.dir === 0 || d.dir === 2
        ? box([d.at - d.width / 2, d.y, Math.min(a, b)], [d.at + d.width / 2, d.y + d.height, Math.max(a, b)], cellRef.palette.wall)
        : box([Math.min(a, b), d.y, d.at - d.width / 2], [Math.max(a, b), d.y + d.height, d.at + d.width / 2], cellRef.palette.wall);
      pb.concealGroup = group;
      cellRef.boxes.push(pb);
    };
    plug(host.cell, edge, edge - sgn * WALL_T);
    plug(cell, edge, edge + sgn * WALL_T);
    world.entities.push({ id: `${id}.reveal`, type: 'reveal', cell: host.cell.id, params: { group, pos: [...doorPos], style: 'slideOpen' }, inputs: { show: offer.revealOutput! } });
  }
  world.portals.push(portal(`p:${host.cell.id}:${id}`, host.cell.id, id, portalAabb(d.dir === 0 || d.dir === 2 ? 'z' : 'x', edge, d.at, d.width, d.y, d.height), d.dir, 'opening'));
  // 入口から隠し部屋の床への段差（入口の y と床の y が違うとき）
  if (y < d.y - 0.01) cell.boxes.push(d.dir === 0 || d.dir === 2 ? box([d.at - d.width / 2, y, Math.min(edge, edge + sgn * 0.6)], [d.at + d.width / 2, d.y, Math.max(edge, edge + sgn * 0.6)], palette.floor) : box([Math.min(edge, edge + sgn * 0.6), y, d.at - d.width / 2], [Math.max(edge, edge + sgn * 0.6), d.y, d.at + d.width / 2], palette.floor));
  furnishSecret(world, cell, rect, y, dest, rng, id);
  // 入るまで暗い（入口の奥が明るくて目立たないように）。入ると灯り、そのまま点いている。目印の光（穴の縁など）は点いたまま
  const lamp = `${id}.lamp`;
  for (const b of cell.boxes) if (b.mat === cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06) b.kind = `lamp:${lamp}`;
  for (const l of cell.lights) l.lampId = lamp;
  const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2;
  world.entities.push(
    { id: `${id}.enter`, type: 'zoneSensor', cell: id, params: { aabb: { min: [rect.x0 + 0.2, y - 0.1, rect.z0 + 0.2], max: [rect.x1 - 0.2, y + 2.4, rect.z1 - 0.2] } } },
    { id: `${id}.seen`, type: 'latch', cell: id, params: {}, inputs: { set: `${id}.enter.in` } },
    { id: lamp, type: 'lamp', cell: id, params: { on: false, rate: 2.5, pos: [cx, y + 2.2, cz] }, inputs: { on: `${id}.seen.out` } },
  );
  world.cells.push({ cell, kind: 'secret', openings: ops, node: -1 });
  return { id, host: host.cell.id, hook: offer.hook, mode, dest, cell: id };
}

/** 箱のうち a と重なる部分を切り取る（壁・穴の側壁に開口を開ける） */
function carve(cell: CellLayout, a: AABB): void {
  const out: Box[] = [];
  for (const b of cell.boxes) {
    if (!b.solid || !(b.min[0] < a.max[0] && b.max[0] > a.min[0] && b.min[1] < a.max[1] && b.max[1] > a.min[1] && b.min[2] < a.max[2] && b.max[2] > a.min[2])) { out.push(b); continue; }
    // 6 方向に切り分けて、重なる部分を除く
    const put = (min: [number, number, number], max: [number, number, number]): void => { if (max[0] - min[0] > 1e-3 && max[1] - min[1] > 1e-3 && max[2] - min[2] > 1e-3) out.push({ ...b, min, max }); };
    const x0 = Math.max(b.min[0], a.min[0]), x1 = Math.min(b.max[0], a.max[0]);
    const y0 = Math.max(b.min[1], a.min[1]), y1 = Math.min(b.max[1], a.max[1]);
    put([b.min[0], b.min[1], b.min[2]], [x0, b.max[1], b.max[2]]);
    put([x1, b.min[1], b.min[2]], [b.max[0], b.max[1], b.max[2]]);
    put([x0, b.min[1], b.min[2]], [x1, y0, b.max[2]]);
    put([x0, y1, b.min[2]], [x1, b.max[1], b.max[2]]);
    put([x0, y0, b.min[2]], [x1, y1, Math.max(b.min[2], a.min[2])]);
    put([x0, y0, Math.min(b.max[2], a.max[2])], [x1, y1, b.max[2]]);
  }
  cell.boxes = out;
}

function furnishSecret(world: SecretWorld, cell: CellLayout, r: Rect, y: number, dest: SecretDest, rng: Rng, id: string): void {
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  switch (dest) {
    case 'privateRoom': {
      // 特殊個室 [QR]: 白一色の部屋に、大きすぎる椅子が 1 脚
      const s = rng.float(2.2, 3.0);
      // 布張り（白い壁と床から浮くように、壁とは別の白）
      cell.boxes.push(box([cx - 0.25 * s, y, cz - 0.25 * s], [cx + 0.25 * s, y + 0.45 * s, cz + 0.25 * s], 'whiteFabric'));
      cell.boxes.push(box([cx - 0.25 * s, y + 0.45 * s, cz + 0.2 * s], [cx + 0.25 * s, y + 0.95 * s, cz + 0.25 * s], 'whiteFabric'));
      break;
    }
    case 'floorLink':
    case 'bFloor': {
      // 別のフロアへ: 床の真ん中の下りの穴（落ちると次へ）。裏のフロアは同じ深さの別の版
      const hole: Rect = { x0: cx - 0.7, x1: cx + 0.7, z0: cz - 0.7, z1: cz + 0.7 };
      cell.boxes = cell.boxes.filter((b) => !(b.solid && Math.abs(b.max[1] - y) < 1e-3 && b.max[1] - b.min[1] <= 0.25));
      for (const [x0, z0, x1, z1] of [[r.x0, r.z0, r.x1, hole.z0], [r.x0, hole.z1, r.x1, r.z1], [r.x0, hole.z0, hole.x0, hole.z1], [hole.x1, hole.z0, r.x1, hole.z1]] as const) cell.boxes.push(box([x0, y - 0.2, z0], [x1, y, z1], cell.palette.floor));
      cell.boxes.push(box([hole.x0, y - 6, hole.z0], [hole.x0 + 0.1, y, hole.z1], 'void'), box([hole.x1 - 0.1, y - 6, hole.z0], [hole.x1, y, hole.z1], 'void'), box([hole.x0, y - 6, hole.z0], [hole.x1, y, hole.z0 + 0.1], 'void'), box([hole.x0, y - 6, hole.z1 - 0.1], [hole.x1, y, hole.z1], 'void'));
      const to = dest === 'bFloor' ? { floor: `${world.depth + 1}.1` } : { floor: `${world.depth + 2}.0` };
      world.exits.push({ id: `${id}:hole`, kind: 'secret', aabb: { min: [hole.x0, y - 6, hole.z0], max: [hole.x1, y - 1.2, hole.z1] }, to });
      // 穴の縁の光（目印）
      lightPanel(cell.boxes, cx, cz, 0.5, 0.5, y + 2.6, 'lightGreen');
      break;
    }
    default: {
      // 隠し部屋: 中身（台座・椅子・祭壇など）は区画の中身（core/gen/dress の secret）が置く。ここでは温かい灯りだけ
      cell.lights.push({ pos: [cx, y + 1.9, cz], color: 0xffd8a0, intensity: 0.5, distance: 4 });
      break;
    }
  }
}
