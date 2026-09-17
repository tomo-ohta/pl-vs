/** StreetGrid（R04 屋内住宅街 / L01 永久薄明都市 / L10 夜間郊外住宅地 / L17 無限団地 / L20 永久万博会場）。
 *
 *  1 部屋 = 外周を建物ファサードで囲んだ屋内街区。footprint は単一矩形（mainRect が渡されればその寸法から街区数を逆算する）。
 *  寸法モデル: 一辺 = n·B + (n+1)·S（街路幅 S 5.5〜7 m、島ブロック B、街区数 n = 1〜3）。外周は必ず街路なので
 *  外壁上のソケットはすべて街路に面し、全出口へ歩いて到達できる（島ブロックはソリッドの建物 + 歩道 0.12 m）。
 *  - 出口: 街路端（道路が外壁に達する箇所。type 'street'、幅 WIDE_W、高さ 3.2）を優先し、残りを外周ファサードの玄関（type 'door'）に置く。
 *  - 天井は暗い高天井（'ceilingDark'。FakeSky が空に差し替える部屋もあるので L.palette.ceiling に同じ材質を入れる）。
 *  - 照明は街灯（sodiumLight 等の発光箱 + LightSpec）と窓明かり。天井灯は蛍光灯プリセット（R04）のときだけ。
 *  - L17: 同形の板状団地を全ブロックに反復 + 外階段。L20: ブロックごとに kind 'theme' ゾーン（ZoneThemeShuffle の受け皿）。
 *  - Hole 落下先（ROOMLIKE）: 天井穴入口が島ブロックに掛かればそのブロックを建物の無い小広場にする。床穴は道路上のマンホール。
 *  乱数: サイズ非依存の抽選は rng、バリアント依存は rng.fork(`v${variant}`)、床穴は vr.fork('hole')。 */
import type { Dir, RoomDefinition, Socket, Vec3 } from '../core/types';
import type { Rng } from '../core/rng';
import { aabbFromCenter, type AABB } from '../core/aabb';
import { buildShell, clearOfSockets, footprintAABB, rect, rectArea, wallSpans, type Rect } from './footprint';
import { clearDoorways, dropRemovedHole, labelAtEntry, makeEntry, placeExits } from './common';
import { box, bonusExits, emptyLayout, HOLE_SIZE, lightPanel, snap, WIDE_W, type Box, type GenParams, type MatId, type Palette, type RoomLayout, type Zone } from './layout';
import {
  blockedBy, car, cladding, crosswalk, DEFAULT_STYLE, facade, facesOfBox, innerFaceOfEdge, openingsOnEdge, railing, roadLine, signOn, stepRun, streetLamp,
  type Face, type FacadeStyle,
} from './StreetGenerator.facade';

/** 一辺の長さ（m）。variant 0 = 最大。Legendary は 64 m から、Rare（R04）は 48 m から */
const SIZES_LEGENDARY = [64, 48, 40, 32, 24, 20];
const SIZES_RARE = [48, 40, 32, 26, 22, 18];
const STREET_GATE_H = 3.2;
const SIDEWALK_H = 0.12;
const SIDEWALK_W = 1.2;

type Kind = 'residential' | 'city' | 'suburb' | 'danchi' | 'expo';

function kindOf(def: RoomDefinition): Kind {
  switch (def.id) {
    case 'L01': return 'city';
    case 'L10': return 'suburb';
    case 'L17': return 'danchi';
    case 'L20': return 'expo';
  }
  if (/都市/.test(def.category)) return 'city';
  if (/郊外/.test(def.category)) return 'suburb';
  if (/集合住宅|団地/.test(def.category)) return 'danchi';
  if (/展示|万博/.test(def.category)) return 'expo';
  return 'residential';
}

/** 1 軸の街区分割。n 街区、街路幅 s、ブロック b（b は 0.5 m スナップ、端数は街路が吸収） */
function deriveAxis(len: number, rare: boolean): { n: number; s: number; b: number } {
  const n = len >= 56 ? 3 : len >= 34 ? 2 : 1;
  const sPref = rare ? (n === 1 ? 5.5 : 6) : n === 1 ? 6 : 7;
  const b = Math.max(6, snap((len - (n + 1) * sPref) / n));
  const s = (len - n * b) / (n + 1);
  return { n, s, b };
}

interface Grid {
  x0: number;
  z0: number;
  w: number;
  d: number;
  nx: number;
  nz: number;
  /** 街路幅（x 方向に並ぶ縦街路 / z 方向に並ぶ横街路） */
  sx: number;
  sz: number;
  bx: number;
  bz: number;
}

/** 縦街路 k（0..nx）の x 範囲 */
function vStreet(g: Grid, k: number): [number, number] {
  const a = g.x0 + k * (g.sx + g.bx);
  return [a, a + g.sx];
}
/** 横街路 j（0..nz）の z 範囲 */
function hStreet(g: Grid, j: number): [number, number] {
  const a = g.z0 + j * (g.sz + g.bz);
  return [a, a + g.sz];
}
/** ブロック (i, j) */
function blockRect(g: Grid, i: number, j: number): Rect {
  const x = g.x0 + g.sx + i * (g.sx + g.bx);
  const z = g.z0 + g.sz + j * (g.sz + g.bz);
  return rect(x, z, x + g.bx, z + g.bz);
}

interface Theme {
  h: number;
  wall: MatId;
  ceiling: MatId;
  lampMat: MatId;
  lampColor: number;
  lampIntensity: number;
  lampH: number;
  ambient: number;
  fog: number;
  litChance: number;
  buildingMats: MatId[];
  claddingMats: MatId[];
  bHeight: [number, number];
  ceilingPanels: boolean;
  shopSigns: string[];
}

