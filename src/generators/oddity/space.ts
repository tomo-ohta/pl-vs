/**
 * 奇妙さ生成: 広い部屋を「ただの広い空間」にしない仕掛け（category 'space'）。
 * index.ts は主矩形が広く内装が少ない部屋（Legendary / Mythic 以外）で、ここから必ず主題を 1 つ選ぶ。通常の主題候補にもなる。
 *  - space.pillarGrid   規則的な柱の格子（1 本だけ抜ける / ずれる）
 *  - space.partitions   壁や間仕切りで不自然に区切る（動線は塞がない）
 *  - space.lonelyObject 物が意味深に 1 つだけ置かれている（中央の椅子が壁を向く、椀 1 脚の長机…）
 *  - space.regularArray 同じ物が規則的に並ぶ（椰子の格子 / 段ボール箱の格子）
 *  - space.scatter      雑多に散らばる（段ボール・椰子・机がばらばらの向き）
 */
import { chair, longTable } from '../furniture';
import {
  WALL_T, budgetOk, canPlace, commit, inner, interior, mainRect, oddBox, pick, put, spec, wallMat,
  type Box, type Ctx, type Dir, type Oddity, type Rect,
} from './shared';

/** 部屋が「広くて空」か: 主矩形 ≥ 90 m² で、足跡 0.25 m² 以上・高さ 0.4 m 以上のソリッド内装が 40 m² あたり 1 つ未満 */
export function isLargeEmpty(c: Ctx): boolean {
  const r = mainRect(c);
  const area = (r.x1 - r.x0) * (r.z1 - r.z0);
  if (area < 90) return false;
  let n = 0;
  for (const b of interior(c.L)) {
    if (!b.solid) continue;
    const fp = (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]);
    if (fp < 0.25 || b.max[1] - b.min[1] < 0.4) continue;
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    if (cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1) n++;
  }
  return n < area / 40;
}

function areaOf(r: Rect): number { return (r.x1 - r.x0) * (r.z1 - r.z0); }

/** 一時配列に家具を作り、全箱が置けるときだけ L.boxes に足す */
function placeGroup(c: Ctx, build: (B: Box[]) => void, o: { lanes?: boolean } = {}): boolean {
  const B: Box[] = [];
  build(B);
  if (!B.length) return false;
  for (const b of B) if (b.solid && !canPlace(c, b, { lanes: o.lanes ?? true, ignore: (q) => B.includes(q) })) return false;
  c.L.boxes.push(...B);
  return true;
}

// ---------------------------------------------------------------- 柱の格子
const pillarGrid: Oddity = {
  id: 'space.pillarGrid', category: 'space', weight: 3, theme: true,
  applicable(c) { const r = mainRect(c); return Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 9; },
  apply(c, strength) {
    const r = inner(mainRect(c), WALL_T + 1.2);
    const pitch = c.rng.float(4.2, 6.0);
    const nx = Math.max(2, Math.floor((r.x1 - r.x0) / pitch)), nz = Math.max(2, Math.floor((r.z1 - r.z0) / pitch));
    const px = (r.x1 - r.x0) / nx, pz = (r.z1 - r.z0) / nz;
    const half = 0.22;
    const placed: Box[] = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (!budgetOk(c, 1)) break;
      const x = r.x0 + px * (i + 0.5), z = r.z0 + pz * (j + 0.5);
      const b = oddBox([x - half, 0, z - half], [x + half, c.h, z + half], 'columnConcrete', true);
      if (canPlace(c, b)) placed.push(b);
    }
    if (placed.length < 6) return false;
    // 1 本だけ格子から外す: strong は 0.7 m ずらす + 別の 1 本を抜く、weak は 1 本抜くだけ
    const drop = c.rng.int(0, placed.length - 1);
    let shifted: Box | null = null;
    if (strength === 'strong') {
      const k = (drop + 1 + c.rng.int(0, placed.length - 2)) % placed.length;
      const s = placed[k];
      const dx = c.rng.chance(0.5) ? 0.7 : -0.7;
      shifted = { ...s, min: [s.min[0] + dx, s.min[1], s.min[2]], max: [s.max[0] + dx, s.max[1], s.max[2]] };
      if (canPlace(c, shifted)) placed[k] = shifted; else shifted = null;
    }
    placed.splice(drop, 1);
    c.L.boxes.push(...placed);
    c.note(`pillarGrid: ${placed.length} pillars, dropped 1${shifted ? ', shifted 1' : ''}`);
    return true;
  },
};

