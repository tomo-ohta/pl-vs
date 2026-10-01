import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MatId } from '../../generators/layout';
import { chamferBoxGeometry } from '../ChamferBox';
import { buildExhibit, isExhibitKind } from './MuseumObjects';

/**
 * 家電のコード生成（見た目専用。当たり判定は生成器の箱のまま）。InstanceSpec.shape（並べる物は InstancedMesh で 1 台分の形を共有）と、
 * 箱のグループからの変換（RoomBuilder の applianceInstances）が使う。
 *
 * 局所系: 原点 = 底面の中心、正面 = +z、幅 = x、高さ = y、奥行き = z。寸法 size = [幅, 高さ, 奥行き]（生成器の箱と同じ）。
 * 返り値は材質ごとのジオメトリ（結合済み・非インデックス）。三角形は 1 台 800 前後まで（ゲーム機は 240 台並ぶので 600 前後）。
 *
 * - vending: 自販機。本体（面取り）+ 台座、商品窓（奥の発光パネルの前に 3 段の棚と缶 8 本ずつ、値札の帯と選択ボタン）、
 *   右側のコイン投入口・紙幣口・返却レバー、取り出し口（暗い凹み + 艶のあるフラップ）、上部の看板帯
 * - washer / dryer: コインランドリーの洗濯機・乾燥機。本体（面取り）、丸窓（金属の縁 + ガラス + 奥のドラム）、蝶番、操作パネル（つまみ・小さな液晶・硬貨箱）
 * - crtPc: 机上の CRT モニター（前枠 + 奥へ絞った胴 + 台座 + わずかに膨らんだ画面）とキーボード（キーの列）・マウス
 * - arcade: ゲーム筐体。側面の輪郭（足元の蹴込み・操作盤の張り出し・傾いた画面・看板の庇）を押し出した本体、画面・看板（accent の発光）、
 *   レバー（軸 + 玉）とボタン 4 つ、コイン扉（投入口の赤い灯）
 */
export type ApplianceShape = 'vending' | 'washer' | 'dryer' | 'crtPc' | 'arcade' | 'exhibit';

export interface ApplianceOptions {
  /** 本体の材質（既定は種類ごと） */
  body?: MatId;
  /** 発光部（画面・看板・商品窓の奥）の材質 */
  accent?: MatId;
  /** 画面の絵の番号（arcade 0..7 = screenArcade、crtPc 0..3 = screenPc、vending 0..3 = 缶 canLabel の並びの組）。無ければ無地 */
  screen?: number;
  /** 'exhibit' の品目（MuseumObjects.ts の ExhibitKind） */
  variant?: string;
}

/** 段積み画像のマス（列 c・上からの段 r）へ、ジオメトリの UV（0..1）を写す。crop = 使う範囲 [u0, v0, u1, v1]（マス内の割合） */
function toCell(g: THREE.BufferGeometry, index: number, cols: number, rows: number, crop: readonly number[] = [0, 0, 1, 1]): void {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const c = index % cols, r = Math.floor(index / cols) % rows;
  for (let i = 0; i < uv.count; i++) {
    const u = crop[0] + (crop[2] - crop[0]) * Math.min(1, Math.max(0, uv.getX(i)));
    const v = crop[1] + (crop[3] - crop[1]) * Math.min(1, Math.max(0, uv.getY(i)));
    uv.setXY(i, (c + u) / cols, (rows - 1 - r + v) / rows);
  }
}

/** 縦横比 aspect（幅 / 高さ）の面に正方形寄りの絵を貼るときの切り抜き（絵の縦横比 pic に合わせて中央を使う） */
function cropFor(aspect: number, pic: number): number[] {
  const k = aspect / pic;
  return k >= 1 ? [0, 0.5 - 0.5 / k, 1, 0.5 + 0.5 / k] : [0.5 - 0.5 * k, 0, 0.5 + 0.5 * k, 1];
}

/** 缶の段積み画像 cans（8 × 4 マス、1 マス 128 px。缶は x 37..92・y 11..118 px。tools の grid-validation.json） */
const CAN_GRID = [8, 4] as const;
const CAN_PX = { x0: 39, x1: 90, y0: 13, y1: 116, lid: 15, cell: 128 };

