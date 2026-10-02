/**
 * I08 物を置くと増える（replicaField）の描画: 台に置かれた物と同じ形を、床の升目にずらりと並べる（形の部品ごとに InstancedMesh）。
 * 並ぶ物は少しずつ向きがずれている（全部がまっすぐだと置物の模様に見える）
 */
import * as THREE from 'three';
import type { PartState } from '../../../core/sim/part.ts';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { lightAt, Parts } from './common.ts';
import { buildShape } from './items.ts';

defineView('replicaField', (spec, ctx) => {
  const spots = (spec.params.spots as number[][] | undefined) ?? [];
  if (!spots.length) return null;
  let item: string | null = null;
  let P: Parts | null = null;
  const meshes: THREE.InstancedMesh[] = [];
  const clear = (): void => {
    for (const m of meshes) m.removeFromParent();
    meshes.length = 0;
    P?.dispose();
    P = null;
  };
  const build = (id: string): void => {
    clear();
    const e = ctx.sim.floor.entities.find((x) => x.id === id);
    if (!e) return;
    const half = (e.params.half as [number, number, number] | undefined) ?? [0.15, 0.15, 0.15];
    P = new Parts(ctx);
    buildShape(P, String(e.params.kind ?? 'box'), half, (e.params.mat as MatId | undefined) ?? 'boxCardboard', e.params, 0);
    const c = spots[Math.floor(spots.length / 2)]!;
    P.relight(lightAt(ctx, [c[0]!, c[1]! + 0.5, c[2]!]));
    P.group.updateMatrixWorld(true);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    let k = 7;
    const rnd = (): number => { k = (k * 16807) % 2147483647; return k / 2147483647; };
    const xf = spots.map((sp) => { q.setFromAxisAngle(up, (rnd() - 0.5) * 0.5); pos.set(sp[0]!, sp[1]! + half[1], sp[2]!); return new THREE.Matrix4().compose(pos, q, one); });
    P.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material as THREE.Material, spots.length);
      xf.forEach((x, i) => { m4.multiplyMatrices(x, mesh.matrixWorld); inst.setMatrixAt(i, m4); });
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      ctx.root.add(inst);
      meshes.push(inst);
    });
  };
  return {
    update(s: Readonly<PartState>) {
      const want = typeof s.item === 'string' ? s.item : null;
      if (want === item) return;
      item = want;
      if (want) build(want); else clear();
    },
    dispose() { clear(); },
  };
});
