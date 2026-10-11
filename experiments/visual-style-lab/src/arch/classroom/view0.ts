import * as THREE from 'three';
import { Prop } from '../../props/kit.ts';
import type { V3 } from '../../scenes/Builder.ts';
import { CH, FL, MAT_Z1, SMALL_W, T_EXT } from './layout.ts';
import { PAL, propSink } from './mats.ts';
import { ceilingTv, deskSet, fluorescent, noticeBoard, poster, steelCabinet, wallSpeaker } from './props/school.ts';
import { W0_DOOR, type Env, type LevelMats } from './shell.ts';

/**
 * 2 階の小さな教室（classroom-0 の部屋）の作り込み。
 * - 西の壁（参考画像の奥）: 外の避難階段へ出る両開きの扉（ガラスの上半分・欄間 2 枚ずつ）。左の 1 枚の前に薄い色の書庫
 * - 北西の隅の作り付けの物入れ（参考画像の右奥の暗い所。正面に掲示・細い扉・配管）
 * - 天井: 窓から 1.55 m の列と 3.2 m の列の蛍光灯、吊ったテレビ、隅のスピーカー
 * - 窓の列の机は海の方へ 33° ほど向きがずれている（参考画像の机の天板が正面向きに見える）。右の列の机はまっすぐ
 */

/** 物入れ（北西の隅）の範囲 */
export const CLOSET: [number, number, number, number] = [2.45, 0, SMALL_W, 2.0];

