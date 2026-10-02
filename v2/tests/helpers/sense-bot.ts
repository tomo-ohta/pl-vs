/**
 * 歩く人（bot.ts）が、担当 sense の仕掛け（光・音・視線・時間）を遊び方どおりに通るための手助け。bot.ts から呼ぶ。
 * - senseDrive: 仕掛けが歩き方を決める間（光の床を渡る・光の円を待つ・見られている間は止まる …）、その tick の操作を返す。
 *   返した tick は bot.ts の道探しをしない（止まったとも数えない）。決めることが無ければ null
 * - senseAdjust: ふつうの歩き方の操作に足すこと（懐中電灯は点けたまま・橋は少し下を見て渡る）
 * どれも仕掛けの規則を破らない（光の床は光を当てて渡る・円の中を歩く・帯の点いている間に渡る）。
 */
import { lineAt, lineLength } from '../../core/sim/parts/sense/common.ts';
import { bandPhase, spotCenter } from '../../core/sim/parts/sense/floor.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../../core/sim/types.ts';
import type { CellLayout, EntitySpec, FloorLayout } from '../../core/world/layout.ts';

type V2 = [number, number];

/** 歩く人の決まり（試験が変えてよい）: flashlight = 懐中電灯を点けたまま歩く */
export const senseBotOptions = { flashlight: true };

function cellOf(floor: FloorLayout, p: readonly number[]): CellLayout | null {
  let best: CellLayout | null = null;
  for (const c of floor.cells) {
    const b = c.bounds;
    if (p[0]! < b.min[0] || p[0]! > b.max[0] || p[2]! < b.min[2] || p[2]! > b.max[2] || p[1]! < b.min[1] - 3 || p[1]! > b.max[1]) continue;
    if (!best || (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) < (best.bounds.max[0] - best.bounds.min[0]) * (best.bounds.max[2] - best.bounds.min[2])) best = c;
  }
  return best;
}

const PARTS = new WeakMap<FloorLayout, Map<string, EntitySpec[]>>();
/** 区画の部品（種類 type） */
function partsIn(floor: FloorLayout, cell: string, type: string): EntitySpec[] {
  let m = PARTS.get(floor);
  if (!m) PARTS.set(floor, (m = new Map()));
  const key = `${cell}|${type}`;
  let list = m.get(key);
  if (!list) m.set(key, (list = floor.entities.filter((e) => e.cell === cell && e.type === type)));
  return list;
}

/** 点 p へ歩く操作（向きも進む向き。近ければ止まる） */
function toward(sim: Sim, p: V2, o: Partial<InputCommand> = {}): InputCommand {
  const pl = sim.players[0]!;
  const dx = p[0] - pl.pos[0], dz = p[1] - pl.pos[2];
  const d = Math.hypot(dx, dz);
  return { ...IDLE_COMMAND, yaw: d > 1e-3 ? Math.atan2(-dx, -dz) : pl.yaw, pitch: 0, moveY: d > 0.08 ? 1 : 0, flashlight: senseBotOptions.flashlight, ...o };
}

const still = (sim: Sim, o: Partial<InputCommand> = {}): InputCommand => {
  const pl = sim.players[0]!;
  return { ...IDLE_COMMAND, yaw: pl.yaw, pitch: pl.pitch, flashlight: senseBotOptions.flashlight, ...o };
};

/** 線分 a→b の上での位置（0..1。外にもはみ出す）と、線からの距離 */
function onLine(p: V2, a: V2, b: V2): { t: number; off: number; len: number } {
  const ex = b[0] - a[0], ez = b[1] - a[1];
  const l2 = ex * ex + ez * ez;
  const t = l2 > 1e-9 ? ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / l2 : 0;
  const off = Math.hypot(a[0] + ex * t - p[0], a[1] + ez * t - p[1]);
  return { t, off, len: Math.sqrt(l2) };
}


const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** 折れ線の上の、点 p にいちばん近い所（始まりからの道のり d と、線からの距離 off） */
function project(pts: V2[], p: V2): { d: number; off: number } {
  let best = { d: 0, off: Infinity }, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const r = onLine(p, a, b);
    const k = Math.min(1, Math.max(0, r.t));
    const off = Math.hypot(a[0] + (b[0] - a[0]) * k - p[0], a[1] + (b[1] - a[1]) * k - p[1]);
    if (off < best.off - 1e-6) best = { d: acc + r.len * k, off };
    acc += r.len;
  }
  return best;
}

/**
 * 光の床（lightFloor）を渡る: 渡る道（params.cross。折れ線）の近い端 → 遠い端。区間の目標（leg）が向こう岸にあるときだけ。
 * 落ちた後（床より下）は手を出さない（ふつうの道探しで階段を上る）
 */
