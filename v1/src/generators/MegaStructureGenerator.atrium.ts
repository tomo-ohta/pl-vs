/** MegaAtrium（吹抜 + 多層回廊 + ゾーン）。L04 ホテル / L05 学園 / L07 垂直オフィス / L09 温浴 / L11 環状モノレール駅 / L14 温室 / L19 凍結リゾート。
 *  共通: 階高 3.6 m、各階の外周回廊（幅 4.5 m、吹抜側に手すり 1.05 m）、吹抜を横断する橋、壁沿いの直階段（20 段 × 0.18）で全階へ歩いて到達。
 *  出口は地上の外壁 + 上階の回廊外壁（Opening.y）。内部リフトは作らない（EV ソケットは出口専用。L04 / L07）。
 *  ゾーンは地上階を用途別に分け kind 'theme' で出す（ZoneThemeShuffle / 地図の内訳線の受け皿）。構造はシェル側、家具は内装側。 */
import type { Dir, Socket, Vec3 } from '../core/types';
import type { Rng } from '../core/rng';
import { inner, pickSpanPosition, rect, rectArea, socketOnSpan, wallSpans, type Rect } from './footprint';
import { bonusExits, box, snap, WIDE_W, type GenParams, type MatId, type RoomLayout } from './layout';
import {
  blocked, buildGalleries, buildStairs, columnGrid, commitShell, courtyardEdges, createCtx, dims, elevatorCage, entryShift, exteriorEdges, fakeDoors, finish, floorSheet, FLOOR,
  furnishIslands, furnishPerimeter, furnishRows, galleryLights, hangingLights, inwardOf, mergeExtraSockets, partition, placeExitsOn, remaining, reserve, sizeIdxOf, themeZone, waterBasin,
  type GalleryW, type MegaCtx,
} from './MegaStructureGenerator.common';

type AtriumKind = 'hotel' | 'campus' | 'office' | 'bath' | 'ring' | 'greenhouse' | 'resort';

function kindOf(p: GenParams, vr: Rng): AtriumKind {
  switch (p.def.id) {
    case 'L04': return 'hotel';
    case 'L05': return 'campus';
    case 'L07': return 'office';
    case 'L09': return 'bath';
    case 'L11': return 'ring';
    case 'L14': return 'greenhouse';
    case 'L19': return 'resort';
    default: return vr.pick(['hotel', 'campus', 'greenhouse']);
  }
}

/** 部屋種別ごとの平面計画 */
interface Plan {
  rects: Rect[];
  main: Rect;
  levels: number;
  h: number;
  palette: Partial<RoomLayout['palette']>;
  gallery: (r: Rect, level: number) => boolean[] | null;
  gw: GalleryW;
  bridges: (level: number) => number;
  stairDirs?: (r: Rect, dir: Dir) => boolean;
  stairsPerLevel: number;
  /** 上階に置く出口の割合 */
  upperShare: number;
  exitPred?: (r: Rect, dir: Dir) => boolean;
  exitWidth?: number;
  elevators: number;
  slabMat: MatId;
  railMat: MatId;
  stairMat: MatId;
}

export function generateMegaAtrium(p: GenParams): RoomLayout {
  const vr = p.rng.fork(`v${p.variant}`);
  const kind = kindOf(p, vr);
  const plan = planFor(kind, p, vr);
  const { rects, main } = plan;
  const area = rects.reduce((a, r) => a + rectArea(r), 0);
  const exits = Math.min(6, Math.max(2, Math.max(p.exits, p.def.minExits) + bonusExits(area)));
  const upper = plan.levels > 1 ? Math.min(exits - 1, Math.round(exits * plan.upperShare)) : 0;

  const { c, entry, ceilingHole } = createCtx(p, vr, {
    rects, main, h: plan.h, levels: plan.levels, groundExits: exits - upper, exitPred: plan.exitPred, exitWidth: plan.exitWidth, exitHeight: plan.exitWidth ? 2.4 : undefined, holeChance: 0.2, palette: plan.palette,
  });
  // 上階の出口（回廊のある辺だけ）
  const levelYs = Array.from({ length: plan.levels - 1 }, (_, i) => (i + 1) * FLOOR);
  if (upper > 0) placeExitsOn(c, upper, levelYs, (r, dir, level) => (plan.gallery(r, level)?.[dir] ?? false) && (!plan.exitPred || plan.exitPred(r, dir)), 'up', vr);
  // エレベーター（出口専用。地上の外壁）
  for (let i = 0; i < plan.elevators; i++) placeElevator(c, vr, plan.exitPred, i);

  // ---- 構造: 階段 → 回廊 / 橋 → 部屋別の構造（直結ソケットはここで合流。階段・家具は扉前を避ける）
  mergeExtraSockets(c);
  buildStairs(c, plan.gallery, plan.stairMat, vr, plan.stairsPerLevel, plan.stairDirs);
  if (kind === 'ring') buildStairs(c, plan.gallery, plan.stairMat, vr, plan.stairsPerLevel, plan.stairDirs);
  buildGalleries(c, { gallery: plan.gallery, gw: plan.gw, bridgesPerLevel: plan.bridges, floorMat: plan.slabMat, railMat: plan.railMat });
  const zones = structureFor(kind, c, plan);
  const shellCount = commitShell(c, ceilingHole);
  if (kind === 'ring') recolorCourtyardWalls(c, shellCount, 'windowDark');

  // ---- 内装（ゾーンごとの家具・偽扉・照明）
  furnishFor(kind, c, plan, zones);

  return finish(c, entry, shellCount, { fogFar: kind === 'office' ? 60 : kind === 'resort' ? 80 : undefined, labelWidth: 3.0 });
}

// ---------------------------------------------------------------- 平面計画

