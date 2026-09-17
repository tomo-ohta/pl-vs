#!/usr/bin/env node
/**
 * CC0 PBR 素材（ambientCG の素材 / Poly Haven のテクスチャセット）をゲームが読む形へ書き出す。
 *
 *   node tools/build-cc0-materials.mjs                 # assets/cc0/manifest.json → public/cc0/materials/<Id>/ にコピー
 *   node tools/build-cc0-materials.mjs --max 1024      # macOS の sips があれば Color / NormalGL を 1024 px 以下に縮小（無ければコピー）
 *   node tools/build-cc0-materials.mjs --max 1024 --aux 512   # Roughness / AmbientOcclusion / Displacement は 512 px 以下
 *   node tools/build-cc0-materials.mjs --only Carpet004,linoleum_brown
 *
 * 入力: assets/cc0/manifest.json（tools/fetch-cc0-assets.py が書く）
 *   - materials[<Id>].maps: ambientCG。Color / NormalGL / Roughness / AmbientOcclusion / Displacement / Metalness / Opacity の相対パス
 *   - textures[<id>].maps: Poly Haven。fetch 側で同じキー名（Color / NormalGL / Roughness / AmbientOcclusion / Displacement / ARM）に
 *     正規化してあるが、元のキー名（Diffuse / diff / nor_gl / Rough / rough / AO / ao / disp）も受け付ける
 * 出力: public/cc0/materials/<Id>/<file> と public/cc0/materials/index.json
 *       { <Id>: { color, normal, roughness, ao?, displacement?, resolution, maxSize?, avg?, kind, source, license } }
 *       パスは public/cc0/materials/ からの相対。両ソースとも同じ形（MaterialLibrary の Cc0Set は kind を区別しない）。
 *       avg は Color の平均色（"#rrggbb"。sips がある場合のみ。読込完了前の 1 px 代替色に使う）。
 *       ゲーム（src/render/MaterialLibrary.ts）は起動時に index.json を fetch し、無ければ従来の生成テクスチャに戻る。
 *
 * Node 標準モジュールのみ。画像縮小ライブラリは入れていないので、縮小は macOS 付属の `sips` がある場合の任意機能。
 * 将来は KTX2（Basis Universal）へ変換し、index.json の拡張子を差し替える前提。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'assets', 'cc0', 'manifest.json');
const OUT = join(ROOT, 'public', 'cc0', 'materials');

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback; };
const maxSize = Number(opt('--max', 0)) || 0;
const auxSize = Number(opt('--aux', maxSize)) || maxSize;
const only = opt('--only', '') ? new Set(opt('--only', '').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const clean = args.includes('--clean');

if (!existsSync(MANIFEST)) {
  console.error(`manifest が見つかりません: ${MANIFEST}\n先に python3 tools/fetch-cc0-assets.py を実行してください。`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
// ambientCG（materials）と Poly Haven（textures）を同じ一覧にする。Id が衝突したら materials を優先
const entries = new Map();
for (const [id, e] of Object.entries(manifest.textures ?? {})) entries.set(id, { ...e, kind: 'polyhaven' });
for (const [id, e] of Object.entries(manifest.materials ?? {})) entries.set(id, { ...e, kind: 'ambientcg' });
const ids = [...entries.keys()].filter((id) => !only || only.has(id)).sort();
if (!ids.length) { console.error('対象の素材がありません'); process.exit(1); }

const sips = (() => {
  try { execFileSync('sips', ['--version'], { stdio: 'ignore' }); return 'sips'; } catch { if (maxSize) console.warn('sips が無いので縮小せずコピーします'); return null; }
})();

// 出力キー ← manifest の map 名（ambientCG 名 / Poly Haven の正規化名 / Poly Haven の元の名）
const MAP_KEYS = {
  color: ['Color', 'Diffuse', 'diff', 'diffuse', 'BaseColor'],
  normal: ['NormalGL', 'nor_gl', 'normal_gl', 'Normal'],
  roughness: ['Roughness', 'Rough', 'rough', 'roughness'],
  ao: ['AmbientOcclusion', 'AO', 'ao'],
  displacement: ['Displacement', 'disp', 'Disp', 'displacement', 'Height'],
};
const REQUIRED = ['color', 'normal', 'roughness'];
const pick = (maps, key) => { for (const name of MAP_KEYS[key]) if (maps[name]) return maps[name]; return null; };

if (clean && existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

/** 画像の長辺（sips -g pixelWidth/pixelHeight）。sips が無いときは null */
function imageSize(file) {
  if (!sips) return null;
  const text = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  const w = Number(/pixelWidth:\s*(\d+)/.exec(text)?.[1]), h = Number(/pixelHeight:\s*(\d+)/.exec(text)?.[1]);
  return Number.isFinite(w) && Number.isFinite(h) ? Math.max(w, h) : null;
}

