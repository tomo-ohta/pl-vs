/**
 * 上下する床（沈む床 G16・せり上がる床 G17・天秤の床 BG06）と、床下の明かり（G15）。
 *
 * - sinkFloor 沈む床: 部屋の床の一角が、継ぎ目で縁取られた 2 m 四方の床板。上で止まって立っていると、ゆっくり縦穴へ沈んでいく
 *   （歩き回ると戻る）。底まで沈んで止まっていると、1 つ下のフロアへ（エレベーター代わり）。規則は「止まると沈む・歩くと戻る」
 * - riseFloor せり上がる床: 壁の高い所に扉（入口の無い扉）。その下の床板の上で止まって立っていると、扉の高さまでせり上がる。
 *   扉の先が隠し（必ず付ける）。戻りは飛び降りればよい
 * - balanceRoom 天秤の床（BG06）: 壁際に天秤の 2 枚の皿と、間の床。皿は重い方が下がる。重い箱（2）と軽い箱（1）を押して皿に載せ、
 *   軽い方の皿に自分も乗る（1 + 1 = 2）と釣り合い、しばらくすると間の床が 2 段に下がって、壁の低い所に扉が現れる（出現型・必ず付ける）
 * - underHatch 床下の明かり: 床の継ぎ目から暖かい光が漏れている四角い蓋。調べると蓋が滑って開き、階段で地下の小部屋へ。
 *   地下の壁に扉（存在型・必ず付ける）。蓋は開いたまま（閉じ込めない）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box, type Json, type MatId } from '../../../world/layout.ts';
import { pitShell } from '../pit.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, cutFloorSlab, doorZone, freeWallSpan, hitsDoorZones, innerRect, wallFrame, type WallFrame } from '../util.ts';
import { botHint, snap } from './common.ts';

/** 継ぎ目の縁取り（床の上の細い帯） */
function seamRing(ctx: GimmickContext, r: Rect, mat: MatId, w = 0.04, h = 0.004): void {
  const y = ctx.slot.cell.floorY;
  for (const [x0, z0, x1, z1] of [[r.x0 - w, r.z0 - w, r.x1 + w, r.z0], [r.x0 - w, r.z1, r.x1 + w, r.z1 + w], [r.x0 - w, r.z0, r.x0, r.z1], [r.x1, r.z0, r.x1 + w, r.z1]] as const) {
    ctx.addBox(box([x0, y, z0], [x1, y + h, z1], mat, false));
  }
}

/** 開口の無い壁の、長さ need の区間（入口から遠い壁を先に）。壁の向き・壁に沿った位置・その壁の座標系 */
function freeWall(ctx: GimmickContext, need: number, depthNeed: number): { d: Dir; at: number; F: WallFrame } | null {
  const s = ctx.slot;
  const ent = s.entrance;
  const dirs = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).sort((a, b) => (ent ? Number(a === ent.dir) - Number(b === ent.dir) : 0));
  for (const d of dirs) {
    const span = freeWallSpan(s, d, need, 0.9);
    if (!span) continue;
    const F = wallFrame(innerRect(s), d);
    if (F.depth < depthNeed) continue;
    return { d, at: span.at, F };
  }
  return null;
}