function themeOf(kind: Kind, def: RoomDefinition): Theme {
  const l = def.lightingPreset;
  const sodium = { lampMat: 'sodiumLight' as MatId, lampColor: 0xffa860, lampIntensity: 1.1 };
  const white = { lampMat: 'lightPanel' as MatId, lampColor: 0xe9f0ff, lampIntensity: 1.0 };
  const blue = { lampMat: 'ledBlue' as MatId, lampColor: 0x9fb8ff, lampIntensity: 1.0 };
  const lamp = /青/.test(l) ? blue : /蛍光|白色/.test(l) ? white : sodium;
  const base: Theme = {
    h: 9, wall: 'wallConcrete', ceiling: 'ceilingDark', ...lamp, lampH: 5.0, ambient: 0x3a3c44, fog: 0x0b0d14, litChance: 0.45,
    buildingMats: ['wallBrick', 'wallConcrete', 'wallBeige', 'wallCream'], claddingMats: ['wallBrick', 'wallConcrete', 'wallBeige', 'wallDark'],
    bHeight: [5, 8], ceilingPanels: /蛍光/.test(l), shopSigns: ['24H', 'CAFE', '薬', 'HOTEL', 'P', 'OPEN', '本', 'BAR', 'ランドリー', 'CLINIC'],
  };
  switch (kind) {
    case 'city':
      return { ...base, h: 12, lampH: 6.0, ambient: 0x2c3048, fog: 0x2b2f4a, litChance: 0.35, bHeight: [7, 11], buildingMats: ['wallConcrete', 'wallDark', 'wallBrick', 'wallWhite'], claddingMats: ['wallConcrete', 'wallDark', 'wallBrick', 'wallWhite'], shopSigns: ['HOTEL', 'BANK', '24H', 'NEON', 'CINEMA', 'EXIT', 'BAR', 'DINER', 'OFFICE', '空室'] };
    case 'suburb':
      return { ...base, h: 9, litChance: 0.7, bHeight: [3.6, 6.2], buildingMats: ['wallCream', 'wallBeige', 'wallWhite', 'wallBrick'], claddingMats: ['wallCream', 'wallBeige', 'wallWhite'], shopSigns: ['FOR SALE', 'No.7', 'No.12', '郵便', 'PARK'] };
    case 'danchi':
      return { ...base, h: 12, lampMat: 'lightWarm', lampColor: 0xffd9a0, lampIntensity: 1.0, lampH: 4.5, ambient: 0x34363c, litChance: 0.4, bHeight: [11, 11], buildingMats: ['wallConcrete'], claddingMats: ['wallConcrete', 'wallBeige'], shopSigns: ['A-1', 'B-2', 'C-3', '集会所', '管理'] };
    case 'expo':
      return { ...base, h: 11, ...white, lampH: 5.5, ambient: 0x4a4c54, litChance: 0.6, bHeight: [5, 9], buildingMats: ['wallWhite', 'wallCream', 'wallBeige', 'wallGreen', 'wallDark'], claddingMats: ['wallWhite', 'wallCream', 'wallDark'], shopSigns: ['PAVILION', 'EXPO', 'INFO', 'GATE', 'FUTURE', 'WORLD'] };
    default:
      return base;
  }
}

