import * as THREE from 'three';
import type { Box } from '../../core/Colliders.ts';
import { Prop } from '../../props/kit.ts';
import { Builder } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { DoorDef } from './layout.ts';
import { PAL, type VcMats } from './mats.ts';

/**
 * 扉（近づくと開く開き戸・両開き・鍵の掛かった扉・エレベーターの扉・シャッター）。
 * 撮影（参考画像の視点・道順）では update が呼ばれないので、扉は閉じたまま写る（参考画像の突き当たりの閉じた扉）。
 * 当たり判定: 閉じた板の箱は「近づけば開く」扉では通れる物（passable）にして、歩いている間だけ開き具合で切り替える。
 */

interface Leaf {
  pivot: THREE.Group;
  /** 開いたときの回転（Y 軸） */
  open: number;
}

class Door {
  readonly leaves: Leaf[] = [];
  t = 0;
  box: Box | null = null;
  constructor(
    readonly def: DoorDef,
    readonly center: THREE.Vector3,
  ) {}
  apply(): void {
    const k = this.t * this.t * (3 - 2 * this.t);
    for (const l of this.leaves) l.pivot.rotation.y = l.open * k;
  }
}

/**
 * 扉の板の見た目（部屋ごとの違い）: plain = 無地とレバー、glass = 大きなガラスの窓、bar = 横の銘板（この 3 つは参考画像の突き当たりの扉）、
 * service = 写っていない扉（網入りのガラスの縦長の窓・両面の蹴板・押し板・上のドアクローザー・丁番・札）
 */
export type LeafStyle = 'plain' | 'glass' | 'bar' | 'service';

export class Doors {
  readonly root = new THREE.Group();
  private readonly list: Door[] = [];
  constructor(
    readonly ctx: SceneContext,
    readonly vc: VcMats,
  ) {
    this.root.name = 'doors';
  }

