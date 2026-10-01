/** 吹抜ロビー / コンコース（AtriumLobby / Terminal）。天井の高い大空間 + 周囲の柱 + 受付島 + 植栽。 */
import type { Socket } from '../core/types';
import { buildShell, footprintAABB, inner, rect, rectArea, type Rect } from './footprint';
import { clearDoorways, dropRemovedHole, labelAtEntry, makeEntry, patternIslands, patternRows, placeExits, placeHole, type FurnishCtx } from './common';
import { box, bonusExits, emptyLayout, lightPanel, type GenParams, type RoomLayout } from './layout';

const SIZES: [number, number][] = [[34, 40], [28, 30], [22, 24], [18, 18]];

export function generateAtrium(p: GenParams): RoomLayout {
  const { rng, template, palette } = p;
  const L = emptyLayout(palette);
  const tid = template.id;
  const vr = rng.fork(`v${p.variant}`);
  const [bw, bd] = SIZES[Math.floor(p.variant / 2) % SIZES.length];
  const wing = p.variant % 2 === 0;
  let w = Math.round(bw * vr.float(0.9, 1.1));
  let d = Math.round(bd * vr.float(0.9, 1.1));
  if (tid === 'Terminal') {
    d = Math.round(d * 1.6);
    w = Math.round(w * 0.7);
  }
  const h = Math.min(9, 5.5 + Math.max(w, d) / 12);
  const main = p.mainRect ? rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1) : rect(-w / 2, 0, w / 2, d);
  const rects: Rect[] = [main];
  if (wing && !p.mainRect) {
    const ww = Math.round(w * 0.45);
    const wd = Math.round(d * 0.5);
    rects.push(vr.chance(0.5) ? rect(main.x1, d - wd, main.x1 + ww, d) : rect(main.x0 - ww, d - wd, main.x0, d));
  }
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  const area = rects.reduce((a, r) => a + rectArea(r), 0);

  const { entry, ceilingHole } = makeEntry(p, main, 0, h);
  let sockets: Socket[] = [entry, ...p.extraSockets];
  const exits = Math.min(6, Math.max(2, p.exits) + bonusExits(area));
  sockets.push(...placeExits(rects, sockets, vr, { count: exits, minGap: 3.5 }));
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));
  // 床穴（判定・配置は専用 fork。holeLocal の有無で vr の消費量を変えない）
  const hr = vr.fork('hole');
  const wantHole = p.allowHole && hr.chance(0.15);
  if (p.holeLocal || wantHole) {
    const hole = placeHole(rects, sockets, hr, p.holeLocal);
    if (hole) {
      L.holes.push(hole.hole);
      sockets.push(hole.socket);
    }
  }
  L.sockets = sockets;
  dropRemovedHole(L, p);
  sockets = L.sockets;
  buildShell(L.boxes, rects, h, sockets, { floor: palette.floor, wall: palette.wall, ceiling: palette.ceiling, floorHoles: L.holes, ceilingHoles: ceilingHole ? [ceilingHole] : [] });

  const shellCount = L.boxes.length;
  L.shellCount = shellCount;
  const ctx: FurnishCtx = { L, rects, h, rng: vr, keep: sockets, landing: ceilingHole };
  // 周囲の柱（内側 2.5m）
  for (const r of rects) {
    const ir = inner(r, 2.5);
    const step = 6;
    const pts: [number, number][] = [];
    for (let x = ir.x0; x <= ir.x1 + 0.01; x += step) pts.push([x, ir.z0], [x, ir.z1]);
    for (let z = ir.z0 + step; z < ir.z1; z += step) pts.push([ir.x0, z], [ir.x1, z]);
    for (const [x, z] of pts) {
      if (sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < 2.2)) continue;
      L.boxes.push(box([x - 0.35, 0, z - 0.35], [x + 0.35, h, z + 0.35], 'columnConcrete'));
    }
    // 中二階風の帯（高い壁面の装飾。歩行不可）
    L.boxes.push(box([r.x0 + 0.15, 3.4, r.z0 + 0.15], [r.x1 - 0.15, 3.6, r.z1 - 0.15], 'trim', false));
  }
  if (tid === 'Terminal') {
    // 座席列 + ゲートカウンター
    patternRows(ctx, { spacing: 4.5, depth: 0.6, height: 0.5, mat: 'furnitureDark', gapEvery: 5, margin: 3.5, axis: d > w ? 'z' : 'x' });
    const r = main;
    for (let x = r.x0 + 4; x < r.x1 - 3; x += 7) {
      if (sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - (r.z1 - 1.2)) < 3)) continue;
      L.boxes.push(box([x - 1.5, 0, r.z1 - 1.8], [x + 1.5, 1.1, r.z1 - 0.9], 'furnitureLight'));
      L.boxes.push(box([x - 1.2, 2.6, r.z1 - 0.5], [x + 1.2, 3.4, r.z1 - 0.4], 'lightPanel', false));
    }
  } else {
    // 受付島 + 植栽 + ベンチ
    const cx = (main.x0 + main.x1) / 2;
    const cz = main.z0 + d * 0.35;
    if (!sockets.some((s) => Math.hypot(s.pos[0] - cx, s.pos[2] - cz) < 3)) {
      L.boxes.push(box([cx - 2.4, 0, cz - 0.7], [cx + 2.4, 1.1, cz + 0.7], 'furnitureLight'));
    }
    patternIslands(ctx, 1 / 70, ['plant', 'furnitureDark']);
  }
  clearDoorways(L, sockets, shellCount);
  // 照明: 吊りパネル（h-2.2）と天井
  for (const r of rects) {
    const ir = inner(r, 3);
    for (let x = ir.x0 + 3; x < ir.x1; x += 7) {
      for (let z = ir.z0 + 3; z < ir.z1; z += 7) {
        L.boxes.push(box([x - 0.6, h - 2.4, z - 0.6], [x + 0.6, h - 2.32, z + 0.6], palette.light, false));
        L.boxes.push(box([x - 0.02, h - 2.32, z - 0.02], [x + 0.02, h, z + 0.02], 'metal', false));
      }
    }
    // 天窓の帯
    lightPanel(L.boxes, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, Math.min(3, (r.x1 - r.x0) * 0.3), Math.max(2, (r.z1 - r.z0) * 0.6), h, 'lightPanel');
    L.lights.push({ pos: [(r.x0 + r.x1) / 2, h - 1.5, (r.z0 + r.z1) / 2], color: palette.lightColor, intensity: 1.2, distance: Math.max(w, d) });
    L.lights.push({ pos: [(r.x0 + r.x1) / 2, 3.0, r.z0 + 3], color: palette.lightColor, intensity: 0.8, distance: 16 });
  }
  labelAtEntry(L, entry, 3.0, p.label);
  return L;
}
