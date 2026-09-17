/** DynamicGridGenerator（DynamicGrid: M07 動くマップタイル）。
 *
 *  方針（implementation-analysis「DynamicGridGenerator」/ v1.3 D25）:
 *  - 足跡は単一矩形（9〜33 m）。内部を 3 m セルの格子に分割し、外周 1 セル幅は固定の回廊（静的床）にする。
 *    entry と出口ソケットは回廊の外壁上で 3 m グリッド線（セル境界）に揃えて置く。外殻・ソケット・footprint・bounds は不動
 *    （入室後に部屋が変わらない不変条件）。
 *  - 内部セルには床から天井までの壁ブロック（1.7 m 角、wallWhite）を市松状に置き、一部を欠けさせる（広場）。
 *    各行（または各列）から 1 ブロックを rng で選び L.dynamics（'slide'、solid、振幅 = 1〜2 セル、speed は MovingWalls の params）に登録する。
 *    市松 + 1.7 m 角 → 隣り合うセルのブロック同士の隙間は常に 1.3 m（通路 1.2 m 以上）。可動ブロックは内部セルの間だけを往復し、
 *    回廊（幅 3 m）には出ないので、扉前（±1.6 m × 奥行 1.8 m）に掃引範囲が入ることはない。可動ブロックは最大 8 個。
 *  - 可動要素の id は 'MovingWalls:grid<n>'。同じ部屋に付く MovingWalls Modifier は L.dynamics があれば layout フックで追加せず、
 *    build フックで id 'MovingWalls:*' の要素の駆動を引き取る（takeOverDynamics: 次の位置がプレイヤーと重なるなら止まる規則）。
 *    RoomBuilder 単独でも同じ波形で動く（停止規則だけ無くなる）。
 *  - 床は floorTile、セル境界に細い溝（非ソリッドの暗い帯）、回廊と可動域の境界に黄線、可動ブロックの軌道に金属レール。
 *    照明は回廊の各セルと、ブロックにも掃引範囲にも掛からない内部の空きセルの天井にだけ置く（動くブロックに飲み込まれる灯を作らない）。
 *  - 床穴は出さない（M07 は allowHole=false 扱い。hole の落下先にも含めない）。多層なし。
 *  - Variant 0..5 = 10 / 8 / 6 / 5 / 4 / 3 セル角（30 / 24 / 18 / 15 / 12 / 9 m。もう一方の辺は seed で ±1 セル）。
 *  - 決定論: 乱数は p.rng を 'v<variant>' で fork した vr（と、その 'blocks' / 'lights' fork）だけを使う。
 */
import type { Dir, Socket, Vec3 } from '../core/types';
import type { AABB } from '../core/aabb';
import type { Rng } from '../core/rng';
import { buildShell, footprintAABB, rect, socketOnSpan, wallSpans, type Rect, type WallSpan } from './footprint';
import { clearDoorways, labelAtEntry, makeEntry } from './common';
import { box, bonusExits, DOOR_W, emptyLayout, lightPanel, WALL_T, type DynamicSpec, type GenParams, type Palette, type RoomLayout, type SignSpec } from './layout';

/** バリアント数（WorldManager が 0..n-1 を大きい順に試す） */
export const variants = 6;

/** セル一辺（m）。回廊幅も 1 セル */
export const CELL = 3.0;
/** 壁ブロックの一辺（m）。隣接セルのブロックとの隙間 = CELL - BLOCK = 1.3 m ≥ 通路 1.2 m */
export const BLOCK = 1.7;
/** 可動ブロックの上限（描画は個別 Mesh。Tier に依らず） */
export const MAX_MOVERS = 8;
/** バリアント → 基準セル数 */
const CELLS: number[] = [10, 8, 6, 5, 4, 3];
/** MovingWalls の既定速度（m/s。M07 の params.speed = 0.5） */
const DEFAULT_SPEED = 0.5;
/** 可動要素 id の接頭辞（MovingWalls Modifier の build フックが 'MovingWalls:' で始まる id を引き取る） */
export const MOVER_ID_PREFIX = 'MovingWalls:grid';

type CellState = 'free' | 'block' | 'keep';

