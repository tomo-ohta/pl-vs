/**
 * 足跡・光る床・水たまりの鏡の部品（G11〜G14・BG05）。
 *
 * - stepTrail: 区画（room）の中で、プレイヤーが stride m 歩くごとに足元に印を残す（[x, z, 向き, 時刻] の列。古い物から消える。最大 max 個）。
 *     描画が印を光らせる（光る床: fadeSec 秒で消える）か、足跡にする（足跡が残る床）。非同期マルチプレイの下地（印の列はそのまま保存・送れる形）
 * - footMarks: 作り置きの「誰か」の足跡（params.marks。[x, z, 向き] の列）。動かない。描画だけ（他人の足跡 G13）
 * - loopCounter: 真ん中（center）のまわりを回った向きと周回の数。先に回った向きと逆向きに 1 周すると reversed（入ったまま）
 * - mirrorGaze: 水たまり（puddles）越しに、床の下に映った扉（door。壁の面の、床から下へ扉の高さまで）を見ている時間が sec 秒になると done
 */
import { lookDir } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn, pVec } from '../../part.ts';

interface TrailState { marks: number[]; lx: number; lz: number; side: number; [k: string]: Json | undefined }

definePart<TrailState>({
  type: 'stepTrail',
  outputs: ['count'],
  init: () => ({ marks: [], lx: NaN, lz: NaN, side: 1 }),
  step(s, ctx) {
    const room = pAabb(ctx.spec, 'room');
    const stride = pNum(ctx.spec, 'stride', 0.55);
    const max = Math.round(pNum(ctx.spec, 'max', 160));
    const p = ctx.players[0];
    if (p && p.onGround && playerIn(p, room)) {
      const dx = p.pos[0] - s.lx, dz = p.pos[2] - s.lz;
      if (!(Math.hypot(dx, dz) < stride)) {
        // 左右の足を交互に（進む向きの横へ 0.12 m ずらす）
        const yaw = Number.isFinite(dx) && Math.hypot(dx, dz) > 1e-3 ? Math.atan2(-dx, -dz) : p.yaw;
        s.side = -s.side;
        const ox = Math.cos(yaw) * 0.12 * s.side, oz = -Math.sin(yaw) * 0.12 * s.side;
        s.marks.push(Math.round((p.pos[0] + ox) * 1000) / 1000, Math.round((p.pos[2] + oz) * 1000) / 1000, Math.round(yaw * 1000) / 1000, Math.round(ctx.time * 100) / 100);
        if (s.marks.length > max * 4) s.marks.splice(0, s.marks.length - max * 4);
        s.lx = p.pos[0]; s.lz = p.pos[2];
      }
    }
    ctx.output('count', s.marks.length / 4);
  },
});

definePart({
  type: 'footMarks',
  outputs: [],
  init: () => ({}),
});

/** 水たまりの鏡の描画の入れ物（動かない。描画が床の下に部屋の鏡像を組む） */
definePart({
  type: 'mirrorRoom',
  outputs: [],
  init: () => ({}),
});

interface LoopState { ang: number; last: number; dir: number; laps: number; back: number; reversed: number; [k: string]: Json | undefined }

definePart<LoopState>({
  type: 'loopCounter',
  outputs: ['laps', 'reversed', 'turns'],
  init: () => ({ ang: 0, last: NaN, dir: 0, laps: 0, back: 0, reversed: 0 }),
  step(s, ctx) {
    const c = pVec(ctx.spec, 'center');
    const region = pAabb(ctx.spec, 'region');
    const p = ctx.players[0];
    if (!p || !playerIn(p, region)) { s.last = NaN; ctx.output('laps', s.laps); ctx.output('reversed', s.reversed); ctx.output('turns', s.ang / (Math.PI * 2)); return; }
    const a = Math.atan2(p.pos[2] - c[2], p.pos[0] - c[0]);
    if (Number.isFinite(s.last)) {
      let d = a - s.last;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      s.ang += d;
      // 1 周: 最初に回り切った向きを覚え、その向きの周回と、逆向きの周回を数える（向きを変えたら数え直す）
      const turn = Math.PI * 2;
      if (Math.abs(s.ang) >= turn) {
        const dir = Math.sign(s.ang);
        s.ang -= dir * turn;
        if (!s.dir) s.dir = dir;
        if (dir === s.dir) s.laps++;
        else { s.back++; if (s.laps > 0 && !s.reversed) { s.reversed = 1; ctx.cue('loop.reversed', [c[0], c[1], c[2]]); } }
        ctx.cue('loop.lap', [p.pos[0], p.pos[1], p.pos[2]], { dir, laps: s.laps, back: s.back });
      }
    }
    s.last = a;
    ctx.output('laps', s.laps);
    ctx.output('reversed', s.reversed);
    ctx.output('turns', s.ang / (Math.PI * 2));
  },
});

definePart<{ t: number; done: number }>({
  type: 'mirrorGaze',
  outputs: ['done', 'looking'],
  init: () => ({ t: 0, done: 0 }),
  step(s, ctx) {
    const fy = pNum(ctx.spec, 'floorY', 0);
    const puddles = (ctx.spec.params.puddles as number[][] | undefined) ?? [];
    const region = pAabb(ctx.spec, 'region');
    const door = ctx.spec.params.door as { dir: number; at: number; w: number; h: number; wall: number };
    const ax = door.dir % 2 === 0 ? 2 : 0, along = door.dir % 2 === 0 ? 0 : 2;
    let looking = false;
    for (const p of ctx.players) {
      if (!playerIn(p, region)) continue;
      const eye: [number, number, number] = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
      const v = lookDir(p.yaw, p.pitch);
      if (v[1] > -0.05) continue;
      // 視線が床の高さで水たまりの中を通り、床の下へ続いて、鏡に映った扉（扉の壁の面の、床から下へ扉の高さまで）に当たる
      const tf = (eye[1] - fy) / -v[1];
      const fx = eye[0] + v[0] * tf, fz = eye[2] + v[2] * tf;
      if (!puddles.some((r) => fx > r[0]! && fx < r[2]! && fz > r[1]! && fz < r[3]!)) continue;
      if (Math.abs(v[ax]) < 1e-4) continue;
      const tw = (door.wall - eye[ax]) / v[ax];
      if (tw <= tf || tw > pNum(ctx.spec, 'maxDist', 14)) continue;
      const py = eye[1] + v[1] * tw, pa = eye[along] + v[along] * tw;
      if (py <= fy && py >= fy - door.h && Math.abs(pa - door.at) < door.w / 2 + 0.15) looking = true;
    }
    s.t = looking ? s.t + ctx.dt : Math.max(0, s.t - ctx.dt * 0.5);
    if (s.t >= pNum(ctx.spec, 'sec', 1.2) && !s.done) { s.done = 1; ctx.cue('mirror.found', [door.dir % 2 === 0 ? door.at : door.wall, fy - 1.05, door.dir % 2 === 0 ? door.wall : door.at]); }
    ctx.output('done', s.done);
    ctx.output('looking', looking ? 1 : 0);
  },
});
