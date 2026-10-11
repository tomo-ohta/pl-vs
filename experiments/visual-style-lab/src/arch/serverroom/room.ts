import * as THREE from 'three';
import { Prop, type PropSink } from '../../props/kit.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { rng } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { slab, wallWithHoles, type WallHole } from '../kit.ts';
import { DOORS, NORTH, SOUTH, type RoomSpec } from './layout.ts';
import { PAL, type VcMats } from './mats.ts';
import { hangBox, overhead } from './overhead.ts';
import { dressWall, roomWalls, signOn, type SignSink } from './dress.ts';
import type { SignAtlas } from './signs.ts';
import { CAM_A, CAM_B, CAM_C } from './views.ts';
import { cableCoil, cableTrough } from './props/cables.ts';
import { kvmDrawer, powerCabinet, shortRack } from './props/equipment.ts';
import { cone, tileLifter } from './props/facility.ts';
import { inRowCooler, serverRack, type RackMats } from './rack.ts';

/**
 * サーバー室 1 つ（間取り図の A・B・C）。南北に長い室に、通路（コールドアイル）を挟んでラックの列が 2 本。
 * 列の背（ホットアイル）と側の壁の間は 1.5 m 前後。北の壁の中央（通路の突き当たり）に扉、南の壁の前に空調機（CRAC）。
 * 天井: 列の上にはしご形のケーブルラック、通路を横切る渡りのラック、垂れたケーブルの束、照明（部屋ごとの型）、煙感知器。
 * 床: 0.6 m の二重床の板。通路の列の前は吹き出しの穴あきの板。床の映り込み（場面に 1 枚の鏡）。
 */

export interface RoomEnv {
  ctx: SceneContext;
  vc: VcMats;
  rack: Omit<RackMats, 'b'>;
  /** 部屋ごとの床・壁・天井の材質 */
  floor: THREE.Material;
  wall: THREE.Material;
  ceil: THREE.Material;
  grille: THREE.Material;
  /** 床下（二重床の中）の暗い材質 */
  plenum: THREE.Material;
  /** ラックの取っ手の色 */
  handle?: string;
  /** 側の壁（ホットアイルの壁。参考画像の視点からは列に隠れる）の材質 */
  side?: THREE.Material;
  /** 視点の後ろの南の壁の腰の帯の材質・札の図柄 */
  dado?: THREE.Material;
  signMat?: THREE.Material;
  signAtlas?: SignAtlas;
}

/** 列に並ぶ物（ラック・インロー空調機・分電盤・空き） */
interface Slot {
  z0: number;
  z1: number;
  kind: 'rack' | 'cooler' | 'power' | 'gap';
}

/** 列の中の特別な物（z の北の端・幅・種類）。参考画像の視点から逆算した位置 */
function specials(r: RoomSpec, side: -1 | 1): { z: number; w: number; kind: Slot['kind'] }[] {
  // A: インロー空調機（serverroom-2 の黒い柱。左 z -8.47・右 -7.77。視点の後ろにもう 1 組）
  if (r.id === 'A') return [
    { z: side < 0 ? -8.47 : -7.77, w: 0.3, kind: 'cooler' },
    { z: side < 0 ? -2.3 : -1.6, w: 0.3, kind: 'cooler' },
  ];
  // C: 左の列の手前の淡い分電盤（serverroom-1 の左の大きな面。z -5.23〜-4.3）・右の列にも 1 つ（視点の外）
  if (r.id === 'C') return side < 0 ? [{ z: -5.25, w: 0.9, kind: 'power' }] : [{ z: -0.45, w: 0.9, kind: 'power' }];
  return [];
}

