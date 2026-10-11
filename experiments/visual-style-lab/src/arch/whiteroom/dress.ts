import { Prop, type PropMats } from '../../props/kit.ts';
import { wrSink } from './props/mats.ts';
import { extinguisher } from '../../props/lib/index.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { WEST_OPENINGS } from './courtA.ts';
import { bx } from './geo.ts';
import { A, CW } from './layout.ts';
import type { Mats } from './mats.ts';
import { drain, downpipe, planter, roofDrain, roofHatch, slabBench, spout, ventPipe, wallLamp } from './props/court.ts';
import { noticeBoard } from './props/rooms.ts';
import type { Later } from './seen.ts';

/**
 * 写っていない屋外の作り込み（3 回目の直し。造りに従う部品と汚れ）。どれも決まりで並べ、参考画像の視点から見える物は
 * 「後で置く」列（seen.ts）が外す。
 * - テラス（回廊の屋上）: 2 階の壁ぎわに 6 m おきの排水口と、その上の竪樋（屋根の水 → 竪樋 → 排水口）、竪樋の集水器の下の
 *   壁の垂れ、通気管・点検口、扉の両脇の植木鉢
 * - 回廊（A の西・C の 3 つ）: 奥の壁ぎわの腰掛け・掲示板・消火器、柱の裏の腕木の灯り
 */
type V3 = [number, number, number];

export interface DressKit {
  b: Builder;
  m: Mats;
  pm: PropMats;
  later: Later;
}

const WET = '#a9b8ad';

/** 壁ぞいの位置（面の座標 face・面の外向き n・沿う向き）から場面の座標 */
interface Face {
  /** 面が x に沿う（n = ±z） */
  alongX: boolean;
  /** 面の座標（alongX なら z、でなければ x） */
  at: number;
  /** 面の外向き（テラスの側）の符号 */
  out: 1 | -1;
  /** 面の範囲（沿う向き） */
  lo: number;
  hi: number;
  /** 扉の中心（沿う向き）。扉の前は空ける */
  doors: number[];
  /** 面の下（テラスの上面）と上（屋根の縁）の高さ */
  y0: number;
  y1: number;
}

function faceYaw(f: Face): number {
  // 局所の +z を面の外向きへ
  if (f.alongX) return f.out > 0 ? 0 : Math.PI;
  return f.out > 0 ? Math.PI / 2 : -Math.PI / 2;
}
function facePos(f: Face, u: number, off: number, y: number): V3 {
  return f.alongX ? [u, y, f.at + f.out * off] : [f.at + f.out * off, y, u];
}

