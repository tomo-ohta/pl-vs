import * as THREE from 'three';
import { paint } from './paint.ts';
import type { PaintOptions } from '../../render/PaintMaterial.ts';
import { rng, type Builder, type V3 } from '../../scenes/Builder.ts';
import type { Doors } from './doors.ts';
import { contactF, floorPatch, frameLamp, notice, patchMat } from './dress.ts';
import { LocalFrame } from './frame.ts';
import { BACKDOOR, W_CORR, W_ROOM, WBAY, WEST } from './layout.ts';
import { facadeMat } from './mats.ts';
import { SUN_DIR } from './sun.ts';
import { extinguisher, trashBin } from '../../props/lib/index.ts';
import { PropArea, propMats, propOnFrame } from './props/mats.ts';
import { bookStack, ceilingTv, cleaningCabinet, cleaningTools, cubbyLocker, duckboard, gymBag, lectern, pencilCase, schoolBag, schoolChair, schoolDesk, slipperRack, steelLocker, umbrellaStand, wallClock, wallSpeaker } from './props/school.ts';

/**
 * 西棟 1 階の入れる所: 通路の裏口 → 廊下（通路側。3 段の大きな窓）→ 教室（後ろの引き戸から）。
 * 形は西棟の壁の座標（u: 壁に沿って北へ、w: 外が正。廊下は w -0.3〜-3.0、教室は -3.15〜-11.2）で作る。
 * 教室は窓が左に来る向き（北が前・黒板、南が後ろ・ロッカー）。窓（西）のカーテンはほとんど閉じている。
 * 部屋の物の決まり: 教室 = 机と椅子 6 × 6・教卓・黒板・後ろの黒板と掲示・ロッカー・掃除用具入れ・時計・スピーカー・テレビ・蛍光灯・カーテン。
 * 廊下 = 腰壁・幅木・掲示板と掲示物・室名札・消火栓・消火器・非常ベル・ごみ箱・掃除用具・傘立て・下駄箱（裏口の脇）・ロッカー・非常口の表示・蛍光灯・教室の窓と欄間。
 * 光: 放課後の夕方。蛍光灯は廊下の 1 つおきと教室の前の列だけ点いている（光だまり）。廊下の窓ぎわの床は外の明るさで少し明るく、
 * 教室は西の窓のカーテンが日を透かして明るく、カーテンの隙間から日が床に斜めに差す（参考画像の床の日の差し込みと同じ描き方）。
 * 床・天井・壁は壁の座標の材質（目地が壁に平行。灯りの光だまりを受ける）。
 */

const P = (o: PaintOptions): THREE.ShaderMaterial => paint(o);


const LAMP_ON = '#d9f4e8';
const LAMP_OFF = '#4f7c7c';

