import * as THREE from 'three';
import type { SceneContext } from '../../scenes/types.ts';
import type { HallKit } from './hallkit.ts';
import { frames, ringProfile, sampleAt, type P2, type SweepPath } from './sweep.ts';

/**
 * スライダーを「部品をつないだ物」として作る（参考画像のスライダーの作り）。
 * 本物のスライダーは成形した FRP の部品（筒の直線・曲がり・樋の区間）を道筋に沿ってつないだ物で、部品ごとに 1 色
 * （桃色・ミント・水色・白）。つなぎ目には継ぎ目が見える（筒はフランジの輪、樋は横切る縁）。
 * - 道筋を部品に分ける: 直線と曲がりを分け、1.5〜4 m ごとに。着水の広がりは 1 つの部品
 * - 部品ごとに広間の色の表から 1 色: 交互が基本で時々 2 つ続く、広間ごとの割合（D は桃色 6 割・ミント 4 割）
 * - 幅広の樋は区間ごとに側壁の板と床の板を別の色にできる（板の境は長さ方向の細い縁）。継ぎ目は少し曲がる
 * - 継ぎ目: 筒は少し出たフランジの輪、樋は内と外を回る細い縁。長さ方向のつやの帯は部品の色で
 * 色は部品の面ごとに 1 つの材質（材質ごとにまとめて描く）。模様（まだら・ノイズ）は使わない
 */

/** 部品 1 色の材質: 外の面・内の面（樋の内側。上を向いて明るい）・長さ方向のつやの帯（光る） */
export interface SlideTone {
  out: THREE.Material;
  inner: THREE.Material;
  hi: THREE.Material;
}

/**
 * スライダーの色の表。tones[0] の割合が share、残りが tones[1]（3 色目以降は使わない）。
 * walls: 幅広の樋で、区間の側壁の板が床の板と違う色になる割合。cap: 筒の終わりの部品の色（番号）
 */
export interface SlidePal {
  tones: SlideTone[];
  share: number;
  walls?: number;
  cap?: number;
}

/** 決まった乱数（Builder.ts の rng と同じ。Node の型ストリップで読めるようにここに置く） */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** つやを足すスライダーの材質（場面を作るたびに空にする） */
export const SLIDE_MATS = new Set<THREE.MeshStandardMaterial>();

/** 部品 1 色の材質を作る（外・内・つやの帯）。名前はつや（envMap）を足す目印 */
export function slideTone(ctx: SceneContext, name: string, out: string, inner: string, hi: string, hiK = 0.9): SlideTone {
  const o = ctx.mat({ color: out, toon: 0, line: 0, roughness: 0.2, name: `${name}` }) as THREE.MeshStandardMaterial;
  const i = ctx.mat({ color: inner, toon: 0, line: 0, roughness: 0.18, name: `${name}In` }) as THREE.MeshStandardMaterial;
  const h = ctx.mat({ color: '#000000', emissive: hi, emissiveIntensity: hiK, toon: 0, line: 0, side: THREE.DoubleSide, name: `${name}-hi` });
  SLIDE_MATS.add(o);
  SLIDE_MATS.add(i);
  return { out: o, inner: i, hi: h };
}

/** 1 色（＋ほとんど同じ色の 2 つ目の部品の色）の表。成形の部品ごとにわずかに色が違う単色のスライダー */
export function monoPal(a: SlideTone, b?: SlideTone): SlidePal {
  return b ? { tones: [a, b], share: 0.55 } : { tones: [a], share: 1 };
}

/**
 * 同じ色の部品のわずかな違い（外の面だけ少し違う色。内の面とつやの帯は元の色と共有して、材質の数を増やさない）
 */
export function slideVariant(ctx: SceneContext, base: SlideTone, name: string, out: string): SlideTone {
  const o = ctx.mat({ color: out, toon: 0, line: 0, roughness: 0.2, name }) as THREE.MeshStandardMaterial;
  SLIDE_MATS.add(o);
  return { out: o, inner: base.inner, hi: base.hi };
}

// ------------------------------------------------------------------ 道筋の読み取り

/** 道筋の長さの位置 d の点と向き（点の間はなめらかにつなぐ） */
class PathEval {
  readonly cum: number[] = [0];
  readonly L: number;
  readonly path: SweepPath;
  private readonly fr: { t: THREE.Vector3; s: THREE.Vector3; u: THREE.Vector3 }[];
  // パラメータプロパティは使わない（Node の型ストリップで測る道具からも読めるように）
  constructor(path: SweepPath) {
    this.path = path;
    for (let i = 1; i < path.pts.length; i++) this.cum.push(this.cum[i - 1] + path.pts[i].distanceTo(path.pts[i - 1]));
    this.L = this.cum[this.cum.length - 1];
    this.fr = frames(path);
  }

