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
 * - 落ちる穴（drop。14 章）: 底も階段も無い。穴の側壁は上の gimmick.pit.litM だけ部屋の壁の続きで、その下は暗い縦穴（落ちると
 *   1 つ下の階の着く部屋へ）。開口の前の固い床どうしは gimmick.pit.minGapM 以上離す（走って跳んでも渡れない）。
 *   gimmick.pit.catwalkChance の確率で、穴の中の gimmick.pit.catwalkDepthM の深さに細い足場（下の細い足場）: 渡る所の真ん中の下から
 *   横の壁へ曲がり、壁の隠しの扉へ。運よく足場の上に落ちれば隠しへ行ける（pitSecret はこの扉を出す）
 */
import type { Dir } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, DOOR_W, WALL_T, type Box, type WallOpening } from '../../world/layout.ts';
import type { GimmickContext, SecretOffer } from './types.ts';
import { cutFloorSlab, fillRects, innerRect, rectGap, unreachableSpot, wallFrame, type WallFrame } from './util.ts';
import { dropShaft, lowerBounds, storyBelow } from '../world/drop.ts';

/** 穴の中の細い足場（下の細い足場）と、その先の壁の隠しの扉 */
export interface Catwalk { rects: Rect[]; door: { dir: Dir; at: number }; y: number }

/** 枠 F の u0 側（hi = false）/ u1 側の横の壁の外向き */
function sideDir(F: WallFrame, hi: boolean): Dir {
  const a = F.point(hi ? F.u1 : F.u0, 0), b = F.point((F.u0 + F.u1) / 2, 0);
  const dx = a[0] - b[0], dz = a[1] - b[1];
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 0 : 2;
}

/**
 * 下の細い足場の計画（gimmick.pit.catwalkChance）: 渡る向き（枠 F の v。v0 から v1）の真ん中の下を通り、横の壁へ曲がる。avoid（固い床・柱）
 * から離す。置かないときは null
 */
export function planCatwalk(ctx: GimmickContext, hole: Rect, F: WallFrame, v0: number, v1: number, avoid: readonly Rect[], at?: number, o: { force?: boolean; va?: number; vb?: number } = {}): Catwalk | null {
  const t = ctx.tuning;
  if (!o.force && !ctx.rng.chance(t['gimmick.pit.catwalkChance'])) return null;
  const W = 0.8, span = v1 - v0;
  if (span < 3.0 || F.u1 - F.u0 < 3.2) return null;
  const uc = at !== undefined ? Math.max(F.u0 + 1.2, Math.min(F.u1 - 1.2, at)) : (F.u0 + F.u1) / 2 + ctx.rng.float(-0.25, 0.25) * (F.u1 - F.u0 - 2.4);
  const va = o.va ?? v0 + span * 0.22, vb = o.vb ?? v0 + span * 0.72;
  const hi = ctx.rng.chance(0.5);
  const segA = F.rect(uc - W / 2, va, uc + W / 2, vb);
  const segB = hi ? F.rect(uc + W / 2, vb - W, F.u1, vb) : F.rect(F.u0, vb - W, uc - W / 2, vb);
  if (avoid.some((r) => rectGap(r, segA) < 0.5 || rectGap(r, segB) < 0.5)) return null;
  const dir = sideDir(F, hi);
  const [dx, dz] = F.point(hi ? F.u1 : F.u0, vb - W / 2);
  void hole;
  return { rects: [segA, segB], door: { dir, at: dir % 2 === 0 ? dx : dz, }, y: ctx.slot.cell.floorY - t['gimmick.pit.catwalkDepthM'] };
}

/**
 * 穴の上の低い下がり壁（gimmick.pit.soffitM の高さから天井まで。穴より 0.3 m 広く）: 跳んで渡れない。歩いては通れる。
 * keep は付けない所（振り子の払う所。そこは振り子が跳ぶ人を払う）
 */
export function addSoffit(ctx: GimmickContext, hole: Rect, keep?: Rect): void {
  const s = ctx.slot, y = s.cell.floorY, top = y + s.cell.height, h = y + ctx.tuning['gimmick.pit.soffitM'];
  if (top - h < 0.1) return;
  const r = innerRect(s);
  const all: Rect = { x0: Math.max(r.x0, hole.x0 - 0.3), z0: Math.max(r.z0, hole.z0 - 0.3), x1: Math.min(r.x1, hole.x1 + 0.3), z1: Math.min(r.z1, hole.z1 + 0.3) };
  for (const q of keep ? fillRects(all, [keep]) : [all]) {
    if (Math.min(q.x1 - q.x0, q.z1 - q.z0) < 0.05) continue;
    soffitBox(ctx, box([q.x0, h, q.z0], [q.x1, top, q.z1], s.cell.palette.ceiling), h);
  }
}

