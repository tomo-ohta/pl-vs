/** 棚・ラック・壁セルの反復グリッド（WarehouseGrid / ShelfGrid / RetailGrid / StorageGrid / MazeGrid / ServerGrid / ServiceMaze）。 */
import type { Socket } from '../core/types';
import type { Rng } from '../core/rng';
import { buildShell, footprintAABB, inner, rect, rectArea, type Rect } from './footprint';
import { clearDoorways, dropRemovedHole, labelAtEntry, lightGrid, makeEntry, patternColumns, placeExits, placeHole } from './common';
import { box, bonusExits, emptyLayout, type Box, type GenParams, type MatId, type RoomLayout } from './layout';
import { floorLine, freeRuns, hitsZone, innerFaces, insideRects, pendant, rack, rollCage, doorZones } from './furniture';

const SIZES: [number, number][] = [[30, 36], [26, 26], [20, 22], [16, 16], [12, 12], [9, 9]];

export function generateGrid(p: GenParams): RoomLayout {
  const { rng, template, palette } = p;
  const L = emptyLayout(palette);
  const tid = template.id;
  const vr = rng.fork(`v${p.variant}`);
  const [bw, bd] = SIZES[Math.floor(p.variant / 2) % SIZES.length];
  const axis: 'x' | 'z' = p.variant % 2 === 0 ? 'x' : 'z';
  const w = Math.round(bw * vr.float(0.9, 1.1));
  const d = Math.round(bd * vr.float(0.9, 1.1));
  const h = tid === 'WarehouseGrid' || tid === 'StorageGrid' ? Math.min(6, 3.5 + w / 12) : tid === 'ServerGrid' ? 3.4 : 3.0;
  const main = p.mainRect ? rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1) : rect(-w / 2, 0, w / 2, d);
  const rects: Rect[] = [main];
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  const area = rectArea(main);

  const { entry, ceilingHole } = makeEntry(p, main, 0, h);
  let sockets: Socket[] = [entry, ...p.extraSockets];
  const exits = Math.min(5, Math.max(1, p.exits) + bonusExits(area));
  sockets.push(...placeExits(rects, sockets, vr, { count: exits, minGap: 3 }));
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));
  // 床穴（判定・配置は専用 fork。holeLocal の有無で vr の消費量を変えない）
  const hr = vr.fork('hole');
  const wantHole = p.allowHole && hr.chance(0.15);
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

  const ir = inner(main, 1.6);
  const keepClear = (x: number, z: number, r = 1.6) =>
    sockets.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < r) || (ceilingHole !== null && Math.hypot((ceilingHole.min[0] + ceilingHole.max[0]) / 2 - x, (ceilingHole.min[2] + ceilingHole.max[2]) / 2 - z) < 2);

  if (tid === 'MazeGrid' || tid === 'ServiceMaze') {
    maze(L, ir, tid === 'ServiceMaze' ? 2.2 : 2.6, tid === 'ServiceMaze' ? h : 2.4, tid === 'ServiceMaze' ? 'wallConcrete' : palette.wall, vr, keepClear);
  } else if (tid === 'WarehouseGrid') {
    // 倉庫の棚列（C12 / C13。docs/reference-common-analysis.md 表 12・13）: 支柱 + 段板 + 段ボール箱、通路 2.5 m、床の黄線、区画文字、吊り灯
    const spec = shelfSpec(tid, h, vr);
    const rows = shelves(L, ir, axis, spec, vr, keepClear, vr.fork('ref'));
    if (area > 300) patternColumns({ L, rects, h, rng: vr, keep: sockets }, 9);
    warehouseDress(L, main, ir, axis, spec, rows, h, p);
  } else {
    const spec = shelfSpec(tid, h, vr);
    shelves(L, ir, axis, spec, vr, keepClear);
  }

  clearDoorways(L, sockets, shellCount);
  const dim = /一部消灯|低照度|暗/.test(p.def.lightingPreset) ? 0.3 : 0.05;
  if (tid !== 'WarehouseGrid') lightGrid(L, rects, h, 5, dim, vr, tid === 'ServerGrid' ? 'ledBlue' : palette.light, tid === 'ServerGrid' ? 0x9fc8ff : palette.lightColor, palette.lightIntensity, 4);
  labelAtEntry(L, entry, 2.6, p.label);
  return L;
}

interface ShelfSpec {
  aisle: number;
  depth: number;
  height: number;
  mat: MatId;
  segment: number;
  fill: MatId | null;
  fillChance: number;
}

