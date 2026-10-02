/**
 * 移動と身体の部品: 回る・動く床と壁。
 * - spinFloor: 回る床（円盤）。上に立つと円盤と一緒に回される（位置をそのまま回す）。円盤の上の柱（posts）も一緒に回り、
 *     立っている人を押す。縁（rimR より外）に rimSec 秒乗り続けると done（出現型の隠し）
 * - revolvingDoor: 回転扉（4 枚の羽）。羽は当たり判定の箱ではなく、羽の間（4 つの区切り）に人を閉じ込める制約で表す。
 *     羽を押すと扉が回り（走ると速く）、手を離しても勢いでしばらく回り続ける（後ろの羽に押される）
 * - pushBlock: 押せる壁。面に体を付けて押し続けると、押した向きへゆっくり動く（travel m まで。反対の面から押せば反対へ）
 * - tiltDeck: 傾いていく床（面 SupportSurface）。上に人がいる間、だんだん傾き（rate 度 / 秒で maxDeg まで）、人を低い側へ押す。
 *     床の上の家具（items）は傾きが滑り出す角度を越えると低い側の壁まで滑る。人がいなくなると床はゆっくり戻る（家具は戻らない）
 */
import type { AABB } from '../../../math/aabb.ts';
import { clamp, type Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, pVec, type PartContext } from '../../part.ts';
import { bodyAabb, playerHeight, playerRadius } from '../../player.ts';
import type { PlayerState } from '../../types.ts';

/** 操作の向き（世界の座標の水平の向き。長さは操作の大きさ） */
export function inputDir(p: PlayerState): [number, number] {
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  return [-s * p.input.y + c * p.input.x, -c * p.input.y - s * p.input.x];
}

// ---------------------------------------------------------------- 回る床
interface TurnState { angle: number; rim: { [player: string]: number }; done: number; [k: string]: Json | undefined }

definePart<TurnState>({
  type: 'spinFloor',
  outputs: ['angle', 'done', 'rim'],
  init(ctx) {
    setPosts(ctx, 0);
    return { angle: 0, rim: {}, done: 0 };
  },
  step(s, ctx) {
    const c = pVec(ctx.spec, 'center');
    const R = pNum(ctx.spec, 'radius', 2.5), w = pNum(ctx.spec, 'omega', 0.4);
    const da = w * ctx.dt;
    s.angle = (s.angle + da) % (Math.PI * 2);
    const cs = Math.cos(da), sn = Math.sin(da);
    const rimR = pNum(ctx.spec, 'rimR', R * 0.75), rimSec = pNum(ctx.spec, 'rimSec', 8);
    let rimK = 0;
    for (const p of ctx.players) {
      const dx = p.pos[0] - c[0], dz = p.pos[2] - c[2];
      const d = Math.hypot(dx, dz);
      const on = p.onGround && Math.abs(p.pos[1] - c[1]) < 0.12 && d < R;
      if (on) {
        p.pos = [c[0] + dx * cs + dz * sn, p.pos[1], c[2] - dx * sn + dz * cs];
        s.rim[p.id] = d > rimR ? (s.rim[p.id] ?? 0) + ctx.dt : 0;
      } else if (!p.onGround && d < R + 0.3) {
        // 跳んだだけでは途切れない（宙にいる間は数えない）
      } else s.rim[p.id] = 0;
      rimK = Math.max(rimK, (s.rim[p.id] ?? 0) / rimSec);
      if (!s.done && (s.rim[p.id] ?? 0) >= rimSec) { s.done = 1; ctx.cue('turntable.rim', [c[0], c[1] + 1, c[2]]); }
    }
    setPosts(ctx, s.angle);
    ctx.output('angle', s.angle);
    ctx.output('done', s.done);
    ctx.output('rim', Math.min(1, rimK));
  },
});

/** 円盤の上の柱の位置（円盤の角度 θ）。posts は [r, a0, half, height] の並び */
export function turntablePost(c: Readonly<Vec3>, post: readonly number[], th: number): AABB {
  const [r, a0, h, ht] = post as [number, number, number, number];
  const x = c[0] + r * Math.cos(a0 - th), z = c[2] + r * Math.sin(a0 - th);
  return { min: [x - h, c[1], z - h], max: [x + h, c[1] + ht, z + h] };
}