/** テラスの壁ぎわの決まり: 排水口・竪樋・通気管・植木鉢 */
function dressTerraceFace(k: DressKit, f: Face, seed: number): void {
  const sink = wrSink(k.b);
  const yaw = faceYaw(f);
  const stain = k.m.get('C', 'stain', { brush: false });
  const nearDoor = (u: number, r: number): boolean => f.doors.some((d) => Math.abs(d - u) < r);
  // 6 m おきの排水口と竪樋
  for (let u = f.lo + 2.5; u < f.hi - 1.0; u += 6.0) {
    if (nearDoor(u, 1.6)) continue;
    const pd = facePos(f, u, 0.45, f.y0);
    const lo: V3 = f.alongX ? [u - 0.6, f.y0, Math.min(f.at, f.at + f.out * 0.95)] : [Math.min(f.at, f.at + f.out * 0.95), f.y0, u - 0.6];
    const hi: V3 = f.alongX ? [u + 0.6, f.y1, Math.max(f.at, f.at + f.out * 0.95)] : [Math.max(f.at, f.at + f.out * 0.95), f.y1, u + 0.6];
    k.later.addBox(lo, hi, () => {
      roofDrain(Prop.at(sink, k.pm, pd, yaw, seed + u), WET);
      downpipe(Prop.at(sink, k.pm, facePos(f, u, 0, 0), yaw, seed + u), f.y0, f.y1 - 0.08);
      // 集水器からあふれた水の垂れ（壁の面の細い板 2 段）
      const s0 = facePos(f, u, 0.003, 0);
      const s1 = facePos(f, u, 0.006, 0);
      if (f.alongX) {
        bx(k.b, stain, u - 0.2, f.y1 - 1.3, Math.min(s0[2], s1[2]), u + 0.2, f.y1 - 0.3, Math.max(s0[2], s1[2]), { shadow: false });
        bx(k.b, stain, u - 0.1, f.y1 - 2.4, Math.min(s0[2], s1[2]), u + 0.12, f.y1 - 1.3, Math.max(s0[2], s1[2]), { shadow: false });
      } else {
        bx(k.b, stain, Math.min(s0[0], s1[0]), f.y1 - 1.3, u - 0.2, Math.max(s0[0], s1[0]), f.y1 - 0.3, u + 0.2, { shadow: false });
        bx(k.b, stain, Math.min(s0[0], s1[0]), f.y1 - 2.4, u - 0.1, Math.max(s0[0], s1[0]), f.y1 - 1.3, u + 0.12, { shadow: false });
      }
    });
  }
  // 通気管（9 m おき・壁から 1 m）と点検口（テラスの真ん中に 1 つ）
  for (let u = f.lo + 5.5; u < f.hi - 1.0; u += 9.0) {
    if (nearDoor(u, 1.2)) continue;
    const p = facePos(f, u, 1.0, f.y0);
    k.later.addBox([p[0] - 0.15, f.y0, p[2] - 0.15], [p[0] + 0.15, f.y0 + 0.9, p[2] + 0.15], () => ventPipe(Prop.at(sink, k.pm, p, 0, seed + u), 0.6 + ((u * 7) % 3) * 0.1));
  }
  {
    const u = (f.lo + f.hi) / 2 + 1.7;
    const p = facePos(f, u, 2.2, f.y0);
    if (!nearDoor(u, 1.5)) k.later.addBox([p[0] - 0.7, f.y0, p[2] - 0.7], [p[0] + 0.7, f.y0 + 0.5, p[2] + 0.7], () => roofHatch(Prop.at(sink, k.pm, p, yaw, seed + 5)));
  }
  // 扉の両脇の植木鉢
  for (const d of f.doors)
    for (const s of [-1, 1]) {
      const u = d + s * 1.25;
      if (u < f.lo + 0.5 || u > f.hi - 0.5) continue;
      const p = facePos(f, u, 0.5, f.y0);
      k.later.addBox([p[0] - 0.4, f.y0, p[2] - 0.4], [p[0] + 0.4, f.y0 + 0.9, p[2] + 0.4], () => planter(Prop.at(sink, k.pm, p, yaw, seed + Math.round(u * 3)), 0.7, { h: 0.5 }));
    }
}

