/**
 * ミニゲームの部品（2.15）。どれも 移動・跳ぶ・しゃがむ・走る・調べる・Q だけで遊べる（スマホでも同じ）。
 *
 * - ballHole: 穴（params.holes [[x, y, z, r], …]）。持てる物の球（params.ball）がゆっくり穴の上を通ると落ちる → 出力 h<番号>（入ったまま）・
 *     sunk（落ちた tick だけ 1）・reset（落ちて 1 秒後に 1 tick。球を元の所へ戻す配線）
 * - pinSetter: ボウリングのピン（params.pins の持てる物）。倒れた数 down・全部倒れた all（倒れてから）・reset（全部倒れて 3 秒・
 *     投げて 10 秒で 1 tick）。投げたかは params.balls の flying の立ち上がりで見る
 * - rollBall: 床を転がる球（物理を使わない。円盤の当たり）。体で触れると、その速さで蹴られる。摩擦で止まる。壁で跳ね返る。
 *     止まって params.restSec 秒で元の所（tee）へ戻る（1 打で）。cups [[x, z, r], …] の上をゆっくり通ると入る → 出力 c<番号>（入ったまま）
 * - tagLight: 鬼ごっこする灯り。近づくと逃げる（部屋の中・箱を避ける）。触れると捕まえた数が増え、遠くへ跳ぶ。
 *     じっと（stillSec 秒動かない・灯りを見ない）していると近寄ってきて、触れる → 出力 touched（入ったまま）
 * - seeker: 探しに来る灯り。経路（params.path）を回り、前の扇（viewDeg・viewM）の中で見通せる人を見つけると警報（その回は無効）。
 *     しゃがむと見つかる距離が短い。入口の前（params.safe）では見つからず、そこから見つからずに進む回が clean。
 *     隠れ場所（params.hide）に見つからずに hideSec 秒いると hidden（入ったまま）。出力 caught（数）・seen・clean・hidden
 * - bumper: 丸い柱。柱の方へ向かって触れた人を外へ弾く（speed m/s・上へ up。かすめるだけなら弾かない）
 * - cartRider: 動く台車（params.cart の mover）に乗っている時間と周回（mover の t が 1 周）。出力 riding・laps（降りると 0）
 * - cartTrack: 閉じた折れ線（params.points。坂の上り下りあり）を回る台車。乗っている人を、下り坂でも置いて行かずに運ぶ。
 *     出力 riding・laps（降りずに回った周の数。降りると 0）
 * - throwTarget: 的（params.targets [{ min, max }]）。投げた持てる物の通り道（前の tick → 今）が的を通ると倒れる。
 *     出力 down（数）・all・reset（全部倒れて 3 秒で起きる）
 * - memoryGame: 記憶の部屋の進み。部屋に入ると showSec 秒見せて、照明を消し、物を散らす（出力 scatter に 1 + k）。
 *     受け（params.board の ok）がそろうと照明がつく。部屋を出て 6 秒で物を元に戻して最初から（出力 reset）。
 *     暗い間に物に触れずに patientSec 秒じっとしていると patient（入ったまま）。出力 lights（照明）
 * - shadowPose: 自分の影絵。灯り（params.lamp）と壁（params.wall の面）の間に立つ。marks [{ pos, r, crouch }] のどれかの上で、
 *     その姿勢で sec 秒 → 出力 m<番号>（入ったまま）。出力 all（全部）
 * - ringSensor: 宙の輪（params.rings [{ c, n, r }]）。体の真ん中が輪をくぐると、くぐった順を数える。
 *     1→N の順で forward、N→1 の順で reverse（どちらも入ったまま）。違う輪をくぐると最初から
 */
import type { AABB } from '../../../math/aabb.ts';
import { distXZ, type Vec3 } from '../../../math/vec.ts';
import { definePart, pAabb, pNum, playerIn, pStr } from '../../part.ts';
import { carryIndex, FLY, HELD, segmentBlocked, segmentHitsAabb, type ItemState } from './common.ts';
import { isLooking } from '../sensors.ts';
import type { PlayerState } from '../../types.ts';

// ---------------------------------------------------------------- 穴（転がる球）
interface HoleState { sunk: number[]; t: number; wait: number; [k: string]: number | number[] }