export function generateStreetGrid(p: GenParams): RoomLayout {
  const { rng, palette, def } = p;
  const kind = kindOf(def);
  const rare = def.rarity !== 'Legendary' && def.rarity !== 'Mythic';
  const theme = themeOf(kind, def);
  // 共有乱数（バリアントに依らない）: 縦横比・ラベル
  const aspect = rng.float(0.85, 1.15);
  const vr = rng.fork(`v${p.variant}`);
  const sizes = rare ? SIZES_RARE : SIZES_LEGENDARY;
  const side = sizes[Math.min(p.variant, sizes.length - 1)];
  let w = snap(side);
  let d = snap(Math.min(64, side * aspect));
  let main: Rect;
  if (p.mainRect) {
    main = rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1);
    w = main.x1 - main.x0;
    d = main.z1 - main.z0;
  } else {
    main = rect(-w / 2, 0, w / 2, d);
  }
  const ax = deriveAxis(w, rare);
  const az = deriveAxis(d, rare);
  const g: Grid = { x0: main.x0, z0: main.z0, w, d, nx: ax.n, nz: az.n, sx: ax.s, sz: az.s, bx: ax.b, bz: az.b };
  const h = theme.h;
  const rects: Rect[] = [main];
  const L = emptyLayout(palette);
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  // 街区は単層（天井は高いが歩ける階は地上だけ。地図の levelSpan を天井高から数えさせない）
  L.levels = 1;
  L.chunkSize = 32;
  const area = rectArea(main);

  // ---- パレット（FakeSky は L.palette.ceiling と同じ材質の天井箔を空に差し替える）
  const pal: Palette = {
    ...palette, floor: 'floorAsphalt', wall: theme.wall, ceiling: theme.ceiling, door: 'doorMetal',
    light: theme.lampMat, lightColor: theme.lampColor, lightIntensity: theme.lampIntensity, ambient: theme.ambient, fog: theme.fog,
  };
  L.palette = pal;

  // ---- 入口: 南辺の縦街路の中心に合わせる
  const entryK = vr.int(0, g.nx);
  const [ex0, ex1] = vStreet(g, entryK);
  const { entry, ceilingHole } = makeEntry(p, main, snap((ex0 + ex1) / 2), h);
  if (entry.type !== 'door' && entry.type !== 'hole') entry.height = Math.min(entry.height, STREET_GATE_H);
  let sockets: Socket[] = [entry, ...p.extraSockets];

  // ---- 出口: 街路端（street）→ 外周の玄関（door）
  const maxExits = Math.max(1, def.maxExits || 5);
  const exits = Math.min(Math.max(maxExits, Math.max(1, p.exits)), Math.max(1, p.exits) + bonusExits(area));
  const streetExits = Math.max(1, Math.ceil(exits / 2));
  const ends: { dir: Dir; coord: number; at: number }[] = [];
  for (let k = 0; k <= g.nx; k++) {
    const [a, b] = vStreet(g, k);
    const at = snap((a + b) / 2);
    ends.push({ dir: 0, coord: main.z1, at });
    if (entry.type === 'hole' || Math.abs(at - entry.pos[0]) > g.sx) ends.push({ dir: 2, coord: main.z0, at });
  }
  for (let j = 0; j <= g.nz; j++) {
    const [a, b] = hStreet(g, j);
    const at = snap((a + b) / 2);
    ends.push({ dir: 1, coord: main.x1, at });
    ends.push({ dir: 3, coord: main.x0, at });
  }
  vr.shuffle(ends);
  let si = 0;
  for (const e of ends) {
    if (si >= streetExits) break;
    const pos: Vec3 = e.dir === 0 || e.dir === 2 ? [e.at, 0, e.coord] : [e.coord, 0, e.at];
    if (!clearOfSockets(sockets, pos[0], pos[2], 3.0)) continue;
    sockets.push({ id: `street${si}`, type: 'street', pos, dir: e.dir, width: WIDE_W, height: STREET_GATE_H });
    si++;
  }
  sockets.push(...placeExits(rects, sockets, vr, { count: Math.max(0, exits - si), minGap: 3.5 }));
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));

  // ---- 床穴（道路上のマンホール。専用 fork）
  const hr = vr.fork('hole');
  const wantHole = p.allowHole && hr.chance(0.1);
  if (p.holeLocal || wantHole) {
    let hp: [number, number] | null = p.holeLocal ? [p.holeLocal[0], p.holeLocal[2]] : null;
    if (!hp) {
      for (let i = 0; i < 12 && !hp; i++) {
        const k = hr.int(0, g.nx);
        const j = hr.int(0, g.nz);
        const [a, b] = vStreet(g, k);
        const [c, e] = hStreet(g, j);
        const x = snap((a + b) / 2 + hr.float(-0.5, 0.5));
        const z = snap((c + e) / 2 + hr.float(-0.5, 0.5));
        if (clearOfSockets(sockets, x, z, 3.5) && (!ceilingHole || Math.hypot((ceilingHole.min[0] + ceilingHole.max[0]) / 2 - x, (ceilingHole.min[2] + ceilingHole.max[2]) / 2 - z) > 4)) hp = [x, z];
      }
    }
    if (hp) {
      L.holes.push(aabbFromCenter(hp[0], 0, hp[1], HOLE_SIZE / 2, 0.2, HOLE_SIZE / 2));
      sockets.push({ id: 'hole', type: 'hole', pos: [hp[0], 0, hp[1]], dir: 0, width: HOLE_SIZE, height: 0 });
    }
  }
  L.sockets = sockets;
  dropRemovedHole(L, p);
  sockets = L.sockets;

  // ---- 外殻
  buildShell(L.boxes, rects, h, sockets, { floor: pal.floor, wall: pal.wall, ceiling: pal.ceiling, floorHoles: L.holes, ceilingHoles: ceilingHole ? [ceilingHole] : [] });
  if (kind === 'expo') splitSlabsByBlocks(L, g, h);
  L.shellCount = L.boxes.length;
  const shellCount = L.shellCount;

  // ---- 天井穴の着地点（島ブロックに掛かるブロックは広場にする）
  let landing: AABB | null = null;
  const plaza = new Set<string>();
  if (ceilingHole) {
    const cx = (ceilingHole.min[0] + ceilingHole.max[0]) / 2;
    const cz = (ceilingHole.min[2] + ceilingHole.max[2]) / 2;
    landing = aabbFromCenter(cx, 0, cz, 1.4, 1, 1.4);
    L.boxes.push(box([cx - 0.9, 0.001, cz - 0.9], [cx + 0.9, 0.012, cz + 0.9], 'furnitureDark', false));
    for (let i = 0; i < g.nx; i++) for (let j = 0; j < g.nz; j++) {
      const r = blockRect(g, i, j);
      if (cx > r.x0 - 1.2 && cx < r.x1 + 1.2 && cz > r.z0 - 1.2 && cz < r.z1 + 1.2) plaza.add(`${i},${j}`);
    }
  }
  if (kind !== 'danchi' && g.nx * g.nz >= 4) {
    const i = vr.int(0, g.nx - 1);
    const j = vr.int(0, g.nz - 1);
    if (vr.chance(0.5)) plaza.add(`${i},${j}`);
  }

  // ---- 路面標示
  roadMarkings(L.boxes, g);

  // ---- 島ブロック（歩道 + 建物 / 広場）
  const zones: Zone[] = [];
  let blockIndex = 0;
  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      const r = blockRect(g, i, j);
      L.boxes.push(box([r.x0, 0, r.z0], [r.x1, SIDEWALK_H, r.z1], 'floorConcrete'));
      if (kind === 'expo') zones.push({ kind: 'theme', aabb: { min: [r.x0, -0.2, r.z0], max: [r.x1, h + 0.2, r.z1] }, params: { label: `PAVILION ${blockIndex + 1}`, index: blockIndex, mod: 'StreetGenerator' } });
      const isPlaza = plaza.has(`${i},${j}`);
      if (isPlaza) plazaBlock(L, r, theme, vr, landing);
      else if (kind === 'danchi') danchiBlock(L, r, theme, vr, blockIndex, g);
      else if (kind === 'expo') pavilionBlock(L, r, theme, vr, blockIndex);
      else cityBlock(L, r, theme, kind, vr, h);
      blockIndex++;
    }
  }
  if (zones.length) L.zones = zones;

  // ---- 外周ファサード（部屋の壁の内面に外装板・窓帯・看板。ソケットは避ける）
  perimeterFacades(L, rects, h, sockets, theme, kind, vr);

  // ---- 街灯（交差点 + 街路の中間）
  lamps(L, g, theme, sockets, L.holes[0]);

  // ---- 停車中の車（歩道沿い。穴・ソケットからは離す）
  if (kind !== 'expo') parkedCars(L.boxes, g, sockets, L.holes[0], vr, kind === 'danchi' ? 0.35 : 0.5);

  // ---- 天井の蛍光灯（オフィス天井蛍光灯プリセット。FakeSky が付く部屋では Modifier 側が取り除く）
  if (theme.ceilingPanels) {
    for (let x = main.x0 + 5; x < main.x1 - 2; x += 10) {
      for (let z = main.z0 + 5; z < main.z1 - 2; z += 10) lightPanel(L.boxes, x, z, 2.4, 0.4, h, vr.chance(0.1) ? 'lightOff' : 'lightPanel');
    }
  }

  clearDoorways(L, sockets, shellCount);

  // ---- 進行軸（入口 → 最初の街路端出口。無ければ中央交差点）
  const firstExit = sockets.find((s) => s.id !== 'entry' && s.type === 'street') ?? sockets.find((s) => s.id !== 'entry' && s.type === 'door');
  const midK = Math.floor(g.nx / 2);
  const midJ = Math.floor(g.nz / 2);
  const mid: Vec3 = [snap((vStreet(g, midK)[0] + vStreet(g, midK)[1]) / 2), 0, snap((hStreet(g, midJ)[0] + hStreet(g, midJ)[1]) / 2)];
  L.path = firstExit ? [entry.pos, mid, firstExit.pos] : [entry.pos, mid];

  labelAtEntry(L, entry, 3.0, p.label);
  return L;
}

