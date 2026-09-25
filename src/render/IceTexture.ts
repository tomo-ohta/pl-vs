import * as THREE from 'three';

/**
 * 凍った床の絵（第22回。L19 凍結リゾートの凍結プール・氷の床）: 以前は水色のタイル（+ 発光する青い箔）で、凍っているように見えなかった。
 * 実物の氷面の特徴を手続きで 1 枚（繰り返し）に描く:
 * - 地: 透明な黒氷（下の暗さが透ける青灰）と白く濁った氷のまだら（低周波ノイズ）
 * - 霜: 細かいノイズの白い斑（粗い）
 * - ひび: 折れ線で分かれていく白い亀裂（細い線 + 淡いにじみ）と、衝撃点から放射状に走る割れ
 * - 気泡: 小さな白い粒の群れ（閉じ込められた空気）
 * - 擦り傷: 長い弧の淡い線（スケートの跡）
 * 法線（ひび・傷は溝）と粗さ（透明な氷は艶、霜・ひびは粗い。G チャンネル）も同じ絵から作る。すべて 4 辺でつながる（繰り返し）。
 * document の無い環境（Node のテスト）では null（呼び出し側は従来の材質）
 */
export interface IceMaps { map: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture }

/** 1 枚の画素数（1 枚で ICE_METERS m） */
const N = 1024;
/** 1 枚が覆う大きさ（m）。SURFACES.ice.meters と同じ */
export const ICE_METERS = 6;

