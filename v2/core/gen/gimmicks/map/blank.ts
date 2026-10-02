/**
 * 地図の空白（BX04「地図の空白の場所の壁に行くと、壁が扉になる」）: 測量室。壁一面に図面が貼られ、真ん中の製図台に
 * このあたりの地図が広げてある。地図の、この部屋の壁の向こうだけが白く抜けている（空白）。自分の地図（小さな地図・メニュー）でも、
 * この部屋を見るとその所が白い空白になる（client/map の blanks）。空白の方の壁の前で立ち止まる / 壁を調べると、壁が扉になる。
 *
 * - 目標: 地図の空白へ行く / 規則: 地図の白い所（製図台の地図・自分の地図）と、壁に 1 枚だけ貼られた白紙
 * - 隠し（map.blank。必ず付ける）: 出現型 = 空白の壁の前で map.blank.dwellSec 秒立ち止まるか、扉の脇の白紙を調べると壁が消えて扉 /
 *   存在型 = 壁と同じ色の扉が最初からある（地図の空白が場所を教える）
 * - 空白は隠し場所の足跡そのもの（client/map/MapInfo.ts が、製図台の地図の部品 mapBoard の mode 'survey'・blank から、
 *   この区画の壁の向こうの隠し場所の区画をたどって作る）。隠し場所に入ると空白は消える（地図に部屋として描かれる）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, doorZone, freeWallSpan, innerRect } from '../util.ts';

defineGimmick({
  id: 'mapBlank', name: '地図の空白', axes: ['puzzle'], kinds: ['room'], minSize: [4.2, 4.6], minHeight: 2.3, weight: 0.08, intensity: 0,
  offersSecret: true, requiresSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning, cell = s.cell, y = cell.floorY;
    const r = innerRect(s);
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    // 空白の壁: 開口の無い壁（入口の向かい → 横）
    const ent = s.entrance ?? s.openings[0]!;
    const order: Dir[] = [((ent.dir + 2) % 4) as Dir, ((ent.dir + 1) % 4) as Dir, ((ent.dir + 3) % 4) as Dir];
    let wall: { dir: Dir; at: number } | null = null;
    for (const d of order) { const sp = freeWallSpan(s, d, 2.2); if (sp) { wall = { dir: d, at: sp.at }; break; } }
    if (!wall) return;
    const wallCoord = wall.dir === 0 ? r.z1 : wall.dir === 2 ? r.z0 : wall.dir === 1 ? r.x1 : r.x0;
    const doorPos: [number, number, number] = wall.dir === 0 || wall.dir === 2 ? [wall.at, y, wallCoord + (wall.dir === 0 ? 0.15 : -0.15)] : [wallCoord + (wall.dir === 1 ? 0.15 : -0.15), y, wall.at];
    const front = doorZone({ id: 'blank', pos: doorPos, dir: wall.dir, width: 1.0, height: 2.0 }, y, 1.3, 0.3);
    // 製図台（真ん中。開口の前と空白の壁の前には掛けない）
    const hw = Math.min(0.75, (r.x1 - r.x0) / 2 - 1.1), hd = Math.min(0.5, (r.z1 - r.z0) / 2 - 1.1);
    if (hw < 0.45 || hd < 0.35) return;
    const tableR = { x0: cx - hw, z0: cz - hd, x1: cx + hw, z1: cz + hd };
    const zones = [...s.openings.map((o) => doorZone(o, y, 1.4, 0.4)), front];
    if (zones.some((z) => tableR.x0 < z.max[0] && tableR.x1 > z.min[0] && tableR.z0 < z.max[2] && tableR.z1 > z.min[2])) return;
    const top = y + 0.86;
    ctx.addBox(box([tableR.x0, top - 0.05, tableR.z0], [tableR.x1, top, tableR.z1], 'woodPanel'));
    for (const [lx, lz] of [[tableR.x0 + 0.05, tableR.z0 + 0.05], [tableR.x1 - 0.05, tableR.z0 + 0.05], [tableR.x0 + 0.05, tableR.z1 - 0.05], [tableR.x1 - 0.05, tableR.z1 - 0.05]] as const) {
      ctx.addBox(box([lx - 0.03, y, lz - 0.03], [lx + 0.03, top - 0.05, lz + 0.03], 'metalDark'));
    }
    // 製図台の地図（このあたりの地図。空白つき）。紙の箱は描画の下地、地図の絵は描画が貼る
    const sheet = box([tableR.x0 + 0.06, top, tableR.z0 + 0.06], [tableR.x1 - 0.06, top + 0.004, tableR.z1 - 0.06], 'signPlate', false);
    sheet.propGroup = `${cell.id}/mapBlank-table`;
    ctx.addBox(sheet);
    ctx.addEntity('table', { type: 'mapBoard', params: { mode: 'survey', blank: true, box: aabbJson(sheet), center: [cx, cz], radius: 14, here: [Math.round(cx * 100) / 100, Math.round(cz * 100) / 100] } });
    // 壁一面の図面（空白の壁の扉の所は空け、扉の脇に白紙を 1 枚）
    const fy = y;
    const B: Box[] = [];
    const along = (d: Dir, a0: number, a1: number, y0: number, y1: number, depth: number, mat: Box['mat']): Box => {
      const c = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
      const sg = d === 0 || d === 1 ? -1 : 1;
      const n0 = Math.min(c, c + sg * depth), n1 = Math.max(c, c + sg * depth);
      return d === 0 || d === 2 ? box([a0, y0, n0], [a1, y1, n1], mat, false) : box([n0, y0, a0], [n1, y1, a1], mat, false);
    };
    for (const d of [0, 1, 2, 3] as const) {
      const [a0, a1] = d === 0 || d === 2 ? [r.x0 + 0.3, r.x1 - 0.3] : [r.z0 + 0.3, r.z1 - 0.3];
      for (let a = a0; a + 0.5 < a1; a += 0.72) {
        if (s.openings.some((o) => o.dir === d && Math.abs((d === 0 || d === 2 ? o.pos[0] : o.pos[2]) - (a + 0.25)) < o.width / 2 + 0.6)) continue;
        if (d === wall.dir && Math.abs(a + 0.25 - wall.at) < 1.1) continue;
        if (ctx.rng.chance(0.3)) continue;
        const yy = fy + ctx.rng.pick([1.25, 1.4, 1.55]);
        B.push(along(d, a, a + 0.5, yy, yy + 0.36, 0.012, ctx.rng.chance(0.25) ? 'aquariumBlue' : 'signPlate'));
      }
    }
    // 扉の脇の白紙（1 枚だけ。図面の中で白い。調べると壁が扉になる）
    const blankSheet = along(wall.dir, wall.at + 0.75, wall.at + 1.05, fy + 1.4, fy + 1.82, 0.014, 'paintWhite');
    B.push(blankSheet);
    B.forEach((b, i) => { b.propGroup = `${cell.id}/mapBlank-sheet${i}`; ctx.addBox(b); });
    // 壁が扉になる: 空白の壁の前で立ち止まる / 扉の脇の白紙を調べる（扉の板に重ならない所。扉を開ける操作の邪魔をしない）
    const dwell = ctx.addEntity('dwell', { type: 'dwellSensor', params: { aabb: aabbJson(front), sec: t['map.blank.dwellSec'], still: true } });
    const knock = ctx.addEntity('wall', { type: 'mapWall', params: { box: aabbJson(blankSheet) } });
    const any = ctx.addEntity('any', { type: 'or', params: {}, inputs: { a: `${dwell}.done`, b: `${knock}.pressed` } });
    const open = ctx.addEntity('open', { type: 'latch', params: {}, inputs: { set: `${any}.out` } });
    ctx.offerSecret({ hook: 'map.blank', modes: ['appear', 'present'], weight: 1, required: true, revealOutput: `${open}.out`, doorway: { dir: wall.dir, at: wall.at, y, width: 1.0, height: 2.0 }, tell: '地図の白い空白・壁に 1 枚だけの白紙' });
    // 家具を置かない所: 製図台のまわりと、空白の壁の前
    ctx.keepOut({ min: [tableR.x0 - 0.7, y - 0.1, tableR.z0 - 0.7], max: [tableR.x1 + 0.7, y + 3, tableR.z1 + 0.7] });
    ctx.keepOut({ min: [front.min[0] - 0.3, y - 0.1, front.min[2] - 0.3], max: [front.max[0] + 0.3, y + 3, front.max[2] + 0.3] });
  },
});
