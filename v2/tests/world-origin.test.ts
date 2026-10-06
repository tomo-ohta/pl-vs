// 区域は階の座標で直接作る（docs/endless-world.md 4.1）: 原点を変えても、骨組みと区画の形（部屋・廊下・扉）は平行移動するだけ。
// 中身（家具・仕掛け・隠し）は座標から引く乱数があるので同じにはならない（どこに作っても同じ場所なら同じ物になる）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { Rng } from '../core/math/rng.ts';
import { buildGeometry, GenError, type FloorGeometry } from '../core/gen/floor/geometry.ts';
import { rollProfile, type FloorProfile } from '../core/gen/floor/profile.ts';
import { buildSkeleton } from '../core/gen/floor/skeleton.ts';
import type { PatternId } from '../core/gen/floor/themes.ts';

const t = defaultTuning();
const O: [number, number] = [384, -1216];

function geoOf(p: FloorProfile, geoTry: number): FloorGeometry | null {
  const rng = new Rng(p.seed);
  const sk = buildSkeleton(p, rng.fork('skeleton'), t);
  try { return buildGeometry(p, sk, rng.fork(geoTry === 0 ? 'geometry' : `geometry${geoTry}`), t); } catch (e) { if (e instanceof GenError) return null; throw e; }
}

test('原点を変えても、格子の型の区画の形は平行移動するだけ（0.05 m の丸めの差まで）', () => {
  const fails: string[] = [];
  const shapes: PatternId[] = ['grid', 'maze', 'comb', 'ring', 'hub', 'linear', 'chain', 'courtyard', 'shortcut', 'loops', 'concentric', 'skip', 'gallery', 'crossing', 'islands', 'nest', 'megahall', 'mirror', 'staff', 'crawl', 'tower', 'elevator', 'descent', 'shaft', 'arcade', 'wings'];
  let compared = 0;
  shapes.forEach((shape, i) => {
    for (let k = 0; k < 3; k++) {
      const p = rollProfile({ world: 31 + i * 3 + k, depth: 3 + (i % 5), variant: 0 }, t, 0, shape);
      for (let gt = 0; gt < 4; gt++) {
        const a = geoOf(p, gt), b = geoOf({ ...p, origin: O }, gt);
        if (!a || !b) { if (!!a !== !!b) fails.push(`${shape}: 片方だけ作れない`); continue; }
        compared++;
        if (a.cells.length !== b.cells.length) { fails.push(`${shape}: 区画の数 ${a.cells.length} / ${b.cells.length}`); break; }
        for (let c = 0; c < a.cells.length; c++) {
          const ca = a.cells[c]!.cell, cb = b.cells[c]!.cell;
          const off = ca.footprint.some((f, n) => { const g = cb.footprint[n]; return !g || Math.abs(f.x0 + O[0] - g.x0) > 0.06 || Math.abs(f.x1 + O[0] - g.x1) > 0.06 || Math.abs(f.z0 + O[1] - g.z0) > 0.06 || Math.abs(f.z1 + O[1] - g.z1) > 0.06; });
          if (ca.id !== cb.id || off || Math.abs(ca.floorY - cb.floorY) > 1e-6) { fails.push(`${shape} ${ca.id}: ${JSON.stringify(ca.footprint)} / ${JSON.stringify(cb.footprint)}`); break; }
        }
        if (a.portals.length !== b.portals.length) fails.push(`${shape}: 開口の数`);
        if (Math.abs(a.spawn.pos[0] + O[0] - b.spawn.pos[0]) > 0.06 || Math.abs(a.spawn.pos[2] + O[1] - b.spawn.pos[2]) > 0.06) fails.push(`${shape}: 出てくる位置`);
        break;
      }
    }
  });
  assert.deepEqual(fails, []);
  assert.ok(compared >= 60, `比べた数 ${compared}`);
});
