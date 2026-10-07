import * as THREE from 'three';
import { T, type Kit } from '../../scenes/pool/kit.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { Frame } from './frame.ts';
import { perimeterWall, type HallEnv } from './hallkit.ts';
import { hallDress } from './halldress.ts';
import { HALL } from './layout.ts';
import { backstrokeFlags, clock, decal, deckBench, depthMark, drain, exitSign, laneRope, lifeguardChair, paceClock, plant, poolLadder, rescueBoard, shelf, startBlock, wallNotice, type Dress } from './props.ts';

/**
 * ホール E「25 m プール」（参考画像なし）。競泳用の 25 m × 6 コース（水深 1.2 m）・幼児用プール（0.4 m）・北の観覧の段。
 * 屋根は 7 m おきの大梁（スパン 34.5 m、柱は南北の壁の中）と、梁の間の天窓の帯。日の光は実際の屋根と天窓の影で落とす（見えない板は使わない）。
 * 見た目は A〜D と同じ材質の描き方（白いタイル・青緑の陰）で、色は pool-0 の色の表から。
 */
export const SUN_E: [number, number, number] = [-0.35, -0.8, 0.45];

/** 長方形の床から、穴（プールの口）を除いた所を、x の区切りごとの帯にして置く */
export function deckAround(k: Kit, mat: THREE.Material, r: [number, number, number, number], holes: [number, number, number, number][], top: number): void {
  const xs = [...new Set([r[0], r[2], ...holes.flatMap((h) => [h[0], h[2]])])].filter((x) => x >= r[0] && x <= r[2]).sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const xa = xs[i];
    const xb = xs[i + 1];
    const xm = (xa + xb) / 2;
    const cut = holes.filter((h) => xm > h[0] && xm < h[2]).map((h) => [h[1], h[3]] as [number, number]).sort((a, b) => a[0] - b[0]);
    let z = r[1];
    for (const [za, zb] of cut) {
      if (za > z) k.deck(mat, xa, z, xb, za, top);
      z = Math.max(z, zb);
    }
    if (z < r[3]) k.deck(mat, xa, z, xb, r[3], top);
  }
}

