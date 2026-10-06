/**
 * 小物の形の道具（手続きの形の関数）。どの形も「パラメータ曲面 (u, v) → 位置」で表し、曲面ごとに
 * 三角形の格子と、その曲面の模様のテクスチャ（地の色・粗さ）を作る（MeshPatch。meshes.ts で v2 の材質のメッシュにする）。
 *
 * - 格子と模様は v・u とも長さで等間隔（超楕円体のように速さが場所で変わる形でも歪まない）。頂点の間隔は模様の 2.5 倍、
 *   平らな面（u・v の一次式）は焼き込み光の分だけ
 * - 色は線形の値（sRGB の 16 進は lin() で直す）。粗さ・金属度・不透明度・材質（クリアコート）は Look で曲面ごと
 * - 形の関数は `(S: ShapeSink, R: Rand, xf: (p: V3) => V3, …) => void`。作り方の手順は .claude/skills/procedural-3d-objects
 * - 粒（スプラット）の受け（SplatSink）を付けると、同じ曲面に粒も置く（experiments/v2-splat-props の見本の部屋。v2 では使わない）
 */

export type V3 = [number, number, number];

/** sRGB の 16 進 → 線形 RGB */
export function lin(hex: number, k = 1): V3 {
  const f = (c: number): number => { const s = c / 255; return (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * k; };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}
export const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

// ---------------------------------------------------------------- 乱数・ノイズ

export class Rand {
  private s: number;
  constructor(seed: number) { this.s = (seed >>> 0) || 1; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  pick<T>(a: readonly T[]): T { return a[Math.floor(this.next() * a.length)]!; }
  chance(p: number): boolean { return this.next() < p; }
}

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t: number): number => t * t * (3 - 2 * t);
/** 値ノイズ（0..1、なめらか） */
export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const c = (dx: number, dy: number, dz: number): number => hash3(xi + dx, yi + dy, zi + dz);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}
/** 重ねたノイズ（0..1） */
export function fbm(x: number, y: number, z: number, oct = 3): number {
  let a = 0, w = 0.5, s = 1, t = 0;
  for (let i = 0; i < oct; i++) { a += noise3(x * s, y * s, z * s) * w; t += w; w *= 0.5; s *= 2.03; }
  return a / t;
}

// ---------------------------------------------------------------- 粒の入れ物

export interface Look {
  rough: number;
  metal: number;
  opacity: number;
  /** 材質の番号（0 つや消し・1 プラスチック・2 陶器・3 金属・4 透ける物。クリアコートの強さが変わる。meshes.ts の COAT） */
  mat: number;
  /** 光る分（線形 HDR。電球・時計の夜光など） */
  emit?: V3;
}

export const LOOK = {
  matte: { rough: 0.85, metal: 0, opacity: 1.6, mat: 0 } as Look,
  fabric: { rough: 0.95, metal: 0, opacity: 1.4, mat: 0 } as Look,
  plastic: { rough: 0.38, metal: 0, opacity: 1.6, mat: 1 } as Look,
  glossy: { rough: 0.2, metal: 0, opacity: 1.6, mat: 1 } as Look,
  ceramic: { rough: 0.3, metal: 0, opacity: 1.6, mat: 2 } as Look,
  metal: { rough: 0.3, metal: 1, opacity: 1.6, mat: 3 } as Look,
  leaf: { rough: 0.55, metal: 0, opacity: 1.2, mat: 0 } as Look,
  paper: { rough: 0.9, metal: 0, opacity: 1.5, mat: 0 } as Look,
  clear: { rough: 0.08, metal: 0, opacity: 0.45, mat: 4 } as Look,
};

/** 粒（スプラット）の受け。曲面の上に粒を置くとき（見本の部屋）だけ付ける */
export interface SplatSink {
  /** 置いた粒の数 */
  readonly n: number;
  /** 粒の中心・法線・地の色（3 個ずつ）と広がり（2 個ずつ）。毛羽（plush.ts）が読む */
  readonly center: Float32Array;
  readonly normal: Float32Array;
  readonly albedo: Float32Array;
  readonly scale: Float32Array;
  /** 粒を 1 つ。t は接線（粒の u の向き）、n は法線。su・sv は u・v の向きの広がり（標準偏差 m） */
  push(p: V3, n: V3, t: V3, su: number, sv: number, c: V3, look: Look, opacity?: number, rough?: number): void;
}

