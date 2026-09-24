import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Box, MatId } from '../generators/layout';

/**
 * 通勤電車の車体（見た目専用。当たり判定は生成器の箱のまま）。Box.train の付いた車体の箱 1 つから 1 両を組む。
 *
 * 断面（裾を絞った側面 + 肩の丸い屋根）を長さ方向に押し出した車体に、片側 4 扉（ステンレスの両開き・扉窓・戸袋の段差）、
 * 扉間の窓（ホーム側は点灯 windowLit = 窓の奥の部屋のシェーダで車内の奥行きが出る / 反対側は暗いガラス）、窓のゴム枠、
 * 帯（腰と幕板）、屋根上の冷房装置 2 基と雨樋、床下機器、台車（枠 + 車輪 4）、先頭車は前面ガラス・前照灯・行先表示を足す。
 *
 * 座標: 車体の局所系 u（長さ）/ v（幅）/ y（上）。Box.train.alongX なら x = u・z = v、でなければ x = v・z = −u（回転。鏡像にしない）。
 * platform / head は局所系の符号（生成側は trainSpecFor で部屋座標の向きから作る）
 */
export interface TrainSpec {
  alongX: boolean;
  /** ホーム側（窓が点灯している側）が +v なら 1、−v なら −1 */
  platform: 1 | -1;
  /** 先頭の端（+u 側なら 1、−u 側なら −1、中間車なら 0） */
  head: 1 | -1 | 0;
}

export interface TrainSurface { box: Box; geometry: THREE.BufferGeometry }

const BODY: MatId = 'paintWhite';
const STRIPE: MatId = 'lockerGreen';
const DOOR: MatId = 'stainless';
const GLASS_DARK: MatId = 'screenDark';
const GLASS_LIT: MatId = 'windowLit';
const RUBBER: MatId = 'rubber';
const UNDER: MatId = 'metalDark';

export function trainSurfaces(boxes: Box[]): TrainSurface[] {
  const out: TrainSurface[] = [];
  for (const b of boxes) {
    if (!b.train) continue;
    for (const [mat, geometry] of buildCar(b, b.train)) {
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox!;
      out.push({ box: { min: bb.min.toArray(), max: bb.max.toArray(), mat, solid: false }, geometry });
    }
  }
  return out;
}

