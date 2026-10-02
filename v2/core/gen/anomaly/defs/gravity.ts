/**
 * 重さの異変: 軽い部屋（重さが 0.35〜0.45 倍。高く跳べる・ゆっくり落ちる）。
 * 開けた瞬間に分かるように、軽い物（椅子・ゴミ箱・紙）が宙に浮いている。天井の高い部屋には、跳んで乗れる宙の足場も。
 */
import { box, type Box } from '../../../world/layout.ts';
import { defineAnomaly } from '../types.ts';
import { bbOf, doorFronts, hitsAny, interiorSolids, loadCoords, moveBox, objectGroups, overlaps, rectArea, saveCoords } from '../util.ts';

defineAnomaly({
  id: 'lowGravity', name: '軽い部屋', weight: 0.8, intensity: 1, kinds: ['room', 'hall'],
  pre(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const scale = ctx.rng.float(t['anomaly.lowGravity.scaleMin'], Math.max(t['anomaly.lowGravity.scaleMin'], t['anomaly.lowGravity.scaleMax']));
    ctx.memo.scale = scale;
    for (const r of ctx.rects) ctx.addZone({ kind: 'gravity', aabb: { min: [r.x0, fy - 0.1, r.z0], max: [r.x1, fy + h, r.z1] }, params: { scale } });
    // 宙の足場（天井が高い部屋だけ）: 普通の重さでは届かない高さ。上に立っても頭が天井につかえない
    if (h < t['anomaly.lowGravity.platformMinH']) return;
    const doors = doorFronts(cell, ctx.geo.openings, 1.8, 0.5);
    const fixed = interiorSolids(cell);
    const made: Box[] = [];
    const want = ctx.rng.int(2, 4);
    for (let i = 0; i < 30 && made.length < want; i++) {
      const r = ctx.rng.pick(ctx.rects);
      const s = ctx.rng.float(0.9, 1.4);
      if (r.x1 - r.x0 < s + 1 || r.z1 - r.z0 < s + 1) continue;
      const x = ctx.rng.float(r.x0 + s / 2 + 0.4, r.x1 - s / 2 - 0.4), z = ctx.rng.float(r.z0 + s / 2 + 0.4, r.z1 - s / 2 - 0.4);
      const top = fy + ctx.rng.float(1.15, Math.max(1.2, h - 1.85));
      const b = box([x - s / 2, top - 0.12, z - s / 2], [x + s / 2, top, z + s / 2], ctx.rng.pick(['furnitureLight', 'woodPanel', 'metal'] as const), true);
      if (hitsAny(doors, b) || fixed.some((f) => overlaps(f, b, 0.2)) || made.some((m) => overlaps(m, b, 0.5))) continue;
      b.kind = 'floatingPlatform';
      ctx.addBox(b);
      if (!ctx.reachOk()) { ctx.removeBoxes((x2) => x2 === b); continue; }
      made.push(b);
    }
    // 足場は家具に重ねさせない（区画の中身は先に置かれた当たる物を避ける）
  },
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    // 軽い物を宙に浮かせる: 頭より上（通り道を塞がない）。収まらなければ浮かせない
    const groups = ctx.rng.shuffle(objectGroups(ctx.furniture, cell).filter((g) => {
      const bb = bbOf(g.boxes);
      return bb.max[1] - bb.min[1] <= 1.0 && (bb.max[0] - bb.min[0]) * (bb.max[2] - bb.min[2]) <= 1.2 && !g.boxes.some((b) => b.slope);
    }));
    let floated = 0;
    for (const g of groups) {
      if (floated >= t['anomaly.lowGravity.float']) break;
      const bb = bbOf(g.boxes);
      const H = bb.max[1] - bb.min[1];
      const lo = 1.85, hi = h - H - 0.15;
      if (hi < lo) continue;
      const saved = saveCoords(g.boxes);
      const dy = fy + ctx.rng.float(lo, hi) - bb.min[1];
      for (const b of g.boxes) moveBox(b, ctx.rng.float(-0.05, 0.05), dy, ctx.rng.float(-0.05, 0.05));
      const others = interiorSolids(cell, new Set(g.boxes));
      if (g.boxes.some((b) => b.solid && others.some((o) => overlaps(o, b, 0.05))) || !ctx.reachOk()) { loadCoords(g.boxes, saved); continue; }
      floated++;
    }
    // 宙を漂う紙（当たらない）
    const area = ctx.rects.reduce((a, r) => a + rectArea(r), 0);
    for (let i = 0, n = Math.min(30, Math.round(area / 2)); i < n; i++) {
      const r = ctx.rng.pick(ctx.rects);
      const x = ctx.rng.float(r.x0 + 0.3, r.x1 - 0.3), z = ctx.rng.float(r.z0 + 0.3, r.z1 - 0.3), y = fy + ctx.rng.float(0.6, h - 0.3);
      const along = ctx.rng.chance(0.5);
      const b = box([x - (along ? 0.15 : 0.105), y, z - (along ? 0.105 : 0.15)], [x + (along ? 0.15 : 0.105), y + 0.003, z + (along ? 0.105 : 0.15)], 'signPlate', false);
      b.kind = 'floatingPaper';
      ctx.addBox(b);
    }
  },
});
