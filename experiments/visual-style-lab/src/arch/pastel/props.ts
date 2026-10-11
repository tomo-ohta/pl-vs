import * as THREE from 'three';
import type { Builder, PartOptions, V3 } from '../../scenes/Builder.ts';
import { Atlas } from '../../scenes/corridor/kit.ts';
import { notice, scribble } from '../../scenes/corridor/tex.ts';
import type { Paints } from './paint.ts';
import { WHITE } from './paint.ts';
import { prop } from './props/mats.ts';
import { squatToilet } from './props/medical.ts';

/**
 * 淡色の廊下（建築版）の座標系（Fr）・掲示物・壁の小さな器具（参考画像の右の塊の描き方）・天井の灯り・便所の個室の仕切り・敷物・雪の吹きだまり。
 * 家具・機械・棚の中身などの小物は props/*.ts（小物の道具 src/props/kit.ts で部位ごとに作り込んだ物）。
 * 色は参考画像の色の表から: 白いほうろう・クリーム・セージ・灰青・暗い青緑（右の暗い棚の色）・淡い木。
 */

export const C = {
  enamel: '#e4e8da', // 白いほうろう（流し・棚・診察台の脚）
  pale: '#dde3d5',
  cream: '#d6d6c2', // 参考画像の奥の低い台
  creamD: '#c4c6b1',
  sage: '#a9b8ae',
  sageD: '#8fa29b',
  greyBlue: '#8a9d9d',
  dark: '#6f8382', // 参考画像の右の暗い棚
  darker: '#4f5f61',
  ink: '#3a4244', // 取っ手・小さな金具
  wood: '#cbc5ab', // 淡い木（机の天板）
  woodD: '#aea88f',
  metal: '#a3b0aa',
  paper: '#eef1e6',
  cushion: '#9fb3ad', // 診察台・長椅子の張り
  white: WHITE,
};

/**
 * 物の座標系（足元の真ん中が原点。+z が前 = 壁から離れる向き、-z が背）。yaw は Y 軸回り（three と同じ）。
 * 90° の倍数なら箱は軸に沿ったまま（当たり判定もそのまま）
 */
export class Fr {
  readonly c: number;
  readonly s: number;
  readonly axis: boolean;
  constructor(
    readonly b: Builder,
    readonly p: Paints,
    readonly x: number,
    readonly z: number,
    readonly yaw: number,
    readonly y = 0,
  ) {
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
    this.axis = Math.abs(this.c * this.s) < 1e-6;
  }
  w(p: V3): V3 {
    return [this.x + p[0] * this.c + p[2] * this.s, this.y + p[1], this.z - p[0] * this.s + p[2] * this.c];
  }
  sub(x: number, z: number, yaw = 0, y = 0): Fr {
    const q = this.w([x, y, z]);
    return new Fr(this.b, this.p, q[0], q[2], this.yaw + yaw, q[1]);
  }
  /** 色（名前か 16 進）で箱 */
  box(col: string | THREE.Material, min: V3, max: V3, o: PartOptions = {}): THREE.Mesh {
    const m = typeof col === 'string' ? this.p.solid(col) : col;
    const opt: PartOptions = { shadow: false, ...o };
    if (this.axis) {
      const a = this.w(min);
      const c = this.w(max);
      return this.b.boxMM(m, [Math.min(a[0], c[0]), a[1], Math.min(a[2], c[2])], [Math.max(a[0], c[0]), c[1], Math.max(a[2], c[2])], opt);
    }
    const ctr = this.w([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]);
    return this.b.box(m, ctr, [max[0] - min[0], max[1] - min[1], max[2] - min[2]], { ...opt, rotY: this.yaw });
  }
  cyl(col: string | THREE.Material, center: V3, r: number, len: number, o: PartOptions & { axis?: 'x' | 'y' | 'z'; radiusTop?: number; segments?: number } = {}): THREE.Mesh {
    const m = typeof col === 'string' ? this.p.solid(col) : col;
    let axis = o.axis;
    if (axis === 'x' || axis === 'z') {
      // 物の座標の軸 → 場面の軸（90° の倍数のとき）
      const sw = Math.abs(this.s) > 0.7;
      if (sw) axis = axis === 'x' ? 'z' : 'x';
    }
    return this.b.cyl(m, this.w(center), r, len, { shadow: false, segments: 12, ...o, axis, rotY: axis === 'y' || !axis ? this.yaw : 0 });
  }
}

