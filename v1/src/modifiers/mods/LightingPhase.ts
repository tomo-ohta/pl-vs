/**
 * LightingPhase — 照明の相（U01 seedPhase / R02 unpowered / E04 daylight / L10 allWindowsLit / M14 singleLight）。
 * params: mode（'seedPhase' | 'unpowered' | 'daylight' | 'allWindowsLit' | 'singleLight'）。
 *
 * すべてのジオメトリ変更は layout フックで完結する（決定論。乱数は渡された rng のみ）。
 *   seedPhase     区画（footprint の矩形を 6 m 前後に割った帯）ごとに 緑 / 白 / 黄 の色相を抽選し、天井パネルの MatId
 *                 （lightGreen / palette.light / lightYellow）と LightSpec.color を差し替える。焼き込み（SurfaceLighting）は MatId の色を拾うので自動追従。
 *   unpowered     L.lights を空にし天井パネルを全て lightOff。棚の陳列箱の一部を screenGlow（青白発光の筐体）にして 4〜6 台に青い点光源。
 *                 lighting.areaEmitters=true で筐体の発光を壁・床へ焼き込む。palette.ambient を 0x202428 へ。
 *   daylight      FakeSky と併用（E04。rooms.json の順で FakeSky → LightingPhase）。日射を低く暖色にし、ambient を昼光色へ。残った天井パネルは lightOff、中央 1 灯のみ。
 *   allWindowsLit 既存の窓箱（windowDark。StreetGenerator 実装後）があれば windowLit に点灯。無ければ壁面に等間隔の発光窓帯（簡易版）。
 *                 天井灯は消し、点光源はナトリウム色に。lighting.areaEmitters=true。
 *   singleLight   照明を中央 1 灯だけ残す（可視の器具箱 1.2×0.3 + 吊り金物）。他のパネルは lightOff、ambient は 0x000000。
 *
 * build フック（seedPhase かつ tier.flicker のときだけ）: 発光パネルの結合メッシュの材質を部屋専用に複製し、RoomEffect で emissiveIntensity と
 * PointLight の baseIntensity（LightBudget が毎フレーム intensity をこれへ寄せる）を色相グループごとの位相で ±15 % 揺らす。ジオメトリは触らない。
 */
import * as THREE from 'three';
import type { Dir, Socket, Vec3 } from '../../core/types';
import { dirVec } from '../../core/types';
import { box, WALL_T, type Box, type LightSpec, type MatId, type RoomLayout } from '../../generators/layout';
import { wallSpans, type Rect } from '../../generators/footprint';
import type { Rng } from '../../core/rng';
import type { ModifierImpl } from '../types';
import type { RoomEffect } from '../../render/RoomBuilder';
import { str } from '../util';

type Mode = 'seedPhase' | 'unpowered' | 'daylight' | 'allWindowsLit' | 'singleLight';

/** 天井パネル灯として扱う MatId（薄い非ソリッド箱） */
const PANEL_MATS: ReadonlySet<string> = new Set(['lightPanel', 'lightWarm', 'lightOff', 'lightGreen', 'lightYellow', 'ledBlue']);
/** unpowered で画面発光にする筐体の上限 */
const MAX_SCREENS = 12;
/** 発光している（消灯でない）パネル */
const LIT_PANEL_MATS: ReadonlySet<string> = new Set(['lightPanel', 'lightWarm', 'lightGreen', 'lightYellow', 'ledBlue']);

/** seedPhase の色相。mat は差し替える MatId（white は palette.light）、color は LightSpec.color */
const PHASES: { key: 'green' | 'white' | 'yellow'; mat: MatId | null; color: number }[] = [ // 型は下の Phase と同じ
  { key: 'green', mat: 'lightGreen', color: 0xc8f0c0 },
  { key: 'white', mat: null, color: 0xe9f0ff },
  { key: 'yellow', mat: 'lightYellow', color: 0xf6e6a0 },
];

const SCREEN_COLOR = 0x9fd0ff;
const SODIUM_COLOR = 0xffa040;