definePart<HoleState>({
  type: 'ballHole',
  outputs: ['h0', 'h1', 'h2', 'h3', 'sunk', 'reset'],
  init: (ctx) => ({ sunk: ((ctx.spec.params.holes as number[][] | undefined) ?? []).map(() => 0), t: 0, wait: 0 }),
  step(s, ctx) {
    const holes = (ctx.spec.params.holes as number[][] | undefined) ?? [];
    const st = ctx.stateOf(pStr(ctx.spec, 'ball', '')) as ItemState | null;
    let sunk = 0, reset = 0;
    if (s.wait > 0) { s.wait -= ctx.dt; if (s.wait <= 0) reset = 1; }
    else if (st && st.mode !== HELD) {
      const v = st.vel ?? [0, 0, 0];
      const sp = Math.hypot(v[0]!, v[2]!);
      holes.forEach((h, i) => {
        if (Math.hypot(st.poses[0]! - h[0]!, st.poses[2]! - h[2]!) > h[3]! || sp > pNum(ctx.spec, 'maxSpeed', 1.6) || Math.abs(st.poses[1]! - h[1]!) > 0.6) return;
        s.sunk[i] = 1;
        sunk = 1;
        s.wait = 1.0;
        ctx.cue('carry.hole', [h[0]!, h[1]!, h[2]!], { hole: i });
      });
    }
    holes.forEach((_h, i) => ctx.output(`h${i}`, s.sunk[i] ?? 0));
    ctx.output('sunk', sunk);
    ctx.output('reset', reset);
  },
});

// ---------------------------------------------------------------- ボウリング
interface PinState { prevFly: number; sinceThrow: number; allT: number; strikeArmed: number; [k: string]: number }

definePart<PinState>({
  type: 'pinSetter',
  outputs: ['down', 'all', 'reset', 'strike'],
  init: () => ({ prevFly: 0, sinceThrow: -1, allT: 0, strikeArmed: 0 }),
  step(s, ctx) {
    const pins = (ctx.spec.params.pins as string[] | undefined) ?? [];
    const balls = (ctx.spec.params.balls as string[] | undefined) ?? [];
    let down = 0;
    for (const id of pins) {
      const st = ctx.stateOf(id) as ItemState | null;
      if (!st) continue;
      // 上向き（局所の y）が 45° より倒れた
      const x = st.poses[3]!, z = st.poses[5]!;
      const upY = 1 - 2 * (x * x + z * z);
      if (upY < 0.7) down++;
    }
    const fly = balls.some((id) => (ctx.stateOf(id) as ItemState | null)?.mode === FLY) ? 1 : 0;
    if (fly && !s.prevFly) { s.sinceThrow = 0; s.strikeArmed = down === 0 ? 1 : 0; }
    s.prevFly = fly;
    if (s.sinceThrow >= 0) s.sinceThrow += ctx.dt;
    let reset = 0, strike = 0;
    const all = pins.length > 0 && down === pins.length;
    if (all) {
      if (s.allT === 0 && s.strikeArmed && s.sinceThrow >= 0 && s.sinceThrow < 6) { strike = 1; ctx.cue('carry.strike'); }
      s.allT += ctx.dt;
    } else s.allT = 0;
    if ((all && s.allT >= 3) || s.sinceThrow >= pNum(ctx.spec, 'resetSec', 10)) { reset = 1; s.allT = 0; s.sinceThrow = -1; s.strikeArmed = 0; ctx.cue('carry.pins.reset'); }
    ctx.output('down', down);
    ctx.output('all', all ? 1 : 0);
    ctx.output('reset', reset);
    ctx.output('strike', strike);
  },
});

// ---------------------------------------------------------------- 転がる球（ゴルフ）
interface RollState { pos: number[]; vel: number[]; rest: number; kicked: number; cups: number[]; sink: number; [k: string]: number | number[] }

