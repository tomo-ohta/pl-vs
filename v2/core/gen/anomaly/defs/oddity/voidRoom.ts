/**
 * 壁と床が欠ける（X09・段階 4・oddity）: 部屋の一部の面が無く、外は真っ暗な虚空。
 * 開口の無い壁沿いの床が帯状に崩れ落ち、その上の壁と天井も消えて、黒い虚空が覗く。床の真ん中にも穴が開いている。
 * 穴に落ちると、虚空の底で部屋の入口へ戻される（失敗の代償は位置と時間。体力は減らさない）。開口どうしを結ぶ床は必ず残す
 */
import type { Rect } from '../../../../world/footprint.ts';
import { box, type Box } from '../../../../world/layout.ts';
import { defineAnomaly } from '../../types.ts';
import { doorFronts, hitsAny, isCeilingPanel, objectGroups, bbOf } from '../../util.ts';
import { addGroup, aabbJ, blankFace, ceilingSheet, cutFloor, facesOf, freeSpans, front, gridPoints, holesKeepPaths, lanes, roomFx, wallSheet } from './common.ts';
import { MAZE_THEMES } from '../scale.ts';

const POOL_THEMES = new Set(['PoolCorridor']);

defineAnomaly({
  id: 'void', name: '壁と床が欠ける', weight: 0.6, intensity: 2, kinds: ['room', 'hall'], minSize: [4, 5], minHeight: 2.4,
  fits: (g, f) => !MAZE_THEMES.has(g.cell.theme ?? '') && !POOL_THEMES.has(g.cell.theme ?? '') && f.family !== 'pool',
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    if (cell.boxes.some((b) => b.kind === 'basin')) return false;
    const depth = t['anomaly.void.depth'];
    const doors = doorFronts(cell, ctx.geo.openings, 1.7, 0.6);
    const ways = lanes(ctx, 1.5, 1.4);
    const holes: Rect[] = [];
    const strips: { f: ReturnType<typeof facesOf>[number]; a0: number; a1: number }[] = [];
    const clearOf = (r: Rect): boolean => {
      const a = { min: [r.x0, fy - 0.1, r.z0] as [number, number, number], max: [r.x1, fy + 2, r.z1] as [number, number, number] };
      return !hitsAny(doors, a) && !hitsAny(ways, a) && !holes.some((o) => r.x0 < o.x1 + 0.6 && r.x1 > o.x0 - 0.6 && r.z0 < o.z1 + 0.6 && r.z1 > o.z0 - 0.6);
    };
    // 壁沿いの帯（開口の無い壁から 1〜2 本）
    for (const f of ctx.rng.shuffle(facesOf(ctx).filter((x) => blankFace(ctx, x) && x.a1 - x.a0 > 2.6))) {
      if (strips.length >= 2) break;
      const span = freeSpans(ctx, f, 0, 0.02)[0];
      if (!span) continue;
      const len = Math.min(span[1] - span[0], ctx.rng.float(2.2, 4.5));
      const a0 = ctx.rng.float(span[0], span[1] - len), a1 = a0 + len;
      const sw = ctx.rng.float(0.9, 1.4);
      const n1 = f.face + f.inward * sw;
      // 帯は壁の室内面から（壁の下の床板は残す）
      const inner: Rect = f.horizontal ? { x0: a0, x1: a1, z0: Math.min(f.face, n1), z1: Math.max(f.face, n1) } : { x0: Math.min(f.face, n1), x1: Math.max(f.face, n1), z0: a0, z1: a1 };
      if (!clearOf(inner) || !holesKeepPaths(ctx, [...holes, inner])) continue;
      holes.push(inner);
      strips.push({ f, a0, a1 });
    }
    // 床の真ん中の穴（0〜2 個）
    for (const [x, z] of ctx.rng.shuffle(gridPoints(ctx, 0.5, 1.2))) {
      if (holes.length - strips.length >= 2) break;
      const s = ctx.rng.float(1.0, 1.8);
      const r: Rect = { x0: x - s / 2, z0: z - s / 2, x1: x + s / 2, z1: z + s / 2 };
      if (!ctx.rects.some((q) => r.x0 > q.x0 + 0.6 && r.x1 < q.x1 - 0.6 && r.z0 > q.z0 + 0.6 && r.z1 < q.z1 - 0.6) || !clearOf(r)) continue;
      if (!holesKeepPaths(ctx, [...holes, r])) continue;
      holes.push(r);
    }
    if (holes.length < 2) return false;
    // 穴の上の家具はどける（宙に浮かないように）
    const over = new Set(objectGroups(ctx.furniture, cell).filter((g) => { const bb = bbOf(g.boxes); return holes.some((r) => bb.min[0] < r.x1 + 0.1 && bb.max[0] > r.x0 - 0.1 && bb.min[2] < r.z1 + 0.1 && bb.max[2] > r.z0 - 0.1); }).flatMap((g) => g.boxes));
    ctx.removeBoxes((b) => over.has(b) || (!b.solid && b.min[1] < fy + 0.05 && b.max[1] < fy + 0.1 && holes.some((r) => b.min[0] < r.x1 && b.max[0] > r.x0 && b.min[2] < r.z1 && b.max[2] > r.z0) && !b.kind?.startsWith('lamp')));
    const B: Box[] = [];
    const back = front(ctx.entrance, 0.9);
    const yaw = Math.atan2(-(cell.bounds.min[0] + cell.bounds.max[0] - 2 * back[0]), -(cell.bounds.min[2] + cell.bounds.max[2] - 2 * back[1]));
    holes.forEach((r, i) => {
      cutFloor(ctx, r);
      // 虚空の穴: 側面と底は光を返さない黒（void）
      B.push(box([r.x0, fy - depth - 0.2, r.z0], [r.x1, fy - depth, r.z1], 'void', true));
      B.push(box([r.x0, fy - depth, r.z0], [r.x0 + 0.05, fy, r.z1], 'void', true), box([r.x1 - 0.05, fy - depth, r.z0], [r.x1, fy, r.z1], 'void', true));
      B.push(box([r.x0 + 0.05, fy - depth, r.z0], [r.x1 - 0.05, fy, r.z0 + 0.05], 'void', true), box([r.x0 + 0.05, fy - depth, r.z1 - 0.05], [r.x1 - 0.05, fy, r.z1], 'void', true));
      // 欠けた床の縁（割れた床板の厚み）
      B.push(box([r.x0 - 0.03, fy - 0.2, r.z0 - 0.03], [r.x1 + 0.03, fy - 0.19, r.z1 + 0.03], 'void', false));
      ctx.addEntity(`fall${i}`, { type: 'respawnZone', params: { aabb: aabbJ({ min: [r.x0, fy - depth - 0.1, r.z0], max: [r.x1, fy - 1.2, r.z1] }), to: [back[0], fy + 0.05, back[1]], toYaw: yaw } });
    });
    // 帯の上の壁と天井も消えている（真っ黒な虚空が覗く）
    for (const s of strips) {
      B.push(wallSheet(s.f, s.a0, s.a1, fy - 0.2, fy + h, 'void', 0.002, 0.01));
      const hole = holes[strips.indexOf(s)]!;
      ctx.removeBoxes((b) => isCeilingPanel(cell, b) && (b.min[0] + b.max[0]) / 2 > hole.x0 - 0.3 && (b.min[0] + b.max[0]) / 2 < hole.x1 + 0.3 && (b.min[2] + b.max[2]) / 2 > hole.z0 - 0.3 && (b.min[2] + b.max[2]) / 2 < hole.z1 + 0.3);
      B.push(ceilingSheet(hole, fy + h, 'void', 0.01));
      cell.lights = cell.lights.filter((l) => !(l.pos[0] > hole.x0 - 0.5 && l.pos[0] < hole.x1 + 0.5 && l.pos[2] > hole.z0 - 0.5 && l.pos[2] < hole.z1 + 0.5));
    }
    addGroup(ctx, B, 'void');
    roomFx(ctx, { kind: 'grade', grade: { vignette: 0.3, saturation: 0.85 } });
    ctx.memo.holes = holes.length;
    cell.audioPreset = '低周波・微風';
    return true;
  },
});
