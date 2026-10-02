import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { anomalyDefs } from '../core/gen/anomaly/index.ts';
import { doorFronts, hitsAny, LIGHT_OFF, STAND_H } from '../core/gen/anomaly/util.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { STAGE3_ANOMALIES } from '../core/gen/floor/showcase.ts';
import { generateFloorReport, validateFloor, type GenReport } from '../core/gen/floor/index.ts';
import '../core/gen/gimmicks/index.ts';
import { gimmickDefs } from '../core/gen/gimmicks/types.ts';
import { reachOpenings } from '../core/gen/reach.ts';
import type { Dir } from '../core/math/vec.ts';
import { WALL_T, type Box, type CellLayout, type FloorLayout, type WallOpening } from '../core/world/layout.ts';

const t = defaultTuning();
const ALL = anomalyDefs().map((d) => d.id);

/** 区画の開口を portal から作り直す（フロアの検証と同じ到達判定をするため） */
function openingsOf(floor: FloorLayout, id: string): WallOpening[] {
  const out: WallOpening[] = [];
  for (const p of floor.portals) {
    const k = p.cells.indexOf(id);
    if (k < 0) continue;
    const dir = (k === 0 ? p.dir : (p.dir + 2) % 4) as Dir;
    const a = p.aabb;
    const alongX = dir === 0 || dir === 2;
    const pos: [number, number, number] = alongX ? [(a.min[0] + a.max[0]) / 2, a.min[1], (a.min[2] + a.max[2]) / 2] : [(a.min[0] + a.max[0]) / 2, a.min[1], (a.min[2] + a.max[2]) / 2];
    out.push({ id: p.id, pos, dir, width: alongX ? a.max[0] - a.min[0] : a.max[2] - a.min[2], height: a.max[1] - a.min[1] });
  }
  return out;
}

/** 立ったまま通れるかの形（底の低い宙の当たる箱は床まで） */
function standing(cell: CellLayout): Box[] {
  const fy = cell.floorY;
  return cell.boxes.map((b) => (b.solid && b.min[1] > fy + 0.05 && b.min[1] < fy + STAND_H && b.max[1] > fy + 0.05 ? { ...b, min: [b.min[0], fy, b.min[2]] } : b));
}

const gen = (w: number, d: number, v = 0, dress = true): GenReport => generateFloorReport({ world: w, depth: d, variant: v }, t, dress ? { dress: dressCell } : {});

test('異変: 同じ key なら同じフロア・同じ異変（家具あり・裏のフロアも）', () => {
  for (let w = 1; w <= 6; w++) {
    const a = gen(w, 1 + w, w % 3 === 0 ? 1 : 0), b = gen(w, 1 + w, w % 3 === 0 ? 1 : 0);
    assert.deepEqual(a.anomalies, b.anomalies);
    assert.equal(JSON.stringify(a.floor), JSON.stringify(b.floor));
  }
  // 先に別のフロアを作っても同じ
  const alone = JSON.stringify(gen(42, 4).floor);
  for (let d = 0; d < 5; d++) gen(42, d);
  assert.equal(JSON.stringify(gen(42, 4).floor), alone);
});

test('異変: 200 フロアが検証に通る・異変の部屋は立ったまま開口どうしを歩ける・開口の前に当たる物が無い', () => {
  const fails: string[] = [];
  let rooms = 0;
  for (let w = 1; w <= 200; w++) {
    const r = gen(w, 1 + (w % 9), w % 7 === 0 ? 1 : 0, w % 4 !== 0);
    const issues = validateFloor(r.floor);
    if (issues.length) fails.push(`${r.floor.id}@${w}: ${issues.join(' / ')}`);
    for (const a of r.anomalies) {
      rooms++;
      const cell = r.floor.cells.find((c) => c.id === a.cell)!;
      const ops = openingsOf(r.floor, cell.id);
      assert.ok(cell.role !== 'entry' && cell.role !== 'exit' && cell.role !== 'secret', `${a.id}: 入口・出口・隠しの部屋には掛けない`);
      assert.ok(!r.gimmicks?.gimmicks.some((g) => g.cell === cell.id), `${a.id}: 仕掛けの部屋には掛けない`);
      if (ops.length >= 2) {
        const loose = reachOpenings(cell, ops, 0.1);
        const strict = reachOpenings({ footprint: cell.footprint, floorY: cell.floorY, boxes: standing(cell) }, ops, 0.1);
        if (loose?.blocked.length) fails.push(`w${w} ${a.id}: 届かない開口 ${loose.blocked.join(',')}`);
        if (strict?.blocked.length) fails.push(`w${w} ${a.id}: 立ったまま届かない開口 ${strict.blocked.join(',')}`);
      }
      const zones = doorFronts(cell, ops, 0.95, 0.25);
      const hit = cell.boxes.find((b) => b.solid && b.min[1] > cell.floorY + 0.01 && b.max[1] < cell.floorY + cell.height - 0.01 && hitsAny(zones, b) && !(b.max[0] - b.min[0] <= WALL_T + 1e-3 || b.max[2] - b.min[2] <= WALL_T + 1e-3));
      if (hit) fails.push(`w${w} ${a.id}: 開口の前に当たる物 ${hit.mat} ${hit.min.map((v) => v.toFixed(2))}`);
    }
  }
  console.log(`  異変の部屋 ${rooms}`);
  assert.deepEqual(fails, []);
});

