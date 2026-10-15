/**
 * タブレットの画面の絵（canvas 2D・論理 1920 × 1000）。ホログラム調。
 * - 上: 見出し（ロゴ・タブ [1] MAP / [2] HINT・今いる部屋）
 * - MAP: 全体マップ（北が上。未踏破は暗い点線の輪郭・踏破は水色・制圧は橙・難易度は踏破した部屋だけ）と、右に集計
 * - HINT: 今いる部屋（番号・難易度・踏破 / 制圧・ボタンの数）と、ヒント 1〜3 の札（未解放は伏せ字と解放の条件）
 * - 下（両方のタブ）: 進行率バー（1 本に踏破（水色）と制圧（橙）を重ねる・上に今の %・下にヒントの解放の目盛り）
 *
 * 論理の大きさは 1920 × 1200（16:10）。地図を大きく見せるため、地図の枠を縦に広く取る。
 * 描き直しは変わったときだけ（draw が true を返したら、貼っている絵を更新する）。動く物（現在地の矢印・走査の光・ちらつき）は
 * 3D の側（TabletView）で描く
 */
import type { World } from '../gen/world.ts';
import type { Progress } from '../game/Progress.ts';
import { BUTTON_COUNT } from '../gen/puzzles.ts';
import { HOLO, FONT, brackets, chamfer, diamond, glow, lockIcon, measure, scramble, text, wrap, type Ctx } from './holo.ts';

export const SCREEN = { W: 1920, H: 1200 } as const;
export type TabKey = 'map' | 'hint';

const MAP = { x: 46, y: 146, w: 1408, h: 760 };
const SIDE = { x: 1478, y: 146, w: 396, h: 760 };
const BAR = { x: 46, y: 932, w: 1828, h: 236 };
const TABS = { x: 600, y: 30, w: 290, h: 74, gap: 18 };

const HINT_TAGS = ['抽象', '具体', '核心'];

export class TabletScreen {
  readonly canvas: HTMLCanvasElement;
  private readonly g: Ctx;
  private readonly s: number;
  private readonly frame: HTMLCanvasElement;
  private readonly mapLayer: HTMLCanvasElement;
  private readonly world: World;
  private readonly progress: Progress;
  private dirty = true;
  private mapDirty = true;
  /** 地図の変換（m → 論理 px） */
  private readonly xf: { k: number; ox: number; oy: number };
  tab: TabKey = 'map';
  room = -1;

