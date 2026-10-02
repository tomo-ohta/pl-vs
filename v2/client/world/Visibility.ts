/**
 * 見える区画の判定（cell and portal。v2-plan.md 6.2）。
 * カメラのいる区画から、開口（PortalSpec）をたどって見える区画を集める。開口がカメラの視野（視錐台）に入っていなければ、
 * その先はたどらない。閉じた扉・まだ消えていない隠しの壁（concealGroup）の開口もたどらない。
 * 視錐台を開口の形に狭める処理はしない（開口の箱が視野に入るかだけ）。その分、少し多めに描くが、判定は軽い。
 */
import * as THREE from 'three';
import type { Sim } from '../../core/sim/sim.ts';
import type { FloorLayout, PortalSpec } from '../../core/world/layout.ts';
import { cellAt, type BuiltFloor } from './FloorBuilder.ts';

export class Visibility {
  private readonly frustum = new THREE.Frustum();
  private readonly m = new THREE.Matrix4();
  private readonly box = new THREE.Box3();
  private readonly byCell = new Map<string, PortalSpec[]>();
  /** 開口を塞いでいる隠しの壁の組（現れたら通れる） */
  private readonly concealed = new Map<string, string>();
  readonly visible = new Set<string>();
  /** たどる深さの上限 */
  maxDepth = 12;

  constructor(floor: FloorLayout) {
    for (const p of floor.portals) {
      for (const c of p.cells) {
        const l = this.byCell.get(c) ?? [];
        l.push(p);
        this.byCell.set(c, l);
      }
      // 開口の中に隠しの壁（concealGroup の箱）があれば、その組が現れるまで塞がっている
      for (const cell of floor.cells) {
        if (!p.cells.includes(cell.id)) continue;
        for (const b of cell.boxes) {
          if (!b.concealGroup) continue;
          const a = p.aabb;
          if (b.min[0] < a.max[0] && b.max[0] > a.min[0] && b.min[1] < a.max[1] && b.max[1] > a.min[1] && b.min[2] < a.max[2] && b.max[2] > a.min[2]) this.concealed.set(p.id, b.concealGroup);
        }
      }
    }
  }

  update(built: BuiltFloor, sim: Sim, camera: THREE.Camera): ReadonlySet<string> {
    camera.updateMatrixWorld();
    this.compute(built, sim, camera, this.visible);
    for (const [id, c] of built.cells) c.group.visible = this.visible.has(id);
    return this.visible;
  }

  /**
   * カメラから見える区画を集める（描画の入れ物には写さない）。窓・枠の向こうを描く仮のカメラ（client/world/Portals.ts）にも使う。
   * カメラの matrixWorld・matrixWorldInverse はできていること
   */
  compute(built: BuiltFloor, sim: Sim, camera: THREE.Camera, out = new Set<string>()): Set<string> {
    this.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m);
    const pos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const start = cellAt(built, [pos.x, pos.y - 1.5, pos.z]) ?? cellAt(built, [pos.x, pos.y, pos.z]);
    out.clear();
    if (!start) {
      // 区画の外（落下中など）: 全部
      for (const id of built.cells.keys()) out.add(id);
    } else {
      out.add(start.id);
      const q: [string, number][] = [[start.id, 0]];
      for (let h = 0; h < q.length; h++) {
        const [id, d] = q[h]!;
        if (d >= this.maxDepth) continue;
        for (const p of this.byCell.get(id) ?? []) {
          const other = p.cells[0] === id ? p.cells[1] : p.cells[0];
          if (out.has(other)) continue;
          if (p.doorId && sim.outputOf(p.doorId, 'angle') < 0.02) continue;
          const g = this.concealed.get(p.id);
          if (g && !sim.isRevealed(g)) continue;
          // 開口が視野に入るか（すぐ近くの開口は向きによらず通す: 振り向いた瞬間に隣が消えないように）
          const a = p.aabb;
          this.box.min.set(a.min[0] - 0.05, a.min[1] - 0.05, a.min[2] - 0.05);
          this.box.max.set(a.max[0] + 0.05, a.max[1] + 0.05, a.max[2] + 0.05);
          const near = this.box.distanceToPoint(pos) < 1.5;
          if (!near && !this.frustum.intersectsBox(this.box)) continue;
          out.add(other);
          q.push([other, d + 1]);
        }
      }
    }
    return out;
  }
}
