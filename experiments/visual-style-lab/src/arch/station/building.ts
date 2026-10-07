import * as THREE from 'three';
import type { Builder, V3 } from '../../scenes/Builder.ts';
import type { SceneContext } from '../../scenes/types.ts';
import { slab, stairs, wallWithHoles, type WallHole } from '../kit.ts';
import { seatRow } from './furniture.ts';
import type { Tube } from './glow.ts';
import { ASTAIR, BLD, BSTAIR, D, PLAZA, ROOMS, TUN, Y } from './layout.ts';
import type { Mats } from './mats.ts';
import { region, tubeAdder, type AddTube } from './region.ts';
import { signGeo, type SignKind } from './signs.ts';
import { addPool } from './mat.ts';

/**
 * 駅舎（平屋・切妻屋根）と地下道。
 * 駅舎: 西の面は D（0 番線）に面して、改札と階段室の入口がある。東の面は駅前広場への入口。
 *   北から 階段室（改札内・地下道へ下りる）→ 事務室（窓口が待合室に、窓が D に向く）・電気室 → 待合室 → 便所
 * 地下道: 駅舎の階段の下から東へ、広場と 1 番線の下をくぐって A の階段の下まで（白いタイル・蛍光灯・案内）
 */
export function buildBuilding(ctx: SceneContext, root: THREE.Object3D, mat: Mats, tubes: Tube[]): (camera: THREE.Camera) => void {
  // 外（壁・屋根・窓・入口）は床の映り込みに出す。中（仕切り・家具・地下道）は出さない
  region(ctx, root, false, (b) => buildShell(b, ctx, mat));
  const facade = region(ctx, root, true, (b) => buildFacade(b, ctx, mat, tubeAdder(b, mat, tubes)));
  const inside = region(ctx, root, true, (b) => buildInterior(b, ctx, mat, tubeAdder(b, mat, tubes)));
  const tunnel = region(ctx, root, true, (b) => buildTunnel(b, mat, tubeAdder(b, mat, tubes)));
  const inBld = (p: THREE.Vector3): boolean => p.x > BLD.x0 && p.x < BLD.x1 && p.z > BLD.z0 && p.z < BLD.z1 && p.y < 3.2;
  // 地下道は、中にいるときと、階段の口（駅舎・A）が画角に入るときだけ描く（地上からは階段の口からしか見えない）
  // 階段の口の面の上の点（どれかが画面に入れば、口から地下道が見える）
  // A の口はホームから、駅舎の口は駅舎の中からだけ見える
  const mouthA: THREE.Vector3[] = [];
  const mouthB: THREE.Vector3[] = [];
  for (let z = ASTAIR.zBot + 0.2; z <= ASTAIR.zTop; z += 0.8) for (const x of [-ASTAIR.half, 0, ASTAIR.half]) mouthA.push(new THREE.Vector3(x, 0, z));
  for (let x = BSTAIR.xTop; x <= BSTAIR.xBot; x += 0.8) for (const z of [TUN.z0, (TUN.z0 + TUN.z1) / 2, TUN.z1]) mouthB.push(new THREE.Vector3(x, 0, z));
  const pm = new THREE.Matrix4();
  const v4 = new THREE.Vector4();
  const onScreen = (q: THREE.Vector3): boolean => {
    v4.set(q.x, q.y, q.z, 1).applyMatrix4(pm);
    if (v4.w <= 0.05) return false;
    return Math.abs(v4.x / v4.w) < 1.1 && Math.abs(v4.y / v4.w) < 1.1;
  };
  return (camera) => {
    camera.updateMatrixWorld();
    // 中にいるときは室内を先に描き（外の物は壁に隠れる）、外にいるときは後に描く（窓の奥だけ色を計算する）
    const p = camera.position;
    const below = p.y < -0.3;
    inside.renderOrder = inBld(p) ? -1 : 1;
    // 室内は、駅舎から 30 m より遠いと窓の奥は霧と暗がりで見分けられない（描かない）。外の小物は 70 m まで
    const dx = Math.max(BLD.x0 - p.x, 0, p.x - BLD.x1);
    const dz = Math.max(BLD.z0 - p.z, 0, p.z - BLD.z1);
    const dB = Math.hypot(dx, dz);
    inside.visible = dB < 30 || below;
    // 外の小物は東の面（広場）にある。駅舎の西（D の側）からは駅舎に隠れて見えない
    facade.visible = dB < 70 && p.x > BLD.x0 + 2;
    tunnel.renderOrder = below ? -1 : 1;
    if (below) {
      tunnel.visible = true;
      return;
    }
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    tunnel.visible = mouthA.some(onScreen) || (inBld(p) && mouthB.some(onScreen));
  };
}

/**
 * 駅舎の外の作り込み（床の映り込みに出さない層）: 軒の垂木の端・入口の庇の下の蛍光灯・壁の掲示板と時刻表・
 * 入口の脇のベンチ・くず入れ 3 つ・植木鉢の列・壁の灯り・歩道の点字ブロック（入口へ）
 */
function buildFacade(b: Builder, ctx: SceneContext, mat: Mats, addTube: AddTube): void {
  const { x0, x1, z0, z1, eave } = BLD;
  const zc = z0 + 18.8;
  // 軒の垂木の端（東と西の軒の下、0.9 m おき）と鼻隠し
  for (const s of [-1, 1]) {
    const xw = s > 0 ? x1 : x0;
    for (let z = z0 - 0.3; z <= z1 + 0.3; z += 0.9) b.box(mat.roofTile, [xw + s * 0.38, eave - 0.03, z], [0.7, 0.1, 0.07], { shadow: false });
    b.box(mat.sash, [xw + s * 0.72, eave + 0.02, (z0 + z1) / 2], [0.05, 0.2, z1 - z0 + 1.2], { shadow: false });
  }
  // 入口の庇の下の蛍光灯（2 つ）
  for (const dz of [-1.6, 1.6]) {
    b.box(mat.housing, [x1 + 1.2, 2.56, zc + dz], [0.3, 0.06, 1.3], { shadow: false });
    addTube([x1 + 1.2, 2.5, zc + dz], 1.1, 'z', 0.06, 0.04, true);
  }
  // 壁の掲示板（お知らせ）・時刻表・観光の広告
  b.boxMM(mat.wood, [x1 + 0.1, 0.95, z0 + 7.9], [x1 + 0.16, 2.05, z0 + 10.4]);
  b.mesh(signGeo('notice', [2.4, 1.0, 0.02]), mat.signLit, [x1 + 0.18, 1.5, z0 + 9.15], { rotY: Math.PI / 2, shadow: false });
  b.mesh(signGeo('timetable', [1.0, 0.8, 0.02]), mat.signLit, [x1 + 0.13, 1.4, z0 + 13.6], { rotY: Math.PI / 2, shadow: false });
  b.boxMM(mat.housing, [x1 + 0.1, 0.85, z0 + 24.05], [x1 + 0.18, 2.15, z0 + 24.95]);
  b.mesh(signGeo('ad', [0.8, 1.2, 0.02]), mat.signGlow, [x1 + 0.19, 1.5, z0 + 24.5], { rotY: Math.PI / 2, shadow: false });
  // 入口の脇の灯り（腕木の灯具）
  for (const dz of [-3.6, 3.6]) {
    b.box(mat.steel, [x1 + 0.25, 2.3, zc + dz], [0.3, 0.04, 0.04], { shadow: false });
    b.box(mat.housing, [x1 + 0.4, 2.22, zc + dz], [0.18, 0.14, 0.18], { shadow: false });
    b.box(mat.lampBox, [x1 + 0.4, 2.15, zc + dz], [0.14, 0.02, 0.14], { shadow: false });
  }
  // ベンチ（入口の北、壁沿い）・くず入れ 3 つ（燃える・缶・びん）・植木鉢の列（入口の南）
  seatRow(b, mat.benchT, mat.steel, [x1 + 0.55, Y.road + 0.12, z0 + 10.6], -Math.PI / 2, 3, 0.55);
  ctx.colliders.add({ x: x1 + 0.2, y: Y.road, z: z0 + 9.7 }, { x: x1 + 0.9, y: Y.road + 1.0, z: z0 + 11.5 });
  for (let k = 0; k < 3; k++) {
    const z = z0 + 13.0 + k * 0.52;
    b.boxMM(mat.steel, [x1 + 0.25, Y.road + 0.12, z - 0.22], [x1 + 0.7, Y.road + 0.97, z + 0.22], { collide: true });
    b.boxMM([mat.board, mat.signWhite, mat.green][k], [x1 + 0.23, Y.road + 0.97, z - 0.23], [x1 + 0.72, Y.road + 1.02, z + 0.23]);
    b.box(mat.black, [x1 + 0.71, Y.road + 0.82, z], [0.01, 0.06, 0.22], { shadow: false });
  }
  for (let k = 0; k < 4; k++) {
    const z = z0 + 22.2 + k * 0.75;
    b.boxMM(mat.wood, [x1 + 0.2, Y.road + 0.12, z - 0.3], [x1 + 0.7, Y.road + 0.55, z + 0.3], { collide: true });
    for (let j = 0; j < 3; j++) b.mesh(new THREE.IcosahedronGeometry(0.2 + ((k + j) % 3) * 0.04, 0), mat.hedge, [x1 + 0.45 + (j - 1) * 0.1, Y.road + 0.68 + (j % 2) * 0.08, z + (j - 1) * 0.15], { shadow: false });
  }
  // 自転車（北の壁に立てかけて）
  for (const z of [z0 + 2.2, z0 + 3.0]) {
    b.mesh(new THREE.TorusGeometry(0.33, 0.02, 4, 16), mat.black, [x1 + 0.3, Y.road + 0.46, z - 0.45], { shadow: false });
    b.mesh(new THREE.TorusGeometry(0.33, 0.02, 4, 16), mat.black, [x1 + 0.3, Y.road + 0.46, z + 0.55], { shadow: false });
    b.box(mat.steel, [x1 + 0.3, Y.road + 0.75, z + 0.05], [0.03, 0.03, 0.9], { shadow: false });
    b.box(mat.steel, [x1 + 0.3, Y.road + 0.98, z + 0.45], [0.5, 0.03, 0.03], { shadow: false });
  }
  // 歩道の点字ブロック（南北の線と、入口への枝）
  const o = { x: mat.tactileXo, z: mat.tactileZo, dot: mat.tactileDoto };
  const yt = Y.road + 0.12;
  tactileOn(b, o, x1 + 1.85, PLAZA.z0 + 0.5, x1 + 2.15, zc - 0.15, yt, 'start');
  tactileOn(b, o, x1 + 1.85, zc + 0.15, x1 + 2.15, PLAZA.z1 - 0.5, yt, 'end');
  b.boxMM(mat.tactileDoto, [x1 + 1.85, yt, zc - 0.15], [x1 + 2.15, yt + 0.004, zc + 0.15], { shadow: false });
  tactileOn(b, o, x1 + 1.0, zc - 0.15, x1 + 1.85, zc + 0.15, yt, 'none');
}

