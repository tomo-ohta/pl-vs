import * as THREE from 'three';
import type { Builder, PartOptions, V3 } from '../../scenes/Builder.ts';
import { Atlas } from '../../scenes/corridor/kit.ts';
import { notice, scribble } from '../../scenes/corridor/tex.ts';
import type { Paints } from './paint.ts';
import { WHITE } from './paint.ts';

/**
 * 淡色の廊下（建築版）の小物。参考画像と同じ「面ごとの平らな色」で、箱と円柱の組み合わせ（寸法は実物）。
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

/** 形を描かない当たり判定（物の座標の箱の、場面の座標での外接箱） */
export function solid(f: Fr, min: V3, max: V3): void {
  const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
  const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    const q = f.w([x, y, z]);
    lo.min(new THREE.Vector3(...q));
    hi.max(new THREE.Vector3(...q));
  }
  f.b.ctx.colliders.add(lo, hi);
}

/** 灯り（天井の小さな白い長方形。参考画像の灯りと同じ） */
export function ceilingLamp(f: Fr, h: number, len = 0.9, wid = 0.1): void {
  f.box(f.p.glow('#f4f6e4'), [-len / 2, h - 0.04, -wid / 2], [len / 2, h - 0.02, wid / 2]);
  f.box(C.pale, [-len / 2 - 0.03, h - 0.02, -wid / 2 - 0.02], [len / 2 + 0.03, h, wid / 2 + 0.02]);
}

/** 長椅子（待合。木の座と背・鉄の脚）w は幅 */
export function bench(f: Fr, w = 1.8): void {
  f.box(C.cushion, [-w / 2, 0.38, -0.2], [w / 2, 0.44, 0.22], { collide: true });
  f.box(C.cushion, [-w / 2, 0.48, -0.24], [w / 2, 0.86, -0.18]);
  f.box(C.sageD, [-w / 2, 0.44, -0.24], [w / 2, 0.48, -0.2]);
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) {
    f.box(C.metal, [x - 0.025, 0, -0.18], [x + 0.025, 0.38, -0.13]);
    f.box(C.metal, [x - 0.025, 0, 0.12], [x + 0.025, 0.38, 0.17]);
    f.box(C.metal, [x - 0.025, 0.02, -0.18], [x + 0.025, 0.05, 0.17]);
  }
}

/** 石油ストーブ（円柱の胴・上の天板・やかん・囲いの柵） */
export function stove(f: Fr): void {
  f.cyl(C.darker, [0, 0.03, 0], 0.27, 0.06, { segments: 16 });
  f.cyl(C.sageD, [0, 0.33, 0], 0.24, 0.54, { segments: 16, collide: true });
  f.cyl(C.dark, [0, 0.62, 0], 0.26, 0.04, { segments: 16 });
  f.cyl(C.enamel, [0.05, 0.71, 0], 0.11, 0.14, { segments: 12, radiusTop: 0.07 });
  f.box(C.enamel, [0.15, 0.72, -0.012], [0.24, 0.745, 0.012]);
  f.box(C.ink, [-0.02, 0.8, -0.06], [0.12, 0.82, 0.06]);
  // 囲い（四角い柵）
  const r = 0.55;
  for (const [a, c] of [[[-r, -r], [r, -r]], [[r, -r], [r, r]], [[r, r], [-r, r]], [[-r, r], [-r, -r]]] as [[number, number], [number, number]][]) {
    f.box(C.metal, [Math.min(a[0], c[0]) - 0.01, 0.62, Math.min(a[1], c[1]) - 0.01], [Math.max(a[0], c[0]) + 0.01, 0.65, Math.max(a[1], c[1]) + 0.01]);
    f.box(C.metal, [Math.min(a[0], c[0]) - 0.01, 0.2, Math.min(a[1], c[1]) - 0.01], [Math.max(a[0], c[0]) + 0.01, 0.22, Math.max(a[1], c[1]) + 0.01]);
  }
  for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]]) f.box(C.metal, [x - 0.015, 0, z - 0.015], [x + 0.015, 0.65, z + 0.015], { collide: true });
}

/** 下足箱（升目の棚。低い物は窓の下に置ける） */
export function shoeRack(f: Fr, w: number, h: number, dp = 0.36, shoes = 0.4, seed = 1): void {
  f.box(C.enamel, [-w / 2, 0, -dp / 2], [w / 2, h, dp / 2], { collide: true });
  const rows = Math.max(2, Math.round(h / 0.22));
  const cols = Math.max(2, Math.round(w / 0.3));
  for (let i = 1; i < rows; i++) f.box(C.creamD, [-w / 2 + 0.02, (h * i) / rows - 0.01, dp / 2], [w / 2 - 0.02, (h * i) / rows + 0.01, dp / 2 + 0.005]);
  for (let j = 1; j < cols; j++) f.box(C.creamD, [-w / 2 + (w * j) / cols - 0.01, 0.02, dp / 2], [-w / 2 + (w * j) / cols + 0.01, h - 0.02, dp / 2 + 0.005]);
  // 升の奥（暗い）と、いくつかにスリッパ・靴
  let s = seed * 9301;
  const rnd = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const x0 = -w / 2 + (w * j) / cols + 0.03;
      const x1 = -w / 2 + (w * (j + 1)) / cols - 0.03;
      const y0 = (h * i) / rows + 0.025;
      const y1 = (h * (i + 1)) / rows - 0.025;
      f.box(C.sage, [x0, y0, dp / 2 - 0.002], [x1, y1, dp / 2 + 0.002]);
      if (rnd() < shoes) f.box(rnd() < 0.5 ? C.greyBlue : C.creamD, [x0 + 0.02, y0, dp / 2 - 0.01], [x1 - 0.02, y0 + 0.07, dp / 2 + 0.006]);
    }
}

/** スリッパ立て（細い棚にスリッパが斜めに並ぶ） */
export function slipperStand(f: Fr, w = 0.6, n = 6): void {
  f.box(C.metal, [-w / 2, 0, -0.08], [w / 2, 0.02, 0.08]);
  for (const x of [-w / 2, w / 2 - 0.02]) f.box(C.metal, [x, 0, -0.02], [x + 0.02, 0.9, 0.02]);
  for (let i = 0; i < 3; i++) f.box(C.metal, [-w / 2, 0.25 + i * 0.25, -0.02], [w / 2, 0.27 + i * 0.25, 0.02]);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.06 + (i % 3) * ((w - 0.12) / 2);
    const y = 0.28 + Math.floor(i / 3) * 0.25;
    f.box(i % 2 ? C.greyBlue : C.cushion, [x - 0.045, y - 0.18, 0.02], [x + 0.045, y + 0.03, 0.05]);
  }
}

