import * as THREE from 'three';
import { decalMaterial } from '../../render/Decal.ts';
import type { Lamp } from '../../render/Lamps.ts';
import { type Builder, rng, type V3 } from '../../scenes/Builder.ts';
import type { Atlas } from '../../scenes/corridor/kit.ts';
import { CAM0 } from '../../scenes/corridor/seg0.ts';
import type { SceneContext } from '../../scenes/types.ts';
import type { Mats } from './furnish.ts';
import type { LegDef, LegId, RoomDef, Side } from './layout.ts';
import { Leg } from './leg.ts';
import { type Hit, Probe, type RefVis } from './probe.ts';
import { sideFrame } from './rooms.ts';
import {
  alarmBox, board, boxStack, conduit, diffuser, dispenser, domeCamK, exitHanging, extinguisher, floorDevice, hatch, hydrant, intercom, type Kit, kitFor,
  apronHooks, bumper, gloveRack, handRail, lowPole, namePlate, outlet, paperCluster, pipeRun, scrap, smokeDet, speaker, sprinkler, squareBin, switchPlate, thermostat, wallClock, wallShelf,
} from './wallkit.ts';

/**
 * 写っていない所の作り込みの「決まり」（部屋・廊下の目の後ろと角・階段）。
 * 参考画像の 4 枚から数えた密度で、壁・天井・床に記号的な小物を置く:
 * - 壁: 扉の横のスイッチ・名札・消毒液、コンセント（約 2.5 m おき）、紙の束（約 2〜3 m おき）、掲示板、発信機（赤い箱と配管）、
 *   壁の白い傷（区域の色）、廊下の目の後ろには柱型（約 3 m おき。参考画像の柱型のリズム）
 * - 天井: 吹き出し口・スプリンクラー・点検口・スピーカー・監視カメラ・感知器
 * - 床: 紙くず（壁ぎわに多い）・落ちた紙、廊下には置きっぱなしの物（段ボール・低いポール・機械・ごみ箱）
 * 置く所は作った形へ光線を飛ばして決める（平らな壁・天井・床の上で、前が空いている所だけ。扉・窓・家具・もう貼った紙は避ける）。
 * 廊下では、参考画像の視点（4 つ）から見える所には置かない（RefVis。柱型の陰・目の後ろ・角だけ）。
 */

type M = THREE.Material;

/**
 * 階段室・ホールの灯りの光だまり（ctx.addLamp）。目が近い時だけ点ける（遠くの灯りの計算を全部の画素でしないように）。
 * 場面を作るたびに空にする
 */
export const TRACKED_LAMPS: Lamp[] = [];
export function trackLamp(ctx: SceneContext, l: Lamp): Lamp {
  const r = ctx.addLamp(l);
  TRACKED_LAMPS.push(r);
  return r;
}

export interface DressEnv {
  ctx: SceneContext;
  mats: Mats;
  atlas: Atlas;
  paperMat: M;
}

/** 区域ごとの壁の傷・床の帯の貼り絵（参考画像の描き方） */
interface ZoneDecals {
  fleck: M;
  band: M;
  bandLight?: M;
  /** 帯を壁の足元に立てる（D の紺の幅木） */
  bandOnWall?: boolean;
  bandW: number;
}

const DECALS = new WeakMap<Mats, Map<LegId, ZoneDecals>>();

export function zoneDecals(mats: Mats, zone: LegId): ZoneDecals {
  let m = DECALS.get(mats);
  if (!m) DECALS.set(mats, (m = new Map()));
  let z = m.get(zone);
  if (z) return z;
  if (zone === 'A') z = { fleck: decalMaterial({ color: '#e1ecd0', rag: 0.004, scale: 40 }), band: decalMaterial({ color: '#3f5159', rag: 0.05, scale: 2.2, edges: [0, 1, 0, 0], step: 0.12 }), bandW: 0.1 };
  else if (zone === 'B') z = { fleck: decalMaterial({ color: '#eef3d6', rag: 0.004, scale: 40 }), band: decalMaterial({ color: '#4c5c58', rag: 0.04, scale: 2.6, edges: [0, 1, 0, 0], step: 0.08 }), bandW: 0.07 };
  else if (zone === 'C')
    z = {
      fleck: decalMaterial({ color: '#e6f4d8', rag: 0.004, scale: 40, ink: 0.003, inkColor: '#2c4245' }),
      band: decalMaterial({ color: '#587778', rag: 0.018, scale: 3.5, ink: 0.004, inkColor: '#2c4245', edges: [0, 1, 0, 0], specks: 0.18, speckColor: '#e4f1dd', step: 0.05 }),
      bandLight: decalMaterial({ color: '#aebaa3', rag: 0.035, scale: 3.2, ink: 0.005, inkColor: '#3f5658', edges: [0, 1, 0, 0], step: 0.06 }),
      bandW: 0.1,
    };
  else z = { fleck: decalMaterial({ color: '#c3d8c8', rag: 0.003, scale: 40 }), band: decalMaterial({ color: '#182832', rag: 0.06, scale: 0.9, edges: [0, 0, 0, 1], step: 0.5 }), bandOnWall: true, bandW: 0.14 };
  m.set(zone, z);
  return z;
}

// ---------------------------------------------------------------- 壁に沿って置く道具

export interface RunOpts {
  /** 光線を飛ばし始める所（壁の面の基準から部屋の側へ m） */
  start?: number;
  /** 面の位置の範囲（基準の面から +z へ。柱型の前の面・引っ込んだ面も受ける） */
  minOut?: number;
  maxOut?: number;
  vis?: RefVis | null;
}

/**
 * 壁の 1 面（座標系 f: 壁の面の基準が z = 0、部屋の側が +z、x が壁に沿う）。
 * fit で「幅 w・高さ y0〜y1・出っ張り d の物を x に置けるか」を光線で調べ、置ける面の z を返す
 */
export class WallRun {
  readonly used: [number, number, number, number][] = [];
  private readonly dirW: THREE.Vector3;
  private readonly o: Required<Omit<RunOpts, 'vis'>> & { vis: RefVis | null };
  /** 最後に当たった壁の材質（柱型を同じ材質で作る） */
  lastMat: M | null = null;
  constructor(
    readonly f: Leg,
    readonly x0: number,
    readonly x1: number,
    readonly probe: Probe,
    o: RunOpts = {},
  ) {
    const [dx, dz] = f.dir(0, -1);
    this.dirW = new THREE.Vector3(dx, 0, dz);
    this.o = { start: o.start ?? 0.9, minOut: o.minOut ?? -0.08, maxOut: o.maxOut ?? 0.6, vis: o.vis ?? null };
  }

  get len(): number {
    return this.x1 - this.x0;
  }

