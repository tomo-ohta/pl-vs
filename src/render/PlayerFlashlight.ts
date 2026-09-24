import * as THREE from 'three';

/** 照度を一定に保つ距離（m）。これより遠い面は距離² で暗くなる */
const NEAR_REF = 4;
/**
 * 強度（カンデラ相当）。NEAR_REF での照度 = 88 / 16 = 5.5（旧 114 / 3 m = 12.7 の約 4 割）。明るい床・漆喰（反射率 0.8）でも
 * 露出後 0.4 前後に収まり、にじみ（LensPass の glow）の閾値 0.8 を超えにくい
 */
const BASE_INTENSITY = 88;

/** A carried torch: position follows the player, aim follows the displayed camera with inertia. */
export class PlayerFlashlight {
  // 半角 43°（旧 26°）・ペナンブラ 1.0（縁まで滑らか）・放射状の減衰マップ（中心 32% に芯、そこから縁へ薄い裾）で、
  // 照らした場所の円形の縁を消し、周囲がわずかに明るくなる「拡散した光」にする
  readonly light = new THREE.SpotLight(0xffeed5, BASE_INTENSITY, 22, Math.PI / 4.2, 1.0, 2);
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

  /** 正面の面までの距離に応じた減光の現在値（1 = 遠い。NEAR_REF より近いと距離² に比例して下がる） */
  private nearScale = 1;
  /**
   * @param hitDistance 視線方向の最寄りの面までの距離（m。無ければ Infinity）。照らした面の明るさ（照度 = 強度 / 距離²）が
   *   NEAR_REF m より近くで一定になるよう、強度を (距離 / NEAR_REF)² に比例させる（家庭用ビデオの自動絞りのように、壁・床に寄っても
   *   白く飛ばない）。変化は 0.12 s で追従（近づく = 暗くする側は 0.06 s で速く）
   */
  update(camera: THREE.Camera, dt: number, enabled: boolean, low = false, hitDistance = Infinity): void {
    // 消灯は強度 0 と影マップの更新停止で表す（visible = false にすると numSpotLights / 影の本数が変わり、見えている全材質の
    // シェーダが作り直される。R キーの切り替えやタイトル画面からの開始で 100 ms 級の停止になっていた）
    this.light.visible = true;
    this.light.shadow.autoUpdate = enabled;
    if (!enabled) { this.light.intensity = 0; this.reset(); return; }
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
    // 近接減光: 照度を NEAR_REF より近くで一定に（旧: 3 m 以内で距離の 1.8 乗・下限 7% → 0.5 m で照度が 4 m の 5 倍になり白飛びしていた）
    const d = Number.isFinite(hitDistance) ? Math.max(0.2, hitDistance) : Infinity;
    const target = Math.min(1, (d / NEAR_REF) ** 2);
    this.nearScale += (target - this.nearScale) * Math.min(1, step / (target < this.nearScale ? 0.06 : 0.12));
    this.light.intensity = (low ? BASE_INTENSITY / 2 : BASE_INTENSITY) * this.nearScale;
  }

  dispose(): void { this.light.removeFromParent(); this.light.target.removeFromParent(); this.light.map?.dispose(); this.light.dispose(); }
}