/** 傘立て */
export function umbrellaStand(f: Fr, n = 2): void {
  f.box(C.metal, [-0.2, 0, -0.12], [0.2, 0.5, 0.12], { collide: true });
  f.box(C.sageD, [-0.18, 0.5, -0.1], [0.18, 0.51, 0.1]);
  for (let i = 0; i < n; i++) {
    const x = -0.1 + i * 0.12;
    f.box(i % 2 ? C.greyBlue : C.dark, [x - 0.03, 0.2, -0.03], [x + 0.03, 0.85, 0.03]);
    f.box(C.ink, [x - 0.015, 0.85, -0.015], [x + 0.015, 0.95, 0.015]);
  }
}

/** 植木鉢と植物（枯れかけた丸い葉の塊） */
export function plant(f: Fr, h = 1.1): void {
  f.cyl(C.creamD, [0, 0.17, 0], 0.17, 0.34, { segments: 10, radiusTop: 0.2, collide: true });
  f.cyl(C.woodD, [0, 0.5, 0], 0.02, 0.4, { segments: 6 });
  const leaf = '#8fa595';
  for (const [x, y, z, r] of [[0, h - 0.25, 0, 0.26], [0.14, h - 0.45, 0.05, 0.2], [-0.12, h - 0.5, -0.04, 0.2], [0.02, h - 0.05, 0.03, 0.16]] as const)
    f.box(leaf, [x - r, y - r * 0.6, z - r], [x + r, y + r * 0.6, z + r]);
}

/** 雑誌の棚（斜めの段） */
export function magazineRack(f: Fr, w = 0.8): void {
  f.box(C.wood, [-w / 2, 0, -0.15], [w / 2, 0.08, 0.15], { collide: true });
  for (const x of [-w / 2, w / 2 - 0.02]) f.box(C.woodD, [x, 0, -0.15], [x + 0.02, 1.1, 0.0]);
  const cols = ['#c9d5cd', '#e5ece0', '#bed3c9', '#d5d3bf', '#dfe4d6'];
  for (let i = 0; i < 3; i++) {
    const y = 0.25 + i * 0.3;
    f.box(C.wood, [-w / 2, y, -0.12 + i * 0.0], [w / 2, y + 0.02, 0.02]);
    for (let j = 0; j < 3; j++) f.box(cols[(i * 3 + j) % cols.length], [-w / 2 + 0.05 + j * 0.25, y + 0.02, -0.02], [-w / 2 + 0.25 + j * 0.25, y + 0.28, 0.0]);
  }
}

/** 掛け時計（丸い板・針） */
export function clock(f: Fr, y = 2.6): void {
  f.cyl(C.enamel, [0, y, 0.025], 0.17, 0.05, { axis: 'z', segments: 20 });
  f.cyl(C.paper, [0, y, 0.051], 0.15, 0.004, { axis: 'z', segments: 20 });
  f.box(C.ink, [-0.006, y, 0.052], [0.006, y + 0.11, 0.056]);
  f.box(C.ink, [0, y - 0.006, 0.052], [0.08, y + 0.006, 0.056]);
}

/** 公衆電話（棚に載る） */
export function phone(f: Fr): void {
  f.box(C.wood, [-0.3, 0.9, -0.2], [0.3, 0.93, 0.02]);
  f.box(C.woodD, [-0.28, 0.6, -0.2], [-0.25, 0.9, -0.17]);
  f.box(C.woodD, [0.25, 0.6, -0.2], [0.28, 0.9, -0.17]);
  f.box(C.sage, [-0.12, 0.93, -0.15], [0.12, 1.15, 0.0]);
  f.box(C.darker, [-0.14, 1.15, -0.12], [0.14, 1.19, -0.02]);
  f.box(C.paper, [-0.05, 1.0, 0.0], [0.05, 1.08, 0.004]);
}

/** 給水機 */
export function waterCooler(f: Fr): void {
  f.box(C.enamel, [-0.17, 0, -0.17], [0.17, 0.95, 0.17], { collide: true });
  f.box(C.pale, [-0.15, 0.95, -0.15], [0.15, 1.0, 0.15]);
  f.cyl('#d3e0dc', [0, 1.2, 0], 0.13, 0.4, { segments: 12 });
  f.box(C.ink, [-0.03, 0.85, 0.17], [0.03, 0.88, 0.2]);
  f.box(C.sageD, [-0.1, 0.55, 0.17], [0.1, 0.58, 0.2]);
}

/** 机（天板・脚・引き出し）。dp は奥行き */
export function desk(f: Fr, w: number, dp: number, o: { drawers?: boolean; h?: number; top?: string } = {}): void {
  const h = o.h ?? 0.72;
  f.box(o.top ?? C.wood, [-w / 2, h - 0.03, -dp / 2], [w / 2, h, dp / 2], { collide: true });
  if (o.drawers !== false) {
    f.box(C.pale, [w / 2 - 0.42, 0.04, -dp / 2 + 0.02], [w / 2 - 0.02, h - 0.03, dp / 2 - 0.02], { collide: true });
    for (let i = 0; i < 3; i++) f.box(C.creamD, [w / 2 - 0.38, 0.12 + i * 0.2, dp / 2 - 0.02], [w / 2 - 0.06, 0.13 + i * 0.2, dp / 2 - 0.015]);
    for (let i = 0; i < 3; i++) f.box(C.ink, [w / 2 - 0.25, 0.2 + i * 0.2, dp / 2 - 0.015], [w / 2 - 0.19, 0.21 + i * 0.2, dp / 2]);
    f.box(C.metal, [-w / 2 + 0.03, 0, -dp / 2 + 0.03], [-w / 2 + 0.06, h - 0.03, -dp / 2 + 0.06]);
    f.box(C.metal, [-w / 2 + 0.03, 0, dp / 2 - 0.06], [-w / 2 + 0.06, h - 0.03, dp / 2 - 0.03]);
  } else {
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) for (const z of [-dp / 2 + 0.04, dp / 2 - 0.04]) f.box(C.metal, [x - 0.02, 0, z - 0.02], [x + 0.02, h - 0.03, z + 0.02]);
  }
}

