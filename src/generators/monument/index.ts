/**
 * モニュメントの組み立て入口。kind ごとの文法（各ファイル）を呼び、MonumentBuild（部品・当たり判定・刻印）を返す。
 * 配置は src/generators/oddity/monument.ts（部屋座標へ写し、L.monuments / colliderOnly 箱 / signs に入れる）。
 */
import type { Rng } from '../../core/rng';
import { box, type Box, type MatId } from '../layout';
import type { MonumentBuild, MonumentKind, MonumentOptions, MonumentPart } from './types';
import { buildOfficeTotem } from './officeTotem';
import { buildStoneFrame } from './stoneFrame';
import { buildRibbon } from './ribbon';
import { buildCubeCluster } from './cubeCluster';
import { buildColorStack } from './colorStack';
import { buildSteel } from './steel';
import { buildChairTower, buildColossus, buildDoorRing, buildLampGrove, buildMonolith } from './extra';

export function buildMonument(kind: MonumentKind, rng: Rng, o: MonumentOptions): MonumentBuild {
  const base = buildKind(kind, rng, o);
  if (!base.parts.length) return base;
  // 巨大（colossus）は輪郭を読ませるため増幅しない（破片・反響が門と球の形を崩していた）。材質の置き換えもしない（ユーザー確認済みの見た目）。
  // 他は形はそのまま、材質だけ木・石・金属へ（第17回。流線・絡み合いの形の追加はユーザーの判断で取り消した）
  if (kind !== 'colossus') {
    amplify(base, rng.fork('amplify'), o, kind);
    heavyMaterials(base);
  }
  fitEnvelope(base, o);
  return base;
}

/**
 * 材質を木・石・金属に揃える（第17回。ユーザー指示: 重厚感のある材質、発光は不要）。発光・ガラス・プラスチック・布・塗装の白を置き換える
 */
const HEAVY_REMAP: Partial<Record<MatId, MatId>> = {
  neonRed: 'goldTrim', neonBlue: 'stainless', lightWarm: 'goldTrim', lightPanel: 'marbleWhite', sodiumLight: 'goldTrim', ledBlue: 'metalDark',
  lightGreen: 'metalDark', lightYellow: 'goldTrim', lightOff: 'metal', screenGlow: 'metalDark', screenDark: 'metalDark', screenLcd: 'metalDark',
  glass: 'stainless', carGlass: 'metalDark', aquariumBlue: 'stainless', plasticRed: 'woodPanel', plasticBlue: 'metalDark', plasticYellow: 'goldTrim',
  lockerGreen: 'metal', lockerBlue: 'metal', signPlate: 'metal', whiteFabric: 'marbleWhite', upholstery: 'woodPanel', seatBlue: 'woodPanel', seatRed: 'woodPanel',
  furnitureLight: 'doorWood', wallWhite: 'marbleWhite', paintWhite: 'marbleWhite', rubber: 'metalDark',
};
function heavyMaterials(b: MonumentBuild): void {
  for (const p of b.parts) { const m = HEAVY_REMAP[p.mat]; if (m) p.mat = m; }
}


/**
 * 仕上げ: 部品を高さ o.height（屋外は 1.12 倍）と水平半径 o.radius × 1.8 の中に収める（増幅の反響・軌道・持ち出しが
 * 屋内の天井を突き抜けたり、回転した浮き部品が床に潜ったりしていた）。はみ出した部品は下げる / 上げる / 内側へ寄せ、
 * それでも収まらない部品（大きすぎる反響など）は捨てる
 */
function fitEnvelope(b: MonumentBuild, o: MonumentOptions): void {
  const limitY = o.height * (o.outdoor ? 1.12 : 1.0) + 0.1;
  const limitR = Math.max(1, o.radius) * 1.8;
  const keep: MonumentPart[] = [];
  for (const p of b.parts) {
    let bb = partBounds(p);
    const shift = (dx: number, dy: number, dz: number) => { p.pos = [p.pos[0] + dx, p.pos[1] + dy, p.pos[2] + dz]; bb = partBounds(p); };
    if (bb.max[1] - bb.min[1] > limitY + 0.05) continue;
    if (bb.max[1] > limitY) shift(0, limitY - bb.max[1], 0);
    if (bb.min[1] < -0.02) shift(0, -bb.min[1], 0);
    const hx = (bb.max[0] - bb.min[0]) / 2, hz = (bb.max[2] - bb.min[2]) / 2;
    if (hx > limitR || hz > limitR) continue;
    const cx = (bb.min[0] + bb.max[0]) / 2, cz = (bb.min[2] + bb.max[2]) / 2;
    const tx = Math.max(-(limitR - hx), Math.min(limitR - hx, cx)), tz = Math.max(-(limitR - hz), Math.min(limitR - hz, cz));
    if (tx !== cx || tz !== cz) shift(tx - cx, 0, tz - cz);
    keep.push(p);
  }
  b.parts = keep;
}