test('異変: 種類がばらける・扉の向こうの部屋の約 3 割・同じ異変が本道で続かない・物理の上限', () => {
  const by = new Map<string, number>();
  const gdefs = new Map(gimmickDefs().map((d) => [d.id, d]));
  let doorRooms = 0, doorAnom = 0, gimRooms = 0;
  // 300 フロア。異変が 50 種を超えたので、どれも 3 回出るまで続ける（600 フロアまで）
  for (let w = 1; w <= 300 || (w <= 600 && ALL.some((id) => (by.get(id) ?? 0) < 3)); w++) {
    const r = gen(w, 1 + (w % 9));
    for (const a of r.anomalies) by.set(a.def, (by.get(a.def) ?? 0) + 1);
    const an = new Map(r.anomalies.map((a) => [a.cell, a.def]));
    const gim = new Set(r.gimmicks?.gimmicks.map((g) => g.cell));
    for (const c of r.floor.cells) {
      if (!(c.name === '部屋' || c.name === '広間') || ['entry', 'exit', 'secret'].includes(c.role)) continue;
      if (!r.floor.portals.some((p) => p.cells.includes(c.id) && p.kind === 'door' && !p.id.includes('.'))) continue;
      doorRooms++;
      if (an.has(c.id)) doorAnom++;
      if (gim.has(c.id)) gimRooms++;
    }
    // 本道の並び（入口 → 出口）で、部屋だけを見て同じ異変が続かない
    const nb = new Map<string, string[]>();
    for (const p of r.floor.portals) { nb.set(p.cells[0], [...(nb.get(p.cells[0]) ?? []), p.cells[1]]); nb.set(p.cells[1], [...(nb.get(p.cells[1]) ?? []), p.cells[0]]); }
    const prev = new Map<string, string | null>([[r.floor.spawn.cell, null]]);
    const q = [r.floor.spawn.cell];
    for (let h = 0; h < q.length && !prev.has('exitStairs'); h++) for (const m of nb.get(q[h]!) ?? []) if (!prev.has(m)) { prev.set(m, q[h]!); q.push(m); }
    const main: string[] = [];
    for (let c: string | null | undefined = 'exitStairs'; c; c = prev.get(c)) main.unshift(c);
    const seq = main.filter((id) => { const c = r.floor.cells.find((x) => x.id === id)!; return (c.name === '部屋' || c.name === '広間') && c.role !== 'entry' && c.role !== 'exit'; });
    for (let i = 1; i < seq.length; i++) {
      const x = an.get(seq[i - 1]!), y = an.get(seq[i]!);
      assert.ok(!x || x !== y, `w${w}: 本道で ${x} が続く（${seq[i - 1]} → ${seq[i]}）`);
    }
    const physics = (r.gimmicks?.gimmicks.filter((g) => gdefs.get(g.def)?.physics).length ?? 0) + r.anomalies.filter((a) => anomalyDefs().find((d) => d.id === a.def)?.physics).length;
    assert.ok(physics <= t['gimmick.physicsMax'], `w${w}: 物理 ${physics}`);
  }
  const share = doorAnom / doorRooms;
  console.log(`  扉の向こうの部屋 ${doorRooms}: 異変 ${(share * 100).toFixed(1)}%・仕掛け ${(100 * gimRooms / doorRooms).toFixed(1)}%`);
  console.log(`  ${ALL.map((id) => `${id} ${by.get(id) ?? 0}`).join('・')}`);
  for (const id of ALL) assert.ok((by.get(id) ?? 0) >= 3, `${id} が出る: ${by.get(id) ?? 0}`);
  assert.ok(share > 0.24 && share < 0.37, `扉の向こうの部屋の異変の割合 ${share.toFixed(3)}`);
  // 1 つの異変が出すぎない（平均の 3 倍未満。種類が 40 を超えたので、いちばん少ない物との比は数の揺れが大きく使わない）
  const counts = ALL.map((id) => by.get(id) ?? 0);
  const mean = counts.reduce((x, y) => x + y, 0) / counts.length;
  assert.ok(Math.max(...counts) < 3 * mean, `偏りすぎない: 平均 ${mean.toFixed(1)}・${counts.join(',')}`);
});

