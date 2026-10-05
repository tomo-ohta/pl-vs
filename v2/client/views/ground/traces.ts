/**
 * 足跡と鏡の描画:
 * - stepTrail: 自分の足跡（style 'glow' = 踏んだ所が光って fadeSec 秒で消える / 'print' = 埃の床に残る足跡）
 * - footMarks: 作り置きの「誰か」の足跡（'glowFaint' = 青白くゆっくり明滅 / 'dust' = 埃の上の古い足跡）
 * - mirrorRoom: 水たまりの水面と、床の下に組んだ部屋の鏡像（同じ部屋の殻と照明を上下に裏返し、照明の色を変える。
 *   鏡像にだけ、壁に開いた明るい扉と、その前に立つ誰か）。床の下は水たまりの穴からしか見えない。
 *   スマホ・画質の段 low では家具を映さない（箱の数を減らす）
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Box, MatId } from '../../../core/world/layout.ts';
import { IS_MOBILE } from '../../device.ts';
import { surfaceBox } from '../../render/SurfaceGeometry.ts';
import { defineView, type ViewContext } from '../views.ts';
import { glowMaterial, lightAt, tone } from './util.ts';

/** 足跡の形（細長い楕円。原点中心、-z が前） */
function footGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.absellipse(0, 0, 0.055, 0.125, 0, Math.PI * 2, false, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateX(-Math.PI / 2);
  return g;
}

interface Marks { mesh: THREE.InstancedMesh; set(i: number, x: number, z: number, yaw: number, k: number): void; flush(): void; dispose(): void }
function markMesh(ctx: ViewContext, count: number, color: number, opacity: number, additive: boolean, y: number): Marks {
  const geo = footGeometry();
  const mat = glowMaterial(color, opacity);
  if (additive) mat.blending = THREE.AdditiveBlending;
  mat.depthWrite = false;
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2;
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  ctx.root.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    mesh,
    set(i, x, z, yaw, k) {
      if (k <= 0.001) { mesh.setMatrixAt(i, zero); return; }
      q.setFromAxisAngle(up, yaw);
      p.set(x, y + 0.008, z);
      sc.set(k, 1, k);
      m4.compose(p, q, sc);
      mesh.setMatrixAt(i, m4);
    },
    flush() { mesh.instanceMatrix.needsUpdate = true; },
    dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}

defineView('stepTrail', (spec, ctx) => {
  const style = spec.params.style === 'print' ? 'print' : 'glow';
  const max = typeof spec.params.max === 'number' ? spec.params.max : 160;
  const fade = typeof spec.params.fadeSec === 'number' ? spec.params.fadeSec : 30;
  const y = typeof spec.params.y === 'number' ? spec.params.y : 0;
  const m = style === 'glow' ? markMesh(ctx, max, 0x7fe8ff, 0.85, true, y) : markMesh(ctx, max, 0x2a241c, 0.42, false, y);
  return {
    update(s) {
      const marks = (s.marks as number[] | undefined) ?? [];
      const now = ctx.sim.tick * ctx.sim.dt;
      const n = Math.min(max, marks.length / 4);
      for (let i = 0; i < max; i++) {
        if (i >= n) { m.set(i, 0, 0, 0, 0); continue; }
        const o = (marks.length / 4 - n + i) * 4;
        const age = now - marks[o + 3]!;
        const k = style === 'glow' ? Math.max(0, 1 - age / fade) * (age < 0.3 ? 1.25 : 1) : 1;
        m.set(i, marks[o]!, marks[o + 1]!, marks[o + 2]!, k);
      }
      m.flush();
    },
    dispose() { m.dispose(); },
  };
});

defineView('footMarks', (spec, ctx) => {
  const marks = (spec.params.marks as number[] | undefined) ?? [];
  const y = typeof spec.params.y === 'number' ? spec.params.y : 0;
  const glow = spec.params.style === 'glowFaint';
  const n = marks.length / 3;
  const m = glow ? markMesh(ctx, n, 0x8fb8ff, 0.5, true, y) : markMesh(ctx, n, 0x3a3226, 0.3, false, y);
  let t = 0;
  for (let i = 0; i < n; i++) m.set(i, marks[i * 3]!, marks[i * 3 + 1]!, marks[i * 3 + 2]!, 1);
  m.flush();
  return {
    update(_s, dt) {
      if (!glow) return;
      // 青白い足跡は、入口から奥へ波のように明るさが流れる
      t += dt;
      for (let i = 0; i < n; i++) m.set(i, marks[i * 3]!, marks[i * 3 + 1]!, marks[i * 3 + 2]!, 0.75 + 0.25 * Math.sin(t * 2 - i * 0.35));
      m.flush();
    },
    dispose() { m.dispose(); },
  };
});

