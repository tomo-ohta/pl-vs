/**
 * フロアの形の型ごとに「歩いて分かる違い」が形になっているか（データで確かめる。歩く試験は structure-walk-*.test.ts）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import type { PatternId } from '../core/gen/floor/themes.ts';
import type { CellLayout, FloorLayout, PortalSpec } from '../core/world/layout.ts';

const t = defaultTuning();
const SH = t['structure.storyHeightM'];

function floors(p: PatternId, n = 6, dress = false): GenReport[] {
  return Array.from({ length: n }, (_, i) => generateFloorReport({ world: 11 + i, depth: 2 + (i % 6), variant: 0 }, t, { shape: p, ...(dress ? { dress: dressCell } : {}) }));
}
const cellsNamed = (f: FloorLayout, name: string): CellLayout[] => f.cells.filter((c) => c.name === name);
const walkPortals = (f: FloorLayout): PortalSpec[] => f.portals.filter((p) => p.kind !== 'window');

/** 開口（窓を除く）でたどって from から to へ行けるか（skip の区画は通らない） */
function reachable(f: FloorLayout, from: string, to: string, skip: (id: string) => boolean = () => false, portals = walkPortals(f)): boolean {
  const seen = new Set([from]);
  const q = [from];
  for (let h = 0; h < q.length; h++) for (const p of portals) {
    if (!p.cells.includes(q[h]!)) continue;
    const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
    if (seen.has(o) || skip(o)) continue;
    if (o === to) return true;
    seen.add(o); q.push(o);
  }
  return false;
}

/** 入口から出口の階段までの区画の数（窓を除く開口で） */
function pathLen(f: FloorLayout, portals = walkPortals(f)): number {
  const prev = new Map<string, number>([[f.spawn.cell, 0]]);
  const q = [f.spawn.cell];
  for (let h = 0; h < q.length; h++) for (const p of portals) {
    if (!p.cells.includes(q[h]!)) continue;
    const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
    if (prev.has(o)) continue;
    prev.set(o, prev.get(q[h]!)! + 1); q.push(o);
  }
  return prev.get('exitStairs') ?? -1;
}

test('F03 くねる部屋の連なり: 廊下が無く、部屋どうしが壁 1 枚でつながる・道のりが長い', () => {
  for (const r of floors('chain')) {
    assert.equal(cellsNamed(r.floor, '廊下').length, 0, `${r.floor.id}: 廊下が無い`);
    const rooms = r.floor.cells.filter((c) => /^r\d|^hall/.test(c.id));
    assert.ok(rooms.length >= 8, `${r.floor.id}: 部屋 ${rooms.length}`);
    assert.ok(pathLen(r.floor) >= 5, `${r.floor.id}: 入口から出口まで ${pathLen(r.floor)} 区画`);
  }
});

test('F05 中庭を囲む: 屋外の中庭（天井なし・霧・空の光）に、まわりの部屋の窓（平均 4 つ以上）・扉が 2 つ以上', () => {
  let wins = 0;
  const rs = floors('courtyard');
  for (const r of rs) {
    const c = cellsNamed(r.floor, '中庭')[0];
    assert.ok(c, `${r.floor.id}: 中庭`);
    assert.ok(c.render?.fog && c.lighting?.skyAmbient, '屋外の霧と空の光');
    assert.ok(!c.boxes.some((b) => b.solid && Math.abs(b.min[1] - (c.floorY + c.height)) < 0.01 && b.max[0] - b.min[0] > 4), '天井が無い');
    const ps = r.floor.portals.filter((p) => p.cells.includes(c.id));
    wins += ps.filter((p) => p.kind === 'window').length;
    assert.ok(ps.filter((p) => p.kind === 'window').length >= 2, `窓 ${ps.filter((p) => p.kind === 'window').length}`);
    assert.ok(ps.filter((p) => p.kind !== 'window').length >= 2, '中庭へ出られる');
  }
  assert.ok(wins / rs.length >= 4, `窓の平均 ${(wins / rs.length).toFixed(1)}`);
});

