/**
 * 区域（果てしない階）の出入り口（docs/endless-world.md 3.1・3.2・4 章）: 境目の扉までの廊下と、階段室。
 * 格子の組み立て（geometry.ts）が、区域のときに入口・出口の階段の代わりに呼ぶ（部屋・廊下の置き場所が決まった後、区画を作る前）。
 *
 * - 階段室: down は出口の区画（skeleton の exit）、up は入口の区画（entry）の壁から外へ。置けなければほかの区画・ほかの壁
 * - 境目の扉: 扉のある辺の側の壁を持つ区画（部屋・広間・曲がり角）から、辺へ向かう廊下を引く。扉の位置が区画の壁の範囲にあれば
 *   まっすぐ、ずれていれば縁の帯の中の通路（辺に沿う）で 1 回曲がる。開口は区域の辺の上（扉の部品そのものは世界が持つ）
 * 新しい廊下・階段室は、ほかの区画・廊下・区域の外に掛からない所にだけ置く（置けなければ GenError → 形を作り直す）
 */
import { addDir, rotQ, type Dir, type Vec3 } from '../../math/vec.ts';
import type { Rng } from '../../math/rng.ts';
import { opening } from '../../world/build.ts';
import type { Rect } from '../../world/footprint.ts';
import { DOOR_H, DOOR_W, WALL_T, type RegionAirlockCell, type RegionGateCell, type WallOpening } from '../../world/layout.ts';
import { themePalette } from '../../world/palettes.ts';
import { airlockAnchor, airlockShape, placeAirlock } from '../world/airlock.ts';
import { GenError, RISER_MAX, snap, TREAD, type GeoBuild, type Placed, type StraightSpec } from './geometry.ts';
import { SPECIAL_STYLES, type Skeleton } from './skeleton.ts';

interface PortsEnv { hc: number; doorRng: Rng }

const EPS = 0.04;
const overlaps = (a: Rect, b: Rect): boolean => a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS;
const sgnOf = (d: Dir): number => (d === 0 || d === 1 ? 1 : -1);

/** 区画の矩形の、向き d の壁（座標と、壁に沿った範囲） */
function wallOf(r: Rect, d: Dir): { coord: number; lo: number; hi: number } {
  if (d === 0) return { coord: r.z1, lo: r.x0, hi: r.x1 };
  if (d === 2) return { coord: r.z0, lo: r.x0, hi: r.x1 };
  if (d === 1) return { coord: r.x1, lo: r.z0, hi: r.z1 };
  return { coord: r.x0, lo: r.z0, hi: r.z1 };
}

/** 壁から c1 まで、壁に垂直に伸びる幅 w の矩形（壁に沿った中心 at） */
function perp(d: Dir, c0: number, c1: number, at: number, w: number): Rect {
  return d % 2 === 0
    ? { x0: snap(at - w / 2), x1: snap(at + w / 2), z0: Math.min(c0, c1), z1: Math.max(c0, c1) }
    : { x0: Math.min(c0, c1), x1: Math.max(c0, c1), z0: snap(at - w / 2), z1: snap(at + w / 2) };
}

/** 壁の点（壁に沿った at・壁の座標 coord）の座標 */
const wallPoint = (d: Dir, coord: number, at: number, y: number): Vec3 => (d % 2 === 0 ? [at, y, coord] : [coord, y, at]);

const straightRect = (s: StraightSpec): Rect => (s.axis === 'x'
  ? { x0: s.a0, x1: s.a1, z0: snap(s.center - s.width / 2), z1: snap(s.center + s.width / 2) }
  : { x0: snap(s.center - s.width / 2), x1: snap(s.center + s.width / 2), z0: s.a0, z1: s.a1 });

