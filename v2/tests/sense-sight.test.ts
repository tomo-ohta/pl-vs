/**
 * 見る・見ないの仕掛け（watchClock・zoomSign・mannequinGaze・lookBack・photoBooth・cctvRoom・mirrorDoor・glowCurtains・blindCurtains）:
 * 規則どおりに働く（見ていない間だけ進む・見つめると読める・振り返ると現れる・写真を撮ってから行くと開く …）・裏の振る舞いの出力が入る・
 * 歩く人が抜けられる・決定的
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Dir } from '../core/math/vec.ts';
import { IDLE_COMMAND } from '../core/sim/types.ts';
import type { Sim } from '../core/sim/sim.ts';
import type { LabRoom } from './helpers/gimmick-lab.ts';
import { walkTo } from './helpers/bot.ts';
import { entitiesOf, labRoomDoors, labSim, labSimDoors, stand, yawTo } from './sense-util.ts';

const DIRS: Dir[] = [0, 1, 2, 3];
const size = (dir: Dir, w: number, d: number): { w: number; d: number } => (dir % 2 === 0 ? { w, d } : { w: d, d: w });
const opp = (d: Dir): Dir => ((d + 2) % 4) as Dir;
const out = (sim: Sim, ref: string): number => { const i = ref.lastIndexOf('.'); return sim.outputOf(ref.slice(0, i), ref.slice(i + 1)); };
/** 点 p を見る向き（yaw, pitch） */
function lookAt(sim: Sim, p: readonly number[]): { yaw: number; pitch: number } {
  const pl = sim.players[0]!;
  const dx = p[0]! - pl.pos[0], dy = p[1]! - (pl.pos[1] + pl.eye), dz = p[2]! - pl.pos[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
const center = (room: LabRoom): [number, number, number] => [(room.cell.bounds.min[0] + room.cell.bounds.max[0]) / 2, room.cell.floorY + 0.02, (room.cell.bounds.min[2] + room.cell.bounds.max[2]) / 2];

test('見ていない間だけ進む時計: 見ている間は止まり、見ないと進む・12 時の前後に見ると扉の鍵が開く・歩く人が抜けられる・見ないまま長くいると隠しの出力', async () => {
  for (const dir of DIRS) {
    const r = (await labSimDoors('watchClock', { ...size(dir, 6, 8), entry: dir, exit: opp(dir), seed: 3 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const clock = entitiesOf(room.floor, 'watchClock')[0]!;
    const door = room.floor.entities.find((e) => e.id === clock.params.door)!;
    assert.ok(door.inputs?.lock, '出口の扉に鍵');
    const pos = clock.params.pos as number[];
    const hand = (): number => (sim.stateOf(clock.id) as { hand: number }).hand;
    sim.teleport(0, center(room), 0);
    // 見ている間は止まる
    const look = lookAt(sim, pos);
    stand(sim, 0.2, look);
    const h0 = hand();
    stand(sim, 2, look);
    assert.ok(Math.abs(hand() - h0) < 1e-6, `向き ${dir}: 見ている間は止まる`);
    // 見ないと進む
    stand(sim, 2, { yaw: look.yaw + Math.PI, pitch: -1.3 });
    assert.ok(hand() !== h0, `向き ${dir}: 見ないと進む`);
    // 鍵が掛かっている: 扉を調べても開かない
    const pn = door.params.panel as { min: number[]; max: number[] };
    const dc = [(pn.min[0]! + pn.max[0]!) / 2, 1.0, (pn.min[2]! + pn.max[2]!) / 2];
    sim.teleport(0, [room.exitInside![0]!, 0.02, room.exitInside![2]!], 0);
    const ld = lookAt(sim, dc);
    stand(sim, 0.1, ld);
    sim.step([{ ...IDLE_COMMAND, ...ld, interact: ld }]);
    stand(sim, 1, ld);
    if (out(sim, String(clock.params.unlock) + '.out') < 0.5) assert.equal(sim.outputOf(door.id, 'open'), 0, `向き ${dir}: 鍵が掛かっている`);
    // 歩く人: 目をそらして待ち、12 時に見つめて鍵を開け、扉の前まで
    const c2 = (await labSimDoors('watchClock', { ...size(dir, 6, 8), entry: dir, exit: opp(dir), seed: 3 + dir }))!;
    let opened = false;
    const st = c2.sim.step.bind(c2.sim);
    (c2.sim as unknown as { step: typeof c2.sim.step }).step = (cmd) => { st(cmd); if (out(c2.sim, String(clock.params.unlock) + '.out') > 0.5) opened = true; };
    const res = walkTo(c2.sim, c2.room.cell.id, [c2.room.exitInside![0]!, 0, c2.room.exitInside![2]!], 90);
    assert.ok(res.ok && opened, `向き ${dir}: 歩く人が鍵を開けて扉の前へ（${res.reason}）`);
  }
  // BO03: 一度も見ないまま長くいる
  const r = (await labSimDoors('watchClock', { w: 6, d: 8, entry: 0, exit: 2, seed: 4 }))!;
  const offer = r.room.offers.find((o) => o.hook === 'clock.unseen')!;
  r.sim.teleport(0, center(r.room), 0);
  const pos = entitiesOf(r.room.floor, 'watchClock')[0]!.params.pos as number[];
  const away = lookAt(r.sim, pos);
  stand(r.sim, 30, { yaw: away.yaw + Math.PI, pitch: -1.3 });
  assert.equal(out(r.sim, offer.revealOutput!), 0, 'まだ');
  stand(r.sim, 20, { yaw: away.yaw + Math.PI, pitch: -1.3 });
  assert.equal(out(r.sim, offer.revealOutput!), 1, '見ないまま長くいると時計の跡が扉に');
});

test('ズームで注視: 立ち止まって札を見つめると読める（動きながらでは読めない）・札の数字の番号の壁が隠しの扉', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('zoomSign', { ...size(dir, 7, 11), entry: dir, exit: null, seed: 5 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const gaze = entitiesOf(room.floor, 'gazeSensor')[0]!;
    const target = gaze.params.target as number[];
    const offer = room.offers.find((o) => o.hook === 'zoom.sign')!;
    assert.ok(offer.required && offer.modes.includes('present') && offer.modes.includes('appear'));
    // 歩きながら見ても読めない
    const b = room.cell.bounds;
    for (let i = 0; i < 120; i++) {
      const l = lookAt(sim, target);
      sim.step([{ ...IDLE_COMMAND, ...l, moveX: i % 60 < 30 ? 1 : -1 }]);
    }
    assert.equal(sim.outputOf(gaze.id, 'done'), 0, `向き ${dir}: 歩きながらでは読めない`);
    stand(sim, 0.3);
    const l = lookAt(sim, target);
    stand(sim, 2.2, l);
    assert.equal(sim.outputOf(gaze.id, 'done'), 1, `向き ${dir}: 立ち止まって見つめると読める`);
    void b;
  }
});

test('マネキンの視線の先: マネキンが 3 体以上（当たり判定あり）・全員が同じ一点を向く・その一点を見つめると隠しの出力', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('mannequinGaze', { ...size(dir, 7, 8), entry: dir, exit: opp(dir), seed: 7 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const fx = entitiesOf(room.floor, 'senseFx').find((e) => e.params.fx === 'mannequins')!;
    const figs = fx.params.figures as number[][];
    const P = fx.params.target as number[];
    assert.ok(figs.length >= 3);
    for (const f of figs) assert.ok(Math.abs(Math.atan2(P[0]! - f[0]!, P[2]! - f[2]!) - f[3]!) < 1e-6, '一点を向く');
    assert.ok(room.cell.boxes.filter((b) => b.kind === 'colliderOnly' && b.solid).length >= figs.length, '当たり判定');
    const offer = room.offers.find((o) => o.hook === 'mannequin.gaze')!;
    // 一点の正面 1.5 m（マネキンに遮られない所）から見つめる
    const d = offer.doorway;
    const inward = d.dir === 0 || d.dir === 1 ? -1 : 1;
    const front: [number, number, number] = d.dir % 2 === 0 ? [P[0]!, room.cell.floorY + 0.02, P[2]! + inward * 1.5] : [P[0]! + inward * 1.5, room.cell.floorY + 0.02, P[2]!];
    sim.teleport(0, front, 0);
    stand(sim, 2, lookAt(sim, P));
    assert.equal(out(sim, offer.revealOutput!), 1, `向き ${dir}: 視線の先を見つめると現れる`);
    // 歩く人は抜けられる（マネキンを避ける）
    const c2 = (await labSim('mannequinGaze', { ...size(dir, 7, 8), entry: dir, exit: opp(dir), seed: 7 + dir }))!;
    const res = walkTo(c2.sim, c2.room.cell.id, [c2.room.exitInside![0]!, 0, c2.room.exitInside![2]!], 60);
    assert.ok(res.ok, `向き ${dir}: 抜けられる（${res.reason}）`);
  }
});

test('出口の前で振り返る: 出口の前で来た道を見ると隠しの出力が入る（来る途中・前を見ているだけでは入らない）', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('lookBack', { ...size(dir, 2.4, 12), entry: dir, exit: opp(dir), seed: 9 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const offer = room.offers.find((o) => o.hook === 'look.back')!;
    assert.ok(offer.required);
    const res = walkTo(sim, room.cell.id, [room.exitInside![0]!, 0, room.exitInside![2]!], 30);
    assert.ok(res.ok);
    stand(sim, 1.5, { yaw: yawTo(room.inside, room.exitInside!) });
    assert.equal(out(sim, offer.revealOutput!), 0, `向き ${dir}: 前を見ているだけでは入らない`);
    stand(sim, 1.5, { yaw: yawTo(room.exitInside!, room.inside), pitch: -0.05 });
    assert.equal(out(sim, offer.revealOutput!), 1, `向き ${dir}: 振り返ると入る`);
  }
});

test('写真に写るもの: 三脚のカメラを調べると撮れる・撮ってから写った所へ行くと隠しの出力（撮らずに行っても入らない）', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('photoBooth', { ...size(dir, 7, 8), entry: dir, exit: opp(dir), entryAt: 0.4, seed: 11 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const cam = entitiesOf(room.floor, 'photoCam')[0]!;
    const offer = room.offers.find((o) => o.hook === 'photo.door')!;
    const zone = entitiesOf(room.floor, 'zoneSensor').find((e) => e.id.endsWith('.there'))!;
    const a = zone.params.aabb as { min: number[]; max: number[] };
    const zc: [number, number, number] = [(a.min[0]! + a.max[0]!) / 2, room.cell.floorY + 0.02, (a.min[2]! + a.max[2]!) / 2];
    sim.teleport(0, zc, 0);
    stand(sim, 1.5);
    assert.equal(out(sim, offer.revealOutput!), 0, '撮らずに行っても入らない');
    // カメラの前で調べる
    const eye = cam.params.eye as number[];
    sim.teleport(0, [room.inside[0], room.cell.floorY + 0.02, room.inside[2]], 0);
    stand(sim, 0.2);
    const l = lookAt(sim, eye);
    sim.step([{ ...IDLE_COMMAND, ...l, interact: l }]);
    assert.equal(sim.outputOf(cam.id, 'taken'), 1, `向き ${dir}: 撮れる`);
    sim.teleport(0, zc, 0);
    stand(sim, 1.5);
    assert.equal(out(sim, offer.revealOutput!), 1, `向き ${dir}: 撮ってから行くと入る`);
  }
});

test('監視カメラの映像: モニターを見つめると隠しの出力（見ていなければ入らない）', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('cctvRoom', { ...size(dir, 7, 8), entry: dir, exit: opp(dir), entryAt: 0.5, seed: 13 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const fx = entitiesOf(room.floor, 'senseFx').find((e) => e.params.fx === 'cctv')!;
    const offer = room.offers.find((o) => o.hook === 'cctv.door')!;
    const sc = fx.params.screen as number[];
    const n = fx.params.screenNormal as number[];
    // 画面の前 1.2 m に立つ
    sim.teleport(0, [sc[0]! + n[0]! * 1.2, room.cell.floorY + 0.02, sc[2]! + n[1]! * 1.2], 0);
    stand(sim, 2.5, { yaw: lookAt(sim, sc).yaw + Math.PI });
    assert.equal(out(sim, offer.revealOutput!), 0, '見ていなければ入らない');
    stand(sim, 2.5, lookAt(sim, sc));
    assert.equal(out(sim, offer.revealOutput!), 1, `向き ${dir}: モニターを見つめると入る`);
  }
});

test('鏡の中だけの扉: 鏡を見ながら向かいの壁へ下がると隠しの出力（壁を向いていては入らない）', async () => {
  for (const dir of DIRS) {
    const r = (await labSim('mirrorDoor', { ...size(dir, 7, 7), entry: dir, exit: opp(dir), seed: 15 + dir }))!;
    assert.ok(r, `向き ${dir}: 組める`);
    const { room, sim } = r;
    const offer = room.offers.find((o) => o.hook === 'mirror.door')!;
    assert.ok(offer.required && offer.modes.length === 1 && offer.modes[0] === 'appear');
    const fx = entitiesOf(room.floor, 'senseFx').find((e) => e.params.fx === 'mirror')!;
    const zone = entitiesOf(room.floor, 'zoneSensor').find((e) => e.id.endsWith('.near'))!;
    const a = zone.params.aabb as { min: number[]; max: number[] };
    const zc: [number, number, number] = [(a.min[0]! + a.max[0]!) / 2, room.cell.floorY + 0.02, (a.min[2]! + a.max[2]!) / 2];
    const look = entitiesOf(room.floor, 'gazeSensor')[0]!;
    const mirror = look.params.target as number[];
    sim.teleport(0, zc, 0);
    stand(sim, 2, { yaw: lookAt(sim, mirror).yaw + Math.PI });
    assert.equal(out(sim, offer.revealOutput!), 0, '壁を向いていては入らない');
    stand(sim, 2, lookAt(sim, mirror));
    assert.equal(out(sim, offer.revealOutput!), 1, `向き ${dir}: 鏡を見ていると入る`);
    void fx;
  }
});

test('幕の部屋: 歩く人は本物の幕を通って出口へ・違う幕の奥へ入ると入口へ戻される・印の手がかり（光る手形・目を閉じる）', async () => {
  for (const def of ['glowCurtains', 'blindCurtains'] as const) {
    let n = 0;
    for (const dir of DIRS) {
      const r = await labSim(def, { ...size(dir, 7, 8), entry: dir, exit: opp(dir), seed: 17 + dir });
      if (!r) continue;
      n++;
      const { room, sim } = r;
      const res = walkTo(sim, room.cell.id, [room.exitInside![0]!, 0, room.exitInside![2]!], 60);
      assert.ok(res.ok, `${def} 向き ${dir}: 本物の幕を通って出口へ（${res.reason}）`);
      // 違う幕の奥へ
      const wrong = entitiesOf(room.floor, 'respawnZone');
      assert.equal(wrong.length, 2, '違う幕は 2 つ');
      const a = wrong[0]!.params.aabb as { min: number[]; max: number[] };
      const t0 = sim.tick;
      sim.teleport(0, [(a.min[0]! + a.max[0]!) / 2, room.cell.floorY + 0.02, (a.min[2]! + a.max[2]!) / 2], 0);
      stand(sim, 0.2);
      const back = sim.drainEvents().filter((e) => e.type === 'player.respawn' && e.tick > t0 && e.data?.cause === wrong[0]!.id);
      assert.equal(back.length, 1, `${def} 向き ${dir}: 違う幕の奥へ入ると入口へ戻される`);
      if (def === 'blindCurtains') {
        const eyes = entitiesOf(room.floor, 'gazeSensor')[0]!;
        sim.teleport(0, [room.inside[0], 0.02, room.inside[2]], 0);
        stand(sim, 0.3);
        stand(sim, 2.2, { pitch: -1.4 });
        assert.equal(sim.outputOf(eyes.id, 'done'), 1, '下を見て止まると目を閉じる');
      } else {
        const offer = room.offers.find((o) => o.hook === 'glow.hand');
        if (offer) {
          const z = entitiesOf(room.floor, 'flashlightSensor')[0]!;
          const za = z.params.aabb ?? z.params.region;
          const q = za as { min: number[]; max: number[] };
          sim.teleport(0, [(q.min[0]! + q.max[0]!) / 2, 0.02, (q.min[2]! + q.max[2]!) / 2], 0);
          stand(sim, 2.5, { flashlight: true });
          assert.equal(out(sim, offer.revealOutput!), 0, '懐中電灯を点けていては入らない');
          stand(sim, 2.5, { flashlight: false });
          assert.equal(out(sim, offer.revealOutput!), 1, '懐中電灯を消すと手形の扉');
        }
      }
    }
    assert.ok(n >= 3, `${def}: 組めた向き ${n}`);
  }
});

test('見る・見ないの仕掛け: 同じ seed なら同じ部屋（決定的）', () => {
  for (const def of ['watchClock', 'zoomSign', 'mannequinGaze', 'photoBooth', 'cctvRoom', 'mirrorDoor', 'glowCurtains', 'blindCurtains']) {
    const o = { w: 7, d: 11, entry: 0 as Dir, exit: 2 as Dir, seed: 5 };
    assert.equal(JSON.stringify(labRoomDoors(def, o)?.floor), JSON.stringify(labRoomDoors(def, o)?.floor), def);
  }
});
