/**
 * Rapier の世界を部品から使う薄い包み（v2-plan.md 6.1）。
 * - 剛体は番号（handle）で扱う。部品の状態には番号だけを入れる（JSON にできる）
 * - プレイヤーはキネマティックな箱として毎 tick 位置を合わせる → 物を押しのける（プレイヤー自身は物に止められない）
 * - 静的な箱は、剛体を使う区画の床・壁だけ入れる（フロア全体を入れると重い）
 * Rapier は loadRapier() で読み込んでから渡す（core/physics/rapier.ts）。
 */
import type { AABB } from '../math/aabb.ts';
import type { Quat } from '../math/quat.ts';
import type { Vec3 } from '../math/vec.ts';
import type { Rapier } from './rapier.ts';

type World = InstanceType<Rapier['World']>;
type Body = ReturnType<World['createRigidBody']>;

export interface BodyOptions {
  density?: number;
  friction?: number;
  restitution?: number;
  /** 初期の向き（四元数 x, y, z, w） */
  rotation?: Quat;
  /** 線形・角速度の減衰 */
  linearDamping?: number;
  angularDamping?: number;
  /** 球にする（半径 = half[0]） */
  ball?: boolean;
}

export class PhysicsWorld {
  readonly R: Rapier;
  readonly world: World;
  private player: Body | null = null;
  private readonly bodies = new Map<number, Body>();

  constructor(R: Rapier, dt: number) {
    this.R = R;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = dt;
  }

  /** 動かない箱（床・壁） */
  addStaticBox(b: AABB, friction = 0.6): void {
    const R = this.R;
    const hx = (b.max[0] - b.min[0]) / 2, hy = (b.max[1] - b.min[1]) / 2, hz = (b.max[2] - b.min[2]) / 2;
    if (hx <= 1e-4 || hy <= 1e-4 || hz <= 1e-4) return;
    const body = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(b.min[0] + hx, b.min[1] + hy, b.min[2] + hz));
    this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setFriction(friction), body);
  }

  /** 転がる物（中心と半分の寸法） */
  addDynamicBox(center: Vec3, half: Vec3, o: BodyOptions = {}): number {
    const R = this.R;
    const desc = R.RigidBodyDesc.dynamic().setTranslation(center[0], center[1], center[2]);
    if (o.rotation) desc.setRotation({ x: o.rotation[0], y: o.rotation[1], z: o.rotation[2], w: o.rotation[3] });
    if (o.linearDamping !== undefined) desc.setLinearDamping(o.linearDamping);
    if (o.angularDamping !== undefined) desc.setAngularDamping(o.angularDamping);
    const body = this.world.createRigidBody(desc);
    const shape = o.ball ? R.ColliderDesc.ball(half[0]) : R.ColliderDesc.cuboid(half[0], half[1], half[2]);
    shape.setDensity(o.density ?? 300).setFriction(o.friction ?? 0.6).setRestitution(o.restitution ?? 0.05);
    this.world.createCollider(shape, body);
    this.bodies.set(body.handle, body);
    return body.handle;
  }

  /** 部品が動かす箱（傾く床・動く床） */
  addKinematicBox(center: Vec3, half: Vec3, friction = 0.8): number {
    const R = this.R;
    const body = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(center[0], center[1], center[2]));
    this.world.createCollider(R.ColliderDesc.cuboid(half[0], half[1], half[2]).setFriction(friction), body);
    this.bodies.set(body.handle, body);
    return body.handle;
  }

  setKinematicPose(handle: number, pos: Vec3, rot: Quat): void {
    const b = this.bodies.get(handle);
    if (!b) return;
    b.setNextKinematicTranslation({ x: pos[0], y: pos[1], z: pos[2] });
    b.setNextKinematicRotation({ x: rot[0], y: rot[1], z: rot[2], w: rot[3] });
  }

  /** 剛体の位置と向き */
  pose(handle: number): { pos: Vec3; rot: Quat } | null {
    const b = this.bodies.get(handle);
    if (!b) return null;
    const t = b.translation();
    const r = b.rotation();
    return { pos: [t.x, t.y, t.z], rot: [r.x, r.y, r.z, r.w] };
  }

  /** 剛体を押す（衝撃） */
  impulse(handle: number, v: Vec3): void {
    this.bodies.get(handle)?.applyImpulse({ x: v[0], y: v[1], z: v[2] }, true);
  }

  isSleeping(handle: number): boolean {
    return this.bodies.get(handle)?.isSleeping() ?? true;
  }

  /** プレイヤーの箱（キネマティック）を合わせる */
  setPlayer(feet: Vec3, radius: number, height: number): void {
    const R = this.R;
    if (!this.player) {
      this.player = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(feet[0], feet[1] + height / 2, feet[2]));
      this.world.createCollider(R.ColliderDesc.cuboid(radius, height / 2, radius).setFriction(0.2), this.player);
    }
    this.player.setNextKinematicTranslation({ x: feet[0], y: feet[1] + height / 2, z: feet[2] });
  }

  step(): void {
    this.world.step();
  }

  /** 状態の保存（バイト列）。復元は PhysicsWorld.restore */
  snapshot(): Uint8Array {
    return this.world.takeSnapshot();
  }

  dispose(): void {
    this.world.free();
    this.bodies.clear();
    this.player = null;
  }
}
