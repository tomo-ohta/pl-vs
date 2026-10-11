import type * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { rng } from '../../scenes/Builder.ts';
import { builderSink, Prop, shade, type PropMats } from '../../props/kit.ts';
import { chair, extinguisher, steelShelf } from '../../props/lib/index.ts';
import { waterSteps } from './basin.ts';
import { A } from './canalA.ts';
import { B } from './canalB.ts';
import { C } from './canalC.ts';
import { D } from './canalD.ts';
import type { Env } from './env.ts';
import { Frame } from './frame.ts';
import { BASIN, BED, VIEWS, WALK, WATER } from './layout.ts';
import { concreteBench, hoseCabinet, pendantLamp, pipeRailing, planterTrough, rooftopUnit, tubeLight, ventStack, wallLamp, wallVent } from './props/fixtures.ts';
import { cableTray, controlPanel, gateValve, gaugeBoard, hoistBeam, pipeRun, pumpSet, waterTank } from './props/machines.ts';
import { SC } from './props/mats.ts';
import { grassClump, grassTuft, ivyCurtain, mossCushion, shrubClump } from './props/plants.ts';
import { bed, coatRail, crate, duct, filingCabinet, noticeBoard, officeDesk, pictureFrame, radiator, smallDesk, wallClock, wallShelf, wardrobe, washBasin, workbench } from './props/room.ts';
import { bollard, bulkheadLamp, conduitRun, meterCabinet, signPlate } from './props/wall.ts';
import { chippedBlock, debrisCluster, drainGrate, gaugeStaff, mooringRing, skiff, waterLadder } from './props/water.ts';
import { ROOMS, TERRACE } from './rooms.ts';
import { lampNearViews, seenFromViews } from './sight.ts';

/**
 * 写っていない所の作り込み（決まりで、どの水路・水庭にも同じように置く）。
 * - 歩廊の水際: 係留の環（7 m おき）・水へ下りるはしご（21 m おき）・水へ下りる段（30 m おき）
 * - 歩廊の奥の壁ぎわ: 排水の格子（6 m おき）・苔・草の株・壁の腕木の灯り（9 m おき。灯りの光だまりつき）・鉄の扉（14 m おき）・換気口
 * - 水の中: 瓦礫の群れ・水位標（水路の口）・小舟（水庭と D）
 * - 箱の上の縁から垂れる蔦（壁の高い所）
 * - 部屋ごとの置く物（ポンプ室・管理室・階段室・小部屋・テラス）
 * 参考画像の視点から 35 m 以内に見える所には置かない（視点の見た目を変えない）。
 */

interface Edge {
  /** 局所の座標の水際の線 x = X（z0〜z1）。水は +x 側（sideW = 1）か -x 側（-1） */
  X: number;
  z0: number;
  z1: number;
  sideW: 1 | -1;
  top: number;
  /** 奥の壁の面 x（歩廊の奥） */
  back: number;
  /** 縁石を置かない z の範囲（水の入る切り欠き） */
  noKerb?: [number, number][];
}