function soffitBox(ctx: GimmickContext, b: Box, h: number): void {
  const s = ctx.slot;
  ctx.addBox(b);
  // 天井の照明は下がり壁の下へ
  for (const l of s.cell.lights) if (l.pos[0] > b.min[0] && l.pos[0] < b.max[0] && l.pos[2] > b.min[2] && l.pos[2] < b.max[2] && l.pos[1] > h) l.pos = [l.pos[0], h - 0.15, l.pos[2]];
  ctx.removeBoxes((x) => !x.solid && x.min[1] > h - 0.05 && x.max[0] > b.min[0] && x.min[0] < b.max[0] && x.max[2] > b.min[2] && x.min[2] < b.max[2] && x.max[1] - x.min[1] < 0.1);
  if (b.max[0] - b.min[0] > 1.0 && b.max[2] - b.min[2] > 1.0) ctx.addBox(box([b.min[0] + 0.4, h - 0.02, b.min[2] + 0.4], [b.min[0] + 0.9, h, b.min[2] + 0.9], s.cell.palette.light, false));
}

/** 穴の側壁（y0 から y1 まで。部屋の壁に接する辺は壁の厚みの中。底は作らない） */
export function pitWalls(ctx: GimmickContext, hole: Rect, y0: number, y1: number): void {
  const r = innerRect(ctx.slot);
  const mat = ctx.slot.cell.palette.wall;
  const t = 0.15;
  const atWall = { x0: Math.abs(hole.x0 - r.x0) < 1e-3, x1: Math.abs(hole.x1 - r.x1) < 1e-3, z0: Math.abs(hole.z0 - r.z0) < 1e-3, z1: Math.abs(hole.z1 - r.z1) < 1e-3 };
  const xa = atWall.x0 ? [hole.x0 - WALL_T, hole.x0] : [hole.x0, hole.x0 + t];
  const xb = atWall.x1 ? [hole.x1, hole.x1 + WALL_T] : [hole.x1 - t, hole.x1];
  const za = atWall.z0 ? [hole.z0 - WALL_T, hole.z0] : [hole.z0, hole.z0 + t];
  const zb = atWall.z1 ? [hole.z1, hole.z1 + WALL_T] : [hole.z1 - t, hole.z1];
  ctx.addBox(box([xa[0]!, y0, za[0]!], [xa[1]!, y1, zb[1]!], mat));
  ctx.addBox(box([xb[0]!, y0, za[0]!], [xb[1]!, y1, zb[1]!], mat));
  ctx.addBox(box([xa[1]!, y0, za[0]!], [xb[0]!, y1, za[1]!], mat));
  ctx.addBox(box([xa[1]!, y0, zb[0]!], [xb[0]!, y1, zb[1]!], mat));
}

/**
 * 落ちる穴を作る: 側壁（上の litM）・その下の暗い縦穴と出口（1 つ下の階へ）・下の細い足場（catwalk）と、その前の暗い灯り
 */
export function buildDropPit(ctx: GimmickContext, hole: Rect, catwalk: Catwalk | null): void {
  const s = ctx.slot, t = ctx.tuning, y = s.cell.floorY;
  const lit = t['gimmick.pit.litM'];
  pitWalls(ctx, hole, y - lit, y);
  const ds = dropShaft(`${ctx.id}:drop`, hole, y, y - lit, storyBelow(ctx.floor.depth, ctx.floor.variant ?? 0), t);
  for (const b of ds.boxes) ctx.addBox(b);
  lowerBounds(s.cell, ds.minY);
  ctx.addExit?.(ds.exit);
  if (!catwalk) return;
  for (const r of catwalk.rects) {
    const b = box([r.x0, catwalk.y - 0.2, r.z0], [r.x1, catwalk.y, r.z1], 'metal');
    b.narrow = true;
    ctx.addBox(b);
  }
  // 足場の先（隠しの扉の前）の暗い灯り: 上から覗くと、穴の中にかすかに足場が見える
  const r = catwalk.rects[catwalk.rects.length - 1]!;
  s.cell.lights.push({ pos: [(r.x0 + r.x1) / 2, catwalk.y + 1.4, (r.z0 + r.z1) / 2], color: 0xc8d6e8, intensity: 0.3, distance: 4 });
}

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
  /** 落ちる穴（drop）: 底・階段が無い。catwalk は下の細い足場 */
  drop?: boolean;
  catwalk?: Catwalk | null;
  /** 穴の上の低い下がり壁（跳んで渡れない。歩いては通れる）。'manual' は仕掛けが自分で付ける（振り子の払う所を除く） */
  soffit?: boolean | 'manual';
}

