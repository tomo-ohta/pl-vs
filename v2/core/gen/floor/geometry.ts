/**
 * 骨組み → 区画（部屋・曲がり角・広間・廊下・階段）の形と、区画どうしの開口・扉（v2-plan.md 5 章の ②）。
 *
 * - 区画の中心: x = (列 − (列数−1)/2) × 間隔、z = −(行 + 0.5) × 間隔（入口が手前 +Z、奥が −Z）
 * - 部屋は区画の中に収まり、どの向きから来る廊下の帯（中心線 ± 廊下の幅/2 + 0.6 m）も含む大きさにする
 *   → 廊下は隣の区画の中心線に沿ってまっすぐ通せる（曲がりは曲がり角の区画で作る）
 * - 段差のあるつなぎは、廊下の途中に階段の区画を挟む（蹴上げ 0.17 m 以下・踏面 0.28 m）
 * - 入口の後ろに「降りてきた階段」（上は閉ざされた扉）、出口の先に「次の階へ降りる階段」（下に FloorExit）
 * 区画は、全部の開口が決まってから一度に作る（壁に開口を開けるため）。区画ごとの開口も返す（中身の配置と到達判定に使う）。
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import { hashAll, type Rng } from '../../math/rng.ts';
import type { Dir, Vec3 } from '../../math/vec.ts';
import { doorPanel, lightPanel, makeCell, opening, portal, portalAabb } from '../../world/build.ts';
import type { Rect } from '../../world/footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type CellRole, type EntitySpec, type FloorExit, type Json, type Palette, type PortalSpec, type WallOpening } from '../../world/layout.ts';
import { themePalette } from '../../world/palettes.ts';
import type { DressKind } from '../dress/types.ts';
import type { FloorProfile } from './profile.ts';
import { adjacency, type Skeleton, type SkelNode } from './skeleton.ts';

export class GenError extends Error {}

const RISER_MAX = 0.17;
const TREAD = 0.28;
const snap = (v: number): number => Math.round(v * 20) / 20;
const aabbJson = (a: AABB): Json => ({ min: [...a.min], max: [...a.max] });

export interface GeoCell {
  cell: CellLayout;
  kind: DressKind;
  openings: WallOpening[];
  /** 骨組みの区画（部屋・曲がり角・広間）。廊下・階段は -1 */
  node: number;
}

export interface FloorGeometry {
  cells: GeoCell[];
  portals: PortalSpec[];
  entities: EntitySpec[];
  spawn: { pos: Vec3; yaw: number; cell: string };
  exits: FloorExit[];
  /** 骨組みの区画 → 区画の id */
  nodeCell: Map<number, string>;
  corridorWidth: number;
}

/** 部屋・曲がり角・広間の置き場所 */
interface Placed { node: SkelNode; rect: Rect; y: number; height: number; theme: string; kind: DressKind; cellId: string }

/** 廊下・階段の区画の作り方（開口が決まってから作る） */
interface StraightSpec {
  id: string;
  axis: 'x' | 'z';
  a0: number;
  a1: number;
  center: number;
  width: number;
  /** 区画の床（階段は低い方） */
  y: number;
  height: number;
  kind: DressKind;
  role: CellRole;
  name: string;
  /** 階段: 低い端（'a0' か 'a1'）、段の始まり（低い端からの距離）、上がる高さ */
  stairs?: { lowEnd: 'a0' | 'a1'; offset: number; rise: number };
  /** 照明の材質（無ければ廊下の色の組） */
  lightMat?: Box['mat'];
  extra?: Box[];
}