  private ray(x: number, y: number): Hit | null {
    const p = new THREE.Vector3(...this.f.w([x, y, this.o.start]));
    return this.probe.cast(p, this.dirW, this.o.start - this.o.minOut + 0.05);
  }

  /** 1 点の壁の面（z）。壁でなければ null */
  face(x: number, y: number): number | null {
    const h = this.ray(x, y);
    if (!h || h.kind !== 'mount' || h.normal.dot(this.dirW) > -0.9) return null;
    const z = this.o.start - h.dist;
    if (z > this.o.maxOut) return null;
    this.lastMat = h.mat;
    return z;
  }

  free(x: number, w: number, y0: number, y1: number, pad = 0.03): boolean {
    return !this.used.some((u) => x + w / 2 + pad > u[0] && x - w / 2 - pad < u[1] && y1 + pad > u[2] && y0 - pad < u[3]);
  }

  /** 置けるなら面の z、置けなければ null（vis があれば参考画像の視点から見える所も null） */
  fit(x: number, w: number, y0: number, y1: number, d: number): number | null {
    if (x - w / 2 < this.x0 + 0.02 || x + w / 2 > this.x1 - 0.02) return null;
    if (!this.free(x, w, y0, y1)) return null;
    let zf = NaN;
    const xs = w > 0.06 ? [x - w / 2 + 0.012, x, x + w / 2 - 0.012] : [x];
    const ys = y1 - y0 > 0.06 ? [y0 + 0.012, (y0 + y1) / 2, y1 - 0.012] : [(y0 + y1) / 2];
    for (const xx of xs)
      for (const yy of ys) {
        const z = this.face(xx, yy);
        if (z === null) return null;
        if (Number.isNaN(zf)) zf = z;
        else if (Math.abs(z - zf) > 0.006) return null;
      }
    if (this.o.start - zf < d + 0.05) return null;
    if (this.o.vis && this.hidden(x, w, y0, y1, zf, d) === false) return null;
    return zf;
  }

  /** 参考画像の視点から見えないか */
  hidden(x: number, w: number, y0: number, y1: number, zf: number, d: number): boolean {
    if (!this.o.vis) return true;
    // 物の前の面を 0.1 m 以下の升目で調べる（角だけだと、角が柱型や窓の枠に隠れて真ん中が見えることがある）
    const pts: THREE.Vector3[] = [];
    const nx = Math.max(1, Math.ceil(w / 0.1));
    const ny = Math.max(1, Math.ceil((y1 - y0) / 0.12));
    for (let i = 0; i <= nx; i++)
      for (let j = 0; j <= ny; j++) {
        const xx = x - w / 2 + (w * i) / nx;
        const yy = y0 + ((y1 - y0) * j) / ny;
        pts.push(new THREE.Vector3(...this.f.w([xx, yy, zf + 0.012])));
        if (d > 0.03 && (i === 0 || i === nx || j === 0 || j === ny)) pts.push(new THREE.Vector3(...this.f.w([xx, yy, zf + d])));
      }
    return !this.o.vis.anyVisible(pts);
  }

  /** a〜c の区間から、高さ y0〜y1 に掛かる置いた物の所を除いた区間 */
  freeParts(a: number, c: number, y0: number, y1: number, pad = 0.05): [number, number][] {
    let parts: [number, number][] = [[a, c]];
    for (const u of this.used) {
      if (u[3] <= y0 || u[2] >= y1) continue;
      const next: [number, number][] = [];
      for (const [p, q] of parts) {
        if (u[1] + pad <= p || u[0] - pad >= q) next.push([p, q]);
        else {
          if (u[0] - pad > p) next.push([p, u[0] - pad]);
          if (u[1] + pad < q) next.push([u[1] + pad, q]);
        }
      }
      parts = next;
    }
    return parts;
  }

  take(x: number, w: number, y0: number, y1: number): void {
    this.used.push([x - w / 2, x + w / 2, y0, y1]);
  }

  /** 置く座標系（物の中心の x、面の z。原点の y は壁の座標系の床） */
  at(x: number, zf: number): Leg {
    return new Leg(this.f.b, this.f.ctx, this.f.w([x, 0, zf]), this.f.cam, this.f.yaw);
  }

  /** x の近くで置ける所を探す（左右へ少しずつずらす） */
  near(x: number, w: number, y0: number, y1: number, d: number, span = 0.6): { x: number; z: number } | null {
    for (const dx of [0, 0.08, -0.08, 0.16, -0.16, 0.25, -0.25, 0.36, -0.36, 0.5, -0.5, 0.65, -0.65].filter((v) => Math.abs(v) <= span)) {
      const z = this.fit(x + dx, w, y0, y1, d);
      if (z !== null) return { x: x + dx, z };
    }
    return null;
  }

  /** 壁の続いている区間（高さ y で光線を並べて、壁に当たる所をつなぐ）。扉・開口・物の所で切れる */
  spans(y: number, step = 0.1): [number, number][] {
    const out: [number, number][] = [];
    let a: number | null = null;
    let pz = NaN;
    for (let x = this.x0 + step / 2; x < this.x1; x += step) {
      const z = this.face(x, y);
      // 面の位置が変わる所（柱型の前の面など）でも切る
      if (a !== null && (z === null || Math.abs(z - pz) > 0.01)) {
        out.push([a, x - step]);
        a = null;
      }
      if (z !== null && a === null) a = x;
      pz = z ?? NaN;
    }
    if (a !== null) out.push([a, this.x1 - step / 2]);
    return out;
  }
}

// ---------------------------------------------------------------- 天井・床の空き

/** 水平な正方形（中心 x・z、半分の大きさ rr、高さ y）の上の点（0.1 m 以下の升目）と、下の点（高さ y2）が見えるか */
function squareVisible(vis: RefVis, x: number, z: number, rr: number, y: number, y2?: number): boolean {
  const pts: THREE.Vector3[] = [];
  const n = Math.max(1, Math.ceil((rr * 2) / 0.1));
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      pts.push(new THREE.Vector3(x - rr + (rr * 2 * i) / n, y, z - rr + (rr * 2 * j) / n));
      if (y2 !== undefined && (i === 0 || i === n || j === 0 || j === n)) pts.push(new THREE.Vector3(x - rr + (rr * 2 * i) / n, y2, z - rr + (rr * 2 * j) / n));
    }
  return vis.anyVisible(pts);
}

