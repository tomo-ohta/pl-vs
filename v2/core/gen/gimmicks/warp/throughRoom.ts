/**
 * 扉が向かい合う 2 枚の小さな部屋（別の空間の部屋）。2 つの扉が同じ部屋へ（twoDoors）の居間、時間で入れ替わる扉（timedDoors）の青い部屋・琥珀の部屋。
 *
 * 局所の座標（makeFrame: u = 扉 A から奥へ・v = 左）で、扉 A は u = 0・v = 0、扉 B は u = depth・v = vb。
 * 中身（家具）は横の 2 つの壁沿い（扉の前 1.3 m は空ける）。置いても両方の扉へ歩けなければ置かない。
 */
import type { Dir } from '../../../math/vec.ts';
import { opening } from '../../../world/build.ts';
import { themePalette } from '../../../world/palettes.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type MatId, type Palette, type WallOpening } from '../../../world/layout.ts';
import { lowTable, plant, rug, sofa } from '../../dress/props.ts';
import { reachOpenings } from '../../reach.ts';
import type { GimmickContext } from '../types.ts';
import { addPocketCell, ceilingLight, pocketCell, type Frame } from './pocket.ts';

export type ThroughStyle = 'lounge' | 'blue' | 'amber';

const PALETTES: Record<ThroughStyle, Partial<Palette>> = {
  lounge: { floor: 'floorCarpetRed', wall: 'wallGreen', ceiling: 'ceilingWhite', light: 'lightWarm', lightColor: 0xffd7a8, lightIntensity: 0.95 },
  blue: { floor: 'floorCarpetGrey', wall: 'wallWhite', ceiling: 'ceilingTile', light: 'lightPanel', lightColor: 0xcfe2ff, lightIntensity: 1.0 },
  amber: { floor: 'floorWood', wall: 'wallCream', ceiling: 'ceilingWhite', light: 'lightWarm', lightColor: 0xffbf73, lightIntensity: 0.9 },
};
const NAMES: Record<ThroughStyle, string> = { lounge: '居間', blue: '青い部屋', amber: '琥珀の部屋' };

export interface ThroughRoom { cell: CellLayout; opA: WallOpening; opB: WallOpening }