// ---------------------------------------------------------------- 外殻の分割（L20: ゾーン境界でシェル材質を差し替えられるように）
function splitSlabsByBlocks(L: RoomLayout, g: Grid, h: number): void {
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < g.nx; i++) { const r = blockRect(g, i, 0); xs.push(r.x0, r.x1); }
  for (let j = 0; j < g.nz; j++) { const r = blockRect(g, 0, j); zs.push(r.z0, r.z1); }
  const out: Box[] = [];
  for (const b of L.boxes) {
    const slab = (b.max[1] <= 0.01 && b.min[1] <= -0.19) || (b.min[1] >= h - 0.01 && b.max[1] <= h + 0.21);
    if (!slab) { out.push(b); continue; }
    let pieces: Box[] = [b];
    for (const x of xs) pieces = pieces.flatMap((q) => (x > q.min[0] + 0.05 && x < q.max[0] - 0.05 ? [box(q.min, [x, q.max[1], q.max[2]], q.mat, q.solid), box([x, q.min[1], q.min[2]], q.max, q.mat, q.solid)] : [q]));
    for (const z of zs) pieces = pieces.flatMap((q) => (z > q.min[2] + 0.05 && z < q.max[2] - 0.05 ? [box(q.min, [q.max[0], q.max[1], z], q.mat, q.solid), box([q.min[0], q.min[1], z], q.max, q.mat, q.solid)] : [q]));
    out.push(...pieces);
  }
  L.boxes = out;
}

// ---------------------------------------------------------------- 路面
function roadMarkings(out: Box[], g: Grid): void {
  const x0 = g.x0 + 0.4;
  const x1 = g.x0 + g.w - 0.4;
  const z0 = g.z0 + 0.4;
  const z1 = g.z0 + g.d - 0.4;
  // 縦街路: センターライン（破線）
  for (let k = 0; k <= g.nx; k++) {
    const [a, b] = vStreet(g, k);
    roadLine(out, z0 + 2, z1 - 2, (a + b) / 2, true, 0.12, 'wallWhite', 2.0);
  }
  for (let j = 0; j <= g.nz; j++) {
    const [a, b] = hStreet(g, j);
    roadLine(out, x0 + 2, x1 - 2, (a + b) / 2, false, 0.12, 'wallWhite', 2.0);
  }
  // 交差点の横断歩道（ブロックの角に接する腕。外周側の腕は出口の前を汚さないよう省く）
  for (let k = 0; k <= g.nx; k++) {
    for (let j = 0; j <= g.nz; j++) {
      const [vx0, vx1] = vStreet(g, k);
      const [hz0, hz1] = hStreet(g, j);
      const cx = (vx0 + vx1) / 2;
      const cz = (hz0 + hz1) / 2;
      if (j < g.nz) crosswalk(out, cx, g.sx - 0.8, hz1 + 0.3, hz1 + 2.3, true);
      if (j > 0) crosswalk(out, cx, g.sx - 0.8, hz0 - 2.3, hz0 - 0.3, true);
      if (k < g.nx) crosswalk(out, cz, g.sz - 0.8, vx1 + 0.3, vx1 + 2.3, false);
      if (k > 0) crosswalk(out, cz, g.sz - 0.8, vx0 - 2.3, vx0 - 0.3, false);
    }
  }
}