/** 机の上の物（書類の束・本立て・電気スタンド・ペン立て） */
export function deskTop(f: Fr, w: number, h = 0.72, seed = 1, lamp = true): void {
  let s = seed * 7919;
  const r = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
  f.box(C.paper, [-w / 2 + 0.1, h, -0.1], [-w / 2 + 0.4, h + 0.02 + r() * 0.04, 0.12]);
  f.box('#e5ece0', [-0.1, h, -0.05], [0.2, h + 0.01, 0.17]);
  f.box(C.creamD, [w / 2 - 0.35, h, -0.25], [w / 2 - 0.05, h + 0.02, -0.12]);
  for (let i = 0; i < 4; i++) f.box(['#c9d5cd', '#bed3c9', '#d5d3bf', C.sage][i], [w / 2 - 0.34 + i * 0.07, h + 0.02, -0.24], [w / 2 - 0.28 + i * 0.07, h + 0.26 - (i % 2) * 0.04, -0.13]);
  f.cyl(C.sageD, [-w / 2 + 0.55, h + 0.05, -0.18], 0.03, 0.1, { segments: 8 });
  if (lamp) {
    f.box(C.sageD, [-w / 2 + 0.08, h, -0.25], [-w / 2 + 0.2, h + 0.02, -0.15]);
    f.box(C.sageD, [-w / 2 + 0.13, h + 0.02, -0.21], [-w / 2 + 0.15, h + 0.4, -0.19]);
    f.box(C.sageD, [-w / 2 + 0.1, h + 0.38, -0.21], [-w / 2 + 0.32, h + 0.4, -0.19]);
    f.cyl(C.enamel, [-w / 2 + 0.3, h + 0.36, -0.2], 0.06, 0.08, { segments: 10, radiusTop: 0.03 });
  }
}

/** 事務椅子（回転椅子） */
export function officeChair(f: Fr): void {
  f.box(C.darker, [-0.22, 0.44, -0.22], [0.22, 0.5, 0.22], { collide: true });
  f.box(C.darker, [-0.2, 0.58, -0.26], [0.2, 0.92, -0.22]);
  f.box(C.metal, [-0.02, 0.5, -0.24], [0.02, 0.6, -0.22]);
  f.cyl(C.metal, [0, 0.25, 0], 0.025, 0.4, { segments: 8 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sub = f.sub(0, 0, a);
    sub.box(C.metal, [-0.02, 0.04, 0], [0.02, 0.07, 0.28]);
    sub.box(C.ink, [-0.025, 0, 0.24], [0.025, 0.05, 0.29]);
  }
}

/** 丸椅子（患者の椅子） */
export function stool(f: Fr, top = C.cushion): void {
  f.cyl(top, [0, 0.47, 0], 0.17, 0.05, { segments: 14, collide: true });
  f.cyl(C.metal, [0, 0.24, 0], 0.025, 0.44, { segments: 8 });
  f.cyl(C.metal, [0, 0.02, 0], 0.2, 0.03, { segments: 12 });
}

/** 背もたれの椅子（木） */
export function chair(f: Fr, seat = C.wood): void {
  f.box(seat, [-0.2, 0.42, -0.2], [0.2, 0.46, 0.2], { collide: true });
  for (const x of [-0.17, 0.17]) for (const z of [-0.17, 0.17]) f.box(C.woodD, [x - 0.02, 0, z - 0.02], [x + 0.02, 0.42, z + 0.02]);
  f.box(seat, [-0.19, 0.6, -0.21], [0.19, 0.82, -0.18]);
  for (const x of [-0.17, 0.17]) f.box(C.woodD, [x - 0.02, 0.46, -0.21], [x + 0.02, 0.82, -0.17]);
}

/** 診察台（張りの台・頭の枕・踏み台） */
export function exam(f: Fr, len = 1.8): void {
  f.box(C.enamel, [-len / 2 + 0.05, 0, -0.27], [len / 2 - 0.05, 0.08, 0.27]);
  for (const x of [-len / 2 + 0.1, len / 2 - 0.1]) f.box(C.enamel, [x - 0.04, 0, -0.25], [x + 0.04, 0.5, 0.25]);
  f.box(C.enamel, [-len / 2 + 0.1, 0.42, -0.26], [len / 2 - 0.1, 0.5, 0.26], { collide: true });
  f.box(C.cushion, [-len / 2, 0.5, -0.3], [len / 2, 0.6, 0.3]);
  f.box(C.paper, [-len / 2 + 0.05, 0.6, -0.22], [len / 2 - 0.3, 0.605, 0.22]);
  f.box(C.paper, [len / 2 - 0.38, 0.6, -0.2], [len / 2 - 0.05, 0.68, 0.2]);
  // 踏み台
  f.box(C.metal, [-0.2, 0, 0.35], [0.2, 0.2, 0.6]);
  f.box(C.sageD, [-0.2, 0.2, 0.35], [0.2, 0.22, 0.6]);
}

/** 衝立（布の 2〜3 枚の板・鉄の枠） */
export function screen(f: Fr, n = 3, w = 0.55, h = 1.65): void {
  for (let i = 0; i < n; i++) {
    const sub = f.sub((i - (n - 1) / 2) * w, 0, (i % 2 ? 1 : -1) * 0.15);
    sub.box(C.metal, [-w / 2, 0, -0.015], [w / 2, h, 0.015]);
    sub.box('#d4ddd2', [-w / 2 + 0.03, 0.2, -0.02], [w / 2 - 0.03, h - 0.04, 0.02]);
    sub.box(C.ink, [-w / 2 + 0.03, 0, -0.02], [-w / 2 + 0.06, 0.03, 0.02]);
  }
}

/** 流し（ほうろうの洗面台・鏡・石けん台） */
export function sink(f0: Fr, w = 0.55, mirror = true): void {
  // 原点は置く場所の真ん中（奥行き 0.42）。背の壁は -0.21
  const f = f0.sub(0, -0.21);
  f.box(C.enamel, [-w / 2, 0.66, -0.0], [w / 2, 0.82, 0.42], { collide: true });
  f.box(C.sage, [-w / 2 + 0.06, 0.8, 0.08], [w / 2 - 0.06, 0.823, 0.36]);
  f.cyl(C.metal, [0, 0.4, 0.06], 0.035, 0.6, { segments: 8 });
  f.box(C.metal, [-0.02, 0.84, 0.02], [0.02, 0.98, 0.06]);
  f.box(C.metal, [-0.02, 0.95, 0.02], [0.02, 0.98, 0.16]);
  f.box(C.metal, [-0.08, 0.86, 0.01], [-0.04, 0.9, 0.05]);
  f.box(C.metal, [0.04, 0.86, 0.01], [0.08, 0.9, 0.05]);
  if (mirror) {
    f.box(C.metal, [-w / 2 + 0.02, 1.15, 0], [w / 2 - 0.02, 1.62, 0.015]);
    f.box('#dbe5e3', [-w / 2 + 0.04, 1.17, 0.015], [w / 2 - 0.04, 1.6, 0.02]);
    f.box(C.enamel, [-w / 2 + 0.02, 1.05, 0], [w / 2 - 0.02, 1.07, 0.1]);
    f.box(C.paper, [w / 2 + 0.05, 0.9, 0], [w / 2 + 0.3, 1.25, 0.03]);
  }
}

/** ガラス戸の薬品棚（上がガラス戸、下が扉） */
export function glassCabinet(f: Fr, w = 0.9, h = 1.85, dp = 0.4, seed = 1): void {
  f.box(C.enamel, [-w / 2, 0, -dp / 2], [w / 2, h, dp / 2], { collide: true });
  f.box(C.creamD, [-w / 2 + 0.04, 0.85, dp / 2], [w / 2 - 0.04, 0.87, dp / 2 + 0.004]);
  // ガラス戸の中（棚と瓶）
  f.box('#d3dfdb', [-w / 2 + 0.05, 0.9, dp / 2 - 0.004], [w / 2 - 0.05, h - 0.05, dp / 2 + 0.002]);
  let s = seed * 104729;
  const r = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 3; i++) {
    const y = 0.92 + i * 0.3;
    f.box(C.sage, [-w / 2 + 0.05, y, dp / 2 - 0.004], [w / 2 - 0.05, y + 0.012, dp / 2 + 0.004]);
    for (let x = -w / 2 + 0.1; x < w / 2 - 0.1; x += 0.07 + r() * 0.06) {
      const bh = 0.08 + r() * 0.14;
      f.box(r() < 0.5 ? '#c7d6cf' : r() < 0.5 ? '#e5ece0' : '#a9bcb3', [x - 0.025, y + 0.012, dp / 2 - 0.0], [x + 0.025, y + 0.012 + bh, dp / 2 + 0.006]);
    }
  }
  f.box(C.metal, [-0.005, 0.9, dp / 2], [0.005, h - 0.05, dp / 2 + 0.006]);
  f.box(C.ink, [-0.04, 0.6, dp / 2], [-0.02, 0.7, dp / 2 + 0.02]);
  f.box(C.ink, [0.02, 0.6, dp / 2], [0.04, 0.7, dp / 2 + 0.02]);
  f.box(C.metal, [-0.005, 0.05, dp / 2], [0.005, 0.83, dp / 2 + 0.004]);
}