/** 天井（高さ h）の点の周り（半径 rr）が天井の面か */
function ceilFree(probe: Probe, x: number, z: number, h: number, rr: number): boolean {
  const up = new THREE.Vector3(0, 1, 0);
  for (const [dx, dz] of [[0, 0], [rr, rr], [-rr, rr], [rr, -rr], [-rr, -rr]]) {
    const hit = probe.cast(new THREE.Vector3(x + dx, h - 0.45, z + dz), up, 0.6);
    if (!hit || hit.kind !== 'mount' || Math.abs(hit.dist - 0.45) > 0.03) return false;
  }
  return true;
}

/** 床（高さ y0）の点の周りが床の面で、上に物が無いか（高さ above まで） */
function floorFree(probe: Probe, x: number, z: number, y0: number, rr: number, above = 0.3): boolean {
  const dn = new THREE.Vector3(0, -1, 0);
  const pts = rr > 0 ? [[0, 0], [rr, rr], [-rr, rr], [rr, -rr], [-rr, -rr]] : [[0, 0]];
  for (const [dx, dz] of pts) {
    const hit = probe.cast(new THREE.Vector3(x + dx, y0 + above, z + dz), dn, above + 0.1);
    if (!hit || hit.kind !== 'mount' || Math.abs(hit.dist - above) > 0.03) return false;
  }
  return true;
}

// ---------------------------------------------------------------- 部屋

/** 部屋の種類ごとの壁の紙の多さ（参考画像の廊下を 1 として） */
const PAPER_RATE: Partial<Record<RoomDef['kind'], number>> = {
  ward: 0.4, obs: 0.5, day: 0.75, ns: 1.0, ev: 1.0, conf: 0.8, treat: 0.75, equip: 0.5, staff: 1.0, locker: 0.5, med: 0.8, clean: 0.4, linen: 0.4,
  dirty: 0.45, toilet: 0.2, dress: 0.25, bath: 0.2, stair: 0.35,
};
const BOARD: Partial<Record<RoomDef['kind'], boolean>> = { ns: true, ev: true, conf: true, treat: true, equip: true, staff: true, med: true, day: true, locker: true, linen: true, clean: true };
const DISPENSE: Partial<Record<RoomDef['kind'], boolean>> = { ward: true, obs: true, treat: true, ev: true, dirty: true, toilet: true, med: true, day: true, ns: true };

/** 部屋の辺の壁の座標系と範囲 */
function roomRuns(b: Builder, ctx: SceneContext, r: RoomDef, probe: Probe, vis: RefVis | null, clip?: (x: number, z: number) => boolean): { side: Side; run: WallRun; doors: [number, number][] }[] {
  const out: { side: Side; run: WallRun; doors: [number, number][] }[] = [];
  const [x0, z0, x1, z1] = r.rect;
  const D = Math.min(x1 - x0, z1 - z0);
  for (const side of ['n', 's', 'w', 'e'] as Side[]) {
    const { leg: f, sgn } = sideFrame(b, ctx, r, side);
    const [u0, u1] = side === 'n' || side === 's' ? [x0, x1] : [z0, z1];
    let a = Math.min(sgn * u0, sgn * u1);
    let c = Math.max(sgn * u0, sgn * u1);
    if (clip) {
      // 区間を切る（壁の上の点が clip の外なら使わない）
      const ok = (x: number): boolean => {
        const p = f.w([x, 0, 0.3]);
        return clip(p[0], p[2]);
      };
      while (a < c && !ok(a + 0.05)) a += 0.1;
      while (c > a && !ok(c - 0.05)) c -= 0.1;
      if (c - a < 0.4) continue;
    }
    const doors = r.doors.filter((d) => d.side === side).map((d): [number, number] => [Math.min(sgn * d.a, sgn * d.b), Math.max(sgn * d.a, sgn * d.b)]);
    out.push({ side, run: new WallRun(f, a, c, probe, { start: Math.min(0.9, D / 2 - 0.1), vis }), doors });
  }
  return out;
}

export interface RoomDressOpts {
  vis?: RefVis | null;
  /** 場面の点（x, z）が飾る範囲か（階段室の待避の場所だけ、など） */
  clip?: (x: number, z: number) => boolean;
  /** 天井・床も飾るか */
  ceil?: boolean;
  floor?: boolean;
  /** 床の高さ */
  floorY?: number;
}

