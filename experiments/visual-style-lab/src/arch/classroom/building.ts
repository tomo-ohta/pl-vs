import * as THREE from 'three';
import { Prop } from '../../props/kit.ts';
import { extinguisher, trashBin } from '../../props/lib/index.ts';
import type { V3 } from '../../scenes/Builder.ts';
import { CH, CORR, DOORS, FL, MAT_Z1, MODULE, ROOM_D, ROOMS, STAIR, T_EXT, T_IN, WC, XN, Z_EAST, type DoorDef, type RoomDef } from './layout.ts';
import { PAL, propSink } from './mats.ts';
import { artRow, cleaningCabinet, deskPile, fluorescent, hookRail, noticeBoard, poster, saggingCable, steelLocker, wallSpeaker } from './props/school.ts';
import { drinkingFountain, emergencyLight, smokeDetector } from './props/fixtures.ts';
import { HALL, levelZone, wallRects, type Env, type LevelMats, type RectHole } from './shell.ts';

/**
 * 校舎の廊下まわり: 教室と廊下の間の壁（引き戸・欄間の型板ガラス・扉の枠と札）、北の窓（廊下の窓・枠・ガラス）、
 * 廊下の天井の蛍光灯・掲示・消火器・消火栓・非常口の表示・掃除用具入れ・手洗い場。どの階も同じ決まりで置く。
 */

const STORY = 3.6;

/** 扉の板（引き戸・開き戸）。原点は板の下の端の中心（引き戸）か吊り元（開き戸）、板は +x の向き・厚さは z */
function doorLeaf(lm: LevelMats, w: number, h: number, o: { window?: [number, number]; glass?: boolean; hinge?: boolean; solid?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const t = 0.035;
  const x0 = o.hinge ? 0 : -w / 2;
  const add = (m: THREE.Material, a: V3, c: V3): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(c[0] - a[0], c[1] - a[1], c[2] - a[2]), m);
    mesh.position.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  };
  const win = o.window ?? [1.15, 1.85];
  add(lm.frame, [x0, 0, -t / 2], [x0 + 0.07, h, t / 2]);
  add(lm.frame, [x0 + w - 0.07, 0, -t / 2], [x0 + w, h, t / 2]);
  add(lm.frame, [x0 + 0.07, h - 0.08, -t / 2], [x0 + w - 0.07, h, t / 2]);
  add(lm.wainscot, [x0 + 0.07, 0, -t / 2 + 0.006], [x0 + w - 0.07, win[0], t / 2 - 0.006]);
  add(lm.frame, [x0 + 0.07, win[0] - 0.05, -t / 2], [x0 + w - 0.07, win[0], t / 2]);
  add(lm.frame, [x0 + 0.07, win[1], -t / 2], [x0 + w - 0.07, h - 0.08, t / 2]);
  add(lm.frame, [x0 + w / 2 - 0.02, win[0], -t / 2], [x0 + w / 2 + 0.02, win[1], t / 2]);
  if (o.solid) {
    // 鉄の扉（防火戸）: 窓の所も鉄板。小さな覗き窓だけ暗い
    add(lm.wainscot, [x0 + 0.07, win[0], -t / 2 + 0.006], [x0 + w - 0.07, win[1], t / 2 - 0.006]);
    add(lm.dark, [x0 + w / 2 - 0.08, win[0] + 0.15, t / 2 - 0.004], [x0 + w / 2 + 0.08, win[0] + 0.35, t / 2 + 0.002]);
  } else {
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, win[1] - win[0]), o.glass === false ? lm.frosted : lm.glass);
    gp.position.set(x0 + w / 2, (win[0] + win[1]) / 2, 0);
    gp.layers.set(1);
    g.add(gp);
  }
  // 取っ手（くぼみ）
  add(lm.base, [o.hinge ? x0 + w - 0.12 : x0 + 0.05, 0.92, t / 2], [o.hinge ? x0 + w - 0.08 : x0 + 0.09, 1.08, t / 2 + 0.012]);
  return g;
}

/** 教室と廊下の間の壁の区画（欄間の区画と同じ割り付け）。window = 廊下側の窓（腰窓）・board = 掲示板の壁 */
export interface WallBay {
  z0: number;
  z1: number;
  /** 扉の無い区画: 窓か掲示板。扉の上の区画は欄間だけ */
  kind: 'window' | 'board' | 'door';
  room: RoomDef;
}

/**
 * 教室と廊下の間の壁（x = ROOM_D）の区画: 部屋ごとに、廊下に面する長さを 1.82 m の区画に割る（欄間は全部の区画）。
 * 扉の無い区画は、廊下側の窓（腰窓: 腰 1.0 m〜2.0 m・2 枚の引き違い）と掲示板の壁を交互に。物置き（教材室）は掲示板だけ。
 * 鍵の教室の窓は型板ガラス（中が見えない）
 */
