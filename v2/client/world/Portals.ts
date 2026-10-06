/**
 * 窓・枠の向こうに別の所を描く（ポータルの描画。gimmicks-and-structures.md 3 章・v2-plan.md 6 章）。
 *
 * 面（portal の板）ごとに、カメラを写し方 xform で写した仮のカメラから場面を描いて画像（RenderTarget）にし、板には画面の座標で
 * その画像を貼る（板の形の穴から向こうが見える）。仮のカメラの手前（板の面より手前）の物は、投影の近くの面を板の面に傾けて切る
 * （oblique near plane。材質のシェーダを変えないので、切り始めに作り直しが起きない）。
 *
 * - 描くのは、見えていて近い（maxDist 以内）面から多くて maxPerFrame 枚。それ以外の面は前に描いた画像のまま
 * - 区画の見え方: 面ごとに cells（区画の id）を決めるか、仮のカメラのいる区画から開口をたどる（ClientGame が渡す visibleFrom）
 * - 仮のカメラは layers を足せる（窓の向こうの自分: 本当の部屋には見えない物を、窓の向こうにだけ描く）
 * - 板の色は場面と同じ扱い（画面へ直接描くときだけトーンマップと色空間の変換を掛ける。合成のときは最後の pass が掛ける）
 */
import * as THREE from 'three';

export interface PortalSurface {
  /** 板（場面の中のメッシュ）。この面の画像を貼る材質を持たせる（material() で作る） */
  mesh: THREE.Mesh;
  /** 板の真ん中と、見る側を向く法線（フロアの座標） */
  center: THREE.Vector3;
  normal: THREE.Vector3;
  /** 板の外接球の半径（視野の判定） */
  radius: number;
  /** 見る側の場所 → 描く場所の写し方（カメラの世界の行列に左から掛ける） */
  xform: THREE.Matrix4;
  /** 描く場所の切る面（この面より手前 = 仮のカメラの側を切る）。描く場所の座標で、法線は向こう（描く物の側）を向く */
  clip: THREE.Plane;
  /** 見せる区画（無ければ仮のカメラのいる区画から開口をたどる） */
  cells?: readonly string[];
  /** 仮のカメラで足して見る layers */
  layers?: readonly number[];
  /** 描くか（隠しが付いていないときの裏の面など） */
  active?(): boolean;
  /** 前に描いた画像 */
  target: THREE.WebGLRenderTarget;
  uniforms: { map: { value: THREE.Texture | null }; res: { value: THREE.Vector2 }; dim: { value: number } };
}

export interface PortalHooks {
  /** 区画の見え方を、この組にする（描画の入れ物・部品の描画の入れ物）。null なら元に戻す */
  applyCells(cells: ReadonlySet<string> | null): void;
  /** 仮のカメラのいる区画から見える区画 */
  visibleFrom(camera: THREE.Camera): ReadonlySet<string>;
}

