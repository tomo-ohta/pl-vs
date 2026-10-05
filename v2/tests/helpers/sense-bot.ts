/**
 * 歩く人（bot.ts）が、担当 sense の仕掛け（光・音・視線・時間）を遊び方どおりに通るための手助け。bot.ts から呼ぶ。
 * - senseDrive: 仕掛けが歩き方を決める間（光の床を渡る・光の円を待つ・見られている間は止まる …）、その tick の操作を返す。
 *   返した tick は bot.ts の道探しをしない（止まったとも数えない）。決めることが無ければ null
 * - senseAdjust: ふつうの歩き方の操作に足すこと（懐中電灯は点けたまま・橋は少し下を見て渡る）
 * どれも仕掛けの規則を破らない（光の床は光を当てて渡る・円の中を歩く・帯の点いている間に渡る）。
 */
import { lineAt, lineLength } from '../../core/sim/parts/sense/common.ts';
import { bandPhase, spotCenter } from '../../core/sim/parts/sense/floor.ts';
import { patternAt, searchSpot } from '../../core/sim/parts/sense/light.ts';
import { floodLevel, floodParams } from '../../core/sim/parts/sense/time.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../../core/sim/types.ts';
import type { CellLayout, EntitySpec, FloorLayout } from '../../core/world/layout.ts';
import { pathInCell } from './bot.ts';

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

/** 区画の中の点 to へ、区画の道探し（bot.ts の pathInCell）で歩く。道は目標が変わるか 4 秒ごとに引き直す */
let route: { key: string; pts: V2[]; at: number } | null = null;
function goVia(sim: Sim, cell: CellLayout, to: V2, o: Partial<InputCommand> = {}): InputCommand {
  const pl = sim.players[0]!;
  const key = `${cell.id}|${to[0].toFixed(2)},${to[1].toFixed(2)}`;
  if (!route || route.key !== key || sim.tick - route.at > 240) {
    const pts = pathInCell(sim, cell, [pl.pos[0], pl.pos[1], pl.pos[2]], [to[0], cell.floorY, to[1]]) ?? [];
    route = { key, pts: [...pts.map((q) => [q[0], q[1]] as V2), to], at: sim.tick };
  }
  while (route.pts.length > 1 && Math.hypot(route.pts[0]![0] - pl.pos[0], route.pts[0]![1] - pl.pos[2]) < 0.3) route.pts.shift();
  return toward(sim, route.pts[0]!, o);
}

/** 点 c（高さ cy）を見て調べる（0.6 秒に 1 回。押した直後の状態の変わりを待つ） */
function poke(sim: Sim, c: V2, cy: number): InputCommand {
  const pl = sim.players[0]!;
  const ex = c[0] - pl.pos[0], ez = c[1] - pl.pos[2], ey = cy - (pl.pos[1] + pl.eye);
  const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
  return still(sim, { yaw, pitch, ...(sim.tick % 36 === 0 ? { interact: { yaw, pitch } } : {}) });
}

/** 区間の目標 leg が扉 door の前か（その扉へ向かうときだけ手を出す） */
function headingTo(sim: Sim, door: unknown, leg: V2, r = 2.4): boolean {
  const d = sim.floor.entities.find((x) => x.id === door);
  const pn = d?.params.panel as { min: number[]; max: number[] } | undefined;
  return !!pn && Math.hypot((pn.min[0]! + pn.max[0]!) / 2 - leg[0], (pn.min[2]! + pn.max[2]!) / 2 - leg[1]) < r;
}

