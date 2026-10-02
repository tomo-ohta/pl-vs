/**
 * 仕掛けのための部品（段階 3。gimmicks-and-structures.md 2 章）。
 * - crumbleTile: 乗ると揺れて落ちる床板（standSec 秒で揺れ始め、shakeSec 秒で落ちる。respawnSec 秒で戻る）[QR][WS]
 * - bouncePad: 乗ると跳ね上げる床（speed m/s 上向き）[QR][WS]
 * - soundBeacon: period 秒ごとに位置のある音を鳴らす（Cue 'beacon'。音はクライアント）[WS 音の道しるべ]
 * - guideLight: 経路に沿って先導する光。プレイヤーが離れると待ち、近づくと進む。終点で止まる [QR 霧の誘導灯][WS 灯りを追って]
 *     follow 'path' なら離れ具合を経路に沿って測り、経路から onPath m より外れていても待つ（迷路の仕切り越しに進まない）。
 *     lost（region の中の人が誰もついて来ていない間 1。光が終点に着いた後も）を時間で数えると「光を無視した」ことが分かる
 * - mannequin: 見ている間は止まり、目を離すと近づく。触れたら近くからやり直し（体力は減らさない）[QR 視線のマネキン]
 */
import { aabbCenter } from '../../math/aabb.ts';
import { clamp, dist3, distXZ, type Vec3 } from '../../math/vec.ts';
import type { Json } from '../../world/layout.ts';
import { definePart, pAabb, pBool, pNum, playerIn, pStr, pVec } from '../part.ts';
import { isLooking } from './sensors.ts';

const ON = 0.5;