// ---------------------------------------------------------------- 掲示物（キャンバスの図柄）

export class Posters {
  readonly atlas = new Atlas(2048);
  private readonly regions: [number, number, number, number][] = [];
  constructor(readonly p: Paints) {
    // 淡い紙に灰色の文字の線（参考画像の掲示は淡い長方形だけなので、近くで見たときだけ分かる程度の濃さ）
    const kinds: { bg: string; ink: string; head?: string; hand?: boolean }[] = [
      { bg: '#eef1e6', ink: '#bcc6bf', head: '#c9d5cd' },
      { bg: '#e5ece0', ink: '#b8c3bb' },
      { bg: '#dbe6e0', ink: '#aebcb6', head: '#bfd0c8' },
      { bg: '#f1f1e3', ink: '#c3c6b6', head: '#d5d3bf' },
      { bg: '#bed3c9', ink: '#a2b7ad' },
      { bg: '#eef1e6', ink: '#c4ccc4', hand: true },
    ];
    for (let i = 0; i < 18; i++) {
      const k = kinds[i % kinds.length];
      const w = 256;
      const h = i % 3 === 0 ? 360 : i % 3 === 1 ? 256 : 180;
      this.regions.push(this.atlas.add(w, h, (g) => notice(g, w, h, { bg: k.bg, ink: k.ink, head: k.head, seed: 7 + i * 13, hand: k.hand, lw: 3, row: 22 })));
    }
    // カレンダー（升目）と時刻表のような表
    this.regions.push(
      this.atlas.add(256, 320, (g) => {
        g.fillStyle = '#eef1e6';
        g.fillRect(0, 0, 256, 320);
        g.fillStyle = '#c9d5cd';
        g.fillRect(20, 20, 216, 90);
        g.strokeStyle = '#c3cbc4';
        g.lineWidth = 2;
        for (let r = 0; r <= 5; r++) {
          g.beginPath();
          g.moveTo(20, 130 + r * 34);
          g.lineTo(236, 130 + r * 34);
          g.stroke();
        }
        for (let c = 0; c <= 7; c++) {
          g.beginPath();
          g.moveTo(20 + c * 30.8, 130);
          g.lineTo(20 + c * 30.8, 300);
          g.stroke();
        }
      }),
    );
    this.regions.push(
      this.atlas.add(256, 180, (g) => {
        g.fillStyle = '#e8eee4';
        g.fillRect(0, 0, 256, 180);
        scribble(g, 20, 20, 216, 140, { color: '#b5c0b9', row: 18, width: 3, seed: 91 });
      }),
    );
    this.atlas.tex.needsUpdate = true;
  }
  get count(): number {
    return this.regions.length;
  }
  /** 壁に貼る（向き dir の面。中心・幅・高さ）。紙は壁から 5 mm 浮かせる */
  put(b: Builder, i: number, dir: 'px' | 'nx' | 'pz' | 'nz', c: V3, w: number, h: number): void {
    const [x, y, rw, rh] = this.regions[i % this.regions.length];
    const S = this.atlas.size;
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) {
      const u = uv.getX(k);
      const v = uv.getY(k);
      // キャンバスの上が v = 1（three のテクスチャは上下が反転して読まれる）
      uv.setXY(k, (x + u * rw) / S, 1 - (y + (1 - v) * rh) / S);
    }
    if (dir === 'px') g.rotateY(Math.PI / 2);
    if (dir === 'nx') g.rotateY(-Math.PI / 2);
    if (dir === 'nz') g.rotateY(Math.PI);
    const m = this.p.get(`poster|${dir}`, () => ({ color: '#eef1e6', map: this.atlas.tex, mapFace: dir }));
    b.mesh(g, m, c, { shadow: false });
  }
}

// ---------------------------------------------------------------- 物（原点は足元の真ん中・背が -z）

/** 灯り（天井の小さな白い長方形。参考画像の灯りと同じ） */
export function ceilingLamp(f: Fr, h: number, len = 0.9, wid = 0.1): void {
  f.box(f.p.glow('#f4f6e4'), [-len / 2, h - 0.04, -wid / 2], [len / 2, h - 0.02, wid / 2]);
  f.box(C.pale, [-len / 2 - 0.03, h - 0.02, -wid / 2 - 0.02], [len / 2 + 0.03, h, wid / 2 + 0.02]);
}

