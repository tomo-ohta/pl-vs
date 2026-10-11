import * as THREE from 'three';
import { rng } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 3 階の窓ガラスの「垂れた筋」（classroom-1 のガラスの暗い青緑のちぎれた形・墨の縁）。
 * 参考画像は読まず、キャンバスに手続きで描く: 上の縁から垂れる筋（幅のゆらぎ・丸い先・枝分かれ）、下の縁から伸びる塊、
 * 縦の框に沿う細い筋、暗い形の中の明るい欠け。1 枚の絵（4 × 4 の升目）にまとめ、ガラスの面ごとに升目を選ぶ。
 */

const COLS = 4;
const ROWS = 4;
const CW = 256;
const CH = 512;

export interface StreakAtlas {
  tex: THREE.CanvasTexture;
  mat: THREE.Material;
}

/** 1 つの升目に描く（kind: 0 = 上から垂れる・1 = 上と下・2 = 縁の筋だけ・3 = 濃い） */
function drawCell(g: CanvasRenderingContext2D, ox: number, oy: number, r: () => number, kind: number): void {
  const fills = ['#0e3b46', '#0c3540', '#114552', '#0a2f3a'];
  const ink = '#02151b';
  const chip = '#78d2d8';
  g.save();
  g.translate(ox, oy);
  g.beginPath();
  g.rect(0, 0, CW, CH);
  g.clip();
  const shapes: Path2D[] = [];
  // 上の縁の帯（ちぎれた下の縁）。ここから筋が垂れる
  if (kind !== 2) {
    const p = new Path2D();
    const base = CH * (0.015 + r() * 0.04);
    p.moveTo(-4, -4);
    for (let x = -4; x <= CW + 4; x += 10) p.lineTo(x, base + (r() - 0.3) * base * 1.4 + Math.sin(x * 0.05) * 6);
    p.lineTo(CW + 4, -4);
    p.closePath();
    shapes.push(p);
  }
  // 上から垂れる筋
  const nTop = kind === 2 ? 2 : kind === 3 ? 6 : 2 + Math.floor(r() * 3);
  for (let i = 0; i < nTop; i++) {
    const x0 = r() * CW;
    const w0 = 14 + r() * (kind === 3 ? 55 : 40);
    const len = CH * (kind === 2 ? 0.15 + r() * 0.3 : 0.12 + Math.pow(r(), 1.6) * 0.75);
    const p = new Path2D();
    const steps = 14;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    const ph = r() * 6;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const y = -4 + t * len;
      const wob = Math.sin(t * 9 + ph) * 3 + (r() - 0.5) * 6;
      // 幅はちぎれた紙のように段々に変わる（所々で急に細く・太く）
      const notch = r() < 0.25 ? 0.45 + r() * 0.3 : 1;
      const w = w0 * (1 - t * 0.6) * (0.7 + 0.6 * Math.abs(Math.sin(t * 5 + ph))) * notch;
      left.push([x0 - w / 2 + wob, y]);
      right.push([x0 + w / 2 + wob, y]);
    }
    p.moveTo(left[0][0], left[0][1]);
    for (const q of left) p.lineTo(q[0], q[1]);
    // 先の丸い滴
    const tip = right[right.length - 1];
    const tl = left[left.length - 1];
    const rr = Math.max(3, (tip[0] - tl[0]) * 0.8);
    p.arc((tip[0] + tl[0]) / 2, tip[1], rr, Math.PI, 0, true);
    for (let k = right.length - 1; k >= 0; k--) p.lineTo(right[k][0], right[k][1]);
    p.closePath();
    shapes.push(p);
    // 枝（途中から細い筋）
    if (r() < 0.4) {
      const k = 3 + Math.floor(r() * 6);
      const bx = (left[k][0] + right[k][0]) / 2;
      const by = left[k][1];
      const bl = len * (0.2 + r() * 0.4);
      const bw = 3 + r() * 5;
      const q = new Path2D();
      q.moveTo(bx - bw / 2, by);
      q.lineTo(bx - bw / 2 + (r() - 0.5) * 8, by + bl);
      q.arc(bx + (r() - 0.5) * 8, by + bl, bw * 0.7, Math.PI, 0, true);
      q.lineTo(bx + bw / 2, by);
      q.closePath();
      shapes.push(q);
    }
  }
  // 下から伸びる塊（藻・泥のような）
  if (kind === 1 || kind === 3 || r() < 0.25) {
    const n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const x0 = r() * CW;
      const h = CH * (0.06 + r() * (kind === 3 ? 0.4 : 0.25));
      const w = 18 + r() * 40;
      const p = new Path2D();
      p.moveTo(x0 - w / 2, CH + 4);
      const steps = 10;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const x = x0 - w / 2 + t * w;
        const y = CH - h * Math.pow(Math.sin(t * Math.PI), 0.6) * (0.55 + r() * 0.6);
        p.lineTo(x + (r() - 0.5) * 6, y);
        if (r() < 0.35) p.lineTo(x + (r() - 0.5) * 4, y - r() * h * 0.5);
      }
      p.lineTo(x0 + w / 2, CH + 4);
      p.closePath();
      shapes.push(p);
    }
  }
  // 縦の框に沿う筋（左右の縁）
  for (const side of [0, 1]) {
    if (r() < 0.35) continue;
    const p = new Path2D();
    const w = 6 + r() * 14;
    const x = side ? CW - w : 0;
    let y = r() * CH * 0.3;
    while (y < CH) {
      const seg = 30 + r() * 120;
      p.rect(x + (r() - 0.5) * 3, y, w * (0.5 + r() * 0.6), seg);
      y += seg + 10 + r() * 60;
    }
    shapes.push(p);
  }
  g.lineJoin = 'round';
  for (const p of shapes) {
    g.fillStyle = fills[Math.floor(r() * fills.length)];
    g.fill(p);
    g.strokeStyle = ink;
    g.lineWidth = 3;
    g.stroke(p);
  }
  // 暗い形の中の明るい欠け（剥がれた跡）と、ガラスの上の小さな欠片
  for (let i = 0; i < 26; i++) {
    const x = r() * CW;
    const y = r() * CH * 0.8;
    if (!shapes.some((p) => g.isPointInPath(p, x, y))) continue;
    g.fillStyle = chip;
    g.beginPath();
    g.ellipse(x, y, 1.5 + r() * 3, 3 + r() * 8, (r() - 0.5) * 0.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.restore();
}

export function createStreaks(ctx: SceneContext, seed = 7): StreakAtlas {
  const cv = document.createElement('canvas');
  cv.width = CW * COLS;
  cv.height = CH * ROWS;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, cv.width, cv.height);
  const r = rng(seed);
  // 升目の種類: 0 = 上から垂れる（多い）・1 = 上と下・2 = 縁の筋だけ・3 = 濃い（16 の内 2）
  const kinds = [0, 2, 1, 0, 2, 0, 3, 1, 0, 2, 0, 1, 2, 0, 3, 2];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) drawCell(g, i * CW, j * CH, r, kinds[i + j * COLS]);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  const mat = ctx.mat({ color: '#ffffff', map: tex, unlit: true, alphaTest: 0.5, side: THREE.DoubleSide, line: 0.25, name: 'streaks' });
  return { tex, mat };
}

/**
 * ガラスの面に筋の板を置く形（升目 cell を選ぶ）。窓の壁（x 一定）の面: 中心・幅（z）・高さ。flip で左右を反転
 */
export function streakQuad(cx: number, cy: number, cz: number, w: number, h: number, cell: number, flip: boolean): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateY(Math.PI / 2);
  g.translate(cx, cy, cz);
  const i = cell % COLS;
  const j = Math.floor(cell / COLS) % ROWS;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) {
    let u = uv.getX(k);
    const v = uv.getY(k);
    if (flip) u = 1 - u;
    // 升目の上の縁がガラスの上の縁（canvas の y は下向き → テクスチャの v は上が 1）
    uv.setXY(k, (i + u) / COLS, 1 - (j + 1 - v) / ROWS);
  }
  uv.needsUpdate = true;
  return g;
}