function modeOf(v: unknown): Mode {
  const s = str(v, 'seedPhase');
  return (['seedPhase', 'unpowered', 'daylight', 'allWindowsLit', 'singleLight'] as Mode[]).includes(s as Mode) ? (s as Mode) : 'seedPhase';
}

function center(b: Box): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

/** 天井付近の薄い発光パネル（lightGrid / Atrium の天窓帯 / Adapter の天井灯） */
function isCeilingPanel(b: Box, h: number): boolean {
  return !b.solid && PANEL_MATS.has(b.mat) && b.max[1] - b.min[1] < 0.12 && b.max[1] > h - 0.3;
}

function interiorStart(L: RoomLayout): number {
  return L.shellCount ?? 0;
}

function largestRect(L: RoomLayout): Rect | null {
  let best: Rect | null = null;
  let area = -1;
  for (const r of L.footprint) {
    const a = (r.x1 - r.x0) * (r.z1 - r.z0);
    if (a > area) { area = a; best = r; }
  }
  return best;
}

/** シェルに天井があるか（Bridge は無い） */
function hasCeiling(L: RoomLayout): boolean {
  const n = interiorStart(L);
  for (let i = 0; i < n; i++) {
    const b = L.boxes[i];
    if (b.solid && b.min[1] >= L.height - 0.01 && b.max[1] <= L.height + 0.3) return true;
  }
  return false;
}

/** ソケットの近く（壁沿いの座標 t が幅 + margin 以内）か */
function nearSocket(sockets: Socket[], dir: Dir, coord: number, t: number, margin: number): boolean {
  return sockets.some((s) => s.type !== 'hole' && s.dir === dir
    && Math.abs((dir === 0 || dir === 2 ? s.pos[2] : s.pos[0]) - coord) < 0.06
    && Math.abs((dir === 0 || dir === 2 ? s.pos[0] : s.pos[2]) - t) < s.width / 2 + margin);
}

/** 壁の内面に貼る薄板（dir は壁の外向き、coord は外面の座標）。inset は内面からの距離、thick は板厚 */
function innerFaceBox(dir: Dir, coord: number, t0: number, t1: number, y0: number, y1: number, mat: MatId, inset = 0.005, thick = 0.03): Box {
  switch (dir) {
    case 0: return box([t0, y0, coord - WALL_T - inset - thick], [t1, y1, coord - WALL_T - inset], mat, false);
    case 2: return box([t0, y0, coord + WALL_T + inset], [t1, y1, coord + WALL_T + inset + thick], mat, false);
    case 1: return box([coord - WALL_T - inset - thick, y0, t0], [coord - WALL_T - inset, y1, t1], mat, false);
    default: return box([coord + WALL_T + inset, y0, t0], [coord + WALL_T + inset + thick, y1, t1], mat, false);
  }
}

function overlaps(a: Box, b: Box, pad = 0): boolean {
  return a.min[0] < b.max[0] + pad && a.max[0] > b.min[0] - pad && a.min[1] < b.max[1] + pad && a.max[1] > b.min[1] - pad && a.min[2] < b.max[2] + pad && a.max[2] > b.min[2] - pad;
}

// ---------------------------------------------------------------- seedPhase

type Phase = { key: 'green' | 'white' | 'yellow'; mat: MatId | null; color: number };
interface Segment { rect: Rect; phase: Phase }

/** footprint の矩形を長辺方向に 6 m 前後の帯へ割り、帯ごとに色相を抽選する（隣り合う帯は同じ色相を避ける） */
function planSegments(L: RoomLayout, rng: Rng): Segment[] {
  const out: Segment[] = [];
  let prev: Phase | null = null;
  for (const r of L.footprint) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const alongZ = d >= w;
    const len = alongZ ? d : w;
    const n = Math.max(1, Math.round(len / 6));
    for (let i = 0; i < n; i++) {
      const a0 = (alongZ ? r.z0 : r.x0) + (len * i) / n;
      const a1 = (alongZ ? r.z0 : r.x0) + (len * (i + 1)) / n;
      const rect: Rect = alongZ ? { x0: r.x0, z0: a0, x1: r.x1, z1: a1 } : { x0: a0, z0: r.z0, x1: a1, z1: r.z1 };
      const candidates: Phase[] = prev ? PHASES.filter((p) => p !== prev) : PHASES;
      const phase: Phase = rng.pick(candidates);
      out.push({ rect, phase });
      prev = phase;
    }
  }
  return out;
}