/** 鏡で光を導く: 出口の扉へ向かうとき、解と違う向きの鏡へ歩いて回す（解は部品の params.solution） */
function beam(sim: Sim, e: EntitySpec, leg: V2, cell: CellLayout): InputCommand | null {
  if (sim.outputOf(e.id, 'lit') > 0.5 || sim.outputOf(e.id.replace(/\.beam$/, '.solved'), 'out') > 0.5) return null;
  if (!headingTo(sim, e.params.door, leg)) return null;
  const ids = e.params.mirrorIds as string[], sol = e.params.solution as number[], ms = e.params.mirrors as number[][];
  const i = ids.findIndex((id, k) => (sim.outputOf(id, 'state') > 0.5 ? 1 : 0) !== sol[k]);
  if (i < 0) return null;
  const m: V2 = [ms[i]![0]!, ms[i]![1]!];
  const pl = sim.players[0]!;
  const dx = pl.pos[0] - m[0], dz = pl.pos[2] - m[1];
  const d = Math.hypot(dx, dz);
  if (d > 1.5) return goVia(sim, cell, [m[0] + (dx / Math.max(d, 1e-6)) * 1.1, m[1] + (dz / Math.max(d, 1e-6)) * 1.1]);
  return poke(sim, m, Number(e.params.y ?? 1));
}

/**
 * 非常電源・巻き戻る部屋: 出口の扉へ向かうとき、レバーが戻っていればレバーへ歩いて引く（入っていれば手を出さない。走るのは senseAdjust）
 */
function lever(sim: Sim, e: EntitySpec, leg: V2, cell: CellLayout): InputCommand | null {
  if (!(e.params.power || e.params.rewind) || sim.outputOf(e.id, 'on') > 0.5) return null;
  if (sim.outputOf(String(e.params.door), 'open') > 0.5 || !headingTo(sim, e.params.door, leg)) return null;
  const p = e.params.pos as number[];
  const pl = sim.players[0]!;
  const d = Math.hypot(pl.pos[0] - p[0]!, pl.pos[2] - p[2]!);
  if (d > 1.3) {
    const dir = Number(e.params.dir);
    const n: V2 = ([[0, -1], [-1, 0], [0, 1], [1, 0]] as const)[dir] as V2;
    return goVia(sim, cell, [p[0]! + n[0] * 0.9, p[2]! + n[1] * 0.9]);
  }
  return poke(sim, [p[0]!, p[2]!], p[1]!);
}

/** ボタンで開く扉（段階 3 の switchDoor: 扉の open ← latch ← ボタンの pressed）。ボタン id → 扉 id */
const BUTTON_DOORS = new WeakMap<FloorLayout, Map<string, string>>();
function buttonDoors(floor: FloorLayout): Map<string, string> {
  let m = BUTTON_DOORS.get(floor);
  if (m) return m;
  m = new Map();
  const byId = new Map(floor.entities.map((e) => [e.id, e]));
  for (const d of floor.entities) {
    if (d.type !== 'door' || typeof d.inputs?.open !== 'string') continue;
    const src = byId.get(d.inputs.open.slice(0, d.inputs.open.lastIndexOf('.')));
    const set = src?.type === 'latch' ? src.inputs?.set : undefined;
    if (typeof set === 'string' && set.endsWith('.pressed')) m.set(set.slice(0, -'.pressed'.length), d.id);
  }
  BUTTON_DOORS.set(floor, m);
  return m;
}

/** ボタンで開く扉へ向かうとき、扉が閉じていればボタンへ歩いて押す（担当の外の仕掛けだが、歩く人の道を塞ぐので手助けする） */
function button(sim: Sim, e: EntitySpec, leg: V2, cell: CellLayout): InputCommand | null {
  const door = buttonDoors(sim.floor).get(e.id);
  if (!door || sim.outputOf(door, 'open') > 0.5 || !headingTo(sim, door, leg)) return null;
  const b = e.params.box as { min: number[]; max: number[] };
  const c: V2 = [(b.min[0]! + b.max[0]!) / 2, (b.min[2]! + b.max[2]!) / 2];
  const cy = (b.min[1]! + b.max[1]!) / 2;
  const bb = cell.bounds;
  const thinX = b.max[0]! - b.min[0]! < b.max[2]! - b.min[2]!;
  const n: V2 = thinX ? [Math.sign((bb.min[0] + bb.max[0]) / 2 - c[0]), 0] : [0, Math.sign((bb.min[2] + bb.max[2]) / 2 - c[1])];
  const pl = sim.players[0]!;
  if (Math.hypot(pl.pos[0] - c[0], pl.pos[2] - c[1]) > 1.3) return goVia(sim, cell, [c[0] + n[0] * 0.9, c[1] + n[1] * 0.9]);
  return poke(sim, c, cy);
}