function planFor(kind: AtriumKind, p: GenParams, vr: Rng): Plan {
  const v = p.variant;
  const sizeIdx = sizeIdxOf(v);
  const mainOf = (w: number, d: number): Rect => (p.mainRect ? rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1) : rect(-w / 2 - entryShift(v, w), 0, w / 2 - entryShift(v, w), d));
  const all = (r: Rect, rects: Rect[]) => exteriorEdges(r, rects);
  switch (kind) {
    case 'hotel': {
      const { w, d } = dims(v, vr, 0.62);
      const main = mainOf(w, d);
      const rects = [main];
      const levels = Math.max(3, Math.min(5, 5 - sizeIdx));
      return {
        rects, main, levels, h: levels * FLOOR + 1.8,
        palette: { floor: 'floorCarpetRed', wall: 'wallBeige', ceiling: 'ceilingWhite', door: 'doorWood', light: 'lightWarm', lightColor: 0xffd9a0, ambient: 0x8f7a60 },
        gallery: (r) => all(r, rects), gw: 4.5, bridges: (k) => (k % 2 === 0 && w > 70 ? 2 : 1), stairsPerLevel: 2, upperShare: 0.6, elevators: 1,
        slabMat: 'floorCarpetRed', railMat: 'metal', stairMat: 'floorCarpetRed',
      };
    }
    case 'campus': {
      const { w, d } = dims(v, vr, 0.8);
      const main = mainOf(w, d);
      const rects = [main];
      return {
        rects, main, levels: 2, h: 2 * FLOOR + 2.4,
        palette: { floor: 'floorLino', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood', light: 'lightPanel', lightColor: 0xe9f0ff },
        gallery: (r) => all(r, rects), gw: 4.5, bridges: () => (w > 80 ? 2 : 1), stairsPerLevel: 2, upperShare: 0.4, elevators: 0,
        slabMat: 'floorLino', railMat: 'metal', stairMat: 'floorConcrete',
      };
    }
    case 'office': {
      const dm = dims(v, vr, 0.6, [88, 72, 60, 48, 40][sizeIdx]);
      const w = dm.d; // 短辺 = X（入口の辺）
      const d = dm.w; // 長辺 = Z
      const main = mainOf(w, d);
      const rects = [main];
      const levels = Math.max(4, Math.min(6, 7 - sizeIdx));
      // オフィス帯（奥行 6 m + 歩廊 3.5 m）は西の長辺だけ。東の長辺・短辺は通常の回廊（出口・階段はそちら）
      const officeDir: Dir = 3;
      return {
        rects, main, levels, h: levels * FLOOR + 1.8,
        palette: { floor: 'floorCarpetGrey', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorWood', light: 'lightPanel', lightColor: 0xe9f0ff, ambient: 0x8a90a0 },
        gallery: (r) => all(r, rects), gw: [4.5, 4.5, 4.5, 9.5], bridges: (k) => (k % 2 === 0 ? 2 : 1), stairsPerLevel: 2, stairDirs: (_r, dir) => dir !== officeDir,
        upperShare: 0.7, exitPred: (_r, dir) => dir !== officeDir, elevators: 2,
        slabMat: 'floorCarpetGrey', railMat: 'metal', stairMat: 'floorConcrete',
      };
    }
    case 'bath': {
      const { w, d } = dims(v, vr, 0.75);
      const main = mainOf(w, d);
      const rects = [main];
      return {
        rects, main, levels: 2, h: 2 * FLOOR + 2.4,
        palette: { floor: 'floorTile', wall: 'wallCream', ceiling: 'ceilingWhite', door: 'doorWood', light: 'lightWarm', lightColor: 0xffd9a0, ambient: 0x8f7a60 },
        gallery: (r) => all(r, rects), gw: 4.5, bridges: () => 1, stairsPerLevel: 2, upperShare: 0.3, elevators: 0,
        slabMat: 'floorWood', railMat: 'furnitureDark', stairMat: 'floorWood',
      };
    }
    case 'ring': {
      // 環状 footprint（4 矩形）。主矩形 = 南の帯（入口）
      let S: number;
      let B: number;
      let x0: number;
      if (p.mainRect) {
        S = p.mainRect.x1 - p.mainRect.x0;
        B = p.mainRect.z1 - p.mainRect.z0;
        x0 = p.mainRect.x0;
      } else {
        S = snap([160, 120, 96, 72, 60][sizeIdx] * vr.float(0.92, 1.08));
        B = snap(Math.max(12, Math.min(18, S * 0.11)));
        x0 = -S / 2 - entryShift(v, S);
      }
      const x1 = x0 + S;
      const south = rect(x0, 0, x1, B);
      const north = rect(x0, S - B, x1, S);
      const west = rect(x0, B, x0 + B, S - B);
      const east = rect(x1 - B, B, x1, S - B);
      const rects = [south, north, west, east];
      const courtyard = (r: Rect, dir: Dir) => courtyardEdges(r, rects)[dir];
      return {
        rects, main: south, levels: 2, h: 2 * FLOOR + 2.4,
        palette: { floor: 'floorTile', wall: 'wallDark', ceiling: 'ceilingDark', door: 'doorMetal', light: 'ledBlue', lightColor: 0x9fc8ff, ambient: 0x353a4c, fog: 0x04050a },
        gallery: (r) => courtyardEdges(r, rects), gw: 4.0, bridges: () => 0, stairsPerLevel: 4, stairDirs: courtyard,
        upperShare: 0, exitPred: (r, dir) => !courtyard(r, dir), exitWidth: WIDE_W, elevators: 0,
        slabMat: 'floorConcrete', railMat: 'metal', stairMat: 'floorConcrete',
      };
    }
    case 'greenhouse': {
      const { w, d } = dims(v, vr, 0.9);
      const main = mainOf(w, d);
      const rects = [main];
      return {
        rects, main, levels: 2, h: 2 * FLOOR + 3.0,
        palette: { floor: 'floorConcrete', wall: 'wallWhite', ceiling: 'glass', door: 'doorMetal', light: 'lightWarm', lightColor: 0xffe2b0, ambient: 0x9aa08a },
        gallery: (r) => all(r, rects), gw: 4.5, bridges: () => (w > 70 ? 3 : 2), stairsPerLevel: 2, upperShare: 0.4, elevators: 0,
        slabMat: 'floorConcrete', railMat: 'metal', stairMat: 'floorConcrete',
      };
    }
    case 'resort': {
      // 主矩形 + ホテル翼で全幅 ≈ SIZE_SCALE になるよう主矩形は 0.76 倍
      const { w, d } = dims(v, vr, 0.7, [122, 91, 73, 55, 46][sizeIdx]);
      const main = mainOf(w, d);
      const rects = [main];
      let wing: Rect | null = null;
      if (!p.mainRect) {
        const ww = snap(Math.max(20, w * 0.35));
        const wd = snap(Math.max(20, d * 0.6));
        wing = vr.chance(0.5) ? rect(main.x1, d - wd, main.x1 + ww, d) : rect(main.x0 - ww, d - wd, main.x0, d);
        rects.push(wing);
      }
      return {
        rects, main, levels: 2, h: 2 * FLOOR + 2.4,
        palette: { floor: 'floorConcrete', wall: 'wallWhite', ceiling: 'ceilingWhite', door: 'doorWood', light: 'lightPanel', lightColor: 0xdfe7ee, ambient: 0x8a94a4, fog: 0xdfe7ee },
        gallery: (r) => (wing && r === wing ? exteriorEdges(r, rects) : null), gw: 4.5, bridges: () => 0, stairsPerLevel: 2, upperShare: wing ? 0.4 : 0, elevators: 0,
        slabMat: 'floorCarpetRed', railMat: 'metal', stairMat: 'floorCarpetRed',
      };
    }
  }
}

/** エレベーターソケット（地上の外壁）+ 籠 */
function placeElevator(c: MegaCtx, rng: Rng, pred: ((r: Rect, dir: Dir) => boolean) | undefined, index: number): void {
  const spans = wallSpans(c.rects).filter((sp) => sp.a1 - sp.a0 >= 6 && (!pred || pred(sp.edge.rect, sp.edge.dir)));
  for (let tries = 0; tries < 10 && spans.length > 0; tries++) {
    const span = rng.weighted(spans, (s) => s.a1 - s.a0);
    const t = pickSpanPosition(span, c.sockets, 1.2, rng.next(), 1.5);
    if (t === null) continue;
    const s: Socket = socketOnSpan(`elev${index}`, 'elevator', span, t, 1.2, 2.2, 0);
    c.sockets.push(s);
    elevatorCage(c, s);
    // 籠の前を予約（家具・間仕切りを置かない）
    const inward = inwardOf(s.dir);
    reserve(c, rect(s.pos[0] + inward[0] * 1.2 - 1.2, s.pos[2] + inward[1] * 1.2 - 1.2, s.pos[0] + inward[0] * 1.2 + 1.2, s.pos[2] + inward[1] * 1.2 + 1.2), 0, 2.6);
    return;
  }
}

/** 中庭側の外壁を別材質に（L11 の夜景窓） */
function recolorCourtyardWalls(c: MegaCtx, shellCount: number, mat: MatId): void {
  const L = c.L;
  const wallMat = L.palette.wall;
  for (let i = 0; i < shellCount; i++) {
    const b = L.boxes[i];
    if (b.mat !== wallMat) continue;
    const thin = Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) < 0.2;
    if (!thin) continue;
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    for (const r of c.rects) {
      const cy = courtyardEdges(r, c.rects);
      if (cy[0] && Math.abs(b.max[2] - r.z1) < 0.01 && cx > r.x0 && cx < r.x1) b.mat = mat;
      if (cy[2] && Math.abs(b.min[2] - r.z0) < 0.01 && cx > r.x0 && cx < r.x1) b.mat = mat;
      if (cy[1] && Math.abs(b.max[0] - r.x1) < 0.01 && cz > r.z0 && cz < r.z1) b.mat = mat;
      if (cy[3] && Math.abs(b.min[0] - r.x0) < 0.01 && cz > r.z0 && cz < r.z1) b.mat = mat;
    }
  }
}

