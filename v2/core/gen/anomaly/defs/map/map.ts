/**
 * 地図の異変（2.14。部屋まるごと）。どれも「地図を信じていたのに」という驚き。地図の振る舞いは部品 mapFx（core/sim/parts/map）で表し、
 * クライアントの地図（client/map/MapModel.ts）が読む（異変の取り消しで部品ごと消える）。
 *
 * - mapErase 地図が消える（N02・v1 MapErase）: 壁一面と床に白紙が散らばる部屋。入ると自分の地図が消える
 *     （やり方は調整表 map.erase.*: 今いる部屋のほか全部 / 半分 / 遠く）。調べた記録（調査率）と足跡は残り、もう一度見ると戻る
 * - mapRotate 地図が回る（N03・v1 MapRotation）: 床に大きな方位盤。盤の「北」の矢印は本当の北からずれている。
 *     中にいる間は地図がその角度へ回ってゆれ、出てもしばらく（map.rotate.holdSec）回ったまま
 * - unmapped 地図にない部屋（N08・v1 M02 未記録室）: 家具も音も無い、真っ白な空き部屋。入っても見ても地図に残らない
 *     （中にいる間、小さな地図は「NO DATA」）。調査率にも数えない。地図に描かれない空白が、あとで地図を見たときに分かる
 */
import { box, type Box, type MatId } from '../../../../world/layout.ts';
import { alongFace, freeRuns, innerFaces } from '../../../dress/geom.ts';
import { defineAnomaly, type AnomalyContext } from '../../types.ts';
import { doorFronts, hitsAny, interiorSolids, isCeilingPanel, isCeilingSlab, isFloorSlab, mainRect, overlaps } from '../../util.ts';

/** 区画の中を覆う範囲（mapFx の aabb） */
function cellAabb(ctx: AnomalyContext): { min: number[]; max: number[] } {
  const b = ctx.cell.bounds;
  return { min: [b.min[0], b.min[1] - 0.5, b.min[2]], max: [b.max[0], b.max[1], b.max[2]] };
}

/** 箱が、置いてある物（家具と壁の飾り）か開口の前に掛かるか */
function blocked(ctx: AnomalyContext, b: Box, doors: ReturnType<typeof doorFronts>, gap = 0.02): boolean {
  return hitsAny(doors, b) || ctx.furniture.some((f) => overlaps(f, b, gap)) || interiorSolids(ctx.cell).some((s) => overlaps(s, b, gap));
}

defineAnomaly({
  id: 'mapErase', name: '地図が消える', weight: 0.35, intensity: 1, kinds: ['room', 'hall'], minSize: [3, 3.6], minHeight: 2.2,
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, t = ctx.tuning;
    const doors = doorFronts(cell, ctx.geo.openings, 0.5, 0.25);
    const max = t['map.erase.sheets'];
    const sheets: Box[] = [];
    // 壁の白紙: 開口の脇を空けて、2〜3 段にばらばらに貼る（A4 くらい）
    for (const f of innerFaces(cell.footprint)) {
      for (const [p, q] of freeRuns(f, ctx.geo.openings, 0.3)) {
        for (let a = p + 0.1; a + 0.3 < q && sheets.length < max * 0.7; a += ctx.rng.float(0.42, 0.62)) {
          for (const row of [1.2, 1.62, 2.02]) {
            if (fy + row + 0.36 > fy + cell.height - 0.15 || ctx.rng.chance(0.25)) continue;
            const w = ctx.rng.float(0.21, 0.3), h = w * 1.414;
            const y = fy + row + ctx.rng.float(-0.06, 0.06);
            const b = alongFace(f, a + ctx.rng.float(-0.04, 0.04), w, 0.004, 0.012, y, y + h, 'paintWhite', false);
            if (blocked(ctx, b, [])) continue;
            sheets.push(b);
          }
        }
      }
    }
    // 床に散らばった白紙（開口の前と家具の下は避ける）
    for (let i = 0; i < 60 && sheets.length < max; i++) {
      const r = ctx.rng.pick(ctx.rects);
      const w = ctx.rng.float(0.21, 0.32), d = w * 1.414;
      const [sx, sz] = ctx.rng.chance(0.5) ? [w, d] : [d, w];
      if (r.x1 - r.x0 < sx + 0.4 || r.z1 - r.z0 < sz + 0.4) continue;
      const x = ctx.rng.float(r.x0 + 0.2, r.x1 - 0.2 - sx), z = ctx.rng.float(r.z0 + 0.2, r.z1 - 0.2 - sz);
      const y = fy + 0.002 + (i % 3) * 0.002;
      const b = box([x, y, z], [x + sx, y + 0.004, z + sz], 'paintWhite', false);
      if (blocked(ctx, b, doors, 0) || sheets.some((s) => overlaps(s, b, -0.05) && s.min[1] < fy + 0.05)) continue;
      sheets.push(b);
    }
    if (sheets.length < 12) return false;
    sheets.forEach((b, i) => { b.propGroup = `${cell.id}/a-mapErase-sheet${i}`; ctx.addBox(b); });
    cell.audioPreset = '紙擦れ';
    const policy = ctx.rng.weighted(['all', 'half', 'far'] as const, (k) => t[`map.erase.${k}` as const]);
    ctx.addEntity('fx', { type: 'mapFx', params: { fx: 'erase', policy, aabb: cellAabb(ctx) } });
    return true;
  },
});

