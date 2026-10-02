/**
 * 地図の仕掛け: 霧の中の塔（fogTower・N05）と地図の空白（mapBlank・BX04）。
 * 部屋の形（霧・塔・仕切り・製図台）・入口から出口まで歩ける（閉じ込めない）・隠し（存在型 / 出現型）の奥まで行ける・決定的・
 * 地図の空白が隠し場所の足跡になる。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTuning } from '../core/config/tuning.ts';
import { dressCell } from '../core/gen/dress/index.ts';
import { generateFloorReport, type GenReport } from '../core/gen/floor/index.ts';
import { showcaseFloor } from '../core/gen/floor/showcase.ts';
import { reachOpenings } from '../core/gen/reach.ts';
import { loadRapier } from '../core/physics/rapier.ts';
import { PhysicsWorld } from '../core/physics/world.ts';
import '../core/sim/parts/index.ts';
import { Sim } from '../core/sim/sim.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { FloorLayout } from '../core/world/layout.ts';
import { buildMapInfo } from '../client/map/MapInfo.ts';
import { FloorMap } from '../client/map/MapModel.ts';
import { sceneOfMap } from '../client/map/scene.ts';
import { walkTo } from './helpers/bot.ts';
import { labRoom } from './helpers/gimmick-lab.ts';
import { findRooms, regenerate } from './helpers/gimmick-rooms.ts';

const t = defaultTuning();
const R = await loadRapier();
/** 物理の要る部品があれば物理を付けてシミュレーションを作る */
const simOf = (floor: FloorLayout): Sim => new Sim(floor, { tuning: t, physics: new PhysicsWorld(R, 1 / 60) });

test('霧の中の塔（実験室）: 入口と出口の向き全部で組める・霧・塔の灯り・仕切り・隠しの壁は開口の無い壁・開口どうしは歩いてつながる', () => {
  let n = 0;
  for (const [w, d] of [[8.6, 8.6], [8, 9], [19.6, 8.6]] as const) {
    for (const entry of [0, 1, 2, 3] as const) {
      for (const exit of [0, 1, 2, 3] as const) {
        if (exit === entry) continue;
        const room = labRoom('fogTower', { w, d, height: 3.4, entry, exit, seed: 7 + n, kind: 'hall' });
        assert.ok(room, `${w}×${d} 入口 ${entry} 出口 ${exit}`);
        n++;
        const c = room.cell;
        assert.ok(c.render?.fog && c.render.fog.far <= t['map.fogTower.fogFarM'] + 1e-9, '霧');
        const beacon = room.floor.entities.find((e) => e.type === 'landmark')!;
        const top = beacon.params.pos as number[];
        assert.ok(top[1]! > c.floorY + 2.7, '灯りは仕切りより高い');
        const walls = c.boxes.filter((b) => b.solid && b.max[1] - b.min[1] > 2 && b.min[1] <= c.floorY + 0.01 && b.max[1] < c.floorY + c.height - 0.2);
        assert.ok(walls.length >= 4, `仕切りと柱 ${walls.length}`);
        const reach = reachOpenings(c, room.slot.openings, 0.1);
        assert.ok(!reach || !reach.blocked.length, '開口どうしは歩いてつながる');
        const offer = room.offers.find((o) => o.hook === 'landmark.away')!;
        assert.ok(offer && !room.slot.openings.some((o) => o.dir === offer.doorway.dir && Math.abs((o.dir % 2 === 0 ? o.pos[0] : o.pos[2]) - offer.doorway.at) < 1.5), '隠しの壁は開口の脇ではない');
        assert.ok(room.keepOut.length >= 1, '家具は置かない');
      }
    }
  }
});

test('霧の中の塔: ふつうのフロアに出る（表のフロアだけ）・入口から出口の向こうまで歩ける・決定的', () => {
  const rooms = findRooms('fogTower', 5, { maxWorld: 260 });
  assert.ok(rooms.length >= 3, `霧の中の塔 ${rooms.length}`);
  for (const room of rooms) {
    assert.equal(room.key.variant, 0, '表のフロア');
    if (!room.beyond) continue;
    const sim = simOf(room.floor);
    sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
    const res = walkTo(sim, room.beyond);
    assert.ok(res.ok, `${room.floor.id} ${room.cell.id}: ${res.reason}`);
  }
  const again = regenerate(rooms[0]!);
  assert.equal(JSON.stringify(again.cells.find((c) => c.id === rooms[0]!.cell.id)!.boxes), JSON.stringify(rooms[0]!.cell.boxes));
});

