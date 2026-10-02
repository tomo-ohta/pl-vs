// フロアの形の型ごとの生成の検査（開発用。node tools/structure-stats.ts [型,型] [数]）:
// 型を決めて多数の seed で作り、作り直しの数・検証の問題・区画と箱の数・時間を出す
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, validateFloor } from '../core/gen/floor/index.ts';
import { PATTERN_INFO, type PatternId } from '../core/gen/floor/themes.ts';

const t = defaultTuning();
const only = process.argv[2] ? process.argv[2].split(',') as PatternId[] : (Object.keys(PATTERN_INFO) as PatternId[]);
const n = Number(process.argv[3] ?? 12);
const dress = process.argv.includes('--dress');
for (const shape of only) {
  let fails = 0, retries = 0, ms = 0, cells = 0, boxes = 0, errs = 0;
  const msgs = new Map<string, number>();
  for (let w = 1; w <= n; w++) {
    try {
      const r = generateFloorReport({ world: w, depth: 3 + (w % 5), variant: 0 }, t, { shape, ...(dress ? { dress: dressCell } : {}) });
      ms += r.ms; retries += r.attempts - 1;
      cells += r.floor.cells.length; boxes += r.floor.cells.reduce((a, c) => a + c.boxes.length, 0);
      const issues = validateFloor(r.floor);
      if (issues.length || r.attempts >= t['floor.genRetries']) { fails++; for (const s of [...issues, ...r.issues]) { const k = s.replace(/[0-9.]+/g, '#').slice(0, 90); msgs.set(k, (msgs.get(k) ?? 0) + 1); } }
      else for (const s of r.issues) { const k = s.replace(/[0-9.]+/g, '#').slice(0, 90); msgs.set(k, (msgs.get(k) ?? 0) + 1); }
    } catch (e) { errs++; const k = String((e as Error).message).slice(0, 120); msgs.set(k, (msgs.get(k) ?? 0) + 1); }
  }
  console.log(`${shape.padEnd(11)} 失敗 ${fails} 例外 ${errs} 作り直し ${retries} 区画 ${(cells / n).toFixed(0)} 箱 ${(boxes / n).toFixed(0)} ${(ms / n).toFixed(1)} ms`);
  for (const [k, v] of [...msgs].sort((a, b) => b[1] - a[1]).slice(0, 4)) console.log(`    ${v}× ${k}`);
}
