/**
 * 部屋ごとのヒント 1〜3 の文（DOM / three を使わない）。型ごとの文の型に、その部屋の具体（壁の方角・色・記号・隣の部屋）を入れる。
 *
 * - ヒント 1: 抽象的（何に目を向けるか）。難易度 1 の部屋は、これだけで解けるように
 * - ヒント 2: どこの何を見るか（壁の方角・手がかりの種類）。難易度 2 の部屋は、ここまでで解けるように
 * - ヒント 3: 決まりをはっきり言い、最初の 1〜2 手を明かす（答えを全部は書かない）。難易度 3 の部屋は、ここまでで解けるように
 *
 * 文面を変えるときは、このファイルの TEMPLATES だけを書き換える
 */
import { COLOR_NAME, SYMBOL_NAME, doorSide, type Clue, type Puzzle, type PuzzleKind } from './puzzles.ts';
import type { Rng } from './rng.ts';
import { fmtId, type Door, type Rect, type Side } from './types.ts';

export const SIDE_NAME: Record<Side, string> = { N: '北', E: '東', S: '南', W: '西' };

export type Hints = [string, string, string];

/** 文の型に入れる値 */
interface Facts {
  /** ボタンの壁 */
  wall: string;
  /** 最初・2 番目に押すボタンの、左から何番目か */
  p1: number;
  p2: number;
  /** 手がかりの壁（1 つ目・2 つ目） */
  clueWall: string;
  clueWall2: string;
  /** 最初・2 番目に押すボタンの色・記号の名前 */
  c1: string;
  c2: string;
  s1: string;
  s2: string;
  /** 言葉の謎の最初の言葉 */
  w1: string;
  /** 隣の部屋（番号）と、そこへの扉の壁 */
  nid: string;
  doorWall: string;
  /** この部屋の番号 */
  rid: string;
}

type Template = (f: Facts) => Hints;

/** 型ごとの文。ヒント 1 は言い方を 2 つ用意して、部屋ごとに選ぶ */
export const TEMPLATES: Record<PuzzleKind, { h1: readonly string[]; rest: (f: Facts) => [string, string] }> = {
  single: {
    h1: ['この部屋の仕掛けは、たったひとつ。', '難しく考えなくていい。目の前のものに触れてみよう。'],
    rest: (f) => [`${f.wall}の壁を探そう。`, `${f.wall}の壁のボタンを押すだけで制圧できる。`],
  },
  pips: {
    h1: ['数えられるものには、意味がある。', '小さな印の多い少ないに目を向けよう。'],
    rest: (f) => [
      'ボタンの上に刻まれた点の数を見比べよう。',
      `点の少ないボタンから順に押す。最初は${f.wall}の壁の左から${f.p1}番目。`,
    ],
  },
  height: {
    h1: ['目の高さだけを見ていては、気づけない。', 'ボタンは同じ所に並んでいるとは限らない。'],
    rest: (f) => [
      'ボタンが付いている高さを見比べよう。',
      `低い位置のボタンから順に押す。最初は${f.wall}の壁の左から${f.p1}番目。`,
    ],
  },
  blink: {
    h1: ['しばらく眺めていると、気づくことがある。', '光は、数を伝えることがある。'],
    rest: (f) => [
      'ボタンの上の灯りが、一度に何回点滅するか数えよう。',
      `点滅の少ないボタンから順に押す。最初は${f.wall}の壁の左から${f.p1}番目。`,
    ],
  },
  stripes: {
    h1: ['この部屋の飾りは、ただの飾りではない。', '色の並びには、順番が隠れている。'],
    rest: (f) => [
      `${f.clueWall}の壁の色の帯と、ボタンの色を見比べよう。`,
      `色の帯の左から順に、同じ色のボタンを押す。最初は${f.c1}、次は${f.c2}。`,
    ],
  },
  symbols: {
    h1: ['同じ形が、この部屋のどこかにもう一度現れる。', '形の並びには、順番が隠れている。'],
    rest: (f) => [
      `${f.clueWall}の壁の札に並ぶ記号を、上から順に読もう。`,
      `札の上から順に、同じ記号のボタンを押す。最初は${f.s1}、次は${f.s2}。`,
    ],
  },
  words: {
    h1: ['言葉は、目に見えるものを表している。', '書かれた言葉を、思い浮かべてみよう。'],
    rest: (f) => [
      `${f.clueWall}の壁の言葉を、それぞれ色に置き換えてみよう。`,
      `「${f.w1}」は${f.c1}。言葉の上から順に、同じ色のボタンを押す。最初は${f.c1}、次は${f.c2}。`,
    ],
  },
  lights: {
    h1: ['この部屋は、光で語りかけている。', '待っていれば、順番は向こうから示される。'],
    rest: (f) => [
      `${f.clueWall}の壁の灯りが、色を変えていく順番を覚えよう。暗くなった後が始まり。`,
      `灯りがともる色の順に、同じ色のボタンを押す。最初は${f.c1}、次は${f.c2}。`,
    ],
  },
  remote: {
    h1: ['答えは、この部屋の中にはない。', 'この部屋だけを探しても、順番は見つからない。'],
    rest: (f) => [
      `${f.doorWall}の扉の先、ROOM ${f.nid} の壁を探そう。「ROOM ${f.rid}」と書かれた手がかりがある。`,
      `ROOM ${f.nid} にある色の帯の左から順に押す。最初は${f.c1}、次は${f.c2}。`,
    ],
  },
  legend: {
    h1: ['ふたつの手がかりを、つなぎ合わせる必要がある。', '記号は、別のものの代わりに書かれている。'],
    rest: (f) => [
      `${f.clueWall}の壁の記号の並びを、${f.clueWall2}の壁の対応表で色に置き換えよう。`,
      `記号の並びの上から順に、対応表の色のボタンを押す。最初は${f.s1}＝${f.c1}、次は${f.s2}＝${f.c2}。`,
    ],
  },
};

