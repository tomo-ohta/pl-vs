/**
 * 光・音・視線・時間の仕掛けの共通の作り（段階 4・担当 sense）。
 * - darkenRoom: 部屋の照明（天井のパネル・点光源）を 1 つの lamp 部品につなぐ（消えたまま / 配線で入切）
 * - wallBox: 壁 d の室内面に付ける薄い箱（ボタン・時計・印・スピーカー）
 * - lightPit: 入口と出口の壁沿いだけ固い床の、深い穴の部屋（pit.ts の planPit / buildPit。入口・出口が向かい合う部屋）
 * - pitTiles: 穴の上に並べる床板（固い床・階段の上を除く）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box, type MatId } from '../../../world/layout.ts';
import type { GimmickContext, GimmickSlot } from '../types.ts';
import { buildPit, planPit, type PitPlan } from '../pit.ts';
import { aabbJson, fillRects, freeWallSpan, frontOf, innerRect, rectGap } from '../util.ts';

/** 部屋の照明を 1 つの lamp 部品につなぐ（on: 最初に点いているか）。戻り値は lamp の id */
export function darkenRoom(ctx: GimmickContext, name = 'dark', on = false, inputs?: { [k: string]: string }, rate = 6): string {
  const s = ctx.slot;
  const lamp = ctx.addEntity(name, { type: 'lamp', params: { on, rate }, ...(inputs ? { inputs } : {}) });
  for (const b of s.cell.boxes) if (b.mat === s.cell.palette.light && !b.solid && b.max[1] - b.min[1] < 0.06 && !b.kind?.startsWith('lamp:')) b.kind = `lamp:${lamp}`;
  for (const l of s.cell.lights) if (!l.lampId) l.lampId = lamp;
  return lamp;
}

/** 壁 d の室内面の座標と、内側へ進む符号 */
export function wallCoord(ctx: GimmickContext, d: Dir): { wall: number; sg: 1 | -1 } {
  const r = innerRect(ctx.slot);
  return { wall: d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0, sg: d === 0 || d === 1 ? -1 : 1 };
}

/** 壁 d の、壁に沿った座標 at・高さ y0..y1 の位置に、壁から内側へ d0..d1 m の箱 */
export function wallBox(ctx: GimmickContext, d: Dir, at: number, half: number, y0: number, y1: number, d0: number, d1: number, mat: MatId, solid = false): Box {
  const { wall, sg } = wallCoord(ctx, d);
  const w0 = Math.min(wall + sg * d0, wall + sg * d1), w1 = Math.max(wall + sg * d0, wall + sg * d1);
  return d === 0 || d === 2 ? box([at - half, y0, w0], [at + half, y1, w1], mat, solid) : box([w0, y0, at - half], [w1, y1, at + half], mat, solid);
}

/** 壁 d の室内面の、壁に沿った at・壁から out m の点（x, z） */
export function wallPoint(ctx: GimmickContext, d: Dir, at: number, out: number): [number, number] {
  const { wall, sg } = wallCoord(ctx, d);
  return d === 0 || d === 2 ? [at, wall + sg * out] : [wall + sg * out, at];
}

/**
 * 入口と出口が向かい合う部屋の、深い穴の計画（入口・出口の壁沿いの固い床と、底から入口の床へ上がる階段）。置けなければ null。
 * まだ何も作らない（組めると決まってから buildPit で作る。途中でやめた仕掛けが部屋に箱を残さないように）
 */
export function lightPit(ctx: GimmickContext, depth: number): PitPlan | null {
  const s = ctx.slot;
  if (!s.entrance || !s.exit || s.exit.dir !== (s.entrance.dir + 2) % 4) return null;
  return planPit(ctx, { depth, strips: true });
}

export { buildPit };

/**
 * 穴の上の床板（入口の壁から v0..v1 の奥行き・壁に沿って u0..u1。大きさ tile の升目）。固い床・階段の上（plan.solidTop）に掛かる升目は除く。
 * 戻り値は [x0, z0, x1, z1] の列（u・v の升目の番号 iu・iv 付き）
 */