/** 形の関数の書き出し先。patches に曲面ごとのメッシュを書き足す（null なら作らない）。splats があれば粒も置く */
export class ShapeSink {
  patches: MeshPatch[] | null = [];
  splats: SplatSink | null = null;
}

// ---------------------------------------------------------------- 曲面

export interface SurfaceOpts {
  /** パラメータの範囲 */
  u: [number, number];
  v: [number, number];
  /** 粒の間隔（m） */
  spacing: number;
  /** 位置 */
  pos: (u: number, v: number) => V3;
  /** 色（u・v・位置・法線）→ 線形 RGB */
  color: (u: number, v: number, p: V3, n: V3) => V3;
  look: Look;
  /** 粗さを場所で変える */
  rough?: (u: number, v: number, p: V3) => number;
  /** 法線の向きを逆にする（内側を表にする） */
  flip?: boolean;
  /** 裏にも粒を置く（薄い葉・紙・布） */
  twoSided?: boolean;
  /** 裏の色（無ければ表と同じ） */
  backColor?: (u: number, v: number, p: V3, n: V3) => V3;
  /** 位置のばらつき（間隔に対する割合） */
  jitter?: number;
  /** 粒の広がり（間隔に対する割合） */
  size?: number;
  /** 粒を間引く（true なら置かない） */
  skip?: (u: number, v: number, p: V3) => boolean;
  /** 置き場所への写し（局所の座標 → 部屋の座標。法線は写した後の形から決まる） */
  xf?: (p: V3) => V3;
  rand: Rand;
}

/** 置き場所: 原点 o、y 軸まわりの向き yaw（局所の +z が yaw の向きの前）、大きさ s */
export function place(o: V3, yaw = 0, s = 1): (p: V3) => V3 {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  return (p) => [o[0] + (p[0] * c + p[2] * sn) * s, o[1] + p[1] * s, o[2] + (-p[0] * sn + p[2] * c) * s];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * 長さの表（パラメータ 0..1 の n 等分ごとの累積の長さ）と、その逆（長さ → パラメータ）。
 * 超楕円体（|sin v|^e）のように、パラメータの速さが場所で大きく変わる形でも、粒を長さで等間隔に置くため
 */
class ArcTable {
  readonly cum: Float64Array;
  total: number;
  constructor(n: number, at: (t: number) => V3) {
    this.cum = new Float64Array(n + 1);
    let prev = at(0);
    for (let i = 1; i <= n; i++) { const p = at(i / n); this.cum[i] = this.cum[i - 1]! + len(sub(p, prev)); prev = p; }
    this.total = this.cum[n]!;
  }
  /** 長さ s（0..total）→ パラメータ 0..1 */
  param(s: number): number {
    const c = this.cum, n = c.length - 1;
    if (this.total <= 1e-12) return Math.min(1, Math.max(0, s));
    if (s <= 0) return 0;
    if (s >= this.total) return 1;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m]! < s) lo = m; else hi = m; }
    const a = c[lo]!, b = c[hi]!;
    return (lo + (b > a ? (s - a) / (b - a) : 0)) / n;
  }
}

/** 細かさの全体の倍率（遠い物・数の多い物は粗くする。1 = 見本の部屋）。textureScale は模様の細かさだけの倍率（1 以下。GPU の量を減らす） */
export const detail = { spacingScale: 1, textureScale: 1 };

/** パラメータ曲面を置く: 曲面のメッシュ（と、粒の受けがあれば粒）。v の向きも u の向きも長さで等間隔 */