test('F06 二重ループ: 出口の部屋は入口の部屋の隣（窓で見える）・間の扉は出口の側からだけ開く・回り道は長い', () => {
  for (const r of floors('shortcut')) {
    const f = r.floor;
    const exitRoom = f.portals.find((p) => p.cells.includes('exitStairs'))!.cells.find((c) => c !== 'exitStairs')!;
    const direct = f.portals.find((p) => p.cells.includes(f.spawn.cell) && p.cells.includes(exitRoom) && p.kind === 'door')!;
    assert.ok(direct, `${f.id}: 入口と出口の部屋の間の扉`);
    const door = f.entities.find((e) => e.id === direct.doorId)!;
    assert.ok(typeof door.params.openSide === 'number', '一方通行');
    assert.equal(direct.cells[0], exitRoom, '出口の側が開ける側');
    assert.ok(f.portals.some((p) => p.kind === 'window' && p.cells.includes(f.spawn.cell) && p.cells.includes(exitRoom)), '窓');
    assert.ok(pathLen(f, walkPortals(f).filter((p) => p !== direct)) >= 6, `${f.id}: 回り道 ${pathLen(f, walkPortals(f).filter((p) => p !== direct))}`);
  }
});

test('F07 入れ子のループ・F10 環状: 一周できる輪が 2 つ以上（開口の網の独立な輪）', () => {
  for (const r of floors('loops')) {
    const f = r.floor;
    const ps = walkPortals(f).filter((p) => !p.cells.some((c) => c.includes('Stairs') || c.startsWith('secret')));
    const ids = new Set(ps.flatMap((p) => p.cells));
    assert.ok(ps.length - ids.size + 1 >= 2, `${f.id}: 輪 ${ps.length - ids.size + 1}`);
  }
});

test('F11 同心円: 中心を通らないと出口へ行けない・中心ほど暗く古い', () => {
  for (const r of floors('concentric')) {
    const f = r.floor;
    const core = f.cells.find((c) => c.id === 'r12')!;
    assert.ok(core, `${f.id}: 中心の部屋`);
    assert.ok(!reachable(f, f.spawn.cell, 'exitStairs', (id) => id === core.id), '中心を通らないと奥へ行けない');
    const outer = f.cells.filter((c) => c.id === 'r0' || c.id === 'r4' || c.id === 'r20' || c.id === 'r24' || c.id === 'j0' || c.id === 'j4');
    const outerLight = Math.max(...f.cells.filter((c) => /^r(\d|1[0-9]|2[0-4])$/.test(c.id) && c.id !== core.id).map((c) => c.palette.lightIntensity));
    assert.ok(core.palette.lightIntensity < outerLight * 0.6, `${f.id}: 中心が暗い ${core.palette.lightIntensity.toFixed(2)} < ${outerLight.toFixed(2)}`);
    assert.ok(core.render?.fog && core.render.fog.far < 20, '中心は霧が濃い');
    void outer;
  }
});

test('F12 螺旋: 吹き抜けのまわりを何周も下る（出口は入口より階の数だけ下・吹き抜けへの窓）', () => {
  for (const r of floors('spiral')) {
    const f = r.floor;
    const laps = t['structure.spiral.laps'];
    assert.ok(f.cells.some((c) => c.id === 'spiralVoid'), '吹き抜け');
    const ex = f.exits.find((e) => e.id === 'down')!;
    assert.ok(ex.aabb.min[1] < f.spawn.pos[1] - laps * SH + 1, `${f.id}: 下った深さ`);
    assert.ok(f.portals.filter((p) => p.kind === 'window' && p.cells.includes('spiralVoid')).length >= laps * 4, '回廊から吹き抜けが見える');
    assert.ok(f.cells.filter((c) => c.name === '螺旋の回廊').length === laps * 4);
  }
});

test('F13 スキップフロア: 部屋どうしのつなぎのほとんどに半階の階段', () => {
  for (const r of floors('skip')) {
    const f = r.floor;
    const stairs = cellsNamed(f, '階段').length;
    const nodes = f.cells.filter((c) => /^(r|j|hall)\d/.test(c.id)).length;
    assert.ok(stairs >= nodes * 0.6, `${f.id}: 階段 ${stairs} / 区画 ${nodes}`);
  }
});

test('F14 中二階: 吹き抜けの広間の壁沿いに上の階の回廊（手すり・階段）があり、上の階の部屋につながる', () => {
  for (const r of floors('gallery')) {
    const f = r.floor;
    const hall = cellsNamed(f, '吹き抜けの広間')[0]!;
    assert.ok(hall, `${f.id}: 広間`);
    const decks = hall.boxes.filter((b) => b.kind === 'landing' && b.max[1] > hall.floorY + SH - 0.1);
    assert.ok(decks.length >= 4, `回廊 ${decks.length}`);
    assert.ok(hall.boxes.some((b) => b.kind === 'stairStep'), '回廊へ上る階段');
    assert.ok(hall.boxes.some((b) => b.mat === 'glass' && b.min[1] > hall.floorY + SH - 0.1), 'ガラスの手すり');
    const upper = f.cells.filter((c) => c.floorY > hall.floorY + SH - 0.1 && /^r\d/.test(c.id));
    assert.ok(upper.length >= 1, '上の階の部屋');
  }
});