/** 点字ブロックの帯（線状）。x0〜x1・z0〜z1 の長方形。長い辺の向きに筋。端に点状の 0.3 m 角 */
export function tactileOn(b: Builder, m: { x: THREE.Material; z: THREE.Material; dot: THREE.Material }, x0: number, z0: number, x1: number, z1: number, y: number, dots: 'both' | 'start' | 'end' | 'none' = 'both'): void {
  const alongX = x1 - x0 > z1 - z0;
  const yy = y + 0.004;
  const a = dots === 'both' || dots === 'start' ? 0.3 : 0;
  const c = dots === 'both' || dots === 'end' ? 0.3 : 0;
  if (alongX) {
    if (a) b.boxMM(m.dot, [x0, y, z0], [x0 + a, yy, z1], { shadow: false });
    if (c) b.boxMM(m.dot, [x1 - c, y, z0], [x1, yy, z1], { shadow: false });
    b.boxMM(m.x, [x0 + a, y, z0], [x1 - c, yy, z1], { shadow: false });
  } else {
    if (a) b.boxMM(m.dot, [x0, y, z0], [x1, yy, z0 + a], { shadow: false });
    if (c) b.boxMM(m.dot, [x0, y, z1 - c], [x1, yy, z1], { shadow: false });
    b.boxMM(m.z, [x0, y, z0 + a], [x1, yy, z1 - c], { shadow: false });
  }
}

