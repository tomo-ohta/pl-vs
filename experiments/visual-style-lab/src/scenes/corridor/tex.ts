import { rand } from './kit.ts';

/**
 * 掲示物の図柄（キャンバスに描く）。参考画像の記号的な描き方に合わせる:
 * 淡い紙・灰色のくねった線（文字）・濃い見出しの帯・赤い印・枠の線。
 */

type G = CanvasRenderingContext2D;

export interface ScribbleOpts {
  color?: string;
  /** 線の太さ（画素） */
  width?: number;
  /** 行の高さ（画素） */
  row?: number;
  /** 行の長さのばらつき（0〜1） */
  ragged?: number;
  /** 言葉の切れ目の割合 */
  gaps?: number;
  /** くねりの大きさ（行の高さに対して） */
  wave?: number;
  /** 手書き風（大きくくねる） */
  hand?: boolean;
  seed?: number;
  /** 行を抜く割合 */
  skip?: number;
}

/** 文字の代わりのくねった線を行ごとに描く */
export function scribble(g: G, x: number, y: number, w: number, h: number, o: ScribbleOpts = {}): void {
  const r = rand(o.seed ?? 1);
  const row = o.row ?? 14;
  const lw = o.width ?? 2;
  g.save();
  g.strokeStyle = o.color ?? '#7d8784';
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let yy = y + row * 0.5; yy < y + h; yy += row) {
    if (r() < (o.skip ?? 0)) continue;
    const len = w * (1 - (o.ragged ?? 0.35) * r());
    let xx = x;
    while (xx < x + len) {
      const wl = Math.min(x + len - xx, row * (0.8 + r() * 2.8));
      g.beginPath();
      const amp = row * (o.wave ?? 0.12) * (o.hand ? 2.2 : 1);
      const steps = Math.max(3, Math.round(wl / (o.hand ? 3 : 4)));
      for (let i = 0; i <= steps; i++) {
        const px = xx + (wl * i) / steps;
        const py = yy + Math.sin(i * (o.hand ? 1.7 : 2.4) + r() * 1.2) * amp + (o.hand ? (r() - 0.5) * amp : 0);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
      xx += wl + row * (0.3 + r() * (o.gaps ?? 0.6));
    }
  }
  g.restore();
}

/** 紙（地の色・縁の線・少しの影） */
export function paper(g: G, w: number, h: number, bg: string, edge?: string, edgeW = 2): void {
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = edgeW;
    g.strokeRect(edgeW / 2, edgeW / 2, w - edgeW, h - edgeW);
  }
}

/** 濃い見出しの帯 */
export function bar(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

/** 押しピン・テープ */
export function pin(g: G, x: number, y: number, r: number, c: string): void {
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** 赤い楕円の印（corridor-1 の掲示の見出し） */
export function stamp(g: G, x: number, y: number, w: number, h: number, c: string, rot = -0.08): void {
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.rotate(rot);
  g.fillStyle = c;
  g.beginPath();
  g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** 白い紙に灰色の文字の掲示（一般形） */
export function notice(
  g: G,
  w: number,
  h: number,
  o: {
    bg?: string;
    edge?: string;
    edgeW?: number;
    ink?: string;
    head?: string;
    headH?: number;
    margin?: number;
    row?: number;
    lw?: number;
    seed?: number;
    hand?: boolean;
    box?: string;
  } = {},
): void {
  paper(g, w, h, o.bg ?? '#eef3e4', o.edge, o.edgeW ?? 3);
  const m = o.margin ?? w * 0.12;
  let y = m;
  if (o.head) {
    const hh = o.headH ?? h * 0.08;
    bar(g, m, y, (w - m * 2) * 0.7, hh, o.head);
    y += hh + m * 0.6;
  }
  if (o.box) {
    g.strokeStyle = o.box;
    g.lineWidth = 3;
    g.strokeRect(m, y, w - m * 2, h * 0.22);
    y += h * 0.22 + m * 0.5;
  }
  scribble(g, m, y, w - m * 2, h - y - m, { color: o.ink ?? '#8b958f', row: o.row ?? Math.max(8, h / 14), width: o.lw ?? 2, seed: o.seed ?? 3, hand: o.hand });
}

/** 線画の掲示（corridor-2）: 淡い紙・細い暗い縁・枠で囲んだ見出し・枠付きの短い棒の行 */
export function inkNotice(g: G, w: number, h: number, seed: number, o: { bg?: string; ink?: string; fill?: string; head?: boolean; edgeW?: number } = {}): void {
  const r = rand(seed);
  const ink = o.ink ?? '#2c3d40';
  paper(g, w, h, o.bg ?? '#eff8e2', ink, o.edgeW ?? 3);
  const m = w * 0.12;
  let y = h * 0.08;
  g.lineWidth = 2.5;
  g.strokeStyle = ink;
  g.fillStyle = o.fill ?? '#c9d3c0';
  if (o.head ?? true) {
    // 見出し: 枠付きの太い棒を 1〜2 段
    const rows = 1 + Math.floor(r() * 2);
    for (let i = 0; i < rows; i++) {
      let x = m;
      while (x < w - m * 1.4) {
        const bw = Math.min(w - m - x, w * (0.12 + r() * 0.2));
        g.fillRect(x, y, bw, h * 0.045);
        g.strokeRect(x, y, bw, h * 0.045);
        x += bw + w * 0.03;
      }
      y += h * 0.07;
    }
    y += h * 0.03;
  }
  // 本文: 枠付きの細い棒（言葉）の行
  while (y < h - h * 0.08) {
    let x = m + (r() < 0.3 ? w * 0.08 : 0);
    const end = w - m - r() * w * 0.3;
    while (x < end) {
      const bw = Math.min(end - x, w * (0.06 + r() * 0.16));
      if (r() < 0.25) {
        g.beginPath();
        g.moveTo(x, y + 3);
        g.lineTo(x + bw, y + 3);
        g.stroke();
      } else {
        g.fillRect(x, y, bw, 7);
        g.strokeRect(x, y, bw, 7);
      }
      x += bw + w * 0.025;
    }
    y += h * (0.055 + r() * 0.03);
    if (r() < 0.15) y += h * 0.05;
  }
}

/** 穴の並んだ板（カートの側面） */
export function perforated(g: G, w: number, h: number, bg: string, hole: string, pitch = 14, size = 4): void {
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = hole;
  for (let y = pitch; y < h - pitch / 2; y += pitch * 1.6) for (let x = pitch; x < w - pitch / 2; x += pitch) g.fillRect(x, y, size, size);
}