interface Grid {
  nx: number;
  nz: number;
  /** グリッド線（x）。gx[0] = x0, gx[nx] = x1 */
  gx: number[];
  gz: number[];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** グリッド線。外周 1 セルは残り幅を吸収する（mainRect が 3 m の倍数でないとき回廊が広がる） */
function gridLines(a0: number, a1: number, n: number): number[] {
  const inner = (n - 2) * CELL;
  const ring = ((a1 - a0) - inner) / 2;
  const out: number[] = [a0];
  for (let k = 1; k < n; k++) out.push(a0 + ring + (k - 1) * CELL);
  out.push(a1);
  return out;
}

function cellCenter(g: number[], i: number): number {
  return (g[i] + g[i + 1]) / 2;
}

/** MovingWalls の速度パラメータ（部屋定義の modifiers[] から。無ければ既定） */
function movingWallsSpeed(p: GenParams): number {
  const ref = (p.def.modifiers ?? []).find((m) => m.id === 'MovingWalls');
  const v = ref?.params?.speed;
  return clamp(typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_SPEED, 0.05, 2.0);
}

export function generateDynamicGrid(p: GenParams): RoomLayout {
  const { rng } = p;
  // 見た目のパレット: 格子タイル床 + 白壁 + 天井タイル（fallback ではないので placeholder は来ない）
  const palette: Palette = { ...p.palette, floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingTile' };
  const L = emptyLayout(palette);
  const vr = rng.fork(`v${p.variant}`);
  const h = p.variant <= 1 ? 3.4 : 3.0;

  // ---- 足跡（単一矩形）。x = 0 がグリッド線になるように左右のセル数を分ける（entry がセル境界に乗る）
  let main: Rect;
  let nx: number;
  let nz: number;
  const baseN = CELLS[clamp(p.variant, 0, CELLS.length - 1)];
  const nzRoll = clamp(baseN + vr.int(-1, 1), 3, 11);
  if (p.mainRect) {
    main = rect(p.mainRect.x0, p.mainRect.z0, p.mainRect.x1, p.mainRect.z1);
    nx = Math.max(3, Math.floor((main.x1 - main.x0) / CELL));
    nz = Math.max(3, Math.floor((main.z1 - main.z0) / CELL));
  } else {
    nx = baseN;
    nz = nzRoll;
    const nxL = Math.floor(nx / 2);
    main = rect(-nxL * CELL, 0, (nx - nxL) * CELL, nz * CELL);
  }
  const grid: Grid = { nx, nz, gx: gridLines(main.x0, main.x1, nx), gz: gridLines(main.z0, main.z1, nz) };
  const rects: Rect[] = [main];
  L.footprint = rects;
  L.height = h;
  L.bounds = footprintAABB(rects, h);
  const area = (main.x1 - main.x0) * (main.z1 - main.z0);

  // ---- 入口・出口（外壁のグリッド線上）
  const { entry, ceilingHole } = makeEntry(p, main, 0, h);
  let sockets: Socket[] = [entry, ...p.extraSockets];
  const exits = Math.min(4, Math.max(1, p.exits) + bonusExits(area));
  sockets.push(...placeGridExits(grid, rects, sockets, exits, vr));
  sockets = sockets.filter((s) => !p.removedSockets.includes(s.id));
  L.sockets = sockets;
  // 床穴は出さない（holeLocal も来ない）。天井穴（hole で入る場合）だけ受ける
  buildShell(L.boxes, rects, h, sockets, { floor: palette.floor, wall: palette.wall, ceiling: palette.ceiling, floorHoles: [], ceilingHoles: ceilingHole ? [ceilingHole] : [] });
  const shellCount = L.boxes.length;
  L.shellCount = shellCount;

  // ---- 内部セルの状態（市松 + 欠け + 着地点）
  const br = vr.fork('blocks');
  const parity = br.int(0, 1);
  const state: CellState[][] = Array.from({ length: nx }, () => Array<CellState>(nz).fill('free'));
  const landing: Vec3 | null = ceilingHole ? [(ceilingHole.min[0] + ceilingHole.max[0]) / 2, 0, (ceilingHole.min[2] + ceilingHole.max[2]) / 2] : null;
  for (let ix = 1; ix < nx - 1; ix++) {
    for (let iz = 1; iz < nz - 1; iz++) {
      const cx = cellCenter(grid.gx, ix);
      const cz = cellCenter(grid.gz, iz);
      if (landing && Math.hypot(landing[0] - cx, landing[2] - cz) < 2.4) {
        state[ix][iz] = 'keep';
        continue;
      }
      if ((ix + iz) % 2 === parity && !br.chance(0.12)) state[ix][iz] = 'block';
    }
  }

  // ---- 可動ブロック（各行または各列から 1 個。最大 8）
  const speed = movingWallsSpeed(p);
  const alongRows = br.chance(0.5);
  const movers = pickMovers(grid, state, alongRows, br);
  const dynamics: DynamicSpec[] = [];
  const swept = new Set<string>();
  const top = h - 0.05;
  movers.forEach((m, i) => {
    const cx = cellCenter(grid.gx, m.ix);
    const cz = cellCenter(grid.gz, m.iz);
    const b = box([cx - BLOCK / 2, 0, cz - BLOCK / 2], [cx + BLOCK / 2, top, cz + BLOCK / 2], 'wallWhite', true);
    const axis: Vec3 = alongRows ? [m.sign, 0, 0] : [0, 0, m.sign];
    const amplitude = m.travel * CELL;
    dynamics.push({
      id: `${MOVER_ID_PREFIX}${i}`,
      box: b,
      motion: { kind: br.chance(0.8) ? 'slide' : 'oscillate', axis, amplitude, period: Math.max(2, (2 * amplitude) / speed), phase: br.next() },
      solid: true,
    });
    // 掃引セル（照明を置かない）と軌道レール
    for (let k = 0; k <= m.travel; k++) swept.add(alongRows ? `${m.ix + k * m.sign},${m.iz}` : `${m.ix},${m.iz + k * m.sign}`);
    const ex = cx + (alongRows ? m.sign * amplitude : 0);
    const ez = cz + (alongRows ? 0 : m.sign * amplitude);
    L.boxes.push(box([Math.min(cx, ex) - (alongRows ? BLOCK / 2 : 0.1), 0.001, Math.min(cz, ez) - (alongRows ? 0.1 : BLOCK / 2)], [Math.max(cx, ex) + (alongRows ? BLOCK / 2 : 0.1), 0.012, Math.max(cz, ez) + (alongRows ? 0.1 : BLOCK / 2)], 'metal', false));
  });
  if (dynamics.length) L.dynamics = dynamics;
  // 固定ブロック（可動に選ばれたセルは除く）
  const moverCells = new Set(movers.map((m) => `${m.ix},${m.iz}`));
  for (let ix = 1; ix < nx - 1; ix++) {
    for (let iz = 1; iz < nz - 1; iz++) {
      if (state[ix][iz] !== 'block' || moverCells.has(`${ix},${iz}`)) continue;
      const cx = cellCenter(grid.gx, ix);
      const cz = cellCenter(grid.gz, iz);
      L.boxes.push(box([cx - BLOCK / 2, 0, cz - BLOCK / 2], [cx + BLOCK / 2, top, cz + BLOCK / 2], 'wallWhite', true));
    }
  }

  // ---- 床の格子模様: セル境界の溝（暗い細帯）と回廊 / 可動域の境界の黄線
  const ix0 = main.x0 + WALL_T, ix1 = main.x1 - WALL_T, iz0 = main.z0 + WALL_T, iz1 = main.z1 - WALL_T;
  for (let k = 1; k < nx; k++) L.boxes.push(box([grid.gx[k] - 0.04, 0.001, iz0], [grid.gx[k] + 0.04, 0.01, iz1], 'furnitureDark', false));
  for (let k = 1; k < nz; k++) L.boxes.push(box([ix0, 0.001, grid.gz[k] - 0.04], [ix1, 0.01, grid.gz[k] + 0.04], 'furnitureDark', false));
  const fx0 = grid.gx[1], fx1 = grid.gx[nx - 1], fz0 = grid.gz[1], fz1 = grid.gz[nz - 1];
  const yl = 0.06;
  L.boxes.push(box([fx0 - yl, 0.002, fz0 - yl], [fx1 + yl, 0.011, fz0 + yl], 'yellowLine', false));
  L.boxes.push(box([fx0 - yl, 0.002, fz1 - yl], [fx1 + yl, 0.011, fz1 + yl], 'yellowLine', false));
  L.boxes.push(box([fx0 - yl, 0.002, fz0 - yl], [fx0 + yl, 0.011, fz1 + yl], 'yellowLine', false));
  L.boxes.push(box([fx1 - yl, 0.002, fz0 - yl], [fx1 + yl, 0.011, fz1 + yl], 'yellowLine', false));
  // 天井穴の着地点に目印の箔は置かない（床材が変わったように見えるため）

  // ---- ゾーン（地図の内訳線 / Modifier の受け皿）: 可動域 = 内部セル全体
  const field: AABB = { min: [fx0, 0, fz0], max: [fx1, h, fz1] };
  L.zones = [{ kind: 'theme', aabb: field, params: { preset: 'grid', role: 'field', cells: [nx - 2, nz - 2], movers: dynamics.length } }];

  clearDoorways(L, sockets, shellCount);

  // ---- 照明: 回廊の各セル + ブロックにも掃引範囲にも掛からない内部の空きセル
  const lr = vr.fork('lights');
  const offChance = /一部消灯|低照度|暗/.test(p.def.lightingPreset) ? 0.3 : 0.05;
  let li = 0;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const ring = ix === 0 || iz === 0 || ix === nx - 1 || iz === nz - 1;
      if (!ring && (state[ix][iz] === 'block' || swept.has(`${ix},${iz}`))) continue;
      // 回廊は市松で間引く（角は常に点ける）
      const corner = (ix === 0 || ix === nx - 1) && (iz === 0 || iz === nz - 1);
      if (ring && !corner && (ix + iz) % 2 === 1) continue;
      const cx = cellCenter(grid.gx, ix);
      const cz = cellCenter(grid.gz, iz);
      const off = lr.chance(offChance);
      lightPanel(L.boxes, cx, cz, 1.2, 0.6, h, off ? 'lightOff' : palette.light);
      if (!off && li % 3 === 0) L.lights.push({ pos: [cx, h - 0.4, cz], color: palette.lightColor, intensity: palette.lightIntensity, distance: CELL * 4 });
      li++;
    }
  }

