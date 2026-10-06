/**
 * 小物の箱の見た目を、v2 の材質のまま GPU で写し取る。
 *
 * 箱 1 つずつを 6 方向（±X・±Y・±Z）から平行投影で撮る。箱どうしが隠し合わないよう、方向ごとに箱を
 * 画像の上で重ならない位置（アトラス）へずらして並べ、同じ方向の箱をまとめて 1 回で描く。
 * ずらすのはメッシュの行列だけなので、材質のシェーダが読む位置（汚れ・模様の座標 vRoomPos）・焼き込み陰影（bakedLight）は
 * v2 で描いたときと同じ。カメラからの奥行きも全部の箱で揃える（部屋の霧が奥の箱だけに掛からないように）。
 *
 * 撮るもの（MaterialLibrary の診断表示 setDiagnostic を使う。v2 のコードは変えない）:
 *   beauty    … ふだんの見た目（線形 HDR。焼き込み陰影 + 環境光 + 半球光 + 発光。動的な点光源は入れない＝別に計算する）
 *   albedo    … 材質の地の色（テクスチャ込み）
 *   roughness … 粗さ（粗さのテクスチャ込み）
 * 画面へは描かない（RenderTarget へ描くので、トーンマップ・sRGB 変換は掛からない＝ v2 の RenderPass と同じ線形の値）。
 */
import * as THREE from 'three';
import type { MaterialLibrary } from '../../../v2/client/render/MaterialLibrary.ts';

/** 方向 0..5 = +X, −X, +Y, −Y, +Z, −Z。u × v = d になる画像の軸 */
export const DIRS: readonly { d: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 }[] = [
  { d: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0) },
  { d: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) },
  { d: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1) },
  { d: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
  { d: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
  { d: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
];

/** 撮る箱 1 つ（v2 が作った小物のメッシュの一部。頂点の範囲 start..start+count がこの箱） */
export interface CaptureBox {
  id: number;
  mesh: THREE.Mesh;
  start: number;
  count: number;
  /** メッシュの座標 → 区画の入れ物（built.group）の座標 */
  meshToUnit: THREE.Matrix4;
  /** 区画の入れ物の座標での外接の箱（面取り込み） */
  aabb: THREE.Box3;
}

/** 箱の面 1 つがアトラスのどこに写ったか（テクセル。原点は画像の左下） */
export interface FaceRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 面の画像の軸（u, v）での箱の始まり（m） */
  u0: number;
  v0: number;
}

export interface Atlas {
  width: number;
  height: number;
  /** RGBA（線形 HDR） */
  beauty: Float32Array;
  /** RGBA 0..255（線形） */
  albedo: Uint8Array;
  /** R = 粗さ 0..255 */
  rough: Uint8Array;
}

export interface CaptureResult {
  /** テクセルの大きさ（m） */
  texel: number;
  atlases: Atlas[];
  /** 箱の id → 方向ごとの面の位置 */
  rects: Map<number, FaceRect[]>;
  ms: number;
}

const PAD = 2;

/** 方向 dir での箱の面の大きさ（画像の軸での始まりと幅） */
function faceExtent(b: THREE.Box3, dir: number): { u0: number; v0: number; du: number; dv: number; dmax: number } {
  const { u, v, d } = DIRS[dir]!;
  const span = (axis: THREE.Vector3): [number, number] => {
    const a = b.min.dot(axis), c = b.max.dot(axis);
    // 軸は ±1 の成分を 1 つだけ持つので、外接の箱の 2 隅の内積の小さい方・大きい方が範囲
    return [Math.min(a, c), Math.max(a, c)];
  };
  const [u0, u1] = span(u), [v0, v1] = span(v), [, d1] = span(d);
  return { u0, v0, du: u1 - u0, dv: v1 - v0, dmax: d1 };
}

/** 棚詰め（高さ順）。収まらなければ null */
function pack(sizes: { w: number; h: number }[], maxW: number, maxH: number): { x: number; y: number }[] | null {
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b]!.h - sizes[a]!.h);
  const out: { x: number; y: number }[] = new Array(sizes.length);
  let x = 0, y = 0, rowH = 0;
  for (const i of order) {
    const s = sizes[i]!;
    const w = s.w + PAD * 2, h = s.h + PAD * 2;
    if (w > maxW) return null;
    if (x + w > maxW) { x = 0; y += rowH; rowH = 0; }
    if (y + h > maxH) return null;
    out[i] = { x: x + PAD, y: y + PAD };
    x += w;
    rowH = Math.max(rowH, h);
  }
  return out;
}

export interface CaptureEnv {
  renderer: THREE.WebGLRenderer;
  materials: MaterialLibrary;
  /** ゲームの scene（照明の数と種類・霧の有無を写す） */
  scene: THREE.Scene;
}

