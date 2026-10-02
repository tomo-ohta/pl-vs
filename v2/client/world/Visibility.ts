/**
 * 見える区画の判定（cell and portal。v2-plan.md 6.2）。
 * カメラのいる区画から、開口（PortalSpec）をたどって見える区画を集める。開口がカメラの視野（視錐台）に入っていなければ、
 * その先はたどらない。閉じた扉・まだ消えていない隠しの壁（concealGroup）の開口もたどらない。
 * 視錐台を開口の形に狭める処理はしない（開口の箱が視野に入るかだけ）。その分、少し多めに描くが、判定は軽い。
 *
 * 果てしない階（docs/endless-world.md 5.3）: 区域ごとに区画と開口を足し・外す（addGroup / removeGroup）。
 * 区域をまたぐ境目の扉の開口は setExtra で渡す。まだ作り終えていない区画（描けない区画）は ready で外す
 */
import * as THREE from 'three';
import type { Sim } from '../../core/sim/sim.ts';
import type { CellLayout, FloorLayout, PortalSpec } from '../../core/world/layout.ts';
import { cellAt, type BuiltFloor } from './FloorBuilder.ts';

export class Visibility {
  private readonly frustum = new THREE.Frustum();
  private readonly m = new THREE.Matrix4();
  private readonly box = new THREE.Box3();
  private readonly byCell = new Map<string, PortalSpec[]>();
  /** 開口を塞いでいる隠しの壁の組（現れたら通れる） */
  private readonly concealed = new Map<string, string>();
  /** 組（区域）ごとの開口 */
  private readonly groups = new Map<string, PortalSpec[]>();
  private extra: PortalSpec[] = [];
  readonly visible = new Set<string>();
  /** たどる深さの上限 */
  maxDepth = 12;
  /** 描ける区画か（無ければ全部描ける） */
  ready: ((cellId: string) => boolean) | null = null;

  constructor(floor?: FloorLayout) {
    if (floor) this.addGroup('', floor.cells, floor.portals);
  }

  /** 区画と開口の組を足す（区域） */
  addGroup(id: string, cells: readonly CellLayout[], portals: readonly PortalSpec[]): void {
    this.removeGroup(id);
    this.groups.set(id, [...portals]);
    const byId = new Map(cells.map((c) => [c.id, c]));
    for (const p of portals) {
      this.link(p);
      // 開口の中に隠しの壁（concealGroup の箱）があれば、その組が現れるまで塞がっている
      for (const cid of p.cells) {
        const cell = byId.get(cid);
        if (!cell) continue;
        for (const b of cell.boxes) {
          if (!b.concealGroup) continue;
          const a = p.aabb;
          if (b.min[0] < a.max[0] && b.max[0] > a.min[0] && b.min[1] < a.max[1] && b.max[1] > a.min[1] && b.min[2] < a.max[2] && b.max[2] > a.min[2]) this.concealed.set(p.id, b.concealGroup);
        }
      }
    }
  }

  removeGroup(id: string): void {
    const old = this.groups.get(id);
    if (!old) return;
    for (const p of old) { this.unlink(p); this.concealed.delete(p.id); }
    this.groups.delete(id);
  }

  /** 区域をまたぐ開口（境目の扉）を差し替える */
  setExtra(portals: readonly PortalSpec[]): void {
    for (const p of this.extra) this.unlink(p);
    this.extra = [...portals];
    for (const p of this.extra) this.link(p);
  }

  private link(p: PortalSpec): void {
    for (const c of p.cells) {
      const l = this.byCell.get(c) ?? [];
      l.push(p);
      this.byCell.set(c, l);
    }
  }

  private unlink(p: PortalSpec): void {
    for (const c of p.cells) {
      const l = this.byCell.get(c);
      if (!l) continue;
      const i = l.indexOf(p);
      if (i >= 0) l.splice(i, 1);
      if (!l.length) this.byCell.delete(c);
    }
  }

  update(built: BuiltFloor, sim: Sim, camera: THREE.Camera): ReadonlySet<string> {
    camera.updateMatrixWorld();
    this.compute(built, sim, camera, this.visible);
    for (const [id, c] of built.cells) c.group.visible = this.visible.has(id) && (!this.ready || this.ready(id));
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
      // 区画の外（落下中など）: 近くの区画を全部（果てしない階では遠くの区域まで全部は描かない）
      for (const [id, c] of built.cells) {
        const b = c.bounds;
        const d = Math.hypot(Math.max(b.min[0] - pos.x, 0, pos.x - b.max[0]), Math.max(b.min[2] - pos.z, 0, pos.z - b.max[2]));
        if (d < 40) out.add(id);
      }
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
