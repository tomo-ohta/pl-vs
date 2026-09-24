/**
 * モニュメントの文法（第17回の追加）: monolith 黒い石板 / chairTower 積み上げた椅子 / doorRing 扉の輪 / lampGrove 街灯の林、
 * および広い部屋の中央に置く巨大な colossus（既存の文法 2 つを上下に積み、光輪・尖塔・張り綱・螺旋のネオンで束ねる）。
 *
 * 座標はモニュメント・ローカル（基壇中心 = 原点、y 上、正面 = −Z）。部品の回転は描画側と同じ Euler 'YXZ'（Ry·Rx·Rz）。
 * 当たり判定は基壇と、床から 2.2 m 以下に掛かる主要部品の外接箱だけ（浮いた部品の下は通れる）。
 */
import type { Rng } from '../../core/rng';
import type { Vec3 } from '../../core/types';
import type { Box, MatId } from '../layout';
import type { MonumentBuild, MonumentKind, MonumentOptions, MonumentPart, MonumentSign } from './types';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function aabb(min: Vec3, max: Vec3, mat: MatId): Box {
  return {
    min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])],
    max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])],
    mat, solid: true,
  };
}

function pickOf<T>(rng: Rng, arr: readonly T[]): T { return arr[Math.min(arr.length - 1, Math.floor(rng.float(0, 1) * arr.length))]; }

/** 2 点を結ぶ円柱（Y 軸の円柱を a → b へ向ける） */
function rod(a: Vec3, b: Vec3, r: number, mat: MatId): MonumentPart | null {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) return null;
  return { prim: 'cylinder', mat, pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(Math.hypot(dx, dz), dy), Math.atan2(dx, dz), 0], size: [r, len, r] };
}

// ---------------------------------------------------------------- 回転の合成（Euler 'YXZ' ⇔ 3×3 行列）
type M3 = [number, number, number, number, number, number, number, number, number]; // 行優先