definePart<RollState>({
  type: 'rollBall',
  outputs: ['c0', 'c1', 'c2', 'moving', 'kicks'],
  init: (ctx) => {
    const tee = ctx.spec.params.tee as number[];
    return { pos: [tee[0]!, tee[1]!, tee[2]!], vel: [0, 0], rest: 0, kicked: 0, cups: ((ctx.spec.params.cups as number[][] | undefined) ?? []).map(() => 0), sink: 0 };
  },
  step(s, ctx) {
    const tee = ctx.spec.params.tee as number[];
    const r = pNum(ctx.spec, 'r', 0.09);
    const cups = (ctx.spec.params.cups as number[][] | undefined) ?? [];
    const area = pAabb(ctx.spec, 'area');
    const toTee = (): void => { s.pos = [tee[0]!, tee[1]!, tee[2]!]; s.vel = [0, 0]; s.rest = 0; s.kicked = 0; s.sink = 0; };
    if (s.sink > 0) { s.sink -= ctx.dt; if (s.sink <= 0) toTee(); ctx.output('moving', 0); return; }
    // 蹴る: 体（半径 0.35）が球に触れて、球の方へ動いている
    for (const p of ctx.players) {
      const dx = s.pos[0]! - p.pos[0], dz = s.pos[2]! - p.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.35 + r + 0.05 || Math.abs(p.pos[1] - (s.pos[1]! - r)) > 0.5) continue;
      const toward = (p.vel[0] * dx + p.vel[2] * dz) / Math.max(1e-6, d);
      if (toward < 0.4) continue;
      const k = pNum(ctx.spec, 'kick', 1.35);
      const nx = dx / Math.max(1e-6, d), nz = dz / Math.max(1e-6, d);
      const sp = Math.min(pNum(ctx.spec, 'maxKick', 7), toward * k + 0.5);
      // 2 打目（転がっている間に蹴る）は反則: 元へ戻す
      if (s.kicked && Math.hypot(s.vel[0]!, s.vel[1]!) > 0.05) { ctx.cue('carry.golf.foul', [s.pos[0]!, s.pos[1]!, s.pos[2]!]); toTee(); break; }
      s.vel = [nx * sp, nz * sp];
      s.kicked = 1;
      s.pos[0] = p.pos[0] + nx * (0.35 + r + 0.06);
      s.pos[2] = p.pos[2] + nz * (0.35 + r + 0.06);
      ctx.cue('carry.golf.hit', [s.pos[0]!, s.pos[1]!, s.pos[2]!], { speed: sp });
    }
    const sp = Math.hypot(s.vel[0]!, s.vel[1]!);
    if (sp > 0) {
      // 摩擦で遅くなる
      const f = pNum(ctx.spec, 'friction', 1.1) * ctx.dt;
      const ns = Math.max(0, sp - f);
      s.vel = [(s.vel[0]! / sp) * ns, (s.vel[1]! / sp) * ns];
      // 動かす（軸ごと。箱に当たったら跳ね返る）
      const n = Math.ceil((ns * ctx.dt) / 0.05) + 1;
      for (let i = 0; i < n; i++) {
        for (const k of [0, 1] as const) {
          const ax = k === 0 ? 0 : 2;
          const np = [...s.pos];
          np[ax] = np[ax]! + (s.vel[k]! * ctx.dt) / n;
          const blocked = ctx.colliders.query(np[0]! - r, np[1]! - r + 0.02, np[2]! - r, np[0]! + r, np[1]! + r, np[2]! + r).some((b) => np[0]! + r > b.min[0] && np[0]! - r < b.max[0] && np[2]! + r > b.min[2] && np[2]! - r < b.max[2] && np[1]! + r > b.min[1] && np[1]! - r + 0.02 < b.max[1]);
          if (blocked || np[0]! - r < area.min[0] || np[0]! + r > area.max[0] || np[2]! - r < area.min[2] || np[2]! + r > area.max[2]) { s.vel[k] = -s.vel[k]! * pNum(ctx.spec, 'bounce', 0.65); ctx.cue('carry.golf.bump', [s.pos[0]!, s.pos[1]!, s.pos[2]!]); }
          else s.pos = np;
        }
      }
    }
    // 穴: ゆっくり通ると入る
    const now = Math.hypot(s.vel[0]!, s.vel[1]!);
    cups.forEach((c, i) => {
      if (s.sink > 0 || Math.hypot(s.pos[0]! - c[0]!, s.pos[2]! - c[1]!) > c[2]! || now > pNum(ctx.spec, 'sinkSpeed', 2.2)) return;
      s.cups[i] = 1;
      s.sink = 1.5;
      s.vel = [0, 0];
      ctx.cue('carry.golf.cup', [c[0]!, s.pos[1]!, c[1]!], { cup: i });
    });
    // 止まったら、しばらくで元へ（1 打で）
    if (now < 0.02 && s.kicked && s.sink <= 0) { s.rest += ctx.dt; if (s.rest >= pNum(ctx.spec, 'restSec', 1.5)) { ctx.cue('carry.golf.back', [tee[0]!, tee[1]!, tee[2]!]); toTee(); } }
    else s.rest = 0;
    cups.forEach((_c, i) => ctx.output(`c${i}`, s.cups[i] ?? 0));
    ctx.output('moving', now > 0.02 ? 1 : 0);
    ctx.output('kicks', s.kicked);
  },
});

// ---------------------------------------------------------------- 鬼ごっこする灯り
interface TagState { pos: number[]; caught: number; touched: number; calm: number; hop: number; [k: string]: number | number[] }

