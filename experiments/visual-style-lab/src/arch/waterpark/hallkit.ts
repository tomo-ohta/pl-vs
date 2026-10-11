import * as THREE from 'three';
import type { Lamp } from '../../render/Lamps.ts';
import type { Builder, PartOptions, V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { HALL, type HallId } from './layout.ts';
import { buildPath, frames, ringProfile, sampleAt, splinePath, sweep, pathLength, type P3, type PathSeg, type SweepPath } from './sweep.ts';

/**
 * 広間を局所の座標で作る道具（Builder の上に、原点のずれを足すだけ）。
 * 建物の部材（手すり・ダクト・柱・灯り）もここ。どれも参考画像の語彙: 細い縦桟の手すり、継ぎ目の帯のある銀色のダクト、
 * 青と白の升目のタイルの角柱、柱の上の橙色の投光器
 */
export class HallKit {
  readonly ox: number;
  readonly oz: number;
  readonly b: Builder;
  readonly ctx: SceneContext;
  readonly id: HallId;
  // パラメータプロパティは使わない（Node の型ストリップで測る道具からも読めるように）
  constructor(b: Builder, ctx: SceneContext, id: HallId) {
    this.b = b;
    this.ctx = ctx;
    this.id = id;
    [this.ox, this.oz] = HALL[id].o;
  }

  /** 局所 → ワールドの点 */
  p(x: number, y: number, z: number): V3 {
    return [x + this.ox, y, z + this.oz];
  }

  box(mat: THREE.Material, min: V3, max: V3, o: PartOptions = {}): THREE.Mesh {
    return this.b.boxMM(mat, this.p(...min), this.p(...max), o);
  }

  cyl(mat: THREE.Material, c: V3, r: number, len: number, o: PartOptions & { axis?: 'x' | 'y' | 'z'; radiusTop?: number; segments?: number } = {}): THREE.Mesh {
    return this.b.cyl(mat, this.p(...c), r, len, o);
  }

  /** 局所の座標の形を置く（形を動かす） */
  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, o: PartOptions = {}): THREE.Mesh {
    geo.translate(this.ox, 0, this.oz);
    return this.b.mesh(geo, mat, [0, 0, 0], o);
  }

  /** ワールドの座標の形を置く */
  meshW(geo: THREE.BufferGeometry, mat: THREE.Material, o: PartOptions = {}): THREE.Mesh {
    return this.b.mesh(geo, mat, [0, 0, 0], o);
  }

  /** 当たり判定だけ（局所） */
  collide(min: V3, max: V3): void {
    const a = this.p(...min);
    const c = this.p(...max);
    this.ctx.colliders.add({ x: a[0], y: a[1], z: a[2] }, { x: c[0], y: c[1], z: c[2] });
  }

  lamp(l: Lamp): Lamp {
    const box = l.box ? ([l.box[0] + this.ox, l.box[1], l.box[2] + this.oz, l.box[3] + this.ox, l.box[4], l.box[5] + this.oz] as Lamp['box']) : undefined;
    return this.ctx.addLamp({ ...l, pos: this.p(...l.pos), box });
  }

  /** 局所の箱 [x0, y0, z0, x1, y1, z1] → ワールド */
  boxW(b: [number, number, number, number, number, number]): [number, number, number, number, number, number] {
    return [b[0] + this.ox, b[1], b[2] + this.oz, b[3] + this.ox, b[4], b[5] + this.oz];
  }

  /** 局所の制御点を通るなめらかな道筋（ワールド） */
  spline(ctrl: P3[], step = 0.25): SweepPath {
    return splinePath(ctrl.map((p) => this.p(...p)), step);
  }

  /** 局所の始点と部品から道筋（ワールド） */
  path(start: P3, segs: PathSeg[], step = 0.25, bank = 0.35): SweepPath {
    const tr = (s: PathSeg): PathSeg => (s.kind === 'line' ? { kind: 'line', to: this.p(...s.to) } : { ...s, c: [s.c[0] + this.ox, s.c[1] + this.oz] });
    return buildPath(this.p(...start), segs.map(tr), step, bank);
  }
}

// ------------------------------------------------------------------ 部材