export function dressRoomExtras(env: DressEnv, b: Builder, doorsRoot: THREE.Object3D, r: RoomDef, seed: number, o: RoomDressOpts = {}): void {
  const { ctx } = env;
  const k = kitFor(env.mats, r.zone, env.atlas, env.paperMat);
  const rnd = rng(seed);
  const [x0, z0, x1, z1] = r.rect;
  const probe = new Probe([b.root, doorsRoot]).focus(new THREE.Box3(new THREE.Vector3(x0 - 0.5, -0.5, z0 - 0.5), new THREE.Vector3(x1 + 0.5, r.h + 0.5, z1 + 0.5)));
  const runs = roomRuns(b, ctx, r, probe, o.vis ?? null, o.clip);
  const rate = PAPER_RATE[r.kind] ?? 0.4;
  const wet = r.kind === 'bath' || r.kind === 'toilet' || r.kind === 'dress' || r.kind === 'dirty';
  // ---- 扉の横: スイッチ（取っ手の側）・インターホン・消毒液 ----
  let dispensed = !DISPENSE[r.kind];
  for (const { run, doors } of runs)
    for (const [da, db] of doors) {
      const sides = rnd() < 0.5 ? [1, -1] : [-1, 1];
      let sw = false;
      for (const sg of sides) {
        const x = sg > 0 ? db + 0.2 : da - 0.2;
        const p = run.near(x, 0.12, 1.07, 1.23, 0.02, 0.12);
        if (!p) continue;
        switchPlate(k, run.at(p.x, p.z), 0, 1.15, rnd() < 0.4 ? 2 : 1);
        run.take(p.x, 0.12, 1.07, 1.23);
        // 横に小さな板（インターホン・温度の調節器）
        const q = run.near(p.x + sg * 0.22, 0.16, 1.3, 1.52, 0.03, 0.1);
        if (q && rnd() < 0.7) {
          if (r.kind === 'ward' || r.kind === 'obs' || r.kind === 'ns') intercom(k, run.at(q.x, q.z), 0, 1.41);
          else thermostat(k, run.at(q.x, q.z), 0, 1.41);
          run.take(q.x, 0.16, 1.3, 1.52);
        }
        sw = true;
        if (!dispensed) {
          const ds = run.near(sg > 0 ? da - 0.25 : db + 0.25, 0.16, 0.95, 1.3, 0.11, 0.2);
          if (ds) {
            dispenser(k, run.at(ds.x, ds.z), 0, 1.12);
            run.take(ds.x, 0.16, 0.95, 1.3);
            dispensed = true;
          }
        }
        break;
      }
      void sw;
    }
  // ---- 発信機（部屋に 1 つ。扉に近い壁） ----
  if (!wet || r.kind === 'dirty') {
    const order = [...runs].sort((a, c) => c.doors.length - a.doors.length);
    let done = false;
    for (const { run, doors } of order) {
      if (done) break;
      const cands = doors.length ? doors.flatMap(([a, c]) => [c + 0.55, a - 0.55, c + 1.0, a - 1.0]) : [run.x0 + run.len * 0.3, run.x0 + run.len * 0.7];
      for (const x of cands) {
        const p = run.near(x, 0.24, 1.2, 1.65, 0.07, 0.3);
        if (!p) continue;
        alarmBox(k, run.at(p.x, p.z), 0, 1.35, r.h);
        run.take(p.x, 0.24, 1.2, r.h);
        done = true;
        break;
      }
    }
  }
  // ---- 屋内消火栓（ホール・デイルーム） ----
  if (r.kind === 'ev' || r.kind === 'day') {
    let done = false;
    for (const { run } of [...runs].sort((a, c) => c.run.len - a.run.len)) {
      if (done) break;
      for (let t = 0.15; t < 0.9 && !done; t += 0.07) {
        const p = run.near(run.x0 + run.len * t, 0.8, 0.2, 1.6, 0.2, 0.1);
        if (!p) continue;
        hydrant(k, run.at(p.x, p.z), 0);
        run.take(p.x, 0.8, 0, 1.6);
        done = true;
      }
    }
  }
  // ---- 掲示板（スタッフの部屋・ホール） ----
  if (BOARD[r.kind]) {
    const order = [...runs].sort((a, c) => c.run.len - a.run.len);
    const want = r.kind === 'ev' || r.kind === 'staff' || r.kind === 'ns' || r.kind === 'day' ? 2 : 1;
    let got = 0;
    for (const { run } of order) {
      if (got >= want) break;
      let done = false;
      const w = Math.min(1.4, 0.8 + rnd() * 0.6);
      const h = 0.6 + rnd() * 0.3;
      for (let t = 0.2; t < 0.85 && !done; t += 0.12) {
        const x = run.x0 + run.len * t;
        const p = run.near(x, w + 0.1, 1.45 - h / 2 - 0.05, 1.45 + h / 2 + 0.05, 0.04, 0.2);
        if (!p) continue;
        board(k, run.at(p.x, p.z), 0, 1.45, w, h, rnd);
        run.take(p.x, w + 0.1, 1.45 - h / 2 - 0.05, 1.45 + h / 2 + 0.05);
        done = true;
        got++;
      }
    }
  }
  // ---- 水まわり・物置の設備: 天井の際の横の配管（扉・窓の上を通る）、棚と掛け具 ----
  if (r.kind === 'dirty' || r.kind === 'bath' || r.kind === 'equip' || r.kind === 'linen' || r.kind === 'clean' || r.kind === 'dress' || r.kind === 'locker') {
    const order = [...runs].sort((a, c) => c.run.len - a.run.len);
    for (const { run } of order.slice(0, r.kind === 'dirty' || r.kind === 'bath' ? 2 : 1)) {
      const y = r.h - 0.22;
      const sp = run.spans(y, 0.1).sort((a, c) => c[1] - c[0] - (a[1] - a[0]))[0];
      if (!sp || sp[1] - sp[0] < 1.0) continue;
      const z = run.face((sp[0] + sp[1]) / 2, y);
      if (z === null) continue;
      pipeRun(k, run.at(0, z), sp[0] + 0.05, sp[1] - 0.05, y, 0.035, rnd() < 0.3 ? 'teal' : 'pipe');
      pipeRun(k, run.at(0, z), sp[0] + 0.05, sp[1] - 0.05, y - 0.12, 0.018, 'white');
      run.take((sp[0] + sp[1]) / 2, sp[1] - sp[0], y - 0.18, r.h);
    }
    // 汚物処理室・浴室: 床の近くの排水の管（家具の無い区間）
    if (r.kind === 'dirty' || r.kind === 'bath')
      for (const { run } of order.slice(0, 3))
        for (const [a, c] of run.spans(0.28, 0.1)) {
          if (c - a < 0.8) continue;
          const z = run.face((a + c) / 2, 0.28);
          if (z === null) continue;
          for (const [p, q] of run.freeParts(a, c, 0.2, 0.36)) {
            if (q - p < 0.8) continue;
            pipeRun(k, run.at(0, z), p + 0.05, q - 0.05, 0.28, 0.045, 'pipe');
            run.take((p + q) / 2, q - p, 0.2, 0.36);
          }
        }
  }
  if (wet) {
    // 汚物処理室・浴室は棚と掛け具を 2 つずつまで（使う物の多い部屋）
    const many = r.kind === 'dirty' || r.kind === 'bath' ? 2 : 1;
    let shelves = 0;
    let aprons = 0;
    for (const { run } of [...runs].sort((a, c) => c.run.len - a.run.len)) {
      // 1 つの壁に棚と掛け具を 1 つずつまで（壁に散らす）
      let sh = false;
      let ap = false;
      for (let t = 0.12; t < 0.9; t += 0.1) {
        const x = run.x0 + run.len * t;
        if (!sh && shelves < many) {
          const p = run.near(x, 0.95, 1.3, 1.8, 0.27, 0.15);
          if (p) {
            wallShelf(k, run.at(p.x, p.z), 0, 0.9, 1.5, rnd);
            run.take(p.x, 0.95, 1.3, 1.8);
            shelves++;
            sh = true;
            continue;
          }
        }
        if (!ap && aprons < many && (r.kind === 'dirty' || r.kind === 'bath')) {
          const p = run.near(x, 0.8, 0.8, 1.72, 0.1, 0.15);
          if (p) {
            apronHooks(k, run.at(p.x, p.z), 0, 0.75, rnd);
            run.take(p.x, 0.8, 0.8, 1.72);
            aprons++;
            ap = true;
          }
        }
      }
    }
  }
  // ---- 手袋の箱の掛け具（扉の近く）・掛け時計（扉の上の高さ） ----
  if (r.kind === 'ward' || r.kind === 'obs' || r.kind === 'treat' || r.kind === 'ns' || r.kind === 'med' || r.kind === 'dirty') {
    let done = false;
    for (const { run, doors } of runs) {
      if (done) break;
      for (const x of doors.flatMap(([a, c]) => [c + 0.75, a - 0.75, c + 1.3, a - 1.3])) {
        const p = run.near(x, 0.86, 1.2, 1.42, 0.15, 0.25);
        if (!p) continue;
        gloveRack(k, run.at(p.x, p.z), 0, 1.32);
        run.take(p.x, 0.86, 1.2, 1.42);
        done = true;
        break;
      }
    }
  }
  // （スタッフ室・カンファレンス室・薬剤準備室は置く物の決まりに時計がある）
  if (!wet && r.kind !== 'stair' && r.kind !== 'staff' && r.kind !== 'conf' && r.kind !== 'med') {
    for (const { run } of [...runs].sort(() => rnd() - 0.5)) {
      const p = run.near(run.x0 + run.len * (0.3 + rnd() * 0.4), 0.36, 1.95, 2.3, 0.05, 0.6);
      if (!p) continue;
      wallClock(k, run.at(p.x, p.z), 0, 2.12);
      run.take(p.x, 0.36, 1.95, 2.3);
      break;
    }
  }
  // ---- 当たり止めの帯（ベッド・ストレッチャーの通る部屋。家具の無い区間だけ）----
  if (r.kind === 'ward' || r.kind === 'obs' || r.kind === 'treat' || r.kind === 'ev' || r.kind === 'equip' || r.kind === 'day' || r.kind === 'dirty') {
    for (const { run } of runs)
      for (const [a, c] of run.spans(0.88, 0.1)) {
        if (c - a < 0.7) continue;
        // 3 つの高さで同じ面か（帯の幅の分）
        const zs = [a + 0.05, (a + c) / 2, c - 0.05].map((x) => run.face(x, 0.88));
        if (zs.some((z) => z === null || Math.abs(z - zs[1]!) > 0.006)) continue;
        for (const [p, q] of run.freeParts(a, c, 0.8, 0.96)) {
          if (q - p < 0.6) continue;
          bumper(k, run.at(0, zs[1]!), p + 0.02, q - 0.02, 0.88);
          run.take((p + q) / 2, q - p, 0.8, 0.96);
        }
      }
  }
  // ---- 紙の束・コンセント・壁の傷（全部の壁） ----
  for (const { run } of runs) {
    // 紙の束: 約 1.6〜3 m おき（部屋の種類の割合で間引く）
    for (let x = run.x0 + 0.3 + rnd() * 0.8; x < run.x1 - 0.3; x += 1.1 + rnd() * 1.6) {
      if (rnd() > rate * 1.4) continue;
      const w = wet ? 0.25 + rnd() * 0.2 : 0.35 + rnd() * 0.6;
      const h = wet ? 0.3 + rnd() * 0.1 : 0.32 + rnd() * 0.45;
      const yc = 1.38 + rnd() * 0.32;
      const p = run.near(x, w, yc - h / 2, yc + h / 2, 0.01, 0.3);
      if (!p) continue;
      const n = wet ? 1 : Math.max(1, Math.round(1 + rnd() * (w * h) / 0.06));
      paperCluster(k, run.at(p.x, p.z), 0, yc, w, h, n, rnd);
      run.take(p.x, w, yc - h / 2, yc + h / 2);
    }
    // コンセント
    for (let x = run.x0 + 0.5 + rnd() * 0.6; x < run.x1 - 0.3; x += 1.9 + rnd() * 1.2) {
      const p = run.near(x, 0.08, 0.24, 0.36, 0.02, 0.3);
      if (!p) continue;
      outlet(k, run.at(p.x, p.z), 0, 0.3);
      run.take(p.x, 0.08, 0.24, 0.36);
    }
    // 壁の白い傷は部屋の壁の材質の模様（corridor.ts の ROOM_FLECKS）
  }
  // ---- 天井: 吹き出し口・スプリンクラー・点検口・スピーカー ----
  if (o.ceil !== false) dressCeiling(k, b, probe, ctx, [x0, z0, x1, z1], r.h, rnd, o.vis ?? null, (o.floorY ?? 0));
  // ---- 床: 紙くず・落ちた紙 ----
  if (o.floor !== false) dressFloor(k, b, probe, ctx, [x0, z0, x1, z1], o.floorY ?? 0, rnd, o.vis ?? null, (x1 - x0) * (z1 - z0) * (wet ? 0.12 : 0.32), o.clip);
}

