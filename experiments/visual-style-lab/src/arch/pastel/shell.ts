import * as THREE from 'three';
import { decalMaterial } from '../../render/Decal.ts';
import type { FaceColors } from '../../render/PaintMaterial.ts';
import type { Builder, V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { slab, wallWithHoles, type WallHole } from '../kit.ts';
import { Doors, swingAngle, type LeafBuild } from './doors.ts';
import { BLDG, DOORS, FLOOR2, ROOMS, T_EXT, WINDOWS, type DoorDef, type Rect, type RoomDef, type Side, type WinDef } from './layout.ts';
import { darkenAxis, faces, hex, Paints, WHITE, type WallPalette } from './paint.ts';
import { shiftColor } from '../../render/Style.ts';

/**
 * 部屋の殻（建築版）: 壁（開口つき）・天井・外の窓・扉の枠と戸。
 * 壁は部屋ごとに「自分の側の半分」を作る（隣の部屋とは壁の真ん中で合わせる）。外壁は丸ごと、
 * 参考画像の区画（廊下・奥のホール・北の壁の塊）に接する辺は、その壁の面に薄い内張り（自分の色）を貼る。
 */

export const LINING = 0.012;

export interface RoomStyle {
  wall: THREE.Material;
  ceil: THREE.Material;
  /** 天井の色（梁の色の元） */
  ceilColor: string;
  /** 幅木 */
  base?: string;
  /** 柱型の材質（axis の向きの面 = 柱型の横の面を 1 段暗く） */
  pil?: (axis: 'x' | 'z') => THREE.Material;
  /** 腰の高さまで別の材質で内張りする（便所の暗いタイル） */
  dado?: { mat: THREE.Material; h: number };
}

/**
 * 部屋の種類ごとの壁・天井の色（参考画像の色の表から）。
 * 腰壁の決まり（参考画像の廊下: 入口の近くは #99afad、奥へ行くほど #61767a まで暗い）: 窓が大きく明るい部屋は淡い灰青、
 * 窓の小さい部屋・奥の部屋・職員の通り道ほど暗い灰青。上の壁は淡いまま（上が淡い緑・腰から下が暗い灰青の 2 色）
 */
export function roomStyle(p: Paints, r: RoomDef): RoomStyle {
  const w = (o0: WallPalette, ceil: string, base?: string): RoomStyle => {
    const o: WallPalette = { ...o0, faceMul: windowLight(r) };
    return {
      wall: p.wall(o),
      ceil: p.ceil(ceil),
      ceilColor: ceil,
      base,
      pil: (axis) => p.wall({ ...o, side: axis }),
    };
  };
  switch (r.kind) {
    case 'lobby': {
      // 西の壁（東を向く面）はセージ・東の壁（西を向く面）は白に近い・南の壁（北を向く面）はその間（参考画像の西の塊と東の塊の色）
      const lobby = (side?: 'x' | 'z'): THREE.Material => {
        const d = (c: Record<string, string>): Record<string, string> => (side ? darkenAxis(c, side) : c);
        return p.get(`lobbyWall|${side ?? ''}`, () => ({
          color: d({ px: '#b9c9be', nx: '#d9e1d4', nz: '#c5d1c6', pz: '#c8d3c8' }),
          band: { y: 1.23, color: d({ px: '#a1b6b1', nx: '#c3cdc0', nz: '#a7b8b2', pz: '#adbfb8' }), amp: 0.05, scale: 0.8, drip: 0.1 },
          cov: p.snow,
          layers: [
            // 腰壁の縁の上の白い塗り（参考画像の左の塊と同じ所）。縁の上 0.1〜0.5 m だけ（腰壁の面の上には出さない）
            { color: d({ px: '#dde1d3', nx: '#eef2e6', nz: '#dfe4d8', pz: '#dfe4d8' }), scale: 2.2, threshold: 0.68, origin: [0, 1.5, 0], abs: [0, 1.1, 0], detail: 0.45, only: 'wall', seed: 5 },
            { color: '#ffffff', scale: 1, threshold: 9, only: 'ceil' },
            { color: '#ffffff', scale: 1, threshold: 9, only: 'ceil' },
            { color: WHITE, scale: 2.2, threshold: 0.9, yRange: [0.02, 0.36], yGain: 1.2, detail: 0.5, only: 'wall', seed: 6, cov: 0.7 },
          ],
        }));
      };
      return { wall: lobby(), ceil: p.ceil('#a8bcb3'), ceilColor: '#a8bcb3', base: '#565d60', pil: (axis) => lobby(axis) };
    }
    case 'vest':
      return w({ up: '#dde5d8', low: '#99afad', band: 1.2 }, '#c6d1c6', '#565d60');
    case 'office':
      return w({ up: '#c9d4c6', low: '#7d9091', band: 1.35, flake: 0.3 }, '#b9c7bd', '#565d60');
    case 'doctor':
      return w({ up: '#d5d7c2', low: '#99afad', band: 1.2, flake: 0.25 }, '#cfd2bf', '#565d60');
    case 'store':
      return w({ up: '#b5c5bb', low: '#8a9d9d', band: 1.38 }, '#a8bcb3', '#3c4346');
    case 'consult':
      return w({ up: '#dde5d8', low: '#8a9d9d', band: 1.4, flake: r.snow > 0.5 ? 0.35 : 0.15 }, '#c6d2c8', '#565d60');
    case 'treat':
      return w({ up: '#d8e0d4', low: '#7d9091', band: 1.4, flake: 0.3 }, '#c6d2c8', '#565d60');
    case 'lab':
      return w({ up: '#dfe3d6', low: '#99afad', band: 1.25 }, '#d0d6c8', '#565d60');
    case 'toilet':
      // 便所: 白いタイルの壁に、腰の高さまで 1 段暗いセージのタイル（腰壁の決まりをタイルで）
      return { wall: p.tileWall('#dbe3d8', 0.15, '#b3c1b6'), ceil: p.ceil('#cdd5c8'), ceilColor: '#cdd5c8', dado: { mat: p.tileWall('#8fa29b', 0.15, '#768987'), h: 1.35 } };
    case 'stair':
      return w({ up: '#cdd6c8', low: '#99afad', band: 1.0, flake: 0.2, flake2: [2.4, FLOOR2 + 2.4] }, '#d2d3c0', '#565d60');
    case 'pantry':
      return w({ up: '#dde1d0', low: '#8a9d9d', band: 1.2 }, '#d2d3c0', '#565d60');
    case 'porch':
      return w({ up: '#c4cbb9', low: '#6f8382', band: 1.2 }, '#c9cfbf', '#3c4346');
    default:
      return w({ up: '#b5c5bb', low: '#8a9d9d', band: 1.38 }, '#a8bcb3');
  }
}

/**
 * 窓の光の決まり（照明を使わない面ごとの色で）: 窓のある壁は窓の明るさを背にして 1 段暗く、向かいの壁は窓の光を受けて
 * 1 段明るく（白に近く）塗る。参考画像の「淡いクリーム・白の面 / 中間のセージの面 / 暗い所」の段を、どの部屋にも窓の向きから出す
 */
export function windowLight(r: RoomDef): Partial<Record<'px' | 'nx' | 'pz' | 'nz', number>> | undefined {
  const [x0, z0, x1, z1] = r.rect;
  const face: Record<Side, 'px' | 'nx' | 'pz' | 'nz'> = { w: 'px', e: 'nx', n: 'pz', s: 'nz' };
  const opp: Record<Side, Side> = { w: 'e', e: 'w', n: 's', s: 'n' };
  const out: Partial<Record<'px' | 'nx' | 'pz' | 'nz', number>> = {};
  for (const wd of WINDOWS) {
    if (wd.room !== r.id || wd.y0 > 2.5) continue;
    const s: Side | null =
      wd.wall === 'z' ? (Math.abs(wd.line - x0) < 0.5 ? 'w' : Math.abs(wd.line - x1) < 0.5 ? 'e' : null) : Math.abs(wd.line - z0) < 0.5 ? 'n' : Math.abs(wd.line - z1) < 0.5 ? 's' : null;
    if (!s) continue;
    out[face[s]] = 0.9;
    if (out[face[opp[s]]] === undefined) out[face[opp[s]]] = 1.05;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface SideSpec {
  /** 外へ出す厚さ（負なら内張り = 内へ LINING） */
  t: number;
  skip?: boolean;
}

/** 辺ごとの壁の作り方を決める（外壁・隣の部屋との半分・参考画像の区画の内張り） */
export function sideSpecs(r: RoomDef): Record<Side, SideSpec> {
  const [x0, z0, x1, z1] = r.rect;
  const out: Partial<Record<Side, SideSpec>> = {};
  const lines: Record<Side, number> = { n: z0, s: z1, w: x0, e: x1 };
  const ext: Record<Side, boolean> = { n: Math.abs(z0 - BLDG.z0) < 1e-3, s: Math.abs(z1 - BLDG.z1) < 1e-3, w: Math.abs(x0 - BLDG.x0) < 1e-3, e: Math.abs(x1 - BLDG.x1) < 1e-3 };
  for (const s of ['n', 's', 'w', 'e'] as Side[]) {
    if (ext[s]) {
      out[s] = { t: T_EXT };
      continue;
    }
    // 向かいの部屋（壁の厚さ 0.6 m 以内・範囲が重なる）
    const v = lines[s];
    let best: { r: RoomDef; gap: number } | null = null;
    for (const o of ROOMS) {
      if (o === r) continue;
      const [ox0, oz0, ox1, oz1] = o.rect;
      let gap = Infinity;
      let overlap = false;
      if (s === 'n') {
        gap = v - oz1;
        overlap = ox1 > x0 + 0.05 && ox0 < x1 - 0.05;
      } else if (s === 's') {
        gap = oz0 - v;
        overlap = ox1 > x0 + 0.05 && ox0 < x1 - 0.05;
      } else if (s === 'w') {
        gap = v - ox1;
        overlap = oz1 > z0 + 0.05 && oz0 < z1 - 0.05;
      } else {
        gap = ox0 - v;
        overlap = oz1 > z0 + 0.05 && oz0 < z1 - 0.05;
      }
      if (overlap && gap > -1e-3 && gap < 0.9 && (!best || gap < best.gap)) best = { r: o, gap };
    }
    if (!best) out[s] = { t: 0.15 };
    else if (best.r.view || best.r.id === 'LOBBY' || r.id === 'PORCH') out[s] = { t: -1 };
    else out[s] = { t: best.gap / 2 };
  }
  return out as Record<Side, SideSpec>;
}

/** 辺の上の開口（扉・窓口・外の窓） */
function sideHoles(r: RoomDef, s: Side, sp: SideSpec): { from: number; holes: WallHole[]; wins: WinDef[]; doors: DoorDef[] } {
  const [x0, z0, x1, z1] = r.rect;
  const alongX = s === 'n' || s === 's';
  const line = { n: z0, s: z1, w: x0, e: x1 }[s];
  const outSign = s === 'n' || s === 'w' ? -1 : 1;
  const lo = alongX ? x0 : z0;
  const hi = alongX ? x1 : z1;
  const tOut = Math.max(sp.t, 0);
  // 壁の板の範囲（壁に垂直な向き）
  const p0 = sp.t > 0 ? Math.min(line, line + outSign * tOut) : Math.min(line, line - outSign * LINING);
  const p1 = sp.t > 0 ? Math.max(line, line + outSign * tOut) : Math.max(line, line - outSign * LINING);
  const inWall = (l: number, th: number): boolean => l + th / 2 > p0 - 0.02 && l - th / 2 < p1 + 0.02;
  const holes: WallHole[] = [];
  const wins: WinDef[] = [];
  const doors: DoorDef[] = [];
  // n / s の壁は角を覆うために外から始まる（呼ぶ側と同じ）
  const from = lo;
  for (const d of DOORS) {
    if ((d.wall === 'x') !== alongX || !inWall(d.line, d.thick)) continue;
    if (d.b <= lo + 1e-3 || d.a >= hi - 1e-3) continue;
    if (!d.rooms.includes(r.id) && !(r.id === 'STAIR' && d.rooms.includes('STAIR'))) continue;
    holes.push({ at: (d.a + d.b) / 2 - from, width: d.b - d.a, bottom: d.y0, top: d.y1 });
    doors.push(d);
  }
  for (const w of WINDOWS) {
    if (w.room !== r.id || (w.wall === 'x') !== alongX || !inWall(w.line, w.thick)) continue;
    holes.push({ at: (w.a + w.b) / 2 - from, width: w.b - w.a, bottom: w.y0, top: w.y1 });
    wins.push(w);
  }
  return { from, holes, wins, doors };
}

/**
 * 部屋の壁と天井（参考画像の区画・階段室は別に作る）。sides で辺ごとの作り方を上書きできる
 */
export function roomShell(b: Builder, p: Paints, r: RoomDef, st: RoomStyle, o: { skip?: Side[]; height?: Partial<Record<Side, number>> } = {}): void {
  const [x0, z0, x1, z1] = r.rect;
  const specs = sideSpecs(r);
  for (const s of o.skip ?? []) specs[s].skip = true;
  const tw = Math.max(specs.w.t, 0);
  const te = Math.max(specs.e.t, 0);
  const tn = Math.max(specs.n.t, 0);
  const ts = Math.max(specs.s.t, 0);
  const baseM = st.base ? p.baseboard(st.base) : null;
  for (const s of ['n', 's', 'w', 'e'] as Side[]) {
    const sp = specs[s];
    if (sp.skip) continue;
    const { holes } = sideHoles(r, s, sp);
    const H = o.height?.[s] ?? r.ceil;
    const alongX = s === 'n' || s === 's';
    const line = { n: z0, s: z1, w: x0, e: x1 }[s];
    const outSign = s === 'n' || s === 'w' ? -1 : 1;
    const th = sp.t > 0 ? sp.t : LINING;
    const mid = sp.t > 0 ? line + (outSign * sp.t) / 2 : line - (outSign * LINING) / 2;
    if (alongX) {
      // 角を覆う（外へ出す壁なら隣の辺の厚さぶん外から）
      const a0 = x0 - tw;
      const a1 = x1 + te;
      wallWithHoles(b, st.wall, [a0, mid], [a1, mid], 0, H, th, holes.map((h) => ({ ...h, at: h.at + tw })), { shadow: false });
    } else {
      wallWithHoles(b, st.wall, [mid, z0], [mid, z1], 0, H, th, holes, { shadow: false });
    }
    // 腰の内張り（開口を避ける。壁の内側の面に 4 mm 浮かせる）
    if (st.dado) {
      const inner = line - outSign * (sp.t > 0 ? 0 : LINING) - outSign * 0.004;
      if (alongX) wallWithHoles(b, st.dado.mat, [x0, inner], [x1, inner], 0, st.dado.h, 0.008, holes, { shadow: false, collide: false });
      else wallWithHoles(b, st.dado.mat, [inner, z0], [inner, z1], 0, st.dado.h, 0.008, holes, { shadow: false, collide: false });
      // 見切り（腰のタイルの上の縁の細い帯）
      const capM = p.solid('#7d9091', 0.5);
      const ci = inner - outSign * 0.008;
      if (alongX) wallWithHoles(b, capM, [x0, ci], [x1, ci], st.dado.h, st.dado.h + 0.035, 0.024, holes, { shadow: false, collide: false });
      else wallWithHoles(b, capM, [ci, z0], [ci, z1], st.dado.h, st.dado.h + 0.035, 0.024, holes, { shadow: false, collide: false });
    }
    // 幅木（開口を避ける）
    if (baseM) {
      const inner = line - outSign * (sp.t > 0 ? 0 : LINING);
      const hs = holes.filter((h) => h.bottom < 0.1).map((h) => [h.at - h.width / 2, h.at + h.width / 2]).sort((a, c) => a[0] - c[0]);
      const len = alongX ? x1 - x0 : z1 - z0;
      let t0 = 0;
      const seg = (u0: number, u1: number): void => {
        if (u1 - u0 < 0.02) return;
        if (alongX) b.boxMM(baseM, [x0 + u0, 0, inner - outSign * 0.014], [x0 + u1, 0.1, inner], { shadow: false });
        else b.boxMM(baseM, [inner - outSign * 0.014, 0, z0 + u0], [inner, 0.1, z0 + u1], { shadow: false });
      };
      for (const [a, c] of hs) {
        seg(t0, a);
        t0 = c;
      }
      seg(t0, len);
    }
  }
  // 天井（壁の上を覆う。内張りの辺は広げない）
  slab(b, st.ceil, [x0 - tw, z0 - tn, x1 + te, z1 + ts], r.ceil + 0.25, 0.25, { shadow: false });
}

// ---------------------------------------------------------------- 外の窓

/** 外の窓: 鉄の枠と桟・内の窓台・ガラスのつや（割れた窓は 1 枚ぶん無し）。当たり判定の板 */
export function buildWindow(b: Builder, ctx: SceneContext, p: Paints, w: WinDef, glass: THREE.Material): void {
  // 鉄の窓枠は暗い灰青（明るい外を暗い枠が区切る。参考画像の暗い差し色の 1 つ）
  const frame = p.solid('#7d9091', 0.6);
  const sill = p.solid('#d9dccb', 0.6);
  const alongX = w.wall === 'x';
  const inSign = -w.out;
  const faceIn = w.line + inSign * (w.thick / 2);
  const mid = w.line + w.out * 0.02; // 枠は壁の外寄り
  const W = w.b - w.a;
  const H = w.y1 - w.y0;
  const put = (u0: number, u1: number, y0: number, y1: number, d0: number, d1: number, m: THREE.Material): void => {
    if (alongX) b.boxMM(m, [w.a + u0, y0, Math.min(d0, d1)], [w.a + u1, y1, Math.max(d0, d1)], { shadow: false });
    else b.boxMM(m, [Math.min(d0, d1), y0, w.a + u0], [Math.max(d0, d1), y1, w.a + u1], { shadow: false });
  };
  const ft = 0.05;
  // 外枠
  put(0, ft, w.y0, w.y1, mid - 0.04, mid + 0.04, frame);
  put(W - ft, W, w.y0, w.y1, mid - 0.04, mid + 0.04, frame);
  put(0, W, w.y0, w.y0 + ft, mid - 0.04, mid + 0.04, frame);
  put(0, W, w.y1 - ft, w.y1, mid - 0.04, mid + 0.04, frame);
  // 縦の桟（引き違いの戸の召し合わせ）・横の桟
  const cols = w.cols ?? 2;
  for (let i = 1; i < cols; i++) {
    const u = (W * i) / cols;
    put(u - 0.025, u + 0.025, w.y0, w.y1, mid - 0.035, mid + 0.035, frame);
  }
  for (const y of w.rails ?? []) put(0, W, y - 0.02, y + 0.02, mid - 0.035, mid + 0.035, frame);
  // 窓台（内）
  put(-0.05, W + 0.05, w.y0 - 0.04, w.y0, faceIn - inSign * 0.02, faceIn + inSign * 0.07, sill);
  // ガラスのつや（窓ガラスを示す薄い膜）。割れた窓は 1 枚目に無い
  for (let i = 0; i < cols; i++) {
    if (w.broken && i === cols - 1) continue;
    const u0 = (W * i) / cols + 0.03;
    const u1 = (W * (i + 1)) / cols - 0.03;
    const c: V3 = alongX ? [w.a + (u0 + u1) / 2, (w.y0 + w.y1) / 2, mid] : [mid, (w.y0 + w.y1) / 2, w.a + (u0 + u1) / 2];
    const normal = alongX ? (inSign > 0 ? 'z' : '-z') : inSign > 0 ? 'x' : '-x';
    b.plane(glass, c, u1 - u0, H - 0.06, normal, { shadow: false, merge: true });
  }
  if (w.broken) {
    // 割れたガラスの残り（枠の角の三角）と窓台の雪
    const u0 = (W * (cols - 1)) / cols;
    put(u0 + 0.03, u0 + 0.16, w.y1 - 0.4, w.y1 - 0.05, mid - 0.004, mid + 0.004, p.solid('#e9eee4', 0.3));
    put(W - 0.2, W - 0.03, w.y0 + 0.05, w.y0 + 0.25, mid - 0.004, mid + 0.004, p.solid('#e9eee4', 0.3));
    put(0.05, W - 0.05, w.y0, w.y0 + 0.05, faceIn - inSign * 0.0, faceIn + inSign * 0.06, p.solid(WHITE, 0.2));
  }
  // 当たり判定（外へ出られない）
  const min = alongX ? new THREE.Vector3(w.a, w.y0, w.line - w.thick / 2) : new THREE.Vector3(w.line - w.thick / 2, w.y0, w.a);
  const max = alongX ? new THREE.Vector3(w.b, w.y1, w.line + w.thick / 2) : new THREE.Vector3(w.line + w.thick / 2, w.y1, w.b);
  ctx.colliders.add(min, max);
}

export function glassMaterial(): THREE.Material {
  return decalMaterial({ color: '#f1f5ec', rag: 0, opacity: 0.2 });
}

// ---------------------------------------------------------------- 扉

export interface DoorLook {
  leaf: string;
  edge: string;
  frame: string;
  handle: string;
  window?: string;
}

/** 部屋の扉の色（参考画像の白い戸・クリームの枠の色から） */
export const DOOR_LOOK: DoorLook = { leaf: '#d5d7c2', edge: '#c4c8b4', frame: '#dadbc9', handle: '#3a4244', window: '#e9eee4' };

/**
 * DOORS の戸を作る（参考画像の白い戸は見た目を元の版と同じに）。枠（両面）・室名札・戸の板・取っ手
 */
export function buildDoors(b: Builder, ctx: SceneContext, p: Paints, doors: Doors, view: { doorMat: THREE.Material; handleMat: THREE.Material }, glass: THREE.Material): void {
  const L = DOOR_LOOK;
  const leafM = p.solid(L.leaf, 0.5);
  const edgeM = p.solid(L.edge, 0.5);
  const frameM = p.solid(L.frame, 0.5);
  const handleM = p.solid(L.handle, 0.3);
  const winM = p.solid(L.window!, 0.3);
  const plateM = p.face({ pz: '#e5ece0', nz: '#e5ece0', px: '#e5ece0', nx: '#e5ece0', py: '#e5ece0', ny: '#c9d0c6' } as FaceColors, 'plate');
  const plateInk = p.solid('#8f9e98', 0.3);
  const steelM = p.solid('#9fb0a9', 0.6);
  for (const d of DOORS) {
    if (d.kind === 'opening' || d.kind === 'window') continue;
    const alongX = d.wall === 'x';
    const W = d.b - d.a;
    const H = d.y1 - d.y0;
    const f0 = d.line - d.thick / 2;
    const f1 = d.line + d.thick / 2;
    // 面の上の箱（u = 壁に沿う, y, w = 壁に垂直）
    const put = (bb: Builder, m: THREE.Material, u0: number, u1: number, y0: number, y1: number, w0: number, w1: number, collide = false): void => {
      if (alongX) bb.boxMM(m, [u0, y0, Math.min(w0, w1)], [u1, y1, Math.max(w0, w1)], { shadow: false, collide });
      else bb.boxMM(m, [Math.min(w0, w1), y0, u0], [Math.max(w0, w1), y1, u1], { shadow: false, collide });
    };
    if (d.id === 'back') {
      // 参考画像の突き当たりの白い戸（元の版と同じ板と取っ手）。開き戸、吊り元は右（x 0.34）、通用口へ開く
      const pv: V3 = [d.b, 0, -20.985];
      doors.add(d, [
        {
          pivot: pv,
          swing: swingAngle([-1, 0], [0, -1]),
          build: (lb) => {
            lb.boxMM(view.doorMat, [d.a - pv[0], 0, -20.97 - pv[2]], [d.b - pv[0], 2.05, -20.985 - pv[2]], { shadow: false });
            lb.boxMM(view.handleMat, [-0.6 - pv[0], 0.95, -20.96 - pv[2]], [-0.56 - pv[0], 1.12, -20.97 - pv[2]], { shadow: false });
            // 裏（通用口の側）の取っ手と押し板
            lb.boxMM(view.handleMat, [-0.6 - pv[0], 0.95, -20.985 - pv[2]], [-0.56 - pv[0], 1.12, -20.995 - pv[2]], { shadow: false });
          },
        },
      ]);
      continue;
    }
    if (d.kind === 'pass') {
      // 窓口: 台・枠・小さな引き違いのガラス戸（片方は開いている）
      const sill = p.solid('#d6d6c2', 0.6);
      put(b, sill, d.a - 0.05, d.b + 0.05, d.y0 - 0.04, d.y0, f0 - 0.18, f1 + 0.18, true);
      for (const w of [f0, f1]) {
        put(b, frameM, d.a - 0.05, d.a, d.y0, d.y1 + 0.05, w - 0.01, w + 0.01);
        put(b, frameM, d.b, d.b + 0.05, d.y0, d.y1 + 0.05, w - 0.01, w + 0.01);
        put(b, frameM, d.a - 0.05, d.b + 0.05, d.y1, d.y1 + 0.05, w - 0.01, w + 0.01);
      }
      const wm = d.line;
      const half = W / 2;
      put(b, frameM, d.a, d.a + 0.03, d.y0, d.y1, wm - 0.02, wm);
      put(b, frameM, d.a + half - 0.03, d.a + half, d.y0, d.y1, wm - 0.02, wm);
      put(b, frameM, d.a, d.a + half, d.y1 - 0.03, d.y1, wm - 0.02, wm);
      const c: V3 = alongX ? [d.a + half / 2, (d.y0 + d.y1) / 2, wm - 0.01] : [wm - 0.01, (d.y0 + d.y1) / 2, d.a + half / 2];
      b.plane(glass, c, half - 0.06, H - 0.06, alongX ? 'z' : 'x', { shadow: false });
      // 当たり判定（窓口は通れない）
      const min = alongX ? new THREE.Vector3(d.a, d.y0, f0) : new THREE.Vector3(f0, d.y0, d.a);
      const max = alongX ? new THREE.Vector3(d.b, d.y1, f1) : new THREE.Vector3(f1, d.y1, d.b);
      ctx.colliders.add(min, max);
      // 窓口の上の札
      for (const [w, sgn] of [[f0, -1], [f1, 1]] as const) put(b, plateM, (d.a + d.b) / 2 - 0.28, (d.a + d.b) / 2 + 0.28, d.y1 + 0.12, d.y1 + 0.3, w, w + sgn * 0.012);
      continue;
    }
    // 枠（両面。戸の周りの 3 本）。廊下の側は参考画像から見えない凹みの中
    const isGlassDouble = d.kind === 'double';
    const fm = isGlassDouble ? steelM : frameM;
    for (const [w, sgn] of [[f0, -1], [f1, 1]] as const) {
      put(b, fm, d.a - 0.06, d.a, d.y0, d.y1 + 0.06, w, w + sgn * 0.03);
      put(b, fm, d.b, d.b + 0.06, d.y0, d.y1 + 0.06, w, w + sgn * 0.03);
      put(b, fm, d.a - 0.06, d.b + 0.06, d.y1, d.y1 + 0.06, w, w + sgn * 0.03);
    }
    // 室名札（戸の上の両面。鍵の扉は「立入禁止」の札の色）
    if (d.label && !isGlassDouble) {
      for (const [w, sgn] of [[f0, -1], [f1, 1]] as const) {
        const u = (d.a + d.b) / 2;
        put(b, plateM, u - 0.2, u + 0.2, d.y1 + 0.16, d.y1 + 0.3, w, w + sgn * 0.015);
        put(b, plateInk, u - 0.13, u + 0.13, d.y1 + 0.215, d.y1 + 0.245, w + sgn * 0.015, w + sgn * 0.017);
      }
    }
    const radius = d.kind === 'slide' ? 1.9 : 1.7;
    if (d.kind === 'slide') {
      // 引き戸（壁の厚さの真ん中を滑って戸袋へ）。小さな縦長の窓・引手・蹴り板
      const pv: V3 = alongX ? [0, d.y0, d.line] : [d.line, d.y0, 0];
      const dir = d.slideDir ?? -1;
      const dist = W + 0.02;
      const slide: [number, number] = alongX ? [dir * dist, 0] : [0, dir * dist];
      const lf: LeafBuild = {
        pivot: pv,
        slide,
        build: (lb) => {
          const q = (m: THREE.Material, u0: number, u1: number, y0: number, y1: number, w0: number, w1: number): void => put(lb, m, u0, u1, y0, y1, w0, w1);
          q(leafM, d.a - 0.01, d.b + 0.02, 0, H, -0.02, 0.02);
          q(edgeM, d.a - 0.01, d.b + 0.02, 0, 0.18, -0.022, 0.022);
          const wu = dir < 0 ? d.b - 0.35 : d.a + 0.2;
          q(winM, wu, wu + 0.15, 1.15, 1.85, -0.024, 0.024);
          const hu = dir < 0 ? d.b - 0.1 : d.a + 0.04;
          q(handleM, hu, hu + 0.05, 0.85, 1.05, -0.026, 0.026);
        },
      };
      doors.add(d, [lf], radius);
      continue;
    }
    if (isGlassDouble) {
      // 玄関・風除室のガラスの両開き（引き違い）。内は開いたまま、外は鍵
      const half = W / 2;
      const mkLeaf = (u0: number, u1: number, sign: number): LeafBuild => ({
        pivot: alongX ? [0, d.y0, d.line] : [d.line, d.y0, 0],
        slide: alongX ? [sign * (half - 0.15), 0] : [0, sign * (half - 0.15)],
        build: (lb) => {
          const q = (m: THREE.Material, a0: number, a1: number, y0: number, y1: number, w0: number, w1: number): void => put(lb, m, a0, a1, y0, y1, w0, w1);
          q(steelM, u0, u0 + 0.06, 0, H, -0.03, 0.03);
          q(steelM, u1 - 0.06, u1, 0, H, -0.03, 0.03);
          q(steelM, u0, u1, 0, 0.12, -0.03, 0.03);
          q(steelM, u0, u1, H - 0.06, H, -0.03, 0.03);
          q(steelM, u0, u1, 1.0, 1.04, -0.032, 0.032);
          q(handleM, sign < 0 ? u1 - 0.12 : u0 + 0.08, sign < 0 ? u1 - 0.08 : u0 + 0.12, 0.8, 1.25, -0.05, 0.05);
          const broken = d.state === 'locked' && sign > 0;
          if (!broken) {
            const c: V3 = alongX ? [(u0 + u1) / 2, H / 2 + 0.03, 0] : [0, H / 2 + 0.03, (u0 + u1) / 2];
            lb.plane(glass, c, u1 - u0 - 0.12, H - 0.18, alongX ? 'z' : 'x', { shadow: false });
            lb.plane(glass, c, u1 - u0 - 0.12, H - 0.18, alongX ? '-z' : '-x', { shadow: false });
          } else {
            // 割れたガラスの残り
            q(p.solid('#e9eee4', 0.3), u0 + 0.06, u0 + 0.3, H - 0.5, H - 0.06, -0.004, 0.004);
            q(p.solid('#e9eee4', 0.3), u1 - 0.25, u1 - 0.06, 0.12, 0.45, -0.004, 0.004);
          }
        },
      });
      doors.add(d, [mkLeaf(d.a, d.a + half, -1), mkLeaf(d.a + half, d.b, 1)], 0);
      continue;
    }
    // 開き戸: 吊り元 a / b、toward の側へ開く。窓（上半分に小さな縦長）・レバーの取っ手
    const hingeU = d.hinge === 'a' ? d.a : d.b;
    const pv: V3 = alongX ? [hingeU, d.y0, d.line] : [d.line, d.y0, hingeU];
    const uDir: [number, number] = alongX ? [d.hinge === 'a' ? 1 : -1, 0] : [0, d.hinge === 'a' ? 1 : -1];
    const nDir: [number, number] = alongX ? [0, d.toward ?? 1] : [d.toward ?? 1, 0];
    const locked = d.state === 'locked';
    // 鍵の掛かった鉄の扉（外・2 階・物入れ）は参考画像の右の暗い棚と同じ暗い青緑
    const lm = locked ? p.solid('#6f8382', 0.5) : leafM;
    const lf: LeafBuild = {
      pivot: pv,
      swing: swingAngle(uDir, nDir),
      build: (lb) => {
        // 軸からの相対の座標（u は戸先へ向かって正）
        const q = (m: THREE.Material, u0: number, u1: number, y0: number, y1: number, w0: number, w1: number): void => {
          const s = d.hinge === 'a' ? 1 : -1;
          const a0 = s * u0;
          const a1 = s * u1;
          if (alongX) lb.boxMM(m, [Math.min(a0, a1), y0, w0], [Math.max(a0, a1), y1, w1], { shadow: false });
          else lb.boxMM(m, [w0, y0, Math.min(a0, a1)], [w1, y1, Math.max(a0, a1)], { shadow: false });
        };
        q(lm, 0.005, W - 0.005, 0, H - 0.005, -0.022, 0.022);
        q(edgeM, 0.005, W - 0.005, 0, 0.16, -0.024, 0.024);
        if (!locked && d.id !== 'E5' && d.id !== 'pantry') q(winM, W / 2 - 0.12, W / 2 + 0.12, 1.25, 1.85, -0.025, 0.025);
        if (locked && d.id !== 'closet') {
          // 鉄の扉: 網入りガラスの小窓（外・廊下の明るさ）と、下の蹴り板・上の銘板
          q(edgeM, W / 2 - 0.16, W / 2 + 0.16, 1.3, 1.82, -0.026, 0.026);
          q(winM, W / 2 - 0.13, W / 2 + 0.13, 1.33, 1.79, -0.028, 0.028);
          // 網入りガラスの網（細い格子）と、内側（部屋の側）のドアクローザー
          const wire = p.solid('#b8c3bb', 0.3);
          for (const du of [-0.045, 0.045]) q(wire, W / 2 + du - 0.004, W / 2 + du + 0.004, 1.33, 1.79, -0.03, 0.03);
          for (const dy of [1.45, 1.56, 1.67]) q(wire, W / 2 - 0.13, W / 2 + 0.13, dy - 0.004, dy + 0.004, -0.03, 0.03);
          const room0 = ROOMS.find((x) => x.id === d.rooms[0]);
          const sgn = room0 ? Math.sign((alongX ? (room0.rect[1] + room0.rect[3]) / 2 : (room0.rect[0] + room0.rect[2]) / 2) - d.line) || 1 : 1;
          const cw = (a0: number, a1: number): [number, number] => (sgn > 0 ? [a0, a1] : [-a1, -a0]);
          q(handleM, 0.08, 0.42, H - 0.13, H - 0.05, ...cw(0.022, 0.075));
          q(steelM, 0.38, 0.62, H - 0.09, H - 0.07, ...cw(0.075, 0.085));
          q(p.solid('#565d60', 0.5), 0.06, W - 0.06, 0.04, 0.26, -0.026, 0.026);
          q(plateM, W / 2 - 0.1, W / 2 + 0.1, 1.86, 1.91, -0.026, 0.026);
        }
        q(handleM, W - 0.1, W - 0.06, 0.95, 1.08, -0.06, 0.06);
        q(handleM, W - 0.2, W - 0.06, 1.0, 1.03, -0.075, 0.075);
        if (locked) q(handleM, W - 0.095, W - 0.065, 1.18, 1.24, -0.03, 0.03);
      },
    };
    doors.add(d, [lf], radius);
  }
}

/** 外の色（雪・空）。窓の外 */
export function snowSurface(p: Paints): THREE.Material {
  return p.get('outsideSnow', () => ({
    color: { py: '#eef1e6', px: '#e3e8dc', nx: '#e3e8dc', pz: '#e6ebdf', nz: '#dfe5d9' },
    layers: [
      { color: '#dfe6dc', scale: 0.6, threshold: 0.62, stretch: [0.35, 2.0], detail: 0.5, only: 'floor', seed: 51 },
      { color: '#f7f9f0', scale: 0.9, threshold: 0.6, detail: 0.4, only: 'floor', seed: 52 },
    ],
  }));
}

export const tone = (c: string, l: number): string => hex(shiftColor(c, [l, 1, 0]));
export { faces };
export type { Rect };
