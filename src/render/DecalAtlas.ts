/**
 * デカールのアトラス（担当 D）: 手続き描画した RGBA の CanvasTexture 2 枚（A = 設備・紙、B = 汚れ。各 2048²）と、
 * それを貼る材質（MaterialLibrary.adoptExternal で bakedLight / 部屋別霧 / 色欠損の注入を受ける。上書きキーごとにキャッシュ）。
 * 全部屋で共有し、描くのは 1 回だけ（固定シード。世界の乱数とは無関係）。document の無い環境（Node）では getDecalAtlas() が null。
 *
 * セルの割り当て（planCells）は純ロジック。アイテムの種類（DecalKind）→ セル id 列（variant で選ぶ）は KIND_CELLS。
 * 汚れセルの「濃い側」の規約: doorGrimeJamb / cornerGrime は u=1（右）、dustFloor / doorGrimeFloor / ceilingJunction は v=1（上）、dustWall は v=0（下）。
 */
import * as THREE from 'three';
import type { DecalKind } from '../generators/decals';
import { externalOverridesKey, type ExternalOverrides, type MaterialLibrary } from './MaterialLibrary';

export const ATLAS_SIZE = 2048;
const PAD = 24;

export interface CellRect { atlas: 0 | 1; x: number; y: number; w: number; h: number }
export interface CellUV { atlas: 0 | 1; u0: number; v0: number; u1: number; v1: number }
interface CellDef { id: string; atlas: 0 | 1; w: number; h: number; draw: (p: Painter, r: CellRect, variant: number) => void }

/** 種類 → セル id（variant % length） */
const KIND_CELLS: Record<DecalKind, string[]> = {
  outlet: ['outlet0', 'outlet1'],
  switch: ['switch0', 'switch1'],
  thermostat: ['thermostat'],
  exitSign: ['exit0', 'exit1', 'exit2'],
  fireAlarm: ['fireAlarm'],
  extinguisherSign: ['extSign'],
  pictoToilet: ['pictoToilet'],
  pictoNoSmoking: ['pictoNoSmoking'],
  pictoExit: ['exit0', 'exit1', 'exit2'],
  paperNotice: ['paper0', 'paper1', 'paper2', 'paper3'],
  paperMemo: ['memo0', 'memo1', 'memo2', 'memo3'],
  paperCaution: ['caution0', 'caution1'],
  poster: ['poster0', 'poster1', 'poster2'],
  floorScuff: ['scuff0', 'scuff1', 'scuff2'],
  doorGrimeFloor: ['doorFloor0', 'doorFloor1'],
  doorGrimeJamb: ['jamb'],
  handSmudge: ['smudge0', 'smudge1'],
  dustFloor: ['dustFloor0', 'dustFloor1'],
  dustWall: ['dustWall'],
  cornerGrime: ['cornerV'],
  ceilingJunction: ['cornerTop'],
  ceilingStain: ['stain0', 'stain1', 'stain2', 'stain3'],
  chairRub: ['rub0', 'rub1'],
};

/** シェルフ詰め（高さ順に行へ）。overflow は例外 */
export function planCells(defs: { id: string; atlas: 0 | 1; w: number; h: number }[], size = ATLAS_SIZE, pad = PAD): Map<string, CellRect> {
  const out = new Map<string, CellRect>();
  for (const atlas of [0, 1] as const) {
    const list = defs.filter((d) => d.atlas === atlas).sort((a, b) => b.h - a.h || b.w - a.w);
    let x = pad, y = pad, rowH = 0;
    for (const d of list) {
      if (x + d.w + pad > size) { x = pad; y += rowH + pad; rowH = 0; }
      if (y + d.h + pad > size) throw new Error(`decal atlas ${atlas} overflow at ${d.id}`);
      out.set(d.id, { atlas, x, y, w: d.w, h: d.h });
      x += d.w + pad;
      rowH = Math.max(rowH, d.h);
    }
  }
  return out;
}

const JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif';

// ---------------------------------------------------------------- 描画ヘルパー

class Painter {
  readonly ctx: CanvasRenderingContext2D;
  private s: number;
  private readonly noise = new Map<string, CanvasPattern>();
  // パラメータプロパティは使わない（Node の strip-only モードでセル詰めの検査がこのモジュールを読むため）
  constructor(ctx: CanvasRenderingContext2D, seed: number) { this.ctx = ctx; this.s = seed >>> 0 || 1; }
  rnd(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + this.rnd() * (b - a); }
  int(a: number, b: number): number { return a + Math.floor(this.rnd() * (b - a + 1)); }

  rrect(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /** 塊のパス（楕円 n 個の和。nonzero で塗ると 1 つの不定形になる） */
  blob(cx: number, cy: number, rx: number, ry: number, n: number): Path2D {
    const path = new Path2D();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.range(-0.3, 0.3);
      const ex = cx + Math.cos(a) * rx * this.range(0.15, 0.45), ey = cy + Math.sin(a) * ry * this.range(0.15, 0.45);
      path.moveTo(ex + rx * 0.6, ey);
      path.ellipse(ex, ey, rx * this.range(0.5, 0.72), ry * this.range(0.5, 0.72), this.range(0, Math.PI), 0, Math.PI * 2);
    }
    return path;
  }

  /** タイル可能な値ノイズ（RGB 白、alpha = lo + (hi-lo)·noise）のパターン */
  noisePattern(kind: 'fine' | 'blotch' | 'speck', lo: number, hi: number): CanvasPattern {
    const key = `${kind}|${lo}|${hi}`;
    let p = this.noise.get(key);
    if (p) return p;
    const N = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const cx = cv.getContext('2d')!;
    const img = cx.createImageData(N, N);
    const periods = kind === 'fine' ? [64, 128] : kind === 'blotch' ? [4, 8, 16] : [128];
    const lattices = periods.map((per) => ({ per, g: Array.from({ length: per * per }, () => this.rnd()) }));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let v = 0, sum = 0, amp = 1;
        for (const { per, g } of lattices) {
          const fx = (x / N) * per, fy = (y / N) * per;
          const x0 = Math.floor(fx), y0 = Math.floor(fy);
          const tx = fx - x0, ty = fy - y0;
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          const at = (i: number, j: number) => g[((j % per) + per) % per * per + ((i % per) + per) % per];
          const a = at(x0, y0), b = at(x0 + 1, y0), cc = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
          v += ((a + (b - a) * sx) * (1 - sy) + (cc + (d - cc) * sx) * sy) * amp;
          sum += amp;
          amp *= 0.55;
        }
        v /= sum;
        if (kind === 'speck') v = v > 0.62 ? 1 : 0.15;
        const i = (y * N + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(255 * Math.min(1, Math.max(0, lo + (hi - lo) * v)));
      }
    }
    cx.putImageData(img, 0, 0);
    p = this.ctx.createPattern(cv, 'repeat')!;
    this.noise.set(key, p);
    return p;
  }

  /** 矩形内の alpha にノイズを掛ける（destination-in） */
  grain(r: CellRect, kind: 'fine' | 'blotch' | 'speck', lo: number, hi: number, scale = 1): void {
    const c = this.ctx;
    c.save();
    c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = this.noisePattern(kind, lo, hi);
    c.translate(r.x, r.y);
    c.scale(scale, scale);
    c.fillRect(-r.x / scale, -r.y / scale, (r.x + r.w) / scale, (r.y + r.h) / scale);
    c.restore();
  }

  /** 矩形内の色にノイズを乗算（紙・板の質感） */
  mottle(r: CellRect, alpha: number, scale = 1): void {
    const c = this.ctx;
    c.save();
    c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = alpha;
    c.fillStyle = this.noisePattern('fine', 0.3, 1);
    c.translate(r.x, r.y);
    c.scale(scale, scale);
    c.fillRect(0, 0, r.w / scale, r.h / scale);
    c.restore();
  }

  withShadow(blur: number, ox: number, oy: number, color: string, fn: () => void): void {
    const c = this.ctx;
    c.save();
    c.shadowBlur = blur; c.shadowOffsetX = ox; c.shadowOffsetY = oy; c.shadowColor = color;
    fn();
    c.restore();
  }

  /** 文字のように見える行（単語ごとの短い帯） */
  textLines(x: number, y: number, w: number, lines: number, lineH: number, color: string, thick = 0.42, indentFirst = false): void {
    const c = this.ctx;
    c.fillStyle = color;
    for (let i = 0; i < lines; i++) {
      const yy = y + i * lineH;
      let xx = x + (indentFirst && i === 0 ? lineH * 0.9 : 0);
      const end = x + w * (i === lines - 1 ? this.range(0.3, 0.8) : 1);
      while (xx < end) {
        const wl = this.range(lineH * 0.9, lineH * 3.2);
        c.globalAlpha = this.range(0.7, 1);
        c.fillRect(xx, yy, Math.min(wl, end - xx), lineH * thick);
        xx += wl + this.range(lineH * 0.35, lineH * 0.6);
      }
    }
    c.globalAlpha = 1;
  }

  text(t: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center', maxW?: number): void {
    const c = this.ctx;
    c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    if (maxW !== undefined) c.fillText(t, x, y, maxW); else c.fillText(t, x, y);
  }
}

