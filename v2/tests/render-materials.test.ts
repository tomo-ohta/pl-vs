// 生成した箱の材質が、どれも描画の材質の表（SURFACES）にある（無いとブラウザでフロアを作る所で止まる。段階 4 の統合で見つかった）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { CATALOG_BY_WS } from '../core/gen/catalog/index.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport } from '../core/gen/floor/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { SURFACES } from '../client/render/MaterialLibrary.ts';

test('箱の材質はどれも描画の材質の表にある（ふつうのフロア・担当ごとの見本）', () => {
  const t = defaultTuning();
  const bad = new Map<string, string>();
  const scan = (tag: string, f: FloorLayout): void => {
    for (const c of f.cells) for (const b of c.boxes) if (!(SURFACES as Record<string, unknown>)[b.mat] && !bad.has(String(b.mat))) bad.set(String(b.mat), `${tag} ${c.id} ${c.name ?? ''}`);
  };
  for (const [ws, list] of Object.entries(CATALOG_BY_WS)) {
    const ids = [...new Set(list.flatMap((e) => e.impl.filter((m) => m.kind === 'gimmick' || m.kind === 'anomaly' || m.kind === 'room').map((m) => m.id)))];
    for (let i = 0; i < ids.length; i += 8) scan(ws, showcaseFloor(t, { ids: ids.slice(i, i + 8), dress: dressCell }).floor);
  }
  for (let w = 1; w <= 60; w++) scan(`w${w}`, generateFloorReport({ world: w, depth: 1 + (w % 12), variant: w % 4 === 0 ? 1 : 0 }, t, { dress: dressCell }).floor);
  assert.deepEqual([...bad], []);
});
