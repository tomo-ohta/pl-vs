import * as THREE from 'three';
import { Prop } from '../../props/kit.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { BALC, CAM0, CAM1, CH, CORR, ESC, FL, STAIR, T_EXT, WC, XN, Z_EAST } from './layout.ts';
import type { V3 } from '../../scenes/Builder.ts';
import { PAL, propSink, type Mats } from './mats.ts';
import { schoolChair } from './props/school.ts';
import { bucketMop, planter } from './props/extra.ts';
import { acUnit } from './props/fixtures.ts';
import { levelMats, levelZone, wallRects, type Env, type RectHole } from './shell.ts';

/**
 * 便所の塔（階段室の東）と、西の端の外の避難階段（北西の角の鉄の階段）と 2・3 階の西のバルコニー。
 * 階段室は stairwell.ts
 */

/** 避難階段の段（階段室と同じ蹴上げ・踏面） */
const RISE = 1.8;
const TREAD = 0.28;
const RUN = 11 * TREAD;

/**
 * 便所の塔（階段室の東。中は鍵）: 外の壁（北と東）・小さな型板ガラスの窓・屋根・各階の床（外から窓の奥が暗く見える）・廊下側の鍵の扉
 */
export function buildWcTower(env: Env): void {
  const { b, mats } = env;
  const [wx0, wz0, wx1, wz1] = [XN + T_EXT, STAIR[3] + T_EXT, STAIR[2], WC[3]];
  for (let lv = 1; lv <= 3; lv++) {
    const fl = FL[lv - 1];
    const lm = levelMats(mats, levelZone(lv));
    const holes: RectHole[] = [{ u0: wz0 + 1.0, u1: wz0 + 1.6, y0: fl + 1.5, y1: fl + 2.2 }, { u0: wz1 - 1.6, u1: wz1 - 1.0, y0: fl + 1.5, y1: fl + 2.2 }];
    wallRects(b, lm.ext, 'z', wx1 + T_EXT / 2, wz0 - T_EXT, wz1 + T_EXT, fl, fl + 3.6, T_EXT, holes);
    wallRects(b, lm.ext, 'x', wz1 + T_EXT / 2, XN, wx1 + T_EXT, fl, fl + 3.6, T_EXT, []);
    for (const h of holes) b.plane(lm.frosted, [wx1 + T_EXT / 2, (h.y0 + h.y1) / 2, (h.u0 + h.u1) / 2], h.u1 - h.u0, h.y1 - h.y0, 'x', { shadow: false });
    b.boxMM(lm.dark, [wx0, fl - 0.3, wz0], [wx1, fl, wz1], { shadow: 'receive' });
    if (lv >= 2) {
      // 廊下側の扉（鍵）: 便所の札
      const z = WC[1] + 1.2;
      const x = XN + T_EXT / 2;
      b.boxMM(lm.frame, [x - 0.14, fl, z - 0.48], [x + 0.14, fl + 2.06, z - 0.43], { shadow: true });
      b.boxMM(lm.frame, [x - 0.14, fl, z + 0.43], [x + 0.14, fl + 2.06, z + 0.48], { shadow: true });
      b.boxMM(lm.frame, [x - 0.14, fl + 2.0, z - 0.48], [x + 0.14, fl + 2.06, z + 0.48], { shadow: true });
      const door = mats.get(levelZone(lv), levelZone(lv) === 'deep' ? '#4f86a0' : '#2f7a86', { key: 'wcdoor' });
      b.boxMM(door, [x - 0.025, fl, z - 0.43], [x + 0.025, fl + 2.0, z + 0.43], { collide: true, shadow: true });
      b.boxMM(lm.base, [x - 0.07, fl + 0.95, z - 0.35], [x - 0.025, fl + 1.0, z - 0.25], { shadow: false });
      const plate = mats.get(levelZone(lv), '#cfe6e6', { key: 'plate' });
      b.boxMM(plate, [x - 0.15, fl + 1.5, z - 0.12], [x - 0.13, fl + 1.75, z + 0.12], { shadow: 'receive' });
    }
  }
  b.boxMM(levelMats(mats, 'shallow').ext, [wx0 - 0.1, FL[3] - 0.3, wz0 - 0.2], [wx1 + T_EXT, FL[3], wz1 + T_EXT], { shadow: true });
}

// ---------------------------------------------------------------- 西のバルコニーと外の避難階段