// ---------------------------------------------------------------- 島ブロック
/** ブロックを歩道内側で 1〜3 区画（長辺方向）× 1〜2 列に割る */
function lots(r: Rect, rng: Rng, maxAlong = 3): Rect[] {
  const ir = rect(r.x0 + SIDEWALK_W, r.z0 + SIDEWALK_W, r.x1 - SIDEWALK_W, r.z1 - SIDEWALK_W);
  const w = ir.x1 - ir.x0;
  const d = ir.z1 - ir.z0;
  const alongX = w >= d;
  const len = alongX ? w : d;
  const n = Math.max(1, Math.min(maxAlong, Math.floor(len / 5.5), rng.int(1, maxAlong)));
  const rows = (alongX ? d : w) >= 12 && rng.chance(0.5) ? 2 : 1;
  const gap = 0.6;
  const out: Rect[] = [];
  const segLen = (len - gap * (n - 1)) / n;
  const across = alongX ? d : w;
  const rowLen = (across - gap * (rows - 1)) / rows;
  for (let i = 0; i < n; i++) {
    for (let rIdx = 0; rIdx < rows; rIdx++) {
      const a0 = (alongX ? ir.x0 : ir.z0) + i * (segLen + gap);
      const a1 = a0 + segLen;
      const c0 = (alongX ? ir.z0 : ir.x0) + rIdx * (rowLen + gap);
      const c1 = c0 + rowLen;
      out.push(alongX ? rect(a0, c0, a1, c1) : rect(c0, a0, c1, a1));
    }
  }
  return out;
}

function cityBlock(L: RoomLayout, r: Rect, theme: Theme, kind: Kind, rng: Rng, roomH: number): void {
  const B = L.boxes;
  for (const lot of lots(r, rng, kind === 'suburb' ? 3 : 2)) {
    // 郊外の家は区画いっぱいには建てない（庭）
    const inset = kind === 'suburb' ? rng.float(0.4, 1.2) : rng.float(0, 0.3);
    const lr = rect(lot.x0 + inset, lot.z0 + inset, lot.x1 - inset, lot.z1 - inset);
    if (lr.x1 - lr.x0 < 3 || lr.z1 - lr.z0 < 3) continue;
    const bh = Math.min(roomH - 0.8, snap(rng.float(theme.bHeight[0], theme.bHeight[1])));
    const mat = rng.pick(theme.buildingMats);
    const b = box([lr.x0, SIDEWALK_H, lr.z0], [lr.x1, bh, lr.z1], mat);
    B.push(b);
    // 屋上の縁・室外機
    B.push(box([lr.x0 - 0.06, bh - 0.3, lr.z0 - 0.06], [lr.x1 + 0.06, bh, lr.z1 + 0.06], 'wallDark', false));
    if (rng.chance(0.6)) B.push(box([lr.x0 + 0.6, bh, lr.z0 + 0.6], [lr.x0 + 1.4, bh + 0.6, lr.z0 + 1.2], 'metal', false));
    const st: FacadeStyle = {
      ...DEFAULT_STYLE, litChance: theme.litChance, doorMat: kind === 'city' ? 'doorMetal' : 'doorWood',
      floorH: kind === 'suburb' ? 2.7 : 3.0, sill: kind === 'suburb' ? 0.9 : 1.1, pitch: kind === 'city' ? 2.0 : 2.6, frames: kind === 'suburb',
    };
    const faces = facesOfBox(b);
    // 偽扉は 1〜2 面だけ
    const doorFaces = new Set([rng.int(0, 3), rng.int(0, 3)]);
    faces.forEach((f, idx) => facade(B, f, { ...st, fakeDoor: doorFaces.has(idx) }, rng));
    // 看板（店の 1 階。都市 / 住宅街のみ）
    if (kind !== 'suburb' && rng.chance(0.45)) {
      const f = faces[rng.int(0, 3)];
      signOn(L, f, (f.a0 + f.a1) / 2, Math.min(bh - 0.5, 2.9), rng.pick(theme.shopSigns), Math.min(3.2, (f.a1 - f.a0) * 0.6), 'emissive', rng.pick([0xfff1c0, 0xff7aa8, 0x7ad0ff, 0xc0ffb0]), 0x1a1a22);
    }
  }
}

function plazaBlock(L: RoomLayout, r: Rect, theme: Theme, rng: Rng, landing: AABB | null): void {
  const B = L.boxes;
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const ok = (x: number, z: number) => !landing || Math.hypot(x - (landing.min[0] + landing.max[0]) / 2, z - (landing.min[2] + landing.max[2]) / 2) > 2.6;
  // 植栽・ベンチ
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = cx + dx * Math.max(2.5, (r.x1 - r.x0) * 0.3);
    const z = cz + dz * Math.max(2.5, (r.z1 - r.z0) * 0.3);
    if (!ok(x, z)) continue;
    B.push(box([x - 0.9, SIDEWALK_H, z - 0.9], [x + 0.9, SIDEWALK_H + 0.5, z + 0.9], 'floorConcrete'));
    B.push(box([x - 0.7, SIDEWALK_H + 0.5, z - 0.7], [x + 0.7, SIDEWALK_H + rng.float(1.8, 3.0), z + 0.7], 'plant', false));
  }
  for (const [dx, dz] of [[0, -1], [0, 1]] as const) {
    const z = cz + dz * Math.max(1.8, (r.z1 - r.z0) * 0.2);
    if (!ok(cx + dx, z)) continue;
    B.push(box([cx - 1.2, SIDEWALK_H, z - 0.25], [cx + 1.2, SIDEWALK_H + 0.45, z + 0.25], 'furnitureDark'));
  }
  if (ok(cx, cz)) streetLamp(L, cx, cz, theme.lampH, theme.lampMat, theme.lampColor, theme.lampIntensity, true, 1);
}

