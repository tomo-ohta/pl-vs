import * as THREE from 'three';
import { slab, wallWithHoles, type WallHole } from '../kit.ts';
import type { Builder, PartOptions, V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Doors } from './doors.ts';
import { CH, CORR, DOORS, FACADE, FL, MAT_Z1, MODULE, piersIn, ROOM_D, ROOMS, SMALL_W, STAIR, T_EXT, T_IN, WC, XN, Z_EAST, type DoorDef, type FacadeSpec, type RoomDef } from './layout.ts';
import { Mats, PAL, type Zone } from './mats.ts';

/**
 * 校舎の形（階ごと）: 床・天井・南の窓の壁（壁柱・窓台・竪框・欄間）・教室と廊下の間の壁（引き戸・欄間）・間仕切り・
 * 北の窓の壁・西と東の端の壁。形は layout.ts の数から作る（間取り図と同じ数）。
 */

export interface Env {
  ctx: SceneContext;
  mats: Mats;
  doors: Doors;
  /** 階ごとの Builder（見えない階を描かないため） */
  b: Builder;
}

/** 階の床の高さ・見た目の区域 */
export function levelZone(level: number): Zone {
  return level >= 3 ? 'shallow' : 'deep';
}

/** 階の上の床までの高さ（外壁は床から上の床まで） */
const STORY = 3.6;

export interface LevelMats {
  floorWood: THREE.Material;
  floorCorr: THREE.Material;
  /** 廊下の床: 教室と同じ幅の板で、古い目地（汚れの溜まった暗い溝）と板ごとのばらつきが強い */
  floorHall: THREE.Material;
  /** 廊下の天井: 600 角の吸音板と明るい T バーの格子 */
  ceilHall: THREE.Material;
  wall: THREE.Material;
  wainscot: THREE.Material;
  ext: THREE.Material;
  ceil: THREE.Material;
  frame: THREE.Material;
  sill: THREE.Material;
  glass: THREE.Material;
  /** 欄間の型板ガラス（光を通さず明るく見える。日の影を落とす） */
  frosted: THREE.Material;
  dark: THREE.Material;
  base: THREE.Material;
}

/** 床の紙の切れ端と欠片（明るい小さな四角だけ） */
const DEBRIS = {
  deep: { scale: 4.0, density: 0.13, color: '#a8dcde', length: 0.35, width: 0.22 },
  shallow: { scale: 4.0, density: 0.14, color: '#8fe0dc', length: 0.35, width: 0.22 },
} as const;

/** 廊下・階段室の仕上げの目地（教室より古く、目地がはっきりする）。板は教室と同じ寸法 */
export const HALL = {
  deep: { boards: { size: [0.075, 0.91] as [number, number], line: 0.006, color: '#0c1c2c', jitter: 0.14, offset: [0, 0.3] as [number, number] }, joint2: '#0c1a2a', tbar: '#4f7f9c' },
  shallow: { boards: { size: [0.075, 0.91] as [number, number], line: 0.006, color: '#031820', jitter: 0.14, offset: [0, 0.3] as [number, number] }, joint2: '#03141c', tbar: '#2c6878' },
} as const;

