/**
 * タブレットの画面の絵の道具（2D canvas）: 角の丸い四角・文字・アプリのアイコン・壁紙。絵は全部ここで描く（画像は使わない）
 */
import type { AppId } from '../logic.ts';

export type G = CanvasRenderingContext2D;

export const SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", "Yu Gothic", system-ui, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';

export const COLOR = {
  bg: '#0e1116',
  panel: '#171b22',
  panel2: '#1f242d',
  line: 'rgba(255,255,255,0.12)',
  text: '#eef0f4',
  dim: '#9aa2b1',
  faint: '#5d6574',
  accent: '#f2c14e',
  accentDark: '#b58d2c',
  danger: '#ff5a52',
  ok: '#7ad79a',
} as const;

export function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

export function fillRR(g: G, x: number, y: number, w: number, h: number, r: number, style: string | CanvasGradient): void {
  rr(g, x, y, w, h, r);
  g.fillStyle = style;
  g.fill();
}

export interface TextOpts {
  size: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  mono?: boolean;
  /** これより長ければ縮める（px） */
  max?: number;
  alpha?: number;
}

export function text(g: G, s: string, x: number, y: number, o: TextOpts): void {
  g.save();
  g.font = `${o.weight ?? 500} ${o.size}px ${o.mono ? MONO : SANS}`;
  g.fillStyle = o.color ?? COLOR.text;
  g.textAlign = o.align ?? 'left';
  g.textBaseline = o.base ?? 'middle';
  if (o.alpha !== undefined) g.globalAlpha = o.alpha;
  if (o.max) g.fillText(s, x, y, o.max);
  else g.fillText(s, x, y);
  g.restore();
}

export function measure(g: G, s: string, size: number, weight = 500, mono = false): number {
  g.save();
  g.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  const w = g.measureText(s).width;
  g.restore();
  return w;
}

/** ホーム画面の壁紙: 暗い廊下の奥行き（消失点に向かう線と、奥のかすかな光） */
export function wallpaper(g: G, w: number, h: number): void {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1e2633');
  bg.addColorStop(0.55, '#141921');
  bg.addColorStop(1, '#0a0c10');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const vx = w * 0.5, vy = h * 0.47;
  const glow = g.createRadialGradient(vx, vy, 0, vx, vy, h * 0.55);
  glow.addColorStop(0, 'rgba(255,236,190,0.16)');
  glow.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 2;
  // 床と天井の継ぎ目・壁の角（消失点へ）
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h], [w * 0.25, h], [w * 0.75, h], [w * 0.25, 0], [w * 0.75, 0]] as const) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(vx, vy); g.stroke();
  }
  // 奥へ並ぶ照明の板
  for (let i = 1; i <= 5; i++) {
    const k = 1 / (1 + i * 0.75);
    const pw = w * 0.16 * k, py = vy - h * 0.42 * k;
    g.fillStyle = `rgba(255,248,226,${0.06 * k + 0.02})`;
    g.fillRect(vx - pw / 2, py, pw, Math.max(2, 10 * k));
  }
  g.restore();
}

