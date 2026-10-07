import type * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { decalMaterial } from '../../render/Decal.ts';
import { type Atlas, paintMaterial } from '../../scenes/corridor/kit.ts';
import { boxCart, domeCam, flat, lamp, smoke } from '../../scenes/corridor/props.ts';
import { bar, paper, scribble, stamp } from '../../scenes/corridor/tex.ts';
import { CAM1 } from '../../scenes/corridor/seg1.ts';
import { LEGS } from './layout.ts';
import type { Leg } from './leg.ts';
import { mountable } from './probe.ts';
import type { LegCtx } from './legA.ts';
import { doorTrimX, wallX } from './trim.ts';

/**
 * 脚 B（北の廊下・西へ）= corridor-1。元の版の seg1 を写して、次を変えた:
 * - 突き当たりの両開きの防火戸を開く扉に（閉じた見た目は元のまま）
 * - 目の後ろへ延ばし（z 2.5 → 6.0）、左（コア）にエレベーターホールの口、右に病室と観察室の扉（参考画像の画角の外）
 * - その先に角 AB（東の廊下の防火戸の裏・北階段の扉・個室の扉）
 * 区域の座標: 原点 (-7.72, -19.09)、yaw +π/2（区域の -Z = 場面の -X = 西）。左 = 南（コア）、右 = 北（外の部屋）。
 */
