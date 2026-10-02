/**
 * 区画の作り（SkelNode.style）を形にする（geometry.ts の buildGeometry から、置き場所を決めた後・つなぎを作る前に呼ぶ）。
 *
 * - courtyard 中庭（F05）: 屋外（天井なし・霧・芝・煉瓦の壁・街灯・真ん中に噴水）。外周の部屋から窓で見え、扉で出られる
 * - void 吹き抜けの縦穴（F31）: 区画の真ん中が上下に抜けた縦穴。まわりは手すりの回廊。縦穴の上下に、ほかの階の回廊が見える。
 *   手すりの 1 か所が壊れていて、飛び込むと 2 つ先のフロアへ
 * - mega 巨大空間の中の建物（F18）: 天井の高い広間の真ん中に、屋根のある小さな建物（中は部屋。扉と窓）
 * - nest 入れ子の部屋（F17）: 大部屋の中に小部屋、その中にさらに小部屋（扉は互い違いの辺。回り込んで入る）
 * - gallery 中二階（F14）: 背の高い広間の壁沿いに、上の階の高さの回廊（手すり越しに下が見える）と、回廊へ上る階段
 * - glassFloor / underpass 立体交差（F15）: 上の曲がり角の床がガラス、下の曲がり角は天井が抜けて上が見える
 * - lobby エレベーターホール（F24）: ホールの奥の壁に 2 基のエレベーター（どの階も同じ場所。shapes/lift.ts）
 * - platform 駅のホーム（F35）: ホームの奥に線路の溝と車両（車両の中は部屋。乗ると隣の駅へ。shapes/train.ts）
 * - island 島（F16）: 部屋の下に柱。曲がり角は屋外の小さな足場（手すり・街灯）
 * - old 古い区画（F11 同心円の内側）: 暗く、古い材質、霧が濃い
 * 「穴の開いた区画」（巨大空間・入れ子・ホームの車両）: 外の区画の足跡から中の区画の矩形を引き、穴のまわりの外の区画の壁を
 * 中の区画の高さで切って外壁の材質にし、穴の上の天井をふさぐ（中の区画は自分の壁と天井を持つ）。
 */
import type { AABB } from '../../../math/aabb.ts';
import { Rng } from '../../../math/rng.ts';
import type { Dir } from '../../../math/vec.ts';
import { opening, portalAabb, portal } from '../../../world/build.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Box, type CellLayout, type MatId, type Palette } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import type { Skeleton, SkelNode } from '../skeleton.ts';
import { aabbJson, RISER_MAX, snap, TREAD, type GeoBuild, type Placed } from '../geometry.ts';
import { addBelow, addRailings, lampPost, outdoorEnv } from './outdoor.ts';
import { addLift } from './lift.ts';
import { addTrain } from './train.ts';

export interface StyleEnv {
  S: number;
  SH: number;
  cw: number;
  hc: number;
  cx(c: number): number;
  cz(r: number): number;
  yOf(n: SkelNode): number;
  rng: Rng;
}

/** 区画の矩形の作りの調整（島は小さく。帯の条件 band は保つ） */
export function nodeRect(n: SkelNode, r: Rect, x: number, z: number, S: number, band: number, _rng: Rng): Rect {
  if (n.style !== 'island') return r;
  const max = Math.max(2 * band + 0.6, S - 4.8);
  const w = Math.min(r.x1 - r.x0, max), d = Math.min(r.z1 - r.z0, max);
  const clamp = (v: number, m: number): number => Math.max(-m, Math.min(m, v));
  const mx = (r.x0 + r.x1) / 2 - x, mz = (r.z0 + r.z1) / 2 - z;
  const ox = clamp(mx, Math.max(0, w / 2 - band)), oz = clamp(mz, Math.max(0, d / 2 - band));
  return { x0: snap(x + ox - w / 2), x1: snap(x + ox + w / 2), z0: snap(z + oz - d / 2), z1: snap(z + oz + d / 2) };
}

/** 矩形 r から穴 h（r の中）を引いた矩形の集まり（互いに辺で接する） */
export function subtractRect(r: Rect, h: Rect): Rect[] {
  const out: Rect[] = [];
  if (h.z1 < r.z1 - 1e-6) out.push({ x0: r.x0, x1: r.x1, z0: h.z1, z1: r.z1 });
  if (h.z0 > r.z0 + 1e-6) out.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: h.z0 });
  if (h.x0 > r.x0 + 1e-6) out.push({ x0: r.x0, x1: h.x0, z0: Math.max(r.z0, h.z0), z1: Math.min(r.z1, h.z1) });
  if (h.x1 < r.x1 - 1e-6) out.push({ x0: h.x1, x1: r.x1, z0: Math.max(r.z0, h.z0), z1: Math.min(r.z1, h.z1) });
  return out;
}

/**
 * 穴のまわりの外の区画の壁を、穴の床から top の高さで切る（上は消す）。skin があれば外壁の材質にする。
 * 穴の上の天井を ceilY でふさぐ（ceilY が無ければふさがない = 屋外）
 */
export function clipHoleWalls(cell: CellLayout, hole: Rect, top: number, skin?: MatId, ceilY?: number): void {
  const E = 0.02;
  const ring = { x0: hole.x0 - WALL_T - E, x1: hole.x1 + WALL_T + E, z0: hole.z0 - WALL_T - E, z1: hole.z1 + WALL_T + E };
  const out: Box[] = [];
  for (const b of cell.boxes) {
    const inRing = b.min[0] >= ring.x0 && b.max[0] <= ring.x1 && b.min[2] >= ring.z0 && b.max[2] <= ring.z1;
    const inside = b.min[0] > hole.x0 + E && b.max[0] < hole.x1 - E && b.min[2] > hole.z0 + E && b.max[2] < hole.z1 - E;
    const wall = b.max[1] - b.min[1] > 0.3;
    if (!inRing || inside || !wall) { out.push(b); continue; }
    if (b.min[1] >= top - 1e-3) continue;
    if (b.max[1] > top) b.max = [b.max[0], top, b.max[2]];
    if (skin) b.mat = skin;
    out.push(b);
  }
  cell.boxes = out;
  if (ceilY !== undefined) cell.boxes.push(box([hole.x0 - WALL_T, ceilY, hole.z0 - WALL_T], [hole.x1 + WALL_T, ceilY + 0.2, hole.z1 + WALL_T], cell.palette.ceiling));
}