// ---------------------------------------------------------------- 構造（部屋別）

interface ZoneInfo {
  rect: Rect;
  theme: string;
  name: string;
}

function structureFor(kind: AtriumKind, c: MegaCtx, plan: Plan): ZoneInfo[] {
  switch (kind) {
    case 'hotel': return structureHotel(c);
    case 'campus': return structureCampus(c);
    case 'office': return structureOffice(c, plan);
    case 'bath': return structureBath(c);
    case 'ring': return structureRing(c);
    case 'greenhouse': return structureGreenhouse(c);
    case 'resort': return structureResort(c);
  }
}

/** 吹抜の床（地上階の回廊の内側）。ゾーンはこの中に置く */
function voidRect(c: MegaCtx, gw = 4.5, margin = 1.0): Rect {
  return inner(c.main, gw + margin);
}

/** 主矩形の内側を x 方向に n 分割（境界は 0.5 m スナップ） */
function splitX(r: Rect, n: number): Rect[] {
  const out: Rect[] = [];
  const w = (r.x1 - r.x0) / n;
  for (let i = 0; i < n; i++) out.push(rect(i === 0 ? r.x0 : snap(r.x0 + w * i), r.z0, i === n - 1 ? r.x1 : snap(r.x0 + w * (i + 1)), r.z1));
  return out;
}

function structureHotel(c: MegaCtx): ZoneInfo[] {
  const vr0 = voidRect(c);
  const thirds = splitX(vr0, 3);
  const lobbyIdx = thirds.findIndex((r) => 0 >= r.x0 && 0 <= r.x1);
  const li = lobbyIdx < 0 ? 1 : lobbyIdx;
  const zones: ZoneInfo[] = thirds.map((r, i) => ({ rect: r, theme: i === li ? 'lobby' : (i < li ? 'banquet' : 'rooms'), name: i === li ? 'ロビー' : (i < li ? '宴会場' : '客室翼') }));
  if (li === 0) {
    // ロビーが端のときは残り 2 つを宴会場 / 客室翼に振る
    zones[1].theme = 'rooms';
    zones[1].name = '客室翼';
    zones[2].theme = 'banquet';
    zones[2].name = '宴会場';
  }
  for (const z of zones) {
    themeZone(c, z.rect, z.name, z.theme);
    if (z.theme === 'banquet') columnGrid(c, z.rect, 8, 0.5, 'columnConcrete', c.h - 0.1, 2.0);
    if (z.theme === 'rooms') guestRooms(c, z.rect, 0, 'wallBeige');
  }
  return zones;
}

/** 客室列（間仕切り小部屋。前面に扉開口。中に入れる）。ゾーンの両側（x の外寄り）に奥行 5.5 m の列 */
function guestRooms(c: MegaCtx, z: Rect, y0: number, wallMat: MatId): void {
  const depth = 5.5;
  const pitch = 4.2;
  const h = 2.7;
  const sides: { x0: number; x1: number; face: number }[] = [];
  if (z.x1 - z.x0 > depth * 2 + 3) {
    sides.push({ x0: z.x0, x1: z.x0 + depth, face: z.x0 + depth });
    sides.push({ x0: z.x1 - depth, x1: z.x1, face: z.x1 - depth });
  } else {
    sides.push({ x0: z.x0, x1: z.x0 + depth, face: z.x0 + depth });
  }
  for (const s of sides) {
    const n = Math.floor((z.z1 - z.z0 - 1) / pitch);
    if (n < 1) continue;
    const zStart = z.z0 + 0.5;
    const openings: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const za = zStart + i * pitch;
      const zb = za + pitch;
      const rr = rect(s.x0, za, s.x1, zb);
      if (blocked(c, rr, y0, y0 + h, 0.3)) continue;
      // 前面の扉開口
      openings.push([za + pitch / 2 - 0.5, za + pitch / 2 + 0.5]);
      // 仕切り（側壁）
      partition(c, 'x', za, s.x0, s.x1, h, wallMat, [], y0);
      if (i === n - 1) partition(c, 'x', zb, s.x0, s.x1, h, wallMat, [], y0);
      // 背面（ゾーン端側）
      const back = s.face === s.x1 ? s.x0 : s.x1;
      partition(c, 'z', back, za, zb, h, wallMat, [], y0);
      // 天井板（客室の上。歩けない装飾）
      c.structure.push(box([s.x0, y0 + h, za], [s.x1, y0 + h + 0.12, zb], 'ceilingWhite', false));
      // ベッド・ナイトテーブル（内装側にすると ScaleAnomaly 等の対象になるが、L04 は Modifier 無し）
      const bedX0 = s.face === s.x1 ? s.x0 + 0.6 : s.x1 - 2.6;
      c.L.boxes.push(box([bedX0, y0, za + 0.8], [bedX0 + 2.0, y0 + 0.55, za + 2.4], 'upholstery'));
      c.L.boxes.push(box([bedX0, y0, za + 2.6], [bedX0 + 0.6, y0 + 0.6, za + 3.2], 'furnitureDark'));
      c.L.boxes.push(box([bedX0 + 0.1, y0 + 2.4, za + 1.5], [bedX0 + 0.9, y0 + 2.45, za + 2.1], 'lightWarm', false));
      c.L.lights.push({ pos: [bedX0 + 0.5, y0 + 2.2, za + 1.8], color: 0xffd9a0, intensity: 0.5, distance: 6 });
      c.L.boxes.push(box([bedX0 + 2.2, y0 + 0.6, za + 0.9], [bedX0 + 2.3, y0 + 1.8, za + 1.9], 'furnitureLight', false));
    }
    partition(c, 'z', s.face, zStart, zStart + n * pitch, h, wallMat, openings, y0);
  }
}

