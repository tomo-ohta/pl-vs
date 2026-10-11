import * as THREE from 'three';
import type { PropKind, PropMats, PropSink } from '../../props/kit.ts';
import type { Builder, V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * サーバールームの材質。
 * - 小物と建具の大半は「頂点の色 + 1 つの色彩設計の材質」で描く（色ごとに材質を分けると描く回数が増えるので、色は頂点に焼く）。
 *   陰・暗部の色は、色指定に掛ける割合（白の陰の色）で作る。参考画像の陰は同じ色相のまま暗くなる（青緑 → 濃い紺）ので割合で足りる
 * - 光る物（LED・器具）・ガラスも頂点の色で 1 つずつ
 * 色はどれも参考画像から --sample で拾った値（docs/stages/serverroom.md の色の表）。
 */

/** 色の表（参考画像の色から。部屋ごとの違いは見た目の色調整で付ける） */
export const PAL = {
  // ラック
  rack: '#08202c', // 本体・側板（暗い紺）
  rackEdge: '#123646', // 枠の縁・扉の枠
  rackTop: '#10313f',
  face: '#0b2533', // 機器の前面（図柄の下地）
  handle: '#4a8296',
  handleHi: '#8fcadb',
  // 床・壁・天井
  floor: '#86dcf0',
  floorJoint: '#5fb2cc',
  wall: '#45a6c6',
  wallLow: '#3a8fae',
  door: '#0a5373',
  doorFrame: '#2a7d9c',
  ceil: '#1d5a70',
  ceilHi: '#2e7590',
  // 天井の設備
  tray: '#1e526a',
  trayHi: '#3a7f9a',
  cable: '#0a1d28',
  cableBlue: '#163f55',
  duct: '#1f5670',
  box: '#2a6c88',
  boxPale: '#86c6d4',
  // 光る物
  led: '#7ff4ff',
  ledWhite: '#e8ffff',
  ledGreen: '#7dffc8',
  ledAmber: '#ffc46a',
  ledRed: '#ff6a5a',
  lamp: '#c8fbff',
  // 金属・機械
  steel: '#6fa8b8',
  steelDark: '#2a5a6c',
  black: '#081a24',
  pale: '#a9d7df',
  paper: '#d8eef0',
  red: '#b8505a',
  yellow: '#d8c25a',
  green: '#4fae86',
  cardboard: '#9a8a6c',
} as const;

const _c = new THREE.Color();

/** 頂点の色を付けた形を、場所の材質（頂点の色の材質）で Builder へ出す */
export class VcMats implements PropMats {
  readonly solid: THREE.Material;
  readonly glow: THREE.Material;
  readonly glass: THREE.Material;
  private readonly tokens = new Map<string, THREE.Material>();
  private readonly info = new Map<THREE.Material, { color: string; kind: PropKind }>();
  /** 色を部屋の色合いへ寄せる（光る物には使わない） */
  private readonly remap: ((hex: string) => string) | null;

  constructor(
    readonly ctx: SceneContext,
    o: { shade?: string; dark?: string; hi?: string; glassOpacity?: number; name?: string; remap?: (hex: string) => string } = {},
  ) {
    this.remap = o.remap ?? null;
    const name = o.name ?? 'sr-vc';
    this.solid = ctx.mat({
      color: '#ffffff',
      shade: o.shade ?? '#8fa6b4',
      dark: o.dark ?? '#5d7486',
      hi: o.hi ?? '#ffffff',
      vertexColors: true,
      noise: [0, 1],
      shadowQuant: false,
      name: `${name}-solid`,
    });
    this.glow = ctx.mat({ color: '#ffffff', unlit: true, vertexColors: true, line: 0.15, name: `${name}-glow` });
    this.glass = ctx.mat({ color: '#ffffff', vertexColors: true, transparent: true, opacity: o.glassOpacity ?? 0.3, depthWrite: false, line: 0.2, name: `${name}-glass` });
  }

  /** 色と種類の「しるし」の材質（出し先が頂点の色の材質に置き換える） */
  get(color: string, kind: PropKind = 'solid'): THREE.Material {
    const key = `${kind}|${color}`;
    let m = this.tokens.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial();
      this.tokens.set(key, m);
      this.info.set(m, { color, kind });
    }
    return m;
  }

  /** しるしの材質 → 色を頂点に焼いて、実際の材質を返す */
  resolve(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Material {
    const inf = this.info.get(mat);
    if (!inf) return mat;
    const col = this.remap && inf.kind !== 'glow' ? this.remap(inf.color) : inf.color;
    paintGeo(geo, col, inf.kind === 'glow' ? 2.4 : 1);
    return inf.kind === 'glow' ? this.glow : inf.kind === 'glass' ? this.glass : this.solid;
  }

  /** Builder への出し先 */
  sink(b: Builder): PropSink {
    return {
      add: (geo, mat, shadow) => {
        const m = this.resolve(geo, mat);
        b.mesh(geo, m, [0, 0, 0], { shadow });
      },
      collide: (min: V3, max: V3) => {
        b.ctx.colliders.add({ x: min[0], y: min[1], z: min[2] }, { x: max[0], y: max[1], z: max[2] });
      },
    };
  }
}

/** 形の頂点に色を付ける（線形の色。gain で光る物を明るく） */
export function paintGeo(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, gain = 1): THREE.BufferGeometry {
  _c.set(color);
  const n = geo.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = _c.r * gain;
    a[i * 3 + 1] = _c.g * gain;
    a[i * 3 + 2] = _c.b * gain;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
