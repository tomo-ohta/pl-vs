import * as THREE from 'three';
import { rng, type Builder, type PartOptions, type V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { seatRow } from './furniture.ts';
import { region, tubeAdder } from './region.ts';
import type { Tube } from './glow.ts';
import { instanced, strut, trs, tuftGeometry } from './kit.ts';
import { A, BLD, D, FREIGHT, LANE, PLAZA, ROAD, SITE, TRACK, Y } from './layout.ts';
import type { Mats } from './mats.ts';
import { signGeo, signUV, type SignKind } from './signs.ts';

/**
 * 構外と構内の端: 駅前広場・西へ出る道と踏切・旧踏切道（station-2 の場所）・ホームの端・旧貨物ホームと倉庫・
 * 野原の農道・電柱・農作業小屋・歩ける範囲の用水路。
 * 見えないように置く所の決まり（plan.ts の notes）: station-1 は |x| < 0.9|z|（z < 0）、station-3 は |x| < 0.52(z − 12)（z > 12）、
 * station-2 は x > -23.7 かつ |z − 51.4| < 0.52(x + 23.7)、station-0 は |x + 62| < 0.44(z − 29.3)（z > 29.3）の中に物を置かない
 */
export function buildSite(ctx: SceneContext, root: THREE.Object3D, mat: Mats, rand: () => number, tubes: Tube[] = []): void {
  const col = ctx.colliders;
  // 場所ごとにまとめる（画角の外の場所は描かない）。下の道具は今の場所の b を使う
  let b!: Builder;
  const at = (noReflect: boolean, fn: () => void): void => {
    region(ctx, root, noReflect, (rb) => {
      b = rb;
      fn();
    });
  };
  /** 掲示物の板（角の座標で。まとめた絵の範囲を貼る） */
  const signMM = (kind: SignKind, a: V3, c: V3, face: 1 | -1 = 1, o: PartOptions = {}): void => {
    const size: [number, number, number] = [Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), Math.abs(c[2] - a[2])];
    // 薄い向きが x の板は、絵が横（z）に流れるように回す（face = 表が向く x の向き）
    if (size[0] < size[2]) b.mesh(signGeo(kind, [size[2], size[1], size[0]]), mat.signLit, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], { rotY: (face * Math.PI) / 2, ...o });
    else b.mesh(signGeo(kind, size), mat.signLit, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], o);
  };

  /**
   * 盛り土の道（上面 y = road、両側は 1:2 の法面）。along = 道の向き、[a0, a1] = 長手の範囲、c = 横の中心、w = 上の幅。
   * 当たり判定は上の箱と、両側の 0.3 m の段（野原から歩いて上がれる）
   */
  const bank = (along: 'x' | 'z', a0: number, a1: number, c: number, w: number, top: THREE.Material, sides: [boolean, boolean] = [true, true]): void => {
    const h = Y.road - Y.ground;
    const sh = new THREE.Shape();
    const L = sides[0] ? w / 2 + h * 2 : w / 2;
    const R = sides[1] ? w / 2 + h * 2 : w / 2;
    sh.moveTo(-L, 0);
    sh.lineTo(-w / 2, h);
    sh.lineTo(w / 2, h);
    sh.lineTo(R, 0);
    sh.lineTo(-L, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: a1 - a0, bevelEnabled: false });
    // 断面は (横, 高さ)、押し出しは +z。along = 'x' なら横 = z、長手 = x
    if (along === 'x') {
      g.rotateY(Math.PI / 2);
      b.mesh(g, mat.gravel, [a0, Y.ground, c]);
    } else {
      b.mesh(g, mat.gravel, [c, Y.ground, a0]);
    }
    // 舗装の上面（少し上に重ねる）
    if (along === 'x') b.boxMM(top, [a0, Y.road - 0.02, c - w / 2 + 0.3], [a1, Y.road + 0.005, c + w / 2 - 0.3], { shadow: false });
    else b.boxMM(top, [c - w / 2 + 0.3, Y.road - 0.02, a0], [c + w / 2 - 0.3, Y.road + 0.005, a1], { shadow: false });
    const box = (u0: number, u1: number, y1: number): void => {
      if (along === 'x') col.add({ x: a0, y: Y.ground, z: c + u0 }, { x: a1, y: y1, z: c + u1 });
      else col.add({ x: c + u0, y: Y.ground, z: a0 }, { x: c + u1, y: y1, z: a1 });
    };
    box(-w / 2, w / 2, Y.road);
    if (sides[0]) box(-w / 2 - 0.6, -w / 2, Y.ground + h / 2);
    if (sides[1]) box(w / 2, w / 2 + 0.6, Y.ground + h / 2);
  };

  /** 電柱（コンクリート柱・腕木・碍子）。wires で次の電柱へ電線 */
  const poles: V3[][] = [];
  const pole = (x: number, z: number, base = Y.ground, rot = 0): V3 => {
    const h = 9.5;
    b.cyl(mat.poleConc, [x, base + h / 2, z], 0.13, h, { radiusTop: 0.09, segments: 8 });
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const [y, w] of [[base + h - 0.4, 1.8], [base + h - 1.2, 1.4]] as const) {
      b.box(mat.steel, [x, y, z], [w * c + 0.08 * Math.abs(s), 0.08, w * Math.abs(s) + 0.08 * Math.abs(c)]);
      for (const d of [-w / 2 + 0.1, 0, w / 2 - 0.1]) b.cyl(mat.board, [x + d * c, y + 0.1, z - d * s], 0.04, 0.12, { segments: 6 });
    }
    // 変圧器（ときどき）と足場の釘
    if (rand() < 0.3) b.cyl(mat.tin, [x + 0.35 * s, base + h - 2.6, z + 0.35 * c], 0.25, 0.8, { segments: 10 });
    for (let y = base + 2.5; y < base + h - 2; y += 0.45) b.box(mat.steel, [x, y, z], [0.3 * Math.abs(s) + 0.02, 0.02, 0.3 * Math.abs(c) + 0.02]);
    col.addCentered(x, base + 1.5, z, 0.3, 3, 0.3);
    return [x, base + h - 0.3, z];
  };
  const wires = (pts: V3[], drop = 0.35): void => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const c = pts[i + 1];
      for (const off of [-0.7, 0, 0.7]) {
        const dx = c[0] - a[0];
        const dz = c[2] - a[2];
        const len = Math.hypot(dx, dz);
        const nx = -dz / len;
        const nz = dx / len;
        const p0 = new THREE.Vector3(a[0] + nx * off, a[1], a[2] + nz * off);
        const p1 = new THREE.Vector3(c[0] + nx * off, c[1], c[2] + nz * off);
        const mid = p0.clone().lerp(p1, 0.5);
        mid.y -= drop;
        const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
        b.mesh(new THREE.TubeGeometry(curve, 8, 0.012, 3, false), mat.wire, [0, 0, 0], { shadow: false });
      }
    }
  };

  // ---------- 駅前広場（盛り土。駅舎の東） ----------
  at(true, () => {
    const { x0, x1, z0, z1 } = PLAZA;
    const h = Y.road - Y.ground;
    b.boxMM(mat.gravel, [x0, Y.ground, z0], [x1, Y.road - 0.02, z1]);
    b.boxMM(mat.asphalt, [x0 + 4, Y.road - 0.02, z0], [x1, Y.road + 0.005, z1], { shadow: false });
    col.add({ x: x0, y: Y.ground, z: z0 }, { x: x1, y: Y.road, z: z1 });
    // 駅舎の前の歩道（平板）と縁石
    b.boxMM(mat.curb, [x0, Y.road - 0.02, z0], [x0 + 4, Y.road + 0.12, z1], { shadow: false });
    col.add({ x: x0, y: Y.road, z: z0 }, { x: x0 + 4, y: Y.road + 0.12, z: z1 });
    for (let z = z0 + 0.5; z < z1; z += 0.5) b.box(mat.wallBase, [x0 + 2, Y.road + 0.122, z], [3.96, 0.004, 0.02], { shadow: false });
    // 北と南の法面（野原へ）
    for (const [za, zb] of [[z0 - h * 2, z0], [z1, z1 + h * 2]] as const) {
      const g = new THREE.BoxGeometry(x1 - x0, 0.1, Math.hypot(h, h * 2));
      const ang = Math.atan2(h, h * 2);
      b.mesh(g, mat.gravel, [(x0 + x1) / 2, Y.ground + h / 2, (za + zb) / 2], { rotX: za < z0 ? ang : -ang });
    }
    col.add({ x: x0, y: Y.ground, z: z1 }, { x: x1, y: Y.ground + h / 2, z: z1 + 0.6 });
    col.add({ x: x0, y: Y.ground, z: z0 - 0.6 }, { x: x1, y: Y.ground + h / 2, z: z0 });
    // 東の端の擁壁と構内の柵（金網）
    b.boxMM(mat.concrete, [x1, Y.ground, z0], [x1 + 0.25, Y.road + 0.15, z1]);
    fence(b, mat, [x1 + 0.12, z0], [x1 + 0.12, z1], Y.road + 0.15, 1.6);
    col.add({ x: x1, y: Y.ground, z: z0 }, { x: x1 + 0.25, y: Y.road + 2.2, z: z1 });
    // 白線: バスの乗り場（南）・タクシーの乗り場（中）・駐車の枠（北）
    const line = (xa: number, za: number, xb: number, zb: number): void => {
      b.boxMM(mat.paint, [Math.min(xa, xb), Y.road + 0.006, Math.min(za, zb)], [Math.max(xa, xb), Y.road + 0.01, Math.max(za, zb)], { shadow: false });
    };
    for (let z = 2; z <= 14; z += 2.5) line(x1 - 5.5, z, x1 - 0.5, z + 0.12);
    line(x1 - 5.5, 2, x1 - 5.38, 14.12);
    line(x0 + 4.4, 20, x0 + 4.52, 36);
    for (let z = 22; z < 36; z += 0.8) line(x0 + 4.5, z, x0 + 6.5, z + 0.08);
    // 中央の島（植え込みと時計の柱）
    {
      const cx = (x0 + x1) / 2 + 1;
      const cz = 18;
      b.boxMM(mat.curb, [cx - 3, Y.road, cz - 3], [cx + 3, Y.road + 0.2, cz + 3], { collide: true });
      b.boxMM(mat.hedge, [cx - 2.8, Y.road + 0.2, cz - 2.8], [cx + 2.8, Y.road + 0.75, cz + 2.8]);
      for (let i = 0; i < 9; i++) b.mesh(new THREE.IcosahedronGeometry(0.45 + rand() * 0.25, 0), mat.hedge, [cx - 2.2 + rand() * 4.4, Y.road + 0.8, cz - 2.2 + rand() * 4.4]);
      b.cyl(mat.steel, [cx, Y.road + 2.2, cz], 0.08, 3.6, { segments: 8 });
      b.cyl(mat.board, [cx, Y.road + 3.9, cz], 0.35, 0.12, { axis: 'x', segments: 20 });
      b.cyl(mat.board, [cx, Y.road + 3.9, cz], 0.35, 0.12, { axis: 'z', segments: 20 });
      col.addCentered(cx, Y.road + 1, cz, 6, 2, 6);
    }
    // バス停（南）: 標識と屋根付きのベンチ
    {
      const x = x1 - 1.6;
      const z = 30;
      b.cyl(mat.steel, [x, Y.road + 1.2, z - 3], 0.04, 2.4, { segments: 8 });
      {
        const g = signUV(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20), 'bus');
        g.rotateZ(Math.PI / 2);
        b.mesh(g, mat.signLit, [x, Y.road + 2.35, z - 3]);
      }
      b.boxMM(mat.board, [x - 0.05, Y.road + 0.9, z - 3.25], [x + 0.05, Y.road + 1.8, z - 2.75]);
      b.boxMM(mat.tin, [x - 1.2, Y.road + 2.3, z - 1.6], [x + 0.6, Y.road + 2.4, z + 1.8]);
      for (const dz of [-1.4, 1.6]) b.box(mat.steel, [x - 1.0, Y.road + 1.15, z + dz], [0.08, 2.3, 0.08]);
      b.boxMM(mat.glass, [x - 1.2, Y.road + 0.3, z - 1.6], [x - 1.15, Y.road + 2.3, z + 1.8], { shadow: false });
      col.add({ x: x - 1.25, y: Y.road, z: z - 1.6 }, { x: x - 1.1, y: Y.road + 2.3, z: z + 1.8 });
      seatRow(b, mat.benchT, mat.steel, [x - 0.6, Y.road, z + 0.1], -Math.PI / 2, 4, 0.55);
      col.add({ x: x - 0.9, y: Y.road, z: z - 1.1 }, { x: x - 0.3, y: Y.road + 0.9, z: z + 1.3 });
    }
    // タクシー乗り場の標識
    b.cyl(mat.steel, [x1 - 6, Y.road + 1.2, 14.6], 0.04, 2.4, { segments: 8 });
    b.boxMM(mat.yellow, [x1 - 6.04, Y.road + 2.0, 14.3], [x1 - 5.96, Y.road + 2.5, 14.9]);
    // 駐輪場（北）: 屋根と柱・ラック・自転車
    {
      const za = PLAZA.z0 + 0.8;
      const xa = x0 + 6;
      const xb = x0 + 18;
      b.boxMM(mat.tin, [xa, Y.road + 2.3, za], [xb, Y.road + 2.38, za + 3.2]);
      for (let x = xa + 0.2; x < xb; x += 3.9) for (const z of [za + 0.15, za + 3.0]) b.box(mat.steel, [x, Y.road + 1.15, z], [0.08, 2.3, 0.08], { collide: true });
      b.boxMM(mat.steel, [xa, Y.road + 0.3, za + 0.6], [xb, Y.road + 0.36, za + 0.66]);
      for (let x = xa + 0.6; x < xb - 0.3; x += 0.6) {
        if (rand() < 0.45) bike(b, mat, [x, Y.road, za + 1.5], Math.PI / 2 + (rand() - 0.5) * 0.15, rand);
        b.box(mat.steel, [x, Y.road + 0.2, za + 0.63], [0.03, 0.4, 0.03]);
      }
      col.add({ x: xa, y: Y.road, z: za + 0.5 }, { x: xb, y: Y.road + 1.0, z: za + 2.4 });
    }
    // 電話ボックス・郵便ポスト・自動販売機（入口の北）・案内図・街灯
    {
      const x = x0 + 5.2;
      const z = 27.5;
      b.boxMM(mat.sash, [x - 0.5, Y.road, z - 0.5], [x + 0.5, Y.road + 0.15, z + 0.5]);
      b.boxMM(mat.glass, [x - 0.48, Y.road + 0.15, z - 0.48], [x + 0.48, Y.road + 2.2, z + 0.48], { collide: true });
      b.boxMM(mat.sash, [x - 0.52, Y.road + 2.2, z - 0.52], [x + 0.52, Y.road + 2.42, z + 0.52]);
      b.boxMM(mat.green, [x - 0.2, Y.road + 0.95, z + 0.3], [x + 0.2, Y.road + 1.5, z + 0.47]);
      b.box(mat.signWhite, [x, Y.road + 2.31, z - 0.53], [0.7, 0.14, 0.02]);
      b.cyl(mat.red, [x0 + 3.2, Y.road + 0.75, 26.0], 0.22, 1.25, { segments: 14, collide: true });
      b.cyl(mat.red, [x0 + 3.2, Y.road + 1.4, 26.0], 0.25, 0.06, { segments: 14 });
      for (const zz of [12.0, 13.0]) {
        b.boxMM(mat.vending, [x0 + 0.15, Y.road + 0.12, zz - 0.45], [x0 + 0.95, Y.road + 1.95, zz + 0.45], { collide: true });
        b.box(mat.vendingLit, [x0 + 0.96, Y.road + 1.35, zz], [0.02, 0.6, 0.7], { shadow: false });
      }
      signMM('map', [x0 + 3.6, Y.road + 0.9, 8.0], [x0 + 3.68, Y.road + 2.0, 9.6]);
      for (const zz of [8.2, 9.4]) b.box(mat.steel, [x0 + 3.64, Y.road + 0.45, zz], [0.06, 0.9, 0.06]);
      for (const [lx, lz] of [[x0 + 4.2, 2], [x1 - 2, 4], [x1 - 2, 22], [x0 + 4.2, 34]] as const) lamp(b, mat, lx, Y.road + 0.12, lz);
    }
    // 駐車した軽自動車（タクシーの枠の脇）
    car(b, mat, [x1 - 3, Y.road, 8.5], Math.PI / 2);
    col.addCentered(x1 - 3, Y.road + 0.8, 8.5, 1.6, 1.6, 3.5);
    // ---------- 広場の細部（建築版で足した物。乱数は別の種） ----------
    // 横断歩道（歩道から中央の島へ）
    for (let k = 0; k < 5; k++) line(x0 + 4.2, 16.2 + k * 0.9, x0 + 9.8, 16.65 + k * 0.9);
    // 止まれの線・矢印（広場の出口）
    line(x0 + 4.2, PLAZA.z0 + 2.2, x1 - 0.4, PLAZA.z0 + 2.5);
    for (const zz of [5, 26]) {
      line(x0 + 13.6, zz, x0 + 13.75, zz + 2.4);
      for (const s of [-1, 1]) b.box(mat.paint, [x0 + 13.67 + s * 0.22, Y.road + 0.008, zz + 2.25], [0.08, 0.004, 0.6], { rotY: s * 0.6, shadow: false });
    }
    // マンホール（鉄の蓋と縁）
    for (const [mx, mz] of [[x0 + 7, 6], [x0 + 15, 28], [x0 + 20, 12.5], [x0 + 11, 33]] as const) {
      b.cyl(mat.steel, [mx, Y.road + 0.004, mz], 0.36, 0.012, { segments: 18, shadow: false });
      b.cyl(mat.black, [mx, Y.road + 0.009, mz], 0.31, 0.012, { segments: 18, shadow: false });
    }
    // 側溝の蓋（歩道の縁、5 m おき）
    for (let zz = z0 + 2.5; zz < z1 - 1; zz += 5) {
      b.boxMM(mat.black, [x0 + 4.05, Y.road + 0.004, zz - 0.3], [x0 + 4.45, Y.road + 0.012, zz + 0.3], { shadow: false });
      for (let k = 0; k < 5; k++) b.box(mat.steel, [x0 + 4.25, Y.road + 0.014, zz - 0.24 + k * 0.12], [0.36, 0.006, 0.03], { shadow: false });
    }
    // 送迎の車（歩道の脇に寄せて止めた 2 台）
    car(b, mat, [x0 + 5.6, Y.road, 9.6], 0, mat.roofT);
    car(b, mat, [x0 + 5.6, Y.road, 13.9], 0);
    for (const zz of [9.6, 13.9]) col.addCentered(x0 + 5.6, Y.road + 0.8, zz, 1.6, 1.6, 3.5);
    // 車止めの柱（入口の前の歩道の縁。反射の帯）
    for (let zz = 13.8; zz <= 23.9; zz += 1.4) {
      b.cyl(mat.steel, [x0 + 3.75, Y.road + 0.52, zz], 0.05, 0.8, { segments: 8, collide: true });
      b.cyl(mat.signWhite, [x0 + 3.75, Y.road + 0.82, zz], 0.052, 0.08, { segments: 8, shadow: false });
    }
    // 歩道の若い木（木の枡の鉄の格子と、冬枯れの細い木）
    {
      const r2 = rng(311);
      for (const zz of [4.0, 31.5]) {
        b.boxMM(mat.black, [x0 + 2.2, Y.road + 0.12, zz - 0.6], [x0 + 3.4, Y.road + 0.13, zz + 0.6], { shadow: false });
        bareTree(b, mat, x0 + 2.8, zz, 4.2, r2, Y.road + 0.12);
        col.addCentered(x0 + 2.8, Y.road + 1, zz, 0.4, 2, 0.4);
      }
    }
  });

  // ---------- 西へ出る道（駅舎と D の北を通り、0 番線を踏切で渡る） ----------
  at(true, () => {
    const zc = (ROAD.z0 + ROAD.z1) / 2;
    const w = ROAD.z1 - ROAD.z0;
    const xc = TRACK.t0;
    // 踏切の前後は線路の高さへ下りる（盛り土を切る）
    bank('x', PLAZA.x0 - 0.5, xc + 6.5, zc, w, mat.asphalt, [true, true]);
    bank('x', SITE.x0 - 30, xc - 6.5, zc, w, mat.asphalt, [true, true]);
    // 踏切の前後の坂（-0.55 → レールの高さ）と踏切の板
    for (const s of [-1, 1]) {
      const xa = xc + s * 6.5;
      const xb = xc + s * 2.2;
      const steps = 4;
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps;
        const t1 = (k + 1) / steps;
        const y = Y.road + (Y.rail - Y.road) * ((k + 1) / steps);
        const xA = xa + (xb - xa) * t0;
        const xB = xa + (xb - xa) * t1;
        b.boxMM(mat.asphalt, [Math.min(xA, xB), Y.ground, ROAD.z0], [Math.max(xA, xB), y, ROAD.z1], { collide: true });
      }
    }
    b.boxMM(mat.asphalt, [xc - 2.2, Y.ground, ROAD.z0], [xc + 2.2, Y.rail - 0.01, ROAD.z1], { collide: true });
    // 踏切の板（レールの間と外のゴムの板）
    b.boxMM(mat.black, [xc - 0.62, Y.rail - 0.012, ROAD.z0], [xc + 0.62, Y.rail + 0.002, ROAD.z1], { shadow: false });
    for (const s of [-1, 1]) b.boxMM(mat.black, [xc + s * 0.6 - 0.35, Y.rail - 0.012, ROAD.z0], [xc + s * 0.6 + 0.35, Y.rail + 0.002, ROAD.z1], { shadow: false });
    // 警報機と遮断機（道の両側、線路の手前）
    for (const s of [-1, 1]) {
      const x = xc + s * 3.2;
      const z = s < 0 ? ROAD.z1 + 0.6 : ROAD.z0 - 0.6;
      crossingSignal(b, mat, x, z, s);
      col.addCentered(x, Y.road + 1.5, z, 0.4, 3, 0.4);
    }
    // 踏切の注意の看板（坂の手前）
    for (const s of [-1, 1]) {
      const x = xc + s * 9;
      const z = s < 0 ? ROAD.z1 + 0.5 : ROAD.z0 - 0.5;
      b.cyl(mat.steel, [x, Y.road + 1.1, z], 0.04, 2.2, { segments: 8 });
      signMM('warn', [x - 0.03, Y.road + 1.6, z - 0.45], [x + 0.03, Y.road + 2.2, z + 0.45], s < 0 ? -1 : 1);
    }
    // 道の外側線（白線。踏切の前後は切る）
    for (const zl of [ROAD.z0 + 0.45, ROAD.z1 - 0.45]) {
      for (const [xa, xb] of [[SITE.x0 - 30, xc - 7], [xc + 7, PLAZA.x0 - 0.5]] as const) b.boxMM(mat.paint, [xa, Y.road + 0.006, zl - 0.07], [xb, Y.road + 0.012, zl + 0.07], { shadow: false });
    }
    // 道の西の端: 通行止め（霧の向こうの工事。歩ける範囲の端）
    {
      const x = SITE.x0 + 1.5;
      for (const dz of [-1.5, 0, 1.5]) {
        b.boxMM(mat.signWhite, [x - 0.05, Y.road + 0.5, zc + dz - 0.6], [x + 0.05, Y.road + 0.7, zc + dz + 0.6]);
        b.boxMM(mat.red, [x - 0.06, Y.road + 0.55, zc + dz - 0.3], [x + 0.06, Y.road + 0.65, zc + dz + 0.3]);
        for (const e of [-0.5, 0.5]) strut(b, mat.steel, [x - 0.4, Y.road, zc + dz + e], [x, Y.road + 0.75, zc + dz + e], 0.04, 0.04);
      }
      signMM('closed', [x + 0.1, Y.road + 1.0, zc - 1.4], [x + 0.14, Y.road + 1.5, zc + 1.4]);
      b.cyl(mat.redLit, [x, Y.road + 0.85, zc + 2.3], 0.08, 0.16, { segments: 10 });
    }
    // 電柱（道の南側、30 m おき）と電線。広場へ続く
    const pts: V3[] = [];
    for (let x = SITE.x0 + 6; x < PLAZA.x0 - 2; x += 26) pts.push(pole(x, ROAD.z1 + 1.6, Y.ground, 0));
    pts.push(pole(PLAZA.x0 + 1.0, PLAZA.z0 + 0.6, Y.road, 0));
    poles.push(pts);
  });
  // 広場の東の柵の外の電柱（広場から南へ、旧踏切道の脇まで）
  at(true, () => {
    const pts: V3[] = [poles[0][poles[0].length - 1]];
    for (const z of [10, 34]) pts.push(pole(PLAZA.x1 - 0.8, z, Y.road, Math.PI / 2));
    pts.push(pole(LANE.x0 - 1.4, 46, Y.ground, Math.PI / 2));
    poles.push(pts);
  });
  at(true, () => {
    for (const p of poles) wires(p);
  });

  // ---------- 旧踏切道（広場の南。線路の手前で行き止まり。station-2 の場所） ----------
  at(true, () => {
    const xc = (LANE.x0 + LANE.x1) / 2;
    bank('z', PLAZA.z1, LANE.z1 + 1.5, xc, LANE.x1 - LANE.x0, mat.asphalt);
    // 行き止まりの車止め（南の端）と、もと踏切だった東の口の柵（station-2 の画角の下）
    for (const dx of [-1.2, 0, 1.2]) b.box(mat.steel, [xc + dx, Y.road + 0.4, LANE.z1 + 1.2], [0.1, 0.8, 0.1], { collide: true });
    b.boxMM(mat.signWhite, [xc - 1.6, Y.road + 0.6, LANE.z1 + 1.15], [xc + 1.6, Y.road + 0.75, LANE.z1 + 1.25]);
    for (let x = xc - 1.5; x < xc + 1.5; x += 0.6) b.boxMM(mat.red, [x, Y.road + 0.6, LANE.z1 + 1.14], [x + 0.3, Y.road + 0.75, LANE.z1 + 1.26]);
    col.add({ x: LANE.x0, y: Y.road, z: LANE.z1 + 1.1 }, { x: LANE.x1, y: Y.road + 2, z: LANE.z1 + 1.3 });
    // 東の口: 低い柵（高さ 1.0 m。station-2 の画角の下の端より低い）と、廃止の掲示
    const xe = LANE.x1 - 0.1;
    for (let z = 49.6; z <= 53.3; z += 1.2) b.box(mat.steel, [xe, Y.road + 0.5, z], [0.06, 1.0, 0.06]);
    for (const y of [0.45, 0.95]) b.boxMM(mat.fence, [xe - 0.03, Y.road + y - 0.03, 49.6], [xe + 0.03, Y.road + y + 0.03, 53.3]);
    col.add({ x: xe - 0.1, y: Y.road, z: 49.4 }, { x: xe + 0.1, y: Y.road + 2, z: 53.4 });
    signMM('deadend', [xe - 0.6, Y.road + 0.15, 50.6], [xe - 0.56, Y.road + 0.55, 52.4], -1);
    // 道の東の縁のガードレール（広場から行き止まりまで）
    for (let z = PLAZA.z1 + 0.5; z < 49.4; z += 2) b.box(mat.steel, [xe, Y.road + 0.35, z], [0.08, 0.7, 0.08]);
    b.boxMM(mat.signWhite, [xe - 0.02, Y.road + 0.5, PLAZA.z1 + 0.5], [xe + 0.02, Y.road + 0.8, 49.4]);
    col.add({ x: xe - 0.1, y: Y.road, z: PLAZA.z1 }, { x: xe + 0.1, y: Y.road + 2, z: 49.4 });
  });

  // ---------- ホームの端（スロープ・柵・扉）。ホームの床に映る（層 0） ----------
  at(false, () => {
  // A の北端・南端: 線路の高さへ下りる関係者用のスロープ（1:8）と柵の扉（開いている）
  for (const [z, dir] of [[A.z0, -1], [A.z1, 1]] as const) {
    const run = (Y.top - Y.ground) * 8;
    const n = 8;
    for (let k = 0; k < n; k++) {
      const za = z + dir * (k * run) / n;
      const zb = z + dir * ((k + 1) * run) / n;
      const y = Y.top - ((k + 1) * (Y.top - Y.ground)) / n;
      b.boxMM(mat.concrete, [-1.0, Y.ground, Math.min(za, zb)], [1.0, y, Math.max(za, zb)], { collide: true });
    }
    // 端の柵（扉の所は開いている）と「関係者以外立入禁止」
    for (const s of [-1, 1]) {
      fence(b, mat, [s * 1.1, z], [s * A.half, z], 0, 1.2);
      col.add({ x: Math.min(s * 1.1, s * A.half), y: 0, z: z - 0.05 }, { x: Math.max(s * 1.1, s * A.half), y: 2, z: z + 0.05 });
      // スロープの手すり
      b.boxMM(mat.steel, [s * 1.05 - 0.03, Y.ground + 0.9, Math.min(z, z + dir * run)], [s * 1.05 + 0.03, 1.0, Math.max(z, z + dir * run)]);
    }
    b.boxMM(mat.signWhite, [-1.0, 1.25, z - 0.02], [1.0, 1.55, z + 0.02]);
    // 扉（開いて柵に沿わせてある）
    b.boxMM(mat.fence, [0.95, 0.05, z + dir * 0.1], [1.0, 1.15, z + dir * 1.0]);
  }
  // D の東の縁（駅舎の南）と北の端: 柵（駅舎の北は道へ落ちないように）
  {
    const x = D.x + D.half;
    fence(b, mat, [x - 0.1, BLD.z1], [x - 0.1, D.z1 - 0.4], 0, 1.2);
    col.add({ x: x - 0.2, y: 0, z: BLD.z1 }, { x: x, y: 2, z: D.z1 - 0.4 });
    fence(b, mat, [D.x - D.half + 1.6, D.z0 + 0.1], [x, D.z0 + 0.1], 0, 1.2);
    col.add({ x: D.x - D.half + 1.5, y: 0, z: D.z0 }, { x, y: 2, z: D.z0 + 0.2 });
    b.boxMM(mat.signWhite, [D.x - 1.2, 1.25, D.z0 + 0.06], [D.x + 1.2, 1.55, D.z0 + 0.14]);
  }
  // 駅名標: A は大屋根の梁から吊る（station-1・station-3 の視点の後ろ。線路に向けて両面）、D は柱 2 本で立てる（線路に向く）
  {
    for (const s of [-1, 1]) {
      const x = s * 2.35;
      // 両面（線路側とホームの中ほどの側）。大屋根の下は暗いので内照式（光る板）
      b.mesh(signGeo('ekimei', [1.9, 0.63, 0.02]), mat.signGlow, [x + s * 0.012, 2.55, 1.1], { rotY: s * Math.PI / 2 });
      b.mesh(signGeo('ekimei', [1.9, 0.63, 0.02]), mat.signGlow, [x - s * 0.012, 2.55, 1.1], { rotY: -s * Math.PI / 2 });
      b.boxMM(mat.housing, [x - 0.06, 2.2, 0.1], [x + 0.06, 2.24, 2.1]);
      b.boxMM(mat.housing, [x - 0.06, 2.86, 0.1], [x + 0.06, 2.9, 2.1]);
      for (const z of [0.4, 1.8]) b.box(mat.steel, [x, 3.7, z], [0.02, 1.6, 0.02]);
    }
    const xd = D.x - 4.2;
    b.mesh(signGeo('ekimei', [1.9, 0.63, 0.04]), mat.signLit, [xd, 1.75, 16], { rotY: -Math.PI / 2 });
    b.mesh(signGeo('ekimei', [1.9, 0.63, 0.04]), mat.signLit, [xd + 0.05, 1.75, 16], { rotY: Math.PI / 2 });
    for (const z of [15.15, 16.85]) {
      b.box(mat.steel, [xd + 0.025, 0.85, z], [0.06, 1.7, 0.06], { collide: true });
    }
    b.boxMM(mat.steel, [xd - 0.03, 2.06, 15.0], [xd + 0.08, 2.1, 17.0]);
    // A の階段の囲いの外の面: 時刻表（大屋根の下、station-1・station-3 の後ろ）
    for (const sx of [-1, 1]) {
      const x = sx * 1.37;
      b.mesh(signGeo('timetable', [1.1, 0.8, 0.02]), mat.signLit, [x, 0.6, 7.2], { rotY: sx * Math.PI / 2 });
      b.mesh(signGeo('posters', [1.4, 0.7, 0.02]), mat.signLit, [x, 0.6, 9.5], { rotY: sx * Math.PI / 2 });
    }
    // 駅舎の西の壁（D 側）: 時刻表とお知らせの掲示板
    b.mesh(signGeo('notice', [3.0, 1.0, 0.03]), mat.signLit, [BLD.x0 - 0.12, 1.6, 23.6], { rotY: -Math.PI / 2 });
    b.mesh(signGeo('timetable', [1.3, 1.0, 0.03]), mat.signLit, [BLD.x0 - 0.12, 1.6, 1.8], { rotY: -Math.PI / 2 });
    b.boxMM(mat.wood, [BLD.x0 - 0.1, 1.05, 21.95], [BLD.x0, 2.15, 25.25]);
  }
  });

  // ---------- 構内（本線の西の柵の中）: 信号機器室・ケーブルの溝 ----------
  at(false, () => {
    b.boxMM(mat.wallExt, [-15.0, Y.ground, 19.5], [-12.2, Y.ground + 2.6, 24.0], { collide: true });
    b.boxMM(mat.roofTile, [-15.2, Y.ground + 2.6, 19.3], [-12.0, Y.ground + 2.8, 24.2]);
    b.box(mat.doorLeaf, [-12.18, Y.ground + 1.0, 22.6], [0.04, 2.0, 0.9]);
    b.box(mat.steel, [-12.15, Y.ground + 2.2, 20.5], [0.1, 0.3, 0.4]);
    // ケーブルの溝（トラフ）: 1 番線の西を南北に
    b.boxMM(mat.curb, [-8.2, Y.ground, -12], [-7.8, Y.ground + 0.18, 42]);
  });

  // ---------- 旧貨物ホームと倉庫（7 番線の西。いまは農協の倉庫） ----------
  at(true, () => {
    const { x0, x1, z0, z1 } = FREIGHT;
    b.boxMM(mat.concreteW, [x0, Y.ground, z0], [x1, -0.16, z1]);
    b.boxMM(mat.coping, [x0, -0.16, z0], [x1, 0, z1]);
    col.add({ x: x0, y: Y.ground, z: z0 }, { x: x1, y: 0, z: z1 });
    // 倉庫（切妻・トタン張り・引き戸）
    const wx0 = x0;
    const wx1 = x0 + 8;
    const wz0 = z0 + 4;
    const wz1 = z1 - 4;
    b.boxMM(mat.tin, [wx0, 0, wz0], [wx1, 4.2, wz1], { collide: true });
    for (let z = wz0 + 0.15; z < wz1; z += 0.3) b.box(mat.wallBase, [wx1 + 0.01, 2.1, z], [0.02, 4.2, 0.04], { shadow: false });
    const ridgeH = 5.6;
    for (const s of [-1, 1]) {
      const run = 4.6;
      const ang = Math.atan2(ridgeH - 4.2, run);
      b.box(mat.rust, [(wx0 + wx1) / 2 + s * run / 2, (4.2 + ridgeH) / 2 + 0.05, (wz0 + wz1) / 2], [Math.hypot(run, ridgeH - 4.2), 0.1, wz1 - wz0 + 0.6], { rotZ: -s * ang });
    }
    for (const zc of [wz0 + 4, wz1 - 4]) {
      b.box(mat.doorLeaf, [wx1 + 0.05, 1.5, zc], [0.06, 3.0, 3.0]);
      b.box(mat.steel, [wx1 + 0.08, 3.05, zc], [0.08, 0.08, 3.4]);
    }
    signMM('ja', [wx1 + 0.06, 3.4, (wz0 + wz1) / 2 - 2.6], [wx1 + 0.1, 3.95, (wz0 + wz1) / 2 + 2.6]);
    // 裏（西）の小さな戸・高窓・換気口と、妻の換気の格子
    b.box(mat.doorLeaf, [wx0 - 0.03, 1.0, (wz0 + wz1) / 2 + 3], [0.05, 2.0, 0.9]);
    for (const dz of [-6, -2, 2, 6]) b.box(mat.glass, [wx0 - 0.03, 3.2, (wz0 + wz1) / 2 + dz], [0.04, 0.5, 1.2], { shadow: false });
    for (const z of [wz0 - 0.03, wz1 + 0.03]) b.box(mat.wallBase, [(wx0 + wx1) / 2, 4.7, z], [1.0, 0.5, 0.04]);
    for (let z = wz0 + 2; z < wz1; z += 4) b.box(mat.rust, [wx0 - 0.04, 2.0, z], [0.02, 4.0, 0.25], { shadow: false });
    // 荷役の上屋（ホームの縁の上に張り出す）
    b.boxMM(mat.tin, [wx1, 3.4, wz0], [x1 + 0.6, 3.5, wz1]);
    for (let z = wz0 + 1; z < wz1; z += 4.5) strut(b, mat.steel, [wx1, 2.6, z], [x1 + 0.3, 3.4, z], 0.08, 0.08);
    // ホームの上の物: パレット・米袋の山・リヤカー
    for (let i = 0; i < 6; i++) {
      const z = z0 + 2 + rand() * (z1 - z0 - 4);
      const x = wx1 + 0.8 + rand() * 1.6;
      b.boxMM(mat.wood, [x - 0.55, 0, z - 0.55], [x + 0.55, 0.14, z + 0.55]);
      if (rand() < 0.6) b.boxMM(mat.signWhite, [x - 0.45, 0.14, z - 0.45], [x + 0.45, 0.14 + 0.25 * (1 + Math.floor(rand() * 3)), z + 0.45]);
    }
    // 南の端のスロープ（道へ）
    for (let k = 0; k < 4; k++) {
      const y = 0 - (k + 1) * ((0 - Y.road) / 4);
      b.boxMM(mat.concrete, [x0 + 9, Y.ground, z1 + k * 0.6], [x1, y, z1 + (k + 1) * 0.6], { collide: true });
    }
    // 荷役の上屋の下の蛍光灯（3 つ）・半分開いた引き戸の暗がり・軒の雨樋と縦の管・ドラム缶（建築版で足した物）
    {
      const addT = tubeAdder(b, mat, tubes);
      for (const z of [wz0 + 3, (wz0 + wz1) / 2, wz1 - 3]) {
        b.box(mat.housing, [wx1 + 1.9, 3.36, z], [0.3, 0.06, 1.3], { shadow: false });
        addT([wx1 + 1.9, 3.3, z], 1.1, 'z', 0.06, 0.04, true);
      }
      b.box(mat.black, [wx1 + 0.03, 1.45, wz1 - 1.8], [0.02, 2.9, 1.3], { shadow: false });
      b.boxMM(mat.steel, [wx1 + 0.02, 0.0, wz0 + 0.5], [wx1 + 0.12, 0.06, wz1 - 0.5], { shadow: false });
      for (const xg of [wx0 - 0.12, wx1 + 0.12]) b.boxMM(mat.steel, [xg - 0.07, 4.05, wz0 - 0.3], [xg + 0.07, 4.17, wz1 + 0.3], { shadow: false });
      for (const [xg, zg] of [[wx0 - 0.12, wz0 - 0.2], [wx0 - 0.12, wz1 + 0.2], [wx1 + 0.12, wz0 - 0.2]] as const) b.cyl(mat.steel, [xg, 2.05, zg], 0.05, 4.1, { segments: 8 });
      for (let k = 0; k < 5; k++) {
        const dz = wz0 - 2.2 + (k % 3) * 0.62;
        const dx = wx1 + 2.6 + Math.floor(k / 3) * 0.62;
        b.cyl(k % 2 ? mat.roofT : mat.rust, [dx, 0.44, dz], 0.29, 0.88, { segments: 14, collide: true });
        b.cyl(mat.black, [dx, 0.885, dz], 0.27, 0.01, { segments: 14, shadow: false });
      }
    }
    // 軽トラック
    truck(b, mat, [x0 - 3, Y.ground, z1 - 6], 0.1);
    col.addCentered(x0 - 3, Y.ground + 0.9, z1 - 6, 1.6, 1.8, 3.6);
  });

  // ---------- 野原: 農道・農作業小屋・電柱 ----------
  at(true, () => {
    // 西の農道（道から南へ。station-0 の画角より西を通り、z 80 で西へ折れる）
    const xw = -96;
    bank('z', ROAD.z1 + 0.6, 80, xw, 3.0, mat.gravel);
    bank('x', SITE.x0 - 10, xw - 1.5, 81.5, 3.0, mat.gravel);
    shed(b, mat, [-91, Y.ground, 22], 0.0, rand);
    shed(b, mat, [-90.5, Y.ground, 62], Math.PI / 2, rand);
    col.addCentered(-91, Y.ground + 1.5, 22, 4.4, 3, 6.4);
    col.addCentered(-90.5, Y.ground + 1.5, 62, 6.4, 3, 4.4);
    const pts: V3[] = [];
    for (let z = ROAD.z1 + 8; z < 80; z += 28) pts.push(pole(xw + 2.4, z, Y.ground, Math.PI / 2));
    wires([poles[0][0], ...pts]);
    // 北西の農道（道から北へ、旧貨物ホームの西）
    bank('z', SITE.z0 - 10, ROAD.z0 - 0.6, -94, 3.0, mat.gravel);
    shed(b, mat, [-89, Y.ground, -62], Math.PI / 2, rand);
    col.addCentered(-89, Y.ground + 1.5, -62, 6.4, 3, 4.4);
    // 東の農道（構内の東。station-1 と station-2 の画角の外で南北に、行き止まりの畑の入口）
    bank('z', -28, 14, 30, 3.0, mat.gravel);
    shed(b, mat, [35.5, Y.ground, -20], 0.0, rand);
    col.addCentered(35.5, Y.ground + 1.5, -20, 4.4, 3, 6.4);
    const pe: V3[] = [];
    for (const z of [-24, 4]) pe.push(pole(27.8, z, Y.ground, Math.PI / 2));
    wires(pe);
    // 屋敷林のような冬枯れの木の並び（西の農道の外）と、畑の中の木（東）・広場の隅の木
    for (let i = 0; i < 7; i++) bareTree(b, mat, -98.6 + (i % 2) * 1.3, 8 + i * 10 + rand() * 3, 7 + rand() * 4, rand);
    bareTree(b, mat, 35.5, -6, 8, rand);
    bareTree(b, mat, 38, 9, 6.5, rand);
    bareTree(b, mat, PLAZA.x1 - 2.5, PLAZA.z0 + 2.5, 7.5, rand);
    for (const [x, z] of [[-98.6, 8], [35.5, -6], [38, 9]] as const) col.addCentered(x, Y.ground + 1, z, 0.5, 2, 0.5);
    // 祠と小さな鳥居（西の農道の脇）
    shrine(b, mat, -92.0, 46.0);
    col.addCentered(-92.0, Y.ground + 0.8, 46.8, 1.6, 1.6, 1.6);
    // 稲わらのロール（畑の隅）
    for (const [x, z] of [[-84, 36], [-82, 39], [33, -6], [36, 8]] as const) {
      b.cyl(mat.signWhite, [x, Y.ground + 0.6, z], 0.6, 1.1, { axis: 'x', segments: 16 });
      col.addCentered(x, Y.ground + 0.6, z, 1.2, 1.2, 1.2);
    }
  });

  // ---------- 歩ける範囲の端の用水路（コンクリートの溝と水面）と、越えられない見えない壁 ----------
  at(true, () => {
    const y = Y.ground;
    const ch = (xa: number, za: number, xb: number, zb: number): void => {
      const along = Math.abs(xb - xa) > Math.abs(zb - za) ? 'x' : 'z';
      if (along === 'x') {
        b.boxMM(mat.curb, [xa, y - 0.02, za - 0.75], [xb, y + 0.08, za - 0.6]);
        b.boxMM(mat.curb, [xa, y - 0.02, za + 0.6], [xb, y + 0.08, za + 0.75]);
        b.boxMM(mat.water, [xa, y - 0.3, za - 0.6], [xb, y - 0.25, za + 0.6], { shadow: false });
        col.add({ x: xa, y: y - 1, z: za - 0.3 }, { x: xb, y: y + 3, z: za + 0.3 });
      } else {
        b.boxMM(mat.curb, [xa - 0.75, y - 0.02, za], [xa - 0.6, y + 0.08, zb]);
        b.boxMM(mat.curb, [xa + 0.6, y - 0.02, za], [xa + 0.75, y + 0.08, zb]);
        b.boxMM(mat.water, [xa - 0.6, y - 0.3, za], [xa + 0.6, y - 0.25, zb], { shadow: false });
        col.add({ x: xa - 0.3, y: y - 1, z: za }, { x: xa + 0.3, y: y + 3, z: zb });
      }
    };
    ch(SITE.x0, SITE.z0, SITE.x1, SITE.z0);
    ch(SITE.x0, SITE.z1, SITE.x1, SITE.z1);
    ch(SITE.x0, SITE.z0, SITE.x0, SITE.z1);
    ch(SITE.x1, SITE.z0, SITE.x1, SITE.z1);
  });

  // ---------- 野原の草の株（歩ける範囲の野原に散らす。道・線路・建物・広場の上には置かない） ----------
  at(true, () => {
    const ms: THREE.Matrix4[] = [];
    const tg = tuftGeometry(7, 5);
    const no: [number, number, number, number][] = [
      [-16.5, -200, 16.5, 200], // 本線と支線の構内
      [PLAZA.x0 - 1, PLAZA.z0 - 1.5, PLAZA.x1 + 1, PLAZA.z1 + 1.5],
      [BLD.x0 - 0.5, BLD.z0 - 0.5, BLD.x1, BLD.z1 + 0.5],
      [D.x - D.half - 3.8, D.z0 - 1, D.x + D.half, D.z1 + 1],
      [-200, ROAD.z0 - 2, PLAZA.x0, ROAD.z1 + 2],
      [LANE.x0 - 1.5, PLAZA.z1, LANE.x1 + 1.5, LANE.z1 + 2],
      [TRACK.t7 - 2.5, -200, TRACK.t0 + 2.5, 200],
      [FREIGHT.x0 - 6, FREIGHT.z0 - 2, FREIGHT.x1, FREIGHT.z1 + 4],
      [-98, -200, -92, 200],
      [-200, 79.5, -94, 83.5],
      [28, -30, 32, 16],
    ];
    const blocked = (x: number, z: number): boolean => no.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
    for (let i = 0; i < 9000; i++) {
      const x = SITE.x0 + 1 + rand() * (SITE.x1 - SITE.x0 - 2);
      const z = SITE.z0 + 1 + rand() * (SITE.z1 - SITE.z0 - 2);
      if (blocked(x, z)) continue;
      // 株の大きさは場所でむらを付ける（塊になって生える）
      const k = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.cos(z * 0.17) * 2.0) * Math.cos(z * 0.13 - x * 0.05);
      if (rand() > 0.35 + k * 0.65) continue;
      const h = 0.18 + rand() * 0.25 + k * 0.3;
      ms.push(trs(x, Y.ground, z, rand() * 6.28, h * (0.8 + rand() * 0.6), h, h * (0.8 + rand() * 0.6)));
    }
    instanced(b.root, tg, mat.grass, ms);
  });
}