// ---------------------------------------------------------------- 設備

/** 白いプレート（コンセント・スイッチ共通）: 影・ベベル・僅かな黄ばみ */
function plate(p: Painter, r: CellRect, pw: number, ph: number, tint = 0): { x: number; y: number; w: number; h: number } {
  const c = p.ctx;
  const x = r.x + (r.w - pw) / 2, y = r.y + (r.h - ph) / 2;
  p.withShadow(8, 3, 6, 'rgba(0,0,0,0.5)', () => { p.rrect(x, y, pw, ph, 5); c.fillStyle = '#e8e6de'; c.fill(); });
  const g = c.createLinearGradient(0, y, 0, y + ph);
  g.addColorStop(0, tint ? '#efe9d6' : '#f4f3ee');
  g.addColorStop(1, tint ? '#dcd5bf' : '#e2e0d6');
  p.rrect(x, y, pw, ph, 5); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(120,115,100,0.55)'; c.lineWidth = 1.2; p.rrect(x + 0.6, y + 0.6, pw - 1.2, ph - 1.2, 4.5); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 4, y + ph - 3); c.lineTo(x + 4, y + 4); c.lineTo(x + pw - 4, y + 4); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(x + pw - 4, y + 4); c.lineTo(x + pw - 4, y + ph - 4); c.lineTo(x + 4, y + ph - 4); c.stroke();
  // 下端の手垢
  const gr = c.createRadialGradient(x + pw / 2, y + ph, 2, x + pw / 2, y + ph, ph * 0.5);
  gr.addColorStop(0, 'rgba(60,50,40,0.22)'); gr.addColorStop(1, 'rgba(60,50,40,0)');
  c.fillStyle = gr; p.rrect(x, y, pw, ph, 5); c.fill();
  return { x, y, w: pw, h: ph };
}

function drawOutlet(p: Painter, r: CellRect, variant: number): void {
  const c = p.ctx;
  const px = r.w / 0.10; // px/m（セル = 0.10 × 0.16 m）
  const pl = plate(p, r, 0.07 * px, 0.12 * px, variant);
  const cx = pl.x + pl.w / 2;
  for (const dy of [-0.025 * px, 0.025 * px]) {
    const cy = pl.y + pl.h / 2 + dy;
    // 受け口の窪み
    p.rrect(cx - 0.015 * px, cy - 0.011 * px, 0.03 * px, 0.022 * px, 3); c.fillStyle = 'rgba(0,0,0,0.07)'; c.fill();
    // 2 つの縦スロット（左 9 mm / 右 7 mm）
    for (const [dx, len] of [[-0.0064, 0.009], [0.0064, 0.007]] as [number, number][]) {
      p.rrect(cx + dx * px - 0.0012 * px, cy - len * px / 2, 0.0024 * px, len * px, 1.2);
      c.fillStyle = '#26262a'; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(cx + dx * px + 0.0014 * px, cy - len * px / 2, 0.8, len * px);
    }
  }
  // 中央のねじ
  c.beginPath(); c.arc(cx, pl.y + pl.h / 2, 0.0025 * px, 0, Math.PI * 2); c.fillStyle = '#b8b6ae'; c.fill();
  c.strokeStyle = '#6e6c66'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 0.0018 * px, pl.y + pl.h / 2); c.lineTo(cx + 0.0018 * px, pl.y + pl.h / 2); c.stroke();
  if (variant) {
    // ひび
    c.strokeStyle = 'rgba(70,60,50,0.55)'; c.lineWidth = 0.8; c.beginPath();
    c.moveTo(pl.x + pl.w * 0.7, pl.y + pl.h); c.lineTo(pl.x + pl.w * 0.62, pl.y + pl.h * 0.82); c.lineTo(pl.x + pl.w * 0.68, pl.y + pl.h * 0.7); c.stroke();
  }
}

function drawSwitch(p: Painter, r: CellRect, variant: number): void {
  const c = p.ctx;
  const px = r.w / 0.10;
  const pl = plate(p, r, 0.07 * px, 0.12 * px, 0);
  const cx = pl.x + pl.w / 2, cy = pl.y + pl.h / 2;
  const rockers = variant ? [[-0.014, 0.0165], [0.014, 0.0165]] : [[0, 0.04]];
  for (const [dx, hw] of rockers) {
    const w = hw * 2 * px, h = 0.078 * px, x = cx + dx * px - w / 2, y = cy - h / 2;
    p.withShadow(3, 0, 2, 'rgba(0,0,0,0.35)', () => { p.rrect(x, y, w, h, 3); c.fillStyle = '#e4e2da'; c.fill(); });
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#f0eee7'); g.addColorStop(0.5, '#e6e4dc'); g.addColorStop(0.52, '#d9d7ce'); g.addColorStop(1, '#e9e7df');
    p.rrect(x, y, w, h, 3); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; p.rrect(x + 0.5, y + 0.5, w - 1, h - 1, 2.5); c.stroke();
    // パイロットランプ
    c.fillStyle = 'rgba(120,230,150,0.9)'; c.beginPath(); c.arc(x + w / 2, y + h * 0.78, 1.6, 0, Math.PI * 2); c.fill();
  }
}

function drawThermostat(p: Painter, r: CellRect): void {
  const c = p.ctx;
  const px = r.w / 0.16;
  const s = 0.12 * px, x = r.x + (r.w - s) / 2, y = r.y + (r.h - s) / 2;
  p.withShadow(10, 4, 7, 'rgba(0,0,0,0.5)', () => { p.rrect(x, y, s, s, 8); c.fillStyle = '#e6e5dd'; c.fill(); });
  const g = c.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, '#f1f0ea'); g.addColorStop(1, '#dcdad0');
  p.rrect(x, y, s, s, 8); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(90,88,80,0.5)'; c.lineWidth = 1.2; p.rrect(x + 0.6, y + 0.6, s - 1.2, s - 1.2, 7.5); c.stroke();
  // LCD
  const lw = 0.075 * px, lh = 0.032 * px, lx = x + (s - lw) / 2, ly = y + 0.02 * px;
  p.rrect(lx, ly, lw, lh, 2); c.fillStyle = '#37443f'; c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke();
  p.text('24.5', lx + lw * 0.55, ly + lh / 2 + 1, `bold ${Math.round(lh * 0.72)}px "Courier New", monospace`, '#b9d7c7');
  p.text('°C', lx + lw * 0.88, ly + lh / 2, `${Math.round(lh * 0.36)}px sans-serif`, '#9fbfae');
  // ボタン
  for (let i = 0; i < 3; i++) {
    const bx = x + s * 0.2 + i * s * 0.3, by = y + s * 0.66;
    p.rrect(bx - s * 0.08, by - s * 0.06, s * 0.16, s * 0.12, 2); c.fillStyle = '#cfcdc4'; c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.stroke();
    c.fillStyle = '#55534c'; c.beginPath();
    if (i === 0) { c.moveTo(bx - 3, by + 2); c.lineTo(bx + 3, by + 2); c.lineTo(bx, by - 2); }
    else if (i === 1) { c.moveTo(bx - 3, by - 2); c.lineTo(bx + 3, by - 2); c.lineTo(bx, by + 2); }
    else { c.arc(bx, by, 2, 0, Math.PI * 2); }
    c.fill();
  }
  c.fillStyle = 'rgba(80,78,70,0.7)'; c.fillRect(x + s * 0.3, y + s * 0.88, s * 0.4, 1.2);
}

