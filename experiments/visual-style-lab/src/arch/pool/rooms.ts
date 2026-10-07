import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import { slab, wallWithHoles, type WallHole } from '../kit.ts';
import type { Doors } from './doors.ts';
import type { Mats } from './frame.ts';
import { HALL, HALL_DOORS, HALL_IDS, ROOMS, type DoorDef, type RoomDef } from './layout.ts';
import { hallWallRect, holeHeight, type Side } from './walls.ts';
import { buildRoomArch, clerestories, type ArchMats } from './roomarch.ts';

/**
 * 部屋の殻: 床・天井・間仕切り（隣の部屋と共有する壁は 1 回だけ）・扉。ホールの外周の壁にある扉はホールの側で開ける。
 * 間仕切りは部屋の rect の外側 0.25 m（隣の部屋との隙間がちょうど壁になる）。
 */

export const PART_T = 0.25;

export interface RoomMats {
  wall: THREE.Material;
  floor: THREE.Material;
  ceil: THREE.Material;
  lamp: THREE.Material;
  lampFrame: THREE.Material;
  pane: THREE.Material;
  mullion: THREE.Material;
  arch: ArchMats;
}

export function roomMats(m: Mats): RoomMats {
  // 白いタイルの日なたと、青緑の陰・暗部（参考画像の日陰のタイル #9bb3a4〜#a9c3b4、深い陰 #39666b〜）
  const chips = { scale: 4, density: 0.035, color: '#6f9a92', length: 0.06, width: 0.14 };
  const wall = m.get({ name: 'room-wall', color: '#eef3e8', shade: '#a9c3b4', dark: '#7f9d91', hi: '#f6f8f1', tiles: { size: 0.25, line: 0.012, color: '#cdd8cd', jitter: 0.03 }, flecks: chips });
  const beam = m.get({ name: 'room-beam', color: '#eef3e7', shade: '#4f7d78', dark: '#41706c', hi: '#f6f8f1', tiles: { size: 0.5, line: 0.012, color: '#c6d2c6', jitter: 0.02 }, flecks: chips });
  return {
    wall,
    floor: m.get({ name: 'room-floor', color: '#dfe7dc', shade: '#9fb7aa', dark: '#7f9e94', hi: '#e9efe6', tiles: { size: 0.2, line: 0.01, color: '#a9bcb0', jitter: 0.03 } }),
    ceil: m.get({ name: 'room-ceil', color: '#e8eee5', shade: '#b2c8bd', dark: '#93b2a7', hi: '#eef3ea', tiles: { size: [0.5, 0.5], line: 0.01, color: '#b9c9bf' } }),
    lamp: m.unlit('#f7fbf5', { line: 0.2 }),
    lampFrame: m.flat('#c3cec9', '#a3b4ad'),
    pane: m.get({ color: '#d7ece6', shade: '#b9d4cc', dark: '#a3c2ba', hi: '#e6f4ef', transparent: true, opacity: 0.3, depthWrite: false, line: 0.3 }),
    mullion: m.flat('#c9d4cf', '#a6b6af'),
    arch: (() => {
      // 同じ見え方の物は同じ材質にまとめる（部屋ごとの描画の回数を減らす）
      const pier = m.get({ name: 'room-pier', color: '#eef3e8', shade: '#8aa89c', dark: '#6f9a92', hi: '#f6f8f1', tiles: { size: 0.25, line: 0.012, color: '#cbd6cb', jitter: 0.03 }, flecks: chips });
      const light = m.unlit('#f4f8f2', { noFog: true, line: 0 });
      const bar = m.flat('#9fb3ad', '#7f948e');
      // 天井の板は表の面で影の地図に描く（既定の裏の面だと、板にすぐ下で接する蛇腹・梁の上の縁に日なたの点が並ぶ）
      const ceil = m.get({ name: 'room-coffer', color: '#e8eee5', shade: '#3a6764', dark: '#2f5956', hi: '#eef3ea', tiles: { size: 0.5, line: 0.01, color: '#bccbc1' } });
      ceil.shadowSide = THREE.FrontSide;
      return {
        ceil,
        beam,
        pier,
        plinth: m.get({ name: 'room-plinth', color: '#7fb1a8', shade: '#5f948c', dark: '#4c7f7c', hi: '#8cbcb2', tiles: { size: 0.25, line: 0.01, color: '#6c9f97' } }),
        well: pier,
        frame: pier,
        glass: m.get({ color: '#e6f4ef', unlit: true, transparent: true, opacity: 0.35, depthWrite: false, line: 0 }),
        bar,
        sky: light,
        glow: light,
        body: bar,
        lens: light,
        reveal: m.get({ name: 'room-reveal', color: '#41706c', shade: '#2f5956', dark: '#264b48', hi: '#4f807c', tiles: { size: 0.25, line: 0.01, color: '#2a514e' } }),
      };
    })(),
  };
}