function shelfSpec(tid: string, h: number, rng: Rng): ShelfSpec {
  switch (tid) {
    // 棚の高さ 3.3 m: 描画側（ArchitecturalDetails）の段板ピッチ max(0.9, h/3) が 1.1 m になり、段板 4 枚（0.25 / 1.35 / 2.45 / 3.25）
    // = 参考画像の「3〜4 段」に近づく（4.2 m では 1.4 m ピッチの 3 段だった）。rack() の箱の段も同じ式で追従する
    case 'WarehouseGrid': return { aisle: 2.5, depth: 1.2, height: Math.min(h - 0.6, 3.3), mat: 'shelfMetal', segment: 9, fill: 'boxCardboard', fillChance: 0.7 };
    case 'RetailGrid': return { aisle: rng.float(1.8, 2.4), depth: 0.9, height: 1.7, mat: 'shelfMetal', segment: 6, fill: 'furnitureLight', fillChance: 0.9 };
    case 'StorageGrid': return { aisle: 2.2, depth: 2.4, height: h - 0.4, mat: 'metal', segment: 12, fill: 'doorMetal', fillChance: 1.0 };
    case 'ServerGrid': return { aisle: 1.6, depth: 1.0, height: 2.2, mat: 'furnitureDark', segment: 7, fill: 'ledBlue', fillChance: 1.0 };
    default: return { aisle: rng.float(1.6, 2.2), depth: 0.6, height: 2.2, mat: 'furnitureDark', segment: 8, fill: 'boxCardboard', fillChance: 0.4 };
  }
}

/** 棚列。axis 方向に伸びる列を並べ、segment ごとに 1.2m の切れ目を入れる。
 *  rackRng を渡すと（倉庫）スラブの代わりに rack()（支柱 + 段板は描画側、段に段ボール箱）を使う。戻り値は列の位置（通路と区画文字の基準） */
function shelves(L: RoomLayout, ir: Rect, axis: 'x' | 'z', s: ShelfSpec, rng: Rng, keepClear: (x: number, z: number, r?: number) => boolean, rackRng?: Rng): number[] {
  const pitch = s.aisle + s.depth;
  const rows: number[] = [];
  if (axis === 'x') {
    for (let z = ir.z0 + s.depth / 2 + 0.4; z + s.depth / 2 < ir.z1; z += pitch) {
      rows.push(z);
      for (let x0 = ir.x0; x0 < ir.x1 - 1; x0 += s.segment + 1.2) {
        const x1 = Math.min(ir.x1, x0 + s.segment);
        if (keepClear((x0 + x1) / 2, z, Math.max(2, (x1 - x0) / 2 + 1))) {
          // ソケットの近い列は分割して通路を作る
          continue;
        }
        if (rackRng) {
          rack(L.boxes, rackRng, x0, z - s.depth / 2, x1, z + s.depth / 2, s.height);
          continue;
        }
        L.boxes.push(box([x0, 0, z - s.depth / 2], [x1, s.height, z + s.depth / 2], s.mat));
        if (s.fill && rng.chance(s.fillChance)) {
          for (let x = x0 + 0.2; x + 0.8 < x1; x += 1.0) {
            for (let y = 0.3; y + 0.5 < s.height; y += Math.max(0.9, s.height / 3)) {
              if (rng.chance(0.7)) L.boxes.push(box([x, y, z - s.depth / 2 - 0.02], [x + 0.8, y + 0.5, z + s.depth / 2 + 0.02], s.fill, false));
            }
          }
        }
      }
    }
  } else {
    for (let x = ir.x0 + s.depth / 2 + 0.4; x + s.depth / 2 < ir.x1; x += pitch) {
      rows.push(x);
      for (let z0 = ir.z0; z0 < ir.z1 - 1; z0 += s.segment + 1.2) {
        const z1 = Math.min(ir.z1, z0 + s.segment);
        if (keepClear(x, (z0 + z1) / 2, Math.max(2, (z1 - z0) / 2 + 1))) continue;
        if (rackRng) {
          rack(L.boxes, rackRng, x - s.depth / 2, z0, x + s.depth / 2, z1, s.height);
          continue;
        }
        L.boxes.push(box([x - s.depth / 2, 0, z0], [x + s.depth / 2, s.height, z1], s.mat));
        if (s.fill && rng.chance(s.fillChance)) {
          for (let z = z0 + 0.2; z + 0.8 < z1; z += 1.0) {
            for (let y = 0.3; y + 0.5 < s.height; y += Math.max(0.9, s.height / 3)) {
              if (rng.chance(0.7)) L.boxes.push(box([x - s.depth / 2 - 0.02, y, z], [x + s.depth / 2 + 0.02, y + 0.5, z + 0.8], s.fill, false));
            }
          }
        }
      }
    }
  }
  return rows;
}

