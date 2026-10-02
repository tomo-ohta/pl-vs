/**
 * 穴の部屋（崩れる床・細い梁の網）と溝の共通の作り。
 *
 * - pitShell: 穴の底と側壁。側壁は、部屋の壁に接する辺では壁の厚みの中（床から上の壁と同じ所）に置く。
 *   穴の内側に置くと、壁際に幅 0.15 m の縁が床の高さに残り、体（幅 0.7 m）の端が掛かって壁沿いに歩いて渡れてしまう
 * - planPit / buildPit: 部屋の床ほぼ全体を深い穴にする。開口の前は柱で支えた固い床（奥行き gimmick.pit.landingM）。
 *   strips なら入口・出口の壁は端から端まで固い床（梁の網）。穴の底から入口の床へ上がる階段を穴の壁沿いに 1 本だけ付ける
 *   （落ちたら入口からやり直し。ほかの開口の前へは上がれない）。階段の下の端の先は 0.9 m 以上空ける（壁に突き当たった
 *   一段目には体が乗れない）。底はどこからでも階段の下まで歩ける（柱で区切られた所が無い）ことを格子で確かめる
 * - pitSecret: 穴の底の壁に隠しの入口（落ちた人だけが見つける）
 */
import type { Dir } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, DOOR_W, WALL_T, type Box, type WallOpening } from '../../world/layout.ts';
import type { GimmickContext, SecretOffer } from './types.ts';
import { cutFloorSlab, innerRect, rectGap, unreachableSpot, wallFrame, type WallFrame } from './util.ts';

/** 穴の底と側壁（depth は床からの深さ）。部屋の壁に接する辺の側壁は壁の厚みの中に置く */
export function pitShell(ctx: GimmickContext, hole: Rect, depth: number): void {
  const s = ctx.slot;
  const y = s.cell.floorY;
  const r = innerRect(s);
  const mat = s.cell.palette.wall;
  const t = 0.15;
  // 区画の外形の下端を穴の底まで下げる（隠し場所・下の階の区画が穴の中に入り込まないように。段階 4 で足した）
  s.cell.bounds.min[1] = Math.min(s.cell.bounds.min[1], y - depth - 0.2);
  ctx.addBox(box([hole.x0, y - depth - 0.2, hole.z0], [hole.x1, y - depth, hole.z1], s.cell.palette.floor));
  const atWall = { x0: Math.abs(hole.x0 - r.x0) < 1e-3, x1: Math.abs(hole.x1 - r.x1) < 1e-3, z0: Math.abs(hole.z0 - r.z0) < 1e-3, z1: Math.abs(hole.z1 - r.z1) < 1e-3 };
  // 各辺の壁の厚みの範囲（外: 壁の中 / 内: 穴の内側）
  const xa = atWall.x0 ? [hole.x0 - WALL_T, hole.x0] : [hole.x0, hole.x0 + t];
  const xb = atWall.x1 ? [hole.x1, hole.x1 + WALL_T] : [hole.x1 - t, hole.x1];
  const za = atWall.z0 ? [hole.z0 - WALL_T, hole.z0] : [hole.z0, hole.z0 + t];
  const zb = atWall.z1 ? [hole.z1, hole.z1 + WALL_T] : [hole.z1 - t, hole.z1];
  ctx.addBox(box([xa[0]!, y - depth - 0.2, za[0]!], [xa[1]!, y, zb[1]!], mat));
  ctx.addBox(box([xb[0]!, y - depth - 0.2, za[0]!], [xb[1]!, y, zb[1]!], mat));
  ctx.addBox(box([xa[1]!, y - depth - 0.2, za[0]!], [xb[0]!, y, za[1]!], mat));
  ctx.addBox(box([xa[1]!, y - depth - 0.2, zb[0]!], [xb[0]!, y, zb[1]!], mat));
}

