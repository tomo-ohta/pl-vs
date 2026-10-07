import * as THREE from 'three';
import type { Builder, PartOptions, V3 } from '../../scenes/Builder.ts';
import { Seg, type ViewCam } from '../../scenes/corridor/kit.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 廊下 1 本（参考画像 1 枚ぶん）の座標系。元の版の Seg（原点のずれだけ）に、Y 軸回りの回転（90° 単位）を足したもの。
 * 区域の座標は元の版と同じ（目の真下が原点、奥が -Z、左が -X）。yaw は視点の yaw と同じ向き（0 で -Z、π/2 で -X を向く）。
 * 90° 単位なので、箱は回しても軸に沿ったまま（当たり判定もそのまま箱）。
 */
export class Leg extends Seg {
  readonly yaw: number;
  /** 回転の cos・sin（90° 単位なので -1 / 0 / 1） */
  readonly c: number;
  readonly s: number;

  constructor(b: Builder, ctx: SceneContext, origin: V3, cam: ViewCam, yaw: number) {
    super(b, ctx, origin, cam);
    this.yaw = yaw;
    this.c = Math.round(Math.cos(yaw));
    this.s = Math.round(Math.sin(yaw));
  }

  /** 区域の向き（x, z）→ 場面の向き */
  dir(x: number, z: number): [number, number] {
    return [x * this.c + z * this.s, -x * this.s + z * this.c];
  }

  /** 場面の点 → 区域の点（逆変換） */
  local(p: V3): V3 {
    const dx = p[0] - this.origin[0];
    const dz = p[2] - this.origin[2];
    return [dx * this.c - dz * this.s, p[1] - this.origin[1], dx * this.s + dz * this.c];
  }

  override w(p: V3): V3 {
    const [x, z] = this.dir(p[0], p[2]);
    return [x + this.origin[0], p[1] + this.origin[1], z + this.origin[2]];
  }

  override cyl(mat: THREE.Material, center: V3, r: number, len: number, o: PartOptions & { axis?: 'x' | 'y' | 'z'; radiusTop?: number; segments?: number } = {}): THREE.Mesh {
    let axis = o.axis;
    if (this.s !== 0 && (axis === 'x' || axis === 'z')) axis = axis === 'x' ? 'z' : 'x';
    return this.b.cyl(mat, this.w(center), r, len, { shadow: 'receive', ...o, axis });
  }

  /** 任意の形: 区域の回転（と呼ぶ側の rotX/Y/Z）を形に焼き込んでから置く */
  override mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, o: PartOptions = {}): THREE.Mesh {
    if (o.rotX || o.rotY || o.rotZ) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rotX ?? 0, o.rotY ?? 0, o.rotZ ?? 0)));
    if (this.yaw) geo.rotateY(this.yaw);
    return this.b.mesh(geo, mat, this.w(pos), { shadow: 'receive', ...o, rotX: 0, rotY: 0, rotZ: 0 });
  }

  /** 参考画像の上でなぞった多角形を面に貼る（元の版と同じ。面の向きの判定だけ回転に合わせる） */
  override paint(mat: THREE.Material, axis: 'x' | 'y' | 'z', v: number, pts: [number, number][], o: PartOptions = {}): THREE.Mesh | null {
    if (pts.length < 3) return null;
    const contour = pts.map(([x, y]) => new THREE.Vector2(x, y));
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const p: number[] = [];
    const nl: [number, number, number] = axis === 'x' ? [Math.sign(-v) || 1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    const [nx, nz] = this.dir(nl[0], nl[2]);
    const n = new THREE.Vector3(nx, nl[1], nz);
    for (const t of tris) {
      const vs = t.map((i) => this.w(this.cam.hit(contour[i].x, contour[i].y, axis, v)));
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
}
