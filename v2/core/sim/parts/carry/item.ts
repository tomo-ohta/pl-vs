/**
 * 持てる物（gimmicks-and-structures.md 2.10・v2-plan.md 4.7「物を運ぶ・置く」の共通の部品。ほかの担当の部品からも使える）。
 *
 * - carryItem: 物理を使わない物。置くと支え（いちばん高い上面）の上に止まり、投げると放物線で飛んで、当たった所に落ちる
 * - carryBody: 物理（Rapier）の剛体。投げる・転がす・倒すのは物理に任せる（球・ピン）。物理の上限 gimmick.physicsMax の中で使う
 *
 * 操作（スマホでも同じ: 調べる = タップ、置く = Q のボタン）:
 * - 調べる（E）で拾う → PlayerState.holding に部品の id。手の前に描く（client/views/carry）
 * - 持っている間に Q: 目の前に置く（置き台・枠 carryReceiver の枠が近い・視線の先にあれば、そこへ吸い付く）。
 *   走りながら・上を向いて Q なら投げる
 * - 持っている間に別の持てる物を調べる: 入れ替える（手の物を、取った物のあった所へ置く。並べ替えのパズル）
 *
 * params（どれも省略できる）:
 *   pos [x, y, z]（底の中心）・half [hx, hy, hz]・yaw・kind（見た目）・mat・color・tag（名札。受けが照合する）・weight（重さ）・
 *   solid（置いてある間は当たる）・throwable（既定 true）・pickable（既定 true）・snap（置いた向きの刻み。既定 π/2）・
 *   bounds（この範囲の外へは持ち出せない。出ると元の所へ戻る。carryBody は既定で置いた区画）・
 *   homeRegion（元の部屋。外へ出たことがあり、戻して置くと出力 returned）・
 *   fluid / fill / fillZone（水を運ぶ: 走るとこぼれる。fillZone の中で持つと満ちる）・
 *   stages / stageM（運ぶと変わる物: stageM m 運ぶごとに次の段）・
 *   scatter [[x, y, z, yaw], …] / scatterSlot（入力 scatter が入ると、その中の 1 つへ移る）・persist（既定 true。置いた物が残る）
 * 入力: reset（入ると元の所へ戻る）・scatter（入った値 1 + k で、scatter の (scatterSlot + k) 番目へ）・lock（入っている間は拾えない）
 * 出力: held・moved・fill・stage・returned・away・flying
 * イベント（Cue）: carry.pick / carry.drop / carry.place（枠へ）/ carry.throw / carry.land / carry.swap / carry.return /
 *   carry.fill / carry.spill / carry.morph（data: tag・kind）
 */
import { aabbContains, aabbExpand, type AABB } from '../../../math/aabb.ts';
import { clamp, lookDir, type Vec3 } from '../../../math/vec.ts';
import type { EntitySpec } from '../../../world/layout.ts';
import { definePart, pBool, pNum, playerIn, pStr, type PartContext, type PartDef } from '../../part.ts';
import type { PlayerState } from '../../types.ts';
import { aabbParam, carryIndex, centerOf, FLY, HELD, ITEM_TYPES, itemAabb, overlapsAny, poseList, quatYaw, REST, segmentBlocked, slotsOf, snapAngle, supportBelow, tagMatch, yawHalf, type ItemState, type Slot } from './common.ts';

export interface ItemCfg {
  half: Vec3;
  /** 元の所（底の中心）と向き */
  home: Vec3;
  homeYaw: number;
  tag: string;
  kind: string;
  weight: number;
  solid: boolean;
  throwable: boolean;
  pickable: boolean;
  snap: number;
  bounds: AABB | null;
  homeRegion: AABB | null;
  fluid: boolean;
  fillZone: AABB | null;
  stages: number;
  stageM: number;
  scatter: [number, number, number, number][];
  scatterSlot: number;
  persist: boolean;
  ball: boolean;
  /** 支えが無くても落ちない（宙の受け口に初めから入っている物） */
  float: boolean;
}

const CFG = new WeakMap<EntitySpec, ItemCfg>();