/**
 * 増水: 向こう岸へ渡るとき、渡る列の手前の端で水が満ちるのを待ち、満ちている残りの間に渡りきれるなら浮いた木箱の上を渡る。
 * 落ちたら（穴の底・水の中）階段から手前の端へ戻る
 */
function flood(sim: Sim, e: EntitySpec, leg3: readonly number[], cell: CellLayout): InputCommand | null {
  const pl = sim.players[0]!;
  const y = Number(e.params.y);
  const cross = e.params.cross as number[][];
  const a: V2 = [cross[0]![0]!, cross[0]![1]!], b: V2 = [cross[1]![0]!, cross[1]![1]!];
  const leg: V2 = [leg3[0]!, leg3[2]!];
  const fwd = Math.hypot(b[0] - leg[0], b[1] - leg[1]) <= Math.hypot(a[0] - leg[0], a[1] - leg[1]);
  const near = fwd ? a : b, far = fwd ? b : a;
  const me: V2 = [pl.pos[0], pl.pos[2]];
  const ln = onLine(me, near, far), lt = onLine(leg, near, far);
  if (leg3[1]! < y - 0.5) return null;
  // 区間の目標が向こう岸（列の向こうの端より先）か、列の途中の横（浮く箱の前の壁の口）のとき
  const across = lt.t >= 0.9;
  if (!across && (lt.t < 0.1 || lt.off > 2.6)) return null;
  const stop = across ? 1 : lt.t;
  const P: V2 = lerp(near, far, stop);
  if (pl.pos[1] < y - 0.4) return goVia(sim, cell, near);
  if (ln.t > 1.0) return null;
  const r = floodLevel(sim.tick * sim.dt, floodParams({ spec: e }));
  if (ln.t < 0.15) {
    const d = Math.hypot(me[0] - near[0], me[1] - near[1]);
    if (d < 0.9 && r.stage === 'high' && r.left > (ln.len * stop) / 3.0 + (across ? 0.8 : 2.0)) return toward(sim, across ? far : P);
    return d > 0.35 ? goVia(sim, cell, near) : still(sim);
  }
  if (across) return toward(sim, far);
  // 列の途中で横へ（浮く箱に乗り、壁の口へ）。口の扉の前まで来たら、扉を開けるのは bot.ts に任せる
  if (Math.hypot(leg[0] - me[0], leg[1] - me[1]) < 1.0) return null;
  return ln.t < stop - 0.04 && ln.off < 0.6 ? toward(sim, P) : toward(sim, leg);
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
    if (onK.t * onK.len > 0.15 && onK.off < 0.4) return toward(sim, oriented[k]!.b, { dash: true });
    const need = Math.hypot(first.b[0] - first.a[0], first.b[1] - first.a[1]) / 4.8 + 0.4;
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
    return bandPhase(t, on, off, phases[best] ?? 0) > need ? toward(sim, l.b, { dash: true }) : still(sim);
  }
  // beam / seen: 渡る道に乗り、道に沿って 0.8 m 先を目指し、前（少し下）を見て渡る
  if (mp.d < 0.05 && mp.off > 0.25) return toward(sim, first.a);
  return toward(sim, lineAt(first.pts, Math.min(first.len, mp.d + 0.8)) as V2, { pitch });
}

const dist2 = (a: V2, b: readonly number[]): number => Math.hypot(a[0] - b[0]!, a[1] - b[1]!);

/**
 * 消える照明（darkHazard kind 'blink'）: 照明が消える前に、消えない灯りの島へ入って待つ。点いている間に次の島（目標に近い方）まで進む
 */
