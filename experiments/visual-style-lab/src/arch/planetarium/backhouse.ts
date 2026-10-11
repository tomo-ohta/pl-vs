import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Prop } from '../../props/kit.ts';
import { DOME, DRUM_R, HOUSE, LOGE, STAGE, VIEW } from './layout.ts';

export { HOUSE };
import { domePropMats, domeSink } from './props/mats.ts';
import { aisleLamp, consoleDesk, equipmentRack, lectern, signStand, speaker, starProjector } from './props/stage.ts';
import { bench, extinguisher, steelShelf } from '../../props/lib/index.ts';

/**
 * 舞台の裏の塔（舞台裏への出入口）と、舞台の前の操作卓。
 * 塔: 前の面は z = FRONT（舞台の奥の縁の後ろ）。中ほどに奥まった出入口（光る扉）、両脇に小さな庇、
 * 上（4 m）は手すりの付いた屋上で、台座の上に昔の星の投影機を展示する。裏の段床が両脇に付く。
 */
export const DOOR = { x: -0.8, w: 1.25, h: 2.1 };

export interface HouseMats {
  glow2: THREE.Material;
  roomWall: THREE.Material;
  roomFloor: THREE.Material;
  roomCeil: THREE.Material;
  wall: THREE.Material;
  trim: THREE.Material;
  dark: THREE.Material;
  rail: THREE.Material;
  door: THREE.Material;
}

