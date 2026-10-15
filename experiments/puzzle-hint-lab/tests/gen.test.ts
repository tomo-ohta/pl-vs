/**
 * 世界の生成の試験: 100 部屋・重ならない・全部つながる・難易度の内訳・謎が手がかりから解ける・物が扉や互いに重ならない・ヒントの文
 * 実行: npm test（node --test）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { difficultyCounts } from '../src/gen/difficulty.ts';
import { sharedWall } from '../src/gen/mapgen.ts';
import {
  BUTTON_COUNT,
  CLUE_WIDTH,
  COLOR_WORDS,
  KINDS_BY_DIFFICULTY,
  doorSide,
  doorU,
  wallLength,
  type ColorKey,
  type Puzzle,
} from '../src/gen/puzzles.ts';
import { generateWorld, isCorrect, START_ROOM, type World } from '../src/gen/world.ts';
import { overlaps, WALL_T } from '../src/gen/types.ts';

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1).concat([1015, 20261015]);
const worlds = new Map<number, World>();
const world = (seed: number): World => {
  let w = worlds.get(seed);
  if (!w) worlds.set(seed, (w = generateWorld(seed)));
  return w;
};

test('100 部屋が重ならず、扉で全部つながる', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    assert.equal(w.rooms.length, 100);
    for (let a = 0; a < w.rooms.length; a++) {
      for (let b = a + 1; b < w.rooms.length; b++) assert.ok(!overlaps(w.rooms[a].rect, w.rooms[b].rect), `seed ${seed}: ${a} と ${b} が重なる`);
    }
    const seen = new Set([START_ROOM]);
    const queue = [START_ROOM];
    while (queue.length) {
      const i = queue.shift()!;
      for (const j of w.rooms[i].neighbors) if (!seen.has(j)) (seen.add(j), queue.push(j));
    }
    assert.equal(seen.size, 100, `seed ${seed}: つながっていない部屋がある`);
    // 番号は幅優先の順（スタートが 001）
    assert.equal(w.rooms[START_ROOM].id, 1);
  }
});

test('扉は 2 部屋が共有する壁の内側にあり、角から離れている', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    for (const d of w.doors) {
      const wall = sharedWall(w.rooms[d.a].rect, w.rooms[d.b].rect);
      assert.ok(wall, `seed ${seed}: 扉の 2 部屋が壁を共有していない`);
      assert.equal(wall.vertical, d.vertical);
      assert.equal(wall.at, d.at);
      assert.ok(d.c - d.width / 2 >= wall.s0 + 0.4 && d.c + d.width / 2 <= wall.s1 - 0.4, `seed ${seed}: 扉が角に近すぎる`);
    }
    // 回り道がある（木より扉が多い）
    assert.ok(w.doors.length >= 99 + 10, `seed ${seed}: 回り道が少ない（扉 ${w.doors.length}）`);
  }
});

test('部屋の大きさは一辺 5〜13 m', () => {
  for (const seed of SEEDS) {
    for (const r of world(seed).rooms) {
      assert.ok(r.rect.w >= 5 && r.rect.w <= 13 && r.rect.d >= 5 && r.rect.d <= 13);
    }
  }
});

test('難易度はちょうど 50 / 25 / 20 / 5 部屋、スタートは難易度 0', () => {
  assert.deepEqual(difficultyCounts(100), [50, 25, 20, 5]);
  for (const seed of SEEDS) {
    const w = world(seed);
    const counts = [0, 0, 0, 0];
    for (const r of w.rooms) counts[r.difficulty]++;
    assert.deepEqual(counts, [50, 25, 20, 5], `seed ${seed}`);
    assert.equal(w.rooms[START_ROOM].difficulty, 0);
  }
});

test('同じ seed なら同じ世界、違う seed なら違う世界', () => {
  const a = generateWorld(7);
  const b = generateWorld(7);
  assert.deepEqual(a.rooms.map((r) => r.rect), b.rooms.map((r) => r.rect));
  assert.deepEqual(a.puzzles, b.puzzles);
  assert.deepEqual(a.hints, b.hints);
  assert.notDeepEqual(generateWorld(8).rooms.map((r) => r.rect), a.rooms.map((r) => r.rect));
});

/** 手がかりだけから正しい順を読み解く（人が解くのと同じ道筋） */
function solveFromClues(p: Puzzle): number[] {
  const byColor = (cs: readonly ColorKey[]): number[] => cs.map((c) => p.buttons.findIndex((b) => b.color === c));
  const asc = (vals: number[]): number[] => [...vals.keys()].sort((a, b) => vals[a] - vals[b]);
  switch (p.kind) {
    case 'single':
      return [0];
    case 'pips':
      return asc(p.buttons.map((b) => b.pips));
    case 'blink':
      return asc(p.buttons.map((b) => b.blink));
    case 'height':
      return asc(p.buttons.map((b) => b.mount.y));
    case 'stripes':
    case 'lights':
    case 'remote': {
      const c = p.clues[0];
      assert.ok(c.kind === 'stripes' || c.kind === 'lights');
      return byColor(c.colors);
    }
    case 'symbols': {
      const c = p.clues[0];
      assert.ok(c.kind === 'symbols');
      return c.symbols.map((s) => p.buttons.findIndex((b) => b.symbol === s));
    }
    case 'words': {
      const c = p.clues[0];
      assert.ok(c.kind === 'words');
      const colorOf = (w: string): ColorKey => (Object.keys(COLOR_WORDS) as ColorKey[]).find((k) => COLOR_WORDS[k].includes(w))!;
      return byColor(c.words.map(colorOf));
    }
    case 'legend': {
      const seq = p.clues.find((c) => c.kind === 'symbols');
      const table = p.clues.find((c) => c.kind === 'legend');
      assert.ok(seq?.kind === 'symbols' && table?.kind === 'legend');
      return byColor(seq.symbols.map((s) => table.rows.find((r) => r.symbol === s)!.color));
    }
  }
}

