/**
 * KTX2（Basis Universal ETC1S + mipmap）変換の共通部分（tools/build-ktx2.mjs と tools/build-cc0-models.mjs が使う）。
 * エンコーダは npm の ktx2-encoder（wasm）、JPEG / PNG のデコードは macOS の sips で BMP にして読む（画像ライブラリを増やさない）。
 */
import { encodeToKTX2 } from 'ktx2-encoder';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * 用途別の設定（試験値: Carpet016 1024 px で Color 383 → 156 KB、NormalGL 731 → 240 KB、Roughness 113 → 41 KB）。
 * 法線は ETC1S の法線マップ設定（UASTC は 1 枚 1.2 MB 超・12 s 超で JPEG より重い）
 */
export const KTX2_SETTINGS = {
  color: { isUASTC: false, qualityLevel: 160, isSetKTX2SRGBTransferFunc: true, isPerceptual: true },
  normal: { isUASTC: false, qualityLevel: 200, isNormalMap: true, isSetKTX2SRGBTransferFunc: false, isPerceptual: false },
  aux: { isUASTC: false, qualityLevel: 110, isSetKTX2SRGBTransferFunc: false, isPerceptual: false },
};

let tmp = null;
/** 画像 → RGBA（sips で 24 / 32 bit BMP にして読む。下から上の行順にも対応） */
export function decodeImage(file) {
  tmp ??= mkdtempSync(join(tmpdir(), 'ktx2-'));
  const bmp = join(tmp, 'in.bmp');
  execFileSync('sips', ['-s', 'format', 'bmp', file, '--out', bmp], { stdio: 'ignore' });
  const b = readFileSync(bmp);
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
  const h = Math.abs(hRaw), bottomUp = hRaw > 0, bytes = bpp / 8, stride = Math.ceil((w * bytes) / 4) * 4;
  if (bytes !== 3 && bytes !== 4) throw new Error(`unsupported BMP ${bpp} bpp: ${file}`);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = off + (bottomUp ? h - 1 - y : y) * stride;
    for (let x = 0; x < w; x++) {
      const s = row + x * bytes, d = (y * w + x) * 4;
      out[d] = b[s + 2]; out[d + 1] = b[s + 1]; out[d + 2] = b[s]; out[d + 3] = bytes === 4 ? b[s + 3] : 255;
    }
  }
  return { width: w, height: h, data: out };
}

export function cleanupTmp() {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = null;
}

// basis の進行ログ（stdout）を抑える
const write = process.stdout.write.bind(process.stdout);
async function quiet(fn) { process.stdout.write = () => true; try { return await fn(); } finally { process.stdout.write = write; } }

/**
 * 1 枚を KTX2 に。kind: 'color' | 'normal' | 'aux'。
 * yFlip: 上下反転を焼き込む（CC0 材質は JPEG の flipY 読込と向きを揃えるため true。glTF は flipY しない規約なので false）
 */
export async function encodeFile(file, kind, { yFlip }) {
  const bytes = new Uint8Array(readFileSync(file));
  return quiet(() => encodeToKTX2(bytes, { ...KTX2_SETTINGS[kind], isYFlip: yFlip, generateMipmap: true, enableDebug: false, imageDecoder: async () => decodeImage(file) }));
}
