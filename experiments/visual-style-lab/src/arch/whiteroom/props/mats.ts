import * as THREE from 'three';
import type { Builder } from '../../../scenes/Builder.ts';
import { builderSink, type PropKind, type PropMats, type PropSink } from '../../../props/kit.ts';
import { shiftColor } from '../../../render/Style.ts';
import type { SceneContext } from '../../../scenes/types.ts';

/**
 * whiteroom の小物の材質: 色彩設計の段落とし（場面の段の色の変え方）。段の境目のノイズと影の升目は使わない
 * （丸い面・面取りで段がまだらにちぎれないように）。同じ色は同じ材質（描く回数を増やさない）。
 */
/**
 * shade = 陰の段の色の作り方（OKLab: 明度の倍率・彩度の倍率・色相の回転）。中庭ごとに光の当たり方が違うので渡す
 * （A = 横からの日で陰が深い、B = 真上の日で縦の面はどれも淡い陰、C = 逆光で陰はやや深い）
 */
export function wrPropMats(ctx: SceneContext, shade: [number, number, number] = [0.6, 0.95, 8]): PropMats {
  const cache = new Map<string, THREE.Material>();
  // 近い色は同じ材質にまとめる（OKLab で 0.022 以内 = 見分けの付かない差。小物の色が増えても描く回数が増えないように）
  const chosen: { hex: string; lab: [number, number, number] }[] = [];
  const snap = (hex: string): string => {
    const lab = oklab(hex);
    for (const c of chosen) if (Math.hypot(c.lab[0] - lab[0], c.lab[1] - lab[1], c.lab[2] - lab[2]) < 0.022) return c.hex;
    chosen.push({ hex, lab });
    return hex;
  };
  return {
    get(color0: string, kind: PropKind = 'solid') {
      const color = kind === 'solid' ? snap(color0) : color0;
      const key = `${kind}:${color}:${shade.join(',')}`;
      let m = cache.get(key);
      if (!m) {
        if (kind === 'glow') m = ctx.mat({ color, unlit: true, line: 0.2, name: `wr-prop-glow-${color}` });
        else if (kind === 'glass') m = ctx.mat({ color, transparent: true, opacity: 0.4, depthWrite: false, line: 0.2, name: `wr-prop-glass-${color}` });
        else m = ctx.mat({ color, shade: '#' + shiftColor(color, shade).getHexString(), line: 1, noise: [0.3, 1], shadowQuant: false, name: `wr-prop-${color}` });
        cache.set(key, m);
      }
      return m;
    },
  };
}

const _c = new THREE.Color();
function oklab(hex: string): [number, number, number] {
  _c.set(hex);
  const r = _c.r;
  const g = _c.g;
  const b = _c.b;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/**
 * 場面の小物の出し先: 影の設定を 1 つにそろえる（影を落とす・受ける）。影の設定ごとに別の塊になって描く回数が増えるのを防ぐ。
 * 影の地図は中庭が変わる時だけ描くので、小さな部品が影を落としても重くならない
 */
export function wrSink(b: Builder): PropSink {
  const s = builderSink(b, b.ctx);
  return { add: (geo, mat) => s.add(geo, mat, true), collide: (mn, mx) => s.collide(mn, mx) };
}
