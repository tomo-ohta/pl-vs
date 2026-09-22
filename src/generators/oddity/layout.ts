/**
 * 奇妙さ生成: 間取りの不自然さ（担当 O1）。shared.ts のヘルパだけを使う。各 Oddity は applicable / apply（strong = 主題、weak = 添え物）を持つ。
 *
 * 約束（shared.ts と同じ）:
 *  - 乱数は c.rng だけ（Math.random は使わない）。ソケット（扉の位置・高さ）は絶対に変えない。
 *  - ここで出す「扉」はすべて飾り扉（開かない非ソリッドの箔）。本物の扉と紛らわしくならないよう freeRuns で開口から 1 m 離す。
 *  - プレイヤーは 0.35 m まで登れる・しゃがみ 0.85 m・立ち 1.7 m。通れる必要のある所はこれを守る。
 */
import {
  WALL_T, alongFace, budgetOk, canPlace, ceilingMat, facing, freeRuns,
  inner, innerFaces, isCorridor, mainRect, oddBox, ODD_KIND, onFace, pick, pushSign, shifted, wallMat,
  type Box, type Ctx, type Face, type MatId, type Oddity, type Rect, type Strength,
} from './shared';

// ================================================================ このファイル内の小物

/** 既成のヘルパ（alongFace など）が作った箱に odd 印を付ける（後段の Modifier の掃除に消されない） */
function mark(b: Box): Box {
  return { ...b, kind: ODD_KIND };
}

/** 壁面に沿った、開口を避けた区間 */
interface Run { f: Face; a0: number; a1: number }

/** ソケットから pad 以上離れた壁の区間（長さ minLen 以上） */
function wallRuns(c: Ctx, minLen: number, pad = 1.0): Run[] {
  const out: Run[] = [];
  for (const f of innerFaces(c.rects)) {
    for (const [a0, a1] of freeRuns(f, c.sockets, pad)) if (a1 - a0 >= minLen) out.push({ f, a0, a1 });
  }
  return out;
}

/** 区間 r の中で幅 need の物を置く位置（面に沿った中心） */
function atIn(c: Ctx, r: Run, need: number): number {
  const lo = r.a0 + need / 2 + 0.08;
  const hi = r.a1 - need / 2 - 0.08;
  return hi <= lo ? (r.a0 + r.a1) / 2 : c.rng.float(lo, hi);
}

/** 面 f の位置 at が入口から見た正面（focus）か */
function runInFocus(c: Ctx, f: Face, at: number): boolean {
  const p = onFace(f, at, 0.5, 1.2);
  return p[0] >= c.focus.x0 - 0.3 && p[0] <= c.focus.x1 + 0.3 && p[2] >= c.focus.z0 - 0.3 && p[2] <= c.focus.z1 + 0.3;
}

/** strong は正面の壁を優先し、同じなら長い区間から。並べ替えは安定（決定論） */
function orderRuns(c: Ctx, runs: Run[], strength: Strength): Run[] {
  const scored = runs.map((r) => ({ r, focus: runInFocus(c, r.f, (r.a0 + r.a1) / 2) ? 1 : 0, len: r.a1 - r.a0 }));
  scored.sort((p, q) => (strength === 'strong' ? q.focus - p.focus : 0) || q.len - p.len);
  return scored.map((s) => s.r);
}

/** 内部の線を Face として扱う（furniture.lineFace と同じ。部屋の中の部屋の外面に飾り扉を貼るため） */
function faceAt(horizontal: boolean, face: number, inward: 1 | -1, a0: number, a1: number): Face {
  return {
    dir: horizontal ? (inward > 0 ? 2 : 0) : (inward > 0 ? 3 : 1),
    horizontal, face, inward, a0, a1, coord: face - inward * WALL_T,
  };
}

/**
 * 飾り扉（開かない）。枡 trim + 扉板 palette.door + 取っ手。すべて非ソリッドで壁面から 5〜8 cm 出す。
 * at は面に沿った中心、y0 は扉板の下端。
 */