  // ---- 壁のベイ表示（銘板。2 セルごと。x 側は英字、z 側は数字）
  L.signs = baySigns(grid, main, sockets);

  labelAtEntry(L, entry, 2.6, p.label);
  return L;
}

// ---------------------------------------------------------------- 出口

/** 外壁のグリッド線上に出口を置く。入口の辺（dir 2）は最後に回す */
function placeGridExits(grid: Grid, rects: Rect[], existing: Socket[], count: number, rng: Rng): Socket[] {
  const spans = wallSpans(rects);
  const spanOf = (d: Dir): WallSpan | undefined => spans.find((s) => s.edge.dir === d);
  const order: Dir[] = [...rng.shuffle<Dir>([0, 1, 3]), 2];
  const out: Socket[] = [];
  const all = [...existing];
  const candidates = (d: Dir): number[] => {
    const lines = d === 0 || d === 2 ? grid.gx : grid.gz;
    const n = d === 0 || d === 2 ? grid.nx : grid.nz;
    const res: number[] = [];
    for (let k = 1; k < n; k++) {
      const t = lines[k];
      const coord = spanOf(d)?.edge.coord ?? 0;
      const clash = all.some((s) => s.dir === d && Math.abs((d === 0 || d === 2 ? s.pos[2] : s.pos[0]) - coord) < 0.05 && Math.abs((d === 0 || d === 2 ? s.pos[0] : s.pos[2]) - t) < (s.width + DOOR_W) / 2 + 1.4);
      if (!clash) res.push(t);
    }
    return res;
  };
  let guard = 0;
  let i = 0;
  while (out.length < count && guard++ < count * 8) {
    const d = order[i++ % order.length];
    const span = spanOf(d);
    if (!span) continue;
    const cands = candidates(d);
    if (cands.length === 0) continue;
    const t = rng.pick(cands);
    const s = socketOnSpan(`exit${out.length}`, 'door', span, t);
    out.push(s);
    all.push(s);
  }
  return out;
}