function structureCampus(c: MegaCtx): ZoneInfo[] {
  const { vr, p } = c;
  const zc = Math.max(2, Math.min(9, Math.round(Number(p.def.modifiers.find((m) => m.id === 'ZoneThemeShuffle')?.params?.zoneCount ?? 6))));
  const rows = zc <= 3 ? 1 : 2;
  const cols = Math.ceil(zc / rows);
  const v = voidRect(c);
  const corridor = 5;
  const cw = (v.x1 - v.x0 - corridor * (cols - 1)) / cols;
  const cd = (v.z1 - v.z0 - corridor * (rows - 1)) / rows;
  const themes = ['classroom', 'gym', 'pool', 'library', 'cafeteria', 'courtyard'];
  const names: Record<string, string> = { classroom: '教室棟', gym: '体育館', pool: 'プール', library: '図書室', cafeteria: '食堂', courtyard: '中庭' };
  const pick = vr.shuffle([...themes]);
  const zones: ZoneInfo[] = [];
  let k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (k >= zc) break;
      const r = rect(snap(v.x0 + i * (cw + corridor)), snap(v.z0 + j * (cd + corridor)), snap(v.x0 + i * (cw + corridor) + cw), snap(v.z0 + j * (cd + corridor) + cd));
      const theme = pick[k % pick.length];
      zones.push({ rect: r, theme, name: names[theme] });
      themeZone(c, r, names[theme], theme);
      // 境界: 2.2 m の間仕切り。各辺に 2 か所 4 m の開口
      boundaryWalls(c, r, theme === 'courtyard' ? 1.0 : 2.2, 'wallCream', vr);
      if (theme === 'pool') waterBasin(c, inner(r, 3.5), 0.25, 'floorTile', 'waterShallow', 0.55);
      k++;
    }
  }
  // 通路の床（薄いタイル帯）
  for (let i = 1; i < cols; i++) floorSheet(c, rect(snap(v.x0 + i * (cw + corridor)) - corridor, v.z0, snap(v.x0 + i * (cw + corridor)), v.z1), 'floorTile', 0.02);
  for (let j = 1; j < rows; j++) floorSheet(c, rect(v.x0, snap(v.z0 + j * (cd + corridor)) - corridor, v.x1, snap(v.z0 + j * (cd + corridor))), 'floorTile', 0.02);
  return zones;
}

/** ゾーン矩形の周囲の間仕切り（各辺に 2 か所の開口 openW） */
function boundaryWalls(c: MegaCtx, r: Rect, height: number, mat: MatId, rng: Rng, openW = 4.0): void {
  const edges: { axis: 'x' | 'z'; at: number; a0: number; a1: number }[] = [
    { axis: 'x', at: r.z0, a0: r.x0, a1: r.x1 },
    { axis: 'x', at: r.z1, a0: r.x0, a1: r.x1 },
    { axis: 'z', at: r.x0, a0: r.z0, a1: r.z1 },
    { axis: 'z', at: r.x1, a0: r.z0, a1: r.z1 },
  ];
  for (const e of edges) {
    const len = e.a1 - e.a0;
    const openings: [number, number][] = [];
    if (len > openW * 3) {
      const o1 = e.a0 + len * rng.float(0.2, 0.35);
      const o2 = e.a0 + len * rng.float(0.65, 0.8);
      openings.push([o1 - openW / 2, o1 + openW / 2], [o2 - openW / 2, o2 + openW / 2]);
    } else {
      const o = (e.a0 + e.a1) / 2;
      openings.push([o - openW / 2, o + openW / 2]);
    }
    partition(c, e.axis, e.at, e.a0, e.a1, height, mat, openings);
  }
}

function structureOffice(c: MegaCtx, plan: Plan): ZoneInfo[] {
  const { main } = c;
  const zones: ZoneInfo[] = [];
  const gw = plan.gw as [number, number, number, number];
  // 各階（地上を含む）の長辺側にオフィス帯: ガラス間仕切り（開口 1.2 m × 2〜3）+ 机列は内装側
  for (let k = 0; k < c.levels; k++) {
    const y = k * FLOOR;
    for (const dir of [3] as Dir[]) {
      const depth = 6.0;
      const faceX = dir === 3 ? main.x0 + depth : main.x1 - depth;
      const z0 = main.z0 + gw[2] + 0.5;
      const z1 = main.z1 - gw[0] - 0.5;
      const openings: [number, number][] = [];
      const n = Math.max(2, Math.floor((z1 - z0) / 14));
      for (let i = 0; i < n; i++) {
        const oz = z0 + ((z1 - z0) * (i + 0.5)) / n;
        openings.push([oz - 0.7, oz + 0.7]);
      }
      // 階段の切り欠き（短辺側にしか無いが、念のため blocked で避ける）
      partition(c, 'z', faceX, z0, z1, 3.3, 'glass', openings, y);
      const strip = dir === 3 ? rect(main.x0, z0, faceX, z1) : rect(faceX, z0, main.x1, z1);
      if (k === 0) {
        zones.push({ rect: strip, theme: 'office', name: dir === 3 ? '西オフィス' : '東オフィス' });
        themeZone(c, strip, dir === 3 ? '西オフィス' : '東オフィス', 'office');
      }
    }
  }
  const lobby = inner(rect(main.x0 + 6, main.z0, main.x1 - 0.5, main.z1), 1.0);
  zones.push({ rect: lobby, theme: 'lobby', name: 'アトリウム' });
  themeZone(c, lobby, 'アトリウム', 'lobby');
  return zones;
}

function structureBath(c: MegaCtx): ZoneInfo[] {
  const { main, vr } = c;
  const v = voidRect(c);
  const band = Math.min(14, Math.max(9, (v.x1 - v.x0) * 0.2));
  const center = inner(v, band);
  const zones: ZoneInfo[] = [];
  // 中央大浴場（柱で囲む + 大きな浴槽）
  zones.push({ rect: center, theme: 'grandbath', name: '大浴場' });
  themeZone(c, center, '大浴場', 'grandbath');
  const basin = inner(center, 3.5);
  if (basin.x1 - basin.x0 > 4 && basin.z1 - basin.z0 > 4) waterBasin(c, basin, 0.4, 'floorTile', 'waterShallow', 0.55);
  columnGrid(c, center, 9, 0.5, 'columnConcrete', c.h - 0.1, 1.2);
  // 外周帯を区画に切る（南 / 北 / 西 / 東の帯を 18〜26 m ごと）
  const themes = ['bath', 'locker', 'rest', 'pool'];
  const names: Record<string, string> = { bath: '浴場', locker: '更衣室', rest: '休憩所', pool: 'プール' };
  const segs: Rect[] = [];
  const cut = (a0: number, a1: number, make: (p: number, q: number) => Rect) => {
    const n = Math.max(1, Math.round((a1 - a0) / vr.float(18, 26)));
    for (let i = 0; i < n; i++) segs.push(make(snap(a0 + ((a1 - a0) * i) / n), i === n - 1 ? a1 : snap(a0 + ((a1 - a0) * (i + 1)) / n)));
  };
  cut(v.x0, v.x1, (p, q) => rect(p, v.z0, q, center.z0));
  cut(v.x0, v.x1, (p, q) => rect(p, center.z1, q, v.z1));
  cut(center.z0, center.z1, (p, q) => rect(v.x0, p, center.x0, q));
  cut(center.z0, center.z1, (p, q) => rect(center.x1, p, v.x1, q));
  const order = vr.shuffle([...themes]);
  segs.forEach((r, i) => {
    const theme = order[i % order.length];
    zones.push({ rect: r, theme, name: names[theme] });
    themeZone(c, r, names[theme], theme);
    // 腰壁 1.2 m（開口 2 か所）
    boundaryWalls(c, r, 1.2, 'floorTile', vr, 3.0);
    if (theme === 'pool') {
      const b = inner(r, 2.5);
      if (b.x1 - b.x0 > 3 && b.z1 - b.z0 > 3) waterBasin(c, b, 0.3, 'floorTile', 'waterShallow', 0.55);
    } else if (theme === 'bath') {
      const b = inner(r, 2.0);
      const n = 2 + (vr.chance(0.5) ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const w = 3.0;
        const d = 4.0;
        const x = snap(vr.float(b.x0 + w / 2, b.x1 - w / 2));
        const z = snap(vr.float(b.z0 + d / 2, b.z1 - d / 2));
        const br = rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
        if (blocked(c, br, 0, 1, 1.0)) continue;
        if (c.L.zones?.some((zz) => zz.kind === 'water' && zz.aabb.min[0] < br.x1 + 1 && zz.aabb.max[0] > br.x0 - 1 && zz.aabb.min[2] < br.z1 + 1 && zz.aabb.max[2] > br.z0 - 1)) continue;
        waterBasin(c, br, 0.3, 'floorTile', 'waterShallow', 0.6);
      }
    }
  });
  void main;
  return zones;
}