function runningMan(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  c.save();
  c.strokeStyle = color; c.fillStyle = color; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = s * 0.16;
  c.beginPath(); c.arc(x + s * 0.55, y + s * 0.12, s * 0.12, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(x + s * 0.5, y + s * 0.3); c.lineTo(x + s * 0.35, y + s * 0.62); c.stroke(); // 胴
  c.beginPath(); c.moveTo(x + s * 0.5, y + s * 0.34); c.lineTo(x + s * 0.8, y + s * 0.42); c.lineTo(x + s * 0.95, y + s * 0.3); c.stroke(); // 前腕
  c.beginPath(); c.moveTo(x + s * 0.48, y + s * 0.36); c.lineTo(x + s * 0.2, y + s * 0.44); c.stroke(); // 後腕
  c.beginPath(); c.moveTo(x + s * 0.35, y + s * 0.62); c.lineTo(x + s * 0.62, y + s * 0.74); c.lineTo(x + s * 0.7, y + s * 1.0); c.stroke(); // 前脚
  c.beginPath(); c.moveTo(x + s * 0.35, y + s * 0.62); c.lineTo(x + s * 0.12, y + s * 0.82); c.lineTo(x + s * 0.02, y + s * 1.0); c.stroke(); // 後脚
  c.restore();
}

/** 避難口誘導灯（緑地に白のピクト）。variant 1: 左矢印 / 2: 右矢印 */
function drawExitSign(p: Painter, r: CellRect, variant: number): void {
  const c = p.ctx;
  const px = r.w / 0.40;
  const w = 0.36 * px, h = 0.12 * px, x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2;
  p.withShadow(10, 0, 5, 'rgba(0,0,0,0.5)', () => { p.rrect(x - 4, y - 4, w + 8, h + 8, 4); c.fillStyle = '#cfd2ce'; c.fill(); });
  const fg = c.createLinearGradient(0, y - 4, 0, y + h + 4);
  fg.addColorStop(0, '#e2e4e0'); fg.addColorStop(1, '#b9bcb7');
  p.rrect(x - 4, y - 4, w + 8, h + 8, 4); c.fillStyle = fg; c.fill();
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#0f7d3e'); g.addColorStop(0.5, '#19a453'); g.addColorStop(1, '#0d6f37');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  // 発光のむら
  const rg = c.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, w * 0.6);
  rg.addColorStop(0, 'rgba(255,255,255,0.14)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = rg; c.fillRect(x, y, w, h);
  const s = h * 0.72;
  const arrow = variant === 1 ? -1 : variant === 2 ? 1 : 0;
  const pictoX = x + (arrow ? (arrow < 0 ? w * 0.42 : w * 0.16) : w * 0.28);
  // 扉の枡
  c.fillStyle = '#ffffff';
  c.fillRect(pictoX + s * 0.78, y + (h - s) / 2, s * 0.62, s);
  c.fillStyle = '#19a453';
  c.fillRect(pictoX + s * 0.86, y + (h - s) / 2 + s * 0.08, s * 0.5, s * 0.92);
  runningMan(c, pictoX - s * 0.05, y + (h - s) / 2, s, '#ffffff');
  if (arrow) {
    const ax = arrow < 0 ? x + w * 0.16 : x + w * 0.76, ay = y + h / 2, al = w * 0.16;
    c.strokeStyle = '#ffffff'; c.lineWidth = h * 0.11; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(ax - arrow * al / 2, ay); c.lineTo(ax + arrow * al / 2, ay); c.stroke();
    c.beginPath(); c.moveTo(ax + arrow * al / 2 - arrow * h * 0.22, ay - h * 0.22); c.lineTo(ax + arrow * al / 2, ay); c.lineTo(ax + arrow * al / 2 - arrow * h * 0.22, ay + h * 0.22); c.stroke();
  } else {
    p.text('非常口', x + w * 0.72, y + h * 0.5, `bold ${Math.round(h * 0.42)}px ${JP}`, '#ffffff', 'center', w * 0.42);
  }
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5; c.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

function drawFireAlarm(p: Painter, r: CellRect): void {
  const c = p.ctx;
  const px = r.w / 0.16;
  const s = 0.12 * px, x = r.x + (r.w - s) / 2, y = r.y + 0.012 * px;
  p.withShadow(10, 4, 7, 'rgba(0,0,0,0.5)', () => { p.rrect(x, y, s, s, 6); c.fillStyle = '#a81e22'; c.fill(); });
  const g = c.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, '#d0343a'); g.addColorStop(1, '#a3181d');
  p.rrect(x, y, s, s, 6); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5; p.rrect(x + 1, y + 1, s - 2, s - 2, 5); c.stroke();
  // 白いリング + 押しボタン
  const cx = x + s / 2, cy = y + s * 0.5;
  c.beginPath(); c.arc(cx, cy, s * 0.31, 0, Math.PI * 2); c.fillStyle = '#f2f0ea'; c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; c.stroke();
  const bg = c.createRadialGradient(cx - s * 0.05, cy - s * 0.05, 1, cx, cy, s * 0.22);
  bg.addColorStop(0, '#e4555a'); bg.addColorStop(1, '#a8181d');
  c.beginPath(); c.arc(cx, cy, s * 0.22, 0, Math.PI * 2); c.fillStyle = bg; c.fill();
  p.text('強く押す', cx, cy, `bold ${Math.round(s * 0.085)}px ${JP}`, 'rgba(255,255,255,0.9)');
  // 表示灯
  c.beginPath(); c.arc(x + s * 0.85, y + s * 0.14, s * 0.035, 0, Math.PI * 2); c.fillStyle = '#ffb35a'; c.fill();
  // 下の銘板
  const lw = s * 0.9, lh = 0.03 * px, lx = x + (s - lw) / 2, ly = y + s + 0.008 * px;
  p.withShadow(4, 1, 3, 'rgba(0,0,0,0.4)', () => { c.fillStyle = '#f0ede4'; c.fillRect(lx, ly, lw, lh); });
  c.strokeStyle = '#b02020'; c.lineWidth = 1.5; c.strokeRect(lx + 1, ly + 1, lw - 2, lh - 2);
  p.text('火災報知機', lx + lw / 2, ly + lh / 2, `bold ${Math.round(lh * 0.62)}px ${JP}`, '#b02020', 'center', lw - 8);
}

function drawExtinguisherSign(p: Painter, r: CellRect): void {
  const c = p.ctx;
  const px = r.w / 0.14;
  const w = 0.12 * px, h = 0.36 * px, x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2;
  p.withShadow(8, 3, 5, 'rgba(0,0,0,0.5)', () => { c.fillStyle = '#b8272b'; c.fillRect(x, y, w, h); });
  const g = c.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, '#c92d31'); g.addColorStop(0.5, '#d83a3e'); g.addColorStop(1, '#b32226');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.strokeStyle = '#f5f0e8'; c.lineWidth = 2.5; c.strokeRect(x + 4, y + 4, w - 8, h - 8);
  // 消火器のピクト
  const ex = x + w / 2, ey = y + h * 0.15, es = w * 0.42;
  c.fillStyle = '#f5f0e8';
  p.rrect(ex - es * 0.28, ey, es * 0.56, es * 1.3, es * 0.18); c.fill();
  c.fillRect(ex - es * 0.12, ey - es * 0.22, es * 0.24, es * 0.24);
  c.strokeStyle = '#f5f0e8'; c.lineWidth = es * 0.12; c.lineCap = 'round';
  c.beginPath(); c.moveTo(ex - es * 0.1, ey - es * 0.1); c.lineTo(ex - es * 0.55, ey + es * 0.25); c.lineTo(ex - es * 0.55, ey + es * 0.75); c.stroke();
  const chars = ['消', '火', '器'];
  chars.forEach((ch, i) => p.text(ch, ex, y + h * 0.5 + (i - 1) * h * 0.19, `bold ${Math.round(w * 0.6)}px ${JP}`, '#f8f4ec'));
  c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x, y, w * 0.18, h);
}