/** 持てる物の設定（params を 1 度だけ読む） */
export function itemCfg(spec: EntitySpec, floorCells?: { id: string; bounds: AABB }[]): ItemCfg {
  let c = CFG.get(spec);
  if (c) return c;
  const p = spec.params;
  const pos = Array.isArray(p.pos) ? (p.pos as number[]) : [0, 0, 0];
  const half = Array.isArray(p.half) ? (p.half as number[]) : [0.15, 0.15, 0.15];
  let bounds = aabbParam(p.bounds);
  // 剛体は、置いた区画の外へ出ない（物理の床は剛体の区画と隣の区画にしか無い）
  if (!bounds && spec.type === 'carryBody' && floorCells && spec.cell) {
    const cell = floorCells.find((x) => x.id === spec.cell);
    if (cell) bounds = aabbExpand(cell.bounds, 0.3);
  }
  c = {
    half: [half[0]!, half[1]!, half[2]!],
    home: [pos[0]!, pos[1]!, pos[2]!],
    homeYaw: pNum(spec, 'yaw', 0),
    tag: pStr(spec, 'tag', pStr(spec, 'kind', 'item')),
    kind: pStr(spec, 'kind', 'box'),
    weight: pNum(spec, 'weight', 1),
    solid: pBool(spec, 'solid', false),
    throwable: pBool(spec, 'throwable', true),
    pickable: pBool(spec, 'pickable', true),
    snap: pNum(spec, 'snap', Math.PI / 2),
    bounds,
    homeRegion: aabbParam(p.homeRegion),
    fluid: pBool(spec, 'fluid', false),
    fillZone: aabbParam(p.fillZone),
    stages: Math.max(1, Math.round(pNum(spec, 'stages', 1))),
    stageM: pNum(spec, 'stageM', 12),
    scatter: poseList(p.scatter),
    scatterSlot: Math.round(pNum(spec, 'scatterSlot', 0)),
    persist: pBool(spec, 'persist', true),
    ball: pStr(spec, 'kind', '') === 'ball' || pBool(spec, 'ball', false),
    float: pBool(spec, 'float', false),
  };
  CFG.set(spec, c);
  return c;
}

/** 底の中心 bottom・向き yaw に置いた状態にする */
export function setRest(s: ItemState, cfg: ItemCfg, bottom: Vec3, yaw: number): void {
  const q = quatYaw(yaw);
  s.poses = [bottom[0], bottom[1] + cfg.half[1], bottom[2], q[0], q[1], q[2], q[3]];
  s.yaw = yaw;
  s.mode = REST;
  s.vel = [0, 0, 0];
  s.flyT = 0;
}

function holderOf(ctx: PartContext, s: ItemState): PlayerState | null {
  return s.held ? ctx.players.find((p) => p.id === s.held) ?? null : null;
}

/** 手を離す（持っている人の holding を空にする） */
function release(ctx: PartContext, s: ItemState): void {
  const p = holderOf(ctx, s);
  if (p && p.holding === ctx.id) p.holding = null;
  s.held = null;
}

/** 剛体を状態の位置へ置き直す（carryBody） */
function syncBody(ctx: PartContext, s: ItemState, vel: Vec3 = [0, 0, 0]): void {
  if (s.handle < 0 || !ctx.physics) return;
  ctx.physics.placeBody(s.handle, centerOf(s), [s.poses[3]!, s.poses[4]!, s.poses[5]!, s.poses[6]!], vel);
  ctx.physics.setBodyEnabled(s.handle, s.mode !== HELD);
}

function data(cfg: ItemCfg, extra: Record<string, string | number | boolean | null> = {}): Record<string, string | number | boolean | null> {
  return { tag: cfg.tag, kind: cfg.kind, ...extra };
}

/** 元の所へ戻す */
function goHome(ctx: PartContext, s: ItemState, cfg: ItemCfg, cue = true): void {
  release(ctx, s);
  setRest(s, cfg, cfg.home, cfg.homeYaw);
  s.moved = 0;
  // 水の入れ物は空で戻る（注いだ・こぼした）
  if (cfg.fluid) { s.fill = 0; s.spilled = 0; }
  syncBody(ctx, s);
  if (cue) ctx.cue('carry.return', centerOf(s), data(cfg));
}