/** 金網の柵（支柱と上下の横棒と網の目）。a → b、下端 y0、高さ h */
export function fence(b: Builder, mat: Mats, a: [number, number], c: [number, number], y0: number, h: number): void {
  const dx = c[0] - a[0];
  const dz = c[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return;
  const n = Math.max(1, Math.round(len / 2.4));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    b.box(mat.fence, [a[0] + dx * t, y0 + h / 2, a[1] + dz * t], [0.05, h, 0.05]);
  }
  const ax = Math.abs(dx) > Math.abs(dz);
  for (const y of [y0 + 0.1, y0 + h - 0.03]) {
    if (ax) b.boxMM(mat.fence, [Math.min(a[0], c[0]), y - 0.02, a[1] - 0.02], [Math.max(a[0], c[0]), y + 0.02, a[1] + 0.02]);
    else b.boxMM(mat.fence, [a[0] - 0.02, y - 0.02, Math.min(a[1], c[1])], [a[0] + 0.02, y + 0.02, Math.max(a[1], c[1])]);
  }
  // 網の目（斜めの細い線を粗く）
  for (let t = 0.15; t < len; t += 0.3) {
    const px = a[0] + (dx * t) / len;
    const pz = a[1] + (dz * t) / len;
    if (ax) b.box(mat.fence, [px, y0 + h / 2, pz], [0.01, h - 0.15, 0.01], { shadow: false });
    else b.box(mat.fence, [px, y0 + h / 2, pz], [0.01, h - 0.15, 0.01], { shadow: false });
  }
}

