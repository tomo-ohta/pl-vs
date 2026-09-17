/**
 * PropRepetition — 同一プロップの大量反復（U11 luggage 0.8 / U15 sameProduct 1.0 / R03 banquetTable 1.0 /
 * R20 storageDoor 1.0 / L13 serverRack 1.0 / L17 apartmentBlock 1.0）。params: propId, density（基準間隔の逆数）, scale（既定 1.0）。
 *
 * layout フックの決定論 post-pass。propId ごとの戦略:
 *  - grid（banquetTable / apartmentBlock / 既定 crates）: シェル以降の家具（FURNITURE_MATS）を捨て、格子（基準間隔 × scale / density）に再配置。
 *    大きなユニット（卓・棟・木箱）は solid 箱、細かい反復（椅子・窓）は L.instances（非 solid）。
 *  - shelfFill（sameProduct / serverRack / storageDoor）: GridGenerator の棚ブロック（shelfMetal / furnitureDark / metal の高い solid 箱）を検出し、
 *    その中身（非 solid の詰め物）を捨てて、同一ユニットを面に並べる。棚が無ければ自前で棚列を作る（fallback 部屋）。
 *    storageDoor の扉板は非 solid の 'doorMetal' 箱として L.boxes に出す（DuplicateNumber が「doorMetal の非 solid 箱 = 扉」として番号を貼れるように）。
 *  - ring（luggage）: 矩形リングのコンベア（solid 'metal' + 'rubber' ベルト面）を作り、その上に同一スーツケースを instances で並べる。
 * 通路: ソケット前 ±1.6 m と入口→各出口の直線帯 1.2 m は solid を置かない（PropRepetition.shared の Clearance）。
 * Tier: instances は RoomBuilder が instanceScale で間引く。solid 箱の数・位置は Tier に依らない。
 */
import type { AABB } from '../../core/aabb';
import type { Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { Rect } from '../../generators/footprint';
import { box, type Box, type InstanceSpec, type MatId, type RoomLayout } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { num, str } from '../util';
import {
  boxBlocked, clamp, clearanceOf, innerRect, interiorBoxesOf, isFurniture, overlapsSolid, pushInstances, removeInterior, type Clearance,
} from './PropRepetition.shared';

const MAX_PER_SPEC = 12000;

const PropRepetition: ModifierImpl = {
  id: 'PropRepetition',
  defaults: { propId: 'crates', density: 1.0, scale: 1.0 },
  layout(L, _p, params, rng) {
    const propId = str(params.propId, 'crates');
    const density = clamp(num(params.density, 1.0), 0.25, 3);
    const scale = clamp(num(params.scale, 1.0), 0.5, 3);
    const c = clearanceOf(L);
    switch (propId) {
      case 'luggage': return luggage(L, c, rng, density, scale);
      case 'banquetTable': return banquetTable(L, c, rng, density, scale);
      case 'sameProduct': return sameProduct(L, c, rng, density, scale);
      case 'storageDoor': return storageDoor(L, c, rng, density, scale);
      case 'serverRack': return serverRack(L, c, rng, density, scale);
      case 'apartmentBlock': return apartmentBlock(L, c, rng, density, scale);
      default: return crates(L, c, rng, density, scale);
    }
  },
};

export default PropRepetition;

// ---------------------------------------------------------------- 共通

interface GridOpts { margin: number; pitchX: number; pitchZ: number; halfX: number; halfZ: number; height: number; laneMargin?: number }

/** 格子の候補セル（通路・既存 solid に掛からないもの）。phase 0 / 1 で半ピッチずらす */
function gridCells(L: RoomLayout, c: Clearance, o: GridOpts, phase: 0 | 1): { cx: number; cz: number; ix: number; iz: number }[] {
  const out: { cx: number; cz: number; ix: number; iz: number }[] = [];
  for (const r of L.footprint) {
    const ir = innerRect(r, o.margin);
    const w = ir.x1 - ir.x0 - (phase ? o.pitchX : 0);
    const d = ir.z1 - ir.z0 - (phase ? o.pitchZ : 0);
    const nx = Math.floor(w / o.pitchX);
    const nz = Math.floor(d / o.pitchZ);
    if (nx < 1 || nz < 1) continue;
    const ox = ir.x0 + (phase ? o.pitchX / 2 : 0) + (w - nx * o.pitchX) / 2 + o.pitchX / 2;
    const oz = ir.z0 + (phase ? o.pitchZ / 2 : 0) + (d - nz * o.pitchZ) / 2 + o.pitchZ / 2;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const cx = ox + ix * o.pitchX;
        const cz = oz + iz * o.pitchZ;
        const fp: AABB = { min: [cx - o.halfX, 0, cz - o.halfZ], max: [cx + o.halfX, o.height, cz + o.halfZ] };
        if (boxBlocked(c, fp, o.laneMargin ?? 0.1) || overlapsSolid(L, fp)) continue;
        out.push({ cx, cz, ix, iz });
      }
    }
  }
  return out;
}

