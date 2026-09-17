import { box, type Box, type RoomLayout } from '../generators/layout';

/** Render-only details. Never changes the layout's collision/portal contract. */
export function detailedBoxes(layout: RoomLayout, template = ''): Box[] {
  const out: Box[] = [];
  for (const b of layout.boxes) {
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
      for (let level = y + .25; level < Y; level += Math.max(.9, h / 3)) out.push(box([x, level, z], [X, level + .05, Z], b.mat, false));
      out.push(box([x, Y - .05, z], [X, Y, Z], b.mat, false));
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
    // Cabinet fronts with fine reveals and metal pulls.
    if (furniture && y < .05 && h >= .86 && h < 2.3 && w > .5 && d > .25) {
      const count = Math.max(1, Math.round(w / .6));
      for (let k = 0; k < count; k++) {
        const a = x + k * w / count + .012, e = x + (k + 1) * w / count - .012;
        out.push(box([a, y + .09, z - .015], [e, Y - .018, z + .005], b.mat, false));
        out.push(box([e - .06, Math.min(Y - .15, y + 1.05), z - .045], [e - .035, Math.min(Y - .05, y + 1.2), z - .015], 'metal', false));
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