function decorDoor(f: Face, at: number, y0: number, mat: MatId, dw = 0.9, dh = 2.05): Box[] {
  const hy = y0 + Math.min(0.99, dh / 2);
  return [
    mark(alongFace(f, at - dw / 2 - 0.065, dw + 0.13, 0, 0.05, Math.max(0, y0 - 0.065), y0 + dh + 0.065, 'trim', false)),
    mark(alongFace(f, at - dw / 2, dw, 0.05, 0.08, y0, y0 + dh, mat, false)),
    mark(alongFace(f, at + dw / 2 - 0.16, 0.11, 0.08, 0.13, hy - 0.015, hy + 0.015, 'metal', false)),
  ];
}


/** 主矩形の長辺が X か */
function longIsX(r: Rect): boolean {
  return r.x1 - r.x0 >= r.z1 - r.z0;
}



// ================================================================ 1. 開口の位置の狂い

/** (a) 浮いた扉: 下端 0.4 m の飾り扉 */
function floatingDoor(c: Ctx, runs: Run[]): boolean {
  const dw = 0.9, dh = 2.05, y0 = 0.4;
  if (c.h < y0 + dh + 0.12) return false;
  for (const r of runs) {
    if (r.a1 - r.a0 < dw + 0.4) continue;
    const at = atIn(c, r, dw + 0.3);
    c.L.boxes.push(...decorDoor(r.f, at, y0, c.L.palette.door, dw, dh));
    c.note('openingOffset: floating door');
    return true;
  }
  return false;
}

/** (b) 天井近くの小さな出口（0.6 角の暗い開口 + 枡 + EXIT サイン） */
function highExit(c: Ctx, runs: Run[]): boolean {
  const w = 0.6;
  const top = c.h - 0.3, bot = top - w;
  if (bot < 1.8) return false;
  for (const r of runs) {
    if (r.a1 - r.a0 < w + 0.5) continue;
    const at = atIn(c, r, w + 0.4);
    const f = r.f;
    // 枡（開口の周り 4 本。真ん中は空けて暗い開口を見せる）
    c.L.boxes.push(mark(alongFace(f, at - w / 2 - 0.07, w + 0.14, 0, 0.05, top, top + 0.07, 'trim', false)));
    c.L.boxes.push(mark(alongFace(f, at - w / 2 - 0.07, w + 0.14, 0, 0.05, bot - 0.07, bot, 'trim', false)));
    c.L.boxes.push(mark(alongFace(f, at - w / 2 - 0.07, 0.07, 0, 0.05, bot, top, 'trim', false)));
    c.L.boxes.push(mark(alongFace(f, at + w / 2, 0.07, 0, 0.05, bot, top, 'trim', false)));
    c.L.boxes.push(mark(alongFace(f, at - w / 2, w, 0, 0.01, bot, top, 'void', false)));
    pushSign(c, {
      text: 'EXIT', pos: onFace(f, at, 0.055, Math.min(c.h - 0.08, top + 0.12)), dir: facing(f),
      width: 0.4, kind: 'emissive', color: 0x40ff80, background: 0x0a2a14,
    });
    c.note('openingOffset: high exit');
    return true;
  }
  return false;
}

/** (c) 突き当たりの横向き扉（廊下の短い端の壁に 90° 倒した扉） */
function sidewaysDoor(c: Ctx): boolean {
  if (!isCorridor(c)) return false;
  const r = mainRect(c);
  const alongX = longIsX(r);
  const dw = 2.05, dh = 0.9, y0 = 0.6;
  // 端の壁 = 長辺に垂直な面（alongX なら horizontal=false）
  for (const f of innerFaces(c.rects)) {
    if (f.horizontal === alongX) continue;
    const runs = freeRuns(f, c.sockets, 1.0).filter(([a0, a1]) => a1 - a0 >= dw + 0.3);
    if (!runs.length) continue;
    const [a0, a1] = runs[0];
    const at = (a0 + a1) / 2;
    c.L.boxes.push(...decorDoor(f, at, y0, c.L.palette.door, dw, dh));
    c.note('openingOffset: sideways door at dead end');
    return true;
  }
  return false;
}

