import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASIN } from '../core/gen/dress/basin.ts';
import { DRESS_KINDS, DRESS_THEMES, dressCell } from '../core/gen/dress/index.ts';
import type { DressKind, DressRoom } from '../core/gen/dress/types.ts';
import { reachOpenings } from '../core/gen/reach.ts';
import type { AABB } from '../core/math/aabb.ts';
import { hashAll, Rng } from '../core/math/rng.ts';
import type { Dir } from '../core/math/vec.ts';
import { makeCell, opening } from '../core/world/build.ts';
import { pickSpanPosition, wallSpans, type Rect } from '../core/world/footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, WIDE_W, type Box, type CellLayout, type WallOpening } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';

/**
 * 区画の中身（dressCell）の検査: テーマ × 種類ごとに乱数の区画（1 つの矩形 / 2 つの矩形の L 字、床の高さ 0 / 1.8 / -3.6、
 * 開口 2〜4）を作って中身を置き、(a) 開口どうしが歩いてつながる (b) 当たる箱が扉前・keepOut に掛からない
 * (c) 箱が区画の中 (d) 同じ seed なら同じ箱 (e) 箱が床より下に無い（床に沈めた水槽の箱 kind 'basin*' だけは水槽の底まで）、を確かめる
 */

const CELLS_PER_COMBO = 30;
const snap = (v: number): number => Math.round(v * 20) / 20;

interface Made { cell: CellLayout; openings: WallOpening[]; keepOut: AABB[]; floorY: number }

/** 種類に合う大きさの足跡（原点のずれも乱数） */
function footprint(rng: Rng, kind: DressKind): { rects: Rect[]; height: number } {
  const ox = snap(rng.float(-40, 40)), oz = snap(rng.float(-40, 40));
  const R = (x0: number, z0: number, x1: number, z1: number): Rect => ({ x0: snap(ox + x0), z0: snap(oz + z0), x1: snap(ox + x1), z1: snap(oz + z1) });
  const swap = rng.chance(0.5);
  const S = (x0: number, z0: number, x1: number, z1: number): Rect => (swap ? R(z0, x0, z1, x1) : R(x0, z0, x1, z1));
  const L = (w: number, d: number, ww: number, wd: number): Rect[] => {
    // 主の矩形 + 翼（主の長い辺の端に付く）
    const side = rng.int(0, 3);
    const main = S(0, 0, w, d);
    const wing = side === 0 ? S(w, d - wd, w + ww, d) : side === 1 ? S(-ww, d - wd, 0, d) : side === 2 ? S(0, d, ww, d + wd) : S(w - ww, -wd, w, 0);
    return [main, wing];
  };
  switch (kind) {
    case 'corridor': {
      const w = snap(rng.float(1.8, 4.2)), len = snap(rng.float(6, 24));
      if (rng.chance(0.35)) {
        const l2 = snap(rng.float(w + 1.5, 12));
        return { rects: rng.chance(0.5) ? [S(0, 0, w, len), S(w, len - w, w + l2, len)] : [S(0, 0, w, len), S(-l2, len - w, 0, len)], height: snap(rng.float(2.4, 3.2)) };
      }
      return { rects: [S(0, 0, w, len)], height: snap(rng.float(2.4, 3.2)) };
    }
    case 'junction': {
      const s = snap(rng.float(2.4, 6));
      return { rects: [S(0, 0, s, s)], height: snap(rng.float(2.4, 3.0)) };
    }
    case 'room': {
      const w = snap(rng.float(3.8, 12)), d = snap(rng.float(3.8, 12));
      return { rects: rng.chance(0.35) ? L(w, d, snap(rng.float(2.4, Math.max(2.5, w * 0.6))), snap(rng.float(2.4, Math.max(2.5, d * 0.7)))) : [S(0, 0, w, d)], height: snap(rng.float(2.5, 3.6)) };
    }
    case 'hall': {
      const w = snap(rng.float(10, 24)), d = snap(rng.float(10, 24));
      return { rects: rng.chance(0.35) ? L(w, d, snap(rng.float(4, w * 0.5)), snap(rng.float(4, d * 0.6))) : [S(0, 0, w, d)], height: snap(rng.float(3.0, 7.0)) };
    }
    case 'stairs':
    case 'exit': {
      if (kind === 'exit' && rng.chance(0.5)) {
        const w = snap(rng.float(3, 7)), d = snap(rng.float(3, 8));
        return { rects: [S(0, 0, w, d)], height: snap(rng.float(2.5, 3.2)) };
      }
      const w = snap(rng.float(2.0, 3.2)), len = snap(rng.float(4, 9));
      return { rects: [S(0, 0, w, len)], height: snap(rng.float(2.6, 4.6)) };
    }
    case 'secret': {
      const w = snap(rng.float(3, 7)), d = snap(rng.float(3, 7));
      return { rects: [S(0, 0, w, d)], height: snap(rng.float(2.4, 3.0)) };
    }
  }
}

