#!/usr/bin/env node
/**
 * 提供素材（assets/generated/。AI 生成の画像。生成条件は各フォルダの generation.json）を、ゲームが読む段積み画像（アトラス）にする。
 *
 *   node tools/build-generated-textures.mjs
 *
 * 出力（public/textures/generated/。<name>.ktx2 = 上下反転を焼き込んだ ETC1S、<name>.jpg = KTX2 を読めない環境、<name>-sm.* = スマホ）:
 * - window-rooms: 窓の奥の部屋の写真 12 枚を 4 列 × 3 段（1 枚 512 × 341）→ WindowRoom のシェーダが窓ごとに 1 枚を選び、視線で投影する
 * - screens-arcade: ゲーム画面 8 枚を 4 × 2（1 枚 512 × 512）→ ゲーム筐体の画面
 * - screens-pc: パソコンの画面 4 枚を 2 × 2（1 枚 512 × 384）→ 机上の CRT
 * - cans: 自販機の缶 8 × 4（1 マス 128 × 128。元画像のまま）→ 自販機の缶の円柱
 * index.json に各アトラスの列・段・元画像名を書く
 */
import { encodeToKTX2 } from 'ktx2-encoder';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeImage, KTX2_SETTINGS } from './ktx2-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = join(ROOT, 'assets', 'generated');
const OUT = join(ROOT, 'public', 'textures', 'generated');
const tmp = mkdtempSync(join(tmpdir(), 'gen-'));
mkdirSync(OUT, { recursive: true });

const ATLASES = [
  { name: 'window-rooms', dir: '2. 窓の奥の部屋（夜に外から窓越しに見える室内）', match: /\.png$/, cols: 4, rows: 3, cw: 512, ch: 341 },
  { name: 'screens-arcade', dir: '3. 画面の絵（ゲーム画面とパソコンの画面）', match: /^arcade-.*\.png$/, cols: 4, rows: 2, cw: 512, ch: 512 },
  { name: 'screens-pc', dir: '3. 画面の絵（ゲーム画面とパソコンの画面）', match: /^computer-.*\.png$/, cols: 2, rows: 2, cw: 512, ch: 384 },
  { name: 'cans', dir: '4. 自販機の商品パネル（架空ブランドの缶）', match: /^fictional-cans-8x4\.png$/, cols: 1, rows: 1, cw: 1024, ch: 512, grid: [8, 4] },
];

function writeJpeg(rgba, w, h, dest) {
  const stride = Math.ceil((w * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + stride * h);
  buf.write('BM', 0); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10); buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22); buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(stride * h, 34);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4, d = 54 + (h - 1 - y) * stride + x * 3;
    buf[d] = rgba[s + 2]; buf[d + 1] = rgba[s + 1]; buf[d + 2] = rgba[s];
  }
  const bmp = join(tmp, 'out.bmp');
  writeFileSync(bmp, buf);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', bmp, '--out', dest], { stdio: 'ignore' });
}

const write = process.stdout.write.bind(process.stdout);
const quiet = async (fn) => { process.stdout.write = () => true; try { return await fn(); } finally { process.stdout.write = write; } };

const index = {};
for (const a of ATLASES) {
  const files = readdirSync(join(GEN, a.dir)).filter((f) => a.match.test(f)).sort().slice(0, a.cols * a.rows);
  if (!files.length) { console.warn(`skip ${a.name}: 画像が無い`); continue; }
  for (const [suffix, k] of [['', 1], ['-sm', 0.5]]) {
    const cw = Math.round(a.cw * k), ch = Math.round(a.ch * k);
    const W = cw * a.cols, H = ch * a.rows;
    const atlas = new Uint8Array(W * H * 4);
    files.forEach((f, i) => {
      const scaled = join(tmp, 'cell.png');
      execFileSync('sips', ['-z', String(ch), String(cw), join(GEN, a.dir, f), '--out', scaled], { stdio: 'ignore' });
      const im = decodeImage(scaled);
      const ox = (i % a.cols) * cw, oy = Math.floor(i / a.cols) * ch;
      for (let y = 0; y < ch; y++) atlas.set(im.data.subarray(y * cw * 4, (y + 1) * cw * 4), ((oy + y) * W + ox) * 4);
    });
    writeJpeg(atlas, W, H, join(OUT, `${a.name}${suffix}.jpg`));
    const ktx = await quiet(() => encodeToKTX2(new Uint8Array(1), { ...KTX2_SETTINGS.color, isYFlip: true, generateMipmap: true, enableDebug: false, imageDecoder: async () => ({ width: W, height: H, data: atlas }) }));
    writeFileSync(join(OUT, `${a.name}${suffix}.ktx2`), ktx);
    console.log(`${a.name}${suffix}: ${W} × ${H}, ktx2 ${(ktx.length / 1024).toFixed(0)} KB`);
  }
  index[a.name] = { cols: a.grid ? a.grid[0] : a.cols, rows: a.grid ? a.grid[1] : a.rows, count: a.grid ? a.grid[0] * a.grid[1] : files.length, files, source: `assets/generated/${a.dir}`, license: 'user-provided (AI generated; see generation.json)' };
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1));
rmSync(tmp, { recursive: true, force: true });