/** 手すり（a → b の水平の線、床の高さ y、高さ h）。上の手すり・中の横桟・縦桟（間隔 gap） */
export function railing(k: HallKit, mat: THREE.Material, a: [number, number], c: [number, number], y: number, o: { h?: number; gap?: number; r?: number; posts?: number; mid?: boolean } = {}): void {
  const h = o.h ?? 1.1;
  const gap = o.gap ?? 0.12;
  const r = o.r ?? 0.025;
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  if (len < 0.05) return;
  const dx = (c[0] - a[0]) / len;
  const dz = (c[1] - a[1]) / len;
  const g = new THREE.CylinderGeometry(r, r, len, 6);
  g.rotateZ(Math.PI / 2);
  g.rotateY(-Math.atan2(dz, dx));
  const mid: V3 = [(a[0] + c[0]) / 2, y + h, (a[1] + c[1]) / 2];
  const top = g.clone();
  top.translate(...mid);
  k.mesh(top, mat, { shadow: false });
  if (o.mid !== false) {
    const m2 = g.clone();
    m2.translate(mid[0], y + 0.12, mid[2]);
    k.mesh(m2, mat, { shadow: false });
  }
  // 縦桟（細い板の列。1 本ずつ）
  const n = Math.max(1, Math.round(len / gap));
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const big = o.posts !== undefined && i % o.posts === 0;
    const bg = new THREE.BoxGeometry(big ? 0.05 : 0.018, h, big ? 0.05 : 0.018);
    bg.translate(a[0] + (c[0] - a[0]) * t, y + h / 2, a[1] + (c[1] - a[1]) * t);
    geos.push(bg);
  }
  for (const bg of geos) k.mesh(bg, mat, { shadow: false });
  // 当たり判定（細い壁）
  const x0 = Math.min(a[0], c[0]) - 0.04;
  const x1 = Math.max(a[0], c[0]) + 0.04;
  const z0 = Math.min(a[1], c[1]) - 0.04;
  const z1 = Math.max(a[1], c[1]) + 0.04;
  if (Math.abs(dx) < 0.02 || Math.abs(dz) < 0.02) k.collide([x0, y, z0], [x1, y + h, z1]);
  else {
    // 斜めの手すり: 小さな箱を並べる
    const m = Math.ceil(len / 0.4);
    for (let i = 0; i < m; i++) {
      const t0 = i / m;
      const t1 = (i + 1) / m;
      const p0 = [a[0] + (c[0] - a[0]) * t0, a[1] + (c[1] - a[1]) * t0];
      const p1 = [a[0] + (c[0] - a[0]) * t1, a[1] + (c[1] - a[1]) * t1];
      k.collide([Math.min(p0[0], p1[0]) - 0.05, y, Math.min(p0[1], p1[1]) - 0.05], [Math.max(p0[0], p1[0]) + 0.05, y + h, Math.max(p0[1], p1[1]) + 0.05]);
    }
  }
}

/**
 * 階段の段鼻と蹴込み（kit.ts の stairs と同じ並び）: 段ごとに踏み面の前の縁へ明るい段鼻の帯、蹴込みに暗い帯。
 * 段の縁が平らな一枚の板に見えないように
 */
export function stepEdges(k: HallKit, nose: THREE.Material, riserMat: THREE.Material, from: V3, dir: '+x' | '-x' | '+z' | '-z', rise: number, width: number, o: { tread?: number; riser?: number } = {}): void {
  const n = Math.max(1, Math.round(rise / (o.riser ?? 0.17)));
  const rh = rise / n;
  const tread = o.tread ?? 0.28;
  const sx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0;
  const sz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
  for (let i = 0; i < n; i++) {
    const t0 = i * tread;
    const top = from[1] + rh * (i + 1);
    // 段の前の縁（下の段から見て手前 = t0 の位置）
    const cx = from[0] + sx * (t0 + 0.03);
    const cz = from[2] + sz * (t0 + 0.03);
    const a: V3 = sx !== 0 ? [cx - 0.035, top - 0.02, from[2] - width / 2] : [from[0] - width / 2, top - 0.02, cz - 0.035];
    const b: V3 = sx !== 0 ? [cx + 0.035, top + 0.008, from[2] + width / 2] : [from[0] + width / 2, top + 0.008, cz + 0.035];
    k.box(nose, [a[0] - k.ox, a[1], a[2] - k.oz], [b[0] - k.ox, b[1], b[2] - k.oz], { shadow: false });
    // 蹴込み（前の面に暗い帯）
    const fx = from[0] + sx * (t0 - 0.004);
    const fz = from[2] + sz * (t0 - 0.004);
    const c: V3 = sx !== 0 ? [fx - 0.004, top - rh + 0.01, from[2] - width / 2 + 0.02] : [from[0] - width / 2 + 0.02, top - rh + 0.01, fz - 0.004];
    const d: V3 = sx !== 0 ? [fx + 0.004, top - 0.03, from[2] + width / 2 - 0.02] : [from[0] + width / 2 - 0.02, top - 0.03, fz + 0.004];
    k.box(riserMat, [c[0] - k.ox, c[1], c[2] - k.oz], [d[0] - k.ox, d[1], d[2] - k.oz], { shadow: false });
  }
}