function segmentAt(segs: Segment[], x: number, z: number): Segment | null {
  let best: Segment | null = null;
  let bestD = Infinity;
  for (const s of segs) {
    const r = s.rect;
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dz = Math.max(r.z0 - z, 0, z - r.z1);
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function applySeedPhase(L: RoomLayout, rng: Rng): void {
  const segs = planSegments(L, rng);
  if (!segs.length) return;
  const h = L.height;
  const base = L.palette.light;
  for (let i = interiorStart(L); i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!isCeilingPanel(b, h) || !LIT_PANEL_MATS.has(b.mat)) continue;
    const c = center(b);
    const seg = segmentAt(segs, c[0], c[2]);
    if (!seg) continue;
    L.boxes[i] = { ...b, mat: seg.phase.mat ?? base };
  }
  for (const l of L.lights) {
    const seg = segmentAt(segs, l.pos[0], l.pos[2]);
    if (seg) l.color = seg.phase.color;
  }
}

// ---------------------------------------------------------------- unpowered

function applyUnpowered(L: RoomLayout, rng: Rng): void {
  const h = L.height;
  const start = interiorStart(L);
  L.lights = [];
  // 一般照明は全消灯
  for (let i = start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (isCeilingPanel(b, h) || (!b.solid && LIT_PANEL_MATS.has(b.mat) && b.max[1] - b.min[1] < 0.12)) L.boxes[i] = { ...b, mat: 'lightOff' };
  }
  // 筐体候補: 棚の陳列箱（非ソリッドの小さな箱）
  const candidates: number[] = [];
  for (let i = start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.solid) continue;
    if (b.mat !== 'furnitureLight' && b.mat !== 'boxCardboard' && b.mat !== 'ledBlue' && b.mat !== 'furnitureDark') continue;
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    if (sy < 0.3 || sy > 1.2 || Math.max(sx, sz) > 1.6 || Math.min(sx, sz) < 0.2) continue;
    candidates.push(i);
  }
  const screens: number[] = [];
  if (candidates.length >= 4) {
    // 4 割ほどを稼働中の筐体（画面発光）に。ただし上限 MAX_SCREENS 台（R02 で 103 台になり emissive の焼き込みで部屋全体が明るくなった）
    for (const i of candidates) {
      if (screens.length >= MAX_SCREENS) break;
      if (!rng.chance(0.4)) continue;
      L.boxes[i] = { ...L.boxes[i], mat: 'screenGlow' };
      screens.push(i);
    }
    if (screens.length < 4) {
      for (const i of rng.shuffle(candidates.filter((i) => !screens.includes(i))).slice(0, 4 - screens.length)) {
        L.boxes[i] = { ...L.boxes[i], mat: 'screenGlow' };
        screens.push(i);
      }
    }
  } else {
    // 棚が無い（代替部屋など）: 壁沿いに筐体を置く
    screens.push(...placeCabinets(L, rng, 6));
  }
  // 4〜6 台に青い点光源
  const count = Math.min(screens.length, rng.int(4, 6));
  const picked = rng.shuffle([...screens]).slice(0, count);
  for (const i of picked) {
    const c = center(L.boxes[i]);
    L.lights.push({ pos: [c[0], Math.max(c[1], 1.2), c[2]], color: SCREEN_COLOR, intensity: 0.55, distance: 5 });
  }
  L.lighting = { ...(L.lighting ?? {}), areaEmitters: true };
  L.palette.ambient = 0x202428;
  L.palette.light = 'lightOff';
  L.palette.lightColor = SCREEN_COLOR;
}