/**
 * ゲームの scene と同じ「照明の組み合わせ」と霧の有無を撮影用の scene に作る。
 * three はシェーダを照明の種類ごとの数・霧の有無で作り分けるので、同じ組み合わせにすると v2 が既に作ったシェーダを
 * そのまま使える（撮るたびに材質のシェーダを作り直して止まらない）。半球光だけは今の色・強さを写し、ほかは強さ 0。
 * 霧は「ある」ことにするが届かない距離にする（撮る見た目には掛けない）。
 */
function mirrorLighting(src: THREE.Scene, dst: THREE.Scene): void {
  src.traverseVisible((o) => {
    if (!(o instanceof THREE.Light)) return;
    let l: THREE.Light | null = null;
    if (o instanceof THREE.HemisphereLight) {
      const h = new THREE.HemisphereLight(o.color, o.groundColor, o.intensity);
      h.position.copy(o.getWorldPosition(new THREE.Vector3()));
      l = h;
    } else if (o instanceof THREE.PointLight) l = new THREE.PointLight(0xffffff, 0, o.distance, o.decay);
    else if (o instanceof THREE.SpotLight) l = new THREE.SpotLight(0xffffff, 0, o.distance, o.angle, o.penumbra, o.decay);
    else if (o instanceof THREE.DirectionalLight) l = new THREE.DirectionalLight(0xffffff, 0);
    else if (o instanceof THREE.AmbientLight) l = new THREE.AmbientLight(0xffffff, 0);
    else if (o instanceof THREE.RectAreaLight) l = new THREE.RectAreaLight(0xffffff, 0, o.width, o.height);
    if (!l) return;
    l.castShadow = o.castShadow;
    // 半球光は位置が向き（空の側）なので動かさない。ほかは強さ 0 のまま遠くへ
    if (!(l instanceof THREE.HemisphereLight)) l.position.set(0, -1000, 0);
    dst.add(l);
    if (l instanceof THREE.SpotLight || l instanceof THREE.DirectionalLight) dst.add(l.target);
  });
  if (src.fog) dst.fog = new THREE.Fog(0x000000, 1e6, 2e6);
}