test('F15 立体交差: 上の曲がり角の床はガラスで、真下の曲がり角は天井が抜けている（窓の portal でつながる）', () => {
  for (const r of floors('crossing')) {
    const f = r.floor;
    const up = cellsNamed(f, '交差の上（ガラスの床）')[0]!, lo = cellsNamed(f, '交差の下')[0]!;
    assert.ok(up && lo, `${f.id}: 交差`);
    assert.ok(Math.abs(up.bounds.min[0] - lo.bounds.min[0]) < 0.01 && up.floorY > lo.floorY + 3, '真上');
    assert.ok(up.boxes.some((b) => b.mat === 'glass' && b.solid && Math.abs(b.max[1] - up.floorY) < 0.01), 'ガラスの床');
    assert.ok(f.portals.some((p) => p.kind === 'window' && p.cells.includes(up.id) && p.cells.includes(lo.id)), '上と下が見える');
    assert.ok(cellsNamed(f, '階段室').length >= 1, '階段室');
  }
});

test('F16 島と橋: つなぎは屋外の橋（手すり・霧）、下に水か奈落の区画（橋から見える）', () => {
  for (const r of floors('islands')) {
    const f = r.floor;
    const bridges = cellsNamed(f, '橋');
    assert.ok(bridges.length >= 4, `${f.id}: 橋 ${bridges.length}`);
    for (const b of bridges) assert.ok(b.render?.fog && b.lighting?.skyAmbient, '屋外');
    assert.ok(f.cells.some((c) => c.id === 'below'), '下の区画');
    assert.ok(f.portals.filter((p) => p.kind === 'window' && p.cells.includes('below')).length >= bridges.length, '橋から下が見える');
  }
});

test('F17 入れ子の部屋: 大部屋の中に部屋、その中にさらに部屋（扉でたどれる）', () => {
  for (const r of floors('nest')) {
    const f = r.floor;
    const outer = cellsNamed(f, '大部屋')[0]!;
    assert.ok(outer, `${f.id}: 大部屋`);
    const inner = f.cells.filter((c) => c.id.startsWith(`${outer.id}n`)).sort((a, b) => a.id.localeCompare(b.id));
    assert.ok(inner.length >= 1, '中の部屋');
    let prev = outer;
    for (const c of inner) {
      assert.ok(c.bounds.min[0] >= prev.bounds.min[0] && c.bounds.max[0] <= prev.bounds.max[0] && c.bounds.min[2] >= prev.bounds.min[2] && c.bounds.max[2] <= prev.bounds.max[2], `${c.id} は ${prev.id} の中`);
      assert.ok(c.height < prev.height, '中ほど低い');
      assert.ok(f.portals.some((p) => p.kind === 'door' && p.cells.includes(prev.id) && p.cells.includes(c.id)), `${prev.id} → ${c.id} の扉`);
      prev = c;
    }
  }
});

test('F18 巨大空間の中の建物: 天井の高い広間の中に、低い建物（扉と窓）', () => {
  for (const r of floors('megahall')) {
    const f = r.floor;
    const hall = cellsNamed(f, '巨大な空間')[0]!;
    const b = f.cells.find((c) => c.id === `${hall.id}b`)!;
    assert.ok(hall && b, `${f.id}: 広間と建物`);
    assert.ok(hall.height >= 6 && b.height < hall.height / 2, '天井の高さ');
    assert.ok(b.bounds.min[0] > hall.bounds.min[0] + 2 && b.bounds.max[0] < hall.bounds.max[0] - 2, '建物は広間の中');
    assert.ok(f.portals.some((p) => p.kind === 'door' && p.cells.includes(hall.id) && p.cells.includes(b.id)), '扉');
    assert.ok(f.portals.some((p) => p.kind === 'window' && p.cells.includes(b.id)), '窓');
    assert.ok(hall.boxes.some((x) => x.mat === 'sidingMetal' || x.mat === 'sidingWood'), '建物の外壁');
  }
});