/** 開口 2〜4（壁の区間に乱数で。扉 / 幅広 / 区間いっぱい） */
function openingsFor(rng: Rng, rects: Rect[], h: number, floorY: number): WallOpening[] {
  const spans = wallSpans(rects).filter((s) => s.a1 - s.a0 >= DOOR_W + 1.3);
  const want = rng.int(2, 4);
  const out: WallOpening[] = [];
  for (let guard = 0; guard < 40 && out.length < want && spans.length; guard++) {
    const sp = rng.pick(spans);
    const len = sp.a1 - sp.a0;
    const roll = rng.next();
    let width = roll < 0.6 ? DOOR_W : roll < 0.85 ? WIDE_W : snap(Math.max(DOOR_W, len - 1.3));
    if (width + 1.3 > len) width = DOOR_W;
    const height = width > DOOR_W ? Math.min(h - 0.2, 2.6) : DOOR_H;
    const t = pickSpanPosition(sp, out, width, rng.next(), 0.6);
    if (t === null) continue;
    const d = sp.edge.dir;
    out.push(opening(`o${out.length}`, d === 0 || d === 2 ? [t, floorY, sp.edge.coord] : [sp.edge.coord, floorY, t], d as Dir, width, height));
  }
  return out;
}

/** 階段の段（フロアの生成と同じ形: 低い端から段を上げ、上がりきった先は踊り場）。高い端の開口の高さを返す */
function addSteps(rng: Rng, cell: CellLayout, r: Rect, highAtMax: boolean): number {
  const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
  const len = alongZ ? r.z1 - r.z0 : r.x1 - r.x0;
  const n = Math.max(2, Math.min(Math.floor((len - 1.6) / 0.28), rng.int(5, 12)));
  const rise = snap(n * 0.17);
  const a0 = alongZ ? r.z0 : r.x0, a1 = alongZ ? r.z1 : r.x1;
  const w0 = (alongZ ? r.x0 : r.z0) + WALL_T, w1 = (alongZ ? r.x1 : r.z1) - WALL_T;
  const at = (d: number): number => (highAtMax ? a0 + d : a1 - d);
  const off = 0.8;
  const y = cell.floorY;
  const slab = (d0: number, d1: number, top: number, kind: string): void => {
    const p0 = Math.min(at(d0), at(d1)), p1 = Math.max(at(d0), at(d1));
    const b = alongZ ? box([w0, y, p0], [w1, top, p1], cell.palette.floor) : box([p0, y, w0], [p1, top, w1], cell.palette.floor);
    b.kind = kind;
    cell.boxes.push(b);
  };
  for (let i = 0; i < n; i++) slab(off + i * 0.28, off + (i + 1) * 0.28, y + ((i + 1) * rise) / n, 'stairStep');
  slab(off + n * 0.28, len, y + rise, 'landing');
  return rise;
}

