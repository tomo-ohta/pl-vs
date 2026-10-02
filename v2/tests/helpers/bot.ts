/**
 * 試験用の歩く人: 区画の開口をたどって、入口から目的の区画まで実際の移動（Sim）で歩く。
 * - 区画の中は、当たり判定から作った格子（0.25 m。足元の高さと、塞がり）で道を探す（穴・段・家具を避ける）
 * - 扉が閉まっていれば調べて開ける。低い天井ではしゃがむ（頭がつかえたら）。止まったら（8 秒進めなければ）失敗
 */
import { surfaceY } from '../../core/sim/player.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../../core/sim/types.ts';
import { inRect } from '../../core/world/footprint.ts';
import type { CellLayout, FloorLayout, PortalSpec } from '../../core/world/layout.ts';

export interface WalkResult { ok: boolean; reason: string; seconds: number; route: string[] }

function route(floor: FloorLayout, from: string, to: string): PortalSpec[] | null {
  const by = new Map<string, PortalSpec[]>();
  for (const p of floor.portals) for (const c of p.cells) by.set(c, [...(by.get(c) ?? []), p]);
  // 一方通行の扉（openSide のある扉）は cells[0] → cells[1] の向きだけ通れる（隠し通路の出口）
  const oneWay = new Set(floor.entities.filter((e) => e.type === 'door' && typeof e.params.openSide === 'number').map((e) => e.id));
  const prev = new Map<string, { cell: string; portal: PortalSpec } | null>([[from, null]]);
  const q = [from];
  for (let h = 0; h < q.length && !prev.has(to); h++) {
    for (const p of by.get(q[h]!) ?? []) {
      if (p.doorId && oneWay.has(p.doorId) && p.cells[1] === q[h]) continue;
      const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
      if (prev.has(o)) continue;
      prev.set(o, { cell: q[h]!, portal: p });
      q.push(o);
    }
  }
  if (!prev.has(to)) return null;
  const out: PortalSpec[] = [];
  for (let c = to; prev.get(c); c = prev.get(c)!.cell) out.unshift(prev.get(c)!.portal);
  return out;
}

const center = (p: PortalSpec): [number, number, number] => [(p.aabb.min[0] + p.aabb.max[0]) / 2, p.aabb.min[1], (p.aabb.min[2] + p.aabb.max[2]) / 2];

/** 道を探す格子の間隔。幅 0.9 m の通り道（座席の列の脇など）でも、体の幅 + 余裕の範囲に格子点が必ず入るように細かく */
const G = 0.125;
/** 道の幅の判定に使う体の半径: プレイヤーの当たり判定（半辺 PLAYER.radius = 0.35 の箱）より少し太く。細いと角すれすれの道を選んで引っかかる */
const R = 0.36;

/** 点 (x, z) の足元の高さ（y0 付近から下へ、当たり判定の箱の上面と面）。無ければ -Infinity */
function groundAt(sim: Sim, x: number, z: number, yTop: number): number {
  let best = -Infinity;
  // 足場は体の真ん中の下（±0.12 m）にある物だけ（細い梁の端を歩く道を選ばない）
  const S = 0.12;
  for (const b of sim.colliders.query(x - S, yTop - 4, z - S, x + S, yTop + 0.4, z + S)) {
    if (b.max[1] > yTop + 0.36) continue; // 上にある物は足場にならない
    if (b.max[1] > best) best = b.max[1];
  }
  for (const s of sim.surfaces) if (inRect(s.rect, x, z)) { const y = surfaceY(s, x, z); if (y <= yTop + 0.36 && y > best) best = y; }
  return best;
}

/** 体（足元 g から高さ h）が箱に当たるか */
function bodyBlocked(sim: Sim, x: number, z: number, g: number, h: number): boolean {
  for (const b of sim.colliders.query(x - R, g + 0.37, z - R, x + R, g + h, z + R)) {
    if (b.min[1] < g + h && b.max[1] > g + 0.37) return true;
  }
  return false;
}