function darkBlink(sim: Sim, e: EntitySpec, leg: V2): InputCommand | null {
  const pl = sim.players[0]!;
  const me: V2 = [pl.pos[0], pl.pos[2]];
  const c = e.params.clock as { on: number; off: number; phase: number; flicker: number };
  const t = (sim.tick + 1) * sim.dt;
  const r = patternAt(t, c.on, c.off, c.phase, c.flicker);
  const isles = ((e.params.pools as number[][]).slice(1)).filter((q) => q.length === 3);
  const inIsle = isles.some((q) => dist2(me, q) < q[2]! - 0.35);
  const ahead = isles.filter((q) => dist2(leg, q) < dist2(leg, me) - 0.5).sort((p, q) => dist2(me, p) - dist2(me, q))[0];
  const need = (ahead ? dist2(me, ahead) : dist2(me, leg)) / 2.8 + 0.6;
  const safeLeft = r.left > 0 ? r.left - c.flicker : 0;
  if (safeLeft > need) return null;
  if (inIsle) return still(sim);
  // いちばん近い島へ走る
  const best = isles.slice().sort((p, q) => dist2(me, p) - dist2(me, q))[0];
  return best ? toward(sim, [best[0]!, best[1]!], { dash: true }) : null;
}

/** 明滅の位相（darkHazard kind 'wave'）: 光の帯が来るまで入口の灯りで待ち、帯の真ん中について歩く */
function darkWave(sim: Sim, e: EntitySpec, leg: V2): InputCommand | null {
  const pl = sim.players[0]!;
  const me: V2 = [pl.pos[0], pl.pos[2]];
  const w = e.params.wave as { start: number[]; axis: 'x' | 'z'; sign: number; len: number; speed: number; window: number; period: number; phase: number };
  const route = (e.params.route as number[][]).map((q) => [q[0]!, q[1]!] as V2);
  // 区間の目標が道の向こう（出口の側）でなければ手を出さない
  const k = w.axis === 'x' ? 0 : 1;
  const u = (p: readonly number[]): number => (p[k]! - w.start[k]!) * w.sign;
  const endU = Math.max(u(route[0]!), u(route[1]!));
  if (u(leg) < u(me) + 0.3 || u(me) > endU - 0.15) return null;
  const t = (sim.tick + 1) * sim.dt;
  const tau = (((t + w.phase) % w.period) + w.period) % w.period;
  const front = tau * w.speed, back = front - w.window;
  const at = (uu: number): V2 => { const p: V2 = [...route[0]!] as V2; p[k] = w.start[k]! + w.sign * uu; return p; };
  // 帯が来ていない（前が自分より後ろ）・帯がもう先にある（自分は帯の後ろの暗い所にいない = 灯りの中で次の波を待つ）→ 今の所で待つ
  if (front < u(me) + 0.2 || back > u(me) - 0.2) return still(sim);
  return toward(sim, at(Math.min(endU, Math.max(back + 1.0, Math.min(front - 0.8, (front + back) / 2)))));
}