/** 各 footprint 矩形の内側を格子に走査し、置けるセルで place を呼ぶ。半ピッチずらした格子の方が多く置けるならそちらを使う（決定論） */
function gridPlace(L: RoomLayout, c: Clearance, o: GridOpts, place: (cx: number, cz: number, ix: number, iz: number) => void): number {
  const a = gridCells(L, c, o, 0);
  const b = gridCells(L, c, o, 1);
  const cells = b.length > a.length ? b : a;
  for (const cell of cells) place(cell.cx, cell.cz, cell.ix, cell.iz);
  return cells.length;
}

/** 棚ブロック（GridGenerator.shelves が出した高い solid 箱）を探す */
function findBlocks(L: RoomLayout, mats: MatId[], minH: number, minThick: number): Box[] {
  return interiorBoxesOf(L).filter((b) => b.solid && mats.includes(b.mat) && b.max[1] - b.min[1] >= minH && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= minThick && Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 1.2);
}

/** ブロックに掛かる非 solid の詰め物を捨てる（照明パネルは天井付近なので掛からない） */
function removeFills(L: RoomLayout, blocks: Box[]): void {
  removeInterior(L, (b) => !b.solid && !/^light|^ceiling/.test(b.mat) && blocks.some((k) => b.min[0] < k.max[0] + 0.15 && b.max[0] > k.min[0] - 0.15 && b.min[2] < k.max[2] + 0.15 && b.max[2] > k.min[2] - 0.15 && b.min[1] < k.max[1] + 0.1 && b.max[1] > k.min[1] - 0.1));
}

/** 棚が無い部屋（fallback）に自前の棚列を作る。axis 'x' の列を z 間隔で */
function makeRows(L: RoomLayout, c: Clearance, rng: Rng, o: { aisle: number; depth: number; height: number; mat: MatId; segment: number }): Box[] {
  const out: Box[] = [];
  const axis: 'x' | 'z' = rng.chance(0.5) ? 'x' : 'z';
  const pitch = o.aisle + o.depth;
  for (const r of L.footprint) {
    const ir = innerRect(r, 1.4);
    if (axis === 'x') {
      for (let z = ir.z0 + o.depth / 2 + 0.4; z + o.depth / 2 < ir.z1; z += pitch) {
        for (let x0 = ir.x0; x0 < ir.x1 - 1; x0 += o.segment + 1.2) {
          const x1 = Math.min(ir.x1, x0 + o.segment);
          pushRowPieces(L, c, out, [x0, 0, z - o.depth / 2], [x1, o.height, z + o.depth / 2], 'x', o.mat);
        }
      }
    } else {
      for (let x = ir.x0 + o.depth / 2 + 0.4; x + o.depth / 2 < ir.x1; x += pitch) {
        for (let z0 = ir.z0; z0 < ir.z1 - 1; z0 += o.segment + 1.2) {
          const z1 = Math.min(ir.z1, z0 + o.segment);
          pushRowPieces(L, c, out, [x - o.depth / 2, 0, z0], [x + o.depth / 2, o.height, z1], 'z', o.mat);
        }
      }
    }
  }
  return out;
}

