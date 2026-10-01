/**
 * PastWindow — 過去の映像を壁面の箔に映す（R09 監視映画館 / E12 過去窓回廊）。
 * params: mode('screen' | 'window'), delaySec(R09), historyDepthSec / snapshotIntervalSec / snapshotCount(E12), source('theaterCamera')。
 *
 * mode 'screen'（R09, v1.3 D21）:
 *   layout: Theater の白いスクリーン箔（wallWhite 非ソリッド）を 'void'（黒い裏地 = マーカー）に差し替える。無い部屋（fallback など）は
 *           入口から最も遠い外壁に額縁付きのスクリーン箔を新設する。
 *   build : 箔の手前にキャプチャテクスチャの平面 Mesh を置き（SnapshotService.markExcluded で自分自身は写さない）、劇場後方上部の
 *           固定カメラ（出口と入口の平均点を見る = 次部屋ヒント）で撮る RoomEffect を作る。
 *           Tier rtUpdateHz > 0: 毎フレーム（上限 24 Hz）撮り、PlayerProxy を PoseHistory の delaySec 前の姿勢に置く → 自分が 3 秒遅れて映る。
 *           Tier rtUpdateHz = 0: delaySec ごとの静止キャプチャ（自然に 0〜3 秒遅れる。Proxy は現在姿勢）。
 * mode 'window'（E12, v1.3 D25）:
 *   layout: 廊下の外壁に snapshotCount 枚（既定 3）の窓（額縁 + 'void' 箔）を入口から近い順に並べる。
 *   build : snapshotIntervalSec（10 s）ごとに現在視点（メインカメラ）を静止キャプチャし、入口に近い窓から古い順に表示する。全 Tier 同一。
 * ジオメトリは layout で確定し、build/update はテクスチャ（map）だけ差し替える。スナップショット履歴は保存しない（ランタイム限定）。
 * SnapshotService のスロット（既定 6）が足りないときは取れた枚数だけで動く（残りの窓は黒）。
 */
import * as THREE from 'three';
import type { ModifierImpl, RuntimeContext } from '../types';
import type { BuiltRoom, RoomEffect } from '../../render/RoomBuilder';
import { markExcluded, type SnapshotSlot, type SnapshotService } from '../../render/SnapshotService';
import { PROXY_LAYER } from '../../player/PlayerProxy';
import { dirVec, toWorld, type Dir, type Placement, type Vec3 } from '../../core/types';
import type { Box, RoomLayout } from '../../generators/layout';
import { interiorBoxes, num, str } from '../util';
import { foilBox, frameBoxes, wallSlots, yawOf } from './GraphReference.wall';

/** マーカー箔の材質（黒い裏地。キャプチャが無いときはこの色が見える） */
const MARKER_MAT = 'void';
const WINDOW_W = 1.6;
const WINDOW_H = 0.9;
const WINDOW_Y = 1.45;

interface Foil {
  box: Box;
  /** 表面が向く方向（部屋の内側） */
  dir: Dir;
  center: Vec3;
  w: number;
  h: number;
  thick: number;
}

/** 薄い箔の向き（薄い軸で、部屋中心から見て手前側を向く） */
function foilOf(b: Box, L: RoomLayout): Foil | null {
  const sx = b.max[0] - b.min[0];
  const sy = b.max[1] - b.min[1];
  const sz = b.max[2] - b.min[2];
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const mx = (L.bounds.min[0] + L.bounds.max[0]) / 2;
  const mz = (L.bounds.min[2] + L.bounds.max[2]) / 2;
  const center: Vec3 = [cx, (b.min[1] + b.max[1]) / 2, cz];
  if (sz <= 0.1 && sx >= 0.8 && sy >= 0.5) return { box: b, dir: cz < mz ? 0 : 2, center, w: sx, h: sy, thick: sz };
  if (sx <= 0.1 && sz >= 0.8 && sy >= 0.5) return { box: b, dir: cx < mx ? 1 : 3, center, w: sz, h: sy, thick: sx };
  return null;
}

/** Theater 生成器のスクリーン（白い非ソリッド箔。幅 3 m 以上・高さ 2 m 以上） */
function findTheaterScreen(L: RoomLayout): Foil | null {
  for (const b of interiorBoxes(L)) {
    if (b.mat !== 'wallWhite' || b.solid) continue;
    const f = foilOf(b, L);
    if (f && f.w >= 3 && f.h >= 2) return f;
  }
  return null;
}

/** マーカー箔（'void' 非ソリッドの薄い箔）。layout で置いたものを build が同じ規則で見つける */
export function findMarkerFoils(L: RoomLayout): Foil[] {
  const out: Foil[] = [];
  for (const b of interiorBoxes(L)) {
    if (b.mat !== MARKER_MAT || b.solid) continue;
    const f = foilOf(b, L);
    if (f) out.push(f);
  }
  return out;
}

function entryPos(L: RoomLayout): Vec3 | null {
  const e = L.sockets.find((s) => s.id === 'entry');
  return e ? e.pos : null;
}

