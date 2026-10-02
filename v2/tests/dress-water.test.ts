import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { BASIN, WATER_SURFACE_MATS } from '../core/gen/dress/basin.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import type { DressKind } from '../core/gen/dress/types.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { rollProfile } from '../core/gen/floor/profile.ts';
import { reachOpenings } from '../core/gen/reach.ts';
import type { AABB } from '../core/math/aabb.ts';
import { hashAll, Rng } from '../core/math/rng.ts';
import type { Dir } from '../core/math/vec.ts';
import { PLAYER } from '../core/sim/player.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import { makeCell, opening } from '../core/world/build.ts';
import type { Rect } from '../core/world/footprint.ts';
import { DOOR_W, WIDE_W, type Box, type CellLayout, type FloorLayout, type WallOpening } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';

/**
 * 水の検査（屋内プール・プールの回廊）: 水は床に沈めた水槽に入っていて、床の上に立つ水の板にならないこと。
 * (1) 水の箱（上面だけ描く水面の材質）の水面は床より下、4 辺の外側は水面の少し上まで当たる箱（縁・壁）で、底も当たる箱で囲われ、
 *     水の中は空いている（床板が切ってある）。水のゾーン（遅くなる）は水の箱と同じ範囲・高さ
 * (2) 水槽からは歩いて上がれる（縁の上端 = 床と、底の差が PLAYER.step より小さい。実際の移動でも上がれる）
 * (3) 生成したプールのフロアでも (1) が成り立ち、区画の外形が水槽の底を含む
 */

const t = defaultTuning();
const snap = (v: number): number => Math.round(v * 20) / 20;
const POOL_KINDS: DressKind[] = ['room', 'hall', 'corridor', 'junction'];

/** 点 (x, y, z) を含む当たる箱があるか */
const solidAt = (cell: CellLayout, x: number, y: number, z: number): boolean =>
  cell.boxes.some((b) => b.solid && x > b.min[0] - 1e-6 && x < b.max[0] + 1e-6 && y > b.min[1] - 1e-6 && y < b.max[1] + 1e-6 && z > b.min[2] - 1e-6 && z < b.max[2] + 1e-6);

const isWater = (b: Box): boolean => WATER_SURFACE_MATS.has(b.mat);

