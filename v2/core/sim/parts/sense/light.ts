/**
 * 光と闇の部品（段階 4・担当 sense）。
 * - pattern: 時刻で入切する（点いている on 秒・消えている off 秒・位相 phase）。消える前の flicker 秒は 0.1 秒ごとに瞬く。
 *     出力 out（0/1）・warn（瞬いている間 1）。lamp の入力 on につなぐ（消える照明・光の波・雷）
 * - darkHazard: 暗闇に grace 秒いると「闇に捕まる」（入口 to へ戻す。体力は減らさない）。明るい所は pools（矩形 [x0, z0, x1, z1] か
 *     円 [x, z, r]）。poolLamps[i] があれば、その照明が半分以上の明るさの間だけ明るい。懐中電灯の光は数えない（闇は小さな光を恐れない）。
 *     明るい所に戻ると、たまった暗さは倍の速さで抜ける。出力 dark（たまった暗さ 0..1）・caught（捕まった回数）
 * - searchlight: 帯（lanes）ごとに、光の円が帯に沿って往復する。円に入ると見つかって、その帯の手前へ戻される（少し戻される）。
 *     捕まった回数が catchesToCorner 以上なら、戻す先は隅 corner（隠しの扉の前）。出力 caught（回数）・corner（隅へ送った）
 */
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, playerIn, type PartContext } from '../../part.ts';
import type { PlayerState } from '../../types.ts';
import { shuttle } from './common.ts';

/** 時刻 t の入切（点いていれば正の残り秒、消えていれば負の残り秒）と、瞬いているか */
export function patternAt(t: number, on: number, off: number, phase: number, flicker = 0): { on: boolean; left: number; warn: boolean } {
  const period = on + off;
  const u = (((t + phase) % period) + period) % period;
  if (u < on) {
    const left = on - u;
    const warn = left < flicker;
    // 瞬き: 残り時間を 0.1 秒で刻んで、奇数の刻みは消す
    const lit = !warn || Math.floor(left / 0.1) % 2 === 0;
    return { on: lit, left, warn };
  }
  return { on: false, left: -(period - u), warn: false };
}