export function buildHallE(env: HallEnv, dr: Dress, ctx: SceneContext): void {
  const k = env.k;
  const b = k.b;
  const m = ctx.mat;
  const tl = (grout: string, size = T) => ({ size, line: 0.012, color: grout, jitter: 0.02 });
  const deckM = m({ name: 'e-deck', color: '#e7f0e2', hi: '#f2f6ec', shade: '#557f79', dark: '#46706c', tiles: tl('#b3c4b8') });
  const wallM = m({ name: 'e-wall', color: '#eef2e7', hi: '#f6f8f1', shade: '#7f9d91', dark: '#678f87', tiles: tl('#cbd6ca', 2 * T) });
  const edgeM = m({ name: 'e-edge', color: '#d8e6de', hi: '#e9f1ea', shade: '#8fb1a8', dark: '#729a91', tiles: tl('#a9c1b6') });
  const beamM = m({ name: 'e-beam', color: '#e9eee4', hi: '#f2f5ec', shade: '#9db6a8', dark: '#7aa39c', tiles: tl('#c7d3c9', 2 * T) });
  const barM = m({ name: 'e-bar', color: '#6f8f8b', shade: '#5c7b77', dark: '#4c6a66', hi: '#7f9d99' });
  const accentM = m({ name: 'e-accent', color: '#6aa39a', hi: '#7fb3aa', shade: '#558b83', dark: '#467a73', tiles: tl('#5f978e') });
  const [x0, z0, x1, z1] = HALL.E.rect;
  const DECK = 0.15;
  const CEIL = HALL.E.ceil;

  // 25 m プール（6 コース × 2 m + 両端 0.5 m = 13 m）と幼児用プール
  const P = { x0: 35, x1: 60, z0: -66, z1: -53 };
  const K = { x0: 26, x1: 32.5, z0: -57, z1: -48.5 };
  // 床（プールサイド）: プールの口を除いた長方形の帯に分けて置く
  deckAround(k, deckM, [x0, z0, x1, z1], [[P.x0, P.z0, P.x1, P.z1], [K.x0, K.z0, K.x1, K.z1]], DECK);
  k.basin(P.x0, P.z0, P.x1, P.z1, -1.2);
  k.basin(P.x0, P.z0, P.x0 + 5, P.z1, -1.0);
  k.basin(K.x0, K.z0, K.x1, K.z1, -0.4);
  // 縁の青緑のタイルの帯（プールの縁・幼児用プールの縁）
  for (const r of [P, K]) {
    const w = 0.3;
    k.b.boxMM(edgeM, [r.x0 - w, DECK - 0.02, r.z0 - w], [r.x1 + w, DECK + 0.002, r.z0], { shadow: 'receive' });
    k.b.boxMM(edgeM, [r.x0 - w, DECK - 0.02, r.z1], [r.x1 + w, DECK + 0.002, r.z1 + w], { shadow: 'receive' });
    k.b.boxMM(edgeM, [r.x0 - w, DECK - 0.02, r.z0], [r.x0, DECK + 0.002, r.z1], { shadow: 'receive' });
    k.b.boxMM(edgeM, [r.x1, DECK - 0.02, r.z0], [r.x1 + w, DECK + 0.002, r.z1], { shadow: 'receive' });
  }
  // 北の観覧の段（3 段）
  for (let i = 0; i < 3; i++) k.box(wallM, [36, -2, z0 + 0.0], [60, DECK + 0.34 * (i + 1), z0 + 3.0 - i * 1.0], { collide: true });
  for (let i = 0; i < 3; i++) k.b.boxMM(accentM, [36, DECK + 0.34 * (i + 1), z0 + 2.95 - i * 1.0], [60, DECK + 0.34 * (i + 1) + 0.02, z0 + 3.0 - i * 1.0], { shadow: 'receive' });

  // 外周の壁（南は B の北の壁の上の部分だけ足す。西: D との間の通路の扉、北・東: 外壁と高い窓）
  k.box(wallM, [x0 - 1, 4.4, z1], [x1 + 1, CEIL + 0.3, z1 + 1], { collide: true });
  perimeterWall(env, 'E', 'w', wallM, { y1: CEIL + 0.3 });
  const win = (n: number, len: number, off: number) => Array.from({ length: n }, (_, i) => ({ at: off + (i + 0.5) * (len / n), width: len / n - 1.2, bottom: 3.2, top: 5.4 }));
  perimeterWall(env, 'E', 'n', wallM, { y1: CEIL + 0.3, extra: win(7, 49.5, 1) });
  perimeterWall(env, 'E', 'e', wallM, { y1: CEIL + 0.3, extra: win(5, 34.5, 1) });
  // 高い窓のガラス（すりガラス。外の光で明るい）
  const glow = m({ name: 'e-window', color: '#eef6f2', unlit: true, line: 0.2 });
  for (const h of win(7, 49.5, 1)) b.boxMM(glow, [x0 - 1 + h.at - h.width / 2, h.bottom, z0 - 0.55], [x0 - 1 + h.at + h.width / 2, h.top, z0 - 0.5], { shadow: false });
  for (const h of win(5, 34.5, 1)) b.boxMM(glow, [x1 + 0.5, h.bottom, z0 - 1 + h.at - h.width / 2], [x1 + 0.55, h.top, z0 - 1 + h.at + h.width / 2], { shadow: false });

  // 屋根: 7 m おきの大梁（南北に架ける）・梁の間の天窓の帯・壁の中の柱型
  const girders: number[] = [];
  for (let x = x0 + 3.5; x < x1; x += 7) girders.push(x);
  for (const x of girders) {
    k.box(beamM, [x - 0.4, CEIL - 1.3, z0], [x + 0.4, CEIL, z1]);
    k.box(wallM, [x - 0.5, DECK, z0], [x + 0.5, CEIL - 1.3, z0 + 0.4], { collide: true });
    k.box(wallM, [x - 0.5, DECK, z1 - 0.4], [x + 0.5, CEIL - 1.3, z1], { collide: true });
  }
  // 天窓: 大梁の間の真ん中 2.4 m（南北に長い帯）。桟は 1.2 m おき
  const edges = [x0, ...girders.map((x) => x - 0.4), x1];
  for (let i = 0; i < girders.length + 1; i++) {
    const a = i === 0 ? x0 : girders[i - 1] + 0.4;
    const c = i === girders.length ? x1 : girders[i] - 0.4;
    const mid = (a + c) / 2;
    const half = i === 0 || i === girders.length ? 0 : 1.2;
    if (half > 0) {
      k.box(beamM, [a, CEIL, z0], [mid - half, CEIL + 0.3, z1]);
      k.box(beamM, [mid + half, CEIL, z0], [c, CEIL + 0.3, z1]);
      for (let z = z0 + 1.2; z < z1; z += 1.2) b.boxMM(barM, [mid - half, CEIL + 0.2, z - 0.04], [mid + half, CEIL + 0.3, z + 0.04], { shadow: true });
    } else k.box(beamM, [a, CEIL, z0], [c, CEIL + 0.3, z1]);
  }
  void edges;
  // 空（天窓から見える明るい面）
  b.boxMM(m({ name: 'e-sky', color: '#dcece8', unlit: true, noFog: true, line: 0 }), [x0 - 10, 18, z0 - 10], [x1 + 10, 18.2, z1 + 10], { shadow: false });

  // ---- 25 m プールの物 ----
  const F = (x: number, z: number, kk: number, y = DECK): Frame => new Frame(b, [x, y, z], kk);
  for (let i = 0; i < 6; i++) startBlock(dr, F(P.x0, P.z0 + 1.5 + i * 2, 1), i + 1);
  for (let i = 1; i < 6; i++) laneRope(dr, F((P.x0 + P.x1) / 2, P.z0 + 0.5 + i * 2, 0, 0), 25);
  backstrokeFlags(dr, F(P.x0 + 5, (P.z0 + P.z1) / 2, 1, DECK), 14.2);
  backstrokeFlags(dr, F(P.x1 - 5, (P.z0 + P.z1) / 2, 1, DECK), 14.2);
  for (const x of [37.0, 58.0]) {
    poolLadder(dr, F(x, P.z1, 2), 1.2);
    poolLadder(dr, F(x, P.z0, 0), 1.2);
  }
  lifeguardChair(dr, F(47.5, P.z1 + 1.6, 2));
  for (const x of [38.5, 47.5, 56.5]) depthMark(dr, F(x, P.z1 + 0.15, 2), x < 40 ? 1.0 : 1.2);
  depthMark(dr, F(K.x1 + 0.15, -52.5, 3), 0.4);
  poolLadder(dr, F(K.x0 + 3, K.z1, 2), 0.4);
  for (const x of [28, 40, 52, 64]) drain(dr, F(x, -46.0, 0), 0.6, 0.3);
  // 南の壁ぞい: ベンチ・ビート板の棚・救命浮環・時計・掲示
  for (const x of [38.0, 44.0, 52.0, 58.0]) deckBench(dr, F(x, z1 - 0.6, 2), 2.6);
  const S = (x: number): Frame => new Frame(b, [x, 0, z1], 2);
  shelf(dr, S(64.5).sub(0, 0.5), 2.0, 1.6, 0.5, 'float');
  shelf(dr, S(67.0).sub(0, 0.5), 2.0, 1.6, 0.5, 'float');
  rescueBoard(dr, S(48.5));
  clock(dr, S(47.5), 3.6, 0.35);
  wallNotice(dr, S(34.0), dr.signs.notice(131), 0.6, 0.8, 1.6);
  wallNotice(dr, S(35.0), dr.signs.caution(132, 'dive'), 0.5, 0.62, 1.6);
  wallNotice(dr, S(41.0), dr.signs.board(133), 1.6, 1.0, 1.7);
  decal(S(25.5), dr.signs.label('柱の森へ'), [0, 2.6, 0.01], 1.2, 0.3);
  exitSign(dr, S(25.5), 2.95);
  // 東の壁: ペースクロック・コースの番号
  const E = (z: number): Frame => new Frame(b, [x1, 0, z], 3);
  paceClock(dr, E((P.z0 + P.z1) / 2), 2.6);
  decal(E(-48.0), dr.signs.label('25m プール'), [0, 3.0, 0.01], 2.0, 0.5);
  // 西の壁: 案内・非常口
  decal(new Frame(b, [x0, 0, -45.5], 1), dr.signs.label('通路', '←'), [0, 2.75, 0.01], 1.0, 0.25);
  exitSign(dr, new Frame(b, [x0, 0, -45.5], 1), 2.45);
  plant(dr, F(x0 + 0.8, z0 + 0.8, 0), 1.2);
  plant(dr, F(x1 - 0.8, z0 + 0.8, 0), 1.2);
  plant(dr, F(x1 - 0.8, z1 - 0.8, 0), 1.2);
  // 外周の壁の柱型（高窓の間）・腰の帯・蛇腹
  const gapsN = Array.from({ length: 6 }, (_, i) => x0 + (i + 1) * (49.5 / 7));
  const gapsE = Array.from({ length: 4 }, (_, i) => z0 + (i + 1) * (34.5 / 5));
  hallDress(env, 'E', { pier: wallM, ceil: CEIL, sun: new THREE.Vector3(...SUN_E), positions: { n: gapsN, e: gapsE } });
  // 幼児用プールの柵（低い手すり）
  const rail = m({ name: 'e-rail', color: '#e2e9e6', shade: '#aebdb7', dark: '#8fa29b', hi: '#eef3f0' });
  for (const [ax, az, bx, bz] of [[K.x0 - 0.6, K.z0 - 0.6, K.x1 + 0.6, K.z0 - 0.6], [K.x1 + 0.6, K.z0 - 0.6, K.x1 + 0.6, K.z1 - 2.0]] as [number, number, number, number][]) {
    const len = Math.hypot(bx - ax, bz - az);
    const g = new THREE.BoxGeometry(az === bz ? len : 0.04, 0.04, az === bz ? 0.04 : len);
    b.mesh(g, rail, [(ax + bx) / 2, DECK + 0.8, (az + bz) / 2], { shadow: true });
    for (let t = 0; t <= len; t += 1.2) {
      const px = ax + ((bx - ax) * t) / len;
      const pz = az + ((bz - az) * t) / len;
      b.boxMM(rail, [px - 0.02, DECK, pz - 0.02], [px + 0.02, DECK + 0.8, pz + 0.02], { shadow: true, collide: true });
    }
  }
}
