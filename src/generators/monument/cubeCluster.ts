/**
 * モニュメントの文法: cubeCluster（立方体の群）。
 * 基壇の中央に立てた「逆円錐の支点」の上に大きな立方体を 1 個載せ、その面に接する / わずかに浮く位置へ
 * 次の立方体を再帰的に積む（幹 3〜6 段 + 枝）。半数は 10〜35° 回り、口の字の枢が隙間に刺さり、
 * 浮いた立方体は細い棒 1 本で隣とつながる。「点で支えているのに崩れない」不可解さを狙う。
 *
 * 高さは幹の段数と各段の寸法を o.height に合わせて正規化して決める（屋内 2.3〜5 m / 屋外 6〜15 m のどちらでも同じ規則）。
 * 横は o.radius を超えないよう、置くたびに中心を内側へ寄せる。歪み o.distort は回転角・浮きの隙間・ばらつきに効く。
 * 刻印は無し。基壇の正面に小さな板と 4 桁の年号だけを置く。
 */
import type { Rng } from '../../core/rng';
import type { Vec3 } from '../../core/types';
import type { Box, MatId } from '../layout';
import type { MonumentBuild, MonumentOptions, MonumentPart, MonumentSign } from './types';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function aabb(min: Vec3, max: Vec3, mat: MatId): Box {
  return {
    min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])],
    max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])],
    mat,
    solid: true,
  };
}

interface Cube { x: number; y: number; z: number; s: number; rot: boolean; parent: number }

/**
 * 水平の半寸（index.ts の partBounds と同じ近似: 回転があれば最大辺で丸める）。
 * 足跡の判定はこの近似で行われるので、こちらも同じ規則で内側へ寄せる。
 */
function halfXZ(p: MonumentPart): [number, number] {
  const [a, b, c] = p.size;
  let hx = 0.1, hy = 0.1, hz = 0.1;
  switch (p.prim) {
    case 'box': case 'plate': hx = a / 2; hy = b / 2; hz = (c || 0.03) / 2; break;
    case 'cylinder': hx = hz = Math.max(a, c ?? 0); hy = b / 2; break;
    case 'sphere': hx = hy = hz = a; break;
    case 'ring': hx = hy = a + b; hz = b; break;
    case 'stairs': case 'frame': hx = a / 2; hy = b / 2; hz = c / 2; break;
    default: break;
  }
  if (p.rot && (Math.abs(p.rot[0]) > 0.01 || Math.abs(p.rot[2]) > 0.01)) { const m = Math.max(hx, hy, hz); return [m, m]; }
  if (p.rot && Math.abs(p.rot[1]) > 0.01) { const m = Math.max(hx, hz); return [m, m]; }
  return [hx, hz];
}

/** 足跡の最終調整: はみ出す部品を内側へ寄せる */
function fitFootprint(parts: MonumentPart[], rmax: number): void {
  for (const p of parts) {
    const [hx, hz] = halfXZ(p);
    p.pos[0] = hx >= rmax ? 0 : clamp(p.pos[0], -(rmax - hx), rmax - hx);
    p.pos[2] = hz >= rmax ? 0 : clamp(p.pos[2], -(rmax - hz), rmax - hz);
  }
}

/** 円柱を 2 点間に渡すための [pitch, yaw, roll]（描画側の Euler は 'YXZ' = Ry·Rx·Rz。Y 軸の棒を dir へ向ける） */
function aimRot(dx: number, dy: number, dz: number, len: number): Vec3 {
  const uy = clamp(dy / (len || 1), -1, 1);
  return [Math.acos(uy), Math.atan2(dx, dz), 0];
}