  at(d: number): { p: THREE.Vector3; s: THREE.Vector3; u: THREE.Vector3; t: THREE.Vector3 } {
    const c = this.cum;
    const x = Math.min(Math.max(d, 0), this.L);
    let lo = 0;
    let hi = c.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid] <= x) lo = mid;
      else hi = mid;
    }
    const f = (x - c[lo]) / Math.max(c[hi] - c[lo], 1e-6);
    const a = this.fr[lo];
    const b = this.fr[hi];
    return {
      p: this.path.pts[lo].clone().lerp(this.path.pts[hi], f),
      s: a.s.clone().lerp(b.s, f).normalize(),
      u: a.u.clone().lerp(b.u, f).normalize(),
      t: a.t.clone().lerp(b.t, f).normalize(),
    };
  }

  /** 位置 d の曲がり（1/m。前後 0.6 m の向きの変わり） */
  bend(d: number): number {
    const h = 0.6;
    const a = this.at(Math.max(d - h, 0)).t;
    const b = this.at(Math.min(d + h, this.L)).t;
    const span = Math.min(d + h, this.L) - Math.max(d - h, 0);
    return span > 0.05 ? a.angleTo(b) / span : 0;
  }
}

// ------------------------------------------------------------------ 部品に分ける・色を決める

export interface SlidePart {
  d0: number;
  d1: number;
  bend: boolean;
}

/** 道筋を部品に分ける（直線と曲がりを分け、直線は straight m・曲がりは bendLen m 前後。どれも 1.5〜4 m。終わりの tail m は 1 つの部品） */
export function splitParts(ev: PathEval, straight: number, bendLen: number, tail = 0): SlidePart[] {
  const L = ev.L;
  if (L < 2.2) return [{ d0: 0, d1: L, bend: false }];
  const step = 0.25;
  // 曲がりの区間の列（0.25 m ごとに分類）
  const runs: SlidePart[] = [];
  const end = tail > 0.8 && L - tail > 1.5 ? L - tail : L;
  for (let d = 0; d < end; d += step) {
    const d1 = Math.min(d + step, end);
    const b = ev.bend((d + d1) / 2) > 0.16;
    const last = runs[runs.length - 1];
    if (last && last.bend === b) last.d1 = d1;
    else runs.push({ d0: d, d1, bend: b });
  }
  // 短い区間（1.2 m 未満）は前の区間に入れる
  for (let i = 0; i < runs.length; ) {
    const r = runs[i];
    if (r.d1 - r.d0 < 1.2 && runs.length > 1) {
      if (i > 0) runs[i - 1].d1 = r.d1;
      else runs[1].d0 = r.d0;
      runs.splice(i, 1);
      // 同じ種類が隣り合ったらつなぐ
      for (let j = 1; j < runs.length; j++) {
        if (runs[j].bend === runs[j - 1].bend) {
          runs[j - 1].d1 = runs[j].d1;
          runs.splice(j, 1);
          j--;
        }
      }
      i = 0;
      continue;
    }
    i++;
  }
  const parts: SlidePart[] = [];
  for (const r of runs) {
    const len = r.d1 - r.d0;
    let n = Math.max(1, Math.round(len / (r.bend ? bendLen : straight)));
    while (len / n > 4 && n < 99) n++;
    while (n > 1 && len / n < 1.5) n--;
    for (let i = 0; i < n; i++) parts.push({ d0: r.d0 + (len * i) / n, d1: r.d0 + (len * (i + 1)) / n, bend: r.bend });
  }
  if (end < L) parts.push({ d0: end, d1: L, bend: false });
  return parts;
}

/**
 * 部品の色の並び（番号）。多い色の数を round(割合 × 部品の数) に決め、少ない色を 1 つずつ間に挟む（交互が基本）。
 * 多い色の余りは乱数で選んだ所を 2 つ続きにする（3 つは続けない。割合が 0.7 を超える表は除く）。
 * 筒は終わりの部品を pal.cap の色に（参考画像 3 の筒の終わりのミント）
 */