/** アプリのアイコン（size 四方。角の丸い板と絵） */
export function appIcon(g: G, id: AppId, x: number, y: number, s: number): void {
  const grad = (a: string, b: string): CanvasGradient => { const q = g.createLinearGradient(x, y, x, y + s); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
  const bgs: Record<string, [string, string]> = {
    camera: ['#4a505a', '#1f2228'], explore: ['#2aa3a0', '#0f5d63'], map: ['#5cb46a', '#25703a'],
    sns: ['#8c62e6', '#4a2ea6'], gallery: ['#fbfbfd', '#d6d9df'], settings: ['#9aa0a8', '#5b6068'], home: ['#333', '#111'],
  };
  const [c0, c1] = bgs[id] ?? bgs.home!;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = s * 0.12;
  g.shadowOffsetY = s * 0.04;
  fillRR(g, x, y, s, s, s * 0.23, grad(c0, c1));
  g.restore();
  g.save();
  rr(g, x, y, s, s, s * 0.23);
  g.clip();
  const P = (u: number, v: number): [number, number] => [x + u * s, y + v * s];
  const white = '#ffffff';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  switch (id) {
    case 'camera': {
      g.strokeStyle = white;
      g.lineWidth = s * 0.055;
      rr(g, ...P(0.18, 0.34), s * 0.64, s * 0.42, s * 0.08);
      g.stroke();
      rr(g, ...P(0.37, 0.25), s * 0.26, s * 0.12, s * 0.04);
      g.fillStyle = white;
      g.fill();
      g.beginPath(); g.arc(...P(0.5, 0.555), s * 0.125, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(...P(0.71, 0.43), s * 0.03, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'explore': {
      const [cx, cy] = P(0.5, 0.52);
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = s * 0.045;
      g.beginPath(); g.arc(cx, cy, s * 0.3, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, r0 = s * (i % 3 === 0 ? 0.2 : 0.24), r1 = s * 0.27;
        g.lineWidth = s * (i % 3 === 0 ? 0.04 : 0.022);
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
      }
      // 針
      g.fillStyle = '#ffd45e';
      g.beginPath(); g.moveTo(cx + s * 0.17, cy - s * 0.17); g.lineTo(cx + s * 0.035, cy + s * 0.035); g.lineTo(cx - s * 0.035, cy - s * 0.035); g.closePath(); g.fill();
      g.fillStyle = white;
      g.beginPath(); g.moveTo(cx - s * 0.17, cy + s * 0.17); g.lineTo(cx + s * 0.035, cy + s * 0.035); g.lineTo(cx - s * 0.035, cy - s * 0.035); g.closePath(); g.fill();
      break;
    }
    case 'map': {
      const pts = [[0.18, 0.3], [0.39, 0.23], [0.61, 0.3], [0.82, 0.23], [0.82, 0.71], [0.61, 0.78], [0.39, 0.71], [0.18, 0.78]] as const;
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      pts.forEach(([u, v], i) => (i ? g.lineTo(...P(u, v)) : g.moveTo(...P(u, v))));
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(37,112,58,0.45)';
      g.lineWidth = s * 0.025;
      for (const [u0, v0, u1, v1] of [[0.39, 0.23, 0.39, 0.71], [0.61, 0.3, 0.61, 0.78]] as const) { g.beginPath(); g.moveTo(...P(u0, v0)); g.lineTo(...P(u1, v1)); g.stroke(); }
      // 赤い印
      g.fillStyle = '#e8463c';
      g.beginPath(); g.arc(...P(0.55, 0.43), s * 0.07, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(...P(0.49, 0.46)); g.lineTo(...P(0.55, 0.6)); g.lineTo(...P(0.61, 0.46)); g.fill();
      g.fillStyle = white;
      g.beginPath(); g.arc(...P(0.55, 0.43), s * 0.028, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'sns': {
      g.fillStyle = white;
      rr(g, ...P(0.17, 0.25), s * 0.66, s * 0.44, s * 0.14);
      g.fill();
      g.beginPath(); g.moveTo(...P(0.3, 0.66)); g.lineTo(...P(0.26, 0.82)); g.lineTo(...P(0.45, 0.68)); g.closePath(); g.fill();
      g.fillStyle = '#6a43cf';
      for (const u of [0.36, 0.5, 0.64]) { g.beginPath(); g.arc(...P(u, 0.47), s * 0.045, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'gallery': {
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.25)';
      g.shadowBlur = s * 0.05;
      fillRR(g, ...P(0.17, 0.24), s * 0.66, s * 0.52, s * 0.05, '#ffffff');
      g.restore();
      const [px, py] = P(0.22, 0.29);
      const pw = s * 0.56, ph = s * 0.42;
      g.save();
      rr(g, px, py, pw, ph, s * 0.03);
      g.clip();
      const sky = g.createLinearGradient(px, py, px, py + ph);
      sky.addColorStop(0, '#77b7ff');
      sky.addColorStop(1, '#cfe6ff');
      g.fillStyle = sky;
      g.fillRect(px, py, pw, ph);
      g.fillStyle = '#ff9b3d';
      g.beginPath(); g.arc(px + pw * 0.72, py + ph * 0.3, s * 0.07, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3c7d4e';
      g.beginPath(); g.moveTo(px - 4, py + ph); g.lineTo(px + pw * 0.35, py + ph * 0.42); g.lineTo(px + pw * 0.62, py + ph); g.fill();
      g.fillStyle = '#2b5d8c';
      g.beginPath(); g.moveTo(px + pw * 0.3, py + ph); g.lineTo(px + pw * 0.66, py + ph * 0.55); g.lineTo(px + pw + 4, py + ph); g.fill();
      g.restore();
      break;
    }
    case 'settings': {
      const [cx, cy] = P(0.5, 0.5);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      const teeth = 9, r0 = s * 0.25, r1 = s * 0.33;
      for (let i = 0; i < teeth * 2; i++) {
        const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? r1 : r0;
        g.arc(cx, cy, r, a0 + 0.04, a1 - 0.04);
      }
      g.closePath();
      g.fill();
      g.fillStyle = '#6f747c';
      g.beginPath(); g.arc(cx, cy, s * 0.12, 0, Math.PI * 2); g.fill();
      break;
    }
  }
  // つやの帯
  const sh = g.createLinearGradient(x, y, x, y + s * 0.5);
  sh.addColorStop(0, 'rgba(255,255,255,0.16)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh;
  g.fillRect(x, y, s, s * 0.5);
  g.restore();
}

/** 電池・電波の小さな絵（状態の帯） */
export function statusGlyphs(g: G, xRight: number, y: number, size: number, color: string): number {
  const h = size * 0.5, w = size * 1.05;
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 2;
  // 電池
  const bx = xRight - w, by = y - h / 2;
  rr(g, bx, by, w - 4, h, 4);
  g.stroke();
  g.fillRect(bx + w - 3, by + h * 0.3, 3, h * 0.4);
  g.fillRect(bx + 3, by + 3, (w - 10) * 0.82, h - 6);
  g.restore();
  return xRight - w - size * 0.3;
}