function rowSlots(r: RoomSpec, side: -1 | 1): Slot[] {
  const out: Slot[] = [];
  const sp = specials(r, side);
  let z = r.rowN;
  while (z < r.rowS - 0.29) {
    const hit = sp.find((s) => Math.abs(s.z - z) < 1e-6);
    if (hit) {
      out.push({ z0: z, z1: z + hit.w, kind: hit.kind });
      z += hit.w;
      continue;
    }
    const next = sp.find((s) => s.z > z + 1e-6 && s.z < z + 0.6 - 1e-6);
    if (next) {
      // 特別な物の手前までを細いラック（0.4 m 以上）で埋める
      out.push({ z0: z, z1: next.z, kind: next.z - z >= 0.4 ? 'rack' : 'gap' });
      z = next.z;
      continue;
    }
    out.push({ z0: z, z1: Math.min(z + 0.6, r.rowS), kind: 'rack' });
    z += 0.6;
  }
  return out;
}

/** 吹き出しの床の位置（中心 x, z）。参考画像の視点の範囲は画素から逆算した位置、ほかは同じ並びを続ける */
function vents(r: RoomSpec): [number, number][] {
  const out: [number, number][] = [];
  if (r.id === 'A') {
    // serverroom-2: 2 列・1.2 m おき（左 x -8.06・右 -6.53、z -6.28 から北へ）
    for (let z = -9.88; z < r.rowS - 0.3; z += 1.2) out.push([-8.06, z], [-6.53, z]);
  } else if (r.id === 'B') {
    // serverroom-0: ばらばらに置かれた穴あきの板（画素から: z -5.86・-6.85・-7.2・-7.3・-8.15・-8.49）
    out.push([-0.75, -5.86], [-0.32, -6.85], [-0.62, -7.2], [0.62, -7.3], [-0.65, -8.15], [0.5, -8.49], [0.69, -5.79], [-0.6, -9.4], [0.55, -9.9]);
    for (let z = -4.6; z < r.rowS - 0.3; z += 1.2) out.push([(Math.floor(z * 7) % 2 ? -1 : 1) * 0.62, z]);
  } else {
    for (let z = -10.2; z < r.rowS - 0.3; z += 1.8) out.push([r.cx - 0.7, z], [r.cx + 0.7, z + 0.6]);
  }
  return out;
}

/** 床を開けた所（二重床の板を外した点検の口。C の通路の暗い升: serverroom-1 の床の暗い長方形） */
function holes(r: RoomSpec): [number, number, number, number][] {
  if (r.id !== 'C') return [];
  // ケーブルの通る切り欠き（0.9 × 0.3 m。serverroom-1 の床の暗い細長い升 4 つ: 画素から z -8.6・-7.6・-9.2・-7.05）
  return [
    [7.42, -8.75, 8.35, -8.45],
    [7.45, -7.75, 8.4, -7.45],
    [6.33, -9.35, 7.35, -9.05],
    [7.53, -7.2, 8.3, -6.92],
    // 視点の後ろ: 床の板を 1 枚外した点検口（三角コーンで囲う）
    [7.1, 0.3, 7.7, 0.9],
  ];
}

