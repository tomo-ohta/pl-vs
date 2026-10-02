/**
 * 天気と空気の異変（段階 4・oddity）: 煙の層（E02）・雨漏り（E03）・雪の室内（E04）・風の向き（E08）・温度（E07）。
 * どれも部屋の家具はそのまま（「雪の積もった事務所」「雨の降る教室」）。見た目の動き（粒・煙・画面の色）は部品 oddRoom の描画。
 */
import { box, type Box, type Json, type MatId } from '../../../../world/layout.ts';
import { defineAnomaly, type AnomalyContext } from '../../types.ts';
import { doorFronts, hitsAny, interiorSolids, isCeilingPanel, mixColor } from '../../util.ts';
import { addGroup, aabbJ, areaOf, blockedAt, ceilingSheet, facesOf, floorSheet, forwardOpening, freeSpans, front, gridPoints, roomBox, roomFx, tops, wallSheet } from './common.ts';

/** 水のある作り（プール）には水・雪を重ねない */
const WET_THEMES = new Set(['PoolCorridor']);
const dry = (theme: string | undefined): boolean => !WET_THEMES.has(theme ?? '');

/** 入口から遠い順の、当たる物にも開口の前にも掛からない床の点 */
function farSpots(ctx: AnomalyContext, r: number, step = 0.5): [number, number][] {
  const solids = interiorSolids(ctx.cell);
  const doors = doorFronts(ctx.cell, ctx.geo.openings, 1.6, 0.4);
  const e = ctx.entrance.pos;
  return gridPoints(ctx, step, 0.3 + r)
    .filter(([x, z]) => !blockedAt(solids, x, z, r + 0.05) && !hitsAny(doors, { min: [x - r, ctx.cell.floorY, z - r], max: [x + r, ctx.cell.floorY + 1, z + r] }))
    .sort((a, b) => Math.hypot(b[0] - e[0], b[1] - e[2]) - Math.hypot(a[0] - e[0], a[1] - e[2]));
}

/** 当たる箱を足して、開口どうしがつながったままなら true（だめなら外す） */
function tryAdd(ctx: AnomalyContext, boxes: Box[], name: string): boolean {
  addGroup(ctx, boxes, name);
  if (ctx.reachOk()) return true;
  const set = new Set(boxes);
  ctx.removeBoxes((b) => set.has(b));
  return false;
}

// ---------------------------------------------------------------- E02 煙の層

/**
 * 煙の層: 天井から床上 1.15〜1.3 m まで煙が溜まっている。扉を開けると部屋の上半分が灰色に埋まっている。
 * 立つと目が煙の中（霧が濃く前が見えない）、しゃがむと煙の下がよく見える。床近くの緑の誘導灯が先の開口へ続く。
 * 奥にくすぶるごみ箱（火の気だけ。体力は減らさない）。照明は煙で橙にくすむ
 */