/** 自転車（2 つの輪・三角の骨組み・ハンドル・サドル） */
function bike(b: Builder, mat: Mats, p: V3, yaw: number, rand: () => number): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const P = (u: number, y: number): V3 => [p[0] + u * s, p[1] + y, p[2] + u * c];
  const m = rand() < 0.5 ? mat.steel : mat.red;
  for (const u of [-0.52, 0.52]) {
    const g = new THREE.TorusGeometry(0.33, 0.02, 4, 16);
    g.rotateY(yaw + Math.PI / 2);
    b.mesh(g, mat.black, P(u, 0.34), { shadow: false });
  }
  strut(b, m, P(-0.52, 0.34), P(0.0, 0.36), 0.03, 0.03);
  strut(b, m, P(0.0, 0.36), P(0.45, 0.82), 0.03, 0.03);
  strut(b, m, P(-0.52, 0.34), P(-0.12, 0.78), 0.03, 0.03);
  strut(b, m, P(-0.12, 0.78), P(0.42, 0.8), 0.03, 0.03);
  strut(b, m, P(0.52, 0.34), P(0.45, 0.82), 0.03, 0.03);
  b.box(mat.black, P(-0.14, 0.86), [0.12, 0.05, 0.12], { shadow: false });
  const hb = P(0.44, 0.92);
  b.box(mat.steel, hb, [0.5 * Math.abs(c) + 0.03, 0.03, 0.5 * Math.abs(s) + 0.03], { shadow: false });
}