export function buildServerRoom(env: RoomEnv, b: Builder, r: RoomSpec, seed: number): THREE.Mesh[] {
  const { ctx, vc } = env;
  const R = rng(seed);
  const sink: PropSink = vc.sink(b);
  const P = (pos: [number, number, number], yaw = 0): Prop => Prop.at(sink, vc, pos, yaw, Math.floor(R() * 1e6));
  const floors: THREE.Mesh[] = [];

  // ---- 外形: 床（開けた所を除く）・天井・壁 ----
  const hs = holes(r);
  if (!hs.length) {
    floors.push(slab(b, env.floor, [r.x0, NORTH, r.x1, SOUTH], 0, 0.3, { shadow: 'receive' }));
  } else {
    // z の帯に分けて、穴の無い所だけ床の板を置く
    const zs = [...new Set([NORTH, SOUTH, ...hs.flatMap((h) => [h[1], h[3]])])].sort((a, c) => a - c);
    for (let i = 0; i + 1 < zs.length; i++) {
      const za = zs[i];
      const zb = zs[i + 1];
      const inBand = hs.filter((h) => h[1] <= za + 1e-6 && h[3] >= zb - 1e-6).sort((a, c) => a[0] - c[0]);
      let x = r.x0;
      for (const h of inBand) {
        if (h[0] > x) floors.push(slab(b, env.floor, [x, za, h[0], zb], 0, 0.3, { shadow: 'receive' }));
        x = h[2];
      }
      if (x < r.x1) floors.push(slab(b, env.floor, [x, za, r.x1, zb], 0, 0.3, { shadow: 'receive' }));
    }
    // 床下（暗い箱・床下のケーブル・板の縁の金具）
    for (const h of hs) {
      b.boxMM(env.plenum, [h[0], -0.62, h[1]], [h[2], -0.6, h[3]], { collide: true });
      // 穴の縁（床の板の切り口を暗い床下の色で覆う。板の厚さ 3 cm だけ淡い縁）
      b.boxMM(env.plenum, [h[0], -0.6, h[1]], [h[2], -0.03, h[1] + 0.01], {});
      b.boxMM(env.plenum, [h[0], -0.6, h[3] - 0.01], [h[2], -0.03, h[3]], {});
      b.boxMM(env.plenum, [h[0], -0.6, h[1]], [h[0] + 0.01, -0.03, h[3]], {});
      b.boxMM(env.plenum, [h[2] - 0.01, -0.6, h[1]], [h[2], -0.03, h[3]], {});
      const p = P([0, 0, 0]);
      for (let k = 0; k < 5; k++) {
        const z = h[1] + 0.08 + k * ((h[3] - h[1] - 0.16) / 4);
        p.tube(PAL.cableBlue, [[h[0] - 0.1, -0.5, z], [(h[0] + h[2]) / 2, -0.56, z + 0.03], [h[2] + 0.1, -0.5, z]], 0.012, { radial: 5, seg: 8, shadow: false });
      }
      // 台の脚（床の板を支える柱）
      for (const [x, z] of [
        [h[0], h[1]],
        [h[2], h[1]],
        [h[0], h[3]],
        [h[2], h[3]],
      ])
        p.box(PAL.steelDark, [x - 0.02, -0.6, z - 0.02], [x + 0.02, -0.02, z + 0.02], { shadow: false });
    }
  }
  slab(b, env.ceil, [r.x0, NORTH, r.x1, SOUTH], r.ceil + 0.25, 0.25, { shadow: false });
  // 壁の内張り（部屋ごとの色の板。建物の壁は building.ts・扉は doors.ts）
  const lineH = r.ceil + 0.25;
  const holesOn = (line: number): WallHole[] =>
    DOORS.filter((d) => d.wall === 'x' && Math.abs(d.line - line) < 0.05 && d.a >= r.x0 && d.b <= r.x1).map((d) => ({ at: (d.a + d.b) / 2 - r.x0, width: d.b - d.a + 0.1, bottom: 0, top: d.h + 0.05 }));
  wallWithHoles(b, env.wall, [r.x0, NORTH + 0.01], [r.x1, NORTH + 0.01], 0, lineH, 0.02, holesOn(NORTH - 0.1));
  // 南の壁（視点の後ろ。参考画像には写らない）は側の壁と同じ細かい筋の板
  wallWithHoles(b, env.side ?? env.wall, [r.x0, SOUTH - 0.01], [r.x1, SOUTH - 0.01], 0, lineH, 0.02, holesOn(SOUTH + 0.1));
  wallWithHoles(b, env.side ?? env.wall, [r.x0 + 0.01, NORTH], [r.x0 + 0.01, SOUTH], 0, lineH, 0.02);
  wallWithHoles(b, env.side ?? env.wall, [r.x1 - 0.01, NORTH], [r.x1 - 0.01, SOUTH], 0, lineH, 0.02);

  // ---- ラックの列 ----
  const rm: RackMats = { ...env.rack, b };
  let design = Math.floor(R() * 16);
  for (const side of [-1, 1] as const) {
    const xf = r.cx + (side * r.aisle) / 2;
    const yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    for (const s of rowSlots(r, side)) {
      const zc = (s.z0 + s.z1) / 2;
      const w = s.z1 - s.z0;
      const p = P([xf, 0, zc], yaw);
      if (s.kind === 'cooler') {
        // インロー空調機は列の前面から 0.27 m 通路へ出る（参考画像 serverroom-2 の黒い柱の見えている南の面の幅から）
        inRowCooler(P([xf - side * 0.27, 0, zc], yaw), { d: r.depth + 0.27, h: r.rackH + 0.03 });
        ctx.colliders.add({ x: Math.min(xf, xf - side * 0.27), y: 0, z: s.z0 }, { x: Math.max(xf, xf - side * 0.27), y: r.rackH, z: s.z1 });
      } else if (s.kind === 'power') {
        powerCabinet(p, { w, d: r.depth, h: Math.min(r.rackH - 0.15, 2.3), color: '#4f95a2' });
      } else if (s.kind === 'rack') {
        design = (design + 1 + Math.floor(R() * 5)) % 16;
        serverRack(p, rm, { w, d: r.depth, h: r.rackH, design, rear: Math.floor(R() * 16), streak: Math.floor(R() * 4), hinge: R() < 0.5 ? 1 : -1, back: true, handle: env.handle });
      }
    }
    // 当たり判定（列ごとの箱）
    const x0 = Math.min(xf, xf + side * r.depth);
    const x1 = Math.max(xf, xf + side * r.depth);
    ctx.colliders.add({ x: x0, y: 0, z: r.rowN }, { x: x1, y: r.rackH, z: r.rowS });
  }

  // ---- ホットアイルの側の壁（列の背の後ろ。参考画像の視点からは列に隠れて見えない） ----
  const signs: SignSink | undefined = env.signMat && env.signAtlas ? { b, mat: env.signMat, atlas: env.signAtlas } : undefined;
  for (const seg of roomWalls([r.x0, NORTH, r.x1, SOUTH], 0, r.ceil, ['n', 's'], 0.02)) dressWall(P([0, 0, 0]), seg, 'hot', { signs });
  // 北の壁のホットアイルの所（列の背より外。参考画像の視点からは列に隠れる）と南の壁（視点の後ろ）
  const xl = r.cx - r.aisle / 2 - r.depth - 0.05;
  const xr = r.cx + r.aisle / 2 + r.depth + 0.05;
  for (const seg of roomWalls([r.x0, NORTH, xl, SOUTH], 0, r.ceil, ['s', 'w', 'e'], 0.02)) dressWall(P([0, 0, 0]), seg, 'hot', { signs });
  for (const seg of roomWalls([xr, NORTH, r.x1, SOUTH], 0, r.ceil, ['s', 'w', 'e'], 0.02)) dressWall(P([0, 0, 0]), seg, 'hot', { signs });
  for (const seg of roomWalls([r.x0, NORTH, r.x1, SOUTH], 0, r.ceil, ['n', 'w', 'e'], 0.02)) dressWall(P([0, 0, 0]), seg, 'plant', { tray: true, b, dadoMat: env.dado, signs });
  // ---- 天井まわり ----
  overhead(P([0, 0, 0]), r, { n: r.rowN, s: r.rowS });

  // ---- 吹き出しの床 ----
  for (const [x, z] of vents(r)) {
    if (hs.some((h) => x + 0.28 > h[0] && x - 0.28 < h[2] && z + 0.28 > h[1] && z - 0.28 < h[3])) continue;
    const g = new THREE.PlaneGeometry(0.56, 0.56);
    g.rotateX(-Math.PI / 2);
    g.translate(x, 0.004, z);
    b.mesh(g, env.grille, [0, 0, 0], { shadow: false, layer: 1 });
  }

  // ---- 部屋ごとの物（参考画像に写る物） ----
  if (r.id === 'B') {
    // 通路の右の低いラック（serverroom-0: x 0.69〜1.04・z -6.4 前後・高さ 0.8 m）
    shortRack(P([0.85, 0, -6.68], -Math.PI / 2), { w: 0.55, d: 0.38, h: 0.82 });
    ctx.colliders.add({ x: 0.64, y: 0, z: -6.96 }, { x: 1.04, y: 0.82, z: -6.4 });
    // 左の列の足元の床置きのケーブルダクト（serverroom-0 の左下の長い箱）
    cableTrough(P([-0.86, 0, -4.9], Math.PI / 2), { len: 2.2 });
    // 床のケーブルの輪（serverroom-0 の床の黒い輪。ラックの足元に寄る）
    for (const [x, z, rr] of [
      [-0.62, -5.2, 0.32],
      [-0.75, -6.25, 0.22],
      [0.6, -5.4, 0.3],
      [0.72, -7.6, 0.2],
      [-0.55, -7.75, 0.18],
      [0.62, -2.0, 0.3],
    ] as [number, number, number][])
      cableCoil(P([x, 0, z], R() * Math.PI), { r: rr, loops: 2 + Math.floor(R() * 2), tail: [(x > 0 ? 1 : -1) * 0.5, 0, 0] });
  } else if (r.id === 'A') {
    // 北の壁ぎわの梁型（ダクトを包んだ下がり壁。serverroom-2 の扉の上の暗い帯 y 160〜250 → 高さ 2.3〜3.1 m）と、その下の還気の口
    const pn = P([0, 0, 0]);
    pn.box(PAL.duct, [r.x0, 2.15, NORTH], [r.x1, r.ceil + 0.25, NORTH + 0.55], { r: 0.01, shadow: false });
    pn.box('#2a6c80', [r.x0, 2.15, NORTH + 0.55], [r.x1, 2.19, NORTH + 0.6], { shadow: false });
    pn.box('#7fb9c3', [r.doorX - 0.45, 2.42, NORTH + 0.55], [r.doorX + 0.45, 2.78, NORTH + 0.565], { shadow: false });
    for (let k = 0; k < 8; k++) pn.box('#5d98a3', [r.doorX - 0.42, 2.45 + k * 0.04, NORTH + 0.565], [r.doorX + 0.42, 2.465 + k * 0.04, NORTH + 0.575], { shadow: false });
    // 扉の左の白い掲示板と床の小さな箱（serverroom-2 の扉の左）
    pn.box('#7fb0b6', [r.cx - 1.39, 1.44, NORTH + 0.012], [r.cx - 0.25, 1.93, NORTH + 0.03], { r: 0.006, shadow: false });
    for (let k = 0; k < 4; k++) pn.box('#6aa2ac', [r.cx - 1.3, 1.82 - k * 0.09, NORTH + 0.03], [r.cx - 1.3 + 0.3 + (k % 2) * 0.3, 1.835 - k * 0.09, NORTH + 0.034], { shadow: false });
    pn.box('#5d98a3', [r.cx - 0.86, 0, NORTH + 0.02], [r.cx - 0.41, 0.42, NORTH + 0.4], { r: 0.015 });
    pn.box('#2d6575', [r.cx - 0.8, 0.3, NORTH + 0.4], [r.cx - 0.47, 0.36, NORTH + 0.405], { shadow: false });
    // 列の天板の前の縁の光の帯（コールドアイルの囲いの枠の LED。serverroom-2 の両側の上の明るい筋）
    for (const side of [-1, 1]) {
      const xe = r.cx + side * (r.aisle / 2 + 0.02);
      pn.box('#2a6c80', [xe - 0.03, r.rackH, r.rowN], [xe + 0.03, r.rackH + 0.08, r.rowS], { shadow: false });
      pn.box('#9fd6e0', [xe - 0.015 - side * 0.016, r.rackH + 0.025, r.rowN], [xe + 0.015 - side * 0.016, r.rackH + 0.045, r.rowS], { shadow: false });
    }
    // 右の列の上に吊ったファンコイル（serverroom-2 の右上の白い箱 x 870〜1030・y 30〜140）
    hangBox(pn, [r.cx + 1.15, 2.65, -8.27], [0.6, 0.4, 0.85], PAL.boxPale, r.ceil);
    // 右の列の奥から引き出した KVM のコンソール（serverroom-2 の右の奥の突き出た箱）
    kvmDrawer(P([r.cx + r.aisle / 2, 0, -9.75], -Math.PI / 2), { y: 0.82 });
    cableCoil(P([-6.35, 0, -9.1], 0.3), { r: 0.25, loops: 2, tail: [0.3, 0, 0] });
  } else {
    cableCoil(P([r.cx + 0.6, 0, -6.2], 1.2), { r: 0.28, loops: 2 });
    // 点検口の脇の床板の持ち上げ具と三角コーン・外した床板
    tileLifter(P([r.cx + 0.6, 0, 0.6], 0.3));
    // 三角コーンは視点の後ろ（南の点検口の囲い）
    cone(P([r.cx + 0.75, 0, 0.1], 0));
    cone(P([r.cx - 0.75, 0, 1.1], 0));
    const tp = P([r.cx - 0.55, 0, 1.75], 0.1);
    tp.box(PAL.pale, [-0.3, 0, -0.3], [0.3, 0.035, 0.3], { r: 0.004 });
    tp.box(PAL.pale, [-0.28, 0.035, -0.32], [0.32, 0.07, 0.28], { r: 0.004 });
    // 列の中ほどの高さに並ぶスイッチの青い LED の帯（serverroom-1 の両側を奥へ走る光の帯。高さ 1.2 m）
    for (const side of [-1, 1]) {
      const xf = r.cx + (side * r.aisle) / 2 - side * 0.045;
      const lp = P([0, 0, 0]);
      for (let z = r.rowN + 0.05; z < r.rowS - 0.1; z += 0.6) {
        if (R() < 0.3) continue;
        const z0 = z + 0.07 + R() * 0.05;
        const len = 0.08 + R() * 0.2;
        const y = 1.17 + R() * 0.05;
        lp.box('#3ab4e0', [xf - 0.004, y, z0], [xf + 0.004, y + 0.018, z0 + len], { kind: 'glow', shadow: false });
      }
    }
  }
  // 突き当たりの床と壁の足元が光る（C: 奥の床の明るい帯）
  if (r.id === 'C') {
    ctx.addLamp({ pos: [r.cx, 0.25, NORTH + 0.35], radius: 2.2, intensity: 1.6, box: [r.cx - 1.6, -0.1, NORTH + 0.0, r.cx + 1.6, 1.0, NORTH + 1.4], square: true });
  }

  // ---- 天井の照明 ----
  if (r.lights === 'panel') {
    // 突き当たりの壁の上の明るい所（serverroom-0 の扉の上の淡い面: 天井の器具の光が壁を洗う）と扉の前の床
    ctx.addLamp({ pos: [r.cx, r.ceil + 0.1, NORTH + 0.3], radius: 2.4, intensity: 1.8, box: [r.cx - 1.05, r.doorH + 0.12, NORTH - 0.01, r.cx + 1.05, r.ceil + 0.3, NORTH + 0.05], square: true, hard: true });
    ctx.addLamp({ pos: [r.cx, 1.6, NORTH + 0.6], radius: 3.0, intensity: 0.7, box: [r.cx - r.aisle / 2 + 0.15, -0.1, NORTH + 0.02, r.cx + r.aisle / 2 - 0.15, 0.3, r.rowN + 0.4], down: true, square: true });
    // 通路の真上の小さな器具（ルーバーの付いた 0.3 m 角。serverroom-0 の天井の中心の器具: z -7.0・-8.6・-10.2 → 1.6 m おき）
    const louvre = (p: Prop, w: number, d: number): void => {
      p.box('#2a6c84', [-w / 2 - 0.03, -0.035, -d / 2 - 0.03], [w / 2 + 0.03, 0, d / 2 + 0.03], { shadow: false });
      p.box('#8fe4f2', [-w / 2, -0.045, -d / 2], [w / 2, -0.035, d / 2], { kind: 'glow', shadow: false });
      for (let k = 1; k < 5; k++) p.box('#1d5466', [-w / 2, -0.05, -d / 2 + (k * d) / 5 - 0.008], [w / 2, -0.044, -d / 2 + (k * d) / 5 + 0.008], { shadow: false });
    };
    for (let z = -10.2; z < SOUTH; z += 1.6) {
      const p = P([r.cx, r.ceil, z]);
      louvre(p, 0.3, 0.24);
      // 煙感知器（照明の間に吊る）
      p.box(PAL.steelDark, [-0.005, -0.5, 0.78], [0.005, 0, 0.8], { shadow: false });
      p.cyl(PAL.pale, [0, -0.52, 0.79], 0.05, 0.03, { seg: 12, shadow: false });
      ctx.addLamp({ pos: [r.cx, r.ceil - 0.3, z], radius: 2.4, intensity: 0.35, box: [r.cx - r.aisle / 2, -0.1, z - 1.2, r.cx + r.aisle / 2, r.ceil, z + 1.2], down: true });
    }
    // 列の上（ホットアイルの側）の器具（serverroom-0 の左右の上の器具: x ±2.2・同じ 1.6 m おき）
    for (const side of [-1, 1]) for (let z = -10.2; z < SOUTH; z += 1.6) louvre(P([r.cx + side * 2.2, r.ceil, z]), 0.36, 0.22);
  } else if (r.lights === 'strip') {
    // 扉の前の床の明るい所（serverroom-2 の奥の床がいちばん明るい: 北の壁ぎわの器具の光だまり）
    ctx.addLamp({ pos: [r.cx, 1.6, NORTH + 0.6], radius: 3.0, intensity: 0.75, box: [r.cx - r.aisle / 2 + 0.2, -0.1, NORTH + 0.02, r.cx + r.aisle / 2 - 0.2, 0.3, NORTH + 2.6], down: true, square: true });
    // 横に渡る線の器具（serverroom-2 の y 73・147 → z -9.75 と北の壁ぎわ -11.75）
    for (const z of [-11.75, ...Array.from({ length: 6 }, (_, k) => -9.75 + k * 2.6)]) {
      const p = P([r.cx, r.ceil, z]);
      p.box(PAL.ceilHi, [-3.2, -0.06, -0.06], [3.2, 0, 0.06], { shadow: false });
      p.box(PAL.lamp, [-3.1, -0.07, -0.035], [3.1, -0.06, 0.035], { kind: 'glow', shadow: false });
      ctx.addLamp({ pos: [r.cx, r.ceil - 0.3, z], radius: 2.6, intensity: 0.3, box: [r.cx - r.aisle / 2, -0.1, z - 1.3, r.cx + r.aisle / 2, r.ceil, z + 1.3], down: true });
    }
  } else {
    for (let z = NORTH + 1.6; z < SOUTH; z += 2.4) {
      for (const dx of [-1.6, 1.6]) {
        const p = P([r.cx + dx, r.ceil, z]);
        p.box(PAL.lamp, [-0.25, -0.03, -0.06], [0.25, 0, 0.06], { kind: 'glow', shadow: false });
      }
    }
  }
  // ---- 北の壁の、列の端の裏（ほかの物の後に置く: 部屋の乱数の順を変えない） ----
  // 北の壁の、列の端の裏（視点のカメラから列の端に隠れる所: カメラから壁の点への線が列の北の端を通る範囲・列の高さより下）。
  // 側の壁と同じ細かい筋の内張りと、壁掛けの小さな分電盤・札（突き当たりの扉のまわりの見える所は参考画像のまま）
  const ez = (r.id === 'A' ? CAM_A : r.id === 'B' ? CAM_B : CAM_C).eye[2];
  const k = (ez - NORTH) / (ez - r.rowN);
  const hidden: [number, number][] = [
    [r.x0, r.cx + (-r.aisle / 2 - 0.15) * k],
    [r.cx + (r.aisle / 2 + 0.15) * k, r.x1],
  ];
  const lh = r.rackH - 0.25;
  for (const [u0, u1] of hidden) {
    if (env.side) b.boxMM(env.side, [u0 + 0.02, 0.1, NORTH + 0.021], [u1, lh, NORTH + 0.03], { shadow: false });
    const pn = P([0, 0, 0]);
    pn.box('#0f2f3c', [u0 + 0.02, 0, NORTH + 0.021], [u1, 0.1, NORTH + 0.036], { shadow: false });
    // 列の端の裏の壁掛けの盤（ブレーカーの列・銘板・LED）と HOT の札
    const bx = u0 < r.cx ? Math.max(u0 + 0.05, u1 - 0.65) : u0 + 0.1;
    if (u1 - u0 > 0.6) {
      pn.box('#3f7f94', [bx, 0.6, NORTH + 0.03], [bx + 0.5, 1.6, NORTH + 0.17], { r: 0.008 });
      pn.box('#2d6a7e', [bx + 0.03, 0.63, NORTH + 0.17], [bx + 0.47, 1.57, NORTH + 0.175], { shadow: false });
      for (let c = 0; c < 2; c++)
        for (let j = 0; j < 8; j++) {
          const y = 0.75 + j * 0.065;
          pn.box('#1f4656', [bx + 0.06 + c * 0.2, y, NORTH + 0.175], [bx + 0.24 + c * 0.2, y + 0.045, NORTH + 0.18], { shadow: false });
          pn.box('#d6ecf0', [bx + 0.13 + c * 0.2, y + 0.012, NORTH + 0.18], [bx + 0.17 + c * 0.2, y + 0.032, NORTH + 0.186], { shadow: false });
        }
      pn.box(PAL.paper, [bx + 0.1, 1.37, NORTH + 0.175], [bx + 0.4, 1.45, NORTH + 0.18], { shadow: false });
      if (signs) signOn(signs, P([bx + 0.25, 0, NORTH + 0.03]), 'HOT', 0, 1.75, 0.3, 0.15, 0.005);
    }
  }

  // ---- 列の端の板（北の端・南の端。列の外へ向く面なので参考画像の視点からは見えない）: 端の板の継ぎ目・列の番号の札・
  // 銘板・状態の表示の光る帯・下の配線の口 ----
  for (const side of [-1, 1] as const) {
    // 板は列の前面（ガラス扉）から 14 cm 奥から始める（通路から列の端の縁が見えないように）
    const xc = r.cx + side * (r.aisle / 2 + r.depth / 2 + 0.04);
    for (const [z, yaw] of [
      [r.rowN - 0.012, Math.PI],
      [r.rowS + 0.012, 0],
    ] as [number, number][]) {
      const e = P([xc, 0, z], yaw);
      const hw = r.depth / 2 - 0.1;
      e.box(PAL.rackEdge, [-hw, 0.05, -0.012], [hw, r.rackH - 0.05, 0.004], { shadow: false });
      e.box('#0b2633', [-0.006, 0.08, 0.004], [0.006, r.rackH - 0.08, 0.008], { shadow: false });
      for (const x of [-hw + 0.04, hw - 0.04]) e.box('#1d4a5c', [x - 0.012, 0.08, 0.004], [x + 0.012, r.rackH - 0.08, 0.01], { shadow: false });
      e.box(PAL.paper, [-0.2, 1.42, 0.004], [0.2, 1.52, 0.008], { shadow: false });
      e.box('#14303c', [-0.16, 1.45, 0.008], [0.08, 1.47, 0.01], { shadow: false });
      e.box('#3ab4e0', [-0.25, 1.68, 0.004], [0.25, 1.7, 0.01], { kind: 'glow', shadow: false });
      e.box(PAL.black, [-0.3, 0.06, 0.004], [0.3, 0.2, 0.012], { shadow: false });
      if (signs) signOn(signs, e, side < 0 ? 'R01' : 'R02', 0, 1.95, 0.4, 0.2, 0.01);
    }
  }
  return floors;
}
