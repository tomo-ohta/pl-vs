/**
 * 足元の部屋（footingRoom）: 部屋の床全部が普通でない。扉を開けた瞬間に床の様子で分かる。
 *
 * - ice 氷 [v1 L19・M32]: 床一面が氷（止まれない・曲がれない）。ざらざらの敷物の上だけ止まれる。氷の割れ目（冷たい水の穴）に
 *   落ちると入口から（失敗の代償 = 位置を失う）。割れ目は入口から出口へのまっすぐな道の上に置き、敷物で止まって向きを変える。
 *   隠し（存在型 ice.corner）: 開口から遠い壁の前に扉。手前の氷が薄く（割れ目）、そっと近づかないと落ちる
 * - wax 滑る床 [QR M10]: 磨いて濡れた床（氷より少し止まりやすい）。床の点検口が開いている（落ちると入口から）。「濡れた床」の看板
 * - mud 泥 [M31]: 床一面のぬかるみ（遅い・足が沈む）。板の道を渡れば普通に歩ける（板の間は泥）。流砂で立ち止まると沈んで
 *   飲み込まれ、入口から（歩き続ければ沈まない）
 * どれも開口の前（扉を開ける所）は普通の床。
 */
import type { Rng } from '../../../math/rng.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { pitShell } from '../pit.ts';
import { aabbJson, cutFloorSlab, doorZone, fillRects, freeWallSpan, frontOf, innerRect, inward, rectGap, unreachableSpot } from '../util.ts';

type Variant = 'ice' | 'wax' | 'mud';

defineGimmick({
  id: 'footingRoom', name: '足元の部屋', axes: ['floor', 'move'], kinds: ['room', 'hall'], minSize: [4.0, 5.5], weight: 0.9, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const t = ctx.tuning;
    const v = ctx.rng.weighted(['ice', 'wax', 'mud'] as Variant[], (k) => t[`move.foot.w.${k}`] + 1e-6);
    if (v === 'mud') buildMud(ctx);
    else buildSlip(ctx, v);
  },
});

/** 開口の前（普通の床で残す所）の矩形 */
function landings(ctx: GimmickContext, depth: number): Rect[] {
  const s = ctx.slot;
  return s.openings.map((o) => {
    const z = doorZone(o, s.cell.floorY, depth, 0.5);
    return { x0: z.min[0], z0: z.min[2], x1: z.max[0], z1: z.max[2] };
  });
}

/** 入口の前へ戻す位置と向き（部屋の中を向く） */
function backAt(ctx: GimmickContext): { to: number[]; toYaw: number } {
  const e = ctx.slot.entrance!;
  const f = frontOf(e, 0.9);
  const [ix, iz] = inward(e);
  return { to: [f[0], ctx.slot.cell.floorY + 0.05, f[2]], toYaw: Math.atan2(-ix, -iz) };
}

/** 矩形を床の上に薄く敷く（見た目だけ） */
function overlay(ctx: GimmickContext, r: Rect, mat: MatId, h: number, kind?: string): void {
  const y = ctx.slot.cell.floorY;
  const b = ctx.addBox(box([r.x0, y, r.z0], [r.x1, y + h, r.z1], mat, false));
  if (kind) b.kind = kind;
}

/** 穴の候補: 入口から出口へのまっすぐな線の近く（横へずらす）。ほかの穴・開口の前・敷物と離す */
function pickHoles(rng: Rng, area: Rect, avoid: Rect[], from: [number, number], to: [number, number], n: number, size: [number, number]): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < 60 && out.length < n; i++) {
    const k = rng.float(0.25, 0.8);
    const w = rng.float(size[0], size[1]), d = rng.float(size[0], size[1]);
    const lx = -(to[1] - from[1]), lz = to[0] - from[0];
    const ll = Math.hypot(lx, lz) || 1;
    const off = rng.float(-1.2, 1.2);
    const cx = from[0] + (to[0] - from[0]) * k + (lx / ll) * off, cz = from[1] + (to[1] - from[1]) * k + (lz / ll) * off;
    const r: Rect = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 };
    if (r.x0 < area.x0 + 0.45 || r.x1 > area.x1 - 0.45 || r.z0 < area.z0 + 0.45 || r.z1 > area.z1 - 0.45) continue;
    if (avoid.some((a) => rectGap(a, r) < 0.7) || out.some((o) => rectGap(o, r) < 1.1)) continue;
    // 閉じ込めない: 穴を足しても、床（穴の外）は入口の前からどこへでも歩ける
    if (unreachableSpot(area, [...out, r], from, 0.45, 0.15) !== null) continue;
    out.push(r);
  }
  return out;
}

