import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import { buildFacade, evenMull, type FacadeMats, type Opening, type Pier } from './facade.ts';
import { LocalFrame } from './frame.ts';
import { createGlass, GLASS_MODE, ROOM, type GlassOptions } from './glass.ts';
import { BACKDOOR, EAST, roofAt, W_CORR, W_ROOM, WBAY, WEST, wpos, type WingFrame } from './layout.ts';
import { facadeMat, type FaceSet, type SunMask } from './mats.ts';
import { extendWallSun, wallSun } from './sun.ts';
import { streakMat } from './dress.ts';
import type { FacadePaint } from './reflect.ts';
import type { Doors } from './doors.ts';
import { createPaint } from '../../render/PaintMaterial.ts';

/**
 * 西棟・東棟の外壁（通路側・南と北の端・裏）。窓の並びは参考画像から測った値（docs と plan.ts の notes）。
 * - 西棟: 1 階は柱型の間（4.1 m おき）に 3 段の大きな鉄の窓（0.15〜3.05 m）、2 階より上は横に続く窓（桟 0.71 m おき、2.84 m ごとに太い方立て）
 * - 東棟: 柱型 4.5 m おき。1 階（半地下）は通路の高さから 2.17 m まで、2 階より上は床から 0.7〜2.1 m の窓
 * 窓の奥はどちらも廊下（廊下側どうしが向き合う）。
 */

const T = 0.3; // 外壁の厚さ

/** 日なたの色（参考画像の東棟の北の日なたの壁と同じ。開けた所の日の当たる壁に使う） */
const SUN_COLORS = {
  wall: { front: '#5f9790', side: '#386b6f', top: '#5f9790', bottom: '#27535c' },
  pier: { front: '#5f9790', side: '#386b6f', top: '#5f9790' },
  frame: { front: '#386b6f', side: '#5f9790', top: '#5f9790' },
  sill: { front: '#5f9790', top: '#b9e8d2', side: '#386b6f' },
};
const GW = -0.07; // ガラスの面（鉄の窓は外壁の面に近い）

/** 壁の座標系の材質一式 */
function mats(fr: LocalFrame, c: { wall: FaceSet; wallHi?: FaceSet; grad?: [number, number]; pier: FaceSet; pierHi?: FaceSet; pierGrad?: [number, number]; frameHi?: FaceSet; frame: FaceSet; sill: FaceSet; sun?: { wall: FaceSet; pier: FaceSet; frame: FaceSet; sill: FaceSet; mask: SunMask; edge?: number; edgeU?: number }; panels?: boolean }, glass: GlassOptions, glassColors = {}): FacadeMats {
  const sm = c.sun?.mask;
  const e = { sunEdge: c.sun?.edge, sunEdgeU: c.sun?.edgeU };
  // 写っていない面の壁: 打ち放しの型枠の目地（1.8 × 0.9 m）と板ごとの塗りのむら
  const panels = c.panels ? { grid: { size: [1.8, 0.9] as [number, number], width: 0.014, faces: [0], jitter: 0.07, mul: 0.8 } } : {};
  return {
    wall: facadeMat(fr, { colors: c.wall, hi: c.wallHi, grad: c.grad, sun: c.sun?.wall, sunMask: sm, ...e, ...panels }),
    pier: facadeMat(fr, { colors: c.pier, hi: c.pierHi, grad: c.pierGrad, sun: c.sun?.pier, sunMask: sm, ...e }),
    frame: facadeMat(fr, { colors: c.frame, hi: c.frameHi, grad: c.grad, sun: c.sun?.frame, sunMask: sm, ...e }),
    sill: facadeMat(fr, { colors: c.sill, sun: c.sun?.sill, sunMask: sm, ...e }),
    coping: facadeMat(fr, { colors: { front: '#1a363d', top: '#2a5257', side: '#16303a', bottom: '#0f2229' } }),
    glass: createGlass(fr, glass, glassColors),
    glassClear: createGlass(fr, glass, glassColors),
  };
}

