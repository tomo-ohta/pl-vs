import * as THREE from 'three';
import { Prop } from '../../props/kit.ts';
import { extinguisher } from '../../props/lib/index.ts';
import type { Builder, V3 } from '../../scenes/Builder.ts';
import { stairs as stairRun } from '../kit.ts';
import type { Foam } from './foam.ts';
import { FL, STAIR, T_EXT, XN } from './layout.ts';
import { PAL, propSink } from './mats.ts';
import { bracketLight, emergencyLight, hydrantCabinet, smokeDetector } from './props/fixtures.ts';
import { artRow, carton, cleaningCabinet, cubbyLocker, deskPile, fluorescent, noticeBoard, poster, saggingCable, steelLocker, wallClock } from './props/school.ts';
import { umbrellaStand } from './props/extra.ts';
import { streakQuad, type StreakAtlas } from './streaks.ts';
import { levelMats, levelZone, wallRects, type Env, type LevelMats, type RectHole } from './shell.ts';

/**
 * 階段室（廊下の北へ出た塔。折り返しの階段。1 階〜屋上の口）。
 * 床の高さの踊り場（廊下の口の前）→ 北へ上る 1 本目 → 北の端の中の踊り場 → 南へ上る 2 本目 → 上の階の踊り場。
 * 1 階は踊り場から 1 階の廊下へ出る扉（鍵）。屋上の口は鍵（行き止まり）。
 *
 * 部位の決まり（どの階も同じ。実物の学校の階段室から）:
 * - 窓: 中の踊り場の北の壁に大きな窓（3 枚・欄間の横框）、床の踊り場の西の壁に窓（2 枚）。屋上の階は北の高窓と西の窓。
 *   窓の外の明るさは「窓の形の光だまり」（窓の前の段と踊り場・西の窓の前の床。四角く硬い縁）。2 階までの窓台に泡、3 階からはガラスの筋
 * - 壁: 腰の帯（段に沿って斜めに上がる板と見切り）・ささら幅木（段に沿う暗い帯）・壁の手すり（受け金物つき）。上は塗り
 * - 段: 踏面と蹴込み（目地の模様ではなく 1 段ずつの形）・段鼻の金物・滑り止めの溝 2 本、吹き抜け側にささら桁の板と手すり
 * - 踊り場: 床の仕上げ（タイル）と下の面（塗りのコンクリート）を分ける（下から見て床のタイルが見えない）
 * - 設備: 消火栓の箱・消火器・非常灯・煙感知器・蛍光灯・壁付けの灯り・時計・階の札・避難口の表示・掲示・配管
 */

const RISE = 1.8;
const TREAD = 0.28;
const STEPS = 11;
const RH = RISE / STEPS;
const RUN = STEPS * TREAD;

const SX0 = STAIR[0];
const SX1 = STAIR[2];
const SZ0 = STAIR[1];
const SZ1 = STAIR[3];
const ZC = (SZ0 + SZ1) / 2;
const LAND = 1.5;
const RUN_X0 = SX0 + LAND;
const RUN_X1 = RUN_X0 + RUN;
/** 1 本目（上り・北へ）と 2 本目（上り・南へ）の z の範囲 */
const FA: [number, number] = [SZ0 + 0.05, ZC - 0.08];
const FB: [number, number] = [ZC + 0.08, SZ1 - 0.05];
/** 塔の上の端（屋上の口の天井） */
const TOP = FL[3] + 2.6;

interface TowerWin {
  /** 'n' = 北の壁（x = SX1 の外。内は -x）、'w' = 西の壁（z = SZ0 の外。内は +z） */
  wall: 'n' | 'w';
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  panes: number;
  transom?: number;
  lv: number;
}

/** 塔の窓（階ごとの決まり） */
export function towerWindows(): TowerWin[] {
  const out: TowerWin[] = [];
  for (let lv = 1; lv <= 3; lv++) {
    const fl = FL[lv - 1];
    out.push({ wall: 'n', u0: SZ0 + 0.5, u1: SZ1 - 0.5, y0: fl + RISE + 0.8, y1: fl + RISE + 2.55, panes: 3, transom: fl + RISE + 2.1, lv });
    out.push({ wall: 'w', u0: SX0 + 0.25, u1: RUN_X0 - 0.1, y0: fl + 1.0, y1: fl + 2.6, panes: 2, lv });
  }
  const fl = FL[3];
  out.push({ wall: 'n', u0: SZ0 + 0.9, u1: SZ1 - 0.9, y0: fl + 1.1, y1: fl + 2.2, panes: 3, lv: 4 });
  out.push({ wall: 'w', u0: SX0 + 0.25, u1: RUN_X0 - 0.1, y0: fl + 1.0, y1: fl + 2.3, panes: 2, lv: 4 });
  return out;
}

