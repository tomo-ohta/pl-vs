/**
 * 文字と印の異変（段階 4・oddity。8 番出口型の気づき）: 数が合わない（X03）・案内の嘘（X04）・自分の名前（X05）・正しい出口の印（X13）。
 * 文字は描画（client/views/oddity/labels.ts）が書く。ここは札の位置・文字・色を決め、扉・掲示板の箱を置く。
 */
import type { AABB } from '../../../../math/aabb.ts';
import { along } from '../../../../world/footprint.ts';
import { box, type Box, type Json, type MatId } from '../../../../world/layout.ts';
import { decorDoor } from '../../../dress/decor.ts';
import { defineAnomaly, type AnomalyContext } from '../../types.ts';
import { bbOf, interiorSolids, isWallDecor, objectGroups, type Group } from '../../util.ts';
import { MAZE_THEMES } from '../scale.ts';
import { addGroup, arrowYaw, facesOf, faceLabel, faceOfOpening, faceRight, floorLabel, forwardOpening, freeSpans, front, lift, roomFx, type Face } from './common.ts';

/** 物の種類（主の箱の kind） */
const kindOf = (g: Group): string => g.boxes.find((b) => b.kind && b.kind !== 'colliderOnly')?.kind ?? '';

/** 数える物（椅子・机・座席・ロッカー・棚 …） */
const COUNTABLE = new Set(['chair', 'desk', 'table', 'sofa', 'seatRow', 'cabinet', 'shelf', 'bed', 'locker', 'counter', 'bench', 'crate', 'pallet', 'serverRack', 'plant', 'bin']);

/** 物の上（低い物）か、入口を向いた前の面（背の高い物）に貼る札 */
function tagFor(ctx: AnomalyContext, g: Group, text: string, w: number, h: number, o: { fg?: number; bg?: number }): { [k: string]: Json } {
  const bb = bbOf(g.boxes);
  const fy = ctx.cell.floorY;
  const cx = (bb.min[0] + bb.max[0]) / 2, cz = (bb.min[2] + bb.max[2]) / 2;
  if (bb.max[1] - fy < 1.25) return floorLabel(cx, bb.max[1], cz, Math.min(w, bb.max[0] - bb.min[0]), Math.min(h, bb.max[2] - bb.min[2]), text, o);
  // 入口の側の面
  const e = ctx.entrance.pos;
  const dx = e[0] - cx, dz = e[2] - cz;
  const y = fy + Math.min(1.5, (bb.max[1] - fy) * 0.7);
  if (Math.abs(dx) > Math.abs(dz)) return { text, pos: [dx > 0 ? bb.max[0] + 0.01 : bb.min[0] - 0.01, y, cz], dir: dx > 0 ? 3 : 1, w, h, ...o };
  return { text, pos: [cx, y, dz > 0 ? bb.max[2] + 0.01 : bb.min[2] - 0.01], dir: dz > 0 ? 2 : 0, w, h, ...o };
}

/** 開口の無いいちばん長い壁の区間（面と区間） */
function longestSpan(ctx: AnomalyContext, pad = 0.6, prefer?: Face): { f: Face; p: number; q: number } | null {
  let best: { f: Face; p: number; q: number } | null = null;
  for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, pad)) {
    const bonus = prefer && f.dir === prefer.dir ? 2 : 0;
    if (!best || q - p + bonus > best.q - best.p + (prefer && best.f.dir === prefer.dir ? 2 : 0)) best = { f, p, q };
  }
  return best;
}

/** 入口と向かい合う壁の面（無ければ null） */
function farFace(ctx: AnomalyContext): Face | null {
  const d = (ctx.entrance.dir + 2) % 4;
  return facesOf(ctx).filter((f) => f.dir === d).sort((a, b) => b.a1 - b.a0 - (a.a1 - a.a0))[0] ?? null;
}

// ---------------------------------------------------------------- X03 数が合わない

/**
 * 数が合わない: 部屋の家具の 1 つずつに大きな番号札（入口に近い順に 1, 2, 3 …）。どこかで同じ番号が 2 回出て、数が 1 つ多い。
 * 壁の掲示は「この部屋の◯◯は N」（実際は N + 1）。家具の少ない部屋では、壁一面の番号付きのロッカーにする
 */