/** 端の壁の座標系（外向き normal・壁に沿った tangent・原点） */
function endFrame(origin: [number, number], tangent: [number, number], normal: [number, number]): LocalFrame {
  return new LocalFrame({ origin, tangent, normal } as WingFrame);
}

// ================================================================ 西棟
export interface WingResult {
  lane: LocalFrame;
  doorHoles: Opening[];
}

export function buildWest(b: Builder, paint: FacadePaint, doors: Doors): WingResult {
  const fr = new LocalFrame(WEST);
  const top = (u: number): number => roofAt(WEST, u);
  const fl = WEST.fl;
  const op: Opening[] = [];
  const piers: Pier[] = [];
  // ---- 1 階: 柱型の間に 3 段の窓 ----
  const p0 = WBAY.u0 - Math.ceil((WBAY.u0 - WEST.u0) / WBAY.w) * WBAY.w;
  const pu: number[] = [];
  for (let u = p0; u <= WEST.u1 + 0.01; u += WBAY.w) pu.push(u);
  for (const u of pu) if (u > WEST.u0 + 0.2 && u < WEST.u1 - 0.2) piers.push({ u, width: 0.3, out: 0.03, y0: -0.3, y1: 3.1 });
  const corrRoom = (u0: number, u1: number, f: number, mode: number, seed: number): Pick<Opening, 'cell' | 'room'> => ({
    cell: [u0, u1, fl[f], f === 0 ? 3.3 : fl[f] + 3.95],
    room: [2.7, ROOM.corridor, seed, mode],
  });
  for (let i = 0; i < pu.length; i++) {
    const a = Math.max(WEST.u0 + 0.4, (pu[i - 1] ?? WEST.u0) + 0.15);
    const c = Math.min(WEST.u1 - 0.4, pu[i] - 0.15);
    if (c - a < 1) continue;
    const inCorr = a >= W_CORR.u[0] - 0.01 && c <= W_CORR.u[1] + 0.01;
    const mode = inCorr ? GLASS_MODE.clear : GLASS_MODE.mapped;
    const stair = c < WEST.u0 + 5 || a > 30;
    const rm = corrRoom(Math.max(WEST.u0, a - 6), Math.min(WEST.u1, c + 6), 0, mode, 3 + i);
    if (a < BACKDOOR.u[1] && c > BACKDOOR.u[0]) {
      // 裏口の柱間: 扉と、その横の窓
      op.push({ u0: BACKDOOR.u[0], u1: BACKDOOR.u[1], y0: 0.0, y1: 2.35, kind: 'door' });
      const w0 = BACKDOOR.u[1] + 0.18;
      op.push({ u0: w0, u1: c, y0: 0.15, y1: 3.05, mull: evenMull(w0, c, 4), trans: [1.33, 2.43], ...rm });
      continue;
    }
    op.push({
      u0: a,
      u1: c,
      y0: 0.15,
      y1: 3.05,
      mull: evenMull(a, c, 5),
      trans: [1.33, 2.43],
      ...(stair ? { cell: [a, c, 0, 4.2] as [number, number, number, number], room: [3.5, ROOM.stair, 9 + i, GLASS_MODE.frosted] as [number, number, number, number] } : rm),
    });
  }
  // ---- 2 階より上: 横に続く窓（2.84 m ごとに方立て、0.71 m ごとに桟） ----
  const M = 0.71;
  const P = 10.77;
  for (let f = 1; f < fl.length; f++) {
    const y0 = fl[f] + 1.2;
    const y1 = fl[f] + 3.9;
    for (let u = P - Math.ceil((P - WEST.u0) / (4 * M)) * 4 * M; u < WEST.u1; u += 4 * M) {
      const a = Math.max(WEST.u0 + 0.5, u + 0.08);
      const c = Math.min(WEST.u1 - 0.5, u + 4 * M - 0.08);
      if (c - a < 0.8) continue;
      const mull = [u + M, u + 2 * M, u + 3 * M].filter((x) => x > a + 0.1 && x < c - 0.1);
      const stair = a < WEST.u0 + 4.5 || (a > 26 && a < 30.2);
      op.push({
        u0: a,
        u1: c,
        y0,
        y1,
        mull,
        heavy: [],
        ...(stair ? { cell: [a, c, fl[f], fl[f] + 3.3] as [number, number, number, number], room: [3.5, ROOM.stair, 20 + f, GLASS_MODE.frosted] as [number, number, number, number] } : corrRoom(a - 4, c + 4, f, GLASS_MODE.mapped, f * 13 + Math.floor(u))),
      });
    }
  }
  const glassBase: GlassOptions = {
    glassW: GW,
    paint: { ...paint, depth: 7 },
    opposite: { w: 8, top: 17, base: -0.9, pitch: 3.4, sill: 0.7, head: 3.1, treeTop: 9, trees: 0.5 },
    k0: 0.22,
  };
  const m = mats(
    fr,
    {
      wall: { front: '#152e35', side: '#11272d', top: '#1e3d44', bottom: '#0d1f25', back: '#1f3d44' },
      wallHi: { front: '#18363e', side: '#132b31', top: '#22454c', bottom: '#0f2228', back: '#1f3d44' },
      grad: [4, 9],
      pier: { front: '#0e2026', side: '#0c1c21', top: '#1a363c' },
      frame: { front: '#0c1c22', side: '#15303a', top: '#1d3d44', bottom: '#0e2128' },
      frameHi: { front: '#122a31', side: '#17333a', top: '#1f4047', bottom: '#0f242a' },
      sill: { front: '#14303a', top: '#24474e', side: '#112930', bottom: '#0b1a1f' },
    },
    glassBase,
  );
  (m.glass as THREE.ShaderMaterial).transparent = false;
  const res = buildFacade(b, { fr, u0: WEST.u0, u1: WEST.u1, bottom: -0.3, thick: T, glassW: GW, top, kinks: [WEST.slope.u0], openings: op, piers, collideTo: 4.2, coping: true }, m);

  // ---- 南の端（中庭に面する）・北の端（裏庭に面する）・裏（西） ----
  const D = WEST.depth;
  const nIn: [number, number] = [-WEST.normal[0], -WEST.normal[1]];
  const southO = wpos(WEST, WEST.u0, 0);
  const sFr = endFrame(southO, nIn, [-WEST.tangent[0], -WEST.tangent[1]]);
  const northO = wpos(WEST, WEST.u1, 0);
  const nFr = endFrame(northO, nIn, [WEST.tangent[0], WEST.tangent[1]]);
  const backFr = endFrame(wpos(WEST, 0, -D), [WEST.tangent[0], WEST.tangent[1]], nIn);
  const endMats = (f: LocalFrame, u0: number, u1: number, h: number): FacadeMats =>
    mats(
      f,
      {
        wall: { front: '#183740', side: '#132c33', top: '#21434a', bottom: '#0e2127', back: '#1f3d44' },
        pier: { front: '#13303a', side: '#0f252c', top: '#1c3a41' },
        frame: { front: '#0e2026', side: '#0b1a1f', top: '#183339' },
        sill: { front: '#183740', top: '#2a5056', side: '#132c33' },
        // 開けた所に向いた壁は、日の当たる所だけ日なたの色（光線で調べた形。縁はちぎる）
        sun: { ...SUN_COLORS, mask: wallSun(f, u0 - 0.5, u1 + 0.5, -1, h + 1, 3), edge: 0.3 },
        panels: true,
      },
      { glassW: GW, opposite: { w: 22, top: 15, base: 0, pitch: 3.8, sill: 0.9, head: 2.7, treeTop: 11, trees: 0.8 }, k0: 0.22 },
    );
  // 南の端: 1 階は昇降口（ガラスの戸）、上は階段の窓
  const sOps: Opening[] = [];
  // 昇降口のガラスの戸（両開き 2 組。夜は鍵）
  sOps.push({ u0: 1.2, u1: 4.6, y0: 0.02, y1: 2.6, mull: [2.05, 2.9, 3.75], heavy: [2.9], trans: [2.1], noSill: true, cell: [0, D, 0, 3.6], room: [6, ROOM.office, 2, GLASS_MODE.mapped] });
  sOps.push({ u0: 5.4, u1: 10.3, y0: 0.9, y1: 3.0, mull: evenMull(5.4, 10.3, 6), trans: [2.3], cell: [0, D, 0, 3.6], room: [8, ROOM.office, 5, 0] });
  for (let f = 1; f < fl.length; f++) {
    sOps.push({ u0: 1.2, u1: 4.6, y0: fl[f] + 0.9, y1: fl[f] + 3.0, mull: evenMull(1.2, 4.6, 4), trans: [fl[f] + 2.3], cell: [0, D, fl[f], fl[f] + 3.3], room: [3, ROOM.stair, 30 + f, GLASS_MODE.frosted] });
    sOps.push({ u0: 6.4, u1: 10.3, y0: fl[f] + 0.9, y1: fl[f] + 3.0, mull: evenMull(6.4, 10.3, 5), trans: [fl[f] + 2.3], cell: [0, D, fl[f], fl[f] + 3.3], room: [8, ROOM.classroom, 40 + f, 0] });
  }
  const sm = endMats(sFr, 0, D, roofAt(WEST, WEST.u0));
  (sm.glass as THREE.ShaderMaterial).transparent = false;
  buildFacade(b, { fr: sFr, u0: -0.0, u1: D, bottom: -0.3, thick: T, glassW: GW, top: () => roofAt(WEST, WEST.u0), openings: sOps, belts: fl.slice(1), streaks: streakMat(), seed: 1, piers: [{ u: 0.15, width: 0.3, out: 0.12, y0: -0.3 }, { u: D - 0.15, width: 0.3, out: 0.12, y0: -0.3 }], collideTo: 4.2, coping: true }, sm);
  // 昇降口の庇・足ふきマット・傘立て
  const canopy = facadeMat(sFr, { colors: { front: '#21434a', top: '#2a5056', bottom: '#183439', side: '#1c3b41' } });
  sFr.box(b, canopy, [0.7, 2.75, 0], [5.1, 2.95, 1.7]);
  sFr.box(b, createPaint({ color: { py: '#173a3c', side: '#132f31' } }), [1.3, 0, 0.05], [4.5, 0.02, 1.2]);
  sFr.box(b, createPaint({ color: { side: '#2f5a5e', py: '#3a666a' } }), [4.8, 0, 0.1], [5.5, 0.55, 0.45], { collide: true });
  // 北の端（道路斜線で低い）: 1 階は外階段への非常口、窓は階段室
  const hN = roofAt(WEST, WEST.u1);
  const nOps: Opening[] = [];
  nOps.push({ u0: 7.6, u1: 8.6, y0: 0, y1: 2.1, kind: 'door' });
  {
    // 北の非常口（鉄の扉。鍵）
    const leaf = new THREE.Group();
    const m = createPaint({ color: { side: '#1f444c', py: '#2a5056' }, fog: 0.6 });
    leaf.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.05).translate(0.5, 1.05, 0), m));
    leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.02).translate(0.5, 2.3, 0.03), createPaint({ color: '#5fd3a4' })));
    const p = nFr.w(7.6, 0, -0.12);
    doors.add({ leaf, pivot: p, yaw: Math.atan2(-nFr.T.z, nFr.T.x), locked: true });
  }
  nOps.push({ u0: 1.0, u1: 4.2, y0: 0.9, y1: 3.0, mull: evenMull(1.0, 4.2, 4), trans: [2.3], cell: [0, D, 0, 3.6], room: [6, ROOM.storage, 7, 0] });
  nOps.push({ u0: 1.0, u1: 4.2, y0: fl[1] + 0.9, y1: fl[1] + 2.6, mull: evenMull(1.0, 4.2, 4), cell: [0, D, fl[1], fl[1] + 3.3], room: [6, ROOM.office, 8, 0] });
  nOps.push({ u0: 7.4, u1: 8.8, y0: fl[1] + 0.2, y1: fl[1] + 1.4, cell: [0, D, fl[1], fl[1] + 3.3], room: [3, ROOM.stair, 9, GLASS_MODE.frosted] });
  const nm = endMats(nFr, 0, D, hN);
  (nm.glass as THREE.ShaderMaterial).transparent = false;
  buildFacade(b, { fr: nFr, u0: 0, u1: D, bottom: -0.3, thick: T, glassW: GW, top: () => hN, openings: nOps, belts: fl.slice(1), streaks: streakMat(), seed: 2, piers: [{ u: 0.15, width: 0.3, out: 0.12, y0: -0.3 }, { u: D - 0.15, width: 0.3, out: 0.12, y0: -0.3 }], collideTo: 4.2, coping: true }, nm);
  // 裏（西）: 教室の窓（入れる教室はカーテンの掛かった窓）
  const bOps: Opening[] = [];
  for (let f = 0; f < fl.length; f++) {
    for (let u = WBAY.u0 - 6 * WBAY.w; u < WEST.u1 - 1; u += WBAY.w) {
      const a = Math.max(WEST.u0 + 0.6, u + 0.3);
      const c = Math.min(WEST.u1 - 0.6, u + WBAY.w - 0.3);
      if (c - a < 1) continue;
      const y0 = fl[f] + 0.85;
      const y1 = fl[f] + (f === 0 ? 3.0 : 2.9);
      // 入れる教室（1 階・u 9.6〜17.8）の窓は透明（中は本当の形）
      const clear = f === 0 && a >= W_ROOM.u[0] - 0.01 && c <= W_ROOM.u[1] + 0.01;
      bOps.push({ u0: a, u1: c, y0, y1, mull: evenMull(a, c, 4), trans: [y1 - 0.55], cell: [u, u + 8.2, fl[f], fl[f] + 3.2], room: [8, ROOM.classroom, 60 + f * 7 + Math.floor(u), clear ? GLASS_MODE.clear : 0] });
    }
  }
  const bm = endMats(backFr, WEST.u0, WEST.u1, WEST.parapet);
  (bm.glass as THREE.ShaderMaterial).transparent = false;
  buildFacade(b, { fr: backFr, u0: WEST.u0, u1: WEST.u1, bottom: -0.3, thick: T, glassW: GW, top, kinks: [WEST.slope.u0], openings: bOps, belts: fl.slice(1), streaks: streakMat(), seed: 3, collideTo: 4.2, coping: true }, bm);
  // 屋根（平らな所と斜めの所）
  roofSlab(b, fr, WEST.u0, WEST.u1, D, WEST.roof, WEST.slope);
  return { lane: fr, doorHoles: res.holes.filter((h) => h.kind === 'door') };
}

