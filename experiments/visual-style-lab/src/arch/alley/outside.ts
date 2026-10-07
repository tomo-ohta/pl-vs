import * as THREE from 'three';
import { paint } from './paint.ts';
import type { PaintOptions } from '../../render/PaintMaterial.ts';
import { createLeafMaterial, leafCluster, makeLeafTexture } from '../../scenes/alley/foliage.ts';
import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';
import { contact, contactF, floorPatchXZ, notice, patchMat } from './dress.ts';
import { LocalFrame } from './frame.ts';
import { ANNEX, COURT, EAST, LANE, MAIN, NORTH, roofAt, STREET, TREE, WALKWAY, WEST, wpos, type WingFrame } from './layout.ts';
import { sunAt } from './sun.ts';

/**
 * 外の置く物の決まり（写っていない所を、参考画像の視点と同じ情報量にする）。
 * - 壁ぞいの設備（壁の座標で置く）: たて樋（屋根から地面の桝まで。受け金物）・室外機（扇の格子・架台・冷媒管のカバー）・
 *   メーターの箱・換気口・散水栓とホースの巻き取り・扉の上の灯り・札。窓と扉を避け、開けた所に向いた壁だけに置く
 *   （参考画像の視点に写る通路の壁は元の版のまま）
 * - 地面: 舗装の補修の跡・ひび・油じみ・マンホール・雨水桝・横断側溝・落ち葉（木の冠の下に多い）・壁と塀の足元の雑草
 * 置いた所が日なたか（sun.ts の光線）で、日なたの色・陰の色を選ぶ（日なたの中の物は明るい）。
 */

const P = (o: PaintOptions): THREE.ShaderMaterial => paint(o);

interface Pal {
  body: THREE.ShaderMaterial;
  dark: THREE.ShaderMaterial;
  pipe: THREE.ShaderMaterial;
  cover: THREE.ShaderMaterial;
  metal: THREE.ShaderMaterial;
}

let pals: { lit: Pal; shade: Pal } | null = null;
function pal(lit: boolean): Pal {
  pals ??= {
    shade: {
      body: P({ color: { side: '#2c5254', py: '#33595b', ny: '#1d3c3f', pz: '#264a4c', nz: '#264a4c' }, fog: 0.7 }),
      dark: P({ color: { side: '#0f2328', py: '#14292e' }, fog: 0.7 }),
      pipe: P({ color: { side: '#1f4247', py: '#27494e' }, fog: 0.7 }),
      cover: P({ color: { side: '#2a4f52', py: '#33595b' }, fog: 0.7 }),
      metal: P({ color: { side: '#3a6266', py: '#46706f' }, fog: 0.7 }),
    },
    lit: {
      body: P({ color: { side: '#5f9790', py: '#b9e8d2', ny: '#27535c', pz: '#5f9790', nz: '#386b6f' }, fog: 0.7 }),
      dark: P({ color: { side: '#1f454d', py: '#27535c' }, fog: 0.7 }),
      pipe: P({ color: { side: '#386b6f', py: '#5f9790' }, fog: 0.7 }),
      cover: P({ color: { side: '#5f9790', py: '#5f9790' }, fog: 0.7 }),
      metal: P({ color: { side: '#5f9790', py: '#b9e8d2' }, fog: 0.7 }),
    },
  };
  return lit ? pals.lit : pals.shade;
}

export function resetOutsideCache(): void {
  pals = null;
}

/** 壁の座標の向き（局所 z = 法線）を Y 回りの角度で */
function yawN(fr: LocalFrame): number {
  return Math.atan2(fr.N.x, fr.N.z);
}

