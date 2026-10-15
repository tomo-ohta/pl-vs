/**
 * タブレットの 3D: 画面の絵（TabletScreen）を、2 通りの見せ方で一人称の視界に重ねる。
 *
 * - holo（既定）: 空中に映すホログラム。左手の小さな装置から光の線が伸び、目の前の空中に半透明の板（ゆるく曲がる）が開く
 *   （横 1 本の線が伸びる → 上下に開く）。板は視線に少し遅れてついてくる（少し目をそらすと部屋が見える）
 * - glass: 手に持つガラスの端末（v2 のタブレットと同じく下から持ち上げる。持っている間は呼吸と歩く揺れ・振り向きの遅れ）
 *
 * どちらも別の場面とカメラで描き、世界の絵の上に深度を消して重ねる（壁に埋まらない）。画面の走査線・走る光・ちらつき・
 * 開くときの乱れはシェーダーで足す（canvas は変わったときだけ描き直す）。現在地の矢印は画面の上の別の板
 */
import * as THREE from 'three';
import { SCREEN, TabletScreen, type TabKey } from './TabletScreen.ts';

export type TabletMode = 'holo' | 'glass';

const ASPECT = SCREEN.H / SCREEN.W;
/** 空中の板: 幅・距離・曲がりの半径（m） */
const HOLO_W = 0.84;
const HOLO_D = 0.6;
const HOLO_R = 1.5;
/** 空中の板の、視線からの下がり（rad） */
const HOLO_DROP = 0.1;
/** 視線から離れても板が動かない幅（rad） */
const DEAD_YAW = 0.3;
const DEAD_PITCH = 0.22;
/** ガラスの端末: 画面の幅と本体（m） */
const GLASS_W = 0.3;
const GLASS_BODY = { w: 0.322, h: 0.21, t: 0.006, r: 0.012 };
/** 姿勢（カメラから見た位置 m と回転 rad）: x y z rx ry rz */
type Pose = [number, number, number, number, number, number];
const GLASS_HIDDEN: Pose = [0.05, -0.42, -0.3, -1.2, 0.1, 0.2];
const GLASS_HELD: Pose = [0, -0.036, -0.235, -0.1, 0, 0];
/** 空中の装置（左手）: 見えている所と、しまった所 */
const EMITTER_AT: [number, number, number] = [-0.3, -0.245, -0.33];

const OPEN_T = { holo: 0.62, glass: 0.45 };
const CLOSE_T = { holo: 0.34, glass: 0.32 };

