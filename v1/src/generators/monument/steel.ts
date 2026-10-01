/**
 * モニュメントの文法: steel（赤い鉄）。
 * 太い脚が斜めに寄り集まり、上端を太い管（tube）が繋ぎ、そこへ「切れた管」と板が突き刺さる鋼の構造。
 * 材質は redShutter（赤い塗装鋼）主体、1〜2 部品だけ metalDark。
 * 座標はモニュメント・ローカル（基壇中心 = 原点、y 上、正面 = −Z）。
 */
import type { Rng } from '../../core/rng';
import type { Vec3 } from '../../core/types';
import type { Box, MatId } from '../layout';
import type { MonumentBuild, MonumentOptions, MonumentPart, MonumentSign } from './types';

const DEG = Math.PI / 180;

function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }

function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a: Vec3, k: number): Vec3 { return [a[0] * k, a[1] * k, a[2] * k]; }
function len(a: Vec3): number { return Math.hypot(a[0], a[1], a[2]); }
function norm(a: Vec3): Vec3 { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function mix(a: Vec3, b: Vec3, t: number): Vec3 { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/**
 * 方向 d（単位ベクトル）へ cylinder の軸（ローカル +Y）を向ける Euler [pitch, yaw, roll]。
 * 描画側は Euler order 'YXZ'（Ry·Rx·Rz）なので Ry(yaw)·Rx(pitch)·(0,1,0) = (sinP·sinY, cosP, sinP·cosY)。
 */
function eulerFromDir(d: Vec3): Vec3 {
  const u = norm(d);
  return [Math.acos(clamp(u[1], -1, 1)), Math.atan2(u[0], u[2]), 0];
}

/** 直交する水平方向（yaw だけ 90° 回した向き。板や添え木のずらしに使う） */
function sideOf(d: Vec3): Vec3 {
  const h = Math.hypot(d[0], d[2]);
  if (h < 1e-4) return [1, 0, 0];
  return [d[2] / h, 0, -d[0] / h];
}

interface Bnd { min: Vec3; max: Vec3 }

/** 端点 a–b・半径 r の棒の正確な外接箱（partBounds の回転近似より締まる） */
function capBox(a: Vec3, b: Vec3, r: number): Bnd {
  return {
    min: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r],
    max: [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
  };
}

function mergeBnd(b: Bnd, q: Bnd): void {
  for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], q.min[k]); b.max[k] = Math.max(b.max[k], q.max[k]); }
}

/** 床から 2.2 m 以下に掛かる箱だけを当たり判定にする（頭上は通す） */
function pushCollider(out: Box[], b: Bnd): void {
  if (!isFinite(b.min[0]) || b.min[1] >= 2.2) return;
  out.push({
    min: [b.min[0], Math.max(0, b.min[1]), b.min[2]],
    max: [b.max[0], Math.min(b.max[1], 2.4), b.max[2]],
    mat: 'void' as MatId, solid: true,
  });
}

/** 当たり判定の箱を max 個まで減らす（union のコストが小さい対から潰す） */
function reduceBoxes(list: Box[], max: number): Box[] {
  const out = list.slice();
  const vol = (b: Box): number => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
  const union = (a: Box, b: Box): Box => ({
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
    mat: 'void' as MatId, solid: true,
  });
  while (out.length > max) {
    let bi = 0, bj = 1, best = Infinity;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const cost = vol(union(out[i], out[j])) - vol(out[i]) - vol(out[j]);
      if (cost < best) { best = cost; bi = i; bj = j; }
    }
    const u = union(out[bi], out[bj]);
    out.splice(bj, 1); out.splice(bi, 1); out.push(u);
  }
  return out;
}