defineGimmick({
  id: 'sinkFloor', name: '沈む床', axes: ['floor'], kinds: ['room', 'hall'], minSize: [4.6, 4.6], minHeight: 2.4, weight: 0.5, intensity: 0, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s, 0.15);
    const P = 2.0, depth = t['ground.sink.depthM'];
    // 床板の置き場所: 開口の前（奥行き 1.5 m + 0.5 m）に掛からない所
    const cands: Rect[] = [];
    for (let x = r.x0; x + P <= r.x1 + 1e-6; x += 0.25) for (let z = r.z0; z + P <= r.z1 + 1e-6; z += 0.25) cands.push({ x0: snap(x), z0: snap(z), x1: snap(x + P), z1: snap(z + P) });
    const ok = cands.filter((c) => !hitsDoorZones(s, { x0: c.x0 - 0.5, z0: c.z0 - 0.5, x1: c.x1 + 0.5, z1: c.z1 + 0.5 }, 1.5));
    if (!ok.length) return;
    const hole = ctx.rng.pick(ok);
    cutFloorSlab(s, hole);
    pitShell(ctx, hole, depth);
    seamRing(ctx, hole, 'metalDark');
    const mat = ctx.rng.pick((['floorTile', 'marbleFloor', 'floorWood', 'metal'] as const).filter((m) => m !== s.cell.palette.floor));
    const plate = { min: [hole.x0 + 0.02, y - 0.2, hole.z0 + 0.02], max: [hole.x1 - 0.02, y, hole.z1 - 0.02] };
    const lift = ctx.addEntity('lift', { type: 'stillLift', params: { box: aabbJson({ min: [plate.min[0]!, plate.min[1]!, plate.min[2]!], max: [plate.max[0]!, plate.max[1]!, plate.max[2]!] }), travel: -depth, speed: t['ground.sink.speed'], stillSec: 0.5, idleSec: 2, mat } });
    // 底で止まっていると 1 つ下のフロアへ
    const bottom = ctx.addEntity('atBottom', { type: 'and', params: {}, inputs: { a: `${lift}.atFar`, b: `${lift}.still` } });
    const hold = ctx.addEntity('hold', { type: 'timer', params: { onDelay: t['ground.sink.gotoSec'], offDelay: 0 }, inputs: { in: `${bottom}.out` } });
    const cx = (hole.x0 + hole.x1) / 2, cz = (hole.z0 + hole.z1) / 2;
    ctx.addEntity('goto', { type: 'floorGoto', params: { kind: 'hole', pos: [cx, y - depth, cz] }, inputs: { go: `${hold}.out` } });
    // 縦穴の底の暗い灯り（沈んでいく先が見える）
    s.cell.lights.push({ pos: [cx, y - depth + 1.2, cz], color: 0x8fa6c8, intensity: 0.25, distance: 3.5 });
    ctx.keepOut({ min: [hole.x0 - 0.5, y - depth, hole.z0 - 0.5], max: [hole.x1 + 0.5, y + 3, hole.z1 + 0.5] });
  },
});

defineGimmick({
  id: 'riseFloor', name: 'せり上がる床', axes: ['floor'], kinds: ['room', 'hall'], minSize: [4.0, 4.4], minHeight: 3.5, weight: 0.5, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const H = snap(Math.min(t['ground.rise.maxM'], s.cell.height - 2.25));
    if (H < 1.3) return;
    const w = freeWall(ctx, 2.2, 3.2);
    if (!w) return;
    const { d, at, F } = w;
    const P = 1.4;
    const plate = F.rect(at - P / 2, 0.02, at + P / 2, P + 0.02);
    // 開口の前に掛からない
    if (hitsDoorZones(s, plate, 1.4)) return;
    cutFloorSlab(s, plate);
    ctx.addBox(box([plate.x0, y - 0.4, plate.z0], [plate.x1, y - 0.2, plate.z1], s.cell.palette.floor));
    seamRing(ctx, plate, 'yellowLine', 0.05);
    const lift = ctx.addEntity('lift', { type: 'stillLift', params: { box: aabbJson({ min: [plate.x0 + 0.02, y - 0.2, plate.z0 + 0.02], max: [plate.x1 - 0.02, y, plate.z1 - 0.02] }), travel: H, speed: t['ground.rise.speed'], stillSec: 0.5, idleSec: 3, mat: 'metal', scissor: true } });
    const c = F.point(at, P / 2 + 0.02);
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([{ at: [c[0], y, c[1]], wait: 0.5, until: `${lift}.atFar` }], { only: 'secret' }) } });
    ctx.offerSecret({ hook: 'rise.high', modes: ['present'], weight: 1, required: true, doorway: { dir: d, at: d % 2 === 0 ? F.point(at, 0)[0] : F.point(at, 0)[1], y: y + H, width: 1.0, height: 2.0 }, floorY: y + H, tell: '壁の高い所の、どこへも行けない扉' });
    ctx.keepOut({ min: [plate.x0 - 0.6, y - 0.5, plate.z0 - 0.6], max: [plate.x1 + 0.6, y + s.cell.height, plate.z1 + 0.6] });
  },
});

