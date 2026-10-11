import * as THREE from 'three';
import { Colliders } from '../../core/Colliders.ts';
import { Builder, rng, type V3 } from '../../scenes/Builder.ts';
import { type Atlas } from '../../scenes/corridor/kit.ts';
import { flat, lamp, smoke } from '../../scenes/corridor/props.ts';
import { bar, inkNotice, notice, paper, scribble } from '../../scenes/corridor/tex.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { LegId, RoomDef, Side } from './layout.ts';
import { Leg } from './leg.ts';
import { trackLamp } from './dress.ts';
import { extColumns, roomFrame, type RoomPalette } from './rooms.ts';
import type { Prop } from '../../props/kit.ts';
import { bench as libBench, chair as libChair, pottedPlant } from '../../props/lib/furniture.ts';
import { vendingMachine, waterCooler } from '../../props/lib/machines.ts';
import {
  basket, bathStool, bathTub, bedsideCabinet, changingTable as kChangingTable, coat, examCouch, fridge as kFridge, handDryer as kHandDryer, hospitalBed, locker as kLocker, microwave as kMicrowave, mug, overbedTable, paddedBench, pcSet,
  printer as kPrinter, roundStool, showerSet, sofa as kSofa, stackChair, table as kTable, toiletBowl, toteBag, tvStand as kTvStand, washbasin as kWashbasin,
} from './props/furniture.ts';
import { WARD, wardMats } from './props/mats.ts';
import {
  bedpanWasher, floorScale, hamper as kHamper, ivStand, linenCart, medCart, monitorCart, oxygenCart, pedalBin, sanitizerStand, sluiceSink, stretcher,
  vitalMonitor, walker as kWalker, wasteBox, wheelchair as kWheelchair,
} from './props/medical.ts';
import { commonOpts } from './props/place.ts';
import { binderRow, parcelPile, supplyBox, wallShelfItems, wardShelf, type WardLoad } from './props/storage.ts';

/**
 * 部屋の種類ごとの「置く物の決まり」。どの部屋も参考画像と同じ描き方（色指定の平らな面・少ない線）で、
 * 色は区域（脚 A〜D）の参考画像の色の表から選ぶ。
 * 部屋の造り付け（カウンター・カーテン・灯り・壁の板）は箱の組み合わせ、置く物（ベッド・カート・棚と中身・機器・椅子）は
 * 小物の道具（src/props/kit.ts）で作り込んだ物（corridor/props/。docs/08-props.md の決まり）。
 * 座標は部屋の座標系（roomFrame: 原点は部屋の真ん中、local -z が窓の側、+z が廊下（扉）の側）。
 */

type M = THREE.Material;

/** 区域ごとの色（参考画像の色の表から） */
export const ZONE_COLORS: Record<LegId, {
  wall: string; wallAlt?: string; floor: [string, string]; ceil: string; base: string; frame: string; door: string; doorEdge: string;
  glass: string; sky: string; metal: string; dark: string; curtain: string; curtain2: string; blanket: string; accent: string; outerWall?: string;
}> = {
  A: { wall: '#c6d4b0', floor: ['#7d998b', '#42555c'], ceil: '#9fb19f', base: '#3f5159', frame: '#d2dcbb', door: '#b9c4a6', doorEdge: '#a3b59d', glass: '#6f8a88', sky: '#e6efd6', metal: '#9fae98', dark: '#2f3b40', curtain: '#b6c9b0', curtain2: '#cddbbd', blanket: '#9fb7ad', accent: '#bc6367' },
  B: { wall: '#c4c9a1', wallAlt: '#889d89', floor: ['#e4ead0', '#c9cfb5'], ceil: '#889e89', base: '#415553', frame: '#dae4cb', door: '#dfe8ce', doorEdge: '#889d89', glass: '#808e7c', sky: '#f3f9df', metal: '#3c4847', dark: '#171719', curtain: '#a3bfa9', curtain2: '#dfe8ce', blanket: '#a3bfa9', accent: '#b1685f' },
  C: { wall: '#b9cdb4', floor: ['#e4edce', '#aebaa3'], ceil: '#cfdfcc', base: '#587778', frame: '#e8f4dc', door: '#e4f3d4', doorEdge: '#a5b79f', glass: '#5a797b', sky: '#eef8e4', metal: '#5a797b', dark: '#2e4448', curtain: '#c7d8c2', curtain2: '#e4f3d4', blanket: '#5a797b', accent: '#cb7d70' },
  D: { wall: '#c0c5a5', outerWall: '#80a496', floor: ['#7da396', '#5f8479'], ceil: '#80a496', base: '#182832', frame: '#e8ecc7', door: '#e8ecc7', doorEdge: '#bfc6a4', glass: '#244145', sky: '#e9eecb', metal: '#c9d0c3', dark: '#244145', curtain: '#d1d9c2', curtain2: '#e8ecc7', blanket: '#80a296', accent: '#c76b6c' },
};

/** 部屋の壁の白い傷（材質の模様。参考画像の各廊下の傷の描き方: A・B は少なく短い、C は暗い縁の線も、D は長い縦の傷） */
export const ROOM_FLECKS: Record<LegId, Record<string, unknown>> = {
  A: { scale: 3, density: 0.08, color: '#e1ecd0', length: 0.35, width: 0.03 },
  B: { scale: 3, density: 0.1, color: '#eef3d6', length: 0.4, width: 0.03 },
  C: { scale: 4, density: 0.14, color: '#e6f4d8', length: 0.45, width: 0.03, color2: '#2c4245', density2: 0.025 },
  D: { scale: 2.4, density: 0.2, color: '#c9dccd', length: 0.85, width: 0.02 },
};

/** 材質の置き場（同じ色は同じ材質 → まとめて描ける） */
export class Mats {
  private readonly cache = new Map<string, M>();
  constructor(readonly ctx: SceneContext) {}
  get(color: string, shade?: string, line = 0.6, extra: Record<string, unknown> = {}): M {
    const key = `${color}|${shade ?? ''}|${line}|${JSON.stringify(extra)}`;
    let m = this.cache.get(key);
    if (!m) {
      m = this.ctx.mat({ ...flat(color, shade, { line }), ...extra });
      this.cache.set(key, m);
    }
    return m;
  }
  /** 名前で 1 つだけ作る（貼り絵の材質など） */
  once(key: string, make: () => M): M {
    let m = this.cache.get(`once|${key}`);
    if (!m) this.cache.set(`once|${key}`, (m = make()));
    return m;
  }
  unlit(color: string, line = 0.4): M {
    const key = `unlit|${color}|${line}`;
    let m = this.cache.get(key);
    if (!m) {
      m = this.ctx.mat({ color, unlit: true, line });
      this.cache.set(key, m);
    }
    return m;
  }
}

export function palette(mats: Mats, zone: LegId, outer = false): RoomPalette {
  const c = ZONE_COLORS[zone];
  const wallC = outer && c.outerWall ? c.outerWall : c.wall;
  const ceilExtra = zone === 'C' ? { tiles: { size: [0.6, 1.2], line: 0.012, color: '#b4c6b2' } } : {};
  return {
    wall: mats.get(wallC, undefined, 0.4),
    wallSide: c.wallAlt ? { w: mats.get(c.wallAlt, undefined, 0.4) } : undefined,
    floor: mats.get(c.floor[0], c.floor[1], 0.2),
    ceil: mats.get(c.ceil, c.ceil, 0.3, ceilExtra),
    base: mats.get(c.base, undefined, 0.3),
    frame: mats.get(c.frame, undefined, 0.8),
    door: mats.get(c.door, undefined, 0.8),
    doorEdge: mats.get(c.doorEdge, undefined, 0.8),
    glassIn: mats.get(c.glass, undefined, 0.6),
    sky: mats.unlit(c.sky, 0.6),
    metal: mats.get(c.metal, undefined, 1),
    dark: mats.get(c.dark, undefined, 1),
  };
}

// 家具の共通の色（区域によらない白・灰緑・暗い青緑）
const WHITE = '#eef5e2';
const WHITE_S = '#c9d4bc';
const PALE = '#dfe8cf';
const GREY = '#9fae98';
const DARK = '#2f3b40';
const SCREEN = '#41565b';

export interface Dress {
  ctx: SceneContext;
  b: Builder;
  mats: Mats;
  zone: LegId;
  atlas: Atlas;
  paperMat: M;
  seed: number;
}

// 扉の前の空けておく場所（部屋の座標系の長方形）と、そこに置こうとした物を捨てる Builder
let KEEP: [number, number, number, number][] = [];
let VOID: Builder | null = null;

function hitsKeep(x0: number, z0: number, x1: number, z1: number): boolean {
  return KEEP.some((k) => x1 > k[0] && x0 < k[2] && z1 > k[1] && z0 < k[3]);
}

/**
 * 部屋の座標系の中の小さな座標系（物ごとの向き）。r（m）の範囲が扉の前の空ける場所に掛かるなら、その物は置かない
 * （捨てる Builder に作る）
 */
function sub(f: Leg, x: number, z: number, yaw = 0, r = 0.4): Leg {
  if (VOID && hitsKeep(x - r, z - r, x + r, z + r)) return new Leg(VOID, VOID.ctx, [0, -50, 0], f.cam, 0);
  return new Leg(f.b, f.ctx, f.w([x, 0, z]), f.cam, f.yaw + yaw);
}

/** 扉の前（部屋の内へ 1.25 m）を部屋の座標系の長方形にする */
function keepOuts(f: Leg, r: RoomDef): [number, number, number, number][] {
  const [x0, z0, x1, z1] = r.rect;
  const out: [number, number, number, number][] = [];
  for (const d of r.doors) {
    const P: [number, number][] =
      d.side === 'n' ? [[d.a, z0], [d.b, z0], [d.a, z0 + 1.25], [d.b, z0 + 1.25]]
      : d.side === 's' ? [[d.a, z1], [d.b, z1], [d.a, z1 - 1.25], [d.b, z1 - 1.25]]
      : d.side === 'w' ? [[x0, d.a], [x0, d.b], [x0 + 1.25, d.a], [x0 + 1.25, d.b]]
      : [[x1, d.a], [x1, d.b], [x1 - 1.25, d.a], [x1 - 1.25, d.b]];
    const L = P.map(([x, z]) => f.local([x, 0, z]));
    out.push([Math.min(...L.map((p) => p[0])) - 0.15, Math.min(...L.map((p) => p[2])) - 0.15, Math.max(...L.map((p) => p[0])) + 0.15, Math.max(...L.map((p) => p[2])) + 0.15]);
  }
  return out;
}

/** 外壁の柱（rooms.ts の extColumns）を部屋の座標系の長方形にする（物を置かない所） */
function columnKeeps(f: Leg, r: RoomDef): [number, number, number, number][] {
  return extColumns(r).map(([x0, z0, x1, z1]) => {
    const a = f.local([x0, 0, z0]);
    const b = f.local([x1, 0, z1]);
    return [Math.min(a[0], b[0]) - 0.05, Math.min(a[2], b[2]) - 0.05, Math.max(a[0], b[0]) + 0.05, Math.max(a[2], b[2]) + 0.05];
  });
}