function makeRoom(theme: string, kind: DressKind, seed: number): Made {
  const rng = new Rng(seed);
  for (let attempt = 0; attempt < 12; attempt++) {
    const floorY = rng.pick([0, 1.8, -3.6]);
    const { rects, height } = footprint(rng, kind);
    let openings = openingsFor(rng, rects, height, floorY);
    if (openings.length < 2) continue;
    // 階段: 半分は段を作り、高い端の開口を 1 つ足す（入口は床の高さの開口）
    const stepped = (kind === 'stairs' || kind === 'exit') && rects.length === 1 && rng.chance(0.5);
    let high: WallOpening | null = null;
    const r0 = rects[0]!;
    const alongZ = r0.z1 - r0.z0 >= r0.x1 - r0.x0;
    const highAtMax = rng.chance(0.5);
    if (stepped) {
      openings = openings.filter((o) => (alongZ ? o.dir !== (highAtMax ? 0 : 2) : o.dir !== (highAtMax ? 1 : 3)));
      if (openings.length < 1) continue;
    }
    const cellOpenings = (): WallOpening[] => (high ? [...openings, high] : openings);
    const mk = (): CellLayout => makeCell({ id: `cell${seed % 9973}`, role: 'rest', rects, height, floorY, palette: themePalette(theme), openings: cellOpenings(), theme });
    let cell = mk();
    if (stepped) {
      const rise = addSteps(new Rng(seed ^ 0x5a5a), cell, r0, highAtMax);
      const w = Math.min(DOOR_W + 0.4, (alongZ ? r0.x1 - r0.x0 : r0.z1 - r0.z0) - 0.6);
      const cx = alongZ ? (r0.x0 + r0.x1) / 2 : (r0.z0 + r0.z1) / 2;
      const d: Dir = alongZ ? (highAtMax ? 0 : 2) : (highAtMax ? 1 : 3);
      const edge = alongZ ? (highAtMax ? r0.z1 : r0.z0) : (highAtMax ? r0.x1 : r0.x0);
      high = opening('high', alongZ ? [cx, floorY + rise, edge] : [edge, floorY + rise, cx], d, w, DOOR_H);
      const steps = cell.boxes.filter((b) => b.kind === 'stairStep' || b.kind === 'landing');
      cell = mk();
      cell.boxes.push(...steps);
    }
    const all = cellOpenings();
    // 素の区画で開口どうしがつながること（つながらない区画は作り直す）
    const base = reachOpenings(cell, all);
    if (base && base.blocked.length) continue;
    // keepOut 0〜2（足跡の中の小さな範囲）
    const keepOut: AABB[] = [];
    for (let k = rng.int(0, 2); k > 0; k--) {
      const r = rng.pick(rects);
      const sx = rng.float(0.4, 1.0), sz = rng.float(0.4, 1.0);
      const x = rng.float(r.x0 + 0.5, r.x1 - 0.5), z = rng.float(r.z0 + 0.5, r.z1 - 0.5);
      keepOut.push({ min: [x - sx, floorY, z - sz], max: [x + sx, floorY + 2.2, z + sz] });
    }
    return { cell, openings: all, keepOut, floorY };
  }
  throw new Error(`区画を作れません: ${theme} ${kind} ${seed}`);
}

/** 検査の扉前: 開口の幅 + 両側 0.3 m（半幅 0.8 m 以上）× 壁の室内面から 1.2 m、床から 2.2 m（または開口の上端）まで */
function testDoorZones(openings: WallOpening[], floorY: number): AABB[] {
  return openings.map((s) => {
    const half = Math.max(0.8, s.width / 2 + 0.3);
    const reach = WALL_T + 1.2;
    const y0 = floorY - 0.1, y1 = Math.max(floorY + 2.2, s.pos[1] + (s.sill ?? 0) + s.height);
    const [x, z] = [s.pos[0], s.pos[2]];
    switch (s.dir) {
      case 0: return { min: [x - half, y0, z - reach], max: [x + half, y1, z] };
      case 2: return { min: [x - half, y0, z], max: [x + half, y1, z + reach] };
      case 1: return { min: [x - reach, y0, z - half], max: [x, y1, z + half] };
      default: return { min: [x, y0, z - half], max: [x + reach, y1, z + half] };
    }
  });
}

const overlaps = (b: Box, a: AABB, eps = 1e-3): boolean =>
  b.min[0] < a.max[0] - eps && b.max[0] > a.min[0] + eps && b.min[1] < a.max[1] - eps && b.max[1] > a.min[1] + eps && b.min[2] < a.max[2] - eps && b.max[2] > a.min[2] + eps;

const inFoot = (rects: Rect[], x: number, z: number): boolean => rects.some((r) => x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && z >= r.z0 - 1e-6 && z <= r.z1 + 1e-6);

function dress(m: Made, seed: number, density: number, kind: DressKind): Box[] {
  const n0 = m.cell.boxes.length;
  const r: DressRoom = { cell: m.cell, kind, openings: m.openings, keepOut: m.keepOut, rng: new Rng(hashAll(seed, 'dress')), density };
  dressCell(r);
  return m.cell.boxes.slice(n0);
}

interface Stat { cells: number; boxes: number; solids: number; empty: number; ms: number }
const stats = new Map<string, Stat>();

