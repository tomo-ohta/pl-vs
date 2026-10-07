import type { WallHole } from '../kit.ts';
import { HALL, ROOMS, type DoorDef, type HallId, type Rect } from './layout.ts';

/**
 * ホールの外周の壁（厚さ 1 m）と、部屋の扉がホールの壁にあるときの開口。
 * 壁は辺ごと: n = 北（z0 - 1〜z0）、s = 南（z1〜z1 + 1）、w = 西、e = 東。
 */
export type Side = 'n' | 's' | 'w' | 'e';

/** ホールの外周の壁の箱（x0, z0, x1, z1） */
export function hallWallRect(id: HallId, side: Side): Rect {
  const [x0, z0, x1, z1] = HALL[id].rect;
  if (side === 'n') return [x0 - 1, z0 - 1, x1 + 1, z0];
  if (side === 's') return [x0 - 1, z1, x1 + 1, z1 + 1];
  if (side === 'w') return [x0 - 1, z0 - 1, x0, z1 + 1];
  return [x1, z0 - 1, x1 + 1, z1 + 1];
}

/** 扉の開口の高さ */
export function holeHeight(d: DoorDef, floor: number): { bottom: number; top: number } {
  if (d.kind === 'window') return { bottom: floor + 0.9, top: floor + 2.2 };
  if (d.kind === 'open') return { bottom: floor, top: floor + 2.4 };
  if (d.kind === 'auto') return { bottom: floor, top: floor + 2.3 };
  return { bottom: floor, top: floor + 2.1 };
}

export interface WallDoor {
  def: DoorDef;
  floor: number;
  /** 開口の中心（場面の x, z） */
  at: [number, number];
  /** 壁の向き（'x' = z 一定の壁） */
  wall: 'x' | 'z';
  width: number;
}

/** 箱（x0, z0, x1, z1）の中にある部屋の扉（ホールの壁に開ける開口） */
export function doorsInRect(r: Rect): WallDoor[] {
  const out: WallDoor[] = [];
  for (const room of ROOMS) {
    const [rx0, rz0, rx1, rz1] = room.rect;
    for (const d of room.doors) {
      const along = d.side === 'n' || d.side === 's';
      const line = d.side === 'n' ? rz0 : d.side === 's' ? rz1 : d.side === 'w' ? rx0 : rx1;
      const m = (d.a + d.b) / 2;
      const at: [number, number] = along ? [m, line] : [line, m];
      // 部屋の辺の線が箱に接する（箱の面か中）なら、その箱の壁の扉
      const inside = along ? at[0] > r[0] && at[0] < r[2] && line >= r[1] - 0.01 && line <= r[3] + 0.01 : at[1] > r[1] && at[1] < r[3] && line >= r[0] - 0.01 && line <= r[2] + 0.01;
      if (inside) out.push({ def: d, floor: room.floor, at, wall: along ? 'x' : 'z', width: d.b - d.a });
    }
  }
  return out;
}

/** 壁の始点 a から見た開口（wallWithHoles の形） */
export function holesFor(doors: WallDoor[], a: [number, number], wall: 'x' | 'z', extra: WallHole[] = []): WallHole[] {
  const hs: WallHole[] = doors.map((d) => {
    const h = holeHeight(d.def, d.floor);
    const at = wall === 'x' ? Math.abs(d.at[0] - a[0]) : Math.abs(d.at[1] - a[1]);
    return { at, width: d.width, bottom: h.bottom, top: h.top };
  });
  return [...hs, ...extra];
}