defineAnomaly({
  id: 'miscount', name: '数が合わない', weight: 0.6, intensity: 0, kinds: ['room', 'hall'], minSize: [3, 3.6],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const e = ctx.entrance.pos;
    const all = objectGroups(ctx.furniture, cell).filter((g) => COUNTABLE.has(kindOf(g)) && !isWallDecor(g, cell));
    // いちばん多い種類を数える（椅子なら椅子だけ）。同じ種類が少なければ、数えられる物を全部
    const by = new Map<string, Group[]>();
    for (const g of all) by.set(kindOf(g), [...(by.get(kindOf(g)) ?? []), g]);
    const most = [...by.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    const groups = most.length >= 4 ? most : all;
    const items: { [k: string]: Json }[] = [];
    let noun = '', count = 0;
    const fg = 0x1a1a1a, bg = 0xf3efe2;
    if (groups.length >= 4) {
      const k = groups === most ? kindOf(groups[0]!) : '';
      noun = k === 'chair' ? '椅子' : k === 'desk' ? '机' : k === 'table' ? '机' : k === 'seatRow' ? '座席の列' : k === 'shelf' ? '棚' : k === 'locker' ? 'ロッカー' : k === 'plant' ? '鉢' : '家具';
      const dist = (g: Group): number => { const bb = bbOf(g.boxes); return Math.hypot((bb.min[0] + bb.max[0]) / 2 - e[0], (bb.min[2] + bb.max[2]) / 2 - e[2]); };
      groups.sort((a, b) => dist(a) - dist(b));
      const dup = ctx.rng.int(1, groups.length - 2);
      groups.forEach((g, i) => items.push(tagFor(ctx, g, String(i < dup + 1 ? i + 1 : i), 0.32, 0.24, { fg, bg })));
      count = groups.length;
    } else {
      // 家具の少ない部屋: 壁一面の番号付きの札（コート掛けの番号。当たらない）。同じ番号が 2 つ
      const s = longestSpan(ctx, 0.5);
      if (!s || s.q - s.p < 2) return false;
      const n = Math.min(14, Math.floor((s.q - s.p - 0.2) / 0.36));
      const a0 = (s.p + s.q) / 2 - (n * 0.36) / 2;
      const B: Box[] = [faceSheetBox(s.f, a0 - 0.05, a0 + n * 0.36 + 0.05, fy + 1.55, fy + 1.62, 'woodPanel', 0.002, 0.03)];
      for (let i = 0; i < n; i++) B.push(faceSheetBox(s.f, a0 + i * 0.36 + 0.16, a0 + i * 0.36 + 0.2, fy + 1.45, fy + 1.58, 'metal', 0.03, 0.09));
      addGroup(ctx, B, 'hooks');
      noun = 'コート掛け';
      const dup = ctx.rng.int(2, n - 2);
      for (let i = 0; i < n; i++) items.push(faceLabel(s.f, a0 + i * 0.36 + 0.18, fy + 1.72, 0.26, 0.16, String(i < dup + 1 ? 101 + i : 100 + i), { fg, bg }, 0.032));
      count = n;
    }
    // 壁の掲示: 数が 1 つ足りない
    const board = longestSpan(ctx, 0.6, farFace(ctx) ?? undefined);
    if (board) {
      const at = (board.p + board.q) / 2;
      addGroup(ctx, [faceSheetBox(board.f, at - 0.55, at + 0.55, fy + 1.35, fy + 1.95, 'noticeGreen', 0.004, 0.02)], 'countBoard');
      items.push(faceLabel(board.f, at, fy + 1.65, 1.0, 0.5, `この部屋の${noun}\n${count - 1}`, { fg: 0xf2f2e8, bg: 0x2f4a38 }, 0.025));
    }
    roomFx(ctx, { kind: 'labels', items });
    return true;
  },
});

/** 壁の面に重ねる板（当たらない。作業座標ではなくフロア座標） */
function faceSheetBox(f: Face, a0: number, a1: number, y0: number, y1: number, mat: MatId, d0: number, d1: number): Box {
  const n0 = f.face + f.inward * d0, n1 = f.face + f.inward * d1;
  return f.horizontal ? box([a0, y0, Math.min(n0, n1)], [a1, y1, Math.max(n0, n1)], mat, false) : box([Math.min(n0, n1), y0, a0], [Math.max(n0, n1), y1, a1], mat, false);
}