defineAnomaly({
  id: 'smoke', name: '煙の層', weight: 0.8, intensity: 1, kinds: ['room', 'hall'], minHeight: 2.5, minSize: [3.4, 4],
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const y0 = fy + ctx.rng.float(t['anomaly.smoke.bottomMin'], Math.max(t['anomaly.smoke.bottomMin'], t['anomaly.smoke.bottomMax']));
    cell.lights = cell.lights.map((l) => ({ ...l, color: mixColor(l.color, 0xff8a40, 0.55), intensity: l.intensity * 0.75 }));
    cell.palette = { ...cell.palette, lightColor: mixColor(cell.palette.lightColor, 0xff9a50, 0.45), ambient: mixColor(cell.palette.ambient, 0x3a2a20, 0.6), lightIntensity: cell.palette.lightIntensity * 0.8 };
    const fx: { [k: string]: Json }[] = [{ kind: 'smoke', y0, y1: fy + h, color: 0x6c6862, far: t['anomaly.smoke.far'], layers: 5 }];
    // くすぶるごみ箱（奥）: 箱 + 燠火の光 + 立ちのぼる煙の筋
    const spot = farSpots(ctx, 0.3)[0];
    if (spot) {
      const [x, z] = spot;
      const B: Box[] = [box([x - 0.2, fy, z - 0.2], [x + 0.2, fy + 0.6, z + 0.2], 'metalDark', true), box([x - 0.17, fy + 0.6, z - 0.17], [x + 0.17, fy + 0.62, z + 0.17], 'lightWarm', false)];
      if (tryAdd(ctx, B, 'smolder')) {
        cell.lights.push({ pos: [x, fy + 0.9, z], color: 0xff6a20, intensity: 0.45, distance: 3.5 });
        fx.push({ kind: 'streams', items: [[x, z, 0.07, fy + 0.62, y0 + 0.2]], color: 0x77716b, opacity: 0.45, speed: -0.6 });
      }
    }
    // 床近くの誘導灯: 入口の前から、先の開口の前まで（緑の小さな点）。開口の脇には低い非常口の灯り
    const fwd = forwardOpening(ctx);
    if (fwd) {
      const [ax, az] = front(ctx.entrance, 0.9), [bx, bz] = front(fwd, 0.9);
      const pts: [number, number][] = [];
      const leg = (x0: number, z0: number, x1: number, z1: number): void => {
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9));
        for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
      };
      if (ctx.entrance.dir === 0 || ctx.entrance.dir === 2) { leg(ax, az, ax, bz); leg(ax, bz, bx, bz); } else { leg(ax, az, bx, az); leg(bx, az, bx, bz); }
      const solids = interiorSolids(cell);
      const dots = pts.filter(([x, z]) => !blockedAt(solids, x, z, 0.08, fy - 0.1, fy + 0.2)).map(([x, z]) => box([x - 0.06, fy + 0.003, z - 0.06], [x + 0.06, fy + 0.012, z + 0.06], 'lightGreen', false));
      addGroup(ctx, dots, 'guideDots');
    }
    for (const f of facesOf(ctx)) {
      for (const o of ctx.geo.openings) {
        if (o.dir !== f.dir || Math.abs((o.dir === 0 || o.dir === 2 ? o.pos[2] : o.pos[0]) - f.coord) > 0.05) continue;
        const at = (o.dir === 0 || o.dir === 2 ? o.pos[0] : o.pos[2]) + o.width / 2 + 0.25;
        if (at + 0.2 > f.a1 - 0.15) continue;
        addGroup(ctx, [wallSheet(f, at - 0.16, at + 0.16, fy + 0.3, fy + 0.45, 'signEmissive', 0.01, 0.04)], `lowExit@${o.id}`);
      }
    }
    roomFx(ctx, ...fx);
    cell.audioPreset = '低い換気扇・微かな電子音';
    return true;
  },
});

// ---------------------------------------------------------------- E03 雨漏り

/**
 * 雨漏り: 天井から部屋じゅうに雨が降っている（雨の筋・床の波紋）。天井に雨染み、その下に水たまり（机の上にも）とバケツ。
 * 水たまりを踏むと水の足音（少し遅い）。床は濡れて照明が映る
 */