const openingOffset: Oddity = {
  id: 'layout.openingOffset', category: 'layout', weight: 3, theme: true,
  applicable(c) {
    return c.h >= 2.4 && wallRuns(c, 1.1).length > 0;
  },
  apply(c, strength) {
    const runs = orderRuns(c, wallRuns(c, 1.1), strength);
    if (!runs.length) return false;
    if (strength === 'strong') {
      // 正面に (a) か (c) を 1 つ + 別の壁に (b) を 1 つ
      let main = false;
      if (c.rng.chance(0.45)) main = sidewaysDoor(c);
      if (!main) main = floatingDoor(c, runs);
      if (!main) main = sidewaysDoor(c);
      const usedFace = main ? runs[0].f : null;
      const others = runs.filter((r) => r.f !== usedFace);
      const sub = budgetOk(c, 6) ? highExit(c, others.length ? others : runs) : false;
      return main || sub;
    }
    const roll = c.rng.float(0, 1);
    if (roll < 0.34 && sidewaysDoor(c)) return true;
    if (roll < 0.67 && highExit(c, runs)) return true;
    return floatingDoor(c, runs) || highExit(c, runs) || sidewaysDoor(c);
  },
};

// ================================================================ 2. 部屋の中の部屋

const roomInRoom: Oddity = {
  id: 'layout.roomInRoom', category: 'layout', weight: 2, theme: true,
  applicable(c) {
    const r = mainRect(c);
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    return w * d >= 60 && Math.min(w, d) >= 7 && c.h >= 2.3;
  },
  apply(c, strength) {
    if (!budgetOk(c, 10)) return false;
    const outer = inner(mainRect(c), WALL_T);           // 外壁の内面
    const place = inner(mainRect(c), WALL_T + 0.05);    // 置ける範囲
    const s = c.rng.float(2.5, 4.0);
    const top = c.rng.chance(0.5) ? c.h : c.h - 0.4;
    const gapMode = c.rng.chance(0.5);                  // 5 割で外壁との隙間を 0.7 m に
    const wallM = wallMat(c);

    for (let k = 0; k < 20; k++) {
      if (place.x1 - place.x0 < s + 0.2 || place.z1 - place.z0 < s + 0.2) return false;
      let x0: number, z0: number;
      if (gapMode && k < 14) {
        // どれか 1 辺を外壁から 0.7 m に置く（壁厚だけの隙間の通路。0.7 m は通れる）
        const side = c.rng.int(0, 3);
        if (side === 0) { x0 = outer.x0 + 0.7; z0 = c.rng.float(place.z0, place.z1 - s); }
        else if (side === 1) { x0 = outer.x1 - 0.7 - s; z0 = c.rng.float(place.z0, place.z1 - s); }
        else if (side === 2) { z0 = outer.z0 + 0.7; x0 = c.rng.float(place.x0, place.x1 - s); }
        else { z0 = outer.z1 - 0.7 - s; x0 = c.rng.float(place.x0, place.x1 - s); }
      } else {
        x0 = c.rng.float(place.x0, place.x1 - s);
        z0 = c.rng.float(place.z0, place.z1 - s);
      }
      const x1 = x0 + s, z1 = z0 + s;
      if (strength === 'strong') {
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const ok = cx >= c.focus.x0 - 1 && cx <= c.focus.x1 + 1 && cz >= c.focus.z0 - 1 && cz <= c.focus.z1 + 1;
        if (!ok && k < 16) continue;
      }
      const walls: Box[] = [
        oddBox([x0, 0, z0], [x0 + WALL_T, top, z1], wallM, true),
        oddBox([x1 - WALL_T, 0, z0], [x1, top, z1], wallM, true),
        oddBox([x0 + WALL_T, 0, z0], [x1 - WALL_T, top, z0 + WALL_T], wallM, true),
        oddBox([x0 + WALL_T, 0, z1 - WALL_T], [x1 - WALL_T, top, z1], wallM, true),
      ];
      if (!walls.every((b) => canPlace(c, b, { gap: 0.1 }))) continue;
      c.L.boxes.push(...walls);
      if (top < c.h - 0.01) c.L.boxes.push(oddBox([x0, top, z0], [x1, top + 0.12, z1], ceilingMat(c), false));
      // 入口側の面に飾り扉 1 つ
      const e = c.entry ? c.entry.pos : ([(place.x0 + place.x1) / 2, 0, place.z0] as [number, number, number]);
      const dx = e[0] - (x0 + x1) / 2, dz = e[2] - (z0 + z1) / 2;
      const f = Math.abs(dx) >= Math.abs(dz)
        ? faceAt(false, dx > 0 ? x1 : x0, dx > 0 ? 1 : -1, z0, z1)
        : faceAt(true, dz > 0 ? z1 : z0, dz > 0 ? 1 : -1, x0, x1);
      const dh = Math.min(2.05, top - 0.12);
      if (dh > 1.6) c.L.boxes.push(...decorDoor(f, (f.a0 + f.a1) / 2, 0, c.L.palette.door, 0.9, dh));
      c.note(`roomInRoom: ${s.toFixed(1)} m${gapMode ? ' (0.7 m gap)' : ''}${top < c.h ? ' open top' : ''}`);
      return true;
    }
    c.note('roomInRoom: no space');
    return false;
  },
};
interface WindowRef { i: number; b: Box; f: Face; a0: number; a1: number; dNear: number; dFar: number }