/** 街灯（細い柱と腕・灯具。昼なので灯りは弱い） */
function lamp(b: Builder, mat: Mats, x: number, y: number, z: number): void {
  b.cyl(mat.steel, [x, y + 2.8, z], 0.07, 5.6, { segments: 8, collide: true });
  strut(b, mat.steel, [x, y + 5.5, z], [x + 0.9, y + 5.7, z], 0.06, 0.06);
  b.box(mat.housing, [x + 1.0, y + 5.6, z], [0.5, 0.12, 0.25]);
  b.box(mat.lampBox, [x + 1.0, y + 5.53, z], [0.4, 0.02, 0.18], { shadow: false });
}

/** 踏切の警報機と遮断機（柱・踏切警標・赤い灯 2 つ・方向の表示・遮断機の箱と上げた竿） */
function crossingSignal(b: Builder, mat: Mats, x: number, z: number, side: number): void {
  const y = Y.road;
  b.cyl(mat.signWhite, [x, y + 1.6, z], 0.07, 3.2, { segments: 10 });
  for (let k = 0; k < 6; k++) b.cyl(mat.black, [x, y + 0.3 + k * 0.5, z], 0.072, 0.25, { segments: 10 });
  // 踏切警標（黄と黒の X）
  for (const r of [0.6, -0.6]) {
    b.box(mat.yellow, [x - side * 0.05, y + 3.0, z], [0.04, 0.16, 1.1], { rotX: r });
    b.box(mat.black, [x - side * 0.06, y + 3.0, z], [0.03, 0.05, 1.12], { rotX: r });
  }
  // 赤い灯 2 つ（消えている）と覆い
  for (const dz of [-0.32, 0.32]) {
    b.cyl(mat.red, [x - side * 0.1, y + 2.4, z + dz], 0.13, 0.08, { axis: 'x', segments: 14 });
    b.box(mat.black, [x - side * 0.14, y + 2.52, z + dz], [0.16, 0.04, 0.3]);
  }
  b.box(mat.black, [x - side * 0.02, y + 2.4, z], [0.06, 0.12, 0.9]);
  b.box(mat.black, [x - side * 0.1, y + 1.95, z], [0.12, 0.22, 0.5]);
  b.cyl(mat.steel, [x, y + 3.35, z], 0.12, 0.12, { segments: 10 });
  // 遮断機（箱と、上げた竿）
  const bx = x + side * 0.5;
  b.box(mat.yellow, [bx, y + 0.55, z], [0.4, 1.1, 0.4]);
  b.box(mat.black, [bx, y + 1.12, z], [0.42, 0.06, 0.42]);
  for (let k = 0; k < 8; k++) b.box(k % 2 ? mat.black : mat.yellow, [bx, y + 1.2 + k * 0.45 + 0.22, z], [0.08, 0.45, 0.08]);
}

