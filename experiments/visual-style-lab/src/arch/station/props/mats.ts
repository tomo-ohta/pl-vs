import * as THREE from 'three';
import type { Builder, V3 } from '../../../scenes/Builder.ts';
import type { SceneContext } from '../../../scenes/types.ts';
import { builderSink, Prop, type PropKind, type PropMats } from '../../../props/kit.ts';
import { stationMat } from '../mat.ts';

/**
 * 駅の小物の材質の作り方（PropMats）。小物の関数が頼む「色（実物の色）と種類」を、駅の材質（mat.ts: 空の見える割合で明るさが決まる）にする。
 * - 色: 実物の色を駅の色の表へ寄せる（明るい色は青緑の白 #c0d8d2 まで・濃い色は暗く・彩度は 8 割。赤や黄は暗く沈む）。
 *   駅の色の表にもとからある色は raw() で登録すると、そのまま使う
 * - ふつう: 模様・発光・つやの無い駅の材質。region.ts の consolidate が頂点色の 1 つの材質にまとめる（色が多くても描画は 1 回）
 * - 光る: 照明を使わない光る色（駅の光る板と同じく控えめ。0.78 倍）
 * - ガラス: 透ける板（浅い角度で霧の空を映す）。まとめられないので、色の数を少なくする
 * - 室内（inside）: 駅舎・地下道の中の光だまり（蛍光灯と窓）を受ける版。霧は弱く（駅舎の中の材質と同じ 0.18）
 * 見本帳（props.html）には駅の照明が無いが、駅の材質は屋根の無い所の空の明るさで描けるので、外の版がそのまま使える
 */

/** 色をそのまま使う（駅の色の表の色） */
const RAW = new Set<string>();
export function raw(hex: string): string {
  RAW.add(hex.toLowerCase());
  return hex;
}

/** 青緑へ寄せる掛け算（sRGB） */
const TINT: V3 = [0.88, 1.0, 0.97];

/** 実物の色 → 駅の色（sRGB の 16 進） */
export function stationColor(hex: string, kind: PropKind = 'solid'): string {
  if (RAW.has(hex.toLowerCase())) return hex;
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  const glow = kind === 'glow';
  const s = hsl.s * (glow ? 0.85 : 0.8);
  let l = glow ? hsl.l * 0.92 : 0.015 + 0.86 * Math.pow(hsl.l, 1.12);
  // 彩度の高い中くらいの明るさの色（青・緑）は暗く沈める（霧の中で浮かない）。
  // 赤・橙・黄は沈めない（青緑の空の光は赤をほとんど返さないので、沈めると茶色の影になる。ポスト・コーンが赤に見えるように）
  const warm = Math.min(Math.abs(hsl.h - 0.04), Math.abs(hsl.h - 1.04)) < 0.1 ? 1 : 0;
  if (!glow) l *= 1 - 0.26 * (1 - warm) * hsl.s * (1 - Math.abs(hsl.l - 0.5) * 2);
  c.setHSL(hsl.h, s, l, THREE.SRGBColorSpace);
  c.setRGB(c.r * TINT[0] ** 2.2, c.g * TINT[1] ** 2.2, c.b * TINT[2] ** 2.2);
  return `#${c.getHexString()}`;
}

const caches = new Map<string, Map<string, THREE.Material>>();

/** 駅の小物の材質（inside = 駅舎・地下道の中） */
export function stationPropMats(o: { inside?: boolean } = {}): PropMats {
  const inside = !!o.inside;
  const ck = inside ? 'in' : 'out';
  let cache = caches.get(ck);
  if (!cache) caches.set(ck, (cache = new Map()));
  const room = inside ? { pool: true, fogMul: 0.18 } : {};
  return {
    get(color, kind = 'solid') {
      const key = `${kind}:${color}`;
      let m = cache.get(key);
      if (!m) {
        const c = stationColor(color, kind);
        if (kind === 'glow') m = stationMat({ color: '#000000', unlit: true, emissive: c, emissiveIntensity: 0.78, fogMul: inside ? 0.18 : 1 });
        else if (kind === 'glass') m = stationMat({ color: c, transparent: true, opacity: 0.24, depthWrite: false, sheen: 0.8, side: THREE.DoubleSide, ...room });
        else m = stationMat({ color: c, ...room });
        cache.set(key, m);
      }
      return m;
    },
  };
}

/** 駅の場面に小物を置く道具（Builder へ。inside で室内の材質） */
export interface Placer {
  /** 位置・向き（yaw = Object3D.rotation.y）・種で物を作る */
  (build: (p: Prop) => void, pos: V3, yaw?: number, seed?: number): void;
  mats: PropMats;
}
export function placer(b: Builder, ctx: SceneContext, o: { inside?: boolean } = {}): Placer {
  const mats = stationPropMats(o);
  const sink = builderSink(b, ctx);
  let n = 0;
  const f = ((build, pos, yaw = 0, seed) => {
    n++;
    build(Prop.at(sink, mats, pos, yaw, seed ?? 7919 + n * 131));
  }) as Placer;
  f.mats = mats;
  return f;
}