function findWindows(c: Ctx): WindowRef[] {
  const faces = innerFaces(c.rects);
  const out: WindowRef[] = [];
  for (let i = c.start; i < c.L.boxes.length; i++) {
    const b = c.L.boxes[i];
    if (b.mat !== 'windowNight') continue;
    const horizontal = b.max[0] - b.min[0] >= b.max[2] - b.min[2];
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    let best: Face | null = null, bestD = 0.6;
    for (const f of faces) {
      if (f.horizontal !== horizontal) continue;
      const d = Math.abs(f.face - (f.horizontal ? cz : cx));
      const along = f.horizontal ? cx : cz;
      if (along < f.a0 - 0.2 || along > f.a1 + 0.2) continue;
      if (d < bestD) { bestD = d; best = f; }
    }
    if (!best) continue;
    const ax = best.horizontal ? 2 : 0;
    const d0 = (b.min[ax] - best.face) * best.inward;
    const d1 = (b.max[ax] - best.face) * best.inward;
    out.push({
      i, b, f: best,
      a0: best.horizontal ? b.min[0] : b.min[2],
      a1: best.horizontal ? b.max[0] : b.max[2],
      dNear: Math.max(d0, d1), dFar: Math.min(d0, d1),
    });
  }
  return out;
}

const windowInward: Oddity = {
  id: 'layout.windowInward', category: 'layout', weight: 2, theme: false,
  applicable(c) {
    for (let i = c.start; i < c.L.boxes.length; i++) if (c.L.boxes[i].mat === 'windowNight') return true;
    return false;
  },
  apply(c) {
    const wins = findWindows(c).filter((w) => w.a1 - w.a0 >= 1.2 && w.b.max[1] - w.b.min[1] >= 0.6);
    if (!wins.length) { c.note('windowInward: no usable window'); return false; }
    const w = pick(c.rng, wins);
    const y0 = w.b.min[1], y1 = w.b.max[1];
    const len = w.a1 - w.a0;
    if (c.rng.chance(0.3)) {
      // (1) 夜景が途中で途切れる: 窓を短くして残りを壁材で塞ぐ
      const keep = len * c.rng.float(0.4, 0.7);
      const fromStart = c.rng.chance(0.5);
      const kA = fromStart ? w.a0 : w.a1 - keep;
      c.L.boxes[w.i] = mark(alongFace(w.f, kA, keep, w.dFar, w.dNear, y0, y1, 'windowNight', false));
      const fA = fromStart ? w.a0 + keep : w.a0;
      const front = Math.min(w.dNear + 0.24, 0.08);
      c.L.boxes.push(mark(alongFace(w.f, fA, len - keep, w.dFar, front, y0, y1, wallMat(c), false)));
      c.note(`windowInward: night view stops after ${keep.toFixed(1)} m`);
      return true;
    }
    // (2) 別の廊下が見える窓: 夜景 → 黒 + ガラス + 向こうの明かり
    c.L.boxes[w.i] = { ...w.b, mat: 'void', solid: false, kind: ODD_KIND };
    c.L.boxes.push(mark(alongFace(w.f, w.a0, len, w.dNear + 0.02, w.dNear + 0.032, y0, y1, 'glass', false)));
    const ym = y0 + (y1 - y0) * 0.45;
    c.L.boxes.push(mark(alongFace(w.f, w.a0 + len * 0.2, len * 0.6, w.dNear + 0.006, w.dNear + 0.016, ym - 0.03, ym + 0.03, 'lightWarm', false)));
    c.note('windowInward: window looks into another corridor');
    return true;
  },
};