const SH = { shadow: true } as const;

/** 作り込んだ小物の数（物ごとの乱数の種。部屋ごとに 0 から） */
let PROP_N = 0;

/** 部屋の座標系の小さな座標系（Leg）に小物を置く（捨てる Builder の Leg なら捨てる）。yaw・y・x・z は Leg の中のずれ */
function kp(d: Dress, s: Leg, yaw = 0, y = 0, x = 0, z = 0): Prop {
  return wardMats(d.mats).at(s, x, z, yaw, d.seed * 131 + ++PROP_N, y);
}

// ---------------------------------------------------------------- 物

/** 病院のベッド（頭が -z、足が +z。中心が原点） */
function bed(d: Dress, s: Leg, r: () => number): void {
  const h = 0.55 + r() * 0.08;
  const turned = -0.35 + r() * 0.5;
  const rail = r() < 0.5 ? 1 : -1;
  hospitalBed(kp(d, s), { blanket: ZONE_COLORS[d.zone].blanket, h, turned, rail });
}

/** 床頭台（テレビ付き。背が -z） */
function bedside(d: Dress, s: Leg): void {
  bedsideCabinet(kp(d, s));
}

/** オーバーベッドテーブル（脚が片側） */
function overTable(d: Dress, s: Leg): void {
  overbedTable(kp(d, s));
}

/** ロッカー（背が -z） */
function locker(d: Dress, s: Leg, w = 0.5, h = 1.8): void {
  kLocker(kp(d, s), { w, h, tiers: PROP_N % 5 === 3 ? 2 : 1 });
}

/** 丸椅子・背もたれ椅子 */
function chair(d: Dress, s: Leg, back = true, color = DARK): void {
  if (back) stackChair(kp(d, s), { seat: color });
  else roundStool(kp(d, s), { seat: color });
}

/** 事務椅子（5 本脚） */
function officeChair(d: Dress, s: Leg): void {
  libChair(kp(d, s), commonOpts.officeChair());
}

/** 机・テーブル（中心が原点。w × dp） */
function table(d: Dress, s: Leg, w: number, dp: number, h = 0.72, color = WHITE): void {
  kTable(kp(d, s), w, dp, h, color);
}

/** 棚（金属の柱と板、上に箱やたたんだ布）。背が -z、幅 w */
function shelf(d: Dress, s: Leg, w: number, h: number, dp: number, load: WardLoad | WardLoad[]): void {
  // 幅の広い棚は 1.2 m 前後の棚を並べる（スチール棚は両端の柱だけで板を受ける）
  const n = Math.max(1, Math.round(w / 1.25));
  const uw = w / n;
  for (let i = 0; i < n; i++) wardShelf(kp(d, s, 0, 0, -w / 2 + uw * (i + 0.5)), { w: uw - 0.02, h, d: dp, levels: Math.max(3, Math.round(h / 0.42)), load });
}

/** 下の棚と天板のカウンター（背が -z）。流しを付けられる */
function counter(d: Dress, s: Leg, x0: number, x1: number, dp = 0.6, h = 0.85, o: { sink?: number; upper?: boolean } = {}): void {
  const body = d.mats.get(PALE, WHITE_S, 1);
  const top = d.mats.get(WHITE, WHITE_S, 1);
  const line = d.mats.get(GREY, undefined, 1);
  const metal = d.mats.get('#b9c6ae', undefined, 1);
  s.faces([x0, 0.08, -dp / 2], [x1, h - 0.03, dp / 2 - 0.03], { pz: body, px: body, nx: body }, { ...SH, collide: true });
  s.faces([x0, 0, -dp / 2], [x1, 0.08, dp / 2 - 0.07], { pz: d.mats.get(DARK, undefined, 0.5) });
  s.faces([x0 - 0.01, h - 0.03, -dp / 2], [x1 + 0.01, h, dp / 2 + 0.01], { pz: top, py: top, px: top, nx: top }, SH);
  for (let x = x0 + 0.5; x < x1 - 0.1; x += 0.5) s.faces([x - 0.003, 0.1, dp / 2 - 0.03], [x + 0.003, h - 0.05, dp / 2 - 0.025], { pz: line });
  if (o.sink !== undefined) {
    const sx = o.sink;
    s.faces([sx - 0.25, h - 0.002, -0.18], [sx + 0.25, h + 0.001, 0.18], { py: metal });
    s.faces([sx - 0.02, h, -dp / 2 + 0.05], [sx + 0.02, h + 0.3, -dp / 2 + 0.09], { pz: metal, px: metal, nx: metal, py: metal });
    s.faces([sx - 0.02, h + 0.27, -dp / 2 + 0.05], [sx + 0.02, h + 0.3, -dp / 2 + 0.25], { py: metal, pz: metal, ny: metal });
  }
  if (o.upper) {
    s.faces([x0, 1.5, -dp / 2], [x1, 2.2, -dp / 2 + 0.35], { pz: body, px: body, nx: body, ny: body, py: body }, SH);
    for (let x = x0 + 0.5; x < x1 - 0.1; x += 0.5) s.faces([x - 0.003, 1.52, -dp / 2 + 0.35], [x + 0.003, 2.18, -dp / 2 + 0.355], { pz: line });
  }
}

/** 洗面台（背が -z） */
function washbasin(d: Dress, s: Leg): void {
  kWashbasin(kp(d, s));
}

/** 天井のカーテンレールとカーテン（ベッドの周り）。ベッドの中心から見て、頭が -z */
function bedCurtain(d: Dress, s: Leg, h: number, r: () => number): void {
  const c = ZONE_COLORS[d.zone];
  const rail = d.mats.get(GREY, undefined, 0.6);
  const cloth = d.mats.get(c.curtain, undefined, 0.5);
  const cloth2 = d.mats.get(c.curtain2, undefined, 0.5);
  const x0 = -0.75;
  const x1 = 0.75;
  const z1 = 1.35;
  const y = h - 0.06;
  s.box(rail, [x0, y, -1.1], [x0 + 0.03, y + 0.03, z1], { shadow: false });
  s.box(rail, [x1 - 0.03, y, -1.1], [x1, y + 0.03, z1], { shadow: false });
  s.box(rail, [x0, y, z1 - 0.03], [x1, y + 0.03, z1], { shadow: false });
  // カーテン: 閉じた所は布（上は明るいメッシュの帯、ひだの細い線、下の縁）、開いた所は端に寄せた束
  const hem = d.mats.get(c.curtain, undefined, 0.3);
  const mesh = d.mats.get('#e9f0e2', undefined, 0.2);
  const fold = d.mats.get(c.curtain, undefined, 0);
  const panel = (ax: number, az: number, bx: number, bz: number): void => {
    const x0 = Math.min(ax, bx) - 0.008;
    const x1 = Math.max(ax, bx) + 0.008;
    const z0 = Math.min(az, bz) - 0.008;
    const z1 = Math.max(az, bz) + 0.008;
    const ym = y - 0.48;
    s.faces([x0, 0.42, z0], [x1, ym, z1], { pz: cloth2, nz: cloth2, px: cloth2, nx: cloth2, ny: cloth2 }, { shadow: true });
    s.faces([x0, ym, z0], [x1, y - 0.02, z1], { pz: mesh, nz: mesh, px: mesh, nx: mesh }, { shadow: false });
    s.faces([x0 - 0.002, 0.36, z0 - 0.002], [x1 + 0.002, 0.42, z1 + 0.002], { pz: hem, nz: hem, px: hem, nx: hem, ny: hem });
    // ひだ（細い縦の線。0.28 m おき）
    const alongX = x1 - x0 > z1 - z0;
    const len = alongX ? x1 - x0 : z1 - z0;
    for (let t = 0.2; t < len - 0.1; t += 0.28) {
      if (alongX) s.faces([x0 + t, 0.44, z0 - 0.003], [x0 + t + 0.014, ym - 0.02, z1 + 0.003], { pz: fold, nz: fold });
      else s.faces([x0 - 0.003, 0.44, z0 + t], [x1 + 0.003, ym - 0.02, z0 + t + 0.014], { px: fold, nx: fold });
    }
  };
  const bunch = (x: number, z: number): void => {
    s.faces([x - 0.06, 0.4, z - 0.13], [x + 0.06, y - 0.02, z + 0.13], { pz: cloth2, nz: cloth2, px: cloth, nx: cloth, ny: cloth }, SH);
  };
  const state = r();
  if (state < 0.12) {
    // 全部閉じている
    panel(x0, -1.05, x0, z1);
    panel(x1, -1.05, x1, z1);
    panel(x0, z1, x1, z1);
  } else if (state < 0.55) {
    // 片側だけ（壁の側から半分）
    const sx = r() < 0.5 ? x0 : x1;
    panel(sx, -1.05, sx, 0.15);
    bunch(sx, 0.25);
    bunch(sx === x0 ? x1 : x0, -0.95);
  } else {
    bunch(x0, -0.95);
    bunch(x1, -0.95);
  }
}

/** 医療ガス配管の板（ベッドの頭の上の壁。背が -z） */
function headwall(d: Dress, s: Leg, w: number): void {
  const body = d.mats.get(PALE, WHITE_S, 1);
  const dark = d.mats.get(DARK, undefined, 1);
  const green = d.mats.get('#5a797b', undefined, 1);
  s.faces([-w / 2, 1.3, 0], [w / 2, 1.58, 0.07], { pz: body, py: body, ny: body, px: body, nx: body });
  for (const [x, m] of [[-0.25, green], [-0.12, dark], [0.12, d.mats.get('#c4595e', undefined, 1)], [0.25, dark]] as [number, M][]) s.faces([x - 0.025, 1.4, 0.07], [x + 0.025, 1.47, 0.08], { pz: m });
  // 枕元の灯り・ナースコール
  s.faces([-0.4, 1.62, 0], [0.4, 1.68, 0.1], { pz: body, ny: d.mats.unlit('#fbfdf3', 0.4), px: body, nx: body }, { shadow: false });
  s.cyl(dark, [0.42, 0.95, 0.06], 0.01, 0.7, { segments: 6 });
}

/** 天井の灯り（場面の灯りと同じ形） */
function ceilingLamps(d: Dress, f: Leg, W: number, D: number, h: number, nx: number, nz: number, alongX = true): void {
  const body = d.mats.get('#d2dcbb', undefined, 1);
  const lens = d.mats.unlit('#f6faea', 0.5);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = -W / 2 + (W * (i + 0.5)) / nx;
      const z = -D / 2 + (D * (j + 0.5)) / nz;
      if (alongX) lamp(f, body, lens, [x, h, z], Math.min(1.25, W / nx - 0.4), 0.26, 0.06);
      else lamp(sub(f, x, z, Math.PI / 2), body, lens, [0, h, 0], Math.min(1.25, D / nz - 0.4), 0.26, 0.06);
    }
  smoke(f, body, [W * 0.2, h, D * 0.15]);
}