/** サーチライト: 渡る道に沿って、帯の手前で光の円が遠ざかるのを待ち、走って渡る */
function search(sim: Sim, e: EntitySpec, leg: V2): InputCommand | null {
  const pl = sim.players[0]!;
  const me: V2 = [pl.pos[0], pl.pos[2]];
  const cross = (e.params.cross as number[][]).map((q) => [q[0]!, q[1]!] as V2);
  const fwd = dist2(leg, cross[1]!) <= dist2(leg, cross[0]!);
  const [a, b] = fwd ? [cross[0]!, cross[1]!] : [cross[1]!, cross[0]!];
  const mp = onLine(me, a, b), lp = onLine(leg, a, b);
  if (lp.t < 0.5 || mp.t * mp.len > mp.len - 0.3) return null;
  const lanes = e.params.lanes as number[][];
  const rects = e.params.laneRects as number[][];
  const R = Number(e.params.radius ?? 0.9);
  const t = (sim.tick + 1) * sim.dt;
  const dirv: V2 = [(b[0] - a[0]) / mp.len, (b[1] - a[1]) / mp.len];
  // 帯ごとの、道の上での範囲（体の幅 + 余裕を足す）
  const spans = rects.map((r, i) => {
    const ts = [[r[0]!, r[1]!], [r[2]!, r[3]!]].map((q) => ((q[0]! - a[0]) * dirv[0] + (q[1]! - a[1]) * dirv[1]));
    return { i, d0: Math.min(ts[0]!, ts[1]!) - 0.55, d1: Math.max(ts[0]!, ts[1]!) + 0.55 };
  }).sort((p, q) => p.d0 - q.d0);
  const d = mp.t * mp.len;
  // 今の所と区間の目標の間に帯が無ければ（同じ側の隅の扉など）手を出さない
  const dl = lp.t * lp.len;
  if (!spans.some((s) => Math.min(d, dl) < s.d1 && Math.max(d, dl) > s.d0)) return null;
  const inside = spans.find((s) => d > s.d0 && d < s.d1);
  if (inside) return toward(sim, [a[0] + dirv[0] * (inside.d1 + 0.2), a[1] + dirv[1] * (inside.d1 + 0.2)], { dash: true });
  // 渡る道から外れている（隅へ戻された）: 今の安全な床の上で、道へ戻る
  if (mp.off > 0.4) return toward(sim, [a[0] + dirv[0] * d, a[1] + dirv[1] * d]);
  const next = spans.find((s) => s.d0 >= d);
  if (!next) return toward(sim, b);
  if (next.d0 - d > 0.35) return toward(sim, [a[0] + dirv[0] * (next.d0 - 0.15), a[1] + dirv[1] * (next.d0 - 0.15)]);
  // 帯の手前: 走って渡る間の自分の位置（道に沿って毎秒 5 m）と光の円が、ずっと離れているなら渡る（人と同じく、光が向こうへ行く時を見て渡る。
  // 帯が短い部屋では、帯の真ん中との距離で待つと渡る隙が無い）
  const T = (next.d1 - d) / 5.0 + 0.3;
  for (let s = 0; s <= T; s += 0.05) {
    const sp = searchSpot(lanes[next.i]!, t + s);
    const k = Math.min(next.d1, d + s * 5.0);
    const at: V2 = [a[0] + dirv[0] * k, a[1] + dirv[1] * k];
    // 光の円の縁から体の半分（0.35）と少しの余裕
    if (dist2(at, sp) < R + 0.5) return still(sim);
  }
  return toward(sim, b, { dash: true });
}

/** だるまさん: 歌が終わる少し前から、鬼が前を向き直すまで止まる */
function daruma(sim: Sim, e: EntitySpec): InputCommand | null {
  const st = sim.stateOf(e.id) as { phase: number; t: number; dur: number } | null;
  if (!st) return null;
  return st.phase !== 0 || st.dur - st.t < 0.55 ? still(sim) : null;
}

/**
 * 見ていない間だけ進む時計: 出口の扉の鍵が掛かっている間、時計から目をそらして待ち（針が進む）、12 時の少し前で時計を見つめて止め、
 * 鍵が開いたら（ふつうの歩き方で）扉へ。出口の扉へ向かうときだけ
 */