/** 階の面の材質 */
export function levelMats(m: Mats, zone: Zone): LevelMats {
  const P = PAL[zone];
  return {
    // 床: 幅 75 mm のフローリングの板（廊下に沿って長い）・板ごとの明るさのばらつき・紙の切れ端と欠片（明るい小さな四角）
    floorWood: m.get(zone, P.floor.color, { shade: P.floor.shade, dark: P.floor.dark, tiles: { size: [0.075, 0.91], line: 0.004, color: P.floor.line, jitter: 0.1, offset: [0, 0.3] }, flecks: DEBRIS[zone], key: 'wood' }),
    floorCorr: m.get(zone, P.floor.color, { shade: P.floor.shade, dark: P.floor.dark, tiles: { size: [0.3, 0.3], line: 0.005, color: P.floor.line, jitter: 0.06 }, flecks: DEBRIS[zone], key: 'corr' }),
    // 壁: 塗りの面（色は部材ごと。面の上に斑や染みの模様は描かない: 色と模様は作りに従う）
    wall: m.get(zone, P.wall.color, { shade: P.wall.shade, dark: P.wall.dark, key: 'wall' }),
    // 腰板: 幅 10 cm の縦の板張り（板ごとの明るさのばらつき・目地）。廊下・階段室の腰と扉の下の板
    wainscot: m.get(zone, P.frame.color, { shade: P.frame.shade, dark: P.frame.dark, tiles: { size: [0.1, 0.9], line: 0.006, color: HALL[zone].joint2, jitter: 0.12 }, key: 'wains' }),
    floorHall: m.get(zone, P.floor.color, { shade: P.floor.shade, dark: P.floor.dark, tiles: HALL[zone].boards, flecks: DEBRIS[zone], key: 'hall' }),
    ceilHall: m.get(zone, P.ceil.color, { shade: P.ceil.shade, dark: P.ceil.dark, tiles: { size: [0.6, 0.6], line: 0.024, color: HALL[zone].tbar, jitter: 0.08 }, key: 'ceilhall' }),
    ext: m.get(zone, P.wall.color, { shade: P.wall.shade, dark: P.wall.dark, key: 'ext' }),
    ceil: m.get(zone, P.ceil.color, { shade: P.ceil.shade, dark: P.ceil.dark, tiles: { size: [0.91, 0.455], line: 0.008, color: P.ceil.dark, jitter: 0.12, broken: 0.1 }, key: 'ceil' }),
    frame: m.get(zone, P.frame.color, { shade: P.frame.shade, dark: P.frame.dark, key: 'frame' }),
    sill: m.get(zone, P.frame.color, { shade: P.frame.shade, dark: P.frame.dark, key: 'sill' }),
    // ガラス: 2 階はほとんど透ける（割れた窓）、3 階は水色に光る
    glass: m.once(`glass-${zone}`, () => m.ctx.mat({ color: zone === 'deep' ? '#5fb6d4' : '#7ae6f2', transparent: true, opacity: zone === 'deep' ? 0.1 : 0.15, depthWrite: false, unlit: true, line: 0, name: `glass-${zone}` })),
    frosted: m.once(`frosted-${zone}`, () => m.ctx.mat({ color: zone === 'deep' ? '#6cbcd6' : '#5fd0de', transparent: true, opacity: 0.55, depthWrite: false, unlit: true, line: 0.2, name: `frosted-${zone}` })),
    dark: m.get(zone, P.ceil.dark, { shade: P.ceil.dark, dark: P.ceil.dark, key: 'dark' }),
    base: m.get(zone, P.frame.dark, { shade: P.frame.dark, dark: P.frame.dark, key: 'base' }),
  };
}

const C: PartOptions = { collide: true };

export interface RectHole {
  /** 壁に沿った範囲（x の壁なら z、z の壁なら x）と高さ（場面の y） */
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

/**
 * 軸に沿った壁に、長方形の穴（扉・窓・欄間）をいくつでも空ける。穴の縁で壁を升目に切って、穴でない升目を埋める。
 * axis = 'x' は z が一定の壁（x に沿う）、'z' は x が一定の壁（z に沿う）。plane は壁の中心の座標
 */
export function wallRects(b: Builder, mat: THREE.Material, axis: 'x' | 'z', plane: number, u0: number, u1: number, y0: number, y1: number, thick: number, holes: RectHole[], o: PartOptions = {}): void {
  const us = [...new Set([u0, u1, ...holes.flatMap((h) => [h.u0, h.u1])].filter((v) => v >= u0 && v <= u1))].sort((a, c) => a - c);
  const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])].filter((v) => v >= y0 && v <= y1))].sort((a, c) => a - c);
  // 縦に続く升目はまとめる（箱の数を減らす）
  for (let i = 0; i + 1 < us.length; i++) {
    const a = us[i];
    const c = us[i + 1];
    if (c - a < 1e-4) continue;
    const um = (a + c) / 2;
    let start = -1;
    for (let j = 0; j + 1 < ys.length; j++) {
      const ym = (ys[j] + ys[j + 1]) / 2;
      const hole = holes.some((h) => um > h.u0 && um < h.u1 && ym > h.y0 && ym < h.y1);
      if (!hole && start < 0) start = j;
      if ((hole || j + 2 === ys.length) && start >= 0) {
        const end = hole ? j : j + 1;
        const yy0 = ys[start];
        const yy1 = ys[end];
        if (yy1 - yy0 > 1e-4) {
          if (axis === 'x') b.boxMM(mat, [a, yy0, plane - thick / 2], [c, yy1, plane + thick / 2], { collide: true, ...o });
          else b.boxMM(mat, [plane - thick / 2, yy0, a], [plane + thick / 2, yy1, c], { collide: true, ...o });
        }
        start = -1;
      }
    }
  }
}

// ---------------------------------------------------------------- 南の窓の壁

