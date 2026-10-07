import * as THREE from 'three';
import { decalMaterial } from '../../render/Decal.ts';
import type { Atlas } from '../../scenes/corridor/kit.ts';
import { bar, inkNotice, notice, paper, pin, scribble, stamp } from '../../scenes/corridor/tex.ts';
import type { Mats } from './furnish.ts';
import type { LegId } from './layout.ts';
import type { Leg } from './leg.ts';

/**
 * 壁・天井・床の小さな物（参考画像の記号的な描き方: 白い長方形の紙に灰色のくねった線・小さな四角のスイッチ・
 * 赤い箱・コルクや青緑の掲示板・天井の換気口と感知器・床の紙くず）。
 * 置く座標系（mount）: 壁の面が z = 0、部屋（廊下）の側が +z、x は壁に沿う向き、y は床からの高さ。
 * 紙の図柄は区域（A〜D）ごとに参考画像の描き方を写す（A = 手書きのメモ・B = 赤い印のポスター・C = 線画の掲示・D = 青緑の地のメモ）。
 */

type M = THREE.Material;
type UV = [number, number, number, number];

/** 区域ごとの紙の図柄（1 枚のキャンバスにまとめて描いておき、使い回す） */
export interface PaperLib {
  /** 小さなメモ・掲示（縦長） */
  notes: UV[];
  /** 大きめのポスター */
  posters: UV[];
  /** 扉の横の名札 */
  plate: UV;
  /** 赤い箱の中の図柄（発信機・消火器の表示） */
  redBox: UV;
  fireSign: UV;
  /** 換気口（天井） */
  diffuser: UV;
  /** 非常口の表示（緑） */
  exit: UV;
  /** 禁止の表示（赤い丸） */
  noSmoke: UV;
}

/** 図柄はキャンバス（場面を作るたびに新しい）ごとに覚える */
const LIBS = new WeakMap<Atlas, Map<LegId, PaperLib>>();