export function buildThroughRoom(ctx: GimmickContext, f: Frame, o: { id: string; depth: number; width: number; vb: number; floorY: number; height: number; style: ThroughStyle }): ThroughRoom {
  const { id, depth: D, width: W, vb, floorY: y, height: H, style } = o;
  const v0 = Math.min(0, vb) - (W - Math.abs(vb)) / 2, v1 = v0 + W;
  const pal: Palette = { ...themePalette('SmallRoom'), ...PALETTES[style] } as Palette;
  const opA = opening(`${id}:a`, f.p(0, 0, 0), f.dir(2), DOOR_W, DOOR_H);
  const opB = opening(`${id}:b`, f.p(D, 0, vb), f.dir(0), DOOR_W, DOOR_H);
  const cell = pocketCell({ id, pocket: ctx.id, rects: [f.rect(0, v0, D, v1)], height: H, floorY: y, palette: pal, openings: [opA, opB], theme: 'SmallRoom', name: NAMES[style] });
  ceilingLight(cell, f, D * 0.3, (v0 + v1) / 2, H, false, true, 0.9, 6);
  ceilingLight(cell, f, D * 0.7, (v0 + v1) / 2, H, false, true, 0.9, 6);
  // 横の壁: L は扉 B と反対の側、R は扉 B の側（局所 v の壁の内面）
  const side = Math.sign(vb) || 1;
  const wallL = side > 0 ? v0 + WALL_T : v1 - WALL_T;
  const wallR = side > 0 ? v1 - WALL_T : v0 + WALL_T;
  const inL = -Math.sign(wallL - wallR), inR = -Math.sign(wallR - wallL); // 壁から部屋の内へ
  const B: Box[] = [];
  const lift = (from: number, group: string): void => { for (let i = from; i < B.length; i++) { const b = B[i]!; b.min[1] += y; b.max[1] += y; b.propGroup = `${id}/${group}`; } };
  const put = (u0: number, y0: number, a0: number, u1: number, y1: number, a1: number, wall: number, inn: number, mat: MatId, solid = true): void => {
    const a = f.aabb(u0, y0, wall + inn * a0, u1, y1, wall + inn * a1);
    B.push(box(a.min, a.max, mat, solid));
  };
  const facing = (inn: number): Dir => f.dir(inn > 0 ? 1 : 3) as Dir;
  let k = 0;
  const mid = f.p(D / 2, 0, (wallL + wallR) / 2);
  if (style === 'lounge') {
    // 長椅子（L の壁）・テレビ（R の壁）・低い机・敷物・隅の鉢植え
    const sc = f.p(D / 2, 0, wallL + inL * 0.45);
    k = B.length; sofa(B, sc[0], sc[2], 2.0, facing(inL), 'upholstery', 0.85); lift(k, 'sofa');
    put(D / 2 - 0.6, 0, 0.05, D / 2 + 0.6, 0.5, 0.5, wallR, inR, 'furnitureDark');
    put(D / 2 - 0.5, 0.5, 0.12, D / 2 + 0.5, 1.15, 0.2, wallR, inR, 'metalDark');
    put(D / 2 - 0.44, 0.55, 0.2, D / 2 + 0.44, 1.1, 0.21, wallR, inR, 'screenGlow', false);
    k = B.length; lowTable(B, mid[0], mid[2], 1.0, 0.6); lift(k, 'table');
    const ra = f.rect(D / 2 - 1.1, (wallL + wallR) / 2 - 0.9, D / 2 + 1.1, (wallL + wallR) / 2 + 0.9);
    k = B.length; rug(B, ra.x0, ra.z0, ra.x1, ra.z1); lift(k, 'rug');
    const pc = f.p(D - WALL_T - 0.45, 0, wallL + inL * 0.45);
    k = B.length; plant(B, pc[0], pc[2], 0.5, 1.4); lift(k, 'plant');
  } else if (style === 'blue') {
    // 青い帯（両側の壁の腰の高さ）・長いベンチ（L）・給水器（R）
    for (const [w, inn] of [[wallL, inL], [wallR, inR]] as const) put(0.1, 0.95, 0, D - 0.1, 1.0, 0.02, w, inn, 'ledBlue', false);
    put(D / 2 - 1.1, 0.42, 0.05, D / 2 + 1.1, 0.47, 0.45, wallL, inL, 'seatBlue');
    put(D / 2 - 1.0, 0, 0.1, D / 2 - 0.95, 0.42, 0.4, wallL, inL, 'metal', false);
    put(D / 2 + 0.95, 0, 0.1, D / 2 + 1.0, 0.42, 0.4, wallL, inL, 'metal', false);
    put(D / 2 - 0.2, 0, 0.05, D / 2 + 0.2, 1.0, 0.4, wallR, inR, 'paintWhite');
    put(D / 2 - 0.15, 1.0, 0.1, D / 2 + 0.15, 1.4, 0.35, wallR, inR, 'aquariumBlue', false);
  } else {
    // 琥珀の帯・本棚（L）・肘掛け椅子と灯り（R）
    for (const [w, inn] of [[wallL, inL], [wallR, inR]] as const) put(0.1, 0.95, 0, D - 0.1, 1.0, 0.02, w, inn, 'goldTrim', false);
    put(D / 2 - 0.9, 0, 0.02, D / 2 + 0.9, 2.0, 0.37, wallL, inL, 'bookshelfWood');
    put(D / 2 - 0.4, 0.1, 0.1, D / 2 + 0.4, 0.45, 0.85, wallR, inR, 'upholstery');
    put(D / 2 - 0.4, 0.45, 0.1, D / 2 + 0.4, 0.95, 0.28, wallR, inR, 'upholstery');
    put(D / 2 + 0.6, 0, 0.15, D / 2 + 0.7, 1.5, 0.25, wallR, inR, 'metalDark');
    put(D / 2 + 0.45, 1.5, 0.05, D / 2 + 0.85, 1.75, 0.4, wallR, inR, 'lightWarm', false);
  }
  const reach = reachOpenings({ footprint: cell.footprint, floorY: y, boxes: [...cell.boxes, ...B] }, [opA, opB], 0.1);
  if (!reach || !reach.blocked.length) cell.boxes.push(...B);
  addPocketCell(ctx, cell, 'room', [opA, opB]);
  return { cell, opA, opB };
}
