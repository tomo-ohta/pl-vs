/**
 * seed から世界（地図・難易度・謎・ヒント）を作る。同じ seed なら同じ世界（DOM / three を使わない）
 */
import { assignDifficulty } from './difficulty.ts';
import { makeHints, type Hints } from './hints.ts';
import { generateMap, MAP_DEFAULTS, type MapOptions } from './mapgen.ts';
import { generatePuzzles, type Puzzle } from './puzzles.ts';
import { makeRng, subSeed } from './rng.ts';
import { fmtId, type Difficulty, type Door, type Rect } from './types.ts';

export interface RoomInfo {
  index: number;
  /** 表示の番号（1〜） */
  id: number;
  /** "001" */
  label: string;
  rect: Rect;
  difficulty: Difficulty;
  /** この部屋の扉（World.doors の添字） */
  doors: number[];
  /** 扉でつながった部屋 */
  neighbors: number[];
}

export interface World {
  seed: number;
  rooms: RoomInfo[];
  doors: Door[];
  puzzles: Puzzle[];
  hints: Hints[];
  /** 全部屋の外枠（m） */
  bounds: { x0: number; z0: number; x1: number; z1: number };
}

/** スタートの部屋（ROOM 001） */
export const START_ROOM = 0;

export function generateWorld(seed: number, map: Partial<MapOptions> = {}): World {
  const m = generateMap(makeRng(subSeed(seed, 'map')), { ...MAP_DEFAULTS, ...map });
  const n = m.rects.length;
  const difficulty = assignDifficulty(n, makeRng(subSeed(seed, 'difficulty')), START_ROOM);
  // 入らない部屋の難易度は generatePuzzles が入れ替える（difficulty を書き換える）
  const puzzles = generatePuzzles(m.rects, m.doors, difficulty, makeRng(subSeed(seed, 'puzzles')), START_ROOM);
  const ids = m.rects.map((_, i) => i + 1);
  const hintRng = makeRng(subSeed(seed, 'hints'));
  const hints = puzzles.map((p) => makeHints(p, { rects: m.rects, doors: m.doors, ids }, hintRng));

  const rooms: RoomInfo[] = m.rects.map((rect, i) => ({
    index: i,
    id: ids[i],
    label: fmtId(ids[i]),
    rect,
    difficulty: difficulty[i],
    doors: [],
    neighbors: [],
  }));
  m.doors.forEach((d, k) => {
    rooms[d.a].doors.push(k);
    rooms[d.b].doors.push(k);
    rooms[d.a].neighbors.push(d.b);
    rooms[d.b].neighbors.push(d.a);
  });
  const bounds = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const r of m.rects) {
    bounds.x0 = Math.min(bounds.x0, r.x);
    bounds.z0 = Math.min(bounds.z0, r.z);
    bounds.x1 = Math.max(bounds.x1, r.x + r.w);
    bounds.z1 = Math.max(bounds.z1, r.z + r.d);
  }
  return { seed, rooms, doors: m.doors, puzzles, hints, bounds };
}

/** 押した順が正しいか（全部押してから判定する） */
export const isCorrect = (p: Puzzle, pressed: readonly number[]): boolean =>
  pressed.length === p.answer.length && pressed.every((b, k) => b === p.answer[k]);