export function surface(S: ShapeSink, oIn: SurfaceOpts): void {
  const xf = oIn.xf;
  const o: SurfaceOpts = { ...(xf ? { ...oIn, pos: (u: number, v: number) => xf(oIn.pos(u, v)) } : oIn), spacing: oIn.spacing * detail.spacingScale };
  const [u0, u1] = o.u, [v0, v1] = o.v;
  const jit = o.jitter ?? 0.35, k = o.size ?? 0.62;
  // v の向きの長さの表（u の 3 か所の平均）
  const NV = 64, NS = 3;
  const tv = new ArcTable(NV, () => [0, 0, 0]);
  for (let a = 0; a < NS; a++) {
    const u = u0 + ((a + 0.5) / NS) * (u1 - u0);
    const t = new ArcTable(NV, (s) => o.pos(u, v0 + s * (v1 - v0)));
    for (let i = 0; i <= NV; i++) tv.cum[i] = tv.cum[i]! + t.cum[i]! / NS;
  }
  tv.total = tv.cum[NV]!;
  const lv = tv.total;
  if (lv <= 1e-9) return;
  const nv = Math.max(1, Math.round(lv / o.spacing));
  const sv = Math.max(lv / nv, 1e-4) * k;
  const vAt = (s: number): number => v0 + tv.param(s) * (v1 - v0);
  const eu = (u1 - u0) * 1e-3, ev = (v1 - v0) * 1e-3;
  if (S.patches) { const t = performance.now(); recordMesh(S.patches, o, lv, vAt); meshRecordStats.ms += performance.now() - t; }
  const sink = S.splats;
  if (!sink) return;
  for (let j = 0; j < nv; j++) {
    const sRow = (j + 0.5) * (lv / nv);
    const vRow = vAt(sRow);
    // この行の u の向きの長さの表
    const tu = new ArcTable(48, (s) => o.pos(u0 + s * (u1 - u0), vRow));
    const lu = tu.total;
    const nu = Math.max(1, Math.round(lu / o.spacing));
    const su = Math.max(lu / nu, 1e-4) * k;
    for (let i = 0; i < nu; i++) {
      const u = u0 + tu.param((i + 0.5 + (o.rand.next() - 0.5) * jit) * (lu / nu)) * (u1 - u0);
      const v = vAt(sRow + (o.rand.next() - 0.5) * jit * (lv / nv));
      const p = o.pos(u, v);
      if (o.skip?.(u, v, p)) continue;
      const pu = sub(o.pos(Math.min(u1, u + eu), v), o.pos(Math.max(u0, u - eu), v));
      const pv = sub(o.pos(u, Math.min(v1, v + ev)), o.pos(u, Math.max(v0, v - ev)));
      let n = cross(pu, pv);
      if (len(n) < 1e-14) continue;
      n = norm(n);
      if (o.flip) n = [-n[0], -n[1], -n[2]];
      const rough = o.rough ? o.rough(u, v, p) : o.look.rough;
      sink.push(p, n, pu, su, sv, o.color(u, v, p, n), o.look, o.look.opacity, rough);
      if (o.twoSided) {
        const nb: V3 = [-n[0], -n[1], -n[2]];
        sink.push(p, nb, pu, su, sv, (o.backColor ?? o.color)(u, v, p, nb), o.look, o.look.opacity, rough);
      }
    }
  }
}

// ---------------------------------------------------------------- 同じ形のメッシュ

/** 曲面 1 枚分の三角形とテクスチャ（部屋の座標。uv は曲面の中の 0..1 = 長さの割合） */
export interface MeshPatch {
  pos: Float32Array;
  nor: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
  /** テクスチャの大きさと中身（地の色 RGB は線形、粗さ）。share があればその曲面のテクスチャを使う（裏の色が同じ両面） */
  texW: number;
  texH: number;
  albedo: Float32Array;
  rough: Float32Array;
  share: MeshPatch | null;
  look: Look;
}

/** 頂点の間隔は粒の間隔の何倍か（色はテクスチャが粒と同じ細かさで持つので、形の分だけ頂点を置く） */
const GEO_STEP = 2.5;
/** 平らな面の頂点の間隔（m。焼き込み光の細かさ 0.4 m の分だけ） */
const FLAT_STEP = 0.25;
/** 同じ形のメッシュの曲面を作るのにかかった時間の合計（ms。粒と分けて測る） */
export const meshRecordStats = { ms: 0 };
const TEX_MAX = 1024;
const UP: V3 = [0, 1, 0];