interface Seg {
  axis: 'x' | 'z';
  c: number;
  t0: number;
  t1: number;
  y0: number;
  y1: number;
  doors: { d: DoorDef; floor: number; line: number }[];
  /** 外に面した高窓（roomarch.ts） */
  extra: WallHole[];
}

/** ホールの壁の箱の中か（間仕切りを作らない所） */
function inHallWall(axis: 'x' | 'z', c: number, t: number, y: number): boolean {
  for (const id of HALL_IDS) {
    for (const side of ['n', 's', 'w', 'e'] as Side[]) {
      const r = hallWallRect(id, side);
      const x = axis === 'x' ? t : c;
      const z = axis === 'x' ? c : t;
      if (x > r[0] + 1e-3 && x < r[2] - 1e-3 && z > r[1] + 1e-3 && z < r[3] - 1e-3 && y < HALL[id].ceil + 4) return true;
    }
  }
  return false;
}

/** 部屋の辺の壁の線（中心線）と範囲 */
function sideSeg(r: RoomDef, side: Side): Seg {
  const [x0, z0, x1, z1] = r.rect;
  const h = PART_T / 2;
  const y0 = r.floor - 0.3;
  const y1 = r.ceil + 0.25;
  if (side === 'n') return { axis: 'x', c: z0 - h, t0: x0 - PART_T, t1: x1 + PART_T, y0, y1, doors: [], extra: [] };
  if (side === 's') return { axis: 'x', c: z1 + h, t0: x0 - PART_T, t1: x1 + PART_T, y0, y1, doors: [], extra: [] };
  if (side === 'w') return { axis: 'z', c: x0 - h, t0: z0, t1: z1, y0, y1, doors: [], extra: [] };
  return { axis: 'z', c: x1 + h, t0: z0, t1: z1, y0, y1, doors: [], extra: [] };
}