/** 区画の中で from → to の道（格子の幅優先）。見つからなければ null */
export function pathInCell(sim: Sim, cell: CellLayout, from: [number, number, number], to: [number, number, number]): [number, number][] | null {
  const b = cell.bounds;
  const nx = Math.ceil((b.max[0] - b.min[0]) / G) + 1, nz = Math.ceil((b.max[2] - b.min[2]) / G) + 1;
  if (nx * nz > 160000) return null;
  const idx = (i: number, k: number): number => k * nx + i;
  const ground = new Float32Array(nx * nz).fill(NaN);
  // 足場として見る高さの上限: 床から 0.5 m（階段・踊り場のある区画はその上面まで）。壁・天井の上面を足場にしない
  const stairTop = Math.max(-Infinity, ...cell.boxes.filter((x) => x.kind === 'stairStep' || x.kind === 'landing').map((x) => x.max[1]));
  const top = Math.max(cell.floorY + 0.15, Number.isFinite(stairTop) ? stairTop : -Infinity) - 0.36 + 0.5;
  const cellOf = (x: number, z: number): [number, number] => [Math.round((x - b.min[0]) / G), Math.round((z - b.min[2]) / G)];
  const gAt = (i: number, k: number): number => {
    const j = idx(i, k);
    if (Number.isNaN(ground[j]!)) {
      const x = b.min[0] + i * G, z = b.min[2] + k * G;
      const gy = inRect(cell.footprint[0]!, x, z, 0.15) || cell.footprint.some((r) => inRect(r, x, z, 0.15)) ? groundAt(sim, x, z, top) : -Infinity;
      ground[j] = gy === -Infinity || bodyBlocked(sim, x, z, gy, 0.85) ? -1e9 : gy;
    }
    return ground[j]!;
  };
  const [si, sk] = cellOf(from[0], from[2]);
  const [ti, tk] = cellOf(to[0], to[2]);
  const prev = new Int32Array(nx * nz).fill(-1);
  const start = idx(Math.min(nx - 1, Math.max(0, si)), Math.min(nz - 1, Math.max(0, sk)));
  const goal = idx(Math.min(nx - 1, Math.max(0, ti)), Math.min(nz - 1, Math.max(0, tk)));
  prev[start] = start;
  const q = [start];
  for (let h = 0; h < q.length && prev[goal] < 0; h++) {
    const c = q[h]!;
    const ci = c % nx, ck = Math.floor(c / nx);
    const gc = c === start ? from[1] : gAt(ci, ck);
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const i = ci + di, k = ck + dk;
      if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
      const j = idx(i, k);
      if (prev[j] >= 0) continue;
      const gn = j === goal ? Math.max(gAt(i, k), to[1] - 0.05) : gAt(i, k);
      if (gn < -1e8 || gn - gc > 0.36) continue;
      prev[j] = c;
      q.push(j);
    }
  }
  if (prev[goal] < 0) return null;
  const pts: [number, number][] = [];
  for (let c = goal; c !== start; c = prev[c]!) pts.unshift([b.min[0] + (c % nx) * G, b.min[2] + Math.floor(c / nx) * G]);
  // 間引き: 向きが変わる所だけ
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i - 1], p = pts[i]!, n = pts[i + 1];
    if (!a || !n || Math.sign(p[0] - a[0]) !== Math.sign(n[0] - p[0]) || Math.sign(p[1] - a[1]) !== Math.sign(n[1] - p[1])) out.push(p);
  }
  return out;
}

export function cellAtPos(floor: FloorLayout, p: [number, number, number]): CellLayout | null {
  let best: CellLayout | null = null;
  for (const c of floor.cells) {
    const b = c.bounds;
    if (p[0] < b.min[0] || p[0] > b.max[0] || p[2] < b.min[2] || p[2] > b.max[2] || p[1] < b.min[1] - 3 || p[1] > b.max[1]) continue;
    if (!best || (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) < (best.bounds.max[0] - best.bounds.min[0]) * (best.bounds.max[2] - best.bounds.min[2])) best = c;
  }
  return best;
}