// ---------------------------------------------------------------- X04 案内の嘘

/** 壁 f の位置 at に、作業座標の装飾の扉を置いた箱（フロア座標） */
function fakeDoor(f: Face, at: number, fy: number, mat: MatId): Box[] {
  const B: Box[] = [];
  decorDoor(B, f, at, mat);
  return lift(B, fy);
}

/**
 * 案内の嘘: 床の矢印と壁の案内が「出口 →」と、開口の無い壁の偽の扉（非常口の灯り付き）を指している。本当の先の開口の上には
 * 「関係者以外立入禁止」。案内に従うと行き止まりの扉（開かない）に着く。閉じ込めはしない（本物の開口は普通に通れる）
 */
defineAnomaly({
  id: 'fakeSigns', name: '案内の嘘', weight: 0.7, intensity: 0, kinds: ['room', 'hall'], minSize: [3.6, 4.5], minHeight: 2.4,
  fits: (g) => g.openings.length >= 2 && !MAZE_THEMES.has(g.cell.theme ?? ''),
  pre(ctx) {
    // 偽の扉の場所: 開口の無い壁の区間のうち、入口からいちばん遠い所
    const e = ctx.entrance.pos;
    let best: { f: Face; at: number; d: number } | null = null;
    for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, 0.9)) {
      if (q - p < 1.4) continue;
      const at = (p + q) / 2;
      const [x, z] = f.horizontal ? [at, f.face] : [f.face, at];
      const d = Math.hypot(x - e[0], z - e[2]);
      if (!best || d > best.d) best = { f, at, d };
    }
    if (!best || best.d < 3) return false;
    ctx.memo.fake = { dir: best.f.dir, coord: best.f.coord, at: best.at };
    const fy = ctx.cell.floorY;
    const [x0, z0] = best.f.horizontal ? [best.at - 0.8, best.f.face] : [best.f.face, best.at - 0.8];
    const [x1, z1] = best.f.horizontal ? [best.at + 0.8, best.f.face + best.f.inward * 1.6] : [best.f.face + best.f.inward * 1.6, best.at + 0.8];
    ctx.keepOut({ min: [Math.min(x0, x1), fy - 0.1, Math.min(z0, z1)], max: [Math.max(x0, x1), fy + 2.4, Math.max(z0, z1)] });
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const m = ctx.memo.fake as { dir: number; coord: number; at: number } | undefined;
    const f = m && facesOf(ctx).find((x) => x.dir === m.dir && Math.abs(x.coord - m.coord) < 1e-3 && m.at > x.a0 && m.at < x.a1);
    if (!m || !f) return false;
    const B = fakeDoor(f, m.at, fy, cell.palette.door);
    B.push(faceSheetBox(f, m.at - 0.25, m.at + 0.25, fy + 2.18, fy + 2.36, 'signEmissive', 0.01, 0.05));
    if (B.some((b) => b.max[1] > fy + cell.height)) return false;
    addGroup(ctx, B, 'fakeExit');
    const items: { [k: string]: Json }[] = [faceLabel(f, m.at, fy + 2.27, 0.46, 0.15, '出口 EXIT', { fg: 0xffffff, bg: 0x1b8f4a, glow: true }, 0.055)];
    const [tx, tz] = f.horizontal ? [m.at, f.face + f.inward * 0.6] : [f.face + f.inward * 0.6, m.at];
    // 床の矢印: 入口の前から偽の扉へ（1.2 m ごと）
    const [ax, az] = front(ctx.entrance, 1.3);
    const n = Math.max(2, Math.round(Math.hypot(tx - ax, tz - az) / 1.2));
    const solids = interiorSolids(cell);
    for (let i = 0; i < n; i++) {
      const x = ax + ((tx - ax) * i) / n, z = az + ((tz - az) * i) / n;
      if (solids.some((s) => s.min[1] < fy + 0.1 && s.min[0] < x + 0.3 && s.max[0] > x - 0.3 && s.min[2] < z + 0.3 && s.max[2] > z - 0.3)) continue;
      items.push(floorLabel(x, fy, z, 0.5, 0.36, '#arrow:R', { fg: 0xf2e8b0, bg: 0x1b8f4a, yaw: arrowYaw(tx - ax, tz - az) }));
    }
    // 壁の案内「出口 →」（偽の扉の方を指す）: 入口の脇の壁と、ほかの壁にいくつか
    for (const g of facesOf(ctx)) {
      if (g === f) continue;
      for (const [p, q] of freeSpans(ctx, g, 0.4).slice(0, 2)) {
        const at = (p + q) / 2;
        const [x, z] = g.horizontal ? [at, g.face] : [g.face, at];
        const [rx, rz] = faceRight(g);
        const right = (tx - x) * rx + (tz - z) * rz >= 0;
        items.push(faceLabel(g, at, fy + 1.75, 0.7, 0.22, right ? '出口 →' : '← 出口', { fg: 0xffffff, bg: 0x1b8f4a }));
      }
    }
    // 本当の先の開口の上: 立入禁止
    const fwd = forwardOpening(ctx);
    const ff = fwd && faceOfOpening(ctx, fwd);
    if (fwd && ff) {
      const at = along(fwd.dir, fwd.pos[0], fwd.pos[2]);
      const top = fwd.pos[1] + (fwd.sill ?? 0) + fwd.height;
      if (top + 0.3 < fy + cell.height) items.push(faceLabel(ff, at, top + 0.16, 0.9, 0.2, '関係者以外立入禁止', { fg: 0xffffff, bg: 0xb02a2a }, 0.02));
    }
    roomFx(ctx, { kind: 'labels', items });
    return true;
  },
});

