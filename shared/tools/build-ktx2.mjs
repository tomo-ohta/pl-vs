#!/usr/bin/env node
/**
 * CC0 素材の JPEG を KTX2（Basis Universal ETC1S + mipmap）へ変換し、index.json に `ktx2` の対応表を足す。
 *
 *   node tools/build-ktx2.mjs                    # public/cc0/materials/ と public/cc0/materials-sm/ の両方
 *   node tools/build-ktx2.mjs --dir materials-sm  # 片方だけ
 *   node tools/build-ktx2.mjs --shard 0/4         # 4 分割の 0 番目だけ（並列実行用。index.json の更新は --shard 無しの最後の 1 回で）
 *   node tools/build-ktx2.mjs --index-only        # 変換せず、既にある .ktx2 から index.json だけ書き直す
 *
 * エンコーダは npm の ktx2-encoder（Basis Universal の wasm。devDependencies）。JPEG のデコードは macOS の sips で BMP にして読む
 * （画像ライブラリを増やさない）。GPU 上は ETC1S が BC7 / ASTC / ETC2 などへ変換されるので、展開済み RGBA（JPEG）の 1/4〜1/8。
 *
 * 設定（試験値: Carpet016 1024 px で Color 383 → 156 KB、NormalGL 731 → 240 KB、Roughness 113 → 41 KB）:
 * - color: ETC1S 品質 160、sRGB
 * - normal: ETC1S 法線マップ設定（品質 200）、線形。UASTC は 1 枚 1.2 MB 超・12 s 超で JPEG より重いので使わない
 * - roughness / ao / displacement: ETC1S 品質 110、線形
 * - 上下反転を焼き込む（isYFlip）: 圧縮テクスチャは WebGL で flipY できず、JPEG（TextureLoader / ImageBitmap flipY）と向きを揃えるため
 *
 * 出力: JPEG と同じ場所に <名前>.ktx2。index.json の各項目に { ktx2: { color, normal, roughness, ao?, displacement? } }。
 * ゲーム（MaterialLibrary）は ktx2 があれば KTX2Loader で読み、無い / 失敗 / `?ktx=off` なら JPEG を読む。
 */
import { cleanupTmp, encodeFile } from './ktx2-lib.mjs';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback; };
const dirs = opt('--dir', null) ? [opt('--dir', null)] : ['materials', 'materials-sm'];
const [shardIndex, shardCount] = String(opt('--shard', '0/1')).split('/').map(Number);
const sharded = args.includes('--shard');
const indexOnly = args.includes('--index-only');
const KEYS = ['color', 'normal', 'roughness', 'ao', 'displacement'];

let converted = 0, skipped = 0, jpgBytes = 0, ktxBytes = 0;
const t0 = Date.now();
for (const d of dirs) {
  const base = join(ROOT, 'public', 'cc0', d);
  const indexPath = join(base, 'index.json');
  if (!existsSync(indexPath)) { console.warn(`${indexPath} が無いので飛ばします`); continue; }
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const ids = Object.keys(index).sort();
  for (let n = 0; n < ids.length; n++) {
    if (n % shardCount !== shardIndex) continue;
    const rec = index[ids[n]];
    const ktx = {};
    for (const key of KEYS) {
      const rel = rec[key];
      if (typeof rel !== 'string') continue;
      const src = join(base, rel);
      if (!existsSync(src)) continue;
      const outRel = rel.replace(/\.[a-z0-9]+$/i, '.ktx2');
      const dest = join(base, outRel);
      if (!indexOnly && !(existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs)) {
        const data = await encodeFile(src, key === 'color' ? 'color' : key === 'normal' ? 'normal' : 'aux', { yFlip: true });
        writeFileSync(dest, data);
        converted++;
        console.log(`[ktx2] ${d}/${outRel} ${(statSync(src).size / 1024).toFixed(0)} → ${(data.length / 1024).toFixed(0)} KB`);
      } else if (existsSync(dest)) skipped++;
      if (existsSync(dest)) { ktx[key] = outRel; jpgBytes += statSync(src).size; ktxBytes += statSync(dest).size; }
    }
    // 必須の 3 枚（color / normal / roughness）が揃ったセットだけ KTX2 で読む
    if (ktx.color && ktx.normal && ktx.roughness) rec.ktx2 = ktx; else delete rec.ktx2;
  }
  if (!sharded) writeFileSync(indexPath, JSON.stringify(index, null, 1));
}
cleanupTmp();
console.log(`\n変換 ${converted} 枚 / 既存 ${skipped} 枚、JPEG ${(jpgBytes / 1e6).toFixed(1)} MB → KTX2 ${(ktxBytes / 1e6).toFixed(1)} MB（${Math.round((Date.now() - t0) / 1000)} s）${sharded ? '。index.json は --shard 無しで再実行して更新' : ''}`);
