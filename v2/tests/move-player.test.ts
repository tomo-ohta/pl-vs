/**
 * 移動と身体（段階 4）: プレイヤーの動きの拡張（core/sim/player.ts）を、小さな箱の世界で確かめる。
 * はしご・泳ぐ（浮く・潜る・縁へ這い上がる）・上昇気流・重い部屋・落ちる速さの上限・泥に沈む・自動でしゃがむ・
 * 身体の大きさ・乗り物・重力の向き（磁力の面へ乗り移る・面から離れると落ちる）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AABB } from '../core/math/aabb.ts';
import type { Vec3 } from '../core/math/vec.ts';
import { ColliderIndex } from '../core/sim/collision.ts';
import { bodyAabb, createPlayer, gravFor, gravUp, PLAYER, playerEye, playerHeight, playerLook, rotAabb, rotQuarter, stepPlayer, type PlayerWorld } from '../core/sim/player.ts';
import { IDLE_COMMAND, type InputCommand, type PlayerState, type SimEvent } from '../core/sim/types.ts';
import type { Zone } from '../core/world/layout.ts';

const DT = 1 / 60;

function world(boxes: AABB[], zones: Zone[] = []): PlayerWorld {
  const colliders = new ColliderIndex();
  for (const b of boxes) colliders.addStatic(b);
  return { colliders, zones, surfaces: [] };
}

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): AABB => ({ min: [x0, y0, z0], max: [x1, y1, z1] });
const floor = (y = 0): AABB => box(-20, y - 0.2, -20, 20, y, 20);

function run(p: PlayerState, w: PlayerWorld, n: number, cmd: Partial<InputCommand> = {}, ev: SimEvent[] = []): void {
  for (let i = 0; i < n; i++) stepPlayer(p, { ...IDLE_COMMAND, yaw: p.yaw, pitch: 0, ...cmd }, w, DT, i, ev);
}

test('はしご: はしごへ押すと上り、上の床へ出られる。離れる向きに押すと下りる・跳ぶと離れる', () => {
  // 壁（x = 1 の面）の高さ 3 m の台。はしごは台の手前（x 0.4..1.0）
  const w = world([floor(), box(1, 0, -2, 4, 3, 2)], [{ kind: 'climb', aabb: box(0.35, 0, -0.4, 1.0, 3.4, 0.4), vector: [1, 0, 0] }]);
  const p = createPlayer('p', [0.6, 0, 0], -Math.PI / 2); // yaw -90° = +X を向く
  run(p, w, 5);
  for (let i = 0; i < 240 && !(p.onGround && p.pos[1] > 2.9 && p.pos[0] > 1.4); i++) run(p, w, 1, { moveY: 1 });
  assert.ok(p.pos[1] >= 3 - 1e-3 && p.pos[0] > 1.2 && p.onGround, `上の台に立つ（${p.pos.map((v) => v.toFixed(2))}）`);
  // 下りる: はしごの途中まで戻して、後ろへ押す
  const q = createPlayer('q', [0.65, 2.0, 0], -Math.PI / 2);
  q.climbing = true;
  run(q, w, 30, { moveY: -1 });
  assert.ok(q.pos[1] < 1.3 && q.pos[0] > 0.3, `下りる（${q.pos.map((v) => v.toFixed(2))}）`);
  // つかまったまま止まる（何もしない）
  const r = createPlayer('r', [0.65, 1.5, 0], -Math.PI / 2);
  r.climbing = true;
  run(r, w, 60);
  assert.ok(Math.abs(r.pos[1] - 1.5) < 0.05, `つかまったまま（${r.pos[1].toFixed(2)}）`);
  run(r, w, 1, { jump: true });
  run(r, w, 30);
  assert.ok(!r.climbing && r.pos[0] < 0.3, '跳ぶと離れる');
});

test('泳ぐ: 深い水では浮き、しゃがむと潜り、縁へ押すと這い上がる。浅い所は歩く', () => {
  // プール: 床 y = 0（縁 x < 0）、水槽 x 0..6 の底 y = -2.4、水面 y = -0.2
  const boxes = [box(-10, -0.2, -5, 0, 0, 5), box(6, -0.2, -5, 16, 0, 5), box(0, -2.6, -5, 6, -2.4, 5), box(-0.2, -2.6, -5, 0, 0, 5)];
  const swim: Zone = { kind: 'swim', aabb: box(0, -2.4, -5, 6, -0.2, 5), params: { surface: -0.2 } };
  const w = world(boxes, [swim]);
  const p = createPlayer('p', [3, -0.5, 0], Math.PI / 2); // yaw 90° = -X（縁の方）
  run(p, w, 180);
  assert.ok(p.swimming && Math.abs(p.pos[1] - (-0.2 - 1.38)) < 0.08, `浮く（足元 ${p.pos[1].toFixed(2)}）`);
  assert.ok(playerEye(p)[1] > -0.2, '目は水面より上');
  const y0 = p.pos[1];
  run(p, w, 60, { crouch: true });
  assert.ok(p.pos[1] < y0 - 0.6, `潜る（${p.pos[1].toFixed(2)}）`);
  run(p, w, 120);
  assert.ok(Math.abs(p.pos[1] - y0) < 0.1, '浮き戻る');
  // 縁へ泳いで、押し続けると這い上がる
  run(p, w, 300, { moveY: 1 });
  assert.ok(p.pos[0] < -0.2 && Math.abs(p.pos[1]) < 0.02 && p.onGround && !p.swimming, `縁へ上がる（${p.pos.map((v) => v.toFixed(2))}）`);
  // 泳ぐ速さは歩くより遅い
  const q = createPlayer('q', [1, -1.58, 0], -Math.PI / 2);
  run(q, w, 60);
  const x0 = q.pos[0];
  run(q, w, 60, { moveY: 1 });
  const v = q.pos[0] - x0;
  assert.ok(v > 0.8 && v < PLAYER.walk * 0.85, `泳ぐ速さ ${v.toFixed(2)} m/s`);
  // 浅い（底が足元から水面まで 1.2 m 未満）なら泳がない
  const shallow = world([floor(-0.8)], [{ kind: 'swim', aabb: box(-5, -1, -5, 5, -0.1, 5), params: { surface: -0.1 } }]);
  const s = createPlayer('s', [0, -0.8, 0], 0);
  run(s, shallow, 30);
  assert.ok(!s.swimming && s.onGround && s.inWater, '浅い所は歩く');
});

test('上昇気流・重い部屋・落ちる速さの上限・泥に沈む・低い所では自動でしゃがむ', () => {
  // 上昇気流: 上向きの流れの中では浮き上がる
  const up = world([floor()], [{ kind: 'force', aabb: box(-1, -0.5, -1, 1, 5, 1), vector: [0, 1, 0], params: { speed: 3 } }]);
  const a = createPlayer('a', [0, 0, 0], 0);
  run(a, up, 90);
  assert.ok(a.pos[1] > 2.5, `浮き上がる（${a.pos[1].toFixed(2)}）`);
  // 重い部屋: 跳んでも低い
  const apex = (zones: Zone[]): number => {
    const w = world([floor()], zones);
    const p = createPlayer('p', [0, 0, 0], 0);
    run(p, w, 5);
    let top = 0;
    run(p, w, 1, { jump: true });
    for (let i = 0; i < 90; i++) { run(p, w, 1); top = Math.max(top, p.pos[1]); }
    return top;
  };
  const normal = apex([]);
  const heavy = apex([{ kind: 'gravity', aabb: box(-5, -1, -5, 5, 5, 5), params: { scale: 1.8 } }]);
  const light = apex([{ kind: 'gravity', aabb: box(-5, -1, -5, 5, 5, 5), params: { scale: 0.4 } }]);
  assert.ok(heavy < normal * 0.65 && light > normal * 2, `跳ぶ高さ 普通 ${normal.toFixed(2)} / 重い ${heavy.toFixed(2)} / 軽い ${light.toFixed(2)}`);
  // 落ちる速さの上限（drag）
  const d = world([floor(-20)], [{ kind: 'water', aabb: box(-5, -19, -5, 5, 5, 5), params: { slow: 0.5, dry: true, drag: 1.2 } }]);
  const b = createPlayer('b', [0, 3, 0], 0);
  run(b, d, 60);
  assert.ok(b.vel[1] >= -1.2 - 1e-6, `ゆっくり落ちる（${b.vel[1].toFixed(2)}）`);
  // 泥: 目が下がる
  const mud = world([floor()], [{ kind: 'water', aabb: box(-5, -0.5, -5, 5, 0.5, 5), params: { slow: 0.4, dry: true, sink: 0.3 } }]);
  const c = createPlayer('c', [0, 0, 0], 0);
  run(c, mud, 60);
  assert.ok(Math.abs(c.eye - (PLAYER.eye - 0.3)) < 0.01, `目が沈む（${c.eye.toFixed(2)}）`);
  // 低い所（crawl ゾーン）: しゃがむ入力が無くてもしゃがむ。出れば立つ
  const crawl = world([floor(), box(-1, 1.2, 1, 1, 3, 3)], [{ kind: 'crawl', aabb: box(-1, 0, 1, 1, 1.2, 3) }]);
  const e = createPlayer('e', [0, 0, 0], Math.PI); // yaw 180° = +Z
  run(e, crawl, 5);
  run(e, crawl, 180, { moveY: 1 });
  assert.ok(e.pos[2] > 3.2, `低い所を抜ける（${e.pos[2].toFixed(2)}）`);
  run(e, crawl, 30);
  assert.ok(!e.crouching, '出たら立つ');
});

test('身体の大きさ: 小さくなると低い穴を通れ、目も低い。狭い所では大きくならない', () => {
  // 高さ 0.5 m の穴（x 2..3 の壁の下に、z -0.4..0.4 の隙間）
  const w = world([floor(), box(2, 0.5, -3, 3, 3, 3), box(2, 0, -3, 3, 0.5, -0.4), box(2, 0, 0.4, 3, 0.5, 3)]);
  const p = createPlayer('p', [0, 0, 0], -Math.PI / 2);
  run(p, w, 120, { moveY: 1 });
  assert.ok(p.pos[0] < 1.7, '普通の大きさでは通れない');
  p.scaleTo = 0.25;
  run(p, w, 60);
  assert.ok(Math.abs(p.scale - 0.25) < 1e-6 && p.eye < 0.45, `小さくなる（${p.scale}・目 ${p.eye.toFixed(2)}）`);
  run(p, w, 240, { moveY: 1 });
  assert.ok(p.pos[0] > 2.6, `小さいと通れる（${p.pos[0].toFixed(2)}）`);
  // 穴の中では大きくならない
  const q = createPlayer('q', [2.5, 0, 0], 0);
  q.scale = 0.25; q.scaleTo = 1;
  run(q, w, 60);
  assert.ok(q.scale < 0.3, `穴の中では大きくならない（${q.scale.toFixed(2)}）`);
  run(q, w, 120, { moveY: 1, yaw: -Math.PI / 2 });
  assert.ok(q.scale > 0.99, `出たら戻る（${q.scale.toFixed(2)}）`);
  // 大きいと、普通では登れない段（0.5 m）を越える
  const big = world([floor(), box(1.5, 0, -3, 5, 0.5, 3)]);
  const g = createPlayer('g', [0, 0, 0], -Math.PI / 2);
  run(g, big, 90, { moveY: 1 });
  assert.ok(g.pos[1] < 0.1, '普通の大きさでは 0.5 m の段を登れない');
  // 段の前（壁際）では大きくなれないので、離れてから大きくなる
  g.pos = [0, 0, 0];
  g.scaleTo = 1.5;
  run(g, big, 60);
  assert.ok(g.scale > 1.49);
  run(g, big, 90, { moveY: 1 });
  assert.ok(g.pos[1] > 0.45 && playerHeight(g) > 2.5, `大きいと登れる（${g.pos[1].toFixed(2)}）`);
});

test('乗り物: 乗っている間は部品が決めた位置から動かない（入力は input に残る）', () => {
  const w = world([floor()]);
  const p = createPlayer('p', [0, 1.5, 0], 0);
  p.ride = 'zip';
  run(p, w, 30, { moveY: 1, jump: true });
  assert.deepEqual(p.pos, [0, 1.5, 0]);
  assert.ok(p.input.y === 1 && p.input.jump);
});

test('重力の向き: 90° の回し方・目と視線・身体の箱', () => {
  for (const axis of ['x', 'z'] as const) for (let k = 0; k < 4; k++) {
    const v: Vec3 = [0.3, -1.2, 2.5];
    const back = rotQuarter(rotQuarter(v, axis, k), axis, 4 - k);
    assert.deepEqual(back.map((x) => Math.round(x * 1e9) / 1e9), v);
  }
  assert.deepEqual(gravUp(gravFor([1, 0, 0], 'z')), [1, 0, 0]);
  assert.deepEqual(gravUp(gravFor([0, 0, -1], 'z')), [0, 0, -1]);
  assert.deepEqual(gravUp(gravFor([0, -1, 0], 'x')), [0, -1, 0]);
  assert.equal(gravFor([0, 1, 0], 'z'), null);
  const p = createPlayer('p', [2, 1, 0], 0);
  p.grav = gravFor([-1, 0, 0], 'z'); // 右の壁（x = 2）に立つ
  const e = playerEye(p);
  assert.ok(Math.abs(e[0] - (2 - PLAYER.eye)) < 1e-9 && Math.abs(e[1] - 1) < 1e-9, `目は壁から離れる向き（${e}）`);
  const b = bodyAabb(p);
  assert.ok(Math.abs(b.min[0] - (2 - PLAYER.height)) < 1e-9 && Math.abs(b.max[0] - 2) < 1e-9 && Math.abs(b.max[1] - b.min[1] - 2 * PLAYER.radius) < 1e-9);
  // 視線: 前（-Z）は回しても -Z（軸 z のまわり）・上を見ると壁から離れる向き
  const f = playerLook(p, 0, 0);
  assert.ok(Math.abs(f[2] + 1) < 1e-9);
  const u = playerLook(p, 0, Math.PI / 2 - 1e-9);
  assert.ok(u[0] < -0.99, `上は -X（${u}）`);
  const a = rotAabb(box(0, 0, 0, 1, 2, 3), 'z', 1);
  assert.deepEqual(a, { min: [-2, 0, 0], max: [0, 1, 3] });
});

test('重力の向き: 磁力の面へ押すと壁・天井を歩け、磁力の無い所へ出ると落ちる', () => {
  // 長い四角い筒（x -1.5..1.5、y 0..3、z -10..10）。右の壁（x = 1.5）と天井（y = 3）の z -6..6 が磁力の面
  const W = 1.5, H = 3;
  const boxes = [box(-3, -0.2, -12, 3, 0, 12), box(-3, H, -12, 3, H + 0.2, 12), box(W, 0, -12, W + 0.2, H, 12), box(-W - 0.2, 0, -12, -W, H, 12)];
  const zones: Zone[] = [
    { kind: 'magnet', aabb: box(W - 1, 0, -6, W, H, 6), vector: [-1, 0, 0], params: { axis: 'z' } },
    { kind: 'magnet', aabb: box(-W, H - 1, -6, W, H, 6), vector: [0, -1, 0], params: { axis: 'z' } },
    { kind: 'magnet', aabb: box(-W, 0, -6, W, 1, 6), vector: [0, 1, 0], params: { axis: 'z' } },
  ];
  const w = world(boxes, zones);
  const ev: SimEvent[] = [];
  const p = createPlayer('p', [0, 0, 0], -Math.PI / 2); // +X（右の壁）を向く
  run(p, w, 5);
  for (let i = 0; i < 90 && !p.grav; i++) run(p, w, 1, { moveY: 1 }, ev);
  assert.deepEqual(gravUp(p.grav), [-1, 0, 0], '右の壁に乗り移る');
  assert.ok(ev.some((e) => e.type === 'player.gravity'));
  run(p, w, 30);
  assert.ok(p.onGround && Math.abs(p.pos[0] - W) < 0.01, `壁に立つ（${p.pos.map((v) => v.toFixed(2))}）`);
  // 押すのをやめて少し待っても、壁に立ったまま（面に足が付いている）
  run(p, w, 60);
  assert.deepEqual(gravUp(p.grav), [-1, 0, 0]);
  // 壁の上で「前」は、見た目の上（+Y = 天井の方）。天井へ押すと天井に乗り移る
  for (let i = 0; i < 200 && gravUp(p.grav)[1] > -0.5; i++) run(p, w, 1, { moveY: 1 });
  assert.deepEqual(gravUp(p.grav), [0, -1, 0], `天井に乗り移る（${p.pos.map((v) => v.toFixed(2))}）`);
  run(p, w, 30);
  assert.ok(p.onGround && Math.abs(p.pos[1] - H) < 0.01, '天井に立つ');
  // 天井を z の向きへ歩き、磁力の面（|z| < 6）から出ると落ちる（天井では右・左の向きが入れ替わるので、+Z へ進む操作を探す）
  const z0 = p.pos[2];
  run(p, w, 20, { moveX: 1 });
  const side = p.pos[2] > z0 ? 1 : -1;
  for (let i = 0; i < 600 && p.grav; i++) run(p, w, 1, { moveX: side });
  assert.equal(p.grav, null, '磁力の面から出ると普通の重力');
  assert.ok(Math.abs(p.pos[2]) > 5.5, `面の端（${p.pos[2].toFixed(2)}）`);
  run(p, w, 120);
  assert.ok(p.onGround && Math.abs(p.pos[1]) < 0.01, `床へ落ちる（${p.pos.map((v) => v.toFixed(2))}）`);
});
