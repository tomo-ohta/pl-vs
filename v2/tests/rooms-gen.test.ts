import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning, makeTuning, type Tuning } from '../core/config/tuning.ts';
import { doorFronts, hitsAny } from '../core/gen/anomaly/util.ts';
import { CATALOG_BY_WS } from '../core/gen/catalog/index.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, validateFloor, type GenReport } from '../core/gen/floor/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { reachOpenings } from '../core/gen/reach.ts';
import { roomShapeDef, roomShapeDefs } from '../core/gen/rooms/index.ts';
import type { Dir } from '../core/math/vec.ts';
import { WALL_T, type CellLayout, type FloorLayout, type WallOpening } from '../core/world/layout.ts';

/**
 * 部屋の形（core/gen/rooms）の生成の検査: 多数の seed で、形を掛けた部屋の開口どうしが歩いてつながる・開口の前が空いている・
 * 箱と灯りの予算の中・区画の外形に収まる・決定的・裏のフロアは表と同じ形・見本に置ける・台帳の形が登録されている
 */

const t = defaultTuning();
const gen = (w: number, d: number, v = 0, tt: Tuning = t): GenReport => generateFloorReport({ world: w, depth: d, variant: v }, tt, { dress: dressCell });

/** 1 つの形だけを出やすくした調整（その形の検査を多く回す） */
export function only(id: string): Tuning {
  const o: Record<string, number> = { 'rooms.chance.room': 1, 'rooms.chance.hall': 1, 'rooms.openMul': 1 };
  for (const d of roomShapeDefs()) o[`rooms.w.${d.id}`] = d.id === id ? 10 : 0;
  return makeTuning(o).tuning;
}

/** 区画の開口を portal から作り直す（フロアの検証と同じ到達判定をするため） */
export function openingsOf(floor: FloorLayout, id: string): WallOpening[] {
  const out: WallOpening[] = [];
  for (const p of floor.portals) {
    const k = p.cells.indexOf(id);
    if (k < 0) continue;
    const dir = (k === 0 ? p.dir : (p.dir + 2) % 4) as Dir;
    const a = p.aabb;
    const alongX = dir === 0 || dir === 2;
    out.push({ id: p.id, pos: [(a.min[0] + a.max[0]) / 2, a.min[1], (a.min[2] + a.max[2]) / 2], dir, width: alongX ? a.max[0] - a.min[0] : a.max[2] - a.min[2], height: a.max[1] - a.min[1] });
  }
  return out;
}

/** 形の部屋の問題（到達・開口の前・予算・外形） */
export function shapeIssues(floor: FloorLayout, cell: CellLayout, t0: Tuning = t): string[] {
  const out: string[] = [];
  const ops = openingsOf(floor, cell.id);
  const at = `${floor.id} ${cell.id}(${cell.shape})`;
  if (ops.length >= 2) {
    const r = reachOpenings(cell, ops, 0.1);
    if (r?.blocked.length) out.push(`${at}: 届かない開口 ${r.blocked.join(',')}`);
  }
  // 開口の前（壁の内側 0.95 m）に、開口の下端より上に出る当たる物が無い（壁の厚みの中の物・床板は除く。舞台の奥の扉は舞台の上を見る）
  const zones = doorFronts(cell, ops, 0.95, 0.25).map((z, i) => ({ min: [z.min[0], ops[i]!.pos[1] + 0.03, z.min[2]] as [number, number, number], max: [z.max[0], Math.min(z.max[1], ops[i]!.pos[1] + 2.0), z.max[2]] as [number, number, number] }));
  const hit = cell.boxes.find((b) => b.solid && hitsAny(zones, b) && !(b.max[0] - b.min[0] <= WALL_T + 1e-3 || b.max[2] - b.min[2] <= WALL_T + 1e-3));
  if (hit) out.push(`${at}: 開口の前に当たる物 ${hit.mat}/${hit.kind ?? ''} ${JSON.stringify([hit.min, hit.max])}`);
  if (cell.lights.length > t0['rooms.maxLights']) out.push(`${at}: 灯りが多い ${cell.lights.length}`);
  if (cell.boxes.length > 3200) out.push(`${at}: 箱が多い ${cell.boxes.length}`);
  // 箱の座標は数（NaN・無限が無い）。傾けた箱は当たり判定にしない
  const nan = cell.boxes.find((x) => [...x.min, ...x.max, x.slope?.rise ?? 0].some((v) => !Number.isFinite(v)));
  if (nan) out.push(`${at}: 数でない座標 ${JSON.stringify([nan.min, nan.max])}`);
  if (cell.boxes.some((x) => x.slope && x.solid)) out.push(`${at}: 当たる傾いた箱`);
  if (cell.lights.some((l) => l.pos.some((v) => !Number.isFinite(v)) || !(l.distance > 0))) out.push(`${at}: 灯りの位置・届く距離`);
  // 箱は区画の外形の中（描画の見える範囲・焼き込みの範囲）
  const b = cell.bounds, e = 0.06;
  const out1 = cell.boxes.find((x) => x.min[0] < b.min[0] - e || x.max[0] > b.max[0] + e || x.min[2] < b.min[2] - e || x.max[2] > b.max[2] + e || x.min[1] < b.min[1] - e || x.max[1] + (x.slope ? Math.max(0, x.slope.rise) : 0) > b.max[1] + e);
  if (out1) out.push(`${at}: 外形の外の箱 ${out1.mat} ${JSON.stringify([out1.min, out1.max])} / ${JSON.stringify(b)}`);
  return out;
}

