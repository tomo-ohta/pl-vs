/**
 * 部屋の謎（ボタン）と、順番の手がかりを作る（DOM / three を使わない）。
 *
 * - ボタンは 1 つの壁に横 1 列（壁を向いて左から 0, 1, 2…）。難易度 0〜3 で 1 / 3 / 4 / 5 個
 * - 難易度 1: 手がかりはボタンそのもの（点の数・付いている高さ・上の灯りの点滅の回数）。少ない・低い順
 * - 難易度 2: 手がかりは別の壁（色の帯・記号の札・言葉の札・色を変える灯り）。その順にボタンの色・記号を合わせる
 * - 難易度 3: 手がかりが隣の部屋にある（色の帯）/ 2 つの手がかりをつなぐ（記号の並び → 対応表で色）
 * - 正しい順は「左から順」「右から順」にならないようにする（試しに端から押しただけで解けないように）
 * - 手がかりの札には、どの部屋の物かを示す部屋番号を付ける（隣の部屋の手がかりと見分けるため）
 */
import type { Rng } from './rng.ts';
import { SIDES, WALL_T, type Difficulty, type Door, type Rect, type Side } from './types.ts';

export type ColorKey = 'red' | 'blue' | 'green' | 'yellow' | 'white' | 'purple';
export const COLOR_KEYS: readonly ColorKey[] = ['red', 'blue', 'green', 'yellow', 'white', 'purple'];
export const COLOR_NAME: Record<ColorKey, string> = { red: '赤', blue: '青', green: '緑', yellow: '黄', white: '白', purple: '紫' };

export type SymbolKey = 'circle' | 'triangle' | 'square' | 'star' | 'diamond' | 'cross';
export const SYMBOL_KEYS: readonly SymbolKey[] = ['circle', 'triangle', 'square', 'star', 'diamond', 'cross'];
export const SYMBOL_NAME: Record<SymbolKey, string> = {
  circle: '○（丸）', triangle: '△（三角）', square: '□（四角）', star: '☆（星）', diamond: '◇（ひし形）', cross: '×（バツ）',
};

/** 言葉の謎: 言葉 → その言葉が表す色（紛らわしい言葉は避ける: 月は黄か白か分かれるので使わない） */
export const COLOR_WORDS: Record<ColorKey, readonly string[]> = {
  red: ['炎', '苺', '紅葉'],
  blue: ['空', '海'],
  green: ['森', '若葉', '苔'],
  yellow: ['檸檬', '向日葵', '菜の花'],
  white: ['雪', '雲', '塩'],
  purple: ['葡萄', '菫', '茄子'],
};

export type PuzzleKind = 'single' | 'pips' | 'height' | 'blink' | 'stripes' | 'symbols' | 'words' | 'lights' | 'remote' | 'legend';

/** 難易度ごとの謎の型（この表を入れ替えれば、型と難易度の対応を変えられる） */
export const KINDS_BY_DIFFICULTY: Record<Difficulty, readonly PuzzleKind[]> = {
  0: ['single'],
  1: ['pips', 'height', 'blink'],
  2: ['stripes', 'symbols', 'words', 'lights'],
  3: ['remote', 'legend'],
};
export const BUTTON_COUNT: Record<Difficulty, number> = { 0: 1, 1: 3, 2: 4, 3: 5 };

/** ボタンの間隔・既定の高さ（中心。m） */
export const BUTTON_SPACING = 0.5;
export const BUTTON_Y = 1.1;
/** 高さの謎の候補（m） */
export const BUTTON_HEIGHTS: readonly number[] = [0.6, 0.95, 1.3, 1.65];

/** 壁の上の位置。u は部屋の内側から壁を向いて左端からの距離、y は床からの高さ（どちらも m。物の真ん中） */
export interface WallMount {
  room: number;
  side: Side;
  u: number;
  y: number;
}

export interface ButtonSpec {
  mount: WallMount;
  /** ボタンの色（null は色の無い白いボタン） */
  color: ColorKey | null;
  /** ボタンの上の記号の札 */
  symbol: SymbolKey | null;
  /** ボタンの上の点の数（0 は無し） */
  pips: number;
  /** ボタンの上の灯りが 1 回に点滅する回数（0 は灯り無し） */
  blink: number;
}