/** 部屋の座標系の部屋の箱（場面の座標。灯りが壁の外へ漏れないように） */
export function roomBox(f: Leg, W: number, D: number, h: number): [number, number, number, number, number, number] {
  const a = f.w([-W / 2, 0, -D / 2]);
  const c = f.w([W / 2, 0, D / 2]);
  return [Math.min(a[0], c[0]) - 0.02, -0.1, Math.min(a[2], c[2]) - 0.02, Math.max(a[0], c[0]) + 0.02, h + 0.05, Math.max(a[2], c[2]) + 0.02];
}

/** 掲示物（壁に貼る紙）。atlas に描いて貼る。壁は f の z = 0（部屋は +z） */
function papers(d: Dress, f: Leg, xs: [number, number], y: [number, number], n: number, r: () => number, style: 'ink' | 'note' = 'note'): void {
  for (let i = 0; i < n; i++) {
    const w = 0.22 + r() * 0.2;
    const h = w * (1.2 + r() * 0.3);
    const x = xs[0] + (xs[1] - xs[0]) * r();
    const yy = y[0] + (y[1] - y[0]) * r();
    const seed = Math.floor(r() * 1000);
    const uv = d.atlas.add(120, 160, (g, ww, hh) => {
      if (style === 'ink') inkNotice(g, ww, hh, seed);
      else notice(g, ww, hh, { bg: r() < 0.3 ? '#cddcbd' : '#eef3e4', head: r() < 0.5 ? '#c4595e' : '#5a797b', seed, edge: '#a3ae9c', edgeW: 2 });
    });
    f.sheet(d.paperMat, '+z', [x, yy, 0.004 + i * 0.0005], w, h, uv, {}, (r() - 0.5) * 0.06);
  }
}

/** ホワイトボード（壁は f の z = 0、部屋は +z） */
function whiteboard(d: Dress, f: Leg, x: number, w: number, r: () => number): void {
  const z = 0;
  const frame = d.mats.get(GREY, undefined, 1);
  const seed = Math.floor(r() * 1000);
  const uv = d.atlas.add(300, 160, (g, ww, hh) => {
    paper(g, ww, hh, '#f4f8ea');
    for (let row = 0; row < 5; row++) {
      bar(g, 10, 14 + row * 28, 46, 3, '#9aa59a');
      scribble(g, 70, 8 + row * 28, ww - 90, 20, { color: row % 3 === 0 ? '#c4595e' : '#41565b', row: 18, width: 2.5, seed: seed + row, hand: true });
    }
    for (let k = 0; k < 6; k++) bar(g, 64 + k * 40, 0, 1.5, hh, '#c9d3c0');
  });
  f.sheet(d.paperMat, '+z', [x, 1.45, z + 0.02], w, w * 0.53, uv);
  f.faces([x - w / 2 - 0.02, 1.45 - w * 0.27 - 0.02, z], [x + w / 2 + 0.02, 1.45 + w * 0.27 + 0.02, z + 0.018], { pz: frame, px: frame, nx: frame, py: frame, ny: frame });
  f.faces([x - w / 2, 1.45 - w * 0.27 - 0.06, z], [x + w / 2, 1.45 - w * 0.27 - 0.02, z + 0.07], { py: frame, pz: frame });
}

/** 点滴の柱 */
function ivPole(d: Dress, s: Leg): void {
  ivStand(kp(d, s));
}

/** モニター（台の上の画面。正面が +z） */
function monitor(d: Dress, s: Leg, w = 0.5, y = 0.75, vital = false): void {
  if (vital) vitalMonitor(kp(d, s, 0, y), w);
  else pcSet(kp(d, s), y, w);
}

/** 窓の内側のカーテン（窓の側の壁 z = -D/2 に沿って、端に寄せた束） */
function windowCurtains(d: Dress, f: Leg, W: number, D: number, h: number): void {
  const c = ZONE_COLORS[d.zone];
  const cloth = d.mats.get(c.curtain2, undefined, 0.4);
  const cloth2 = d.mats.get(c.curtain, undefined, 0.4);
  const rail = d.mats.get(GREY, undefined, 0.5);
  const z = -D / 2 + 0.12;
  // 両端の外壁の柱（0.32 m）の内側
  f.box(rail, [-W / 2 + 0.36, 2.32, z - 0.02], [W / 2 - 0.36, 2.36, z + 0.02], { shadow: false });
  for (const x of [-W / 2 + 0.55, W / 2 - 0.55]) f.faces([x - 0.14, 0.7, z - 0.07], [x + 0.14, 2.32, z + 0.07], { pz: cloth, px: cloth2, nx: cloth2 }, SH);
  // カーテンボックス（窓の上の天井から下がった箱。柱の間）
  const box = d.mats.get(ZONE_COLORS[d.zone].frame, undefined, 0.8);
  f.faces([-W / 2 + 0.32, h - 0.17, -D / 2], [W / 2 - 0.32, h, -D / 2 + 0.17], { pz: box, ny: box, px: box, nx: box }, { shadow: 'receive' });
}

/** 植木（鉢と丸い葉の塊） */
function plant(d: Dress, s: Leg, r: () => number): void {
  void r;
  pottedPlant(kp(d, s), commonOpts.plant());
}

/** ソファ（背が -z） */
function sofa(d: Dress, s: Leg, w: number, color: string): void {
  kSofa(kp(d, s), w, color);
}

/** テレビ台とテレビ（背が -z） */
function tvStand(d: Dress, s: Leg): void {
  kTvStand(kp(d, s));
}

/** 給水機・自販機（背が -z） */
function vending(d: Dress, s: Leg, kind: 'water' | 'drink'): void {
  if (kind === 'water') waterCooler(kp(d, s), commonOpts.cooler());
  else vendingMachine(kp(d, s), commonOpts.vending());
}

/** 車椅子 */
function wheelchair(d: Dress, s: Leg): void {
  kWheelchair(kp(d, s));
}

/** カート（処置・救急・カルテ・リネン）・ストレッチャー */
function cart(d: Dress, s: Leg, w: number, dp: number, h: number, color: string, kind?: 'drawers' | 'emergency' | 'records'): void {
  // 長い物はストレッチャー、リネンの色はリネンのカート、赤は救急カート、青緑はカルテのカート
  if (dp > 1.5) return stretcher(kp(d, s), { pad: color });
  if (color === '#e8f4dc') return linenCart(kp(d, s, Math.PI / 2), { w: dp, d: w, h, cover: ZONE_COLORS[d.zone].curtain });
  medCart(kp(d, s), { w, d: dp, h, body: color, kind: kind ?? (color === '#c4595e' ? 'emergency' : color === '#5a797b' ? 'records' : 'drawers') });
}

/** 便器（背が -z） */
function wc(d: Dress, s: Leg): void {
  toiletBowl(kp(d, s));
}

/** 浴槽・機械浴（背が -z） */
function bathtub(d: Dress, s: Leg, w: number, machine: boolean): void {
  bathTub(kp(d, s), w, { machine });
}

/** エレベーターの扉（壁の面 z = 0、正面が +z） */
function elevator(d: Dress, s: Leg, w: number, r: () => number): void {
  const steel = d.mats.get('#b9c6ae', '#9fae98', 1);
  const steel2 = d.mats.get('#a7b6a2', undefined, 1);
  const frame = d.mats.get('#d2dcbb', undefined, 1);
  const dark = d.mats.get(DARK, undefined, 1);
  s.faces([-w / 2, 0, -0.02], [0, 2.1, 0.0], { pz: steel });
  s.faces([0, 0, -0.02], [w / 2, 2.1, 0.0], { pz: steel2 });
  s.faces([-0.004, 0, 0], [0.004, 2.1, 0.003], { pz: dark });
  s.faces([-w / 2 - 0.12, 0, 0], [-w / 2, 2.22, 0.06], { pz: frame, px: frame, nx: frame });
  s.faces([w / 2, 0, 0], [w / 2 + 0.12, 2.22, 0.06], { pz: frame, px: frame, nx: frame });
  s.faces([-w / 2, 2.1, 0], [w / 2, 2.22, 0.06], { pz: frame, ny: frame, py: frame });
  // 階の表示・呼びボタン
  s.faces([-0.25, 2.3, 0], [0.25, 2.45, 0.02], { pz: dark });
  s.faces([-0.12, 2.34, 0.02], [-0.05, 2.41, 0.025], { pz: d.mats.unlit('#e9b56f', 0.3) });
  s.faces([w / 2 + 0.25, 1.0, 0], [w / 2 + 0.37, 1.25, 0.02], { pz: frame });
  for (const y of [1.06, 1.16]) s.cyl(dark, [w / 2 + 0.31, y, 0.025], 0.025, 0.01, { axis: 'z', segments: 10 });
  void r;
}

/** ランドリーの袋の台車（金属の枠と布の袋） */
function hamper(d: Dress, s: Leg, color: string): void {
  kHamper(kp(d, s), { bag: color, lid: color === '#a3bfa9' ? WARD.teal : WARD.sea });
}

/** 風呂の椅子（低い腰掛け） */
function stool(d: Dress, s: Leg, color: string): void {
  bathStool(kp(d, s), { color });
}

/** 壁の手すり（水平）。背が -z */
function wallRail(d: Dress, s: Leg, w: number, y: number): void {
  const metal = d.mats.get(GREY, undefined, 1);
  s.cyl(metal, [0, y, 0.07], 0.018, w, { axis: 'x', segments: 8 });
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) s.box(metal, [x - 0.012, y - 0.02, 0], [x + 0.012, y + 0.01, 0.07]);
}

// ---------------------------------------------------------------- 壁ぞいに置く道具（扉の前・置いた物を避ける）

type R4 = [number, number, number, number];
type WallSide = 'far' | 'near' | 'left' | 'right';

/**
 * 部屋の座標系で、壁に背を付けて物を置く（扉の前の空ける場所と、もう置いた物を避けて、壁の端から順に空いた所を探す）。
 * 置く物の原点は物の足元の真ん中（背が -z）
 */
