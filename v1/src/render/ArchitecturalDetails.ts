import { box, type Box, type RoomLayout } from '../generators/layout';
import { facePlanes, furnitureDetails } from './props/FurnitureShapes';

/** Render-only details. Never changes the layout's collision/portal contract. */
export function detailedBoxes(layout: RoomLayout, template = ''): Box[] {
  const out: Box[] = [];
  // 部屋の中心（x, z）: 向きの読めない 1 箱家具（自販機・単箱の椅子・収納の前面）を中心へ向ける
  const bounds = layout.bounds;
  const center: [number, number] = bounds && bounds.max[0] > bounds.min[0]
    ? [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2]
    : [0, 0];
  // タグ付きの家具（椅子・連結椅子・ベンチ・ロッカー・机上のモニター）は専用形状へ。置き換えた元の箔は描かない
  const skip = new Set<Box>();
  furnitureDetails(layout.boxes, center, out, skip);
  for (const b of layout.boxes) {
    if (skip.has(b)) continue;
    const [x, y, z] = b.min, [X, Y, Z] = b.max;
    const w = X - x, h = Y - y, d = Z - z;
    const furniture = b.mat === 'furnitureDark' || b.mat === 'furnitureLight';
    // Open racks replace the solid display slab while retaining its collision envelope.
    if ((b.mat === 'shelfMetal' || (template === 'ShelfGrid' && furniture)) && y < .05 && h > 1.3 && Math.min(w, d) > .35) {
      const alongX = w >= d, length = alongX ? w : d;
      const sections = Math.max(1, Math.ceil(length / 1.8));
      for (let k = 0; k <= sections; k++) {
        const t = k * (length - .055) / sections;
        for (const side of [0, 1]) {
          const px = alongX ? x + t : x + side * (w - .055);
          const pz = alongX ? z + side * (d - .055) : z + t;
          out.push(box([px, y, pz], [px + .055, Y, pz + .055], 'shelfMetal', false));
        }
      }
      // 段板は 3 cm の板 + 両長辺の縁（4.5 cm）: 縁の厚みが読める（5 cm の一様なスラブに見えない）。
      // 上面は従来どおり level + .05（GridGenerator の商品箔・rack() の段ボールが段に接する高さ）
      const lipT = .012; // 縁の高さは level + .005 〜 level + .05（4.5 cm）
      for (let level = y + .25; level < Y - .1; level += Math.max(.9, h / 3)) {
        out.push(box([x, level + .02, z], [X, level + .05, Z], b.mat, false));
        if (alongX) out.push(box([x, level + .005, z], [X, level + .05, z + lipT], b.mat, false), box([x, level + .005, Z - lipT], [X, level + .05, Z], b.mat, false));
        else out.push(box([x, level + .005, z], [x + lipT, level + .05, Z], b.mat, false), box([X - lipT, level + .005, z], [X, level + .05, Z], b.mat, false));
      }
      out.push(box([x, Y - .04, z], [X, Y, Z], b.mat, false));
      // 売場の棚（2 m 未満）は両端の側板と中央の背板を持つ（倉庫のラックは開放のまま）
      if (h < 2.0) {
        const t = .015;
        if (alongX) {
          out.push(box([x, y, z], [x + t, Y, Z], b.mat, false), box([X - t, y, z], [X, Y, Z], b.mat, false));
          out.push(box([x, y + .1, z + d / 2 - t / 2], [X, Y - .04, z + d / 2 + t / 2], b.mat, false));
        } else {
          out.push(box([x, y, z], [X, Y, z + t], b.mat, false), box([x, y, Z - t], [X, Y, Z], b.mat, false));
          out.push(box([x + w / 2 - t / 2, y + .1, z], [x + w / 2 + t / 2, Y - .04, Z], b.mat, false));
        }
      }
      continue;
    }
    // A mezzanine trim is a perimeter band, not a solid slab across the atrium.
    if (b.mat === 'trim' && y > 3 && h < .3 && w > 4 && d > 4) {
      out.push(box([x, y, z], [X, Y, z + .22], b.mat, false), box([x, y, Z - .22], [X, Y, Z], b.mat, false), box([x, y, z + .22], [x + .22, Y, Z - .22], b.mat, false), box([X - .22, y, z + .22], [X, Y, Z - .22], b.mat, false));
      continue;
    }
    // Desk-like blocks: thin worktop, apron and four legs, at the original bounds.
    if (furniture && y < .05 && h > .68 && h < .86 && Math.max(w, d) > 1.1 && Math.min(w, d) > .35 && template !== 'Restroom') {
      out.push(box([x, Y - .06, z], [X, Y, Z], b.mat, false));
      out.push(box([x + .08, Y - .23, z + .08], [X - .08, Y - .06, z + .12], b.mat, false));
      for (const lx of [x + .08, X - .13]) for (const lz of [z + .08, Z - .13]) out.push(box([lx, y, lz], [lx + .05, Y - .06, lz + .05], 'shelfMetal', false));
    } else out.push(b);
    // Cabinet fronts with fine reveals and metal pulls. The front faces the room centre (the back of a wall cabinet stays blank).
    if (furniture && y < .05 && h >= .86 && h < 2.3 && w > .5 && d > .25 && b.kind !== 'vending') {
      const alongX = w >= d;
      const k: 0 | 2 = alongX ? 2 : 0, a = alongX ? 0 : 2;
      const sign: 1 | -1 = center[k === 0 ? 0 : 1] >= (b.min[k] + b.max[k]) / 2 ? 1 : -1;
      const S = facePlanes(k, sign, sign > 0 ? b.max[k] : b.min[k]);
      const len = alongX ? w : d, A0 = b.min[a];
      const count = Math.max(1, Math.round(len / .6));
      for (let i = 0; i < count; i++) {
        const a0 = A0 + i * len / count + .012, a1 = A0 + (i + 1) * len / count - .012;
        out.push(S(a0, a1, -.015, .005, y + .09, Y - .018, b.mat));
        out.push(S(a1 - .06, a1 - .035, .015, .045, Math.min(Y - .15, y + 1.05), Math.min(Y - .05, y + 1.2), 'metal'));
      }
    }
    // Skirting follows actual wall segments, so openings remain unobstructed.
    if (/^wall/.test(b.mat) && y <= .05 && h > 2 && Math.min(w, d) < .35) {
      const floorY = y + .015;
      if (w > d) {
        out.push(box([x, floorY, z - .018], [X, floorY + .11, Z + .018], 'trim', false));
        out.push(box([x, Y - .055, z - .009], [X, Y, Z + .009], 'ceilingWhite', false));
      } else {
        out.push(box([x - .018, floorY, z], [X + .018, floorY + .11, Z], 'trim', false));
        out.push(box([x - .009, Y - .055, z], [X + .009, Y, Z], 'ceilingWhite', false));
      }
    }
    // Shallow metal housings around luminous ceiling panels: a metal tray (four lips below the lens) and a centre rib that splits the lens into two tubes.
    if (/^(lightPanel|lightWarm|lightOff|lightGreen|lightYellow)$/.test(b.mat) && h < .12 && w > .15 && d > .12) {
      const t = .025;
      out.push(box([x - t, y - .018, z - t], [X + t, Y, z], 'shelfMetal', false));
      out.push(box([x - t, y - .018, Z], [X + t, Y, Z + t], 'shelfMetal', false));
      out.push(box([x - t, y - .018, z], [x, Y, Z], 'shelfMetal', false));
      out.push(box([X, y - .018, z], [X + t, Y, Z], 'shelfMetal', false));
      // Fluorescent fixtures wider than .5 m read as two tubes: a thin rib along the long axis, flush with the lens.
      if (Math.max(w, d) > .5 && Math.min(w, d) > .3) {
        if (w >= d) out.push(box([x, y - .012, z + d / 2 - .01], [X, y + .001, z + d / 2 + .01], 'shelfMetal', false));
        else out.push(box([x + w / 2 - .01, y - .012, z], [x + w / 2 + .01, y + .001, Z], 'shelfMetal', false));
      }
    }
    // Taped cartons get a physically thin packing seam.
    if (b.mat === 'boxCardboard' && w > .15 && d > .15) {
      out.push(box([x + w * .46, Y + .001, z], [x + w * .54, Y + .002, Z], 'trim', false));
    }
  }
  return out;
}
