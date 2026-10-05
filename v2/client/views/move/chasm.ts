/**
 * 移動と身体の描画: 溝・穴の上を渡る仕掛け（trapTile・swayBridge・pendulum・dustCover）と流砂（sinkTrap）の音。
 */
import * as THREE from 'three';
import { aabbCenter } from '../../../core/math/aabb.ts';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { boxGeo, hashStr, lightAt, nearCamera, seeded, setBaked, withBaked } from './util.ts';

interface Aabb { min: number[]; max: number[] }

// ---------------------------------------------------------------- 抜ける床板（蝶番で下へ開く）
defineView('trapTile', (spec, ctx) => {
  const b = spec.params.box as unknown as Aabb;
  const mat = (spec.params.mat as MatId | undefined) ?? 'floorTile';
  const size: [number, number, number] = [b.max[0]! - b.min[0]!, b.max[1]! - b.min[1]!, b.max[2]! - b.min[2]!];
  const g = boxGeo(size, mat);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  // 蝶番: x の向きの片方の縁（hinge 0 = x の小さい側）
  const hinge = Number(spec.params.hinge ?? 0) === 1;
  const pivot = new THREE.Group();
  pivot.position.set(hinge ? b.max[0]! : b.min[0]!, b.max[1]!, (b.min[2]! + b.max[2]!) / 2);
  mesh.position.set(hinge ? -size[0] / 2 : size[0] / 2, -size[1] / 2, 0);
  pivot.add(mesh);
  ctx.root.add(pivot);
  const c = aabbCenter({ min: [b.min[0]!, b.min[1]!, b.min[2]!], max: [b.max[0]!, b.max[1]!, b.max[2]!] });
  setBaked(g, lightAt(ctx, [c[0], c[1] + 0.3, c[2]]));
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || !ctx.audio || !nearCamera(ctx, c)) return;
    if (e.data?.name === 'trap.open') ctx.audio.play('clank', { pos: c, gain: 0.7 });
    else if (e.data?.name === 'trap.close') ctx.audio.play('knock', { pos: c, gain: 0.3 });
    else if (e.data?.name === 'trap.creak') ctx.audio.play('creak', { pos: c, gain: 0.5 });
  });
  return {
    update(s) {
      const a = typeof s.angle === 'number' ? s.angle : 0;
      pivot.rotation.z = (hinge ? 1 : -1) * a * (Math.PI / 2) * 0.95;
    },
    dispose() { off?.(); pivot.removeFromParent(); g.dispose(); },
  };
});

// ---------------------------------------------------------------- 吊り橋（橋板・綱が傾きに合わせて揺れる）
defineView('swayBridge', (spec, ctx) => {
  const r = spec.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const y = Number(spec.params.y ?? 0);
  const alongX = Number(spec.params.axis ?? 0) === 0;
  const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0, wid = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  const group = new THREE.Group();
  group.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  if (!alongX) group.rotation.y = Math.PI / 2;
  const deck = new THREE.Group();
  group.add(deck);
  const plank = boxGeo([0.2, 0.05, wid], 'floorWood');
  const rope = boxGeo([1, 0.03, 0.03], 'boxCardboard');
  const geos = [plank, rope];
  const n = Math.max(2, Math.floor(len / 0.26));
  const planks: THREE.Mesh[] = [];
  const wood = ctx.materials.get('floorWood');
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(plank, wood);
    m.position.set(-len / 2 + (i + 0.5) * (len / n), -0.025, 0);
    deck.add(m);
    planks.push(m);
  }
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(rope, ctx.materials.get('boxCardboard'));
    m.scale.x = len;
    m.position.set(0, 0.95, side * (wid / 2 + 0.04));
    deck.add(m);
  }
  ctx.root.add(group);
  const light = lightAt(ctx, [(r.x0 + r.x1) / 2, y + 0.4, (r.z0 + r.z1) / 2]);
  for (const g of geos) setBaked(g, light);
  let t = 0;
  return {
    update(s, dt) {
      t += dt;
      const roll = ((typeof s.roll === 'number' ? s.roll : 0) * Math.PI) / 180;
      // 橋の向き（x）を軸に傾ける。真ん中ほど少したわむ
      deck.rotation.x = alongX ? roll : -roll;
      planks.forEach((p, i) => { const k = (i + 0.5) / n; p.position.y = -0.025 - Math.sin(k * Math.PI) * (0.06 + Math.abs(roll) * 0.3) + Math.sin(t * 7 + i) * 0.003; });
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});

