/**
 * 試験用の歩く人: 区画の開口をたどって、入口から目的の区画まで実際の移動（Sim）で歩く。
 * 扉が閉まっていれば調べて開ける。階段は移動の段差登りで上る。止まったら（8 秒進めなければ）失敗。
 */
import type { Sim } from '../../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../../core/sim/types.ts';
import type { FloorLayout, PortalSpec } from '../../core/world/layout.ts';

export interface WalkResult { ok: boolean; reason: string; seconds: number; route: string[] }

function route(floor: FloorLayout, from: string, to: string): PortalSpec[] | null {
  const by = new Map<string, PortalSpec[]>();
  for (const p of floor.portals) for (const c of p.cells) by.set(c, [...(by.get(c) ?? []), p]);
  const prev = new Map<string, { cell: string; portal: PortalSpec } | null>([[from, null]]);
  const q = [from];
  for (let h = 0; h < q.length && !prev.has(to); h++) {
    for (const p of by.get(q[h]!) ?? []) {
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

export function walkTo(sim: Sim, targetCell: string, goal?: [number, number, number], maxSec = 240): WalkResult {
  const floor = sim.floor;
  const r = route(floor, floor.spawn.cell, targetCell);
  if (!r) return { ok: false, reason: '道順がありません', seconds: 0, route: [] };
  // 通り道の点: 開口の手前 0.9 m・開口の中心・先 0.9 m（開口の向きに沿って）
  const pts: { x: number; z: number; portal?: PortalSpec }[] = [];
  let cell = floor.spawn.cell;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const [x, , z] = center(p);
    const forward = p.cells[0] === cell ? 1 : -1;
    const d = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.dir]!;
    // 手前・先の点は、前後の開口までの距離の半分より遠くに置かない（短い区画で隣の区画へはみ出さないように）
    const prev = r[i - 1], next = r[i + 1];
    const gap = (q: PortalSpec | undefined): number => { if (!q) return Infinity; const [qx, , qz] = center(q); return Math.hypot(qx - x, qz - z) / 2; };
    const kb = Math.min(0.9, gap(prev)) * forward, ka = Math.min(0.9, gap(next)) * forward;
    pts.push({ x: x - d[0]! * kb, z: z - d[1]! * kb, portal: p });
    pts.push({ x, z });
    pts.push({ x: x + d[0]! * ka, z: z + d[1]! * ka });
    cell = p.cells[0] === cell ? p.cells[1] : p.cells[0];
  }
  if (goal) pts.push({ x: goal[0], z: goal[2] });
  const player = sim.players[0]!;
  let i = 0;
  let stuck = 0;
  let waitDoor = 0;
  let bestD = Infinity;
  const ticks = Math.round(maxSec / sim.dt);
  for (let n = 0; n < ticks; n++) {
    const tgt = pts[i];
    if (!tgt) return { ok: true, reason: '', seconds: n * sim.dt, route: r.map((p) => p.id) };
    const dx = tgt.x - player.pos[0], dz = tgt.z - player.pos[2];
    const dist = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz);
    const cmd: InputCommand = { ...IDLE_COMMAND, yaw, pitch: 0, moveY: dist > 0.25 ? 1 : 0 };
    // 扉: 手前の点に来たら、閉じていれば調べる（扉の板の中心を見る）
    const door = tgt.portal?.doorId;
    // 調べたら開くまで待つ（毎 tick 調べると開け閉めをくり返す）
    if (waitDoor > 0) waitDoor -= sim.dt;
    if (door && dist < 0.6 && sim.outputOf(door, 'open') < 0.5 && waitDoor <= 0) {
      waitDoor = 1.0;
      const [px, py, pz] = center(tgt.portal!);
      const ex = px - player.pos[0], ez = pz - player.pos[2];
      const ey = py + 1.0 - (player.pos[1] + player.eye);
      cmd.yaw = Math.atan2(-ex, -ez);
      cmd.pitch = Math.atan2(ey, Math.hypot(ex, ez));
      cmd.interact = { yaw: cmd.yaw, pitch: cmd.pitch };
      cmd.moveY = 0;
    } else if (door && waitDoor > 0 && sim.outputOf(door, 'open') < 0.5) cmd.moveY = 0;
    sim.step([cmd]);
    if (dist < 0.3 && !(door && sim.outputOf(door, 'open') < 0.5)) { i++; stuck = 0; bestD = Infinity; continue; }
    if (dist < bestD - 0.05 || waitDoor > 0) { bestD = Math.min(bestD, dist); stuck = 0; } else stuck++;
    if (stuck * sim.dt > 8) return { ok: false, reason: `止まった: 点 ${i}/${pts.length}（${tgt.x.toFixed(2)}, ${tgt.z.toFixed(2)}）位置 (${player.pos.map((v) => v.toFixed(2)).join(', ')})${tgt.portal ? ` 開口 ${tgt.portal.id}` : ''}`, seconds: n * sim.dt, route: r.map((p) => p.id) };
  }
  return { ok: false, reason: '時間切れ', seconds: maxSec, route: r.map((p) => p.id) };
}
