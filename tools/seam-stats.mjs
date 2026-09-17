#!/usr/bin/env node
/**
 * seam-stats: WorldManager を Node で headless 実行して生成品質を計測する（SEAM-10）。
 *
 *   node tools/seam-stats.mjs [--seeds 42,1,2,...] [--rooms 100] [--root <projectRoot>] [--md] [--json] [--keep]
 *
 * - rolldown（vite 同梱。追加依存なし）で src/world/WorldManager.ts ほかを ESM に束ねて実行する（npm install 不要）。
 * - --root を別のプロジェクトルート（例: 変更前のバックアップ）にすると、同条件で変更前後を比較できる。
 * - 各 seed について Game.enterRoom と同じ順序（markVisited → frozen = 現在 + 直前の構築集合 + 訪問済み → prepareRoom）で
 *   未訪問の配置済み隣室を優先する DFS 徒歩で N 部屋踏破し、以下を集計する:
 *     WARN ログ（seam fallback / dead-end lock / forward not guaranteed）、前室ノード数、施錠扉率、
 *     部屋の重なり（配置済み AABB の重なり組数。0 が正）、決定論（同 seed 2 回で graph.toJSON 一致）、
 *     toJSON → fromJSON 後の全ノード layoutFor のソケット一致と箱・照明一致（セーブ整合。holeLocal 由来の乱数ずれの検出）、
 *     施錠され行き先の無い非扉開口（stairs / ramp / street / gate。0 が正）。
 * - 読み取り専用。src は変更しない。束ねた一時ファイルは OS の一時ディレクトリに置く（--keep で残す）。
 */
import { mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');

// ------------------------------------------------------------ 引数
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const SEEDS = String(opt('seeds', '42,1,2,3,4,5,6,7,8,9')).split(',').map(Number);
const N = Number(opt('rooms', 100));
const ROOT = resolve(String(opt('root', projectRoot)));
const OUT_MD = opt('md', false) !== false;
const OUT_JSON = opt('json', false) !== false;
const KEEP = opt('keep', false) !== false;
// Phase 2: Modifier（layout / onNodeCreated / onConnect）を含めて計測する（既定）。--no-mods で Modifier 無しの世界と比較できる。
// rolldown は import.meta.glob を展開しないので、src/modifiers/mods/*.ts を列挙して registerModifier で手動登録する
const WITH_MODS = opt('no-mods', false) === false;

// ------------------------------------------------------------ 束ね（rolldown）
const tmp = mkdtempSync(join(tmpdir(), 'seamstats-'));
const entryPath = join(tmp, 'entry.ts');
const bundlePath = join(tmp, 'world.bundle.mjs');
const src = (p) => join(ROOT, 'src', p).replace(/\\/g, '/');
const modFiles = WITH_MODS
  ? readdirSync(join(ROOT, 'src', 'modifiers', 'mods')).filter((f) => /^[A-Za-z0-9_]+\.ts$/.test(f)).sort()
  : [];
writeFileSync(
  entryPath,
  [
    `export { WorldManager } from '${src('world/WorldManager')}';`,
    `export { RoomGraph } from '${src('world/RoomGraph')}';`,
    `export { ROOM_BY_ID } from '${src('data/index')}';`,
    `export { aabbOverlap } from '${src('core/aabb')}';`,
    `export { registerModifier, registeredModifierIds } from '${src('modifiers/index')}';`,
    `export { installWorldHooks } from '${src('modifiers/hooks')}';`,
    `import { registerModifier as _reg } from '${src('modifiers/index')}';`,
    ...modFiles.map((f, i) => `import _m${i} from '${src(`modifiers/mods/${f}`)}';`),
    ...modFiles.map((_, i) => `_reg(_m${i});`),
    '',
  ].join('\n'),
);

async function bundle() {
  const rolldownPath = join(projectRoot, 'node_modules', 'rolldown', 'dist', 'index.mjs');
  if (!existsSync(rolldownPath)) throw new Error(`rolldown not found at ${rolldownPath}（vite 8 に同梱されているはず）`);
  const { rolldown } = await import(pathToFileURL(rolldownPath).href);
  const b = await rolldown({ input: entryPath, platform: 'node', logLevel: 'silent' });
  await b.write({ file: bundlePath, format: 'esm' });
  await b.close?.();
}

// ------------------------------------------------------------ 計測
function overlapCount(world, aabbOverlap) {
  const entries = [...world.worldBounds.entries()];
  let n = 0;
  const pairs = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (aabbOverlap(entries[i][1], entries[j][1])) {
        n++;
        if (pairs.length < 5) pairs.push(`${entries[i][0]}~${entries[j][0]}`);
      }
    }
  }
  return { n, pairs };
}