/** 落ちると入口からの穴（氷の割れ目・床の点検口）。穴の側壁・底・水面と、戻す範囲 */
function buildHole(ctx: GimmickContext, r: Rect, name: string, water: boolean): void {
  const y = ctx.slot.cell.floorY;
  const depth = ctx.tuning['move.foot.holeDepthM'];
  cutFloorSlab(ctx.slot, r);
  pitShell(ctx, r, depth);
  if (water) ctx.addBox(box([r.x0, y - depth, r.z0], [r.x1, y - 0.35, r.z1], 'water', false));
  ctx.addEntity(`${name}Back`, { type: 'respawnZone', params: { aabb: aabbJson({ min: [r.x0, y - depth - 0.1, r.z0], max: [r.x1, y - 0.25, r.z1] }), ...backAt(ctx) } });
}

function buildSlip(ctx: GimmickContext, v: 'ice' | 'wax'): void {
  const s = ctx.slot;
  const t = ctx.tuning;
  const y = s.cell.floorY;
  const area = innerRect(s);
  const lands = landings(ctx, 1.3);
  const ent = frontOf(s.entrance!, 0.8), ex = frontOf(s.exit!, 0.8);
  // 穴（氷の割れ目 / 床の点検口）: 入口から出口への線の上
  const n = Math.max(1, Math.min(4, Math.round(((area.x1 - area.x0) * (area.z1 - area.z0)) / 12)));
  const holes = pickHoles(ctx.rng.fork('holes'), area, lands, [ent[0], ent[2]], [ex[0], ex[2]], n, v === 'ice' ? [1.0, 1.6] : [0.9, 1.3]);
  if (!holes.length) return;
  // 隠し（存在型・氷だけ）: 開口から遠い壁の前の扉。手前に薄い氷の割れ目
  let secretHole: Rect | null = null;
  if (v === 'ice') {
    const dirs = ([0, 1, 2, 3] as const).filter((d) => !s.openings.some((o) => o.dir === d));
    for (const d of ctx.rng.shuffle([...dirs])) {
      const span = freeWallSpan(s, d, 2.2, 0.9);
      if (!span) continue;
      const along = d === 0 || d === 2;
      const wall = d === 0 ? area.z1 : d === 2 ? area.z0 : d === 1 ? area.x1 : area.x0;
      const sg = d === 0 || d === 1 ? -1 : 1;
      // 扉の前 0.9 m は氷（立てる）、その手前 0.9 m が割れ目
      const a0 = span.at - 0.6, a1 = span.at + 0.6, b0 = wall + sg * 0.95, b1 = wall + sg * 1.85;
      const r: Rect = along ? { x0: a0, x1: a1, z0: Math.min(b0, b1), z1: Math.max(b0, b1) } : { x0: Math.min(b0, b1), x1: Math.max(b0, b1), z0: a0, z1: a1 };
      if (lands.some((l) => rectGap(l, r) < 0.6) || holes.some((h) => rectGap(h, r) < 0.9)) continue;
      if (unreachableSpot(area, [...holes, r], [ent[0], ent[2]], 0.45, 0.15) !== null) continue;
      secretHole = r;
      ctx.offerSecret({ hook: 'ice.corner', modes: ['present'], weight: 0.9, doorway: { dir: d, at: span.at, y, width: 1.0, height: 2.0 }, tell: '奥の壁際だけ氷が青く厚い' });
      break;
    }
  }
  const allHoles = secretHole ? [...holes, secretHole] : holes;
  allHoles.forEach((h, i) => buildHole(ctx, h, `hole${i}`, v === 'ice'));
  // 止まれる所（ざらざらの敷物）: 穴のそば・部屋のあちこち
  const mats: Rect[] = [];
  const M = t['move.foot.matM'];
  for (let i = 0; i < 80 && mats.length < t['move.foot.mats']; i++) {
    const cx = ctx.rng.float(area.x0 + M / 2 + 0.2, area.x1 - M / 2 - 0.2), cz = ctx.rng.float(area.z0 + M / 2 + 0.2, area.z1 - M / 2 - 0.2);
    const r: Rect = { x0: cx - M / 2, x1: cx + M / 2, z0: cz - M / 2, z1: cz + M / 2 };
    if (allHoles.some((h) => rectGap(h, r) < 0.25) || lands.some((l) => rectGap(l, r) < 0.4) || mats.some((m) => rectGap(m, r) < 0.9)) continue;
    mats.push(r);
  }
  for (const m of mats) overlay(ctx, m, 'rubber', 0.018, 'footingMat');
  // 滑る床: 開口の前・敷物・穴を除いた所
  const slip = fillRects(area, [...lands, ...mats, ...allHoles]);
  const friction = v === 'ice' ? t['move.foot.iceFriction'] : t['move.foot.waxFriction'];
  for (const r of slip) {
    s.cell.zones.push({ kind: 'friction', aabb: { min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 1.0, r.z1] }, params: { friction } });
    overlay(ctx, r, v === 'ice' ? 'ice' : 'marbleWhite', 0.012, v === 'ice' ? 'iceSheet' : 'waxFloor');
  }
  if (v === 'ice') {
    s.cell.palette = { ...s.cell.palette, lightColor: 0xd6ecff };
    for (const l of s.cell.lights) l.color = 0xd6ecff;
  } else {
    s.cell.render = { ...(s.cell.render ?? {}), floorWetness: 0.85 };
    // 「濡れた床」の看板（黄色い三角の立て看板）: 入口の前の脇
    const [ix, iz] = inward(s.entrance!);
    const e = frontOf(s.entrance!, 1.1);
    const sx = e[0] + iz * 0.9, sz = e[2] - ix * 0.9;
    ctx.addBox(box([sx - 0.2, y, sz - 0.12], [sx + 0.2, y + 0.62, sz + 0.12], 'plasticYellow', true));
  }
  ctx.keepOut({ min: [area.x0, y - 2, area.z0], max: [area.x1, y + 3, area.z1] });
}