export function corridorBays(level: 2 | 3): WallBay[] {
  const doors = DOORS[level].filter((d) => d.wall === 'cw');
  const out: WallBay[] = [];
  for (const r of ROOMS) {
    if (r.level !== level || r.kind === 'corridor') continue;
    const rc = r.rect2 ?? r.rect;
    if (rc[2] < ROOM_D - 0.01) continue;
    let k = 0;
    for (let z = rc[1] + 0.3; z + 1.2 <= rc[3] - 0.3; z += 1.82) {
      const z1 = Math.min(z + 1.7, rc[3] - 0.3);
      const hasDoor = doors.some((d) => d.at + d.width / 2 + 0.12 > z && d.at - d.width / 2 - 0.12 < z1);
      const kind = hasDoor ? 'door' : r.kind === 'material' ? 'board' : k++ % 2 === 0 ? 'window' : 'board';
      out.push({ z0: z, z1, kind, room: r });
    }
  }
  return out;
}

/** 窓の明るさの光だまり（床に置く薄い板）の材質: 床の仕上げを「日の当たった色」で（灯りの数の上限を使わない） */
export function patchMat(env: Env, level: 2 | 3): THREE.Material {
  const zone = levelZone(level);
  const P = PAL[zone];
  return env.mats.get(zone, P.floor.color, { unlit: true, tiles: HALL[zone].boards, key: 'patch' });
}

/** 廊下の床の、窓・扉のガラスを通った明るさ（教室の窓から入った海の明るさ。高さ 40° で北へ）。開口の高さ ya〜yb・幅 z0〜z1 */
function floorPatch(env: Env, m: THREE.Material, fl: number, ya: number, yb: number, z0: number, z1: number): void {
  const t = Math.tan((40 * Math.PI) / 180);
  const x0 = CORR[0] + ya / t;
  const x1 = Math.min(CORR[1] - 0.02, CORR[0] + yb / t);
  env.b.plane(m, [(x0 + x1) / 2, fl + 0.003, (z0 + z1) / 2], x1 - x0, z1 - z0, 'y', { shadow: false, layer: 1 });
}

