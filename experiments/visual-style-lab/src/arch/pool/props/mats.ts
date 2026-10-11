import * as THREE from 'three';
import type { Builder, V3 } from '../../../scenes/Builder.ts';
import type { SceneContext } from '../../../scenes/types.ts';
import type { PropKind, PropMats, PropSink } from '../../../props/kit.ts';
import { Mats } from '../frame.ts';

/**
 * プールの小物の材質の作り方（PropMats）。
 * - 色はプールの色の表（白いタイル・淡い青緑・青緑・暗い青緑と、差し色の赤・黄・青）へ寄せる。
 *   小物の関数（共通の小物も）が頼んだ色は、表の中でいちばん近い色（OKLab）の材質になる（色の種類 = 材質の数を増やさない）
 * - 日なた・陰・暗部の 3 色。陰と暗部は部屋の壁と同じ割合で暗くする（小物だけ陰の中で浮かないように）
 * - 段の境目のノイズと影の升目は切る（丸い面・面取りでまだらにならないように）
 * - room = true は部屋の中の小物（ホールから部屋を見る時、部屋の材質と一緒に陰の色へ切り替える）
 */

/** 小物の色（sRGB）。小物の関数はこの名前で頼む */
export const PC = {
  white: '#f1f5ec',
  pale: '#dbe7e1',
  mint: '#c9ddd6',
  teal: '#7fb1a8',
  tealDark: '#4c7f7c',
  dark: '#2f4a4c',
  ink: '#1b2e30',
  rubber: '#3d5658',
  metal: '#c3cec9',
  chrome: '#e2e9e6',
  steel: '#a9b8b4',
  wood: '#d9ccae',
  kraft: '#c7ae86',
  red: '#cf6a60',
  yellow: '#e3c06a',
  blue: '#6f9fb0',
  leaf: '#6a9f86',
  leafDark: '#477d6a',
} as const;

/** 光る色（画面・表示灯・照明） */
export const PG = {
  lamp: '#f7fbf5',
  aqua: '#a8dccf',
  green: '#3f9a6a',
  red: '#e0786a',
  blue: '#7fb4d6',
  amber: '#f2d47e',
} as const;

const SOLID: string[] = Object.values(PC);

/**
 * 陰と暗部の色: 部屋の壁（room-wall: 日なた #eef3e8・陰 #a9c3b4・暗部 #7f9d91）と同じ割合で暗くする
 * （陰は少し青緑へ寄る）。部屋の陰の中で小物だけ明るく浮かないように
 */
const SHADE: [number, number, number] = [0.71, 0.8, 0.776];
const DARK: [number, number, number] = [0.53, 0.65, 0.625];
function mul(hex: string, k: [number, number, number]): string {
  // sRGB の値のまま掛ける（壁の色の割合も sRGB で測った）
  const v = parseInt(hex.slice(1), 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x, i) => Math.round(x * k[i]));
  return `#${ch.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
const GLOW = Object.values(PG);

type Lab = [number, number, number];
const labCache = new Map<string, Lab>();
function oklab(hex: string): Lab {
  let v = labCache.get(hex);
  if (v) return v;
  const c = new THREE.Color(hex); // 線形の値
  const l = Math.cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  const m = Math.cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  const s = Math.cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  v = [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  labCache.set(hex, v);
  return v;
}

/** 表の中でいちばん近い色（色みの差を少し重く見る: 赤い物が灰色に寄らないように） */
export function snapColor(hex: string, list: string[]): string {
  const a = oklab(hex);
  let best = list[0];
  let bd = Infinity;
  for (const c of list) {
    const b = oklab(c);
    const d = (a[0] - b[0]) ** 2 + 2 * ((a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export interface PoolPropMats extends PropMats {
  /** 作った材質（ふつうの物だけ。部屋の陰の切り替えに使う） */
  solids(): THREE.Material[];
}

const byMats = new WeakMap<Mats, Map<string, PoolPropMats>>();

/** プールの小物の材質（同じ Mats・同じ room には同じ物を返す） */
export function poolPropMats(m: Mats, room = false): PoolPropMats {
  let per = byMats.get(m);
  if (!per) byMats.set(m, (per = new Map()));
  const key0 = room ? 'room' : 'hall';
  const have = per.get(key0);
  if (have) return have;
  const cache = new Map<string, THREE.Material>();
  const solids: THREE.Material[] = [];
  const glass = m.get({ color: '#cfe6e0', shade: '#b4d0c9', dark: '#9fbdb6', hi: '#e2f1ec', transparent: true, opacity: 0.32, depthWrite: false, line: 0.3 });
  const pm: PoolPropMats = {
    get(color: string, kind: PropKind = 'solid'): THREE.Material {
      if (kind === 'glass') return glass;
      const key = `${kind}:${color}`;
      let mat = cache.get(key);
      if (mat) return mat;
      if (kind === 'glow') {
        mat = m.unlit(snapColor(color, GLOW), { line: 0.2 });
      } else {
        const c = snapColor(color, SOLID);
        mat = m.get({ color: c, shade: mul(c, SHADE), dark: mul(c, DARK), hi: c, noise: [0, 1], shadowQuant: false, name: `pp-${key0}-${c}` });
        if (!solids.includes(mat)) solids.push(mat);
      }
      cache.set(key, mat);
      return mat;
    },
    solids: () => solids,
  };
  per.set(key0, pm);
  return pm;
}

/** 床に置いた小物の外形（部屋の足元の深い影に使う） */
const FOOT = new WeakMap<Builder, [V3, V3][]>();
export function footprints(b: Builder): [V3, V3][] {
  return FOOT.get(b) ?? [];
}

/**
 * 小物の部品を Builder へ出す（名前 'prop' を付ける。外形の箱は当たり判定と足元の影に）。
 * 影の指定は 1 つにそろえる（材質ごとに 1 つのメッシュにまとまる = 描画の回数を増やさない。影は止まった影なので落とす数は重さにならない）。
 * ガラスだけは影を落とさない（自販機の窓の奥が暗くならないように）
 */
export function poolSink(b: Builder, ctx: SceneContext): PropSink {
  let list = FOOT.get(b);
  if (!list) FOOT.set(b, (list = []));
  const fl = list;
  return {
    add: (geo, mat) => {
      b.mesh(geo, mat, [0, 0, 0], { shadow: mat.transparent ? 'receive' : true, name: 'prop' });
    },
    collide: (min, max) => {
      ctx.colliders.add({ x: min[0], y: min[1], z: min[2] }, { x: max[0], y: max[1], z: max[2] });
      fl.push([min, max]);
    },
  };
}

/** 見本帳（props.html）用: その場の SceneContext から作る */
export function galleryMats(ctx: SceneContext): PropMats {
  return poolPropMats(new Mats(ctx));
}
