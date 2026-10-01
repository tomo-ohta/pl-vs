/** 奇妙さ生成: 床・壁・天井の異常と水（担当 O3）。shared.ts のヘルパだけを使う。各 Oddity は applicable / apply（strong = 主題、weak = 添え物）を持つ */
import {
  alongFace, budgetOk, canPlace, cutShell, freeRuns, inFocus, innerFaces, interior,
  isCeilingBox, mainRect, oddBox, ODD_KIND, pick, wallMat,
  type Box, type Ctx, type Face, type Oddity, type Rect, type Strength, type Vec3,
} from './shared';

// ---------------------------------------------------------------- ファイル内ヘルパ

/** 矩形どうしが重なるか（pad だけ広げて判定） */
function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x0 - pad < b.x1 && a.x1 + pad > b.x0 && a.z0 - pad < b.z1 && a.z1 + pad > b.z0;
}

/** 足跡の矩形を面積の重みで 1 つ選ぶ */
function someRect(c: Ctx): Rect {
  return c.rng.weighted(c.rects, (r) => (r.x1 - r.x0) * (r.z1 - r.z0));
}

/** 高さ 0..y の probe 箱（canPlace / inFocus 用） */
function probeOf(r: Rect, y = 0.3): Box {
  return oddBox([r.x0, 0, r.z0], [r.x1, y, r.z1], 'void', true);
}

/** シェルに天井の箱があるか */
function hasCeiling(c: Ctx): boolean {
  const shell = c.L.boxes.slice(0, c.start);
  return shell.some((b) => isCeilingBox(b, c.h));
}

/** 内装の既存の器具箔（天井直下の薄い lightPanel / lightWarm。emitOnly / glowOnly は除く） */
function fixtureFoils(c: Ctx): Box[] {
  const h = c.h;
  return interior(c.L).filter((b) => !b.solid && (b.mat === 'lightPanel' || b.mat === 'lightWarm')
    && b.max[1] - b.min[1] < 0.12 && b.min[1] > h - 1.3
    && b.kind !== 'emitOnly' && !(typeof b.kind === 'string' && (b.kind === 'glowOnly' || b.kind.startsWith('glow:'))));
}

/** 壁面の室内側に薄く貼る決め位置（デカールは normal 方向へ 4 mm 伸びるので、面の 2 mm 手前に出す） */
function decalCoord(f: Face): number {
  return f.inward > 0 ? f.face + 0.002 : f.face - 0.006;
}

// ---------------------------------------------------------------- 1. 穴だらけの床


// ---------------------------------------------------------------- 2. 天井の欠落と露出

const CT = 0.6; // 天井板の格子（wear.ts と同じ）

/** 0.6 m 格子に揃えた天井板の位置を n 枚まで。器具・天井付近の内装・床穴ソケットを避ける */
function ceilingTiles(c: Ctx, n: number, strength: Strength): Rect[] {
  const out: Rect[] = [];
  const near = interior(c.L).filter((b) => b.max[1] > c.h - 1.0);
  for (let t = 0; t < n * 14 && out.length < n; t++) {
    const r = someRect(c);
    const kx0 = Math.ceil((r.x0 + 0.7) / CT);
    const kx1 = Math.floor((r.x1 - 0.7) / CT) - 1;
    const kz0 = Math.ceil((r.z0 + 0.7) / CT);
    const kz1 = Math.floor((r.z1 - 0.7) / CT) - 1;
    if (kx1 < kx0 || kz1 < kz0) continue;
    const x0 = c.rng.int(kx0, kx1) * CT;
    const z0 = c.rng.int(kz0, kz1) * CT;
    const rect: Rect = { x0, z0, x1: x0 + CT, z1: z0 + CT };
    if (out.some((q) => rectsOverlap(rect, q, 0.05))) continue;
    if (strength === 'strong' && t < n * 7 && !inFocus(c, probeOf(rect))) continue;
    if (near.some((b) => b.min[0] < rect.x1 + 0.12 && b.max[0] > rect.x0 - 0.12 && b.min[2] < rect.z1 + 0.12 && b.max[2] > rect.z0 - 0.12)) continue;
    if (c.sockets.some((s) => s.type === 'hole' && Math.hypot(s.pos[0] - (x0 + CT / 2), s.pos[2] - (z0 + CT / 2)) < 1.6)) continue;
    out.push(rect);
  }
  return out;
}

