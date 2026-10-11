import * as THREE from 'three';
import type { Prop } from '../../props/kit.ts';
import type { Builder, V3 } from '../../scenes/Builder.ts';
import type { Atlas } from './atlas.ts';
import { PAL } from './mats.ts';

/**
 * サーバーラック（19 インチ・幅 600 × 奥行き 1100 mm・42〜48U）。物の座標: 原点は前面（扉の表）の中心の床、+z が通路（前）。
 * 部位: 台座・本体（側板・天板）・前の扉（枠・ガラス・取っ手・鍵）・機器の前面（図柄 + LED）・後ろの扉（穴あきの板・図柄）・天板のケーブルの口。
 * 機器の前面とガラスは図柄の材質（atlas）で、ほかは頂点の色の材質で描く。
 */

export interface RackMats {
  b: Builder;
  /** 機器の前面・背面（色の図柄 + 光の図柄） */
  face: THREE.Material;
  /** ガラス扉（映り込みの筋の図柄） */
  glass: THREE.Material;
  atlas: Atlas;
}

export interface RackOpts {
  w?: number;
  d?: number;
  h?: number;
  /** 前面の図柄（0..15） */
  design: number;
  /** 背面の図柄（0..15） */
  rear?: number;
  /** 前の扉: ガラス / 穴あきの板（図柄が透けない）/ 扉なし */
  door?: 'glass' | 'mesh' | 'none';
  /** 取っ手の側（1 = 右、-1 = 左） */
  hinge?: 1 | -1;
  /** 映り込みの筋の列（0..3） */
  streak?: number;
  /** 背の扉を描く（ホットアイルから見える列） */
  back?: boolean;
  /** 取っ手の色 */
  handle?: string;
  /** 1 本だけで置くラックの当たり判定（列は列ごとに付ける） */
  collide?: boolean;
  /** 側板の作り込み（1 本だけで置くラック: 前後 2 枚の側板の継ぎ目・掛け金・下の換気の切れ込み・札） */
  sides?: boolean;
}

/** 局所の長方形の板（uv の範囲つき）を作って、物の座標から場面へ移して出す */
export function quad(b: Builder, p: Prop, mat: THREE.Material, c: V3, w: number, h: number, facing: '+z' | '-z' | '+x' | '-x' | '+y', uv: [number, number, number, number], o: { flipU?: boolean } = {}): void {
  const g = new THREE.PlaneGeometry(w, h);
  const a = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    let u = a.getX(i);
    if (o.flipU) u = 1 - u;
    const v = a.getY(i);
    a.setXY(i, uv[0] + (uv[2] - uv[0]) * u, uv[1] + (uv[3] - uv[1]) * v);
  }
  if (facing === '-z') g.rotateY(Math.PI);
  if (facing === '+x') g.rotateY(Math.PI / 2);
  if (facing === '-x') g.rotateY(-Math.PI / 2);
  if (facing === '+y') g.rotateX(-Math.PI / 2);
  g.translate(c[0], c[1], c[2]);
  g.applyMatrix4(p.m);
  // 頂点の色の材質とまとめないので色は付けない（図柄の材質は頂点の色を使わない）
  b.mesh(g, mat, [0, 0, 0], { shadow: 'receive' });
}

