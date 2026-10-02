/**
 * 自然に埋まる異変（段階 4・oddity）: 草原・ひまわり畑（E05）・植物に覆われる（E12）・砂の部屋（E11）・室内の海（E10）・水の壁（E09）。
 * どれも部屋の家具はそのまま（「草原になった教室」「奥が海の事務所」）。草木は通り抜けられる材質（当たり判定を作らない）。
 */
import type { Dir } from '../../../../math/vec.ts';
import { along, type Rect } from '../../../../world/footprint.ts';
import { box, type Box, type Json, type MatId } from '../../../../world/layout.ts';
import { defineAnomaly, type AnomalyContext } from '../../types.ts';
import { bbOf, doorFronts, hitsAny, interiorSolids, isCeilingPanel, isFloorFixture, mainRect, mixColor, objectGroups } from '../../util.ts';
import { addGroup, aabbJ, areaOf, blockedAt, ceilingSheet, depthFrame, entranceOnMain, facesOf, faceOfOpening, floorSheet, freeSpans, front, gridPoints, roomBox, roomFx, tops, wallSheet } from './common.ts';

const WET_THEMES = new Set(['PoolCorridor']);
const dry = (theme: string | undefined): boolean => !WET_THEMES.has(theme ?? '');
const hasBasin = (ctx: AnomalyContext): boolean => ctx.cell.boxes.some((b) => b.kind === 'basin' || (isFloorFixture(b) && b.min[1] < ctx.cell.floorY - 0.05));

/** 当たる箱を足して、開口どうしがつながったままなら true（だめなら外す） */
function tryAdd(ctx: AnomalyContext, boxes: Box[], name: string): boolean {
  addGroup(ctx, boxes, name);
  if (ctx.reachOk()) return true;
  const set = new Set(boxes);
  ctx.removeBoxes((b) => set.has(b));
  return false;
}

/** 天井の照明パネルを外し、天井を空にする（点光源は残す） */
function skyCeiling(ctx: AnomalyContext, rects: readonly Rect[] = ctx.rects): void {
  const cell = ctx.cell, top = cell.floorY + cell.height;
  const inR = (b: Box): boolean => rects.some((r) => (b.min[0] + b.max[0]) / 2 > r.x0 && (b.min[0] + b.max[0]) / 2 < r.x1 && (b.min[2] + b.max[2]) / 2 > r.z0 && (b.min[2] + b.max[2]) / 2 < r.z1);
  ctx.removeBoxes((b) => isCeilingPanel(cell, b) && inR(b));
  addGroup(ctx, rects.map((r) => ceilingSheet(r, top, 'skyDay', 0.01)), 'sky');
}

// ---------------------------------------------------------------- E05 草原・ひまわり畑

/**
 * 草原: 床が一面の草、天井は青空。部屋いっぱいに、ひまわり（全部が入口の方を向く）・麦・野の花が生えている。
 * 家具はそのまま草に埋もれて立つ（草原になった教室）。草木は通り抜けられる。開口の前は空けておく
 */