function buildShell(b: Builder, ctx: SceneContext, mat: Mats): void {
  const { x0, x1, z0, z1, eave, ridge } = BLD;
  const T = 0.2;
  const xm = (x0 + x1) / 2;

  // ---------- 床（階段の穴をよける）と基礎 ----------
  const hole: [number, number, number, number] = [BSTAIR.xTop, TUN.z0, BSTAIR.xBot, TUN.z1];
  const floorRects: [number, number, number, number][] = [
    [x0, z0, x1, hole[1]],
    [x0, hole[3], x1, z1],
    [x0, hole[1], hole[0], hole[3]],
    [hole[2], hole[1], x1, hole[3]],
  ];
  for (const r of floorRects) {
    b.boxMM(mat.wallBase, [r[0], Y.ground, r[1]], [r[2], -0.04, r[3]]);
    b.boxMM(mat.floorInt, [r[0], -0.04, r[1]], [r[2], 0, r[3]], { layer: 1 });
    ctx.colliders.add({ x: r[0], y: Y.ground, z: r[1] }, { x: r[2], y: 0, z: r[3] });
  }

  // ---------- 外壁（開口つき）。腰壁（濃い色）と上の壁 ----------
  const ext = (a: [number, number], c: [number, number], holes: WallHole[]): void => {
    wallWithHoles(b, mat.wallExtW, a, c, 0, eave, T, holes);
    // 腰壁の帯（外側に薄く重ねる。開口の所は抜く）
    const dx = c[0] - a[0];
    const dz = c[1] - a[1];
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    // 外向きの法線（建物の中心から離れる向き）
    const cxm = (a[0] + c[0]) / 2;
    const czm = (a[1] + c[1]) / 2;
    const out = (cxm + nx - xm) ** 2 + (czm + nz - (z0 + z1) / 2) ** 2 > (cxm - xm) ** 2 + (czm - (z0 + z1) / 2) ** 2 ? 1 : -1;
    const off = out * (T / 2 + 0.02);
    const a2: [number, number] = [a[0] + nx * off, a[1] + nz * off];
    const c2: [number, number] = [c[0] + nx * off, c[1] + nz * off];
    wallWithHoles(b, mat.wallBase, a2, c2, 0, 0.9, 0.04, holes.map((h) => ({ ...h, bottom: Math.min(h.bottom, 0), top: Math.max(h.top, 0.9) })), { collide: false });
  };
  // 西（D 側）: 階段室の入口・事務室の窓・改札
  ext([x0, z0], [x0, z1], [
    { at: 6.0, width: 5.2, bottom: 0, top: 2.6 },
    { at: 11.6, width: 3.2, bottom: 0.9, top: 2.1 },
    { at: 18.5, width: 6.6, bottom: 0, top: 2.5 },
    { at: 26.2, width: 1.6, bottom: 1.7, top: 2.3 },
  ]);
  // 東（広場側）: 入口・待合室の窓・階段室の高窓・電気室の窓・便所の高窓
  ext([x1, z0], [x1, z1], [
    { at: 4.5, width: 6.0, bottom: 1.6, top: 2.5 },
    { at: 11.6, width: 1.6, bottom: 1.0, top: 2.0 },
    { at: 15.7, width: 1.8, bottom: 0.9, top: 2.3 },
    { at: 18.8, width: 3.0, bottom: 0, top: 2.4 },
    { at: 22.4, width: 2.6, bottom: 0.9, top: 2.3 },
    { at: 26.2, width: 1.6, bottom: 1.7, top: 2.3 },
  ]);
  // 北: 階段室の高窓、南: 便所の高窓
  ext([x0 - T / 2, z0], [x1 + T / 2, z0], [{ at: 7.5, width: 6, bottom: 1.7, top: 2.5 }]);
  ext([x0 - T / 2, z1], [x1 + T / 2, z1], [{ at: 4, width: 1.2, bottom: 1.7, top: 2.3 }, { at: 10.8, width: 1.2, bottom: 1.7, top: 2.3 }]);

  // 窓のガラス（中の明かりが少し見える）と枠
  const win = (x: number, z: number, along: 'x' | 'z', w: number, y0: number, y1: number, lit = true): void => {
    const s: V3 = along === 'z' ? [0.04, y1 - y0, w] : [w, y1 - y0, 0.04];
    b.box(lit ? mat.winGlass : mat.glass, [x, (y0 + y1) / 2, z], s, { shadow: false });
    const n = Math.max(1, Math.round(w / 0.9));
    for (let k = 1; k < n; k++) {
      const t = -w / 2 + (k * w) / n;
      b.box(mat.sash, along === 'z' ? [x, (y0 + y1) / 2, z + t] : [x + t, (y0 + y1) / 2, z], along === 'z' ? [0.07, y1 - y0, 0.05] : [0.05, y1 - y0, 0.07], { shadow: false });
    }
    b.box(mat.sash, along === 'z' ? [x, (y0 + y1) / 2, z] : [x, (y0 + y1) / 2, z], along === 'z' ? [0.09, 0.06, w] : [w, 0.06, 0.09], { shadow: false });
    // 窓の枠（外へ出た窓台と、上の水切り・両脇の縦の枠）
    const ox = along === 'z' ? (x > (x0 + x1) / 2 ? 1 : -1) : 0;
    const oz = along === 'x' ? (z > (z0 + z1) / 2 ? 1 : -1) : 0;
    const sz = (d: number, h: number): V3 => (along === 'z' ? [d, h, w + 0.2] : [w + 0.2, h, d]);
    b.box(mat.sash, [x + ox * 0.13, y0 - 0.03, z + oz * 0.13], sz(0.16, 0.06), { shadow: false });
    b.box(mat.sash, [x + ox * 0.11, y1 + 0.04, z + oz * 0.11], sz(0.12, 0.08), { shadow: false });
    for (const e of [-1, 1]) {
      const c: V3 = along === 'z' ? [x + ox * 0.105, (y0 + y1) / 2, z + e * (w / 2 + 0.04)] : [x + e * (w / 2 + 0.04), (y0 + y1) / 2, z + oz * 0.105];
      b.box(mat.sash, c, along === 'z' ? [0.05, y1 - y0, 0.08] : [0.08, y1 - y0, 0.05], { shadow: false });
    }
  };
  win(x1, z0 + 4.5, 'z', 6.0, 1.6, 2.5);
  win(x1, z0 + 11.6, 'z', 1.6, 1.0, 2.0);
  win(x1, z0 + 15.7, 'z', 1.8, 0.9, 2.3);
  win(x1, z0 + 22.4, 'z', 2.6, 0.9, 2.3);
  win(x1, z0 + 26.2, 'z', 1.6, 1.7, 2.3, false);
  win(x0, z0 + 11.6, 'z', 3.2, 0.9, 2.1);
  win(x0, z0 + 26.2, 'z', 1.6, 1.7, 2.3, false);
  win(x0 + 7.5, z0, 'x', 6, 1.7, 2.5);
  win(x0 + 4, z1, 'x', 1.2, 1.7, 2.3, false);
  win(x0 + 10.8, z1, 'x', 1.2, 1.7, 2.3, false);

  // 入口の両開きの扉（ガラス戸。開いたまま、片側へ寄せてある）と庇
  {
    const zc = z0 + 18.8;
    for (const s of [-1, 1]) {
      b.box(mat.sash, [x1 + 0.12, 1.2, zc + s * 1.15], [0.05, 2.4, 0.7]);
      b.box(mat.winGlass, [x1 + 0.12, 1.3, zc + s * 1.15], [0.03, 1.9, 0.55], { shadow: false });
    }
    b.boxMM(mat.roofTile, [x1, 2.6, zc - 3.2], [x1 + 2.4, 2.75, zc + 3.2]);
    b.boxMM(mat.sash, [x1 + 2.3, 2.45, zc - 3.2], [x1 + 2.4, 2.75, zc + 3.2]);
    for (const s of [-1, 1]) b.box(mat.steel, [x1 + 2.25, 1.3, zc + s * 3.05], [0.1, 2.6, 0.1]);
    // 駅名の看板（庇の上）
    b.mesh(signGeo('name', [0.06, 0.6, 4.8]), mat.signLit, [x1 + 0.14, 3.35, zc]);
    // 入口の段（広場の盛り土 y = road から床へ）
    for (let k = 0; k < 3; k++) {
      const y = Y.road + ((k + 1) * (0 - Y.road)) / 3;
      b.boxMM(mat.curb, [x1 + 0.1 + (2 - k) * 0.32, Y.road - 0.05, zc - 3], [x1 + 0.1 + (3 - k) * 0.32, y, zc + 3], { collide: true });
    }
  }

  // ---------- 屋根（切妻・南北の棟）と天井 ----------
  {
    const over = 0.7;
    const run = (x1 - x0) / 2 + over;
    const rise = ridge - eave + (over * (ridge - eave)) / ((x1 - x0) / 2);
    const ang = Math.atan2(rise, run);
    const len = Math.hypot(run, rise);
    for (const s of [-1, 1]) {
      const cx = xm + s * (run / 2);
      const cy = ridge - rise / 2 + 0.1;
      b.box(mat.roofTile, [cx, cy, (z0 + z1) / 2], [len, 0.18, z1 - z0 + 1.2], { rotZ: -s * ang });
      // 瓦棒の筋（屋根の流れに沿って）
      for (let z = z0 - 0.4; z < z1 + 0.5; z += 0.45) b.box(mat.sash, [cx, cy + 0.1, z], [len, 0.04, 0.05], { rotZ: -s * ang, shadow: false });
    }
    b.box(mat.sash, [xm, ridge + 0.2, (z0 + z1) / 2], [0.3, 0.2, z1 - z0 + 1.2]);
    // 妻（三角の壁）
    const tri = new THREE.Shape();
    tri.moveTo(x0, eave);
    tri.lineTo(xm, ridge);
    tri.lineTo(x1, eave);
    tri.lineTo(x0, eave);
    for (const z of [z0, z1]) {
      const g = new THREE.ExtrudeGeometry(tri, { depth: T, bevelEnabled: false });
      g.translate(0, 0, -T / 2);
      b.mesh(g, mat.wallExtW, [0, 0, z]);
    }
    // 天井（室内）
    slab(b, mat.ceilInt, [x0, z0, x1, z1], 3.1, 0.1, { shadow: false, collide: false, layer: 1 });
    // 外壁の細部: 雨樋の縦管（四隅）・エアコンの室外機と配管（南）・電気の計器箱（北）・水道の蛇口
    for (const [x, z] of [[x0 + 0.2, z0 - 0.15], [x1 - 0.2, z0 - 0.15], [x0 + 0.2, z1 + 0.15], [x1 - 0.2, z1 + 0.15]] as const) {
      b.cyl(mat.steel, [x, eave / 2, z], 0.05, eave, { segments: 8 });
    }
    b.boxMM(mat.vending, [x1 - 3.6, 0, z1 + 0.15], [x1 - 2.8, 0.62, z1 + 0.45], { collide: true });
    b.box(mat.black, [x1 - 3.2, 0.31, z1 + 0.46], [0.5, 0.5, 0.01]);
    b.boxMM(mat.steel, [x1 - 2.75, 0.4, z1 + 0.12], [x1 - 2.68, 2.4, z1 + 0.18]);
    b.boxMM(mat.wallBase, [x1 - 6.2, 1.2, z0 - 0.3], [x1 - 5.4, 2.0, z0 - 0.12]);
    b.box(mat.board, [x1 - 5.8, 1.6, z0 - 0.31], [0.3, 0.2, 0.01]);
    b.boxMM(mat.steel, [x0 + 2.0, 0.5, z1 + 0.12], [x0 + 2.1, 0.6, z1 + 0.3]);
    // D の上屋と駅舎の壁の間の水切り（上屋の東の縁から壁まで）
    b.boxMM(mat.roof, [D.x + D.half - 0.25, D.soffit, z0], [x0, D.soffit + 0.25, z1]);
    // 雨樋（軒先）
    for (const s of [-1, 1]) b.box(mat.steel, [xm + s * ((x1 - x0) / 2 + over - 0.05), eave - 0.18, (z0 + z1) / 2], [0.12, 0.1, z1 - z0 + 1.2]);
  }

}