export function createIceMaps(): IceMaps | null {
  if (typeof document === 'undefined') return null;
  let seed = 0x1ce5eed;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;

  // ---------------------------------------------------------------- 繰り返すノイズ（値ノイズの fbm）
  const lattice = (size: number) => Float32Array.from({ length: size * size }, () => rnd());
  const sample = (g: Float32Array, size: number, u: number, v: number) => {
    const x = u * size, y = v * size, x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number) => g[(((j % size) + size) % size) * size + (((i % size) + size) % size)];
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  const fbm = (sizes: number[]) => {
    const oct = sizes.map((size) => ({ size, g: lattice(size) }));
    return (u: number, v: number) => { let s = 0, amp = 1, sum = 0; for (const o of oct) { s += sample(o.g, o.size, u, v) * amp; sum += amp; amp *= 0.55; } return s / sum; };
  };
  const cloud = fbm([3, 6, 12, 24]); // 黒氷 / 白い氷のまだら
  const frostN = fbm([8, 16, 32, 64, 128]); // 霜の斑
  const grain = fbm([256]); // 細かいざらつき

  // ---------------------------------------------------------------- 地（画素ごと）
  const base = new Uint8ClampedArray(N * N * 4);
  const rough = new Float32Array(N * N);
  const height = new Float32Array(N * N);
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    const c = smooth(0.38, 0.68, cloud(u, v));
    const f = smooth(0.58, 0.78, frostN(u, v));
    const g = grain(u, v) - 0.5;
    // 黒氷（青灰、暗い）→ 白く濁った氷
    let r = 50 + (160 - 50) * c, gg = 86 + (194 - 86) * c, b = 110 + (212 - 110) * c;
    // 霜（白、わずかに青）
    r += (226 - r) * f * 0.85; gg += (234 - gg) * f * 0.85; b += (240 - b) * f * 0.85;
    r += g * 10; gg += g * 10; b += g * 8;
    base[i * 4] = r; base[i * 4 + 1] = gg; base[i * 4 + 2] = b; base[i * 4 + 3] = 255;
    rough[i] = 0.06 + 0.1 * c + 0.55 * f + 0.03 * g;
    height[i] = 0.5 + 0.04 * f + 0.02 * g;
  }

  // ---------------------------------------------------------------- 線（ひび・擦り傷・気泡）はキャンバスに描いてから合成
  const mk = () => { const cv = document.createElement('canvas'); cv.width = cv.height = N; return cv; };
  const lines = mk(); // 色（白）の線: α が濃さ
  const lctx = lines.getContext('2d')!;
  const grooves = mk(); // 溝（高さ）: α が深さ
  const gctx = grooves.getContext('2d')!;
  const roughC = mk(); // 粗さの加算
  const rctx = roughC.getContext('2d')!;
  for (const ctx of [lctx, gctx, rctx]) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }

  /** 折れ線を 9 回（±N ずらし）描いて繰り返しの境目でつなぐ */
  const strokeWrapped = (pts: [number, number][], draw: (ctx: CanvasRenderingContext2D) => void, ctx: CanvasRenderingContext2D) => {
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)));
      draw(ctx);
    }
  };
  const cracks: { pts: [number, number][]; w: number; a: number }[] = [];
  /** 亀裂: 6〜14 px ごとに向きを少し振り、ときどき鋭く折れ、ときどき枝分かれする */
  const crack = (x: number, y: number, ang: number, len: number, w: number, a: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    let l = 0;
    while (l < len) {
      const step = 6 + rnd() * 8;
      ang += gauss() * 0.16 + (rnd() < 0.06 ? (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.5) : 0);
      x += Math.cos(ang) * step; y += Math.sin(ang) * step; l += step;
      pts.push([x, y]);
      if (depth < 3 && rnd() < 0.045) crack(x, y, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.7), (len - l) * (0.3 + rnd() * 0.4), w * 0.7, a * 0.8, depth + 1);
    }
    cracks.push({ pts, w, a });
  };
  // 長い主亀裂
  for (let k = 0; k < 7; k++) crack(rnd() * N, rnd() * N, rnd() * Math.PI * 2, 380 + rnd() * 520, 1.6, 0.62, 0);
  // 衝撃点の放射状の割れ（と短い同心の割れ）
  for (let k = 0; k < 3; k++) {
    const cx = rnd() * N, cy = rnd() * N, n = 5 + Math.floor(rnd() * 4);
    for (let j = 0; j < n; j++) crack(cx, cy, (j / n) * Math.PI * 2 + gauss() * 0.2, 60 + rnd() * 140, 1.2, 0.55, 1);
    for (let ring = 0; ring < 2; ring++) {
      const R = 22 + ring * 30 + rnd() * 10, a0 = rnd() * Math.PI * 2;
      for (let j = 0; j < n; j++) {
        if (rnd() < 0.35) continue;
        const t0 = a0 + (j / n) * Math.PI * 2, t1 = t0 + (Math.PI * 2 / n) * (0.5 + rnd() * 0.4);
        const pts: [number, number][] = [];
        for (let q = 0; q <= 4; q++) { const t = t0 + (t1 - t0) * (q / 4); const rr = R * (0.9 + rnd() * 0.2); pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); }
        cracks.push({ pts, w: 0.9, a: 0.4 });
      }
    }
  }
  // 細かい毛のようなひび（短い）
  for (let k = 0; k < 90; k++) crack(rnd() * N, rnd() * N, rnd() * Math.PI * 2, 20 + rnd() * 60, 0.7, 0.3, 3);
  for (const c of cracks) {
    // 淡いにじみ（ひびの中で光が散る）→ 芯の白い線
    strokeWrapped(c.pts, (ctx) => { ctx.strokeStyle = `rgba(235,245,250,${(c.a * 0.16).toFixed(3)})`; ctx.lineWidth = c.w * 4.5; ctx.stroke(); }, lctx);
    strokeWrapped(c.pts, (ctx) => { ctx.strokeStyle = `rgba(240,248,252,${c.a.toFixed(3)})`; ctx.lineWidth = c.w; ctx.stroke(); }, lctx);
    strokeWrapped(c.pts, (ctx) => { ctx.strokeStyle = `rgba(0,0,0,${Math.min(1, c.a * 1.2).toFixed(3)})`; ctx.lineWidth = c.w * 1.4; ctx.stroke(); }, gctx);
    strokeWrapped(c.pts, (ctx) => { ctx.strokeStyle = `rgba(255,255,255,${(c.a * 0.5).toFixed(3)})`; ctx.lineWidth = c.w * 2; ctx.stroke(); }, rctx);
  }
  // 擦り傷（スケートの跡）: 長い弧
  for (let k = 0; k < 26; k++) {
    const cx = rnd() * N, cy = rnd() * N, R = 300 + rnd() * 900, a0 = rnd() * Math.PI * 2, span = 0.15 + rnd() * 0.35;
    const pts: [number, number][] = [];
    for (let q = 0; q <= 24; q++) { const t = a0 + span * (q / 24); pts.push([cx + Math.cos(t) * R, cy + Math.sin(t) * R]); }
    const a = 0.06 + rnd() * 0.1;
    strokeWrapped(pts, (ctx) => { ctx.strokeStyle = `rgba(225,235,240,${a.toFixed(3)})`; ctx.lineWidth = 0.8 + rnd() * 0.8; ctx.stroke(); }, lctx);
    strokeWrapped(pts, (ctx) => { ctx.strokeStyle = `rgba(0,0,0,${(a * 2).toFixed(3)})`; ctx.lineWidth = 1; ctx.stroke(); }, gctx);
    strokeWrapped(pts, (ctx) => { ctx.strokeStyle = `rgba(255,255,255,${(a * 2.5).toFixed(3)})`; ctx.lineWidth = 2; ctx.stroke(); }, rctx);
  }
  // 気泡: 群れごとに 20〜60 粒（中心ほど密）
  for (let k = 0; k < 22; k++) {
    const cx = rnd() * N, cy = rnd() * N, n = 20 + Math.floor(rnd() * 40), spread = 12 + rnd() * 40;
    for (let j = 0; j < n; j++) {
      const r = 0.6 + rnd() * rnd() * 3.2;
      const px = cx + gauss() * spread, py = cy + gauss() * spread;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        lctx.beginPath(); lctx.arc(px + ox, py + oy, r, 0, Math.PI * 2);
        lctx.fillStyle = `rgba(230,240,246,${(0.18 + rnd() * 0.25).toFixed(3)})`; lctx.fill();
        lctx.strokeStyle = `rgba(245,250,252,${(0.35 + rnd() * 0.3).toFixed(3)})`; lctx.lineWidth = 0.6; lctx.stroke();
      }
    }
  }

  // ---------------------------------------------------------------- 合成
  const L = lctx.getImageData(0, 0, N, N).data, G = gctx.getImageData(0, 0, N, N).data, Rr = rctx.getImageData(0, 0, N, N).data;
  const rgba = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const a = L[i * 4 + 3] / 255;
    for (let ch = 0; ch < 3; ch++) rgba[i * 4 + ch] = base[i * 4 + ch] * (1 - a) + L[i * 4 + ch] * a;
    rgba[i * 4 + 3] = 255;
    height[i] -= 0.35 * (G[i * 4 + 3] / 255);
    rough[i] = Math.min(1, rough[i] + 0.45 * (Rr[i * 4 + 3] / 255));
  }
  const colorCv = mk();
  const cctx = colorCv.getContext('2d')!;
  cctx.putImageData(new ImageData(rgba, N, N), 0, 0);
  const map = new THREE.CanvasTexture(colorCv);
  map.colorSpace = THREE.SRGBColorSpace;

  // 法線（OpenGL +Y、周期の中心差分）と粗さ（G）
  const nrm = new Uint8Array(N * N * 4), rgh = new Uint8Array(N * N * 4);
  const hAt = (x: number, y: number) => height[(((y + N) % N) * N) + ((x + N) % N)];
  const k = 6; // 溝の傾きの強さ
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * k, dy = (hAt(x, y + 1) - hAt(x, y - 1)) * k;
    const inv = 1 / Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    nrm[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255); nrm[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255); nrm[i + 2] = Math.round((inv * 0.5 + 0.5) * 255); nrm[i + 3] = 255;
    const r = Math.round(Math.min(1, Math.max(0.04, rough[y * N + x])) * 255);
    rgh[i] = r; rgh[i + 1] = r; rgh[i + 2] = r; rgh[i + 3] = 255;
  }
  const data = (d: Uint8Array, name: string) => {
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
    t.colorSpace = THREE.NoColorSpace; t.name = `generated/ice/${name}`;
    return t;
  };
  const normal = data(nrm, 'normal-OpenGL'), roughness = data(rgh, 'roughness-G');
  map.name = 'generated/ice/albedo';
  for (const t of [map, normal, roughness]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.needsUpdate = true;
  }
  return { map, normal, roughness };
}