export interface PitOptions {
  depth: number;
  /** 落ちる穴（底も階段も無い。落ちると 1 つ下の階へ。14 章） */
  drop?: boolean;
  /** 落ちる穴で、固い床どうしが近い（跳んで届く）ときに、穴の上に低い下がり壁を付けてよい（乗り物の部屋は false。
   *  'manual' は付けてよいが仕掛けが自分で付ける（振り子の部屋: 振り子の払う所を除いて付ける）） */
  soffit?: boolean | 'manual';
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
  if (o.drop) {
    // 落ちる穴: 固い床どうしは走って跳んでも届かないだけ離す（近ければ、穴の上に低い下がり壁を付けて跳べなくする）。
    // 階段は無い（落ちたら 1 つ下の階）
    let minG = Infinity;
    for (let i = 0; i < landings.length; i++) for (let j = 0; j < i; j++) minG = Math.min(minG, rectGap(landings[i]!.rect, landings[j]!.rect));
    let soffit: boolean | 'manual' = false;
    if (minG < t['gimmick.pit.minGapM']) {
      if (o.soffit === false || minG < 2.2 || s.cell.height < t['gimmick.pit.soffitM'] + 0.15) return null;
      soffit = o.soffit === 'manual' ? 'manual' : true;
    }
    // 階段の列は無い（穴の角の、幅の無い矩形。階段の列から離す計算が穴の幅をほとんど削らない）
    const far = Fe.rect(Fe.u0 - 0.02, 0, Fe.u0, 0.02);
    const v1 = exit ? Fe.depth - landD : Fe.depth - 0.4;
    const catwalk = planCatwalk(ctx, hole, Fe, landD, v1, landings.map((l) => l.rect));
    return {
      y, depth: o.depth, hole, landings, entry, exit, ledge: null, steps: [], lane: far, foot: [(hole.x0 + hole.x1) / 2, (hole.z0 + hole.z1) / 2],
      solidTop: landings.map((l) => l.rect), bottomBlocks: landings.map((l) => l.rect), frame: Fe, drop: true, catwalk, soffit,
    };
  }
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
  if (p.drop) {
    cutFloorSlab(s, p.hole);
    buildDropPit(ctx, p.hole, p.catwalk ?? null);
    // 固い床: 柱は暗い所の上まで（下は暗くて見えない）
    const lit = ctx.tuning['gimmick.pit.litM'];
    if (p.soffit === true) addSoffit(ctx, p.hole);
    for (const l of p.landings) {
      ctx.addBox(box([l.rect.x0, y - lit, l.rect.z0], [l.rect.x1, y - 0.15, l.rect.z1], s.cell.palette.wall));
      ctx.addBox(box([l.rect.x0, y - 0.15, l.rect.z0], [l.rect.x1, y, l.rect.z1], s.cell.palette.floor));
    }
    return;
  }
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
  // 落ちる穴: 下の細い足場の先の壁（足場が無ければ隠しは無い）
  if (p.drop) return p.catwalk ? catwalkSecret(p.catwalk, hook, tell) : null;
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

/**
 * 渡った先（出口の床）の横の壁の隠し（落ちる穴を渡りきった人へのご褒美。出現型にして使う）。出口の床の横が部屋の壁でなければ null
 */
export function farSideSecret(p: PitPlan, hook: string, tell: string): SecretOffer | null {
  const ex = p.exit;
  if (!ex) return null;
  const F = p.frame;
  const v = (Math.min(F.v(ex.x0, ex.z0), F.v(ex.x1, ex.z1)) + Math.max(F.v(ex.x0, ex.z0), F.v(ex.x1, ex.z1))) / 2;
  const hi = (Math.min(F.u(ex.x0, ex.z0), F.u(ex.x1, ex.z1)) + Math.max(F.u(ex.x0, ex.z0), F.u(ex.x1, ex.z1))) / 2 < (F.u0 + F.u1) / 2;
  const dir = sideDir(F, hi);
  const [dx, dz] = F.point(hi ? F.u1 : F.u0, v);
  if (Math.abs(Math.max(F.v(ex.x0, ex.z0), F.v(ex.x1, ex.z1)) - Math.min(F.v(ex.x0, ex.z0), F.v(ex.x1, ex.z1))) < 1.3) return null;
  return { hook, modes: ['present'], weight: 1.0, doorway: { dir, at: dir % 2 === 0 ? dx : dz, y: p.y, width: 1.0, height: 2.0 }, tell };
}

/** 下の細い足場の先の壁の隠し（存在型・必ず付ける。足場だけあって行き先が無い、にしない） */
export function catwalkSecret(c: Catwalk, hook: string, tell: string): SecretOffer {
  return { hook, modes: ['present'], weight: 1.4, required: true, doorway: { dir: c.door.dir, at: c.door.at, y: c.y, width: 1.0, height: 2.0 }, floorY: c.y, tell: `${tell}（穴の中の細い足場の先）` };
}

