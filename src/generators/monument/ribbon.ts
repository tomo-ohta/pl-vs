/**
 * モニュメントの文法: ribbon（帯）
 * 白大理石（屋外は鏡面）のねじれた帯が基壇から立ち上がり、S 字や閉じない輪を描いて空中で終わる。
 * 帯の表面には「穴の縁」に見える細いトーラスが並び、穴や上面に鏡面の球が嵌る（1 個だけ帯から離れて浮く）。
 *
 * 座標はモニュメント・ローカル（基壇中心 = 原点、y 上、正面 = −Z）。
 * 帯（ribbon 部品）は pos = 原点のまま path に絶対座標を入れる。
 * 穴・球の姿勢は描画側と同じ枠（CatmullRomCurve3 + computeFrenetFrames）で求めるので、
 * ExtrudeGeometry が作る実際の帯面とずれない（shape.x → normal, shape.y → binormal = 帯の面法線）。
 */
import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import type { Vec3 } from '../../core/types';
import { box, type Box, type MatId } from '../layout';
import type { MonumentBuild, MonumentOptions, MonumentPart, MonumentSign } from './types';

/** 描画側 ExtrudeGeometry の steps と同じ（枠の添字を合わせる） */
const RIBBON_STEPS = 64;
/** 三角形の目安（1 基 8,000 以下に収めるための見積り） */
const TRI_BUDGET = 8000;

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** 部品 1 個あたりの三角形の見積り */
function triOf(p: MonumentPart): number {
  switch (p.prim) {
    case 'ribbon': return 520;
    case 'tube': return 1200;
    case 'sphere': return 720;
    case 'ring': return 1150;
    case 'cylinder': return 100;
    default: return 12;
  }
}

/** 部品の水平方向の外接（index.ts の partBounds と同じ近似。足跡を詰めるために使う） */
function spanXZ(p: MonumentPart): { cx: number; cz: number; hx: number; hz: number } {
  const [a, b, c] = p.size;
  let hx = 0.1, hz = 0.1, hy = 0.1;
  switch (p.prim) {
    case 'box': case 'plate': hx = a / 2; hy = b / 2; hz = (c || 0.03) / 2; break;
    case 'sphere': hx = hy = hz = a; break;
    case 'ring': hx = hy = a + b; hz = b; break;
    case 'ribbon': case 'tube': {
      const pts = p.path ?? [];
      if (!pts.length) break;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
      const pad = Math.max(a, b || 0) / 2;
      return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2 + pad, hz: (z1 - z0) / 2 + pad };
    }
    default: hx = a / 2; hy = b / 2; hz = (c || a) / 2; break;
  }
  if (p.rot && (Math.abs(p.rot[0]) > 0.01 || Math.abs(p.rot[2]) > 0.01)) { const m = Math.max(hx, hy, hz); hx = hz = m; }
  else if (p.rot && Math.abs(p.rot[1]) > 0.01) { const m = Math.max(hx, hz); hx = hz = m; }
  return { cx: p.pos[0], cz: p.pos[2], hx, hz };
}

/** 足跡（±limit）からはみ出す部品を中心側へ寄せる（帯は path ごと動かす） */
function fitFootprint(parts: MonumentPart[], limit: number): void {
  const push = (c: number, h: number): number => {
    const over = Math.abs(c) + h - limit;
    return over > 0 && c !== 0 ? -Math.sign(c) * Math.min(over, Math.abs(c)) : 0;
  };
  for (const p of parts) {
    const s = spanXZ(p);
    const dx = push(s.cx, s.hx), dz = push(s.cz, s.hz);
    if (!dx && !dz) continue;
    if ((p.prim === 'ribbon' || p.prim === 'tube') && p.path) for (const q of p.path) { q[0] += dx; q[2] += dz; }
    else { p.pos[0] += dx; p.pos[2] += dz; }
  }
}

/** 近い当たり判定どうしを束ねて数を減らす（union の体積が元の 1.5 倍までなら束ねる） */
function mergeBoxes(list: Box[], keep = 8): Box[] {
  const vol = (b: Box): number => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
  const out = list.slice();
  for (let pass = 0; pass < 6 && out.length > keep; pass++) {
    let merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const u = box(
          [Math.min(out[i].min[0], out[j].min[0]), Math.min(out[i].min[1], out[j].min[1]), Math.min(out[i].min[2], out[j].min[2])],
          [Math.max(out[i].max[0], out[j].max[0]), Math.max(out[i].max[1], out[j].max[1]), Math.max(out[i].max[2], out[j].max[2])],
          out[i].mat,
        );
        if (vol(u) <= (vol(out[i]) + vol(out[j])) * 1.5) {
          out.splice(j, 1); out[i] = u; merged = true; break;
        }
      }
    }
    if (!merged) break;
  }
  return out;
}