export function buildCubeCluster(rng: Rng, o: MonumentOptions): MonumentBuild {
  const parts: MonumentPart[] = [];
  const colliders: Box[] = [];
  const signs: MonumentSign[] = [];

  const H = Math.max(1.8, o.height);
  const R = Math.max(0.6, o.radius);
  const RMAX = R * 1.1;
  const d = clamp(o.distort, 0, 1);
  const os = o.outdoor ? rng.float(1.6, 2.4) : 1;          // 屋外は寸法を 1.6〜2.4 倍

  // ---- 寸法の基準（立方体 1 個分）。基壇と支点もこれに比例させる（基壇だけ大きいと「机の上の模型」に見える） ----
  const unit = clamp(H * 0.20, 0.45, Math.min(2.2 * os, RMAX * 0.82));

  // ---- 基壇 ----
  const baseW = clamp(unit * rng.float(1.8, 2.6), 1.0, Math.min(3.2 * os, 2 * RMAX * 0.92));
  const baseD = clamp(baseW * rng.float(0.85, 1.0), 0.9, 2 * RMAX * 0.92);
  const baseH = clamp(rng.float(0.3, 0.5) * Math.min(os, 1.4), 0.28, 0.7);
  parts.push({ prim: 'box', mat: 'marbleFloor', pos: [0, baseH / 2, 0], size: [baseW, baseH, baseD] });
  colliders.push(aabb([-baseW / 2, 0, -baseD / 2], [baseW / 2, baseH, baseD / 2], 'marbleFloor'));

  // ---- 支点（逆円錐: rot pitch π で上下を返し、下を尖らせる） ----
  const pivR = clamp(unit * 0.32, 0.16, Math.min(0.9, baseW * 0.3));
  const pivH = clamp(unit * 0.45, 0.22, Math.max(0.25, H * 0.14));
  parts.push({ prim: 'cylinder', mat: 'metal', pos: [0, baseH + pivH / 2, 0], size: [pivR, pivH, 0.02], rot: [Math.PI, 0, 0] });
  const pivotTop = baseH + pivH;

  // ---- 幹（支点の上から積む。段数と寸法は H に合わせて正規化） ----
  const avail = Math.max(0.6, H * rng.float(0.94, 1.0) - pivotTop);
  const nSpine = clamp(Math.round(avail / (unit * 0.95)), 3, 6);
  const ratios: number[] = [];
  let r = 1;
  for (let i = 0; i < nSpine; i++) { ratios.push(r); r = Math.max(0.5, r * rng.float(0.74, 0.97)); }
  const gaps: number[] = [0];
  for (let i = 1; i < nSpine; i++) gaps.push(rng.chance(0.5) ? 0 : rng.float(0.1, 0.4) * (0.35 + 0.65 * d) * Math.min(os, 1.6));
  const gapSum = Math.min(gaps.reduce((a, b) => a + b, 0), avail * 0.3);
  const k = (avail - gapSum) / ratios.reduce((a, b) => a + b, 0);

  const mats: MatId[] = ['columnConcrete', 'wallWhite', 'marbleWhite', 'columnConcrete'];
  const mirror: MatId = o.outdoor ? 'stainless' : 'metal';
  const cubes: Cube[] = [];
  let y = pivotTop;
  let px = 0, pz = 0;
  for (let i = 0; i < nSpine; i++) {
    const s = clamp(k * ratios[i], 0.3, Math.min(2.2 * os, RMAX * 1.5));
    y += gaps[i];
    // 面の上で少しずらす（歪み。ずらしすぎると足跡を越えるので前段の半寸までに抑える）
    const prev = cubes.length ? cubes[cubes.length - 1] : null;
    const slide = prev ? (prev.s / 2) * (0.25 + 0.55 * d) : 0;
    px = clamp(px + rng.float(-1, 1) * slide, -(RMAX - s * 0.72), RMAX - s * 0.72);
    pz = clamp(pz + rng.float(-1, 1) * slide, -(RMAX - s * 0.72), RMAX - s * 0.72);
    const spin = rng.chance(0.5);
    const top = i === nSpine - 1;
    const rot: Vec3 = spin
      ? [top ? 0 : rng.float(10, 35) * (Math.PI / 180) * (rng.chance(0.5) ? 1 : -1) * d, rng.float(10, 35) * (Math.PI / 180) * (rng.chance(0.5) ? 1 : -1), 0]
      : [0, 0, 0];
    parts.push({ prim: 'box', mat: i === 0 ? mirror : mats[rng.int(0, mats.length - 1)], pos: [px, y + s / 2, pz], size: [s, s, s], rot });
    cubes.push({ x: px, y: y + s / 2, z: pz, s, rot: spin, parent: i - 1 });
    y += s;
  }

  // ---- 枝（幹の側面に接する / わずかに浮く立方体） ----
  const nTotal = rng.int(6, 14);
  let guard = 0;
  while (cubes.length < nTotal && guard++ < 60) {
    const pi = rng.int(0, Math.min(cubes.length, nSpine) - 1);
    const parent = cubes[pi];
    const s = clamp(parent.s * rng.float(0.45, 0.85), 0.25, Math.min(2.2 * os, RMAX));
    const gap = rng.chance(0.55) ? 0 : rng.float(0.1, 0.4) * (0.35 + 0.65 * d) * Math.min(os, 1.6);
    const dirIdx = rng.int(0, 3);
    const dx = dirIdx === 0 ? 1 : dirIdx === 1 ? -1 : 0;
    const dz = dirIdx === 2 ? 1 : dirIdx === 3 ? -1 : 0;
    const off = parent.s / 2 + s / 2 + gap;
    const half = s * 0.72;                                  // 回転しても収まる半寸
    const cx = parent.x + dx * off;
    const cz = parent.z + dz * off;
    if (Math.abs(cx) + half > RMAX || Math.abs(cz) + half > RMAX) continue;
    const cy = parent.y + rng.float(-0.35, 0.35) * parent.s * (0.3 + 0.7 * d);
    if (cy - s / 2 < baseH + 0.05 || cy + s * 0.72 > H * 0.99) continue;
    const spin = rng.chance(0.5);
    const rot: Vec3 = spin
      ? [rng.float(10, 35) * (Math.PI / 180) * (rng.chance(0.5) ? 1 : -1) * d, rng.float(10, 35) * (Math.PI / 180) * (rng.chance(0.5) ? 1 : -1), 0]
      : [0, 0, 0];
    parts.push({ prim: 'box', mat: cubes.length === 1 || rng.chance(0.18) ? mirror : mats[rng.int(0, mats.length - 1)], pos: [cx, cy, cz], size: [s, s, s], rot });
    cubes.push({ x: cx, y: cy, z: cz, s, rot: spin, parent: pi });
  }

  // ---- 口の字の枢（立方体の隙間に刺す。一部は貫通する） ----
  const nFrame = rng.int(2, 4);
  const FYAWS = [0, Math.PI / 2, Math.PI / 6, -Math.PI / 3];
  for (let i = 0; i < nFrame; i++) {
    const anchor = cubes[rng.int(0, cubes.length - 1)];
    const fw = clamp(unit * rng.float(0.9, 1.7), 0.35, Math.min(3.2 * os, 2 * RMAX * 0.8));
    const fh = clamp(fw * rng.float(0.8, 1.5), 0.35, H * 0.45);
    const bar = clamp(Math.min(fw, fh) * 0.11, 0.06, 0.3);
    const yaw = FYAWS[rng.int(0, 3)] + rng.float(-0.25, 0.25) * d;
    const ex = Math.abs(Math.cos(yaw)) * fw / 2 + Math.abs(Math.sin(yaw)) * bar / 2;
    const ez = Math.abs(Math.sin(yaw)) * fw / 2 + Math.abs(Math.cos(yaw)) * bar / 2;
    const fx = clamp(anchor.x + rng.float(-0.5, 0.5) * anchor.s, -(RMAX - ex), RMAX - ex);
    const fz = clamp(anchor.z + rng.float(-0.5, 0.5) * anchor.s, -(RMAX - ez), RMAX - ez);
    const fy = clamp(anchor.y + rng.float(-0.4, 0.4) * anchor.s, fh / 2 + 0.15, H * 0.97 - fh / 2);
    // 暗い部屋で枢が「黒い棒」に潰れないよう、明るい材を主にする
    parts.push({ prim: 'frame', mat: rng.chance(0.6) ? 'columnConcrete' : (rng.chance(0.5) ? 'wallWhite' : mirror), pos: [fx, fy, fz], size: [fw, fh, bar], rot: [0, yaw, 0] });
  }

  // ---- 細い棒（浮いた立方体と、それを生んだ隣の立方体を結ぶ） ----
  const pairs: Array<[Cube, Cube]> = [];
  for (const c of cubes) if (c.parent >= 0) pairs.push([c, cubes[c.parent]]);
  rng.shuffle(pairs);
  const nRod = Math.min(rng.int(4, 8), pairs.length);
  for (let i = 0; i < nRod; i++) {
    const [a, b] = pairs[i];
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.2) continue;
    const rad = rng.float(0.015, 0.03) * Math.min(os, 1.8);
    parts.push({
      prim: 'cylinder', mat: 'metalDark',
      pos: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2],
      size: [rad, len, rad], rot: aimRot(dx, dy, dz, len),
    });
  }

  // ---- 基壇正面の板と年号 ----
  const plateW = clamp(0.4 * Math.min(os, 1.6), 0.3, baseW * 0.5);
  const plateH = plateW * 0.375;
  const plateY = clamp(baseH * 0.55, plateH / 2 + 0.03, baseH - plateH / 2 - 0.02);
  parts.push({ prim: 'plate', mat: 'signPlate', pos: [0, plateY, -baseD / 2 - 0.02], size: [plateW, plateH, 0.04] });
  signs.push({ text: String(rng.int(1958, 1979)), pos: [0, plateY, -baseD / 2 - 0.05], face: 0, width: plateW, color: 0x3a3630, background: 0xdedad2 });

  // ---- 細部（部品数を 20 以上にする小さな立方体。面から少し飛び出す欠片） ----
  guard = 0;
  while (parts.length < 22 && guard++ < 40) {
    const anchor = cubes[rng.int(0, cubes.length - 1)];
    const s = clamp(anchor.s * rng.float(0.16, 0.3), 0.08, 0.5);
    const dirIdx = rng.int(0, 3);
    const dx = dirIdx === 0 ? 1 : dirIdx === 1 ? -1 : 0;
    const dz = dirIdx === 2 ? 1 : dirIdx === 3 ? -1 : 0;
    const cx = clamp(anchor.x + dx * (anchor.s / 2 + s / 2), -(RMAX - s), RMAX - s);
    const cz = clamp(anchor.z + dz * (anchor.s / 2 + s / 2), -(RMAX - s), RMAX - s);
    const cy = clamp(anchor.y + rng.float(-0.4, 0.4) * anchor.s, baseH + s, H * 0.98 - s);
    parts.push({ prim: 'box', mat: rng.chance(0.3) ? mirror : mats[rng.int(0, mats.length - 1)], pos: [cx, cy, cz], size: [s, s, s], rot: [0, rng.float(-0.6, 0.6), 0] });
  }

  // ---- 当たり判定: 基壇 + 床から 2.2 m 以下に掛かる立方体（予算のため大きい方から 6 個まで） ----
  const low = cubes.filter((c) => c.y - (c.rot ? c.s * 0.72 : c.s / 2) < 2.2).sort((a, b) => b.s - a.s).slice(0, 6);
  for (const c of low) {
    const half = c.rot ? c.s * 0.72 : c.s / 2;
    colliders.push(aabb([c.x - half, Math.max(0, c.y - half), c.z - half], [c.x + half, c.y + half, c.z + half], 'columnConcrete'));
  }

  fitFootprint(parts, RMAX);
  return { parts, colliders, signs };
}