function buildMud(ctx: GimmickContext): void {
  const s = ctx.slot;
  const t = ctx.tuning;
  const y = s.cell.floorY;
  const area = innerRect(s);
  const lands = landings(ctx, 1.2);
  const ent = frontOf(s.entrance!, 0.9), ex = frontOf(s.exit!, 0.9);
  // 板の道: 入口の前 → 曲がり角（どちらかの軸を先に）→ 出口の前。板と板の間は泥（0.3〜0.6 m）
  const corner: [number, number] = ctx.rng.chance(0.5) ? [ex[0], ent[2]] : [ent[0], ex[2]];
  const pts: [number, number][] = [[ent[0], ent[2]], corner, [ex[0], ex[2]]];
  const planks: Rect[] = [];
  const W = 0.62;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.3) continue;
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    let d = 0;
    while (d < len) {
      const l = Math.min(len - d, ctx.rng.float(0.9, 1.4));
      const x0 = a[0] + ux * d, z0 = a[1] + uz * d, x1 = a[0] + ux * (d + l), z1 = a[1] + uz * (d + l);
      // 道は軸に沿う（曲がり角で 1 回曲がる）: 進む向きに長く、横に W
      planks.push(Math.abs(ux) > 0.5
        ? { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: z0 - W / 2, z1: z0 + W / 2 }
        : { x0: x0 - W / 2, x1: x0 + W / 2, z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
      d += l + ctx.rng.float(0.3, 0.6);
    }
  }
  const boards = planks.filter((p) => p.x0 > area.x0 && p.x1 < area.x1 && p.z0 > area.z0 && p.z1 < area.z1 && !lands.some((l) => rectGap(l, p) < -0.05));
  for (const p of boards) ctx.addBox(box([p.x0, y, p.z0], [p.x1, y + 0.06, p.z1], 'floorWood', true));
  // 流砂: 板の道から離れた泥の所
  const traps: Rect[] = [];
  const Q = t['move.foot.quickM'];
  for (let i = 0; i < 60 && traps.length < 2; i++) {
    const cx = ctx.rng.float(area.x0 + Q / 2 + 0.3, area.x1 - Q / 2 - 0.3), cz = ctx.rng.float(area.z0 + Q / 2 + 0.3, area.z1 - Q / 2 - 0.3);
    const r: Rect = { x0: cx - Q / 2, x1: cx + Q / 2, z0: cz - Q / 2, z1: cz + Q / 2 };
    if (boards.some((b) => rectGap(b, r) < 0.5) || lands.some((l) => rectGap(l, r) < 0.6) || traps.some((q) => rectGap(q, r) < 1)) continue;
    traps.push(r);
  }
  const back = backAt(ctx);
  traps.forEach((r, i) => {
    ctx.addEntity(`quick${i}`, { type: 'sinkTrap', params: { aabb: aabbJson({ min: [r.x0, y - 0.2, r.z0], max: [r.x1, y + 1.0, r.z1] }), sec: t['move.foot.quickSec'], depth: 0.9, ...back } });
    overlay(ctx, r, 'puddle', 0.016, 'quicksand');
  });
  // ぬかるみ: 開口の前・板を除いた所
  for (const r of fillRects(area, [...lands, ...boards])) {
    s.cell.zones.push({ kind: 'water', aabb: { min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 0.6, r.z1] }, params: { dry: true, slow: t['move.foot.mudSlow'], sink: t['move.foot.mudSink'], mud: true } });
    overlay(ctx, r, 'plantSoil', 0.01, 'mud');
  }
  s.cell.render = { ...(s.cell.render ?? {}), floorWetness: 0.5 };
  ctx.keepOut({ min: [area.x0, y - 1, area.z0], max: [area.x1, y + 3, area.z1] });
}