/** 棚（金属・本・箱・カルテ）。load で載せる物 */
export function shelf(f: Fr, w: number, h: number, dp: number, load: 'box' | 'file' | 'book' | 'bottle' | 'mixed', seed = 1, col = C.metal): void {
  for (const x of [-w / 2, w / 2 - 0.03]) for (const z of [-dp / 2, dp / 2 - 0.03]) f.box(col, [x, 0, z], [x + 0.03, h, z + 0.03]);
  f.box(col, [-w / 2, 0, -dp / 2], [w / 2, h, -dp / 2 + 0.01]);
  // 当たり判定は棚の外形全体（背板だけだと棚の中へ歩いて入れた）
  solid(f, [-w / 2, 0, -dp / 2], [w / 2, h, dp / 2]);
  const n = Math.max(3, Math.round(h / 0.42));
  let s = seed * 15485863;
  const r = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cols: Record<string, string[]> = {
    box: ['#d6d6c2', '#f4f7eb', '#dde4d7', '#c9d5cd', C.paper],
    file: ['#c9d5cd', '#f4f7eb', '#d5d3bf', '#a9bcb3', '#eef1e6', '#9fb2aa'],
    book: ['#c9d5cd', '#bed3c9', '#d5d3bf', '#a9bcb3', '#8fa29b', '#dfe4d6', '#b5c2b8'],
    bottle: ['#c7d6cf', '#e5ece0', '#a9bcb3', '#d3dfdb'],
  };
  for (let i = 0; i < n; i++) {
    const y = 0.06 + (i * (h - 0.1)) / (n - 1);
    f.box(col, [-w / 2, y - 0.02, -dp / 2], [w / 2, y, dp / 2]);
    if (i === n - 1) break;
    const kind = load === 'mixed' ? (['box', 'file', 'book', 'bottle'] as const)[Math.floor(r() * 4)] : load;
    const pal = cols[kind];
    const room = (h - 0.1) / (n - 1) - 0.06;
    let x = -w / 2 + 0.04;
    while (x < w / 2 - 0.1) {
      if (kind === 'box') {
        const bw = 0.25 + r() * 0.2;
        if (x + bw > w / 2 - 0.04) break;
        const bh = Math.min(room, 0.15 + r() * 0.15);
        f.box(pal[Math.floor(r() * pal.length)], [x, y, -dp / 2 + 0.04], [x + bw, y + bh, dp / 2 - 0.04]);
        x += bw + 0.03 + r() * 0.08;
      } else if (kind === 'bottle') {
        const bh = Math.min(room, 0.1 + r() * 0.12);
        f.box(pal[Math.floor(r() * pal.length)], [x, y, -0.05], [x + 0.05, y + bh, 0.0]);
        x += 0.07 + r() * 0.05;
      } else {
        const bw = kind === 'file' ? 0.06 : 0.025 + r() * 0.03;
        const bh = Math.min(room, (kind === 'file' ? 0.28 : 0.18) + r() * 0.06);
        if (r() < 0.06) {
          x += 0.12;
          continue;
        }
        f.box(pal[Math.floor(r() * pal.length)], [x, y, -dp / 2 + 0.03], [x + bw, y + bh, dp / 2 - 0.05]);
        x += bw + 0.004;
      }
    }
  }
}

/** 薬の引き出しの棚（小さな引き出しがたくさん） */
export function drawerCabinet(f: Fr, w: number, h: number, dp = 0.4): void {
  f.box(C.wood, [-w / 2, 0, -dp / 2], [w / 2, h, dp / 2], { collide: true });
  const rows = Math.round(h / 0.16);
  const cols = Math.round(w / 0.22);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const x0 = -w / 2 + (w * j) / cols + 0.012;
      const x1 = -w / 2 + (w * (j + 1)) / cols - 0.012;
      const y0 = (h * i) / rows + 0.012;
      const y1 = (h * (i + 1)) / rows - 0.012;
      f.box(C.cream, [x0, y0, dp / 2], [x1, y1, dp / 2 + 0.008]);
      f.box(C.ink, [(x0 + x1) / 2 - 0.02, (y0 + y1) / 2 - 0.006, dp / 2 + 0.008], [(x0 + x1) / 2 + 0.02, (y0 + y1) / 2 + 0.006, dp / 2 + 0.014]);
      if ((i * 7 + j * 3) % 5 === 0) f.box(C.paper, [x0 + 0.03, y1 - 0.04, dp / 2 + 0.008], [x1 - 0.03, y1 - 0.015, dp / 2 + 0.01]);
    }
}

