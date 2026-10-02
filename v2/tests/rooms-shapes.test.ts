import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTuning, type Tuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import { roomShapeDefs } from '../core/gen/rooms/index.ts';
import type { Box, CellLayout, FloorLayout } from '../core/world/layout.ts';

/**
 * 部屋の形が、それぞれ見て分かる形になっているか（扉を開けた瞬間の「こういう部屋か」）: 形ごとに 1 つだけ出やすくした調整で
 * 部屋を 3 つずつ集め、形ごとの目印（柱・低い天井・穴・水・段・窓 …）を確かめる。傾けた箱は当たり判定にしない（描画だけ）
 */

function only(id: string): Tuning {
  const o: Record<string, number> = { 'rooms.chance.room': 1, 'rooms.chance.hall': 1, 'rooms.openMul': 1 };
  for (const d of roomShapeDefs()) o[`rooms.w.${d.id}`] = d.id === id ? 10 : 0;
  return makeTuning(o).tuning;
}

function rooms(id: string, want: number): { r: GenReport; c: CellLayout }[] {
  const tt = only(id);
  const out: { r: GenReport; c: CellLayout }[] = [];
  for (let w = 1; w <= 200 && out.length < want; w++) {
    const r = generateFloorReport({ world: w * 11 + 2, depth: 1 + (w % 9), variant: 0 }, tt, { dress: dressCell });
    for (const c of r.floor.cells) if (c.shape === id && out.length < want) out.push({ r, c });
  }
  return out;
}

const fyOf = (c: CellLayout): number => c.floorY;
const boxesOf = (c: CellLayout, f: (b: Box) => boolean): Box[] => c.boxes.filter(f);
const entitiesIn = (fl: FloorLayout, c: CellLayout, type: string): number => fl.entities.filter((e) => e.cell === c.id && e.type === type).length;
const locked = (fl: FloorLayout, c: CellLayout): number => fl.entities.filter((e) => e.cell === c.id && e.type === 'door' && e.params.locked === true).length;