export function paperLib(atlas: Atlas, zone: LegId): PaperLib {
  let byZone = LIBS.get(atlas);
  if (!byZone) LIBS.set(atlas, (byZone = new Map()));
  const hit = byZone.get(zone);
  if (hit) return hit;
  const notes: UV[] = [];
  const posters: UV[] = [];
  if (zone === 'A') {
    // 手書きのメモ（淡い緑・クリームの紙）・見出しの帯の掲示・暗い四角の付いたメモ
    const bgs = ['#cbdabd', '#e1e9d0', '#adbfa7', '#cddcbd', '#d1cfba', '#bacdb1'];
    bgs.forEach((bg, i) =>
      notes.push(
        atlas.add(110, 150, (g, w, h) => {
          paper(g, w, h, bg);
          if (i % 3 === 2) bar(g, 10, 12, 30, 34, '#3e4a48');
          scribble(g, 12, i % 3 === 2 ? 60 : 20, w - 24, h - (i % 3 === 2 ? 72 : 32), { color: i % 2 ? '#6d7873' : '#59645f', row: 16, width: 2.5, hand: true, seed: 300 + i, skip: 0.3, ragged: 0.6 });
        }),
      ),
    );
    for (let i = 0; i < 3; i++)
      posters.push(atlas.add(160, 220, (g, w, h) => notice(g, w, h, { bg: ['#e3eed3', '#ceddbc', '#cddcbb'][i], head: i === 1 ? '#c4595e' : '#3f5159', seed: 320 + i, edge: '#a6b39b', edgeW: 2 })));
  } else if (zone === 'B') {
    // 赤い楕円の印のポスター・青緑のメモ・茶色の図
    for (let i = 0; i < 4; i++)
      posters.push(
        atlas.add(150, 210, (g, w, h) => {
          paper(g, w, h, ['#f4f9d9', '#f1f4dc', '#f2f5de', '#eef3d8'][i]);
          stamp(g, 18, 18, 96, 30, ['#d1756e', '#c95f5c', '#b25c55', '#d1756e'][i]);
          scribble(g, 20, 66, w - 40, h - 86, { color: '#cdc5a6', row: 17, width: 5, seed: 340 + i });
        }),
      );
    const tbg = [['#a4bfac', '#8aa392'], ['#b2d4be', '#9cc1aa'], ['#a8bfae', '#8fa897'], ['#f2f7e0', '#d9dcc4'], ['#f2f5de', '#d9dcc4']];
    tbg.forEach(([bg, ink], i) =>
      notes.push(
        atlas.add(100, 140, (g, w, h) => {
          paper(g, w, h, bg);
          if (i === 0) stamp(g, 28, 10, 44, 13, '#b25c55');
          scribble(g, 16, i === 0 ? 34 : 16, w - 32, h - (i === 0 ? 48 : 30), { color: ink, row: 12, width: 3.5, seed: 350 + i });
        }),
      ),
    );
    notes.push(
      atlas.add(60, 180, (g, w, h) => {
        paper(g, w, h, '#efe9d4');
        bar(g, 8, 22, w - 16, 38, '#9a6a4d');
        bar(g, 8, 84, w - 22, 30, '#b88e6c');
        bar(g, 8, 128, w - 16, 38, '#7a5a45');
      }),
    );
  } else if (zone === 'C') {
    // 線画の掲示（細い暗い縁・枠で囲んだ見出し・枠付きの棒の行）
    for (let i = 0; i < 6; i++) notes.push(atlas.add(110, 160, (g, w, h) => inkNotice(g, w, h, 360 + i, { head: i % 3 !== 2 })));
    for (let i = 0; i < 3; i++) posters.push(atlas.add(160, 230, (g, w, h) => inkNotice(g, w, h, 370 + i)));
  } else {
    // 青緑の地・クリームの地のメモと、四隅の押しピンの掲示
    const bgs = ['#c0c7a8', '#93b1a2', '#c0caac', '#9fb09b', '#c5ccb0', '#a3b39f'];
    bgs.forEach((bg, i) =>
      notes.push(
        atlas.add(100, 150, (g, w, h) => {
          paper(g, w, h, bg);
          scribble(g, 12, 18, w - 24, h - 30, { color: i % 2 ? '#7f9585' : '#8d998a', row: 14, width: 3, seed: 380 + i });
        }),
      ),
    );
    for (let i = 0; i < 3; i++)
      posters.push(
        atlas.add(120, 200, (g, w, h) => {
          paper(g, w, h, ['#a0b49a', '#c3c8a8', '#e8ecc7'][i], '#7f9483', 3);
          bar(g, 22, 40, 46, 22, '#7aa197');
          scribble(g, 18, 80, w - 36, h - 100, { color: '#7f9585', row: 14, width: 3, seed: 390 + i });
          for (const [x, y] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) pin(g, x, y, 5, '#2b3a3c');
        }),
      );
  }
  const ink = zone === 'D' ? '#244145' : zone === 'C' ? '#2c4245' : '#3f5159';
  const lib: PaperLib = {
    notes,
    posters,
    plate: atlas.add(96, 32, (g, w, h) => {
      paper(g, w, h, '#e3eed3', '#8f9a88', 2);
      bar(g, 8, 8, 28, 16, ink);
      scribble(g, 42, 6, 46, 20, { color: '#6d7873', row: 10, width: 2, seed: 410 });
    }),
    redBox: atlas.add(48, 64, (g, w, h) => {
      paper(g, w, h, '#a5545a', '#5d3539', 4);
      g.fillStyle = '#7c3c42';
      g.fillRect(10, 14, w - 20, h - 30);
      g.fillStyle = '#d98a86';
      g.beginPath();
      g.arc(w / 2, h / 2 - 1, 7, 0, Math.PI * 2);
      g.fill();
    }),
    fireSign: atlas.add(120, 40, (g, w, h) => {
      paper(g, w, h, '#c4595e', '#8e3f45', 3);
      scribble(g, 14, 10, w - 28, 20, { color: '#f4f0e0', row: 12, width: 3, seed: 412 });
    }),
    diffuser: atlas.add(96, 96, (g, w, h) => {
      paper(g, w, h, '#dfe9d6', '#7f8f86', 3);
      g.strokeStyle = '#8f9f96';
      g.lineWidth = 3;
      for (const k of [14, 26, 38]) g.strokeRect(k, k, w - k * 2, h - k * 2);
      g.fillStyle = '#5a6a64';
      g.fillRect(w / 2 - 6, h / 2 - 6, 12, 12);
    }),
    exit: atlas.add(160, 64, (g, w, h) => {
      paper(g, w, h, '#4f8f6a', '#2c4a3a', 3);
      bar(g, 14, 12, 30, 40, '#e9f2dc');
      scribble(g, 56, 14, w - 70, 34, { color: '#e9f2dc', row: 16, width: 4, seed: 414 });
    }),
    noSmoke: atlas.add(80, 100, (g, w, h) => {
      paper(g, w, h, '#eef3e4', '#a3ae9c', 2);
      g.strokeStyle = '#c4595e';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(w / 2, 40, 26, 0, Math.PI * 2);
      g.moveTo(w / 2 - 18, 22);
      g.lineTo(w / 2 + 18, 58);
      g.stroke();
      scribble(g, 12, 76, w - 24, 18, { color: '#6d7873', row: 10, width: 2, seed: 416 });
    }),
  };
  byZone.set(zone, lib);
  return lib;
}

/**
 * 小物の色（色見本）。小物は全部 1 つの材質（紙の材質 = 図柄のキャンバス）で描き、面ごとに図柄の中の色見本の 1 点を指す
 * （区域の部屋ごとにまとめて描くので、色ごとに材質を分けると描く回数が増える）
 */
