import * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { decalMaterial } from '../../render/Decal.ts';
import type { Atlas, ViewCam } from '../../scenes/corridor/kit.ts';
import { bin, caster, flat, lamp, smoke } from '../../scenes/corridor/props.ts';
import { bar, paper, pin, scribble } from '../../scenes/corridor/tex.ts';
import { CAM3 } from '../../scenes/corridor/seg3.ts';
import { D_DOORS, LEGS } from './layout.ts';
import type { Leg } from './leg.ts';
import { mountable, skippable } from './probe.ts';
import type { LegCtx } from './legA.ts';
import { wallFlecksHash } from './flecks.ts';
import { doorTrimX, doorTrimZ } from './trim.ts';

/**
 * 脚 D（南の廊下・東へ）= corridor-3。片側（右 = 南）は汚物処理室・器材庫・浴室などの居室でない部屋なので幅 2.29 m。元の版の seg3 を写して、次を変えた:
 * - 左の手前の扉（スタッフ室・カードの読み取り機）・左奥の 2 つの扉（薬剤準備室・清潔材料庫）・右の扉（器材庫）・突き当たりの両開きの防火戸を開く扉に
 * - 手前の扉の枠は元の版では画像から逆算した斜めの四角だったので、縦の枠にした
 * - 目の後ろへ延ばし（z 2.5 → 3.89）、右に汚物処理室の扉。その先に角 CD（西の廊下の防火戸の裏・南階段・4 床室 516）
 * 区域の座標: 原点 (-14.26, 4.38)、yaw -π/2（区域の -Z = 場面の +X = 東）。左 = 北（コア）、右 = 南（外の部屋）。
 */
