// core/ の境界を確かめる: three.js・client・vite・DOM 専用の物を import していないこと（v2-plan.md / 継承計画 2 章）
// DOM の型（window / document）は tsconfig.core.json の lib で型エラーになるので、ここでは import だけを見る
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const core = join(root, 'core');
const FORBIDDEN = [/^three(\/|$)/, /^vite(\/|$)/, /(^|\/)client(\/|$)/];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });

const bad = [];
for (const file of walk(core)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1] ?? m[2];
    const target = spec.startsWith('.') ? relative(root, resolve(file, '..', spec)) : spec;
    if (FORBIDDEN.some((re) => re.test(target)) || (spec.startsWith('.') && !resolve(file, '..', spec).startsWith(core))) bad.push(`${relative(root, file)}: ${spec}`);
  }
}
if (bad.length) { console.error('core/ から使ってはいけない import:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`core/ の境界: OK（${walk(core).length} ファイル）`);
