import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../core/gen/gimmicks/index.ts';
import '../core/gen/anomaly/index.ts';
import '../core/sim/parts/index.ts';
import { anomalyDef } from '../core/gen/anomaly/types.ts';
import { CATALOG, CATALOG_BY_WS, OWNERS } from '../core/gen/catalog/index.ts';
import { gimmickDef } from '../core/gen/gimmicks/types.ts';
import { partDef } from '../core/sim/part.ts';

/** gimmicks-and-structures.md 2.1〜2.15 の表・一覧に出てくる案の番号（「M01〜M08」は展開する） */
function docIdeas(): string[] {
  const md = readFileSync(new URL('../docs/gimmicks-and-structures.md', import.meta.url), 'utf8');
  const body = md.slice(md.indexOf('### 2.1 '), md.indexOf('### 2.16 '));
  const out = new Set<string>();
  for (const m of body.matchAll(/^\| ([A-Z])(\d\d)(?:〜\1?(\d\d))? \|/gm)) {
    const a = Number(m[2]), b = m[3] ? Number(m[3]) : a;
    for (let i = a; i <= b; i++) out.add(`${m[1]}${String(i).padStart(2, '0')}`);
  }
  for (const m of body.matchAll(/^- (U\d\d) /gm)) out.add(m[1]!);
  return [...out];
}

test('案の番号はすべて、どこかの担当が受け持つ（受け持ちは重ならない）', () => {
  const owned = OWNERS.flatMap((o) => o.ideas);
  assert.equal(new Set(owned).size, owned.length, '受け持ちが重なっている');
  const ideas = docIdeas();
  assert.ok(ideas.length > 250, `案の数 ${ideas.length}`);
  assert.deepEqual(ideas.filter((i) => !owned.includes(i)), []);
});

test('台帳: 案は 1 回だけ・自分の受け持ちの案だけ・後回しには理由', () => {
  const seen = new Set<string>();
  for (const [ws, list] of Object.entries(CATALOG_BY_WS)) {
    const mine = new Set(OWNERS.find((o) => o.ws === ws)!.ideas);
    for (const e of list) {
      assert.ok(!seen.has(e.idea), `${e.idea} が 2 回載っている`);
      seen.add(e.idea);
      assert.ok(mine.has(e.idea), `${ws} の台帳に、受け持ちでない ${e.idea}`);
      if (e.status === 'deferred') assert.ok(e.note, `${e.idea}: 後回しの理由`);
      else assert.ok(e.impl.length > 0, `${e.idea}: 実装が書かれていない`);
    }
  }
});

test('台帳: 書き始めた担当は、受け持ちの案を全部載せている', () => {
  const missing: string[] = [];
  for (const o of OWNERS) {
    const list = CATALOG_BY_WS[o.ws] ?? [];
    if (list.length === 0) continue;
    const have = new Set(list.map((e) => e.idea));
    for (const i of o.ideas) if (!have.has(i)) missing.push(`${o.ws}:${i}`);
  }
  assert.deepEqual(missing, []);
});

test('台帳: 実装の id（仕掛け・異変・部品）が登録されている', () => {
  const bad: string[] = [];
  for (const e of CATALOG) {
    for (const m of e.impl) {
      const ok = m.kind === 'gimmick' ? !!gimmickDef(m.id) : m.kind === 'anomaly' ? !!anomalyDef(m.id) : m.kind === 'part' ? !!partDef(m.id) : true;
      if (!ok) bad.push(`${e.idea} ${m.kind}:${m.id}`);
    }
  }
  assert.deepEqual(bad, []);
});
