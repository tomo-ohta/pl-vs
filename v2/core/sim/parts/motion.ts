/**
 * 動く部品。kinds が 'ball' の物は球（描画も球）。
 * - mover: 箱が折れ線の経路を動く（往復 pingpong / 周回 loop / 一度 once）。乗っている人を運ぶ。
 *          入力 enable を配線すると入っている間だけ動き、target を配線すると経路上の位置 0..1 へ向かう
 * - tiltFloor: 傾く床。mode 'weight' は立っている位置の方へ傾く（天秤 [QR]。ボタンを使わないのでスマホでも同じ）、
 *          'input' は入力 tiltX / tiltZ（-1..1）、'sway' はゆっくり揺れる。上に載った物は物理で転がる。
 *          プレイヤーは面（SupportSurface）として立つ
 * - propPile: 転がる物（物理の剛体）の山。items で 1 つずつ指定するか、region に count 個を乱数で置く
 */
import { aabbCenter, type AABB } from '../../math/aabb.ts';
import { quatFromTo, type Quat } from '../../math/quat.ts';
import { approach, clamp, type Vec3 } from '../../math/vec.ts';
import type { Json } from '../../world/layout.ts';
import { definePart, pAabb, pBool, pNum, pStr, type PartContext } from '../part.ts';

const ON = 0.5;

// ---------------------------------------------------------------- mover
interface MoverState { t: number; dir: number; pos: number[]; vel: number[]; [k: string]: Json | undefined }

function pathOf(ctx: PartContext): Vec3[] {
  const raw = ctx.spec.params.points;
  const pts: Vec3[] = Array.isArray(raw) ? (raw as number[][]).map((p) => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0]) : [];
  if (pts.length === 0 || pts[0]!.some((v) => v !== 0)) pts.unshift([0, 0, 0]);
  return pts;
}

function pointAt(pts: Vec3[], t: number): Vec3 {
  if (pts.length === 1) return [...pts[0]!];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    seg.push(l);
    total += l;
  }
  let d = clamp(t, 0, 1) * total;
  for (let i = 0; i < seg.length; i++) {
    const l = seg[i]!;
    if (d <= l || i === seg.length - 1) {
      const a = pts[i]!, b = pts[i + 1]!;
      const k = l > 1e-9 ? clamp(d / l, 0, 1) : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
    d -= l;
  }
  return [...pts[pts.length - 1]!];
}

function pathLength(pts: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1], pts[i]![2] - pts[i - 1]![2]);
  return total;
}

function moved(b: AABB, d: number[]): AABB {
  return { min: [b.min[0] + d[0]!, b.min[1] + d[1]!, b.min[2] + d[2]!], max: [b.max[0] + d[0]!, b.max[1] + d[1]!, b.max[2] + d[2]!] };
}