/** Color の平均色（sips で 1×1 BMP に縮小して読む）。sips が無ければ null */
function averageColor(file) {
  if (!sips) return null;
  try {
    const tmp = join(OUT, '.avg.bmp');
    execFileSync('sips', ['-z', '1', '1', '-s', 'format', 'bmp', file, '--out', tmp], { stdio: 'ignore' });
    const b = readFileSync(tmp);
    const off = b.readUInt32LE(10);
    const hex = (v) => v.toString(16).padStart(2, '0');
    rmSync(tmp, { force: true });
    return `#${hex(b[off + 2])}${hex(b[off + 1])}${hex(b[off])}`;
  } catch { return null; }
}

/** src → dest。limit（px）が指定され sips があれば長辺を limit 以下へ縮小、それ以外はコピー。既に同じサイズの出力があればスキップ */
function emit(src, dest, limit) {
  mkdirSync(dirname(dest), { recursive: true });
  const size = limit ? imageSize(src) : null;
  const shrink = !!(sips && limit && size && size > limit);
  if (!shrink) {
    if (existsSync(dest) && statSync(dest).size === statSync(src).size) return { status: 'skip', size };
    copyFileSync(src, dest);
    return { status: 'copy', size };
  }
  if (existsSync(dest) && imageSize(dest) === limit) return { status: 'skip', size: limit };
  // -Z: 長辺を limit に（アスペクト維持）。JPEG 品質 88（法線・粗さの階調を保つ）
  execFileSync('sips', ['-Z', String(limit), '-s', 'format', 'jpeg', '-s', 'formatOptions', '88', src, '--out', dest], { stdio: 'ignore' });
  return { status: 'resize', size: limit };
}

const index = {};
let bytes = 0, files = 0, skipped = [];
const counts = { ambientcg: 0, polyhaven: 0 };
for (const id of ids) {
  const entry = entries.get(id);
  const maps = entry.maps ?? {};
  const missing = REQUIRED.filter((k) => !pick(maps, k));
  if (missing.length) { skipped.push(`${id}: ${missing.join('/')} が無い`); continue; }
  const rec = { resolution: String(entry.resolution ?? '?').toUpperCase(), kind: entry.kind, source: entry.source, license: entry.license ?? 'CC0-1.0' };
  let largest = 0;
  for (const key of Object.keys(MAP_KEYS)) {
    const rel = pick(maps, key);
    if (!rel) continue;
    const src = join(ROOT, 'assets', 'cc0', rel);
    if (!existsSync(src)) { if (REQUIRED.includes(key)) { missing.push(key); } continue; }
    let name = rel.split('/').pop();
    const limit = key === 'color' || key === 'normal' ? maxSize : auxSize;
    // 縮小時は JPEG で書くので拡張子も .jpg に揃える（Poly Haven の png 等）
    const willShrink = !!(sips && limit && (imageSize(src) ?? 0) > limit);
    if (willShrink) name = name.replace(/\.[a-z0-9]+$/i, '.jpg');
    const dest = join(OUT, id, name);
    const r = emit(src, dest, limit);
    rec[key] = `${id}/${name}`;
    const st = statSync(dest); bytes += st.size; files++;
    if (r.size) largest = Math.max(largest, r.size);
    if (key === 'color') { const avg = averageColor(dest); if (avg) rec.avg = avg; }
    console.log(`[${r.status.padEnd(6)}] ${id}/${name} ${(st.size / 1e6).toFixed(2)} MB`);
  }
  if (missing.length) { skipped.push(`${id}: ファイル欠落 ${missing.join('/')}`); continue; }
  if (largest) rec.maxSize = largest;
  index[id] = rec;
  counts[entry.kind]++;
}
// --only で絞ったときは既存の index に合流する（他のセットの項目を消さない）
const indexPath = join(OUT, 'index.json');
let merged = index;
if (only && existsSync(indexPath)) {
  try { merged = { ...JSON.parse(readFileSync(indexPath, 'utf8')), ...index }; } catch { merged = index; }
}
writeFileSync(indexPath, JSON.stringify(merged, null, 1) + '\n');
console.log(`\nindex.json: ${Object.keys(merged).length} 素材（今回 ${Object.keys(index).length}: ambientCG ${counts.ambientcg} / Poly Haven ${counts.polyhaven}）、${files} ファイル、${(bytes / 1e6).toFixed(0)} MB → ${OUT}`);
if (sips && maxSize) console.log(`縮小: Color/NormalGL ≤ ${maxSize} px、Roughness/AO/Displacement ≤ ${auxSize} px（sips）`);
for (const s of skipped) console.warn(`SKIP ${s}`);