export function buildInside(b: Builder, doors: Doors): void {
  const fr = new LocalFrame(WEST);
  const r = rng(91);
  const box = (m: THREE.Material, min: V3, max: V3, collide = false): void => {
    fr.box(b, m, min, max, { collide });
  };
  const fm = (o: Parameters<typeof facadeMat>[1]): THREE.ShaderMaterial => facadeMat(fr, { fog: 0.4, lamp: 1, ...o });
  // 床（廊下: ビニルの床のタイル 30 cm 角。教室: 木の床の板）・天井（板の目地）・壁（腰壁・すり傷のしみ）
  const corrFloor = fm({ colors: { front: '#152c30', side: '#152c30', top: '#1a3438', bottom: '#10252a' }, grid: { size: [0.3, 0.3], width: 0.01, color: '#132a2e', faces: [2], jitter: 0.12 } });
  const roomFloor = fm({ colors: { front: '#152c30', side: '#152c30', top: '#1e3a3a', bottom: '#10252a' }, grid: { size: [0.91, 0.15], width: 0.008, color: '#16302f', faces: [2], jitter: 0.18, offset: [0.2, 0] } });
  const ceil = fm({ colors: { front: '#22434a', side: '#22434a', top: '#1b363b', bottom: '#2a4d52' }, grid: { size: [0.91, 0.455], width: 0.012, color: '#20403f', faces: [3], jitter: 0.05 } });
  const wallC = { front: '#24464b', side: '#24464b', back: '#24464b', top: '#2c5257', bottom: '#1b363a' };
  const wainC = { front: '#1c3a3f', side: '#1c3a3f', back: '#1c3a3f', top: '#284b50', bottom: '#1b363a' };
  const wall = fm({ colors: wallC, band: { y: 0.95, colors: wainC, amp: 0.0 }, stain: { mul: 0.93, cover: 0.16, scale: 2.2, faces: [0, 1, 4], yFade: [0.3, 1.4] } });
  const base = P({ color: { side: '#0f2328', py: '#173135' }, fog: 0.4 });
  const dark = P({ color: { side: '#122a2f', py: '#1a3a3f' }, fog: 0.4 });
  const metal = P({ color: { side: '#3a6266', py: '#46706f', ny: '#2a4a4d' }, fog: 0.4 });
  backDoor(fr, doors);
  // 小物（実物の色で頼み、灯りの室内の段へ写す）
  // 置き場は廊下と教室で分ける（画面に入らない方の小物は描かない）
  const corrArea = new PropArea(b);
  const roomArea = new PropArea(b);
  let sink = corrArea.sink;
  const pm = propMats('room', 0.4);
  type Face = 'out' | 'in' | 'along' | 'back';
  const put = (u: number, y: number, w: number, face: Face, seed: number) => propOnFrame(sink, pm, fr, u, y, w, face, seed);
  // 小物の当たり判定は壁の座標で切る（斜めの西棟で、回した外形の外接箱が通り道へはみ出さないように）。hx・hz は物の局所の半幅・半奥行き
  const foot = (u: number, w: number, face: Face, hx: number, hz: number, h: number): void => {
    const across = face === 'out' || face === 'in';
    const du = across ? hx : hz;
    const dw = across ? hz : hx;
    fr.collide(b.ctx.colliders, [u - du, 0, w - dw], [u + du, h, w + dw]);
  };
  const [cu0, cu1] = W_CORR.u;
  const wIn = W_CORR.wIn;
  const wOut = W_CORR.wOut;
  const H = W_CORR.ceil;
  const addLamp = b.ctx.addLamp.bind(b.ctx);

  // ---------------------------------------------------------------- 廊下
  box(corrFloor, [cu0, -0.25, wOut - 0.15], [cu1, 0.0, wIn + 0.02], true);
  // 裏口の敷居（壁の厚さの所）
  box(P({ color: { py: '#2a4b50', side: '#1d3a3f' } }), [BACKDOOR.u[0], -0.1, -0.32], [BACKDOOR.u[1], 0.01, 0.08], true);
  box(ceil, [cu0, H, wOut - 0.15], [cu1, H + 0.1, wIn]);
  // 端の壁（南: 階段室への扉・北: 防火戸の枠）
  box(wall, [cu0 - 0.15, 0, wOut - 0.15], [cu0, H, wIn], true);
  box(wall, [cu1, 0, wOut - 0.15], [cu1 + 0.15, H, wIn], true);
  steelDoor(fr, doors, cu0 + 0.03, -1.15, true);
  steelDoor(fr, doors, cu1 - 0.03, -1.15, true);
  // 防火戸の枠（北の端。開いたまま壁に収まった防火戸）
  box(P({ color: { side: '#2c5054' }, fog: 0.4 }), [cu1 - 0.6, 0, wOut + 0.02], [cu1 - 0.05, 2.4, wOut + 0.08]);
  // 廊下の天井の照明（1 つおきに点いている）・火災感知器・スピーカー
  const lampOn = P({ color: { ny: LAMP_ON, side: '#9fc8b8' }, fog: 0.2, lamp: 0 });
  const lampOff = P({ color: { ny: LAMP_OFF, side: '#355a5c' }, fog: 0.4 });
  const corrRoom = { u: [cu0, cu1] as [number, number], w: [wOut, wIn] as [number, number], y: [-0.1, H + 0.05] as [number, number] };
  let k = 0;
  for (let u = cu0 + 1.4; u < cu1 - 0.5; u += 2.4, k++) {
    const on = k % 2 === 0;
    box(on ? lampOn : lampOff, [u - 0.62, H - 0.08, -1.72], [u + 0.62, H, -1.58]);
    box(dark, [u - 0.66, H - 0.03, -1.76], [u + 0.66, H, -1.54]);
    if (on) frameLamp(addLamp, fr, u, 2.3, -1.65, corrRoom, { radius: 3.4, intensity: 2.2, color: '#e6fff4', down: true, shadow: 0 });
    if (k % 3 === 1) b.cyl(P({ color: { side: '#c8ddd4', ny: '#dbe9e2' }, fog: 0.4 }), fr.w(u + 1.2, H - 0.03, -1.65), 0.07, 0.05, { segments: 12, shadow: false });
  }
  box(P({ color: '#5fd3a4', lamp: 0 }), [BACKDOOR.u[0] + 0.25, 2.5, -0.33], [BACKDOOR.u[1] - 0.25, 2.66, -0.31]);
  // 幅木（廊下の両側・端の壁）
  box(base, [cu0, 0, wOut], [cu1, 0.09, wOut + 0.012]);
  for (const [a, c] of [[cu0, BACKDOOR.u[0]], [BACKDOOR.u[1], cu1]] as [number, number][]) box(base, [a, 0, wIn - 0.012], [c, 0.09, wIn]);
  // 窓ぎわの床の明るさ（外の明るさが床に映る。柱の間ごと、縁はちぎる）
  const glow = patchMat('#264c4e', { rag: 0.1, scale: 2.5 });
  const pu0 = WBAY.u0 - Math.ceil((WBAY.u0 - WEST.u0) / WBAY.w) * WBAY.w;
  for (let u = pu0; u < cu1; u += WBAY.w) {
    const a = Math.max(cu0 + 0.1, u + 0.25);
    const c = Math.min(cu1 - 0.1, u + WBAY.w - 0.25);
    if (c - a < 0.8) continue;
    floorPatch(b, fr, glow, a, c, -0.32, -1.15, 0.003);
  }
  // 教室と廊下の間の壁（引き戸 2 つ・腰の窓・欄間）
  const [ru0, ru1] = W_ROOM.u;
  const wP0 = wOut - 0.15; // 間仕切りの教室側の面
  const doorsU: [number, number][] = [
    [ru0 + 0.4, ru0 + 1.3], // 後ろの扉
    [ru1 - 1.4, ru1 - 0.5], // 前の扉
  ];
  // 間仕切り（廊下の全長。教室以外の所は窓の無い壁と鍵の掛かった扉）
  const part = (u0: number, u1: number): void => {
    if (u1 - u0 < 0.01) return;
    box(wall, [u0, 0, wP0], [u1, H, wOut], true);
  };
  part(cu0, ru0);
  part(ru1, cu1);
  // 教室の間仕切り: 扉と窓の穴を残して箱を並べる
  const mid0 = doorsU[0][1];
  const mid1 = doorsU[1][0];
  box(wall, [ru0, 0, wP0], [doorsU[0][0], H, wOut], true);
  box(wall, [doorsU[1][1], 0, wP0], [ru1, H, wOut], true);
  for (const [a, c] of doorsU) box(wall, [a, 2.05, wP0], [c, H, wOut]);
  // 扉の間: 腰壁・腰の窓（1.0〜1.85）・壁・欄間（2.2〜2.75）
  box(wall, [mid0, 0, wP0], [mid1, 1.0, wOut], true);
  box(wall, [mid0, 1.85, wP0], [mid1, 2.2, wOut]);
  box(wall, [mid0, 2.75, wP0], [mid1, H, wOut]);
  fr.collide(b.ctx.colliders, [mid0, 0, wP0], [mid1, 2.2, wOut]);
  const winFrame = P({ color: { side: '#3a6266', py: '#46706f' }, fog: 0.4 });
  // すりガラス（下の段。教室の明るさを透かす）・透明（欄間）
  const glassIn = P({ color: { side: '#41716f' }, fog: 0.4, side: THREE.DoubleSide, lamp: 0.3 });
  for (const [y0, y1] of [
    [1.0, 1.85],
    [2.2, 2.75],
  ] as [number, number][]) {
    for (let u = mid0; u < mid1 - 0.05; u += 0.9) {
      const e = Math.min(mid1, u + 0.9);
      box(winFrame, [u, y0, wP0 - 0.01], [u + 0.04, y1, wOut + 0.01]);
      if (y0 < 1.5) fr.box(b, glassIn, [u + 0.04, y0, (wP0 + wOut) / 2 - 0.005], [e, y1, (wP0 + wOut) / 2 + 0.005]);
    }
    box(winFrame, [mid0, y0 - 0.03, wP0 - 0.01], [mid1, y0, wOut + 0.01]);
    box(winFrame, [mid0, y1, wP0 - 0.01], [mid1, y1 + 0.03, wOut + 0.01]);
  }
  // 教室の引き戸（近づくと開く）
  for (const [a, c] of doorsU) slidingDoor(fr, doors, a, c, wP0, wOut);
  // 隣の部屋の扉（鍵）は壁の廊下側の面に付ける
  const sideDoors: [number, number][] = [
    [7.4, 8.3],
    [19.0, 19.9],
    [24.4, 25.3],
  ];
  for (const [a, c] of sideDoors) slidingDoor(fr, doors, a, c, wOut + 0.01, wOut + 0.05, true);
  // 室名札（扉の上に廊下へ突き出した札。白い板に字）
  const plateFrame = P({ color: { side: '#c9dcd3', py: '#d8e8e0' }, fog: 0.4 });
  for (const [a, c] of [...doorsU, ...sideDoors]) {
    const u = (a + c) / 2;
    box(plateFrame, [u - 0.012, 2.3, wOut], [u + 0.012, 2.52, wOut + 0.42]);
    notice(b, fr, 'u', u + 0.013, wOut + 0.03, wOut + 0.4, 2.32, 2.5, 1, 24 + Math.floor(r() * 4));
    notice(b, fr, 'u', u - 0.013, wOut + 0.03, wOut + 0.4, 2.32, 2.5, -1, 24 + Math.floor(r() * 4));
  }
  // 廊下の掲示板と掲示物（紙は升目の絵から選ぶ。ところどころ傾けずに重ねる）
  const cork = P({ color: { side: '#3c5e55', py: '#466a60' }, fog: 0.4 });
  const corkFrame = P({ color: { side: '#2c4c4a', py: '#36585a' }, fog: 0.4 });
  for (const u0 of [5.65, 20.25, 22.45]) {
    box(corkFrame, [u0 - 0.04, 1.11, wOut], [u0 + 1.64, 2.09, wOut + 0.025]);
    box(cork, [u0, 1.15, wOut], [u0 + 1.6, 2.05, wOut + 0.03]);
    let pu = u0 + 0.08;
    while (pu < u0 + 1.4) {
      const land = r() < 0.3;
      const w = land ? 0.3 : 0.21;
      const h = land ? 0.21 : 0.3;
      if (pu + w > u0 + 1.55) break;
      const py = 1.22 + r() * (0.75 - h);
      notice(b, fr, 'w', wOut + 0.035 + r() * 0.002, pu, pu + w, py, py + h, 1, land ? 16 + Math.floor(r() * 8) : Math.floor(r() * 16));
      pu += w + 0.04 + r() * 0.08;
    }
  }
  // 壁に直に貼った掲示物（扉と扉の間の空いた壁）
  for (const [a, c] of [[17.4, 18.9]] as [number, number][]) {
    let pu = a + 0.08;
    while (pu + 0.25 < c) {
      const py = 1.3 + r() * 0.4;
      notice(b, fr, 'w', wOut + 0.004, pu, pu + 0.21, py, py + 0.3, 1, Math.floor(r() * 16));
      pu += 0.32 + r() * 0.2;
    }
  }
  // 南の端の壁（階段室の扉の両脇）
  for (const [a, c] of [
    [wOut + 0.1, wOut + 0.75],
    [wIn - 0.65, wIn - 0.1],
  ] as [number, number][]) {
    for (let w = a; w + 0.2 < c; w += 0.27) {
      const py = 1.35 + r() * 0.35;
      notice(b, fr, 'u', cu0 + 0.004, w, w + 0.21, py, py + 0.3, 1, Math.floor(r() * 16));
    }
  }
  // 消火栓の箱（灰緑の箱に赤い表示と灯り）・非常ベル・消火器（台の上）
  const hy = 8.55;
  box(P({ color: { side: '#3d6464', py: '#4a7270' }, fog: 0.4 }), [hy, 0.95, wOut], [hy + 0.75, 1.85, wOut + 0.16]);
  box(P({ color: { side: '#2c4c4c' }, fog: 0.4 }), [hy + 0.04, 0.99, wOut + 0.16], [hy + 0.71, 1.62, wOut + 0.165]);
  notice(b, fr, 'w', wOut + 0.166, hy + 0.08, hy + 0.67, 1.66, 1.8, 1, 28);
  fr.box(b, P({ color: '#ff7a68', fog: 0.2, lamp: 0 }), [hy + 0.3, 1.92, wOut + 0.02], [hy + 0.45, 2.04, wOut + 0.1]);
  b.cyl(P({ color: { side: '#9a4a44', py: '#b0564e' }, fog: 0.4 }), fr.w(hy + 0.37, 2.2, wOut + 0.04), 0.07, 0.05, { axis: 'z', segments: 14, rotY: Math.atan2(fr.N.x, fr.N.z), shadow: false });
  extinguisher(put(hy + 0.95, 0, wOut + 0.2, 'out', 21).p, { red: '#c8463e' });
  notice(b, fr, 'w', wOut + 0.004, hy + 0.83, hy + 1.07, 0.75, 0.95, 1, 28);
  // ごみ箱（分別 3 口の箱）・掃除用具（壁に立て掛けたほうき・モップと床のバケツ）・傘立て（裏口の脇）
  trashBin(put(15.8, 0, wOut + 0.24, 'out', 22).p, { kind: 'recycle', body: '#c4c9bf', lid: '#4f8a6a' });
  cleaningTools(put(14.78, 0, wOut, 'out', 23).p, { collide: false });
  foot(14.86, wOut + 0.17, 'out', 0.36, 0.17, 0.3);
  umbrellaStand(put(BACKDOOR.u[1] + 0.55, 0, -0.56, 'in', 24).p, { w: 0.5, d: 0.32, h: 0.5, nx: 3, nz: 2, fill: 0.5, collide: false });
  foot(BACKDOOR.u[1] + 0.55, -0.56, 'in', 0.26, 0.17, 0.5);
  contactF(b, fr, BACKDOOR.u[1] + 0.3, -0.72, BACKDOOR.u[1] + 0.8, -0.4, 0.06);
  // 下駄箱（裏口の南の脇。来客用のスリッパの棚。背を外壁に付ける）
  slipperRack(put(BACKDOOR.u[0] - 0.9, 0, -0.55, 'in', 25).p, { w: 1.4, h: 1.1, d: 0.4, collide: false });
  foot(BACKDOOR.u[0] - 0.9, -0.55, 'in', 0.7, 0.2, 1.1);
  // ロッカー（掲示板の下。2 段 × 10 のスチールロッカー。当たり判定は壁の座標で切る）
  steelLocker(put(22.175, 0, wOut + 0.18, 'out', 26).p, { cols: 10, cw: 0.385, h: 1.0, d: 0.36, collide: false });
  fr.collide(b.ctx.colliders, [20.25, 0, wOut], [24.1, 1.0, wOut + 0.37]);
  contactF(b, fr, 20.25, wOut, 24.1, wOut + 0.36, 0.08);
  contactF(b, fr, 15.26, wOut + 0.02, 16.34, wOut + 0.46, 0.07);
  contactF(b, fr, BACKDOOR.u[0] - 1.6, -0.75, BACKDOOR.u[0] - 0.2, -0.35, 0.07);
  // 床の上の簀の子（裏口の内）
  duckboard(put((BACKDOOR.u[0] + BACKDOOR.u[1]) / 2, 0, -1.0, 'in', 27).p, { w: BACKDOOR.u[1] - BACKDOOR.u[0] + 0.2, d: 1.2 });

  // ---------------------------------------------------------------- 教室
  corrArea.done();
  sink = roomArea.sink;
  const w1 = W_ROOM.w[1]; // 窓側（-11.2）。廊下側は間仕切りの面 wP0
  box(roomFloor, [ru0, -0.25, w1], [ru1, 0.0, wP0], true);
  box(ceil, [ru0, H, w1], [ru1, H + 0.1, wP0]);
  // 前（北）と後ろ（南）の壁
  box(wall, [ru0 - 0.15, 0, w1], [ru0, H, wP0], true);
  box(wall, [ru1, 0, w1], [ru1 + 0.15, H, wP0], true);
  // 幅木
  box(base, [ru0, 0, w1], [ru0 + 0.012, 0.09, wP0]);
  box(base, [ru1 - 0.012, 0, w1], [ru1, 0.09, wP0]);
  box(base, [ru0, 0, wP0 - 0.012], [ru1, 0.09, wP0]);
  // 窓の側（西）の壁の内の面は外壁（wings.ts の裏の面）
  // 黒板（前）・教卓
  const board = P({ color: { side: '#1f4a3c', py: '#2a5a4a' }, fog: 0.4 });
  const frameW = P({ color: { side: '#5b7c70', py: '#6a8a7c' }, fog: 0.4 });
  fr.box(b, frameW, [ru1 - 0.05, 0.82, -5.0], [ru1, 2.12, -9.6]);
  fr.box(b, board, [ru1 - 0.07, 0.86, -5.05], [ru1 - 0.05, 2.08, -9.55]);
  fr.box(b, frameW, [ru1 - 0.14, 0.82, -5.0], [ru1 - 0.05, 0.86, -9.6]);
  // チョークの字（白い線）・黒板消し・日直の欄
  // チョークの字: 細く、黒板の上で浮かない明るさ（灯りはあまり受けない）
  const chalk = P({ color: { side: '#6f9a8c' }, fog: 0.4, lamp: 0.25 });
  for (let i = 0; i < 9; i++) {
    const w = -5.4 - r() * 3.6;
    const y = 1.15 + r() * 0.8;
    fr.box(b, chalk, [ru1 - 0.075, y, w - 0.3 - r() * 0.7], [ru1 - 0.07, y + 0.009, w]);
  }
  for (let i = 0; i < 4; i++) fr.box(b, chalk, [ru1 - 0.075, 1.2 + i * 0.16, -9.35], [ru1 - 0.07, 1.209 + i * 0.16, -9.05]);
  fr.box(b, P({ color: { py: '#c9d8d0', side: '#3a5a58' }, fog: 0.4 }), [ru1 - 0.14, 0.86, -6.2], [ru1 - 0.08, 0.91, -6.33]);
  // 学級目標の紙（黒板の上）・時間割（黒板の横）
  notice(b, fr, 'u', ru1 - 0.004, -8.6, -6.0, 2.2, 2.42, -1, 16 + Math.floor(r() * 8));
  notice(b, fr, 'u', ru1 - 0.004, -4.75, -4.2, 1.3, 1.95, -1, 2);
  notice(b, fr, 'u', ru1 - 0.004, -10.35, -9.85, 1.4, 1.75, -1, 6);
  // 教卓（生徒の側を向く）
  lectern(put(ru1 - 1.3, 0, -7.3, 'back', 31).p, { collide: false });
  foot(ru1 - 1.3, -7.3, 'back', 0.53, 0.33, 0.98);
  // 時計・スピーカー（黒板の上）・テレビ（前の窓の側の角、天井から）
  wallClock(put(ru1, 2.6, -7.3, 'back', 32).p);
  wallSpeaker(put(ru1, 2.7, -4.2, 'back', 33).p);
  ceilingTv(put(ru1 - 0.4, 2.48, -10.65, 'back', 34).p, { drop: H - 2.48 - 0.225 });
  // 机と椅子（6 列 × 6 行。列は w の向き、行は u の向き。黒板を向く）
  const bagCols = ['#253246', '#2e2f33', '#3a4f6b', '#4a3a36'];
  const caseCols = ['#3f6f9a', '#c9a24a', '#7a4a6a', '#4f7a5a', '#d9d6cc'];
  for (let row = 0; row < 6; row++) {
    for (let c = 0; c < 6; c++) {
      // 前の列は黒板から 2.2 m、後ろはロッカーの前に 1 m 余りの通り。列の間は 0.6 m 空ける
      const u = ru1 - 2.2 - row * 0.85 + (r() - 0.5) * 0.04;
      const w = -4.15 - c * 1.2 + (r() - 0.5) * 0.04;
      // 机（座る側 = 後ろ = -u）
      const desk = put(u, 0, w, 'back', 100 + row * 6 + c).p;
      schoolDesk(desk, { collide: false });
      foot(u, w, 'back', 0.3, 0.22, 0.71);
      contactF(b, fr, u - 0.65, w - 0.3, u + 0.22, w + 0.3, 0.04);
      // 椅子（後ろ）。少し引いたもの・机に入れたもの
      // 後ろの列の椅子は机に入れる（ロッカーの前の通りを空ける）
      const cu = u - (row === 5 ? 0.24 : 0.36 + r() * 0.08);
      const cw = w + (r() - 0.5) * 0.04;
      schoolChair(put(cu, 0, cw, 'along', 200 + row * 6 + c).p, { collide: false });
      foot(cu, cw, 'along', 0.2, 0.2, 0.8);
      // 机の横のフックのかばん（ところどころ）・机の上の教科書や筆箱
      if (r() < 0.35) schoolBag(desk.sub([0.36, 0.33, 0.03], Math.PI / 2), bagCols[Math.floor(r() * bagCols.length)]);
      if (r() < 0.3) bookStack(desk.sub([(r() - 0.5) * 0.25, 0.71, (r() - 0.5) * 0.15], (r() - 0.5) * 0.4), 1 + Math.floor(r() * 3));
      else if (r() < 0.2) pencilCase(desk.sub([(r() - 0.5) * 0.3, 0.71, 0.1], (r() - 0.5) * 0.6), caseCols[Math.floor(r() * caseCols.length)]);
    }
  }
  // 後ろ（南）: ロッカー（1 人 1 区画・2 段 × 9）・掲示板・後ろの黒板。当たり判定は壁の座標で切る
  cubbyLocker(put(ru0 + 0.225, 0, -7.3, 'along', 41).p, { cols: 9, rows: 2, cw: 0.68, h: 1.05, d: 0.45, collide: false });
  fr.collide(b.ctx.colliders, [ru0, 0, -4.2], [ru0 + 0.45, 1.05, -10.4]);
  contactF(b, fr, ru0, -4.2, ru0 + 0.45, -10.4, 0.08);
  contactF(b, fr, ru1 - 1.63, -6.77, ru1 - 0.97, -7.83, 0.08);
  fr.box(b, board, [ru0, 1.25, -5.2], [ru0 + 0.02, 2.25, -7.8]);
  for (let i = 0; i < 4; i++) fr.box(b, chalk, [ru0 + 0.02, 1.5 + i * 0.15, -6.9], [ru0 + 0.025, 1.509 + i * 0.15, -5.6 - r() * 0.6]);
  const corkB = P({ color: { side: '#3c5e55', py: '#466a60' }, fog: 0.4 });
  fr.box(b, corkB, [ru0, 1.25, -8.0], [ru0 + 0.02, 2.25, -10.5]);
  for (let i = 0; i < 8; i++) {
    const w = -8.1 - (i % 4) * 0.58;
    const y = 1.32 + Math.floor(i / 4) * 0.45;
    notice(b, fr, 'u', ru0 + 0.023, w - 0.21, w, y, y + 0.3, 1, Math.floor(r() * 16));
  }
  // 廊下側の壁（教室の側）の腰の高さのフック掛けと体操着の袋（ところどころ）
  for (let u = ru0 + 1.6; u < ru1 - 1.6; u += 0.32) {
    fr.box(b, metal, [u - 0.01, 1.02, wP0 - 0.05], [u + 0.01, 1.05, wP0]);
    if (r() < 0.45) gymBag(put(u, 1.03, wP0 - 0.035, 'in', 400 + Math.round(u * 10)).p, ['#2f4f7a', '#6a3a40', '#3f5a48', '#7a6a4a'][Math.floor(r() * 4)]);
  }
  fr.box(b, P({ color: { side: '#27535c', py: '#386b6f' }, fog: 0.4 }), [ru0 + 1.4, 1.0, wP0 - 0.02], [ru1 - 1.4, 1.03, wP0]);
  // 後ろの壁の上の作品の列（横長の紙。黒板・掲示板の上）
  for (let w = -4.4; w > -10.4; w -= 0.52) notice(b, fr, 'u', ru0 + 0.006, w - 0.42, w, 2.38, 2.68, 1, 16 + Math.floor(r() * 8));
  // 掃除用具入れ（後ろの廊下側の角。教室の前を向く）
  cleaningCabinet(put(ru0 + 0.25, 0, wP0 - 0.4, 'along', 42).p, { w: 0.7, d: 0.5, h: 1.8, collide: false });
  foot(ru0 + 0.25, wP0 - 0.4, 'along', 0.35, 0.25, 1.8);
  // 蛍光灯（3 列 × 3。前の列だけ点いている）
  const roomBox = { u: [ru0, ru1] as [number, number], w: [w1, wP0] as [number, number], y: [-0.1, H + 0.05] as [number, number] };
  for (const w of [-4.6, -7.2, -9.8]) {
    for (const u of [ru0 + 1.6, ru0 + 4.1, ru0 + 6.6]) {
      const on = u > ru0 + 6;
      fr.box(b, on ? lampOn : lampOff, [u - 0.62, H - 0.08, w - 0.08], [u + 0.62, H, w + 0.08]);
      fr.box(b, dark, [u - 0.66, H - 0.03, w - 0.11], [u + 0.66, H, w + 0.11]);
      if (on) frameLamp(addLamp, fr, u, 2.3, w, roomBox, { radius: 3.2, intensity: 1.1, color: '#e6fff4', down: true, shadow: 0 });
    }
  }
  // カーテン（日の当たる西の窓の前。日を透かして明るい。襞の向きで明るさが変わる）
  const cur = P({ color: { x: '#5f9790', z: '#386b6f', py: '#5f9790', ny: '#27535c' }, fog: 0.3, side: THREE.DoubleSide, lamp: 0 });
  const wc = w1 + 0.1;
  const rail = P({ color: { side: '#52726c' }, fog: 0.4 });
  fr.box(b, rail, [ru0, 3.05, wc - 0.02], [ru1, 3.08, wc + 0.02]);
  const gaps = [10.8, 13.7, 16.2];
  let u = ru0 + 0.1;
  for (const gp of [...gaps, ru1 - 0.1]) {
    const e = gp - 0.25;
    if (e > u + 0.2) curtain(b, fr, cur, u, e, wc, 0.9, 3.05);
    u = gp + 0.25;
  }
  // カーテンの隙間から差す日（床の上の斜めの光の四角。窓の高さ 0.85〜3.0 m の隙間を日の向きに床へ写した形）
  const sunPatch = patchMat('#4f8a84', { rag: 0.06, scale: 4 });
  const tv = toFrame(fr, SUN_DIR.clone().negate());
  for (const gp of gaps) {
    const pts: [number, number][] = [];
    for (const [du, y] of [
      [-0.22, 0.95],
      [0.22, 0.95],
      [0.22, 2.9],
      [-0.22, 2.9],
    ] as [number, number][]) {
      const t = y / -tv[1];
      pts.push([gp + du + tv[0] * t, w1 + tv[2] * t]);
    }
    quadPatch(b, fr, sunPatch, pts, 0.004);
  }
  roomArea.done();
}

