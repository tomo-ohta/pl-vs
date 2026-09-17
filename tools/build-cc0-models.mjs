#!/usr/bin/env node
/**
 * assets/cc0/manifest.json の models を public/cc0/models/<id>/ へ書き出し、public/cc0/models/index.json を書く。
 * Node 標準のみ。glTF の image URI は 'textures/<file>.jpg' なので、jpg は textures/ サブフォルダへ置く（fetch は平置き）。
 *
 * index.json: { <id>: { gltf: 'models/<id>/<id>_1k.gltf', group, size: [w, h, d], triangles, part?: '<regex>' } }
 *   size / triangles は glTF の accessor min/max とノード変換から計算した実寸（part 指定があればそのノードだけ）。
 *   PropCatalog はこの値でモデル選択（スケール判定・三角形予算）を glTF 読込前に済ませる。
 *
 * 使い方: node tools/build-cc0-models.mjs   （package.json: npm run build:cc0:models）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'assets', 'cc0');
const outRoot = path.join(root, 'public', 'cc0', 'models');
const manifestPath = path.join(srcRoot, 'manifest.json');
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** 複数体がまとまったモデルから 1 体だけ使う（ノード名の正規表現。PropCatalog も同じ式でフィルタする） */
const PARTS = {
  metal_trash_can: '^metal_trash_can(_lid|_handle_left|_handle_right)?$',
  pachira_aquatica_01: '_a$',
  mounted_fluorescent_lights: '_d$',
};

if (!fs.existsSync(manifestPath)) {
  console.error(`manifest not found: ${manifestPath}（tools/fetch-cc0-assets.py を先に実行）`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const models = manifest.models ?? {};
const ids = Object.keys(models).sort();
if (ids.length === 0) {
  console.error('manifest.models is empty');
  process.exit(1);
}

fs.mkdirSync(outRoot, { recursive: true });
const index = {};
let copied = 0;
let bytes = 0;
for (const id of ids) {
  const m = models[id];
  const gltfRel = m.gltf; // 'models/<id>/<id>_1k.gltf'
  const gltfSrc = path.join(srcRoot, gltfRel);
  if (!fs.existsSync(gltfSrc)) {
    console.warn(`skip ${id}: ${gltfRel} not found`);
    continue;
  }
  const srcDir = path.dirname(gltfSrc);
  const dstDir = path.join(outRoot, id);
  fs.mkdirSync(path.join(dstDir, 'textures'), { recursive: true });
  const gltf = JSON.parse(fs.readFileSync(gltfSrc, 'utf8'));
  // glTF 本体
  copy(gltfSrc, path.join(dstDir, path.basename(gltfSrc)));
  // バッファ
  for (const b of gltf.buffers ?? []) {
    if (!b.uri || b.uri.startsWith('data:')) continue;
    copy(path.join(srcDir, b.uri), path.join(dstDir, b.uri));
  }
  // 画像（URI が textures/<file> なら平置きの実ファイルから探す）
  for (const im of gltf.images ?? []) {
    if (!im.uri || im.uri.startsWith('data:')) continue;
    const name = path.basename(im.uri);
    const cand = [path.join(srcDir, im.uri), path.join(srcDir, name)].find((p) => fs.existsSync(p));
    if (!cand) { console.warn(`  ${id}: image missing ${im.uri}`); continue; }
    copy(cand, path.join(dstDir, im.uri));
  }
  const part = PARTS[id];
  const stats = measure(gltf, part ? new RegExp(part) : null);
  index[id] = {
    gltf: `models/${id}/${path.basename(gltfSrc)}`,
    group: m.group ?? 'misc',
    size: stats.size.map((v) => Math.round(v * 1000) / 1000),
    min: stats.min.map((v) => Math.round(v * 1000) / 1000),
    max: stats.max.map((v) => Math.round(v * 1000) / 1000),
    triangles: Math.round(stats.triangles),
    ...(part ? { part } : {}),
  };
}
fs.writeFileSync(path.join(outRoot, 'index.json'), JSON.stringify(index, null, 1));
console.log(`wrote ${Object.keys(index).length} models (${copied} files, ${(bytes / 1e6).toFixed(1)} MB) → ${path.relative(root, outRoot)}/index.json`);

function copy(src, dst) {
  const s = fs.statSync(src);
  const d = fs.existsSync(dst) ? fs.statSync(dst) : null;
  if (!d || d.size !== s.size || d.mtimeMs < s.mtimeMs) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  copied++;
  bytes += s.size;
}

/** 実寸（ワールド AABB）と三角形数。part があれば名前が一致するノードだけ */
function measure(gltf, part) {
  const nodes = gltf.nodes ?? [];
  const scene = gltf.scenes?.[gltf.scene ?? 0] ?? { nodes: nodes.map((_, i) => i) };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  const walk = (ni, parent) => {
    const n = nodes[ni];
    const w = mul(parent, local(n));
    if (n.mesh !== undefined && (!part || part.test(n.name ?? ''))) {
      for (const p of gltf.meshes[n.mesh].primitives) {
        const acc = gltf.accessors[p.attributes.POSITION];
        triangles += (p.indices !== undefined ? gltf.accessors[p.indices].count : acc.count) / 3;
        for (const cx of [acc.min[0], acc.max[0]]) for (const cy of [acc.min[1], acc.max[1]]) for (const cz of [acc.min[2], acc.max[2]]) {
          const X = w[0] * cx + w[4] * cy + w[8] * cz + w[12];
          const Y = w[1] * cx + w[5] * cy + w[9] * cz + w[13];
          const Z = w[2] * cx + w[6] * cy + w[10] * cz + w[14];
          min[0] = Math.min(min[0], X); min[1] = Math.min(min[1], Y); min[2] = Math.min(min[2], Z);
          max[0] = Math.max(max[0], X); max[1] = Math.max(max[1], Y); max[2] = Math.max(max[2], Z);
        }
      }
    }
    for (const c of n.children ?? []) walk(c, w);
  };
  for (const ni of scene.nodes) walk(ni, IDENTITY);
  if (!Number.isFinite(min[0])) return { size: [0, 0, 0], min: [0, 0, 0], max: [0, 0, 0], triangles: 0 };
  return { size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], min, max, triangles };
}

function local(n) {
  if (n.matrix) return n.matrix;
  const t = n.translation ?? [0, 0, 0];
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const s = n.scale ?? [1, 1, 1];
  const m = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    t[0], t[1], t[2], 1,
  ];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] *= s[c];
  return m;
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return o;
}
