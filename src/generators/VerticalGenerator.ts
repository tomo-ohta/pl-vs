/** 縦動線（VerticalCore）: 2 階層の階段室 + エレベーター。下階・上階それぞれに扉ソケット。 */
import type { Socket } from '../core/types';
import { aabb, aabbFromCenter } from '../core/aabb';
import {
  box, ceiling, DOOR_H, DOOR_W, emptyLayout, floorWithHoles, lightPanel, socket, WALL_T,
  type GenParams, type Opening, type RoomLayout,
} from './layout';

export const FLOOR_HEIGHT = 3.6;

export function generateVertical(p: GenParams): RoomLayout {
  const { rng, palette } = p;
  const L = emptyLayout(palette);
  const w = 6.0; // X
  const d = 8.0; // Z
  const levels = 2;
  const h = FLOOR_HEIGHT * levels;
  const hw = w / 2;
  const hd = d / 2;
  L.bounds = aabb([-hw - WALL_T, -0.2, -hd - WALL_T], [hw + WALL_T, h + 0.2, hd + WALL_T]);
  L.height = h;

  // 入口（下階 -Z 壁）。上階の出口は +Z 壁と側面
  const sockets: Socket[] = [];
  const entryType = p.entry?.type ?? 'door';
  sockets.push(socket('entry', entryType, [-1.0, 0, -hd - WALL_T], 2, p.entry ? Math.max(p.entry.width, DOOR_W) : DOOR_W, DOOR_H));
  const upperY = FLOOR_HEIGHT;
  const exitCandidates: Socket[] = [
    socket('up0', 'door', [-1.0, upperY, -hd - WALL_T], 2),
    socket('up1', 'door', [-1.0, upperY, hd + WALL_T], 0),
    socket('lo1', 'door', [-1.0, 0, hd + WALL_T], 0),
    socket('up2', 'door', [-hw - WALL_T, upperY, -2.5], 3),
  ];
  const chosen = rng.shuffle(exitCandidates).slice(0, Math.max(1, Math.min(p.exits, 3)));
  if (!chosen.some((s) => s.pos[1] > 0)) chosen[0] = exitCandidates[0];
  sockets.push(...chosen);
  // エレベーター（+X 側の籠）: 別の階の部屋へ
  const elevSocket = socket('elev', 'elevator', [hw + WALL_T, 0, 2.5], 1, 1.2, 2.2);
  sockets.push(elevSocket);
  L.sockets = sockets;

  // 床（下階）と天井
  floorWithHoles(L.boxes, -hw - WALL_T, -hd - WALL_T, hw + WALL_T, hd + WALL_T, palette.floor, []);
  ceiling(L.boxes, -hw - WALL_T, -hd - WALL_T, hw + WALL_T, hd + WALL_T, h, palette.ceiling);

  // 上階の床（階段部分は開ける）: 階段は X in [-hw, -hw+2.4], Z 方向に上る。踊り場は Z in [hd-2.4, hd]
  const stairX0 = -hw;
  const stairX1 = -hw + 2.4;
  // 上階床: 階段吹抜け（stairX0..stairX1, -hd+1.2..hd-2.4）以外
  const t = 0.2;
  L.boxes.push(box([stairX1, upperY - t, -hd - WALL_T], [hw + WALL_T, upperY, hd + WALL_T], palette.floor));
  L.boxes.push(box([-hw - WALL_T, upperY - t, -hd - WALL_T], [stairX1, upperY, -hd + 1.2], palette.floor));
  L.boxes.push(box([-hw - WALL_T, upperY - t, hd - 2.4], [stairX1, upperY, hd + WALL_T], palette.floor));

  // 階段: 下階 -Z 側から +Z へ上がる直階段（1 段 0.18 高 / 0.28 奥行 → 20 段で 3.6m）
  const steps = 20;
  const rise = FLOOR_HEIGHT / steps;
  const run = (d - 1.2 - 2.4) / steps;
  for (let i = 0; i < steps; i++) {
    const z0 = -hd + 1.2 + i * run;
    L.boxes.push(box([stairX0, 0, z0], [stairX1, (i + 1) * rise, z0 + run], 'floorConcrete'));
  }
  // 手すり
  L.boxes.push(box([stairX1 - 0.05, 0, -hd + 1.2], [stairX1, 1.0, hd - 2.4], 'metal', false));
  L.boxes.push(box([stairX1 - 0.05, upperY, -hd + 1.2], [stairX1, upperY + 1.0, hd - 2.4], 'metal'));

  // 壁
  const op = (s: Socket, axis: 0 | 2): Opening => ({ at: s.pos[axis], width: s.width, height: s.height });
  const wallSockets = sockets.filter((s) => s.type !== 'elevator');
  const byDir = (dir: number) => wallSockets.filter((s) => s.dir === dir);
  // -Z 壁（下階と上階の開口）
  wallX(L, -hw - WALL_T, hw + WALL_T, -hd, -1, h, palette.wall, byDir(2).map((s) => ({ ...op(s, 0), y: s.pos[1] })));
  wallX(L, -hw - WALL_T, hw + WALL_T, hd, 1, h, palette.wall, byDir(0).map((s) => ({ ...op(s, 0), y: s.pos[1] })));
  wallZ(L, -hd, hd, -hw, -1, h, palette.wall, byDir(3).map((s) => ({ ...op(s, 2), y: s.pos[1] })));
  // +X 壁: エレベーター開口（下階）
  wallZ(L, -hd, hd, hw, 1, h, palette.wall, [{ at: elevSocket.pos[2], width: 1.2, height: 2.2, y: 0 }]);

  // エレベーター籠（壁の外側に突き出す）
  const ex0 = hw + WALL_T;
  const ex1 = hw + WALL_T + 1.8;
  const ez0 = elevSocket.pos[2] - 0.9;
  const ez1 = elevSocket.pos[2] + 0.9;
  L.bounds.max[0] = ex1 + WALL_T;
  L.boxes.push(box([ex0, -0.2, ez0 - WALL_T], [ex1 + WALL_T, 0, ez1 + WALL_T], 'metal'));
  L.boxes.push(box([ex0, 2.3, ez0 - WALL_T], [ex1 + WALL_T, 2.5, ez1 + WALL_T], 'metal'));
  L.boxes.push(box([ex1, 0, ez0 - WALL_T], [ex1 + WALL_T, 2.3, ez1 + WALL_T], 'metal'));
  L.boxes.push(box([ex0, 0, ez0 - WALL_T], [ex1, 2.3, ez0], 'metal'));
  L.boxes.push(box([ex0, 0, ez1], [ex1, 2.3, ez1 + WALL_T], 'metal'));
  L.boxes.push(box([ex1 - 0.02, 1.0, ez1 - 0.5], [ex1, 1.4, ez1 - 0.3], 'lightWarm', false)); // ボタン
  L.boxes.push(box([ex0 + 0.3, 2.26, ez0 + 0.3], [ex1 - 0.3, 2.3, ez1 - 0.3], 'lightPanel', false));
  L.elevators.push({ socketId: 'elev', volume: aabbFromCenter((ex0 + ex1) / 2, 1.1, elevSocket.pos[2], 0.9, 1.1, 0.9), button: [ex1 - 0.03, 1.2, ez1 - 0.4], buttonDir: 3 });

  // 照明
  lightPanel(L.boxes, 0.5, 0, 1.2, 0.6, upperY, 'lightPanel');
  lightPanel(L.boxes, 0.5, 0, 1.2, 0.6, h, 'lightPanel');
  L.lights.push({ pos: [0.5, upperY - 0.4, 0], color: 0xdfe8ff, intensity: 0.8, distance: 9 });
  L.lights.push({ pos: [0.5, h - 0.4, 0], color: 0xdfe8ff, intensity: 0.8, distance: 9 });
  if (p.label) L.labels.push({ pos: [1.0, 2.35, -hd + 0.01], dir: 0, text: p.label.text, sub: p.label.sub, width: 2.0 });
  return L;
}