definePart<MoverState>({
  type: 'mover',
  outputs: ['t', 'moving'],
  inputs: ['enable', 'target'],
  init(ctx) {
    const pts = pathOf(ctx);
    const t = pNum(ctx.spec, 'startT', 0);
    const pos = pointAt(pts, t);
    if (pBool(ctx.spec, 'solid', true)) ctx.setCollider('box', moved(pAabb(ctx.spec, 'box'), pos));
    return { t, dir: 1, pos, vel: [0, 0, 0] };
  },
  step(s, ctx) {
    const pts = pathOf(ctx);
    const len = Math.max(1e-6, pathLength(pts));
    const speed = pNum(ctx.spec, 'speed', 1);
    const mode = pStr(ctx.spec, 'mode', 'pingpong');
    const enabled = ctx.wired('enable') ? ctx.input('enable') > ON : true;
    const prevT = s.t;
    if (ctx.wired('target')) {
      s.t = approach(s.t, clamp(ctx.input('target'), 0, 1), (speed * ctx.dt) / len);
    } else if (enabled) {
      s.t += (s.dir * speed * ctx.dt) / len;
      if (mode === 'loop') s.t -= Math.floor(s.t);
      else if (mode === 'once') s.t = Math.min(1, s.t);
      else if (s.t > 1) { s.t = 2 - s.t; s.dir = -1; }
      else if (s.t < 0) { s.t = -s.t; s.dir = 1; }
    }
    const box = pAabb(ctx.spec, 'box');
    const prev = s.pos;
    const pos = pointAt(pts, s.t);
    s.vel = [(pos[0] - prev[0]!) / ctx.dt, (pos[1] - prev[1]!) / ctx.dt, (pos[2] - prev[2]!) / ctx.dt];
    s.pos = pos;
    const now = moved(box, pos);
    if (pBool(ctx.spec, 'solid', true)) ctx.setCollider('box', now);
    // 乗っている人を運ぶ（上面に立っている）
    if (pBool(ctx.spec, 'carry', true)) {
      for (const p of ctx.players) {
        const onTop = p.onGround && Math.abs(p.pos[1] - (now.max[1] - (pos[1] - prev[1]!))) < 0.08 &&
          p.pos[0] > now.min[0] - 0.2 && p.pos[0] < now.max[0] + 0.2 && p.pos[2] > now.min[2] - 0.2 && p.pos[2] < now.max[2] + 0.2;
        if (onTop) p.carry = [s.vel[0]!, Math.max(0, s.vel[1]!), s.vel[2]!];
      }
    }
    ctx.output('t', s.t);
    ctx.output('moving', s.t !== prevT ? 1 : 0);
  },
});

// ---------------------------------------------------------------- tiltFloor
interface TiltState { gx: number; gz: number; handle: number; normal: number[]; rot: number[]; center: number[]; [k: string]: Json | undefined }

function rectOf(ctx: PartContext): { x0: number; z0: number; x1: number; z1: number } {
  const r = ctx.spec.params.rect as { [k: string]: Json } | undefined;
  if (!r) throw new Error(`${ctx.id}: params.rect（{ x0, z0, x1, z1 }）が要ります`);
  const x0 = r.x0 as number, z0 = r.z0 as number, x1 = r.x1 as number, z1 = r.z1 as number;
  return { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) };
}

/** プレイヤーが立てる範囲（params.walkRect。無ければ板と同じ）。板と穴の壁の隙間から落ちないよう、壁まで広げる */
function walkRect(ctx: PartContext, plate: { x0: number; z0: number; x1: number; z1: number }): { x0: number; z0: number; x1: number; z1: number } {
  const w = ctx.spec.params.walkRect as { [k: string]: Json } | undefined;
  return w ? { x0: w.x0 as number, z0: w.z0 as number, x1: w.x1 as number, z1: w.z1 as number } : plate;
}

/** 傾き (gx, gz)（低い側へ向かう角度）から、面の法線と剛体の中心 */
function tiltPose(top: Vec3, gx: number, gz: number, thickness: number): { normal: Vec3; rot: Quat; center: Vec3 } {
  const n0: Vec3 = [Math.tan(gx), 1, Math.tan(gz)];
  const l = Math.hypot(n0[0], n0[1], n0[2]);
  const normal: Vec3 = [n0[0] / l, n0[1] / l, n0[2] / l];
  const rot = quatFromTo([0, 1, 0], normal);
  const center: Vec3 = [top[0] - (normal[0] * thickness) / 2, top[1] - (normal[1] * thickness) / 2, top[2] - (normal[2] * thickness) / 2];
  return { normal, rot, center };
}