export function buildBackhouse(b: Builder, m: HouseMats): void {
  const { x0, x1, front, back, top } = HOUSE;
  const [px0, px1] = HOUSE.portal;
  const pz = front - HOUSE.portalDepth;
  // 前の面（出入口の左右と上）
  b.boxMM(m.wall, [x0, 0, pz - 0.3], [px0, top, front], { collide: true });
  b.boxMM(m.wall, [px1, 0, pz - 0.3], [x1, top, front], { collide: true });
  b.boxMM(m.wall, [px0, HOUSE.portalTop, pz - 0.3], [px1, top, front]);
  // 奥まった所（暗い）: 奥の壁（扉の開口を空ける）・横の壁・舞台の高さの踊り場
  const dx0 = DOOR.x - DOOR.w / 2;
  const dx1 = DOOR.x + DOOR.w / 2;
  const dTop = STAGE.top + DOOR.h;
  b.boxMM(m.dark, [px0, 0, pz - 0.3], [dx0, HOUSE.portalTop, pz], { collide: true });
  b.boxMM(m.dark, [dx1, 0, pz - 0.3], [px1, HOUSE.portalTop, pz], { collide: true });
  b.boxMM(m.dark, [dx0, dTop, pz - 0.3], [dx1, HOUSE.portalTop, pz]);
  b.boxMM(m.dark, [px0, 0, pz], [px0 + 0.05, HOUSE.portalTop, front]);
  b.boxMM(m.dark, [px1 - 0.05, 0, pz], [px1, HOUSE.portalTop, front]);
  b.boxMM(m.trim, [px0, 0, pz], [px1, STAGE.top, front - 0.02], { collide: true });
  // 扉の枠（扉は開いていて、奥の光の前室が見える）
  b.boxMM(m.trim, [DOOR.x - DOOR.w / 2 - 0.12, STAGE.top, pz], [DOOR.x - DOOR.w / 2, STAGE.top + DOOR.h + 0.12, pz + 0.08]);
  b.boxMM(m.trim, [DOOR.x + DOOR.w / 2, STAGE.top, pz], [DOOR.x + DOOR.w / 2 + 0.12, STAGE.top + DOOR.h + 0.12, pz + 0.08]);
  b.boxMM(m.trim, [DOOR.x - DOOR.w / 2 - 0.12, STAGE.top + DOOR.h, pz], [DOOR.x + DOOR.w / 2 + 0.12, STAGE.top + DOOR.h + 0.12, pz + 0.08]);
  // 胴体（奥へ）: 中は前室（光る壁の部屋）。壁の厚み 0.3、床は舞台の高さ
  const ROOM = { x0: x0 + 0.3, x1: x1 - 0.3, z0: back + 0.3, z1: pz - 0.3 };
  b.boxMM(m.wall, [x0, 0, back], [ROOM.x0, top, pz - 0.3], { collide: true });
  b.boxMM(m.wall, [ROOM.x1, 0, back], [x1, top, pz - 0.3], { collide: true });
  b.boxMM(m.wall, [ROOM.x0, 0, back], [ROOM.x1, top, ROOM.z0], { collide: true });
  b.boxMM(m.wall, [ROOM.x0, 3.4, ROOM.z0], [ROOM.x1, top, ROOM.z1]);
  // 前室の床（明るい石。光の板の前ほど明るい）・壁（暖かい灰の漆喰と暗い腰板）・天井（暗い）
  b.boxMM(m.roomFloor, [ROOM.x0, 0, ROOM.z0], [ROOM.x1, STAGE.top, ROOM.z1 + 0.02], { collide: true });
  b.boxMM(m.roomWall, [ROOM.x0, STAGE.top, ROOM.z0], [ROOM.x0 + 0.03, 3.4, ROOM.z1], { shadow: false });
  b.boxMM(m.roomWall, [ROOM.x1 - 0.03, STAGE.top, ROOM.z0], [ROOM.x1, 3.4, ROOM.z1], { shadow: false });
  b.boxMM(m.roomWall, [ROOM.x0, STAGE.top, ROOM.z0], [ROOM.x1, 3.4, ROOM.z0 + 0.03], { shadow: false });
  // 扉の側の壁（扉の開口を空ける）
  b.boxMM(m.roomWall, [ROOM.x0, STAGE.top, ROOM.z1 - 0.03], [dx0, 3.4, ROOM.z1], { shadow: false });
  b.boxMM(m.roomWall, [dx1, STAGE.top, ROOM.z1 - 0.03], [ROOM.x1, 3.4, ROOM.z1], { shadow: false });
  b.boxMM(m.roomWall, [dx0, dTop, ROOM.z1 - 0.03], [dx1, 3.4, ROOM.z1], { shadow: false });
  b.boxMM(m.roomCeil, [ROOM.x0, 3.37, ROOM.z0], [ROOM.x1, 3.4, ROOM.z1], { shadow: false });
  // 腰板（暗い板・笠木）
  for (const [a0, a1, c0, c1] of [
    [ROOM.x0, ROOM.x0 + 0.06, ROOM.z0, ROOM.z1],
    [ROOM.x1 - 0.06, ROOM.x1, ROOM.z0, ROOM.z1],
    // 奥の壁の腰板は光の板の所を空ける（光の板 x -2.35〜0.15）
    [ROOM.x0, -2.35, ROOM.z0, ROOM.z0 + 0.06],
    [0.15, ROOM.x1, ROOM.z0, ROOM.z0 + 0.06],
    [ROOM.x0, dx0, ROOM.z1 - 0.06, ROOM.z1],
    [dx1, ROOM.x1, ROOM.z1 - 0.06, ROOM.z1],
  ] as [number, number, number, number][]) {
    b.boxMM(m.dark, [a0, STAGE.top, c0], [a1, STAGE.top + 0.95, c1], { shadow: false });
    b.boxMM(m.trim, [a0 - 0.01, STAGE.top + 0.95, c0 - 0.01], [a1 + 0.01, STAGE.top + 1.0, c1 + 0.01], { shadow: false });
  }
  // 奥の壁の光の板（裏から光る暖かい板。舞台から扉の向こうに見えるのはこの板）と暗い額縁
  const P = { x0: -2.25, x1: 0.05, y0: STAGE.top + 0.02, y1: 2.8 };
  const pz0 = ROOM.z0 + 0.07;
  b.boxMM(m.door, [P.x0, P.y0, ROOM.z0 + 0.03], [P.x1, P.y1, pz0], { shadow: false });
  for (const [a0, b0, a1, b1] of [
    [P.x0 - 0.1, P.y1, P.x1 + 0.1, P.y1 + 0.1],
    [P.x0 - 0.1, P.y0, P.x0, P.y1],
    [P.x1, P.y0, P.x1 + 0.1, P.y1],
  ] as [number, number, number, number][]) b.boxMM(m.dark, [a0, b0, ROOM.z0 + 0.03], [a1, b1, pz0 + 0.03], { shadow: false });
  // 光の板の縦の継ぎ目（2 枚の板）
  b.boxMM(m.dark, [(P.x0 + P.x1) / 2 - 0.015, P.y0, pz0], [(P.x0 + P.x1) / 2 + 0.015, P.y1, pz0 + 0.01], { shadow: false });
  // 天井の丸い灯り（器具）
  b.cyl(m.dark, [-0.4, 3.35, -12.2], 0.22, 0.04, { shadow: false });
  b.cyl(m.glow2, [-0.4, 3.32, -12.2], 0.17, 0.02, { shadow: false });
  // 前室の奥の下り階段の口（閉じた鉄の扉。舞台の下の通路へ）
  b.boxMM(m.dark, [ROOM.x1 - 1.6, STAGE.top, ROOM.z0 + 0.04], [ROOM.x1 - 0.4, STAGE.top + 2.1, ROOM.z0 + 0.1], { shadow: false });
  b.boxMM(m.trim, [ROOM.x1 - 1.62, STAGE.top + 0.95, ROOM.z0 + 0.1], [ROOM.x1 - 1.5, STAGE.top + 1.05, ROOM.z0 + 0.16], { shadow: false });
  // 出入口の両脇の小さな庇（張り出した板と腕木）
  for (const [a, c] of [[x0 + 0.2, px0 - 0.05], [px1 + 0.05, x1 - 0.2]] as [number, number][]) {
    b.boxMM(m.trim, [a, 2.62, front], [c, 2.78, front + 0.7]);
    b.boxMM(m.dark, [a, 2.5, front], [c, 2.62, front + 0.08]);
    for (const x of [a + 0.1, c - 0.1]) b.boxMM(m.trim, [x - 0.04, 2.3, front], [x + 0.04, 2.62, front + 0.5]);
  }
  // 腰の帯（下の暗い帯）・上の軒の帯
  b.boxMM(m.dark, [x0 - 0.02, 0, front - 0.02], [x1 + 0.02, 0.45, front + 0.03]);
  b.boxMM(m.trim, [x0 - 0.1, top - 0.25, front - 0.1], [x1 + 0.1, top, front + 0.12]);
  // 屋上の手すり（前と横）
  const post = (x: number, z: number): void => {
    b.boxMM(m.rail, [x - 0.03, top, z - 0.03], [x + 0.03, top + 0.9, z + 0.03], { shadow: false });
  };
  for (let x = x0 + 0.1; x <= x1 - 0.05; x += 0.35) post(x, front + 0.02);
  b.boxMM(m.rail, [x0, top + 0.86, front - 0.03], [x1, top + 0.94, front + 0.07], { shadow: false });
  for (const x of [x0 + 0.05, x1 - 0.05]) {
    for (let z = front - 0.3; z > back + 0.2; z -= 0.6) post(x, z);
    b.boxMM(m.rail, [x - 0.04, top + 0.86, back], [x + 0.04, top + 0.94, front], { shadow: false });
  }
  // 台座（投影機の展示）
  b.boxMM(m.wall, [-2.2, top, -13.6], [1.2, top + 0.7, -10.2], { collide: true });
  b.boxMM(m.trim, [-2.3, top + 0.7, -13.7], [1.3, top + 0.82, -10.1]);
}

