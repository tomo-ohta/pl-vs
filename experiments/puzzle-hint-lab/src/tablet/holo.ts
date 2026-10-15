/**
 * ホログラムの画面を描く道具（canvas 2D）: 色・フォント・角を落とした四角・角の括弧・光る線と文字・日本語の折り返し・暗号のような伏せ字
 */

export const HOLO = {
  cyan: '#62f0ff',
  cyanSoft: 'rgba(98, 240, 255, 0.55)',
  cyanDim: 'rgba(98, 240, 255, 0.24)',
  cyanFaint: 'rgba(98, 240, 255, 0.09)',
  ice: '#e2fcff',
  iceDim: 'rgba(205, 245, 255, 0.62)',
  iceFaint: 'rgba(205, 245, 255, 0.36)',
  /** 踏破（水色） */
  visited: '#4fd2ff',
  /** 制圧（橙） */
  solved: '#ff9a3c',
  gold: '#ffc46b',
  warn: '#ff5570',
} as const;

export const FONT = {
  latin: '"Chakra Petch", "Zen Kaku Gothic New", "Hiragino Sans", sans-serif',
  mono: '"Share Tech Mono", ui-monospace, Menlo, monospace',
  jp: '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif',
} as const;

export type Ctx = CanvasRenderingContext2D;

/** 光る（影をぼかして色を付ける）。blur 0 で消す */
export function glow(g: Ctx, color: string, blur: number): void {
  g.shadowColor = color;
  g.shadowBlur = blur;
}

/** 角を落とした四角の道（cut は落とす角の大きさ。[左上, 右上, 右下, 左下]） */
export function chamfer(g: Ctx, x: number, y: number, w: number, h: number, cut: number | readonly [number, number, number, number]): void {
  const [a, b, c, d] = typeof cut === 'number' ? [cut, cut, cut, cut] : cut;
  g.beginPath();
  g.moveTo(x + a, y);
  g.lineTo(x + w - b, y);
  g.lineTo(x + w, y + b);
  g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - c, y + h);
  g.lineTo(x + d, y + h);
  g.lineTo(x, y + h - d);
  g.lineTo(x, y + a);
  g.closePath();
}

/** 四隅の括弧 */
export function brackets(g: Ctx, x: number, y: number, w: number, h: number, len: number, color: string, lw = 2): void {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.beginPath();
  for (const [px, py, sx, sy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x + w, y + h, -1, -1],
    [x, y + h, 1, -1],
  ]) {
    g.moveTo(px, py + sy * len);
    g.lineTo(px, py);
    g.lineTo(px + sx * len, py);
  }
  g.stroke();
  g.restore();
}

export interface TextOpts {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  glowColor?: string;
  blur?: number;
  /** 字間（px） */
  spacing?: number;
}

/** 文字（光らせることもできる）。描いた幅を返す */
export function text(g: Ctx, s: string, x: number, y: number, o: TextOpts): number {
  g.save();
  g.font = o.font;
  g.fillStyle = o.color;
  g.textAlign = o.align ?? 'left';
  g.textBaseline = o.baseline ?? 'alphabetic';
  if (o.spacing) g.letterSpacing = `${o.spacing}px`;
  if (o.glowColor) glow(g, o.glowColor, o.blur ?? 10);
  g.fillText(s, x, y);
  const w = g.measureText(s).width;
  g.restore();
  return w;
}

export function measure(g: Ctx, s: string, font: string, spacing = 0): number {
  g.save();
  g.font = font;
  if (spacing) g.letterSpacing = `${spacing}px`;
  const w = g.measureText(s).width;
  g.restore();
  return w;
}

/** 行頭に置かない文字（句読点・閉じ括弧など） */
const NO_START = '、。，．・：；？！ー）」』】〉》〕｝]）…ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ＝';
/** 行末に置かない文字（開き括弧） */
const NO_END = '（「『【〈《〔｛[';

/** 日本語の折り返し（1 文字ずつ。禁則を少し守る） */
export function wrap(g: Ctx, s: string, font: string, maxW: number): string[] {
  g.save();
  g.font = font;
  const lines: string[] = [];
  let line = '';
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (line && g.measureText(line + ch).width > maxW) {
      if (NO_START.includes(ch)) {
        // ぶら下げ: 句読点は前の行に入れる
        line += ch;
        continue;
      }
      if (NO_END.includes(line[line.length - 1])) {
        const last = line.slice(-1);
        lines.push(line.slice(0, -1));
        line = last + ch;
        continue;
      }
      lines.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) lines.push(line);
  g.restore();
  return lines;
}

const SCRAMBLE = '▓▒░█▚▞◢◣◤◥01ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ#%&';

/** 伏せ字（解放前のヒント）。seed で決まる */
export function scramble(seed: number, n: number): string {
  let s = seed >>> 0 || 1;
  let out = '';
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out += (s >>> 8) % 7 === 0 ? ' ' : SCRAMBLE[(s >>> 12) % SCRAMBLE.length];
  }
  return out;
}

/** 南京錠の印（解放前） */
export function lockIcon(g: Ctx, x: number, y: number, s: number, color: string): void {
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(1.5, s * 0.12);
  g.beginPath();
  g.arc(x, y - s * 0.18, s * 0.26, Math.PI, 0);
  g.stroke();
  chamfer(g, x - s * 0.38, y - s * 0.18, s * 0.76, s * 0.58, s * 0.08);
  g.fill();
  g.restore();
}

/** ひし形（難易度の印） */
export function diamond(g: Ctx, x: number, y: number, r: number, filled: boolean, color: string): void {
  g.save();
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r * 0.78, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r * 0.78, y);
  g.closePath();
  if (filled) {
    g.fillStyle = color;
    g.fill();
  } else {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1, r * 0.22);
    g.stroke();
  }
  g.restore();
}
