import * as THREE from 'three';
import type { StyleMaterialOptions } from '../../render/StyleMaterial.ts';
import type { Builder, PartOptions, V3 } from '../Builder.ts';
import type { SceneContext } from '../types.ts';

/**
 * 病院の廊下の道具: 参考画像の視点のカメラ（画像の座標から面の上の点を求める）・面ごとに材質を変える箱・任意の四角形。
 * 区域（参考画像 1 枚ぶんの廊下）はそれぞれの座標で作り、原点をずらして置く。
 */

export const IMG_W = 1456;
export const IMG_H = 816;

/** 参考画像の視点（three と同じ YXZ。yaw = 0 で -Z）。区域の座標で持つ */
export class ViewCam {
  readonly f: number;
  private readonly q: THREE.Quaternion;
  private readonly qi: THREE.Quaternion;
  constructor(
    readonly eye: V3,
    readonly yaw: number,
    readonly pitch: number,
    readonly fov: number,
    readonly roll = 0,
  ) {
    this.f = IMG_H / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    this.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
    this.qi = this.q.clone().invert();
  }
  /** 画像の画素（左上が原点）を通る視線の向き */
  ray(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x - IMG_W / 2) / this.f, -(y - IMG_H / 2) / this.f, -1).applyQuaternion(this.q).normalize();
  }
  /** 画素の視線と、軸に垂直な面（axis = v）の交点 */
  hit(x: number, y: number, axis: 'x' | 'y' | 'z', v: number): V3 {
    const r = this.ray(x, y);
    const a = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const ra = [r.x, r.y, r.z][a];
    const t = (v - this.eye[a]) / (Math.abs(ra) < 1e-9 ? 1e-9 : ra);
    return [this.eye[0] + r.x * t, this.eye[1] + r.y * t, this.eye[2] + r.z * t];
  }
  /** 床（高さ h）の点の [x, z] */
  floor(x: number, y: number, h = 0): [number, number] {
    const p = this.hit(x, y, 'y', h);
    return [p[0], p[2]];
  }
  /** 区域の座標の点を画像の画素へ */
  proj(p: V3): [number, number] {
    const c = new THREE.Vector3(p[0] - this.eye[0], p[1] - this.eye[1], p[2] - this.eye[2]).applyQuaternion(this.qi);
    return [IMG_W / 2 + (this.f * c.x) / -c.z, IMG_H / 2 - (this.f * c.y) / -c.z];
  }
}

export type FaceKey = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
export type FaceMats = Partial<Record<FaceKey, THREE.Material | null>>;

/** 区域: Builder に原点のずれを足して置く。影は既定で受けるだけ（落とす物は shadow: true） */
export class Seg {
  constructor(
    readonly b: Builder,
    readonly ctx: SceneContext,
    readonly origin: V3,
    readonly cam: ViewCam,
  ) {}

  w(p: V3): V3 {
    return [p[0] + this.origin[0], p[1] + this.origin[1], p[2] + this.origin[2]];
  }

  box(mat: THREE.Material, min: V3, max: V3, o: PartOptions = {}): THREE.Mesh {
    return this.b.boxMM(mat, this.w(min), this.w(max), { shadow: 'receive', ...o });
  }

