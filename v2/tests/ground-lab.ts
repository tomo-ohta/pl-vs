/**
 * 床と足場・装置（ground）の試験の道具（*.test.ts ではないので、これ自体は試験として走らない）。
 * - 実験室の部屋（tests/helpers/gimmick-lab.ts の labRoom）を、入口の向き 4 つ × 大きさで組む
 * - Sim を作る・まっすぐ走る・調べる・待つ
 * - 見本のフロア（showcase）にその仕掛けだけを置いて、部屋と隠しを集める（生成の偶然に頼らず、フロアの中で確かめる）
 */
import { defaultTuning, type Tuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import type { Dir, Vec3 } from '../core/math/vec.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../core/sim/types.ts';
import type { CellLayout, EntitySpec, FloorLayout } from '../core/world/layout.ts';
import { labRoom, type LabRoom } from './helpers/gimmick-lab.ts';

export const T = defaultTuning();
let rapier: Awaited<ReturnType<typeof loadRapier>> | null = null;

export async function newSim(floor: FloorLayout, t: Tuning = T): Promise<Sim> {
  rapier ??= await loadRapier();
  return new Sim(floor, { tuning: t, physics: new PhysicsWorld(rapier, 1 / 60) });
}

export function disposeSim(sim: Sim): void { sim.physics?.dispose(); }

/** 実験室の部屋を、入口の向き 4 つ × 大きさ × seed で組む（組めた物だけ） */
export function labRooms(def: string, o: { sizes?: { w: number; d: number; height?: number; kind?: 'room' | 'hall' }[]; exit?: 'none' | 'opposite' | 'side'; seeds?: number[]; t?: Tuning } = {}): (LabRoom & { tag: string; entry: Dir })[] {
  const out: (LabRoom & { tag: string; entry: Dir })[] = [];
  const sizes = o.sizes ?? [{ w: 6.6, d: 8.0 }, { w: 8.6, d: 12.0, kind: 'hall' as const }];
  for (const size of sizes) for (const entry of [0, 1, 2, 3] as Dir[]) for (const seed of o.seeds ?? [1, 2]) {
    const exit: Dir | null = o.exit === 'opposite' ? ((entry + 2) % 4) as Dir : o.exit === 'side' ? ((entry + 1) % 4) as Dir : null;
    const room = labRoom(def, { ...size, entry, exit, seed: seed * 7 + entry, entryAt: seed === 1 ? 0.5 : 0.35, exitAt: seed === 1 ? 0.5 : 0.62, ...(o.t ? { t: o.t } : {}) });
    if (room) out.push({ ...room, tag: `${size.w}x${size.d} 入口${entry} seed${seed}`, entry });
  }
  return out;
}

export const entitiesOf = (floor: FloorLayout, type: string): EntitySpec[] => floor.entities.filter((e) => e.type === type);

/** 何もせずに sec 秒 */
export function idle(sim: Sim, sec: number, cmd: Partial<InputCommand> = {}): void {
  const p = sim.players[0]!;
  for (let i = 0; i < Math.round(sec / sim.dt); i++) sim.step([{ ...IDLE_COMMAND, yaw: p.yaw, pitch: p.pitch, ...cmd }]);
}

/** 点 at を調べる（その方を向いて E） */
export function press(sim: Sim, at: readonly number[]): void {
  const p = sim.players[0]!;
  const ex = at[0]! - p.pos[0], ez = at[2]! - p.pos[2], ey = at[1]! - (p.pos[1] + p.eye);
  const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
  sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
}

/** 点 to へまっすぐ進む（着くか maxSec 秒まで）。最も低かった足元の高さを返す */
export function runTo(sim: Sim, to: readonly number[], o: { dash?: boolean; maxSec?: number; stopAt?: number; crouch?: boolean } = {}): { reached: boolean; minY: number } {
  const p = sim.players[0]!;
  let minY = p.pos[1];
  for (let i = 0; i < Math.round((o.maxSec ?? 10) / sim.dt); i++) {
    const dx = to[0]! - p.pos[0], dz = to[2]! - p.pos[2];
    if (Math.hypot(dx, dz) < (o.stopAt ?? 0.25)) return { reached: true, minY };
    sim.step([{ ...IDLE_COMMAND, yaw: Math.atan2(-dx, -dz), pitch: 0, moveY: 1, dash: !!o.dash, crouch: !!o.crouch }]);
    minY = Math.min(minY, p.pos[1]);
  }
  return { reached: false, minY };
}

/** 見本のフロアに仕掛け def だけを置く（隠しは差し出された物を全部付ける）。仕掛けの部屋と、その部屋に付いた隠し */
export interface ShowRoom { r: GenReport; floor: FloorLayout; cell: CellLayout; id: string; main: boolean }
export function showcaseRooms(def: string, worlds: number[] = [1, 2, 3], o: { flip?: boolean; dress?: boolean; t?: Tuning } = {}): ShowRoom[] {
  const out: ShowRoom[] = [];
  for (const w of worlds) {
    const r = generateFloorReport({ world: w, depth: 0, variant: 0 }, o.t ?? T, { showcase: { gimmicks: [def], ...(o.flip ? { flip: true } : {}) }, ...(o.dress === false ? {} : { dress: dressCell }) });
    for (const g of r.gimmicks?.gimmicks ?? []) {
      if (g.def !== def) continue;
      out.push({ r, floor: r.floor, cell: r.floor.cells.find((c) => c.id === g.cell)!, id: g.id, main: g.main });
    }
  }
  return out;
}

/** ふつうのフロアの生成（家具なし。速い）で、仕掛け def が本道に置かれたフロアを want 個まで探す */
export function mainPathFloors(def: string, want: number, maxWorld = 600): ShowRoom[] {
  const out: ShowRoom[] = [];
  for (let w = 1; w <= maxWorld && out.length < want; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: 0 }, T, {});
    const g = r.gimmicks?.gimmicks.find((x) => x.def === def && x.main);
    if (g) out.push({ r, floor: r.floor, cell: r.floor.cells.find((c) => c.id === g.cell)!, id: g.id, main: true });
  }
  return out;
}

