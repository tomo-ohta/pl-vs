/**
 * プレイヤーの代理メッシュ（見えないカプセル）と姿勢履歴（PoseHistory: 30 秒リングバッファ、0.1 秒刻み）。
 * MirrorOffset（0.5 s 遅れの鏡像）、PastWindow（3 s 遅れの監視映像）、InvertedShadow（プレイヤーのブロブ影）が Phase 2 で使う。
 *
 * 統合担当向け: 呼び出し方（Game）
 * - 生成: `const proxy = new PlayerProxy(); scene.add(proxy.mesh);`
 *   mesh は layers 1 のみに置くので、通常カメラ（layer 0）では描かれない。効果側のカメラで `camera.layers.enable(1)` する。
 * - 毎フレーム（Game.step、player.update / ride.update の後）: `proxy.update(dt, player);`
 *   現在姿勢を履歴に記録し、mesh を現在位置に置く（既定）。テレポート（1 サンプルで 6 m 超の移動）を検知すると履歴を捨てる。
 * - 過去の姿勢: `proxy.history.poseAt(3.0)` → `{ pos, yaw, pitch, crouching } | null`（履歴が足りなければ最古、空なら null）。
 * - 効果側は `proxy.placeAt(pose)` で mesh を任意の姿勢に置ける（PastWindow の 3 秒前）。鏡像は効果側が
 *   mesh のクローン（`proxy.mesh.clone()`）を作り、鏡面で反転して置く。
 * - `proxy.followMode = 'none'` にすると update は履歴の記録だけ行い、mesh の配置は効果側に委ねる。
 * - 新しい世界 / ロード時: `proxy.history.clear()`。
 */
import * as THREE from 'three';
import type { Vec3 } from '../core/types';
import { PLAYER, type PlayerController } from './PlayerController';

export interface ProxyPose {
  /** 足元位置（ワールド） */
  pos: Vec3;
  yaw: number;
  pitch: number;
  crouching: boolean;
}

/** プロキシメッシュを置く three.js のレイヤー番号 */
export const PROXY_LAYER = 1;

/** 固定刻みのリングバッファ。push は dt を積算し、刻みを超えるごとに 1 サンプル記録する */
export class PoseHistory {
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly yaw: Float32Array;
  private readonly pitch: Float32Array;
  private readonly crouch: Uint8Array;
  private readonly cap: number;
  /** 次に書き込む位置 */
  private head = 0;
  /** 記録済みサンプル数（cap まで） */
  private count = 0;
  private acc = 0;
  /** 最新サンプル以降に経過した時間（補間用） */
  private sinceLast = 0;

  constructor(
    readonly seconds = 30,
    readonly step = 0.1,
  ) {
    this.cap = Math.max(2, Math.ceil(seconds / step) + 1);
    this.px = new Float32Array(this.cap);
    this.py = new Float32Array(this.cap);
    this.pz = new Float32Array(this.cap);
    this.yaw = new Float32Array(this.cap);
    this.pitch = new Float32Array(this.cap);
    this.crouch = new Uint8Array(this.cap);
  }

  get length(): number {
    return this.count;
  }

  /** 記録されている時間幅（秒） */
  get span(): number {
    return Math.max(0, this.count - 1) * this.step;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.acc = 0;
    this.sinceLast = 0;
  }

  /** dt を積算し、刻みごとに pose を記録する。記録したサンプル数を返す */
  push(dt: number, pose: ProxyPose): number {
    if (this.count === 0) {
      this.write(pose);
      this.acc = 0;
      this.sinceLast = 0;
      return 1;
    }
    this.acc += dt;
    if (this.acc >= this.step) {
      this.write(pose);
      // 大きな dt（タブ復帰など）は 1 サンプルだけ書き、余りを捨てる
      this.acc = this.acc >= this.step * 2 ? 0 : this.acc - this.step;
      this.sinceLast = this.acc;
      return 1;
    }
    this.sinceLast = this.acc;
    return 0;
  }

  /** 最新サンプル */
  latest(): ProxyPose | null {
    if (this.count === 0) return null;
    return this.read((this.head - 1 + this.cap) % this.cap);
  }