/** 穴の内側（側壁を除いた、底を歩ける・上に床板や梁を置ける範囲） */
export function pitInner(ctx: GimmickContext, hole: Rect): Rect {
  const r = innerRect(ctx.slot);
  const t = 0.15;
  return {
    x0: Math.abs(hole.x0 - r.x0) < 1e-3 ? hole.x0 : hole.x0 + t, x1: Math.abs(hole.x1 - r.x1) < 1e-3 ? hole.x1 : hole.x1 - t,
    z0: Math.abs(hole.z0 - r.z0) < 1e-3 ? hole.z0 : hole.z0 + t, z1: Math.abs(hole.z1 - r.z1) < 1e-3 ? hole.z1 : hole.z1 - t,
  };
}

export interface PitPlan {
  y: number;
  depth: number;
  hole: Rect;
  /** 開口の前の固い床（strips なら入口・出口の壁の全幅） */
  landings: { o: WallOpening; rect: Rect }[];
  entry: Rect;
  exit: Rect | null;
  /** 階段の上から入口の床へつなぐ細い固い床 */
  ledge: Rect | null;
  /** 階段の段（上から順。top は上面の高さ） */
  steps: { rect: Rect; top: number }[];
  /** 階段の範囲（上は開いている） */
  lane: Rect;
  /** 階段の下の端の前（底からここへ歩けば上れる） */
  foot: [number, number];
  /** 上の段の固い所・開いた所（床板・梁を置かない） */
  solidTop: Rect[];
  /** 底で塞がる所（柱・階段） */
  bottomBlocks: Rect[];
  frame: WallFrame;
}

export interface PitOptions {
  depth: number;
  /** 入口・出口の壁を端から端まで固い床にする（入口と出口が向かい合うときだけ） */
  strips?: boolean;
  /** 階段を入口の壁沿い（入口の床の横）に付ける案を先に試す（崩れる床。渡る所を広く空ける） */
  preferAlongEntry?: boolean;
  /** 底の塞がりに足す物（梁の網の柱） */
  extraBlocks?: Rect[];
}