export function serverRack(p: Prop, m: RackMats, o: RackOpts): void {
  const w = o.w ?? 0.6;
  const d = o.d ?? 1.1;
  const h = o.h ?? 2.1;
  const hw = w / 2;
  const door = o.door ?? 'glass';
  const hinge = o.hinge ?? 1;
  const nb = { shadow: false as const };
  if (o.collide) p.collide([-hw, 0, -d], [hw, h, 0.03]);
  // 台座（少し内へ）
  p.box(PAL.black, [-hw + 0.01, 0, -d + 0.02], [hw - 0.01, 0.05, -0.02], nb);
  // 本体（側板と天板。前の扉の後ろから背の扉の前まで）
  p.box(PAL.rack, [-hw + 0.004, 0.05, -d + 0.07], [hw - 0.004, h - 0.045, -0.06]);
  if (o.sides) {
    for (const s of [-1, 1]) {
      const x = s * (hw - 0.002);
      const xs: [number, number] = [Math.min(x, x + s * 0.006), Math.max(x, x + s * 0.006)];
      // 前後 2 枚の側板（継ぎ目・縁）・掛け金・換気の切れ込み・札
      p.box(PAL.rackEdge, [xs[0], 0.06, -d / 2 - 0.006], [xs[1], h - 0.06, -d / 2 + 0.006], nb);
      for (const zc of [-d * 0.25, -d * 0.75]) {
        p.box('#0c2a38', [xs[0], h - 0.25, zc - 0.05], [xs[1] + s * 0.004, h - 0.15, zc + 0.05], nb);
        for (let k = 0; k < 6; k++) p.box('#04141c', [xs[0], 0.15 + k * 0.035, zc - 0.18], [xs[1] + s * 0.002, 0.165 + k * 0.035, zc + 0.18], nb);
      }
      p.box(PAL.paper, [xs[0], 1.4, -d * 0.25 - 0.08], [xs[1] + s * 0.003, 1.48, -d * 0.25 + 0.08], nb);
    }
  }
  // 天板（少し張り出す）とケーブルの口（ブラシの付いた細長い穴）
  p.box(PAL.rackTop, [-hw + 0.002, h - 0.045, -d + 0.01], [hw - 0.002, h, -0.004], { r: 0.006 });
  p.box(PAL.black, [-0.18, h, -d + 0.15], [0.18, h + 0.008, -d + 0.27], nb);
  p.box(PAL.black, [-0.18, h, -0.32], [0.18, h + 0.008, -0.22], nb);
  // 機器の前面（19 インチの面）。背の高いラックは図柄を縦に伸ばす
  const faceH = Math.min(h - 0.24, 2.15);
  const fy = 0.11 + faceH / 2;
  quad(m.b, p, m.face, [0, fy, -0.058], 0.48, faceH, '+z', m.atlas.uv(o.design));
  // 取り付けの柱の外（前面の左右の暗い所）
  p.box(PAL.black, [-hw + 0.01, 0.06, -0.064], [-0.24, h - 0.06, -0.058], nb);
  p.box(PAL.black, [0.24, 0.06, -0.064], [hw - 0.01, h - 0.06, -0.058], nb);
  if (door !== 'none') {
    // 扉の枠（縦の框 3.5 cm・上下の框 5 cm）
    const st = 0.035;
    p.box(PAL.rackEdge, [-hw + 0.003, 0.05, -0.028], [-hw + st, h - 0.05, 0], { r: 0.004, shadow: false });
    p.box(PAL.rackEdge, [hw - st, 0.05, -0.028], [hw - 0.003, h - 0.05, 0], { r: 0.004, shadow: false });
    p.box(PAL.rackEdge, [-hw + st, h - 0.1, -0.028], [hw - st, h - 0.05, 0], { shadow: false });
    p.box(PAL.rackEdge, [-hw + st, 0.05, -0.028], [hw - st, 0.1, 0], { shadow: false });
    if (door === 'glass') {
      // ガラス（映り込みの筋）
      const s = (o.streak ?? 0) % 4;
      quad(m.b, p, m.glass, [0, (h - 0.1 + 0.1) / 2 + 0.0, -0.014], w - st * 2, h - 0.2, '+z', [s * 0.25, 0, s * 0.25 + 0.25, 1]);
    } else {
      // 穴あきの板（暗い格子。図柄は少し透ける程度に、縦の帯で）
      for (let k = 0; k < 9; k++) {
        const x = -hw + st + 0.01 + k * ((w - st * 2 - 0.02) / 9);
        p.box(PAL.rackEdge, [x, 0.1, -0.02], [x + 0.012, h - 0.1, -0.012], nb);
      }
    }
    // 取っ手（縦の握り）と鍵
    const hx = hinge * (hw - 0.018);
    p.box(o.handle ?? PAL.handle, [hx - 0.011, 0.92, 0], [hx + 0.011, 1.24, 0.028], { r: 0.008, shadow: false });
    p.box(PAL.handleHi, [hx - 0.006, 1.27, 0], [hx + 0.006, 1.3, 0.012], nb);
  }
  if (o.back) {
    // 背の扉（穴あきの板。背面の図柄が透けて見える）
    quad(m.b, p, m.face, [0, fy, -d + 0.05], 0.5, faceH, '-z', m.atlas.uv(16 + ((o.rear ?? o.design) % 16)));
    // 背の扉の外の側板（扉と本体の間のすき間を埋める）
    p.box(PAL.rack, [-hw + 0.004, 0.05, -d + 0.02], [-hw + 0.03, h - 0.045, -d + 0.07], nb);
    p.box(PAL.rack, [hw - 0.03, 0.05, -d + 0.02], [hw - 0.004, h - 0.045, -d + 0.07], nb);
    const st = 0.035;
    p.box(PAL.rackEdge, [-hw + 0.003, 0.05, -d], [-hw + st, h - 0.05, -d + 0.022], nb);
    p.box(PAL.rackEdge, [hw - st, 0.05, -d], [hw - 0.003, h - 0.05, -d + 0.022], nb);
    p.box(PAL.rackEdge, [-hw + st, h - 0.1, -d], [hw - st, h - 0.05, -d + 0.022], nb);
    p.box(PAL.rackEdge, [-hw + st, 0.05, -d], [hw - st, 0.1, -d + 0.022], nb);
    // 穴あきの格子（細い横の桟）
    for (let k = 1; k < 12; k++) {
      const y = 0.1 + (k * (h - 0.2)) / 12;
      p.box(PAL.rackEdge, [-hw + st, y - 0.004, -d + 0.004], [hw - st, y + 0.004, -d + 0.016], nb);
    }
    p.box(PAL.handle, [-hinge * (hw - 0.018) - 0.011, 0.92, -d - 0.026], [-hinge * (hw - 0.018) + 0.011, 1.24, -d], { r: 0.008, shadow: false });
  }
}

