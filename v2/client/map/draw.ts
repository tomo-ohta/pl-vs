/**
 * 地図を 2D のキャンバスに描く（v1 ui/Minimap.ts の drawMap の作り直し）。小さな地図・メニューの地図・壁の案内図・誰かの地図で同じ物を使う。
 * DOM に依存しない: 描く先は CanvasRenderingContext2D の一部（Ctx2D）。試験では呼ばれた命令を記録する偽物を渡す。
 *
 * 座標: 地図の x が画面の右、z が画面の下（北 = -Z が上）。回転（N03）は中心の回りに地図全体を回し、文字だけは正立させる。
 * 描く順: 背景 → 空白（BX04。白い紙の地）→ 写し（点線）→ 区画（見た / 入った / 今いる）→ 調べていない升目の影 → 開口・扉 →
 *         足跡 → 印（出口・塔・書き込み）→ プレイヤー → 方位（N）・題
 */
import type { Rect } from '../../core/world/footprint.ts';

/** 描く先（CanvasRenderingContext2D のうち使う物だけ） */
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  setLineDash(segments: number[]): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(a: number): void;
  fillText(text: string, x: number, y: number): void;
}

export type DrawStyle = 'hud' | 'panel' | 'sign' | 'paper';

export interface DrawCell {
  id: string;
  rects: Rect[];
  /** 'visited' 入った / 'seen' 見ただけ / 'current' 今いる / 'secret' 見つけた隠し / 'hidden' 記録されない（今いる間だけ破線） /
   *  'erasing' 消えていく / 'other' ほかの層 / 'plain' 看板の区画 */
  state: 'visited' | 'seen' | 'current' | 'secret' | 'hidden' | 'erasing' | 'other' | 'plain';
  /** 0..1（消えていく区画の残り・ほかの層の薄さ） */
  alpha?: number;
  /** 調べていない升目（中心 x, z と大きさ）。入った区画だけ */
  unsurveyed?: { x: number; z: number; w: number; d: number }[];
  kind?: string;
}

export interface DrawDoor { x: number; z: number; dir: number; width: number; kind: 'door' | 'opening' | 'secret' | 'open' }
export interface DrawMark { x: number; z: number; kind: 'here' | 'exit' | 'up' | 'note' | 'x' | 'blank' | 'landmark' | 'stairs'; text?: string; color?: string }
export interface DrawGhost { rects: Rect[][]; marks: DrawMark[]; trail: number[]; color: string }

export interface DrawInput {
  cells: DrawCell[];
  /** 地図の空白（BX04） */
  blanks: Rect[][];
  ghosts: DrawGhost[];
  doors: DrawDoor[];
  marks: DrawMark[];
  /** 自分の足跡（x, z の並び。古い順） */
  trail: number[];
  player: { x: number; z: number; yaw: number } | null;
  /** 合わせる範囲（view.center が無いとき） */
  bounds: Rect | null;
}

export interface DrawView {
  width: number;
  height: number;
  /** 地図の中心（m）。null なら bounds に合わせる */
  center: [number, number] | null;
  /** 1 m の画素（center があるとき。合わせるときの上限） */
  pxPerM: number;
  /** 地図の回転（ラジアン。画面の上で時計回りが正） */
  rotation?: number;
  style: DrawStyle;
  /** 方位の印（N）を描く */
  north?: boolean;
  /** 左上の題 */
  label?: string;
  /** 合わせるときの余白（画素） */
  pad?: number;
  /** 画面の画素密度（線の太さ・文字の大きさに掛ける） */
  dpr?: number;
  /** 経過秒（点滅・ノイズ） */
  time?: number;
}

export interface DrawResult { scale: number; toPx(x: number, z: number): [number, number] }

