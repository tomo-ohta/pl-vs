/**
 * 高い所へ上がる部屋（riseHall）: 天井の高い部屋の、開口の無い壁に沿って、だんだん高くなる棚（固い台）が並ぶ。
 * 床から 1 段目、1 段目から 2 段目 … を、変種ごとの「縦につなぐ物」で上がる。一番上の棚の奥の壁に、通気口の扉（隠し・存在型
 * rise.top。上り切った人だけが見つける）と、小さな光る物（見つけた印）。床の通り道（開口どうし）はそのまま歩ける。
 * - springs ばね床の連続 [M36・BM03]: 床と棚の上の弾む床で、次の棚へ跳ね上がる（一度の跳びでは届かない高さ）
 * - updraft 上昇気流 [M21]: 床と棚の上の格子から風が吹き上がり、乗ると浮き上がって次の棚へ
 * - ladder はしご [M13]: 棚の側面のはしごを上る（はしごへ向かって押すと上る・離れる向きで下りる）
 * 落ちても床へ戻るだけ（時間を失う）。
 */
import type { Dir } from '../../../math/vec.ts';
import { box, kinded, type Box, type MatId } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, freeWallSpan, frontOf, innerRect, wallFrame } from '../util.ts';

type Variant = 'springs' | 'updraft' | 'ladder';
const G = 9.8;

defineGimmick({
  id: 'riseHall', name: '高い所へ上がる部屋', axes: ['body', 'move'], kinds: ['room', 'hall'], minSize: [4.5, 6], minHeight: 3.4, weight: 0.8, intensity: 1, offersSecret: true, onMainPath: true,
  build(ctx) {
    const t = ctx.tuning;
    const v = ctx.rng.weighted(['springs', 'updraft', 'ladder'] as Variant[], (k) => t[`move.rise.w.${k}`] + 1e-6);
    build(ctx, v);
  },
});

