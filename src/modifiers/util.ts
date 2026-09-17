/** mods/ から使う小さなヘルパ。index.ts との循環 import を避けるため別ファイルにしている */
import type { Vec3 } from '../core/types';
import type { AABB } from '../core/aabb';
import type { Box, RoomLayout } from '../generators/layout';

/** '#rrggbb' / '#rgb' / 'rgb(r,g,b)' / 数値 を 0xRRGGBB に。失敗時は fallback */
export function parseColor(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xffffff;
  if (typeof v === 'string') {
    const s = v.trim();
    const m6 = /^#?([0-9a-f]{6})$/i.exec(s);
    if (m6) return parseInt(m6[1], 16);
    const m3 = /^#?([0-9a-f]{3})$/i.exec(s);
    if (m3) return parseInt(m3[1].split('').map((c) => c + c).join(''), 16);
    const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(s);
    if (rgb) return ((+rgb[1] & 255) << 16) | ((+rgb[2] & 255) << 8) | (+rgb[3] & 255);
  }
  return fallback;
}

export function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

export function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function vec3(v: unknown, fallback: Vec3): Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number') ? [v[0], v[1], v[2]] : fallback;
}

/** レイアウトの内装（シェル以降）の箱。shellCount が無ければ全箱 */
export function interiorBoxes(L: RoomLayout): Box[] {
  return L.boxes.slice(L.shellCount ?? 0);
}

/** 箱の中心と寸法 */
export function boxCenter(b: Box | AABB): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

export function boxSize(b: Box | AABB): Vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

/** 部屋の進行軸（path が無ければ entry → 最初の出口） */
export function progressAxis(L: RoomLayout): { from: Vec3; to: Vec3 } | null {
  if (L.path && L.path.length >= 2) return { from: L.path[0], to: L.path[L.path.length - 1] };
  const entry = L.sockets.find((s) => s.id === 'entry');
  const exit = L.sockets.find((s) => s.id !== 'entry' && s.type !== 'hole');
  if (!entry || !exit) return null;
  return { from: entry.pos, to: exit.pos };
}
