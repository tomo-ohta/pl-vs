import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell, THEME_KITS } from '../core/gen/dress/index.ts';
import { RAIL_HEIGHT, railLines } from '../core/gen/dress/kits/corridor.ts';
import type { DressKind } from '../core/gen/dress/types.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { Rng } from '../core/math/rng.ts';
import type { Dir } from '../core/math/vec.ts';
import { makeCell, opening } from '../core/world/build.ts';
import { box, WALL_T, type Box, type CellLayout, type MatId, type WallOpening } from '../core/world/layout.ts';
import { themePalette } from '../core/world/palettes.ts';

/**
 * 階段の手すりの検査: 手すりは段ごとの短い棒と縦のつなぎ（段々）ではなく、段鼻を結ぶ線に沿った 1 本の傾いた棒（Box.slope）と、
 * 床・踊り場の水平の棒でできていること。傾きは段の勾配（蹴上げ / 踏面）と同じ、高さは段鼻の線・床から RAIL_HEIGHT
 */

const RISER_MAX = 0.17, TREAD = 0.28;
const t = defaultTuning();

interface Stair { cell: CellLayout; openings: WallOpening[]; axis: 'x' | 'z'; riser: number; rise: number; nosings: { a: number; y: number }[]; rail: MatId; wallFaces: number[] }

/** core/gen/floor/geometry.ts の buildStraight と同じ形の階段（低い端から offset で段を上げ、上がりきった先は踊り場） */
function stairs(theme: string, axis: 'x' | 'z', lowEnd: 'a0' | 'a1', rise: number, width: number, offset: number, tail: number, floorY: number): Stair {
  const n = Math.ceil(rise / RISER_MAX - 1e-9);
  const riser = rise / n;
  const len = offset + n * TREAD + tail;
  const a0 = 3.0, a1 = a0 + len, center = -2.0;
  const rect = axis === 'x' ? { x0: a0, x1: a1, z0: center - width / 2, z1: center + width / 2 } : { x0: center - width / 2, x1: center + width / 2, z0: a0, z1: a1 };
  const yLow = floorY, yHigh = floorY + rise;
  const at = (d: number): number => (lowEnd === 'a0' ? a0 + d : a1 - d);
  const p0 = (y: number): [number, number, number] => (axis === 'x' ? [a0, y, center] : [center, y, a0]);
  const p1 = (y: number): [number, number, number] => (axis === 'x' ? [a1, y, center] : [center, y, a1]);
  const openings = [
    opening('a0', p0(lowEnd === 'a0' ? yLow : yHigh), (axis === 'x' ? 3 : 2) as Dir, 1.6, 2.4),
    opening('a1', p1(lowEnd === 'a1' ? yLow : yHigh), (axis === 'x' ? 1 : 0) as Dir, 1.6, 2.4),
  ];
  // 入口（低い端）が 1 つ目
  if (lowEnd === 'a1') openings.reverse();
  const cell = makeCell({ id: `st-${axis}-${lowEnd}-${rise}`, role: 'connector', rects: [rect], height: rise + 2.8, floorY, palette: themePalette(theme), openings, theme, lights: 'none' });
  const w0 = center - width / 2 + WALL_T, w1 = center + width / 2 - WALL_T;
  const slab = (d0: number, d1: number, top: number, kind: string): void => {
    const q0 = Math.min(at(d0), at(d1)), q1 = Math.max(at(d0), at(d1));
    const b = axis === 'x' ? box([q0, floorY, w0], [q1, top, w1], 'floorTile') : box([w0, floorY, q0], [w1, top, q1], 'floorTile');
    b.kind = kind;
    cell.boxes.push(b);
  };
  const nosings: { a: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    slab(offset + i * TREAD, offset + (i + 1) * TREAD, floorY + (i + 1) * riser, 'stairStep');
    nosings.push({ a: at(offset + i * TREAD), y: floorY + (i + 1) * riser });
  }
  slab(offset + n * TREAD, len, floorY + rise, 'landing');
  return { cell, openings, axis, riser, rise, nosings: nosings.sort((p, q) => p.a - q.a), rail: THEME_KITS[theme]?.rail ?? 'handrailWood', wallFaces: [center - width / 2 + WALL_T, center + width / 2 - WALL_T] };
}

const ai = (axis: 'x' | 'z'): 0 | 2 => (axis === 'x' ? 0 : 2);
const ci = (axis: 'x' | 'z'): 0 | 2 => (axis === 'x' ? 2 : 0);

/** 手すりの棒（面に沿って 10 cm 以上・断面 5 cm 角の、手すりの材質の当たらない箱） */
function railBars(boxes: Box[], axis: 'x' | 'z', mat: MatId): Box[] {
  const a = ai(axis), c = ci(axis);
  return boxes.filter((b) => b.mat === mat && !b.solid && b.max[a] - b.min[a] >= 0.1 && Math.abs(b.max[c] - b.min[c] - 0.05) < 1e-6);
}