/** 教室と廊下の間の壁（x = ROOM_D）: 引き戸の穴・欄間の帯（型板ガラス）・廊下側の窓・扉の枠・板・床の光だまり */
export function corridorWall(env: Env, lm: LevelMats, level: 2 | 3): void {
  const { b, ctx } = env;
  const fl = FL[level - 1];
  const doors = DOORS[level].filter((d) => d.wall === 'cw');
  const holes: RectHole[] = doors.map((d) => ({ u0: d.at - d.width / 2 - 0.04, u1: d.at + d.width / 2 + 0.04, y0: fl, y1: fl + 2.04 }));
  const bays = corridorBays(level);
  for (const q of bays) holes.push({ u0: q.z0, u1: q.z1, y0: fl + 2.2, y1: fl + 2.7 });
  for (const q of bays) if (q.kind === 'window') holes.push({ u0: q.z0, u1: q.z1, y0: fl + 1.0, y1: fl + 2.0 });
  const x = ROOM_D + T_IN / 2;
  wallRects(b, lm.wall, 'z', x, 0, Z_EAST, fl, fl + STORY - 0.3, T_IN, holes);
  // 腰の板（廊下側・教室側。扉の所は切る）と巾木
  const cuts = doors.map((d) => [d.at - d.width / 2 - 0.06, d.at + d.width / 2 + 0.06] as [number, number]).sort((p, q) => p[0] - q[0]);
  let z0 = 0;
  for (const [a, c] of [...cuts, [Z_EAST, Z_EAST] as [number, number]]) {
    if (a - z0 > 0.05) {
      for (const s of [-1, 1]) b.boxMM(lm.wainscot, [x + s * (T_IN / 2) - (s < 0 ? 0.012 : 0), fl, z0], [x + s * (T_IN / 2) + (s > 0 ? 0.012 : 0), fl + 0.9, a], { shadow: 'receive' });
      for (const s of [-1, 1]) b.boxMM(lm.base, [x + s * (T_IN / 2) - (s < 0 ? 0.02 : 0), fl + 0.88, z0], [x + s * (T_IN / 2) + (s > 0 ? 0.02 : 0), fl + 0.92, a], { shadow: 'receive' });
      for (const s of [-1, 1]) b.boxMM(lm.base, [x + s * (T_IN / 2) - (s < 0 ? 0.018 : 0), fl, z0], [x + s * (T_IN / 2) + (s > 0 ? 0.018 : 0), fl + 0.08, a], { shadow: 'receive' });
    }
    z0 = c;
  }
  // 欄間の枠と型板ガラス
  for (const q of bays) {
    const [a, c] = [q.z0, q.z1];
    for (const yy of [2.2, 2.66]) b.boxMM(lm.frame, [x - 0.07, fl + yy, a], [x + 0.07, fl + yy + 0.04, c], { shadow: true });
    const n = Math.max(2, Math.round((c - a) / 0.9));
    for (let k = 0; k <= n; k++) {
      const zz = a + ((c - a - 0.04) * k) / n;
      b.boxMM(lm.frame, [x - 0.07, fl + 2.2, zz], [x + 0.07, fl + 2.7, zz + 0.04], { shadow: true });
    }
    b.plane(lm.frosted, [x, fl + 2.45, (a + c) / 2], c - a, 0.46, 'x', { shadow: 'cast', layer: 1 });
  }
  // 廊下側の窓（引き違いの 2 枚: 枠・召し合わせの框・ガラス。鍵の教室は型板ガラス）と、その明るさの床の光だまり
  const pm = patchMat(env, level);
  for (const q of bays) {
    if (q.kind !== 'window') continue;
    const [a, c] = [q.z0, q.z1];
    const zc = (a + c) / 2;
    const y0 = fl + 1.0;
    const y1 = fl + 2.0;
    b.boxMM(lm.frame, [x - 0.07, y0, a], [x + 0.07, y0 + 0.04, c], { shadow: true });
    b.boxMM(lm.frame, [x - 0.07, y1 - 0.04, a], [x + 0.07, y1, c], { shadow: true });
    for (const zz of [a, c - 0.04]) b.boxMM(lm.frame, [x - 0.07, y0, zz], [x + 0.07, y1, zz + 0.04], { shadow: true });
    // 2 枚の障子（框と、前後にずれたガラス）
    for (const [za, zb, dx] of [[a + 0.04, zc + 0.02, -0.018], [zc - 0.02, c - 0.04, 0.018]] as [number, number, number][]) {
      b.boxMM(lm.frame, [x + dx - 0.015, y0 + 0.04, za], [x + dx + 0.015, y1 - 0.04, za + 0.035], { shadow: true });
      b.boxMM(lm.frame, [x + dx - 0.015, y0 + 0.04, zb - 0.035], [x + dx + 0.015, y1 - 0.04, zb], { shadow: true });
      b.boxMM(lm.frame, [x + dx - 0.015, y0 + 0.04, za], [x + dx + 0.015, y0 + 0.08, zb], { shadow: true });
      b.boxMM(lm.frame, [x + dx - 0.015, y1 - 0.08, za], [x + dx + 0.015, y1 - 0.04, zb], { shadow: true });
      b.plane(q.room.closed ? lm.frosted : lm.glass, [x + dx, (y0 + y1) / 2, (za + zb) / 2], zb - za - 0.07, y1 - y0 - 0.16, 'x', { shadow: false, layer: 1 });
    }
    ctx.colliders.add({ x: x - 0.07, y: y0, z: a }, { x: x + 0.07, y: y1, z: c });
    if (q.room.closed) continue;
    floorPatch(env, pm, fl, 1.08, 1.92, a + 0.08, zc - 0.03);
    floorPatch(env, pm, fl, 1.08, 1.92, zc + 0.03, c - 0.08);
  }
  // 引き戸（教室の内側に沿って滑る）と枠・室名札。鍵の無い扉は、ガラスの明るさの光だまり（2 枚）
  for (const d of doors) {
    door(env, lm, level, d);
    if (d.locked) continue;
    const w = d.width + 0.04;
    floorPatch(env, pm, fl, 1.15, 1.85, d.at - w / 2 + 0.07, d.at - 0.02);
    floorPatch(env, pm, fl, 1.15, 1.85, d.at + 0.02, d.at + w / 2 - 0.07);
  }
}