export function toneSeq(n: number, pal: SlidePal, seed: number): number[] {
  if (pal.tones.length < 2 || pal.share >= 0.999) return new Array(n).fill(0);
  const r = rng(seed);
  const maj = pal.share >= 0.5 ? 0 : 1;
  const min = 1 - maj;
  const pm = Math.max(pal.share, 1 - pal.share);
  if (n === 1) return [pal.cap ?? (r() < pm ? maj : min)];
  const maxRun = pm > 0.7 ? 6 : 2;
  const nMaj = Math.min(n - 1, Math.max(Math.ceil(n / 2), Math.round(pm * n)));
  const nMin = n - nMaj;
  // 多い色のかたまりの数 g = 少ない色の間（nMin - 1）＋ 始まりと終わり（多い色で始まる・終わるなら）
  let sm = r() < 0.75;
  let em = pal.cap !== undefined ? pal.cap === maj : r() < 0.5;
  const groups = (): number => nMin - 1 + (sm ? 1 : 0) + (em ? 1 : 0);
  while (groups() > nMaj) {
    if (em && pal.cap === undefined) em = false;
    else if (sm) sm = false;
    else em = false;
  }
  while (groups() * maxRun < nMaj) {
    if (!sm) sm = true;
    else em = true;
    if (sm && em) break;
  }
  const g = Math.max(1, groups());
  const size = new Array(g).fill(1);
  for (let extra = nMaj - g; extra > 0; ) {
    const i = Math.floor(r() * g);
    if (size[i] < maxRun || size.every((v) => v >= maxRun)) {
      size[i]++;
      extra--;
    }
  }
  const out: number[] = [];
  let gi = 0;
  const pushGroup = (): void => {
    for (let k = 0; k < size[gi]; k++) out.push(maj);
    gi++;
  };
  if (sm) pushGroup();
  for (let m = 0; m < nMin; m++) {
    out.push(min);
    if (m < nMin - 1 || em) if (gi < g) pushGroup();
  }
  while (gi < g) pushGroup();
  if (pal.cap !== undefined) out[out.length - 1] = pal.cap;
  return out.slice(0, n);
}

// ------------------------------------------------------------------ 断面

/** 樋の断面（左の壁・床・右の壁の板に分けた内と外。床の板は底の 80°） */
function troughProfiles(r: number, th: number, lip: number): { inner: P2[][]; outer: P2[][]; ring: P2[] } {
  const D = Math.PI / 180;
  const arc = (R: number, a0: number, a1: number, n: number): P2[] => Array.from({ length: n + 1 }, (_, i): P2 => {
    const a = (a0 + ((a1 - a0) * i) / n) * D;
    return [Math.cos(a) * R, Math.sin(a) * R];
  });
  const rim = th * 1.6;
  const R = r + th;
  const innerL: P2[] = [[-r, lip], ...arc(r, 180, 230, 4)];
  const innerF: P2[] = arc(r, 230, 310, 7);
  const innerR: P2[] = [...arc(r, 310, 360, 4), [r, lip]];
  const outerR: P2[] = [[r, lip], [R + rim * 0.5, lip + 0.02], [R + rim, lip - th * 0.4], [R, lip - th], ...arc(R, 360, 310, 4)];
  const outerF: P2[] = arc(R, 310, 230, 7);
  const outerL: P2[] = [...arc(R, 230, 180, 4), [-R, lip - th], [-R - rim, lip - th * 0.4], [-R - rim * 0.5, lip + 0.02], [-r, lip]];
  const ring: P2[] = [...innerL, ...innerF.slice(1), ...innerR.slice(1), ...outerR.slice(1), ...outerF.slice(1), ...outerL.slice(1, -1)];
  return { inner: [innerL, innerF, innerR], outer: [outerL, outerF, outerR], ring };
}

/**
 * 1 つの部品の帯を掃く。断面の点 j ごとに始まり dA(x) と終わり dB(x)（x = 断面の横の位置）が違ってよい（曲がった継ぎ目）。
 * scale(d) = 断面の横・縦の倍率（着水の広がり・幅広）
 */
