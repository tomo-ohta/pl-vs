/**
 * 光の床（段階 4・担当 sense）: 深い穴の上の床板が、光（か視線）の当たっている間だけ現れる。当たらなくなってから grace 秒で消える。
 *
 * - lightFloor: 床板の列 tiles（[x0, z0, x1, z1]。上面 y・厚さ thick）。mode で何が床を作るかが決まる
 *     beam  … 懐中電灯の光の円錐（半角 beamDeg・届く距離 beamRange）が床板の中心に当たっている [L13 照らした所だけ実体]
 *     seen  … 床板が画面に映っている（縦 vdeg・横 hdeg）[O07 見ている間だけある橋]
 *     spot  … 天井の動く光の円（道 spotPath を往復。両端で spotPause 秒止まる。半径 spotRadius）の中 [L03 動く照明の範囲]
 *     bands … 床板ごとの帯 band が点いている（帯ごとに点く on 秒・消える off 秒・位相 phase。消える前 warn 秒は瞬く）[L18 光の帯]
 *   状態: lit（床板ごとの残りの秒数。0 より大きければ床がある）・spot（光の円の中心 [x, z]）・bandLeft（帯ごとの、消えるまでの秒数。消えていれば負）
 *   出力: on（床のある床板の数）・standing（光の床の上に立っている人がいる）
 */
import type { AABB } from '../../../math/aabb.ts';
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pNum, pStr, type PartContext } from '../../part.ts';
import { flashlightHits, lineAt, lineLength, onScreen, shuttle } from './common.ts';

interface LightFloorState { lit: number[]; spot: number[]; bandLeft: number[]; [k: string]: Json | undefined }

const tilesOf = (ctx: PartContext): number[][] => (ctx.spec.params.tiles as number[][] | undefined) ?? [];

/** 帯の点き方: 時刻 t に点いているか・消えるまで（点いていれば正）/ 点くまで（消えていれば負）の秒数 */
export function bandPhase(t: number, on: number, off: number, phase: number): number {
  const period = on + off;
  const u = (((t + phase) % period) + period) % period;
  return u < on ? on - u : -(period - u);
}

/** 光の円の中心（道 path を往復）。試験の歩く人も同じ式で先を読む */
export function spotCenter(params: { [k: string]: Json }, t: number): [number, number] {
  const path = (params.spotPath as number[][] | undefined) ?? [[0, 0]];
  const len = lineLength(path);
  const s = shuttle(t, len, Number(params.spotSpeed ?? 1), Number(params.spotPause ?? 2), Number(params.spotPhase ?? 0));
  return lineAt(path, s.d);
}

definePart<LightFloorState>({
  type: 'lightFloor',
  outputs: ['on', 'standing'],
  init(ctx) {
    const n = tilesOf(ctx).length;
    const bands = Math.max(0, ...((ctx.spec.params.band as number[] | undefined) ?? [-1])) + 1;
    return { lit: new Array(n).fill(0), spot: spotCenter(ctx.spec.params, 0), bandLeft: new Array(bands).fill(0) };
  },
  step(s, ctx) {
    const tiles = tilesOf(ctx);
    const y = pNum(ctx.spec, 'y', 0);
    const thick = pNum(ctx.spec, 'thick', 0.12);
    const mode = pStr(ctx.spec, 'mode', 'beam');
    const grace = pNum(ctx.spec, 'grace', 0.8);
    const cell = ctx.spec.cell;
    const players = ctx.players;
    let on = 0;
    // 帯の点き方（帯ごと）
    if (mode === 'bands') {
      const phases = (ctx.spec.params.phase as number[] | undefined) ?? [];
      const onSec = pNum(ctx.spec, 'onSec', 4), offSec = pNum(ctx.spec, 'offSec', 2);
      s.bandLeft = s.bandLeft.map((_v, b) => bandPhase(ctx.time, onSec, offSec, phases[b] ?? 0));
    }
    if (mode === 'spot') s.spot = spotCenter(ctx.spec.params, ctx.time);
    const bandOf = (ctx.spec.params.band as number[] | undefined) ?? [];
    const radius = pNum(ctx.spec, 'spotRadius', 1.1);
    const beamDeg = pNum(ctx.spec, 'beamDeg', 28), beamRange = pNum(ctx.spec, 'beamRange', 8);
    const hdeg = pNum(ctx.spec, 'hdeg', 50), vdeg = pNum(ctx.spec, 'vdeg', 34), seenRange = pNum(ctx.spec, 'seenRange', 14);
    for (let i = 0; i < tiles.length; i++) {
      const r = tiles[i]!;
      const cx = (r[0]! + r[2]!) / 2, cz = (r[1]! + r[3]!) / 2;
      let hit = false;
      if (mode === 'beam') {
        const c: Vec3 = [cx, y, cz];
        hit = players.some((p) => flashlightHits(ctx.floor, p, c, beamDeg, beamRange, cell));
      } else if (mode === 'seen') {
        // 床板の中心と両端のどれかが画面に映っている
        const pts: Vec3[] = [[cx, y, cz], [r[0]!, y, r[1]!], [r[2]!, y, r[3]!]];
        hit = players.some((p) => pts.some((q) => onScreen(p, q, hdeg, vdeg, seenRange)));
      } else if (mode === 'spot') {
        const sp = s.spot as number[];
        // 床板のいちばん近い点が円の中
        const nx = Math.min(Math.max(sp[0]!, r[0]!), r[2]!), nz = Math.min(Math.max(sp[1]!, r[1]!), r[3]!);
        hit = Math.hypot(nx - sp[0]!, nz - sp[1]!) <= radius;
      } else if (mode === 'bands') {
        hit = (s.bandLeft[bandOf[i] ?? 0] ?? 0) > 0;
      }
      const before = s.lit[i]! > 0;
      s.lit[i] = hit ? grace + 1e-6 : Math.max(0, s.lit[i]! - ctx.dt);
      const now = s.lit[i]! > 0;
      if (now !== before) {
        const a: AABB = { min: [r[0]!, y - thick, r[1]!], max: [r[2]!, y, r[3]!] };
        ctx.setCollider(`t${i}`, now ? a : null);
      }
      if (now) on++;
    }
    const standing = players.some((p) => p.onGround && Math.abs(p.pos[1] - y) < 0.05 && tiles.some((r, i) => s.lit[i]! > 0 && p.pos[0] >= r[0]! - 0.3 && p.pos[0] <= r[2]! + 0.3 && p.pos[2] >= r[1]! - 0.3 && p.pos[2] <= r[3]! + 0.3));
    ctx.output('on', on);
    ctx.output('standing', standing ? 1 : 0);
  },
});
