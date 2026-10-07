import * as THREE from 'three';
import { createPaint } from '../../render/PaintMaterial.ts';
import { createLeafMaterial, makeTreeTexture } from '../../scenes/alley/foliage.ts';
import { rng, type Builder } from '../../scenes/Builder.ts';

/**
 * 立体の木（場面専用）。幹と枝は円柱、冠は葉の房の絵（元の版の遠くの木の絵）を貼った板を、冠の形（楕円体）の中に向きを変えて重ねる。
 * 板の縁はノイズで欠けさせる（四角く見えない）。どの向きから見ても冠が丸く見える（参考画像の木は元の版の 2 枚の板と同じ大きさ・色）。
 */

export interface TreeOptions {
  x: number;
  z: number;
  /** 冠の中心の高さ・半径（横・縦） */
  crownY: number;
  rx: number;
  ry: number;
  /** 幹の高さ（冠の下端まで）・太さ */
  trunk: number;
  r: number;
  cards: number;
  seed: number;
  colors?: [string, string, string];
  fog?: number;
  /** 下ほど暗く（[下, 上, 割合]） */
  grad?: [number, number, number];
}

const treeMats = new Map<string, THREE.ShaderMaterial>();

export function resetTreeCache(): void {
  treeMats.clear();
}

export function treeMaterial(colors: [string, string, string], seed: number, fog: number, grad: [number, number, number]): THREE.ShaderMaterial {
  const key = `${colors.join()}|${seed}|${fog}|${grad.join()}`;
  let m = treeMats.get(key);
  if (!m) {
    m = createLeafMaterial(makeTreeTexture(seed, colors, { clumps: 80, leaf: 6 }), 0, 0, 1, { fog, grad, direct: true, cardEdge: 0.35 });
    treeMats.set(key, m);
  }
  return m;
}

export function buildTree(b: Builder, o: TreeOptions): void {
  const r = rng(o.seed);
  const bark = createPaint({ color: { side: '#173238', py: '#1f3d42', ny: '#10252a' }, fog: o.fog ?? 1 });
  // 幹（少し傾けた円柱を 2 段）
  const lean = (r() - 0.5) * 0.2;
  b.cyl(bark, [o.x, o.trunk * 0.5, o.z], o.r, o.trunk + 0.2, { radiusTop: o.r * 0.78, segments: 10, rotZ: lean, collide: false, shadow: false });
  b.ctx.colliders.add({ x: o.x - o.r, y: 0, z: o.z - o.r }, { x: o.x + o.r, y: o.trunk, z: o.z + o.r });
  // 枝（冠の中へ）
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const len = o.rx * (0.3 + r() * 0.25);
    const y0 = o.trunk * (0.88 + r() * 0.12);
    const tilt = 0.6 + r() * 0.5;
    const g = new THREE.CylinderGeometry(o.r * 0.25, o.r * 0.45, len, 6);
    g.translate(0, len / 2, 0);
    g.rotateZ(-tilt);
    g.rotateY(a);
    g.translate(o.x, y0, o.z);
    b.mesh(g, bark, [0, 0, 0], { shadow: false });
  }
  // 冠: 楕円体の中に板を置く。外側ほど外を向く
  const mat = treeMaterial(o.colors ?? ['#37736f', '#4c9286', '#5ba791'], o.seed, o.fog ?? 0.25, o.grad ?? [o.crownY - o.ry, o.crownY + o.ry * 0.6, 0.15]);
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < o.cards; i++) {
    const th = r() * Math.PI * 2;
    const ph = Math.acos(1 - 2 * r());
    const rr = Math.cbrt(r()) * 0.72;
    const px = Math.sin(ph) * Math.cos(th) * o.rx * rr;
    const py = Math.cos(ph) * o.ry * rr;
    const pz = Math.sin(ph) * Math.sin(th) * o.rx * rr;
    const s = (o.rx + o.ry) * (0.42 + r() * 0.3);
    const g = new THREE.PlaneGeometry(s, s * (0.8 + r() * 0.3));
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const card = new Float32Array(uv.count * 2);
    for (let k = 0; k < uv.count; k++) {
      card[k * 2] = uv.getX(k);
      card[k * 2 + 1] = uv.getY(k);
    }
    g.setAttribute('aCard', new THREE.BufferAttribute(card, 2));
    g.rotateX((r() - 0.5) * 0.9);
    g.rotateY(th + Math.PI / 2 + (r() - 0.5) * 0.8);
    g.translate(o.x + px, o.crownY + py, o.z + pz);
    geos.push(g);
  }
  for (const g of geos) b.mesh(g, mat, [0, 0, 0], { shadow: false });
}