definePart<TiltState>({
  type: 'tiltFloor',
  physics: true,
  outputs: ['tilt', 'gx', 'gz', 'occupied'],
  inputs: ['tiltX', 'tiltZ', 'enable'],
  init(ctx) {
    const r = rectOf(ctx);
    const y = pNum(ctx.spec, 'y', 0);
    const th = pNum(ctx.spec, 'thickness', 0.2);
    const top: Vec3 = [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2];
    const pose = tiltPose(top, 0, 0, th);
    const handle = ctx.physics!.addKinematicBox(pose.center, [(r.x1 - r.x0) / 2, th / 2, (r.z1 - r.z0) / 2], pNum(ctx.spec, 'friction', 0.5));
    ctx.setSurface('top', { id: `${ctx.id}:top`, rect: walkRect(ctx, r), origin: top, normal: pose.normal });
    return { gx: 0, gz: 0, handle, normal: pose.normal, rot: pose.rot, center: pose.center };
  },
  step(s, ctx) {
    const r = rectOf(ctx);
    const y = pNum(ctx.spec, 'y', 0);
    const th = pNum(ctx.spec, 'thickness', 0.2);
    const max = (pNum(ctx.spec, 'maxDeg', 10) * Math.PI) / 180;
    const rate = (pNum(ctx.spec, 'rateDeg', 8) * Math.PI) / 180;
    const back = (pNum(ctx.spec, 'returnDeg', 3) * Math.PI) / 180;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const hw = (r.x1 - r.x0) / 2, hd = (r.z1 - r.z0) / 2;
    const mode = pStr(ctx.spec, 'mode', 'weight');
    const enabled = ctx.wired('enable') ? ctx.input('enable') > ON : true;
    let tx = 0, tz = 0, occupied = false, speed = back;
    if (enabled && mode === 'input') {
      tx = clamp(ctx.input('tiltX'), -1, 1) * max;
      tz = clamp(ctx.input('tiltZ'), -1, 1) * max;
      speed = rate;
    } else if (enabled && mode === 'sway') {
      const ph = (ctx.time / pNum(ctx.spec, 'swayPeriod', 9)) * Math.PI * 2;
      tx = Math.sin(ph) * max;
      tz = Math.sin(ph * 0.73 + 1.3) * max * 0.6;
      speed = rate;
    } else if (enabled) {
      // 立っている人の位置の方へ傾く（中心からのずれ ÷ 半分の寸法）
      for (const p of ctx.players) {
        if (p.surfaceId !== `${ctx.id}:top`) continue;
        occupied = true;
        tx += clamp((p.pos[0] - cx) / hw, -1, 1) * max;
        tz += clamp((p.pos[2] - cz) / hd, -1, 1) * max;
        speed = rate;
      }
      tx = clamp(tx, -max, max);
      tz = clamp(tz, -max, max);
    }
    s.gx = approach(s.gx, tx, speed * ctx.dt);
    s.gz = approach(s.gz, tz, speed * ctx.dt);
    const top: Vec3 = [cx, y, cz];
    const pose = tiltPose(top, s.gx, s.gz, th);
    s.normal = pose.normal;
    s.rot = pose.rot;
    s.center = pose.center;
    ctx.physics!.setKinematicPose(s.handle, pose.center, pose.rot);
    ctx.setSurface('top', { id: `${ctx.id}:top`, rect: walkRect(ctx, r), origin: top, normal: pose.normal });
    ctx.output('gx', s.gx);
    ctx.output('gz', s.gz);
    ctx.output('tilt', Math.hypot(s.gx, s.gz) / Math.max(1e-6, max));
    ctx.output('occupied', occupied ? 1 : 0);
  },
});

// ---------------------------------------------------------------- propPile
interface PileState { handles: number[]; half: number[]; mats: string[]; kinds: string[]; poses: number[]; ball: boolean; [k: string]: Json | undefined }