defineGimmick({
  id: 'balanceRoom', name: '天秤の床', axes: ['floor', 'puzzle'], kinds: ['room', 'hall'], minSize: [4.6, 5.4], minHeight: 2.4, weight: 0.5, intensity: 1, offersSecret: true, requiresSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const c = 1.2;
    const w = freeWall(ctx, 3 * c + 0.4, 5.0);
    if (!w) return;
    const { d, at, F } = w;
    // 3 列（左の皿・間の床・右の皿）× 4 行（壁際 2 行が皿と床・3 行目に箱・4 行目は押す人の立つ所）
    const u0 = at - 1.5 * c;
    const cell = (col: number, row: number): Rect => F.rect(u0 + col * c, row * c, u0 + (col + 1) * c, (row + 1) * c);
    const area = F.rect(u0, 0, u0 + 3 * c, 4 * c);
    if (hitsDoorZones(s, area, 1.4)) return;
    for (const o of s.openings) { const z = doorZone(o, y, 1.4, 0.3); if (area.x0 < z.max[0] && area.x1 > z.min[0] && area.z0 < z.max[2] && area.z1 > z.min[2]) return; }
    const panRect = (col: number): Rect => { const a = cell(col, 0), b = cell(col, 1); return { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) }; };
    const L = panRect(0), M = panRect(1), R = panRect(2);
    // 皿と間の床の下の浅い穴
    for (const [rr, dp] of [[L, 0.7], [R, 0.7], [M, 0.8]] as const) {
      cutFloorSlab(s, rr);
      ctx.addBox(box([rr.x0, y - dp - 0.2, rr.z0], [rr.x1, y - dp, rr.z1], s.cell.palette.floor));
    }
    s.cell.bounds.min[1] = Math.min(s.cell.bounds.min[1], y - 1.0);
    // 皿（重い方が下がる。target 0.5 で床の高さ）・間の床（2 段）
    const balId = `${ctx.id}.balance`;
    const pan = (name: string, rr: Rect, out: string): string => ctx.addEntity(name, { type: 'mover', params: { box: aabbJson({ min: [rr.x0 + 0.03, y + 0.1, rr.z0 + 0.03], max: [rr.x1 - 0.03, y + 0.3, rr.z1 - 0.03] }), mat: 'goldTrim', points: [[0, 0, 0], [0, -0.6, 0]], speed: 0.5, startT: 0.5 }, inputs: { target: `${balId}.${out}` } });
    const panL = pan('panL', L, 'tLeft'), panR = pan('panR', R, 'tRight');
    const s0 = cell(1, 0), s1 = cell(1, 1);
    for (const [name, rr, drop] of [['step0', s0, 0.6], ['step1', s1, 0.3]] as const) {
      ctx.addEntity(name, { type: 'mover', params: { box: aabbJson({ min: [rr.x0 + 0.02, y - 0.2, rr.z0 + 0.02], max: [rr.x1 - 0.02, y, rr.z1 - 0.02] }), mat: 'marbleFloor', points: [[0, 0, 0], [0, -drop, 0]], speed: 0.25 }, inputs: { target: `${balId}.balanced` } });
    }
    // 天秤の柱（真ん中の奥の壁際の飾り。皿の高さの目盛り）
    { const p = F.point(at, 0.06); ctx.addBox(box([p[0] - 0.05, y + 1.6, p[1] - 0.05], [p[0] + 0.05, y + 2.3, p[1] + 0.05], 'goldTrim', false)); }
    // 箱: 重い（2）と軽い（1）を、皿の前の行に（どちらの皿の前かは乱数）。升目は 3 × 3（間の床の升 'x' には置けない）
    const heavyCol = ctx.rng.chance(0.5) ? 0 : 2, lightCol = 2 - heavyCol;
    const gr = F.rect(u0, 0, u0 + 3 * c, 3 * c);
    const rows: string[] = [];
    for (let k = 0; k < 3; k++) {
      let row = '';
      for (let i = 0; i < 3; i++) {
        const x = gr.x0 + (i + 0.5) * c, z = gr.z0 + (k + 0.5) * c;
        const col = Math.floor((F.u(x, z) - u0) / c), rowI = Math.floor(F.v(x, z) / c);
        row += col === 1 && rowI <= 1 ? 'x' : '.';
      }
      rows.push(row);
    }
    const grid = { x0: gr.x0, z0: gr.z0, c, rows };
    const ik = (col: number, row: number): [number, number] => { const p = F.point(u0 + (col + 0.5) * c, (row + 0.5) * c); return [Math.floor((p[0] - gr.x0) / c), Math.floor((p[1] - gr.z0) / c)]; };
    const cellsOf = (col: number): number[][] => [ik(col, 0), ik(col, 1)];
    // 皿の上の箱は皿の高さに合わせる（皿の上面 = 床 + 0.3 + 皿の動いた量）
    const liftBy = [{ cells: cellsOf(0), entity: panL, offset: 0.3 }, { cells: cellsOf(2), entity: panR, offset: 0.3 }] as unknown as Json;
    const heavy = `${ctx.id}.heavy`, light = `${ctx.id}.light`;
    const reset = ctx.addEntity('reset', { type: 'button', params: { box: (() => { const p = F.point(u0 - 0.5 < F.u0 + 0.2 ? u0 + 3 * c + 0.4 : u0 - 0.4, 0.04); return aabbJson({ min: [p[0] - 0.1, y + 1.05, p[1] - 0.1], max: [p[0] + 0.1, y + 1.3, p[1] + 0.1] }); })(), mat: 'plasticYellow' } });
    ctx.addEntity('heavy', { type: 'crate', params: { grid, start: ik(heavyCol, 2), half: 0.55, h: 1.0, y, peers: [heavy, light], mat: 'metalDark', weight: 2, liftBy, slideSec: 0.6 }, inputs: { reset: `${reset}.pressed` } });
    ctx.addEntity('light', { type: 'crate', params: { grid, start: ik(lightCol, 2), half: 0.4, h: 0.7, y, peers: [heavy, light], mat: 'boxCardboard', weight: 1, liftBy }, inputs: { reset: `${reset}.pressed` } });
    const pa = (rr: Rect): Json => aabbJson({ min: [rr.x0, y - 1, rr.z0], max: [rr.x1, y + 2, rr.z1] });
    ctx.addEntity('balance', { type: 'balanceScale', params: { left: pa(L), right: pa(R), crates: [heavy, light], perUnit: 0.5, holdSec: t['ground.balance.holdSec'], minLoad: 1 } });
    // 歩く人（隠しへ行くとき）: 箱を 1 つずつ皿へ押し、軽い方の皿の壁際に立って待つ
    const P = (col: number, row: number, dv = 0): [number, number, number] => { const p = F.point(u0 + (col + 0.5) * c, (row + 0.5) * c + dv); return [p[0], y, p[1]]; };
    const look = (col: number, row: number): [number, number, number] => { const p = P(col, row); return [p[0], y + 0.5, p[2]]; };
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([
      { at: P(heavyCol, 3, -0.05), look: look(heavyCol, 2), wait: 1.0 },
      { at: P(lightCol, 3, -0.05), look: look(lightCol, 2), wait: 1.0 },
      { at: P(lightCol, 0), wait: 0.5, until: `${balId}.balanced` },
    ], { only: 'secret', doneIf: `${balId}.balanced` }) } });
    // 隠し: 間の床の奥の壁の低い所（床が下がると、壁の扉の下の端が床の高さになる）
    const doorAt = F.point(at, 0);
    ctx.offerSecret({ hook: 'balance.even', modes: ['appear'], weight: 1, required: true, revealOutput: `${balId}.balanced`, doorway: { dir: d, at: d % 2 === 0 ? doorAt[0] : doorAt[1], y: y - 0.6, width: 1.0, height: 2.0 }, floorY: y - 0.6, tell: '天秤の真ん中の床の継ぎ目から、冷たい風' });
    ctx.keepOut({ min: [area.x0, y - 1, area.z0], max: [area.x1, y + 3, area.z1] });
  },
});

