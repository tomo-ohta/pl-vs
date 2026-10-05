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
import { airlockAnchor, airlockShape, airlockSpawn, hostFront, placeAirlock } from '../world/airlock.ts';
import { placeLanding, placeOpenHoles } from '../world/landing.ts';
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
  // 升目ごとに下りと上から着く所があるので、その升目の中の区画を先に（区域の中に散らばる）
  const inSlot = (pl: Placed, slot: [number, number]): boolean => {
    const cx = (pl.rect.x0 + pl.rect.x1) / 2, cz = (pl.rect.z0 + pl.rect.z1) / 2;
    return cx >= slot[0] * reg.slotM && cx < (slot[0] + 1) * reg.slotM && cz >= slot[1] * reg.slotM && cz < (slot[1] + 1) * reg.slotM;
  };
  const usedHosts = new Map<Placed, number>();
  reg.airlocks.forEach((a, i) => {
    const shape = airlockShape(a.id, t, a.kind);
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
        // 升目の中の区画・区域の辺に向いた壁ほどよい（縁の帯へ出す）・最初の候補の区画ほどよい・同じ区画に何個も付けない
        const score = (inSlot(pl, a.slot) ? 0 : 60) + hi * 0.5 + Math.abs(boundary(d) - wl.coord) * 0.05 + (usedHosts.get(pl) ?? 0) * 25;
        if (!best || score < best.score) best = { pl, d, at, score };
      }
    }
    if (!best) throw new GenError(`階段室を置けません: ${a.id}`);
    const { pl, d, at } = best;
    const anchor = airlockAnchor(a.role, wallPoint(d, wallOf(pl.rect, d).coord, at, pl.y), d, shape);
    const cellId = `air${i}`;
    const pa = placeAirlock(a.id, a.role, cellId, pl.cellId, anchor, shape, a.to, t['world.airlock.closeSec'], t);
    usedHosts.set(pl, (usedHosts.get(pl) ?? 0) + 1);
    g.addOpening(pl.cellId, pa.hostOpening);
    g.out.portals.push(pa.portal);
    g.out.entities.push(...pa.entities, ...pa.hostEntities);
    // 扉の前（区域の区画の側）は家具を置かない
    g.keep(pl.cellId, hostFront(pa.hostOpening));
    if (pa.exit) g.out.exits.push(pa.exit);
    g.finishers.push((gb) => gb.out.cells.push({ cell: pa.cell, kind: 'stairs', openings: pa.openings, node: -1 }));
    busy.push(pa.rect);
    sealed.add(cellId);
    g.reserved.add(cellId);
    airlocks.push({ id: a.id, kind: a.kind, role: a.role, cell: cellId, anchor: pa.anchor, live: pa.live, sealed: pa.sealed, to: a.to, ...(pa.car ? { car: pa.car } : {}) });
  });

  // ---------------------------------------------------------------- 境目の扉までの廊下
  // 辺ごとに、扉を辺に沿った順に見る。扉ごとに区画の壁から縁の帯まで廊下（stub）を引き、縁の帯の中の通路（lane）で扉へ。
  // 隣の扉の通路と重なる・届く扉は同じ通路にまとめる（扉が多くても廊下どうしがぶつからない）。
  // 通路が扉 1 つ・廊下 1 本で、廊下が扉の真正面なら、通路を作らず廊下を辺まで伸ばす
  interface Stub { pl: Placed; at: number; rise: number }
  interface Lane { side: Dir; a0: number; a1: number; gates: { gi: number; u: number; id: string }[]; stubs: Stub[] }
  const findStub = (d: Dir, u: number): Stub | null => {
    const s = sgnOf(d), B = boundary(d), end1 = snap(B - s * 2 * half);
    let best: (Stub & { score: number }) | null = null;
    for (const pl of hosts) {
      const wl = wallOf(pl.rect, d);
      if (s * (B - wl.coord) < 2.4) continue;
      const at = pickAlong(pl, d, u, stubW);
      if (at === null) continue;
      const L1 = Math.abs(end1 - wl.coord);
      if (L1 < 1.2 || !free(perp(d, wl.coord, end1, at, stubW))) continue;
      const rise = Math.abs(pl.y);
      if (rise > 0.01 && L1 < Math.ceil(rise / RISER_MAX - 1e-9) * TREAD + 1.6) continue;
      const score = Math.abs(at - u) + Math.abs(B - wl.coord) * 0.05 + (rise > 0.01 ? 4 : 0) + (pl.kind === 'junction' ? 2 : 0);
      if (!best || score < best.score) best = { pl, at, rise, score };
    }
    return best;
  };
  const laneRect = (d: Dir, a0: number, a1: number): Rect => perp(((d + 1) % 4) as Dir, a0, a1, boundary(d) - sgnOf(d) * half, 2 * half);
  const stubRect = (d: Dir, st: Stub): Rect => perp(d, wallOf(st.pl.rect, d).coord, snap(boundary(d) - sgnOf(d) * 2 * half), st.at, stubW);
  const lanes: Lane[] = [];
  for (const d of [0, 1, 2, 3] as Dir[]) {
    const list = reg.gates.map((gt, gi) => ({ gi, u: gt.at, id: gt.id, side: gt.side })).filter((x) => x.side === d).sort((a, b) => a.u - b.u);
    let last: Lane | null = null;
    for (const x of list) {
      const st = findStub(d, x.u);
      const want: [number, number] = st ? [snap(Math.min(st.at, x.u) - half), snap(Math.max(st.at, x.u) + half)] : [snap(x.u - half), snap(x.u + half)];
      // 前の通路に届く（重なる・すぐ隣）: まとめる。伸ばす所が空いていること
      if (last && want[0] < last.a1 + 0.6) {
        const a0 = Math.min(last.a0, want[0]), a1 = Math.max(last.a1, want[1]);
        const ext = [a0 < last.a0 ? laneRect(d, a0, last.a0) : null, a1 > last.a1 ? laneRect(d, last.a1, a1) : null].filter((r): r is Rect => !!r);
        if (ext.every(free)) {
          busy.push(...ext);
          last.a0 = a0; last.a1 = a1;
          last.gates.push(x);
          if (st && last.stubs.every((o) => Math.abs(o.at - st.at) >= stubW + 2 * WALL_T + 0.3) && free(stubRect(d, st))) { last.stubs.push(st); busy.push(stubRect(d, st)); }
          continue;
        }
      }
      if (st && free(laneRect(d, want[0], want[1]))) {
        last = { side: d, a0: want[0], a1: want[1], gates: [x], stubs: [st] };
        lanes.push(last);
        busy.push(laneRect(d, want[0], want[1]), stubRect(d, st));
        continue;
      }
      // 自分の廊下が引けない: 前の通路を扉まで伸ばす
      if (last && x.u - half > last.a1 - 1e-6 && free(laneRect(d, last.a1, snap(x.u + half)))) {
        busy.push(laneRect(d, last.a1, snap(x.u + half)));
        last.a1 = snap(x.u + half);
        last.gates.push(x);
        continue;
      }
      throw new GenError(`境目の扉への道が引けません: ${x.id}`);
    }
  }
  let si = 0;
  lanes.forEach((ln, li) => {
    const d = ln.side, s = sgnOf(d), B = boundary(d);
    const end1 = snap(B - s * 2 * half);
    const axis: 'x' | 'z' = d % 2 === 0 ? 'z' : 'x';
    const direct = ln.gates.length === 1 && ln.stubs.length === 1 && Math.abs(ln.stubs[0]!.at - ln.gates[0]!.u) <= 0.04;
    const fam0 = ln.stubs[0]!.pl.fam;
    // 系統の廊下の見た目（区画の系統が区域の系統と違えば、その系統の廊下）
    const look = (sp: StraightSpec, pl: Placed): StraightSpec => {
      if (pl.fam !== g.fam) { sp.palette = themePalette(pl.fam.corridor); sp.theme = pl.fam.corridor; sp.audio = pl.fam.corridorAudio; sp.materialKey = `corr:${g.p.id}:${pl.fam.id}`; }
      return sp;
    };
    const lane: StraightSpec | null = direct ? null : look({ id: `gl${li}`, axis: axis === 'z' ? 'x' : 'z', a0: ln.a0, a1: ln.a1, center: snap(B - s * half), width: 2 * half, y: 0, height: snap(Math.min(env.hc, ...ln.stubs.map((st) => st.pl.height - 0.2))), kind: 'corridor', role: 'connector', name: '廊下' }, ln.stubs[0]!.pl);
    void fam0;
    for (const st of ln.stubs) {
      const { pl, at, rise } = st;
      const wl = wallOf(pl.rect, d);
      const door = pl.kind === 'room' ? env.doorRng.chance(t['floor.roomDoorChance']) : pl.kind === 'hall' ? env.doorRng.chance(t['floor.hallDoorChance']) : false;
      const h = snap(Math.min(env.hc, pl.height - 0.2));
      const span = wl.hi - wl.lo;
      const ow = door ? DOOR_W : pl.kind === 'junction' ? Math.min(stubW, span - 2 * WALL_T) : Math.min(stubW, span - 1.2);
      const oh = door ? DOOR_H : Math.min(h, pl.height - 0.2);
      const hostPos = wallPoint(d, wl.coord, at, pl.y);
      const sid = `gs${si++}`;
      g.addOpening(pl.cellId, opening(`${pl.cellId}:${sid}`, hostPos, d, ow, oh));
      const far = direct ? B : end1;
      const L1 = Math.abs(far - wl.coord);
      const s1: StraightSpec = look({ id: sid, axis, a0: Math.min(wl.coord, far), a1: Math.max(wl.coord, far), center: at, width: stubW, y: Math.min(pl.y, 0), height: rise + h, kind: rise > 0.01 ? 'stairs' : 'corridor', role: 'connector', name: rise > 0.01 ? '階段' : '廊下' }, pl);
      if (rise > 0.01) {
        const n = Math.ceil(rise / RISER_MAX - 1e-9);
        const hostIsA0 = wl.coord < far;
        const hostLow = pl.y < 0;
        s1.stairs = { lowEnd: hostLow === hostIsA0 ? 'a0' : 'a1', offset: snap((L1 - n * TREAD) / 2), rise };
      }
      g.straights.push(s1);
      g.addOpening(s1.id, opening(`${s1.id}:host`, hostPos, addDir(d, 2), ow, oh));
      g.join(pl.cellId, s1.id, axis, wl.coord, at, pl.y, ow, oh, d, door ? { cell: pl.cellId, mat: themePalette(pl.theme).door, swing: -s } : null);
      if (direct) {
        const gt = ln.gates[0]!;
        const gateOpening: WallOpening = opening(`gate${gt.gi}`, wallPoint(d, B, gt.u, 0), d, DOOR_W, DOOR_H);
        g.addOpening(s1.id, gateOpening);
        gates.push({ id: gt.id, cell: s1.id, opening: gateOpening });
        return;
      }
      const lh = lane!.height;
      const joint = wallPoint(d, end1, at, 0);
      g.addOpening(s1.id, opening(`${s1.id}:lane`, joint, d, stubW, Math.min(h, lh)));
      g.addOpening(lane!.id, opening(`${lane!.id}:${s1.id}`, joint, addDir(d, 2), stubW, Math.min(h, lh)));
      g.join(s1.id, lane!.id, axis, end1, at, 0, stubW, Math.min(h, lh), d, null);
    }
    if (!lane) return;
    g.straights.push(lane);
    for (const gt of ln.gates) {
      const gateOpening: WallOpening = opening(`gate${gt.gi}`, wallPoint(d, B, gt.u, 0), d, DOOR_W, DOOR_H);
      g.addOpening(lane.id, gateOpening);
      gates.push({ id: gt.id, cell: lane.id, opening: gateOpening });
    }
  });
  // 境目の扉は計画の順に（出てくる位置は最初の扉）
  const order = new Map(reg.gates.map((gt, i) => [gt.id, i]));
  gates.sort((a, b) => order.get(a.id)! - order.get(b.id)!);

  // ---------------------------------------------------------------- 出てくる位置（上から着く階段室の上の踊り場。無ければ入口の区画）
  const up = airlocks.find((a) => a.role === 'up' && a.kind !== 'lift') ?? airlocks.find((a) => a.role === 'up');
  if (up) g.out.spawn = airlockSpawn(up, t);
  else if (gates.length) {
    // 最初の境目の扉の 1.2 m 内側（廊下の真ん中。家具が無い）に、区域の中を向いて
    const o = gates[0]!.opening, v = rotQ([0, 0, 1], o.dir);
    g.out.spawn = { pos: [snap(o.pos[0] - v[0] * 1.2), 0.02, snap(o.pos[2] - v[2] * 1.2)], yaw: Math.atan2(v[0], v[2]), cell: gates[0]!.cell };
  } else {
    const e = placed.get(sk.entry)!;
    g.out.spawn = { pos: [snap((e.rect.x0 + e.rect.x1) / 2), e.y + 0.02, snap((e.rect.z0 + e.rect.z1) / 2)], yaw: 0, cell: e.cellId };
  }
  const down = airlocks.find((a) => a.role === 'down');
  if (down) g.out.mainTo = down.cell;
  // 隠しの穴から落ちてくる人が着く部屋（天井の穴と縦穴）
  const landings = placeLanding(g, hosts, t);
  placeOpenHoles(g, hosts, t);
  g.out.region = { gates, airlocks, ...(landings.length ? { landings } : {}) };
  g.out.sealed = sealed;
}
