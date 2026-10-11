import * as THREE from 'three';
import type { SceneContext } from '../../scenes/types.ts';
import { hash } from './geo.ts';
import { CAM_PHI, inCamZone, l1R, onDrum, PIERS } from './hall.ts';
import { BOOTH, CATWALK_Y, DOME, DRUM_R, LOGE } from './layout.ts';

/**
 * 小さな灯り（参考画像の暗い壁と回廊に点々と見える光）。どれも光る小さな形を InstancedMesh で 1 回に描き、ブルームでにじませる。
 * - 1 階の回廊の手すりの上の灯り（暖かい白。2 本の支柱おき）
 * - 2 階の柱の回廊の柱の上の壁付け灯（縦長の光る板）
 * - 輪の梁の前の小さな灯りの帯（輪の下の細い光の点の列）
 * - 段床の通路の足もとの灯り（段ごと）
 * - 投影室の塔の窓（縦の細い 3 本の光）
 * 灯りの光だまり（ctx.addLamp）は、近くの面を少し明るくする（壁付け灯・扉・通路の灯り）
 */

export interface LightDot {
  p: [number, number, number];
  /** 大きさ（m）: 幅・高さ */
  s: [number, number];
  /** 向き（法線の yaw。ドームの中心を向くなど） */
  yaw: number;
  warm: boolean;
}

let dotTex: THREE.CanvasTexture | null = null;
/** 丸い点の形（光ファイバーの端の丸い光。中が明るく縁で消える） */
function roundDot(): THREE.CanvasTexture {
  if (dotTex) return dotTex;
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 32;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.55, '#d0d0d0');
  grd.addColorStop(0.75, '#606060');
  grd.addColorStop(1, '#000000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  dotTex = new THREE.CanvasTexture(cv);
  return dotTex;
}

function dotsMesh(ctx: SceneContext, dots: LightDot[], color: string, intensity: number, round = false): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = ctx.mat({ color: '#000000', unlit: true, emissive: color, emissiveIntensity: intensity, toon: 0, line: 0, side: THREE.DoubleSide, name: `light-${color}${round ? '-r' : ''}` });
  if (round) {
    // 丸い点: 形の絵で光を弱め、縁の外は描かない
    mat.emissiveMap = roundDot();
    mat.alphaMap = roundDot();
    mat.alphaTest = 0.3;
  }
  const im = new THREE.InstancedMesh(geo, mat, dots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  dots.forEach((d, i) => {
    q.setFromEuler(new THREE.Euler(0, d.yaw, 0));
    m.compose(new THREE.Vector3(...d.p), q, new THREE.Vector3(d.s[0], d.s[1], 1));
    im.setMatrixAt(i, m);
  });
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.frustumCulled = false;
  return im;
}

/** ドームの中心を向く yaw（板の表 +z を中心へ） */
function towardCenter(x: number, z: number): number {
  return Math.atan2(DOME.cx - x, DOME.cz - z);
}