/** 調剤台（作業台・天秤・乳鉢・薬包紙） */
export function dispensingTable(f: Fr, w = 1.6, dp = 0.75): void {
  f.box(C.enamel, [-w / 2, 0, -dp / 2], [w / 2, 0.85, dp / 2], { collide: true });
  f.box(C.pale, [-w / 2 - 0.02, 0.85, -dp / 2 - 0.02], [w / 2 + 0.02, 0.88, dp / 2 + 0.02]);
  f.box(C.creamD, [-w / 2 + 0.05, 0.08, dp / 2], [w / 2 - 0.05, 0.1, dp / 2 + 0.004]);
  // 天秤（台と皿）・乳鉢・薬包紙の束・瓶
  f.box(C.metal, [-0.5, 0.88, -0.1], [-0.2, 0.92, 0.1]);
  f.box(C.metal, [-0.36, 0.92, -0.01], [-0.34, 1.1, 0.01]);
  f.box(C.metal, [-0.5, 1.1, -0.01], [-0.2, 1.11, 0.01]);
  f.cyl(C.enamel, [-0.48, 1.0, 0], 0.06, 0.01, { segments: 10 });
  f.cyl(C.enamel, [-0.22, 1.0, 0], 0.06, 0.01, { segments: 10 });
  f.cyl(C.enamel, [0.15, 0.93, 0.05], 0.08, 0.1, { segments: 12, radiusTop: 0.1 });
  f.box(C.paper, [0.35, 0.88, -0.15], [0.6, 0.92, 0.1]);
  for (let i = 0; i < 4; i++) f.box(['#c7d6cf', '#a9bcb3', '#e5ece0', '#d3dfdb'][i], [0.0 + i * 0.07, 0.88, -0.3], [0.05 + i * 0.07, 1.0 + (i % 2) * 0.05, -0.25]);
}

/** 金庫 */
export function safe(f: Fr): void {
  f.box(C.darker, [-0.3, 0, -0.28], [0.3, 0.75, 0.28], { collide: true });
  f.box(C.dark, [-0.26, 0.06, 0.28], [0.26, 0.7, 0.29]);
  f.cyl(C.metal, [0.0, 0.48, 0.3], 0.05, 0.02, { axis: 'z', segments: 12 });
  f.box(C.metal, [0.14, 0.3, 0.29], [0.18, 0.42, 0.31]);
  f.box(C.sageD, [-0.32, 0.75, -0.3], [0.32, 0.77, 0.3]);
}

/** 書類の棚（引き戸の低い棚） */
export function lowCabinet(f: Fr, w: number, h = 0.9, dp = 0.45, col = C.pale): void {
  f.box(col, [-w / 2, 0, -dp / 2], [w / 2, h, dp / 2], { collide: true });
  f.box(C.creamD, [-w / 2 + 0.02, 0.06, dp / 2], [0 - 0.005, h - 0.04, dp / 2 + 0.006]);
  f.box(C.creamD, [0.005, 0.06, dp / 2], [w / 2 - 0.02, h - 0.04, dp / 2 + 0.006]);
  f.box(C.ink, [-0.06, h / 2 - 0.04, dp / 2 + 0.006], [-0.04, h / 2 + 0.04, dp / 2 + 0.012]);
  f.box(C.ink, [0.04, h / 2 - 0.04, dp / 2 + 0.006], [0.06, h / 2 + 0.04, dp / 2 + 0.012]);
}

/** 電話（黒電話。暗い青緑） */
export function deskPhone(f: Fr, y: number): void {
  f.box(C.darker, [-0.11, y, -0.1], [0.11, y + 0.09, 0.1]);
  f.box(C.darker, [-0.12, y + 0.1, -0.04], [0.12, y + 0.13, 0.02]);
  f.cyl(C.paper, [0, y + 0.092, 0.04], 0.05, 0.004, { segments: 12 });
}

/** シャウカステン（レントゲンを見る光る板） */
export function viewer(f: Fr, w = 0.9, y = 1.5): void {
  f.box(C.enamel, [-w / 2, y - 0.3, 0], [w / 2, y + 0.3, 0.08]);
  f.box(f.p.glow('#f4f6e8'), [-w / 2 + 0.04, y - 0.26, 0.08], [w / 2 - 0.04, y + 0.26, 0.082]);
  f.box('#b3bfba', [-w / 2 + 0.08, y - 0.22, 0.082], [-0.02, y + 0.22, 0.084]);
}

/** 体重計（台と目盛りの柱） */
export function scale(f: Fr): void {
  f.box(C.enamel, [-0.22, 0, -0.25], [0.22, 0.08, 0.2], { collide: true });
  f.box(C.metal, [-0.03, 0.08, -0.25], [0.03, 1.4, -0.2]);
  f.box(C.enamel, [-0.12, 1.2, -0.25], [0.12, 1.42, -0.18]);
  f.cyl(C.paper, [0, 1.31, -0.18], 0.08, 0.01, { axis: 'z', segments: 14 });
}

/** 屑かご */
export function bin(f: Fr, col = C.sage): void {
  f.cyl(col, [0, 0.17, 0], 0.13, 0.34, { segments: 10, radiusTop: 0.15 });
}