// ================================================================ 東棟
export function buildEast(b: Builder, paint: FacadePaint, sun: SunMask): WingResult {
  const fr = new LocalFrame(EAST);
  const top = (u: number): number => roofAt(EAST, u);
  const fl = EAST.fl;
  const op: Opening[] = [];
  const piers: Pier[] = [];
  const BAY = 4.5;
  const P0 = 4.36;
  const pu: number[] = [];
  for (let u = P0 - Math.ceil((P0 - EAST.u0) / BAY) * BAY; u <= EAST.u1 + 0.01; u += BAY) if (u > EAST.u0 + 0.3 && u < EAST.u1 - 0.3) pu.push(u);
  for (const u of pu) piers.push({ u, width: 0.3, out: 0.03, y0: -0.3 });
  const edges = [EAST.u0 + 0.2, ...pu, EAST.u1 - 0.2];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i] + (i === 0 ? 0.25 : 0.15);
    const c = edges[i + 1] - (i === edges.length - 2 ? 0.25 : 0.15);
    if (c - a < 1) continue;
    const n = Math.max(2, Math.round((c - a) / 0.65));
    // 1 階（半地下の廊下。窓は通路の高さから）
    const stair = a < EAST.u0 + 4 || a > 31;
    op.push({ u0: a, u1: c, y0: 0.1, y1: 2.17, mull: evenMull(a, c, n), trans: [1.78], noSill: true, cell: [a - 5, c + 5, fl[0], fl[0] + 3.1], room: stair ? [3.5, ROOM.stair, 70 + i, GLASS_MODE.frosted] : [2.6, ROOM.corridor, 70 + i, 0] });
    for (let f = 1; f < fl.length; f++) {
      const y0 = fl[f] + 0.7;
      const y1 = fl[f] + 3.1;
      op.push({ u0: a, u1: c, y0, y1, mull: evenMull(a, c, n), trans: [fl[f] + 2.1], cell: [a - 5, c + 5, fl[f], fl[f] + 3.15], room: stair ? [3.5, ROOM.stair, 80 + i * 5 + f, GLASS_MODE.frosted] : [2.6, ROOM.corridor, 80 + i * 5 + f, 0] });
    }
  }
  const glassBase: GlassOptions = {
    glassW: GW,
    paint: { ...paint, depth: 7 },
    opposite: { w: 8, top: 19, base: 0.3, pitch: 4.2, sill: 1.2, head: 3.9, treeTop: 9, trees: 0.5 },
    k0: 0.22,
  };
  const m = mats(
    fr,
    {
      wall: { front: '#142c35', side: '#10252c', top: '#1e3d44', bottom: '#0c1d23', back: '#1f3d44' },
      wallHi: { front: '#1c3d44', side: '#163036', top: '#24474e', bottom: '#10242a', back: '#1f3d44' },
      grad: [2.2, 6.2],
      pier: { front: '#0f232a', side: '#0c1d23', top: '#1a363c' },
      pierHi: { front: '#1b3a41', side: '#163038', top: '#22454c' },
      pierGrad: [2.9, 3.5],
      frame: { front: '#0b1a20', side: '#15303a', top: '#1d3d44', bottom: '#0e2128' },
      frameHi: { front: '#17343b', side: '#1b3a41', top: '#22444b', bottom: '#122a30' },
      sill: { front: '#14303a', top: '#24474e', side: '#112930', bottom: '#0b1a1f' },
      sun: {
        wall: { front: '#64a097', side: '#538d88', top: '#7fb3a8', bottom: '#3e6c6e' },
        pier: { front: '#74ada2', side: '#5d9890', top: '#7fb3a8' },
        frame: { front: '#7fb3a8', side: '#64a097', top: '#8fc0ae' },
        sill: { front: '#74ada2', top: '#8fc0ae', side: '#64a097' },
        // 北の方（u ≥ 8）は元の版の手で描いた日なた。通路の口の方（u < 0、参考画像の視点の後ろ）は光線で調べた日なた
        mask: extendWallSun(fr, sun, EAST.u0 - 0.5, 0),
        edge: 0.3,
        edgeU: 0,
      },
    },
    glassBase,
  );
  (m.glass as THREE.ShaderMaterial).transparent = false;
  buildFacade(b, { fr, u0: EAST.u0, u1: EAST.u1, bottom: -0.3, thick: T, glassW: GW, top, kinks: [EAST.slope.u0], openings: op, piers, collideTo: 4.2, coping: true }, m);

  // ---- 南の端（中庭）・裏（東）----
  const D = EAST.depth;
  const sFr = endFrame([EAST.origin[0], -EAST.u0], [1, 0], [0, 1]);
  const backFr = endFrame([EAST.origin[0] + D, 0], [0, -1], [1, 0]);
  const endMats = (f: LocalFrame, u0: number, u1: number, y0: number, h: number): FacadeMats =>
    mats(
      f,
      {
        wall: { front: '#183740', side: '#132c33', top: '#21434a', bottom: '#0e2127', back: '#1f3d44' },
        pier: { front: '#13303a', side: '#0f252c', top: '#1c3a41' },
        frame: { front: '#0e2026', side: '#0b1a1f', top: '#183339' },
        sill: { front: '#183740', top: '#2a5056', side: '#132c33' },
        sun: { ...SUN_COLORS, mask: wallSun(f, u0 - 0.5, u1 + 0.5, y0, h + 1, 3), edge: 0.3 },
        panels: true,
      },
      { glassW: GW, opposite: { w: 22, top: 15, base: 0, pitch: 3.8, sill: 0.9, head: 2.7, treeTop: 11, trees: 0.8 }, k0: 0.22 },
    );
  // 南の端: 各階に外階段への非常口（外階段は south.ts）。1 階は通路より 0.9 m 低い
  const sOps: Opening[] = [];
  for (let f = 1; f < fl.length; f++) sOps.push({ u0: 8.6, u1: 9.6, y0: fl[f], y1: fl[f] + 2.05, kind: 'door' });
  sOps.push({ u0: 8.6, u1: 9.6, y0: 0, y1: fl[0] + 3.0, kind: 'door' });
  for (let f = 0; f < fl.length; f++) {
    const y0 = f === 0 ? 0.4 : fl[f] + 0.8;
    sOps.push({ u0: 1.0, u1: 6.8, y0, y1: fl[f] + 2.2, mull: evenMull(1.0, 6.8, 6), trans: [fl[f] + 1.6], cell: [0, D, fl[f], fl[f] + 2.95], room: [8, ROOM.classroom, 90 + f, 0] });
  }
  const sm = endMats(sFr, 0, D, -1, EAST.parapet);
  (sm.glass as THREE.ShaderMaterial).transparent = false;
  buildFacade(b, { fr: sFr, u0: 0, u1: D, bottom: -1.0, thick: T, glassW: GW, top: () => EAST.parapet, openings: sOps, belts: fl.slice(1), streaks: streakMat(), seed: 4, piers: [{ u: 0.2, width: 0.4, out: 0.15, y0: -1 }, { u: D - 0.2, width: 0.4, out: 0.15, y0: -1 }], collideTo: 4.2, coping: true }, sm);
  // 裏（東・校庭に面する教室の窓）
  const bOps: Opening[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i] + 0.35;
    const c = edges[i + 1] - 0.35;
    if (c - a < 1) continue;
    for (let f = 0; f < fl.length; f++) bOps.push({ u0: a, u1: c, y0: fl[f] + 0.85, y1: fl[f] + 2.75, mull: evenMull(a, c, 4), trans: [fl[f] + 2.2], cell: [a - 4, c + 4, fl[f], fl[f] + 3.0], room: [8, ROOM.classroom, 100 + i * 7 + f, 0] });
  }
  const bm = endMats(backFr, EAST.u0, EAST.u1, -1, EAST.parapet);
  (bm.glass as THREE.ShaderMaterial).transparent = false;
  buildFacade(b, { fr: backFr, u0: EAST.u0, u1: EAST.u1, bottom: -1.0, thick: T, glassW: GW, top, kinks: [EAST.slope.u0], openings: bOps, belts: fl.slice(1), streaks: streakMat(), seed: 5, piers: pu.map((u) => ({ u, width: 0.4, out: 0.15, y0: -1 })), collideTo: 4.2, coping: true }, bm);
  roofSlab(b, fr, EAST.u0, EAST.u1, D, EAST.roof, EAST.slope);
  return { lane: fr, doorHoles: [] };
}

