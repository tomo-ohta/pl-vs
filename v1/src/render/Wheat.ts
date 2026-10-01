import * as THREE from 'three';

/**
 * 麦畑（L03 倉庫内麦畑。InstanceOvergrowth propId 'wheat'）の見た目。
 *
 * - 株 = 縦の板 3 枚を 60° ずつ交差（上から見て米印）。1 枚は幅 WHEAT_CARD_W × 高さ WHEAT_H、縦 2 段（揺れで曲がる）。
 *   1 株 12 三角形。InstancedMesh で数万株並べる（RoomBuilder buildInstances の mat 'wheat'）
 * - 板の絵（createWheatTexture。起動後 1 回だけ Canvas に描く）: 茎 16 本（根元の黄緑 → 穂の下の金色、少し撓む）、根元の葉 14 枚、
 *   穂（小穂を左右交互に 9〜11 段）と上へ伸びる芒（のぎ）。背景は透明。材質は alphaTest + alphaToCoverage（MSAA で縁が滑らか）。
 *   縮小画像は被覆率を保つ（coverageMips。遠くで茎が消えない）
 * - 風（MaterialLibrary の 'wheat' 注入）: 頂点の高さ² に比例して、株の位置の位相で揺らす（根元は動かない）
 * 板の UV: u 0..1 = 幅、v 0..1 = 根元 → 穂先
 */
export const WHEAT_H = 1.05;
export const WHEAT_CARD_W = 0.62;