/** 回廊の決まり: 奥の壁ぎわの腰掛け・掲示板・消火器（扉を避ける）、柱の裏の腕木の灯り */
function dressCloister(k: DressKit, back: Face, piers: { u: number; f: Face }[], seed: number): void {
  const sink = wrSink(k.b);
  const yaw = faceYaw(back);
  const free = (u: number, w: number): boolean => !back.doors.some((d) => Math.abs(d - u) < w / 2 + 0.9);
  let i = 0;
  for (let u = back.lo + 2.0; u < back.hi - 1.5; u += 4.2, i++) {
    if (!free(u, 2.0)) continue;
    const kind = i % 3;
    const p = facePos(back, u, 0, back.y0);
    const q = facePos(back, u, 0.5, back.y0 + 2.0);
    k.later.addBox([Math.min(p[0], q[0]) - 1.1, back.y0, Math.min(p[2], q[2]) - 1.1], [Math.max(p[0], q[0]) + 1.1, back.y0 + 2.0, Math.max(p[2], q[2]) + 1.1], () => {
      if (kind === 0) slabBench(Prop.at(sink, k.pm, facePos(back, u, 0.25, back.y0), yaw, seed + i), 2.0, { legs: 'slab', dark: '#3d4f49', top: '#566b63' });
      else if (kind === 1) noticeBoard(Prop.at(sink, k.pm, facePos(back, u, 0.005, back.y0), yaw, seed + i), 1.1, 0.75);
      else {
        slabBench(Prop.at(sink, k.pm, facePos(back, u - 0.4, 0.25, back.y0), yaw, seed + i), 1.4, { legs: 'post', dark: '#3d4f49', top: '#566b63' });
        extinguisher(Prop.at(sink, k.pm, facePos(back, u + 0.75, 0.15, back.y0), yaw, seed + i), { red: '#6b4f48', metal: '#9fb2a7' });
      }
    });
  }
  for (const { u, f } of piers) {
    const p = facePos(f, u, 0, f.y0 + 2.3);
    k.later.addBox([p[0] - 0.3, p[1] - 0.2, p[2] - 0.3], [p[0] + 0.3, p[1] + 0.2, p[2] + 0.3], () => wallLamp(Prop.at(sink, k.pm, p, faceYaw(f), seed + Math.round(u))));
  }
}

/** A の写っていない屋外: 西の回廊 */
export function dressA(k: DressKit): void {
  // A の西の回廊: 奥の壁（x = -7.8。外向き +x）と、開口の間の柱の裏（x = -5.9。外向き -x）
  const aBack: Face = { alongX: false, at: A.westPorchBack, out: 1, lo: A.zN + 1.4, hi: A.zS, doors: [4.4, 2.4, -3.0, -9.3, -20.6, -24.9], y0: 0, y1: A.soffit };
  const aPierFace: Face = { alongX: false, at: A.xW - 0.6, out: -1, lo: A.zN, hi: A.zS, doors: [], y0: 0, y1: A.soffit };
  const piersA: { u: number; f: Face }[] = [];
  let zPrev = A.zS;
  for (const [z0, z1] of WEST_OPENINGS) {
    if (zPrev - z0 > 1.0) piersA.push({ u: (zPrev + z0) / 2, f: aPierFace });
    zPrev = z1;
  }
  dressCloister(k, aBack, piersA, 61);
  // 門の通路（x -1.0〜1.2・z 8〜14・高さ 2.5）: 両側の壁の腕木の灯り・掲示板、真ん中の排水の溝
  const sink = wrSink(k.b);
  for (const [x, yaw] of [
    [-1.0, Math.PI / 2],
    [1.2, -Math.PI / 2],
  ] as const)
    for (const z of [9.3, 12.6]) {
      k.later.addBox([x - 0.3, 1.9, z - 0.2], [x + 0.3, 2.3, z + 0.2], () => wallLamp(Prop.at(sink, k.pm, [x, 2.1, z], yaw, Math.round(z * 3))));
    }
  k.later.addBox([-1.0, 1.0, 10.3], [-0.9, 1.9, 11.5], () => noticeBoard(Prop.at(sink, k.pm, [-1.0, 0, 10.9], Math.PI / 2, 5), 0.9, 0.6));
  for (const z of [8.9, 9.9, 12.2, 13.2]) k.later.addBox([-0.2, 0, z - 0.5], [0.4, 0.05, z + 0.5], () => drain(Prop.at(sink, k.pm, [0.1, 0, z], Math.PI / 2, 7), 0.9, 0.25));
}