function lightFloor(sim: Sim, e: EntitySpec, leg3: readonly number[]): InputCommand | null {
  const pl = sim.players[0]!;
  const y = Number(e.params.y ?? 0);
  // 落ちた後・目標が穴の底（穴の底の隠し）→ 手を出さない（ふつうの道探しで階段を上る・穴へ下りる）
  if (pl.pos[1] < y - 0.4 || leg3[1]! < y - 0.5) return null;
  const leg: V2 = [leg3[0]!, leg3[2]!];
  // 照らした所だけある床は、懐中電灯を消している歩く人には渡れない（手を出さない）
  if (String(e.params.mode) === 'beam' && !senseBotOptions.flashlight) return null;
  const me: V2 = [pl.pos[0], pl.pos[2]];
  const lines = (e.params.cross as number[][][] | undefined) ?? [];
  if (!lines.length) return null;
  const mode = String(e.params.mode);
  // 向き: 区間の目標に近い端が行き先（渡っている途中で向きが変わらないように、目標で決める）
  const oriented = lines.map((l) => {
    const pts = l.map((q) => [q[0]!, q[1]!] as V2);
    const a = pts[0]!, b = pts[pts.length - 1]!;
    const fwd = Math.hypot(b[0] - leg[0], b[1] - leg[1]) <= Math.hypot(a[0] - leg[0], a[1] - leg[1]);
    const o = fwd ? pts : pts.slice().reverse();
    return { pts: o, a: o[0]!, b: o[o.length - 1]!, flip: !fwd, len: lineLength(o) };
  });
  const first = oriented[0]!;
  const lp = project(first.pts, leg), mp = project(first.pts, me);
  if (mode === 'beam' && (lp.d < first.len * 0.5 || lp.off > 1.5)) {
    // 照らした所だけある床で、渡る道の外の目標（3 つ目の開口など）: 目標へまっすぐ、足元の先を照らして（穴の上を通るときだけ）
    const tiles = e.params.tiles as number[][];
    const dist = Math.hypot(leg[0] - me[0], leg[1] - me[1]);
    let over = false;
    for (let s = 0.3; s < dist && !over; s += 0.3) {
      const q = lerp(me, leg, s / dist);
      over = tiles.some((r) => q[0] > r[0]! && q[0] < r[2]! && q[1] > r[1]! && q[1] < r[3]!);
    }
    return over ? toward(sim, leg, { pitch: -0.8 }) : null;
  }
  // 目標が手前の岸・渡り終えた（遠い端の近く）→ 何もしない
  if (lp.d < first.len * 0.5 || mp.d > first.len - 0.2) return null;
  const pitch = mode === 'seen' ? -0.4 : mode === 'beam' ? -0.8 : 0;
  if (mode === 'spot') {
    // 光の円: 入口側の端で円が止まるのを待ち、円の真ん中について歩き、向こうで止まったら降りる
    const t = (sim.tick + 1) * sim.dt;
    const sp = spotCenter(e.params, t);
    const atStart = Math.hypot(sp[0] - first.a[0], sp[1] - first.a[1]) < 0.05;
    const atFar = Math.hypot(sp[0] - first.b[0], sp[1] - first.b[1]) < 0.05;
    const inSpot = Math.hypot(sp[0] - me[0], sp[1] - me[1]) < Number(e.params.spotRadius ?? 1) - 0.25;
    if (mp.d < first.len * 0.12 && !inSpot) {
      // 岸: 円の端の手前で待つ。円が止まっていれば乗る
      if (atStart) return toward(sim, sp);
      return toward(sim, lineAt(first.pts, 0) as V2);
    }
    if (atFar) return toward(sim, first.b);
    return toward(sim, sp);
  }
  if (mode === 'bands') {
    // 光の帯: 点いたばかりの帯を選び、帯の手前の岸で待って、まっすぐ渡る
    const phases = e.params.phase as number[];
    const on = Number(e.params.onSec), off = Number(e.params.offSec);
    const t = (sim.tick + 1) * sim.dt;
    // いちばん近い帯で、始まりの点より先へ出ていれば渡っている途中（乗っている帯をそのまま渡る）
    const k = oriented.map((l) => onLine(me, l.a, l.b).off).reduce((bi, v, i, arr) => (v < arr[bi]! ? i : bi), 0);
    const onK = onLine(me, oriented[k]!.a, oriented[k]!.b);
    if (onK.t * onK.len > 0.15 && onK.off < 0.4) return toward(sim, oriented[k]!.b);
    const need = Math.hypot(first.b[0] - first.a[0], first.b[1] - first.a[1]) / 2.8 + 0.3;
    // 岸の上で、いちばん近い帯の手前へ。点いてから need 秒以上残っていれば渡る
    let best = -1, bestScore = Infinity;
    oriented.forEach((l, i) => {
      const left = bandPhase(t, on, off, phases[i] ?? 0);
      const wait = left > need ? 0 : left > 0 ? left + off : -left;
      const walk = Math.hypot(l.a[0] - me[0], l.a[1] - me[1]) / 2.8;
      const score = Math.max(wait, walk) + walk * 0.2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    const l = oriented[best]!;
    const d = Math.hypot(l.a[0] - me[0], l.a[1] - me[1]);
    if (d > 0.3) return toward(sim, l.a);
    return bandPhase(t, on, off, phases[best] ?? 0) > need ? toward(sim, l.b) : still(sim);
  }
  // beam / seen: 渡る道に乗り、道に沿って 0.8 m 先を目指し、前（少し下）を見て渡る
  if (mp.d < 0.05 && mp.off > 0.25) return toward(sim, first.a);
  return toward(sim, lineAt(first.pts, Math.min(first.len, mp.d + 0.8)) as V2, { pitch });
}

export function senseDrive(sim: Sim, leg: readonly number[]): InputCommand | null {
  const pl = sim.players[0]!;
  const cell = cellOf(sim.floor, pl.pos);
  if (!cell) return null;
  for (const e of partsIn(sim.floor, cell.id, 'lightFloor')) {
    const c = lightFloor(sim, e, leg);
    if (c) return c;
  }
  return null;
}

export function senseAdjust(_sim: Sim, cmd: InputCommand): void {
  // 懐中電灯は点けたまま（遊び始めは点いている）
  cmd.flashlight = senseBotOptions.flashlight;
}
