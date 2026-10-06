/**
 * タブレットの形（client/tablet）。10.9 型ほどの板の端末を横に持つ。ブランドの印は付けない。
 * 手順は .claude/skills/procedural-3d-objects（実物の寸法 → 部位ごとの形 → 材質）。部品は three.js の形（角の丸い押し出し・平面）で作る。
 *
 * | 部位 | 寸法（横持ち） | 形 | 材質 |
 * |---|---|---|---|
 * | 本体 | 24.86 × 17.95 × 0.70 cm・角の丸み 1.25 cm・縁の面取り 1.2 mm | 角の丸い押し出し | つや消しのアルミ（スペースグレー） |
 * | 前面のガラス | 本体の前面 | 板（画面の穴あき） | 黒いガラス |
 * | 画面 | 22.64 × 15.75 cm（縦横比 1.44）・角の丸み 0.85 cm | 板 | 自分で光る（画面の絵） |
 * | 前面カメラ | 直径 3.2 mm（長い辺の縁の真ん中） | 円 | 黒いガラス |
 * | 背面カメラ | 直径 11 mm・出っ張り 1.2 mm（背面の角） | 円柱 | 黒いガラス + 金属の輪 |
 * | ボタン | 上面の電源・横の音量 2 つ | 角の丸い箱 | 本体と同じ |
 *
 * 局所の座標: 単位 m、原点は本体の真ん中、画面は +z を向く、上は +y。
 * カメラのとき（setViewfinder）は本体の裏を隠し、画面の透けた所から世界が見える（画面がカメラの映像になる）
 */
import * as THREE from 'three';

export const TABLET = {
  W: 0.2486, H: 0.1795, T: 0.007, R: 0.0125,
  /** 画面 */
  SW: 0.2264, SH: 0.1575, SR: 0.0085,
} as const;

/** 画面の絵の大きさ（px。縦横比は画面と同じ 1.44） */
export const SCREEN_PX = { w: 1152, h: 800 } as const;

function roundRect(w: number, h: number, r: number, path: THREE.Path = new THREE.Shape()): THREE.Path {
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  path.moveTo(x0 + r, y0);
  path.lineTo(x1 - r, y0);
  path.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x1, y1 - r);
  path.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  path.lineTo(x0 + r, y1);
  path.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + r);
  path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

