import type * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { decalMaterial } from '../../render/Decal.ts';
import { type Atlas, paintMaterial } from '../../scenes/corridor/kit.ts';
import { boxCart, domeCam, flat, floorBand, floorBandZ, handrail, lamp, smoke } from '../../scenes/corridor/props.ts';
import { bar, paper, pin, scribble } from '../../scenes/corridor/tex.ts';
import { CAM0 } from '../../scenes/corridor/seg0.ts';
import type { Doors } from './doors.ts';
import { A_DOORS, LEGS } from './layout.ts';
import type { Leg } from './leg.ts';
import { mountable } from './probe.ts';
import { doorTrimX } from './trim.ts';

/**
 * 脚 A（東の廊下・北へ）= corridor-0。元の版の seg0 を写して、次を変えた:
 * - 左（コア）の凹みの扉・右の窓の並びの扉（3 つ）・突き当たりの両開きの防火戸を、歩いて近づくと開く扉にした（閉じた見た目は元のまま）
 * - 廊下を目の後ろへ延ばし（z 2.5 → 3.26）、その先に角 DA（南の廊下の扉の裏・浴室の扉・病室の壁）を作った
 * - 右の手前の壁（x = 2.3。参考画像の画角の外）に病室とトイレの扉
 * - 床・天井を廊下の幅だけにした（外の部屋の床と重ならない）
 * 区域の座標 = 場面の座標（原点 0・yaw 0）。
 */
export interface LegCtx {
  doors: Doors;
  /**
   * 参考画像の視点の画素からなぞった「描いた影」の材質を登録する。視点から離れる・向きが変わると下の面の色へ溶ける
   * （その視点からだけ影に見える形なので、ほかの所からは見せない）
   */
  fade(view: 'A' | 'B' | 'C' | 'D', mat: THREE.Material, under: string): void;
  /** 扉の裏（部屋の側）の材質 */
  roomWall(id: string): THREE.Material;
  roomDoor(id: string): THREE.Material;
}

type Box4 = [number, number, number, number];