  /** secondsAgo 秒前の姿勢（線形補間）。履歴が足りなければ最古のサンプル、空なら null */
  poseAt(secondsAgo: number): ProxyPose | null {
    if (this.count === 0) return null;
    // サンプル座標系: 0 = 最新、count-1 = 最古
    const f = Math.max(0, (secondsAgo - this.sinceLast) / this.step);
    const i0 = Math.min(this.count - 1, Math.floor(f));
    const i1 = Math.min(this.count - 1, i0 + 1);
    const k = i1 > i0 ? Math.min(1, f - i0) : 0;
    const a = this.read((this.head - 1 - i0 + this.cap * 2) % this.cap);
    if (k <= 0) return a;
    const b = this.read((this.head - 1 - i1 + this.cap * 2) % this.cap);
    return {
      pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * k, a.pos[1] + (b.pos[1] - a.pos[1]) * k, a.pos[2] + (b.pos[2] - a.pos[2]) * k],
      yaw: lerpAngle(a.yaw, b.yaw, k),
      pitch: a.pitch + (b.pitch - a.pitch) * k,
      crouching: k < 0.5 ? a.crouching : b.crouching,
    };
  }

  private write(p: ProxyPose): void {
    const i = this.head;
    this.px[i] = p.pos[0];
    this.py[i] = p.pos[1];
    this.pz[i] = p.pos[2];
    this.yaw[i] = p.yaw;
    this.pitch[i] = p.pitch;
    this.crouch[i] = p.crouching ? 1 : 0;
    this.head = (i + 1) % this.cap;
    if (this.count < this.cap) this.count++;
  }

  private read(i: number): ProxyPose {
    return { pos: [this.px[i], this.py[i], this.pz[i]], yaw: this.yaw[i], pitch: this.pitch[i], crouching: this.crouch[i] === 1 };
  }
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export class PlayerProxy {
  /** 見えないカプセル（layers 1）。効果側が clone / 材質差し替えして使う */
  readonly mesh: THREE.Mesh;
  readonly history: PoseHistory;
  /** 'player': update で現在姿勢に置く / 'none': 履歴の記録だけ行う */
  followMode: 'player' | 'none' = 'player';
  /** これ以上の 1 サンプル移動はテレポートとみなし履歴を捨てる（m） */
  teleportThreshold = 6;

  private readonly lastPos = new THREE.Vector3();
  private hasLast = false;

  constructor(historySeconds = 30, historyStep = 0.1) {
    this.history = new PoseHistory(historySeconds, historyStep);
    const geo = new THREE.CapsuleGeometry(PLAYER.radius, PLAYER.height - PLAYER.radius * 2, 4, 8);
    // 原点を足元にする（CapsuleGeometry は中心原点）
    geo.translate(0, PLAYER.height / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0x101014 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'PlayerProxy';
    this.mesh.layers.set(PROXY_LAYER);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = true;
  }

  /** 現在のプレイヤー姿勢 */
  static poseOf(player: PlayerController): ProxyPose {
    return { pos: [player.pos.x, player.pos.y, player.pos.z], yaw: player.yaw, pitch: player.pitch, crouching: player.crouching };
  }

  update(dt: number, player: PlayerController): void {
    // テレポート検知（部屋遷移・リスポーン）→ 過去映像が空間を飛ぶのを防ぐ
    if (this.hasLast && this.lastPos.distanceTo(player.pos) > this.teleportThreshold) this.history.clear();
    this.lastPos.copy(player.pos);
    this.hasLast = true;

    const pose = PlayerProxy.poseOf(player);
    this.history.push(dt, pose);
    if (this.followMode === 'player') this.placeAt(pose);
  }

  /** mesh を任意の姿勢に置く（しゃがみは Y スケールで表現） */
  placeAt(pose: ProxyPose): void {
    this.mesh.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    this.mesh.rotation.set(0, pose.yaw, 0);
    const sy = pose.crouching ? PLAYER.crouchHeight / PLAYER.height : 1;
    this.mesh.scale.set(1, sy, 1);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