function structureRing(c: MegaCtx): ZoneInfo[] {
  const { rects, vr } = c;
  const zones: ZoneInfo[] = [];
  const names = ['南駅', '北駅', '西駅', '東駅'];
  rects.forEach((r, i) => {
    zones.push({ rect: r, theme: 'station', name: names[i] });
    themeZone(c, r, names[i], 'station');
    // 軌道桁（ホームの吹抜側の外 1.4 m。装飾・非ソリッド）+ 支柱（構造）
    const cy = courtyardEdges(r, rects);
    const gw = 4.0;
    const y0 = 4.6;
    const y1 = 5.0;
    const dir = cy.findIndex((b) => b) as Dir;
    if (dir < 0) return;
    const off = gw + 1.4;
    if (dir === 0 || dir === 2) {
      const z = dir === 0 ? r.z1 - off : r.z0 + off;
      c.structure.push(box([r.x0 + 0.2, y0, z - 0.45], [r.x1 - 0.2, y1, z + 0.45], 'metal', false));
      for (let x = r.x0 + 6; x < r.x1 - 3; x += 12) {
        const pr = rect(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
        if (blocked(c, pr, 0, y0, 0.6)) continue;
        c.structure.push(box([pr.x0, 0, pr.z0], [pr.x1, y0, pr.z1], 'metal'));
      }
    } else {
      const x = dir === 1 ? r.x1 - off : r.x0 + off;
      c.structure.push(box([x - 0.45, y0, r.z0 + 0.2], [x + 0.45, y1, r.z1 - 0.2], 'metal', false));
      for (let z = r.z0 + 6; z < r.z1 - 3; z += 12) {
        const pr = rect(x - 0.25, z - 0.25, x + 0.25, z + 0.25);
        if (blocked(c, pr, 0, y0, 0.6)) continue;
        c.structure.push(box([pr.x0, 0, pr.z0], [pr.x1, y0, pr.z1], 'metal'));
      }
    }
  });
  // 周回の中心線（VehicleRide / MaterialGradient の進行軸）: ホーム中央 y = 4.2
  const south = rects[0];
  const north = rects[1];
  const west = rects[2];
  const east = rects[3];
  const sz = south.z1 - 2;
  const nz = north.z0 + 2;
  const wx = west.x1 - 2;
  const ex = east.x0 + 2;
  const pathY = 4.2;
  const loop: Vec3[] = [[0, pathY, sz], [ex, pathY, sz], [ex, pathY, nz], [wx, pathY, nz], [wx, pathY, sz], [0, pathY, sz]];
  c.L.path = loop;
  void vr;
  return zones;
}

function structureGreenhouse(c: MegaCtx): ZoneInfo[] {
  const { vr, main } = c;
  const v = voidRect(c);
  const cell = Math.max(24, (v.x1 - v.x0) / 5);
  const nx = Math.max(1, Math.round((v.x1 - v.x0) / cell));
  const nz = Math.max(1, Math.round((v.z1 - v.z0) / cell));
  const cw = (v.x1 - v.x0) / nx;
  const cd = (v.z1 - v.z0) / nz;
  const used = Array.from({ length: nx }, () => Array<boolean>(nz).fill(false));
  const zones: ZoneInfo[] = [];
  const themes = ['garden', 'shop', 'garden', 'walk', 'garden', 'shop'];
  const names: Record<string, string> = { garden: '庭園', shop: '店舗跡', walk: '遊歩道' };
  let k = 0;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (used[i][j]) continue;
      used[i][j] = true;
      let i1 = i;
      let j1 = j;
      // 1〜2 セルを結合（有機的な区画）
      if (vr.chance(0.4) && i + 1 < nx && !used[i + 1][j]) { used[i + 1][j] = true; i1 = i + 1; }
      else if (vr.chance(0.4) && j + 1 < nz && !used[i][j + 1]) { used[i][j + 1] = true; j1 = j + 1; }
      const r = rect(snap(v.x0 + i * cw) + 1.5, snap(v.z0 + j * cd) + 1.5, snap(v.x0 + (i1 + 1) * cw) - 1.5, snap(v.z0 + (j1 + 1) * cd) - 1.5);
      const theme = themes[k % themes.length];
      k++;
      zones.push({ rect: r, theme, name: names[theme] });
      themeZone(c, r, names[theme], theme);
      if (theme === 'garden') {
        // 花壇の枡（0.45 m。低い縁は登れる）
        const b = inner(r, 1.0);
        c.structure.push(box([b.x0, 0, b.z0], [b.x1, 0.45, b.z0 + 0.3], 'floorConcrete'));
        c.structure.push(box([b.x0, 0, b.z1 - 0.3], [b.x1, 0.45, b.z1], 'floorConcrete'));
        c.structure.push(box([b.x0, 0, b.z0], [b.x0 + 0.3, 0.45, b.z1], 'floorConcrete'));
        c.structure.push(box([b.x1 - 0.3, 0, b.z0], [b.x1, 0.45, b.z1], 'floorConcrete'));
        // 中は土（非ソリッドの薄い箔）と通り抜けの小道（十字）
        c.L.boxes.push(box([b.x0 + 0.3, 0.001, b.z0 + 0.3], [b.x1 - 0.3, 0.4, b.z1 - 0.3], 'grass', false));
      } else if (theme === 'shop') {
        // ガラスの店先（開口 2 m）
        boundaryWalls(c, r, 2.6, 'glass', vr, 2.4);
      }
    }
  }
  // 窓帯（外壁の内面。非ソリッド）
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const t = 0.02;
    if (dir === 0) c.structure.push(box([main.x0 + 0.5, 1.0, main.z1 - 0.15 - t], [main.x1 - 0.5, 3.2, main.z1 - 0.15], 'windowLit', false));
    if (dir === 2) c.structure.push(box([main.x0 + 0.5, 1.0, main.z0 + 0.15], [main.x1 - 0.5, 3.2, main.z0 + 0.15 + t], 'windowLit', false));
    if (dir === 1) c.structure.push(box([main.x1 - 0.15 - t, 1.0, main.z0 + 0.5], [main.x1 - 0.15, 3.2, main.z1 - 0.5], 'windowLit', false));
    if (dir === 3) c.structure.push(box([main.x0 + 0.15, 1.0, main.z0 + 0.5], [main.x0 + 0.15 + t, 3.2, main.z1 - 0.5], 'windowLit', false));
  }
  return zones;
}