/** 壁の座標（u = 壁に沿った位置・y・d = 壁の中心から内への距離）→ 場面の点 */
function wp(w: 'n' | 'w', u: number, y: number, d: number): V3 {
  return w === 'n' ? [SX1 + T_EXT / 2 - d, y, u] : [u, y, SZ0 - T_EXT / 2 + d];
}
function wbox(b: Builder, m: THREE.Material, w: 'n' | 'w', u0: number, u1: number, y0: number, y1: number, d0: number, d1: number, shadow: boolean | 'receive' = true): void {
  const a = wp(w, u0, y0, d0);
  const c = wp(w, u1, y1, d1);
  b.boxMM(m, [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])], [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])], { shadow });
}

/** 塔の窓 1 つ: 枠・竪框・欄間の横框・内の窓台・ガラス・当たり判定 */
function towerWindow(env: Env, lm: LevelMats, w: TowerWin): void {
  const { b, ctx } = env;
  const fw = 0.05;
  wbox(b, lm.frame, w.wall, w.u0, w.u1, w.y0, w.y0 + fw, -0.05, 0.05);
  wbox(b, lm.frame, w.wall, w.u0, w.u1, w.y1 - fw, w.y1, -0.05, 0.05);
  wbox(b, lm.frame, w.wall, w.u0, w.u0 + fw, w.y0, w.y1, -0.05, 0.05);
  wbox(b, lm.frame, w.wall, w.u1 - fw, w.u1, w.y0, w.y1, -0.05, 0.05);
  for (let k = 1; k < w.panes; k++) {
    const uc = w.u0 + (k * (w.u1 - w.u0)) / w.panes;
    wbox(b, lm.frame, w.wall, uc - 0.025, uc + 0.025, w.y0, w.y1, -0.05, 0.05);
  }
  if (w.transom !== undefined) wbox(b, lm.frame, w.wall, w.u0, w.u1, w.transom, w.transom + 0.04, -0.05, 0.05);
  // 内の窓台（壁の内の面から 8 cm 出る）
  wbox(b, lm.sill, w.wall, w.u0 - 0.05, w.u1 + 0.05, w.y0 - 0.04, w.y0, 0, T_EXT / 2 + 0.08);
  const c = wp(w.wall, (w.u0 + w.u1) / 2, (w.y0 + w.y1) / 2, 0);
  b.plane(lm.glass, c, w.u1 - w.u0, w.y1 - w.y0, w.wall === 'n' ? '-x' : 'z', { shadow: false, layer: 1 });
  const a = wp(w.wall, w.u0, w.y0, -0.06);
  const e = wp(w.wall, w.u1, w.y1, 0.06);
  ctx.colliders.add({ x: Math.min(a[0], e[0]), y: a[1], z: Math.min(a[2], e[2]) }, { x: Math.max(a[0], e[0]), y: e[1], z: Math.max(a[2], e[2]) });
}

/** 段に沿う板（壁の面 z = zf に平行。輪郭は x-y の多角形）。厚さ t は +z へ（dir = -1 で -z へ） */
function profilePlate(b: Builder, m: THREE.Material, pts: [number, number][], zf: number, t: number, dir: 1 | -1, shadow: boolean | 'receive' = 'receive'): void {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false });
  if (dir < 0) g.translate(0, 0, -t);
  g.translate(0, 0, zf);
  b.mesh(g, m, [0, 0, 0], { shadow });
}

/**
 * 1 本の段の、段鼻を結ぶ線の輪郭（x の小さい方から）。上り +x（1 本目）か -x（2 本目）。
 * lo = 段鼻の線から下へ、hi = 上へ。始まりの床と終わりの踊り場で水平に切る
 */
function flightBand(y0: number, dir: 1 | -1, lo: number, hi: number, floorClip = true): [number, number][] {
  // 段鼻の線: 1 段目の段鼻（高さ y0 + RH）から最後の段鼻（y0 + RISE）まで
  const xs = dir > 0 ? RUN_X0 : RUN_X1;
  const xe = dir > 0 ? RUN_X0 + (STEPS - 1) * TREAD : RUN_X1 - (STEPS - 1) * TREAD;
  const xEnd = dir > 0 ? RUN_X1 : RUN_X0;
  const top: [number, number][] = [
    [xs, y0 + RH + hi],
    [xe, y0 + RISE + hi],
    [xEnd, y0 + RISE + hi],
  ];
  const bot: [number, number][] = [
    [xEnd, y0 + RISE - lo],
    [xs, floorClip ? Math.max(y0, y0 + RH - lo) : y0 + RH - lo],
  ];
  const pts = [...top, ...bot];
  // 反時計回り（x-y で）にそろえる
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [cx, cy] = pts[(i + 1) % pts.length];
    area += ax * cy - cx * ay;
  }
  return area < 0 ? pts.reverse() : pts;
}

export interface StairHooks {
  /** 2 階までの窓台の泡（窓の壁が逆向きの写し）。共通の Foam */
  foam: Foam;
  /** 3 階からのガラスの筋 */
  streaks: StreakAtlas;
}

