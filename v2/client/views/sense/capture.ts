/**
 * 写した像（写真・監視カメラの映像）の描画の道具: 別のカメラで場面を描いて、板（画面・額）に貼る。
 * - 板の onBeforeRender で描く（描画器はそこでしか手に入らない。three の Reflector と同じ手）。描く間は板を隠す（自分を写して読み書きが重ならないように）
 * - 写すカメラは層 0 と LAYER_IMAGE（写した像にだけ写る物）を描く。画面の幕（LAYER_SCREEN）は写らない
 * - 重さ: 画質の段（quality().rtUpdateHz・解像度）で軽くする。0 Hz なら頼まれたときだけ 1 枚
 */
import * as THREE from 'three';
import type { ViewContext } from '../views.ts';
import { LAYER_IMAGE } from './common.ts';

export class Capture {
  readonly mesh: THREE.Mesh;
  readonly camera: THREE.PerspectiveCamera;
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly mat: THREE.MeshBasicMaterial;
  private pending = false;
  private last = -Infinity;
  /** 自動で描き直す間隔（秒。0 なら頼まれたときだけ） */
  interval = 0;
  /** 描くかどうか（区画にいる間だけ、など） */
  enabled = true;
  /** 描き終えたら呼ぶ */
  onRendered: (() => void) | null = null;

  constructor(ctx: ViewContext, w: number, h: number, fov: number, tint = 0xffffff) {
    const q = ctx.quality?.();
    const px = q?.id === 'high' ? 512 : q?.id === 'mid' ? 320 : 192;
    this.rt = new THREE.WebGLRenderTarget(px, Math.round((px * h) / w), { depthBuffer: true });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ color: tint, map: this.rt.texture, fog: false, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.camera = new THREE.PerspectiveCamera(fov, w / h, 0.05, 40);
    this.camera.layers.enable(LAYER_IMAGE);
    const hz = q?.rtUpdateHz ?? 0;
    this.interval = hz > 0 ? 1 / Math.min(hz, q?.id === 'high' ? 10 : 5) : 0;
    const scene = ctx.scene;
    this.mesh.onBeforeRender = (renderer) => {
      if (!scene || !this.enabled) return;
      const now = performance.now() / 1000;
      if (!this.pending && (this.interval <= 0 || now - this.last < this.interval)) return;
      this.pending = false;
      this.last = now;
      const prev = renderer.getRenderTarget();
      this.mesh.visible = false;
      this.camera.updateMatrixWorld();
      renderer.setRenderTarget(this.rt);
      renderer.clear();
      renderer.render(scene, this.camera);
      renderer.setRenderTarget(prev);
      this.mesh.visible = true;
      this.onRendered?.();
    };
  }

  /** 次に板が描かれるとき 1 枚描く */
  request(): void { this.pending = true; }

  /** 写すカメラの位置と向き */
  aim(from: readonly number[], to: readonly number[]): void {
    this.camera.position.set(from[0]!, from[1]!, from[2]!);
    this.camera.lookAt(to[0]!, to[1]!, to[2]!);
    this.camera.updateMatrixWorld();
  }

  /** 板を置く（中心 at・向き normal [x, z]） */
  place(at: readonly number[], normal: readonly number[]): void {
    this.mesh.position.set(at[0]!, at[1]!, at[2]!);
    this.mesh.rotation.set(0, Math.atan2(normal[0]!, normal[1]!), 0);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.rt.dispose();
  }
}

/** 写した像にだけ写る物（LAYER_IMAGE）: 開いた扉（暗い口・半開きの板・漏れる光）。壁 dir の at・床 y */
export function imageDoor(dir: number, wall: number, at: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const alongX = dir === 0 || dir === 2;
  const inward = dir === 0 || dir === 1 ? -1 : 1;
  const put = (m: THREE.Mesh, u: number, yy: number, out: number): void => {
    if (alongX) m.position.set(at + u, yy, wall + inward * out); else m.position.set(wall + inward * out, yy, at + u);
    if (!alongX) m.rotation.y = Math.PI / 2;
    g.add(m);
  };
  put(new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.05), new THREE.MeshBasicMaterial({ color: 0x0a0806, fog: true })), 0, y + 1.025, 0.006);
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.6), new THREE.MeshBasicMaterial({ color: 0xffc078, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: true })), 0.05, y + 0.9, 0.01);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.05, 0.95), new THREE.MeshBasicMaterial({ color: 0x6a5a4a, fog: true }));
  if (alongX) { panel.position.set(at - 0.5 + 0.03, y + 1.025, wall + inward * 0.45); } else { panel.position.set(wall + inward * 0.45, y + 1.025, at - 0.5 + 0.03); panel.rotation.y = Math.PI / 2; }
  g.add(panel);
  g.traverse((o) => o.layers.set(LAYER_IMAGE));
  return g;
}

/** 写した像にだけ写る人影（黒い人の形）。足元 at、向き yaw */
export function imageFigure(at: readonly number[], yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x050505, fog: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.24), mat);
  body.position.set(0, 1.0, 0);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.2), mat);
  legs.position.set(0, 0.25, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat);
  head.position.set(0, 1.68, 0);
  g.add(body, legs, head);
  g.position.set(at[0]!, at[1]!, at[2]!);
  g.rotation.y = yaw;
  g.traverse((o) => o.layers.set(LAYER_IMAGE));
  return g;
}

/** 物を片付ける（Group の中のジオメトリと材質） */
export function disposeGroup(g: THREE.Object3D): void {
  g.removeFromParent();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}
