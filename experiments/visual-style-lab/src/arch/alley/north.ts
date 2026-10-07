import * as THREE from 'three';
import { paint } from './paint.ts';
import type { PaintOptions } from '../../render/PaintMaterial.ts';
import { makeFarFacade } from '../../scenes/alley/textures.ts';
import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';
import type { Doors } from './doors.ts';
import { buildFacade, evenMull, type Opening } from './facade.ts';
import { LocalFrame } from './frame.ts';
import { createGlass, ROOM } from './glass.ts';
import { ANNEX, CLUB, FAR, NORTH, STREET, TREE, WEST, wpos } from './layout.ts';
import { facadeMat } from './mats.ts';
import { buildTree } from './tree.ts';
import { buildFarRelief } from './far.ts';
import type { ViewDef } from '../../scenes/types.ts';
import { contact } from './dress.ts';
import { groundSun, STREET_RECT, sunLayer, YARD_RECT } from './sun.ts';

/**
 * 通路の北の端: 倉庫（用務員の作業室と倉庫。参考画像の突き当たりの低い建物）・部室棟（右奥の明るい壁）・裏庭の木・
 * 裏庭（ごみ置き場・キュービクル・通用門）・敷地の外の道路と向かいの明るい建物。
 */

const P = (o: PaintOptions): THREE.ShaderMaterial => paint(o);