/** 間仕切りと扉を作る（全部の部屋をまとめて。同じ線の壁は 1 回） */
export function buildPartitions(b: Builder, rm: RoomMats, doors: Doors): void {
  const lines = new Map<string, Seg[]>();
  for (const r of ROOMS) {
    for (const side of ['n', 's', 'w', 'e'] as Side[]) {
      const s = sideSeg(r, side);
      for (const d of r.doors) if (d.side === side) s.doors.push({ d, floor: r.floor, line: side === 'n' ? r.rect[1] : side === 's' ? r.rect[3] : side === 'w' ? r.rect[0] : r.rect[2] });
      if (!r.closed) for (const w of clerestories(r)) if (w.side === side) s.extra.push({ at: (w.a + w.b) / 2, width: w.b - w.a, bottom: w.bottom, top: w.top });
      const key = `${s.axis}:${s.c.toFixed(2)}:${s.y0 > 2 ? 'up' : 'dn'}`;
      const arr = lines.get(key) ?? [];
      arr.push(s);
      lines.set(key, arr);
    }
  }
  for (const segs of lines.values()) {
    const axis = segs[0].axis;
    const c = segs[0].c;
    const y0 = Math.min(...segs.map((s) => s.y0));
    const y1 = Math.max(...segs.map((s) => s.y1));
    // 範囲の和を 0.25 m の升目で作り、ホールの壁の中の所は除く
    const step = 0.125;
    const tMin = Math.min(...segs.map((s) => s.t0));
    const tMax = Math.max(...segs.map((s) => s.t1));
    const on: boolean[] = [];
    for (let t = tMin; t < tMax - 1e-6; t += step) {
      const tc = t + step / 2;
      on.push(segs.some((s) => tc > s.t0 && tc < s.t1) && !inHallWall(axis, c, tc, y0 + 1));
    }
    const ds = segs.flatMap((s) => s.doors);
    let i = 0;
    while (i < on.length) {
      if (!on[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < on.length && on[j]) j++;
      const ta = tMin + i * step;
      const tb = tMin + j * step;
      const a: [number, number] = axis === 'x' ? [ta, c] : [c, ta];
      const e: [number, number] = axis === 'x' ? [tb, c] : [c, tb];
      const holes: WallHole[] = [];
      for (const { d, floor } of ds) {
        if ((d.a + d.b) / 2 < ta || (d.a + d.b) / 2 > tb) continue;
        const hh = holeHeight(d, floor);
        holes.push({ at: (d.a + d.b) / 2 - ta, width: d.b - d.a, bottom: hh.bottom, top: hh.top });
      }
      for (const e of segs.flatMap((sg) => sg.extra)) if (e.at > ta && e.at < tb) holes.push({ ...e, at: e.at - ta });
      wallWithHoles(b, rm.wall, a, e, y0, y1, PART_T, holes);
      i = j;
    }
    // 扉・窓
    const seen = new Set<string>();
    for (const { d, floor } of ds) {
      const key = `${d.a}:${d.b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const m = (d.a + d.b) / 2;
      if (inHallWall(axis, c, m, floor + 1)) continue;
      placeDoor(b, rm, doors, d, floor, axis === 'x' ? [m, c] : [c, m], axis, PART_T);
    }
  }
}

/** 扉・窓を開口に置く（ホールの壁の扉もこれで置く） */
export function placeDoor(b: Builder, rm: RoomMats, doors: Doors, d: DoorDef, floor: number, at: [number, number], wall: 'x' | 'z', thick: number, heights?: { bottom: number; top: number }): void {
  const w = d.b - d.a;
  const hh = heights ?? holeHeight(d, floor);
  if (d.kind === 'open') return;
  if (d.kind === 'window') {
    // はめ殺しの窓（ガラスと枠）
    const along = wall === 'x';
    const sx = along ? w : 0.02;
    const sz = along ? 0.02 : w;
    b.box(rm.pane, [at[0], (hh.bottom + hh.top) / 2, at[1]], [sx, hh.top - hh.bottom, sz], { shadow: false });
    const fr = (cx: number, cy: number, cz: number, ex: number, ey: number, ez: number): void => {
      b.box(rm.mullion, [cx, cy, cz], [ex, ey, ez], { shadow: 'receive' });
    };
    fr(at[0], hh.bottom - 0.03, at[1], along ? w : thick + 0.04, 0.06, along ? thick + 0.04 : w);
    fr(at[0], hh.top + 0.03, at[1], along ? w : thick + 0.04, 0.06, along ? thick + 0.04 : w);
    const n = Math.max(1, Math.round(w / 1.6));
    for (let i = 1; i < n; i++) {
      const t = -w / 2 + (i * w) / n;
      fr(along ? at[0] + t : at[0], (hh.bottom + hh.top) / 2, along ? at[1] : at[1] + t, along ? 0.05 : 0.06, hh.top - hh.bottom, along ? 0.06 : 0.05);
    }
    return;
  }
  doors.add({ at, y: floor, width: w, height: hh.top - hh.bottom - (d.kind === 'auto' ? 0.25 : 0), wall, kind: d.kind === 'auto' ? 'auto' : d.kind === 'locked' ? 'locked' : 'swing', glass: d.glass });
}

/** 部屋の種類ごとの仕上げ（床・腰の帯） */
export interface Finish {
  floor: THREE.Material;
  /** 腰の帯（壁の下の色の帯。高さ h） */
  band?: { mat: THREE.Material; h: number };
}

export function finishes(m: Mats): Record<RoomDef['kind'], Finish> {
  // 陰は 1 段深い青緑（暗部はさらに深く）。日なたの色はそのまま
  const deep = (s: string): string => '#' + new THREE.Color(s).multiplyScalar(0.8).getHexString();
  const tile = (c: string, s: string, size: number, g: string) => m.get({ color: c, shade: s, dark: deep(s), hi: c, tiles: { size, line: Math.max(0.012, size * 0.06), color: g, jitter: 0.03 } });
  const vinyl = (_c: string, s: string) => m.get({ color: '#e4ebe0', shade: s, dark: deep(s), hi: '#eef2ea', tiles: { size: 0.3, line: 0.012, color: '#b9c7bd', jitter: 0.02 } });
  // 腰壁: 深い青緑のタイル（参考画像の暗い青緑の壁 #4c7b84 と同じ系統）。陰で 1 段暗く、日なたで明るい青緑
  const teal = (size: number, h: number) => ({ mat: m.get({ color: '#6a9d95', shade: '#2f5956', dark: '#264b48', hi: '#7aaba2', tiles: { size, line: Math.max(0.012, size * 0.07), color: '#5f8f88', jitter: 0.04 } }), h });
  const wet = teal(0.2, 1.2);
  const skirt = teal(0.25, 0.9);
  return {
    changing: { floor: tile('#e3ede2', '#3f6b67', 0.25, '#a3b6ad'), band: wet },
    shower: { floor: tile('#d3ebe4', '#3f6b67', 0.125, '#9cc0b8'), band: { mat: tile('#a9d2c9', '#5f948c', 0.125, '#93bdb4'), h: 2.0 } },
    toilet: { floor: tile('#e3ede2', '#3f6b67', 0.25, '#a8bbb2'), band: wet },
    guard: { floor: vinyl('#c9d6cf', '#426e6a'), band: skirt },
    office: { floor: vinyl('#ccd5cf', '#426e6a'), band: skirt },
    staff: { floor: vinyl('#d2d8cc', '#45716c'), band: skirt },
    aid: { floor: vinyl('#d7e2dc', '#45716c'), band: skirt },
    lobby: { floor: tile('#eceee2', '#45716c', 0.4, '#c9cabe'), band: teal(0.2, 1.0) },
    corridor: { floor: tile('#e7ebe0', '#426e6a', 0.3, '#c3c8bb'), band: teal(0.2, 1.2) },
    plant: { floor: tile('#d5e0d8', '#426e6a', 0.6, '#b3c3b9'), band: teal(0.25, 1.2) },
    store: { floor: vinyl('#c3cdc6', '#3f6b67'), band: skirt },
    sauna: { floor: tile('#e3ede2', '#3f6b67', 0.25, '#b8c4ba'), band: teal(0.25, 0.5) },
    lounge: { floor: tile('#ebe9dc', '#47736e', 0.4, '#c8c2af'), band: teal(0.2, 0.9) },
  };
}

/** 腰の帯を壁ぞいに貼る（扉・窓の所は空ける。隣の部屋の扉も） */
export function band(b: Builder, r: RoomDef, f: Finish): void {
  if (!f.band) return;
  const [x0, z0, x1, z1] = r.rect;
  const h = f.band.h;
  const y0 = r.floor;
  const T = 0.02;
  const gaps = (side: 'n' | 's' | 'w' | 'e'): [number, number][] => {
    const along = side === 'n' || side === 's';
    const line = side === 'n' ? z0 : side === 's' ? z1 : side === 'w' ? x0 : x1;
    const out: [number, number][] = [];
    for (const o of ROOMS.includes(r) ? ROOMS : [...ROOMS, r]) for (const d of o.doors) {
      if ((d.side === 'n' || d.side === 's') !== along) continue;
      const dl = d.side === 'n' ? o.rect[1] : d.side === 's' ? o.rect[3] : d.side === 'w' ? o.rect[0] : o.rect[2];
      if (Math.abs(dl - line) > 1.05 || Math.abs(o.floor - r.floor) > 1) continue;
      if (d.kind === 'window' && h < 0.9) continue;
      out.push([d.a - 0.02, d.b + 0.02]);
    }
    for (const hd of HALL_DOORS) {
      if ((hd.wall === 'x') !== along) continue;
      if (Math.abs((along ? hd.at[1] : hd.at[0]) - line) > 1.05) continue;
      const m = along ? hd.at[0] : hd.at[1];
      out.push([m - hd.width / 2, m + hd.width / 2]);
    }
    return out.sort((p, q) => p[0] - q[0]);
  };
  const run = (side: 'n' | 's' | 'w' | 'e', lo: number, hi: number, mk: (a: number, c: number) => void): void => {
    let t = lo;
    for (const [a, c] of gaps(side)) {
      if (c <= t || a >= hi) continue;
      if (a > t) mk(t, Math.min(a, hi));
      t = Math.max(t, c);
    }
    if (t < hi) mk(t, hi);
  };
  run('n', x0, x1, (a, c) => b.boxMM(f.band!.mat, [a, y0, z0], [c, y0 + h, z0 + T], { shadow: 'receive' }));
  run('s', x0, x1, (a, c) => b.boxMM(f.band!.mat, [a, y0, z1 - T], [c, y0 + h, z1], { shadow: 'receive' }));
  run('w', z0 + T, z1 - T, (a, c) => b.boxMM(f.band!.mat, [x0, y0, a], [x0 + T, y0 + h, c], { shadow: 'receive' }));
  run('e', z0 + T, z1 - T, (a, c) => b.boxMM(f.band!.mat, [x1 - T, y0, a], [x1, y0 + h, c], { shadow: 'receive' }));
}

/** 部屋の床・腰の帯と、骨組み（天井の格間・天窓・梁・柱型・灯り。roomarch.ts） */
export function roomShell(b: Builder, rm: RoomMats, r: RoomDef, fin?: Finish): void {
  const [x0, z0, x1, z1] = r.rect;
  slab(b, fin?.floor ?? rm.floor, [x0 - PART_T, z0 - PART_T, x1 + PART_T, z1 + PART_T], r.floor, 0.3);
  if (fin) band(b, r, fin);
  // 採暖室は窓も天窓も無い（暖かい色の弱い灯り）。機械室・倉庫は灯りを少し強く
  const o = r.kind === 'sauna' ? { skylights: false, lamp: 0.55, lampColor: '#fff0dc' } : {};
  buildRoomArch(b, rm.arch, r, o);
}

/** ホールの中の小さな空間（前室・2 階の回廊）を部屋と同じ決まりで作り込む（床は作らない。腰の帯・骨組み・灯り） */
export function dressSpace(b: Builder, rm: RoomMats, r: RoomDef, fin: Finish, o: { skylights?: boolean } = {}): void {
  band(b, r, fin);
  buildRoomArch(b, rm.arch, r, { skylights: o.skylights ?? false });
}
