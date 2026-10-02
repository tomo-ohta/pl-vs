/**
 * 窓・枠の向こうに別の所を描く板（client/world/Portals.ts の面）を作る道具と、描画だけの部品 warpPortal の描画。
 *
 * warpPortal の params:
 *   center … 板の真ん中・dir … 板の表が向く向き（見る側。0:+Z 1:+X 2:-Z 3:-X）・w・h
 *   xform … 見る側の場所 → 向こうの場所の写し方（from → to、q）
 *   cells? … 向こうで見せる区画（無ければ仮のカメラのいる区画から開口をたどる）
 *   needs? … この出力の id を隠しの現す部品が読んでいるときだけ描く（隠しが付いていない枠の裏は、ただの枠）
 */
import * as THREE from 'three';
import { rotQ, type Dir } from '../../../core/math/vec.ts';
import { defineView, type ViewContext } from '../views.ts';
import { PortalRenderer, xformMatrix, type PortalSurface } from '../../world/Portals.ts';

export interface PortalOpts {
  center: readonly number[];
  dir: Dir;
  w: number;
  h: number;
  xform: { from: readonly number[]; to: readonly number[]; q: number };
  cells?: readonly string[];
  layers?: readonly number[];
  active?(): boolean;
  /** 板を表の向きへずらす量（m） */
  lift?: number;
  /** 切る面を、写した板の真ん中から向こうへずらす量（m。既定 -0.01 = 少し手前。窓の向こうを部屋の中から描くときは、向かいの壁の内側へ） */
  clipShift?: number;
}

/** 板を作って描画の仕組みに登録する。戻り値の dispose で外す */
export function addPortal(ctx: ViewContext, o: PortalOpts): { mesh: THREE.Mesh; surface: PortalSurface | null; dispose(): void } {
  const n = rotQ([0, 0, 1], o.dir);
  const normal = new THREE.Vector3(n[0], n[1], n[2]);
  const center = new THREE.Vector3(o.center[0]!, o.center[1]!, o.center[2]!).addScaledVector(normal, o.lift ?? 0.004);
  const geo = new THREE.PlaneGeometry(o.w, o.h);
  // PlaneGeometry の表は +Z。dir の向きへ回す（rotQ は three の rotateY(q·π/2)）
  geo.rotateY((o.dir * Math.PI) / 2);
  const uniforms = { map: { value: null as THREE.Texture | null }, res: { value: new THREE.Vector2(1, 1) }, dim: { value: 1 } };
  const mat = ctx.portals ? PortalRenderer.material({ uniforms }) : new THREE.MeshBasicMaterial({ color: 0x101418 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  mesh.name = 'portal';
  ctx.root.add(mesh);
  let surface: PortalSurface | null = null;
  let remove = (): void => {};
  if (ctx.portals) {
    const x = o.xform;
    const toC = new THREE.Vector3(...(rotQ([center.x - x.from[0]!, center.y - x.from[1]!, center.z - x.from[2]!], (x.q & 3) as Dir))).add(new THREE.Vector3(x.to[0]!, x.to[1]!, x.to[2]!));
    const back = rotQ([-n[0], -n[1], -n[2]], (x.q & 3) as Dir);
    const clipN = new THREE.Vector3(back[0], back[1], back[2]);
    surface = {
      mesh, center, normal, radius: Math.hypot(o.w, o.h) / 2 + 0.1,
      xform: xformMatrix(x),
      clip: new THREE.Plane().setFromNormalAndCoplanarPoint(clipN, toC.addScaledVector(clipN, o.clipShift ?? -0.01)),
      ...(o.cells ? { cells: o.cells } : {}),
      ...(o.layers ? { layers: o.layers } : {}),
      ...(o.active ? { active: o.active } : {}),
      target: PortalRenderer.newTarget(),
      uniforms,
    };
    remove = ctx.portals.add(surface);
  }
  return {
    mesh, surface,
    dispose() { remove(); mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}

defineView('warpPortal', (spec, ctx) => {
  const p = spec.params;
  const needs = typeof p.needs === 'string' ? p.needs : null;
  const on = !needs || ctx.sim.floor.entities.some((e) => e.type === 'reveal' && Object.values(e.inputs ?? {}).includes(needs));
  if (!on) return null;
  const x = p.xform as { from: number[]; to: number[]; q: number };
  const portal = addPortal(ctx, {
    center: p.center as number[], dir: (Number(p.dir) & 3) as Dir, w: Number(p.w), h: Number(p.h), xform: x,
    ...(Array.isArray(p.cells) ? { cells: p.cells as string[] } : {}),
  });
  return { update() {}, dispose() { portal.dispose(); } };
});