/** 円柱（CylinderGeometry。u = 0 が +z = 正面）の UV を缶のマスへ: 正面の半周に缶の幅、上下に缶の高さ。蓋は缶の上端の銀色 */
function canUV(g: THREE.BufferGeometry, index: number): void {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute, nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const c = index % CAN_GRID[0], r = Math.floor(index / CAN_GRID[0]) % CAN_GRID[1];
  const W = CAN_GRID[0] * CAN_PX.cell, H = CAN_GRID[1] * CAN_PX.cell, cx = (CAN_PX.x0 + CAN_PX.x1) / 2, hw = (CAN_PX.x1 - CAN_PX.x0) / 2;
  for (let i = 0; i < uv.count; i++) {
    let px: number, py: number;
    if (Math.abs(nrm.getY(i)) > 0.5) { px = cx; py = CAN_PX.lid; }
    else {
      const u = uv.getX(i), a = u <= 0.5 ? u : u - 1; // −0.5..0.5（0 = 正面）
      px = Math.min(CAN_PX.x1, Math.max(CAN_PX.x0, cx + a * 4 * hw)); // 正面の半周（±0.25）で缶の幅
      py = CAN_PX.y1 - (CAN_PX.y1 - CAN_PX.y0) * uv.getY(i);
    }
    uv.setXY(i, (c * CAN_PX.cell + px) / W, 1 - (r * CAN_PX.cell + py) / H);
  }
}

/** 種類ごとに使う材質（RoomBuilder.materialPlan の事前コンパイル用） */
export function applianceMats(shape: ApplianceShape, o: ApplianceOptions = {}): MatId[] {
  const parts = buildAppliance(shape, shape === 'crtPc' ? [0.42, 0.36, 0.4] : shape === 'exhibit' ? [0.3, 0.3, 0.3] : [0.9, 1.8, 0.8], o);
  const mats = [...parts.keys()];
  for (const g of parts.values()) g.dispose();
  return mats;
}

export function buildAppliance(shape: ApplianceShape, size: readonly number[], o: ApplianceOptions = {}): Map<MatId, THREE.BufferGeometry> {
  const K = new Kit();
  const [w, h, d] = size;
  switch (shape) {
    case 'vending': vending(K, w, h, d, o); break;
    case 'washer': washer(K, w, h, d, false, o); break;
    case 'dryer': washer(K, w, h, d, true, o); break;
    case 'crtPc': crtPc(K, w, h, d, o); break;
    case 'arcade': arcade(K, w, h, d, o); break;
    case 'exhibit': if (o.variant && isExhibitKind(o.variant)) buildExhibit(K, o.variant); break;
  }
  return K.done();
}