test('異変: それぞれ見て分かる形になっている（浸水の水・暗闇の灯り・逆さまの床 …）', () => {
  // 段階 3 の異変 14 種の目印（段階 4 の担当の異変は、担当の試験 oddity-gen・sense-anomaly・map-anomaly で確かめる）
  const seen = new Set<string>();
  for (let w = 1; w <= 200 || (w <= 500 && STAGE3_ANOMALIES.some((id) => !seen.has(id))); w++) {
    const r = gen(w, 1 + (w % 9));
    for (const a of r.anomalies) {
      const c = r.floor.cells.find((x) => x.id === a.cell)!;
      const fy = c.floorY;
      const groups = new Set(c.boxes.filter((b) => b.propGroup).map((b) => b.propGroup));
      const msg = `w${w} ${a.id}`;
      switch (a.def) {
        case 'flood': {
          const z = c.zones.find((x) => x.kind === 'water');
          assert.ok(z && c.boxes.some((b) => b.mat === 'waterShallow' && !b.solid), msg);
          const d = Number(z!.params?.depth);
          assert.ok(d >= t['anomaly.flood.depthMin'] - 1e-9 && d <= t['anomaly.flood.depthMax'] + 1e-9, `${msg}: 水深 ${d}`);
          break;
        }
        case 'lowGravity': {
          const z = c.zones.find((x) => x.kind === 'gravity');
          const s = Number(z?.params?.scale);
          assert.ok(s >= t['anomaly.lowGravity.scaleMin'] - 1e-9 && s <= t['anomaly.lowGravity.scaleMax'] + 1e-9, `${msg}: 重さ ${s}`);
          break;
        }
        case 'dark':
          assert.equal(c.lights.length, 1, msg);
          assert.equal(c.boxes.filter((b) => LIGHT_OFF[b.mat] && !b.kind?.startsWith('lamp:')).length, 1, `${msg}: 光る物は遠くの灯りだけ`);
          break;
        case 'fog':
          assert.ok(c.render?.fog && c.render.fog.far <= t['anomaly.fog.far'] + 1e-9, msg);
          break;
        case 'tint':
          assert.ok(c.boxes.some((b) => b.mat === 'neonRed') || c.render?.style === 'untextured', msg);
          break;
        case 'ballSea': {
          const e = r.floor.entities.find((x) => x.id.startsWith(`${a.id}.`) && x.type === 'propPile');
          const items = e?.params.items as unknown[];
          assert.ok(items && items.length >= 8 && items.length <= t['anomaly.ballSea.max'], msg);
          break;
        }
        case 'multiply': {
          const chairs = [...groups].filter((g) => g?.includes('/chair@'));
          assert.ok(chairs.length >= 6 && chairs.length === groups.size, `${msg}: 同じ椅子だけ ${chairs.length}/${groups.size}`);
          break;
        }
        case 'giant': {
          // 残した家具は数個だけで、どれかは人の背より高い
          const solid = new Set(c.boxes.filter((b) => b.solid && b.propGroup).map((b) => b.propGroup));
          assert.ok(solid.size >= 1 && solid.size <= t['anomaly.giant.max'], `${msg}: 家具 ${solid.size}`);
          // 2 つ以上残り、どれかは胸より高いか、2.4 m より長い
          const big = [...solid].some((g) => { const bs = c.boxes.filter((b) => b.propGroup === g); const h = Math.max(...bs.map((b) => b.max[1])) - fy; const l = Math.max(Math.max(...bs.map((b) => b.max[0])) - Math.min(...bs.map((b) => b.min[0])), Math.max(...bs.map((b) => b.max[2])) - Math.min(...bs.map((b) => b.min[2]))); return h > 1.2 || l > 2.4; });
          assert.ok(solid.size >= 2 && big, `${msg}: 大きな家具`);
          break;
        }
        case 'tiny':
          // 0.8 m: 背の高い棚（1.56 m）を縮めると 0.78 m（担当 sense が 0.75 から上げた。異変が増えてフロアの部屋が変わり、その棚の部屋に当たった）
          assert.ok(c.boxes.filter((b) => b.solid && b.propGroup).every((b) => b.max[1] - fy < 0.8), `${msg}: 家具は膝より低い`);
          break;
        case 'upsideDown':
          assert.ok(c.boxes.some((b) => b.solid && b.propGroup && (b.min[1] + b.max[1]) / 2 > fy + c.height / 2), `${msg}: 天井の側に付いた家具`);
          assert.ok(c.boxes.some((b) => b.mat === c.palette.light && !b.solid && b.max[1] < fy + 0.1), `${msg}: 床の照明`);
          break;
        case 'stack':
          // 積まれた家具: 何かの上に載った家具（当たる箱のいちばん下が床から 0.5 m より上の組）。段階 4 で仕掛けが増えて生成が変わり、
          // 低い家具の 2 段の塔（0.73 m の上に棚）が出るようになったので、「0.9 m より上に当たる箱」から改めた
          assert.ok([...groups].some((g) => { const sb = c.boxes.filter((b) => b.solid && b.propGroup === g); return sb.length > 0 && Math.min(...sb.map((b) => b.min[1])) > fy + 0.5; }), `${msg}: 積まれた家具`);
          break;
        case 'scatter':
          assert.ok(c.boxes.some((b) => b.kind === 'scatteredPaper'), msg);
          break;
        case 'doors':
          assert.ok(c.boxes.filter((b) => b.kind === 'decorDoor').length >= 4, msg);
          break;
        case 'clocks':
          assert.ok([...groups].filter((g) => g?.includes('a-clock@')).length >= 10, msg);
          break;
      }
      seen.add(a.def);
    }
  }
  assert.deepEqual(STAGE3_ANOMALIES.filter((id) => !seen.has(id)), []);
});