/**
 * 2・3 階の西のバルコニー（建物の西の面に沿う。手すりの壁と笠木）と、南西の角の外の避難階段（鉄の段・踊り場・手すり）。
 * 避難階段: 1 階（崖の上の地面）→ 2 階 → 3 階。地面の口は鍵の門（行き止まり）
 */
export function buildBalconies(env: Env): void {
  const { b, mats } = env;
  const [bx0, bz0, , bz1] = BALC;
  const [ex0, ez0, ex1] = ESC;
  const steel = mats.get('deep', '#4f86a0', { key: 'esteel' });
  const tread = mats.get('deep', '#6aa8c0', { key: 'etread', tiles: { size: [0.06, 0.06], line: 0.012, color: '#2f5a70' } });
  // 避難階段の 2 本の段: 1 本目は西（-z）へ上る（x = xa）、2 本目は東へ上ってバルコニーへ（x = xb）
  const w = 1.05;
  const xa = ex0 + 0.1 + w / 2;
  const xb = ex1 - 0.1 - w / 2;
  for (const lv of [2, 3] as const) {
    const fl = FL[lv - 1];
    const lm = levelMats(mats, levelZone(lv));
    // 床（建物の西の面に沿うバルコニー + 北の避難階段の上の踊り場）
    b.boxMM(lm.floorCorr, [bx0, fl - 0.2, bz0], [ex1, fl, bz1], { collide: true, shadow: true });
    // 手すりの壁（西の縁 z = bz0。避難階段の口の手前まで）と笠木（面に斑の模様は描かない: 色は部材ごと）
    b.boxMM(lm.ext, [bx0, fl, bz0 - 0.12], [ex0, fl + 1.05, bz0], { collide: true, shadow: true });
    const P = PAL[levelZone(lv)];
    b.boxMM(lm.sill, [bx0, fl + 1.05, bz0 - 0.15], [ex0, fl + 1.1, bz0 + 0.03], { shadow: true });
    // バルコニーの物（決まり: 手すりの壁に沿って枯れた鉢、廊下の扉の脇にバケツとモップ、古い椅子の山）
    const pm = mats.props(levelZone(lv));
    const sink = propSink(b, env.ctx);
    for (let x = 2.8 + lv * 0.7; x < CORR[0] - 1.0; x += 2.6) planter(Prop.at(sink, pm, [x, fl, bz0 + 0.25], 0, 70 + Math.round(x * 10)), { dead: (x * 3) % 2 > 1 });
    bucketMop(Prop.at(sink, pm, [CORR[1] - 0.3, fl, bz1 - 0.25], 0.4, 80 + lv));
    if (lv === 3) for (let k = 0; k < 4; k++) schoolChair(Prop.at(sink, pm, [6.25 + (k % 2) * 0.05, fl + k * 0.06, bz1 - 0.22], Math.PI + k * 0.05, 90 + k), { seat: P.seat, frame: P.deskFrame });
    // 南の端の手すりの壁（建物の南西の角）
    b.boxMM(lm.ext, [bx0, fl, bz0], [bx0 + 0.12, fl + 1.05, bz1], { collide: true, shadow: true });
    balconyParts(env, lv);
    // 天井（上の階のバルコニーの裏）
    b.boxMM(lm.ext, [bx0, fl + 3.4, bz0], [ex1, fl + 3.6 - 0.2, bz1], { shadow: true });
    // 北の端（x = ex1）と、建物より北の東の縁（z = bz1。建物の北の地面へ落ちない）
    railing(b, steel, [ex1, fl, bz0], [ex1, fl, bz1]);
    railing(b, steel, [XN + T_EXT + 0.02, fl, bz1 - 0.03], [ex1, fl, bz1 - 0.03]);
  }
  b.boxMM(levelMats(mats, 'shallow').ext, [bx0 - 0.1, FL[3] - 0.2, bz0 - 0.2], [ex1 + 0.1, FL[3], bz1], { shadow: true });
  const runLen = RUN;
  for (const lv of [1, 2]) {
    const fl = FL[lv - 1];
    steelFlight(b, tread, steel, [xa, fl, bz0], '-z', RISE, w);
    const lz1 = bz0 - runLen;
    b.boxMM(tread, [ex0, fl + RISE - 0.12, ez0], [ex1, fl + RISE, lz1], { collide: true, shadow: true });
    railing(b, steel, [ex0, fl + RISE, ez0], [ex1, fl + RISE, ez0]);
    railing(b, steel, [ex0, fl + RISE, ez0], [ex0, fl + RISE, lz1]);
    railing(b, steel, [ex1, fl + RISE, ez0], [ex1, fl + RISE, lz1]);
    steelFlight(b, tread, steel, [xb, fl + RISE, lz1], '+z', RISE, w);
    // 外側の手すり（段に沿う）と、2 本の段の間の手すり（間の隙間へ落ちない）
    for (const [x, y0, za, zb] of [[ex0, fl, bz0, lz1], [ex1, fl + RISE, lz1, bz0], [xa + w / 2 + 0.03, fl, bz0, lz1], [xb - w / 2 - 0.03, fl + RISE, lz1, bz0]] as [number, number, number, number][]) {
      const top0 = y0 + (za > zb ? 0 : RISE) + 1.0;
      const top1 = y0 + (za > zb ? RISE : 0) + 1.0;
      railingSlope(b, steel, [x, top0, za], [x, top1, zb]);
    }
    railing(b, steel, [xa + w / 2 + 0.03, fl + RISE, lz1 + 0.03], [xb - w / 2 - 0.03, fl + RISE, lz1 + 0.03]);
  }
  // バルコニーの縁（z = bz0）の段の口: 2 階は段の間に手すり・下り口は鍵の門（地面へは出られない）。3 階は上る段が無いので下からの口のほかは手すり
  railing(b, steel, [xa + w / 2 + 0.05, FL[1], bz0 - 0.05], [xb - w / 2 - 0.05, FL[1], bz0 - 0.05]);
  railing(b, steel, [ex0, FL[2], bz0 - 0.05], [xb - w / 2 - 0.03, FL[2], bz0 - 0.05]);
  b.boxMM(steel, [xb - w / 2, FL[1], bz0 - 0.06], [xb + w / 2, FL[1] + 1.15, bz0 - 0.02], { collide: true, shadow: true });
  for (let x = xb - w / 2; x < xb + w / 2; x += 0.11) b.boxMM(steel, [x, FL[1], bz0 - 0.08], [x + 0.022, FL[1] + 1.15, bz0 - 0.06], { shadow: true });
  b.boxMM(steel, [xa - w / 2, FL[0], bz0 + 0.02], [xa + w / 2, FL[0] + 1.15, bz0 + 0.06], { collide: true, shadow: true });
  // 避難階段の柱（地面から 3 階の床まで）
  const cols: [number, number][] = [[ex0, ez0], [ex1 - 0.1, ez0], [ex1 - 0.1, bz0 - 0.1]];
  for (const [x, z] of cols) b.boxMM(steel, [x, -0.5, z], [x + 0.1, FL[2] + 1.1, z + 0.1], { collide: true, shadow: true });
  escapeDetails(env, cols);
  void CH;
  void CORR;
  void Z_EAST;
}