export type Clue =
  | { kind: 'stripes'; mount: WallMount; forRoom: number; colors: ColorKey[] }
  | { kind: 'symbols'; mount: WallMount; forRoom: number; symbols: SymbolKey[] }
  | { kind: 'words'; mount: WallMount; forRoom: number; words: string[] }
  | { kind: 'lights'; mount: WallMount; forRoom: number; colors: ColorKey[] }
  | { kind: 'legend'; mount: WallMount; forRoom: number; rows: { symbol: SymbolKey; color: ColorKey }[] };

export interface Puzzle {
  room: number;
  kind: PuzzleKind;
  difficulty: Difficulty;
  /** ボタンを付けた壁 */
  side: Side;
  /** ボタン（壁を向いて左から順） */
  buttons: ButtonSpec[];
  /** 正しく押す順（buttons の添字） */
  answer: number[];
  /** 手がかり（remote は隣の部屋の壁にある） */
  clues: Clue[];
  /** remote の手がかりを置いた隣の部屋（無ければ -1） */
  remote: number;
}

// ---------------------------------------------------------------- 壁の形

export const wallLength = (r: Rect, side: Side): number => (side === 'N' || side === 'S' ? r.w : r.d);

/** 壁の上の u（左端から）の、壁の内側の面の点と、部屋の内側へ向く法線 */
export function wallPoint(r: Rect, side: Side, u: number): { x: number; z: number; nx: number; nz: number } {
  switch (side) {
    case 'N':
      return { x: r.x + u, z: r.z + WALL_T, nx: 0, nz: 1 };
    case 'S':
      return { x: r.x + r.w - u, z: r.z + r.d - WALL_T, nx: 0, nz: -1 };
    case 'E':
      return { x: r.x + r.w - WALL_T, z: r.z + u, nx: -1, nz: 0 };
    case 'W':
      return { x: r.x + WALL_T, z: r.z + r.d - u, nx: 1, nz: 0 };
  }
}

/** 扉が部屋 r のどの壁にあるか */
export function doorSide(r: Rect, d: Door): Side {
  if (d.vertical) return d.at === r.x + r.w ? 'E' : 'W';
  return d.at === r.z ? 'N' : 'S';
}

/** 扉の真ん中の、その壁の上の u */
export function doorU(r: Rect, side: Side, d: Door): number {
  switch (side) {
    case 'N':
      return d.c - r.x;
    case 'S':
      return r.x + r.w - d.c;
    case 'E':
      return d.c - r.z;
    case 'W':
      return r.z + r.d - d.c;
  }
}

// ---------------------------------------------------------------- 壁の空き

/** 壁の端（壁の厚みの先）・扉の縁・ほかの物との間（m） */
const END_MARGIN = 0.35;
const DOOR_CLEAR = 0.3;
const ITEM_GAP = 0.35;

type Interval = [number, number];

function cut(iv: Interval[], a: number, b: number): Interval[] {
  const out: Interval[] = [];
  for (const [s, e] of iv) {
    if (b <= s || a >= e) out.push([s, e]);
    else {
      if (a > s) out.push([s, a]);
      if (b < e) out.push([b, e]);
    }
  }
  return out;
}

/** 部屋ごと・壁ごとの空き（物を付けられる u の区間） */
export class WallSlots {
  private readonly free = new Map<string, Interval[]>();

  constructor(rects: readonly Rect[], doors: readonly Door[]) {
    rects.forEach((r, i) => {
      for (const side of SIDES) {
        const len = wallLength(r, side);
        this.free.set(`${i}${side}`, [[WALL_T + END_MARGIN, len - WALL_T - END_MARGIN]]);
      }
    });
    for (const d of doors) {
      for (const i of [d.a, d.b]) {
        const r = rects[i];
        const side = doorSide(r, d);
        const u = doorU(r, side, d);
        const k = `${i}${side}`;
        this.free.set(k, cut(this.free.get(k)!, u - d.width / 2 - DOOR_CLEAR, u + d.width / 2 + DOOR_CLEAR));
      }
    }
  }