function mul(a: M3, b: M3): M3 {
  const o = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return o;
}
function fromEuler(e: Vec3): M3 {
  const [x, y, z] = e;
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  const Ry: M3 = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Rx: M3 = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const Rz: M3 = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mul(mul(Ry, Rx), Rz);
}
function toEuler(m: M3): Vec3 {
  const m13 = m[2], m23 = m[5], m33 = m[8], m21 = m[3], m22 = m[4], m31 = m[6], m11 = m[0];
  const x = Math.asin(-clamp(m23, -1, 1));
  if (Math.abs(m23) < 0.9999999) return [x, Math.atan2(m13, m33), Math.atan2(m21, m22)];
  return [x, Math.atan2(-m31, m11), 0];
}
function apply(m: M3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/** 部品の組（局所座標）を、回転 rot・位置 at の姿勢で親へ写す */
export function placeGroup(group: MonumentPart[], rot: Vec3, at: Vec3): MonumentPart[] {
  const R = fromEuler(rot);
  return group.map((p) => {
    const q = apply(R, p.pos);
    const r = toEuler(mul(R, fromEuler(p.rot ?? [0, 0, 0])));
    return { ...p, pos: [q[0] + at[0], q[1] + at[1], q[2] + at[2]], rot: r, path: p.path?.map((c) => apply(R, c)) };
  });
}

// ---------------------------------------------------------------- monolith 黒い石板
export function buildMonolith(rng: Rng, o: MonumentOptions): MonumentBuild {
  const parts: MonumentPart[] = [], colliders: Box[] = [], signs: MonumentSign[] = [];
  const H = Math.max(2, o.height), R = Math.max(0.8, o.radius), d = clamp(o.distort, 0, 1);
  // 3 段の基壇
  let y = 0;
  const tiers = 3;
  const w0 = Math.min(2 * R * 0.95, Math.max(1.2, R * 1.8));
  for (let i = 0; i < tiers; i++) {
    const w = w0 * (1 - i * 0.2), th = clamp(H * 0.035, 0.1, 0.35);
    parts.push({ prim: 'box', mat: i === 1 ? 'marbleFloor' : 'columnConcrete', pos: [0, y + th / 2, 0], size: [w, th, w * 0.8] });
    colliders.push(aabb([-w / 2, y, -w * 0.4], [w / 2, y + th, w * 0.4], 'columnConcrete'));
    y += th;
  }
  const base = y;
  const w = clamp(H * 0.2, 0.45, R * 0.8), t = w * 0.22, hs = (H - base) * rng.float(0.78, 0.9);
  const lean = (rng.float(-1, 1) * 6 * d * Math.PI) / 180;
  parts.push({ prim: 'box', mat: 'screenDark', pos: [0, base + hs / 2, 0], rot: [0, rng.float(-0.2, 0.2), lean], size: [w, hs, t] });
  colliders.push(aabb([-w / 2 - 0.05, base, -t], [w / 2 + 0.05, Math.min(base + hs, 2.2), t], 'screenDark'));
  // 隣に平行な板 2 枚と、その隙間の青い光
  const side = rng.chance(0.5) ? 1 : -1, gx = side * (w * 0.5 + w * 0.55);
  for (const off of [-0.09, 0.09]) parts.push({ prim: 'box', mat: 'metalDark', pos: [gx, base + hs * 0.33, off * w * 2], size: [w * 0.7, hs * 0.66, t * 0.5] });
  parts.push({ prim: 'plate', mat: 'neonBlue', pos: [gx, base + hs * 0.33, 0], size: [w * 0.66, hs * 0.62, 0.01] });
  // もたれた板・浮いた横板・倒れた板
  const lx = -side * w * 0.75;
  parts.push({ prim: 'box', mat: 'screenDark', pos: [lx, base + hs * 0.3, 0], rot: [0, 0, side * rng.float(0.2, 0.42)], size: [w * 0.8, hs * 0.6, t * 0.8] });
  const fy = Math.min(H - w * 0.15, base + hs + rng.float(0.25, 0.6) * Math.max(0.6, H * 0.08));
  parts.push({ prim: 'box', mat: pickOf(rng, ['screenDark', 'stainless', 'marbleWhite'] as const), pos: [0, fy, 0], rot: [0, rng.float(0.2, 1.2), rng.float(-0.1, 0.1) * d], size: [w * 1.7, w * 0.12, w * 0.9] });
  const ang = rng.float(0, Math.PI * 2), rr = R * 0.7;
  parts.push({ prim: 'box', mat: 'screenDark', pos: [Math.cos(ang) * rr, 0.06 + t * 0.4, Math.sin(ang) * rr], rot: [Math.PI / 2, ang, 0], size: [w * 0.9, hs * 0.5, t * 0.8] });
  colliders.push(aabb([Math.cos(ang) * rr - hs * 0.26, 0, Math.sin(ang) * rr - hs * 0.26], [Math.cos(ang) * rr + hs * 0.26, t * 0.9, Math.sin(ang) * rr + hs * 0.26], 'screenDark'));
  // 周りを漂う小さな黒い立方体
  const n = rng.int(6, 10);
  for (let i = 0; i < n; i++) {
    const a = rng.float(0, Math.PI * 2), r = R * rng.float(0.6, 1.05), s = w * rng.float(0.12, 0.3);
    parts.push({ prim: 'box', mat: rng.chance(0.25) ? 'stainless' : 'screenDark', pos: [Math.cos(a) * r, rng.float(0.6, H * 0.9), Math.sin(a) * r], rot: [rng.float(-1, 1), rng.float(0, 3), rng.float(-1, 1)], size: [s, s, s] });
  }
  signs.push({ text: pickOf(rng, ['UNTITLED (BLACK)', 'DO NOT TOUCH THE SURFACE', 'IT HAS NO BACK']), sub: String(rng.int(1961, 2004)), pos: [0, base * 0.35, -w0 * 0.4 - 0.01], face: 0, width: Math.min(1.4, w0 * 0.6) });
  return { parts, colliders, signs };
}

// ---------------------------------------------------------------- chairTower 積み上げた椅子
/** 椅子 1 脚（局所: 原点 = 脚の接地面の中心、正面 −Z）。s = 縮尺 */
export function chairParts(s: number, seatMat: MatId): MonumentPart[] {
  const p: MonumentPart[] = [
    { prim: 'box', mat: seatMat, pos: [0, 0.45 * s, 0], size: [0.44 * s, 0.04 * s, 0.42 * s] },
    { prim: 'box', mat: seatMat, pos: [0, 0.7 * s, 0.19 * s], rot: [-0.08, 0, 0], size: [0.44 * s, 0.44 * s, 0.04 * s] },
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push({ prim: 'cylinder', mat: 'metalDark', pos: [sx * 0.19 * s, 0.225 * s, sz * 0.18 * s], size: [0.018 * s, 0.45 * s, 0.018 * s] });
  return p;
}

export function buildChairTower(rng: Rng, o: MonumentOptions): MonumentBuild {
  const parts: MonumentPart[] = [], colliders: Box[] = [], signs: MonumentSign[] = [];
  const H = Math.max(2, o.height), R = Math.max(0.8, o.radius), d = clamp(o.distort, 0, 1);
  const s = o.outdoor ? rng.float(1.8, 2.8) : clamp(H / 4, 1, 1.6);
  const seatMats: MatId[] = ['woodPanel', 'doorWood', 'bookshelfWood', 'handrailWood'];
  // 土台の机
  const tw = 1.2 * s, td = 0.8 * s, th = 0.74 * s;
  parts.push({ prim: 'box', mat: 'doorWood', pos: [0, th - 0.02 * s, 0], size: [tw, 0.04 * s, td] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push({ prim: 'box', mat: 'metalDark', pos: [sx * (tw / 2 - 0.05 * s), (th - 0.04 * s) / 2, sz * (td / 2 - 0.05 * s)], size: [0.04 * s, th - 0.04 * s, 0.04 * s] });
  colliders.push(aabb([-tw / 2, 0, -td / 2], [tw / 2, th, td / 2], 'doorWood'));
  // 塔: 椅子を 1 脚ずつ前の椅子の上へ（正立 / 逆さ / 横倒し / 背もたれで立つ）。揺らぎは distort
  let y = th, x = 0, z = 0;
  const poses: Vec3[] = [[0, 0, 0], [0, 0, Math.PI], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2], [-Math.PI / 2, 0, 0]];
  const heights = [0.92, 0.92, 0.46, 0.46, 0.46];
  let count = 0;
  while (y < H - 0.5 * s && count < 14) {
    const k = count === 0 ? 0 : rng.int(0, poses.length - 1);
    const pose = poses[k];
    const yaw = rng.float(0, Math.PI * 2);
    const tilt: Vec3 = [pose[0] + rng.float(-0.25, 0.25) * d, pose[1] + yaw, pose[2] + rng.float(-0.25, 0.25) * d];
    const hh = heights[k] * s;
    // 姿勢ごとに接地面が原点に来るよう持ち上げる（逆さは座面の高さ分、横倒しは奥行きの半分）
    const lift = k === 1 ? 0.92 * s : k >= 2 ? 0.23 * s : 0;
    const group = placeGroup(chairParts(s, pickOf(rng, seatMats)), tilt, [x, y + lift, z]);
    parts.push(...group);
    y += hh * rng.float(0.85, 1.0);
    x = clamp(x + rng.float(-0.12, 0.12) * s * (0.5 + d), -R * 0.4, R * 0.4);
    z = clamp(z + rng.float(-0.12, 0.12) * s * (0.5 + d), -R * 0.4, R * 0.4);
    count++;
  }
  // 頂点の上に浮く逆さの椅子と、机の周りに倒れた椅子
  parts.push(...placeGroup(chairParts(s, 'woodPanel'), [0, rng.float(0, 3), Math.PI + rng.float(-0.3, 0.3)], [x, Math.min(H - 0.05, y + 1.25 * s), z]));
  const nFallen = rng.int(2, 4);
  for (let i = 0; i < nFallen; i++) {
    const a = rng.float(0, Math.PI * 2), r = clamp(R * rng.float(0.6, 0.95), tw * 0.8, R);
    const lying = rng.chance(0.5);
    parts.push(...placeGroup(chairParts(s, pickOf(rng, seatMats)), lying ? [Math.PI / 2, a, 0] : [0, a, Math.PI], [Math.cos(a) * r, lying ? 0.23 * s : 0.92 * s, Math.sin(a) * r]));
  }
  colliders.push(aabb([-0.35 * s + x * 0.5, th, -0.35 * s + z * 0.5], [0.35 * s + x * 0.5, Math.min(2.2, H), 0.35 * s + z * 0.5], 'metal'));
  signs.push({ text: pickOf(rng, ['PLEASE BE SEATED', 'RESERVED', 'WAIT HERE']), pos: [0, th * 0.55, -td / 2 - 0.01], face: 0, width: Math.min(1.0, tw * 0.7) });
  return { parts, colliders, signs };
}

// ---------------------------------------------------------------- doorRing 扉の輪
export function buildDoorRing(rng: Rng, o: MonumentOptions): MonumentBuild {
  const parts: MonumentPart[] = [], colliders: Box[] = [], signs: MonumentSign[] = [];
  const H = Math.max(2.2, o.height), R = Math.max(1.4, o.radius), d = clamp(o.distort, 0, 1);
  const s = o.outdoor ? clamp(H / 3.2, 1.5, 3.5) : clamp((H - 0.2) / 2.3, 0.85, 1.4);
  const dw = 0.9 * s, dh = 2.05 * s, fr = 0.06 * s;
  parts.push({ prim: 'cylinder', mat: 'marbleFloor', pos: [0, 0.015, 0], size: [R * 0.98, 0.03, R * 0.98] });
  const n = rng.int(5, 8);
  const rr = Math.max(dw * 0.9, R * 0.72);
  const floatIdx = rng.int(0, n - 1), tiltIdx = (floatIdx + rng.int(1, n - 1)) % n;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.float(-0.15, 0.15);
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    // 扉は中心を向く（ローカル −Z が中心方向）
    const yaw = Math.atan2(cx, cz);
    const lift = i === floatIdx ? Math.min(rng.float(0.4, 1.2) * s, Math.max(0, H - dh - fr - 0.1)) : 0;
    const roll = i === tiltIdx ? rng.float(0.12, 0.3) * (rng.chance(0.5) ? 1 : -1) * (0.5 + d) : 0;
    const door: MonumentPart[] = [
      { prim: 'box', mat: 'trim', pos: [-dw / 2 - fr / 2, dh / 2, 0], size: [fr, dh + fr, fr * 1.6] },
      { prim: 'box', mat: 'trim', pos: [dw / 2 + fr / 2, dh / 2, 0], size: [fr, dh + fr, fr * 1.6] },
      { prim: 'box', mat: 'trim', pos: [0, dh + fr / 2, 0], size: [dw + fr * 2, fr, fr * 1.6] },
    ];
    const open = rng.chance(0.45) ? rng.float(0.5, 1.6) : 0;
    const panel: MonumentPart[] = [
      { prim: 'box', mat: 'doorWood', pos: [dw / 2, dh / 2, 0], size: [dw - 0.01, dh - 0.01, 0.045 * s] },
      { prim: 'sphere', mat: 'goldTrim', pos: [dw * 0.88, dh * 0.47, -0.05 * s], size: [0.032 * s, 0, 0] },
    ];
    // 蝶番（左の枠）を軸に開く
    door.push(...placeGroup(panel, [0, open, 0], [-dw / 2, 0, 0]));
    // 開いた扉の奥（材質の置き換えで金属の板になる）
    if (open > 0 || rng.chance(0.3)) door.push({ prim: 'plate', mat: rng.chance(0.7) ? 'lightWarm' : 'neonBlue', pos: [0, dh / 2, 0.03 * s], size: [dw * 0.98, dh * 0.98, 0.01] });
    parts.push(...placeGroup(door, [0, yaw, roll], [cx, lift, cz]));
    if (!lift && Math.abs(roll) < 0.01) {
      const hw = dw / 2 + fr;
      const ext = Math.abs(Math.cos(yaw)) * hw + Math.abs(Math.sin(yaw)) * fr, exz = Math.abs(Math.sin(yaw)) * hw + Math.abs(Math.cos(yaw)) * fr;
      colliders.push(aabb([cx - ext, 0, cz - exz], [cx + ext, Math.min(2.2, dh), cz + exz], 'trim'));
    }
  }
  // 中央: 床に寝かせた扉と、隙間から漏れる光
  const floor: MonumentPart[] = [
    { prim: 'box', mat: 'trim', pos: [0, 0.03, 0], size: [dw + fr * 2, 0.06, dh + fr * 2] },
    { prim: 'box', mat: 'doorWood', pos: [0, 0.07, 0], rot: [rng.float(0.05, 0.15), 0, 0], size: [dw, 0.045 * s, dh] },
    { prim: 'plate', mat: 'lightWarm', pos: [0, 0.055, 0], rot: [Math.PI / 2, 0, 0], size: [dw * 0.98, dh * 0.98, 0.01] },
  ];
  parts.push(...placeGroup(floor, [0, rng.float(0, Math.PI), 0], [0, 0, 0]));
  signs.push({ text: pickOf(rng, ['NO ENTRY / NO EXIT', 'KNOCK ONCE', 'ALL DOORS LEAD HERE']), pos: [0, 0.2, -rr - 0.4], face: 0, width: 1.1 });
  return { parts, colliders, signs };
}

// ---------------------------------------------------------------- lampGrove 街灯の林（灯体は材質の置き換えで金属）
export function buildLampGrove(rng: Rng, o: MonumentOptions): MonumentBuild {
  const parts: MonumentPart[] = [], colliders: Box[] = [], signs: MonumentSign[] = [];
  const H = Math.max(2.2, o.height), R = Math.max(1.2, o.radius), d = clamp(o.distort, 0, 1);
  const s = o.outdoor ? rng.float(1.2, 1.8) : 1;
  const n = rng.int(6, 11);
  const spots: [number, number][] = [];
  const heads: Vec3[] = [];
  for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
    const a = rng.float(0, Math.PI * 2), r = R * Math.sqrt(rng.float(0, 1)) * 0.9;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (spots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 0.8 * s)) continue;
    spots.push([x, z]);
    i++;
    const pr = 0.05 * s;
    const h1 = H * rng.float(0.45, 0.92);
    const tx = rng.float(-1, 1) * 0.15 * H * d, tz = rng.float(-1, 1) * 0.15 * H * d;
    const top: Vec3 = [x + tx, h1, z + tz];
    parts.push({ prim: 'cylinder', mat: 'metalDark', pos: [x, 0.03, z], size: [0.2 * s, 0.06, 0.2 * s] });
    const p1 = rod([x, 0.06, z], top, pr, 'metalDark');
    if (p1) parts.push(p1);
    parts.push({ prim: 'sphere', mat: 'metalDark', pos: top, size: [pr * 1.6, 0, 0] });
    // 腕: 折れた先に灯体（下向き 6 割 / 上向き / 横向き）
    const ba = rng.float(0, Math.PI * 2), bl = rng.float(0.4, 1.3) * s, by = rng.float(-0.3, 0.5) * s;
    const head: Vec3 = [top[0] + Math.cos(ba) * bl, clamp(top[1] + by, 1.0, H - 0.2), top[2] + Math.sin(ba) * bl];
    const p2 = rod(top, head, pr * 0.8, 'metalDark');
    if (p2) parts.push(p2);
    const facing = rng.float(0, 1);
    const pitch = facing < 0.6 ? 0 : facing < 0.8 ? Math.PI : Math.PI / 2;
    const lamp: MonumentPart[] = [
      { prim: 'box', mat: 'metalDark', pos: [0, 0.07 * s, 0], size: [0.5 * s, 0.12 * s, 0.26 * s] },
      { prim: 'box', mat: rng.chance(0.5) ? 'stainless' : 'goldTrim', pos: [0, 0, 0], size: [0.44 * s, 0.02, 0.2 * s] },
    ];
    parts.push(...placeGroup(lamp, [pitch, ba, 0], head));
    heads.push(head);
    colliders.push(aabb([x - 0.12 * s, 0, z - 0.12 * s], [x + 0.12 * s, 2.2, z + 0.12 * s], 'metalDark'));
  }
  // 灯体どうしを垂れた電線で結ぶ
  for (let i = 0; i + 1 < heads.length && i < 5; i++) {
    const a = heads[i], b = heads[(i + 1 + rng.int(0, heads.length - 2)) % heads.length];
    const mid: Vec3 = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - rng.float(0.3, 0.9), (a[2] + b[2]) / 2];
    parts.push({ prim: 'tube', mat: 'rubber', pos: [0, 0, 0], size: [0.012 * s, 0, 0], path: [a, mid, b] });
  }
  signs.push({ text: pickOf(rng, ['STREET, UNKNOWN', 'LIGHTS OUT AT DAWN', 'KEEP TO THE LIT PATH']), pos: [0, 0.3, -R * 0.95], face: 0, width: 1.0 });
  return { parts, colliders, signs };
}

