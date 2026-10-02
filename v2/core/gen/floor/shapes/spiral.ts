/**
 * 螺旋（F12）: 真ん中の吹き抜け（底は水。真ん中に長い吊りの灯り、遥か上に天窓）の周りを、四角い回廊が何周もしながら下る。
 *
 * - 回廊は角（平ら）と辺（階段: 1 辺で 1/4 階ずつ下る）のくり返し。structure.spiral.laps 周で 1 周ごとに 1 階（structure.storyHeightM）下る
 * - 辺の内側は手すり（段に沿った胸壁）で、吹き抜けの向こうに上と下の回廊が見える（辺 → 吹き抜けの窓の portal）
 * - 辺の外側に、ときどき部屋の扉（辺の平らな所）。部屋は上下の周で重なる（階の高さだけ離れる）
 * - 入口: いちばん上の角の前の部屋（降りてきた階段）。出口: いちばん下の角から外へ下りる階段
 * 区画が上下に重なるので、床の下に掘る仕掛けは下の周の部屋の上では置かない（geometry.ts の belowFree）
 */
import type { Tuning } from '../../../config/tuning.ts';
import type { Rng } from '../../../math/rng.ts';
import type { Dir } from '../../../math/vec.ts';
import { opening, portal, portalAabb } from '../../../world/build.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type CellLayout } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import type { FloorProfile } from '../profile.ts';
import { entryStairs, exitStairs, GeoBuild, RISER_MAX, snap, TREAD, type FloorGeometry, type Placed, type StraightSpec } from '../geometry.ts';
import type { SkelNode } from '../skeleton.ts';

const node = (id: number): SkelNode => ({ id, col: 0, row: 0, kind: 'room', level: 0, hall: -1, story: 0 });