/** 手の前の位置（持っている物の中心） */
export function handPos(p: PlayerState): Vec3 {
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  return [p.pos[0] + fx * 0.45, p.pos[1] + p.eye - 0.4, p.pos[2] + fz * 0.45];
}

/** ほかの物が枠に置いてあるか（自分は除く） */
function slotTaken(ctx: PartContext, sl: Slot, self: string): boolean {
  const ix = carryIndex(ctx.floor);
  for (const id of ix.items) {
    if (id === self) continue;
    const st = ctx.stateOf(id) as ItemState | null;
    if (!st || st.mode === HELD) continue;
    const half = itemCfg(ix.specs.get(id)!).half;
    const bx = st.poses[0]!, by = st.poses[1]! - half[1], bz = st.poses[2]!;
    if (Math.hypot(bx - sl.pos[0], bz - sl.pos[2]) < 0.2 && Math.abs(by - sl.pos[1]) < 0.3) return true;
  }
  return false;
}

/** 点 at に近い空いた枠（吸い付く物だけ）。視線（eye から dir）に近い枠も見る */
function nearestSlot(ctx: PartContext, cfg: ItemCfg, at: Vec3, eye: Vec3 | null, dir: Vec3 | null): { slot: Slot; receiver: string } | null {
  let best: { slot: Slot; receiver: string; d: number } | null = null;
  const reach = ctx.tuning['carry.item.slotAimM'];
  for (const rs of carryIndex(ctx.floor).receivers) {
    for (const sl of slotsOf(rs)) {
      if (!tagMatch(cfg.tag, sl.accept)) continue;
      const c: Vec3 = [sl.pos[0], sl.pos[1] + cfg.half[1], sl.pos[2]];
      let d = Math.abs(at[1] - sl.pos[1]) < 1.6 ? Math.hypot(at[0] - sl.pos[0], at[2] - sl.pos[2]) : Infinity;
      if (eye && dir) {
        const vx = c[0] - eye[0], vy = c[1] - eye[1], vz = c[2] - eye[2];
        const t = clamp(vx * dir[0] + vy * dir[1] + vz * dir[2], 0, reach);
        d = Math.min(d, Math.hypot(eye[0] + dir[0] * t - c[0], eye[1] + dir[1] * t - c[1], eye[2] + dir[2] * t - c[2]));
      }
      if (d >= sl.r || (best && d >= best.d)) continue;
      if (slotTaken(ctx, sl, ctx.id)) continue;
      best = { slot: sl, receiver: rs.id, d };
    }
  }
  return best ? { slot: best.slot, receiver: best.receiver } : null;
}

/** Q で置く所: 枠 → 目の前の支えの上（壁の中・物の中には置かない）→ 足元 */
function placeSpot(ctx: PartContext, cfg: ItemCfg, p: PlayerState): { bottom: Vec3; yaw: number; receiver: string | null } {
  const t = ctx.tuning;
  const yaw = snapAngle(p.yaw, cfg.snap);
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const dropM = t['carry.item.dropM'];
  const eye: Vec3 = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
  const front: Vec3 = [p.pos[0] + fx * dropM, p.pos[1], p.pos[2] + fz * dropM];
  const sl = nearestSlot(ctx, cfg, front, eye, lookDir(p.yaw, p.pitch));
  if (sl) return { bottom: [...sl.slot.pos], yaw: sl.slot.yaw ?? yaw, receiver: sl.receiver };
  const h = yawHalf(cfg.half, yaw);
  const body: Vec3 = [p.pos[0], p.pos[1] + 0.9, p.pos[2]];
  for (const d of [dropM, dropM * 0.75, 0.5, 0.32]) {
    const x = p.pos[0] + fx * d, z = p.pos[2] + fz * d;
    if (segmentBlocked(ctx.colliders, body, [x, p.pos[1] + 0.9, z])) continue;
    const top = supportBelow(ctx.colliders, x, z, h[0] * 0.6, h[2] * 0.6, p.pos[1] + t['carry.item.placeTopM'], p.pos[1] - 4);
    const y = top ?? p.pos[1];
    if (overlapsAny(ctx.colliders, { min: [x - h[0], y + 0.01, z - h[2]], max: [x + h[0], y + 2 * h[1], z + h[2]] })) continue;
    return { bottom: [x, y, z], yaw, receiver: null };
  }
  return { bottom: [p.pos[0], p.pos[1], p.pos[2]], yaw, receiver: null };
}