  /** その壁の一番長い空き（m） */
  longest(room: number, side: Side): number {
    let m = 0;
    for (const [s, e] of this.free.get(`${room}${side}`)!) m = Math.max(m, e - s);
    return m;
  }

  /** 幅 width が入る壁（avoid を除く）。長い空きほど選ばれやすい */
  pickSide(room: number, width: number, rng: Rng, avoid: readonly Side[] = []): Side | null {
    const ok = SIDES.filter((s) => !avoid.includes(s) && this.longest(room, s) >= width);
    if (!ok.length) return null;
    return rng.weighted(ok.map((s) => [s, this.longest(room, s) - width + 0.2] as const));
  }

  /** 今の空きの控え（区間の配列は書き換えずに作り直すので、浅い写しでよい） */
  snapshot(): Map<string, Interval[]> {
    return new Map(this.free);
  }

  restore(snap: Map<string, Interval[]>): void {
    this.free.clear();
    for (const [k, v] of snap) this.free.set(k, v);
  }

  /** 壁に幅 width の物を付ける。真ん中の u（入らなければ null） */
  take(room: number, side: Side, width: number, rng: Rng): number | null {
    const k = `${room}${side}`;
    const fits = this.free.get(k)!.filter(([s, e]) => e - s >= width);
    if (!fits.length) return null;
    const [s, e] = rng.weighted(fits.map((iv) => [iv, iv[1] - iv[0] - width + 0.05] as const));
    const c = Math.round(rng.range(s + width / 2, e - width / 2) * 100) / 100;
    this.free.set(k, cut(this.free.get(k)!, c - width / 2 - ITEM_GAP, c + width / 2 + ITEM_GAP));
    return c;
  }
}

// ---------------------------------------------------------------- 物の幅（壁に沿った m）

export const rowWidth = (n: number): number => (n - 1) * BUTTON_SPACING + 0.5;
export const CLUE_WIDTH = {
  stripes: (n: number): number => n * 0.2 + 0.3,
  symbols: 0.5,
  words: 0.8,
  lights: 0.5,
  legend: 0.9,
} as const;
/** 手がかりの高さ（中心。m） */
export const CLUE_Y = { stripes: 1.5, symbols: 1.45, words: 1.45, lights: 1.95, legend: 1.45 } as const;

/** 難易度ごとに要る空き: [ボタンの壁の一番長い空き, ほかの壁の一番長い空き]（入らない部屋には置かない） */
export const NEED: Record<Difficulty, readonly [number, number]> = {
  0: [rowWidth(1), 0],
  1: [rowWidth(3), 0],
  2: [rowWidth(4), CLUE_WIDTH.stripes(4)],
  3: [rowWidth(5), CLUE_WIDTH.legend],
};

/** 部屋の空き: 一番長い空き と、それとは別の壁の一番長い空き */
export function roomCapacity(slots: WallSlots, room: number): [number, number] {
  const ls = SIDES.map((s) => slots.longest(room, s)).sort((a, b) => b - a);
  return [ls[0], ls[1]];
}

// ---------------------------------------------------------------- 謎を作る

const isTrivial = (answer: readonly number[]): boolean =>
  answer.length >= 3 && (answer.every((v, i) => v === i) || answer.every((v, i) => v === answer.length - 1 - i));

/** 端から順にならない並び（0..n-1 の並べ替え） */
function orderNotTrivial(n: number, rng: Rng): number[] {
  for (;;) {
    const p = rng.shuffle([...Array(n).keys()]);
    if (!isTrivial(p)) return p;
  }
}

/** 値の小さい順のボタンの添字（値はすべて違う） */
const ascending = (vals: readonly number[]): number[] => [...vals.keys()].sort((a, b) => vals[a] - vals[b]);

interface Ctx {
  rects: readonly Rect[];
  doors: readonly Door[];
  /** 部屋ごとの扉の添字 */
  roomDoors: readonly number[][];
  slots: WallSlots;
  rng: Rng;
}