// ---------------------------------------------------------------- 間仕切り
const partitions: Oddity = {
  id: 'space.partitions', category: 'space', weight: 3, theme: true,
  applicable(c) { const r = mainRect(c); return Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 7; },
  apply(c, strength) {
    const r = inner(mainRect(c), WALL_T + 0.8);
    const n = strength === 'strong' ? c.rng.int(6, 10) : c.rng.int(3, 5);
    const full = c.rng.chance(0.4);
    const top = full ? c.h : Math.min(c.h - 0.5, 2.3);
    const mat = wallMat(c);
    let placed = 0;
    for (let t = 0; t < n * 6 && placed < n; t++) {
      if (!budgetOk(c, 2)) break;
      const alongX = c.rng.chance(0.5);
      const len = c.rng.float(2.0, Math.min(6.5, alongX ? r.x1 - r.x0 : r.z1 - r.z0));
      const x0 = c.rng.float(r.x0, r.x1 - (alongX ? len : 0.15));
      const z0 = c.rng.float(r.z0, r.z1 - (alongX ? 0.15 : len));
      const b = alongX ? oddBox([x0, 0, z0], [x0 + len, top, z0 + 0.15], mat, true) : oddBox([x0, 0, z0], [x0 + 0.15, top, z0 + len], mat, true);
      if (!canPlace(c, b, { gap: 0.4 })) continue;
      c.L.boxes.push(b);
      placed++;
      // 3 割で L 字に折れる
      if (c.rng.chance(0.3) && budgetOk(c, 1)) {
        const l2 = c.rng.float(1.2, 3.0);
        const b2 = alongX ? oddBox([x0 + len - 0.15, 0, z0], [x0 + len, top, Math.min(r.z1, z0 + l2)], mat, true) : oddBox([x0, 0, z0 + len - 0.15], [Math.min(r.x1, x0 + l2), top, z0 + len], mat, true);
        if (canPlace(c, b2, { gap: 0.4, ignore: (q) => q === b })) { c.L.boxes.push(b2); placed++; }
      }
    }
    if (placed < 2) return false;
    c.note(`partitions: ${placed} walls${full ? ' full height' : ''}`);
    return true;
  },
};

// ---------------------------------------------------------------- 意味深な 1 つの物
const lonelyObject: Oddity = {
  id: 'space.lonelyObject', category: 'space', weight: 2, theme: true,
  applicable(c) { const r = mainRect(c); return Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 6; },
  apply(c, strength) {
    const r = strength === 'strong' && areaOf(c.focus) > 20 ? c.focus : mainRect(c);
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const kind = pick(c.rng, ['chairToWall', 'tableOneChair', 'chairPair'] as const);
    let ok = false;
    for (let t = 0; t < 10 && !ok; t++) {
      const x = cx + c.rng.float(-1.5, 1.5), z = cz + c.rng.float(-1.5, 1.5);
      if (kind === 'chairToWall') {
        // 壁の 1 点を向く（入口には背を向ける）
        const facing = pick(c.rng, [0, 1, 2, 3] as Dir[]);
        ok = placeGroup(c, (B) => chair(B, x, z, facing));
      } else if (kind === 'tableOneChair') {
        ok = placeGroup(c, (B) => { longTable(B, x, z, true, 1.8, 0.75); chair(B, x, z + 0.75, 2); });
      } else {
        ok = placeGroup(c, (B) => { chair(B, x - 0.45, z, 1); chair(B, x + 0.45, z, 3); });
      }
      if (ok) {
        // 真上に見えない光源（その物だけが明るい）
        c.L.boxes.push({ ...oddBox([x - 0.5, c.h - 0.05, z - 0.5], [x + 0.5, c.h - 0.01, z + 0.5], 'lightWarm', false), kind: 'emitOnly' });
        c.note(`lonelyObject: ${kind}`);
      }
    }
    return ok;
  },
};