/** たて樋（屋根から地面まで。受け金物・下の桝・上の集水器） */
function downpipe(b: Builder, fr: LocalFrame, u: number, top: number, p: Pal): void {
  b.cyl(p.pipe, fr.w(u, top / 2, 0.11), 0.05, top, { segments: 8, shadow: false });
  for (let y = 1.4; y < top - 0.5; y += 1.8) fr.box(b, p.pipe, [u - 0.07, y, 0.0], [u + 0.07, y + 0.04, 0.17]);
  fr.box(b, p.cover, [u - 0.12, top - 0.35, 0.0], [u + 0.12, top - 0.05, 0.24]);
  // 足元の曲がりと桝の蓋
  fr.box(b, p.pipe, [u - 0.06, 0.0, 0.05], [u + 0.06, 0.14, 0.3]);
  fr.box(b, p.dark, [u - 0.2, 0.0, 0.08], [u + 0.2, 0.012, 0.48]);
  for (let k = 0; k < 4; k++) fr.box(b, p.metal, [u - 0.18, 0.012, 0.12 + k * 0.09], [u + 0.18, 0.016, 0.135 + k * 0.09]);
}

/** 室外機（前に扇の格子・横に放熱の筋・下に架台・横から冷媒管のカバーが壁を上る） */
function acUnit(b: Builder, fr: LocalFrame, u: number, y: number, p: Pal, pipeUp = 1.6, side = 1): void {
  const w0 = 0.04;
  const w1 = 0.34;
  fr.box(b, p.body, [u - 0.4, y + 0.06, w0], [u + 0.4, y + 0.66, w1]);
  // 扇の格子（暗い丸と十字の桟）
  const c = fr.w(u - 0.08, y + 0.36, w1 + 0.006);
  b.cyl(p.dark, c, 0.2, 0.012, { axis: 'z', rotY: yawN(fr), segments: 20, shadow: false });
  fr.box(b, p.metal, [u - 0.29, y + 0.355, w1 + 0.012], [u + 0.13, y + 0.365, w1 + 0.016]);
  fr.box(b, p.metal, [u - 0.085, y + 0.15, w1 + 0.012], [u - 0.075, y + 0.57, w1 + 0.016]);
  // 横の放熱の筋
  for (let k = 0; k < 4; k++) fr.box(b, p.dark, [u + 0.2 + k * 0.04, y + 0.12, w1 + 0.001], [u + 0.21 + k * 0.04, y + 0.6, w1 + 0.004]);
  // 架台
  fr.box(b, p.metal, [u - 0.36, y, w0], [u - 0.32, y + 0.06, w1 + 0.04]);
  fr.box(b, p.metal, [u + 0.32, y, w0], [u + 0.36, y + 0.06, w1 + 0.04]);
  // 冷媒管のカバー（壁を上って壁の中へ）
  const pu = u + side * 0.48;
  fr.box(b, p.cover, [pu - 0.05, y + 0.3, 0.0], [pu + 0.05, y + 0.3 + pipeUp, 0.09]);
  fr.box(b, p.cover, [Math.min(pu, u + side * 0.4) - 0.02, y + 0.3, 0.0], [Math.max(pu, u + side * 0.4) + 0.02, y + 0.4, 0.12]);
}

/** メーター・分電の小さな箱（窓付き） */
function meterBox(b: Builder, fr: LocalFrame, u: number, y: number, p: Pal): void {
  fr.box(b, p.body, [u - 0.16, y, 0.0], [u + 0.16, y + 0.42, 0.14]);
  fr.box(b, p.dark, [u - 0.09, y + 0.22, 0.14], [u + 0.09, y + 0.34, 0.145]);
  fr.box(b, p.cover, [u - 0.03, y - 0.5, 0.0], [u + 0.03, y, 0.06]);
}

/** 換気口（羽根の格子） */
function vent(b: Builder, fr: LocalFrame, u: number, y: number, p: Pal): void {
  fr.box(b, p.metal, [u - 0.17, y - 0.17, 0.0], [u + 0.17, y + 0.17, 0.05]);
  for (let k = 0; k < 5; k++) fr.box(b, p.dark, [u - 0.13, y - 0.13 + k * 0.06, 0.05], [u + 0.13, y - 0.11 + k * 0.06, 0.055]);
}