defineAnomaly({
  id: 'meadow', name: '草原', weight: 0.85, intensity: 1, kinds: ['room', 'hall'], minSize: [3.4, 4], minHeight: 2.4,
  fits: (g) => dry(g.cell.theme),
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY;
    if (hasBasin(ctx)) return false;
    const kind = ctx.rng.weighted(['sunflower', 'wheat', 'flowers'] as const, (k) => t[`anomaly.meadow.${k}`]);
    ctx.memo.kind = kind;
    addGroup(ctx, ctx.rects.map((r) => floorSheet(r, fy, 'grass', 0.02)), 'lawn');
    skyCeiling(ctx);
    cell.lights = cell.lights.map((l) => ({ ...l, color: 0xfff1d8, intensity: l.intensity * 1.1 }));
    cell.palette = { ...cell.palette, lightColor: 0xfff1d8, ambient: mixColor(cell.palette.ambient, 0xb4c8dc, 0.6) };
    const doors = doorFronts(cell, ctx.geo.openings, 1.4, 0.3);
    const solids = interiorSolids(cell);
    const step = kind === 'wheat' ? 0.55 : kind === 'sunflower' ? 0.72 : 0.5;
    const e = ctx.entrance.pos;
    const B: Box[] = [];
    const max = t['anomaly.meadow.boxesMax'];
    for (const [x, z] of gridPoints(ctx, step, 0.25, step * 0.25)) {
      if (B.length >= max) break;
      if (hitsAny(doors, { min: [x - 0.15, fy, z - 0.15], max: [x + 0.15, fy + 1, z + 0.15] }) || blockedAt(solids, x, z, 0.2, fy, fy + 2.2)) continue;
      if (kind === 'sunflower') {
        const H = ctx.rng.float(1.25, 1.85);
        B.push(box([x - 0.02, fy, z - 0.02], [x + 0.02, fy + H, z + 0.02], 'plant', false));
        B.push(box([x - 0.16, fy + H * 0.45, z - 0.03], [x + 0.16, fy + H * 0.45 + 0.02, z + 0.03], 'plantLeaf', false));
        // 花は入口の方を向く（入口への向きの大きい軸に面を向ける）
        const dx = e[0] - x, dz = e[2] - z;
        const facingX = Math.abs(dx) > Math.abs(dz);
        const s = Math.sign(facingX ? dx : dz) || 1;
        const r = ctx.rng.float(0.15, 0.2);
        const off = 0.04 * s;
        B.push(facingX ? box([x + off - 0.02, fy + H - r, z - r], [x + off + 0.02, fy + H + r, z + r], 'plasticYellow', false) : box([x - r, fy + H - r, z + off - 0.02], [x + r, fy + H + r, z + off + 0.02], 'plasticYellow', false));
        const c = r * 0.45, off2 = 0.07 * s;
        B.push(facingX ? box([x + off2 - 0.025, fy + H - c, z - c], [x + off2 + 0.025, fy + H + c, z + c], 'plantSoil', false) : box([x - c, fy + H - c, z + off2 - 0.025], [x + c, fy + H + c, z + off2 + 0.025], 'plantSoil', false));
      } else if (kind === 'wheat') {
        const H = ctx.rng.float(0.75, 1.1), w = ctx.rng.float(0.45, 0.6);
        B.push(box([x - w / 2, fy, z - 0.005], [x + w / 2, fy + H, z + 0.005], 'wheat', false));
        B.push(box([x - 0.005, fy, z - w / 2], [x + 0.005, fy + H, z + w / 2], 'wheat', false));
      } else {
        const s = ctx.rng.float(0.2, 0.36);
        B.push(box([x - s / 2, fy, z - s / 2], [x + s / 2, fy + ctx.rng.float(0.15, 0.3), z + s / 2], 'grass', false));
        const mats: MatId[] = ['plasticRed', 'plasticYellow', 'paintWhite', 'plasticBlue', 'plasticYellow'];
        for (let k = ctx.rng.int(1, 3); k > 0; k--) {
          const bx = x + ctx.rng.float(-0.12, 0.12), bz = z + ctx.rng.float(-0.12, 0.12), by = fy + ctx.rng.float(0.22, 0.45);
          B.push(box([bx - 0.004, fy, bz - 0.004], [bx + 0.004, by, bz + 0.004], 'plant', false));
          B.push(box([bx - 0.035, by, bz - 0.035], [bx + 0.035, by + 0.03, bz + 0.035], ctx.rng.pick(mats), false));
        }
      }
    }
    if (B.length < 20) return false;
    addGroup(ctx, B, `meadow-${kind}`);
    roomFx(ctx, { kind: 'drift', count: 10, dir: [ctx.rng.float(-1, 1), ctx.rng.float(-1, 1)], speed: 0.35, shape: 'leaf', color: 0xf4f0d8 });
    cell.audioPreset = '鳥声・微風・虫';
    return true;
  },
});

// ---------------------------------------------------------------- E12 植物に覆われる

/**
 * 植物に覆われる: 入口のあたりは普通の部屋だが、奥へ進むほど苔・茂み・壁の蔦・天井から垂れる蔓が増え、先の開口の周りは緑に埋もれる。
 * 家具の上にも葉。植物は通り抜けられる（茂みを押し分けて進む）。奥の照明は緑がかる
 */
