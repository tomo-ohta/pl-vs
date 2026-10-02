/**
 * 自由に遊べるミニゲーム（2.15）その 1。どれも本道でない脇の部屋（扉の向こう）に置き、いつでも入口から出られる。
 * 報酬は置かない。失敗は区間の最初へ戻るだけ。普通と違う遊び方をすると隠しが見つかる。
 *
 * - tiltMarble U01 球を穴に入れる: 部屋の床がまるごと傾く板（立った方へ傾く）。大きな球と、床の穴 3 つ（明るい輪の穴が的）。
 *     穴に入ると球は始めの所へ戻る。隠し: 部屋の隅の暗い穴に入れる（出現型）
 * - bowlingLane U02 ボウリングの廊下: 細長い部屋の手前に球 2 つ、奥にピン 6 本。走りながら投げると転がる。全部倒れると起き直る。
 *     隠し（反則）: 投げずに歩いてピンの所まで行き、奥の床に 3 秒いると、奥の壁が開く（出現型）。ファウルの線を越えると警告音
 * - golfRoom U03 ゴルフの部屋（1 打で）: 芝の床に球と旗の穴。体で触れると蹴る（走ると強く）。低い壁で跳ね返る。止まって穴に
 *     入っていなければ元の所へ戻る。転がっている間にもう一度蹴ると反則で戻る。隠し: 壁の下のねずみ穴に入れる（出現型）
 * - tagRoom U04 鬼ごっこする灯り: 暗い部屋の灯りの玉が逃げる。触れると捕まえた数が増え、遠くへ跳ぶ。
 *     隠し: 追わずに、灯りを見ないでじっとしていると、灯りの方から寄ってきて触れる → 灯りのいた壁に扉（出現型）
 * - hideSeek U05 かくれんぼ: 木箱の並ぶ部屋を、灯りが見回る。見つかると入口へ戻される（しゃがむと見つかりにくい）。
 *     奥の床の光る円まで行けば勝ち。隠し: 木箱の陰の隙間に 15 秒隠れ続けると、隙間の奥の壁が開く（出現型）
 * - pinballHall U06 ピンボールの吹き抜け（自分が球）: 滑る床が奥から手前の壁へ傾いて（押されて）いる。丸い柱に触れると弾かれる。
 *     奥の 3 つの的を全部踏むと灯りがつく。手前の壁際の落とし穴に落ちると、階段で上がってやり直し。
 *     隠し: 落とし穴の底の壁の扉（存在型。わざと落ちる）
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext, type GimmickSlot } from '../types.ts';
import { cutFloorSlab, doorZone, frontOf, innerRect, pitBoxes, rectD, rectW, wallFrame } from '../util.ts';
import { buildHatch, hatchSecret, planHatch } from './hatch.ts';
import { aabbJ, addItem, floorSpots, freeSpans, idOf, offer, onMainWall, roomLamp, snap, wallBox, wallPoint } from './util.ts';

const sideRoom = (s: GimmickSlot): boolean => !!s.entrance && s.openings.every((o) => onMainWall(s, o));

/** 開口の無い壁の、いちばん長い区間（隠しの扉）。dirs を先に */
function secretWall(ctx: GimmickContext, need = 1.4, prefer: Dir[] = [], avoid: Dir[] = []): { d: Dir; at: number } | null {
  const r = innerRect(ctx.slot);
  const order = [...prefer, ...ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => !prefer.includes(d)))].filter((d) => !avoid.includes(d));
  for (const d of order) { const sp = freeSpans(r, ctx.slot.openings, d, need, 0.9)[0]; if (sp) return { d, at: sp.at }; }
  return null;
}

