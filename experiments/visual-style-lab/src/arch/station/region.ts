import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, type V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { Tube } from './glow.ts';
import type { Mats } from './mats.ts';
import { stationMat } from './mat.ts';

export type AddTube = (c: V3, len: number, along: 'x' | 'z', w: number, h?: number, round?: boolean) => void;

/** 蛍光灯（光る板と、まわりのにじみの登録）を置く道具 */
export function tubeAdder(b: Builder, mat: Mats, tubes: Tube[]): AddTube {
  return (c, len, along, w, h = 0.04, round = false) => {
    if (round) {
      const g = new THREE.CapsuleGeometry(w / 2, Math.max(len - w, 0.01), 4, 10);
      if (along === 'x') g.rotateZ(Math.PI / 2);
      else g.rotateX(Math.PI / 2);
      b.mesh(g, mat.tube, c, { shadow: false });
    } else b.box(mat.tube, c, along === 'x' ? [len, h, w] : [w, h, len], { shadow: false });
    tubes.push({ c, axis: along === 'x' ? [1, 0, 0] : [0, 0, 1], len });
  };
}

/**
 * 場所ごとにまとめて置く（まとめた形が場所ごとに分かれるので、画角の外の場所は描かれない）。
 * noReflect = true なら床の映り込みに出さない（層 1。中の物・構外の小物）
 */
export function region(ctx: SceneContext, root: THREE.Object3D, noReflect: boolean, fn: (b: Builder) => void): THREE.Object3D {
  const b = new Builder(ctx);
  fn(b);
  consolidate(b.root);
  b.finalize();
  if (noReflect) b.root.traverse((o) => o.layers.set(1));
  root.add(b.root);
  return b.root;
}

/**
 * 色だけが違う材質（模様・発光・つや・霧の倍率などの指定が無い物）を、頂点色の 1 つの材質にまとめる。
 * Builder.finalize の前に呼ぶと、まとめた材質ごとに 1 回の描画になる（描画の回数を減らす。見た目は同じ）。
 * 影の地図は使っていないので、影の指定もそろえる
 */
let plainRef: THREE.ShaderMaterial | null = null;
let poolRef: THREE.ShaderMaterial | null = null;
const vcMats = new Map<string, THREE.ShaderMaterial>();
/**
 * 頂点色にまとめられる材質なら、まとめ先の鍵を返す（面の向き・室内の光だまりの有無と霧の倍率）。まとめられないなら null。
 * 室内の光だまりを受ける材質（pool）も、色だけが違う物はまとめる
 */