/** 持っている物を置く・投げる */
function dropFrom(ctx: PartContext, s: ItemState, cfg: ItemCfg, p: PlayerState): void {
  const t = ctx.tuning;
  release(ctx, s);
  const throwIt = cfg.throwable && (p.moveRank === 'dash' || p.pitch > t['carry.item.throwPitch']);
  if (throwIt) {
    const pitch = Math.max(p.pitch, p.moveRank === 'dash' ? t['carry.item.runPitch'] : 0.05);
    const d = lookDir(p.yaw, pitch);
    const sp = t['carry.item.throwSpeed'];
    let c = handPos(p);
    if (ctx.colliders.pointBlocked(c[0], c[1], c[2])) c = [p.pos[0], p.pos[1] + 1.1, p.pos[2]];
    const q = quatYaw(p.yaw);
    s.poses = [c[0], c[1], c[2], q[0], q[1], q[2], q[3]];
    s.yaw = p.yaw;
    s.prev = [...c];
    s.vel = [d[0] * sp + p.vel[0] * 0.5, d[1] * sp + Math.max(0, p.vel[1]) * 0.5, d[2] * sp + p.vel[2] * 0.5];
    s.mode = FLY;
    s.flyT = 0;
    s.moved = 1;
    if (cfg.fluid && s.fill > 0) { s.fill = 0; s.spilled = 1; ctx.cue('carry.spill', c, data(cfg, { amount: 1 })); }
    syncBody(ctx, s, s.vel as Vec3);
    ctx.cue('carry.throw', c, data(cfg, { player: p.id }));
    return;
  }
  const spot = placeSpot(ctx, cfg, p);
  setRest(s, cfg, spot.bottom, spot.yaw);
  s.moved = 1;
  s.slot = spot.receiver ? 1 : 0;
  syncBody(ctx, s);
  ctx.cue(spot.receiver ? 'carry.place' : 'carry.drop', centerOf(s), data(cfg, { player: p.id, receiver: spot.receiver }));
}

/** 持っている間: 手の前について行く・運んだ道のり・水・持ち出せない範囲・Q */
function stepHeld(ctx: PartContext, s: ItemState, cfg: ItemCfg, p: PlayerState): void {
  const t = ctx.tuning;
  // 入れ替えで手から離れた: 取った物のあった所へ
  if (p.holding !== ctx.id) {
    s.held = null;
    const other = p.holding ? ctx.stateOf(p.holding) as ItemState | null : null;
    if (other && Array.isArray(other.swap) && ctx.tick - other.swapTick <= 1) {
      const sw = other.swap;
      setRest(s, cfg, [sw[0]!, sw[1]!, sw[2]!], sw[3]!);
      s.slot = sw[4] ?? 0;
      syncBody(ctx, s);
      ctx.cue('carry.place', centerOf(s), data(cfg, { player: p.id, swap: true }));
    } else {
      const spot = placeSpot(ctx, cfg, p);
      setRest(s, cfg, spot.bottom, spot.yaw);
      s.slot = spot.receiver ? 1 : 0;
      syncBody(ctx, s);
      ctx.cue('carry.drop', centerOf(s), data(cfg, { player: p.id }));
    }
    return;
  }
  const c = handPos(p);
  const q = quatYaw(p.yaw);
  s.prev = [s.poses[0]!, s.poses[1]!, s.poses[2]!];
  s.poses = [c[0], c[1], c[2], q[0], q[1], q[2], q[3]];
  s.yaw = p.yaw;
  const step = Math.hypot(p.pos[0] - s.last[0]!, p.pos[2] - s.last[2]!);
  // 落ちて戻された・移された（1 tick で 1 m より動いた）分は数えない
  if (step < 1) s.carried += step;
  s.last = [...p.pos];
  if (cfg.stages > 1) {
    const st = Math.min(cfg.stages - 1, Math.floor(s.carried / cfg.stageM));
    if (st !== s.stage) { s.stage = st; ctx.cue('carry.morph', c, data(cfg, { stage: st })); }
  }
  if (cfg.fluid) {
    const before = s.fill;
    if (cfg.fillZone && playerIn(p, cfg.fillZone)) {
      if (s.fill < 1 && s.fill === before && s.spillT <= 0) ctx.cue('carry.fill', c, data(cfg));
      s.fill = Math.min(1, s.fill + ctx.dt / t['carry.water.fillSec']);
      if (s.fill >= 1) s.spilled = 0;
      s.spillT = 0.6;
    } else {
      const hs = Math.hypot(p.vel[0], p.vel[2]);
      const over = hs - t['carry.water.safeSpeed'];
      if (over > 0) s.fill = Math.max(0, s.fill - over * t['carry.water.spillRate'] * ctx.dt);
      if (!p.onGround) s.air += ctx.dt;
      else {
        if (s.air > 0.25) s.fill = Math.max(0, s.fill - t['carry.water.jumpSpill']);
        s.air = 0;
      }
      if (s.fill < before) {
        s.spilled = 1;
        s.spillT -= ctx.dt;
        if (s.spillT <= 0) { s.spillT = 0.3; ctx.cue('carry.spill', c, data(cfg, { amount: before - s.fill })); }
      } else s.spillT = Math.max(0, s.spillT - ctx.dt);
    }
  }
  if (cfg.bounds && !playerIn(p, cfg.bounds, 0.3)) { goHome(ctx, s, cfg); return; }
  if (p.dropPressed) dropFrom(ctx, s, cfg, p);
}