/** 散水栓とホースの巻き取り */
function hoseReel(b: Builder, fr: LocalFrame, u: number, p: Pal): void {
  fr.box(b, p.metal, [u - 0.03, 0.5, 0.0], [u + 0.03, 0.75, 0.12]);
  const hose = P({ color: { side: '#3f7a6c', py: '#4c8a7a' }, fog: 0.7 });
  const g = new THREE.TorusGeometry(0.2, 0.05, 6, 16);
  g.translate(0, 0.32, 0);
  b.mesh(fr.place(g.translate(u + 0.35, 0, 0.22)), hose, [0, 0, 0], { shadow: false });
  fr.box(b, p.metal, [u + 0.12, 0, 0.1], [u + 0.58, 0.05, 0.34]);
}

/** 扉の上の灯り（昼は消えている）と札 */
function doorLight(b: Builder, fr: LocalFrame, u: number, y: number, p: Pal): void {
  fr.box(b, p.metal, [u - 0.03, y, 0.0], [u + 0.03, y + 0.06, 0.18]);
  fr.box(b, P({ color: { side: '#9fc8b8', ny: '#b9dccd' }, fog: 0.7 }), [u - 0.1, y - 0.14, 0.1], [u + 0.1, y, 0.24]);
}

interface Run {
  fr: LocalFrame;
  /** 壁の上端（たて樋の高さ） */
  top: number;
  /** 置く物（u と種類） */
  items: ({ k: 'pipe'; u: number } | { k: 'ac'; u: number; y?: number; up?: number; side?: number } | { k: 'meter'; u: number; y: number } | { k: 'vent'; u: number; y: number } | { k: 'hose'; u: number } | { k: 'light'; u: number; y: number } | { k: 'sign'; u: number; y: number; cell: number; w?: number; h?: number })[];
}

function endFrame(origin: [number, number], tangent: [number, number], normal: [number, number]): LocalFrame {
  return new LocalFrame({ origin, tangent, normal } as WingFrame);
}