export function regionPorts(g: GeoBuild, sk: Skeleton, placed: Map<number, Placed>, env: PortsEnv): void {
  const reg = g.p.region!;
  const t = g.t;
  const R = reg.rect;
  const stubW = t['world.gate.stubWidthM'];
  const half = stubW / 2 + WALL_T;
  const all = [...new Set(placed.values())];
  const busy: Rect[] = [];
  for (const pl of [...all, ...g.cellsToBuild]) busy.push(...(pl.rects ?? [pl.rect]));
  for (const s of g.straights) busy.push(straightRect(s));
  const inside = (r: Rect): boolean => r.x0 >= R.x0 - 1e-6 && r.x1 <= R.x1 + 1e-6 && r.z0 >= R.z0 - 1e-6 && r.z1 <= R.z1 + 1e-6;
  const free = (r: Rect): boolean => inside(r) && busy.every((b) => !overlaps(b, r));
  const okHost = (pl: Placed): boolean => pl.node.story === 0 && pl.node.kind !== 'well' && (pl.kind === 'room' || pl.kind === 'hall' || pl.kind === 'junction') && (!pl.node.style || !SPECIAL_STYLES.has(pl.node.style)) && pl.node.style !== 'island';
  const hosts = all.filter(okHost);
  const boundary = (d: Dir): number => (d === 0 ? R.z1 : d === 2 ? R.z0 : d === 1 ? R.x1 : R.x0);

  /** 区画 pl の向き d の壁で、want にいちばん近い、ほかの開口と重ならない位置（幅 w の開口） */
  const pickAlong = (pl: Placed, d: Dir, want: number, w: number): number | null => {
    const wl = wallOf(pl.rect, d);
    const m0 = pl.kind === 'junction' ? WALL_T : 0.9;
    const lo = wl.lo + m0 + w / 2, hi = wl.hi - m0 - w / 2;
    if (lo > hi + 1e-6) return null;
    const on = (g.openings.get(pl.cellId) ?? []).filter((o) => o.dir === d && Math.abs((d % 2 === 0 ? o.pos[2] : o.pos[0]) - wl.coord) < 0.06);
    const okAt = (p: number): boolean => on.every((o) => Math.abs(p - (d % 2 === 0 ? o.pos[0] : o.pos[2])) >= (o.width + w) / 2 + 0.3);
    const start = snap(Math.min(hi, Math.max(lo, want)));
    for (let k = 0; k <= 200; k++) {
      for (const p of k === 0 ? [start] : [snap(start + k * 0.25), snap(start - k * 0.25)]) if (p >= lo - 1e-6 && p <= hi + 1e-6 && okAt(p)) return p;
      if (start + k * 0.25 > hi && start - k * 0.25 < lo) break;
    }
    return null;
  };

  const sealed = new Set<string>();
  const airlocks: RegionAirlockCell[] = [];
  const gates: RegionGateCell[] = [];

  // ---------------------------------------------------------------- 階段室（大きいので先に置く）
  reg.airlocks.forEach((a, i) => {
    const shape = airlockShape(a.id, t);
    const first = a.role === 'down' ? placed.get(sk.exit) : placed.get(sk.entry);
    const order = [...(first && okHost(first) ? [first] : []), ...hosts.filter((h) => h !== first)];
    let best: { pl: Placed; d: Dir; at: number; score: number } | null = null;
    for (const [hi, pl] of order.entries()) {
      for (const d of [0, 1, 2, 3] as Dir[]) {
        const wl = wallOf(pl.rect, d);
        const at = pickAlong(pl, d, (wl.lo + wl.hi) / 2, shape.width + 0.2);
        if (at === null) continue;
        const r = perp(d, wl.coord, wl.coord + sgnOf(d) * shape.length, at, shape.width);
        if (!free(r)) continue;
        // 区域の辺に向いた壁ほどよい（縁の帯へ出す）・最初の候補の区画ほどよい
        const score = hi * 2 + Math.abs(boundary(d) - wl.coord) * 0.05;
        if (!best || score < best.score) best = { pl, d, at, score };
      }
      if (best && hi === 0) break;
    }
    if (!best) throw new GenError(`階段室を置けません: ${a.id}`);
    const { pl, d, at } = best;
    const anchor = airlockAnchor(a.role, wallPoint(d, wallOf(pl.rect, d).coord, at, pl.y), d, shape);
    const cellId = `air${i}`;
    const pa = placeAirlock(a.id, a.role, cellId, pl.cellId, anchor, shape, a.to, t['world.airlock.closeSec']);
    g.addOpening(pl.cellId, pa.hostOpening);
    g.out.portals.push(pa.portal);
    g.out.entities.push(...pa.entities);
    if (pa.exit) g.out.exits.push(pa.exit);
    g.finishers.push((gb) => gb.out.cells.push({ cell: pa.cell, kind: 'stairs', openings: pa.openings, node: -1 }));
    busy.push(pa.rect);
    sealed.add(cellId);
    g.reserved.add(cellId);
    airlocks.push({ id: a.id, role: a.role, cell: cellId, anchor: pa.anchor, live: pa.live, sealed: pa.sealed, to: a.to });
  });

  // ---------------------------------------------------------------- 境目の扉までの廊下
  reg.gates.forEach((gt, gi) => {
    const d = gt.side, s = sgnOf(d), B = gt.line, u = gt.at;
    const end1 = snap(B - s * 2 * half);
    let best: { pl: Placed; at: number; jog: boolean; rise: number; score: number } | null = null;
    for (const pl of hosts) {
      const wl = wallOf(pl.rect, d);
      if (s * (B - wl.coord) < 2.4) continue;
      const at = pickAlong(pl, d, u, stubW);
      if (at === null) continue;
      const jog = Math.abs(at - u) > 0.04;
      const r1 = perp(d, wl.coord, jog ? end1 : B, at, stubW);
      const L1 = Math.abs((jog ? end1 : B) - wl.coord);
      if (L1 < 1.2 || !free(r1)) continue;
      if (jog && !free(perp(((d + 1) % 4) as Dir, Math.min(at, u) - half, Math.max(at, u) + half, B - s * half, 2 * half))) continue;
      const rise = Math.abs(pl.y);
      if (rise > 0.01 && L1 < Math.ceil(rise / RISER_MAX - 1e-9) * TREAD + 1.6) continue;
      const score = Math.abs(at - u) + Math.abs(B - wl.coord) * 0.05 + (rise > 0.01 ? 4 : 0) + (pl.kind === 'junction' ? 2 : 0);
      if (!best || score < best.score) best = { pl, at, jog, rise, score };
    }
    if (!best) throw new GenError(`境目の扉への道が引けません: ${gt.id}`);
    const { pl, at, jog, rise } = best;
    const wl = wallOf(pl.rect, d);
    const axis: 'x' | 'z' = d % 2 === 0 ? 'z' : 'x';
    const door = pl.kind === 'room' ? env.doorRng.chance(t['floor.roomDoorChance']) : pl.kind === 'hall' ? env.doorRng.chance(t['floor.hallDoorChance']) : false;
    const h = snap(Math.min(env.hc, pl.height - 0.2));
    const span = wl.hi - wl.lo;
    const ow = door ? DOOR_W : pl.kind === 'junction' ? Math.min(stubW, span - 2 * WALL_T) : Math.min(stubW, span - 1.2);
    const oh = door ? DOOR_H : Math.min(h, pl.height - 0.2);
    const hostPos = wallPoint(d, wl.coord, at, pl.y);
    g.addOpening(pl.cellId, opening(`${pl.cellId}:gate${gi}`, hostPos, d, ow, oh));
    // 系統の廊下の見た目（区画の系統が区域の系統と違えば、その系統の廊下）
    const look = (sp: StraightSpec): StraightSpec => {
      if (pl.fam !== g.fam) { sp.palette = themePalette(pl.fam.corridor); sp.theme = pl.fam.corridor; sp.audio = pl.fam.corridorAudio; sp.materialKey = `corr:${g.p.id}:${pl.fam.id}`; }
      return sp;
    };
    const far = jog ? end1 : B;
    const L1 = Math.abs(far - wl.coord);
    const s1: StraightSpec = look({ id: `gs${gi}`, axis, a0: Math.min(wl.coord, far), a1: Math.max(wl.coord, far), center: at, width: stubW, y: Math.min(pl.y, 0), height: rise + h, kind: rise > 0.01 ? 'stairs' : 'corridor', role: 'connector', name: rise > 0.01 ? '階段' : '廊下' });
    if (rise > 0.01) {
      const n = Math.ceil(rise / RISER_MAX - 1e-9);
      const hostIsA0 = wl.coord < far;
      const hostLow = pl.y < 0;
      s1.stairs = { lowEnd: hostLow === hostIsA0 ? 'a0' : 'a1', offset: snap((L1 - n * TREAD) / 2), rise };
    }
    g.straights.push(s1);
    g.addOpening(s1.id, opening(`${s1.id}:host`, hostPos, addDir(d, 2), ow, oh));
    g.join(pl.cellId, s1.id, axis, wl.coord, at, pl.y, ow, oh, d, door ? { cell: pl.cellId, mat: themePalette(pl.theme).door, swing: -s } : null);
    busy.push(perp(d, wl.coord, far, at, stubW));
    const gateOpening: WallOpening = opening(`gate${gi}`, wallPoint(d, B, u, 0), d, DOOR_W, DOOR_H);
    if (!jog) {
      g.addOpening(s1.id, gateOpening);
      gates.push({ id: gt.id, cell: s1.id, opening: gateOpening });
      return;
    }
    // 縁の帯の中の通路（辺に沿う。外の壁に境目の開口）
    const lane: StraightSpec = look({ id: `gl${gi}`, axis: axis === 'z' ? 'x' : 'z', a0: snap(Math.min(at, u) - half), a1: snap(Math.max(at, u) + half), center: snap(B - s * half), width: 2 * half, y: 0, height: h, kind: 'corridor', role: 'connector', name: '廊下' });
    g.straights.push(lane);
    const joint = wallPoint(d, end1, at, 0);
    g.addOpening(s1.id, opening(`${s1.id}:lane`, joint, d, stubW, h));
    g.addOpening(lane.id, opening(`${lane.id}:a`, joint, addDir(d, 2), stubW, h));
    g.addOpening(lane.id, gateOpening);
    g.join(s1.id, lane.id, axis, end1, at, 0, stubW, h, d, null);
    busy.push(straightRect(lane));
    gates.push({ id: gt.id, cell: lane.id, opening: gateOpening });
  });

  // ---------------------------------------------------------------- 出てくる位置（上から着く階段室の上の踊り場。無ければ入口の区画）
  const up = airlocks.find((a) => a.role === 'up');
  if (up) {
    const q = up.anchor.q;
    const lp = rotQ([0, 0.02, WALL_T + 0.7], q), f = rotQ([0, 0, 1], q);
    g.out.spawn = { pos: [snap(lp[0] + up.anchor.offset[0]), up.anchor.offset[1] + 0.02, snap(lp[2] + up.anchor.offset[2])], yaw: Math.atan2(-f[0], -f[2]), cell: up.cell };
  } else if (gates.length) {
    // 最初の境目の扉の 1.2 m 内側（廊下の真ん中。家具が無い）に、区域の中を向いて
    const o = gates[0]!.opening, v = rotQ([0, 0, 1], o.dir);
    g.out.spawn = { pos: [snap(o.pos[0] - v[0] * 1.2), 0.02, snap(o.pos[2] - v[2] * 1.2)], yaw: Math.atan2(v[0], v[2]), cell: gates[0]!.cell };
  } else {
    const e = placed.get(sk.entry)!;
    g.out.spawn = { pos: [snap((e.rect.x0 + e.rect.x1) / 2), e.y + 0.02, snap((e.rect.z0 + e.rect.z1) / 2)], yaw: 0, cell: e.cellId };
  }
  const down = airlocks.find((a) => a.role === 'down');
  if (down) g.out.mainTo = down.cell;
  g.out.region = { gates, airlocks };
  g.out.sealed = sealed;
}