export function buildGeometry(p: FloorProfile, sk: Skeleton, rng: Rng, t: Tuning): FloorGeometry {
  const S = p.spacing;
  const LH = t['floor.levelHeightM'];
  const fam = p.family;
  const cw = snap(rng.float(fam.corridorWidth[0], fam.corridorWidth[1]));
  const hc = snap(rng.float(fam.corridorHeight[0], fam.corridorHeight[1]));
  const band = cw / 2 + 0.6;
  const cx = (c: number): number => (c - (sk.cols - 1) / 2) * S;
  const cz = (r: number): number => -(r + 0.5) * S;
  const yOf = (n: SkelNode): number => n.level * LH;
  const corridorPalette = themePalette(fam.corridor);
  const corrKey = `corr:${p.id}`;
  const adj = adjacency(sk);

  const out: FloorGeometry = { cells: [], portals: [], entities: [], spawn: { pos: [0, 0, 0], yaw: 0, cell: '' }, exits: [], nodeCell: new Map(), corridorWidth: cw };
  const openings = new Map<string, WallOpening[]>();
  const addOpening = (cell: string, o: WallOpening): void => { const l = openings.get(cell) ?? []; l.push(o); openings.set(cell, l); };
  const straights: StraightSpec[] = [];
  const extraBoxes = new Map<string, Box[]>();
  const addBox = (cell: string, b: Box): void => { const l = extraBoxes.get(cell) ?? []; l.push(b); extraBoxes.set(cell, l); };

  // ---------------------------------------------------------------- 部屋・曲がり角・広間の置き場所
  const placed = new Map<number, Placed>();
  const hallDone = new Map<number, Placed>();
  const used = sk.nodes.filter((n) => n.kind !== 'none');
  for (const n of used) {
    const nr = rng.fork(`node${n.id}`);
    const x = cx(n.col), z = cz(n.row);
    if (n.kind === 'hall') {
      const hit = hallDone.get(n.hall);
      if (hit) { placed.set(n.id, hit); continue; }
      const members = used.filter((m) => m.kind === 'hall' && m.hall === n.hall);
      const hs = S / 2 - 1.2;
      const rect: Rect = {
        x0: snap(Math.min(...members.map((m) => cx(m.col))) - hs), x1: snap(Math.max(...members.map((m) => cx(m.col))) + hs),
        z0: snap(Math.min(...members.map((m) => cz(m.row))) - hs), z1: snap(Math.max(...members.map((m) => cz(m.row))) + hs),
      };
      const pl: Placed = { node: n, rect, y: yOf(n), height: snap(nr.float(fam.hallHeight[0], fam.hallHeight[1])), theme: nr.weighted(fam.halls, ([, w]) => w)[0], kind: 'hall', cellId: `hall${n.hall}` };
      hallDone.set(n.hall, pl);
      placed.set(n.id, pl);
      continue;
    }
    if (n.kind === 'junction') {
      const h = cw / 2 + WALL_T;
      placed.set(n.id, { node: n, rect: { x0: snap(x - h), x1: snap(x + h), z0: snap(z - h), z1: snap(z + h) }, y: yOf(n), height: hc, theme: fam.corridor, kind: 'junction', cellId: `j${n.id}` });
      continue;
    }
    const minR = Math.max(3.8, 2 * band + 0.6);
    const maxR = Math.max(minR, S - 2.8);
    const w = snap(nr.float(minR, maxR)), d = snap(nr.float(minR, maxR));
    const jx = snap(nr.float(-1, 1) * Math.max(0, w / 2 - band)), jz = snap(nr.float(-1, 1) * Math.max(0, d / 2 - band));
    const theme = n.id === sk.entry ? fam.corridor : nr.weighted(fam.rooms, ([, wt]) => wt)[0];
    placed.set(n.id, {
      node: n, rect: { x0: snap(x + jx - w / 2), x1: snap(x + jx + w / 2), z0: snap(z + jz - d / 2), z1: snap(z + jz + d / 2) },
      y: yOf(n), height: snap(nr.float(fam.roomHeight[0], fam.roomHeight[1])), theme, kind: 'room', cellId: `r${n.id}`,
    });
  }

  // ---------------------------------------------------------------- 廊下（つなぎごと）
  const doorRng = rng.fork('doors');
  let ci = 0;
  for (const l of sk.links) {
    const A = placed.get(l.a), B = placed.get(l.b);
    if (!A || !B || A === B) continue; // 同じ広間の中
    const axis: 'x' | 'z' = sk.nodes[l.a]!.row === sk.nodes[l.b]!.row ? 'x' : 'z';
    const [F, T] = axis === 'x' ? (A.rect.x1 <= B.rect.x0 ? [A, B] : [B, A]) : (A.rect.z1 <= B.rect.z0 ? [A, B] : [B, A]);
    const start = axis === 'x' ? F.rect.x1 : F.rect.z1;
    const end = axis === 'x' ? T.rect.x0 : T.rect.z0;
    const L = end - start;
    if (L < 0.3) throw new GenError(`区画が近すぎます: ${l.a}-${l.b}`);
    const center = axis === 'x' ? cz(sk.nodes[l.a]!.row) : cx(sk.nodes[l.a]!.col);
    const h = Math.min(hc, F.height, T.height);
    const doorF = F.kind === 'room' && F.node.id !== sk.entry && F.node.id !== sk.exit && doorRng.chance(fam.doorChance);
    const doorT = T.kind === 'room' && T.node.id !== sk.entry && T.node.id !== sk.exit && doorRng.chance(fam.doorChance);
    const dirPos: Dir = axis === 'x' ? 1 : 0; // 軸の正の向き
    const dirNeg: Dir = axis === 'x' ? 3 : 2;
    const roomOpening = (pl: Placed, dir: Dir, coord: number, door: boolean): WallOpening => {
      const span = axis === 'x' ? pl.rect.z1 - pl.rect.z0 : pl.rect.x1 - pl.rect.x0;
      // 曲がり角は廊下の幅いっぱい（区画の幅 = 廊下の幅 + 壁）。部屋・広間は壁の端を 0.6 m ずつ残す
      const width = door ? DOOR_W : pl.kind === 'junction' ? cw : Math.min(cw, span - 1.2);
      const pos: Vec3 = axis === 'x' ? [coord, pl.y, center] : [center, pl.y, coord];
      return opening(`${pl.cellId}:${l.a}-${l.b}`, pos, dir, width, door ? DOOR_H : Math.min(h, pl.height - 0.2));
    };
    const oF = roomOpening(F, dirPos, start, doorF);
    const oT = roomOpening(T, dirNeg, end, doorT);
    addOpening(F.cellId, oF);
    addOpening(T.cellId, oT);

    // 区画に分ける（段差があれば 平ら / 階段 / 平ら）
    const segs: StraightSpec[] = [];
    const mk = (id: string, a0: number, a1: number, y: number, height: number, kind: DressKind, stairs?: StraightSpec['stairs']): StraightSpec => {
      const s: StraightSpec = { id, axis, a0, a1, center, width: cw, y, height, kind, role: 'connector', name: kind === 'stairs' ? '階段' : '廊下' };
      if (stairs) s.stairs = stairs;
      return s;
    };
    if (F.y === T.y) segs.push(mk(`c${ci++}`, start, end, F.y, h, 'corridor'));
    else {
      const rise = Math.abs(T.y - F.y);
      const n = Math.ceil(rise / RISER_MAX - 1e-9);
      const Ls = n * TREAD;
      // 段は開口から 0.8 m 以上離す（開口のすぐ先で上り始めると、上の壁（まぐさ）に頭が当たって段を登れない）
      if (L < Ls + 1.6) throw new GenError(`階段が収まりません: ${l.a}-${l.b}（${L.toFixed(2)} m < ${(Ls + 1.6).toFixed(2)} m）`);
      const flat = snap((L - Ls) / 2);
      const low = Math.min(F.y, T.y);
      // 低い端: F が低ければ a0 側（start）、T が低ければ a1 側（end）
      const lowEnd: 'a0' | 'a1' = F.y < T.y ? 'a0' : 'a1';
      // 平らな部分が長ければ廊下の区画に分ける。階段の区画の両端には 0.8 m の平らな所を含める（段の上り始めを開口から離す）。
      // 平らな部分が短い（2 m 未満）ときは階段の区画にまとめる（短い切れ端の区画を作らない）
      const PAD = 0.8;
      if (flat >= 2.0) {
        segs.push(mk(`c${ci++}`, start, snap(start + flat - PAD), F.y, h, 'corridor'));
        segs.push(mk(`s${ci++}`, snap(start + flat - PAD), snap(end - flat + PAD), low, rise + h, 'stairs', { lowEnd, offset: PAD, rise }));
        segs.push(mk(`c${ci++}`, snap(end - flat + PAD), end, T.y, h, 'corridor'));
      } else {
        segs.push(mk(`s${ci++}`, start, end, low, rise + h, 'stairs', { lowEnd, offset: flat, rise }));
      }
    }
    straights.push(...segs);
    // 区画の端の床の高さ（階段は低い端・高い端で違う）
    const endY = (s: StraightSpec, side: 'a0' | 'a1'): number => !s.stairs ? s.y : side === s.stairs.lowEnd ? s.y : s.y + s.stairs.rise;
    // 廊下の両端の開口: 部屋・広間につながる端は、その部屋の開口と同じ大きさ（扉なら扉の大きさ）。廊下どうしの端は廊下の幅いっぱい。
    // 大きさが違うと、廊下の突き当たりの壁が扉より大きく開き、扉が閉じている間（向こうの区画を描かない）は扉の周りが穴に見えた
    segs.forEach((s, i) => {
      const w0 = i === 0 ? oF.width : cw, h0 = i === 0 ? oF.height : h;
      const w1 = i === segs.length - 1 ? oT.width : cw, h1 = i === segs.length - 1 ? oT.height : h;
      addOpening(s.id, opening(`${s.id}:a0`, axis === 'x' ? [s.a0, endY(s, 'a0'), center] : [center, endY(s, 'a0'), s.a0], dirNeg, w0, h0));
      addOpening(s.id, opening(`${s.id}:a1`, axis === 'x' ? [s.a1, endY(s, 'a1'), center] : [center, endY(s, 'a1'), s.a1], dirPos, w1, h1));
    });
    // 区画どうしの portal と扉
    const join = (a: string, b: string, coord: number, y: number, width: number, height: number, doorRoom: Placed | null, swing: number): void => {
      let doorId: string | undefined;
      if (doorRoom) {
        doorId = `door:${a}:${b}`;
        out.entities.push({ id: doorId, type: 'door', cell: doorRoom.cellId, params: { panel: aabbJson(doorPanel(axis, coord, center, DOOR_W, y, DOOR_H)), axis, mat: themePalette(doorRoom.theme).door, hinge: doorRng.chance(0.5) ? 1 : -1, swing } });
      }
      out.portals.push(portal(`p:${a}:${b}`, a, b, portalAabb(axis, coord, center, width, y, height), dirPos, doorRoom ? 'door' : 'opening', doorId));
    };
    join(F.cellId, segs[0]!.id, start, F.y, oF.width, oF.height, doorF ? F : null, -1);
    for (let i = 0; i + 1 < segs.length; i++) join(segs[i]!.id, segs[i + 1]!.id, segs[i]!.a1, endY(segs[i]!, 'a1'), cw, h, null, 1);
    join(segs[segs.length - 1]!.id, T.cellId, end, T.y, oT.width, oT.height, doorT ? T : null, 1);
  }

  // ---------------------------------------------------------------- 入口の階段（降りてきた階段。上は閉ざされた扉）
  const entry = placed.get(sk.entry)!;
  {
    const x = snap((entry.rect.x0 + entry.rect.x1) / 2);
    const z0 = entry.rect.z1;
    const rise = LH;
    const n = Math.ceil(rise / RISER_MAX - 1e-9);
    const len = snap(0.8 + n * TREAD + 1.4);
    const openH = Math.min(2.4, entry.height - 0.2, hc);
    straights.push({ id: 'entryStairs', axis: 'z', a0: z0, a1: z0 + len, center: x, width: 2.2, y: entry.y, height: rise + hc, kind: 'stairs', role: 'entry', name: '降りてきた階段', stairs: { lowEnd: 'a0', offset: 0.8, rise } });
    addOpening(entry.cellId, opening(`${entry.cellId}:entryStairs`, [x, entry.y, z0], 0, 1.6, openH));
    addOpening('entryStairs', opening('entryStairs:a0', [x, entry.y, z0], 2, 1.6, openH));
    out.portals.push(portal('p:entryStairs', entry.cellId, 'entryStairs', portalAabb('z', z0, x, 1.6, entry.y, openH), 0, 'opening'));
    // 閉ざされた扉（上の踊り場の突き当たり。開かない）
    const zEnd = z0 + len - WALL_T;
    out.entities.push({ id: 'door:entryBack', type: 'door', cell: 'entryStairs', params: { panel: aabbJson({ min: [x - 0.5, entry.y + rise, zEnd - 0.05], max: [x + 0.5, entry.y + rise + DOOR_H, zEnd - 0.01] }), axis: 'z', mat: corridorPalette.door, locked: true, autoCloseSec: 0 } });
    out.spawn = { pos: [x, entry.y + 0.02, snap(z0 - 1.2)], yaw: 0, cell: entry.cellId };
  }

  // ---------------------------------------------------------------- 出口の階段（次の階へ降りる）
  const exit = placed.get(sk.exit)!;
  {
    const en = exit.node;
    const usedDirs = new Set((adj.get(en.id) ?? []).map((m): Dir => { const o = sk.nodes[m]!; return o.col > en.col ? 1 : o.col < en.col ? 3 : o.row > en.row ? 2 : 0; }));
    const cands: Dir[] = [];
    if (en.row === sk.rows - 1) cands.push(2);
    if (en.col === 0) cands.push(3);
    if (en.col === sk.cols - 1) cands.push(1);
    if (en.row === 0) cands.push(0);
    const dir = cands.find((d) => !usedDirs.has(d) && !(d === 0 && en.id === sk.entry)) ?? cands[0] ?? 2;
    const r = exit.rect;
    const rise = LH;
    const n = Math.ceil(rise / RISER_MAX - 1e-9);
    const len = snap(1.2 + n * TREAD + 1.6);
    const axis: 'x' | 'z' = dir === 0 || dir === 2 ? 'z' : 'x';
    const c = axis === 'z' ? snap((r.x0 + r.x1) / 2) : snap((r.z0 + r.z1) / 2);
    const edge = dir === 0 ? r.z1 : dir === 2 ? r.z0 : dir === 1 ? r.x1 : r.x0;
    const sgn = dir === 0 || dir === 1 ? 1 : -1;
    const a0 = Math.min(edge, edge + sgn * len), a1 = Math.max(edge, edge + sgn * len);
    const low = exit.y - rise;
    // 低い端は扉から遠い方。段は扉から 1.2 m 先から下がる → 低い端からの距離 = len − 1.2 − 段の長さ
    const lowEnd: 'a0' | 'a1' = sgn > 0 ? 'a1' : 'a0';
    const bottomLen = len - 1.2 - n * TREAD;
    straights.push({ id: 'exitStairs', axis, a0, a1, center: c, width: 2.2, y: low, height: rise + hc, kind: 'exit', role: 'exit', name: '下りの階段', stairs: { lowEnd, offset: bottomLen, rise }, lightMat: 'lightGreen' });
    const roomSide = opening(`${exit.cellId}:exitStairs`, axis === 'z' ? [c, exit.y, edge] : [edge, exit.y, c], dir, DOOR_W, DOOR_H);
    addOpening(exit.cellId, roomSide);
    addOpening('exitStairs', opening('exitStairs:top', axis === 'z' ? [c, exit.y, edge] : [edge, exit.y, c], ((dir + 2) % 4) as Dir, DOOR_W, DOOR_H));
    const doorId = 'door:exit';
    out.entities.push({ id: doorId, type: 'door', cell: exit.cellId, params: { panel: aabbJson(doorPanel(axis, edge, c, DOOR_W, exit.y, DOOR_H)), axis, mat: 'doorMetal', hinge: 1, swing: sgn } });
    out.portals.push(portal('p:exitStairs', exit.cellId, 'exitStairs', portalAabb(axis, edge, c, DOOR_W, exit.y, DOOR_H), dir, 'door', doorId));
    // 扉の上の非常口の灯り（部屋の内側の壁）
    const inner = edge - sgn * WALL_T;
    const y = exit.y + DOOR_H + 0.12;
    addBox(exit.cellId, axis === 'z'
      ? box([c - 0.25, y, Math.min(inner, inner - sgn * 0.05)], [c + 0.25, y + 0.14, Math.max(inner, inner - sgn * 0.05)], 'lightGreen', false)
      : box([Math.min(inner, inner - sgn * 0.05), y, c - 0.25], [Math.max(inner, inner - sgn * 0.05), y + 0.14, c + 0.25], 'lightGreen', false));
    // 下の踊り場の FloorExit
    const b0 = sgn > 0 ? a1 - bottomLen : a0, b1 = sgn > 0 ? a1 : a0 + bottomLen;
    out.exits.push({ id: 'down', kind: 'stairs', aabb: axis === 'z' ? { min: [c - 1.1, low - 0.5, b0], max: [c + 1.1, low + 2, b1] } : { min: [b0, low - 0.5, c - 1.1], max: [b1, low + 2, c + 1.1] } });
  }

  // ---------------------------------------------------------------- 区画を作る（開口がそろってから）
  const done = new Set<Placed>();
  for (const pl of placed.values()) {
    if (done.has(pl)) continue;
    done.add(pl);
    const deg = adj.get(pl.node.id)?.length ?? 0;
    const role: CellRole = pl.node.id === sk.entry ? 'entry' : pl.node.id === sk.exit ? 'exit' : pl.kind === 'hall' ? 'hub' : pl.kind === 'junction' ? 'connector' : sk.main.includes(pl.node.id) ? 'gimmick' : deg <= 1 ? 'side' : 'rest';
    const palette: Palette = pl.kind === 'junction' ? corridorPalette : themePalette(pl.theme);
    const cell = makeCell({
      id: pl.cellId, role, rects: [pl.rect], height: pl.height, floorY: pl.y, palette, theme: pl.theme,
      name: pl.kind === 'junction' ? '曲がり角' : pl.kind === 'hall' ? '広間' : '部屋',
      audioPreset: pl.kind === 'junction' ? fam.corridorAudio : fam.roomAudio,
      materialKey: pl.kind === 'junction' ? corrKey : `${pl.cellId}:${hashAll(p.seed, pl.cellId) % 7}`,
      openings: openings.get(pl.cellId) ?? [],
      lightSpacing: pl.kind === 'hall' ? 3.6 : 2.6,
    });
    cell.boxes.push(...(extraBoxes.get(pl.cellId) ?? []));
    out.cells.push({ cell, kind: pl.kind, openings: openings.get(pl.cellId) ?? [], node: pl.node.id });
    for (const m of sk.nodes) if (placed.get(m.id) === pl) out.nodeCell.set(m.id, pl.cellId);
  }
  for (const s of straights) out.cells.push({ cell: buildStraight(s, openings.get(s.id) ?? [], corridorPalette, corrKey, fam.corridor, fam.corridorAudio), kind: s.kind, openings: openings.get(s.id) ?? [], node: -1 });
  return out;
}

