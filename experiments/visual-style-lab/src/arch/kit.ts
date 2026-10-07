import type * as THREE from 'three';
import type { Builder, PartOptions } from '../scenes/Builder.ts';
import type { V2 } from './plan.ts';

/**
 * 間取り図から形を作る道具（建築版）。壁に開口（扉・窓・通り抜け）を空ける・床と天井の板・階段・箱の部屋。
 * どれも当たり判定つき（collide）で置く。材質は呼ぶ側が渡す（色彩設計の材質・塗りの材質のどちらでもよい）。
 */

export interface WallHole {
  /** 壁の始点 a からの距離（開口の中心, m） */
  at: number;
  width: number;
  /** 開口の下端・上端（壁の下端からの高さではなく、場面の y） */
  bottom: number;
  top: number;
}

/**
 * a → b の直線の壁（厚さ thick、高さ y0〜y1）に開口を空けて置く。壁は軸に沿っていなくてもよい（斜めは回転した箱）。
 * 開口の下（腰壁）・上（まぐさ）も埋める
 */
export function wallWithHoles(b: Builder, mat: THREE.Material, a: V2, c: V2, y0: number, y1: number, thick: number, holes: WallHole[] = [], o: PartOptions = {}): void {
  const dx = c[0] - a[0];
  const dz = c[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return;
  const ux = dx / len;
  const uz = dz / len;
  const rot = -Math.atan2(dz, dx);
  const axisAligned = Math.abs(ux) < 1e-6 || Math.abs(uz) < 1e-6;
  const seg = (s0: number, s1: number, h0: number, h1: number): void => {
    if (s1 - s0 < 1e-3 || h1 - h0 < 1e-3) return;
    const m = (s0 + s1) / 2;
    const cx = a[0] + ux * m;
    const cz = a[1] + uz * m;
    if (axisAligned) {
      const alongX = Math.abs(ux) > 0.5;
      const sx = alongX ? s1 - s0 : thick;
      const sz = alongX ? thick : s1 - s0;
      b.box(mat, [cx, (h0 + h1) / 2, cz], [sx, h1 - h0, sz], { collide: true, ...o });
    } else {
      b.box(mat, [cx, (h0 + h1) / 2, cz], [s1 - s0, h1 - h0, thick], { collide: true, rotY: rot, ...o });
    }
  };
  // 開口の上下は壁の高さの中に収める（壁より上の開口で背の高すぎる腰壁ができないように）
  const hs = holes.map((h) => ({ ...h, bottom: Math.min(Math.max(h.bottom, y0), y1), top: Math.min(Math.max(h.top, y0), y1) })).sort((p, q) => p.at - q.at);
  let s = 0;
  for (const h of hs) {
    const l = Math.max(0, h.at - h.width / 2);
    const r = Math.min(len, h.at + h.width / 2);
    seg(s, l, y0, y1);
    seg(l, r, y0, Math.max(y0, h.bottom)); // 腰壁
    seg(l, r, Math.min(y1, h.top), y1); // まぐさ
    s = r;
  }
  seg(s, len, y0, y1);
}

/** 長方形の板（床・天井・屋根）。y は上面の高さ */
export function slab(b: Builder, mat: THREE.Material, rect: [number, number, number, number], y: number, thick = 0.2, o: PartOptions = {}): THREE.Mesh {
  const [x0, z0, x1, z1] = rect;
  return b.boxMM(mat, [Math.min(x0, x1), y - thick, Math.min(z0, z1)], [Math.max(x0, x1), y, Math.max(z0, z1)], { collide: true, ...o });
}

/**
 * まっすぐの階段。from（下の段の手前の端の中心, y = 下の床）から dir の向きへ上がる。
 * 1 段の高さは 0.15〜0.18 m（Player の段差 0.36 m 以下なので歩いて上れる）
 */
export function stairs(
  b: Builder,
  mat: THREE.Material,
  from: [number, number, number],
  dir: '+x' | '-x' | '+z' | '-z',
  rise: number,
  width: number,
  o: PartOptions & { tread?: number; riser?: number } = {},
): { top: [number, number, number]; run: number } {
  const n = Math.max(1, Math.round(rise / (o.riser ?? 0.17)));
  const rh = rise / n;
  const tread = o.tread ?? 0.28;
  const sx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0;
  const sz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
  for (let i = 0; i < n; i++) {
    const t0 = i * tread;
    const top = from[1] + rh * (i + 1);
    const cx = from[0] + sx * (t0 + tread / 2);
    const cz = from[2] + sz * (t0 + tread / 2);
    // 段は下まで埋める（横から見て隙間が無い）
    const h = top - from[1];
    const size: [number, number, number] = sx !== 0 ? [tread, h, width] : [width, h, tread];
    b.box(mat, [cx, from[1] + h / 2, cz], size, { collide: true, ...o });
  }
  const run = n * tread;
  return { top: [from[0] + sx * run, from[1] + rise, from[2] + sz * run], run };
}

export interface RoomSide {
  /** 壁を作らない（隣の部屋とつながる・別の物で閉じる） */
  open?: boolean;
  holes?: WallHole[];
  mat?: THREE.Material;
}

/**
 * 箱の部屋: 床・天井・4 面の壁（開口つき）。rect は内側の寸法。壁は外側へ thick だけ出す。
 * sides の n = -z 側、s = +z 側、w = -x 側、e = +x 側。開口の at は各辺の「小さい座標の端」から
 */
export function boxRoom(
  b: Builder,
  mats: { floor: THREE.Material; wall: THREE.Material; ceiling?: THREE.Material },
  rect: [number, number, number, number],
  floorY: number,
  ceilY: number,
  thick: number,
  sides: Partial<Record<'n' | 's' | 'w' | 'e', RoomSide>> = {},
  o: { floor?: boolean; ceiling?: boolean } = {},
): void {
  const [x0, z0, x1, z1] = rect;
  if (o.floor !== false) slab(b, mats.floor, [x0 - thick, z0 - thick, x1 + thick, z1 + thick], floorY, 0.3);
  if (o.ceiling !== false && mats.ceiling) slab(b, mats.ceiling, [x0 - thick, z0 - thick, x1 + thick, z1 + thick], ceilY + 0.3, 0.3, { shadow: false });
  const side = (k: 'n' | 's' | 'w' | 'e', a: V2, c: V2): void => {
    const sd = sides[k] ?? {};
    if (sd.open) return;
    // n / s の壁は角を覆うために thick だけ外から始まるので、開口の位置（内側の端 x0 から）をずらす
    const off = k === 'n' || k === 's' ? thick : 0;
    wallWithHoles(b, sd.mat ?? mats.wall, a, c, floorY, ceilY, thick, (sd.holes ?? []).map((hh) => ({ ...hh, at: hh.at + off })));
  };
  const h = thick / 2;
  side('n', [x0 - thick, z0 - h], [x1 + thick, z0 - h]);
  side('s', [x0 - thick, z1 + h], [x1 + thick, z1 + h]);
  side('w', [x0 - h, z0], [x0 - h, z1]);
  side('e', [x1 + h, z0], [x1 + h, z1]);
}