/**
 * 鉄の階段の 1 本（踏み板・2 本の側桁）。当たり判定は段ごとの箱（見た目は薄い踏み板だけ。段の下が透ける）
 */
function steelFlight(b: Builder, tread: THREE.Material, steel: THREE.Material, from: [number, number, number], dir: '+z' | '-z', rise: number, width: number): void {
  const n = Math.round(rise / 0.17);
  const rh = rise / n;
  const sz = dir === '+z' ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const z0 = from[2] + sz * i * TREAD;
    const z1 = z0 + sz * TREAD;
    const y = from[1] + rh * (i + 1);
    b.boxMM(tread, [from[0] - width / 2, y - 0.035, Math.min(z0, z1)], [from[0] + width / 2, y, Math.max(z0, z1)], { shadow: true });
    b.ctx.colliders.add({ x: from[0] - width / 2, y: from[1], z: Math.min(z0, z1) }, { x: from[0] + width / 2, y, z: Math.max(z0, z1) });
    // 段鼻の山形の鋼（前の縁）と、踏み板を側桁に留めるボルト（両側 2 本ずつ）
    const zn = z0;
    b.boxMM(steel, [from[0] - width / 2, y - 0.045, Math.min(zn, zn + sz * 0.035)], [from[0] + width / 2, y + 0.004, Math.max(zn, zn + sz * 0.035)], { shadow: true });
    for (const s of [-1, 1]) for (const k of [0.25, 0.75]) b.cyl(steel, [from[0] + s * (width / 2 + 0.034), y - 0.06, z0 + sz * TREAD * k], 0.011, 0.012, { axis: 'x', shadow: false });
  }
  const len = n * TREAD;
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.03, 0.22, Math.hypot(len, rise));
    g.rotateX(sz * Math.atan2(rise, len));
    g.translate(from[0] + s * (width / 2 + 0.015), from[1] + rise / 2 - 0.05, from[2] + (sz * len) / 2);
    b.mesh(g, steel, [0, 0, 0], { shadow: true });
  }
}

