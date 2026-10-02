/**
 * 縮むくり返し（F20）: 「廊下 → 扉 → 部屋」の同じ組が、くり返すたびに structure.shrink.ratio 倍に縮む。
 * 部屋の広さ・天井・廊下の幅と高さ・扉も縮み、最後の方はしゃがまないと通れない（天井の下限 structure.shrink.minHeightM）。
 * 部屋の家具は、最初の部屋の家具を縮めて写す（中身を置いた後。afterDress）。同じ部屋がだんだん小さくなっていく。
 * 組は入口から奥へ一列（左右に少しずつずれる）。出口は最後の（いちばん小さい）部屋の奥の、小さな扉の階段
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { Rng } from '../../../math/rng.ts';
import { opening } from '../../../world/build.ts';
import type { Rect } from '../../../world/footprint.ts';
import { DOOR_H, DOOR_W, type Box, type LightSpec } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import { reachOpenings } from '../../reach.ts';
import type { FloorProfile } from '../profile.ts';
import { entryStairs, exitStairs, GeoBuild, snap, type AfterDressEnv, type FloorGeometry, type Placed, type StraightSpec } from '../geometry.ts';
import type { SkelNode } from '../skeleton.ts';

const node = (id: number): SkelNode => ({ id, col: 0, row: 0, kind: 'room', level: 0, hall: -1, story: 0 });

export function buildShrink(p: FloorProfile, rng: Rng, t: Tuning): FloorGeometry {
  const fam = p.family;
  const cw = snap(rng.float(fam.corridorWidth[0], fam.corridorWidth[1]));
  const hc = snap(rng.float(fam.corridorHeight[0], fam.corridorHeight[1]));
  const g = new GeoBuild(p, t, rng.fork('doors'), cw);
  const ratio = t['structure.shrink.ratio'];
  const count = t['structure.shrink.count'];
  const minH = t['structure.shrink.minHeightM'];
  // 最初の組の寸法（同じ組をくり返す）
  const W0 = snap(rng.float(7.0, 8.6)), D0 = snap(rng.float(6.5, 8.0)), H0 = snap(Math.max(2.8, rng.float(fam.roomHeight[0], fam.roomHeight[1])));
  const C0 = snap(rng.float(4.5, 6.0));
  const theme = rng.weighted(fam.rooms, ([, w]) => w)[0];
  const pal = themePalette(theme);
  // 入口の部屋（ふつうの大きさ）
  const entry: Placed = { node: node(-1), rect: { x0: -3, x1: 3, z0: -5, z1: 0 }, y: 0, height: Math.max(2.7, hc), theme: fam.corridor, kind: 'room', cellId: 'kEntry', fam, opts: { role: 'entry', name: '入口' } };
  g.cell(entry);
  entryStairs(g, entry, hc);
  let z = entry.rect.z0;
  let x = 0;
  let prev: Placed = entry;
  const rooms: Placed[] = [];
  // 部屋の奥の扉の、部屋の真ん中からのずれ（最初の部屋の幅に対する割合。どの組も同じ割合 = 同じ配置）
  const off = rng.float(-0.18, 0.18);
  for (let k = 0; k < count; k++) {
    const s = ratio ** k;
    const w = snap(Math.max(3.2, W0 * s)), d = snap(Math.max(3.0, D0 * s));
    const h = snap(Math.max(minH, H0 * s));
    const cl = snap(Math.max(1.6, C0 * s));
    const cwk = snap(Math.max(1.15, cw * s)), hck = snap(Math.max(minH, Math.min(hc, H0) * s));
    const dw = snap(Math.max(0.9, DOOR_W * s)), dh = snap(Math.max(minH - 0.05, Math.min(DOOR_H * s, h - 0.15)));
    // 廊下（前の部屋の奥の壁から、次の部屋まで）。扉はこの組の部屋の入口
    const nx = snap(k === 0 ? x : x + off * (prev.rect.x1 - prev.rect.x0));
    const cid = `kc${k}`;
    const z1 = z, z0 = snap(z - cl);
    const corr: StraightSpec = { id: cid, axis: 'z', a0: z0, a1: z1, center: nx, width: cwk, y: 0, height: hck, kind: 'corridor', role: 'connector', name: '廊下' };
    g.straights.push(corr);
    const ow = Math.min(cwk - 0.3, prev === entry ? 1.6 : cwk - 0.3);
    const oh = Math.min(hck, prev.height - 0.2);
    g.addOpening(prev.cellId, opening(`${prev.cellId}:${cid}`, [nx, 0, z1], 2, ow, oh));
    g.addOpening(cid, opening(`${cid}:a1`, [nx, 0, z1], 0, ow, oh));
    g.join(cid, prev.cellId, 'z', z1, nx, 0, ow, oh, 0, null);
    // 部屋（扉の向こう）
    const rect: Rect = { x0: snap(nx - w / 2), x1: snap(nx + w / 2), z0: snap(z0 - d), z1: z0 };
    const pl: Placed = { node: node(k), rect, y: 0, height: h, theme, kind: 'room', cellId: `kr${k}`, fam, opts: { role: k === count - 1 ? 'exit' : 'gimmick', name: k === 0 ? '部屋' : 'また同じ部屋' } };
    g.cell(pl);
    rooms.push(pl);
    g.addOpening(cid, opening(`${cid}:a0`, [nx, 0, z0], 2, dw, dh));
    g.addOpening(pl.cellId, opening(`${pl.cellId}:${cid}`, [nx, 0, z0], 0, dw, dh));
    g.join(cid, pl.cellId, 'z', z0, nx, 0, dw, dh, 2, { cell: pl.cellId, mat: pal.door, swing: 1 });
    // 小さな組は仕掛け・異変を置かない（縮んだ家具をそのまま見せる）
    if (k >= 2) g.reserved.add(pl.cellId);
    prev = pl;
    x = nx;
    z = rect.z0;
  }
  // 出口: 最後の部屋の奥の、小さな扉の階段
  const last = rooms[rooms.length - 1]!;
  const sL = ratio ** (count - 1);
  exitStairs(g, last, 2, 0, Math.max(minH, hc * sL), { id: 'exitStairs', exitId: 'down', doorId: 'door:exit', at: snap(x + off * (last.rect.x1 - last.rect.x0)), doorW: snap(Math.max(0.9, DOOR_W * sL)), doorH: snap(Math.max(minH - 0.05, Math.min(DOOR_H * sL, last.height - 0.15))) });
  // 家具: 最初の部屋の中身を、くり返しの部屋へ縮めて写す
  g.afterDress.push((env) => copyShrunk(g, rooms, ratio, env));
  return g.finish(null);
}

/** 最初の部屋（rooms[0]）の中身（家具の箱と照明）を、k 番目の部屋へ ratio^k 倍に縮めて写す（部屋の真ん中・床を基準に） */
function copyShrunk(g: GeoBuild, rooms: Placed[], ratio: number, env: AfterDressEnv): void {
  const src = g.geo(rooms[0]!.cellId)?.cell;
  if (!src || env.busy.has(src.id) || !env.dressedFrom.has(src.id) || src.zones.length) return;
  const from = env.dressedFrom.get(src.id)!;
  const sr = rooms[0]!.rect;
  const scx = (sr.x0 + sr.x1) / 2, scz = (sr.z0 + sr.z1) / 2;
  const furniture = src.boxes.slice(from);
  const lights = src.lights;
  rooms.forEach((pl, k) => {
    if (k === 0) return;
    const cell = g.geo(pl.cellId)?.cell;
    if (!cell || env.busy.has(cell.id) || !env.dressedFrom.has(cell.id) || cell.zones.length) return;
    const s = ratio ** k;
    const r = pl.rect;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const sx = (r.x1 - r.x0) / (sr.x1 - sr.x0), sz = (r.z1 - r.z0) / (sr.z1 - sr.z0), sy = cell.height / src.height;
    const tf = (b: Box): Box => {
      const out: Box = { ...b, min: [cx + (b.min[0] - scx) * sx, cell.floorY + (b.min[1] - src.floorY) * sy, cz + (b.min[2] - scz) * sz], max: [cx + (b.max[0] - scx) * sx, cell.floorY + (b.max[1] - src.floorY) * sy, cz + (b.max[2] - scz) * sz] };
      if (b.slope) out.slope = { axis: b.slope.axis, rise: b.slope.rise * sy };
      if (b.propGroup) out.propGroup = `${b.propGroup}:k${k}`;
      return out;
    };
    const fb = env.dressedFrom.get(cell.id)!;
    const own = { boxes: cell.boxes, lights: cell.lights };
    const copied = furniture.map(tf);
    cell.boxes = [...cell.boxes.slice(0, fb), ...copied];
    cell.lights = lights.map((l): LightSpec => ({ ...l, pos: [cx + (l.pos[0] - scx) * sx, cell.floorY + (l.pos[1] - src.floorY) * sy, cz + (l.pos[2] - scz) * sz], distance: l.distance * Math.max(0.6, s) }));
    // 縮んだ家具の間は人が通れないことがある: 開口どうしがつながるまで、開口を結ぶ線に近い家具から外す（だめなら元の中身）
    const ops = g.geo(pl.cellId)!.openings;
    const doors = ops.filter((o) => Math.abs(o.pos[1] - cell.floorY) < 0.5);
    const groupOf = (b: Box): string => b.propGroup ?? `${b.min.join(',')}`;
    // 開口の前（内側 1.3 m・幅は開口 + 0.8 m）に掛かる家具は外す（縮んだ部屋でも扉の前に立てる）
    const fronts = doors.map((o) => {
      const ix = [0, -1, 0, 1][o.dir]!, iz = [-1, 0, 1, 0][o.dir]!;
      const hw = o.width / 2 + 0.4;
      return ix === 0 ? { x0: o.pos[0] - hw, x1: o.pos[0] + hw, z0: Math.min(o.pos[2], o.pos[2] + iz * 1.3), z1: Math.max(o.pos[2], o.pos[2] + iz * 1.3) } : { x0: Math.min(o.pos[0], o.pos[0] + ix * 1.3), x1: Math.max(o.pos[0], o.pos[0] + ix * 1.3), z0: o.pos[2] - hw, z1: o.pos[2] + hw };
    });
    const inFront = new Set(cell.boxes.slice(fb).filter((b) => b.solid && fronts.some((f) => b.min[0] < f.x1 && b.max[0] > f.x0 && b.min[2] < f.z1 && b.max[2] > f.z0)).map(groupOf));
    if (inFront.size) cell.boxes = cell.boxes.filter((b, j) => j < fb || !inFront.has(groupOf(b)));
    const near = (b: Box): number => Math.min(...doors.map((o) => Math.hypot((b.min[0] + b.max[0]) / 2 - o.pos[0], (b.min[2] + b.max[2]) / 2 - o.pos[2])), Math.abs((b.min[0] + b.max[0]) / 2 - cx));
    for (let i = 0; i < 40; i++) {
      const r2 = reachOpenings(cell, ops, 0.1);
      if (!r2 || !r2.blocked.length) return;
      const solids = cell.boxes.slice(fb).filter((b) => b.solid);
      if (!solids.length) break;
      const worst = solids.reduce((a2, b) => (near(b) < near(a2) ? b : a2));
      const gk = groupOf(worst);
      cell.boxes = cell.boxes.filter((b, j) => j < fb || groupOf(b) !== gk);
    }
    cell.boxes = own.boxes;
    cell.lights = own.lights;
  });
}
