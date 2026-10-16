#!/usr/bin/env node
// Copy this file into a source repository as .demo/publish.mjs.
// Cloudflare credentials are never needed in a source repository.
import { readFile, readdir, lstat, realpath, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const HUB = 'https://game-demo-hub.tomo-ohta-demos.workers.dev';
const args = process.argv.slice(2);
function option(name, fallback) { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; }
function assert(value, message) { if (!value) throw new Error(message); }
function validId(id) { assert(typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 40, 'Invalid demo ID'); return id; }
function safePath(path) {
  assert(typeof path === 'string' && path && path.length <= 1024 && !/[\\%?#\x00-\x1f\x7f:]/.test(path), 'Invalid asset path');
  assert(!path.split('/').some(part => !part.trim() || part.startsWith('.') || !/^[\p{L}\p{N}_@ .()+!~-]+$/u.test(part)), 'Invalid asset path');
  assert(!/\.(map|pem|key|sqlite|sqlite3|db)$/i.test(path), 'Remove source maps or private files from the build output');
  return path;
}
async function run(command, parameters, options = {}) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, parameters, { stdio: 'inherit', ...options });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolveRun() : reject(new Error('Command failed; no publication was made')));
  });
}
function command(value) { assert(typeof value === 'string' && value.trim(), 'A build/check command is missing'); return run(value, [], { shell: true }); }
async function config() {
  const parsed = JSON.parse(await readFile(option('--config', 'demo.config.json'), 'utf8'));
  assert(parsed && typeof parsed.demos === 'object' && !Array.isArray(parsed.demos) && Object.keys(parsed.demos).length, 'demo.config.json must define demos');
  for (const id of Object.keys(parsed.demos)) validId(id);
  return parsed;
}
function mainBuild() {
  assert(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REF === 'refs/heads/main' && ['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME), 'Publication only runs from GitHub Actions main builds');
  assert(/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || ''), 'Commit SHA is missing');
}
async function collect(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name); const stat = await lstat(absolute);
    assert(!stat.isSymbolicLink(), 'Build output must not contain symbolic links');
    if (stat.isDirectory()) files.push(...await collect(root, absolute));
    else {
      assert(stat.isFile(), 'Only regular files can be published');
      const path = safePath(relative(root, absolute).split(sep).join('/'));
      assert(stat.size <= 25 * 1024 * 1024, 'A file exceeds 25 MiB');
      const content = await readFile(absolute); files.push({ path, size: content.length, sha256: createHash('sha256').update(content).digest('hex') });
    }
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
let cachedToken; let tokenAt = 0;
async function token(refresh = false) {
  if (cachedToken && !refresh && Date.now() - tokenAt < 120000) return cachedToken;
  const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL || 'https://invalid.invalid');
  assert(url.protocol === 'https:' && url.hostname.endsWith('.actions.githubusercontent.com'), 'GitHub OIDC endpoint is unavailable');
  assert(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'The publish job requires id-token: write');
  url.searchParams.set('audience', HUB);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, redirect: 'error' });
  assert(response.ok, 'GitHub authentication could not be obtained');
  cachedToken = (await response.json()).value; tokenAt = Date.now();
  assert(typeof cachedToken === 'string' && cachedToken.length < 16000, 'Invalid GitHub authentication');
  return cachedToken;
}
async function api(path, method = 'GET', body, retry = true) {
  const headers = { Authorization: `Bearer ${await token()}` };
  if (body && !(body instanceof Uint8Array)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${HUB}${path}`, { method, headers, body: body instanceof Uint8Array ? body : body === undefined ? undefined : JSON.stringify(body), redirect: 'error' });
  if (response.status === 401 && retry) { await token(true); return api(path, method, body, false); }
  let result; try { result = await response.json(); } catch { throw new Error(`Publication service returned HTTP ${response.status}`); }
  assert(response.ok, `Publication failed (HTTP ${response.status}): ${result.error || 'Request rejected'}`);
  return result;
}
async function prepare(id, definition) {
  if (definition.install) await command(definition.install);
  await command(definition.check); await command(definition.build);
  const root = await realpath(resolve(definition.directory));
  const cwd = await realpath(process.cwd());
  assert(root.startsWith(`${cwd}${sep}`) && root !== cwd, 'Build directory must be inside the source repository');
  const files = await collect(root);
  assert(files.length > 0 && files.length <= 5000 && files.reduce((total, file) => total + file.size, 0) <= 512 * 1024 * 1024, 'Build output exceeds platform limits');
  const output = resolve('.demo-package'); await mkdir(join(output, 'files'), { recursive: true });
  const existing = await readdir(output);
  assert(existing.every(name => name === 'files'), 'Package directory must be clean');
  assert((await readdir(join(output, 'files'))).length === 0, 'Package directory must be clean');
  for (const file of files) {
    const destination = join(output, 'files', file.path); await mkdir(dirname(destination), { recursive: true }); await copyFile(join(root, file.path), destination);
  }
  await writeFile(join(output, 'manifest.json'), JSON.stringify({ demoId: id, sourceSha: process.env.GITHUB_SHA, files }));
  console.log(`Validated ${files.length} files for ${id}.`);
}
async function upload(id) {
  mainBuild();
  const root = resolve('.demo-package/files'); const manifest = JSON.parse(await readFile('.demo-package/manifest.json', 'utf8'));
  assert(manifest.demoId === id && manifest.sourceSha === process.env.GITHUB_SHA, 'Package does not match this main build');
  const actual = await collect(root);
  assert(JSON.stringify(actual) === JSON.stringify(manifest.files), 'Package contents do not match the manifest');
  const start = await api(`/api/publish/${id}/releases`, 'POST', { files: manifest.files });
  for (let index = 0; index < manifest.files.length; index += 2) {
    await Promise.all(manifest.files.slice(index, index + 2).map(async file => {
      const content = new Uint8Array(await readFile(join(root, safePath(file.path))));
      await api(`/api/publish/${id}/releases/${start.releaseId}/files/${file.path.split('/').map(encodeURIComponent).join('/')}`, 'PUT', content);
    }));
  }
  const result = await api(`/api/publish/${id}/releases/${start.releaseId}/activate`, 'POST');
  console.log(`Published ${id}: ${HUB}/open/${id}\nRelease: ${result.releaseId}`);
}
async function start() {
  const definitions = await config();
  if (args.includes('--matrix')) {
    const requested = option('--demo'); const ids = requested ? [validId(requested)] : Object.keys(definitions.demos);
    if (args.includes('--rollback')) assert(requested && /^[a-f0-9]{40}-\d+-\d+$/.test(option('--rollback')), 'Rollback requires one demo ID and a release ID');
    assert(ids.every(id => definitions.demos[id]), 'Unknown demo ID');
    assert(process.env.GITHUB_OUTPUT, 'GitHub output is unavailable');
    const { appendFile } = await import('node:fs/promises'); await appendFile(process.env.GITHUB_OUTPUT, `demos=${JSON.stringify(ids)}\n`); return;
  }
  const id = validId(option('--demo', args.find(value => !value.startsWith('-')) || Object.keys(definitions.demos)[0]));
  assert(definitions.demos[id], 'Unknown demo ID');
  if (process.env.GITHUB_ACTIONS !== 'true') {
    const parameters = ['workflow', 'run', 'publish-demos.yml', '--ref', 'main', '-f', `demo=${id}`];
    if (args.includes('--rollback')) { const version = option('--rollback'); assert(/^[a-f0-9]{40}-\d+-\d+$/.test(version), 'Invalid release ID'); parameters.push('-f', `rollback=${version}`); }
    await run('gh', parameters);
    console.log('Publication requested for the committed main branch. Follow the GitHub Actions link to see the result.'); return;
  }
  if (args.includes('--prepare')) return prepare(id, definitions.demos[id]);
  if (args.includes('--upload')) return upload(id);
  if (args.includes('--rollback')) {
    mainBuild(); const version = option('--rollback'); assert(/^[a-f0-9]{40}-\d+-\d+$/.test(version), 'Invalid release ID');
    await api(`/api/publish/${id}/rollback`, 'POST', { releaseId: version }); console.log(`Restored ${id} to ${version}`); return;
  }
  throw new Error('Use --prepare or --upload in GitHub Actions');
}
export { safePath, validId, collect };
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) start().catch(error => { console.error(error.message); process.exitCode = 1; });
