import * as THREE from 'three';

/** A carried torch: position follows the player, aim follows the displayed camera with inertia. */
export class PlayerFlashlight {
  // 半角 43°（旧 26°）・ペナンブラ 1.0（縁まで滑らか）・放射状の減衰マップ（中心 32% に芯、そこから縁へ薄い裾）で、
  // 照らした場所の円形の縁を消し、周囲がわずかに明るくなる「拡散した光」にする
  readonly light = new THREE.SpotLight(0xffeed5, 95, 22, Math.PI / 4.2, 1.0, 2);
  private readonly aim = new THREE.Quaternion();
  private readonly wanted = new THREE.Quaternion();
  private readonly sway = new THREE.Quaternion();
  private readonly rotation = new THREE.Euler();
  private readonly previous = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private initialized = false;
  private time = 0;
  private movement = 0;

  constructor(scene: THREE.Scene) {
    this.light.name = 'player-flashlight';
    this.light.target.name = 'player-flashlight-target';
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);
    this.light.shadow.camera.near = .06;
    this.light.shadow.camera.far = 22;
    this.light.shadow.bias = -.00015;
    this.light.shadow.normalBias = .025;
    this.light.visible = false;
    this.light.map = PlayerFlashlight.beamMap();
    scene.add(this.light, this.light.target);
  }

  reset(): void { this.initialized = false; this.movement = 0; }

  /**
   * 投影マップ（256 px）。r = 中心からの距離（1 = 円錐の縁）。芯 exp(−(r/0.34)²) × 0.7 + 裾 (1 − r)^1.6 × 0.3 に、
   * 縁で 0 になる (1 − r²) を掛けて円錐の縁の段差を消す。document が無い環境では null
   */
  private static beamMap(): THREE.Texture | null {
    if (typeof document === 'undefined') return null;
    const N = 256;
    const canvas = document.createElement('canvas');
    canvas.width = N; canvas.height = N;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const dx = (i + 0.5) / N * 2 - 1, dy = (j + 0.5) / N * 2 - 1;
        const r = Math.min(1, Math.hypot(dx, dy));
        const core = Math.exp(-(r / 0.34) * (r / 0.34)) * 0.7;
        const halo = Math.pow(1 - r, 1.6) * 0.3;
        const v = Math.max(0, Math.min(1, (core + halo) * (1 - r * r * 0.85)));
        const b = Math.round(v * 255);
        const k = (j * N + i) * 4;
        img.data[k] = b; img.data[k + 1] = b; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.name = 'flashlight/beam';
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  }

  update(camera: THREE.Camera, dt: number, enabled: boolean, low = false): void {
    this.light.visible = enabled;
    if (!enabled) { this.reset(); return; }
    const step = Math.min(Math.max(dt, 0), .05);
    const distance = this.previous.distanceTo(camera.position);
    if (!this.initialized || distance > 3) {
      this.aim.copy(camera.quaternion);
      this.previous.copy(camera.position);
      this.initialized = true;
    }
    const speed = dt > 0 ? Math.min(1, this.previous.distanceTo(camera.position) / dt / 3) : 0;
    this.movement = THREE.MathUtils.lerp(this.movement, speed, 1 - Math.exp(-step * 8));
    this.previous.copy(camera.position);
    this.time += step;
    // Less than 1.3 degrees of walking sway; static breathing remains subtle.
    this.rotation.set(Math.sin(this.time * 7.7) * .014 * this.movement + Math.sin(this.time * 1.6) * .002,
      Math.sin(this.time * 5.8) * .02 * this.movement, 0);
    this.sway.setFromEuler(this.rotation);
    this.wanted.copy(camera.quaternion).multiply(this.sway);
    this.aim.slerp(this.wanted, 1 - Math.exp(-step / .085));
    // Keep the beam in front even after a sharp turn.
    const error = this.aim.angleTo(this.wanted);
    if (error > .24) this.aim.slerp(this.wanted, 1 - .24 / error);
    this.light.position.copy(camera.position); // cannot cross a nearby wall via a hand offset
    this.forward.set(0, 0, -1).applyQuaternion(this.aim);
    this.light.target.position.copy(this.light.position).addScaledVector(this.forward, 12);
    // MaterialLibrary applies diffuse scale .8 on low versus .4 on other tiers.
    // マップで中心が 0.7 に落ちるぶん 1.4 倍（芯の明るさは従来どおり）
    this.light.intensity = (low ? 47.5 : 95) * 1.4;
  }

  dispose(): void { this.light.removeFromParent(); this.light.target.removeFromParent(); this.light.map?.dispose(); this.light.dispose(); }
}
