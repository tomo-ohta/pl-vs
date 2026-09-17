/** 駐車場（ParkingGrid）。柱グリッド + ランプ / 扉ソケット。L 字の翼を持つことがある。
 *  見た目は docs/reference-common-analysis.md 表 6: 柱の下 1.2 m に黄色帯と階表示「B1」、床に白線の駐車区画（2.5 × 5.0 m）と車止め、
 *  梁に沿った蛍光管の列、壁の下 1.2 m は暗いコンクリート帯 + 白の反射帯。車は置かない。 */
import type { Socket } from '../core/types';
import { buildShell, footprintAABB, inner, rect, rectArea, type Rect } from './footprint';
import { clearDoorways, dropRemovedHole, labelAtEntry, makeEntry, placeExits, placeHole, wallBands } from './common';
import { box, bonusExits, emptyLayout, WIDE_W, type GenParams, type RoomLayout } from './layout';
import { floorLine } from './furniture';

const SIZES: [number, number][] = [[36, 36], [30, 26], [24, 24], [18, 18], [14, 14], [10, 12]];

export function generateParking(p: GenParams): RoomLayout {
  const { rng, palette } = p;
  const L = emptyLayout(palette);
  const h = 2.6;
  const wingSide = rng.pick([1, 3] as const);
  const vr = rng.fork(`v${p.variant}`);
  const [bw, bd] = SIZES[p.variant % SIZES.length];
  const w = Math.round(bw * vr.float(0.9, 1.1));
  const d = Math.round(bd * vr.float(0.9, 1.1));
  const main = p.mainRect ? rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1) : rect(-w / 2, 0, w / 2, d);
  const rects: Rect[] = [main];
  if (!p.mainRect && p.variant < 3 && vr.chance(0.4)) {
    const ww = Math.round(w * 0.5);
    const wd = Math.round(d * 0.6);
    rects.push(wingSide === 1 ? rect(main.x1, d - wd, main.x1 + ww, d) : rect(main.x0 - ww, d - wd, main.x0, d));
  }
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  const area = rects.reduce((a, r) => a + rectArea(r), 0);

  const { entry, ceilingHole } = makeEntry(p, main, 0, h);
  let sockets: Socket[] = [entry, ...p.extraSockets];
  const exits = Math.min(5, Math.max(1, p.exits) + bonusExits(area));
  // 最初の出口はランプ（幅広開口）、残りは扉
  sockets.push(...placeExits(rects, sockets, vr, { count: 1, type: 'ramp', width: WIDE_W, height: h - 0.3, minGap: 4 }, 'ramp'));
  sockets.push(...placeExits(rects, sockets, vr, { count: Math.max(0, exits - 1), minGap: 3 }));
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));
  // 床穴（判定・配置は専用 fork。holeLocal の有無で vr の消費量を変えない）
  const hr = vr.fork('hole');
  const wantHole = p.allowHole && hr.chance(0.3);
  if (p.holeLocal || wantHole) {
    const hole = placeHole(rects, sockets, hr, p.holeLocal);
    if (hole) {
      L.holes.push(hole.hole);
      sockets.push(hole.socket);
    }
  }
  L.sockets = sockets;
  dropRemovedHole(L, p);
  sockets = L.sockets;
  buildShell(L.boxes, rects, h, sockets, { floor: palette.floor, wall: palette.wall, ceiling: palette.ceiling, floorHoles: L.holes, ceilingHoles: ceilingHole ? [ceilingHole] : [] });

  const shellCount = L.boxes.length;
  L.shellCount = shellCount;
  const B = L.boxes;
  // 参考画像の配置は専用 fork（既存の出口・穴の乱数列に影響しない）
  const rr = vr.fork('ref');
  // 壁の下 1.2 m: 暗いコンクリート帯 + 白の反射帯 0.1 m
  wallBands(L, rects, sockets, [{ y0: 0, y1: 1.2, mat: 'ceilingDark', depth: 0.012 }, { y0: 1.2, y1: 1.3, mat: 'wallWhite', depth: 0.02 }]);

  const nearSocket = (x: number, z: number, rad: number) =>
    sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < rad)
    || (ceilingHole !== null && Math.hypot((ceilingHole.min[0] + ceilingHole.max[0]) / 2 - x, (ceilingHole.min[2] + ceilingHole.max[2]) / 2 - z) < rad);

  const px = 7.5;
  let signCount = 0;
  for (const r of rects) {
    const ir = inner(r, 1.0);
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0; // 長辺の壁（z0 / z1）に沿って駐車区画を並べる
    // 柱グリッド + 黄色帯 1.2 m + 階表示「B1」
    const colX: number[] = [];
    const colZ: number[] = [];
    for (let x = ir.x0 + px / 2; x < ir.x1; x += px) colX.push(x);
    for (let z = ir.z0 + px / 2; z < ir.z1; z += px) colZ.push(z);
    for (const x of colX) {
      for (const z of colZ) {
        if (nearSocket(x, z, 2.5)) continue;
        B.push(box([x - 0.3, 0, z - 0.3], [x + 0.3, h, z + 0.3], 'columnConcrete'));
        B.push(box([x - 0.32, 0, z - 0.32], [x + 0.32, 1.2, z + 0.32], 'yellowLine', false));
        B.push(box([x - 0.325, 1.2, z - 0.325], [x + 0.325, 1.23, z + 0.325], 'metalDark', false));
        if (signCount < 24) {
          // 入口側（-Z）と反対側の面に階表示（白地・黒文字）
          (L.signs ??= []).push({ text: 'B1', pos: [x, 1.75, z - 0.335], dir: 2, width: 0.44, kind: 'plate', color: 0x15171a, background: 0xf2f2ee });
          (L.signs ??= []).push({ text: 'B1', pos: [x, 1.75, z + 0.335], dir: 0, width: 0.44, kind: 'plate', color: 0x15171a, background: 0xf2f2ee });
          signCount += 2;
        }
      }
    }
    // 梁の格子（柱の通り芯に沿う。天井から 0.5 m 下がる）
    for (const z of colZ) B.push(box([r.x0 + 0.15, h - 0.5, z - 0.2], [r.x1 - 0.15, h, z + 0.2], 'ceilingDark', false));
    for (const x of colX) B.push(box([x - 0.2, h - 0.5, r.z0 + 0.15], [x + 0.2, h, r.z1 - 0.15], 'ceilingDark', false));
    // 蛍光管: 長辺方向の梁の脇に 4 m ピッチ。間引き（消灯）は lightingPreset に応じて
    const dim = /間引き|一部消灯|低照度|暗/.test(p.def.lightingPreset) ? 0.3 : 0.08;
    const beams = alongX ? colZ : colX;
    let li = 0;
    for (const bpos of beams) {
      const s0 = (alongX ? ir.x0 : ir.z0) + 1.0, s1 = (alongX ? ir.x1 : ir.z1) - 1.0;
      const n = Math.max(1, Math.round((s1 - s0) / 4.0));
      for (let k = 0; k < n; k++) {
        const l = s0 + ((s1 - s0) * (k + 0.5)) / n;
        // 梁の脇に吊る（梁の下端と同じ高さ。梁の陰に隠れず両側から見える）
        const x = alongX ? l : bpos + 0.55, z = alongX ? bpos + 0.55 : l;
        const off = rr.chance(dim);
        const hx = alongX ? 0.6 : 0.075, hz = alongX ? 0.075 : 0.6;
        const yb = h - 0.5;
        B.push(box([x - hx, yb - 0.04, z - hz], [x + hx, yb, z + hz], off ? 'lightOff' : 'lightPanel', false));
        B.push(box([x - 0.015, yb, z - 0.015], [x + 0.015, h, z + 0.015], 'metalDark', false));
        if (!off && li % 2 === 0) L.lights.push({ pos: [x, yb - 0.25, z], color: 0xdfe8ff, intensity: 0.9, distance: 14 });
        li++;
      }
    }
    // 駐車区画: 長辺の壁から 5.0 m、幅 2.5 m の白線（0.12 幅）。線は柱の通り芯から 1.25 ずらす（柱と重ならない）
    const stall = 2.5, depth = 5.0, lw = 0.12;
    const lineStart = (alongX ? colX[0] : colZ[0]) ?? ((alongX ? ir.x0 : ir.z0) + px / 2);
    const lo = (alongX ? ir.x0 : ir.z0) + 0.8, hi = (alongX ? ir.x1 : ir.z1) - 0.8;
    const lines: number[] = [];
    for (let t = lineStart - 1.25 - Math.ceil((lineStart - lo) / stall) * stall; t <= hi; t += stall) if (t >= lo) lines.push(t);
    const rows: { face: number; inward: 1 | -1 }[] = alongX
      ? [{ face: r.z0 + 0.15, inward: 1 }, { face: r.z1 - 0.15, inward: -1 }]
      : [{ face: r.x0 + 0.15, inward: 1 }, { face: r.x1 - 0.15, inward: -1 }];
    const shortLen = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
    // 十分に深い駐車場は中央に背中合わせの区画列
    if (shortLen >= 24) {
      const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
      rows.push({ face: mid, inward: 1 }, { face: mid, inward: -1 });
    }
    for (const row of rows) {
      const f0 = row.face, f1 = row.face + row.inward * depth;
      // 区画線
      for (const t of lines) {
        const cx = alongX ? t : (f0 + f1) / 2, cz = alongX ? (f0 + f1) / 2 : t;
        if (nearSocket(cx, cz, 3.2)) continue;
        if (alongX) floorLine(B, t - lw / 2, f0, t + lw / 2, f1, 'wallWhite');
        else floorLine(B, f0, t - lw / 2, f1, t + lw / 2, 'wallWhite');
      }
      // 区画の奥端の線と車止め
      for (let i = 0; i + 1 < lines.length; i++) {
        const a = lines[i], b = lines[i + 1];
        if (b - a > stall + 0.01) continue;
        const cx = alongX ? (a + b) / 2 : (f0 + f1) / 2, cz = alongX ? (f0 + f1) / 2 : (a + b) / 2;
        if (nearSocket(cx, cz, 3.2)) continue;
        const stop = f0 + row.inward * 0.9;
        const c = (a + b) / 2;
        if (alongX) B.push(box([c - 0.3, 0, Math.min(stop, stop + row.inward * 0.15)], [c + 0.3, 0.12, Math.max(stop, stop + row.inward * 0.15)], 'columnConcrete'));
        else B.push(box([Math.min(stop, stop + row.inward * 0.15), 0, c - 0.3], [Math.max(stop, stop + row.inward * 0.15), 0.12, c + 0.3], 'columnConcrete'));
      }
    }
  }
  clearDoorways(L, sockets, shellCount);
  labelAtEntry(L, entry, 3.0, p.label);
  return L;
}