/** 区画の水が囲われているか・ゾーンが合っているか。問題の一覧を返す */
function waterIssues(cell: CellLayout): string[] {
  const out: string[] = [];
  const fy = cell.floorY;
  const waters = cell.boxes.filter(isWater);
  for (const w of waters) {
    const where = `${cell.id} 水 ${JSON.stringify([w.min, w.max])}`;
    const top = w.max[1], bot = w.min[1];
    if (w.solid) out.push(`${where}: 当たる水`);
    if (top > fy - 0.02 + 1e-6) out.push(`${where}: 水面が床（${fy}）より下でない`);
    if (bot < cell.bounds.min[1] - 1e-6) out.push(`${where}: 区画の外形が水槽の底を含まない`);
    // 4 辺の外側 2 cm: 底の少し上・水面の少し下・水面の 3 cm 上（縁が水面より高い）・床の 5 mm 下が当たる箱の中。
    // 縁の上端は床と同じ高さ（床の 5 mm 下を含む箱の上面が床。v1 から移した形のような、床より高いデッキで囲わない）
    const sides: [number, number, number, number][] = [];
    for (let x = w.min[0] + 0.01; x <= w.max[0] - 0.01 + 1e-9; x += 0.1) sides.push([x, w.min[2] - 0.02, x, w.max[2] + 0.02]);
    for (let z = w.min[2] + 0.01; z <= w.max[2] - 0.01 + 1e-9; z += 0.1) sides.push([w.min[0] - 0.02, z, w.max[0] + 0.02, z]);
    let open = 0, raised = 0;
    for (const [x0, z0, x1, z1] of sides) {
      for (const [x, z] of [[x0, z0], [x1, z1]] as const) {
        for (const y of [bot + 0.01, top - 0.01, top + 0.03, fy - 0.005]) if (!solidAt(cell, x, y, z)) open++;
        const y = fy - 0.005;
        if (cell.boxes.some((b) => b.solid && x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2] && b.max[1] > fy + 1e-6)) raised++;
      }
    }
    if (open) out.push(`${where}: 縁の外側に囲いの無い所 ${open}`);
    if (raised) out.push(`${where}: 縁の上に低い当たる物 ${raised}`);
    // 底と、水の中が空いていること（床板が切ってある）
    let noFloor = 0, filled = 0;
    for (let x = w.min[0] + 0.05; x < w.max[0] - 0.04; x += 0.25) {
      for (let z = w.min[2] + 0.05; z < w.max[2] - 0.04; z += 0.25) {
        if (!solidAt(cell, x, bot - 0.01, z)) noFloor++;
        if (solidAt(cell, x, (bot + top) / 2, z) || solidAt(cell, x, top - 0.005, z)) filled++;
      }
    }
    if (noFloor) out.push(`${where}: 底の無い所 ${noFloor}`);
    if (filled) out.push(`${where}: 水の中に当たる箱 ${filled}`);
    // 歩いて上がれる深さ（縁の上端 = 床 − 底）
    if (fy - bot > PLAYER.step - 0.02) out.push(`${where}: 深すぎる（${(fy - bot).toFixed(2)} m）`);
    // ゾーン
    const zs = cell.zones.filter((z) => z.kind === 'water' && Math.abs(z.aabb.min[0] - w.min[0]) < 1e-6 && Math.abs(z.aabb.max[0] - w.max[0]) < 1e-6 && Math.abs(z.aabb.min[2] - w.min[2]) < 1e-6 && Math.abs(z.aabb.max[2] - w.max[2]) < 1e-6);
    if (zs.length !== 1) out.push(`${where}: 水と同じ範囲の水のゾーンが ${zs.length}`);
    for (const z of zs) {
      // 立って水に入っている判定（足元 + 0.1 m）が、底に立ったときに入り、床（縁）の上に立ったときに入らない
      if (!(z.aabb.min[1] <= bot + 0.1 && z.aabb.min[1] >= bot - 0.15)) out.push(`${where}: ゾーンの下端 ${z.aabb.min[1]}`);
      if (!(z.aabb.max[1] >= top && z.aabb.max[1] < fy + 0.1)) out.push(`${where}: ゾーンの上端 ${z.aabb.max[1]}`);
      if (!((z.params?.slow ?? 1) < 1)) out.push(`${where}: 遅くならない`);
    }
  }
  for (const z of cell.zones) {
    // dry: 水ではなく足が取られるだけの所（物の海の異変）
    if (z.kind !== 'water' || z.params?.dry) continue;
    if (!waters.some((w) => Math.abs(z.aabb.min[0] - w.min[0]) < 1e-6 && Math.abs(z.aabb.max[2] - w.max[2]) < 1e-6)) out.push(`${cell.id}: 水の無い水のゾーン ${JSON.stringify(z.aabb)}`);
  }
  return out;
}