defineView('mirrorRoom', (spec, ctx) => {
  const fy = typeof spec.params.floorY === 'number' ? spec.params.floorY : 0;
  const puddles = (spec.params.puddles as number[][] | undefined) ?? [];
  const tint = new THREE.Color(typeof spec.params.tint === 'number' ? spec.params.tint : 0x8fb4ff);
  const door = spec.params.door as { dir: number; at: number; y: number; w: number; h: number } | undefined;
  const group = new THREE.Group();
  ctx.root.add(group);
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  // 部屋の鏡像（床より上の当たる箱と、天井の照明）
  const cell = spec.cell ? ctx.built.cells.get(spec.cell) : undefined;
  if (cell) {
    // 画質の段 low（材質の段 0）・スマホでは家具を映さない
    const quality = (ctx.materials as unknown as { materialQuality?: { value: number } }).materialQuality?.value ?? 1;
    const shellOnly = IS_MOBILE || quality === 0;
    const by = new Map<MatId, THREE.BufferGeometry[]>();
    let n = 0;
    for (const b of cell.layout.boxes) {
      if (n >= 260) break;
      if (b.kind === 'colliderOnly' || b.kind === 'emitOnly' || b.revealGroup) continue;
      if (b.max[1] <= fy + 0.03 || b.min[1] < fy - 0.05) continue;
      const light = !b.solid && /^light/.test(b.mat);
      if (!b.solid && !light) continue;
      if (shellOnly && b.propGroup) continue;
      const mb: Box = { ...b, min: [b.min[0], 2 * fy - b.max[1], b.min[2]], max: [b.max[0], 2 * fy - b.min[1], b.max[2]] };
      const g = surfaceBox(mb, { legacy: true });
      const c = lightAt(ctx, [(b.min[0] + b.max[0]) / 2, Math.min(b.max[1], fy + 1.6), (b.min[2] + b.max[2]) / 2]);
      const arr = new Float32Array(g.getAttribute('position').count * 3);
      for (let i = 0; i < arr.length; i += 3) { arr[i] = c[0] * tint.r; arr[i + 1] = c[1] * tint.g; arr[i + 2] = c[2] * tint.b; }
      g.setAttribute('bakedLight', new THREE.BufferAttribute(arr, 3));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'bakedLight'].includes(k)) g.deleteAttribute(k);
      const list = by.get(b.mat) ?? [];
      list.push(g);
      by.set(b.mat, list);
      n++;
    }
    for (const [mat, list] of by) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      geos.push(merged);
      group.add(new THREE.Mesh(merged, ctx.materials.get(mat)));
    }
  }
  // 鏡像にだけある物: 壁に開いた明るい扉と、その前に立つ誰か
  if (door) {
    const alongX = door.dir % 2 === 0;
    const r = cell?.layout.footprint.reduce((a, x) => ((x.x1 - x.x0) * (x.z1 - x.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? x : a));
    if (r) {
      const wall = door.dir === 0 ? r.z1 - 0.15 : door.dir === 2 ? r.z0 + 0.15 : door.dir === 1 ? r.x1 - 0.15 : r.x0 + 0.15;
      const inward = door.dir === 0 || door.dir === 1 ? -1 : 1;
      const glowMat = glowMaterial(0xfff2cc);
      mats.push(glowMat);
      const plane = new THREE.PlaneGeometry(door.w, door.h);
      geos.push(plane);
      const d = new THREE.Mesh(plane, glowMat);
      d.position.set(alongX ? door.at : wall + inward * 0.01, fy - door.h / 2, alongX ? wall + inward * 0.01 : door.at);
      d.rotation.y = alongX ? (inward < 0 ? Math.PI : 0) : (inward < 0 ? -Math.PI / 2 : Math.PI / 2);
      group.add(d);
      const figMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
      mats.push(figMat);
      const fig = new THREE.BoxGeometry(0.42, 1.65, 0.24);
      geos.push(fig);
      const f = new THREE.Mesh(fig, figMat);
      f.position.set(alongX ? door.at + 0.2 : wall + inward * 1.0, fy - 0.83, alongX ? wall + inward * 1.0 : door.at + 0.2);
      group.add(f);
      const head = new THREE.SphereGeometry(0.12, 12, 8);
      geos.push(head);
      const h = new THREE.Mesh(head, figMat);
      h.position.set(f.position.x, fy - 1.78, f.position.z);
      group.add(h);
    }
  }
  // 水面（穴の縁は暗い水で隠し、真ん中は透けて鏡像が見える）
  const water: THREE.Mesh[] = [];
  const waterTex = (() => {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 6, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.28)');
    grd.addColorStop(0.72, 'rgba(255,255,255,0.45)');
    grd.addColorStop(0.9, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  })();
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x1d2a2e, transparent: true, opacity: waterTex ? 1 : 0.45, depthWrite: false, fog: true, ...(waterTex ? { alphaMap: waterTex } : {}) });
  mats.push(waterMat);
  for (const q of puddles) {
    const g = new THREE.PlaneGeometry(q[2]! - q[0]! + 0.06, q[3]! - q[1]! + 0.06);
    g.rotateX(-Math.PI / 2);
    geos.push(g);
    const m = new THREE.Mesh(g, waterMat);
    m.position.set((q[0]! + q[2]!) / 2, fy + 0.004, (q[1]! + q[3]!) / 2);
    m.renderOrder = 3;
    group.add(m);
    water.push(m);
  }
  let t = 0, drip = 2;
  return {
    update(_s, dt) {
      t += dt;
      waterMat.opacity = (waterTex ? 1 : 0.45) * (0.92 + 0.08 * Math.sin(t * 0.7));
      // 雨漏りのしずく（水たまりのどれかに、ときどき）
      drip -= dt;
      if (drip <= 0 && puddles.length) {
        drip = 2.5 + (Math.sin(t * 13.1) + 1) * 2;
        const q = puddles[Math.floor((Math.sin(t * 7.7) + 1) / 2 * puddles.length) % puddles.length]!;
        tone(ctx.audio, 1400 + 900 * ((Math.sin(t * 3.3) + 1) / 2), { pos: [(q[0]! + q[2]!) / 2, fy + 0.1, (q[1]! + q[3]!) / 2], gain: 0.05, dur: 0.15, freqTo: 700 });
      }
    },
    dispose() {
      group.removeFromParent();
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      waterTex?.dispose();
    },
  };
});