/** まっすぐの手すり（柱と笠木と 2 本の横桟） */
function railing(b: Builder, m: THREE.Material, a: [number, number, number], c: [number, number, number]): void {
  b.ctx.colliders.add({ x: Math.min(a[0], c[0]) - 0.03, y: a[1], z: Math.min(a[2], c[2]) - 0.03 }, { x: Math.max(a[0], c[0]) + 0.03, y: a[1] + 1.1, z: Math.max(a[2], c[2]) + 0.03 });
  const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
  const n = Math.max(1, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (c[0] - a[0]) * t;
    const z = a[2] + (c[2] - a[2]) * t;
    b.boxMM(m, [x - 0.025, a[1], z - 0.025], [x + 0.025, a[1] + 1.1, z + 0.025], { shadow: true });
  }
  for (const y of [1.1, 0.6, 0.15]) {
    b.boxMM(m, [Math.min(a[0], c[0]) - 0.03, a[1] + y - 0.03, Math.min(a[2], c[2]) - 0.03], [Math.max(a[0], c[0]) + 0.03, a[1] + y + 0.01, Math.max(a[2], c[2]) + 0.03], { shadow: true });
  }
}

/** 段に沿う斜めの手すり（笠木の管と柱） */
function railingSlope(b: Builder, m: THREE.Material, a: [number, number, number], c: [number, number, number]): void {
  const va = new THREE.Vector3(...a);
  const vc = new THREE.Vector3(...c);
  const len = va.distanceTo(vc);
  const g = new THREE.CylinderGeometry(0.025, 0.025, len, 8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vc.clone().sub(va).normalize()));
  g.translate((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
  b.mesh(g, m, [0, 0, 0], { shadow: true });
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = va.clone().lerp(vc, t);
    b.boxMM(m, [p.x - 0.02, p.y - 1.0, p.z - 0.02], [p.x + 0.02, p.y, p.z + 0.02], { shadow: true });
  }
  // 当たり判定（外へ落ちない）
  b.ctx.colliders.add({ x: a[0] - 0.05, y: Math.min(a[1], c[1]) - 1.0, z: Math.min(a[2], c[2]) }, { x: a[0] + 0.05, y: Math.max(a[1], c[1]) + 0.1, z: Math.max(a[2], c[2]) });
}

export type { Mats };

// ---------------------------------------------------------------- バルコニーと外壁・避難階段の部材

/** 参考画像の視点の画面に入るか（点のどれか）。入る所には外の物を足さない（視点の見た目を変えない） */
function seen(pts: V3[]): boolean {
  for (const c of [CAM0, CAM1]) {
    for (const p of pts) {
      const q = c.proj(p);
      if (q && q[0] > -40 && q[0] < 1496 && q[1] > -40 && q[1] < 856) return true;
    }
  }
  return false;
}