/** 便所の個室（仕切り・扉）。w × dp、扉は開き具合 open（0〜1） */
export function stall(f: Fr, w: number, dp: number, open: number, last: boolean): void {
  const h = 1.85;
  // 仕切りは塗った板（上が淡いセージ・腰から下が暗い灰青の 2 色。参考画像の壁と同じ塗り分け）
  const part = f.p.wall({ up: '#c9d4c6', low: '#8fa29b', band: 0.95 });
  f.box(part, [-w / 2, 0.15, -dp / 2], [-w / 2 + 0.03, h, dp / 2], { collide: true });
  if (last) f.box(part, [w / 2 - 0.03, 0.15, -dp / 2], [w / 2, h, dp / 2], { collide: true });
  // 前の面（扉の両側の柱と上の横木）
  f.box(part, [-w / 2, 0.15, dp / 2 - 0.03], [-w / 2 + 0.12, h, dp / 2]);
  f.box(part, [w / 2 - 0.08, 0.15, dp / 2 - 0.03], [w / 2, h, dp / 2]);
  f.box(C.metal, [-w / 2, h - 0.03, dp / 2 - 0.03], [w / 2, h, dp / 2]);
  // 扉（吊り元は左の柱）
  const dw = w - 0.22;
  const d = f.sub(-w / 2 + 0.12, dp / 2 - 0.015, -open * 1.2);
  d.box(C.cream, [0, 0.15, -0.015], [dw, h - 0.05, 0.015]);
  d.box(C.creamD, [0, 0.15, -0.017], [dw, 0.32, 0.017]);
  // 扉の内側の小さな貼り紙と掛け金物
  d.box(C.paper, [dw / 2 - 0.09, 1.35, -0.018], [dw / 2 + 0.09, 1.58, -0.016]);
  d.box('#b8c3bb', [dw / 2 - 0.06, 1.5, -0.019], [dw / 2 + 0.06, 1.515, -0.018]);
  d.box(C.ink, [dw / 2 - 0.02, 1.68, -0.05], [dw / 2 + 0.02, 1.72, -0.015]);
  // 扉の外の面: 使用中の表示の小窓（暗い枠に白）と番号の札
  d.box(C.ink, [dw - 0.16, 1.05, 0.015], [dw - 0.06, 1.11, 0.02]);
  d.box(C.paper, [dw - 0.15, 1.06, 0.02], [dw - 0.1, 1.1, 0.022]);
  d.box('#e5ece0', [dw / 2 - 0.08, 1.62, 0.015], [dw / 2 + 0.08, 1.74, 0.019]);
  d.box('#8f9e98', [dw / 2 - 0.03, 1.66, 0.019], [dw / 2 + 0.03, 1.7, 0.021]);
  d.box(C.ink, [dw - 0.08, 0.95, 0.015], [dw - 0.04, 1.0, 0.03]);
  // 和式の便器と高い所の水槽・管・紙の掛け（小物の道具で。props/medical.ts）
  squatToilet(prop(f), dp, w);
}

/** 敷物（玄関マット） */
export function mat(f: Fr, w: number, d: number, col = C.sageD): void {
  f.box(col, [-w / 2, 0, -d / 2], [w / 2, 0.012, d / 2]);
}

/** 雪の吹きだまり（床の上の白い低い山。板を少しずつずらして重ねる） */
export function drift(f: Fr, w: number, d: number, h = 0.12): void {
  const m = C.white;
  f.box(m, [-w / 2, 0, -d / 2], [w / 2, h * 0.5, d / 2]);
  f.box(m, [-w * 0.35, h * 0.5, -d * 0.4], [w * 0.3, h * 0.85, d * 0.25]);
  f.box(m, [-w * 0.15, h * 0.85, -d * 0.25], [w * 0.1, h, d * 0.05]);
}

/** 屋内消火栓の箱（壁に埋めた淡い扉と小さな表示灯）。原点は壁の面 */
export function hoseCabinet(f: Fr, y0 = 0.6): void {
  f.box(C.cream, [-0.4, y0, 0], [0.4, y0 + 1.2, 0.03]);
  f.box(C.creamD, [-0.36, y0 + 0.04, 0.03], [0.36, y0 + 1.16, 0.035]);
  f.box(C.ink, [0.26, y0 + 0.55, 0.035], [0.3, y0 + 0.68, 0.045]);
  f.box(C.paper, [-0.25, y0 + 0.85, 0.035], [0.15, y0 + 1.0, 0.038]);
  f.cyl(f.p.glow('#e8eadf'), [0, y0 + 1.32, 0.02], 0.05, 0.04, { axis: 'z', segments: 12 });
}

