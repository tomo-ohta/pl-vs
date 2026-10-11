import * as THREE from 'three';
import { builderSink, Prop, type PropKind, type PropMats, type PropSink } from '../../../props/kit.ts';
import { Atlas } from '../../../scenes/corridor/kit.ts';
import { flat } from '../../../scenes/corridor/props.ts';
import type { SceneContext } from '../../../scenes/types.ts';
import type { Mats } from '../furnish.ts';
import type { Leg } from '../leg.ts';

/**
 * 病棟の小物の材質の作り方（PropMats）。
 * 病棟の小物は wallkit と同じ考えで、**色見本の図柄 1 枚 + 紙の材質 1 つ** で描く（部屋・廊下の Builder ごとにまとめて描くので、
 * 色ごとに材質を分けると描く回数が増える）。物の関数が頼んだ色は、色見本の図柄に 1 点ずつ描き、形の uv をその点に向ける。
 * - get(color) は「その色の材質」を返す（場所の家具と同じ作り方 Mats.get の色彩設計の材質。見本帳の床・壁はこのまま描かれる）
 * - 物を置く出し先（sink）は、その材質を紙の材質 + 色見本の uv に置き換えて Builder へ出す（場面でも見本帳でも同じ）
 * - 光る物・ガラスも同じ図柄の光る材質・半透明の材質（各 1 つ）
 * 紙の材質の陰の色は wallkit の紙と同じ（部屋の小物と同じ明暗の段）。段の境目のノイズと影の升目は切る（docs/08 の決まり）
 */

/** 病棟の小物の色の表（区域によらない白・灰緑・暗い青緑と、区域の色の表から選んだ色） */
export const WARD = {
  white: '#eef5e2',
  whiteS: '#c9d4bc',
  pale: '#dfe8cf',
  grey: '#9fae98',
  steel: '#b9c6ae',
  dark: '#2f3b40',
  screen: '#41565b',
  mirror: '#a9c0bd',
  teal: '#5a797b',
  green: '#a3bfa9',
  sea: '#80a496',
  red: '#c4595e',
  cream: '#e8ecc7',
  sage: '#c9d7bb',
  olive: '#889d89',
  board: '#d2dcbb',
  orange: '#d99b5c',
  kraft: '#c9b48e',
  paper: '#f4f8ea',
  rubber: '#26302f',
  ink: '#4a5656',
} as const;

const SW = 2;

export class WardMats implements PropMats {
  readonly atlas = new Atlas(1024, 4);
  /** ふつうの物（紙の材質）・光る物・ガラス */
  readonly paper: THREE.Material;
  readonly glow: THREE.Material;
  readonly glass: THREE.Material;
  private readonly sw = new Map<string, [number, number]>();
  private readonly tok = new Map<THREE.Material, { color: string; kind: PropKind }>();
  private readonly byKey = new Map<string, THREE.Material>();
  constructor(readonly ctx: SceneContext) {
    const tex = this.atlas.tex;
    this.paper = ctx.mat({ color: '#ffffff', shade: '#c4c8bc', dark: '#9da396', hi: '#ffffff', map: tex, line: 1, noise: [0, 1], shadowQuant: false, name: 'corridor-props' });
    this.glow = ctx.mat({ color: '#ffffff', map: tex, unlit: true, line: 0.3, name: 'corridor-props-glow' });
    this.glass = ctx.mat({ color: '#ffffff', map: tex, transparent: true, opacity: 0.4, depthWrite: false, line: 0.3, name: 'corridor-props-glass' });
  }

  /** その色の材質（場所の家具と同じ作り方）。出し先がこれを紙の材質 + 色見本に置き換える */
  get(color: string, kind: PropKind = 'solid'): THREE.Material {
    const key = `${kind}|${color}`;
    let m = this.byKey.get(key);
    if (!m) {
      // 場所の家具の材質（furnish.ts の Mats.get）と同じ作り方（場面ではこの材質は描かれず、紙の材質 + 色見本になる）
      if (kind === 'glow') m = this.ctx.mat({ color, unlit: true, line: 0.3 });
      else if (kind === 'glass') m = this.ctx.mat({ color, transparent: true, opacity: 0.4, depthWrite: false, line: 0.3 });
      else m = this.ctx.mat({ ...flat(color, undefined, { line: 1 }), noise: [0, 1], shadowQuant: false });
      this.byKey.set(key, m);
      this.tok.set(m, { color, kind });
    }
    return m;
  }

  /** 色見本の uv（無ければ図柄に描く） */
  swatch(color: string): [number, number] {
    let uv = this.sw.get(color);
    if (!uv) {
      try {
        const r = this.atlas.add(SW, SW, (g, w, h) => {
          g.fillStyle = color;
          g.fillRect(-4, -4, w + 8, h + 8);
        });
        uv = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
      } catch {
        // 図柄が一杯なら、いちばん近い色を使う
        const c = new THREE.Color(color);
        let best: [number, number] = [0, 0];
        let bd = Infinity;
        for (const [k, v] of this.sw) {
          const d = new THREE.Color(k).sub(c);
          const dd = d.r * d.r + d.g * d.g + d.b * d.b;
          if (dd < bd) [bd, best] = [dd, v];
        }
        uv = best;
      }
      this.sw.set(color, uv);
      this.atlas.tex.needsUpdate = true;
    }
    return uv;
  }

  /** 出し先を包む: 色の材質を、紙の材質（光る・ガラスはそれぞれの材質）と色見本の uv に置き換える */
  sink(inner: PropSink): PropSink {
    return {
      add: (geo, mat, shadow) => {
        const t = this.tok.get(mat);
        if (!t) {
          inner.add(geo, mat, shadow);
          return;
        }
        const [u, v] = this.swatch(t.color);
        const n = geo.getAttribute('position').count;
        const a = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) {
          a[i * 2] = u;
          a[i * 2 + 1] = v;
        }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(a, 2));
        inner.add(geo, t.kind === 'glow' ? this.glow : t.kind === 'glass' ? this.glass : this.paper, t.kind === 'solid' ? shadow : false);
      },
      collide: inner.collide,
    };
  }

  /** 見本帳の物（出し先が Builder のまま）を、この作り方の出し先に包み直す */
  wrap(p: Prop): Prop {
    const q = new Prop(this.sink(p.sink), this, p.m);
    (q as { r: () => number }).r = p.r;
    return q;
  }

  /** 部屋・廊下の座標系（Leg）の点（x, z）に、向き yaw で物を置く。Leg が捨てる Builder なら捨てる */
  at(s: Leg, x = 0, z = 0, yaw = 0, seed = 1, y = 0): Prop {
    return Prop.at(this.sink(builderSink(s.b, s.ctx)), this, s.w([x, y, z]), s.yaw + yaw, seed);
  }
}

/** 場面の材質の置き場（Mats）ごとに 1 つ */
const BY_MATS = new WeakMap<Mats, WardMats>();
export function wardMats(mats: Mats): WardMats {
  let m = BY_MATS.get(mats);
  if (!m) BY_MATS.set(mats, (m = new WardMats(mats.ctx)));
  return m;
}
