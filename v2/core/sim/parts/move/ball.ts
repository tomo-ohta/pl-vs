/**
 * 移動と身体の部品: 転がる球（rollBall）。調べると乗る（PlayerState.ride）。操作の向きへ球が加速して転がり、壁で跳ね返る。
 * 坂（同じ区画の ramp 部品）では下りへ加速する。乗っていない人が球に当たると、押した向きへ転がる。
 * - mode on 玉乗り: 球の上に立つ。止まりにくく、速いまま壁にぶつかると振り落とされる
 * - mode in バブル: 透明な球の中に入る。よく弾む。壁の割れやすい所（thin）に速くぶつかるたびに hits が増え、hitsNeed で割れる
 * 出力: riding・hits・broke（割れた）・inArea（params.area の中に乗って入ったら 1。隠しの出現の合図）
 * 当たり判定は区画の当たる箱（静的）と、球の動ける範囲 bounds（区画の内側。開口から外へ出ない）
 */
import type { AABB } from '../../../math/aabb.ts';
import { clamp, type Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, pStr, pVec, type PartContext } from '../../part.ts';
import { playerHeight, playerRadius } from '../../player.ts';
import { inputDir } from './mech.ts';

interface BallState { pos: number[]; vel: number[]; rider: string; hits: number; broke: number; cool: number; inArea: number; air: number; [k: string]: Json | undefined }

interface Ramp { x0: number; z0: number; x1: number; z1: number; axis: number; a0: number; a1: number; y0: number; y1: number }

/** 区画の当たる箱と坂（静的なのでフロアの部品ごとに覚えておく） */
const WORLD = new WeakMap<object, Map<string, { boxes: AABB[]; ramps: Ramp[] }>>();

function worldOf(ctx: PartContext): { boxes: AABB[]; ramps: Ramp[] } {
  let byId = WORLD.get(ctx.floor);
  if (!byId) WORLD.set(ctx.floor, (byId = new Map()));
  let w = byId.get(ctx.id);
  if (!w) {
    const cell = ctx.floor.cells.find((c) => c.id === ctx.spec.cell);
    const boxes = (cell?.boxes ?? []).filter((b) => b.solid && !b.revealGroup).map((b) => ({ min: [...b.min] as Vec3, max: [...b.max] as Vec3 }));
    const ramps = ctx.floor.entities.filter((e) => e.type === 'ramp' && e.cell === ctx.spec.cell).map((e) => {
      const r = e.params.rect as { x0: number; z0: number; x1: number; z1: number };
      return { ...r, axis: Number(e.params.axis ?? 2), a0: Number(e.params.a0), a1: Number(e.params.a1), y0: Number(e.params.y0), y1: Number(e.params.y1) };
    });
    w = { boxes, ramps };
    byId.set(ctx.id, w);
  }
  return w;
}

/** 点 (x, z) の足場の高さ（bottom + 0.35 以下のいちばん高い面）。無ければ -Infinity */
function groundAt(w: { boxes: AABB[]; ramps: Ramp[] }, x: number, z: number, bottom: number): number {
  let g = -Infinity;
  for (const b of w.boxes) if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && b.max[1] <= bottom + 0.35 && b.max[1] > g) g = b.max[1];
  for (const r of w.ramps) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    const a = r.axis === 0 ? x : z;
    const y = r.y0 + ((r.y1 - r.y0) * (a - r.a0)) / (r.a1 - r.a0);
    if (y <= bottom + 0.35 && y > g) g = y;
  }
  return g;
}

