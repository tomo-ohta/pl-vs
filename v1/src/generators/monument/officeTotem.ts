/**
 * モニュメントの文法: officeTotem（事務トーテム）。
 * 太い柱に「引き出し・椀子・電話機・小箱」が寄生し、パイプが縦に走る塔。
 * 座標はモニュメント・ローカル（基壇中心 = 原点、y 上、正面 = −Z）。
 * 寸法は S（= 高さと足跡半径から決まる全体倍率）でまとめて拡縮するので、屋内 2.3 m でも屋外 15 m でも
 * 部品数・比率は変わらず、足跡は必ず o.radius の内側に収まる。
 */
import type { Rng } from '../../core/rng';
import type { Vec3 } from '../../core/types';
import type { Box, MatId } from '../layout';
import type { MonumentBuild, MonumentOptions, MonumentPart, MonumentPrim, MonumentSign } from './types';

const DEG = Math.PI / 180;

/** 取り付ける 4 方向（外向きの単位ベクトル）と、その方向へ部品のローカル −Z を向ける yaw */
const DIRS: Vec3[] = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
const DIR_YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

const WORDS = ['SIT', 'FILE', 'CALL', 'WAIT', 'REPEAT', 'FORM', 'QUEUE', 'HOLD', 'RETURN', 'SIGN'];

function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }

/** Euler(YXZ) = Ry·Rx·Rz をベクトルへ適用（描画側 MonumentGeometry.ts と同じ合成順） */
function rotV(rot: Vec3, v: Vec3): Vec3 {
  let [x, y, z] = v;
  let c = Math.cos(rot[2]), s = Math.sin(rot[2]);
  const x1 = x * c - y * s, y1 = x * s + y * c; x = x1; y = y1;
  c = Math.cos(rot[0]); s = Math.sin(rot[0]);
  const y2 = y * c - z * s, z2 = y * s + z * c; y = y2; z = z2;
  c = Math.cos(rot[1]); s = Math.sin(rot[1]);
  const x3 = x * c + z * s, z3 = -x * s + z * c; x = x3; z = z3;
  return [x, y, z];
}

interface Bnd { min: Vec3; max: Vec3 }

function newBnd(): Bnd { return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; }

/**
 * 部品の外接箱（回転を実際に掛けた正確な近似）。
 * index.ts の partBounds は傾いた部品を「最大辺の立方体」に膨らませるので、傾いた柱では当たり判定が巨大になる。
 * ここでは colliders を自分で返すため、回転後の頂点から締まった箱を作る。
 */
function partBox(p: MonumentPart): Bnd {
  const rot: Vec3 = p.rot ?? [0, 0, 0];
  const [a, b, c] = p.size;
  const mn: Vec3 = [Infinity, Infinity, Infinity], mx: Vec3 = [-Infinity, -Infinity, -Infinity];
  const acc = (v: Vec3, pad: number): void => {
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k] - pad); mx[k] = Math.max(mx[k], v[k] + pad); }
  };
  const world = (off: Vec3): Vec3 => { const w = rotV(rot, off); return [p.pos[0] + w[0], p.pos[1] + w[1], p.pos[2] + w[2]]; };
  switch (p.prim) {
    case 'box': case 'plate': {
      const hx = a / 2, hy = b / 2, hz = (c || 0.03) / 2;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) acc(world([sx * hx, sy * hy, sz * hz]), 0);
      break;
    }
    case 'cylinder': {
      const r = Math.max(a, c ?? a);
      acc(world([0, -b / 2, 0]), r);
      acc(world([0, b / 2, 0]), r);
      break;
    }
    case 'ribbon': case 'tube': {
      const pad = Math.max(a, b || 0);
      for (const q of p.path ?? []) acc(world(q), pad);
      break;
    }
    default:
      acc(p.pos, Math.max(a, b, c || 0) / 2);
      break;
  }
  if (!isFinite(mn[0])) return { min: [p.pos[0], p.pos[1], p.pos[2]], max: [p.pos[0], p.pos[1], p.pos[2]] };
  return { min: mn, max: mx };
}