const SW_COMMON: Record<string, string> = {
  plate: '#e3eed3', plateIn: '#c3ccb1', dark: '#2f3b40', red: '#c05d60', redDark: '#8e3f45', redIn: '#d06a6d', metal: '#9fae98',
  white: '#e3eed3', screen: '#41565b', orange: '#d99b5c', cardboard: '#c9b48e', cardboardS: '#a8946f', teal: '#5a797b', pipe: '#a9b9a6',
  bucket: '#80a496', greenLens: '#bfe8c8', lamp: '#ec7c72',
};
const SW_ZONE: Record<LegId, Record<string, string>> = {
  A: { board: '#b3b68b', boardFrame: '#d2dcbb' },
  B: { board: '#d6d9b8', boardFrame: '#d2dcbb' },
  C: { board: '#cfe0c9', boardFrame: '#e8f4dc' },
  D: { board: '#88a998', boardFrame: '#5b7873' },
};

export type Sw = string;

/** 区域ごとの小物の道具 */
export interface Kit {
  zone: LegId;
  mats: Mats;
  lib: PaperLib;
  paperMat: M;
  exitMat: M;
  redLamp: M;
  /** 色見本の uv（図柄の中の 1 点） */
  sw: Record<string, [number, number]>;
  /** 床の紙くず（貼り絵） */
  scrap: M;
  /** 落ちた紙（白い長方形の貼り絵） */
  sheet: M;
}

const SWATCHES = new WeakMap<Atlas, Record<string, [number, number]>>();

function swatches(atlas: Atlas, zone: LegId): Record<string, [number, number]> {
  let all = SWATCHES.get(atlas);
  if (!all) SWATCHES.set(atlas, (all = {}));
  const want = { ...SW_COMMON, ...Object.fromEntries(Object.entries(SW_ZONE[zone]).map(([k, v]) => [`${k}${zone}`, v])) };
  for (const [name, hex] of Object.entries(want)) {
    if (all[name]) continue;
    const uv = atlas.add(12, 12, (g, w, h) => {
      g.fillStyle = hex;
      g.fillRect(-6, -6, w + 12, h + 12);
    });
    all[name] = [(uv[0] + uv[2]) / 2, (uv[1] + uv[3]) / 2];
  }
  const out: Record<string, [number, number]> = { ...all };
  for (const k of Object.keys(SW_ZONE[zone])) out[k] = all[`${k}${zone}`];
  return out;
}

/** 材質の置き場（場面を作るたびに新しい）ごとに覚える */
const KITS = new WeakMap<Mats, Map<LegId, Kit>>();

export function kitFor(mats: Mats, zone: LegId, atlas: Atlas, paperMat: M): Kit {
  let byZone = KITS.get(mats);
  if (!byZone) KITS.set(mats, (byZone = new Map()));
  const hit = byZone.get(zone);
  if (hit) return hit;
  const ctx = mats.ctx;
  const scrapC = zone === 'A' ? '#cedfbf' : zone === 'B' ? '#f4f9e2' : zone === 'C' ? '#eff8e2' : '#e6ebc8';
  const k: Kit = {
    zone,
    mats,
    lib: paperLib(atlas, zone),
    paperMat,
    exitMat: mats.once(`exit|${atlas.tex.uuid}`, () => ctx.mat({ color: '#ffffff', map: atlas.tex, unlit: true, line: 0.5 })),
    redLamp: mats.unlit('#ff6a5a', 0.4),
    sw: swatches(atlas, zone),
    scrap: mats.once(`scrap|${zone}`, () => decalMaterial({ color: scrapC, rag: 0.008, scale: 16 })),
    sheet: mats.once('sheet', () => decalMaterial({ color: '#f2f6e6', rag: 0.004, scale: 22, ink: 0.003, inkColor: '#8f9a88' })),
  };
  byZone.set(zone, k);
  return k;
}

const pick = <T>(a: T[], r: () => number): T => a[Math.floor(r() * a.length) % a.length];

type FaceKey = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
type FaceSw = Partial<Record<FaceKey, Sw>>;

function setUv(g: THREE.BufferGeometry, uv: [number, number]): THREE.BufferGeometry {
  const a = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0], uv[1]);
  return g;
}

/** 面ごとに色見本を変えられる箱（材質は紙の材質 1 つ）。faces の無い面は作らない */
export function fbox(k: Kit, s: Leg, min: [number, number, number], max: [number, number, number], faces: FaceSw, o: { collide?: boolean; shadow?: boolean | 'cast' | 'receive' } = {}): void {
  const [x0, y0, z0] = [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])];
  const [x1, y1, z1] = [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])];
  const sx = x1 - x0;
  const sy = y1 - y0;
  const sz = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  const put = (key: FaceKey, g: THREE.BufferGeometry, pos: [number, number, number]): void => {
    const n = faces[key];
    if (!n) return;
    s.mesh(setUv(g, k.sw[n] ?? k.sw.plate), k.paperMat, pos, { shadow: o.shadow ?? 'receive' });
  };
  put('px', new THREE.PlaneGeometry(sz, sy).rotateY(Math.PI / 2), [x1, cy, cz]);
  put('nx', new THREE.PlaneGeometry(sz, sy).rotateY(-Math.PI / 2), [x0, cy, cz]);
  put('py', new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), [cx, y1, cz]);
  put('ny', new THREE.PlaneGeometry(sx, sz).rotateX(Math.PI / 2), [cx, y0, cz]);
  put('pz', new THREE.PlaneGeometry(sx, sy), [cx, cy, z1]);
  put('nz', new THREE.PlaneGeometry(sx, sy).rotateY(Math.PI), [cx, cy, z0]);
  if (o.collide) s.collider([x0, y0, z0], [x1, y1, z1]);
}

