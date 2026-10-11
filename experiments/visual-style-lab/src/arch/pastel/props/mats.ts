import type * as THREE from 'three';
import { decalMaterial } from '../../../render/Decal.ts';
import type { FaceColors } from '../../../render/PaintMaterial.ts';
import type { Builder } from '../../../scenes/Builder.ts';
import { Prop, type PropMats, type PropSink } from '../../../props/kit.ts';
import type { Paints } from '../paint.ts';
import { WHITE } from '../paint.ts';

/**
 * 淡色の廊下（建築版）の小物の材質の作り方と、場面への出し方。
 *
 * - 材質: 場面のほかの物と同じ「照明を使わない面ごとの色」（Paints.solid = 上 1.05・南 1.0・東西 0.96〜0.98・北 0.93・下 0.86 の明度）。
 *   丸い面・面取りも面の向きで色が決まるので、肩・縁の上向きの所が 1 段明るい平らな色面になる（線も陰影も使わない参考画像の描き方）。
 *   灯りの光だまり（床の高さだけ）は受けない（lamp 0）。雪の塗りも付けない（今までの小物と同じ。白い吹きだまりは床と壁の足元だけ）
 * - 光る物は Paints.glow、ガラスは窓のガラスと同じ薄い貼り絵（不透明度 0.22）
 * - 名前の色（'@cab' など）は面ごとの色を直接決めた塗り（参考画像の右の暗い棚と同じ色）
 * - 影: この場所は影を描かない（塗りの材質は影を受けない）。形はすべて影なしで出す（材質ごとに 1 つにまとまる）
 */

/** 色の表（参考画像の色の表から。props.ts の C と同じ値と、小物に足した数色） */
export const K = {
  enamel: '#e4e8da', // 白いほうろう（流し・棚・診察台）
  pale: '#dde3d5',
  cream: '#d6d6c2', // 参考画像の奥の低い台
  creamD: '#c4c6b1',
  sage: '#a9b8ae',
  sageD: '#8fa29b',
  greyBlue: '#8a9d9d',
  dark: '#6f8382', // 参考画像の右の暗い棚
  darker: '#4f5f61',
  ink: '#3a4244', // 取っ手・小さな金具
  wood: '#cbc5ab', // 淡い木
  woodD: '#aea88f',
  metal: '#a3b0aa',
  steel: '#bcc6c1', // ステンレス・めっき（金属より 1 段明るい）
  paper: '#eef1e6',
  cushion: '#9fb3ad', // 診察台・長椅子の張り
  cloth: '#d4ddd2', // 衝立・カーテンの布
  glassTint: '#d3e0dc', // 瓶・水の容れ物（不透明の淡い青緑）
  white: WHITE,
};

/** 紙・ファイル・本・瓶の色の候補（掲示物と同じ淡い色） */
export const PAPERS = ['#c9d5cd', '#bed3c9', '#d5d3bf', '#a9bcb3', '#e5ece0', '#dfe4d6'];
export const SPINES = ['#c9d5cd', '#bed3c9', '#d5d3bf', '#a9bcb3', '#8fa29b', '#dfe4d6', '#b5c2b8', '#9fb2aa'];
export const BOTTLES = ['#c7d6cf', '#e5ece0', '#a9bcb3', '#d3dfdb', '#c4c6b1'];
/** 段ボール（参考画像の色の表のクリーム。暖かい茶色は表に無い） */
export const KRAFT = ['#d6d6c2', '#ced4c4', '#c4c6b1'];

/** 面ごとの色を直接決めた塗り（名前で頼む） */
const NAMED: Record<string, FaceColors> = {
  // 参考画像の右の暗い棚: 前 #6f8382・横 #677a7a・天板 #92a19a
  '@cab': { pz: '#6f8382', nz: '#677a7a', px: '#677a7a', nx: '#677a7a', py: '#7d9091', ny: '#5f7173' },
  '@cabTop': { py: '#a1ada5', pz: '#92a19a', nz: '#8d9c96', px: '#8d9c96', nx: '#8d9c96', ny: '#7d8b86' },
};

const MATS = new WeakMap<Paints, PropMats>();

/** 淡色の廊下の小物の材質（同じ色と種類には同じ材質を返す） */
export function pastelMats(p: Paints): PropMats {
  let m = MATS.get(p);
  if (m) return m;
  const glass = new Map<string, THREE.Material>();
  m = {
    get(color, kind = 'solid') {
      if (kind === 'glow') return p.glow(color);
      if (kind === 'glass') {
        let g = glass.get(color);
        if (!g) glass.set(color, (g = decalMaterial({ color, rag: 0, opacity: 0.22 })));
        return g;
      }
      const named = NAMED[color];
      if (named) return p.face(named, color);
      return p.solid(color);
    },
  };
  MATS.set(p, m);
  return m;
}

const SINKS = new WeakMap<Builder, PropSink>();

/** Builder へ影なしで出す（材質ごとに 1 つのメッシュにまとまる） */
export function paintSink(b: Builder): PropSink {
  let s = SINKS.get(b);
  if (s) return s;
  s = {
    add: (geo, mat) => {
      b.mesh(geo, mat, [0, 0, 0], { shadow: false });
    },
    collide: (min, max) => {
      b.ctx.colliders.add({ x: min[0], y: min[1], z: min[2] }, { x: max[0], y: max[1], z: max[2] });
    },
  };
  SINKS.set(b, s);
  return s;
}

/** 場面の物の座標系（props.ts の Fr と同じ: 足元の真ん中・+z が前・yaw は Y 軸回り） */
export interface FrameLike {
  b: Builder;
  p: Paints;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Fr の位置と向きで、小物の道具の座標系を作る */
export function prop(f: FrameLike, seed = 1): Prop {
  return Prop.at(paintSink(f.b), pastelMats(f.p), [f.x, f.y, f.z], f.yaw, seed);
}