/** 部屋の中で、箱に入らない点か（灯りの高さ） */
function freeAt(colliders: import('../../collision.ts').ColliderIndex, area: AABB, x: number, y: number, z: number, m = 0.35): boolean {
  if (x < area.min[0] + m || x > area.max[0] - m || z < area.min[2] + m || z > area.max[2] - m) return false;
  return !colliders.pointBlocked(x, y, z) && !colliders.pointBlocked(x + m * 0.7, y, z) && !colliders.pointBlocked(x - m * 0.7, y, z) && !colliders.pointBlocked(x, y, z + m * 0.7) && !colliders.pointBlocked(x, y, z - m * 0.7);
}

definePart<TagState>({
  type: 'tagLight',
  outputs: ['caught', 'touched', 'near'],
  init: (ctx) => { const p = ctx.spec.params.home as number[]; return { pos: [p[0]!, p[1]!, p[2]!], caught: 0, touched: 0, calm: 0, hop: 0 }; },
  step(s, ctx) {
    const area = pAabb(ctx.spec, 'area');
    const spots = (ctx.spec.params.spots as number[][] | undefined) ?? [];
    const p = ctx.players.find((x) => playerIn(x, area)) ?? null;
    const pos = s.pos as Vec3;
    let near = 0;
    if (p) {
      const d = distXZ(p.pos, pos);
      near = d < 3 ? 1 : 0;
      // じっとしている（動かない・灯りを見ない）
      const looking = isLooking(p, pos, 0.3, 30, 20);
      s.calm = p.stillSec > 0.5 && !looking ? s.calm + ctx.dt : 0;
      const calm = s.calm >= pNum(ctx.spec, 'stillSec', 6);
      const v = (calm ? pNum(ctx.spec, 'creep', 0.6) : pNum(ctx.spec, 'speed', 3.4)) * ctx.dt;
      let dx = pos[0] - p.pos[0], dz = pos[2] - p.pos[2];
      if (calm) { dx = -dx; dz = -dz; }
      const l = Math.hypot(dx, dz);
      if (!calm && d > pNum(ctx.spec, 'fleeM', 4.5)) { /* 遠ければ漂う */ }
      else if (l > 1e-6) {
        // 逃げる向き（塞がっていれば左右へずらす）
        for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
          const c = Math.cos(a), sn = Math.sin(a);
          const ux = (dx * c - dz * sn) / l, uz = (dx * sn + dz * c) / l;
          if (freeAt(ctx.colliders, area, pos[0] + ux * v * 4, pos[1], pos[2] + uz * v * 4)) { pos[0] += ux * v; pos[2] += uz * v; break; }
        }
      }
      if (d < pNum(ctx.spec, 'touchM', 0.6) + 0.05 && Math.abs(p.pos[1] + 1 - pos[1]) < 1.2) {
        if (calm) { if (!s.touched) { s.touched = 1; ctx.cue('carry.tag.touch', [...pos]); } s.calm = 0; }
        else {
          s.caught++;
          ctx.cue('carry.tag.caught', [...pos], { count: s.caught });
        }
        // 遠くの点へ跳ぶ
        if (spots.length) {
          const far = spots.slice().sort((a, b) => Math.hypot(b[0]! - p.pos[0], b[2]! - p.pos[2]) - Math.hypot(a[0]! - p.pos[0], a[2]! - p.pos[2]))[s.hop++ % Math.min(3, spots.length)]!;
          s.pos = [far[0]!, far[1]!, far[2]!];
        }
      }
    }
    ctx.output('caught', s.caught);
    ctx.output('touched', s.touched);
    ctx.output('near', near);
  },
});

// ---------------------------------------------------------------- 探しに来る灯り
interface SeekState { d: number; pos: number[]; dir: number[]; caught: number; pause: number; seen: number; clean: number; hideT: number; hidden: number; alarm: number; [k: string]: number | number[] }

function pathAt(pts: number[][], d: number): { p: Vec3; dir: [number, number] } {
  let total = 0;
  const seg: number[] = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; const l = Math.hypot(b[0]! - a[0]!, b[2]! - a[2]!); seg.push(l); total += l; }
  let left = ((d % total) + total) % total;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!, l = seg[i]!;
    if (left <= l || i === pts.length - 1) {
      const k = l > 1e-9 ? left / l : 0;
      return { p: [a[0]! + (b[0]! - a[0]!) * k, a[1]!, a[2]! + (b[2]! - a[2]!) * k], dir: [(b[0]! - a[0]!) / Math.max(1e-9, l), (b[2]! - a[2]!) / Math.max(1e-9, l)] };
    }
    left -= l;
  }
  return { p: [pts[0]![0]!, pts[0]![1]!, pts[0]![2]!], dir: [1, 0] };
}