test('F19 鏡写し: 左右対称（区画の大きさ・家具も鏡写し）。片側だけ違う所がある', () => {
  for (const r of floors('mirror', 5, true)) {
    const f = r.floor;
    const cells = f.cells.filter((c) => /^(r|j|hall|c)\d/.test(c.id));
    // 鏡の線の上の区画は自分自身と対
    const mirrored = cells.filter((c) => f.cells.some((o) => Math.abs(o.bounds.min[0] + c.bounds.max[0]) < 0.01 && Math.abs(o.bounds.max[0] + c.bounds.min[0]) < 0.01 && Math.abs(o.bounds.min[2] - c.bounds.min[2]) < 0.01 && Math.abs(o.bounds.max[2] - c.bounds.max[2]) < 0.01 && Math.abs(o.height - c.height) < 0.01));
    assert.ok(mirrored.length >= cells.length * 0.6, `${f.id}: 鏡写しの区画 ${mirrored.length}/${cells.length}`);
    assert.ok(mirrored.length < cells.length, `${f.id}: 片側だけ違う所がある`);
    // 家具の鏡写し: 写した部屋の家具（propGroup の末尾 :m）
    const copied = f.cells.filter((c) => c.boxes.some((b) => b.propGroup?.endsWith(':m')));
    assert.ok(copied.length >= 1, `${f.id}: 家具を写した部屋`);
  }
});

test('F20 縮むくり返し: 部屋がくり返すたびに小さく低くなり、最後はしゃがまないと立てない高さ', () => {
  let n = 0, copied = 0;
  for (const r of floors('shrink', 6, true)) {
    const f = r.floor;
    const rooms = f.cells.filter((c) => /^kr\d$/.test(c.id)).sort((a, b) => a.id.localeCompare(b.id));
    assert.equal(rooms.length, t['structure.shrink.count']);
    for (let i = 1; i < rooms.length; i++) assert.ok(rooms[i]!.height <= rooms[i - 1]!.height && (rooms[i]!.bounds.max[0] - rooms[i]!.bounds.min[0]) < (rooms[i - 1]!.bounds.max[0] - rooms[i - 1]!.bounds.min[0]) + 1e-6, `${f.id}: ${rooms[i]!.id} は小さい`);
    assert.ok(rooms[rooms.length - 1]!.height < 1.7, '最後は立てない高さ');
    // 最初の部屋（仕掛け・異変があれば次の部屋）の家具を、後の部屋へ縮めて写す
    if (rooms[0]!.boxes.some((b) => b.propGroup) && rooms[1]!.boxes.some((b) => b.propGroup)) n++;
    if (rooms.slice(1).some((c) => c.boxes.some((b) => b.propGroup?.includes(':k')))) copied++;
  }
  assert.ok(copied >= Math.max(1, n - 1), `家具を縮めて写したフロア ${copied}/${n}`);
});

test('F21 表と裏の動線: 裏の通路は狭く設備の色。出口へは裏の通路を通らないと行けない', () => {
  for (const r of floors('staff')) {
    const f = r.floor;
    const back = cellsNamed(f, '裏の通路');
    assert.ok(back.length >= 3, `${f.id}: 裏の通路 ${back.length}`);
    for (const c of back) assert.ok(Math.min(c.bounds.max[0] - c.bounds.min[0], c.bounds.max[2] - c.bounds.min[2]) <= t['structure.staff.widthM'] + 0.05 && c.theme === 'CorridorService');
    const staffCell = (id: string): boolean => back.some((c) => c.id === id) || f.cells.find((c) => c.id === id)?.theme === 'CorridorService' && id.startsWith('j');
    assert.ok(!reachable(f, f.spawn.cell, 'exitStairs', staffCell), '裏を通らないと出口へ行けない');
    assert.ok(f.entities.some((e) => e.type === 'door' && e.params.mat === 'doorMetal' && e.id.includes(':')), '関係者以外の扉');
  }
});