/** 処置台（ベッド）と天井のカーテンレール・カーテン（半分引いた） */
export function treatBed(f: Fr, ceil: number): void {
  const len = 1.95;
  f.box(C.metal, [-0.42, 0.15, -len / 2], [0.42, 0.5, len / 2]);
  f.box(C.enamel, [-0.43, 0.5, -len / 2], [0.43, 0.62, len / 2], { collide: true });
  f.box(C.paper, [-0.4, 0.62, -len / 2 + 0.05], [0.4, 0.64, len / 2 - 0.05]);
  f.box(C.paper, [-0.28, 0.64, -len / 2 + 0.06], [0.28, 0.74, -len / 2 + 0.38]);
  f.box('#c9d5cd', [-0.42, 0.62, 0.1], [0.42, 0.67, len / 2 - 0.05]);
  f.box(C.enamel, [-0.44, 0.15, -len / 2 - 0.05], [0.44, 0.95, -len / 2]);
  for (const x of [-0.36, 0.36]) for (const z of [-len / 2 + 0.1, len / 2 - 0.1]) f.cyl(C.ink, [x, 0.07, z], 0.06, 0.04, { axis: 'x', segments: 10 });
  // カーテンレール（ベッドの周り。高さ 2.2 m、天井から吊り棒）とカーテン（片側に寄せてある）
  const rx = 0.75;
  const z0 = -len / 2 - 0.05;
  const z1 = len / 2 + 0.4;
  const ry = 2.2;
  f.box(C.metal, [-rx, ry, z0], [-rx + 0.03, ry + 0.03, z1]);
  f.box(C.metal, [-rx, ry, z1 - 0.03], [rx, ry + 0.03, z1]);
  f.box(C.metal, [rx - 0.03, ry, z0], [rx, ry + 0.03, z1]);
  for (const [x, z] of [[-rx + 0.015, z0 + 0.1], [rx - 0.015, z0 + 0.1], [-rx + 0.015, z1 - 0.1], [rx - 0.015, z1 - 0.1]]) f.box(C.metal, [x - 0.008, ry + 0.03, z - 0.008], [x + 0.008, ceil, z + 0.008]);
  f.box('#d4ddd2', [-rx + 0.005, 0.35, z0 + 0.05], [-rx + 0.025, ry - 0.02, z0 + 1.1]);
  f.box('#c9d5cd', [-rx + 0.005, 1.7, z0 + 1.1], [-rx + 0.025, ry - 0.02, z1 - 0.05]);
  f.box('#d4ddd2', [-rx, 0.35, z1 - 0.025], [-rx + 0.5, ry - 0.02, z1 - 0.005]);
}

/** 点滴台 */
export function ivPole(f: Fr): void {
  for (let i = 0; i < 5; i++) f.sub(0, 0, (i / 5) * Math.PI * 2).box(C.metal, [-0.015, 0.04, 0], [0.015, 0.07, 0.25]);
  f.cyl(C.metal, [0, 1.0, 0], 0.012, 1.95, { segments: 6 });
  f.box(C.metal, [-0.18, 1.95, -0.008], [0.18, 1.965, 0.008]);
  f.box('#d3e0dc', [0.1, 1.6, -0.04], [0.18, 1.85, 0.04]);
}

/** ワゴン（2〜3 段。上に物） */
export function cart(f: Fr, w = 0.6, dp = 0.45, h = 0.9, col = C.enamel): void {
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) for (const z of [-dp / 2 + 0.02, dp / 2 - 0.02]) {
    f.box(C.metal, [x - 0.012, 0.06, z - 0.012], [x + 0.012, h, z + 0.012]);
    f.cyl(C.ink, [x, 0.035, z], 0.035, 0.03, { axis: 'x', segments: 8 });
  }
  for (const y of [0.25, h * 0.6, h]) f.box(col, [-w / 2, y - 0.025, -dp / 2], [w / 2, y, dp / 2], { collide: y === h });
  f.box(C.metal, [-w / 2 - 0.04, h - 0.05, -0.15], [-w / 2, h - 0.02, 0.15]);
  f.box(C.paper, [-0.2, h, -0.12], [0.05, h + 0.04, 0.1]);
  f.cyl('#d3dfdb', [0.15, h + 0.06, 0], 0.04, 0.12, { segments: 8 });
  f.box(C.enamel, [-0.25, h, 0.12], [0.1, h + 0.03, 0.2]);
}

/** 酸素ボンベ（台車つき） */
export function oxygen(f: Fr): void {
  f.box(C.metal, [-0.15, 0, -0.12], [0.15, 0.05, 0.12]);
  f.cyl(C.sageD, [0, 0.62, 0], 0.09, 1.1, { segments: 12, collide: true });
  f.cyl(C.metal, [0, 1.22, 0], 0.03, 0.12, { segments: 8 });
  f.box(C.metal, [-0.12, 0.05, -0.1], [-0.1, 1.0, -0.08]);
}

/** ストレッチャー */
export function stretcher(f: Fr): void {
  const len = 1.9;
  f.box(C.metal, [-0.3, 0.2, -len / 2], [0.3, 0.24, len / 2]);
  for (const z of [-len / 2 + 0.15, len / 2 - 0.15]) f.box(C.metal, [-0.02, 0.24, z - 0.02], [0.02, 0.62, z + 0.02]);
  f.box(C.cushion, [-0.3, 0.62, -len / 2], [0.3, 0.7, len / 2], { collide: true });
  f.box(C.paper, [-0.28, 0.7, -len / 2 + 0.05], [0.28, 0.72, len / 2 - 0.1]);
  for (const z of [-len / 2 + 0.1, len / 2 - 0.1]) for (const x of [-0.25, 0.25]) f.cyl(C.ink, [x, 0.06, z], 0.06, 0.04, { axis: 'x', segments: 10 });
  f.box(C.metal, [-0.32, 0.72, -0.4], [-0.3, 0.92, 0.4]);
}

/** 車椅子（たたんだ物） */
export function wheelchair(f: Fr): void {
  for (const x of [-0.12, 0.12]) {
    f.cyl(C.metal, [x, 0.3, 0], 0.3, 0.025, { axis: 'x', segments: 18 });
    f.cyl(C.ink, [x, 0.3, 0], 0.28, 0.03, { axis: 'x', segments: 18 });
  }
  f.box(C.metal, [-0.14, 0.3, -0.32], [0.14, 0.95, -0.28]);
  f.box(C.darker, [-0.12, 0.45, -0.3], [0.12, 0.85, -0.18]);
  f.box(C.metal, [-0.1, 0.05, 0.25], [0.1, 0.1, 0.4]);
}

/** 脚立 */
export function ladder(f: Fr, h = 1.6): void {
  for (const x of [-0.22, 0.2]) {
    f.box(C.metal, [x, 0, -0.04], [x + 0.03, h, -0.01], { rotX: 0.12 });
    f.box(C.metal, [x, 0, 0.3], [x + 0.03, h, 0.33]);
  }
  for (let i = 1; i < 5; i++) f.box(C.metal, [-0.22, (h * i) / 5, 0.25], [0.23, (h * i) / 5 + 0.03, 0.35]);
}

/** 段ボール箱の山 */
export function boxes(f: Fr, n = 3, seed = 1): void {
  let s = seed * 31337;
  const r = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.4 + r() * 0.2;
    const d = 0.3 + r() * 0.15;
    const h = 0.25 + r() * 0.15;
    const sub = f.sub((r() - 0.5) * 0.08, (r() - 0.5) * 0.06, (r() - 0.5) * 0.25);
    // 段ボールも参考画像の色の表のクリーム（暖かい茶色は表に無い）
    sub.box(['#d6d6c2', '#ced4c4', '#c4c6b1'][i % 3], [-w / 2, y, -d / 2], [w / 2, y + h, d / 2], { collide: i === 0 });
    sub.box('#b3b8a6', [-w / 2, y + h - 0.004, -0.02], [w / 2, y + h + 0.002, 0.02]);
    y += h;
  }
}

