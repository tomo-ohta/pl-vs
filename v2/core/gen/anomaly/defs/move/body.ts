/**
 * 移動と身体の異変（部屋まるごと）:
 * - heavyRoom 重い部屋 [M19 高重力の部屋]: 重さが 1.6〜1.85 倍（跳んでも低く、歩きも重い）。家具は押し潰されたように背が低く、
 *     脚の下の床がへこんでひびが入っている（開けた瞬間に「重い」と分かる）
 * - underwater 水の中の部屋 [M22 水中を歩く]: 部屋ごと水の中。動きが鈍く（遅い・落ちるのがゆっくり・ふわりと跳ぶ）、音がこもる
 *     （環境音が遠い水圧の音）。天井に水面のゆらぎ、泡、床から伸びる水草、青い霧
 */
import { box, type Box, type MatId } from '../../../../world/layout.ts';
import { defineAnomaly } from '../../types.ts';
import { bbOf, doorFronts, hitsAny, interiorSolids, isFloorFixture, loadCoords, mixColor, objectGroups, overlaps, rectArea, saveCoords } from '../../util.ts';

/** 水のある作り（プール）。水の異変を重ねない */
const WET_THEMES = new Set(['PoolCorridor']);

defineAnomaly({
  id: 'heavyRoom', name: '重い部屋', weight: 0.8, intensity: 1, kinds: ['room', 'hall'], needsFurniture: true,
  pre(ctx) {
    const t = ctx.tuning, fy = ctx.cell.floorY, h = ctx.cell.height;
    const scale = ctx.rng.float(t['move.heavy.scaleMin'], Math.max(t['move.heavy.scaleMin'], t['move.heavy.scaleMax']));
    ctx.memo.scale = scale;
    for (const r of ctx.rects) ctx.addZone({ kind: 'gravity', aabb: { min: [r.x0, fy - 0.1, r.z0], max: [r.x1, fy + h, r.z1] }, params: { scale, slow: t['move.heavy.slow'] } });
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const groups = objectGroups(ctx.furniture, cell);
    let squashed = 0;
    for (const g of groups) {
      const bb = bbOf(g.boxes);
      // 床に置いた物だけ（壁の棚・天井から下がる物は除く）
      if (bb.min[1] > fy + 0.05 || g.boxes.some((b) => b.slope)) continue;
      // 腰の高さ（0.6 m）より上だけを押し縮める（座面・低い天板は高さのまま: 低くして跨げる段にしない）
      const k = ctx.rng.float(0.45, 0.65);
      const keep = fy + 0.6;
      if (bb.max[1] < keep + 0.25) continue;
      const sq = (v: number): number => (v <= keep ? v : keep + (v - keep) * k);
      const saved = saveCoords(g.boxes);
      for (const b of g.boxes) { b.min = [b.min[0], sq(b.min[1]), b.min[2]]; b.max = [b.max[0], sq(b.max[1]), b.max[2]]; }
      if (!ctx.reachOk()) { loadCoords(g.boxes, saved); continue; }
      squashed++;
      // 脚の下の床のへこみ（物の形より少し大きい影）と、そこから伸びるひび
      const dent = box([bb.min[0] - 0.06, fy + 0.001, bb.min[2] - 0.06], [bb.max[0] + 0.06, fy + 0.004, bb.max[2] + 0.06], 'shadowDecal', false);
      dent.kind = 'pressDent';
      ctx.addBox(dent);
      for (let i = 0; i < 3; i++) {
        const along = ctx.rng.chance(0.5);
        const len = ctx.rng.float(0.4, 1.1);
        const x = along ? (ctx.rng.chance(0.5) ? bb.max[0] + 0.05 : bb.min[0] - 0.05 - len) : ctx.rng.float(bb.min[0], bb.max[0]);
        const z = along ? ctx.rng.float(bb.min[2], bb.max[2]) : (ctx.rng.chance(0.5) ? bb.max[2] + 0.05 : bb.min[2] - 0.05 - len);
        const c = box([x, fy + 0.002, z], along ? [x + len, fy + 0.005, z + 0.015] : [x + 0.015, fy + 0.005, z + len], 'shadowDecal', false);
        c.kind = 'floorCrack';
        ctx.addBox(c);
      }
    }
    // 潰せる物が無い部屋は取り消す（重いだけでは見て分からない）
    if (squashed === 0) return false;
    // 天井の照明の明るさを少し落とす（重さで垂れたように低い位置へ）
    cell.lights = cell.lights.map((l) => ({ ...l, pos: [l.pos[0], Math.max(fy + 1.9, l.pos[1] - 0.25), l.pos[2]] }));
  },
});

