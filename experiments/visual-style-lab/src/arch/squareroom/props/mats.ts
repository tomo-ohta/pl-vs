import type * as THREE from 'three';
import type { PropKind, PropMats } from '../../../props/kit.ts';
import { shade } from '../../../props/kit.ts';
import type { SceneContext } from '../../../scenes/types.ts';

/**
 * 立方体の大広間の小物の色と材質（半写実: toon 0。場所の打ち放しと同じ照明の受け方）。
 * 色は参考画像の色の表から: 打ち放しの青緑の灰（明・中・暗）、錆びた鉄、褪せた青緑の塗装、苔・草の暗い緑、褪せた黄（水位標）。
 * 部屋の中の小物は間接光を小さく（room）。光る物は照明なし。
 */
export const SC = {
  conc: '#86a0a2',
  soil: '#2e2b25',
  concMid: '#64808a',
  concDark: '#3c555c',
  steel: '#55666a',
  steelDark: '#33403f',
  rust: '#6c5646',
  rustDark: '#4a3b31',
  paint: '#5f8784',
  paintPale: '#8aa9a3',
  yellow: '#b8a463',
  red: '#94554c',
  white: '#c9d4d0',
  wood: '#6f6656',
  woodDark: '#4b463c',
  rubber: '#273134',
  moss: '#46532f',
  mossDark: '#343f25',
  mossLit: '#5b6a3c',
  grass: '#5d6b3f',
  leaf: '#3c4c30',
  leafLit: '#8a9a68',
  ivy: '#4a5a36',
  glass: '#9fbcc0',
  paper: '#c8ccc0',
  binder: '#4f6f7a',
  binder2: '#7b6a52',
} as const;

export const SG = {
  lamp: '#f4f3e2',
  lampWarm: '#f2e2b8',
  green: '#7fd0a0',
  red: '#e88a7a',
  amber: '#f0cf7e',
} as const;

/**
 * 打ち放しの小物の色（長椅子・植え込みの箱・縁石・台）。場所の打ち放し（谷の底ほど空が見えない・張り出しの陰）と同じくらいの
 * 間接光にする（小物だけ明るく浮かない）
 */
const CONC = new Set<string>([SC.conc, SC.concMid, shade(SC.concMid, -0.12), shade(SC.concMid, -0.22)]);
const CONC_AMB = 0.5;

/** 場所の材質の作り方。amb = 間接光の倍率（屋外 1・部屋の中 0.3） */
export function sqPropMats(ctx: SceneContext, o: { amb?: number } = {}): PropMats {
  const cache = new Map<string, THREE.Material>();
  const amb0 = o.amb ?? 1;
  return {
    get(color, kind: PropKind = 'solid') {
      const key = `${kind}:${color}`;
      let m = cache.get(key);
      if (!m) {
        if (kind === 'glow') m = ctx.mat({ color, unlit: true, line: 0, name: `sqp-glow-${color}` });
        else if (kind === 'glass') m = ctx.mat({ color, toon: 0, transparent: true, opacity: 0.35, depthWrite: false, line: 0.2, roughness: 0.2, name: `sqp-glass-${color}` });
        else {
          const amb = amb0 * (CONC.has(color) ? CONC_AMB : 1);
          const mm = ctx.mat({ color, toon: 0, line: 0.6, shadowQuant: false, name: `sqp-${amb}-${color}` });
          if (amb !== 1) {
            // 部屋の中: 空の間接光を小さく（灯りの光だまりで照らす）
            const prev = mm.onBeforeCompile;
            const prevKey = mm.customProgramCacheKey.bind(mm);
            mm.onBeforeCompile = (sh, r) => {
              prev.call(mm, sh, r);
              sh.uniforms.uSqpAmb = { value: amb };
              sh.fragmentShader = sh.fragmentShader
                .replace('uniform float uSlBounce;', 'uniform float uSlBounce;\nuniform float uSqpAmb;')
                .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n  reflectedLight.indirectDiffuse *= uSqpAmb;');
            };
            mm.customProgramCacheKey = () => prevKey() + '|sqp-amb';
          }
          m = mm;
        }
        cache.set(key, m);
      }
      return m;
    },
  };
}