/** 団地: 全ブロック同形の板状棟（4 階、窓帯）+ 外階段（3.6 m の踊り場まで歩いて上がれる。ブロックが小さい変種では階段を省く） */
function danchiBlock(L: RoomLayout, r: Rect, theme: Theme, rng: Rng, index: number, g: Grid): void {
  const B = L.boxes;
  const bh = theme.bHeight[0];
  const depth = Math.min(9, Math.max(4, snap(g.bz * 0.42)));
  const cz = (r.z0 + r.z1) / 2;
  const withStairs = g.bx >= 12 && g.bz >= 8.4;
  const x0 = r.x0 + SIDEWALK_W + 0.4;
  const x1 = withStairs ? r.x1 - SIDEWALK_W - 3.2 : r.x1 - SIDEWALK_W - 0.4; // 東端は外階段の分を空ける
  if (x1 - x0 < 4) return;
  const b = box([x0, SIDEWALK_H, cz - depth / 2], [x1, bh, cz + depth / 2], 'wallConcrete');
  B.push(b);
  B.push(box([x0 - 0.08, bh - 0.35, cz - depth / 2 - 0.08], [x1 + 0.08, bh, cz + depth / 2 + 0.08], 'wallDark', false));
  // 階段室の縦帯（濃色）と屋上の給水塔
  B.push(box([x0 + (x1 - x0) * 0.5 - 0.9, SIDEWALK_H, cz + depth / 2 + 0.001], [x0 + (x1 - x0) * 0.5 + 0.9, bh, cz + depth / 2 + 0.05], 'wallDark', false));
  B.push(box([x0 + 1.0, bh, cz - 1.0], [Math.min(x1 - 0.5, x0 + 3.0), bh + 1.6, cz + 1.0], 'metal', false));
  const st: FacadeStyle = { ...DEFAULT_STYLE, floorH: 2.7, sill: 1.0, winW: 1.1, winH: 1.2, pitch: 2.4, litChance: theme.litChance, fakeDoor: false, doorMat: 'doorMetal', maxY: bh - 0.6 };
  const faces = facesOfBox(b);
  facade(B, faces[0], { ...st, fakeDoor: true }, rng);
  facade(B, faces[1], st, rng);
  signOn(L, faces[0], x0 + 2.0, bh - 1.0, `${String.fromCharCode(65 + (index % 6))}-${index + 1}`, 2.0, 'plate', 0x202028, 0xf0f0e8);
  if (!withStairs) return;
  // 外階段: 東端の面に沿って +z → -z へ上る直階段（段 0.18 高、20 段）と 3.6 m の踊り場（階段の -z 側）
  const sx0 = x1 + 0.4;
  const sx1 = x1 + 2.0;
  const rise = 3.6;
  const stairLen = Math.min(6.0, g.bz - 4.4);
  const sz0 = cz - stairLen / 2 + 0.8;
  const sz1 = sz0 + stairLen;
  stepRun(B, { x0: sx0, x1: sx1, z0: sz0, z1: sz1, alongZ: true, rise, stepH: 0.18, mat: 'floorConcrete', yBase: SIDEWALK_H, reverse: true });
  B.push(box([sx0, SIDEWALK_H, sz0 - 1.6], [sx1, SIDEWALK_H + rise, sz0], 'floorConcrete'));
  railing(B, [sx1, SIDEWALK_H + rise, sz0 - 1.6], [sx1, SIDEWALK_H + rise, sz0], 1.0);
  railing(B, [sx0, SIDEWALK_H + rise, sz0 - 1.6], [sx1, SIDEWALK_H + rise, sz0 - 1.6], 1.0);
  railing(B, [sx1, SIDEWALK_H, sz0], [sx1, SIDEWALK_H + rise, sz1], 1.0);
  // 踊り場の共用灯
  B.push(box([sx0 - 0.02, SIDEWALK_H + rise + 2.0, sz0 - 1.0], [sx0 + 0.04, SIDEWALK_H + rise + 2.15, sz0 - 0.6], 'lightWarm', false));
  L.lights.push({ pos: [(sx0 + sx1) / 2, SIDEWALK_H + rise + 2.2, sz0 - 0.8], color: theme.lampColor, intensity: 0.7, distance: 12 });
}

