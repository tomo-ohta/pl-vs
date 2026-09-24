#!/usr/bin/env node
/**
 * 提供素材（assets/generated/。AI 生成の画像。出典と生成条件は各フォルダの generation.json）を、ゲームが読む PBR 素材にする。
 *
 *   node tools/build-user-materials.mjs
 *   → assets/cc0/materials/<Id>/<Id>_Color.jpg / _NormalGL.jpg / _Roughness.jpg / _AmbientOcclusion.jpg（1024 px）
 *     assets/cc0/manifest.json の materials に登録（license は 'user-provided'、source は元画像のパス）
 *   続けて npm run build:cc0（公開用の 1024 版・スマホ版・KTX2）を実行する
 *
 * 外壁の色画像は 1 枚だけなので、法線・粗さ・AO は色から作る（macOS の sips でデコード。端は折り返して計算 = 継ぎ目なしを保つ）:
 * - 高さ = 明るさ（目地・溝は暗い = 低い）。法線は中心差分 × 強さ（OpenGL 形式: 緑 = 上）
 * - 粗さ = 0.78 を基準に、明るい所をわずかに滑らかに
 * - AO = 周囲（半径 6 px）より低い所を暗く
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupTmp, decodeImage } from './ktx2-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'generated', '1. 日本の住宅の外壁（継ぎ目なく並べられる素材）');
const OUT = join(ROOT, 'assets', 'cc0', 'materials');
const MANIFEST = join(ROOT, 'assets', 'cc0', 'manifest.json');
const SIZE = 1024;

/** id → 元画像・法線の強さ（溝の深い素材ほど強く） */
const WALLS = {
  JP_SidingWoodWhite: { file: 'white-wood-grain.png', strength: 5 },
  JP_SidingStoneGrey: { file: 'light-grey-stone.png', strength: 6 },
  JP_TileBrickBeige: { file: 'beige-brick-tile.png', strength: 5 },
  JP_SidingRibbedBrown: { file: 'dark-brown-ribbed.png', strength: 7 },
  JP_Fukitsuke: { file: 'off-white-fukitsuke.png', strength: 4 },
};

function writeJpeg(rgb, w, h, dest) {
  const stride = Math.ceil((w * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + stride * h);
  buf.write('BM', 0); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10); buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22); buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(stride * h, 34);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 3, d = 54 + (h - 1 - y) * stride + x * 3;
    buf[d] = rgb[s + 2]; buf[d + 1] = rgb[s + 1]; buf[d + 2] = rgb[s];
  }
  const bmp = dest.replace(/\.jpg$/, '.bmp');
  writeFileSync(bmp, buf);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', bmp, '--out', dest], { stdio: 'ignore' });
  execFileSync('rm', [bmp]);
}

/** 折り返しの箱ぼかし（半径 r） */
function blur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[y * w + ((x + k + w) % w)];
    tmp[y * w + x] = s / (2 * r + 1);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[((y + k + h) % h) * w + x];
    out[y * w + x] = s / (2 * r + 1);
  }
  return out;
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
manifest.materials ??= {};
const tmpDir = join(ROOT, 'assets', 'cc0', '.tmp-user');
mkdirSync(tmpDir, { recursive: true });
for (const [id, spec] of Object.entries(WALLS)) {
  const src = join(SRC, spec.file);
  if (!existsSync(src)) { console.warn(`skip ${id}: ${src} が無い`); continue; }
  const scaled = join(tmpDir, 'scaled.png');
  execFileSync('sips', ['-z', String(SIZE), String(SIZE), src, '--out', scaled], { stdio: 'ignore' });
  const img = decodeImage(scaled);
  const w = img.width, h = img.height, n = w * h;
  const color = new Uint8Array(n * 3);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
    color[i * 3] = r; color[i * 3 + 1] = g; color[i * 3 + 2] = b;
    lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  const height = blur(lum, w, h, 1);
  const wide = blur(height, w, h, 6);
  const normal = new Uint8Array(n * 3), rough = new Uint8Array(n * 3), ao = new Uint8Array(n * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const dx = (height[y * w + ((x + 1) % w)] - height[y * w + ((x - 1 + w) % w)]) / 2;
    const dyDown = (height[((y + 1) % h) * w + x] - height[((y - 1 + h) % h) * w + x]) / 2;
    // OpenGL 形式（+Y = 画像の上）: 画像の下向きの差分の符号を反転
    let nx = -dx * spec.strength, ny = dyDown * spec.strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    normal[i * 3] = Math.round((nx * 0.5 + 0.5) * 255); normal[i * 3 + 1] = Math.round((ny * 0.5 + 0.5) * 255); normal[i * 3 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    const r = Math.max(0.45, Math.min(0.95, 0.78 - (height[i] - 0.5) * 0.2));
    rough[i * 3] = rough[i * 3 + 1] = rough[i * 3 + 2] = Math.round(r * 255);
    const cav = Math.max(0, Math.min(1, 1 - Math.max(0, wide[i] - height[i]) * 4));
    ao[i * 3] = ao[i * 3 + 1] = ao[i * 3 + 2] = Math.round(cav * 255);
  }
  const dir = join(OUT, id);
  mkdirSync(dir, { recursive: true });
  const maps = {};
  for (const [key, data] of [['Color', color], ['NormalGL', normal], ['Roughness', rough], ['AmbientOcclusion', ao]]) {
    const file = `${id}_${key}.jpg`;
    writeJpeg(data, w, h, join(dir, file));
    maps[key] = `materials/${id}/${file}`;
  }
  manifest.materials[id] = {
    resolution: '1K', maps,
    source: `assets/generated/1. 日本の住宅の外壁（継ぎ目なく並べられる素材）/${spec.file}`,
    license: 'user-provided (AI generated; see generation.json)',
  };
  console.log(`[user] ${id} ← ${spec.file}`);
}
execFileSync('rm', ['-rf', tmpDir]);
cleanupTmp();
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
