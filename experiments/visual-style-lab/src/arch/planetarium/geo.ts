import * as THREE from 'three';

export type V3 = [number, number, number];

/**
 * 三角形を足していく形の入れ物（段床・壁の帯など、曲がった面を細かい四角で作る）。法線は面ごと（平らな面に見える）。
 * uv は 0（材質の模様はワールド座標で描くので使わない）
 */
export class GeoBuf {
  readonly pos: number[] = [];

  tri(a: V3, b: V3, c: V3): void {
    this.pos.push(...a, ...b, ...c);
  }

  /** 四角（a → b → c → d の順。表は右手系で外向き） */
  quad(a: V3, b: V3, c: V3, d: V3): void {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  get empty(): boolean {
    return this.pos.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((this.pos.length / 3) * 2), 2));
    return g;
  }
}

/** 舞台の中心からの角度 a（-Z が 0、+X が正）と半径 r の点 */
export function pt(r: number, a: number, y: number): V3 {
  return [r * Math.sin(a), y, -r * Math.cos(a)];
}

/** 中心 (cx, cz) のまわりの点（角度は同じ約束） */
export function ptAt(cx: number, cz: number, r: number, a: number, y: number): V3 {
  return [cx + r * Math.sin(a), y, cz - r * Math.cos(a)];
}

/** 決まった乱数 */
export function hash(i: number, j = 0): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