// ---------------------------------------------------------------- X05 自分の名前

/**
 * 自分の名前: 入口と向かい合う壁に大きく「{name} さん　おかえりなさい」。机・椅子・棚の 1 つずつに、遊ぶ人の名前の名札。
 * 先の開口の上の表示は「{name} 様　お呼び出しです」。名前の入力が無ければ「あなた」
 */
defineAnomaly({
  id: 'nameplate', name: '自分の名前', weight: 0.5, intensity: 0, kinds: ['room', 'hall'], minSize: [3, 3.6], minHeight: 2.4,
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const items: { [k: string]: Json }[] = [];
    const s = longestSpan(ctx, 0.5, farFace(ctx) ?? undefined);
    if (!s || s.q - s.p < 1.6) return false;
    const at = (s.p + s.q) / 2, w = Math.min(2.6, s.q - s.p - 0.2);
    addGroup(ctx, [faceSheetBox(s.f, at - w / 2 - 0.04, at + w / 2 + 0.04, fy + 1.26, fy + 2.14, 'metal', 0.002, 0.018), faceSheetBox(s.f, at - w / 2, at + w / 2, fy + 1.3, fy + 2.1, 'paintWhite', 0.018, 0.024)], 'welcome');
    items.push(faceLabel(s.f, at, fy + 1.7, w - 0.1, 0.7, '{name} さん\nおかえりなさい', { fg: 0x23303a, bg: 0xf4f4f0 }, 0.027));
    for (const g of objectGroups(ctx.furniture, cell).filter((x) => !isWallDecor(x, cell)).slice(0, 40)) items.push(tagFor(ctx, g, '{name}', 0.3, 0.1, { fg: 0x202020, bg: 0xfaf6e8 }));
    const fwd = forwardOpening(ctx);
    const ff = fwd && faceOfOpening(ctx, fwd);
    if (fwd && ff) {
      const top = fwd.pos[1] + (fwd.sill ?? 0) + fwd.height;
      if (top + 0.32 < fy + cell.height) items.push(faceLabel(ff, along(fwd.dir, fwd.pos[0], fwd.pos[2]), top + 0.17, 1.2, 0.22, '{name} 様　お呼び出しです', { fg: 0xffb040, bg: 0x101010, glow: true }, 0.02));
    }
    roomFx(ctx, { kind: 'labels', items });
    return true;
  },
});

// ---------------------------------------------------------------- X13 正しい出口の印

/**
 * 正しい出口の印: 壁に開かない扉がいくつも並び、どの扉の上にも非常口の印。人が走る向きは全部同じなのに、本当の先の開口の印だけ逆を向いている。
 * 偽の扉を調べても開かない（閉じ込めない。本物の開口は普通に通れる）
 */
