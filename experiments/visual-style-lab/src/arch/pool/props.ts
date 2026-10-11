import * as THREE from 'three';
import { rng, type V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Prop, type PropMats } from '../../props/kit.ts';
import { towelStack } from '../../props/lib/index.ts';
import { Frame, Mats } from './frame.ts';
import type { Sign, Signs } from './signs.ts';
import { poolBench, poolBin, poolChair, poolCooler, poolExtinguisher, poolPlant, poolTicket, poolVending } from './props/common.ts';
import { aedBox, aidBed as aidBedK, backboard as backboardK, cubicle as cubicleK, desk as deskK, frontDesk as frontDeskK, gates as gatesK, lockerBank, shoeLockerBank, showerStall as showerStallK, sofa as sofaK, table as tableK, vanity as vanityK, washbasin as washbasinK, weighScale } from './props/furniture.ts';
import { chemTank as chemTankK, controlPanel, filterTank as filterTankK, pump as pumpK } from './props/equipment.ts';
import { kickboard, poolShelf, type PoolLoad } from './props/gear.ts';
import { PC, poolPropMats, poolSink } from './props/mats.ts';
import { backstrokeFlags as flagsK, laneRope as laneRopeK, lifeguardChair as guardChairK, poolLadder as poolLadderK, rescueBoard as rescueBoardK, stairRail as stairRailK, startBlock as startBlockK, wallClock } from './props/poolside.ts';

/**
 * プールの施設の小物。形は小物の道具（src/props/kit.ts）で作った物（./props/*.ts）を、部屋とホールの置き方（Frame）で置く。
 * どれも Frame の局所の座標で「背が -z、正面が +z」。壁ぎわの物は Frame の原点が壁の面（物の背を壁から 2.5 cm 離す: 腰の帯の厚さ）。
 * 色は参考画像の色の表から（白いタイル・青緑・淡い青緑・暗い青緑。差し色は救助用具・消火器の赤と浮きの黄・青）。
 * 番号・図柄（ロッカーの番号・スタート台の番号・掲示・時計の無い図柄）は図柄の板（decal）で貼る。
 */
type M = THREE.Material;

export interface Palette {
  white: M;
  whiteTile: M;
  pale: M;
  teal: M;
  tealDark: M;
  dark: M;
  metal: M;
  chrome: M;
  locker: M;
  lockerLine: M;
  wood: M;
  red: M;
  green: M;
  rubber: M;
  glass: M;
  lamp: M;
  screen: M;
  rope: M;
  ropeRed: M;
  float: M;
  steel: M;
  pipe: M;
  pipeBlue: M;
  floorDark: M;
}

export function palette(m: Mats): Palette {
  return {
    white: m.flat('#f1f5ec', '#cdd9cf'),
    whiteTile: m.get({ color: '#eef3e8', shade: '#c9d7cc', dark: '#a4b9ad', hi: '#f6f8f1', tiles: { size: 0.25, line: 0.012, color: '#cfd9cf', jitter: 0.02 } }),
    pale: m.flat('#dbe7e1', '#b7cbc2'),
    teal: m.flat('#7fb1a8', '#5f948c'),
    tealDark: m.flat('#4c7f7c', '#3a6866'),
    dark: m.flat('#2f4a4c', '#243d40'),
    metal: m.flat('#c3cec9', '#9fb0a9'),
    chrome: m.flat('#e2e9e6', '#aebdb7'),
    locker: m.flat('#c9ddd6', '#7fa89f'),
    lockerLine: m.flat('#6f948c', '#4f746d'),
    wood: m.flat('#d9ccae', '#b7a98c'),
    red: m.flat('#cf6a60', '#a9554e'),
    green: m.unlit('#3f9a6a'),
    rubber: m.flat('#3d5658', '#2e4547'),
    glass: m.get({ color: '#cfe6e0', shade: '#b4d0c9', dark: '#9fbdb6', hi: '#e2f1ec', transparent: true, opacity: 0.32, depthWrite: false, line: 0.3 }),
    lamp: m.unlit('#f7fbf5', { line: 0.2 }),
    screen: m.flat('#3a585a', '#2c4648'),
    rope: m.flat('#e9eee9', '#c2cfc8'),
    ropeRed: m.flat('#d47a6c', '#b0625a'),
    float: m.flat('#e3c06a', '#c1a057'),
    steel: m.flat('#a9b8b4', '#869893'),
    pipe: m.flat('#c9d3cf', '#a3b3ad'),
    pipeBlue: m.flat('#6f9fb0', '#557f8f'),
    floorDark: m.flat('#9fb3aa', '#879e95'),
  };
}

export interface Dress {
  ctx: SceneContext;
  p: Palette;
  /** 小物の材質（部屋の中の物は部屋の陰の切り替えに入る組） */
  pm: PropMats;
  signs: Signs;
  r: () => number;
}

