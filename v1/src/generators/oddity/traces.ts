/** 奇妙さ生成: 光・時間・痕跡（担当 O3）。shared.ts のヘルパだけを使う。各 Oddity は applicable / apply（strong = 主題、weak = 添え物）を持つ */
import {
  alongFace, budgetOk, canPlace, facing, freeRuns, inFocus, innerFaces, interior, isCorridor,
  mainRect, oddBox, ODD_KIND, onFace, pick, propGroups, pushSign, shifted,
  type Box, type Ctx, type Face, type Oddity, type Strength, type Vec3,
} from './shared';

// ---------------------------------------------------------------- ファイル内ヘルパ

function someRect(c: Ctx) {
  return c.rng.weighted(c.rects, (r) => (r.x1 - r.x0) * (r.z1 - r.z0));
}

function centerOf(b: Box): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

/** 内装の既存の器具箔（天井直下の薄い lightPanel / lightWarm。emitOnly / glowOnly は除く） */
function fixtureFoils(c: Ctx): Box[] {
  const h = c.h;
  return interior(c.L).filter((b) => !b.solid && (b.mat === 'lightPanel' || b.mat === 'lightWarm')
    && b.max[1] - b.min[1] < 0.12 && b.min[1] > h - 1.3
    && b.kind !== 'emitOnly' && !(typeof b.kind === 'string' && (b.kind === 'glowOnly' || b.kind.startsWith('glow:'))));
}

/** 机の天板らしいソリッド箱（上面 0.68〜0.80 m） */
function deskTops(c: Ctx, minW = 0.5, minD = 0.4): Box[] {
  return interior(c.L).filter((b) => b.solid && b.max[1] > 0.68 && b.max[1] < 0.80
    && b.max[0] - b.min[0] >= minW && b.max[2] - b.min[2] >= minD);
}

// ---------------------------------------------------------------- 5. 光の不整合

/** (a) 光源の無い明るい一角: 隅の天井直下に emitOnly の発光箔（描かれないが焼き込みの光源になる） */
function brightCorner(c: Ctx): boolean {
  const r = mainRect(c);
  if (r.x1 - r.x0 < 2.4 || r.z1 - r.z0 < 2.4 || c.h < 2.2) return false;
  const corners: [number, number][] = [
    [r.x0 + 0.95, r.z0 + 0.95], [r.x1 - 0.95, r.z0 + 0.95],
    [r.x0 + 0.95, r.z1 - 0.95], [r.x1 - 0.95, r.z1 - 0.95],
  ];
  const fx = (c.focus.x0 + c.focus.x1) / 2;
  const fz = (c.focus.z0 + c.focus.z1) / 2;
  corners.sort((a, b) => Math.hypot(a[0] - fx, a[1] - fz) - Math.hypot(b[0] - fx, b[1] - fz));
  const [x, z] = corners[0];
  const y = c.h - 0.12;
  c.L.boxes.push({ ...oddBox([x - 0.6, y, z - 0.6], [x + 0.6, y + 0.05, z + 0.6], 'lightWarm', false), kind: 'emitOnly' });
  c.note('light.mismatch: noSource corner');
  return true;
}

/** (b) 器具はあるのに暗い帯: 隣り合う器具 2 枚を glowOnly にして、付近の点光源を取り除く */
function darkBand(c: Ctx): boolean {
  const foils = fixtureFoils(c);
  if (foils.length < 2) return false;
  const a = pick(c.rng, foils);
  const ca = centerOf(a);
  let b: Box | null = null;
  let bd = Infinity;
  for (const q of foils) {
    if (q === a) continue;
    const cq = centerOf(q);
    const d = Math.hypot(cq[0] - ca[0], cq[2] - ca[2]);
    if (d > 0.01 && d < bd) { bd = d; b = q; }
  }
  if (!b || bd > 6) return false;
  const cb = centerOf(b);
  for (const q of [a, b]) {
    const i = c.L.boxes.indexOf(q);
    if (i >= 0) c.L.boxes[i] = { ...q, kind: 'glowOnly' };
  }
  const keep = c.L.lights.filter((l) => Math.hypot(l.pos[0] - ca[0], l.pos[2] - ca[2]) > 1.5
    && Math.hypot(l.pos[0] - cb[0], l.pos[2] - cb[2]) > 1.5);
  const removed = c.L.lights.length - keep.length;
  c.L.lights = keep;
  c.note(`light.mismatch: darkBand (lights -${removed})`);
  return true;
}