defineAnomaly({
  id: 'underwater', name: '水の中の部屋', weight: 0.8, intensity: 2, kinds: ['room', 'hall'], minHeight: 2.4,
  // プールのフロア・水のある作りには重ねない（水槽の決まり tests/dress-water）・床の造作のある部屋にも
  fits: (g, f) => f.family !== 'pool' && !WET_THEMES.has(g.cell.theme ?? '') && !g.cell.boxes.some(isFloorFixture),
  pre(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    for (const r of ctx.rects) {
      // 水槽の無い水: dry（水面の箱が無い）+ submerged（水の足音）。遅い・落ちるのがゆっくり
      ctx.addZone({ kind: 'water', aabb: { min: [r.x0, fy - 0.1, r.z0], max: [r.x1, fy + h, r.z1] }, params: { dry: true, submerged: true, slow: t['move.underwater.slow'], drag: t['move.underwater.drag'] } });
      ctx.addZone({ kind: 'gravity', aabb: { min: [r.x0, fy - 0.1, r.z0], max: [r.x1, fy + h, r.z1] }, params: { scale: t['move.underwater.gravity'] } });
      // 天井の下の水面（ゆらぐ膜）
      const top = box([r.x0, fy + h - 0.06, r.z0], [r.x1, fy + h - 0.04, r.z1], 'waterFilm', false);
      top.kind = 'waterCeiling';
      ctx.addBox(top);
    }
    cell.render = { ...cell.render, fog: { color: 0x1d5466, near: 0.6, far: t['move.underwater.fogFar'] }, floorWetness: 1, wetness: Math.max(cell.render?.wetness ?? 0, 0.6), colorMask: [0.72, 0.9, 1.0] };
    // 音がこもる: 環境音は遠い水圧と遠い空調だけ
    cell.audioPreset = '遠い水圧・遠い空調';
    cell.lights = cell.lights.map((l) => ({ ...l, color: mixColor(l.color, 0x6fb6d8, 0.6), intensity: l.intensity * 0.85 }));
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const doors = doorFronts(cell, ctx.geo.openings, 1.4, 0.4);
    const solids = interiorSolids(cell);
    const area = ctx.rects.reduce((a, r) => a + rectArea(r), 0);
    // 泡（当たらない小さな粒）: 宙のあちこちに
    for (let i = 0, n = Math.min(60, Math.round(area * 1.5)); i < n; i++) {
      const r = ctx.rng.pick(ctx.rects);
      const s = ctx.rng.float(0.015, 0.05);
      const x = ctx.rng.float(r.x0 + 0.2, r.x1 - 0.2), z = ctx.rng.float(r.z0 + 0.2, r.z1 - 0.2), y = fy + ctx.rng.float(0.3, h - 0.3);
      const b = box([x - s, y - s, z - s], [x + s, y + s, z + s], 'paintWhite', false);
      b.kind = 'bubble';
      ctx.addBox(b);
    }
    // 水草: 壁際の床から（扉の前・家具の上には置かない）
    const mats: MatId[] = ['plantLeaf', 'plant'];
    let made = 0;
    for (let i = 0; i < 40 && made < Math.min(14, Math.round(area / 3)); i++) {
      const r = ctx.rng.pick(ctx.rects);
      const edge = ctx.rng.int(0, 3);
      const x = edge === 0 ? r.x0 + 0.15 : edge === 1 ? r.x1 - 0.15 : ctx.rng.float(r.x0 + 0.3, r.x1 - 0.3);
      const z = edge === 2 ? r.z0 + 0.15 : edge === 3 ? r.z1 - 0.15 : ctx.rng.float(r.z0 + 0.3, r.z1 - 0.3);
      const tall = ctx.rng.float(0.7, Math.min(1.7, h - 0.5));
      const b: Box = box([x - 0.04, fy, z - 0.04], [x + 0.04, fy + tall, z + 0.04], ctx.rng.pick(mats), false);
      if (hitsAny(doors, b) || solids.some((sb) => overlaps(sb, b, 0.05))) continue;
      b.kind = 'waterWeed';
      ctx.addBox(b);
      made++;
    }
  },
});
