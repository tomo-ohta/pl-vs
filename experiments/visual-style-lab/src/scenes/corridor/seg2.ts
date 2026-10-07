import * as THREE from 'three';
import type { V3 } from '../Builder.ts';
import { decalMaterial } from '../../render/Decal.ts';
import { type Atlas, paintMaterial, type Seg, ViewCam } from './kit.ts';
import { caster, flat, floorBand, wallFlecks } from './props.ts';
import { bar, inkNotice, paper, perforated } from './tex.ts';

/**
 * corridor-2: 淡いセージの長い左の壁と掲示、白いポール、格子の天井、片開きの赤い扉。
 * 線（暗い青緑）がはっきり、壁に縁取りのある白いかすれ、幅木は暗い青緑の帯と床の淡い影の帯（縁がちぎれている）。
 */
export const CAM2 = new ViewCam([0, 1.55, 0], -0.024, -0.2369, 52.91);

type Box4 = [number, number, number, number];

export function buildSeg2(s: Seg, atlas: Atlas, paperMat: THREE.Material): void {
  const cam = CAM2;
  const m = (o: Parameters<typeof s.ctx.mat>[0]): THREE.MeshStandardMaterial => s.ctx.mat({ line: 0.8, ...o });
  const H = 2.9;
  const ZE = -16.45;
  const Z0 = 2.5;

  const floor = m(flat('#e4edce', '#aebaa3', { line: 0.3 }));
  const ceil = m(flat('#cfdfcc', undefined, { line: 0.3, tiles: { size: [0.6, 1.2], line: 0.012, color: '#b4c6b2' } }));
  const lwall = m(flat('#b9cdb4', undefined, { line: 0.6 }));
  const farWall = m(flat('#a5b79f', undefined, { line: 0.6 }));
  const pale = m(flat('#e4f3d4', undefined, { line: 0.8 }));
  const base = m(flat('#587778', undefined, { line: 1 }));
  const door = m(flat('#cb7d70', undefined, { line: 1 }));
  const frame = m(flat('#e8f4dc', undefined, { line: 1 }));
  const white = m(flat('#eef8e4', '#c9d6bf', { line: 1 }));
  const whiteShade = m(flat('#c7d8c2', undefined, { line: 1 }));
  const teal = m(flat('#5a797b', undefined, { line: 1 }));
  const dark = m(flat('#2e4448', undefined, { line: 1 }));
  const lampM = m({ color: '#fdfdfd', unlit: true, line: 1 });
  const floorShadow = decalMaterial({ color: '#aebaa3', rag: 0.035, scale: 3.2, ink: 0.005, inkColor: '#3f5658', edges: [0, 1, 0, 0], step: 0.06 });
  const floorDark = decalMaterial({ color: '#587778', rag: 0.018, scale: 3.5, ink: 0.004, inkColor: '#2c4245', edges: [0, 1, 0, 0], specks: 0.18, speckColor: '#e4f1dd', step: 0.05 });
  const band = (wx: number, n: 1 | -1, z0: number, z1: number, w1 = 0.12, w2 = 0.09): void => floorBand(s, wx, n, z0, z1, floorDark, w1, floorShadow, w2);
  const fleckM = decalMaterial({ color: '#e6f4d8', rag: 0.004, scale: 40, ink: 0.003, inkColor: '#2c4245' });
  const scrapM = decalMaterial({ color: '#eff8e2', rag: 0.006, scale: 20 });

  // ---- 床・天井 ----
  s.faces([-2.2, -0.1, ZE - 0.3], [2.4, 0, Z0], { py: floor }, { collide: true });
  s.faces([-2.2, H, ZE - 0.3], [2.4, H + 0.1, Z0], { ny: ceil });
  // 扉の前の敷物（参考画像の形をなぞる）
  s.paint(paintMaterial(s.ctx, '#c9c3ab'), 'y', 0.004, MAT);

  // ---- 左の壁 ----
  const LW = -1.35;
  s.faces([LW - 0.3, 0, -6.1], [LW, H, Z0], { px: lwall }, { collide: true });
  // 壁の足元: 床の暗い帯と、その外の淡い影の帯（どちらも外側の縁がちぎれる）
  band(LW, 1, -6.1, Z0);
  // 少し暗い長方形（掲示を剥がした跡）
  s.sheetImg(m(flat('#a8bba3', undefined, { line: 0.2 })), '+x', LW + 0.002, [435, 207, 495, 300], undefined, 0, 1);
  // 左の柱型（白い縦の帯）と奥の壁
  s.faces([LW - 0.2, 0, -6.4], [LW + 0.14, H, -6.1], { pz: pale, px: pale }, { collide: true });
  s.faces([LW - 0.3, 0, ZE], [LW - 0.05, H, -6.4], { px: lwall }, { collide: true });
  band(LW - 0.05, 1, ZE, -6.4, 0.08, 0.05);
  for (const z of [-9.0, -12.2]) s.faces([LW - 0.05, 0, z - 0.3], [LW + 0.1, H, z], { pz: pale, px: pale }, { collide: true });
  // 奥の左の暗い扉
  s.faces([LW - 0.05, 0, -16.2], [LW - 0.02, 2.2, -15.3], { px: teal });
  // 壁の上の換気口と、カメラの金具
  const vent = atlas.add(96, 96, (g, w, h) => {
    paper(g, w, h, '#dfe9d6', '#2c4245', 4);
    for (let i = 0; i < 6; i++) bar(g, 20, 16 + i * 12, w - 34, 4, '#2c4245');
  });
  s.sheetImg(paperMat, '+x', LW + 0.006, [447, 10, 497, 62], vent, 0, 1);
  s.faces([LW, 2.35, -7.9], [LW + 0.35, 2.4, -7.85], { py: dark, pz: dark, ny: dark });
  s.faces([LW + 0.25, 2.1, -8.05], [LW + 0.42, 2.38, -7.75], { pz: teal, px: teal, ny: teal });

  // ---- 右 ----
  const RNW = 1.43; // 手前の壁（z = -2.63 で終わり、その奥は引っ込み）
  const RP = 1.37; // 柱型の内側の面
  s.faces([RNW, 0, -2.63], [RNW + 0.3, H, Z0], { nx: farWall }, { collide: true });
  band(RNW, -1, -2.63, Z0, 0.1, 0.08);
  s.faces([RNW + 0.3, 0, -3.43], [2.3, H, -2.63], { nx: pale }, { collide: true });
  s.faces([RP, 0, -4.4], [2.3, H, -3.43], { pz: pale, nx: pale }, { collide: true });
  s.faces([RP, 0, -3.44], [2.3, 0.1, -3.42], { pz: base });
  s.faces([RP - 0.02, 0, -4.4], [RP, 0.1, -3.43], { nx: base });
  const RW = 1.6;
  s.faces([RW, 0, ZE], [RW + 0.3, H, -4.4], { nx: lwall }, { collide: true });
  band(RW, -1, ZE, -4.4, 0.08, 0.06);
  for (const z of [-7.4, -11.0]) s.faces([RW - 0.14, 0, z - 0.3], [RW, H, z], { pz: pale, nx: pale }, { collide: true });
  // 奥の右の壁の影（カートの後ろ）
  s.paint(paintMaterial(s.ctx, '#a5b79f'), 'x', RW - 0.003, SHADOW_RW);
  // 奥の右の窓付きの扉
  s.faces([RW - 0.04, 0, -9.2], [RW, 2.3, -8.3], { nx: frame, pz: frame });
  s.faces([RW - 0.045, 1.95, -8.75], [RW - 0.04, 2.25, -8.5], { nx: dark });
  // 右手前の壁の大きな白いかすれ（参考画像の形をなぞる。縁に暗い線）
  const patchW = paintMaterial(s.ctx, '#e6f4d8');
  const patchInk = paintMaterial(s.ctx, '#2c4245');
  for (const pts of PATCH_R) {
    s.paint(patchInk, 'x', RNW - 0.003, grow(pts, 1.6));
    s.paint(patchW, 'x', RNW - 0.006, pts);
  }

  // 右の柱型の白い機械（壁から出た台の上の箱）
  s.faces([1.08, 1.97, -3.62], [1.43, 2.16, -3.43], { pz: white, nx: white, py: white, ny: whiteShade }, { shadow: true });
  s.faces([1.2, 2.16, -3.58], [1.4, 2.26, -3.46], { pz: white, nx: white, py: white });

  // ---- 突き当たり: 片開きの赤い扉 ----
  s.faces([-1.8, 0, ZE - 0.3], [1.8, H, ZE], { pz: lwall }, { collide: true });
  const dx0 = -0.74;
  const dx1 = 0.65;
  s.faces([dx0, 0, ZE], [dx1, 2.39, ZE + 0.03], { pz: door });
  s.faces([dx0 - 0.05, 0, ZE], [dx0, 2.44, ZE + 0.04], { pz: frame });
  s.faces([dx1, 0, ZE], [dx1 + 0.05, 2.44, ZE + 0.04], { pz: frame });
  s.faces([dx0, 2.39, ZE], [dx1, 2.44, ZE + 0.04], { pz: frame });
  s.faces([-0.12, 2.6, ZE], [0.12, 2.78, ZE + 0.05], { pz: frame });
  const doorNote = atlas.add(120, 150, (g, w, h) => inkNotice(g, w, h, 41));
  s.sheet(paperMat, '+z', [0.15, 1.75, ZE + 0.035], 0.28, 0.34, doorNote);
  s.faces([-0.62, 1.08, ZE], [-0.58, 1.38, ZE + 0.07], { pz: frame });
  s.faces([-0.62, 1.1, ZE], [-0.45, 1.13, ZE + 0.08], { pz: frame });
  // 扉の左右の掲示・右の白い箱
  s.sheet(paperMat, '+z', [-1.25, 1.75, ZE + 0.01], 0.32, 0.42, atlas.add(120, 150, (g, w, h) => inkNotice(g, w, h, 42)));
  s.faces([1.05, 0, -15.6], [1.45, 0.75, -15.2], { pz: frame, nx: frame, py: frame });

  // ---- 天井の灯り・カメラ ----
  for (const [z, len, cx] of [
    [-6.67, 1.42, 0.07],
    [-9.86, 1.78, 0.16],
    [-12.4, 1.8, 0.21],
  ] as [number, number, number][]) {
    s.faces([cx - len / 2, H - 0.04, z - 0.07], [cx + len / 2, H - 0.01, z + 0.07], { ny: white, pz: white });
    s.faces([cx - len / 2 + 0.04, H - 0.045, z - 0.03], [cx + len / 2 - 0.04, H - 0.04, z + 0.03], { ny: lampM });
  }
  for (const [x, z, k] of [
    [0.2, -5.7, 1],
    [0.24, -9.0, 0.8],
  ] as [number, number, number][]) {
    s.faces([x - 0.12 * k, H - 0.24 * k, z - 0.1], [x + 0.12 * k, H, z + 0.1], { pz: dark, nx: dark, px: dark, ny: dark });
    s.faces([x - 0.09 * k, H - 0.2 * k, z + 0.1], [x + 0.09 * k, H - 0.06 * k, z + 0.11], { pz: whiteShade });
  }
  s.cyl(dark, [0.0, H - 0.12, -12.1], 0.08, 0.1, { segments: 14 });
  s.cyl(dark, [0.0, H - 0.04, -12.1], 0.02, 0.08, { segments: 8 });

  // ---- 小物 ----
  // 白いポール（影の側は淡い灰緑）
  for (const z of [-2.97, -3.79, -4.54]) {
    s.cyl(white, [-0.8, 0.012, z], 0.17, 0.024, { segments: 28 });
    s.cyl(white, [-0.8, 0.4, z], 0.034, 0.8, { segments: 14 });
    s.cyl(white, [-0.8, 0.805, z], 0.04, 0.03, { segments: 14 });
  }
  // 暗い青緑のカート（穴の並んだ板、上に白い箱）
  const perf = atlas.add(200, 220, (g, w, h) => perforated(g, w, h, '#5a797b', '#3c5558', 16, 5));
  const cx0 = 0.71;
  const cx1 = 1.34;
  const cz0 = -4.9;
  const cz1 = -4.42;
  const cy0 = 0.13;
  const cy1 = 0.93;
  s.faces([cx0, cy0, cz0], [cx1, cy1, cz1], { pz: teal, nx: teal, px: teal, py: teal }, { collide: true, shadow: true });
  s.sheet(paperMat, '+z', [(cx0 + cx1) / 2, (cy0 + cy1) / 2, cz1 + 0.003], cx1 - cx0 - 0.04, cy1 - cy0 - 0.06, perf);
  s.sheet(paperMat, '-x', [cx0 - 0.003, (cy0 + cy1) / 2, (cz0 + cz1) / 2], cz1 - cz0 - 0.04, cy1 - cy0 - 0.06, perf);
  for (const x of [cx0 + 0.04, cx1 - 0.04]) for (const z of [cz0 + 0.04, cz1 - 0.04]) caster(s, dark, dark, x, z, 0.05);
  s.faces([0.85, cy1, -4.8], [1.18, cy1 + 0.17, -4.5], { pz: white, nx: white, py: white });
  // 支払い端末（低い台・円い足）
  s.cyl(teal, [1.33, 0.01, -1.93], 0.17, 0.02, { segments: 24 });
  s.cyl(teal, [1.31, 0.14, -1.93], 0.022, 0.26, { segments: 10 });
  s.faces([1.24, 0.26, -1.98], [1.36, 0.44, -1.92], { pz: teal, nx: teal, py: teal });
  s.faces([1.26, 0.33, -1.919], [1.34, 0.42, -1.915], { pz: m(flat('#cfe6ee')) });

  // ---- 掲示（参考画像の外接矩形から壁に貼る） ----
  const left: [number, number, number, number, number][] = [
    [128, 308, 202, 455, 0.08],
    [202, 263, 235, 333, 0.04],
    [266, 164, 323, 323, 0.05],
    [356, 220, 378, 283, 0.03],
    [396, 217, 437, 326, 0.05],
  ];
  left.forEach(([x0, y0, x1, y1, r], i) => s.sheetImg(paperMat, '+x', LW + 0.006, [x0, y0, x1, y1], atlas.add(160, 240, (g, w, h) => inkNotice(g, w, h, 50 + i)), r));
  const right: Box4[] = [
    [1166, 224, 1197, 286],
    [1262, 270, 1308, 351],
    [1303, 266, 1361, 356],
  ];
  right.forEach((bx, i) => s.sheetImg(paperMat, '-x', RNW - 0.006, bx, atlas.add(140, 200, (g, w, h) => inkNotice(g, w, h, 60 + i, { head: false })), -0.03));
  s.sheetImg(paperMat, '+z', -3.425, [1060, 213, 1100, 268], atlas.add(160, 200, (g, w, h) => inkNotice(g, w, h, 70)));

  // ---- 壁の白いかすれ ----
  wallFlecks(s, fleckM, LW, 1, [-6.0, 0.5], [0.15, 2.7], 40, 101, [0.03, 0.42], [0.016, 0.035], [0.02, 0.25]);
  wallFlecks(s, fleckM, LW, 1, [-6.0, 0.5], [0.15, 2.4], 30, 104, [0.05, 0.3], [0.016, 0.03], [1.3, 1.57]);
  wallFlecks(s, fleckM, RNW, -1, [-2.6, 0.0], [0.2, 2.6], 26, 102, [0.03, 0.35], [0.014, 0.035], [0.05, 0.4]);
  wallFlecks(s, fleckM, RW, -1, [-12, -4.5], [0.2, 2.6], 30, 103, [0.03, 0.3], [0.01, 0.025], [0.05, 0.4]);

  // ---- 床の紙くず ----
  const fl = (x: number, y: number): V3 => {
    const [px, pz] = cam.floor(x, y, 0.002);
    return [px, 0.002, pz];
  };
  const scraps: Box4[] = [
    [593, 541, 664, 571],
    [700, 427, 734, 440],
    [676, 358, 728, 363],
    [855, 465, 920, 481],
    [704, 437, 726, 440],
  ];
  for (const [x0, y0, x1, y1] of scraps) s.quad(scrapM, fl(x0, y1), fl(x1, y1), fl(x1, y0), fl(x0, y0));
}