export function buildView0(env: Env, lm: LevelMats): void {
  const { b, mats } = env;
  const fl = FL[1];
  const zone = 'deep' as const;
  const P = PAL.deep;
  const pm = mats.props(zone);
  const sink = propSink(b, env.ctx);
  const at = (x: number, y: number, z: number, yaw = 0, seed = 1): Prop => Prop.at(sink, pm, [x, fl + y, z], yaw, seed);

  // ---- 西の扉（両開き・欄間）
  const [dx0, dx1] = W0_DOOR;
  const fr = lm.frame;
  const box = (m: THREE.Material, a: V3, c: V3, collide = false): void => {
    b.boxMM(m, [a[0], fl + a[1], a[2]], [c[0], fl + c[1], c[2]], { collide, shadow: true });
  };
  const zf: [number, number] = [-0.16, -0.06];
  box(fr, [dx0, 0, zf[0]], [dx0 + 0.07, 2.42, zf[1]], true);
  box(fr, [dx1 - 0.07, 0, zf[0]], [dx1, 2.42, zf[1]], true);
  box(fr, [dx0, 2.0, zf[0]], [dx1, 2.06, zf[1]]);
  box(fr, [dx0, 2.36, zf[0]], [dx1, 2.42, zf[1]]);
  const mid = 1.25;
  box(fr, [mid - 0.05, 0, zf[0]], [mid + 0.05, 2.42, zf[1]], true);
  // 欄間のガラス（左右 2 枚ずつ）と桟
  for (const [a, c] of [[dx0 + 0.07, mid - 0.05], [mid + 0.05, dx1 - 0.07]]) {
    const m = (a + c) / 2;
    box(fr, [m - 0.025, 2.06, zf[0] + 0.02], [m + 0.025, 2.36, zf[1] - 0.02]);
    b.plane(lm.glass, [(a + c) / 2, fl + 2.21, -0.11], c - a, 0.3, 'z', { shadow: false, layer: 1 });
  }
  // 扉の板: 左は閉じたまま（書庫の後ろ）、右は外へ開く
  const leaf = (x0: number, x1: number): THREE.Group => {
    const g = new THREE.Group();
    const w = x1 - x0;
    const add = (m: THREE.Material, a: V3, c: V3): void => {
      const s: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...s), m);
      mesh.position.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    };
    const t = 0.04;
    add(fr, [0, 0, -t / 2], [0.08, 2.0, t / 2]);
    add(fr, [w - 0.08, 0, -t / 2], [w, 2.0, t / 2]);
    add(fr, [0.08, 1.75, -t / 2], [w - 0.08, 2.0, t / 2]);
    add(fr, [0.08, 1.05, -t / 2], [w - 0.08, 1.13, t / 2]);
    add(lm.wall, [0.08, 0, -t / 2 + 0.005], [w - 0.08, 1.05, t / 2 - 0.005]);
    add(fr, [0.08, 0.95, -t / 2 - 0.004], [w - 0.08, 1.0, t / 2 + 0.004]);
    add(fr, [w / 2 - 0.025, 1.13, -t / 2], [w / 2 + 0.025, 1.75, t / 2]);
    for (const xx of [0.08, w / 2 + 0.025]) {
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(w / 2 - 0.105, 0.62), lm.glass);
      gp.position.set(xx + (w / 2 - 0.105) / 2, 1.44, 0);
      gp.layers.set(1);
      g.add(gp);
    }
    // 取っ手
    add(lm.base, [w - 0.16, 0.95, t / 2], [w - 0.12, 1.12, t / 2 + 0.04]);
    return g;
  };
  const left = leaf(0, mid - 0.05 - (dx0 + 0.07));
  left.position.set(dx0 + 0.07, fl, -0.11);
  b.root.add(left);
  env.ctx.colliders.add({ x: dx0, y: fl, z: -0.16 }, { x: mid, y: fl + 2.0, z: -0.06 });
  const rw = dx1 - 0.07 - (mid + 0.05);
  const right = leaf(-rw, 0);
  // 吊り元は北の端（x = dx1 - 0.07）。外（-z）へ開く
  env.doors.add({ leaf: right, pivot: [dx1 - 0.07, fl, -0.11], yaw: 0, swing: -1.5, radius: 1.6 });
  // 書庫（左の扉の前。上半分の板の色が明るい: 日が当たる）
  steelCabinet(Prop.at(sink, mats.paleProps(zone), [0.82, fl, 0.21], 0, 2), { w: 0.98, d: 0.4, h: 1.12, body: '#9cc4d2' });
  // ---- 教材室の西の窓
  const mx0 = SMALL_W + 0.9;
  const mx1 = SMALL_W + 2.5;
  box(fr, [mx0, 0.9, zf[0]], [mx1, 0.96, zf[1]]);
  box(fr, [mx0, 2.14, zf[0]], [mx1, 2.2, zf[1]]);
  box(fr, [(mx0 + mx1) / 2 - 0.03, 0.9, zf[0]], [(mx0 + mx1) / 2 + 0.03, 2.2, zf[1]]);
  b.plane(lm.glass, [(mx0 + mx1) / 2, fl + 1.55, -0.11], mx1 - mx0, 1.3, 'z', { shadow: false, layer: 1 });
  box(lm.sill, [mx0, 0.86, -0.12], [mx1, 0.9, 0.12]);

  // ---- 北西の隅の物入れ（作り付け。正面 z = CLOSET[3]）
  const [cx0, , cx1, cz1] = CLOSET;
  box(lm.wall, [cx0, 0, 0], [cx0 + 0.1, CH, cz1], true);
  box(lm.wall, [cx0, 0, cz1 - 0.1], [cx1, CH, cz1], true);
  // 正面: 小さな緑の黒板（左）・細い鉄の扉（掃除用具入れ）・掲示（右）
  const face = (x: number, y: number, seed: number): Prop => Prop.at(sink, pm, [x, fl + y, cz1], 0, seed);
  const greenB = mats.get(zone, '#245a57', { shade: '#173d42', dark: '#112f36', key: 'gb' });
  box(greenB, [cx0 + 0.18, 0.75, cz1], [cx0 + 0.78, 1.75, cz1 + 0.02]);
  box(lm.frame, [cx0 + 0.16, 0.72, cz1], [cx0 + 0.8, 0.76, cz1 + 0.06]);
  const doorM = mats.get(zone, '#5f8fa2', { key: 'cdoor' });
  box(doorM, [3.3, 0.02, cz1], [3.7, 2.05, cz1 + 0.025]);
  box(lm.base, [3.62, 0.95, cz1 + 0.025], [3.66, 1.12, cz1 + 0.05]);
  box(lm.frame, [3.27, 2.05, cz1], [3.73, 2.1, cz1 + 0.04]);
  noticeBoard(face(3.88, 1.45, 41), { w: 0.28, h: 1.9, papers: 4 });
  // 物入れの西の面の配管（参考画像の右奥の縦の管）
  for (const [x, r] of [[cx0 - 0.08, 0.035], [cx0 - 0.2, 0.025], [cx0 - 0.3, 0.02]] as [number, number][]) {
    b.cyl(lm.base, [x, fl + CH / 2, cz1 - 0.35 - r * 4], r, CH, { shadow: true });
  }
  // ---- 北の壁（教材室との間仕切り）: 掲示板・時間割
  const wallN = (z: number, y: number, seed: number): Prop => Prop.at(sink, pm, [SMALL_W, fl + y, z], -Math.PI / 2, seed);
  noticeBoard(wallN(5.2, 1.55, 51), { w: 1.8, h: 0.9 });
  poster(wallN(4.0, 1.7, 52), { w: 0.42, h: 0.6 });
  poster(wallN(6.4, 1.6, 53));
  wallSpeaker(wallN(2.5, 2.55, 54));

  // ---- 天井: 蛍光灯（2 列）・吊ったテレビ・隅のスピーカー
  for (const x of [1.55, 3.2]) {
    for (const z of [1.2, 3.6, 6.0, 8.4, 10.8]) {
      if (x > CLOSET[0] && z < CLOSET[3] + 0.7) continue;
      fluorescent(at(x, CH, z, 0, 60), { body: '#2c4c66', tube: '#b8e2f0' });
    }
  }
  for (const z of [7.8, 10.2]) fluorescent(at(5.6, CH, z, 0, 61), { body: '#2c4c66', tube: '#b8e2f0' });
  ceilingTv(at(2.6, CH - 0.27 - 0.3, 2.3, Math.PI * 0.08, 62), { drop: 0.3 });
  wallSpeaker(Prop.at(sink, pm, [0, fl + 2.65, 0.75], Math.PI / 2, 63));

  // ---- 机（窓の列は海へ向きがずれる・右の列はまっすぐ）
  const dk = { top: P.desk.color, edge: P.deskEdge, frame: P.deskFrame, chairFrame: P.chairFrame, seat: P.seat };
  const row: [number, number, number][] = [[1.55, 7.95, 0.57], [1.47, 7.3, 0.6], [1.42, 6.68, 0.55], [1.36, 5.95, 0.58], [1.3, 5.2, 0.62], [1.26, 4.42, 0.56], [1.26, 3.6, 0.6], [1.32, 2.78, 0.55]];
  row.forEach(([x, z, yaw], i) => deskSet(at(x, 0, z, yaw, 100 + i), { ...dk, pull: 0.08 + (i % 3) * 0.04, clutter: 0.4 }));
  const rrow: [number, number][] = [[3.3, 7.15], [3.2, 6.4], [3.22, 5.7], [3.18, 4.95], [3.15, 4.1], [3.05, 3.3]];
  rrow.forEach(([x, z], i) => deskSet(at(x, 0, z, i % 2 ? 0.05 : -0.04, 200 + i), { ...dk, clutter: 0.3 }));
  // 後ろ（東）の 2 列（参考画像の目の後ろ）
  for (const [x, z] of [[1.45, 9.0], [1.45, 10.2], [5.6, 10.3], [5.6, 11.4]]) deskSet(at(x, 0, z, z > 9.5 ? 0.3 : 0.45, 300 + Math.round(z * 10 + x)), { ...dk, clutter: 0.3 });
  void MAT_Z1;
  void T_EXT;
}
