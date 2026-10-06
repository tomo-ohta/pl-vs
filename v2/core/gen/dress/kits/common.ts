/**
 * 部屋の中身の作り方で共通に使う補助: 主の矩形・入口・壁の空いた区間・隅の鉢植え・壁の飾り・壁際に並べる。
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { along } from '../../../world/footprint.ts';
import { WALL_T, type Box, type MatId, type WallOpening } from '../../../world/layout.ts';
import { build, canPlace, maybe, touchesSolid, type DressCtx } from '../ctx.ts';
import { addDecor, board, extinguisher, papers, wallBands, wallClock, whiteboard } from '../decor.ts';
import { chair, lockerBank } from '../furniture.ts';
import { alongFace, facePoint, freeRuns, isFloorOpening, onFace, type Face } from '../geom.ts';
import { desk, plant, type DeskOpts } from '../props.ts';

/** いちばん広い矩形 */
export function mainRect(c: DressCtx): Rect {
  return c.rects.reduce((a, r) => ((r.x1 - r.x0) * (r.z1 - r.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? r : a));
}

/** 主の矩形の面（pred を満たす物を長い順） */
export function mainFaces(c: DressCtx, pred: (f: Face) => boolean = () => true, r: Rect = mainRect(c)): Face[] {
  return c.faces.filter((f) => f.rect === r && pred(f)).sort((a, b) => (b.a1 - b.a0) - (a.a1 - a.a0));
}

/** 面の最長の空き区間（同じ壁の開口 ± pad を除く） */
export function longestRun(c: DressCtx, f: Face, pad = 1.0): [number, number] | null {
  const runs = freeRuns(f, c.openings, pad).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
  return runs[0] ?? null;
}

/** 入口（1 つ目の床の高さの開口。無ければ 1 つ目） */
export function entrance(c: DressCtx): WallOpening | null {
  return c.openings.find((s) => isFloorOpening(s, c.y0)) ?? c.openings[0] ?? null;
}

/** 開口が載っている面 */
export function faceOf(c: DressCtx, s: WallOpening | null): Face | null {
  return s ? c.faces.find((f) => onFace(f, s)) ?? null : null;
}

/** 面 f に向かい合う主の矩形の面（同じ軸・反対向き） */
export function oppositeFace(c: DressCtx, f: Face): Face | null {
  const d = (f.dir + 2) % 4;
  return mainFaces(c, (g) => g.dir === d)[0] ?? null;
}

/** 開口の数（面ごと） */
export const openingsCount = (c: DressCtx, f: Face): number => c.openings.filter((s) => onFace(f, s)).length;

/** 巾木（全周） */
export function skirting(c: DressCtx, mat: MatId = 'trim'): void {
  wallBands(c, [{ y0: 0, y1: 0.1, mat, depth: 0.014 }]);
}

/** 区間 [a0, a1]（面に沿った座標）に幅 w の物を gap 間隔で中央寄せに並べ、置ける物だけ置く。置いた数を返す */
export function lineUp(c: DressCtx, a0: number, a1: number, w: number, gap: number, make: (B: Box[], at: number, k: number) => void, max = 99): number {
  const n = Math.min(max, Math.floor((a1 - a0 + gap) / (w + gap)));
  if (n <= 0) return 0;
  const start = (a0 + a1) / 2 - (n * (w + gap) - gap) / 2;
  let placed = 0;
  for (let k = 0; k < n; k++) if (build(c, (B) => make(B, start + k * (w + gap), k))) placed++;
  return placed;
}

/** 隅に鉢植えを n 個まで（入口・扉前は避ける）。置いた数を返す */
export function cornerPlants(c: DressCtx, n: number, size = 0.5, h = 1.3, pot: MatId = 'furnitureDark'): number {
  if (n <= 0) return 0;
  const pts: [number, number][] = [];
  const m = WALL_T + c.standoff + size / 2 + 0.05;
  for (const r of c.rects) pts.push([r.x0 + m, r.z0 + m], [r.x1 - m, r.z0 + m], [r.x0 + m, r.z1 - m], [r.x1 - m, r.z1 - m]);
  let placed = 0;
  for (const [x, z] of c.rng.shuffle(pts)) {
    if (placed >= n) break;
    if (build(c, (B) => plant(B, x, z, size, h, pot), { gap: 0.15 })) placed++;
  }
  return placed;
}

export type WallItem = 'clock' | 'board' | 'whiteboard' | 'picture' | 'extinguisher';

/** 空いた壁に飾りを max 個まで（時計・掲示板・白板・額・消火器）。入口の面を後回しにする */
export function wallExtras(c: DressCtx, items: readonly WallItem[], max = 2): number {
  if (!items.length) return 0;
  let n = 0;
  const faces = c.rng.shuffle(c.faces.filter((f) => f.a1 - f.a0 >= 1.6));
  for (const f of faces) {
    if (n >= max) break;
    const runs = freeRuns(f, c.openings, 0.6).filter(([p, q]) => q - p >= 1.4);
    if (!runs.length) continue;
    const [p, q] = c.rng.pick(runs);
    const item = c.rng.pick(items);
    const w = item === 'board' || item === 'whiteboard' ? Math.min(1.8, q - p - 0.4) : 0.6;
    const t = c.rng.float(p + 0.2 + w / 2, q - 0.2 - w / 2);
    const B: Box[] = [];
    // 壁際の家具の高さより上に掛ける（家具の前に出る所は placeUnit が足跡の内側かだけ見るので、高さで逃がす）
    switch (item) {
      case 'clock': wallClock(B, f, t, Math.min(c.h - 0.35, 2.3)); break;
      case 'board': board(B, f, t, w, 1.25, Math.min(2.1, c.h - 0.3), 'noticeGreen'); papers(B, c.rng, f, t, w, 1.25, Math.min(2.1, c.h - 0.3), c.rng.int(2, 4)); break;
      case 'whiteboard': whiteboard(B, f, t, w, 1.0, Math.min(1.9, c.h - 0.4)); break;
      case 'picture': board(B, f, t, c.rng.float(0.5, 0.9), 1.35, Math.min(1.35 + c.rng.float(0.4, 0.7), c.h - 0.3), c.rng.pick(['wallDark', 'seatBlue', 'upholstery', 'noticeGreen', 'skyDusk'] as MatId[]), 'goldTrim'); break;
      case 'extinguisher': extinguisher(B, f, t); break;
    }
    if (B.some((b) => touchesSolid(c, b, 0.06))) continue;
    if (B.length && addDecor(c, B)) n++;
  }
  return n;
}

/** 壁に向かう机と椅子（面 f の at..at+w）。机の向こう側を壁に付ける */
export function deskAgainst(c: DressCtx, f: Face, at: number, o: DeskOpts = {}, seat: MatId = 'seatBlue', withChair = true): boolean {
  const w = o.w ?? 1.2, d = o.d ?? 0.6;
  const [x, z] = facePoint(f, at + w / 2, c.standoff + d / 2);
  const [px, pz] = facePoint(f, at + w / 2, c.standoff + d + 0.3);
  return build(c, (B) => {
    desk(B, x, z, f.dir, { ...o, w, d });
    if (withChair && !c.rng.chance(0.1)) chair(B, px, pz, f.dir, seat);
  });
}

/** 開口の位置（辺に沿った座標） */
export const openingAt = (s: WallOpening): number => along(s.dir, s.pos[0], s.pos[2]);

/** 室内向きの Dir（面 f の前から部屋の中を見る向き） */
export const inward = (f: Face): Dir => ((f.dir + 2) % 4) as Dir;

/** density に応じて 0..max の整数（平均 mean × density 補正） */
export function count(c: DressCtx, mean: number, max: number): number {
  let n = 0;
  for (let k = 0; k < max; k++) if (maybe(c, Math.min(1, mean - k))) n++;
  return n;
}

/**
 * 空いた壁のどこかに幅 w の物を 1 つ置く（面・空き区間・位置を乱数で選んで tries 回まで試す）。置けたら true。
 * make は面 f の at..at+w に物を組む
 */
export function onSomeWall(c: DressCtx, w: number, make: (B: Box[], f: Face, at: number) => void, o: { pad?: number; faces?: readonly Face[]; tries?: number } = {}): boolean {
  const faces = (o.faces ?? c.faces).filter((f) => f.a1 - f.a0 >= w + 0.3);
  for (let i = 0; i < (o.tries ?? 8) && faces.length; i++) {
    const f = c.rng.pick(faces);
    const runs = freeRuns(f, c.openings, o.pad ?? 0.9).filter(([p, q]) => q - p >= w + 0.2);
    if (!runs.length) continue;
    const [p, q] = c.rng.pick(runs);
    const at = c.rng.float(p + 0.1, q - 0.1 - w);
    if (build(c, (B) => make(B, f, at))) return true;
  }
  return false;
}

/** ロッカーを a0..a1 に 0.4 単位で並べる（v1 lockersAlong と同じ並べ方。置けない台を飛ばし、続いた台を 1 列ずつ置く）。置いた台数を返す */
export function lockerRun(c: DressCtx, f: Face, a0: number, a1: number, mat: MatId, standoff = c.standoff, height = 1.8): number {
  const n = Math.floor((a1 - a0 - 0.1) / 0.4);
  if (n <= 0) return 0;
  const start = a0 + (a1 - a0 - n * 0.4) / 2;
  let run = -1;
  let placed = 0;
  const flush = (end: number): void => {
    if (run >= 0 && end > run && build(c, (B) => lockerBank(B, f, start + run * 0.4, end - run, standoff, 0.5, height, mat))) placed += end - run;
    run = -1;
  };
  for (let k = 0; k < n; k++) {
    const ok = canPlace(c, [alongFace(f, start + k * 0.4, 0.4, standoff, standoff + 0.5, 0, height, mat)]);
    if (ok && run < 0) run = k;
    if (!ok) flush(k);
  }
  flush(n);
  return placed;
}