/** 倉庫の仕上げ: 通路の床に黄線、列の入口側の端に区画文字（A / B / C …）、通路上に吊り灯の列 */
function warehouseDress(L: RoomLayout, main: Rect, ir: Rect, axis: 'x' | 'z', s: ShelfSpec, rows: number[], h: number, p: GenParams): void {
  const B = L.boxes;
  const lw = 0.1;
  const along0 = axis === 'x' ? ir.x0 : ir.z0;
  const along1 = axis === 'x' ? ir.x1 : ir.z1;
  // 黄線: 各列の両側 0.35 m。列の間の通路には 2 本の線が走る
  for (const c of rows) {
    for (const side of [-1, 1]) {
      const t = c + side * (s.depth / 2 + 0.35);
      if (axis === 'x') floorLine(B, along0, t - lw / 2, along1, t + lw / 2, 'yellowLine');
      else floorLine(B, t - lw / 2, along0, t + lw / 2, along1, 'yellowLine');
    }
  }
  // 区画文字: 列の端（入口 = 南 z0 に近い端。x 軸の列は x0 側の端）に黄地・黒文字の板。上限 16 枚
  rows.slice(0, 16).forEach((c, i) => {
    const letter = String.fromCharCode(65 + (i % 26));
    const y = Math.min(s.height - 0.35, 2.3);
    if (axis === 'x') (L.signs ??= []).push({ text: letter, pos: [along0 - 0.03, y, c], dir: 3, width: 0.5, kind: 'plate', color: 0x17181a, background: 0xe4c23a });
    else (L.signs ??= []).push({ text: letter, pos: [c, y, along0 - 0.03], dir: 2, width: 0.5, kind: 'plate', color: 0x17181a, background: 0xe4c23a });
  });
  // 吊り灯: 通路（列の間 + 外周側）の中心線に 4.5 m ピッチ。高所灯なので 1.0 m 吊り下げる
  const aisles: number[] = [];
  const lo = axis === 'x' ? main.z0 : main.x0;
  const hi = axis === 'x' ? main.z1 : main.x1;
  if (rows.length === 0) aisles.push((lo + hi) / 2);
  else {
    aisles.push((lo + 0.15 + rows[0] - s.depth / 2) / 2);
    for (let i = 0; i + 1 < rows.length; i++) aisles.push((rows[i] + rows[i + 1]) / 2);
    const last = rows[rows.length - 1] + s.depth / 2;
    if (hi - 0.15 - last > 1.6) aisles.push((last + hi - 0.15) / 2);
  }
  const dim = /一部消灯|低照度|暗/.test(p.def.lightingPreset) ? 0.3 : 0.05;
  const lr = p.rng.fork(`v${p.variant}`).fork('lights');
  let i = 0;
  for (const a of aisles) {
    const n = Math.max(1, Math.round((along1 - along0) / 4.5));
    for (let k = 0; k < n; k++) {
      const l = along0 + ((along1 - along0) * (k + 0.5)) / n;
      const x = axis === 'x' ? l : a, z = axis === 'x' ? a : l;
      const off = lr.chance(dim);
      pendant(B, x, z, h, Math.min(1.0, h - s.height - 0.3 > 0.6 ? 1.0 : Math.max(0.35, h - s.height - 0.2)), off ? 'lightOff' : p.palette.light);
      if (!off && i % 2 === 0) L.lights.push({ pos: [x, h - 1.1, z], color: p.palette.lightColor, intensity: p.palette.lightIntensity, distance: 10 });
      i++;
    }
  }
  // C12 スーパーのバックヤード（参考 12）: カゴ車 2〜3 台を棚列と平行な壁沿いに。乱数は専用 fork（棚・照明の乱数列は変えない）
  if (p.def.id === 'C12') rollCages(L, main, axis, p.rng.fork(`v${p.variant}`).fork('cages'));
}