/** プールのテーマの区画（大きさ・開口・床の高さ・keepOut は乱数） */
function poolCell(kind: DressKind, seed: number): { cell: CellLayout; openings: WallOpening[]; keepOut: AABB[] } {
  const rng = new Rng(seed);
  const floorY = rng.pick([0, 1.8, -3.6]);
  const ox = snap(rng.float(-30, 30)), oz = snap(rng.float(-30, 30));
  let w: number, d: number, h: number;
  switch (kind) {
    case 'corridor': w = snap(rng.float(1.8, 6.5)); d = snap(rng.float(6, 22)); h = 2.8; break;
    case 'junction': w = d = snap(rng.float(2.4, 6.5)); h = 2.8; break;
    case 'room': w = snap(rng.float(4, 12)); d = snap(rng.float(4, 12)); h = 3.0; break;
    default: w = snap(rng.float(10, 24)); d = snap(rng.float(10, 24)); h = 5.0;
  }
  if (rng.chance(0.5)) [w, d] = [d, w];
  const r: Rect = { x0: ox, z0: oz, x1: ox + w, z1: oz + d };
  const openings: WallOpening[] = [];
  // 長い向きの両端と、側壁に 0〜2（扉 / 幅広）
  const alongZ = d >= w;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const endW = Math.min(alongZ ? w : d, 2.2) - 0.4;
  if (alongZ) { openings.push(opening('e0', [cx, floorY, r.z0], 2 as Dir, endW, 2.4), opening('e1', [cx, floorY, r.z1], 0 as Dir, endW, 2.4)); }
  else { openings.push(opening('e0', [r.x0, floorY, cz], 3 as Dir, endW, 2.4), opening('e1', [r.x1, floorY, cz], 1 as Dir, endW, 2.4)); }
  for (let k = rng.int(0, 2); k > 0; k--) {
    const len = alongZ ? d : w;
    if (len < 4) break;
    const at = snap(rng.float(1.5, len - 1.5));
    const width = rng.chance(0.7) ? DOOR_W : WIDE_W;
    const side = rng.chance(0.5);
    openings.push(alongZ ? opening(`s${k}`, [side ? r.x1 : r.x0, floorY, r.z0 + at], (side ? 1 : 3) as Dir, width, 2.2) : opening(`s${k}`, [r.x0 + at, floorY, side ? r.z1 : r.z0], (side ? 0 : 2) as Dir, width, 2.2));
  }
  const cell = makeCell({ id: `pool${seed % 9973}`, role: 'rest', rects: [r], height: h, floorY, palette: themePalette('PoolCorridor'), openings, theme: 'PoolCorridor' });
  const keepOut: AABB[] = [];
  if (rng.chance(0.4)) {
    const x = rng.float(r.x0 + 1, r.x1 - 1), z = rng.float(r.z0 + 1, r.z1 - 1);
    keepOut.push({ min: [x - 0.6, floorY, z - 0.6], max: [x + 0.6, floorY + 2.2, z + 0.6] });
  }
  return { cell, openings, keepOut };
}

test('プールの水は床に沈めた水槽に囲われる（立つ水の板が無い）・水のゾーンは水と同じ範囲・開口どうしはつながる', () => {
  let waters = 0;
  const issues: string[] = [];
  for (const kind of POOL_KINDS) {
    for (let i = 0; i < 40; i++) {
      const seed = hashAll('pool-water', kind, i);
      const { cell, openings, keepOut } = poolCell(kind, seed);
      dressCell({ cell, kind, openings, keepOut, rng: new Rng(seed ^ 0x77), density: new Rng(seed).float(0, 1) });
      waters += cell.boxes.filter(isWater).length;
      issues.push(...waterIssues(cell).map((s) => `${kind} #${i}: ${s}`));
      // 水は扉前・keepOut に掛からない（乾いた床から入れる）
      for (const w of cell.boxes.filter(isWater)) {
        for (const z of keepOut) if (w.min[0] < z.max[0] && w.max[0] > z.min[0] && w.min[2] < z.max[2] && w.max[2] > z.min[2]) issues.push(`${kind} #${i}: keepOut に水`);
      }
      const reach = reachOpenings(cell, openings);
      if (reach && reach.blocked.length) issues.push(`${kind} #${i}: 届かない開口 ${reach.blocked.join(', ')}`);
    }
  }
  assert.deepEqual(issues, []);
  assert.ok(waters >= 60, `水槽が作られる: ${waters}`);
});

test('水槽の寸法: 底は登れる段差より浅い・水面は数 cm 下・縁は床と同じ高さ', () => {
  assert.ok(BASIN.depth <= PLAYER.step - 0.03, `深さ ${BASIN.depth} m は段差 ${PLAYER.step} m より浅い`);
  assert.ok(BASIN.level > 0.02 && BASIN.level < 0.12, '水面は床より数 cm 下');
  assert.ok(BASIN.depth - BASIN.level >= 0.15, '水の深さが見える');
});

/** 区画 1 つだけのフロア（移動の検査用） */
function floorOf(cell: CellLayout): FloorLayout {
  return {
    id: 'water-test', seed: 1, genVersion: 'test', tuningVersion: 'test', bounds: { min: [cell.bounds.min[0], cell.bounds.min[1] - 2, cell.bounds.min[2]], max: cell.bounds.max },
    cells: [cell], portals: [], entities: [], surfaces: [], spawn: { pos: [(cell.bounds.min[0] + cell.bounds.max[0]) / 2, cell.floorY + 0.02, (cell.bounds.min[2] + cell.bounds.max[2]) / 2], yaw: 0, cell: cell.id }, exits: [],
  };
}

