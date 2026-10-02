/**
 * 溝を渡る手段を自分で作る部品（ドミノの橋 G06・箱の橋 G07・重りの床 G10・天秤 BG06）。どれも物理（Rapier）を使わない決まった動き。
 *
 * - domino: 並んだ背の高い棚の 1 枚。押すと（E / タップ）押した人から離れる向きに倒れ、隣（params.prev / next）を倒す。
 *     端の「橋の棚」（params.fixed）は決まった向き（溝を横切る向き）に倒れて橋になる。橋の棚は直接は押せない
 *     （鎖が当たるか、入力 drop で倒れる）。出力 fallen
 * - crate: 升目の上の箱。調べると押した人から離れる向きへ 1 升動く（ほかの箱・塞がった升・人のいる升には動かない）。
 *     穴の升（'o'）へ押すと落ちて床になる（上に乗れる）。入力 reset で最初の位置へ戻る（穴も空に戻る）。
 *     liftBy の升の上では、その部品（mover）の高さに合わせて上下する（天秤の皿の上）
 * - loadPlate: 区画の上の重さ（人 1 人 = 1、箱 = 箱の weight）。出力 load・pressed（load ≥ need）
 * - balanceScale: 天秤の 2 枚の皿の重さを比べ、皿の高さ（mover の target）を出す。両方に同じ重さ（> 0）が holdSec 秒載ると balanced
 * - floorGoto: 入力 go が入ったら、Cue 'floor.goto' でフロアを移る（ClientGame。data.to = 'depth.variant'、無ければ 1 つ下）
 */
import { aabbCenter, type AABB } from '../../../math/aabb.ts';
import { approach, clamp, lookDir, type Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pBool, pNum, playerIn, pStr, type PartContext } from '../../part.ts';

const ON = 0.5;

// ---------------------------------------------------------------- ドミノの棚（1 枚ずつの部品。調べたときにどの棚かを視線で決められるように）
interface DominoState { ang: number; dir: number; [k: string]: Json | undefined }

/** 棚を倒し始める。d: +1 = 鎖の次（params.next）の側へ / -1 = 前（params.prev）の側へ。橋の棚は決まった向き（params.fixed） */
function startFall(s: DominoState, ctx: PartContext, d: number): boolean {
  if (s.dir !== 0) return false;
  const fixed = ctx.spec.params.fixed;
  s.dir = typeof fixed === 'number' ? fixed : d;
  s.ang = 0.001;
  return true;
}

definePart<DominoState>({
  type: 'domino',
  outputs: ['fallen', 'moving'],
  inputs: ['drop'],
  init(ctx) {
    ctx.setCollider('box', pAabb(ctx.spec, 'stand'));
    if (pBool(ctx.spec, 'push', false)) ctx.setInteractable(pAabb(ctx.spec, 'stand'), 2.8);
    return { ang: 0, dir: 0 };
  },
  step(s, ctx) {
    const axis = pStr(ctx.spec, 'axis', 'x') === 'x' ? 0 : 2;
    // 押す: 押した人から離れる向き（鎖の向きの軸で。真正面なら見ている向き）
    const who = ctx.interactedBy();
    if (who && s.dir === 0) {
      const c = aabbCenter(pAabb(ctx.spec, 'stand'));
      const du = c[axis] - who.pos[axis];
      let d = Math.abs(du) > 0.12 ? Math.sign(du) : Math.sign(lookDir(who.yaw, 0)[axis]);
      if (!d) d = 1;
      // fwd: 鎖の次の棚が、軸の + の側（1）か - の側（-1）か
      if (startFall(s, ctx, d * pNum(ctx.spec, 'fwd', 1))) ctx.cue('domino.push', c);
    }
    // 隣の棚が自分の方へ倒れてきた（倒れ始めて 0.32 を過ぎた）
    if (s.dir === 0) {
      const prev = ctx.spec.params.prev, next = ctx.spec.params.next;
      const ps = typeof prev === 'string' ? (ctx.stateOf(prev) as DominoState | null) : null;
      const ns = typeof next === 'string' ? (ctx.stateOf(next) as DominoState | null) : null;
      const isBridge = (id: unknown): boolean => typeof id === 'string' && typeof ctx.floor.entities.find((e) => e.id === id)?.params.fixed === 'number';
      if (ps && ps.dir === 1 && ps.ang >= 0.32 && !isBridge(prev)) startFall(s, ctx, 1);
      else if (ns && ns.dir === -1 && ns.ang >= 0.32 && !isBridge(next)) startFall(s, ctx, -1);
    }
    if (ctx.input('drop') > ON) startFall(s, ctx, 1);
    let moving = 0;
    if (s.dir !== 0 && s.ang < 1) {
      moving = 1;
      const before = s.ang;
      s.ang = Math.min(1, before + ctx.dt * (0.8 + 4.5 * before));
      if (before < 0.55 && s.ang >= 0.55) {
        const lie = typeof ctx.spec.params.fixed === 'number' || s.dir > 0 ? pAabb(ctx.spec, 'lieP') : ctx.spec.params.lieN ? pAabb(ctx.spec, 'lieN') : pAabb(ctx.spec, 'lieP');
        ctx.setCollider('box', lie);
        ctx.setInteractable(null);
      }
      if (s.ang === 1) ctx.cue('domino.land', aabbCenter(pAabb(ctx.spec, 'stand')), { bridge: typeof ctx.spec.params.fixed === 'number' });
    }
    ctx.output('fallen', s.ang >= 1 ? 1 : 0);
    ctx.output('moving', moving);
  },
});