function structureResort(c: MegaCtx): ZoneInfo[] {
  const { main, rects, vr } = c;
  const wing = rects[1] ?? null;
  const zones: ZoneInfo[] = [];
  // 主矩形を x で 2 分割: 翼側がプール、反対が雪面（翼が無ければ乱択）
  const halves = splitX(inner(main, 1.0), 2);
  const wingOnEast = wing ? wing.x0 >= main.x1 - 0.01 : vr.chance(0.5);
  const pool = wingOnEast ? halves[1] : halves[0];
  const snow = wingOnEast ? halves[0] : halves[1];
  zones.push({ rect: pool, theme: 'icepool', name: '凍結プール' }, { rect: snow, theme: 'snowfield', name: '雪面' });
  themeZone(c, pool, '凍結プール', 'icepool');
  themeZone(c, snow, '雪面', 'snowfield', -0.2, c.h + 0.2, { tag: 'snow' });
  // 凍結プール: 縁石 0.3 + 'ice' 面（SurfaceFriction が 'ice' 箱にゾーンを置く）
  const basin = inner(pool, 5);
  if (basin.x1 - basin.x0 > 6 && basin.z1 - basin.z0 > 6) {
    const t = 0.3;
    for (const b of [rect(basin.x0 - t, basin.z0 - t, basin.x1 + t, basin.z0), rect(basin.x0 - t, basin.z1, basin.x1 + t, basin.z1 + t), rect(basin.x0 - t, basin.z0, basin.x0, basin.z1), rect(basin.x1, basin.z0, basin.x1 + t, basin.z1)]) {
      c.structure.push(box([b.x0, 0, b.z0], [b.x1, 0.3, b.z1], 'floorTile'));
    }
    c.structure.push(box([basin.x0, 0, basin.z0], [basin.x1, 0.03, basin.z1], 'ice', false));
    reserve(c, basin, 0, 1.0);
  }
  // 雪面: 白い箔 + 2 段の緩い段丘（0.3 m）
  const sf = inner(snow, 1.5);
  c.structure.push(box([sf.x0, 0.001, sf.z0], [sf.x1, 0.04, sf.z1], 'snow', false));
  const t1 = inner(sf, (sf.x1 - sf.x0) * 0.2);
  const t2 = inner(t1, (t1.x1 - t1.x0) * 0.25);
  if (t1.x1 - t1.x0 > 6 && !blocked(c, t1, 0, 0.6, 0.5)) {
    c.structure.push(box([t1.x0, 0, t1.z0], [t1.x1, 0.3, t1.z1], 'snow'));
    if (t2.x1 - t2.x0 > 4) c.structure.push(box([t2.x0, 0.3, t2.z0], [t2.x1, 0.6, t2.z1], 'snow'));
  }
  if (wing) {
    zones.push({ rect: wing, theme: 'hotel', name: 'ホテル翼' });
    themeZone(c, wing, 'ホテル翼', 'hotel');
  }
  return zones;
}

// ---------------------------------------------------------------- 内装（部屋別）