function setPosts(ctx: PartContext, th: number): void {
  const c = pVec(ctx.spec, 'center');
  const posts = (ctx.spec.params.posts as number[][] | undefined) ?? [];
  posts.forEach((p, i) => ctx.setCollider(`post${i}`, turntablePost(c, p, th)));
}

// ---------------------------------------------------------------- 回転扉
interface RevState { angle: number; w: number; [k: string]: Json | undefined }

const TAU = Math.PI * 2, Q = Math.PI / 2;
const wrap = (a: number): number => ((a % TAU) + TAU) % TAU;

definePart<RevState>({
  type: 'revolvingDoor',
  outputs: ['angle', 'speed'],
  init: (ctx) => ({ angle: pNum(ctx.spec, 'angle0', Math.PI / 4), w: 0 }),
  step(s, ctx) {
    const c = pVec(ctx.spec, 'center');
    const Rd = pNum(ctx.spec, 'radius', 1.6);
    const share = pNum(ctx.spec, 'share', 0.55);
    const walkW = pNum(ctx.spec, 'walkW', 1.3), runW = pNum(ctx.spec, 'runW', 2.8);
    s.angle = wrap(s.angle + s.w * ctx.dt);
    s.w *= Math.exp(-pNum(ctx.spec, 'damp', 0.9) * ctx.dt);
    if (Math.abs(s.w) < 0.01) s.w = 0;
    for (const p of ctx.players) {
      let dx = p.pos[0] - c[0], dz = p.pos[2] - c[2];
      let rho = Math.hypot(dx, dz);
      if (rho > Rd + 0.25 || p.pos[1] < c[1] - 0.5 || p.pos[1] > c[1] + pNum(ctx.spec, 'height', 2.4)) continue;
      const r = playerRadius(p) + 0.04;
      // 真ん中（羽の付け根）には入れない: 区切りの角（90°）に体が収まる所まで外へ
      const rhoMin = r / Math.sin((40 * Math.PI) / 180);
      if (rho < rhoMin) {
        const k = rho > 1e-4 ? rhoMin / rho : 1;
        dx = rho > 1e-4 ? dx * k : rhoMin; dz = rho > 1e-4 ? dz * k : 0;
        rho = rhoMin;
      }
      const m = Math.asin(Math.min(0.99, r / rho));
      let phi = Math.atan2(dz, dx);
      const rel = wrap(phi - s.angle);
      const q = Math.floor(rel / Q);
      const off = rel - q * Q;
      let pen = 0;
      if (off < m) pen = m - off; // 角度の小さい側の羽に当たる（扉は負の向きへ）
      else if (Q - off < m) pen = -(m - (Q - off)); // 大きい側の羽（扉は正の向きへ）
      if (pen !== 0) {
        const dth = -pen * share;
        s.angle = wrap(s.angle + dth);
        phi += pen * (1 - share);
        // 押した分だけ扉が速くなる（歩く・走るで上限が違う）。勢いで回っている扉を押して止めることもできる
        const cap = p.input.dash ? runW : walkW;
        const nw = s.w + (dth / ctx.dt) * 0.5;
        s.w = Math.abs(nw) > cap && Math.abs(nw) > Math.abs(s.w) ? Math.sign(nw) * Math.max(cap, Math.abs(s.w)) : nw;
      }
      if (pen !== 0 || rho !== Math.hypot(p.pos[0] - c[0], p.pos[2] - c[2])) p.pos = [c[0] + rho * Math.cos(phi), p.pos[1], c[2] + rho * Math.sin(phi)];
    }
    if (Math.abs(s.w) > pNum(ctx.spec, 'runW', 2.8) * 0.8 && ctx.tick % 30 === 0) ctx.cue('revolve.whirl', [c[0], c[1] + 1.2, c[2]]);
    ctx.output('angle', s.angle);
    ctx.output('speed', s.w);
  },
});

// ---------------------------------------------------------------- 押せる壁
interface PushState { off: number; moving: number; [k: string]: Json | undefined }

/** 押せる壁の今の箱（off は世界の座標の軸 axis に沿ったずれ） */
export function pushBlockBox(spec: { params: { [k: string]: Json } }, off: number): AABB {
  const b = spec.params.box as unknown as AABB;
  const ax = Number(spec.params.axis ?? 0);
  const min: Vec3 = [b.min[0], b.min[1], b.min[2]], max: Vec3 = [b.max[0], b.max[1], b.max[2]];
  min[ax] += off; max[ax] += off;
  return { min, max };
}

