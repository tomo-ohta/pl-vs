/**
 * 移動と身体の描画: 回る・動く床と壁（spinFloor・revolvingDoor・pushBlock・tiltDeck）。
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { pushBlockBox, tiltItemBox } from '../../../core/sim/parts/move/mech.ts';
import { defineView } from '../views.ts';
import { boxGeo, lightAt, nearCamera, setBaked, withBaked } from './util.ts';

interface Aabb { min: number[]; max: number[] }

// ---------------------------------------------------------------- 回る床（円盤・放射の帯・柱。縁の足跡の輪）
defineView('spinFloor', (spec, ctx) => {
  const c = spec.params.center as number[];
  const R = Number(spec.params.radius ?? 2.5);
  const posts = (spec.params.posts as number[][] | undefined) ?? [];
  const group = new THREE.Group();
  group.position.set(c[0]!, c[1]!, c[2]!);
  const geos: THREE.BufferGeometry[] = [];
  const disc = withBaked(new THREE.CylinderGeometry(R, R, 0.04, 48));
  geos.push(disc);
  const discMesh = new THREE.Mesh(disc, ctx.materials.get('floorWood'));
  discMesh.position.y = 0.01;
  group.add(discMesh);
  // 放射の帯（回っているのが分かる）
  const stripe = boxGeo([R * 0.92, 0.006, 0.06], 'trim');
  geos.push(stripe);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(stripe, ctx.materials.get('trim'));
    const a = (i * Math.PI) / 4;
    m.position.set(Math.cos(a) * R * 0.5, 0.034, Math.sin(a) * R * 0.5);
    m.rotation.y = -a;
    group.add(m);
  }
  // 縁の足跡の輪（隠しの目印: 縁を歩いた跡）
  const ring = withBaked(new THREE.RingGeometry(R - 0.55, R - 0.42, 48).rotateX(-Math.PI / 2));
  geos.push(ring);
  const ringMesh = new THREE.Mesh(ring, ctx.materials.get('shadowDecal'));
  ringMesh.position.y = 0.035;
  group.add(ringMesh);
  // 真ん中の軸と、柱
  const hub = withBaked(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 20));
  geos.push(hub);
  const hubMesh = new THREE.Mesh(hub, ctx.materials.get('metal'));
  hubMesh.position.y = 0.04;
  group.add(hubMesh);
  for (const p of posts) {
    const [r, a0, h, ht] = p as [number, number, number, number];
    const g = boxGeo([h * 2, ht, h * 2], 'columnConcrete');
    geos.push(g);
    const m = new THREE.Mesh(g, ctx.materials.get('columnConcrete'));
    m.position.set(r * Math.cos(a0), ht / 2, r * Math.sin(a0));
    group.add(m);
  }
  ctx.root.add(group);
  const light = lightAt(ctx, [c[0]!, c[1]! + 0.5, c[2]!]);
  for (const g of geos) setBaked(g, light);
  const at: [number, number, number] = [c[0]!, c[1]! + 1, c[2]!];
  const off = ctx.onEvent?.((e) => {
    if (e.type === 'cue' && e.entity === spec.id && e.data?.name === 'turntable.rim' && ctx.audio && nearCamera(ctx, at)) ctx.audio.play('chime', { pos: at, gain: 0.4 });
  });
  let creak = 0;
  return {
    update(s, dt) {
      // 部品の角度 θ: 点 (x, z) を (x cosθ + z sinθ, -x sinθ + z cosθ) へ回す = three の rotation.y = θ
      group.rotation.y = typeof s.angle === 'number' ? s.angle : 0;
      creak -= dt;
      if (creak <= 0 && ctx.audio && nearCamera(ctx, at, 10)) { ctx.audio.play('knock', { pos: [c[0]!, c[1]!, c[2]!], gain: 0.05, pitch: 0.4 }); creak = 2.4; }
    },
    dispose() { off?.(); group.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});

// ---------------------------------------------------------------- 回転扉（4 枚のガラスの羽・真ん中の軸・天井の円盤）
defineView('revolvingDoor', (spec, ctx) => {
  const c = spec.params.center as number[];
  const Rd = Number(spec.params.radius ?? 1.6);
  const h = Math.min(2.6, Number(spec.params.height ?? 2.4));
  const group = new THREE.Group();
  group.position.set(c[0]!, c[1]!, c[2]!);
  const wing = boxGeo([Rd * 0.84, h - 0.06, 0.04], 'glass');
  const frame = boxGeo([Rd * 0.84, 0.06, 0.07], 'metalDark');
  const post = withBaked(new THREE.CylinderGeometry(0.09, 0.09, h, 12));
  const geos = [wing, frame, post];
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.rotation.y = -(k * Math.PI) / 2;
    const w = new THREE.Mesh(wing, ctx.materials.get('glass'));
    w.position.set(Rd * 0.42 + 0.06, h / 2, 0);
    arm.add(w);
    for (const y of [0.04, h - 0.04]) {
      const f = new THREE.Mesh(frame, ctx.materials.get('metalDark'));
      f.position.set(Rd * 0.42 + 0.06, y, 0);
      arm.add(f);
    }
    group.add(arm);
  }
  const pm = new THREE.Mesh(post, ctx.materials.get('stainless'));
  pm.position.y = h / 2;
  group.add(pm);
  // 床の円（扉の回る範囲）
  const disc = withBaked(new THREE.RingGeometry(Rd - 0.06, Rd, 40).rotateX(-Math.PI / 2));
  geos.push(disc);
  const dm = new THREE.Mesh(disc, ctx.materials.get('metal'));
  dm.position.set(c[0]!, c[1]! + 0.004, c[2]!);
  ctx.root.add(group, dm);
  const light = lightAt(ctx, [c[0]!, c[1]! + 1.2, c[2]!]);
  for (const g of geos) setBaked(g, light);
  const at: [number, number, number] = [c[0]!, c[1]! + 1.2, c[2]!];
  const off = ctx.onEvent?.((e) => {
    if (e.type === 'cue' && e.entity === spec.id && e.data?.name === 'revolve.whirl' && ctx.audio && nearCamera(ctx, at)) ctx.audio.play('knock', { pos: at, gain: 0.15, pitch: 1.6 });
  });
  let last = 0, tick = 0;
  return {
    update(s, dt) {
      // 羽 k は角度 θ + kπ/2（atan2(z, x)）。three の rotation.y = β で +x は角度 -β へ向く
      const a = typeof s.angle === 'number' ? s.angle : 0;
      group.rotation.y = -a;
      // 羽が口の縁を通るたびに、ゴムの擦れる音
      const q = Math.floor(((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2) / (Math.PI / 4));
      tick -= dt;
      if (q !== last && tick <= 0 && Math.abs(Number(s.w ?? 0)) > 0.2 && ctx.audio && nearCamera(ctx, at, 8)) { ctx.audio.play('thud', { pos: at, gain: 0.08, pitch: 1.4 }); tick = 0.2; }
      last = q;
    },
    dispose() { off?.(); group.removeFromParent(); dm.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});

// ---------------------------------------------------------------- 押せる壁（壁の板が動く）
defineView('pushBlock', (spec, ctx) => {
  const b0 = pushBlockBox(spec, 0);
  const mat = (spec.params.mat as MatId | undefined) ?? 'woodPanel';
  const size: [number, number, number] = [b0.max[0] - b0.min[0], b0.max[1] - b0.min[1], b0.max[2] - b0.min[2]];
  const g = boxGeo(size, mat);
  const mesh = new THREE.Mesh(g, ctx.materials.get(mat));
  ctx.root.add(mesh);
  const place = (off: number): void => {
    const b = pushBlockBox(spec, off);
    mesh.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    setBaked(g, lightAt(ctx, [mesh.position.x, b.min[1] + 1.2, mesh.position.z]));
  };
  place(0);
  const off = ctx.onEvent?.((e) => {
    if (e.type !== 'cue' || e.entity !== spec.id || !ctx.audio || !e.pos || !nearCamera(ctx, e.pos as [number, number, number])) return;
    if (e.data?.name === 'push.start') ctx.audio.play('thud', { pos: e.pos as [number, number, number], gain: 0.3, pitch: 0.5 });
    else if (e.data?.name === 'push.end') ctx.audio.play('thud', { pos: e.pos as [number, number, number], gain: 0.7, pitch: 0.4 });
  });
  let last = 0, scrape = 0;
  return {
    update(s, dt) {
      const o = typeof s.off === 'number' ? s.off : 0;
      if (o !== last) { place(o); last = o; }
      scrape -= dt;
      if (s.moving && scrape <= 0 && ctx.audio && nearCamera(ctx, [mesh.position.x, mesh.position.y, mesh.position.z], 10)) { ctx.audio.play('knock', { pos: [mesh.position.x, b0.min[1] + 0.1, mesh.position.z], gain: 0.12, pitch: 0.3 }); scrape = 0.35; }
    },
    dispose() { off?.(); mesh.removeFromParent(); g.dispose(); },
  };
});

// ---------------------------------------------------------------- 傾いていく床（床板と家具が傾き、家具が滑る）
defineView('tiltDeck', (spec, ctx) => {
  const r = spec.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const y = Number(spec.params.y ?? 0);
  const alongX = Number(spec.params.axis ?? 0) === 0;
  const mat = (spec.params.mat as MatId | undefined) ?? 'floorTile';
  const items = (spec.params.items as unknown as (Aabb & { mat?: MatId })[] | undefined) ?? [];
  const deck = new THREE.Group();
  deck.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  const dg = boxGeo([r.x1 - r.x0, 0.12, r.z1 - r.z0], mat);
  const dm = new THREE.Mesh(dg, ctx.materials.get(mat));
  dm.position.y = -0.06;
  deck.add(dm);
  // 床の継ぎ目（傾きが分かる線）
  const seam = boxGeo(alongX ? [r.x1 - r.x0, 0.004, 0.03] : [0.03, 0.004, r.z1 - r.z0], 'trim');
  const geos = [dg, seam];
  for (let k = 1; k < 4; k++) {
    const m = new THREE.Mesh(seam, ctx.materials.get('trim'));
    const f = k / 4 - 0.5;
    if (alongX) m.position.set(0, 0.002, f * (r.z1 - r.z0)); else m.position.set(f * (r.x1 - r.x0), 0.002, 0);
    deck.add(m);
  }
  ctx.root.add(deck);
  const itemMeshes = items.map((it) => {
    const m = it.mat ?? 'furnitureLight';
    const g = boxGeo([it.max[0]! - it.min[0]!, it.max[1]! - it.min[1]!, it.max[2]! - it.min[2]!], m);
    geos.push(g);
    const mesh = new THREE.Mesh(g, ctx.materials.get(m));
    ctx.root.add(mesh);
    return { mesh, g };
  });
  const light = lightAt(ctx, [deck.position.x, y + 0.5, deck.position.z]);
  for (const g of geos) setBaked(g, light);
  const off = ctx.onEvent?.((e) => {
    if (e.type === 'cue' && e.entity === spec.id && e.data?.name === 'tilt.thud' && e.pos && ctx.audio && nearCamera(ctx, e.pos as [number, number, number])) ctx.audio.play('thud', { pos: e.pos as [number, number, number], gain: 0.6 });
  });
  let groan = 0, lastRoll = 0;
  return {
    update(s, dt) {
      const roll = typeof s.roll === 'number' ? s.roll : 0;
      const a = (roll * Math.PI) / 180;
      // 面の高さ y = y0 - tan(a)·d（d は軸からの距離）。x の向きが長いなら x 軸のまわりに +a、z なら z 軸のまわりに -a
      if (alongX) deck.rotation.x = a; else deck.rotation.z = -a;
      const offs = (s.off as number[] | undefined) ?? [];
      itemMeshes.forEach(({ mesh }, i) => {
        const b = tiltItemBox(spec, i, offs[i] ?? 0, roll);
        mesh.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
        if (alongX) mesh.rotation.x = a; else mesh.rotation.z = -a;
      });
      // 傾いていく間、床がきしむ
      groan -= dt;
      if (Math.abs(roll - lastRoll) > 0.3 && groan <= 0 && ctx.audio && nearCamera(ctx, [deck.position.x, y, deck.position.z], 10)) { ctx.audio.play('knock', { pos: [deck.position.x, y, deck.position.z], gain: 0.1, pitch: 0.35 }); groan = 1.5; lastRoll = roll; }
    },
    dispose() { off?.(); deck.removeFromParent(); for (const { mesh } of itemMeshes) mesh.removeFromParent(); for (const g of geos) g.dispose(); },
  };
});
