import type * as THREE from 'three';
import type { Kit } from '../../scenes/pool/kit.ts';
import { wallWithHoles, type WallHole } from '../kit.ts';
import type { Doors } from './doors.ts';
import { HALL_DOORS, type HallId, type RoomKind } from './layout.ts';
import { placeDoor, type Finish, type RoomMats } from './rooms.ts';
import { doorsInRect, hallWallRect, holesFor, type Side } from './walls.ts';

/**
 * ホールの外周の壁（厚さ 1 m）を、部屋の扉・ホールどうしの開口を開けて作る。
 * from / to で壁の一部だけ（場面の座標の範囲）、y0 / y1 で高さ。
 */
export interface PerimOpts {
  y0?: number;
  y1: number;
  from?: number;
  to?: number;
  extra?: WallHole[];
  /** 扉を置かない（開口だけ） */
  noDoors?: boolean;
}

export interface HallEnv {
  k: Kit;
  doors: Doors;
  rm: RoomMats;
  /** 部屋の種類ごとの仕上げ（ホールの中の小さな空間を部屋と同じ決まりで作る時に使う） */
  fin: Record<RoomKind, Finish>;
}

export function perimeterWall(env: HallEnv, id: HallId, side: Side, mat: THREE.Material, o: PerimOpts): void {
  const { k, doors, rm } = env;
  const r = hallWallRect(id, side);
  const along = side === 'n' || side === 's';
  const c = along ? (r[1] + r[3]) / 2 : (r[0] + r[2]) / 2;
  const t0 = o.from ?? (along ? r[0] : r[1]);
  const t1 = o.to ?? (along ? r[2] : r[3]);
  const a: [number, number] = along ? [t0, c] : [c, t0];
  const e: [number, number] = along ? [t1, c] : [c, t1];
  const inRange = (t: number): boolean => t > t0 && t < t1;
  const rd = doorsInRect(r).filter((d) => inRange(along ? d.at[0] : d.at[1]));
  const hd = HALL_DOORS.filter((h) => h.wall === (along ? 'x' : 'z') && h.at[0] >= r[0] && h.at[0] <= r[2] && h.at[1] >= r[1] && h.at[1] <= r[3] && inRange(along ? h.at[0] : h.at[1]));
  const holes = holesFor(rd, a, along ? 'x' : 'z', [
    ...hd.map((h) => ({ at: Math.abs((along ? h.at[0] : h.at[1]) - t0), width: h.width, bottom: h.bottom, top: h.top })),
    ...(o.extra ?? []),
  ]);
  wallWithHoles(k.b, mat, a, e, o.y0 ?? -2, o.y1, 1.0, holes);
  // 水の中まで開いた口: 壁の厚さの所も水にする
  for (const h of hd) {
    if (h.bottom >= 0) continue;
    const hw = h.width / 2;
    if (along) k.basin(h.at[0] - hw, r[1], h.at[0] + hw, r[3], h.bottom);
    else k.basin(r[0], h.at[1] - hw, r[2], h.at[1] + hw, h.bottom);
  }
  if (o.noDoors) return;
  for (const d of rd) placeDoor(k.b, rm, doors, d.def, d.floor, [along ? d.at[0] : c, along ? c : d.at[1]], along ? 'x' : 'z', 1.0);
  for (const h of hd) {
    if (h.kind === 'open') continue;
    if (h.halls[0] !== id && h.halls[1] !== id) continue;
    // ホールどうしの扉は片方のホールだけが置く（先に書いたホール）
    if (h.halls[0] !== id) continue;
    const def = { side: (along ? 'n' : 'w') as Side, a: (along ? h.at[0] : h.at[1]) - h.width / 2, b: (along ? h.at[0] : h.at[1]) + h.width / 2, kind: h.kind, glass: true };
    placeDoor(k.b, rm, doors, def, h.bottom, [along ? h.at[0] : c, along ? c : h.at[1]], along ? 'x' : 'z', 1.0, { bottom: h.bottom, top: h.top });
  }
}