export class Kit {
  private readonly parts = new Map<MatId, THREE.BufferGeometry[]>();
  add(g: THREE.BufferGeometry, mat: MatId): void {
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    if (!flat.getAttribute('uv')) flat.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(flat.getAttribute('position').count * 2), 2));
    for (const k of Object.keys(flat.attributes)) if (!['position', 'normal', 'uv'].includes(k)) flat.deleteAttribute(k);
    const list = this.parts.get(mat) ?? [];
    list.push(flat);
    this.parts.set(mat, list);
  }
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: MatId, chamfer = 0): void {
    const sx = Math.max(1e-3, x1 - x0), sy = Math.max(1e-3, y1 - y0), sz = Math.max(1e-3, z1 - z0);
    const g = chamfer > 0 ? chamferBoxGeometry(sx, sy, sz, chamfer, 4) : new THREE.BoxGeometry(sx, sy, sz);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.add(g, mat);
  }
  /** 軸 axis に沿った円柱（中心 c、長さ len） */
  cyl(r: number, len: number, axis: 'x' | 'y' | 'z', c: readonly number[], mat: MatId, seg = 12, open = false): void {
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(c[0], c[1], c[2]);
    this.add(g, mat);
  }
  sphere(r: number, c: readonly number[], mat: MatId, seg = 8): void {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2));
    g.translate(c[0], c[1], c[2]);
    this.add(g, mat);
  }
  /** 正面を向いた輪（z 軸まわり。中心 c） */
  ring(r: number, tube: number, c: readonly number[], mat: MatId): void {
    const g = new THREE.TorusGeometry(r, tube, 4, 16);
    g.translate(c[0], c[1], c[2]);
    this.add(g, mat);
  }
  /** 正面を向いた円板 */
  disc(r: number, c: readonly number[], mat: MatId, seg = 20): void {
    const g = new THREE.CircleGeometry(r, seg);
    g.translate(c[0], c[1], c[2]);
    this.add(g, mat);
  }
  /** 側面の輪郭 pts（[z, y] の列。反時計回り）を幅 w（x = −w/2..w/2）に押し出す */
  profile(pts: [number, number][], w: number, mat: MatId): void {
    const s = new THREE.Shape();
    pts.forEach(([z, y], i) => (i === 0 ? s.moveTo(z, y) : s.lineTo(z, y)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, steps: 1 });
    // 断面の x（= z）を +z へ、押し出し（+z）を −x へ（回転。鏡像にしない）
    g.rotateY(-Math.PI / 2);
    g.translate(w / 2, 0, 0);
    g.computeVertexNormals();
    this.add(g, mat);
  }
  /** 傾いた板: 下端 (zb, yb) から上端 (zt, yt) まで、幅 w、正面（外）へ off だけ出す */
  slantPlate(zb: number, yb: number, zt: number, yt: number, w: number, off: number, mat: MatId, uv?: (g: THREE.BufferGeometry, aspect: number) => void): void {
    const len = Math.hypot(zt - zb, yt - yb);
    const g = new THREE.PlaneGeometry(w, len);
    uv?.(g, w / len);
    const ang = Math.atan2(zb - zt, yt - yb); // 鉛直からの傾き（+ = 上端が奥へ倒れる）
    g.rotateX(-ang);
    const nz = Math.cos(ang), ny = Math.sin(ang); // 面の法線（正面寄り・上向き）
    g.translate(0, (yb + yt) / 2 + ny * off, (zb + zt) / 2 + nz * off);
    this.add(g, mat);
  }
  /** y 軸まわりの回転体。pts = [半径, 高さ] の列（下 → 上）。c = 中心の移動量 */
  lathe(pts: [number, number][], mat: MatId, seg = 20, c: readonly number[] = [0, 0, 0]): void {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg);
    g.translate(c[0], c[1], c[2]);
    this.add(g, mat);
  }
  /** 点列を通る管（Catmull-Rom）。closed で輪 */
  tube(pts: readonly (readonly number[])[], r: number, mat: MatId, seg = 16, radial = 6, closed = false): void {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed);
    this.add(new THREE.TubeGeometry(curve, seg, r, radial, closed), mat);
  }
  /** 水平な輪（y 軸まわり。中心 c）。arc で円弧 */
  hring(r: number, tube: number, c: readonly number[], mat: MatId, seg = 20, arc = Math.PI * 2): void {
    const g = new THREE.TorusGeometry(r, tube, 4, seg, arc);
    g.rotateX(Math.PI / 2);
    g.translate(c[0], c[1], c[2]);
    this.add(g, mat);
  }
  /** 任意のジオメトリを変換して足す（f で回転・移動） */
  geom(g: THREE.BufferGeometry, mat: MatId, f?: (g: THREE.BufferGeometry) => void): void {
    f?.(g);
    this.add(g, mat);
  }
  done(): Map<MatId, THREE.BufferGeometry> {
    const out = new Map<MatId, THREE.BufferGeometry>();
    for (const [mat, list] of this.parts) {
      const g = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      if (g) out.set(mat, g);
    }
    return out;
  }
}