definePart<PushState>({
  type: 'pushBlock',
  outputs: ['off', 'moving', 'done'],
  init(ctx) {
    ctx.setCollider('block', pAabb(ctx.spec, 'box'));
    return { off: 0, moving: 0 };
  },
  step(s, ctx) {
    const ax = pNum(ctx.spec, 'axis', 0) as 0 | 2;
    const la = ax === 0 ? 2 : 0;
    const travel = pNum(ctx.spec, 'travel', 2), speed = pNum(ctx.spec, 'speed', 0.7);
    const lo = pNum(ctx.spec, 'min', -travel), hi = pNum(ctx.spec, 'max', travel);
    const b = pushBlockBox(ctx.spec, s.off);
    let v = 0;
    for (const p of ctx.players) {
      const pb = bodyAabb(p);
      if (!(pb.min[la] < b.max[la] - 0.12 && pb.max[la] > b.min[la] + 0.12)) continue;
      if (!(p.pos[1] < b.max[1] - 0.3 && p.pos[1] + playerHeight(p) > b.min[1] + 0.05)) continue;
      const dir = inputDir(p);
      const a = ax === 0 ? dir[0] : dir[1];
      if (Math.abs(pb.max[ax] - b.min[ax]) < 0.08 && a > 0.3) v = speed * Math.min(1, a);
      else if (Math.abs(pb.min[ax] - b.max[ax]) < 0.08 && a < -0.3) v = -speed * Math.min(1, -a);
    }
    const prev = s.off;
    s.off = clamp(s.off + v * ctx.dt, lo, hi);
    const moving = Math.abs(s.off - prev) > 1e-6 ? 1 : 0;
    if (moving && !s.moving) ctx.cue('push.start', pushCenter(ctx, s.off));
    if (!moving && s.moving && (s.off <= lo + 1e-6 || s.off >= hi - 1e-6)) ctx.cue('push.end', pushCenter(ctx, s.off));
    s.moving = moving;
    if (moving) ctx.setCollider('block', pushBlockBox(ctx.spec, s.off));
    ctx.output('off', s.off);
    ctx.output('moving', moving);
    ctx.output('done', s.off <= lo + 1e-6 || s.off >= hi - 1e-6 ? 1 : 0);
  },
});

function pushCenter(ctx: PartContext, off: number): Vec3 {
  const b = pushBlockBox(ctx.spec, off);
  return [(b.min[0] + b.max[0]) / 2, b.min[1] + 1, (b.min[2] + b.max[2]) / 2];
}

// ---------------------------------------------------------------- 傾いていく床
interface TiltState { roll: number; off: number[]; vel: number[]; [k: string]: Json | undefined }

/** 傾いた床の面の高さの差（軸からの距離 d、傾き roll 度。正の roll は軸の正の側が下がる） */
export const tiltDrop = (d: number, roll: number): number => -Math.tan((roll * Math.PI) / 180) * d;

/** 床の上の家具 i の今の箱（ずれ off は低い側への距離） */
export function tiltItemBox(spec: { params: { [k: string]: Json } }, i: number, off: number, roll: number): AABB {
  const it = (spec.params.items as unknown as AABB[])[i]!;
  const alongX = Number(spec.params.axis ?? 0) === 0;
  const r = spec.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const down = Number(spec.params.down ?? 1);
  const ca = alongX ? 2 : 0;
  const axisC = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
  const min: Vec3 = [it.min[0], it.min[1], it.min[2]], max: Vec3 = [it.max[0], it.max[1], it.max[2]];
  min[ca] += off * down; max[ca] += off * down;
  const d = (min[ca] + max[ca]) / 2 - axisC;
  const dy = tiltDrop(d, roll);
  min[1] += dy; max[1] += dy;
  return { min, max };
}

