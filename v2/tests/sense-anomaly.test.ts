/**
 * 担当 sense の部屋まるごとの異変（rgbRoom・walkingShadow・sunbeam・lightning・silence・lateSteps・turningChairs・edgeFigure・slowTime）:
 * ふつうのフロアに出る・色の照明は 1 色ずつ点く・稲光は短く瞬く・遅い部屋は遅い・動く椅子は当たり判定を残す・描く物の材料がそろう
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { CellLayout } from '../core/world/layout.ts';
import { simOf, T } from './sense-util.ts';

const IDS = ['rgbRoom', 'walkingShadow', 'sunbeam', 'lightning', 'silence', 'lateSteps', 'turningChairs', 'edgeFigure', 'slowTime'];
type Found = { r: GenReport; cell: CellLayout; id: string };
const FOUND = new Map<string, Found[]>();
function find(def: string, want = 3): Found[] {
  if (!FOUND.size) {
    for (const d of IDS) FOUND.set(d, []);
    for (let w = 1; w <= 400 && IDS.some((d) => FOUND.get(d)!.length < want); w++) {
      const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: w % 5 === 0 ? 1 : 0 }, T, { dress: dressCell });
      for (const a of r.anomalies) {
        const list = FOUND.get(a.def);
        if (list && list.length < want) list.push({ r, cell: r.floor.cells.find((c) => c.id === a.cell)!, id: a.id });
      }
    }
  }
  return FOUND.get(def)!;
}
const fxOf = (f: Found, kind: string) => f.r.floor.entities.find((e) => e.id.startsWith(`${f.id}.`) && e.type === 'senseFx' && e.params.fx === kind);

test('担当 sense の異変: ふつうのフロアに出る', () => {
  for (const id of IDS) assert.ok(find(id).length >= 2, `${id} が出る: ${find(id).length}`);
});

test('色の照明: 灯りは赤・緑・青の 3 つずつ・一度に点くのは 1 色だけ・印は 3 色', async () => {
  for (const f of find('rgbRoom')) {
    const lamps = f.r.floor.entities.filter((e) => e.id.startsWith(`${f.id}.lamp`));
    assert.equal(lamps.length, 3);
    for (const l of f.cell.lights) assert.ok(lamps.some((x) => x.id === l.lampId), '灯りは 3 色の照明のどれか');
    const marks = fxOf(f, 'rgbMarks')!.params.marks as { color: number }[];
    assert.ok(marks.length >= 2, `印 ${marks.length}`);
    const sim = await simOf(f.r.floor);
    const seen = new Set<number>();
    for (let i = 0; i < 14 * 60; i++) {
      sim.step([IDLE_COMMAND]);
      const on = lamps.map((l) => sim.outputOf(l.id, 'on'));
      assert.ok(on.filter((v) => v > 0.5).length <= 1, '一度に 1 色');
      on.forEach((v, k) => { if (v > 0.5) seen.add(k); });
    }
    assert.equal(seen.size, 3, '3 色とも点く');
  }
});

test('雷: 稲光は短く瞬き、間隔が空く・雷鳴の遅れが付く', async () => {
  for (const f of find('lightning')) {
    const storm = f.r.floor.entities.find((e) => e.id === `${f.id}.storm`)!;
    const sim = await simOf(f.r.floor);
    let onTicks = 0, flashes = 0;
    sim.drainEvents();
    for (let i = 0; i < 25 * 60; i++) { sim.step([IDLE_COMMAND]); if (sim.outputOf(storm.id, 'out') > 0.5) onTicks++; }
    const cues = sim.drainEvents().filter((e) => e.type === 'cue' && e.entity === storm.id && e.data?.name === 'lightning.flash');
    flashes = cues.length;
    assert.ok(flashes >= 2 && flashes <= 25 / T['sense.lightning.minSec'] + 1, `稲光 ${flashes}`);
    assert.ok(onTicks < flashes * 0.5 * 60, `光っているのは短い ${onTicks}`);
    assert.ok(cues.every((c) => Number(c.data?.delay) > 0), '雷鳴の遅れ');
  }
});

test('遅い部屋: 部屋の中では歩く速さが落ちる', async () => {
  for (const f of find('slowTime')) {
    const z = f.cell.zones.find((x) => x.kind === 'water' && x.params?.dry)!;
    assert.ok(z, '遅くするゾーン');
    const sim = await simOf(f.r.floor);
    const r = f.cell.footprint[0]!;
    sim.teleport(0, [(r.x0 + r.x1) / 2, f.cell.floorY + 0.02, (r.z0 + r.z1) / 2], 0);
    for (let i = 0; i < 30; i++) sim.step([{ ...IDLE_COMMAND, moveY: 1 }]);
    const v = Math.hypot(sim.players[0]!.vel[0], sim.players[0]!.vel[2]);
    assert.ok(v < 3.0 * T['sense.slow.speed'] + 0.15, `速さ ${v.toFixed(2)}`);
  }
});

test('見ていない間に動く家具: 椅子などは描かない当たり判定になり（当たる）、描く物は部品の材料にある', () => {
  for (const f of find('turningChairs')) {
    const chairs = fxOf(f, 'chairs')!.params.chairs as { c: number[]; boxes: unknown[] }[];
    assert.ok(chairs.length >= 3, `動く物 ${chairs.length}`);
    for (const ch of chairs) {
      assert.ok(ch.boxes.length >= 1);
      const solid = f.cell.boxes.filter((b) => b.kind === 'colliderOnly' && b.solid && Math.hypot((b.min[0] + b.max[0]) / 2 - ch.c[0]!, (b.min[2] + b.max[2]) / 2 - ch.c[1]!) < 0.8);
      assert.ok(solid.length >= 1, '当たり判定は残る');
    }
  }
});

test('影・窓・無音・足跡・人影: 描く物の材料がそろう', () => {
  for (const f of find('walkingShadow')) { const p = fxOf(f, 'shadow')!.params; assert.ok(Number(p.a1) - Number(p.a0) >= 1.7, '影の歩く壁'); }
  for (const f of find('sunbeam')) {
    assert.ok(fxOf(f, 'sunbeam'), '日の光');
    assert.ok(f.cell.boxes.some((b) => b.mat === 'windowNight' && b.propGroup?.endsWith('a-sunWindow')), '夜の窓');
  }
  for (const f of find('silence')) { const p = fxOf(f, 'anechoic')!.params; assert.ok((p.faces as unknown[]).length >= 2, '吸音の壁'); }
  for (const f of find('lateSteps')) assert.ok(Number(fxOf(f, 'lateSteps')!.params.delay) > 0.1);
  for (const f of find('edgeFigure')) assert.ok((fxOf(f, 'edgeFigure')!.params.spots as unknown[]).length >= 3, '人影の立つ所');
});