// ---------------------------------------------------------------- 自販機
function vending(K: Kit, w: number, h: number, d: number, o: ApplianceOptions): void {
  const body = o.body ?? 'plasticRed';
  const glow = o.accent ?? 'lightPanel';
  const hw = w / 2, fz = d / 2;
  // 商品窓の範囲と奥行き（本体は窓の奥まで。窓の周りは前面の枠板で囲む = 窓が実際に凹む）
  const wx0 = -hw + 0.07, wx1 = hw - 0.19, wy0 = 0.82, wy1 = h - 0.22, back = fz - 0.14;
  K.box(-hw, hw, 0.06, h, -fz, back, body, 0.02);
  K.box(-hw + 0.03, hw - 0.03, 0, 0.06, -fz + 0.03, fz - 0.05, 'metalDark'); // 台座（奥へ引っ込める）
  // 前面の枠板（窓の上・下・左・右の操作部）
  K.box(-hw, hw, wy1, h, back, fz, body, 0.012);
  K.box(-hw, hw, 0.06, wy0, back, fz, body, 0.012);
  K.box(-hw, wx0, wy0, wy1, back, fz, body);
  K.box(wx1, hw, wy0, wy1, back, fz, body);
  // 上部の看板帯（発光）
  K.box(-hw + 0.04, hw - 0.04, h - 0.16, h - 0.05, fz, fz + 0.012, glow);
  // 商品窓の中: 奥の発光パネル・棚 3 段・缶 8 本ずつ・値札の帯と選択ボタン
  K.box(wx0, wx1, wy0, wy1, back, back + 0.01, glow);
  const cans: MatId[] = ['plasticRed', 'plasticBlue', 'whiteFabric', 'plasticYellow'];
  const labeled = o.screen !== undefined;
  const rows = 3, per = 8;
  const rowH = (wy1 - wy0) / rows;
  const pitch = (wx1 - wx0) / per;
  for (let r = 0; r < rows; r++) {
    const sy = wy0 + r * rowH;
    K.box(wx0, wx1, sy + 0.05, sy + 0.065, back, fz - 0.03, 'metal'); // 棚板
    K.box(wx0, wx1, sy + 0.015, sy + 0.05, fz - 0.035, fz - 0.028, 'whiteFabric'); // 値札の帯
    for (let k = 0; k < per; k++) {
      const x = wx0 + pitch * (k + 0.5);
      if (labeled) {
        // 缶のラベル（段積み画像のマス）: 段ごとに銘柄 8 種を並べ、組（screen）で段の模様をずらす
        const g = new THREE.CylinderGeometry(0.028, 0.028, 0.115, 8);
        canUV(g, ((o.screen! + r) % CAN_GRID[1]) * CAN_GRID[0] + ((k + r * 3 + o.screen! * 5) % CAN_GRID[0]));
        g.translate(x, sy + 0.065 + 0.058, back + 0.06);
        K.add(g, 'canLabel');
      } else K.cyl(0.028, 0.115, 'y', [x, sy + 0.065 + 0.058, back + 0.06], cans[(k + r * 3) % cans.length], 6);
      K.box(x - 0.012, x + 0.012, sy + 0.022, sy + 0.04, fz - 0.028, fz - 0.02, 'ledBlue'); // 選択ボタン
    }
  }
  // 窓の縁（黒いゴム）
  for (const [x0, x1, y0, y1] of [[wx0, wx1, wy1 - 0.012, wy1], [wx0, wx1, wy0, wy0 + 0.012], [wx0, wx0 + 0.012, wy0, wy1], [wx1 - 0.012, wx1, wy0, wy1]]) K.box(x0, x1, y0, y1, fz - 0.01, fz + 0.004, 'rubber');
  // 右の操作部: コイン投入口・紙幣口・返却レバー・つり銭口
  const cx = hw - 0.1;
  K.box(cx - 0.07, cx + 0.07, 0.95, 1.45, fz, fz + 0.01, 'metal');
  K.box(cx - 0.012, cx + 0.012, 1.3, 1.36, fz + 0.01, fz + 0.016, 'metalDark');
  K.box(cx - 0.045, cx + 0.045, 1.18, 1.21, fz + 0.01, fz + 0.016, 'metalDark');
  K.cyl(0.018, 0.03, 'z', [cx, 1.08, fz + 0.025], 'stainless', 10);
  K.box(cx - 0.05, cx + 0.05, 0.62, 0.72, fz - 0.03, fz + 0.005, 'metalDark');
  // 取り出し口（暗い凹み + 樹脂のフラップ）
  K.box(-hw + 0.1, hw - 0.28, 0.16, 0.42, fz - 0.14, fz + 0.001, 'rubber');
  K.box(-hw + 0.12, hw - 0.3, 0.2, 0.4, fz - 0.005, fz + 0.004, 'metalDark');
}

