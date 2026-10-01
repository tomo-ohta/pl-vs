#!/usr/bin/env node
/**
 * 窓の外の夜景（MaterialLibrary の windowNight 遠景）を、CC0 の夜の街の HDRI 写真（Poly Haven の tonemapped JPG）から作る。
 *
 *   node tools/build-night-views.mjs
 *
 * 各 HDRI（正距円筒図法 8192 × 4096）から、地平線の上下 ±24°（= 遠景の 40 m 幅を 45 m 先で見た角度）と、遠くの街並みが写る
 * 方向（VIEWS に手で指定）の横 110° を切り出し、3 枚を縦に積んだ 1 枚の画像にする（部屋ごとに段を選ぶ = 隣の部屋と同じ街が並ばない）。
 * 出力: public/textures/night/atlas.ktx2（上下反転を焼き込んだ ETC1S）・atlas.jpg（KTX2 を読めない環境）・atlas-sm.*（スマホ）
 *       public/textures/night/index.json（段数・切り出し角・出典）
 * 入力: assets/cc0/hdris/*.jpg（tools/fetch-cc0-extra.py）。macOS の sips を使う
 */
import { encodeToKTX2 } from 'ktx2-encoder';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeImage, KTX2_SETTINGS } from './ktx2-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'cc0', 'hdris');
const OUT = join(ROOT, 'public', 'textures', 'night');
/**
 * 写真ごとの切り出し（全周の帯を見て手で選んだ値。自動で「最も明るい方向」を選ぶと、手前の人や屋内の吹き抜けが入るため）:
 * - center: 横の中心（0..1）。遠くの街並みが写る方向
 * - below: 地平線より下の扱い。'cut' = 手前の遊歩道・人・手すりを消して暗い地面へ滑らかに落とす / 'keep' = 水面の反射などを残す
 * - exposure: 明るさの倍率（夕暮れの明るい空を夜に寄せる）
 */
const VIEWS = {
  shanghai_bund: { center: 0.62, below: 'cut', cutDeg: 0.4, exposure: 1.0 },
  modern_buildings_night: { center: 0.12, below: 'keep', cutDeg: 0, exposure: 0.8 },
  neuer_zollhof: { center: 0.63, below: 'cut', cutDeg: 1.0, exposure: 0.55 },
};
const IDS = Object.keys(VIEWS);
const SPAN_DEG = 110;   // 横の切り出し角
const HALF_V_DEG = 24;  // 地平線から上下
const tmp = mkdtempSync(join(tmpdir(), 'night-'));
mkdirSync(OUT, { recursive: true });

const sips = (...a) => execFileSync('sips', a, { stdio: 'ignore' });

/** 帯を切り出して outW × outH の RGBA に */
function band(file, center, outW, outH) {
  const W = 8192, H = 4096;
  const cw = Math.round((SPAN_DEG / 360) * W), ch = Math.round((2 * HALF_V_DEG / 180) * H);
  let x0 = Math.round(center * W - cw / 2);
  x0 = Math.max(0, Math.min(W - cw, x0)); // 端をまたぐときは内側へ寄せる（折り返しの継ぎ目を作らない）
  const y0 = Math.round(H / 2 - ch / 2);
  const cut = join(tmp, 'cut.jpg');
  // sips --cropOffset は (y, x)
  sips('--cropToHeightWidth', String(ch), String(cw), '--cropOffset', String(y0), String(x0), file, '--out', cut);
  const scaled = join(tmp, 'scaled.bmp');
  sips('-z', String(outH), String(outW), '-s', 'format', 'bmp', cut, '--out', scaled);
  return decodeImage(scaled);
}

/** RGBA → 24 bit BMP（下から上）→ sips で JPEG */
function writeJpeg(rgba, w, h, dest) {
  const stride = Math.ceil((w * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + stride * h);
  buf.write('BM', 0); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10); buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22); buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(stride * h, 34);
  for (let y = 0; y < h; y++) {
    const row = 54 + (h - 1 - y) * stride;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = row + x * 3;
      buf[d] = rgba[s + 2]; buf[d + 1] = rgba[s + 1]; buf[d + 2] = rgba[s];
    }
  }
  const bmp = join(tmp, 'out.bmp');
  writeFileSync(bmp, buf);
  sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '88', bmp, '--out', dest);
}

const write = process.stdout.write.bind(process.stdout);
const quiet = async (fn) => { process.stdout.write = () => true; try { return await fn(); } finally { process.stdout.write = write; } };

const bands = [];
for (const id of IDS) {
  const file = join(SRC, `${id}.jpg`);
  if (!existsSync(file)) { console.warn(`skip ${id}: ${file} が無い（tools/fetch-cc0-extra.py）`); continue; }
  bands.push({ id, ...VIEWS[id], file });
}
if (!bands.length) { console.error('HDRI がありません'); process.exit(1); }

for (const [suffix, w] of [['', 2048], ['-sm', 1024]]) {
  const bh = Math.round(w / 3); // 1 段の高さ（110° × 48° ≈ 2.3 : 1 を 3 : 1 に少し縦へ伸ばす。地平線付近が主役なので可）
  const H = bh * bands.length;
  const atlas = new Uint8Array(w * H * 4);
  bands.forEach((b, k) => {
    const img = band(b.file, b.center, w, bh);
    const d = img.data;
    // 地平線（段の中央）から cutDeg 下より下は、その行の平均色を暗くしながら地面色へ落とす（'cut'）
    const cutRow = Math.round(bh / 2 + (b.cutDeg / (2 * HALF_V_DEG)) * bh);
    const ground = [8, 9, 12];
    for (let y = 0; y < bh; y++) {
      const fade = b.below === 'cut' && y > cutRow ? Math.min(1, (y - cutRow) / (bh * 0.06)) : 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) d[i + c] = Math.round((d[i + c] * b.exposure) * (1 - fade) + ground[c] * fade);
      }
    }
    // 上端 10% はその帯の最上行の平均色へ溶かす（窓に近づくと段の上端より上が見え、ClampToEdge で最上行が縦筋に伸びるため）
    const top = [0, 0, 0];
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) top[c] += d[x * 4 + c] / w;
    const blend = Math.round(bh * 0.1);
    for (let y = 0; y < blend; y++) {
      const t = 1 - y / blend;
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) d[i + c] = Math.round(d[i + c] * (1 - t) + top[c] * t); }
    }
    atlas.set(d, k * w * bh * 4);
  });
  writeJpeg(atlas, w, H, join(OUT, `atlas${suffix}.jpg`));
  const ktx = await quiet(() => encodeToKTX2(new Uint8Array(1), { ...KTX2_SETTINGS.color, isYFlip: true, generateMipmap: true, enableDebug: false, imageDecoder: async () => ({ width: w, height: H, data: atlas }) }));
  writeFileSync(join(OUT, `atlas${suffix}.ktx2`), ktx);
  console.log(`atlas${suffix}: ${w} × ${H}, ktx2 ${(ktx.length / 1024).toFixed(0)} KB`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({
  bands: bands.length, spanDeg: SPAN_DEG, halfVerticalDeg: HALF_V_DEG,
  sources: bands.map((b) => ({ id: b.id, center: b.center, below: b.below, exposure: b.exposure, source: `https://polyhaven.com/a/${b.id}`, license: 'CC0-1.0' })),
}, null, 1));
rmSync(tmp, { recursive: true, force: true });