/** 壁の白い傷 1 本（mount の座標系） */
function fleck(s: Leg, mat: M, x: number, y: number, r: () => number, zone: LegId): void {
  const L = zone === 'D' ? 0.15 + r() * 0.45 : 0.03 + r() * r() * 0.3;
  const W = 0.01 + r() * 0.018;
  const vertical = zone === 'D' || r() < 0.6;
  const th = (vertical ? Math.PI / 2 : 0) + (r() - 0.5) * (zone === 'C' ? 0.9 : 0.3);
  const d = [Math.cos(th), Math.sin(th)];
  const p = [-Math.sin(th), Math.cos(th)];
  const pt = (a: number, b: number): V3 => [x + d[0] * a + p[0] * b, y + d[1] * a + p[1] * b, 0.004];
  s.quad(mat, pt(-L / 2, -W / 2), pt(L / 2, -W / 2), pt(L / 2, W / 2), pt(-L / 2, W / 2));
}

/** 天井の飾り（長方形 rect の中。h は天井の高さ） */
export function dressCeiling(k: Kit, b: Builder, probe: Probe, ctx: SceneContext, rect: [number, number, number, number], h: number, rnd: () => number, vis: RefVis | null, y0 = 0): void {
  const [x0, z0, x1, z1] = rect;
  const W = x1 - x0;
  const D = z1 - z0;
  const s = new Leg(b, ctx, [0, y0, 0], CAM0, 0);
  const nx = Math.max(1, Math.round(W / 1.7));
  const nz = Math.max(1, Math.round(D / 1.7));
  let hatched = false;
  let spoke = W * D < 14;
  const visOk = (x: number, z: number, rr: number): boolean => !vis || !squareVisible(vis, x, z, rr, y0 + h - 0.01, y0 + h - 0.12);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = x0 + (W * (i + 0.2 + rnd() * 0.6)) / nx;
      const z = z0 + (D * (j + 0.2 + rnd() * 0.6)) / nz;
      const t = rnd();
      if (!hatched && t < 0.3) {
        if (ceilFree(probe, x, z, y0 + h, 0.3) && visOk(x, z, 0.3)) {
          hatch(k, s, x, z, h, 0.45);
          hatched = true;
          continue;
        }
      }
      if (!spoke && t > 0.85) {
        if (ceilFree(probe, x, z, y0 + h, 0.14) && visOk(x, z, 0.14)) {
          speaker(k, s, x, z, h);
          spoke = true;
          continue;
        }
      }
      if (t < 0.55) {
        if (ceilFree(probe, x, z, y0 + h, 0.3) && visOk(x, z, 0.3)) diffuser(k, s, x, z, h, 0.5);
      } else if (t < 0.9) {
        if (ceilFree(probe, x, z, y0 + h, 0.06) && visOk(x, z, 0.06)) sprinkler(k, s, x, z, h);
      }
    }
}

