/**
 * ExternalForce — 動く床 / 風（U03 無人エスカレーター conveyor 0.8 / R18 密閉風洞廊下 wind 2.5 / L15 屋内高速道路 conveyor 6.0）。
 * params: mode('conveyor' | 'wind'), speed(m/s), vector([x,y,z] 部屋ローカル。省略時は進行軸 = entry → 最初の出口の主軸、無ければ +Z),
 *         lanes(conveyor の帯の本数。既定: speed ≥ 4 で 2、他 1), laneWidth(m。既定: speed ≥ 4 で 3.5、他 1.0)。
 *
 * layout（決定論）:
 *   - wind: 部屋全体（bounds）を 1 つの force ゾーンにする（風は空中にも作用する。PlayerController が vector×speed を外力に加算）。
 *   - conveyor: Generator が kind 'lane'（vector 付き）のゾーンを出していればそれを force ゾーンに写す（StreetGenerator 本実装向け）。
 *       無ければ主矩形の中に進行軸に沿った帯（レーン）を置き、帯ごとに force ゾーンを出す。2 本のときは隣接する帯を逆向きにする（L15 の上下線）。
 *       帯は端壁の手前で切る（speed ≥ 3 なら 3 m、他 0.8 m。6 m/s で壁に叩きつけないため）。1 本のときは入口の正面に置く（入口が端壁にあれば）。
 *       見た目: 床上の暗いベルト箔（'rubber'）+ 縁の帯（speed < 2 は 'ledBlue' の発光縁 = エスカレーター、他は 'yellowLine' = 車線）。
 *       帯に重なる内装のソリッド（柱・間仕切り・家具）は取り除く。U03 では停止した装飾ベルトを 1 本並べ、帯に沿った青い照明を足す。
 *   ゾーン: { kind: 'force', aabb, vector（ローカル）, params: { speed, mode, lane } }。RoomBuilder が yaw で回してワールド化する。
 * build: conveyor の帯に「流れる」ベルト面を置く（速さごとに 1 メッシュへ結合。自前の CanvasTexture のスラット模様を毎フレーム UV オフセットで流す。
 *   ジオメトリは増やさずテクスチャのオフセットだけ動かす。RoomEffect として built.effects へ）。
 *   U03 は生成側（dressing/uncommon.ts u03Belts）が動く歩道の網を kind 'lane'（clearSolids）で出し、ここで force ゾーンに写して帯の上を空ける。
 * onEnter / onExit: 風音（'wind' / 'windStrong'）またはベルト駆動音（'conveyor'）のループ。
 * onConnect: R18「風向と逆方向ほどレア出口率上昇」は抽選バイアスの拡張点のみ（upwind を計算するが指示は返さない。v1 では実装しない）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AABB } from '../../core/aabb';
import { dirVec, type Vec3 } from '../../core/types';
import { inner, type Rect } from '../../generators/footprint';
import { box, WALL_T, type Box, type RoomLayout, type Zone } from '../../generators/layout';
import type { RoomEffect } from '../../render/RoomBuilder';
import type { AudioEngineLike, ModifierImpl } from '../types';
import { num, progressAxis, str, vec3 } from '../util';

/** スラット模様のピッチ（m） */
const SLAT_PITCH = 0.4;
const BELT_Y = 0.02;
const ZONE_Y0 = -0.2;
const ZONE_Y1 = 1.2;

interface LaneSpec {
  /** 帯の矩形（ローカル XZ） */
  rect: Rect;
  /** 進行方向（ローカル単位ベクトル） */
  vector: Vec3;
  lane: number;
}

/** 部屋ごとのループ音（onEnter で開始、onExit で停止） */
const loops = new Map<string, ReturnType<AudioEngineLike['play']>>();

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n < 1e-6 ? [0, 0, 1] : [v[0] / n, v[1] / n, v[2] / n];
}

/** 力の方向（ローカル）。params.vector → 進行軸（entry → 出口）の主軸 → +Z */
function forceVector(L: RoomLayout, params: Record<string, unknown>): Vec3 {
  const v = vec3(params.vector, [0, 0, 0]);
  if (Math.hypot(v[0], v[1], v[2]) > 1e-6) return normalize(v);
  const axis = progressAxis(L);
  if (axis) {
    const dx = axis.to[0] - axis.from[0];
    const dz = axis.to[2] - axis.from[2];
    if (Math.abs(dx) > 0.5 || Math.abs(dz) > 0.5) return Math.abs(dz) >= Math.abs(dx) ? [0, 0, Math.sign(dz)] : [Math.sign(dx), 0, 0];
  }
  return [0, 0, 1];
}

