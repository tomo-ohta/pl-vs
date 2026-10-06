/**
 * 段階 4（carry）: 運ぶ物・パズル・ミニゲームの仕掛けが、ふつうのフロアの生成と見本のフロア（?try=<id>）に出ること。
 * - ふつうの生成: 担当の仕掛けの大半が出る（重みは統合で全体を見て調整するので、全種が出ることまでは求めない）
 * - 見本のフロア: 1 種ずつ指定すると必ず置ける（?try=<id> で見られる）
 * - 手がかり・運ぶ物を同じフロアの別の区画に置く（GimmickContext.clueCells / addToCell）
 * - 同じ鍵からは同じフロア（決定的）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { CARRY_CATALOG } from '../core/gen/catalog/carry.ts';
import { gimmickDef, type GimmickContext } from '../core/gen/gimmicks/types.ts';
import '../core/gen/gimmicks/index.ts';

const t = defaultTuning();
const MINE = [...new Set(CARRY_CATALOG.flatMap((e) => e.impl.filter((m) => m.kind === 'gimmick').map((m) => m.id)))];
const key = (w: number) => ({ world: w, depth: 1 + (w % 9), variant: 0 });

test('carry: 担当の仕掛けは全部登録されている', () => {
  assert.ok(MINE.length >= 30, `仕掛けの数 ${MINE.length}`);
  for (const id of MINE) assert.ok(gimmickDef(id), `登録されていない: ${id}`);
});

test('carry: ふつうのフロアの生成に担当の仕掛けの大半が出る', () => {
  const count = new Map<string, number>(MINE.map((m) => [m, 0]));
  for (let w = 1; w <= 160; w++) {
    const r = generateFloorReport(key(w), t);
    for (const g of r.gimmicks?.gimmicks ?? []) if (count.has(g.def)) count.set(g.def, count.get(g.def)! + 1);
  }
  const seen = [...count].filter(([, n]) => n > 0).length;
  const missing = [...count].filter(([, n]) => n === 0).map(([k]) => k);
  assert.ok(seen >= Math.ceil(MINE.length * 0.75), `出た種類 ${seen} / ${MINE.length}（出ない: ${missing.join(' ')}）`);
});

test('carry: 見本のフロアで 1 種ずつ必ず置ける（?try=<id>）', () => {
  const fail: string[] = [];
  for (const id of MINE) {
    const r = showcaseFloor(t, { ids: [id] });
    if (!r.gimmicks?.gimmicks.some((g) => g.def === id)) fail.push(id);
  }
  assert.deepEqual(fail, [], `置けない: ${fail.join(' ')}`);
});

test('carry: 手がかり・運ぶ物を同じフロアの別の区画に置く', () => {
  // 仕掛けの build を包んで、別の区画に足した箱・部品を記録する（テストの中だけ。後で戻す）
  const ids = ['keycardGate', 'lostItem', 'bulbRoom', 'dialLock', 'colorMix', 'clockRoom', 'replicaRoom', 'tilePicture', 'shadowPuzzle'];
  const used = new Map<string, number>();
  const saved = new Map<string, (ctx: GimmickContext) => void>();
  for (const id of ids) {
    const def = gimmickDef(id)!;
    const build = def.build;
    saved.set(id, build);
    def.build = (ctx: GimmickContext): void => {
      const wrapped: GimmickContext = Object.create(ctx);
      let other = 0;
      if (ctx.addToCell) wrapped.addToCell = (cell, b) => { if (cell !== ctx.slot.cell.id) other++; return ctx.addToCell!(cell, b); };
      wrapped.addEntity = (name, e) => { if (e.cell && e.cell !== ctx.slot.cell.id) other++; return ctx.addEntity(name, e); };
      build(wrapped);
      if (other > 0) used.set(id, (used.get(id) ?? 0) + 1);
    };
  }
  try {
    let checked = 0;
    for (let w = 1; w <= 24; w++) {
      const r = showcaseFloor(t, { ids, from: w * 7 });
      // 置いた仕掛けの、別の区画にある部品は、その区画が実在する
      for (const g of r.gimmicks?.gimmicks ?? []) {
        for (const e of r.floor.entities.filter((x) => x.id.startsWith(`${g.id}.`) && x.cell && x.cell !== g.cell)) {
          assert.ok(r.floor.cells.some((c) => c.id === e.cell), `${e.id} の区画 ${e.cell} が無い`);
          checked++;
        }
      }
      if (used.size >= 4 && checked > 0) break;
    }
    assert.ok(used.size >= 4, `別の区画を使った仕掛け: ${[...used.keys()].join(' ')}`);
    assert.ok(checked > 0, '別の区画に置いた運ぶ物が無い');
  } finally {
    for (const [id, build] of saved) gimmickDef(id)!.build = build;
  }
});

test('carry: 同じ鍵からは同じフロア（担当の仕掛けを含むフロア）', () => {
  let n = 0;
  for (let w = 1; w <= 40 && n < 4; w++) {
    const a = generateFloorReport(key(w), t);
    if (!a.gimmicks?.gimmicks.some((g) => MINE.includes(g.def))) continue;
    const b = generateFloorReport(key(w), t);
    assert.deepEqual(b.gimmicks?.gimmicks, a.gimmicks?.gimmicks, `world ${w} の仕掛け`);
    assert.equal(JSON.stringify(b.floor.entities), JSON.stringify(a.floor.entities), `world ${w} の部品`);
    assert.equal(JSON.stringify(b.floor.cells.map((c) => c.boxes)), JSON.stringify(a.floor.cells.map((c) => c.boxes)), `world ${w} の箱`);
    n++;
  }
  assert.ok(n >= 2, `担当の仕掛けを含むフロアが少ない: ${n}`);
});
