/**
 * 動かない物をまとめて 1 つの形にする道具（壁・床・札・文字など。描く回数を減らす）。
 * 色は頂点ごと（RGBA）。四角と箱を足していき、build で BufferGeometry にする
 */
import * as THREE from 'three';

export type V3 = readonly [number, number, number];
export type RGBA = readonly [number, number, number, number];
/** 貼る絵の範囲（u0, v0 が左下、u1, v1 が右上） */
export type UvRect = readonly [number, number, number, number];

export const rgba = (hex: number, a = 1): RGBA => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b, a];
};
export const shade = (c: RGBA, k: number): RGBA => [c[0] * k, c[1] * k, c[2] * k, c[3]];

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly uv: number[] = [];
  private readonly idx: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /**
   * 四角: p0 左下・p1 右下・p2 右上・p3 左上（表から見て反時計回り）。
   * colors は 1 色か、頂点ごとの 4 色
   */
  quad(p0: V3, p1: V3, p2: V3, p3: V3, n: V3, color: RGBA | readonly [RGBA, RGBA, RGBA, RGBA], uv: UvRect = [0, 0, 1, 1]): void {
    const base = this.vertexCount;
    const cs = (Array.isArray(color[0]) ? color : [color, color, color, color]) as readonly RGBA[];
    const uvs = [uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]];
    [p0, p1, p2, p3].forEach((p, i) => {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(...cs[i]);
      this.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
    });
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** 軸にそろった箱。bottom / top で上下の色を変えられる（床に近い所を暗くする） */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, bottom: RGBA, top: RGBA = bottom, faces = 0b111111): void {
    const b = bottom;
    const t = top;
    // +x
    if (faces & 1) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [b, b, t, t]);
    // -x
    if (faces & 2) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [b, b, t, t]);
    // +z
    if (faces & 4) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [b, b, t, t]);
    // -z
    if (faces & 8) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [b, b, t, t]);
    // +y
    if (faces & 16) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], t);
    // -y
    if (faces & 32) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], b);
  }

  /** 頂点 [from, to) の色を変える（部屋ごとの帯の色など。build の後は attribute を直接書き換える） */
  static recolor(geo: THREE.BufferGeometry, from: number, to: number, c: RGBA): void {
    const a = geo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = from; i < to; i++) a.setXYZW(i, c[0], c[1], c[2], c[3]);
    a.needsUpdate = true;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