/** 万博: パビリオン（本体 + 低い前庭のキャノピー + 看板）。ゾーン kind 'theme' は呼び出し側 */
function pavilionBlock(L: RoomLayout, r: Rect, theme: Theme, rng: Rng, index: number): void {
  const B = L.boxes;
  const ir = rect(r.x0 + SIDEWALK_W + 0.3, r.z0 + SIDEWALK_W + 0.3, r.x1 - SIDEWALK_W - 0.3, r.z1 - SIDEWALK_W - 0.3);
  const front: Dir = rng.pick([0, 1, 2, 3] as const);
  // 前庭側を 3 m 空ける
  const pr = { ...ir };
  if (front === 0) pr.z1 -= 3; else if (front === 2) pr.z0 += 3; else if (front === 1) pr.x1 -= 3; else pr.x0 += 3;
  if (pr.x1 - pr.x0 < 3 || pr.z1 - pr.z0 < 3) return;
  const bh = snap(rng.float(theme.bHeight[0], theme.bHeight[1]));
  const mat = rng.pick(theme.buildingMats);
  const b = box([pr.x0, SIDEWALK_H, pr.z0], [pr.x1, bh, pr.z1], mat);
  B.push(b);
  // 塔（一部）
  if (rng.chance(0.4)) {
    const tx = rng.float(pr.x0 + 1, pr.x1 - 2.5);
    const tz = rng.float(pr.z0 + 1, pr.z1 - 2.5);
    B.push(box([tx, bh, tz], [tx + 1.5, Math.min(theme.h - 0.6, bh + 2.5), tz + 1.5], rng.pick(['wallDark', 'trim', 'wallGreen'])));
  }
  const accent = rng.pick<MatId>(['trim', 'wallGreen', 'yellowLine', 'furnitureLight', 'ledBlue']);
  // 帯（展示カラー）
  B.push(box([pr.x0 - 0.05, 2.6, pr.z0 - 0.05], [pr.x1 + 0.05, 3.0, pr.z1 + 0.05], accent, false));
  const faces = facesOfBox(b);
  const st: FacadeStyle = { ...DEFAULT_STYLE, floorH: 3.2, sill: 1.2, winW: 1.6, winH: 1.4, pitch: 3.0, litChance: theme.litChance, fakeDoor: false, doorMat: 'glass' };
  faces.forEach((f, idx) => facade(B, f, { ...st, fakeDoor: idx === front }, rng));
  // 前庭のキャノピー（歩いて下をくぐれる。柱 2 本）
  const f = faces[front];
  const cw = Math.min(6, (f.a1 - f.a0) * 0.6);
  const cc = (f.a0 + f.a1) / 2;
  const n = f.normal;
  const depth = 2.4;
  if (f.alongX) {
    const z0 = n > 0 ? f.coord : f.coord - depth;
    const z1 = n > 0 ? f.coord + depth : f.coord;
    B.push(box([cc - cw / 2, 3.3, z0], [cc + cw / 2, 3.5, z1], accent, false));
    for (const px of [cc - cw / 2 + 0.3, cc + cw / 2 - 0.3]) B.push(box([px - 0.15, SIDEWALK_H, (n > 0 ? z1 : z0) - (n > 0 ? 0.3 : 0)], [px + 0.15, 3.3, (n > 0 ? z1 : z0) + (n > 0 ? 0 : 0.3)], 'metal'));
  } else {
    const x0 = n > 0 ? f.coord : f.coord - depth;
    const x1 = n > 0 ? f.coord + depth : f.coord;
    B.push(box([x0, 3.3, cc - cw / 2], [x1, 3.5, cc + cw / 2], accent, false));
    for (const pz of [cc - cw / 2 + 0.3, cc + cw / 2 - 0.3]) B.push(box([(n > 0 ? x1 : x0) - (n > 0 ? 0.3 : 0), SIDEWALK_H, pz - 0.15], [(n > 0 ? x1 : x0) + (n > 0 ? 0 : 0.3), 3.3, pz + 0.15], 'metal'));
  }
  signOn(L, f, cc, Math.min(bh - 0.6, 4.4), `PAVILION ${index + 1}`, Math.min(4.5, cw), 'emissive', 0xffffff, 0x223046, `pavilion${index}`);
}

// ---------------------------------------------------------------- 外周ファサード
function perimeterFacades(L: RoomLayout, rects: Rect[], h: number, sockets: Socket[], theme: Theme, kind: Kind, rng: Rng): void {
  const B = L.boxes;
  for (const sp of wallSpans(rects)) {
    const dir = sp.edge.dir;
    const coord = sp.edge.coord;
    const openings = openingsOnEdge(sockets, dir, coord);
    const blocked = blockedBy(openings);
    const face: Face = innerFaceOfEdge(dir, coord, sp.a0, sp.a1, h);
    // 擬似建物の区切り（6〜14 m）
    let t = sp.a0;
    while (t < sp.a1 - 2) {
      const len = Math.min(sp.a1 - t, kind === 'danchi' ? rng.float(12, 18) : rng.float(6, 14));
      const t1 = t + len;
      const roof = Math.min(h - 0.2, snap(h * rng.float(kind === 'city' ? 0.7 : 0.5, 0.97)));
      const mat = rng.pick(theme.claddingMats);
      const f: Face = { ...face, a0: t, a1: t1, y1: roof };
      cladding(B, f, t, t1, roof, mat, openings);
      // ロープライン（屋上の縁）
      B.push(...cladPieceRoof(f, t, t1, roof, openings));
      const st: FacadeStyle = {
        ...DEFAULT_STYLE, litChance: theme.litChance, doorMat: rng.pick(['doorWood', 'doorMetal']),
        floorH: kind === 'suburb' ? 2.7 : 3.0, pitch: kind === 'city' ? 2.0 : 2.5, frames: kind === 'suburb', maxY: roof - 0.8, fakeDoor: rng.chance(0.6), inset: 0.075,
      };
      facade(B, { ...f, y1: roof }, st, rng, blocked);
      if (kind !== 'danchi' && rng.chance(0.4) && !blocked(t + len / 2 - 1.6, t + len / 2 + 1.6, 2.5, 3.5)) {
        signOn(L, f, t + len / 2, 3.0, rng.pick(theme.shopSigns), Math.min(3.0, len * 0.5), 'emissive', rng.pick([0xfff1c0, 0xff7aa8, 0x7ad0ff, 0xc0ffb0, 0xffffff]), 0x1a1a22);
      }
      t = t1;
    }
    // 玄関（door ソケット）: ひさし + 玄関灯 / 街路端（street）: トンネル口の縁
    for (const s of sockets) {
      if (s.dir !== dir || s.type === 'hole') continue;
      const c = dir === 0 || dir === 2 ? s.pos[2] : s.pos[0];
      if (Math.abs(c - coord) > 0.05) continue;
      const at = dir === 0 || dir === 2 ? s.pos[0] : s.pos[2];
      const y = s.pos[1] + (s.sill ?? 0) + s.height;
      if (s.type === 'door') {
        B.push(faceBoxOn(face, at - s.width / 2 - 0.4, at + s.width / 2 + 0.4, y + 0.15, y + 0.3, 'trim', 0.7));
        B.push(faceBoxOn(face, at + s.width / 2 + 0.45, at + s.width / 2 + 0.65, y - 0.25, y - 0.1, 'lightWarm', 0.12));
      } else {
        B.push(faceBoxOn(face, at - s.width / 2 - 0.5, at + s.width / 2 + 0.5, y + 0.05, y + 0.55, 'floorConcrete', 0.12));
        B.push(faceBoxOn(face, at - s.width / 2 - 0.5, at - s.width / 2 - 0.1, 0, y + 0.05, 'floorConcrete', 0.12));
        B.push(faceBoxOn(face, at + s.width / 2 + 0.1, at + s.width / 2 + 0.5, 0, y + 0.05, 'floorConcrete', 0.12));
      }
    }
  }
}