  constructor(world: World, progress: Progress, scale: number) {
    this.world = world;
    this.progress = progress;
    this.s = scale;
    const make = (): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = Math.round(SCREEN.W * scale);
      c.height = Math.round(SCREEN.H * scale);
      return c;
    };
    this.canvas = make();
    this.g = this.canvas.getContext('2d')!;
    this.frame = make();
    this.mapLayer = make();
    const b = world.bounds;
    const pad = 34;
    const k = Math.min((MAP.w - pad * 2) / (b.x1 - b.x0), (MAP.h - pad * 2 - 20) / (b.z1 - b.z0));
    this.xf = {
      k,
      ox: MAP.x + (MAP.w - (b.x1 - b.x0) * k) / 2 - b.x0 * k,
      oy: MAP.y + 10 + (MAP.h - (b.z1 - b.z0) * k) / 2 - b.z0 * k,
    };
    this.drawFrame();
  }

  /** 変わった（次の draw で描き直す） */
  invalidate(map = false): void {
    this.dirty = true;
    if (map) this.mapDirty = true;
  }

  setTab(t: TabKey): void {
    if (t === this.tab) return;
    this.tab = t;
    this.invalidate();
  }

  setRoom(r: number): void {
    if (r === this.room) return;
    this.room = r;
    this.invalidate(true);
  }

  /** 地図の上の点（m）の、画面の uv（0..1。u 右へ・v 下へ） */
  mapUv(x: number, z: number): { u: number; v: number } {
    return { u: (this.xf.ox + x * this.xf.k) / SCREEN.W, v: (this.xf.oy + z * this.xf.k) / SCREEN.H };
  }

  /** 地図の 1 m が画面の何割か（矢印の大きさ） */
  get mapScale(): number {
    return this.xf.k / SCREEN.W;
  }

  draw(): boolean {
    if (!this.dirty) return false;
    this.dirty = false;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.frame, 0, 0);
    g.setTransform(this.s, 0, 0, this.s, 0, 0);
    this.drawHeader(g);
    if (this.tab === 'map') {
      if (this.mapDirty) this.drawMapLayer();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.mapLayer, 0, 0);
      g.setTransform(this.s, 0, 0, this.s, 0, 0);
      this.drawSide(g);
    } else this.drawHints(g);
    this.drawProgress(g);
    return true;
  }

  // ---------------------------------------------------------------- 枠（変わらない）

  private drawFrame(): void {
    const g = this.frame.getContext('2d')!;
    g.setTransform(this.s, 0, 0, this.s, 0, 0);
    const { W, H } = SCREEN;
    // 板: 暗く透ける。上ほどわずかに明るい
    chamfer(g, 6, 6, W - 12, H - 12, [30, 30, 30, 30]);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(7, 30, 44, 0.86)');
    bg.addColorStop(0.5, 'rgba(4, 19, 30, 0.85)');
    bg.addColorStop(1, 'rgba(3, 13, 22, 0.89)');
    g.fillStyle = bg;
    g.fill();
    // 中央がわずかに明るい
    const rg = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, W * 0.62);
    rg.addColorStop(0, 'rgba(70, 200, 230, 0.07)');
    rg.addColorStop(1, 'rgba(70, 200, 230, 0)');
    g.fillStyle = rg;
    g.fill();
    // 細かい点（投影のざらつき）
    let seed = 11;
    const rnd = (): number => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    g.fillStyle = 'rgba(140, 240, 255, 0.05)';
    for (let i = 0; i < 1600; i++) g.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    // 縁: 光る線と内側の細い線
    g.save();
    glow(g, HOLO.cyan, 18);
    g.strokeStyle = 'rgba(98, 240, 255, 0.85)';
    g.lineWidth = 2.2;
    chamfer(g, 6, 6, W - 12, H - 12, [30, 30, 30, 30]);
    g.stroke();
    g.restore();
    g.strokeStyle = HOLO.cyanFaint;
    g.lineWidth = 1;
    chamfer(g, 16, 16, W - 32, H - 32, [22, 22, 22, 22]);
    g.stroke();
    // 角の強い括弧
    g.save();
    glow(g, HOLO.cyan, 12);
    brackets(g, 2, 2, W - 4, H - 4, 54, HOLO.cyan, 4);
    g.restore();
    // 上下の縁の目盛り
    g.fillStyle = 'rgba(98, 240, 255, 0.28)';
    for (let x = 80; x < W - 80; x += 24) {
      g.fillRect(x, 20, 1, x % 120 === 8 ? 8 : 4);
      g.fillRect(x, H - 28, 1, x % 120 === 8 ? 8 : 4);
    }
    // 見出しの下の線（両端が消える）
    const lg = g.createLinearGradient(40, 0, W - 40, 0);
    lg.addColorStop(0, 'rgba(98, 240, 255, 0)');
    lg.addColorStop(0.15, 'rgba(98, 240, 255, 0.5)');
    lg.addColorStop(0.85, 'rgba(98, 240, 255, 0.5)');
    lg.addColorStop(1, 'rgba(98, 240, 255, 0)');
    g.fillStyle = lg;
    g.fillRect(40, 124, W - 80, 1.5);
  }

  // ---------------------------------------------------------------- 見出し

  private drawHeader(g: Ctx): void {
    // ロゴ
    g.save();
    glow(g, HOLO.cyan, 12);
    g.fillStyle = HOLO.cyan;
    g.beginPath();
    g.moveTo(48, 92);
    g.lineTo(84, 56);
    g.lineTo(84, 92);
    g.closePath();
    g.fill();
    g.restore();
    text(g, 'HOLO//NAV', 100, 80, { font: `600 34px ${FONT.latin}`, color: HOLO.ice, spacing: 5, glowColor: HOLO.cyan, blur: 14 });
    text(g, `SECTOR SURVEY · SEED ${this.world.seed}`, 102, 104, { font: `400 15px ${FONT.mono}`, color: HOLO.iceDim, spacing: 2 });

    // タブ
    const tabs: { key: TabKey; n: string; en: string; jp: string; badge: boolean }[] = [
      { key: 'map', n: '1', en: 'MAP', jp: '全体マップ', badge: false },
      { key: 'hint', n: '2', en: 'HINT', jp: 'ヒント', badge: this.room >= 0 && this.progress.unseen(this.room) > 0 },
    ];
    tabs.forEach((t, i) => {
      const x = TABS.x + i * (TABS.w + TABS.gap);
      const y = TABS.y;
      const on = this.tab === t.key;
      g.save();
      chamfer(g, x, y, TABS.w, TABS.h, [16, 0, 16, 0]);
      if (on) {
        const fg = g.createLinearGradient(0, y, 0, y + TABS.h);
        fg.addColorStop(0, 'rgba(98, 240, 255, 0.34)');
        fg.addColorStop(1, 'rgba(98, 240, 255, 0.08)');
        g.fillStyle = fg;
        g.fill();
        glow(g, HOLO.cyan, 16);
        g.strokeStyle = HOLO.cyan;
        g.lineWidth = 2;
      } else {
        g.fillStyle = 'rgba(98, 240, 255, 0.04)';
        g.fill();
        g.strokeStyle = HOLO.cyanDim;
        g.lineWidth = 1.5;
      }
      g.stroke();
      g.restore();
      // キーの番号
      chamfer(g, x + 18, y + 20, 34, 34, 6);
      g.strokeStyle = on ? HOLO.cyan : HOLO.cyanDim;
      g.lineWidth = 1.5;
      g.stroke();
      text(g, t.n, x + 35, y + 44, { font: `400 22px ${FONT.mono}`, color: on ? HOLO.ice : HOLO.iceDim, align: 'center' });
      text(g, t.en, x + 70, y + 46, {
        font: `600 30px ${FONT.latin}`,
        color: on ? HOLO.ice : HOLO.iceDim,
        spacing: 4,
        glowColor: on ? HOLO.cyan : undefined,
        blur: 12,
      });
      text(g, t.jp, x + 72, y + 66, { font: `500 15px ${FONT.jp}`, color: on ? HOLO.cyanSoft : HOLO.iceFaint, spacing: 1 });
      if (on) {
        g.save();
        glow(g, HOLO.cyan, 10);
        g.fillStyle = HOLO.cyan;
        g.fillRect(x + 24, y + TABS.h + 6, TABS.w - 48, 3);
        g.restore();
      }
      if (t.badge) this.chip(g, x + TABS.w - 74, y + 12, 'NEW', HOLO.gold, true);
    });

    // 今いる部屋
    const r = this.room >= 0 ? this.world.rooms[this.room] : null;
    const right = SCREEN.W - 52;
    if (!r) return;
    const solved = this.progress.solved[r.index];
    const visited = this.progress.visited[r.index];
    let x = right;
    // 状態の札
    x -= this.chip(g, x - 92, 40, solved ? '制圧済み' : '未制圧', solved ? HOLO.solved : HOLO.iceFaint, solved, 92) + 10;
    x -= this.chip(g, x - 76, 40, visited ? '踏破' : '未踏破', visited ? HOLO.visited : HOLO.iceFaint, visited, 76) + 14;
    // 難易度
    for (let k = 2; k >= 0; k--) {
      diamond(g, x - 12 - (2 - k) * 26, 58, 10, k < r.difficulty, k < r.difficulty ? HOLO.ice : HOLO.cyanDim);
    }
    x -= 3 * 26 + 18;
    text(g, r.label, x, 78, { font: `400 54px ${FONT.mono}`, color: HOLO.ice, align: 'right', glowColor: HOLO.cyan, blur: 16 });
    const w = measure(g, r.label, `400 54px ${FONT.mono}`);
    text(g, 'ROOM', x - w - 12, 74, { font: `600 18px ${FONT.latin}`, color: HOLO.cyanSoft, align: 'right', spacing: 3 });
    text(g, `難易度 ${r.difficulty}`, right, 104, { font: `500 15px ${FONT.jp}`, color: HOLO.iceDim, align: 'right' });
  }

  /** 小さな札（幅を返す） */
  private chip(g: Ctx, x: number, y: number, label: string, color: string, filled: boolean, minW = 0): number {
    const font = /[A-Z]/.test(label) ? `600 15px ${FONT.latin}` : `500 16px ${FONT.jp}`;
    const w = Math.max(minW, measure(g, label, font, 1) + 26);
    g.save();
    chamfer(g, x, y, w, 30, [8, 0, 8, 0]);
    if (filled) {
      g.fillStyle = color + '33';
      g.fill();
      glow(g, color, 10);
    }
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
    text(g, label, x + w / 2, y + 21, { font, color: filled ? '#fff8ee' : color, align: 'center', spacing: 1 });
    return w;
  }

  // ---------------------------------------------------------------- 全体マップ

  private drawMapLayer(): void {
    this.mapDirty = false;
    const c = this.mapLayer;
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.setTransform(this.s, 0, 0, this.s, 0, 0);
    const { k, ox, oy } = this.xf;
    const P = (x: number, z: number): [number, number] => [ox + x * k, oy + z * k];

    // 枠と升目（10 m）
    g.save();
    chamfer(g, MAP.x, MAP.y, MAP.w, MAP.h, [0, 18, 0, 18]);
    g.fillStyle = 'rgba(2, 12, 18, 0.35)';
    g.fill();
    g.strokeStyle = HOLO.cyanDim;
    g.lineWidth = 1.2;
    g.stroke();
    g.clip();
    g.strokeStyle = 'rgba(98, 240, 255, 0.06)';
    g.lineWidth = 1;
    const b = this.world.bounds;
    for (let x = Math.floor(b.x0 / 10) * 10 - 40; x <= b.x1 + 40; x += 10) {
      const [px] = P(x, 0);
      g.beginPath();
      g.moveTo(px, MAP.y);
      g.lineTo(px, MAP.y + MAP.h);
      g.stroke();
    }
    for (let z = Math.floor(b.z0 / 10) * 10 - 40; z <= b.z1 + 40; z += 10) {
      const [, py] = P(0, z);
      g.beginPath();
      g.moveTo(MAP.x, py);
      g.lineTo(MAP.x + MAP.w, py);
      g.stroke();
    }
    g.restore();
    brackets(g, MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 8, 22, HOLO.cyanSoft, 2);
    const tw = text(g, 'SECTOR MAP', MAP.x + 18, MAP.y + 30, { font: `600 17px ${FONT.latin}`, color: HOLO.cyanSoft, spacing: 4 });
    text(g, `全体マップ · ${this.world.rooms.length} 部屋`, MAP.x + 18 + tw + 14, MAP.y + 30, { font: `500 15px ${FONT.jp}`, color: HOLO.iceFaint });
    // 方位と縮尺
    const nx = MAP.x + MAP.w - 40;
    const ny = MAP.y + 46;
    g.save();
    glow(g, HOLO.cyan, 8);
    g.fillStyle = HOLO.cyanSoft;
    g.beginPath();
    g.moveTo(nx, ny - 18);
    g.lineTo(nx + 9, ny + 6);
    g.lineTo(nx, ny);
    g.lineTo(nx - 9, ny + 6);
    g.closePath();
    g.fill();
    g.restore();
    text(g, 'N', nx, ny + 26, { font: `600 15px ${FONT.latin}`, color: HOLO.cyanSoft, align: 'center' });
    const sx = MAP.x + 20;
    const sy = MAP.y + MAP.h - 22;
    g.fillStyle = HOLO.cyanSoft;
    g.fillRect(sx, sy, 10 * k, 2);
    g.fillRect(sx, sy - 6, 2, 8);
    g.fillRect(sx + 10 * k - 2, sy - 6, 2, 8);
    text(g, '10 m', sx + 10 * k + 10, sy + 5, { font: `400 14px ${FONT.mono}`, color: HOLO.iceDim });

    // 部屋
    const prog = this.progress;
    const inset = 1.6;
    const rooms = this.world.rooms;
    const rectOf = (i: number): [number, number, number, number] => {
      const r = rooms[i].rect;
      const [x0, y0] = P(r.x, r.z);
      return [x0 + inset, y0 + inset, r.w * k - inset * 2, r.d * k - inset * 2];
    };
    // 塗り
    for (const r of rooms) {
      const [x, y, w, h] = rectOf(r.index);
      g.fillStyle = prog.solved[r.index] ? 'rgba(255, 154, 60, 0.22)' : prog.visited[r.index] ? 'rgba(79, 210, 255, 0.17)' : 'rgba(98, 240, 255, 0.035)';
      g.fillRect(x, y, w, h);
    }
    // 輪郭: 未踏破は点線、踏破・制圧は光る線
    g.save();
    g.setLineDash([5, 5]);
    g.strokeStyle = 'rgba(98, 240, 255, 0.30)';
    g.lineWidth = 1.2;
    for (const r of rooms) {
      if (prog.visited[r.index]) continue;
      const [x, y, w, h] = rectOf(r.index);
      g.strokeRect(x, y, w, h);
    }
    g.restore();
    for (const [color, pick] of [
      [HOLO.visited, (i: number) => prog.visited[i] && !prog.solved[i]],
      [HOLO.solved, (i: number) => prog.solved[i]],
    ] as const) {
      g.save();
      glow(g, color, 8);
      g.strokeStyle = color;
      g.lineWidth = 1.8;
      g.beginPath();
      for (const r of rooms) {
        if (!pick(r.index)) continue;
        const [x, y, w, h] = rectOf(r.index);
        g.rect(x, y, w, h);
      }
      g.stroke();
      g.restore();
    }
    // 扉: 壁の線を切って開ける
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = 7;
    g.lineCap = 'butt';
    g.beginPath();
    for (const d of this.world.doors) {
      const h = d.width / 2;
      const [ax, ay] = d.vertical ? P(d.at, d.c - h) : P(d.c - h, d.at);
      const [bx, by] = d.vertical ? P(d.at, d.c + h) : P(d.c + h, d.at);
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
    }
    g.stroke();
    g.restore();
    // 扉の印（短い横棒）
    g.strokeStyle = 'rgba(160, 245, 255, 0.55)';
    g.lineWidth = 1.4;
    g.beginPath();
    for (const d of this.world.doors) {
      const [cx, cy] = d.vertical ? P(d.at, d.c) : P(d.c, d.at);
      const e = 3.2;
      if (d.vertical) {
        g.moveTo(cx - e, cy);
        g.lineTo(cx + e, cy);
      } else {
        g.moveTo(cx, cy - e);
        g.lineTo(cx, cy + e);
      }
    }
    g.stroke();
    // 今いる部屋
    if (this.room >= 0) {
      const [x, y, w, h] = rectOf(this.room);
      g.save();
      glow(g, '#ffffff', 18);
      g.strokeStyle = 'rgba(235, 255, 255, 0.95)';
      g.lineWidth = 2.6;
      g.strokeRect(x - 1, y - 1, w + 2, h + 2);
      g.restore();
      g.fillStyle = 'rgba(200, 250, 255, 0.10)';
      g.fillRect(x, y, w, h);
    }
    // 部屋番号と難易度（踏破した部屋だけ）
    for (const r of rooms) {
      const [x, y, w, h] = rectOf(r.index);
      const visited = prog.visited[r.index];
      const fs = Math.max(15, Math.min(23, Math.min(w, h) * 0.38));
      const showDiff = visited && r.difficulty > 0 && h > fs * 2.2;
      const cy = y + h / 2 + (showDiff ? -fs * 0.28 : fs * 0.36);
      text(g, r.label, x + w / 2, cy, {
        font: `400 ${fs}px ${FONT.mono}`,
        color: prog.solved[r.index] ? '#ffe2c4' : visited ? HOLO.ice : 'rgba(150, 220, 235, 0.42)',
        align: 'center',
      });
      if (showDiff) {
        const dr = Math.max(4, fs * 0.28);
        for (let i = 0; i < r.difficulty; i++) {
          diamond(g, x + w / 2 + (i - (r.difficulty - 1) / 2) * dr * 2.2, cy + fs * 0.62, dr, true, prog.solved[r.index] ? HOLO.solved : HOLO.visited);
        }
      }
    }
  }

  // ---------------------------------------------------------------- 右の集計

  private drawSide(g: Ctx): void {
    const p = this.progress;
    const x = SIDE.x;
    const W = SIDE.w;
    let y = SIDE.y;
    const box = (h: number, title: string, sub: string): void => {
      chamfer(g, x, y, W, h, [0, 14, 0, 0]);
      g.fillStyle = 'rgba(98, 240, 255, 0.035)';
      g.fill();
      g.strokeStyle = HOLO.cyanDim;
      g.lineWidth = 1.2;
      g.stroke();
      text(g, title, x + 18, y + 32, { font: `600 16px ${FONT.latin}`, color: HOLO.cyanSoft, spacing: 4 });
      text(g, sub, x + W - 18, y + 32, { font: `500 14px ${FONT.jp}`, color: HOLO.iceFaint, align: 'right' });
    };
    // 集計
    box(250, 'SURVEY', '集計');
    const stat = (yy: number, label: string, en: string, n: number, color: string): void => {
      g.save();
      glow(g, color, 10);
      g.fillStyle = color;
      g.fillRect(x + 18, yy - 56, 4, 64);
      g.restore();
      text(g, label, x + 36, yy - 30, { font: `700 24px ${FONT.jp}`, color });
      text(g, en, x + 36, yy - 4, { font: `600 13px ${FONT.latin}`, color: HOLO.iceFaint, spacing: 3 });
      text(g, String(n), x + W - 96, yy, { font: `400 70px ${FONT.mono}`, color: HOLO.ice, align: 'right', glowColor: color, blur: 18 });
      text(g, `/${p.total}`, x + W - 88, yy, { font: `400 24px ${FONT.mono}`, color: HOLO.iceDim });
    };
    stat(y + 128, '踏破', 'VISITED', p.visitedCount, HOLO.visited);
    stat(y + 218, '制圧', 'CLEARED', p.solvedCount, HOLO.solved);

    // ヒントの段階
    y += 268;
    box(250, 'HINT LEVEL', 'ヒントの段階');
    const stage = p.stage;
    text(g, 'LV', x + 18, y + 104, { font: `600 22px ${FONT.latin}`, color: HOLO.cyanSoft, spacing: 2 });
    const lw = text(g, String(stage), x + 54, y + 110, { font: `400 70px ${FONT.mono}`, color: stage > 0 ? HOLO.gold : HOLO.iceDim, glowColor: stage > 0 ? HOLO.gold : undefined, blur: 16 });
    text(g, `/ ${p.thresholds.length}`, x + 62 + lw, y + 110, { font: `400 24px ${FONT.mono}`, color: HOLO.iceDim });
    p.thresholds.forEach((t, i) => {
      const bx = x + 18 + i * 122;
      const by = y + 134;
      const on = stage > i;
      chamfer(g, bx, by, 112, 46, [8, 0, 8, 0]);
      g.save();
      if (on) {
        g.fillStyle = 'rgba(255, 196, 107, 0.16)';
        g.fill();
        glow(g, HOLO.gold, 10);
      }
      g.strokeStyle = on ? HOLO.gold : HOLO.cyanDim;
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
      text(g, `H${i + 1}`, bx + 14, by + 31, { font: `600 19px ${FONT.latin}`, color: on ? HOLO.gold : HOLO.iceDim, spacing: 1 });
      if (on) text(g, 'OPEN', bx + 98, by + 30, { font: `600 13px ${FONT.latin}`, color: HOLO.gold, align: 'right', spacing: 1 });
      else {
        lockIcon(g, bx + 66, by + 28, 18, HOLO.cyanDim);
        text(g, String(t), bx + 100, by + 30, { font: `400 15px ${FONT.mono}`, color: HOLO.iceFaint, align: 'right' });
      }
    });
    const next = p.nextThreshold;
    const msg = next === null ? 'すべてのヒントを解放済み' : `次の H${stage + 1}：制圧 ${next} 部屋（あと ${next - p.solvedCount}）`;
    text(g, msg, x + 18, y + 220, { font: `500 17px ${FONT.jp}`, color: next === null ? HOLO.gold : HOLO.iceDim });

    // 凡例
    y += 268;
    box(SIDE.y + SIDE.h - y, 'LEGEND', '凡例');
    const items: [string, (lx: number, ly: number) => void][] = [
      [
        '未踏破',
        (lx, ly) => {
          g.save();
          g.setLineDash([4, 4]);
          g.strokeStyle = 'rgba(98, 240, 255, 0.45)';
          g.lineWidth = 1.4;
          g.strokeRect(lx, ly - 12, 30, 18);
          g.restore();
        },
      ],
      [
        '踏破',
        (lx, ly) => {
          g.fillStyle = 'rgba(79, 210, 255, 0.22)';
          g.fillRect(lx, ly - 12, 30, 18);
          g.strokeStyle = HOLO.visited;
          g.lineWidth = 1.6;
          g.strokeRect(lx, ly - 12, 30, 18);
        },
      ],
      [
        '制圧',
        (lx, ly) => {
          g.fillStyle = 'rgba(255, 154, 60, 0.26)';
          g.fillRect(lx, ly - 12, 30, 18);
          g.strokeStyle = HOLO.solved;
          g.lineWidth = 1.6;
          g.strokeRect(lx, ly - 12, 30, 18);
        },
      ],
      [
        '現在地',
        (lx, ly) => {
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.moveTo(lx + 15, ly - 14);
          g.lineTo(lx + 24, ly + 8);
          g.lineTo(lx + 15, ly + 2);
          g.lineTo(lx + 6, ly + 8);
          g.closePath();
          g.fill();
        },
      ],
    ];
    items.forEach(([label, icon], i) => {
      const lx = x + 18 + (i % 2) * 186;
      const ly = y + 78 + Math.floor(i / 2) * 44;
      icon(lx, ly);
      text(g, label, lx + 44, ly + 5, { font: `500 18px ${FONT.jp}`, color: HOLO.iceDim });
    });
    for (let k = 0; k < 2; k++) diamond(g, x + 26 + k * 18, y + 174, 7, true, HOLO.visited);
    text(g, '難易度（踏破した部屋）', x + 66, y + 180, { font: `500 15px ${FONT.jp}`, color: HOLO.iceFaint });
  }

  // ---------------------------------------------------------------- ヒント

  private drawHints(g: Ctx): void {
    const p = this.progress;
    const r = this.room >= 0 ? this.world.rooms[this.room] : null;
    // 左: 今いる部屋
    const L = { x: 46, y: 146, w: 540, h: 760 };
    chamfer(g, L.x, L.y, L.w, L.h, [0, 18, 0, 18]);
    g.fillStyle = 'rgba(98, 240, 255, 0.035)';
    g.fill();
    g.strokeStyle = HOLO.cyanDim;
    g.lineWidth = 1.2;
    g.stroke();
    brackets(g, L.x - 4, L.y - 4, L.w + 8, L.h + 8, 22, HOLO.cyanSoft, 2);
    text(g, 'CURRENT ROOM', L.x + 24, L.y + 38, { font: `600 17px ${FONT.latin}`, color: HOLO.cyanSoft, spacing: 4 });
    text(g, '今いる部屋', L.x + L.w - 24, L.y + 38, { font: `500 15px ${FONT.jp}`, color: HOLO.iceFaint, align: 'right' });
    if (!r) return;
    text(g, r.label, L.x + 20, L.y + 206, { font: `400 176px ${FONT.mono}`, color: HOLO.ice, glowColor: HOLO.cyan, blur: 26 });
    const row = (yy: number, en: string, jp: string): void => {
      g.fillStyle = HOLO.cyanFaint;
      g.fillRect(L.x + 24, yy - 40, L.w - 48, 1);
      text(g, en, L.x + 24, yy, { font: `600 14px ${FONT.latin}`, color: HOLO.cyanSoft, spacing: 3 });
      text(g, jp, L.x + 24, yy + 22, { font: `500 13px ${FONT.jp}`, color: HOLO.iceFaint });
    };
    // 難易度
    row(L.y + 300, 'DIFFICULTY', '難易度');
    for (let k = 0; k < 3; k++) diamond(g, L.x + 210 + k * 40, L.y + 300, 15, k < r.difficulty, k < r.difficulty ? HOLO.ice : HOLO.cyanDim);
    text(g, String(r.difficulty), L.x + L.w - 28, L.y + 314, { font: `400 46px ${FONT.mono}`, color: HOLO.ice, align: 'right' });
    // 状態
    const visited = p.visited[r.index];
    const solved = p.solved[r.index];
    row(L.y + 410, 'STATUS', '状態');
    this.chip(g, L.x + 196, L.y + 388, visited ? '踏破' : '未踏破', visited ? HOLO.visited : HOLO.iceFaint, visited, 110);
    this.chip(g, L.x + 320, L.y + 388, solved ? '制圧済み' : '未制圧', solved ? HOLO.solved : HOLO.iceFaint, solved, 130);
    // 謎
    const n = BUTTON_COUNT[r.difficulty];
    row(L.y + 520, 'PUZZLE', '謎');
    text(g, `ボタン ${n} 個`, L.x + 196, L.y + 524, { font: `700 28px ${FONT.jp}`, color: HOLO.ice });
    text(g, n === 1 ? '押せば制圧' : '決まった順に押す', L.x + 196, L.y + 556, { font: `500 17px ${FONT.jp}`, color: HOLO.iceDim });
    if (n > 1) text(g, '全部押すと判定（途中では分からない）', L.x + 196, L.y + 582, { font: `500 15px ${FONT.jp}`, color: HOLO.iceFaint });
    // ヒントの決まり
    g.fillStyle = HOLO.cyanFaint;
    g.fillRect(L.x + 24, L.y + 650, L.w - 48, 1);
    text(g, 'ヒントは、全部屋の制圧数に応じて', L.x + 24, L.y + 690, { font: `500 16px ${FONT.jp}`, color: HOLO.iceFaint });
    text(g, `全部屋で同時に解放（${p.thresholds.join(' / ')} 部屋）`, L.x + 24, L.y + 716, { font: `500 16px ${FONT.jp}`, color: HOLO.iceFaint });

    // 右: ヒント 1〜3
    const hints = this.world.hints[r.index];
    const stage = p.stage;
    const seen = p.seen[r.index];
    const X = 616;
    const Wd = SCREEN.W - 46 - X;
    const ch = (L.h - 2 * 16) / 3;
    hints.forEach((h, i) => {
      const y = L.y + i * (ch + 16);
      const open = stage > i;
      const fresh = open && seen <= i;
      const accent = fresh ? HOLO.gold : open ? HOLO.cyan : HOLO.cyanDim;
      g.save();
      chamfer(g, X, y, Wd, ch, [0, 16, 0, 16]);
      g.fillStyle = open ? 'rgba(98, 240, 255, 0.06)' : 'rgba(98, 240, 255, 0.025)';
      g.fill();
      if (fresh) glow(g, HOLO.gold, 16);
      g.strokeStyle = fresh ? HOLO.gold : open ? HOLO.cyanSoft : HOLO.cyanDim;
      g.lineWidth = fresh ? 2 : 1.2;
      g.stroke();
      g.restore();
      // 左の色の帯
      g.save();
      if (open) glow(g, accent, 12);
      g.fillStyle = accent;
      g.fillRect(X, y + 18, 5, ch - 36);
      g.restore();
      const hw = text(g, `HINT ${i + 1}`, X + 30, y + 46, { font: `600 26px ${FONT.latin}`, color: open ? HOLO.ice : HOLO.iceDim, spacing: 3, glowColor: open ? accent : undefined, blur: 10 });
      text(g, HINT_TAGS[i], X + 30 + hw + 16, y + 45, { font: `500 17px ${FONT.jp}`, color: open ? HOLO.cyanSoft : HOLO.iceFaint });
      // 状態の札
      if (fresh) this.chip(g, X + Wd - 100, y + 20, 'NEW', HOLO.gold, true, 76);
      else if (open) this.chip(g, X + Wd - 104, y + 20, 'OPEN', HOLO.cyan, false, 80);
      else this.chip(g, X + Wd - 128, y + 20, 'LOCKED', HOLO.iceFaint, false, 104);
      if (open) {
        const font = `500 32px ${FONT.jp}`;
        const lines = wrap(g, h, font, Wd - 74);
        lines.slice(0, 3).forEach((ln, k) => {
          text(g, ln, X + 30, y + 106 + k * 48, { font, color: HOLO.ice, glowColor: 'rgba(98, 240, 255, 0.35)', blur: 6 });
        });
      } else {
        const t = p.thresholds[i];
        const left = t - p.solvedCount;
        text(g, scramble(r.index * 31 + i * 7 + 3, 36), X + 30, y + 112, { font: `400 28px ${FONT.mono}`, color: 'rgba(98, 240, 255, 0.2)', spacing: 3 });
        lockIcon(g, X + 44, y + 168, 24, HOLO.iceDim);
        const cw = text(g, `制圧 ${t} 部屋で解放`, X + 68, y + 175, { font: `700 23px ${FONT.jp}`, color: HOLO.iceDim });
        text(g, `あと ${left} 部屋`, X + 68 + cw + 18, y + 175, { font: `500 20px ${FONT.jp}`, color: HOLO.cyanSoft });
      }
    });
  }

  // ---------------------------------------------------------------- 進行率バー

  private drawProgress(g: Ctx): void {
    const p = this.progress;
    const vis = p.visitedPct;
    const sol = p.solvedPct;
    const B = BAR;
    const tw = text(g, 'PROGRESS', B.x, B.y + 18, { font: `600 16px ${FONT.latin}`, color: HOLO.cyanSoft, spacing: 4 });
    text(g, '進行率（踏破・制圧）', B.x + tw + 14, B.y + 18, { font: `500 15px ${FONT.jp}`, color: HOLO.iceFaint });
    text(g, `${p.total} 部屋`, B.x + B.w, B.y + 18, { font: `500 15px ${FONT.jp}`, color: HOLO.iceFaint, align: 'right' });

    const barY = B.y + 128;
    const barH = 38;
    const ix = B.x + 10;
    const iw = B.w - 20;
    const xAt = (pct: number): number => ix + (iw * pct) / 100;
    // バーの外枠
    chamfer(g, B.x, barY - 6, B.w, barH + 12, [10, 0, 10, 0]);
    g.fillStyle = 'rgba(98, 240, 255, 0.05)';
    g.fill();
    g.strokeStyle = HOLO.cyanDim;
    g.lineWidth = 1.2;
    g.stroke();
    // 100 の区切り（1 部屋 = 1 %）
    const cw = iw / 100;
    const cell = (k: number): void => {
      g.rect(ix + k * cw + 1.2, barY + 3, cw - 2.4, barH - 6);
    };
    g.fillStyle = 'rgba(98, 240, 255, 0.13)';
    g.beginPath();
    for (let k = vis; k < 100; k++) cell(k);
    g.fill();
    for (const [from, to, color] of [
      [sol, vis, HOLO.visited],
      [0, sol, HOLO.solved],
    ] as const) {
      if (to <= from) continue;
      g.save();
      glow(g, color, 12);
      g.fillStyle = color;
      g.beginPath();
      for (let k = from; k < to; k++) cell(k);
      g.fill();
      g.restore();
    }
    // 先端の明るい区切り
    for (const [pct, color] of [
      [vis, '#d8f7ff'],
      [sol, '#ffe0c0'],
    ] as const) {
      if (pct <= 0) continue;
      g.save();
      glow(g, color, 16);
      g.fillStyle = color;
      g.beginPath();
      cell(pct - 1);
      g.fill();
      g.restore();
    }
    // 10 % ごとの小さな目盛り
    g.fillStyle = HOLO.cyanDim;
    for (let k = 0; k <= 100; k += 10) g.fillRect(xAt(k) - 0.5, barY + barH + 6, 1, k % 50 === 0 ? 10 : 6);
    text(g, '0', xAt(0), barY + barH + 34, { font: `400 15px ${FONT.mono}`, color: HOLO.iceFaint, align: 'left' });
    text(g, '100%', xAt(100), barY + barH + 34, { font: `400 15px ${FONT.mono}`, color: HOLO.iceFaint, align: 'right' });

    // ヒントの解放の目盛り（制圧の部屋の数）
    const stage = p.stage;
    p.thresholds.forEach((t, i) => {
      const pct = (t / p.total) * 100;
      const x = xAt(pct);
      const on = stage > i;
      const color = on ? HOLO.gold : 'rgba(150, 230, 245, 0.55)';
      g.save();
      if (on) glow(g, HOLO.gold, 12);
      g.fillStyle = color;
      g.fillRect(x - 1.25, barY - 12, 2.5, barH + 34);
      // 小さな三角
      g.beginPath();
      g.moveTo(x - 7, barY - 18);
      g.lineTo(x + 7, barY - 18);
      g.lineTo(x, barY - 9);
      g.closePath();
      g.fill();
      g.restore();
      const tw = measure(g, `HINT ${i + 1}`, `600 18px ${FONT.latin}`, 2);
      const sub = on ? '解放' : `制圧 ${t}`;
      const subW = measure(g, sub, `500 15px ${FONT.jp}`) + (on ? 10 : 30);
      // 右の端に近い目盛りは、文字を目盛りの左に置く
      const lx = x + 8 + tw + subW > B.x + B.w ? x - 8 - tw - subW : x + 8;
      text(g, `HINT ${i + 1}`, lx, barY + barH + 34, { font: `600 18px ${FONT.latin}`, color, spacing: 2, glowColor: on ? HOLO.gold : undefined, blur: 10 });
      if (on) text(g, sub, lx + tw + 10, barY + barH + 34, { font: `700 15px ${FONT.jp}`, color: HOLO.gold });
      else {
        lockIcon(g, lx + tw + 16, barY + barH + 31, 16, 'rgba(150, 230, 245, 0.55)');
        text(g, sub, lx + tw + 30, barY + barH + 34, { font: `500 15px ${FONT.jp}`, color: HOLO.iceFaint });
      }
    });

    // 上の % の札: 上の段が踏破、下の段が制圧（細い線でバーの位置を指す）
    const label = (pct: number, jp: string, color: string, top: number, bg: string): void => {
      const x = xAt(pct);
      const numFont = `400 34px ${FONT.mono}`;
      const jpFont = `700 19px ${FONT.jp}`;
      const w = measure(g, jp, jpFont) + measure(g, `${pct}%`, numFont) + 44;
      const cx = Math.max(B.x + w / 2, Math.min(B.x + B.w - w / 2, x));
      // 指す線
      g.save();
      g.strokeStyle = color;
      g.globalAlpha = 0.85;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, top + 40);
      g.lineTo(x, barY - 2);
      g.stroke();
      g.restore();
      g.save();
      chamfer(g, cx - w / 2, top, w, 40, [10, 0, 10, 0]);
      g.fillStyle = bg;
      g.fill();
      glow(g, color, 12);
      g.strokeStyle = color;
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
      const jx = cx - w / 2 + 16;
      const jw = text(g, jp, jx, top + 28, { font: jpFont, color });
      text(g, `${pct}%`, jx + jw + 12, top + 32, { font: numFont, color: HOLO.ice, glowColor: color, blur: 12 });
    };
    label(vis, '踏破', HOLO.visited, B.y + 30, 'rgba(6, 30, 44, 0.92)');
    label(sol, '制圧', HOLO.solved, B.y + 76, 'rgba(36, 20, 8, 0.92)');
  }
}
