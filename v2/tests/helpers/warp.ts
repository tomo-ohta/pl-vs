/**
 * 試験用（warp）: 空間のゆがみの仕掛けを確かめる道具。
 * - twinMismatch: 写し方 x で写した所どうしの、見える範囲の箱（区画の描画される箱と扉の板）が同じか（継ぎ目が見えない）
 * - stepWith: 決めた操作で n tick 進め、移された（player.respawn cause 'warp'）イベントを集める
 * - faceTo: 点を向く視線
 */
import type { AABB } from '../../core/math/aabb.ts';
import type { Vec3 } from '../../core/math/vec.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand, type SimEvent } from '../../core/sim/types.ts';
import type { Box, FloorLayout } from '../../core/world/layout.ts';
import { xBox, type Xform } from '../../core/sim/parts/warp/util.ts';

const SKIP = new Set(['colliderOnly', 'emitOnly']);

interface Item { min: Vec3; max: Vec3; mat: string; what: string }

/** 描画される箱（区画の箱・扉の板）のうち、範囲 a に掛かる物 */
export function itemsIn(floor: FloorLayout, a: AABB): Item[] {
  const out: Item[] = [];
  const hit = (b: { min: number[]; max: number[] }): boolean => b.min[0]! < a.max[0] && b.max[0]! > a.min[0] && b.min[1]! < a.max[1] && b.max[1]! > a.min[1] && b.min[2]! < a.max[2] && b.max[2]! > a.min[2];
  for (const c of floor.cells) {
    if (c.bounds.max[0] < a.min[0] || c.bounds.min[0] > a.max[0] || c.bounds.max[1] < a.min[1] || c.bounds.min[1] > a.max[1] || c.bounds.max[2] < a.min[2] || c.bounds.min[2] > a.max[2]) continue;
    for (const b of c.boxes as Box[]) {
      if (SKIP.has(b.kind ?? '') || b.revealGroup || !hit(b)) continue;
      out.push({ min: [...b.min], max: [...b.max], mat: b.mat, what: `${c.id}` });
    }
  }
  for (const e of floor.entities) {
    if (e.type !== 'door') continue;
    const pn = e.params.panel as { min: number[]; max: number[] };
    if (hit(pn)) out.push({ min: [pn.min[0]!, pn.min[1]!, pn.min[2]!], max: [pn.max[0]!, pn.max[1]!, pn.max[2]!], mat: String(e.params.mat ?? 'door'), what: e.id });
  }
  return out;
}

/** 箱を範囲 a で切り取った部分（見える範囲の端で切れた箱を比べるため） */
function clip(i: Item, a: AABB): Item {
  return { ...i, min: [Math.max(i.min[0], a.min[0]), Math.max(i.min[1], a.min[1]), Math.max(i.min[2], a.min[2])], max: [Math.min(i.max[0], a.max[0]), Math.min(i.max[1], a.max[1]), Math.min(i.max[2], a.max[2])] };
}

const key = (i: Item): string => `${i.mat}|${i.min.map((v) => v.toFixed(2)).join(',')}|${i.max.map((v) => v.toFixed(2)).join(',')}`;

/**
 * 範囲 a（写す前の所）の箱と、写した先 x(a) の箱が同じか。違う箱の一覧を返す（空なら継ぎ目が見えない）。
 * 箱は範囲で切り取って比べる（範囲の端をまたぐ長い壁・床も比べられる）。小さな違い（2 cm 未満）は見ない
 */
export function twinMismatch(floor: FloorLayout, x: Xform, a: AABB): string[] {
  const src = itemsIn(floor, a).map((i) => clip(i, a)).filter((i) => i.max[0] - i.min[0] > 0.005 && i.max[1] - i.min[1] > 0.005 && i.max[2] - i.min[2] > 0.005);
  const b = xBox(x, a);
  const dst = itemsIn(floor, b).map((i) => clip(i, b)).filter((i) => i.max[0] - i.min[0] > 0.005 && i.max[1] - i.min[1] > 0.005 && i.max[2] - i.min[2] > 0.005);
  const want = new Map<string, number>();
  for (const i of src) { const m = xBox(x, i); const k = key({ ...i, min: m.min, max: m.max }); want.set(k, (want.get(k) ?? 0) + 1); }
  const have = new Map<string, number>();
  for (const i of dst) { const k = key(i); have.set(k, (have.get(k) ?? 0) + 1); }
  const bad: string[] = [];
  for (const [k, n] of want) if ((have.get(k) ?? 0) !== n) bad.push(`写す前にあって写した先に無い: ${k}（${n} / ${have.get(k) ?? 0}）`);
  for (const [k, n] of have) if (!want.has(k)) bad.push(`写した先にだけある: ${k}（${n}）`);
  return bad;
}

export function faceTo(from: readonly number[], to: readonly number[]): number {
  return Math.atan2(-(to[0]! - from[0]!), -(to[2]! - from[2]!));
}

/** 決めた操作で n tick 進める（f が操作を返す）。移されたイベントを集める */
export function stepWith(sim: Sim, n: number, f: (i: number) => Partial<InputCommand>): SimEvent[] {
  const warps: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    const p = sim.players[0]!;
    sim.step([{ ...IDLE_COMMAND, yaw: p.yaw, pitch: p.pitch, ...f(i) }]);
    for (const e of sim.drainEvents()) if (e.type === 'player.respawn' && e.data?.cause === 'warp') warps.push(e);
  }
  return warps;
}