export function buildSteel(rng: Rng, o: MonumentOptions): MonumentBuild {
  const parts: MonumentPart[] = [];
  const colliders: Box[] = [];
  const signs: MonumentSign[] = [];

  const RED: MatId = 'redShutter';
  const S = o.outdoor ? rng.float(1.6, 2.2) : 1; // 屋外は寸法を 1.6〜2.2 倍
  const reach = o.radius * 0.92; // 回転した板・フランジのはみ出し分を残す

  /** 棒（cylinder）を端点 a→b で置く */
  const rod = (a: Vec3, b: Vec3, r: number, mat: MatId, rTop?: number): MonumentPart => {
    const d = sub(b, a), l = Math.max(0.05, len(d));
    const p: MonumentPart = { prim: 'cylinder', mat, pos: mix(a, b, 0.5), rot: eulerFromDir(d), size: [r, l, rTop ?? r] };
    parts.push(p);
    return p;
  };
  /** 板（box）を向き d に合わせて置く */
  const slab = (pos: Vec3, yaw: number, size: Vec3, mat: MatId, pitch = 0): MonumentPart => {
    const p: MonumentPart = { prim: 'box', mat, pos, rot: [pitch, yaw, 0], size };
    parts.push(p);
    return p;
  };

  // ── 脚（2〜3 本。10〜25° 傾けて互いに寄せる）──
  const nLegs = rng.int(2, 3);
  const topH = o.height * rng.float(0.55, 0.80);
  // 直径 0.35〜0.6 m（× S）。足跡が狭いときは細くして、脚の間が塞がらないようにする
  const legR = Math.min(rng.float(0.175, 0.30) * S, reach * 0.20);
  // 足跡: 脚の根元の円半径。tan(25°) を超えない範囲で radius の内側に収める
  const rBase = Math.max(0.2, Math.min(reach - legR * 2.4, topH * Math.tan(25 * DEG)));
  const theta0 = rng.float(0, Math.PI * 2);
  const apex: Vec3 = [rng.float(-0.12, 0.12) * rBase, topH, rng.float(-0.12, 0.12) * rBase];

  const legTops: Vec3[] = [];
  const legBases: Vec3[] = [];
  for (let i = 0; i < nLegs; i++) {
    const th = theta0 + (i * Math.PI * 2) / nLegs + rng.float(-0.18, 0.18);
    const rr = rBase * rng.float(0.86, 1.0);
    const base: Vec3 = [Math.cos(th) * rr, -0.05 * S, Math.sin(th) * rr];
    const spread = rBase * rng.float(0.08, 0.26);
    const top: Vec3 = [apex[0] + Math.cos(th) * spread, topH * rng.float(0.94, 1.04), apex[2] + Math.sin(th) * spread];
    legTops.push(top);
    legBases.push(base);
    rod(base, top, legR, RED, legR * rng.float(0.85, 1.0));

    const bnd = capBox(base, top, legR);
    // 根元のベースプレートとアンカーボルト
    const yaw = -th;
    const bp = slab([base[0], 0.05 * S, base[2]], yaw, [legR * 3.2, 0.10 * S, legR * 3.2], RED);
    mergeBnd(bnd, { min: [bp.pos[0] - legR * 1.7, 0, bp.pos[2] - legR * 1.7], max: [bp.pos[0] + legR * 1.7, 0.12 * S, bp.pos[2] + legR * 1.7] });
    for (let k = 0; k < 4; k++) {
      const bx = base[0] + Math.cos(th + k * Math.PI / 2) * legR * 1.25;
      const bz = base[2] + Math.sin(th + k * Math.PI / 2) * legR * 1.25;
      slab([bx, 0.14 * S, bz], yaw, [0.07 * S, 0.10 * S, 0.07 * S], 'metal');
    }
    // 脚に沿ったボルト帯（2〜3 段）
    const dir = norm(sub(top, base));
    const bands = rng.int(2, 3);
    for (let k = 1; k <= bands; k++) {
      const t = k / (bands + 1);
      const c = mix(base, top, t);
      const e = eulerFromDir(dir);
      parts.push({ prim: 'box', mat: RED, pos: c, rot: e, size: [legR * 2.5, 0.09 * S, legR * 2.5] });
      const sd = sideOf(dir);
      parts.push({ prim: 'box', mat: 'metal', pos: add(c, scale(sd, legR * 1.2)), rot: e, size: [0.06 * S, 0.06 * S, 0.06 * S] });
      parts.push({ prim: 'box', mat: 'metal', pos: sub(c, scale(sd, legR * 1.2)), rot: e, size: [0.06 * S, 0.06 * S, 0.06 * S] });
    }
    // 上端のガセット板
    slab([top[0], top[1] - legR * 0.6, top[2]], yaw, [legR * 2.6, legR * 2.4, 0.07 * S], RED, rng.float(-0.2, 0.2));
    pushCollider(colliders, bnd);
  }

  // ── 横材（脚の上端どうしを結ぶ太い管。中間で少し持ち上げる）──
  const beamR = Math.min(rng.float(0.20, 0.30) * S, reach * 0.22);
  const beams: { a: Vec3; b: Vec3; mid: Vec3 }[] = [];
  const nBeams = nLegs >= 3 ? rng.int(1, 2) : 1;
  for (let i = 0; i < nBeams; i++) {
    const a = legTops[i % nLegs], b = legTops[(i + 1) % nLegs];
    const mid = mix(a, b, 0.5);
    mid[1] += Math.max(0.2, len(sub(b, a)) * rng.float(0.10, 0.22));
    parts.push({ prim: 'tube', mat: RED, pos: [0, 0, 0], size: [beamR, 0, 0], path: [a, mid, b] });
    beams.push({ a, b, mid });
  }
  if (!beams.length) beams.push({ a: legTops[0], b: legTops[0], mid: apex });

  /** 横材・脚の上のランダムな取り付け点 */
  const anchorPoint = (): Vec3 => {
    const bm = rng.pick(beams);
    const t = rng.float(0.15, 0.85);
    return t < 0.5 ? mix(bm.a, bm.mid, t * 2) : mix(bm.mid, bm.b, (t - 0.5) * 2);
  };

  // ── 切れた管（3〜6 本。横材や脚に突き刺す。半数は「半割」の見せかけで 2 本重ねる）──
  const darkBudget = rng.int(1, 2); // metalDark にする部品数
  let darkUsed = 0;
  const nPipes = rng.int(3, 6);
  const spireTop = o.height * rng.float(0.90, 0.96);
  for (let i = 0; i < nPipes; i++) {
    const anchor = anchorPoint();
    const pr = Math.min(rng.float(0.10, 0.20) * S, reach * 0.16);
    const hAnchor = Math.hypot(anchor[0], anchor[2]);
    const yaw = rng.float(0, Math.PI * 2);
    let dir: Vec3;
    let up: number; // 取り付け点から先端までの長さ
    if (i === 0) {
      // 1 本目は上へ抜ける「尖り」。先端が o.height のほぼちょうどに来るよう、傾きと長さを合わせる
      const rise = Math.max(0.4, spireTop - anchor[1]);
      const room = Math.max(0.15, reach - pr * 1.8 - hAnchor);
      const pitch = Math.min(rng.float(10, 26) * DEG, Math.atan2(room, rise) * 0.9);
      dir = [Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), Math.sin(pitch) * Math.cos(yaw)];
      up = rise / dir[1];
    } else {
      const pitch = rng.float(20, 80) * DEG;
      dir = [Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), Math.sin(pitch) * Math.cos(yaw)];
      if (rng.chance(0.3)) dir[1] = -dir[1]; // たまに下向きに刺さる
      up = rng.float(1.5, 4.0) * S * rng.float(0.55, 0.85);
      const hDir = Math.hypot(dir[0], dir[2]);
      if (hDir > 1e-3) up = Math.min(up, Math.max(0.4, (reach - pr * 1.8 - hAnchor) / hDir));
      if (dir[1] > 1e-3) up = Math.min(up, Math.max(0.4, (o.height * 0.88 - anchor[1]) / dir[1]));
      if (dir[1] < -1e-3) up = Math.min(up, Math.max(0.4, (anchor[1] - 0.05) / -dir[1]));
    }
    // 反対側へ抜ける分（足跡半径と床から出ない範囲で）
    const hAll = Math.max(1e-3, Math.hypot(dir[0], dir[2]));
    let embed = Math.min(rng.float(0.35, 1.1) * S, up * 0.8, Math.max(0.05, (reach - pr * 1.8 - hAnchor) / hAll));
    if (dir[1] > 1e-3) embed = Math.min(embed, Math.max(0.05, (anchor[1] - 0.05) / dir[1]));
    const a = add(anchor, scale(dir, -embed));
    const b = add(anchor, scale(dir, up));
    const l = up + embed;
    const mat: MatId = darkUsed < darkBudget && rng.chance(0.4) ? (darkUsed++, 'metalDark') : RED;
    rod(a, b, pr, mat);
    const bnd = capBox(a, b, pr);
    // 半割の見せかけ: 同じ管をわずかにずらして重ねる（尖りは高さを狂わせるので除く）
    if (i > 0 && rng.chance(0.5)) {
      const sd = sideOf(dir);
      const shift = scale(sd, pr * rng.float(0.35, 0.7));
      const tipH = Math.hypot(b[0], b[2]);
      const slip = scale(dir, Math.max(0, Math.min(l * 0.15, 0.22 * S, (reach - pr * 1.7 - tipH) / hAll)));
      rod(add(add(a, shift), slip), add(add(b, shift), slip), pr * rng.float(0.72, 0.92), mat);
      mergeBnd(bnd, capBox(add(add(a, shift), slip), add(add(b, shift), slip), pr));
    }
    // 開いた端のフランジ
    rod(add(b, scale(dir, -0.03 * S)), add(b, scale(dir, 0.03 * S)), pr * (i === 0 ? 1.2 : rng.float(1.25, 1.5)), RED);
    pushCollider(colliders, bnd);
  }

  // ── 板（円盤。pitch 90° 近くで立てる。1〜3 枚）──
  const nDisc = rng.int(1, 3);
  for (let i = 0; i < nDisc; i++) {
    const dr = Math.min(rng.float(0.8, 1.6) * S, reach * 0.55, o.height * 0.30);
    const th = rng.float(0, Math.PI * 2);
    const off = rng.float(0, Math.max(0, reach - dr - 0.1));
    // 立てた板は上下に ±dr 伸びるので、全体高さ（o.height）を超えないところに置く
    const cy = clamp(dr * rng.float(0.95, 1.7), dr * 0.6, Math.max(dr * 0.6, o.height * 0.98 - dr));
    const pos: Vec3 = [Math.cos(th) * off, cy, Math.sin(th) * off];
    const pitch = (90 + rng.float(-14, 14) * (0.4 + o.distort)) * DEG;
    const yaw = rng.float(0, Math.PI * 2);
    const mat: MatId = darkUsed < darkBudget && rng.chance(0.35) ? (darkUsed++, 'metalDark') : RED;
    parts.push({ prim: 'cylinder', mat, pos, rot: [pitch, yaw, 0], size: [dr, 0.06 * S, dr] });
    // 板を支える短い添え木
    const sd: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
    rod([pos[0] + sd[0] * dr * 0.4, 0.05 * S, pos[2] + sd[2] * dr * 0.4], [pos[0], pos[1] * 0.75, pos[2]], 0.06 * S, RED);
    pushCollider(colliders, { min: [pos[0] - dr, Math.max(0, pos[1] - dr), pos[2] - dr], max: [pos[0] + dr, pos[1] + dr, pos[2] + dr] });
  }

  // ── 銘板（刻印は無し。番号だけ。正面 −Z 側の脚の根本へ）──
  let nearest = legBases[0];
  for (const b of legBases) if (b[2] < nearest[2]) nearest = b;
  const px = nearest[0] * 0.8;
  const pz = Math.max(-(reach - 0.25 * S), nearest[2] * 0.8 - 0.1 * S);
  const plateY = 0.30 * S;
  parts.push({ prim: 'plate', mat: 'signPlate', pos: [px, plateY, pz - 0.05 * S], size: [0.30 * S, 0.20 * S, 0.03 * S] });
  signs.push({ text: `NO. ${rng.int(2, 87)}`, pos: [px, plateY, pz - 0.075 * S], face: 0, width: Math.max(0.28, 0.30 * S) });

  // 部品数が 40 に満たなければ、脚どうしを結ぶ筋交いを足す
  let guard = 0;
  while (parts.length < 42 && guard++ < 24 && legTops.length >= 2) {
    const i = rng.int(0, legTops.length - 1);
    const j = (i + 1) % legTops.length;
    const a = mix(legBases[i], legTops[i], rng.float(0.2, 0.7));
    const b = mix(legBases[j], legTops[j], rng.float(0.2, 0.7));
    const br = rng.float(0.05, 0.10) * S;
    rod(a, b, br, RED);
    pushCollider(colliders, capBox(a, b, br));
  }

  return { parts, colliders: reduceBoxes(colliders, 8), signs };
}