definePart<SeekState>({
  type: 'seeker',
  outputs: ['caught', 'seen', 'clean', 'hidden'],
  init: (ctx) => { const a = pathAt(ctx.spec.params.path as number[][], 0); return { d: 0, pos: a.p, dir: a.dir, caught: 0, pause: 0, seen: 0, clean: 0, hideT: 0, hidden: 0, alarm: 0 }; },
  step(s, ctx) {
    const pts = ctx.spec.params.path as number[][];
    const area = pAabb(ctx.spec, 'area');
    if (s.pause > 0) s.pause -= ctx.dt;
    else s.d += pNum(ctx.spec, 'speed', 1.2) * ctx.dt;
    s.alarm = Math.max(0, s.alarm - ctx.dt);
    const at = pathAt(pts, s.d);
    s.pos = at.p;
    // 向きはなめらかに
    s.dir = [s.dir[0]! + (at.dir[0] - s.dir[0]!) * Math.min(1, ctx.dt * 4), s.dir[1]! + (at.dir[1] - s.dir[1]!) * Math.min(1, ctx.dt * 4)];
    const fl = Math.hypot(s.dir[0]!, s.dir[1]!) || 1;
    const fx = s.dir[0]! / fl, fz = s.dir[1]! / fl;
    const cosV = Math.cos((pNum(ctx.spec, 'viewDeg', 38) * Math.PI) / 180);
    const safe = ctx.spec.params.safe ? pAabb(ctx.spec, 'safe') : null;
    const hide = ctx.spec.params.hide ? pAabb(ctx.spec, 'hide') : null;
    let seen = 0, hiding = false;
    for (const p of ctx.players) {
      if (!playerIn(p, area)) continue;
      // 入口の前: 見つからない・やり直しの始まり（見つかっていない「きれいな」回になる）
      if (safe && playerIn(p, safe)) { s.clean = 1; continue; }
      if (hide && playerIn(p, hide)) hiding = true;
      const eye: Vec3 = [p.pos[0], p.pos[1] + (p.crouching ? 0.6 : 1.2), p.pos[2]];
      const dx = eye[0] - s.pos[0]!, dz = eye[2] - s.pos[2]!;
      const d = Math.hypot(dx, dz);
      const range = pNum(ctx.spec, 'viewM', 6) * (p.crouching ? 0.55 : 1);
      if (d > range || d < 1e-3 || (dx * fx + dz * fz) / d < cosV) continue;
      if (segmentBlocked(ctx.colliders, [s.pos[0]!, s.pos[1]!, s.pos[2]!], eye, 0.15)) continue;
      seen = 1;
      // 見つかった: 警報（この回は無効。入口へ戻ってやり直す）
      if (s.alarm <= 0) { s.caught++; s.alarm = 2; s.pause = 1.2; ctx.cue('carry.seek.caught', [...eye], { count: s.caught }); }
      s.clean = 0;
    }
    s.hideT = hiding && !seen ? s.hideT + ctx.dt : 0;
    if (s.hideT >= pNum(ctx.spec, 'hideSec', 15) && !s.hidden) { s.hidden = 1; ctx.cue('carry.seek.hidden'); }
    s.seen = seen;
    ctx.output('caught', s.caught);
    ctx.output('seen', seen);
    ctx.output('clean', s.clean);
    ctx.output('hidden', s.hidden);
  },
});

// ---------------------------------------------------------------- 弾く柱
definePart<{ cool: number }>({
  type: 'bumper',
  outputs: ['hit'],
  init: () => ({ cool: 0 }),
  step(s, ctx) {
    const c = ctx.spec.params.pos as number[];
    const r = pNum(ctx.spec, 'r', 0.35);
    s.cool = Math.max(0, s.cool - ctx.dt);
    let hit = 0;
    for (const p of ctx.players) {
      const dx = p.pos[0] - c[0]!, dz = p.pos[2] - c[2]!;
      const d = Math.hypot(dx, dz);
      // 柱の当たり（半径 r）に体（0.35 m）が触れて、柱の方へ（approach m/s 以上で）向かっている
      const toward = -(p.vel[0] * dx + p.vel[2] * dz) / Math.max(1e-6, d);
      if (s.cool > 0 || d > r + 0.4 || toward < pNum(ctx.spec, 'approach', 0.8) || p.pos[1] > c[1]! + 1.2 || p.pos[1] < c[1]! - 0.3) continue;
      const sp = pNum(ctx.spec, 'speed', 6.5);
      p.vel[0] = (dx / Math.max(1e-6, d)) * sp;
      p.vel[2] = (dz / Math.max(1e-6, d)) * sp;
      p.vel[1] = Math.max(p.vel[1], pNum(ctx.spec, 'up', 2.4));
      p.onGround = false;
      s.cool = 0.3;
      hit = 1;
      ctx.cue('carry.bumper', [c[0]!, c[1]! + 0.6, c[2]!]);
    }
    ctx.output('hit', hit);
  },
});