/** 蛍光灯の光だまりの色（× 強さ）と、窓から入る霧の光の色 */
const TUBE_COL: [number, number, number] = [0.96, 1.28, 1.22];
const WIN_COL: [number, number, number] = [0.6, 1.04, 0.99];
type Box6 = [number, number, number, number, number, number];
const scale = (c: [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];

/**
 * 天井の照明器具（暗い箱に 2 本の蛍光灯）と、その下の光だまり。y = 天井の下面、box = 照らす部屋の内側
 */
function fixture(b: Builder, mat: Mats, addTube: AddTube, x: number, y: number, z: number, along: 'x' | 'z', box: Box6, k = 1.25, radius = 4.2, len = 1.2): void {
  const hs: V3 = along === 'x' ? [len + 0.2, 0.07, 0.34] : [0.34, 0.07, len + 0.2];
  b.box(mat.housingIn, [x, y - 0.035, z], hs, { shadow: false });
  for (const o of [-0.08, 0.08]) addTube(along === 'x' ? [x, y - 0.1, z + o] : [x + o, y - 0.1, z], len, along, 0.055, 0.04, true);
  addPool({ kind: 0, c: [x, y - 0.12, z], axis: along === 'x' ? [1, 0, 0] : [0, 0, 1], half: len / 2, radius, color: scale(TUBE_COL, k), box });
}

/** 窓・開口から入る霧の光。x 一定の壁（along z）か z 一定の壁（along x）。side = 部屋の内側の向き（+1 / -1 の軸の向き） */
function windowLight(c: V3, along: 'x' | 'z', w: number, h: number, inward: 1 | -1, box: Box6, k = 1, radius = 4.5): void {
  // axis = (1,0,0) なら内側 = (0,0,-1)·side、axis = (0,0,1) なら内側 = (1,0,0)·side
  const axis: [number, number, number] = along === 'x' ? [1, 0, 0] : [0, 0, 1];
  const side = (along === 'x' ? -inward : inward) as 1 | -1;
  addPool({ kind: 1, c, axis, half: w / 2, halfH: h / 2, radius, color: scale(WIN_COL, k), box, side });
}

/** 壁に掛けた掲示物の額（暗い縁）と絵。face = 表の向き（'x' | '-x' | 'z' | '-z'） */
function framed(b: Builder, mat: Mats, kind: SignKind, c: V3, w: number, h: number, face: 'x' | '-x' | 'z' | '-z', glow = false): void {
  const rot = face === 'x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : face === '-z' ? Math.PI : 0;
  const fx = face === 'x' ? 1 : face === '-x' ? -1 : 0;
  const fz = face === 'z' ? 1 : face === '-z' ? -1 : 0;
  b.mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), mat.housingIn, [c[0] - fx * 0.01, c[1], c[2] - fz * 0.01], { rotY: rot, shadow: false });
  b.mesh(signGeo(kind, [w, h, 0.02]), glow ? mat.signGlowIn : mat.signLitIn, [c[0] + fx * 0.02, c[1], c[2] + fz * 0.02], { rotY: rot, shadow: false, layer: 1 });
}

/** 吊り下げの案内（両面）。along = 板の長手 */
function hangSign(b: Builder, mat: Mats, kind: SignKind, c: V3, along: 'x' | 'z', w: number, ceil: number): void {
  for (const s of [-1, 1]) {
    const o: V3 = along === 'x' ? [0, 0, s * 0.026] : [s * 0.026, 0, 0];
    const rot = along === 'x' ? (s > 0 ? 0 : Math.PI) : s > 0 ? Math.PI / 2 : -Math.PI / 2;
    b.mesh(signGeo(kind, [w, 0.3, 0.02]), mat.signGlowIn, [c[0] + o[0], c[1], c[2] + o[2]], { rotY: rot, shadow: false, layer: 1 });
  }
  b.box(mat.blackIn, c, along === 'x' ? [w + 0.06, 0.36, 0.03] : [0.03, 0.36, w + 0.06], { shadow: false });
  for (const s of [-1, 1]) {
    const p: V3 = along === 'x' ? [c[0] + s * (w / 2 - 0.15), (c[1] + 0.18 + ceil) / 2, c[2]] : [c[0], (c[1] + 0.18 + ceil) / 2, c[2] + s * (w / 2 - 0.15)];
    b.box(mat.steelIn, p, [0.02, ceil - c[1] - 0.18, 0.02], { shadow: false });
  }
}

/** 室内の点字ブロック（光だまりを受ける材質） */
function tactile(b: Builder, mat: Mats, x0: number, z0: number, x1: number, z1: number, y: number, dots: 'both' | 'start' | 'end' | 'none' = 'both'): void {
  tactileOn(b, { x: mat.tactileX, z: mat.tactileZ, dot: mat.tactileDot }, x0, z0, x1, z1, y, dots);
}

/** 天井の梁（長手 along、間隔 step で並べる。部屋の内側の範囲 [a0, a1]） */
function beams(b: Builder, mat: Mats, along: 'x' | 'z', span: [number, number], at: number[], y: number, depth = 0.22, w = 0.18): void {
  for (const c of at) {
    if (along === 'x') b.boxMM(mat.woodIn, [span[0], y - depth, c - w / 2], [span[1], y, c + w / 2], { shadow: false });
    else b.boxMM(mat.woodIn, [c - w / 2, y - depth, span[0]], [c + w / 2, y, span[1]], { shadow: false });
  }
}

/**
 * 室内の作り込みの決まり（駅舎の部屋）:
 * - 天井: 暗い板の升目・梁（2.6 m おき）・2 本組の蛍光灯の器具（梁の間）。器具の下に光だまり。屋根の下の一様な灯りは弱く、光だまりの外は暗い
 * - 窓・開口: 外の霧の光が入る（窓の前の床と向かいの壁が明るい。窓の脇の壁は逆光で暗い）
 * - 壁: 腰は濃い色、上は明るい塗り（水の筋・湿りの帯）。柱型（開口の間）。掲示物は額に入れて 10 m に 3〜4 枚
 * - 床: 濡れた水たまりに蛍光灯と窓が映る。入口から改札まで点字ブロック。入口に足ふきのマット
 */