/**
 * 穴の辺（中の区画の向き side の辺）に、外と中をつなぐ開口と portal（扉があれば扉の部品）。at は辺に沿った位置
 */
export function holeJoin(g: GeoBuild, outer: Placed, inner: Placed, side: Dir, at: number, y: number, door: { mat: MatId; id?: string; startOpen?: boolean } | null, width = DOOR_W, height = DOOR_H): string | undefined {
  const r = inner.rect;
  const coord = side === 0 ? r.z1 : side === 2 ? r.z0 : side === 1 ? r.x1 : r.x0;
  const axis: 'x' | 'z' = side === 0 || side === 2 ? 'z' : 'x';
  const pos: [number, number, number] = axis === 'z' ? [at, y, coord] : [coord, y, at];
  g.addOpening(inner.cellId, opening(`${inner.cellId}:out:${side}`, pos, side, width, height));
  g.addOpening(outer.cellId, opening(`${outer.cellId}:in:${inner.cellId}:${side}`, pos, ((side + 2) % 4) as Dir, width, height));
  let doorId: string | undefined;
  if (door) {
    const sg = side === 0 || side === 1 ? 1 : -1;
    doorId = g.door(door.id ?? `door:${inner.cellId}:${side}`, axis, coord, at, y, { cell: inner.cellId, mat: door.mat, swing: axis === 'x' ? -sg : sg, ...(door.startOpen ? { startOpen: true } : {}) }, width, height);
  }
  g.out.portals.push(portal(`p:${outer.cellId}:${inner.cellId}:${side}`, outer.cellId, inner.cellId, portalAabb(axis, coord, at, width, y, height), ((side + 2) % 4) as Dir, doorId ? 'door' : 'opening', doorId));
  return doorId;
}

/** 穴の辺の窓（ガラス。portal 'window'） */
export function holeWindow(g: GeoBuild, outer: Placed, inner: Placed, side: Dir, at: number, y: number, width: number, sill = 0.95, height = 1.1): void {
  const r = inner.rect;
  const coord = side === 0 ? r.z1 : side === 2 ? r.z0 : side === 1 ? r.x1 : r.x0;
  const axis: 'x' | 'z' = side === 0 || side === 2 ? 'z' : 'x';
  const pos: [number, number, number] = axis === 'z' ? [at, y, coord] : [coord, y, at];
  g.addOpening(inner.cellId, opening(`${inner.cellId}:win:${side}:${at.toFixed(1)}`, pos, side, width, height, sill));
  g.addOpening(outer.cellId, opening(`${outer.cellId}:win:${inner.cellId}:${side}:${at.toFixed(1)}`, pos, ((side + 2) % 4) as Dir, width, height, sill));
  g.addBox(inner.cellId, axis === 'z' ? box([at - width / 2, y + sill, coord - 0.02], [at + width / 2, y + sill + height, coord + 0.02], 'glass') : box([coord - 0.02, y + sill, at - width / 2], [coord + 0.02, y + sill + height, at + width / 2], 'glass'));
  g.out.portals.push(portal(`p:${outer.cellId}:${inner.cellId}:win:${side}:${at.toFixed(1)}`, outer.cellId, inner.cellId, portalAabb(axis, coord, at, width, y + sill, height), ((side + 2) % 4) as Dir, 'window'));
}

/** 区画の中に、もう 1 つの区画（穴）を作る: 外の足跡から引き、壁を切り、天井をふさぐ */
export function carveInner(g: GeoBuild, outer: Placed, hole: Rect, inner: Omit<Placed, 'rect'>, skin?: MatId, cap = true): Placed {
  outer.rects = (outer.rects ?? [outer.rect]).flatMap((r) => (r.x0 <= hole.x0 + 1e-6 && r.x1 >= hole.x1 - 1e-6 && r.z0 <= hole.z0 + 1e-6 && r.z1 >= hole.z1 - 1e-6 ? subtractRect(r, hole) : [r]));
  const pl: Placed = { ...inner, rect: hole };
  const top = pl.y + pl.height + 0.2;
  const ceil = cap && !outer.opts?.noCeiling ? outer.y + outer.height : undefined;
  (outer.post ??= []).push((cell) => clipHoleWalls(cell, hole, top, skin, ceil));
  g.cell(pl);
  return pl;
}

