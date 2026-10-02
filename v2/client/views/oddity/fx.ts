/**
 * 部屋まるごとの異変の部屋の効果（oddRoom 部品の params.fx の 1 つずつ）。room.ts が種類（kind）ごとに作る。
 *
 * 粒（雨・雪・埃・流れる紙・湯気・流れ落ちる砂）・煙の層・温度（画面の霜と暖かさ）・画面の色・鏡の中の人影・回る物。
 * 粒は InstancedMesh 1 つずつ（数は params の count。部屋の広さから異変が決める）。点光源は足さない
 * （three は点光源の数が変わると全部の材質のシェーダを作り直すので）。
 */
import * as THREE from 'three';
import type { AABB } from '../../../core/math/aabb.ts';
import type { PartState } from '../../../core/sim/part.ts';
import type { Box, EntitySpec, Json } from '../../../core/world/layout.ts';
import type { RoomGrade } from '../../render/RoomGrade.ts';
import type { ViewContext } from '../views.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { aabbOf, boxesGroup, cloudTexture, eyeOf, glowMaterial, inside, num, prng, str } from './util.ts';

export interface Fx {
  update(dt: number, s: Readonly<PartState>): void;
  dispose(): void;
}

export interface FxArgs {
  p: { [k: string]: Json };
  ctx: ViewContext;
  /** 部屋（oddRoom の aabb） */
  room: AABB;
  spec: EntitySpec;
  /** 種（描画の揺らぎ） */
  seed: number;
  /** 画面効果の頼みの鍵（効果ごとに一意） */
  key: string;
  /** 部屋の床の矩形（壁の内側。L 字の部屋で、外形の欠けた隅に粒・煙を出さないように） */
  rects: Rect[];
}

export interface Rect { x0: number; z0: number; x1: number; z1: number }

/** 矩形の中の点を面積の重みで選ぶ（u, v は 0..1 の乱数） */
function inRects(rects: readonly Rect[], u: number, v: number, w: number): [number, number] {
  const total = rects.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  let k = w * total;
  for (const r of rects) {
    const ar = (r.x1 - r.x0) * (r.z1 - r.z0);
    if (k <= ar) return [r.x0 + u * (r.x1 - r.x0), r.z0 + v * (r.z1 - r.z0)];
    k -= ar;
  }
  const r = rects[rects.length - 1]!;
  return [r.x0 + u * (r.x1 - r.x0), r.z0 + v * (r.z1 - r.z0)];
}

/** 床の矩形ごとの水平の板をまとめたジオメトリ（フロア座標の xz。y = 0。UV は矩形ごとに meters m で 1 回） */
function plateGeo(rects: readonly Rect[], meters: number): THREE.BufferGeometry {
  const parts = rects.map((r) => {
    const g = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0);
    g.rotateX(-Math.PI / 2);
    g.translate((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (r.x1 - r.x0) / meters + r.x0 / meters, uv.getY(i) * (r.z1 - r.z0) / meters + r.z0 / meters);
    return g;
  });
  const merged = parts.length === 1 ? parts[0]! : mergeGeometries(parts, false) ?? parts[0]!;
  if (merged !== parts[0]) for (const g of parts) g.dispose();
  return merged;
}

/** 目が部屋の中か（高さは部屋の範囲、水平は床の矩形のどれか。L 字の外形の欠けた隅は部屋の外） */
function inRoom(rects: readonly Rect[], room: { min: number[]; max: number[] }, e: THREE.Vector3 | null): boolean {
  return !!e && e.y >= room.min[1]! - 0.05 && e.y <= room.max[1]! + 0.05 && rects.some((r) => e.x >= r.x0 - 0.05 && e.x <= r.x1 + 0.05 && e.z >= r.z0 - 0.05 && e.z <= r.z1 + 0.05);
}

