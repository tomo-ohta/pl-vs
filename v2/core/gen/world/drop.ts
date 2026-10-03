/**
 * 落ちる所（docs/endless-world.md 13・14 章）: 床の穴・崩れた床の下・沈む床の縦穴の、暗い縦穴と出口。
 *
 * 穴（hole の矩形）の下の、darkTop より下を真っ黒な壁（void）で囲んだ縦穴にする（深さ world.hole.depthM）。底は塞ぐ。
 * 出口の shaft: anchor は縦穴の暗い所の上の真ん中（ここから world.hole.transferM 落ちたら、行き先の階の同じ升目の着く部屋の縦穴へ移る。
 * WorldSession）。aabb は移れなかったときの、暗転して移る所（底の手前）。区画の外形の下端を縦穴の底まで下げる（落ちた人を
 * 落下の判定（Sim の killY）で戻さない）
 */
import type { Tuning } from '../../config/tuning.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, type Box, type CellLayout, type FloorExit } from '../../world/layout.ts';

export interface DropShaft {
  boxes: Box[];
  exit: FloorExit;
  /** 区画の外形の下端（これより上なら下げる） */
  minY: number;
}

/**
 * hole の下の縦穴。y は床の高さ、darkTop は暗い壁の始まり（穴の縁から下の、部屋の壁の続き（穴の側壁）は呼ぶ側が作る）。
 * to は行き先の階（'depth.variant'）。wallAt が true の辺は、側壁を矩形の外側へ出さない（部屋の壁の中へ）
 */
export function dropShaft(id: string, hole: Rect, y: number, darkTop: number, to: string, t: Tuning, o: { lift?: string; kind?: FloorExit['kind'] } = {}): DropShaft {
  const D = t['world.hole.depthM'];
  const T = 0.12;
  const bottom = y - D;
  const boxes: Box[] = [
    box([hole.x0 - T, bottom - 0.2, hole.z0 - T], [hole.x0, darkTop, hole.z1 + T], 'void'),
    box([hole.x1, bottom - 0.2, hole.z0 - T], [hole.x1 + T, darkTop, hole.z1 + T], 'void'),
    box([hole.x0, bottom - 0.2, hole.z0 - T], [hole.x1, darkTop, hole.z0], 'void'),
    box([hole.x0, bottom - 0.2, hole.z1], [hole.x1, darkTop, hole.z1 + T], 'void'),
    box([hole.x0, bottom - 0.2, hole.z0], [hole.x1, bottom, hole.z1], 'void'),
  ];
  const cx = (hole.x0 + hole.x1) / 2, cz = (hole.z0 + hole.z1) / 2;
  const exit: FloorExit = {
    id, kind: o.kind ?? 'hole', aabb: { min: [hole.x0, bottom, hole.z0], max: [hole.x1, bottom + 3, hole.z1] }, to: { floor: to },
    shaft: { anchor: [cx, darkTop, cz], zone: { min: [hole.x0, bottom - 0.2, hole.z0], max: [hole.x1, darkTop - 0.3, hole.z1] }, ...(o.lift ? { lift: o.lift } : {}) },
  };
  return { boxes, exit, minY: bottom - 0.2 };
}

/** 区画の外形の下端を、縦穴の底まで下げる */
export function lowerBounds(cell: CellLayout, minY: number): void {
  cell.bounds.min[1] = Math.min(cell.bounds.min[1], minY);
}

/** 1 つ下の階（同じ表・裏） */
export const storyBelow = (depth: number, variant: number): string => `${depth + 1}.${variant}`;