/** 列を 0.5 m 刻みで通路判定し、置ける連続区間だけを箱にする */
function pushRowPieces(L: RoomLayout, c: Clearance, out: Box[], min: Vec3, max: Vec3, axis: 'x' | 'z', mat: MatId): void {
  const a0 = axis === 'x' ? min[0] : min[2];
  const a1 = axis === 'x' ? max[0] : max[2];
  let runStart: number | null = null;
  const flush = (end: number) => {
    if (runStart === null) return;
    if (end - runStart >= 1.0) {
      const b = axis === 'x' ? box([runStart, min[1], min[2]], [end, max[1], max[2]], mat) : box([min[0], min[1], runStart], [max[0], max[1], end], mat);
      L.boxes.push(b);
      out.push(b);
    }
    runStart = null;
  };
  for (let a = a0; a < a1 - 0.01; a += 0.5) {
    const e = Math.min(a1, a + 0.5);
    const piece: AABB = axis === 'x' ? { min: [a, min[1], min[2]], max: [e, max[1], max[2]] } : { min: [min[0], min[1], a], max: [max[0], max[1], e] };
    if (boxBlocked(c, piece, 0.1) || overlapsSolid(L, piece)) flush(a);
    else if (runStart === null) runStart = a;
  }
  flush(a1);
}

/** ブロックの長い面を列挙する（面の法線方向 sign と、面に沿った区間） */
function longFaces(b: Box): { alongX: boolean; at: number; sign: 1 | -1; a0: number; a1: number; y0: number; y1: number }[] {
  const w = b.max[0] - b.min[0];
  const d = b.max[2] - b.min[2];
  const alongX = w >= d;
  const out: { alongX: boolean; at: number; sign: 1 | -1; a0: number; a1: number; y0: number; y1: number }[] = [];
  if (alongX) {
    out.push({ alongX, at: b.max[2], sign: 1, a0: b.min[0], a1: b.max[0], y0: b.min[1], y1: b.max[1] });
    out.push({ alongX, at: b.min[2], sign: -1, a0: b.min[0], a1: b.max[0], y0: b.min[1], y1: b.max[1] });
  } else {
    out.push({ alongX, at: b.max[0], sign: 1, a0: b.min[2], a1: b.max[2], y0: b.min[1], y1: b.max[1] });
    out.push({ alongX, at: b.min[0], sign: -1, a0: b.min[2], a1: b.max[2], y0: b.min[1], y1: b.max[1] });
  }
  return out;
}

/** 面上の位置（面に沿った a、面からの張り出し off、高さ y）をワールド（ローカル座標）に */
function onFace(f: { alongX: boolean; at: number; sign: 1 | -1 }, a: number, off: number, y: number): Vec3 {
  return f.alongX ? [a, y, f.at + f.sign * off] : [f.at + f.sign * off, y, a];
}

// ---------------------------------------------------------------- banquetTable（R03）

function banquetTable(L: RoomLayout, c: Clearance, rng: Rng, density: number, scale: number): void {
  removeInterior(L, (b) => isFurniture(b));
  const pitch = Math.max(2.6 * scale, (3.2 * scale) / density);
  const tableW = 1.6 * scale;
  const seat: InstanceSpec = { mat: 'upholstery', size: [0.42 * scale, 0.46 * scale, 0.42 * scale], transforms: [], solid: false };
  const back: InstanceSpec = { mat: 'furnitureDark', size: [0.42 * scale, 0.9 * scale, 0.06 * scale], transforms: [], solid: false };
  const cloth = 'wallWhite';
  gridPlace(L, c, { margin: 1.2, pitchX: pitch, pitchZ: pitch, halfX: tableW / 2 + 0.55 * scale, halfZ: tableW / 2 + 0.55 * scale, height: 1.0 }, (cx, cz) => {
    L.boxes.push(box([cx - tableW / 2, 0, cz - tableW / 2], [cx + tableW / 2, 0.75, cz + tableW / 2], 'furnitureLight'));
    L.boxes.push(box([cx - tableW / 2 - 0.05, 0.75, cz - tableW / 2 - 0.05], [cx + tableW / 2 + 0.05, 0.77, cz + tableW / 2 + 0.05], cloth, false));
    // 椅子 4 脚（卓を向く）。背は卓から見て外側
    const r0 = tableW / 2 + 0.28 * scale;
    for (const [dx, dz, yaw] of [[0, 1, Math.PI], [1, 0, -Math.PI / 2], [0, -1, 0], [-1, 0, Math.PI / 2]] as [number, number, number][]) {
      seat.transforms.push({ pos: [cx + dx * r0, 0, cz + dz * r0], yaw });
      const rb = r0 + 0.18 * scale;
      back.transforms.push({ pos: [cx + dx * rb, 0, cz + dz * rb], yaw });
    }
  });
  pushInstances(L, rng, seat);
  pushInstances(L, rng, back);
}