/**
 * 南の窓の壁（x = -T_EXT〜0）を z0〜z1 に作る。壁柱（MODULE ごと）の間に、腰壁・窓台・ガラスの枠と竪框・欄間・上の梁。
 * glass = true でガラスを入れる（3 階。2 階は割れて無い）
 */
export function southFacade(b: Builder, lm: LevelMats, fl: number, f: FacadeSpec, z0: number, z1: number, o: { glass: boolean; skip?: (za: number, zb: number) => boolean; onBay?: (za: number, zb: number, n: number) => void }): { openings: [number, number][] } {
  const piers = piersIn(f, z0 - f.pierW, z1 + f.pierW);
  const solid: [number, number][] = piers.map((c) => [Math.max(z0, c - f.pierW / 2), Math.min(z1, c + f.pierW / 2)]);
  // 端の壁（隅の柱）
  solid.unshift([z0 - T_EXT, z0]);
  solid.push([z1, z1 + T_EXT]);
  solid.sort((a, c) => a[0] - c[0]);
  const openings: [number, number][] = [];
  // 庇（窓の欄間の上・奥行き 1.0 m のコンクリートの板と、先の上へ立ち上がる縁）。日（高さ 40°）の床の日なたを窓から約 2.2 m までにする
  // （参考画像の床の日なたの長さ）。机の天板（0.7 m）は窓から 1.4 m まで日が当たる
  const ED = 1.0;
  const ey = fl + f.transom[1] + 0.08;
  b.boxMM(lm.ext, [-T_EXT - ED, ey, z0 - T_EXT], [-T_EXT, ey + 0.14, z1 + T_EXT], { shadow: true });
  b.boxMM(lm.ext, [-T_EXT - ED, ey + 0.1, z0 - T_EXT], [-T_EXT - ED + 0.08, ey + 0.26, z1 + T_EXT], { shadow: true });
  for (const [a, c] of solid) {
    if (c - a < 1e-3) continue;
    const end = a < z0 + 1e-3 || c > z1 - 1e-3;
    if (f.ribbon && !end) {
      // 連窓: 壁柱の所は太い竪框（ガラスの面）と、腰・上の梁を続ける
      const gx = -0.12;
      b.boxMM(lm.frame, [gx - 0.08, fl + f.sill, a], [gx + 0.06, fl + f.transom[1], c], { shadow: true });
      b.boxMM(lm.ext, [-T_EXT, fl, a], [0, fl + f.sill - 0.04, c], { ...C, shadow: true });
      b.boxMM(lm.sill, [-0.16, fl + f.sill - 0.04, a], [f.ledge, fl + f.sill, c], { ...C, shadow: true });
      b.boxMM(lm.ext, [-T_EXT, fl + f.transom[1] + 0.04, a], [0, fl + STORY - 0.3, c], { shadow: true });
      continue;
    }
    b.boxMM(lm.ext, [-T_EXT, fl, a], [Math.max(0, f.pierProj), fl + STORY - 0.3, c], { ...C, shadow: true });
  }
  for (let i = 0; i + 1 < solid.length; i++) {
    const za = solid[i][1];
    const zb = solid[i + 1][0];
    if (zb - za < 0.15) continue;
    openings.push([za, zb]);
    if (o.skip?.(za, zb)) continue;
    const n = windowBay(b, lm, fl, f, za, zb, o.glass);
    o.onBay?.(za, zb, n);
  }
  return { openings };
}

