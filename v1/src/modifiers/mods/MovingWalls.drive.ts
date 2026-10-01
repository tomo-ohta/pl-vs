/**
 * MovingWalls / DynamicLength 共用の補助: RoomBuilder が構築した可動要素（layout.dynamics）の「駆動」を build フックで引き取る。
 *
 * 背景: RoomBuilder.buildDynamics は位置を時間の純関数で更新し、プレイヤーとの重なりを見ない。静止中のプレイヤーにソリッドの
 * 可動要素が食い込むと、PlayerController.moveAxis(1)（重力）が押し出し先を箱の上面に取るため、プレイヤーが箱の上 → 天井の上へ
 * 弾き出される。ここでは RoomBuilder の Mesh を非表示・コライダを非ソリッドにし、同じ geometry / material を共有するクローン
 * Mesh と自前のソリッドコライダを BuiltRoom に登録して、「次の位置がプレイヤー AABB と重なるなら止まる」規則で動かす
 * （挟み込み防止。押す・運ぶはしない）。ジオメトリは増やさない（RoomBuilder が作った BufferGeometry を共有する）。
 *
 * 波形は RoomBuilder.buildDynamics と同じ（slide: 三角波 0..amplitude / oscillate: 正弦波 0..amplitude、軸の正方向へ）。
 * 位相は build 時刻起点の実時間で、セーブしない。
 */
import * as THREE from 'three';
import { aabbToWorld, type AABB } from '../../core/aabb';
import type { Placement, Vec3 } from '../../core/types';
import type { DynamicSpec } from '../../generators/layout';
import type { BuiltRoom, DynamicCollider } from '../../render/RoomBuilder';

/** プレイヤー AABB の寸法（PlayerController.PLAYER と同じ値。import すると player/ に依存するので定数で持つ） */
const PLAYER_RADIUS = 0.35;
const PLAYER_HEIGHT = 1.7;
const PLAYER_CROUCH_HEIGHT = 0.85;
/** 停止判定の余白（m）。次フレームの移動量 + 押し出し誤差より大きく取る */
const STOP_MARGIN = 0.15;

export interface DrivenBlock {
  id: string;
  spec: DynamicSpec;
  /** 表示用クローン（RoomBuilder の Mesh と geometry / material を共有） */
  mesh: THREE.Mesh;
  /** built.dynamicColliders に登録した自前コライダ（solid は spec.solid && visible） */
  collider: DynamicCollider;
  /** 位相 0 の箱中心（ローカル） */
  center: Vec3;
  /** 正規化済みの移動軸（ローカル） */
  axis: Vec3;
  /** 現在の移動量（m） */
  offset: number;
  /** 時間駆動用の経過秒（停止中は進まない） */
  time: number;
  visible: boolean;
}

/** RoomBuilder が構築した可動要素のうち match(id) のものを引き取る。placement は node.placement */
export function takeOverDynamics(built: BuiltRoom, placement: Placement, match: (id: string) => boolean, namePrefix: string): DrivenBlock[] {
  const out: DrivenBlock[] = [];
  // 既に引き取ったもの（同じ部屋を再構築しても build は 1 回だが、念のため二重登録を避ける）
  const taken = new Set(built.dynamicColliders.filter((d) => d.mesh.name.startsWith(`${namePrefix}/`)).map((d) => d.id));
  for (const d of [...built.dynamicColliders]) {
    if (!match(d.id) || taken.has(d.id) || d.mesh.name.startsWith(`${namePrefix}/`)) continue;
    // RoomBuilder 側は見えない・当たらないようにする（時間駆動の更新は続くが害はない）
    d.solid = false;
    d.mesh.visible = false;
    const b = d.spec.box;
    const center: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const a = new THREE.Vector3(d.spec.motion.axis[0], d.spec.motion.axis[1], d.spec.motion.axis[2]);
    if (a.lengthSq() < 1e-8) a.set(1, 0, 0);
    a.normalize();
    const mesh = new THREE.Mesh(d.mesh.geometry, d.mesh.material);
    mesh.name = `${namePrefix}/${d.id}`;
    mesh.position.set(center[0], center[1], center[2]);
    built.group.add(mesh);
    const collider: DynamicCollider = { id: d.id, spec: d.spec, mesh, aabb: aabbToWorld(b, placement), solid: d.spec.solid };
    built.dynamicColliders.push(collider);
    out.push({ id: d.id, spec: d.spec, mesh, collider, center, axis: [a.x, a.y, a.z], offset: 0, time: 0, visible: true });
  }
  return out;
}

/** RoomBuilder と同じ波形。time 秒後の移動量（0..amplitude） */
export function offsetAt(spec: DynamicSpec, time: number): number {
  const m = spec.motion;
  const phase = time / Math.max(0.01, m.period) + m.phase;
  const w = m.kind === 'slide' ? 1 - 2 * Math.abs(((phase % 1) + 1) % 1 - 0.5) : (Math.sin(phase * Math.PI * 2) + 1) / 2;
  return m.amplitude * w;
}

/** 移動量 offset のときの箱（ローカル AABB） */
export function localAabbAt(block: DrivenBlock, offset: number): AABB {
  const b = block.spec.box;
  const [ax, ay, az] = block.axis;
  return {
    min: [b.min[0] + ax * offset, b.min[1] + ay * offset, b.min[2] + az * offset],
    max: [b.max[0] + ax * offset, b.max[1] + ay * offset, b.max[2] + az * offset],
  };
}

/** Mesh の位置とコライダを offset に合わせる */
export function setOffset(block: DrivenBlock, offset: number, placement: Placement): void {
  block.offset = offset;
  const c = block.center;
  const [ax, ay, az] = block.axis;
  block.mesh.position.set(c[0] + ax * offset, c[1] + ay * offset, c[2] + az * offset);
  block.collider.aabb = aabbToWorld(localAabbAt(block, offset), placement);
}

/** 表示と当たりを同時に切る（非表示のときは当たらない） */
export function setVisible(block: DrivenBlock, visible: boolean): void {
  block.visible = visible;
  block.mesh.visible = visible;
  block.collider.solid = visible && block.spec.solid;
}

/** プレイヤーの AABB（ワールド。足元 pos、余白 margin） */
export function playerAabb(pos: Vec3, crouching: boolean, margin = STOP_MARGIN): AABB {
  const h = crouching ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;
  const r = PLAYER_RADIUS + margin;
  return { min: [pos[0] - r, pos[1] - margin, pos[2] - r], max: [pos[0] + r, pos[1] + h + margin, pos[2] + r] };
}

export function aabbsOverlap(a: AABB, b: AABB): boolean {
  return a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2];
}

/**
 * 時間駆動（MovingWalls）。各ブロックの次の位置がプレイヤー AABB と重なるならそのブロックの時間を進めない（停止）。
 * dt は 0.05 s 以下（Game.step のクランプ）。
 */
export function advanceTimed(blocks: DrivenBlock[], dt: number, placement: Placement, player: { pos: Vec3; crouching: boolean }): void {
  const pa = playerAabb(player.pos, player.crouching);
  for (const b of blocks) {
    if (!b.visible) continue;
    const next = offsetAt(b.spec, b.time + dt);
    if (b.spec.solid && aabbsOverlap(aabbToWorld(localAabbAt(b, next), placement), pa)) continue; // 挟み込み防止: 止まって待つ
    b.time += dt;
    setOffset(b, next, placement);
  }
}
