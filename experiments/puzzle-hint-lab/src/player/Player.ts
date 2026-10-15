/**
 * 一人称の移動: 歩く・走る・見回す・壁との当たり判定（円と箱）。高低差は無い
 */
import type { Aabb } from '../world/WorldView.ts';
import type { Input } from './Input.ts';

export const EYE_H = 1.6;
const RADIUS = 0.28;
const WALK = 3.1;
const RUN = 5.4;

export interface Walls {
  nearBoxes(x: number, z: number, r: number, out?: Aabb[]): Aabb[];
}

export class Player {
  x = 0;
  z = 0;
  /** 水平の向き（0 = 北 = -z。右回りに +） */
  yaw = 0;
  pitch = 0;
  vx = 0;
  vz = 0;
  /** マウスの感度（1 = 既定） */
  sensitivity = 1;
  /** 歩いた距離（揺れの位相） */
  stride = 0;
  private readonly near: Aabb[] = [];

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  update(dt: number, input: Input, walls: Walls, canMove: boolean): void {
    if (canMove) {
      const k = 0.0021 * this.sensitivity;
      this.yaw += input.lookDX * k;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - input.lookDY * k));
    }
    let fx = 0;
    let fz = 0;
    if (canMove) {
      if (input.down('KeyW', 'ArrowUp')) fz += 1;
      if (input.down('KeyS', 'ArrowDown')) fz -= 1;
      if (input.down('KeyD', 'ArrowRight')) fx += 1;
      if (input.down('KeyA', 'ArrowLeft')) fx -= 1;
    }
    const len = Math.hypot(fx, fz);
    const speed = input.down('ShiftLeft', 'ShiftRight') ? RUN : WALK;
    // 前 = (sin yaw, -cos yaw)、右 = (cos yaw, sin yaw)
    let tx = 0;
    let tz = 0;
    if (len > 0) {
      const s = Math.sin(this.yaw);
      const c = Math.cos(this.yaw);
      tx = ((fz * s + fx * c) / len) * speed;
      tz = ((-fz * c + fx * s) / len) * speed;
    }
    const a = 1 - Math.exp(-dt * (len > 0 ? 12 : 9));
    this.vx += (tx - this.vx) * a;
    this.vz += (tz - this.vz) * a;
    // 細かく分けて動かし、壁から押し出す
    const steps = Math.max(1, Math.ceil((this.speed * dt) / 0.12));
    for (let i = 0; i < steps; i++) {
      this.x += (this.vx * dt) / steps;
      this.z += (this.vz * dt) / steps;
      this.collide(walls);
    }
    this.stride += this.speed * dt;
  }

  private collide(walls: Walls): void {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of walls.nearBoxes(this.x, this.z, RADIUS + 0.2, this.near)) {
        const cx = Math.max(b.x0, Math.min(this.x, b.x1));
        const cz = Math.max(b.z0, Math.min(this.z, b.z1));
        const dx = this.x - cx;
        const dz = this.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          this.x += (dx / d) * (RADIUS - d);
          this.z += (dz / d) * (RADIUS - d);
        } else {
          // 箱の中に入った: 一番近い辺から出す
          const out = [this.x - b.x0, b.x1 - this.x, this.z - b.z0, b.z1 - this.z];
          const m = Math.min(...out);
          if (m === out[0]) this.x = b.x0 - RADIUS;
          else if (m === out[1]) this.x = b.x1 + RADIUS;
          else if (m === out[2]) this.z = b.z0 - RADIUS;
          else this.z = b.z1 + RADIUS;
        }
        moved = true;
      }
      if (!moved) break;
    }
  }
}