/** 全部の面が同じ色の箱（底は省く） */
export function sbox(k: Kit, s: Leg, min: [number, number, number], max: [number, number, number], c: Sw, o: { collide?: boolean; shadow?: boolean | 'cast' | 'receive' } = {}): void {
  fbox(k, s, min, max, { px: c, nx: c, py: c, pz: c, nz: c }, o);
}

/** 色見本の円柱（axis の向き） */
export function fcyl(k: Kit, s: Leg, c: [number, number, number], r: number, len: number, sw: Sw, o: { axis?: 'x' | 'y' | 'z'; radiusTop?: number; segments?: number; shadow?: boolean | 'cast' | 'receive' } = {}): void {
  const g = new THREE.CylinderGeometry(o.radiusTop ?? r, r, len, o.segments ?? 12);
  if (o.axis === 'x') g.rotateZ(Math.PI / 2);
  if (o.axis === 'z') g.rotateX(Math.PI / 2);
  s.mesh(setUv(g, k.sw[sw] ?? k.sw.plate), k.paperMat, c, { shadow: o.shadow ?? 'receive' });
}

// ---------------------------------------------------------------- 壁（mount の座標系）

/** スイッチの板（1〜3 連） */
export function switchPlate(k: Kit, s: Leg, x: number, y: number, gang = 1): void {
  const w = 0.07 + (gang - 1) * 0.05;
  fbox(k, s, [x - w / 2, y - 0.06, 0], [x + w / 2, y + 0.06, 0.012], { pz: 'plate', px: 'plateIn', nx: 'plateIn', py: 'plate', ny: 'plateIn' });
  for (let i = 0; i < gang; i++) {
    const cx = x - w / 2 + 0.035 + i * 0.05;
    fbox(k, s, [cx - 0.012, y - 0.03, 0.012], [cx + 0.012, y + 0.03, 0.016], { pz: 'plateIn' });
  }
}

/** コンセント（床から 0.3 m） */
export function outlet(k: Kit, s: Leg, x: number, y = 0.3): void {
  fbox(k, s, [x - 0.035, y - 0.055, 0], [x + 0.035, y + 0.055, 0.01], { pz: 'plate', px: 'plateIn', nx: 'plateIn', py: 'plate' });
  for (const yy of [y - 0.022, y + 0.022]) fbox(k, s, [x - 0.012, yy - 0.01, 0.01], [x + 0.012, yy + 0.01, 0.012], { pz: 'dark' });
}

/** 火災の発信機（赤い箱・上に赤い灯り・天井へ配管） */
export function alarmBox(k: Kit, s: Leg, x: number, y: number, ceil: number): void {
  fbox(k, s, [x - 0.11, y - 0.14, 0], [x + 0.11, y + 0.14, 0.06], { pz: 'red', px: 'redDark', nx: 'redDark', py: 'red', ny: 'redDark' });
  s.sheet(k.paperMat, '+z', [x, y, 0.062], 0.17, 0.22, k.lib.redBox);
  fcyl(k, s, [x, y + 0.24, 0.03], 0.035, 0.05, 'lamp', { axis: 'z', segments: 12 });
  fbox(k, s, [x - 0.045, y + 0.19, 0], [x + 0.045, y + 0.29, 0.02], { pz: 'redDark', px: 'redDark', nx: 'redDark', py: 'redDark' });
  // 配管（壁に沿って天井まで）
  if (ceil - (y + 0.3) > 0.1) fbox(k, s, [x - 0.012, y + 0.3, 0], [x + 0.012, ceil, 0.024], { pz: 'white', px: 'plateIn', nx: 'plateIn' });
}

/** 手指の消毒液・紙タオルの箱（白い箱と小窓） */
export function dispenser(k: Kit, s: Leg, x: number, y: number): void {
  fbox(k, s, [x - 0.07, y - 0.13, 0], [x + 0.07, y + 0.13, 0.1], { pz: 'white', px: 'plateIn', nx: 'plateIn', py: 'white', ny: 'plateIn' });
  fbox(k, s, [x - 0.035, y, 0.1], [x + 0.035, y + 0.07, 0.104], { pz: 'screen' });
  fbox(k, s, [x - 0.02, y - 0.15, 0.03], [x + 0.02, y - 0.13, 0.07], { ny: 'dark', pz: 'dark' });
}

/** ナースコール・インターホンの板（暗い小さな画面） */
export function intercom(k: Kit, s: Leg, x: number, y: number): void {
  fbox(k, s, [x - 0.07, y - 0.1, 0], [x + 0.07, y + 0.1, 0.025], { pz: 'plate', px: 'plateIn', nx: 'plateIn', py: 'plate', ny: 'plateIn' });
  fbox(k, s, [x - 0.05, y + 0.01, 0.025], [x + 0.05, y + 0.07, 0.028], { pz: 'screen' });
  fbox(k, s, [x - 0.02, y - 0.07, 0.025], [x + 0.02, y - 0.03, 0.03], { pz: 'red' });
}