// ---------------------------------------------------------------- colossus 巨大モニュメント（広い部屋の中央）
/**
 * 遠くから一目で分かる輪郭を優先する: 階段付きの 3 段の基壇に、立てた巨大な円環の門（正面 −Z を向く）と、その中心に浮かぶ鏡面の球、
 * 門の背後の黒い尖塔（頂に赤い灯）、球の周りを傾いて巡る光輪 2 個、門の頂から床の錨へ張った綱、尖塔に巻き付く螺旋のネオン。
 * 基壇の脇に既存の文法 1 つ（立方体の群 / 色の積層 / 黒い石板 / 石の枢組み）を小さく添えて、近くで見たときの細部にする。
 * sub: 添える文法（index.ts の buildKind。循環 import を避けて引数で受ける）
 */
export function buildColossus(rng: Rng, o: MonumentOptions, sub: (kind: MonumentKind, rng: Rng, o: MonumentOptions) => MonumentBuild): MonumentBuild {
  const parts: MonumentPart[] = [], colliders: Box[] = [], signs: MonumentSign[] = [];
  const H = Math.max(6, o.height), R = Math.max(3, o.radius);
  // 基壇（3 段、正面に階段。階段は見た目だけ = 基壇の縁で止まる）
  let y = 0;
  const tierH = clamp(H * 0.03, 0.3, 0.6);
  const w0 = R * 1.6;
  for (let i = 0; i < 3; i++) {
    const w = w0 * (1 - i * 0.18);
    parts.push({ prim: i === 1 ? 'cylinder' : 'box', mat: i === 1 ? 'marbleFloor' : 'columnConcrete', pos: [0, y + tierH / 2, 0], size: i === 1 ? [w / 2, tierH, w / 2] : [w, tierH, w] });
    colliders.push(aabb([-w / 2, y, -w / 2], [w / 2, y + tierH, w / 2], 'columnConcrete'));
    y += tierH;
  }
  const baseTop = y;
  parts.push({ prim: 'stairs', mat: 'columnConcrete', pos: [0, 0, -w0 / 2 - baseTop * 1.4 / 2], size: [R * 0.7, baseTop, baseTop * 1.4] });
  // 門（立てた円環）: 基壇の上に接地させる。外径は高さの 0.42 倍か基壇の 0.95 倍の小さい方
  const avail = H - baseTop;
  const ringR = Math.min(R * 0.95, avail * 0.46);
  const tube = Math.max(0.12, ringR * 0.07);
  const ringY = baseTop + ringR + tube;
  const ringMat = pickOf(rng, ['marbleWhite', 'goldTrim', 'stainless'] as const);
  parts.push({ prim: 'ring', mat: ringMat, pos: [0, ringY, 0], size: [ringR, tube, 0] });
  // 内縁の発光の輪（暗い大空間で遠くから門の輪郭が光って見える）。前後 2 本
  for (const z of [-tube * 0.9, tube * 0.9]) parts.push({ prim: 'ring', mat: rng.chance(0.7) ? 'neonBlue' : 'neonRed', pos: [0, ringY, z], size: [ringR - tube * 0.9, Math.max(0.03, tube * 0.18), 0] });
  // 門の足元の台座（円環が点で立たないように、左右から挟む 2 つの塊）
  for (const sx of [-1, 1]) {
    const bw = tube * 3.2;
    parts.push({ prim: 'box', mat: 'columnConcrete', pos: [sx * tube * 2.2, baseTop + tube * 1.4, 0], size: [bw, tube * 2.8, tube * 3.2] });
  }
  colliders.push(aabb([-tube * 4, baseTop, -tube * 1.6], [tube * 4, baseTop + tube * 2.8, tube * 1.6], 'columnConcrete'));
  // 中心に浮かぶ球（鏡面か大理石）
  const sphR = ringR * rng.float(0.3, 0.42);
  parts.push({ prim: 'sphere', mat: rng.chance(0.6) ? 'stainless' : 'marbleWhite', pos: [0, ringY, 0], size: [sphR, 0, 0] });
  // 球を巡る光輪（傾いた細い輪）
  for (let i = 0; i < 2; i++) {
    const rr = sphR * rng.float(1.35, 1.8);
    parts.push({ prim: 'ring', mat: i === 0 ? 'neonBlue' : pickOf(rng, ['goldTrim', 'stainless'] as const), pos: [0, ringY, 0], rot: [Math.PI / 2 + rng.float(-0.6, 0.6), rng.float(0, Math.PI), rng.float(-0.5, 0.5)], size: [rr, Math.max(0.03, rr * 0.02), 0] });
  }
  // 背後の尖塔（黒い四角柱 + 頂の赤い灯）
  const spW = Math.max(0.4, R * 0.16), spZ = R * 0.55, spH = avail * rng.float(0.92, 1.0);
  parts.push({ prim: 'box', mat: 'screenDark', pos: [0, baseTop + spH / 2, spZ], rot: [0, Math.PI / 4, 0], size: [spW, spH, spW] });
  parts.push({ prim: 'cylinder', mat: 'screenDark', pos: [0, baseTop + spH + spW * 0.9, spZ], size: [spW * 0.7, spW * 1.8, 0] });
  parts.push({ prim: 'sphere', mat: 'neonRed', pos: [0, Math.min(H - 0.1, baseTop + spH + spW * 1.9), spZ], size: [Math.max(0.12, spW * 0.22), 0, 0] });
  colliders.push(aabb([-spW * 0.72, baseTop, spZ - spW * 0.72], [spW * 0.72, Math.min(2.2 + baseTop, baseTop + spH), spZ + spW * 0.72], 'screenDark'));
  // 螺旋のネオン（尖塔に巻き付く）
  const path: Vec3[] = [];
  const turns = rng.float(2.5, 4), n = 28;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * Math.PI * 2 * turns, rr = spW * 0.95;
    path.push([Math.cos(a) * rr, baseTop + 0.4 + t * (spH * 0.92 - 0.4), spZ + Math.sin(a) * rr]);
  }
  parts.push({ prim: 'tube', mat: rng.chance(0.5) ? 'neonBlue' : 'neonRed', pos: [0, 0, 0], size: [Math.max(0.025, spW * 0.04), 0, 0], path });
  // 門の頂と肩から床の錨へ張った綱
  const nTether = rng.int(4, 6);
  for (let i = 0; i < nTether; i++) {
    const a = (i / nTether) * Math.PI * 2 + rng.float(-0.2, 0.2);
    const ax = Math.cos(a) * R * 0.98, az = Math.sin(a) * R * 0.98;
    const anchor = Math.max(0.5, R * 0.08);
    parts.push({ prim: 'box', mat: 'metalDark', pos: [ax, anchor / 2, az], rot: [0, a, 0], size: [anchor, anchor, anchor] });
    colliders.push(aabb([ax - anchor * 0.72, 0, az - anchor * 0.72], [ax + anchor * 0.72, anchor, az + anchor * 0.72], 'metalDark'));
    const ta = Math.PI / 2 + (i % 2 === 0 ? 1 : -1) * rng.float(0.2, 0.9);
    const top: Vec3 = [Math.cos(ta) * ringR, ringY + Math.sin(ta) * ringR, 0];
    const t = rod([ax, anchor, az], top, Math.max(0.025, R * 0.006), rng.chance(0.3) ? 'neonBlue' : 'metalDark');
    if (t) parts.push(t);
  }
  // 添える文法（基壇の脇、正面から見て左か右）
  const sideKind = pickOf(rng, ['cubeCluster', 'colorStack', 'monolith', 'stoneFrame'] as const);
  const side = sub(sideKind, rng.fork('side'), { height: Math.min(avail * 0.4, 9), radius: R * 0.28, outdoor: true, distort: o.distort });
  const sx = (rng.chance(0.5) ? 1 : -1) * R * 0.52, sz = -R * 0.18;
  for (const p of side.parts) parts.push({ ...p, pos: [p.pos[0] + sx, p.pos[1] + baseTop, p.pos[2] + sz], path: p.path?.map((c) => [c[0], c[1], c[2]] as Vec3) });
  for (const b of side.colliders ?? []) colliders.push(aabb([b.min[0] + sx, b.min[1] + baseTop, b.min[2] + sz], [b.max[0] + sx, b.max[1] + baseTop, b.max[2] + sz], b.mat));
  signs.push({ text: pickOf(rng, ['THE CENTER OF NOWHERE', 'MONUMENT TO THE WAITING', 'IT WAS ALWAYS HERE', 'YOU ARE NEARER NOW']), sub: pickOf(rng, ['ERECTED BY NO ONE', 'DEDICATED TO THE HALLWAY', 'KEEP WALKING']), pos: [0, baseTop * 0.5, -w0 / 2 - 0.02], face: 0, width: Math.min(4, R * 0.8) });
  return { parts, colliders, signs };
}