function walk(M, seed, n) {
  const { WorldManager, RoomGraph, ROOM_BY_ID } = M;
  const world = new WorldManager(new RoomGraph(seed));
  // Game.registerWorldHooks と同じ配線（Modifier の onNodeCreated / onConnect）
  if (WITH_MODS) M.installWorldHooks(world);
  const start = world.createStartRoom();
  let cur = start.roomId;
  let built = new Set();
  const enter = (id) => {
    const node = world.graph.get(id);
    const def = node.isAdapter ? null : ROOM_BY_ID.get(node.definitionId);
    world.graph.markVisited(id, node.definitionId, def?.rarity ?? null);
    const visited = [...world.graph.nodes.values()].filter((x) => x.visited).map((x) => x.roomId);
    world.frozen = new Set([id, ...built, ...visited]);
    world.prepareRoom(id);
    built = new Set([id, ...world.graph.placedNeighbors(id)]);
    world.dirty.clear();
  };
  enter(cur);
  const stack = [];
  let seamCross = 0;
  let guard = 0;
  while (world.graph.visitedCount < n && guard++ < n * 40) {
    const node = world.graph.get(cur);
    const opts = node.portals.filter((p) => p.targetRoomId && !p.locked && !p.seam && !p.oneWay && world.graph.has(p.targetRoomId) && !world.graph.get(p.targetRoomId).visited && world.graph.get(p.targetRoomId).placement);
    let next = opts[0]?.targetRoomId;
    if (!next && stack.length === 0) {
      // 行き止まりで戻る先も無いときだけ、意図的 Seam 扉（Legendary 前室 / hook）を通る
      const sp = node.portals.find((p) => p.seam && p.type === 'door' && !p.isReturn && !p.locked);
      if (sp) {
        const r = world.resolveSeamTarget(node, sp);
        seamCross++;
        next = r.target.roomId;
      }
    }
    if (!next) {
      next = stack.pop();
      if (!next) break;
    } else stack.push(cur);
    cur = next;
    enter(cur);
  }
  return { world, seamCross };
}

function measure(M, seed, n) {
  const { WorldManager, RoomGraph, ROOM_BY_ID, aabbOverlap } = M;
  const t0 = performance.now();
  const { world, seamCross } = walk(M, seed, n);
  const ms = performance.now() - t0;
  const nodes = [...world.graph.nodes.values()];
  const count = (re) => world.log.filter((l) => re.test(l)).length;
  const r = {
    seed,
    visited: world.graph.visitedCount,
    nodes: nodes.length,
    rooms: nodes.filter((x) => !x.isAdapter).length,
    vest: nodes.filter((x) => x.isAdapter && x.adapter?.kind === 'vestibule').length,
    crawl: nodes.filter((x) => x.isAdapter && x.adapter?.kind === 'crawl').length,
    seamLog: count(/WARN seam fallback/),
    deadEnd: count(/WARN dead-end lock/),
    fwdWarn: count(/WARN forward portal not guaranteed/),
    legendaryFar: count(/INFO legendary far/),
    newExit: count(/INFO new exit/),
    smallReroll: count(/INFO small reroll/),
    hookWarn: count(/WARN connect hook/),
    seamDoors: 0,
    seamCross,
    locked: 0,
    doors: 0,
    removed: nodes.reduce((a, x) => a + x.removedSockets.length, 0),
    area: 0,
    overlap: 0,
    overlapPairs: '',
    deterministic: false,
    loadMismatch: -1,
    ms: Math.round(ms),
  };
  for (const nd of nodes) {
    for (const p of nd.portals) {
      if (p.type === 'door' && !p.isReturn) {
        r.doors++;
        if (p.locked) r.locked++;
        if (p.seam) r.seamDoors++;
      }
    }
    if (!nd.isAdapter && nd.placement) {
      const L = world.layoutFor(nd);
      r.area += L.footprint.reduce((a, q) => a + (q.x1 - q.x0) * (q.z1 - q.z0), 0);
    }
  }
  r.avgArea = r.rooms ? Math.round(r.area / r.rooms) : 0;
  const ov = overlapCount(world, aabbOverlap);
  r.overlap = ov.n;
  r.overlapPairs = ov.pairs.join(' ');
  // 決定論: 同 seed でもう 1 回
  const a = JSON.stringify(world.graph.toJSON());
  const b = JSON.stringify(walk(M, seed, n).world.graph.toJSON());
  r.deterministic = a === b;
  // セーブ整合: toJSON → fromJSON → 全ノードの layoutFor のソケット・箱・照明が一致するか
  // （ソケットだけでは holeLocal の有無で家具・消灯パターンがずれる不整合を検出できない）
  const w2 = new WorldManager(RoomGraph.fromJSON(JSON.parse(a)));
  let mismatch = 0;
  let layoutMismatch = 0;
  for (const nd of world.graph.nodes.values()) {
    if (!nd.placement) continue;
    const L1 = world.layoutFor(nd);
    const L2 = w2.layoutFor(w2.graph.get(nd.roomId));
    if (JSON.stringify(L1.sockets) !== JSON.stringify(L2.sockets)) mismatch++;
    if (JSON.stringify(L1.boxes) !== JSON.stringify(L2.boxes) || JSON.stringify(L1.lights) !== JSON.stringify(L2.lights)) layoutMismatch++;
  }
  r.loadMismatch = mismatch;
  r.loadLayoutMismatch = layoutMismatch;
  // 施錠され行き先の無い非扉開口（stairs / ramp / street / gate）。扉パネルが無いので「向こうに何も無い開口」になる。0 が正
  r.voidOpenings = 0;
  for (const nd of nodes) {
    for (const p of nd.portals) {
      if (!p.isReturn && p.locked && !p.targetRoomId && !p.seam && p.type !== 'door' && p.type !== 'hole' && !nd.removedSockets.includes(p.socketId)) r.voidOpenings++;
    }
  }
  void ROOM_BY_ID;
  return r;
}