export class TabletModel {
  readonly group = new THREE.Group();
  readonly screen: THREE.Mesh;
  readonly texture: THREE.CanvasTexture;
  /** 指のカーソル（画面の絵とは別の板。動かしても画面の絵を描き直さない） */
  readonly cursor = new THREE.Group();
  private readonly back: THREE.Object3D[] = [];
  private readonly screenMat: THREE.MeshBasicMaterial;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const { W, H, T, R, SW, SH, SR } = TABLET;
    const keep = <X extends { dispose(): void }>(x: X): X => { this.disposables.push(x); return x; };
    // 本体（アルミ）: 角の丸い押し出し + 縁の面取り
    const b = 0.0012;
    const shellGeo = keep(new THREE.ExtrudeGeometry(roundRect(W - 2 * b, H - 2 * b, R - b) as THREE.Shape, { depth: T - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10 }));
    shellGeo.translate(0, 0, -(T - 2 * b) / 2);
    const alu = keep(new THREE.MeshStandardMaterial({ color: 0x6d7076, metalness: 0.5, roughness: 0.42 }));
    const shell = new THREE.Mesh(shellGeo, alu);
    // 前面のガラス（画面の穴あき）
    const glass = keep(new THREE.MeshStandardMaterial({ color: 0x07080a, metalness: 0.15, roughness: 0.14 }));
    const ringShape = roundRect(W - 0.0016, H - 0.0016, R - 0.0008) as THREE.Shape;
    ringShape.holes.push(roundRect(SW, SH, SR, new THREE.Path()));
    const ring = new THREE.Mesh(keep(new THREE.ShapeGeometry(ringShape, 10)), glass);
    ring.position.z = T / 2 + 0.0001;
    // 画面（絵を貼る。uv は 0..1）
    const screenGeo = keep(new THREE.ShapeGeometry(roundRect(SW, SH, SR) as THREE.Shape, 10));
    const pos = screenGeo.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) + SW / 2) / SW; uv[i * 2 + 1] = (pos.getY(i) + SH / 2) / SH; }
    screenGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.texture = keep(new THREE.CanvasTexture(canvas));
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.screenMat = keep(new THREE.MeshBasicMaterial({ map: this.texture, transparent: true }));
    this.screen = new THREE.Mesh(screenGeo, this.screenMat);
    this.screen.position.z = T / 2 + 0.00016;
    this.screen.renderOrder = 2;
    // 前面カメラ
    const lensMat = keep(new THREE.MeshStandardMaterial({ color: 0x0b0d14, metalness: 0.2, roughness: 0.08 }));
    const front = new THREE.Mesh(keep(new THREE.CircleGeometry(0.0016, 16)), lensMat);
    front.position.set(0, SH / 2 + (H - SH) / 4, T / 2 + 0.00018);
    // 背面カメラ（出っ張り・輪・レンズ）
    const bump = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.0055, 0.0055, 0.0012, 24)), alu);
    bump.rotation.x = Math.PI / 2;
    bump.position.set(W / 2 - 0.021, H / 2 - 0.021, -T / 2 - 0.0006);
    const rear = new THREE.Mesh(keep(new THREE.CircleGeometry(0.0042, 20)), lensMat);
    rear.rotation.y = Math.PI;
    rear.position.set(W / 2 - 0.021, H / 2 - 0.021, -T / 2 - 0.00125);
    // ボタン（上面の電源・横の音量）
    const btnGeo = keep(new THREE.BoxGeometry(1, 1, 1));
    const btn = (x: number, y: number, w: number, h: number): THREE.Mesh => { const m = new THREE.Mesh(btnGeo, alu); m.scale.set(w, h, 0.0034); m.position.set(x, y, 0); return m; };
    const power = btn(W / 2 - 0.034, H / 2 + 0.0004, 0.019, 0.0012);
    const volUp = btn(W / 2 + 0.0004, H / 2 - 0.036, 0.0012, 0.015);
    const volDown = btn(W / 2 + 0.0004, H / 2 - 0.055, 0.0012, 0.015);
    this.back.push(shell, bump, rear, power, volUp, volDown);
    // 指のカーソル（白い輪と薄い塗り）
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthTest: false }));
    const fillMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false }));
    const cRing = new THREE.Mesh(keep(new THREE.RingGeometry(0.0029, 0.0039, 28)), ringMat);
    const cFill = new THREE.Mesh(keep(new THREE.CircleGeometry(0.0029, 28)), fillMat);
    for (const m of [cRing, cFill]) m.renderOrder = 10;
    this.cursor.add(cFill, cRing);
    this.cursor.position.z = T / 2 + 0.0004;
    this.cursor.visible = false;
    this.group.add(shell, ring, this.screen, front, bump, rear, power, volUp, volDown, this.cursor);
    this.group.traverse((o) => { o.frustumCulled = false; });
  }

  /** カメラのとき: 本体の裏を隠す（画面の透けた所から世界が見える） */
  setViewfinder(on: boolean): void {
    for (const o of this.back) o.visible = !on;
  }

  /** 画面の明るさ（1 = 絵のまま） */
  setScreenGain(k: number): void {
    this.screenMat.color.setScalar(k);
  }

  /** 指のカーソルの位置（u 右へ・v 下へ 0..1） */
  setCursor(u: number, v: number, visible: boolean): void {
    this.cursor.visible = visible;
    this.cursor.position.x = (u - 0.5) * TABLET.SW;
    this.cursor.position.y = (0.5 - v) * TABLET.SH;
  }

  /** 光線が画面に当たる所（u 右へ・v 下へ 0..1。当たらなければ null） */
  screenUv(ray: THREE.Raycaster): { u: number; v: number } | null {
    const hit = ray.intersectObject(this.screen, false)[0];
    if (!hit?.uv) return null;
    return { u: hit.uv.x, v: 1 - hit.uv.y };
  }

  /** 光線が画面の面（広げた平面）に当たる所（画面の外にはみ出してもよい。ドラッグを続けるとき） */
  planeUv(ray: THREE.Raycaster): { u: number; v: number } | null {
    this.screen.updateWorldMatrix(true, false);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(this.screen.matrixWorld);
    const p = new THREE.Vector3().setFromMatrixPosition(this.screen.matrixWorld);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, p);
    const at = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (!at) return null;
    const local = this.screen.worldToLocal(at);
    return { u: local.x / TABLET.SW + 0.5, v: 0.5 - local.y / TABLET.SH };
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }
}