definePart<PileState>({
  type: 'propPile',
  physics: true,
  outputs: ['count', 'awake'],
  init(ctx) {
    const phys = ctx.physics!;
    const st: PileState = { handles: [], half: [], mats: [], kinds: [], poses: [], ball: pBool(ctx.spec, 'ball', false) };
    const density = pNum(ctx.spec, 'density', 250);
    const friction = pNum(ctx.spec, 'friction', 0.55);
    const restitution = pNum(ctx.spec, 'restitution', 0.05);
    const add = (center: Vec3, half: Vec3, mat: string, kind: string, yaw: number, ball = st.ball): void => {
      const rot: Quat = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
      // 球は転がり続けないよう回転の減衰を強める（転がり抵抗の代わり）
      const h = phys.addDynamicBox(center, half, { density, friction, restitution, rotation: rot, ball, linearDamping: ball ? 0.25 : 0.05, angularDamping: ball ? pNum(ctx.spec, 'rollDamping', 1.2) : 0.2 });
      st.handles.push(h);
      st.half.push(...half);
      st.mats.push(mat);
      st.kinds.push(kind);
      st.poses.push(...center, ...rot);
    };
    const items = ctx.spec.params.items;
    if (Array.isArray(items)) {
      for (const it of items as { [k: string]: Json }[]) {
        const a = { min: it.min as number[], max: it.max as number[] };
        const c = aabbCenter({ min: [a.min[0]!, a.min[1]!, a.min[2]!], max: [a.max[0]!, a.max[1]!, a.max[2]!] });
        add(c, [(a.max[0]! - a.min[0]!) / 2, (a.max[1]! - a.min[1]!) / 2, (a.max[2]! - a.min[2]!) / 2], String(it.mat ?? 'boxCardboard'), String(it.kind ?? 'box'), typeof it.yaw === 'number' ? it.yaw : 0);
      }
    } else {
      const region = pAabb(ctx.spec, 'region');
      const count = Math.round(pNum(ctx.spec, 'count', 20));
      const size = (ctx.spec.params.size as number[] | undefined) ?? [0.25, 0.45];
      const mats = (ctx.spec.params.mats as string[] | undefined) ?? ['boxCardboard'];
      const rng = ctx.rng();
      const ballRatio = pNum(ctx.spec, 'ballRatio', st.ball ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const ball = rng.next() < ballRatio;
        const sx = rng.float(size[0]!, size[1]!), sy = rng.float(size[0]!, size[1]!) * (ball ? 1 : rng.float(0.6, 1)), sz = ball ? sx : rng.float(size[0]!, size[1]!);
        const half: Vec3 = ball ? [sx / 2, sx / 2, sx / 2] : [sx / 2, sy / 2, sz / 2];
        const x = rng.float(region.min[0] + half[0], region.max[0] - half[0]);
        const z = rng.float(region.min[2] + half[2], region.max[2] - half[2]);
        // 積み上げる: 2 段まで（高く積むと崩れて、転がる物が床から落ちる）。重なりは物理が解く
        const layers = Math.max(1, Math.round(pNum(ctx.spec, 'layers', 2)));
        const yy = region.min[1] + half[1] + (i % layers) * (half[1] * 2 + 0.02);
        add([x, Math.min(yy, region.max[1] - half[1]), z], half, rng.pick(mats), ball ? 'ball' : pStr(ctx.spec, 'kind', 'box'), rng.float(0, Math.PI), ball);
      }
    }
    return st;
  },
  post(s, ctx) {
    let awake = 0;
    for (let i = 0; i < s.handles.length; i++) {
      const pose = ctx.physics!.pose(s.handles[i]!);
      if (!pose) continue;
      const o = i * 7;
      s.poses[o] = pose.pos[0]; s.poses[o + 1] = pose.pos[1]; s.poses[o + 2] = pose.pos[2];
      s.poses[o + 3] = pose.rot[0]; s.poses[o + 4] = pose.rot[1]; s.poses[o + 5] = pose.rot[2]; s.poses[o + 6] = pose.rot[3];
      if (!ctx.physics!.isSleeping(s.handles[i]!)) awake++;
    }
    ctx.output('count', s.handles.length);
    ctx.output('awake', awake);
  },
});