/** 農作業小屋（トタンの片流れ屋根・板の壁・開いた戸口） */
function shed(b: Builder, mat: Mats, p: V3, yaw: number, rand: () => number): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const L = (u: number, y: number, v: number): V3 => [p[0] + u * c + v * s, p[1] + y, p[2] - u * s + v * c];
  const W = 4.0;
  const Dp = 6.0;
  const g = new THREE.BoxGeometry(W, 2.6, Dp);
  b.mesh(g, rand() < 0.5 ? mat.wood : mat.tin, L(0, 1.3, 0), { rotY: yaw });
  b.mesh(new THREE.BoxGeometry(W + 0.6, 0.1, Dp + 0.6), mat.rust, L(0, 2.85, 0), { rotY: yaw, rotZ: 0.12 });
  b.mesh(new THREE.BoxGeometry(0.05, 2.0, 1.6), mat.black, L(W / 2 + 0.01, 1.0, 1.0), { rotY: yaw });
  for (let v = -Dp / 2 + 0.3; v < Dp / 2; v += 0.4) b.mesh(new THREE.BoxGeometry(0.02, 2.6, 0.03), mat.wallBase, L(W / 2 + 0.01, 1.3, v), { rotY: yaw, shadow: false });
}

/** 軽自動車（箱を重ねた形） */
function car(b: Builder, mat: Mats, p: V3, yaw: number, body: THREE.Material = mat.signWhite): void {
  const L = 3.4;
  b.mesh(new THREE.BoxGeometry(1.45, 0.75, L), body, [p[0], p[1] + 0.55, p[2]], { rotY: yaw });
  b.mesh(new THREE.BoxGeometry(1.35, 0.6, L * 0.55), mat.glass, [p[0] - Math.sin(yaw) * 0.25, p[1] + 1.2, p[2] - Math.cos(yaw) * 0.25], { rotY: yaw });
  b.mesh(new THREE.BoxGeometry(1.4, 0.06, L * 0.56), body, [p[0] - Math.sin(yaw) * 0.25, p[1] + 1.52, p[2] - Math.cos(yaw) * 0.25], { rotY: yaw });
  for (const u of [-1.1, 1.1]) for (const v of [-0.65, 0.65]) {
    const g = new THREE.CylinderGeometry(0.27, 0.27, 0.18, 12);
    g.rotateZ(Math.PI / 2);
    g.rotateY(yaw);
    b.mesh(g, mat.black, [p[0] + Math.sin(yaw) * u + Math.cos(yaw) * v, p[1] + 0.27, p[2] + Math.cos(yaw) * u - Math.sin(yaw) * v]);
  }
}