/** 飛んでいる物（物理を使わない物）: 放物線。壁に当たると跳ね返り、下向きに当たると止まる */
function stepFly(ctx: PartContext, s: ItemState, cfg: ItemCfg): void {
  const t = ctx.tuning;
  s.flyT += ctx.dt;
  if (s.flyT > t['carry.item.flySec']) { goHome(ctx, s, cfg); return; }
  const v = s.vel;
  const c = centerOf(s);
  s.prev = [...c];
  const n = Math.ceil((Math.hypot(v[0]!, v[1]!, v[2]!) * ctx.dt) / 0.06) + 1;
  const h = ctx.dt / n;
  const half = yawHalf(cfg.half, s.yaw);
  const box = (x: number, y: number, z: number): AABB => ({ min: [x - half[0], y - half[1], z - half[2]], max: [x + half[0], y + half[1], z + half[2]] });
  let landed = false;
  for (let i = 0; i < n && !landed; i++) {
    v[1] = v[1]! - t['carry.item.gravity'] * h;
    for (const k of [0, 2] as const) {
      const q: Vec3 = [...c];
      q[k] += v[k]! * h;
      if (overlapsAny(ctx.colliders, box(q[0], q[1], q[2]))) v[k] = -v[k]! * 0.2;
      else c[k] = q[k];
    }
    const ny = c[1] + v[1]! * h;
    const hits = ctx.colliders.query(c[0] - half[0], ny - half[1], c[2] - half[2], c[0] + half[0], ny + half[1], c[2] + half[2]).filter((b) =>
      c[0] - half[0] < b.max[0] - 0.01 && c[0] + half[0] > b.min[0] + 0.01 && c[2] - half[2] < b.max[2] - 0.01 && c[2] + half[2] > b.min[2] + 0.01 && ny - half[1] < b.max[1] && ny + half[1] > b.min[1]);
    if (!hits.length) { c[1] = ny; continue; }
    if (v[1]! < 0) {
      c[1] = Math.max(...hits.map((b) => b.max[1])) + half[1];
      landed = true;
    } else v[1] = 0;
  }
  s.poses = [c[0], c[1], c[2], s.poses[3]!, s.poses[4]!, s.poses[5]!, s.poses[6]!];
  if (c[1] < ctx.floor.bounds.min[1] - 3) { goHome(ctx, s, cfg); return; }
  if (landed) {
    const bottom: Vec3 = [c[0], c[1] - cfg.half[1], c[2]];
    const sl = nearestSlot(ctx, cfg, bottom, null, null);
    const speed = Math.hypot(v[0]!, v[1]!, v[2]!);
    if (sl) {
      setRest(s, cfg, sl.slot.pos, sl.slot.yaw ?? s.yaw);
      s.slot = 1;
      ctx.cue('carry.place', centerOf(s), data(cfg, { receiver: sl.receiver, speed }));
    } else {
      setRest(s, cfg, bottom, s.yaw);
      ctx.cue('carry.land', centerOf(s), data(cfg, { speed }));
    }
  }
}