export function buildMainStair(env: Env, hooks: StairHooks): void {
  const { b, mats, ctx } = env;
  const wins = towerWindows();
  const holes = (wall: 'n' | 'w'): RectHole[] => wins.filter((w) => w.wall === wall).map((w) => ({ u0: w.u0, u1: w.u1, y0: w.y0, y1: w.y1 }));
  let cell = 3;
  for (let lv = 1; lv <= 4; lv++) {
    const fl = FL[lv - 1];
    const zone = levelZone(Math.min(lv, 3));
    const lm = levelMats(mats, zone);
    const y1 = lv === 4 ? TOP : fl + 3.6;
    // 壁（北・西・東）。窓は階をまたぐので、塔の全部の窓を穴として渡す
    wallRects(b, lm.ext, 'z', SX1 + T_EXT / 2, SZ0 - T_EXT, SZ1 + T_EXT, fl, y1, T_EXT, holes('n'));
    wallRects(b, lm.ext, 'x', SZ0 - T_EXT / 2, XN + T_EXT, SX1 + T_EXT, fl, y1, T_EXT, holes('w'));
    wallRects(b, lm.ext, 'x', SZ1 + T_EXT / 2, XN + T_EXT, SX1 + T_EXT, fl, y1, T_EXT, []);
    // 1 階と屋上: 廊下の口の代わりの壁と扉（鍵）
    if (lv === 1 || lv === 4) {
      wallRects(b, lm.ext, 'z', XN + T_EXT / 2, SZ0, SZ1, fl, y1, T_EXT, [{ u0: ZC - 0.5, u1: ZC + 0.5, y0: fl, y1: fl + 2.05 }]);
      steelDoor(b, lm, XN + T_EXT / 2, fl, ZC, env, lv === 4);
      // 屋上の扉の網入りガラスの窓から入る外の明るさ（扉の前の床の四角い光だまり）
      if (lv === 4) ctx.addLamp({ pos: [XN + T_EXT + 0.3, fl + 1.6, ZC], radius: 3.2, intensity: 0.85, box: [XN + T_EXT + 0.02, fl - 0.1, ZC - 0.32, RUN_X0, fl + 1.9, ZC + 0.32], square: true, hard: true, color: '#d8f8ff', shadow: 0 });
    }
    // 床の高さの踊り場（仕上げのタイルと、下の塗りの面）。1 階は段の下まで床
    b.boxMM(lm.floorCorr, [SX0 - 0.02, fl - 0.02, SZ0], [RUN_X0, fl, SZ1], { collide: true, shadow: 'receive' });
    b.boxMM(lm.wall, [SX0 - 0.02, fl - 0.3, SZ0], [RUN_X0, fl - 0.02, SZ1], { collide: true, shadow: 'receive' });
    if (lv === 1) b.boxMM(lm.floorCorr, [RUN_X0, fl - 0.3, SZ0], [SX1, fl, SZ1], { collide: true, shadow: 'receive' });
    // 窓（この階の）
    for (const w of wins.filter((q) => q.lv === lv)) {
      towerWindow(env, lm, w);
      if (w.wall !== 'n') continue;
      // 北の窓: 2 階までは窓台に泡、3 階からはガラスの筋（廊下の北の窓と同じ決まり）
      if (lv <= 2) {
        const spec = { sill: w.y0 - fl, head: w.y1 - fl, transom: [w.y1 - fl, w.y1 - fl] as [number, number], pier0: 0, pierW: 0.3, sashes: w.panes, mullW: 0.05, pierProj: 0, ledge: 0.2, split: [1 / 3, 2 / 3] };
        hooks.foam.bay(fl, spec, w.u0, w.u1, 0.45, 970 + lv, SX1 + T_EXT / 2 - 0.12);
      } else {
        for (let k = 0; k < w.panes; k++) {
          const a = w.u0 + (k * (w.u1 - w.u0)) / w.panes + 0.03;
          const c = w.u0 + ((k + 1) * (w.u1 - w.u0)) / w.panes - 0.03;
          b.mesh(streakQuad(SX1 + T_EXT / 2 - 0.012, (w.y0 + w.y1) / 2, (a + c) / 2, c - a, w.y1 - w.y0, cell++ % 16, cell % 2 === 0), hooks.streaks.mat, [0, 0, 0], { shadow: true, layer: 1 });
        }
      }
    }
    // 窓の形の光だまり: 西の窓の前の床（四角く硬い縁）
    ctx.addLamp({ pos: [(SX0 + RUN_X0) / 2, fl + 1.9, SZ0 + 0.2], radius: 3.4, intensity: 0.85, box: [SX0 + 0.04, fl - 0.1, SZ0 + 0.03, RUN_X0 + 0.25, fl + 2.7, SZ0 + 2.1], square: true, hard: true, color: '#d8f8ff', shadow: 0 });
    if (lv === 4) {
      // 屋上の口: 吹き抜けの縁の手すり（縦の桟）と当たり判定
      for (let z = SZ0 + 0.06; z < ZC + 0.08; z += 0.11) b.boxMM(lm.frame, [RUN_X0 + 0.02, fl, z - 0.008], [RUN_X0 + 0.036, fl + 0.95, z + 0.008], { shadow: true });
      b.cyl(lm.frame, [RUN_X0 + 0.028, fl + 0.97, (SZ0 + ZC + 0.08) / 2], 0.025, ZC + 0.08 - SZ0, { axis: 'z', shadow: true });
      ctx.colliders.add({ x: RUN_X0, y: fl, z: SZ0 }, { x: RUN_X0 + 0.06, y: fl + 1.0, z: ZC + 0.08 });
      // 屋上の口: 天井（塗り）と、北の高窓から下の段へ落ちる明るさ
      b.boxMM(lm.wall, [SX0, TOP, SZ0], [SX1, TOP + 0.2, SZ1], { shadow: true });
      ctx.addLamp({ pos: [SX1 - 0.3, fl + 1.2, ZC], radius: 4.6, intensity: 0.8, box: [RUN_X0 - 0.2, FL[2] + 2.4, SZ0 + 0.9, SX1 - 0.01, TOP - 0.05, SZ1 - 0.9], square: true, hard: true, color: '#d8f8ff', shadow: 0 });
      dressLevel(env, lm, lv, fl);
      continue;
    }
    // 北の窓の明るさ: 窓の前の段（1 本目の上の方・2 本目の下の方）と中の踊り場（四角く硬い縁。窓の幅だけ）
    ctx.addLamp({ pos: [SX1 - 0.2, fl + RISE + 1.7, ZC], radius: 4.4, intensity: 0.85, box: [RUN_X1 - 2.6, fl + 0.5, SZ0 + 0.5, SX1 - 0.01, fl + 3.25, SZ1 - 0.5], square: true, hard: true, color: '#d8f8ff', shadow: 0 });
    // 床の踊り場の床の明るさ（天井の蛍光灯の下の四角い光だまり。床だけ: 壁と天井に丸い縁の塊を作らない）
    ctx.addLamp({ pos: [SX0 + 0.75, fl + 1.3, ZC], radius: 3.6, intensity: 0.75, box: [SX0 + 0.05, fl - 0.1, SZ0 + 0.3, RUN_X0 + 0.5, fl + 0.6, SZ1 - 0.3], down: true, square: true, hard: true, color: '#bfe8f0', shadow: 0 });
    // 段（1 本目 fl → fl + 1.8・北の踊り場・2 本目 fl + 1.8 → fl + 3.6）。踏面と蹴込みは 1 段ずつの形（目地の模様なし）
    const P = PAL[zone];
    const treadM = mats.get(zone, P.frame.color, { shade: P.frame.shade, dark: P.frame.dark, key: 'tread2' });
    stairRun(b, treadM, [RUN_X0, fl, (FA[0] + FA[1]) / 2], '+x', RISE, FA[1] - FA[0], { tread: TREAD });
    b.boxMM(lm.floorCorr, [RUN_X1, fl + RISE - 0.02, SZ0], [SX1, fl + RISE, SZ1], { collide: true, shadow: true });
    b.boxMM(lm.wall, [RUN_X1, fl + RISE - 0.25, SZ0], [SX1, fl + RISE - 0.02, SZ1], { collide: true, shadow: true });
    stairRun(b, treadM, [RUN_X1, fl + RISE, (FB[0] + FB[1]) / 2], '-x', RISE, FB[1] - FB[0], { tread: TREAD });
    // 段の下の斜めの板（下の階から見た段の裏。塗り）
    for (const [za, zb, y0, dir] of [[FA[0], FA[1], fl, 1], [FB[0], FB[1], fl + RISE, -1]] as [number, number, number, number][]) {
      const len = Math.hypot(RUN, RISE);
      const g = new THREE.BoxGeometry(len, 0.12, zb - za);
      g.rotateZ(Math.atan2(RISE, RUN) * dir);
      g.translate((RUN_X0 + RUN_X1) / 2, y0 + RISE / 2 - 0.2, (za + zb) / 2);
      b.mesh(g, lm.wall, [0, 0, 0], { shadow: true });
    }
    const sheet = mats.get(zone, P.floor.color, { shade: P.floor.shade, dark: P.floor.dark, key: 'treadsheet' });
    stepDetails(env, lm, fl, sheet);
    flightSides(env, lm, fl);
    dressLevel(env, lm, lv, fl);
  }
}