/** 傾いた手すり（階段）: 下の点 a（y0）から上の点 c（y1） */
export function stairRail(k: HallKit, mat: THREE.Material, a: V3, c: V3, o: { h?: number; gap?: number } = {}): void {
  const h = o.h ?? 0.95;
  const gap = o.gap ?? 0.14;
  const A = new THREE.Vector3(a[0], a[1] + h, a[2]);
  const C = new THREE.Vector3(c[0], c[1] + h, c[2]);
  const len = A.distanceTo(C);
  const tube = new THREE.CylinderGeometry(0.025, 0.025, len, 6);
  tube.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize()));
  tube.translate((A.x + C.x) / 2, (A.y + C.y) / 2, (A.z + C.z) / 2);
  k.mesh(tube, mat, { shadow: false });
  const lo = tube.clone();
  lo.translate(0, -h + 0.15, 0);
  k.mesh(lo, mat, { shadow: false });
  const horiz = Math.hypot(c[0] - a[0], c[2] - a[2]);
  const n = Math.max(1, Math.round(horiz / gap));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (c[0] - a[0]) * t;
    const z = a[2] + (c[2] - a[2]) * t;
    const y = a[1] + (c[1] - a[1]) * t;
    const g = new THREE.BoxGeometry(0.018, h, 0.018);
    g.translate(x, y + h / 2, z);
    k.mesh(g, mat, { shadow: false });
  }
}

/** 銀色のダクト（a → b の直線、半径 r）。継ぎ目の帯を every m おきに */
export function duct(k: HallKit, mat: THREE.Material, band: THREE.Material, a: V3, c: V3, r: number, every = 1.6): void {
  const A = new THREE.Vector3(...a);
  const C = new THREE.Vector3(...c);
  const len = A.distanceTo(C);
  const dir = C.clone().sub(A).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const g = new THREE.CylinderGeometry(r, r, len, 24, 1, true);
  g.applyQuaternion(q);
  g.translate((A.x + C.x) / 2, (A.y + C.y) / 2, (A.z + C.z) / 2);
  k.mesh(g, mat, { shadow: false });
  const n = Math.floor(len / every);
  for (let i = 1; i <= n; i++) {
    const t = (i * every) / len;
    const p = A.clone().lerp(C, Math.min(t, 1));
    const rg = new THREE.TorusGeometry(r * 1.015, r * 0.035, 4, 24);
    rg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
    rg.translate(p.x, p.y, p.z);
    k.mesh(rg, band, { shadow: false });
  }
}

/** 曲がったダクト（局所の制御点を通る管。継ぎ目の帯つき） */
export function ductCurve(k: HallKit, mat: THREE.Material, band: THREE.Material, ctrl: P3[], r: number, every = 1.5): void {
  const path = k.spline(ctrl, 0.3);
  k.meshW(sweep(path, ringProfile(r, 20).reverse(), { closedProf: true }), mat, { shadow: false });
  const L = pathLength(path);
  const fr = frames(path);
  for (let d = every; d < L - 0.2; d += every) {
    const { p, i } = sampleAt(path, d);
    const f = fr[Math.min(i, fr.length - 1)];
    const tor = new THREE.TorusGeometry(r * 1.015, r * 0.035, 4, 24);
    tor.applyMatrix4(new THREE.Matrix4().makeBasis(f.s, f.u, f.t.clone().negate()));
    tor.translate(p.x, p.y, p.z);
    k.meshW(tor, band, { shadow: false });
  }
}

/** 灯りの器具（投光器: 箱の後ろと光る前の面）。pos = 前の面の中心、dir = 向き（水平の角度。0 = -z） */
export function floodlight(k: HallKit, body: THREE.Material, lit: THREE.Material, pos: V3, yaw: number, o: { w?: number; h?: number; tilt?: number } = {}): void {
  const w = o.w ?? 0.36;
  const h = o.h ?? 0.24;
  const g = new THREE.BoxGeometry(w, h, 0.18);
  g.translate(0, 0, 0.09);
  const f = new THREE.PlaneGeometry(w * 0.86, h * 0.8);
  f.rotateY(Math.PI);
  f.translate(0, 0, -0.008);
  for (const geo of [g, f]) {
    geo.rotateX(-(o.tilt ?? 0.5));
    geo.rotateY(yaw);
    geo.translate(...pos);
  }
  k.mesh(g, body, { shadow: false });
  k.mesh(f, lit, { shadow: false });
}

/**
 * 映り込みにだけ出る灯りのにじみの玉（layer 2）。濡れた床の縦の筋を、参考画像のように太く明るくする
 * （画面には出ない。床の鏡像の中だけで、灯りの位置に大きな光の玉）
 */
export function reflGlow(k: HallKit, mat: THREE.Material, pos: V3, r: number): void {
  // 細く縦に長い光の棒（床の映り込みでは、灯りから手前へ伸びる細い筋になる）。太さは r の 1/6、長さは r の 3 倍（上下に）
  const w = Math.max(0.06, r * 0.26);
  const g = new THREE.CylinderGeometry(w, w, r * 3, 6);
  g.translate(pos[0], pos[1] - r * 0.6, pos[2]);
  k.mesh(g, mat, { shadow: false, layer: 2 });
}

