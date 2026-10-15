/**
 * 世界の中の文字・記号の絵（1 枚の canvas にまとめる）。
 * - 等幅の文字（Share Tech Mono）: 部屋番号の札・床の番号・押した順の数字。文字ごとの四角を並べて書く
 * - 言葉（Zen Kaku Gothic New）: 言葉の謎の札
 * - 記号（線で描く）: ○ △ □ ☆ ◇ ×
 * 白で描き、使う所で頂点の色を掛けて色を付ける
 */
import * as THREE from 'three';
import type { SymbolKey } from '../gen/puzzles.ts';
import type { UvRect } from './MeshBuilder.ts';

export interface Glyph {
  uv: UvRect;
  /** 幅 / 高さ */
  aspect: number;
}

const SIZE = 2048;
const MONO = '0123456789ROM-#';
const MONO_FONT = '"Share Tech Mono", ui-monospace, Menlo, monospace';
const WORD_FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif';

export class GlyphAtlas {
  readonly texture: THREE.CanvasTexture;
  private readonly mono = new Map<string, Glyph>();
  private readonly words = new Map<string, Glyph>();
  private readonly symbols = new Map<SymbolKey, Glyph>();
  /** 塗りつぶした丸（点の数の謎の点） */
  readonly dot: Glyph;
  private x = 0;
  private y = 0;
  private rowH = 0;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(words: Iterable<string>) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    this.ctx = canvas.getContext('2d')!;
    const g = this.ctx;
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    g.textBaseline = 'middle';
    g.textAlign = 'center';

    // 等幅の文字（高さ 96 px）
    g.font = `400 84px ${MONO_FONT}`;
    const adv = Math.ceil(g.measureText('0').width);
    for (const ch of MONO) {
      const [x, y] = this.alloc(adv + 8, 104);
      g.fillText(ch, x + (adv + 8) / 2, y + 54);
      this.mono.set(ch, this.glyph(x + 4, y + 4, adv, 96));
    }
    // 言葉（高さ 112 px）
    g.font = `500 88px ${WORD_FONT}`;
    for (const w of words) {
      if (this.words.has(w)) continue;
      const tw = Math.ceil(g.measureText(w).width) + 16;
      const [x, y] = this.alloc(tw + 8, 120);
      g.fillText(w, x + (tw + 8) / 2, y + 62);
      this.words.set(w, this.glyph(x + 4, y + 4, tw, 112));
    }
    // 記号（128 px 四方）
    for (const k of ['circle', 'triangle', 'square', 'star', 'diamond', 'cross'] as SymbolKey[]) {
      const [x, y] = this.alloc(136, 136);
      drawSymbol(g, k, x + 68, y + 68, 52, 9);
      this.symbols.set(k, this.glyph(x + 4, y + 4, 128, 128));
    }
    {
      const [x, y] = this.alloc(72, 72);
      g.beginPath();
      g.arc(x + 36, y + 36, 30, 0, Math.PI * 2);
      g.fill();
      this.dot = this.glyph(x + 4, y + 4, 64, 64);
    }

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  /** 棚に詰める（左上の位置） */
  private alloc(w: number, h: number): [number, number] {
    if (this.x + w > SIZE) {
      this.x = 0;
      this.y += this.rowH;
      this.rowH = 0;
    }
    const at: [number, number] = [this.x, this.y];
    this.x += w;
    this.rowH = Math.max(this.rowH, h);
    if (this.y + h > SIZE) throw new Error('文字の絵が入りきらない');
    return at;
  }

  private glyph(x: number, y: number, w: number, h: number): Glyph {
    // canvas の y は下向き、uv の v は上向き
    return { uv: [x / SIZE, 1 - (y + h) / SIZE, (x + w) / SIZE, 1 - y / SIZE], aspect: w / h };
  }

  /** 等幅の文字列の文字ごとの絵（無い文字は空白） */
  monoRun(text: string): (Glyph | null)[] {
    return [...text].map((ch) => this.mono.get(ch) ?? null);
  }

  /** 等幅の 1 文字の 幅 / 高さ */
  get monoAspect(): number {
    return this.mono.get('0')!.aspect;
  }

  word(w: string): Glyph {
    const g = this.words.get(w);
    if (!g) throw new Error(`言葉「${w}」の絵が無い`);
    return g;
  }

  symbol(k: SymbolKey): Glyph {
    return this.symbols.get(k)!;
  }
}

/** 記号を線で描く（中心 cx, cy・半径 r・線の太さ lw） */
export function drawSymbol(g: CanvasRenderingContext2D, k: SymbolKey, cx: number, cy: number, r: number, lw: number): void {
  g.save();
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  switch (k) {
    case 'circle':
      g.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
      break;
    case 'triangle':
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        const px = cx + Math.cos(a) * r;
        const py = cy + 0.12 * r + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      break;
    case 'square':
      g.rect(cx - r * 0.78, cy - r * 0.78, r * 1.56, r * 1.56);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.42;
        const px = cx + Math.cos(a) * rr;
        const py = cy + 0.06 * r + Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      break;
    case 'diamond':
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 0.72, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r * 0.72, cy);
      g.closePath();
      break;
    case 'cross':
      g.moveTo(cx - r * 0.7, cy - r * 0.7);
      g.lineTo(cx + r * 0.7, cy + r * 0.7);
      g.moveTo(cx + r * 0.7, cy - r * 0.7);
      g.lineTo(cx - r * 0.7, cy + r * 0.7);
      break;
  }
  g.stroke();
  g.restore();
}