/** 床の紙くず（長方形 rect の中に約 count 枚。壁ぎわに多く） */
export function dressFloor(k: Kit, b: Builder, probe: Probe, ctx: SceneContext, rect: [number, number, number, number], y0: number, rnd: () => number, vis: RefVis | null, count: number, clip?: (x: number, z: number) => boolean): void {
  const [x0, z0, x1, z1] = rect;
  const s = new Leg(b, ctx, [0, y0, 0], CAM0, 0);
  const n = Math.round(Math.min(18, count));
  for (let i = 0; i < n * 2 && i < 60; i++) {
    let x: number;
    let z: number;
    if (rnd() < 0.55) {
      // 壁ぎわ（0.05〜0.6 m）
      const e = Math.floor(rnd() * 4);
      const t = rnd();
      const d = 0.08 + rnd() * 0.5;
      x = e === 0 ? x0 + d : e === 1 ? x1 - d : x0 + (x1 - x0) * t;
      z = e === 2 ? z0 + d : e === 3 ? z1 - d : z0 + (z1 - z0) * t;
    } else {
      x = x0 + 0.2 + rnd() * (x1 - x0 - 0.4);
      z = z0 + 0.2 + rnd() * (z1 - z0 - 0.4);
    }
    if (clip && !clip(x, z)) continue;
    const big = rnd() < 0.12;
    const w = big ? 0.21 : 0.04 + rnd() * 0.1;
    const d = big ? 0.29 : 0.02 + rnd() * 0.05;
    if (!floorFree(probe, x, z, y0, 0, 0.25)) continue;
    if (vis && vis.anyVisible([new THREE.Vector3(x, y0 + 0.02, z), new THREE.Vector3(x + w / 2, y0 + 0.02, z + d / 2), new THREE.Vector3(x - w / 2, y0 + 0.02, z - d / 2)])) continue;
    scrap(k, s, x, z, w, d, rnd() * Math.PI);
    if (--count <= 0) break;
  }
}

// ---------------------------------------------------------------- 廊下（目の後ろ・角・柱型の陰）

export interface LegDressOpts {
  vis: RefVis;
  /** 柱型を立てる区域の z の範囲（目の後ろ）と出っ張り */
  pilaster?: { from: number; depth: number };
  /** 区域の天井の高さ */
  h: number;
}

/** 廊下の壁の座標系（区域の座標の leg から）。side: 左・右の壁、または角の奥の壁 */
function legRuns(L: LegDef, leg: Leg, probe: Probe, vis: RefVis): { kind: 'left' | 'right' | 'end'; run: WallRun }[] {
  const out: { kind: 'left' | 'right' | 'end'; run: WallRun }[] = [];
  const mk = (origin: V3, yaw: number): Leg => new Leg(leg.b, leg.ctx, leg.w(origin), leg.cam, leg.yaw + yaw);
  const o = { start: 1.0, minOut: -0.9, maxOut: 0.6, vis };
  // 左の壁: 区域の +x を向く。座標系の x = -区域の z
  out.push({ kind: 'left', run: new WallRun(mk([L.left, 0, 0], Math.PI / 2), -(L.cornerEnd - 0.05), -(L.end + 0.3), probe, o) });
  out.push({ kind: 'right', run: new WallRun(mk([L.right, 0, 0], -Math.PI / 2), L.end + 0.3, L.cornerEnd - 0.05, probe, o) });
  // 角の奥の壁（区域の -z を向く）: 座標系の x = -区域の x
  out.push({ kind: 'end', run: new WallRun(mk([0, 0, L.cornerEnd], Math.PI), -(L.right + 1.2), -(L.left - 0.1), probe, { ...o, minOut: -0.2 }) });
  return out;
}

