#!/usr/bin/env node
// 参考画像の視点で描いて保存し、参考画像との比較（左右に並べた画像・OKLab の色差）を出す。
// 開発サーバー（npm run dev → http://localhost:5176/）が動いている必要がある。
// 出力: <view>.png（描画）・<view>-cmp.png（左に描画・右に参考）・<view>-diff.png（差の地図: 赤 = 描画が明るい、青 = 暗い、緑 = 色みの差）
//       <view>-edges.png（輪郭の重なり: 参考の輪郭 = 赤、描画の輪郭 = 水色、重なり = 白）。構図 F = 輪郭の一致（×100、高いほど良い）
// 使い方:
//   node tools/capture.mjs pastel-0 corridor-1     … 視点を指定
//   node tools/capture.mjs station                  … 場面の全視点
//   node tools/capture.mjs all                      … すべて
//   node tools/capture.mjs --sample station-1 100,200 640,410   … 参考画像の色を調べる（7×7 の平均、sRGB の 16 進）
//   node tools/capture.mjs --sample-both station-1 100,200 640,410 … 描画と参考画像の色を同じ位置で並べる
//   node tools/capture.mjs --analyze station                    … 参考画像を測る（明るさ・彩度・色相・平坦率・上位 16 色・10 色の表・行ごとの明るさ）
// --params 'set=post.lines.normal=0.6&debug=5' で見た目の値・表示を上書き（調整用）
// --sheet を付けると、撮った全視点の比較を 1 枚の JPEG（sheet.jpg）にまとめる（左: 描画、右: 参考、下に ΔE）
//   node tools/capture.mjs --page arch.html corridor --baseline tools/baseline-v1.json  … 建築版を撮って元の版と比べる
//   node tools/capture.mjs --page arch.html --plan corridor   … 間取り図と、作った場面に重ねた図
//   node tools/capture.mjs --page arch.html --tour corridor   … 間取り図の道順（参考画像の外）を撮って一覧に
//   node tools/capture.mjs --page arch.html --reach corridor  … 出発点から各視点・道順へ歩いて行けるか
//   node tools/capture.mjs --page arch.html --shot corridor 1.2,1.6,-5,0.5,0[,60]  … 好きな位置から 1 枚（質感の数値も出す）
//   node tools/capture.mjs --page arch.html --quality corridor [--n 18] [--seed 1]
//       … 質感の物差し: 参考画像・視点の描画・道順・無作為の場所を同じ数値（細部・形・明暗・平ら・色）で測り、
//         視点の描画より簡素な所に印を付ける。道順と無作為の場所の一覧（-tour.jpg・-random.jpg）と -quality.json も出す
// オプション: --out <dir>（既定 scratch/captures）、--url <base>、--perf（描画の重さも測る）、--grid 16x8（地域の分け方。既定 4x3）
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  if (i < 0) return d;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const out = opt('--out', join(here, '..', 'scratch', 'captures'));
const sampleRef = opt('--sample', null);
const sampleBoth = opt('--sample-both', null);
const topScene = opt('--top', null);
// 建築版: --page arch.html（既定は元の版 index.html）
const pageFile = opt('--page', '');
const planScene = opt('--plan', null);
const tourScene = opt('--tour', null);
const reachScene = opt('--reach', null);
const qualityScene = opt('--quality', null);
const randomN = Number(opt('--n', '18'));
const randomSeed = Number(opt('--seed', '1'));
// 好きな位置から 1 枚: --shot pastel 1.2,1.6,-5,0.5,0[,60]（目の x,y,z, yaw, pitch, 縦の画角）
const shotScene = opt('--shot', null);
const baselineFile = opt('--baseline', null);
const topCut = Number(opt('--cut', '2.2'));
const analyzeIdx = args.indexOf('--analyze');
const doAnalyze = analyzeIdx >= 0;
if (doAnalyze) args.splice(analyzeIdx, 1);
const extra = opt('--params', '').replace(/#/g, '%23');
const [gridX, gridY] = opt('--grid', '4x3').split('x').map(Number);
const sheetIdx = args.indexOf('--sheet');
const doSheet = sheetIdx >= 0;
if (doSheet) args.splice(sheetIdx, 1);
const perfIdx = args.indexOf('--perf');
const doPerf = perfIdx >= 0;
if (doPerf) args.splice(perfIdx, 1);
const base = opt('--url', 'http://localhost:5176/');
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(out, { recursive: true });

const refs = readdirSync(join(here, '..', 'public', 'refs')).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)).sort();
let views = [];
for (const a of sampleRef || sampleBoth || topScene || planScene || tourScene || reachScene || shotScene || qualityScene ? [] : args) {
  if (doAnalyze && a === 'all') { views.push(...refs); continue; }
  if (a === 'all') views.push(...refs);
  else if (refs.includes(a)) views.push(a);
  else if (refs.some((r) => r.startsWith(a + '-'))) views.push(...refs.filter((r) => r.startsWith(a + '-')));
  else views.push(a);
}
views = [...new Set(views)];
if (!views.length && !sampleRef && !sampleBoth && !topScene && !planScene && !tourScene && !reachScene && !shotScene && !qualityScene) {
  console.error('視点を指定してください: ' + refs.join(' '));
  process.exit(1);
}