export function pitTiles(plan: PitPlan, tile: number, u0: number, u1: number, v0: number, v1: number): { r: number[]; iu: number; iv: number }[] {
  const F = plan.frame;
  const nu = Math.max(1, Math.round((u1 - u0) / tile)), nv = Math.max(1, Math.round((v1 - v0) / tile));
  const du = (u1 - u0) / nu, dv = (v1 - v0) / nv;
  const out: { r: number[]; iu: number; iv: number }[] = [];
  for (let iv = 0; iv < nv; iv++) for (let iu = 0; iu < nu; iu++) {
    const rr: Rect = F.rect(u0 + iu * du, v0 + iv * dv, u0 + (iu + 1) * du, v0 + (iv + 1) * dv);
    const cut = plan.solidTop.filter((q) => rectGap(q, rr) < -1e-3);
    // 固い床に掛かる升目は、掛からない所だけ残す（固い床の縁まで床板が届く。細すぎる切れ端は捨てる）
    for (const p of cut.length ? fillRects(rr, cut) : [rr]) {
      if (p.x1 - p.x0 < 0.12 || p.z1 - p.z0 < 0.12) continue;
      out.push({ r: [p.x0, p.z0, p.x1, p.z1], iu, iv });
    }
  }
  return out;
}

/**
 * 入口の前（壁から inset m）→ 出口の前の道（軸に沿う折れ線 [x, z]）。向かい合う壁ならまっすぐか Z 字（真ん中で横へ）、
 * 隣り合う壁なら L 字、同じ壁なら U 字（壁から inset + 1.5 m の所で横へ）。入口・出口が無ければ null
 */
export function routeBetween(s: GimmickSlot, inset: number): number[][] | null {
  const e = s.entrance, x = s.exit;
  if (!e || !x) return null;
  const A = frontOf(e, inset), B = frontOf(x, inset);
  const a = [A[0], A[2]], b = [B[0], B[2]];
  const alongX = e.dir === 0 || e.dir === 2; // 入口の壁が x に沿う（奥へは z）
  if (x.dir === e.dir) {
    const out = frontOf(e, inset + 1.5);
    return alongX ? [a, [a[0]!, out[2]], [b[0]!, out[2]], b] : [a, [out[0], a[1]!], [out[0], b[1]!], b];
  }
  if (x.dir === (e.dir + 2) % 4) {
    if (alongX ? Math.abs(a[0]! - b[0]!) < 0.05 : Math.abs(a[1]! - b[1]!) < 0.05) return [a, b];
    const mz = (a[1]! + b[1]!) / 2, mx = (a[0]! + b[0]!) / 2;
    return alongX ? [a, [a[0]!, mz], [b[0]!, mz], b] : [a, [mx, a[1]!], [mx, b[1]!], b];
  }
  return [a, alongX ? [a[0]!, b[1]!] : [b[0]!, a[1]!], b];
}

/** 折れ線 pts を、幅 w の矩形の列にする（家具を置かない範囲・明るい床の範囲） */
export function routeRects(pts: readonly number[][], w: number): Rect[] {
  const out: Rect[] = [];
  const h = w / 2;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!, q = pts[i]!;
    out.push({ x0: Math.min(p[0]!, q[0]!) - h, x1: Math.max(p[0]!, q[0]!) + h, z0: Math.min(p[1]!, q[1]!) - h, z1: Math.max(p[1]!, q[1]!) + h });
  }
  return out;
}

/** 区画の壁の内側の、高さ y0..y1 の AABB（部品の region） */
export function roomRegion(s: GimmickSlot, y0 = -0.5, y1 = 3): { min: number[]; max: number[] } {
  const r = innerRect(s);
  const y = s.cell.floorY;
  return { min: [r.x0, y + y0, r.z0], max: [r.x1, y + y1, r.z1] };
}

/** 開口の無い壁のうち、長さ need の空いた区間があるもの（区間の真ん中 at）。prefer の順に並べる（無ければ入口から遠い順） */
export function freeWalls(ctx: GimmickContext, need: number, prefer?: (d: Dir) => number): { d: Dir; at: number; a0: number; a1: number }[] {
  const s = ctx.slot;
  const out: { d: Dir; at: number; a0: number; a1: number }[] = [];
  for (const d of [0, 1, 2, 3] as const) {
    if (s.openings.some((o) => o.dir === d)) continue;
    const span = freeWallSpan(s, d, need, 0.8);
    if (span) out.push({ d, ...span });
  }
  const e = s.entrance?.pos;
  const score = prefer ?? ((d: Dir): number => { if (!e) return 0; const { wall } = wallCoord(ctx, d); return -(d === 0 || d === 2 ? Math.abs(wall - e[2]) : Math.abs(wall - e[0])); });
  return out.sort((p, q) => score(p.d) - score(q.d));
}