function zoneOf(rect: Rect, vector: Vec3, speed: number, mode: string, lane: number): Zone {
  const aabb: AABB = { min: [rect.x0, ZONE_Y0, rect.z0], max: [rect.x1, ZONE_Y1, rect.z1] };
  return { kind: 'force', aabb, vector, params: { speed, mode, lane } };
}

function overlapsRect(b: Box, r: Rect, eps = 0.05): boolean {
  return b.min[0] < r.x1 - eps && b.max[0] > r.x0 + eps && b.min[2] < r.z1 - eps && b.max[2] > r.z0 + eps;
}

/** 進行軸に沿った帯（レーン）を主矩形の中に置く */
function planLanes(L: RoomLayout, vector: Vec3, speed: number, lanes: number, laneWidth: number): LaneSpec[] {
  const main = L.footprint[0];
  if (!main) return [];
  const ir = inner(main, WALL_T + 0.3);
  const alongX = Math.abs(vector[0]) > Math.abs(vector[2]);
  const endMargin = speed >= 3 ? 3.0 : 0.8;
  const a0 = (alongX ? ir.x0 : ir.z0) + endMargin;
  const a1 = (alongX ? ir.x1 : ir.z1) - endMargin;
  if (a1 - a0 < 4) return [];
  const c0 = alongX ? ir.z0 : ir.x0;
  const c1 = alongX ? ir.z1 : ir.x1;
  const total = laneWidth * lanes;
  if (c1 - c0 < total) return [];
  // 帯の中心（across）。1 本なら入口の正面（入口が端壁にあるとき）、それ以外は矩形の中央
  let center = (c0 + c1) / 2;
  if (lanes === 1) {
    const entry = L.sockets.find((s) => s.id === 'entry' && s.type !== 'hole');
    if (entry) {
      const d = dirVec(entry.dir);
      const onEndWall = alongX ? Math.abs(d[0]) > 0.5 : Math.abs(d[2]) > 0.5;
      if (onEndWall) center = alongX ? entry.pos[2] : entry.pos[0];
    }
  }
  center = Math.min(c1 - total / 2, Math.max(c0 + total / 2, center));
  const out: LaneSpec[] = [];
  for (let i = 0; i < lanes; i++) {
    const lo = center - total / 2 + i * laneWidth;
    const hi = lo + laneWidth;
    const rect: Rect = alongX ? { x0: a0, z0: lo, x1: a1, z1: hi } : { x0: lo, z0: a0, x1: hi, z1: a1 };
    // 偶数番は順方向、奇数番は逆方向（上下線）
    const sign = i % 2 === 0 ? 1 : -1;
    out.push({ rect, vector: [vector[0] * sign, 0, vector[2] * sign], lane: i });
  }
  return out;
}

/** ベルトの見た目（箔）。edgeMat が縁の材質 */
function beltBoxes(r: Rect, edgeMat: 'ledBlue' | 'yellowLine' | 'metal', moving: boolean): Box[] {
  const out: Box[] = [];
  out.push(box([r.x0, 0, r.z0], [r.x1, 0.015, r.z1], moving ? 'rubber' : 'furnitureDark', false));
  const e = edgeMat === 'ledBlue' ? 0.06 : 0.12;
  const alongX = r.x1 - r.x0 > r.z1 - r.z0;
  const y1 = edgeMat === 'ledBlue' ? 0.035 : 0.02;
  if (alongX) {
    out.push(box([r.x0, 0.005, r.z0], [r.x1, y1, r.z0 + e], edgeMat, false));
    out.push(box([r.x0, 0.005, r.z1 - e], [r.x1, y1, r.z1], edgeMat, false));
  } else {
    out.push(box([r.x0, 0.005, r.z0], [r.x0 + e, y1, r.z1], edgeMat, false));
    out.push(box([r.x1 - e, 0.005, r.z0], [r.x1, y1, r.z1], edgeMat, false));
  }
  return out;
}

/** 帯の上に立つソリッド内装（柱・間仕切り・家具）を取り除く（シェルは触らない。天井から吊るもの = 床から 1.5 m 以上は残す） */
function clearLanes(L: RoomLayout, lanes: LaneSpec[]): void {
  const shell = L.shellCount ?? 0;
  const keep: Box[] = L.boxes.slice(0, shell);
  for (const b of L.boxes.slice(shell)) {
    const standing = b.solid && b.min[1] < 1.5;
    if (standing && lanes.some((l) => overlapsRect(b, l.rect))) continue;
    keep.push(b);
  }
  L.boxes.length = 0;
  L.boxes.push(...keep);
}