defineAnomaly({
  id: 'leak', name: '雨漏り', weight: 0.9, intensity: 0, kinds: ['room', 'hall'],
  // プールのフロアは水を水槽に入れる決まり（水のゾーンは水槽だけ。tests/dress-water）
  fits: (g, f) => dry(g.cell.theme) && f.family !== 'pool',
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    if (cell.boxes.some((b) => b.kind === 'basin')) return false;
    const area = areaOf(ctx);
    const want = Math.max(3, Math.min(t['anomaly.leak.dripsMax'], Math.round(area / 5)));
    const doors = doorFronts(cell, ctx.geo.openings, 1.2, 0.3);
    const solids = interiorSolids(cell);
    const furnTops = tops(ctx.furniture, fy, 0.4, 1.3, 0.12).filter((b) => b.solid);
    const pts = ctx.rng.shuffle(gridPoints(ctx, 0.8, 0.5, 0.2));
    const chosen: [number, number][] = [];
    let i = 0, puddles = 0;
    for (const [x, z] of pts) {
      // 水たまりができた所だけ数える（机の下・物の下で水たまりが置けない所は飛ばす）
      if (puddles >= want) break;
      if (chosen.some(([a, b]) => Math.hypot(a - x, b - z) < 1.4)) continue;
      const top0 = furnTops.find((b) => x > b.min[0] + 0.1 && x < b.max[0] - 0.1 && z > b.min[2] + 0.1 && z < b.max[2] - 0.1);
      if (!top0 && blockedAt(solids, x, z, 0.3, fy - 0.1, fy + 0.3)) continue;
      chosen.push([x, z]);
      puddles++;
      i++;
      const s = ctx.rng.float(0.45, 0.9);
      addGroup(ctx, [ceilingSheet({ x0: x - s / 2, z0: z - s / 2, x1: x + s / 2, z1: z + s / 2 }, fy + h, 'shadowDecal')], `stain${i}`);
      // 下に机があれば机の上に、無ければ床に水たまり
      const top = furnTops.find((b) => x > b.min[0] + 0.1 && x < b.max[0] - 0.1 && z > b.min[2] + 0.1 && z < b.max[2] - 0.1);
      if (top) {
        const w = Math.min(0.5, top.max[0] - top.min[0] - 0.1), d = Math.min(0.5, top.max[2] - top.min[2] - 0.1);
        addGroup(ctx, [box([Math.max(top.min[0] + 0.03, x - w / 2), top.max[1] + 0.002, Math.max(top.min[2] + 0.03, z - d / 2)], [Math.min(top.max[0] - 0.03, x + w / 2), top.max[1] + 0.006, Math.min(top.max[2] - 0.03, z + d / 2)], 'puddle', false)], `deskPuddle${i}`);
        continue;
      }
      const pw = ctx.rng.float(0.7, 1.5), pd = ctx.rng.float(0.6, 1.3);
      const pr = { x0: x - pw / 2, z0: z - pd / 2, x1: x + pw / 2, z1: z + pd / 2 };
      for (const r of ctx.rects) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) { pr.x0 = Math.max(pr.x0, r.x0 + 0.05); pr.x1 = Math.min(pr.x1, r.x1 - 0.05); pr.z0 = Math.max(pr.z0, r.z0 + 0.05); pr.z1 = Math.min(pr.z1, r.z1 - 0.05); }
      addGroup(ctx, [floorSheet(pr, fy + 0.002, 'puddle', 0.004)], `puddle${i}`);
      ctx.addZone({ kind: 'water', aabb: { min: [pr.x0, fy - 0.1, pr.z0], max: [pr.x1, fy + 0.3, pr.z1] }, params: { slow: t['anomaly.leak.slow'] } });
      // バケツ（当たる。通り道を塞ぐなら置かない）
      if (ctx.rng.chance(0.45)) {
        const bx = x + ctx.rng.float(-0.15, 0.15), bz = z + ctx.rng.float(-0.15, 0.15);
        const bb = { min: [bx - 0.16, fy, bz - 0.16] as [number, number, number], max: [bx + 0.16, fy + 0.3, bz + 0.16] as [number, number, number] };
        if (!hitsAny(doors, bb) && !blockedAt(solids, bx, bz, 0.25)) {
          tryAdd(ctx, [box(bb.min, bb.max, 'plasticBlue', true), box([bx - 0.13, fy + 0.3, bz - 0.13], [bx + 0.13, fy + 0.302, bz + 0.13], 'puddle', false)], `bucket${i}`);
        }
      }
    }
    cell.render = { ...cell.render, floorWetness: 0.85, wetness: Math.max(cell.render?.wetness ?? 0, 0.3) };
    cell.lights = cell.lights.map((l) => ({ ...l, intensity: l.intensity * 0.85, color: mixColor(l.color, 0xb8c8d8, 0.3) }));
    cell.palette = { ...cell.palette, ambient: mixColor(cell.palette.ambient, 0x506070, 0.4) };
    roomFx(ctx, { kind: 'rain', count: Math.min(t['anomaly.leak.dropsMax'], Math.round(area * 9)), floorY: fy, opacity: 0.4 });
    cell.audioPreset = '雨音・水滴';
    return true;
  },
});

// ---------------------------------------------------------------- E04 雪の室内

/**
 * 雪の室内: 床一面に雪が積もり、家具の天板にも雪。壁際は吹きだまり、天井の縁につらら。雪が降り続けている。
 * 歩くと雪に足跡が残る（部品 oddTrail が記録し、描画が雪の上に跡を付ける）。照明は青白く、画面の縁が少し凍る
 */