/** 隠しの元 hook の隠しのあるフロアを集める */
function withSecret(hook: string, want: number, max = 400, tt: typeof t = t): { r: GenReport; sec: NonNullable<GenReport['gimmicks']>['secrets'][number] }[] {
  const out: { r: GenReport; sec: NonNullable<GenReport['gimmicks']>['secrets'][number] }[] = [];
  for (let w = 1; w <= max && out.length < want; w++) {
    const r = generateFloorReport({ world: w, depth: 1 + (w % 9), variant: 0 }, tt);
    for (const sec of r.gimmicks?.secrets ?? []) if (sec.hook === hook && out.length < want) out.push({ r, sec });
  }
  return out;
}

/** 隠しの入口の扉の前（host の内側 0.9 m）に立つ */
function frontOfSecret(floor: FloorLayout, host: string, cell: string): [number, number, number] {
  const door = floor.portals.find((p) => p.cells[0] === host && p.cells[1] === cell)!;
  const h = floor.cells.find((c) => c.id === host)!;
  const fx = (door.aabb.min[0] + door.aabb.max[0]) / 2, fz = (door.aabb.min[2] + door.aabb.max[2]) / 2;
  const cx = (h.bounds.min[0] + h.bounds.max[0]) / 2, cz = (h.bounds.min[2] + h.bounds.max[2]) / 2;
  return door.dir % 2 === 1 ? [fx + Math.sign(cx - fx) * 0.9, h.floorY + 0.02, fz] : [fx, h.floorY + 0.02, fz + Math.sign(cz - fz) * 0.9];
}

test('霧の中の塔の隠し: 出現型は塔から離れて霧の奥にいると現れ、奥まで歩ける / 存在型は最初から扉がある', () => {
  const found = withSecret('landmark.away', 4);
  assert.ok(found.length >= 2, `霧の中の塔の隠し ${found.length}`);
  for (const { r, sec } of found) {
    const sim = simOf(r.floor);
    const at = frontOfSecret(r.floor, sec.host, sec.cell);
    sim.teleport(0, at, 0);
    if (sec.mode === 'appear') {
      assert.ok(!sim.isRevealed(`${sec.id}.wall`));
      for (let i = 0; i < 60 * (t['map.fogTower.awaySec'] + 1); i++) sim.step([{ ...IDLE_COMMAND }]);
      assert.ok(sim.isRevealed(`${sec.id}.wall`), `${r.floor.id} ${sec.id}: 霧の奥にいると現れる`);
    }
    const res = walkTo(sim, sec.cell);
    assert.ok(res.ok, `${r.floor.id} ${sec.id}（${sec.mode}）: 隠しの奥へ ${res.reason}`);
  }
});

test('地図の空白（BX04）: 製図台の地図と自分の地図に、壁の向こうの隠し場所が白い空白で出る・入ると消える', () => {
  const found = withSecret('map.blank', 4);
  assert.ok(found.length >= 3, `地図の空白 ${found.length}`);
  for (const { r, sec } of found) {
    const info = buildMapInfo(r.floor, t);
    const blank = info.blanks.get(sec.host);
    assert.ok(blank, `${r.floor.id} ${sec.id}: 空白`);
    assert.deepEqual(blank!.cells.slice().sort(), sec.cells.slice().sort(), '空白は隠し場所の区画');
    const table = r.floor.entities.find((e) => e.type === 'mapBoard' && e.cell === sec.host && e.params.mode === 'survey');
    assert.ok(table && table.params.blank === true, '製図台の地図');
    // 自分の地図: 部屋に入ると空白が出る。隠し場所に入ると消える
    const map = new FloorMap(info, t);
    const host = r.floor.cells.find((c) => c.id === sec.host)!;
    const fp = host.footprint[0]!;
    const o = (pos: [number, number, number]) => ({ pos, yaw: 0, dt: 1 / 60, doorAngle: () => 0, revealed: () => false });
    map.update(o([(fp.x0 + fp.x1) / 2, host.floorY, (fp.z0 + fp.z1) / 2]));
    assert.equal(sceneOfMap(map).blanks.length, 1);
    const sc = r.floor.cells.find((c) => c.id === sec.cell)!;
    const sp = sc.footprint[0]!;
    map.update(o([(sp.x0 + sp.x1) / 2, sc.floorY, (sp.z0 + sp.z1) / 2]));
    assert.equal(sceneOfMap(map).blanks.length, 0);
  }
});