function sweepSpan(ev: PathEval, prof: P2[], dA: (x: number) => number, dB: (x: number) => number, scale: (d: number) => [number, number], closed = false): THREE.BufferGeometry {
  const m = prof.length;
  let span = 0;
  for (const [x] of prof) span = Math.max(span, dB(x) - dA(x));
  const rows = Math.max(1, Math.ceil(span / 0.22));
  const pl: number[] = [0];
  for (let j = 1; j < m; j++) pl.push(pl[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
  const pos: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j < m; j++) {
      const [x, y] = prof[j];
      const a = dA(x);
      const d = a + ((dB(x) - a) * i) / rows;
      const f = ev.at(d);
      const [sx, sy] = scale(d);
      const X = x * sx;
      const Y = y * sy;
      pos.push(f.p.x + f.s.x * X + f.u.x * Y, f.p.y + f.s.y * X + f.u.y * Y, f.p.z + f.s.z * X + f.u.z * Y);
      uv.push(pl[j], d);
    }
  }
  const idx: number[] = [];
  const ring = closed ? m : m - 1;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < ring; j++) {
      const j1 = (j + 1) % m;
      const a = i * m + j;
      const b = (i + 1) * m + j;
      const c = (i + 1) * m + j1;
      const d = i * m + j1;
      idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 点の列を通る細い管（継ぎ目の縁） */
function seamTube(pts: THREE.Vector3[], r: number): THREE.BufferGeometry {
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return new THREE.TubeGeometry(c, Math.max(4, pts.length * 2), r, 4, false);
}

// ------------------------------------------------------------------ 1 本のスライダー

export interface SlideSpec {
  path: SweepPath;
  /** trough = 開いた樋、tube = 筒 */
  kind: 'trough' | 'tube';
  r: number;
  /** 部品の色の表 */
  pal: SlidePal;
  /** 筒の内側（暗い。どの部品も同じ） */
  tubeIn?: THREE.Material;
  /** 直線の部品の長さの目安（m）。曲がりはその 0.75 倍。既定は筒 2.2・樋 2.6 */
  part?: number;
  /** 樋の縁の高さ（中心より上。既定 r * 0.35） */
  lip?: number;
  /** 幅広の樋: 断面の横の倍率（底の広い浅い樋）。1.25 以上で継ぎ目を少し曲げ、側壁と床の板を分ける */
  wide?: number;
  /** 支柱: 間隔・床の高さ・材質（道筋の下から床まで） */
  posts?: { every: number; floor: number; mat: THREE.Material; r?: number; minH?: number; skip?: (p: THREE.Vector3) => boolean };
  /** 終わりの広がり: 最後の len m で断面の幅を 1 → k 倍、深さを 1 → ky 倍に（着水の幅広で浅い出口。1 つの部品） */
  flare?: { len: number; k: number; ky?: number };
  /** 色の並びの種（既定は始点の位置から） */
  seed?: number;
}

/** スライダー 1 本（道筋はワールド） */
export function buildSlide(k: HallKit, s: SlideSpec): void {
  const ev = new PathEval(s.path);
  const L = ev.L;
  const r = s.r;
  const th = Math.max(0.05, r * 0.07);
  const wide = s.wide ?? 1;
  const isWide = s.kind === 'trough' && wide >= 1.25;
  const p0 = s.path.pts[0];
  const seed = s.seed ?? Math.abs(Math.round(p0.x * 731.3 + p0.y * 197.1 + p0.z * 53.7)) + 11;
  const rnd = rng(seed * 7 + 3);
  const target = s.part ?? (s.kind === 'tube' ? 2.2 : isWide ? 3.0 : 2.6);
  const parts = splitParts(ev, target, Math.max(1.6, target * 0.75), s.kind === 'trough' ? (s.flare?.len ?? 0) : 0);
  const seq = toneSeq(parts.length, s.pal, seed);
  SLIDE_LOG.push({ at: [+p0.x.toFixed(1), +p0.y.toFixed(1), +p0.z.toFixed(1)], kind: s.kind, lens: parts.map((p) => +(p.d1 - p.d0).toFixed(2)), seq });
  const tone = (i: number): SlideTone => s.pal.tones[Math.min(seq[i], s.pal.tones.length - 1)];
  const other = (i: number): SlideTone => s.pal.tones.length > 1 ? s.pal.tones[1 - Math.min(seq[i], 1)] : tone(i);

  // 終わりの広がりと幅広の倍率（樋だけ）
  const scale = (d: number): [number, number] => {
    if (s.kind !== 'trough') return [1, 1];
    let sx = wide;
    let sy = 1;
    const f = s.flare;
    if (f) {
      const t = Math.min(Math.max((d - (L - f.len)) / f.len, 0), 1);
      const e = t * t * (3 - 2 * t);
      sx *= 1 + (f.k - 1) * e;
      sy *= 1 + ((f.ky ?? f.k) - 1) * e;
    }
    return [sx, sy];
  };

  // 継ぎ目の位置（部品 i の始まり）。幅広の樋は断面の横の位置で少し曲がる（成形の部品の合わせ目の形）
  const outerW = r + th + th * 1.6;
  const bows: ((x: number) => number)[] = parts.map((p, i) => {
    if (i === 0) return () => 0;
    if (!isWide) return () => 0;
    const prev = parts[i - 1];
    const amp = Math.min(0.45, 0.22 * Math.min(p.d1 - p.d0, prev.d1 - prev.d0));
    const c1 = (rnd() * 2 - 1) * amp;
    const c2 = (rnd() * 2 - 1) * amp;
    return (x: number) => {
      const xn = Math.max(-1, Math.min(1, x / outerW));
      return c1 * xn + c2 * (xn * xn - 0.35);
    };
  });
  const startOf = (i: number) => (x: number): number => (i === 0 ? 0 : parts[i].d0 + bows[i](x));
  const endOf = (i: number) => (x: number): number => (i === parts.length - 1 ? L : parts[i + 1].d0 + bows[i + 1](x));

  const D = Math.PI / 180;
  if (s.kind === 'trough') {
    const lip = s.lip ?? r * 0.35;
    const prof = troughProfiles(r, th, lip);
    parts.forEach((_, i) => {
      const t = tone(i);
      // 幅広の樋: 側壁の板が床の板と違う色の区間（左右は同じ色。時々左右も違う）
      let wl = t;
      let wr = t;
      if (isWide && s.pal.tones.length > 1) {
        const pw = s.pal.walls ?? 0.4;
        if (rnd() < pw) wl = wr = other(i);
        if (rnd() < 0.25) wr = wr === t ? other(i) : t;
      }
      const tones = [wl, t, wr];
      const a = startOf(i);
      const b = endOf(i);
      for (let q = 0; q < 3; q++) {
        k.meshW(sweepSpan(ev, prof.inner[q], a, b, scale), tones[q].inner, { shadow: false });
        k.meshW(sweepSpan(ev, prof.outer[q], a, b, scale), tones[q].out, { shadow: false });
      }
      // 長さ方向のつやの帯（内側の縁の近く。帯のある板の色）
      const band = (R: number, a0: number, a1: number, tn: SlideTone): void => {
        const pts: P2[] = [];
        for (let j = 0; j <= 4; j++) {
          const ang = (a0 + ((a1 - a0) * j) / 4) * D;
          pts.push([Math.cos(ang) * R, Math.sin(ang) * R]);
        }
        k.meshW(sweepSpan(ev, pts, a, b, scale), tn.hi, { shadow: false });
      };
      band(r - 0.006, 318, 336, wr);
      band(r - 0.006, 200, 208, wl);
      // 幅広の樋: 側壁と床の板の境の細い縁（長さ方向）
      if (isWide) {
        for (const ang of [230, 310]) {
          const c = Math.cos(ang * D);
          const sn = Math.sin(ang * D);
          const w = 0.03;
          const h = 0.014;
          const B: P2 = [c * r, sn * r];
          const tau: P2 = [-sn, c];
          const lipProf: P2[] = [
            [B[0] - tau[0] * w - c * 0.002, B[1] - tau[1] * w - sn * 0.002],
            [B[0] - c * h, B[1] - sn * h],
            [B[0] + tau[0] * w - c * 0.002, B[1] + tau[1] * w - sn * 0.002],
          ];
          k.meshW(sweepSpan(ev, lipProf, a, b, scale), t.inner, { shadow: false });
        }
      }
    });
    // 継ぎ目の縁（内と外を回る細い管）。次の部品の色
    const seamR = Math.min(0.022, Math.max(0.012, r * 0.022));
    for (let i = 1; i < parts.length; i++) {
      const bow = bows[i];
      const t = tone(i);
      const inn: THREE.Vector3[] = [];
      const out: THREE.Vector3[] = [];
      const push = (arr: THREE.Vector3[], [x, y]: P2, k0: number): void => {
        const d = parts[i].d0 + bow(x);
        const f = ev.at(d);
        const [sx, sy] = scale(d);
        const X = x * k0 * sx;
        const Y = y * k0 * sy;
        arr.push(f.p.clone().addScaledVector(f.s, X).addScaledVector(f.u, Y));
      };
      const ki = (r - 0.01) / r;
      for (const q of [0, 1, 2]) for (const pt of (q === 0 ? prof.inner[q] : prof.inner[q].slice(1))) push(inn, pt, ki);
      const ko = (r + th + 0.012) / (r + th);
      for (const q of [2, 1, 0]) for (const pt of (q === 2 ? prof.outer[q].slice(3) : prof.outer[q].slice(1))) if (pt[1] < lip - th * 0.9) push(out, pt, ko);
      k.meshW(seamTube(inn, seamR), t.inner, { shadow: false });
      if (out.length > 2) k.meshW(seamTube(out, seamR * 1.4), t.out, { shadow: false });
    }
    // 両端の切り口（樋の厚みの輪をふさぐ）
    for (const [end, pi] of [[0, 0], [L, parts.length - 1]] as [number, number][]) {
      const f = ev.at(end);
      const [sx, sy] = scale(end);
      const shape = new THREE.Shape(prof.ring.map(([x, y]) => new THREE.Vector2(x * sx, y * sy)));
      const g = new THREE.ShapeGeometry(shape, 2);
      if (end === 0) g.applyMatrix4(new THREE.Matrix4().makeBasis(f.s.clone().negate(), f.u, f.t.clone().negate()));
      else g.applyMatrix4(new THREE.Matrix4().makeBasis(f.s, f.u, f.t));
      g.translate(f.p.x, f.p.y, f.p.z);
      k.meshW(g, tone(pi).out, { shadow: false });
    }
  } else {
    // 筒: 部品ごとに外の面（色）と内の面（暗い）
    const outer = ringProfile(r + th, 20).reverse();
    const inner = ringProfile(r, 20);
    parts.forEach((_, i) => {
      const t = tone(i);
      const a = startOf(i);
      const b = endOf(i);
      k.meshW(sweepSpan(ev, outer, a, b, scale, true), t.out, { shadow: false });
      if (s.tubeIn) k.meshW(sweepSpan(ev, inner, a, b, scale, true), s.tubeIn, { shadow: false });
      // つやの帯（上の外側）
      const band = (a0: number, a1: number): void => {
        const pts: P2[] = [];
        for (let j = 0; j <= 4; j++) {
          const ang = (a0 + ((a1 - a0) * j) / 4) * D;
          pts.push([Math.cos(ang) * (r + th + 0.006), Math.sin(ang) * (r + th + 0.006)]);
        }
        k.meshW(sweepSpan(ev, pts, a, b, scale), t.hi, { shadow: false });
      };
      band(58, 74);
      band(112, 118);
    });
    // フランジの輪（部品の継ぎ目と両端）。継ぎ目は次の部品の色
    const ring = (d: number, tn: SlideTone, big: number): void => {
      const f = ev.at(d);
      const tor = new THREE.TorusGeometry(r + th + 0.02 * big, 0.035 * big, 5, 22);
      tor.applyMatrix4(new THREE.Matrix4().makeBasis(f.s, f.u, f.t.clone().negate()));
      tor.translate(f.p.x, f.p.y, f.p.z);
      k.meshW(tor, tn.out, { shadow: false });
    };
    for (let i = 1; i < parts.length; i++) ring(parts[i].d0, tone(i), 1);
    ring(0.02, tone(0), 1.3);
    ring(L - 0.02, tone(parts.length - 1), 1.3);
  }
  if (s.posts) {
    const pr = s.posts.r ?? 0.11;
    for (let d = s.posts.every * 0.5; d < L; d += s.posts.every) {
      const { p } = sampleAt(s.path, d);
      if (s.posts.skip?.(p)) continue;
      const top = p.y - r - th;
      const h = top - s.posts.floor;
      if (h < (s.posts.minH ?? 0.4)) continue;
      const g = new THREE.CylinderGeometry(pr, pr, h, 10);
      g.translate(p.x, s.posts.floor + h / 2, p.z);
      k.meshW(g, s.posts.mat, { shadow: false });
      // 受けの腕（横の短い棒）
      const arm = new THREE.BoxGeometry(r * 1.6 * wide, 0.08, 0.12);
      arm.translate(p.x, top - 0.04, p.z);
      k.meshW(arm, s.posts.mat, { shadow: false });
      // 足元の板
      const base = new THREE.CylinderGeometry(pr * 2.2, pr * 2.4, 0.06, 12);
      base.translate(p.x, s.posts.floor + 0.03, p.z);
      k.meshW(base, s.posts.mat, { shadow: false });
      k.ctx.colliders.add({ x: p.x - pr, y: s.posts.floor, z: p.z - pr }, { x: p.x + pr, y: top, z: p.z + pr });
    }
  }
}

/** 作ったスライダーの部品の色の並び（確かめ用。場面を作るたびに空にする） */
export const SLIDE_LOG: { at: [number, number, number]; kind: string; lens: number[]; seq: number[] }[] = [];