/** 入口から出口の階段の下まで歩く（歩く人。仕掛けの解き方の手順 params.bot を使う） */
export async function walkFloorExit(floor: FloorLayout, maxSec = 400): Promise<{ ok: boolean; reason: string }> {
  const { walkTo } = await import('./helpers/bot.ts');
  const sim = await newSim(floor);
  const ex = floor.exits.find((e) => e.id === 'down') ?? floor.exits[0]!;
  const res = walkTo(sim, 'exitStairs', [(ex.aabb.min[0] + ex.aabb.max[0]) / 2, ex.aabb.min[1], (ex.aabb.min[2] + ex.aabb.max[2]) / 2], maxSec);
  const reached = sim.drainEvents().some((e) => e.type === 'floor.exit');
  disposeSim(sim);
  return { ok: res.ok && reached, reason: res.reason || (reached ? '' : '出口に入れない') };
}

/** ふつうのフロアの生成で、仕掛け def が置かれた数（worlds 個のフロア） */
export function countInFloors(defs: string[], worlds: number): Map<string, number> {
  const out = new Map<string, number>(defs.map((d) => [d, 0]));
  for (let w = 1; w <= worlds; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: 0 }, T, {});
    for (const g of r.gimmicks?.gimmicks ?? []) if (out.has(g.def)) out.set(g.def, out.get(g.def)! + 1);
  }
  return out;
}

export const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z];

/** 部品の出力（`部品.出力`） */
export const outputRef = (sim: Sim, ref: string): number => { const i = ref.lastIndexOf('.'); return sim.outputOf(ref.slice(0, i), ref.slice(i + 1)); };

export interface HintLike { steps: { at: number[]; look?: number[]; wait?: number; until?: string; crouch?: boolean }[]; enterAt?: number[]; exitAt?: number[] }

/** 区画の中で、手順（BotHint）を歩く人と同じようにこなす（立つ所へ歩く・調べる・待つ）。できなければ理由 */
export async function followHint(sim: Sim, h: HintLike, maxWait = 60): Promise<string> {
  const { walkTo } = await import('./helpers/bot.ts');
  for (const [i, st] of h.steps.entries()) {
    const res = walkTo(sim, cellIdAt(sim) ?? 'room', [st.at[0]!, st.at[1]!, st.at[2]!], 60);
    if (!res.ok) return `手順 ${i}: ${res.reason}`;
    if (st.look) press(sim, st.look);
    let w = 0;
    while ((w < (st.wait ?? 0) || (st.until && outputRef(sim, st.until) < 0.5)) && w < maxWait) { idle(sim, 1 / 60, { crouch: !!st.crouch }); w += 1 / 60; }
    if (w >= maxWait) return `手順 ${i}: ${st.until} を待ちきれない`;
  }
  return '';
}

/** 開口 enter から入って exit から出る手順（enterAt・exitAt で選ぶ） */
export function hintFor(floor: FloorLayout, enter: { pos: number[] }, exit?: { pos: number[] } | null): HintLike | null {
  const all = floor.entities.filter((e) => e.params.bot).flatMap((e) => (Array.isArray(e.params.bot) ? e.params.bot : [e.params.bot]) as unknown as HintLike[]);
  const near = (a: number[] | undefined, o: { pos: number[] } | null | undefined): boolean => !a || !o || Math.hypot(a[0]! - o.pos[0]!, a[1]! - o.pos[2]!) < 1.2;
  return all.find((h) => h.enterAt && near(h.enterAt, enter) && near(h.exitAt, exit)) ?? null;
}

function cellIdAt(sim: Sim): string | null {
  const p = sim.players[0]!.pos;
  return sim.floor.cells.find((c) => c.footprint.some((r) => p[0] >= r.x0 - 0.2 && p[0] <= r.x1 + 0.2 && p[2] >= r.z0 - 0.2 && p[2] <= r.z1 + 0.2))?.id ?? null;
}