defineAnomaly({
  id: 'overgrowth', name: '植物に覆われる', weight: 0.85, intensity: 0, kinds: ['room', 'hall'], minSize: [3.4, 4.5],
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const e = front(ctx.entrance, 0.5);
    const pts = gridPoints(ctx, 0.5, 0.25, 0.12);
    const D = Math.max(3, ...pts.map(([x, z]) => Math.hypot(x - e[0], z - e[1])));
    const dens = (x: number, z: number): number => Math.min(1, (Math.hypot(x - e[0], z - e[1]) / D) ** 1.4 * 1.15);
    const doors = doorFronts(cell, ctx.geo.openings, 1.2, 0.25);
    const solids = interiorSolids(cell);
    const max = t['anomaly.overgrowth.boxesMax'];
    const B: Box[] = [];
    const room = (): boolean => B.length < max;
    for (const [x, z] of pts) {
      if (!room()) break;
      const d = dens(x, z);
      // 苔
      if (ctx.rng.chance(d * 0.5)) { const s = ctx.rng.float(0.4, 0.8); B.push(box([x - s / 2, fy + 0.002, z - s / 2], [x + s / 2, fy + 0.012, z + s / 2], 'grass', false)); }
      // 茂み（背の高い物は開口の前に置かない）
      if (ctx.rng.chance(d * 0.4) && !blockedAt(solids, x, z, 0.2, fy, fy + 1)) {
        const w = ctx.rng.float(0.35, 0.75), hh = ctx.rng.float(0.25, 0.35 + 1.1 * d);
        const b = box([x - w / 2, fy, z - w / 2], [x + w / 2, fy + hh, z + w / 2], ctx.rng.chance(0.5) ? 'plant' : 'plantLeaf', false);
        if (hh < 0.6 || !hitsAny(doors, b)) B.push(b);
      }
      // 天井から垂れる蔓
      if (ctx.rng.chance(d * 0.45)) {
        const len = ctx.rng.float(0.3, 0.45 + 1.4 * d), w = ctx.rng.float(0.03, 0.07);
        B.push(box([x - w / 2, fy + h - len, z - w / 2], [x + w / 2, fy + h, z + w / 2], 'plantLeaf', false));
      }
    }
    // 壁の蔦
    for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, 0.1, 0.02, 0.2)) {
      for (let a = p; a < q - 0.1 && room(); a += ctx.rng.float(0.35, 0.7)) {
        const [x, z] = f.horizontal ? [a, f.face] : [f.face, a];
        const d = dens(x, z);
        if (!ctx.rng.chance(d * 0.9)) continue;
        const w = Math.min(q - a, ctx.rng.float(0.3, 0.9)), top = Math.min(h, ctx.rng.float(0.4, 0.6) + h * d * 1.1);
        B.push(wallSheet(f, a, a + w, fy, fy + top, 'plantLeaf', 0.01, ctx.rng.float(0.04, 0.12)));
      }
    }
    // 家具の上の葉
    for (const b of tops(ctx.furniture, fy, 0.3, 2.3, 0.05)) {
      if (!room()) break;
      const d = dens((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2);
      if (!ctx.rng.chance(d)) continue;
      B.push(box([b.min[0] + 0.02, b.max[1], b.min[2] + 0.02], [b.max[0] - 0.02, b.max[1] + ctx.rng.float(0.05, 0.2 + 0.3 * d), b.max[2] - 0.02], 'plantLeaf', false));
    }
    if (B.length < 25) return false;
    addGroup(ctx, B, 'overgrowth');
    cell.lights = cell.lights.map((l) => ({ ...l, color: mixColor(l.color, 0xb8f0a8, 0.6 * dens(l.pos[0], l.pos[2])) }));
    cell.audioPreset = '虫・葉擦れ';
    return true;
  },
});

// ---------------------------------------------------------------- E11 砂の部屋

/**
 * 砂の部屋: 天井の割れ目から細く砂が流れ落ち、床に砂の山（低い段で登れる）。床一面の砂には風紋があり、ゆっくり形を変える。
 * 家具の脚は砂に埋もれ、歩くと少し遅く、足跡が残る
 */