// ---------------------------------------------------------------- 洗濯機 / 乾燥機
function washer(K: Kit, w: number, h: number, d: number, dryer: boolean, o: ApplianceOptions): void {
  const body = o.body ?? 'paintWhite';
  const hw = w / 2, fz = d / 2;
  K.box(-hw, hw, 0.02, h, -fz, fz, body, 0.025);
  K.box(-hw + 0.03, hw - 0.03, 0, 0.02, -fz + 0.03, fz - 0.03, 'metalDark');
  // 丸窓
  const cy = dryer ? h * 0.52 : h * 0.44, r = Math.min(w, h) * 0.27;
  K.ring(r, 0.022, [0, cy, fz + 0.012], 'stainless');
  // 丸窓: 本体は奥行きいっぱいの箱なので、窓は前面に重ねて描く（旧: 本体の中のドラムが前面に隠れ、枠の内側が本体の色のままだった）。
  // 黒いゴムのパッキン → 暗い艶ガラス（screenDark。透過ガラスは InstancedMesh で黒く塗れるので使わない）→ ガラス越しのドラムの縁と、
  // 底の穴あき板の影（少し明るい金属の輪と小さな円）
  K.disc(r + 0.004, [0, cy, fz + 0.002], 'rubber', 24);
  K.disc(r - 0.028, [0, cy, fz + 0.005], 'screenDark', 24);
  K.ring(r * 0.66, 0.006, [0, cy, fz + 0.006], 'metalDark');
  K.disc(r * 0.18, [0, cy - r * 0.08, fz + 0.0055], 'metalDark', 12);
  K.box(-r - 0.04, -r - 0.015, cy - 0.05, cy + 0.05, fz, fz + 0.02, 'metal'); // 蝶番
  K.box(r + 0.005, r + 0.03, cy - 0.03, cy + 0.03, fz, fz + 0.025, 'metalDark'); // 取っ手
  // 操作パネル（洗濯機は上、乾燥機は下）
  const py0 = dryer ? 0.06 : h - 0.14, py1 = dryer ? 0.18 : h - 0.03;
  K.box(-hw + 0.03, hw - 0.03, py0, py1, fz - 0.01, fz + 0.008, 'metalDark');
  K.cyl(0.022, 0.02, 'z', [-hw + 0.1, (py0 + py1) / 2, fz + 0.018], 'stainless', 10);
  K.cyl(0.018, 0.02, 'z', [-hw + 0.17, (py0 + py1) / 2, fz + 0.018], 'stainless', 10);
  K.box(-0.06, 0.06, py0 + 0.03, py1 - 0.03, fz + 0.008, fz + 0.011, 'screenLcd');
  K.box(hw - 0.14, hw - 0.05, py0 + 0.015, py1 - 0.015, fz + 0.008, fz + 0.02, 'metal'); // 硬貨箱
  K.box(hw - 0.105, hw - 0.085, (py0 + py1) / 2 - 0.02, (py0 + py1) / 2 + 0.02, fz + 0.02, fz + 0.024, 'metalDark');
}

// ---------------------------------------------------------------- 机上の CRT とキーボード
function crtPc(K: Kit, w: number, h: number, _d: number, o: ApplianceOptions): void {
  const body = o.body ?? 'signPlate';
  const mw = Math.min(w, 0.42), mh = Math.min(h, 0.36);
  const fz = 0.08; // モニターの前面（原点から少し前）
  // 台座と首
  K.box(-0.12, 0.12, 0, 0.025, -0.14, 0.06, body, 0.008);
  K.box(-0.06, 0.06, 0.025, 0.06, -0.08, 0.0, body);
  // 前枠（面取り）と奥へ絞った胴（側面の輪郭を押し出す）
  const y0 = 0.06, y1 = y0 + mh;
  K.box(-mw / 2, mw / 2, y0, y1, fz - 0.05, fz, body, 0.012);
  K.profile([[fz - 0.05, y0 + 0.02], [fz - 0.05, y1 - 0.01], [fz - 0.3, y1 - 0.07], [fz - 0.36, y0 + 0.1], [fz - 0.3, y0 + 0.04]], mw - 0.06, body);
  // 画面（わずかに膨らんだ暗いガラス）と枠の凹み
  const sw = mw - 0.07, sh = mh - 0.08;
  K.box(-sw / 2 - 0.008, sw / 2 + 0.008, y0 + 0.035, y0 + 0.035 + sh + 0.016, fz - 0.004, fz + 0.001, 'metalDark');
  // 球の一部（半径 R）。四隅が枠の凹み（fz + 0.001）より手前に出るよう、隅の沈み込み分だけ前へ（中央は約 2 cm 膨らむ）
  const R = 1.2, sink = R - Math.sqrt(R * R - (sw / 2) ** 2 - (sh / 2) ** 2);
  const screen = new THREE.SphereGeometry(R, 6, 4, Math.PI / 2 - Math.asin(sw / 2 / R), 2 * Math.asin(sw / 2 / R), Math.PI / 2 - Math.asin(sh / 2 / R), 2 * Math.asin(sh / 2 / R));
  screen.translate(0, y0 + 0.043 + sh / 2, fz + 0.003 + sink - R);
  if (o.screen !== undefined) {
    // 画面の絵（4 : 3）: 位置から平面に UV を張る（球の一部なので元の UV は範囲が半端）
    const p = screen.getAttribute('position'), uv = screen.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / sw + 0.5, (p.getY(i) - (y0 + 0.043)) / sh);
    toCell(screen, o.screen, 2, 2, [0.02, 0.02, 0.98, 0.98]);
    K.add(screen, 'screenPc');
  } else K.add(screen, o.accent ?? 'screenDark');
  K.box(mw / 2 - 0.05, mw / 2 - 0.035, y0 + 0.012, y0 + 0.022, fz, fz + 0.004, 'ledBlue'); // 電源ランプ
  // キーボード（手前）: 本体 + キーの列 5 段 + マウス
  const kz = fz + 0.2;
  K.box(-0.21, 0.21, 0, 0.022, kz - 0.075, kz + 0.075, body, 0.006);
  // キーは 1 列を 3 つのブロック（左・中・右）にまとめる（260 台並ぶ部屋があるので 1 台 500 三角形程度に抑える）
  for (let r = 0; r < 5; r++) {
    const z = kz - 0.055 + r * 0.026;
    const blocks: [number, number][] = r === 4 ? [[-0.19, -0.11], [-0.09, 0.09], [0.11, 0.19]] : [[-0.19, -0.07], [-0.06, 0.07], [0.08, 0.19]];
    for (const [x0, x1] of blocks) K.box(x0, x1, 0.022, 0.032, z - 0.01, z + 0.01, 'whiteFabric');
  }
  K.box(0.26, 0.32, 0, 0.03, kz - 0.03, kz + 0.06, body, 0.01);
}