/** 低い応接机とソファ（医局） */
export function sofa(f: Fr, w = 1.4, col = C.greyBlue): void {
  f.box(col, [-w / 2, 0.1, -0.35], [w / 2, 0.42, 0.35], { collide: true });
  f.box(col, [-w / 2, 0.42, -0.4], [w / 2, 0.8, -0.22]);
  for (const x of [-w / 2, w / 2 - 0.14]) f.box(col, [x, 0.1, -0.4], [x + 0.14, 0.6, 0.35]);
  f.box(C.sageD, [-w / 2, 0, -0.4], [w / 2, 0.1, 0.35]);
  f.box('#9fb3ad', [-w / 2 + 0.16, 0.42, -0.2], [w / 2 - 0.16, 0.46, 0.3]);
}

export function lowTable(f: Fr, w = 1.0, dp = 0.55): void {
  f.box(C.wood, [-w / 2, 0.38, -dp / 2], [w / 2, 0.42, dp / 2], { collide: true });
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-dp / 2 + 0.05, dp / 2 - 0.05]) f.box(C.woodD, [x - 0.025, 0, z - 0.025], [x + 0.025, 0.38, z + 0.025]);
  f.cyl(C.enamel, [0.2, 0.46, 0.05], 0.05, 0.08, { segments: 10 });
  f.cyl(C.enamel, [-0.15, 0.445, -0.05], 0.12, 0.05, { segments: 14, radiusTop: 0.13 });
}

/** コート掛け（柱と枝） */
export function coatStand(f: Fr): void {
  f.cyl(C.woodD, [0, 0.85, 0], 0.025, 1.7, { segments: 8 });
  f.cyl(C.woodD, [0, 0.02, 0], 0.22, 0.04, { segments: 12 });
  for (let i = 0; i < 4; i++) f.sub(0, 0, (i / 4) * Math.PI * 2).box(C.woodD, [-0.01, 1.62, 0], [0.01, 1.66, 0.18]);
  f.box(C.paper, [-0.2, 0.9, 0.05], [0.2, 1.62, 0.2]);
}

/** 冷蔵庫 */
export function fridge(f: Fr, h = 1.4, w = 0.6): void {
  f.box(C.enamel, [-w / 2, 0, -0.3], [w / 2, h, 0.3], { collide: true });
  f.box(C.creamD, [-w / 2 + 0.01, h * 0.62, 0.3], [w / 2 - 0.01, h * 0.62 + 0.01, 0.305]);
  f.box(C.metal, [w / 2 - 0.08, h * 0.68, 0.3], [w / 2 - 0.06, h * 0.9, 0.33]);
  f.box(C.metal, [w / 2 - 0.08, h * 0.35, 0.3], [w / 2 - 0.06, h * 0.55, 0.33]);
}

/** 流し台（給湯・検査室。台と流し・上の吊り戸棚） */
export function sinkCounter(f: Fr, w: number, o: { sinkAt?: number; stove?: boolean; upper?: boolean; h?: number; dp?: number } = {}): void {
  const h = o.h ?? 0.85;
  const dp = o.dp ?? 0.6;
  f.box(C.enamel, [-w / 2, 0, -dp / 2], [w / 2, h - 0.03, dp / 2], { collide: true });
  f.box(C.metal, [-w / 2, h - 0.03, -dp / 2], [w / 2, h, dp / 2]);
  f.box(C.sageD, [-w / 2, 0, dp / 2 - 0.06], [w / 2, 0.08, dp / 2]);
  const n = Math.max(1, Math.round(w / 0.45));
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + (w * i) / n + 0.02;
    const x1 = -w / 2 + (w * (i + 1)) / n - 0.02;
    f.box(C.pale, [x0, 0.1, dp / 2], [x1, h - 0.06, dp / 2 + 0.005]);
    f.box(C.ink, [x1 - 0.06, h - 0.16, dp / 2 + 0.005], [x1 - 0.03, h - 0.1, dp / 2 + 0.012]);
  }
  const sx = o.sinkAt ?? 0;
  f.box(C.sage, [sx - 0.25, h - 0.02, -0.18], [sx + 0.25, h + 0.002, 0.2]);
  f.box(C.metal, [sx - 0.02, h, -dp / 2 + 0.03], [sx + 0.02, h + 0.25, -dp / 2 + 0.07]);
  f.box(C.metal, [sx - 0.02, h + 0.22, -dp / 2 + 0.03], [sx + 0.02, h + 0.25, -dp / 2 + 0.2]);
  if (o.stove) {
    const x = w / 2 - 0.35;
    f.box(C.darker, [x - 0.28, h, -0.2], [x + 0.28, h + 0.1, 0.2]);
    for (const dx of [-0.13, 0.13]) f.cyl(C.ink, [x + dx, h + 0.105, 0], 0.08, 0.01, { segments: 12 });
    f.cyl(C.enamel, [x - 0.13, h + 0.19, 0], 0.1, 0.16, { segments: 12, radiusTop: 0.06 });
    f.box(C.ink, [x - 0.15, h + 0.27, -0.01], [x - 0.11, h + 0.32, 0.01]);
  }
  if (o.upper !== false) {
    f.box(C.enamel, [-w / 2, 1.5, -dp / 2], [w / 2, 2.15, -dp / 2 + 0.35]);
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + (w * i) / n + 0.02;
      const x1 = -w / 2 + (w * (i + 1)) / n - 0.02;
      f.box(C.pale, [x0, 1.53, -dp / 2 + 0.35], [x1, 2.12, -dp / 2 + 0.355]);
    }
  }
}

/** 食器棚（上がガラス・中に器） */
export function cupboard(f: Fr, w = 0.9, h = 1.8): void {
  glassCabinet(f, w, h, 0.42, 7);
  f.box(C.wood, [-w / 2, h, -0.21], [w / 2, h + 0.03, 0.21]);
}