test('部屋の形: 多数の seed で検証に通る・形の部屋の開口どうしが歩いてつながる・開口の前が空いている・予算と外形の中', () => {
  const fails: string[] = [];
  const by = new Map<string, number>();
  let floors = 0, shaped = 0;
  for (let w = 1; w <= 160; w++) {
    const r = gen(w, 1 + (w % 9), w % 8 === 0 ? 1 : 0);
    floors++;
    const issues = validateFloor(r.floor);
    if (issues.length) fails.push(`w${w}: ${issues.join(' / ')}`);
    for (const c of r.floor.cells) {
      if (!c.shape) continue;
      shaped++;
      by.set(c.shape, (by.get(c.shape) ?? 0) + 1);
      assert.ok(roomShapeDef(c.shape), `${c.shape} が登録されている`);
      assert.ok(!r.gimmicks?.gimmicks.some((g) => g.cell === c.id), `w${w} ${c.id}: 仕掛けの部屋には掛けない`);
      fails.push(...shapeIssues(r.floor, c).map((s) => `w${w} ${s}`));
    }
  }
  console.log(`  ${floors} フロア: 形の部屋 ${shaped}（1 フロア ${(shaped / floors).toFixed(2)}）`);
  console.log(`  ${[...by].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('・')}`);
  assert.ok(shaped / floors > 0.8, `形の部屋が出る: ${shaped}/${floors}`);
  assert.deepEqual(fails, []);
});

test('部屋の形: 形ごとに 1 つだけ出やすくしても、検証に通る（形の作りの検査）', () => {
  const fails: string[] = [];
  const made = new Map<string, number>();
  for (const def of roomShapeDefs()) {
    const tt = only(def.id);
    // 出にくい形（大きな部屋・広間だけの形）は、3 つ見つかるまで多くの世界を見る
    for (let w = 1; w <= 14 || ((made.get(def.id) ?? 0) < 3 && w <= 160); w++) {
      const r = gen(w * 7 + 3, 1 + (w % 9), 0, tt);
      const issues = validateFloor(r.floor);
      if (issues.length) fails.push(`${def.id} w${w}: ${issues.join(' / ')}`);
      for (const c of r.floor.cells) {
        if (c.shape !== def.id) continue;
        made.set(def.id, (made.get(def.id) ?? 0) + 1);
        fails.push(...shapeIssues(r.floor, c, tt).map((s) => `${def.id} w${w} ${s}`));
      }
    }
  }
  console.log(`  ${[...made].map(([k, v]) => `${k} ${v}`).join('・')}`);
  for (const def of roomShapeDefs()) assert.ok((made.get(def.id) ?? 0) >= 3, `${def.id} が組める: ${made.get(def.id) ?? 0}`);
  assert.deepEqual(fails, []);
});

test('部屋の形: 同じ key なら同じ（決定的）・裏のフロアは表の形を同じ部屋に（空いていれば）', () => {
  let same = 0, frontShapes = 0;
  for (let w = 1; w <= 48; w++) {
    const a = gen(w, 1 + (w % 7)), b = gen(w, 1 + (w % 7));
    assert.equal(JSON.stringify(a.floor), JSON.stringify(b.floor), `w${w}: 決定的`);
    const back = gen(w, 1 + (w % 7), 1);
    const fs = new Map(a.floor.cells.filter((c) => c.shape).map((c) => [c.id, c.shape]));
    frontShapes += fs.size;
    for (const c of back.floor.cells) {
      if (c.shape) assert.equal(c.shape, fs.get(c.id), `w${w} ${c.id}: 裏の形は表と同じ`);
      if (c.shape && c.shape === fs.get(c.id)) same++;
    }
  }
  // 裏で仕掛け・形と重ねられない異変の入った部屋には形を組まないので、全部は揃わない（異変が 45 種になり 3 割前後）
  console.log(`  裏のフロアにも表の形 ${same}/${frontShapes}`);
  assert.ok(same > frontShapes * 0.2, `裏のフロアにも表の形がある: ${same}/${frontShapes}`);
});

test('部屋の形: 見本のフロアに頼んだ形を置ける（形の id でも案の番号でも）', () => {
  for (const def of roomShapeDefs()) {
    const r = showcaseFloor(t, { ids: [def.id], dress: dressCell });
    assert.ok(r.floor.cells.some((c) => c.shape === def.id), `${def.id} を見本に置ける`);
    assert.ok(r.gimmicks!.tour.some((s) => s.label === `部屋の形: ${def.name}`), `${def.id}: 見て回る順に入る`);
  }
  const r = showcaseFloor(t, { ids: ['S01'], dress: dressCell });
  assert.ok(r.floor.cells.some((c) => c.shape === 'pillars'), '案の番号でも置ける');
});

test('台帳: 部屋の形の id が登録されている（作った形は全部 done）', () => {
  const list = CATALOG_BY_WS['rooms']!;
  for (const e of list) for (const m of e.impl) if (m.kind === 'room' && e.status === 'done') assert.ok(roomShapeDef(m.id), `${e.idea}: ${m.id} が登録されている`);
  const done = new Set(list.filter((e) => e.status === 'done').flatMap((e) => e.impl.filter((m) => m.kind === 'room').map((m) => m.id)));
  for (const def of roomShapeDefs()) {
    assert.ok(done.has(def.id), `${def.id} が台帳に done で載っている`);
    assert.ok(list.some((e) => e.idea === def.idea), `${def.id} の案の番号 ${def.idea}`);
  }
});