interface Band {
  part: MonumentPart;
  curve: THREE.CatmullRomCurve3;
  pts: THREE.Vector3[];
  /** 帯の幅方向（shape.x = frenet normal） */
  nrm: THREE.Vector3[];
  /** 帯の面法線（shape.y = frenet binormal） */
  bin: THREE.Vector3[];
  width: number;
  thickness: number;
  path: Vec3[];
}

/** 基底ベクトル（X = x, Z = z）から YXZ オイラーを作る（描画側の Euler 順と同じ） */
function eulerFromBasis(x: THREE.Vector3, z: THREE.Vector3): Vec3 {
  const ax = x.clone().normalize();
  const az = z.clone().normalize();
  const ay = new THREE.Vector3().crossVectors(az, ax).normalize();
  const m = new THREE.Matrix4().makeBasis(ax, ay, az);
  const e = new THREE.Euler().setFromRotationMatrix(m, 'YXZ');
  return [e.x, e.y, e.z];
}

/**
 * 帯の制御点。基壇から立ち上がり → apexY 付近で 1〜2 回向きを変え（S 字 / 閉じない輪）→
 * 末端は頂点より下、しかし空中で終わる（地面には戻らない）。
 */
function bandPath(rng: Rng, start: Vec3, apexY: number, rmax: number, distort: number, footprint: number): Vec3[] {
  const n = rng.int(5, 8);
  const apexAt = n - 2;
  // 向きを変える回数（1〜2）。S 字か、自分に戻らない輪になる
  const turns = rng.int(1, 2);
  const turnAt = new Set<number>();
  for (let k = 0; k < turns; k++) turnAt.add(rng.int(2, Math.max(2, n - 2)));
  let ang = rng.float(0, Math.PI * 2);
  let dir = rng.chance(0.5) ? 1 : -1;
  const step = rng.float(1.1, 1.9); // 1 区間あたりの旋回角（rad）
  const endDrop = rng.float(0.55, 0.82); // 末端の高さ（頂点比）
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    if (turnAt.has(i)) dir = -dir;
    if (i > 0) ang += dir * step * rng.float(0.8, 1.2);
    const rise = apexY - start[1];
    const y = i <= apexAt
      ? start[1] + rise * Math.sin((Math.PI / 2) * (i / apexAt))
      : apexY - rise * (1 - endDrop) * ((i - apexAt) / (n - 1 - apexAt));
    // 水平の振れ: 立ち上がりは細く、中腹で大きく振る
    const r = i === 0 ? 0 : rmax * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)));
    const jx = rng.float(-1, 1) * distort * rmax * 0.22;
    const jz = rng.float(-1, 1) * distort * rmax * 0.22;
    const jy = i === 0 ? 0 : rng.float(-1, 1) * distort * rise * 0.06;
    let px = start[0] + Math.cos(ang) * r + jx;
    let pz = start[2] + Math.sin(ang) * r + jz;
    // 足跡からはみ出さないよう半径を詰める
    const rad = Math.hypot(px, pz);
    if (rad > footprint) { px *= footprint / rad; pz *= footprint / rad; }
    out.push([px, Math.max(start[1], Math.min(apexY, y + jy)), pz]);
  }
  return out;
}

/** 制御点から帯の部品と、穴・球を置くための枠を作る */
function makeBand(path: Vec3[], width: number, thickness: number, mat: MatId): Band {
  const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.5);
  const frames = curve.computeFrenetFrames(RIBBON_STEPS, false);
  const pts = curve.getSpacedPoints(RIBBON_STEPS);
  const part: MonumentPart = { prim: 'ribbon', mat, pos: [0, 0, 0], size: [width, thickness, 0], path };
  return { part, curve, pts, nrm: frames.normals, bin: frames.binormals, width, thickness, path };
}