function furnishFor(kind: AtriumKind, c: MegaCtx, plan: Plan, zones: ZoneInfo[]): void {
  const { vr, L, main } = c;
  const lightMat: MatId = plan.palette.light ?? 'lightPanel';
  const lightColor = plan.palette.lightColor ?? 0xdfe8ff;
  switch (kind) {
    case 'hotel': {
      for (const z of zones) {
        if (z.theme === 'lobby') {
          const cx = (z.rect.x0 + z.rect.x1) / 2;
          const cz = z.rect.z0 + (z.rect.z1 - z.rect.z0) * 0.35;
          const desk = rect(cx - 2.6, cz - 0.8, cx + 2.6, cz + 0.8);
          if (!blocked(c, desk, 0, 1.2, 1.0)) L.boxes.push(box([desk.x0, 0, desk.z0], [desk.x1, 1.1, desk.z1], 'furnitureLight'));
          furnishIslands(c, z.rect, Math.round(rectArea(z.rect) / 120), ['upholstery', 'plant', 'furnitureDark'], [1.2, 2.4], [0.45, 1.6], vr);
          floorSheet(c, inner(z.rect, 2), 'floorTile', 0.01);
        } else if (z.theme === 'banquet') {
          furnishIslands(c, z.rect, Math.round(rectArea(z.rect) / 45), ['furnitureLight'], [1.6, 2.0], [0.74, 0.76], vr, 1.5);
          hangingLights(c, [z.rect], c.h - 3.0, 10, 'lightWarm', 0xffd9a0, 1.0, vr, 3, 0.05, 1.6);
        }
      }
      // 各階回廊の偽客室扉（番号板は 5 枚に 1 枚）
      for (let k = 1; k < c.levels; k++) {
        for (const dir of [0, 1, 2, 3] as Dir[]) fakeDoors(c, main, dir, k * FLOOR, 3.6, 'doorWood', vr, { numberFrom: k * 100 + 1 + dir * 20, signEvery: 5 });
        galleryLights(c, k, 6, 'lightWarm', 0xffd9a0, 0.7, 5);
      }
      // 天窓帯
      skylight(c, main, 'lightPanel', 0xfff4e0);
      break;
    }
    case 'campus': {
      for (const z of zones) furnishCampusZone(c, z, vr);
      galleryLights(c, 1, 6, lightMat, lightColor, 0.8, 5);
      skylight(c, main, 'lightPanel', 0xf2f6ff);
      // 通路の天井灯
      hangingLights(c, [voidRect(c)], c.h - 0.6, 12, lightMat, lightColor, 0.8, vr, 4, 0.08, 1.2);
      break;
    }
    case 'office': {
      const gw = plan.gw as [number, number, number, number];
      for (let k = 0; k < c.levels; k++) {
        const y = k * FLOOR;
        for (const dir of [3] as Dir[]) {
          const strip = dir === 3 ? rect(main.x0 + 0.3, main.z0 + gw[2] + 0.8, main.x0 + 5.8, main.z1 - gw[0] - 0.8) : rect(main.x1 - 5.8, main.z0 + gw[2] + 0.8, main.x1 - 0.3, main.z1 - gw[0] - 0.8);
          furnishRows(c, strip, { spacing: 3.2, depth: 1.4, height: 0.75, mat: 'furnitureLight', gapEvery: 6, margin: 0.5, axis: 'z', top: 'furnitureDark', y0: y });
          // 帯の天井（上階スラブ下面 / 天井）の蛍光灯
          const yc = k === c.levels - 1 ? c.h - 0.02 : (k + 1) * FLOOR - 0.22;
          for (let zz = strip.z0 + 3; zz < strip.z1 - 2; zz += 6) {
            if (remaining(c) < 30) break;
            L.boxes.push(box([strip.x0 + 2.4, yc - 0.03, zz - 0.15], [strip.x0 + 3.6, yc, zz + 0.15], vr.chance(0.1) ? 'lightOff' : 'lightPanel', false));
          }
          if (k > 0) L.lights.push({ pos: [(strip.x0 + strip.x1) / 2, y + 2.8, (strip.z0 + strip.z1) / 2], color: 0xe9f0ff, intensity: 0.6, distance: 14 });
        }
        if (k > 0) galleryLights(c, k, 7, 'lightPanel', 0xe9f0ff, 0.6, 6);
      }
      // 地上のアトリウム: 受付 + 植栽
      const lobby = zones.find((z) => z.theme === 'lobby');
      if (lobby) {
        furnishIslands(c, lobby.rect, Math.round(rectArea(lobby.rect) / 200), ['plant', 'furnitureDark', 'upholstery'], [1.0, 2.0], [0.45, 1.5], vr, 2.0);
        const cx = (lobby.rect.x0 + lobby.rect.x1) / 2;
        const desk = rect(cx - 2.4, lobby.rect.z0 + 5, cx + 2.4, lobby.rect.z0 + 6.4);
        if (!blocked(c, desk, 0, 1.2, 1.0)) L.boxes.push(box([desk.x0, 0, desk.z0], [desk.x1, 1.1, desk.z1], 'furnitureLight'));
      }
      skylight(c, main, 'lightPanel', 0xe9f0ff);
      break;
    }
    case 'bath': {
      for (const z of zones) {
        if (z.theme === 'locker') furnishRows(c, z.rect, { spacing: 2.8, depth: 0.5, height: 1.9, mat: 'furnitureDark', gapEvery: 5, margin: 1.5, axis: z.rect.x1 - z.rect.x0 > z.rect.z1 - z.rect.z0 ? 'x' : 'z' });
        if (z.theme === 'rest') {
          furnishIslands(c, z.rect, Math.round(rectArea(z.rect) / 60), ['furnitureLight'], [2.4, 3.2], [0.34, 0.36], vr, 1.5);
          furnishIslands(c, z.rect, Math.round(rectArea(z.rect) / 150), ['furnitureDark'], [0.8, 1.2], [0.3, 0.4], vr, 1.5);
        }
        if (z.theme === 'grandbath') hangingLights(c, [z.rect], c.h - 2.0, 9, 'lightWarm', 0xffd9a0, 0.9, vr, 3, 0.05, 1.0);
      }
      // 上階（休憩フロア）: 座敷島 + 自販機
      for (const s of c.slabs.get(1) ?? []) {
        if (rectArea(s) < 40) continue;
        furnishRows(c, s, { spacing: 7, depth: 2.4, height: 0.35, mat: 'furnitureLight', gapEvery: 3, margin: 1.0, axis: s.x1 - s.x0 > s.z1 - s.z0 ? 'x' : 'z', y0: FLOOR });
      }
      galleryLights(c, 1, 6, 'lightWarm', 0xffd9a0, 0.7, 5);
      hangingLights(c, [voidRect(c)], c.h - 0.6, 11, 'lightWarm', 0xffd9a0, 0.8, vr, 5, 0.1, 1.2);
      break;
    }
    case 'ring': {
      const names = ['S', 'N', 'W', 'E'];
      c.rects.forEach((r, i) => {
        const cy = courtyardEdges(r, c.rects);
        const outer = cy.map((b, d) => !b && exteriorEdges(r, c.rects)[d]);
        // 外壁沿いの店舗跡（棚）と看板（発光箱）
        furnishPerimeter(c, r, outer, 1.0, 2.2, 'shelfMetal', vr, 0.4);
        signBand(c, r, outer, vr);
        // ホーム（y = 3.6）のベンチ
        for (const s of c.slabs.get(1) ?? []) {
          if (!(s.x0 >= r.x0 - 0.1 && s.x1 <= r.x1 + 0.1 && s.z0 >= r.z0 - 0.1 && s.z1 <= r.z1 + 0.1)) continue;
          furnishRows(c, s, { spacing: 9, depth: 0.5, height: 0.45, mat: 'furnitureDark', gapEvery: 1.8, margin: 0.9, axis: s.x1 - s.x0 > s.z1 - s.z0 ? 'x' : 'z', y0: FLOOR });
        }
        // 駅名サイン（ホーム上、階段の上がり口付近 = 帯の中央）
        const cy0 = cy.findIndex((b) => b) as Dir;
        if (cy0 >= 0) {
          const pos: [number, number, number] = cy0 === 0 ? [(r.x0 + r.x1) / 2, FLOOR + 2.4, r.z1 - 4.0 - 0.1] : cy0 === 2 ? [(r.x0 + r.x1) / 2, FLOOR + 2.4, r.z0 + 4.0 + 0.1] : cy0 === 1 ? [r.x1 - 4.0 - 0.1, FLOOR + 2.4, (r.z0 + r.z1) / 2] : [r.x0 + 4.0 + 0.1, FLOOR + 2.4, (r.z0 + r.z1) / 2];
          (L.signs ??= []).push({ text: `ST. ${names[i]}`, sub: 'LOOP LINE', pos, dir: ((cy0 + 2) % 4) as Dir, width: 2.4, kind: 'emissive', color: 0x9fc8ff, background: 0x0a0c18 });
        }
      });
      galleryLights(c, 1, 6, 'ledBlue', 0x9fc8ff, 0.7, 4);
      hangingLights(c, c.rects, c.h - 1.0, 12, 'lightWarm', 0xffc890, 0.7, vr, 4, 0.25, 1.0);
      break;
    }
    case 'greenhouse': {
      for (const z of zones) {
        if (z.theme === 'garden') {
          const b = inner(z.rect, 1.3);
          furnishIslands(c, b, Math.round(rectArea(b) / 40), ['plant'], [0.8, 1.6], [0.8, 1.8], vr, 0.6);
          // 育成灯（暖色 / 青の混在。花壇の上 4 m）
          hangingLights(c, [z.rect], 4.0, 7, vr.chance(0.5) ? 'lightWarm' : 'ledBlue', 0xffe2b0, 0.7, vr, 3, 0.1, 0.8);
        } else if (z.theme === 'shop') {
          furnishPerimeter(c, z.rect, [true, true, true, true], 0.8, 2.0, 'shelfMetal', vr, 0.3);
          furnishIslands(c, z.rect, 2, ['furnitureDark', 'boxCardboard'], [0.8, 1.6], [0.6, 1.2], vr, 2.0);
        } else {
          floorSheet(c, inner(z.rect, 0.5), 'floorTile', 0.01);
          furnishIslands(c, z.rect, Math.round(rectArea(z.rect) / 90), ['furnitureDark', 'plant'], [0.5, 1.8], [0.45, 1.4], vr, 1.5);
        }
      }
      galleryLights(c, 1, 7, 'lightWarm', 0xffe2b0, 0.6, 5);
      // 天井は glass。空の明るさは環境光で。吊り灯は少なめ
      hangingLights(c, [voidRect(c)], c.h - 1.5, 16, 'lightPanel', 0xf2f6ff, 0.6, vr, 4, 0.1, 1.0);
      break;
    }
    case 'resort': {
      for (const z of zones) {
        if (z.theme === 'icepool') {
          furnishRows(c, rect(z.rect.x0, z.rect.z0, z.rect.x1, z.rect.z0 + 4.5), { spacing: 2.2, depth: 0.6, height: 0.4, mat: 'furnitureLight', gapEvery: 1.8, margin: 0.8, axis: 'z' });
          hangingLights(c, [z.rect], c.h - 0.6, 10, 'lightPanel', 0xdfe7ee, 0.9, vr, 4, 0.05, 1.4);
        } else if (z.theme === 'snowfield') {
          furnishIslands(c, z.rect, Math.round(rectArea(z.rect) / 220), ['furnitureDark'], [0.5, 1.8], [0.45, 0.5], vr, 2.0);
          // 街灯（柱 + 暖色の頭）
          const n = Math.round(rectArea(z.rect) / 300);
          for (let i = 0; i < n; i++) {
            const x = vr.float(z.rect.x0 + 3, z.rect.x1 - 3);
            const zz = vr.float(z.rect.z0 + 3, z.rect.z1 - 3);
            if (blocked(c, rect(x - 0.2, zz - 0.2, x + 0.2, zz + 0.2), 0, 4, 0.6)) continue;
            if (remaining(c) < 30) break;
            L.boxes.push(box([x - 0.08, 0, zz - 0.08], [x + 0.08, 3.6, zz + 0.08], 'metal'));
            L.boxes.push(box([x - 0.25, 3.6, zz - 0.25], [x + 0.25, 4.0, zz + 0.25], 'lightWarm', false));
            L.lights.push({ pos: [x, 3.5, zz], color: 0xffd9a0, intensity: 0.8, distance: 12 });
          }
          hangingLights(c, [z.rect], c.h - 0.6, 12, 'lightPanel', 0xdfe7ee, 0.7, vr, 5, 0.2, 1.2);
        } else if (z.theme === 'hotel') {
          const r = z.rect;
          furnishIslands(c, inner(r, 1.5), Math.round(rectArea(r) / 100), ['upholstery', 'furnitureDark', 'plant'], [1.0, 2.2], [0.45, 1.4], vr, 1.5);
          const dirs = exteriorEdges(r, c.rects);
          for (let k = 0; k < c.levels; k++) {
            for (const dir of [0, 1, 2, 3] as Dir[]) if (dirs[dir]) fakeDoors(c, r, dir, k * FLOOR, 3.6, 'doorWood', vr, { numberFrom: (k + 1) * 100 + 1 + dir * 10, signEvery: 4 });
          }
          galleryLights(c, 1, 6, 'lightWarm', 0xffd9a0, 0.7, 4);
          hangingLights(c, [r], c.h - 1.0, 9, 'lightWarm', 0xffd9a0, 0.8, vr, 4, 0.05, 1.0);
        }
      }
      break;
    }
  }
}

