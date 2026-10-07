import * as THREE from 'three';
import type { V3 } from '../Builder.ts';
import { decalMaterial } from '../../render/Decal.ts';
import { type Atlas, type Seg, ViewCam } from './kit.ts';
import { bin, caster, flat, lamp } from './props.ts';
import { bar, paper, pin, scribble } from './tex.ts';

/**
 * corridor-3: 左はクリームがかったカーキの壁（扉の枠・掲示板・窓）、右の壁・天井・床は同じ青緑。
 * 壁の足元に紺の幅木（上の縁が階段状にちぎれる）、右の壁に淡い縦の傷。突き当たりはクリームの壁に両開きの赤い扉と暗い欄間。
 */
export const CAM3 = new ViewCam([0, 1.6, 0], 0, -0.2178, 50.61);

type Box4 = [number, number, number, number];

export function buildSeg3(s: Seg, atlas: Atlas, paperMat: THREE.Material): void {
  const cam = CAM3;
  const m = (o: Parameters<typeof s.ctx.mat>[0]): THREE.MeshStandardMaterial => s.ctx.mat({ line: 0.3, ...o });
  const H = 2.75;
  const ZE = -12.46;
  const Z0 = 2.5;
  const LW = -1.12;
  const RW = 1.17;

  const teal = '#80a496';
  const floor = m(flat('#7da396', '#5f8479', { line: 0.2 }));
  const ceil = m(flat(teal, undefined, { line: 0.2 }));
  const rwall = m(flat(teal, undefined, { line: 0.3, flecks: { scale: 2.4, density: 0.22, color: '#c3d8c8', length: 0.9, width: 0.02 } }));
  const lwall = m(flat('#c0c5a5', undefined, { line: 0.3 }));
  const cream = m(flat('#e8ecc7', undefined, { line: 0.5 }));
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

  // ---- 床・天井・壁 ----
  s.faces([-1.6, -0.1, ZE - 0.3], [1.8, 0, Z0], { py: floor }, { collide: true });
  s.faces([-1.6, H, ZE - 0.3], [1.8, H + 0.1, Z0], { ny: ceil });
  s.faces([LW - 0.3, 0, ZE], [LW, H, Z0], { px: lwall }, { collide: true });
  s.faces([RW, 0, ZE], [RW + 0.3, H, Z0], { nx: rwall }, { collide: true });
  // 足元の紺の幅木（壁の面。上の縁が階段状にちぎれる）
  s.quad(bandL, [LW + 0.004, 0, Z0], [LW + 0.004, 0, ZE + 0.25], [LW + 0.004, 0.22, ZE + 0.25], [LW + 0.004, 0.22, Z0]);
  s.quad(bandR, [RW - 0.004, 0, ZE + 0.25], [RW - 0.004, 0, Z0], [RW - 0.004, 0.13, Z0], [RW - 0.004, 0.13, ZE + 0.25]);

  // ---- 突き当たり ----
  const EW = -12.24;
  s.faces([LW, 0, ZE], [RW, H, EW], { pz: cream, px: cream, nx: cream }, { collide: true });
  const dx0 = -1.0;
  const dx1 = 0.64;
  const dmid = (dx0 + dx1) / 2;
  s.faces([dx0, 0.25, EW], [dx1, 1.83, EW + 0.03], { pz: door });
  s.faces([dx0, 0, EW], [dx1, 0.25, EW + 0.03], { pz: kick });
  s.faces([dmid - 0.02, 0, EW], [dmid + 0.02, 1.83, EW + 0.04], { pz: kick });
  for (const cx of [dx0 + 0.36, dx1 - 0.36]) s.faces([cx - 0.17, 1.1, EW], [cx + 0.17, 1.5, EW + 0.035], { pz: transom });
  for (const cx of [dmid - 0.1, dmid + 0.1]) s.faces([cx - 0.06, 0.7, EW], [cx + 0.06, 1.05, EW + 0.05], { pz: kick });
  // 欄間（暗いガラスと枠）
  for (let i = 0; i < 5; i++) {
    const x0 = -0.98 + i * 0.4;
    s.faces([x0, 1.97, EW], [x0 + 0.35, 2.32, EW + 0.02], { pz: transom });
  }
  // 扉の右の淡いガラス・上の案内の箱
  s.faces([0.68, 0.35, EW], [0.92, 1.8, EW + 0.02], { pz: glassT });
  // 右の壁から出た案内の箱
  s.faces([0.72, 2.32, -9.1], [RW, 2.62, -8.95], { pz: cream, ny: cream, nx: cream });

  // ---- 天井 ----
  for (const z of [-6.28, -8.54, -10.95]) lamp(s, lampBody, lampLens, [0, H, z], 1.5, 0.2, 0.05, 0.03);
  s.cyl(lampBody, [-0.08, H - 0.1, -4.7], 0.1, 0.12, { segments: 16 });
  s.cyl(m(flat('#20302f')), [-0.08, H - 0.19, -4.7], 0.06, 0.06, { segments: 12 });
  s.cyl(lampBody, [0.0, H - 0.08, -11.4], 0.08, 0.1, { segments: 16 });

  // ---- 左の壁 ----
  const onL = (x: number, y: number, dx = 0): V3 => cam.hit(x, y, 'x', LW + dx);
  // 手前の扉の枠（クリーム、手前へ少し出る）と横の細い帯
  s.quad(cream, onL(300, 816, 0.03), onL(335, 816, 0.03), onL(262, 85, 0.03), onL(240, 85, 0.03));
  s.quad(cream, onL(232, 470, 0.01), onL(245, 470, 0.01), onL(232, 180, 0.01), onL(215, 180, 0.01));
  // 手前の扉の上: 細い青緑の影の線・暗い欄間・クリームの板
  s.quad(m(flat('#82a699')), onL(-40, 28, 0.006), onL(252, 88, 0.006), onL(252, 80, 0.006), onL(-40, 6, 0.006));
  s.quad(m(flat('#24363d')), onL(98, -20, 0.006), onL(180, -20, 0.006), onL(180, 30, 0.006), onL(98, 0, 0.006));
  s.quad(cream, onL(182, 0, 0.006), onL(212, 0, 0.006), onL(212, 40, 0.006), onL(182, 30, 0.006));
  s.quad(cream, onL(220, 0, 0.006), onL(252, 0, 0.006), onL(252, 55, 0.006), onL(225, 48, 0.006));
  // 窓・カード読み取り機・紙・火災報知器・板
  s.sheetImg(m(flat('#bbbf9f')), '+x', LW + 0.004, [78, 182, 182, 372], undefined, -0.1, 0.98);
  const win = atlas.add(120, 200, (g, w, h) => {
    paper(g, w, h, '#7ea294');
    bar(g, 0, h / 2 - 3, w, 6, '#bbbf9f');
    pin(g, 8, 8, 5, '#26343a');
    pin(g, w - 8, 8, 5, '#26343a');
    pin(g, 8, h - 8, 5, '#26343a');
    pin(g, w - 8, h - 8, 5, '#26343a');
  });
  s.sheetImg(paperMat, '+x', LW + 0.008, [84, 190, 178, 366], win, -0.1, 0.97);
  const card = atlas.add(64, 100, (g, w, h) => {
    paper(g, w, h, '#7ea294', '#4f6566', 3);
    bar(g, 10, 12, w - 20, 40, '#546869');
    bar(g, 14, 70, w - 28, 16, '#956368');
  });
  s.sheetImg(paperMat, '+x', LW + 0.02, [20, 365, 65, 450], card, 0, 1);
  const noteL = atlas.add(100, 110, (g, w, h) => {
    paper(g, w, h, '#c3c8a8');
    scribble(g, 10, 14, w - 20, h - 24, { color: '#8f9a8c', row: 12, width: 3, seed: 81 });
  });
  s.sheetImg(paperMat, '+x', LW + 0.004, [135, 415, 185, 470], noteL, 0, 1);
  s.faces(...boxOn(cam, LW, [270, 20, 300, 96], 0.04, 0), { px: m(flat('#8a3f4b')), pz: red, ny: red });
  // 掲示板（青緑）と紙
  s.sheetImg(m(flat('#88a998')), '+x', LW + 0.006, [330, 140, 415, 385], undefined, 0, 1);
  s.sheetImg(m(flat('#7da396')), '+x', LW + 0.006, [435, 160, 530, 375], undefined, 0, 1);
  const pp = (bg: string, seed: number, ink = '#8d998a'): Box4 =>
    atlas.add(100, 150, (g, w, h) => {
      paper(g, w, h, bg);
      scribble(g, 12, 18, w - 24, h - 30, { color: ink, row: 14, width: 3, seed });
    });
  const papersL: [Box4, string][] = [
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
  // 取っ手
  s.faces(...boxOn(cam, LW, [272, 445, 308, 470], 0.05, 0.02), { px: m(flat('#c9d0c3')), pz: m(flat('#c9d0c3')) });
  s.faces(...boxOn(cam, LW, [275, 405, 292, 440], 0.02, 0.03), { px: m(flat('#9fb0a3')) });
  // 奥の扉の枠
  for (const [x, w] of [
    [540, 18],
    [582, 10],
    [612, 8],
  ] as [number, number][]) {
    const a = cam.hit(x, 250, 'x', LW)[2];
    const b = cam.hit(x + w, 250, 'x', LW)[2];
    s.faces([LW, 0, Math.min(a, b)], [LW + 0.04, 2.3, Math.max(a, b)], { px: cream, pz: jambSide });
  }
  s.sheetImg(red, '+x', LW + 0.006, [540, 210, 548, 245], undefined, 0, 1);
  s.sheetImg(m(flat('#3d6a8a')), '+x', LW + 0.006, [535, 245, 545, 256], undefined, 0, 1);

  // ---- 右の壁 ----
  const onR = (x: number, y: number, dx = 0): V3 => cam.hit(x, y, 'x', RW - dx);
  for (const [x, w] of [
    [925, 6],
    [879, 12],
  ] as [number, number][]) {
    const a = cam.hit(x, 300, 'x', RW)[2];
    const b = cam.hit(x + w, 300, 'x', RW)[2];
    s.faces([RW - 0.04, 0, Math.min(a, b)], [RW, 2.3, Math.max(a, b)], { nx: cream, pz: cream });
  }
  s.sheetImg(red, '-x', RW - 0.02, [943, 118, 958, 160], undefined, 0, 1);
  // 暗い掲示板（台形に見える）と下の受け
  s.quad(m(flat('#5b7873')), onR(960, 338, 0.01), onR(1088, 398, 0.01), onR(1089, 150, 0.01), onR(966, 176, 0.01));
  s.quad(m(flat('#9db6a8')), onR(990, 392, 0.03), onR(1100, 428, 0.03), onR(1100, 412, 0.03), onR(990, 380, 0.03));
  const papersR: [Box4, string][] = [
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
  s.faces([0.71, 0.14, -3.18], [1.03, 0.72, -2.73], { pz: cartM, nx: cartM, px: cartM, py: cartM, ny: cartM }, { shadow: true });
  s.collider([0.62, 0, -3.3], [1.1, 0.86, -2.63]);
  s.faces([0.71, 0.36, -2.729], [1.03, 0.375, -2.725], { pz: m(flat('#c9ccab')) });
  for (const x of [0.67, 1.06]) for (const z of [-3.2, -2.7]) s.box(cartM, [x - 0.015, 0.1, z - 0.015], [x + 0.015, 0.8, z + 0.015]);
  s.faces([0.65, 0.1, -3.22], [1.08, 0.13, -2.68], { py: cartM, pz: cartM, nx: cartM });
  s.faces([0.62, 0.79, -3.25], [1.09, 0.83, -2.65], { py: m(flat('#c2c7a7')), pz: cartM, nx: cartM, px: cartM });
  s.faces([0.62, 0.83, -2.69], [1.09, 0.87, -2.65], { pz: cartM, py: cartM });
  s.faces([0.62, 0.83, -3.25], [0.65, 0.87, -2.65], { nx: cartM, py: cartM });
  s.faces([0.66, 0.72, -2.73], [1.07, 0.79, -2.7], { pz: cartM });
  for (const x of [0.69, 1.02]) for (const z of [-3.24, -2.69]) caster(s, wheel, cartM, x, z, 0.06, 0.04);
  // 右の壁の箱（ディスペンサー）
  s.faces([RW - 0.1, 0.83, -2.7], [RW, 1.1, -2.44], { nx: cartM, pz: cartM, ny: cartM });
  // 右手前の手持ちの端末（少し傾いて置かれている。画面が暗い）
  {
    const pos: V3 = [0.89, 0.3, -1.75];
    const rotZ = -0.32;
    s.mesh(new THREE.BoxGeometry(0.17, 0.27, 0.04), cartM, pos, { rotZ, rotX: -0.2 });
    s.mesh(new THREE.BoxGeometry(0.12, 0.1, 0.004).translate(0, 0.05, 0.021), m(flat('#324f53')), pos, { rotZ, rotX: -0.2 });
  }

  // ---- 床の紙くず ----
  const fl = (x: number, y: number): V3 => {
    const [px, pz] = cam.floor(x, y, 0.002);
    return [px, 0.002, pz];
  };
  const scraps: Box4[] = [
    [495, 618, 524, 630],
    [497, 564, 519, 572],
    [785, 556, 804, 564],
    [515, 450, 528, 455],
    [690, 384, 700, 387],
    [770, 375, 782, 378],
    [640, 372, 650, 375],
  ];
  for (const [x0, y0, x1, y1] of scraps) s.quad(scrapM, fl(x0, y1), fl(x1, y1), fl(x1, y0), fl(x0, y0));
}

/** 壁の面（x = wx）の上の、画像の外接矩形の位置の薄い箱 [min, max, mats の前の引数] */
function boxOn(cam: ViewCam, wx: number, bx: Box4, depth: number, _pad: number): [V3, V3] {
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