function pictoPlate(p: Painter, r: CellRect, sizeM: number): { x: number; y: number; s: number } {
  const c = p.ctx;
  const px = r.w / sizeM;
  const s = 0.2 * px, x = r.x + (r.w - s) / 2, y = r.y + (r.h - s) / 2;
  p.withShadow(8, 3, 5, 'rgba(0,0,0,0.45)', () => { p.rrect(x, y, s, s, 6); c.fillStyle = '#d8d9d4'; c.fill(); });
  const g = c.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, '#e6e7e2'); g.addColorStop(1, '#c9cac4');
  p.rrect(x, y, s, s, 6); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.2; p.rrect(x + 0.6, y + 0.6, s - 1.2, s - 1.2, 5.5); c.stroke();
  return { x, y, s };
}

function figure(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, skirt: boolean): void {
  c.fillStyle = color;
  c.beginPath(); c.arc(x, y + s * 0.1, s * 0.09, 0, Math.PI * 2); c.fill();
  if (skirt) {
    c.beginPath(); c.moveTo(x - s * 0.1, y + s * 0.22); c.lineTo(x + s * 0.1, y + s * 0.22); c.lineTo(x + s * 0.2, y + s * 0.62); c.lineTo(x - s * 0.2, y + s * 0.62); c.closePath(); c.fill();
  } else {
    c.fillRect(x - s * 0.12, y + s * 0.22, s * 0.24, s * 0.36);
  }
  c.fillRect(x - s * 0.1, y + s * 0.58, s * 0.08, s * 0.3);
  c.fillRect(x + s * 0.02, y + s * 0.58, s * 0.08, s * 0.3);
  if (!skirt) { c.fillRect(x - s * 0.19, y + s * 0.24, s * 0.06, s * 0.3); c.fillRect(x + s * 0.13, y + s * 0.24, s * 0.06, s * 0.3); }
}

function drawPictoToilet(p: Painter, r: CellRect): void {
  const { x, y, s } = pictoPlate(p, r, 0.22);
  const c = p.ctx;
  figure(c, x + s * 0.32, y + s * 0.1, s * 0.75, '#2b5fa8', false);
  figure(c, x + s * 0.68, y + s * 0.1, s * 0.75, '#c8447a', true);
  c.fillStyle = 'rgba(40,40,40,0.55)'; c.fillRect(x + s * 0.495, y + s * 0.15, 1.5, s * 0.62);
  p.text('トイレ', x + s / 2, y + s * 0.9, `bold ${Math.round(s * 0.11)}px ${JP}`, '#3a3a3a');
}

function drawPictoNoSmoking(p: Painter, r: CellRect): void {
  const { x, y, s } = pictoPlate(p, r, 0.22);
  const c = p.ctx;
  const cx = x + s / 2, cy = y + s * 0.44, rad = s * 0.3;
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3a3a3a';
  c.fillRect(cx - rad * 0.55, cy - rad * 0.1, rad * 1.1, rad * 0.22);
  c.fillRect(cx + rad * 0.4, cy - rad * 0.1, rad * 0.15, rad * 0.22);
  c.strokeStyle = 'rgba(58,58,58,0.6)'; c.lineWidth = rad * 0.06;
  for (const d of [-0.25, 0, 0.25]) { c.beginPath(); c.moveTo(cx - rad * 0.55 + rad * 0.15 + d * rad, cy - rad * 0.2); c.quadraticCurveTo(cx - rad * 0.5 + d * rad, cy - rad * 0.45, cx - rad * 0.4 + d * rad, cy - rad * 0.6); c.stroke(); }
  c.strokeStyle = '#d0262c'; c.lineWidth = rad * 0.16;
  c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(cx - rad * 0.68, cy - rad * 0.68); c.lineTo(cx + rad * 0.68, cy + rad * 0.68); c.stroke();
  p.text('禁煙', x + s / 2, y + s * 0.9, `bold ${Math.round(s * 0.11)}px ${JP}`, '#3a3a3a');
}

// ---------------------------------------------------------------- 紙

const HEADINGS = ['お知らせ', 'ご利用の皆様へ', '関係者以外立入禁止', '節電にご協力ください', '施錠をお忘れなく', '清掃のお願い', '点検のお知らせ', '本日の予定'];
const MEMO_HEADS = ['連絡', '当番表', '内線一覧', 'メモ', '確認事項', '受付'];

/** A4 の紙（影・テープ・角の反り）。中身は draw(x, y, w, h) */
function paperBase(p: Painter, r: CellRect, color: string, body: (x: number, y: number, w: number, h: number, px: number) => void): void {
  const c = p.ctx;
  const px = r.w / 0.24;
  const w = 0.21 * px, h = 0.297 * px, x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2;
  const tilt = p.range(-0.025, 0.025);
  c.save();
  c.translate(x + w / 2, y + h / 2); c.rotate(tilt); c.translate(-(x + w / 2), -(y + h / 2));
  p.withShadow(7, 2, 5, 'rgba(0,0,0,0.5)', () => { c.fillStyle = color; c.fillRect(x, y, w, h); });
  c.fillStyle = color; c.fillRect(x, y, w, h);
  // 紙の質感 + 端の黄ばみ
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.16; c.fillStyle = p.noisePattern('fine', 0.4, 1); c.fillRect(x, y, w, h);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const eg = c.createLinearGradient(x, y, x, y + h);
  eg.addColorStop(0, 'rgba(180,150,90,0)'); eg.addColorStop(1, 'rgba(180,150,90,0.12)');
  c.fillStyle = eg; c.fillRect(x, y, w, h);
  body(x, y, w, h, px);
  c.restore();
  // 角の反り（右下）
  const cs = w * 0.13;
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.moveTo(x + w, y + h - cs); c.lineTo(x + w, y + h); c.lineTo(x + w - cs, y + h); c.closePath(); c.fill();
  c.fillStyle = '#fbfaf5'; c.beginPath(); c.moveTo(x + w - cs, y + h); c.lineTo(x + w, y + h - cs); c.lineTo(x + w - cs * 0.15, y + h - cs * 0.85); c.closePath(); c.fill();
  // セロテープ（上の両角）
  for (const sx of [x + w * 0.08, x + w * 0.92]) {
    c.save(); c.translate(sx, y); c.rotate(p.range(-0.25, 0.25));
    c.fillStyle = 'rgba(255,250,225,0.5)'; c.fillRect(-0.016 * px, -0.009 * px, 0.032 * px, 0.018 * px);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-0.016 * px, -0.009 * px, 0.032 * px, 0.004 * px);
    c.restore();
  }
  c.restore();
}

function drawPaperNotice(p: Painter, r: CellRect, variant: number): void {
  paperBase(p, r, ['#f5f3ea', '#f3f1e6', '#f6f4ee', '#efece0'][variant % 4], (x, y, w, h, px) => {
    const c = p.ctx;
    const m = w * 0.1;
    const head = HEADINGS[(variant * 3 + 1) % HEADINGS.length];
    p.text(head, x + w / 2, y + h * 0.12, `bold ${Math.round(0.011 * px)}px ${JP}`, variant === 2 ? '#b0262a' : '#26282c', 'center', w - 2 * m);
    c.fillStyle = '#3a3c40'; c.fillRect(x + m, y + h * 0.17, w - 2 * m, 1);
    const lineH = 0.0072 * px;
    p.textLines(x + m, y + h * 0.22, w - 2 * m, 5 + (variant % 3) * 2, lineH, '#33363a', 0.4, true);
    if (variant === 1) {
      // 強調枠
      c.strokeStyle = '#b0262a'; c.lineWidth = 1.5; c.strokeRect(x + m, y + h * 0.56, w - 2 * m, h * 0.12);
      p.textLines(x + m * 1.5, y + h * 0.585, w - 3 * m, 2, lineH, '#b0262a', 0.45);
    }
    p.textLines(x + m, y + h * 0.74, w - 2 * m, 3, lineH, '#33363a', 0.4);
    // 署名・日付
    p.textLines(x + w * 0.55, y + h * 0.9, w * 0.35, 1, lineH, '#4a4d52', 0.4);
    if (variant % 2 === 0) {
      // 印
      c.strokeStyle = 'rgba(200,40,40,0.75)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x + w * 0.84, y + h * 0.9, 0.006 * px, 0, Math.PI * 2); c.stroke();
      p.text('印', x + w * 0.84, y + h * 0.9, `${Math.round(0.006 * px)}px ${JP}`, 'rgba(200,40,40,0.75)');
    }
  });
}