const template = (kind: PuzzleKind, rng: Rng): Template => {
  const t = TEMPLATES[kind];
  const h1 = rng.pick(t.h1);
  return (f) => [h1, ...t.rest(f)];
};

export interface HintWorld {
  rects: readonly Rect[];
  doors: readonly Door[];
  /** 部屋の表示の番号（添字 + 1） */
  ids: readonly number[];
}

/** 部屋の謎のヒント 1〜3 */
export function makeHints(p: Puzzle, w: HintWorld, rng: Rng): Hints {
  const [a1, a2] = [p.answer[0], p.answer[1] ?? p.answer[0]];
  const own = p.clues.filter((c) => c.mount.room === p.room);
  const first = own[0] ?? p.clues[0];
  const second = own[1];
  const symbolsClue = p.clues.find((c): c is Extract<Clue, { kind: 'symbols' }> => c.kind === 'symbols');
  // legend: 押す順の k 番目の記号は symbolsClue.symbols[k]。symbols: ボタンの記号
  const sym = (k: number): string => {
    if (p.kind === 'legend' && symbolsClue) return SYMBOL_NAME[symbolsClue.symbols[k]];
    const s = p.buttons[p.answer[k]]?.symbol;
    return s ? SYMBOL_NAME[s] : '';
  };
  const col = (btn: number): string => {
    const c = p.buttons[btn]?.color;
    return c ? COLOR_NAME[c] : '';
  };
  let doorWall = '';
  if (p.remote >= 0) {
    const d = w.doors.find((d) => (d.a === p.room && d.b === p.remote) || (d.b === p.room && d.a === p.remote));
    if (d) doorWall = SIDE_NAME[doorSide(w.rects[p.room], d)];
  }
  const words = p.clues.find((c): c is Extract<Clue, { kind: 'words' }> => c.kind === 'words');
  const facts: Facts = {
    wall: SIDE_NAME[p.side],
    p1: a1 + 1,
    p2: a2 + 1,
    clueWall: first ? SIDE_NAME[first.mount.side] : '',
    clueWall2: second ? SIDE_NAME[second.mount.side] : '',
    c1: col(a1),
    c2: col(a2),
    s1: sym(0),
    s2: sym(1),
    w1: words?.words[0] ?? '',
    nid: p.remote >= 0 ? fmtId(w.ids[p.remote]) : '',
    doorWall,
    rid: fmtId(w.ids[p.room]),
  };
  return template(p.kind, rng)(facts);
}