function buildKind(kind: MonumentKind, rng: Rng, o: MonumentOptions): MonumentBuild {
  switch (kind) {
    case 'officeTotem': return buildOfficeTotem(rng, o);
    case 'stoneFrame': return buildStoneFrame(rng, o);
    case 'ribbon': return buildRibbon(rng, o);
    case 'cubeCluster': return buildCubeCluster(rng, o);
    case 'colorStack': return buildColorStack(rng, o);
    case 'steel': return buildSteel(rng, o);
    case 'monolith': return buildMonolith(rng, o);
    case 'chairTower': return buildChairTower(rng, o);
    case 'doorRing': return buildDoorRing(rng, o);
    case 'lampGrove': return buildLampGrove(rng, o);
    case 'colossus': return buildColossus(rng, o, buildKind);
    case 'clutter': return { parts: [] };
  }
}

// ---------------------------------------------------------------- 増幅（派手さ・広がり・物理的におかしな接続）
type Vec3 = [number, number, number];
/** kind ごとの「寄生する部品」（echo の複製で材質を差し替えるときの候補） */
const KIND_ACCENTS: Record<MonumentKind, readonly MatId[]> = {
  officeTotem: ['woodPanel', 'metalDark', 'goldTrim', 'doorWood'],
  steel: ['redShutter', 'metalDark', 'stainless', 'goldTrim'],
  stoneFrame: ['marbleWhite', 'stainless', 'columnConcrete', 'goldTrim'],
  cubeCluster: ['columnConcrete', 'stainless', 'marbleWhite', 'metalDark'],
  ribbon: ['marbleWhite', 'stainless', 'goldTrim', 'woodPanel'],
  colorStack: ['woodPanel', 'goldTrim', 'marbleWhite', 'metalDark', 'bookshelfWood'],
  monolith: ['metalDark', 'stainless', 'wallConcrete', 'marbleWhite'],
  chairTower: ['woodPanel', 'doorWood', 'bookshelfWood', 'metalDark'],
  doorRing: ['doorWood', 'trim', 'goldTrim', 'woodPanel'],
  lampGrove: ['metalDark', 'metal', 'goldTrim', 'stainless'],
  colossus: ['goldTrim', 'stainless', 'marbleWhite', 'neonBlue', 'screenDark'],
  clutter: ['boxCardboard'],
};

/** 増幅の強さ（種類別。無い種類は 1） */
const AMPLIFY_SCALE: Partial<Record<MonumentKind, number>> = { monolith: 0.55, chairTower: 0.35, doorRing: 0.3, lampGrove: 0.4 };

function pickOf<T>(rng: Rng, arr: readonly T[]): T { return arr[Math.min(arr.length - 1, Math.floor(rng.float(0, 1) * arr.length))]; }

/** 2 点を結ぶ細い円柱（円柱は Y 軸沿いなので、方向へ回す: X 回転 θ = Y からの角、Y 回転 φ = 水平方位） */
function rodBetween(a: Vec3, b: Vec3, radius: number, mat: MatId): MonumentPart | null {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.2) return null;
  const theta = Math.atan2(Math.hypot(dx, dz), dy);
  const phi = Math.atan2(dx, dz);
  return { prim: 'cylinder', mat, pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [theta, phi, 0], size: [radius, len, radius] };
}

function centerOf(p: MonumentPart): Vec3 {
  if ((p.prim === 'ribbon' || p.prim === 'tube') && p.path?.length) {
    const q = p.path[Math.floor(p.path.length / 2)];
    return [q[0] + p.pos[0], q[1] + p.pos[1], q[2] + p.pos[2]];
  }
  return [p.pos[0], p.pos[1] + (p.prim === 'stairs' ? p.size[1] / 2 : 0), p.pos[2]];
}