  cyl(mat: THREE.Material, center: V3, r: number, len: number, o: PartOptions & { axis?: 'x' | 'y' | 'z'; radiusTop?: number; segments?: number } = {}): THREE.Mesh {
    return this.b.cyl(mat, this.w(center), r, len, { shadow: 'receive', ...o });
  }

  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, o: PartOptions = {}): THREE.Mesh {
    return this.b.mesh(geo, mat, this.w(pos), { shadow: 'receive', ...o });
  }

  /**
   * 参考画像の外接矩形（画素）から、面（axis = v）の上の長方形を求める。
   * 奥へ向かう壁（axis 'x'）では、横の範囲を中ほどの高さで、縦の範囲を手前の縁で測る。
   */
  rectOn(axis: 'x' | 'z', v: number, x0: number, y0: number, x1: number, y1: number): { c: V3; w: number; h: number } {
    const cam = this.cam;
    const ym = (y0 + y1) / 2;
    if (axis === 'x') {
      const a = cam.hit(x0, ym, 'x', v);
      const b = cam.hit(x1, ym, 'x', v);
      // 手前の縁（z が大きい方）
      const nearX = a[2] > b[2] ? x0 : x1;
      const t = cam.hit(nearX, y0, 'x', v);
      const u = cam.hit(nearX, y1, 'x', v);
      return { c: [v, (t[1] + u[1]) / 2, (a[2] + b[2]) / 2], w: Math.abs(a[2] - b[2]), h: Math.abs(t[1] - u[1]) };
    }
    const xm = (x0 + x1) / 2;
    const a = cam.hit(x0, ym, 'z', v);
    const b = cam.hit(x1, ym, 'z', v);
    const t = cam.hit(xm, y0, 'z', v);
    const u = cam.hit(xm, y1, 'z', v);
    return { c: [(a[0] + b[0]) / 2, (t[1] + u[1]) / 2, v], w: Math.abs(a[0] - b[0]), h: Math.abs(t[1] - u[1]) };
  }

  /** 参考画像の外接矩形の位置に紙を貼る（n は面の向き。'+x' なら x = v の面の +x 側） */
  sheetImg(mat: THREE.Material, n: '+x' | '-x' | '+z', v: number, box: [number, number, number, number], uv?: [number, number, number, number], rot = 0, shrink = 0.92): THREE.Mesh {
    const r = this.rectOn(n === '+z' ? 'z' : 'x', v, ...box);
    return this.sheet(mat, n, r.c, r.w * shrink, r.h * shrink, uv, {}, rot);
  }

  /**
   * 参考画像の上でなぞった多角形（画素座標、凹でもよい）を、面（axis = v）の上に貼る。
   * 描いた影・光の形に使う（形は参考画像から測って手で単純化した値）。
   */
  paint(mat: THREE.Material, axis: 'x' | 'y' | 'z', v: number, pts: [number, number][], o: PartOptions = {}): THREE.Mesh | null {
    if (pts.length < 3) return null;
    const contour = pts.map(([x, y]) => new THREE.Vector2(x, y));
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const p: number[] = [];
    const n = axis === 'x' ? new THREE.Vector3(Math.sign(-v) || 1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    for (const t of tris) {
      const vs = t.map((i) => this.w(this.cam.hit(contour[i].x, contour[i].y, axis, v)));
      // 面の向き（n の側から見て反時計回り）にそろえる
      const a = new THREE.Vector3(...vs[0]);
      const b = new THREE.Vector3(...vs[1]);
      const c = new THREE.Vector3(...vs[2]);
      const nn = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (nn.dot(n) < 0) p.push(...vs[0], ...vs[2], ...vs[1]);
      else p.push(...vs[0], ...vs[1], ...vs[2]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((p.length / 3) * 2).fill(0), 2));
    g.computeVertexNormals();
    return this.b.mesh(g, mat, [0, 0, 0], { shadow: 'receive', ...o });
  }

  /** 当たり判定だけ */
  collider(min: V3, max: V3): void {
    const a = this.w(min);
    const c = this.w(max);
    this.ctx.colliders.add({ x: a[0], y: a[1], z: a[2] }, { x: c[0], y: c[1], z: c[2] });
  }

  /**
   * 面ごとに材質を変えられる箱（見えない面は省ける）。mats に無い面は def の材質、def も無ければ作らない。
   * 当たり判定は箱全体で 1 つ。
   */
  faces(min: V3, max: V3, mats: FaceMats, o: PartOptions & { def?: THREE.Material | null } = {}): void {
    const [x0, y0, z0] = [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])];
    const [x1, y1, z1] = [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])];
    const sx = x1 - x0;
    const sy = y1 - y0;
    const sz = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const cz = (z0 + z1) / 2;
    const po: PartOptions = { shadow: 'receive', ...o, collide: false };
    const put = (k: FaceKey, geo: THREE.BufferGeometry, pos: V3): void => {
      const m = k in mats ? mats[k] : o.def;
      if (!m) {
        geo.dispose();
        return;
      }
      this.mesh(geo, m, pos, po);
    };
    put('px', new THREE.PlaneGeometry(sz, sy).rotateY(Math.PI / 2), [x1, cy, cz]);
    put('nx', new THREE.PlaneGeometry(sz, sy).rotateY(-Math.PI / 2), [x0, cy, cz]);
    put('py', new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), [cx, y1, cz]);
    put('ny', new THREE.PlaneGeometry(sx, sz).rotateX(Math.PI / 2), [cx, y0, cz]);
    put('pz', new THREE.PlaneGeometry(sx, sy), [cx, cy, z1]);
    put('nz', new THREE.PlaneGeometry(sx, sy).rotateY(Math.PI), [cx, cy, z0]);
    if (o.collide) this.collider([x0, y0, z0], [x1, y1, z1]);
  }

  /** 任意の平らな四角形（a→b→c→d が表から見て反時計回り）。uv は a=(0,0) b=(1,0) c=(1,1) d=(0,1) */
  quad(mat: THREE.Material, a: V3, bb: V3, c: V3, d: V3, o: PartOptions = {}, uv?: [number, number, number, number]): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    const p = [a, bb, c, a, c, d].flatMap((v) => this.w(v));
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const [u0, v0, u1, v1] = uv ?? [0, 0, 1, 1];
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
    g.computeVertexNormals();
    return this.b.mesh(g, mat, [0, 0, 0], { shadow: 'receive', ...o });
  }

  /** 多角形（扇形に分ける。凸の形） */
  poly(mat: THREE.Material, pts: V3[], o: PartOptions = {}): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    const p: number[] = [];
    for (let i = 1; i < pts.length - 1; i++) p.push(...this.w(pts[0]), ...this.w(pts[i]), ...this.w(pts[i + 1]));
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((p.length / 3) * 2).fill(0), 2));
    g.computeVertexNormals();
    return this.b.mesh(g, mat, [0, 0, 0], { shadow: 'receive', ...o });
  }

  /**
   * 壁に貼る板（紙・掲示）。axis の面に平行、向き n（'+x' など）。
   * c は中心、w・h は横・縦（m）。uv は図柄の範囲。
   */
  sheet(mat: THREE.Material, n: '+x' | '-x' | '+z' | '-z' | '+y' | '-y', c: V3, w: number, h: number, uv?: [number, number, number, number], o: PartOptions = {}, rot = 0): THREE.Mesh {
    const g = new THREE.PlaneGeometry(w, h);
    if (rot) g.rotateZ(rot);
    if (uv) {
      const at = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < at.count; i++) at.setXY(i, uv[0] + at.getX(i) * (uv[2] - uv[0]), uv[1] + at.getY(i) * (uv[3] - uv[1]));
    }
    if (n === '+x') g.rotateY(Math.PI / 2);
    if (n === '-x') g.rotateY(-Math.PI / 2);
    if (n === '-z') g.rotateY(Math.PI);
    if (n === '+y') g.rotateX(-Math.PI / 2);
    if (n === '-y') g.rotateX(Math.PI / 2);
    return this.mesh(g, mat, c, { shadow: 'receive', ...o });
  }
}