const ease = (x: number): number => x * x * (3 - 2 * x);
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const span = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** 画面: 開く（中央の横線から上下へ）・横のずれと色のずれ（開くとき・タブを替えたとき）・走査線・走る光・ちらつき */
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uReveal;
uniform float uAlpha;
uniform float uGlitch;
uniform float uScan;
uniform float uFlicker;
uniform float uSweep;
varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
  vec2 uv = vUv;
  float dy = abs(uv.y - 0.5) * 2.0;
  if (dy > uReveal) discard;
  float edge = (1.0 - smoothstep(0.0, 0.03, uReveal - dy)) * (1.0 - step(0.999, uReveal));
  float tk = floor(uTime * 24.0);
  float row = floor(uv.y * 140.0);
  float jitter = (hash(row * 1.37 + tk) - 0.5) * step(0.8, hash(row * 0.71 + tk * 1.3));
  uv.x += jitter * uGlitch * 0.05;
  float ca = 0.0006 + uGlitch * 0.008;
  vec4 c = texture2D(uMap, uv);
  float r = texture2D(uMap, uv + vec2(ca, 0.0)).r;
  float b = texture2D(uMap, uv - vec2(ca, 0.0)).b;
  vec3 col = vec3(r, c.g, b);
  float a = c.a;
  float scan = 1.0 - uScan * (0.5 + 0.5 * sin(vUv.y * 1500.0));
  float sweepPos = fract(uTime * 0.13) * 1.3 - 0.15;
  float sweep = exp(-pow((1.0 - vUv.y - sweepPos) * 38.0, 2.0)) * uSweep;
  float fl = 1.0 - uFlicker * hash(tk) * 0.1;
  col = col * scan * fl + vec3(0.38, 0.94, 1.0) * (sweep * (0.2 + a) * 0.55 + edge * 1.5);
  a = clamp(max(a, edge * 0.9) + sweep * 0.12, 0.0, 1.0) * uAlpha;
  gl_FragColor = vec4(col, a);
}`;

function panelMaterial(map: THREE.Texture, scan: number, flicker: number, sweep: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uAlpha: { value: 1 },
      uGlitch: { value: 0 },
      uScan: { value: scan },
      uFlicker: { value: flicker },
      uSweep: { value: sweep },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** ゆるく曲がった板（見る人の側へ両端が寄る）。u 右へ・v 下へ の点 */
function holoPoint(u: number, v: number, out = new THREE.Vector3()): THREE.Vector3 {
  const xf = (u - 0.5) * HOLO_W;
  const th = xf / HOLO_R;
  return out.set(HOLO_R * Math.sin(th), (0.5 - v) * HOLO_W * ASPECT, HOLO_R * (1 - Math.cos(th)));
}

function holoGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(HOLO_W, HOLO_W * ASPECT, 48, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    holoPoint(uv.getX(i), 1 - uv.getY(i), p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

function roundRect(w: number, h: number, r: number, path: THREE.Path = new THREE.Shape()): THREE.Path {
  const x0 = -w / 2;
  const y0 = -h / 2;
  path.moveTo(x0 + r, y0);
  path.lineTo(-x0 - r, y0);
  path.absarc(-x0 - r, y0 + r, r, -Math.PI / 2, 0, false);
  path.lineTo(-x0, -y0 - r);
  path.absarc(-x0 - r, -y0 - r, r, 0, Math.PI / 2, false);
  path.lineTo(x0 + r, -y0);
  path.absarc(x0 + r, -y0 - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + r);
  path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

/** 現在地の矢印（北が上の地図の上で、向きに回す）と、広がる輪 */
class Marker {
  readonly group = new THREE.Group();
  readonly arrow: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;

  constructor(size: number) {
    const s = new THREE.Shape();
    s.moveTo(0, size * 0.62);
    s.lineTo(size * 0.42, -size * 0.42);
    s.lineTo(0, -size * 0.18);
    s.lineTo(-size * 0.42, -size * 0.42);
    s.closePath();
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false }));
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(size * 0.75, 32),
      new THREE.MeshBasicMaterial({ color: 0x62f0ff, transparent: true, opacity: 0.22, depthTest: false, depthWrite: false }),
    );
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, depthTest: false, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.7, size * 0.82, 40), this.ringMat);
    for (const m of [halo, this.ring, arrow]) m.renderOrder = 20;
    this.arrow = arrow;
    this.group.add(halo, this.ring, arrow);
  }

  update(time: number, yaw: number): void {
    this.arrow.rotation.z = -yaw;
    const f = (time * 0.9) % 1;
    this.ring.scale.setScalar(1 + f * 1.4);
    this.ringMat.opacity = (1 - f) * 0.8;
  }
}

export interface ViewState {
  /** カメラの向き（0 = 北・右回りに +）と上下 */
  yaw: number;
  pitch: number;
  /** 歩く速さ（m/s）と歩いた距離 */
  speed: number;
  stride: number;
  /** 地図の上の現在地（m） */
  x: number;
  z: number;
}

export class TabletView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(68, 1, 0.01, 20);
  readonly screen: TabletScreen;
  private readonly texture: THREE.CanvasTexture;
  private modeNow: TabletMode;
  // 空中
  private readonly holoRig = new THREE.Group();
  private readonly holoPanel: THREE.Mesh;
  private readonly holoMat: THREE.ShaderMaterial;
  private readonly holoHalo: THREE.Mesh;
  private readonly holoMarker: Marker;
  private readonly emitter = new THREE.Group();
  private readonly emitterRing: THREE.MeshBasicMaterial;
  private readonly beam: THREE.LineSegments;
  private readonly fan: THREE.Mesh;
  // ガラス
  private readonly glassRig = new THREE.Group();
  private readonly glassPanel: THREE.Mesh;
  private readonly glassMat: THREE.ShaderMaterial;
  private readonly glassMarker: Marker;
  private readonly glassRim: THREE.MeshBasicMaterial;

  private want = false;
  /** 0 しまった … 1 開いた */
  private a = 0;
  private time = 0;
  private glitch = 0;
  private yawP = 0;
  private pitchP = 0;
  private followYaw = false;
  private followPitch = false;
  private prevYaw: number | null = null;
  private prevPitch = 0;
  private sway: [number, number] = [0, 0];
  /** 横幅の合わせ（細い画面では小さく） */
  private fit = 1;

  constructor(screen: TabletScreen, mode: TabletMode) {
    this.screen = screen;
    this.modeNow = mode;
    this.texture = new THREE.CanvasTexture(screen.canvas);
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.anisotropy = 8;

    this.scene.add(new THREE.HemisphereLight(0xdff6ff, 0x30363e, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-0.4, 1, 0.6);
    this.scene.add(key);

    // ---- 空中のホログラム
    this.holoMat = panelMaterial(this.texture, 0.07, 1, 0.22);
    this.holoPanel = new THREE.Mesh(holoGeometry(), this.holoMat);
    this.holoPanel.renderOrder = 5;
    const haloTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const rg = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      rg.addColorStop(0, 'rgba(110, 240, 255, 0.55)');
      rg.addColorStop(0.55, 'rgba(110, 240, 255, 0.12)');
      rg.addColorStop(1, 'rgba(110, 240, 255, 0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    this.holoHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(HOLO_W * 1.35, HOLO_W * ASPECT * 1.6),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }),
    );
    this.holoHalo.position.z = -0.03;
    this.holoHalo.renderOrder = 4;
    this.holoMarker = new Marker((30 / SCREEN.W) * HOLO_W);
    const holoBody = new THREE.Group();
    holoBody.position.z = -HOLO_D;
    holoBody.add(this.holoHalo, this.holoPanel, this.holoMarker.group);
    this.holoRig.add(holoBody);

    // 左手の装置: 台・光る輪・レンズ・持ち手
    const metal = new THREE.MeshStandardMaterial({ color: 0x1b2129, metalness: 0.75, roughness: 0.32 });
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.085, 24), metal);
    grip.position.y = -0.05;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.016, 36), metal);
    this.emitterRing = new THREE.MeshBasicMaterial({ color: 0x62f0ff, transparent: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0215, 0.0022, 10, 48), this.emitterRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.0085;
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 20, 12), new THREE.MeshBasicMaterial({ color: 0xd8fbff }));
    lens.position.y = 0.009;
    this.emitter.add(grip, head, ring, lens);
    this.emitter.rotation.set(0.5, 0, -0.55);
    this.emitter.scale.setScalar(0.85);
    // 光の線（装置 → 板の四隅）と、薄い光の扇（装置 → 板の下の縁）
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 3), 3));
    beamGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(8 * 4), 4));
    this.beam = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const fanGeo = new THREE.BufferGeometry();
    fanGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 3), 3));
    fanGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(3 * 4), 4));
    this.fan = new THREE.Mesh(
      fanGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    for (const o of [this.beam, this.fan]) {
      o.frustumCulled = false;
      o.renderOrder = 3;
    }
    this.scene.add(this.holoRig, this.emitter, this.beam, this.fan);

    // ---- 手に持つガラスの端末
    this.glassMat = panelMaterial(this.texture, 0.03, 0.25, 0.25);
    this.glassPanel = new THREE.Mesh(new THREE.PlaneGeometry(GLASS_W, GLASS_W * ASPECT), this.glassMat);
    // 本体の前の面（縁の面取りの分 1 mm 出ている）より手前
    this.glassPanel.position.z = GLASS_BODY.t / 2 + 0.0016;
    this.glassPanel.renderOrder = 5;
    const B = GLASS_BODY;
    const bodyGeo = new THREE.ExtrudeGeometry(roundRect(B.w, B.h, B.r) as THREE.Shape, {
      depth: B.t,
      bevelEnabled: true,
      bevelThickness: 0.001,
      bevelSize: 0.001,
      bevelSegments: 2,
      curveSegments: 10,
    });
    bodyGeo.translate(0, 0, -B.t / 2);
    const body = new THREE.Mesh(
      bodyGeo,
      new THREE.MeshPhysicalMaterial({ color: 0x0a1820, metalness: 0.2, roughness: 0.12, transparent: true, opacity: 0.62, clearcoat: 1, clearcoatRoughness: 0.1 }),
    );
    body.renderOrder = 4;
    const rimShape = roundRect(B.w + 0.002, B.h + 0.002, B.r + 0.001) as THREE.Shape;
    rimShape.holes.push(roundRect(B.w - 0.004, B.h - 0.004, B.r - 0.002, new THREE.Path()));
    this.glassRim = new THREE.MeshBasicMaterial({ color: 0x62f0ff, transparent: true, opacity: 0.75, depthWrite: false });
    const rim = new THREE.Mesh(new THREE.ShapeGeometry(rimShape, 10), this.glassRim);
    rim.position.z = B.t / 2 + 0.002;
    rim.renderOrder = 6;
    this.glassMarker = new Marker((30 / SCREEN.W) * GLASS_W);
    this.glassMarker.group.position.z = GLASS_BODY.t / 2 + 0.0024;
    this.glassRig.add(body, this.glassPanel, rim, this.glassMarker.group);
    this.scene.add(this.glassRig);

    this.scene.traverse((o) => (o.frustumCulled = false));
    this.applyMode();
  }

  get mode(): TabletMode {
    return this.modeNow;
  }

  set mode(m: TabletMode) {
    if (m === this.modeNow) return;
    this.modeNow = m;
    this.applyMode();
    this.glitch = 1;
  }

  /** 出している（出す途中も） */
  get isOpen(): boolean {
    return this.want;
  }

  /** 少しでも見えている */
  get visible(): boolean {
    return this.a > 0.001;
  }

  toggle(): void {
    this.want = !this.want;
    if (this.want) this.prevYaw = null;
  }

  close(): void {
    this.want = false;
  }

  setTab(t: TabKey): void {
    if (this.screen.tab === t) return;
    this.screen.setTab(t);
    this.glitch = Math.max(this.glitch, 0.55);
  }

  /** 画面の大きさが変わった（カメラの画角・縦横比を世界のカメラと同じに） */
  resize(fov: number, aspect: number): void {
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // 板の横幅が視界の 94 % に収まるように
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect);
    const need = Math.atan(HOLO_W / 2 / HOLO_D);
    this.fit = Math.min(1, Math.tan(halfH * 0.94) / Math.tan(need));
  }

  private applyMode(): void {
    const holo = this.modeNow === 'holo';
    this.holoRig.visible = holo;
    this.emitter.visible = holo;
    this.beam.visible = holo;
    this.fan.visible = holo;
    this.glassRig.visible = !holo;
  }

  update(dt: number, v: ViewState): void {
    this.time += dt;
    const holo = this.modeNow === 'holo';
    const T = this.want ? OPEN_T[this.modeNow] : CLOSE_T[this.modeNow];
    this.a = clamp01(this.a + (this.want ? dt : -dt) / T);
    this.glitch = Math.max(0, this.glitch - dt * 2.2);
    const any = this.a > 0.001;
    this.scene.visible = any;
    // 振り向きの速さ（遅れてついてくる揺れ）
    if (this.prevYaw === null) {
      this.prevYaw = v.yaw;
      this.prevPitch = v.pitch;
      this.yawP = v.yaw;
      this.pitchP = Math.max(-0.55, Math.min(0.35, v.pitch)) - HOLO_DROP;
    }
    const dyaw = wrapAngle(v.yaw - this.prevYaw);
    const dpitch = v.pitch - this.prevPitch;
    this.prevYaw = v.yaw;
    this.prevPitch = v.pitch;
    const k = 1 - Math.exp(-dt * 9);
    this.sway[0] += (Math.max(-0.08, Math.min(0.08, dyaw)) - this.sway[0]) * k;
    this.sway[1] += (Math.max(-0.08, Math.min(0.08, dpitch)) - this.sway[1]) * k;
    if (!any) return;

    if (this.screen.draw()) this.texture.needsUpdate = true;
    const onMap = this.screen.tab === 'map';
    if (holo) this.updateHolo(dt, v, onMap);
    else this.updateGlass(v, onMap);
  }

  private updateHolo(dt: number, v: ViewState, onMap: boolean): void {
    const a = this.a;
    // 視線に遅れてついてくる（動かない幅を越えたら、真ん中へ戻るまで追う）
    const target = Math.max(-0.55, Math.min(0.35, v.pitch)) - HOLO_DROP;
    const dy = wrapAngle(v.yaw - this.yawP);
    const dp = target - this.pitchP;
    if (Math.abs(dy) > DEAD_YAW) this.followYaw = true;
    if (Math.abs(dp) > DEAD_PITCH) this.followPitch = true;
    const f = 1 - Math.exp(-dt * 5.5);
    if (this.followYaw) {
      this.yawP += dy * f;
      if (Math.abs(dy) < 0.02) this.followYaw = false;
    }
    if (this.followPitch) {
      this.pitchP += dp * f;
      if (Math.abs(dp) < 0.02) this.followPitch = false;
    }
    const ry = -wrapAngle(this.yawP - v.yaw);
    const rx = this.pitchP - v.pitch;
    // ふわりと浮く
    const bob = Math.sin(this.time * 1.3) * 0.004;
    this.holoRig.rotation.set(rx, ry, 0, 'YXZ');
    this.holoRig.position.set(0, bob, 0);
    const body = this.holoPanel.parent!;
    body.scale.setScalar(this.fit);

    // 開く: 装置が上がる → 光の線 → 横 1 本の線が伸びる → 上下に開く
    const lift = ease(span(a, 0, 0.35));
    this.emitter.position.set(EMITTER_AT[0], EMITTER_AT[1] - (1 - lift) * 0.16, EMITTER_AT[2]);
    this.emitterRing.opacity = 0.35 + 0.65 * span(a, 0.15, 0.4);
    const line = ease(span(a, 0.28, 0.52));
    const reveal = ease(span(a, 0.5, 0.95));
    this.holoPanel.scale.set(Math.max(0.002, line), 1, 1);
    this.holoPanel.visible = line > 0.002;
    const u = this.holoMat.uniforms;
    u.uTime.value = this.time;
    u.uReveal.value = Math.max(0.006, reveal);
    u.uGlitch.value = Math.min(1, (1 - reveal) * 0.9 + this.glitch);
    u.uAlpha.value = 0.55 + 0.45 * span(a, 0.3, 0.7);
    (this.holoHalo.material as THREE.MeshBasicMaterial).opacity = 0.32 * reveal;
    this.holoMarker.group.visible = onMap && reveal > 0.98;
    if (this.holoMarker.group.visible) {
      const { u: mu, v: mv } = this.screen.mapUv(v.x, v.z);
      holoPoint(mu, mv, this.holoMarker.group.position).z += 0.002;
      this.holoMarker.update(this.time, v.yaw);
    }
    this.updateBeam(span(a, 0.2, 0.5));
  }

  /**
   * 装置のレンズから板への光の線（左上・左下・右下の角。板の文字の上を横切らない角だけ）と、下の縁への薄い光
   */
  private updateBeam(k: number): void {
    const lens = new THREE.Vector3(0, 0.009, 0);
    this.emitter.updateMatrixWorld(true);
    this.emitter.localToWorld(lens);
    this.holoPanel.updateMatrixWorld(true);
    const [tl, bl, br] = [
      [0, 0],
      [0, 1],
      [1, 1],
    ].map(([cu, cv]) => this.holoPanel.localToWorld(holoPoint(cu, cv)));
    const pos = this.beam.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.beam.geometry.getAttribute('color') as THREE.BufferAttribute;
    [tl, bl, br, bl].forEach((c, i) => {
      // 4 本目は使わない（長さ 0）
      const end = i === 3 ? lens : c;
      pos.setXYZ(i * 2, lens.x, lens.y, lens.z);
      pos.setXYZ(i * 2 + 1, end.x, end.y, end.z);
      col.setXYZW(i * 2, 0.3 * k, 0.85 * k, 1.0 * k, 0.75 * k);
      col.setXYZW(i * 2 + 1, 0.1 * k, 0.4 * k, 0.5 * k, 0.04 * k);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    const fp = this.fan.geometry.getAttribute('position') as THREE.BufferAttribute;
    const fc = this.fan.geometry.getAttribute('color') as THREE.BufferAttribute;
    fp.setXYZ(0, lens.x, lens.y, lens.z);
    fp.setXYZ(1, bl.x, bl.y, bl.z);
    fp.setXYZ(2, br.x, br.y, br.z);
    fc.setXYZW(0, 0.3 * k, 0.8 * k, 0.9 * k, 0.5 * k);
    fc.setXYZW(1, 0.05 * k, 0.15 * k, 0.2 * k, 0);
    fc.setXYZW(2, 0.05 * k, 0.15 * k, 0.2 * k, 0);
    fp.needsUpdate = true;
    fc.needsUpdate = true;
  }

  private updateGlass(v: ViewState, onMap: boolean): void {
    const a = this.a;
    const e = ease(a);
    const P = GLASS_HIDDEN.map((h, i) => h + (GLASS_HELD[i] - h) * e) as Pose;
    // 持っている間の揺れ: 呼吸・歩く揺れ・振り向きの遅れ
    const walk = Math.min(1, v.speed / 3);
    const breath = Math.sin(this.time * 1.7) * 0.0016;
    const bobY = Math.abs(Math.sin(v.stride * 1.9)) * 0.006 * walk;
    const bobX = Math.sin(v.stride * 0.95) * 0.004 * walk;
    this.glassRig.position.set(P[0] + bobX - this.sway[0] * 0.25, P[1] + breath - bobY + this.sway[1] * 0.2, P[2]);
    this.glassRig.rotation.set(P[3] + this.sway[1] * 0.6, P[4] + this.sway[0] * 0.8, P[5] + this.sway[0] * 0.4, 'XYZ');
    this.glassRig.scale.setScalar(this.fit);
    const reveal = ease(span(a, 0.55, 1));
    const u = this.glassMat.uniforms;
    u.uTime.value = this.time;
    u.uReveal.value = Math.max(0.004, reveal);
    u.uGlitch.value = Math.min(1, (1 - reveal) * 0.7 + this.glitch);
    u.uAlpha.value = span(a, 0.45, 0.7);
    this.glassRim.opacity = 0.25 + 0.5 * span(a, 0.3, 1);
    this.glassMarker.group.visible = onMap && reveal > 0.98;
    if (this.glassMarker.group.visible) {
      const { u: mu, v: mv } = this.screen.mapUv(v.x, v.z);
      this.glassMarker.group.position.set((mu - 0.5) * GLASS_W, (0.5 - mv) * GLASS_W * ASPECT, GLASS_BODY.t / 2 + 0.0024);
      this.glassMarker.update(this.time, v.yaw);
    }
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (!this.visible) return;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