/**
 * 文法の出力に「派手さ」と「広がり」を足す（ユーザー指示: 地味なので、物理的におかしな接続でもよいから奇妙で広がりのあるものに）。
 *  1. 反響（echo）: 部品 3〜7 個を複製して外側・上方へ飛ばし、傾け、材質をアクセントに差し替える（浮いた分身）
 *  2. 棒（rod）: 部品どうしを 4〜8 本の細い棒で「ありえない」つなぎ方で結ぶ
 *  3. 軌道（orbit）: 頂部の周りを傾いた大きな円環 1〜2 個が回り、その上に球が乗る
 *  4. 持ち出し（cantilever）: 上部から水平に足跡の 1.2〜2 倍まで伸びる梁の先に重い立方体（支えなし）
 *  5. 破片（fragments）: 外殻 0.8〜1.6 R に小さな箱・板 8〜16 個が散る（半数はガラスやネオン）
 *  6. ネオン管: 部品の中心 4〜6 点を縫うように走る発光管 1 本（ブルームが乗る）
 * 三角形の追加は 4,000 以下、部品 +45 以下。当たり判定は足さない（浮いた部品の下は通れる）
 */
function amplify(b: MonumentBuild, rng: Rng, o: MonumentOptions, kind: MonumentKind): void {
  const parts = b.parts;
  const solids = parts.filter((p) => p.prim !== 'tube' && p.prim !== 'ribbon' && p.prim !== 'plate');
  if (!solids.length) return;
  let top = 0, cx = 0, cz = 0;
  for (const p of parts) { const c = centerOf(p); top = Math.max(top, c[1]); cx += c[0]; cz += c[2]; }
  cx /= parts.length; cz /= parts.length;
  const H = Math.max(o.height, top);
  const R = Math.max(0.8, o.radius);
  // 増幅の度合い。形そのものが主役の種類（第17回の追加）は弱める（大きな球・輪・反響が椅子・扉・街灯の輪郭を覆っていた）
  const scale = AMPLIFY_SCALE[kind] ?? 1;
  const k = (0.6 + o.distort * 0.8) * scale;
  const accents = KIND_ACCENTS[kind];
  const added: MonumentPart[] = [];
  let tris = 0;
  const cost = (p: MonumentPart) => p.prim === 'ring' ? 1000 : p.prim === 'tube' ? 1200 : p.prim === 'sphere' ? 800 : p.prim === 'cylinder' ? 100 : p.prim === 'stairs' ? 12 * Math.round(p.size[1] / 0.18) : 12;
  const push = (p: MonumentPart) => { const c = cost(p); if (tris + c > 4000 || added.length >= 45) return false; tris += c; added.push(p); return true; };

  // 1. 反響
  const nEcho = Math.round(rng.float(3, 7) * k);
  for (let i = 0; i < nEcho; i++) {
    const src = pickOf(rng, solids);
    if (src.prim === 'stairs' && rng.chance(0.5)) continue;
    const c = centerOf(src);
    const ang = Math.atan2(c[2] - cz, c[0] - cx) + rng.float(-0.9, 0.9);
    const dist = R * rng.float(0.7, 1.6);
    const y = Math.min(H * 1.15, Math.max(0.6, c[1] + rng.float(-0.4, 1.2) * H * 0.3));
    const es = rng.float(0.5, 1.3) * (0.4 + 0.6 * scale);
    const size: Vec3 = [src.size[0] * es, src.size[1] * es, (src.size[2] ?? 0) * es];
    const rot: Vec3 = [(src.rot?.[0] ?? 0) + rng.float(-0.6, 0.6), (src.rot?.[1] ?? 0) + rng.float(-1.5, 1.5), (src.rot?.[2] ?? 0) + rng.float(-0.6, 0.6)];
    const mat = rng.chance(0.55) ? pickOf(rng, accents) : src.mat;
    push({ prim: src.prim, mat, pos: [cx + Math.cos(ang) * dist, y, cz + Math.sin(ang) * dist], rot, size });
  }
  // 2. 棒（ありえない接続）
  const nRod = Math.round(rng.float(4, 8) * k);
  const all = [...solids, ...added];
  for (let i = 0; i < nRod && all.length >= 2; i++) {
    const a = pickOf(rng, all), c2 = pickOf(rng, all);
    if (a === c2) continue;
    const rod = rodBetween(centerOf(a), centerOf(c2), rng.float(0.015, 0.05), rng.chance(0.25) ? 'neonBlue' : pickOf(rng, ['metalDark', 'stainless', 'metal'] as const));
    if (rod) push(rod);
  }
  // 3. 軌道の円環 + 球
  const nRing = rng.chance(0.75 * scale) ? (rng.chance(0.4) ? 2 : 1) : 0;
  for (let i = 0; i < nRing; i++) {
    const rr = R * rng.float(0.5, 1.1);
    const y = H * rng.float(0.55, 1.05);
    const rot: Vec3 = [Math.PI / 2 + rng.float(-0.7, 0.7), rng.float(0, Math.PI), rng.float(-0.5, 0.5)];
    const ringMat = pickOf(rng, ['stainless', 'marbleWhite', 'metalDark', 'goldTrim'] as const);
    if (!push({ prim: 'ring', mat: ringMat, pos: [cx + rng.float(-0.3, 0.3) * R, y, cz + rng.float(-0.3, 0.3) * R], rot, size: [rr, Math.max(0.04, rr * rng.float(0.05, 0.12)), 0] })) break;
    const nSph = rng.int(1, 3);
    for (let s = 0; s < nSph; s++) {
      const t = rng.float(0, Math.PI * 2);
      push({ prim: 'sphere', mat: rng.chance(0.6) ? 'stainless' : pickOf(rng, accents), pos: [cx + Math.cos(t) * rr, y + rng.float(-0.2, 0.2) * rr, cz + Math.sin(t) * rr], size: [rr * rng.float(0.1, 0.22) * (0.5 + 0.5 * scale), 0, 0] });
    }
  }
  // 4. 持ち出しの梁 + 先端の重い立方体
  const nCant = rng.chance(0.8 * scale) ? rng.int(1, 2) : 0;
  for (let i = 0; i < nCant; i++) {
    const ang = rng.float(0, Math.PI * 2);
    const len = R * rng.float(1.2, 2.0);
    const y = H * rng.float(0.5, 0.95);
    const th = Math.max(0.12, R * 0.08);
    const beamMat = pickOf(rng, [...accents.filter((m) => m !== 'glass' && !String(m).startsWith('neon')), 'metalDark'] as MatId[]);
    push({ prim: 'box', mat: beamMat, pos: [cx + Math.cos(ang) * len / 2, y, cz + Math.sin(ang) * len / 2], rot: [0, -ang, rng.float(-0.08, 0.08)], size: [len, th, th] });
    const cube = Math.max(0.4, R * rng.float(0.25, 0.5));
    push({ prim: rng.chance(0.7) ? 'box' : 'sphere', mat: pickOf(rng, accents), pos: [cx + Math.cos(ang) * (len + cube * 0.4), y + (rng.chance(0.5) ? cube * 0.6 : -cube * 0.6), cz + Math.sin(ang) * (len + cube * 0.4)], rot: [rng.float(-0.5, 0.5), rng.float(0, 1.5), rng.float(-0.5, 0.5)], size: [cube, cube, cube] });
  }
  // 5. 破片
  const nFrag = Math.round(rng.float(8, 16) * k);
  for (let i = 0; i < nFrag; i++) {
    const ang = rng.float(0, Math.PI * 2), dist = R * rng.float(0.8, 1.6), y = H * rng.float(0.3, 1.1);
    const s = rng.float(0.15, 0.5) * Math.max(1, R / 1.5);
    const mat = rng.chance(0.5) ? pickOf(rng, ['glass', 'neonBlue', 'stainless'] as const) : pickOf(rng, accents);
    push({ prim: rng.chance(0.6) ? 'box' : 'plate', mat, pos: [cx + Math.cos(ang) * dist, y, cz + Math.sin(ang) * dist], rot: [rng.float(-1, 1), rng.float(0, 3), rng.float(-1, 1)], size: [s, s * rng.float(0.3, 1), s * rng.float(0.1, 1)] });
  }
  // 6. ネオン管（部品の中心を縫う）
  if (rng.chance(0.85) && all.length >= 3) {
    const n = Math.min(all.length, rng.int(4, 6));
    const path: Vec3[] = [];
    const used = new Set<number>();
    while (path.length < n) {
      const idx = rng.int(0, all.length - 1);
      if (used.has(idx)) { if (used.size >= all.length) break; continue; }
      used.add(idx);
      const c = centerOf(all[idx]);
      path.push([c[0] + rng.float(-0.2, 0.2), c[1] + rng.float(-0.2, 0.3), c[2] + rng.float(-0.2, 0.2)]);
    }
    if (path.length >= 3) push({ prim: 'tube', mat: rng.chance(0.5) ? 'neonRed' : 'neonBlue', pos: [0, 0, 0], size: [Math.max(0.02, R * 0.02), 0, 0], path });
  }
  parts.push(...added);
}

