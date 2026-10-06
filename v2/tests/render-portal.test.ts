/**
 * 窓・枠の向こうを描く仕組み（client/world/Portals.ts・client/views/warp/portal.ts）の計算: 写し方の行列が core の xPoint と同じ・
 * 傾けた近くの面が板より手前を切り、向こうを残す・板の面の向きと切る面・隠しが無い枠の裏は描かない（WebGL は使わない）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { xPoint, type Xform } from '../core/sim/parts/warp/util.ts';
import type { Dir } from '../core/math/vec.ts';
import { obliqueNear, PortalRenderer, xformMatrix } from '../client/world/Portals.ts';
import { addPortal } from '../client/views/warp/portal.ts';
import { createView, type ViewContext } from '../client/views/views.ts';

test('写し方の行列は core の xPoint と同じ（4 つの向き）', () => {
  for (const q of [0, 1, 2, 3] as Dir[]) {
    const x: Xform = { from: [1.5, 0.2, -3], to: [-7, 66, 12.5], q };
    const m = xformMatrix(x);
    for (const p of [[0, 0, 0], [2, 1, -4], [-3.3, 1.7, 8]] as const) {
      const a = new THREE.Vector3(...p).applyMatrix4(m);
      const b = xPoint(x, p);
      assert.ok(a.distanceTo(new THREE.Vector3(...b)) < 1e-9, `q=${q}: ${a.toArray()} / ${b}`);
    }
  }
});

test('傾けた近くの面: 板の面より手前（カメラの側）は切り、向こうは残す', () => {
  const cam = new THREE.PerspectiveCamera(72, 1.6, 0.05, 150);
  cam.position.set(0.3, 1.6, 0);
  cam.rotation.set(0, 0.2, 0);
  cam.updateMatrixWorld();
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  // 面 z = -2（法線 -Z = 向こう）
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -2));
  obliqueNear(cam, plane);
  const ndcZ = (p: THREE.Vector3): number => p.clone().applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix).z;
  assert.ok(ndcZ(new THREE.Vector3(0.2, 1.5, -1.0)) < -1, '手前は切る');
  const far = ndcZ(new THREE.Vector3(0.2, 1.5, -4.0));
  assert.ok(far > -1 && far < 1, `向こうは残す（${far}）`);
});

test('板: 見る側を向き、切る面は向こうの写した真ん中を通って向こうを向く・needs の物は隠しが無ければ作らない', () => {
  const portals = new PortalRenderer();
  const root = new THREE.Group();
  const ctx = { root, portals } as unknown as ViewContext;
  const x = { from: [2, 0, 3], to: [2, 66, 3], q: 0 };
  const p = addPortal(ctx, { center: [2, 1.1, 3], dir: 2, w: 1.2, h: 2.2, xform: x });
  assert.ok(p.surface);
  assert.equal(portals.surfaces.size, 1);
  const s = p.surface!;
  assert.ok(s.normal.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9, '見る側（-Z）を向く');
  // 板の表（PlaneGeometry の +Z）を dir へ回してある
  const n = new THREE.Vector3();
  p.mesh.geometry.computeVertexNormals();
  n.fromBufferAttribute(p.mesh.geometry.getAttribute('normal') as THREE.BufferAttribute, 0);
  assert.ok(n.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6, `板の表 ${n.toArray()}`);
  // 切る面: 写した真ん中（y + 66）のすぐ手前を通り、+Z（向こう）を向く
  assert.ok(s.clip.normal.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-9);
  assert.ok(Math.abs(s.clip.distanceToPoint(new THREE.Vector3(2, 67.1, 3))) < 0.02);
  p.dispose();
  assert.equal(portals.surfaces.size, 0);
  // 隠しの現す部品が読んでいない needs の板（隠しの付かなかった枠の裏）は作らない
  const spec = { id: 'g.pSB', type: 'warpPortal', params: { center: [0, 1.1, 0], dir: 0, w: 1.2, h: 2.2, xform: x, needs: 'g.gSB.count' } };
  const none = createView(spec as never, { ...ctx, sim: { floor: { entities: [] } } } as unknown as ViewContext);
  assert.equal(none, null);
  const some = createView(spec as never, { ...ctx, sim: { floor: { entities: [{ id: 's.reveal', type: 'reveal', params: {}, inputs: { show: 'g.gSB.count' } }] } } } as unknown as ViewContext);
  assert.ok(some);
  assert.equal(portals.surfaces.size, 1);
  some!.dispose();
});