// ---------------------------------------------------------------- 可動ブロックの選択

interface Mover {
  ix: number;
  iz: number;
  /** 移動方向（+1 / -1。行なら x、列なら z） */
  sign: 1 | -1;
  /** 移動セル数（1〜2） */
  travel: number;
}

/** 各行（alongRows）または各列から、隣の内部セルが空いているブロックを 1 個ずつ選ぶ（最大 MAX_MOVERS） */
function pickMovers(grid: Grid, state: CellState[][], alongRows: boolean, rng: Rng): Mover[] {
  const { nx, nz } = grid;
  const lines = alongRows ? nz : nx; // 行数 / 列数
  const inner = (i: number, n: number) => i >= 1 && i <= n - 2;
  const cellState = (a: number, b: number): CellState | null => {
    const ix = alongRows ? a : b;
    const iz = alongRows ? b : a;
    if (!inner(ix, nx) || !inner(iz, nz)) return null;
    return state[ix][iz];
  };
  const perLine: Mover[][] = [];
  for (let b = 1; b < lines - 1; b++) {
    const cands: Mover[] = [];
    const along = alongRows ? nx : nz;
    for (let a = 1; a < along - 1; a++) {
      if (cellState(a, b) !== 'block') continue;
      for (const sign of [1, -1] as const) {
        if (cellState(a + sign, b) !== 'free') continue;
        const two = cellState(a + 2 * sign, b) === 'free';
        cands.push({ ix: alongRows ? a : b, iz: alongRows ? b : a, sign, travel: two && rng.chance(0.4) ? 2 : 1 });
      }
    }
    if (cands.length) perLine.push(cands);
  }
  // 行 / 列を最大 8 本選び、各 1 個
  const chosenLines = perLine.length > MAX_MOVERS ? rng.shuffle(perLine.map((c, i) => ({ c, i }))).slice(0, MAX_MOVERS).sort((p, q) => p.i - q.i).map((x) => x.c) : perLine;
  const out: Mover[] = [];
  for (const cands of chosenLines) out.push(rng.pick(cands));
  return out;
}