/** 世界の向きを壁の座標の向き [u, y, w] へ */
function toFrame(fr: LocalFrame, v: THREE.Vector3): [number, number, number] {
  return [v.x * fr.T.x + v.z * fr.T.z, v.y, v.x * fr.N.x + v.z * fr.N.z];
}

/** 床の上の四角形の貼り絵（壁の座標の 4 点 [u, w]） */
function quadPatch(b: Builder, fr: LocalFrame, mat: THREE.Material, pts: [number, number][], y: number): void {
  const g = new THREE.BufferGeometry();
  const p = pts.map(([u, w]) => [u, y, w]).flat();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  // 上から見て表になる向き
  const [a, c, d] = [pts[0], pts[1], pts[2]];
  const cross = (c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0]);
  g.setIndex(cross < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  b.mesh(fr.place(g), mat, [0, 0, 0], { shadow: false });
}

/** 襞のあるカーテン（u0〜u1 の幅、w の面）。襞はなめらかな波で、面の向きで明るい襞と暗い襞の帯になる */
function curtain(b: Builder, fr: LocalFrame, mat: THREE.Material, u0: number, u1: number, w: number, y0: number, y1: number): void {
  const lam = 0.16;
  const n = Math.max(6, Math.round(((u1 - u0) / lam) * 6));
  const pos: number[] = [];
  const idx: number[] = [];
  // 襞の波長と深さを少しずつ変える（同じ縞の繰り返しにしない）。端（束ねた所）ほど深い
  let ph = 0;
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    const t = (u - u0) / (u1 - u0);
    ph += (((u1 - u0) / n) / lam) * Math.PI * 2 * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(u * 3.1 + 1.7)));
    const amp = 0.03 + 0.025 * Math.max(0, 1 - Math.min(t, 1 - t) * 4) + 0.01 * Math.sin(u * 5.3);
    const dw = Math.sin(ph) * amp;
    // 裾は少し揺らす（まっすぐな線にしない）
    const hem = y0 + Math.sin(u * 7.3) * 0.015;
    pos.push(u, hem, w + dw, u, y1, w + dw);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  b.mesh(fr.place(g), mat, [0, 0, 0], { shadow: false });
}

