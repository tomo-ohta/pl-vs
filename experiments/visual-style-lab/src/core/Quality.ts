/**
 * 質感の物差し（写っていない所の作り込みを数値で見る）。
 * 参考画像・参考画像の視点の描画・道順・無作為の場所の撮影を同じ物差しで測り、
 * 「参考画像の視点と同じ程度の情報量・明暗・色か」を比べる。画素の位置は比べない（構図が違うので）。
 *
 * - detail   細かい輪郭の割合（半分の大きさの画像で、明るさの差が 0.025 を超える画素）… 小物・貼り紙・目地・ちぎれた縁
 * - shape    中くらいの輪郭の割合（1/8 の大きさ）… 家具・柱型・枠・開口などの形の多さ
 * - light    大きな明暗の変化（1/32 の大きさの明るさの標準偏差）… 日なたと陰・光だまり・暗がり
 * - contrast 明るさの幅（5〜95 % の差）
 * - flat     平らな画素の割合（細かい輪郭の無い所）。大きいほど「何も無い面」が多い
 * - chroma   平均の彩度
 * - palette  参考画像の色（場所ごとの 16 色）までの平均の色差（×100）。大きいほど参考画像に無い色
 * 明るさ・色は OKLab。
 */

export interface ImageStats {
  detail: number;
  shape: number;
  light: number;
  contrast: number;
  flat: number;
  chroma: number;
  palette: number;
}

const W = 728;
const H = 408;

function srgbToLin(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function oklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** 画像を 728×408 の OKLab（L・a・b の 3 枚）にする */
export function toLab(img: CanvasImageSource): { L: Float32Array; A: Float32Array; B: Float32Array } {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const L = new Float32Array(W * H);
  const A = new Float32Array(W * H);
  const B = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [l, a, b] = oklab(srgbToLin(d[i * 4]), srgbToLin(d[i * 4 + 1]), srgbToLin(d[i * 4 + 2]));
    L[i] = l;
    A[i] = a;
    B[i] = b;
  }
  return { L, A, B };
}

/** 平均で縮める（k 倍） */
function shrink(src: Float32Array, w: number, h: number, k: number): { d: Float32Array; w: number; h: number } {
  const nw = Math.floor(w / k);
  const nh = Math.floor(h / k);
  const d = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++) {
      let s = 0;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += src[(y * k + j) * w + x * k + i];
      d[y * nw + x] = s / (k * k);
    }
  return { d, w: nw, h: nh };
}

/** Sobel の強さ（差の大きさ。1 画素の段差 Δ で約 Δ） */
function gradient(L: Float32Array, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
      const gy = L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
      g[i] = Math.hypot(gx, gy) / 4;
    }
  return g;
}

/** 参考画像の色を 16 色にまとめる（k 平均。OKLab） */
export function palette(imgs: { L: Float32Array; A: Float32Array; B: Float32Array }[], k = 16): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (const m of imgs) for (let i = 0; i < m.L.length; i += 37) pts.push([m.L[i], m.A[i], m.B[i]]);
  pts.sort((p, q) => p[0] - q[0]);
  // 明るさの順に等間隔で種を取る
  const cs: [number, number, number][] = Array.from({ length: k }, (_, i) => [...pts[Math.floor(((i + 0.5) / k) * pts.length)]] as [number, number, number]);
  const asg = new Int32Array(pts.length);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (pts[i][0] - cs[c][0]) ** 2 + (pts[i][1] - cs[c][1]) ** 2 + (pts[i][2] - cs[c][2]) ** 2;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      asg[i] = best;
    }
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      const s = sum[asg[i]];
      s[0] += pts[i][0];
      s[1] += pts[i][1];
      s[2] += pts[i][2];
      s[3]++;
    }
    for (let c = 0; c < k; c++) if (sum[c][3] > 0) cs[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
  }
  return cs;
}

export function imageStats(m: { L: Float32Array; A: Float32Array; B: Float32Array }, pal?: [number, number, number][]): ImageStats {
  const { L, A, B } = m;
  const n = W * H;
  const g = gradient(L, W, H);
  let det = 0;
  let flat = 0;
  for (let i = 0; i < n; i++) {
    if (g[i] > 0.025) det++;
    if (g[i] < 0.006) flat++;
  }
  const s8 = shrink(L, W, H, 8);
  const g8 = gradient(s8.d, s8.w, s8.h);
  let shp = 0;
  for (let i = 0; i < g8.length; i++) if (g8[i] > 0.02) shp++;
  const s32 = shrink(L, W, H, 32);
  let mean = 0;
  for (const v of s32.d) mean += v;
  mean /= s32.d.length;
  let vr = 0;
  for (const v of s32.d) vr += (v - mean) ** 2;
  const sorted = Float32Array.from(L).sort();
  const contrast = sorted[Math.floor(n * 0.95)] - sorted[Math.floor(n * 0.05)];
  let chroma = 0;
  for (let i = 0; i < n; i++) chroma += Math.hypot(A[i], B[i]);
  let pd = 0;
  if (pal) {
    let cnt = 0;
    for (let i = 0; i < n; i += 7) {
      let bd = Infinity;
      for (const c of pal) bd = Math.min(bd, (L[i] - c[0]) ** 2 + (A[i] - c[1]) ** 2 + (B[i] - c[2]) ** 2);
      pd += Math.sqrt(bd);
      cnt++;
    }
    pd /= cnt;
  }
  const r = (v: number, d = 1000): number => Math.round(v * d) / d;
  return {
    detail: r(det / n),
    shape: r(shp / g8.length),
    light: r(Math.sqrt(vr / s32.d.length)),
    contrast: r(contrast),
    flat: r(flat / n),
    chroma: r(chroma / n),
    palette: r(pd * 100, 10),
  };
}

/** 決まった種の乱数（無作為の場所を毎回同じにする） */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