/** 1 枚の扉（壁ごとに向きを決める） */
export function door(env: Env, lm: LevelMats, level: 2 | 3, d: DoorDef): void {
  const { b } = env;
  const fl = FL[level - 1];
  const h = d.height ?? 2.0;
  if (d.wall === 'cw' || d.wall === 'mat') {
    const x = d.wall === 'cw' ? ROOM_D + T_IN / 2 : 4.05 + T_IN / 2;
    // 枠（上枠・縦枠）
    b.boxMM(lm.frame, [x - 0.08, fl + h, d.at - d.width / 2 - 0.05], [x + 0.08, fl + h + 0.05, d.at + d.width / 2 + 0.05], { shadow: true });
    for (const s of [-1, 1]) b.boxMM(lm.frame, [x - 0.08, fl, d.at + s * (d.width / 2 + 0.02) - 0.03], [x + 0.08, fl + h, d.at + s * (d.width / 2 + 0.02) + 0.03], { shadow: true });
    b.boxMM(lm.base, [x - 0.07, fl - 0.005, d.at - d.width / 2], [x + 0.07, fl + 0.01, d.at + d.width / 2], { shadow: 'receive' });
    // 引き戸: 板は局所の x に幅。yaw = 90° で局所の x が場面の -z（板が壁に沿う）。開くと -z へ滑る
    const leaf = doorLeaf(lm, d.width + 0.04, h - 0.02, {});
    env.doors.add({ leaf, pivot: [x - (d.wall === 'cw' ? 0.035 : -0.035), fl, d.at], yaw: Math.PI / 2, slide: d.width * 0.95, locked: d.locked, radius: 1.7 });
    if (d.wall === 'cw') {
      // 室名札（廊下側・扉の上に突き出す板。廊下の奥から見える）と、それを吊る金物
      const plate = env.mats.get(levelZone(level), '#cfe6e6', { key: 'plate' });
      const ink = env.mats.get(levelZone(level), '#2c4c66', { key: 'ink' });
      const px = x + T_IN / 2;
      b.boxMM(lm.frame, [px, fl + h + 0.38, d.at - 0.015], [px + 0.06, fl + h + 0.42, d.at + 0.015], { shadow: false });
      b.boxMM(plate, [px + 0.05, fl + h + 0.12, d.at - 0.012], [px + 0.47, fl + h + 0.38, d.at + 0.012], { shadow: true });
      for (const s of [-1, 1]) b.boxMM(ink, [px + 0.1, fl + h + 0.2, d.at + s * 0.013 - 0.001], [px + 0.42, fl + h + 0.3, d.at + s * 0.013 + 0.001], { shadow: false });
    }
    return;
  }
  if (d.wall === 'w' || d.wall === 'e') {
    const zf = d.wall === 'w' ? -T_EXT / 2 : Z_EAST + T_EXT / 2;
    b.boxMM(lm.frame, [d.at - d.width / 2 - 0.05, fl + h, zf - 0.08], [d.at + d.width / 2 + 0.05, fl + h + 0.06, zf + 0.08], { shadow: true });
    for (const s of [-1, 1]) b.boxMM(lm.frame, [d.at + s * (d.width / 2 + 0.02) - 0.03, fl, zf - 0.08], [d.at + s * (d.width / 2 + 0.02) + 0.03, fl + h, zf + 0.08], { shadow: true });
    if (d.kind === 'double') {
      for (const s of [-1, 1]) {
        const leaf = doorLeaf(lm, d.width / 2, h - 0.02, { window: [1.2, 1.7], solid: true, hinge: true });
        leaf.rotation.y = s > 0 ? Math.PI : 0;
        const g = new THREE.Group();
        g.add(leaf);
        env.doors.add({ leaf: g, pivot: [d.at + s * d.width / 2, fl, zf], yaw: 0, locked: true });
      }
      // 防火戸の上の表示（非常口ではない: 鍵）
      return;
    }
    const leaf = doorLeaf(lm, d.width, h - 0.02, { window: [1.25, 1.75], hinge: true });
    const g = new THREE.Group();
    g.add(leaf);
    // 吊り元は北側（x の大きい方）。外（-z）へ開く
    leaf.rotation.y = Math.PI;
    env.doors.add({ leaf: g, pivot: [d.at + d.width / 2, fl, zf], yaw: 0, swing: d.wall === 'w' ? -1.4 : 1.4, locked: d.locked, radius: 1.6 });
  }
}

/** 北の窓（廊下の窓）の位置（z の範囲） */
export function northSpans(): [number, number][] {
  const out: [number, number][] = [];
  for (let z = 1.2; z < Z_EAST - 1; z += MODULE) {
    const c = z + 0.9;
    if (c > STAIR[1] - 0.8 && c < WC[3] + 0.8) continue;
    out.push([c - 0.8, c + 0.8]);
  }
  return out;
}

/** 北の窓の寸法（泡・筋の決まりに渡す。窓台は廊下側へ 0.12 m） */
export const NORTH_SPEC = { sill: 0.9, head: 2.2, transom: [2.2, 2.2] as [number, number], pier0: 0, pierW: 0.3, sashes: 2, mullW: 0.04, pierProj: 0, ledge: 0.12 };