/**
 * 踏面の仕上げ（床と同じ長尺シートの色: 窓の明るさを受けると床の日なたと同じ明るさ）・段鼻の金物・滑り止めの溝（段ごと）
 */
function stepDetails(env: Env, lm: LevelMats, fl: number, sheet: THREE.Material): void {
  const { b } = env;
  for (let i = 0; i < STEPS; i++) {
    // 1 本目（+x へ上る。段鼻は x の小さい方の縁）
    const ya = fl + (i + 1) * RH;
    const xa = RUN_X0 + i * TREAD;
    b.boxMM(sheet, [xa + 0.03, ya - 0.004, FA[0]], [xa + TREAD, ya + 0.002, FA[1]], { shadow: 'receive' });
    b.boxMM(lm.frame, [xa - 0.006, ya - 0.03, FA[0]], [xa + 0.035, ya + 0.004, FA[1]], { shadow: 'receive' });
    for (const k of [0.055, 0.075]) b.boxMM(lm.base, [xa + k, ya, FA[0] + 0.04], [xa + k + 0.01, ya + 0.004, FA[1] - 0.04], { shadow: 'receive' });
    // 2 本目（-x へ上る。段鼻は x の大きい方の縁）
    const yb = fl + RISE + (i + 1) * RH;
    const xb = RUN_X1 - i * TREAD;
    b.boxMM(sheet, [xb - TREAD, yb - 0.004, FB[0]], [xb - 0.03, yb + 0.002, FB[1]], { shadow: 'receive' });
    b.boxMM(lm.frame, [xb - 0.035, yb - 0.03, FB[0]], [xb + 0.006, yb + 0.004, FB[1]], { shadow: 'receive' });
    for (const k of [0.055, 0.075]) b.boxMM(lm.base, [xb - k - 0.01, yb, FB[0] + 0.04], [xb - k, yb + 0.004, FB[1] - 0.04], { shadow: 'receive' });
  }
}