export function dressLeg(env: DressEnv, L: LegDef, leg: Leg, doorsRoot: THREE.Object3D, o: LegDressOpts, seed: number): void {
  const { ctx } = env;
  const k = kitFor(env.mats, L.id, env.atlas, env.paperMat);
  const dec = zoneDecals(env.mats, L.id);
  const rnd = rng(seed);
  const vis = o.vis;
  // 調べる範囲: 廊下と角の全体
  const a = leg.w([L.left - 1.0, -0.2, L.end - 0.5]);
  const c = leg.w([L.right + 1.4, o.h + 0.5, L.cornerEnd + 0.5]);
  const box = new THREE.Box3(new THREE.Vector3(Math.min(a[0], c[0]), -0.3, Math.min(a[2], c[2])), new THREE.Vector3(Math.max(a[0], c[0]), o.h + 0.6, Math.max(a[2], c[2])));
  const probe = new Probe([leg.b.root, doorsRoot]).focus(box);
  let runs = legRuns(L, leg, probe, vis);

  // ---- 柱型（目の後ろ。約 2.6〜3.2 m おき）----
  if (o.pilaster) {
    const pl = o.pilaster;
    for (const { kind, run } of runs) {
      if (kind === 'end') continue;
      // 区域の z ≥ from の所だけ（左の壁は x = -z）
      const xa = kind === 'left' ? Math.max(run.x0, -(L.back - 0.25)) : Math.max(run.x0, pl.from);
      const xb = kind === 'left' ? Math.min(run.x1, -pl.from) : Math.min(run.x1, L.back - 0.25);
      for (let x = xa + 0.6 + rnd() * 0.5; x < xb - 0.3; ) {
        const w = 0.4;
        const z = run.fit(x, w, 0.06, o.h - 0.06, pl.depth);
        if (z === null || run.lastMat === null) {
          x += 0.2;
          continue;
        }
        const m = run.lastMat;
        const s = run.at(x, z);
        s.faces([-w / 2, 0, -0.02], [w / 2, o.h, pl.depth], { pz: m, px: m, nx: m }, { collide: true });
        // 足元の帯（柱型の 3 面）
        bandAround(s, dec, w, pl.depth);
        run.take(x, w + 0.2, 0, o.h);
        x += 2.6 + rnd() * 0.6;
      }
    }
    // 柱型を足したので調べ直す
    probe.refresh();
    runs = legRuns(L, leg, probe, vis);
    for (const rr of runs) rr.run.used.length = 0;
  }

  for (const { kind, run } of runs) {
    // 扉の横の名札・消毒液（壁が切れる所 = 扉・開口。幅 0.7〜2.6 m の切れ目）
    const sp = run.spans(1.0);
    for (let i = 0; i + 1 < sp.length; i++) {
      const gap: [number, number] = [sp[i][1], sp[i + 1][0]];
      const gw = gap[1] - gap[0];
      if (gw < 0.7 || gw > 2.7) continue;
      for (const [x, sg] of [[gap[0] - 0.22, -1], [gap[1] + 0.22, 1]] as [number, number][]) {
        const p = run.near(x, 0.32, 1.58, 1.72, 0.01, 0.12);
        if (p) {
          namePlate(k, run.at(p.x, p.z), 0, 1.65);
          run.take(p.x, 0.32, 1.58, 1.72);
        }
        const q = run.near(x + sg * 0.05, 0.12, 1.07, 1.23, 0.02, 0.12);
        if (q && rnd() < 0.6) {
          switchPlate(k, run.at(q.x, q.z), 0, 1.15, rnd() < 0.5 ? 2 : 1);
          run.take(q.x, 0.12, 1.07, 1.23);
        } else {
          const ds = run.near(x + sg * 0.05, 0.16, 0.95, 1.3, 0.11, 0.15);
          if (ds) {
            dispenser(k, run.at(ds.x, ds.z), 0, 1.12);
            run.take(ds.x, 0.16, 0.95, 1.3);
          }
        }
      }
    }
    // 掲示板（A はコルク・D は青緑。目の後ろの長い壁に 1 つ）
    if ((L.id === 'A' || L.id === 'D') && kind !== 'end' && rnd() < 0.8) {
      const w = 0.9 + rnd() * 0.5;
      const h = 0.65 + rnd() * 0.25;
      for (let t = 0.15; t < 0.9; t += 0.08) {
        const x = run.x0 + run.len * t;
        const p = run.fit(x, w + 0.1, 1.45 - h / 2 - 0.05, 1.45 + h / 2 + 0.05, 0.04);
        if (p === null) continue;
        board(k, run.at(x, p), 0, 1.45, w, h, rnd);
        run.take(x, w + 0.1, 1.45 - h / 2 - 0.05, 1.45 + h / 2 + 0.05);
        break;
      }
    }
    // 発信機（左右の壁に 1 つずつまで）
    if (kind !== 'end' && rnd() < 0.75)
      for (let t = 0.3 + rnd() * 0.3; t < 1.0; t += 0.07) {
        const x = run.x0 + run.len * t;
        const p = run.fit(x, 0.24, 1.2, 1.65, 0.07);
        if (p === null) continue;
        alarmBox(k, run.at(x, p), 0, 1.35, o.h);
        run.take(x, 0.24, 1.2, o.h);
        break;
      }
    // 屋内消火栓（左の壁。廊下に 1 つ）
    if (kind === 'left')
      for (let t = 0.05 + rnd() * 0.3; t < 1.0; t += 0.05) {
        const x = run.x0 + run.len * t;
        const p = run.fit(x, 0.8, 0.2, 1.6, 0.2);
        if (p === null) continue;
        hydrant(k, run.at(x, p), 0);
        run.take(x, 0.8, 0, 1.6);
        break;
      }
    // 消火器（床。廊下に 1 つ）
    if (kind === 'right' || kind === 'end')
      for (let t = 0.1 + rnd() * 0.4; t < 1.0; t += 0.06) {
        const x = run.x0 + run.len * t;
        const p = run.fit(x, 0.34, 0.06, 1.12, 0.28);
        if (p === null) continue;
        extinguisher(k, run.at(x, p), 0);
        run.take(x, 0.34, 0, 1.12);
        break;
      }
    // 紙の束（参考画像の廊下の密度: 約 1.5〜2.5 m おき）
    for (let x = run.x0 + 0.2 + rnd() * 0.6; x < run.x1 - 0.2; x += 0.7 + rnd() * 1.2) {
      const w = 0.3 + rnd() * 0.7;
      const h = 0.3 + rnd() * 0.5;
      const yc = 1.35 + rnd() * 0.45;
      const p = run.near(x, w, yc - h / 2, yc + h / 2, 0.01, 0.35);
      if (!p) continue;
      paperCluster(k, run.at(p.x, p.z), 0, yc, w, h, Math.max(1, Math.round(1 + rnd() * (w * h) / 0.05)), rnd);
      run.take(p.x, w, yc - h / 2, yc + h / 2);
    }
    // スイッチ・コンセント・小さな板
    for (let x = run.x0 + 0.4 + rnd(); x < run.x1 - 0.3; x += 1.6 + rnd() * 1.6) {
      const p = run.near(x, 0.08, 0.24, 0.36, 0.02, 0.3);
      if (p) {
        outlet(k, run.at(p.x, p.z), 0, 0.3);
        run.take(p.x, 0.08, 0.24, 0.36);
      }
      if (rnd() < 0.35) {
        const q = run.near(x + 0.3, 0.12, 1.07, 1.23, 0.02, 0.3);
        if (q) {
          switchPlate(k, run.at(q.x, q.z), 0, 1.15, 1 + Math.floor(rnd() * 3));
          run.take(q.x, 0.12, 1.07, 1.23);
        }
      }
    }
    // 壁の白い傷（区域の描き方の密度）
    const nf = Math.round(run.len * (L.id === 'C' ? 5 : L.id === 'D' ? 4 : L.id === 'B' ? 2.5 : 2));
    for (let i = 0; i < nf; i++) {
      const x = run.x0 + 0.05 + rnd() * (run.len - 0.1);
      const y = 0.25 + rnd() * (o.h - 0.6);
      const z = run.face(x, y);
      if (z === null || !run.hidden(x, 0.06, y - 0.15, y + 0.15, z, 0)) continue;
      fleck(run.at(x, z), dec.fleck, 0, y, rnd, L.id);
    }
  }

  // ---- 天井（廊下の中ほどの帯）: 吹き出し口・スプリンクラー・感知器・監視カメラ ----
  const s0 = new Leg(leg.b, ctx, [0, 0, 0], CAM0, 0);
  for (let z = L.end + 0.8 + rnd(); z < L.cornerEnd - 0.4; z += 1.0 + rnd() * 1.3) {
    const x = (rnd() - 0.5) * 1.6;
    const p = leg.w([x, 0, z]);
    const t = rnd();
    const rr = t < 0.35 ? 0.3 : t < 0.45 ? 0.15 : 0.08;
    if (!ceilFree(probe, p[0], p[2], o.h, rr)) continue;
    if (squareVisible(vis, p[0], p[2], rr, o.h - 0.01, o.h - 0.3)) continue;
    if (t < 0.35) diffuser(k, s0, p[0], p[2], o.h, 0.5);
    else if (t < 0.45) domeCamK(k, s0, p[0], p[2], o.h, 0.9);
    else if (t < 0.7) smokeDet(k, s0, p[0], p[2], o.h);
    else sprinkler(k, s0, p[0], p[2], o.h);
  }
  // 角の吊り下げの非常口の表示（角の真ん中）
  {
    const p = leg.w([(L.left + L.right) / 2, 0, (L.back + L.cornerEnd) / 2]);
    if (ceilFree(probe, p[0], p[2], o.h, 0.08) && !squareVisible(vis, p[0], p[2], 0.3, o.h - 0.3, o.h - 0.45)) {
      const sx = new Leg(leg.b, ctx, p, CAM0, leg.yaw);
      exitHanging(k, sx, 0, 0, o.h);
    }
  }

  // ---- 床: 紙くず・置きっぱなしの物 ----
  const fr = (() => {
    const p = leg.w([L.left, 0, L.end]);
    const q = leg.w([L.right, 0, L.cornerEnd]);
    return [Math.min(p[0], q[0]), Math.min(p[2], q[2]), Math.max(p[0], q[0]), Math.max(p[2], q[2])] as [number, number, number, number];
  })();
  dressFloor(k, leg.b, probe, ctx, fr, 0, rnd, vis, 22);
  // 置きっぱなしの物（目の後ろの壁ぎわに 1〜3 個。扉の前・角は空ける）
  {
    const kinds = ['box', 'pole', 'device', 'bin', 'box', 'pole'];
    let placed = 0;
    const want = 1 + Math.floor(rnd() * 2.5);
    for (let tries = 0; tries < 40 && placed < want; tries++) {
      const rr = runs[rnd() < 0.5 ? 0 : 1];
      const zl = 0.8 + rnd() * Math.max(0.1, L.back - 1.4);
      const x = rr.kind === 'left' ? -zl : zl;
      // 後ろが壁（扉でない）
      const zf = rr.run.fit(x, 0.7, 0.1, 0.9, 0);
      if (zf === null) continue;
      const s = rr.run.at(x, zf + 0.3);
      const p = s.w([0, 0, 0]);
      if (!floorFree(probe, p[0], p[2], 0, 0.28, 0.9)) continue;
      if (squareVisible(vis, p[0], p[2], 0.45, 0.05, 0.8)) continue;
      const sr = new Leg(leg.b, ctx, p, CAM0, s.yaw + (rnd() - 0.5) * 0.5);
      const kd = kinds[Math.floor(rnd() * kinds.length)];
      if (kd === 'box') boxStack(k, sr, rnd);
      else if (kd === 'pole') {
        lowPole(k, sr, -0.15, 0);
        lowPole(k, sr, 0.2, 0.05);
      } else if (kd === 'device') floorDevice(k, sr);
      else squareBin(k, sr);
      rr.run.take(x, 0.9, 0, 0.9);
      placed++;
    }
  }
  void conduit;
  // 手すり（目の後ろと角の壁の続く区間。参考画像 corridor-0 の左の手すりと同じ高さ）
  for (const { run } of runs) {
    for (const [a, c] of run.spans(0.8, 0.1)) {
      if (c - a < 0.9) continue;
      const zs = [a + 0.05, (a + c) / 2, c - 0.05].map((x) => run.face(x, 0.8));
      if (zs.some((z) => z === null || Math.abs(z - zs[1]!) > 0.006)) continue;
      for (const [p, q] of run.freeParts(a, c, 0.7, 0.86)) {
        if (q - p < 0.9) continue;
        if (!run.hidden((p + q) / 2, q - p, 0.72, 0.84, zs[1]!, 0.09)) continue;
        handRail(k, run.at(0, zs[1]!), p + 0.03, q - 0.03, 0.8, L.id === 'C' || L.id === 'D' ? 'white' : 'plate');
        run.take((p + q) / 2, q - p, 0.7, 0.86);
      }
    }
  }
}

