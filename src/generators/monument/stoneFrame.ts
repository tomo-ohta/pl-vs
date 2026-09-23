/**
 * モニュメントの文法: stoneFrame（石の枢組み）。
 * 大理石の基壇に柱を立てて梁を渡し、その上へ「口の字の枢」「円環（鏡面球入り）」「行き先の無い階段」「浮く立方体」を積む。
 * 狙いは「何かの記念碑に見えるのに、何を記念しているのか・どう成立しているのか分からない」状態。
 * 枢 1 枚と円環 1 個は真下に何も無い位置に浮き、階段は上端の先が空（1 本は上下逆に吊る）。
 *
 * 寸法はすべて o.height（縦）と o.radius（横）から比で決める。仕様書の絶対値（枢 h 2〜4 m など）は屋外の値で、
 * 屋内（H 2.3〜5 m）ではそのままだと天井を抜けるため、上限としてだけ使い実際は H の比で縮める。
 * 歪み o.distort は「傾きの角度」「浮きの距離」「位置と寸法のばらつき」に比例して効かせる。
 *
 * 注意（統合への申し送り）: THREE.TorusGeometry は XY 平面に乗るので ring は無回転で既に「立っている」。
 * 仕様書の「rot pitch 90° で立てる」を素直に入れると逆に寝てしまうため、ここでは無回転 + yaw / 微小な roll で扱う。
 */
import type { Rng } from '../../core/rng';
import type { Vec3 } from '../../core/types';
import type { Box, MatId } from '../layout';
import type { MonumentBuild, MonumentOptions, MonumentPart, MonumentSign } from './types';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** 当たり判定の箱（layout.box と同じ形を自前で作る） */
function aabb(min: Vec3, max: Vec3, mat: MatId): Box {
  return {
    min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])],
    max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])],
    mat,
    solid: true,
  };
}

/**
 * 水平の半寸（index.ts の partBounds と同じ近似: 回転があれば最大辺で丸める）。
 * 足跡の判定はこの近似で行われるので、こちらも同じ規則で内側へ寄せる。
 */
function halfXZ(p: MonumentPart): [number, number] {
  const [a, b, c] = p.size;
  let hx = 0.1, hy = 0.1, hz = 0.1;
  switch (p.prim) {
    case 'box': case 'plate': hx = a / 2; hy = b / 2; hz = (c || 0.03) / 2; break;
    case 'cylinder': hx = hz = Math.max(a, c ?? 0); hy = b / 2; break;
    case 'sphere': hx = hy = hz = a; break;
    case 'ring': hx = hy = a + b; hz = b; break;
    case 'stairs': case 'frame': hx = a / 2; hy = b / 2; hz = c / 2; break;
    default: break;
  }
  if (p.rot && (Math.abs(p.rot[0]) > 0.01 || Math.abs(p.rot[2]) > 0.01)) { const m = Math.max(hx, hy, hz); return [m, m]; }
  if (p.rot && Math.abs(p.rot[1]) > 0.01) { const m = Math.max(hx, hz); return [m, m]; }
  return [hx, hz];
}

/** 足跡の最終調整: はみ出す部品を内側へ寄せる */
function fitFootprint(parts: MonumentPart[], rmax: number): void {
  for (const p of parts) {
    const [hx, hz] = halfXZ(p);
    p.pos[0] = hx >= rmax ? 0 : clamp(p.pos[0], -(rmax - hx), rmax - hx);
    p.pos[2] = hz >= rmax ? 0 : clamp(p.pos[2], -(rmax - hz), rmax - hz);
  }
}

const SIGN_TEXTS = [
  'A HIGHER CIRCLE',
  'STILL WE RISE',
  'FOR A BRIGHTER',
  'NOTHING BEYOND',
  'THE OPEN HOUR',
  'TO THOSE WHO WAIT',
];

/**
 * 基壇の足跡の外へ出せる位置（真下に何も無い所）を探す。
 * halfX / halfZ は置きたい物の半寸。置けなければ null（呼び出し側は梁の上に逃がす）。
 */