// ---------------------------------------------------------------- 台車（坂を上り下りする。乗っている人をそのまま運ぶ）
interface CartTrackState { t: number; pos: number[]; vel: number[]; laps: number; acc: number; on: number; [k: string]: number | number[] }

/** 折れ線の長さと、道のり d の点（閉じた輪） */
function loopAt(pts: number[][], d: number): number[] {
  let total = 0;
  const seg: number[] = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; const l = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!); seg.push(l); total += l; }
  let left = ((d % total) + total) % total;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!, l = seg[i]!;
    if (left <= l || i === pts.length - 1) { const k = l > 1e-9 ? left / l : 0; return [a[0]! + (b[0]! - a[0]!) * k, a[1]! + (b[1]! - a[1]!) * k, a[2]! + (b[2]! - a[2]!) * k]; }
    left -= l;
  }
  return [...pts[0]!];
}
const loopLength = (pts: number[][]): number => pts.reduce((a, p, i) => { const b = pts[(i + 1) % pts.length]!; return a + Math.hypot(b[0]! - p[0]!, b[1]! - p[1]!, b[2]! - p[2]!); }, 0);

definePart<CartTrackState>({
  type: 'cartTrack',
  outputs: ['t', 'riding', 'laps'],
  init(ctx) {
    const pts = ctx.spec.params.points as number[][];
    const p = loopAt(pts, 0);
    const h = ctx.spec.params.half as number[];
    ctx.setCollider('cart', { min: [p[0]! - h[0]!, p[1]!, p[2]! - h[2]!], max: [p[0]! + h[0]!, p[1]! + h[1]! * 2, p[2]! + h[2]!] });
    return { t: 0, pos: p, vel: [0, 0, 0], laps: 0, acc: 0, on: 0 };
  },
  step(s, ctx) {
    const pts = ctx.spec.params.points as number[][];
    const h = ctx.spec.params.half as number[];
    const L = Math.max(1e-6, loopLength(pts));
    const sp = pNum(ctx.spec, 'speed', 1.4);
    const prev = s.pos;
    s.t = (s.t + (sp * ctx.dt) / L) % 1;
    const p = loopAt(pts, s.t * L);
    s.vel = [(p[0]! - prev[0]!) / ctx.dt, (p[1]! - prev[1]!) / ctx.dt, (p[2]! - prev[2]!) / ctx.dt];
    s.pos = p;
    const top = p[1]! + h[1]! * 2;
    ctx.setCollider('cart', { min: [p[0]! - h[0]!, p[1]!, p[2]! - h[2]!], max: [p[0]! + h[0]!, top, p[2]! + h[2]!] });
    let on = 0;
    for (const pl of ctx.players) {
      const inside = Math.abs(pl.pos[0] - p[0]!) < h[0]! + 0.2 && Math.abs(pl.pos[2] - p[2]!) < h[2]! + 0.2;
      // 上に乗っている（少し浮いていても。下り坂で置いて行かれない）
      if (!inside || pl.pos[1] < top - 0.08 || pl.pos[1] > top + 0.3 || pl.vel[1] > 1.0) continue;
      pl.pos[1] = top;
      pl.vel[1] = 0;
      pl.onGround = true;
      pl.carry = [s.vel[0]!, s.vel[1]!, s.vel[2]!];
      on = 1;
    }
    if (on) { s.acc += (sp * ctx.dt) / L; if (s.acc >= 1) { s.acc -= 1; s.laps++; ctx.cue('carry.cart.lap', [p[0]!, top, p[2]!], { laps: s.laps }); } }
    else { s.acc = 0; s.laps = 0; }
    s.on = on;
    ctx.output('t', s.t);
    ctx.output('riding', on);
    ctx.output('laps', s.laps);
  },
});

// ---------------------------------------------------------------- 台車に乗る
interface CartState { ride: number; laps: number; lastT: number; acc: number; [k: string]: number }