/** 北の窓（廊下の窓）の枠とガラス・窓台 */
export function northWindows(env: Env, lm: LevelMats, level: 2 | 3): void {
  const { b } = env;
  const fl = FL[level - 1];
  const x = XN + T_EXT / 2;
  for (let z = 1.2; z < Z_EAST - 1; z += MODULE) {
    const c = z + 0.9;
    if (c > STAIR[1] - 0.8 && c < WC[3] + 0.8) continue;
    const a = c - 0.8;
    const e = c + 0.8;
    for (const yy of [0.9, 2.16]) b.boxMM(lm.frame, [x - 0.05, fl + yy, a], [x + 0.05, fl + yy + 0.04, e], { shadow: true });
    for (const zz of [a, c - 0.02, e - 0.04]) b.boxMM(lm.frame, [x - 0.05, fl + 0.9, zz], [x + 0.05, fl + 2.2, zz + 0.04], { shadow: true });
    b.boxMM(lm.sill, [XN - 0.12, fl + 0.86, a], [XN + 0.02, fl + 0.9, e], { shadow: true });
    b.plane(lm.glass, [x, fl + 1.55, c], 1.6, 1.26, '-x', { shadow: false, layer: 1 });
    // 外の面: 水切り（窓台の外）と、その両端の下の雨の筋
    b.boxMM(lm.sill, [XN + T_EXT, fl + 0.86, a - 0.04], [XN + T_EXT + 0.07, fl + 0.9, e + 0.04], { shadow: true });
    for (const zz of [a + 0.02, e - 0.02]) streakX(b, rainMat(env, level), XN + T_EXT + 0.002, zz, fl + 0.86, 0.75, 0.05);
    // 窓の形の光だまり（階段室の窓と同じ決まり: 高さ 40° で部屋の内へ。竪框で 2 つに分かれる）
    const pm = patchMat(env, level);
    const t = Math.tan((40 * Math.PI) / 180);
    const x0 = Math.max(CORR[0] + 0.02, XN - 2.12 / t);
    const x1 = XN - 0.98 / t;
    for (const [za, zb] of [[a + 0.06, c - 0.04], [c + 0.04, e - 0.06]] as [number, number][]) b.plane(pm, [(x0 + x1) / 2, fl + 0.0035, (za + zb) / 2], x1 - x0, zb - za, 'y', { shadow: false, layer: 1 });
  }
}

/** 外の面の雨の筋の材質（壁より 1 段暗い色。階ごと） */
export function rainMat(env: Env, level: number): THREE.Material {
  const zone = levelZone(level);
  return env.mats.get(zone, zone === 'deep' ? '#3a6a84' : '#1f5c68', { shade: zone === 'deep' ? '#1a3550' : '#0a2c38', dark: zone === 'deep' ? '#163049' : '#082634', key: 'rain' });
}

/** 雨の筋（+x を向く外の面: 窓台の端の下。下ほど細い板） */
export function streakX(b: Env['b'], m: THREE.Material, x: number, z: number, yTop: number, len: number, w: number): void {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x, yTop, z + w / 2, x, yTop, z - w / 2, x, yTop - len, z - w * 0.15, x, yTop - len, z + w * 0.15], 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  b.mesh(g, m, [0, 0, 0], { shadow: 'receive' });
}

/**
 * 外壁の階の帯（床の高さの水平の帯: 北の面）と、外壁の目地（RC の打継ぎ目地 = 窓の上の高さの水平の溝・誘発目地 = 柱の位置の縦の溝）。
 * 北の面は階段室と便所の塔の所を切る。西の面は窓・扉の穴を避ける
 */
export function floorBand(env: Env, lm: LevelMats, level: 2 | 3): void {
  const fl = FL[level - 1];
  const b = env.b;
  const xf = XN + T_EXT;
  for (const [a, c] of [[-T_EXT, STAIR[1] - T_EXT], [WC[3] + T_EXT, Z_EAST + T_EXT]] as [number, number][]) {
    b.boxMM(lm.sill, [xf, fl - 0.12, a], [xf + 0.04, fl + 0.12, c], { shadow: true });
    b.boxMM(lm.dark, [xf, fl + 2.44, a], [xf + 0.004, fl + 2.46, c], { shadow: false });
  }
  for (let z = 1.2 + 0.9 + 1.15; z < Z_EAST; z += MODULE) {
    if (z > STAIR[1] - T_EXT - 0.1 && z < WC[3] + T_EXT + 0.1) continue;
    b.boxMM(lm.dark, [xf, fl + 0.12, z - 0.01], [xf + 0.004, fl + 3.48, z + 0.01], { shadow: false });
  }
  // 西の面（バルコニー側）: 窓の上の高さの水平の目地と、教室と廊下の間の壁の位置の縦の目地
  const zw = -T_EXT - 0.004;
  b.boxMM(lm.dark, [-T_EXT, fl + 2.88, zw], [XN + T_EXT, fl + 2.9, -T_EXT], { shadow: false });
  for (const x of [SMALL_GRID, ROOM_D + T_IN / 2]) b.boxMM(lm.dark, [x - 0.01, fl + 0.05, zw], [x + 0.01, fl + 2.88, -T_EXT], { shadow: false });
}
const SMALL_GRID = 4.11;