defineAnomaly({
  id: 'snow', name: '雪の室内', weight: 0.9, intensity: 0, kinds: ['room', 'hall'],
  fits: (g) => dry(g.cell.theme),
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    if (cell.boxes.some((b) => b.kind === 'basin')) return false;
    const depth = t['anomaly.snow.depth'];
    const B: Box[] = ctx.rects.map((r) => floorSheet(r, fy, 'snow', depth));
    // 家具の天板に雪
    for (const b of tops(ctx.furniture, fy, 0.3, 2.3, 0.04).slice(0, 90)) {
      B.push(box([b.min[0] - 0.01, b.max[1], b.min[2] - 0.01], [b.max[0] + 0.01, b.max[1] + ctx.rng.float(0.025, 0.06), b.max[2] + 0.01], 'snow', false));
    }
    // 壁際の吹きだまり（低い。踏み込める）とつらら
    let icicles = 0;
    for (const f of facesOf(ctx)) {
      for (const [p, q] of freeSpans(ctx, f, 0.5)) {
        for (let a = p; a + 0.4 < q; a += ctx.rng.float(0.6, 1.4)) {
          const len = ctx.rng.float(0.5, 1.2);
          B.push(wallSheet(f, a, Math.min(q, a + len), fy, fy + depth + ctx.rng.float(0.08, 0.2), 'snow', 0, ctx.rng.float(0.25, 0.5)));
        }
        if (icicles > 60) continue;
        for (let a = p + 0.2; a < q - 0.1 && icicles <= 60; a += ctx.rng.float(0.25, 0.6)) {
          const l = ctx.rng.float(0.12, 0.45);
          B.push(wallSheet(f, a, a + 0.035, fy + h - l, fy + h, 'ice', 0.02, 0.055));
          icicles++;
        }
      }
    }
    addGroup(ctx, B, 'snow');
    cell.lights = cell.lights.map((l) => ({ ...l, color: mixColor(l.color, 0xcfe0ff, 0.6) }));
    cell.palette = { ...cell.palette, lightColor: mixColor(cell.palette.lightColor, 0xd8e6ff, 0.6), ambient: mixColor(cell.palette.ambient, 0xaab8cc, 0.5) };
    cell.render = { ...cell.render, fog: { color: 0xdfe6ee, near: 3, far: t['anomaly.snow.fogFar'] } };
    cell.palette.fog = 0xdfe6ee;
    const room = roomBox(ctx);
    ctx.addEntity('trail', { type: 'oddTrail', params: { aabb: aabbJ({ min: room.min, max: [room.max[0], fy + 1, room.max[2]] }), rects: ctx.rects.map((r) => ({ ...r })), y: fy + depth, max: t['anomaly.snow.prints'], color: 0x9aa6b8, opacity: 0.55 } });
    roomFx(ctx,
      { kind: 'snowfall', count: Math.min(t['anomaly.snow.flakesMax'], Math.round(areaOf(ctx) * 7)) },
      { kind: 'grade', grade: { tint: [0.95, 1, 1.07], frost: 0.2, saturation: 0.9 } },
    );
    cell.audioPreset = '微かな風音';
    return true;
  },
});

// ---------------------------------------------------------------- E08 風の向き

/**
 * 風の向き: 入口から先の開口へ向かって、部屋の中を風が吹き抜けている。紙や葉が先の開口の方へ流れ、天井の吹き流しが同じ向きになびく。
 * 体が少し押される（弱い外力）。開口の多い広間では、風下の開口が先へ進む開口
 */
