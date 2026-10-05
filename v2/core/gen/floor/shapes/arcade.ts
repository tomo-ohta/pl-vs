/**
 * 地下街（F34。v1 L06 の発展）: 広くて低い通路の網。通路の真ん中に柱の列、両側の壁は店の構え（シャッターの降りた店・
 * 灯りの点いたショーウィンドウ・看板）。曲がり角には柱 1 本と案内の看板。部屋は店（扉の無い店先が多い。geometry.ts）。
 * 柱は真ん中に立つので、通路は柱の左右に分かれる（どちらからでも通れる）。
 */
import { hashAll, Rng } from '../../../math/rng.ts';
import { box, WALL_T, type CellLayout, type MatId } from '../../../world/layout.ts';
import type { GeoBuild, StraightSpec } from '../geometry.ts';

const PILLAR = 0.5;

/** 通路の柱と店の構え（区画を作った後） */
export function arcadeCorridor(g: GeoBuild, cell: CellLayout, s: StraightSpec): void {
  const rng = new Rng(hashAll(g.p.seed, 'arcade', s.id));
  const y = s.y, h = s.height;
  const len = s.a1 - s.a0;
  const at = (a: number, c: number): [number, number] => (s.axis === 'x' ? [a, c] : [c, a]);
  // 柱: 真ん中の線に、両端から 2.2 m 離して 4.5 m ごと（幅 3.6 m 以上の通路だけ）
  if (s.width >= 3.6 && len >= 5) {
    const n = Math.max(1, Math.floor((len - 4.4) / 4.5) + 1);
    const step = n > 1 ? (len - 4.4) / (n - 1) : 0;
    for (let i = 0; i < n; i++) {
      const a = n > 1 ? s.a0 + 2.2 + i * step : (s.a0 + s.a1) / 2;
      const [x, z] = at(a, s.center);
      cell.boxes.push(box([x - PILLAR / 2, y, z - PILLAR / 2], [x + PILLAR / 2, y + h, z + PILLAR / 2], 'columnConcrete'));
      g.keep(s.id, { min: [x - 0.9, y, z - 0.9], max: [x + 0.9, y + h, z + 0.9] });
    }
  }
  // 店の構え: 両側の壁に 3.6 m ごと（端の 0.8 m は空ける）
  for (const side of [-1, 1]) {
    const face = s.center + side * (s.width / 2 - WALL_T);
    for (let a = s.a0 + 0.8; a + 3.0 <= s.a1 - 0.8; a += 3.6) {
      const kind = rng.int(0, 3);
      const mat: MatId = kind === 0 ? 'redShutter' : kind === 1 ? 'windowLit' : kind === 2 ? 'redShutter' : 'windowDark';
      const d0 = face - side * 0.06, d1 = face;
      const [x0, z0] = at(a, Math.min(d0, d1)), [x1, z1] = at(a + 3.0, Math.max(d0, d1));
      cell.boxes.push(box([Math.min(x0, x1), y, Math.min(z0, z1)], [Math.max(x0, x1), y + Math.min(2.2, h - 0.25), Math.max(z0, z1)], mat));
      // 看板（店の上の光る帯）
      const sign: MatId = rng.chance(0.6) ? 'signEmissive' : 'signPlate';
      cell.boxes.push(box([Math.min(x0, x1) + 0.2, y + Math.min(2.25, h - 0.2), Math.min(z0, z1) - (side > 0 ? 0 : 0.02)], [Math.max(x0, x1) - 0.2, y + Math.min(2.25, h - 0.2) + 0.12, Math.max(z0, z1) + (side > 0 ? 0.02 : 0)], sign, false));
      if (mat === 'windowLit') {
        const [lx, lz] = at(a + 1.5, face - side * 0.5);
        cell.lights.push({ pos: [lx, y + 1.6, lz], color: 0xffe2b0, intensity: 0.35, distance: 4 });
      }
    }
  }
}

/** 曲がり角の柱（真ん中）と案内の看板 */
export function arcadeJunction(_g: GeoBuild, cell: CellLayout): void {
  const r = cell.footprint[0]!;
  const w = r.x1 - r.x0;
  if (w < 3.8) return;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, y = cell.floorY;
  cell.boxes.push(box([cx - PILLAR / 2, y, cz - PILLAR / 2], [cx + PILLAR / 2, y + cell.height, cz + PILLAR / 2], 'columnConcrete'));
  cell.boxes.push(box([cx - 0.3, y + 1.6, cz - PILLAR / 2 - 0.03], [cx + 0.3, y + 2.0, cz - PILLAR / 2], 'signEmissive', false));
  cell.boxes.push(box([cx - 0.3, y + 1.6, cz + PILLAR / 2], [cx + 0.3, y + 2.0, cz + PILLAR / 2 + 0.03], 'signEmissive', false));
}