/** 軽トラック */
function truck(b: Builder, mat: Mats, p: V3, yaw: number): void {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  b.mesh(new THREE.BoxGeometry(1.45, 0.5, 3.3), mat.signWhite, [p[0], p[1] + 0.6, p[2]], { rotY: yaw });
  b.mesh(new THREE.BoxGeometry(1.4, 0.9, 1.1), mat.signWhite, [p[0] + fx * 1.05, p[1] + 1.25, p[2] + fz * 1.05], { rotY: yaw });
  b.mesh(new THREE.BoxGeometry(1.3, 0.5, 0.05), mat.glass, [p[0] + fx * 1.61, p[1] + 1.35, p[2] + fz * 1.61], { rotY: yaw });
  for (const [u, v] of [[1.0, 0.65], [1.0, -0.65], [-1.0, 0.65], [-1.0, -0.65]]) {
    const g = new THREE.CylinderGeometry(0.27, 0.27, 0.18, 12);
    g.rotateZ(Math.PI / 2);
    g.rotateY(yaw);
    b.mesh(g, mat.black, [p[0] + fx * u + fz * v, p[1] + 0.27, p[2] + fz * u - fx * v]);
  }
  b.mesh(new THREE.BoxGeometry(1.4, 0.4, 2.0), mat.tin, [p[0] - fx * 0.55, p[1] + 1.05, p[2] - fz * 0.55], { rotY: yaw });
}