test('地図の空白: 出現型は空白の壁の前で立ち止まる・壁を調べると扉になり、奥まで歩ける / 存在型は最初から扉がある', () => {
  // 地図の空白を出やすく・出現型と存在型を半々に（段階 4 で仕掛けが増え、ふつうの調整では数が少ない）
  const found = [...withSecret('map.blank', 3, 400, { ...t, 'gimmick.w.mapBlank': 20, 'secrets.mode.present': 0, 'secrets.mode.appear': 100 } as typeof t),
    ...withSecret('map.blank', 3, 400, { ...t, 'gimmick.w.mapBlank': 20, 'secrets.mode.present': 100, 'secrets.mode.appear': 0 } as typeof t)];
  let appear = 0, present = 0;
  for (const { r, sec } of found) {
    const at = frontOfSecret(r.floor, sec.host, sec.cell);
    if (sec.mode === 'appear') {
      appear++;
      // 立ち止まる
      const sim = simOf(r.floor);
      sim.teleport(0, at, 0);
      assert.ok(!sim.isRevealed(`${sec.id}.wall`));
      for (let i = 0; i < 60 * (t['map.blank.dwellSec'] + 0.8); i++) sim.step([{ ...IDLE_COMMAND }]);
      assert.ok(sim.isRevealed(`${sec.id}.wall`), `${r.floor.id} ${sec.id}: 立ち止まると壁が扉になる`);
      const res = walkTo(sim, sec.cell);
      assert.ok(res.ok, `${sec.id}: 奥へ ${res.reason}`);
      // 調べる（壁を見て E）
      const sim2 = simOf(r.floor);
      const wall = r.floor.entities.find((e) => e.type === 'mapWall' && e.cell === sec.host)!;
      const b = wall.params.box as { min: number[]; max: number[] };
      const wc = [(b.min[0]! + b.max[0]!) / 2, (b.min[1]! + b.max[1]!) / 2, (b.min[2]! + b.max[2]!) / 2];
      sim2.teleport(0, at, 0);
      sim2.step([{ ...IDLE_COMMAND }]);
      const p = sim2.players[0]!;
      const yaw = Math.atan2(-(wc[0]! - p.pos[0]), -(wc[2]! - p.pos[2]));
      const pitch = Math.atan2(wc[1]! - (p.pos[1] + p.eye), Math.hypot(wc[0]! - p.pos[0], wc[2]! - p.pos[2]));
      sim2.step([{ ...IDLE_COMMAND, moveY: 0.01, yaw, pitch, interact: { yaw, pitch } }]);
      for (let i = 0; i < 3; i++) sim2.step([{ ...IDLE_COMMAND, yaw, pitch }]);
      assert.ok(sim2.isRevealed(`${sec.id}.wall`), `${sec.id}: 壁を調べると扉になる`);
    } else {
      present++;
      assert.ok(r.floor.entities.some((e) => e.id === `${sec.id}.door` && e.params.mat === r.floor.cells.find((c) => c.id === sec.host)!.palette.wall), '壁と同じ色の扉');
      const sim = simOf(r.floor);
      sim.teleport(0, at, 0);
      assert.ok(walkTo(sim, sec.cell).ok);
    }
  }
  assert.ok(appear >= 1 && present >= 1, `出現型 ${appear}・存在型 ${present}`);
});

test('地図の空白: 製図台があっても入口から出口の向こうまで歩ける・決定的', () => {
  const rooms = findRooms('mapBlank', 4, { maxWorld: 500 });
  assert.ok(rooms.length >= 3, `地図の空白の部屋 ${rooms.length}`);
  for (const room of rooms) {
    assert.ok(room.cell.boxes.some((b) => b.propGroup?.endsWith('mapBlank-table')), '製図台の地図');
    assert.ok(room.cell.boxes.filter((b) => b.propGroup?.includes('mapBlank-sheet')).length >= 4, '壁の図面');
    const sim = simOf(room.floor);
    sim.teleport(0, [room.inside[0], room.inside[1] + 0.02, room.inside[2]], room.yaw);
    const res = walkTo(sim, room.beyond ?? room.cell.id);
    assert.ok(res.ok, `${room.floor.id} ${room.cell.id}: ${res.reason}`);
  }
  const again = regenerate(rooms[0]!);
  assert.equal(JSON.stringify(again.entities.filter((e) => e.cell === rooms[0]!.cell.id)), JSON.stringify(rooms[0]!.floor.entities.filter((e) => e.cell === rooms[0]!.cell.id)));
});

test('見本のフロア（?try=fogTower,mapBlank）: 2 つとも置ける（地図の空白には隠しが付く）', () => {
  const r = showcaseFloor(t, { ids: ['fogTower', 'mapBlank'], dress: dressCell });
  const defs = new Set(r.gimmicks!.gimmicks.map((g) => g.def));
  assert.ok(defs.has('fogTower') && defs.has('mapBlank'), [...defs].join(','));
  const host = r.gimmicks!.gimmicks.find((g) => g.def === 'mapBlank')!.cell;
  assert.ok(r.gimmicks!.secrets.some((s) => s.host === host && s.hook === 'map.blank'));
});