/** pos(u, v) が u・v の一次式か（平らな平行四辺形。四隅から 3×3 の点を一次で求めて、ずれが 0.15 mm 未満） */
function isAffine(pos: (u: number, v: number) => V3, u0: number, u1: number, v0: number, v1: number): boolean {
  const p00 = pos(u0, v0), p10 = pos(u1, v0), p01 = pos(u0, v1);
  for (const a of [0, 0.5, 1]) for (const b of [0, 0.5, 1]) {
    if (a + b === 0) continue;
    const p = pos(u0 + a * (u1 - u0), v0 + b * (v1 - v0));
    for (let k = 0; k < 3; k++) if (Math.abs(p[k]! - (p00[k]! + a * (p10[k]! - p00[k]!) + b * (p01[k]! - p00[k]!))) > 1.5e-4) return false;
  }
  return true;
}

/**
 * 曲面を三角形の格子にする（粒と同じく v・u とも長さで等間隔）。頂点の法線は曲面の微分（継ぎ目でも滑らか）。
 * テクスチャは粒と同じ間隔で色の関数を引いて作る。間引き（skip）は格子の 1 マスの中心で決める
 */
function recordMesh(out: MeshPatch[], o: SurfaceOpts, lv: number, vAt: (s: number) => number): void {
  const [u0, u1] = o.u, [v0, v1] = o.v;
  const sp = o.spacing;
  const eu = (u1 - u0) * 1e-3, ev = (v1 - v0) * 1e-3;
  // 行の長さの表（小さな曲面は粗く。葉のような小さな曲面が数千枚あるので）
  let res = 16;
  const rowAt = (v: number): ArcTable => new ArcTable(res, (s) => o.pos(u0 + s * (u1 - u0), v));
  // 行の長さの最大（3 か所）と、u の向きが閉じているか（回転体・管）
  let luMax = 0;
  for (const a of [0.15, 0.5, 0.85]) luMax = Math.max(luMax, rowAt(vAt(a * lv)).total);
  if (luMax <= 1e-9) return;
  const mid = vAt(lv * 0.5);
  const closed = len(sub(o.pos(u0, mid), o.pos(u1, mid))) < 1e-6;
  const nuS = Math.max(1, Math.round(luMax / sp)), nvS = Math.max(1, Math.round(lv / sp));
  res = Math.min(48, Math.max(6, nuS * 3));
  // 平らな平行四辺形（pos が u・v の一次式）なら、形の頂点は要らない（模様はテクスチャが持つ）。焼き込み光（頂点ごと）の分だけ
  // FLAT_STEP おきに置く（小さな面は三角形 2 枚）。間引き（skip）がある面は格子のまま
  const flat = !closed && !o.skip && isAffine(o.pos, u0, u1, v0, v1);
  const nuG = flat ? Math.max(1, Math.min(nuS, Math.ceil(luMax / FLAT_STEP))) : Math.max(1, Math.min(nuS, closed ? 8 : 2), Math.round(nuS / GEO_STEP));
  const nvG = flat ? Math.max(1, Math.min(nvS, Math.ceil(lv / FLAT_STEP))) : Math.max(1, Math.min(nvS, 2), Math.round(nvS / GEO_STEP));
  const W = nuG + 1, H = nvG + 1;
  const pos = new Float32Array(W * H * 3), nor = new Float32Array(W * H * 3), uv = new Float32Array(W * H * 2);
  const us = new Float64Array(W * H), vs = new Float64Array(W * H);
  const bad: number[] = [];
  for (let j = 0; j < H; j++) {
    const a = j / nvG;
    const v = j === 0 ? v0 : j === nvG ? v1 : vAt(a * lv);
    const row = rowAt(v);
    for (let i = 0; i < W; i++) {
      const b = i / nuG;
      const u = i === 0 ? u0 : i === nuG ? u1 : u0 + row.param(b * row.total) * (u1 - u0);
      const k = j * W + i;
      const p = o.pos(u, v);
      pos.set(p, k * 3);
      uv[k * 2] = b; uv[k * 2 + 1] = a;
      us[k] = u; vs[k] = v;
      const pu = sub(o.pos(Math.min(u1, u + eu), v), o.pos(Math.max(u0, u - eu), v));
      const pv = sub(o.pos(u, Math.min(v1, v + ev)), o.pos(u, Math.max(v0, v - ev)));
      const n = cross(pu, pv);
      if (len(n) < 1e-14) { bad.push(k); continue; }
      const m = norm(n);
      const f = o.flip ? -1 : 1;
      nor[k * 3] = m[0] * f; nor[k * 3 + 1] = m[1] * f; nor[k * 3 + 2] = m[2] * f;
    }
  }
  // 極（1 点に集まる行）の法線は、同じ列の隣の行から借りる
  for (const k of bad) {
    const i = k % W, j = (k / W) | 0;
    let src = -1;
    for (let d = 1; d < H && src < 0; d++) for (const jj of [j + d, j - d]) if (jj >= 0 && jj < H && !bad.includes(jj * W + i)) { src = jj * W + i; break; }
    if (src >= 0) nor.set(nor.subarray(src * 3, src * 3 + 3), k * 3); else nor.set(UP, k * 3);
  }
  // 三角形（表は pu × pv の向き。flip なら裏返す）
  const idx: number[] = [];
  for (let j = 0; j < nvG; j++) for (let i = 0; i < nuG; i++) {
    const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
    if (o.skip) {
      const uc = (us[a]! + us[b]! + us[c]! + us[d]!) / 4, vc = (vs[a]! + vs[b]! + vs[c]! + vs[d]!) / 4;
      if (o.skip(uc, vc, o.pos(uc, vc))) continue;
    }
    if (o.flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  }
  if (!idx.length) return;
  // テクスチャ（粒と同じ間隔。texel の中心 = 長さの割合 (i + 0.5) / texW）
  const ts = detail.textureScale;
  const texW = Math.max(2, Math.min(TEX_MAX, Math.round(nuS * ts))), texH = Math.max(2, Math.min(TEX_MAX, Math.round(nvS * ts)));
  const texel = (color: SurfaceOpts['color']): { albedo: Float32Array; rough: Float32Array } => {
    const albedo = new Float32Array(texW * texH * 3), rough = new Float32Array(texW * texH);
    for (let j = 0; j < texH; j++) {
      const v = vAt(((j + 0.5) / texH) * lv);
      const row = rowAt(v);
      for (let i = 0; i < texW; i++) {
        const u = u0 + row.param(((i + 0.5) / texW) * row.total) * (u1 - u0);
        const p = o.pos(u, v);
        const c = color(u, v, p, UP);
        const k = j * texW + i;
        albedo[k * 3] = c[0]; albedo[k * 3 + 1] = c[1]; albedo[k * 3 + 2] = c[2];
        rough[k] = o.rough ? o.rough(u, v, p) : o.look.rough;
      }
    }
    return { albedo, rough };
  };
  const front = texel(o.color);
  const index = Uint32Array.from(idx);
  const patch: MeshPatch = { pos, nor, uv, index, texW, texH, albedo: front.albedo, rough: front.rough, share: null, look: o.look };
  out.push(patch);
  if (o.twoSided) {
    // 裏: 法線を逆に、三角形を裏返す。裏の色が違えば別のテクスチャ
    const back = new Uint32Array(index.length);
    for (let t = 0; t < index.length; t += 3) { back[t] = index[t]!; back[t + 1] = index[t + 2]!; back[t + 2] = index[t + 1]!; }
    const nb = nor.map((x) => -x);
    if (o.backColor) { const bt = texel(o.backColor); out.push({ pos, nor: nb, uv, index: back, texW, texH, albedo: bt.albedo, rough: bt.rough, share: null, look: o.look }); }
    else out.push({ pos, nor: nb, uv, index: back, texW, texH, albedo: front.albedo, rough: front.rough, share: patch, look: o.look });
  }
}

// ---------------------------------------------------------------- よく使う形

/** 回転体（輪郭 prof(t) = [半径, 高さ]、t = 0..1。軸は c を通る y 軸）。外向きの面 */
export function revolve(S: ShapeSink, c: V3, prof: (t: number) => [number, number], o: Omit<SurfaceOpts, 'u' | 'v' | 'pos'> & { theta?: [number, number] }): void {
  const th = o.theta ?? [0, Math.PI * 2];
  surface(S, {
    ...o, u: th, v: [0, 1],
    pos: (u, v) => { const [r, y] = prof(v); return [c[0] + Math.cos(u) * r, c[1] + y, c[2] + Math.sin(u) * r]; },
    flip: !o.flip,
  });
}

/** 楕円体（中心 c、半径 r）。warp で形を崩せる（ぬいぐるみの丸み・クッション） */
export function ellipsoid(S: ShapeSink, c: V3, r: V3, o: Omit<SurfaceOpts, 'u' | 'v' | 'pos'> & { warp?: (p: V3, d: V3) => V3; vRange?: [number, number] }): void {
  surface(S, {
    ...o, u: [0, Math.PI * 2], v: o.vRange ?? [0.001, Math.PI - 0.001],
    pos: (u, v) => {
      const d: V3 = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
      const p: V3 = [c[0] + d[0] * r[0], c[1] + d[1] * r[1], c[2] + d[2] * r[2]];
      return o.warp ? o.warp(p, d) : p;
    },
    // この並び（u = 経度・v = 天頂角）は pu × pv がもともと外向き
    flip: !!o.flip,
  });
}

/**
 * 超楕円体（角の丸い箱: e = 0.1〜1。枕・クッション・本の背）。
 * 角度の引数（|sin v|^e）は e が小さいと赤道・角で速さが無限になり、粒が並ばない所ができる。
 * そこで立方体の 6 面の格子を形へ放射状に写して置く（どこでも滑らか）。色・間引きの関数には従来の (u, v)（経度・緯度）を渡す
 */
export function superellipsoid(S: ShapeSink, c: V3, r: V3, e1: number, e2: number, o: Omit<SurfaceOpts, 'u' | 'v' | 'pos'> & { warp?: (p: V3, d: V3) => V3 }): void {
  const sp = (w: number, m: number): number => Math.sign(w) * Math.pow(Math.abs(w), m);
  // 単位の形の上の点（立方体の点 q を放射状に写す: F(λq) = 1）
  const unit = (q: V3): V3 => {
    const h = Math.pow(Math.pow(Math.abs(q[0]), 2 / e2) + Math.pow(Math.abs(q[2]), 2 / e2), e2 / e1);
    const F = h + Math.pow(Math.abs(q[1]), 2 / e1);
    const l = Math.pow(F, -e1 / 2);
    return [q[0] * l, q[1] * l, q[2] * l];
  };
  // 単位の形の点 → 従来の (u, v)
  const uvOf = (d: V3): [number, number] => {
    const v = Math.asin(Math.max(-1, Math.min(1, sp(d[1], 1 / e1))));
    const u = Math.atan2(sp(d[2], 1 / e2), sp(d[0], 1 / e2));
    return [u, v];
  };
  // 面（法線 N、面の向き A・B。A × B = N で外向き）
  const faces: [V3, V3, V3][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  for (const [N, A, B] of faces) {
    const dOf = (a: number, b: number): V3 => unit([N[0] + A[0] * a + B[0] * b, N[1] + A[1] * a + B[1] * b, N[2] + A[2] * a + B[2] * b]);
    const pOf = (a: number, b: number): { p: V3; d: V3 } => {
      const d = dOf(a, b);
      const p: V3 = [c[0] + d[0] * r[0], c[1] + d[1] * r[1], c[2] + d[2] * r[2]];
      return { p: o.warp ? o.warp(p, d) : p, d };
    };
    surface(S, {
      ...o, u: [-1, 1], v: [-1, 1],
      pos: (a, b) => pOf(a, b).p,
      color: (a, b, p, n) => { const [u, v] = uvOf(dOf(a, b)); return o.color(u, v, p, n); },
      ...(o.backColor ? { backColor: (a: number, b: number, p: V3, n: V3) => { const [u, v] = uvOf(dOf(a, b)); return o.backColor!(u, v, p, n); } } : {}),
      ...(o.skip ? { skip: (a: number, b: number, p: V3) => { const [u, v] = uvOf(dOf(a, b)); return o.skip!(u, v, p); } } : {}),
      ...(o.rough ? { rough: (a: number, b: number, p: V3) => { const [u, v] = uvOf(dOf(a, b)); return o.rough!(u, v, p); } } : {}),
      flip: !!o.flip,
    });
  }
}

// ---------------------------------------------------------------- 滑らかにつなぐ（ぬいぐるみの胴と手足など）

/** 滑らかにつなぐ部位（楕円体）。回転は x 軸まわり ax → z 軸まわり az（plush.ts の rot と同じ順） */
export interface BlobPart {
  c: V3;
  r: V3;
  ax?: number;
  az?: number;
  /** 色（d は部位の局所の向き = 楕円体の単位の向き、p は位置） */
  color: (d: V3, p: V3) => V3;
}

/**
 * 楕円体の部位を「なめらかな和」（継ぎ目に丸い肉が付く）でつないだ 1 つの面にする。
 * 部位ごとに自分の楕円体の (u, v) で面を敷き、楕円体の点から外へ、全体の形の面（距離の近似の滑らかな最小 = 0）まで押し出す。
 * 他の部位の方が近い所（その部位の中に隠れる所）は置かない（境目は少し重ねて隙間を作らない）。after は部位ごとに置いた後に呼ぶ（毛羽など）
 */
export function blobby(S: ShapeSink, parts: BlobPart[], o: { k: number; spacing: number; look: Look; rand: Rand; xf?: (p: V3) => V3; margin?: number; after?: (i: number, from: number) => void }): void {
  const k = o.k, margin = o.margin ?? 0.003;
  // 部位の回転（局所 → 形の座標）と逆
  const mats = parts.map((q) => {
    const cx = Math.cos(q.ax ?? 0), sx = Math.sin(q.ax ?? 0), cz = Math.cos(q.az ?? 0), sz = Math.sin(q.az ?? 0);
    // M = Rz(az) · Rx(ax)
    const M = [cz, -sz * cx, sz * sx, sz, cz * cx, -cz * sx, 0, sx, cx];
    return M;
  });
  const toLocal = (i: number, p: V3): V3 => {
    const M = mats[i]!, c = parts[i]!.c;
    const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
    // 逆 = 転置
    return [M[0]! * x + M[3]! * y + M[6]! * z, M[1]! * x + M[4]! * y + M[7]! * z, M[2]! * x + M[5]! * y + M[8]! * z];
  };
  const toShape = (i: number, q: V3): V3 => {
    const M = mats[i]!, c = parts[i]!.c;
    return [c[0] + M[0]! * q[0] + M[1]! * q[1] + M[2]! * q[2], c[1] + M[3]! * q[0] + M[4]! * q[1] + M[5]! * q[2], c[2] + M[6]! * q[0] + M[7]! * q[1] + M[8]! * q[2]];
  };
  // 楕円体の距離の近似（内側が負）
  const sdf = (i: number, p: V3): number => {
    const q = toLocal(i, p), r = parts[i]!.r;
    const k0 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]);
    const k1 = Math.hypot(q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2]));
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
  };
  const smin = (a: number, b: number): number => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - (h * h * k) / 4; };
  // 部位を囲む球（遠い部位は距離を計算しない: 球までの距離が今の値 + k 以上なら和に効かない）
  const reach = parts.map((q) => Math.max(q.r[0], q.r[1], q.r[2]));
  const field = (p: V3): number => {
    let f = Infinity;
    for (let j = 0; j < parts.length; j++) {
      const c = parts[j]!.c;
      const lower = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - reach[j]!;
      if (lower >= f + k) continue;
      const d = sdf(j, p);
      f = f === Infinity ? d : smin(f, d);
    }
    return f;
  };
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    let lastU = NaN, lastV = NaN, lastOwned = false;
    const solve = (u: number, v: number): V3 => {
      const d: V3 = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
      const e: V3 = [d[0] * part.r[0], d[1] * part.r[1], d[2] * part.r[2]];
      const pe = toShape(i, e);
      const t0 = Math.hypot(e[0], e[1], e[2]) || 1e-6;
      const dir: V3 = [(pe[0] - part.c[0]) / t0, (pe[1] - part.c[1]) / t0, (pe[2] - part.c[2]) / t0];
      const at = (t: number): V3 => [part.c[0] + dir[0] * t, part.c[1] + dir[1] * t, part.c[2] + dir[2] * t];
      // 楕円体の点から外へ、全体の形の面を探す（つないだ所は少し外へ出る）
      let a = t0, b = -1;
      for (let s = 1; s <= 4; s++) { const t = t0 + (k * 3 * s) / 4; if (field(at(t)) > 0) { b = t; break; } a = t; }
      let p = pe;
      let owned = false;
      if (b > 0) {
        for (let it = 0; it < 9; it++) { const m = (a + b) / 2; if (field(at(m)) > 0) b = m; else a = m; }
        p = at((a + b) / 2);
        // 自分の部位が一番近いか（他の部位の中に隠れる所は置かない。境目は margin だけ重ねる）
        const fi = sdf(i, p);
        owned = true;
        for (let j = 0; j < parts.length; j++) if (j !== i && sdf(j, p) < fi - margin) { owned = false; break; }
      }
      lastU = u; lastV = v; lastOwned = owned;
      return p;
    };
    const from = S.splats?.n ?? 0;
    surface(S, {
      u: [0, Math.PI * 2], v: [0.001, Math.PI - 0.001], spacing: o.spacing, look: o.look, rand: o.rand, ...(o.xf ? { xf: o.xf } : {}),
      pos: (u, v) => solve(u, v),
      skip: (u, v) => { if (u !== lastU || v !== lastV) solve(u, v); return !lastOwned; },
      color: (u, v, p) => part.color([Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)], p),
    });
    o.after?.(i, from);
  }
}