// 参考画像の画素座標でなぞった形
const MAT: [number, number][] = [
  [701, 339.5], [683, 339.5], [673.5, 336], [675.5, 328], [672.5, 325], [672.5, 307], [676.5, 301], [675.5, 297], [735, 295.5], [738.5, 300],
  [728.5, 308], [727.5, 313], [739.5, 325], [736, 325.5], [729, 335.5], [706, 334.5],
];
const PATCH_R: [number, number][][] = [
  [
    [1272, 814.5], [1264.5, 813], [1269.5, 807], [1272.5, 785], [1248.5, 757], [1247.5, 750], [1270, 747.5], [1278.5, 741], [1283.5, 714], [1264.5, 682],
    [1268, 676.5], [1287, 693.5], [1290.5, 690], [1303, 627.5], [1309.5, 633], [1309.5, 644], [1293.5, 694], [1300.5, 704], [1289.5, 709],
  ],
  [[1201, 781.5], [1197, 775.5], [1193, 778.5], [1181.5, 773], [1182, 750.5], [1197, 769.5], [1201, 764.5], [1206.5, 767], [1206.5, 776]],
];

const SHADOW_RW: [number, number][] = [
  [965, 328.5], [957.5, 328], [956.5, 320], [955, 313.5], [935.5, 303], [936.5, 288], [932.5, 281], [928, 282.5], [914.5, 281], [924.5, 272],
  [924.5, 245], [938.5, 243], [936.5, 221], [943.5, 217], [937.5, 205], [939.5, 194], [945, 189.5], [978.5, 191], [973.5, 224], [972.5, 279], [968.5, 290], [971.5, 294],
];

/** 多角形を重心から外へ d 画素広げる（縁の線用） */
function grow(pts: [number, number][], d: number): [number, number][] {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([x, y]) => {
    const l = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / l) * d, y + ((y - cy) / l) * d];
  });
}