/** 窓 1 区画（壁柱の間）。ガラスの面は x = -0.12 */
function windowBay(b: Builder, lm: LevelMats, fl: number, f: FacadeSpec, za: number, zb: number, glass: boolean): number {
  const gx = -0.12;
  const sill = fl + f.sill;
  const head = fl + f.head;
  const [t0, t1] = [fl + f.transom[0], fl + f.transom[1]];
  // 腰壁（外壁）と、内の腰（窓台を受ける前板）・窓台
  b.boxMM(lm.ext, [-T_EXT, fl, za], [0, sill - 0.04, zb], C);
  if (f.ledge > 0.1) b.boxMM(lm.wall, [0, fl, za], [f.ledge - 0.03, sill - 0.04, zb], C);
  b.boxMM(lm.sill, [-0.16, sill - 0.04, za], [f.ledge, sill, zb], { ...C, shadow: true });
  // 上の梁（欄間の上〜上の床）
  b.boxMM(lm.ext, [-T_EXT, t1 + 0.04, za], [0, fl + STORY - 0.3, zb], { shadow: true });
  // 窓の枠（下・上・欄間の横框・左右）
  const fw = 0.05;
  const fd: [number, number] = [gx - 0.05, gx + 0.05];
  b.boxMM(lm.frame, [fd[0], sill, za], [fd[1], sill + fw, zb], { shadow: true });
  b.boxMM(lm.frame, [fd[0], head - fw, za], [fd[1], t0, zb], { shadow: true });
  b.boxMM(lm.frame, [fd[0], t1, za], [fd[1], t1 + 0.04, zb], { shadow: true });
  for (const z of [za, zb - fw]) b.boxMM(lm.frame, [fd[0], sill, z], [fd[1], t1, z + fw], { shadow: true });
  // 竪框（ガラスの間）
  const n = Math.max(1, Math.round(f.sashes * ((zb - za) / (MODULE - f.pierW))));
  const w = (zb - za) / n;
  // 竪框の位置（2 枚なら split の割合。3 枚以上は等分）
  const cut = (k: number): number => (f.split !== undefined && f.split.length === n - 1 ? za + (zb - za) * f.split[k - 1] : za + k * w);
  for (let k = 1; k < n; k++) {
    const zc = cut(k);
    b.boxMM(lm.frame, [gx - 0.07, sill, zc - f.mullW / 2], [gx + 0.05, head, zc + f.mullW / 2], { shadow: true });
    b.boxMM(lm.frame, [fd[0], t0, zc - 0.025], [fd[1], t1, zc + 0.025], { shadow: true });
  }
  for (let k = 0; k < n; k++) {
    const a = k === 0 ? za : cut(k);
    const e = k === n - 1 ? zb : cut(k + 1);
    if (glass) b.plane(lm.glass, [gx, (sill + head) / 2, (a + e) / 2], e - a, head - sill, 'x', { shadow: false, layer: 1 });
    // 欄間は型板ガラス（どの階も。日を通さず影を落とす）
    b.plane(lm.frosted, [gx, (t0 + t1) / 2, (a + e) / 2], e - a, t1 - t0, 'x', { shadow: 'cast', layer: 1 });
  }
  return n;
}

/** 窓の区画の竪框の数（windowBay と同じ割り方） */
export function sashCount(f: FacadeSpec, za: number, zb: number): number {
  return Math.max(1, Math.round(f.sashes * ((zb - za) / (MODULE - f.pierW))));
}

// ---------------------------------------------------------------- 階