/** 壁沿いに筐体（ソリッドの箱 + 前面の画面）を置く。扉付近・既存のソリッド箱を避ける。戻り値は画面箱のインデックス */
function placeCabinets(L: RoomLayout, rng: Rng, max: number): number[] {
  const out: number[] = [];
  const start = interiorStart(L);
  const solids = L.boxes.slice(start).filter((b) => b.solid);
  const spans = rng.shuffle(wallSpans(L.footprint).filter((s) => s.a1 - s.a0 >= 3));
  for (const sp of spans) {
    if (out.length >= max) break;
    const d = sp.edge.dir;
    const coord = sp.edge.coord;
    for (let t = sp.a0 + 1.4; t + 0.9 < sp.a1 - 0.6 && out.length < max; t += 3.2) {
      if (nearSocket(L.sockets, d, coord, t + 0.45, 1.6)) continue;
      // 本体 0.9 幅 × 1.9 高 × 0.75 奥行（壁の内面に接する）
      const body = innerFaceBox(d, coord, t, t + 0.9, 0, 1.9, 'furnitureDark', 0.0, 0.75);
      body.solid = true;
      if (solids.some((s) => overlaps(s, body, 0.3))) continue;
      // 画面（本体の前面。壁から 0.75 離れた面）
      const screen = innerFaceBox(d, coord, t + 0.12, t + 0.78, 1.0, 1.55, 'screenGlow', 0.75, 0.02);
      L.boxes.push(body);
      L.boxes.push(screen);
      solids.push(body);
      out.push(L.boxes.length - 1);
    }
  }
  return out;
}

// ---------------------------------------------------------------- daylight

/** 太陽の方位（進行用出口の外向き。無ければ rng） */
function sunAzimuth(L: RoomLayout, rng: Rng): [number, number] {
  const exit = L.sockets.find((s) => s.id !== 'entry' && s.type !== 'hole');
  if (exit) {
    const v = dirVec(exit.dir);
    return [v[0], v[2]];
  }
  const a = rng.float(0, Math.PI * 2);
  return [Math.cos(a), Math.sin(a)];
}

function applyDaylight(L: RoomLayout, rng: Rng): void {
  const h = L.height;
  const warm = 0xffe2b8;
  for (let i = interiorStart(L); i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (isCeilingPanel(b, h)) L.boxes[i] = { ...b, mat: 'lightOff' };
  }
  const bx = L.bounds;
  const cx = (bx.min[0] + bx.max[0]) / 2;
  const cz = (bx.min[2] + bx.max[2]) / 2;
  const span = Math.max(bx.max[0] - bx.min[0], bx.max[2] - bx.min[2]);
  L.lights = [{ pos: [cx, h - 0.6, cz], color: 0xfff4dc, intensity: 1.2, distance: span }];
  // 低い（高度 30°）暖色の日射。FakeSky の directional があれば方位を引き継いで低く・暖かくする
  const alt = (30 * Math.PI) / 180;
  const prev = L.lighting?.directional?.[0];
  let ax: number;
  let az: number;
  if (prev) {
    const n = Math.hypot(prev.dir[0], prev.dir[2]) || 1;
    ax = -prev.dir[0] / n;
    az = -prev.dir[2] / n;
  } else {
    [ax, az] = sunAzimuth(L, rng);
  }
  const dir: Vec3 = [-ax * Math.cos(alt), -Math.sin(alt), -az * Math.cos(alt)];
  L.lighting = {
    ...(L.lighting ?? {}),
    directional: [{ dir, color: warm, intensity: Math.max(prev?.intensity ?? 0, 0.9) }],
    skyAmbient: L.lighting?.skyAmbient ?? { color: 0xfff0d8, intensity: 0.35 },
  };
  L.palette.light = 'lightOff';
  L.palette.lightColor = 0xfff4dc;
  L.palette.ambient = 0xb8c4d8;
}

// ---------------------------------------------------------------- allWindowsLit