// ---------------------------------------------------------------- build: 流れるベルト面

/** スラット模様（横縞）の CanvasTexture。1 タイル = 1 スラット */
function slatTexture(glow: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = glow ? '#5a6266' : '#3a3c3a';
  g.fillRect(0, 0, 32, 64);
  // 溝（暗い帯）と稜線（明るい線）
  g.fillStyle = glow ? '#2c3336' : '#1e201e';
  g.fillRect(0, 0, 32, 10);
  g.fillStyle = glow ? '#8fa3a8' : '#5d615d';
  g.fillRect(0, 10, 32, 3);
  // 縦の細い筋（ベルトの継ぎ目）
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 帯の四角形（法線 +Y）。uv の v が vector の向きに増える */
function beltGeometry(r: Rect, vector: Vec3): THREE.BufferGeometry {
  const alongX = Math.abs(vector[0]) > Math.abs(vector[2]);
  const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
  const sign = alongX ? Math.sign(vector[0]) : Math.sign(vector[2]);
  const vMax = len / SLAT_PITCH;
  // 4 頂点: (x0,z0) (x1,z0) (x1,z1) (x0,z1)
  const px = [r.x0, r.x1, r.x1, r.x0];
  const pz = [r.z0, r.z0, r.z1, r.z1];
  const pos = new Float32Array(12);
  const nrm = new Float32Array(12);
  const uv = new Float32Array(8);
  for (let i = 0; i < 4; i++) {
    pos[i * 3] = px[i]; pos[i * 3 + 1] = BELT_Y; pos[i * 3 + 2] = pz[i];
    nrm[i * 3 + 1] = 1;
    const along = alongX ? (px[i] - r.x0) / len : (pz[i] - r.z0) / len;
    const across = alongX ? (pz[i] - r.z0) / (r.z1 - r.z0) : (px[i] - r.x0) / (r.x1 - r.x0);
    uv[i * 2] = across;
    uv[i * 2 + 1] = (sign > 0 ? along : 1 - along) * vMax;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // 上から見て反時計回り（法線 +Y）
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeBoundingSphere();
  return g;
}

/** 曲がる床（U03 u03Belts）: 内側の角 center、入る向き a、出る向き b、回る向き ccw（+1 = x → z 回り）、マスの一辺 */
interface TurnSpec { center: [number, number]; a: [number, number]; b: [number, number]; ccw: number; cell: number }

/**
 * 曲がる床の扇形のベルト面（半径 0.05〜0.95 マス = 直線の帯の幅と揃える、角度 90° を 10 分割）。
 * uv の v は流れの向きに増える（中央の半径の弧長 / SLAT_PITCH）ので、直線の帯と同じオフセットで同じ速さに流れる。スラットは放射状
 */
function turnGeometry(t: TurnSpec): THREE.BufferGeometry {
  const [cx, cz] = t.center;
  const mid = (d: [number, number], sgn: number): [number, number] => {
    // 入る辺 / 出る辺の中点（マスの中心 = 中心 + (a − b) / 2 × cell の逆算）
    const mx = cx + (t.a[0] - t.b[0]) * t.cell / 2, mz = cz + (t.a[1] - t.b[1]) * t.cell / 2;
    return [mx + sgn * d[0] * t.cell / 2, mz + sgn * d[1] * t.cell / 2];
  };
  const e = mid(t.a, -1), x = mid(t.b, 1);
  const th0 = Math.atan2(e[1] - cz, e[0] - cx);
  let th1 = Math.atan2(x[1] - cz, x[0] - cx);
  // ccw = +1 は角度が増える向き（(x, z) → (−z, x)）
  while (t.ccw > 0 ? th1 <= th0 : th1 >= th0) th1 += t.ccw > 0 ? Math.PI * 2 : -Math.PI * 2;
  const segs = 10, r0 = 0.05 * t.cell, r1 = 0.95 * t.cell;
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [];
  const vert = (th: number, r: number, k: number) => {
    pos.push(cx + Math.cos(th) * r, BELT_Y, cz + Math.sin(th) * r);
    nrm.push(0, 1, 0);
    uv.push((r - r0) / (r1 - r0), (k / segs) * (Math.PI / 2) * (t.cell / 2) / SLAT_PITCH);
  };
  for (let k = 0; k <= segs; k++) { const th = th0 + (th1 - th0) * (k / segs); vert(th, r0, k); vert(th, r1, k); }
  const idx: number[] = [];
  for (let k = 0; k < segs; k++) {
    const a = k * 2, b = a + 1, c2 = a + 2, d = a + 3;
    // 上向き（+Y）の面になる巻き順を選ぶ
    const p = (i: number) => [pos[i * 3], pos[i * 3 + 2]];
    const [ax, az] = p(a), [bx, bz] = p(b), [cx2, cz2] = p(c2);
    const up = (bx - ax) * (cz2 - az) - (bz - az) * (cx2 - ax) < 0;
    if (up) idx.push(a, b, c2, b, d, c2); else idx.push(a, c2, b, b, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * 曲がる床の両縁の発光帯（直線の帯の縁と同じ幅 5 cm・高さ 3.5 cm の弧。上面と内外の側面）。半径 0.05〜0.10 と 0.90〜0.95 マス
 */
function turnEdgeGeometry(t: TurnSpec): THREE.BufferGeometry {
  const [cx, cz] = t.center;
  const mx = cx + (t.a[0] - t.b[0]) * t.cell / 2, mz = cz + (t.a[1] - t.b[1]) * t.cell / 2;
  const e: [number, number] = [mx - t.a[0] * t.cell / 2, mz - t.a[1] * t.cell / 2];
  const x: [number, number] = [mx + t.b[0] * t.cell / 2, mz + t.b[1] * t.cell / 2];
  const th0 = Math.atan2(e[1] - cz, e[0] - cx);
  let th1 = Math.atan2(x[1] - cz, x[0] - cx);
  while (t.ccw > 0 ? th1 <= th0 : th1 >= th0) th1 += t.ccw > 0 ? Math.PI * 2 : -Math.PI * 2;
  const segs = 12, y0 = 0.005, y1 = 0.035;
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  const quad = (p: number[][], n: number[]) => {
    const b = pos.length / 3;
    for (const q of p) { pos.push(q[0], q[1], q[2]); nrm.push(n[0], n[1], n[2]); uv.push(0, 0); }
    // 法線 n の側から見て表になる巻き順
    const [a, bb, c] = p;
    const ux = bb[0] - a[0], uy = bb[1] - a[1], uz = bb[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cxp = uy * vz - uz * vy, cyp = uz * vx - ux * vz, czp = ux * vy - uy * vx;
    if (cxp * n[0] + cyp * n[1] + czp * n[2] >= 0) idx.push(b, b + 1, b + 2, b, b + 2, b + 3); else idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  };
  for (const [ra, rb] of [[0.05, 0.1], [0.9, 0.95]]) {
    const r0 = ra * t.cell, r1 = rb * t.cell;
    for (let k = 0; k < segs; k++) {
      const a0 = th0 + (th1 - th0) * (k / segs), a1 = th0 + (th1 - th0) * ((k + 1) / segs);
      const P = (r: number, a: number, y: number) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      quad([P(r0, a0, y1), P(r1, a0, y1), P(r1, a1, y1), P(r0, a1, y1)], [0, 1, 0]);
      const mid = (a0 + a1) / 2;
      quad([P(r1, a0, y0), P(r1, a1, y0), P(r1, a1, y1), P(r1, a0, y1)], [Math.cos(mid), 0, Math.sin(mid)]);
      quad([P(r0, a0, y0), P(r0, a0, y1), P(r0, a1, y1), P(r0, a1, y0)], [-Math.cos(mid), 0, -Math.sin(mid)]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const ExternalForce: ModifierImpl = {
  id: 'ExternalForce',
  defaults: { mode: 'wind', speed: 1.0 },

  layout(L, p, params) {
    const mode = str(params.mode, 'wind');
    const speed = Math.max(0, num(params.speed, 1));
    if (speed <= 0) return;
    const vector = forceVector(L, params);
    L.zones ??= [];
    if (mode !== 'conveyor') {
      const b = L.bounds;
      L.zones.push({ kind: 'force', aabb: { min: [b.min[0], ZONE_Y0 - 0.1, b.min[2]], max: [b.max[0], L.height + 0.5, b.max[2]] }, vector, params: { speed, mode: 'wind' } });
      return;
    }
    const escalator = speed < 2;
    // Generator が車線（kind 'lane' + vector。StreetGenerator RoadGraph の受け渡し）を出していればそれを force ゾーンに写す（形は Generator、挙動は Modifier）
    const laneZones = L.zones.filter((z) => z.kind === 'lane' && z.vector && Math.hypot(z.vector[0], z.vector[2]) > 1e-6);
    if (laneZones.length > 0) {
      laneZones.forEach((z, i) => {
        const v = normalize([z.vector![0], 0, z.vector![2]]);
        // 曲がる床（U03）: turn は見た目の扇形（力は 0 = speed 0）、noBelt は力だけの小区画（ベルト面を描かない）
        const lane = z.params?.noBelt ? -1 : i;
        L.zones!.push({ kind: 'force', aabb: { min: [z.aabb.min[0], ZONE_Y0, z.aabb.min[2]], max: [z.aabb.max[0], ZONE_Y1, z.aabb.max[2]] }, vector: v, params: { speed: num(z.params?.speed, speed), mode: 'conveyor', lane, turn: z.params?.turn, beltSpeed: z.params?.beltSpeed } });
      });
      // 生成側が帯の上を空けるよう求めた車線（U03 の動く歩道の網）: 後段（奇妙さ生成など）が置いたソリッドを取り除く
      const clear = laneZones.filter((z) => z.params?.clearSolids);
      if (clear.length) clearLanes(L, clear.map((z, i) => ({ rect: { x0: z.aabb.min[0], z0: z.aabb.min[2], x1: z.aabb.max[0], z1: z.aabb.max[2] }, vector: [0, 0, 1] as Vec3, lane: i })));
      return;
    }
    const lanes = Math.max(1, Math.min(4, Math.round(num(params.lanes, speed >= 4 ? 2 : 1))));
    const laneWidth = Math.max(0.6, num(params.laneWidth, speed >= 4 ? 3.5 : 1.0));
    const specs = planLanes(L, vector, speed, lanes, laneWidth);
    if (specs.length === 0) return;
    clearLanes(L, specs);
    for (const s of specs) {
      L.zones.push(zoneOf(s.rect, s.vector, speed, 'conveyor', s.lane));
      L.boxes.push(...beltBoxes(s.rect, escalator ? 'ledBlue' : 'yellowLine', true));
    }
    if (escalator && p.def.id === 'U03') {
      // 停止した装飾エスカレーター（ゾーン無し）を隣に 1 本。空きが無ければ置かない
      const r = specs[0].rect;
      const alongX = r.x1 - r.x0 > r.z1 - r.z0;
      const ir = inner(L.footprint[0], WALL_T + 0.3);
      const gap = 1.5;
      const w = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
      const cand: Rect[] = alongX
        ? [{ x0: r.x0, z0: r.z1 + gap, x1: r.x1, z1: r.z1 + gap + w }, { x0: r.x0, z0: r.z0 - gap - w, x1: r.x1, z1: r.z0 - gap }]
        : [{ x0: r.x1 + gap, z0: r.z0, x1: r.x1 + gap + w, z1: r.z1 }, { x0: r.x0 - gap - w, z0: r.z0, x1: r.x0 - gap, z1: r.z1 }];
      const fits = (c: Rect) => c.x0 >= ir.x0 && c.x1 <= ir.x1 && c.z0 >= ir.z0 && c.z1 <= ir.z1
        && !L.sockets.some((s) => s.pos[0] > c.x0 - 1 && s.pos[0] < c.x1 + 1 && s.pos[2] > c.z0 - 1 && s.pos[2] < c.z1 + 1);
      const dec = cand.find(fits);
      if (dec) {
        clearLanes(L, [{ rect: dec, vector, lane: -1 }]);
        L.boxes.push(...beltBoxes(dec, 'metal', false));
      }
      // 帯に沿った青い照明（「周囲暗転、エスカレーターのみ点灯」）
      const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
      const n = Math.min(3, Math.max(1, Math.floor(len / 8)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const pos: Vec3 = alongX ? [r.x0 + t * len, 2.2, (r.z0 + r.z1) / 2] : [(r.x0 + r.x1) / 2, 2.2, r.z0 + t * len];
        L.lights.push({ pos, color: 0x79b9cf, intensity: 0.6, distance: 7 });
      }
    }
  },

  build(built, L, ctx) {
    const lanes = (L.zones ?? []).filter((z) => z.kind === 'force' && z.params?.mode === 'conveyor' && typeof z.params?.lane === 'number' && (z.params.lane as number) >= 0 && z.vector);
    if (lanes.length === 0) return;
    // 帯は速さごとに 1 枚のメッシュへ結合し、テクスチャ 1 枚のオフセットで流す（uv の v は各帯の vector の向きに増えるので、
    // 同じオフセットでも帯ごとの向きに流れる。U03 の網は帯が数十本あるので、帯ごとのメッシュ・材質では描画呼び出しが増えすぎる）
    const bySpeed = new Map<number, THREE.BufferGeometry[]>();
    for (const z of lanes) {
      const sp = Math.round(num(z.params?.beltSpeed, num(z.params?.speed, 1)) * 100) / 100;
      const r: Rect = { x0: z.aabb.min[0], z0: z.aabb.min[2], x1: z.aabb.max[0], z1: z.aabb.max[2] };
      const turn = z.params?.turn as TurnSpec | undefined;
      (bySpeed.get(sp) ?? bySpeed.set(sp, []).get(sp)!).push(turn ? turnGeometry(turn) : beltGeometry(r, z.vector!));
    }
    // 曲がる床の両縁の発光帯（直線の帯の縁の箱と同じ ledBlue の材質。1 メッシュに結合）
    const edges = lanes.map((z) => z.params?.turn as TurnSpec | undefined).filter((t): t is TurnSpec => !!t).map(turnEdgeGeometry);
    if (edges.length) {
      const eg = edges.length === 1 ? edges[0] : mergeGeometries(edges, false);
      if (edges.length > 1) for (const g of edges) g.dispose();
      if (eg) {
        eg.computeBoundingSphere();
        const mesh = new THREE.Mesh(eg, ctx.materials.get('ledBlue'));
        mesh.name = 'belt/turn-edges';
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        built.group.add(mesh);
      }
    }
    const items: { tex: THREE.Texture; rate: number }[] = [];
    let base: THREE.CanvasTexture | null = null;
    for (const [speed, geos] of bySpeed) {
      const escalator = speed < 2;
      if (!base) base = slatTexture(escalator);
      const tex = items.length === 0 ? base : base.clone();
      tex.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({
        map: tex, color: 0xffffff, roughness: 0.75, metalness: 0.25,
        emissive: escalator ? 0x33555c : 0x000000, emissiveMap: escalator ? tex : null, emissiveIntensity: escalator ? 0.35 : 0,
      });
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) for (const g of geos) g.dispose();
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `belt/${speed}`;
      mesh.userData.disposable = [mat, tex];
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      built.group.add(mesh);
      items.push({ tex, rate: speed / SLAT_PITCH });
    }
    // uv の v は常に vector の向きに増えるので、オフセットを減らせば模様が vector の向きへ流れる
    const effect: RoomEffect = {
      update(dt) {
        for (const it of items) it.tex.offset.y = (it.tex.offset.y - it.rate * dt) % 1;
      },
      dispose() { /* material / texture は RoomBuilder.dispose の traverse（userData.disposable）で解放 */ },
    };
    built.effects.push(effect);
  },

  onEnter(ctx, params) {
    const audio = ctx.audio;
    if (!audio) return;
    const mode = str(params.mode, 'wind');
    const speed = num(params.speed, 1);
    const prev = loops.get(ctx.node.roomId);
    if (prev?.active) return;
    const kind = mode === 'conveyor' ? 'conveyor' : speed >= 2 ? 'windStrong' : 'wind';
    const gain = mode === 'conveyor' ? Math.min(0.8, 0.35 + speed * 0.06) : Math.min(0.9, 0.4 + speed * 0.15);
    loops.set(ctx.node.roomId, audio.play(kind, { loop: true, gain, roomId: ctx.node.roomId }));
  },

  onExit(ctx) {
    const h = loops.get(ctx.node.roomId);
    if (h) {
      h.stop(1.0);
      loops.delete(ctx.node.roomId);
    }
  },

  onConnect(ctx) {
    // R18「風向と逆方向ほどレア出口率上昇」の拡張点。upwind（扉が風上を向く）を判定するが、
    // 接続抽選のレア度バイアス（PickOptions.bias）は v1.3 決定 D25 で実装しないため指示は返さない。
    const z = ctx.world.layoutFor(ctx.node).zones?.find((x) => x.kind === 'force' && x.params?.mode === 'wind' && x.vector);
    if (!z?.vector) return;
    const d = dirVec(ctx.socket.dir);
    const upwind = d[0] * z.vector[0] + d[2] * z.vector[2] < -0.5;
    void upwind;
    return;
  },
};

export default ExternalForce;