defineGimmick({
  id: 'underHatch', name: '床下の明かり', axes: ['light', 'floor'], kinds: ['room', 'hall'], minSize: [4.0, 5.0], minHeight: 2.4, weight: 0.5, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const depth = t['ground.hatch.depthM'];
    const n = Math.max(1, Math.ceil(depth / t['gimmick.pit.stairRise']) - 1);
    const rise = depth / (n + 1), tread = 0.28;
    const landing = 1.0, len = landing + n * tread;
    const w = freeWall(ctx, 2.0, len + 1.4);
    if (!w) return;
    const { d, at, F } = w;
    // 縦穴の幅 1.5 m（側壁 0.15 m の内側が階段の幅 1.2 m）
    const hole = F.rect(at - 0.75, 0, at + 0.75, len);
    if (hitsDoorZones(s, { x0: hole.x0 - 0.3, z0: hole.z0 - 0.3, x1: hole.x1 + 0.3, z1: hole.z1 + 0.3 }, 1.4)) return;
    cutFloorSlab(s, hole);
    pitShell(ctx, hole, depth);
    // 階段: 蓋の奥（壁から遠い端）から壁の方へ下りる。下の端の先は壁際の踊り場（地下の扉の前）
    for (let j = 0; j < n; j++) {
      const r = F.rect(at - 0.6, len - (j + 1) * tread, at + 0.6, len - j * tread);
      ctx.addBox(box([r.x0, y - depth, r.z0], [r.x1, y - rise * (j + 1), r.z1], s.cell.palette.floor));
    }
    // 地下の暖かい灯り（蓋の継ぎ目から漏れる）
    const lc = F.point(at, landing / 2);
    s.cell.lights.push({ pos: [lc[0], y - depth + 1.9, lc[1]], color: 0xffb066, intensity: 0.6, distance: 4.5 });
    // 継ぎ目の光（蓋が閉じている間だけ見える細い帯。蓋の描画が開くと隠す）
    const glow: Box[] = [];
    for (const [a0, b0, a1, b1] of [[-0.77, -0.02, 0.77, 0.02], [-0.77, len - 0.02, 0.77, len + 0.02], [-0.77, 0, -0.73, len], [0.73, 0, 0.77, len]] as const) {
      const r = F.rect(at + a0, b0, at + a1, b1);
      glow.push(box([r.x0, y + 0.001, r.z0], [r.x1, y + 0.004, r.z1], 'lightWarm', false));
    }
    // 蓋（床の高さの板）。調べると壁と反対の向き（u）へ滑って床の下へ
    const slide = F.point(at + 1.25, 0), base = F.point(at, 0);
    const hatch = ctx.addEntity('hatch', { type: 'hatch', params: { panel: aabbJson({ min: [hole.x0, y - 0.1, hole.z0], max: [hole.x1, y, hole.z1] }), slide: [slide[0] - base[0], -0.12, slide[1] - base[1]], mat: s.cell.palette.floor, glow: glow.map((b) => aabbJson({ min: b.min, max: b.max })) } });
    const st = F.point(at, len + 0.8), hc = F.point(at, len - 0.4);
    ctx.addEntity('hint', { type: 'constant', params: { value: 0, bot: botHint([{ at: [st[0], y, st[1]], look: [hc[0], y, hc[1]], wait: 1.6 }], { only: 'secret', doneIf: `${hatch}.open` }) } });
    ctx.offerSecret({ hook: 'hatch.under', modes: ['present'], weight: 1, required: true, doorway: { dir: d, at: d % 2 === 0 ? base[0] : base[1], y: y - depth, width: 1.0, height: 2.0 }, tell: '床の継ぎ目から漏れる光' });
    ctx.keepOut({ min: [hole.x0 - 0.5, y - depth, hole.z0 - 0.5], max: [hole.x1 + 0.5, y + 3, hole.z1 + 1.0] });
  },
});