defineAnomaly({
  id: 'sand', name: '砂の部屋', weight: 0.7, intensity: 0, kinds: ['room', 'hall'], minSize: [3.6, 4], minHeight: 2.4,
  fits: (g) => dry(g.cell.theme),
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    if (hasBasin(ctx)) return false;
    const depth = 0.03;
    const B: Box[] = ctx.rects.map((r) => floorSheet(r, fy, 'sand', depth));
    // 壁際の砂丘・家具の足元の砂
    for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, 0.6)) {
      for (let a = p; a + 0.4 < q; a += ctx.rng.float(0.8, 1.6)) B.push(wallSheet(f, a, Math.min(q, a + ctx.rng.float(0.6, 1.4)), fy, fy + depth + ctx.rng.float(0.05, 0.14), 'sand', 0, ctx.rng.float(0.25, 0.6)));
    }
    for (const g of objectGroups(ctx.furniture, cell)) {
      const bb = bbOf(g.boxes);
      if (bb.min[1] > fy + 0.05) continue;
      B.push(box([bb.min[0] - 0.08, fy, bb.min[2] - 0.08], [bb.max[0] + 0.08, fy + depth + ctx.rng.float(0.04, 0.1), bb.max[2] + 0.08], 'sand', false));
    }
    addGroup(ctx, B, 'sand');
    // 砂の山（段の高さ 0.1 m。登れる）と、上から流れ落ちる砂
    const doors = doorFronts(cell, ctx.geo.openings, 1.6, 0.5);
    const solids = interiorSolids(cell);
    const want = Math.max(1, Math.min(3, Math.round(areaOf(ctx) / 18)));
    const streams: number[][] = [];
    const spots = ctx.rng.shuffle(gridPoints(ctx, 0.5, 1.2));
    for (const [x, z] of spots) {
      if (streams.length >= want) break;
      const R = ctx.rng.float(0.75, 1.2);
      if (streams.some((s) => Math.hypot(s[0]! - x, s[1]! - z) < R + 1.6)) continue;
      if (hitsAny(doors, { min: [x - R, fy, z - R], max: [x + R, fy + 1, z + R] }) || blockedAt(solids, x, z, R + 0.1, fy, fy + 2)) continue;
      const L = 4, P: Box[] = [];
      for (let i = 0; i < L; i++) { const s = R * (1 - i / L); P.push(box([x - s, fy + i * 0.1, z - s], [x + s, fy + (i + 1) * 0.1, z + s], 'sand', true)); }
      if (!tryAdd(ctx, P, `dune${streams.length}`)) continue;
      addGroup(ctx, [ceilingSheet({ x0: x - 0.25, z0: z - 0.06, x1: x + 0.25, z1: z + 0.06 }, fy + h, 'shadowDecal')], `crack${streams.length}`);
      streams.push([x, z, 0.03, fy + L * 0.1, fy + h]);
    }
    for (const r of ctx.rects) ctx.addZone({ kind: 'water', aabb: { min: [r.x0, fy - 0.1, r.z0], max: [r.x1, fy + 0.6, r.z1] }, params: { slow: t['anomaly.sand.slow'], dry: true } });
    const room = roomBox(ctx);
    ctx.addEntity('trail', { type: 'oddTrail', params: { aabb: aabbJ({ min: room.min, max: [room.max[0], fy + 0.8, room.max[2]] }), rects: ctx.rects.map((r) => ({ ...r })), y: fy + depth, max: t['anomaly.snow.prints'], color: 0x9a8262, opacity: 0.45 } });
    roomFx(ctx,
      { kind: 'ripples', y: fy + depth + 0.002, color: 0xb89c6c, speed: t['anomaly.sand.shift'] },
      { kind: 'dust', count: Math.min(260, Math.round(areaOf(ctx) * 4)), color: 0xe6d2a4, opacity: 0.5 },
      ...(streams.length ? [{ kind: 'streams', items: streams, color: 0xd9c28f, opacity: 0.85, speed: 1.8 }] : []),
    );
    cell.lights = cell.lights.map((l) => ({ ...l, color: mixColor(l.color, 0xffe2b0, 0.45) }));
    cell.palette = { ...cell.palette, ambient: mixColor(cell.palette.ambient, 0xb8a080, 0.4) };
    cell.audioPreset = '微かな紙擦れ・微風';
    return true;
  },
});