/** 段の両側: 壁の側の腰の帯・ささら幅木・手すり（受け金物）、吹き抜けの側のささら桁と手すり */
function flightSides(env: Env, lm: LevelMats, fl: number): void {
  const { b } = env;
  // [壁の面 z, 厚さの向き, 段の下端の高さ, 上る向き]
  const sides: [number, 1 | -1, number, 1 | -1][] = [
    [SZ0, 1, fl, 1],
    [SZ1, -1, fl + RISE, -1],
  ];
  for (const [zw, s, y0, dir] of sides) {
    // 腰の帯（段鼻の線から 0.9 m。見切りの線）とささら幅木（段鼻の線の下 0.3〜上 0.1 の暗い帯）
    profilePlate(b, lm.wainscot, flightBand(y0, dir, 0.3, 0.9), zw + s * 0.002, 0.01, s);
    profilePlate(b, lm.base, flightBand(y0, dir, -0.86, 0.92, false), zw + s * 0.012, 0.012, s);
    profilePlate(b, lm.base, flightBand(y0, dir, 0.35, 0.1), zw + s * 0.012, 0.016, s);
    // 壁の手すり（段鼻の線から 0.8 m）と受け金物（0.75 m おき）
    const zr = zw + s * 0.07;
    const xa = dir > 0 ? RUN_X0 : RUN_X1;
    const xe = dir > 0 ? RUN_X1 : RUN_X0;
    const ya = y0 + RH + 0.8;
    const ye = y0 + RISE + 0.8;
    const va = new THREE.Vector3(xa, ya, zr);
    const ve = new THREE.Vector3(xe, ye, zr);
    const g = new THREE.CylinderGeometry(0.02, 0.02, va.distanceTo(ve), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ve.clone().sub(va).normalize()));
    g.translate((xa + xe) / 2, (ya + ye) / 2, zr);
    b.mesh(g, lm.frame, [0, 0, 0], { shadow: true });
    for (let t = 0.12; t < 1; t += 0.75 / RUN) {
      const p = va.clone().lerp(ve, t);
      b.boxMM(lm.base, [p.x - 0.008, p.y - 0.06, Math.min(zw, zr)], [p.x + 0.008, p.y - 0.015, Math.max(zw, zr)], { shadow: false });
      b.cyl(lm.base, [p.x, p.y - 0.06, zw + s * 0.006], 0.03, 0.012, { axis: 'z', shadow: false });
    }
    // 吹き抜けの側のささら桁（段の横の段々を隠す斜めの板。段鼻の線の上 5 cm まで）
    const zi = dir > 0 ? FA[1] : FB[0];
    profilePlate(b, lm.frame, flightBand(y0, dir, 0.42, 0.05), zi + (dir > 0 ? 0 : 0), 0.02, dir > 0 ? 1 : -1, true);
  }
  // 吹き抜けの手すり（2 本の段の間: ささら桁の上に立つ縦の桟 11 cm おき・上の笠木の管・下の横の帯）
  for (const [z, y0, dir] of [[FA[1] + 0.035, fl, 1], [FB[0] - 0.035, fl + RISE, -1]] as [number, number, number][]) {
    railBars(b, lm.frame, z, y0, dir);
  }
}