/** 棒の位置 at（面に沿った座標）での上端の高さ */
function barTop(b: Box, axis: 'x' | 'z', at: number): number {
  const a = ai(axis);
  const k = b.slope ? b.slope.rise / (b.max[a] - b.min[a]) : 0;
  return b.max[1] + k * (at - b.min[a]);
}

function checkStair(s: Stair, kind: DressKind, seed: number): string[] {
  const out: string[] = [];
  const n0 = s.cell.boxes.length;
  dressCell({ cell: s.cell, kind, openings: s.openings, keepOut: [], rng: new Rng(seed), density: 0.5 });
  const added = s.cell.boxes.slice(n0);
  const a = ai(s.axis), c = ci(s.axis);
  const where = `${s.cell.id} ${kind}`;
  const pitch = s.riser / TREAD;
  const fy = s.cell.floorY;
  const sorted = s.nosings;
  const first = sorted[0]!, last = sorted[sorted.length - 1]!;
  const up = last.y > first.y;
  // 段鼻の線（段のある所）・床・踊り場の高さ
  const nosingLine = (at: number): number => first.y + (up ? pitch : -pitch) * (at - first.a);
  for (const face of s.wallFaces) {
    const bars = railBars(added, s.axis, s.rail).filter((b) => Math.min(Math.abs(b.min[c] - face), Math.abs(b.max[c] - face)) < 0.15).sort((p, q) => p.min[a] - q.min[a]);
    if (!bars.length) { out.push(`${where}: 壁 ${face} に手すりが無い`); continue; }
    const sloped = bars.filter((b) => b.slope);
    if (sloped.length !== 1) out.push(`${where}: 傾いた棒が ${sloped.length} 本（1 本のはず）`);
    if (bars.length > 3) out.push(`${where}: 棒が ${bars.length} 本（床・傾き・踊り場の 3 本まで）`);
    for (const b of bars) {
      // 段々の縦のつなぎが無い: 傾ける前の箱の高さは太さ × 1/cos まで
      if (b.max[1] - b.min[1] > 0.07) out.push(`${where}: 縦に長い手すりの箱 ${JSON.stringify([b.min, b.max])}`);
      // 壁から 0.13 m 以内（通り道を狭めない）
      const d = Math.max(Math.abs(b.min[c] - face), Math.abs(b.max[c] - face));
      if (d > 0.13) out.push(`${where}: 壁から離れすぎ ${d.toFixed(3)}`);
    }
    for (const b of sloped) {
      const k = b.slope!.rise / (b.max[a] - b.min[a]);
      if (b.slope!.axis !== s.axis) out.push(`${where}: 傾きの軸 ${b.slope!.axis}`);
      if (Math.abs(Math.abs(k) - pitch) > pitch * 0.01) out.push(`${where}: 傾き ${k.toFixed(3)}（段の勾配 ${pitch.toFixed(3)}）`);
      if (Math.sign(k) !== (up ? 1 : -1)) out.push(`${where}: 傾きの向きが逆`);
    }
    // 段鼻ごとに、手すりの上端 − 段鼻 = RAIL_HEIGHT
    for (const ns of sorted) {
      const bar = bars.find((b) => ns.a >= b.min[a] - 1e-6 && ns.a <= b.max[a] + 1e-6 && b.slope) ?? bars.find((b) => ns.a >= b.min[a] - 1e-6 && ns.a <= b.max[a] + 1e-6);
      if (!bar) { out.push(`${where}: 段鼻 ${ns.a.toFixed(2)} の上に手すりが無い`); continue; }
      const h = barTop(bar, s.axis, ns.a) - nosingLine(ns.a);
      if (Math.abs(h - RAIL_HEIGHT) > 0.012) out.push(`${where}: 段鼻 ${ns.a.toFixed(2)} の上の手すりの高さ ${h.toFixed(3)}`);
    }
    // 床と踊り場の上は水平で、床・踊り場から RAIL_HEIGHT
    const lowA = up ? bars[0]!.min[a] + 0.02 : bars[bars.length - 1]!.max[a] - 0.02;
    const highA = up ? bars[bars.length - 1]!.max[a] - 0.02 : bars[0]!.min[a] + 0.02;
    const at = (x: number): number => { const b = bars.find((q) => x >= q.min[a] && x <= q.max[a])!; return barTop(b, s.axis, x); };
    if (Math.abs(at(lowA) - fy - RAIL_HEIGHT) > 0.012) out.push(`${where}: 床の上の手すりの高さ ${(at(lowA) - fy).toFixed(3)}`);
    if (Math.abs(at(highA) - (fy + s.rise) - RAIL_HEIGHT) > 0.012) out.push(`${where}: 踊り場の上の手すりの高さ ${(at(highA) - fy - s.rise).toFixed(3)}`);
    // つながっている（隣の棒の端の高さが同じ・隙間が無い）
    for (let i = 0; i + 1 < bars.length; i++) {
      const p = bars[i]!, q = bars[i + 1]!;
      if (q.min[a] > p.max[a] + 1e-6) out.push(`${where}: 棒の間に隙間 ${(q.min[a] - p.max[a]).toFixed(3)}`);
      const j = (p.max[a] + q.min[a]) / 2;
      if (Math.abs(barTop(p, s.axis, j) - barTop(q, s.axis, j)) > 0.012) out.push(`${where}: 棒のつなぎ目で高さが違う`);
    }
  }
  return out;
}

