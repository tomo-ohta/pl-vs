/**
 * Worker が作った配列（PropMeshData）を、v2 の材質のメッシュにする（メインの側）。
 *
 * - 材質: MeshStandard / MeshPhysical（陶器・透ける物はクリアコート）を MaterialLibrary.adoptExternal で包む
 *   （焼き込み光・霧・色が抜ける異変・診断の注入）。点光源・懐中電灯・映り込み・GTAO は v2 の描画がそのまま掛ける
 * - 焼き込み光: 区画の SurfaceLighting で頂点に焼く（0.4 m の升目ごとに 1 回の速い焼き方。少しずつ区切って）。
 *   動く物（持てる物）は焼かずに一定の値を入れ、後から relightMeshes で当て直す
 */
import * as THREE from 'three';
import type { MaterialLibrary } from '../render/MaterialLibrary.ts';
import type { SurfaceLighting } from '../render/SurfaceGeometry.ts';
import type { BlendMesh } from '../world/FloorBuilder.ts';
import { box } from '../../core/world/layout.ts';
import type { PropMeshData } from './atlas.ts';

/** 材質の番号ごとのクリアコート（0 つや消し・1 プラスチック・2 陶器・3 金属・4 透ける物） */
const COAT: { cc: number; ccr: number }[] = [
  { cc: 0, ccr: 0 },
  { cc: 0.25, ccr: 0.2 },
  { cc: 0.9, ccr: 0.06 },
  { cc: 0, ccr: 0 },
  { cc: 1, ccr: 0.04 },
];

/** 焼き込みの升目（m）。小さな箱と同じ速い焼き方（遮蔽は升目の中心で 1 回）になる大きさ */
const BAKE_CELL = 0.4;

/** 区切って進めるための待ち（呼ぶ側が渡す。時間が来たら次のフレームまで待つ） */
export type Yield = () => Promise<void> | void;

/** 頂点を 0.4 m の升目ごとに焼く（out に焼き込み光 RGB） */
async function bakeVertices(L: SurfaceLighting, pos: Float32Array, nor: Float32Array, out: Float32Array, pause: Yield): Promise<void> {
  const n = pos.length / 3;
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const kx = Math.floor(pos[i * 3]! / BAKE_CELL), ky = Math.floor(pos[i * 3 + 1]! / BAKE_CELL), kz = Math.floor(pos[i * 3 + 2]! / BAKE_CELL);
    const key = ((kx + 512) * 1024 + (ky + 512)) * 1024 + (kz + 512);
    let g = groups.get(key);
    if (!g) groups.set(key, g = []);
    g.push(i);
  }
  for (const idx of groups.values()) {
    const m = idx.length;
    const p = new Float32Array(m * 3), q = new Float32Array(m * 3);
    const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < m; k++) {
      const i = idx[k]!;
      for (let c = 0; c < 3; c++) {
        const v = pos[i * 3 + c]!;
        p[k * 3 + c] = v;
        q[k * 3 + c] = nor[i * 3 + c]!;
        if (v < min[c]!) min[c] = v;
        if (v > max[c]!) max[c] = v;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(q, 3));
    L.bake(g, box(min, max, 'untextured', false));
    const baked = g.getAttribute('bakedLight').array as Float32Array;
    for (let k = 0; k < m; k++) { const i = idx[k]!; out[i * 3] = baked[k * 3]!; out[i * 3 + 1] = baked[k * 3 + 1]!; out[i * 3 + 2] = baked[k * 3 + 2]!; }
    await pause();
  }
}

function dataTexture(data: Uint8Array, w: number, h: number, color: boolean, aniso: number): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

export interface PropMeshOptions {
  materials: MaterialLibrary;
  /** 異方性フィルタの上限（renderer.capabilities.getMaxAnisotropy() を画質で絞った値） */
  anisotropy: number;
  /** 焼き込み光（null なら一定の値 0.6。動く物） */
  lighting: SurfaceLighting | null;
  /** 部品で入切する照明ごとの「その照明なし」の焼き込み（あれば混ぜ合わせの値も作る。FloorBuilder の BlendMesh） */
  offs?: Map<string, SurfaceLighting> | null;
  /** 材質の上書き（区画の霧・色が抜ける異変） */
  overrides?: { fog?: { color: number; near: number; far: number }; colorMask?: [number, number, number] };
  name: string;
  pause: Yield;
}

export interface PropMeshes {
  group: THREE.Group;
  /** 照明の混ぜ合わせ（区画の built.blend に足す） */
  blend: BlendMesh[];
  /** テクスチャ（先に GPU へ載せるため） */
  textures: THREE.Texture[];
}