function drawPaperMemo(p: Painter, r: CellRect, variant: number): void {
  paperBase(p, r, ['#f7f6f0', '#f2efe4', '#f8f6ee', '#eeeadf'][variant % 4], (x, y, w, h, px) => {
    const c = p.ctx;
    const m = w * 0.09;
    p.text(MEMO_HEADS[variant % MEMO_HEADS.length], x + m, y + h * 0.08, `bold ${Math.round(0.008 * px)}px ${JP}`, '#26282c', 'left');
    const lineH = 0.0068 * px;
    if (variant % 2 === 0) {
      // 表
      const rows = 9, cols = 3, tx = x + m, ty = y + h * 0.15, tw = w - 2 * m, th = h * 0.6;
      c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 0.8;
      for (let i = 0; i <= rows; i++) { c.beginPath(); c.moveTo(tx, ty + (th / rows) * i); c.lineTo(tx + tw, ty + (th / rows) * i); c.stroke(); }
      for (let j = 0; j <= cols; j++) { const cx = tx + (tw / cols) * j; c.beginPath(); c.moveTo(cx, ty); c.lineTo(cx, ty + th); c.stroke(); }
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        if (p.rnd() < 0.2) continue;
        p.textLines(tx + (tw / cols) * j + 4, ty + (th / rows) * i + th / rows * 0.32, (tw / cols) * p.range(0.35, 0.8), 1, lineH, j === 0 ? '#26282c' : '#3c4a6a', 0.45);
      }
    } else {
      p.textLines(x + m, y + h * 0.16, w - 2 * m, 12, lineH * 1.35, '#3a3c40', 0.35);
      // QR 風
      const q = 0.02 * px, qx = x + w - m - q, qy = y + h - m - q;
      c.fillStyle = '#ffffff'; c.fillRect(qx - 2, qy - 2, q + 4, q + 4);
      c.fillStyle = '#111';
      const n = 12, cell = q / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (p.rnd() < 0.45) c.fillRect(qx + i * cell, qy + j * cell, cell, cell);
    }
    p.textLines(x + m, y + h * 0.82, w * 0.5, 2, lineH, '#4a4d52', 0.4);
  });
}

function drawPaperCaution(p: Painter, r: CellRect, variant: number): void {
  paperBase(p, r, variant ? '#f4f2ea' : '#f0c12c', (x, y, w, h, px) => {
    const c = p.ctx;
    if (!variant) {
      // 黄色地 + 黒枠 + 斜め縞
      c.strokeStyle = '#1d1d1d'; c.lineWidth = 0.004 * px; c.strokeRect(x + 0.006 * px, y + 0.006 * px, w - 0.012 * px, h - 0.012 * px);
      c.save(); c.beginPath(); c.rect(x, y, w, h * 0.06); c.rect(x, y + h - h * 0.06, w, h * 0.06); c.clip();
      c.fillStyle = '#1d1d1d';
      for (let sx = x - h * 0.1; sx < x + w + h * 0.1; sx += 0.02 * px) { c.beginPath(); c.moveTo(sx, y); c.lineTo(sx + 0.01 * px, y); c.lineTo(sx + 0.01 * px - h * 0.06, y + h); c.lineTo(sx - h * 0.06, y + h); c.fill(); }
      c.restore();
      // ！三角
      const tx = x + w / 2, ty = y + h * 0.3, ts = w * 0.24;
      c.fillStyle = '#1d1d1d'; c.beginPath(); c.moveTo(tx, ty - ts); c.lineTo(tx + ts * 1.1, ty + ts * 0.8); c.lineTo(tx - ts * 1.1, ty + ts * 0.8); c.closePath(); c.fill();
      c.fillStyle = '#f0c12c'; c.beginPath(); c.moveTo(tx, ty - ts * 0.7); c.lineTo(tx + ts * 0.85, ty + ts * 0.66); c.lineTo(tx - ts * 0.85, ty + ts * 0.66); c.closePath(); c.fill();
      c.fillStyle = '#1d1d1d'; c.fillRect(tx - ts * 0.08, ty - ts * 0.3, ts * 0.16, ts * 0.6); c.fillRect(tx - ts * 0.08, ty + ts * 0.4, ts * 0.16, ts * 0.16);
      p.text('注意', x + w / 2, y + h * 0.6, `bold ${Math.round(0.03 * px)}px ${JP}`, '#1d1d1d', 'center', w * 0.85);
      p.text('頭上注意 / 足元注意', x + w / 2, y + h * 0.74, `bold ${Math.round(0.009 * px)}px ${JP}`, '#1d1d1d', 'center', w * 0.85);
      p.textLines(x + w * 0.15, y + h * 0.82, w * 0.7, 2, 0.0065 * px, '#1d1d1d', 0.42);
    } else {
      c.strokeStyle = '#b0262a'; c.lineWidth = 0.003 * px; c.strokeRect(x + 0.008 * px, y + 0.008 * px, w - 0.016 * px, h - 0.016 * px);
      p.text('関係者以外', x + w / 2, y + h * 0.3, `bold ${Math.round(0.02 * px)}px ${JP}`, '#b0262a', 'center', w * 0.85);
      p.text('立入禁止', x + w / 2, y + h * 0.45, `bold ${Math.round(0.024 * px)}px ${JP}`, '#b0262a', 'center', w * 0.85);
      p.text('STAFF ONLY', x + w / 2, y + h * 0.58, `bold ${Math.round(0.011 * px)}px sans-serif`, '#26282c', 'center', w * 0.85);
      p.textLines(x + w * 0.15, y + h * 0.7, w * 0.7, 3, 0.0065 * px, '#33363a', 0.4);
    }
  });
}

const POSTER_TITLES = ['あの日の続きを。', '街は、まだ起きている。', 'NEXT STOP, TOMORROW'];

function drawPoster(p: Painter, r: CellRect, variant: number): void {
  const c = p.ctx;
  const px = r.w / 0.56;
  const fw = 0.515 * px, fh = 0.728 * px, x = r.x + (r.w - fw) / 2, y = r.y + (r.h - fh) / 2;
  const t = 0.018 * px;
  p.withShadow(12, 3, 8, 'rgba(0,0,0,0.55)', () => { c.fillStyle = '#b9bbb8'; c.fillRect(x - t, y - t, fw + 2 * t, fh + 2 * t); });
  // 額縁（アルマイト）
  const fg = c.createLinearGradient(x - t, y - t, x + fw + t, y + fh + t);
  fg.addColorStop(0, '#d9dbd8'); fg.addColorStop(0.5, '#b4b6b3'); fg.addColorStop(1, '#8e918e');
  c.fillStyle = fg; c.fillRect(x - t, y - t, fw + 2 * t, fh + 2 * t);
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.strokeRect(x - t + 1, y - t + 1, fw + 2 * t - 2, fh + 2 * t - 2);
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x - 2, y - 2, fw + 4, fh + 4);
  // 写真風の暗いグラデーション
  const schemes = [
    ['#1a2a4a', '#4a3a5a', '#c8783a', '#0c0f18'],
    ['#0e2a2e', '#1f5a5a', '#7fc0b0', '#06110f'],
    ['#2a1e14', '#5a4630', '#c9a06a', '#120c08'],
  ][variant % 3];
  const g = c.createLinearGradient(0, y, 0, y + fh);
  g.addColorStop(0, schemes[0]); g.addColorStop(0.45, schemes[1]); g.addColorStop(0.62, schemes[2]); g.addColorStop(0.7, schemes[3]); g.addColorStop(1, schemes[3]);
  c.fillStyle = g; c.fillRect(x, y, fw, fh);
  // 地平線のシルエット（建物）
  c.fillStyle = 'rgba(5,6,10,0.9)';
  let bx = x;
  while (bx < x + fw) { const bw = p.range(fw * 0.05, fw * 0.15), bh = p.range(fh * 0.04, fh * 0.16); c.fillRect(bx, y + fh * 0.68 - bh, bw, bh + fh * 0.04); bx += bw + p.range(0, fw * 0.02); }
  // 明かりの点
  c.fillStyle = 'rgba(255,220,150,0.7)';
  for (let i = 0; i < 40; i++) c.fillRect(x + p.range(0, fw), y + fh * p.range(0.56, 0.7), 1.5, 1.5);
  // ビネット
  const vg = c.createRadialGradient(x + fw / 2, y + fh * 0.4, fw * 0.2, x + fw / 2, y + fh * 0.4, fw * 0.9);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vg; c.fillRect(x, y, fw, fh);
  // タイトル帯 + 文字
  const band = fh * 0.13, by = y + fh * 0.76;
  c.fillStyle = 'rgba(245,243,236,0.94)'; c.fillRect(x, by, fw, band);
  p.text(POSTER_TITLES[variant % 3], x + fw / 2, by + band * 0.5, `bold ${Math.round(band * 0.36)}px ${JP}`, '#1c1e24', 'center', fw * 0.9);
  p.textLines(x + fw * 0.1, by + band + fh * 0.02, fw * 0.8, 2, fh * 0.012, 'rgba(230,228,220,0.8)', 0.4);
  p.text(['2026.10.3 SAT', 'OPEN 10:00 – 20:00', 'ALL NIGHT'][variant % 3], x + fw / 2, y + fh * 0.955, `${Math.round(fh * 0.02)}px sans-serif`, 'rgba(230,228,220,0.85)');
  // ガラスの反射
  c.save(); c.beginPath(); c.rect(x, y, fw, fh); c.clip();
  const sg = c.createLinearGradient(x, y, x + fw, y + fh);
  sg.addColorStop(0.3, 'rgba(255,255,255,0)'); sg.addColorStop(0.42, 'rgba(255,255,255,0.09)'); sg.addColorStop(0.5, 'rgba(255,255,255,0)');
  c.fillStyle = sg; c.fillRect(x, y, fw, fh);
  c.restore();
}