// ---------------------------------------------------------------- 壁の小さな器具（参考画像の右の塊の描き方。原点は壁の面・+z が手前）

/** スイッチの板（参考画像: 淡い板 #d8ddd0 に押しボタン 2 つ #c3c8c0） */
export function switchPlate(f: Fr, y: number, n = 2): void {
  const h = n > 1 ? 0.2 : 0.13;
  f.box('#d8ddd0', [-0.06, y, 0], [0.06, y + h, 0.006]);
  for (let i = 0; i < n; i++) {
    const yy = y + 0.04 + i * 0.07;
    f.box('#c3c8c0', [-0.028, yy, 0.006], [0.028, yy + 0.05, 0.01]);
  }
}

/** 上の器具の板（参考画像の右上: 板の中に灰色の面と暗い横の線） */
export function slotPlate(f: Fr, y: number): void {
  f.box('#d8ddd0', [-0.072, y, 0], [0.072, y + 0.245, 0.006]);
  f.box('#b3b8b2', [-0.058, y + 0.02, 0.006], [0.058, y + 0.225, 0.009]);
  f.box('#4a5153', [-0.03, y + 0.11, 0.009], [0.03, y + 0.12, 0.011]);
}

/** 足元のコンセント（参考画像の右下: 小さな板に穴 2 つ） */
export function socket(f: Fr, y = 0.21): void {
  f.box('#d8ddd0', [-0.055, y, 0], [0.055, y + 0.17, 0.006]);
  f.box('#c3c8c0', [-0.03, y + 0.09, 0.006], [0.03, y + 0.13, 0.009]);
  f.box('#c3c8c0', [-0.03, y + 0.03, 0.006], [0.03, y + 0.07, 0.009]);
}

/** 高い所の小さな灰色の板（案内・換気口。参考画像の左上・右上の板） */
export function highPlate(f: Fr, y: number, w = 0.19, h = 0.155, vent = false): void {
  f.box('#9fb2aa', [-w / 2, y, 0], [w / 2, y + h, 0.012]);
  if (vent) for (let i = 0; i < 3; i++) f.box('#c9d6cf', [-w / 2 + 0.025, y + 0.03 + i * (h - 0.05) / 3, 0.012], [w / 2 - 0.025, y + 0.045 + i * (h - 0.05) / 3, 0.014]);
  else f.box('#c9d6cf', [-w / 2 + 0.03, y + 0.03, 0.012], [w / 2 - 0.03, y + h - 0.03, 0.014]);
}

/** 掲示板（淡いセージの板に紙 2〜3 枚。参考画像の掲示の描き方）。原点は壁の面 */
export function noticeBoard(f: Fr, w: number, h: number, y: number, seed = 1): void {
  f.box(C.sageD, [-w / 2, y, 0], [w / 2, y + h, 0.02]);
  f.box('#c9d5cd', [-w / 2 + 0.03, y + 0.03, 0.02], [w / 2 - 0.03, y + h - 0.03, 0.024]);
  let s = seed * 7717;
  const r = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const pw = 0.16 + r() * 0.1;
    const ph = pw * (1.2 + r() * 0.3);
    const x = -w / 2 + 0.08 + ((w - 0.16 - pw) * (i + r() * 0.5)) / n;
    const yy = y + 0.08 + r() * (h - 0.16 - ph);
    f.box(i % 2 ? C.paper : '#e5ece0', [x, yy, 0.024], [x + pw, yy + ph, 0.027]);
    f.box('#b8c3bb', [x + 0.03, yy + ph - 0.06, 0.027], [x + pw - 0.03, yy + ph - 0.045, 0.028]);
  }
}

/** 壁の掛け金物（木の帯に暗いフック）。原点は壁の面 */
export function hooks(f: Fr, w: number, y: number, n = 4): void {
  f.box(C.woodD, [-w / 2, y, 0], [w / 2, y + 0.08, 0.02]);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    f.box(C.ink, [x - 0.01, y + 0.02, 0.02], [x + 0.01, y + 0.06, 0.08]);
    f.box(C.ink, [x - 0.01, y + 0.06, 0.06], [x + 0.01, y + 0.09, 0.08]);
  }
}