definePart({
  type: 'pattern',
  outputs: ['out', 'warn'],
  init: () => ({}),
  step(_s, ctx) {
    const r = patternAt(ctx.time, pNum(ctx.spec, 'on', 4), pNum(ctx.spec, 'off', 2), pNum(ctx.spec, 'phase', 0), pNum(ctx.spec, 'flicker', 0));
    ctx.output('out', r.on ? 1 : 0);
    ctx.output('warn', r.warn ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 闇に捕まる
/** 点 (x, z) が明るいか（pools の照明の明るさは lamp 部品の状態 level） */
export function litAt(pools: readonly number[][], x: number, z: number, levelOf: (lamp: string) => number, lampIds: readonly (string | null)[]): boolean {
  for (let i = 0; i < pools.length; i++) {
    const q = pools[i]!;
    const lamp = lampIds[i];
    if (lamp && levelOf(lamp) < 0.5) continue;
    if (q.length >= 4) {
      if (x >= q[0]! && x <= q[2]! && z >= q[1]! && z <= q[3]!) return true;
    } else if (Math.hypot(x - q[0]!, z - q[1]!) <= q[2]!) return true;
  }
  return false;
}

interface DarkState { dark: { [id: string]: Json }; caught: number; [k: string]: Json | undefined }

const levelReader = (ctx: PartContext) => (lamp: string): number => {
  const st = ctx.stateOf(lamp);
  return st && typeof st.level === 'number' ? st.level : 1;
};

definePart<DarkState>({
  type: 'darkHazard',
  outputs: ['dark', 'caught'],
  init: () => ({ dark: {}, caught: 0 }),
  step(s, ctx) {
    const region = pAabb(ctx.spec, 'region');
    const pools = (ctx.spec.params.pools as number[][] | undefined) ?? [];
    const lamps = (ctx.spec.params.poolLamps as (string | null)[] | undefined) ?? [];
    const grace = pNum(ctx.spec, 'grace', 1.4);
    const level = levelReader(ctx);
    let worst = 0;
    for (const p of ctx.players) {
      let d = typeof s.dark[p.id] === 'number' ? (s.dark[p.id] as number) : 0;
      if (!playerIn(p, region)) { s.dark[p.id] = 0; continue; }
      const lit = litAt(pools, p.pos[0], p.pos[2], level, lamps);
      d = lit ? Math.max(0, d - ctx.dt * 2) : d + ctx.dt;
      if (d >= grace) {
        s.caught++;
        ctx.cue('dark.caught', [p.pos[0], p.pos[1] + 1, p.pos[2]]);
        ctx.respawn(p, toOf(ctx));
        d = 0;
      }
      s.dark[p.id] = d;
      worst = Math.max(worst, d / grace);
    }
    ctx.output('dark', worst);
    ctx.output('caught', s.caught);
  },
});

/** 戻す先（params.to = [x, y, z]・toYaw）。無ければチェックポイント */
function toOf(ctx: PartContext): { pos: Vec3; yaw: number } | undefined {
  const to = ctx.spec.params.to as number[] | undefined;
  return to ? { pos: [to[0]!, to[1]!, to[2]!], yaw: pNum(ctx.spec, 'toYaw', 0) } : undefined;
}

// ---------------------------------------------------------------- サーチライト
/**
 * 帯 k の光の円の中心（時刻 t）。lanes[k] = [ax, az, bx, bz, speed, phase]（a → b を往復）。試験の歩く人も同じ式で先を読む
 */
export function searchSpot(lane: readonly number[], t: number): [number, number] {
  const ax = lane[0]!, az = lane[1]!, bx = lane[2]!, bz = lane[3]!;
  const len = Math.hypot(bx - ax, bz - az);
  const s = shuttle(t, len, lane[4]!, 0, lane[5]!);
  const k = len > 1e-9 ? s.d / len : 0;
  return [ax + (bx - ax) * k, az + (bz - az) * k];
}

interface SearchState { spots: number[][]; caught: number; corner: number; [k: string]: Json | undefined }

definePart<SearchState>({
  type: 'searchlight',
  outputs: ['caught', 'corner'],
  init: (ctx) => ({ spots: ((ctx.spec.params.lanes as number[][] | undefined) ?? []).map((l) => searchSpot(l, 0)), caught: 0, corner: 0 }),
  step(s, ctx) {
    const lanes = (ctx.spec.params.lanes as number[][] | undefined) ?? [];
    const rects = (ctx.spec.params.laneRects as number[][] | undefined) ?? [];
    const backs = (ctx.spec.params.backs as number[][] | undefined) ?? [];
    const R = pNum(ctx.spec, 'radius', 0.9);
    const y = pNum(ctx.spec, 'y', 0);
    s.spots = lanes.map((l) => searchSpot(l, ctx.time));
    for (const p of ctx.players) {
      if (Math.abs(p.pos[1] - y) > 1.2) continue;
      for (let k = 0; k < lanes.length; k++) {
        const r = rects[k]!;
        if (p.pos[0] < r[0]! || p.pos[0] > r[2]! || p.pos[2] < r[1]! || p.pos[2] > r[3]!) continue;
        const sp = s.spots[k]!;
        if (Math.hypot(p.pos[0] - sp[0]!, p.pos[2] - sp[1]!) > R + 0.2) continue;
        s.caught++;
        ctx.cue('search.caught', [p.pos[0], y + 1, p.pos[2]], { lane: k });
        ctx.respawn(p, backTo(ctx, s, k, p, backs));
        break;
      }
    }
    ctx.output('caught', s.caught);
    ctx.output('corner', s.corner);
  },
});

/** 戻す先: 帯 k の手前の床（同じ横の位置）。捕まった回数が多ければ隅（params.corner） */
function backTo(ctx: PartContext, s: SearchState, k: number, p: PlayerState, backs: number[][]): { pos: Vec3; yaw: number } {
  const corner = ctx.spec.params.corner as number[] | undefined;
  const need = pNum(ctx.spec, 'catchesToCorner', 2);
  const y = pNum(ctx.spec, 'y', 0);
  if (corner && s.caught >= need) {
    s.corner = 1;
    return { pos: [corner[0]!, y + 0.02, corner[1]!], yaw: corner[2] ?? 0 };
  }
  // backs[k] = [x0, z0, x1, z1, yaw]（帯の手前の床の矩形）。今の横の位置を、矩形の中に寄せる
  const b = backs[k]!;
  const x = Math.min(Math.max(p.pos[0], b[0]! + 0.4), b[2]! - 0.4), z = Math.min(Math.max(p.pos[2], b[1]! + 0.4), b[3]! - 0.4);
  return { pos: [x, y + 0.02, z], yaw: b[4] ?? 0 };
}