function buildInterior(b: Builder, ctx: SceneContext, mat: Mats, addTube: AddTube): void {
  const { x0, x1, z0, z1 } = BLD;
  const T = 0.2;
  const xm = (x0 + x1) / 2;
  const CEIL = 3.0;
  const ix0 = x0 + T / 2;
  const ix1 = x1 - T / 2;
  // ---------- 中の仕切り ----------
  const part = (a: [number, number], c: [number, number], holes: WallHole[]): void => wallWithHoles(b, mat.wallInt, a, c, 0, 3.1, 0.12, holes);
  // 階段室 | 事務室・電気室（事務室への職員の扉）
  part([ix0, ROOMS.zA], [ix1, ROOMS.zA], [{ at: 3.0, width: 0.9, bottom: 0, top: 2.0 }, { at: 11.5, width: 0.9, bottom: 0, top: 2.0 }]);
  // 事務室・電気室 | 待合室（窓口・電気室の扉）
  part([ix0, ROOMS.zB], [ix1, ROOMS.zB], [{ at: 3.2, width: 1.8, bottom: 0.85, top: 1.95 }]);
  // 事務室 | 電気室
  part([ROOMS.xOff, ROOMS.zA], [ROOMS.xOff, ROOMS.zB], []);
  // 待合室 | 便所（男・女の入口）
  part([ix0, ROOMS.zC], [ix1, ROOMS.zC], [{ at: 4.2, width: 1.0, bottom: 0, top: 2.1 }, { at: 9.6, width: 1.0, bottom: 0, top: 2.1 }]);
  part([xm, ROOMS.zC], [xm, z1 - T / 2], []);
  // 閉じた扉（電気室・便所）と扉の枠
  for (const x of [ix0 + 3.0, ix0 + 11.5]) {
    b.box(mat.doorIn, [x, 1.0, ROOMS.zA + 0.08], [0.9, 2.0, 0.04], { collide: true });
    b.box(mat.sashIn, [x, 2.04, ROOMS.zA + 0.08], [1.04, 0.08, 0.06], { shadow: false });
    b.box(mat.steelIn, [x + 0.32, 1.0, ROOMS.zA + 0.11], [0.12, 0.03, 0.03], { shadow: false });
  }
  for (const x of [ix0 + 4.2, ix0 + 9.6]) {
    b.box(mat.sashIn, [x, 1.05, ROOMS.zC - 0.08], [1.0, 2.1, 0.04], { collide: true });
    b.box(x < xm ? mat.signal : mat.signalG, [x, 2.3, ROOMS.zC - 0.1], [0.3, 0.3, 0.02]);
  }

  // ---------- 待合室 ----------
  {
    const zh0 = ROOMS.zB;
    const zh1 = ROOMS.zC;
    const box: Box6 = [ix0, -0.1, zh0 + 0.06, ix1, 3.1, zh1 - 0.06];
    // 天井: 梁と器具（梁の間に 2 列 × 3）
    beams(b, mat, 'x', [ix0, ix1], [zh0 + 1.3, zh0 + 3.9, zh0 + 6.5, zh0 + 9.1], CEIL);
    beams(b, mat, 'z', [zh0 + 0.06, zh1 - 0.06], [xm], CEIL - 0.0, 0.16, 0.22);
    for (const z of [zh0 + 2.6, zh0 + 7.8]) for (const x of [ix0 + 2.6, xm - 2.2, ix1 - 2.6]) fixture(b, mat, addTube, x, CEIL, z, 'x', box);
    // 煙の感知器・天井のスピーカー
    for (const [x, z] of [[xm + 3.4, zh0 + 5.2], [ix0 + 4.4, zh0 + 5.2]] as const) b.cyl(mat.boardIn, [x, CEIL - 0.03, z], 0.09, 0.05, { segments: 12, shadow: false });
    b.boxMM(mat.blackIn, [ix1 - 1.6, CEIL - 0.08, zh0 + 5.0], [ix1 - 1.2, CEIL, zh0 + 5.4], { shadow: false });
    // 窓・入口・改札の開口から入る霧の光
    windowLight([x1, 1.6, zh0 + 1.6], 'z', 1.8, 1.4, -1, box, 0.9);
    windowLight([x1, 1.2, z0 + 18.8], 'z', 3.0, 2.4, -1, box, 1.1, 5.5);
    windowLight([x1, 1.6, z0 + 22.4], 'z', 2.6, 1.4, -1, box, 0.9);
    windowLight([x0, 1.25, z0 + 18.5], 'z', 6.6, 2.5, 1, box, 0.75, 5.5);
    // ベンチ（背中合わせの 2 列・窓際の 1 列）
    seatRow(b, mat.benchIn, mat.steelIn, [xm + 1.6, 0, (zh0 + zh1) / 2 - 0.35], 0, 6, 0.55);
    seatRow(b, mat.benchIn, mat.steelIn, [xm + 1.6, 0, (zh0 + zh1) / 2 + 0.35], Math.PI, 6, 0.55);
    ctx.colliders.add({ x: xm + 1.6 - 1.75, y: 0, z: (zh0 + zh1) / 2 - 0.7 }, { x: xm + 1.6 + 1.75, y: 0.9, z: (zh0 + zh1) / 2 + 0.7 });
    seatRow(b, mat.benchIn, mat.steelIn, [x1 - 0.55, 0, zh1 - 2.0], Math.PI / 2, 4, 0.55);
    ctx.colliders.add({ x: x1 - 0.9, y: 0, z: zh1 - 3.2 }, { x: x1 - 0.2, y: 0.9, z: zh1 - 0.8 });
    // 券売機 2 台（北の壁、窓口の東）と運賃表・「きっぷうりば」
    for (const x of [x0 + 6.4, x0 + 7.4]) {
      b.boxMM(mat.ticketIn, [x - 0.42, 0, zh0 + 0.06], [x + 0.42, 1.65, zh0 + 0.62], { collide: true });
      b.box(mat.ticketScreen, [x, 1.15, zh0 + 0.63], [0.5, 0.36, 0.02], { shadow: false });
      b.box(mat.blackIn, [x, 0.75, zh0 + 0.63], [0.3, 0.12, 0.02]);
      b.box(mat.boardIn, [x, 1.5, zh0 + 0.63], [0.6, 0.08, 0.02], { shadow: false });
      b.boxMM(mat.housingIn, [x - 0.44, 1.65, zh0 + 0.06], [x + 0.44, 1.75, zh0 + 0.66]);
    }
    framed(b, mat, 'fare', [x0 + 6.9, 2.25, zh0 + 0.08], 2.2, 0.85, 'z');
    b.mesh(signGeo('kippu', [1.5, 0.22, 0.03]), mat.signGlowIn, [x0 + 6.9, 2.86, zh0 + 0.1], { shadow: false, layer: 1 });
    // 窓口のカウンターと札・小さな掲示
    b.boxMM(mat.wallBaseIn, [x0 + 2.2, 0, zh0 - 0.1], [x0 + 4.2, 0.85, zh0 + 0.35]);
    b.boxMM(mat.boardIn, [x0 + 2.2, 0.85, zh0 - 0.1], [x0 + 4.2, 0.9, zh0 + 0.4]);
    b.box(mat.winGlass, [x0 + 3.2, 1.4, zh0], [1.8, 1.1, 0.02], { shadow: false });
    b.boxMM(mat.sashIn, [x0 + 2.25, 1.95, zh0 + 0.06], [x0 + 4.15, 2.05, zh0 + 0.1]);
    b.box(mat.boardIn, [x0 + 3.2, 2.25, zh0 + 0.08], [1.2, 0.22, 0.02], { shadow: false });
    // コインロッカー（北の壁の東）: 4 列 × 5 段の扉・すき間・鍵
    {
      const xa = x0 + 9.2;
      const xb = x0 + 11.6;
      const zf = zh0 + 0.56;
      b.boxMM(mat.lockerIn, [xa, 0, zh0 + 0.06], [xb, 1.85, zf], { collide: true });
      b.boxMM(mat.housingIn, [xa - 0.02, 1.85, zh0 + 0.06], [xb + 0.02, 1.95, zf + 0.02]);
      for (let k = 1; k < 4; k++) b.box(mat.blackIn, [xa + (k * (xb - xa)) / 4, 0.95, zf + 0.003], [0.015, 1.8, 0.01], { shadow: false });
      for (let r = 1; r < 5; r++) b.box(mat.blackIn, [(xa + xb) / 2, 0.08 + r * 0.354, zf + 0.003], [xb - xa, 0.015, 0.01], { shadow: false });
      for (let c = 0; c < 4; c++) for (let r = 0; r < 5; r++) b.box(mat.steelIn, [xa + (c + 0.8) * 0.6, 0.08 + (r + 0.5) * 0.354, zf + 0.008], [0.04, 0.06, 0.012], { shadow: false });
    }
    // 消火栓の箱（赤）と赤い灯・パンフレットの棚
    b.boxMM(mat.redIn, [ix1 - 1.75, 0.5, zh0 + 0.06], [ix1 - 1.05, 1.4, zh0 + 0.24]);
    b.box(mat.redLit, [ix1 - 1.4, 1.55, zh0 + 0.12], [0.12, 0.12, 0.08], { shadow: false });
    {
      const xr = x0 + 12.6;
      b.boxMM(mat.woodIn, [xr - 0.4, 0, zh0 + 0.06], [xr + 0.4, 1.45, zh0 + 0.36]);
      const cols = [mat.boardIn, mat.redIn, mat.greenIn, mat.boardIn, mat.ticketIn];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) b.box(cols[(r * 3 + c) % cols.length], [xr - 0.25 + c * 0.25, 0.55 + r * 0.24, zh0 + 0.38], [0.2, 0.2, 0.02], { rotX: -0.25, shadow: false });
    }
    // 時刻表・発車の案内・時計（改札の上）
    framed(b, mat, 'timetable', [ix0 + 0.03, 1.6, zh0 + 0.9], 1.3, 1.1, 'x');
    b.mesh(signGeo('depart', [1.5, 0.19, 0.03]), mat.signGlowIn, [ix0 + 0.04, 2.62, z0 + 16.3], { rotY: Math.PI / 2, shadow: false, layer: 1 });
    b.boxMM(mat.blackIn, [ix0, 2.5, z0 + 15.5], [ix0 + 0.03, 2.74, z0 + 17.1], { shadow: false });
    b.cyl(mat.boardIn, [ix0 + 0.02, 2.75, z0 + 18.5], 0.2, 0.06, { axis: 'x', segments: 20 });
    b.box(mat.blackIn, [ix0 + 0.06, 2.78, z0 + 18.5], [0.01, 0.13, 0.02]);
    b.box(mat.blackIn, [ix0 + 0.06, 2.75, z0 + 18.55], [0.01, 0.02, 0.1]);
    // 吊り下げの案内（改札口・出口。両面）
    hangSign(b, mat, 'hangGate', [x0 + 4.4, 2.42, z0 + 18.5], 'z', 2.6, CEIL);
    // 掲示物（東の壁・南の壁）と伝言板
    framed(b, mat, 'posters', [ix1 - 0.03, 1.2, zh0 + 0.9], 1.2, 0.9, '-x');
    framed(b, mat, 'posters', [x1 - 2.0, 1.55, zh1 - 0.09], 2.0, 0.9, '-z');
    framed(b, mat, 'notice', [x0 + 7.2, 1.55, zh1 - 0.09], 2.6, 1.0, '-z');
    framed(b, mat, 'dengon', [x0 + 1.7, 1.5, zh1 - 0.09], 1.3, 1.0, '-z');
    framed(b, mat, 'ad', [ix1 - 0.03, 1.55, z0 + 21.0 - 0.6], 0.5, 0.7, '-x', true);
    // 自動販売機（入口の脇）・くず入れ 3 つ（燃える・缶・びん）
    b.boxMM(mat.vendingIn, [x1 - 0.95, 0, zh1 - 0.95], [x1 - 0.12, 1.83, zh1 - 0.12], { collide: true });
    b.box(mat.vendingLit, [x1 - 0.96, 1.25, zh1 - 0.53], [0.02, 0.6, 0.6], { shadow: false });
    b.box(mat.blackIn, [x1 - 0.96, 0.4, zh1 - 0.53], [0.02, 0.18, 0.4]);
    for (let k = 0; k < 3; k++) {
      const z = zh0 + 2.2 + k * 0.5;
      b.boxMM(mat.steelIn, [ix1 - 0.45, 0, z - 0.21], [ix1 - 0.05, 0.85, z + 0.21], { collide: true });
      b.boxMM([mat.boardIn, mat.ticketIn, mat.greenIn][k], [ix1 - 0.47, 0.85, z - 0.22], [ix1 - 0.04, 0.9, z + 0.22]);
      b.box(mat.blackIn, [ix1 - 0.46, 0.7, z], [0.01, 0.06, 0.2], { shadow: false });
    }
    // 腰壁の帯（内側。開口をよけて置く）と、上の縁の細い見切り
    for (const [xa, xb] of [[ix0, ix0 + 0.02], [ix1 - 0.02, ix1]] as const) {
      const cuts = xa < xm ? [[15.2, 21.8]] : [[17.3, 20.3], [14.8, 16.6], [21.1, 23.7]];
      let z = zh0 + 0.06;
      const seg = (za: number, zb: number): void => {
        b.boxMM(mat.wallBaseIn, [xa, 0, za], [xb, 0.95, zb]);
        b.boxMM(mat.woodIn, [Math.min(xa, xb) - 0.01, 0.95, za], [Math.max(xa, xb) + 0.01, 1.0, zb], { shadow: false });
      };
      for (const [c0, c1] of [...cuts].sort((p, q) => p[0] - q[0])) {
        if (c0 > z) seg(z, c0);
        z = Math.max(z, c1);
      }
      if (z < zh1 - 0.06) seg(z, zh1 - 0.06);
    }
    b.boxMM(mat.wallBaseIn, [x0 + 4.4, 0, zh1 - 0.08], [x1 - 0.2, 0.95, zh1 - 0.06]);
    // 柱型（壁の角と開口の間）
    for (const z of [zh0 + 0.16, z0 + 16.95, z0 + 20.65, zh1 - 0.16]) b.boxMM(mat.woodIn, [ix1 - 0.12, 0, z - 0.12], [ix1, CEIL, z + 0.12], { shadow: false });
    for (const z of [zh0 + 0.16, z0 + 15.1, z0 + 21.9, zh1 - 0.16]) b.boxMM(mat.woodIn, [ix0, 0, z - 0.12], [ix0 + 0.12, CEIL, z + 0.12], { shadow: false });
    // 消火器・植木鉢
    b.cyl(mat.redLit, [x1 - 1.4, 0.3, zh1 - 0.3], 0.09, 0.55, { segments: 10 });
    b.cyl(mat.woodIn, [x0 + 1.0, 0.25, zh1 - 0.6], 0.25, 0.5, { segments: 12, collide: true });
    for (let k = 0; k < 6; k++) b.mesh(new THREE.IcosahedronGeometry(0.22, 0), mat.hedge, [x0 + 1.0 + Math.cos(k) * 0.15, 0.7 + k * 0.08, zh1 - 0.6 + Math.sin(k * 2) * 0.15]);
    // 床: 入口から改札への点字ブロック・入口のマット
    tactile(b, mat, x0 + 2.4, z0 + 17.95, ix1 - 0.3, z0 + 18.25, 0, 'both');
    tactile(b, mat, x0 + 2.4, zh0 + 0.8, x0 + 2.7, z0 + 17.95, 0, 'start');
    b.boxMM(mat.blackIn, [ix1 - 1.4, 0, z0 + 17.4], [ix1 - 0.05, 0.01, z0 + 20.2], { shadow: false });
  }

  // ---------- 改札（西の壁の開口に自動改札 4 台と係員の箱） ----------
  {
    const zc = z0 + 18.5;
    const xg = x0 + 0.9;
    const lanes = [-2.15, -1.0, 0.15, 1.3];
    for (const dz of lanes) {
      b.boxMM(mat.vendingIn, [xg - 0.7, 0, zc + dz - 0.125], [xg + 0.7, 0.95, zc + dz + 0.125], { collide: true });
      b.boxMM(mat.blackIn, [xg - 0.72, 0.95, zc + dz - 0.13], [xg + 0.72, 1.02, zc + dz + 0.13]);
      b.box(mat.ticketScreen, [xg - 0.2, 1.03, zc + dz], [0.18, 0.01, 0.16], { shadow: false });
      b.box(mat.signalG, [xg - 0.71, 0.8, zc + dz], [0.01, 0.08, 0.08], { shadow: false });
      b.box(mat.signalG, [xg + 0.71, 0.8, zc + dz], [0.01, 0.08, 0.08], { shadow: false });
    }
    // 係員の箱（改札の南）
    b.boxMM(mat.wallBaseIn, [xg - 0.8, 0, zc + 2.0], [xg + 0.8, 1.05, zc + 3.1], { collide: true });
    b.boxMM(mat.boardIn, [xg - 0.85, 1.05, zc + 1.95], [xg + 0.85, 1.1, zc + 3.15]);
    b.box(mat.winGlass, [xg, 1.5, zc + 1.97], [1.5, 0.8, 0.02], { shadow: false });
    // 改札の上の案内（「のりば 0 番線 / 1・2 番線は地下道」）
    b.mesh(signGeo('guide', [3.8, 0.36, 0.05]), mat.signUnlit, [x0 - 0.05, 2.75, zc], { shadow: false, rotY: -Math.PI / 2 });
  }

  // ---------- 事務室（窓口と D 側の窓から見える） ----------
  {
    const zr0 = ROOMS.zA;
    const zr1 = ROOMS.zB;
    const box: Box6 = [ix0, -0.1, zr0 + 0.06, ROOMS.xOff - 0.06, 3.1, zr1 - 0.06];
    b.boxMM(mat.woodIn, [x0 + 1.5, 0, zr0 + 1.0], [x0 + 3.5, 0.72, zr0 + 1.9], { collide: true });
    b.boxMM(mat.woodIn, [x0 + 4.2, 0, zr0 + 1.0], [x0 + 6.2, 0.72, zr0 + 1.9], { collide: true });
    for (const x of [x0 + 2.5, x0 + 5.2]) {
      b.box(mat.blackIn, [x, 0.45, zr0 + 2.4], [0.45, 0.08, 0.45]);
      b.box(mat.blackIn, [x, 0.75, zr0 + 2.62], [0.45, 0.55, 0.06]);
      b.box(mat.ticketScreen, [x, 0.95, zr0 + 1.2], [0.5, 0.32, 0.03], { shadow: false });
      // 書類の山
      b.boxMM(mat.boardIn, [x + 0.35, 0.72, zr0 + 1.2], [x + 0.75, 0.8 + (x > x0 + 4 ? 0.12 : 0.05), zr0 + 1.6]);
    }
    // 棚と書類
    b.boxMM(mat.steelIn, [ROOMS.xOff - 0.5, 0, zr0 + 0.2], [ROOMS.xOff - 0.1, 2.0, zr1 - 0.3], { collide: true });
    for (let k = 0; k < 4; k++) b.boxMM(mat.boardIn, [ROOMS.xOff - 0.48, 0.3 + k * 0.45, zr0 + 0.4], [ROOMS.xOff - 0.14, 0.55 + k * 0.45, zr1 - 0.5]);
    // 黒板（運行の掲示）
    b.box(mat.greenIn, [x0 + 3.8, 1.6, zr0 + 0.08], [2.4, 1.0, 0.03]);
    b.box(mat.woodIn, [x0 + 3.8, 1.08, zr0 + 0.1], [2.4, 0.04, 0.06]);
    beams(b, mat, 'x', [ix0, ROOMS.xOff], [zr0 + 1.25, zr0 + 3.85], CEIL);
    for (const x of [x0 + 2.6, x0 + 5.6]) fixture(b, mat, addTube, x, CEIL, zr0 + 2.55, 'x', box, 1.1);
    windowLight([x0, 1.5, z0 + 11.6], 'z', 3.2, 1.2, 1, box, 0.8);
  }

  // ---------- 階段室（改札内。D から入り、東へ下りる） ----------
  {
    const box: Box6 = [ix0, -0.1, z0 + 0.1, ix1, 3.1, ROOMS.zA - 0.06];
    // 階段（西が上、東へ下りる）
    stairs(b, mat.concreteIn, [BSTAIR.xBot, TUN.floor, (TUN.z0 + TUN.z1) / 2], '-x', 0 - TUN.floor, TUN.z1 - TUN.z0);
    // 段鼻の黄色い線
    for (let i = 0; i < 25; i++) {
      const x = BSTAIR.xBot - i * 0.28 - 0.03;
      const y = TUN.floor + ((i + 1) * (0 - TUN.floor)) / 25;
      b.box(mat.yellowPaint, [x, y + 0.003, (TUN.z0 + TUN.z1) / 2], [0.05, 0.006, TUN.z1 - TUN.z0 - 0.1], { shadow: false });
    }
    // 階段の両側の壁（床より下）と、床の上の柵（笠木・中の横棒・縦の支柱・下の蹴込み板）
    for (const z of [TUN.z0 - 0.15, TUN.z1 + 0.15]) {
      b.boxMM(mat.tileTun, [BSTAIR.xTop - 0.15, TUN.floor, z - 0.15], [BSTAIR.xBot, 0, z + 0.15], { collide: true });
      ctx.colliders.add({ x: BSTAIR.xTop - 0.15, y: 0, z: z - 0.1 }, { x: BSTAIR.xBot, y: 1.05, z: z + 0.1 });
      b.boxMM(mat.wallBaseIn, [BSTAIR.xTop - 0.15, 0, z - 0.08], [BSTAIR.xBot, 0.15, z + 0.08], { shadow: false });
      b.boxMM(mat.steelIn, [BSTAIR.xTop - 0.15, 1.0, z - 0.04], [BSTAIR.xBot, 1.05, z + 0.04], { shadow: false });
      b.boxMM(mat.steelIn, [BSTAIR.xTop - 0.15, 0.55, z - 0.015], [BSTAIR.xBot, 0.58, z + 0.015], { shadow: false });
      for (let x = BSTAIR.xTop - 0.1; x <= BSTAIR.xBot + 0.01; x += 0.12) b.boxMM(mat.steelIn, [x - 0.012, 0.15, z - 0.012], [x + 0.012, 1.0, z + 0.012], { shadow: false });
    }
    // 手すり（壁の内側。斜めの管と、上下の端の受け）
    for (const z of [TUN.z0 + 0.06, TUN.z1 - 0.06]) {
      const ya = 0.85;
      const yb = TUN.floor + 0.85;
      const g = new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(BSTAIR.xBot - BSTAIR.xTop, ya - yb), 8);
      g.rotateZ(Math.PI / 2 - Math.atan2(ya - yb, BSTAIR.xBot - BSTAIR.xTop) * -1);
      b.mesh(g, mat.steelIn, [(BSTAIR.xTop + BSTAIR.xBot) / 2, (ya + yb) / 2, z], { rotZ: 0 });
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        b.box(mat.steelIn, [BSTAIR.xTop + (BSTAIR.xBot - BSTAIR.xTop) * t, ya + (yb - ya) * t - 0.05, z + (z < 1.7 ? -0.03 : 0.03)], [0.03, 0.1, 0.06], { shadow: false });
      }
    }
    // 案内（「1・2 番線 3〜6 番線 → 地下道」）・掲示物・時刻表・消火器
    b.mesh(signGeo('under', [3.2, 0.36, 0.05]), mat.signUnlit, [BSTAIR.xTop + 2, 2.7, TUN.z1 + 0.4], { shadow: false, layer: 1 });
    framed(b, mat, 'posters', [ix1 - 0.03, 1.05, z0 + 6.5], 2.2, 0.8, '-x');
    framed(b, mat, 'timetable', [x0 + 1.5, 1.35, z0 + 0.13], 1.1, 0.9, 'z');
    framed(b, mat, 'notice', [x0 + 9.0, 1.4, ROOMS.zA - 0.08], 2.4, 0.9, '-z');
    b.cyl(mat.redLit, [ix1 - 0.3, 0.3, ROOMS.zA - 0.3], 0.09, 0.55, { segments: 10 });
    // 天井: 梁・器具（階段の上にも 1 つ）
    beams(b, mat, 'x', [ix0, ix1], [z0 + 3.4, z0 + 6.6], CEIL);
    for (const x of [x0 + 3, x0 + 9]) fixture(b, mat, addTube, x, CEIL, z0 + 5.0, 'x', box, 1.15);
    fixture(b, mat, addTube, (BSTAIR.xTop + BSTAIR.xBot) / 2, CEIL, (TUN.z0 + TUN.z1) / 2, 'x', [BSTAIR.xTop - 0.2, TUN.floor - 0.1, TUN.z0 - 0.05, BSTAIR.xBot + 0.1, 3.1, TUN.z1 + 0.05], 1.3, 6.0);
    // 開口（D）と高窓の光
    windowLight([x0, 1.3, z0 + 6.0], 'z', 5.2, 2.6, 1, box, 0.85, 6.0);
    windowLight([x0 + 7.5, 2.1, z0], 'x', 6, 0.8, 1, box, 0.6);
    windowLight([x1, 2.05, z0 + 4.5], 'z', 6, 0.9, -1, box, 0.6);
    // 床: D の口から階段の上までの点字ブロック
    tactile(b, mat, ix0 + 0.2, z0 + 5.85, x0 + 2.65, z0 + 6.15, 0, 'start');
    tactile(b, mat, x0 + 2.35, TUN.z1 + 0.35, x0 + 2.65, z0 + 6.15, 0, 'both');
  }
}