/** C の写っていない屋外: テラスの壁ぎわ・回廊 */
export function dressC(k: DressKit): void {
  const H = CW.podH;
  // ---- C のテラス（2 階の壁ぎわ） ----
  // 南のテラス（2 階の棟の北の面 z = -9.2。外向き -z）
  dressTerraceFace(k, { alongX: true, at: CW.podN, out: -1, lo: CW.podW + 1.0, hi: CW.outE, doors: [-55.885, -47.475], y0: H, y1: CW.outH }, 11);
  // 北のテラス（南の面 z = -32.9。外向き +z）
  dressTerraceFace(k, { alongX: true, at: CW.podS, out: 1, lo: CW.podW + 1.0, hi: CW.wallIn, doors: [-48.21], y0: H, y1: CW.outH }, 23);
  // 西のテラス（東の面 x = -61。外向き +x）
  dressTerraceFace(k, { alongX: false, at: CW.podW, out: 1, lo: CW.zS - 4.6, hi: CW.zN + 4.2, doors: [-15.67, -26.58], y0: H, y1: CW.outH }, 37);

  // ---- 門の壁の外の面（前庭の側。x = -23.36・外向き +x）: 上の歩ける面の水の吐き口（約 4 m おき）と、その下の垂れ・足元の排水の格子 ----
  {
    const sink = wrSink(k.b);
    const stain = k.m.get('C', 'stain', { brush: false });
    const x = CW.wallOut;
    // 門の口・壁の灯り・前庭の階段（z < -25）を避けた 4 か所
    for (const z of [-23.6, -18.4, -13.8, -10.6]) {
      k.later.addBox([x, 0, z - 0.4], [x + 0.6, H, z + 0.4], () => {
        spout(Prop.at(sink, k.pm, [x, 0, z], Math.PI / 2, Math.round(z)), H - 0.2);
        bx(k.b, stain, x + 0.002, H - 1.6, z - 0.12, x + 0.005, H - 0.3, z + 0.12, { shadow: false });
        bx(k.b, stain, x + 0.002, 0.2, z - 0.07, x + 0.005, H - 1.6, z + 0.08, { shadow: false });
        drain(Prop.at(sink, k.pm, [x + 0.5, 0, z], 0, Math.round(z) + 1), 0.4, 0.4);
      });
    }
  }

  // ---- 回廊 ----
  // C の回廊（南・北・西）。奥の壁の扉は x = -52・-44・-36・-29
  const walkN = CW.zN + 0.4 + CW.walk;
  const walkS = CW.zS - 0.4 - CW.walk;
  const walkW = CW.x0 - 0.4 - CW.walk;
  const cDoors = [-52, -44, -36, -29];
  dressCloister(k, { alongX: true, at: walkN, out: -1, lo: CW.podW + 0.6, hi: CW.wallIn, doors: [...cDoors, -42.0], y0: 0, y1: H - 0.3 }, [], 71);
  dressCloister(k, { alongX: true, at: walkS, out: 1, lo: CW.podW + 0.6, hi: CW.wallIn, doors: [...cDoors, -38.3, -53.0], y0: 0, y1: H - 0.3 }, [], 73);
  dressCloister(k, { alongX: false, at: walkW, out: 1, lo: walkS, hi: walkN, doors: [], y0: 0, y1: H - 0.3 }, [], 79);
  // C の回廊の奥の壁の扉の枠（暗い鋼の枠。扉の板の上と両脇）
  const frame = k.pm.get('#3b4f4a');
  for (const x of cDoors)
    for (const [z, s] of [
      [walkN, -1],
      [walkS, 1],
    ] as const) {
      const zf = z + s * 0.03;
      k.later.addBox([x - 0.6, 0, Math.min(z, zf)], [x + 0.6, 2.2, Math.max(z, zf)], () => {
        bx(k.b, frame, x - 0.56, 0, Math.min(z, zf), x - 0.5, 2.16, Math.max(z, zf), {});
        bx(k.b, frame, x + 0.5, 0, Math.min(z, zf), x + 0.56, 2.16, Math.max(z, zf), {});
        bx(k.b, frame, x - 0.56, 2.1, Math.min(z, zf), x + 0.56, 2.16, Math.max(z, zf), {});
      });
    }
}