/** 蛍光灯 1 本が吊り下がった状態（既存の器具箔を lightOff にして、その 0.5 m 下に傾いた発光箔 + 鎖 2 本） */
function hangingLamp(c: Ctx): boolean {
  const foils = fixtureFoils(c);
  if (!foils.length) return false;
  const b = pick(c.rng, foils);
  const i = c.L.boxes.indexOf(b);
  if (i < 0) return false;
  const sy = b.max[1] - b.min[1];
  const drop = b.min[1] - 0.5;
  if (drop < 1.9) return false; // 頭にぶつかる高さには吊らない
  c.L.boxes[i] = { ...b, mat: 'lightOff', kind: ODD_KIND }; // 暗い器具跡
  const [x0, , z0] = b.min;
  const [x1, , z1] = b.max;
  const alongX = x1 - x0 >= z1 - z0;
  // 2 分割の箔（片側を 0.15 低く）= 片吊りで傾いた蛍光灯。glowOnly は付けない = 光源になる
  const lo = drop - 0.15;
  const hi = drop;
  if (alongX) {
    const mx = (x0 + x1) / 2;
    c.L.boxes.push(oddBox([x0, lo, z0], [mx, lo + sy, z1], 'lightPanel', false));
    c.L.boxes.push(oddBox([mx, hi, z0], [x1, hi + sy, z1], 'lightPanel', false));
  } else {
    const mz = (z0 + z1) / 2;
    c.L.boxes.push(oddBox([x0, lo, z0], [x1, lo + sy, mz], 'lightPanel', false));
    c.L.boxes.push(oddBox([x0, hi, mz], [x1, hi + sy, z1], 'lightPanel', false));
  }
  // 天井と結ぶ鎖 2 本
  const pts: [number, number][] = alongX
    ? [[x0 + 0.06, (z0 + z1) / 2], [x1 - 0.06, (z0 + z1) / 2]]
    : [[(x0 + x1) / 2, z0 + 0.06], [(x0 + x1) / 2, z1 - 0.06]];
  for (const [cx, cz] of pts) c.L.boxes.push(oddBox([cx - 0.01, lo, cz - 0.01], [cx + 0.01, c.h, cz + 0.01], 'metalDark', false));
  return true;
}