// ---------------------------------------------------------------- 汚れ

function clipCell(c: CanvasRenderingContext2D, r: CellRect): void { c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip(); }

/** 「濃い側」をセルの外（パディング 24 px の内側 12 px）へはみ出させた矩形。境界テクセルがフィルタリングで透明と混ざり、端の濃さが半減するのを防ぐ */
const BLEED = 12;
function bleed(r: CellRect, sides: { l?: boolean; r?: boolean; t?: boolean; b?: boolean }): CellRect {
  return { atlas: r.atlas, x: r.x - (sides.l ? BLEED : 0), y: r.y - (sides.t ? BLEED : 0), w: r.w + (sides.l ? BLEED : 0) + (sides.r ? BLEED : 0), h: r.h + (sides.t ? BLEED : 0) + (sides.b ? BLEED : 0) };
}

/** 擦れの筋（u 方向に長い）。中央ほど濃く、両端は薄い */
function drawScuff(p: Painter, r: CellRect, variant: number): void {
  const c = p.ctx;
  c.save(); clipCell(c, r);
  const n = 70 + variant * 15;
  for (let i = 0; i < n; i++) {
    const cy = r.y + r.h * (0.5 + (p.rnd() + p.rnd() + p.rnd() - 1.5) * 0.42);
    const x0 = r.x + p.range(-r.w * 0.2, r.w * 0.9), len = p.range(r.w * 0.15, r.w * 0.7);
    c.strokeStyle = `rgba(28,24,20,${p.range(0.05, 0.16).toFixed(3)})`;
    c.lineWidth = p.range(1.5, 9); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, cy);
    c.quadraticCurveTo(x0 + len / 2, cy + p.range(-r.h * 0.05, r.h * 0.05), x0 + len, cy + p.range(-r.h * 0.03, r.h * 0.03));
    c.stroke();
  }
  // 中央の帯（薄い）
  const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(28,24,20,0)'); g.addColorStop(0.5, 'rgba(28,24,20,0.12)'); g.addColorStop(1, 'rgba(28,24,20,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  // 端で消す + 粒
  c.save(); clipCell(c, r); c.globalCompositeOperation = 'destination-in';
  const m = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.2, 'rgba(0,0,0,1)'); m.addColorStop(0.8, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = m; c.fillRect(r.x, r.y, r.w, r.h);
  const e = c.createLinearGradient(r.x, 0, r.x + r.w, 0);
  e.addColorStop(0, 'rgba(0,0,0,0.2)'); e.addColorStop(0.08, 'rgba(0,0,0,1)'); e.addColorStop(0.92, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0.2)');
  c.fillStyle = e; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  p.grain(r, 'fine', 0.45, 1.1, 1.6);
}

/** 矩形の左右端を柔らかく消す（destination-in） */
function fadeSides(c: CanvasRenderingContext2D, r: CellRect, frac: number, floor = 0): void {
  c.save(); clipCell(c, r); c.globalCompositeOperation = 'destination-in';
  const e = c.createLinearGradient(r.x, 0, r.x + r.w, 0);
  e.addColorStop(0, `rgba(0,0,0,${floor})`); e.addColorStop(frac, 'rgba(0,0,0,1)'); e.addColorStop(1 - frac, 'rgba(0,0,0,1)'); e.addColorStop(1, `rgba(0,0,0,${floor})`);
  c.fillStyle = e; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
}

/** 扉前の床（v=1 = 上 = 敷居側が濃い）。引きずり筋は v 方向。縁は柔らかく不定形 */
function drawDoorFloor(p: Painter, r0: CellRect, variant: number): void {
  const c = p.ctx;
  const r = bleed(r0, { t: true });
  c.save(); clipCell(c, r);
  const g = c.createLinearGradient(0, r0.y, 0, r0.y + r0.h);
  g.addColorStop(0, 'rgba(22,18,14,0.7)'); g.addColorStop(0.3, 'rgba(22,18,14,0.32)'); g.addColorStop(0.75, 'rgba(22,18,14,0.06)'); g.addColorStop(1, 'rgba(22,18,14,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  for (let i = 0; i < 40 + variant * 10; i++) {
    const x = r.x + r.w * (0.5 + (p.rnd() + p.rnd() - 1) * 0.5);
    c.strokeStyle = `rgba(22,18,14,${p.range(0.1, 0.24).toFixed(3)})`; c.lineWidth = p.range(1.5, 6); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, r.y); c.quadraticCurveTo(x + p.range(-6, 6), r.y + r.h * 0.4, x + p.range(-10, 10), r.y + r.h * p.range(0.3, 0.9)); c.stroke();
  }
  c.restore();
  fadeSides(c, r, 0.28);
  p.grain(r, 'blotch', 0.45, 1.15, 2.4);
  p.grain(r, 'fine', 0.6, 1.1, 1.4);
}

/** 扉枡脇の壁（u=1 = 右 = 枡側、v=0 = 下 = 床側が濃い） */
function drawJamb(p: Painter, r0: CellRect): void {
  const c = p.ctx;
  const r = bleed(r0, { r: true, b: true });
  c.save(); clipCell(c, r);
  const g = c.createRadialGradient(r0.x + r0.w, r0.y + r0.h, 2, r0.x + r0.w, r0.y + r0.h, r0.w * 1.3);
  g.addColorStop(0, 'rgba(24,20,16,0.88)'); g.addColorStop(0.45, 'rgba(24,20,16,0.4)'); g.addColorStop(1, 'rgba(24,20,16,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  const v = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  v.addColorStop(0, 'rgba(24,20,16,0)'); v.addColorStop(0.55, 'rgba(24,20,16,0.14)'); v.addColorStop(1, 'rgba(24,20,16,0.5)');
  c.fillStyle = v; c.fillRect(r.x, r.y, r.w, r.h);
  // 縦の垂れ・靴跡
  for (let i = 0; i < 10; i++) {
    const x = r.x + r.w * p.range(0.45, 1);
    c.strokeStyle = `rgba(24,20,16,${p.range(0.1, 0.24).toFixed(3)})`; c.lineWidth = p.range(1, 4);
    c.beginPath(); c.moveTo(x, r.y + r.h); c.lineTo(x + p.range(-3, 3), r.y + r.h * p.range(0.25, 0.75)); c.stroke();
  }
  c.restore();
  p.grain(r, 'blotch', 0.5, 1.15, 2);
  p.grain(r, 'fine', 0.65, 1.1, 1.2);
}

function drawSmudge(p: Painter, r: CellRect, variant: number): void {
  const c = p.ctx;
  c.save(); clipCell(c, r);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  for (let i = 0; i < 6 + variant * 3; i++) {
    const ex = cx + p.range(-r.w * 0.2, r.w * 0.2), ey = cy + p.range(-r.h * 0.22, r.h * 0.22), rad = r.w * p.range(0.14, 0.3);
    const g = c.createRadialGradient(ex, ey, 1, ex, ey, rad);
    g.addColorStop(0, `rgba(30,26,22,${p.range(0.14, 0.3).toFixed(3)})`); g.addColorStop(1, 'rgba(30,26,22,0)');
    c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  }
  // 指のこすれ
  for (let i = 0; i < 12; i++) {
    const x0 = cx + p.range(-r.w * 0.3, r.w * 0.3), y0 = cy + p.range(-r.h * 0.3, r.h * 0.3);
    c.strokeStyle = `rgba(30,26,22,${p.range(0.08, 0.18).toFixed(3)})`; c.lineWidth = p.range(3, 7); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + p.range(-20, 20), y0 + p.range(-20, 20), x0 + p.range(-30, 30), y0 + p.range(-30, 30)); c.stroke();
  }
  c.restore();
  p.grain(r, 'fine', 0.55, 1.1, 1.3);
}