/** 方位盤の向き（度。地図をこの角度だけ回す。盤の北もこの角度だけずれている） */
const ROSE_ANGLES = [90, 135, 180, 225, 270] as const;

defineAnomaly({
  id: 'mapRotate', name: '地図が回る', weight: 0.35, intensity: 1, kinds: ['room', 'hall'], minSize: [3.6, 4],
  // 家具を置く前に盤の場所を決め、家具を置かせない（盤が家具に隠れないように）
  pre(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const r = mainRect(cell);
    const doors = doorFronts(cell, ctx.geo.openings, 1.2, 0.3);
    // 盤の大きさ: 部屋の短い辺の約半分（一辺 1.6〜3.2 m）。真ん中が開口の前に掛かるなら、掛からない所を探す
    const R = Math.min(1.6, Math.max(0.8, Math.min(r.x1 - r.x0, r.z1 - r.z0) * 0.26));
    const free = (cx: number, cz: number): boolean => {
      const probe = box([cx - R, fy, cz - R], [cx + R, fy + 1.0, cz + R], 'void', false);
      return probe.min[0] > r.x0 + 0.2 && probe.max[0] < r.x1 - 0.2 && probe.min[2] > r.z0 + 0.2 && probe.max[2] < r.z1 - 0.2 && !interiorSolids(cell).some((s) => overlaps(s, probe, 0)) && !hitsAny(doors, probe);
    };
    let at: [number, number] | null = null;
    const c0: [number, number] = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
    if (free(...c0)) at = c0;
    for (let i = 0; i < 30 && !at; i++) { const p: [number, number] = [ctx.rng.float(r.x0 + R, r.x1 - R), ctx.rng.float(r.z0 + R, r.z1 - R)]; if (free(...p)) at = p; }
    if (!at) return false;
    const [cx, cz] = at;
    const deg = ctx.rng.pick(ROSE_ANGLES);
    const B: Box[] = [];
    const strip = (x0: number, z0: number, x1: number, z1: number, mat: MatId, lift: number): void => { B.push(box([x0, fy + 0.003 + lift, z0], [x1, fy + 0.008 + lift, z1], mat, false)); };
    // 外の輪（四角の枠）・十字・中心
    const W = 0.06;
    strip(cx - R, cz - R, cx + R, cz - R + W, 'goldTrim', 0); strip(cx - R, cz + R - W, cx + R, cz + R, 'goldTrim', 0);
    strip(cx - R, cz - R, cx - R + W, cz + R, 'goldTrim', 0); strip(cx + R - W, cz - R, cx + R, cz + R, 'goldTrim', 0);
    strip(cx - R * 0.92, cz - 0.05, cx + R * 0.92, cz + 0.05, 'trim', 0.001);
    strip(cx - 0.05, cz - R * 0.92, cx + 0.05, cz + R * 0.92, 'trim', 0.001);
    strip(cx - 0.18, cz - 0.18, cx + 0.18, cz + 0.18, 'goldTrim', 0.002);
    // 北の矢印（赤）: 本当の北（-Z）から deg だけずれた向き。四方向に近い向きの帯で描く（箱は斜めにできないので、段の帯を重ねる）
    const a = (deg * Math.PI) / 180;
    const dx = Math.sin(a), dz = -Math.cos(a);
    for (let k = 1; k <= 7; k++) {
      const s = (k / 8) * R * 0.85, hw = 0.11 * (1 - k / 9);
      strip(cx + dx * s - hw, cz + dz * s - hw, cx + dx * s + hw, cz + dz * s + hw, 'plasticRed', 0.003);
    }
    B.forEach((b, i) => { b.propGroup = `${cell.id}/a-mapRotate-rose${i}`; ctx.addBox(b); });
    ctx.keepOut({ min: [cx - R - 0.3, fy - 0.1, cz - R - 0.3], max: [cx + R + 0.3, fy + cell.height, cz + R + 0.3] });
    ctx.addEntity('fx', { type: 'mapFx', params: { fx: 'rotate', angle: deg, aabb: cellAabb(ctx) } });
    return true;
  },
});

defineAnomaly({
  id: 'unmapped', name: '地図にない部屋', weight: 0.3, intensity: 1, kinds: ['room'], minSize: [3, 3.4],
  pre(ctx) {
    ctx.skipDress();
    const cell = ctx.cell;
    // 白い空き部屋: 床・壁・天井を白に。冷たい白い灯り。ほとんど無音
    for (const b of cell.boxes) {
      if (isFloorSlab(cell, b)) b.mat = 'marbleWhite';
      else if (isCeilingSlab(cell, b)) b.mat = 'paintWhite';
      else if (b.solid && b.mat === cell.palette.wall) b.mat = 'paintWhite';
      else if (isCeilingPanel(cell, b)) b.mat = 'lightPanel';
    }
    cell.palette = { ...cell.palette, floor: 'marbleWhite', wall: 'paintWhite', ceiling: 'paintWhite', light: 'lightPanel', lightColor: 0xf2f6ff, lightIntensity: Math.max(1, cell.palette.lightIntensity), ambient: 0x8a8f99 };
    cell.lights = cell.lights.map((l) => ({ ...l, color: 0xf2f6ff }));
    cell.audioPreset = '無音に近い';
    ctx.addEntity('fx', { type: 'mapFx', params: { fx: 'hide', aabb: cellAabb(ctx) } });
    return true;
  },
});
