import * as THREE from 'three';
import type { Builder, PartOptions, V3 } from '../../scenes/Builder.ts';
import type { StyleMaterialOptions } from '../../render/StyleMaterial.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 物を置く小さな座標系（原点と、90° 単位の回転）。家具・設備を「背が -z、正面が +z」の向きで書いて、壁ぞいに回して置く。
 * k = 回転の数（0〜3、上から見て左回り = yaw と同じ向き）。90° 単位なので箱は軸に沿ったまま（当たり判定も箱）。
 */
export class Frame {
  readonly c: number;
  readonly s: number;
  constructor(
    readonly b: Builder,
    readonly o: V3,
    readonly k = 0,
  ) {
    const a = (k * Math.PI) / 2;
    this.c = Math.round(Math.cos(a));
    this.s = Math.round(Math.sin(a));
  }

  /** 局所の点 → 場面の点 */
  w(p: V3): V3 {
    return [p[0] * this.c + p[2] * this.s + this.o[0], p[1] + this.o[1], -p[0] * this.s + p[2] * this.c + this.o[2]];
  }

  /** 局所の座標系の中の小さな座標系（物ごとの位置と向き） */
  sub(x: number, z: number, k = 0, y = 0): Frame {
    return new Frame(this.b, this.w([x, y, z]), (this.k + k) & 3);
  }

  /** 角の座標で箱（局所）。影は既定で落とす・受ける */
  box(mat: THREE.Material, min: V3, max: V3, o: PartOptions = {}): THREE.Mesh {
    const a = this.w(min);
    const b = this.w(max);
    return this.b.boxMM(mat, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])], o);
  }

  /** 円柱（axis は局所の軸） */
  cyl(mat: THREE.Material, center: V3, r: number, len: number, o: PartOptions & { axis?: 'x' | 'y' | 'z'; radiusTop?: number; segments?: number } = {}): THREE.Mesh {
    let axis = o.axis;
    if (this.s !== 0 && (axis === 'x' || axis === 'z')) axis = axis === 'x' ? 'z' : 'x';
    return this.b.cyl(mat, this.w(center), r, len, { ...o, axis });
  }

  /** 板（局所の +z を向く。w × h） */
  sheet(mat: THREE.Material, center: V3, w: number, h: number, o: PartOptions = {}): THREE.Mesh {
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY((this.k * Math.PI) / 2);
    return this.b.mesh(g, mat, this.w(center), { shadow: 'receive', ...o });
  }

  /** 上向きの板（床に描く物。局所の x × z） */
  floorSheet(mat: THREE.Material, center: V3, w: number, d: number, o: PartOptions = {}): THREE.Mesh {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.rotateY((this.k * Math.PI) / 2);
    return this.b.mesh(g, mat, this.w(center), { shadow: 'receive', ...o });
  }
}

/** 材質の置き場（同じ指定は同じ材質 → まとめて描ける） */
export class Mats {
  private readonly cache = new Map<string, THREE.Material>();
  constructor(readonly ctx: SceneContext) {}
  get(o: StyleMaterialOptions): THREE.Material {
    const key = JSON.stringify(o, (_k, v) => (v instanceof THREE.Texture ? v.uuid : v));
    let m = this.cache.get(key);
    if (!m) {
      m = this.ctx.mat(o);
      this.cache.set(key, m);
    }
    return m;
  }
  /** 平らな色（日なた・陰・暗部を明度で作る） */
  flat(color: string, shade?: string, extra: Partial<StyleMaterialOptions> = {}): THREE.Material {
    return this.get({ color, shade: shade ?? color, dark: shade ?? color, hi: color, ...extra });
  }
  unlit(color: string, extra: Partial<StyleMaterialOptions> = {}): THREE.Material {
    return this.get({ color, unlit: true, ...extra });
  }
}