// ---------------------------------------------------------------- apartmentBlock（L17）

function apartmentBlock(L: RoomLayout, c: Clearance, rng: Rng, density: number, scale: number): void {
  // StreetGenerator（L17 本実装）が既に同形の棟（wallConcrete / wallBrick のソリッド、高さ ≥ 5 m、幅 ≥ 3 m）を反復配置していれば、
  // 街路上に棟を追加せず街灯・偽扉・車も残す（Generator が形、Modifier が挙動。ここは LargeRoom fallback 向けの暫定表示）
  const hasBlocks = interiorBoxesOf(L).some((b) => b.solid && (b.mat === 'wallConcrete' || b.mat === 'wallBrick') && b.max[1] - b.min[1] >= 5 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) >= 3);
  if (hasBlocks) return;
  // 団地の棟自体が構造物なので、LargeRoom fallback の柱も捨てる
  removeInterior(L, (b) => isFurniture(b) || b.mat === 'columnConcrete');
  const bh = Math.max(2.2, L.height - 0.5);
  // 棟 6×3 m（fallback の LargeRoom で通路に阻まれて 4 棟未満なら 4.2×3 m に縮める）
  const gridFor = (w: number): GridOpts => ({ margin: 1.0, pitchX: (w + 3.2 * scale) / density, pitchZ: (3 * scale + 3.2 * scale) / density, halfX: w / 2 + 0.3, halfZ: (3 * scale) / 2 + 0.3, height: bh });
  const big = Math.max(gridCells(L, c, gridFor(6 * scale), 0).length, gridCells(L, c, gridFor(6 * scale), 1).length);
  const bw = big >= 6 ? 6 * scale : 4.2 * scale;
  const bd = 3 * scale;
  const grid = gridFor(bw);
  const lit: InstanceSpec = { mat: 'windowLit', size: [0.9 * scale, 1.1 * scale, 0.04], transforms: [], solid: false };
  const dark: InstanceSpec = { mat: 'windowDark', size: [0.9 * scale, 1.1 * scale, 0.04], transforms: [], solid: false };
  const lamps: InstanceSpec = { mat: 'sodiumLight', size: [0.18, 0.18, 0.18], transforms: [], solid: false };
  const poles: InstanceSpec = { mat: 'metal', size: [0.08, Math.min(3.0, bh - 0.1), 0.08], transforms: [], solid: false };
  gridPlace(L, c, grid, (cx, cz, ix, iz) => {
    const b = box([cx - bw / 2, 0, cz - bd / 2], [cx + bw / 2, bh, cz + bd / 2], 'wallConcrete');
    L.boxes.push(b);
    // 屋上の縁と入口扉（+Z 面中央、非 solid）
    L.boxes.push(box([cx - bw / 2 - 0.08, bh - 0.25, cz - bd / 2 - 0.08], [cx + bw / 2 + 0.08, bh, cz + bd / 2 + 0.08], 'wallDark', false));
    L.boxes.push(box([cx - 0.45, 0, cz + bd / 2 + 0.005], [cx + 0.45, 2.0, cz + bd / 2 + 0.04], 'doorMetal', false));
    // 窓: 長辺 2 面、階高 2.8 m ごと、横 4 枚
    for (const f of longFaces(b)) {
      for (let y = 1.0 * scale; y + 1.3 * scale < bh; y += 2.8 * scale) {
        for (let k = 0; k < 4; k++) {
          const a = f.a0 + (bw * (k + 0.5)) / 4;
          if (Math.abs(a - (f.a0 + f.a1) / 2) < 0.6 && y < 2.2 * scale && f.sign === 1) continue; // 入口の上は空ける
          const spec = rng.chance(0.35) ? lit : dark;
          spec.transforms.push({ pos: onFace(f, a, 0.03, y), yaw: f.alongX ? 0 : Math.PI / 2 });
        }
      }
    }
    // 街灯（棟の角、交互）
    if ((ix + iz) % 2 === 0) {
      const px = cx + bw / 2 + 0.6, pz = cz + bd / 2 + 0.6;
      const fp: AABB = { min: [px - 0.1, 0, pz - 0.1], max: [px + 0.1, 3, pz + 0.1] };
      if (!boxBlocked(c, fp, 0.1) && !overlapsSolid(L, fp)) {
        poles.transforms.push({ pos: [px, 0, pz], yaw: 0 });
        lamps.transforms.push({ pos: [px, Math.min(3.0, bh - 0.1) - 0.15, pz], yaw: 0 });
      }
    }
  });
  pushInstances(L, rng, lit);
  pushInstances(L, rng, dark);
  pushInstances(L, rng, poles);
  pushInstances(L, rng, lamps);
}