test('階段の手すりは段鼻の線に沿った 1 本の傾いた棒（段々にならない）・床と踊り場は水平・高さは RAIL_HEIGHT', () => {
  const issues: string[] = [];
  let seed = 1;
  for (const theme of ['CorridorOffice', 'CorridorHotel', 'GenericCorridor', 'PoolCorridor']) {
    for (const axis of ['x', 'z'] as const) {
      for (const lowEnd of ['a0', 'a1'] as const) {
        for (const rise of [0.9, 1.8, 3.6]) {
          for (const floorY of [0, -3.6]) {
            issues.push(...checkStair(stairs(theme, axis, lowEnd, rise, 2.2, 0.8, 0.8, floorY), 'stairs', seed++));
            // 出口の階段（扉側の踊り場 1.2 m、下の踊り場 1.6 m）
            issues.push(...checkStair(stairs(theme, axis, lowEnd, rise, 2.2, 1.6, 1.2, floorY), 'exit', seed++));
          }
        }
      }
    }
  }
  assert.deepEqual(issues, []);
});

test('手すりの線: 段の続きは 1 本の傾き、平らな所は水平、大きな段差では切る', () => {
  // 床 0（1 m）→ 段 4 つ（0.28 m・0.17 m ずつ）→ 踊り場（1 m）
  const prof = [{ a0: 0, a1: 1, top: 0 }];
  for (let i = 0; i < 4; i++) prof.push({ a0: 1 + i * 0.28, a1: 1 + (i + 1) * 0.28, top: (i + 1) * 0.17 });
  prof[prof.length - 1]!.a1 += 1;
  const [line] = railLines(prof, 0.87);
  assert.ok(line);
  assert.equal(line.length, 4, `折れ点 4 つ（床の水平・傾き・踊り場の水平）: ${JSON.stringify(line)}`);
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = line as [[number, number], [number, number], [number, number], [number, number]];
  assert.ok(Math.abs(x0) < 1e-9 && Math.abs(y0 - 0.87) < 1e-9);
  assert.ok(Math.abs(x1 - (1 - 0.28)) < 1e-9 && Math.abs(y1 - 0.87) < 1e-9, '傾きの始まりは最初の段鼻の 1 段手前');
  assert.ok(Math.abs(x2 - (1 + 3 * 0.28)) < 1e-9 && Math.abs(y2 - (0.68 + 0.87)) < 1e-9, '傾きの終わりは最後の段鼻');
  assert.ok(Math.abs(x3 - 3.12) < 1e-9 && Math.abs(y3 - y2) < 1e-9, '踊り場は水平');
  // 下りの向き（鏡写し）
  const mirrored = prof.map((p) => ({ a0: -p.a1, a1: -p.a0, top: p.top })).reverse();
  const [m] = railLines(mirrored, 0.87);
  assert.deepEqual(m!.map(([x, y]) => [+(-x).toFixed(6), +y.toFixed(6)]).reverse(), line.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]));
  // 1 m の段差（台）では線を切る
  const cut = railLines([{ a0: 0, a1: 1.5, top: 0 }, { a0: 1.5, a1: 3, top: 1.0 }], 0.87);
  assert.equal(cut.length, 2);
  assert.ok(cut.every((l) => l.every(([, y], _i, arr) => Math.abs(y - arr[0]![1]) < 1e-9)), '切った線はどちらも水平');
});

test('生成したフロアの階段: 段のある区画には傾いた手すりが付き、縦に長い手すりの箱が無い', () => {
  let cells = 0, sloped = 0;
  const bad: string[] = [];
  for (let w = 1; w <= 12; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 8), variant: 0 }, t, { dress: dressCell });
    for (const c of r.floor.cells) {
      if (!c.boxes.some((b) => b.kind === 'stairStep')) continue;
      cells++;
      const rails = c.boxes.filter((b) => !b.solid && (b.mat === 'handrailWood' || b.mat === 'metal'));
      const s = rails.filter((b) => b.slope);
      sloped += s.length;
      if (s.length < 2) bad.push(`${r.floor.id} ${c.id}: 傾いた手すり ${s.length}`);
      for (const b of rails) if (b.slope && b.solid) bad.push(`${r.floor.id} ${c.id}: 当たる傾いた箱`);
      for (const b of rails) {
        const along = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
        if (b.max[1] - b.min[1] > 0.12 && along < 0.1 && b.min[1] - c.floorY > 0.5) bad.push(`${r.floor.id} ${c.id}: 縦のつなぎ ${JSON.stringify([b.min, b.max])}`);
      }
    }
  }
  assert.ok(cells >= 12, `段のある区画: ${cells}`);
  assert.ok(sloped >= cells * 2, `傾いた手すり: ${sloped}`);
  assert.deepEqual(bad, []);
});