function per100(x, base) {
  return base ? (100 * x) / base : 0;
}

function summarize(rows) {
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const s = {
    seeds: rows.length,
    roomsPerSeed: N,
    visited: sum('visited'),
    nodes: sum('nodes'),
    rooms: sum('rooms'),
    vest: sum('vest'),
    crawl: sum('crawl'),
    seamLog: sum('seamLog'),
    deadEnd: sum('deadEnd'),
    fwdWarn: sum('fwdWarn'),
    legendaryFar: sum('legendaryFar'),
    newExit: sum('newExit'),
    smallReroll: sum('smallReroll'),
    seamDoors: sum('seamDoors'),
    seamCross: sum('seamCross'),
    locked: sum('locked'),
    doors: sum('doors'),
    removed: sum('removed'),
    overlap: sum('overlap'),
    deterministic: rows.every((r) => r.deterministic),
    loadMismatch: sum('loadMismatch'),
    loadLayoutMismatch: sum('loadLayoutMismatch'),
    voidOpenings: sum('voidOpenings'),
    avgArea: Math.round(rows.reduce((a, r) => a + r.avgArea, 0) / rows.length),
    ms: sum('ms'),
  };
  s.badTotal = s.seamLog + s.deadEnd;
  s.badPer100Nodes = per100(s.badTotal, s.nodes);
  s.badPer100Visited = per100(s.badTotal, s.visited);
  s.lockedRate = s.doors ? s.locked / s.doors : 0;
  s.vestPer100Nodes = per100(s.vest, s.nodes);
  return s;
}