/** 温度の調節器・小さな箱 */
export function thermostat(k: Kit, s: Leg, x: number, y: number): void {
  fbox(k, s, [x - 0.05, y - 0.065, 0], [x + 0.05, y + 0.065, 0.025], { pz: 'plate', px: 'plateIn', nx: 'plateIn', py: 'plate', ny: 'plateIn' });
  fbox(k, s, [x - 0.032, y, 0.025], [x + 0.032, y + 0.04, 0.027], { pz: 'plateIn' });
}

/** 扉の横の名札 */
export function namePlate(k: Kit, s: Leg, x: number, y = 1.65): void {
  s.sheet(k.paperMat, '+z', [x, y, 0.006], 0.3, 0.1, k.lib.plate);
}

/**
 * 紙の束（参考画像の掲示の並び: 大きさの違う紙が少しずつ傾いて重なる）。中心 x・y、範囲 w × h に n 枚
 */
export function paperCluster(k: Kit, s: Leg, x: number, y: number, w: number, h: number, n: number, r: () => number, z = 0.004): void {
  const lib = k.lib;
  for (let i = 0; i < n; i++) {
    const big = r() < 0.3 && lib.posters.length > 0;
    const uv = big ? pick(lib.posters, r) : pick(lib.notes, r);
    const pw = big ? 0.3 + r() * 0.12 : 0.16 + r() * 0.12;
    const ph = pw * (1.25 + r() * 0.2);
    const px = x - w / 2 + pw / 2 + r() * Math.max(0, w - pw);
    const py = y - h / 2 + ph / 2 + r() * Math.max(0, h - ph);
    s.sheet(k.paperMat, '+z', [px, py, z + i * 0.0007], pw, ph, uv, {}, (r() - 0.5) * 0.09);
  }
}

/** 掲示板（枠と板、上に紙） */
export function board(k: Kit, s: Leg, x: number, y: number, w: number, h: number, r: () => number): void {
  fbox(k, s, [x - w / 2, y - h / 2, 0], [x + w / 2, y + h / 2, 0.012], { pz: 'board', px: 'board', nx: 'board' });
  const fw = 0.035;
  for (const [x0, y0, x1, y1] of [
    [x - w / 2 - fw, y + h / 2, x + w / 2 + fw, y + h / 2 + fw],
    [x - w / 2 - fw, y - h / 2 - fw, x + w / 2 + fw, y - h / 2],
    [x - w / 2 - fw, y - h / 2, x - w / 2, y + h / 2],
    [x + w / 2, y - h / 2, x + w / 2 + fw, y + h / 2],
  ] as [number, number, number, number][])
    fbox(k, s, [x0, y0, 0], [x1, y1, 0.025], { pz: 'boardFrame', py: 'boardFrame', ny: 'boardFrame', px: 'boardFrame', nx: 'boardFrame' });
  const n = Math.max(2, Math.round((w * h) / 0.1));
  paperCluster(k, s, x, y, w - 0.08, h - 0.08, n, r, 0.014);
}

/** 消火器（床に置いた赤い円柱と、上の赤い表示） */
export function extinguisher(k: Kit, s: Leg, x: number): void {
  fcyl(k, s, [x, 0.3, 0.12], 0.08, 0.5, 'red', { segments: 14 });
  fcyl(k, s, [x, 0.6, 0.12], 0.032, 0.1, 'dark', { segments: 10 });
  sbox(k, s, [x + 0.05, 0.25, 0.1], [x + 0.08, 0.62, 0.14], 'dark');
  fbox(k, s, [x - 0.16, 0, 0], [x + 0.16, 0.04, 0.26], { py: 'dark', pz: 'dark', px: 'dark', nx: 'dark' });
  s.sheet(k.paperMat, '+z', [x, 1.05, 0.006], 0.3, 0.1, k.lib.fireSign);
}

/** 縦の配管・電線の管（床から天井まで。受け金物つき） */
export function conduit(k: Kit, s: Leg, x: number, y0: number, y1: number, r = 0.025, c: Sw = 'white'): void {
  fcyl(k, s, [x, (y0 + y1) / 2, r + 0.02], r, y1 - y0, c, { segments: 10 });
  for (let y = y0 + 0.4; y < y1 - 0.2; y += 1.0) sbox(k, s, [x - r - 0.02, y - 0.02, 0], [x + r + 0.02, y + 0.02, r * 2 + 0.03], 'metal');
}

// ---------------------------------------------------------------- 天井（c の座標系: 天井の面が y = h）