/** いちばん大きい矩形 */
const largest = (rects: readonly Rect[]): Rect => rects.reduce((a, r) => ((r.x1 - r.x0) * (r.z1 - r.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? r : a));

type FxFactory = (a: FxArgs) => Fx | null;
const FX = new Map<string, FxFactory>();

export function defineFx(kind: string, f: FxFactory): void {
  FX.set(kind, f);
}

export function createFx(kind: string, a: FxArgs): Fx | null {
  return FX.get(kind)?.(a) ?? null;
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/** 粒の入れ物（InstancedMesh）と、毎フレームの置き直し */
function particles(ctx: ViewContext, geo: THREE.BufferGeometry, mat: THREE.Material, count: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  mesh.frustumCulled = false;
  ctx.root.add(mesh);
  return mesh;
}

/** カメラの水平の向き（粒を縦の板としてカメラへ向ける） */
function cameraYaw(ctx: ViewContext): number {
  const c = ctx.camera;
  if (!c) return 0;
  const e = new THREE.Euler().setFromQuaternion(c.quaternion, 'YXZ');
  return e.y;
}

// ---------------------------------------------------------------- 雨（E03 雨漏り）
defineFx('rain', ({ p, ctx, room, seed, rects }) => {
  const a = p.aabb ? aabbOf(p.aabb) : room;
  const R = p.aabb ? [{ x0: a.min[0], z0: a.min[2], x1: a.max[0], z1: a.max[2] }] : rects;
  const n = Math.round(num(p.count, 300));
  const len = num(p.len, 0.45), speed = num(p.speed, 7.5);
  const geo = new THREE.PlaneGeometry(0.012, len);
  const mat = glowMaterial(num(p.color, 0xbfd0dc), num(p.opacity, 0.42));
  const mesh = particles(ctx, geo, mat, n);
  const r = prng(seed);
  const H = a.max[1] - a.min[1];
  const drops = Array.from({ length: n }, () => { const [x, z] = inRects(R, r(), r(), r()); return { x, z, ph: r() * H, v: speed * (0.8 + r() * 0.4) }; });
  // 床の波紋（輪が広がって消える）
  const ringGeo = new THREE.RingGeometry(0.03, 0.045, 16);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = glowMaterial(0xd8e4ea, 0.35);
  const rn = Math.max(1, Math.round(n / 6));
  const rings = particles(ctx, ringGeo, ringMat, rn);
  const ripples = Array.from({ length: rn }, () => ({ x: 0, z: 0, t: r(), life: 0.5 + r() * 0.4 }));
  const floorY = num(p.floorY, a.min[1]);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      q.setFromAxisAngle(up, cameraYaw(ctx));
      drops.forEach((d, i) => {
        const y = a.max[1] - ((d.ph + t * d.v) % H);
        pos.set(d.x, y, d.z);
        scl.set(1, 1, 1);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      ripples.forEach((w, i) => {
        w.t += dt / w.life;
        if (w.t >= 1) { w.t = 0; [w.x, w.z] = inRects(R, r(), r(), r()); }
        const s = 0.6 + w.t * 3.2;
        pos.set(w.x, floorY + 0.006, w.z);
        scl.set(s, 1, s);
        m4.compose(pos, new THREE.Quaternion(), scl);
        rings.setMatrixAt(i, m4);
      });
      rings.instanceMatrix.needsUpdate = true;
    },
    dispose() { mesh.removeFromParent(); rings.removeFromParent(); geo.dispose(); mat.dispose(); ringGeo.dispose(); ringMat.dispose(); },
  };
});

// ---------------------------------------------------------------- 雪（E04 雪の室内）
defineFx('snowfall', ({ p, ctx, room, seed, rects }) => {
  const a = p.aabb ? aabbOf(p.aabb) : room;
  const R = p.aabb ? [{ x0: a.min[0], z0: a.min[2], x1: a.max[0], z1: a.max[2] }] : rects;
  const n = Math.round(num(p.count, 260));
  const geo = new THREE.CircleGeometry(0.018, 6);
  const mat = glowMaterial(0xffffff, 0.85);
  const mesh = particles(ctx, geo, mat, n);
  const r = prng(seed);
  const H = a.max[1] - a.min[1];
  const flakes = Array.from({ length: n }, () => { const [x, z] = inRects(R, r(), r(), r()); return { x, z, ph: r() * H, v: 0.35 + r() * 0.35, w: r() * 6.28, s: 0.6 + r() * 0.8 }; });
  let t = 0;
  return {
    update(dt) {
      t += dt;
      if (ctx.camera) q.copy(ctx.camera.quaternion);
      flakes.forEach((f, i) => {
        const y = a.max[1] - ((f.ph + t * f.v) % H);
        const x = f.x + Math.sin(t * 0.9 + f.w) * 0.12;
        const z = f.z + Math.cos(t * 0.7 + f.w) * 0.12;
        pos.set(x, y, z);
        scl.set(f.s, f.s, f.s);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 埃（T08 古くなる・T02 日の筋）
defineFx('dust', ({ p, ctx, room, seed, rects }) => {
  const a = p.aabb ? aabbOf(p.aabb) : room;
  const R = p.aabb ? [{ x0: a.min[0], z0: a.min[2], x1: a.max[0], z1: a.max[2] }] : rects;
  const n = Math.round(num(p.count, 200));
  const r = prng(seed);
  const base = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const [x, z] = inRects(R, r(), r(), r()); base[i * 3] = x; base[i * 3 + 1] = a.min[1] + r() * (a.max[1] - a.min[1]); base[i * 3 + 2] = z; }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(base.slice(), 3);
  geo.setAttribute('position', attr);
  const mat = new THREE.PointsMaterial({ color: num(p.color, 0xe8dcc0), size: num(p.size, 0.018), transparent: true, opacity: num(p.opacity, 0.55), depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  ctx.root.add(pts);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < n; i++) {
        arr[i * 3] = base[i * 3]! + Math.sin(t * 0.21 + i) * 0.18;
        arr[i * 3 + 1] = base[i * 3 + 1]! + Math.sin(t * 0.13 + i * 1.7) * 0.12;
        arr[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(t * 0.17 + i * 0.6) * 0.18;
      }
      attr.needsUpdate = true;
    },
    dispose() { pts.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 風で流れる紙・葉（E08 風の向き）
defineFx('drift', ({ p, ctx, room, seed, rects }) => {
  const box0 = p.aabb ? aabbOf(p.aabb) : room;
  // 流れるのはいちばん大きい矩形の中（L 字の外形の欠けた隅へ出ない）
  const L = largest(rects);
  const a = p.aabb ? box0 : { min: [L.x0, box0.min[1], L.z0] as [number, number, number], max: [L.x1, box0.max[1], L.z1] as [number, number, number] };
  const n = Math.round(num(p.count, 60));
  const dir = (p.dir as number[] | undefined) ?? [0, 1];
  const dl = Math.hypot(dir[0]!, dir[1]!) || 1;
  const dx = dir[0]! / dl, dz = dir[1]! / dl;
  const speed = num(p.speed, 1.6);
  const leaf = str(p.shape, 'paper') === 'leaf';
  const geo = leaf ? new THREE.CircleGeometry(0.05, 5) : new THREE.PlaneGeometry(0.21, 0.15);
  const mat = new THREE.MeshLambertMaterial({ color: num(p.color, leaf ? 0x8a6a2c : 0xeeeeea), side: THREE.DoubleSide });
  const mesh = particles(ctx, geo, mat, n);
  const r = prng(seed);
  const items = Array.from({ length: n }, () => ({ x: a.min[0] + r() * (a.max[0] - a.min[0]), z: a.min[2] + r() * (a.max[2] - a.min[2]), y: r(), spin: r() * 6.28, v: 0.7 + r() * 0.6 }));
  const H = Math.min(1.6, a.max[1] - a.min[1]);
  const W = a.max[0] - a.min[0], D = a.max[2] - a.min[2];
  const wrap = (v: number, lo: number, len: number): number => lo + ((((v - lo) % len) + len) % len);
  const euler = new THREE.Euler();
  let t = 0;
  return {
    update(dt) {
      t += dt;
      items.forEach((it, i) => {
        // 風に乗って進む。部屋の端を出たら風上の端から（軸ごとに回す）
        it.x = wrap(it.x + dx * speed * it.v * dt, a.min[0], W);
        it.z = wrap(it.z + dz * speed * it.v * dt, a.min[2], D);
        const y = a.min[1] + 0.05 + (0.5 + 0.5 * Math.sin(t * 1.3 * it.v + it.spin)) * H * it.y;
        pos.set(it.x, y, it.z);
        euler.set(Math.sin(t * 3 + it.spin) * 1.2 - Math.PI / 2, t * 2 * it.v + it.spin, Math.cos(t * 2.3 + it.spin) * 0.8);
        q.setFromEuler(euler);
        scl.set(1, 1, 1);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 湯気（T09 去った人の残り・E07 白い息）
defineFx('steam', ({ p, ctx, seed }) => {
  const at = (p.items as number[][] | undefined) ?? [];
  if (!at.length) return null;
  const per = 4;
  const geo = new THREE.PlaneGeometry(0.12, 0.12);
  const mat = glowMaterial(0xf4f4f4, 0.22, { map: cloudTexture() });
  const mesh = particles(ctx, geo, mat, at.length * per);
  const r = prng(seed);
  const wisps = at.flatMap((x) => Array.from({ length: per }, (_v, k) => ({ x: x[0]!, y: x[1]!, z: x[2]!, t: k / per + r() * 0.1, w: r() * 6.28 })));
  return {
    update(dt) {
      if (ctx.camera) q.copy(ctx.camera.quaternion);
      wisps.forEach((w, i) => {
        w.t = (w.t + dt / 2.6) % 1;
        const s = 0.5 + w.t * 1.8;
        pos.set(w.x + Math.sin(w.t * 5 + w.w) * 0.03, w.y + w.t * 0.4, w.z + Math.cos(w.t * 4 + w.w) * 0.03);
        scl.set(s, s, s);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      // 消えていく: 1 つの材質なので全体の濃さだけ揺らす
      mat.opacity = 0.18 + 0.05 * Math.sin(performance.now() / 700);
    },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 流れ落ちる砂・水（E11 砂の部屋）
defineFx('streams', ({ p, ctx }) => {
  const at = (p.items as number[][] | undefined) ?? [];
  if (!at.length) return null;
  const tex = cloudTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(1, 3);
  const mat = glowMaterial(num(p.color, 0xd9c28f), num(p.opacity, 0.8), { map: tex });
  const meshes: THREE.Mesh[] = [];
  const geos: THREE.BufferGeometry[] = [];
  for (const [x, z, rad, y0, y1] of at) {
    const g = new THREE.CylinderGeometry(rad!, rad! * 1.4, y1! - y0!, 10, 1, true);
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x!, (y0! + y1!) / 2, z!);
    ctx.root.add(m);
    meshes.push(m);
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      tex.offset.set(0, (t * num(p.speed, 1.6)) % 1);
    },
    dispose() { for (const m of meshes) m.removeFromParent(); for (const g of geos) g.dispose(); mat.dispose(); tex.dispose(); },
  };
});

// ---------------------------------------------------------------- 煙の層（E02 炎と煙）
/**
 * 天井から y0 までの煙の層。外から見ると部屋の上半分が灰色に埋まっている。目（カメラ）が y0 より上にあると霧が濃くなり前が見えない。
 * しゃがむ（目 0.75 m）と煙の下が見える
 */
defineFx('smoke', ({ p, ctx, room, seed, key, rects }) => {
  const y0 = num(p.y0, room.min[1] + 1.25), y1 = num(p.y1, room.max[1]);
  const color = num(p.color, 0x6a6764);
  const layers = Math.max(3, Math.round(num(p.layers, 7)));
  // 煙の板は床の矩形ごと（L 字の部屋の外形の欠けた隅に出さない）。柄は 3 m で 1 回
  const geo = plateGeo(rects, 3);
  const r = prng(seed);
  const meshes: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; tex: THREE.Texture; v: [number, number] }[] = [];
  for (let i = 0; i < layers; i++) {
    const k = i / (layers - 1);
    const tex = cloudTexture().clone();
    tex.needsUpdate = true;
    // いちばん下の層は濃く（煙の底の面が見える）
    const mat = glowMaterial(color, i === 0 ? 0.55 : 0.32, { map: tex });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, y0 + (y1 - y0) * k * 0.92 + 0.02, 0);
    ctx.root.add(m);
    meshes.push({ m, mat, tex, v: [(r() - 0.5) * 0.05, (r() - 0.5) * 0.05] });
  }
  const fogColor = new THREE.Color(color);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const x of meshes) {
        x.tex.offset.set(x.v[0] * t, x.v[1] * t);
        // 層が少し上下に揺れる
        x.m.position.y += Math.sin(t * 0.5 + x.v[0] * 40) * 0.0008;
      }
      const eye = eyeOf(ctx);
      if (!eye || !inRoom(rects, { min: [room.min[0], room.min[1] - 1, room.min[2]], max: [room.max[0], room.max[1] + 1, room.max[2]] }, eye)) return;
      const k = smooth(y0 - 0.05, y0 + 0.3, eye.y);
      const fog = ctx.scene?.fog as THREE.Fog | undefined;
      if (fog && k > 0) {
        fog.color.lerp(fogColor, k);
        fog.near = fog.near + (0.05 - fog.near) * k;
        fog.far = fog.far + (num(p.far, 1.6) - fog.far) * k;
        if (ctx.scene?.background instanceof THREE.Color) ctx.scene.background.copy(fog.color);
      }
      ctx.postfx?.setRoomGrade(key, { haze: { color, amount: 0.45 * k }, saturation: 1 - 0.35 * k, vignette: 0.15 + 0.25 * k });
    },
    dispose() { for (const x of meshes) { x.m.removeFromParent(); x.mat.dispose(); x.tex.dispose(); } geo.dispose(); },
  };
});

// ---------------------------------------------------------------- 画面の色（部屋にいる間だけ）
/** 部屋（aabb があればその範囲）に目がある間だけ、画面の色 grade を掛ける */
defineFx('grade', ({ p, ctx, room, key, rects }) => {
  const g = p.grade as unknown as RoomGrade;
  if (!g) return null;
  const zone = p.aabb ? aabbOf(p.aabb) : null;
  return {
    update() { if (zone ? inside(zone, eyeOf(ctx), 0.05) : inRoom(rects, room, eyeOf(ctx))) ctx.postfx?.setRoomGrade(key, g); },
    dispose() { ctx.postfx?.setRoomGrade(key, null); },
  };
});

// ---------------------------------------------------------------- 砂の風紋（E11 床の模様がゆっくり変わる）
let RIPPLE: THREE.DataTexture | null = null;
function rippleTexture(): THREE.DataTexture {
  if (RIPPLE) return RIPPLE;
  const W = 64, H = 64;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // 波打つ縞（風紋）: 縞の位置を少し揺らす
    const v = 0.5 + 0.5 * Math.sin(((y + 3 * Math.sin((x / W) * Math.PI * 4)) / H) * Math.PI * 2 * 6);
    const i = (y * W + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(Math.max(0, v - 0.55) * 2.2 * 255);
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  RIPPLE = t;
  return t;
}

defineFx('ripples', ({ p, ctx, room, rects }) => {
  const geo = plateGeo(rects, 1.6);
  const tex = rippleTexture().clone();
  tex.needsUpdate = true;
  // 縞は影の色の半透明（明るい砂の上に暗い筋）
  const mat = glowMaterial(num(p.color, 0x9c8458), num(p.opacity, 0.35), { map: tex });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, num(p.y, room.min[1] + 0.12), 0);
  ctx.root.add(m);
  const speed = num(p.speed, 0.025);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      // 縞がゆっくり流れ、向きも少しずつ回る（床の模様が変わっていく）
      tex.offset.set(Math.sin(t * 0.05) * 0.3, (t * speed) / 1.6);
      tex.rotation = Math.sin(t * 0.03) * 0.5;
    },
    dispose() { m.removeFromParent(); geo.dispose(); mat.dispose(); tex.dispose(); },
  };
});

// ---------------------------------------------------------------- 温度（E07）
/** 冷たい側（cold）から暖かい側（warm）へ: 冷たい所では画面の縁が凍って青く、白い息が出る。暖かい所では赤みが差す */
defineFx('thermal', ({ p, ctx, room, seed, key, rects }) => {
  const cold = (p.cold as number[] | undefined) ?? [room.min[0], room.min[2]];
  const warm = (p.warm as number[] | undefined) ?? [room.max[0], room.max[2]];
  const ex = warm[0]! - cold[0]!, ez = warm[1]! - cold[1]!;
  const l2 = Math.max(1e-6, ex * ex + ez * ez);
  const frostMax = num(p.frost, 0.85);
  // 白い息（目の前に湯気の粒）
  const geo = new THREE.PlaneGeometry(0.16, 0.16);
  const mat = glowMaterial(0xf2f6fa, 0.0, { map: cloudTexture() });
  const puff = new THREE.Mesh(geo, mat);
  puff.frustumCulled = false;
  ctx.root.add(puff);
  const r = prng(seed);
  let breath = r() * 3, life = -1;
  return {
    update(dt) {
      const eye = eyeOf(ctx);
      if (!eye || !inRoom(rects, room, eye)) { mat.opacity = 0; return; }
      const t = Math.max(0, Math.min(1, ((eye.x - cold[0]!) * ex + (eye.z - cold[1]!) * ez) / l2));
      const c = 1 - t;
      ctx.postfx?.setRoomGrade(key, {
        frost: frostMax * c ** 1.4,
        tint: [0.86 + 0.28 * t, 0.95 + 0.02 * t, 1.14 - 0.3 * t],
        saturation: 0.85 + 0.25 * t,
      });
      // 寒い所では 3 秒ごとに白い息
      breath -= dt;
      if (breath <= 0 && c > 0.45) { breath = 2.6 + r() * 1.2; life = 0; }
      if (life >= 0 && ctx.camera) {
        life += dt / 1.4;
        const f = new THREE.Vector3(0, -0.12, -0.32 - life * 0.3).applyQuaternion(ctx.camera.quaternion);
        puff.position.copy(eye).add(f);
        puff.quaternion.copy(ctx.camera.quaternion);
        puff.scale.setScalar(0.6 + life * 1.6);
        mat.opacity = 0.35 * Math.sin(Math.min(1, life) * Math.PI) * c;
        if (life >= 1) { life = -1; mat.opacity = 0; }
      }
    },
    dispose() { ctx.postfx?.setRoomGrade(key, null); puff.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 鏡の中の人影（W16 鏡の部屋）
/**
 * 鏡の面（axis の座標 at）の向こう側に、カメラを鏡写しにした位置で人影を描く。鏡の中の部屋（同じ形の半分）に入れるが、
 * 向こうへ入ると、人影はこちら側に現れる。しゃがむと人影も低くなる
 */
defineFx('figure', ({ p, ctx, room, rects }) => {
  const axis = str(p.axis, 'x');
  const at = num(p.at, 0);
  const mat = new THREE.MeshLambertMaterial({ color: num(p.color, 0x2a2c30) });
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const part = (g: THREE.BufferGeometry, x: number, y: number, z: number): void => { geos.push(g); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); group.add(m); };
  part(new THREE.BoxGeometry(0.4, 0.62, 0.24), 0, 1.18, 0);
  part(new THREE.BoxGeometry(0.15, 0.82, 0.16), -0.1, 0.42, 0);
  part(new THREE.BoxGeometry(0.15, 0.82, 0.16), 0.1, 0.42, 0);
  part(new THREE.BoxGeometry(0.1, 0.62, 0.1), -0.27, 1.15, 0);
  part(new THREE.BoxGeometry(0.1, 0.62, 0.1), 0.27, 1.15, 0);
  part(new THREE.SphereGeometry(0.13, 14, 10), 0, 1.64, 0);
  group.visible = false;
  ctx.root.add(group);
  const floorY = num(p.floorY, room.min[1]);
  return {
    update() {
      const eye = eyeOf(ctx);
      if (!eye || !ctx.camera || !inRoom(rects, room, eye)) { group.visible = false; return; }
      const mx = axis === 'x' ? 2 * at - eye.x : eye.x, mz = axis === 'z' ? 2 * at - eye.z : eye.z;
      if (mx < room.min[0] + 0.2 || mx > room.max[0] - 0.2 || mz < room.min[2] + 0.2 || mz > room.max[2] - 0.2 || Math.abs((axis === 'x' ? eye.x : eye.z) - at) < 0.25) { group.visible = false; return; }
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(ctx.camera.quaternion);
      const fx = axis === 'x' ? -f.x : f.x, fz = axis === 'z' ? -f.z : f.z;
      group.visible = true;
      group.position.set(mx, floorY, mz);
      group.rotation.y = Math.atan2(fx, fz);
      group.scale.set(1, Math.max(0.45, (eye.y - floorY + 0.12) / 1.72), 1);
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 近づくと大きくなる物（W15 遠近法の錯覚）
/**
 * 箱の組を、目からの距離で大きさを変えて描く: from m より遠いと far 倍、to m まで近づくと 1 倍（間はなめらかに）。
 * 足元の点 anchor を中心に大きくする（壁に付いた扉は壁と床に付いたまま）
 */
defineFx('grow', ({ p, ctx }) => {
  const boxes = (p.boxes as unknown as Box[] | undefined) ?? [];
  if (!boxes.length) return null;
  const a = (p.anchor as number[] | undefined) ?? [0, 0, 0];
  const { group, geos } = boxesGroup(ctx, boxes, [a[0]!, a[1]!, a[2]!]);
  ctx.root.add(group);
  const far = num(p.far, 0.5), from = num(p.from, 8), to = num(p.to, 1.6);
  return {
    update() {
      const eye = eyeOf(ctx);
      const d = eye ? Math.hypot(eye.x - a[0]!, eye.z - a[2]!) : from;
      const k = smooth(to, from, d);
      group.scale.setScalar(1 + (far - 1) * k);
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});

// ---------------------------------------------------------------- 場所で変わる画面の色（T08 古くなる）
/** 点 from（入口）から to（奥）へ進むほど、画面の色を a から b へ変える（部屋にいる間だけ） */
defineFx('gradient', ({ p, ctx, room, key, rects }) => {
  const f = (p.from as number[] | undefined) ?? [room.min[0], room.min[2]];
  const t2 = (p.to as number[] | undefined) ?? [room.max[0], room.max[2]];
  const a = (p.a ?? {}) as unknown as RoomGrade, b = (p.b ?? {}) as unknown as RoomGrade;
  const ex = t2[0]! - f[0]!, ez = t2[1]! - f[1]!, l2 = Math.max(1e-6, ex * ex + ez * ez);
  const mix = (x: number | undefined, y: number | undefined, d: number, k: number): number => (x ?? d) + ((y ?? d) - (x ?? d)) * k;
  return {
    update() {
      const eye = eyeOf(ctx);
      if (!eye || !inRoom(rects, room, eye)) return;
      const k = Math.max(0, Math.min(1, ((eye.x - f[0]!) * ex + (eye.z - f[1]!) * ez) / l2));
      const ta = a.tint ?? [1, 1, 1], tb = b.tint ?? [1, 1, 1];
      ctx.postfx?.setRoomGrade(key, {
        saturation: mix(a.saturation, b.saturation, 1, k), contrast: mix(a.contrast, b.contrast, 1, k), vignette: mix(a.vignette, b.vignette, 0, k), frost: mix(a.frost, b.frost, 0, k),
        tint: [ta[0] + (tb[0] - ta[0]) * k, ta[1] + (tb[1] - ta[1]) * k, ta[2] + (tb[2] - ta[2]) * k],
      });
    },
    dispose() { ctx.postfx?.setRoomGrade(key, null); },
  };
});

// ---------------------------------------------------------------- 回る物（X11 宙で回る家具・T09 回る扇風機）
defineFx('spin', ({ p, ctx }) => {
  const boxes = (p.boxes as unknown as Box[] | undefined) ?? [];
  if (!boxes.length) return null;
  const c = (p.center as number[] | undefined) ?? [0, 0, 0];
  const { group, geos } = boxesGroup(ctx, boxes, [c[0]!, c[1]!, c[2]!]);
  ctx.root.add(group);
  const axis = str(p.axis, 'y');
  const speed = num(p.speed, 0.4);
  const bob = num(p.bob, 0);
  const y = c[1]!;
  let t = 0;
  return {
    update(dt) {
      t += dt;
      if (axis === 'x') group.rotation.x = t * speed;
      else if (axis === 'z') group.rotation.z = t * speed;
      else group.rotation.y = t * speed;
      if (bob) { group.position.y = y + Math.sin(t * 0.8) * bob; group.rotation.z = Math.sin(t * 0.37) * 0.15; }
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});
