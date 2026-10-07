import * as THREE from 'three';

/** 当たり判定の箱（軸に沿った直方体）。床も壁も同じ箱で表す。 */
export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** 水の中など、歩けるが遅くなる所 */
  slow?: number;
  /** false の間は無いことにする（開いた扉など）。既定 true */
  enabled?: boolean;
  /** 近づくと開く扉の閉じた板（鍵の掛かっていない扉）。歩いて行けるかの確かめでは通れる物として扱う */
  passable?: boolean;
  /** 水の中の床なら水深（m）。歩いて行けるかの確かめで「泳がないと行けない所」を分けるのに使う */
  depth?: number;
}

/**
 * 場面の当たり判定。プレイヤーは足元の高さ（feet）と半径・背の高さで表す。
 * - 床: 体の真下にある箱のうち、足元 + 段差の高さより低い一番高い上面
 * - 壁: 体の高さの範囲（段差より上）に重なる箱から円を押し出す
 */
export class Colliders {
  readonly boxes: Box[] = [];

  add(min: THREE.Vector3Like, max: THREE.Vector3Like, slow?: number): Box {
    const b: Box = {
      min: new THREE.Vector3(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.min(min.z, max.z)),
      max: new THREE.Vector3(Math.max(min.x, max.x), Math.max(min.y, max.y), Math.max(min.z, max.z)),
      slow,
    };
    this.boxes.push(b);
    return b;
  }

  /** 中心と寸法で足す */
  addCentered(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, slow?: number): Box {
    return this.add({ x: cx - sx / 2, y: cy - sy / 2, z: cz - sz / 2 }, { x: cx + sx / 2, y: cy + sy / 2, z: cz + sz / 2 }, slow);
  }

  /** 物の外形（ワールドの包み箱）をそのまま当たり判定にする */
  addObject(obj: THREE.Object3D, pad = 0): Box {
    const bb = new THREE.Box3().setFromObject(obj);
    bb.expandByScalar(pad);
    return this.add(bb.min, bb.max);
  }

  /** 箱を取り除く（切り替えるだけなら box.enabled = false） */
  remove(b: Box): void {
    const i = this.boxes.indexOf(b);
    if (i >= 0) this.boxes.splice(i, 1);
  }

  /**
   * 水平の光線（高さ y）が最初に当たる箱までの距離（当たらなければ maxDist）。間取り図の画角を壁で切るのに使う
   */
  rayXZ(ox: number, oz: number, y: number, dx: number, dz: number, maxDist: number): number {
    let best = maxDist;
    for (const b of this.boxes) {
      if (b.enabled === false || b.slow !== undefined) continue;
      if (y < b.min.y || y > b.max.y) continue;
      let t0 = 0;
      let t1 = best;
      for (const [o, d, lo, hi] of [[ox, dx, b.min.x, b.max.x], [oz, dz, b.min.z, b.max.z]] as const) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) {
            t0 = Infinity;
            break;
          }
        } else {
          let ta = (lo - o) / d;
          let tb = (hi - o) / d;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
        }
      }
      if (t0 <= t1 && t0 < best && t0 > 0.05) best = t0;
    }
    return best;
  }

  clear(): void {
    this.boxes.length = 0;
  }

  /** (x, z) の円の下で、上面が maxY 以下の一番高い床。無ければ -Infinity */
  groundBelow(x: number, z: number, r: number, maxY: number): { y: number; slow: number; depth: number } {
    let best = -Infinity;
    let slow = 1;
    let depth = 0;
    for (const b of this.boxes) {
      if (b.enabled === false) continue;
      if (b.max.y > maxY) continue;
      if (x + r * 0.5 < b.min.x || x - r * 0.5 > b.max.x || z + r * 0.5 < b.min.z || z - r * 0.5 > b.max.z) continue;
      if (b.max.y > best) {
        best = b.max.y;
        slow = b.slow ?? 1;
        depth = b.depth ?? 0;
      }
    }
    return { y: best, slow, depth };
  }

  /** 頭の上の天井（体の上端より上で一番低い下面）。無ければ +Infinity */
  ceilingAbove(x: number, z: number, r: number, minY: number): number {
    let best = Infinity;
    for (const b of this.boxes) {
      if (b.enabled === false) continue;
      if (b.min.y < minY) continue;
      if (x + r < b.min.x || x - r > b.max.x || z + r < b.min.z || z - r > b.max.z) continue;
      best = Math.min(best, b.min.y);
    }
    return best;
  }

  /** 円（中心 p・半径 r）を、高さ [y0, y1] に重なる箱の外へ押し出す。押し出したら true */
  pushOut(p: THREE.Vector3, r: number, y0: number, y1: number): boolean {
    let moved = false;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const b of this.boxes) {
        if (b.enabled === false) continue;
        if (b.slow !== undefined) continue; // 水などは壁にしない
        if (b.max.y <= y0 || b.min.y >= y1) continue;
        const cx = Math.max(b.min.x, Math.min(p.x, b.max.x));
        const cz = Math.max(b.min.z, Math.min(p.z, b.max.z));
        let dx = p.x - cx;
        let dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-10) {
          // 中心が箱の中: 一番近い面へ出す
          const opts = [
            [p.x - b.min.x, -1, 0],
            [b.max.x - p.x, 1, 0],
            [p.z - b.min.z, 0, -1],
            [b.max.z - p.z, 0, 1],
          ];
          opts.sort((a, c) => a[0] - c[0]);
          const [d, sx, sz] = opts[0];
          p.x += sx * (d + r);
          p.z += sz * (d + r);
        } else {
          const d = Math.sqrt(d2);
          dx /= d;
          dz /= d;
          p.x = cx + dx * r;
          p.z = cz + dz * r;
        }
        any = true;
        moved = true;
      }
      if (!any) break;
    }
    return moved;
  }
}