// ---------------------------------------------------------------- 箱（升目の上を押して動かす）
interface CrateGrid { x0: number; z0: number; c: number; rows: string[] }
interface CrateState { i: number; k: number; fi: number; fk: number; t: number; dropped: number; dy: number; [k: string]: Json | undefined }

const gridOf = (ctx: PartContext): CrateGrid => ctx.spec.params.grid as unknown as CrateGrid;
const cellChar = (g: CrateGrid, i: number, k: number): string => g.rows[k]?.[i] ?? '#';
const cellCenter = (g: CrateGrid, i: number, k: number): [number, number] => [g.x0 + (i + 0.5) * g.c, g.z0 + (k + 0.5) * g.c];

/** 箱の今の当たり判定（滑っている間は途中の位置。落ちた箱は穴の中で上面が床の少し下） */
function crateBox(ctx: PartContext, s: CrateState): AABB {
  const g = gridOf(ctx);
  const half = pNum(ctx.spec, 'half', 0.45), h = pNum(ctx.spec, 'h', 0.9), y = pNum(ctx.spec, 'y', 0);
  const [ax, az] = cellCenter(g, s.fi, s.fk), [bx, bz] = cellCenter(g, s.i, s.k);
  const k = clamp(s.t, 0, 1);
  const x = ax + (bx - ax) * k, z = az + (bz - az) * k;
  const top = s.dropped ? y - 0.04 : y + h + s.dy;
  return { min: [x - half, top - h, z - half], max: [x + half, top, z + half] };
}

definePart<CrateState>({
  type: 'crate',
  outputs: ['i', 'k', 'dropped', 'moved'],
  inputs: ['reset'],
  init(ctx) {
    const st = ctx.spec.params.start as number[];
    const s: CrateState = { i: st[0]!, k: st[1]!, fi: st[0]!, fk: st[1]!, t: 1, dropped: 0, dy: 0 };
    ctx.setCollider('box', crateBox(ctx, s));
    ctx.setInteractable(crateBox(ctx, s), 2.6);
    return s;
  },
  step(s, ctx) {
    const g = gridOf(ctx);
    let moved = 0;
    if (ctx.wired('reset') && ctx.input('reset') > ON) {
      const st = ctx.spec.params.start as number[];
      if (s.i !== st[0] || s.k !== st[1] || s.dropped) { s.i = s.fi = st[0]!; s.k = s.fk = st[1]!; s.t = 1; s.dropped = 0; ctx.cue('crate.reset', aabbCenter(crateBox(ctx, s))); }
    }
    const who = ctx.interactedBy();
    if (who && !s.dropped && s.t >= 1) {
      const [cx, cz] = cellCenter(g, s.i, s.k);
      const dx = cx - who.pos[0], dz = cz - who.pos[2];
      const [di, dk] = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      const ni = s.i + di, nk = s.k + dk;
      if (canMove(ctx, g, s, ni, nk)) {
        s.fi = s.i; s.fk = s.k; s.i = ni; s.k = nk; s.t = 0; moved = 1;
        ctx.cue('crate.push', [cx, pNum(ctx.spec, 'y', 0), cz]);
      } else ctx.cue('crate.blocked', [cx, pNum(ctx.spec, 'y', 0), cz]);
    }
    if (s.t < 1) {
      s.t = Math.min(1, s.t + ctx.dt / pNum(ctx.spec, 'slideSec', 0.35));
      if (s.t >= 1 && cellChar(g, s.i, s.k) === 'o' && !holeFilled(ctx, s.i, s.k)) { s.dropped = 1; ctx.cue('crate.drop', aabbCenter(crateBox(ctx, s))); }
    }
    // 皿の上: その部品の高さ（mover の状態 pos[1]）に合わせる
    s.dy = 0;
    const lift = ctx.spec.params.liftBy as { cells: number[][]; entity: string }[] | undefined;
    if (lift && !s.dropped) for (const l of lift) {
      if (!l.cells.some((c) => c[0] === s.i && c[1] === s.k)) continue;
      const st = ctx.stateOf(l.entity);
      const p = st && Array.isArray(st.pos) ? (st.pos as number[]) : null;
      if (p) s.dy = p[1]!;
    }
    const b = crateBox(ctx, s);
    ctx.setCollider('box', b);
    ctx.setInteractable(s.dropped ? null : b, 2.6);
    ctx.output('i', s.i);
    ctx.output('k', s.k);
    ctx.output('dropped', s.dropped);
    ctx.output('moved', moved);
  },
});