export function wheatClumpGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  const rows = 2;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    const dx = Math.cos(a), dz = Math.sin(a);
    // 法線は上寄り（板の向きに依らず、上から照らされた草の塊として陰影が揃う）
    const nx = -dz * 0.35, nz = dx * 0.35, ny = 0.94;
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      for (const u of [0, 1]) {
        const s = (u - 0.5) * WHEAT_CARD_W;
        pos.push(dx * s, v * WHEAT_H, dz * s);
        nrm.push(nx, ny, nz);
        uv.push(k === 1 ? 1 - u : u, v);
      }
    }
    for (let r = 0; r < rows; r++) {
      const i = base + r * 2;
      idx.push(i, i + 1, i + 3, i, i + 3, i + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** 板の絵（512 × 1024。上が穂先）。document が無い環境では null */
export function createWheatTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const W = 512, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  if (!g) return null;
  let seed = 0x5eed1234;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  g.clearRect(0, 0, W, H);
  g.lineCap = 'round';
  // 根元の葉（細長い弧。枯れかけた黄緑〜黄土）
  for (let i = 0; i < 14; i++) {
    const x0 = W * (0.06 + rnd() * 0.88), dir = rnd() < 0.5 ? -1 : 1;
    g.strokeStyle = `rgb(${150 + rnd() * 40 | 0},${138 + rnd() * 30 | 0},${62 + rnd() * 24 | 0})`;
    g.lineWidth = 7 + rnd() * 5;
    g.beginPath();
    g.moveTo(x0, H);
    g.quadraticCurveTo(x0 + dir * 30, H * (0.7 - rnd() * 0.12), x0 + dir * (60 + rnd() * 70), H * (0.56 - rnd() * 0.16));
    g.stroke();
  }
  const stalks = 16;
  for (let i = 0; i < stalks; i++) {
    const x0 = W * (0.05 + (i + rnd() * 0.9) / stalks * 0.9);
    const lean = (rnd() - 0.5) * 80;
    const top = H * (0.02 + rnd() * 0.16); // 穂先の y（上から）
    const earLen = H * (0.16 + rnd() * 0.05);
    const earBase = top + earLen;
    const xt = x0 + lean;
    // 茎: 根元の黄緑 → 穂の下の金色
    const grad = g.createLinearGradient(0, H, 0, earBase);
    grad.addColorStop(0, 'rgb(150,146,74)');
    grad.addColorStop(0.45, 'rgb(212,182,98)');
    grad.addColorStop(1, 'rgb(238,206,124)');
    g.strokeStyle = grad;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x0, H);
    g.quadraticCurveTo(x0 + lean * 0.2, H * 0.55, xt, earBase);
    g.stroke();
    // 穂: 小穂（楕円）を左右交互に。下ほど少し大きい
    const steps = 9 + (rnd() * 3 | 0);
    const tilt = lean / 900 + (rnd() - 0.5) * 0.12;
    for (let k = 0; k < steps; k++) {
      const t = k / (steps - 1); // 0 = 穂の根元、1 = 穂先
      const y = earBase - t * earLen;
      const x = xt + Math.sin(tilt) * (earBase - y) * 0.6;
      const side = k % 2 === 0 ? -1 : 1;
      const rw = 11 - t * 4, rh = 19 - t * 6;
      const c = 222 + rnd() * 28 | 0;
      g.fillStyle = `rgb(${c},${c - 28 - (rnd() * 14 | 0)},${104 + rnd() * 24 | 0})`;
      g.beginPath();
      g.ellipse(x + side * rw * 0.5, y, rw, rh, side * 0.45 + tilt, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(150,112,52,0.35)';
      g.beginPath();
      g.ellipse(x + side * rw * 0.75, y + rh * 0.35, rw * 0.5, rh * 0.45, side * 0.45 + tilt, 0, Math.PI * 2);
      g.fill();
      // 芒: 小穂の先から上へ長い線
      g.strokeStyle = 'rgba(240,216,150,0.9)';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x + side * rw * 0.9, y - rh * 0.6);
      g.lineTo(x + side * (rw * 1.5 + 8 + rnd() * 12), y - rh * 0.6 - (55 + rnd() * 45));
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  // 縮小画像は被覆率を保つ（ぼかした縮小で細い茎の α が alphaTest を下回り、遠くの麦が消えるのを防ぐ）
  const mips = coverageMips(cv, 0.4);
  if (mips) { tex.mipmaps = mips; tex.generateMipmaps = false; tex.minFilter = THREE.LinearMipmapLinearFilter; }
  tex.name = 'wheat/card';
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * 被覆率を保つ縮小画像の列（1 段ごとに半分。各段は α を k 倍して「α > threshold の画素の割合」を元画像と揃える。k は二分探索）。
 * 先頭は元画像。three の Texture.mipmaps にそのまま渡す（generateMipmaps = false）
 */
function coverageMips(src: HTMLCanvasElement, threshold: number): HTMLCanvasElement[] | null {
  const ctx0 = src.getContext('2d');
  if (!ctx0) return null;
  const cov = (d: Uint8ClampedArray, k: number) => { let n = 0; const t = threshold * 255; for (let i = 3; i < d.length; i += 4) if (d[i] * k > t) n++; return n / (d.length / 4); };
  const target = cov(ctx0.getImageData(0, 0, src.width, src.height).data, 1);
  const out: HTMLCanvasElement[] = [src];
  let prev = src;
  while (prev.width > 1 || prev.height > 1) {
    const w = Math.max(1, prev.width >> 1), h = Math.max(1, prev.height >> 1);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (!g) return null;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(prev, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    let lo = 1, hi = 6;
    for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; if (cov(img.data, m) < target) lo = m; else hi = m; }
    const k = (lo + hi) / 2;
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.min(255, img.data[i] * k);
    g.putImageData(img, 0, 0);
    out.push(c);
    prev = c;
  }
  return out;
}

/**
 * 風の頂点注入（MaterialLibrary の onBeforeCompile から。surfaceTime uniform を使う）。
 * 株の位置（instanceMatrix の平行移動 + modelMatrix）で位相をずらし、畑の上を波が渡るように x 方向の位相を強くする
 */
export const WHEAT_WIND_GLSL = /* glsl */ `
{
  float wh = clamp(position.y / ${WHEAT_H.toFixed(2)}, 0.0, 1.0);
  wh *= wh;
  vec2 wp = modelMatrix[3].xz;
  #ifdef USE_INSTANCING
  wp += instanceMatrix[3].xz;
  #endif
  float ph = wp.x * 0.45 + wp.y * 0.18;
  float gust = 0.6 + 0.4 * sin(surfaceTime * 0.35 + wp.x * 0.05);
  float sw = (sin(surfaceTime * 1.4 - ph) * 0.7 + sin(surfaceTime * 2.9 - ph * 1.7) * 0.3) * gust;
  // 揺れはワールドの x 方向（風下）を主に。株ごとの回転・縮尺は instanceMatrix の逆（回転 × 等倍縮尺なので転置 / s²）で局所へ戻す
  vec3 wd = vec3(sw * 0.09, -abs(sw) * 0.02, cos(surfaceTime * 1.1 - ph * 1.3) * 0.035) * wh;
  #ifdef USE_INSTANCING
  mat3 wim = mat3(instanceMatrix);
  wd = (transpose(wim) * wd) / max(dot(wim[0], wim[0]), 1e-4);
  #endif
  transformed += wd;
}`;
