import * as THREE from 'three';
import type { PropKind, PropMats } from '../../../props/kit.ts';
import type { SceneContext } from '../../../scenes/types.ts';
import { snapColor } from '../../pool/props/mats.ts';
import { glow, semi } from '../mats.ts';

/**
 * ウォーターパークの小物の材質の作り方（PropMats）。
 * 小物の関数（共通の小物・プールの小物・この場所の小物）が頼んだ色を、この場所の色の表（夜の青・桃色・ミント・白いタイル）の
 * いちばん近い色にして、半写実の材質（段落としなし）にする。同じ色は同じ材質（描く回数を増やさない）
 */
export const WC = {
  white: '#dfe9f0',
  pale: '#b4c8d6',
  mist: '#8eaabd',
  blue: '#4f86ac',
  navy: '#24506e',
  ink: '#152a3a',
  rubber: '#2b3e4c',
  steel: '#9db2c2',
  chrome: '#cbd8e2',
  pink: '#e8a29a',
  pinkDeep: '#c6766c',
  peach: '#f0c0a8',
  mint: '#86c0b8',
  teal: '#3f8a90',
  yellow: '#e8c070',
  red: '#d0625a',
  wood: '#c8ae88',
  kraft: '#bfa47e',
  leaf: '#5e9a80',
  leafDark: '#3f7660',
} as const;

/** 光る色 */
export const WG = {
  lamp: '#fff4e6',
  warm: '#ffd2a8',
  aqua: '#a8e0e8',
  red: '#ff7a6a',
  green: '#6adca0',
  blue: '#8ac8f0',
} as const;

const SOLID = Object.values(WC) as string[];
const GLOWS = Object.values(WG) as string[];

const cacheByCtx = new WeakMap<object, PropMats>();

export function wpPropMats(ctx: SceneContext): PropMats {
  const have = cacheByCtx.get(ctx.colliders);
  if (have) return have;
  const cache = new Map<string, THREE.Material>();
  let glass: THREE.Material | null = null;
  const pm: PropMats = {
    get(color: string, kind: PropKind = 'solid'): THREE.Material {
      if (kind === 'glass') return (glass ??= ctx.mat({ color: '#a8c8d8', toon: 0, transparent: true, opacity: 0.3, depthWrite: false, line: 0, roughness: 0.1, name: 'wp-glass' }));
      const snapped = kind === 'glow' ? snapColor(color, GLOWS) : snapColor(color, SOLID);
      const key = `${kind}:${snapped}`;
      let m = cache.get(key);
      if (m) return m;
      if (kind === 'glow') m = glow(ctx, snapped, 3.5);
      else m = semi(ctx, snapped, { roughness: 0.55, name: `wp-prop-${snapped}` });
      cache.set(key, m);
      return m;
    },
  };
  cacheByCtx.set(ctx.colliders, pm);
  return pm;
}