class Placer {
  readonly used: R4[];
  /** 壁の高い物（壁に掛ける物を重ねない） */
  readonly tall: R4[] = [];
  constructor(
    readonly f: Leg,
    readonly W: number,
    readonly D: number,
  ) {
    this.used = KEEP.map((k) => [...k] as R4);
  }
  hit(r: R4, list: R4[] = this.used): boolean {
    return list.some((u) => r[2] > u[0] + 1e-3 && r[0] < u[2] - 1e-3 && r[3] > u[1] + 1e-3 && r[1] < u[3] - 1e-3);
  }
  private frame(side: WallSide, u: number, w: number, dp: number): { x: number; z: number; yaw: number; r: R4 } {
    const { W, D } = this;
    if (side === 'far') return { x: u, z: -D / 2 + dp / 2, yaw: 0, r: [u - w / 2, -D / 2, u + w / 2, -D / 2 + dp] };
    if (side === 'near') return { x: u, z: D / 2 - dp / 2, yaw: Math.PI, r: [u - w / 2, D / 2 - dp, u + w / 2, D / 2] };
    if (side === 'left') return { x: -W / 2 + dp / 2, z: u, yaw: Math.PI / 2, r: [-W / 2, u - w / 2, -W / 2 + dp, u + w / 2] };
    return { x: W / 2 - dp / 2, z: u, yaw: -Math.PI / 2, r: [W / 2 - dp, u - w / 2, W / 2, u + w / 2] };
  }
  /** 壁ぞいに幅 w・奥行き dp の物を置く。start は壁の一方の端からの割合（0〜1）、reverse で反対の端から探す */
  wall(side: WallSide, w: number, dp: number, o: { start?: number; reverse?: boolean; gap?: number; tall?: boolean } = {}): Leg | null {
    const along = side === 'far' || side === 'near' ? this.W : this.D;
    const gap = o.gap ?? 0.04;
    for (let t = (o.start ?? 0) * along; t + w <= along + 1e-6; t += 0.05) {
      const c = -along / 2 + t + w / 2;
      const u = o.reverse ? -c : c;
      const fr = this.frame(side, u, w, dp);
      const g: R4 = [fr.r[0] - gap, fr.r[1] - gap, fr.r[2] + gap, fr.r[3] + gap];
      if (this.hit(g)) continue;
      this.used.push(fr.r);
      if (o.tall) this.tall.push(fr.r);
      return new Leg(this.f.b, this.f.ctx, this.f.w([fr.x, 0, fr.z]), this.f.cam, this.f.yaw + fr.yaw);
    }
    return null;
  }
  /** 壁に掛ける物（床を使わない）。高い物の前は避ける。原点は壁の面の上 */
  onWall(side: WallSide, w: number, o: { start?: number; reverse?: boolean } = {}): Leg | null {
    const along = side === 'far' || side === 'near' ? this.W : this.D;
    for (let t = (o.start ?? 0) * along; t + w <= along + 1e-6; t += 0.05) {
      const c = -along / 2 + t + w / 2;
      const u = o.reverse ? -c : c;
      const fr = this.frame(side, u, w, 0.15);
      if (this.hit(fr.r, this.tall) || this.hit(fr.r, KEEP)) continue;
      this.tall.push(fr.r);
      const z0 = side === 'far' ? -this.D / 2 : side === 'near' ? this.D / 2 : fr.z;
      const x0 = side === 'left' ? -this.W / 2 : side === 'right' ? this.W / 2 : fr.x;
      return new Leg(this.f.b, this.f.ctx, this.f.w([x0, 0, z0]), this.f.cam, this.f.yaw + fr.yaw);
    }
    return null;
  }
  /** いくつかの候補の位置から、最初に空いている所に置く */
  atAny(cands: [number, number, number][], hw: number, hd: number): Leg | null {
    for (const [x, z, yaw] of cands) {
      const l = this.at(x, z, yaw, hw, hd);
      if (l) return l;
    }
    return null;
  }
  /** 部屋の中ほどに置く（hw・hd は半分の大きさ。yaw が ±π/2 なら入れ替えて測る） */
  at(x: number, z: number, yaw: number, hw: number, hd: number): Leg | null {
    const sw = Math.abs(Math.sin(yaw)) > 0.7;
    const r: R4 = sw ? [x - hd, z - hw, x + hd, z + hw] : [x - hw, z - hd, x + hw, z + hd];
    if (this.hit(r)) return null;
    this.used.push(r);
    return new Leg(this.f.b, this.f.ctx, this.f.w([x, 0, z]), this.f.cam, this.f.yaw + yaw);
  }
}

/** コート掛け（板と掛け具。いくつかに上着） */
function coatHooks(d: Dress, s: Leg, w: number, r: () => number): void {
  const board = d.mats.get(PALE, WHITE_S, 1);
  const metal = d.mats.get(GREY, undefined, 1);
  const coats = ['#a3bfa9', '#e8ecc7', '#5a797b', '#c9d7bb', '#80a496', '#eef5e2'];
  s.faces([-w / 2, 1.6, 0], [w / 2, 1.7, 0.025], { pz: board, py: board, ny: board, px: board, nx: board });
  const n = Math.max(2, Math.round(w / 0.28));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    s.box(metal, [x - 0.01, 1.62, 0.025], [x + 0.01, 1.66, 0.09]);
    if (r() < 0.55) {
      const m = coats[Math.floor(r() * coats.length)];
      const len = 0.75 + r() * 0.35;
      coat(kp(d, s, 0, 1.64, x, 0.0), len, m, len < 0.8 && PROP_N % 3 === 0 ? 'apron' : 'coat');
    }
  }
}

/** 掛け時計（壁の面 z = 0） */
function clock(d: Dress, s: Leg, y = 2.1): void {
  s.cyl(d.mats.get(DARK, undefined, 1), [0, y, 0.02], 0.17, 0.04, { axis: 'z', segments: 24 });
  s.cyl(d.mats.get('#f4f8ea', undefined, 0.3), [0, y, 0.042], 0.15, 0.005, { axis: 'z', segments: 24 });
  s.box(d.mats.get(DARK, undefined, 0.2), [-0.006, y, 0.045], [0.006, y + 0.11, 0.05]);
  s.box(d.mats.get(DARK, undefined, 0.2), [0, y - 0.006, 0.045], [0.08, y + 0.006, 0.05]);
}

/** 掲示板（コルクと紙。壁の面 z = 0） */
function noticeBoard(d: Dress, s: Leg, w: number, h: number, r: () => number, y = 1.45): void {
  const cork = d.mats.get('#b3b68b', undefined, 0.5);
  const frame = d.mats.get('#d2dcbb', undefined, 0.8);
  s.faces([-w / 2, y - h / 2, 0], [w / 2, y + h / 2, 0.015], { pz: cork });
  for (const [x0, y0, x1, y1] of [[-w / 2 - 0.03, y + h / 2, w / 2 + 0.03, y + h / 2 + 0.03], [-w / 2 - 0.03, y - h / 2 - 0.03, w / 2 + 0.03, y - h / 2], [-w / 2 - 0.03, y - h / 2, -w / 2, y + h / 2], [w / 2, y - h / 2, w / 2 + 0.03, y + h / 2]] as R4[])
    s.faces([x0, y0, 0], [x1, y1, 0.025], { pz: frame, py: frame, ny: frame, px: frame, nx: frame });
  const n = Math.max(2, Math.round((w * h) / 0.09));
  for (let i = 0; i < n; i++) {
    const pw = 0.14 + r() * 0.1;
    const ph = pw * (1.25 + r() * 0.2);
    const x = -w / 2 + pw / 2 + 0.04 + r() * (w - pw - 0.08);
    const yy = y - h / 2 + ph / 2 + 0.04 + r() * (h - ph - 0.08);
    const seed = Math.floor(r() * 1000);
    const uv = d.atlas.add(90, 120, (g, ww, hh) => notice(g, ww, hh, { bg: r() < 0.3 ? '#cddcbd' : '#eef3e4', head: r() < 0.5 ? '#c4595e' : '#5a797b', seed, edge: '#a3ae9c', edgeW: 2 }));
    s.sheet(d.paperMat, '+z', [x, yy, 0.017 + i * 0.0004], pw, ph, uv, {}, (r() - 0.5) * 0.08);
  }
}

/** 冷蔵庫（背が -z） */
function fridge(d: Dress, s: Leg, h = 1.7, w = 0.6): void {
  kFridge(kp(d, s), { h, w });
}

/** 電子レンジ・湯沸かしポット（台の上 y） */
function microwave(d: Dress, s: Leg, y: number): void {
  kMicrowave(kp(d, s), y);
}

/** 壁掛けのテレビ（壁の面 z = 0） */
function wallTV(d: Dress, s: Leg, w = 1.0, y = 1.9): void {
  const dark = d.mats.get(DARK, undefined, 1);
  const scr = d.mats.get(SCREEN, undefined, 1);
  s.box(dark, [-0.1, y - 0.1, 0], [0.1, y + 0.1, 0.06]);
  s.faces([-w / 2, y - w * 0.29, 0.06], [w / 2, y + w * 0.29, 0.1], { pz: scr, px: dark, nx: dark, py: dark, ny: dark });
}

/** 手洗いの付属（壁の面 z = 0）: 紙タオル・ハンドドライヤー・消毒液 */
function handDryer(d: Dress, s: Leg, x: number): void {
  kHandDryer(kp(d, s), x);
}

/** トイレの個室（仕切り・扉・便器・紙。原点は個室の前の真ん中の床、奥が -z） */
function cubicle(d: Dress, s: Leg, w: number, dp: number, open: number, r: () => number): void {
  const part = d.mats.get('#c9d7bb', '#a8b49c', 0.8);
  const edge = d.mats.get(GREY, undefined, 1);
  const t = 0.03;
  // 左右の仕切り（床から 0.15 上げる）と前の板・扉
  for (const x of [-w / 2, w / 2 - t]) s.faces([x, 0.15, -dp], [x + t, 2.0, 0], { px: part, nx: part, pz: edge, py: edge }, { collide: true });
  const dw = Math.min(0.7, w - 0.2);
  s.faces([-w / 2, 0.15, -t], [-w / 2 + (w - dw) / 2, 2.0, 0], { pz: part, nz: part, py: edge }, { collide: true });
  s.faces([w / 2 - (w - dw) / 2, 0.15, -t], [w / 2, 2.0, 0], { pz: part, nz: part, py: edge }, { collide: true });
  // 扉（少し開いているものも）
  const hx = -dw / 2;
  const ang = open * 1.2;
  const g = new THREE.BoxGeometry(dw, 1.8, t).translate(dw / 2, 0, 0).rotateY(-ang);
  s.mesh(g, part, [hx, 1.05, -t / 2]);
  if (open < 0.05) s.faces([hx + dw - 0.12, 1.0, 0], [hx + dw - 0.08, 1.05, 0.03], { pz: d.mats.get('#c4595e', undefined, 0.8) });
  wc(d, new Leg(s.b, s.ctx, s.w([0, 0, -dp + 0.32]), s.cam, s.yaw));
  void r;
}

/** おむつ交換台（たたんだ板。壁の面 z = 0） */
function changingTable(d: Dress, s: Leg): void {
  kChangingTable(kp(d, s));
}

/** 呼び出しボタン（赤い四角と引きひも） */
function callButton(d: Dress, s: Leg, y = 0.9): void {
  s.faces([-0.06, y, 0], [0.06, y + 0.12, 0.025], { pz: d.mats.get('#c4595e', undefined, 0.8), px: d.mats.get('#c4595e', undefined, 0.8), nx: d.mats.get('#c4595e', undefined, 0.8) });
  s.box(d.mats.get('#c4595e', undefined, 0.5), [-0.004, 0.25, 0.02], [0.004, y, 0.028]);
}

/** 歩行器 */
function walker(d: Dress, s: Leg): void {
  kWalker(kp(d, s));
}

/** 酸素の筒の台車（4 本） */
function oxygenRack(d: Dress, s: Leg): void {
  oxygenCart(kp(d, s));
}