/** 配列からメッシュの組を作る */
export async function buildPropMeshes(d: PropMeshData, o: PropMeshOptions): Promise<PropMeshes> {
  const textures = d.pages.map((p) => ({
    map: dataTexture(p.albedo, p.w, p.h, true, o.anisotropy),
    orm: dataTexture(p.orm, p.w, p.h, false, o.anisotropy),
    emit: p.emit ? dataTexture(p.emit, p.w, p.h, true, o.anisotropy) : null,
  }));
  const root = new THREE.Group();
  root.name = o.name;
  const blend: BlendMesh[] = [];
  for (const g of d.groups) {
    const baked = g.baked ?? new Float32Array(g.pos.length);
    if (!g.baked) { if (o.lighting) await bakeVertices(o.lighting, g.pos, g.nor, baked, o.pause); else baked.fill(0.6); }
    const offs: BlendMesh['offs'] = [];
    for (const [lamp, L] of o.offs ?? []) {
      const off = new Float32Array(g.pos.length);
      await bakeVertices(L, g.pos, g.nor, off, o.pause);
      offs.push({ lamp, off });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(g.nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
    geo.setAttribute('bakedLight', new THREE.BufferAttribute(baked, 3));
    geo.setIndex(new THREE.BufferAttribute(g.index, 1));
    geo.computeBoundingSphere();
    const T = textures[g.page]!;
    const coat = COAT[g.mat] ?? COAT[0]!;
    const params: THREE.MeshStandardMaterialParameters = {
      map: T.map, roughnessMap: T.orm, metalnessMap: T.orm, roughness: 1, metalness: 1,
      transparent: g.clear, depthWrite: !g.clear, side: THREE.FrontSide,
      ...(T.emit ? { emissiveMap: T.emit, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: d.maxEmit } : {}),
    };
    const base = coat.cc > 0 ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: coat.cc, clearcoatRoughness: coat.ccr }) : new THREE.MeshStandardMaterial(params);
    const mat = o.materials.adoptExternal(base, o.overrides);
    if (mat !== base) base.dispose();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${o.name}|${g.page}|${g.mat}|${g.clear}`;
    if (g.clear) mesh.renderOrder = 1;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    root.add(mesh);
    if (offs.length) blend.push({ mesh, on: baked.slice(), offs });
  }
  return { group: root, blend, textures: textures.flatMap((t) => [t.map, t.orm, ...(t.emit ? [t.emit] : [])]) };
}

/** 作った物（メッシュ・材質・テクスチャ）を捨てる */
export function disposePropMeshes(root: THREE.Object3D | null): void {
  if (!root) return;
  root.removeFromParent();
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    for (const t of [mat.map, mat.roughnessMap, mat.emissiveMap]) if (t) textures.add(t);
    m.geometry.dispose();
    mat.dispose();
  });
  for (const t of textures) t.dispose();
}

/** 動く物: メッシュの組の焼き込み光を一定の色にする（v2 の Parts.relight と同じ） */
export function relightMeshes(root: THREE.Object3D, rgb: readonly [number, number, number]): void {
  root.traverse((o) => {
    const a = ((o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined)?.getAttribute('bakedLight') as THREE.BufferAttribute | undefined;
    if (!a) return;
    const arr = a.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) { arr[i] = rgb[0]; arr[i + 1] = rgb[1]; arr[i + 2] = rgb[2]; }
    a.needsUpdate = true;
  });
}

/** 同じ形の写し（位置・法線・UV・三角形・材質は共有し、焼き込み光だけ別に持つ） */
export function instanceOf(src: THREE.Object3D): THREE.Object3D {
  const copy = (o: THREE.Object3D): THREE.Object3D => {
    let out: THREE.Object3D;
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      const sg = m.geometry as THREE.BufferGeometry;
      const g = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'uv']) { const a = sg.getAttribute(k); if (a) g.setAttribute(k, a); }
      if (sg.index) g.setIndex(sg.index);
      const baked = sg.getAttribute('bakedLight') as THREE.BufferAttribute;
      g.setAttribute('bakedLight', new THREE.BufferAttribute(new Float32Array(baked.array as Float32Array), 3));
      g.boundingSphere = sg.boundingSphere?.clone() ?? null;
      const mm = new THREE.Mesh(g, m.material);
      mm.renderOrder = m.renderOrder;
      out = mm;
    } else out = new THREE.Group();
    out.name = o.name;
    out.position.copy(o.position); out.quaternion.copy(o.quaternion); out.scale.copy(o.scale);
    for (const c of o.children) out.add(copy(c));
    return out;
  };
  return copy(src);
}

/** instanceOf の写しを捨てる（焼き込み光の属性だけ。共有の部分は残す） */
export function disposeInstance(root: THREE.Object3D): void {
  root.removeFromParent();
  root.traverse((o) => { const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined; if (g) { for (const k of ['position', 'normal', 'uv']) g.deleteAttribute(k); g.setIndex(null); g.dispose(); } });
}