interface Palette {
  bg: string; visited: string; seen: string; current: string; secret: string; edge: string; edgeCurrent: string; shade: string;
  door: string; open: string; trail: string; text: string; blank: string; blankHatch: string; exit: string; up: string; landmark: string; player: string;
}
const PALETTES: Record<DrawStyle, Palette> = {
  hud: {
    bg: 'rgba(10,12,18,0.62)', visited: '#4a5263', seen: '#2c313c', current: '#6d7790', secret: '#6b4f8a', edge: 'rgba(230,232,238,0.35)', edgeCurrent: '#ffffff',
    shade: 'rgba(5,6,10,0.45)', door: '#cfd6e4', open: '#ffe28a', trail: 'rgba(242,193,78,0.85)', text: '#e6e8ee', blank: '#f1eee4', blankHatch: 'rgba(120,110,90,0.35)',
    exit: '#7dffa6', up: '#7fd8ff', landmark: '#ff6a5a', player: '#f2c14e',
  },
  panel: {
    bg: '#07080c', visited: '#505a6e', seen: '#2a2f3a', current: '#7a86a2', secret: '#7a5aa0', edge: 'rgba(236,233,224,0.4)', edgeCurrent: '#ffffff',
    shade: 'rgba(4,5,8,0.5)', door: '#cfd6e4', open: '#ffe28a', trail: 'rgba(242,193,78,0.8)', text: '#ece9e0', blank: '#f1eee4', blankHatch: 'rgba(120,110,90,0.35)',
    exit: '#7dffa6', up: '#7fd8ff', landmark: '#ff6a5a', player: '#f2c14e',
  },
  sign: {
    bg: '#e9e6dc', visited: '#bfc6cf', seen: '#bfc6cf', current: '#bfc6cf', secret: '#bfc6cf', edge: '#2b3340', edgeCurrent: '#2b3340',
    shade: 'rgba(0,0,0,0)', door: '#2b3340', open: '#2b3340', trail: '#c0392b', text: '#1d232c', blank: '#ffffff', blankHatch: 'rgba(0,0,0,0.08)',
    exit: '#1f8f4e', up: '#1f5f8f', landmark: '#c0392b', player: '#d0021b',
  },
  paper: {
    bg: '#efe7d2', visited: 'rgba(80,70,55,0.12)', seen: 'rgba(80,70,55,0.12)', current: 'rgba(80,70,55,0.12)', secret: 'rgba(80,70,55,0.12)', edge: 'rgba(60,50,40,0.75)', edgeCurrent: 'rgba(60,50,40,0.75)',
    shade: 'rgba(0,0,0,0)', door: 'rgba(60,50,40,0.75)', open: 'rgba(60,50,40,0.75)', trail: 'rgba(170,40,30,0.7)', text: '#3a2f25', blank: '#fffdf6', blankHatch: 'rgba(0,0,0,0.06)',
    exit: '#a8281e', up: '#a8281e', landmark: '#a8281e', player: '#a8281e',
  },
};

/** 回転したときの外接の大きさ */
function rotatedSize(w: number, h: number, a: number): [number, number] {
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return [w * c + h * s, w * s + h * c];
}

