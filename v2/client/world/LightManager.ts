/**
 * 点光源の割り当て。three.js は可視の点光源の数で材質のプログラムを作り直すので、数は Tier の上限で固定し（プール）、
 * カメラに近い照明へ順に割り当てる。割り当てを変えるときは 0 へ落としてから付け替える（v1 の LightBudget と同じ考え方）。
 * 部品で入切する照明（lampId）は、明るさ（0..1）を掛ける。
 */
import * as THREE from 'three';
import type { BuiltFloor, ManagedLight } from './FloorBuilder.ts';

interface Slot {
  light: THREE.PointLight;
  spec: ManagedLight | null;
}

/** 付け替えのヒステリシス: 割り当て中の照明は距離を 0.8 倍で比べる */
const HYSTERESIS = 0.8;
const FADE_RATE = 8;

export class LightManager {
  private readonly slots: Slot[] = [];
  private readonly group = new THREE.Group();

  constructor(scene: THREE.Scene, count: number) {
    this.group.name = 'lightPool';
    scene.add(this.group);
    this.resize(count);
  }

  /** プールの数を変える（Tier の変更） */
  resize(count: number): void {
    while (this.slots.length > count) this.slots.pop()!.light.removeFromParent();
    while (this.slots.length < count) {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      light.position.set(0, -1000, 0);
      this.group.add(light);
      this.slots.push({ light, spec: null });
    }
  }

  /**
   * すぐに割り当て直す（なめらかに替えない）。果てしない階の階段室で階を移ったとき: 同じ形の階段室の照明へ、同じ明るさのまま付け替える
   * （0 から上げ直すと、移った瞬間に暗くなる）
   */
  snap(built: BuiltFloor, cam: THREE.Vector3, levelOf: (lampId: string) => number, visibleCells: ReadonlySet<string> | null): void {
    for (const s of this.slots) { s.spec = null; s.light.intensity = 0; s.light.position.set(0, -1000, 0); }
    this.update(built, cam, levelOf, visibleCells, 0, true);
  }

  update(built: BuiltFloor, cam: THREE.Vector3, levelOf: (lampId: string) => number, visibleCells: ReadonlySet<string> | null, dt: number, instant = false): void {
    const assigned = new Set(this.slots.map((s) => s.spec).filter((s): s is ManagedLight => !!s));
    const scored: { l: ManagedLight; d: number }[] = [];
    for (const l of built.lights) {
      if (visibleCells && !visibleCells.has(l.cell)) continue;
      if (l.spec.lampId && levelOf(l.spec.lampId) <= 0.001) continue;
      const p = l.spec.pos;
      const d = Math.hypot(p[0] - cam.x, p[1] - cam.y, p[2] - cam.z) * (assigned.has(l) ? HYSTERESIS : 1);
      if (d > l.spec.distance * 1.5 + 12) continue;
      scored.push({ l, d });
    }
    scored.sort((a, b) => a.d - b.d);
    const desired = new Set(scored.slice(0, this.slots.length).map((e) => e.l));
    const k = instant ? 1 : 1 - Math.exp(-FADE_RATE * Math.min(0.1, dt));
    // 外れた照明は 0 へ。0 になったら空きにする
    for (const s of this.slots) {
      if (s.spec && !desired.has(s.spec)) {
        s.light.intensity += (0 - s.light.intensity) * k;
        if (s.light.intensity < 0.01) { s.spec = null; s.light.intensity = 0; s.light.position.set(0, -1000, 0); }
      }
    }
    // 新しく入る照明を空きに付ける
    for (const l of desired) {
      if (this.slots.some((s) => s.spec === l)) continue;
      const free = this.slots.find((s) => !s.spec);
      if (!free) break;
      free.spec = l;
      free.light.position.set(l.spec.pos[0], l.spec.pos[1], l.spec.pos[2]);
      free.light.color.setHex(l.spec.color);
      free.light.distance = l.spec.distance;
      free.light.intensity = 0;
    }
    // 明るさを目標へ
    for (const s of this.slots) {
      if (!s.spec || !desired.has(s.spec)) continue;
      const target = s.spec.base * (s.spec.spec.lampId ? levelOf(s.spec.spec.lampId) : 1);
      s.light.intensity += (target - s.light.intensity) * k;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.slots.length = 0;
  }
}