/** room = 部屋の中の物（ホールから見た時に部屋の材質と一緒に陰の色へ切り替える） */
export function dressOf(ctx: SceneContext, mats: Mats, signs: Signs, seed: number, room = false): Dress {
  return { ctx, p: palette(mats), pm: poolPropMats(mats, room), signs, r: rng(seed) };
}

/** Frame の局所の位置 pos・向き yaw に小物を置く座標系（小物の道具の Prop） */
export function propAt(d: Dress, f: Frame, pos: V3 = [0, 0, 0], yaw = 0): Prop {
  return Prop.at(poolSink(f.b, d.ctx), d.pm, f.w(pos), (f.k * Math.PI) / 2 + yaw, 1 + Math.floor(d.r() * 1e9));
}

/** 壁から物の背までの間（腰の帯の厚さ） */
const WALL = 0.025;

/** 図柄の板（局所の +z を向く。uv はアトラスの範囲） */
export function decal(f: Frame, sg: Sign, center: V3, w: number, h: number, glow = false): THREE.Mesh {
  const uv = sg.uv;
  const mat = glow ? sg.glow : sg.mat;
  const g = new THREE.PlaneGeometry(w, h);
  const at = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < at.count; i++) at.setXY(i, uv[0] + at.getX(i) * (uv[2] - uv[0]), uv[1] + at.getY(i) * (uv[3] - uv[1]));
  g.rotateY((f.k * Math.PI) / 2);
  return f.b.mesh(g, mat, f.w(center), { shadow: 'receive' });
}

/** 床に描いた図柄（上向き） */
export function floorDecal(f: Frame, sg: Sign, center: V3, w: number, d: number): THREE.Mesh {
  const uv = sg.uv;
  const mat = sg.mat;
  const g = new THREE.PlaneGeometry(w, d);
  const at = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < at.count; i++) at.setXY(i, uv[0] + at.getX(i) * (uv[2] - uv[0]), uv[1] + at.getY(i) * (uv[3] - uv[1]));
  g.rotateX(-Math.PI / 2);
  g.rotateY((f.k * Math.PI) / 2);
  return f.b.mesh(g, mat, f.w(center), { shadow: 'receive' });
}

// ---------------------------------------------------------------- プールサイド

/** 監視台。正面 +z がプール */
export function lifeguardChair(d: Dress, f: Frame): void {
  guardChairK(propAt(d, f));
}

/** プールのはしご。背 -z がプールサイド、z = 0 がプールの縁、+z が水の中。y = 0 が床 */
export function poolLadder(d: Dress, f: Frame, depth: number): void {
  poolLadderK(propAt(d, f), depth);
}

/** 入水の階段の手すり（床から水の中へ斜めに下りる管。前への長さ len、下がる高さ drop） */
export function stairRail(d: Dress, f: Frame, len: number, drop: number): void {
  stairRailK(propAt(d, f), len, drop);
}

/** プールサイドのベンチ（青緑の板・ステンレスの脚）。ときどき畳んだタオルやビート板が置いてある */
export function deckBench(d: Dress, f: Frame, w: number): void {
  const p = propAt(d, f);
  poolBench(p, 'deck', w);
  const k = d.r();
  if (k < 0.3) kickboard(p.sub([(d.r() - 0.5) * (w - 0.6), 0.42, 0], Math.PI / 2 + (d.r() - 0.5) * 0.6), [PC.yellow, PC.blue, PC.white][Math.floor(d.r() * 3)], { holes: true });
  else if (k < 0.5) towelStack(p.sub([(d.r() - 0.5) * (w - 0.6), 0.42, 0], (d.r() - 0.5) * 0.4), 0.32, 0.26, 0.09, [PC.white, PC.blue, PC.teal][Math.floor(d.r() * 3)]);
}

/** 床の排水口（暗い格子の板） */
export function drain(d: Dress, f: Frame, w: number, dp: number): void {
  const { p } = d;
  f.box(p.dark, [-w / 2, 0.0, -dp / 2], [w / 2, 0.006, dp / 2], { shadow: 'receive' });
  for (let x = -w / 2 + 0.05; x < w / 2; x += 0.05) f.box(p.steel, [x - 0.008, 0.006, -dp / 2], [x + 0.008, 0.01, dp / 2], { shadow: 'receive' });
}

/** プールの縁の水深の表示（縁の上面に置く板） */
export function depthMark(d: Dress, f: Frame, m: number): void {
  floorDecal(f, d.signs.depth(m), [0, 0.004, 0], 0.4, 0.2);
}

/** 救命具の板（壁。浮環・レスキューチューブ・巻いた綱） */
export function rescueBoard(d: Dress, f: Frame): void {
  rescueBoardK(propAt(d, f, [0, 0, 0.01]));
}