/** 穴の部屋の計画。置けなければ null */
export function planPit(ctx: GimmickContext, o: PitOptions): PitPlan | null {
  const s = ctx.slot;
  const t = ctx.tuning;
  const y = s.cell.floorY;
  const hole = innerRect(s);
  const ent = s.entrance;
  if (!ent) return null;
  const landD = t['gimmick.pit.landingM'];
  const Fe = wallFrame(hole, ent.dir);
  const onWall = (op: WallOpening): boolean => {
    const wallC = op.dir === 0 ? s.rect.z1 : op.dir === 2 ? s.rect.z0 : op.dir === 1 ? s.rect.x1 : s.rect.x0;
    return Math.abs((op.dir % 2 === 0 ? op.pos[2] : op.pos[0]) - wallC) < 0.3;
  };
  if (!s.openings.every(onWall)) return null;
  if (o.strips && (!s.exit || s.exit.dir !== (ent.dir + 2) % 4)) return null;
  // 開口の前の固い床
  const local = (op: WallOpening): Rect => {
    const F = wallFrame(hole, op.dir);
    const at = F.u(op.pos[0], op.pos[2]);
    const hw = op.width / 2 + 0.45;
    return F.rect(Math.max(F.u0, at - hw), 0, Math.min(F.u1, at + hw), landD);
  };
  const landings: { o: WallOpening; rect: Rect }[] = s.openings.map((op) => {
    if (o.strips && (op === ent || op === s.exit)) { const F = wallFrame(hole, op.dir); return { o: op, rect: F.rect(F.u0, 0, F.u1, landD) }; }
    return { o: op, rect: local(op) };
  });
  // 固い床どうしが近すぎる（つながると穴を渡らずに済む）なら諦める
  for (let i = 0; i < landings.length; i++) for (let j = 0; j < i; j++) if (rectGap(landings[i]!.rect, landings[j]!.rect) < 1.0) return null;
  const entry = landings.find((l) => l.o === ent)!.rect;
  const exit = s.exit ? landings.find((l) => l.o === s.exit)!.rect : null;
  const others = landings.filter((l) => l.o !== ent).map((l) => l.rect);
  // 階段: 段数 n（n + 1 回の段差で床に上がる）
  const riseMax = t['gimmick.pit.stairRise'], tread = t['gimmick.pit.stairTread'];
  const n = Math.max(1, Math.ceil(o.depth / riseMax) - 1);
  const rise = o.depth / (n + 1);
  const run = n * tread;
  const SW = 1.1;
  // 入口の床（局所の座標）
  const eu0 = Fe.u(entry.x0, entry.z0), eu1 = Fe.u(entry.x1, entry.z1);
  const Le = { u0: Math.min(eu0, eu1), u1: Math.max(eu0, eu1) };
  type Cand = { lane: Rect; ledge: Rect | null; steps: { rect: Rect; top: number }[]; foot: [number, number] };
  const cands: Cand[] = [];
  const stepTop = (j: number): number => y - rise * (j + 1);
  const alongEntry = (side: -1 | 1): Cand | null => {
    // 入口の壁沿い、入口の床の横から部屋の隅の方へ下りる
    const u = side < 0 ? Le.u0 : Le.u1;
    const end = u + side * run;
    if (side < 0 ? end - 0.9 < Fe.u0 : end + 0.9 > Fe.u1) return null;
    const steps = [...Array(n).keys()].map((j) => ({ rect: Fe.rect(u + side * j * tread, 0, u + side * (j + 1) * tread, SW), top: stepTop(j) }));
    return { lane: Fe.rect(u, 0, end, SW), ledge: null, steps, foot: Fe.point(end + side * 0.45, SW / 2) };
  };
  const alongSide = (side: -1 | 1): Cand | null => {
    // 入口の壁の隣の壁沿いに、入口の壁の方へ上る。上の端は入口の床か、入口の床から延ばした細い床
    const l0 = side < 0 ? Fe.u0 : Fe.u1 - SW, l1 = side < 0 ? Fe.u0 + SW : Fe.u1;
    const covers = side < 0 ? Le.u0 <= l0 + 1e-3 : Le.u1 >= l1 - 1e-3;
    const partial = side < 0 ? Le.u0 < l1 : Le.u1 > l0;
    let ledge: Rect | null = null, attach = landD;
    if (!covers) {
      if (partial) ledge = side < 0 ? Fe.rect(Fe.u0, 0, Le.u0, landD) : Fe.rect(Le.u1, 0, Fe.u1, landD);
      else { ledge = side < 0 ? Fe.rect(Fe.u0, 0, Le.u0, SW) : Fe.rect(Le.u1, 0, Fe.u1, SW); attach = SW; }
    }
    if (o.strips) attach = landD;
    const end = attach + run;
    if (end + 0.9 > Fe.depth) return null;
    const steps = [...Array(n).keys()].map((j) => ({ rect: Fe.rect(l0, attach + j * tread, l1, attach + (j + 1) * tread), top: stepTop(j) }));
    return { lane: Fe.rect(l0, attach, l1, end), ledge, steps, foot: Fe.point((l0 + l1) / 2, end + 0.45) };
  };
  const sides: (-1 | 1)[] = ctx.rng.chance(0.5) ? [-1, 1] : [1, -1];
  const order: (Cand | null)[] = [];
  if (o.preferAlongEntry && !o.strips) for (const sd of sides) order.push(alongEntry(sd));
  for (const sd of sides) order.push(alongSide(sd));
  if (!o.preferAlongEntry && !o.strips) for (const sd of sides) order.push(alongEntry(sd));
  for (const c of order) if (c) cands.push(c);
  for (const c of cands) {
    // 階段・細い床が、ほかの開口の前の床に近すぎない（細い床が出口の床につながると穴を渡らずに済む）
    if (others.some((r) => rectGap(r, c.lane) < 0.3 || (c.ledge && rectGap(r, c.ledge) < 0.9))) continue;
    const bottomBlocks = [...landings.map((l) => l.rect), c.lane, ...(c.ledge ? [c.ledge] : []), ...(o.extraBlocks ?? [])];
    // 底はどこからでも階段の下へ歩ける
    if (unreachableSpot(hole, bottomBlocks, c.foot) !== null) continue;
    return {
      y, depth: o.depth, hole, landings, entry, exit, ledge: c.ledge, steps: c.steps, lane: c.lane, foot: c.foot,
      solidTop: [...landings.map((l) => l.rect), c.lane, ...(c.ledge ? [c.ledge] : [])], bottomBlocks, frame: Fe,
    };
  }
  return null;
}

