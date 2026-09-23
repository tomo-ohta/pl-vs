/**
 * モニュメントの文法: colorStack（色の積層）
 * テラゾー（floorTile）の円い基壇の上に、円柱・箱・円盤・球を原色で積み上げた塔。
 * 側面には赤いジグザグの小片が斜めに這い、塔の周りを 1〜1.5 周する帯が巻き付き、頂部に球が乗る。
 *
 * 座標はモニュメント・ローカル（基壇中心 = 原点、y 上、正面 = −Z）。
 * 段の高さは「仕様の範囲で重みを引く → 目標高さ（o.height）に合わせて配分する」ので、
 * どの高さでも全体が o.height ちょうどに収まり、段どうしの比率だけが乱数で変わる。
 */
import type { Rng } from '../../core/rng';
import type { Vec3 } from '../../core/types';
import { box, type Box, type MatId } from '../layout';
import type { MonumentBuild, MonumentOptions, MonumentPart } from './types';

/** 段に使う色（隣り合う段で同じ色を使わない） */
const SEG_MATS: readonly MatId[] = ['plasticRed', 'plasticYellow', 'plasticBlue', 'lockerGreen', 'floorTile', 'signPlate'];

type SegKind = 'cyl' | 'box' | 'disc' | 'discV' | 'sphere';

