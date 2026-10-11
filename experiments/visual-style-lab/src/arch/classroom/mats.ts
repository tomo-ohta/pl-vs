import * as THREE from 'three';
import type { PropKind, PropMats, PropSink } from '../../props/kit.ts';
import type { Builder } from '../../scenes/Builder.ts';
import { shiftColor } from '../../render/Style.ts';
import type { StyleMaterialOptions } from '../../render/StyleMaterial.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 海の見える教室の材質（色彩設計の段落とし）。
 * 階ごとに「水の深さ」の違う色の表を持つ（参考画像の 2 枚の色の違いを、上下の階の違いにした）:
 *   deep    = 2 階（classroom-0）: 青い（陰 #1e425b〜#2d5468、日なたの床 #6dd0d8）
 *   shallow = 3 階（classroom-1）: 青緑（陰 #0c2d3a〜#0f3440、日なたの床 #3fb8c0）
 * 材質は「日なたの色」で頼み、陰・暗部の色は階ごとの変え方（OKLab の明度・彩度・色相）で作る。拾えた色は直接書く。
 */

export type Zone = 'deep' | 'shallow';

/** 階ごとの陰・暗部の作り方（[明度の倍率, 彩度の倍率, 色相の回転°]） */
const SHIFT: Record<Zone, { shade: [number, number, number]; dark: [number, number, number]; hi: [number, number, number] }> = {
  deep: { shade: [0.42, 0.78, 62], dark: [0.37, 0.78, 72], hi: [1.08, 0.75, -4] },
  shallow: { shade: [0.42, 0.82, 28], dark: [0.34, 0.8, 34], hi: [1.08, 0.8, -4] },
};

const hex = (c: THREE.Color): string => `#${c.getHexString()}`;

export class Mats {
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();
  constructor(readonly ctx: SceneContext) {}

  /** 日なたの色から、階の段の色を作った材質（同じ引数は同じ材質） */
  get(zone: Zone, color: string, o: Partial<StyleMaterialOptions> & { key?: string } = {}): THREE.MeshStandardMaterial {
    const key = `${zone}|${color}|${o.key ?? ''}|${o.shade ?? ''}|${o.dark ?? ''}`;
    let m = this.cache.get(key);
    if (!m) {
      const s = SHIFT[zone];
      const { key: _k, ...rest } = o;
      m = this.ctx.mat({
        color,
        shade: o.shade ?? hex(shiftColor(color, s.shade)),
        dark: o.dark ?? hex(shiftColor(color, s.dark)),
        hi: o.hi ?? hex(shiftColor(color, s.hi)),
        name: `${zone}-${color}${o.key ? '-' + o.key : ''}`,
        ...rest,
      });
      this.cache.set(key, m);
    }
    return m;
  }

  /** 一度だけ作る材質（光る物・特別な物） */
  once<T extends THREE.Material>(key: string, make: () => T): T {
    let m = this.cache.get('once|' + key) as unknown as T | undefined;
    if (!m) {
      m = make();
      this.cache.set('once|' + key, m as unknown as THREE.MeshStandardMaterial);
    }
    return m;
  }

  /** 淡い色の物（白い書庫など）: 陰も明るい（参考画像の奥の書庫は陰でも淡い） */
  paleProps(zone: Zone): PropMats {
    return {
      get: (color: string, kind: PropKind = 'solid') => {
        if (kind !== 'solid') return this.props(zone).get(color, kind);
        return this.get(zone, color, { shade: hex(shiftColor(color, [0.78, 0.8, 12])), dark: hex(shiftColor(color, [0.62, 0.75, 18])), noise: [0.3, 1], shadowQuant: false, key: 'pale' });
      },
    };
  }

  /** 小物の材質の作り方（階の段・段の境目のノイズは弱く・影の升目は使わない） */
  props(zone: Zone): PropMats {
    return {
      get: (color: string, kind: PropKind = 'solid') => {
        if (kind === 'glow') return this.get(zone, color, { unlit: true, line: 0.2, key: 'glow' });
        if (kind === 'glass') return this.get(zone, color, { transparent: true, opacity: 0.3, depthWrite: false, line: 0.3, key: 'glass' });
        return this.get(zone, color, { noise: [0.3, 1], shadowQuant: false, key: 'prop' });
      },
    };
  }
}

/**
 * 小物の出し先: 影を落とさない小さな部品（shadow: false）も影は受ける（日なたの外の紙・札が光らないように）
 */
export function propSink(b: Builder, ctx: SceneContext): PropSink {
  return {
    add: (geo, mat, shadow) => {
      b.mesh(geo, mat, [0, 0, 0], { shadow: shadow === false ? 'receive' : shadow });
    },
    collide: (min, max) => {
      ctx.colliders.add({ x: min[0], y: min[1], z: min[2] }, { x: max[0], y: max[1], z: max[2] });
    },
  };
}

/** 階ごとの面の色（参考画像から拾った色。日なた / 陰 / 暗部） */
export const PAL = {
  deep: {
    floor: { color: '#6dd0d8', shade: '#213f59', dark: '#1a3249', line: '#1d3a52' },
    wall: { color: '#4f8aa6', shade: '#1f3f5c', dark: '#1a3754' },
    frame: { color: '#41789a', shade: '#234a66', dark: '#1a3550' },
    ceil: { color: '#2c4d68', shade: '#1f3a55', dark: '#1a3550' },
    desk: { color: '#9ed5d0', shade: '#2a4864', dark: '#1a3049' },
    deskEdge: '#4f7f8c',
    deskFrame: '#3a6680',
    chairFrame: '#9cc8d2',
    seat: '#9bccbd',
  },
  shallow: {
    floor: { color: '#38a4ae', shade: '#0d3142', dark: '#092839', line: '#0b2e3e' },
    wall: { color: '#2f7f8c', shade: '#0f3648', dark: '#0b2c3d' },
    frame: { color: '#6fd2dc', shade: '#1a5260', dark: '#0c2f3b' },
    ceil: { color: '#174250', shade: '#0b2d3e', dark: '#08273b' },
    desk: { color: '#60bdb6', shade: '#174e5c', dark: '#0b2c3a' },
    deskEdge: '#1f5866',
    deskFrame: '#1d4e5c',
    chairFrame: '#5fa8b0',
    seat: '#4f9fa0',
  },
} as const;
