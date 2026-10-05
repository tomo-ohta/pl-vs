/**
 * フロアの地図の看板と誰かの地図（core/gen/gimmicks/map/signs.ts）: 入口の案内図（N07）・現在地の看板（N04）・他人の地図（N09）。
 * ふつうのフロアに出る・壁と床の空いている所・嘘が 1 つ・現在地は自分のいない場所・誰かの書き込み・読むと写る・決定的。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, validateFloor } from '../core/gen/floor/index.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { Box, EntitySpec, FloorLayout } from '../core/world/layout.ts';
import { buildMapInfo, cellAtPos } from '../client/map/MapInfo.ts';
import { ghostOf, readableContent } from '../client/map/scene.ts';

const t = defaultTuning();
const gen = (w: number, d: number, dress = true) => generateFloorReport({ world: w, depth: d, variant: 0 }, t, dress ? { dress: dressCell } : {});
const boxOf = (e: EntitySpec): Box => { const b = e.params.box as { min: number[]; max: number[] }; return { min: b.min as [number, number, number], max: b.max as [number, number, number], mat: 'void', solid: false }; };
const overlap = (a: Box, b: Box): boolean => a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2];

test('案内図・看板・誰かの地図がふつうのフロアに出る・嘘の種類がばらける・検証に通る', () => {
  const count = { guide: 0, here: 0, note: 0 };
  const lies: Record<string, number> = {};
  for (let w = 1; w <= 60; w++) {
    const r = gen(w, 1 + (w % 8), w % 3 !== 0);
    assert.deepEqual(validateFloor(r.floor), [], `${r.floor.id}@${w}`);
    for (const e of r.floor.entities) {
      if (e.type === 'mapBoard' && e.params.mode === 'guide') {
        count.guide++;
        assert.equal(e.cell, r.floor.spawn.cell, '案内図は入口の部屋');
        const k = String((e.params.lie as { kind?: string }).kind ?? 'none');
        lies[k] = (lies[k] ?? 0) + 1;
      }
      if (e.type === 'mapBoard' && e.params.mode === 'here') count.here++;
      if (e.type === 'mapNote') count.note++;
    }
  }
  console.log('  ', JSON.stringify(count), JSON.stringify(lies));
  assert.ok(count.guide >= 40, '案内図はたいていのフロアに');
  assert.ok(count.here >= 15 && count.note >= 12);
  for (const k of ['secret', 'exit', 'phantom', 'missing']) assert.ok((lies[k] ?? 0) >= 2, `嘘 ${k}`);
});

test('板は壁の空いている所（家具・飾りに重ならない）・紙は床の空いている所', () => {
  for (let w = 1; w <= 30; w++) {
    const r = gen(w, 2 + (w % 5));
    for (const e of r.floor.entities.filter((x) => (x.type === 'mapBoard' && x.params.mode !== 'survey') || x.type === 'mapNote')) {
      const cell = r.floor.cells.find((c) => c.id === e.cell)!;
      const face = boxOf(e);
      const tag = e.type === 'mapNote' ? 'mapNote' : null;
      const others = cell.boxes.filter((b) => !b.propGroup?.includes(tag ?? (e.params.mode === 'guide' ? 'mapGuide' : 'mapHere')) && !(b.solid && b.max[1] <= cell.floorY + 0.001) && !(e.type === 'mapNote' && b.propGroup?.includes('mapNote')));
      const near = { ...face, min: [face.min[0] - 0.02, face.min[1], face.min[2] - 0.02] as [number, number, number], max: [face.max[0] + 0.02, face.max[1], face.max[2] + 0.02] as [number, number, number] };
      const bad = others.find((b) => overlap(b, near) && (b.min[1] > cell.floorY + 0.01 || e.type === 'mapNote') && b.mat !== cell.palette.wall);
      assert.ok(!bad, `w${w} ${e.id}: ${bad?.mat} ${bad?.propGroup}`);
    }
  }
});

test('現在地の看板: 「現在地」は看板の所ではない・看板に描く範囲に入っている。誰かの地図があれば、その所を指す', () => {
  let n = 0, toNote = 0;
  for (let w = 1; w <= 80; w++) {
    const r = gen(w, 1 + (w % 8), false);
    const note = r.floor.entities.find((e) => e.type === 'mapNote');
    for (const e of r.floor.entities.filter((x) => x.type === 'mapBoard' && x.params.mode === 'here')) {
      n++;
      const here = e.params.here as number[], truth = e.params.truth as number[];
      assert.ok(Math.hypot(here[0]! - truth[0]!, here[1]! - truth[1]!) > 3, `${e.id}: 現在地が看板の所`);
      assert.ok(Math.hypot(here[0]! - truth[0]!, here[1]! - truth[1]!) <= Number(e.params.radius));
      if (note) {
        const b = boxOf(note);
        if (Math.hypot((b.min[0] + b.max[0]) / 2 - here[0]!, (b.min[2] + b.max[2]) / 2 - here[1]!) < 0.05) toNote++;
        else assert.fail(`${e.id}: 誰かの地図を指していない`);
      }
    }
  }
  assert.ok(n >= 20, `看板 ${n}`);
  assert.ok(toNote >= 5);
});

test('誰かの地図: 入口から落とした部屋までの道・書き込み（出口・言葉・隠しの手がかり）・名前と日付', () => {
  let n = 0, hint = 0;
  for (let w = 1; w <= 80; w++) {
    const r = gen(w, 1 + (w % 8), false);
    const note = r.floor.entities.find((e) => e.type === 'mapNote');
    if (!note) continue;
    n++;
    const cells = note.params.cells as string[];
    assert.ok(cells.includes(r.floor.spawn.cell) && cells.includes(note.cell!), '入口と落とした部屋');
    const trail = note.params.trail as number[];
    assert.ok(trail.length >= 4 && trail.length % 2 === 0);
    const info = buildMapInfo(r.floor, t);
    assert.equal(cellAtPos(info, [trail[trail.length - 2]!, r.floor.cells.find((c) => c.id === note.cell)!.floorY, trail[trail.length - 1]!])?.id, note.cell, '跡は落とした所で終わる');
    const marks = note.params.marks as { text: string; kind: string }[];
    assert.ok(marks.some((m) => m.text === 'ここで落とした？'));
    if (marks.some((m) => m.text === '壁の向こうから音がする')) hint++;
    assert.equal(note.params.date, '2003.07.13');
    assert.ok(typeof note.params.author === 'string');
    const g = ghostOf(info, info.readables.find((x) => x.id === note.id)!);
    assert.equal(g.source, 'note');
    assert.ok(g.cells.length >= 2 && g.marks.length >= 2);
  }
  assert.ok(n >= 15, `誰かの地図 ${n}`);
  assert.ok(hint >= 2, `隠しの手がかり ${hint}`);
});

test('案内図の嘘「隠し場所に部屋」: 描いた部屋は隠し場所の区画（隠しの手がかり）', () => {
  let n = 0;
  for (let w = 1; w <= 120 && n < 4; w++) {
    const r = gen(w, 1 + (w % 8), false);
    const guide = r.floor.entities.find((e) => e.type === 'mapBoard' && e.params.mode === 'guide');
    const lie = guide?.params.lie as { kind?: string; cells?: string[] } | undefined;
    if (!guide || lie?.kind !== 'secret') continue;
    n++;
    const secret = r.gimmicks!.secrets.find((s) => s.cells.join() === lie.cells!.join());
    assert.ok(secret, '隠し場所の区画');
    const info = buildMapInfo(r.floor, t);
    const c = readableContent(info, info.readables.find((x) => x.id === guide.id)!);
    assert.equal(c.cells.length, c.ids.length + secret!.cells.length);
  }
  assert.ok(n >= 2);
});

test('調べると読める（部品の read）・決定的', () => {
  let floor: FloorLayout | null = null;
  for (let w = 1; w <= 20 && !floor; w++) { const r = gen(w, 2, false); if (r.floor.entities.some((e) => e.type === 'mapBoard' && e.params.mode === 'guide')) floor = r.floor; }
  assert.ok(floor);
  const e = floor!.entities.find((x) => x.type === 'mapBoard' && x.params.mode === 'guide')!;
  const sim = new Sim(floor!, { tuning: t });
  const b = boxOf(e);
  const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const nrm = e.params.normal as number[];
  // 板の前 1.2 m に立って板を見る
  const pos: [number, number, number] = [c[0]! + nrm[0]! * 1.2, floor!.cells.find((x) => x.id === e.cell)!.floorY + 0.02, c[2]! + nrm[1]! * 1.2];
  const yaw = Math.atan2(nrm[0]!, nrm[1]!);
  sim.teleport(0, pos, yaw);
  for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND, yaw, pitch: 0 }]);
  const p = sim.players[0]!;
  const eyeY = p.pos[1] + p.eye;
  const pitch = Math.atan2(c[1]! - eyeY, 1.2);
  assert.equal(sim.outputOf(e.id, 'read'), 0);
  sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
  sim.step([{ ...IDLE_COMMAND, yaw, pitch }]);
  assert.equal(sim.outputOf(e.id, 'read'), 1, '調べると読める');
  const again = gen(1, 2, false).floor.entities.filter((x) => x.type.startsWith('map'));
  assert.equal(JSON.stringify(again), JSON.stringify(gen(1, 2, false).floor.entities.filter((x) => x.type.startsWith('map'))));
});