/** (c) 1 本だけ色温度が違う */
function oddTemperature(c: Ctx): boolean {
  const foils = fixtureFoils(c);
  if (!foils.length) return false;
  const b = pick(c.rng, foils);
  const i = c.L.boxes.indexOf(b);
  if (i < 0) return false;
  const to = b.mat === 'lightPanel' ? 'lightWarm' : 'lightPanel';
  c.L.boxes[i] = { ...b, mat: to, kind: ODD_KIND };
  // 真下の点光源があれば色も合わせる（床への落ち方まで 1 本だけ違う）
  const cb = centerOf(b);
  for (const l of c.L.lights) {
    if (Math.hypot(l.pos[0] - cb[0], l.pos[2] - cb[2]) < 0.7 && Math.abs(l.pos[1] - cb[1]) < 1.2) {
      l.color = to === 'lightWarm' ? 0xffc27a : 0xdfe9ff;
    }
  }
  c.note(`light.mismatch: oddTemperature → ${to}`);
  return true;
}

const mismatch: Oddity = {
  id: 'light.mismatch', category: 'light', weight: 3, theme: true,
  applicable(c) { return c.h >= 2.0 && c.rects.length > 0; },
  apply(c, strength) {
    const want = strength === 'strong' ? 2 : 1;
    const order = c.rng.shuffle<'corner' | 'band' | 'temp'>(['corner', 'band', 'temp']);
    let done = 0;
    for (const v of order) {
      if (done >= want) break;
      if (!budgetOk(c, 2)) break;
      const ok = v === 'corner' ? brightCorner(c) : v === 'band' ? darkBand(c) : oddTemperature(c);
      if (ok) done++;
    }
    return done > 0;
  },
};

// ---------------------------------------------------------------- 6. 時刻の混在

const TIMES = ['3:17', '10:42', '7:05', '12:00', '4:44'] as const;

/** 時計 3 個を 1 面に並べる（時刻は全部違う） */
function clocks(c: Ctx): boolean {
  const faces = innerFaces(c.rects);
  const cands: { f: Face; a0: number; a1: number }[] = [];
  for (const f of faces) {
    for (const [a0, a1] of freeRuns(f, c.sockets, 0.8)) if (a1 - a0 >= 2.4) cands.push({ f, a0, a1 });
  }
  if (!cands.length) return false;
  const pickd = c.rng.weighted(cands, (q) => q.a1 - q.a0);
  const y = Math.min(c.h - 0.45, 2.05);
  if (y < 1.4) return false;
  const times = c.rng.shuffle([...TIMES]).slice(0, 3);
  let n = 0;
  for (let k = 0; k < 3; k++) {
    const at = pickd.a0 + ((pickd.a1 - pickd.a0) * (k + 1)) / 4;
    if (pushSign(c, { text: times[k], kind: 'clock', pos: onFace(pickd.f, at, 0.04, y), dir: facing(pickd.f), width: 0.45 })) n++;
  }
  if (!n) return false;
  c.note(`timeMix: clocks ${times.slice(0, n).join(' / ')}`);
  return true;
}

const timeMix: Oddity = {
  id: 'light.timeMix', category: 'light', weight: 2, theme: false,
  applicable(c) {
    return interior(c.L).filter((b) => b.mat === 'windowNight').length >= 2 || innerFaces(c.rects).length > 0;
  },
  apply(c) {
    // 夜の窓が 2 枚以上あれば 1 枚だけ昼にする
    const wins = interior(c.L).filter((b) => b.mat === 'windowNight');
    if (wins.length >= 2) {
      const b = pick(c.rng, wins);
      const i = c.L.boxes.indexOf(b);
      if (i >= 0) {
        c.L.boxes[i] = { ...b, mat: 'skyDay', kind: ODD_KIND };
        c.note('timeMix: windowNight → skyDay');
        return true;
      }
    }
    return clocks(c);
  },
};

