/**
 * 移動と身体の描画: ボールプール（ballPit）。矩形ごとの深さまで色とりどりの球を敷き詰める（上の層と、深い所はその下の層）。
 * 近くの球はプレイヤーの体を避けるように押しのけ、深い所を歩くと球の擦れる音
 */
import * as THREE from 'three';
import type { MatId } from '../../../core/world/layout.ts';
import { defineView } from '../views.ts';
import { hashStr, lightAt, nearCamera, seeded, setBaked, withBaked } from './util.ts';

interface PitRect { x0: number; z0: number; x1: number; z1: number; depth: number }

const COLORS: MatId[] = ['plasticRed', 'plasticYellow', 'plasticBlue', 'paintWhite'];
const R = 0.09;

defineView('ballPit', (spec, ctx) => {
  const rects = (spec.params.rects as unknown as PitRect[] | undefined) ?? [];
  const y = Number(spec.params.y ?? 0);
  const rnd = seeded(Number(spec.params.seed ?? hashStr(spec.id)));
  const geo = withBaked(new THREE.SphereGeometry(R, 8, 6));
  // 球の置き場所（色ごと）。上の層は詰めて、深い所はその下にもう一層
  const spots: { c: number; x: number; y: number; z: number }[][] = COLORS.map(() => []);
  const cap = 3200;
  let total = 0;
  for (const r of rects) {
    const step = R * 1.9;
    const layers = r.depth > 0.8 ? [r.depth, r.depth - R * 2.6] : [r.depth];
    for (const top of layers) {
      for (let x = r.x0 + R; x < r.x1 - R * 0.5 && total < cap; x += step) {
        for (let z = r.z0 + R; z < r.z1 - R * 0.5 && total < cap; z += step) {
          const c = Math.floor(rnd() * COLORS.length);
          spots[c]!.push({ c, x: x + (rnd() - 0.5) * R * 0.6, y: y + top - R * (0.4 + rnd() * 0.9), z: z + (rnd() - 0.5) * R * 0.6 });
          total++;
        }
      }
    }
  }
  const m4 = new THREE.Matrix4();
  const meshes = COLORS.map((mat, i) => {
    const list = spots[i]!;
    const mesh = new THREE.InstancedMesh(geo, ctx.materials.get(mat), Math.max(1, list.length));
    list.forEach((s, k) => mesh.setMatrixAt(k, m4.makeTranslation(s.x, s.y, s.z)));
    if (!list.length) mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    ctx.root.add(mesh);
    return mesh;
  });
  const cx = rects.length ? (Math.min(...rects.map((r) => r.x0)) + Math.max(...rects.map((r) => r.x1))) / 2 : 0;
  const cz = rects.length ? (Math.min(...rects.map((r) => r.z0)) + Math.max(...rects.map((r) => r.z1))) / 2 : 0;
  setBaked(geo, lightAt(ctx, [cx, y + 0.8, cz]));
  const pushed = spots.map((l) => new Uint8Array(l.length));
  let rustle = 0;
  let last: [number, number] | null = null;
  return {
    update(_s, dt) {
      const p = ctx.sim.players[0];
      if (!p) return;
      // 体のまわりの球を押しのける（体の半径 + 球）。離れたら元へ
      const px = p.pos[0], pz = p.pos[2];
      const near = p.pos[1] < y + 1.6 && p.pos[1] > y - 0.3;
      meshes.forEach((mesh, i) => {
        const list = spots[i]!;
        let dirty = false;
        for (let k = 0; k < list.length; k++) {
          const s = list[k]!;
          const dx = s.x - px, dz = s.z - pz;
          const d = Math.hypot(dx, dz);
          const pk = pushed[i]!;
          if (near && d < 0.42 && s.y > p.pos[1] - 0.1) {
            const k2 = (0.42 - d) / Math.max(1e-3, d);
            mesh.setMatrixAt(k, m4.makeTranslation(s.x + dx * k2, s.y + (0.42 - d) * 0.35, s.z + dz * k2));
            pk[k] = 1; dirty = true;
          } else if (pk[k]) {
            mesh.setMatrixAt(k, m4.makeTranslation(s.x, s.y, s.z));
            pk[k] = 0; dirty = true;
          }
        }
        if (dirty) mesh.instanceMatrix.needsUpdate = true;
      });
      // 球の擦れる音（深い所を歩いているとき）
      rustle -= dt;
      const moved = last ? Math.hypot(px - last[0], pz - last[1]) : 0;
      last = [px, pz];
      if (near && moved > 0.01 && rustle <= 0 && ctx.audio && nearCamera(ctx, [px, y, pz], 4)) { ctx.audio.rustle(0.4, [px, y + 0.5, pz]); rustle = 0.35; }
    },
    dispose() { for (const m of meshes) m.removeFromParent(); geo.dispose(); },
  };
});