/** 部屋 room に、型 kind の謎を置く（置けなければ null。使いかけた空きは戻す） */
function build(ctx: Ctx, room: number, kind: PuzzleKind, difficulty: Difficulty): Puzzle | null {
  const snap = ctx.slots.snapshot();
  const p = buildIn(ctx, room, kind, difficulty);
  if (!p) ctx.slots.restore(snap);
  return p;
}

function buildIn(ctx: Ctx, room: number, kind: PuzzleKind, difficulty: Difficulty): Puzzle | null {
  const { slots, rng } = ctx;
  const n = BUTTON_COUNT[difficulty];
  const side = slots.pickSide(room, rowWidth(n), rng);
  if (!side) return null;
  const c = slots.take(room, side, rowWidth(n), rng)!;
  const mountAt = (k: number, y = BUTTON_Y): WallMount => ({ room, side, u: c + (k - (n - 1) / 2) * BUTTON_SPACING, y });
  const blank = (k: number): ButtonSpec => ({ mount: mountAt(k), color: null, symbol: null, pips: 0, blink: 0 });
  const buttons: ButtonSpec[] = [...Array(n).keys()].map(blank);
  const clues: Clue[] = [];
  let answer: number[] = [0];
  let remote = -1;

  /** 部屋 at の、ボタンの壁以外（無理ならどこでも）に手がかりを付ける */
  const placeClue = (at: number, width: number, avoid: Side[]): { side: Side; u: number } | null => {
    const s = slots.pickSide(at, width, rng, avoid) ?? slots.pickSide(at, width, rng);
    if (!s) return null;
    return { side: s, u: slots.take(at, s, width, rng)! };
  };
  const colors = (): ColorKey[] => rng.shuffle([...COLOR_KEYS]).slice(0, n);

  switch (kind) {
    case 'single':
      break;
    case 'pips':
    case 'blink': {
      // 1〜n を、少ない順に押すと端から順にならないように並べる
      const vals = orderNotTrivial(n, rng).map((v) => v + 1);
      vals.forEach((v, k) => (kind === 'pips' ? (buttons[k].pips = v) : (buttons[k].blink = v)));
      answer = ascending(vals);
      break;
    }
    case 'height': {
      const hs = rng.shuffle([...BUTTON_HEIGHTS]).slice(0, n).sort((a, b) => a - b);
      const order = orderNotTrivial(n, rng);
      order.forEach((rank, k) => (buttons[k].mount = mountAt(k, hs[rank])));
      answer = ascending(order);
      break;
    }
    case 'stripes':
    case 'words':
    case 'lights':
    case 'symbols': {
      // ボタンの色（記号）は左から適当に、正しい順は端から順にならない並べ替え
      answer = orderNotTrivial(n, rng);
      const width = kind === 'stripes' ? CLUE_WIDTH.stripes(n) : CLUE_WIDTH[kind];
      const at = placeClue(room, width, [side]);
      if (!at) return null;
      const mount: WallMount = { room, side: at.side, u: at.u, y: CLUE_Y[kind] };
      if (kind === 'symbols') {
        const syms = rng.shuffle([...SYMBOL_KEYS]).slice(0, n);
        syms.forEach((s, k) => (buttons[k].symbol = s));
        clues.push({ kind, mount, forRoom: room, symbols: answer.map((k) => syms[k]) });
      } else {
        const cs = colors();
        cs.forEach((col, k) => (buttons[k].color = col));
        const seq = answer.map((k) => cs[k]);
        if (kind === 'words') clues.push({ kind, mount, forRoom: room, words: seq.map((col) => rng.pick(COLOR_WORDS[col])) });
        else clues.push({ kind, mount, forRoom: room, colors: seq });
      }
      break;
    }
    case 'remote': {
      // 扉でつながった隣の部屋のうち、色の帯が入る部屋を選ぶ
      const width = CLUE_WIDTH.stripes(n);
      const nbs = rng.shuffle(ctx.roomDoors[room].map((di) => (ctx.doors[di].a === room ? ctx.doors[di].b : ctx.doors[di].a)));
      const nb = nbs.find((j) => SIDES.some((s) => slots.longest(j, s) >= width));
      if (nb === undefined) return null;
      const at = placeClue(nb, width, [])!;
      answer = orderNotTrivial(n, rng);
      const cs = colors();
      cs.forEach((col, k) => (buttons[k].color = col));
      clues.push({ kind: 'stripes', mount: { room: nb, side: at.side, u: at.u, y: CLUE_Y.stripes }, forRoom: room, colors: answer.map((k) => cs[k]) });
      remote = nb;
      break;
    }
    case 'legend': {
      // 記号の並び（札 A）と、記号 → 色の対応表（札 B）。ボタンは色だけ
      const a = placeClue(room, CLUE_WIDTH.symbols, [side]);
      if (!a) return null;
      const b = placeClue(room, CLUE_WIDTH.legend, [side, a.side]);
      if (!b) return null;
      answer = orderNotTrivial(n, rng);
      const cs = colors();
      cs.forEach((col, k) => (buttons[k].color = col));
      const syms = rng.shuffle([...SYMBOL_KEYS]).slice(0, n);
      // 押す順の k 番目のボタンの色 ↔ 記号 syms[k]。対応表の行は並びと別の順にする
      const pairs = answer.map((btn, k) => ({ symbol: syms[k], color: cs[btn] }));
      const rowOrder = orderNotTrivial(n, rng);
      clues.push({ kind: 'symbols', mount: { room, side: a.side, u: a.u, y: CLUE_Y.symbols }, forRoom: room, symbols: syms });
      clues.push({ kind: 'legend', mount: { room, side: b.side, u: b.u, y: CLUE_Y.legend }, forRoom: room, rows: rowOrder.map((k) => pairs[k]) });
      break;
    }
  }
  return { room, kind, difficulty, side, buttons, answer, clues, remote };
}