/** 7 つの線の数字（0..9）。中心 (x, y, z)・高さ h。壁 d の室内面に貼る（壁から 0.01 m） */
const SEG: Record<number, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
export function digitBoxes(ctx: GimmickContext, d: Dir, at: number, yc: number, h: number, digit: number, mat: MatId): Box[] {
  const w = h * 0.55, t = h * 0.12;
  const out: Box[] = [];
  const seg = (u0: number, v0: number, u1: number, v1: number): void => { out.push(wallBox(ctx, d, at + (u0 + u1) / 2, Math.abs(u1 - u0) / 2, yc + v0, yc + v1, 0.004, 0.012, mat)); };
  for (const c of SEG[digit] ?? '') {
    if (c === 'a') seg(-w / 2, h / 2 - t, w / 2, h / 2);
    if (c === 'g') seg(-w / 2, -t / 2, w / 2, t / 2);
    if (c === 'd') seg(-w / 2, -h / 2, w / 2, -h / 2 + t);
    if (c === 'f') seg(-w / 2, 0, -w / 2 + t, h / 2);
    if (c === 'b') seg(w / 2 - t, 0, w / 2, h / 2);
    if (c === 'e') seg(-w / 2, -h / 2, -w / 2 + t, 0);
    if (c === 'c') seg(w / 2 - t, -h / 2, w / 2, 0);
  }
  return out;
}

/** 床板の列を、到達判定のときだけ床として扱う（穴を渡れることにする） */
export function assistTiles(ctx: GimmickContext, tiles: readonly number[][], y: number): void {
  for (const r of tiles) ctx.reachAssist(box([r[0]!, y - 0.12, r[1]!], [r[2]!, y, r[3]!], ctx.slot.cell.palette.floor));
}

/** 入口の脇（広い側）の壁の位置。置けなければ null */
export function besideEntrance(ctx: GimmickContext, gap = 0.55): number | null {
  const s = ctx.slot;
  const e = s.entrance;
  if (!e) return null;
  const r = innerRect(s);
  const alongX = e.dir === 0 || e.dir === 2;
  const at = alongX ? e.pos[0] : e.pos[2];
  const [a0, a1] = alongX ? [r.x0, r.x1] : [r.z0, r.z1];
  const cands = [-1, 1].map((sg) => at + sg * (e.width / 2 + gap)).filter((a) => a > a0 + 0.35 && a < a1 - 0.35 &&
    !s.openings.some((o) => o !== e && o.dir === e.dir && Math.abs((alongX ? o.pos[0] : o.pos[2]) - a) < o.width / 2 + 0.4));
  if (!cands.length) return null;
  // 部屋の真ん中に近い側
  const mid = (a0 + a1) / 2;
  return cands.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))[0]!;
}

/** 壁 d の at に、レバー（style = 'lever' / 'switch'）を付ける。戻り値は lever の部品の id */
export function addLever(ctx: GimmickContext, name: string, d: Dir, at: number, style: 'lever' | 'switch', sec: number, extra: { [k: string]: unknown } = {}, inputs?: { [k: string]: string }): string {
  const y = ctx.slot.cell.floorY;
  const y0 = style === 'lever' ? y + 0.95 : y + 1.12, y1 = style === 'lever' ? y + 1.55 : y + 1.32;
  const half = style === 'lever' ? 0.2 : 0.07;
  // 壁の板（描画は部品の描画が足す取っ手。板は箱）
  ctx.addBox(wallBox(ctx, d, at, half, y0, y1, 0, style === 'lever' ? 0.1 : 0.015, style === 'lever' ? 'metalDark' : 'paintWhite'));
  if (style === 'lever') ctx.addBox(wallBox(ctx, d, at, 0.16, y1 + 0.06, y1 + 0.18, 0, 0.012, 'signPlate'));
  const hit = wallBox(ctx, d, at, half + 0.08, y0 - 0.05, y1 + 0.05, 0, style === 'lever' ? 0.3 : 0.12, 'metalDark');
  const [px, pz] = wallPoint(ctx, d, at, style === 'lever' ? 0.1 : 0.015);
  // レバーの前（幅 1.2 m・奥行き 1.4 m）に家具を置かない（台車がレバーの前に置かれて手が届かないことがあった）
  const front = wallBox(ctx, d, at, 0.6, y, y + 2.0, 0, 1.4, 'void');
  ctx.keepOut({ min: front.min, max: front.max });
  const { wall } = wallCoord(ctx, d);
  return ctx.addEntity(name, { type: 'lever', params: { box: aabbJson(hit), sec, style, dir: d, wall, at, pos: [px, (y0 + y1) / 2, pz], ...extra } as never, ...(inputs ? { inputs } : {}) });
}