/** 廊下の作り込み: 天井の蛍光灯（1 灯の列）・掲示板・消火器・消火栓・非常口の表示・掃除用具入れ・手洗い場・ごみ箱 */
export function corridorDress(env: Env, lm: LevelMats, level: 2 | 3): void {
  const { b, mats, ctx } = env;
  const fl = FL[level - 1];
  const zone = levelZone(level);
  const pm = mats.props(zone);
  const sink = propSink(b, ctx);
  const xc = (CORR[0] + CORR[1]) / 2;
  const P = PAL[zone];
  // 天井の蛍光灯（廊下の中心・3.6 m おき）と灯りの光だまり
  for (let z = 1.8; z < Z_EAST - 1; z += 3.6) {
    fluorescent(Prop.at(sink, pm, [xc, fl + CH, z], 0, 7), { len: 1.25, body: P.ceil.color, tube: zone === 'deep' ? '#9cc4d4' : '#7fc8cc' });
  }
  // 廊下側の壁（教室の壁 x = CORR[0]）の掲示板と、北の壁の下の物
  const onS = (z: number, y: number, seed: number): Prop => Prop.at(sink, pm, [CORR[0], fl + y, z], Math.PI / 2, seed);
  const onN = (z: number, y: number, seed: number): Prop => Prop.at(sink, pm, [CORR[1], fl + y, z], -Math.PI / 2, seed);
  let seed = 500 + level * 100;
  // 教室側の壁: 掲示板の区画に掲示板とその上の絵・習字の列、窓の区画は窓の下の腰にフック掛け（決まり: 区画ごと）
  for (const q of corridorBays(level)) {
    const zc = (q.z0 + q.z1) / 2;
    const w = q.z1 - q.z0 - 0.1;
    if (q.kind === 'board') {
      noticeBoard(onS(zc, 1.35, seed++), { w, h: 0.75 });
      artRow(onS(zc, 1.95, seed++), { w, n: Math.max(3, Math.round(w / 0.36)), h: 0.3, kind: seed % 3 === 0 ? 'calli' : 'draw' });
      // 使わない机を掲示板の前に寄せる（机 1 台と、上に逆さの椅子・横に積んだ椅子。教室の机と同じ色）
      deskPile(Prop.at(sink, pm, [CORR[0] + 0.27, fl, zc + 0.4], Math.PI / 2, seed++), { n: 1, top: P.desk.color, edge: P.deskEdge, frame: P.deskFrame, seat: P.seat });
    } else if (q.kind === 'window') {
      hookRail(onS(zc, 0.8, seed++).sub([0, 0, 0.012]), { w: w - 0.1, n: 6 });
    }
  }
  // 北の壁: 窓の上（窓の上枠と梁の間）に絵・習字の列（窓ごと）、窓の間の壁にポスターと時間割
  for (const [za, zb] of northSpans()) artRow(onN((za + zb) / 2, 2.45, seed++), { w: 1.6, n: 4, kind: seed % 4 === 0 ? 'calli' : 'draw' });
  for (const [za, zb] of northSpans()) {
    poster(onN(zb + 0.4, 1.6, seed++), { w: 0.42, h: 0.6 });
    if (seed % 2) poster(onN(za - 0.35, 1.75, seed++), { w: 0.3, h: 0.42 });
  }
  // 北の壁の決まり: 窓の下（腰）は低いスチールのロッカーの列（窓ごと）。背の高い物は窓の無い壁へ
  // （階段室の口の西 = 消火栓と消火器、口の東 = 掃除用具入れと分別のごみ箱、便所の扉の東 = 水飲み場と手洗い場）
  const lockerCol = zone === 'deep' ? '#5f8fa2' : '#3f8a96';
  for (const [za, zb] of northSpans()) steelLocker(onN((za + zb) / 2, 0, seed++).sub([0, 0, 0.19]), { cols: 4, h: 0.84, body: lockerCol });
  hydrantBox(env, lm, level, CORR[1], 15.35);
  extinguisher(onN(14.65, 0, seed++).sub([0, 0, 0.12]));
  cleaningCabinet(onN(20.15, 0, seed++).sub([0, 0, 0.27]), { body: lockerCol });
  trashBin(onN(20.95, 0, seed++).sub([0, 0, 0.25]), { kind: 'recycle', n: 2, body: zone === 'deep' ? '#6f9aa6' : '#4f9aa0', lid: zone === 'deep' ? '#3f6f86' : '#2f6f78' });
  washStand(env, lm, level, CORR[1], 25.6);
  wallSpeaker(Prop.at(sink, pm, [CORR[1], fl + 2.6, 3.45], -Math.PI / 2, seed++));
  // 寄せた机と椅子の山（決まり: 廊下の両端。西の端の扉の手前と、東の防火戸の手前の教室側）
  const dk = { top: P.desk.color, edge: P.deskEdge, frame: P.deskFrame, seat: P.seat };
  deskPile(Prop.at(sink, pm, [CORR[0] + 0.3, fl, 1.6], Math.PI / 2, seed++), { n: 2, ...dk });
  deskPile(Prop.at(sink, pm, [CORR[0] + 0.3, fl, Z_EAST - 1.1], Math.PI / 2, seed++), { n: 2, ...dk });
  // 天井から垂れたケーブル（決まり: 梁の間ごとに 1 本。端が外れて垂れる所も）
  for (let z = 1.8; z < Z_EAST - 2.6; z += MODULE) saggingCable(Prop.at(sink, pm, [CORR[0] + 0.7 + ((z * 7) % 3) * 0.3, fl + CH - 0.32, z], 0, seed++), { len: 1.9, sag: 0.25 + ((z * 13) % 5) * 0.08, tail: ((z * 11) % 4) < 1.2 });
  // 天井の梁（壁柱の間隔で廊下を横切る）と、北の壁に沿う配管
  for (let z = 1.15; z < Z_EAST; z += MODULE) b.boxMM(lm.wall, [CORR[0], fl + CH - 0.32, z - 0.15], [CORR[1], fl + CH, z + 0.15], { shadow: true });
  for (const [dx, r] of [[0.18, 0.045], [0.32, 0.03]] as [number, number][]) b.cyl(lm.base, [CORR[1] - dx, fl + CH - 0.14, Z_EAST / 2], r, Z_EAST, { axis: 'z', shadow: true });
  for (let z = 4.0; z < Z_EAST; z += 9.2) b.cyl(lm.base, [CORR[1] - 0.18, fl + CH / 2, z], 0.045, CH, { shadow: true });
  // 蛍光灯の真下の床の四角い光だまり（廊下の幅いっぱい・器具の前後 1 m。縁は硬い。床と腰の下の方だけ）
  for (let z = 1.8; z < Z_EAST - 1; z += 3.6) {
    ctx.addLamp({ pos: [xc, fl + 1.2, z], radius: 3.2, intensity: 0.8, box: [CORR[0] + 0.02, fl - 0.1, z - 1.0, CORR[1] - 0.02, fl + 0.45, z + 1.0], down: true, square: true, hard: true, color: '#c8eef4', shadow: 0 });
  }
  // 天井の設備（梁の間ごと）: 非常灯と煙感知器を交互に
  let kk = 0;
  for (let z = 2.3; z < Z_EAST - 0.5; z += MODULE) {
    if (kk++ % 2 === 0) emergencyLight(Prop.at(sink, pm, [xc - 0.55, fl + CH, z], 0, seed++));
    else smokeDetector(Prop.at(sink, pm, [xc + 0.45, fl + CH, z], 0, seed++));
  }
  // 北の壁の腰の帯（窓の下の腰と同じ高さ 0.9 m）・見切り・巾木。階段室の口と便所の扉は切る
  for (const [a, c] of [[0, STAIR[1] + 0.8], [STAIR[3] - 0.8, WC[1] + 0.75], [WC[1] + 1.65, Z_EAST]] as [number, number][]) {
    b.boxMM(lm.wainscot, [CORR[1] - 0.012, fl, a], [CORR[1], fl + 0.9, c], { shadow: 'receive' });
    b.boxMM(lm.base, [CORR[1] - 0.022, fl + 0.88, a], [CORR[1], fl + 0.92, c], { shadow: 'receive' });
    b.boxMM(lm.base, [CORR[1] - 0.018, fl, a], [CORR[1], fl + 0.08, c], { shadow: 'receive' });
  }
  // 水飲み場（便所の扉と手洗い場の間）
  drinkingFountain(onN(23.3, 0, seed++).sub([0, 0, 0.225]), { w: 1.4, steel: zone === 'deep' ? '#8fb4c4' : '#6fb0b8' });
  // 非常口の表示（西の端の扉の上・廊下の天井から下げる緑の箱）
  exitSign(env, level, xc, 0.15, 'w');
  exitSign(env, level, xc, (STAIR[1] + STAIR[3]) / 2, 'stair');
  void MAT_Z1;
  void T_IN;
}