const port = 9500 + Math.floor(Math.random() * 400);
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'vsl-cdp-'));
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=1456,816',
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = (path, dataUrl) => writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
const cleanup = () => {
  try { proc.kill(); } catch {}
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
};
process.on('exit', cleanup);
// 止められた（SIGTERM・Ctrl+C）・落ちたときも、裏のブラウザを残さない（残ると描き続けてほかの測定を重くする）
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(128 + 15); });
process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); cleanup(); process.exit(1); });

let targets;
for (let i = 0; i < 150; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (targets.some((t) => t.type === 'page')) break;
  } catch {}
  await sleep(100);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
// ページが読み直された（ほかの作業の更新）ときは、場面を開き直して 1 回だけやり直す
const evaluateRetry = async (expr, sceneId) => {
  try {
    return await evaluate(expr);
  } catch (e) {
    console.log(`  やり直します（${String(e.message).slice(0, 80)}）`);
    await openScene(sceneId);
    return await evaluate(expr);
  }
};
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  // ページが途中で読み直される（Vite の更新）と result が無く error だけが返る
  if (r.error || !r.result) throw new Error(`評価できませんでした（ページが読み直された?）: ${r.error?.message ?? '結果なし'}`);
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
  return r.result.result.value;
};
await send('Page.enable');
await send('Runtime.enable');
// 撮影のページは開発サーバーの自動の読み直し（HMR）を受けない: ほかの作業がファイルを保存しても、撮影の途中でページが読み直されない
// （撮影を始めた時点のコードで最後まで撮る）。HMR の WebSocket だけ、開かず閉じない偽物にする
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const Real = window.WebSocket;
  class Quiet extends EventTarget { constructor() { super(); this.readyState = 0; } send() {} close() {} }
  Quiet.prototype.CONNECTING = 0; Quiet.prototype.OPEN = 1; Quiet.prototype.CLOSING = 2; Quiet.prototype.CLOSED = 3;
  const W = function (url, proto) { return proto === 'vite-hmr' || proto === 'vite-ping' ? new Quiet() : new Real(url, proto); };
  Object.assign(W, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  W.prototype = Real.prototype;
  window.WebSocket = W;
})();` });
await send('Emulation.setDeviceMetricsOverride', { width: 1456, height: 816, deviceScaleFactor: 1, mobile: false });

if (sampleRef) {
  await send('Page.navigate', { url: `${base}refs/${sampleRef}.jpg` });
  await sleep(600);
  const pts = args.map((a) => a.split(',').map(Number));
  const res = await evaluate(`(async () => {
    const img = document.querySelector('img');
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const pts = ${JSON.stringify(pts)};
    return pts.map(([x, y]) => {
      const d = g.getImageData(Math.max(0, x - 3), Math.max(0, y - 3), 7, 7).data;
      let r = 0, gg = 0, b = 0; const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const h = (v) => Math.round(v / n).toString(16).padStart(2, '0');
      return x + ',' + y + '  #' + h(r) + h(gg) + h(b);
    });
  })()`);
  console.log(res.join('\n'));
  ws.close();
  cleanup();
  process.exit(0);
}

async function openScene(sceneId) {
  logs.length = 0;
  // 古いページに印を付けておき、新しいページ（印の無いページ）が準備できるまで待つ（古いページの ready を見て先へ進まない）
  try { await evaluate('window.__stale = true'); } catch {}
  await send('Page.navigate', { url: `${base}${pageFile}?capture=1&scene=${sceneId}${extra ? '&' + extra : ''}` });
  for (let i = 0; i < 300; i++) {
    await sleep(100);
    let ok = false;
    try { ok = await evaluate('!window.__stale && !!(window.__lab && (window.__lab.ready || window.__lab.error))'); } catch {}
    if (ok) break;
  }
  const err = await evaluate('window.__lab && window.__lab.error || null');
  if (err) { console.error('読み込みに失敗:', err, logs.join('\n')); process.exit(1); }
  const id = await evaluate('window.__lab.app.def && window.__lab.app.def.id');
  if (id !== sceneId) { console.error(`別の場面が開いています（${id}。求めたのは ${sceneId}）`); process.exit(1); }
}

if (planScene) {
  // 間取り図（建築版）: node tools/capture.mjs --page arch.html --plan corridor [--cut 2.4]
  await openScene(planScene);
  const a = await evaluate('window.__lab.app.planImage({})');
  if (!a) { console.error('この場面には間取り図（plan）がありません'); process.exit(1); }
  save(join(out, `${planScene}-plan.png`), a);
  const b = await evaluate(`window.__lab.app.planImage({ top: true, cut: ${topCut} })`);
  save(join(out, `${planScene}-plan-top.png`), b);
  console.log(`間取り図: ${join(out, `${planScene}-plan.png`)}\n作った場面に重ねた図: ${join(out, `${planScene}-plan-top.png`)}`);
  if (logs.length) console.log('  console:', logs.slice(0, 8).join('\n  '));
  ws.close();
  cleanup();
  process.exit(0);
}

if (shotScene) {
  await openScene(shotScene);
  const [x, y, z, yaw, pitch = 0, fov = 60] = (args[0] ?? '0,1.6,0,0').split(',').map(Number);
  const r = await evaluate(`window.__lab.app.shotStats([${x}, ${y}, ${z}], ${yaw}, ${pitch}, ${fov})`);
  const name = `${shotScene}-shot-${[x, y, z, yaw].map((v) => v.toFixed(1)).join('_')}.png`;
  save(join(out, name), r.src);
  console.log(`1 枚: ${join(out, name)}`);
  // 質感の物差し（--quality と同じ数値。基準は --quality の「視点の描画」）
  console.log('  ' + Object.entries(r.stats).map(([k, v]) => `${k} ${v}`).join('・'));
  ws.close();
  cleanup();
  process.exit(0);
}

if (reachScene) {
  // 歩いて行けるか: 出発点から参考画像の視点・道順の各点へ届くか
  await openScene(reachScene);
  const r = await evaluateRetry('(() => { const r = window.__lab.app.reach(); return { views: r.views, tour: r.tour, cells: r.cells }; })()', reachScene);
  // 泳がずに（水深 1.2 m まで）届くか。深い水が唯一の道になっていないかを見る
  const d = await evaluateRetry('(() => { const r = window.__lab.app.reach(0.3, 1.2); return { views: r.views, tour: r.tour, cells: r.cells }; })()', reachScene);
  const mark = (v, k, kind) => (v ? (d[kind][k] ? '届く  ' : '泳げば届く') : '届かない');
  console.log(`歩ける升目: ${r.cells}（泳がずに ${d.cells}）`);
  for (const [k, v] of Object.entries(r.views)) console.log(`  ${mark(v, k, 'views')} 視点 ${k}`);
  for (const [k, v] of Object.entries(r.tour)) console.log(`  ${mark(v, k, 'tour')} 道順 ${k}`);
  ws.close();
  cleanup();
  // 視点と道順の全部に届けば 0
  process.exit(Object.values(r.views).every(Boolean) && Object.values(r.tour).every(Boolean) ? 0 : 2);
}

if (qualityScene) {
  await openScene(qualityScene);
  const q = await evaluateRetry(`window.__lab.app.qualityReport(${randomN}, ${randomSeed})`, qualityScene);
  if (q.tourSheet) save(join(out, `${qualityScene}-tour.jpg`), q.tourSheet);
  save(join(out, `${qualityScene}-random.jpg`), q.randomSheet);
  const keys = ['detail', 'shape', 'light', 'contrast', 'flat', 'chroma', 'palette'];
  const names = { detail: '細部', shape: '形', light: '明暗', contrast: '幅', flat: '平ら', chroma: '彩度', palette: '色差' };
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  // 基準 = 参考画像の視点の描画（利用者が見て良いとした所）。細部・形・明暗はその最小の 0.75 倍、平らは最大 + 0.08、色差は最大の 1.4 倍 + 1 を超えたら印
  const vs = q.views.map((v) => v.stats);
  const lo = (k, f) => Math.min(...vs.map((s) => s[k])) * f;
  const hi = (k, f, a) => Math.max(...vs.map((s) => s[k])) * f + a;
  const lim = { detail: lo('detail', 0.75), shape: lo('shape', 0.75), light: lo('light', 0.6), contrast: lo('contrast', 0.7), flat: hi('flat', 1, 0.08), palette: hi('palette', 1.4, 1) };
  const flags = (s) => [
    s.detail < lim.detail ? '細部↓' : '', s.shape < lim.shape ? '形↓' : '', s.light < lim.light ? '明暗↓' : '', s.contrast < lim.contrast ? '幅↓' : '',
    s.flat > lim.flat ? '平ら↑' : '', s.palette > lim.palette ? '色↑' : '',
  ].filter(Boolean).join(' ');
  const pad = (v, n = 7) => String(v).padStart(n);
  const row = (name, s, f = '') => console.log(`  ${keys.map((k) => pad(s[k])).join('')}  ${f ? '【' + f + '】' : ''}${name}`);
  console.log(`  ${keys.map((k) => pad(names[k], 6)).join(' ')}`);
  console.log('参考画像:');
  for (const r of q.refs) row(r.id, r.stats);
  console.log('参考画像の視点の描画（基準）:');
  for (const r of q.views) row(r.id, r.stats);
  console.log(`道順（${q.tour.length}）:`);
  q.tour.forEach((r, i) => row(`${i + 1}. ${r.label}`, r.stats, flags(r.stats)));
  console.log(`無作為の場所（${q.random.length}・種 ${randomSeed}）:`);
  q.random.forEach((r) => row(r.label, r.stats, flags(r.stats)));
  const sum = (name, arr) => {
    const f = arr.filter((r) => flags(r.stats)).length;
    console.log(`  ${name}: ${keys.map((k) => `${names[k]} ${med(arr.map((r) => r.stats[k]))}`).join('・')}（印 ${f}/${arr.length}）`);
  };
  console.log('中央値（印の基準: 細部 ≥ ' + lim.detail.toFixed(3) + '・形 ≥ ' + lim.shape.toFixed(3) + '・明暗 ≥ ' + lim.light.toFixed(3) + '・幅 ≥ ' + lim.contrast.toFixed(3) + '・平ら ≤ ' + lim.flat.toFixed(3) + '・色差 ≤ ' + lim.palette.toFixed(1) + '）:');
  // 目標の目安: 道順・無作為の中央値が、視点の描画の中央値の 0.85〜1.35 倍（細部・形・明暗・幅）
  const ratio = (arr, k) => (med(arr.map((r) => r.stats[k])) / med(vs.map((s) => s[k]))).toFixed(2);
  for (const [nm, arr] of [['道順', q.tour], ['無作為', q.random]]) if (arr.length) console.log(`  ${nm} ÷ 視点の描画: ${['detail', 'shape', 'light', 'contrast'].map((k) => `${names[k]} ${ratio(arr, k)}`).join('・')}（目安 0.85〜1.35）`);
  sum('参考画像', q.refs);
  sum('視点の描画', q.views);
  if (q.tour.length) sum('道順', q.tour);
  sum('無作為', q.random);
  writeFileSync(join(out, `${qualityScene}-quality.json`), JSON.stringify({ refs: q.refs, views: q.views, tour: q.tour, random: q.random, limits: lim }, null, 2));
  console.log(`一覧: ${join(out, `${qualityScene}-tour.jpg`)}・${join(out, `${qualityScene}-random.jpg`)}`);
  if (logs.length) console.log('  console:', logs.slice(0, 8).join('\n  '));
  ws.close();
  cleanup();
  process.exit(0);
}

if (tourScene) {
  // 歩いて確かめる道順（plan.tour）を撮って一覧に: node tools/capture.mjs --page arch.html --tour corridor
  await openScene(tourScene);
  const t = await evaluate('window.__lab.app.tourSheet()');
  if (!t) { console.error('この場面には道順（plan.tour）がありません'); process.exit(1); }
  save(join(out, `${tourScene}-tour.jpg`), t);
  console.log(`道順の一覧: ${join(out, `${tourScene}-tour.jpg`)}`);
  if (doPerf) {
    let ps;
    try {
      ps = await evaluate('window.__lab.app.tourPerf()');
    } catch (e) {
      // 途中でページが読み直されたら、場面を開き直して 1 回だけやり直す
      console.log(`  重さの測定をやり直します: ${e.message}`);
      await openScene(tourScene);
      ps = await evaluate('window.__lab.app.tourPerf()');
    }
    for (const p of ps) console.log(`  ${p.ms > 8 ? '重い' : '    '} ${p.ms} ms・描画 ${p.calls} 回  ${p.label}`);
  }
  if (logs.length) console.log('  console:', logs.slice(0, 8).join('\n  '));
  ws.close();
  cleanup();
  process.exit(0);
}

if (topScene) {
  // 真上から見た図（間取りの確かめ）: node tools/capture.mjs --top station [--cut 4]
  await send('Page.navigate', { url: `${base}${pageFile}?capture=1&scene=${topScene}${extra ? '&' + extra : ''}` });
  for (let i = 0; i < 300; i++) {
    await sleep(100);
    let ok = false;
    try { ok = await evaluate('!!(window.__lab && (window.__lab.ready || window.__lab.error))'); } catch {}
    if (ok) break;
  }
  const r = await evaluate(`window.__lab.app.topDownMap(${topCut})`);
  save(join(out, `${topScene}-top.png`), r.image);
  console.log(`真上の図: ${join(out, `${topScene}-top.png`)}  範囲 x ${r.bounds[0].toFixed(1)}〜${r.bounds[2].toFixed(1)} / z ${r.bounds[1].toFixed(1)}〜${r.bounds[3].toFixed(1)} m`);
  ws.close();
  cleanup();
  process.exit(0);
}

if (doAnalyze) {
  // 参考画像の特徴を数値にする（段階 0）。OKLab で計算する
  for (const v of views) {
    await send('Page.navigate', { url: `${base}refs/${v}.jpg` });
    await sleep(500);
    const r = await evaluate(`(async () => {
      const img = document.querySelector('img'); await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, W, H).data;
      const lin = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
      const lab = (r, gg, b) => {
        r = lin(r); gg = lin(gg); b = lin(b);
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gg + 0.0514459929 * b);
        const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gg + 0.1073969566 * b);
        const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * gg + 0.6299787005 * b);
        return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827607001 * m - 0.808675766 * s];
      };
      const N = W * H, L = new Float32Array(N), C = new Float32Array(N), Hh = new Float32Array(N);
      const counts = new Map();
      for (let i = 0; i < N; i++) {
        const o = lab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
        L[i] = o[0]; C[i] = Math.hypot(o[1], o[2]); Hh[i] = (Math.atan2(o[2], o[1]) * 180 / Math.PI + 360) % 360;
        const q = (Math.round(d[i * 4] / 255 * 31) << 10) | (Math.round(d[i * 4 + 1] / 255 * 31) << 5) | Math.round(d[i * 4 + 2] / 255 * 31);
        counts.set(q, (counts.get(q) || 0) + 1);
      }
      const pct = (arr, p) => { const s = Array.from(arr.filter((_, i) => i % 13 === 0)).sort((a, b) => a - b); return s[Math.floor(s.length * p)]; };
      let flat = 0;
      for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const i = y * W + x; if (Math.max(Math.abs(L[i + 1] - L[i]), Math.abs(L[i + W] - L[i])) < 0.01) flat++; }
      const top = Array.from(counts.values()).sort((a, b) => b - a);
      const top16 = top.slice(0, 16).reduce((a, b) => a + b, 0) / N;
      const hues = []; for (let i = 0; i < N; i += 7) if (C[i] > 0.02) hues.push(Hh[i]); hues.sort((a, b) => a - b);
      const rows = []; for (let k = 0; k < 8; k++) { let s = 0, n = 0; for (let y = Math.floor(H * k / 8); y < Math.floor(H * (k + 1) / 8); y++) for (let x = 0; x < W; x += 4) { s += L[y * W + x]; n++; } rows.push(+(s / n).toFixed(2)); }
      // 10 色の表（k-means。OKLab で 6 画素ごと）
      const pts = []; const rgb = [];
      for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 6) { const i = y * W + x; const o = lab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); pts.push(o); rgb.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]); }
      let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const K = 10; const cen = [pts[Math.floor(rnd() * pts.length)]];
      while (cen.length < K) { const dist = pts.map((p) => Math.min(...cen.map((c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2))); const tot = dist.reduce((a, b) => a + b, 0); let r = rnd() * tot; let j = 0; while ((r -= dist[j]) > 0 && j < dist.length - 1) j++; cen.push(pts[j].slice()); }
      const lb = new Int32Array(pts.length);
      for (let it = 0; it < 20; it++) {
        for (let i = 0; i < pts.length; i++) { let best = 0, bd = 1e9; for (let k = 0; k < K; k++) { const p = pts[i], c = cen[k]; const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; best = k; } } lb[i] = best; }
        for (let k = 0; k < K; k++) { const s = [0, 0, 0]; let n = 0; for (let i = 0; i < pts.length; i++) if (lb[i] === k) { s[0] += pts[i][0]; s[1] += pts[i][1]; s[2] += pts[i][2]; n++; } if (n) cen[k] = s.map((v) => v / n); }
      }
      const pal = [];
      for (let k = 0; k < K; k++) { const s = [0, 0, 0]; let n = 0; for (let i = 0; i < pts.length; i++) if (lb[i] === k) { s[0] += rgb[i][0]; s[1] += rgb[i][1]; s[2] += rgb[i][2]; n++; } if (n) pal.push({ share: n / pts.length, hex: '#' + s.map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join(''), L: cen[k][0] }); }
      pal.sort((a, b) => b.share - a.share);
      let sumL = 0, sumC = 0; for (let i = 0; i < N; i++) { sumL += L[i]; sumC += C[i]; }
      return { meanL: +(sumL / N).toFixed(3), p5: +pct(L, 0.05).toFixed(3), p95: +pct(L, 0.95).toFixed(3), meanC: +(sumC / N).toFixed(3), hue: hues.length ? +hues[hues.length >> 1].toFixed(0) : null, flat: +(flat / N).toFixed(3), top16: +top16.toFixed(3), rows, palette: pal.map((p) => p.hex + ' ' + Math.round(p.share * 100) + '% L' + p.L.toFixed(2)) };
    })()`);
    console.log(`== ${v}`);
    console.log(`  明度 平均 ${r.meanL}（p5 ${r.p5} / p95 ${r.p95}）・彩度 ${r.meanC}・色相 ${r.hue}°・平坦率 ${r.flat}・上位16色 ${r.top16}`);
    console.log(`  行ごとの明度（上→下）: ${r.rows.join(' ')}`);
    console.log(`  色: ${r.palette.join('  ')}`);
    // 目安（今回の 14 枚で決めた）: 上位 16 色の面積が多いほど「色を指定して塗る」場面。最後は目で決める
    const kind = r.top16 >= 0.75 ? '色数が少ない → 色指定で塗る（段落とし / 平らな色面）'
      : r.top16 >= 0.6 ? '色面が主（淡い色の差が多い）→ 色指定で塗る'
      : 'グラデーション・模様が多い → 光・霧・反射・模様で作る（タイルや水の模様で色数が増えている場合は段落としも）';
    console.log(`  描き方の型の目安: ${kind}`);
  }
  ws.close();
  cleanup();
  process.exit(0);
}

if (sampleBoth) {
  logs.length = 0;
  await send('Page.navigate', { url: `${base}${pageFile}?capture=1&view=${sampleBoth}${extra ? '&' + extra : ''}` });
  for (let i = 0; i < 300; i++) {
    await sleep(100);
    let ok = false;
    try { ok = await evaluate('!!(window.__lab && (window.__lab.ready || window.__lab.error))'); } catch {}
    if (ok) break;
  }
  const pts = args.map((a) => a.split(',').map(Number));
  const res = await evaluate(`(async () => {
    const r = await window.__lab.capture(${JSON.stringify(sampleBoth)});
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const pick = (img) => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g; };
    const a = pick(await load(r.render));
    const b = pick(await load('refs/${sampleBoth}.jpg'));
    const hex = (g, x, y) => { const d = g.getImageData(Math.max(0, x - 3), Math.max(0, y - 3), 7, 7).data; let s = [0, 0, 0]; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; } return '#' + s.map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join(''); };
    return ${JSON.stringify(pts)}.map(([x, y]) => x + ',' + y + '  描画 ' + hex(a, x, y) + '  参考 ' + hex(b, x, y));
  })()`);
  console.log(res.join('\n'));
  ws.close();
  cleanup();
  process.exit(0);
}

const summary = [];
let lastScene = '';
for (const v of views) {
  const scene = v.replace(/-\d+$/, '');
  if (scene !== lastScene) {
    logs.length = 0;
    await send('Page.navigate', { url: `${base}${pageFile}?capture=1&view=${v}${extra ? '&' + extra : ''}` });
    let ok = false;
    for (let i = 0; i < 300; i++) {
      await sleep(100);
      let err = null;
      try { ok = await evaluate('!!(window.__lab && window.__lab.ready)'); err = await evaluate('window.__lab && window.__lab.error || null'); } catch {}
      if (ok || err) { if (err) { logs.push(err); ok = false; } break; }
    }
    if (!ok) { console.error(`${v}: 読み込みに失敗`, logs.join('\n')); continue; }
    lastScene = scene;
  }
  // 他の作業でファイルが変わると開発サーバーがページを読み直して撮影が止まるので、1 回だけ開き直してやり直す
  let r;
  try {
    r = await evaluate(`window.__lab.capture(${JSON.stringify(v)}, ${gridX}, ${gridY})`);
  } catch (e) {
    console.log(`  ${v}: 撮影が止まった（${String(e).slice(0, 80)}）。開き直してやり直す`);
    await send('Page.navigate', { url: `${base}${pageFile}?capture=1&view=${v}${extra ? '&' + extra : ''}` });
    for (let i = 0; i < 300; i++) {
      await sleep(100);
      let ok = false;
      try { ok = await evaluate('!!(window.__lab && window.__lab.ready)'); } catch {}
      if (ok) break;
    }
    r = await evaluate(`window.__lab.capture(${JSON.stringify(v)}, ${gridX}, ${gridY})`);
  }
  save(join(out, `${v}.png`), r.render);
  if (r.compare) save(join(out, `${v}-cmp.png`), r.compare);
  if (r.diff) save(join(out, `${v}-diff.png`), r.diff);
  if (r.edges) save(join(out, `${v}-edges.png`), r.edges);
  const m = r.metrics;
  summary.push({ view: v, ...m });
  if (doPerf) {
    const p = await evaluate('window.__lab.app.perf()');
    m.perf = p;
    console.log(`${v}: 1 フレーム ${p.ms} ms・描画 ${p.calls} 回・${Math.round(p.triangles / 1000)}k 三角形`);
  }
  const rows = (a) => (a ? Array.from({ length: gridY }, (_, y) => a.slice(y * gridX, (y + 1) * gridX).join(' ')).join(' | ') : '');
  console.log(`${v}: ΔE ${m.dE}  ΔL ${m.dL}  彩度 ${m.chromaRender}/${m.chromaRef}  構図 F ${m.edgeF}（P ${m.edgeP} / R ${m.edgeR}）\n  地域ΔE [${rows(m.gridDE)}]\n  地域ΔL [${rows(m.gridDL)}]`);
  if (logs.length) console.log('  console:', logs.splice(0).slice(0, 8).join('\n  '));
}
writeFileSync(join(out, 'metrics.json'), JSON.stringify(summary, null, 2));
if (baselineFile) {
  // 元の版との比べ（建築版の合格: ΔE は +0.5 以内、構図 F は −3 以内）
  const { readFileSync } = await import('node:fs');
  const base0 = JSON.parse(readFileSync(baselineFile, 'utf8')).views;
  console.log('元の版との比べ（ΔE +0.5 以内・構図 F −3 以内で合格）:');
  for (const m of summary) {
    const b = base0[m.view];
    if (!b || m.dE === undefined) continue;
    const dd = +(m.dE - b.dE).toFixed(1);
    const df = +((m.edgeF ?? 0) - (b.edgeF ?? 0)).toFixed(1);
    const ok = dd <= 0.5 && df >= -3;
    console.log(`  ${ok ? '合格' : '不合格'} ${m.view}: ΔE ${b.dE} → ${m.dE}（${dd >= 0 ? '+' : ''}${dd}）・構図 F ${b.edgeF} → ${m.edgeF}（${df >= 0 ? '+' : ''}${df}）`);
  }
}
if (doSheet && summary.length) {
  const { readFileSync } = await import('node:fs');
  const items = summary.filter((s) => s.dE !== undefined).map((s) => ({ view: s.view, dE: s.dE, data: 'data:image/png;base64,' + readFileSync(join(out, `${s.view}-cmp.png`)).toString('base64') }));
  const sheet = await evaluate(`(async () => {
    const items = ${JSON.stringify(items)};
    const W = 1456, H = 408, LAB = 26;
    const c = document.createElement('canvas'); c.width = W; c.height = items.length * (H + LAB);
    const g = c.getContext('2d'); g.fillStyle = '#101416'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < items.length; i++) {
      const img = new Image(); img.src = items[i].data; await img.decode();
      const y = i * (H + LAB);
      g.fillStyle = '#e8efec'; g.font = '16px sans-serif';
      g.fillText(items[i].view + '   ΔE ' + items[i].dE + '   （左: 描画 / 右: 参考画像）', 8, y + 19);
      g.drawImage(img, 0, y + LAB, W, H);
    }
    return c.toDataURL('image/jpeg', 0.86);
  })()`);
  save(join(out, 'sheet.jpg'), sheet);
  console.log('一覧: ' + join(out, 'sheet.jpg'));
}
console.log(`保存: ${out}`);
ws.close();
cleanup();
process.exit(0);