export function buildOutside(b: Builder): void {
  const r = rng(73);
  const D = WEST.depth;
  const nIn: [number, number] = [-WEST.normal[0], -WEST.normal[1]];
  const wSouth = endFrame(wpos(WEST, WEST.u0, 0), nIn, [-WEST.tangent[0], -WEST.tangent[1]]);
  const wNorth = endFrame(wpos(WEST, WEST.u1, 0), nIn, [WEST.tangent[0], WEST.tangent[1]]);
  const eSouth = endFrame([EAST.origin[0], -EAST.u0], [1, 0], [0, 1]);
  const mNorth = endFrame([MAIN.x[0], MAIN.z[0]], [1, 0], [0, -1]);
  const aWest = endFrame([ANNEX.x[0], ANNEX.z[0]], [0, 1], [-1, 0]);
  const aNorth = endFrame([ANNEX.x[1], ANNEX.z[0]], [-1, 0], [0, -1]);
  const entryU = (WALKWAY.x[0] + WALKWAY.x[1]) / 2 - MAIN.x[0];
  const mainItems: Run['items'] = [];
  for (let i = 0; i * 4.5 + 0.5 < MAIN.x[1] - MAIN.x[0] - 1; i++) {
    const pu = 0.5 + i * 4.5;
    const bay = pu + 2.25;
    if (i % 2 === 0 && Math.abs(pu - entryU) > 3.2) mainItems.push({ k: 'pipe', u: pu + 0.35 });
    if (Math.abs(bay - entryU) > 3.5 && r() < 0.7) mainItems.push({ k: 'ac', u: bay + (r() - 0.5) * 1.2, y: 0.22, up: 0.4, side: r() < 0.5 ? 1 : -1 });
    else if (Math.abs(bay - entryU) > 3.5 && r() < 0.5) mainItems.push({ k: 'vent', u: bay, y: 0.55 });
  }
  mainItems.push({ k: 'meter', u: entryU + 3.3, y: 1.0 }, { k: 'hose', u: entryU - 3.6 }, { k: 'sign', u: entryU - 2.8, y: 1.3, cell: 24, w: 0.45, h: 0.6 });
  const runs: Run[] = [
    {
      fr: wSouth,
      top: roofAt(WEST, WEST.u0),
      items: [
        { k: 'pipe', u: D - 0.45 },
        { k: 'ac', u: 5.9, up: 1.4 },
        { k: 'ac', u: 7.0, up: 1.6, side: -1 },
        { k: 'hose', u: 9.6 },
        { k: 'light', u: 2.9, y: 2.7 },
        { k: 'sign', u: 0.45, y: 1.35, cell: 25, w: 0.4, h: 0.55 },
        { k: 'meter', u: 10.7, y: 1.1 },
      ],
    },
    {
      fr: wNorth,
      top: roofAt(WEST, WEST.u1),
      items: [
        { k: 'pipe', u: D - 0.45 },
        { k: 'ac', u: 5.2, up: 1.8 },
        { k: 'ac', u: 6.3, up: 1.5, side: -1 },
        { k: 'light', u: 8.1, y: 2.3 },
        { k: 'vent', u: 9.6, y: 2.3 },
        { k: 'meter', u: 10.4, y: 1.0 },
        { k: 'hose', u: 0.6 },
        { k: 'sign', u: 9.3, y: 1.2, cell: 29, w: 0.3, h: 0.3 },
      ],
    },
    {
      fr: eSouth,
      top: EAST.parapet,
      items: [
        { k: 'pipe', u: 0.45 },
        { k: 'pipe', u: D - 0.45 },
        { k: 'meter', u: 7.4, y: 1.0 },
        { k: 'vent', u: 7.9, y: 2.0 },
        { k: 'sign', u: 7.0, y: 1.55, cell: 28, w: 0.3, h: 0.3 },
      ],
    },
    { fr: mNorth, top: MAIN.parapet, items: mainItems },
    {
      fr: aWest,
      top: ANNEX.h,
      items: [
        { k: 'ac', u: 0.9, up: 1.2 },
        { k: 'meter', u: 3.6, y: 1.0 },
      ],
    },
    {
      fr: aNorth,
      top: ANNEX.h,
      items: [
        { k: 'pipe', u: 0.3 },
        { k: 'hose', u: 3.2 },
        { k: 'vent', u: 4.4, y: 2.0 },
      ],
    },
  ];
  for (const run of runs) {
    for (const it of run.items) {
      const y0 = 'y' in it && it.y !== undefined ? it.y : 0.3;
      const lit = sunAt(run.fr.w(it.u, y0 + 0.3, 0.6)) > 0.5;
      const p = pal(lit);
      if (it.k === 'pipe') downpipe(b, run.fr, it.u, run.top - 0.3, p);
      else if (it.k === 'ac') {
        acUnit(b, run.fr, it.u, it.y ?? 0, p, it.up ?? 1.6, it.side ?? 1);
        if ((it.y ?? 0) < 0.1) contactF(b, run.fr, it.u - 0.4, 0.04, it.u + 0.4, 0.38, 0.08, 0.004);
      }
      else if (it.k === 'meter') meterBox(b, run.fr, it.u, it.y, p);
      else if (it.k === 'vent') vent(b, run.fr, it.u, it.y, p);
      else if (it.k === 'hose') hoseReel(b, run.fr, it.u, p);
      else if (it.k === 'light') doorLight(b, run.fr, it.u, it.y, p);
      else if (it.k === 'sign') {
        const w = it.w ?? 0.3;
        const h = it.h ?? 0.3;
        run.fr.box(b, p.metal, [it.u - w / 2 - 0.02, it.y - 0.02, 0.0], [it.u + w / 2 + 0.02, it.y + h + 0.02, 0.02]);
        notice(b, run.fr, 'w', 0.022, it.u - w / 2, it.u + w / 2, it.y, it.y + h, 1, it.cell, 0.7);
      }
    }
  }

  groundDetail(b, r);
  courtyardProps(b, r);
}