/** ほかの箱の状態（同じ組の箱。params.peers） */
function peers(ctx: PartContext): CrateState[] {
  const ids = (ctx.spec.params.peers as string[] | undefined) ?? [];
  return ids.filter((id) => id !== ctx.id).map((id) => ctx.stateOf(id) as CrateState | null).filter((x): x is CrateState => !!x);
}

function holeFilled(ctx: PartContext, i: number, k: number): boolean {
  return peers(ctx).some((p) => p.dropped && p.i === i && p.k === k);
}

function canMove(ctx: PartContext, g: CrateGrid, s: CrateState, ni: number, nk: number): boolean {
  const ch = cellChar(g, ni, nk);
  if (ch === '#') return false;
  // ほかの箱（落ちて床になった箱の上へは動ける）
  if (peers(ctx).some((p) => !p.dropped && ((p.i === ni && p.k === nk) || (p.t < 1 && p.fi === ni && p.fk === nk)))) return false;
  // 人のいる升へは動かない（押しつぶさない）
  const [cx, cz] = cellCenter(g, ni, nk);
  const r = g.c / 2 + 0.3;
  if (ctx.players.some((p) => Math.abs(p.pos[0] - cx) < r && Math.abs(p.pos[2] - cz) < r && p.pos[1] > pNum(ctx.spec, 'y', 0) - 0.5)) return false;
  // 穴: 空いていれば落ちる・埋まっていれば床
  void s;
  return true;
}

// ---------------------------------------------------------------- 重さの板
definePart<{ load: number }>({
  type: 'loadPlate',
  outputs: ['load', 'pressed'],
  init: () => ({ load: 0 }),
  step(s, ctx) {
    s.load = plateLoad(ctx, pAabb(ctx.spec, 'aabb'), (ctx.spec.params.crates as string[] | undefined) ?? []);
    ctx.output('load', s.load);
    ctx.output('pressed', s.load >= pNum(ctx.spec, 'need', 1) ? 1 : 0);
  },
});

/** 区画の上の重さ: 人 1 人 = 1、箱 = weight（区画の中に真ん中がある、落ちていない箱） */
function plateLoad(ctx: PartContext, a: AABB, crates: string[]): number {
  let load = ctx.players.filter((p) => playerIn(p, a) && p.onGround).length;
  for (const id of crates) {
    const st = ctx.stateOf(id) as CrateState | null;
    if (!st || st.dropped || st.t < 1) continue;
    const spec = ctx.floor.entities.find((e) => e.id === id);
    const g = spec?.params.grid as unknown as CrateGrid | undefined;
    if (!g) continue;
    const [x, z] = cellCenter(g, st.i, st.k);
    if (x >= a.min[0] && x <= a.max[0] && z >= a.min[2] && z <= a.max[2]) load += typeof spec!.params.weight === 'number' ? spec!.params.weight : 1;
  }
  return load;
}

// ---------------------------------------------------------------- 天秤
definePart<{ t: number; done: number }>({
  type: 'balanceScale',
  outputs: ['left', 'right', 'tLeft', 'tRight', 'balanced', 'tilt'],
  init: () => ({ t: 0, done: 0 }),
  step(s, ctx) {
    const crates = (ctx.spec.params.crates as string[] | undefined) ?? [];
    const L = plateLoad(ctx, pAabb(ctx.spec, 'left'), crates), R = plateLoad(ctx, pAabb(ctx.spec, 'right'), crates);
    // 皿の高さ: 重い方が下がる（target 0 = いちばん上 / 1 = いちばん下。0.5 が釣り合い）
    const k = pNum(ctx.spec, 'perUnit', 0.5);
    const tilt = clamp((L - R) * k, -1, 1);
    ctx.output('left', L);
    ctx.output('right', R);
    ctx.output('tLeft', 0.5 + tilt / 2);
    ctx.output('tRight', 0.5 - tilt / 2);
    ctx.output('tilt', tilt);
    const ok = L > 0 && L === R && L >= pNum(ctx.spec, 'minLoad', 1);
    s.t = ok ? s.t + ctx.dt : 0;
    if (ok && s.t >= pNum(ctx.spec, 'holdSec', 2)) { if (!s.done) ctx.cue('balance.done', aabbCenter(pAabb(ctx.spec, 'left'))); s.done = 1; }
    else if (!pBool(ctx.spec, 'latch', true)) s.done = 0;
    ctx.output('balanced', s.done);
  },
});

// ---------------------------------------------------------------- フロアを移る
definePart<{ prev: number; sent: number }>({
  type: 'floorGoto',
  outputs: ['sent'],
  inputs: ['go'],
  init: () => ({ prev: 0, sent: 0 }),
  step(s, ctx) {
    const v = ctx.input('go') > ON ? 1 : 0;
    if (v && !s.prev) {
      const to = pStr(ctx.spec, 'to', '');
      ctx.cue('floor.goto', ctx.spec.params.pos ? (ctx.spec.params.pos as Vec3) : undefined, { kind: pStr(ctx.spec, 'kind', 'elevator'), ...(to ? { to } : {}) });
      s.sent++;
    }
    s.prev = v;
    ctx.output('sent', s.sent);
  },
});

/** 近づける（approach の再輸出。部品の中で使う） */
export const toward = approach;