/** 当たり判定の箱を max 個まで減らす（重なりが少ない順に union）。配置側の箱予算を食い潰さないため */
function reduceBoxes(list: Box[], max: number): Box[] {
  const out = list.slice();
  const vol = (b: Box): number => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
  while (out.length > max) {
    let bi = 0, bj = 1, best = Infinity;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const u: Box = {
        min: [Math.min(out[i].min[0], out[j].min[0]), Math.min(out[i].min[1], out[j].min[1]), Math.min(out[i].min[2], out[j].min[2])],
        max: [Math.max(out[i].max[0], out[j].max[0]), Math.max(out[i].max[1], out[j].max[1]), Math.max(out[i].max[2], out[j].max[2])],
        mat: 'void' as MatId, solid: true,
      };
      const cost = vol(u) - vol(out[i]) - vol(out[j]);
      if (cost < best) { best = cost; bi = i; bj = j; }
    }
    const u: Box = {
      min: [Math.min(out[bi].min[0], out[bj].min[0]), Math.min(out[bi].min[1], out[bj].min[1]), Math.min(out[bi].min[2], out[bj].min[2])],
      max: [Math.max(out[bi].max[0], out[bj].max[0]), Math.max(out[bi].max[1], out[bj].max[1]), Math.max(out[bi].max[2], out[bj].max[2])],
      mat: 'void' as MatId, solid: true,
    };
    out.splice(bj, 1); out.splice(bi, 1); out.push(u);
  }
  return out;
}

function mergeBnd(b: Bnd, q: Bnd): void {
  for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], q.min[k]); b.max[k] = Math.max(b.max[k], q.max[k]); }
}

/** 床から 2.4 m までに切り詰めた当たり判定の箱（頭上は通す） */
function toBox(b: Bnd): Box {
  return {
    min: [b.min[0], Math.max(0, b.min[1]), b.min[2]],
    max: [b.max[0], Math.min(b.max[1], 2.4), b.max[2]],
    mat: 'void' as MatId, solid: true,
  };
}

/** 取り付け部品の 1 片（取り付け点から見たローカル座標。−Z が外向き） */
interface Piece { prim: MonumentPrim; mat: MatId; off: Vec3; size: Vec3 }

