/**
 * 水と物で埋まる異変: 浸水（壁から壁まで膝の深さの水）・物の海（膝まで転がる玉）。
 */
import { box, type Box, type Json, type MatId } from '../../../world/layout.ts';
import { defineAnomaly } from '../types.ts';
import { doorFronts, hitsAny, insideRects, interiorSolids, isFloorFixture, overlaps, rectArea } from '../util.ts';

/** 水のある作り（プール）。浸水・物の海を重ねない */
const WET_THEMES = new Set(['PoolCorridor']);

/** 浸水: 壁から壁まで膝の深さの水。家具は水に立つ。歩くと遅い。水面には紙が浮く */
defineAnomaly({
  id: 'flood', name: '浸水', weight: 1, intensity: 1, kinds: ['room', 'hall'],
  // プールの作り（中身が床に水槽を沈める）・プールのフロア（水は水槽に入れる決まり。tests/dress-water）・もう水のある部屋には掛けない
  fits: (g, f) => f.family !== 'pool' && !WET_THEMES.has(g.cell.theme ?? '') && !g.cell.boxes.some(isFloorFixture),
  pre(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY;
    const depth = ctx.rng.float(t['anomaly.flood.depthMin'], Math.max(t['anomaly.flood.depthMin'], t['anomaly.flood.depthMax']));
    ctx.memo.depth = depth;
    // 壁の室内面まで（壁が水を受け止める）。水面は描画側が上面だけ描く。歩く速さを落とすゾーンも同じ範囲に
    for (const r of ctx.rects) {
      const b = box([r.x0, fy + 0.01, r.z0], [r.x1, fy + depth, r.z1], 'waterShallow', false);
      b.kind = 'flood';
      ctx.addBox(b);
      ctx.addZone({ kind: 'water', aabb: { min: [r.x0, fy - 0.1, r.z0], max: [r.x1, fy + depth + 0.1, r.z1] }, params: { slow: t['anomaly.flood.slow'], depth } });
    }
    // 床は水の下で濡れ、壁も湿っている（足音・環境音は「濡れた部屋」になる）
    cell.render = { ...cell.render, floorWetness: 1, wetness: Math.max(cell.render?.wetness ?? 0, 0.35) };
  },
  post(ctx) {
    // 水面に浮かぶ紙（当たらない薄い板）。家具の上には浮かべない
    const depth = Number(ctx.memo.depth ?? 0.35);
    const fy = ctx.cell.floorY, y = fy + depth + 0.003;
    const solids = interiorSolids(ctx.cell);
    const area = ctx.rects.reduce((a, r) => a + rectArea(r), 0);
    const n = Math.min(24, Math.round(area / 3));
    for (let i = 0, made = 0; i < n * 4 && made < n; i++) {
      const r = ctx.rng.pick(ctx.rects);
      const along = ctx.rng.chance(0.5);
      const w = along ? 0.297 : 0.21, d = along ? 0.21 : 0.297;
      const x = ctx.rng.float(r.x0 + 0.3, r.x1 - 0.3), z = ctx.rng.float(r.z0 + 0.3, r.z1 - 0.3);
      const b = box([x - w / 2, y, z - d / 2], [x + w / 2, y + 0.004, z + d / 2], ctx.rng.chance(0.8) ? 'signPlate' : 'boxCardboard', false);
      // 水面を貫いている当たる物（脚の太い家具・棚）に重ねない
      if (solids.some((s) => s.min[1] < y + 0.02 && s.max[1] > y - 0.02 && overlaps(s, { min: [b.min[0], s.min[1], b.min[2]], max: [b.max[0], s.max[1], b.max[2]] }, 0.05))) continue;
      b.kind = 'floatingPaper';
      ctx.addBox(b);
      made++;
    }
  },
});

/** 玉の色（遊び場のボールプール） */
const BALL_MATS: MatId[] = ['plasticRed', 'plasticYellow', 'plasticBlue', 'paintWhite', 'plasticBlue', 'plasticRed'];

/**
 * 物の海: 膝まで転がる玉で埋まっている（押し分けて進む）。家具はそのまま玉から突き出る。
 * 玉は剛体（propPile）。数は anomaly.ballSea.max まで。入口から遠い所から敷き詰め、開口の前は空ける（浜辺のように入口の前だけ床が見える）
 */