// ================================================================ 5. 廊下の幅が途中で変わる

const corridorTaper: Oddity = {
  id: 'layout.corridorTaper', category: 'layout', weight: 2, theme: true,
  applicable(c) {
    if (!isCorridor(c)) return false;
    const r = mainRect(c);
    return Math.min(r.x1 - r.x0, r.z1 - r.z0) - 2 * WALL_T >= 2.2;
  },
  apply(c, strength) {
    const r = mainRect(c);
    const alongX = longIsX(r);
    const width = Math.min(r.x1 - r.x0, r.z1 - r.z0) - 2 * WALL_T;
    const maxD = Math.min(0.9, (width - 1.3) / 2);
    if (maxD < 0.12) return false;
    const lo = alongX ? r.x0 : r.z0, hi = alongX ? r.x1 : r.z1;
    // 入口側の端（無ければ手前）
    const eu = c.entry ? (alongX ? c.entry.pos[0] : c.entry.pos[2]) : lo;
    const near = Math.abs(eu - lo) <= Math.abs(eu - hi) ? lo : hi;
    const far = near === lo ? hi : lo;
    const mid = (lo + hi) / 2;
    const profile = (u: number): number => {
      if (strength === 'strong') {
        const t = (u - near) / (far - near);
        return maxD * Math.max(0, Math.min(1, t));
      }
      return Math.abs(u - mid) <= 2 ? maxD : 0;
    };
    const wallM = wallMat(c);
    const mine = new Set<Box>();   // 隣り合う 1 m の箱どうしが gap 判定で弾き合わないように
    let n = 0;
    for (const f of innerFaces(c.rects)) {
      if (f.horizontal !== alongX) continue;      // 長辺に沿う面だけ
      if (f.a1 - f.a0 < 6) continue;
      for (const [a0, a1] of freeRuns(f, c.sockets, 0.8)) {
        for (let a = a0; a < a1 - 0.2; a += 1.0) {
          if (!budgetOk(c, 2)) break;
          const len = Math.min(1.0, a1 - a);
          const d = profile(a + len / 2);
          if (d < 0.1) continue;
          const b = mark(alongFace(f, a, len, 0, d, 0, c.h, wallM, true));
          // 通路幅は最も狭い所でも 1.3 m 残る。壁に密着するので margin は WALL_T。家具との重なりだけ避ける
          if (!canPlace(c, b, { lanes: false, gap: 0.02, margin: WALL_T - 0.001, ignore: (q) => mine.has(q) })) continue;
          c.L.boxes.push(b);
          mine.add(b);
          n++;
        }
      }
    }
    if (!n) { c.note('corridorTaper: nothing fit'); return false; }
    c.note(`corridorTaper: ${strength === 'strong' ? 'narrows toward the far end' : '4 m pinch'} to ${(width - 2 * maxD).toFixed(1)} m (${n} boxes)`);
    return true;
  },
};

// ================================================================ 6. 柱の異常