export function buildLegD(s: Leg, atlas: Atlas, paperMat: THREE.Material, lc: LegCtx): void {
  const cam = CAM3;
  const L = LEGS.D;
  const m = (o: Parameters<typeof s.ctx.mat>[0]): THREE.MeshStandardMaterial => s.ctx.mat({ line: 0.3, ...o });
  const H = 2.75;
  const EW = L.end; // 突き当たりの扉の面
  const EB = L.endBack;
  const BK = L.back;
  const CE = L.cornerEnd;
  const LW = -1.12;
  const RW = 1.17;
  const lz = (xw: number): number => L.origin[0] - xw; // 場面の x → 区域の z

  const teal = '#80a496';
  const floor = m(flat('#7da396', '#5f8479', { line: 0.2 }));
  const ceil = m(flat(teal, undefined, { line: 0.2 }));
  // 右の壁の淡い縦の傷: 材質の flecks は場面の座標で模様が決まり、区域を回すと鏡写しになるので、元の版の並びで板として貼る
  const rwall = m(flat(teal, undefined, { line: 0.3 }));
  const fleckM = m(flat('#c3d8c8', undefined, { line: 0 }));
  const FLECK = { scale: 2.4, density: 0.22, length: 0.9, width: 0.02, face: -7 };
  const lwall = m(flat('#c0c5a5', undefined, { line: 0.3 }));
  const cream = m(flat('#e8ecc7', undefined, { line: 0.5 }));
  // 写っていない所の飾り（dress.ts）が物を貼ってよい面（壁の傷の板は無い物とする）
  mountable(floor, ceil, lwall, rwall);
  skippable(fleckM);
  const jambSide = m(flat('#bfc6a4', undefined, { line: 0.5 }));
  const door = m(flat('#c76b6c', undefined, { line: 0.6 }));
  const kick = m(flat('#d1d9c2', undefined, { line: 0.6 }));
  const transom = m(flat('#244145', undefined, { line: 0.6 }));
  const glassT = m(flat('#c0e7c8', undefined, { line: 0.6 }));
  const lampBody = m(flat('#e2e5cf', undefined, { line: 0.8 }));
  const lampLens = m({ color: '#f6f8e6', unlit: true, line: 0.5 });
  const binM = m(flat('#f2f3ce', '#cfd2ad', { line: 1 }));
  const cartM = m(flat('#e9edca', '#c2c7a7', { line: 1 }));
  const wheel = m(flat('#1b2a30', undefined, { line: 1 }));
  const red = m(flat('#c4595e', undefined, { line: 0.8 }));
  const bandL = decalMaterial({ color: '#182832', rag: 0.08, scale: 0.9, edges: [0, 0, 0, 1], step: 0.5 });
  const bandR = decalMaterial({ color: '#182832', rag: 0.06, scale: 0.9, edges: [0, 0, 0, 1], step: 0.5 });
  const scrapM = decalMaterial({ color: '#e6ebc8', rag: 0.006, scale: 14 });

  const dx0 = -1.0;
  const dx1 = 0.64;
  const dmid = (dx0 + dx1) / 2;
  const dTop = 1.83;
  // 左（コア）の扉: [z0, z1, 上端, 部屋]
  const leftDoors: [number, number, number, string][] = [
    [D_DOORS.l3[0], D_DOORS.l3[1], D_DOORS.jambTop, 'CLN'],
    [D_DOORS.l2[0], D_DOORS.l2[1], D_DOORS.jambTop, 'MED'],
    [D_DOORS.l1[0], D_DOORS.l1[1], D_DOORS.l1Top, 'STF'],
  ];
  const s1Door: [number, number] = [lz(-15.3), lz(-16.4)];
  const rightDoors: [number, number, number][] = [
    [D_DOORS.r1[0], D_DOORS.r1[1], D_DOORS.jambTop],
    [s1Door[0], s1Door[1], 2.1],
  ];
  const stsDoor: [number, number] = [lz(-18.6), lz(-20.6)];
  const w4Door: [number, number] = [3.6 - L.origin[2], 4.8 - L.origin[2]];

  // ---- 床・天井 ----
  s.faces([LW, -0.1, EW], [RW, 0, CE], { py: floor }, { collide: true });
  s.faces([dx0, -0.1, EB], [dx1, 0, EW], { py: floor }, { collide: true });
  s.faces([LW, H, EW], [RW, H + 0.1, CE], { ny: ceil });

  // ---- 左の壁（扉の所は穴） ----
  {
    let z0 = EW;
    for (const [a, b, top] of leftDoors) {
      s.faces([LW - 0.3, 0, z0], [LW, H, a], { px: lwall }, { collide: true });
      s.faces([LW - 0.3, top, a], [LW, H, b], { px: lwall });
      z0 = b;
    }
    s.faces([LW - 0.3, 0, z0], [LW, H, BK], { px: lwall }, { collide: true });
  }
  // 右の壁
  {
    let z0 = EW;
    for (const [a, b, top] of [...rightDoors].sort((p, q) => p[0] - q[0])) {
      s.faces([RW, 0, z0], [RW + 0.3, H, a], { nx: rwall }, { collide: true });
      s.faces([RW, top, a], [RW + 0.3, H, b], { nx: rwall });
      z0 = b;
    }
    s.faces([RW, 0, z0], [RW + 0.3, H, BK], { nx: rwall }, { collide: true });
    wallFlecksHash(s, fleckM, RW, -1, EW, BK, 0, H, FLECK, rightDoors.map(([p, q]) => [p, q] as [number, number]));
  }
  // 足元の紺の幅木（壁の面。上の縁が階段状にちぎれる）。扉の所は切る
  const skirt = (x: number, n: 1 | -1, h: number, mat: THREE.Material, z0: number, z1: number): void => {
    if (z1 - z0 < 0.02) return;
    if (n > 0) s.quad(mat, [x + 0.004, 0, z1], [x + 0.004, 0, z0], [x + 0.004, h, z0], [x + 0.004, h, z1]);
    else s.quad(mat, [x - 0.004, 0, z0], [x - 0.004, 0, z1], [x - 0.004, h, z1], [x - 0.004, h, z0]);
  };
  {
    let z0 = EW + 0.03;
    for (const [a, b] of leftDoors) {
      skirt(LW, 1, 0.22, bandL, z0, a);
      z0 = b;
    }
    skirt(LW, 1, 0.22, bandL, z0, BK);
    z0 = EW + 0.03;
    for (const [a, b] of [...rightDoors].sort((p, q) => p[0] - q[0])) {
      skirt(RW, -1, 0.13, bandR, z0, a);
      z0 = b;
    }
    skirt(RW, -1, 0.13, bandR, z0, BK);
  }

  // ---- 突き当たり（扉の壁は厚さ 0.3。防火戸は角 DA へ開く） ----
  s.faces([LW, 0, EB], [dx0, H, EW], { pz: cream, px: cream }, { collide: true });
  s.faces([dx1, 0, EB], [RW, H, EW], { pz: cream, nx: cream }, { collide: true });
  s.faces([dx0, dTop, EB], [dx1, H, EW], { pz: cream });
  s.faces([dx0 - 0.002, 0, EB], [dx0, dTop, EW], { px: kick });
  s.faces([dx1, 0, EB], [dx1 + 0.002, dTop, EW], { nx: kick });
  s.faces([dx0, dTop, EB], [dx1, dTop + 0.002, EW], { ny: kick });
  const dleaf = (q: Leg, a: number, c: number, strip: [number, number]): void => {
    q.faces([a, 0.25, EW - 0.05], [c, dTop, EW + 0.03], { pz: door, nz: door, px: door, nx: door });
    q.faces([a, 0, EW - 0.05], [c, 0.25, EW + 0.03], { pz: kick, nz: kick, px: kick, nx: kick });
    q.faces([strip[0], 0, EW], [strip[1], dTop, EW + 0.04], { pz: kick, nz: kick });
    const cx = a < dmid ? dx0 + 0.36 : dx1 - 0.36;
    q.faces([cx - 0.17, 1.1, EW], [cx + 0.17, 1.5, EW + 0.035], { pz: transom });
    q.faces([cx - 0.17, 1.1, EW - 0.055], [cx + 0.17, 1.5, EW - 0.05], { nz: transom });
    const px = a < dmid ? dmid - 0.1 : dmid + 0.1;
    q.faces([px - 0.06, 0.7, EW], [px + 0.06, 1.05, EW + 0.05], { pz: kick, px: kick, nx: kick, py: kick, ny: kick });
    q.faces([a + 0.1, 0.95, EW - 0.1], [c - 0.1, 1.0, EW - 0.05], { nz: kick, py: kick, ny: kick });
  };
  lc.doors.add(s, [dmid, 0, EW - 0.15], [
    { pivot: [dx0, 0, EW - 0.05], swing: Math.PI / 2 - 0.08, build: (q) => dleaf(q, dx0, dmid, [dmid - 0.02, dmid]) },
    { pivot: [dx1, 0, EW - 0.05], swing: -Math.PI / 2 + 0.08, build: (q) => dleaf(q, dmid, dx1, [dmid, dmid + 0.02]) },
  ], { radius: 2.0 });
  // 欄間（暗いガラスと枠）
  for (let i = 0; i < 5; i++) {
    const x0 = -0.98 + i * 0.4;
    s.faces([x0, 1.97, EW], [x0 + 0.35, 2.32, EW + 0.02], { pz: transom });
  }
  // 扉の右の淡いガラス・上の案内の箱
  s.faces([0.68, 0.35, EW], [0.92, 1.8, EW + 0.02], { pz: glassT });
  // 右の壁から出た案内の箱
  s.faces([0.72, 2.32, -9.1], [RW, 2.62, -8.95], { pz: cream, ny: cream, nx: cream, nz: cream });
  // 案内の箱の裏の面（突き当たりの側。参考画像の視点からは見えない）の案内の図柄
  const guide = atlas.add(120, 80, (g, w, h) => {
    paper(g, w, h, '#e8ecc7', '#244145', 3);
    bar(g, 10, 12, 26, 26, '#244145');
    g.fillStyle = '#244145';
    g.beginPath();
    g.moveTo(w - 14, 25);
    g.lineTo(w - 30, 13);
    g.lineTo(w - 30, 37);
    g.fill();
    scribble(g, 44, 12, w - 84, 26, { color: '#244145', row: 13, width: 3, seed: 93 });
    scribble(g, 12, 50, w - 24, 20, { color: '#7f9585', row: 10, width: 2, seed: 94 });
  });
  s.sheet(paperMat, '-z', [(0.72 + RW) / 2, 2.47, -9.103], RW - 0.72 - 0.04, 0.26, guide);

  // ---- 天井 ----
  for (const z of [-6.28, -8.54, -10.95, -3.9, -1.6, 0.9, 3.0, 5.4]) lamp(s, lampBody, lampLens, [0, H, z], 1.5, 0.2, 0.05, 0.03);
  s.cyl(lampBody, [-0.08, H - 0.1, -4.7], 0.1, 0.12, { segments: 16 });
  s.cyl(m(flat('#20302f')), [-0.08, H - 0.19, -4.7], 0.06, 0.06, { segments: 12 });
  s.cyl(lampBody, [0.0, H - 0.08, -11.4], 0.08, 0.1, { segments: 16 });
  smoke(s, lampBody, [0.3, H, 1.9]);

  // ---- 左の壁 ----
  const onL = (x: number, y: number, dx = 0): V3 => cam.hit(x, y, 'x', LW + dx);
  // 手前の扉（スタッフ室）: 縦の枠・取っ手・小窓・カードの読み取り機は扉の葉に。枠は動かない
  const [l1a, l1b] = D_DOORS.l1;
  s.faces([LW, 0, l1a - 0.15], [LW + 0.03, D_DOORS.l1Top + 0.05, l1a], { px: cream, pz: cream, nz: cream });
  s.faces([LW, 0, l1b], [LW + 0.03, D_DOORS.l1Top + 0.05, l1b + 0.06], { px: cream, pz: cream, nz: cream });
  s.faces([LW, D_DOORS.l1Top, l1a], [LW + 0.03, D_DOORS.l1Top + 0.05, l1b], { px: cream, ny: cream });
  const win = atlas.add(120, 200, (g, w, h) => {
    paper(g, w, h, '#7ea294');
    bar(g, 0, h / 2 - 3, w, 6, '#bbbf9f');
    pin(g, 8, 8, 5, '#26343a');
    pin(g, w - 8, 8, 5, '#26343a');
    pin(g, 8, h - 8, 5, '#26343a');
    pin(g, w - 8, h - 8, 5, '#26343a');
  });
  const card = atlas.add(64, 100, (g, w, h) => {
    paper(g, w, h, '#7ea294', '#4f6566', 3);
    bar(g, 10, 12, w - 20, 40, '#546869');
    bar(g, 14, 70, w - 28, 16, '#956368');
  });
  const noteL = atlas.add(100, 110, (g, w, h) => {
    paper(g, w, h, '#c3c8a8');
    scribble(g, 10, 14, w - 20, h - 24, { color: '#8f9a8c', row: 12, width: 3, seed: 81 });
  });
  lc.doors.add(s, [LW - 0.15, 0, (l1a + l1b) / 2], [
    {
      pivot: [LW, 0, l1b],
      slide: { dir: [0, 1], dist: l1b - l1a - 0.04, back: [-0.06, 0] },
      build: (q) => {
        q.faces([LW - 0.04, 0, l1a], [LW, D_DOORS.l1Top, l1b], { px: lwall, nx: lc.roomDoor('STF'), pz: lwall, nz: lwall });
        const vert = (z0: number, z1: number, y0: number, y1: number, dx: number, mat: THREE.Material): void => {
          q.faces([LW, y0, z0], [LW + dx, y1, z1], { px: mat, pz: mat, nz: mat });
        };
        vert(-1.95, -1.87, 1.04, 1.68, 0.01, cream);
        sheetOn(q, cam, m(flat('#bbbf9f')), LW + 0.004, [78, 182, 182, 372], -0.1, 0.98);
        sheetOn(q, cam, paperMat, LW + 0.008, [84, 190, 178, 366], -0.1, 0.97, win);
        sheetOn(q, cam, paperMat, LW + 0.02, [20, 365, 65, 450], 0, 1, card);
        sheetOn(q, cam, paperMat, LW + 0.004, [135, 415, 185, 470], 0, 1, noteL);
        const hb = boxOn(cam, LW, [272, 445, 308, 470], 0.05);
        q.faces([hb[0][0], hb[0][1], Math.max(hb[0][2], l1a + 0.01)], [hb[1][0], hb[1][1], Math.max(hb[1][2], l1a + 0.05)], { px: m(flat('#c9d0c3')), pz: m(flat('#c9d0c3')), nz: m(flat('#c9d0c3')) });
        const hb2 = boxOn(cam, LW, [275, 405, 292, 440], 0.02);
        q.faces([hb2[0][0], hb2[0][1], Math.max(hb2[0][2], l1a + 0.01)], [hb2[1][0], hb2[1][1], Math.max(hb2[1][2], l1a + 0.04)], { px: m(flat('#9fb0a3')) });
      },
    },
  ]);
  // 手前の扉の上: 細い青緑の影の線・暗い欄間・クリームの板
  s.quad(m(flat('#82a699')), onL(-40, 28, 0.006), onL(252, 88, 0.006), onL(252, 80, 0.006), onL(-40, 6, 0.006));
  s.quad(m(flat('#24363d')), onL(98, -20, 0.006), onL(180, -20, 0.006), onL(180, 30, 0.006), onL(98, 0, 0.006));
  s.quad(cream, onL(182, 0, 0.006), onL(212, 0, 0.006), onL(212, 40, 0.006), onL(182, 30, 0.006));
  s.quad(cream, onL(220, 0, 0.006), onL(252, 0, 0.006), onL(252, 55, 0.006), onL(225, 48, 0.006));
  s.faces(...boxOn(cam, LW, [270, 20, 300, 96], 0.04), { px: m(flat('#8a3f4b')), pz: red, ny: red, nz: red, py: red });
  // 掲示板（青緑）と紙
  s.sheetImg(m(flat('#88a998')), '+x', LW + 0.006, [330, 140, 415, 385], undefined, 0, 1);
  s.sheetImg(m(flat('#7da396')), '+x', LW + 0.006, [435, 160, 530, 375], undefined, 0, 1);
  const pp = (bg: string, seed: number, ink = '#8d998a'): [number, number, number, number] =>
    atlas.add(100, 150, (g, w, h) => {
      paper(g, w, h, bg);
      scribble(g, 12, 18, w - 24, h - 30, { color: ink, row: 14, width: 3, seed });
    });
  const papersL: [[number, number, number, number], string][] = [
    [[345, 160, 405, 262], '#93b1a2'],
    [[350, 280, 405, 372], '#c0c7a8'],
    [[443, 182, 470, 282], '#c0caac'],
    [[472, 190, 498, 270], '#c0caac'],
    [[488, 245, 508, 292], '#c5ccb0'],
    [[508, 238, 522, 282], '#c0caac'],
  ];
  papersL.forEach(([bx, bg], i) => s.sheetImg(paperMat, '+x', LW + 0.012, bx, pp(bg, 82 + i), 0, 0.95));
  s.sheetImg(m(flat('#59706e')), '+x', LW + 0.008, [340, 395, 415, 425], undefined, -0.2, 0.9);
  s.sheetImg(m(flat('#80a297')), '+x', LW + 0.012, [310, 495, 345, 580], undefined, 0, 0.9);
  // 奥の扉の枠（左）。扉の葉は枠の間（壁と同じ色で平ら）
  for (const [x, w] of [
    [540, 18],
    [582, 10],
    [612, 8],
  ] as [number, number][]) {
    const a = cam.hit(x, 250, 'x', LW)[2];
    const b = cam.hit(x + w, 250, 'x', LW)[2];
    s.faces([LW, 0, Math.min(a, b)], [LW + 0.04, 2.3, Math.max(a, b)], { px: cream, pz: jambSide, nz: jambSide, py: cream });
  }
  for (const [a, b, top, room] of leftDoors.slice(0, 2)) {
    lc.doors.add(s, [LW - 0.15, 0, (a + b) / 2], [
      {
        pivot: [LW, 0, a],
        slide: { dir: [0, -1], dist: b - a - 0.04, back: [-0.06, 0] },
        build: (q) => {
          q.faces([LW - 0.04, 0, a], [LW, top, b], { px: lwall, nx: lc.roomDoor(room), pz: lwall, nz: lwall });
          q.faces([LW, 0.95, b - 0.12], [LW + 0.03, 1.15, b - 0.09], { px: cream, pz: cream, nz: cream });
        },
      },
    ]);
  }
  s.sheetImg(red, '+x', LW + 0.006, [540, 210, 548, 245], undefined, 0, 1);
  s.sheetImg(m(flat('#3d6a8a')), '+x', LW + 0.006, [535, 245, 545, 256], undefined, 0, 1);

  // ---- 右の壁 ----
  for (const [x, w] of [
    [925, 6],
    [879, 12],
  ] as [number, number][]) {
    const a = cam.hit(x, 300, 'x', RW)[2];
    const b = cam.hit(x + w, 300, 'x', RW)[2];
    s.faces([RW - 0.04, 0, Math.min(a, b)], [RW, 2.3, Math.max(a, b)], { nx: cream, pz: cream, nz: cream, py: cream });
  }
  {
    const [a, b, top] = rightDoors[0];
    lc.doors.add(s, [RW + 0.15, 0, (a + b) / 2], [
      {
        pivot: [RW, 0, a],
        slide: { dir: [0, -1], dist: b - a - 0.04, back: [0.06, 0] },
        build: (q) => {
          q.faces([RW, 0, a], [RW + 0.04, top, b], { nx: rwall, px: lc.roomDoor('S2'), pz: rwall, nz: rwall });
          wallFlecksHash(q, fleckM, RW, -1, a, b, 0, top, FLECK);
          q.faces([RW - 0.03, 0.95, b - 0.12], [RW, 1.15, b - 0.09], { nx: cream, pz: cream, nz: cream });
        },
      },
    ]);
    // 汚物処理室の扉（目の後ろ）の枠
    doorTrimX(s, cream, RW, -1, rightDoors[1][0], rightDoors[1][1], 2.1);
  }
  s.sheetImg(red, '-x', RW - 0.02, [943, 118, 958, 160], undefined, 0, 1);
  // 暗い掲示板（台形に見える）と下の受け
  const onR = (x: number, y: number, dx = 0): V3 => cam.hit(x, y, 'x', RW - dx);
  s.quad(m(flat('#5b7873')), onR(960, 338, 0.01), onR(1088, 398, 0.01), onR(1089, 150, 0.01), onR(966, 176, 0.01));
  s.quad(m(flat('#9db6a8')), onR(990, 392, 0.03), onR(1100, 428, 0.03), onR(1100, 412, 0.03), onR(990, 380, 0.03));
  const papersR: [[number, number, number, number], string][] = [
    [[1000, 168, 1025, 216], '#9fb09b'],
    [[985, 240, 1010, 300], '#9fb09b'],
    [[1010, 270, 1040, 330], '#a3b39f'],
    [[1040, 300, 1070, 360], '#9fb09b'],
    [[1045, 210, 1065, 250], '#9fb09b'],
  ];
  papersR.forEach(([bx, bg], i) => s.sheetImg(paperMat, '-x', RW - 0.015, bx, pp(bg, 90 + i, '#7f9585'), 0, 0.92));
  const rsign = atlas.add(120, 200, (g, w, h) => {
    paper(g, w, h, '#a0b49a', '#7f9483', 3);
    bar(g, 22, 76, 46, 22, '#7aa197');
    pin(g, 14, 14, 5, '#2b3a3c');
    pin(g, w - 14, 14, 5, '#2b3a3c');
    pin(g, 14, h - 14, 5, '#2b3a3c');
    pin(g, w - 14, h - 14, 5, '#2b3a3c');
  });
  s.sheetImg(paperMat, '-x', RW - 0.006, [1108, 192, 1165, 355], rsign, 0, 1);
  // 目の後ろの掲示
  s.sheet(paperMat, '+x', [LW + 0.006, 1.5, 1.4], 0.35, 0.5, pp('#c0c7a8', 97), {}, 0.03);
  s.sheet(paperMat, '-x', [RW - 0.006, 1.55, 0.3], 0.3, 0.42, pp('#9fb09b', 98, '#7f9585'), {}, -0.02);

  // ---- 小物 ----
  for (const [x, z] of [
    [-0.84, -5.4],
    [-0.84, -6.6],
    [-0.8, -7.45],
    [0.8, -11.35],
    [0.98, -10.95],
  ] as [number, number][])
    bin(s, binM, binM, x, z, 0.3, 0.22, 0.4);
  // 医療カート（クリーム、上にトレー。寸法は参考画像の車輪・角から逆算）。四隅の柱の間に本体
  // 元の版ではこの廊下に平行光の影が届いていなかった（影の範囲の外）。参考画像にもカートの影は無いので、影を落とさない
  s.faces([0.71, 0.14, -3.18], [1.03, 0.72, -2.73], { pz: cartM, nx: cartM, px: cartM, py: cartM, ny: cartM, nz: cartM });
  s.collider([0.62, 0, -3.3], [1.1, 0.86, -2.63]);
  s.faces([0.71, 0.36, -2.729], [1.03, 0.375, -2.725], { pz: m(flat('#c9ccab')) });
  for (const x of [0.67, 1.06]) for (const z of [-3.2, -2.7]) s.box(cartM, [x - 0.015, 0.1, z - 0.015], [x + 0.015, 0.8, z + 0.015]);
  s.faces([0.65, 0.1, -3.22], [1.08, 0.13, -2.68], { py: cartM, pz: cartM, nx: cartM, px: cartM, nz: cartM });
  s.faces([0.62, 0.79, -3.25], [1.09, 0.83, -2.65], { py: m(flat('#c2c7a7')), pz: cartM, nx: cartM, px: cartM, nz: cartM });
  s.faces([0.62, 0.83, -2.69], [1.09, 0.87, -2.65], { pz: cartM, py: cartM, nz: cartM });
  s.faces([0.62, 0.83, -3.25], [0.65, 0.87, -2.65], { nx: cartM, py: cartM, px: cartM });
  s.faces([0.66, 0.72, -2.73], [1.07, 0.79, -2.7], { pz: cartM, nz: cartM });
  for (const x of [0.69, 1.02]) for (const z of [-3.24, -2.69]) caster(s, wheel, cartM, x, z, 0.06, 0.04);
  // 右の壁の箱（ディスペンサー）
  s.faces([RW - 0.1, 0.83, -2.7], [RW, 1.1, -2.44], { nx: cartM, pz: cartM, ny: cartM, nz: cartM, py: cartM });
  // 右手前の手持ちの端末（少し傾いて置かれている。画面が暗い）
  {
    const pos: V3 = [0.89, 0.3, -1.75];
    const rotZ = -0.32;
    s.mesh(new THREE.BoxGeometry(0.17, 0.27, 0.04), cartM, pos, { rotZ, rotX: -0.2 });
    s.mesh(new THREE.BoxGeometry(0.12, 0.1, 0.004).translate(0, 0.05, 0.021), m(flat('#324f53')), pos, { rotZ, rotX: -0.2 });
  }
  // 目の後ろ: ごみ箱の並びの続き
  for (const z of [0.6, 1.1]) bin(s, binM, binM, -0.84, z, 0.3, 0.22, 0.4);

  // ---- 床の紙くず ----
  const fl = (x: number, y: number): V3 => {
    const [px, pz] = cam.floor(x, y, 0.002);
    return [px, 0.002, pz];
  };
  const scraps: [number, number, number, number][] = [
    [495, 618, 524, 630],
    [497, 564, 519, 572],
    [785, 556, 804, 564],
    [515, 450, 528, 455],
    [690, 384, 700, 387],
    [770, 375, 782, 378],
    [640, 372, 650, 375],
  ];
  for (const [x0, y0, x1, y1] of scraps) s.quad(scrapM, fl(x0, y1), fl(x1, y1), fl(x1, y0), fl(x0, y0));

  // ---- 角 CD（z 3.89〜6.84）: 左は西の廊下の防火戸の裏、右は南階段、奥は 4 床室 516 ----
  {
    // 西の廊下（脚 C）の扉の口（区域 z）。脚 C の区域 x → 場面 x = -19.5 - x
    const LC = LEGS.C;
    const cz0 = lz(LC.origin[0] - 0.65);
    const cz1 = lz(LC.origin[0] + 0.74);
    const cTop = 2.39;
    const a0 = Math.min(cz0, cz1);
    const a1 = Math.max(cz0, cz1);
    s.faces([LW - 0.3, 0, BK], [LW, H, a0], { px: lwall }, { collide: true });
    s.faces([LW - 0.3, 0, a1], [LW, H, CE], { px: lwall }, { collide: true });
    s.faces([LW - 0.3, cTop, a0], [LW, H, a1], { px: lwall });
    s.faces([LW, 0, a0 - 0.06], [LW + 0.04, cTop + 0.05, a0], { px: cream, pz: cream, nz: cream });
    s.faces([LW, 0, a1], [LW + 0.04, cTop + 0.05, a1 + 0.06], { px: cream, pz: cream, nz: cream });
    s.faces([LW, cTop, a0], [LW + 0.04, cTop + 0.05, a1], { px: cream, ny: cream });
    skirt(LW, 1, 0.22, bandL, BK, a0 - 0.06);
    skirt(LW, 1, 0.22, bandL, a1 + 0.06, CE);
    // 右（南階段の扉）
    s.faces([RW, 0, BK], [RW + 0.3, H, stsDoor[0]], { nx: rwall }, { collide: true });
    s.faces([RW, 0, stsDoor[1]], [RW + 0.3, H, CE], { nx: rwall }, { collide: true });
    s.faces([RW, 2.1, stsDoor[0]], [RW + 0.3, H, stsDoor[1]], { nx: rwall });
    doorTrimX(s, cream, RW, -1, stsDoor[0], stsDoor[1], 2.1);
    skirt(RW, -1, 0.13, bandR, BK, stsDoor[0] - 0.05);
    skirt(RW, -1, 0.13, bandR, stsDoor[1] + 0.05, CE);
    const exit = atlas.add(160, 64, (g, w, h) => {
      paper(g, w, h, '#4f8f6a', '#2c4a3a', 3);
      bar(g, 14, 12, 30, 40, '#e9f2dc');
      scribble(g, 56, 14, w - 70, 34, { color: '#e9f2dc', row: 16, width: 4, seed: 72 });
    });
    const exitM = s.ctx.mat({ color: '#ffffff', map: atlas.tex, unlit: true, line: 0.5 });
    s.sheet(exitM, '-x', [RW - 0.01, 2.4, (stsDoor[0] + stsDoor[1]) / 2], 0.5, 0.2, exit);
    // 奥（4 床室 516 の扉）
    const wa = Math.min(w4Door[0], w4Door[1]);
    const wb = Math.max(w4Door[0], w4Door[1]);
    s.faces([LW, 0, CE], [wa, H, CE + 0.3], { nz: lwall }, { collide: true });
    s.faces([wb, 0, CE], [RW, H, CE + 0.3], { nz: lwall }, { collide: true });
    s.faces([wa, 2.1, CE], [wb, H, CE + 0.3], { nz: lwall });
    doorTrimZ(s, cream, CE, -1, wa, wb, 2.1);
  }
}