/** 壁際の埃（床。v=1 = 上 = 壁側が濃い） */
function drawDustFloor(p: Painter, r0: CellRect, variant: number): void {
  const c = p.ctx;
  const r = bleed(r0, { t: true });
  c.save(); clipCell(c, r);
  const g = c.createLinearGradient(0, r0.y, 0, r0.y + r0.h);
  g.addColorStop(0, 'rgba(48,44,38,1)'); g.addColorStop(0.15, 'rgba(48,44,38,0.7)'); g.addColorStop(0.45, 'rgba(48,44,38,0.28)'); g.addColorStop(1, 'rgba(48,44,38,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  // 綿埃の塊（壁際に寄る）
  for (let i = 0; i < 90 + variant * 30; i++) {
    const x = r.x + p.range(0, r.w), y = r.y + r.h * Math.pow(p.rnd(), 2.4) * 0.75, rad = p.range(1, 4.5);
    c.fillStyle = `rgba(${variant ? '96,90,82' : '62,58,52'},${p.range(0.2, 0.5).toFixed(3)})`;
    c.beginPath(); c.ellipse(x, y, rad * p.range(1, 2.5), rad, p.range(0, Math.PI), 0, Math.PI * 2); c.fill();
  }
  c.restore();
  fadeSides(c, r, 0.05, 0.35);
  p.grain(r, 'blotch', 0.55, 1.15, 2.2);
  p.grain(r, 'speck', 0.7, 1.25, 0.7);
}

/** 壁際の埃（壁。v=0 = 下が濃い） */
function drawDustWall(p: Painter, r0: CellRect): void {
  const c = p.ctx;
  const r = bleed(r0, { b: true });
  c.save(); clipCell(c, r);
  const g = c.createLinearGradient(0, r0.y, 0, r0.y + r0.h);
  g.addColorStop(0, 'rgba(46,42,36,0)'); g.addColorStop(0.45, 'rgba(46,42,36,0.28)'); g.addColorStop(1, 'rgba(46,42,36,0.9)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  fadeSides(c, r, 0.05, 0.4);
  p.grain(r, 'blotch', 0.5, 1.15, 2.2);
  p.grain(r, 'fine', 0.7, 1.1, 1.5);
}

/** 入隅の縦帯（u=1 = 右が濃い）。床近くと天井近くで少し濃く */
function drawCornerV(p: Painter, r0: CellRect): void {
  const c = p.ctx;
  const r = bleed(r0, { r: true });
  c.save(); clipCell(c, r);
  const g = c.createLinearGradient(r0.x, 0, r0.x + r0.w, 0);
  g.addColorStop(0, 'rgba(26,22,18,0)'); g.addColorStop(0.45, 'rgba(26,22,18,0.16)'); g.addColorStop(0.8, 'rgba(26,22,18,0.55)'); g.addColorStop(1, 'rgba(26,22,18,0.95)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  const v = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  v.addColorStop(0, 'rgba(26,22,18,0.2)'); v.addColorStop(0.15, 'rgba(26,22,18,0)'); v.addColorStop(0.8, 'rgba(26,22,18,0)'); v.addColorStop(1, 'rgba(26,22,18,0.35)');
  c.fillStyle = v; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  p.grain(r, 'blotch', 0.55, 1.15, 1.8);
  p.grain(r, 'fine', 0.7, 1.1, 1.2);
}

/** 壁と天井の入隅（v=1 = 上が濃い） */
function drawCornerTop(p: Painter, r0: CellRect): void {
  const c = p.ctx;
  const r = bleed(r0, { t: true });
  c.save(); clipCell(c, r);
  const g = c.createLinearGradient(0, r0.y, 0, r0.y + r0.h);
  g.addColorStop(0, 'rgba(30,26,22,0.72)'); g.addColorStop(0.35, 'rgba(30,26,22,0.18)'); g.addColorStop(1, 'rgba(30,26,22,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  fadeSides(c, r, 0.05, 0.4);
  p.grain(r, 'blotch', 0.5, 1.15, 2.5);
}

/** 天井板のシミ（黄褐色の不定形、輪郭が濃い水染み。内側は destination-out で薄くして縁を残す） */
function drawStain(p: Painter, r: CellRect, variant: number): void {
  const c = p.ctx;
  c.save(); clipCell(c, r);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w * 0.36, ry = r.h * 0.34;
  const inner = variant === 3 ? [96, 102, 88] : [176, 142, 92];
  const rim = variant === 3 ? [58, 64, 50] : [104, 72, 36];
  const path = p.blob(cx, cy, rx, ry, 8);
  // 全体を縁色で塗り（外縁を少しぼかす）
  c.save(); c.shadowBlur = 6; c.shadowColor = `rgba(${rim.join(',')},0.5)`;
  c.fillStyle = `rgba(${rim.join(',')},0.62)`; c.fill(path, 'nonzero');
  c.restore();
  // 内側を薄くして「縁の線」を残す（縮小した同じ形。輪郭からの距離が場所で違うので縁の太さが揺れる）
  const hollow = (scale: number, alpha: number) => {
    c.save(); c.translate(cx, cy); c.scale(scale, scale); c.translate(-cx, -cy);
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = `rgba(0,0,0,${alpha})`; c.fill(path, 'nonzero');
    c.restore();
  };
  hollow(0.86, 0.5);
  hollow(0.62, 0.35);
  // 内側の黄褐色（乾いた中心）
  c.save(); c.translate(cx, cy); c.scale(0.84, 0.84); c.translate(-cx, -cy);
  const g = c.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, `rgba(${inner.join(',')},0.22)`); g.addColorStop(1, `rgba(${inner.join(',')},0.34)`);
  c.fillStyle = g; c.fill(path, 'nonzero');
  c.restore();
  // 点々（カビ）と第二の縁
  for (let i = 0; i < 50; i++) {
    const a = p.range(0, Math.PI * 2), d = Math.sqrt(p.rnd());
    c.fillStyle = `rgba(${rim.join(',')},${p.range(0.2, 0.5).toFixed(2)})`;
    c.beginPath(); c.arc(cx + Math.cos(a) * rx * 0.85 * d, cy + Math.sin(a) * ry * 0.85 * d, p.range(0.8, 2.6), 0, Math.PI * 2); c.fill();
  }
  c.restore();
  p.grain(r, 'blotch', 0.6, 1.15, 1.6);
  p.grain(r, 'fine', 0.7, 1.1, 1.2);
}

/** 椅子背の高さのこすれ（横帯）。中央の高さが濃い */
function drawRub(p: Painter, r: CellRect, variant: number): void {
  const c = p.ctx;
  c.save(); clipCell(c, r);
  for (let i = 0; i < 50 + variant * 20; i++) {
    const cy = r.y + r.h * (0.5 + (p.rnd() + p.rnd() - 1) * 0.35);
    const x0 = r.x + p.range(-r.w * 0.1, r.w * 0.9), len = p.range(r.w * 0.1, r.w * 0.45);
    c.strokeStyle = `rgba(34,30,26,${p.range(0.05, 0.15).toFixed(3)})`; c.lineWidth = p.range(2, 8); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, cy); c.quadraticCurveTo(x0 + len / 2, cy + p.range(-3, 3), x0 + len, cy + p.range(-2, 2)); c.stroke();
  }
  const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(34,30,26,0)'); g.addColorStop(0.5, 'rgba(34,30,26,0.1)'); g.addColorStop(1, 'rgba(34,30,26,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  c.save(); clipCell(c, r); c.globalCompositeOperation = 'destination-in';
  const e = c.createLinearGradient(r.x, 0, r.x + r.w, 0);
  e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(0.1, 'rgba(0,0,0,1)'); e.addColorStop(0.9, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = e; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  p.grain(r, 'fine', 0.5, 1.1, 1.4);
}

// ---------------------------------------------------------------- セル定義

function cellDefs(): CellDef[] {
  const defs: CellDef[] = [];
  const add = (id: string, atlas: 0 | 1, w: number, h: number, draw: CellDef['draw']) => defs.push({ id, atlas, w, h, draw });
  // A: 設備・紙
  for (let i = 0; i < 2; i++) add(`outlet${i}`, 0, 128, 208, (p, r) => drawOutlet(p, r, i));
  for (let i = 0; i < 2; i++) add(`switch${i}`, 0, 128, 208, (p, r) => drawSwitch(p, r, i));
  add('thermostat', 0, 208, 208, (p, r) => drawThermostat(p, r));
  for (let i = 0; i < 3; i++) add(`exit${i}`, 0, 480, 176, (p, r) => drawExitSign(p, r, i));
  add('fireAlarm', 0, 208, 256, (p, r) => drawFireAlarm(p, r));
  add('extSign', 0, 160, 480, (p, r) => drawExtinguisherSign(p, r));
  add('pictoToilet', 0, 256, 256, (p, r) => drawPictoToilet(p, r));
  add('pictoNoSmoking', 0, 256, 256, (p, r) => drawPictoNoSmoking(p, r));
  for (let i = 0; i < 4; i++) add(`paper${i}`, 0, 240, 336, (p, r) => drawPaperNotice(p, r, i));
  for (let i = 0; i < 4; i++) add(`memo${i}`, 0, 240, 336, (p, r) => drawPaperMemo(p, r, i));
  for (let i = 0; i < 2; i++) add(`caution${i}`, 0, 240, 336, (p, r) => drawPaperCaution(p, r, i));
  for (let i = 0; i < 3; i++) add(`poster${i}`, 0, 480, 680, (p, r) => drawPoster(p, r, i));
  // B: 汚れ
  for (let i = 0; i < 3; i++) add(`scuff${i}`, 1, 960, 224, (p, r) => drawScuff(p, r, i));
  for (let i = 0; i < 2; i++) add(`doorFloor${i}`, 1, 480, 224, (p, r) => drawDoorFloor(p, r, i));
  add('jamb', 1, 240, 320, (p, r) => drawJamb(p, r));
  for (let i = 0; i < 2; i++) add(`smudge${i}`, 1, 256, 256, (p, r) => drawSmudge(p, r, i));
  for (let i = 0; i < 2; i++) add(`dustFloor${i}`, 1, 960, 112, (p, r) => drawDustFloor(p, r, i));
  add('dustWall', 1, 960, 64, (p, r) => drawDustWall(p, r));
  add('cornerV', 1, 96, 800, (p, r) => drawCornerV(p, r));
  add('cornerTop', 1, 960, 128, (p, r) => drawCornerTop(p, r));
  for (let i = 0; i < 4; i++) add(`stain${i}`, 1, 288, 288, (p, r) => drawStain(p, r, i));
  for (let i = 0; i < 2; i++) add(`rub${i}`, 1, 960, 120, (p, r) => drawRub(p, r, i));
  return defs;
}

/** セル寸法だけ（Node の検査用） */
export function decalCellSizes(): { id: string; atlas: 0 | 1; w: number; h: number }[] {
  return cellDefs().map(({ id, atlas, w, h }) => ({ id, atlas, w, h }));
}

// ---------------------------------------------------------------- アトラス本体

export class DecalAtlas {
  readonly textures: THREE.CanvasTexture[] = [];
  readonly cells: Map<string, CellRect>;
  /** 描画に要した時間（ms。デバッグ表示用） */
  readonly drawMs: number;
  private readonly base: THREE.MeshStandardMaterial[] = [];
  private readonly emissiveBase: THREE.MeshStandardMaterial;
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();

  constructor() {
    const t0 = performance.now();
    const defs = cellDefs();
    this.cells = planCells(defs);
    const canvases: HTMLCanvasElement[] = [];
    for (const atlas of [0, 1] as const) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = ATLAS_SIZE;
      const ctx = cv.getContext('2d')!;
      ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      const p = new Painter(ctx, 0xdeca1 + atlas * 977);
      for (const d of defs) {
        if (d.atlas !== atlas) continue;
        const r = this.cells.get(d.id)!;
        ctx.save();
        try { d.draw(p, r, 0); } finally { ctx.restore(); }
      }
      canvases.push(cv);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.name = `decals/atlas${atlas}`;
      this.textures.push(tex);
    }
    const common = { transparent: true, depthWrite: false, metalness: 0, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    this.base.push(new THREE.MeshStandardMaterial({ ...common, name: 'decals/A', map: this.textures[0], roughness: 0.8 }));
    this.base.push(new THREE.MeshStandardMaterial({ ...common, name: 'decals/B', map: this.textures[1], roughness: 0.92 }));
    this.emissiveBase = new THREE.MeshStandardMaterial({ ...common, name: 'decals/A-emissive', map: this.textures[0], roughness: 0.45, emissive: 0xffffff, emissiveMap: this.textures[0], emissiveIntensity: 1.6 });
    this.drawMs = performance.now() - t0;
  }

  /** 種類 + variant → UV 範囲（v は上向き。canvas の y は下向き） */
  cell(kind: DecalKind, variant = 0): CellUV {
    const ids = KIND_CELLS[kind];
    const r = this.cells.get(ids[((variant % ids.length) + ids.length) % ids.length])!;
    return { atlas: r.atlas, u0: r.x / ATLAS_SIZE, u1: (r.x + r.w) / ATLAS_SIZE, v0: 1 - (r.y + r.h) / ATLAS_SIZE, v1: 1 - r.y / ATLAS_SIZE };
  }

  /** 材質（adoptExternal 済み。atlas × emissive × 上書きキーでキャッシュ） */
  material(lib: MaterialLibrary, atlas: 0 | 1, emissive: boolean, overrides?: ExternalOverrides): THREE.MeshStandardMaterial {
    const key = `${atlas}|${emissive ? 'e' : 'n'}|${externalOverridesKey(overrides) ?? ''}`;
    let m = this.cache.get(key);
    if (m) return m;
    const src = emissive && atlas === 0 ? this.emissiveBase : this.base[atlas];
    m = lib.adoptExternal(src, overrides);
    m.name = `decals/${key}`;
    this.cache.set(key, m);
    return m;
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
    for (const m of this.base) m.dispose();
    this.emissiveBase.dispose();
    for (const t of this.textures) t.dispose();
  }
}

let shared: DecalAtlas | null | undefined;

/** 共有アトラス。document の無い環境では null。初回呼び出しで描く（ブラウザでは prewarmDecalAtlas がロード中に先に描く） */
export function getDecalAtlas(): DecalAtlas | null {
  if (shared !== undefined) return shared;
  if (typeof document === 'undefined') return (shared = null);
  try {
    shared = new DecalAtlas();
    // デバッグ用（drawMs / cells / textures の確認）
    (globalThis as unknown as { __decalAtlas?: DecalAtlas }).__decalAtlas = shared;
  } catch (e) {
    console.warn('[DecalAtlas] failed to build', e);
    shared = null;
  }
  return shared;
}

/** 起動時（モジュール評価の直後）にアトラスを描いておく。main.ts は素材の読込完了を待ってから最初の部屋を構築するので、
 *  その構築時間（__buildProfile の 'decals'）に描画コストが乗らない */
export function prewarmDecalAtlas(): void {
  if (typeof document === 'undefined' || shared !== undefined) return;
  queueMicrotask(() => { getDecalAtlas(); });
}