function faceBoxOn(f: Face, t0: number, t1: number, y0: number, y1: number, mat: MatId, thick: number): Box {
  const lo = f.normal > 0 ? f.coord + 0.005 : f.coord - 0.005 - thick;
  const hi = lo + thick;
  return f.alongX ? box([t0, y0, lo], [t1, y1, hi], mat, false) : box([lo, y0, t0], [hi, y1, t1], mat, false);
}

/** 外装板の上端の暗い帯（屋上の縁）。開口には掛からない */
function cladPieceRoof(f: Face, t0: number, t1: number, roof: number, openings: [number, number, number, number][]): Box[] {
  const hit = openings.some((o) => t0 < o[1] && t1 > o[0] && roof - 0.3 < o[3] && roof > o[2]);
  if (hit) return [];
  return [faceBoxOn(f, t0, t1, roof - 0.3, roof, 'wallDark', 0.1)];
}

// ---------------------------------------------------------------- 街灯・車
function lamps(L: RoomLayout, g: Grid, theme: Theme, sockets: Socket[], hole: AABB | undefined): void {
  const ok = (x: number, z: number) => clearOfSockets(sockets, x, z, 2.2) && (!hole || Math.hypot(x - (hole.min[0] + hole.max[0]) / 2, z - (hole.min[2] + hole.max[2]) / 2) > 2);
  let i = 0;
  // 交差点: 各ブロックの角（歩道の上）に 1 灯
  for (let bi = 0; bi < g.nx; bi++) {
    for (let bj = 0; bj < g.nz; bj++) {
      const r = blockRect(g, bi, bj);
      const corners: [number, number, Dir][] = [[r.x0 + 0.4, r.z0 + 0.4, 2], [r.x1 - 0.4, r.z1 - 0.4, 0]];
      for (const [x, z, arm] of corners) {
        if (!ok(x, z)) continue;
        streetLamp(L, x, z, theme.lampH, theme.lampMat, theme.lampColor, theme.lampIntensity, true, arm);
        i++;
      }
      // 街路の中間（長いブロックだけ）
      if (g.bx >= 12) {
        const x = (r.x0 + r.x1) / 2;
        for (const [z, arm] of [[r.z0 + 0.4, 2], [r.z1 - 0.4, 0]] as const) {
          if (!ok(x, z)) continue;
          streetLamp(L, x, z, theme.lampH, theme.lampMat, theme.lampColor, theme.lampIntensity, i % 2 === 0, arm);
          i++;
        }
      }
    }
  }
  // 外周側の街路（外壁沿い）の街灯: 縦街路の外周側の端（入口・出口の脇）
  for (let k = 0; k <= g.nx; k++) {
    const [a, b] = vStreet(g, k);
    for (const z of [g.z0 + 1.0, g.z0 + g.d - 1.0]) {
      const x = k === 0 ? b - 0.5 : a + 0.5;
      if (!ok(x, z)) continue;
      streetLamp(L, x, z, theme.lampH, theme.lampMat, theme.lampColor, theme.lampIntensity, i % 2 === 0, k === 0 ? 1 : 3);
      i++;
    }
  }
}

function parkedCars(out: Box[], g: Grid, sockets: Socket[], hole: AABB | undefined, rng: Rng, chance: number): void {
  for (let bi = 0; bi < g.nx; bi++) {
    for (let bj = 0; bj < g.nz; bj++) {
      if (!rng.chance(chance)) continue;
      const r = blockRect(g, bi, bj);
      const n = rng.int(1, 2);
      for (let c = 0; c < n; c++) {
        const side = rng.int(0, 3);
        let cx: number;
        let cz: number;
        let alongZ: boolean;
        if (side === 0) { cx = rng.float(r.x0 + 3, r.x1 - 3); cz = r.z1 + 1.3; alongZ = false; }
        else if (side === 1) { cx = rng.float(r.x0 + 3, r.x1 - 3); cz = r.z0 - 1.3; alongZ = false; }
        else if (side === 2) { cx = r.x1 + 1.3; cz = rng.float(r.z0 + 3, r.z1 - 3); alongZ = true; }
        else { cx = r.x0 - 1.3; cz = rng.float(r.z0 + 3, r.z1 - 3); alongZ = true; }
        if (!clearOfSockets(sockets, cx, cz, 5.0)) continue;
        if (hole && Math.hypot(cx - (hole.min[0] + hole.max[0]) / 2, cz - (hole.min[2] + hole.max[2]) / 2) < 4) continue;
        car(out, snap(cx), snap(cz), alongZ, rng);
      }
    }
  }
}