/** 壁の時計 */
export function clock(d: Dress, f: Frame, y = 2.4, r = 0.25): void {
  wallClock(propAt(d, f), y, r);
}

/** 壁の掲示（板に紙） */
export function wallNotice(_d: Dress, f: Frame, sg: Sign, w: number, h: number, y: number): void {
  decal(f, sg, [0, y, 0.01], w, h);
}

/** 非常口の表示（光る箱） */
export function exitSign(d: Dress, f: Frame, y: number): void {
  f.box(d.p.white, [-0.22, y - 0.08, -0.04], [0.22, y + 0.08, 0.0], { shadow: false });
  decal(f, d.signs.exit(), [0, y, 0.004], 0.42, 0.14, true);
}

/** 消火器（置き台つき） */
export function extinguisher(d: Dress, f: Frame): void {
  poolExtinguisher(propAt(d, f));
}

/** AED の箱（壁） */
export function aed(d: Dress, f: Frame): void {
  aedBox(propAt(d, f, [0, 0, 0.005]));
}

/** 鉢植え（s = 大きさの倍率。葉の形は場所ごとにばらつく） */
export function plant(d: Dress, f: Frame, s = 1): void {
  poolPlant(propAt(d, f, [0, 0, 0], d.r() * 6), 1.3 * s, d.r() < 0.4 ? 'palm' : 'broad');
}

/** 自動販売機（背 -z。原点は本体の中心） */
export function vending(d: Dress, f: Frame, kind: 'drink' | 'water' = 'drink'): void {
  poolVending(propAt(d, f), kind);
}

/** 冷水機（原点は本体の中心） */
export function fountain(d: Dress, f: Frame): void {
  poolCooler(propAt(d, f));
}

/** ごみ箱 */
export function bin(d: Dress, f: Frame): void {
  poolBin(propAt(d, f));
}

// ---------------------------------------------------------------- 更衣室・シャワー

/**
 * ロッカーの列（幅 n 個 × 縦 rows 段）。Frame の原点が背の線（壁ぎわは壁の面、島は背中合わせの線）、扉は +z。
 * back = 背の線から離す間（壁ぎわは腰の帯の厚さ）
 */
export function lockers(d: Dress, f: Frame, n: number, rows: number, start: number, w = 0.4, h = 1.8, back = WALL): void {
  const D = 0.45;
  let k = start;
  lockerBank(propAt(d, f, [0, 0, back + D / 2]), {
    n,
    rows,
    w,
    h,
    d: D,
    keys: 0.75,
    cell: (c) => decal(f, d.signs.number(k++), [c[0], c[1], c[2] + back + D / 2], 0.062, 0.028),
  });
}

/** ベンチ（wood = 木の板・seats = 待合いの椅子）。原点はベンチの中心 */
export function bench(d: Dress, f: Frame, w: number, _dp = 0.4, kind: 'wood' | 'seats' = 'wood'): void {
  poolBench(propAt(d, f), kind, w);
}

/** 化粧台（Frame の原点が壁の面。カウンター・鏡・ドライヤー・腰掛け）。幅 w */
export function vanity(d: Dress, f: Frame, w: number): void {
  vanityK(propAt(d, f, [0, 0, 0.26 + WALL]), w);
}

/** シャワーの仕切り（原点は前の線の真ん中、奥の壁は z = -dp） */
export function showerStall(d: Dress, f: Frame, w: number, dp: number, wallL: boolean, wallR: boolean): void {
  showerStallK(propAt(d, f), w, dp, wallL, wallR);
}

/** 便所の個室（原点は扉の線の真ん中、奥の壁は z = -dp） */
export function cubicle(d: Dress, f: Frame, w: number, dp: number, wallL: boolean): void {
  cubicleK(propAt(d, f), w, dp - 0.02, wallL);
}

/** 洗面台（Frame の原点が壁の面） */
export function washbasin(d: Dress, f: Frame): void {
  washbasinK(propAt(d, f, [0, 0, 0.25 + WALL]));
}

/** 体重計 */
export function scale(d: Dress, f: Frame): void {
  weighScale(propAt(d, f));
}

// ---------------------------------------------------------------- 入口・事務

/** 券売機（原点は本体の中心） */
export function ticketMachine(d: Dress, f: Frame): void {
  poolTicket(propAt(d, f));
}

/** 受付のカウンター（幅 w。客の側が +z） */
export function frontDesk(d: Dress, f: Frame, w: number): void {
  frontDeskK(propAt(d, f), w);
}

/** 入場ゲート（箱の列。通路は局所 z の向き） */
export function gates(d: Dress, f: Frame, n: number, pitch = 0.9): void {
  gatesK(propAt(d, f), n, pitch);
}