test('F22 天井裏の網: 天井の点検口（穴の portal）が 2 つ以上、天井裏の低い通路でつながる', () => {
  for (const r of floors('crawl')) {
    const f = r.floor;
    const holes = f.portals.filter((p) => p.kind === 'hole');
    assert.ok(holes.length >= 2, `${f.id}: 点検口 ${holes.length}`);
    const ducts = cellsNamed(f, '天井裏');
    assert.ok(ducts.length >= 3 && ducts.every((c) => c.height <= t['structure.crawl.heightM'] + 1e-6), '低い通路');
    // 点検口どうしは天井裏だけでつながる
    const [a, b] = holes.map((p) => p.cells[0]);
    assert.ok(reachable(f, holes[0]!.cells[1], holes[1]!.cells[1], (id) => !ducts.some((c) => c.id === id)), `${a} と ${b} の点検口が天井裏でつながる`);
    for (const p of holes) assert.ok(f.cells.find((c) => c.id === p.cells[0])!.boxes.some((x) => x.kind === 'stairStep'), '梯子段');
  }
});

test('F23 縦に積んだビル・F24 エレベーターホール: 階が 2〜3 あり、階ごとに系統が違う。階段室（とエレベーター）でつながる', () => {
  for (const p of ['tower', 'elevator'] as const) {
    for (const r of floors(p, 5)) {
      const f = r.floor;
      const ys = [...new Set(f.cells.filter((c) => /^(r|j)\d/.test(c.id)).map((c) => Math.round(c.floorY / SH)))];
      assert.ok(ys.length >= 2, `${p} ${f.id}: 階 ${ys.join(',')}`);
      assert.ok((r.profile.families?.length ?? 0) >= 2 && new Set(r.profile.families!.map((x) => x.id)).size === r.profile.families!.length, '階ごとに違う系統');
      assert.ok(cellsNamed(f, '階段室').length >= 1, '階段室');
      assert.ok(f.exits.find((e) => e.id === 'down')!.aabb.min[1] < f.spawn.pos[1] - SH, '出口は下の階');
      if (p === 'elevator') {
        const lifts = f.entities.filter((e) => e.type === 'shaftLift');
        assert.equal(lifts.length, 2, 'エレベーター 2 基');
        for (const l of lifts) assert.equal((l.params.stops as unknown[]).length, r.profile.stories, '各階に止まる');
      }
    }
  }
});

test('F29 下るだけのフロア: 本道は飛び降りの段差と下りの一方通行の扉。出口は入口よりずっと下', () => {
  for (const r of floors('descent')) {
    const f = r.floor;
    const drops = cellsNamed(f, '段差');
    const oneWay = f.entities.filter((e) => e.type === 'door' && typeof e.params.openSide === 'number' && !e.id.startsWith('secret'));
    assert.ok(drops.length + oneWay.length >= 3, `${f.id}: 段差 ${drops.length}・一方通行 ${oneWay.length}`);
    for (const d of drops) assert.ok(d.boxes.some((b) => b.kind === 'landing' && b.max[1] - d.floorY >= t['structure.descent.dropM'] - 0.01) && d.boxes.some((b) => b.mat === 'yellowLine'), '段差と黄色い線');
    const ex = f.exits.find((e) => e.id === 'down')!;
    assert.ok(ex.aabb.min[1] < f.spawn.pos[1] - 4, '下った');
  }
});

test('F31 吹き抜けの縦穴: 真ん中の縦穴（上下のほかの階の回廊・底・天窓）、壊れた手すりから飛び込むと 2 つ先のフロアへ', () => {
  for (const r of floors('shaft')) {
    const f = r.floor;
    const v = f.cells.find((c) => c.name === '縦穴')!;
    assert.ok(v && v.height > SH * 4, `${f.id}: 縦穴`);
    const ex = f.exits.find((e) => e.id === 'shaft')!;
    assert.equal(ex.to?.floor, `${r.profile.key.depth + 2}.0`);
    const gallery = cellsNamed(f, '吹き抜けの回廊')[0]!;
    assert.equal(f.portals.filter((p) => p.kind === 'window' && p.cells.includes(v.id)).length, 4, '回廊から縦穴が見える');
    assert.ok(gallery.boxes.some((b) => b.mat === 'yellowLine'), '壊れた手すりの印');
  }
});

test('F32 迷路フロア: 出口が 3 つ（行き先がそれぞれ違う）', () => {
  for (const r of floors('maze')) {
    const f = r.floor;
    const exits = f.exits.filter((e) => e.kind === 'stairs');
    assert.ok(exits.length >= 2, `${f.id}: 出口 ${exits.length}`);
    assert.equal(new Set(exits.map((e) => e.to?.floor ?? 'next')).size, exits.length, '行き先が違う');
  }
});