/** 部品の外接箱（回転を実際に掛けた 8 隅の AABB。当たり判定の既定に使う。ribbon / tube は制御点の外接 + 太さ） */
export function partBounds(p: MonumentPart): Box {
  const [a, b, c] = p.size;
  if (p.prim === 'ribbon' || p.prim === 'tube') {
    const pts = p.path ?? [];
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const q of pts) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], q[k]); mx[k] = Math.max(mx[k], q[k]); }
    if (!pts.length) { mn[0] = mn[1] = mn[2] = -0.1; mx[0] = mx[1] = mx[2] = 0.1; }
    const pad = Math.max(a, b || 0) / 2;
    return box([mn[0] - pad + p.pos[0], mn[1] - pad + p.pos[1], mn[2] - pad + p.pos[2]], [mx[0] + pad + p.pos[0], mx[1] + pad + p.pos[1], mx[2] + pad + p.pos[2]], p.mat, true);
  }
  // 無回転のローカル半径（中心基準。stairs は基部中央が pos なので y を上へ寄せる）
  let hx = 0.1, hy = 0.1, hz = 0.1, cy = 0;
  switch (p.prim) {
    case 'box': case 'plate': hx = a / 2; hy = b / 2; hz = (c || 0.03) / 2; break;
    case 'cylinder': hx = hz = Math.max(a, c ?? 0); hy = b / 2; break;
    case 'sphere': hx = hy = hz = a; break;
    case 'ring': hx = hy = a + b; hz = b; break;
    case 'stairs': hx = a / 2; hy = b / 2; hz = c / 2; cy = b / 2; break;
    case 'frame': hx = a / 2; hy = b / 2; hz = c / 2; break;
    case 'knot': hx = hy = a * 1.35 + b; hz = a * 0.5 + b; break;
    case 'rock': hx = a * 0.64; hy = b * 0.64; hz = c * 0.64; break;
    case 'appliance': hx = a / 2; hy = b / 2; hz = c / 2; cy = b / 2; break;
    case 'lathe': {
      const pts = p.path ?? [];
      hx = hz = Math.max(0.05, ...pts.map((q) => q[0]));
      const y0 = Math.min(0, ...pts.map((q) => q[1])), y1 = Math.max(0.05, ...pts.map((q) => q[1]));
      hy = (y1 - y0) / 2; cy = (y1 + y0) / 2;
      break;
    }
  }
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const [pitch, yaw, roll] = p.rot ?? [0, 0, 0];
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cyw = Math.cos(yaw), syw = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    // 'YXZ' の Euler（three と同じ）: v' = Ry(yaw) · Rx(pitch) · Rz(roll) · v
    let x = sx * hx, y = sy * hy + cy, z = sz * hz;
    let x1 = x * cr - y * sr, y1 = x * sr + y * cr; x = x1; y = y1;
    let y2 = y * cp - z * sp, z2 = y * sp + z * cp; y = y2; z = z2;
    let x3 = x * cyw + z * syw, z3 = -x * syw + z * cyw; x = x3; z = z3;
    const w = [x + p.pos[0], y + p.pos[1], z + p.pos[2]];
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); }
  }
  return box([mn[0], mn[1], mn[2]], [mx[0], mx[1], mx[2]], p.mat, true);
}