/** 扉の葉の上に、参考画像の外接矩形の位置の紙を貼る（leg の座標 = 区域の座標のまま） */
function sheetOn(q: Leg, cam: ViewCam, mat: THREE.Material, wx: number, bx: [number, number, number, number], rot: number, shrink: number, uv?: [number, number, number, number]): void {
  const ym = (bx[1] + bx[3]) / 2;
  const a = cam.hit(bx[0], ym, 'x', wx);
  const b = cam.hit(bx[2], ym, 'x', wx);
  const nearX = a[2] > b[2] ? bx[0] : bx[2];
  const t = cam.hit(nearX, bx[1], 'x', wx);
  const u = cam.hit(nearX, bx[3], 'x', wx);
  const c: V3 = [wx, (t[1] + u[1]) / 2, (a[2] + b[2]) / 2];
  q.sheet(mat, '+x', c, Math.abs(a[2] - b[2]) * shrink, Math.abs(t[1] - u[1]) * shrink, uv, {}, rot);
}

/** 壁の面（x = wx）の上の、画像の外接矩形の位置の薄い箱 [min, max] */
function boxOn(cam: ViewCam, wx: number, bx: [number, number, number, number], depth: number): [V3, V3] {
  const ym = (bx[1] + bx[3]) / 2;
  const a = cam.hit(bx[0], ym, 'x', wx);
  const b = cam.hit(bx[2], ym, 'x', wx);
  const nearX = a[2] > b[2] ? bx[0] : bx[2];
  const t = cam.hit(nearX, bx[1], 'x', wx);
  const u = cam.hit(nearX, bx[3], 'x', wx);
  const x0 = Math.min(wx, wx + depth * Math.sign(-wx));
  const x1 = Math.max(wx, wx + depth * Math.sign(-wx));
  return [
    [x0, Math.min(t[1], u[1]), Math.min(a[2], b[2])],
    [x1, Math.max(t[1], u[1]), Math.max(a[2], b[2])],
  ];
}