export function dressAll(env: Env, outMats: PropMats, roomMats: PropMats, stepMat: THREE.Material): void {
  const sink = builderSink(env.b, env.ctx);
  /** 世界の箱が参考画像の視点から近く見えるか（塊に隠れる所は見えない。sight.ts） */
  const seen = (min: V3, max: V3, near = 35): boolean => seenFromViews(min, max, near);
  let seed = 9000;
  /** 局所の位置・向きの物（見えるなら置かない） */
  const put = (f: Frame, mats: PropMats, pos: V3, yaw: number, ext: number, fn: (p: Prop) => void, near = 35): void => {
    const w = f.p(...pos);
    if (seen([w[0] - ext, w[1] - ext, w[2] - ext], [w[0] + ext, w[1] + ext * 2, w[2] + ext], near)) return;
    fn(Prop.at(sink, mats, w, f.yawW(yaw), seed++));
  };
  const lamp = (f: Frame, pos: V3, box: [number, number, number, number, number, number], intensity = 0.9): void => {
    const w = f.box([box[0], box[1], box[2]], [box[3], box[4], box[5]]);
    // 光だまりが参考画像の視点に届くなら灯さない（視点の見た目を変えない）
    if (lampNearViews(w.min, w.max)) return;
    env.ctx.addLamp({ pos: f.p(...pos), radius: 6.5, intensity: intensity * 1.3, color: '#f3ead2', box: [...w.min, ...w.max], down: true, shadow: 0.6 });
  };

  /**
   * 水際の縁石（決まり: 歩廊の水の側の縁に、幅 0.32 m・長さ 1.2 m の打ち放しの縁石を 1 cm の目地で並べる。2.5 cm 高い）と、
   * その内の側溝（幅 0.2 m。歩廊の水を水路へ落とす）。
   * X = 水際の線、sideW = 水の向き（+1 = +x 側が水）。skip の z の範囲（段・はしご）は空ける
   */
  const kerb = (f: Frame, X: number, sideW: 1 | -1, top: number, z0: number, z1: number, skip: [number, number][] = []): void => {
    for (let z = z0; z + 0.3 < z1; z += 1.21) {
      const zb = Math.min(z + 1.2, z1);
      if (skip.some(([a, b]) => z < b && zb > a)) continue;
      const xa = X - sideW * 0.32;
      const w0 = f.p(Math.min(xa, X), top, z);
      const w1 = f.p(Math.max(xa, X), top + 0.025, zb);
      const mn: V3 = [Math.min(w0[0], w1[0]), top, Math.min(w0[2], w1[2])];
      const mx: V3 = [Math.max(w0[0], w1[0]), top + 0.025, Math.max(w0[2], w1[2])];
      if (seen(mn, mx, 40)) continue;
      const p = Prop.at(sink, outMats, [0, 0, 0], 0, seed++);
      p.box(Math.round(z / 1.21) % 2 ? SC.concMid : shade(SC.concMid, -0.12), mn, mx, { r: 0.006, shadow: 'receive' });
      // 縁石の内の側溝（幅 0.2 m の暗い溝と、両側の鉄の縁）
      const ga = X - sideW * 0.42;
      const gb = X - sideW * 0.62;
      const g0 = f.p(Math.min(ga, gb), top, z);
      const g1 = f.p(Math.max(ga, gb), top + 0.004, zb);
      const gmn: V3 = [Math.min(g0[0], g1[0]), top, Math.min(g0[2], g1[2])];
      const gmx: V3 = [Math.max(g0[0], g1[0]), top + 0.004, Math.max(g0[2], g1[2])];
      p.box(SC.steelDark, gmn, gmx, { shadow: 'receive' });
      for (const ex of [ga, gb]) {
        const e0 = f.p(ex - 0.012, top, z);
        const e1 = f.p(ex + 0.012, top + 0.008, zb);
        p.box(SC.steel, [Math.min(e0[0], e1[0]), top, Math.min(e0[2], e1[2])], [Math.max(e0[0], e1[0]), top + 0.008, Math.max(e0[2], e1[2])], { shadow: 'receive' });
      }
    }
  };

  // ================= 水路の歩廊 =================
  const fA = new Frame(VIEWS.v2.frame);
  const fB = new Frame(VIEWS.v0.frame);
  const fC = new Frame(VIEWS.v3.frame);
  const fD = new Frame(VIEWS.v1.frame);
  const canals: { f: Frame; edges: Edge[]; seed: number }[] = [
    {
      f: fA,
      seed: 1,
      edges: [
        { X: A.wl, z0: A.endZ + 2, z1: A.mouthZ - 1, sideW: 1, top: WALK, back: A.backL },
        { X: A.wr, z0: A.endZ + 2, z1: A.mouthZ - 1, sideW: -1, top: WALK, back: A.backR },
      ],
    },
    { f: fC, seed: 2, edges: [{ X: C.walkEdge, z0: C.endZ + 2, z1: C.mouthZ - 1, sideW: 1, top: C.walkTop, back: C.walkBack - 1.4 }] },
    {
      f: fD,
      seed: 3,
      edges: [
        { X: D.wl, z0: D.endZ + 2, z1: D.mouthZ - 1, sideW: 1, top: D.walkTop, back: D.baseL, noKerb: [[-7.8, -6.3], [-12.5, -9.7], [-20, -16.2], [-30.7, -25.8]] },
        { X: D.wr, z0: D.endZ + 2, z1: D.mouthZ - 1, sideW: -1, top: D.walkTop, back: D.wallR, noKerb: [[-7.8, -5.0], [-12.8, -10.1], [-21.7, -16.8], [-33.2, -28.3]] },
      ],
    },
  ];
  for (const c of canals) {
    const r = rng(c.seed * 77);
    for (const e of c.edges) {
      // 歩廊の上の面の局所の向き: 水の方が +z になる yaw（x の正の向きへ水 → yaw = -π/2）
      const toWater = e.sideW > 0 ? Math.PI / 2 : -Math.PI / 2;
      const toWall = -toWater;
      const inward = -e.sideW; // 壁の方へ向かう x の符号
      for (let z = e.z0 + 3; z < e.z1; z += 7) {
        put(c.f, outMats, [e.X + inward * 0.25, e.top + 0.025, z], toWater, 0.5, (p) => (Math.round(z / 7) % 2 ? mooringRing(p) : bollard(p.sub([0, 0, -0.1]))));
      }
      kerb(c.f, e.X, e.sideW, e.top, e.z0, e.z1, e.noKerb);
      for (let z = e.z0 + 10; z < e.z1; z += 21) put(c.f, outMats, [e.X, e.top, z], toWater, 1.2, (p) => waterLadder(p, e.top - BED));
      for (let z = e.z0 + 16; z < e.z1 - 4; z += 30) {
        const w = c.f.p(e.X, 0, z);
        if (seen([w[0] - 2, -1, w[2] - 2], [w[0] + 2, 1, w[2] + 2])) continue;
        const d = c.f.dir(e.sideW, 0);
        const dir = Math.abs(d[0]) > 0.5 ? (d[0] > 0 ? '+x' : '-x') : d[1] > 0 ? '+z' : '-z';
        const along = Math.abs(d[0]) > 0.5 ? [w[0], w[2]] : [w[0], w[2]];
        waterSteps(env, stepMat, along[0], along[1], 2.4, dir);
      }
      // 奥の壁ぎわ
      const wallX = e.back + inward * 0;
      for (let z = e.z0 + 2; z < e.z1; z += 6) {
        put(c.f, outMats, [wallX - inward * 0.6, e.top + 0.005, z], 0, 0.5, (p) => drainGrate(p, 0.55, 0.35));
        if (r() < 0.55) put(c.f, outMats, [wallX - inward * (0.25 + r() * 0.3), e.top, z + 2 + r() * 2], r() * 6, 0.4, (p) => (r() < 0.5 ? mossCushion(p, 0.4 + r() * 0.5) : grassTuft(p, 0.18 + r() * 0.15)));
      }
      // 壁の腕木の灯り・戸口・換気口は壁の決まり（frontage.ts）が置く（戸口・窓と重ならないように）
      void toWall;
    }
    // 水の中の瓦礫（水路の中ほど）
    const e0 = c.edges[0];
    const e1 = c.edges[c.edges.length - 1];
    const mid = c.edges.length > 1 ? (e0.X + e1.X) / 2 : e0.X + 3;
    for (let z = e0.z0 + 8; z < e0.z1 - 6; z += 13 + r() * 9) put(c.f, outMats, [mid + (r() - 0.5) * 2, BED + 0.2, z], r() * 6, 1.6, (p) => debrisCluster(p, 3 + Math.floor(r() * 4)));
    // 水路の口の水位標
    put(c.f, outMats, [e0.X + e0.sideW * 0.4, BED, e0.z1 - 2], 0, 0.5, (p) => gaugeStaff(p, 2.6, 0));
  }

  // ================= A の水路の中の小さな立方体と沈んだ細い縁（参考画像 squareroom-2 の水面の瓦礫。画素から置いた） =================
  for (const [x, z, sz] of [
    [-0.77, -8.16, 0.42],
    [-0.34, -8.59, 0.36],
    [0.14, -9.29, 0.4],
    [0.16, -7.45, 0.45],
    [0.06, -11.7, 0.38],
    [1.09, -9.93, 0.4],
    [-1.06, -8.93, 0.34],
  ] as [number, number, number][]) {
    const w = fA.p(x, WATER - 0.15, z);
    const q = sz * 0.5;
    chippedBlock(Prop.at(sink, outMats, w, fA.yawW((x * 7) % 0.4), 520 + Math.round(z * 10)), q, 0.15 + q * 0.7, q * 0.9, { moss: 0, color: SC.concDark });
  }
  // 沈んだ細い縁（水面すれすれの古い仕切り）
  for (const [x0, x1, z] of [
    [-1.28, 1.1, -18.35],
    [0.0, 1.04, -14.79],
    [-1.07, 0.94, -13.42],
    [0.24, 1.95, -9.78],
  ] as [number, number, number][]) {
    const a = fA.p(x0, WATER - 0.3, z - 0.08);
    const b = fA.p(x1, WATER + 0.035, z + 0.08);
    env.b.boxMM(env.voidMat, [Math.min(a[0], b[0]), a[1], Math.min(a[2], b[2])], [Math.max(a[0], b[0]), b[1], Math.max(a[2], b[2])], { shadow: false });
  }

  // ================= B の通り: 板石の上の草の株と、壁の足元の苔 =================
  {
    const r = rng(311);
    for (let z = B.mouthZ - 2; z > B.endZ + 2; z -= 2.5) {
      for (const x of [B.chL - 0.4 - r() * 1.2, B.chR + 0.4 + r() * 1.2]) {
        if (r() < 0.5) put(fB, outMats, [x, 0.03, z], r() * 6, 0.3, (p) => grassTuft(p, 0.12 + r() * 0.12, 9), 28);
      }
      if (r() < 0.6) put(fB, outMats, [B.xl - 0.3, 0.03, z], 0, 0.4, (p) => mossCushion(p, 0.5), 28);
    }
  }

  // ================= 水庭: 長椅子・小舟・水位標・灯り =================
  {
    const fw = new Frame({ k: 0, ox: 0, oz: 0 });
    const Wk = BASIN.walk;
    for (const [x, z, yaw] of [
      [-10, -16.4, 0],
      [10, 16.4, Math.PI],
      [16.4, 9, -Math.PI / 2],
      [-16.4, -12, Math.PI / 2],
    ] as [number, number, number][]) {
      put(fw, outMats, [x, WALK, z], yaw, 1.3, (p) => concreteBench(p, 2.4));
    }
    put(fw, outMats, [-9, -0.02, 6], 0.3, 2, (p) => skiff(p));
    put(fw, outMats, [-13.5, BED, -13.5], 0, 0.5, (p) => gaugeStaff(p, 2.6, 0));
    for (const [x, z, yaw] of [
      [-Wk, -6, Math.PI / 2],
      [-Wk, -14, Math.PI / 2],
      [Wk, 8, -Math.PI / 2],
      [Wk, 16, -Math.PI / 2],
      [-14, -Wk, 0],
      [0, -Wk, 0],
      [-14, Wk, Math.PI],
      [17, Wk, Math.PI],
    ] as [number, number, number][]) {
      put(fw, outMats, [x, 0, z], yaw, 0.6, (p) => wallLamp(p, WALK + 2.3));
      const d = fw.dir(Math.sin(yaw), Math.cos(yaw));
      lamp(fw, [x + d[0] * 0.4, WALK + 2.1, z + d[1] * 0.4], [Math.min(x, x + d[0] * 4.5) - 3.5, 0, Math.min(z, z + d[1] * 4.5) - 3.5, Math.max(x, x + d[0] * 4.5) + 3.5, 3.5, Math.max(z, z + d[1] * 4.5) + 3.5], 0.7);
    }
    // 水際の縁石（四方の歩廊と島。水へ下りる段の所は空ける）
    const fN = new Frame({ k: 3, ox: 0, oz: 0 });
    kerb(fw, -BASIN.water, 1, WALK, -BASIN.water, BASIN.water, [[-10.6, -7.4]]);
    kerb(fw, BASIN.water, -1, WALK, -BASIN.water, BASIN.water, [[7.4, 10.6]]);
    kerb(fN, -BASIN.water, 1, WALK, -BASIN.water, BASIN.water, [[-10.6, -7.4]]);
    kerb(fN, BASIN.water, -1, WALK, -BASIN.water, BASIN.water, [[7.4, 10.6]]);
    // 島から南北へ渡る飛び石（1.2 m 角・間 0.2 m。欠けた打ち放しの塊に苔）
    for (const sgn of [1, -1]) {
      for (let i = 0; i < 8; i++) {
        const z0 = 3 + 0.2 + i * 1.4;
        if (z0 + 1.2 > BASIN.water) break;
        const zc = sgn * (z0 + 0.6);
        chippedBlock(Prop.at(sink, outMats, [0, BED, zc], (i % 2) * 0.04 - 0.02, 700 + i + (sgn > 0 ? 0 : 20)), 1.2, 0.6, 1.2, { moss: 0.4, waterline: 0.45 });
      }
    }
    // 島の上の苔と草・東屋の下の長椅子と灯り
    for (let i = 0; i < 5; i++) put(fw, outMats, [(i - 2) * 1.1, WALK, (i % 2 ? 1.5 : -1.8)], i, 0.4, (p) => (i % 2 ? grassTuft(p) : mossCushion(p, 0.6)));
    put(fw, outMats, [-1.6, WALK, 0], Math.PI / 2, 1.3, (p) => concreteBench(p, 2.2));
    put(fw, outMats, [0, 0, 0], 0, 0.3, (p) => pendantLamp(p, 3.05, 0.6), 0);
    lamp(fw, [0, 2.4, 0], [-2.9, WALK - 0.2, -2.9, 2.9, 3.0, 2.9], 1.0);
  }

  // ================= D の小舟（扉の手前に舫ってある） =================
  put(fD, outMats, [-1.0, -0.02, -32], 0.05, 2, (p) => skiff(p));

  // ================= 高い所の蔦（決まりで積んだ箱の、水路に向く面の上の縁から垂れる。6〜22 m） =================
  {
    const r = rng(4242);
    for (const fc of env.faces) {
      const bx = fc.box;
      if (bx.max[1] < 6 || bx.max[1] > 22 || r() > 0.14) continue;
      const len = bx.max[2] - bx.min[2];
      if (len < 2) continue;
      const x = fc.side === 'L' ? bx.max[0] : bx.min[0];
      const yaw = fc.side === 'L' ? Math.PI / 2 : -Math.PI / 2;
      const wdt = Math.min(2.6, len * (0.3 + r() * 0.4));
      const zc = bx.min[2] + len * (0.2 + r() * 0.6);
      put(fc.f, outMats, [x, bx.max[1], zc], yaw, 2, (p) => ivyCurtain(p, wdt, Math.min(bx.max[1] - bx.min[1], 1.5 + r() * 3)), 120);
    }
  }

  // ================= 部屋 =================
  const fw = new Frame({ k: 0, ox: 0, oz: 0 });
  const roomLamp = (x: number, z: number, ceil: number, box: [number, number, number, number, number, number], intensity = 1.1, radius = 5.0): void => {
    put(fw, roomMats, [x, 0, z], 0, 0.3, (p) => pendantLamp(p, ceil, 0.7), 0);
    env.ctx.addLamp({ pos: [x, ceil - 0.9, z], radius, intensity: intensity * 2.2, color: '#ecebdc', box, down: true, shadow: 0.5 });
  };
  /**
   * 部屋の窓（決まり: どの部屋も水路・外の明るさを取り込む窓を 1 つ）: 光る窓の板（外の霞の色）と、床に落ちる四角い硬い光だまり。
   * wall = 窓の付く面（'n' | 's' | 'e' | 'w'）、at = 面に沿った中心、w × h、sill = 窓の下端の高さ
   */
  const roomWindow = (r: (typeof ROOMS)[number], wall: 'n' | 's' | 'e' | 'w', at: number, w: number, h: number, sill: number): void => {
    const [x0, z0, x1, z1] = r.rect;
    const y = r.floor;
    const glowM = env.glow('#d3e2df');
    // 光だまりは窓の前の床と家具だけ（窓の付く壁・天井は照らさない）。窓から斜めに差し込む: 窓から 0.6〜3 m の床
    const top = y + sill + h * 0.4;
    let pos: [number, number, number];
    let lampBox: [number, number, number, number, number, number];
    if (wall === 'n' || wall === 's') {
      const zz = wall === 'n' ? z0 - 0.02 : z1;
      env.b.boxMM(glowM, [at - w / 2, y + sill, zz], [at + w / 2, y + sill + h, zz + 0.02], { shadow: false });
      const d0 = wall === 'n' ? z0 + 0.15 : z1 - 3.4;
      const d1 = wall === 'n' ? z0 + 3.4 : z1 - 0.15;
      lampBox = [at - w / 2 - 0.6, y - 0.2, d0, at + w / 2 + 0.6, top, d1];
      pos = [at, y, (d0 + d1) / 2];
    } else {
      const xx = wall === 'w' ? x0 - 0.02 : x1;
      env.b.boxMM(glowM, [xx, y + sill, at - w / 2], [xx + 0.02, y + sill + h, at + w / 2], { shadow: false });
      const d0 = wall === 'w' ? x0 + 0.15 : x1 - 3.4;
      const d1 = wall === 'w' ? x0 + 3.4 : x1 - 0.15;
      lampBox = [d0, y - 0.2, at - w / 2 - 0.6, d1, top, at + w / 2 + 0.6];
      pos = [(d0 + d1) / 2, y, at];
    }
    // 照らす箱は部屋の内側（壁から 0.15 m）に収める（隣の壁を照らさない）
    lampBox = [Math.max(lampBox[0], x0 + 0.15), lampBox[1], Math.max(lampBox[2], z0 + 0.15), Math.min(lampBox[3], x1 - 0.15), lampBox[4], Math.min(lampBox[5], z1 - 0.15)];
    env.ctx.addLamp({ pos, radius: 2.4, intensity: 2.6, color: '#e9f0ea', box: lampBox, square: true, hard: true, shadow: 0 });
  };
  /** 部屋の小さな光だまり（机の灯り・作業灯）。照らす箱の外は暗いまま（部屋の隅の暗がり） */
  const pool = (pos: V3, box: [number, number, number, number, number, number], intensity = 1.6, radius = 1.8): void => {
    env.ctx.addLamp({ pos, radius, intensity, color: '#ede7d2', box, down: true, shadow: 0.4 });
  };
  // ---- ポンプ室: ポンプ 2 組・水槽・制御盤・圧力計の板・壁ぎわの配管とフランジ・仕切弁・吊り上げの梁・電線の受け皿・溝の格子・階段の手すり ----
  {
    const r = ROOMS[1];
    const [x0, z0, x1, z1] = r.rect;
    const y = r.floor;
    put(fw, roomMats, [-45.5, y, 25.5], 0, 1, (p) => pumpSet(p), 0);
    put(fw, roomMats, [-40.5, y, 25.5], Math.PI, 1, (p) => pumpSet(p), 0);
    put(fw, roomMats, [x1 - 1.0, y, z0 + 1.6], -Math.PI / 2, 1, (p) => waterTank(p, 0.7, 2.0), 0);
    put(fw, roomMats, [x0 + 0.3, y, 22.0], Math.PI / 2, 1, (p) => controlPanel(p, 1.2), 0);
    // 配管: 2 つのポンプの吐き出しから上へ、天井の下を壁へ
    put(fw, roomMats, [0, 0, 0], 0, 0, (p) => pipeRun(p, [[-45.0, y + 1.16, 25.5], [-45.0, y + 2.4, 25.5], [-45.0, y + 2.4, z1 - 0.3], [x0 + 0.3, y + 2.4, z1 - 0.3]], 0.1), 0);
    put(fw, roomMats, [0, 0, 0], 0, 0, (p) => pipeRun(p, [[-41.0, y + 1.16, 25.5], [-41.0, y + 2.4, 25.5], [-41.0, y + 2.4, z1 - 0.3], [x1 - 0.3, y + 2.4, z1 - 0.3]], 0.1), 0);
    put(fw, roomMats, [x0 + 0.5, y, 24.5], 0, 1, (p) => {
      pipeRun(p, [[0, 0.5, -1.5], [0, 0.5, 2.5]], 0.12);
      gateValve(p.sub([0, 0.5, 0.5], Math.PI / 2), 0.12);
    }, 0);
    // 南の壁ぎわの吸い込みの管（床の上 0.55 m・フランジ・仕切弁 2 つ）と、東の壁の圧力計の板
    put(fw, roomMats, [0, 0, 0], 0, 0, (p) => {
      pipeRun(p, [[x0 + 0.4, y + 0.55, z1 - 0.3], [x1 - 1.8, y + 0.55, z1 - 0.3], [x1 - 1.8, y + 0.55, 23.4]], 0.14, SC.steel);
      gateValve(p.sub([-46.2, y + 0.55, z1 - 0.3]), 0.14);
      gateValve(p.sub([-41.8, y + 0.55, z1 - 0.3]), 0.14);
    }, 0);
    put(fw, roomMats, [x1, 0, 25.4], -Math.PI / 2, 0.5, (p) => gaugeBoard(p, y + 1.65), 0);
    put(fw, roomMats, [x1 - 0.36, y, 27.05], -Math.PI / 2, 1, (p) => workbench(p, 1.7, 0.7), 0);
    put(fw, roomMats, [(x0 + x1) / 2, 0, 21.2], 0, 0, (p) => duct(p, x1 - x0 - 0.4, r.ceil - 0.76, 0.6, 0.36), 0);
    // 吊り上げの梁（ポンプの上を東西に）・北の壁の電線の受け皿
    put(fw, roomMats, [-43, 0, 25.5], 0, 0, (p) => hoistBeam(p, x1 - x0 - 0.2, r.ceil - 0.62, -2.5), 0);
    put(fw, roomMats, [-46.2, 0, z0], 0, 0, (p) => cableTray(p, 3.2, y + 3.4), 0);
    put(fw, roomMats, [-40.2, 0, z0], 0, 0, (p) => cableTray(p, 3.6, y + 3.4), 0);
    // 床の溝の格子（ポンプの前に東西に）
    put(fw, roomMats, [-43, y + 0.005, 27.2], 0, 0.5, (p) => drainGrate(p, 6.4, 0.36), 0);
    put(fw, roomMats, [x0, 0, 26.5], -Math.PI / 2, 0.5, (p) => wallVent(p.sub([0, y + 2.4, 0]), 0.5, 0.3), 0);
    // 階段の手すり（東の縁。支柱 1 m ごと）
    put(fw, roomMats, [0, 0, 0], 0, 0, (p) => {
      const xr = -42.4;
      const za = 22.9;
      const zb = 19.95;
      p.rod(SC.steel, [xr, y + 0.95, za], [xr, 0.35 + 0.95, zb], 0.022);
      for (let k = 0; k <= 3; k++) {
        const t = k / 3;
        const zz = za + (zb - za) * t;
        const yy = y + (0.35 - y) * t;
        p.rod(SC.steel, [xr, yy, zz], [xr, yy + 0.95, zz], 0.018);
      }
    }, 0);
    // 天井が高い（4.5 m）ので、光が床まで届く半径に
    roomLamp(-45.5, 25.2, r.ceil, [x0, y - 0.2, 23.6, -43, r.ceil, z1], 1.6, 5.4);
    roomLamp(-40.5, 25.2, r.ceil, [-43, y - 0.2, 23.6, x1, r.ceil, z1], 1.6, 5.4);
    // 天井の蛍光灯 2 列（梁の間。下の床と機械だけ明るい光だまり）
    for (const [x, z] of [
      [-41.0, 22.6],
      [-45.0, 22.6],
    ] as [number, number][]) {
      put(fw, roomMats, [x, 0, z], 0, 0, (p) => tubeLight(p, 1.5, r.ceil - 0.3, 0.3), 0);
      pool([x, r.ceil - 0.5, z], [x - 2.3, y - 0.2, z - 1.6, x + 2.3, r.ceil - 0.3, z + 1.6], 2.4, 5.6);
    }
    // 扉の内の灯り（階段と扉の前だけ明るい）
    put(fw, roomMats, [-43.2, 0, z0], 0, 0.3, (p) => bulkheadLamp(p, 0.35 + 2.95), 0);
    pool([-43.2, 0.35 + 2.6, z0 + 0.5], [-44.1, y - 0.2, z0, -42.3, 0.35 + 3.0, z0 + 3.6], 2.4, 3.6);
    // 制御盤の上の作業灯（盤の前だけ明るい）
    pool([x0 + 0.9, y + 2.3, 22.0], [x0, y - 0.2, 20.8, x0 + 2.4, y + 2.6, 23.2], 1.8, 2.4);
    // 非常口の表示灯（扉の上）と、南の壁の高窓（外の湖の明るさ）
    env.b.boxMM(env.glow('#8fe0a8'), [-43.6, 0.35 + 2.45, z0 + 0.0], [-42.8, 0.35 + 2.7, z0 + 0.06], { shadow: false });
    roomWindow(r, 's', -41, 3.0, 0.5, 2.3);
  }
  // ---- 管理室: 机 2 つ（書類・台帳・灯り・電話）と椅子・棚 2・書類の引き出しの棚 3・掲示板 2・時計 ----
  {
    const r = ROOMS[2];
    const [x0, z0, x1, z1] = r.rect;
    const y = r.floor;
    put(fw, roomMats, [33.5, y, 7.8], Math.PI, 1, (p) => officeDesk(p), 0);
    put(fw, roomMats, [33.5, y, 7.0], 0, 0.5, (p) => chair(p, { kind: 'office', seat: SC.binder, frame: SC.steelDark, base: SC.steelDark }), 0);
    put(fw, roomMats, [30.6, y, 7.8], Math.PI, 1, (p) => officeDesk(p), 0);
    put(fw, roomMats, [30.4, y, 6.9], 0.4, 0.5, (p) => chair(p, { kind: 'office', seat: SC.binder2, frame: SC.steelDark, base: SC.steelDark }), 0);
    put(fw, roomMats, [x1 - 0.3, y, 5.4], -Math.PI / 2, 1, (p) => steelShelf(p, { frame: SC.steel, load: ['binders', 'paper', 'binders', 'bins'], colors: [SC.binder, SC.binder2, SC.paper, SC.paintPale] }), 0);
    put(fw, roomMats, [x0 + 0.3, y, 7.6], Math.PI / 2, 1, (p) => steelShelf(p, { frame: SC.steel, load: ['paper', 'binders', 'binders', 'paper'], colors: [SC.binder2, SC.binder, SC.paper] }), 0);
    for (const z of [6.6, 7.1, 7.6]) put(fw, roomMats, [x1 - 0.33, y, z], -Math.PI / 2, 0.4, (p) => filingCabinet(p, 4), 0);
    put(fw, roomMats, [x0, 0, 5.2], Math.PI / 2, 0.3, (p) => noticeBoard(p, y + 1.55, 1.3, 0.85), 0);
    put(fw, roomMats, [31.4, 0, z0], 0, 0.3, (p) => noticeBoard(p, y + 1.6, 1.0, 0.7), 0);
    put(fw, roomMats, [31.5, 0, z1], Math.PI, 0.3, (p) => wallClock(p.sub([0, y + 2.3, 0])), 0);
    put(fw, roomMats, [(x0 + x1) / 2, 0, z0 + 0.8], 0, 0, (p) => duct(p, x1 - x0 - 0.4, r.ceil - 0.76), 0);
    roomLamp(32, 6.6, r.ceil, [x0, y - 0.2, z0, x1, r.ceil, z1], 1.2);
    // 机の灯りの光だまり
    pool([33.0, y + 1.15, 8.0], [32.6, y - 0.2, 7.2, 34.3, y + 1.4, 8.4], 1.6);
    pool([30.1, y + 1.15, 8.0], [29.7, y - 0.2, 7.2, 31.4, y + 1.4, 8.4], 1.4);
    roomWindow(r, 'n', 33.6, 2.4, 1.2, 1.0);
  }
  // ---- 階段室: 踊り場の壁の灯り・両側の手すり（腕木つき）・踊り場の階の札・消火栓の箱 ----
  {
    const r = ROOMS[0];
    const [x0, z0, x1, z1] = r.rect;
    for (const [x, y] of [
      [x1 - 0.2, r.floor],
      [x0 + 0.2, r.floor + 3.1],
      [x1 - 0.2, r.floor + 6.2],
      [x0 + 0.2, r.floor + 9.3],
      [x1 - 0.2, r.floor + 12.4],
    ] as [number, number][]) {
      const yaw = x > -9 ? -Math.PI / 2 : Math.PI / 2;
      put(fw, roomMats, [x, 0, (z0 + z1) / 2], yaw, 0.3, (p) => wallLamp(p, y + 2.4), 0);
      // 照らす箱は階段室全体（吹き抜けで 1 つの空間。箱の縁が壁を横切らない）。届く範囲は半径で決まる
      env.ctx.addLamp({ pos: [x + (x > -9 ? -0.5 : 0.5), y + 2.2, (z0 + z1) / 2], radius: 4.5, intensity: 1.1, color: '#f3ead2', box: [x0, r.floor - 0.2, z0, x1, r.ceil, z1], shadow: 0.4 });
      // 階の札（灯りの脇）
      put(fw, roomMats, [x > -9 ? x1 : x0, 0, z0 + 0.7], yaw, 0.3, (p) => signPlate(p, y + 1.7, 0.26, 0.26, SC.white), 0);
    }
    for (let k = 0; k < 4; k++) roomWindow({ ...r, floor: r.floor + 3.1 * k }, 'w', (z0 + z1) / 2, 0.7, 2.0, 1.0);
    // 段の途中の壁の灯り（段の勾配の中ほど。外側の壁）と、段の上の光だまり（段の幅だけ）
    for (let k = 0; k < 4; k++) {
      const north = k % 2 === 0;
      const zw = north ? z0 : z1;
      const yy = r.floor + 3.1 * k + 1.55;
      put(fw, roomMats, [-8.5, 0, zw], north ? 0 : Math.PI, 0.3, (p) => wallLamp(p, yy + 1.9), 0);
      const lz = north ? [z0, z0 + 1.6] : [z1 - 1.6, z1];
      env.ctx.addLamp({ pos: [-8.5, yy + 1.6, (lz[0] + lz[1]) / 2], radius: 3.2, intensity: 1.5, color: '#f3e6c8', box: [x0, r.floor - 0.2, z0, x1, r.ceil, z1], down: true, shadow: 0.3 });
    }
    const sp = (z0 + z1) / 2;
    for (const [zz, zs, y0, dx] of [
      [z0 + 0.06, sp - 0.16, r.floor, -1],
      [z1 - 0.06, sp + 0.16, r.floor + 3.1, 1],
      [z0 + 0.06, sp - 0.16, r.floor + 6.2, -1],
      [z1 - 0.06, sp + 0.16, r.floor + 9.3, 1],
    ] as [number, number, number, number][]) {
      // 両側の手すり（段の勾配に沿って。壁と背骨の壁に腕木で留める）
      const xa = dx < 0 ? -5.96 : -11.0;
      const xb = dx < 0 ? -11.0 : -5.96;
      // 外側の壁の手すり（腕木で留める）
      const z = zz + (zz < sp ? 0.05 : -0.05);
      put(fw, roomMats, [0, 0, 0], 0, 0, (p) => {
        p.rod(SC.steel, [xa, y0 + 0.9, z], [xb, y0 + 0.9 + 3.1, z], 0.024);
        for (let t = 0.15; t < 1; t += 0.28) {
          const x = xa + (xb - xa) * t;
          const yy = y0 + 0.9 + 3.1 * t;
          p.rod(SC.steelDark, [x, yy - 0.06, z], [x, yy - 0.06, zz], 0.01, { shadow: 'receive', radial: 5 });
        }
      }, 0);
      // 吹き抜けの側の柵（3 段ごとの支柱・笠木・中桟 2 本・下の幅木）
      const ze = zs + (zs < sp ? 0.1 : -0.1);
      put(fw, roomMats, [0, 0, 0], 0, 0, (p) => {
        for (const h of [0.95, 0.62, 0.3]) p.rod(h > 0.9 ? SC.steel : SC.steelDark, [xa, y0 + h, ze], [xb, y0 + 3.1 + h, ze], h > 0.9 ? 0.026 : 0.012, { radial: 6 });
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          const x = xa + (xb - xa) * t;
          const yy = y0 + 3.1 * t;
          p.box(SC.steelDark, [x - 0.02, yy, ze - 0.02], [x + 0.02, yy + 0.95, ze + 0.02]);
        }
      }, 0);
    }
    put(fw, roomMats, [x1, 0, 22.3], -Math.PI / 2, 0.4, (p) => hoseCabinet(p, r.floor + 0.9), 0);
    // 階ごとの電線管（北と南の壁。踊り場の上 2.7 m・継ぎ箱 3 m ごと）
    for (let k = 0; k < 5; k++) {
      const cy = r.floor + 3.1 * k + 2.7;
      if (cy > r.ceil - 0.3) continue;
      put(fw, roomMats, [(x0 + x1) / 2, 0, z0], 0, 0, (p) => conduitRun(p, x1 - x0 - 0.6, cy, { boxEvery: 3.0 }), 0);
      put(fw, roomMats, [(x0 + x1) / 2, 0, z1], Math.PI, 0, (p) => conduitRun(p, x1 - x0 - 0.6, cy, { boxEvery: 3.0 }), 0);
    }
    // いちばん上の踊り場（12.7 m）の吹き抜けの縁の柵（北の列の上は 9.6 m まで吹き抜け）
    put(fw, roomMats, [0, 0, 0], 0, 0, (p) => {
      const xg = -5.96 + 0.05;
      const yg = r.floor + 12.4;
      for (const h of [1.0, 0.62, 0.3]) p.rod(h > 0.9 ? SC.steel : SC.steelDark, [xg, yg + h, z0 + 0.05], [xg, yg + h, z0 + 1.65], h > 0.9 ? 0.026 : 0.012, { radial: 6 });
      for (let i = 0; i <= 3; i++) p.box(SC.steelDark, [xg - 0.02, yg, z0 + 0.05 + i * 0.53 - 0.02], [xg + 0.02, yg + 1.0, z0 + 0.05 + i * 0.53 + 0.02]);
      p.collide([xg - 0.05, yg, z0], [xg + 0.05, yg + 1.0, z0 + 1.7]);
    }, 0);
    // 1 階の段の上り口: 北の壁の掲示板と分電盤
    put(fw, roomMats, [-6.9, 0, z0], 0, 0.3, (p) => noticeBoard(p, r.floor + 1.95, 1.0, 0.7), 0);
    put(fw, roomMats, [-5.0, 0, z0], 0, 0.3, (p) => meterCabinet(p, r.floor + 0.9, 0.6, 0.8), 0);
    // 消火の立て管（南東の隅。床から屋上まで。踊り場ごとに弁）と、段の鼻の鉄の縁（段ごと）・踊り場の消火器
    put(fw, roomMats, [0, 0, 0], 0, 0, (p) => {
      const px = x1 - 0.16;
      const pz = z1 - 0.16;
      pipeRun(p, [[px, r.floor, pz], [px, r.ceil, pz]], 0.07, SC.red);
      for (let k = 0; k < 5; k++) gateValve(p.sub([px - 0.2, r.floor + 3.1 * k + 1.1, pz], Math.PI / 2), 0.05);
      const n = 18;
      const rh = 3.1 / n;
      for (let k = 0; k < 4; k++) {
        const north = k % 2 === 0;
        const lz: [number, number] = north ? [z0, z0 + 1.6] : [z1 - 1.6, z1];
        for (let i = 0; i < n; i++) {
          const top = r.floor + 3.1 * k + rh * (i + 1);
          const ex = north ? -5.96 - i * 0.28 : -11.0 + i * 0.28;
          const [a, b] = north ? [ex - 0.05, ex] : [ex, ex + 0.05];
          p.box(SC.steelDark, [a, top - 0.03, lz[0] + 0.02], [b, top + 0.004, lz[1] - 0.02], { shadow: 'receive' });
        }
      }
    }, 0);
    for (const [x, y] of [
      [x0 + 0.3, r.floor + 3.1],
      [x1 - 0.3, r.floor + 6.2],
      [x0 + 0.3, r.floor + 9.3],
    ] as [number, number][])
      put(fw, roomMats, [x, y, z1 - 0.3], 0, 0.3, (p) => extinguisher(p, { stand: true, red: SC.red, hose: SC.rubber, metal: SC.steel }), 0);
  }
  // ---- 小部屋（住戸の 1 つ）: 寝台・机と椅子・棚・洗面台・短い長椅子・苔。窓の光と、寝台の読書灯・机の灯りの光だまり（ほかの隅は暗い） ----
  {
    const r = ROOMS[3];
    const [x0, z0, x1, z1] = r.rect;
    const y = r.floor;
    put(fw, roomMats, [x0 + 0.45, y, -30.6], Math.PI / 2, 1.0, (p) => concreteBench(p, 1.5), 0);
    put(fw, roomMats, [x0 + 1.25, y, z1 - 0.5], Math.PI / 2, 1.2, (p) => bed(p, 2.0, 0.9), 0);
    put(fw, roomMats, [x0 + 0.5, 0, z1], Math.PI, 0.3, (p) => wallLamp(p, y + 1.45), 0);
    pool([x0 + 0.8, y + 1.3, z1 - 0.5], [x0, y - 0.2, z1 - 1.5, x0 + 2.6, y + 1.9, z1], 1.5, 2.0);
    put(fw, roomMats, [-19.0, y, z0 + 0.3], 0, 0.7, (p) => smallDesk(p, 1.0, 0.55), 0);
    put(fw, roomMats, [-19.0, y, z0 + 0.95], Math.PI, 0.4, (p) => chair(p, { kind: 'stack', seat: SC.wood, frame: SC.steelDark }), 0);
    put(fw, roomMats, [-19.0, 0, z0], 0, 0.4, (p) => wallShelf(p, 1.1, y + 1.55), 0);
    pool([-18.7, y + 1.05, z0 + 0.35], [-19.9, y - 0.2, z0 + 0.02, -18.0, y + 1.5, z0 + 1.4], 1.7, 1.6);
    put(fw, roomMats, [x1, y, -32.1], -Math.PI / 2, 0.5, (p) => washBasin(p), 0);
    put(fw, roomMats, [x0 + 2.2, y, z0 + 0.55], 0, 0.4, (p) => mossCushion(p, 0.6), 0);
    put(fw, roomMats, [-19.4, 0, z1], Math.PI, 0.5, (p) => radiator(p, 0.9, 0.6, y + 0.15), 0);
    put(fw, roomMats, [-21.1, 0, z1], Math.PI, 0.3, (p) => pictureFrame(p, y + 1.75, 0.55, 0.4), 0);
    put(fw, roomMats, [x1, 0, -28.2], -Math.PI / 2, 0.5, (p) => coatRail(p, 0.9, y + 1.7), 0);
    put(fw, roomMats, [-18.15, y, -27.45], 0.1, 0.4, (p) => crate(p, 0.6, 0.4, 0.42), 0);
    put(fw, roomMats, [-18.2, y + 0.4, -27.5], -0.25, 0.4, (p) => crate(p, 0.5, 0.32, 0.36), 0);
    put(fw, roomMats, [x0 + 0.3, y, -32.45], Math.PI / 2, 0.8, (p) => wardrobe(p, 1.0, 1.9, 0.56), 0);
    roomLamp(-19.4, -29.0, r.ceil, [x0, y - 0.2, z0, x1, r.ceil, z1], 1.0, 2.6);
    put(fw, roomMats, [0, 0, 0], 0, 0, (p) => pipeRun(p, [[x1 - 0.14, y, z0 + 0.14], [x1 - 0.14, r.ceil, z0 + 0.14]], 0.05, SC.steel), 0);
    put(fw, roomMats, [(x0 + x1) / 2 - 0.5, y + 0.005, -30.4], 0, 0.4, (p) => drainGrate(p, 0.4, 0.4), 0);
    // 北の壁の縦長の窓と、西の壁の高窓（床・家具の四角い光だまり）
    roomWindow(r, 'n', x0 + 2.2, 0.6, 2.4, 0.4);
    roomWindow(r, 'w', (z0 + z1) / 2 + 1.5, 1.8, 0.5, 2.3);
  }
  // ---- 部屋の電線管（決まり: 窓の無い 2 面の天井ぎわ。継ぎ箱と、スイッチへ下りる管） ----
  for (const [id, sides] of [
    ['cell', ['e', 's']],
    ['office', ['e', 's']],
    ['pump', ['e', 'w']],
  ] as [string, ('n' | 's' | 'e' | 'w')[]][]) {
    const r = ROOMS.find((q) => q.id === id)!;
    const [x0, z0, x1, z1] = r.rect;
    const cy = r.ceil - 0.5;
    for (const sd of sides) {
      const along = sd === 'n' || sd === 's';
      const L = (along ? x1 - x0 : z1 - z0) - 0.6;
      const c: V3 = sd === 'n' ? [(x0 + x1) / 2, 0, z0] : sd === 's' ? [(x0 + x1) / 2, 0, z1] : sd === 'w' ? [x0, 0, (z0 + z1) / 2] : [x1, 0, (z0 + z1) / 2];
      const yaw = sd === 'n' ? 0 : sd === 's' ? Math.PI : sd === 'w' ? Math.PI / 2 : -Math.PI / 2;
      put(fw, roomMats, c, yaw, 0, (p) => conduitRun(p, L, cy, { boxEvery: 2.4, drops: [L / 2 - 0.5] }), 0);
    }
  }
  // ---- 屋上テラス: 手すり・長椅子・手すり壁ぞいの植え込みの箱（茂みと草）・室外機と換気の筒・灯りの柱 ----
  {
    const [tx0, tz0, tx1] = TERRACE.rect;
    const y = TERRACE.y;
    put(fw, outMats, [(tx0 + tx1) / 2, y + 1.1, tz0 + 0.1], 0, 0, (p) => pipeRailing(p, tx1 - tx0 - 0.4, 0.35), 0);
    put(fw, outMats, [-12, y, 18.6], Math.PI, 1.3, (p) => concreteBench(p, 2.4), 0);
    put(fw, outMats, [-6.6, y, 18.6], Math.PI, 1.3, (p) => concreteBench(p, 2.4), 0);
    for (const [x, L] of [
      [-14.2, 4.2],
      [-8.4, 4.8],
      [-2.6, 4.2],
    ] as [number, number][]) {
      put(fw, outMats, [x, y, tz0 + 0.62], 0, 1, (p) => {
        planterTrough(p, L, 0.65, 0.55);
        // 土から盛り上がる低木の塊と高い草の群れを交互に（箱の縁から少し垂れる）
        for (let k = 0; k < Math.round(L / 0.7); k++) {
          const q = p.sub([-L / 2 + 0.4 + k * 0.7 + (p.r() - 0.5) * 0.15, 0.39, (p.r() - 0.5) * 0.12], p.r() * 6);
          if (k % 2 === 0) shrubClump(q, 0.7 + p.r() * 0.3, 0.45 + p.r() * 0.25);
          else grassClump(q, 0.4, 0.45 + p.r() * 0.15);
        }
      }, 0);
    }
    for (const x of [-0.2, 1.1]) put(fw, outMats, [x, y, 18.9], Math.PI, 0.8, (p) => rooftopUnit(p, 1.0, 0.8, 0.45), 0);
    for (const [x, z, h] of [
      [-16.2, 18.8, 1.8],
      [-15.6, 19.0, 1.2],
      [0.2, 16.4, 1.5],
    ] as [number, number, number][]) put(fw, outMats, [x, y, z], 0, 0.4, (p) => ventStack(p, h), 0);
    put(fw, outMats, [-9.6, y, 17.0], 0, 0.4, (p) => {
      p.cyl(SC.steelDark, [0, 0.12, 0], 0.1, 0.24, { seg: 10 });
      p.rod(SC.steelDark, [0, 0.24, 0], [0, 3.0, 0], 0.045, { radial: 8 });
      p.box(SC.paint, [-0.16, 3.0, -0.16], [0.16, 3.12, 0.16], { r: 0.02 });
      p.box('#eef0dc', [-0.12, 2.95, -0.12], [0.12, 3.0, 0.12], { kind: 'glow', shadow: false });
    }, 0);
  }
}