function buildCar(b: Box, t: TrainSpec): Map<MatId, THREE.BufferGeometry> {
  const L = t.alongX ? b.max[0] - b.min[0] : b.max[2] - b.min[2];
  const W = t.alongX ? b.max[2] - b.min[2] : b.max[0] - b.min[0];
  const y0 = b.min[1], y1 = b.max[1];
  const cu = t.alongX ? (b.min[0] + b.max[0]) / 2 : (b.min[2] + b.max[2]) / 2;
  const cv = t.alongX ? (b.min[2] + b.max[2]) / 2 : (b.min[0] + b.max[0]) / 2;
  const hw = W / 2, hl = L / 2;
  const parts = new Map<MatId, THREE.BufferGeometry[]>();
  const add = (g: THREE.BufferGeometry, mat: MatId) => {
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    const list = parts.get(mat) ?? [];
    list.push(flat);
    parts.set(mat, list);
  };
  /** 局所系の箱（u0..u1, y0..y1, v0..v1） */
  const box = (u0: number, u1: number, ya: number, yb: number, v0: number, v1: number, mat: MatId) => {
    const g = new THREE.BoxGeometry(Math.max(1e-3, u1 - u0), Math.max(1e-3, yb - ya), Math.max(1e-3, v1 - v0));
    g.translate((u0 + u1) / 2, (ya + yb) / 2, (v0 + v1) / 2);
    add(g, mat);
  };
  /** 側面（v = ±hw の外側）に貼る板。side = +1 / −1 */
  const sidePlate = (side: number, u0: number, u1: number, ya: number, yb: number, off: number, thick: number, mat: MatId) => {
    const va = side * (hw + off), vb = side * (hw + off + thick);
    box(u0, u1, ya, yb, Math.min(va, vb), Math.max(va, vb), mat);
  };

  // ---- 車体（断面の押し出し）。側面は裾を 8 cm 絞り、肩は半径 0.42 m の丸み
  const skirt = y0 + 0.25, shoulder = y1 - 0.42, crown = y1;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + 0.08, y0);
  shape.lineTo(hw - 0.08, y0);
  shape.lineTo(hw, skirt);
  shape.lineTo(hw, shoulder);
  shape.quadraticCurveTo(hw, crown - 0.02, hw - 0.42, crown - 0.05);
  shape.quadraticCurveTo(0, crown + 0.04, -hw + 0.42, crown - 0.05);
  shape.quadraticCurveTo(-hw, crown - 0.02, -hw, shoulder);
  shape.lineTo(-hw, skirt);
  shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: 8, steps: 1 });
  // ExtrudeGeometry は (x, y) の断面を +z へ押し出す（x = v, z = u）。y 軸まわり +90° で z → +x（u）、x → −z（−v）。
  // 鏡像の行列で入れ替えると面の表裏が反転するので回転で。断面は左右対称なので v の符号は問わない
  body.translate(0, 0, -hl);
  body.rotateY(Math.PI / 2);
  body.computeVertexNormals();
  add(body, BODY);

  // ---- 扉（片側 4 か所・両開き）と窓
  const doorU = [-0.375, -0.125, 0.125, 0.375].map((k) => k * L);
  const doorW = 1.3, doorY0 = y0 + 0.05, doorY1 = y0 + 1.95;
  const winY0 = y0 + 0.95, winY1 = y0 + 1.85;
  for (const side of [1, -1]) {
    const lit = side === t.platform;
    for (const du of doorU) {
      // 戸袋の段差（扉は車体面から 1 cm 出す）と扉 2 枚・扉窓
      sidePlate(side, du - doorW / 2, du + doorW / 2, doorY0, doorY1, 0.004, 0.012, DOOR);
      sidePlate(side, du - 0.008, du + 0.008, doorY0, doorY1, 0.016, 0.004, RUBBER); // 合わせ目
      for (const leaf of [-1, 1]) {
        const lu = du + leaf * doorW / 4;
        sidePlate(side, lu - 0.2, lu + 0.2, doorY0 + 1.0, doorY0 + 1.75, 0.016, 0.004, lit ? GLASS_LIT : GLASS_DARK);
      }
    }
    // 扉の間と端の窓（ゴム枠つき）
    const edges = [-hl + 0.9, ...doorU.flatMap((du) => [du - doorW / 2 - 0.25, du + doorW / 2 + 0.25]), hl - 0.9].sort((a, b) => a - b);
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i], c = edges[i + 1];
      if (c - a < 0.6) continue;
      const n = c - a > 2.6 ? 2 : 1; // 長い区間は 2 枚に割る
      const step = (c - a) / n;
      for (let k = 0; k < n; k++) {
        const u0 = a + k * step + 0.05, u1 = a + (k + 1) * step - 0.05;
        sidePlate(side, u0, u1, winY0, winY1, 0.002, 0.006, lit ? GLASS_LIT : GLASS_DARK);
        for (const [p0, p1, q0, q1] of [[u0 - 0.03, u1 + 0.03, winY1, winY1 + 0.03], [u0 - 0.03, u1 + 0.03, winY0 - 0.03, winY0], [u0 - 0.03, u0, winY0, winY1], [u1, u1 + 0.03, winY0, winY1]]) {
          sidePlate(side, p0, p1, q0, q1, 0.002, 0.01, RUBBER);
        }
      }
    }
    // 帯（腰と幕板。扉の上は切らない = 実車の帯は扉を避けるが、ここでは扉に重なる所だけ抜く）
    const cuts = doorU.map((du) => [du - doorW / 2 - 0.02, du + doorW / 2 + 0.02] as const);
    const runs: [number, number][] = [];
    let at = -hl + 0.05;
    for (const [c0, c1] of cuts) { runs.push([at, c0]); at = c1; }
    runs.push([at, hl - 0.05]);
    for (const [u0, u1] of runs) {
      if (u1 - u0 < 0.05) continue;
      sidePlate(side, u0, u1, y0 + 0.62, y0 + 0.78, 0.002, 0.004, STRIPE);
      sidePlate(side, u0, u1, winY1 + 0.12, winY1 + 0.2, 0.002, 0.004, STRIPE);
    }
  }

  // ---- 屋根: 冷房装置 2 基・雨樋・パンタグラフの台
  for (const k of [-0.25, 0.25]) box(k * L - 1.3, k * L + 1.3, crown - 0.02, crown + 0.3, -0.75, 0.75, 'metal');
  for (const side of [1, -1]) box(-hl + 0.1, hl - 0.1, shoulder + 0.02, shoulder + 0.06, side * (hw - 0.02), side * (hw + 0.03), 'metal');

  // ---- 床下: 機器箱と台車（枠 + 車輪 4）。線路は無い（浮いた電車）
  box(-hl + 3.2, hl - 3.2, y0 - 0.3, y0, -hw + 0.35, hw - 0.35, UNDER);
  for (const bu of [-hl + 2.1, hl - 2.1]) {
    box(bu - 1.1, bu + 1.1, y0 - 0.35, y0 - 0.15, -hw + 0.3, hw - 0.3, UNDER);
    for (const wu of [bu - 0.75, bu + 0.75]) for (const side of [1, -1]) {
      const g = new THREE.CylinderGeometry(0.34, 0.34, 0.12, 20);
      g.rotateX(Math.PI / 2);
      g.translate(wu, y0 - 0.28, side * (hw - 0.42));
      add(g, UNDER);
    }
  }

  // ---- 先頭の前面: 前面ガラス・行先表示・前照灯・尾灯
  if (t.head !== 0) {
    const eu = t.head * hl;
    const face = (v0: number, v1: number, ya: number, yb: number, mat: MatId, off = 0.01, thick = 0.01) => {
      const ua = eu + t.head * off, ub = ua + t.head * thick;
      box(Math.min(ua, ub), Math.max(ua, ub), ya, yb, v0, v1, mat);
    };
    face(-hw + 0.25, hw - 0.25, y0 + 1.15, y0 + 2.05, GLASS_DARK);
    face(-0.55, 0.55, y0 + 2.12, y0 + 2.36, 'signEmissive', 0.012);
    for (const side of [1, -1]) face(side * (hw - 0.55) - 0.16, side * (hw - 0.55) + 0.16, y0 + 0.55, y0 + 0.72, 'lightWarm', 0.012);
    face(-hw + 0.1, hw - 0.1, y0 + 0.2, y0 + 0.35, UNDER, 0.004, 0.06); // 排障器の上端
  }

  // 局所系 → 部屋ローカル（回転のみ。alongX: x = u, z = v / それ以外: x = v, z = −u）
  const m = new THREE.Matrix4();
  if (t.alongX) m.set(1, 0, 0, cu, 0, 1, 0, 0, 0, 0, 1, cv, 0, 0, 0, 1);
  else m.set(0, 0, 1, cv, 0, 1, 0, 0, -1, 0, 0, cu, 0, 0, 0, 1);
  const result = new Map<MatId, THREE.BufferGeometry>();
  for (const [mat, list] of parts) {
    const merged = mergeGeometries(list.map((g) => { if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2)); return g; }), false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.applyMatrix4(m);
    result.set(mat, merged);
  }
  return result;
}

/**
 * 部屋座標の向きから TrainSpec を作る（生成側用）。platformRoomSign: ホーム側が短軸の + 側なら 1。
 * headRoomSign: 先頭が長軸の + 側なら 1、− 側なら −1、中間車は 0
 */
export function trainSpecFor(alongX: boolean, platformRoomSign: 1 | -1, headRoomSign: 1 | -1 | 0): TrainSpec {
  return alongX
    ? { alongX, platform: platformRoomSign, head: headRoomSign }
    : { alongX, platform: platformRoomSign, head: (headRoomSign === 0 ? 0 : -headRoomSign) as 1 | -1 | 0 };
}