// ---------------------------------------------------------------- ゲーム筐体
function arcade(K: Kit, w: number, h: number, d: number, o: ApplianceOptions): void {
  const body = o.body ?? 'screenDark';
  const accent = o.accent ?? 'screenGlow';
  const fz = d / 2, bz = -d / 2;
  // 側面の輪郭（奥 → 手前、下 → 上。反時計回り: 左から見て z が右）
  const cpY = h * 0.5, cpOut = 0.16, scrB = h * 0.56, scrT = h * 0.82, marB = h * 0.85;
  K.profile([
    [bz, 0], [fz - 0.07, 0], [fz - 0.07, 0.1], [fz, 0.1], [fz, cpY - 0.04],
    [fz + cpOut, cpY + 0.02], [fz + cpOut, cpY + 0.07], [fz - 0.02, scrB],
    [fz - 0.2, scrT], [fz - 0.08, marB], [fz - 0.08, h], [bz, h],
  ], w, body);
  // 画面（傾いた発光面）と周りの黒い縁、看板
  if (o.screen !== undefined) K.slantPlate(fz - 0.02, scrB + 0.02, fz - 0.19, scrT - 0.015, w - 0.1, 0.004, 'screenArcade', (g, aspect) => toCell(g, o.screen!, 4, 2, cropFor(aspect, 1)));
  else K.slantPlate(fz - 0.02, scrB + 0.02, fz - 0.19, scrT - 0.015, w - 0.1, 0.004, accent);
  K.box(-w / 2 + 0.03, w / 2 - 0.03, marB + 0.02, h - 0.04, fz - 0.08, fz - 0.07, accent);
  // 操作盤: レバー（軸 + 玉）とボタン 4 つ
  const cpz = fz + cpOut * 0.55, cpy = cpY + 0.075;
  K.cyl(0.006, 0.07, 'y', [-w * 0.22, cpy + 0.035, cpz], 'metalDark', 6);
  K.sphere(0.022, [-w * 0.22, cpy + 0.075, cpz], 'plasticRed', 8);
  const btn: MatId[] = ['plasticRed', 'plasticYellow', 'plasticBlue', 'whiteFabric'];
  btn.forEach((m, i) => K.cyl(0.016, 0.012, 'y', [w * 0.02 + (i % 2) * 0.06 + (i > 1 ? 0.03 : 0), cpy + 0.006, cpz + (i > 1 ? -0.035 : 0.01)], m, 10));
  // コイン扉と投入口の灯
  K.box(-0.12, 0.12, 0.22, 0.46, fz, fz + 0.008, 'metal');
  for (const x of [-0.05, 0.05]) K.box(x - 0.012, x + 0.012, 0.37, 0.41, fz + 0.008, fz + 0.012, 'neonRed');
}