/** 下足箱（Frame の原点が壁の面。扉は +z） */
export function shoeLockers(d: Dress, f: Frame, n: number, rows: number, start: number): void {
  const D = 0.38;
  let k = start;
  shoeLockerBank(propAt(d, f, [0, 0, WALL + D / 2]), { n, rows, d: D, cell: (c) => decal(f, d.signs.number(k++, '#e9efe9'), [c[0], c[1], c[2] + WALL + D / 2], 0.07, 0.042) });
}

/** 事務机と事務椅子（椅子は +z の側から机に向かう） */
export function desk(d: Dress, f: Frame, w = 1.4): void {
  deskK(propAt(d, f), w);
  poolChair(propAt(d, f.sub(0.1, 0.65, 2), [0, 0, 0], (d.r() - 0.5) * 0.5), 'office');
}

/** 椅子（積み重ねの椅子。背が -z） */
export function chair(d: Dress, f: Frame, seat?: string): void {
  poolChair(propAt(d, f, [0, 0, 0], (d.r() - 0.5) * 0.25), 'stack', seat ?? PC.tealDark);
}

/** テーブル（4 本脚） */
export function table(d: Dress, f: Frame, w: number, dp: number, h = 0.72): void {
  tableK(propAt(d, f), w, dp, h);
}

/** 棚（スチール棚と段ごとの用具）。Frame の原点が棚の前の線、背は z = -dp（壁ぎわ） */
export function shelf(d: Dress, f: Frame, w: number, h: number, dp: number, load: PoolLoad[]): void {
  poolShelf(propAt(d, f, [0, 0, -dp / 2 + WALL]), { w, h, d: dp, load, frame: load.includes('binders') ? PC.metal : PC.steel });
}

// ---------------------------------------------------------------- 機械室

/** ろ過装置（砂ろ過の圧力槽） */
export function filterTank(d: Dress, f: Frame, r = 0.9, h = 2.4): void {
  filterTankK(propAt(d, f), r, h);
}

/** ポンプ（吸込みの管は局所 (0.64, 1.25)、吐出しの管は (0.32, 1.32) で天井の管へつながる） */
export function pump(d: Dress, f: Frame): void {
  pumpK(propAt(d, f));
}

/** 制御盤（Frame の原点が壁の面） */
export function panel(d: Dress, f: Frame, w = 0.9): void {
  controlPanel(propAt(d, f, [0, 0, 0.2 + WALL]), w, 0.4);
}

/** 薬品の槽 */
export function chemTank(d: Dress, f: Frame): void {
  chemTankK(propAt(d, f));
}

/** 天井の近くを走る配管（場面の座標の点を結ぶ管） */
export function pipeRun(d: Dress, f: Frame, pts: V3[], r = 0.08, mat?: M): void {
  const SH = { shadow: true } as const;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...f.w(pts[i]));
    const b = new THREE.Vector3(...f.w(pts[i + 1]));
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r, r, len, 10);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q);
    f.b.mesh(g, mat ?? d.p.pipe, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], SH);
    if (i > 0) {
      const s = new THREE.SphereGeometry(r * 1.15, 10, 6);
      f.b.mesh(s, mat ?? d.p.pipe, [a.x, a.y, a.z], SH);
    }
  }
}

// ---------------------------------------------------------------- 25 m プール

/** スタート台（背 -z がプールサイド、正面 +z がプール）と番号の札 */
export function startBlock(d: Dress, f: Frame, n: number): void {
  startBlockK(propAt(d, f));
  decal(f, d.signs.number(n, '#f4f7f2', '#2f5a5a'), [0, 0.39, 0.0865], 0.2, 0.13);
}

/** コースロープ（浮きの列）。局所の x 方向に長さ len */
export function laneRope(d: Dress, f: Frame, len: number): void {
  laneRopeK(propAt(d, f), len);
}

/** 背泳ぎの旗（2 本の柱の間の綱に三角の旗） */
export function backstrokeFlags(d: Dress, f: Frame, span: number, h = 1.8): void {
  flagsK(propAt(d, f), span, h);
}

/** ペースクロック（大きな丸い時計） */
export function paceClock(d: Dress, f: Frame, y: number): void {
  wallClock(propAt(d, f), y, 0.55, { pace: true });
}

// ---------------------------------------------------------------- 救護室・ラウンジ

/** 救護用のベッド */
export function aidBed(d: Dress, f: Frame): void {
  aidBedK(propAt(d, f));
}

/** 背板（救助用の担架。壁に立てかける） */
export function backboard(d: Dress, f: Frame): void {
  backboardK(propAt(d, f));
}

/** ソファ（原点は中心、背が -z） */
export function sofa(d: Dress, f: Frame, w: number): void {
  sofaK(propAt(d, f), w);
}