// ---------------------------------------------------------------- U01 球を穴に入れる（傾く床）
defineGimmick({
  id: 'tiltMarble', name: '球を穴に入れる', axes: ['floor', 'carry'], kinds: ['room', 'hall'], minSize: [5.4, 6], weight: 0.25, intensity: 1, physics: true, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r0 = innerRect(s);
    const side = (d: Dir): number => (s.openings.some((o) => o.dir === d) ? 1.35 : 0.05);
    const hole: Rect = { x0: snap(r0.x0 + side(3)), x1: snap(r0.x1 - side(1)), z0: snap(r0.z0 + side(2)), z1: snap(r0.z1 - side(0)) };
    if (rectW(hole) < 4 || rectD(hole) < 4) return;
    cutFloorSlab(s, hole);
    for (const b of pitBoxes(s, hole, 1.2)) ctx.addBox(b);
    const plate: Rect = { x0: hole.x0 + 0.17, x1: hole.x1 - 0.17, z0: hole.z0 + 0.17, z1: hole.z1 - 0.17 };
    ctx.reachAssist(box([plate.x0, y - 0.2, plate.z0], [plate.x1, y, plate.z1], s.cell.palette.floor));
    const walk: Rect = { x0: hole.x0 + 0.15, x1: hole.x1 - 0.15, z0: hole.z0 + 0.15, z1: hole.z1 - 0.15 };
    const halfMax = Math.max(rectW(walk), rectD(walk)) / 2;
    const maxDeg = Math.min(8, (Math.atan(0.33 / halfMax) * 180) / Math.PI);
    const tilt = ctx.addEntity('plate', { type: 'tiltFloor', params: { rect: { ...plate }, walkRect: { ...walk }, y, thickness: 0.2, maxDeg, rateDeg: 4, returnDeg: 2, mat: ctx.rng.pick(['floorWood', 'floorLino'] as const), friction: 0.5 } });
    const back = frontOf(s.entrance!, 0.8);
    ctx.addEntity('pitBack', { type: 'respawnZone', params: { aabb: aabbJ({ min: [hole.x0, y - 1.25, hole.z0], max: [hole.x1, y - 0.7, hole.z1] }), to: [back[0], y + 0.05, back[2]], toYaw: 0 } });
    // 穴: 入口から遠い所に的（明るい輪）、その横にもう 1 つ、部屋の隅に暗い穴
    const e = frontOf(s.entrance!, 1.0);
    const cx = (plate.x0 + plate.x1) / 2, cz = (plate.z0 + plate.z1) / 2;
    const corners: [number, number][] = [[plate.x0 + 0.55, plate.z0 + 0.55], [plate.x1 - 0.55, plate.z0 + 0.55], [plate.x0 + 0.55, plate.z1 - 0.55], [plate.x1 - 0.55, plate.z1 - 0.55]];
    corners.sort((a, b) => Math.hypot(b[0] - e[0], b[1] - e[2]) - Math.hypot(a[0] - e[0], a[1] - e[2]));
    const dark = corners[0]!;
    const goal: [number, number] = [snap(cx + (corners[1]![0] - cx) * 0.55), snap(cz + (corners[1]![1] - cz) * 0.55)];
    const other: [number, number] = [snap(cx + (corners[2]![0] - cx) * 0.5), snap(cz + (corners[2]![1] - cz) * 0.5)];
    const start: [number, number] = [snap(cx + (e[0] - cx) * 0.45), snap(cz + (e[2] - cz) * 0.45)];
    const R = 0.22;
    const ball = addItem(ctx, 'ball', [start[0], y + 0.02, start[1]], { half: [R, R, R], kind: 'ball', tag: 'ball.tilt', mat: 'plasticRed', body: true, pickable: false, persist: false, density: 90, friction: 0.5, restitution: 0.15, linearDamping: 0.15, angularDamping: 0.35, inputs: { reset: `${idOf(ctx, 'holes')}.reset` } });
    const holes = ctx.addEntity('holes', { type: 'ballHole', params: { ball, holes: [[goal[0], y + R, goal[1], 0.3], [other[0], y + R, other[1], 0.3], [dark[0], y + R, dark[1], 0.3]], maxSpeed: 1.8, plate: tilt, lit: [1, 0, 0] } });
    ctx.addEntity('goal', { type: 'carryChime', params: { name: 'carry.chime' }, inputs: { in: `${holes}.h0` } });
    const w = secretWall(ctx, 1.4);
    if (w) offer(ctx, { hook: 'game.tilt.darkHole', modes: ['appear'], weight: 1, revealOutput: `${holes}.h2`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '隅の暗い穴の縁の擦り傷' });
    ctx.keepOut({ min: [hole.x0, y - 1.2, hole.z0], max: [hole.x1, y + 3, hole.z1] });
  },
});