/** 塔の上の投影機と、舞台まわりの小物（操作卓・機材の棚・演台・スピーカー・案内の板・通路の灯り） */
export function buildStageProps(b: Builder, ctx: SceneContext, aisleLamps: { x: number; z: number; yaw: number }[], signs: { x: number; z: number; yaw: number }[]): void {
  const sink = domeSink(b, ctx);
  const mats = domePropMats(ctx);
  // 投影機（台座の上）
  starProjector(Prop.at(sink, mats, [-0.6, HOUSE.top + 0.82, -11.9], 0.25, 3).sub([0, 0, 0], 0, { scale: 1.55 }));
  // 操作卓: 前の線 (-1.2, 7.6) → (5.0, 8.4)。正面は客席（+z）
  const a: [number, number] = [-1.2, 7.6];
  const c: [number, number] = [5.0, 8.4];
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const ux = (c[0] - a[0]) / len;
  const uz = (c[1] - a[1]) / len;
  const nx = -uz;
  const nz = ux;
  const yaw = Math.atan2(nx, nz);
  const at = (t: number, back: number): [number, number, number] => [a[0] + ux * len * t - nx * back, 0, a[1] + uz * len * t - nz * back];
  consoleDesk(Prop.at(sink, mats, at(0.31, 0.5), yaw, 11), { w: 3.7 });
  // 機材の棚は前板を舞台の側へ（客席からは黒い背中）
  equipmentRack(Prop.at(sink, mats, at(0.72, 0.46), yaw + Math.PI, 12));
  equipmentRack(Prop.at(sink, mats, at(0.92, 0.46), yaw + Math.PI, 13));
  speaker(Prop.at(sink, mats, at(1.04, 0.4), yaw, 14));
  // 演台（舞台の上、扉の前の右）
  lectern(Prop.at(sink, mats, [2.4, STAGE.top, -3.5], Math.PI * 0.95, 15));
  for (const l of aisleLamps) aisleLamp(Prop.at(sink, mats, [l.x, 0, l.z], l.yaw, 21));
  // 前室の小物: 左の壁ぎわに道具の棚（ケーブル・照明の器具の箱）、右に長椅子と消火器、奥の扉の脇に案内の板
  steelShelf(Prop.at(sink, mats, [HOUSE.x0 + 0.62, STAGE.top, -12.0], Math.PI / 2, 41), { w: 1.8, h: 2.0, d: 0.5, frame: '#3a4a52', load: ['bins', 'cardboard', 'mixed', 'bins'], colors: ['#2e3d45', '#4a5a62', '#6b5a45'] });
  bench(Prop.at(sink, mats, [HOUSE.x1 - 0.6, STAGE.top, -11.6], -Math.PI / 2, 42), { w: 1.6, kind: 'locker', seat: '#3a4c56', frame: '#1c272e' });
  extinguisher(Prop.at(sink, mats, [HOUSE.x1 - 0.55, STAGE.top, -10.2], -Math.PI / 2, 43));
  signStand(Prop.at(sink, mats, [0.75, STAGE.top, -13.3], 0, 44));
  // 演台（操作席）の脇の壁ぎわの操作机（細い通路の上、カメラの左後ろ。画角の外。通路は机の前を通れる）
  {
    const ph = Math.atan2(VIEW.eye[0] - DOME.cx, -(VIEW.eye[2] - DOME.cz)) + (6.5 * Math.PI) / 180;
    const r = DRUM_R - 0.55;
    const pos: [number, number, number] = [DOME.cx + r * Math.sin(ph), LOGE.l1, DOME.cz - r * Math.cos(ph)];
    const yawIn = Math.atan2(DOME.cx - pos[0], DOME.cz - pos[2]);
    consoleDesk(Prop.at(sink, mats, pos, yawIn + Math.PI, 31), { w: 1.6 });
  }
  for (const s of signs) signStand(Prop.at(sink, mats, [s.x, 0, s.z], s.yaw, 22));
}