/** 冬枯れの木（幹と、枝分かれする細い枝） */
export function bareTree(b: Builder, mat: Mats, x: number, z: number, h: number, rand: () => number, y0 = Y.ground): void {
  const base: V3 = [x, y0, z];
  const trunkTop: V3 = [x + (rand() - 0.5) * 0.4, y0 + h * 0.45, z + (rand() - 0.5) * 0.4];
  strut(b, mat.wood, base, trunkTop, 0.22 * (h / 8), 0.22 * (h / 8));
  const grow = (p: V3, dir: THREE.Vector3, len: number, w: number, depth: number): void => {
    const e: V3 = [p[0] + dir.x * len, p[1] + dir.y * len, p[2] + dir.z * len];
    strut(b, mat.wood, p, e, w, w, { shadow: false });
    if (depth <= 0 || w < 0.02) return;
    const n = depth > 2 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const d = dir.clone().add(new THREE.Vector3((rand() - 0.5) * 1.2, 0.25 + rand() * 0.5, (rand() - 0.5) * 1.2)).normalize();
      grow(e, d, len * (0.6 + rand() * 0.2), w * 0.62, depth - 1);
    }
  };
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rand();
    grow(trunkTop, new THREE.Vector3(Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6).normalize(), h * 0.22, 0.12 * (h / 8), 3);
  }
}