function initItem(ctx: PartContext, body: boolean): ItemState {
  const cfg = itemCfg(ctx.spec, ctx.floor.cells);
  const s: ItemState = {
    poses: [], yaw: 0, held: null, mode: REST, vel: [0, 0, 0], handle: -1, moved: 0, carried: 0, stage: 0,
    fill: cfg.fluid ? clamp(pNum(ctx.spec, 'fill', 0), 0, 1) : 0, spilled: 0, away: 0, last: [0, 0, 0], air: 0, swap: null, swapTick: -9,
    flyT: 0, prevReset: 0, prevScatter: 0, spillT: 0, prev: [0, 0, 0], slot: pBool(ctx.spec, 'float', false) ? 1 : 0, seed: 0,
  };
  for (let i = 0; i < ctx.id.length; i++) s.seed = (s.seed * 31 + ctx.id.charCodeAt(i)) % 997;
  setRest(s, cfg, cfg.home, cfg.homeYaw);
  s.prev = centerOf(s);
  if (body) {
    const q = quatYaw(cfg.homeYaw);
    s.handle = ctx.physics!.addDynamicBox(centerOf(s), cfg.half, {
      ball: cfg.ball, rotation: q, density: pNum(ctx.spec, 'density', 300), friction: pNum(ctx.spec, 'friction', 0.6), restitution: pNum(ctx.spec, 'restitution', 0.1),
      linearDamping: pNum(ctx.spec, 'linearDamping', cfg.ball ? 0.2 : 0.05), angularDamping: pNum(ctx.spec, 'angularDamping', cfg.ball ? 0.8 : 0.2),
    });
  }
  return s;
}

function stepItem(s: ItemState, ctx: PartContext, body: boolean): void {
  const cfg = itemCfg(ctx.spec, ctx.floor.cells);
  // 入力: 元の所へ・散らばる
  const rv = ctx.input('reset');
  if (rv > 0.5 && s.prevReset <= 0.5) goHome(ctx, s, cfg);
  s.prevReset = rv;
  const sv = ctx.input('scatter');
  if (sv > 0.5 && s.prevScatter <= 0.5 && cfg.scatter.length) {
    const k = (((cfg.scatterSlot + Math.round(sv - 1)) % cfg.scatter.length) + cfg.scatter.length) % cfg.scatter.length;
    const sp = cfg.scatter[k]!;
    release(ctx, s);
    setRest(s, cfg, [sp[0], sp[1], sp[2]], sp[3]);
    s.moved = 1;
    syncBody(ctx, s);
  }
  s.prevScatter = sv;
  const locked = ctx.wired('lock') && ctx.input('lock') > 0.5;

  if (s.mode === HELD) {
    const p = holderOf(ctx, s);
    if (!p) { s.held = null; s.mode = REST; syncBody(ctx, s); }
    else stepHeld(ctx, s, cfg, p);
  } else {
    // 拾う・入れ替える
    const who = ctx.interactedBy();
    if (who && cfg.pickable && !locked) {
      const ix = carryIndex(ctx.floor);
      const swapWith = who.holding && who.holding !== ctx.id && ix.specs.has(who.holding) ? who.holding : null;
      if (who.holding === null || swapWith) {
        if (swapWith) {
          s.swap = [s.poses[0]!, s.poses[1]! - cfg.half[1], s.poses[2]!, s.yaw, s.slot];
          s.swapTick = ctx.tick;
        }
        s.held = who.id;
        who.holding = ctx.id;
        s.mode = HELD;
        s.slot = 0;
        s.moved = 1;
        s.last = [...who.pos];
        s.air = 0;
        if (body && ctx.physics) ctx.physics.setBodyEnabled(s.handle, false);
        ctx.cue(swapWith ? 'carry.swap' : 'carry.pick', centerOf(s), data(cfg, { player: who.id }));
      }
    }
    // 支えが無くなった（下の物を取った）置いてある物は落ちる（6 tick ごとに見る）
    if (!body && s.mode === REST && !cfg.float && !s.slot && (ctx.tick + s.seed) % 6 === 0) {
      const bottom = s.poses[1]! - cfg.half[1];
      const h = yawHalf(cfg.half, s.yaw);
      const sup = supportBelow(ctx.colliders, s.poses[0]!, s.poses[2]!, h[0] * 0.5, h[2] * 0.5, bottom + 0.05, bottom - 4);
      if (sup === null || sup < bottom - 0.03) { s.mode = FLY; s.vel = [0, 0, 0]; s.flyT = 0; }
    }
    if (!body && s.mode === FLY) stepFly(ctx, s, cfg);
    if (!body && cfg.bounds && s.mode !== HELD && !aabbContains(cfg.bounds, centerOf(s), 0.3)) goHome(ctx, s, cfg);
  }
  // 調べられる範囲（持っている間は無し）・当たる物
  const a = itemAabb(s, cfg.half);
  ctx.setInteractable(s.mode !== HELD && cfg.pickable && !locked ? aabbExpand(a, Math.max(0.06, 0.16 - Math.min(cfg.half[0], cfg.half[2]))) : null, ctx.tuning['carry.item.range']);
  if (!body && cfg.solid) ctx.setCollider('body', s.mode === REST ? a : null);
  outputs(s, ctx, cfg);
}