/**
 * インロー空調機（ラックの列に入る幅 300 mm の冷却機。参考画像 serverroom-2 の黒い柱）。
 * 前面の穴あきの板・上の小さな表示（白と水色の LED）・下の吸い込み口
 */
export function inRowCooler(p: Prop, o: { d?: number; h?: number } = {}): void {
  const w = 0.3;
  const d = o.d ?? 1.1;
  const h = o.h ?? 2.15;
  const hw = w / 2;
  p.box('#03202c', [-hw + 0.004, 0, -d + 0.02], [hw - 0.004, h, -0.002], { r: 0.008 });
  // 前面: 縦の縁と穴あきの板（細い横の桟）
  p.box('#081c26', [-hw + 0.02, 0.12, -0.002], [hw - 0.02, h - 0.3, 0.006], { shadow: false });
  for (let k = 0; k < 26; k++) {
    const y = 0.16 + (k * (h - 0.5)) / 26;
    p.box('#040f15', [-hw + 0.03, y, 0.006], [hw - 0.03, y + 0.022, 0.009], { shadow: false });
  }
  // 上の表示（小さな画面と LED）
  p.box('#13394a', [-0.1, h - 0.24, -0.002], [0.1, h - 0.1, 0.012], { shadow: false });
  p.box(PAL.ledWhite, [-0.07, h - 0.2, 0.012], [-0.01, h - 0.18, 0.016], { kind: 'glow', shadow: false });
  p.box(PAL.led, [0.02, h - 0.2, 0.012], [0.06, h - 0.18, 0.016], { kind: 'glow', shadow: false });
  p.box(PAL.ledWhite, [-0.07, h - 0.15, 0.012], [0.07, h - 0.14, 0.016], { kind: 'glow', shadow: false });
  // 取っ手
  p.box(PAL.steelDark, [hw - 0.04, 1.0, 0.009], [hw - 0.025, 1.3, 0.025], { shadow: false });
}