// ---------------------------------------------------------------- E10 室内の海

/**
 * 室内の海: 入口の側は砂浜、部屋の奥は海（膝より深い水）。奥の壁と天井は空と水平線。波が寄せては返し、寄せる間は浜へ押し戻される。
 * 奥の家具は海に立っている。先の開口が海の側にあれば、水をかき分けて進む
 */
defineAnomaly({
  id: 'sea', name: '室内の海', weight: 0.7, intensity: 1, kinds: ['room', 'hall'], minSize: [3.6, 5], minHeight: 2.4,
  fits: (g, f) => f.family !== 'pool' && dry(g.cell.theme),
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY;
    if (hasBasin(ctx)) return false;
    const main = mainRect(cell);
    const ent = ctx.entrance;
    // 入口が主の矩形の壁に無ければ（L 字の脇の矩形）掛けない
    if (!entranceOnMain(ctx)) return false;
    const F = depthFrame(main, ent.dir);
    const shore = Math.max(1.8, F.depth * ctx.rng.float(0.36, 0.48));
    if (F.depth - shore < 2.4) return false;
    const deep = t['anomaly.sea.depth'];
    const shallowR = F.rect(shore, shore + 1.0), seaR = F.rect(shore + 1.0, F.depth), beachR = F.rect(0, shore), wet = F.rect(shore, F.depth);
    const B: Box[] = [floorSheet(beachR, fy, 'sand', 0.02)];
    const shallow = box([shallowR.x0, fy + 0.01, shallowR.z0], [shallowR.x1, fy + 0.16, shallowR.z1], 'waterShallow', false);
    const sea = box([seaR.x0, fy + 0.01, seaR.z0], [seaR.x1, fy + deep, seaR.z1], 'waterShallow', false);
    shallow.kind = sea.kind = 'flood';
    B.push(shallow, sea);
    // 浜の貝殻・流木
    for (let i = 0; i < 7; i++) {
      const x = ctx.rng.float(beachR.x0 + 0.3, beachR.x1 - 0.3), z = ctx.rng.float(beachR.z0 + 0.3, beachR.z1 - 0.3);
      B.push(i < 5 ? box([x - 0.04, fy + 0.02, z - 0.03], [x + 0.04, fy + 0.045, z + 0.03], 'paintWhite', false) : box([x - 0.5, fy + 0.02, z - 0.06], [x + 0.5, fy + 0.12, z + 0.06], 'furnitureDark', false));
    }
    // 奥の壁・横の壁の海の側: 下は水平線の青、上は空。天井の海の側も空
    const far = ((ent.dir + 2) % 4) as Dir;
    for (const f of facesOf(ctx)) {
      const onFar = f.dir === far;
      const side = f.dir % 2 !== ent.dir % 2;
      if (!onFar && !side) continue;
      for (const [p, q] of freeSpans(ctx, f, 0.1, 0.02, 0.2)) {
        let a0 = p, a1 = q;
        if (side) {
          // 横の壁は海の側だけ
          const lo = ent.dir % 2 === 0 ? wet.z0 : wet.x0, hi = ent.dir % 2 === 0 ? wet.z1 : wet.x1;
          a0 = Math.max(p, lo); a1 = Math.min(q, hi);
          if (a1 - a0 < 0.3) continue;
        }
        B.push(wallSheet(f, a0, a1, fy, fy + 0.95, 'aquariumBlue'), wallSheet(f, a0, a1, fy + 0.95, fy + cell.height, 'skyDay'));
      }
    }
    addGroup(ctx, B, 'sea');
    skyCeiling(ctx, [wet]);
    ctx.addZone({ kind: 'water', aabb: { min: [shallowR.x0, fy - 0.1, shallowR.z0], max: [shallowR.x1, fy + 0.3, shallowR.z1] }, params: { slow: 0.8, depth: 0.15 } });
    ctx.addZone({ kind: 'water', aabb: { min: [seaR.x0, fy - 0.1, seaR.z0], max: [seaR.x1, fy + deep + 0.1, seaR.z1] }, params: { slow: t['anomaly.sea.slow'], depth: deep } });
    // 波: 寄せる間だけ浜へ押し戻す（入口の向き）
    const [ox, oz] = ent.dir === 0 ? [0, 1] : ent.dir === 1 ? [1, 0] : ent.dir === 2 ? [0, -1] : [-1, 0];
    ctx.addEntity('waves', {
      type: 'oddWaves',
      params: {
        aabb: aabbJ({ min: [wet.x0, fy - 0.1, wet.z0], max: [wet.x1, fy + 1.2, wet.z1] }), vector: [ox, 0, oz], speed: t['anomaly.sea.push'], period: t['anomaly.sea.period'], surge: 2.4,
        sea: { x0: shallowR.x0, z0: shallowR.z0, x1: shallowR.x1, z1: shallowR.z1 }, dir: [ox, 0, oz], reach: 0.9, y: fy + 0.16,
      },
    });
    cell.render = { ...cell.render, floorWetness: 1, wetness: Math.max(cell.render?.wetness ?? 0, 0.2) };
    cell.lights = cell.lights.map((l) => ({ ...l, color: mixColor(l.color, 0xf0f6ff, 0.5) }));
    cell.palette = { ...cell.palette, ambient: mixColor(cell.palette.ambient, 0x9cc4d8, 0.5) };
    cell.audioPreset = '波音・微風';
    return true;
  },
});