/** 消火栓の箱（赤い扉・表示灯）。壁の面 x = wx（-x を向く） */
function hydrantBox(env: Env, lm: LevelMats, level: number, wx: number, z: number): void {
  const fl = FL[level - 1];
  const red = env.mats.get(levelZone(level), '#b2545c', { key: 'red' });
  env.b.boxMM(red, [wx - 0.18, fl + 0.6, z - 0.4], [wx, fl + 1.6, z + 0.4], { shadow: true });
  env.b.boxMM(lm.frame, [wx - 0.19, fl + 0.65, z - 0.36], [wx - 0.18, fl + 1.55, z + 0.36], { shadow: 'receive' });
  const lamp = env.mats.get(levelZone(level), '#c06a64', { unlit: true, key: 'redlamp' });
  env.b.cyl(lamp, [wx - 0.03, fl + 1.78, z], 0.05, 0.06, { axis: 'x', shadow: false });
}

/** 手洗い場（ステンレスの長い流し・蛇口 4 つ・鏡・下の配管）。壁の面 x = wx */
function washStand(env: Env, lm: LevelMats, level: number, wx: number, z: number): void {
  const fl = FL[level - 1];
  const zone = levelZone(level);
  const steel = env.mats.get(zone, zone === 'deep' ? '#8fb4c4' : '#6fb0b8', { key: 'steel' });
  const b = env.b;
  b.boxMM(steel, [wx - 0.5, fl + 0.72, z - 1.0], [wx, fl + 0.8, z + 1.0], { shadow: true, collide: true });
  b.boxMM(lm.dark, [wx - 0.46, fl + 0.73, z - 0.96], [wx - 0.04, fl + 0.801, z + 0.96], { shadow: 'receive' });
  b.boxMM(steel, [wx - 0.5, fl + 0.6, z - 1.0], [wx - 0.47, fl + 0.8, z + 1.0], { shadow: true });
  for (const s of [-1, 1]) b.boxMM(lm.base, [wx - 0.45, fl, z + s * 0.9 - 0.04], [wx - 0.05, fl + 0.72, z + s * 0.9 + 0.04], { shadow: true, collide: true });
  for (let k = 0; k < 4; k++) {
    const zz = z - 0.75 + k * 0.5;
    b.cyl(steel, [wx - 0.06, fl + 0.95, zz], 0.012, 0.16, { shadow: false });
    b.cyl(steel, [wx - 0.13, fl + 1.02, zz], 0.009, 0.15, { axis: 'x', shadow: false });
  }
  // 鏡（蛇口ごとに 1 枚・金属の縁）
  const mirror = env.mats.get(zone, zone === 'deep' ? '#4f8aa6' : '#3f96a2', { key: 'mirror', unlit: true });
  for (let k = 0; k < 4; k++) {
    const zz = z - 0.75 + k * 0.5;
    b.boxMM(steel, [wx - 0.012, fl + 1.12, zz - 0.2], [wx, fl + 1.58, zz + 0.2], { shadow: 'receive' });
    b.boxMM(mirror, [wx - 0.016, fl + 1.14, zz - 0.18], [wx - 0.012, fl + 1.56, zz + 0.18], { shadow: 'receive' });
  }
}