// ---------------------------------------------------------------- 7. 痕跡

/** (a) 引きずり跡だけ（物は置かない）: 軸に沿った細い帯 2 本 */
function dragMarks(c: Ctx, strength: Strength): boolean {
  for (let t = 0; t < 22; t++) {
    const r = someRect(c);
    const alongX = c.rng.chance(0.5);
    const len = c.rng.float(2, 4);
    const spanA = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    const spanB = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
    if (spanA < len + 1.2 || spanB < 1.6) continue;
    const a0 = c.rng.float((alongX ? r.x0 : r.z0) + 0.55, (alongX ? r.x1 : r.z1) - 0.55 - len);
    const b = c.rng.float((alongX ? r.z0 : r.x0) + 0.65, (alongX ? r.z1 : r.x1) - 0.65);
    const probe = alongX
      ? oddBox([a0, 0, b - 0.3], [a0 + len, 0.04, b + 0.3], 'metalDark', true)
      : oddBox([b - 0.3, 0, a0], [b + 0.3, 0.04, a0 + len], 'metalDark', true);
    if (strength === 'strong' && t < 14 && !inFocus(c, probe)) continue;
    if (!canPlace(c, probe, { lanes: false })) continue;
    for (const s of [-1, 1]) {
      const off = s * 0.225; // 間隔 0.45
      const pos: Vec3 = alongX ? [a0 + len / 2, 0, b + off] : [b + off, 0, a0 + len / 2];
      (c.L.decals ??= []).push({ mat: 'metalDark', pos, size: alongX ? [len, 0.06] : [0.06, len], normal: 'y' });
    }
    c.note(`trace.marks: drag ${len.toFixed(1)} m`);
    return true;
  }
  return false;
}