export function buildLegB(s: Leg, atlas: Atlas, paperMat: THREE.Material, lc: LegCtx): void {
  const cam = CAM1;
  const L = LEGS.B;
  const m = (o: Parameters<typeof s.ctx.mat>[0]): THREE.MeshStandardMaterial => s.ctx.mat({ line: 0.0, ...o });
  const H = 2.84;
  const ZE = L.end;
  const BK = L.back;
  const CE = L.cornerEnd;
  const toLocalZ = (xw: number): number => xw - L.origin[0];

  const floor = m(flat('#e4ead0', '#c9cfb5'));
  const ceil = m(flat('#889e89', '#889e89'));
  const khaki = m(flat('#c4c9a1'));
  const grey = m(flat('#889d89'));
  const endW = m(flat('#c7cba6'));
  // 写っていない所の飾り（dress.ts）が物を貼ってよい面
  mountable(floor, ceil, khaki, grey, endW);
  const baseD = m(flat('#415553'));
  const baseR = m(flat('#676c63'));
  const door = m(flat('#b1685f', undefined, { line: 0.3 }));
  const doorWin = m(flat('#dbe5cc'));
  const glass = m(flat('#808e7c'));
  const glassL = m(flat('#9fb1a0'));
  const frameP = m(flat('#dae4cb'));
  const lampBody = m(flat('#bdd9c0'));
  const lampLens = m({ color: '#fbfdf3', unlit: true, line: 0 });
  const camDark = m(flat('#171719'));
  const cartGrey = m(flat('#889e89', '#73867a'));
  const cartTop = m(flat('#f4f8e4', '#cbd5bd'));
  const wheel = m(flat('#26302f'));
  const metal = m(flat('#3c4847'));
  const medFront = m(flat('#a3bfa9'));
  const medTop = m(flat('#fbfee6', '#d9e0c8'));
  const binM = m(flat('#d8e1c8'));
  const doorLine = m(flat('#8c4f49'));
  const lightPaint = decalMaterial({ color: '#f3f9df', rag: 0.035, scale: 5 });

  const LW = -1.6;
  const RW = 1.45;
  const dx0 = -0.92;
  const dx1 = 1.02;
  const dmid = (dx0 + dx1) / 2;
  const dTop = 2.06;
  // エレベーターホールの口（区域 z）・右の扉（区域 z）
  const ev: [number, number] = [2.72, 5.42];
  const rightDoors: [number, number][] = [
    [toLocalZ(-8.45), toLocalZ(-7.45)], // 重症観察室
    [toLocalZ(-4.4), toLocalZ(-3.2)], // 4 床室 510
    [toLocalZ(-1.2), toLocalZ(1.0)], // 北階段
  ];

  // ---- 床・天井・突き当たり ----
  s.faces([LW, -0.1, ZE], [RW, 0, CE], { py: floor }, { collide: true });
  s.faces([-1.8, -0.1, -2.18], [LW, 0, 5.42], { py: floor }, { collide: true });
  s.faces([dx0, -0.1, ZE - 0.3], [dx1, 0, ZE], { py: floor }, { collide: true });
  s.faces([-1.8, H, ZE], [RW, H + 0.1, CE], { ny: ceil });
  s.faces([-1.7, 0, ZE - 0.3], [dx0, H, ZE], { pz: endW }, { collide: true });
  s.faces([dx1, 0, ZE - 0.3], [1.6, H, ZE], { pz: endW }, { collide: true });
  s.faces([dx0, dTop, ZE - 0.3], [dx1, H, ZE], { pz: endW });
  s.faces([dx0 - 0.002, 0, ZE - 0.3], [dx0, dTop, ZE], { px: frameP });
  s.faces([dx1, 0, ZE - 0.3], [dx1 + 0.002, dTop, ZE], { nx: frameP });
  s.faces([dx0, dTop, ZE - 0.3], [dx1, dTop + 0.002, ZE], { ny: frameP });
  // 欄間（扉の色の枠と白い板・横の暗い桟）は動かない。扉の葉は 2.06 まで
  s.faces([dx0, dTop, ZE], [dx1, 2.53, ZE + 0.03], { pz: door });
  s.faces([-0.87, 2.21, ZE], [0.94, 2.5, ZE + 0.035], { pz: doorWin });
  s.faces([dx0, 2.06, ZE], [dx1, 2.09, ZE + 0.04], { pz: baseD });
  const leaf = (q: Leg, a: number, c: number, win: [number, number], hx: number, line: [number, number]): void => {
    q.faces([a, 0, ZE - 0.05], [c, dTop - 0.002, ZE + 0.03], { pz: door, nz: door, px: door, nx: door });
    q.faces([line[0], 0, ZE], [line[1], dTop - 0.03, ZE + 0.035], { pz: doorLine, nz: doorLine });
    q.faces([win[0], 1.225, ZE + 0.03], [win[1], 1.73, ZE + 0.035], { pz: doorWin });
    q.faces([win[0], 1.225, ZE - 0.055], [win[1], 1.73, ZE - 0.05], { nz: doorWin });
    q.faces([hx - 0.025, 0.92, ZE], [hx + 0.025, 1.12, ZE + 0.06], { pz: frameP, px: frameP, nx: frameP, py: frameP, ny: frameP });
    q.faces([a + 0.1, 0.95, ZE - 0.1], [c - 0.1, 1.0, ZE - 0.05], { nz: metal, py: metal, ny: metal });
  };
  lc.doors.add(s, [dmid, 0, ZE - 0.15], [
    { pivot: [dx0, 0, ZE - 0.05], swing: Math.PI / 2 - 0.08, build: (q) => leaf(q, dx0, dmid, [-0.615, -0.242], dmid - 0.1, [dmid - 0.004, dmid]) },
    { pivot: [dx1, 0, ZE - 0.05], swing: -Math.PI / 2 + 0.08, build: (q) => leaf(q, dmid, dx1, [0.34, 0.695], dmid + 0.1, [dmid, dmid + 0.004]) },
  ], { radius: 2.2 });

  // ---- 左: 手前の大きな柱（前の面は陰、廊下側はカーキ） ----
  s.faces([-1.8, 0, -2.45], [-0.905, H, -2.18], { pz: grey, px: khaki, nz: khaki }, { collide: true });
  s.faces([-1.2, 0, -2.17], [-0.905, 0.12, -2.16], { pz: baseD });
  // 柱の手前の左の壁（エレベーターホールの口まで）と口の先の壁
  s.faces([-2.1, 0, -2.18], [-1.8, H, ev[0]], { px: khaki }, { collide: true });
  s.faces([-2.1, 2.5, ev[0]], [-1.8, H, ev[1]], { px: khaki });
  s.faces([-1.8, 0, ev[1]], [LW, H, BK], { nz: khaki, px: khaki }, { collide: true });
  s.faces([-1.8, 0, ev[1]], [LW, 0.12, BK], { px: baseD });
  s.faces([-1.8, 0, -2.18], [-1.79, 0.12, ev[0]], { px: baseD });
  // エレベーターホールの案内（口の上）
  const evSign = atlas.add(200, 48, (g, w, h) => {
    paper(g, w, h, '#e8ecc7', '#415553', 3);
    bar(g, 10, 10, 28, 28, '#415553');
    scribble(g, 48, 10, w - 60, 26, { color: '#415553', row: 13, width: 3, seed: 61 });
  });
  s.sheet(paperMat, '+x', [-1.795, 2.67, (ev[0] + ev[1]) / 2], 0.8, 0.19, evSign);
  // 柱に立てかけた白い板（左下）
  const onC = (x: number, y: number): V3 => cam.hit(x, y, 'z', -1.95);
  s.quad(m(flat('#deddc8')), onC(150, 830), onC(232, 830), onC(225, 678), onC(140, 668));
  s.quad(m(flat('#abb7a9')), onC(60, 830), onC(150, 830), onC(140, 668), onC(128, 672));
  // 柱の後ろの左の壁（ナースステーションの窓）・柱型
  s.faces([LW - 0.3, 0, ZE], [LW, H, -2.45], { px: khaki }, { collide: true });
  s.faces([LW, 1.32, -6.9], [LW + 0.01, 2.68, -4.85], { px: glass });
  s.faces([LW, 1.27, -6.95], [LW + 0.06, 1.32, -4.8], { px: frameP, py: frameP });
  s.faces([LW, 2.0, -6.95], [LW + 0.04, 2.04, -4.8], { px: frameP, ny: frameP });
  s.faces([LW, 1.32, -5.9], [LW + 0.04, 2.68, -5.85], { px: frameP });
  s.faces([LW, 1.32, -4.88], [LW + 0.04, 2.68, -4.8], { px: frameP, pz: frameP });
  // 左の壁の上の影の帯（梁の影）
  s.faces([LW, 2.68, ZE], [LW + 0.003, H, -2.45], { px: grey });
  const pil = (z: number, x1: number, d = 0.45): void => {
    s.faces([LW, 0, z - d], [x1, H, z], { pz: grey, px: khaki, nz: khaki }, { collide: true });
    s.faces([LW, 0, z], [x1, 0.1, z + 0.01], { pz: baseD });
  };
  pil(-6.1, -1.15, 0.3);
  pil(-8.9, -1.32, 0.3);
  // 窓の下の厚い腰壁（ナースステーションの受付のカウンター）と、立てかけた白い板
  s.faces([LW, 0, -5.8], [-1.1, 1.3, -2.45], { px: khaki, py: frameP, pz: grey, nz: khaki }, { collide: true });
  s.faces([-1.1, 0.05, -5.1], [-1.095, 1.05, -4.6], { px: m(flat('#9fae9c')) });
  s.faces([-1.1, 0.0, -5.15], [-1.09, 1.08, -5.1], { px: m(flat('#3c4847')) });
  {
    const bd = m(flat('#c8c9b8'));
    const on = (x: number, y: number, z: number): V3 => cam.hit(x, y, 'z', z);
    s.quad(bd, on(475, 592, -3.8), on(528, 578, -3.95), on(522, 352, -4.0), on(470, 365, -3.85));
    // 板の裏（向こうから見たとき）
    s.quad(m(flat('#a9ad9c')), on(470, 365, -3.86), on(522, 352, -4.01), on(528, 578, -3.96), on(475, 592, -3.81));
  }
  // カウンターの上の受付の小物（呼び鈴・用紙立て）
  s.faces([-1.5, 1.3, -3.4], [-1.3, 1.42, -3.1], { px: frameP, py: frameP, pz: grey, nz: frameP, nx: frameP });

  // ---- 右の壁（カーキ）・窓・描いた影。目の後ろに扉 3 つ ----
  {
    let z0 = ZE;
    for (const [a, b] of rightDoors) {
      wallX(s, khaki, RW, -1, z0, a, 0, H);
      s.faces([RW, 2.1, a], [RW + 0.3, H, b], { nx: khaki });
      s.faces([RW - 0.012, 0, z0], [RW, 0.13, a], { nx: baseR, py: baseR });
      doorTrimX(s, frameP, RW, -1, a, b, 2.1);
      z0 = b;
    }
    wallX(s, khaki, RW, -1, z0, CE, 0, H);
    s.faces([RW - 0.012, 0, z0], [RW, 0.13, CE], { nx: baseR, py: baseR });
  }
  // 窓（上下 2 段・3 列。上の段は影の中で灰色、下の段は淡い枠とガラス）。重症観察室の廊下の窓
  const wz0 = -5.65;
  const wz1 = -3.55;
  const wy0 = 1.35;
  const wyM = 2.0;
  const wy1 = 2.5;
  const glassS = m(flat('#7f9686'));
  const frameS = m(flat('#9cb09f'));
  s.faces([RW - 0.01, wyM, wz0], [RW, wy1, wz1], { nx: glassS });
  s.faces([RW - 0.01, wy0, wz0], [RW, wyM, wz1], { nx: glass });
  s.faces([RW - 0.012, wy0 + 0.05, -4.9], [RW - 0.005, wyM - 0.05, -4.3], { nx: glassL });
  s.faces([RW - 0.08, wy0 - 0.05, wz0 - 0.05], [RW, wy0, wz1 + 0.05], { nx: frameP, py: frameP, pz: frameP, nz: frameP, ny: frameP });
  s.faces([RW - 0.05, wyM - 0.03, wz0], [RW, wyM + 0.03, wz1], { nx: frameP, ny: frameP });
  s.faces([RW - 0.05, wy1, wz0 - 0.05], [RW, wy1 + 0.05, wz1 + 0.05], { nx: frameS, ny: frameS });
  for (const z of [wz0, (wz0 * 2 + wz1) / 3, (wz0 + wz1 * 2) / 3, wz1]) {
    s.faces([RW - 0.05, wy0, z - 0.03], [RW, wyM, z + 0.03], { nx: frameP, pz: frameP, nz: frameP });
    s.faces([RW - 0.05, wyM, z - 0.03], [RW, wy1, z + 0.03], { nx: frameS, pz: frameS, nz: frameS });
  }
  // 右の柱型（奥）
  for (const z of [-5.7, -7.9]) {
    s.faces([RW - 0.3, 0, z - 0.4], [RW, H, z], { pz: grey, nx: khaki, nz: khaki }, { collide: true });
    s.faces([RW - 0.3, 0, z], [RW, 0.12, z + 0.01], { pz: baseD });
  }
  // 描いた影: 縦の帯・上の影（参考画像の灰色の領域をなぞった形。壁の面に貼る）
  const shadowPaint = paintMaterial(s.ctx, '#889e89');
  lc.fade('B', shadowPaint, '#c4c9a1');
  const wx = RW - 0.003;
  s.paint(shadowPaint, 'x', wx, SHADOW_R_TOP);
  s.paint(shadowPaint, 'x', wx, SHADOW_R_BAND);

  // ---- 床の光（窓の光の四角） ----
  const fl = (x: number, y: number): V3 => {
    const [px, pz] = cam.floor(x, y, 0.003);
    return [px, 0.003, pz];
  };
  s.quad(lightPaint, fl(593, 668), fl(872, 628), fl(850, 590), fl(620, 592));
  s.quad(lightPaint, fl(636, 500), fl(805, 494), fl(797, 476), fl(650, 478));
  s.quad(lightPaint, fl(590, 453), fl(860, 453), fl(855, 437), fl(600, 437));
  s.quad(lightPaint, fl(475, 680), fl(530, 642), fl(537, 606), fl(500, 610));

  // ---- 天井 ----
  lamp(s, lampBody, lampLens, [0.11, H, -5.75], 1.58, 0.28, 0.06);
  lamp(s, lampBody, lampLens, [0.05, H, -8.9], 1.4, 0.24, 0.05);
  lamp(s, lampBody, lampLens, [0.05, H, 1.6], 1.5, 0.28, 0.06);
  lamp(s, lampBody, lampLens, [0.0, H, 4.6], 1.5, 0.28, 0.06);
  domeCam(s, frameP, camDark, [0.12, H, -4.0], 0.95);
  smoke(s, frameP, [1.07, H, -4.25], 0.06, 0.03);
  smoke(s, frameP, [-0.4, H, 3.2], 0.06, 0.03);

  // ---- 小物 ----
  const cartSideL = m(flat('#dfe8ce'));
  boxCart(s, { front: cartGrey, side: cartSideL, top: cartTop, back: cartGrey, wheel, metal, base: metal }, [0.96, 0, -4.66], [1.44, 0.95, -4.06], { wheelR: 0.05, inset: 0.06, baseH: 0.04 });
  s.faces([0.94, 0.95, -4.68], [1.44, 0.99, -4.04], { py: cartTop, pz: cartTop, nx: cartTop, nz: cartTop });
  for (const x of [0.98, 1.2]) s.cyl(frameP, [x, 1.13, -4.58], 0.012, 0.32, { segments: 6 });
  s.cyl(frameP, [1.09, 1.29, -4.58], 0.012, 0.24, { axis: 'x', segments: 6 });
  // 右手前の医療カート（白い天板・淡い緑の手すり）。少し斜めに置かれているので、天板は参考画像の 4 隅から作る
  {
    const y = 0.75;
    const FL: V3 = [0.762, y, -1.237];
    const FR: V3 = [1.182, y, -1.229];
    const BR: V3 = [1.331, y, -1.402];
    const BL: V3 = [0.888, y, -1.41];
    s.quad(medTop, FL, FR, BR, BL);
    const dn = (p: V3, d: number): V3 => [p[0], p[1] - d, p[2]];
    s.quad(medTop, dn(FL, 0.04), dn(FR, 0.04), FR, FL);
    s.quad(medTop, dn(BL, 0.04), dn(FL, 0.04), FL, BL);
    s.quad(medTop, dn(FR, 0.04), dn(BR, 0.04), BR, FR);
    s.quad(medTop, dn(BR, 0.04), dn(BL, 0.04), BL, BR);
    const rail = m(flat('#c8d5c4'));
    const inset = (p: V3, dx: number, dz: number, dy: number): V3 => [p[0] + dx, p[1] - dy, p[2] + dz];
    s.quad(rail, inset(FL, 0.06, 0.01, 0.12), inset(FR, -0.02, 0.01, 0.12), inset(FR, -0.02, 0.01, 0.08), inset(FL, 0.06, 0.01, 0.08));
    s.quad(medFront, inset(FL, 0.07, -0.03, 0.75), inset(FR, -0.03, -0.03, 0.75), inset(FR, -0.03, -0.03, 0.04), inset(FL, 0.07, -0.03, 0.04));
    // 横と後ろ（参考画像の画角の外）
    s.quad(medFront, inset(BL, 0.07, 0.0, 0.04), inset(BL, 0.07, 0.0, 0.75), inset(FL, 0.07, -0.03, 0.75), inset(FL, 0.07, -0.03, 0.04));
    s.quad(medFront, inset(FR, -0.03, -0.03, 0.04), inset(FR, -0.03, -0.03, 0.75), inset(BR, -0.03, 0.0, 0.75), inset(BR, -0.03, 0.0, 0.04));
    s.quad(medFront, inset(BR, -0.03, 0.0, 0.04), inset(BR, -0.03, 0.0, 0.75), inset(BL, 0.07, 0.0, 0.75), inset(BL, 0.07, 0.0, 0.04));
    s.collider([0.76, 0, -1.41], [1.33, 0.75, -1.23]);
  }
  // 奥の黒い椅子・白いごみ箱
  const chair = m(flat('#2f3a3a'));
  s.faces([-1.45, 0.45, -9.0], [-1.0, 0.5, -8.55], { py: chair, pz: chair, nz: chair, px: chair, nx: chair });
  for (const [x, z] of [
    [-1.42, -9.0],
    [-1.03, -9.0],
    [-1.42, -8.57],
    [-1.03, -8.57],
  ] as [number, number][])
    s.box(chair, [x - 0.012, 0, z - 0.012], [x + 0.012, 0.85, z + 0.012]);
  s.faces([0.92, 0, -9.65], [1.3, 0.45, -9.3], { pz: binM, nx: binM, py: binM, nz: binM }, { collide: true });

  // ---- 掲示（参考画像の外接矩形） ----
  const poster = (bg: string, red: string, ink: string, seed: number): [number, number, number, number] =>
    atlas.add(200, 280, (g, w, h) => {
      paper(g, w, h, bg);
      stamp(g, 24, 24, 130, 40, red);
      scribble(g, 26, 90, w - 52, h - 120, { color: ink, row: 22, width: 6, seed });
    });
  const tealNote = (bg: string, ink: string, seed: number, red?: string): [number, number, number, number] =>
    atlas.add(140, 200, (g, w, h) => {
      paper(g, w, h, bg);
      if (red) stamp(g, 40, 14, 60, 18, red);
      scribble(g, 22, red ? 50 : 24, w - 44, h - (red ? 70 : 44), { color: ink, row: 16, width: 4, seed });
    });
  s.sheetImg(paperMat, '-x', RW - 0.005, [1389, 118, 1456, 246], poster('#f4f9d9', '#d1756e', '#cdc5a6', 31), 0.05, 1);
  s.sheetImg(paperMat, '+x', -1.795, [0, 355, 75, 530], poster('#f1f4dc', '#c95f5c', '#d6caa9', 32), 0.03, 1);
  s.sheetImg(paperMat, '+x', -1.795, [0, 145, 48, 247], tealNote('#f2f5de', '#d9dcc4', 36), 0, 1);
  s.sheetImg(paperMat, '+z', -2.175, [332, 172, 382, 260], tealNote('#a4bfac', '#8aa392', 33, '#b25c55'), 0, 1);
  s.sheetImg(paperMat, '+z', -2.175, [317, 318, 372, 362], tealNote('#b2d4be', '#9cc1aa', 34), 0, 1);
  s.sheetImg(paperMat, '-x', RW - 0.005, [1219, 213, 1273, 304], tealNote('#a8bfae', '#8fa897', 35), 0, 1);
  const brown = atlas.add(80, 240, (g, w, h) => {
    paper(g, w, h, '#efe9d4');
    bar(g, 10, 30, w - 20, 50, '#9a6a4d');
    bar(g, 10, 110, w - 30, 40, '#b88e6c');
    bar(g, 10, 170, w - 20, 50, '#7a5a45');
  });
  s.sheetImg(paperMat, '-x', RW - 0.005, [1045, 255, 1070, 380], brown, 0, 1);
  s.sheetImg(paperMat, '+x', LW + 0.005, [431, 198, 459, 380], brown, 0, 1);
  for (const [i, bx] of [
    [0, [1098, 230, 1115, 272]],
    [1, [1125, 288, 1144, 328]],
    [2, [1140, 330, 1159, 373]],
  ] as [number, [number, number, number, number]][])
    s.sheetImg(paperMat, '-x', RW - 0.005, bx, tealNote('#f2f7e0', '#d9dcc4', 40 + i), 0, 1);
  // 目の後ろの掲示（右の壁・扉の名札）
  s.sheet(paperMat, '-x', [RW - 0.005, 1.55, 1.8], 0.42, 0.6, poster('#f4f9d9', '#d1756e', '#cdc5a6', 37), {}, 0.03);
  s.sheet(paperMat, '-x', [RW - 0.005, 1.6, 2.6], 0.25, 0.35, tealNote('#f2f7e0', '#d9dcc4', 43), {}, -0.02);

  // ---- 角 AB（z 6.0〜9.22）: 左は東の廊下の防火戸の裏、右は北階段、奥は個室 507 ----
  {
    // 東の廊下（脚 A）の扉の口（区域 z）
    const LA = LEGS.A;
    const az0 = -1.196 - L.origin[0] + LA.origin[0];
    const az1 = 1.289 - L.origin[0] + LA.origin[0];
    const aTop = 2.2;
    s.faces([LW - 0.3, 0, BK], [LW, H, az0], { px: khaki }, { collide: true });
    s.faces([LW - 0.3, 0, az1], [LW, H, CE], { px: khaki }, { collide: true });
    s.faces([LW - 0.3, aTop, az0], [LW, H, az1], { px: khaki });
    s.faces([LW, aTop + 0.09, az0], [LW + 0.01, H, az1], { px: glassL });
    s.faces([LW, 0, az0 - 0.07], [LW + 0.04, aTop + 0.07, az0], { px: frameP, pz: frameP, nz: frameP });
    s.faces([LW, 0, az1], [LW + 0.04, aTop + 0.07, az1 + 0.07], { px: frameP, pz: frameP, nz: frameP });
    s.faces([LW, aTop, az0], [LW + 0.04, aTop + 0.07, az1], { px: frameP, ny: frameP, py: frameP });
    s.faces([LW, 0, BK], [LW + 0.012, 0.12, az0 - 0.07], { px: baseD });
    s.faces([LW, 0, az1 + 0.07], [LW + 0.012, 0.12, CE], { px: baseD });
    // 奥の壁（個室 507 の扉）
    const e5: [number, number] = [-(-19.8 - L.origin[2]), -(-18.7 - L.origin[2])];
    const ea = Math.min(e5[0], e5[1]);
    const eb = Math.max(e5[0], e5[1]);
    s.faces([LW, 0, CE], [ea, H, CE + 0.3], { nz: khaki }, { collide: true });
    s.faces([eb, 0, CE], [RW, H, CE + 0.3], { nz: khaki }, { collide: true });
    s.faces([ea, 2.1, CE], [eb, H, CE + 0.3], { nz: khaki });
    s.faces([LW, 0, CE - 0.012], [ea, 0.13, CE], { nz: baseR });
    s.faces([eb, 0, CE - 0.012], [RW, 0.13, CE], { nz: baseR });
    s.faces([ea - 0.05, 0, CE - 0.02], [ea, 2.15, CE], { nz: frameP, nx: frameP });
    s.faces([eb, 0, CE - 0.02], [eb + 0.05, 2.15, CE], { nz: frameP, px: frameP });
    s.faces([ea, 2.1, CE - 0.02], [eb, 2.15, CE], { nz: frameP, ny: frameP });
    // 階段の案内・非常口の表示（緑の板・光る）
    const exit = atlas.add(160, 64, (g, w, h) => {
      paper(g, w, h, '#4f8f6a', '#2c4a3a', 3);
      bar(g, 14, 12, 30, 40, '#e9f2dc');
      scribble(g, 56, 14, w - 70, 34, { color: '#e9f2dc', row: 16, width: 4, seed: 71 });
    });
    const exitM = s.ctx.mat({ color: '#ffffff', map: atlas.tex, unlit: true, line: 0.5 });
    s.sheet(exitM, '-x', [RW - 0.01, 2.45, (rightDoors[2][0] + rightDoors[2][1]) / 2], 0.5, 0.2, exit);
    lamp(s, lampBody, lampLens, [0.0, H, 7.6], 1.4, 0.28, 0.06);
    smoke(s, frameP, [-0.6, H, 8.6], 0.06, 0.03);
  }
}