definePart<CartState>({
  type: 'cartRider',
  outputs: ['riding', 'laps'],
  init: () => ({ ride: 0, laps: 0, lastT: 0, acc: 0 }),
  step(s, ctx) {
    const cart = pStr(ctx.spec, 'cart', '');
    const st = ctx.stateOf(cart);
    const box = ctx.floor.entities.find((e) => e.id === cart)?.params.box as { min: number[]; max: number[] } | undefined;
    if (!st || !box) return;
    const off = st.pos as number[];
    const top = box.max[1]! + off[1]!;
    const on = ctx.players.some((p) => p.onGround && Math.abs(p.pos[1] - top) < 0.12 && p.pos[0] > box.min[0]! + off[0]! - 0.2 && p.pos[0] < box.max[0]! + off[0]! + 0.2 && p.pos[2] > box.min[2]! + off[2]! - 0.2 && p.pos[2] < box.max[2]! + off[2]! + 0.2);
    const t = Number(st.t ?? 0);
    if (on) {
      s.ride += ctx.dt;
      let dt = t - s.lastT;
      if (dt < -0.5) dt += 1;
      if (dt > 0) s.acc += dt;
      if (s.acc >= 1) { s.acc -= 1; s.laps++; ctx.cue('carry.cart.lap', undefined, { laps: s.laps }); }
    } else { s.ride = 0; s.laps = 0; s.acc = 0; }
    s.lastT = t;
    ctx.output('riding', on ? 1 : 0);
    ctx.output('laps', s.laps);
  },
});

// ---------------------------------------------------------------- 的
interface TargetState { down: number[]; allT: number; [k: string]: number | number[] }

definePart<TargetState>({
  type: 'throwTarget',
  outputs: ['down', 'all', 'reset'],
  init: (ctx) => ({ down: ((ctx.spec.params.targets as unknown[] | undefined) ?? []).map(() => 0), allT: 0 }),
  step(s, ctx) {
    const targets = ((ctx.spec.params.targets as { min: number[]; max: number[] }[] | undefined) ?? []).map((t) => ({ min: t.min as Vec3, max: t.max as Vec3 }));
    const ix = carryIndex(ctx.floor);
    for (const id of ix.items) {
      const st = ctx.stateOf(id) as ItemState | null;
      if (!st || st.mode !== FLY) continue;
      const a: Vec3 = [st.prev[0]!, st.prev[1]!, st.prev[2]!], b: Vec3 = [st.poses[0]!, st.poses[1]!, st.poses[2]!];
      targets.forEach((t, i) => {
        if (s.down[i] || !segmentHitsAabb(a, b, t)) return;
        s.down[i] = 1;
        ctx.cue('carry.target.hit', [(t.min[0] + t.max[0]) / 2, (t.min[1] + t.max[1]) / 2, (t.min[2] + t.max[2]) / 2], { target: i });
      });
    }
    const n = s.down.filter((x) => x).length;
    const all = n === targets.length && n > 0;
    let reset = 0;
    if (all) { s.allT += ctx.dt; if (s.allT >= 3) { s.down = s.down.map(() => 0); s.allT = 0; reset = 1; ctx.cue('carry.target.reset'); } } else s.allT = 0;
    ctx.output('down', n);
    ctx.output('all', all ? 1 : 0);
    ctx.output('reset', reset);
  },
});

// ---------------------------------------------------------------- 記憶の部屋
interface MemoryState { phase: number; t: number; round: number; away: number; still: number; patient: number; scatter: number; touched: number; [k: string]: number }
/** phase: 0 = 待つ（明るい）/ 1 = 見せる / 2 = 暗い（戻す）/ 3 = そろった */

