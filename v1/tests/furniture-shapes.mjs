// 家具の専用形状（V05 第 2 段）: 元の箔を重ねない・外接枡に収まる・決定論・入力非破壊・三角形 400 以下 / 台
import assert from 'node:assert/strict';
import { chair, linkedSeats, bench, lockerBank, vending } from '../src/generators/furniture.ts';
import { detailedBoxes } from '../src/render/ArchitecturalDetails.ts';

const isBevel = (mat) => /^(door|furniture|shelf|boxCardboard|metal|column|carPaint|carGlass)/.test(mat);
const tris = (b) => (isBevel(b.mat) && Math.min(...[0, 1, 2].map((k) => b.max[k] - b.min[k])) > 0.08 ? 108 : 12);
const env = (bs) => ({ min: [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k]))), max: [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k]))) });
const inside = (b, e, tol) => [0, 1, 2].every((k) => b.min[k] >= e.min[k] - tol && b.max[k] <= e.max[k] + tol);
const overlapsXZ = (b, e) => b.min[0] < e.max[0] && b.max[0] > e.min[0] && b.min[2] < e.max[2] && b.max[2] > e.min[2];

const face = { dir: 0, horizontal: true, face: 6.0, inward: -1, a0: 0, a1: 8, coord: 6.15 };
const B = [];
// 外殻の代わりの床と、机（モニターの支え）
B.push({ min: [-6, -0.2, -0.2], max: [6, 0, 6.2], mat: 'floorLino', solid: true });
chair(B, 0, 1, 0); chair(B, 1, 1, 1); chair(B, 2, 1, 2); chair(B, 3, 1, 3);
linkedSeats(B, 0, 3, 4, 0); linkedSeats(B, 3, 3, 3, 1);
bench(B, true, -3, 2, 1.8); bench(B, false, -4.5, 3, 1.8);
lockerBank(B, face, 0.5, 6); lockerBank(B, face, 3.5, 1);
vending(B, face, 6.0);
// CorridorGenerator.bench 相当（座板 + 背板 + 脚板。同じ kind）
const cb = [
  { min: [-5.8, 0.42, 4.0], max: [-4.2, 0.48, 4.45], mat: 'seatBlue', solid: true },
  { min: [-5.8, 0.48, 3.96], max: [-4.2, 0.86, 4.04], mat: 'seatBlue', solid: true },
  { min: [-5.7, 0, 4.14], max: [-4.3, 0.42, 4.22], mat: 'metalDark', solid: true },
];
cb.forEach((b) => { b.propGroup = 'linkedSeats@corridor'; }); cb[0].kind = 'linkedSeats'; B.push(...cb);
// 1 箱の椅子（common.furnishCafeteriaProps 相当）と机、机上の LCD / CRT
B.push({ min: [-2, 0, 4.5], max: [0, 0.75, 5.5], mat: 'furnitureLight', solid: true, kind: 'desk' });
B.push({ min: [-1.3, 0, 3.85], max: [-0.7, 0.9, 4.45], mat: 'furnitureDark', solid: true, kind: 'chair' });
B.push({ min: [-1.26, 0.85, 4.72], max: [-0.74, 1.17, 4.745], mat: 'screenLcd', solid: false });
B.push({ min: [-1.21, 0.78, 4.85], max: [-0.79, 1.16, 5.233], mat: 'furnitureLight', solid: false }); // 画面（+z 向き）の背にある筐体
B.push({ min: [-1.17, 0.84, 5.233], max: [-0.83, 1.1, 5.24], mat: 'screenDark', solid: false });
// 1 箱の自販機
B.push({ min: [5.0, 0, 0.2], max: [5.9, 1.9, 1.2], mat: 'furnitureDark', solid: true, kind: 'vending' });

const layout = { boxes: B, bounds: { min: [-6, 0, 0], max: [6, 3, 6] }, footprint: [], height: 3, sockets: [], lights: [], labels: [], palette: {}, holes: [], elevators: [] };
const before = JSON.stringify(B);
const out = detailedBoxes(layout);
const again = detailedBoxes(layout);
assert.equal(JSON.stringify(B), before, 'detailedBoxes must not mutate the layout boxes');
assert.equal(JSON.stringify(out), JSON.stringify(again), 'deterministic');
const inputSet = new Set(B);
for (const b of out) { if (!inputSet.has(b)) assert(!b.solid, 'added display boxes are never colliders'); for (const v of [...b.min, ...b.max]) assert(Number.isFinite(v)); }

// グループごと: 元の箔が残らない、外接枡（+ 3 cm）に収まる、三角形 400 以下
const groups = new Map();
for (const b of B) if (b.propGroup) { (groups.get(b.propGroup) ?? groups.set(b.propGroup, []).get(b.propGroup)).push(b); }
const outSet = new Set(out);
const report = [];
for (const [id, members] of groups) {
  const kind = members.find((m) => m.kind)?.kind;
  if (!['chair', 'linkedSeats', 'bench', 'lockers'].includes(kind)) continue;
  for (const m of members) assert(!outSet.has(m), `${id}: original part still drawn`);
  const e = env(members);
  const mine = out.filter((b) => overlapsXZ(b, e) && b.max[1] <= e.max[1] + 0.03 && b.min[1] >= e.min[1] - 0.001);
  for (const b of mine) assert(inside(b, e, 0.03), `${id}: ${b.mat} exceeds the envelope by > 3 cm`);
  const t = mine.reduce((a, b) => a + tris(b), 0);
  // ロッカーは 1 列に n 台（扉 0.4 m 単位）。上限は 1 台 400 の目安を台数分
  const units = kind === 'lockers' ? Math.max(1, Math.round(Math.max(e.max[0] - e.min[0], e.max[2] - e.min[2]) / 0.4)) : 1;
  assert(t <= 400 * units, `${id}: ${t} triangles for ${units} unit(s)`);
  assert(mine.length >= 6, `${id}: too few parts (${mine.length})`);
  report.push(`${id} boxes ${mine.length} tris ${t}`);
}
// 自販機（タグのみ）は元の箔がそのまま
for (const m of groups.get([...groups.keys()].find((k) => k.startsWith('vending@')))) assert(outSet.has(m), 'vending parts are kept');
// 1 箱の椅子は置き換わり、机の CRT 筐体は段付きに置き換わる
const single = B.find((b) => b.kind === 'chair' && !b.propGroup);
assert(!outSet.has(single), 'single-box chair replaced');
const crtBody = B.find((b) => b.mat === 'furnitureLight' && !b.solid);
assert(!outSet.has(crtBody), 'CRT housing replaced by stepped housing');
assert(out.some((b) => b.mat === 'metalDark' && b.min[1] < 0.85 && b.max[1] > 0.84 && b.min[0] < -1.26 && b.min[2] > 4.7 && b.max[2] < 4.76), 'LCD bezel present');
assert(out.some((b) => b.mat === 'carGlass' && b.min[0] < 5.0 && b.min[0] > 4.98), 'vending glass on the room side');
console.log(report.join('\n'));
console.log('furniture shapes: no leftover parts, envelopes, determinism, immutable input, <=400 triangles per piece pass');
