/**
 * 移動と身体の描画: 乗り物（pathRide のロープ・ジップラインの綱と取っ手・台車、cableCar のゴンドラ）。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { pointAt, polyline } from '../../../core/sim/parts/move/ride.ts';
import { defineView, type ViewContext } from '../views.ts';
import { boxGeo, lightAt, nearCamera, setBaked, withBaked } from './util.ts';

/** a から b への細い棒（綱・ロープ） */
function segment(ctx: ViewContext, a: readonly number[], b: readonly number[], thick: number, mat: MatId): { mesh: THREE.Mesh; geo: THREE.BufferGeometry } {
  const d = new THREE.Vector3(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
  const len = d.length();
  const geo = boxGeo([len, thick, thick], mat);
  const mesh = new THREE.Mesh(geo, ctx.materials.get(mat));
  mesh.position.set((a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2, (a[2]! + b[2]!) / 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
  return { mesh, geo };
}

// ---------------------------------------------------------------- 線に沿う乗り物
defineView('pathRide', (spec, ctx) => {
  const path = spec.params.path as number[][];
  const L = polyline(path);
  const mode = String(spec.params.mode ?? 'zip');
  const geos: THREE.BufferGeometry[] = [];
  const parts: THREE.Object3D[] = [];
  // 綱・ロープ（台車は線路が箱なので描かない）
  if (mode !== 'cart') {
    for (let i = 1; i < path.length; i++) {
      const s = segment(ctx, path[i - 1]!, path[i]!, mode === 'rope' ? 0.045 : 0.02, mode === 'rope' ? 'boxCardboard' : 'metal');
      geos.push(s.geo); parts.push(s.mesh); ctx.root.add(s.mesh);
    }
  }
  // 動く物: 取っ手（ジップライン）・台車
  const mover = new THREE.Group();
  if (mode === 'zip') {
    const bar = boxGeo([0.5, 0.04, 0.04], 'plasticYellow'), rod = boxGeo([0.03, 0.35, 0.03], 'metal'), wheel = boxGeo([0.12, 0.12, 0.05], 'metalDark');
    geos.push(bar, rod, wheel);
    const r = new THREE.Mesh(rod, ctx.materials.get('metal')); r.position.y = -0.18;
    const b = new THREE.Mesh(bar, ctx.materials.get('plasticYellow')); b.position.y = -0.36;
    const w = new THREE.Mesh(wheel, ctx.materials.get('metalDark'));
    mover.add(r, b, w);
  } else if (mode === 'cart') {
    const body = boxGeo([0.9, 0.08, 0.8], 'metal'), wall = boxGeo([0.9, 0.45, 0.05], 'plasticRed'), end = boxGeo([0.05, 0.45, 0.8], 'plasticRed'), wheel = boxGeo([0.16, 0.16, 0.06], 'rubber');
    geos.push(body, wall, end, wheel);
    const add = (g: THREE.BufferGeometry, m: MatId, x: number, y: number, z: number): void => { const o = new THREE.Mesh(g, ctx.materials.get(m)); o.position.set(x, y, z); mover.add(o); };
    add(body, 'metal', 0, 0.2, 0);
    add(wall, 'plasticRed', 0, 0.45, 0.4); add(wall, 'plasticRed', 0, 0.45, -0.4);
    add(end, 'plasticRed', 0.45, 0.45, 0); add(end, 'plasticRed', -0.45, 0.45, 0);
    for (const x of [-0.32, 0.32]) for (const z of [-0.36, 0.36]) add(wheel, 'rubber', x, 0.08, z);
  }
  ctx.root.add(mover);
  const light = lightAt(ctx, [path[0]![0]!, path[0]![1]! + 0.3, path[0]![2]!]);
  for (const g of geos) setBaked(g, light);
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || !ctx.audio || !e.pos || !nearCamera(ctx, e.pos as [number, number, number])) return;
    const at = e.pos as [number, number, number];
    if (e.data?.name === 'ride.board') ctx.audio.play('clank', { pos: at, gain: 0.35 });
    else if (e.data?.name === 'ride.arrive') ctx.audio.play('thud', { pos: at, gain: 0.35 });
    else if (e.data?.name === 'cart.bump') ctx.audio.play('thud', { pos: at, gain: 0.8, pitch: 0.7 });
  });
  let relight = 0, rattle = 0;
  return {
    update(s, dt) {
      const d = typeof s.s === 'number' ? s.s : 0;
      const { p, t } = pointAt(L, d);
      mover.position.set(p[0], p[1], p[2]);
      // 進む向き（水平）へ回す。台車は坂の傾きも
      const yaw = Math.atan2(-t[2], t[0]);
      mover.rotation.set(0, yaw, mode === 'cart' ? Math.asin(Math.max(-1, Math.min(1, t[1]))) : 0, 'YXZ');
      relight -= dt;
      if (relight <= 0) { relight = 0.3; const c = lightAt(ctx, [p[0], p[1] + 0.3, p[2]]); for (const g of geos) setBaked(g, c); }
      // 台車の走る音・取っ手の滑る音
      rattle -= dt;
      const v = Math.abs(Number(s.v ?? 0));
      if (v > 1 && rattle <= 0 && ctx.audio && nearCamera(ctx, [p[0], p[1], p[2]], 12)) { ctx.audio.play(mode === 'cart' ? 'knock' : 'clank', { pos: [p[0], p[1], p[2]], gain: 0.05 + v * 0.02, pitch: mode === 'cart' ? 0.6 : 1.8 }); rattle = Math.max(0.08, 0.5 - v * 0.06); }
    },
    dispose() { off?.(); mover.removeFromParent(); for (const o of parts) o.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});

// ---------------------------------------------------------------- ゴンドラ（綱・丸い箱・回る床）
defineView('cableCar', (spec, ctx) => {
  const a = spec.params.a as number[], b = spec.params.b as number[];
  const half = Number(spec.params.half ?? 0.75);
  const top = Number(spec.params.top ?? 2.5);
  const geos: THREE.BufferGeometry[] = [];
  const cable = segment(ctx, [a[0]!, a[1]! + top, a[2]!], [b[0]!, b[1]! + top, b[2]!], 0.03, 'metal');
  geos.push(cable.geo);
  ctx.root.add(cable.mesh);
  const car = new THREE.Group();
  const floor = withBaked(new THREE.CylinderGeometry(half, half, 0.12, 24));
  const rail = withBaked(new THREE.TorusGeometry(half - 0.04, 0.03, 6, 24).rotateX(Math.PI / 2));
  const glass = withBaked(new THREE.CylinderGeometry(half - 0.02, half - 0.02, 0.9, 24, 1, true));
  const hanger = boxGeo([0.05, top - 1.05, 0.05], 'metalDark');
  const roof = withBaked(new THREE.ConeGeometry(half * 0.9, 0.25, 24));
  geos.push(floor, rail, glass, hanger, roof);
  const fm = new THREE.Mesh(floor, ctx.materials.get('woodPanel')); fm.position.y = -0.06;
  const rm = new THREE.Mesh(rail, ctx.materials.get('metalDark')); rm.position.y = 1.05;
  const gm = new THREE.Mesh(glass, ctx.materials.get('glass')); gm.position.y = 0.55;
  const hm = new THREE.Mesh(hanger, ctx.materials.get('metalDark')); hm.position.y = 1.05 + (top - 1.05) / 2;
  const roofM = new THREE.Mesh(roof, ctx.materials.get('metalDark')); roofM.position.y = top - 0.6;
  car.add(fm, rm, gm, hm, roofM);
  // 床の印（回っているのが分かる）
  const mark = boxGeo([half * 1.5, 0.004, 0.06], 'trim');
  geos.push(mark);
  const mm = new THREE.Mesh(mark, ctx.materials.get('trim')); mm.position.y = 0.002;
  car.add(mm);
  ctx.root.add(car);
  const light = lightAt(ctx, [a[0]!, a[1]! + 1, a[2]!]);
  for (const g of geos) setBaked(g, light);
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || !ctx.audio || !e.pos || !nearCamera(ctx, e.pos as [number, number, number])) return;
    if (e.data?.name === 'car.depart') ctx.audio.play('chime', { pos: e.pos as [number, number, number], gain: 0.3 });
    else if (e.data?.name === 'car.arrive') ctx.audio.play('clank', { pos: e.pos as [number, number, number], gain: 0.3 });
  });
  let relight = 0;
  return {
    update(s, dt) {
      const p = (s.pos as number[] | undefined) ?? a;
      car.position.set(p[0]!, p[1]!, p[2]!);
      car.rotation.y = typeof s.angle === 'number' ? s.angle : 0;
      relight -= dt;
      if (relight <= 0) { relight = 0.3; const c = lightAt(ctx, [p[0]!, p[1]! + 1, p[2]!]); for (const g of geos) if (g !== cable.geo) setBaked(g, c); }
    },
    dispose() { off?.(); car.removeFromParent(); cable.mesh.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});
