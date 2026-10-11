import * as THREE from 'three';
import type { Builder } from '../../../scenes/Builder.ts';
import type { SceneContext } from '../../../scenes/types.ts';
import { builderSink, Prop } from '../../../props/kit.ts';
import { CAM_A } from '../hallA.ts';
import { CAM_B } from '../hallB.ts';
import { CAM_C } from '../hallC.ts';
import { CAM_D } from '../hallD.ts';
import { HALL, LOCKER, PROM, SHOWER, SOUTH_OPEN, UPPER, UPPER_Y, type HallId } from '../layout.ts';
import { offsetOut, type PoolBuilt } from '../pools.ts';
import type { ShiftCam } from '../cam.ts';
import { floatRack, kickboardPile, lockerBank, loungerStack, poolShower, rescueBoard, ringBuoyPost, showerStall, signPost, slideBoard, slideGate, vanity, wallClock, wpBench, wpBin, wpExtinguisherBox, wpLadder, wpLifeguard, wpPlant, wpVending } from './items.ts';
import { WC, wpPropMats } from './mats.ts';

/**
 * 小物を決まりで置く（部屋の種類ごとの置く物）。広間の中は、その広間の参考画像の視点から見える所には置かない
 * （参考画像の床には物が無い。視点の画角の外・目の後ろだけ）。
 */
const CAMS: Record<HallId, ShiftCam> = { A: CAM_A, B: CAM_B, C: CAM_C, D: CAM_D };

/** 点（床の上の物の外形の角を含めて）が、その広間の参考画像の画角に入るか */
function seen(id: HallId, x: number, z: number, h = 2.2, r = 1.0): boolean {
  const cam = CAMS[id];
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    for (const y of [0, h]) {
      const q = cam.proj([x + dx, y, z + dz]);
      if (q && q[0] > -40 && q[0] < 1272 && q[1] > -40 && q[1] < 968) return true;
    }
  }
  return false;
}