/** カゴ車を壁沿いに 2〜3 台。棚列と平行な長い壁（列の端の通路 1.45 m を塞がない）、扉前・穴・既存のソリッドを避ける */
function rollCages(L: RoomLayout, main: Rect, axis: 'x' | 'z', rng: Rng): void {
  const want = rng.int(2, 3);
  const zones = doorZones(L.sockets, null, 0.3);
  const faces = rng.shuffle(innerFaces([main]).filter((f) => f.horizontal === (axis === 'x') && f.a1 - f.a0 >= 4));
  const start = L.shellCount ?? 0;
  let placed = 0;
  for (const f of faces) {
    if (placed >= want) break;
    for (const [a0, a1] of rng.shuffle(freeRuns(f, L.sockets, 1.4))) {
      if (placed >= want) break;
      if (a1 - a0 < 1.5) continue;
      // 1 区間に最大 2 台（間隔 0.3）
      const n = Math.min(want - placed, a1 - a0 >= 2.9 ? 2 : 1);
      const at0 = rng.float(a0 + 0.2, a1 - 0.2 - (n * 1.1 + (n - 1) * 0.3));
      for (let k = 0; k < n; k++) {
        const at = at0 + k * 1.4;
        const tmp: Box[] = [];
        rollCage(tmp, rng, f, at);
        const ok = tmp.every((b) => !b.solid || (!hitsZone(zones, b) && insideRects([main], b, 0.14) && !L.boxes.slice(start).some((o) => o.solid && boxesOverlap(o, b, 0.35))));
        if (!ok) continue;
        L.boxes.push(...tmp);
        placed++;
      }
    }
  }
}

function boxesOverlap(a: Box, b: Box, margin: number): boolean {
  return a.min[0] < b.max[0] + margin && a.max[0] > b.min[0] - margin && a.min[1] < b.max[1] + margin && a.max[1] > b.min[1] - margin && a.min[2] < b.max[2] + margin && a.max[2] > b.min[2] - margin;
}

/** 迷路（再帰的バックトラック）。cell 間隔の格子に壁を立てる */
function maze(L: RoomLayout, ir: Rect, cell: number, wallH: number, mat: MatId, rng: Rng, keepClear: (x: number, z: number, r?: number) => boolean): void {
  const nx = Math.max(2, Math.floor((ir.x1 - ir.x0) / cell));
  const nz = Math.max(2, Math.floor((ir.z1 - ir.z0) / cell));
  const visited = Array.from({ length: nx }, () => Array<boolean>(nz).fill(false));
  // 壁: vertical[x][z] = セル (x-1,z) と (x,z) の間、horizontal[x][z] = (x,z-1) と (x,z) の間
  const vwall = Array.from({ length: nx + 1 }, () => Array<boolean>(nz).fill(true));
  const hwall = Array.from({ length: nx }, () => Array<boolean>(nz + 1).fill(true));
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  while (stack.length) {
    const [cx, cz] = stack[stack.length - 1];
    const nbrs: [number, number, number][] = [];
    if (cx > 0 && !visited[cx - 1][cz]) nbrs.push([cx - 1, cz, 0]);
    if (cx < nx - 1 && !visited[cx + 1][cz]) nbrs.push([cx + 1, cz, 1]);
    if (cz > 0 && !visited[cx][cz - 1]) nbrs.push([cx, cz - 1, 2]);
    if (cz < nz - 1 && !visited[cx][cz + 1]) nbrs.push([cx, cz + 1, 3]);
    if (nbrs.length === 0) {
      stack.pop();
      continue;
    }
    const [mx, mz, dir] = rng.pick(nbrs);
    if (dir === 0) vwall[cx][cz] = false;
    if (dir === 1) vwall[cx + 1][cz] = false;
    if (dir === 2) hwall[cx][cz] = false;
    if (dir === 3) hwall[cx][cz + 1] = false;
    visited[mx][mz] = true;
    stack.push([mx, mz]);
  }
  // 余分に壁を抜いてループを作る（袋小路を減らす）
  for (let i = 0; i < nx * nz * 0.15; i++) {
    if (rng.chance(0.5)) vwall[rng.int(1, nx - 1)][rng.int(0, nz - 1)] = false;
    else hwall[rng.int(0, nx - 1)][rng.int(1, nz - 1)] = false;
  }
  const t = 0.1;
  for (let x = 1; x < nx; x++) {
    for (let z = 0; z < nz; z++) {
      if (!vwall[x][z]) continue;
      const wx = ir.x0 + x * cell;
      const z0 = ir.z0 + z * cell;
      if (keepClear(wx, z0 + cell / 2, 1.8)) continue;
      L.boxes.push(box([wx - t, 0, z0], [wx + t, wallH, z0 + cell], mat));
    }
  }
  for (let x = 0; x < nx; x++) {
    for (let z = 1; z < nz; z++) {
      if (!hwall[x][z]) continue;
      const wz = ir.z0 + z * cell;
      const x0 = ir.x0 + x * cell;
      if (keepClear(x0 + cell / 2, wz, 1.8)) continue;
      L.boxes.push(box([x0, 0, wz - t], [x0 + cell, wallH, wz + t], mat));
    }
  }
}
