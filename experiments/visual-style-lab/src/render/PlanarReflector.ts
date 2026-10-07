import * as THREE from 'three';

/**
 * 平面の鏡像（three の Reflector と同じ考え方）。鏡の位置に置いたカメラで場面を描き、
 * 材質（StyleMaterial の reflection）が texture と matrix で読む。
 * 1 つの高さの床・水面ごとに 1 つ。半分の解像度・MSAA なし。
 */
export class PlanarReflector {
  readonly target: THREE.WebGLRenderTarget;
  readonly matrix = new THREE.Matrix4();
  readonly camera = new THREE.PerspectiveCamera();
  /** 映すときに隠す物（反射する面そのものなど） */
  readonly hide: THREE.Object3D[] = [];
  enabled = true;
  /** 映り込みから外す小物の層（カメラの layers で 1 番を外す） */
  skipLayer = 1;
  private readonly plane = new THREE.Plane();
  private readonly normal: THREE.Vector3;
  private readonly point: THREE.Vector3;

  constructor(point: THREE.Vector3Like, normal: THREE.Vector3Like = { x: 0, y: 1, z: 0 }, readonly scale = 0.5) {
    this.point = new THREE.Vector3(point.x, point.y, point.z);
    this.normal = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    this.target = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 0 });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.target.texture.generateMipmaps = false;
  }

  setSize(w: number, h: number): void {
    this.target.setSize(Math.max(1, Math.round(w * this.scale)), Math.max(1, Math.round(h * this.scale)));
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.PerspectiveCamera): void {
    if (!this.enabled) return;
    const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const view = camPos.clone().sub(this.point);
    if (view.dot(this.normal) <= 0) return; // 裏から見ている

    // 鏡の位置と向き
    const mirror = this.point.clone().sub(view.reflect(this.normal).negate());
    const lookDir = new THREE.Vector3(0, 0, -1).applyMatrix4(new THREE.Matrix4().extractRotation(cam.matrixWorld));
    const target = camPos.clone().add(lookDir);
    const tv = this.point.clone().sub(target);
    tv.reflect(this.normal).negate();
    tv.add(this.point);
    const up = new THREE.Vector3(0, 1, 0).applyMatrix4(new THREE.Matrix4().extractRotation(cam.matrixWorld)).reflect(this.normal);

    const vc = this.camera;
    vc.position.copy(mirror);
    vc.up.copy(up);
    vc.lookAt(tv);
    vc.far = cam.far;
    vc.near = cam.near;
    vc.fov = cam.fov;
    vc.aspect = cam.aspect;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(cam.projectionMatrix);
    vc.layers.mask = cam.layers.mask;
    vc.layers.disable(this.skipLayer);
    vc.layers.enable(2); // 2 番 = 映り込みにだけ出す物

    // テクスチャ座標の行列
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);

    // 斜めの近クリップ面（鏡の面より下を描かない）
    this.plane.setFromNormalAndCoplanarPoint(this.normal, this.point).applyMatrix4(vc.matrixWorldInverse);
    const cp = new THREE.Vector4(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const pm = vc.projectionMatrix;
    const q = new THREE.Vector4(
      (Math.sign(cp.x) + pm.elements[8]) / pm.elements[0],
      (Math.sign(cp.y) + pm.elements[9]) / pm.elements[5],
      -1,
      (1 + pm.elements[10]) / pm.elements[14],
    );
    cp.multiplyScalar(2 / cp.dot(q));
    pm.elements[2] = cp.x;
    pm.elements[6] = cp.y;
    pm.elements[10] = cp.z + 1 - 0.0005;
    pm.elements[14] = cp.w;

    const vis = this.hide.map((o) => o.visible);
    this.hide.forEach((o) => (o.visible = false));
    const prevRT = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, vc);
    renderer.setRenderTarget(prevRT);
    renderer.shadowMap.autoUpdate = prevShadow;
    this.hide.forEach((o, i) => (o.visible = vis[i]));
  }

  dispose(): void {
    this.target.dispose();
  }
}