definePart<MemoryState>({
  type: 'memoryGame',
  outputs: ['lights', 'scatter', 'reset', 'patient', 'phase', 'solved'],
  inputs: ['ok'],
  init: () => ({ phase: 0, t: 0, round: 0, away: 0, still: 0, patient: 0, scatter: 0, touched: 0 }),
  step(s, ctx) {
    const room = pAabb(ctx.spec, 'room');
    const inside = ctx.players.some((p) => playerIn(p, room));
    const items = (ctx.spec.params.items as string[] | undefined) ?? [];
    let reset = 0;
    s.t += ctx.dt;
    if (s.phase === 0 && inside) { s.phase = 1; s.t = 0; ctx.cue('carry.memory.show'); }
    else if (s.phase === 1 && s.t >= pNum(ctx.spec, 'showSec', 10)) {
      s.phase = 2; s.t = 0; s.round++; s.scatter = 1 + (s.round % 7); s.touched = 0; s.still = 0;
      ctx.cue('carry.memory.dark');
    } else if (s.phase === 2) {
      if (ctx.input('ok') > 0.5) { s.phase = 3; ctx.cue('carry.memory.solved'); }
      // 暗い間に物に触れず、じっとしている
      const held = items.some((id) => (ctx.stateOf(id) as ItemState | null)?.mode === HELD);
      if (held) s.touched = 1;
      const still = ctx.players.some((p) => playerIn(p, room) && p.stillSec > 0.4);
      s.still = still && !s.touched ? s.still + ctx.dt : 0;
      if (s.still >= pNum(ctx.spec, 'patientSec', 20) && !s.patient) { s.patient = 1; ctx.cue('carry.memory.patient'); }
    }
    // 部屋を出て 6 秒: 物を戻して最初から
    s.away = inside ? 0 : s.away + ctx.dt;
    if (s.phase > 0 && s.away >= pNum(ctx.spec, 'resetSec', 6)) { s.phase = 0; s.t = 0; s.scatter = 0; reset = 1; }
    if (s.phase !== 2) s.scatter = 0;
    ctx.output('lights', s.phase === 2 ? 0 : 1);
    ctx.output('scatter', s.phase === 2 ? s.scatter : 0);
    ctx.output('reset', reset);
    ctx.output('patient', s.patient);
    ctx.output('phase', s.phase);
    ctx.output('solved', s.phase === 3 ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 自分の影絵
interface PoseState { t: number[]; on: number[]; [k: string]: number[] }

definePart<PoseState>({
  type: 'shadowPose',
  outputs: ['m0', 'm1', 'm2', 'm3', 'all'],
  init: (ctx) => { const n = ((ctx.spec.params.marks as unknown[] | undefined) ?? []).length; return { t: new Array(n).fill(0), on: new Array(n).fill(0) }; },
  step(s, ctx) {
    const marks = (ctx.spec.params.marks as { pos: number[]; r: number; crouch?: boolean }[] | undefined) ?? [];
    const sec = pNum(ctx.spec, 'sec', 1.5);
    marks.forEach((m, i) => {
      const ok = ctx.players.some((p: PlayerState) => p.onGround && Math.hypot(p.pos[0] - m.pos[0]!, p.pos[2] - m.pos[2]!) < m.r && p.crouching === !!m.crouch);
      s.t[i] = ok ? s.t[i]! + ctx.dt : 0;
      if (s.t[i]! >= sec && !s.on[i]) { s.on[i] = 1; ctx.cue('carry.pose', [m.pos[0]!, m.pos[1]! + 1, m.pos[2]!], { mark: i }); }
      ctx.output(`m${i}`, s.on[i]!);
    });
    ctx.output('all', marks.length && s.on.every((x) => x) ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 宙の輪
interface RingState { prev: number[]; seq: number[]; fwd: number; rev: number; next: number; [k: string]: number | number[] }

definePart<RingState>({
  type: 'ringSensor',
  outputs: ['forward', 'reverse', 'next', 'count'],
  init: () => ({ prev: [], seq: [], fwd: 0, rev: 0, next: 0 }),
  step(s, ctx) {
    const rings = (ctx.spec.params.rings as { c: number[]; n: number[]; r: number }[] | undefined) ?? [];
    const N = rings.length;
    const p = ctx.players[0];
    if (!p) return;
    const body: Vec3 = [p.pos[0], p.pos[1] + 0.85, p.pos[2]];
    if (s.prev.length === 3) {
      rings.forEach((rg, i) => {
        const side = (q: number[]): number => (q[0]! - rg.c[0]!) * rg.n[0]! + (q[1]! - rg.c[1]!) * rg.n[1]! + (q[2]! - rg.c[2]!) * rg.n[2]!;
        const a = side(s.prev), b = side(body);
        if (a * b > 0 || a === b) return;
        const k = a / (a - b);
        const x = s.prev[0]! + (body[0] - s.prev[0]!) * k, y = s.prev[1]! + (body[1] - s.prev[1]!) * k, z = s.prev[2]! + (body[2] - s.prev[2]!) * k;
        if (Math.hypot(x - rg.c[0]!, y - rg.c[1]!, z - rg.c[2]!) > rg.r) return;
        // くぐった: 順を数える（同じ輪を続けて数えない）
        if (s.seq[s.seq.length - 1] === i) return;
        s.seq.push(i);
        ctx.cue('carry.ring', [rg.c[0]!, rg.c[1]!, rg.c[2]!], { ring: i });
        const up = s.seq.every((v, j) => v === j), down = s.seq.every((v, j) => v === N - 1 - j);
        if (!up && !down) s.seq = [i];
        if (s.seq.length === N && s.seq.every((v, j) => v === j) && !s.fwd) { s.fwd = 1; ctx.cue('carry.ring.done'); }
        if (s.seq.length === N && s.seq.every((v, j) => v === N - 1 - j) && !s.rev) { s.rev = 1; ctx.cue('carry.ring.reverse'); }
        if (s.seq.length >= N) s.seq = [];
      });
    }
    s.prev = [...body];
    s.next = s.seq.length && s.seq[0] === N - 1 && N > 1 ? N - 1 - s.seq.length : s.seq.length;
    ctx.output('forward', s.fwd);
    ctx.output('reverse', s.rev);
    ctx.output('next', s.next);
    ctx.output('count', s.seq.length);
  },
});
