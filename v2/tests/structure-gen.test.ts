/**
 * フロアの形（段階 4・フロアの形の担当）: どの型も多数の seed で検証に通る・決定的・裏のフロアは同じ形・速い・描画の予算の中。
 * ふつうの生成で型がばらけ、珍しい型は珍しいフロアにだけ出る。駅の線。台帳の型の id。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { STRUCTURE_CATALOG } from '../core/gen/catalog/structure.ts';
import { generateFloorReport, validateFloor } from '../core/gen/floor/index.ts';
import { isStation, rarityRank, rollProfile } from '../core/gen/floor/profile.ts';
import { PATTERN_INFO, type PatternId } from '../core/gen/floor/themes.ts';

const t = defaultTuning();
const ALL = Object.keys(PATTERN_INFO) as PatternId[];
// 天井の高さ（外形の上の端）は見ない: 部屋の異変（中が広い部屋 vast など）は裏の seed で掛け直すので、裏だけ天井が高いことがある
const shape = (f: { cells: { id: string; role: string; bounds: { min: number[]; max: number[] } }[] }): string => f.cells.filter((c) => c.role !== 'secret').map((c) => `${c.id}:${c.bounds.min.join(',')}:${c.bounds.max[0]},${c.bounds.max[2]}`).join('|');

test('どの型も多数の seed で検証に通る・速い・描画の予算の中（区画・箱の数）', () => {
  const slow: string[] = [];
  for (const p of ALL) {
    let ms = 0, cells = 0, boxes = 0, maxBoxes = 0;
    const n = 10;
    for (let w = 1; w <= n; w++) {
      const r = generateFloorReport({ world: w, depth: 2 + (w % 7), variant: 0 }, t, { shape: p });
      assert.equal(r.profile.pattern, p);
      const issues = validateFloor(r.floor);
      assert.deepEqual(issues, [], `${p} w${w}: ${issues.join(' / ')}`);
      assert.ok(r.attempts < t['floor.genRetries'], `${p} w${w}: 作り直しが尽きた ${r.issues.slice(0, 3).join(' / ')}`);
      assert.ok(r.floor.exits.some((e) => e.id === 'down') && r.floor.exits[0]!.id === 'down', `${p} w${w}: 本来の出口が先頭`);
      ms += r.ms; cells += r.floor.cells.length;
      const b = r.floor.cells.reduce((a, c) => a + c.boxes.length, 0);
      boxes += b; maxBoxes = Math.max(maxBoxes, b);
    }
    // 1 人で回すと 40 ms 未満。全部の試験を並べて回すと CPU を取り合って数倍になるので、とても遅い型だけを見る
    if (ms / n > 100) slow.push(`${p} ${(ms / n).toFixed(1)} ms`);
    // 描画の予算: 中身（家具）を置く前で、1 フロアの箱は 4000 まで・区画は 120 まで
    assert.ok(maxBoxes < 4000 && cells / n < 120, `${p}: 箱 ${maxBoxes}・区画 ${(cells / n).toFixed(0)}`);
  }
  assert.deepEqual(slow, [], '1 フロアの生成が遅い型');
});

test('広間の開口は広間の床の高さ（広間の区画の段がそろう。中二階の回廊・隠しの穴は除く）', () => {
  const SH = t['structure.storyHeightM'];
  const bad: string[] = [];
  for (const p of [undefined, ...ALL]) {
    for (let w = 1; w <= 20; w++) {
      const f = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: 0 }, t, p ? { shape: p } : {}).floor;
      for (const c of f.cells) {
        if (!/^hall\d+$/.test(c.id)) continue;
        for (const q of f.portals) {
          if (!q.cells.includes(c.id) || q.kind === 'window' || q.kind === 'hole' || q.cells.some((x) => x.startsWith('secret'))) continue;
          const dy = q.aabb.min[1] - c.floorY;
          if (Math.abs(dy) > 0.3 && !(c.name === '吹き抜けの広間' && Math.abs(dy - SH) < 0.3)) bad.push(`${p ?? 'ふつう'} w${w} ${f.id} ${c.id} ${q.id} ${dy.toFixed(2)}`);
        }
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('どの型も決定的・先に別のフロアを作っても同じ・裏のフロアは表と同じ形', () => {
  for (const p of ALL) {
    const key = { world: 7, depth: 4, variant: 0 };
    const a = JSON.stringify(generateFloorReport(key, t, { shape: p }).floor);
    generateFloorReport({ world: 3, depth: 2, variant: 0 }, t, { shape: 'spiral' });
    assert.equal(JSON.stringify(generateFloorReport(key, t, { shape: p }).floor), a, `${p}: 決定的`);
    const front = generateFloorReport(key, t, { shape: p });
    const back = generateFloorReport({ ...key, variant: 1 }, t, { shape: p });
    assert.equal(shape(back.floor), shape(front.floor), `${p}: 裏のフロアは同じ形`);
  }
});

test('ふつうの生成で型がばらける・珍しい型は珍しいフロアと深い階だけ', () => {
  const seen = new Map<string, number>();
  for (let w = 1; w <= 60; w++) for (let d = 0; d <= 12; d++) {
    const p = rollProfile({ world: w, depth: d, variant: 0 }, t);
    seen.set(p.pattern, (seen.get(p.pattern) ?? 0) + 1);
    const info = PATTERN_INFO[p.pattern];
    if (p.pattern !== 'station') {
      assert.ok(d >= (info.minDepth ?? 0), `${p.pattern} が深さ ${d} に出た`);
      if (info.minRarity) assert.ok(rarityRank(p.rarity) >= rarityRank(info.minRarity), `${p.pattern} が ${p.rarity} に出た`);
    }
    if (d === 0) assert.ok(['grid', 'maze', 'comb', 'ring', 'hub', 'linear'].includes(p.pattern), `深さ 0 は段階 3 の型: ${p.pattern}`);
  }
  const missing = ALL.filter((p) => !seen.has(p));
  assert.deepEqual(missing, [], `出ない型: ${missing.join(',')}`);
  // 新しい型がフロアを占めない（段階 3 の型も半分近く残る）
  const classic = ['grid', 'maze', 'comb', 'ring', 'hub', 'linear'].reduce((a, p) => a + (seen.get(p) ?? 0), 0);
  const total = [...seen.values()].reduce((a, b) => a + b, 0);
  assert.ok(classic / total > 0.35 && classic / total < 0.8, `段階 3 の型の割合 ${(classic / total).toFixed(2)}`);
});

test('駅の線: 2〜3 フロア続く・駅のフロアには車両があり、乗ると次の深さへ（続く駅なら着く所がある）', () => {
  let lines = 0;
  for (let w = 1; w <= 40; w++) {
    for (let d = 1; d <= 20; d++) {
      if (!isStation(w, d, t)) continue;
      if (!isStation(w, d - 1, t)) {
        lines++;
        let len = 0;
        while (isStation(w, d + len, t)) len++;
        assert.ok(len >= 2 && len <= 3, `w${w} d${d}: 線の長さ ${len}`);
      }
    }
  }
  assert.ok(lines >= 10, `駅の線が出る: ${lines}`);
  const r = generateFloorReport({ world: 2, depth: 3, variant: 0 }, t, { shape: 'station' });
  const ride = r.floor.entities.find((e) => e.type === 'trainRide');
  assert.ok(ride, '車両の部品');
  const ex = r.floor.exits.find((e) => e.id === 'train');
  assert.ok(ex && ex.to?.floor === '4.0' && ex.to.exitId === 'train', '車両の出口は次の深さ');
  assert.ok((ride!.params.arrive as { pos: number[] }).pos.length === 3, '着く所');
  assert.equal(r.profile.family.id, 'transit');
});

test('台帳: 型の id はどれもフロアの形の型・受け持ちの案は全部 done / existing', () => {
  for (const e of STRUCTURE_CATALOG) {
    for (const m of e.impl) if (m.kind === 'structure') assert.ok(m.id in PATTERN_INFO, `${e.idea}: ${m.id}`);
    assert.ok(e.status === 'done' || e.status === 'existing', `${e.idea}: ${e.status}`);
    assert.ok(e.note && e.note.length > 10, `${e.idea}: note`);
  }
  // 型の案の番号（PATTERN_INFO.idea）が台帳の同じ案に載っている
  for (const p of ALL) assert.ok(STRUCTURE_CATALOG.some((e) => e.idea === PATTERN_INFO[p].idea && e.impl.some((m) => m.id === p)), `${p}: 台帳`);
});