export function walkTo(sim: Sim, targetCell: string, goal?: [number, number, number], maxSec = 300): WalkResult {
  const floor = sim.floor;
  // 今いる区画から（初めは出てくる区画）
  const from = cellAtPos(floor, sim.players[0]!.pos)?.id ?? floor.spawn.cell;
  const r = route(floor, from, targetCell);
  if (!r) return { ok: false, reason: '道順がありません', seconds: 0, route: [] };
  // 区間の目標: 開口の手前（扉なら調べる）→ 開口の先
  const legs: { x: number; y: number; z: number; portal?: PortalSpec; via?: boolean }[] = [];
  let cell = from;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const [x, y, z] = center(p);
    const forward = p.cells[0] === cell ? 1 : -1;
    const d = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.dir]!;
    const prev = r[i - 1], next = r[i + 1];
    const gap = (q: PortalSpec | undefined): number => { if (!q) return Infinity; const [qx, , qz] = center(q); return Math.hypot(qx - x, qz - z) / 2; };
    const kb = Math.min(0.9, gap(prev)) * forward, ka = Math.min(0.9, gap(next)) * forward;
    legs.push({ x: x - d[0]! * kb, y, z: z - d[1]! * kb, portal: p });
    legs.push({ x: x + d[0]! * ka, y, z: z + d[1]! * ka, via: true });
    cell = p.cells[0] === cell ? p.cells[1] : p.cells[0];
  }
  if (goal) legs.push({ x: goal[0], y: goal[1], z: goal[2] });
  const player = sim.players[0]!;
  let leg = 0;
  let path: [number, number][] = [];
  let stuck = 0, bestD = Infinity, waitDoor = 0, crouch = 0;
  const ticks = Math.round(maxSec / sim.dt);
  for (let n = 0; n < ticks; n++) {
    const L = legs[leg];
    if (!L) return { ok: true, reason: '', seconds: n * sim.dt, route: r.map((p) => p.id) };
    // 区画の中の道を引き直す（区間の始まり・止まったとき）
    if (!path.length) {
      const c = cellAtPos(floor, player.pos);
      path = (c && !L.via ? pathInCell(sim, c, player.pos, [L.x, L.y, L.z]) : null) ?? [];
      path.push([L.x, L.z]);
    }
    const tgt = path[0]!;
    const dx = tgt[0] - player.pos[0], dz = tgt[1] - player.pos[2];
    const dist = Math.hypot(dx, dz);
    const legD = Math.hypot(L.x - player.pos[0], L.z - player.pos[2]);
    const cmd: InputCommand = { ...IDLE_COMMAND, yaw: Math.atan2(-dx, -dz), pitch: 0, moveY: dist > 0.15 ? 1 : 0, crouch: crouch > 0 };
    if (waitDoor > 0) waitDoor -= sim.dt;
    if (crouch > 0) crouch -= sim.dt;
    // 同じ区画のマネキンからは目を離さない: マネキンの方を向いたまま、目標へ横歩きする（実際の遊び手と同じ）
    for (const e of floor.entities) {
      if (e.type !== 'mannequin') continue;
      const mp = sim.stateOf(e.id)?.pos as number[] | undefined;
      if (!mp || Math.hypot(mp[0]! - player.pos[0], mp[2]! - player.pos[2]) > 12) continue;
      const yaw = Math.atan2(-(mp[0]! - player.pos[0]), -(mp[2]! - player.pos[2]));
      const f = [-Math.sin(yaw), -Math.cos(yaw)], rr = [Math.cos(yaw), -Math.sin(yaw)];
      const dl = Math.max(1e-6, dist);
      const d = [dx / dl, dz / dl];
      cmd.yaw = yaw;
      cmd.pitch = -0.05;
      cmd.moveY = dist > 0.15 ? d[0]! * f[0]! + d[1]! * f[1]! : 0;
      cmd.moveX = dist > 0.15 ? d[0]! * rr[0]! + d[1]! * rr[1]! : 0;
    }
    const door = L.portal?.doorId;
    if (door && legD < 0.7 && sim.outputOf(door, 'open') < 0.5 && waitDoor <= 0) {
      waitDoor = 1.0;
      const [px, py, pz] = center(L.portal!);
      const ex = px - player.pos[0], ez = pz - player.pos[2], ey = py + 1.0 - (player.pos[1] + player.eye);
      cmd.yaw = Math.atan2(-ex, -ez);
      cmd.pitch = Math.atan2(ey, Math.hypot(ex, ez));
      cmd.interact = { yaw: cmd.yaw, pitch: cmd.pitch };
      cmd.moveY = 0;
    } else if (door && waitDoor > 0 && sim.outputOf(door, 'open') < 0.5) cmd.moveY = 0;
    sim.step([cmd]);
    if (dist < 0.3) {
      path.shift();
      if (!path.length && !(door && sim.outputOf(door, 'open') < 0.5)) { leg++; stuck = 0; bestD = Infinity; }
      continue;
    }
    if (legD < bestD - 0.05 || waitDoor > 0) { bestD = Math.min(bestD, legD); stuck = 0; } else stuck++;
    // 進めないとき: しゃがんでみる・跳んでみる → 道を引き直す
    if (stuck * sim.dt > 1.0 && crouch <= 0) { crouch = 3; path = []; }
    if (Math.round(stuck * sim.dt * 60) % 90 === 89) { sim.step([{ ...cmd, jump: true, crouch: false }]); }
    if (stuck * sim.dt > 10) return { ok: false, reason: `止まった: 区間 ${leg}/${legs.length}（${L.x.toFixed(2)}, ${L.z.toFixed(2)}）位置 (${player.pos.map((v) => v.toFixed(2)).join(', ')})${L.portal ? ` 開口 ${L.portal.id}` : ''}`, seconds: n * sim.dt, route: r.map((p) => p.id) };
  }
  return { ok: false, reason: '時間切れ', seconds: maxSec, route: r.map((p) => p.id) };
}