function build(ctx: GimmickContext, variant: Variant): void {
  const s = ctx.slot;
  const t = ctx.tuning;
  const y = s.cell.floorY, h = s.cell.height;
  const D = t['move.rise.ledgeDepthM'], Lw = t['move.rise.ledgeLenM'];
  const rise = t['move.rise.stepM'];
  // 段の数: 一番上の棚に立てて、奥の壁に扉（高さ 2.1 m）が収まる高さまで
  const n = Math.floor((h - 2.2) / rise);
  if (n < 1) return;
  // 棚を並べる壁: 開口の無い壁で、棚の長さ × 段の数 + 1 段目の前の余裕が取れる
  const need = n * Lw + 0.6;
  const walls = ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => !s.openings.some((o) => o.dir === d)));
  for (const d of walls) {
    const span = freeWallSpan(s, d, need, 0.6);
    if (!span) continue;
    const F = wallFrame(innerRect(s), d);
    if (F.depth < D + 3.2) continue;
    // 向き: 段は u の増える向きか減る向きに上っていく
    const up = ctx.rng.chance(0.5) ? 1 : -1;
    const u0 = up > 0 ? span.a0 + 0.3 : span.a1 - 0.3;
    const ledges: { a: number; b: number; top: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p = u0 + up * i * Lw, q = u0 + up * (i + 1) * Lw;
      ledges.push({ a: Math.min(p, q), b: Math.max(p, q), top: rise * (i + 1) });
    }
    // 床の通り道（開口の前どうし）から離れていること（弾む床・上昇気流の柱は棚の正面から 1 m まで）
    const zoneRect = F.rect(Math.min(...ledges.map((l) => l.a)) - 0.2, 0, Math.max(...ledges.map((l) => l.b)) + 0.2, D + 1.05);
    const fronts = s.openings.map((o) => frontOf(o, 1.2));
    const segNear = fronts.some((a, i) => fronts.some((b, j) => j > i && segRectDist([a[0], a[2]], [b[0], b[2]], zoneRect) < 0.4));
    if (segNear || fronts.some((f) => f[0] > zoneRect.x0 - 0.5 && f[0] < zoneRect.x1 + 0.5 && f[2] > zoneRect.z0 - 0.5 && f[2] < zoneRect.z1 + 0.5)) continue;
    place(ctx, variant, F, ledges, D, up, d);
    return;
  }

  function place(c: GimmickContext, v: Variant, F: ReturnType<typeof wallFrame>, ls: { a: number; b: number; top: number }[], depth: number, dirUp: number, d: Dir): void {
    const mat: MatId = c.rng.pick(['woodPanel', 'columnConcrete', 'shelfMetal'] as const);
    // 棚（床から天板まで固い台）。歩く人が段の上を足場として見るよう kind 'landing'
    for (const l of ls) {
      const r = F.rect(l.a, 0, l.b, depth);
      c.addBox(box([r.x0, y, r.z0], [r.x1, y + l.top - 0.06, r.z1], mat));
      const topB = kinded([r.x0, y + l.top - 0.06, r.z0], [r.x1, y + l.top, r.z1], 'floorWood', 'landing');
      c.addBox(topB);
    }
    // 縦につなぐ物: 床 → 1 段目（棚の正面）、i 段目 → i+1 段目（次の棚の横の面の前、i 段目の天板の上）
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i]!;
      const base = i === 0 ? 0 : ls[i - 1]!.top;
      const dh = l.top - base;
      if (i === 0) {
        // 正面（v = depth の面）。床の上
        const cu = (l.a + l.b) / 2;
        // 弾む床・上昇気流の格子は棚の面に接する（跳ね上がりながら棚の上へ出る）
        connector(c, v, F, `c${i}`, { u0: cu - 0.5, u1: cu + 0.5, v0: depth, v1: depth + 0.9 }, base, dh, { du: 0, dv: -1 }, { u0: cu - 0.45, u1: cu + 0.45, v0: depth - 0.3, v1: depth + 0.55 }, { u: cu, v: depth, face: 'v' });
      } else {
        // 前の棚の天板の上、次の棚の横の面（u = l.a か l.b）の前
        const face = dirUp > 0 ? l.a : l.b;
        const away = dirUp > 0 ? -1 : 1;
        const pv = depth / 2;
        const pad = { u0: Math.min(face + away * 0.9, face), u1: Math.max(face + away * 0.9, face), v0: pv - 0.45, v1: pv + 0.45 };
        const climb = { u0: Math.min(face + away * 0.55, face - away * 0.3), u1: Math.max(face + away * 0.55, face - away * 0.3), v0: pv - 0.4, v1: pv + 0.4 };
        connector(c, v, F, `c${i}`, pad, base, dh, { du: -away, dv: 0 }, climb, { u: face, v: pv, face: 'u' });
      }
    }
    // 一番上の棚: 見つけた印と、奥の壁の通気口の扉（存在型）
    const topL = ls[ls.length - 1]!;
    const cu = (topL.a + topL.b) / 2;
    const [mx, mz] = F.point(cu + (topL.b - topL.a) * 0.3 * (dirUp > 0 ? 1 : -1), depth * 0.5);
    c.addBox(box([mx - 0.1, y + topL.top, mz - 0.1], [mx + 0.1, y + topL.top + 0.24, mz + 0.1], 'goldTrim', false));
    const [dx, dz] = F.point(cu, 0);
    c.offerSecret({ hook: 'rise.top', modes: ['present'], weight: 1.0, doorway: { dir: d, at: d === 0 || d === 2 ? dx : dz, y: y + topL.top, width: 1.0, height: 2.0 }, tell: '一番上の棚の奥の壁に、通気口の格子とすきま風' });
    const all = F.rect(Math.min(...ls.map((l) => l.a)) - 0.4, 0, Math.max(...ls.map((l) => l.b)) + 0.4, depth + 1.3);
    c.keepOut({ min: [all.x0, y - 0.1, all.z0], max: [all.x1, y + h, all.z1] });
  }

  /**
   * 縦につなぐ物を 1 つ置く。pad: 弾む床・上昇気流の柱の範囲（u, v）/ toward: はしごへ向かう向き（u, v の単位）/
   * climb: はしごのゾーンの範囲（棚の天板に少し掛かる）/ face: はしごの横木を付ける面
   */
  function connector(c: GimmickContext, v: Variant, F: ReturnType<typeof wallFrame>, name: string, pad: { u0: number; u1: number; v0: number; v1: number }, base: number, dh: number, toward: { du: number; dv: number }, climb: { u0: number; u1: number; v0: number; v1: number }, face: { u: number; v: number; face: 'u' | 'v' }): void {
    const yb = y + base;
    if (v === 'springs') {
      const r = F.rect(pad.u0, pad.v0, pad.u1, pad.v1);
      const b: Box = box([r.x0, yb, r.z0], [r.x1, yb + 0.08, r.z1], 'plasticYellow', false);
      b.kind = 'bouncePad';
      c.addBox(b);
      const speed = Math.sqrt(2 * G * (dh + t['move.rise.overshootM']));
      c.addEntity(name, { type: 'bouncePad', params: { aabb: aabbJson({ min: [r.x0, yb - 0.1, r.z0], max: [r.x1, yb + 0.4, r.z1] }), speed } });
    } else if (v === 'updraft') {
      // 柱は次の棚の天板に 0.2 m 掛ける（浮き上がりながら棚の上へ出られる）
      const ext = toward.dv !== 0 ? { ...pad, v0: pad.v0 - 0.2 } : toward.du > 0 ? { ...pad, u1: pad.u1 + 0.2 } : { ...pad, u0: pad.u0 - 0.2 };
      const r = F.rect(ext.u0, ext.v0, ext.u1, ext.v1);
      const g = F.rect(pad.u0, pad.v0, pad.u1, pad.v1);
      const grate = c.addBox(box([g.x0, yb, g.z0], [g.x1, yb + 0.02, g.z1], 'shelfMetal', false));
      grate.kind = 'grate';
      c.addEntity(name, { type: 'flowZone', params: { aabb: aabbJson({ min: [r.x0, yb - 0.1, r.z0], max: [r.x1, yb + dh + 0.25, r.z1] }), vector: [0, 1, 0], speed: t['move.rise.updraftSpeed'], visual: 'updraft', cue: false } });
    } else {
      const r = F.rect(climb.u0, climb.v0, climb.u1, climb.v1);
      const dir = (() => { const a = F.point(0, 0), b = F.point(toward.du, toward.dv); return [b[0] - a[0], 0, b[1] - a[1]] as [number, number, number]; })();
      c.addZone({ kind: 'climb', aabb: { min: [r.x0, yb - 0.05, r.z0], max: [r.x1, yb + dh + 0.45, r.z1] }, vector: dir });
      // 横木（見た目だけ。面から 5 cm 手前）
      for (let k = 0.3; k < dh; k += 0.3) {
        const off = face.face === 'v' ? F.rect(face.u - 0.25, face.v, face.u + 0.25, face.v + 0.05) : F.rect(face.u - 0.05 * Math.sign(toward.du || 1), face.v - 0.25, face.u, face.v + 0.25);
        c.addBox(box([off.x0, yb + k - 0.02, off.z0], [off.x1, yb + k + 0.02, off.z1], 'metal', false));
      }
    }
  }
}

/** 線分 a-b と矩形の距離（交われば 0） */
function segRectDist(a: [number, number], b: [number, number], r: { x0: number; z0: number; x1: number; z1: number }): number {
  let best = Infinity;
  for (let k = 0; k <= 20; k++) {
    const x = a[0] + ((b[0] - a[0]) * k) / 20, z = a[1] + ((b[1] - a[1]) * k) / 20;
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}