// ---------------------------------------------------------------- crates（既定）

function crates(L: RoomLayout, c: Clearance, _rng: Rng, density: number, scale: number): void {
  removeInterior(L, (b) => isFurniture(b));
  const s = 1.0 * scale;
  const pitch = (s + 1.4) / density;
  gridPlace(L, c, { margin: 1.2, pitchX: pitch, pitchZ: pitch, halfX: s / 2, halfZ: s / 2, height: s }, (cx, cz) => {
    L.boxes.push(box([cx - s / 2, 0, cz - s / 2], [cx + s / 2, s, cz + s / 2], 'boxCardboard'));
  });
}

// ---------------------------------------------------------------- luggage（U11）

function luggage(L: RoomLayout, c: Clearance, rng: Rng, density: number, scale: number): void {
  removeInterior(L, (b) => isFurniture(b));
  const beltW = 1.0 * scale;
  const beltH = 0.9;
  const bag: InstanceSpec = { mat: 'upholstery', size: [0.7 * scale, 0.3 * scale, 0.5 * scale], transforms: [], solid: false };
  const handle: InstanceSpec = { mat: 'metal', size: [0.3 * scale, 0.04, 0.04], transforms: [], solid: false };
  const rings: Rect[] = [];
  for (const r of L.footprint) {
    const ir = innerRect(r, 2.4);
    const w = ir.x1 - ir.x0;
    const d = ir.z1 - ir.z0;
    if (w < 5 || d < 5) continue;
    // 両辺が長ければ 2 リングに割る（間 3 m）
    if (w > 22 && w >= d) {
      const half = (w - 3) / 2;
      rings.push({ x0: ir.x0, z0: ir.z0, x1: ir.x0 + half, z1: ir.z1 }, { x0: ir.x1 - half, z0: ir.z0, x1: ir.x1, z1: ir.z1 });
    } else if (d > 22) {
      const half = (d - 3) / 2;
      rings.push({ x0: ir.x0, z0: ir.z0, x1: ir.x1, z1: ir.z0 + half }, { x0: ir.x0, z0: ir.z1 - half, x1: ir.x1, z1: ir.z1 });
    } else rings.push(ir);
  }
  const pitch = Math.max(0.9 * scale, (1.1 * scale) / density);
  for (const rr of rings) {
    // リングの 4 辺（外周 rr、ベルト幅は内側へ）
    const sides: { min: Vec3; max: Vec3; axis: 'x' | 'z' }[] = [
      { min: [rr.x0, 0, rr.z0], max: [rr.x1, beltH, rr.z0 + beltW], axis: 'x' },
      { min: [rr.x0, 0, rr.z1 - beltW], max: [rr.x1, beltH, rr.z1], axis: 'x' },
      { min: [rr.x0, 0, rr.z0 + beltW], max: [rr.x0 + beltW, beltH, rr.z1 - beltW], axis: 'z' },
      { min: [rr.x1 - beltW, 0, rr.z0 + beltW], max: [rr.x1, beltH, rr.z1 - beltW], axis: 'z' },
    ];
    const pieces: Box[] = [];
    for (const s of sides) pushRowPieces(L, c, pieces, s.min, s.max, s.axis, 'metal');
    // ベルト面（非 solid の薄い rubber）
    for (const b of pieces) L.boxes.push(box([b.min[0] + 0.05, beltH, b.min[2] + 0.05], [b.max[0] - 0.05, beltH + 0.03, b.max[2] - 0.05], 'rubber', false));
    // 中央島（斜面の代わりの低い台）。通路に掛かれば置かない
    const island = box([rr.x0 + beltW + 0.3, 0, rr.z0 + beltW + 0.3], [rr.x1 - beltW - 0.3, 1.3, rr.z1 - beltW - 0.3], 'furnitureDark');
    if (island.max[0] - island.min[0] > 1 && island.max[2] - island.min[2] > 1 && !boxBlocked(c, island, 0.1) && !overlapsSolid(L, island)) L.boxes.push(box(island.min, island.max, 'furnitureDark'));
    // スーツケース: ベルト中心線に沿って等間隔。ベルトの無い所（通路で切れた所）は飛ばす
    const path: [number, number, number][] = [
      [rr.x0 + beltW / 2, rr.z0 + beltW / 2, 0], [rr.x1 - beltW / 2, rr.z0 + beltW / 2, Math.PI / 2],
      [rr.x1 - beltW / 2, rr.z1 - beltW / 2, Math.PI], [rr.x0 + beltW / 2, rr.z1 - beltW / 2, -Math.PI / 2],
    ];
    for (let i = 0; i < 4; i++) {
      const [ax, az, yaw] = path[i];
      const [bx, bz] = path[(i + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.floor(len / pitch);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        if (!pieces.some((b) => x > b.min[0] + 0.3 && x < b.max[0] - 0.3 && z > b.min[2] + 0.3 && z < b.max[2] - 0.3)) continue;
        if (bag.transforms.length >= MAX_PER_SPEC) break;
        bag.transforms.push({ pos: [x, beltH + 0.03, z], yaw });
        handle.transforms.push({ pos: [x, beltH + 0.03 + 0.3 * scale, z], yaw });
      }
    }
  }
  pushInstances(L, rng, bag);
  pushInstances(L, rng, handle);
  // 案内板（入口の内側上部）
  const entry = L.sockets.find((s) => s.id === 'entry' && s.type !== 'hole');
  if (entry) {
    const inward = entry.dir === 0 ? [0, -1] : entry.dir === 1 ? [-1, 0] : entry.dir === 2 ? [0, 1] : [1, 0];
    const pos: Vec3 = [entry.pos[0] + inward[0] * 0.17, Math.min(L.height - 0.3, entry.height + 0.45), entry.pos[2] + inward[1] * 0.17];
    if (!L.signs) L.signs = [];
    L.signs.push({ text: 'BAGGAGE CLAIM', sub: '手荷物受取所', pos, dir: ((entry.dir + 2) % 4) as 0 | 1 | 2 | 3, width: 1.6, kind: 'emissive', color: 0xffffff, background: 0x1a3a6a });
  }
}

// ---------------------------------------------------------------- sameProduct（U15）

function sameProduct(L: RoomLayout, c: Clearance, rng: Rng, density: number, scale: number): void {
  let blocks = findBlocks(L, ['shelfMetal', 'furnitureLight', 'furnitureDark'], 1.3, 0.5);
  if (blocks.length === 0) blocks = makeRows(L, c, rng, { aisle: 2.2, depth: 0.9, height: 1.7, mat: 'shelfMetal', segment: 6 });
  removeFills(L, blocks);
  // 商品は seed で 1 種（全て同じ）
  const mat = rng.pick<MatId>(['boxCardboard', 'carPaint', 'wallGreen', 'yellowLine', 'upholstery', 'lightGreen']);
  const pw = 0.28 * scale, ph = 0.36 * scale, pd = 0.24 * scale;
  let pitch = Math.max(pw + 0.02, (0.32 * scale) / density);
  // 上限を超えそうなら間隔を広げる（Tier 間引きは RoomBuilder 側）
  const estimate = () => blocks.reduce((n, b) => {
    const len = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]);
    const h = b.max[1] - b.min[1];
    const levels = Math.max(1, Math.floor((h - 0.3) / Math.max(0.9, h / 3)));
    return n + (len / pitch) * 2 * levels;
  }, 0);
  while (estimate() > MAX_PER_SPEC) pitch *= 1.25;
  const spec: InstanceSpec = { mat, size: [pw, ph, pd], transforms: [], solid: false };
  for (const b of blocks) {
    const h = b.max[1] - b.min[1];
    const depth = Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]);
    const step = Math.max(0.9, h / 3);
    for (const f of longFaces(b)) {
      const single = depth < 0.6;
      if (single && f.sign < 0) continue;
      const off = single ? -depth / 2 : -(pd / 2 + 0.03); // 面から内側へ（棚板の上）
      for (let y = b.min[1] + 0.25 + 0.05; y + ph < b.max[1] - 0.02; y += step) {
        const n = Math.floor((f.a1 - f.a0 - 0.2) / pitch);
        const start = f.a0 + ((f.a1 - f.a0) - n * pitch) / 2 + pitch / 2;
        for (let k = 0; k < n; k++) {
          spec.transforms.push({ pos: onFace(f, start + k * pitch, off, y), yaw: f.alongX ? 0 : Math.PI / 2 });
        }
      }
    }
  }
  pushInstances(L, rng, spec);
}