/** 古さ age の色の組（暗く・古い材質） */
export function agedPalette(p: Palette, age: number, innerLight: number): Palette {
  const k = 1 - (1 - innerLight) * age;
  const darken = (c: number, f: number): number => (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
  return {
    ...p,
    lightIntensity: p.lightIntensity * k,
    ambient: darken(p.ambient, 0.5 + 0.5 * k),
    fog: darken(p.fog, 0.6),
    ...(age >= 0.4 ? { floor: age >= 0.8 ? 'floorConcrete' : p.floor, wall: age >= 0.8 ? 'wallConcrete' : p.wall === 'wallWhite' ? 'wallCream' : p.wall, ceiling: 'ceilingDark' } : {}),
  } as Palette;
}

export function applyNodeStyles(g: GeoBuild, sk: Skeleton, placed: Map<number, Placed>, e: StyleEnv): void {
  const t = g.t;
  const seen = new Set<Placed>();
  let outdoor = false;
  for (const n of sk.nodes) {
    const pl = placed.get(n.id);
    if (!pl || seen.has(pl)) continue;
    seen.add(pl);
    const style = pl.node.style;
    const r = new Rng(e.rng.fork(`style:${pl.cellId}`).next() * 4294967296);
    switch (style) {
      case 'courtyard': courtyard(g, pl, r); outdoor = true; break;
      case 'void': voidShaft(g, pl, e, r); break;
      case 'mega': mega(g, pl, r); break;
      case 'nest': nest(g, pl, r); break;
      case 'gallery': gallery(g, pl, sk, e, r); break;
      case 'glassFloor': glassFloor(g, pl, sk, placed, e); break;
      case 'lobby': addLift(g, pl, sk, placed, e, r); break;
      case 'platform': addTrain(g, pl, sk, e, r); break;
      case 'island': island(g, pl, sk); if (pl.kind === 'junction') outdoor = true; break;
      case 'staff':
        if (pl.kind !== 'junction') { pl.theme = 'StorageGrid'; (pl.opts ??= {}).name = '設備室'; }
        (pl.opts ??= {}).palette = { lightIntensity: themePalette(pl.theme).lightIntensity * 0.75 };
        break;
      case 'old': {
        const age = pl.node.age ?? 0;
        const base = pl.kind === 'junction' ? themePalette(pl.fam.corridor) : themePalette(pl.theme);
        const pal = agedPalette(base, age, t['structure.concentric.innerLight']);
        pl.opts = { ...(pl.opts ?? {}), palette: pal, render: { fog: { color: pal.fog, near: 2, far: Math.max(10, 30 - 18 * age) } } };
        if (age >= 0.5) (pl.post ??= []).push((cell) => ageCell(cell, age, r));
        break;
      }
      default: break;
    }
  }
  if (sk.below) addBelow(g, sk.below, 9, (id) => !!g.geo(id)?.cell.lighting?.skyAmbient);
  void outdoor;
}

/** 古い区画: 照明の一部を消し、床に染み（非ソリッドの汚れ）を置く */
function ageCell(cell: CellLayout, age: number, rng: Rng): void {
  const panels = cell.boxes.filter((b) => b.mat === cell.palette.light && !b.solid);
  for (const b of panels) if (rng.chance(0.45 * age)) b.mat = 'lightOff';
  cell.lights = cell.lights.filter(() => !rng.chance(0.4 * age));
  const y = cell.floorY;
  for (const r of cell.footprint) {
    const n = Math.round((r.x1 - r.x0) * (r.z1 - r.z0) / 12 * age);
    for (let i = 0; i < n; i++) {
      const x = rng.float(r.x0 + 0.6, r.x1 - 0.6), z = rng.float(r.z0 + 0.6, r.z1 - 0.6), s = rng.float(0.4, 1.2);
      cell.boxes.push(box([x - s, y + 0.003, z - s * 0.7], [x + s, y + 0.006, z + s * 0.7], rng.chance(0.5) ? 'puddle' : 'shadowDecal', false));
    }
  }
}

// ---------------------------------------------------------------- 中庭（F05）
function courtyard(g: GeoBuild, pl: Placed, rng: Rng): void {
  const env = outdoorEnv('day', g.t['structure.outdoor.fogNear'], g.t['structure.outdoor.fogFar']);
  pl.theme = 'OrganicZone';
  pl.height = 3.6;
  pl.opts = { ...(pl.opts ?? {}), noCeiling: true, lights: 'none', palette: { floor: 'grass', wall: 'wallBrick', ambient: env.ambient, fog: env.fog }, render: env.render, lighting: env.lighting, name: '中庭', audio: '換気・遠い車道音', role: 'landmark' };
  g.reserved.add(pl.cellId);
  const r = pl.rect, y = pl.y;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  (pl.post ??= []).push((cell) => {
    // 真ん中の噴水（低い縁と水面）と、四隅の街灯
    const s = Math.min(1.6, (r.x1 - r.x0) / 6, (r.z1 - r.z0) / 6);
    cell.boxes.push(box([cx - s, y, cz - s], [cx + s, y + 0.45, cz + s], 'columnConcrete'));
    const w = box([cx - s + 0.15, y + 0.3, cz - s + 0.15], [cx + s - 0.15, y + 0.42, cz + s - 0.15], 'water', false);
    cell.boxes.push(w);
    cell.boxes.push(box([cx - 0.12, y + 0.45, cz - 0.12], [cx + 0.12, y + 1.3, cz + 0.12], 'columnConcrete'));
    for (const [px, pz] of [[r.x0 + 1.6, r.z0 + 1.6], [r.x1 - 1.6, r.z0 + 1.6], [r.x0 + 1.6, r.z1 - 1.6], [r.x1 - 1.6, r.z1 - 1.6]] as const) {
      lampPost(cell.boxes, px, pz, y, y + 3.0, 'lightWarm');
      cell.lights.push({ pos: [px, y + 2.85, pz], color: 0xffd8a8, intensity: 0.6, distance: 9 });
    }
    void rng;
  });
  g.keep(pl.cellId, { min: [cx - 2.6, y, cz - 2.6], max: [cx + 2.6, y + 3, cz + 2.6] });
}

// ---------------------------------------------------------------- 吹き抜けの縦穴（F31）
function voidShaft(g: GeoBuild, pl: Placed, e: StyleEnv, rng: Rng): void {
  const t = g.t;
  const x = e.cx(pl.node.col), z = e.cz(pl.node.row);
  const outerH = Math.min(e.S / 2 - 0.1, 3.0 + 2.4);
  const vh = Math.max(2.2, outerH - 2.4);
  pl.rect = { x0: snap(x - outerH), x1: snap(x + outerH), z0: snap(z - outerH), z1: snap(z + outerH) };
  const hole: Rect = { x0: snap(x - vh), x1: snap(x + vh), z0: snap(z - vh), z1: snap(z + vh) };
  pl.rects = subtractRect(pl.rect, hole);
  pl.kind = 'hall';
  pl.height = Math.max(2.8, pl.fam.roomHeight[1]);
  pl.opts = { ...(pl.opts ?? {}), name: '吹き抜けの回廊', role: 'landmark' };
  g.reserved.add(pl.cellId);
  const y = pl.y;
  const rail = t['structure.railM'];
  const levels = t['structure.shaft.levels'];
  const SH = e.SH;
  const voidId = `${pl.cellId}v`;
  const gapSide = rng.int(0, 3) as Dir;
  // 手すり: 穴の 4 辺。1 辺の真ん中だけ手すりが壊れている（床の高さの開口。飛び込める）
  pl.preBuild = [...(pl.preBuild ?? []), () => {
    for (const d of [0, 1, 2, 3] as Dir[]) {
      const coord = d === 0 ? hole.z0 : d === 2 ? hole.z1 : d === 1 ? hole.x0 : hole.x1;
      const lo = d === 0 || d === 2 ? hole.x0 : hole.z0, hi = d === 0 || d === 2 ? hole.x1 : hole.z1;
      const at = (lo + hi) / 2;
      const pos = (a: number): [number, number, number] => (d === 0 || d === 2 ? [a, y, coord] : [coord, y, a]);
      const len = hi - lo - 0.2;
      if (d === gapSide) {
        const gap = 0.9;
        const side = (len - gap) / 2;
        g.addOpening(pl.cellId, opening(`${pl.cellId}:rail:${d}:a`, pos(lo + 0.1 + side / 2), d, side, pl.height - rail + 0.5, rail));
        g.addOpening(pl.cellId, opening(`${pl.cellId}:rail:${d}:b`, pos(hi - 0.1 - side / 2), d, side, pl.height - rail + 0.5, rail));
        g.addOpening(pl.cellId, opening(`${pl.cellId}:gap:${d}`, pos(at), d, gap, pl.height));
      } else g.addOpening(pl.cellId, opening(`${pl.cellId}:rail:${d}`, pos(at), d, len, pl.height - rail + 0.5, rail));
    }
  }];
  (pl.post ??= []).push((cell) => {
    // 手すりの笠木と、壊れた所の黄色い線
    for (const d of [0, 1, 2, 3] as Dir[]) {
      const ex = d === 1 ? hole.x0 : d === 3 ? hole.x1 : 0, ez = d === 0 ? hole.z0 : d === 2 ? hole.z1 : 0;
      if (d === 0 || d === 2) cell.boxes.push(box([hole.x0, y + rail, ez + (d === 0 ? -WALL_T : 0)], [hole.x1, y + rail + 0.05, ez + (d === 0 ? 0 : WALL_T)], 'metal', false));
      else cell.boxes.push(box([ex + (d === 1 ? -WALL_T : 0), y + rail, hole.z0], [ex + (d === 1 ? 0 : WALL_T), y + rail + 0.05, hole.z1], 'metal', false));
    }
    const d = gapSide;
    const at = d === 0 || d === 2 ? (hole.x0 + hole.x1) / 2 : (hole.z0 + hole.z1) / 2;
    const c = d === 0 ? hole.z0 : d === 2 ? hole.z1 : d === 1 ? hole.x0 : hole.x1;
    const inward = d === 0 || d === 1 ? -1 : 1;
    cell.boxes.push(d === 0 || d === 2 ? box([at - 0.5, y, Math.min(c, c + inward * 0.25)], [at + 0.5, y + 0.005, Math.max(c, c + inward * 0.25)], 'yellowLine', false) : box([Math.min(c, c + inward * 0.25), y, at - 0.5], [Math.max(c, c + inward * 0.25), y + 0.005, at + 0.5], 'yellowLine', false));
  });
  // 縦穴の区画（壁なし）: 上下のほかの階の回廊・底・天窓。回廊から窓の portal で見える。底の上に出口（2 つ先のフロアへ）
  g.finishers.push((gb) => {
    const bottom = y - levels * SH - 4, top = y + levels * SH + 4;
    const cell: CellLayout = {
      id: voidId, role: 'connector', bounds: { min: [hole.x0, bottom - 0.2, hole.z0], max: [hole.x1, top + 0.2, hole.z1] }, footprint: [{ ...hole }], height: top - bottom, floorY: bottom,
      palette: { ...themePalette(pl.theme), floor: 'water', wall: 'wallConcrete', ceiling: 'ceilingDark', lightIntensity: 0.5, ambient: 0x202228, fog: 0x07080a },
      boxes: [], lights: [], zones: [], name: '縦穴', theme: pl.theme, audioPreset: '低いハム', render: { fog: { color: 0x07080a, near: 6, far: 40 } },
    };
    const W = outerH - vh;
    for (let k = -levels; k <= levels; k++) {
      if (k === 0) continue;
      const yy = y + k * SH;
      // ほかの階の回廊（穴のまわりの帯）: 床・手すり・天井・奥の壁の暗い出入り口と、まばらな灯り
      for (const [x0, z0, x1, z1] of [[hole.x0 - W, hole.z1, hole.x1 + W, hole.z1 + W], [hole.x0 - W, hole.z0 - W, hole.x1 + W, hole.z0], [hole.x0 - W, hole.z0, hole.x0, hole.z1], [hole.x1, hole.z0, hole.x1 + W, hole.z1]] as const) {
        cell.boxes.push(box([x0, yy - 0.3, z0], [x1, yy, z1], 'floorConcrete', false));
        cell.boxes.push(box([x0, yy + 2.8, z0], [x1, yy + 3.0, z1], 'ceilingDark', false));
      }
      cell.boxes.push(box([hole.x0 - 0.1, yy, hole.z0 - 0.1], [hole.x1 + 0.1, yy + rail, hole.z0], 'wallConcrete', false));
      cell.boxes.push(box([hole.x0 - 0.1, yy, hole.z1], [hole.x1 + 0.1, yy + rail, hole.z1 + 0.1], 'wallConcrete', false));
      cell.boxes.push(box([hole.x0 - 0.1, yy, hole.z0], [hole.x0, yy + rail, hole.z1], 'wallConcrete', false));
      cell.boxes.push(box([hole.x1, yy, hole.z0], [hole.x1 + 0.1, yy + rail, hole.z1], 'wallConcrete', false));
      for (const [x0, z0, x1, z1] of [[hole.x0 - W, hole.z1 + W - 0.15, hole.x1 + W, hole.z1 + W], [hole.x0 - W, hole.z0 - W, hole.x1 + W, hole.z0 - W + 0.15], [hole.x0 - W, hole.z0 - W, hole.x0 - W + 0.15, hole.z1 + W], [hole.x1 + W - 0.15, hole.z0 - W, hole.x1 + W, hole.z1 + W]] as const) {
        cell.boxes.push(box([x0, yy, z0], [x1, yy + 2.8, z1], 'wallConcrete', false));
      }
      // 暗い出入り口（奥の壁の黒い四角）
      cell.boxes.push(box([x - 0.5, yy, hole.z1 + W - 0.17], [x + 0.5, yy + 2.1, hole.z1 + W - 0.15], 'void', false));
      cell.boxes.push(box([x - 0.5, yy, hole.z0 - W + 0.15], [x + 0.5, yy + 2.1, hole.z0 - W + 0.17], 'void', false));
      if (Math.abs(k) <= 2 && rng.chance(0.75)) {
        const lx = rng.chance(0.5) ? hole.x0 - W / 2 : hole.x1 + W / 2;
        cell.boxes.push(box([lx - 0.3, yy + 2.75, z - 0.3], [lx + 0.3, yy + 2.8, z + 0.3], 'lightPanel', false));
        cell.lights.push({ pos: [lx, yy + 2.4, z], color: 0xdfe6f0, intensity: 0.45, distance: 7 });
      }
    }
    // 底（水）と天窓
    cell.boxes.push(box([hole.x0, bottom - 0.2, hole.z0], [hole.x1, bottom + 0.3, hole.z1], 'water', false));
    cell.boxes.push(box([hole.x0 + 0.5, top - 0.05, hole.z0 + 0.5], [hole.x1 - 0.5, top, hole.z1 - 0.5], 'skyOvercast', false));
    cell.lights.push({ pos: [x, top - 1, z], color: 0xc8d0dc, intensity: 0.5, distance: 14 });
    gb.out.cells.push({ cell, kind: 'junction', openings: [], node: -1 });
    gb.reserved.add(voidId);
    gb.keep(voidId, { min: [hole.x0, bottom - 1, hole.z0], max: [hole.x1, top, hole.z1] });
    for (const d of [0, 1, 2, 3] as Dir[]) {
      const coord = d === 0 ? hole.z0 : d === 2 ? hole.z1 : d === 1 ? hole.x0 : hole.x1;
      const axis: 'x' | 'z' = d === 0 || d === 2 ? 'z' : 'x';
      const at = axis === 'z' ? x : z;
      gb.out.portals.push(portal(`p:${pl.cellId}:${voidId}:${d}`, pl.cellId, voidId, portalAabb(axis, coord, at, 2 * vh - 0.2, y, pl.height), d, 'window'));
    }
    // 飛び込んだ先: 2 つ先のフロア
    gb.out.exits.push({ id: 'shaft', kind: 'hole', aabb: { min: [hole.x0, bottom + 0.3, hole.z0], max: [hole.x1, y - SH * 1.5, hole.z1] }, to: { floor: `${gb.p.key.depth + 2}.0` } });
  });
}

// ---------------------------------------------------------------- 巨大空間の中の建物（F18）
const BUILDING_THEME: Record<string, string> = {
  office: 'OfficeGrid', school: 'Classroom', hospital: 'SmallRoom', backrooms: 'GenericRoom', service: 'StorageGrid', transit: 'RetailRoom',
  mall: 'RetailRoom', library: 'ShelfGrid', pool: 'LockerRoom', apartment: 'GenericRoom', warehouse: 'SmallRoom', entertainment: 'SmallRoom', underground: 'RetailRoom',
};

function mega(g: GeoBuild, pl: Placed, rng: Rng): void {
  const t = g.t;
  pl.height = snap(t['structure.megahall.heightM'] * rng.float(0.9, 1.1));
  pl.opts = { ...(pl.opts ?? {}), name: '巨大な空間', lightSpacing: 4.5 };
  g.reserved.add(pl.cellId);
  const r = pl.rect;
  const W = r.x1 - r.x0, D = r.z1 - r.z0;
  const bw = snap(Math.max(4.4, Math.min(8.5, W - 9))), bd = snap(Math.max(4.0, Math.min(6.5, D - 9)));
  const mx = Math.max(0, (W - bw) / 2 - 4.2), mz = Math.max(0, (D - bd) / 2 - 4.2);
  const cx = snap((r.x0 + r.x1) / 2 + rng.float(-mx, mx)), cz = snap((r.z0 + r.z1) / 2 + rng.float(-mz, mz));
  const hole: Rect = { x0: snap(cx - bw / 2), x1: snap(cx + bw / 2), z0: snap(cz - bd / 2), z1: snap(cz + bd / 2) };
  const theme = BUILDING_THEME[pl.fam.id] ?? 'SmallRoom';
  const house = theme === 'GenericRoom' || theme === 'SmallRoom';
  const bh = t['structure.building.heightM'];
  const inner = carveInner(g, pl, hole, { node: { ...pl.node, id: -1, kind: 'room', style: undefined }, y: pl.y, height: bh, theme, kind: 'room', cellId: `${pl.cellId}b`, fam: pl.fam, opts: { name: house ? '家' : '小屋', role: 'side' } }, house ? 'sidingWood' : 'sidingMetal');
  // 扉: 広間の真ん中を向く辺。窓: 残りの辺から 2 つ
  const toward = (d: Dir): number => (d === 0 ? r.z1 - hole.z1 : d === 2 ? hole.z0 - r.z0 : d === 1 ? r.x1 - hole.x1 : hole.x0 - r.x0);
  const sides = ([0, 1, 2, 3] as Dir[]).sort((a, b) => toward(b) - toward(a));
  const doorSide = sides[0]!;
  const mid = (d: Dir): number => (d === 0 || d === 2 ? cx : cz);
  holeJoin(g, pl, inner, doorSide, mid(doorSide), pl.y, { mat: house ? 'doorWood' : 'doorMetal' });
  for (const d of sides.slice(1, 3)) {
    const len = d === 0 || d === 2 ? bw : bd;
    if (len < 3.2) continue;
    holeWindow(g, pl, inner, d, mid(d), pl.y, Math.min(1.8, len - 1.6));
  }
  // 扉の前は空ける・照明を強く（天井が高い）
  const fr = doorSide === 0 ? { min: [cx - 1, pl.y, hole.z1], max: [cx + 1, pl.y + 3, hole.z1 + 2.2] } : doorSide === 2 ? { min: [cx - 1, pl.y, hole.z0 - 2.2], max: [cx + 1, pl.y + 3, hole.z0] } : doorSide === 1 ? { min: [hole.x1, pl.y, cz - 1], max: [hole.x1 + 2.2, pl.y + 3, cz + 1] } : { min: [hole.x0 - 2.2, pl.y, cz - 1], max: [hole.x0, pl.y + 3, cz + 1] };
  g.keep(pl.cellId, fr as AABB);
  (pl.post ??= []).push((cell) => { for (const l of cell.lights) { l.distance = pl.height * 1.7; l.intensity *= 1.4; } });
}

// ---------------------------------------------------------------- 入れ子の部屋（F17）
function nest(g: GeoBuild, pl: Placed, rng: Rng): void {
  const depth = g.t['structure.nest.depth'];
  pl.opts = { ...(pl.opts ?? {}), name: '大部屋' };
  g.reserved.add(pl.cellId);
  let outer = pl;
  const heights = [Math.max(pl.height, 4.2), 3.3, 2.5, 2.2];
  outer.height = heights[0]!;
  let side = rng.int(0, 3) as Dir;
  for (let k = 1; k < depth; k++) {
    const r = outer.rect;
    const inset = Math.min(3.0, (Math.min(r.x1 - r.x0, r.z1 - r.z0) - 3.2) / 2);
    if (inset < 1.6) break;
    const hole: Rect = { x0: snap(r.x0 + inset), x1: snap(r.x1 - inset), z0: snap(r.z0 + inset), z1: snap(r.z1 - inset) };
    const last = k === depth - 1 || Math.min(hole.x1 - hole.x0, hole.z1 - hole.z0) - 2 * 3.0 < 3.2;
    const inner = carveInner(g, outer, hole, { node: { ...pl.node, id: -1, kind: 'room', style: undefined }, y: pl.y, height: heights[k]!, theme: last ? 'ApartmentCorridor' : pl.theme, kind: last ? 'room' : 'hall', cellId: `${pl.cellId}n${k}`, fam: pl.fam, opts: { name: last ? 'いちばん奥の小部屋' : '中の部屋', role: last ? 'side' : 'rest' } });
    g.reserved.add(inner.cellId);
    // 輪の部屋は、中の部屋のまわりを一周できるように、帯の真ん中を空ける（家具で塞がない）
    const band = Math.min(1.4, inset - 0.6);
    for (const [x0, z0, x1, z1] of [[r.x0, r.z0, r.x1, r.z0 + inset], [r.x0, r.z1 - inset, r.x1, r.z1], [r.x0, r.z0, r.x0 + inset, r.z1], [r.x1 - inset, r.z0, r.x1, r.z1]] as const) {
      const wide = x1 - x0 > z1 - z0;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      g.keep(outer.cellId, wide ? { min: [x0 + inset / 2, pl.y, cz - band / 2], max: [x1 - inset / 2, pl.y + 3, cz + band / 2] } : { min: [cx - band / 2, pl.y, z0 + inset / 2], max: [cx + band / 2, pl.y + 3, z1 - inset / 2] });
    }
    const at = side === 0 || side === 2 ? snap((hole.x0 + hole.x1) / 2 + rng.float(-1, 1) * Math.max(0, (hole.x1 - hole.x0) / 2 - 1.4)) : snap((hole.z0 + hole.z1) / 2 + rng.float(-1, 1) * Math.max(0, (hole.z1 - hole.z0) / 2 - 1.4));
    holeJoin(g, outer, inner, side, at, pl.y, { mat: themePalette(inner.theme).door });
    if (last) {
      // いちばん奥: 入口を向いた椅子が 1 脚と、床の灯り。ほかには何も無い
      const hr = hole;
      g.keep(inner.cellId, { min: [hr.x0, pl.y, hr.z0], max: [hr.x1, pl.y + 3, hr.z1] });
      (inner.post ??= []).push((cell) => {
        const cx = (hr.x0 + hr.x1) / 2, cz = (hr.z0 + hr.z1) / 2, y = pl.y;
        cell.boxes.push(box([cx - 0.24, y, cz - 0.24], [cx + 0.24, y + 0.45, cz + 0.24], 'upholstery'));
        const back = side === 0 ? [cz - 0.24, cz - 0.18] : side === 2 ? [cz + 0.18, cz + 0.24] : null;
        if (back) cell.boxes.push(box([cx - 0.24, y + 0.45, back[0]!], [cx + 0.24, y + 0.95, back[1]!], 'upholstery'));
        else { const bx = side === 1 ? [cx - 0.24, cx - 0.18] : [cx + 0.18, cx + 0.24]; cell.boxes.push(box([bx[0]!, y + 0.45, cz - 0.24], [bx[1]!, y + 0.95, cz + 0.24], 'upholstery')); }
        cell.boxes.push(box([cx + 0.7, y, cz + 0.7], [cx + 0.82, y + 1.3, cz + 0.82], 'metalDark'), box([cx + 0.6, y + 1.3, cz + 0.6], [cx + 0.92, y + 1.55, cz + 0.92], 'lightWarm', false));
        cell.lights = [{ pos: [cx + 0.76, y + 1.4, cz + 0.76], color: 0xffb870, intensity: 0.55, distance: 5 }];
        for (const b of cell.boxes) if (b.mat === cell.palette.light && !b.solid) b.mat = 'lightOff';
      });
      break;
    }
    outer = inner;
    side = ((side + 2) % 4) as Dir;
  }
}

// ---------------------------------------------------------------- 中二階（F14）
function gallery(g: GeoBuild, pl: Placed, sk: Skeleton, e: StyleEnv, rng: Rng): void {
  const t = g.t;
  g.reserved.add(pl.cellId);
  pl.opts = { ...(pl.opts ?? {}), name: '吹き抜けの広間', role: 'landmark' };
  const members = sk.nodes.filter((m) => m.kind === 'hall' && m.hall === pl.node.hall);
  const levels = [...new Set(members.map((m) => e.yOf(m)))].filter((y) => y > pl.y + 0.5).sort((a, b) => a - b);
  if (!levels.length) return;
  const r = pl.rect;
  const DW = 2.2;
  const rail = t['structure.railM'];
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const yU = levels[0]!;
  const rise = yU - pl.y;
  const n = Math.ceil(rise / RISER_MAX - 1e-9);
  const riser = rise / n;
  const run = n * TREAD;
  // 階段: 長い辺の一方の、回廊の内側の縁に沿って上る。上の端に回廊とつながる踊り場
  const longSide = rng.chance(0.5) ? 1 : -1;
  const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
  const dirUp = rng.chance(0.5) ? 1 : -1;
  const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
  const startA = dirUp > 0 ? a0 + DW + 1.0 : a1 - DW - 1.0;
  const endA = startA + dirUp * run;
  const lat0 = alongX ? (longSide > 0 ? r.z1 - WALL_T - DW - 1.2 : r.z0 + WALL_T + DW) : (longSide > 0 ? r.x1 - WALL_T - DW - 1.2 : r.x0 + WALL_T + DW);
  const lat1 = lat0 + 1.2;
  if (run + 2 * (DW + 1.0) > len) return;
  const B = (a0b: number, a1b: number, l0: number, l1: number, y0: number, y1: number, mat: MatId, kind?: string, solid = true): Box => {
    const p = Math.min(a0b, a1b), q = Math.max(a0b, a1b);
    const b = alongX ? box([p, y0, l0], [q, y1, l1], mat, solid) : box([l0, y0, p], [l1, y1, q], mat, solid);
    if (kind) b.kind = kind;
    return b;
  };
  // 段の足元は空ける
  const foot = B(startA - dirUp * 1.6, startA + dirUp * run, lat0 - 0.4, lat1 + 0.4, pl.y, pl.y + 3, 'void');
  g.keep(pl.cellId, { min: foot.min, max: foot.max });
  (pl.post ??= []).push((cell) => {
    const pal = cell.palette;
    for (const yy of levels) {
      // 回廊（壁沿いの 4 本の帯）と、内側の縁の手すり（ガラスの腰壁 + 笠木）
      const inner: Rect = { x0: r.x0 + WALL_T + DW, x1: r.x1 - WALL_T - DW, z0: r.z0 + WALL_T + DW, z1: r.z1 - WALL_T - DW };
      const strips: [number, number, number, number][] = [
        [r.x0 + WALL_T, r.z0 + WALL_T, r.x1 - WALL_T, inner.z0], [r.x0 + WALL_T, inner.z1, r.x1 - WALL_T, r.z1 - WALL_T],
        [r.x0 + WALL_T, inner.z0, inner.x0, inner.z1], [inner.x1, inner.z0, r.x1 - WALL_T, inner.z1],
      ];
      for (const [x0, z0, x1, z1] of strips) {
        const b = box([x0, yy - 0.25, z0], [x1, yy, z1], pal.floor);
        b.kind = 'landing';
        cell.boxes.push(b);
        // 回廊の下の灯り
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        cell.lights.push({ pos: [mx, yy - 0.6, mz], color: pal.lightColor, intensity: pal.lightIntensity * 0.6, distance: 6 });
        cell.boxes.push(box([mx - 0.3, yy - 0.29, mz - 0.3], [mx + 0.3, yy - 0.25, mz + 0.3], pal.light, false));
      }
      // 手すり: 内側の縁。階段の上の踊り場の所だけ切る
      const landA0 = Math.min(endA, endA + dirUp * 1.2), landA1 = Math.max(endA, endA + dirUp * 1.2);
      const edges: { a: 'x' | 'z'; c: number; lo: number; hi: number; side: number }[] = [
        { a: 'x', c: inner.z0, lo: inner.x0, hi: inner.x1, side: -1 }, { a: 'x', c: inner.z1, lo: inner.x0, hi: inner.x1, side: 1 },
        { a: 'z', c: inner.x0, lo: inner.z0, hi: inner.z1, side: -1 }, { a: 'z', c: inner.x1, lo: inner.z0, hi: inner.z1, side: 1 },
      ];
      for (const ed of edges) {
        const cut = yy === yU && ((alongX && ed.a === 'x' && ed.side === longSide) || (!alongX && ed.a === 'z' && ed.side === longSide)) ? [landA0, landA1] : null;
        const parts: [number, number][] = cut ? [[ed.lo, cut[0]], [cut[1], ed.hi]] : [[ed.lo, ed.hi]];
        for (const [p, q] of parts) {
          if (q - p < 0.05) continue;
          const t0 = ed.side > 0 ? ed.c - 0.05 : ed.c, t1 = ed.side > 0 ? ed.c : ed.c + 0.05;
          cell.boxes.push(ed.a === 'x' ? box([p, yy, t0], [q, yy + rail, t1], 'glass') : box([t0, yy, p], [t1, yy + rail, q], 'glass'));
          cell.boxes.push(ed.a === 'x' ? box([p, yy + rail, t0 - 0.02], [q, yy + rail + 0.05, t1 + 0.02], 'metal', false) : box([t0 - 0.02, yy + rail, p], [t1 + 0.02, yy + rail + 0.05, q], 'metal', false));
        }
      }
    }
    // 階段（いちばん下の回廊へ）: 段・上の踊り場・外側の手すり（ガラス）
    for (let i = 1; i <= n; i++) {
      const top = pl.y + i * riser;
      const s0 = startA + dirUp * (i - 1) * TREAD, s1 = startA + dirUp * i * TREAD;
      cell.boxes.push(B(s0, s1, lat0, lat1, Math.max(pl.y, top - 0.3), top, pal.floor, 'stairStep'));
      const out = longSide > 0 ? [lat0 - 0.05, lat0] : [lat1, lat1 + 0.05];
      cell.boxes.push(B(s0, s1, out[0]!, out[1]!, top, top + rail, 'glass'));
    }
    cell.boxes.push(B(endA, endA + dirUp * 1.2, lat0, lat1 + (longSide > 0 ? 1.2 : -1.2) * 0, yU - 0.25, yU, pal.floor, 'landing'));
    const capL = longSide > 0 ? [lat0 - 0.05, lat0] : [lat1, lat1 + 0.05];
    cell.boxes.push(B(endA, endA + dirUp * 1.2, capL[0]!, capL[1]!, yU, yU + rail, 'glass'));
    cell.boxes.push(B(endA + dirUp * 1.2, endA + dirUp * 1.25, lat0, lat1, yU, yU + rail, 'glass'));
  });
}

// ---------------------------------------------------------------- 立体交差（F15）: 上の曲がり角の床はガラス、下は天井が抜ける
function glassFloor(g: GeoBuild, up: Placed, sk: Skeleton, placed: Map<number, Placed>, e: StyleEnv): void {
  const below = sk.nodes.find((m) => m.col === up.node.col && m.row === up.node.row && m.story === up.node.story + 1 && m.style === 'underpass');
  const lo = below ? placed.get(below.id) : undefined;
  if (!lo) return;
  g.reserved.add(up.cellId);
  g.reserved.add(lo.cellId);
  const r = up.rect;
  lo.rect = { ...r };
  lo.height = snap(up.y - lo.y - 0.4);
  lo.opts = { ...(lo.opts ?? {}), noCeiling: true, lights: 'none', name: '交差の下' };
  up.opts = { ...(up.opts ?? {}), name: '交差の上（ガラスの床）' };
  (up.post ??= []).push((cell) => {
    for (const b of cell.boxes) if (b.solid && Math.abs(b.max[1] - up.y) < 1e-3 && b.max[1] - b.min[1] <= 0.25) b.mat = 'glass';
    cell.boxes.push(box([r.x0 + WALL_T, up.y - 0.25, r.z0 + WALL_T], [r.x1 - WALL_T, up.y - 0.2, r.z1 - WALL_T], 'metal', false));
  });
  (lo.post ??= []).push((cell) => {
    // 天井の代わりに、上の床までの壁の帯（すきまから外が見えないように）と、壁の灯り
    const y0 = lo.y + lo.height, y1 = up.y - 0.2;
    for (const [x0, z0, x1, z1] of [[r.x0, r.z0, r.x1, r.z0 + WALL_T], [r.x0, r.z1 - WALL_T, r.x1, r.z1], [r.x0, r.z0, r.x0 + WALL_T, r.z1], [r.x1 - WALL_T, r.z0, r.x1, r.z1]] as const) cell.boxes.push(box([x0, y0, z0], [x1, y1, z1], cell.palette.wall));
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    cell.lights.push({ pos: [cx, lo.y + 2.2, cz], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity * 0.7, distance: 6 });
    cell.boxes.push(box([r.x0 + WALL_T, lo.y + 2.4, cz - 0.3], [r.x0 + WALL_T + 0.05, lo.y + 2.55, cz + 0.3], cell.palette.light, false));
  });
  g.finishers.push((gb) => {
    gb.out.portals.push(portal(`p:${up.cellId}:${lo.cellId}:glass`, up.cellId, lo.cellId, { min: [r.x0 + WALL_T, up.y - 0.45, r.z0 + WALL_T], max: [r.x1 - WALL_T, up.y + 0.05, r.z1 - WALL_T] }, 2, 'window'));
  });
  void e;
}

// ---------------------------------------------------------------- 島（F16）
function island(g: GeoBuild, pl: Placed, sk: Skeleton): void {
  const t = g.t;
  const r = pl.rect, y = pl.y;
  if (pl.kind === 'junction') {
    const env = outdoorEnv(sk.below === 'water' ? 'water' : 'void');
    pl.opts = { ...(pl.opts ?? {}), noCeiling: true, lights: 'none', palette: { floor: 'metalDark', wall: 'metal', ambient: env.ambient, fog: env.fog }, render: env.render, lighting: env.lighting, name: '足場', audio: '低いハム' };
    pl.preBuild = [...(pl.preBuild ?? []), (p) => addRailings(g, p.cellId, [p.rect], y, p.height, t['structure.railM'])];
    (pl.post ??= []).push((cell) => {
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      lampPost(cell.boxes, r.x0 + 0.2, r.z0 + 0.2, y + t['structure.railM'], y + 2.5, 'lightWarm');
      cell.lights.push({ pos: [cx, y + 2.3, cz], color: 0xffc890, intensity: 0.5, distance: 6 });
    });
  }
  // 島の下の柱（奈落・水へ下りていく）
  (pl.post ??= []).push((cell) => {
    const s = pl.kind === 'junction' ? 0.2 : 0.35;
    for (const [x, z] of [[r.x0 + 0.4, r.z0 + 0.4], [r.x1 - 0.4, r.z0 + 0.4], [r.x0 + 0.4, r.z1 - 0.4], [r.x1 - 0.4, r.z1 - 0.4]] as const) cell.boxes.push(box([x - s, y - 9.5, z - s], [x + s, y - 0.2, z + s], 'columnConcrete', false));
    if (pl.kind !== 'junction') cell.boxes.push(box([r.x0, y - 0.8, r.z0], [r.x1, y - 0.2, r.z1], 'wallConcrete', false));
  });
}

export { aabbJson };