// ---------------------------------------------------------------- 振り子（天井からの棒と、大きな板）
defineView('pendulum', (spec, ctx) => {
  const piv = spec.params.pivot as number[];
  const half = spec.params.half as number[];
  const sw = spec.params.swing as number[];
  const len = Number(spec.params.len ?? 2);
  const mat = (spec.params.mat as MatId | undefined) ?? 'metalDark';
  const arm = new THREE.Group();
  arm.position.set(piv[0]!, piv[1]!, piv[2]!);
  // 揺れる面: 振れの向き sw と上下。回す軸は、振れの向きに垂直な水平の向き
  const axis = new THREE.Vector3(-sw[2]!, 0, sw[0]!).normalize();
  const rodGeo = boxGeo([0.06, len, 0.06], 'metal');
  const plateGeo = boxGeo([half[0]! * 2, half[1]! * 2, half[2]! * 2], mat);
  const rod = new THREE.Mesh(rodGeo, ctx.materials.get('metal'));
  rod.position.set(0, -len / 2, 0);
  const plate = new THREE.Mesh(plateGeo, ctx.materials.get(mat));
  plate.position.set(0, -len, 0);
  arm.add(rod, plate);
  ctx.root.add(arm);
  const q = new THREE.Quaternion();
  let relight = 0;
  let lastSide = 0;
  return {
    update(s, dt) {
      const a = typeof s.angle === 'number' ? s.angle : 0;
      // 角度の正は sw の向きへ振れる（板の位置 = 軸 + sw sinθ len）。回す軸 (-sw.z, 0, sw.x) のまわりに +θ
      q.setFromAxisAngle(axis, a);
      arm.quaternion.copy(q);
      relight -= dt;
      if (relight <= 0) {
        relight = 0.25;
        const p = s.pos as number[] | undefined;
        if (p) { const c = lightAt(ctx, [p[0]!, p[1]!, p[2]!]); setBaked(plateGeo, c); setBaked(rodGeo, c); }
      }
      // 一番下を通るたびに風切りの音
      const side = Math.sign(a);
      if (side !== lastSide && lastSide !== 0 && ctx.audio && nearCamera(ctx, [piv[0]!, piv[1]! - len, piv[2]!], 14)) ctx.audio.play('thud', { pos: [piv[0]!, piv[1]! - len, piv[2]!], gain: 0.12, pitch: 0.5 });
      lastSide = side;
    },
    dispose() { arm.removeFromParent(); rodGeo.dispose(); plateGeo.dispose(); },
  };
});

// ---------------------------------------------------------------- 見えない足場の上の埃
defineView('dustCover', (spec, ctx) => {
  const rects = (spec.params.rects as { x0: number; z0: number; x1: number; z1: number }[]) ?? [];
  const y = Number(spec.params.y ?? 0);
  const rnd = seeded(Number(spec.params.seed ?? hashStr(spec.id)));
  const per = 46;
  const count = rects.length * per;
  const geo = withBaked(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const mat = new THREE.MeshBasicMaterial({ color: 0xbdb6a6, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let k = 0;
  for (const r of rects) {
    for (let i = 0; i < per; i++) {
      // 縁ほど少なく（埃が足場の形に積もっている）
      const u = rnd(), v = rnd();
      const edge = Math.min(u, 1 - u, v, 1 - v);
      if (edge < 0.04 && rnd() < 0.7) { mesh.setMatrixAt(k++, m4.makeScale(0, 0, 0)); continue; }
      p.set(r.x0 + (r.x1 - r.x0) * u, y + 0.004 + rnd() * 0.003, r.z0 + (r.z1 - r.z0) * v);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
      const s = 0.02 + rnd() * 0.06;
      sc.set(s, 1, s * (0.5 + rnd()));
      mesh.setMatrixAt(k++, m4.compose(p, q, sc));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  ctx.root.add(mesh);
  return {
    update() {},
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
});

// ---------------------------------------------------------------- 流砂（沈むときの泡と、飲み込まれる音）
defineView('sinkTrap', (spec, ctx) => {
  const a = spec.params.aabb as unknown as Aabb;
  const c: [number, number, number] = [(a.min[0]! + a.max[0]!) / 2, a.min[1]! + 0.2, (a.min[2]! + a.max[2]!) / 2];
  const off = ctx.onEvent?.((e) => {
    if (e.type === 'cue' && e.entity === spec.id && e.data?.name === 'sink.swallow' && ctx.audio && nearCamera(ctx, c)) ctx.audio.play('thud', { pos: c, gain: 0.5, pitch: 0.6 });
  });
  let gurgle = 0;
  return {
    update(s, dt) {
      const level = typeof s.level === 'number' ? s.level : 0;
      gurgle -= dt;
      if (level > 0.2 && gurgle <= 0 && ctx.audio && nearCamera(ctx, c, 8)) { ctx.audio.play('drip', { pos: c, gain: 0.25 + level * 0.4, pitch: 0.5 }); gurgle = 0.6 - level * 0.3; }
    },
    dispose() { off?.(); },
  };
});