/** 籠の棚（脱衣室。かごの並び。背が -z） */
function cubbies(d: Dress, s: Leg, w: number, h: number, r: () => number): void {
  const board = d.mats.get(PALE, WHITE_S, 1);
  const cols0 = ['#a3bfa9', '#e8ecc7', '#80a496'];
  const rows = 3;
  const cols = Math.max(2, Math.round(w / 0.42));
  s.faces([-w / 2, 0, -0.2], [w / 2, h, 0.2], { pz: null, px: board, nx: board, py: board }, { collide: true, shadow: true });
  for (let i = 0; i <= rows; i++) s.faces([-w / 2, (h * i) / rows, -0.2], [w / 2, (h * i) / rows + 0.02, 0.2], { py: board, pz: board });
  for (let j = 0; j <= cols; j++) s.faces([-w / 2 + (w * j) / cols - 0.01, 0, -0.2], [-w / 2 + (w * j) / cols + 0.01, h, 0.2], { pz: board, px: board, nx: board });
  s.faces([-w / 2, 0, -0.2], [w / 2, h, -0.19], { pz: d.mats.get('#b9c4a6', undefined, 0.4) });
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      if (r() < 0.25) continue;
      const m = cols0[Math.floor(r() * cols0.length)];
      const x0 = -w / 2 + (w * j) / cols + 0.04;
      const x1 = -w / 2 + (w * (j + 1)) / cols - 0.04;
      const y0 = (h * i) / rows + 0.03;
      basket(kp(d, s, 0, y0, (x0 + x1) / 2, 0.005), x1 - x0, (h / rows) * 0.55, 0.32, m);
    }
}

/** 引き出しの多い薬品棚（背が -z） */
function drawerCabinet(d: Dress, s: Leg, w: number, h: number): void {
  const body = d.mats.get(PALE, WHITE_S, 1);
  const line = d.mats.get(GREY, undefined, 1);
  const tag = d.mats.get('#e8ecc7', undefined, 0.3);
  s.faces([-w / 2, 0, -0.25], [w / 2, h, 0.25], { pz: body, px: body, nx: body, py: body }, { collide: true, shadow: true });
  const rows = Math.round(h / 0.14);
  const cols = Math.max(2, Math.round(w / 0.22));
  for (let i = 1; i < rows; i++) s.faces([-w / 2 + 0.02, (h * i) / rows - 0.004, 0.25], [w / 2 - 0.02, (h * i) / rows + 0.004, 0.255], { pz: line });
  for (let j = 1; j < cols; j++) s.faces([-w / 2 + (w * j) / cols - 0.004, 0.02, 0.25], [-w / 2 + (w * j) / cols + 0.004, h - 0.02, 0.255], { pz: line });
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const cx = -w / 2 + (w * (j + 0.5)) / cols;
      const cy = (h * (i + 0.5)) / rows;
      s.faces([cx - 0.05, cy + 0.01, 0.25], [cx + 0.05, cy + 0.04, 0.256], { pz: tag });
    }
}

/** 安全キャビネット（薬剤の調製台。ガラスの前面。背が -z） */
function safetyCabinet(d: Dress, s: Leg, w = 1.2): void {
  const body = d.mats.get(WHITE, WHITE_S, 1);
  const glass = d.mats.get('#a9c0bd', undefined, 0.6);
  const dark = d.mats.get(DARK, undefined, 1);
  s.faces([-w / 2, 0, -0.35], [w / 2, 0.85, 0.35], { pz: body, px: body, nx: body, py: body }, { collide: true, shadow: true });
  s.faces([-w / 2, 0.85, -0.35], [w / 2, 1.9, -0.05], { pz: body, px: body, nx: body, py: body }, SH);
  s.faces([-w / 2 + 0.05, 1.0, -0.05], [w / 2 - 0.05, 1.6, 0.0], { pz: glass });
  s.faces([-w / 2 + 0.1, 1.68, -0.05], [w / 2 - 0.1, 1.78, -0.04], { pz: dark });
}

/** プリンター（台の上 y） */
function printer(d: Dress, s: Leg, y: number): void {
  kPrinter(kp(d, s), y);
}

/** 投影用のスクリーン（天井から下ろした白い幕。壁の面 z = 0） */
function screen(d: Dress, s: Leg, w: number, h: number): void {
  const tube = d.mats.get(GREY, undefined, 1);
  const cloth = d.mats.get('#f4f8ea', undefined, 0.3);
  s.cyl(tube, [0, h - 0.08, 0.1], 0.05, w + 0.1, { axis: 'x', segments: 10 });
  s.faces([-w / 2, h - 1.4, 0.09], [w / 2, h - 0.1, 0.1], { pz: cloth, nz: cloth });
  s.box(tube, [-w / 2, h - 1.42, 0.085], [w / 2, h - 1.39, 0.105]);
}

// ---------------------------------------------------------------- 部屋の種類ごとの決まり

function firstExt(r: RoomDef): Side | undefined {
  return r.ext?.[0];
}

/** 扉から見て反対の辺（窓の無い部屋の「奥」） */
function farSide(r: RoomDef): Side {
  const d = r.doors[0]?.side ?? 's';
  return ({ n: 's', s: 'n', w: 'e', e: 'w' } as Record<Side, Side>)[d];
}

export function dressRoom(d: Dress, r: RoomDef): void {
  if (r.closed) return;
  const rnd = rng(d.seed);
  const toward = firstExt(r) ?? farSide(r);
  const { f, W, D } = roomFrame(d.b, d.ctx, r, toward);
  VOID = new Builder({ ...d.ctx, colliders: new Colliders() });
  KEEP = [...keepOuts(f, r), ...columnKeeps(f, r)];
  PROP_N = 0;
  try {
    dressKind(d, r, rnd, f, W, D);
  } finally {
    VOID = null;
    KEEP = [];
  }
}

function dressKind(d: Dress, r: RoomDef, rnd: () => number, f: Leg, W: number, D: number): void {
  const h = r.h;
  switch (r.kind) {
    case 'ward':
    case 'obs':
      return ward(d, f, W, D, h, r, rnd);
    case 'day':
      return dayroom(d, f, W, D, h, rnd);
    case 'ns':
      return nurseStation(d, r, rnd);
    case 'ev':
      return evHall(d, r, rnd);
    case 'conf':
      return conference(d, f, W, D, h, rnd);
    case 'treat':
      ceilingLamps(d, f, W, D, h, 2, 2);
      examCouch(kp(d, sub(f, -W / 2 + 0.6, -0.5, Math.PI / 2)), 1.9, 0.7, 0.62, { pad: '#a3bfa9' });
      counter(d, sub(f, 0.6, -D / 2 + 0.3), -1.4, 1.4, 0.6, 0.85, { sink: 0.8, upper: true });
      shelf(d, sub(f, W / 2 - 0.25, 0.2, -Math.PI / 2), 1.8, 1.9, 0.45, ['supply', 'ivbags', 'supply', 'bottles']);
      cart(d, sub(f, 0.4, 0.9), 0.55, 0.45, 0.9, '#a3bfa9');
      ivPole(d, sub(f, -W / 2 + 0.5, 0.8));
      lamp(f, d.mats.get('#d2dcbb', undefined, 1), d.mats.unlit('#fbfdf3', 0.5), [-W / 2 + 0.6, h, -0.5], 0.6, 0.6, 0.05);
      return;
    case 'equip':
      return equipment(d, f, W, D, h, rnd);
    case 'clean':
    case 'linen': {
      ceilingLamps(d, f, W, D, h, Math.max(1, Math.round(W / 3)), 2);
      const load: WardLoad[] = r.kind === 'linen' ? ['linen'] : ['supply', 'supply', 'ivbags', 'supply', 'bins'];
      // 壁ぞいに棚（奥と左右）
      const nb = Math.max(1, Math.floor((W - 0.4) / 1.6));
      for (let i = 0; i < nb; i++) shelf(d, sub(f, -W / 2 + 0.95 + i * 1.6, -D / 2 + 0.28), 1.5, 2.0, 0.5, load);
      const ns = Math.max(1, Math.floor((D - 2.2) / 1.6));
      for (let i = 0; i < ns; i++) shelf(d, sub(f, -W / 2 + 0.28, -D / 2 + 1.5 + i * 1.6, Math.PI / 2), 1.5, 2.0, 0.5, load);
      if (r.kind === 'linen') cart(d, sub(f, W / 2 - 0.6, 0.3, 0.2), 0.6, 0.9, 1.1, '#e8f4dc');
      else cart(d, sub(f, W / 2 - 0.6, 0.6, -0.15), 0.55, 0.45, 0.95, '#a8b79a');
      return;
    }
    case 'staff':
      return staffRoom(d, f, W, D, h, rnd);
    case 'locker':
      return lockerRoom(d, f, W, D, h, rnd);
    case 'med':
      return medRoom(d, f, W, D, h, rnd);
    case 'dirty':
      ceilingLamps(d, f, W, D, h, 2, 1);
      counter(d, sub(f, -0.6, -D / 2 + 0.35), -1.8, 1.0, 0.7, 0.85, { sink: -1.0 });
      // 汚物流し（深い流し）と洗浄器
      sluiceSink(kp(d, sub(f, 0.9, -D / 2 + 0.31)));
      bedpanWasher(kp(d, sub(f, 1.75, -D / 2 + 0.3)));
      shelf(d, sub(f, W / 2 - 0.25, 0.4, -Math.PI / 2), 1.4, 1.8, 0.45, ['bins', 'supply', 'bottles', 'supply']);
      for (let i = 0; i < 3; i++) bin3(d, sub(f, -W / 2 + 0.4 + i * 0.5, D / 2 - 0.5), ['#c4595e', '#e8ecc7', '#5a797b'][i]);
      // 汚れたリネンの袋の台車・感染性の廃棄物の箱・手袋とエプロンの箱
      hamper(d, sub(f, -0.6, 0.3, 0.1), '#a3bfa9');
      hamper(d, sub(f, 0.2, 0.5, -0.15), '#e8ecc7');
      for (let i = 0; i < 3; i++) wasteBox(kp(d, sub(f, W / 2 - 0.4, -D / 2 + 0.4 + i * 0.5, 0.05 * i, 0.25)), { h: 0.4 + (i % 2) * 0.1 });
      {
        const sh = sub(f, -0.6, -D / 2);
        wallShelfItems(kp(d, sh, 0, 1.4, -0.4, 0.15), 2.7, 0.26);
        sh.faces([-1.8, 1.38, 0], [1.0, 1.4, 0.3], { py: d.mats.get(PALE, WHITE_S, 1), pz: d.mats.get(PALE, WHITE_S, 1), ny: d.mats.get(GREY, undefined, 1) });
        wallRail(d, sub(f, 1.3, -D / 2), 0.8, 1.2);
      }
      return;
    case 'toilet':
      return toilet(d, f, W, D, h, r, rnd);
    case 'dress':
      return dressingRoom(d, f, W, D, h, rnd);
    case 'bath':
      ceilingLamps(d, f, W, D, h, 2, 1);
      bathtub(d, sub(f, -0.6, -D / 2 + 0.46), 1.9, true);
      bathtub(d, sub(f, -W / 2 + 0.46, 1.0, Math.PI / 2), 1.4, false);
      for (let i = 0; i < 3; i++) {
        const s = sub(f, W / 2 - 0.35, -1.2 + i * 1.0, -Math.PI / 2);
        showerSet(kp(d, s, 0, 0, 0, -0.35));
        stool(d, sub(f, W / 2 - 0.65, -1.2 + i * 1.0, -Math.PI / 2 + 0.2 * i), WHITE);
      }
      // ストレッチャー・タオルの棚・壁の手すり・仕切りのカーテン
      cart(d, sub(f, 0.4, D / 2 - 0.9, Math.PI / 2), 0.7, 1.9, 0.75, '#a9c0bd');
      shelf(d, sub(f, -W / 2 + 0.3, D / 2 - 1.0, Math.PI / 2), 1.0, 1.6, 0.4, 'linen');
      wallRail(d, sub(f, -0.6, -D / 2), 1.6, 0.85);
      f.box(d.mats.get(GREY, undefined, 0.5), [W / 2 - 1.1, r.h - 0.06, -1.8], [W / 2 - 1.08, r.h - 0.03, 1.2], { shadow: false });
      f.faces([W / 2 - 1.1, 0.5, 0.6], [W / 2 - 1.08, r.h - 0.08, 1.2], { px: d.mats.get(ZONE_COLORS[d.zone].curtain2, undefined, 0.4), nx: d.mats.get(ZONE_COLORS[d.zone].curtain2, undefined, 0.4) });
      return;
    case 'stair':
      return; // 階段室は stairs.ts
  }
}

