// 階段室（VerticalGenerator: C20 非常階段 / E02 年代階段 ほか）: 世界が刈り取った扉（removedSockets）は壁に戻る（第22回）。
// 以前は開口と枠だけが残り、扉の無い穴から模型の外の暗闇が見えた。刈り取りの有無で残りの出口の選び方は変わらない
import assert from 'node:assert/strict';
import { generateVertical } from '../src/generators/VerticalGenerator.ts';
import { readFileSync } from 'node:fs';
import { Rng } from '../src/core/rng.ts';

// data/index.ts は JSON の import 属性が要るので、テストでは JSON を直接読む
const rooms = JSON.parse(readFileSync(new URL('../data/rooms.json', import.meta.url), 'utf8'));
const templates = JSON.parse(readFileSync(new URL('../data/templates.json', import.meta.url), 'utf8'));
const ROOM_BY_ID = new Map((rooms.rooms ?? rooms).map((r) => [r.id, r]));
const TEMPLATE_BY_ID = new Map((templates.templates ?? templates).map((t) => [t.id, t]));
const palette = { floor: 'floorConcrete', wall: 'wallConcrete', ceiling: 'ceilingDark', light: 'lightPanel', lightColor: 0xffffff, ambient: 0x404040 };

const params = (id, seed, removed) => {
  const def = ROOM_BY_ID.get(id);
  const template = TEMPLATE_BY_ID.get(def.baseTemplate) ?? TEMPLATE_BY_ID.get('VerticalGenerator');
  return {
    def, template, rng: new Rng(seed), entry: { type: 'door', width: 1.0 }, exits: 3, variant: 0,
    palette: { ...palette }, allowHole: false, extraSockets: [], removedSockets: removed,
  };
};
/** 壁の箱に開口の範囲（幅・高さ）の隙間があるか = 壁の面の 1 点（開口の中心）を塞ぐ箱が無い */
const holeAt = (L, s) => {
  const p = [s.pos[0], s.pos[1] + 1.0, s.pos[2]];
  return !L.boxes.some((b) => b.solid && p[0] >= b.min[0] - 0.01 && p[0] <= b.max[0] + 0.01 && p[1] >= b.min[1] && p[1] <= b.max[1] && p[2] >= b.min[2] - 0.01 && p[2] <= b.max[2] + 0.01);
};

let checked = 0;
for (const id of ['C20', 'E02']) {
  if (!ROOM_BY_ID.has(id)) continue;
  for (let seed = 1; seed <= 30; seed++) {
    const full = generateVertical(params(id, seed, []));
    const exits = full.sockets.filter((s) => s.type === 'door' && s.id !== 'entry');
    for (const s of exits) assert.ok(holeAt(full, s), `${id} seed ${seed}: 扉 ${s.id} の開口が空いている`);
    const cut = exits[0];
    if (!cut) continue;
    const pruned = generateVertical(params(id, seed, [cut.id]));
    assert.ok(!pruned.sockets.some((s) => s.id === cut.id), `${id} seed ${seed}: 刈り取った ${cut.id} がソケットに残っていない`);
    assert.ok(!holeAt(pruned, cut), `${id} seed ${seed}: 刈り取った ${cut.id} の開口が壁で塞がる`);
    // 残りの出口は同じ（抽選の後で除くので）
    assert.deepEqual(pruned.sockets.map((s) => s.id).sort(), full.sockets.map((s) => s.id).filter((x) => x !== cut.id).sort(), `${id} seed ${seed}: 残りの出口が変わらない`);
    checked++;
  }
}
assert.ok(checked > 0, '検査した部屋がある');
console.log(`vertical-removed-sockets: ${checked} ケース OK`);