export function buildOfficeTotem(rng: Rng, o: MonumentOptions): MonumentBuild {
  const parts: MonumentPart[] = [];
  const signs: MonumentSign[] = [];
  const colliders: Box[] = [];

  // 全体倍率: 高さ 3 m・足跡半径 1.1 m を 1.0 とする。足跡はこの S から必ず radius 内に収まる
  const S = clamp(Math.min(o.height / 3.0, o.radius / 1.1), 0.55, 3);
  const reach = o.radius * 0.97;

  // ── 基壇 ──
  const baseH = 0.12 * S;
  const baseW = Math.min(1.6 * S, o.radius * 1.5);
  const basePart: MonumentPart = { prim: 'box', mat: 'floorConcrete', pos: [0, baseH / 2, 0], size: [baseW, baseH, baseW] };
  parts.push(basePart);
  colliders.push(toBox(partBox(basePart)));

  // ── 幹（柱）──
  const trunkR = rng.float(0.25, 0.40) * S;
  const topChair = rng.chance(0.4); // 頂部に椀子が横向きで載る
  const colTop = o.height * (topChair ? 0.88 : 0.97);
  const colH = Math.max(0.6, colTop - baseH);
  const colCy = baseH + colH / 2;
  const lean = 2 * DEG * clamp(0.3 + o.distort, 0, 1); // 柱の傾き ±2°
  const colRot: Vec3 = [rng.float(-lean, lean), 0, rng.float(-lean, lean)];
  const colPart: MonumentPart = {
    prim: 'cylinder', mat: rng.chance(0.55) ? 'columnConcrete' : 'metalDark',
    pos: [0, colCy, 0], rot: colRot, size: [trunkR, colH, trunkR * rng.float(0.86, 1)],
  };
  parts.push(colPart);
  colliders.push(toBox(partBox(colPart)));

  /** 高さ y での柱の芯（傾きを反映） */
  const axisAt = (y: number): Vec3 => { const d = rotV(colRot, [0, y - colCy, 0]); return [d[0], colCy + d[1], d[2]]; };
  /** 高さ y・方向 d の取り付け点（柱の表面よりわずかに内側） */
  const anchorAt = (y: number, d: number): Vec3 => {
    const a = axisAt(y), n = DIRS[d];
    return [a[0] + n[0] * trunkR * 0.9, a[1], a[2] + n[2] * trunkR * 0.9];
  };

  const tiltMax = (3 + 8 * o.distort) * DEG; // 部品の傾き ±(3 + 8·distort)°
  const tilt = (): number => rng.float(-tiltMax, tiltMax);
  /** たまに柱を深く貫通させる（歪みが強いほど頻繁） */
  const embedOf = (): number => (rng.chance(0.12 + 0.35 * o.distort) ? rng.float(0.26, 0.40) : rng.float(0.06, 0.14)) * S;

  /** 取り付け点 + 回転で部品群を出し、その外接箱を返す */
  const emit = (anchor: Vec3, rot: Vec3, pieces: Piece[]): Bnd => {
    const b = newBnd();
    for (const p of pieces) {
      const w = rotV(rot, p.off);
      const part: MonumentPart = {
        prim: p.prim, mat: p.mat,
        pos: [anchor[0] + w[0], anchor[1] + w[1], anchor[2] + w[2]],
        rot: [rot[0], rot[1], rot[2]], size: p.size,
      };
      parts.push(part);
      mergeBnd(b, partBox(part));
    }
    return b;
  };
  const placeOf = (anchor: Vec3, rot: Vec3, off: Vec3): Vec3 => {
    const w = rotV(rot, off);
    return [anchor[0] + w[0], anchor[1] + w[1], anchor[2] + w[2]];
  };
  /** 床から 2.2 m 以下に掛かる部品群を当たり判定にする */
  const keep = (b: Bnd): void => { if (isFinite(b.min[0]) && b.min[1] < 2.2) colliders.push(toBox(b)); };

  // ── 引き出し（キャビネット。半数は引き出しが前へ出ている）──
  const addDrawer = (y: number, d: number): void => {
    const rot: Vec3 = [tilt(), DIR_YAW[d], tilt()];
    const anchor = anchorAt(y, d);
    const w = 0.45 * S, h = 0.30 * S, dp = 0.50 * S;
    const embed = embedOf();
    const zc = -(dp / 2 - embed);          // 本体中心（−Z が外）
    const front = zc - dp / 2;             // 前面の z
    const pieces: Piece[] = [{ prim: 'box', mat: 'shelfMetal', off: [0, 0, zc], size: [w, h, dp] }];
    // 前面がどれだけ外へ出られるか（足跡半径の残り）
    const outer = trunkR * 0.9 + (dp - embed);
    const budget = reach - outer;
    if (rng.chance(0.5) && budget > 0.10 * S) {
      const pull = Math.min(rng.float(0.20, 0.40) * S, budget);
      pieces.push({ prim: 'box', mat: 'shelfMetal', off: [0, -0.02 * S, front - pull / 2], size: [w * 0.92, h * 0.66, pull] });
      pieces.push({ prim: 'box', mat: 'metal', off: [0, -0.02 * S, front - pull - 0.012 * S], size: [0.10 * S, 0.02 * S, 0.02 * S] });
    } else {
      pieces.push({ prim: 'box', mat: 'metal', off: [0, 0.03 * S, front - 0.012 * S], size: [0.10 * S, 0.02 * S, 0.02 * S] });
      pieces.push({ prim: 'box', mat: 'metal', off: [0, -0.08 * S, front - 0.012 * S], size: [0.10 * S, 0.02 * S, 0.02 * S] });
    }
    keep(emit(anchor, rot, pieces));
  };

  // ── 椀子（柱の側面に張り付く。たまに上下逆・横向き）──
  const chairPieces = (): Piece[] => {
    const zs = -(0.225 * S - 0.06 * S); // 座の中心 z
    return [
      { prim: 'box', mat: 'upholstery', off: [0, 0, zs], size: [0.45 * S, 0.06 * S, 0.45 * S] },
      { prim: 'box', mat: 'upholstery', off: [0, 0.23 * S, zs + 0.195 * S], size: [0.45 * S, 0.40 * S, 0.06 * S] },
      { prim: 'box', mat: 'metalDark', off: [0.17 * S, -0.19 * S, zs - 0.15 * S], size: [0.05 * S, 0.32 * S, 0.05 * S] },
      { prim: 'box', mat: 'metalDark', off: [-0.17 * S, -0.19 * S, zs - 0.15 * S], size: [0.05 * S, 0.32 * S, 0.05 * S] },
      { prim: 'box', mat: 'metalDark', off: [0, -0.30 * S, zs - 0.15 * S], size: [0.39 * S, 0.04 * S, 0.04 * S] },
    ];
  };
  const addChair = (y: number, d: number): void => {
    let roll = tilt();
    if (rng.chance(0.28)) roll += rng.chance(0.45) ? Math.PI : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    keep(emit(anchorAt(y, d), [tilt(), DIR_YAW[d], roll], chairPieces()));
  };

  // ── 電話機（受話器が垂れ、コードが繋がる）──
  let phones = 0;
  const addPhone = (y: number, d: number): boolean => {
    if (y < 0.9 * S + 0.3) return false; // 受話器が床に着く高さでは置かない
    const rot: Vec3 = [tilt(), DIR_YAW[d], tilt()];
    const anchor = anchorAt(y, d);
    const embed = embedOf();
    const bodyOff: Vec3 = [0, 0.06 * S, -(0.09 * S - embed * 0.4)];
    const pieces: Piece[] = [
      { prim: 'box', mat: 'shelfMetal', off: [0, -0.02 * S, -(0.14 * S - embed * 0.4)], size: [0.32 * S, 0.04 * S, 0.30 * S] }, // 受け棚
      { prim: 'box', mat: 'signPlate', off: bodyOff, size: [0.22 * S, 0.08 * S, 0.18 * S] },
    ];
    const b = emit(anchor, rot, pieces);
    const body = placeOf(anchor, rot, bodyOff);
    const n = DIRS[d];
    const drop = Math.min(rng.float(0.4, 1.0) * S, body[1] - 0.25);
    if (drop < 0.3 * S) { keep(b); phones++; return true; }
    const jx = rng.float(-0.14, 0.14) * S, jz = rng.float(-0.14, 0.14) * S;
    const hand: Vec3 = [body[0] + n[0] * 0.10 * S + jx, body[1] - drop, body[2] + n[2] * 0.10 * S + jz];
    const handPart: MonumentPart = {
      prim: 'box', mat: 'signPlate', pos: hand,
      rot: [rng.float(-0.5, 0.5), rng.float(-Math.PI, Math.PI), rng.float(-0.7, 0.7)],
      size: [0.20 * S, 0.05 * S, 0.06 * S],
    };
    parts.push(handPart); mergeBnd(b, partBox(handPart));
    // コード（3〜4 点の折れ線。CatmullRom で少し垂れる）
    const path: Vec3[] = [
      [body[0], body[1] - 0.04 * S, body[2] + n[2] * 0.06 * S + (n[0] === 0 ? 0 : 0)],
      [body[0] + n[0] * 0.14 * S + jx * 0.3, body[1] - drop * 0.34, body[2] + n[2] * 0.14 * S + jz * 0.3],
      [body[0] + n[0] * 0.06 * S + jx * 0.8, body[1] - drop * 0.72, body[2] + n[2] * 0.06 * S + jz * 0.8],
      [hand[0], hand[1] + 0.04 * S, hand[2]],
    ];
    if (rng.chance(0.4)) path.splice(2, 1);
    const cord: MonumentPart = { prim: 'tube', mat: 'metalDark', pos: [0, 0, 0], size: [0.012 * S, 0, 0], path };
    parts.push(cord); mergeBnd(b, partBox(cord));
    keep(b); phones++;
    return true;
  };

  // ── 小箱 ──
  const addCrate = (y: number, d: number): void => {
    const rot: Vec3 = [tilt(), DIR_YAW[d], tilt()];
    const embed = embedOf();
    const s = 0.30 * S;
    const zc = -(s / 2 - embed * 0.6);
    const pieces: Piece[] = [
      { prim: 'box', mat: 'boxCardboard', off: [0, 0, zc], size: [s, s, s] },
      { prim: 'box', mat: 'shelfMetal', off: [0, -s / 2 - 0.02 * S, zc], size: [s * 1.15, 0.04 * S, s * 1.1] }, // 受け棚
    ];
    if (rng.chance(0.45)) pieces.push({ prim: 'box', mat: 'boxCardboard', off: [0, s * 0.62, zc - 0.03 * S], size: [s * 0.8, s * 0.7, s * 0.8] });
    keep(emit(anchorAt(y, d), rot, pieces));
  };

  const attach = (y: number, d: number): void => {
    const r = rng.next();
    if (r < 0.42) addDrawer(y, d);
    else if (r < 0.70) addChair(y, d);
    else if (r < 0.85 && phones < 2) { if (!addPhone(y, d)) addCrate(y, d); }
    else addCrate(y, d);
  };

  // ── 高さ 0.45〜0.6 m ごとに 1〜3 方向へ取り付ける ──
  const step = rng.float(0.45, 0.6) * S;
  const yTop = colTop - 0.45 * S;
  const levels: number[] = [];
  for (let y = baseH + rng.float(0.40, 0.60) * S; y <= yTop; y += step) levels.push(y);
  if (!levels.length) levels.push(baseH + colH * 0.5);
  for (const y of levels) {
    if (parts.length > 100) break;
    const order = rng.shuffle([0, 1, 2, 3]);
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) attach(y + rng.float(-0.05, 0.05) * S, order[i]);
  }

  // ── パイプ（柱に沿って縦に走り、途中で曲がって部品へ繋がる）──
  const pipes = rng.int(2, 4);
  for (let i = 0; i < pipes && parts.length < 112; i++) {
    const pr = rng.float(0.03, 0.06) * S;
    const d = rng.int(0, 3), n = DIRS[d];
    const off = trunkR + pr * 1.6;
    const y0 = baseH + rng.float(0.02, 0.15) * S;
    const y1 = rng.float(0.45, 0.92) * colTop;
    const path: Vec3[] = [];
    const at = (y: number, ox: number, oz: number): Vec3 => { const a = axisAt(y); return [a[0] + n[0] * off + ox, y, a[2] + n[2] * off + oz]; };
    const side = rng.float(-0.22, 0.22) * S;
    path.push(at(y0, side * 0.2, side * 0.2));
    path.push(at((y0 + y1) * 0.5, side * 0.4, side * 0.4));
    path.push(at(y1, side, side));
    // 途中で直角に折れて取り付け部品へ向かう
    const d2 = (d + (rng.chance(0.5) ? 1 : 3)) % 4, m = DIRS[d2];
    const arm = rng.float(0.30, 0.62) * S;
    const a1 = axisAt(y1 + rng.float(0.02, 0.18) * S);
    path.push([a1[0] + n[0] * off + m[0] * arm * 0.5, a1[1], a1[2] + n[2] * off + m[2] * arm * 0.5]);
    if (rng.chance(0.6)) {
      const a2 = axisAt(y1 + rng.float(0.10, 0.34) * S);
      path.push([a2[0] + n[0] * off * 0.4 + m[0] * arm, a2[1], a2[2] + n[2] * off * 0.4 + m[2] * arm]);
    }
    const pipe: MonumentPart = { prim: 'tube', mat: rng.chance(0.6) ? 'metalDark' : 'metal', pos: [0, 0, 0], size: [pr, 0, 0], path };
    parts.push(pipe);
    keep(partBox(pipe));
  }

  // ── 頂部の椀子（4 割）──
  if (topChair) {
    const a = axisAt(colTop);
    const anchor: Vec3 = [a[0], a[1] + 0.20 * S, a[2]];
    const roll = (rng.chance(0.5) ? 1 : -1) * (Math.PI / 2) + tilt();
    emit(anchor, [tilt(), rng.float(-Math.PI, Math.PI), roll], chairPieces());
  }

  // ── 刻印（正面・高さ 1.5 m あたりの箱に）──
  const signY = clamp(1.5 * S, baseH + 0.5 * S, Math.max(baseH + 0.5 * S, colTop - 0.4 * S));
  const sa = axisAt(signY);
  const plateZ = sa[2] - (trunkR + 0.06 * S);
  const backing: MonumentPart = { prim: 'box', mat: 'shelfMetal', pos: [sa[0], signY, plateZ], size: [0.52 * S, 0.30 * S, 0.12 * S] };
  parts.push(backing);
  keep(partBox(backing));
  const pool = rng.shuffle(WORDS.slice());
  const wn = rng.int(3, 5);
  const words = pool.slice(0, wn);
  signs.push({
    text: words.slice(0, 2).join(' '),
    sub: words.length > 2 ? words.slice(2, 4).join(' ') : undefined,
    pos: [sa[0], signY, plateZ - 0.07 * S],
    face: 0,
    width: Math.min(1.1, 0.4 * Math.max(1, S)),
  });

  // 部品数が 40 に満たなければ（低い屋内など）取り付けを足す
  let guard = 0;
  while (parts.length < 44 && parts.length < 112 && guard++ < 40) {
    attach(rng.pick(levels) + rng.float(-0.12, 0.12) * S, rng.int(0, 3));
  }

  return { parts, colliders: reduceBoxes(colliders, 8), signs };
}