// ---------------------------------------------------------------- U02 ボウリングの廊下
defineGimmick({
  id: 'bowlingLane', name: 'ボウリングの廊下', axes: ['carry', 'move'], kinds: ['room', 'hall'], minSize: [2.8, 8], weight: 0.25, intensity: 0, physics: true, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    // 投げる向き: 入口の壁から向かいの壁へ（長い向きでなければやめる）
    const F = wallFrame(r, ent.dir);
    if (F.depth < 7.5 || F.u1 - F.u0 < 2.4) return;
    const eu = F.u(ent.pos[0], ent.pos[2]);
    // 球の溝（レーン）の真ん中: 入口から 1.0 m 横（扉の前を空ける）。部屋が細ければ真ん中
    const lu = F.u1 - F.u0 < 3.6 ? (F.u0 + F.u1) / 2 : Math.min(F.u1 - 0.8, Math.max(F.u0 + 0.8, eu + (eu < (F.u0 + F.u1) / 2 ? 1.0 : -1.0)));
    const laneW = 1.05;
    const foul = 2.2, deck = F.depth - 1.9;
    const lane = (v0: number, v1: number, mat: Box['mat'], h = 0.004, du = 0): void => { const q = F.rect(lu - laneW / 2 - du, v0, lu + laneW / 2 + du, v1); ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + h, q.z1], mat, false)); };
    lane(0.2, F.depth - 0.2, 'woodPanel', 0.006);
    lane(foul - 0.03, foul + 0.03, 'neonRed', 0.008);
    // 溝の縁の線
    for (const sg of [-1, 1]) { const q = F.rect(lu + sg * (laneW / 2 + 0.02) - 0.02, 0.2, lu + sg * (laneW / 2 + 0.02) + 0.02, F.depth - 0.2); ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + 0.01, q.z1], 'metalDark', false)); }
    // ピン: 奥の床に三角（1-2-3）。倒れると、全部倒れて 3 秒・投げて 10 秒で起き直る
    const pins: string[] = [];
    const pinRows = [[0], [-1, 1], [-2, 0, 2]];
    const reset = `${idOf(ctx, 'setter')}.reset`;
    pinRows.forEach((row, ri) => row.forEach((k) => {
      const p = F.point(lu + k * 0.15, deck + 0.3 + ri * 0.26);
      pins.push(addItem(ctx, `pin${pins.length}`, [p[0], y + 0.002, p[1]], { half: [0.06, 0.19, 0.06], kind: 'pin', tag: 'pin', mat: 'paintWhite', body: true, pickable: false, persist: false, density: 160, friction: 0.4, restitution: 0.2, inputs: { reset } }));
    }));
    // 球: 手前の台の上（2 つ）
    // 台はレーンの、入口から遠い側（扉の前を塞がない）。細い部屋ではレーンの手前の床に球を置く
    const away = Math.sign(lu - eu) || 1;
    const ru = lu + away * (laneW / 2 + 0.4);
    const roomy = ru + away * 0.3 < F.u1 - 0.05 && ru - away * 0.3 > F.u0 + 0.05 && (away > 0 ? ru + 0.3 <= F.u1 : ru - 0.3 >= F.u0);
    const rack = F.point(roomy ? ru : lu, 1.6);
    const rackH = roomy ? 0.4 : 0;
    if (roomy) ctx.addBox(box([rack[0] - 0.25, y, rack[1] - 0.25], [rack[0] + 0.25, y + rackH, rack[1] + 0.25], 'metalDark'));
    const balls = [-0.14, 0.14].map((o, i) => { const q = F.point(F.u(rack[0], rack[1]) + (roomy ? 0 : o * 2), 1.6 + (roomy ? o : 0)); return addItem(ctx, `ball${i}`, [q[0], y + rackH, q[1]], { half: [0.11, 0.11, 0.11], kind: 'ball', tag: 'ball.bowling', mat: i ? 'plasticBlue' : 'plasticRed', body: true, persist: false, roll: true, density: 1400, friction: 0.5, restitution: 0.1, linearDamping: 0.05, angularDamping: 0.1, inputs: { reset } }); });
    ctx.addEntity('setter', { type: 'pinSetter', params: { pins, balls, resetSec: 10 } });
    // ファウルの線を越えると警告音
    const fz = F.rect(F.u0, foul, F.u1, F.depth);
    const over = ctx.addEntity('foul', { type: 'zoneSensor', params: { aabb: aabbJ({ min: [fz.x0, y - 0.3, fz.z0], max: [fz.x1, y + 2, fz.z1] }) } });
    ctx.addEntity('buzz', { type: 'carryChime', params: { name: 'carry.foul' }, inputs: { in: `${over}.in` } });
    // 隠し（反則）: ピンの所まで歩いて行き、奥の床に 3 秒いる → 奥の壁が開く
    const dk = F.rect(F.u0, deck - 0.2, F.u1, F.depth);
    const stay = ctx.addEntity('deck', { type: 'dwellSensor', params: { aabb: aabbJ({ min: [dk.x0, y - 0.3, dk.z0], max: [dk.x1, y + 2, dk.z1] }), sec: 3, still: false, latch: true } });
    const back = ((ent.dir + 2) % 4) as Dir;
    const bsp = freeSpans(r, s.openings, back, 1.4, 0.8).sort((a, b) => Math.abs(a.at - lu) - Math.abs(b.at - lu))[0];
    if (bsp) offer(ctx, { hook: 'game.bowling.deck', modes: ['appear'], weight: 1, revealOutput: `${stay}.done`, doorway: { dir: back, at: Math.min(Math.max(lu, bsp.a0 + 0.55), bsp.a1 - 0.55), y, width: 1.0, height: 2.0 }, tell: 'ピンの奥の、職員用の扉の跡' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- U03 ゴルフの部屋
defineGimmick({
  id: 'golfRoom', name: 'ゴルフの部屋', axes: ['carry', 'move'], kinds: ['room', 'hall'], minSize: [4.4, 6], weight: 0.25, intensity: 0, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    const F = wallFrame(r, ent.dir);
    if (F.depth < 5.5) return;
    // 芝の床
    const g = innerRect(s, 0.25);
    ctx.addBox(box([g.x0, y, g.z0], [g.x1, y + 0.006, g.z1], 'grass', false));
    const eu = F.u(ent.pos[0], ent.pos[2]);
    const tee = F.point(eu + (eu < (F.u0 + F.u1) / 2 ? 0.9 : -0.9), 1.7);
    ctx.addBox(box([tee[0] - 0.12, y + 0.006, tee[1] - 0.12], [tee[0] + 0.12, y + 0.012, tee[1] + 0.12], 'paintWhite', false));
    // 旗の穴: 奥（入口と反対の横へずらす）。間に低い壁（まっすぐは入らない）
    const cu = F.u0 + (F.u1 - F.u0) * (F.u(tee[0], tee[1]) < (F.u0 + F.u1) / 2 ? 0.72 : 0.28);
    const cup = F.point(cu, F.depth - 1.3);
    const wv = (1.7 + F.depth - 1.3) / 2;
    const wallU = (F.u(tee[0], tee[1]) + cu) / 2;
    const lw = F.rect(wallU - 0.9, wv - 0.08, wallU + 0.9, wv + 0.08);
    ctx.addBox(box([lw.x0, y, lw.z0], [lw.x1, y + 0.25, lw.z1], 'woodPanel'));
    // 旗（当たらない）
    ctx.addBox(box([cup[0] - 0.012, y, cup[1] - 0.012], [cup[0] + 0.012, y + 1.3, cup[1] + 0.012], 'metalDark', false));
    ctx.addBox(box([cup[0], y + 1.05, cup[1] - 0.01], [cup[0] + 0.3, y + 1.28, cup[1] + 0.01], 'plasticRed', false));
    // ねずみ穴: 横の壁の根元（入口から遠い方の横の壁）
    const sideD = (((ent.dir + (cu > (F.u0 + F.u1) / 2 ? 1 : 3)) % 4)) as Dir;
    const msp = freeSpans(r, s.openings, sideD, 1.6, 0.6)[0];
    if (!msp) return;
    const mouse = wallPoint(r, sideD, msp.at, 0.12, y);
    ctx.addBox(wallBox(r, sideD, msp.at, 0.11, y, y + 0.16, 0.012, 'screenDark'));
    const ball = ctx.addEntity('ball', { type: 'rollBall', params: { tee: [tee[0], y + 0.09, tee[1]], r: 0.09, area: aabbJ({ min: [g.x0, y - 0.5, g.z0], max: [g.x1, y + 2, g.z1] }), cups: [[cup[0], cup[1], 0.16], [mouse[0], mouse[2], 0.2]], restSec: 1.5 } });
    ctx.addEntity('goal', { type: 'carryChime', params: { name: 'carry.chime' }, inputs: { in: `${ball}.c0` } });
    // 隠しの扉: ねずみ穴の壁の、穴から 1.2 m 以上離れた所（無ければほかの壁）
    let door: { d: Dir; at: number } | null = null;
    for (const sp of freeSpans(r, s.openings, sideD, 1.2, 0.8)) {
      for (const at of [msp.at + 1.25, msp.at - 1.25, sp.at]) if (at - 0.55 >= sp.a0 && at + 0.55 <= sp.a1 && Math.abs(at - msp.at) >= 1.2) { door = { d: sideD, at }; break; }
      if (door) break;
    }
    door ??= secretWall(ctx, 1.4, [], [sideD]);
    if (door) offer(ctx, { hook: 'game.golf.mouse', modes: ['appear'], weight: 1, revealOutput: `${ball}.c1`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: '壁の根元のねずみ穴' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- U04 鬼ごっこする灯り
defineGimmick({
  id: 'tagRoom', name: '鬼ごっこする灯り', axes: ['light', 'move'], kinds: ['room', 'hall'], minSize: [5, 6], weight: 0.25, intensity: 0, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    roomLamp(ctx, 'dark', false);
    const spots = floorSpots(ctx, 6, { margin: 0.8, gap: 1.6, doorD: 2.0 });
    if (!spots) return;
    const w = secretWall(ctx, 1.4);
    if (!w) return;
    // 初めにいる所: 隠しの扉の前
    const home = wallPoint(innerRect(s), w.d, w.at, 0.9, y + 1.2);
    const tag = ctx.addEntity('light', { type: 'tagLight', params: { home, area: aabbJ({ min: [s.rect.x0, y - 0.3, s.rect.z0], max: [s.rect.x1, y + 3, s.rect.z1] }), spots: spots.map((p) => [p[0], y + 1.2, p[2]]), speed: 3.4, fleeM: 4.5, stillSec: 6, creep: 0.7, color: 0xffe9b0, range: 5 } });
    offer(ctx, { hook: 'game.tag.still', modes: ['appear'], weight: 1, revealOutput: `${tag}.touched`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '灯りが初めにいた壁の前の、焦げた跡' });
    ctx.keepOut({ min: [s.rect.x0, y - 0.1, s.rect.z0], max: [s.rect.x1, y + 2.6, s.rect.z1] });
  },
});

// ---------------------------------------------------------------- U05 かくれんぼ
defineGimmick({
  id: 'hideSeek', name: 'かくれんぼ', axes: ['sight', 'light'], kinds: ['room', 'hall'], minSize: [6, 7], weight: 0.25, intensity: 1, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    const F = wallFrame(r, ent.dir);
    // 勝ちの円: 奥の真ん中。隠れる隙間: 奥の隅（木箱 2 つと壁で囲う）
    const goal = F.point((F.u0 + F.u1) / 2, F.depth - 1.0);
    const eu = F.u(ent.pos[0], ent.pos[2]);
    const nookU = eu < (F.u0 + F.u1) / 2 ? F.u1 - 0.75 : F.u0 + 0.75;
    const back = ((ent.dir + 2) % 4) as Dir;
    // 隙間の奥の壁（奥の壁）に扉
    const nook = F.point(nookU, F.depth - 0.6);
    const nookAt = back % 2 === 0 ? nook[0] : nook[1];
    if (!freeSpans(r, s.openings, back, 1.2, 0.6).some((x) => nookAt - 0.5 >= x.a0 - 0.31 && nookAt + 0.5 <= x.a1 + 0.31)) return;
    const crates: Rect[] = [];
    const crate = (u: number, v: number, w: number, d: number, h: number): void => {
      const q = F.rect(u - w / 2, v - d / 2, u + w / 2, v + d / 2);
      crates.push(q);
      ctx.addBox(box([q.x0, y, q.z0], [q.x1, y + h, q.z1], 'woodPanel'));
    };
    // 隙間（部屋の奥の隅の 1.3 m 四方）: 内側の横に木箱、手前に木箱。入口は横の壁沿いの 0.95 m だけ
    const inward = nookU > (F.u0 + F.u1) / 2 ? -1 : 1;
    const wallU = inward < 0 ? F.u1 : F.u0;
    crate(wallU + inward * 1.55, F.depth - 0.65, 0.5, 1.3, 1.5);
    crate(wallU + inward * 1.375, F.depth - 1.55, 0.85, 0.5, 1.5);
    // 部屋の真ん中の木箱（陰に隠れる）
    for (const [fu, fv] of [[0.3, 0.45], [0.7, 0.45], [0.5, 0.65], [0.25, 0.75], [0.75, 0.75]] as const) {
      const u = F.u0 + (F.u1 - F.u0) * fu, v = F.depth * fv;
      const q = F.rect(u - 0.5, v - 0.4, u + 0.5, v + 0.4);
      if (crates.some((c) => q.x0 < c.x1 + 0.9 && q.x1 > c.x0 - 0.9 && q.z0 < c.z1 + 0.9 && q.z1 > c.z0 - 0.9)) continue;
      if (Math.hypot((q.x0 + q.x1) / 2 - goal[0], (q.z0 + q.z1) / 2 - goal[1]) < 1.4) continue;
      const z = doorZone(ent, y, 2.2, 0.6);
      if (q.x0 < z.max[0] && q.x1 > z.min[0] && q.z0 < z.max[2] && q.z1 > z.min[2]) continue;
      crate(u, v, 1.0, 0.8, ctx.rng.chance(0.5) ? 1.0 : 1.4);
    }
    ctx.addBox(box([goal[0] - 0.5, y, goal[1] - 0.5], [goal[0] + 0.5, y + 0.006, goal[1] + 0.5], 'lightYellow', false));
    const win = ctx.addEntity('base', { type: 'zoneSensor', params: { aabb: aabbJ({ min: [goal[0] - 0.5, y - 0.3, goal[1] - 0.5], max: [goal[0] + 0.5, y + 2, goal[1] + 0.5] }) } });
    // 勝ち: 入口から見つからずに円まで来た
    const won = ctx.addEntity('won', { type: 'and', params: {}, inputs: { a: `${win}.in`, b: `${idOf(ctx, 'seeker')}.clean` } });
    ctx.addEntity('win', { type: 'carryChime', params: { name: 'carry.chime' }, inputs: { in: `${won}.out` } });
    // 見回る道: 部屋の真ん中を回る四角（壁から 1.6 m）
    const path = [F.point(F.u0 + 1.6, 2.4), F.point(F.u1 - 1.6, 2.4), F.point(F.u1 - 1.6, F.depth - 2.2), F.point(F.u0 + 1.6, F.depth - 2.2)].map(([x, z]) => [x, y + 1.1, z]);
    const safe = doorZone(ent, y, 1.8, 0.6);
    // 隙間に見つからずに 15 秒隠れ続ける
    const nz = F.rect(nookU - 0.4, F.depth - 1.2, nookU + 0.4, F.depth - 0.05);
    const seeker = ctx.addEntity('seeker', { type: 'seeker', params: { path, area: aabbJ({ min: [r.x0, y - 0.3, r.z0], max: [r.x1, y + 3, r.z1] }), speed: 1.1, viewDeg: 36, viewM: 5.5, safe: aabbJ(safe), hide: aabbJ({ min: [nz.x0, y - 0.3, nz.z0], max: [nz.x1, y + 2, nz.z1] }), hideSec: 15 } });
    offer(ctx, { hook: 'game.hide.nook', modes: ['appear'], weight: 1, revealOutput: `${seeker}.hidden`, doorway: { dir: back, at: nookAt, y, width: 1.0, height: 2.0 }, tell: '木箱の隙間の奥の、すきま風' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- U06 ピンボールの吹き抜け
defineGimmick({
  id: 'pinballHall', name: 'ピンボールの吹き抜け', axes: ['move', 'floor'], kinds: ['room', 'hall'], minSize: [6, 7], weight: 0.25, intensity: 1, offersSecret: true, onMainPath: false,
  // 行き止まりの部屋だけ（押される床・弾く柱の部屋を、ほかの部屋への通り道にしない）
  fits: (s) => sideRoom(s) && s.openings.length === 1,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    // 手前の壁（落とし穴の壁）: 開口の無い壁。そこへ向かって押される
    const plan = planHatch(ctx, { walls: ([0, 1, 2, 3] as Dir[]).filter((d) => !s.openings.some((o) => o.dir === d)) });
    if (!plan) return;
    const F = wallFrame(r, plan.d);
    // 押す向き: 奥から手前（壁 plan.d の外向き）
    const dirV: Vec3 = plan.d === 0 ? [0, 0, 1] : plan.d === 1 ? [1, 0, 0] : plan.d === 2 ? [0, 0, -1] : [-1, 0, 0];
    const t = ctx.tuning;
    // 押す範囲: 落とし穴の列（壁から 2.85 m）より奥。穴の近くは滑るだけ（穴の階段から上がって、また押し戻されない）
    const pushA = F.rect(F.u0, 2.85, F.u1, F.depth);
    const area = { min: [pushA.x0, y - 0.2, pushA.z0], max: [pushA.x1, y + 2.2, pushA.z1] };
    const safe = doorZone(ent, y, 1.8, 0.7);
    // 入口の前は押さない（いつでも出られる）: 押す範囲を、入口の前を除いた矩形に分ける
    const parts: { min: number[]; max: number[] }[] = [];
    const cut = (a: { min: number[]; max: number[] }): void => {
      const ix0 = Math.max(a.min[0]!, safe.min[0]), ix1 = Math.min(a.max[0]!, safe.max[0]), iz0 = Math.max(a.min[2]!, safe.min[2]), iz1 = Math.min(a.max[2]!, safe.max[2]);
      if (ix0 >= ix1 || iz0 >= iz1) { parts.push(a); return; }
      const put = (x0: number, z0: number, x1: number, z1: number): void => { if (x1 - x0 > 0.2 && z1 - z0 > 0.2) parts.push({ min: [x0, a.min[1]!, z0], max: [x1, a.max[1]!, z1] }); };
      put(a.min[0]!, a.min[2]!, a.max[0]!, iz0);
      put(a.min[0]!, iz1, a.max[0]!, a.max[2]!);
      put(a.min[0]!, iz0, ix0, iz1);
      put(ix1, iz0, a.max[0]!, iz1);
    };
    cut(area);
    for (const a of parts) ctx.addZone({ kind: 'force', aabb: { min: [a.min[0]!, a.min[1]!, a.min[2]!], max: [a.max[0]!, a.max[1]!, a.max[2]!] }, vector: dirV, params: { speed: t['carry.pinball.push'] } });
    // 滑る床: 部屋じゅう（入口の前を除く）
    parts.length = 0;
    cut({ min: [r.x0, y - 0.2, r.z0], max: [r.x1, y + 2.2, r.z1] });
    for (const a of parts) ctx.addZone({ kind: 'friction', aabb: { min: [a.min[0]!, a.min[1]!, a.min[2]!], max: [a.max[0]!, a.max[1]!, a.max[2]!] }, params: { friction: t['carry.pinball.friction'] } });
    buildHatch(ctx, plan, 'open', '');
    // 丸い柱（弾く）: 部屋の中ほど
    const bumpers: Vec3[] = [];
    for (let k = 0; k < 40 && bumpers.length < 4; k++) {
      const u = ctx.rng.float(F.u0 + 1.0, F.u1 - 1.0), v = ctx.rng.float(2.8, F.depth - 1.6);
      const p = F.point(u, v);
      const q: Vec3 = [snap(p[0]), y, snap(p[1])];
      if (bumpers.some((b) => Math.hypot(b[0] - q[0], b[2] - q[2]) < 1.7)) continue;
      if (q[0] > safe.min[0] - 0.8 && q[0] < safe.max[0] + 0.8 && q[2] > safe.min[2] - 0.8 && q[2] < safe.max[2] + 0.8) continue;
      bumpers.push(q);
    }
    bumpers.forEach((b, i) => {
      ctx.addBox(box([b[0] - 0.22, y, b[2] - 0.22], [b[0] + 0.22, y + 1.0, b[2] + 0.22], 'plasticYellow'));
      ctx.addEntity(`bumper${i}`, { type: 'bumper', params: { pos: [...b], r: 0.24, speed: t['carry.pinball.kick'], up: 2.2 } });
    });
    // 的: 奥の壁の前の床に 3 つ。踏むと灯る（全部で灯り）
    const lamps: string[] = [];
    [0.25, 0.5, 0.75].forEach((f, i) => {
      const p = F.point(F.u0 + (F.u1 - F.u0) * f, F.depth - 0.7);
      ctx.addBox(box([p[0] - 0.35, y, p[1] - 0.35], [p[0] + 0.35, y + 0.008, p[1] + 0.35], 'neonBlue', false));
      const z = ctx.addEntity(`target${i}`, { type: 'zoneSensor', params: { aabb: aabbJ({ min: [p[0] - 0.4, y - 0.3, p[1] - 0.4], max: [p[0] + 0.4, y + 1.5, p[1] + 0.4] }) } });
      const l = ctx.addEntity(`hit${i}`, { type: 'latch', params: {}, inputs: { set: `${z}.in` } });
      lamps.push(l);
    });
    const all = ctx.addEntity('all', { type: 'and', params: {}, inputs: { a: `${lamps[0]}.out`, b: `${lamps[1]}.out`, c: `${lamps[2]}.out` } });
    ctx.addEntity('jackpot', { type: 'carryChime', params: { name: 'carry.chime' }, inputs: { in: `${all}.out` } });
    // 隠し: 落とし穴の底の壁（わざと落ちる）
    offer(ctx, hatchSecret(plan, y, 'game.pinball.drain', '落とし穴の底から吹き上がる風'));
    ctx.keepOut({ min: [r.x0, y - 3, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});