function applyAllWindowsLit(L: RoomLayout, rng: Rng): void {
  const h = L.height;
  const start = interiorStart(L);
  // 既存の窓箱（StreetGenerator）があれば点灯
  let lit = 0;
  for (let i = start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.mat === 'windowDark') { L.boxes[i] = { ...b, mat: 'windowLit' }; lit++; }
    else if (b.mat === 'windowLit') lit++;
  }
  if (lit === 0) {
    // 簡易版: 壁の内面に等間隔の発光窓帯（高い部屋は 2 段）
    const rows: [number, number][] = h >= 4.6 ? [[1.0, 2.1], [3.1, 4.2]] : [[1.0, Math.min(2.1, h - 0.5)]];
    const spacing = 2.6;
    const max = 80;
    const spans = wallSpans(L.footprint).filter((s) => s.a1 - s.a0 >= 2.5);
    for (const sp of spans) {
      if (lit >= max) break;
      const d = sp.edge.dir;
      const coord = sp.edge.coord;
      const offset = rng.float(0.6, 1.4);
      for (let t = sp.a0 + offset; t + 0.9 < sp.a1 - 0.4 && lit < max; t += spacing) {
        if (nearSocket(L.sockets, d, coord, t + 0.45, 1.3)) continue;
        // 全戸点灯だが、ごく一部はカーテン越し（暗い窓）で単調さを避ける
        const mat: MatId = rng.chance(0.9) ? 'windowLit' : 'windowDark';
        for (const [y0, y1] of rows) {
          L.boxes.push(innerFaceBox(d, coord, t, t + 0.9, y0, y1, mat));
          // 桟（十字の窓枠）
          L.boxes.push(innerFaceBox(d, coord, t + 0.43, t + 0.47, y0, y1, 'furnitureDark', 0.002, 0.04));
          L.boxes.push(innerFaceBox(d, coord, t, t + 0.9, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, 'furnitureDark', 0.002, 0.04));
          if (mat === 'windowLit') lit++;
        }
      }
    }
  }
  // 夜: 天井灯は消し、点光源は街灯色に間引く
  for (let i = start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (isCeilingPanel(b, h)) L.boxes[i] = { ...b, mat: 'lightOff' };
  }
  L.lights = L.lights.filter((_, i) => i % 2 === 0).map((l): LightSpec => ({ ...l, color: SODIUM_COLOR, intensity: Math.min(l.intensity, 0.6) }));
  L.lighting = { ...(L.lighting ?? {}), areaEmitters: true };
  L.palette.light = 'lightOff';
  L.palette.lightColor = SODIUM_COLOR;
  L.palette.ambient = 0x2a2c38;
}

// ---------------------------------------------------------------- singleLight

function applySingleLight(L: RoomLayout): void {
  const h = L.height;
  const start = interiorStart(L);
  for (let i = start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!b.solid && LIT_PANEL_MATS.has(b.mat) && b.max[1] - b.min[1] < 0.12) L.boxes[i] = { ...b, mat: 'lightOff' };
  }
  const r = largestRect(L);
  if (!r) return;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const alongX = r.x1 - r.x0 > r.z1 - r.z0;
  // 器具: 1.2 × 0.3 の蛍光灯 + 金物の筐体 + 吊り棒（天井が無ければ闇へ伸びる）
  const yPanel = Math.min(h, 3.0) - 0.55;
  const hw = alongX ? 0.6 : 0.15;
  const hd = alongX ? 0.15 : 0.6;
  L.boxes.push(box([cx - hw, yPanel, cz - hd], [cx + hw, yPanel + 0.035, cz + hd], 'lightPanel', false));
  L.boxes.push(box([cx - hw - 0.03, yPanel + 0.035, cz - hd - 0.03], [cx + hw + 0.03, yPanel + 0.11, cz + hd + 0.03], 'metal', false));
  // 天井が無い（Bridge）ときは上階の床（3.4 m）に届かない高さまで吊り棒を伸ばす
  const yTop = hasCeiling(L) ? h : Math.min(h + 2.5, 3.35);
  for (const s of [-0.45, 0.45]) {
    const px = alongX ? cx + s : cx;
    const pz = alongX ? cz : cz + s;
    L.boxes.push(box([px - 0.02, yPanel + 0.11, pz - 0.02], [px + 0.02, yTop, pz + 0.02], 'metal', false));
  }
  L.lights = [{ pos: [cx, yPanel - 0.3, cz], color: 0xdde6f4, intensity: 1.1, distance: 16 }];
  L.palette.ambient = 0x000000;
  L.palette.light = 'lightOff';
  L.palette.lightColor = 0xdde6f4;
}