const VERT = /* glsl */`
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */`
uniform sampler2D map;
uniform vec2 res;
uniform float dim;
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  gl_FragColor = vec4(texture2D(map, uv).rgb * dim, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class PortalRenderer {
  readonly surfaces = new Set<PortalSurface>();
  /** 1 フレームに描く面の数（重いので）と、描く距離 */
  maxPerFrame = 1;
  maxDist = 22;
  /** 画像の解像度（画面の何倍か） */
  scale = 0.6;
  private readonly vcam = new THREE.PerspectiveCamera();
  private readonly frustum = new THREE.Frustum();
  private readonly m = new THREE.Matrix4();
  private readonly size = new THREE.Vector2();
  private readonly sphere = new THREE.Sphere();
  private readonly v = new THREE.Vector3();

  constructor() {
    this.vcam.matrixAutoUpdate = false;
    this.vcam.matrixWorldAutoUpdate = false;
  }

  /** 板の材質（画像を画面の座標で貼る） */
  static material(s: Pick<PortalSurface, 'uniforms'>): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({ uniforms: s.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.FrontSide, fog: false, toneMapped: true });
  }

  static newTarget(): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
  }

  add(s: PortalSurface): () => void {
    this.surfaces.add(s);
    return () => { this.surfaces.delete(s); s.target.dispose(); };
  }

  /** 場面を描く前に呼ぶ（見えている近い面の向こうを描いて、画像を更新する） */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, hooks: PortalHooks): void {
    if (!this.surfaces.size) return;
    camera.updateMatrixWorld();
    this.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m);
    renderer.getDrawingBufferSize(this.size);
    const cand: { s: PortalSurface; d: number }[] = [];
    for (const s of this.surfaces) {
      s.uniforms.res.value.copy(this.size);
      if (!shown(s.mesh) || (s.active && !s.active())) continue;
      // 見る側にいること（板の裏からは見えない）・近いこと・視野に入ること
      const toCam = this.v.copy(camera.position).sub(s.center);
      if (toCam.dot(s.normal) <= 0) continue;
      const d = toCam.length();
      if (d > this.maxDist) continue;
      this.sphere.set(s.center, s.radius);
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      cand.push({ s, d });
    }
    cand.sort((a, b) => a.d - b.d);
    const w = Math.max(4, Math.round(this.size.x * this.scale)), h = Math.max(4, Math.round(this.size.y * this.scale));
    const prevTarget = renderer.getRenderTarget();
    for (const { s } of cand.slice(0, this.maxPerFrame)) {
      if (s.target.width !== w || s.target.height !== h) s.target.setSize(w, h);
      const vc = this.vcam;
      vc.projectionMatrix.copy(camera.projectionMatrix);
      vc.matrixWorld.multiplyMatrices(s.xform, camera.matrixWorld);
      vc.matrixWorldInverse.copy(vc.matrixWorld).invert();
      vc.layers.mask = camera.layers.mask;
      for (const l of s.layers ?? []) vc.layers.enable(l);
      obliqueNear(vc, s.clip);
      vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();
      hooks.applyCells(s.cells ? new Set(s.cells) : hooks.visibleFrom(vc));
      // 自分の板は描かない（自分の画像を描きながら読まない）
      const was = s.mesh.visible;
      s.mesh.visible = false;
      renderer.setRenderTarget(s.target);
      renderer.clear();
      renderer.render(scene, vc);
      s.mesh.visible = was;
      s.uniforms.map.value = s.target.texture;
    }
    renderer.setRenderTarget(prevTarget);
    hooks.applyCells(null);
  }

  dispose(): void {
    for (const s of this.surfaces) s.target.dispose();
    this.surfaces.clear();
  }
}

/** 場面の中で見えているか（親の入れ物も全部 visible で、場面につながっている） */
function shown(o: THREE.Object3D): boolean {
  let x: THREE.Object3D | null = o;
  let top: THREE.Object3D = o;
  for (; x; x = x.parent) { if (!x.visible) return false; top = x; }
  return (top as THREE.Scene).isScene === true;
}

/**
 * 投影の近くの面を、面 plane（世界の座標。法線の側を残す）に傾ける（Lengyel の oblique near-plane clipping。three の Reflector と同じ式）
 */
export function obliqueNear(cam: THREE.PerspectiveCamera, plane: THREE.Plane): void {
  const p = plane.clone().applyMatrix4(cam.matrixWorldInverse);
  const clip = new THREE.Vector4(p.normal.x, p.normal.y, p.normal.z, p.constant);
  const e = cam.projectionMatrix.elements;
  const q = new THREE.Vector4(
    (Math.sign(clip.x) + e[8]!) / e[0]!,
    (Math.sign(clip.y) + e[9]!) / e[5]!,
    -1.0,
    (1.0 + e[10]!) / e[14]!,
  );
  clip.multiplyScalar(2.0 / clip.dot(q));
  e[2] = clip.x;
  e[6] = clip.y;
  e[10] = clip.z + 1.0;
  e[14] = clip.w;
}

/** 写し方（from → to、y 軸まわりに q·90°）の 4×4 の行列（core の xPoint と同じ: rotQ は three の rotateY(q·π/2)） */
export function xformMatrix(x: { from: readonly number[]; to: readonly number[]; q: number }): THREE.Matrix4 {
  const t1 = new THREE.Matrix4().makeTranslation(-x.from[0]!, -x.from[1]!, -x.from[2]!);
  const r = new THREE.Matrix4().makeRotationY((x.q * Math.PI) / 2);
  const t2 = new THREE.Matrix4().makeTranslation(x.to[0]!, x.to[1]!, x.to[2]!);
  return t2.multiply(r).multiply(t1);
}