test('水槽から歩いて上がれる（実際の移動: 水の真ん中から 4 方向へ歩くと、どの向きでも床の高さに戻る。水の中は遅い）', () => {
  let tried = 0;
  const fails: string[] = [];
  for (const kind of ['hall', 'corridor'] as DressKind[]) {
    for (let i = 0; i < 6; i++) {
      const seed = hashAll('pool-walk', kind, i);
      const { cell, openings, keepOut } = poolCell(kind, seed);
      dressCell({ cell, kind, openings, keepOut, rng: new Rng(seed ^ 0x77), density: 0.5 });
      const sim = new Sim(floorOf(cell), { tuning: t });
      const p = sim.players[0]!;
      for (const w of cell.boxes.filter(isWater)) {
        const cx = (w.min[0] + w.max[0]) / 2, cz = (w.min[2] + w.max[2]) / 2;
        // 前方 = -Z を yaw で回した向き。縁（笠石）か床に上がれば床の高さ
        for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          tried++;
          sim.teleport(0, [cx, w.min[1] + 0.02, cz], yaw);
          let out = false, slowSeen = false;
          for (let k = 0; k < 600 && !out; k++) {
            sim.step([{ ...IDLE_COMMAND, yaw, pitch: 0, moveY: 1 }]);
            if (p.inWater && p.zoneSlow < 1) slowSeen = true;
            if (k > 5 && p.onGround && Math.abs(p.pos[1] - cell.floorY) < 0.02) out = true;
          }
          if (!out) fails.push(`${kind} #${i} yaw ${yaw.toFixed(2)}: 上がれない（${p.pos.map((v) => v.toFixed(2)).join(', ')}）`);
          if (!slowSeen) fails.push(`${kind} #${i}: 水の中で遅くならない`);
        }
      }
    }
  }
  assert.ok(tried >= 8, `試した水槽: ${tried}`);
  assert.deepEqual(fails, []);
});

test('生成したプールのフロア: 水は水槽に囲われる・区画の外形が水槽の底を含む・検証に通る', () => {
  let floors = 0, waters = 0;
  const issues: string[] = [];
  for (let w = 1; w <= 400 && floors < 4; w++) {
    const key = { world: w, depth: 1 + (w % 9), variant: 0 };
    if (rollProfile(key, t, 0).family.id !== 'pool') continue;
    const r = generateFloorReport(key, t, { dress: dressCell });
    if (r.profile.family.id !== 'pool') continue;
    floors++;
    for (const c of r.floor.cells) {
      waters += c.boxes.filter(isWater).length;
      issues.push(...waterIssues(c).map((s) => `${r.floor.id}: ${s}`));
    }
  }
  assert.ok(floors >= 2, `プールのフロア: ${floors}`);
  assert.ok(waters >= 4, `水槽: ${waters}`);
  assert.deepEqual(issues, []);
});

test('床に置く物は水面の上に置かれない（底が床の近くの物）', () => {
  for (const kind of POOL_KINDS) {
    for (let i = 0; i < 20; i++) {
      const seed = hashAll('pool-over', kind, i);
      const { cell, openings, keepOut } = poolCell(kind, seed);
      const n0 = cell.boxes.length;
      dressCell({ cell, kind, openings, keepOut, rng: new Rng(seed ^ 0x55), density: 1 });
      const waters = cell.boxes.filter(isWater);
      for (const b of cell.boxes.slice(n0)) {
        if (b.kind?.startsWith('basin') || b.min[1] - cell.floorY > 0.05) continue;
        for (const w of waters) {
          const over = b.min[0] < w.max[0] - 0.02 && b.max[0] > w.min[0] + 0.02 && b.min[2] < w.max[2] - 0.02 && b.max[2] > w.min[2] + 0.02;
          assert.ok(!over, `${kind} #${i}: 水の上の ${b.mat}/${b.kind ?? ''} ${JSON.stringify([b.min, b.max])}`);
        }
      }
    }
  }
});