// ---------------------------------------------------------------- E09 水の壁

/**
 * 水の壁: 部屋の壁一面を水が流れ落ちている（壁が水面）。開口の内側には水の幕が下りていて、くぐると画面が揺らぐ。
 * 壁際の床には水が溜まり、床は濡れて照明が映る
 */
defineAnomaly({
  id: 'waterWall', name: '水の壁', weight: 0.7, intensity: 1, kinds: ['room', 'hall'], minHeight: 2.3,
  fits: (g, f) => dry(g.cell.theme) && f.family !== 'pool',
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const B: Box[] = [];
    for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, 0.06, 0, 0.1)) {
      B.push(wallSheet(f, p, q, fy, fy + h, 'waterFilm', 0.006, 0.014));
      B.push(wallSheet(f, p, q, fy + 0.005, fy + 0.035, 'waterShallow', 0.01, 0.28));
    }
    const fx: { [k: string]: Json }[] = [];
    for (const o of ctx.geo.openings) {
      const f = faceOfOpening(ctx, o);
      if (!f) continue;
      const at = along(o.dir, o.pos[0], o.pos[2]);
      const base = o.pos[1] + (o.sill ?? 0);
      B.push(wallSheet(f, at - o.width / 2 - 0.05, at + o.width / 2 + 0.05, base, base + o.height + 0.04, 'waterWall', 0.02, 0.17));
      const [x0, z0] = front(o, -0.2), [x1, z1] = front(o, 0.45);
      const hw = o.width / 2 + 0.1;
      const alongX = o.dir === 0 || o.dir === 2;
      fx.push({ kind: 'grade', aabb: aabbJ(alongX ? { min: [o.pos[0] - hw, base - 0.5, Math.min(z0, z1)], max: [o.pos[0] + hw, base + o.height + 0.5, Math.max(z0, z1)] } : { min: [Math.min(x0, x1), base - 0.5, o.pos[2] - hw], max: [Math.max(x0, x1), base + o.height + 0.5, o.pos[2] + hw] }), grade: { ripple: 1, haze: { color: 0x3a7a80, amount: 0.35 }, saturation: 0.8 } });
    }
    if (B.length < 4) return false;
    addGroup(ctx, B, 'waterWall');
    cell.render = { ...cell.render, floorWetness: 1, wetness: Math.max(cell.render?.wetness ?? 0, 0.45) };
    cell.lights = cell.lights.map((l) => ({ ...l, color: mixColor(l.color, 0xa8e0e8, 0.35) }));
    cell.palette = { ...cell.palette, ambient: mixColor(cell.palette.ambient, 0x5a8a90, 0.35) };
    roomFx(ctx, { kind: 'grade', grade: { tint: [0.93, 1.0, 1.06] } }, ...fx);
    cell.audioPreset = '水音・水滴';
    return true;
  },
});