definePart<BallState>({
  type: 'rollBall',
  outputs: ['riding', 'hits', 'broke', 'inArea', 'speed'],
  init(ctx) {
    const home = pVec(ctx.spec, 'home');
    const R = pNum(ctx.spec, 'radius', 0.55);
    ctx.setInteractable({ min: [home[0] - R, home[1] - R, home[2] - R], max: [home[0] + R, home[1] + R, home[2] + R] }, 2.4);
    return { pos: [...home], vel: [0, 0, 0], rider: '', hits: 0, broke: 0, cool: 0, inArea: 0, air: 0 };
  },
  step(s, ctx) {
    const R = pNum(ctx.spec, 'radius', 0.55);
    const mode = pStr(ctx.spec, 'mode', 'on');
    const w = worldOf(ctx);
    const bounds = ctx.spec.params.bounds as { x0: number; z0: number; x1: number; z1: number };
    const pos = s.pos as Vec3, vel = s.vel as Vec3;
    let rider = s.rider ? ctx.players.find((p) => p.id === s.rider) : undefined;
    if (s.rider && (!rider || rider.ride !== ctx.id)) { s.rider = ''; rider = undefined; }
    // 乗る
    const who = ctx.interactedBy();
    if (!s.rider && who && !who.ride) { s.rider = who.id; who.ride = ctx.id; rider = who; ctx.cue('ball.board', [pos[0], pos[1], pos[2]]); }
    // 操作の向きへ加速・転がり抵抗
    if (rider) {
      const d = inputDir(rider);
      const acc = pNum(ctx.spec, 'accel', 4);
      vel[0] += d[0] * acc * ctx.dt; vel[2] += d[1] * acc * ctx.dt;
    }
    const fr = Math.exp(-pNum(ctx.spec, 'friction', 0.6) * ctx.dt);
    vel[0] *= fr; vel[2] *= fr;
    const vmax = pNum(ctx.spec, 'vmax', 5);
    const hs = Math.hypot(vel[0], vel[2]);
    if (hs > vmax) { vel[0] *= vmax / hs; vel[2] *= vmax / hs; }
    // 坂: 足場の高さの傾きで下りへ加速
    const bottom = pos[1] - R;
    const g0 = groundAt(w, pos[0], pos[2], bottom);
    if (g0 > -Infinity && bottom - g0 < 0.05) {
      const e = 0.12;
      const gx = (groundAt(w, pos[0] + e, pos[2], bottom) - groundAt(w, pos[0] - e, pos[2], bottom)) / (2 * e);
      const gz = (groundAt(w, pos[0], pos[2] + e, bottom) - groundAt(w, pos[0], pos[2] - e, bottom)) / (2 * e);
      if (Number.isFinite(gx) && Math.abs(gx) < 2) vel[0] -= 9.8 * gx * 0.7 * ctx.dt;
      if (Number.isFinite(gz) && Math.abs(gz) < 2) vel[2] -= 9.8 * gz * 0.7 * ctx.dt;
    }
    // 動かす（横）
    pos[0] += vel[0] * ctx.dt; pos[2] += vel[2] * ctx.dt;
    // 壁: 球の高さに掛かる箱（足元の 0.25 m より上）と、動ける範囲
    let impact = 0, thinHit = false;
    const thin = ctx.spec.params.thin as unknown as AABB | undefined;
    for (const b of w.boxes) {
      if (b.max[1] <= pos[1] - R + 0.25 || b.min[1] >= pos[1] + R) continue;
      const cx = clamp(pos[0], b.min[0], b.max[0]), cz = clamp(pos[2], b.min[2], b.max[2]);
      const dx = pos[0] - cx, dz = pos[2] - cz;
      const d = Math.hypot(dx, dz);
      if (d >= R || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d;
      pos[0] += nx * (R - d); pos[2] += nz * (R - d);
      const vn = vel[0] * nx + vel[2] * nz;
      if (vn < 0) {
        const bounce = mode === 'in' ? 0.8 : 0.3;
        vel[0] -= (1 + bounce) * vn * nx; vel[2] -= (1 + bounce) * vn * nz;
        impact = Math.max(impact, -vn);
        if (thin && cx >= thin.min[0] - 0.05 && cx <= thin.max[0] + 0.05 && cz >= thin.min[2] - 0.05 && cz <= thin.max[2] + 0.05 && -vn > pNum(ctx.spec, 'hitSpeed', 1.5)) thinHit = true;
      }
    }
    if (bounds) {
      for (const [ax, lo, hi] of [[0, bounds.x0 + R, bounds.x1 - R], [2, bounds.z0 + R, bounds.z1 - R]] as const) {
        if (pos[ax] < lo) { pos[ax] = lo; if (vel[ax] < 0) { impact = Math.max(impact, -vel[ax]); vel[ax] = -vel[ax] * (mode === 'in' ? 0.8 : 0.3); } }
        if (pos[ax] > hi) { pos[ax] = hi; if (vel[ax] > 0) { impact = Math.max(impact, vel[ax]); vel[ax] = -vel[ax] * (mode === 'in' ? 0.8 : 0.3); } }
      }
    }
    // 縦: 足場に乗る・落ちる
    const g = groundAt(w, pos[0], pos[2], pos[1] - R);
    if (g === -Infinity || pos[1] - R > g + 0.02) { vel[1] -= 9.8 * ctx.dt; pos[1] = Math.max(g === -Infinity ? pos[1] + vel[1] * ctx.dt : g + R, pos[1] + vel[1] * ctx.dt); s.air += ctx.dt; }
    else { pos[1] = g + R; vel[1] = 0; s.air = 0; }
    // 壁の割れやすい所に速くぶつかった（バブル）
    s.cool = Math.max(0, s.cool - ctx.dt);
    if (thinHit && rider && s.cool <= 0 && !s.broke) {
      s.hits++;
      s.cool = 0.5;
      ctx.cue('ball.crack', [pos[0], pos[1], pos[2]], { hits: s.hits });
      if (s.hits >= pNum(ctx.spec, 'hitsNeed', 3)) { s.broke = 1; ctx.cue('ball.break', [pos[0], pos[1], pos[2]]); }
    } else if (impact > 1.2) ctx.cue('ball.bump', [pos[0], pos[1], pos[2]], { speed: impact });
    // 乗っている人: 球の上（玉乗り）・球の中（バブル）
    if (rider) {
      rider.pos = mode === 'in' ? [pos[0], pos[1] - R + 0.06, pos[2]] : [pos[0], pos[1] + R, pos[2]];
      rider.vel = [vel[0], vel[1], vel[2]];
      rider.onGround = false;
      // 降りる（跳ぶ）・玉乗りで速くぶつかると振り落とされる
      const thrown = mode === 'on' && impact > pNum(ctx.spec, 'throwSpeed', 2.4);
      if (rider.input.jump || thrown) {
        rider.ride = null;
        rider.vel = [vel[0] * 0.5, thrown ? 2.2 : 3.0, vel[2] * 0.5];
        if (mode === 'in') rider.pos = [pos[0], pos[1] - R + 0.06, pos[2]];
        ctx.cue(thrown ? 'ball.thrown' : 'ball.off', [pos[0], pos[1], pos[2]]);
        s.rider = '';
        rider = undefined;
      }
    }
    // 乗っていない人に当たる: 人を押し出し、球は押された向きへ
    for (const p of ctx.players) {
      if (p.id === s.rider || p.ride) continue;
      if (p.pos[1] > pos[1] + R - 0.1 || p.pos[1] + playerHeight(p) < pos[1] - R) continue;
      const dx = p.pos[0] - pos[0], dz = p.pos[2] - pos[2];
      const d = Math.hypot(dx, dz), m = R + playerRadius(p);
      if (d >= m || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d;
      p.pos = [pos[0] + nx * m, p.pos[1], pos[2] + nz * m];
      const pv = -(p.vel[0] * nx + p.vel[2] * nz);
      if (pv > 0) { vel[0] -= nx * pv * 0.8; vel[2] -= nz * pv * 0.8; }
    }
    // 乗って area に入った
    const area = ctx.spec.params.area as unknown as AABB | undefined;
    if (area && rider && pos[0] > area.min[0] && pos[0] < area.max[0] && pos[2] > area.min[2] && pos[2] < area.max[2] && pos[1] - R < area.max[1] && !s.inArea) { s.inArea = 1; ctx.cue('ball.area', [pos[0], pos[1], pos[2]]); }
    ctx.setInteractable({ min: [pos[0] - R, pos[1] - R, pos[2] - R], max: [pos[0] + R, pos[1] + R, pos[2] + R] }, 2.4);
    s.pos = pos; s.vel = vel;
    ctx.output('riding', s.rider ? 1 : 0);
    ctx.output('hits', s.hits);
    ctx.output('broke', s.broke);
    ctx.output('inArea', s.inArea);
    ctx.output('speed', Math.hypot(vel[0], vel[2]));
  },
});