export function buildSpiral(p: FloorProfile, rng: Rng, t: Tuning): FloorGeometry {
  const fam = p.family;
  const W = snap(Math.min(2.6, Math.max(2.0, rng.float(fam.corridorWidth[0], fam.corridorWidth[1]))));
  // 回廊の天井は、1 周下の回廊の天井と重ならない高さまで（辺の区画は 1/4 階の段差 + 天井）
  const hc = Math.min(2.7, snap(rng.float(fam.corridorHeight[0], fam.corridorHeight[1])));
  const g = new GeoBuild(p, t, rng.fork('doors'), W);
  const SH = t['structure.storyHeightM'];
  const laps = t['structure.spiral.laps'];
  const v = snap(t['structure.spiral.voidM'] / 2);
  const zc = snap(-(v + W + 6));
  const dH = SH / 4;
  const steps = Math.ceil(dH / RISER_MAX - 1e-9);
  const run = steps * TREAD;
  const flat = snap((2 * v - run) / 2);
  const rail = t['structure.railM'];
  const a = v + W / 2;
  const yC = (c: number): number => snap(-c * dH);
  const roomH = (): number => Math.min(snap(rng.float(fam.roomHeight[0], fam.roomHeight[1])), snap(SH - 1.0));
  const corrPal = themePalette(fam.corridor);

  // ---------------------------------------------------------------- 角（平ら）
  const cornerRect = (j: number): Rect => {
    const xs = j === 0 || j === 3 ? [v, v + W] : [-v - W, -v];
    const zs = j === 0 || j === 1 ? [zc + v, zc + v + W] : [zc - v - W, zc - v];
    return { x0: snap(xs[0]!), x1: snap(xs[1]!), z0: snap(zs[0]!), z1: snap(zs[1]!) };
  };
  const corners: Placed[] = [];
  for (let c = 0; c <= laps * 4; c++) {
    const pl: Placed = { node: node(c), rect: cornerRect(c % 4), y: yC(c), height: hc, theme: fam.corridor, kind: 'junction', cellId: `sc${c}`, fam, opts: { role: 'connector', name: '螺旋の角' } };
    corners.push(pl);
    g.cell(pl);
  }

  // ---------------------------------------------------------------- 辺（1/4 階下る階段）と、吹き抜け側の手すり
  interface Side { s: StraightSpec; j: number; c: number; yHi: number; yLo: number; inner: { dir: Dir; coord: number }; outer: { dir: Dir; coord: number } }
  const sides: Side[] = [];
  for (let c = 0; c < laps * 4; c++) {
    const j = c % 4;
    const yHi = yC(c), yLo = yC(c + 1);
    const axis: 'x' | 'z' = j === 0 || j === 2 ? 'x' : 'z';
    const center = j === 0 ? zc + a : j === 1 ? -a : j === 2 ? zc - a : a;
    const [a0, a1] = axis === 'x' ? [-v, v] : [zc - v, zc + v];
    // 歩く向き: 0 は -x、1 は -z、2 は +x、3 は +z。高い端は歩き始め
    const lowEnd: 'a0' | 'a1' = j === 0 || j === 1 ? 'a0' : 'a1';
    const inner = j === 0 ? { dir: 2 as Dir, coord: zc + v } : j === 1 ? { dir: 1 as Dir, coord: -v } : j === 2 ? { dir: 0 as Dir, coord: zc - v } : { dir: 3 as Dir, coord: v };
    const outer = j === 0 ? { dir: 0 as Dir, coord: zc + v + W } : j === 1 ? { dir: 3 as Dir, coord: -v - W } : j === 2 ? { dir: 2 as Dir, coord: zc - v - W } : { dir: 1 as Dir, coord: v + W };
    const s: StraightSpec = { id: `ss${c}`, axis, a0: snap(a0), a1: snap(a1), center: snap(center), width: W, y: yLo, height: snap(dH + hc), kind: 'stairs', role: 'connector', name: '螺旋の回廊', stairs: { lowEnd, offset: flat, rise: snap(yHi - yLo) } };
    s.post = [(cell) => sideRail(cell, s, inner, rail)];
    g.straights.push(s);
    // 両端の開口（高い端は角 c、低い端は角 c + 1）
    const hiA = lowEnd === 'a0' ? s.a1 : s.a0, loA = lowEnd === 'a0' ? s.a0 : s.a1;
    const endDir = (atA: number): Dir => (axis === 'x' ? (atA === s.a1 ? 1 : 3) : (atA === s.a1 ? 0 : 2));
    const pos = (atA: number, y: number): [number, number, number] => (axis === 'x' ? [atA, y, s.center] : [s.center, y, atA]);
    const ow = W - 2 * WALL_T, oh = Math.min(hc, 2.5);
    for (const [atA, y, cp] of [[hiA, yHi, corners[c]!], [loA, yLo, corners[c + 1]!]] as const) {
      const d = endDir(atA);
      g.addOpening(s.id, opening(`${s.id}:${d}`, pos(atA, y), d, ow, oh));
      g.addOpening(cp.cellId, opening(`${cp.cellId}:${s.id}`, pos(atA, y), ((d + 2) % 4) as Dir, ow, oh));
      const pos0 = pos(atA, y);
      g.out.portals.push(portal(`p:${cp.cellId}:${s.id}`, cp.cellId, s.id, portalAabb(axis, atA, s.center, ow, pos0[1], oh), ((d + 2) % 4) as Dir, 'opening'));
    }
    // 吹き抜け側: 壁を外す（手すりは sideRail が段に沿って付ける）
    const ia = (s.a0 + s.a1) / 2;
    g.addOpening(s.id, opening(`${s.id}:void`, axis === 'x' ? [ia, yLo, inner.coord] : [inner.coord, yLo, ia], inner.dir, 2 * v - 0.02, s.height + 0.5));
    sides.push({ s, j, c, yHi, yLo, inner, outer });
  }

  // ---------------------------------------------------------------- 外側の部屋（辺の平らな所の扉の先）
  let rooms = 0;
  for (const sd of sides) {
    if (!rng.chance(0.42)) continue;
    // 扉は辺の高い端の平らな所（低い端にすると、1 周上の部屋と階の高さより近く重なる）
    const high = true;
    const s = sd.s;
    const hiA = s.stairs!.lowEnd === 'a0' ? s.a1 : s.a0;
    const loA = s.stairs!.lowEnd === 'a0' ? s.a0 : s.a1;
    const endA = high ? hiA : loA;
    const inward = endA === s.a1 ? -1 : 1;
    const at = snap(endA + inward * flat / 2);
    const y = high ? sd.yHi : sd.yLo;
    const w = snap(rng.float(4.2, Math.min(6.5, 2 * v))), d = snap(rng.float(4.4, 6.2));
    const c0 = Math.max(s.a0 + 0.05, Math.min(s.a1 - 0.05 - w, at - w / 2 + rng.float(-1, 1)));
    const o = sd.outer;
    const sg = o.dir === 0 || o.dir === 1 ? 1 : -1;
    const n0 = o.coord, n1 = o.coord + sg * d;
    const rect: Rect = s.axis === 'x' ? { x0: snap(c0), x1: snap(c0 + w), z0: snap(Math.min(n0, n1)), z1: snap(Math.max(n0, n1)) } : { x0: snap(Math.min(n0, n1)), x1: snap(Math.max(n0, n1)), z0: snap(c0), z1: snap(c0 + w) };
    if ((s.axis === 'x' ? Math.min(rect.x1, at + 0.5) - Math.max(rect.x0, at - 0.5) : Math.min(rect.z1, at + 0.5) - Math.max(rect.z0, at - 0.5)) < 1.0 - 1e-6) continue;
    const id = `sr${sd.c}`;
    const theme = rng.weighted(fam.rooms, ([, wt]) => wt)[0];
    const pl: Placed = { node: node(100 + sd.c), rect, y, height: roomH(), theme, kind: 'room', cellId: id, fam, opts: { role: 'side', name: '部屋' } };
    g.cell(pl);
    const pos: [number, number, number] = s.axis === 'x' ? [at, y, o.coord] : [o.coord, y, at];
    g.addOpening(s.id, opening(`${s.id}:${id}`, pos, o.dir, DOOR_W, DOOR_H));
    g.addOpening(id, opening(`${id}:${s.id}`, pos, ((o.dir + 2) % 4) as Dir, DOOR_W, DOOR_H));
    const oAxis: 'x' | 'z' = s.axis === 'x' ? 'z' : 'x';
    g.join(s.id, id, oAxis, o.coord, at, y, DOOR_W, DOOR_H, o.dir, { cell: id, mat: themePalette(theme).door, swing: sg > 0 ? (oAxis === 'x' ? 1 : -1) : (oAxis === 'x' ? -1 : 1) });
    rooms++;
  }
  void rooms;

  // ---------------------------------------------------------------- 入口（いちばん上の角の前の部屋）・出口（いちばん下の角から外へ）
  const top = corners[0]!;
  const entry: Placed = {
    node: node(-10), rect: { x0: snap(v + 0.05), x1: snap(v + W + 2.6), z0: top.rect.z1, z1: snap(top.rect.z1 + 4.6) }, y: 0, height: Math.max(2.6, hc + 0.2), theme: fam.corridor, kind: 'room', cellId: 'sEntry', fam,
    opts: { role: 'entry', name: '螺旋の入口', palette: corrPal },
  };
  g.cell(entry);
  const ex = snap(a);
  g.addOpening('sEntry', opening('sEntry:top', [ex, 0, top.rect.z1], 2, W - 0.4, Math.min(hc, 2.5)));
  g.addOpening(top.cellId, opening(`${top.cellId}:entry`, [ex, 0, top.rect.z1], 0, W - 0.4, Math.min(hc, 2.5)));
  g.out.portals.push(portal('p:sEntry:sc0', 'sEntry', top.cellId, portalAabb('z', top.rect.z1, ex, W - 0.4, 0, Math.min(hc, 2.5)), 2, 'opening'));
  entryStairs(g, entry, hc);
  const last = corners[corners.length - 1]!;
  last.opts = { ...(last.opts ?? {}), role: 'exit', name: '螺旋の底' };
  exitStairs(g, last, 1, last.y, hc);

  // ---------------------------------------------------------------- 吹き抜け（壁の無い区画）。辺から窓の portal で見える
  const bottom = snap(-laps * SH - 1.2), topY = snap(hc + 4);
  g.finishers.push((gb) => {
    const hole: Rect = { x0: -v, x1: v, z0: zc - v, z1: zc + v };
    const cell: CellLayout = {
      id: 'spiralVoid', role: 'landmark', bounds: { min: [-v, bottom - 0.3, zc - v], max: [v, topY + 0.2, zc + v] }, footprint: [{ ...hole }], height: topY - bottom, floorY: bottom,
      palette: { ...corrPal, floor: 'water', ambient: 0x2a2c32, fog: 0x0a0b0e }, boxes: [], lights: [], zones: [], name: '吹き抜け', theme: fam.corridor, audioPreset: '低いハム',
      render: { fog: { color: 0x0a0b0e, near: 6, far: 44 } },
    };
    // 底の水と水槽の縁・天窓・真ん中の吊りの灯り
    cell.boxes.push(box([-v, bottom - 0.3, zc - v], [v, bottom, zc + v], 'floorTile', false));
    cell.boxes.push(box([-v + 0.1, bottom, zc - v + 0.1], [v - 0.1, bottom + 0.55, zc + v - 0.1], 'water', false));
    cell.boxes.push(box([-v + 0.4, topY - 0.05, zc - v + 0.4], [v - 0.4, topY, zc + v - 0.4], 'skyOvercast', false));
    const lampY = snap(-laps * SH * 0.45);
    cell.boxes.push(box([-0.015, lampY + 0.4, zc - 0.015], [0.015, topY, zc + 0.015], 'metalDark', false));
    cell.boxes.push(box([-0.25, lampY, zc - 0.25], [0.25, lampY + 0.4, zc + 0.25], 'lightWarm', false));
    cell.lights.push({ pos: [0, lampY - 0.3, zc], color: 0xffd0a0, intensity: 0.9, distance: 16 });
    cell.lights.push({ pos: [0, topY - 1, zc], color: 0xc8d0dc, intensity: 0.5, distance: 12 });
    // 周の間のすきま（天井と上の周の床の間）をふさぐ帯
    for (const sd of sides) {
      const above = sides.find((o) => o.j === sd.j && o.c === sd.c - 4);
      const y0 = sd.yLo + sd.s.height + 0.2, y1 = above ? above.yLo - 0.2 : topY;
      if (y1 - y0 < 0.02) continue;
      const { dir, coord } = sd.inner;
      const sg = dir === 0 || dir === 1 ? -1 : 1; // 吹き抜けの内側の向き
      cell.boxes.push(sd.s.axis === 'x' ? box([-v, y0, Math.min(coord, coord - sg * WALL_T)], [v, y1, Math.max(coord, coord - sg * WALL_T)], corrPal.wall, false) : box([Math.min(coord, coord - sg * WALL_T), y0, zc - v], [Math.max(coord, coord - sg * WALL_T), y1, zc + v], corrPal.wall, false));
      gb.out.portals.push(portal(`p:${sd.s.id}:spiralVoid`, sd.s.id, 'spiralVoid', portalAabb(sd.s.axis === 'x' ? 'z' : 'x', coord, sd.s.axis === 'x' ? 0 : zc, 2 * v - 0.2, sd.yLo, sd.s.height), dir, 'window'));
    }
    gb.out.cells.push({ cell, kind: 'junction', openings: [], node: -1 });
    gb.reserved.add('spiralVoid');
    gb.keep('spiralVoid', { min: [-v, bottom - 1, zc - v], max: [v, topY, zc + v] });
  });
  return g.finish(null);
}