export function buildNorth(b: Builder, doors: Doors, view: ViewDef): void {
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): THREE.Mesh => b.boxMM(m, min, max, { collide, shadow: false });
  const r = rng(17);

  // ---------------------------------------------------------------- 裏庭の地面
  const yardCov = { texture: groundSun(YARD_RECT, 4), rect: YARD_RECT };
  const sunL = sunLayer;
  const yard = P({ color: { py: '#10252d', side: '#0d2027' }, cov: yardCov, layers: [{ color: '#132b33', scale: 0.35, threshold: 0.62, only: 'floor', detail: 0.4 }, sunL('#386b6f', 12)], grid: { layer: 1, size: [1.2, 1.2], width: 0.02, color: '#27535c' } });
  box(yard, [-16.5, -0.2, -33.0], [3.3, 0, NORTH.fenceZ - 0.3], true);
  // ---------------------------------------------------------------- 倉庫（参考画像の突き当たり）
  const [ax0, ax1] = ANNEX.x;
  const [az1, az0] = ANNEX.z; // az0 = 南の面（-35.5）
  // 壁（南の面に扉の穴）
  const aFr = new LocalFrame({ origin: [ax0, az0], tangent: [1, 0], normal: [0, 1] });
  const annexWall = facadeMat(aFr, { colors: { front: '#235264', side: '#1d4757', top: '#2a5b6a', bottom: '#183c48', back: '#1b3a44' }, hi: { front: '#235264', side: '#1d4757', top: '#2a5b6a', back: '#1b3a44' } });
  const annexLow = facadeMat(aFr, { colors: { front: '#204d5e', side: '#1a4352', top: '#2a5b6a', back: '#1b3a44' } });
  const aw = ax1 - ax0;
  const glassA = createGlass(aFr, { glassW: -0.12, opposite: { w: 20, top: 14, base: 0, pitch: 3.6, sill: 0.8, head: 2.4, treeTop: 10, trees: 0.5 }, k0: 0.35, fog: 0.35 });
  glassA.transparent = false;
  const aOps: Opening[] = [
    { u0: ANNEX.door[0] - ax0, u1: ANNEX.door[1] - ax0, y0: 0, y1: 1.95, kind: 'door' },
    { u0: 0.2, u1: aw - 0.2, y0: 3.05, y1: 3.45, mull: evenMull(0.2, aw - 0.2, 8), noSill: true, cell: [0, aw, 0, 3.4], room: [4.2, ROOM.storage, 3, 0] },
  ];
  // 腰（2.4 m まで）と上の 2 枚に分けて、色の帯を本当の継ぎ目（水切りの目地）にする
  buildFacade(b, { fr: aFr, u0: 0, u1: aw, bottom: -0.2, thick: 0.25, glassW: -0.12, top: () => 2.4, openings: [aOps[0]], collideTo: 3 }, { wall: annexLow, pier: annexLow, frame: annexLow, sill: annexLow, glass: glassA });
  buildFacade(b, { fr: aFr, u0: 0, u1: aw, bottom: 2.4, thick: 0.25, glassW: -0.12, top: () => ANNEX.h, openings: [aOps[1]], coping: true }, { wall: annexWall, pier: annexWall, frame: P({ color: '#3f7f86', fog: 0.35 }), sill: annexWall, glass: glassA, coping: annexWall });
  // 目地（腰の上の水切り）
  box(P({ color: { pz: '#2c6170', py: '#336a76' }, fog: 0.35 }), [ax0, 2.38, az0 + 0.02], [ax1, 2.42, az0 + 0.04]);
  // 扉（鉄の扉。鍵）と庇の無い枠
  const doorMat = P({ color: { pz: '#1a4152', side: '#163a49' }, fog: 0.35 });
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.95, 0.05).translate(0.65, 0.975, 0), doorMat);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.05).translate(1.18, 0.95, 0.04), P({ color: '#2f6070', fog: 0.35 }));
  leaf.add(knob);
  doors.add({ leaf, pivot: [ANNEX.door[0], 0, az0 - 0.13], yaw: 0, swing: -1.4, locked: true });
  // 西・北の壁（本当の壁と窓）・屋根。東は部室棟の壁につく
  const gA = (fr: LocalFrame): THREE.ShaderMaterial => {
    const g = createGlass(fr, { glassW: -0.1, opposite: { w: 12, top: 18, base: 0, pitch: 3.6, sill: 1.2, head: 3.3, treeTop: 10, trees: 0.6 }, k0: 0.35, fog: 0.35 });
    g.transparent = false;
    return g;
  };
  const sideMats = (fr: LocalFrame): { wall: THREE.ShaderMaterial; low: THREE.ShaderMaterial } => ({
    wall: facadeMat(fr, { colors: { front: '#1d4757', side: '#1a4150', top: '#2a5b6a', bottom: '#163843', back: '#1b3a44' }, fog: 0.35 }),
    low: facadeMat(fr, { colors: { front: '#1a4150', side: '#173b49', top: '#2a5b6a', back: '#1b3a44' }, fog: 0.35 }),
  });
  const frameA = P({ color: { side: '#2f6a74', py: '#3a7680' }, fog: 0.35 });
  // 西の面（抜け道に面する。窓と換気扇）
  const wFr = new LocalFrame({ origin: [ax0, az1], tangent: [0, 1], normal: [-1, 0] });
  const wm = sideMats(wFr);
  buildFacade(b, { fr: wFr, u0: 0.25, u1: az0 - az1 - 0.25, bottom: -0.2, thick: 0.25, glassW: -0.1, top: () => 2.4, openings: [], collideTo: 3 }, { wall: wm.low, pier: wm.low, frame: frameA, sill: wm.low, glass: gA(wFr) });
  buildFacade(b, { fr: wFr, u0: 0.25, u1: az0 - az1 - 0.25, bottom: 2.4, thick: 0.25, glassW: -0.1, top: () => ANNEX.h, openings: [{ u0: 1.4, u1: 3.0, y0: 2.55, y1: 3.3, mull: [2.2], cell: [0, 4.5, 0, 3.4], room: [5, ROOM.storage, 4, 0] }], coping: true }, { wall: wm.wall, pier: wm.wall, frame: frameA, sill: wm.wall, glass: gA(wFr), coping: wm.wall });
  // 北の面（木の下。窓 2 つ）
  const nFr = new LocalFrame({ origin: [ax1, az1], tangent: [-1, 0], normal: [0, -1] });
  const nm = sideMats(nFr);
  buildFacade(b, { fr: nFr, u0: 0, u1: aw, bottom: -0.2, thick: 0.25, glassW: -0.1, top: () => 2.4, openings: [{ u0: 1.0, u1: 2.6, y0: 1.0, y1: 2.2, mull: [1.8], cell: [0, aw, 0, 3.4], room: [4.2, ROOM.storage, 5, 0] }], collideTo: 3 }, { wall: nm.low, pier: nm.low, frame: frameA, sill: nm.low, glass: gA(nFr) });
  buildFacade(b, { fr: nFr, u0: 0, u1: aw, bottom: 2.4, thick: 0.25, glassW: -0.1, top: () => ANNEX.h, openings: [], coping: true }, { wall: nm.wall, pier: nm.wall, frame: frameA, sill: nm.wall, glass: gA(nFr), coping: nm.wall });
  box(P({ color: { py: '#24515f', side: '#1d4757', ny: '#163843' }, fog: 0.35 }), [ax0, ANNEX.h - 0.25, az1], [ax1, ANNEX.h - 0.05, az0], true);
  // 換気扇のフード（西の面）・南の面の板の目地・扉の上の灯り・札・たて樋
  box(P({ color: { nx: '#2a5b6a', side: '#24505d', py: '#336a76' }, fog: 0.35 }), [ax0 - 0.14, 1.7, az1 + 2.5], [ax0, 2.05, az1 + 2.9]);
  const joint = P({ color: { pz: '#1d4655', side: '#1a4150' }, fog: 0.35 });
  for (let x = ax0 + 0.9; x < ax1 - 0.3; x += 0.9) {
    if (x > ANNEX.door[0] - 0.05 && x < ANNEX.door[1] + 0.05) continue;
    box(joint, [x - 0.012, 0.05, az0], [x + 0.012, 2.36, az0 + 0.006]);
    box(joint, [x - 0.012, 2.44, az0], [x + 0.012, 3.0, az0 + 0.006]);
  }
  box(P({ color: { pz: '#9fcdb9', side: '#5f9190' }, fog: 0.35 }), [(ANNEX.door[0] + ANNEX.door[1]) / 2 - 0.12, 2.12, az0], [(ANNEX.door[0] + ANNEX.door[1]) / 2 + 0.12, 2.24, az0 + 0.1]);
  box(P({ color: { pz: '#4f8a8c', side: '#2f6070' }, fog: 0.35 }), [ANNEX.door[1] + 0.2, 1.45, az0], [ANNEX.door[1] + 0.55, 1.6, az0 + 0.01]);
  b.cyl(P({ color: { side: '#1f4a58', py: '#2a5b6a' }, fog: 0.35 }), [ax1 - 0.12, ANNEX.h / 2, az0 + 0.1], 0.045, ANNEX.h, { segments: 8, shadow: false });
  // 倉庫のまわり: 一輪車・パレット・ドラム缶・ホースの巻き取り
  const crate = P({ color: { py: '#2a5257', side: '#1d3d42' }, fog: 0.5 });
  box(crate, [ax0 - 1.6, 0, az1 + 0.3], [ax0 - 0.4, 0.14, az1 + 1.4], true);
  box(crate, [ax0 - 1.55, 0.14, az1 + 0.35], [ax0 - 0.45, 0.28, az1 + 1.35]);
  const drum = P({ color: { side: '#1f4a55', py: '#2a5b6a' }, fog: 0.5 });
  for (const [x, z] of [[ax0 - 0.7, az1 - 0.6], [ax0 - 1.4, az1 - 0.7]]) {
    b.cyl(drum, [x, 0.45, z], 0.29, 0.9, { segments: 14, collide: true, shadow: false });
    contact(b, x - 0.29, z - 0.29, x + 0.29, z + 0.29, 0.08);
  }
  contact(b, ax0 - 1.6, az1 + 0.3, ax0 - 0.4, az1 + 1.4, 0.06);
  b.cyl(P({ color: '#1a3d48', fog: 0.5 }), [ax0 - 0.25, 0.9, az0 - 1.6], 0.28, 0.12, { axis: 'x', segments: 16, shadow: false });

  // ---------------------------------------------------------------- 部室棟（北東の 2 階建て。西の面が参考画像の右奥の明るい壁）
  const [cx0, cx1] = CLUB.x;
  const [cz1, cz0] = CLUB.z;
  const cFr = new LocalFrame({ origin: [cx0, cz0], tangent: [0, -1], normal: [-1, 0] });
  const clubWall = facadeMat(cFr, { colors: { front: '#214d58', side: '#1c4450', top: '#2c5f6a', bottom: '#183a44', back: '#1b3a44' } });
  const gC = createGlass(cFr, { glassW: -0.14, opposite: { w: 15, top: 12, base: 0, pitch: 3.6, sill: 0.9, head: 2.6, treeTop: 11, trees: 0.8 }, k0: 0.3, fog: 0.4 }, { win: '#2a5a62', wall: '#1d4450' });
  gC.transparent = false;
  const cOps: Opening[] = [];
  for (const [u0, u1] of [[5.6, 7.6], [8.6, 10.6]] as const) {
    cOps.push({ u0, u1, y0: 0.9, y1: 2.6, mull: evenMull(u0, u1, 3), cell: [u0 - 1, u1 + 1, 0, 3.4], room: [5, ROOM.club, u0, 0] });
    cOps.push({ u0, u1, y0: 5.1, y1: 6.8, mull: evenMull(u0, u1, 3), cell: [u0 - 1, u1 + 1, 4.2, 7.6], room: [5, ROOM.club, u0 + 9, 0] });
  }
  for (const [u0, u1] of [[0.8, 2.4], [2.9, 4.5]] as const) cOps.push({ u0, u1, y0: 5.1, y1: 6.8, mull: [(u0 + u1) / 2], cell: [0, 5, 4.2, 7.6], room: [5, ROOM.club, u0 + 20, 0] });
  cOps.push({ u0: 11.0, u1: 11.9, y0: 0, y1: 2.1, kind: 'door' });
  buildFacade(b, { fr: cFr, u0: 0, u1: cz0 - cz1, bottom: -0.2, thick: 0.25, glassW: -0.14, top: () => CLUB.h, openings: cOps, collideTo: 3, coping: true }, { wall: clubWall, pier: clubWall, frame: facadeMat(cFr, { colors: { front: '#173a44', top: '#2c5f6a' } }), sill: facadeMat(cFr, { colors: { front: '#24525e', top: '#336a76' } }), glass: gC, coping: facadeMat(cFr, { colors: { front: '#285966', top: '#336a76' } }) });
  const clubDoor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.05).translate(-0.45, 1.05, 0), P({ color: { side: '#1a4150' }, fog: 0.4 }));
  doors.add({ leaf: clubDoor, pivot: [cx0 - 0.12, 0, cz0 - 11.0], yaw: Math.PI / 2, swing: 1.3, locked: true });
  // 北・東の面（板）と屋根
  const clubBody = P({ color: { nz: '#1a3f4a', px: '#1a3f4a', py: '#24505a' }, fog: 0.5 });
  box(clubBody, [cx0, 0, cz1], [cx1, CLUB.h, cz1 + 0.25], true);
  box(clubBody, [cx1 - 0.25, 0, cz1], [cx1, CLUB.h, cz0], true);
  box(clubBody, [cx0, CLUB.h - 0.9, cz1], [cx1, CLUB.h - 0.7, cz0]);
  for (let x = cx0 + 1; x < cx1 - 1; x += 2.3) box(P({ color: { nz: '#24505a', side: '#1d4450' }, fog: 0.5 }), [x, 0.9, cz1 - 0.01], [x + 1.6, 2.5, cz1 + 0.01]);

  // ---------------------------------------------------------------- 裏庭の木（参考画像の突き当たりの明るい木）
  buildTree(b, { x: TREE.x, z: TREE.z, crownY: 6.4, rx: 3.6, ry: 3.7, trunk: 3.6, r: 0.24, cards: 46, seed: 11 });

  // ---------------------------------------------------------------- 裏庭の物
  // ごみ置き場（金網の囲いと屋根）
  const mesh = P({ color: { side: '#1d3f47', py: '#24484f' }, fog: 0.6 });
  const post = P({ color: { side: '#173a42', py: '#24484f' }, fog: 0.6 });
  const gx0 = -15.8;
  const gx1 = -12.2;
  const gz0 = NORTH.fenceZ + 0.3;
  const gz1 = gz0 + 2.4;
  for (const [x, z] of [[gx0, gz0], [gx1, gz0], [gx0, gz1], [gx1, gz1]]) box(post, [x - 0.04, 0, z - 0.04], [x + 0.04, 2.1, z + 0.04], true);
  box(mesh, [gx0, 0.05, gz1 - 0.01], [gx1 - 1.3, 1.9, gz1 + 0.01], true);
  box(mesh, [gx0 - 0.01, 0.05, gz0], [gx0 + 0.01, 1.9, gz1], true);
  box(P({ color: { py: '#2c5257', ny: '#173238', side: '#1f4047' }, fog: 0.6 }), [gx0 - 0.15, 2.1, gz0 - 0.1], [gx1 + 0.15, 2.18, gz1 + 0.25]);
  contact(b, gx0, gz0, gx1, gz1, 0.05);
  for (let i = 0; i < 4; i++) {
    const x = gx0 + 0.5 + i * 0.75;
    const bag = P({ color: { side: i % 2 ? '#3f6f70' : '#4a7b78', py: '#5a8b86' }, fog: 0.6 });
    b.mesh(new THREE.SphereGeometry(0.33, 10, 8).scale(1, 0.85, 1), bag, [x, 0.3, gz0 + 0.6 + (i % 2) * 0.5], { shadow: false });
  }
  // キュービクル（高圧の受電設備）とその柵
  const cub = P({ color: { side: '#2a5560', py: '#356570', nz: '#24505a' }, fog: 0.6 });
  box(cub, [-10.6, 0.15, -39.6], [-7.4, 2.3, -38.3], true);
  contact(b, -10.6, -39.6, -7.4, -38.3, 0.2);
  box(P({ color: '#1a3c46', fog: 0.6 }), [-10.6, 0, -39.6], [-7.4, 0.15, -38.3]);
  for (let x = -10.4; x < -7.6; x += 0.8) box(P({ color: '#1f4650', fog: 0.6 }), [x, 0.4, -38.29], [x + 0.6, 2.0, -38.28]);
  box(P({ color: '#a8812f', fog: 0.6 }), [-9.2, 1.6, -38.27], [-8.9, 1.8, -38.26]);
  // キュービクルの柵（柱・上下の桟・縦の格子。当たり判定は柵の面）
  const fenceMat = P({ color: { side: '#1b3c44', py: '#24484f' }, fog: 0.6 });
  const fenceBar = P({ color: { side: '#1f444c' }, fog: 0.6, side: THREE.DoubleSide });
  for (const [a, c] of [[[-11.2, -37.6], [-6.8, -37.6]], [[-11.2, -37.6], [-11.2, -40.2]], [[-6.8, -37.6], [-6.8, -40.2]]] as [[number, number], [number, number]][]) {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const dx = (c[0] - a[0]) / len;
    const dz = (c[1] - a[1]) / len;
    for (let t = 0; t <= len + 1e-3; t += len / Math.max(1, Math.round(len / 1.5))) {
      const x = a[0] + dx * t;
      const z = a[1] + dz * t;
      box(fenceMat, [x - 0.03, 0, z - 0.03], [x + 0.03, 1.85, z + 0.03]);
    }
    for (const y of [0.1, 1.75]) box(fenceMat, [Math.min(a[0], c[0]) - 0.02, y, Math.min(a[1], c[1]) - 0.02], [Math.max(a[0], c[0]) + 0.02, y + 0.05, Math.max(a[1], c[1]) + 0.02]);
    for (let t = 0.12; t < len; t += 0.15) {
      const x = a[0] + dx * t;
      const z = a[1] + dz * t;
      box(fenceBar, [x - 0.008, 0.15, z - 0.008], [x + 0.008, 1.75, z + 0.008]);
    }
    b.ctx.colliders.add({ x: Math.min(a[0], c[0]) - 0.05, y: 0, z: Math.min(a[1], c[1]) - 0.05 }, { x: Math.max(a[0], c[0]) + 0.05, y: 1.85, z: Math.max(a[1], c[1]) + 0.05 });
  }
  // 自転車 2 台（用務員さんの）・ホースの巻き取り
  bike(b, [-4.2, 0, -44.8], 0.3);
  bike(b, [-3.4, 0, -45.3], -0.2);

  // ---------------------------------------------------------------- 境界: 西の塀・北のフェンスと通用門
  // ブロック塀（40 × 20 cm の目地）
  const block = P({ color: { side: '#173238', py: '#22434a' }, layers: [{ color: '#173238', scale: 1, threshold: -2, only: 'wall' }], grid: { layer: 0, size: [0.4, 0.2], width: 0.012, color: '#132a30' }, fog: 0.6 });
  // 西棟の裏の細い土地への入口（鍵の掛かった門扉）と、裏庭の西の塀
  const wBack = wpos(WEST, WEST.u1, -WEST.depth);
  box(block, [-16.5, 0, wBack[1] - 0.2], [-16.3, 2.0, NORTH.fenceZ], true);
  box(block, [-16.5, 0, wBack[1] - 0.2], [wBack[0] - 1.2, 2.0, wBack[1]], true);
  const gateMat = P({ color: { side: '#1d4049', py: '#28525a' }, fog: 0.6 });
  for (let x = wBack[0] - 1.15; x < wBack[0] - 0.05; x += 0.12) box(gateMat, [x, 0.05, wBack[1] - 0.12], [x + 0.03, 1.6, wBack[1] - 0.08]);
  box(gateMat, [wBack[0] - 1.2, 1.55, wBack[1] - 0.14], [wBack[0], 1.62, wBack[1] - 0.06], true);
  box(gateMat, [wBack[0] - 1.2, 0, wBack[1] - 0.14], [wBack[0], 1.62, wBack[1] - 0.06], true);
  // 北のフェンス（低い基礎の上の金網）
  const fz = NORTH.fenceZ;
  const fb = P({ color: { side: '#183338', py: '#24444a', nz: '#1f4248' }, fog: 0.6 });
  const fpost = P({ color: { side: '#1c3d45', py: '#2a5057' }, fog: 0.6 });
  const fmesh = P({ color: { side: '#1d4049' }, fog: 0.6, side: THREE.DoubleSide });
  const fenceSeg = (x0: number, x1: number): void => {
    box(fb, [x0, 0, fz - 0.15], [x1, 0.45, fz + 0.15], true);
    for (let x = x0; x <= x1 + 1e-3; x += 2) box(fpost, [x - 0.03, 0.45, fz - 0.03], [x + 0.03, 2.4, fz + 0.03]);
    box(fpost, [x0, 2.36, fz - 0.03], [x1, 2.42, fz + 0.03]);
    // 金網（格子の線を細い箱で: 縦 0.1 m おきは重いので、板に縦の桟を 0.25 m おき）
    for (let x = x0 + 0.12; x < x1; x += 0.25) box(fmesh, [x - 0.008, 0.45, fz - 0.008], [x + 0.008, 2.36, fz + 0.008]);
    for (let y = 0.7; y < 2.36; y += 0.4) box(fmesh, [x0, y - 0.008, fz - 0.008], [x1, y + 0.008, fz + 0.008]);
    b.ctx.colliders.add({ x: x0, y: 0, z: fz - 0.1 }, { x: x1, y: 2.4, z: fz + 0.1 });
  };
  fenceSeg(-16.5, NORTH.gate[0] - 0.4);
  fenceSeg(NORTH.gate[1] + 1.4, CLUB.x[0]);
  box(fb, [CLUB.x[0] - 0.15, 0, CLUB.z[0] - 0.3], [CLUB.x[0] + 0.15, 2.4, fz], true);
  // 門柱（名札と呼び鈴）と引き戸の門扉（閉じて鍵）、横のくぐり戸（鍵）
  const pillar = P({ color: { side: '#1f3f45', py: '#2a5056', nz: '#24484e' }, fog: 0.6 });
  for (const x of [NORTH.gate[0] - 0.4, NORTH.gate[1] + 0.6, NORTH.gate[1] + 1.4]) box(pillar, [x - 0.25, 0, fz - 0.25], [x + 0.25, 2.2, fz + 0.25], true);
  box(P({ color: { nz: '#5d8f88', pz: '#5d8f88', side: '#2a5056' }, fog: 0.6 }), [NORTH.gate[0] - 0.62, 1.2, fz - 0.27], [NORTH.gate[0] - 0.18, 1.75, fz - 0.25]);
  box(P({ color: '#13262c', fog: 0.6 }), [NORTH.gate[1] + 0.95, 1.15, fz + 0.26], [NORTH.gate[1] + 1.05, 1.35, fz + 0.28]);
  const gateFrame = P({ color: { side: '#1f444c', py: '#2b555c', nz: '#24494f', pz: '#24494f' }, fog: 0.6 });
  const g0 = NORTH.gate[0] - 0.15;
  const g1 = NORTH.gate[1] + 0.35;
  box(gateFrame, [g0, 0.08, fz - 0.06], [g1, 0.16, fz + 0.06], true);
  box(gateFrame, [g0, 1.6, fz - 0.06], [g1, 1.68, fz + 0.06]);
  for (let x = g0; x < g1; x += 0.15) box(gateFrame, [x, 0.16, fz - 0.03], [x + 0.03, 1.6, fz + 0.03]);
  b.ctx.colliders.add({ x: g0, y: 0, z: fz - 0.1 }, { x: g1 + 0.9, y: 2.2, z: fz + 0.1 });
  // 門扉のレール
  box(P({ color: '#183238', fog: 0.6 }), [g0, 0, fz - 0.02], [g1 + 4.5, 0.02, fz + 0.02]);
  // くぐり戸
  for (let x = NORTH.gate[1] + 0.9; x < NORTH.gate[1] + 1.15; x += 0.12) box(gateFrame, [x, 0.1, fz - 0.03], [x + 0.03, 1.55, fz + 0.03]);
  // フェンスの内の植え込み
  for (let x = -15.5; x < NORTH.gate[0] - 1; x += 1.6) {
    const bush = P({ color: { side: '#122a30', py: '#1a3a40' }, fog: 0.6 });
    b.mesh(new THREE.SphereGeometry(0.6 + r() * 0.2, 9, 7).scale(1.2, 0.8, 0.9), bush, [x, 0.4, fz + 0.9], { shadow: false });
  }

  // ---------------------------------------------------------------- 敷地の外: 道路・電柱・向かいの建物
  const [sz0, sz1] = STREET.z;
  const stCov = { texture: groundSun(STREET_RECT, 2), rect: STREET_RECT };
  const road = P({ color: { py: '#13272f' }, cov: stCov, layers: [{ color: '#18323b', scale: 0.25, threshold: 0.6, only: 'floor' }, sunL('#386b6f', 13)] });
  box(road, [-60, -0.2, sz0], [60, -0.05, sz1 - STREET.walk]);
  const sidewalk = P({ color: { py: '#1a343c', side: '#142b33' }, cov: stCov, layers: [sunL('#5f9790', 14)], grid: { layer: 0, size: [0.3, 0.3], width: 0.015, color: '#386b6f' } });
  box(sidewalk, [-60, -0.2, sz1 - STREET.walk], [60, 0.0, sz1]);
  box(P({ color: { py: '#24444b', side: '#183238' } }), [-60, -0.2, sz1 - STREET.walk - 0.15], [60, 0.02, sz1 - STREET.walk]);
  const lineM = P({ color: '#5f8f8a' });
  for (let x = -58; x < 58; x += 6) box(lineM, [x, -0.05, (sz0 + sz1 - STREET.walk) / 2 - 0.07], [x + 3, -0.04, (sz0 + sz1 - STREET.walk) / 2 + 0.07]);
  box(lineM, [-60, -0.05, sz1 - STREET.walk - 0.6], [60, -0.04, sz1 - STREET.walk - 0.45]);
  // 向こう側の歩道
  box(sidewalk, [-60, -0.2, sz0 - 1.0], [60, 0.0, sz0]);
  // 電柱と電線（敷地の側の歩道）
  const poleM = P({ color: { side: '#2a5257', py: '#335e62' }, fog: 1 });
  const wireM = P({ color: '#1b3a40', fog: 1 });
  const poles = [-24, -2, 20];
  for (const x of poles) {
    b.cyl(poleM, [x, 5.5, sz1 - 0.6], 0.16, 11, { radiusTop: 0.12, segments: 10, shadow: false });
    box(poleM, [x - 0.9, 9.6, sz1 - 0.66], [x + 0.9, 9.72, sz1 - 0.54]);
    box(P({ color: { side: '#3a6a6c' }, fog: 1 }), [x - 0.25, 7.6, sz1 - 0.95], [x + 0.25, 8.4, sz1 - 0.4]);
  }
  for (let i = 0; i < poles.length - 1; i++) {
    for (const dx of [-0.8, 0, 0.8]) {
      const a = new THREE.Vector3(poles[i] + dx, 9.7, sz1 - 0.6);
      const c = new THREE.Vector3(poles[i + 1] + dx, 9.7, sz1 - 0.6);
      const curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3((a.x + c.x) / 2, 8.9, a.z), c);
      b.mesh(new THREE.TubeGeometry(curve, 16, 0.015, 3, false), wireM, [0, 0, 0], { shadow: false });
    }
  }
  // 街灯
  b.cyl(poleM, [-12, 2.6, sz1 - 0.4], 0.06, 5.2, { segments: 8, shadow: false });
  box(poleM, [-12.05, 5.1, sz1 - 1.6], [-11.95, 5.18, sz1 - 0.4]);
  box(P({ color: '#9fcdb9', fog: 1 }), [-12.15, 4.98, sz1 - 1.9], [-11.85, 5.1, sz1 - 1.3]);

  // 向かいの明るい高い建物（道路の向こう）
  const farTex = makeFarFacade(24, 46, {
    storey: 3.6,
    glass: [1.9, 3.3],
    mullion: 1.25,
    top: '#b9e9d1',
    bottom: '#9fd0bb',
    glassTop: '#cbfae4',
    glassBottom: '#b5e6cf',
    frame: '#9fcdb9',
  });
  // 西棟の斜めの屋根の影（午後の日。向かいの建物の下の方に斜めに落ちる）を壁の絵に描き足す
  shadowOnFar(farTex);
  const far = P({ color: { pz: '#b4e4cc', nx: '#d6fce7', px: '#d6fce7', py: '#c6f4dc' }, map: farTex, mapFace: 'pz', fog: 0 });
  box(far, [FAR.x[0], 0, FAR.z[0]], [FAR.x[1], FAR.h, FAR.z[1]]);
  box(P({ color: '#d6fce7' }), [FAR.x[0], 10, FAR.z[1] + 0.1], [FAR.x[0] + 0.35, FAR.h, FAR.z[1]]);
  // 窓の帯の下の庇（各階。近くから見ても平らな絵に見えないように）
  const ledge = P({ color: { pz: '#b4e4cc', py: '#c6f4dc', ny: '#8fbfaa', side: '#a6d6c0' }, fog: 0 });
  for (let y = 3.6 + 1.9; y < FAR.h - 1; y += 3.6) box(ledge, [FAR.x[0] + 0.4, y - 0.14, FAR.z[1]], [FAR.x[1], y, FAR.z[1] + 0.22]);
  // その左の明るい建物（左の校舎の屋根の上に見える）
  const farTex2 = makeFarFacade(28, 40, { storey: 3.4, glass: [1.6, 3.0], mullion: 1.4, top: '#b9e9d1', bottom: '#a3d3bf', glassTop: '#c6f5df', glassBottom: '#b2e2cc', frame: '#a3d0bd' });
  const far2 = P({ color: { pz: '#b4e4cc', nx: '#d6fce7', px: '#c8f2dc', py: '#c6f4dc' }, map: farTex2, mapFace: 'pz', fog: 0 });
  box(far2, [FAR.left.x[0], 0, FAR.z[0]], [FAR.left.x[1], FAR.left.h, FAR.z[1] + 3]);
  // 両側の遠くの建物（道路に沿って続く町並み）
  const town = P({ color: { pz: '#8fc0ae', px: '#a6d6c1', nx: '#a6d6c1', py: '#b4e4cc' }, fog: 0.4 });
  box(town, [21.8, 0, -72], [40, 22, FAR.z[1] - 1]);
  box(town, [-50, 0, -72], [-30, 18, FAR.z[1] + 2]);
  // 近くから見ても平らな板に見えないように形を足す（参考画像の視点から見える所は壁の絵のまま）
  buildFarRelief(b, view);
}

