/**
 * 這って進む部屋（crawlTunnel）。低い所では自動でしゃがむ（crawl ゾーン）。
 *
 * - shrink 縮むトンネル [M27]: 入口から奥へ、四角いトンネルの枠が少しずつ狭く・低くなり、最後は這う高さ（1.0 m）。
 *   出口の前で普通の高さに戻る。扉を開けると、遠近法が狂ったように小さくなっていく枠が見える。
 *   隠し（出現型 tunnel.backward）: トンネルの高い所を、しゃがまずに後ろ向き（出口を向いたまま入口の方へ）に歩き続けると、
 *   入口の近くの横の壁に「来た時と違う出口」の扉が開く [BM15]
 * - duct ダクトを這う [M24]: 部屋の中が金属のダクトで埋まり、開口の前から 1.05 m の高さの細いダクトが曲がりながら続く。
 *   隠し（存在型 duct.gap）: ダクトの途中の、さらに低く狭い脇の隙間の先に小部屋と扉（しゃがんだまま脇の隙間へ）[BM04]
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, doorZone, fillRects, frontOf, innerRect, rectGap } from '../util.ts';
import { hallAabb, hallBox, hallOf, removeLightsIn, sideDir, wallAt, type Hall } from './common.ts';

defineGimmick({
  id: 'crawlTunnel', name: '這う部屋', axes: ['body'], kinds: ['room', 'hall'], minSize: [3.4, 6], weight: 0.7, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot;
    const opp = !!s.exit && s.exit.dir === (s.entrance!.dir + 2) % 4;
    const H = opp ? hallOf(s) : null;
    if (H && H.L >= 6.5 && ctx.rng.chance(ctx.tuning['move.crawl.shrinkChance'])) buildShrink(ctx, H);
    else buildDuct(ctx);
  },
});

function buildShrink(ctx: GimmickContext, H: Hall): void {
  const s = ctx.slot;
  const t = ctx.tuning;
  const land0 = 1.3, land1 = 1.4;
  const crawlLen = 1.3;
  const v0 = land0, v2 = H.L - land1, v1 = v2 - crawlLen;
  if (v1 - v0 < 2.5) return;
  const W0 = Math.min(H.W - 0.2, 2.6), H0 = Math.min(H.h - 0.15, 2.7);
  const Wc = t['move.crawl.widthM'], Hc = t['move.crawl.heightM'];
  const cu = Math.min(H.F.u1 - Wc / 2 - 0.1, Math.max(H.F.u0 + Wc / 2 + 0.1, (H.entU + (H.exitU ?? H.entU)) / 2));
  const seg = 0.55;
  const n = Math.max(3, Math.round((v1 - v0) / seg));
  const mat: MatId = s.cell.palette.wall;
  // 枠: 区切りごとに、トンネルの外を床から天井まで埋める（左右）と、トンネルの上（天井まで）
  const frame = (va: number, vb: number, w: number, h: number): void => {
    const a = Math.max(H.F.u0, cu - w / 2), b = Math.min(H.F.u1, cu + w / 2);
    if (a - H.F.u0 > 0.02) ctx.addBox(hallBox(H, H.F.u0, va, a, vb, 0, H.h, mat));
    if (H.F.u1 - b > 0.02) ctx.addBox(hallBox(H, b, va, H.F.u1, vb, 0, H.h, mat));
    if (H.h - h > 0.02) ctx.addBox(hallBox(H, a, va, b, vb, h, H.h, mat));
    // 枠の縁（見切り）: 区切りごとの段が見える
    ctx.addBox(hallBox(H, a, va, b, va + 0.04, h - 0.04, h, 'trim', false));
  };
  let standEnd = v0;
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const w = W0 + (Wc - W0) * k, h = H0 + (Hc - H0) * k;
    const va = v0 + ((v1 - v0) * i) / n, vb = v0 + ((v1 - v0) * (i + 1)) / n;
    frame(va, vb, w, h);
    if (h >= 1.75) standEnd = vb;
    if (h < 1.75) s.cell.zones.push({ kind: 'crawl', aabb: hallAabb(H, cu - w / 2, va, cu + w / 2, vb, 0, h) });
  }
  frame(v1, v2, Wc, Hc);
  s.cell.zones.push({ kind: 'crawl', aabb: hallAabb(H, cu - Wc / 2, v1, cu + Wc / 2, v2, 0, Hc) });
  // 照明: トンネルの中は小さな灯りだけ
  removeLightsIn(ctx, (x, z) => { const v = H.F.v(x, z); return v > v0 - 0.2 && v < v2 + 0.2; });
  for (const k of [0.15, 0.5, 0.85]) {
    const v = v0 + (v2 - v0) * k;
    const h = k < (v1 - v0) / (v2 - v0) ? H0 + (Hc - H0) * ((v - v0) / (v1 - v0)) : Hc;
    const p = hallBox(H, cu - 0.12, v - 0.12, cu + 0.12, v + 0.12, h - 0.05, h - 0.01, 'lightWarm', false);
    ctx.addBox(p);
    s.cell.lights.push({ pos: [(p.min[0] + p.max[0]) / 2, p.min[1] - 0.15, (p.min[2] + p.max[2]) / 2], color: 0xffd2a0, intensity: 0.45, distance: 3 });
  }
  // 隠し（出現型）: トンネルの高い所（と入口の前）を、立ったまま後ろ向きに歩き続ける
  if (standEnd - v0 >= 0.8) {
    const sensor = ctx.addEntity('backward', { type: 'stateSensor', params: { aabb: aabbJson(hallAabb(H, H.F.u0, 0.2, H.F.u1, standEnd, -0.1, H.h)), when: ['backward', 'stand'], sec: t['move.crawl.backwardSec'], keepProgress: true } });
    for (const hi of ctx.rng.shuffle([true, false])) {
      const dir: Dir = sideDir(H, hi);
      const wallU = hi ? H.F.u1 : H.F.u0;
      if (Math.abs(H.entU - wallU) < 1.3) continue;
      if (s.openings.some((o) => o.dir === dir && Math.abs(H.F.v(o.pos[0], o.pos[2]) - 0.7) < 1.6)) continue;
      ctx.offerSecret({ hook: 'tunnel.backward', modes: ['appear'], weight: 1.0, revealOutput: `${sensor}.done`, doorway: { dir, at: wallAt(H, dir, wallU, 0.7), y: H.y, width: 1.0, height: 2.0 }, tell: '入口の脇の壁紙だけ、トンネルの枠と同じ向きに継ぎ目がある' });
      break;
    }
  }
  ctx.keepOut(hallAabb(H, H.F.u0, 0, H.F.u1, H.L, -0.1, H.h));
}

/** ダクト: 開口の前の床から、曲がりながら続く低い通路。部屋の残りは金属で埋める */
function buildDuct(ctx: GimmickContext): void {
  const s = ctx.slot;
  const t = ctx.tuning;
  const y = s.cell.floorY;
  const area = innerRect(s);
  const Wd = t['move.crawl.widthM'], Hd = t['move.crawl.heightM'] + 0.05;
  const hw = Wd / 2;
  // 開口の前の床（普通の高さ）
  const lands: Rect[] = s.openings.map((o) => { const z = doorZone(o, y, 1.3, 0.5); return { x0: Math.max(area.x0, z.min[0]), z0: Math.max(area.z0, z.min[2]), x1: Math.min(area.x1, z.max[0]), z1: Math.min(area.z1, z.max[2]) }; });
  // 通路: 入口の前から各開口の前へ。まず入口の前から奥へ（ずらした軸）→ 横 → 開口の前へ
  const hub = frontOf(s.entrance!, 1.3 + hw);
  const ductRects: Rect[] = [];
  const seg = (ax: number, az: number, bx: number, bz: number): void => {
    ductRects.push({ x0: Math.min(ax, bx) - hw, x1: Math.max(ax, bx) + hw, z0: Math.min(az, bz) - hw, z1: Math.max(az, bz) + hw });
  };
  const cx = (area.x0 + area.x1) / 2 + ctx.rng.float(-0.25, 0.25) * (area.x1 - area.x0);
  const cz = (area.z0 + area.z1) / 2 + ctx.rng.float(-0.25, 0.25) * (area.z1 - area.z0);
  const clampX = (x: number): number => Math.min(area.x1 - hw - 0.05, Math.max(area.x0 + hw + 0.05, x));
  const clampZ = (z: number): number => Math.min(area.z1 - hw - 0.05, Math.max(area.z0 + hw + 0.05, z));
  const mid: [number, number] = [clampX(cx), clampZ(cz)];
  // 入口の前 → 真ん中（L 字）
  const e: [number, number] = [clampX(hub[0]), clampZ(hub[2])];
  const entAlongX = s.entrance!.dir === 1 || s.entrance!.dir === 3;
  if (entAlongX) { seg(e[0], e[1], mid[0], e[1]); seg(mid[0], e[1], mid[0], mid[1]); }
  else { seg(e[0], e[1], e[0], mid[1]); seg(e[0], mid[1], mid[0], mid[1]); }
  for (const o of s.openings) {
    if (o === s.entrance) continue;
    const f = frontOf(o, 1.3 + hw);
    const p: [number, number] = [clampX(f[0]), clampZ(f[2])];
    const alongX = o.dir === 1 || o.dir === 3;
    if (alongX) { seg(mid[0], mid[1], mid[0], p[1]); seg(mid[0], p[1], p[0], p[1]); }
    else { seg(mid[0], mid[1], p[0], mid[1]); seg(p[0], mid[1], p[0], p[1]); }
  }
  // 脇の隙間と小部屋（隠しの存在型）: 開口の無い壁へ、通路の真ん中から
  let gap: Rect | null = null, room: Rect | null = null, door: { dir: Dir; at: number } | null = null;
  for (const d of ctx.rng.shuffle([0, 1, 2, 3] as Dir[])) {
    if (s.openings.some((o) => o.dir === d)) continue;
    const alongX = d === 0 || d === 2;
    const wall = d === 0 ? area.z1 : d === 2 ? area.z0 : d === 1 ? area.x1 : area.x0;
    const sg = d === 0 || d === 1 ? 1 : -1; // 壁へ向かう向き
    const from = alongX ? mid[1] : mid[0];
    const at = alongX ? mid[0] : mid[1];
    const roomD = 1.3, roomW = 1.5;
    const g0 = from + sg * hw, g1 = wall - sg * roomD;
    if ((g1 - g0) * sg < 0.6) continue;
    // 隙間の幅 0.9 m（体の幅 0.7 m がぎりぎり通る。ダクトより低く狭い）
    const gr: Rect = alongX ? { x0: at - 0.45, x1: at + 0.45, z0: Math.min(g0, g1), z1: Math.max(g0, g1) } : { x0: Math.min(g0, g1), x1: Math.max(g0, g1), z0: at - 0.45, z1: at + 0.45 };
    const rr: Rect = alongX ? { x0: at - roomW / 2, x1: at + roomW / 2, z0: Math.min(g1, wall), z1: Math.max(g1, wall) } : { x0: Math.min(g1, wall), x1: Math.max(g1, wall), z0: at - roomW / 2, z1: at + roomW / 2 };
    if ((alongX ? rr.x0 < area.x0 || rr.x1 > area.x1 : rr.z0 < area.z0 || rr.z1 > area.z1)) continue;
    if (lands.some((l) => rectGap(l, rr) < 0.3 || rectGap(l, gr) < 0.3)) continue;
    if (ductRects.some((r) => rectGap(r, rr) < 0.4)) continue;
    gap = gr; room = rr; door = { dir: d, at };
    break;
  }
  const open = [...lands, ...ductRects, ...(gap ? [gap] : []), ...(room ? [room] : [])];
  // 埋める（床から天井まで）・ダクトと隙間の上の板
  const metal: MatId = 'metal';
  for (const r of fillRects(area, open)) ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + s.cell.height, r.z1], metal));
  const over = (r: Rect, h: number): void => {
    // 開口の前の床と重なる所は高いまま（扉の前で立てる）
    for (const p of fillRects(r, lands)) ctx.addBox(box([p.x0, y + h, p.z0], [p.x1, y + s.cell.height, p.z1], metal));
  };
  for (const r of ductRects) {
    over(r, Hd);
    s.cell.zones.push({ kind: 'crawl', aabb: { min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + Hd, r.z1] } });
  }
  if (gap) {
    over(gap, Hd - 0.12);
    s.cell.zones.push({ kind: 'crawl', aabb: { min: [gap.x0, y - 0.1, gap.z0], max: [gap.x1, y + Hd - 0.12, gap.z1] } });
  }
  // 照明: 部屋の天井の照明は埋めた所の上で見えないので外し、ダクトの中に小さな灯り
  removeLightsIn(ctx, (x, z) => !lands.some((l) => x > l.x0 - 0.3 && x < l.x1 + 0.3 && z > l.z0 - 0.3 && z < l.z1 + 0.3));
  for (const r of ductRects) {
    const len = Math.max(r.x1 - r.x0, r.z1 - r.z0);
    if (len < 1.6) continue;
    const lx = (r.x0 + r.x1) / 2, lz = (r.z0 + r.z1) / 2;
    ctx.addBox(box([lx - 0.08, y + Hd - 0.03, lz - 0.08], [lx + 0.08, y + Hd - 0.005, lz + 0.08], 'lightWarm', false));
    s.cell.lights.push({ pos: [lx, y + Hd - 0.2, lz], color: 0xffd8a8, intensity: 0.35, distance: 2.6 });
  }
  if (room && door) {
    const lx = (room.x0 + room.x1) / 2, lz = (room.z0 + room.z1) / 2;
    s.cell.lights.push({ pos: [lx, y + 1.6, lz], color: 0xffc890, intensity: 0.3, distance: 2.4 });
    ctx.offerSecret({ hook: 'duct.gap', modes: ['present'], weight: 1.0, doorway: { dir: door.dir, at: door.at, y, width: 1.0, height: 2.0 }, tell: 'ダクトの途中の脇の隙間から暖かい灯りが漏れる' });
  }
  ctx.keepOut({ min: [area.x0, y - 0.1, area.z0], max: [area.x1, y + s.cell.height, area.z1] });
}