export function buildLegA(s: Leg, atlas: Atlas, paperMat: THREE.Material, lc: LegCtx): void {
  const cam = CAM0;
  const L = LEGS.A;
  const m = (o: Parameters<typeof s.ctx.mat>[0]): THREE.MeshStandardMaterial => s.ctx.mat({ line: 0.5, ...o });
  const H = 2.95; // 天井
  const ZE = L.end; // 突き当たりの壁
  const BK = L.back; // 廊下の手前の端（角 DA の始まり）
  const CE = L.cornerEnd; // 角 DA の奥の壁

  // ---- 材質（参考画像の色をそのまま） ----
  const floor = m(flat('#7d998b', '#42555c', { line: 0.2 }));
  const ceil = m(flat('#8fa493', '#8fa493', { line: 0.3 }));
  const lwall = m(flat('#aab398', undefined, { line: 0.4 }));
  const pale = m(flat('#c6d4b0', undefined, { line: 0.3 }));
  const paleHi = m(flat('#c5d3af', undefined, { line: 0.3 }));
  const pilSide = m(flat('#a3b59d', undefined, { line: 0.3 }));
  // 写っていない所の飾り（dress.ts）が物を貼ってよい面
  mountable(floor, ceil, lwall, pale, paleHi, pilSide);
  const cork = m(flat('#b3b68b', undefined, { line: 0.6 }));
  const frame = m(flat('#d2dcbb', undefined, { line: 1 }));
  const base = m(flat('#3f5159', '#3a4b52', { line: 0.3 }));
  const glass = m(flat('#6f8a88', undefined, { line: 0.8 }));
  const glassDark = m(flat('#41565b', undefined, { line: 0.8 }));
  const glassLight = m(flat('#9cb1a1', undefined, { line: 0.8 }));
  const door = m(flat('#bc6367', undefined, { line: 1 }));
  const doorWin = m(flat('#c7d5b1', undefined, { line: 1 }));
  const lampBody = m(flat('#c7d5b6', undefined, { line: 1 }));
  const lampLens = m({ color: '#effadc', unlit: true, line: 0.6 });
  const camDark = m(flat('#2f3b40', undefined, { line: 0.6 }));
  const white = m(flat('#e3eed3', '#b9c6ae', { line: 1 }));
  const orange = m(flat('#d99b5c', undefined, { line: 1 }));
  const cartTop = m(flat('#c4d1b5', '#9eab93', { line: 1 }));
  const wheel = m(flat('#34434a', undefined, { line: 1 }));
  const metal = m(flat('#9fae98', undefined, { line: 1 }));
  const cabinet = m(flat('#59706c', undefined, { line: 1 }));
  const doorPanel = m(flat('#b9c4a6'));
  const doorEdgeRed = m(flat('#8d5a58'));
  const winFrame = m(flat('#8e4d52', undefined, { line: 0.6 }));
  const scrapM = decalMaterial({ color: '#cedfbf', rag: 0.012, scale: 14, edges: [1, 1, 1, 1] });
  const bandM = decalMaterial({ color: '#3f5159', rag: 0.05, scale: 2.2, edges: [0, 1, 0, 0], step: 0.12 });
  const bandZ = (wz: number, x0: number, x1: number, w = 0.08): void => floorBandZ(s, wz, x0, x1, bandM, w);

  // ---- 床・天井（廊下の幅だけ。角 DA まで） ----
  const LW = -1.72;
  const RWX = 1.5;
  const dx0 = -1.196;
  const dx1 = 1.289;
  const dh = 2.2;
  s.faces([LW, -0.1, ZE], [RWX, 0, CE], { py: floor }, { collide: true });
  s.faces([RWX, -0.1, -2.65], [2.3, 0, CE], { py: floor }, { collide: true });
  s.faces([RWX, -0.1, -5.12], [1.72, 0, -2.65], { py: floor }, { collide: true });
  s.faces([dx0, -0.1, ZE - 0.3], [dx1, 0, ZE], { py: floor }, { collide: true }); // 扉の下
  s.faces([LW, H, ZE], [RWX, H + 0.1, -6.27], { ny: ceil });
  s.faces([-1.3, H, -6.27], [2.3, H + 0.1, CE], { ny: ceil });

  // ---- 左の壁（手前） ----
  // 手前の左の壁は天井が少し高い（参考画像の壁と天井の境に合わせる。段の面は天井と同じ色で線なし）
  const HL = 3.15;
  s.faces([LW - 0.3, 0, -6.27], [LW, HL, BK], { px: lwall }, { collide: true });
  const ceilStep = m(flat('#8fa493', '#8fa493', { line: 0 }));
  s.faces([LW, HL, -6.27], [-1.3, HL + 0.1, CE], { ny: ceilStep });
  s.faces([-1.31, H, -6.27], [-1.3, HL, CE], { px: ceilStep });
  s.faces([LW, H, -6.28], [-1.3, HL, -6.27], { pz: ceilStep });
  s.faces([LW, H, CE], [-1.3, HL, CE + 0.01], { nz: ceilStep });
  floorBand(s, LW, 1, -6.27, BK, bandM, 0.21);
  // 手すりの下の少し暗い面（参考画像の形）
  const railShade = paintMaterial(s.ctx, '#a2aa95');
  lc.fade('A', railShade, '#aab398');
  s.paint(railShade, 'x', LW + 0.003, [
    [268, 712.5], [253.5, 525], [319, 491.5], [322.5, 497], [314.5, 519], [315.5, 539], [318.5, 580], [324.5, 586], [326.5, 600], [328.5, 660],
  ]);
  // 壁の継ぎ目（掲示板の枠の延長）
  s.faces([LW, 0, -3.2], [LW + 0.004, H, -3.18], { px: frame });
  // 掲示板（コルク・クリームの枠）
  const bz0 = 0.6;
  const bz1 = -3.28;
  const by0 = 0.79;
  const by1 = 2.34;
  s.faces([LW, by0, bz1], [LW + 0.012, by1, bz0], { px: cork });
  const fw = 0.045;
  s.faces([LW, by1 - fw, bz1 - 0.02], [LW + 0.03, by1, bz0], { px: frame, py: frame, ny: frame });
  s.faces([LW, by0, bz1 - 0.02], [LW + 0.03, by0 + fw, bz0], { px: frame, py: frame });
  s.faces([LW, by0, bz1 - 0.02], [LW + 0.03, by1, bz1 + 0.02], { px: frame, pz: frame, nz: frame });
  s.faces([LW, by0, bz0 - 0.02], [LW + 0.03, by1, bz0], { px: frame, pz: frame });
  // 掲示板の紙（参考画像の外接矩形）
  const PX = LW + 0.014;
  const hand = (bg: string, seed: number, ink = '#59645f'): Box4 =>
    atlas.add(220, 300, (g, w, h) => {
      paper(g, w, h, bg);
      scribble(g, 26, 60, w - 52, h - 90, { color: ink, row: 38, width: 3, hand: true, seed, skip: 0.45, ragged: 0.6 });
    });
  const plain = (bg: string): Box4 => atlas.add(64, 64, (g, w, h) => paper(g, w, h, bg));
  const papers: [Box4, Box4, number][] = [
    [[115, 45, 222, 272], hand('#adbfa7', 11, '#56625c'), 0.0],
    [[0, 155, 128, 368], hand('#cbdabd', 12), 0.03],
    [[133, 276, 197, 398], plain('#cddcbd'), 0.0],
    [[178, 296, 222, 408], plain('#afc1a7'), 0.0],
    [
      [95, 112, 118, 150],
      atlas.add(64, 96, (g, w, h) => {
        paper(g, w, h, '#d1cfba');
        bar(g, 12, 18, 36, 6, '#6c6f66');
        bar(g, 12, 34, 24, 26, '#8b8c80');
      }),
      0.0,
    ],
    [[37, 157, 64, 186], plain('#ceddbf'), 0.0],
    [
      [200, 266, 226, 307],
      atlas.add(64, 96, (g, w, h) => {
        paper(g, w, h, '#c8d7ba');
        bar(g, 10, 30, 40, 18, '#5d665f');
        scribble(g, 10, 56, 44, 30, { color: '#6d7873', row: 9, width: 2, seed: 14 });
      }),
      0.0,
    ],
    [[0, 486, 32, 552], plain('#cddabc'), 0.0],
  ];
  papers.forEach(([bx, uv, r], i) => s.sheetImg(paperMat, '+x', PX + i * 0.0006, bx, uv, r, 0.97));
  // 掲示板の手前（参考画像の画角の外）にも紙
  const extra = [hand('#cbdabd', 15), hand('#e1e9d0', 16, '#6d7873'), plain('#cddabc')];
  s.sheet(paperMat, '+x', [PX + 0.002, 1.75, 0.15], 0.42, 0.55, extra[0], {}, 0.02);
  s.sheet(paperMat, '+x', [PX + 0.002, 1.2, -0.25], 0.3, 0.4, extra[1], {}, -0.03);
  s.sheet(paperMat, '+x', [PX + 0.002, 1.95, -0.7], 0.25, 0.25, extra[2]);
  const redBox = atlas.add(48, 80, (g, w, h) => {
    paper(g, w, h, '#a5545a', '#5d3539', 4);
    g.fillStyle = '#7c3c42';
    g.fillRect(10, 16, w - 20, h - 32);
  });
  s.sheetImg(paperMat, '+x', PX + 0.006, [217, 311, 237, 349], redBox, 0, 1);
  // 壁の掲示・スイッチ
  const noteA = atlas.add(120, 200, (g, w, h) => {
    paper(g, w, h, '#bacdb1', '#7f8b80', 3);
    bar(g, 10, 12, 30, 40, '#3e4a48');
    scribble(g, 14, 120, w - 28, 60, { color: '#7f8b84', row: 14, width: 2, seed: 21 });
  });
  s.sheetImg(paperMat, '+x', LW + 0.004, [352, 262, 390, 342], noteA, 0, 1);
  const noteB = atlas.add(80, 200, (g, w, h) => {
    paper(g, w, h, '#b6b9a4');
    scribble(g, 10, 20, w - 20, h - 60, { color: '#8a8d80', row: 12, width: 2, seed: 22 });
    bar(g, 6, h - 30, 22, 26, '#9b5a5c');
  });
  s.sheetImg(paperMat, '+x', LW + 0.004, [305, 42, 330, 105], noteB, 0, 1);
  const swTex = atlas.add(32, 32, (g, w, h) => paper(g, w, h, '#c3ccb1', '#8c9586', 3));
  for (const [x, y] of [
    [297, 377],
    [363, 380],
    [423, 362],
    [455, 360],
  ] as [number, number][])
    s.sheetImg(paperMat, '+x', LW + 0.004, [x - 3, y - 6, x + 3, y + 6], swTex, 0, 1);
  // 手すり（角の手前まで）
  handrail(s, white, white, LW, 1, 0.79, BK - 0.15, -6.2, 2.07, 0.065, 0.016, -2.49);
  // 左の低いポール（橙の反射材）
  for (const [x, z] of [
    [-1.4, -4.64],
    [-1.4, -4.91],
    [-1.41, -5.44],
    [-1.45, -6.18],
  ] as [number, number][]) {
    s.cyl(white, [x, 0.015, z], 0.085, 0.03, { segments: 18 });
    s.cyl(white, [x, 0.17, z], 0.024, 0.3, { segments: 10, radiusTop: 0.02 });
    s.cyl(orange, [x, 0.365, z], 0.02, 0.09, { segments: 10 });
  }

  // ---- 左: 柱型 P1〜P3・扉の区画（壁の厚さはコアの部屋の面 x = -2.02 まで） ----
  const RW = LW;
  const pil = (z: number, x0: number, x1: number, d = 0.5): void => {
    s.faces([x0, 0, z - d], [x1, H, z], { pz: pale, px: pale, nz: pale }, { collide: true });
    bandZ(z, x0, x1 + 0.08);
    floorBand(s, x1, 1, z - d, z, bandM, 0.08);
  };
  pil(-6.27, RW, -1.28);
  // P1 の前の面の左の細いガラス（奥の窓）
  s.faces([RW, 1.17, -6.27], [-1.6, 2.8, -6.262], { pz: glass });
  s.faces([-1.6, 1.12, -6.27], [-1.57, 2.8, -6.255], { pz: frame });
  const panel = atlas.add(64, 80, (g, w, h) => {
    paper(g, w, h, '#cad7b6', '#9aa58f', 3);
    pin(g, w - 10, 10, 2, '#6b7468');
    pin(g, w - 10, h - 10, 2, '#6b7468');
  });
  s.sheet(paperMat, '+z', [-1.44, 0.5, -6.265], 0.2, 0.28, panel);
  // P1 と P2 の間: 処置室の扉（引き戸。閉じた見た目は元の版の淡い板と暗い赤の縁）
  const W2 = -1.72;
  const T = A_DOORS.treat;
  s.faces([W2 - 0.3, 0, -10.9], [W2, H, T.z[0]], { px: lwall }, { collide: true });
  s.faces([W2 - 0.3, 0, T.z[1]], [W2, H, -6.75], { px: lwall }, { collide: true });
  s.faces([W2 - 0.3, T.top, T.z[0]], [W2, H, T.z[1]], { px: lwall });
  floorBand(s, W2, 1, -10.9, T.z[0], bandM, 0.1);
  floorBand(s, W2, 1, T.z[1], -6.75, bandM, 0.1);
  s.faces([W2, 0, -6.98], [W2 + 0.04, T.top, -6.93], { px: doorEdgeRed });
  lc.doors.add(s, [W2 - 0.15, 0, (T.z[0] + T.z[1]) / 2], [
    {
      pivot: [W2, 0, T.z[0]],
      slide: { dir: [0, -1], dist: T.z[1] - T.z[0] - 0.05, back: [-0.07, 0] },
      build: (q) => {
        q.faces([W2 - 0.02, 0, T.z[0]], [W2 + 0.03, T.top, T.z[1]], { px: doorPanel, nx: lc.roomDoor('TRT'), pz: doorPanel, nz: doorPanel, py: doorPanel });
        q.faces([W2 + 0.03, 0.85, T.z[1] - 0.14], [W2 + 0.05, 1.2, T.z[1] - 0.11], { px: metal, pz: metal, nz: metal });
      },
    },
  ]);
  pil(-10.9, W2, -1.39, 0.4);
  s.faces([W2 - 0.3, 0, -13.6], [W2, H, -11.3], { px: lwall }, { collide: true });
  pil(-13.6, W2, -1.43, 0.4);
  s.faces([W2 - 0.3, 0, ZE], [-1.44, H, -14.0], { px: pale }, { collide: true });
  // 左の上の梁
  s.faces([RW, 2.82, ZE], [-1.4, H, -6.27], { px: pale, ny: pale, pz: pale });
  // 奥の暗い棚
  s.faces([-1.62, 0, -16.6], [-1.3, 1.1, -16.1], { pz: cabinet, px: cabinet, py: cabinet, nz: cabinet }, { collide: true });

  // ---- 右の壁 ----
  // 手前の大きな柱型（前は明るいクリーム、横は灰緑）と、その前の面の斜めの影
  s.faces([1.39, 0, -3.25], [3.2, H, -2.65], { pz: paleHi, nx: pilSide, nz: pilSide }, { collide: true });
  floorBand(s, 1.39, -1, -3.25, -2.65, bandM, 0.1);
  bandZ(-2.65, 1.3, 2.3, 0.1);
  // 手前の右の壁 x = 2.3（参考画像の画角の外）: トイレと 4 床室の扉。角 DA の右の壁まで続く
  {
    const segs: [number, number][] = [];
    let z0 = -2.65;
    for (const dz of [A_DOORS.e1b, A_DOORS.e1]) {
      segs.push([z0, dz[0]]);
      s.faces([2.3, 2.1, dz[0]], [2.6, H, dz[1]], { nx: pale });
      z0 = dz[1];
    }
    segs.push([z0, CE]);
    for (const [a, b] of segs) {
      s.faces([2.3, 0, a], [2.6, H, b], { nx: pale }, { collide: true });
      floorBand(s, 2.3, -1, a, b, bandM, 0.1);
    }
    // 病室の名札・手指の消毒液
    const plate = atlas.add(96, 32, (g, w, h) => {
      paper(g, w, h, '#e3eed3', '#8f9a88', 2);
      bar(g, 8, 8, 28, 16, '#3f5159');
      scribble(g, 42, 6, 46, 20, { color: '#6d7873', row: 10, width: 2, seed: 31 });
    });
    for (const dz of [A_DOORS.e1b, A_DOORS.e1]) {
      doorTrimX(s, frame, 2.3, -1, dz[0], dz[1], 2.1);
      s.sheet(paperMat, '-x', [2.296, 1.65, dz[0] - 0.25], 0.3, 0.1, plate);
      s.faces([2.22, 1.0, dz[1] + 0.12], [2.3, 1.25, dz[1] + 0.22], { nx: white, py: white, pz: white, nz: white });
    }
  }
  const band = m(flat('#b6c5a6', undefined, { line: 0.2 }));
  s.faces([1.82, 0, -2.65], [1.865, H, -2.645], { pz: band });
  // 右の窓の並びの壁（x = 1.5）: 扉の所（区画 1・3・4）は穴を空ける
  {
    const holes = A_DOORS.bays.map((b) => b.z).sort((a, c) => a[0] - c[0]);
    let z0 = ZE;
    for (const hz of holes) {
      s.faces([RWX, 0, z0], [RWX + 0.3, H, hz[0]], { nx: pale }, { collide: true });
      s.faces([RWX, A_DOORS.bayTop, hz[0]], [RWX + 0.3, H, hz[1]], { nx: pale });
      z0 = hz[1];
    }
    s.faces([RWX, 0, z0], [RWX + 0.3, H, -5.12], { nx: pale }, { collide: true });
  }
  floorBand(s, RWX, -1, ZE, -5.12, bandM, 0.1);
  // 柱型の奥の引っ込み（コルクの扉・掲示・白い管）
  const AW = 1.72;
  s.faces([AW, 0, -5.12], [AW + 0.3, H, -3.25], { nx: pale }, { collide: true });
  s.faces([RWX, 2.82, -5.12], [AW, H, -3.25], { ny: pale, nx: pale });
  s.faces([RWX, 0, -5.42], [AW, H, -5.12], { pz: paleHi }, { collide: true });
  floorBand(s, AW, -1, -5.12, -3.25, bandM, 0.1);
  s.faces([AW - 0.02, 0.15, -4.22], [AW, 2.16, -3.95], { nx: m(flat('#a1a984')) });
  s.faces([AW - 0.04, 0.15, -4.26], [AW, 2.2, -4.22], { nx: frame, pz: frame });
  s.faces([AW - 0.04, 2.16, -4.26], [AW, 2.2, -3.9], { nx: frame, ny: frame });
  s.sheetImg(paperMat, '-x', AW - 0.004, [1153, 344, 1170, 383], atlas.add(32, 64, (g, w, h) => paper(g, w, h, '#496c5b', '#2c4038', 3)), 0, 1);
  // 右の窓の並び（縦長のガラス・奥側の淡い枠・上の桟）と柱型。扉の区画の下のガラスと台は扉の葉に付ける
  for (let i = 0; i < 5; i++) {
    const z = -5.12 - i * 2.35;
    const bay = A_DOORS.bays.find((b) => Math.abs(b.z[1] - (z + 0.15)) < 0.01);
    // 上の欄間の窓・横に出た棚（窓台）
    s.faces([RWX - 0.01, 2.1, z - 0.72], [RWX, 2.78, z], { nx: glass });
    s.faces([RWX - 0.18, 2.03, z - 0.78], [RWX, 2.09, z + 0.02], { nx: frame, py: frame, pz: frame, nz: frame, ny: pilSide });
    s.faces([RWX - 0.06, 2.78, z - 0.75], [RWX, 2.83, z + 0.02], { nx: frame, ny: frame, pz: frame, nz: frame, py: frame });
    s.faces([RWX - 0.05, 0.9, z - 1.0], [RWX, 2.83, z - 0.72], { nx: frame, pz: frame, nz: frame, ny: frame });
    if (bay) {
      // 扉の葉: 壁と同じ淡い色の板・縦長の小窓と下の台。戸袋は奥（-z）の壁の中
      const room = bay.room;
      lc.doors.add(s, [RWX + 0.15, 0, (bay.z[0] + bay.z[1]) / 2], [
        {
          pivot: [RWX, 0, bay.z[1]],
          slide: { dir: [0, -1], dist: bay.z[1] - bay.z[0] - 0.04, back: [0.08, 0] },
          build: (q) => {
            q.faces([RWX, 0, bay.z[0]], [RWX + 0.04, A_DOORS.bayTop, bay.z[1]], { nx: pale, px: lc.roomDoor(room), pz: pale, nz: pale });
            q.faces([RWX - 0.01, 1.1, z - 0.3], [RWX, 2.03, z], { nx: glass });
            q.faces([RWX - 0.06, 1.05, z - 0.33], [RWX, 1.1, z + 0.02], { nx: frame, py: frame, pz: frame });
            q.faces([RWX + 0.04, 1.1, z - 0.3], [RWX + 0.05, 2.03, z], { px: glass });
            q.faces([RWX - 0.03, 0.85, z - 0.62], [RWX, 1.15, z - 0.58], { nx: metal, pz: metal, nz: metal });
          },
        },
      ]);
    } else {
      // 窓だけの区画
      s.faces([RWX - 0.01, 1.1, z - 0.3], [RWX, 2.03, z], { nx: glass });
      s.faces([RWX - 0.06, 1.05, z - 0.33], [RWX, 1.1, z + 0.02], { nx: frame, py: frame, pz: frame, nz: frame, ny: frame });
    }
    if (i >= 1) {
      const zp = z + 0.5;
      // 右の柱型は天井まで届かない（高さ 2.65、上面が見える）
      s.faces([RWX - 0.25, 0, zp - 0.35], [RWX, 2.65, zp], { pz: pale, nx: pilSide, nz: pale, ny: pale, py: pale }, { collide: true });
      floorBand(s, RWX - 0.25, -1, zp - 0.35, zp, bandM, 0.07);
      bandZ(zp, RWX - 0.32, RWX, 0.07);
    }
  }
  // 壁の白い管（取っ手のような金具）
  s.cyl(white, [AW - 0.07, 2.18, -4.35], 0.035, 0.6, { axis: 'z', segments: 10 });
  s.faces([AW - 0.07, 2.14, -4.07], [AW, 2.22, -4.04], { nx: white, pz: white, nz: white, py: white, ny: white });
  // 右の上の梁
  s.faces([1.47, 2.9, ZE], [RWX, H, -3.35], { nx: pale, ny: pale, pz: pale });
  const rnote = atlas.add(200, 220, (g, w, h) => {
    paper(g, w, h, '#ceddbc', '#a6b39b', 2);
    pin(g, w * 0.4, 14, 5, '#b0565c');
    bar(g, w * 0.38, 0, 10, 40, '#c46a6c');
    scribble(g, 30, 120, w - 60, 40, { color: '#a3ad9c', row: 14, width: 2, seed: 23 });
  });
  s.sheetImg(paperMat, '-x', AW - 0.004, [1030, 288, 1095, 360], rnote, 0, 1);

  // ---- 突き当たり: 両開きの防火戸（欄間・枠は動かない。窓と取っ手は扉の葉に付ける） ----
  s.faces([-1.8, 0, ZE - 0.3], [dx0, H, ZE], { pz: pale }, { collide: true });
  s.faces([dx1, 0, ZE - 0.3], [1.8, H, ZE], { pz: pale }, { collide: true });
  s.faces([dx0, dh, ZE - 0.3], [dx1, H, ZE], { pz: pale });
  // 扉の口の内側の面（扉を開けたときに見える）
  s.faces([dx0 - 0.002, 0, ZE - 0.3], [dx0, dh, ZE], { px: frame });
  s.faces([dx1, 0, ZE - 0.3], [dx1 + 0.002, dh, ZE], { nx: frame });
  s.faces([dx0, dh, ZE - 0.3], [dx1, dh + 0.002, ZE], { ny: frame });
  const mid = 0.0;
  const leaf = (q: Leg, a: number, c: number, win: [number, number], hx: number, strip: [number, number]): void => {
    // 表（廊下 A の側）と裏（角 AB の側）
    q.faces([a, 0, ZE - 0.05], [c, dh, ZE + 0.03], { pz: door, nz: door, px: door, nx: door, py: door });
    q.faces([strip[0], 0, ZE], [strip[1], dh, ZE + 0.035], { pz: base, nz: base });
    for (const zz of [ZE + 0.032, ZE - 0.052]) {
      const sg = zz > ZE ? 1 : -1;
      const fz0 = sg > 0 ? zz - 0.002 : zz;
      const fz1 = sg > 0 ? zz : zz + 0.002;
      q.faces([win[0] - 0.03, 1.25, fz0], [win[1] + 0.03, 1.99, fz1], sg > 0 ? { pz: winFrame } : { nz: winFrame });
      q.faces([win[0], 1.28, sg > 0 ? zz : zz - 0.004], [win[1], 1.96, sg > 0 ? zz + 0.004 : zz], sg > 0 ? { pz: doorWin } : { nz: doorWin });
    }
    q.faces([hx - 0.02, 1.36, ZE], [hx + 0.02, 1.6, ZE + 0.06], { pz: white, px: white, nx: white, py: white, ny: white });
    q.faces([hx - 0.02, 0.84, ZE], [hx + 0.02, 1.19, ZE + 0.06], { pz: white, px: white, nx: white, py: white, ny: white });
    q.faces([a + 0.1, 0.95, ZE - 0.1], [c - 0.1, 1.0, ZE - 0.05], { nz: metal, py: metal, ny: metal });
  };
  lc.doors.add(s, [(dx0 + dx1) / 2, 0, ZE - 0.15], [
    { pivot: [dx0, 0, ZE - 0.05], swing: Math.PI / 2 - 0.08, build: (q) => leaf(q, dx0, mid, [-0.96, -0.2], mid - 0.11, [mid - 0.006, mid]) },
    { pivot: [dx1, 0, ZE - 0.05], swing: -Math.PI / 2 + 0.08, build: (q) => leaf(q, mid, dx1, [0.26, 1.0], mid + 0.11, [mid, mid + 0.006]) },
  ], { radius: 2.2 });
  s.faces([dx0 - 0.09, 0, ZE], [dx0, 2.9, ZE + 0.04], { pz: frame, px: frame, nx: frame });
  s.faces([dx1, 0, ZE], [dx1 + 0.09, 2.9, ZE + 0.04], { pz: frame, nx: frame, px: frame });
  s.faces([dx0, dh, ZE], [dx1, dh + 0.09, ZE + 0.04], { pz: frame, ny: frame });
  s.faces([dx0, 2.86, ZE], [dx1, 2.92, ZE + 0.04], { pz: frame, ny: frame, py: frame });
  const dm = (dx0 + dx1) / 2;
  s.faces([dx0, dh + 0.09, ZE], [dm, 2.86, ZE + 0.01], { pz: glassLight });
  s.faces([dm, dh + 0.09, ZE], [dx1, 2.86, ZE + 0.01], { pz: glassDark });
  s.faces([dm - 0.02, dh + 0.09, ZE], [dm + 0.02, 2.86, ZE + 0.04], { pz: frame });
  // 防火戸の表示（扉の上の壁）
  const fireSign = atlas.add(128, 40, (g, w, h) => {
    paper(g, w, h, '#e3eed3', '#8e4d52', 3);
    bar(g, 10, 10, 20, 20, '#bc6367');
    scribble(g, 38, 8, w - 48, 24, { color: '#5d665f', row: 12, width: 2.5, seed: 51 });
  });
  s.sheet(paperMat, '+z', [-1.5, 2.55, ZE + 0.005], 0.42, 0.13, fireSign);

  // ---- 角 DA（目の後ろ、z 3.26〜5.55）: 左は南の廊下（脚 D）の防火戸の裏、奥は浴室の扉 ----
  {
    const LD = LEGS.D;
    // 脚 D の扉の口（場面の z）。脚 D の区域 x → 場面 z = 4.38 + x
    const dz0 = LD.origin[2] - 1.0;
    const dz1 = LD.origin[2] + 0.64;
    const dTop = 1.83;
    s.faces([LW - 0.3, 0, BK], [LW, HL, dz0], { px: lwall }, { collide: true });
    s.faces([LW - 0.3, 0, dz1], [LW, HL, CE], { px: lwall }, { collide: true });
    s.faces([LW - 0.3, dTop, dz0], [LW, HL, dz1], { px: lwall });
    // 裏から見た欄間（暗いガラス）・横の淡いガラス・扉の枠
    s.faces([LW, 1.97, dz0 + 0.02], [LW + 0.01, 2.32, dz1 - 0.02], { px: glassDark });
    // 横の淡いガラス（脚 D の区域 x 0.68〜0.92）の裏
    s.faces([LW, 0.35, LD.origin[2] + 0.68], [LW + 0.01, 1.8, LD.origin[2] + 0.92], { px: m(flat('#c0e7c8', undefined, { line: 0.6 })) });
    s.faces([LW, dTop, dz0 - 0.06], [LW + 0.04, dTop + 0.06, dz1 + 0.06], { px: frame, ny: frame, py: frame });
    s.faces([LW, 0, dz0 - 0.06], [LW + 0.04, dTop, dz0], { px: frame, pz: frame, nz: frame });
    s.faces([LW, 0, dz1], [LW + 0.04, dTop, dz1 + 0.06], { px: frame, pz: frame, nz: frame });
    floorBand(s, LW, 1, BK, dz0 - 0.06, bandM, 0.1);
    floorBand(s, LW, 1, dz1 + 0.06, CE, bandM, 0.1);
    // 奥（z = 5.55）: 脱衣室・浴室の扉
    const bx = A_DOORS.bath;
    s.faces([LW, 0, CE], [bx[0], H, CE + 0.375], { nz: pale }, { collide: true });
    s.faces([bx[1], 0, CE], [2.6, H, CE + 0.375], { nz: pale }, { collide: true });
    s.faces([bx[0], 2.1, CE], [bx[1], H, CE + 0.375], { nz: pale });
    bandZ(CE, LW, bx[0], 0.1);
    s.faces([bx[0] - 0.05, 0, CE - 0.02], [bx[0], 2.15, CE], { nz: frame, nx: frame });
    s.faces([bx[1], 0, CE - 0.02], [bx[1] + 0.05, 2.15, CE], { nz: frame, px: frame });
    s.faces([bx[0], 2.1, CE - 0.02], [bx[1], 2.15, CE], { nz: frame, ny: frame });
    const bathSign = atlas.add(128, 48, (g, w, h) => {
      paper(g, w, h, '#e3eed3', '#3f5159', 3);
      bar(g, 10, 10, 28, 28, '#5a797b');
      scribble(g, 46, 12, w - 56, 24, { color: '#3f5159', row: 12, width: 3, seed: 52 });
    });
    s.sheet(paperMat, '-z', [(bx[0] + bx[1]) / 2, 2.35, CE - 0.004], 0.4, 0.15, bathSign);
    // 角の灯り・感知器
    lamp(s, lampBody, lampLens, [0.2, H, 4.4], 1.3, 0.3, 0.07);
    smoke(s, lampBody, [-0.6, H, 3.6]);
  }

  // ---- 天井の灯り・カメラ・感知器・換気口 ----
  for (const [z, len] of [
    [-7.25, 1.7],
    [-11.0, 1.6],
    [-14.3, 1.45],
  ] as [number, number][])
    lamp(s, lampBody, lampLens, [0, H, z], len, 0.32, 0.07);
  // 目の後ろの灯り（参考画像の画角の外）
  lamp(s, lampBody, lampLens, [0, H, 0.9], 1.6, 0.32, 0.07);
  domeCam(s, lampBody, camDark, [-0.07, H, -4.75], 1.05);
  domeCam(s, lampBody, camDark, [0.12, H, -14.0], 0.9);
  smoke(s, lampBody, [-0.02, H, -6.3]);
  smoke(s, lampBody, [0.0, H, -9.6]);
  const vent = m(flat('#a1b4a2', undefined, { line: 1 }));
  s.faces([-1.5, H - 0.01, -5.95], [-0.88, H, -5.5], { ny: vent });
  s.faces([0.22, H - 0.01, -5.8], [0.7, H, -5.4], { ny: vent });
  s.faces([1.0, H - 0.01, -6.6], [1.37, H, -6.0], { ny: vent });

  // ---- 小物 ----
  const cartFrontM = m(flat('#a8b79a', '#8f9c84', { line: 1 }));
  const cartSideM = m(flat('#b9cdb0', undefined, { line: 1 }));
  const cartFront = m(flat('#c9d7bb', '#a8b49c', { line: 1 }));
  boxCart(s, { front: cartFrontM, side: cartSideM, top: cartTop, wheel, metal, base: metal }, [0.75, 0, -5.3], [1.21, 1.06, -3.96], { wheelR: 0.055, inset: 0.07 });
  s.faces([0.75, 0.17, -3.959], [0.8, 1.06, -3.955], { pz: cartFront });
  s.faces([0.78, 1.06, -4.45], [1.03, 1.53, -4.15], { pz: white, nx: white, py: white, px: white, nz: white }, { shadow: true });
  s.faces([0.8, 1.06, -4.1], [1.03, 1.24, -3.98], { pz: m(flat('#ccdaba')), nx: white, py: white, px: white }, { shadow: true });
  // 箱の積み重ね（暗い台の上。カートの右手前）
  s.faces([1.19, 0, -4.3], [1.64, 0.17, -3.8], { pz: base, nx: base, py: base, px: base, nz: base }, { collide: true, shadow: true });
  const boxF = m(flat('#cddcbb', undefined, { line: 0.6 }));
  s.faces([1.19, 0.17, -4.3], [1.64, 0.68, -3.8], { pz: boxF, nx: pale, py: pale, px: pale, nz: pale }, { shadow: true });
  s.faces([1.21, 0.68, -4.28], [1.64, 1.19, -3.82], { pz: boxF, nx: pale, py: pale, px: pale, nz: pale }, { shadow: true });
  // 手前右の機械（暗い台の上の白い箱）
  s.faces([1.22, 0, -2.55], [1.42, 0.18, -2.4], { pz: base, nx: base, px: base, nz: base }, { collide: true, shadow: true });
  s.faces([1.19, 0.18, -2.56], [1.43, 0.3, -2.36], { pz: white, nx: white, px: white, nz: white }, { shadow: true });
  const devTop = atlas.add(96, 80, (g, w, h) => {
    paper(g, w, h, '#dfe9d0', '#8f9a88', 3);
    bar(g, 26, 16, 44, 30, '#7f9593');
    bar(g, 30, 20, 36, 22, '#a9c0bd');
  });
  s.sheet(paperMat, '+y', [1.31, 0.301, -2.46], 0.24, 0.2, devTop);
  s.cyl(white, [1.17, 0.2, -2.34], 0.01, 0.4, { segments: 8 });
  // 右の柱型の掲示
  const noteC = atlas.add(300, 260, (g, w, h) => {
    paper(g, w, h, '#cddcbb', '#a3ae9c', 2);
    pin(g, w - 20, 20, 4, '#4d5752');
    pin(g, 40, 30, 8, '#dfe9cf');
  });
  s.sheetImg(paperMat, '+z', -2.644, [1252, 222, 1440, 412], noteC, -0.07, 0.97);
  const redSign = atlas.add(96, 96, (g, w, h) => {
    paper(g, w, h, '#c05d60', '#8e3f45', 4);
    g.strokeStyle = '#6d3036';
    g.lineWidth = 4;
    g.strokeRect(22, 18, w - 44, h - 46);
    g.fillStyle = '#6d3036';
    g.fillRect(30, h - 22, w - 60, 4);
  });
  s.sheetImg(paperMat, '+z', -2.644, [1280, 425, 1330, 472], redSign, 0, 1);
  s.sheetImg(paperMat, '+z', -2.644, [1240, 325, 1256, 355], atlas.add(32, 48, (g, w, h) => paper(g, w, h, '#bd7370')), 0, 1);

  // ---- 床の紙くず ----
  const fl = (x: number, y: number): V3 => {
    const [px, pz] = cam.floor(x, y, 0.002);
    return [px, 0.002, pz];
  };
  const scraps: Box4[] = [
    [617, 725, 661, 734],
    [713, 667, 743, 677],
    [1054, 736, 1084, 752],
    [307, 706, 336, 719],
    [255, 742, 282, 756],
    [933, 618, 950, 626],
    [1070, 629, 1100, 638],
    [472, 578, 520, 584],
    [482, 528, 506, 537],
    [533, 529, 553, 532],
    [833, 460, 855, 466],
    [790, 419, 805, 423],
    [776, 427, 790, 431],
    [828, 445, 845, 449],
    [548, 509, 566, 512],
    [404, 618, 418, 624],
  ];
  for (const [x0, y0, x1, y1] of scraps) s.quad(scrapM, fl(x0, y1), fl(x1, y1), fl(x1, y0), fl(x0, y0));
  // 目の後ろの床にも少し
  for (const [x, z, w] of [
    [0.4, 1.2, 0.1],
    [-0.9, 2.4, 0.07],
    [1.1, 4.1, 0.09],
  ] as [number, number, number][])
    s.quad(scrapM, [x, 0.002, z + w * 0.4], [x + w, 0.002, z + w * 0.4], [x + w, 0.002, z], [x, 0.002, z]);
}