interface OpeningY extends Opening { y: number }

/** 高さ付き開口（上階の扉）に対応した X 壁 */
function wallX(L: RoomLayout, x0: number, x1: number, zInner: number, outward: 1 | -1, h: number, mat: import('./layout').MatId, openings: OpeningY[]): void {
  const za = outward > 0 ? zInner : zInner - WALL_T;
  const zb = outward > 0 ? zInner + WALL_T : zInner;
  // 開口ごとに「開口の範囲以外」を残す簡易分割: 壁を縦帯で分ける
  const cuts = openings.map((o) => [o.at - o.width / 2, o.at + o.width / 2, o.y, o.y + o.height] as [number, number, number, number]);
  const xs = [x0, ...cuts.flatMap((c) => [c[0], c[1]]), x1].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    if (b - a < 0.01) continue;
    const mid = (a + b) / 2;
    const hits = cuts.filter((c) => mid > c[0] && mid < c[1]);
    if (hits.length === 0) {
      L.boxes.push(box([a, 0, za], [b, h, zb], mat));
    } else {
      const ys = [0, ...hits.flatMap((c) => [c[2], c[3]]), h].sort((p, q) => p - q);
      for (let j = 0; j < ys.length - 1; j++) {
        const ya = ys[j];
        const yb = ys[j + 1];
        if (yb - ya < 0.01) continue;
        const ym = (ya + yb) / 2;
        if (hits.some((c) => ym > c[2] && ym < c[3])) continue;
        L.boxes.push(box([a, ya, za], [b, yb, zb], mat));
      }
    }
  }
}

function wallZ(L: RoomLayout, z0: number, z1: number, xInner: number, outward: 1 | -1, h: number, mat: import('./layout').MatId, openings: OpeningY[]): void {
  const xa = outward > 0 ? xInner : xInner - WALL_T;
  const xb = outward > 0 ? xInner + WALL_T : xInner;
  const cuts = openings.map((o) => [o.at - o.width / 2, o.at + o.width / 2, o.y, o.y + o.height] as [number, number, number, number]);
  const zs = [z0, ...cuts.flatMap((c) => [c[0], c[1]]), z1].sort((a, b) => a - b);
  for (let i = 0; i < zs.length - 1; i++) {
    const a = zs[i];
    const b = zs[i + 1];
    if (b - a < 0.01) continue;
    const mid = (a + b) / 2;
    const hits = cuts.filter((c) => mid > c[0] && mid < c[1]);
    if (hits.length === 0) {
      L.boxes.push(box([xa, 0, a], [xb, h, b], mat));
    } else {
      const ys = [0, ...hits.flatMap((c) => [c[2], c[3]]), h].sort((p, q) => p - q);
      for (let j = 0; j < ys.length - 1; j++) {
        const ya = ys[j];
        const yb = ys[j + 1];
        if (yb - ya < 0.01) continue;
        const ym = (ya + yb) / 2;
        if (hits.some((c) => ym > c[2] && ym < c[3])) continue;
        L.boxes.push(box([xa, ya, a], [xb, yb, b], mat));
      }
    }
  }
}
