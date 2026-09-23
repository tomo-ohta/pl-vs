#!/usr/bin/env node
/**
 * スマホ向けの縮小テクスチャを書き出す（macOS の sips が必要）。
 *
 *   node tools/build-mobile-textures.mjs                  # 既定: CC0 は Color / NormalGL 512 px・補助マップ 256 px、生成テクスチャは 512 px
 *   node tools/build-mobile-textures.mjs --max 512 --aux 256 --legacy 512
 *
 * 入力: public/cc0/materials/（npm run build:cc0 の出力）と public/textures/liminal/
 * 出力: public/cc0/materials-sm/（index.json はパスを変えずに maxSize だけ更新）と public/textures/liminal-sm/
 * ゲームはスマホ（pointer: coarse）でこちらを読む（src/core/device.ts の SMALL_TEXTURES。`?tex=full` / `?tex=sm` で上書き）。
 * materials-sm が無ければ従来の materials に戻るので、この手順を飛ばしても動く。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : fallback; };
const MAX = opt('--max', 512);
const AUX = opt('--aux', 256);
const LEGACY = opt('--legacy', 512);

try { execFileSync('sips', ['--version'], { stdio: 'ignore' }); } catch { console.error('sips が見つかりません（macOS で実行してください）'); process.exit(1); }

function longSide(file) {
  const text = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  return Math.max(Number(/pixelWidth:\s*(\d+)/.exec(text)?.[1]), Number(/pixelHeight:\s*(\d+)/.exec(text)?.[1]));
}

/** src の長辺を limit 以下にして dest へ。元が小さければコピー。dest が src より新しければスキップ */
function shrink(src, dest, limit) {
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) return Math.min(longSide(dest), limit);
  const size = longSide(src);
  if (size <= limit) { copyFileSync(src, dest); return size; }
  execFileSync('sips', ['-Z', String(limit), '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', src, '--out', dest], { stdio: 'ignore' });
  return limit;
}

let bytes = 0;
let files = 0;
const add = (f) => { bytes += statSync(f).size; files++; };

// CC0 素材
const srcDir = join(ROOT, 'public', 'cc0', 'materials');
const outDir = join(ROOT, 'public', 'cc0', 'materials-sm');
if (existsSync(join(srcDir, 'index.json'))) {
  const index = JSON.parse(readFileSync(join(srcDir, 'index.json'), 'utf8'));
  for (const [id, rec] of Object.entries(index)) {
    let largest = 0;
    for (const key of ['color', 'normal', 'roughness', 'ao', 'displacement']) {
      const rel = rec[key];
      if (typeof rel !== 'string') continue;
      const src = join(srcDir, rel);
      if (!existsSync(src)) continue;
      const dest = join(outDir, rel);
      largest = Math.max(largest, shrink(src, dest, key === 'color' || key === 'normal' ? MAX : AUX));
      add(dest);
    }
    if (largest) rec.maxSize = largest;
    console.log(`[cc0] ${id} ≤ ${largest} px`);
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 1));
} else {
  console.warn(`${srcDir}/index.json が無いので CC0 は飛ばします（先に npm run build:cc0）`);
}

// 生成テクスチャ（従来。CC0 が無い材質の既定色と、CC0 読込前の代替に使う）
const legacySrc = join(ROOT, 'public', 'textures', 'liminal');
const legacyOut = join(ROOT, 'public', 'textures', 'liminal-sm');
for (const name of readdirSync(legacySrc).filter((n) => n.endsWith('.jpg'))) {
  const dest = join(legacyOut, name);
  shrink(join(legacySrc, name), dest, LEGACY);
  add(dest);
}

console.log(`\n${files} files, ${(bytes / 1e6).toFixed(1)} MB → public/cc0/materials-sm/ + public/textures/liminal-sm/`);