defineAnomaly({
  id: 'exitSign', name: '正しい出口の印', weight: 0.6, intensity: 0, kinds: ['room', 'hall'], minSize: [3.6, 4.2], minHeight: 2.45,
  fits: (g) => g.openings.length >= 2 && !MAZE_THEMES.has(g.cell.theme ?? ''),
  pre(ctx) {
    const fy = ctx.cell.floorY;
    const spots: { dir: number; coord: number; at: number }[] = [];
    for (const f of facesOf(ctx)) for (const [p, q] of freeSpans(ctx, f, 0.5)) {
      const n = Math.min(3, Math.floor((q - p) / 1.5));
      for (let i = 0; i < n; i++) spots.push({ dir: f.dir, coord: f.coord, at: p + ((q - p) * (i + 0.5)) / n });
    }
    const pick = ctx.rng.shuffle(spots).slice(0, ctx.rng.int(3, 6));
    if (pick.length < 2) return false;
    ctx.memo.doors = pick;
    for (const s of pick) {
      const f = facesOf(ctx).find((x) => x.dir === s.dir && Math.abs(x.coord - s.coord) < 1e-3 && s.at > x.a0 && s.at < x.a1)!;
      const [x0, z0] = f.horizontal ? [s.at - 0.7, f.face] : [f.face, s.at - 0.7];
      const [x1, z1] = f.horizontal ? [s.at + 0.7, f.face + f.inward * 1.3] : [f.face + f.inward * 1.3, s.at + 0.7];
      ctx.keepOut({ min: [Math.min(x0, x1), fy - 0.1, Math.min(z0, z1)], max: [Math.max(x0, x1), fy + 2.45, Math.max(z0, z1)] } as AABB);
    }
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const fwd = forwardOpening(ctx);
    if (!fwd) return false;
    const spots = (ctx.memo.doors as { dir: number; coord: number; at: number }[] | undefined) ?? [];
    const items: { [k: string]: Json }[] = [];
    const facing = ctx.rng.chance(0.5) ? 'R' : 'L';
    const other = facing === 'R' ? 'L' : 'R';
    const sign = (f: Face, at: number, y: number, picto: string, name: string): void => {
      addGroup(ctx, [faceSheetBox(f, at - 0.27, at + 0.27, y - 0.11, y + 0.11, 'metalDark', 0.004, 0.04), faceSheetBox(f, at - 0.25, at + 0.25, y - 0.09, y + 0.09, 'signEmissive', 0.04, 0.05)], name);
      items.push(faceLabel(f, at, y, 0.5, 0.18, picto, { fg: 0xffffff, bg: 0x1b9a50, glow: true }, 0.055));
    };
    let made = 0;
    for (const s of spots) {
      const f = facesOf(ctx).find((x) => x.dir === s.dir && Math.abs(x.coord - s.coord) < 1e-3 && s.at > x.a0 && s.at < x.a1);
      if (!f) continue;
      const B = fakeDoor(f, s.at, fy, cell.palette.door);
      if (B.some((b) => b.max[1] > fy + cell.height - 0.25)) continue;
      addGroup(ctx, B, `fakeDoor${made}`);
      sign(f, s.at, fy + 2.3, `#exit:${facing}`, `exitSign${made}`);
      made++;
    }
    if (made < 2) return false;
    let fwdSign = false;
    for (const o of ctx.geo.openings) {
      const f = faceOfOpening(ctx, o);
      if (!f) continue;
      const top = o.pos[1] + (o.sill ?? 0) + o.height;
      const at = along(o.dir, o.pos[0], o.pos[2]);
      // 開口の上に収まらなければ（天井の低い部屋・背の高い開口）、開口の脇の壁に
      let a = at, y = top + 0.17;
      if (top + 0.25 > fy + cell.height) {
        a = at + o.width / 2 + 0.45;
        if (a + 0.3 > f.a1 - 0.15) a = at - o.width / 2 - 0.45;
        if (a - 0.3 < f.a0 + 0.15) continue;
        y = Math.min(fy + 1.95, fy + cell.height - 0.2);
      }
      sign(f, a, y, `#exit:${o === fwd ? other : facing}`, `exitSign@${o.id}`);
      if (o === fwd) fwdSign = true;
    }
    // 本当の先の開口の印が無ければ、この異変は成り立たない
    if (!fwdSign) return false;
    roomFx(ctx, { kind: 'labels', items });
    return true;
  },
});

export { faceSheetBox };