definePart<TiltState>({
  type: 'tiltDeck',
  outputs: ['roll', 'sliding'],
  init(ctx) {
    const items = (ctx.spec.params.items as unknown as AABB[] | undefined) ?? [];
    setTilt(ctx, 0);
    items.forEach((_, i) => ctx.setCollider(`item${i}`, tiltItemBox(ctx.spec, i, 0, 0)));
    return { roll: 0, off: items.map(() => 0), vel: items.map(() => 0) };
  },
  step(s, ctx) {
    const id = `${ctx.id}:deck`;
    const maxDeg = pNum(ctx.spec, 'maxDeg', 12), rate = pNum(ctx.spec, 'rate', 1.2);
    const down = pNum(ctx.spec, 'down', 1);
    const on = ctx.players.some((p) => p.surfaceId === id);
    const target = on ? maxDeg * down : 0;
    s.roll += clamp(target - s.roll, -rate * (on ? 1 : 0.5) * ctx.dt, rate * (on ? 1 : 0.5) * ctx.dt);
    setTilt(ctx, s.roll);
    const a = (Math.abs(s.roll) * Math.PI) / 180;
    const alongX = pNum(ctx.spec, 'axis', 0) === 0;
    const push = pNum(ctx.spec, 'push', 0.35);
    const sd = Math.sign(s.roll);
    for (const p of ctx.players) {
      if (p.surfaceId !== id) continue;
      const v = Math.sin(a) * 9.8 * push * sd;
      p.carry = alongX ? [p.carry[0], p.carry[1], p.carry[2] + v] : [p.carry[0] + v, p.carry[1], p.carry[2]];
    }
    // 家具: 滑り出す角度（mu）を越えると低い側へ滑り、低い側の壁（lowEdge）で止まる
    const items = (ctx.spec.params.items as unknown as AABB[] | undefined) ?? [];
    const limits = (ctx.spec.params.limits as number[] | undefined) ?? [];
    const mu = pNum(ctx.spec, 'mu', 0.09);
    let sliding = 0;
    items.forEach((_, i) => {
      const lim = limits[i] ?? 0;
      let off = s.off[i] ?? 0, vel = s.vel[i] ?? 0;
      const drive = Math.sin(a) - mu;
      if (sd === Math.sign(down) && drive > 0 && off < lim) vel = Math.min(2.4, vel + drive * 9.8 * 0.6 * ctx.dt);
      else vel = Math.max(0, vel - 4 * ctx.dt);
      // 人に当たる所までは滑らない（人を壁に挟まない。止まった家具は人が離れるとまた滑る）
      if (vel > 0) {
        const next = tiltItemBox(ctx.spec, i, Math.min(lim, off + vel * ctx.dt), s.roll);
        if (ctx.players.some((p) => { const b = bodyAabb(p); return b.min[0] < next.max[0] + 0.03 && b.max[0] > next.min[0] - 0.03 && b.min[1] < next.max[1] && b.max[1] > next.min[1] && b.min[2] < next.max[2] + 0.03 && b.max[2] > next.min[2] - 0.03; })) vel = 0;
      }
      if (vel > 0) {
        off = Math.min(lim, off + vel * ctx.dt);
        if (off >= lim) { vel = 0; const b = tiltItemBox(ctx.spec, i, off, s.roll); ctx.cue('tilt.thud', [(b.min[0] + b.max[0]) / 2, b.min[1] + 0.3, (b.min[2] + b.max[2]) / 2]); }
        sliding++;
      }
      s.off[i] = off; s.vel[i] = vel;
      ctx.setCollider(`item${i}`, tiltItemBox(ctx.spec, i, off, s.roll));
    });
    ctx.output('roll', s.roll);
    ctx.output('sliding', sliding);
  },
});

/** 床の面: 長い向き（axis 0 = x）を軸に roll 度傾ける。軸は rect の真ん中の線 */
function setTilt(ctx: PartContext, roll: number): void {
  const r = ctx.spec.params.rect as { x0: number; z0: number; x1: number; z1: number };
  const y = pNum(ctx.spec, 'y', 0);
  const alongX = pNum(ctx.spec, 'axis', 0) === 0;
  const a = (roll * Math.PI) / 180;
  const origin: Vec3 = [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2];
  const normal: Vec3 = alongX ? [0, Math.cos(a), Math.sin(a)] : [Math.sin(a), Math.cos(a), 0];
  ctx.setSurface('deck', { id: `${ctx.id}:deck`, rect: { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 }, origin, normal, thickness: 0.6 });
}