let unlitRef: THREE.ShaderMaterial | null = null;
function plainKey(m: THREE.Material): string | null {
  const s = m as THREE.ShaderMaterial;
  if (!s.isShaderMaterial || !s.uniforms?.uAlbedo) return null;
  const defs = Object.keys(s.defines ?? {});
  let kind = '';
  if (defs.length === 0) {
    plainRef ??= stationMat({ color: '#ffffff' });
    if (s.fragmentShader !== plainRef.fragmentShader) return null;
  } else if (defs.length === 1 && defs[0] === 'ST_POOL') {
    poolRef ??= stationMat({ color: '#ffffff', pool: true });
    if (s.fragmentShader !== poolRef.fragmentShader) return null;
    kind = 'pool';
  } else if (defs.length === 1 && defs[0] === 'ST_UNLIT') {
    // 照明を使わない光る色（色 + 発光 = そのまま出る色）
    unlitRef ??= stationMat({ color: '#ffffff', unlit: true });
    if (s.fragmentShader !== unlitRef.fragmentShader) return null;
    kind = 'unlit';
  } else return null;
  if (s.transparent || s.vertexColors) return null;
  const u = s.uniforms;
  const em = u.uEmissive.value as THREE.Color;
  if (kind !== 'unlit' && !(em.r === 0 && em.g === 0 && em.b === 0)) return null;
  if (!(u.uGain.value === 1 && u.uSheen.value === 0 && u.uOpacity.value === 1 && !u.uMap.value)) return null;
  if (kind === '' && u.uFogMul.value !== 1) return null;
  return `${s.side}|${kind}|${kind ? u.uFogMul.value : ''}`;
}
export function consolidate(root: THREE.Object3D): void {
  for (const o of [...root.children]) {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) continue;
    const m = mesh.material as THREE.ShaderMaterial;
    const key = plainKey(m);
    if (key === null) continue;
    let vc = vcMats.get(key);
    const unlit = key.includes('unlit');
    if (!vc) {
      const pool = key.includes('pool');
      vc = stationMat({ color: '#ffffff', vertexColors: true, side: m.side, pool, unlit, fogMul: pool || unlit ? m.uniforms.uFogMul.value : 1 });
      vcMats.set(key, vc);
    }
    const col = (m.uniforms.uAlbedo.value as THREE.Color).clone();
    if (unlit) col.add(m.uniforms.uEmissive.value as THREE.Color);
    const g = mesh.geometry.clone();
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([col.r, col.g, col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    mesh.geometry.dispose();
    mesh.geometry = g;
    mesh.material = vc;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }
}

/**
 * 広い範囲に散らばる作り込み（野原・線路の脇・遠景）を、size m の升目ごとにまとめて置く。
 * まとめた形が升目ごとに分かれるので、画角の外の升目は描かれない（大きな 1 つの形だと、どの向きでも描かれる）。
 * 数をそろえた物（InstancedMesh: 草・茂み）も形に焼き込み、色だけ違う材質は頂点色にまとめて、升目と材質ごとに 1 回の描画にする。
 * 床の映り込みには出さない（層 1）
 */
export function tileRegion(ctx: SceneContext, root: THREE.Object3D, size: number, fn: (b: Builder) => void): THREE.Object3D[] {
  const made: THREE.Object3D[] = [];
  const b = new Builder(ctx);
  fn(b);
  // 数をそろえた物を 1 つずつの形にほどく（あとで升目ごとにまとめる）
  const m4 = new THREE.Matrix4();
  for (const o of [...b.root.children]) {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh) continue;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m4);
      const g = im.geometry.clone();
      g.applyMatrix4(m4);
      b.root.add(new THREE.Mesh(g, im.material));
    }
    im.removeFromParent();
  }
  consolidate(b.root);
  // 頂点色にまとめた片面の材質は両面の物にそろえる（草・茂みの両面と同じ 1 回の描画に。裏の面は前の面に隠れる）
  for (const o of b.root.children) {
    const mesh = o as THREE.Mesh;
    const m = mesh.material as THREE.ShaderMaterial;
    if (!mesh.isMesh || !m?.vertexColors || m.side !== THREE.FrontSide) continue;
    for (const [k, v] of vcMats) {
      if (v !== m) continue;
      const k2 = `${THREE.DoubleSide}${k.slice(String(THREE.FrontSide).length)}`;
      let d = vcMats.get(k2);
      if (!d) {
        d = stationMat({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, pool: k.includes('pool'), unlit: k.includes('unlit'), fogMul: m.uniforms.uFogMul.value });
        vcMats.set(k2, d);
      }
      mesh.material = d;
      break;
    }
  }
  const key = (x: number, z: number): string => `${Math.floor(x / size)},${Math.floor(z / size)}`;
  const groups = new Map<string, THREE.Mesh[]>();
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  for (const o of [...b.root.children]) {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) {
      o.layers.set(1);
      o.renderOrder = 1;
      root.add(o);
      made.push(o);
      continue;
    }
    mesh.updateMatrixWorld(true);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    box.getCenter(c);
    const k = `${key(c.x, c.z)}|${(mesh.material as THREE.Material).uuid}`;
    let arr = groups.get(k);
    if (!arr) groups.set(k, (arr = []));
    arr.push(mesh);
  }
  for (const arr of groups.values()) {
    const keep = Object.keys(arr[0].geometry.attributes).filter((k) => arr.every((m) => m.geometry.attributes[k]?.itemSize === arr[0].geometry.attributes[k].itemSize));
    const geos = arr.map((m) => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
      return g;
    });
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mm = new THREE.Mesh(merged, arr[0].material);
    mm.layers.set(1);
    mm.castShadow = false;
    mm.receiveShadow = false;
    // 手前の物（ホーム・上屋）の後に描く（隠れた所の重い色の計算を、深さの比べで省く）
    mm.renderOrder = 1;
    root.add(mm);
    made.push(mm);
    for (const m of arr) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    if (geos.length > 1) for (const g of geos) g.dispose();
  }
  return made;
}