/** (b) 人数分の椅子が引かれた状態: chair グループを近くの机から 0.35 m 離す */
function pulledChairs(c: Ctx): boolean {
  const groups = [...propGroups(c.L).values()].filter((g) => g.kind === 'chair');
  if (!groups.length) return false;
  const desks = deskTops(c, 0.5, 0.4);
  if (!desks.length) return false;
  let moved = 0;
  for (const g of groups) {
    if (moved >= 5) break;
    const cx = (g.min[0] + g.max[0]) / 2;
    const cz = (g.min[2] + g.max[2]) / 2;
    let best: Box | null = null;
    let bd = 2.2;
    for (const d of desks) {
      const gx = Math.max(d.min[0] - cx, cx - d.max[0], 0);
      const gz = Math.max(d.min[2] - cz, cz - d.max[2], 0);
      const dist = Math.hypot(gx, gz);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (!best) continue;
    const ax = cx - (best.min[0] + best.max[0]) / 2;
    const az = cz - (best.min[2] + best.max[2]) / 2;
    const mx = Math.abs(ax) >= Math.abs(az) ? Math.sign(ax) * 0.35 : 0;
    const mz = mx === 0 ? Math.sign(az) * 0.35 : 0;
    if (mx === 0 && mz === 0) continue;
    const probe = oddBox([g.min[0] + mx, g.min[1], g.min[2] + mz], [g.max[0] + mx, g.max[1], g.max[2] + mz], 'furnitureDark', true);
    const own = new Set(g.boxes);
    if (!canPlace(c, probe, { lanes: false, margin: 0.05, gap: 0.02, ignore: (q) => own.has(q) })) continue;
    for (const b of g.boxes) {
      const i = c.L.boxes.indexOf(b);
      if (i >= 0) c.L.boxes[i] = shifted(b, mx, 0, mz);
    }
    moved++;
  }
  if (!moved) return false;
  c.note(`trace.marks: pulled chairs ${moved}`);
  return true;
}

/** (c) 食べた直後の机: 白い皿とコップ */
function afterMeal(c: Ctx): boolean {
  const tops = deskTops(c, 0.75, 0.6);
  if (!tops.length) return false;
  const t = pick(c.rng, tops);
  const y = t.max[1];
  const nP = c.rng.int(2, 4);
  const nC = c.rng.int(2, 3);
  for (let i = 0; i < nP; i++) {
    const x = c.rng.float(t.min[0] + 0.14, t.max[0] - 0.14);
    const z = c.rng.float(t.min[2] + 0.14, t.max[2] - 0.14);
    c.L.boxes.push(oddBox([x - 0.11, y, z - 0.11], [x + 0.11, y + 0.015, z + 0.11], 'signPlate', false));
  }
  for (let i = 0; i < nC; i++) {
    const x = c.rng.float(t.min[0] + 0.06, t.max[0] - 0.06);
    const z = c.rng.float(t.min[2] + 0.06, t.max[2] - 0.06);
    c.L.boxes.push(oddBox([x - 0.035, y, z - 0.035], [x + 0.035, y + 0.09, z + 0.035], 'signPlate', false));
  }
  c.note(`trace.marks: afterMeal plates=${nP} cups=${nC}`);
  return true;
}

/** (d) 置きっぱなしのカート: 廊下の壁際に枠だけのカート */
function leftCart(c: Ctx): boolean {
  if (!isCorridor(c)) return false;
  const faces = innerFaces(c.rects);
  if (!faces.length) return false;
  for (let t = 0; t < 24; t++) {
    const f = pick(c.rng, faces);
    const runs = freeRuns(f, c.sockets, 1.2).filter(([a, b]) => b - a > 1.3);
    if (!runs.length) continue;
    const [a0, a1] = pick(c.rng, runs);
    const at = c.rng.float(a0 + 0.1, a1 - 1.0 - 0.1);
    // 外形 0.6（奥行） × 1.0（長さ） × 0.9（高さ）。ソリッドは外形の箱 1 つで確認する
    const outer = alongFace(f, at, 1.0, 0.08, 0.68, 0, 0.9, 'metalDark', true);
    if (!canPlace(c, outer, { lanes: false })) continue;
    const T = 0.03;
    // 4 本の支柱（ソリッド）
    for (const [d0, d1] of [[0.08, 0.08 + T], [0.68 - T, 0.68]] as [number, number][]) {
      for (const p of [at + 0.03, at + 1.0 - 0.03 - T]) {
        c.L.boxes.push({ ...alongFace(f, p, T, d0, d1, 0, 0.9, 'metalDark', true), kind: ODD_KIND });
      }
    }
    // 上端の枠 4 本（非ソリッド）
    for (const [d0, d1] of [[0.08, 0.08 + T], [0.68 - T, 0.68]] as [number, number][]) {
      c.L.boxes.push({ ...alongFace(f, at, 1.0, d0, d1, 0.87, 0.9, 'metalDark', false), kind: ODD_KIND });
    }
    for (const p of [at + 0.03, at + 1.0 - 0.03 - T]) {
      c.L.boxes.push({ ...alongFace(f, p, T, 0.08, 0.68, 0.87, 0.9, 'metalDark', false), kind: ODD_KIND });
    }
    // 底の棚板（ソリッド。支柱の隙間をすり抜けないように）
    c.L.boxes.push({ ...alongFace(f, at, 1.0, 0.08, 0.68, 0.1, 0.14, 'metalDark', true), kind: ODD_KIND });
    c.note('trace.marks: cart');
    return true;
  }
  return false;
}

const marks: Oddity = {
  id: 'trace.marks', category: 'trace', weight: 3, theme: true,
  applicable(c) { return c.rects.length > 0; },
  apply(c, strength) {
    const want = strength === 'strong' ? 2 : 1;
    const order = c.rng.shuffle<'drag' | 'chairs' | 'meal' | 'cart'>(['drag', 'chairs', 'meal', 'cart']);
    let done = 0;
    for (const v of order) {
      if (done >= want) break;
      if (!budgetOk(c, 14)) break;
      const ok = v === 'drag' ? dragMarks(c, strength)
        : v === 'chairs' ? pulledChairs(c)
          : v === 'meal' ? afterMeal(c) : leftCart(c);
      if (ok) done++;
    }
    return done > 0;
  },
};

export const TRACE_ODDITIES: Oddity[] = [mismatch, timeMix, marks];
