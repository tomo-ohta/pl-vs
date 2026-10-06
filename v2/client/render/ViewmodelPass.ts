/**
 * 手に持つ物（タブレット）を、世界の絵の上に重ねる pass（client/tablet）。PostFX が LensPass の後・OutputPass の前に入れる。
 *
 * - 手に持つ物は別の場面・別のカメラ（近くの物用。near 0.01 m）で、深度付きの RenderTarget（MSAA）に透明の黒の上へ描き、
 *   世界の絵（readBuffer）へ「前掛け」（premultiplied over）で重ねる。壁に近づいても世界に埋まらない
 * - LensPass の後なので、露出の追従・歪み・軟焦点は手に持つ物に掛からない（画面の文字がぼけない。露出は TabletController が照明に掛ける）。
 *   OutputPass（トーンマップ）と VideoPass（ビデオのにじみ・走査線）は世界と同じく掛かる（世界の中の物に見える）
 * - enabled = false の間は何もしない（手に持っていない間は描画の費用 0）
 */
import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

const OverShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(tDiffuse, vUv); }`,
};

export class ViewmodelPass extends Pass {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly quad: FullScreenQuad;
  private readonly material: THREE.ShaderMaterial;
  private readonly clearColor = new THREE.Color();

  constructor(scene: THREE.Scene, camera: THREE.Camera, samples = 4) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false });
    this.rt.texture.name = 'Viewmodel.rt';
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(OverShader.uniforms), vertexShader: OverShader.vertexShader, fragmentShader: OverShader.fragmentShader,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  override setSize(width: number, height: number): void {
    this.rt.setSize(Math.max(1, width), Math.max(1, height));
  }

  override render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const prevAuto = renderer.autoClear, prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(this.scene, this.camera);
    renderer.setClearColor(this.clearColor, prevAlpha);
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    this.material.uniforms.tDiffuse!.value = this.rt.texture;
    this.quad.render(renderer);
    renderer.autoClear = prevAuto;
  }

  override dispose(): void {
    this.rt.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