/**
 * 全部屋の謎を作る。difficulty は入らない部屋があれば入れ替える（数は変えない。start の部屋は 0 のまま）
 * 難しい部屋から先に置く（広い空きと、隣の部屋の空きを先に使う）
 */
export function generatePuzzles(
  rects: readonly Rect[],
  doors: readonly Door[],
  difficulty: Difficulty[],
  rng: Rng,
  start = 0,
): Puzzle[] {
  const roomDoors: number[][] = rects.map(() => []);
  doors.forEach((d, i) => {
    roomDoors[d.a].push(i);
    roomDoors[d.b].push(i);
  });
  const slots = new WallSlots(rects, doors);
  const ctx: Ctx = { rects, doors, roomDoors, slots, rng };

  // 入らない部屋の難易度を、入る易しい部屋と入れ替える
  const fits = (room: number, d: Difficulty): boolean => {
    const [l1, l2] = roomCapacity(slots, room);
    return l1 >= NEED[d][0] && l2 >= NEED[d][1];
  };
  for (const d of [3, 2, 1] as Difficulty[]) {
    for (let i = 0; i < rects.length; i++) {
      if (difficulty[i] !== d || fits(i, d)) continue;
      const swap = rng
        .shuffle([...rects.keys()])
        .find((j) => j !== start && difficulty[j] < d && fits(j, d) && fits(i, difficulty[j]));
      if (swap === undefined) throw new Error(`難易度 ${d} の謎が入る部屋が足りない`);
      [difficulty[i], difficulty[swap]] = [difficulty[swap], difficulty[i]];
    }
  }

  // 型は難易度ごとに順に回して偏りを減らす
  const queues = new Map<Difficulty, PuzzleKind[]>();
  const nextKind = (d: Difficulty): PuzzleKind => {
    let q = queues.get(d);
    if (!q || !q.length) queues.set(d, (q = rng.shuffle([...KINDS_BY_DIFFICULTY[d]])));
    return q.pop()!;
  };

  const out: Puzzle[] = new Array(rects.length);
  const order = [...rects.keys()].sort((a, b) => difficulty[b] - difficulty[a]);
  for (const i of order) {
    const d = difficulty[i];
    let kind = nextKind(d);
    let p = build(ctx, i, kind, d);
    // 隣の部屋に置けなければ、2 つの手がかりをつなぐ型へ
    if (!p && kind === 'remote') p = build(ctx, i, (kind = 'legend'), d);
    if (!p) throw new Error(`部屋 ${i} に謎（${kind}）を置けなかった`);
    out[i] = p;
  }
  return out;
}
