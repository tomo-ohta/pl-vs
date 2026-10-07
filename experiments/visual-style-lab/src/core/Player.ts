import * as THREE from 'three';
import type { Colliders } from './Colliders.ts';
import type { Input } from './Input.ts';

const STAND_H = 1.72;
const CROUCH_H = 1.12;
const EYE_BELOW_TOP = 0.12;
const RADIUS = 0.26;
const STEP = 0.36;
const GRAVITY = 18;
const JUMP_V = 5.2;

/**
 * 一人称の歩行。WASD / 矢印で移動、マウスで視点、Shift で走る、C か Ctrl でしゃがむ、Space でジャンプ。
 * F で飛行（当たり判定なし。見た目合わせ用）。
 */
export class Player {
  /** 足元の位置 */
  readonly pos = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  roll = 0;
  vy = 0;
  onGround = false;
  fly = false;
  height = STAND_H;
  walkSpeed = 1.55;
  runSpeed = 3.6;
  sensitivity = 0.0022;
  /** 歩くときの頭の揺れ（0 で無し） */
  bob = 0.6;
  private bobPhase = 0;
  private bobAmp = 0;
  private readonly vel = new THREE.Vector3();
  private spawn = { pos: new THREE.Vector3(), yaw: 0, pitch: 0 };

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** 目の高さ（足元からの高さ） */
  get eyeHeight(): number {
    return this.height - EYE_BELOW_TOP;
  }

  setSpawn(pos: THREE.Vector3Like, yaw: number, pitch = 0): void {
    this.spawn = { pos: new THREE.Vector3(pos.x, pos.y, pos.z), yaw, pitch };
    this.respawn();
  }

  respawn(): void {
    this.pos.copy(this.spawn.pos);
    this.yaw = this.spawn.yaw;
    this.pitch = this.spawn.pitch;
    this.roll = 0;
    this.vy = 0;
    this.vel.set(0, 0, 0);
  }

  /** 目の位置と向きを直接置く（参考画像の視点へ移るとき） */
  placeEye(eye: THREE.Vector3Like, yaw: number, pitch: number, roll = 0, colliders?: Colliders): void {
    this.height = STAND_H;
    this.pos.set(eye.x, eye.y - this.eyeHeight, eye.z);
    // 目の高さがしゃがみ以下なら、しゃがんでいることにする
    if (colliders) {
      const g = colliders.groundBelow(eye.x, eye.z, RADIUS, eye.y - 0.3);
      if (Number.isFinite(g.y)) {
        const h = eye.y - g.y + EYE_BELOW_TOP;
        this.height = THREE.MathUtils.clamp(h, 0.5, 2.6);
        this.pos.y = g.y;
      }
    }
    this.yaw = yaw;
    this.pitch = pitch;
    this.roll = roll;
    this.vy = 0;
    this.vel.set(0, 0, 0);
    this.bobAmp = 0;
  }

  /** カメラ効果の手持ち感が表示カメラを動かすときは、歩行の頭の揺れを止める */
  externalCamera = false;

  update(dt: number, input: Input, colliders: Colliders): void {
    dt = Math.min(dt, 0.05);
    if (input.hit('KeyF')) this.fly = !this.fly;

    this.yaw -= input.lookDX * this.sensitivity;
    this.pitch -= input.lookDY * this.sensitivity;
    if (input.down('KeyQ')) this.yaw += dt * 1.6;
    if (input.down('KeyE')) this.yaw -= dt * 1.6;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.5, 1.5);
    if (input.lookDX !== 0 || input.lookDY !== 0) this.roll = 0;

    const fwd = THREE.MathUtils.clamp((input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0) + input.moveY, -1, 1);
    const side = THREE.MathUtils.clamp((input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0) + input.moveX, -1, 1);
    const run = input.down('ShiftLeft', 'ShiftRight');
    const crouch = input.down('KeyC', 'ControlLeft', 'ControlRight');

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // yaw = 0 で -Z を向く（three のカメラと同じ）
    const wish = new THREE.Vector3(-sin * fwd + cos * side, 0, -cos * fwd - sin * side);
    if (wish.lengthSq() > 1) wish.normalize();

    if (this.fly) {
      const sp = (run ? 8 : 3) * dt;
      const up = (input.down('Space') ? 1 : 0) - (crouch ? 1 : 0);
      const cp = Math.cos(this.pitch);
      const look = new THREE.Vector3(-sin * cp, Math.sin(this.pitch), -cos * cp);
      this.pos.addScaledVector(look, fwd * sp);
      this.pos.x += cos * side * sp;
      this.pos.z += -sin * side * sp;
      this.pos.y += up * sp;
      this.vy = 0;
      this.applyCamera(0);
      return;
    }

    // しゃがみ（天井が低ければ立てない）
    const ceil = colliders.ceilingAbove(this.pos.x, this.pos.z, RADIUS, this.pos.y + CROUCH_H - 0.05);
    const targetH = crouch || ceil < this.pos.y + STAND_H ? CROUCH_H : STAND_H;
    this.height += (targetH - this.height) * Math.min(1, dt * 10);

    const ground = colliders.groundBelow(this.pos.x, this.pos.z, RADIUS, this.pos.y + STEP);
    const slow = ground.slow;
    const speed = (crouch ? this.walkSpeed * 0.55 : run ? this.runSpeed : this.walkSpeed) * slow;
    const accel = this.onGround ? 14 : 3;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);

    if (this.onGround && input.hit('Space')) {
      this.vy = JUMP_V;
      this.onGround = false;
    }

    // 水平移動（細かく分けて壁をすり抜けない）
    const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.1));
    for (let i = 0; i < steps; i++) {
      this.pos.x += (this.vel.x * dt) / steps;
      this.pos.z += (this.vel.z * dt) / steps;
      colliders.pushOut(this.pos, RADIUS, this.pos.y + STEP, this.pos.y + this.height);
    }

    // 縦移動
    this.vy -= GRAVITY * dt;
    let ny = this.pos.y + this.vy * dt;
    const g = colliders.groundBelow(this.pos.x, this.pos.z, RADIUS, this.pos.y + STEP);
    if (ny <= g.y) {
      // 段差は少しずつ上がる
      ny = this.onGround && g.y > this.pos.y ? Math.min(g.y, this.pos.y + dt * 4) : g.y;
      if (g.y - ny < 0.002) ny = g.y;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = ny - g.y < 0.02;
    }
    const top = colliders.ceilingAbove(this.pos.x, this.pos.z, RADIUS, this.pos.y + this.height - 0.02);
    if (this.vy > 0 && ny + this.height > top) {
      ny = top - this.height;
      this.vy = 0;
    }
    this.pos.y = ny;
    if (this.pos.y < -30) this.respawn();

    const moving = Math.hypot(this.vel.x, this.vel.z);
    this.bobAmp += ((this.onGround ? Math.min(1, moving / 2) : 0) - this.bobAmp) * Math.min(1, dt * 6);
    this.bobPhase += dt * (5.2 + moving * 1.4);
    this.applyCamera(this.externalCamera ? 0 : this.bob * this.bobAmp);
  }

  applyCamera(bob = 0): void {
    const c = this.camera;
    c.position.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
    if (bob > 0) {
      c.position.y += Math.sin(this.bobPhase * 2) * 0.022 * bob;
      const s = Math.cos(this.bobPhase) * 0.018 * bob;
      c.position.x += Math.cos(this.yaw) * s;
      c.position.z -= Math.sin(this.yaw) * s;
    }
    c.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    c.updateMatrixWorld();
  }
}