function markdown(s, rows) {
  const f = (x, d = 1) => (typeof x === 'number' ? x.toFixed(d) : String(x));
  const lines = [];
  lines.push(`| 指標 | 値 |`);
  lines.push(`|---|---|`);
  lines.push(`| seed 数 × 踏破部屋数 | ${s.seeds} × ${s.roomsPerSeed} |`);
  lines.push(`| 生成ノード / 部屋 / 踏破 | ${s.nodes} / ${s.rooms} / ${s.visited} |`);
  lines.push(`| WARN seam fallback（緊急 Seam） | ${s.seamLog} |`);
  lines.push(`| WARN dead-end lock（施錠行き止まり） | ${s.deadEnd} |`);
  lines.push(`| Seam + 施錠行き止まり 合計 | ${s.badTotal}（ノード 100 あたり ${f(s.badPer100Nodes, 2)} / 踏破 100 あたり ${f(s.badPer100Visited, 1)}） |`);
  lines.push(`| WARN forward not guaranteed（候補なし） | ${s.fwdWarn} |`);
  lines.push(`| 前室ノード数（ノード 100 あたり） | ${s.vest}（${f(s.vestPer100Nodes, 1)}） |`);
  lines.push(`| crawl Adapter | ${s.crawl} |`);
  lines.push(`| 施錠扉 / 扉（率） | ${s.locked} / ${s.doors}（${f(100 * s.lockedRate, 1)}%） |`);
  lines.push(`| 壁へ戻した扉（removedSockets） | ${s.removed} |`);
  lines.push(`| 意図的 Seam 扉 / Legendary 遠方配置 / 新設ソケット / 小部屋再抽選 | ${s.seamDoors} / ${s.legendaryFar} / ${s.newExit} / ${s.smallReroll} |`);
  lines.push(`| 部屋の重なり（組） | ${s.overlap} |`);
  lines.push(`| 決定論（同 seed 2 回一致） | ${s.deterministic ? 'OK' : 'NG'} |`);
  lines.push(`| toJSON→fromJSON 整合（ソケット不一致ノード / 箱・照明不一致ノード） | ${s.loadMismatch} / ${s.loadLayoutMismatch} |`);
  lines.push(`| 施錠され行き先の無い非扉開口（stairs / ramp / street / gate） | ${s.voidOpenings} |`);
  lines.push(`| 平均床面積（m²） | ${s.avgArea} |`);
  lines.push(`| 所要時間（ms、決定論の 2 回目を除く） | ${s.ms} |`);
  lines.push('');
  lines.push(`| seed | 踏破 | ノード | 部屋 | 前室 | seam | dead-end | 施錠/扉 | 重なり | 決定論 | load不一致 |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of rows) lines.push(`| ${r.seed} | ${r.visited} | ${r.nodes} | ${r.rooms} | ${r.vest} | ${r.seamLog} | ${r.deadEnd} | ${r.locked}/${r.doors} | ${r.overlap} | ${r.deterministic ? 'OK' : 'NG'} | ${r.loadMismatch} |`);
  return lines.join('\n');
}

// ------------------------------------------------------------ main
try {
  await bundle();
  const M = await import(pathToFileURL(bundlePath).href);
  const modIds = WITH_MODS ? M.registeredModifierIds() : [];
  const rows = SEEDS.map((s) => measure(M, s, N));
  const s = summarize(rows);
  s.modifiers = modIds.length;
  if (OUT_JSON) {
    console.log(JSON.stringify({ root: ROOT, summary: s, modifiers: modIds, rows }, null, 1));
  } else if (OUT_MD) {
    console.log(`Modifier 登録数: ${modIds.length}${WITH_MODS ? '' : '（--no-mods）'}\n`);
    console.log(markdown(s, rows));
  } else {
    console.log(`modifiers registered: ${modIds.length}${WITH_MODS ? '' : ' (--no-mods)'}`);
    console.table(rows.map(({ overlapPairs, area, ...r }) => r));
    console.log(`root: ${ROOT}`);
    console.log(
      `TOTAL nodes=${s.nodes} rooms=${s.rooms} visited=${s.visited} | seam=${s.seamLog} deadEnd=${s.deadEnd} (sum ${s.badTotal}: ${s.badPer100Nodes.toFixed(2)}/100 nodes, ${s.badPer100Visited.toFixed(1)}/100 visited) fwdWarn=${s.fwdWarn}` +
        ` | vest=${s.vest} crawl=${s.crawl} locked=${s.locked}/${s.doors} (${(100 * s.lockedRate).toFixed(1)}%) removed=${s.removed} | seamDoors=${s.seamDoors} legendaryFar=${s.legendaryFar} newExit=${s.newExit} smallReroll=${s.smallReroll}` +
        ` | overlap=${s.overlap} deterministic=${s.deterministic} loadMismatch=${s.loadMismatch}/${s.loadLayoutMismatch} voidOpenings=${s.voidOpenings} avgArea=${s.avgArea} ms=${s.ms}`,
    );
    const bad = rows.filter((r) => r.overlap > 0);
    if (bad.length) console.log('overlap pairs:', bad.map((r) => `seed ${r.seed}: ${r.overlapPairs}`).join(' | '));
  }
} finally {
  if (KEEP) console.error(`bundle kept at ${bundlePath}`);
  else rmSync(tmp, { recursive: true, force: true });
}