export function placeProps(b: Builder, ctx: SceneContext, pools: Record<HallId, PoolBuilt[]>): void {
  const sink = builderSink(b, ctx);
  const mats = wpPropMats(ctx);
  let seed = 9000;
  const at = (x: number, y: number, z: number, yaw = 0): Prop => Prop.at(sink, mats, [x, y, z], yaw, seed++);

  // ---- 更衣室: 壁沿いと中の島にロッカー、島の間にベンチ、南の壁に化粧台、時計
  {
    const [x0, z0, x1, z1] = LOCKER;
    for (let z = z0 + 1.6; z < z1 - 3; z += 2.6) {
      lockerBank(at(x0 + 0.3, 0, z, Math.PI / 2), { n: 6, rows: 3, color: WC.blue });
      lockerBank(at(x1 - 0.3, 0, z, -Math.PI / 2), { n: 6, rows: 3, color: WC.blue });
    }
    for (const x of [-3.2, 3.2]) {
      for (let z = z0 + 2.2; z < z1 - 3; z += 2.6) {
        lockerBank(at(x - 0.27, 0, z, -Math.PI / 2), { n: 6, rows: 3, color: WC.blue });
        lockerBank(at(x + 0.27, 0, z, Math.PI / 2), { n: 6, rows: 3, color: WC.blue });
      }
      for (let z = z0 + 2.6; z < z1 - 3.5; z += 3.2) wpBench(at(x + (x < 0 ? -2.2 : 2.2), 0, z, Math.PI / 2), 1.6);
    }
    vanity(at(-5.2, 0, z1 - 0.3, Math.PI), 3.2);
    vanity(at(5.2, 0, z1 - 0.3, Math.PI), 3.2);
    wallClock(at(0, 0, z0 + 0.05, 0), 2.4, 0.28);
    wpBin(at(-2.0, 0, z1 - 0.5, Math.PI));
    wpPlant(at(2.0, 0, z1 - 0.6, 0));
  }
  // ---- シャワー室: 東西の壁沿いに仕切りのシャワー、中に足洗いのシャワー柱
  {
    const [x0, z0, x1, z1] = SHOWER;
    for (let z = z0 + 0.8; z < z1 - 0.4; z += 1.1) {
      showerStall(at(x0 + 0.05, 0, z, Math.PI / 2), 1.0, 0.9, true, true);
      showerStall(at(x1 - 0.05, 0, z, -Math.PI / 2), 1.0, 0.9, true, true);
    }
    poolShower(at(-2.2, 0, (z0 + z1) / 2, 0));
    poolShower(at(2.2, 0, (z0 + z1) / 2, 0));
  }
  // ---- 南の通路: 南の壁沿い（シャワー室の入口を避ける）にベンチ・自販機・ごみ箱・鉢・消火器・救命具・時計、広間の入口に案内の標識
  {
    const [px0, , px1, pz1] = PROM;
    const wallZ = pz1 - 0.35;
    let i = 0;
    for (let x = px0 + 3; x < px1 - 2; x += 4.2, i++) {
      if (Math.abs(x) < 3.2) continue;
      const kind = i % 6;
      if (kind === 0 || kind === 3) wpBench(at(x, 0, wallZ - 0.1, Math.PI), 1.8);
      else if (kind === 1) wpVending(at(x, 0, wallZ - 0.2, Math.PI));
      else if (kind === 2) {
        wpBin(at(x - 0.7, 0, wallZ - 0.1, Math.PI));
        wpPlant(at(x + 0.8, 0, wallZ - 0.2, 0));
      } else if (kind === 4) {
        wpExtinguisherBox(at(x, 0, pz1, Math.PI));
        rescueBoard(at(x + 1.2, 0, pz1, Math.PI));
      } else {
        wallClock(at(x, 0, pz1, Math.PI), 2.5, 0.3);
        floatRack(at(x, 0, wallZ - 0.2, 0));
      }
    }
    for (const id of ['A', 'B', 'C', 'D'] as HallId[]) {
      const o = SOUTH_OPEN[id];
      signPost(at(o[1] + 0.8, 0, 11.4, Math.PI), -1);
    }
  }
  // ---- 2 階の観覧通路: 南の壁沿いにベンチと鉢
  {
    const [ux0, , ux1] = UPPER;
    const z = PROM[3] - 0.4;
    let i = 0;
    for (let x = ux0 + 3; x < ux1 - 2; x += 5, i++) {
      if (i % 3 === 2) wpPlant(at(x, UPPER_Y, z, 0));
      else wpBench(at(x, UPPER_Y, z - 0.1, Math.PI), 1.8);
    }
  }
  // ---- 広間: 参考画像の画角の外（目の後ろ・横）に、プールサイドの物
  const hallProps = (id: HallId, list: [number, number, number, (p: Prop) => void, number?][]): void => {
    const [ox, oz] = HALL[id].o;
    for (const [x, z, yaw, fn, y] of list) {
      if (seen(id, x + ox, z + oz)) continue;
      fn(at(x + ox, y ?? 0, z + oz, yaw));
    }
  };
  // A の西の低い回廊（3.6 m）: 監視員の机と椅子・救命具の板・ベンチ・浮き輪の台
  hallProps('A', [
    [-16.2, -30.0, Math.PI / 2, (p) => wpBench(p, 1.6), 3.6],
    [-16.4, -26.0, Math.PI / 2, (p) => floatRack(p), 3.6],
    [-16.6, -22.0, Math.PI / 2, (p) => kickboardPile(p, 12, [WC.yellow, WC.blue]), 3.6],
    [-16.2, -18.0, Math.PI / 2, (p) => wpBench(p, 1.6), 3.6],
    [-16.2, -14.0, Math.PI / 2, (p) => wpPlant(p), 3.6],
  ]);
  hallProps('A', [
    [-14.0, 6.0, Math.PI / 2, (p) => loungerStack(p)],
    [-14.0, 3.6, Math.PI / 2, (p) => loungerStack(p, 4)],
    [-14.4, 0.8, Math.PI / 2, (p) => floatRack(p)],
    [13.0, 6.2, -Math.PI / 2, (p) => loungerStack(p)],
    [13.0, 3.8, -Math.PI / 2, (p) => loungerStack(p, 6)],
    [13.4, 1.0, -Math.PI / 2, (p) => wpVending(p)],
    [6.5, -1.6, Math.PI, (p) => wpLifeguard(p)],
    [-6.4, -4.8, Math.PI, (p) => wpLifeguard(p)],
    [-2.0, 6.5, 0, (p) => poolShower(p)],
    [2.0, 6.5, 0, (p) => poolShower(p)],
    [5.4, 8.6, Math.PI, (p) => wpBench(p)],
    [-5.4, 8.6, Math.PI, (p) => wpBench(p)],
    [-8.4, 1.0, 0, (p) => ringBuoyPost(p)],
    [9.0, 0.0, 0, (p) => slideBoard(p)],
    [-12.0, -3.0, Math.PI / 2, (p) => kickboardPile(p, 10, [WC.yellow, WC.blue])],
    [11.8, -4.0, -Math.PI / 2, (p) => wpBin(p)],
  ]);
  hallProps('B', [
    [-1.6, 6.8, Math.PI, (p) => wpBench(p)],
    [2.4, 7.0, Math.PI, (p) => floatRack(p)],
    [-2.6, 1.0, Math.PI / 2, (p) => ringBuoyPost(p)],
    [12.0, 2.0, Math.PI, (p) => wpLifeguard(p)],
    [16.0, 2.0, 0, (p) => slideBoard(p)],
    [20.6, 4.0, -Math.PI / 2, (p) => loungerStack(p)],
    [20.6, 1.6, -Math.PI / 2, (p) => loungerStack(p, 4)],
    [12.0, 6.6, Math.PI, (p) => wpBench(p)],
    [7.4, 6.6, Math.PI, (p) => wpBench(p)],
    [5.4, -2.4, Math.PI, (p) => wpLifeguard(p)],
    [16.0, 6.4, 0, (p) => poolShower(p)],
    [-2.6, 6.4, Math.PI / 2, (p) => wpVending(p)],
    [-2.8, 3.2, Math.PI / 2, (p) => wpBin(p)],
    [8.0, -40.0, 0, (p) => slideBoard(p)],
    [14.0, -50.0, 0, (p) => floatRack(p)],
    [19.0, -45.0, -Math.PI / 2, (p) => loungerStack(p)],
    [19.0, -42.6, -Math.PI / 2, (p) => loungerStack(p, 4)],
    [6.0, -56.0, 0, (p) => ringBuoyPost(p)],
    [-2.5, -40.0, Math.PI / 2, (p) => wpBench(p)],
    [-2.5, -50.0, Math.PI / 2, (p) => wpPlant(p)],
  ]);
  hallProps('C', [
    [-6.0, 7.4, Math.PI, (p) => wpBench(p)],
    [2.0, 4.0, Math.PI, (p) => wpLifeguard(p)],
    [-2.0, 7.6, Math.PI, (p) => floatRack(p)],
    [12.6, -12.0, -Math.PI / 2, (p) => wpVending(p)],
    [12.8, -6.0, -Math.PI / 2, (p) => wpBench(p)],
    [12.8, -1.0, -Math.PI / 2, (p) => wpBench(p)],
    [9.6, -9.0, Math.PI / 2, (p) => wpBench(p)],
    [9.6, -3.0, Math.PI / 2, (p) => wpPlant(p)],
    [12.4, 3.0, -Math.PI / 2, (p) => wpBin(p)],
    [11.0, 7.4, Math.PI, (p) => floatRack(p)],
    [4.0, 7.6, Math.PI, (p) => poolShower(p)],
    [0.8, 7.6, Math.PI, (p) => wpBench(p)],
    [6.0, 1.4, Math.PI, (p) => ringBuoyPost(p)],
  ]);
  hallProps('D', [
    [-8.0, 7.0, Math.PI, (p) => floatRack(p)],
    [0.0, 3.0, Math.PI, (p) => ringBuoyPost(p)],
    [4.0, 6.8, Math.PI, (p) => wpVending(p)],
    [9.6, 6.4, -Math.PI / 2, (p) => loungerStack(p)],
    [9.6, 4.0, -Math.PI / 2, (p) => loungerStack(p, 4)],
    [2.0, 6.8, Math.PI, (p) => wpBench(p)],
    [-3.0, 6.8, Math.PI, (p) => wpBench(p)],
    [-10.6, 5.0, Math.PI / 2, (p) => wpVending(p)],
    [5.0, 1.4, Math.PI, (p) => wpLifeguard(p)],
    [-6.0, 3.6, Math.PI, (p) => poolShower(p)],
    [9.8, -1.0, -Math.PI / 2, (p) => slideBoard(p)],
    [-10.6, 1.6, Math.PI / 2, (p) => wpBin(p)],
  ]);
  // スライダーの出発の門（A の塔の上）
  slideGate(at(HALL.A.o[0] - 1.4, 6.9, HALL.A.o[1] - 24.6, Math.PI / 2 + 0.3));
  slideGate(at(HALL.A.o[0] + 0.8, 6.9, HALL.A.o[1] - 24.6, -Math.PI / 2 - 0.3));

  // ---- プールのまわりの排水の溝（縁から 0.3〜0.5 m の外を回る格子の蓋）。視点の目から 26 m 以内で画角に入る所は除く
  {
    const grate = ctx.mat({ color: '#9db0ba', toon: 0, line: 0, tiles: { size: [0.035, 0.035], line: 0.012, color: '#33434c', jitter: 0 }, name: 'P-grate' });
    const nearSeen = (id: HallId, x: number, z: number): boolean => {
      const e = CAMS[id].eye;
      if (Math.hypot(x - e[0], z - e[2]) > 26) return false;
      return seen(id, x, z, 0.1, 0.3);
    };
    for (const id of ['A', 'B', 'C', 'D'] as HallId[]) {
      for (const pb of pools[id]) {
        if (pb.def.sharp) continue;
        const ring = offsetOut(pb.outer, 0.3);
        const ring2 = offsetOut(pb.outer, 0.5);
        const pos: number[] = [];
        const n = ring.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          if (nearSeen(id, ring[i].x, ring[i].z) || nearSeen(id, ring[j].x, ring[j].z)) continue;
          const a = ring[i], c = ring[j], a2 = ring2[i], c2 = ring2[j];
          const y = 0.006;
          pos.push(a.x, y, a.z, a2.x, y, a2.z, c.x, y, c.z, c.x, y, c.z, a2.x, y, a2.z, c2.x, y, c2.z);
        }
        if (!pos.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        // 上向きの面にそろえる（輪の回る向きで裏返らないように）
        const nrm = g.getAttribute('normal');
        for (let k = 0; k < nrm.count; k++) nrm.setXYZ(k, 0, 1, 0);
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
        const mesh = b.mesh(g, grate, [0, 0, 0], { shadow: false });
        (mesh.material as THREE.Material).side = THREE.DoubleSide;
      }
    }
  }
  // ---- プールの入水の段（水の中の 2 段の当たり判定と、上の手すり）。見えない所の縁に
  for (const id of ['A', 'B', 'C'] as HallId[]) {
    for (const pb of pools[id]) {
      if (pb.def.coping === 'raised') continue;
      const n = pb.inner.length;
      // 視点から見えない縁の点（南寄り = 目の側の縁は画角の下の外）を探す
      let best = -1;
      let bestZ = -Infinity;
      for (let i = 0; i < n; i += 3) {
        const q = pb.inner[i];
        if (seen(id, q.x, q.z, 1.2, 0.5)) continue;
        if (q.z > bestZ) {
          bestZ = q.z;
          best = i;
        }
      }
      if (best < 0) best = 0;
      const p0 = pb.inner[best];
      const pa = pb.inner[(best - 1 + n) % n];
      const pc = pb.inner[(best + 1) % n];
      const t = pc.clone().sub(pa).setY(0).normalize();
      const out = new THREE.Vector3(-t.z, 0, t.x); // 外へ
      const yaw = Math.atan2(out.x, out.z) + Math.PI; // 背（-z）をプールサイドへ
      const depth = -pb.def.bottom;
      wpLadder(Prop.at({ add: sink.add, collide: () => {} }, mats, [p0.x, 0.1, p0.z], yaw, seed++), Math.min(depth, 1.2));
      for (let k = 1; k <= 3; k++) {
        const c = p0.clone().addScaledVector(out, -0.35 * k);
        const top = -0.16 * k;
        ctx.colliders.add({ x: c.x - 0.45, y: top - 0.3, z: c.z - 0.45 }, { x: c.x + 0.45, y: top, z: c.z + 0.45 });
      }
    }
  }
}