// ---------------------------------------------------------------- 銘板

/** 扉（入口ラベル・DynamicMapNode の扉上サイン）の近く ±1.8 m には置かない */
function baySigns(grid: Grid, main: Rect, sockets: Socket[]): SignSpec[] {
  const out: SignSpec[] = [];
  const y = 2.45;
  const inset = WALL_T + 0.012;
  const letter = (k: number) => String.fromCharCode(65 + ((k - 1) % 26));
  const number = (k: number) => String(k).padStart(2, '0');
  const nearDoor = (d: Dir, t: number) => sockets.some((s) => s.dir === d && Math.abs((d === 0 || d === 2 ? s.pos[0] : s.pos[2]) - t) < 1.8);
  for (let k = 2; k < grid.nx; k += 2) {
    const x = grid.gx[k];
    if (!nearDoor(0, x)) out.push({ id: `bay:n:${k}`, text: letter(k), pos: [x, y, main.z1 - inset], dir: 2, width: 0.5, kind: 'plate' });
    if (!nearDoor(2, x)) out.push({ id: `bay:s:${k}`, text: letter(k), pos: [x, y, main.z0 + inset], dir: 0, width: 0.5, kind: 'plate' });
  }
  for (let k = 2; k < grid.nz; k += 2) {
    const z = grid.gz[k];
    if (!nearDoor(1, z)) out.push({ id: `bay:e:${k}`, text: number(k), pos: [main.x1 - inset, y, z], dir: 3, width: 0.5, kind: 'plate' });
    if (!nearDoor(3, z)) out.push({ id: `bay:w:${k}`, text: number(k), pos: [main.x0 + inset, y, z], dir: 1, width: 0.5, kind: 'plate' });
  }
  return out;
}