test('異変: 見本のフロアは頼んだ異変を 1 つずつ置き、見て回る順に入る', () => {
  // 段階 4 で異変の種類が増えたので、1 つのフロアに入る数ずつに分けて頼む（仕掛けなしは 14 種ずつ・仕掛けを全種置いたら 7 種ずつ）
  const chunk = (n: number): string[][] => Array.from({ length: Math.ceil(ALL.length / n) }, (_v, i) => ALL.slice(i * n, (i + 1) * n));
  // 仕掛けを置かない見本（部屋が足りる）
  for (const part of chunk(14)) {
    let r: GenReport | null = null;
    for (let w = 1; w <= 6 && (!r || new Set(r.anomalies.map((a) => a.def)).size < part.length); w++) {
      const s = generateFloorReport({ world: w, depth: 0, variant: 0 }, t, { showcase: { gimmicks: [], anomalies: part }, dress: dressCell });
      if (!r || new Set(s.anomalies.map((a) => a.def)).size > new Set(r.anomalies.map((a) => a.def)).size) r = s;
    }
    assert.deepEqual(new Set(r!.anomalies.map((a) => a.def)), new Set(part));
    assert.equal(r!.anomalies.length, part.length);
    const stops = r!.gimmicks!.tour.filter((s) => s.label.startsWith('異変: '));
    assert.equal(stops.length, r!.anomalies.length);
    for (const a of r!.anomalies) assert.ok(stops.some((s) => s.cell === a.cell && s.label === `異変: ${a.name}`), a.id);
  }
  // 仕掛けを全種置いた見本: 分けて頼めば全部入る
  const gim = gimmickDefs().map((d) => d.id);
  for (const half of chunk(7)) {
    let best = 0;
    for (let w = 1; w <= 6 && best < half.length; w++) {
      const s = generateFloorReport({ world: w, depth: 0, variant: 0 }, t, { showcase: { gimmicks: gim, anomalies: half }, dress: dressCell });
      best = Math.max(best, new Set(s.anomalies.map((a) => a.def)).size);
    }
    assert.equal(best, half.length, half.join(','));
  }
});

test('異変: 家具を置かないとき（中身なし）は、家具の要る異変を掛けない・掛け替える', () => {
  const need = new Set(anomalyDefs().filter((d) => d.needsFurniture).map((d) => d.id));
  let n = 0;
  for (let w = 1; w <= 40; w++) {
    const r = gen(w, 1 + (w % 9), 0, false);
    for (const a of r.anomalies) { n++; assert.ok(!need.has(a.def), `${a.id}`); }
    assert.equal(r.gimmicks!.tour.filter((s) => s.label.startsWith('異変: ')).length, r.anomalies.length);
  }
  assert.ok(n > 10);
});