/** 中庭の小物: 百葉箱・屋根付きの掲示板・ごみ箱・花壇の札・台車 */
function courtyardProps(b: Builder, r: () => number): void {
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): void => {
    b.boxMM(m, min, max, { collide, shadow: false });
  };
  const at = (x: number, z: number): Pal => pal(sunAt([x, 1.0, z]) > 0.5);
  // 百葉箱（白い鎧戸の箱を 4 本の脚の上に。扉は北向き）
  {
    const [x, z] = [11.6, 36.6];
    const p = at(x, z);
    const white = sunAt([x, 1.2, z]) > 0.5 ? P({ color: { side: '#c8e4d6', py: '#d8eee2', ny: '#7fa89a' }, fog: 0.7 }) : P({ color: { side: '#7fa89a', py: '#8fb6a6', ny: '#4f7a70' }, fog: 0.7 });
    for (const [dx, dz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) box(white, [x + dx - 0.03, 0, z + dz - 0.03], [x + dx + 0.03, 1.2, z + dz + 0.03]);
    contact(b, x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0.05);
    box(white, [x - 0.38, 1.2, z - 0.38], [x + 0.38, 1.85, z + 0.38], true);
    for (let y = 1.26; y < 1.8; y += 0.06) {
      box(p.dark, [x - 0.381, y, z - 0.33], [x + 0.381, y + 0.012, z + 0.33]);
      box(p.dark, [x - 0.33, y, z - 0.381], [x + 0.33, y + 0.012, z + 0.381]);
    }
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.52, 0.03, 0.9);
      g.rotateZ(s * 0.45);
      g.translate(x - s * 0.22, 1.98, z);
      b.mesh(g, white, [0, 0, 0], { shadow: false });
    }
  }
  // 屋根付きの掲示板（本館の入口の東。北を向く）
  {
    const x0 = 3.6;
    const x1 = 6.0;
    const z = 38.7;
    const p = at((x0 + x1) / 2, z - 0.5);
    for (const x of [x0 + 0.05, x1 - 0.05]) box(p.metal, [x - 0.04, 0, z - 0.04], [x + 0.04, 2.3, z + 0.04], true);
    box(p.cover, [x0 - 0.05, 0.9, z - 0.03], [x1 + 0.05, 2.0, z + 0.03]);
    box(P({ color: { side: '#3c5e55', nz: '#466a60' }, fog: 0.7 }), [x0 + 0.05, 0.95, z - 0.035], [x1 - 0.05, 1.95, z - 0.03]);
    const fr = new LocalFrame({ origin: [x1, z], tangent: [-1, 0], normal: [0, -1] } as WingFrame);
    let u = 0.15;
    while (u < x1 - x0 - 0.35) {
      const land = r() < 0.35;
      const w = land ? 0.3 : 0.21;
      const h = land ? 0.21 : 0.3;
      const y = 1.02 + r() * (0.85 - h);
      notice(b, fr, 'w', 0.036, u, u + w, y, y + h, 1, land ? 16 + Math.floor(r() * 8) : Math.floor(r() * 16), 0.7);
      u += w + 0.05 + r() * 0.1;
    }
    const g = new THREE.BoxGeometry(x1 - x0 + 0.4, 0.04, 0.6);
    g.rotateX(-0.25);
    g.translate((x0 + x1) / 2, 2.3, z + 0.02);
    b.mesh(g, p.cover, [0, 0, 0], { shadow: false });
  }
  // ごみ箱（ベンチの脇）
  for (const [x, z] of [
    [-12.5, 22.9],
    [10.4, 23.4],
    [-4.4, 29.0],
  ] as [number, number][]) {
    const p = at(x, z);
    b.cyl(p.body, [x, 0.38, z], 0.22, 0.76, { segments: 12, collide: true, shadow: false });
    contact(b, x - 0.22, z - 0.22, x + 0.22, z + 0.22, 0.08);
    b.cyl(p.dark, [x, 0.77, z], 0.17, 0.02, { segments: 12, shadow: false });
    b.cyl(p.metal, [x, 0.79, z], 0.23, 0.03, { segments: 12, shadow: false });
  }
  // 花壇の札（杭に白い札）
  const stake = P({ color: { side: '#3f6a62' }, fog: 0.7 });
  const plate = P({ color: { side: '#a9c8b8', py: '#b8d4c4' }, fog: 0.7 });
  for (const [x, z] of [
    [-17.6, 24.6],
    [-10.4, 32.4],
    [6.4, 25.1],
    [11.8, 32.9],
    [-6.8, 35.1],
  ] as [number, number][]) {
    box(stake, [x - 0.015, 0.2, z - 0.015], [x + 0.015, 0.75, z + 0.015]);
    box(plate, [x - 0.15, 0.62, z - 0.01], [x + 0.15, 0.82, z + 0.01]);
  }
  // 台車（西棟の昇降口の庇の下）
  {
    const p = at(-12.6, 19.4);
    box(p.cover, [-13.1, 0.12, 19.0], [-12.2, 0.16, 19.6], true);
    box(p.metal, [-13.12, 0.16, 19.0], [-13.08, 0.95, 19.6]);
    box(p.metal, [-13.12, 0.9, 19.0], [-13.06, 0.95, 19.6]);
    for (const [x, z] of [[-13.0, 19.05], [-13.0, 19.55], [-12.3, 19.05], [-12.3, 19.55]]) b.cyl(p.dark, [x, 0.06, z], 0.06, 0.04, { axis: 'z', segments: 10, shadow: false });
  }
}