/** 小さな祠（石の台・木の社・屋根）と鳥居 */
function shrine(b: Builder, mat: Mats, x: number, z: number): void {
  const y = Y.ground;
  b.boxMM(mat.curb, [x - 0.7, y, z + 0.1], [x + 0.7, y + 0.5, z + 1.5]);
  b.boxMM(mat.wood, [x - 0.4, y + 0.5, z + 0.4], [x + 0.4, y + 1.2, z + 1.2]);
  for (const s of [-1, 1]) b.box(mat.roofTile, [x + s * 0.3, y + 1.38, z + 0.8], [0.75, 0.06, 1.2], { rotZ: -s * 0.55 });
  b.box(mat.red, [x, y + 0.85, z + 0.39], [0.5, 0.5, 0.02]);
  // 鳥居（赤い 2 本の柱と笠木・貫）
  for (const s of [-1, 1]) b.cyl(mat.red, [x + s * 0.55, y + 0.9, z - 0.6], 0.05, 1.8, { segments: 8 });
  b.box(mat.red, [x, y + 1.85, z - 0.6], [1.6, 0.1, 0.14]);
  b.box(mat.black, [x, y + 1.93, z - 0.6], [1.75, 0.05, 0.16]);
  b.box(mat.red, [x, y + 1.55, z - 0.6], [1.25, 0.07, 0.08]);
}