/** 足踏みのごみ箱（ふたの色で分別） */
function bin3(d: Dress, s: Leg, color: string): void {
  pedalBin(kp(d, s), { lid: color });
}

function ward(d: Dress, f: Leg, W: number, D: number, h: number, r: RoomDef, rnd: () => number): void {
  const beds = r.beds ?? 4;
  ceilingLamps(d, f, W, D, h, 1, 2, false);
  windowCurtains(d, f, W, D, h);
  // 窓ぎわの暖房の箱
  f.faces([-W / 2 + 0.45, 0, -D / 2], [W / 2 - 0.45, 0.6, -D / 2 + 0.2], { pz: d.mats.get(PALE, WHITE_S, 1), py: d.mats.get(PALE, WHITE_S, 1), px: d.mats.get(PALE, WHITE_S, 1), nx: d.mats.get(PALE, WHITE_S, 1) }, { shadow: true, collide: true });
  // 暖房の箱の吹き出しの格子（横の細い線）
  for (let y = 0.42; y < 0.58; y += 0.05) f.faces([-W / 2 + 0.5, y, -D / 2 + 0.2], [W / 2 - 0.5, y + 0.012, -D / 2 + 0.204], { pz: d.mats.get(GREY, undefined, 1) });
  // ベッドの頭は左右の壁（x = ±W/2）。窓の側と扉の側に 1 台ずつ
  const rows = beds >= 4 ? [-D / 2 + 1.35, Math.min(D / 2 - 1.55, 0.25 + 1.0)] : beds === 2 ? [-D / 2 + 1.45] : [-D / 2 + 1.6];
  const sides: (1 | -1)[] = beds === 1 ? [-1] : [-1, 1];
  for (const sx of sides)
    for (let z of rows) {
      // ベッドが扉の前に掛かるなら窓の側へずらす
      const bx = sx * (W / 2 - 1.08);
      let tries = 0;
      while (hitsKeep(bx - 1.05, z - 0.55, bx + 1.05, z + 0.55) && tries++ < 6) z -= 0.25;
      if (hitsKeep(bx - 1.05, z - 0.55, bx + 1.05, z + 0.55)) continue;
      const s = new Leg(f.b, f.ctx, f.w([bx, 0, z]), f.cam, f.yaw + (sx > 0 ? -Math.PI / 2 : Math.PI / 2));
      bed(d, s, rnd);
      bedCurtain(d, s, h, rnd);
      headwall(d, sub(f, sx * (W / 2), z, sx > 0 ? -Math.PI / 2 : Math.PI / 2), 1.1);
      bedside(d, sub(f, sx * (W / 2 - 0.3), z + 0.75, sx > 0 ? -Math.PI / 2 : Math.PI / 2));
      if (rnd() < 0.7) overTable(d, sub(f, sx * (W / 2 - 1.3), z - 0.68 * (rnd() < 0.5 ? 1 : -1), 0));
      if (rnd() < 0.5) chair(d, sub(f, sx * (W / 2 - 1.2), z + 0.85, Math.PI + (rnd() - 0.5)), false, '#80a496');
      if (r.kind === 'obs') {
        monitor(d, sub(f, sx * (W / 2 - 0.35), z - 0.75, sx > 0 ? -Math.PI / 2 : Math.PI / 2), 0.38, 1.2, true);
        f.faces([sx > 0 ? W / 2 - 0.5 : -W / 2 + 0.1, 1.15, z - 0.95], [sx > 0 ? W / 2 - 0.1 : -W / 2 + 0.5, 1.2, z - 0.55], { py: d.mats.get(GREY, undefined, 1), pz: d.mats.get(GREY, undefined, 1) });
        ivPole(d, sub(f, sx * (W / 2 - 0.4), z - 1.05));
      }
    }
  // ロッカー（扉の側の壁ぎわ）・洗面台
  const nl = Math.min(beds, 4);
  for (let i = 0; i < nl; i++) locker(d, sub(f, -W / 2 + 0.35 + i * 0.52, D / 2 - 0.3, Math.PI), 0.5, 1.75);
  washbasin(d, sub(f, W / 2 - 0.45, D / 2 - 0.27, Math.PI));
  if (r.kind === 'obs') cart(d, sub(f, 0, D / 2 - 0.9), 0.6, 0.45, 1.0, '#c4595e');
  else if (beds <= 2) {
    sofa(d, sub(f, W / 2 - 0.5, D / 2 - 1.8, -Math.PI / 2), 1.3, ZONE_COLORS[d.zone].blanket);
    if (beds === 1) tvStand(d, sub(f, -W / 2 + 0.3, D / 2 - 1.8, Math.PI / 2));
  }
  // 掲示（扉の側の壁の内側）
  papers(d, sub(f, 0, D / 2, Math.PI), [-0.6, 0.6], [1.45, 1.75], 2, rnd);
}

function dayroom(d: Dress, f: Leg, W: number, D: number, h: number, rnd: () => number): void {
  ceilingLamps(d, f, W, D, h, 3, 2);
  // テーブルと椅子
  const cols = Math.max(2, Math.floor((W - 2.5) / 2.6));
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < 2; j++) {
      const x = -W / 2 + 2.2 + i * 2.6 + (j ? 0.4 : 0);
      const z = -D / 2 + 1.5 + j * 2.0;
      table(d, sub(f, x, z), 1.2, 0.8, 0.7, '#e8f4dc');
      chair(d, sub(f, x - 0.3, z + 0.65, Math.PI + rnd() * 0.2), true, '#80a496');
      chair(d, sub(f, x + 0.35, z + 0.6, Math.PI - 0.1), true, '#80a496');
      chair(d, sub(f, x - 0.3, z - 0.65, rnd() * 0.2), true, '#80a496');
      if (rnd() < 0.6) chair(d, sub(f, x + 0.3, z - 0.62, 0), true, '#80a496');
    }
  // テレビ・ソファ（奥の端）
  tvStand(d, sub(f, W / 2 - 0.35, -0.6, -Math.PI / 2));
  sofa(d, sub(f, W / 2 - 2.4, -0.6, Math.PI / 2), 1.8, '#a3bfa9');
  // 本棚・給水機・自販機・植木
  shelf(d, sub(f, W / 2 - 1.2, D / 2 - 0.25, Math.PI), 1.6, 1.2, 0.35, ['binders', 'paper', 'binders']);
  vending(d, sub(f, -W / 2 + 0.9, D / 2 - 0.4, Math.PI), 'drink');
  vending(d, sub(f, -W / 2 + 1.8, D / 2 - 0.4, Math.PI), 'water');
  plant(d, sub(f, -W / 2 + 0.4, -D / 2 + 0.45), rnd);
  plant(d, sub(f, W / 2 - 0.45, -D / 2 + 0.45), rnd);
  papers(d, sub(f, -1.5, D / 2, Math.PI), [-1.4, 1.4], [1.3, 1.8], 5, rnd);
}

function toilet(d: Dress, f: Leg, W: number, D: number, h: number, r: RoomDef, rnd: () => number): void {
  ceilingLamps(d, f, W, D, h, 1, D > 4 ? 2 : 1, false);
  const P = new Placer(f, W, D);
  if (r.label.includes('多目的')) {
    // 多目的トイレ: 奥に便器（L 字の手すり・反対側にはね上げの手すり）、横に洗面台と鏡・手を乾かす機械、おむつ交換台、呼び出しボタン
    const w = P.at(-W / 2 + 0.55, -D / 2 + 0.45, 0, 0.5, 0.45);
    if (w) {
      wc(d, sub(w, 0, -0.1));
      w.box(d.mats.get(GREY, undefined, 1), [-0.45, 0.7, -0.35], [-0.42, 0.73, 0.35]);
      callButton(d, sub(f, -W / 2 + 1.3, -D / 2), 0.9);
    }
    const b = P.wall('right', 0.6, 0.5, { start: 0.25 });
    if (b) washbasin(d, b);
    const dr = P.onWall('right', 0.7, { start: 0.55 });
    if (dr) handDryer(d, dr, 0);
    const ct = P.onWall('left', 1.0, { start: 0.45 });
    if (ct) changingTable(d, ct);
    const bn = P.wall('far', 0.4, 0.4, { reverse: true });
    if (bn) bin3(d, bn, '#e8ecc7');
    wallRail(d, sub(f, 0, -D / 2 + 0.001), 0.7, 0.75);
    return;
  }
  // 病室のトイレ: 奥に個室を並べる（仕切り・扉）、手前に洗面台・鏡・手を乾かす機械・ごみ箱
  const n = Math.max(1, Math.floor((W + 0.05) / 0.9));
  const cw = W / n;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + cw * (i + 0.5);
    P.used.push([x - cw / 2, -D / 2, x + cw / 2, -D / 2 + 1.5]);
    cubicle(d, sub(f, x, -D / 2 + 1.45, 0, 0), cw, 1.45, rnd() < 0.5 ? 0 : 0.3 + rnd() * 0.6, rnd);
  }
  for (let i = 0; i < 2; i++) {
    const b = P.wall('left', 0.6, 0.5, { start: 0.35 });
    if (b) washbasin(d, b);
  }
  const dr = P.onWall('left', 0.7, { start: 0.3 });
  if (dr) handDryer(d, dr, 0);
  const bn = P.wall('near', 0.4, 0.4);
  if (bn) bin3(d, bn, '#e8ecc7');
}

// ---------------------------------------------------------------- スタッフの部屋（壁ぞいに置く道具で埋める）