/** 吹き出し口（四角の換気口） */
export function diffuser(k: Kit, s: Leg, x: number, z: number, h: number, w = 0.5): void {
  fbox(k, s, [x - w / 2, h - 0.02, z - w / 2], [x + w / 2, h, z + w / 2], { ny: 'plate', px: 'plateIn', nx: 'plateIn', pz: 'plateIn', nz: 'plateIn' }, { shadow: false });
  s.sheet(k.paperMat, '-y', [x, h - 0.022, z], w - 0.04, w - 0.04, k.lib.diffuser, { shadow: false });
}

/** 点検口（細い枠の四角） */
export function hatch(k: Kit, s: Leg, x: number, z: number, h: number, w = 0.45): void {
  const t = 0.022;
  for (const [x0, z0, x1, z1] of [
    [x - w / 2, z - w / 2, x + w / 2, z - w / 2 + t],
    [x - w / 2, z + w / 2 - t, x + w / 2, z + w / 2],
    [x - w / 2, z - w / 2, x - w / 2 + t, z + w / 2],
    [x + w / 2 - t, z - w / 2, x + w / 2, z + w / 2],
  ] as [number, number, number, number][])
    fbox(k, s, [x0, h - 0.008, z0], [x1, h, z1], { ny: 'metal' }, { shadow: false });
}

/** スプリンクラーの頭（小さな円と金具） */
export function sprinkler(k: Kit, s: Leg, x: number, z: number, h: number): void {
  fcyl(k, s, [x, h - 0.006, z], 0.04, 0.012, 'plate', { segments: 12, shadow: false });
  fcyl(k, s, [x, h - 0.035, z], 0.012, 0.05, 'metal', { segments: 8, shadow: false });
}

/** 煙の感知器（小さな円柱） */
export function smokeDet(k: Kit, s: Leg, x: number, z: number, h: number): void {
  fcyl(k, s, [x, h - 0.05, z], 0.045, 0.1, 'plate', { segments: 14, shadow: false });
}

/** 天井の監視カメラ（取り付け台・腕・暗い丸） */
export function domeCamK(k: Kit, s: Leg, x: number, z: number, y: number, sc = 0.9): void {
  fcyl(k, s, [x, y - 0.02 * sc, z], 0.09 * sc, 0.04 * sc, 'plate', { segments: 18, shadow: false });
  sbox(k, s, [x - 0.025 * sc, y - 0.13 * sc, z - 0.025 * sc], [x + 0.025 * sc, y - 0.03 * sc, z + 0.025 * sc], 'plate', { shadow: false });
  fbox(k, s, [x - 0.1 * sc, y - 0.2 * sc, z - 0.07 * sc], [x + 0.1 * sc, y - 0.13 * sc, z + 0.07 * sc], { px: 'plate', nx: 'plate', pz: 'plate', nz: 'plate', ny: 'plateIn', py: 'plate' }, { shadow: false });
  fcyl(k, s, [x, y - 0.235 * sc, z], 0.075 * sc, 0.07 * sc, 'dark', { segments: 18, shadow: false });
}

/** 天井のスピーカー（丸い格子） */
export function speaker(k: Kit, s: Leg, x: number, z: number, h: number): void {
  fcyl(k, s, [x, h - 0.01, z], 0.11, 0.02, 'plate', { segments: 20, shadow: false });
  fcyl(k, s, [x, h - 0.021, z], 0.075, 0.004, 'plateIn', { segments: 20, shadow: false });
}

/** 吊り下げの非常口の表示（天井から 2 本の吊り具） */
export function exitHanging(k: Kit, s: Leg, x: number, z: number, h: number): void {
  for (const dx of [-0.18, 0.18]) sbox(k, s, [x + dx - 0.006, h - 0.3, z - 0.006], [x + dx + 0.006, h, z + 0.006], 'metal', { shadow: false });
  fbox(k, s, [x - 0.25, h - 0.42, z - 0.025], [x + 0.25, h - 0.3, z + 0.025], { px: 'white', nx: 'white', ny: 'plateIn', py: 'white' }, { shadow: false });
  s.sheet(k.exitMat, '+z', [x, h - 0.36, z + 0.026], 0.48, 0.11, k.lib.exit, { shadow: false });
  s.sheet(k.exitMat, '-z', [x, h - 0.36, z - 0.026], 0.48, 0.11, k.lib.exit, { shadow: false });
}

// ---------------------------------------------------------------- 床（f の座標系）

/** 紙くず（小さなちぎれた紙の貼り絵）。中心 x・z、大きさ w × d、向き a */
export function scrap(k: Kit, s: Leg, x: number, z: number, w: number, d: number, a: number, mat?: M, y = 0.002): void {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const p = (u: number, v: number): [number, number, number] => [x + u * c - v * sn, y, z + u * sn + v * c];
  s.quad(mat ?? k.scrap, p(-w / 2, d / 2), p(w / 2, d / 2), p(w / 2, -d / 2), p(-w / 2, -d / 2));
}