// ---------------------------------------------------------------- storageDoor（R20）

function storageDoor(L: RoomLayout, c: Clearance, rng: Rng, density: number, scale: number): void {
  let blocks = findBlocks(L, ['metal', 'shelfMetal', 'wallConcrete'], 2.0, 1.4);
  if (blocks.length === 0) blocks = makeRows(L, c, rng, { aisle: 2.2, depth: 2.4, height: Math.max(2.6, L.height - 0.4), mat: 'metal', segment: 12 });
  removeFills(L, blocks);
  const pitch = Math.max(1.2, (2.4 * scale) / density);
  const doorW = Math.min(pitch - 0.2, 2.3 * scale);
  const handles: InstanceSpec = { mat: 'metal', size: [0.05, 0.35, 0.06], transforms: [], solid: false };
  const ribs: InstanceSpec = { mat: 'wallDark', size: [doorW - 0.1, 0.03, 0.02], transforms: [], solid: false };
  for (const b of blocks) {
    const doorH = Math.min(2.4 * scale, b.max[1] - b.min[1] - 0.3);
    if (doorH < 1.6) continue;
    for (const f of longFaces(b)) {
      const n = Math.floor((f.a1 - f.a0 - 0.1) / pitch);
      if (n < 1) continue;
      const start = f.a0 + ((f.a1 - f.a0) - n * pitch) / 2 + pitch / 2;
      for (let k = 0; k < n; k++) {
        const a = start + k * pitch;
        // 扉板（非 solid の doorMetal 箱。DuplicateNumber が扉として番号を貼る）
        const lo = onFace(f, a - doorW / 2, 0.02, b.min[1] + 0.02);
        const hi = onFace(f, a + doorW / 2, 0.07, b.min[1] + 0.02 + doorH);
        L.boxes.push(box(lo, hi, 'doorMetal', false));
        // 枠（wallDark の薄い帯）
        const flo = onFace(f, a - doorW / 2 - 0.06, 0.0, b.min[1] + doorH + 0.02);
        const fhi = onFace(f, a + doorW / 2 + 0.06, 0.08, b.min[1] + doorH + 0.14);
        L.boxes.push(box(flo, fhi, 'wallDark', false));
        // 取手とシャッターの横筋
        handles.transforms.push({ pos: onFace(f, a + doorW / 2 - 0.3, 0.1, b.min[1] + 0.95), yaw: f.alongX ? 0 : Math.PI / 2 });
        for (let y = b.min[1] + 0.5; y < b.min[1] + doorH - 0.2; y += 0.5) {
          ribs.transforms.push({ pos: onFace(f, a, 0.085, y), yaw: f.alongX ? 0 : Math.PI / 2 });
        }
      }
    }
  }
  pushInstances(L, rng, handles);
  pushInstances(L, rng, ribs);
}