  add(def: DoorDef, style: LeafStyle = 'plain', color: string = PAL.door): void {
    const w = def.b - def.a;
    const mid = (def.a + def.b) / 2;
    const center = def.wall === 'x' ? new THREE.Vector3(mid, def.y0 + 1, def.line) : new THREE.Vector3(def.line, def.y0 + 1, mid);
    const d = new Door(def, center);
    if (def.kind === 'opening') return;
    // 壁の向きの回転（扉の局所の座標: x が壁に沿う・z が壁の法線）
    const baseYaw = def.wall === 'x' ? 0 : -Math.PI / 2;
    const sw = def.swing ?? 1;
    const leaf = (x0: number, x1: number, hingeAtX0: boolean): void => {
      const pivot = new THREE.Group();
      const hx = hingeAtX0 ? x0 : x1;
      const p0 = def.wall === 'x' ? new THREE.Vector3(def.a + hx, def.y0, def.line) : new THREE.Vector3(def.line, def.y0, def.a + hx);
      const outer = new THREE.Group();
      outer.rotation.y = baseYaw;
      outer.position.copy(p0);
      const b = new Builder(this.ctx);
      const p = new Prop(this.vc.sink(b), this.vc, new THREE.Matrix4(), 7);
      // 板（吊り元を原点に、戸先へ +x か -x）
      const lw = x1 - x0;
      const dir = hingeAtX0 ? 1 : -1;
      const xa = dir > 0 ? 0 : -lw;
      const xb = dir > 0 ? lw : 0;
      const h = def.h;
      if (def.kind === 'lift') {
        p.box('#5f9fb2', [xa + 0.005, 0, -0.03], [xb - 0.005, h, 0.03], { r: 0.004 });
        p.box('#7ab4c4', [xa + 0.03, 0.05, 0.03], [xb - 0.03, h - 0.05, 0.034], { shadow: false });
      } else if (def.kind === 'shutter') {
        // 巻き上げのシャッター: スラット（1 枚 7.5 cm。上の丸い面は明るく、下の継ぎ目は暗い）・座板・両脇のレール・上の巻き取りの箱
        p.box('#6b9aa8', [xa, 0, -0.04], [xb, h, 0.04]);
        for (const s of [1, -1]) {
          for (let y = 0.1; y < h - 0.05; y += 0.075) {
            p.box('#86b2be', [xa + 0.02, y, s > 0 ? 0.04 : -0.046], [xb - 0.02, y + 0.035, s > 0 ? 0.046 : -0.04], { shadow: false });
            p.box('#4c7480', [xa + 0.02, y + 0.06, s > 0 ? 0.04 : -0.044], [xb - 0.02, y + 0.075, s > 0 ? 0.044 : -0.04], { shadow: false });
          }
          p.box('#3e6470', [xa, 0, s > 0 ? 0.04 : -0.06], [xb, 0.1, s > 0 ? 0.06 : -0.04], { shadow: false });
          for (const x of [xa - 0.04, xb - 0.04]) p.box('#4f7884', [x, 0, s > 0 ? 0.0 : -0.09], [x + 0.08, h + 0.05, s > 0 ? 0.09 : 0.0], { shadow: false });
        }
        p.box('#5f8f9c', [xa - 0.08, h, -0.35], [xb + 0.08, h + 0.5, 0.35], { r: 0.02, shadow: false });
        p.box('#4f7884', [xa - 0.06, h + 0.05, 0.35], [xb + 0.06, h + 0.45, 0.36], { shadow: false });
        // 操作の箱（押しボタン 3 つ）
        const cb = dir > 0 ? xb + 0.25 : xa - 0.45;
        p.box('#c8d8dc', [cb, 1.1, -0.2], [cb + 0.2, 1.45, -0.1], { r: 0.01, shadow: false });
        for (const [y, c] of [[1.36, '#3fd29a'], [1.27, '#e0c64e'], [1.18, '#e05a4a']] as [number, string][]) p.cyl(c, [cb + 0.1, y, -0.2], 0.022, 0.02, { axis: 'z', seg: 10, shadow: false });
      } else {
        p.box(color, [xa + 0.004, 0, -0.025], [xb - 0.004, h - 0.004, 0.025], { r: 0.004 });
        const lx = dir > 0 ? xb - 0.08 : xa + 0.08;
        // レバーの取っ手（両面）と座
        for (const s of [1, -1]) {
          p.box(PAL.steel, [lx - 0.025, 0.96, s * 0.025], [lx + 0.025, 1.08, s * 0.03], { shadow: false });
          p.box(PAL.steel, [lx - dir * 0.13, 1.0, s * 0.045 - 0.008], [lx + dir * 0.005, 1.025, s * 0.045 + 0.008], { shadow: false });
          p.box(PAL.steel, [lx - 0.01, 1.0, s * 0.03], [lx + 0.01, 1.025, s * 0.045], { shadow: false });
        }
        // 下の蹴板
        p.box('#3a8098', [xa + 0.03, 0.02, 0.025], [xb - 0.03, 0.22, 0.03], { shadow: false });
        if (style === 'glass') {
          // 大きなガラスの窓（参考画像 serverroom-2 の扉）と白い銘板
          p.box('#2a7686', [xa + 0.12, 0.55, 0.025], [xb - 0.12, h - 0.15, 0.03], { shadow: false });
          p.box(PAL.paper, [xa + 0.22, 1.42, 0.03], [xb - 0.22, 1.52, 0.034], { shadow: false });
        } else if (style === 'bar') {
          p.box('#5aa8bd', [xa + 0.1, 1.55, 0.025], [xb - 0.1, 1.58, 0.03], { shadow: false });
          p.box('#5aa8bd', [xa + 0.1, 0.62, 0.025], [xb - 0.1, 0.65, 0.03], { shadow: false });
        } else if (style === 'service') {
          // 網入りのガラスの縦長の窓（戸先の側。両面の枠・ガラス・網の線）
          const gx0 = dir > 0 ? xb - 0.3 : xa + 0.14;
          const gx1 = gx0 + 0.16;
          const gy0 = 1.05;
          const gy1 = Math.min(h - 0.3, 1.8);
          for (const s of [1, -1]) {
            const zf = s * 0.025;
            const zo = s * 0.031;
            p.box('#8fb8c2', [gx0 - 0.025, gy0 - 0.025, Math.min(zf, zo)], [gx1 + 0.025, gy1 + 0.025, Math.max(zf, zo)], { shadow: false });
            p.box('#1d4a5a', [gx0, gy0, Math.min(zo, s * 0.033)], [gx1, gy1, Math.max(zo, s * 0.033)], { shadow: false });
            p.box('#4f9ab0', [gx0 + 0.02, gy0 + 0.05, Math.min(zo, s * 0.034)], [gx0 + 0.035, gy1 - 0.05, Math.max(zo, s * 0.034)], { shadow: false });
            for (let y = gy0 + 0.05; y < gy1; y += 0.1) p.box('#3a7486', [gx0, y, Math.min(s * 0.033, s * 0.035)], [gx1, y + 0.004, Math.max(s * 0.033, s * 0.035)], { shadow: false });
            for (const x of [gx0 + 0.053, gx0 + 0.107]) p.box('#3a7486', [x, gy0, Math.min(s * 0.033, s * 0.035)], [x + 0.004, gy1, Math.max(s * 0.033, s * 0.035)], { shadow: false });
            // 両面の蹴板（ステンレス）と丁番
            p.box('#8fb8c2', [xa + 0.02, 0.02, Math.min(zf, s * 0.028)], [xb - 0.02, 0.26, Math.max(zf, s * 0.028)], { shadow: false });
            const hx = dir > 0 ? xa : xb;
            for (const y of [0.25, 1.1, h - 0.25]) p.box(PAL.steelDark, [hx - 0.012, y, Math.min(zf, s * 0.03)], [hx + 0.012, y + 0.11, Math.max(zf, s * 0.03)], { shadow: false });
          }
          // 押し板（片面）・室名の札・上のドアクローザー（本体と腕）
          p.box('#a9cfd6', [lx - dir * 0.02 - 0.05, 1.18, 0.025], [lx - dir * 0.02 + 0.05, 1.48, 0.029], { shadow: false });
          const mx = (xa + xb) / 2;
          p.box(PAL.paper, [mx - 0.15, 1.86, 0.025], [mx + 0.15, 1.94, 0.03], { shadow: false });
          const cx0 = dir > 0 ? xa + 0.08 : xb - 0.38;
          const ax = dir > 0 ? cx0 + 0.26 : cx0;
          p.box('#5f8f9c', [cx0, h - 0.16, -0.07], [cx0 + 0.3, h - 0.08, -0.025], { r: 0.01, shadow: false });
          p.box('#4a7a88', [ax, h - 0.1, -0.06], [ax + 0.04, h - 0.004, -0.04], { shadow: false });
        } else {
          p.box('#1a6886', [xa + 0.2, 1.5, 0.025], [xa + 0.38, 1.62, 0.03], { shadow: false });
        }
      }
      b.finalize();
      // 吊り元の位置に置き、壁の向きに回してから、開くときはさらに回す
      const holder = new THREE.Group();
      holder.add(b.root);
      pivot.add(holder);
      outer.add(pivot);
      this.root.add(outer);
      // 吊り元が x0 の板は -θ、x1 の板は +θ で、局所の +z（sw = 1）の側へ開く
      d.leaves.push({ pivot, open: (hingeAtX0 ? -1 : 1) * sw * (Math.PI / 2) * 0.95 });
    };
    if (def.kind === 'double' || def.kind === 'lift') {
      leaf(0, w / 2, true);
      leaf(w / 2, w, false);
    } else {
      leaf(0, w, true);
    }
    // 閉じた板の当たり判定
    const half = 0.06;
    const min = def.wall === 'x' ? { x: def.a, y: def.y0, z: def.line - half } : { x: def.line - half, y: def.y0, z: def.a };
    const max = def.wall === 'x' ? { x: def.b, y: def.y0 + def.h, z: def.line + half } : { x: def.line + half, y: def.y0 + def.h, z: def.b };
    d.box = this.ctx.colliders.add(min, max);
    const auto = def.state === 'auto';
    d.box.enabled = !auto;
    d.box.passable = auto;
    if (def.state === 'locked' || def.kind === 'lift' || def.kind === 'shutter') d.box.passable = false;
    this.list.push(d);
  }

  /** 毎フレーム: 目が近い扉を開ける */
  update(dt: number, eye: THREE.Vector3): void {
    for (const d of this.list) {
      if (d.def.state !== 'auto') continue;
      const near = Math.hypot(eye.x - d.center.x, eye.z - d.center.z) < 1.9 && Math.abs(eye.y - 1.5 - d.def.y0) < 2.0;
      const target = near ? 1 : 0;
      if (d.t !== target) {
        d.t = target > d.t ? Math.min(1, d.t + dt * 2.2) : Math.max(0, d.t - dt * 1.4);
        d.apply();
      }
      if (d.box) d.box.enabled = d.t < 0.05;
    }
  }

  /** 扉の開き具合（0 = 閉じている〜1）。見えない部屋を描かない判定に使う */
  openness(id: string): number {
    return this.list.find((d) => d.def.id === id)?.t ?? 0;
  }

  /** 全部を開ける・閉める（確かめ用） */
  setAll(t: number): void {
    for (const d of this.list) {
      if (d.def.state !== 'auto') continue;
      d.t = t;
      d.apply();
    }
  }
}