// ---------------------------------------------------------------- 規則的な配列
const regularArray: Oddity = {
  id: 'space.regularArray', category: 'space', weight: 3, theme: true,
  applicable(c) { const r = mainRect(c); return Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 7; },
  apply(c, strength) {
    const r = inner(mainRect(c), WALL_T + 1.0);
    const useChairs = areaOf(r) <= 320 && c.rng.chance(0.6);
    if (useChairs) {
      const facing = pick(c.rng, [0, 1, 2, 3] as Dir[]);
      const pitch = c.rng.float(1.5, 1.9);
      let n = 0;
      for (let x = r.x0 + 0.5; x < r.x1 - 0.5 && n < 36; x += pitch) for (let z = r.z0 + 0.5; z < r.z1 - 0.5 && n < 36; z += pitch) {
        if (!budgetOk(c, 8)) break;
        if (placeGroup(c, (B) => chair(B, x, z, facing))) n++;
      }
      if (n < 6) return false;
      c.note(`regularArray: ${n} chairs facing ${facing}`);
      return true;
    }
    // 段ボール箱の格子（instances、ソリッド）。strong は 2 段
    const boxSpec = spec('boxCardboard', [0.55, 0.45, 0.55], true);
    const pitch = c.rng.float(1.2, 1.6);
    let n = 0;
    for (let x = r.x0 + 0.4; x < r.x1 - 0.4 && n < 240; x += pitch) for (let z = r.z0 + 0.4; z < r.z1 - 0.4 && n < 240; z += pitch) {
      const probe = oddBox([x - 0.28, 0, z - 0.28], [x + 0.28, 0.45, z + 0.28], 'boxCardboard', true);
      if (!canPlace(c, probe)) continue;
      put(boxSpec, [x, 0.225, z], 0);
      n++;
      if (strength === 'strong' && c.rng.chance(0.35)) { put(boxSpec, [x, 0.675, z], 0.1); n++; }
    }
    if (n < 8) return false;
    commit(c.L, boxSpec);
    c.note(`regularArray: ${n} cardboard boxes`);
    return true;
  },
};

// ---------------------------------------------------------------- 雑多に散らばる
const scatter: Oddity = {
  id: 'space.scatter', category: 'space', weight: 2, theme: true,
  applicable(c) { const r = mainRect(c); return Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 6; },
  apply(c, strength) {
    const r = inner(mainRect(c), WALL_T + 0.6);
    const n = strength === 'strong' ? c.rng.int(18, 34) : c.rng.int(8, 14);
    const boxSpec = spec('boxCardboard', [0.55, 0.45, 0.55], true);
    let boxes = 0, chairs = 0, tables = 0;
    for (let t = 0; t < n * 4 && boxes + chairs + tables < n; t++) {
      if (!budgetOk(c, 8)) break;
      const x = c.rng.float(r.x0, r.x1), z = c.rng.float(r.z0, r.z1);
      const roll = c.rng.float(0, 1);
      if (roll < 0.55) {
        const probe = oddBox([x - 0.35, 0, z - 0.35], [x + 0.35, 0.45, z + 0.35], 'boxCardboard', true);
        if (!canPlace(c, probe)) continue;
        put(boxSpec, [x, 0.225, z], c.rng.float(0, Math.PI));
        if (c.rng.chance(0.3)) put(boxSpec, [x, 0.675, z], c.rng.float(0, Math.PI));
        boxes++;
      } else if (roll < 0.9) {
        if (placeGroup(c, (B) => chair(B, x, z, pick(c.rng, [0, 1, 2, 3] as Dir[])))) chairs++;
      } else if (placeGroup(c, (B) => longTable(B, x, z, c.rng.chance(0.5), 1.8, 0.75))) tables++;
    }
    commit(c.L, boxSpec);
    if (boxes + chairs + tables < 5) return false;
    c.note(`scatter: boxes=${boxes} chairs=${chairs} tables=${tables}`);
    return true;
  },
};

export const SPACE_ODDITIES: Oddity[] = [pillarGrid, partitions, lonelyObject, regularArray, scatter];