/** 段に沿う手すり（縦の桟・笠木・下の帯）。z = 手すりの面、y0 = 段の下端の高さ、dir = 上る向き */
function railBars(b: Builder, m: THREE.Material, z: number, y0: number, dir: number): void {
  const n = Math.round(RUN / 0.11);
  const yAt = (x: number): number => y0 + RH + ((dir > 0 ? x - RUN_X0 : RUN_X1 - x) / TREAD) * RH;
  for (let i = 0; i <= n; i++) {
    const x = RUN_X0 + 0.04 + (i * (RUN - 0.08)) / n;
    const yb = Math.min(yAt(x), y0 + RISE) + 0.05;
    b.boxMM(m, [x - 0.008, yb, z - 0.008], [x + 0.008, yb + 0.86, z + 0.008], { shadow: true });
  }
  for (const [dy, r] of [[0.92, 0.025], [0.1, 0.012]] as [number, number][]) {
    const g = new THREE.CylinderGeometry(r, r, Math.hypot(RUN, RISE), 8);
    g.rotateZ(Math.PI / 2 - Math.atan2(RISE, RUN) * dir);
    g.translate((RUN_X0 + RUN_X1) / 2, y0 + RISE / 2 + RH + dy - 0.02, z);
    b.mesh(g, m, [0, 0, 0], { shadow: true });
  }
}

