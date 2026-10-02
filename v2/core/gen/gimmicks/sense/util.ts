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
import type { GimmickContext } from '../types.ts';
import { buildPit, planPit, type PitPlan } from '../pit.ts';
import { fillRects, innerRect, rectGap } from '../util.ts';

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

/** 床板の列を、到達判定のときだけ床として扱う（穴を渡れることにする） */
export function assistTiles(ctx: GimmickContext, tiles: readonly number[][], y: number): void {
  for (const r of tiles) ctx.reachAssist(box([r[0]!, y - 0.12, r[1]!], [r[2]!, y, r[3]!], ctx.slot.cell.palette.floor));
}