// ---------------------------------------------------------------- 崩れる床
interface CrumbleState { phase: number; t: number; drop: number; [k: string]: Json | undefined }
/** phase: 0 = ある / 1 = 揺れている / 2 = 落ちた */
definePart<CrumbleState>({
  type: 'crumbleTile',
  outputs: ['fallen', 'shaking'],
  init(ctx) {
    ctx.setCollider('tile', pAabb(ctx.spec, 'box'));
    return { phase: 0, t: 0, drop: 0 };
  },
  step(s, ctx) {
    const b = pAabb(ctx.spec, 'box');
    const top = { min: [b.min[0] - 0.05, b.max[1] - 0.05, b.min[2] - 0.05] as Vec3, max: [b.max[0] + 0.05, b.max[1] + 0.5, b.max[2] + 0.05] as Vec3 };
    const on = ctx.players.some((p) => playerIn(p, top));
    if (s.phase === 0) {
      s.t = on ? s.t + ctx.dt : 0;
      if (s.t >= pNum(ctx.spec, 'standSec', 0.35)) { s.phase = 1; s.t = 0; ctx.cue('crumble.shake', aabbCenter(b)); }
    } else if (s.phase === 1) {
      s.t += ctx.dt;
      if (s.t >= pNum(ctx.spec, 'shakeSec', 0.9)) { s.phase = 2; s.t = 0; ctx.setCollider('tile', null); ctx.cue('crumble.fall', aabbCenter(b)); }
    } else {
      s.t += ctx.dt;
      s.drop += ctx.dt * (2 + s.drop * 4);
      const back = pNum(ctx.spec, 'respawnSec', 8);
      // 戻る: 誰も上にいないとき
      if (back > 0 && s.t >= back && !ctx.players.some((p) => playerIn(p, { min: [b.min[0] - 0.4, b.min[1] - 3, b.min[2] - 0.4], max: [b.max[0] + 0.4, b.max[1] + 2, b.max[2] + 0.4] }))) {
        s.phase = 0; s.t = 0; s.drop = 0;
        ctx.setCollider('tile', b);
        ctx.cue('crumble.back', aabbCenter(b));
      }
    }
    ctx.output('fallen', s.phase === 2 ? 1 : 0);
    ctx.output('shaking', s.phase === 1 ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 弾む床
definePart<{ cool: number }>({
  type: 'bouncePad',
  outputs: ['bounced'],
  init: () => ({ cool: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    let bounced = 0;
    s.cool = Math.max(0, s.cool - ctx.dt);
    for (const p of ctx.players) {
      if (s.cool > 0 || !p.onGround || !playerIn(p, a)) continue;
      p.vel[1] = pNum(ctx.spec, 'speed', 7.2);
      p.onGround = false;
      s.cool = 0.25;
      bounced = 1;
      ctx.cue('bounce', [p.pos[0], p.pos[1], p.pos[2]]);
    }
    ctx.output('bounced', bounced);
  },
});

// ---------------------------------------------------------------- 音の道しるべ
definePart<{ t: number }>({
  type: 'soundBeacon',
  outputs: ['on'],
  inputs: ['enable'],
  init: (ctx) => ({ t: pNum(ctx.spec, 'phase', 0) }),
  step(s, ctx) {
    const on = ctx.wired('enable') ? ctx.input('enable') > ON : true;
    if (on) {
      s.t += ctx.dt;
      const period = pNum(ctx.spec, 'period', 2.6);
      if (s.t >= period) {
        s.t -= period;
        ctx.cue('beacon', pVec(ctx.spec, 'pos'), { kind: pStr(ctx.spec, 'kind', 'chime'), gain: pNum(ctx.spec, 'gain', 0.8) });
      }
    }
    ctx.output('on', on ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 導く光
interface GuideState { d: number; pos: number[]; done: number; [k: string]: Json | undefined }

function polyline(ctx: { spec: { params: { [k: string]: Json } } }): Vec3[] {
  const raw = ctx.spec.params.points;
  return Array.isArray(raw) ? (raw as number[][]).map((p) => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0] as Vec3) : [];
}
function lengthOf(pts: Vec3[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist3(pts[i - 1]!, pts[i]!);
  return l;
}
function at(pts: Vec3[], d: number): Vec3 {
  let left = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const l = dist3(a, b);
    if (left <= l || i === pts.length - 1) {
      const k = l > 1e-9 ? clamp(left / l, 0, 1) : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
    left -= l;
  }
  return pts.length ? [...pts[pts.length - 1]!] : [0, 0, 0];
}

/**
 * 経路の上での位置（始まりからの道のり）: 点 p から横へ onPath m 以内にある区間のうち、いちばん近い区間へ下ろした足の道のり。
 * どの区間からも離れていれば -1（道から外れている。迷路では仕切りの向こうの通路にいる）
 */
function progressOn(pts: Vec3[], p: Vec3, onPath: number): number {
  let best = -1, bestD = onPath;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const ex = b[0] - a[0], ez = b[2] - a[2];
    const l2 = ex * ex + ez * ez;
    const k = l2 > 1e-9 ? clamp(((p[0] - a[0]) * ex + (p[2] - a[2]) * ez) / l2, 0, 1) : 0;
    const d = Math.hypot(a[0] + ex * k - p[0], a[2] + ez * k - p[2]);
    const l = dist3(a, b);
    if (d <= bestD + 1e-6) { bestD = d; best = acc + l * k; }
    acc += l;
  }
  return best;
}

definePart<GuideState>({
  type: 'guideLight',
  outputs: ['progress', 'done', 'waiting', 'lost'],
  init(ctx) {
    const pts = polyline(ctx);
    return { d: 0, pos: at(pts, 0), done: 0 };
  },
  step(s, ctx) {
    const pts = polyline(ctx);
    const total = lengthOf(pts);
    const speed = pNum(ctx.spec, 'speed', 1.3);
    const lead = pNum(ctx.spec, 'lead', 3.5);
    const wait = pNum(ctx.spec, 'waitDist', 6);
    const start = pAabb(ctx.spec, 'startZone');
    // follow 'path'（迷路）: 離れ具合を経路に沿って測る（仕切り越しに近くても、道を外れていれば待つ）。既定は光との直線の距離
    const byPath = pStr(ctx.spec, 'follow', 'near') === 'path';
    const onPath = pNum(ctx.spec, 'onPath', 1.0);
    const near = byPath
      ? ctx.players.reduce((m, p) => { const g = progressOn(pts, p.pos, onPath); return g < 0 ? m : Math.min(m, Math.max(0, s.d - g)); }, Infinity)
      : ctx.players.reduce((m, p) => Math.min(m, distXZ(p.pos, s.pos as Vec3)), Infinity);
    const begun = s.d > 0 || ctx.players.some((p) => playerIn(p, start));
    let waiting = 0;
    if (begun && !s.done) {
      // 先導: 距離 lead を保つ。離れすぎたら待つ
      if (near < lead) s.d = Math.min(total, s.d + speed * ctx.dt);
      else if (near > wait) waiting = 1;
      else s.d = Math.min(total, s.d + speed * 0.35 * ctx.dt);
      if (s.d >= total - 1e-3) { s.done = 1; ctx.cue('guide.arrive', at(pts, total)); }
    }
    s.pos = at(pts, s.d);
    // lost: 動き出した後、区画 region の中にいる人が誰も光について来ていない（道を外れた・waitDist より遅れた）。
    // 光が終点に着いた後も数える（光を無視した時間を数える隠しの元）
    let lost = 0;
    if (begun && ctx.spec.params.region) {
      const region = pAabb(ctx.spec, 'region');
      const inside = ctx.players.filter((p) => playerIn(p, region));
      if (inside.length && inside.every((p) => {
        if (!byPath) return distXZ(p.pos, s.pos as Vec3) > wait;
        const g = progressOn(pts, p.pos, onPath);
        return g < 0 || s.d - g > wait;
      })) lost = 1;
    }
    ctx.output('progress', total > 0 ? s.d / total : 1);
    ctx.output('done', s.done);
    ctx.output('waiting', waiting);
    ctx.output('lost', lost);
  },
});

// ---------------------------------------------------------------- 視線のマネキン
interface MannequinState { pos: number[]; yaw: number; moving: number; caught: number; rest: number; [k: string]: Json | undefined }

definePart<MannequinState>({
  type: 'mannequin',
  outputs: ['moving', 'caught', 'seen'],
  init(ctx) {
    const p = pVec(ctx.spec, 'pos');
    return { pos: p, yaw: pNum(ctx.spec, 'yaw', 0), moving: 0, caught: 0, rest: 0 };
  },
  step(s, ctx) {
    const home = pVec(ctx.spec, 'pos');
    const bounds = pAabb(ctx.spec, 'bounds');
    const pos = s.pos as Vec3;
    const head: Vec3 = [pos[0], pos[1] + 1.5, pos[2]];
    // 見ている = 画面に映っている（視線から viewDeg 度以内。既定 28°、横の画角の半分くらい）
    const seen = ctx.players.some((p) => isLooking(p, head, 0.55, 40, pNum(ctx.spec, 'viewDeg', 28)));
    // 区画の中のプレイヤーだけを追う
    const target = ctx.players.filter((p) => playerIn(p, bounds)).sort((a, b) => distXZ(a.pos, pos) - distXZ(b.pos, pos))[0];
    s.moving = 0;
    // 捕まえた後はしばらく止まる（すぐにまた捕まえない）
    if ((s.rest as number) > 0) s.rest = (s.rest as number) - ctx.dt;
    else if (target && !seen) {
      const dx = target.pos[0] - pos[0], dz = target.pos[2] - pos[2];
      const d = Math.hypot(dx, dz);
      const v = pNum(ctx.spec, 'speed', 2.6) * ctx.dt;
      if (d > 1e-3) {
        pos[0] = clamp(pos[0] + (dx / d) * Math.min(v, d), bounds.min[0] + 0.3, bounds.max[0] - 0.3);
        pos[2] = clamp(pos[2] + (dz / d) * Math.min(v, d), bounds.min[2] + 0.3, bounds.max[2] - 0.3);
        s.yaw = Math.atan2(dx, dz);
        s.moving = 1;
      }
      if (d < pNum(ctx.spec, 'catchRadius', 0.65)) {
        s.caught = (s.caught as number) + 1;
        ctx.cue('mannequin.caught', head);
        ctx.respawn(target);
        s.pos = [...home];
        s.rest = pNum(ctx.spec, 'restSec', 6);
      }
    } else if (!target && pBool(ctx.spec, 'returnHome', true)) {
      // 誰もいなければ、見られていない間に元の位置へ
      const dx = home[0] - pos[0], dz = home[2] - pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.05 && !seen) { pos[0] += (dx / d) * Math.min(d, ctx.dt * 1.5); pos[2] += (dz / d) * Math.min(d, ctx.dt * 1.5); s.moving = 1; }
    }
    ctx.output('moving', s.moving);
    ctx.output('caught', s.caught as number);
    ctx.output('seen', seen ? 1 : 0);
  },
});