export function buildLights(ctx: SceneContext, root: THREE.Object3D, floorAt: (x: number, z: number) => number, aisleSteps: { x: number; y: number; z: number; yaw: number }[]): void {
  const warm: LightDot[] = [];
  const cool: LightDot[] = [];
  // 1 階の回廊の手すりの上（2.4 m おき）。カメラのまわりの細い通路は手すりが壁ぎわなので、灯りは壁の側
  const n1 = Math.round((Math.PI * 2 * LOGE.l1R) / 2.4);
  for (let i = 0; i < n1; i++) {
    const ph = ((i + 0.5) / n1) * Math.PI * 2;
    if (inCamZone(ph)) continue;
    const R = l1R(ph);
    const p = onDrum(R - 0.02, ph, LOGE.l1 + 1.0);
    if (floorAt(p[0], p[2]) >= LOGE.l1 - 1e-3) continue;
    warm.push({ p, s: [0.09, 0.07], yaw: towardCenter(p[0], p[2]), warm: true });
  }
  // 2 階の柱の上の壁付け灯（縦長）と、柱の間の小さな灯り
  for (let i = 0; i < PIERS; i++) {
    const ph = ((i + 0.5) / PIERS) * Math.PI * 2;
    const deg = ((ph * 180) / Math.PI + 540) % 360 - 180;
    const onL2 = deg >= LOGE.l2Phi[0] && deg <= LOGE.l2Phi[1];
    const inBooth = deg >= BOOTH.phi[0] && deg <= BOOTH.phi[1];
    // 壁付け灯は柱 3 本おき（参考画像の右の壁の縦長の灯り）
    if (!inBooth && i % 3 === 0) {
      const p = onDrum(DRUM_R - 0.42, ph, onL2 ? 9.2 : 8.6);
      warm.push({ p, s: [0.09, 0.26], yaw: towardCenter(p[0], p[2]), warm: true });
    }
    // 壁の下の方（1 階の回廊の下の出入口の脇）
    if (hash(i, 7) > 0.45 && !inCamZone(ph)) {
      const p = onDrum(DRUM_R - 0.42, ph, 2.3);
      warm.push({ p, s: [0.07, 0.07], yaw: towardCenter(p[0], p[2]), warm: true });
    }
  }
  // 輪の梁の前の小さな灯りの帯（1.3 m おき）・上の壁の点
  const nr = Math.round((Math.PI * 2 * DOME.R) / 1.3);
  for (let i = 0; i < nr; i++) {
    const ph = ((i + 0.5) / nr) * Math.PI * 2;
    const deg = ((ph * 180) / Math.PI + 540) % 360 - 180;
    if (deg >= BOOTH.phi[0] - 1 && deg <= BOOTH.phi[1] + 1) continue;
    const p = onDrum(DOME.R - 0.03, ph, CATWALK_Y - 0.6);
    if (i % 3 === 0) warm.push({ p, s: [0.28, 0.07], yaw: towardCenter(p[0], p[2]), warm: true });
    else cool.push({ p, s: [0.05, 0.05], yaw: towardCenter(p[0], p[2]), warm: false });
  }
  // 上の壁（2 階より上・輪の梁より下）の点（星の投影が壁にも落ちたような細かい点。少なく）
  // 壁の点（星の投影が壁にも落ちた光と、小さな灯り）。参考画像の暗い壁の点の密度（壁 10 m² あたり 3〜4 個）に合わせる。
  // 高さは 1 階の回廊の下（1〜3 m）・1 階と 2 階の間・2 階の柱の上〜輪の梁の下
  for (let i = 0; i < 1000; i++) {
    const ph = hash(i, 1) * Math.PI * 2;
    const deg = ((ph * 180) / Math.PI + 540) % 360 - 180;
    if (deg >= BOOTH.phi[0] && deg <= BOOTH.phi[1]) continue;
    const band = hash(i, 3);
    const y = band > 0.45 ? 10.6 + hash(i, 2) * (CATWALK_Y - 1.6 - 10.6) : band > 0.2 ? 4.9 + hash(i, 2) * 1.4 : 0.8 + hash(i, 2) * 2.0;
    const p = onDrum(DRUM_R - 0.03, ph, y);
    const k = hash(i, 4);
    if (k > 0.55) warm.push({ p, s: [0.07, 0.07], yaw: towardCenter(p[0], p[2]), warm: true });
    else cool.push({ p, s: [0.05, 0.05], yaw: towardCenter(p[0], p[2]), warm: false });
  }
  // 1 階の回廊の床の下面の灯り（7.5° おき。平土間の壁ぎわの暗い所に光だまり）
  for (let i = 0; i < PIERS; i++) {
    const ph = (i / PIERS) * Math.PI * 2;
    const R = l1R(ph);
    const mid = (R + DRUM_R) / 2;
    const p = onDrum(mid, ph, LOGE.l1 - 0.36);
    if (floorAt(p[0], p[2]) > 0.05) continue;
    cool.push({ p, s: [0.12, 0.12], yaw: 0, warm: false });
    ctx.addLamp({ pos: [p[0], LOGE.l1 - 0.6, p[2]], radius: 3.8, intensity: 2.2, color: '#cfe6ff', box: [p[0] - 2.2, -0.1, p[2] - 2.2, p[0] + 2.2, LOGE.l1 - 0.36, p[2] + 2.2], down: true, shadow: 0.4 });
  }
  // 段床の通路の足もとの灯り
  for (const st of aisleSteps) warm.push({ p: [st.x, st.y, st.z], s: [0.12, 0.04], yaw: st.yaw, warm: true });
  // 投影室の塔の窓（縦の 3 本）
  for (const [deg, y] of [
    [114, 13.8],
    [104, 13.0],
  ] as [number, number][]) {
    const ph = (deg * Math.PI) / 180;
    for (let k = -1; k <= 1; k++) {
      const p = onDrum(DRUM_R - BOOTH.depth - 0.03, ph + (k * 0.13) / (DRUM_R - BOOTH.depth), y);
      warm.push({ p, s: [0.06, 0.24], yaw: towardCenter(p[0], p[2]), warm: true });
    }
  }
  root.add(dotsMesh(ctx, warm, '#ffd99a', 5.0));
  root.add(dotsMesh(ctx, cool, '#bfe8ff', 2.4));
}

/**
 * 回廊・玄関ホールの天井の星（光ファイバーの星空の天井。プラネタリウムのホワイエによくある）。
 * 天井の面の上に決まった乱数で点を撒く（1 m² あたり density 個）。参考画像の暗い面の点の細かさを、写っていない所にも
 */