// ---------------------------------------------------------------- build（明滅）

/** 部屋専用の材質複製（共有材質・variant を汚さない）。onBeforeCompile / customProgramCacheKey は clone() が写さないので付け直す */
function cloneMaterial(src: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const m = src.clone();
  m.onBeforeCompile = src.onBeforeCompile;
  m.customProgramCacheKey = src.customProgramCacheKey;
  return m;
}

function matIdOf(m: THREE.Material): string {
  return (m.name || '').split('|')[0];
}

interface FlickerGroup {
  materials: { m: THREE.MeshStandardMaterial; base: number }[];
  lights: THREE.PointLight[];
  period: number;
  phase: number;
  /** 稀な瞬断の残り時間 */
  dropout: number;
}

function buildFlicker(built: import('../../render/RoomBuilder').BuiltRoom, rng: Rng): RoomEffect | null {
  const groups = new Map<string, FlickerGroup>();
  const groupFor = (key: string): FlickerGroup => {
    let g = groups.get(key);
    if (!g) {
      g = { materials: [], lights: [], period: rng.float(0.8, 2.4), phase: rng.float(0, Math.PI * 2), dropout: 0 };
      groups.set(key, g);
    }
    return g;
  };
  built.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
    const mat = o.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;
    const id = matIdOf(mat);
    if (!LIT_PANEL_MATS.has(id)) return;
    const own = cloneMaterial(mat);
    o.material = own;
    const d = (o.userData.disposable as (THREE.Texture | THREE.Material)[] | undefined) ?? [];
    d.push(own);
    o.userData.disposable = d;
    groupFor(id).materials.push({ m: own, base: own.emissiveIntensity });
  });
  // 点光源は色で色相グループへ（layout で同じ表から色を付けている）
  const byColor = new Map<number, string>();
  for (const p of PHASES) byColor.set(p.color, p.mat ?? 'lightPanel');
  for (const l of built.lights) {
    if (!(l instanceof THREE.PointLight)) continue;
    const key = byColor.get(l.color.getHex()) ?? 'lightPanel';
    if (!groups.has(key)) continue;
    l.userData.lpBase = l.userData.baseIntensity;
    groups.get(key)!.lights.push(l);
  }
  if (!groups.size) return null;
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const g of groups.values()) {
        const w = (Math.PI * 2 * t) / g.period + g.phase;
        // 主波 + 速い副波。振幅 ±15 %
        let k = 1 + 0.15 * (0.7 * Math.sin(w) + 0.3 * Math.sin(w * 3.7 + 1.3));
        if (g.dropout > 0) { g.dropout -= dt; k *= 0.35; }
        else if (Math.random() < dt * 0.06) g.dropout = 0.05 + Math.random() * 0.08;
        for (const { m, base } of g.materials) m.emissiveIntensity = base * k;
        for (const l of g.lights) l.userData.baseIntensity = Number(l.userData.lpBase ?? 0) * k;
      }
    },
    dispose() {
      for (const g of groups.values()) for (const l of g.lights) if (l.userData.lpBase !== undefined) l.userData.baseIntensity = l.userData.lpBase;
      groups.clear();
    },
  };
}

// ---------------------------------------------------------------- Modifier

const LightingPhase: ModifierImpl = {
  id: 'LightingPhase',
  defaults: { mode: 'seedPhase' },
  layout(L, _p, params, rng) {
    switch (modeOf(params.mode)) {
      case 'seedPhase': applySeedPhase(L, rng); break;
      case 'unpowered': applyUnpowered(L, rng); break;
      case 'daylight': applyDaylight(L, rng); break;
      case 'allWindowsLit': applyAllWindowsLit(L, rng); break;
      case 'singleLight': applySingleLight(L); break;
    }
  },
  build(built, _L, ctx) {
    if (modeOf(ctx.params.mode) !== 'seedPhase' || !ctx.tier.flicker) return;
    const fx = buildFlicker(built, ctx.rng);
    if (fx) built.effects.push(fx);
  },
};

export default LightingPhase;