/** 検査室の物（顕微鏡・遠心機・試験管立て） */
export function microscope(f: Fr, y: number): void {
  f.box(C.enamel, [-0.1, y, -0.12], [0.1, y + 0.04, 0.1]);
  f.box(C.enamel, [-0.04, y + 0.04, -0.12], [0.04, y + 0.3, -0.06]);
  f.box(C.darker, [-0.03, y + 0.18, -0.08], [0.03, y + 0.4, 0.0]);
  f.box(C.metal, [-0.07, y + 0.12, -0.06], [0.07, y + 0.14, 0.06]);
}
export function centrifuge(f: Fr, y: number): void {
  f.cyl(C.enamel, [0, y + 0.13, 0], 0.18, 0.26, { segments: 14 });
  f.cyl(C.sage, [0, y + 0.265, 0], 0.15, 0.01, { segments: 14 });
  f.box(C.darker, [-0.06, y + 0.04, 0.17], [0.06, y + 0.1, 0.19]);
}
export function tubeRack(f: Fr, y: number): void {
  f.box(C.metal, [-0.15, y, -0.04], [0.15, y + 0.08, 0.04]);
  for (let i = 0; i < 8; i++) f.cyl(i % 3 ? '#e5ece0' : '#c7d6cf', [-0.13 + i * 0.037, y + 0.1, 0], 0.008, 0.14, { segments: 6 });
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
  // 和式の便器（床の楕円と前の覆い）と水の箱
  f.cyl(C.enamel, [0, 0.02, 0.0], 0.2, 0.04, { segments: 14 });
  f.box(C.enamel, [-0.12, 0.02, -0.35], [0.12, 0.18, -0.25]);
  f.box(C.enamel, [-0.18, 1.6, -dp / 2], [0.18, 1.85, -dp / 2 + 0.2]);
  f.box(C.metal, [0.12, 0.6, -dp / 2], [0.14, 1.6, -dp / 2 + 0.03]);
  f.box(C.paper, [w / 2 - 0.25, 0.75, -0.1], [w / 2 - 0.08, 0.86, 0.02]);
}

/** 小便器 */
export function urinal(f: Fr): void {
  f.box(C.enamel, [-0.18, 0.45, 0], [0.18, 1.15, 0.32], { collide: true });
  f.box(C.sage, [-0.12, 0.5, 0.2], [0.12, 1.0, 0.33]);
  f.box(C.metal, [-0.02, 1.15, 0.02], [0.02, 1.45, 0.06]);
}

/** 掃除の流しと用具（モップ・バケツ） */
export function mopSink(f: Fr): void {
  f.box(C.enamel, [-0.3, 0, 0], [0.3, 0.45, 0.45], { collide: true });
  f.box(C.sage, [-0.25, 0.4, 0.05], [0.25, 0.452, 0.4]);
  f.box(C.metal, [-0.02, 0.6, 0.02], [0.02, 0.75, 0.15]);
  f.box(C.woodD, [0.35, 0.0, 0.05], [0.38, 1.4, 0.08]);
  f.box(C.paper, [0.3, 0.0, 0.0], [0.43, 0.25, 0.13]);
  f.cyl(C.greyBlue, [-0.45, 0.15, 0.25], 0.14, 0.3, { segments: 12, radiusTop: 0.16 });
}

/** 消火器（赤ではなく、参考画像の色に合わせた暗い青緑の筒に白い札） */
export function extinguisher(f: Fr): void {
  f.cyl('#7d8f8b', [0, 0.27, 0.1], 0.08, 0.5, { segments: 12, collide: true });
  f.box(C.ink, [-0.03, 0.52, 0.07], [0.03, 0.6, 0.13]);
  f.box(C.paper, [-0.05, 0.25, 0.18], [0.05, 0.35, 0.183]);
  f.box(C.paper, [-0.15, 1.2, 0], [0.15, 1.35, 0.01]);
}

/** ロープの柵（コーンとロープ） */
export function cones(f: Fr, w = 1.0): void {
  for (const x of [-w / 2, w / 2]) {
    f.cyl('#d9dccb', [x, 0.3, 0], 0.12, 0.6, { segments: 10, radiusTop: 0.03 });
    f.box(C.sageD, [x - 0.15, 0, -0.15], [x + 0.15, 0.03, 0.15]);
    f.box('#b6c2b9', [x - 0.09, 0.28, -0.09], [x + 0.09, 0.36, 0.09]);
  }
  f.box(C.sageD, [-w / 2, 0.55, -0.01], [w / 2, 0.57, 0.01]);
  f.box(C.paper, [-0.18, 0.4, -0.005], [0.18, 0.55, 0.005]);
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

/** 吊り下げの灯り（天井から棒・白い笠） */
export function pendant(f: Fr, ceil: number, drop: number): void {
  f.cyl(C.metal, [0, ceil - drop / 2, 0], 0.01, drop, { segments: 6 });
  f.cyl(C.enamel, [0, ceil - drop - 0.06, 0], 0.08, 0.12, { radiusTop: 0.22, segments: 14 });
  f.cyl(f.p.glow('#f4f6e4'), [0, ceil - drop - 0.125, 0], 0.07, 0.01, { segments: 14 });
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

/**
 * 暗い低い棚（参考画像の右の暗い棚と同じ色: 前 #6f8382・横 #677a7a・天板 #92a19a）。開き戸 2 枚と取っ手、天板の上に紙の束
 */
export function darkCabinet(f: Fr, w = 0.8, h = 1.0, dp = 0.45, seed = 1): void {
  const body = f.p.face({ pz: '#6f8382', nz: '#677a7a', px: '#677a7a', nx: '#677a7a', py: '#7d9091', ny: '#5f7173' }, 'darkCab');
  const top = f.p.face({ py: '#a1ada5', pz: '#92a19a', nz: '#8d9c96', px: '#8d9c96', nx: '#8d9c96', ny: '#7d8b86' }, 'darkCabTop');
  f.box(body, [-w / 2, 0, -dp / 2], [w / 2, h, dp / 2], { collide: true });
  f.box(top, [-w / 2 - 0.035, h, -dp / 2 - 0.02], [w / 2 + 0.035, h + 0.05, dp / 2 + 0.035]);
  f.box('#61767a', [-0.004, 0.06, dp / 2], [0.004, h - 0.06, dp / 2 + 0.004]);
  for (const x of [-0.06, 0.04]) f.box(C.ink, [x, h * 0.55, dp / 2], [x + 0.02, h * 0.55 + 0.1, dp / 2 + 0.02]);
  let s = seed * 3571;
  const r = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
  if (r() < 0.7) f.box(C.paper, [-w / 2 + 0.06, h + 0.05, -0.12], [-w / 2 + 0.36, h + 0.08 + r() * 0.05, 0.1]);
  if (r() < 0.5) f.cyl(C.enamel, [w / 2 - 0.15, h + 0.1, 0], 0.05, 0.1, { segments: 10 });
}