/** 自転車（簡単な形） */
export function bike(b: Builder, at: V3, yaw: number, color = '#2a5560'): void {
  const fr = P({ color: { side: color, py: color }, fog: 0.6 });
  const tyre = P({ color: '#0b1a1f', fog: 0.6 });
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material): void => {
    g.add(new THREE.Mesh(geo, m));
  };
  for (const x of [-0.55, 0.55]) add(new THREE.TorusGeometry(0.31, 0.025, 6, 20).translate(x, 0.33, 0), tyre);
  add(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 5).rotateZ(Math.PI / 2 - 0.25).translate(0, 0.55, 0), fr);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 5).rotateZ(0.35).translate(-0.18, 0.5, 0), fr);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5).rotateZ(-0.3).translate(0.5, 0.62, 0), fr);
  add(new THREE.BoxGeometry(0.22, 0.05, 0.1).translate(-0.3, 0.85, 0), tyre);
  add(new THREE.BoxGeometry(0.06, 0.04, 0.5).translate(0.58, 0.95, 0), fr);
  add(new THREE.BoxGeometry(0.3, 0.2, 0.28).translate(0.72, 0.8, 0), fr);
  for (const c of g.children) {
    const m = c as THREE.Mesh;
    m.geometry.rotateY(yaw);
    m.geometry.translate(...at);
    b.mesh(m.geometry, m.material as THREE.Material, [0, 0, 0], { shadow: false });
  }
}

/** 向かいの建物の壁の絵に、西棟の斜めの屋根の影を描き足す（壁の絵は 1 m = 16 画素、左下が建物の西の端・地面） */
function shadowOnFar(tex: THREE.CanvasTexture): void {
  const c = tex.image as HTMLCanvasElement;
  const g = c.getContext('2d')!;
  const P16 = 16;
  const H = c.height;
  // 壁の座標（x: 西の端から m、y: m）の多角形。元の版で「手前の屋根」として置いた形を、この壁の上に写した形
  // （参考画像では明るい建物の左下を斜めに隠す暗い面）
  const pts: [number, number][] = [
    [0, 0],
    [0, 15.5],
    [2.66, 11.28],
    [2.66, 0],
  ];
  g.fillStyle = '#4f8584';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x * P16, H - y * P16) : g.moveTo(x * P16, H - y * P16)));
  g.closePath();
  g.fill();
  tex.needsUpdate = true;
}