/** 区画の小物の箱をまとめて撮る（texel は 1 テクセルの大きさ m。アトラスが大きすぎるときは自動で粗くする） */
export async function captureBoxes(env: CaptureEnv, boxes: CaptureBox[], texel: number, maxSize = 2048): Promise<CaptureResult> {
  const t0 = performance.now();
  const { renderer, materials } = env;
  // 方向ごとの面の大きさとアトラスの割り当て（収まるまでテクセルを粗くする）
  let rects!: Map<number, FaceRect[]>;
  let sizes!: { width: number; height: number }[];
  for (let attempt = 0; attempt < 8; attempt++, texel *= 1.3) {
    rects = new Map(boxes.map((b) => [b.id, new Array<FaceRect>(6)]));
    sizes = [];
    let ok = true;
    for (let dir = 0; dir < 6 && ok; dir++) {
      const ext = boxes.map((b) => faceExtent(b.aabb, dir));
      const wh = ext.map((e) => ({ w: Math.max(1, Math.ceil(e.du / texel)), h: Math.max(1, Math.ceil(e.dv / texel)) }));
      const area = wh.reduce((a, s) => a + (s.w + PAD * 2) * (s.h + PAD * 2), 0);
      // 幅は面積から決めるが、いちばん幅の広い面（長いベンチ・仕切りの列など）より狭くはしない
      const widest = Math.max(...wh.map((s) => s.w + PAD * 2));
      const width = Math.min(maxSize, Math.max(64, widest, Math.ceil(Math.sqrt(area) * 1.15)));
      const pos = pack(wh, width, maxSize);
      if (!pos) { ok = false; break; }
      let height = 0;
      boxes.forEach((b, i) => {
        const p = pos[i]!, s = wh[i]!, e = ext[i]!;
        rects.get(b.id)![dir] = { x: p.x, y: p.y, w: s.w, h: s.h, u0: e.u0, v0: e.v0 };
        height = Math.max(height, p.y + s.h + PAD);
      });
      sizes.push({ width, height: Math.max(8, height) });
    }
    if (ok) break;
  }
  if (sizes.length < 6) throw new Error(`アトラスに収まらない（テクセル ${texel.toFixed(3)} m まで粗くした）`);

  // 箱ごとのジオメトリ: v2 のメッシュの頂点のうち、この箱の範囲だけを写す（属性はそのまま。位置もずらさない。
  // 属性を共有すると、撮り終わって dispose したときに v2 のメッシュの GPU のバッファまで消えてしまう）
  const scene = new THREE.Scene();
  mirrorLighting(env.scene, scene);
  const items = boxes.map((b) => {
    const g = sliceGeometry(b.mesh.geometry, b.start, b.count);
    // v2 の材質（スプラット表示中は深さの代役に替えてあるので、元の材質を使う）
    const m = new THREE.Mesh(g, (b.mesh.userData.splatOrigMaterial as THREE.Material | undefined) ?? b.mesh.material);
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
    scene.add(m);
    return { b, g, m };
  });

  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevAutoClear = renderer.autoClear;
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.01, 4);
  camera.matrixAutoUpdate = false;
  const atlases: Atlas[] = [];
  const offset = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  try {
    for (let dir = 0; dir < 6; dir++) {
      const { width, height } = sizes[dir]!;
      const { u, v, d } = DIRS[dir]!;
      // 箱を並べる: 面の左下 (u0, v0) をアトラスの位置へ、手前の面（d の向きの最大）を奥行き 0 へ
      for (const { b, m } of items) {
        const r = rects.get(b.id)![dir]!;
        const e = faceExtent(b.aabb, dir);
        tmp.set(0, 0, 0)
          .addScaledVector(u, r.x * texel - r.u0)
          .addScaledVector(v, r.y * texel - r.v0)
          .addScaledVector(d, -e.dmax);
        offset.makeTranslation(tmp.x, tmp.y, tmp.z);
        m.matrix.multiplyMatrices(offset, b.meshToUnit);
        m.matrixWorld.copy(m.matrix);
      }
      // カメラ: 右 = u、上 = v、後ろ = d。奥行き 0（並べた面）の 0.05 m 手前に置く
      camera.left = 0;
      camera.right = width * texel;
      camera.bottom = 0;
      camera.top = height * texel;
      const deepest = Math.max(...boxes.map((b) => { const e = faceExtent(b.aabb, dir); return e.dmax - Math.min(b.aabb.min.dot(d), b.aabb.max.dot(d)); }));
      camera.near = 0.01;
      camera.far = 0.05 + deepest + 0.05;
      camera.updateProjectionMatrix();
      camera.matrixWorld.makeBasis(u, v, d).setPosition(d.clone().multiplyScalar(0.05));
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

      const make = (type: THREE.TextureDataType): THREE.WebGLRenderTarget => new THREE.WebGLRenderTarget(width, height, { type, depthBuffer: true, stencilBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
      const rtBeauty = make(THREE.HalfFloatType);
      const rtAlbedo = make(THREE.UnsignedByteType);
      const rtRough = make(THREE.UnsignedByteType);
      const passes: [THREE.WebGLRenderTarget, string][] = [[rtBeauty, 'beauty'], [rtAlbedo, 'albedo'], [rtRough, 'roughness']];
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 0);
      for (const [rt, mode] of passes) {
        materials.setDiagnostic(mode);
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
      }
      materials.setDiagnostic('beauty');
      renderer.setRenderTarget(prevTarget);
      const half = new Uint16Array(width * height * 4);
      const albedo = new Uint8Array(width * height * 4);
      const rough = new Uint8Array(width * height * 4);
      await Promise.all([
        renderer.readRenderTargetPixelsAsync(rtBeauty, 0, 0, width, height, half),
        renderer.readRenderTargetPixelsAsync(rtAlbedo, 0, 0, width, height, albedo),
        renderer.readRenderTargetPixelsAsync(rtRough, 0, 0, width, height, rough),
      ]);
      rtBeauty.dispose();
      rtAlbedo.dispose();
      rtRough.dispose();
      atlases.push({ width, height, beauty: halfToFloat(half), albedo, rough });
    }
  } finally {
    materials.setDiagnostic('beauty');
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.autoClear = prevAutoClear;
    for (const { g } of items) g.dispose();
  }
  return { texel, atlases, rects, ms: performance.now() - t0 };
}

/** 頂点の範囲 start..start+count だけを写したジオメトリ（索引なしのジオメトリ用） */
export function sliceGeometry(src: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    if (!(attr instanceof THREE.BufferAttribute)) continue;
    const n = attr.itemSize;
    const arr = attr.array as THREE.TypedArray;
    g.setAttribute(name, new THREE.BufferAttribute(arr.slice(start * n, (start + count) * n), n, attr.normalized));
  }
  return g;
}

/** 半精度 → 単精度（表を引く） */
let HALF_TABLE: Float32Array | null = null;
function halfToFloat(src: Uint16Array): Float32Array {
  if (!HALF_TABLE) {
    HALF_TABLE = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) HALF_TABLE[i] = THREE.DataUtils.fromHalfFloat(i);
  }
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = HALF_TABLE[src[i]!]!;
  return out;
}