/** 壁の座標系の扉の向き（局所の x が壁に沿う） */
function yawOf(fr: LocalFrame): number {
  return Math.atan2(-fr.T.z, fr.T.x);
}

/** 教室の引き戸（窓の付いた木の戸。廊下側の面に沿って滑る） */
function slidingDoor(fr: LocalFrame, doors: Doors, u0: number, u1: number, wA: number, wB: number, locked = false): void {
  const w = u1 - u0;
  const wood = P({ color: { side: '#3c5f58', py: '#466a62' }, fog: 0.4 });
  const glass = P({ color: { side: '#5a8a86' }, fog: 0.4 });
  const leaf = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material): void => {
    leaf.add(new THREE.Mesh(geo, m));
  };
  const t = Math.abs(wB - wA);
  add(new THREE.BoxGeometry(w, 0.9, t * 0.5).translate(w / 2, 0.45, 0), wood);
  add(new THREE.BoxGeometry(w, 0.25, t * 0.5).translate(w / 2, 1.85, 0), wood);
  add(new THREE.BoxGeometry(0.1, 1.95, t * 0.5).translate(0.05, 0.975, 0), wood);
  add(new THREE.BoxGeometry(0.1, 1.95, t * 0.5).translate(w - 0.05, 0.975, 0), wood);
  add(new THREE.BoxGeometry(w - 0.2, 0.83, 0.01).translate(w / 2, 1.315, 0), glass);
  add(new THREE.BoxGeometry(0.03, 0.12, t * 0.6).translate(w - 0.12, 1.0, 0), P({ color: '#6a8a84', fog: 0.4 }));
  // 戸の下の方の板の継ぎ目と蹴込みの金物
  add(new THREE.BoxGeometry(w - 0.2, 0.015, t * 0.52).translate(w / 2, 0.55, 0), P({ color: { side: '#2c4c48' }, fog: 0.4 }));
  add(new THREE.BoxGeometry(w, 0.08, t * 0.52).translate(w / 2, 0.04, 0), P({ color: { side: '#4f706a' }, fog: 0.4 }));
  const p = fr.w(u0, 0, (wA + wB) / 2);
  doors.add({ leaf, pivot: p, yaw: yawOf(fr), slide: -(w - 0.12), locked, radius: 1.7 });
}