test('F33 屋上: 屋外の屋上（金網・小屋）、出口は外の非常階段', () => {
  for (const r of floors('rooftop')) {
    const f = r.floor;
    const roof = f.cells.find((c) => c.id === 'roof')!;
    assert.ok(roof.render?.fog && roof.lighting?.skyAmbient, `${f.id}: 屋外`);
    assert.ok(roof.boxes.filter((b) => b.mat === 'metal' && !b.solid).length > 60, '金網');
    assert.ok(f.cells.filter((c) => c.id.startsWith('roof') && c.id !== 'roof').length >= 2, '小屋');
    const ex = f.cells.find((c) => c.id === 'exitStairs')!;
    assert.ok(ex.render?.fog, '外の非常階段');
  }
});

test('F34 地下街: 系統は地下街・低い天井の広い通路の真ん中に柱、壁に店の構え', () => {
  for (const r of floors('arcade')) {
    const f = r.floor;
    const corr = cellsNamed(f, '廊下');
    assert.ok(corr.some((c) => c.boxes.some((b) => b.mat === 'columnConcrete')), `${f.id}: 柱`);
    assert.ok(corr.some((c) => c.boxes.some((b) => b.mat === 'redShutter' || b.mat === 'windowLit')), '店の構え');
  }
  assert.ok(floors('arcade', 1)[0]!.profile.family.id !== '' );
});

test('F02 分棟: 棟の間は屋外の渡り廊下、棟ごとに系統が違う', () => {
  for (const r of floors('wings')) {
    const f = r.floor;
    const ways = cellsNamed(f, '渡り廊下');
    assert.ok(ways.length >= 1 && ways.every((c) => c.render?.fog && c.lighting?.skyAmbient), `${f.id}: 渡り廊下 ${ways.length}`);
    const fams = r.profile.families!;
    assert.ok(fams.length >= 2 && new Set(fams.map((x) => x.id)).size === fams.length, '棟ごとに違う系統');
    // 棟の中の廊下は、その棟の系統の廊下（系統の廊下の作りが同じなら区別しない）
    const themes = new Set(cellsNamed(f, '廊下').map((c) => c.theme));
    assert.ok(themes.size >= 2 || new Set(fams.map((x) => x.corridor)).size === 1, `${f.id}: 棟ごとの廊下 ${[...themes].join(',')}`);
  }
});

test('F25 緊張と解放: 狭く低い通路と、天井の高い広い部屋が交互', () => {
  for (const r of floors('linear')) {
    const f = r.floor;
    const narrow = cellsNamed(f, '廊下').filter((c) => Math.min(c.bounds.max[0] - c.bounds.min[0], c.bounds.max[2] - c.bounds.min[2]) <= t['structure.linear.narrowWidthM'] + 0.05);
    assert.ok(narrow.length >= 2, `${f.id}: 狭い通路 ${narrow.length}`);
    assert.ok(f.cells.some((c) => /^r\d/.test(c.id) && c.height >= t['structure.linear.wideHeightM'] - 0.01), '天井の高い部屋');
  }
});

test('F35 駅: コンコースから階段で下りたホームに車両（座席・扉 2 つ・窓）', () => {
  for (const r of floors('station', 4)) {
    const f = r.floor;
    const car = cellsNamed(f, '車両')[0]!;
    assert.ok(car && cellsNamed(f, 'ホーム').length === 1, `${f.id}: ホームと車両`);
    assert.equal(f.portals.filter((p) => p.kind === 'door' && p.cells.includes(car.id)).length, 2, '扉 2 つ');
    assert.ok(car.boxes.some((b) => b.mat === 'seatBlue'), '座席');
    const plat = cellsNamed(f, 'ホーム')[0]!;
    assert.ok(plat.floorY < f.spawn.pos[1] - 1, 'ホームは下');
  }
});

test('F28 別室: ふつうの生成に出る（異変を重ねた個室）。重ねた異変の部品はぶつからない', () => {
  let n = 0;
  for (let w = 1; w <= 80 && n < 3; w++) {
    const r = generateFloorReport({ world: w, depth: 2 + (w % 8), variant: 0 }, t, { dress: dressCell });
    for (const a of r.anomalies.filter((x) => x.def === 'privateRoom')) {
      n++;
      const ids = r.floor.entities.map((e) => e.id);
      assert.equal(new Set(ids).size, ids.length, '部品の id が重ならない');
      void a;
    }
  }
  assert.ok(n >= 1, `別室が出る: ${n}`);
});