/** 計画どおりに穴・固い床・階段を作る */
export function buildPit(ctx: GimmickContext, p: PitPlan): void {
  const s = ctx.slot;
  const y = p.y;
  cutFloorSlab(s, p.hole);
  pitShell(ctx, p.hole, p.depth);
  // 固い床: 柱（壁の材質）と床板（床の材質）
  const solid = (r: Rect): void => {
    ctx.addBox(box([r.x0, y - p.depth, r.z0], [r.x1, y - 0.15, r.z1], s.cell.palette.wall));
    ctx.addBox(box([r.x0, y - 0.15, r.z0], [r.x1, y, r.z1], s.cell.palette.floor));
  };
  for (const l of p.landings) solid(l.rect);
  if (p.ledge) solid(p.ledge);
  for (const st of p.steps) {
    const b: Box = box([st.rect.x0, y - p.depth, st.rect.z0], [st.rect.x1, st.top, st.rect.z1], s.cell.palette.floor);
    ctx.addBox(b);
  }
  // 落ちた先の灯り（底をぼんやり照らす）
  const cx = (p.hole.x0 + p.hole.x1) / 2, cz = (p.hole.z0 + p.hole.z1) / 2;
  s.cell.lights.push({ pos: [cx, y - p.depth + 1.8, cz], color: 0xbfd0e0, intensity: 0.4, distance: Math.max(6, Math.hypot(p.hole.x1 - p.hole.x0, p.hole.z1 - p.hole.z0) * 0.6) });
}

/** 穴の底の壁の隠しの入口（存在型）。固い床の柱・階段の無い壁の区間から選ぶ。置けなければ null */
export function pitSecret(ctx: GimmickContext, p: PitPlan, hook: string, tell: string): SecretOffer | null {
  const cands: { dir: Dir; at: number; len: number }[] = [];
  for (const d of [0, 1, 2, 3] as const) {
    const F = wallFrame(p.hole, d);
    const blocked: [number, number][] = [];
    for (const r of p.bottomBlocks) {
      const v0 = Math.min(F.v(r.x0, r.z0), F.v(r.x1, r.z1));
      if (v0 > 1.0) continue;
      const a = F.u(r.x0, r.z0), b = F.u(r.x1, r.z1);
      blocked.push([Math.min(a, b) - 0.3, Math.max(a, b) + 0.3]);
    }
    blocked.sort((a, b) => a[0] - b[0]);
    let cur = F.u0 + 0.5;
    const runs: [number, number][] = [];
    for (const [a, b] of blocked) { if (a > cur) runs.push([cur, a]); cur = Math.max(cur, b); }
    if (F.u1 - 0.5 > cur) runs.push([cur, F.u1 - 0.5]);
    for (const [a, b] of runs) if (b - a >= DOOR_W + 0.2) cands.push({ dir: d, at: (a + b) / 2, len: b - a });
  }
  if (!cands.length) return null;
  // 入口の壁は避ける（落ちてすぐ目の前に無い方が見つけた感じがする）
  const pool = cands.filter((c) => c.dir !== p.frame.d);
  const pick = ctx.rng.weighted(pool.length ? pool : cands, (c) => c.len);
  return { hook, modes: ['present'], weight: 1.2, doorway: { dir: pick.dir, at: pick.at, y: p.y - p.depth, width: 1.0, height: 2.0 }, tell };
}