/** 鉄の扉（廊下の端。dir は開く向きの目印だけ） */
function steelDoor(fr: LocalFrame, doors: Doors, u: number, w: number, locked: boolean): void {
  const m = P({ color: { side: '#2c5054', py: '#355b5e' }, fog: 0.4 });
  const leaf = new THREE.Group();
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.95).translate(0, 1.0, -0.475), m));
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.05).translate(0, 1.0, -0.85), P({ color: '#6a8a84', fog: 0.4 })));
  // 網入りガラスの窓（向こうの階段室の窓の昼の明るさ。廊下の突き当たりの明るい開口）
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.5).translate(0, 1.45, -0.475), P({ color: { side: '#2a4c50' }, fog: 0.4 })));
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.82, 0.42).translate(0, 1.45, -0.475), P({ color: { side: '#a9d4c0' }, fog: 0.3, lamp: 0 })));
  for (let i = 1; i < 4; i++) leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.006, 0.42).translate(0, 1.04 + i * 0.205, -0.475), P({ color: { side: '#5f8f88' }, fog: 0.3, lamp: 0 })));
  const p = fr.w(u, 0, w);
  doors.add({ leaf, pivot: p, yaw: yawOf(fr), locked });
}

/** 裏口の扉（鉄の扉に小窓。内へ開く） */
export function backDoor(fr: LocalFrame, doors: Doors): void {
  const m = P({ color: { side: '#173339', py: '#1f3d43', nx: '#1a3a40', px: '#1a3a40' }, fog: 0.6 });
  const w = BACKDOOR.u[1] - BACKDOOR.u[0];
  const leaf = new THREE.Group();
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(w, 2.3, 0.05).translate(w / 2, 1.15, 0), m));
  // 網入りガラスの小窓（枠と格子）・蹴板・レバーの取っ手・札
  const fm = P({ color: { side: '#2a5258', py: '#33606a' }, fog: 0.6 });
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.56, 0.062).translate(w / 2, 1.55, 0), fm));
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.066).translate(w / 2, 1.55, 0), P({ color: { side: '#3d6c70' }, fog: 0.6 })));
  for (let i = 1; i < 4; i++) leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.006, 0.068).translate(w / 2, 1.3 + i * 0.125, 0), fm));
  for (let i = 1; i < 3; i++) leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.5, 0.068).translate(w / 2 - 0.14 + i * 0.093, 1.55, 0), fm));
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.22, 0.056).translate(w / 2, 0.14, 0), P({ color: { side: '#21454c', py: '#2a5056' }, fog: 0.6 })));
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.09).translate(w - 0.12, 1.0, 0), P({ color: '#3f6a6c', fog: 0.6 })));
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.03).translate(w - 0.18, 1.0, 0.055), P({ color: '#4f7c7c', fog: 0.6 })));
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.03).translate(w - 0.18, 1.0, -0.055), P({ color: '#4f7c7c', fog: 0.6 })));
  leaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.054).translate(w / 2, 1.16, 0), P({ color: { side: '#8fae9f' }, fog: 0.6 })));
  const p = fr.w(BACKDOOR.u[0], 0, -0.12);
  doors.add({ leaf, pivot: p, yaw: yawOf(fr), swing: 1.45, radius: 1.8 });
}