// 右の壁の描いた影（参考画像の画素座標。tools なしで手で直せるように数値で持つ）
const SHADOW_R_TOP: [number, number][] = [
  [840, -40], [1204, -40], [1202.5, 45], [1195, 55.5], [1191.5, 51], [1194.5, 34], [1189, 31.5], [1095, 83.5], [1086.5, 98], [1060, 119.5],
  [1059.5, 106], [1049.5, 106], [1039.5, 208], [1028, 213.5], [1017, 224.5], [996, 227.5], [985, 188.5], [961, 188.5], [941, 197.5], [919.5, 216],
  [905, 200], [881, 174.5], [849.5, 201], [840, 198],
];
const SHADOW_R_BAND: [number, number][] = [
  [1277, 712.5], [1260, 707.5], [1244, 708.5], [1230, 700.5], [1174, 702.5], [1168.5, 699], [1215.5, 269], [1223.5, 167], [1227.5, 155], [1231.5, 107],
  [1228.5, 100], [1335, 39.5], [1339.5, 35], [1344, -40], [1385, -40], [1383.5, 13], [1387, 17.5], [1424, -40], [1460, -40], [1460, 0], [1382.5, 28], [1375.5, 81],
  [1361.5, 97], [1361.5, 133], [1346.5, 219], [1308.5, 514], [1299.5, 530], [1297.5, 588],
];