/** 天井まで届くコンクリ柱（内装） */
function gridColumns(c: Ctx): { i: number; b: Box }[] {
  const out: { i: number; b: Box }[] = [];
  for (let i = c.start; i < c.L.boxes.length; i++) {
    const b = c.L.boxes[i];
    if (!b.solid || b.mat !== 'columnConcrete') continue;
    if (b.min[1] > 0.05 || b.max[1] < c.h - 0.3) continue;
    if (b.max[0] - b.min[0] > 1.4 || b.max[2] - b.min[2] > 1.4) continue;
    out.push({ i, b });
  }
  return out;
}

/** 0.4 m 角の柱を area 内に置く（まず中央、だめなら散らす） */
function tryPillar(c: Ctx, area: Rect, y0: number, y1: number): Box | null {
  const s = 0.4;
  const a = inner(area, WALL_T + 0.35);
  if (a.x1 - a.x0 < s || a.z1 - a.z0 < s) return null;
  for (let k = 0; k < 24; k++) {
    const cx = k === 0 ? (a.x0 + a.x1) / 2 : c.rng.float(a.x0 + s / 2, a.x1 - s / 2);
    const cz = k === 0 ? (a.z0 + a.z1) / 2 : c.rng.float(a.z0 + s / 2, a.z1 - s / 2);
    const b = oddBox([cx - s / 2, y0, cz - s / 2], [cx + s / 2, y1, cz + s / 2], 'columnConcrete', true);
    if (canPlace(c, b, { gap: 0.15 })) return b;
  }
  return null;
}

const pillars: Oddity = {
  id: 'layout.pillars', category: 'layout', weight: 2, theme: true,
  applicable(c) {
    const r = mainRect(c);
    return c.h >= 2.4 && Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 3.2;
  },
  apply(c, strength) {
    if (!budgetOk(c, 2)) return false;
    const area = strength === 'strong' && c.focus.x1 - c.focus.x0 > 2 && c.focus.z1 - c.focus.z0 > 2 ? c.focus : mainRect(c);
    if (strength === 'strong') {
      if (c.rng.chance(0.4)) {
        // (d) 天井から下がって 0.45 m で止まる柱（頭をぶつける）
        const b = tryPillar(c, area, 0.45, c.h);
        if (b) { c.L.boxes.push(b); c.note('pillars: column hangs from the ceiling, stops 0.45 m above the floor'); return true; }
      }
      // (a)+(c) 中央に 1 本だけ・天井に届かない
      const b = tryPillar(c, area, 0, c.h - 0.35);
      if (b) { c.L.boxes.push(b); c.note('pillars: lone column, 0.35 m short of the ceiling'); return true; }
      const full = tryPillar(c, area, 0, c.h);
      if (full) { c.L.boxes.push(full); c.note('pillars: lone column in the middle'); return true; }
      return false;
    }
    // weak: (b) 格子から 1 本だけずれた柱
    const cols = gridColumns(c);
    if (cols.length >= 4 && c.rng.chance(0.65)) {
      const g = cols[c.rng.int(0, cols.length - 1)];
      const dist = c.rng.float(0.6, 0.9);
      const dirs: [number, number][] = [[dist, 0], [-dist, 0], [0, dist], [0, -dist]];
      for (let k = 0; k < 4; k++) {
        const d = dirs[(c.rng.int(0, 3) + k) % 4];
        const moved = shifted(g.b, d[0], 0, d[1]);
        if (canPlace(c, moved, { gap: 0.1, ignore: (q) => q === g.b })) {
          c.L.boxes[g.i] = moved;
          c.note(`pillars: one column off the grid by ${dist.toFixed(2)} m`);
          return true;
        }
      }
    }
    // (c) 天井に届かない柱
    const b = tryPillar(c, mainRect(c), 0, c.h - 0.35);
    if (b) { c.L.boxes.push(b); c.note('pillars: column 0.35 m short of the ceiling'); return true; }
    return false;
  },
};

// steps（床の段差だけの異変）はユーザー指示で削除（2026-09-23）
export const LAYOUT_ODDITIES: Oddity[] = [openingOffset, roomInRoom, windowInward, corridorTaper, pillars];