// ---------------------------------------------------------------- serverRack（L13）

function serverRack(L: RoomLayout, c: Clearance, rng: Rng, density: number, scale: number): void {
  let blocks = findBlocks(L, ['furnitureDark', 'shelfMetal', 'metal'], 1.8, 0.7);
  if (blocks.length === 0) blocks = makeRows(L, c, rng, { aisle: 1.6, depth: 1.0, height: 2.2, mat: 'furnitureDark', segment: 7 });
  removeFills(L, blocks);
  // ServerGrid の詰め物（低い非ソリッド ledBlue 箔）はブロックに掛からない位置のものも全て消す（元の詰め物は LED 帯に置き換わる）
  removeInterior(L, (b) => !b.solid && b.mat === 'ledBlue' && b.max[1] - b.min[1] <= 0.6);
  const pitch = Math.max(0.45, (0.6 * scale) / density);
  const rails: InstanceSpec = { mat: 'metal', size: [0.03, 2.0, 0.03], transforms: [], solid: false };
  const leds: InstanceSpec = { mat: 'ledBlue', size: [pitch - 0.14, 0.03, 0.02], transforms: [], solid: false };
  const screens: InstanceSpec = { mat: 'screenGlow', size: [0.12, 0.08, 0.02], transforms: [], solid: false };
  let ledStep = 0.32;
  const estimate = () => blocks.reduce((n, b) => n + (Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) / pitch) * 2 * Math.floor((b.max[1] - b.min[1] - 0.5) / ledStep), 0);
  // LED はレール・画面（合わせて 2 割前後）と合算で MAX_PER_SPEC（12000）に収める
  while (estimate() > MAX_PER_SPEC * 0.7) ledStep *= 1.3;
  for (const b of blocks) {
    const h = b.max[1] - b.min[1];
    rails.size = [0.03, h - 0.1, 0.03];
    for (const f of longFaces(b)) {
      const n = Math.floor((f.a1 - f.a0) / pitch);
      if (n < 1) continue;
      const start = f.a0 + ((f.a1 - f.a0) - n * pitch) / 2;
      for (let k = 0; k <= n; k++) rails.transforms.push({ pos: onFace(f, start + k * pitch, 0.02, b.min[1] + 0.05), yaw: f.alongX ? 0 : Math.PI / 2 });
      for (let k = 0; k < n; k++) {
        const a = start + (k + 0.5) * pitch;
        for (let y = b.min[1] + 0.35; y < b.max[1] - 0.2; y += ledStep) {
          leds.transforms.push({ pos: onFace(f, a, 0.03, y), yaw: f.alongX ? 0 : Math.PI / 2 });
        }
        if (k % 3 === 1) screens.transforms.push({ pos: onFace(f, a, 0.035, b.min[1] + 1.45), yaw: f.alongX ? 0 : Math.PI / 2 });
      }
    }
  }
  pushInstances(L, rng, rails);
  pushInstances(L, rng, leds);
  pushInstances(L, rng, screens);
  // ラック列はチャンク分割の対象（layoutHints chunked）: 既定より細かい格子で距離カリングを効かせる
  if (!L.chunkSize) L.chunkSize = 24;
}