/** 雨の筋（外の面の、水の落ちる所の下: 窓台・庇・水抜きの端）。縦に細く、下ほど細い板。壁の面 z = zf（-z を向く） */
function streak(b: Builder, m: THREE.Material, x: number, yTop: number, len: number, zf: number, w = 0.05): void {
  const g = new THREE.BufferGeometry();
  const pts = [x - w / 2, yTop, 0, x + w / 2, yTop, 0, x + w * 0.15, yTop - len, 0, x - w * 0.15, yTop - len, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  g.translate(0, 0, zf);
  b.mesh(g, m, [0, 0, 0], { shadow: 'receive' });
}

/**
 * バルコニーの部材（決まり: どの階も同じ。参考画像の視点の画面に入る所には置かない）:
 * 手すりの壁の上のパイプの手すり（支柱と受け金物）・床の排水の溝と格子・水抜き（外へ出る管）と下の雨の筋・縦樋（受け金物）・
 * 空調の室外機（ファンの格子・配管と化粧の覆い）・雑巾掛けの竿（天井から下げる金物）、外壁の窓の外の水切りと庇・その端の雨の筋
 */
function balconyParts(env: Env, lv: 2 | 3): void {
  const { b, mats, ctx } = env;
  const fl = FL[lv - 1];
  const zone = levelZone(lv);
  const lm = levelMats(mats, zone);
  const [bx0, bz0, , bz1] = BALC;
  const ex0 = ESC[0];
  const P = PAL[zone];
  const pm = mats.props(zone);
  const sink = propSink(b, ctx);
  const pipe = mats.get(zone, zone === 'deep' ? '#6f9aaa' : '#3f8a96', { key: 'bpipe' });
  const rain = mats.get(zone, zone === 'deep' ? '#3a6a84' : '#1f5c68', { shade: zone === 'deep' ? '#1a3550' : '#0a2c38', dark: zone === 'deep' ? '#163049' : '#082634', key: 'rain' });
  // パイプの手すり（笠木の上 0.27 m・支柱 1.2 m おき・根元の座金）。参考画像の視点から扉のガラス越しに見える西の端には置かない
  const zr = bz0 - 0.06;
  const xs: number[] = [];
  for (let x = ex0 - 0.15; x > bx0 + 0.1; x -= 1.2) if (!seen([[x, fl + 1.4, zr], [x, fl + 1.1, zr]])) xs.push(x);
  if (xs.length >= 2) {
    const xa = Math.min(...xs);
    const xb = Math.max(...xs);
    for (const x of xs) {
      b.cyl(pipe, [x, fl + 1.24, zr], 0.018, 0.28, { shadow: true });
      b.cyl(pipe, [x, fl + 1.105, zr], 0.04, 0.012, { shadow: false });
    }
    b.cyl(pipe, [(xa + xb) / 2, fl + 1.38, zr], 0.024, xb - xa + 0.08, { axis: 'x', shadow: true });
    b.cyl(pipe, [(xa + xb) / 2, fl + 1.24, zr], 0.012, xb - xa, { axis: 'x', shadow: true });
    ctx.colliders.add({ x: xa, y: fl + 1.05, z: zr - 0.04 }, { x: xb, y: fl + 1.42, z: zr + 0.04 });
  }
  // 床の排水の溝（手すりの壁の根元に沿う浅い溝と鉄の格子）
  const gx0 = Math.max(bx0 + 0.15, 5.6);
  b.boxMM(lm.dark, [gx0, fl - 0.004, bz0 + 0.01], [ex0 - 0.05, fl + 0.002, bz0 + 0.13], { shadow: 'receive' });
  for (let x = gx0 + 0.03; x < ex0 - 0.08; x += 0.06) b.boxMM(pipe, [x, fl + 0.002, bz0 + 0.02], [x + 0.012, fl + 0.008, bz0 + 0.12], { shadow: false });
  // 水抜き（手すりの壁の根元を抜けて外へ出る管）。手すりの支柱の根元から外の面へ雨の筋（1 本おき）
  for (const x of [6.2, 9.6]) b.cyl(pipe, [x, fl + 0.06, bz0 - 0.15], 0.03, 0.14, { axis: 'z', shadow: true });
  xs.forEach((x, i) => {
    if (i % 2 === 0) streak(b, rain, x, fl + 1.05, 0.75, bz0 - 0.123, 0.05);
  });
  // 縦樋（建物の北西の角の近く・受け金物 1.2 m おき）。屋上から下の階へ
  if (lv === 2) {
    const px = XN + T_EXT - 0.18;
    const pz = bz1 - 0.07;
    b.cyl(pipe, [px, (FL[1] + FL[3] + 0.9) / 2, pz], 0.045, FL[3] + 0.9 - FL[1], { shadow: true });
    for (let y = FL[1] + 0.6; y < FL[3] + 0.8; y += 1.2) b.boxMM(pipe, [px - 0.06, y, pz - 0.01], [px + 0.06, y + 0.03, bz1], { shadow: false });
  }
  // 空調の室外機（外壁に沿って床に置く）と、配管の化粧の覆い（室外機の横から壁を上って壁の中へ）
  const ax = lv === 2 ? 6.65 : 7.35;
  if (!seen([[ax - 0.45, fl + 0.7, bz1 - 0.3], [ax + 0.45, fl, bz1]])) {
    acUnit(Prop.at(sink, pm, [ax, fl, bz1 - 0.16], Math.PI, 600 + lv));
    b.boxMM(lm.sill, [ax + 0.42, fl + 0.3, bz1 - 0.07], [ax + 0.5, fl + 2.45, bz1], { shadow: true });
    b.boxMM(lm.sill, [ax + 0.42, fl + 2.37, bz1 - 0.07], [ax + 0.95, fl + 2.45, bz1], { shadow: true });
  }
  // 雑巾掛けの竿（上の階の床の裏から下げた 2 本の金物と竿・掛けた雑巾）
  const rx0 = 6.0;
  const rx1 = rx0 + 1.6;
  if (!seen([[rx0, fl + 2.1, -0.9], [rx1, fl + 3.3, -0.9]])) {
    for (const x of [rx0 + 0.1, rx1 - 0.1]) b.cyl(pipe, [x, fl + 2.75, -0.85], 0.008, 1.3, { shadow: false });
    b.cyl(pipe, [(rx0 + rx1) / 2, fl + 2.1, -0.85], 0.016, rx1 - rx0, { axis: 'x', shadow: true });
    const cloth = ['#cfe6e6', '#9fc3c8', '#b9d8d8', '#cfe6e6'];
    for (let k = 0; k < 4; k++) {
      const x = rx0 + 0.3 + k * 0.33;
      b.boxMM(mats.get(zone, cloth[k], { key: 'rag' }), [x - 0.12, fl + 1.78 - (k % 2) * 0.05, -0.857], [x + 0.12, fl + 2.12, -0.843], { shadow: true });
    }
  }
  // 外壁の窓の外: 水切り（窓台の外）と庇（廊下の扉の上）、その両端の雨の筋
  const zf = -T_EXT - 0.002;
  const outs: [number, number, number][] = lv === 2 ? [[4.95, 6.55, 0.9]] : [];
  for (const [a, c, sy] of outs) {
    if (seen([[a, fl + sy, zf], [c, fl + sy, zf]])) continue;
    b.boxMM(lm.sill, [a - 0.05, fl + sy - 0.04, zf - 0.08], [c + 0.05, fl + sy, zf], { shadow: true });
    for (const x of [a + 0.02, c - 0.02]) streak(b, rain, x, fl + sy - 0.04, 0.7, zf - 0.001, 0.05);
  }
  const dz = (CORR[0] + CORR[1]) / 2;
  b.boxMM(lm.ext, [dz - 0.75, fl + 2.15, zf - 0.6], [dz + 0.75, fl + 2.25, zf], { shadow: true });
  for (const x of [dz - 0.72, dz + 0.72]) streak(b, rain, x, fl + 2.15, 1.0, zf - 0.001, 0.06);
  void P;
}

/**
 * 避難階段の部材: 踊り場の表示板（非常階段・階）、柱の継ぎ目と踊り場の梁の下の錆の筋（柱の面）、踊り場の縁の帯
 */
function escapeDetails(env: Env, cols: [number, number][]): void {
  const { b, mats } = env;
  const [ex0, ez0, ex1] = ESC;
  const rust = mats.get('deep', '#5f6a66', { shade: '#2c3c44', dark: '#22323c', key: 'rust' });
  const plate = mats.get('deep', '#cfe6e6', { key: 'plate' });
  const green = mats.get('deep', '#3a9f78', { key: 'esign' });
  const ink = mats.get('deep', '#2c4c66', { key: 'ink' });
  for (const lv of [1, 2]) {
    const y = FL[lv - 1] + RISE;
    // 表示板（踊り場の外側の手すり ez0 の内の面）
    const zx = ez0 + 0.04;
    const xc = (ex0 + ex1) / 2;
    b.boxMM(plate, [xc - 0.25, y + 0.62, zx], [xc + 0.25, y + 0.95, zx + 0.012], { shadow: true });
    b.boxMM(green, [xc - 0.23, y + 0.85, zx + 0.012], [xc + 0.23, y + 0.93, zx + 0.015], { shadow: false });
    for (let k = 0; k < 2; k++) b.boxMM(ink, [xc - 0.18, y + 0.68 + k * 0.07, zx + 0.012], [xc + 0.1 - k * 0.12, y + 0.72 + k * 0.07, zx + 0.015], { shadow: false });
    // 錆の筋: 踊り場の高さの柱の継ぎ目（板の下）から下へ
    for (const [x, z] of cols) {
      streak(b, rust, x + 0.05, y - 0.12, 0.8 + lv * 0.15, z - 0.002, 0.05);
      b.boxMM(rust, [x - 0.005, y - 0.16, z - 0.005], [x + 0.105, y - 0.12, z + 0.105], { shadow: false });
    }
  }
  void Z_EAST;
}