/** 地面の細かい物（補修の跡・ひび・油じみ・桝・落ち葉・雑草） */
function groundDetail(b: Builder, r: () => number): void {
  // ---- 舗装の補修の跡（少し明るい・暗い四角）とひび・油じみ。通路の口（参考画像の視点の後ろ）・裏庭・道路
  const patchA = patchMat('#13282f', { rag: 0.08, scale: 3 });
  const patchB = patchMat('#0b1c22', { rag: 0.1, scale: 2.5 });
  const crack = patchMat('#08161b', { rag: 0.025, scale: 9 });
  const stain = patchMat('#0a191e', { rag: 0.35, scale: 1.2, opacity: 0.6 });
  const spots: [number, number, number, number][] = [
    // x0, z0, x1, z1（通路の口: z > 1）
    [-1.9, 3.2, -0.6, 4.6],
    [-0.2, 9.0, 0.7, 11.2],
    [-2.4, 13.6, -1.2, 14.4],
  ];
  spots.forEach((s, i) => floorPatchXZ(b, i % 2 ? patchB : patchA, s[0], s[1], s[2], s[3], 0.004));
  // ひび（細長い貼り絵を折れ線に）
  const crackLine = (pts: [number, number][], y: number): void => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [cx, cz] = pts[i + 1];
      const len = Math.hypot(cx - ax, cz - az);
      const g = new THREE.PlaneGeometry(len, 0.035);
      g.rotateX(-Math.PI / 2);
      g.rotateY(-Math.atan2(cz - az, cx - ax));
      g.translate((ax + cx) / 2, y, (az + cz) / 2);
      b.mesh(g, crack, [0, 0, 0], { shadow: false });
    }
  };
  const wiggle = (x: number, z: number, n: number, dir: number): [number, number][] => {
    const out: [number, number][] = [[x, z]];
    let a = dir;
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * (0.3 + r() * 0.3);
      z += Math.sin(a) * (0.3 + r() * 0.3);
      out.push([x, z]);
    }
    return out;
  };
  crackLine(wiggle(-2.2, 6.0, 7, 0.3), 0.005);
  crackLine(wiggle(0.3, 15.2, 6, 2.6), 0.005);
  crackLine(wiggle(-6.0, -40.5, 8, 0.1), 0.005);
  crackLine(wiggle(-12.5, -44.0, 6, -0.4), 0.005);
  crackLine(wiggle(-20, STREET.z[0] + 3.0, 10, 0.05), -0.044);
  floorPatchXZ(b, stain, -0.9, 7.0, 0.2, 7.8, 0.006);
  floorPatchXZ(b, stain, -8.4, -46.6, -6.9, -45.4, 0.006);
  floorPatchXZ(b, stain, -3.0, -38.6, -2.2, -37.9, 0.006);
  floorPatchXZ(b, patchA, -14.0, -45.5, -11.5, -43.8, 0.004);
  floorPatchXZ(b, patchB, -5.5, -36.8, -4.0, -35.2, 0.004);
  // ---- 通路の口の横断側溝（格子の蓋。中庭との境）と、道路の白線（止まれの線）
  const grate = P({ color: { py: '#1d3a42', side: '#122a31' }, fog: 0.7 });
  const slot = P({ color: { py: '#081519' }, fog: 0.7 });
  const gz = LANE.z0 - 0.6;
  b.boxMM(grate, [LANE.asphaltW, 0, gz - 0.2], [LANE.walkX[1], 0.012, gz + 0.2], { shadow: false });
  for (let x = LANE.asphaltW + 0.05; x < LANE.walkX[1] - 0.05; x += 0.07) b.boxMM(slot, [x, 0.012, gz - 0.16], [x + 0.025, 0.013, gz + 0.16], { shadow: false });
  // ---- 雨水桝とマンホール（裏庭・中庭の通路の脇）
  const lid = P({ color: { py: '#1d3a42', side: '#16303a' }, fog: 0.7 });
  const lidRim = P({ color: { py: '#24444b' }, fog: 0.7 });
  for (const [x, z] of [
    [-9.5, -42.0],
    [1.8, -33.6],
    [-1.6, 12.6],
  ] as [number, number][]) {
    b.cyl(lidRim, [x, 0.004, z], 0.36, 0.008, { segments: 20, shadow: false });
    b.cyl(lid, [x, 0.006, z], 0.31, 0.008, { segments: 20, shadow: false });
    for (let k = -2; k <= 2; k++) b.boxMM(slot, [x - 0.24, 0.0105, z + k * 0.1 - 0.012], [x + 0.24, 0.011, z + k * 0.1 + 0.012], { shadow: false });
  }
  for (const [x, z] of [
    [-15.5, 22.4],
    [12.6, 21.0],
    [-20.5, 38.4],
    [-12.4, -47.2],
  ] as [number, number][]) {
    b.boxMM(lidRim, [x - 0.27, 0, z - 0.27], [x + 0.27, 0.01, z + 0.27], { shadow: false });
    b.boxMM(slot, [x - 0.2, 0, z - 0.2], [x + 0.2, 0.012, z + 0.2], { shadow: false });
    for (let k = -3; k <= 3; k++) b.boxMM(grate, [x - 0.2, 0.012, z + k * 0.055 - 0.01], [x + 0.2, 0.014, z + k * 0.055 + 0.01], { shadow: false });
  }
  // ---- 落ち葉（木の冠の下に多く、風で壁ぎわ・縁石ぎわへ寄る）
  const leafA = patchMat('#2b4a3e', { rag: 0.025, scale: 30 });
  const leafB = patchMat('#46684f', { rag: 0.025, scale: 30 });
  const leafC = patchMat('#1d3530', { rag: 0.025, scale: 30 });
  const leaves = [leafA, leafB, leafC];
  const scatter = (cx: number, cz: number, rad: number, n: number, y = 0.006): void => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rad;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const s = 0.06 + r() * 0.06;
      const g = new THREE.PlaneGeometry(s, s * 0.6);
      g.rotateX(-Math.PI / 2);
      g.rotateY(r() * Math.PI);
      g.translate(x, y + r() * 0.002, z);
      b.mesh(g, leaves[Math.floor(r() * 3)], [0, 0, 0], { shadow: false });
    }
  };
  scatter(-14, 28.5, 5.5, 160, 0.21);
  scatter(8.8, 29, 4.6, 120, 0.21);
  scatter(-5.0, 36.2, 3.2, 60, 0.21);
  scatter(-14, 24.0, 3.0, 50);
  scatter(9.0, 23.0, 3.0, 40);
  scatter(TREE.x, TREE.z, 4.5, 140);
  scatter(TREE.x - 2.5, TREE.z + 4.5, 2.5, 50);
  scatter(-1.5, -34.6, 1.2, 25);
  // 縁石ぎわ・壁ぎわの吹きだまり
  for (let z = 20; z < 39; z += 2.2) scatter(COURT.x[0] + 0.5, z + r(), 0.5, 10);
  for (let x = -22; x < 12; x += 3.1) scatter(x + r(), MAIN.z[0] - 0.9, 0.45, 8);
  for (let x = -15; x < 2; x += 2.4) scatter(x + r(), NORTH.fenceZ + 0.6, 0.5, 9);

  // ---- 雑草（壁・塀・フェンスの足元。小さな葉の塊）
  const weedTex = makeLeafTexture(97, { clumps: 26, leaf: 5, litSide: 0.6, fill: 1.3 });
  weedTex.wrapS = weedTex.wrapT = THREE.RepeatWrapping;
  const weed = createLeafMaterial(weedTex, '#14302c', '#2c5a4c', 1, { cardEdge: 0.5, fog: 0.7 });
  const tuft = (x: number, z: number, s: number, yaw: number): void => {
    b.mesh(leafCluster([x, s * 0.35, z], [s * 1.4, s * 0.7, s * 0.6], 2, Math.floor(x * 31 + z * 17), yaw, 0.6), weed, [0, 0, 0], { shadow: false });
  };
  // 本館の壁ぎわ・中庭の東のフェンス・西の塀・裏庭のフェンスと塀・倉庫のまわり
  for (let x = COURT.x[0] + 0.6; x < COURT.x[1] - 0.5; x += 0.9 + r() * 1.6) if (r() < 0.55) tuft(x, MAIN.z[0] - 0.12, 0.22 + r() * 0.2, 0);
  for (let z = LANE.z0 + 0.5; z < COURT.z[1] - 0.5; z += 0.8 + r() * 1.5) if (r() < 0.6) tuft(COURT.x[1] - 0.15, z, 0.2 + r() * 0.25, Math.PI / 2);
  for (let x = NORTH.x0 + 0.4; x < NORTH.x1 - 0.4; x += 0.7 + r() * 1.2) if (r() < 0.6 && (x < NORTH.gate[0] - 0.5 || x > NORTH.gate[1] + 1.6)) tuft(x, NORTH.fenceZ + 0.25, 0.25 + r() * 0.25, 0);
  for (let z = NORTH.fenceZ + 1; z < -33.5; z += 0.8 + r() * 1.3) if (r() < 0.6) tuft(NORTH.x0 + 0.3, z, 0.2 + r() * 0.25, Math.PI / 2);
  for (let z = ANNEX.z[0] + 0.2; z < ANNEX.z[1] - 0.2; z += 0.6 + r()) if (r() < 0.5) tuft(ANNEX.x[0] - 0.12, z, 0.18 + r() * 0.15, Math.PI / 2);
  // 西棟の南の端・北の端の壁ぎわ（斜めの壁）
  for (const [u, wOut] of [
    [WEST.u0, -1],
    [WEST.u1, 1],
  ] as [number, number][]) {
    for (let w = -WEST.depth + 0.6; w < -0.5; w += 0.8 + r() * 1.4) {
      if (r() < 0.5) continue;
      const p = wpos(WEST, u + wOut * 0.15, w);
      tuft(p[0], p[1], 0.2 + r() * 0.2, Math.atan2(-WEST.tangent[1], WEST.tangent[0]) + Math.PI / 2);
    }
  }
  // 通路の口の東の歩道ぎわ（参考画像の視点の後ろ）
  for (let z = 1.2; z < LANE.z0 - 1; z += 1 + r() * 1.5) if (r() < 0.5) tuft(LANE.walkX[0] - 0.05, z, 0.16 + r() * 0.12, Math.PI / 2);
  void V3Dummy;
}

const V3Dummy: V3 = [0, 0, 0];