/** 段ボールの山（床に置いた箱 1〜3 個） */
export function boxStack(k: Kit, s: Leg, r: () => number): void {
  const n = 1 + Math.floor(r() * 3);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - i * 0.08 - r() * 0.06;
    const d = 0.38 - i * 0.04;
    const h = 0.28 + r() * 0.12;
    const dx = (r() - 0.5) * 0.06;
    const c = i % 2 ? 'white' : 'cardboard';
    fbox(k, s, [dx - w / 2, y, -d / 2], [dx + w / 2, y + h, d / 2], { pz: c, nz: c, px: c === 'white' ? 'plateIn' : 'cardboardS', nx: c === 'white' ? 'plateIn' : 'cardboardS', py: c }, { shadow: true, collide: i === 0 });
    fbox(k, s, [dx - w / 2, y + h * 0.5 - 0.02, d / 2], [dx + w / 2, y + h * 0.5 + 0.02, d / 2 + 0.002], { pz: 'plateIn' });
    y += h;
  }
}

/** 白いポール（反射材の付いた低い柱。参考画像の corridor-0 の左） */
export function lowPole(k: Kit, s: Leg, x: number, z: number): void {
  fcyl(k, s, [x, 0.015, z], 0.085, 0.03, 'white', { segments: 16 });
  fcyl(k, s, [x, 0.17, z], 0.024, 0.3, 'white', { segments: 10, radiusTop: 0.02 });
  fcyl(k, s, [x, 0.365, z], 0.02, 0.09, 'orange', { segments: 10 });
}

/** 床に置いた機械（暗い台の上の白い箱。参考画像の corridor-0 の右下） */
export function floorDevice(k: Kit, s: Leg): void {
  fbox(k, s, [-0.12, 0, -0.08], [0.12, 0.16, 0.08], { pz: 'dark', nx: 'dark', px: 'dark', nz: 'dark' }, { collide: true });
  fbox(k, s, [-0.14, 0.16, -0.1], [0.14, 0.3, 0.1], { pz: 'white', nx: 'plateIn', px: 'plateIn', nz: 'white', py: 'white' }, { shadow: true });
  fbox(k, s, [-0.08, 0.3, -0.06], [0.08, 0.302, 0.04], { py: 'screen' });
}

/** 四角いごみ箱（下がすぼまる） */
export function squareBin(k: Kit, s: Leg): void {
  const g = new THREE.CylinderGeometry(0.2, 0.15, 0.42, 4, 1, true).rotateY(Math.PI / 4);
  s.mesh(setUv(g, k.sw.white), k.paperMat, [0, 0.21, 0]);
  const rg = new THREE.CylinderGeometry(0.215, 0.2, 0.04, 4, 1, false).rotateY(Math.PI / 4);
  s.mesh(setUv(rg, k.sw.plateIn), k.paperMat, [0, 0.4, 0]);
  s.collider([-0.15, 0, -0.15], [0.15, 0.42, 0.15]);
}

/** 屋内消火栓の箱（赤い扉・上に赤い灯り・表示）。床から 0.25〜1.3 m、出っ張り 0.18 */
export function hydrant(k: Kit, s: Leg, x: number): void {
  const w = 0.72;
  fbox(k, s, [x - w / 2, 0.25, 0], [x + w / 2, 1.3, 0.18], { pz: 'red', px: 'redDark', nx: 'redDark', py: 'red', ny: 'redDark' }, { collide: true });
  fbox(k, s, [x - w / 2 + 0.05, 0.3, 0.18], [x + w / 2 - 0.05, 1.25, 0.184], { pz: 'redIn' });
  fbox(k, s, [x + w / 2 - 0.12, 0.7, 0.184], [x + w / 2 - 0.09, 0.9, 0.2], { pz: 'dark', px: 'dark', nx: 'dark' });
  s.sheet(k.paperMat, '+z', [x, 1.12, 0.186], 0.4, 0.12, k.lib.fireSign);
  fcyl(k, s, [x, 1.5, 0.05], 0.06, 0.06, 'lamp', { axis: 'z', segments: 16 });
  fbox(k, s, [x - 0.08, 1.42, 0], [x + 0.08, 1.58, 0.02], { pz: 'redDark' });
}

/** 横の配管（壁に沿う管と受け金物）。x0〜x1、高さ y、半径 r */
export function pipeRun(k: Kit, s: Leg, x0: number, x1: number, y: number, r = 0.03, c: Sw = 'pipe'): void {
  fcyl(k, s, [(x0 + x1) / 2, y, r + 0.03], r, x1 - x0, c, { axis: 'x', segments: 10 });
  for (let x = x0 + 0.25; x < x1 - 0.1; x += 1.1) fbox(k, s, [x - 0.02, y - r - 0.03, 0], [x + 0.02, y + r + 0.01, r * 2 + 0.05], { pz: 'metal', px: 'metal', nx: 'metal', ny: 'metal' });
}