/** 丸い光（天井の小さな投光・壁の丸い灯り）: 平たい円柱の光る面 */
export function roundLight(k: HallKit, body: THREE.Material, lit: THREE.Material, pos: V3, r: number, axis: 'x' | 'y' | 'z' = 'y', sign = -1): void {
  const g = new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.08, 16);
  const f = new THREE.CircleGeometry(r, 16);
  if (axis === 'y') {
    f.rotateX(sign < 0 ? Math.PI / 2 : -Math.PI / 2);
    f.translate(0, sign * 0.041, 0);
  } else if (axis === 'x') {
    g.rotateZ(Math.PI / 2);
    f.rotateY(sign < 0 ? -Math.PI / 2 : Math.PI / 2);
    f.translate(sign * 0.041, 0, 0);
  } else {
    g.rotateX(Math.PI / 2);
    if (sign < 0) f.rotateY(Math.PI);
    f.translate(0, 0, sign * 0.041);
  }
  g.translate(...pos);
  f.translate(...pos);
  k.mesh(g, body, { shadow: false });
  k.mesh(f, lit, { shadow: false });
}

// ------------------------------------------------------------------ スライダー（部品をつないだ物。slides.ts）

export { buildSlide, monoPal, slideTone, type SlidePal, type SlideSpec, type SlideTone } from './slides.ts';

// ------------------------------------------------------------------ 灯りの間引き

/**
 * 灯りの光だまり（ctx.addLamp）は目に近い 16 個だけが使われるので、広い広間では目の後ろの灯りに枠を取られる。
 * 描く前に、照らす箱が画角に入らない灯りを消す（on = false）。歩いても段が急に変わらないよう、箱を少し広げて調べる
 */
export class LampCuller {
  readonly list: { lamp: Lamp; box: THREE.Box3 }[] = [];
  private readonly frustum = new THREE.Frustum();
  private readonly m = new THREE.Matrix4();

  add(l: Lamp): Lamp {
    const b = l.box ?? [l.pos[0] - l.radius, l.pos[1] - l.radius, l.pos[2] - l.radius, l.pos[0] + l.radius, l.pos[1] + l.radius, l.pos[2] + l.radius];
    const box = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    // 灯りの届く範囲で切る（箱が広くても、光は radius までしか届かない）
    const reach = new THREE.Box3(new THREE.Vector3(...l.pos).subScalar(l.radius), new THREE.Vector3(...l.pos).addScalar(l.radius));
    box.intersect(reach);
    // 照らす箱も届く範囲に縮める（目からの距離の順で 16 個を選ぶとき、広間全体の箱だと全部「距離 0」になる）
    if (!l.yaw) l.box = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
    box.expandByScalar(1.0);
    this.list.push({ lamp: l, box });
    return l;
  }

  update(camera: THREE.Camera): void {
    camera.updateMatrixWorld();
    this.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m);
    for (const e of this.list) e.lamp.on = this.frustum.intersectsBox(e.box);
  }
}

// ------------------------------------------------------------------ 描いた光だまり

let glowTex: THREE.Texture | null = null;
/** 丸い光のにじみの絵（中心が明るく、縁へなめらかに 0。少しむらのある塗り） */
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const n = 128;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, n, n);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** 描いた光だまりの材質（足し算で重ねる。照明の数の上限に縛られない、壁・床の灯りのにじみ） */
export function glowDecalMat(ctx: SceneContext, color: string, strength: number): THREE.Material {
  const m = ctx.mat({ color, unlit: true, map: glowTexture(), transparent: true, depthWrite: false, line: 0, opacity: strength, toon: 0 });
  m.blending = THREE.AdditiveBlending;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  return m;
}

/** 面の上の光だまり（局所の中心・幅・高さ・面の向き） */
export function glowDecal(k: HallKit, mat: THREE.Material, c: V3, w: number, h: number, facing: '+x' | '-x' | '+y' | '+z' | '-z'): void {
  const g = new THREE.PlaneGeometry(w, h);
  if (facing === '+x') g.rotateY(Math.PI / 2);
  if (facing === '-x') g.rotateY(-Math.PI / 2);
  if (facing === '+y') g.rotateX(-Math.PI / 2);
  if (facing === '-z') g.rotateY(Math.PI);
  const off = 0.015;
  const [x, y, z] = c;
  g.translate(x + (facing === '+x' ? off : facing === '-x' ? -off : 0), y + (facing === '+y' ? off : 0), z + (facing === '+z' ? off : facing === '-z' ? -off : 0));
  k.mesh(g, mat, { shadow: false, layer: 1 });
}