for (const theme of DRESS_THEMES) {
  test(`dressCell: ${theme}`, () => {
    for (const kind of DRESS_KINDS) {
      const st: Stat = { cells: 0, boxes: 0, solids: 0, empty: 0, ms: 0 };
      for (let i = 0; i < CELLS_PER_COMBO; i++) {
        const seed = hashAll(theme, kind, i);
        const density = i % 5 === 0 ? 0.5 : new Rng(seed ^ 0x1234).float(0, 1);
        const m = makeRoom(theme, kind, seed);
        const where = `${theme} ${kind} #${i}（seed ${seed}, density ${density.toFixed(2)}）`;
        const t0 = performance.now();
        const added = dress(m, seed, density, kind);
        st.ms += performance.now() - t0;
        st.cells++;
        st.boxes += added.length;
        st.solids += added.filter((b) => b.solid).length;
        if (!added.some((b) => b.solid)) st.empty++;
        // (a) 開口どうしが歩いてつながる
        const reach = reachOpenings(m.cell, m.openings);
        assert.ok(!reach || reach.blocked.length === 0, `${where}: 届かない開口 ${reach?.blocked.join(', ')}`);
        // (b) 当たる箱が扉前・keepOut に掛からない
        const zones = testDoorZones(m.openings, m.floorY);
        for (const b of added) {
          // 床の高さより下の箱（沈めた水槽の縁・底・切った床板の残り）は通り道を塞がない
          if (!b.solid || b.max[1] <= m.floorY + 1e-6) continue;
          for (const z of zones) assert.ok(!overlaps(b, z), `${where}: 扉前に当たる箱 ${b.mat}/${b.kind ?? ''} ${JSON.stringify([b.min, b.max])}`);
          for (const k of m.keepOut) assert.ok(!overlaps(b, k), `${where}: keepOut に当たる箱 ${b.mat}/${b.kind ?? ''}`);
        }
        // (c) 箱が区画の中（外形の中、かつ水平の範囲が足跡の中）/ (e) 床より下に無い
        const bd = m.cell.bounds;
        for (const b of added) {
          assert.ok(b.min[0] >= bd.min[0] - 1e-6 && b.max[0] <= bd.max[0] + 1e-6 && b.min[2] >= bd.min[2] - 1e-6 && b.max[2] <= bd.max[2] + 1e-6, `${where}: 区画の外の箱 ${b.mat}`);
          assert.ok(b.max[1] <= m.floorY + m.cell.height + 0.21, `${where}: 天井より上の箱 ${b.mat} ${b.max[1]}`);
          const xs = [b.min[0], (b.min[0] + b.max[0]) / 2, b.max[0]], zs = [b.min[2], (b.min[2] + b.max[2]) / 2, b.max[2]];
          assert.ok(xs.every((x) => zs.every((z) => inFoot(m.cell.footprint, x, z))), `${where}: 足跡の外の箱 ${b.mat} ${JSON.stringify([b.min, b.max])}`);
          const basin = !!b.kind?.startsWith('basin');
          assert.ok(b.min[1] >= m.floorY - 0.01 || (basin && b.min[1] >= m.floorY - BASIN.depth - BASIN.slab - 0.2 - 1e-6), `${where}: 床より下の箱 ${b.mat}/${b.kind ?? ''} ${b.min[1]}`);
          assert.ok(b.max[0] > b.min[0] && b.max[1] > b.min[1] && b.max[2] > b.min[2], `${where}: 大きさの無い箱 ${b.mat}`);
        }
        for (const z of m.cell.zones) assert.ok(z.aabb.min[1] >= m.floorY - (z.kind === 'water' ? BASIN.depth + 0.1 + 1e-6 : 0.2) && z.aabb.max[1] <= m.floorY + m.cell.height + 0.2, `${where}: ゾーンの高さ`);
        // (d) 同じ seed なら同じ箱（区画も作り直して比べる）
        const again = dress(makeRoom(theme, kind, seed), seed, density, kind);
        assert.equal(JSON.stringify(again), JSON.stringify(added), `${where}: 同じ seed で違う箱`);
      }
      stats.set(`${theme}|${kind}`, st);
    }
  });
}

test('部屋・広間は家具が置かれる（空っぽばかりにならない）', () => {
  for (const theme of DRESS_THEMES) {
    for (const kind of ['room', 'hall'] as const) {
      const st = stats.get(`${theme}|${kind}`);
      if (!st) continue;
      assert.ok(st.empty <= st.cells * 0.35, `${theme} ${kind}: 当たる物の無い区画が多すぎる（${st.empty}/${st.cells}）`);
      assert.ok(st.boxes / st.cells >= 8, `${theme} ${kind}: 箱が少なすぎる（平均 ${(st.boxes / st.cells).toFixed(1)}）`);
    }
  }
});

test('統計（テーマ × 種類の平均の箱の数・時間）', () => {
  const rows = [...stats].map(([k, s]) => `${k.padEnd(32)} 箱 ${(s.boxes / s.cells).toFixed(0).padStart(4)} / 当たる ${(s.solids / s.cells).toFixed(0).padStart(3)} / 空 ${String(s.empty).padStart(2)} / ${(s.ms / s.cells).toFixed(1)} ms`);
  if (process.env['DRESS_STATS']) console.log(rows.join('\n'));
  assert.ok(rows.length > 0);
});