/** 非常口の表示（緑の光る箱・白い人の形は板で） */
function exitSign(env: Env, level: number, x: number, z: number, kind: 'w' | 'stair'): void {
  const fl = FL[level - 1];
  const zone = levelZone(level);
  const green = env.mats.get(zone, '#3a9f78', { unlit: true, key: 'exit' });
  const white = env.mats.get(zone, '#bfe8d8', { unlit: true, key: 'exitw' });
  const b = env.b;
  if (kind === 'w') {
    b.boxMM(green, [x - 0.2, fl + 2.3, z], [x + 0.2, fl + 2.45, z + 0.06], { shadow: false });
    b.boxMM(white, [x - 0.12, fl + 2.33, z + 0.061], [x - 0.04, fl + 2.42, z + 0.062], { shadow: false });
  } else {
    b.boxMM(green, [x - 0.03, fl + 2.5, z - 0.2], [x + 0.03, fl + 2.65, z + 0.2], { shadow: false });
    b.boxMM(white, [x - 0.031, fl + 2.53, z - 0.12], [x + 0.031, fl + 2.62, z - 0.04], { shadow: false });
    b.cyl(env.mats.get(zone, '#2c4c66', { key: 'rod' }), [x, fl + 2.82, z], 0.01, 0.36, { shadow: false });
  }
}