defineAnomaly({
  id: 'ballSea', name: '物の海', weight: 0.7, intensity: 2, kinds: ['room', 'hall'], physics: true, minSize: [3.6, 4], maxArea: 80,
  fits: (g) => !WET_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    if (ctx.cell.boxes.some(isFloorFixture)) return false;
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY;
    const s0 = t['anomaly.ballSea.sizeMin'], s1 = Math.max(s0, t['anomaly.ballSea.sizeMax']);
    const doors = doorFronts(cell, ctx.geo.openings, t['anomaly.ballSea.doorClear'], 0.45);
    const solids = interiorSolids(cell);
    const pitch = s1 + 0.02;
    const ent = ctx.entrance.pos;
    interface Ball { b: Box; far: number }
    const cand: Ball[] = [];
    const tryBall = (x: number, z: number, d: number, y0: number): void => {
      const b = box([x - d / 2, y0, z - d / 2], [x + d / 2, y0 + d, z + d / 2], ctx.rng.pick(BALL_MATS), false);
      if (!insideRects(ctx.rects, b, 0.02) || hitsAny(doors, b) || solids.some((s) => overlaps(s, b, 0.02))) return;
      cand.push({ b, far: Math.hypot(x - ent[0], z - ent[2]) });
    };
    // 1 段目: 床に並べる（少し揺らす）。2 段目: 1 段目のくぼみに半分ほど
    for (const r of ctx.rects) {
      const nx = Math.floor((r.x1 - r.x0) / pitch), nz = Math.floor((r.z1 - r.z0) / pitch);
      const ox = r.x0 + (r.x1 - r.x0 - nx * pitch) / 2, oz = r.z0 + (r.z1 - r.z0 - nz * pitch) / 2;
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        tryBall(ox + (i + 0.5) * pitch + ctx.rng.float(-0.02, 0.02), oz + (k + 0.5) * pitch + ctx.rng.float(-0.02, 0.02), ctx.rng.float(s0, s1), fy + 0.005);
      }
    }
    const first = cand.length;
    for (const r of ctx.rects) {
      const nx = Math.floor((r.x1 - r.x0) / pitch) - 1, nz = Math.floor((r.z1 - r.z0) / pitch) - 1;
      const ox = r.x0 + (r.x1 - r.x0 - (nx + 1) * pitch) / 2 + pitch, oz = r.z0 + (r.z1 - r.z0 - (nz + 1) * pitch) / 2 + pitch;
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        if (ctx.rng.chance(0.5)) tryBall(ox + i * pitch, oz + k * pitch, ctx.rng.float(s0, s1) * 0.9, fy + s0 * 0.7);
      }
    }
    // 床の 3 割も埋まらない部屋（棚の並ぶ部屋など）は「物の海」に見えないので掛けない
    const area = ctx.rects.reduce((a, r) => a + rectArea(r), 0);
    if (first < 8 || (first * s1 * s1) / area < 0.3) return false;
    // 数の上限: 1 段目を入口から遠い順に、余れば 2 段目
    const max = t['anomaly.ballSea.max'];
    const lower = cand.slice(0, first).sort((a, b) => b.far - a.far).slice(0, max);
    const upper = cand.slice(first).filter((u) => lower.some((l) => overlaps(l.b, u.b, 0.05))).sort((a, b) => b.far - a.far).slice(0, Math.max(0, max - lower.length));
    const items: Json[] = [...lower, ...upper].map((x) => ({ min: [...x.b.min], max: [...x.b.max], mat: x.b.mat, kind: 'ball' }));
    ctx.addEntity('balls', { type: 'propPile', params: { items, ball: true, density: 60, friction: 0.35, restitution: 0.25, rollDamping: 1.6 } });
    // 玉を押し分けて進むので遅い（水の足音にはしない: dry）
    for (const r of ctx.rects) ctx.addZone({ kind: 'water', aabb: { min: [r.x0, fy - 0.1, r.z0], max: [r.x1, fy + 0.6, r.z1] }, params: { slow: 0.7, dry: true } });
  },
});