defineAnomaly({
  id: 'wind', name: '風の向き', weight: 0.8, intensity: 0, kinds: ['room', 'hall'], minSize: [3.4, 4.5],
  fits: (g) => g.openings.length >= 2,
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const fwd = forwardOpening(ctx);
    if (!fwd) return false;
    const [ax, az] = front(ctx.entrance, 0.5), [bx, bz] = front(fwd, 0.5);
    let dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz);
    if (l < 1) return false;
    dx /= l; dz /= l;
    // 風が体を押すのは部屋の中ほどだけ（開口の前で横から押されて戸枠に引っかからないように、壁から 1.3 m は押さない）
    for (const r of ctx.rects) {
      const m = 1.3;
      if (r.x1 - r.x0 < 2 * m + 0.5 || r.z1 - r.z0 < 2 * m + 0.5) continue;
      ctx.addZone({ kind: 'force', aabb: { min: [r.x0 + m, fy - 0.1, r.z0 + m], max: [r.x1 - m, fy + h, r.z1 - m] }, vector: [dx, 0, dz], params: { speed: t['anomaly.wind.push'] } });
    }
    // 吹き流し: 天井から、風下へなびく細い布（傾けた箱で垂らす）
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const sgn = Math.sign(alongX ? dx : dz) || 1;
    const B: Box[] = [];
    const mats: MatId[] = ['plasticRed', 'plasticYellow', 'paintWhite', 'plasticBlue'];
    const y = fy + h - 0.12;
    for (const [x, z] of gridPoints(ctx, 1.5, 0.6)) {
      const len = ctx.rng.float(0.5, 0.9), droop = ctx.rng.float(0.15, 0.35);
      const mat = ctx.rng.pick(mats);
      // 付け根（天井の小さな金具）
      B.push(box([x - 0.02, y, z - 0.02], [x + 0.02, fy + h, z + 0.02], 'metalDark', false));
      const a0 = sgn > 0 ? (alongX ? x : z) : (alongX ? x : z) - len, a1 = a0 + len;
      // 傾けた箱は min の端の高さで書く: 風下が + なら付け根（min の端）が高く、- なら風下の端（min の端）が低い
      const yLow = sgn > 0 ? y : y - droop;
      const r = alongX ? box([a0, yLow, z - 0.025], [a1, yLow + 0.005, z + 0.025], mat, false) : box([x - 0.025, yLow, a0], [x + 0.025, yLow + 0.005, a1], mat, false);
      r.slope = { axis: alongX ? 'x' : 'z', rise: sgn > 0 ? -droop : droop };
      B.push(r);
    }
    addGroup(ctx, B, 'streamers');
    // 風下の壁際に吹き寄せられた紙
    const P: Box[] = [];
    const [fx2, fz2] = front(fwd, 1.6);
    const solids = interiorSolids(cell);
    for (let i = 0; i < 18; i++) {
      const x = fx2 + ctx.rng.float(-1.6, 1.6), z = fz2 + ctx.rng.float(-1.6, 1.6);
      if (!ctx.rects.some((r) => x > r.x0 + 0.2 && x < r.x1 - 0.2 && z > r.z0 + 0.2 && z < r.z1 - 0.2) || blockedAt(solids, x, z, 0.15, fy - 0.1, fy + 0.1)) continue;
      const w = ctx.rng.chance(0.5) ? 0.21 : 0.297, d = w === 0.21 ? 0.297 : 0.21;
      P.push(box([x - w / 2, fy + 0.002 + i * 0.0004, z - d / 2], [x + w / 2, fy + 0.005 + i * 0.0004, z + d / 2], 'signPlate', false));
    }
    addGroup(ctx, P, 'blownPaper');
    const leaf = /Organic|Gallery/.test(cell.theme ?? '');
    roomFx(ctx, { kind: 'drift', count: Math.min(t['anomaly.wind.itemsMax'], Math.round(areaOf(ctx) * 1.6)), dir: [dx, dz], speed: 1.5, shape: leaf ? 'leaf' : 'paper' });
    cell.audioPreset = '風音';
    return true;
  },
});

// ---------------------------------------------------------------- E07 温度

/**
 * 温度: 冷たい白い霧の部屋（数 m 先が見えない）。入口の側は床が凍り、つららが下がり、照明は青白い。先の開口の側は暖房の橙の灯りで暖かい。
 * 画面の縁が凍る（寒い）・赤みが差す（暖かい）ので、見えなくても暖かい方へ進めば先の開口に着く。寒い所では白い息
 */