function chairsAround(d: Dress, t: Leg, w: number, dp: number, color: string, r: () => number, ends = false): void {
  const n = Math.max(1, Math.round(w / 0.75));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    for (const sg of [-1, 1]) if (r() < 0.9) chair(d, sub(t, x + (r() - 0.5) * 0.1, sg * (dp / 2 + 0.24), (sg > 0 ? Math.PI : 0) + (r() - 0.5) * 0.3, 0.2), true, color);
  }
  if (ends) for (const sg of [-1, 1]) chair(d, sub(t, sg * (w / 2 + 0.32), 0, sg > 0 ? -Math.PI / 2 : Math.PI / 2, 0.2), true, color);
}

function staffRoom(d: Dress, f: Leg, W: number, D: number, h: number, r: () => number): void {
  ceilingLamps(d, f, W, D, h, 1, 2, false);
  const P = new Placer(f, W, D);
  // 給湯の台（流し・上の棚・電子レンジとポット）と冷蔵庫
  const k = P.wall('right', 1.8, 0.62, { start: 0.12 });
  if (k) {
    counter(d, k, -0.9, 0.9, 0.6, 0.85, { sink: -0.45, upper: true });
    microwave(d, new Leg(k.b, k.ctx, k.w([0.25, 0, -0.05]), k.cam, k.yaw), 0.85);
    for (let i = 0; i < 4; i++) mug(kp(d, k, 0, 0.85, -0.85 + i * 0.09, -0.22), ['#eef5e2', '#a3bfa9', '#c4595e', '#e8ecc7'][i]);
  }
  const fr = P.wall('right', 0.62, 0.66, { tall: true });
  if (fr) fridge(d, fr);
  const wd = P.wall('right', 0.42, 0.72);
  if (wd) vending(d, wd, 'water');
  // 左の壁: ロッカー 3 つ・ソファ
  for (let i = 0; i < 3; i++) {
    const l = P.wall('left', 0.5, 0.55, { tall: true, reverse: true });
    if (l) locker(d, l, 0.48, 1.8);
  }
  const so = P.wall('left', 1.6, 0.82);
  if (so) sofa(d, so, 1.6, '#80a496');
  // 真ん中のテーブルと椅子
  const t = P.atAny([[0, 0.1, Math.PI / 2], [0, 0.4, Math.PI / 2], [0, -0.3, Math.PI / 2], [0, 0, 0]], 0.7 + 0.1, 0.4 + 0.5);
  if (t) {
    table(d, t, 1.4, 0.8, 0.72, WHITE);
    chairsAround(d, t, 1.4, 0.8, '#5a797b', r);
    t.cyl(d.mats.get('#e8ecc7', undefined, 0.6), [0.3, 0.77, 0.1], 0.05, 0.09, { segments: 10 });
  }
  // 壁: 掲示板・コート掛け・テレビ・時計・ごみ箱
  const nb = P.onWall('far', 1.3);
  if (nb) noticeBoard(d, nb, 1.2, 0.85, r);
  const ch = P.onWall('left', 1.4, { start: 0.2 });
  if (ch) coatHooks(d, ch, 1.3, r);
  const tv = P.onWall('near', 1.0, { start: 0.1 });
  if (tv) wallTV(d, tv, 0.9, 1.95);
  const cl = P.onWall('right', 0.4, { reverse: true });
  if (cl) clock(d, cl);
  for (const c of ['#c4595e', '#e8ecc7']) {
    const bn = P.wall('near', 0.42, 0.42);
    if (bn) bin3(d, bn, c);
  }
}

function conference(d: Dress, f: Leg, W: number, D: number, h: number, r: () => number): void {
  ceilingLamps(d, f, W, D, h, 2, 2);
  const P = new Placer(f, W, D);
  const t = P.atAny([[0.2, -0.3, 0], [0.2, -0.1, 0], [-0.4, -0.3, 0], [0.6, -0.3, 0]], 1.6 + 0.4, 0.6 + 0.55);
  if (t) {
    table(d, t, 3.2, 1.2, 0.72, WHITE);
    chairsAround(d, t, 3.2, 1.2, '#5a797b', r, true);
    for (let i = 0; i < 3; i++) papersOnTable(d, sub(t, -1.0 + i * 0.9, (r() - 0.5) * 0.4), 0.72, r);
  }
  // 奥の壁: ホワイトボードとスクリーン
  const wb = P.onWall('far', 2.1, { start: 0.08 });
  if (wb) whiteboard(d, wb, 0, 1.9, r);
  const sc = P.onWall('far', 2.0, { reverse: true, start: 0.08 });
  if (sc) screen(d, sc, 1.8, h);
  // 左の壁: ファイルの棚 2 つ
  for (let i = 0; i < 2; i++) {
    const sh = P.wall('left', 1.5, 0.42, { tall: true, start: 0.05 });
    if (sh) shelf(d, sh, 1.5, 1.8, 0.4, ['binders', 'binders', 'paper', 'binders']);
  }
  // 右の壁: 端末とプリンターの台・掲示板
  const pc = P.wall('right', 1.4, 0.62, { start: 0.1 });
  if (pc) {
    table(d, pc, 1.4, 0.6, 0.72, WHITE);
    monitor(d, sub(pc, -0.3, -0.05), 0.5, 0.72);
    printer(d, sub(pc, 0.4, 0), 0.72);
    officeChair(d, sub(pc, -0.3, 0.75, Math.PI));
  }
  const nb = P.onWall('right', 1.1, { reverse: true });
  if (nb) noticeBoard(d, nb, 1.0, 0.8, r);
  // 移動式のモニターの台
  const mv = P.at(W / 2 - 0.9, -D / 2 + 0.9, -0.5, 0.35, 0.35);
  if (mv) {
    monitorCart(kp(d, mv));
  }
  const ch = P.onWall('near', 1.2, { start: 0.05 });
  if (ch) coatHooks(d, ch, 1.1, r);
  const cl = P.onWall('near', 0.4, { reverse: true });
  if (cl) clock(d, cl);
}

/** 机の上の書類の束 */
function papersOnTable(d: Dress, s: Leg, y: number, r: () => number): void {
  const m = d.mats.get('#f4f8ea', '#d5dccb', 0.4);
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) s.faces([-0.15, y + i * 0.01, -0.11], [0.15, y + i * 0.01 + 0.008, 0.11], { py: m, pz: m, px: m }, {});
}

function equipment(d: Dress, f: Leg, W: number, D: number, h: number, r: () => number): void {
  ceilingLamps(d, f, W, D, h, Math.max(1, Math.round(W / 3)), D > 3 ? 2 : 1);
  const P = new Placer(f, W, D);
  // 長い壁に棚（箱・機器）。窓の壁は低い物だけ
  const longSides: WallSide[] = W >= D ? ['far', 'near'] : ['left', 'right'];
  const sides: WallSide[] = D > 4 ? ['left', 'right'] : longSides;
  let k = 0;
  for (const side of sides)
    for (let i = 0; i < 4; i++) {
      const sh = P.wall(side, 1.8, 0.5, { tall: true, start: 0.02 });
      if (!sh) break;
      shelf(d, sh, 1.8, 1.9, 0.5, k % 2 ? ['cardboard', 'supply', 'mixed', 'supply'] : k % 3 === 0 ? ['cardboard', 'devices', 'mixed', 'ivbags'] : ['cardboard', 'mixed', 'supply', 'mixed']);
      k++;
    }
  if (D > 4) {
    // 窓の壁の前: ストレッチャー・歩行器
    const st = P.wall('far', 1.95, 0.75, { start: 0.15 });
    if (st) cart(d, new Leg(st.b, st.ctx, st.w([0, 0, 0]), st.cam, st.yaw + Math.PI / 2), 0.7, 1.9, 0.75, '#a9c0bd');
    for (let i = 0; i < 2; i++) {
      const wk = P.wall('far', 0.6, 0.5, { reverse: true });
      if (wk) walker(d, wk);
    }
  }
  // 中ほど: 車椅子・酸素ボンベ・点滴の柱・カート
  const spots: [number, number, number][] = [
    [-W / 4, 0.3, 0.3],
    [-W / 4 + 0.75, 0.5, 0.1],
    [W / 4, 0.2, -0.2],
    [0, -0.4, 0],
    [W / 4 - 0.8, -0.6, 0.4],
  ];
  const kinds = ['wheel', 'wheel', 'oxy', 'iv', 'cart'];
  spots.forEach(([x, z, yaw], i) => {
    const s = P.at(x * (W > 3 ? 1 : 0.3), z * (D > 3 ? 1 : 0.2), yaw, 0.38, 0.38);
    if (!s) return;
    if (kinds[i] === 'wheel') wheelchair(d, s);
    else if (kinds[i] === 'oxy') oxygenRack(d, s);
    else if (kinds[i] === 'iv') {
      ivPole(d, s);
      ivPole(d, sub(s, 0.3, 0.1));
    } else cart(d, s, 0.6, 0.5, 0.95, '#5a797b');
  });
  // 床に置いた段ボールの山
  const bx = P.at(-W / 2 + 0.9, D / 2 - 0.9, 0.2, 0.4, 0.35);
  if (bx) {
    parcelPile(kp(d, bx), { n: 2 });
    parcelPile(kp(d, bx, 0.4, 0, 0.62, 0.05), { n: 1 });
  }
  const nb = P.onWall('near', 0.9, { reverse: true });
  if (nb) noticeBoard(d, nb, 0.7, 0.5, r, 1.6);
}

function lockerRoom(d: Dress, f: Leg, W: number, D: number, h: number, r: () => number): void {
  ceilingLamps(d, f, W, D, h, 2, 1);
  const P = new Placer(f, W, D);
  for (const side of ['far', 'near'] as WallSide[])
    for (let i = 0; i < 16; i++) {
      const l = P.wall(side, 0.48, 0.55, { tall: true, start: 0.12 });
      if (!l) break;
      locker(d, l, 0.47, 1.8);
    }
  const b = P.at(0.4, 0, 0, 1.0, 0.25);
  if (b) {
    paddedBench(kp(d, b), 1.8, { seat: '#80a496' });
    // 座に置いた手さげの袋
    for (let i = 0; i < 3; i++) if (r() < 0.6) toteBag(kp(d, b, (i - 1) * 0.3, 0.44, -0.58 + i * 0.6, 0), ['#a3bfa9', '#e8ecc7', '#5a797b'][i]);
  }
  // 端の壁: 鏡・コート掛け・靴の棚・袋
  const mi = P.onWall('left', 0.7);
  if (mi) {
    mi.faces([-0.3, 1.0, 0], [0.3, 1.9, 0.015], { pz: d.mats.get('#a9c0bd', undefined, 0.6) });
    mi.faces([-0.33, 0.97, 0], [0.33, 1.0, 0.03], { pz: d.mats.get(GREY, undefined, 1), py: d.mats.get(GREY, undefined, 1) });
  }
  const ch = P.onWall('right', 1.4);
  if (ch) coatHooks(d, ch, 1.3, r);
  const sr = P.wall('right', 1.0, 0.35, { reverse: true });
  if (sr) {
    shelf(d, sr, 1.0, 0.5, 0.35, 'bins');
  }
  const hp = P.wall('left', 0.66, 0.56, { reverse: true });
  if (hp) hamper(d, hp, '#a3bfa9');
}