interface Seg {
  kind: SegKind;
  /** 高さの重み → 配分後の高さ */
  h: number;
  /** cyl / disc / discV / sphere の半径、box の一辺 */
  r: number;
  mat: MatId;
  cx: number;
  cz: number;
  yaw: number;
  /** cyl の上面半径（先細り） */
  rTop: number;
  /** 円盤の厚み */
  th: number;
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** 部品の水平方向の外接（index.ts の partBounds と同じ近似） */
function spanXZ(p: MonumentPart): { cx: number; cz: number; hx: number; hz: number } {
  const [a, b, c] = p.size;
  let hx = 0.1, hz = 0.1, hy = 0.1;
  switch (p.prim) {
    case 'box': case 'plate': hx = a / 2; hy = b / 2; hz = (c || 0.03) / 2; break;
    case 'cylinder': hx = hz = Math.max(a, c ?? 0); hy = b / 2; break;
    case 'sphere': hx = hy = hz = a; break;
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

/** 足跡（±limit）からはみ出す部品を中心側へ寄せる */
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

export function buildColorStack(rng: Rng, o: MonumentOptions): MonumentBuild {
  const H = Math.max(1.6, o.height);
  const R = Math.max(0.8, o.radius);
  const d = clamp(o.distort, 0, 1);
  // 屋外は寸法を 1.6〜2.4 倍（段数 +2）
  const s = o.outdoor ? rng.float(1.6, 2.4) : 1;
  const parts: MonumentPart[] = [];
  const colliders: Box[] = [];

  // ── 基壇（テラゾーの円盤）
  const baseR = R * rng.float(0.7, 0.9);
  const baseH = clamp(rng.float(0.3, 0.5) * s, 0.22, H * 0.14);
  parts.push({ prim: 'cylinder', mat: 'floorTile', pos: [0, baseH / 2, 0], size: [baseR, baseH, baseR] });
  colliders.push(box([-baseR, 0, -baseR], [baseR, baseH, baseR], 'floorTile'));
  // 基壇の側面に小さな白板を 4 面（刻印の代わり）
  const plate = clamp(0.3 * s, 0.18, Math.min(baseR * 0.9, baseH * 0.8));
  for (let f = 0; f < 4; f++) {
    const yaw = (f * Math.PI) / 2;
    parts.push({
      prim: 'plate', mat: 'signPlate',
      pos: [Math.sin(yaw) * (baseR + 0.015), baseH * 0.5, -Math.cos(yaw) * (baseR + 0.015)],
      rot: [0, yaw, 0], size: [plate, plate, 0.03],
    });
  }

  // ── 頂部の球と、段に配れる高さ
  const topR = clamp(rng.float(0.4, 0.8) * s, 0.2, Math.min(R * 0.6, H * 0.16));
  const stackH = Math.max(0.5, H - baseH - topR * 2);
  const capBody = R * 0.62, capDisc = R * 0.95, capBox = R * 1.1, capBall = R * 0.6;

  // 段の種類（円盤・球が続かないようにする）
  const nBase = clamp(Math.round(stackH / (0.95 * s)), 5, 9);
  const n = nBase + (o.outdoor ? 2 : 0);
  const POOL: readonly SegKind[] = ['cyl', 'cyl', 'box', 'disc', 'disc', 'discV', 'sphere'];
  const segs: Seg[] = [];
  let prevKind: SegKind | null = null;
  let prevMat: MatId | null = 'floorTile';
  for (let i = 0; i < n; i++) {
    let k = rng.pick(POOL);
    if ((k === 'disc' || k === 'discV') && (prevKind === 'disc' || prevKind === 'discV')) k = 'cyl';
    if (k === 'sphere' && prevKind === 'sphere') k = 'box';
    let mat = rng.pick(SEG_MATS);
    for (let t = 0; t < 4 && mat === prevMat; t++) mat = rng.pick(SEG_MATS);
    // 円盤の 1 枚はガラス（半透明の色板）でもよい
    if ((k === 'disc' || k === 'discV') && rng.chance(0.22)) mat = 'glass';
    let h: number, r: number, th = clamp(rng.float(0.08, 0.15) * s, 0.06, 0.4);
    switch (k) {
      case 'cyl': h = rng.float(0.3, 1.2) * s; r = Math.min(rng.float(0.4, 1.1) * s, capBody); break;
      case 'box': h = rng.float(0.6, 1.6) * s; r = Math.min(rng.float(0.6, 1.6) * s, capBox) / 2; break;
      case 'disc': r = Math.min(rng.float(0.8, 1.6) * s, capDisc); h = th; break;
      case 'discV': r = Math.min(rng.float(0.8, 1.6) * s, capDisc); h = r * 2; break;
      default: r = Math.min(rng.float(0.3, 0.7) * s, capBall); h = r * 2; break;
    }
    segs.push({ kind: k, h, r, mat, cx: 0, cz: 0, yaw: rng.float(0, Math.PI * 2), rTop: r, th });
    prevKind = k;
    prevMat = mat;
  }

  // 高さの配分: 重みの比を保ったまま合計を stackH に合わせる
  let sum = 0;
  for (const g of segs) sum += g.h;
  const kH = stackH / Math.max(0.001, sum);
  for (const g of segs) {
    g.h *= kH;
    // 球・立てた円盤は高さ = 直径なので半径も一緒に縮む
    if (g.kind === 'sphere') g.r = Math.min(g.h / 2, capBall), g.h = g.r * 2;
    else if (g.kind === 'discV') g.r = Math.min(g.h / 2, capDisc), g.h = g.r * 2;
    else if (g.kind === 'disc') g.th = g.h;
  }
  // 半径の上限で削れた分を、高さの自由な段（円柱・箱・水平円盤）に配り直す
  let after = 0;
  for (const g of segs) after += g.h;
  const free = segs.filter((g) => g.kind === 'cyl' || g.kind === 'box' || g.kind === 'disc');
  if (free.length && after < stackH) {
    const share = (stackH - after) / free.length;
    for (const g of free) { g.h += share; if (g.kind === 'disc') g.th = g.h; }
  }

  // ── 積む（中心を 0〜0.5 m ずらす。distort に比例）
  let y = baseH;
  let cx = 0, cz = 0;
  let maxR = baseR;
  for (const g of segs) {
    const half = g.kind === 'box' ? g.r * Math.SQRT2 : g.r;
    const a = rng.float(0, Math.PI * 2);
    const off = rng.float(0, 0.5) * s * d;
    let nx = cx + Math.cos(a) * off, nz = cz + Math.sin(a) * off;
    const rad = Math.hypot(nx, nz);
    const room = Math.max(0, R * 1.05 - half);
    if (rad > room) { const f = room / Math.max(0.001, rad); nx *= f; nz *= f; }
    cx = nx; cz = nz;
    g.cx = cx; g.cz = cz;
    maxR = Math.max(maxR, Math.hypot(cx, cz) + half);
    const tilt = rng.float(-0.05, 0.05) * d;
    switch (g.kind) {
      case 'cyl':
        g.rTop = g.r * (rng.chance(0.3) ? rng.float(0.55, 0.9) : 1);
        parts.push({ prim: 'cylinder', mat: g.mat, pos: [cx, y + g.h / 2, cz], rot: [tilt, g.yaw, tilt], size: [g.r, g.h, g.rTop] });
        break;
      case 'box':
        parts.push({ prim: 'box', mat: g.mat, pos: [cx, y + g.h / 2, cz], rot: [tilt, g.yaw, tilt], size: [g.r * 2, g.h, g.r * 2] });
        break;
      case 'disc':
        parts.push({ prim: 'cylinder', mat: g.mat, pos: [cx, y + g.h / 2, cz], rot: [tilt, g.yaw, tilt], size: [g.r, Math.max(0.05, g.th), g.r] });
        break;
      case 'discV':
        // pitch 90° で立てた円盤（厚み th の板が縦に立つ）
        parts.push({ prim: 'cylinder', mat: g.mat, pos: [cx, y + g.r, cz], rot: [Math.PI / 2, g.yaw, 0], size: [g.r, Math.max(0.05, g.th), g.r] });
        break;
      default:
        parts.push({ prim: 'sphere', mat: g.mat, pos: [cx, y + g.r, cz], size: [g.r, 0, 0] });
        break;
    }
    if (y < 2.2) colliders.push(box([cx - half, y, cz - half], [cx + half, y + g.h, cz + half], g.mat));
    y += g.h;
  }

  // ── ジグザグ（赤い小片を 45° ずつ振りながら斜めに連ねて側面に張り付ける）
  const zz = rng.int(5, 8);
  const zw = clamp(0.25 * s, 0.15, 0.6), zh = clamp(0.6 * s, 0.3, 1.4);
  const zA = rng.float(0, Math.PI * 2);
  const zR = clamp(maxR * 0.9 + zw, baseR * 0.4, Math.max(baseR * 0.4, R * 1.15 - zh / 2));
  const zy0 = baseH + stackH * rng.float(0.05, 0.2);
  const zStep = Math.min((y - zy0) / Math.max(1, zz), zh * 0.9);
  for (let i = 0; i < zz; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const a = zA + side * 0.22;
    parts.push({
      prim: 'box', mat: 'plasticRed',
      pos: [Math.cos(a) * zR, zy0 + zStep * (i + 0.5), Math.sin(a) * zR],
      rot: [0, zA + (i * Math.PI) / 4, side * rng.float(0.5, 0.9)],
      size: [zw, zh, zw],
    });
  }

  // ── 螺旋の帯（塔の周りを 1〜1.5 周）
  const rw = clamp(rng.float(0.4, 0.6) * s, 0.25, 0.9);
  const rr = clamp(maxR + 0.3 * s, baseR * 0.6, Math.max(baseR * 0.6, R * 1.1 - rw / 2));
  const turns = rng.float(1, 1.5);
  const m = rng.int(8, 12);
  const sy0 = baseH + stackH * rng.float(0.05, 0.25);
  const sy1 = Math.min(y, sy0 + stackH * rng.float(0.55, 0.85));
  const a0 = rng.float(0, Math.PI * 2);
  const spiral: Vec3[] = [];
  for (let i = 0; i < m; i++) {
    const t = i / (m - 1);
    const a = a0 + t * turns * Math.PI * 2;
    const rad = rr * (1 + rng.float(-0.08, 0.08) * d);
    spiral.push([Math.cos(a) * rad, sy0 + (sy1 - sy0) * t, Math.sin(a) * rad]);
  }
  // 注意: 描画側は材質ごとに mergeGeometries でまとめるが、ribbon（ExtrudeGeometry）だけ非インデックスなので、
  // 他のプリミティブと同じ材質にするとその材質の部品が丸ごと消える。帯は帯だけの材質にする
  // （本来は floorTile / signPlate にしたい。MonumentGeometry 側が混在を許したら戻す）。
  parts.push({
    prim: 'ribbon', mat: rng.chance(0.5) ? 'marbleFloor' : 'goldTrim',
    pos: [0, 0, 0], size: [rw, clamp(0.08 * s, 0.05, 0.2), 0], path: spiral,
  });

  // ── 頂部の球
  const topMat: MatId = rng.chance(0.35) ? 'neonRed' : 'plasticRed';
  parts.push({ prim: 'sphere', mat: topMat, pos: [cx, y + topR, cz], size: [topR, 0, 0] });

  // 足跡の外へ出た部品（ジグザグ・螺旋・ずらした段）を内側へ寄せる
  fitFootprint(parts, R * 1.18);

  return { parts, colliders };
}