defineAnomaly({
  id: 'thermal', name: '温度', weight: 0.7, intensity: 1, kinds: ['room', 'hall'], minSize: [3.6, 5],
  fits: (g) => g.openings.length >= 2 && dry(g.cell.theme),
  post(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = cell.floorY, h = cell.height;
    const fwd = forwardOpening(ctx);
    if (!fwd) return false;
    const cold = front(ctx.entrance, 0.8), warm = front(fwd, 0.8);
    const ex = warm[0] - cold[0], ez = warm[1] - cold[1], l2 = ex * ex + ez * ez;
    if (l2 < 10) return false;
    const tAt = (x: number, z: number): number => Math.max(0, Math.min(1, ((x - cold[0]) * ex + (z - cold[1]) * ez) / l2));
    // 照明: 冷たい側は青白く、暖かい側は橙
    cell.lights = cell.lights.map((li) => ({ ...li, color: mixColor(0x9fc8ff, 0xffb070, tAt(li.pos[0], li.pos[2])) }));
    for (const b of cell.boxes) if (isCeilingPanel(cell, b) && tAt((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2) > 0.55) b.mat = 'lightWarm';
    const fogColor = 0xcfd8e2;
    cell.render = { ...cell.render, fog: { color: fogColor, near: 0.4, far: t['anomaly.thermal.fogFar'] } };
    cell.palette = { ...cell.palette, fog: fogColor, ambient: mixColor(cell.palette.ambient, 0x9aa8b8, 0.5) };
    const B: Box[] = [];
    // 凍った床（入口の側）・家具に霜
    const solids = interiorSolids(cell);
    for (const [x, z] of gridPoints(ctx, 0.9, 0.4, 0.25)) {
      const k = tAt(x, z);
      if (k > 0.4 || !ctx.rng.chance(0.75 - k)) continue;
      const s = ctx.rng.float(0.5, 1.1);
      if (blockedAt(solids, x, z, s / 2, fy - 0.1, fy + 0.1)) continue;
      B.push(box([x - s / 2, fy + 0.001, z - s * 0.4], [x + s / 2, fy + 0.005, z + s * 0.4], 'ice', false));
    }
    for (const b of tops(ctx.furniture, fy, 0.3, 2.3, 0.04)) {
      if (tAt((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2) > 0.45) continue;
      B.push(box([b.min[0] - 0.005, b.max[1], b.min[2] - 0.005], [b.max[0] + 0.005, b.max[1] + 0.012, b.max[2] + 0.005], 'snow', false));
    }
    // つらら（入口の側の壁の上端）
    for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, 0.4)) {
      for (let a = p + 0.15; a < q - 0.1; a += ctx.rng.float(0.3, 0.7)) {
        const [x, z] = f.horizontal ? [a, f.face] : [f.face, a];
        if (tAt(x, z) > 0.3) continue;
        const len = ctx.rng.float(0.1, 0.4);
        B.push(wallSheet(f, a, a + 0.035, fy + h - len, fy + h, 'ice', 0.02, 0.055));
      }
    }
    addGroup(ctx, B, 'frost');
    // 暖房（先の開口の脇の壁。開口の前は避ける）: 本体 + 橙に光る格子 + 暖かい灯り
    const ff = facesOf(ctx).map((f) => ({ f, spans: freeSpans(ctx, f, 0.9) }));
    let heater = false;
    const doors = doorFronts(cell, ctx.geo.openings, 1.5, 0.4);
    for (const { f, spans } of ff.sort((a, b) => {
      const ca = a.f.horizontal ? [(a.f.a0 + a.f.a1) / 2, a.f.face] : [a.f.face, (a.f.a0 + a.f.a1) / 2];
      const cb = b.f.horizontal ? [(b.f.a0 + b.f.a1) / 2, b.f.face] : [b.f.face, (b.f.a0 + b.f.a1) / 2];
      return tAt(cb[0]!, cb[1]!) - tAt(ca[0]!, ca[1]!);
    })) {
      if (heater) break;
      for (const [p, q] of spans) {
        if (q - p < 1.1) continue;
        // 暖かい側の端に寄せる
        const ends = [p + 0.05, q - 1.05];
        const pick = ends.sort((u, v) => {
          const pu = f.horizontal ? [u + 0.5, f.face] : [f.face, u + 0.5], pv = f.horizontal ? [v + 0.5, f.face] : [f.face, v + 0.5];
          return tAt(pv[0]!, pv[1]!) - tAt(pu[0]!, pu[1]!);
        })[0]!;
        const body = wallSheet(f, pick, pick + 1.0, fy + 0.1, fy + 0.75, 'metal', 0.02, 0.16);
        body.solid = true;
        if (hitsAny(doors, body) || solids.some((s) => s.min[0] < body.max[0] && s.max[0] > body.min[0] && s.min[2] < body.max[2] && s.max[2] > body.min[2] && s.min[1] < body.max[1])) continue;
        const glow = wallSheet(f, pick + 0.08, pick + 0.92, fy + 0.2, fy + 0.65, 'lightWarm', 0.16, 0.165);
        if (!tryAdd(ctx, [body, glow], 'heater')) continue;
        const c = f.horizontal ? [pick + 0.5, f.face + f.inward * 0.4] : [f.face + f.inward * 0.4, pick + 0.5];
        cell.lights.push({ pos: [c[0]!, fy + 0.8, c[1]!], color: 0xff9a50, intensity: 0.55, distance: 4 });
        heater = true;
        break;
      }
    }
    roomFx(ctx, { kind: 'thermal', cold: [cold[0], cold[1]], warm: [warm[0], warm[1]], frost: t['anomaly.thermal.frost'] });
    cell.audioPreset = '微かな風音・低い空調';
    return true;
  },
});
