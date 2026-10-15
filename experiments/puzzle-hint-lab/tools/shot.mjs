#!/usr/bin/env node
// デモを裏のブラウザ（Chrome headless・GPU あり）で開いて撮る。開発サーバー（npm run dev → http://localhost:5181/）が要る。
// アプリのブラウザのペインを使わない（ペインが隠れると描くのが毎秒数回に落ちて、動きを確かめられない）。
// 毎回まっさらなブラウザ（保存なし）で、?test=1（Pointer Lock を使わない）で開き、開始のボタンを押してから始める。
//
// 使い方:
//   node tools/shot.mjs room                                  … 1・3 秒後を撮る（scratch/shots/room-1s.png など）
//   node tools/shot.mjs tab --key Tab@1 --at 2.5              … 1 秒に Tab を押して 2.5 秒に撮る
//   node tools/shot.mjs walk --hold KeyW@1-2.5 --at 3         … 1〜2.5 秒に W を押し続ける
//   node tools/shot.mjs dbg --eval "debug.nextStage()@1"      … 1 秒にページの中で実行（結果を出す）
//   node tools/shot.mjs glass --params "tablet=glass&seed=3"  … URL の値を足す
//   node tools/shot.mjs m --size 1280x800 --dpr 2             … 画面の大きさ（既定 1456x816・dpr 1）
//   node tools/shot.mjs x --no-start                          … 開始の画面のまま
// 出力: --out <dir>（既定 scratch/shots。git に入らない）。終わりに console のエラーを出す
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const optAll = (k) => { const out = []; for (;;) { const i = args.indexOf(k); if (i < 0) return out; out.push(args[i + 1]); args.splice(i, 2); } };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };

const out = opt('--out', join(here, '..', 'scratch', 'shots'));
const atList = optAll('--at');
const at = (atList.length ? atList.join(',') : '1,3').split(',').map(Number);
const [W, H] = opt('--size', '1456x816').split('x').map(Number);
const dpr = Number(opt('--dpr', '1'));
const base = opt('--url', 'http://localhost:5181/');
const extra = opt('--params', '');
const noStart = flag('--no-start');
const keys = optAll('--key');
const holds = optAll('--hold');
const evals = optAll('--eval');
const name = args[0];
if (!name) { console.error('名前を指定してください（例: node tools/shot.mjs room）'); process.exit(1); }
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(out, { recursive: true });

const port = 9100 + Math.floor(Math.random() * 800);
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'phl-cdp-'));
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${W},${H}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = () => { try { proc.kill(); } catch {} try { rmSync(dir, { recursive: true, force: true }); } catch {} };
process.on('exit', cleanup);
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(143); });
process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); cleanup(); process.exit(1); });

let targets;
for (let i = 0; i < 150; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.some((t) => t.type === 'page')) break; } catch {}
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
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.error || !r.result) throw new Error(`評価できませんでした: ${r.error?.message ?? '結果なし'}`);
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
  return r.result.result.value;
};
await send('Page.enable');
await send('Runtime.enable');
// 撮影中にほかの作業がファイルを保存しても読み直さない（HMR の WebSocket を偽物にする）
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const Real = window.WebSocket;
  class Quiet extends EventTarget { constructor() { super(); this.readyState = 0; } send() {} close() {} }
  const W = function (url, proto) { return proto === 'vite-hmr' || proto === 'vite-ping' ? new Quiet() : new Real(url, proto); };
  Object.assign(W, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  W.prototype = Real.prototype;
  window.WebSocket = W;
})();` });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: false });
const q = new URLSearchParams(extra);
q.set('test', '1');
await send('Page.navigate', { url: `${base}?${q.toString()}` });

let ready = false;
for (let i = 0; i < 300 && !ready; i++) {
  await sleep(100);
  try { ready = await evaluate('window.__phlReady === true'); } catch {}
}
if (!ready) { console.error('デモが始まりませんでした（30 秒）'); for (const l of logs) console.error(l); cleanup(); process.exit(1); }
if (!noStart) await evaluate(`document.querySelector('[data-act="go"]')?.click()`);
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;

const CODES = { Tab: 9, Escape: 27, Space: 32, Enter: 13, ShiftLeft: 16 };
const vk = (code) => CODES[code] ?? (code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0);
const keyName = (code) => (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code);
const keyEvent = (type, code) => send('Input.dispatchKeyEvent', { type, code, key: keyName(code), windowsVirtualKeyCode: vk(code) });

const events = [];
for (const s of keys) { const [code, t] = s.split('@'); events.push({ t: Number(t), run: async () => { await keyEvent('keyDown', code); await sleep(30); await keyEvent('keyUp', code); } }); }
for (const s of holds) {
  const [code, span] = s.split('@');
  const [ts, te] = span.split('-').map(Number);
  events.push({ t: ts, run: () => keyEvent('keyDown', code) });
  events.push({ t: te, run: () => keyEvent('keyUp', code) });
}
for (const s of evals) { const i = s.lastIndexOf('@'); const code = s.slice(0, i); events.push({ t: Number(s.slice(i + 1)), run: () => evaluate(code).then((v) => { if (v !== undefined) console.log(`eval → ${JSON.stringify(v)}`); }) }); }
for (const t of at) events.push({ t, shot: true });
events.sort((a, b) => a.t - b.t);

const saved = [];
for (const ev of events) {
  const wait = ev.t - now();
  if (wait > 0) await sleep(wait * 1000);
  if (ev.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(out, `${name}-${ev.t}s.png`);
    writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    saved.push(file);
  } else {
    try { await ev.run(); } catch (e) { console.error('操作の失敗:', e.message); }
  }
}
for (const f of saved) console.log(f);
const uniq = [...new Set(logs)];
if (uniq.length) { console.log(`console（${uniq.length} 件）:`); for (const l of uniq.slice(0, 30)) console.log('  ' + l.slice(0, 400)); }
cleanup();
process.exit(0);