/**
 * 辺の吹き抜け側の胸壁: 段・平らな所ごとに、足元から手すりの高さまでの壁（壁の厚みの帯の中）と笠木。
 * 床の高さは段に沿って変わるので、平らな壁 1 枚にはしない
 */
function sideRail(cell: CellLayout, s: StraightSpec, inner: { dir: Dir; coord: number }, rail: number): void {
  const st = s.stairs!;
  const n = Math.ceil(st.rise / RISER_MAX - 1e-9);
  const riser = st.rise / n;
  const len = s.a1 - s.a0;
  const at = (d: number): number => (st.lowEnd === 'a0' ? s.a0 + d : s.a1 - d);
  const sg = inner.dir === 0 || inner.dir === 1 ? -1 : 1; // 区画の内側の向き（壁の帯）
  const c0 = Math.min(inner.coord, inner.coord + sg * WALL_T), c1 = Math.max(inner.coord, inner.coord + sg * WALL_T);
  const seg = (d0: number, d1: number, floor: number): void => {
    const p = Math.min(at(d0), at(d1)), q = Math.max(at(d0), at(d1));
    if (q - p < 1e-3) return;
    cell.boxes.push(s.axis === 'x' ? box([p, s.y, c0], [q, floor + rail, c1], cell.palette.wall) : box([c0, s.y, p], [c1, floor + rail, q], cell.palette.wall));
    cell.boxes.push(s.axis === 'x' ? box([p, floor + rail, c0 - 0.02], [q, floor + rail + 0.05, c1 + 0.02], 'metal', false) : box([c0 - 0.02, floor + rail, p], [c1 + 0.02, floor + rail + 0.05, q], 'metal', false));
  };
  seg(0, st.offset, s.y);
  for (let i = 0; i < n; i++) seg(st.offset + i * TREAD, st.offset + (i + 1) * TREAD, s.y + (i + 1) * riser);
  seg(st.offset + n * TREAD, len, s.y + st.rise);
}
