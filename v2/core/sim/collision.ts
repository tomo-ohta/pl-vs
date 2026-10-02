/**
 * 当たり判定の置き場所。
 * - 静的な箱（壁・床・家具）は XZ の一様格子に入れて、近くの箱だけを素早く引く（フロア全体で数千個になるため）
 * - 動く箱（扉・動く床・現れた隠し）は部品が key ごとに出し入れする。数が少ないので総当たりで足す
 */
import type { AABB } from '../math/aabb.ts';

const CELL = 2;

export class ColliderIndex {
  private readonly grid = new Map<number, AABB[]>();
  private readonly dynamic = new Map<string, AABB>();
  private staticCount = 0;

  /** 格子の番号（x, z をそれぞれ 16bit に詰める。フロアは ±65 km まで） */
  private static key(ix: number, iz: number): number {
    return ((ix + 32768) & 0xffff) * 65536 + ((iz + 32768) & 0xffff);
  }

  addStatic(b: AABB): void {
    const ix0 = Math.floor(b.min[0] / CELL);
    const ix1 = Math.floor(b.max[0] / CELL);
    const iz0 = Math.floor(b.min[2] / CELL);
    const iz1 = Math.floor(b.max[2] / CELL);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = ColliderIndex.key(ix, iz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(b);
      }
    }
    this.staticCount++;
  }

  /** 動く箱を置く・動かす（null で外す） */
  setDynamic(key: string, b: AABB | null): void {
    if (b) this.dynamic.set(key, b);
    else this.dynamic.delete(key);
  }

  get counts(): { static: number; dynamic: number } {
    return { static: this.staticCount, dynamic: this.dynamic.size };
  }

  /** 範囲に掛かる箱（重複なし） */
  query(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, out: AABB[] = []): AABB[] {
    out.length = 0;
    const seen = new Set<AABB>();
    const ix0 = Math.floor(minX / CELL);
    const ix1 = Math.floor(maxX / CELL);
    const iz0 = Math.floor(minZ / CELL);
    const iz1 = Math.floor(maxZ / CELL);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const list = this.grid.get(ColliderIndex.key(ix, iz));
        if (!list) continue;
        for (const b of list) {
          if (seen.has(b)) continue;
          if (b.max[0] < minX || b.min[0] > maxX || b.max[1] < minY || b.min[1] > maxY || b.max[2] < minZ || b.min[2] > maxZ) continue;
          seen.add(b);
          out.push(b);
        }
      }
    }
    for (const b of this.dynamic.values()) {
      if (b.max[0] < minX || b.min[0] > maxX || b.max[1] < minY || b.min[1] > maxY || b.max[2] < minZ || b.min[2] > maxZ) continue;
      out.push(b);
    }
    return out;
  }

  /** 点を含む箱があるか（到達判定・置き場所の検査用） */
  pointBlocked(x: number, y: number, z: number): boolean {
    for (const b of this.query(x, y, z, x, y, z)) {
      if (x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2]) return true;
    }
    return false;
  }
}