function distFromEntry(L: RoomLayout, p: Vec3): number {
  const e = entryPos(L);
  return e ? Math.hypot(p[0] - e[0], p[2] - e[2]) : 0;
}

// ---------------------------------------------------------------- layout

function layoutScreen(L: RoomLayout): void {
  const theater = findTheaterScreen(L);
  if (theater) {
    theater.box.mat = MARKER_MAT;
    return;
  }
  // スクリーンが無い部屋: 入口から最も遠い外壁に新設（幅は壁に合わせて 3〜6 m、高さは天井の 60%）
  const h = Math.min(3.4, Math.max(1.6, L.height * 0.6));
  for (const w of [6, 4.5, 3]) {
    const slot = wallSlots(L, { width: w, height: h, y: Math.min(L.height - h / 2 - 0.2, 0.8 + h / 2), orderFromEntry: false, max: 1, socketClearance: 0.6 })[0];
    if (!slot) continue;
    L.boxes.push(...frameBoxes(slot.pos, slot.dir, w, h, 0.08, 0.06, 'trim'));
    L.boxes.push(foilBox(slot.pos, slot.dir, w, h, 0.03, MARKER_MAT, 0.01));
    return;
  }
}

function layoutWindows(L: RoomLayout, count: number): void {
  const y = Math.min(L.height - WINDOW_H / 2 - 0.25, WINDOW_Y);
  const slots = wallSlots(L, { width: WINDOW_W, height: WINDOW_H, y, spacing: 3.2, orderFromEntry: true, max: count, socketClearance: 0.7 });
  for (const s of slots) {
    L.boxes.push(...frameBoxes(s.pos, s.dir, WINDOW_W, WINDOW_H, 0.07, 0.05, 'trim'));
    L.boxes.push(foilBox(s.pos, s.dir, WINDOW_W, WINDOW_H, 0.02, MARKER_MAT, 0.005));
  }
}

// ---------------------------------------------------------------- build

/** 箔の手前に置く表示面（キャプチャが無い間は黒） */
function makeScreenMesh(f: Foil, built: BuiltRoom): { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } {
  const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const geo = new THREE.PlaneGeometry(Math.max(0.1, f.w - 0.02), Math.max(0.1, f.h - 0.02));
  const mesh = new THREE.Mesh(geo, material);
  const n = dirVec(f.dir);
  const off = f.thick / 2 + 0.012;
  mesh.position.set(f.center[0] + n[0] * off, f.center[1], f.center[2] + n[2] * off);
  mesh.rotation.y = yawOf(f.dir);
  mesh.name = 'PastWindow/screen';
  mesh.userData.disposable = [material];
  markExcluded(mesh);
  built.group.add(mesh);
  return { mesh, material };
}

function setMap(m: THREE.MeshBasicMaterial, tex: THREE.Texture | null): void {
  if (m.map === tex) return;
  const toggled = (m.map === null) !== (tex === null);
  m.map = tex;
  m.color.set(tex ? 0xffffff : 0x000000);
  if (toggled) m.needsUpdate = true;
}

/** R09: 劇場内の固定カメラ（後方上部から入口・出口の平均点を見る）をワールド座標で作る */
function makeTheaterCamera(f: Foil, L: RoomLayout, pl: Placement): THREE.PerspectiveCamera {
  const n = dirVec(f.dir);
  // スクリーンの法線方向へ部屋の反対側の壁際まで
  const far = f.dir === 0 ? L.bounds.max[2] - 0.7 : f.dir === 2 ? L.bounds.min[2] + 0.7 : f.dir === 1 ? L.bounds.max[0] - 0.7 : L.bounds.min[0] + 0.7;
  const camLocal: Vec3 = f.dir === 0 || f.dir === 2 ? [f.center[0], L.height - 0.45, far] : [far, L.height - 0.45, f.center[2]];
  // 注視点: 入口と出口（hole 以外）の平均。無ければスクリーン中央の床上 1 m
  const pts = L.sockets.filter((s) => s.type !== 'hole').map((s) => s.pos);
  let target: Vec3 = [f.center[0] + n[0] * 2, 1.0, f.center[2] + n[2] * 2];
  if (pts.length) {
    const sum = pts.reduce((a, q) => [a[0] + q[0], 0, a[2] + q[2]] as Vec3, [0, 0, 0] as Vec3);
    target = [sum[0] / pts.length, 1.0, sum[2] / pts.length];
    // 部屋の中心へ 30% 寄せて、片側に偏った出口でも室内が画面に入るようにする
    const mx = (L.bounds.min[0] + L.bounds.max[0]) / 2;
    const mz = (L.bounds.min[2] + L.bounds.max[2]) / 2;
    target = [target[0] * 0.7 + mx * 0.3, 1.0, target[2] * 0.7 + mz * 0.3];
  }
  const cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 150);
  const wp = toWorld(pl, camLocal);
  const wt = toWorld(pl, target);
  cam.position.set(wp[0], wp[1], wp[2]);
  cam.lookAt(wt[0], wt[1], wt[2]);
  cam.layers.enable(0);
  cam.layers.enable(PROXY_LAYER);
  cam.updateMatrixWorld(true);
  return cam;
}