/** 階段室の作り込み（どの階も同じ決まり）: 床の踊り場の設備・天井の器具・中の踊り場・段の上の壁の掲示 */
function dressLevel(env: Env, lm: LevelMats, lv: number, fl: number): void {
  const { b, mats, ctx } = env;
  const zone = levelZone(Math.min(lv, 3));
  const pm = mats.props(zone);
  const sink = propSink(b, ctx);
  const ceil = lv === 4 ? TOP : fl + 3.3;
  // 床の踊り場の腰の帯（西と東の壁）・北の壁の窓の下の腰
  for (const [z, s] of [[SZ0, 1], [SZ1, -1]] as [number, number][]) {
    b.boxMM(lm.wainscot, [SX0, fl, Math.min(z, z + s * 0.012)], [RUN_X0, fl + 0.9, Math.max(z, z + s * 0.012)], { shadow: 'receive' });
    b.boxMM(lm.base, [SX0, fl + 0.88, Math.min(z, z + s * 0.022)], [RUN_X0, fl + 0.92, Math.max(z, z + s * 0.022)], { shadow: 'receive' });
    b.boxMM(lm.base, [SX0, fl, Math.min(z, z + s * 0.018)], [RUN_X0, fl + 0.08, Math.max(z, z + s * 0.018)], { shadow: 'receive' });
  }
  // 天井の器具: 蛍光灯・非常灯・煙感知器
  fluorescent(Prop.at(sink, pm, [SX0 + 0.75, ceil, ZC], Math.PI / 2, 3), { len: 1.25, body: '#2c4c66', tube: '#9cc4d4' });
  emergencyLight(Prop.at(sink, pm, [SX0 + 0.45, ceil, SZ0 + 0.7], 0, 4));
  smokeDetector(Prop.at(sink, pm, [SX0 + 1.05, ceil, SZ1 - 0.9], 0, 5));
  // 西の壁: 窓の上の時計。窓の脇の床に消火器。東の壁: 消火栓の箱と階の札（屋上の口は札と貼り紙だけ）
  extinguisher(Prop.at(sink, pm, [SX0 + 0.16, fl, SZ0 + 0.28], Math.PI / 2, 5));
  if (lv < 4) {
    wallClock(Prop.at(sink, pm, [(SX0 + RUN_X0) / 2, fl + 2.92, SZ0], 0, 11 + lv));
    hydrantCabinet(Prop.at(sink, pm, [SX0 + 0.78, fl + 0.55, SZ1], Math.PI, 30 + lv));
  }
  const plate = mats.get(zone, '#cfe6e6', { key: 'plate' });
  const ink = mats.get(zone, '#2c4c66', { key: 'ink' });
  b.boxMM(plate, [SX0 + 0.95, fl + 2.05, SZ1 - 0.02], [SX0 + 1.4, fl + 2.35, SZ1], { shadow: 'receive' });
  b.boxMM(ink, [SX0 + 1.03, fl + 2.11, SZ1 - 0.025], [SX0 + 1.32, fl + 2.29, SZ1 - 0.02], { shadow: 'receive' });
  poster(Prop.at(sink, pm, [SX0 + 0.45, fl + 2.25, SZ1], Math.PI, 9 + lv), { w: 0.3, h: 0.42 });
  if (lv === 4) {
    // 屋上の口: 扉の前の段ボールと立入禁止の貼り紙・壊れた傘
    carton(Prop.at(sink, pm, [SX0 + 0.4, fl, SZ1 - 1.4], 0.4, 14), { w: 0.45, h: 0.32, d: 0.35 });
    carton(Prop.at(sink, pm, [SX0 + 0.42, fl + 0.32, SZ1 - 1.38], 0.2, 15), { w: 0.4, h: 0.26, d: 0.3 });
    poster(Prop.at(sink, pm, [XN + T_EXT + 0.035, fl + 0.92, ZC], Math.PI / 2, 16), { w: 0.42, h: 0.28, paper: '#e6efe8' });
    saggingCable(Prop.at(sink, pm, [SX0 + 0.5, ceil, SZ0 + 0.8], 0, 24), { len: 2.4, sag: 0.4, tail: true });
    // 行き止まりに寄せた机と椅子の山（東の壁ぎわ）
    const P = PAL[zone];
    deskPile(Prop.at(sink, pm, [11.42, fl, SZ1 - 0.3], Math.PI, 25), { n: 1, top: P.desk.color, edge: P.deskEdge, frame: P.deskFrame, seat: P.seat });
    return;
  }
  // 段の上の壁: 1 本目の上（西の壁）に掲示板、2 本目の上（東の壁）に貼り紙と絵の列
  noticeBoard(Prop.at(sink, pm, [13.2, fl + 2.55, SZ0], 0, 7 + lv), { w: 1.1, h: 0.6 });
  // 段に沿って上がる作品の列（段鼻の線の上 1.3 m。1 本目は掲示板の前後、2 本目は段の全部）
  const noseA = (x: number): number => fl + RH + ((x - RUN_X0) / TREAD) * RH;
  const noseB = (x: number): number => fl + RISE + RH + ((RUN_X1 - x) / TREAD) * RH;
  for (const x of [12.1, 14.35]) artRow(Prop.at(sink, pm, [x, noseA(x) + 1.3, SZ0], 0, 70 + lv + Math.round(x * 10)), { w: 0.62, n: 2 });
  for (const x of [12.15, 12.95, 13.75, 14.5]) artRow(Prop.at(sink, pm, [x, noseB(x) + 1.3, SZ1], Math.PI, 80 + lv + Math.round(x * 10)), { w: 0.66, n: 2, kind: x > 13 && x < 14 ? 'calli' : 'draw' });
  // 2 段目の作品の列（1 段目の上 0.5 m。決まり: 段の壁は 2 段に貼る）
  for (const x of [12.45, 13.25, 14.05]) artRow(Prop.at(sink, pm, [x, noseB(x) + 1.8, SZ1], Math.PI, 90 + lv + Math.round(x * 10)), { w: 0.66, n: 2, kind: 'draw' });
  for (const x of [12.1, 14.35]) artRow(Prop.at(sink, pm, [x, noseA(x) + 1.8, SZ0], 0, 95 + lv + Math.round(x * 10)), { w: 0.62, n: 2, kind: 'calli' });
  // 段の裏の電線の管（段の裏に沿って 2 本）と、管を留める金物
  for (const [z, y0, dir] of [[FA[0] + 0.4, fl + 3.6, 1], [FB[1] - 0.4, fl + 3.6 + RISE, -1]] as [number, number, number][]) {
    if (lv >= 3) continue;
    const va = new THREE.Vector3(RUN_X0 + 0.2, y0 + (dir > 0 ? 0 : RISE) - 0.32 + (dir > 0 ? 0.12 : -0.12), z);
    const ve = new THREE.Vector3(RUN_X1 - 0.2, y0 + (dir > 0 ? RISE : 0) - 0.32 + (dir > 0 ? -0.12 : 0.12), z);
    const g = new THREE.CylinderGeometry(0.014, 0.014, va.distanceTo(ve), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ve.clone().sub(va).normalize()));
    g.translate((va.x + ve.x) / 2, (va.y + ve.y) / 2, z);
    b.mesh(g, lm.base, [0, 0, 0], { shadow: false });
  }
  // 中の踊り場: 東の壁に絵の列、西の壁に壁付けの灯り・貼り紙、隅の縦の配管、天井に非常灯
  artRow(Prop.at(sink, pm, [(RUN_X1 + SX1) / 2, fl + RISE + 2.6, SZ1], Math.PI, 8 + lv), { w: 0.55, n: 2 });
  bracketLight(Prop.at(sink, pm, [(RUN_X1 + SX1) / 2, fl + RISE + 2.15, SZ0], 0, 50 + lv));
  poster(Prop.at(sink, pm, [(RUN_X1 + SX1) / 2, fl + RISE + 1.45, SZ0], 0, 10 + lv), { w: 0.3, h: 0.42 });
  for (const [dz, r] of [[0.15, 0.05], [0.32, 0.03]] as [number, number][]) b.cyl(lm.base, [SX1 - 0.15, fl + 1.8, SZ1 - dz], r, 3.6, { shadow: true });
  // 中の踊り場の腰（北の壁の窓の下と、両側の壁）
  b.boxMM(lm.wainscot, [SX1 - 0.012, fl + RISE, SZ0], [SX1, fl + RISE + 0.76, SZ1], { shadow: 'receive' });
  for (const [z, s] of [[SZ0, 1], [SZ1, -1]] as [number, number][]) {
    b.boxMM(lm.wainscot, [RUN_X1, fl + RISE, Math.min(z, z + s * 0.012)], [SX1, fl + RISE + 0.9, Math.max(z, z + s * 0.012)], { shadow: 'receive' });
    b.boxMM(lm.base, [RUN_X1, fl + RISE + 0.88, Math.min(z, z + s * 0.022)], [SX1, fl + RISE + 0.92, Math.max(z, z + s * 0.022)], { shadow: 'receive' });
  }
  if (lv < 3) emergencyLight(Prop.at(sink, pm, [(RUN_X1 + SX1) / 2, fl + 3.6 + RISE - 0.25, ZC], 0, 60 + lv));
  carton(Prop.at(sink, pm, [SX1 - 0.32, fl + RISE, SZ0 + 0.35], 0.3, 14), { w: 0.42, h: 0.3, d: 0.32 });
  // 天井から垂れたケーブル（床の踊り場）
  saggingCable(Prop.at(sink, pm, [SX0 + 0.5, ceil, SZ0 + 0.8], 0, 20 + lv), { len: 2.6, sag: 0.45, tail: lv % 2 === 0 });
  if (lv === 1) {
    // 1 階: 段の下（2 本目の下）の物置き（ロッカー・掃除用具入れ・段ボール）と傘立て
    steelLocker(Prop.at(sink, pm, [12.75, fl, SZ1 - 0.2], Math.PI, 13), { cols: 4, rows: 3, cw: 0.32, h: 1.2, d: 0.34, body: '#5f8fa2' });
    cleaningCabinet(Prop.at(sink, pm, [13.75, fl, SZ1 - 0.28], Math.PI, 17), { body: '#5f8fa2', h: 1.5 });
    carton(Prop.at(sink, pm, [12.2, fl, ZC + 0.5], 0.5, 18), { w: 0.45, h: 0.35, d: 0.35 });
    umbrellaStand(Prop.at(sink, pm, [11.35, fl, SZ0 + 0.3], 0, 12));
    // 1 階の廊下への扉（鍵）の脇: 下足箱（扉の西）と、寄せた机と椅子の山（扉の東。行き止まり）
    cubbyLocker(Prop.at(sink, pm, [XN + T_EXT + 0.2, fl, ZC - 1.35], Math.PI / 2, 26), { cols: 4, rows: 4, cw: 0.3, h: 1.3, d: 0.36, body: '#5f8fa2' });
    const P = PAL[zone];
    deskPile(Prop.at(sink, pm, [XN + T_EXT + 0.3, fl, ZC + 1.7], Math.PI / 2, 27), { n: 1, top: P.desk.color, edge: P.deskEdge, frame: P.deskFrame, seat: P.seat });
  }
}