const ceilingGaps: Oddity = {
  id: 'surface.ceilingGaps', category: 'surface', weight: 3, theme: true,
  applicable(c) { return c.h >= 2.2 && hasCeiling(c); },
  apply(c, strength) {
    const n = strength === 'strong' ? c.rng.int(4, 6) : c.rng.int(1, 2);
    const cand = ceilingTiles(c, n, strength);
    const h = c.h;
    let cut = 0;
    for (const r of cand) {
      if (!budgetOk(c, 8)) break;
      if (!cutShell(c.L, r, 'ceiling')) continue;
      cut++;
      // 暗い空隙: 0.35 m 上の黒い板（各辺 0.1 m 大きい）と、天井スラブ上端から板までを塞ぐ黒い裾
      const x0 = r.x0 - 0.1, x1 = r.x1 + 0.1, z0 = r.z0 - 0.1, z1 = r.z1 + 0.1;
      c.L.boxes.push(oddBox([x0, h + 0.35, z0], [x1, h + 0.37, z1], 'void', false));
      c.L.boxes.push(oddBox([x0, h + 0.18, z0], [x1, h + 0.36, z0 + 0.02], 'void', false));
      c.L.boxes.push(oddBox([x0, h + 0.18, z1 - 0.02], [x1, h + 0.36, z1], 'void', false));
      c.L.boxes.push(oddBox([x0, h + 0.18, z0], [x0 + 0.02, h + 0.36, z1], 'void', false));
      c.L.boxes.push(oddBox([x1 - 0.02, h + 0.18, z0], [x1, h + 0.36, z1], 'void', false));
      // 2 枚に 1 枚は空隙をダクトが横切る（0.25 m 角）
      if (cut % 2 === 1) {
        const y = h + 0.06;
        if (c.rng.chance(0.5)) {
          const cz = (r.z0 + r.z1) / 2;
          c.L.boxes.push(oddBox([r.x0 - 0.3, y, cz - 0.125], [r.x1 + 0.3, y + 0.25, cz + 0.125], 'metalDark', false));
        } else {
          const cx = (r.x0 + r.x1) / 2;
          c.L.boxes.push(oddBox([cx - 0.125, y, r.z0 - 0.3], [cx + 0.125, y + 0.25, r.z1 + 0.3], 'metalDark', false));
        }
      }
    }
    if (!cut) return false;
    const hung = strength === 'strong' && budgetOk(c, 6) ? hangingLamp(c) : false;
    c.note(`ceilingGaps: tiles=${cut}${hung ? ' +hangingLamp' : ''}`);
    return true;
  },
};

// ---------------------------------------------------------------- 3. 壁の穴と壁の中

const wallHoles: Oddity = {
  id: 'surface.wallHoles', category: 'surface', weight: 2, theme: false,
  applicable(c) { return c.h >= 2.0 && innerFaces(c.rects).length > 0; },
  apply(c, strength) {
    const faces = innerFaces(c.rects);
    if (!faces.length) return false;
    const n = strength === 'strong' ? c.rng.int(2, 3) : c.rng.int(1, 2);
    const used: { f: Face; at: number; y: number }[] = [];
    let made = 0;
    for (let t = 0; t < n * 10 && made < n; t++) {
      if (!budgetOk(c, 2)) break;
      const f = pick(c.rng, faces);
      const runs = freeRuns(f, c.sockets, 1.0).filter(([a, b]) => b - a > 0.9);
      if (!runs.length) continue;
      const [a0, a1] = pick(c.rng, runs);
      const w = c.rng.float(0.3, 0.5);
      const hh = c.rng.float(0.3, 0.5);
      const at = c.rng.float(a0 + 0.35, a1 - 0.35);
      const y = c.rng.float(0.45, Math.min(1.6, c.h - 0.5));
      if (used.some((u) => u.f === f && Math.abs(u.at - at) < 0.8 && Math.abs(u.y - y) < 0.8)) continue;
      // 一回り小さい壁材の板（壁面から 0.01 手前）= 穴の奥に同じ壁紙の壁
      const iw = Math.max(0.12, w - 0.08);
      const ih = Math.max(0.12, hh - 0.08);
      const inner = { ...alongFace(f, at - iw / 2, iw, 0.01, 0.022, y - ih / 2, y + ih / 2, wallMat(c), false), kind: ODD_KIND };
      if (!canPlace(c, inner, { margin: 0.005, gap: 0.02, lanes: false })) continue;
      const coord = decalCoord(f);
      const pos: Vec3 = f.horizontal ? [at, y, coord] : [coord, y, at];
      (c.L.decals ??= []).push({ mat: 'void', pos, size: [w, hh], normal: f.horizontal ? 'z' : 'x' });
      c.L.boxes.push(inner);
      used.push({ f, at, y });
      made++;
    }
    if (!made) return false;
    c.note(`wallHoles: ${made}`);
    return true;
  },
};

// ---------------------------------------------------------------- 4. 水