test('謎: ボタンの数・型は難易度どおりで、手がかりから正しい順が読み解ける（端から順ではない）', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    w.puzzles.forEach((p, i) => {
      const d = w.rooms[i].difficulty;
      assert.equal(p.difficulty, d);
      assert.equal(p.buttons.length, BUTTON_COUNT[d], `seed ${seed} 部屋 ${i}`);
      assert.ok(KINDS_BY_DIFFICULTY[d].includes(p.kind) || (d === 3 && p.kind === 'legend'));
      assert.deepEqual([...p.answer].sort(), [...p.buttons.keys()], '正しい順は全ボタンの並べ替え');
      const solved = solveFromClues(p);
      assert.deepEqual(solved, p.answer, `seed ${seed} 部屋 ${i}（${p.kind}）: 手がかりと正解が合わない`);
      assert.ok(isCorrect(p, solved));
      if (p.answer.length >= 3) {
        assert.ok(!p.answer.every((v, k) => v === k), '左から順で解けてしまう');
        assert.ok(!p.answer.every((v, k) => v === p.answer.length - 1 - k), '右から順で解けてしまう');
      }
      // 隣の部屋の手がかりは、扉でつながった部屋にある
      if (p.kind === 'remote') assert.ok(w.rooms[i].neighbors.includes(p.remote) && p.clues[0].mount.room === p.remote);
      // 色の謎のボタンの色はすべて違う
      const cs = p.buttons.map((b) => b.color).filter((c) => c);
      assert.equal(new Set(cs).size, cs.length);
    });
    // 難易度 1・2 の型は偏りすぎない（どの型も 1 部屋以上）
    for (const d of [1, 2] as const) {
      for (const k of KINDS_BY_DIFFICULTY[d]) assert.ok(w.puzzles.some((p) => p.kind === k), `seed ${seed}: ${k} が無い`);
    }
  }
});

test('壁の物（ボタン・手がかり）は壁の内側にあり、扉や互いに重ならない', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    const items = new Map<string, { a: number; b: number; what: string }[]>();
    const add = (room: number, side: string, u: number, width: number, what: string): void => {
      const k = `${room}${side}`;
      if (!items.has(k)) items.set(k, []);
      items.get(k)!.push({ a: u - width / 2, b: u + width / 2, what });
    };
    for (const d of w.doors) {
      for (const i of [d.a, d.b]) {
        const r = w.rooms[i].rect;
        const side = doorSide(r, d);
        add(i, side, doorU(r, side, d), d.width, '扉');
      }
    }
    for (const p of w.puzzles) {
      for (const b of p.buttons) add(b.mount.room, b.mount.side, b.mount.u, 0.3, 'ボタン');
      for (const c of p.clues) {
        const width = c.kind === 'stripes' ? CLUE_WIDTH.stripes(c.colors.length) : CLUE_WIDTH[c.kind];
        add(c.mount.room, c.mount.side, c.mount.u, width, c.kind);
      }
    }
    for (const [k, list] of items) {
      const room = Number(k.slice(0, -1));
      const len = wallLength(w.rooms[room].rect, k.slice(-1) as 'N');
      for (const it of list) {
        if (it.what === '扉') continue;
        assert.ok(it.a >= WALL_T && it.b <= len - WALL_T, `seed ${seed} 部屋 ${room}: ${it.what} が壁の外`);
      }
      list.sort((x, y) => x.a - y.a);
      for (let j = 1; j < list.length; j++) {
        assert.ok(list[j].a >= list[j - 1].b - 1e-6, `seed ${seed} 部屋 ${k}: ${list[j - 1].what} と ${list[j].what} が重なる`);
      }
    }
  }
});

test('ヒント: 全部屋に 1〜3 の文があり、値の入れ忘れが無い', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    w.hints.forEach((h, i) => {
      assert.equal(h.length, 3);
      for (const s of h) {
        assert.ok(s.length >= 8, `seed ${seed} 部屋 ${i}: 短すぎる「${s}」`);
        assert.ok(!/undefined|NaN|\bnull\b|の壁の壁|最初は、|次は。|「」|＝、|＝。|ROOM  |は。/.test(s), `seed ${seed} 部屋 ${i}: 値の入れ忘れ「${s}」`);
        // 「北の壁」「ROOM 011 の壁」の形だけ
        assert.ok(!/(^|[^東西南北\s])の壁/.test(s), `seed ${seed} 部屋 ${i}: 方角が抜けている「${s}」`);
      }
      // ヒント 3 は最初に押すものを明かす（難易度 0 はボタンの壁）
      const p = w.puzzles[i];
      if (p.difficulty > 0) assert.match(h[2], /最初は/);
    });
  }
});