/** 柱型の足元の帯（区域の描き方: A〜C は床の帯、D は壁の足元の紺の帯） */
function bandAround(s: Leg, dec: ZoneDecals, w: number, d: number): void {
  const bw = dec.bandW;
  if (dec.bandOnWall) {
    const hh = 0.16;
    s.quad(dec.band, [-w / 2, 0, d + 0.003], [w / 2, 0, d + 0.003], [w / 2, hh, d + 0.003], [-w / 2, hh, d + 0.003], {}, [0, 0, 1, 1]);
    s.quad(dec.band, [w / 2 + 0.003, 0, d], [w / 2 + 0.003, 0, 0], [w / 2 + 0.003, hh, 0], [w / 2 + 0.003, hh, d]);
    s.quad(dec.band, [-w / 2 - 0.003, 0, 0], [-w / 2 - 0.003, 0, d], [-w / 2 - 0.003, hh, d], [-w / 2 - 0.003, hh, 0]);
    return;
  }
  const y = 0.003;
  // 前の面: u = 0 が柱の側、u = 1 が手前（ちぎれる縁）
  s.quad(dec.band, [-w / 2 - bw, y, d], [-w / 2 - bw, y, d + bw], [w / 2 + bw, y, d + bw], [w / 2 + bw, y, d], {}, [0, 0, 1, 1]);
  s.quad(dec.band, [w / 2, y, d], [w / 2 + bw, y, d], [w / 2 + bw, y, 0], [w / 2, y, 0]);
  s.quad(dec.band, [-w / 2, y, 0], [-w / 2 - bw, y, 0], [-w / 2 - bw, y, d], [-w / 2, y, d]);
  if (dec.bandLight) s.quad(dec.bandLight, [-w / 2 - bw, y - 0.001, d + bw - 0.02], [-w / 2 - bw, y - 0.001, d + bw + 0.08], [w / 2 + bw, y - 0.001, d + bw + 0.08], [w / 2 + bw, y - 0.001, d + bw - 0.02]);
}

/** 部屋の壁の足元の帯（区域の描き方）。sideFrame の座標系で x0〜x1 */
export function roomBand(s: Leg, dec: ZoneDecals, x0: number, x1: number): void {
  if (x1 - x0 < 0.05) return;
  if (dec.bandOnWall) {
    const hh = 0.15;
    s.quad(dec.band, [x0, 0, 0.004], [x1, 0, 0.004], [x1, hh, 0.004], [x0, hh, 0.004]);
    return;
  }
  const bw = dec.bandW;
  // u = 0 が壁の側、u = 1 が部屋の側（ちぎれる縁）。上から見て反時計回り
  s.quad(dec.band, [x0, 0.003, 0], [x0, 0.003, bw], [x1, 0.003, bw], [x1, 0.003, 0], {}, [0, 0, 1, 1]);
  if (dec.bandLight) s.quad(dec.bandLight, [x0, 0.0015, bw - 0.03], [x0, 0.0015, bw + 0.08], [x1, 0.0015, bw + 0.08], [x1, 0.0015, bw - 0.03]);
}