/** 材質の作り方の既定（線の重みなど） */
export function matFn(ctx: SceneContext) {
  return (o: StyleMaterialOptions): THREE.MeshStandardMaterial => ctx.mat({ line: 0.5, ...o });
}

/**
 * 掲示物の図柄を 1 枚のキャンバスにまとめる（材質 1 つで描ける）。
 * add で領域を取り、描く関数を渡す。uv は [u0, v0, u1, v1]。
 */
export class Atlas {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  private x = 0;
  private y = 0;
  private rowH = 0;
  constructor(readonly size = 2048, private readonly pad = 6) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.g = this.canvas.getContext('2d')!;
    this.g.fillStyle = '#ffffff';
    this.g.fillRect(0, 0, size, size);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.tex.generateMipmaps = true;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter;
  }
  /** w×h 画素の領域を取り、draw(g, w, h) で描く（原点は領域の左上） */
  add(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): [number, number, number, number] {
    const p = this.pad;
    if (this.x + w + p * 2 > this.size) {
      this.x = 0;
      this.y += this.rowH;
      this.rowH = 0;
    }
    if (this.y + h + p * 2 > this.size) throw new Error('Atlas: 領域が足りない');
    const x0 = this.x + p;
    const y0 = this.y + p;
    const g = this.g;
    g.save();
    g.translate(x0, y0);
    g.beginPath();
    g.rect(-p, -p, w + p * 2, h + p * 2);
    g.clip();
    draw(g, w, h);
    g.restore();
    // 縁の色を外側へ広げる（ミップマップのにじみ止め）
    const edge = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void => g.drawImage(this.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
    edge(x0, y0, w, 1, x0, y0 - p, w, p);
    edge(x0, y0 + h - 1, w, 1, x0, y0 + h, w, p);
    edge(x0, y0 - p, 1, h + p * 2, x0 - p, y0 - p, p, h + p * 2);
    edge(x0 + w - 1, y0 - p, 1, h + p * 2, x0 + w, y0 - p, p, h + p * 2);
    this.x += w + p * 2;
    this.rowH = Math.max(this.rowH, h + p * 2);
    const S = this.size;
    return [x0 / S, 1 - (y0 + h) / S, (x0 + w) / S, 1 - y0 / S];
  }
}

/** 決まった乱数 */
export function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 描いた影・光の形の材質（照明なし・線なし・面より少し手前に描く） */
export function paintMaterial(ctx: SceneContext, color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const m = ctx.mat({ color, unlit: true, line: 0 });
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -4;
  return m;
}