/**
 * 地下道（駅舎の階段の下から A の階段の下まで）と、A の階段・囲い。
 * 作り込みの決まり: 4 m おきの 2 本組の蛍光灯（器具の下に光だまり、間は暗い）・天井の配線の棚と管・7.5 m おきの伸縮目地・
 * 両側の手すり・床の溝の蓋（格子）・濡れた床（蛍光灯が映る）・点字ブロック・掲示物（額）と内照式の広告
 */
function buildTunnel(b: Builder, mat: Mats, addTube: AddTube): void {
  const { z0, z1, floor, ceil, x0, x1 } = TUN;
  const W = 0.3;
  const zc = (z0 + z1) / 2;
  const box: Box6 = [x0 - 0.2, floor - 0.1, z0, x1 + 0.3, ceil + 0.05, z1];
  // 床（A の階段の下の踊り場まで）
  b.boxMM(mat.floorTun, [x0 - 0.2, floor - 0.3, z0 - W], [x1 + W, floor, z1 + W], { collide: true });
  b.boxMM(mat.floorTun, [-ASTAIR.half - 0.15, floor - 0.3, z1], [ASTAIR.half + 0.15, floor, ASTAIR.zBot + 1.2], { collide: true });
  // 壁（北・南。南の壁は A の階段の所で開く）
  b.boxMM(mat.tileTun, [x0 - 0.2, floor, z0 - W], [x1 + W, ceil, z0], { collide: true });
  b.boxMM(mat.tileTun, [x0 - 0.2, floor, z1], [-ASTAIR.half - 0.15, ceil, z1 + W], { collide: true });
  b.boxMM(mat.tileTun, [x1, floor, z0], [x1 + W, ceil, z1 + W], { collide: true });
  // 天井（道床の下の版）
  b.boxMM(mat.ceilTun, [x0 - 0.2, ceil, z0 - W], [x1 + W, ceil + 0.3, z1], { shadow: false });
  const xs = -ASTAIR.half - 0.15;
  // 腰の線（濃い帯）と床の端の溝（暗い溝に鋼の格子の蓋）
  for (const z of [z0 + 0.005, z1 - 0.005]) {
    const xe = z === z1 - 0.005 ? xs : x1;
    b.boxMM(mat.trimTun, [x0, floor + 0.95, z - 0.01], [xe, floor + 1.05, z + 0.01], { shadow: false });
    const zi = z < zc ? z + 0.22 : z - 0.22;
    b.boxMM(mat.blackIn, [x0, floor + 0.001, Math.min(z, zi)], [xe, floor + 0.004, Math.max(z, zi)], { shadow: false });
    for (let x = x0 + 0.05; x < xe; x += 0.11) b.boxMM(mat.steelIn, [x, floor + 0.004, Math.min(z, zi)], [x + 0.03, floor + 0.012, Math.max(z, zi)], { shadow: false });
  }
  // 手すり（両側の壁。高さ 0.85 m の管と、1.8 m おきの受け）
  for (const z of [z0 + 0.09, z1 - 0.09]) {
    const xe = z > zc ? xs - 0.2 : x1 - 0.2;
    b.cyl(mat.steelIn, [(x0 + xe) / 2, floor + 0.85, z], 0.022, xe - x0, { axis: 'x', segments: 8, shadow: false });
    for (let x = x0 + 0.6; x < xe; x += 1.8) b.box(mat.steelIn, [x, floor + 0.8, z + (z < zc ? -0.04 : 0.04)], [0.04, 0.1, 0.08], { shadow: false });
  }
  // 伸縮目地（7.5 m おき。壁・天井・床の暗い筋）
  for (let x = x1 - 4; x > x0 + 1; x -= 7.5) {
    for (const z of [z0 + 0.003, z1 - 0.003]) if (z < zc || x < xs) b.boxMM(mat.trimTun, [x - 0.03, floor, z - 0.004], [x + 0.03, ceil, z + 0.004], { shadow: false });
    b.boxMM(mat.trimTun, [x - 0.03, ceil - 0.005, z0], [x + 0.03, ceil, z1], { shadow: false });
    b.boxMM(mat.trimTun, [x - 0.03, floor, z0 + 0.22], [x + 0.03, floor + 0.003, z1 - 0.22], { shadow: false });
  }
  // 天井の配線の棚（北の壁際）と、南の壁の上の管
  b.boxMM(mat.housingIn, [x0, ceil - 0.28, z0 + 0.12], [x1, ceil - 0.24, z0 + 0.52], { shadow: false });
  for (const [dz, r] of [[0.2, 0.03], [0.3, 0.025], [0.42, 0.035]] as const) b.cyl(mat.blackIn, [(x0 + x1) / 2, ceil - 0.24 + r, z0 + dz], r, x1 - x0, { axis: 'x', segments: 6, shadow: false });
  for (let x = x0 + 0.8; x < x1; x += 1.6) b.box(mat.steelIn, [x, ceil - 0.12, z0 + 0.5], [0.03, 0.24, 0.03], { shadow: false });
  b.cyl(mat.steelIn, [(x0 + xs) / 2, ceil - 0.12, z1 - 0.1], 0.04, xs - x0, { axis: 'x', segments: 8, shadow: false });
  // 天井の蛍光灯（4 m おき、2 本組）と光だまり
  for (let x = x1 - 2; x > x0; x -= 4) fixture(b, mat, addTube, x, ceil, zc + 0.15, 'z', box, 1.35, 3.6);
  // 駅舎の階段の下の口の上（階段から見下ろす正面）: タイル張りの下がり壁と、光る案内（のりば →）・下の器具
  b.boxMM(mat.tileTun, [x0 - 0.06, ceil, z0], [x0 + 0.06, -0.04, z1], { shadow: false });
  b.mesh(signGeo('arrowA', [2.3, 0.34, 0.04]), mat.signGlowIn, [x0 - 0.09, -0.42, zc], { rotY: -Math.PI / 2, shadow: false, layer: 1 });
  b.box(mat.housingIn, [x0 - 0.08, -0.42, zc], [0.04, 0.42, 2.42], { shadow: false });
  // 内照式の広告（明るい板。階段を下りる正面の光る開口）
  b.mesh(signGeo('ad', [1.4, 0.82, 0.04]), mat.signBright, [x0 - 0.09, -1.1, zc], { rotY: -Math.PI / 2, shadow: false, layer: 1 });
  b.box(mat.housingIn, [x0 - 0.08, -1.1, zc], [0.04, 0.9, 1.5], { shadow: false });
  fixture(b, mat, addTube, x0 + 0.6, ceil, zc, 'z', [BSTAIR.xTop - 0.2, floor - 0.1, z0 - 0.05, x0 + 4, 0.2, z1 + 0.05], 1.5, 4.5);
  // A の階段の上（ホームの明るさ）と、駅舎の階段の下の口
  addPool({ kind: 0, c: [0, -0.5, 8.0], axis: [0, 0, 1], half: 3.0, radius: 7.0, color: scale(WIN_COL, 1.3), box: [-ASTAIR.half - 0.2, floor - 0.1, z1 - 0.1, ASTAIR.half + 0.2, 1.5, ASTAIR.zTop + 0.1] });
  addPool({ kind: 0, c: [0, -0.8, 8.5], axis: [0, 0, 1], half: 2.5, radius: 9.0, color: scale(WIN_COL, 0.7), box });

  // 吊り下げの案内（地下道の向きに直角。西から来る人へ「のりば →」、東から来る人へ「← 改札口」）
  for (const x of [-34, -18]) {
    b.mesh(signGeo('arrowA', [1.8, 0.3, 0.04]), mat.signUnlitTun, [x - 0.03, ceil - 0.25, zc], { shadow: false, rotY: Math.PI / 2, layer: 1 });
    b.mesh(signGeo('arrowGate', [1.8, 0.3, 0.04]), mat.signUnlitTun, [x + 0.03, ceil - 0.25, zc], { shadow: false, rotY: -Math.PI / 2, layer: 1 });
    for (const dz of [-0.7, 0.7]) b.box(mat.steelIn, [x, ceil - 0.05, zc + dz], [0.02, 0.12, 0.02]);
  }
  // 掲示物（北の壁、額入り）と内照式の広告（南の壁）
  for (const x of [-38, -26, -10]) framed(b, mat, 'posters', [x, floor + 1.6, z0 + 0.02], 2.2, 0.8, 'z');
  for (const x of [-31, -14.5]) framed(b, mat, 'ad', [x, floor + 1.55, z1 - 0.02], 0.9, 1.2, '-z', true);
  framed(b, mat, 'map', [-22, floor + 1.55, z1 - 0.02], 1.2, 0.9, '-z');
  // 点字ブロック（北の壁沿い、A の階段の下で南へ折れる）
  tactile(b, mat, x0 + 0.2, z0 + 0.6, -0.3, z0 + 0.9, floor, 'both');
  tactile(b, mat, -0.3, z0 + 0.9, 0.0, z1 + 0.5, floor, 'end');

  // ---------- A の階段（南が上り口。地下道の東の端の踊り場から南へ上がる） ----------
  const zStart = ASTAIR.zTop - 25 * 0.28;
  stairs(b, mat.concreteIn, [0, floor, zStart], '+z', 0 - floor, ASTAIR.half * 2);
  for (let i = 0; i < 25; i++) {
    const z = zStart + i * 0.28 + 0.03;
    const y = floor + ((i + 1) * (0 - floor)) / 25;
    b.box(mat.yellowPaint, [0, y + 0.003, z], [ASTAIR.half * 2 - 0.1, 0.006, 0.05], { shadow: false });
  }
  // 階段の手すり（両側の壁に斜めの管）
  for (const s of [-1, 1]) {
    const x = s * (ASTAIR.half - 0.06);
    const za = zStart;
    const zb = ASTAIR.zTop;
    const ya = floor + 0.85;
    const yb = 0.85;
    const len = Math.hypot(zb - za, yb - ya);
    const g = new THREE.CylinderGeometry(0.025, 0.025, len, 8);
    g.rotateX(Math.PI / 2 - Math.atan2(yb - ya, zb - za));
    b.mesh(g, mat.steelIn, [x, (ya + yb) / 2, (za + zb) / 2], { shadow: false });
  }
  // 階段室の壁（A の床より下はタイル、上は腰壁）。北の端は地下道の天井から上
  for (const s of [-1, 1]) {
    const xa = s * ASTAIR.half;
    const xb = s * (ASTAIR.half + 0.15);
    b.boxMM(mat.tileTun, [Math.min(xa, xb), floor, ASTAIR.zBot], [Math.max(xa, xb), 0, ASTAIR.zTop], { collide: true });
    b.boxMM(mat.coping, [Math.min(xa, xb), 0, ASTAIR.zBot], [Math.max(xa, xb), 1.05, ASTAIR.zTop], { collide: true });
    b.boxMM(mat.steel, [Math.min(xa, xb) - 0.02, 1.05, ASTAIR.zBot], [Math.max(xa, xb) + 0.02, 1.1, ASTAIR.zTop]);
  }
  b.boxMM(mat.tileTun, [-ASTAIR.half - 0.15, ceil, ASTAIR.zBot - 0.15], [ASTAIR.half + 0.15, 0, ASTAIR.zBot], { collide: true });
  b.boxMM(mat.coping, [-ASTAIR.half - 0.15, 0, ASTAIR.zBot - 0.15], [ASTAIR.half + 0.15, 1.05, ASTAIR.zBot], { collide: true });
  // 階段の上の案内（大屋根の梁から吊る。「改札口・出口」）
  b.mesh(signGeo('exit', [2.2, 0.36, 0.05]), mat.signUnlit, [0, 3.2, ASTAIR.zTop - 0.3], { shadow: false });
  for (const s of [-1, 1]) b.box(mat.steel, [s * 0.9, 3.85, ASTAIR.zTop - 0.3], [0.02, 0.95, 0.02]);
}