/** 水たまり 1 つ（2〜3 枚の重なった矩形 + water ゾーン） */
function puddle(c: Ctx, strength: Strength, done: Rect[]): Rect | null {
  for (let t = 0; t < 22; t++) {
    const r = someRect(c);
    const w = c.rng.float(1.1, 2.4);
    const d = c.rng.float(0.9, 2.0);
    if (r.x1 - r.x0 < w + 1.1 || r.z1 - r.z0 < d + 1.1) continue;
    const x0 = c.rng.float(r.x0 + 0.5, r.x1 - 0.5 - w);
    const z0 = c.rng.float(r.z0 + 0.5, r.z1 - 0.5 - d);
    const base: Rect = { x0, z0, x1: x0 + w, z1: z0 + d };
    if (done.some((q) => rectsOverlap(base, q, 0.35))) continue;
    if (strength === 'strong' && t < 14 && !inFocus(c, probeOf(base, 0.05))) continue;
    // 水たまりは動線上でよい（歩ける）
    if (!canPlace(c, probeOf(base, 0.05), { lanes: false })) continue;
    // 1 枚の箱 = 1 つの水たまり。RoomBuilder が 'puddle' を箱の足跡に収まる不定形の面（28 頂点の輪郭）として描くので、
    // 箱を重ねて形を作らない（重ねると角のあるボクセル状に見える）
    c.L.boxes.push(oddBox([base.x0, 0.001, base.z0], [base.x1, 0.015, base.z1], 'puddle', false));
    (c.L.zones ??= []).push({
      kind: 'water',
      aabb: { min: [base.x0, -0.1, base.z0], max: [base.x1, 0.3, base.z1] },
      params: { slow: 0.88, depth: 0.015 },
    });
    return base;
  }
  return null;
}

/** 壁の下端だけ濡れている帯 */
function wetBase(c: Ctx): boolean {
  const faces = innerFaces(c.rects);
  for (let t = 0; t < 14; t++) {
    if (!faces.length) return false;
    const f = pick(c.rng, faces);
    const runs = freeRuns(f, c.sockets, 0.6).filter(([a, b]) => b - a >= 2.0);
    if (!runs.length) continue;
    const [a0, a1] = pick(c.rng, runs);
    const len = Math.min(c.rng.float(2, 4), a1 - a0 - 0.1);
    if (len < 1.8) continue;
    const at = c.rng.float(a0 + 0.05, a1 - len - 0.05);
    const band = { ...alongFace(f, at, len, 0.004, 0.009, 0.0, 0.25, 'wallDark', false), kind: ODD_KIND };
    c.L.boxes.push(band);
    return true;
  }
  return false;
}

const water: Oddity = {
  id: 'surface.water', category: 'surface', weight: 3, theme: false,
  applicable(c) {
    const r = mainRect(c);
    return Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 2.2;
  },
  apply(c, strength) {
    // theme: false なので実際は weak しか来ない（1〜2 つ）
    const n = strength === 'strong' ? c.rng.int(2, 3) : c.rng.int(1, 2);
    const done: Rect[] = [];
    for (let k = 0; k < n; k++) {
      if (!budgetOk(c, 6)) break;
      const p = puddle(c, strength, done);
      if (!p) break;
      done.push(p);
      // 5 割で真上の天井に黄ばみ板
      if (hasCeiling(c) && c.rng.chance(0.5)) {
        const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
        c.L.boxes.push(oddBox([cx - 0.25, c.h - 0.006, cz - 0.25], [cx + 0.25, c.h - 0.002, cz + 0.25], 'wainscotCream', false));
      }
    }
    if (!done.length) return false;
    const wet = c.rng.chance(0.3) ? wetBase(c) : false;
    c.note(`water: puddles=${done.length}${wet ? ' +wetBase' : ''}`);
    return true;
  },
};

// shallowPits（浅い穴）はユーザー指示で削除（2026-09-23）
export const SURFACE_ODDITIES: Oddity[] = [ceilingGaps, wallHoles, water];