function furnishCampusZone(c: MegaCtx, z: ZoneInfo, rng: Rng): void {
  const r = z.rect;
  const L = c.L;
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  switch (z.theme) {
    case 'classroom':
      furnishRows(c, r, { spacing: 1.8, depth: 0.5, height: 0.72, mat: 'furnitureLight', gapEvery: 4.5, margin: 2.0, axis: alongX ? 'x' : 'z' });
      // 教卓
      L.boxes.push(box([r.x0 + 2.2, 0, r.z1 - 2.6], [r.x0 + 3.8, 0.8, r.z1 - 2.0], 'furnitureDark'));
      break;
    case 'gym': {
      const b = inner(r, 3);
      // コートのライン（非ソリッド帯）
      const t = 0.08;
      floorSheet(c, rect(b.x0, b.z0, b.x1, b.z0 + t), 'yellowLine', 0.012);
      floorSheet(c, rect(b.x0, b.z1 - t, b.x1, b.z1), 'yellowLine', 0.012);
      floorSheet(c, rect(b.x0, b.z0, b.x0 + t, b.z1), 'yellowLine', 0.012);
      floorSheet(c, rect(b.x1 - t, b.z0, b.x1, b.z1), 'yellowLine', 0.012);
      floorSheet(c, rect((b.x0 + b.x1) / 2 - t / 2, b.z0, (b.x0 + b.x1) / 2 + t / 2, b.z1), 'yellowLine', 0.012);
      // ゴール（柱 + 板）
      for (const gx of [b.x0 + 1.5, b.x1 - 1.5]) {
        const gz = (b.z0 + b.z1) / 2;
        if (blocked(c, rect(gx - 0.2, gz - 0.2, gx + 0.2, gz + 0.2), 0, 3.2, 0.5)) continue;
        L.boxes.push(box([gx - 0.1, 0, gz - 0.1], [gx + 0.1, 3.2, gz + 0.1], 'metal'));
        L.boxes.push(box([gx - 0.05, 2.6, gz - 0.9], [gx + 0.05, 3.5, gz + 0.9], 'furnitureLight', false));
      }
      floorSheet(c, inner(r, 0.4), 'floorWood', 0.008);
      break;
    }
    case 'pool':
      furnishRows(c, rect(r.x0, r.z0, r.x1, r.z0 + 3.4), { spacing: 3.0, depth: 0.5, height: 1.9, mat: 'furnitureDark', gapEvery: 6, margin: 0.9, axis: 'x' });
      break;
    case 'library':
      furnishRows(c, r, { spacing: 2.6, depth: 0.6, height: 2.2, mat: 'shelfMetal', gapEvery: 6, margin: 1.8, axis: alongX ? 'x' : 'z' });
      furnishIslands(c, r, 3, ['furnitureLight'], [1.6, 2.4], [0.74, 0.76], rng, 2.0);
      break;
    case 'cafeteria':
      furnishRows(c, r, { spacing: 3.6, depth: 0.9, height: 0.78, mat: 'furnitureLight', gapEvery: 6, margin: 1.8, axis: alongX ? 'x' : 'z' });
      L.boxes.push(box([r.x0 + 1.0, 0, r.z0 + 1.0], [r.x0 + 1.9, 1.0, r.z1 - 1.0], 'furnitureDark'));
      break;
    default: // courtyard
      floorSheet(c, inner(r, 0.6), 'grass', 0.02);
      furnishIslands(c, r, Math.round(rectArea(r) / 55), ['plant'], [0.8, 1.8], [0.8, 2.0], rng, 1.2);
      furnishIslands(c, r, Math.round(rectArea(r) / 120), ['furnitureDark'], [0.5, 1.8], [0.45, 0.5], rng, 1.2);
      break;
  }
}

/** 天窓の帯（天井中央。発光箔 + 少数の PointLight） */
function skylight(c: MegaCtx, r: Rect, mat: MatId, color: number): void {
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const w = Math.min(4, (r.x1 - r.x0) * 0.25);
  const d = Math.max(4, (r.z1 - r.z0) * 0.6);
  c.L.boxes.push(box([cx - w / 2, c.h - 0.04, cz - d / 2], [cx + w / 2, c.h - 0.005, cz + d / 2], mat, false));
  const n = Math.max(1, Math.floor(d / 16));
  for (let i = 0; i < n; i++) c.L.lights.push({ pos: [cx, c.h - 1.5, cz - d / 2 + (i + 0.5) * (d / n)], color, intensity: 1.1, distance: Math.max(20, w + d / n) });
}

/** 外壁沿いの看板帯（発光箱。夜景）。sides が true の辺に 6 m ごと */
function signBand(c: MegaCtx, r: Rect, sides: boolean[], rng: Rng): void {
  const y0 = 2.6;
  const y1 = 3.3;
  const mats: MatId[] = ['signEmissive', 'ledBlue', 'lightWarm', 'screenGlow'];
  const put = (x0: number, y: number, z0: number, x1: number, z1: number) => {
    if (remaining(c) < 30) return;
    c.L.boxes.push(box([x0, y, z0], [x1, y + (y1 - y0), z1], rng.pick(mats), false));
  };
  const step = 6;
  if (sides[2]) for (let x = r.x0 + 3; x < r.x1 - 3; x += step) if (rng.chance(0.7)) put(x - 1.2, y0, r.z0 + 0.16, x + 1.2, r.z0 + 0.22);
  if (sides[0]) for (let x = r.x0 + 3; x < r.x1 - 3; x += step) if (rng.chance(0.7)) put(x - 1.2, y0, r.z1 - 0.22, x + 1.2, r.z1 - 0.16);
  if (sides[3]) for (let z = r.z0 + 3; z < r.z1 - 3; z += step) if (rng.chance(0.7)) put(r.x0 + 0.16, y0, z - 1.2, r.x0 + 0.22, z + 1.2);
  if (sides[1]) for (let z = r.z0 + 3; z < r.z1 - 3; z += step) if (rng.chance(0.7)) put(r.x1 - 0.22, y0, z - 1.2, r.x1 - 0.16, z + 1.2);
}