/** 鉄の扉（鍵）: 枠と板。壁の面 x。glass = 屋上の扉（網入りガラスの窓: 外の明るさで光る型板ガラス） */
function steelDoor(b: Builder, lm: LevelMats, x: number, fl: number, z: number, env: Env, glass = false): void {
  b.boxMM(lm.frame, [x - 0.14, fl, z - 0.5], [x + 0.14, fl + 2.08, z - 0.45], { shadow: true });
  b.boxMM(lm.frame, [x - 0.14, fl, z + 0.45], [x + 0.14, fl + 2.08, z + 0.5], { shadow: true });
  b.boxMM(lm.frame, [x - 0.14, fl + 2.03, z - 0.5], [x + 0.14, fl + 2.08, z + 0.5], { shadow: true });
  const steel = env.mats.get('deep', '#5f8fa2', { key: 'sdoor' });
  b.boxMM(steel, [x - 0.03, fl, z - 0.45], [x + 0.03, fl + 2.03, z + 0.45], { collide: true, shadow: true });
  // 扉の板の補強の帯と取っ手
  b.boxMM(lm.base, [x + 0.03, fl + 0.3, z - 0.4], [x + 0.034, fl + 0.34, z + 0.4], { shadow: false });
  b.boxMM(lm.base, [x + 0.03, fl + 1.7, z - 0.4], [x + 0.034, fl + 1.74, z + 0.4], { shadow: false });
  b.boxMM(lm.base, [x + 0.03, fl + 0.95, z + 0.3], [x + 0.08, fl + 1.0, z + 0.4], { shadow: false });
  if (glass) {
    b.boxMM(lm.frame, [x + 0.03, fl + 1.12, z - 0.3], [x + 0.045, fl + 1.86, z + 0.3], { shadow: false });
    b.boxMM(lm.frosted, [x + 0.045, fl + 1.16, z - 0.26], [x + 0.05, fl + 1.82, z + 0.26], { shadow: false });
    for (let k = 1; k < 6; k++) b.boxMM(lm.frame, [x + 0.05, fl + 1.16 + k * 0.11, z - 0.26], [x + 0.053, fl + 1.165 + k * 0.11, z + 0.26], { shadow: false });
  }
}