/** 廊下・階段の区画 */
function buildStraight(s: StraightSpec, ops: WallOpening[], palette: Palette, materialKey: string, theme: string, audio: string): CellLayout {
  const rect: Rect = s.axis === 'x' ? { x0: s.a0, x1: s.a1, z0: snap(s.center - s.width / 2), z1: snap(s.center + s.width / 2) } : { x0: snap(s.center - s.width / 2), x1: snap(s.center + s.width / 2), z0: s.a0, z1: s.a1 };
  const cell = makeCell({ id: s.id, role: s.role, rects: [rect], height: s.height, floorY: s.y, palette, theme, name: s.name, audioPreset: audio, materialKey, openings: ops, lights: 'none' });
  const len = s.a1 - s.a0;
  // 照明: 真ん中に並べる（階段は天井の高さが一定なので同じ）
  const nL = Math.max(1, Math.round(len / 2.6));
  for (let i = 0; i < nL; i++) {
    const at = s.a0 + (len / nL) * (i + 0.5);
    const top = s.y + s.height;
    const [lx, lz] = s.axis === 'x' ? [at, s.center] : [s.center, at];
    lightPanel(cell.boxes, lx, lz, s.axis === 'x' ? 1.2 : 0.6, s.axis === 'x' ? 0.6 : 1.2, top, s.lightMat ?? palette.light);
    if (i % 2 === 0 || nL === 1) cell.lights.push({ pos: [lx, top - 0.4, lz], color: s.lightMat === 'lightGreen' ? 0xb8f0c0 : palette.lightColor, intensity: palette.lightIntensity * (s.lightMat ? 0.6 : 1), distance: 7 });
  }
  // 階段: 低い端から offset の所から段を上げ、上がりきった先は踊り場（高い床）
  if (s.stairs) {
    const { lowEnd, offset, rise } = s.stairs;
    const n = Math.ceil(rise / RISER_MAX - 1e-9);
    const riser = rise / n;
    const w0 = s.center - s.width / 2 + WALL_T, w1 = s.center + s.width / 2 - WALL_T;
    const at = (d: number): number => (lowEnd === 'a0' ? s.a0 + d : s.a1 - d); // 低い端からの距離 → 座標
    const slab = (d0: number, d1: number, top: number, kind: string): void => {
      const p0 = Math.min(at(d0), at(d1)), p1 = Math.max(at(d0), at(d1));
      if (p1 - p0 < 1e-3) return;
      const b = s.axis === 'x' ? box([p0, s.y, w0], [p1, top, w1], palette.floor) : box([w0, s.y, p0], [w1, top, p1], palette.floor);
      b.kind = kind;
      cell.boxes.push(b);
    };
    for (let i = 0; i < n; i++) slab(offset + i * TREAD, offset + (i + 1) * TREAD, s.y + (i + 1) * riser, 'stairStep');
    slab(offset + n * TREAD, len, s.y + rise, 'landing');
  }
  if (s.extra) cell.boxes.push(...s.extra);
  return cell;
}