export function buildStarCeilings(ctx: SceneContext, root: THREE.Object3D, areas: { sample: (u: number, v: number) => [number, number, number] | null; area: number }[], density = 3.5): void {
  const cool: LightDot[] = [];
  const warm: LightDot[] = [];
  let seed = 0;
  for (const ar of areas) {
    const n = Math.round(ar.area * density);
    for (let i = 0; i < n; i++) {
      seed++;
      const p = ar.sample(hash(seed, 11), hash(seed, 12));
      if (!p) continue;
      const big = hash(seed, 13) > 0.92;
      const s = big ? 0.065 : 0.04 + hash(seed, 14) * 0.024;
      (hash(seed, 15) > 0.8 ? warm : cool).push({ p: [p[0], p[1] - 0.005, p[2]], s: [s, s], yaw: 0, warm: false });
    }
  }
  // 天井の点は下を向く板（x 軸まわりに倒す）
  const flat = (dots: LightDot[], color: string, k: number): THREE.InstancedMesh => {
    const im = dotsMesh(ctx, dots, color, k, true);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    dots.forEach((d, i) => {
      m.compose(new THREE.Vector3(...d.p), q, new THREE.Vector3(d.s[0], d.s[1], 1));
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    return im;
  };
  root.add(flat(cool, '#cfeaff', 2.2));
  root.add(flat(warm, '#ffe0b0', 2.6));
  void CAM_PHI;
}

/**
 * 回廊のドラムの外の面の「星の壁」（光ファイバーの星と星座の線。プラネタリウムのホワイエの展示）。
 * 1 階・2 階の回廊の腰の帯の上〜天井の下に、1 m² あたり 2.6 個の星。近い星を 5〜7 個ずつ細い光の線でつなぐ（星座）。
 * 出入口と壁柱の所は空ける
 */
export function buildStarWall(
  ctx: SceneContext,
  root: THREE.Object3D,
  r: number,
  bands: [number, number][],
  skip: (phi: number, band: number, y: number) => boolean,
  /** 星の面の半径の足し分（吸音の布の板の上の星は板の表へ） */
  lift: (phi: number, band: number) => number = () => 0,
): void {
  const dots: LightDot[] = [];
  const lines: THREE.Matrix4[] = [];
  let seed = 9000;
  for (const [bi, [y0, y1]] of bands.entries()) {
    const area = Math.PI * 2 * r * (y1 - y0);
    const n = Math.round(area * 8);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      seed++;
      const ph = hash(seed, 21) * Math.PI * 2;
      const y = y0 + hash(seed, 22) * (y1 - y0);
      if (skip(ph, bi, y)) continue;
      const p = onDrum(r + 0.012 + lift(ph, bi), ph, y);
      const big = hash(seed, 23) > 0.93;
      // 光ファイバーの端の小さな点（近くで見ても四角い板に見えない大きさ）
      const s = big ? 0.055 : 0.03 + hash(seed, 24) * 0.022;
      // 板の表 +z を外（回廊の側）へ
      const yaw = Math.atan2(p[0] - DOME.cx, p[2] - DOME.cz);
      dots.push({ p, s: [s, s], yaw, warm: false });
      if (big) pts.push([ph, y, lift(ph, bi)]);
    }
    // 星座の線: 明るい星から近い明るい星へ（同じ帯の中）
    for (let i = 0; i + 1 < pts.length; i++) {
      const [pa, ya] = pts[i];
      let best = -1;
      let bd = 2.2;
      for (let j = i + 1; j < Math.min(pts.length, i + 40); j++) {
        const [pb, yb] = pts[j];
        const d = Math.hypot((pb - pa) * r, yb - ya);
        if (d < bd && d > 0.4) {
          bd = d;
          best = j;
        }
      }
      if (best < 0 || hash(i, 31) > 0.7) continue;
      if (Math.abs(pts[i][2] - pts[best][2]) > 1e-3) continue;
      const a = onDrum(r + 0.014 + pts[i][2], pa, ya);
      const b = onDrum(r + 0.014 + pts[best][2], pts[best][0], pts[best][1]);
      const mid = new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = dir.length();
      const outward = new THREE.Vector3(mid.x - DOME.cx, 0, mid.z - DOME.cz).normalize();
      const xAxis = dir.clone().normalize();
      const yAxis = new THREE.Vector3().crossVectors(outward, xAxis).normalize();
      const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, outward).scale(new THREE.Vector3(len, 0.012, 1)).setPosition(mid);
      lines.push(m);
    }
  }
  root.add(dotsMesh(ctx, dots, '#d4ecff', 2.4, true));
  const lm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), ctx.mat({ color: '#000000', unlit: true, emissive: '#5fb7d8', emissiveIntensity: 0.9, toon: 0, line: 0, side: THREE.DoubleSide, name: 'constellation' }), lines.length);
  lines.forEach((m, i) => lm.setMatrixAt(i, m));
  lm.instanceMatrix.needsUpdate = true;
  lm.frustumCulled = false;
  root.add(lm);
}