/** 階の部屋の床・天井・壁（参考画像の部屋の作り込みは別の関数） */
export function buildLevel(env: Env, level: 2 | 3, onBay?: (za: number, zb: number, n: number) => void): LevelMats {
  const { b, mats } = env;
  const zone = levelZone(level);
  const lm = levelMats(mats, zone);
  const fl = FL[level - 1];
  const f = FACADE[level];
  const rooms = ROOMS.filter((r) => r.level === level);
  // 床と天井（部屋ごと）
  for (const r of rooms) {
    // 床: 教室も廊下も同じフローリング（古い校舎。廊下の長さの向きに板）。階段室の踊り場とバルコニーはタイル
    const fm = r.kind === 'corridor' ? lm.floorHall : lm.floorWood;
    const cm = r.kind === 'corridor' ? lm.ceilHall : lm.ceil;
    for (const rc of [r.rect, r.rect2].filter(Boolean) as [number, number, number, number][]) {
      slab(b, fm, [rc[0] - 0.07, rc[1] - 0.07, rc[2] + 0.07, rc[3] + 0.07], fl, 0.3, { shadow: 'receive' });
      b.boxMM(cm, [rc[0] - 0.07, fl + CH, rc[1] - 0.07], [rc[2] + 0.07, fl + CH + 0.06, rc[3] + 0.07], { shadow: true });
    }
  }
  // 南の窓の壁
  southFacade(b, lm, fl, f, 0, Z_EAST, { glass: level === 3, onBay });
  // 教室と廊下の間の壁（引き戸・欄間の窓）
  const doors = DOORS[level];
  const holesAlong = (wall: DoorDef['wall'], from: number): WallHole[] =>
    doors.filter((d) => d.wall === wall).map((d) => ({ at: d.at - from, width: d.width + 0.08, bottom: fl, top: fl + (d.height ?? 2.0) + 0.04 }));
  // （教室と廊下の間の壁は building.ts の corridorWall）
  // 間仕切り（教室の間）
  const parts = level === 2 ? [rooms.find((r) => r.id === 'C2B')!.rect[1] - T_IN / 2, rooms.find((r) => r.id === 'C2C')!.rect[1] - T_IN / 2] : [rooms.find((r) => r.id === 'C3B')!.rect[1] - T_IN / 2, rooms.find((r) => r.id === 'C3C')!.rect[1] - T_IN / 2];
  for (const z of parts) wallWithHoles(b, lm.wall, [0, z], [ROOM_D, z], fl, fl + STORY - 0.3, T_IN);
  if (level === 2) {
    // 小さな教室と教材室の間仕切り（x = SMALL_W）と、教材室の東の壁
    wallWithHoles(b, lm.wall, [SMALL_W + T_IN / 2, 0], [SMALL_W + T_IN / 2, MAT_Z1 + T_IN], fl, fl + STORY - 0.3, T_IN, holesAlong('mat', 0));
    wallWithHoles(b, lm.wall, [SMALL_W + T_IN, MAT_Z1 + T_IN / 2], [ROOM_D, MAT_Z1 + T_IN / 2], fl, fl + STORY - 0.3, T_IN);
  }
  // 北の外壁（廊下の窓。階段室と便所への口）
  const nHoles: WallHole[] = [];
  for (let z = 1.2; z < Z_EAST - 1; z += MODULE) {
    const c = z + 0.9;
    if (c > STAIR[1] - 0.8 && c < WC[3] + 0.8) continue;
    nHoles.push({ at: c, width: 1.6, bottom: fl + 0.9, top: fl + 2.2 });
  }
  nHoles.push({ at: (STAIR[1] + STAIR[3]) / 2, width: 3.2, bottom: fl, top: fl + 2.4 });
  nHoles.push({ at: WC[1] + 1.2, width: 0.85, bottom: fl, top: fl + 2.0 });
  wallWithHoles(b, lm.ext, [XN + T_EXT / 2, -T_EXT], [XN + T_EXT / 2, Z_EAST + T_EXT], fl, fl + STORY - 0.3, T_EXT, nHoles.map((hh) => ({ ...hh, at: hh.at + T_EXT })));
  // 西の端の壁（穴は階ごとの部屋の作り込みが決める: westHoles）
  wallRects(b, lm.ext, 'x', -T_EXT / 2, -T_EXT, XN + T_EXT, fl, fl + STORY - 0.3, T_EXT, westHoles(level));
  // 東の端の壁
  const eHoles: WallHole[] = doors.filter((d) => d.wall === 'e').map((d) => ({ at: d.at + T_EXT, width: d.width + 0.1, bottom: fl, top: fl + (d.height ?? 2.0) + 0.05 }));
  wallWithHoles(b, lm.ext, [-T_EXT, Z_EAST + T_EXT / 2], [XN + T_EXT, Z_EAST + T_EXT / 2], fl, fl + STORY - 0.3, T_EXT, eHoles);
  return lm;
}

/** 西の端の壁の穴（2 階: 小さな教室の扉と欄間・教材室の窓・廊下の扉。3 階: 教室の前の窓と欄間・廊下の扉） */
export function westHoles(level: 2 | 3): RectHole[] {
  const fl = FL[level - 1];
  const corrDoor: RectHole = { u0: (CORR[0] + CORR[1]) / 2 - 0.5, u1: (CORR[0] + CORR[1]) / 2 + 0.5, y0: fl, y1: fl + 2.05 };
  if (level === 2) return [{ u0: W0_DOOR[0], u1: W0_DOOR[1], y0: fl, y1: fl + 2.42 }, { u0: SMALL_W + 0.9, u1: SMALL_W + 2.5, y0: fl + 0.9, y1: fl + 2.2 }, corrDoor];
  return [{ u0: W1_TRANSOM[0], u1: W1_TRANSOM[1], y0: fl + 2.26, y1: fl + 2.77 }, { u0: W1_WIN[0], u1: W1_WIN[1], y0: fl + 1.12, y1: fl + 2.09 }, corrDoor];
}

/** 2 階の小さな教室の西の扉（両開き・欄間つき）の x の範囲 */
export const W0_DOOR: [number, number] = [0.25, 2.15];
/** 3 階の教室の前の窓（下の窓・欄間の帯）の x の範囲 */
export const W1_WIN: [number, number] = [0.8, 2.1];
export const W1_TRANSOM: [number, number] = [0.09, 2.53];

export function roomsOf(level: number): RoomDef[] {
  return ROOMS.filter((r) => r.level === level);
}

export { CORR };
export type { V3 };