function outsideSpot(rng: Rng, baseW: number, baseD: number, rmax: number, halfX: number, halfZ: number, d: number): [number, number] | null {
  const gap = 0.08 + 0.35 * d;
  const tries: Array<[number, number]> = [];
  // ±Z（正面 / 背面）へ逃がす: 枢を yaw 0 で置くと Z 方向が薄いので入りやすい
  if (baseD / 2 + halfZ * 2 + gap <= rmax) {
    const z = (rng.chance(0.5) ? 1 : -1) * clamp(baseD / 2 + halfZ + gap, 0, rmax - halfZ);
    tries.push([rng.float(-1, 1) * Math.max(0, baseW / 2 - halfX), z]);
  }
  // ±X（左右）へ逃がす
  if (baseW / 2 + halfX * 2 + gap <= rmax) {
    const x = (rng.chance(0.5) ? 1 : -1) * clamp(baseW / 2 + halfX + gap, 0, rmax - halfX);
    tries.push([x, rng.float(-1, 1) * Math.max(0, baseD / 2 - halfZ)]);
  }
  if (!tries.length) return null;
  return tries[rng.int(0, tries.length - 1)];
}

export function buildStoneFrame(rng: Rng, o: MonumentOptions): MonumentBuild {
  const parts: MonumentPart[] = [];
  const colliders: Box[] = [];
  const signs: MonumentSign[] = [];

  const H = Math.max(1.8, o.height);
  const R = Math.max(0.6, o.radius);
  const RMAX = R * 1.1;                                  // 足跡の上限（許容 o.radius × 1.2 に余裕を持たせる）
  const d = clamp(o.distort, 0, 1);
  const big = o.outdoor ? clamp(H / 7, 1, 2.2) : 1;      // 屋外は部材を太く
  const stoneMat: MatId = rng.chance(0.65) ? 'marbleWhite' : 'columnConcrete';

  // ---- 基壇 ----
  const baseW = clamp(2 * R * rng.float(0.5, 0.9), 0.9, 2 * RMAX * 0.92);
  const baseD = clamp(baseW * rng.float(0.7, 1.0), 0.8, 2 * RMAX * 0.92);
  const baseH = clamp(H * 0.07, 0.25, 0.5);
  const plinthH = clamp(baseH * 0.5, 0.12, 0.3);
  const deckY = baseH + plinthH;                          // 柱が立つ面
  parts.push({ prim: 'box', mat: 'marbleFloor', pos: [0, baseH / 2, 0], size: [baseW, baseH, baseD] });
  parts.push({ prim: 'box', mat: stoneMat, pos: [0, baseH + plinthH / 2, 0], size: [baseW * 0.82, plinthH, baseD * 0.82] });
  colliders.push(aabb([-baseW / 2, 0, -baseD / 2], [baseW / 2, deckY, baseD / 2], 'marbleFloor'));

  // ---- 屋外は基壇の手前（−Z）に階段 ----
  if (o.outdoor) {
    const sw = baseW * 0.6;
    const sd = clamp(rng.float(1.2, 2.0), 0.6, RMAX - baseD / 2 - 0.05);
    if (sd >= 0.55) {
      const sz = -baseD / 2 - sd / 2;
      parts.push({ prim: 'stairs', mat: 'marbleFloor', pos: [0, 0, sz], size: [sw, deckY, sd] });
      colliders.push(aabb([-sw / 2, 0, sz - sd / 2], [sw / 2, deckY, sz + sd / 2], 'marbleFloor'));
    }
  }

  // ---- 柱 ----
  const nCol = rng.int(2, 4);
  const colS = clamp(rng.float(0.5, 0.9) * big, 0.28, (baseW * 0.82) / (nCol + 0.6));
  const colH0 = (H - deckY) * rng.float(0.40, 0.55);
  const spanX = Math.max(0.12, (baseW * 0.82) / 2 - colS * 0.6);
  const tilted = rng.int(0, nCol - 1);
  const colX: number[] = [];
  const colZ: number[] = [];
  const colHs: number[] = [];
  for (let i = 0; i < nCol; i++) {
    const t = nCol === 1 ? 0 : (i / (nCol - 1)) * 2 - 1;
    const x = clamp(t * spanX + rng.float(-0.18, 0.18) * d * spanX, -spanX, spanX);
    const z = clamp(rng.float(-0.22, 0.22) * baseD * (0.3 + 0.7 * d), -baseD * 0.28, baseD * 0.28);
    const h = colH0 * (1 + rng.float(-0.10, 0.10) * d);
    const roll = i === tilted ? (rng.chance(0.5) ? 1 : -1) * (3 + 5 * d) * (Math.PI / 180) : 0;
    colX.push(x); colZ.push(z); colHs.push(h);
    parts.push({
      prim: 'box', mat: i % 2 === 0 ? stoneMat : (stoneMat === 'marbleWhite' ? 'columnConcrete' : 'marbleWhite'),
      pos: [x, deckY + h / 2, z], size: [colS, h, colS * rng.float(0.9, 1.1)],
      ...(roll ? { rot: [0, 0, roll] as Vec3 } : {}),
    });
    // 柱頭（梁との間の小さな受け）
    parts.push({ prim: 'box', mat: stoneMat, pos: [x, deckY + h + 0.045, z], size: [colS * 1.25, 0.09, colS * 1.25] });
    const cw = colS * 0.7 + Math.abs(roll) * h;
    colliders.push(aabb([x - cw, 0, z - cw], [x + cw, deckY + h, z + cw], 'columnConcrete'));
  }

  // ---- 梁 ----
  const colTop = deckY + Math.max(...colHs);
  const beamH = clamp(H * 0.055 * big, 0.18, 0.5);
  const xMin = Math.min(...colX) - colS / 2, xMax = Math.max(...colX) + colS / 2;
  const over = rng.float(0.1, 0.5) * big * (0.4 + 0.6 * d);      // 片側だけ持ち出す（歪み）
  const beamX0 = clamp(xMin - (rng.chance(0.5) ? over : 0), -RMAX, RMAX);
  const beamX1 = clamp(xMax + (rng.chance(0.5) ? over : 0), -RMAX, RMAX);
  const beamW = Math.max(0.4, beamX1 - beamX0);
  const beamCx = (beamX0 + beamX1) / 2;
  const beamCz = colZ.reduce((a, b) => a + b, 0) / nCol;
  const beamD = clamp(colS * rng.float(1.0, 1.5), 0.2, baseD * 0.8);
  parts.push({ prim: 'box', mat: stoneMat, pos: [beamCx, colTop + beamH / 2, beamCz], size: [beamW, beamH, beamD] });
  const beamTop = colTop + beamH;
  // 梁の上に走る細い桁（直交方向。何も支えていない）
  const girderD = clamp(baseD * rng.float(0.5, 0.9), 0.3, 2 * RMAX * 0.85);
  parts.push({
    prim: 'box', mat: stoneMat,
    pos: [clamp(beamCx + rng.float(-0.3, 0.3) * beamW * 0.5 * d, -RMAX, RMAX), beamTop + beamH * 0.3, beamCz],
    size: [beamD * 0.8, beamH * 0.6, girderD],
  });

  // ---- 口の字の枢 ----
  const YAWS: number[] = [0, Math.PI / 2, Math.PI / 6];
  const headroom = Math.max(0.35, H * 0.95 - beamTop);
  const nFrame = rng.int(1, 3);
  const floatFrame = nFrame === 1 ? rng.chance(0.45) : rng.int(1, nFrame - 1); // どの枚を浮かせるか（1 のときは確率で）
  for (let i = 0; i < nFrame; i++) {
    const isFloat = typeof floatFrame === 'boolean' ? floatFrame : i === floatFrame;
    const fh = clamp(headroom * rng.float(0.7, 1.0) * (isFloat ? rng.float(0.6, 0.95) : 1), 0.4, 4);
    const fw = clamp(fh * rng.float(0.65, 1.05), 0.35, Math.min(3, 2 * RMAX * 0.8));
    const bar = clamp(Math.min(fw, fh) * 0.16, 0.08, 0.4);
    const yaw = YAWS[rng.int(0, 2)] * (rng.chance(0.5) ? 1 : -1);
    // yaw で X / Z の張り出しが入れ替わる
    const ex = Math.abs(Math.cos(yaw)) * fw / 2 + Math.abs(Math.sin(yaw)) * bar / 2;
    const ez = Math.abs(Math.sin(yaw)) * fw / 2 + Math.abs(Math.cos(yaw)) * bar / 2;
    let fx: number, fy: number, fz: number;
    if (isFloat) {
      const spot = outsideSpot(rng, baseW, baseD, RMAX, ex, ez, d);
      if (spot) {
        fx = spot[0]; fz = spot[1];
        fy = clamp(beamTop * rng.float(0.55, 0.95) + rng.float(0, 0.5) * d, fh / 2 + 0.4, H * 0.95 - fh / 2);
      } else {
        // 逃がす余地が無ければ梁の上に浮かせる（間を空けるだけ）
        fx = beamCx + rng.float(-0.3, 0.3) * beamW * 0.4;
        fz = beamCz + rng.float(-0.4, 0.4) * (0.2 + 0.6 * d);
        fy = clamp(beamTop + (0.15 + 0.5 * d) + fh / 2, 0, H * 0.96 - fh / 2);
      }
    } else {
      fx = clamp(beamCx + rng.float(-0.35, 0.35) * beamW * 0.5 * (0.3 + 0.7 * d), -(RMAX - ex), RMAX - ex);
      fz = clamp(beamCz + rng.float(-0.25, 0.25) * beamD * d, -(RMAX - ez), RMAX - ez);
      fy = beamTop + fh / 2;
    }
    fx = clamp(fx, -(RMAX - ex), RMAX - ex);
    fz = clamp(fz, -(RMAX - ez), RMAX - ez);
    parts.push({ prim: 'frame', mat: i === 0 ? stoneMat : (rng.chance(0.4) ? 'columnConcrete' : 'marbleWhite'), pos: [fx, fy, fz], size: [fw, fh, bar], rot: [0, yaw, 0] });
    if (isFloat && rng.chance(0.7)) {
      // 浮いた枢から下へ細い吊り棒（何にも留まっていない）
      const len = clamp(fy - fh / 2 - deckY, 0.2, H * 0.4);
      parts.push({ prim: 'cylinder', mat: 'metalDark', pos: [fx, fy - fh / 2 - len / 2, fz], size: [rng.float(0.02, 0.04), len, rng.float(0.02, 0.04)] });
    }
  }

  // ---- 円環（+ 鏡面球） ----
  const ringMats: MatId[] = ['marbleWhite', 'stainless', 'metal'];
  const nRing = rng.int(1, 2);
  const ringMaxR = Math.min(RMAX * 0.72, Math.max(0.22, (H * 0.95 - colTop) / 1.6));
  const r0 = clamp(H * rng.float(0.15, 0.28), 0.22, ringMaxR);
  for (let i = 0; i < nRing; i++) {
    const outerR = i === 0 ? r0 : clamp(r0 * rng.float(0.5, 0.85), 0.18, ringMaxR);
    const tubeR = clamp(outerR * rng.float(0.10, 0.17), 0.07, 0.3);
    const half = outerR + tubeR;
    let cx: number, cy: number, cz: number;
    if (i === 0) {
      // 1 個目: 中心を柱の上に（柱が円環を貫く）
      const k = rng.int(0, nCol - 1);
      cx = clamp(colX[k], -(RMAX - half), RMAX - half);
      cz = clamp(colZ[k], -(RMAX - tubeR), RMAX - tubeR);
      cy = clamp(deckY + colHs[k] + outerR * rng.float(0.1, 0.5), half + 0.2, H * 0.96 - half);
    } else {
      // 2 個目: どこにも触れずに浮く
      const spot = outsideSpot(rng, baseW, baseD, RMAX, half, tubeR, d);
      cx = spot ? clamp(spot[0], -(RMAX - half), RMAX - half) : clamp(beamCx + beamW * 0.45, -(RMAX - half), RMAX - half);
      cz = spot ? clamp(spot[1], -(RMAX - tubeR), RMAX - tubeR) : clamp(beamCz + rng.float(-0.5, 0.5), -(RMAX - tubeR), RMAX - tubeR);
      cy = clamp(H * rng.float(0.35, 0.62) + rng.float(0, 0.4) * d, half + 0.3, H * 0.94 - half);
    }
    const tilt = rng.float(-0.10, 0.10) * d;
    parts.push({ prim: 'ring', mat: ringMats[rng.int(0, 2)], pos: [cx, cy, cz], size: [outerR, tubeR, 0], rot: [0, rng.float(-0.25, 0.25) * d, tilt] });
    if (i === 0 && rng.chance(0.5)) {
      parts.push({ prim: 'sphere', mat: 'stainless', pos: [cx, cy, cz], size: [outerR * rng.float(0.35, 0.5), 0.1, 0.1] });
    }
  }

  // ---- 行き先の無い階段 ----
  const nStair = rng.int(1, 2);
  for (let i = 0; i < nStair; i++) {
    const flipped = i > 0 && rng.chance(0.3);
    const sw = clamp(rng.float(0.8, 1.4) * big, 0.45, RMAX * 0.9);
    const sd = clamp(rng.float(1.1, 1.6) * sw * 1.4, 0.55, RMAX * 1.1);
    if (flipped) {
      // 上下逆に吊るした階段（上から下へ降りて、途中で終わる）
      const sh = clamp(H * rng.float(0.18, 0.26), 0.4, 3);
      const y = clamp(H * rng.float(0.50, 0.62), sh + 0.35, H * 0.72);
      const x = clamp(beamCx + (rng.chance(0.5) ? 1 : -1) * rng.float(0.3, 0.8) * baseW * 0.5, -(RMAX - sw / 2), RMAX - sw / 2);
      const z = clamp(beamCz + rng.float(-0.5, 0.5) * baseD * 0.5, -(RMAX - sd / 2), RMAX - sd / 2);
      parts.push({ prim: 'stairs', mat: stoneMat, pos: [x, y, z], size: [sw, sh, sd], rot: [0, rng.float(-0.4, 0.4) * d, Math.PI] });
      if (y - sh < 2.2) colliders.push(aabb([x - sw / 2, Math.max(0, y - sh), z - sd / 2], [x + sw / 2, y, z + sd / 2], 'columnConcrete'));
    } else {
      // 梁の上から立ち上がり、上端の先には何も無い
      const sh = clamp(Math.min(H * rng.float(0.22, 0.34), H * 0.95 - beamTop), 0.4, 3);
      const x = clamp(beamCx + rng.float(-0.4, 0.4) * beamW * 0.5, -(RMAX - sw / 2), RMAX - sw / 2);
      const z = clamp(beamCz + rng.float(-0.3, 0.3) * baseD * 0.4, -(RMAX - sd / 2), RMAX - sd / 2);
      parts.push({ prim: 'stairs', mat: stoneMat, pos: [x, beamTop, z], size: [sw, sh, sd], rot: [0, rng.float(-0.5, 0.5) * d, 0] });
      if (beamTop < 2.2) colliders.push(aabb([x - sw / 2, beamTop, z - sd / 2], [x + sw / 2, beamTop + sh, z + sd / 2], 'columnConcrete'));
    }
  }

  // ---- 浮く立方体（細い棒 1 本で上下の部品につながる） ----
  const nCube = rng.int(1, 3);
  for (let i = 0; i < nCube; i++) {
    const cs = clamp(H * rng.float(0.10, 0.16) * big, 0.35, Math.min(1.4 * big, RMAX * 0.7));
    // 1 個目は頂部（ここが全体の最高点になる）
    const top = i === 0 ? H * rng.float(0.965, 1.0) : H * rng.float(0.6, 0.85);
    const cy = top - cs / 2;
    const cx = clamp(beamCx + rng.float(-0.5, 0.5) * (baseW * 0.35) * (0.4 + 0.6 * d), -(RMAX - cs * 0.71), RMAX - cs * 0.71);
    const cz = clamp(beamCz + rng.float(-0.5, 0.5) * (baseD * 0.35) * (0.4 + 0.6 * d), -(RMAX - cs * 0.71), RMAX - cs * 0.71);
    parts.push({
      prim: 'box', mat: rng.chance(0.5) ? 'columnConcrete' : 'stainless', pos: [cx, cy, cz], size: [cs, cs, cs],
      rot: [0, rng.float(-0.35, 0.35) * d, 0],
    });
    // 吊り / 支柱（1 本だけ）
    const down = rng.chance(0.6);
    const anchor = down ? Math.max(beamTop, deckY) : Math.min(H * 0.99, cy + cs / 2 + rng.float(0.3, 0.9));
    const len = Math.abs(cy - cs / 2 - anchor) || 0.2;
    const midY = down ? (anchor + cy - cs / 2) / 2 : (cy + cs / 2 + anchor) / 2;
    if (len > 0.12) {
      parts.push({ prim: 'cylinder', mat: 'metalDark', pos: [cx, midY, cz], size: [rng.float(0.02, 0.04), len, rng.float(0.02, 0.04)] });
    }
  }

  // ---- 刻印 ----
  const signY = clamp(colTop - 0.35, 0.5, 1.6);
  const signW = Math.min(0.5, colS * 0.95);
  const text = SIGN_TEXTS[rng.int(0, SIGN_TEXTS.length - 1)];
  signs.push({ text, pos: [colX[0], signY, colZ[0] - colS / 2 - 0.03], face: 0, width: signW, color: 0x3a3630, background: 0xdedad2 });
  if (o.outdoor) {
    const k = nCol - 1;
    signs.push({
      text: SIGN_TEXTS[rng.int(0, SIGN_TEXTS.length - 1)],
      pos: [colX[k] + colS / 2 + 0.03, signY, colZ[k]], face: 1, width: signW, color: 0x3a3630, background: 0xdedad2,
    });
  }

  // ---- 細部（部品数を 20 以上にする小さな石塊。基壇の縁と梁の上） ----
  let guard = 0;
  while (parts.length < 24 && guard++ < 40) {
    const onBeam = rng.chance(0.45);
    const bs = clamp(rng.float(0.12, 0.30) * big, 0.1, 0.5);
    if (onBeam) {
      const x = clamp(beamCx + rng.float(-0.5, 0.5) * beamW, -(RMAX - bs), RMAX - bs);
      parts.push({ prim: 'box', mat: stoneMat, pos: [x, beamTop + bs / 2, clamp(beamCz + rng.float(-0.3, 0.3) * beamD, -(RMAX - bs), RMAX - bs)], size: [bs, bs, bs * rng.float(0.8, 1.4)] });
    } else {
      const side = rng.chance(0.5);
      const x = side ? (rng.chance(0.5) ? 1 : -1) * (baseW * 0.41 - bs / 2) : rng.float(-1, 1) * (baseW * 0.35);
      const z = side ? rng.float(-1, 1) * (baseD * 0.35) : (rng.chance(0.5) ? 1 : -1) * (baseD * 0.41 - bs / 2);
      parts.push({ prim: 'box', mat: rng.chance(0.5) ? 'marbleFloor' : stoneMat, pos: [clamp(x, -(RMAX - bs), RMAX - bs), deckY + bs / 2, clamp(z, -(RMAX - bs), RMAX - bs)], size: [bs, bs, bs] });
    }
  }

  fitFootprint(parts, RMAX);
  return { parts, colliders, signs };
}