/** 形ごとの目印（だめなら理由） */
const CHECKS: Record<string, (c: CellLayout, fl: FloorLayout) => string | null> = {
  pillars: (c) => boxesOf(c, (b) => b.solid && b.min[1] <= fyOf(c) + 0.01 && b.max[1] >= fyOf(c) + c.height - 0.01 && b.max[0] - b.min[0] < 1.3 && b.max[2] - b.min[2] < 1.3 && b.max[0] - b.min[0] > 0.3).length >= 3 ? null : '床から天井までの柱が 3 本以上',
  grandHall: (c) => (c.height >= 4 && c.lights.some((l) => l.color === 0xffd9a0) ? null : '高い天井とシャンデリア'),
  tallHall: (c) => (c.height >= 7 ? null : `天井 ${c.height}`),
  ceilingWells: (c) => (c.bounds.max[1] > fyOf(c) + c.height + 3 && c.lights.length <= 9 ? null : '天井の上の井戸'),
  lowRoom: (c) => (boxesOf(c, (b) => b.kind === 'lowCeiling' && b.solid && Math.abs(b.min[1] - fyOf(c) - 1.6) < 0.01).length > 0 ? null : '1.6 m の低い天井'),
  highCeiling: (c) => (c.height >= 12 && c.lights.length === 1 ? null : `天井 ${c.height}・灯り ${c.lights.length}`),
  waveCeiling: (c) => (boxesOf(c, (b) => !!b.slope && !b.solid && b.mat === c.palette.ceiling).length >= 2 && boxesOf(c, (b) => b.kind === 'colliderOnly').length >= 3 ? null : '傾いた天井の板'),
  splitHall: (c) => (boxesOf(c, (b) => {
    if (!b.solid || b.mat !== c.palette.wall || b.min[1] > fyOf(c) + 0.01) return false;
    // 仕切り: 薄い向きの座標が部屋の壁から 1 m 以上内側
    const r = c.footprint[0]!;
    const tx = b.max[0] - b.min[0] < 0.2, tz = b.max[2] - b.min[2] < 0.2;
    return (tx && b.min[0] > r.x0 + 1 && b.max[0] < r.x1 - 1) || (tz && b.min[2] > r.z0 + 1 && b.max[2] < r.z1 - 1);
  }).length >= 1 ? null : '部屋の中の仕切り壁'),
  bentRoom: (c) => (c.footprint.length >= 2 || c.boxes.some((b) => b.kind === 'core') ? null : '欠けた足跡か真ん中の塊'),
  doubleWall: (c) => (c.lights.some((l) => l.intensity < 0.3) ? null : '壁と壁の間の暗い灯り'),
  halfBasement: (c) => (boxesOf(c, (b) => b.mat === 'outsideView').length >= 2 && boxesOf(c, (b) => b.mat === 'outsideView').every((b) => b.min[1] > fyOf(c) + 1.9) ? null : '天井際の外の景色の窓'),
  slantWalls: (c) => (boxesOf(c, (b) => !!b.slope && !b.solid && b.mat === c.palette.wall).length >= 1 ? null : '傾いた壁の板'),
  windows: (c) => (boxesOf(c, (b) => b.mat === 'windowLit' || b.mat === 'windowDark').length >= 5 ? null : '窓 5 枚以上'),
  hut: (c) => (boxesOf(c, (b) => ['glass', 'sidingMetal', 'sidingWood', 'neonRed'].includes(b.mat)).length >= 1 ? null : '小屋'),
  // 細い矩形（幅 1.6 m 以下）をまとめた長さで見る（ほかの開口への枝が帯を区切るので、矩形 1 つの長さでは短く見える）
  eelBed: (c) => {
    const thin = c.footprint.filter((r) => Math.min(r.x1 - r.x0, r.z1 - r.z0) <= 1.6);
    if (!thin.length) return '細長い帯';
    const len = Math.max(Math.max(...thin.map((r) => r.x1)) - Math.min(...thin.map((r) => r.x0)), Math.max(...thin.map((r) => r.z1)) - Math.min(...thin.map((r) => r.z0)));
    return len >= 9 ? null : `細長い帯 ${len.toFixed(1)}`;
  },
  endless: (c) => (c.render?.fog && c.render.fog.far < 14 ? null : '霧'),
  roundRoom: (c, fl) => (locked(fl, c) >= 4 ? null : `開かない扉 ${locked(fl, c)}`),
  centerHole: (c) => (c.bounds.min[1] <= fyOf(c) - 2.0 ? null : '深い穴'),
  pitGallery: (c) => (c.bounds.min[1] <= fyOf(c) - 2.0 && boxesOf(c, (b) => b.kind === 'colliderOnly' && b.mat === 'metalDark').length >= 3 ? null : '吹き抜けと手すり'),
  // 格子の棒は材質を見ない（色の異変 tint が材質を塗り替える）
  grating: (c) => (boxesOf(c, (b) => !b.solid && Math.abs(b.max[1] - fyOf(c)) < 0.01 && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) < 0.1).length >= 15 && c.bounds.min[1] < fyOf(c) - 1.0 ? null : '格子の床と下の空間'),
  sunkenWater: (c) => (boxesOf(c, (b) => b.mat === 'water').length >= 1 && c.zones.some((z) => z.kind === 'water') ? null : '水'),
  terraces: (c) => (new Set(boxesOf(c, (b) => b.kind === 'terrace').map((b) => b.max[1].toFixed(2))).size >= 3 ? null : '段 3 つ以上'),
  theater: (c, fl) => (boxesOf(c, (b) => b.kind === 'landing').length >= 1 && (fl.cells.some((x) => x.id === `${c.id}x`) || locked(fl, c) >= 1) ? null : '舞台と楽屋の扉'),
  loft: (c) => (boxesOf(c, (b) => b.kind === 'landing' && b.max[1] - fyOf(c) >= 1.4 && b.max[1] - fyOf(c) <= 2.0).length >= 1 ? null : 'ロフトの台'),
  scaffold: (c) => (boxesOf(c, (b) => b.kind === 'landing' && Math.abs(b.max[1] - fyOf(c) - 2.15) < 0.02).length >= 1 && boxesOf(c, (b) => b.kind === 'roomStep').length >= 10 ? null : '足場と段'),
  layers: (c, fl) => (new Set(boxesOf(c, (b) => b.kind === 'landing').map((b) => b.max[1].toFixed(1))).size >= 1 && locked(fl, c) >= 1 ? null : '上の層と開かない扉'),
  stairsOnly: (c, fl) => (boxesOf(c, (b) => b.kind === 'roomStep').length >= 10 && locked(fl, c) >= 1 ? null : '階段の塔と上の扉'),
  atticStair: (c) => (boxesOf(c, (b) => b.kind === 'roomStep' && b.max[1] - b.min[1] < 0.1).length >= 5 && boxesOf(c, (b) => b.kind === 'landing' && b.min[1] >= fyOf(c) + c.height).length >= 1 ? null : '薄い踏み板の階段と屋根裏の床'),
  tilted: (c, fl) => (entitiesIn(fl, c, 'roomSurface') === 1 && boxesOf(c, (b) => !!b.slope).length >= 5 ? null : '斜めの面'),
};

test('部屋の形: どの形にも目印の確かめがある（形を足したら、ここにも足す）', () => {
  for (const d of roomShapeDefs()) assert.ok(CHECKS[d.id], `${d.id} の目印`);
});

test('部屋の形: それぞれ見て分かる形になっている・傾けた箱は当たらない', () => {
  const fails: string[] = [];
  for (const d of roomShapeDefs()) {
    const list = rooms(d.id, 3);
    if (!list.length) { fails.push(`${d.id}: 見つからない`); continue; }
    for (const { r, c } of list) {
      const why = CHECKS[d.id]!(c, r.floor);
      if (why) fails.push(`${d.id} ${r.floor.id} ${c.id}: ${why}`);
      const bad = c.boxes.find((b) => b.slope && b.solid);
      if (bad) fails.push(`${d.id} ${c.id}: 当たる傾いた箱 ${bad.mat}`);
    }
  }
  assert.deepEqual(fails, []);
});