function outputs(s: ItemState, ctx: PartContext, cfg: ItemCfg): void {
  let returned = 0;
  if (cfg.homeRegion) {
    const inside = aabbContains(cfg.homeRegion, centerOf(s), 0.05);
    if (!inside) s.away = 1;
    returned = s.away && s.mode === REST && inside ? 1 : 0;
  }
  ctx.output('held', s.mode === HELD ? 1 : 0);
  ctx.output('moved', s.moved);
  ctx.output('fill', s.fill);
  ctx.output('stage', s.stage);
  ctx.output('returned', returned);
  ctx.output('away', s.away);
  ctx.output('flying', s.mode === FLY ? 1 : 0);
}

const OUTPUTS = ['held', 'moved', 'fill', 'stage', 'returned', 'away', 'flying'] as const;
const INPUTS = ['reset', 'scatter', 'lock'] as const;

export const CARRY_ITEM: PartDef<ItemState> = definePart<ItemState>({
  type: 'carryItem',
  outputs: OUTPUTS,
  inputs: INPUTS,
  init: (ctx) => initItem(ctx, false),
  step: (s, ctx) => stepItem(s, ctx, false),
});

export const CARRY_BODY: PartDef<ItemState> = definePart<ItemState>({
  type: 'carryBody',
  physics: true,
  outputs: OUTPUTS,
  inputs: INPUTS,
  init: (ctx) => initItem(ctx, true),
  step: (s, ctx) => stepItem(s, ctx, true),
  post(s, ctx) {
    if (s.mode === HELD || !ctx.physics) return;
    const cfg = itemCfg(ctx.spec, ctx.floor.cells);
    const pose = ctx.physics.pose(s.handle);
    if (!pose) return;
    s.prev = centerOf(s);
    s.poses = [...pose.pos, ...pose.rot];
    const [x, y, z, w] = pose.rot;
    s.yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x));
    const v = ctx.physics.velocity(s.handle) ?? [0, 0, 0];
    s.vel = v;
    const moving = Math.hypot(v[0], v[1], v[2]) > 0.08;
    if (moving) { s.mode = FLY; s.flyT += ctx.dt; } else if (s.mode === FLY) { s.mode = REST; s.flyT = 0; ctx.cue('carry.land', pose.pos, data(cfg)); }
    if (pose.pos[1] < ctx.floor.bounds.min[1] - 2 || (cfg.bounds && !aabbContains(cfg.bounds, pose.pos, 0.5))) goHome(ctx, s, cfg);
  },
});

/** 持てる物の部品か */
export const isItem = (spec: EntitySpec): boolean => ITEM_TYPES.has(spec.type);