class ScreenEffect implements RoomEffect {
  private slot: SnapshotSlot | null = null;
  private svc: SnapshotService | null = null;
  private last = -Infinity;
  constructor(private readonly material: THREE.MeshBasicMaterial, private readonly camera: THREE.PerspectiveCamera, private readonly delaySec: number) {}

  update(_dt: number, ctx: RuntimeContext): void {
    const svc = ctx.game?.snapshots;
    if (!svc) return;
    if (!this.slot) {
      this.slot = svc.acquire();
      if (!this.slot) return;
      this.svc = svc;
      setMap(this.material, this.slot.texture);
    }
    const proxy = ctx.game?.proxy;
    if (svc.staticMode) {
      // 静止キャプチャ: delaySec ごと。Proxy は現在姿勢（表示が 0〜delaySec 遅れる）
      if (ctx.now - this.last < this.delaySec - 1e-4 && this.slot.frames > 0) return;
      const pose = proxy?.history.latest();
      if (proxy && pose) proxy.placeAt(pose);
      svc.capture(this.slot, this.camera, ctx.scene, ctx.now, { force: true });
      this.last = ctx.now;
      return;
    }
    // ライブ: Tier の周期（上限 24 Hz）。Proxy を delaySec 前の姿勢に置く → 自分が遅れて映る
    const hz = Math.max(1, Math.min(ctx.tier.rtUpdateHz, 24));
    if (ctx.now - this.last < 1 / hz - 1e-4 && this.slot.frames > 0) return;
    const pose = proxy?.history.poseAt(this.delaySec);
    if (proxy && pose) proxy.placeAt(pose);
    if (svc.capture(this.slot, this.camera, ctx.scene, ctx.now, { force: true })) this.last = ctx.now;
  }

  dispose(): void {
    if (this.slot && this.svc) this.svc.release(this.slot);
    this.slot = null;
    setMap(this.material, null);
  }
}

class WindowEffect implements RoomEffect {
  private readonly slots: SnapshotSlot[] = [];
  /** 撮った順（先頭が最古） */
  private readonly frames: SnapshotSlot[] = [];
  private svc: SnapshotService | null = null;
  private last = -Infinity;
  constructor(private readonly materials: THREE.MeshBasicMaterial[], private readonly intervalSec: number) {}

  update(_dt: number, ctx: RuntimeContext): void {
    const svc = ctx.game?.snapshots;
    if (!svc || this.materials.length === 0) return;
    this.svc = svc;
    if (ctx.now - this.last < this.intervalSec - 1e-4 && this.frames.length > 0) return;
    let slot: SnapshotSlot | null = null;
    if (this.slots.length < this.materials.length) {
      slot = svc.acquire();
      if (slot) this.slots.push(slot);
    }
    if (!slot) {
      if (this.slots.length === 0) return;
      // 最古のフレームを使い回す
      slot = this.frames.shift() ?? this.slots[0];
      const i = this.frames.indexOf(slot);
      if (i >= 0) this.frames.splice(i, 1);
    }
    svc.capture(slot, ctx.camera, ctx.scene, ctx.now, { force: true });
    this.frames.push(slot);
    this.last = ctx.now;
    // 入口に近い窓から古い順
    this.materials.forEach((m, i) => setMap(m, this.frames[i]?.texture ?? null));
  }

  dispose(): void {
    if (this.svc) for (const s of this.slots) this.svc.release(s);
    this.slots.length = 0;
    this.frames.length = 0;
    for (const m of this.materials) setMap(m, null);
  }
}

const PastWindow: ModifierImpl = {
  id: 'PastWindow',
  defaults: { mode: 'window', delaySec: 3, historyDepthSec: 30, snapshotIntervalSec: 10, snapshotCount: 3, source: 'theaterCamera' },

  layout(L, _p, params) {
    const mode = str(params.mode, 'window');
    if (mode === 'screen') layoutScreen(L);
    else {
      const depth = Math.max(5, num(params.historyDepthSec, 30));
      const interval = Math.max(2, num(params.snapshotIntervalSec, 10));
      const count = Math.max(1, Math.min(4, Math.round(num(params.snapshotCount, Math.round(depth / interval)))));
      layoutWindows(L, count);
    }
  },

  build(built, L, ctx) {
    const mode = str(ctx.params.mode, 'window');
    const foils = findMarkerFoils(L);
    if (foils.length === 0) return;
    if (mode === 'screen') {
      const f = foils.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
      const { material } = makeScreenMesh(f, built);
      const camera = makeTheaterCamera(f, L, ctx.node.placement ?? { position: [0, 0, 0], yawQ: 0 });
      built.effects.push(new ScreenEffect(material, camera, Math.max(0.5, num(ctx.params.delaySec, 3))));
      return;
    }
    const ordered = [...foils].sort((a, b) => distFromEntry(L, a.center) - distFromEntry(L, b.center));
    const mats = ordered.map((f) => makeScreenMesh(f, built).material);
    built.effects.push(new WindowEffect(mats, Math.max(2, num(ctx.params.snapshotIntervalSec, 10))));
  },
};

export default PastWindow;