/** 管（中心線 path(t)、半径 rad(t)、t = 0..1） */
export function tube(S: ShapeSink, path: (t: number) => V3, rad: (t: number) => number, o: Omit<SurfaceOpts, 'u' | 'v' | 'pos'>): void {
  const frame = (t: number): { p: V3; a: V3; b: V3 } => {
    const p = path(t);
    const q = path(Math.min(1, t + 1e-3)), q0 = path(Math.max(0, t - 1e-3));
    const tan = norm(sub(q, q0));
    const ref: V3 = Math.abs(tan[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const a = norm(cross(tan, ref));
    const b = cross(tan, a);
    return { p, a, b };
  };
  surface(S, {
    ...o, u: [0, Math.PI * 2], v: [0, 1],
    pos: (u, v) => { const f = frame(v); const r = rad(v); return [f.p[0] + (f.a[0] * Math.cos(u) + f.b[0] * Math.sin(u)) * r, f.p[1] + (f.a[1] * Math.cos(u) + f.b[1] * Math.sin(u)) * r, f.p[2] + (f.a[2] * Math.cos(u) + f.b[2] * Math.sin(u)) * r]; },
  });
}

/** 平らな四角（原点 o、辺 a・b）。法線は a × b */
export function quad(S: ShapeSink, origin: V3, a: V3, b: V3, o: Omit<SurfaceOpts, 'u' | 'v' | 'pos'>): void {
  surface(S, {
    ...o, u: [0, 1], v: [0, 1],
    pos: (u, v) => [origin[0] + a[0] * u + b[0] * v, origin[1] + a[1] * u + b[1] * v, origin[2] + a[2] * u + b[2] * v],
  });
}

/** 直方体の見える面（faces に含む面だけ: '+x' '-x' '+y' '-y' '+z' '-z'）。color は面ごと */
export function boxFaces(S: ShapeSink, min: V3, max: V3, faces: string, color: (face: string, s: number, t: number, p: V3) => V3, o: Omit<SurfaceOpts, 'u' | 'v' | 'pos' | 'color'>): void {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const def: [string, V3, V3, V3][] = [
    ['+x', [x1, y0, z1], [0, 0, z0 - z1], [0, y1 - y0, 0]],
    ['-x', [x0, y0, z0], [0, 0, z1 - z0], [0, y1 - y0, 0]],
    ['+y', [x0, y1, z1], [x1 - x0, 0, 0], [0, 0, z0 - z1]],
    ['-y', [x0, y0, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0]],
    ['+z', [x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0]],
    ['-z', [x1, y0, z0], [x0 - x1, 0, 0], [0, y1 - y0, 0]],
  ];
  for (const [f, org, a, b] of def) {
    if (!faces.includes(f)) continue;
    quad(S, org, a, b, { ...o, color: (u, v, p) => color(f, u, v, p) });
  }
}