/** 屋根の板（平らな所と、道路斜線で斜めの所） */
function roofSlab(b: Builder, fr: LocalFrame, u0: number, u1: number, depth: number, roof: number, slope: { u0: number; h0: number; k: number }): void {
  const mat = facadeMat(fr, { colors: { front: '#1a363d', top: '#2c5459', side: '#16303a', bottom: '#0f2229' } });
  const flatEnd = Math.min(u1, slope.u0 - 0.2);
  b.mesh(fr.boxGeo([u0 + 0.2, roof - 0.25, -depth + 0.2], [flatEnd, roof, -0.2]), mat, [0, 0, 0], { shadow: false });
  if (u1 > slope.u0) {
    // 斜めの屋根（金属板）: パラペットの線より 0.6 m 下
    const len = Math.hypot(u1 - slope.u0, (u1 - slope.u0) * slope.k);
    const g = new THREE.BoxGeometry(len, 0.15, depth - 0.4);
    g.rotateZ(-Math.atan(slope.k));
    const hm = slope.h0 - 0.6 - ((u1 - slope.u0) * slope.k) / 2;
    g.translate((slope.u0 + u1) / 2, hm, -depth / 2);
    b.mesh(fr.place(g), mat, [0, 0, 0], { shadow: false });
  }
}