function medRoom(d: Dress, f: Leg, W: number, D: number, h: number, r: () => number): void {
  ceilingLamps(d, f, W, D, h, 1, 2, false);
  const P = new Placer(f, W, D);
  // 奥: 流しと上の棚の付いた作業台（全幅）
  const c = P.wall('far', W - 0.1, 0.62);
  if (c) {
    counter(d, c, -(W - 0.1) / 2, (W - 0.1) / 2, 0.6, 0.85, { sink: (W - 0.1) / 2 - 0.5, upper: true });
    // 作業台の上: 薬の箱と点滴の袋のかご・ファイル立て
    for (let i = 0; i < 5; i++) supplyBox(kp(d, c, (i % 2 - 0.5) * 0.08, 0.85, -1.1 + i * 0.28, -0.125), 0.2, 0.06 + (i % 3) * 0.03, 0.15, ['#e8ecc7', '#a3bfa9', '#c4595e'][i % 3]);
    binderRow(kp(d, c, 0, 0.85, 0.35, -0.15), 5, 0.28);
  }
  // 左: 引き出しの薬品棚・端末の台
  const dc = P.wall('left', 1.3, 0.52, { tall: true, start: 0.1 });
  if (dc) drawerCabinet(d, dc, 1.3, 1.75);
  const pc = P.wall('left', 1.4, 0.62);
  if (pc) {
    counter(d, pc, -0.7, 0.7, 0.6, 0.85);
    monitor(d, sub(pc, -0.3, -0.05), 0.45, 0.85);
    printer(d, sub(pc, 0.35, 0), 0.85);
  }
  // 右: 薬の冷蔵庫・安全キャビネット・棚
  const fr = P.wall('right', 0.62, 0.66, { tall: true, start: 0.1 });
  if (fr) fridge(d, fr, 1.5);
  const sc = P.wall('right', 1.2, 0.72, { tall: true });
  if (sc) safetyCabinet(d, sc);
  const sh = P.wall('right', 0.9, 0.45, { tall: true });
  if (sh) shelf(d, sh, 0.9, 1.8, 0.45, ['bottles', 'supply', 'bins', 'supply']);
  // 中: 薬のカート 2 台
  for (const [x, z, c2] of [[0.0, 0.6, '#c4595e'], [0.1, -0.6, '#5a797b']] as [number, number, string][]) {
    const s = P.at(x, z, 0.1, 0.35, 0.3);
    if (s) cart(d, s, 0.6, 0.45, 1.0, c2, 'drawers');
  }
  const nb = P.onWall('near', 1.0);
  if (nb) noticeBoard(d, nb, 0.9, 0.7, r);
  const cl = P.onWall('far', 0.4, { start: 0.45 });
  if (cl) clock(d, cl, 2.35);
}

function dressingRoom(d: Dress, f: Leg, W: number, D: number, h: number, r: () => number): void {
  ceilingLamps(d, f, W, D, h, 2, 1);
  const P = new Placer(f, W, D);
  // 窓の下と右の壁: かごの棚
  const cb = P.wall('far', 2.4, 0.4, { start: 0.08 });
  if (cb) cubbies(d, cb, 2.4, 1.2, r);
  const cb2 = P.wall('right', 1.8, 0.4, { tall: true, start: 0.1 });
  if (cb2) cubbies(d, cb2, 1.8, 1.5, r);
  // 左の壁: 鏡とドライヤーの台
  const mc = P.wall('left', 1.2, 0.52, { start: 0.05 });
  if (mc) {
    counter(d, mc, -0.6, 0.6, 0.5, 0.75);
    mc.faces([-0.55, 1.0, -0.25], [0.55, 1.75, -0.235], { pz: d.mats.get('#a9c0bd', undefined, 0.6) });
    mc.cyl(d.mats.get(WHITE, undefined, 1), [0.35, 0.8, 0.0], 0.04, 0.12, { axis: 'z', segments: 8 });
  }
  const wb = P.wall('left', 0.6, 0.5, { reverse: true });
  if (wb) washbasin(d, wb);
  const ch = P.onWall('near', 1.4, { start: 0.05 });
  if (ch) coatHooks(d, ch, 1.3, r);
  // 中: ベンチ 2 つ・車椅子・体重計・袋・風呂の椅子
  for (const [x, z] of [[-0.6, -0.4], [0.9, 0.5]] as [number, number][]) {
    const b = P.at(x, z, 0, 0.7, 0.2);
    if (b) paddedBench(kp(d, b), 1.4, { seat: '#80a496' });
  }
  const wc2 = P.at(-W / 2 + 0.9, D / 2 - 1.1, 0.6, 0.4, 0.45);
  if (wc2) wheelchair(d, wc2);
  const sc = P.at(W / 2 - 1.0, -0.9, 0, 0.22, 0.22);
  if (sc) floorScale(kp(d, sc));
  for (const c of ['#a3bfa9', '#e8ecc7']) {
    const hp = P.wall('near', 0.66, 0.56, { reverse: true });
    if (hp) hamper(d, hp, c);
  }
  const st = P.at(0.2, 1.4, 0.4, 0.22, 0.2);
  if (st) stool(d, st, WHITE);
  const cl = P.onWall('right', 0.4, { reverse: true });
  if (cl) clock(d, cl);
}

// ---------------------------------------------------------------- ナースステーション・エレベーターホール

function nurseStation(d: Dress, r: RoomDef, rnd: () => number): void {
  // 北（廊下）に向いた低いカウンター、中に机と端末、壁に書類の棚・ホワイトボード
  const { f, W, D } = roomFrame(d.b, d.ctx, r, 'n');
  KEEP = keepOuts(f, r);
  ceilingLamps(d, f, W, D, r.h, 3, 2);
  // 廊下の窓の内側の机（窓の下）
  counter(d, sub(f, -0.6, -D / 2 + 0.35), -2.6, 2.6, 0.7, 0.72);
  for (let i = 0; i < 4; i++) {
    monitor(d, sub(f, -2.4 + i * 1.3, -D / 2 + 0.38), 0.48, 0.72);
    officeChair(d, sub(f, -2.4 + i * 1.3, -D / 2 + 1.2, Math.PI + (rnd() - 0.5) * 0.8));
  }
  // 真ん中の島の机
  table(d, sub(f, -0.4, 0.4), 2.6, 1.2, 0.72, WHITE);
  for (let i = 0; i < 2; i++) monitor(d, sub(f, -1.1 + i * 1.4, 0.2, Math.PI), 0.45, 0.72);
  officeChair(d, sub(f, -1.0, 1.3, Math.PI + 0.3));
  officeChair(d, sub(f, 0.6, -0.5, 0.2));
  // 書類の棚（奥の壁・西の壁）
  shelf(d, sub(f, -W / 2 + 0.25, 0.5, Math.PI / 2), 2.4, 1.9, 0.4, ['binders', 'binders', 'paper', 'binders']);
  shelf(d, sub(f, W / 2 - 1.6, D / 2 - 0.25, Math.PI), 2.2, 1.9, 0.4, ['binders', 'paper', 'binders', 'binders']);
  whiteboard(d, sub(f, 0, D / 2, Math.PI), 0.6, 1.6, rnd);
  // カルテ・薬のカート
  cart(d, sub(f, 1.8, 1.4, 0.2), 0.6, 0.5, 1.0, '#5a797b');
  cart(d, sub(f, 2.5, 1.0, -0.1), 0.6, 0.5, 1.0, '#c4595e');
  papers(d, sub(f, -W / 2, -1.6, Math.PI / 2), [-0.6, 0.6], [1.5, 1.9], 3, rnd);
}

function evHall(d: Dress, r: RoomDef, rnd: () => number): void {
  // 南の壁にエレベーター 2 台（寝台用・一般）。北の口から廊下へ
  const { f, W, D } = roomFrame(d.b, d.ctx, r, 's');
  KEEP = keepOuts(f, r);
  ceilingLamps(d, f, W, D, r.h, 2, 2);
  // エレベーターの前の光だまり（灯りの下の床が一段明るい。ホールの箱の中だけ）
  for (const x of [-W / 4, W / 4]) trackLamp(d.ctx, { pos: f.w([x, r.h - 0.3, -D / 4]), radius: 2.8, intensity: 0.3, down: true, box: roomBox(f, W, D, r.h), shadow: 0.8 });
  // 南の壁は local z = -D/2（toward s）
  elevator(d, sub(f, 0.0 + 1.9, -D / 2), 1.4, rnd);
  elevator(d, sub(f, -1.4 + 0.2, -D / 2), 1.0, rnd);
  // ベンチ・案内板・消毒液の台
  const bench = sub(f, -W / 2 + 0.35, 0.4, -Math.PI / 2);
  libBench(kp(d, bench, Math.PI), commonOpts.seats(1.8));
  const sign = d.atlas.add(240, 320, (g, w, h) => {
    paper(g, w, h, '#e8ecc7', '#415553', 6);
    bar(g, 20, 18, w - 40, 30, '#415553');
    for (let i = 0; i < 6; i++) {
      bar(g, 24, 70 + i * 38, 40, 22, ['#80a496', '#c4c9a1', '#b9cdb4', '#7d998b', '#c76b6c', '#889d89'][i]);
      scribble(g, 76, 72 + i * 38, w - 100, 18, { color: '#415553', row: 18, width: 3, seed: 400 + i });
    }
  });
  const sw = sub(f, W / 2, 0.6, -Math.PI / 2);
  sw.sheet(d.paperMat, '+z', [0, 1.5, 0.01], 0.75, 1.0, sign);
  const stand = sub(f, W / 2 - 0.5, -0.8);
  sanitizerStand(kp(d, stand));
  plant(d, sub(f, -W / 2 + 0.4, -D / 2 + 0.4), rnd);
  // エレベーターの間の柱型と、右の壁ぎわの長椅子・車椅子（面会の人が待つ所）
  {
    const wallM = d.mats.get(ZONE_COLORS[d.zone].wall, undefined, 0.4, { flecks: ROOM_FLECKS[d.zone] });
    const s = sub(f, 0.25, -D / 2, 0, 0.2);
    s.faces([-0.25, 0, 0], [0.25, r.h, 0.3], { pz: wallM, px: wallM, nx: wallM }, { collide: true });
    s.faces([-0.25, 0, 0.3], [0.25, 0.1, 0.302], { pz: d.mats.get(ZONE_COLORS[d.zone].base, undefined, 0.3) });
  }
  const bench2 = sub(f, W / 2 - 0.35, -1.5, -Math.PI / 2, 0.5);
  libBench(kp(d, bench2), commonOpts.seats(1.4));
  wheelchair(d, sub(f, W / 2 - 0.7, D / 2 - 1.0, -Math.PI / 2 - 0.3, 0.45));
}

export type { V3 };
