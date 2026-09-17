/**
 * 低解像度 RenderTarget（既定 256×144）のプールと、Tier に応じた更新周期でのキャプチャ。
 * PastWindow（R09 監視映画館 / E12 過去窓）、GraphReference（隣接部屋のサムネイル）、MirrorOffset の簡易鏡が使う。
 *
 * 統合担当向け: 呼び出し方
 * - 生成: `const snapshots = new SnapshotService(renderer)`（Game が 1 つ所有）。`snapshots.setTier(tier)` を Tier 変更時に呼ぶ。
 * - 表示面（スクリーン・窓の Mesh）は `markExcluded(mesh)` で SNAPSHOT_EXCLUDE_LAYER **だけ**に置く（three.js のレイヤ判定は
 *   `object.mask & camera.mask` なので、既定レイヤ 0 も有効にするとキャプチャ時にレイヤ 3 を外しても描かれてフィードバックループになる）。
 *   メインカメラは Game が `camera.layers.enable(SNAPSHOT_EXCLUDE_LAYER)` して表示面を見る。キャプチャ時はカメラの該当レイヤを一時的に無効化する。
 * - 取得: `const slot = snapshots.acquire()` → `slot.texture` を材質に貼る。不要になったら `snapshots.release(slot)`。
 * - 更新: 毎フレーム `snapshots.capture(slot, camera, scene, now)`。Tier の rtUpdateHz に従って間引き、描いたときだけ true を返す。
 *   rtUpdateHz = 0（low）は静止キャプチャモード: 最初の 1 回と `staticIntervalSec`（既定 3 s）ごと、または `force: true` のときだけ描く。
 * - メインカメラを流用するときは `capture(slot, camera, scene, now, { override: (cam) => ... })` で位置を一時変更できる（元に戻す）。
 * - 破棄: `snapshots.dispose()`（newWorld / ページ離脱）。
 */
import * as THREE from 'three';
import { QUALITY_TIERS, type QualityTier } from '../core/types';

/** スナップショットに描かないオブジェクトのレイヤ（表示面自身） */
export const SNAPSHOT_EXCLUDE_LAYER = 3;

export interface SnapshotSlot {
  readonly target: THREE.WebGLRenderTarget;
  readonly texture: THREE.Texture;
  /** 最後に描いた時刻（秒）。未描画は -Infinity */
  lastCapture: number;
  /** 描いた回数 */
  frames: number;
  inUse: boolean;
}

export interface CaptureOptions {
  /** 周期を無視して描く */
  force?: boolean;
  /** 静止キャプチャモードの間隔（秒）。既定 3 */
  staticIntervalSec?: number;
  /** カメラを一時的に動かす（呼び出し後に元へ戻す） */
  override?: (camera: THREE.Camera) => void;
  /** キャプチャ時だけ scene.fog を差し替える（省略時はそのまま） */
  fog?: THREE.Fog | null;
}

export function markExcluded(obj: THREE.Object3D): void {
  // レイヤ 3 のみ（0 は含めない）。メインカメラ側でレイヤ 3 を有効にしているので通常描画には出る
  obj.layers.set(SNAPSHOT_EXCLUDE_LAYER);
}

export class SnapshotService {
  private readonly pool: SnapshotSlot[] = [];
  private tier: QualityTier = QUALITY_TIERS.high;
  readonly width: number;
  readonly height: number;
  readonly maxSlots: number;
  private readonly savedViewport = new THREE.Vector4();
  private readonly savedScissor = new THREE.Vector4();
  private readonly camPos = new THREE.Vector3();
  private readonly camQuat = new THREE.Quaternion();

  constructor(private readonly renderer: THREE.WebGLRenderer, opts: { width?: number; height?: number; maxSlots?: number } = {}) {
    this.width = opts.width ?? 256;
    this.height = opts.height ?? 144;
    this.maxSlots = opts.maxSlots ?? 6;
  }

  setTier(tier: QualityTier): void { this.tier = tier; }

  /** 静止キャプチャモード（rtUpdateHz = 0） */
  get staticMode(): boolean { return this.tier.rtUpdateHz <= 0; }

  acquire(): SnapshotSlot | null {
    let slot = this.pool.find((s) => !s.inUse);
    if (!slot) {
      if (this.pool.length >= this.maxSlots) return null;
      const target = new THREE.WebGLRenderTarget(this.width, this.height, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: true, stencilBuffer: false,
        colorSpace: THREE.SRGBColorSpace,
      });
      target.texture.name = `snapshot/${this.pool.length}`;
      slot = { target, texture: target.texture, lastCapture: -Infinity, frames: 0, inUse: true };
      this.pool.push(slot);
    }
    slot.inUse = true;
    slot.lastCapture = -Infinity;
    slot.frames = 0;
    return slot;
  }

  release(slot: SnapshotSlot): void {
    slot.inUse = false;
    // 次の利用者が古い映像を見ないよう黒で塗る
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(slot.target);
    this.renderer.clear(true, true, false);
    this.renderer.setRenderTarget(prev);
  }

  /** 周期判定して描く。描いたら true */
  capture(slot: SnapshotSlot, camera: THREE.Camera, scene: THREE.Scene, now: number, o: CaptureOptions = {}): boolean {
    if (!slot.inUse) return false;
    if (!o.force) {
      const interval = this.staticMode ? (o.staticIntervalSec ?? 3) : 1 / this.tier.rtUpdateHz;
      if (slot.frames > 0 && now - slot.lastCapture < interval - 1e-4) return false;
    }
    this.render(slot, camera, scene, o);
    slot.lastCapture = now;
    slot.frames++;
    return true;
  }

  private render(slot: SnapshotSlot, camera: THREE.Camera, scene: THREE.Scene, o: CaptureOptions): void {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    r.getViewport(this.savedViewport);
    r.getScissor(this.savedScissor);
    const prevScissorTest = r.getScissorTest();
    const prevLayers = camera.layers.mask;
    const prevFog = scene.fog;
    const prevXr = r.xr.enabled;
    this.camPos.copy(camera.position);
    this.camQuat.copy(camera.quaternion);
    const prevParentless = !camera.parent;
    try {
      if (o.override) { o.override(camera); camera.updateMatrixWorld(true); }
      if (o.fog !== undefined) scene.fog = o.fog;
      camera.layers.disable(SNAPSHOT_EXCLUDE_LAYER);
      r.xr.enabled = false;
      r.setRenderTarget(slot.target);
      r.setScissorTest(false);
      r.setViewport(0, 0, this.width, this.height);
      r.clear(true, true, false);
      r.render(scene, camera);
    } finally {
      r.setRenderTarget(prevTarget);
      r.setViewport(this.savedViewport);
      r.setScissor(this.savedScissor);
      r.setScissorTest(prevScissorTest);
      r.xr.enabled = prevXr;
      camera.layers.mask = prevLayers;
      scene.fog = prevFog;
      if (o.override) {
        camera.position.copy(this.camPos);
        camera.quaternion.copy(this.camQuat);
        if (prevParentless) camera.updateMatrixWorld(true);
      }
    }
  }

  /** 使用中スロット数（デバッグ表示） */
  get activeCount(): number { return this.pool.filter((s) => s.inUse).length; }

  dispose(): void {
    for (const s of this.pool) s.target.dispose();
    this.pool.length = 0;
  }
}
