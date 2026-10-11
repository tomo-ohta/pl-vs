import * as THREE from 'three';
import { builderSink, type PropKind, type PropMats, type PropSink } from '../../../props/kit.ts';
import type { Builder } from '../../../scenes/Builder.ts';
import type { SceneContext } from '../../../scenes/types.ts';
import { globeMap } from '../dome.ts';

/**
 * 大ドームの小物の材質の作り方（PropMats）。半写実（toon 0）の材質で、色は実物の色を大ドームの色の表へ寄せる:
 * 明るい色は青みの灰色まで、彩度は 6 割、暖かい色（真鍮・木）は少しだけ残す。
 * - ふつう: 光沢は色の明るさで（暗い樹脂・金属はつやあり、布は無し）。同じ色は同じ材質（まとめて描かれる）
 * - 光る: 照明を使わない発光（強さ 3。ブルームでにじむ）
 * - ガラス: 透ける板（暗い青）
 */
const TINT: [number, number, number] = [0.86, 1.0, 1.05];

export function domeColor(hex: string, kind: PropKind = 'solid'): string {
  if (kind === 'glow') return hex;
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  const warm = hsl.h < 0.17 || hsl.h > 0.93 ? 1 : 0;
  const s = hsl.s * (warm ? 0.5 : 0.6);
  const l = 0.03 + 0.62 * Math.pow(hsl.l, 1.1);
  c.setHSL(hsl.h, s, l, THREE.SRGBColorSpace);
  c.setRGB(c.r * TINT[0] ** 2.2, c.g * TINT[1] ** 2.2, Math.min(1, c.b * TINT[2] ** 2.2));
  return `#${c.getHexString()}`;
}

/**
 * 小物の色を丸める（色相 20°・彩度 1/6・明るさは比で 13 % の升目）。大ドームの小物は暗く彩度の低い色が多く、丸めても見た目は変わらないが、
 * 同じ材質にまとまって描く回数が減る
 */
function quantize(hex: string): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  const h = Math.round(hsl.h * 18) / 18;
  const sat = Math.round(hsl.s * 6) / 6;
  const l = hsl.l > 0.004 ? Math.min(1, Math.exp(Math.round(Math.log(hsl.l) * 8) / 8)) : 0;
  c.setHSL(h, sat, l, THREE.SRGBColorSpace);
  return `#${c.getHexString()}`;
}

/** 地球儀の地図の材質を頼む色の名前（PropMats.get に渡す） */
export const GLOBE = 'tex:globe';

const caches = new WeakMap<SceneContext, Map<string, THREE.Material>>();

export function domePropMats(ctx: SceneContext): PropMats {
  let cache = caches.get(ctx);
  if (!cache) caches.set(ctx, (cache = new Map()));
  return {
    get(color, kind = 'solid') {
      const key = `${kind}:${color}`;
      let m = cache!.get(key);
      if (!m && color === GLOBE) {
        // 地球儀の地図（焼いた絵を貼る。経度 = u・緯度 = v）
        m = ctx.mat({ color: '#ffffff', map: globeMap(ctx.renderer), toon: 0, roughness: 0.4, line: 0, name: 'pl-globe' });
        cache!.set(key, m);
      }
      if (!m) {
        const c = quantize(domeColor(color, kind));
        // 近い色は同じ材質（描く回数を減らす）。丸めた色で材質を引き直す
        const qkey = `${kind}:q${c}`;
        m = cache!.get(qkey);
        if (m) {
          cache!.set(key, m);
          return m;
        }
        if (kind === 'glow') {
          m = ctx.mat({ color: '#000000', unlit: true, emissive: c, emissiveIntensity: 3, toon: 0, line: 0, name: `pl-glow-${color}` });
          m.userData.plVc = { cls: 'glow', rgb: new THREE.Color(c).multiplyScalar(3) };
        } else if (kind === 'glass') m = ctx.mat({ color: c, toon: 0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, line: 0, name: `pl-glass-${color}` });
        else {
          const l = new THREE.Color(c).getHSL({ h: 0, s: 0, l: 0 }).l;
          m = ctx.mat({ color: c, toon: 0, roughness: l < 0.12 ? 0.45 : 0.75, line: 0, name: `pl-prop-${color}` });
          m.userData.plVc = { cls: l < 0.12 ? 'gloss' : 'matte', rgb: new THREE.Color(c) };
        }
        cache!.set(key, m);
        cache!.set(qkey, m);
      }
      return m;
    },
  };
}

const vcCaches = new WeakMap<SceneContext, Map<string, THREE.Material>>();

/**
 * 場面に置くときの出し先: 小物のふつう・光る部品は、色を頂点の色に焼いて、つやの種類ごとの 3 つの材質（暗いつや・つや消し・光る）に
 * まとめる（材質の数 = 描く回数を増やさない。色の見え方は材質ごとの色と同じ）。ガラスと地球儀の絵はそのまま
 */
/** 頂点の色の共有の材質（'gloss' 暗いつや・'matte' つや消し・'glow' 光る） */
export function domeVcMat(ctx: SceneContext, cls: string): THREE.Material {
  let cache = vcCaches.get(ctx);
  if (!cache) vcCaches.set(ctx, (cache = new Map()));
  let m = cache.get(cls);
  if (!m) {
    if (cls === 'glow') m = ctx.mat({ color: '#ffffff', unlit: true, vertexColors: true, toon: 0, line: 0, name: 'pl-vc-glow' });
    else m = ctx.mat({ color: '#ffffff', vertexColors: true, toon: 0, roughness: cls === 'gloss' ? 0.45 : 0.75, line: 0, name: `pl-vc-${cls}` });
    cache.set(cls, m);
  }
  return m;
}

export function domeSink(b: Builder, ctx: SceneContext): PropSink {
  const base = builderSink(b, ctx);
  const shared = (cls: string): THREE.Material => domeVcMat(ctx, cls);
  return {
    add(geo, mat, shadow) {
      const vc = (mat as THREE.Material).userData.plVc as { cls: string; rgb: THREE.Color } | undefined;
      if (!vc) return base.add(geo, mat, shadow);
      const n = geo.getAttribute('position').count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = vc.rgb.r;
        col[i * 3 + 1] = vc.rgb.g;
        col[i * 3 + 2] = vc.rgb.b;
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      base.add(geo, shared(vc.cls), shadow);
    },
    collide: (min, max) => base.collide(min, max),
  };
}