export function buildRibbon(rng: Rng, o: MonumentOptions): MonumentBuild {
  const H = Math.max(1.6, o.height);
  const R = Math.max(0.8, o.radius);
  const d = clamp(o.distort, 0, 1);
  const parts: MonumentPart[] = [];
  const colliders: Box[] = [];
  let tri = 0;
  const add = (p: MonumentPart): void => { parts.push(p); tri += triOf(p); };

  // ── 基壇（低い板 + 一段広い沓ずり）
  const baseW = clamp(rng.float(1.2, 2.0), 0.9, R * 1.4);
  const baseD = baseW * rng.float(0.8, 1.1);
  const baseH = 0.15;
  add({ prim: 'box', mat: 'marbleFloor', pos: [0, baseH / 2, 0], size: [baseW, baseH, baseD] });
  add({ prim: 'box', mat: 'marbleFloor', pos: [0, 0.03, 0], size: [baseW * 1.22, 0.06, baseD * 1.22] });
  colliders.push(box([-baseW * 0.61, 0, -baseD * 0.61], [baseW * 0.61, baseH, baseD * 0.61], 'marbleFloor'));
  // 屋外は基壇の周りに薄い水盤（ガラス板）
  if (o.outdoor) {
    const pw = clamp(rng.float(3, 5), baseW * 1.6, R * 2.2);
    add({ prim: 'box', mat: 'glass', pos: [0, 0.01, 0], size: [pw, 0.02, pw * rng.float(0.8, 1.0)] });
  }

  // ── 帯（1〜3 本。1 本目が主。2 本目以降は分岐か平行）
  // 注意: 描画側は材質ごとに mergeGeometries でまとめるが、ribbon（ExtrudeGeometry）は非インデックス、
  // 他のプリミティブはインデックス付きなので、同じ材質に混ぜるとその材質の部品が丸ごと消える。
  // → 帯の材質は帯だけで使い、小片・穴・球には別の材質を割り当てる。
  const bandMat: MatId = o.outdoor && rng.chance(0.5) ? 'stainless' : 'marbleWhite';
  const trimMat: MatId = bandMat === 'stainless' ? 'metal' : 'stainless'; // 穴の縁・球（鏡面）
  const propMat: MatId = 'marbleFloor'; // 根元の小片（基壇と同じ石）
  // 幅は高さ比だが、足跡（partBounds は path の外接 + 幅/2）に収まるよう頭を押さえる
  const w0 = clamp(H * rng.float(0.12, 0.2), 0.12, R * 0.45);
  const t0 = w0 * rng.float(0.25, 0.4);
  // 帯の制御点を収める半径。穴（ring）・球のぶんも余白を取る
  const foot = Math.min(R * 0.85, Math.max(R * 0.3, R * 1.12 - w0 / 2 - 0.3));
  const apex0 = H - w0 / 2;
  const path0 = bandPath(rng, [rng.float(-0.1, 0.1) * baseW, baseH, rng.float(-0.1, 0.1) * baseD], apex0, R * 0.6, d, foot);
  const bands: Band[] = [makeBand(path0, w0, t0, bandMat)];
  add(bands[0].part);

  const bandCount = rng.int(2, 3);
  for (let i = 1; i < bandCount; i++) {
    // 歪みに比例して 1 本目と幅を変える
    const wi = w0 * (1 - rng.float(0.1, 0.45) * (0.4 + 0.6 * d));
    const ti = wi * rng.float(0.25, 0.4);
    let start: Vec3;
    if (rng.chance(0.55)) {
      // 1 本目の途中から分かれる
      const u = rng.float(0.2, 0.55);
      const q = bands[0].curve.getPointAt(u);
      start = [q.x, q.y, q.z];
    } else {
      // 離れて平行に走る（基壇の脇から立ち上がる）
      const a = rng.float(0, Math.PI * 2);
      const rr = R * rng.float(0.3, 0.55);
      start = [Math.cos(a) * rr, baseH, Math.sin(a) * rr];
    }
    const apexI = clamp(apex0 * rng.float(0.55, 0.9), Math.min(apex0, start[1] + H * 0.15), apex0);
    const pi = bandPath(rng, start, apexI, R * rng.float(0.4, 0.6), d, foot);
    const b = makeBand(pi, wi, ti, bandMat);
    if (tri + triOf(b.part) > TRI_BUDGET * 0.55) break;
    bands.push(b);
    add(b.part);
  }

  // ── 立ち上がりを支える小片（帯の根元を基壇に食い込ませる体）
  const props = rng.int(4, 7);
  for (let i = 0; i < props; i++) {
    const p0 = bands[0].pts[Math.min(bands[0].pts.length - 1, 1 + i)];
    const s = clamp(w0 * rng.float(0.3, 0.55), 0.1, 0.45);
    add({
      prim: 'box', mat: propMat,
      pos: [p0.x + rng.float(-1, 1) * 0.1, clamp(p0.y * rng.float(0.3, 0.7), baseH, H), p0.z + rng.float(-1, 1) * 0.1],
      rot: [rng.float(-0.4, 0.4) * d, rng.float(0, Math.PI), rng.float(-0.4, 0.4) * d],
      size: [s, s * rng.float(0.6, 1.4), s],
    });
  }

  // ── 穴の縁（ring）: 帯の面に沿って置く。面法線 = binormal、幅方向 = normal
  const holeCount = rng.int(4, 8);
  const holes: { pos: Vec3; rot: Vec3; n: THREE.Vector3; b: THREE.Vector3; r: number; band: Band }[] = [];
  for (let i = 0; i < holeCount; i++) {
    const band = bands[rng.int(0, bands.length - 1)];
    const k = Math.round(clamp(rng.float(0.15, 0.95), 0, 1) * RIBBON_STEPS);
    const outer = clamp(band.width * rng.float(0.22, 0.36), 0.08, 0.3);
    const tube = clamp(outer * 0.16, 0.02, 0.045);
    const off = rng.float(-1, 1) * Math.max(0, band.width / 2 - outer - tube - 0.02);
    const p = band.pts[k], nv = band.nrm[k], bv = band.bin[k];
    const pos: Vec3 = [p.x + nv.x * off, p.y + nv.y * off, p.z + nv.z * off];
    const rot = eulerFromBasis(nv, bv);
    const part: MonumentPart = { prim: 'ring', mat: trimMat, pos, rot, size: [outer, tube, 0] };
    if (tri + triOf(part) > TRI_BUDGET * 0.8) break;
    add(part);
    holes.push({ pos, rot, n: nv, b: bv, r: outer, band });
  }

  // ── 球（鏡面）: 穴に嵌る / 帯の上面に乗る + 1 個は離れて浮く
  const ballCount = rng.int(3, 5);
  for (let i = 0; i < ballCount; i++) {
    const last = i === ballCount - 1;
    let pos: Vec3;
    let r: number;
    if (!last && holes.length && rng.chance(0.65)) {
      // 穴に嵌る（面法線方向に半径ぶん）
      const h = holes[rng.int(0, holes.length - 1)];
      r = clamp(h.r * rng.float(0.85, 1.3), 0.12, 0.4);
      const s = r * rng.float(0.2, 0.6);
      pos = [h.pos[0] + h.b.x * s, h.pos[1] + h.b.y * s, h.pos[2] + h.b.z * s];
    } else {
      const band = bands[rng.int(0, bands.length - 1)];
      const k = Math.round(rng.float(0.2, 0.9) * RIBBON_STEPS);
      const p = band.pts[k], bv = band.bin[k], nv = band.nrm[k];
      r = clamp(rng.float(0.15, 0.4), 0.12, band.width * 0.55);
      // 最後の 1 個は帯から離れて浮く
      const away = last ? r + band.width * rng.float(0.8, 1.6) : r + band.thickness / 2;
      const side = last ? rng.float(-1, 1) * band.width * 0.8 : 0;
      pos = [p.x + bv.x * away + nv.x * side, p.y + bv.y * away + nv.y * side, p.z + bv.z * away + nv.z * side];
    }
    // 足跡と高さの外に出ないよう詰める
    const rad = Math.hypot(pos[0], pos[2]);
    if (rad > foot) { pos[0] *= foot / rad; pos[2] *= foot / rad; }
    pos[1] = clamp(pos[1], baseH + r, H - r);
    const part: MonumentPart = { prim: 'sphere', mat: trimMat, pos, size: [r, 0, 0] };
    if (tri + triOf(part) > TRI_BUDGET) break;
    add(part);
  }

  // 足跡からはみ出した小物（穴・球・小片）を内側へ寄せる
  fitFootprint(parts, R * 1.18);

  // ── 当たり判定: 基壇 + 床から 2.2 m 以下に掛かる帯の制御点まわり
  for (const b of bands) {
    for (const p of b.path) {
      if (p[1] > 2.2) continue;
      const h = clamp(b.width * 0.7, 0.4, 0.8);
      colliders.push(box([p[0] - h / 2, Math.max(0, p[1] - h / 2), p[2] - h / 2], [p[0] + h / 2, p[1] + h / 2, p[2] + h / 2], 'marbleWhite'));
    }
  }

  // ── 刻印（基壇の正面）
  const TEXTS: readonly string[] = ['A SOFTER GEOMETRY', 'WE FOLD', 'CONTINUOUS SURFACE', 'NO EDGES HERE', 'ONE FOLD ONLY'];
  const signs: MonumentSign[] = [{
    text: TEXTS[rng.int(0, TEXTS.length - 1)],
    pos: [0, baseH * 0.55, -(baseD / 2 + 0.02)],
    face: 0,
    width: 0.5,
  }];

  return { parts, colliders: mergeBoxes(colliders), signs };
}