/** 壁の棚（板と受け金物、上に手袋やマスクの箱）。中心 x、幅 w、高さ y */
export function wallShelf(k: Kit, s: Leg, x: number, w: number, y: number, r: () => number): void {
  fbox(k, s, [x - w / 2, y - 0.025, 0], [x + w / 2, y, 0.25], { py: 'white', pz: 'plateIn', ny: 'plateIn', px: 'plateIn', nx: 'plateIn' });
  for (const bx of [x - w / 2 + 0.08, x + w / 2 - 0.08]) fbox(k, s, [bx - 0.012, y - 0.18, 0], [bx + 0.012, y - 0.025, 0.2], { px: 'metal', nx: 'metal', pz: 'metal' });
  const cols: Sw[] = ['white', 'bucket', 'plate', 'teal', 'cardboard'];
  let xx = x - w / 2 + 0.04;
  while (xx < x + w / 2 - 0.2) {
    const bw = 0.12 + r() * 0.12;
    const bh = 0.08 + r() * 0.12;
    const c = cols[Math.floor(r() * cols.length)];
    fbox(k, s, [xx, y, 0.03], [Math.min(xx + bw, x + w / 2 - 0.03), y + bh, 0.22], { pz: c, py: c, px: 'plateIn', nx: 'plateIn' });
    xx += bw + 0.02 + r() * 0.08;
  }
}

/** エプロン・ガウンの掛け具（横の棒と、掛けた布 1〜3 枚） */
export function apronHooks(k: Kit, s: Leg, x: number, w: number, r: () => number): void {
  fbox(k, s, [x - w / 2, 1.62, 0], [x + w / 2, 1.68, 0.03], { pz: 'metal', py: 'metal', ny: 'metal', px: 'metal', nx: 'metal' });
  const n = Math.max(2, Math.round(w / 0.3));
  for (let i = 0; i < n; i++) {
    const cx = x - w / 2 + (w * (i + 0.5)) / n;
    sbox(k, s, [cx - 0.01, 1.6, 0.02], [cx + 0.01, 1.64, 0.08], 'metal');
    if (r() < 0.65) {
      const c: Sw = r() < 0.5 ? 'bucket' : 'white';
      fbox(k, s, [cx - 0.16, 0.85 + r() * 0.15, 0.04], [cx + 0.16, 1.62, 0.09], { pz: c, px: 'plateIn', nx: 'plateIn', py: c });
    }
  }
}

/** 掛け時計（暗い縁・白い文字盤・針）。中心の高さ y */
export function wallClock(k: Kit, s: Leg, x: number, y: number): void {
  fcyl(k, s, [x, y, 0.02], 0.16, 0.04, 'dark', { axis: 'z', segments: 22 });
  fcyl(k, s, [x, y, 0.042], 0.14, 0.004, 'white', { axis: 'z', segments: 22 });
  fbox(k, s, [x - 0.006, y, 0.044], [x + 0.006, y + 0.1, 0.047], { pz: 'dark' });
  fbox(k, s, [x, y - 0.006, 0.044], [x + 0.075, y + 0.006, 0.047], { pz: 'dark' });
}

/** 手袋の箱の掛け具（針金の枠に 3 色の箱）。中心の高さ y */
export function gloveRack(k: Kit, s: Leg, x: number, y: number): void {
  const cols: Sw[] = ['bucket', 'white', 'teal'];
  for (let i = 0; i < 3; i++) {
    const cx = x - 0.27 + i * 0.27;
    fbox(k, s, [cx - 0.12, y - 0.065, 0.01], [cx + 0.12, y + 0.065, 0.13], { pz: cols[i], py: cols[i], px: 'plateIn', nx: 'plateIn', ny: 'plateIn' });
    fbox(k, s, [cx - 0.05, y - 0.03, 0.13], [cx + 0.05, y + 0.0, 0.132], { pz: 'dark' });
  }
  fbox(k, s, [x - 0.41, y - 0.08, 0], [x + 0.41, y - 0.065, 0.14], { py: 'metal', pz: 'metal', ny: 'metal' });
}

/** 壁の当たり止め（ストレッチャー・ベッドの当たる高さの横の帯）。x0〜x1、中心の高さ y */
export function bumper(k: Kit, s: Leg, x0: number, x1: number, y: number): void {
  fbox(k, s, [x0, y - 0.075, 0], [x1, y + 0.075, 0.03], { pz: 'plate', py: 'plate', ny: 'plateIn', px: 'plateIn', nx: 'plateIn' });
  fbox(k, s, [x0, y - 0.012, 0.03], [x1, y + 0.012, 0.034], { pz: 'plateIn' });
}

/** 手すり（丸棒と受け金物。x0〜x1、高さ y）。色見本 c */
export function handRail(k: Kit, s: Leg, x0: number, x1: number, y: number, c: Sw = 'white'): void {
  fcyl(k, s, [(x0 + x1) / 2, y, 0.07], 0.02, x1 - x0, c, { axis: 'x', segments: 10 });
  const n = Math.max(2, Math.round((x1 - x0) / 1.2) + 1);
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.08 + ((x1 - x0 - 0.16) * i) / (n - 1);
    sbox(k, s, [x - 0.012, y - 0.07, 0], [x + 0.012, y - 0.05, 0.07], c);
    sbox(k, s, [x - 0.012, y - 0.07, 0.062], [x + 0.012, y, 0.078], c);
  }
}