export function drawMap(ctx: Ctx2D, input: DrawInput, view: DrawView): DrawResult {
  const P = PALETTES[view.style];
  const W = view.width, H = view.height;
  const dpr = view.dpr ?? 1;
  const rot = view.rotation ?? 0;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, W, H);
  // 縮尺と中心
  let scale = view.pxPerM;
  let cx: number, cz: number;
  if (view.center) [cx, cz] = view.center;
  else {
    const b = input.bounds ?? { x0: -5, z0: -5, x1: 5, z1: 5 };
    const pad = view.pad ?? 16 * dpr;
    const [rw, rh] = rotatedSize(Math.max(4, b.x1 - b.x0), Math.max(4, b.z1 - b.z0), rot);
    scale = Math.max(0.5, Math.min(view.pxPerM, (W - 2 * pad) / rw, (H - 2 * pad) / rh));
    cx = (b.x0 + b.x1) / 2;
    cz = (b.z0 + b.z1) / 2;
  }
  const ox = W / 2 - cx * scale, oy = H / 2 - cz * scale;
  const toPx = (x: number, z: number): [number, number] => [ox + x * scale, oy + z * scale];
  const lw = (px: number): number => Math.max(0.5, px * dpr);

  ctx.translate(W / 2, H / 2);
  if (rot) ctx.rotate(rot);
  ctx.translate(-W / 2, -H / 2);

  const rectPath = (r: Rect, fill: boolean, stroke: boolean): void => {
    const [x, y] = toPx(r.x0, r.z0);
    const w = (r.x1 - r.x0) * scale, h = (r.z1 - r.z0) * scale;
    if (fill) ctx.fillRect(x, y, Math.max(1, w), Math.max(1, h));
    if (stroke) ctx.strokeRect(x, y, w, h);
  };

  // 空白（BX04）: 白い紙の地に薄い斜線。縁は描かない（「ここだけ地図が白い」）
  for (const rects of input.blanks) {
    ctx.fillStyle = P.blank;
    for (const r of rects) rectPath(r, true, false);
    ctx.strokeStyle = P.blankHatch;
    ctx.lineWidth = lw(1);
    for (const r of rects) {
      const [x0, y0] = toPx(r.x0, r.z0);
      const [x1, y1] = toPx(r.x1, r.z1);
      const step = Math.max(4, 6 * dpr);
      ctx.beginPath();
      for (let s = x0 - (y1 - y0); s < x1; s += step) {
        const a = Math.max(x0, s), b = Math.min(x1, s + (y1 - y0));
        if (b <= a) continue;
        ctx.moveTo(a, y1 - (a - s));
        ctx.lineTo(b, y1 - (b - s));
      }
      ctx.stroke();
    }
  }

  // 写し（点線）
  for (const g of input.ghosts) {
    ctx.strokeStyle = g.color;
    ctx.lineWidth = lw(1.2);
    ctx.setLineDash([4 * dpr, 3 * dpr]);
    for (const rects of g.rects) for (const r of rects) rectPath(r, false, true);
    ctx.setLineDash([]);
    if (g.trail.length >= 4) {
      ctx.beginPath();
      for (let i = 0; i + 1 < g.trail.length; i += 2) {
        const [x, y] = toPx(g.trail[i]!, g.trail[i + 1]!);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.setLineDash([2 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 区画: 縁を先に描き、上から塗ると、矩形どうしの継ぎ目の線が消える（v1 と同じ）。今いる区画は最後
  const cells = input.cells.slice().sort((a, b) => Number(a.state === 'current') - Number(b.state === 'current'));
  for (const c of cells) {
    const alpha = c.alpha ?? 1;
    if (alpha <= 0.01) continue;
    ctx.globalAlpha = alpha;
    const current = c.state === 'current';
    ctx.strokeStyle = current ? P.edgeCurrent : P.edge;
    ctx.lineWidth = lw(current ? 2.4 : 1.4);
    if (c.state === 'hidden' || c.state === 'other') ctx.setLineDash([3 * dpr, 3 * dpr]);
    for (const r of c.rects) rectPath(r, false, true);
    ctx.setLineDash([]);
    if (c.state === 'hidden') { ctx.globalAlpha = 1; continue; }
    ctx.fillStyle = c.state === 'current' ? P.current : c.state === 'visited' ? P.visited : c.state === 'secret' ? P.secret : P.seen;
    for (const r of c.rects) rectPath(r, true, false);
    // 調べていない升目の影（入った区画だけ。埋めていく楽しさ）
    if (c.unsurveyed?.length && view.style !== 'sign' && view.style !== 'paper') {
      ctx.fillStyle = P.shade;
      for (const u of c.unsurveyed) {
        const [x, y] = toPx(u.x - u.w / 2, u.z - u.d / 2);
        ctx.fillRect(x, y, u.w * scale, u.d * scale);
      }
    }
    ctx.globalAlpha = 1;
  }

  // 開口・扉
  for (const d of input.doors) {
    const [x, y] = toPx(d.x, d.z);
    const along = d.dir === 0 || d.dir === 2;
    const half = (d.width * scale) / 2;
    if (d.kind === 'opening') {
      // 開口: 壁の線を切る（背景の色の太い線は引かず、両端に小さな印）
      ctx.fillStyle = P.door;
      const t = lw(1.6);
      if (along) { ctx.fillRect(x - half - t / 2, y - t, t, t * 2); ctx.fillRect(x + half - t / 2, y - t, t, t * 2); }
      else { ctx.fillRect(x - t, y - half - t / 2, t * 2, t); ctx.fillRect(x - t, y + half - t / 2, t * 2, t); }
      continue;
    }
    ctx.fillStyle = d.kind === 'open' ? P.open : d.kind === 'secret' ? P.secret : P.door;
    const th = Math.max(lw(2.2), scale * 0.18);
    if (along) ctx.fillRect(x - half, y - th / 2, half * 2, th);
    else ctx.fillRect(x - th / 2, y - half, th, half * 2);
  }

  // 自分の足跡（新しいほど濃い点）
  const n = input.trail.length / 2;
  if (n > 0) {
    ctx.fillStyle = P.trail;
    const r = Math.max(lw(1.1), scale * 0.12);
    for (let i = 0; i < n; i++) {
      const [x, y] = toPx(input.trail[i * 2]!, input.trail[i * 2 + 1]!);
      ctx.globalAlpha = 0.25 + 0.75 * ((i + 1) / n);
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  // 印
  const marks = [...input.marks, ...input.ghosts.flatMap((g) => g.marks.map((m) => ({ ...m, color: m.color ?? g.color })))];
  for (const m of marks) drawMark(ctx, m, toPx(m.x, m.z), P, scale, dpr, rot, view.time ?? 0);

  // プレイヤー（回転の内側で描くので、地図との向きの関係は保たれる）
  if (input.player) {
    const [px, py] = toPx(input.player.x, input.player.z);
    const s = Math.max(5 * dpr, scale * 0.55);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-input.player.yaw);
    ctx.fillStyle = P.player;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.65, s * 0.8);
    ctx.lineTo(-s * 0.65, s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 方位（地図と一緒に回る北の印。地図が回ったことが分かる）
  if (view.north) {
    const r = 11 * dpr;
    const x = W - r - 8 * dpr, y = r + 8 * dpr;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = P.text;
    ctx.lineWidth = lw(1);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = P.landmark;
    ctx.beginPath();
    ctx.moveTo(0, -r + 2 * dpr);
    ctx.lineTo(3.5 * dpr, 0);
    ctx.lineTo(-3.5 * dpr, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.text;
    ctx.font = `bold ${Math.round(8 * dpr)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, r * 0.45);
    ctx.restore();
  }
  if (view.label) {
    ctx.save();
    ctx.font = `bold ${Math.round(12 * dpr)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = view.style === 'hud' || view.style === 'panel' ? '#f2c14e' : P.text;
    ctx.fillText(view.label, 8 * dpr, 7 * dpr);
    ctx.restore();
  }
  return { scale, toPx };
}

function drawMark(ctx: Ctx2D, m: DrawMark, [x, y]: [number, number], P: Palette, scale: number, dpr: number, rot: number, time: number): void {
  const color = m.color ?? (m.kind === 'exit' ? P.exit : m.kind === 'up' ? P.up : m.kind === 'landmark' ? P.landmark : P.text);
  const s = Math.max(4 * dpr, scale * 0.4);
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(-rot); // 文字・記号は正立
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.4 * dpr);
  switch (m.kind) {
    case 'here': {
      // 現在地: 赤い丸（点滅）
      ctx.globalAlpha = 0.55 + 0.45 * (Math.sin(time * 5) * 0.5 + 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'exit': {
      // 出口: 下向きの三角
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.6);
      ctx.lineTo(s, -s * 0.6);
      ctx.lineTo(0, s * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'up': {
      // 上の階へ: 上向きの三角
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.6);
      ctx.lineTo(s, s * 0.6);
      ctx.lineTo(0, -s * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'landmark': {
      // 塔: 上向きの三角と灯り
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.2);
      ctx.lineTo(s * 0.7, s * 0.7);
      ctx.lineTo(-s * 0.7, s * 0.7);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -s * 1.2, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'x': {
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.7); ctx.lineTo(s * 0.7, s * 0.7);
      ctx.moveTo(s * 0.7, -s * 0.7); ctx.lineTo(-s * 0.7, s * 0.7);
      ctx.stroke();
      break;
    }
    case 'stairs': {
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
      break;
    }
    case 'blank': case 'note': default: {
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1.5 * dpr, s * 0.25), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  if (m.text) {
    ctx.font = `${Math.round(Math.max(9, 10.5 * dpr))}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(m.text, 0, -s - 2 * dpr);
  }
  ctx.restore();
}