function watchClock(sim: Sim, e: EntitySpec, leg: V2): InputCommand | null {
  const unlock = String(e.params.unlock);
  if (sim.outputOf(unlock, 'out') > 0.5) return null;
  const door = sim.floor.entities.find((x) => x.id === e.params.door);
  const pn = door?.params.panel as { min: number[]; max: number[] } | undefined;
  if (!pn || Math.hypot((pn.min[0]! + pn.max[0]!) / 2 - leg[0], (pn.min[2]! + pn.max[2]!) / 2 - leg[1]) > 2.2) return null;
  const st = sim.stateOf(e.id) as { hand: number } | null;
  if (!st) return null;
  const pl = sim.players[0]!;
  // 部屋の中に入ってから（時計は部屋の中の人の目にだけ止まる）
  const rg = e.params.region as { min: number[]; max: number[] };
  if (pl.pos[0] < rg.min[0]! + 0.3 || pl.pos[0] > rg.max[0]! - 0.3 || pl.pos[2] < rg.min[2]! + 0.3 || pl.pos[2] > rg.max[2]! - 0.3) return null;
  const c = e.params.pos as number[];
  const ex = c[0]! - pl.pos[0], ey = c[1]! - (pl.pos[1] + pl.eye), ez = c[2]! - pl.pos[2];
  const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
  const w = Number(e.params.window ?? 0.3);
  // 12 時の少し前〜少し後なら見つめる（見ると止まり、鍵が開く）。それ以外は真下を見て待つ
  if (st.hand > 12 - w * 0.6 || st.hand < w * 0.3) return still(sim, { yaw, pitch });
  return still(sim, { yaw: yaw + Math.PI, pitch: -1.35 });
}

/** 音で開く扉: 扉の前（区画 zone）で、loud なら跳んで着地の音を立て、quiet なら止まって静かにする。開くまで */
function noiseGate(sim: Sim, e: EntitySpec): InputCommand | null {
  if (sim.outputOf(e.id, 'open') > 0.5) return null;
  const z = e.params.zone as { min: number[]; max: number[] };
  const pl = sim.players[0]!;
  if (pl.pos[0] < z.min[0]! || pl.pos[0] > z.max[0]! || pl.pos[2] < z.min[2]! || pl.pos[2] > z.max[2]!) return null;
  if (e.params.mode === 'quiet') return still(sim);
  return still(sim, { jump: pl.onGround && sim.tick % 40 === 0 });
}

export function senseDrive(sim: Sim, leg: readonly number[]): InputCommand | null {
  const pl = sim.players[0]!;
  const cell = cellOf(sim.floor, pl.pos);
  if (!cell) return null;
  const leg2: V2 = [leg[0]!, leg[2]!];
  for (const e of partsIn(sim.floor, cell.id, 'lightFloor')) {
    const c = lightFloor(sim, e, leg);
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'darkHazard')) {
    const c = e.params.kind === 'wave' ? darkWave(sim, e, leg2) : e.params.kind === 'blink' ? darkBlink(sim, e, leg2) : null;
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'flood')) {
    const c = flood(sim, e, leg, cell);
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'searchlight')) {
    const c = search(sim, e, leg2);
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'daruma')) {
    const c = daruma(sim, e);
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'watchClock')) {
    const c = watchClock(sim, e, leg2);
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'noiseGate')) {
    const c = noiseGate(sim, e);
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'beam')) {
    const c = beam(sim, e, leg2, cell);
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'lever')) {
    const c = lever(sim, e, leg2, cell);
    if (c) return c;
  }
  for (const e of partsIn(sim.floor, cell.id, 'button')) {
    const c = button(sim, e, leg2, cell);
    if (c) return c;
  }
  return null;
}

export function senseAdjust(sim: Sim, cmd: InputCommand): void {
  // 懐中電灯は点けたまま（遊び始めは点いている）
  cmd.flashlight = senseBotOptions.flashlight;
  const cell = cellOf(sim.floor, sim.players[0]!.pos);
  if (!cell) return;
  // 非常電源・巻き戻る部屋のレバーが入っている間・閉店の照明が消えていく間は走る
  if (partsIn(sim.floor, cell.id, 'lever').some((e) => (e.params.power || e.params.rewind) && sim.outputOf(e.id, 'on') > 0.5)) cmd.dash = true;
  if (partsIn(sim.floor, cell.id, 'closing').some((e) => sim.outputOf(e.id, 'on') > 0.5)) cmd.dash = true;
}
