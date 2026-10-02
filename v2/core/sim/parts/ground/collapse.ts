/**
 * 崩れていく帰り道（G03）の部品 collapseFloor: 深い穴の上の床板の群れと、奥の装置。
 * - 床板は普段は崩れない（ただの床）。装置を調べると（E / タップ）警報が鳴り、装置の近くの床板から順に、
 *   入口の方へ崩れていく（崩れの前線は waveSpeed m/s。前線が来た床板は shakeSec 秒揺れて落ちる）
 * - 全部落ちて restoreSec 秒たつと、床板は全部戻り、装置はまた使える
 * - 出力: active（崩れている間〜戻るまで 1）・fallen（落ちた床板の割合）
 *
 * params: tiles [[x0, z0, x1, z1] …]（床板の上面は y、厚さ thick）・origin [x, z]（崩れの始まり）・device { min, max }（調べる箱）・
 *   waveSpeed・delaySec（調べてから崩れ始めるまで）・shakeSec・restoreSec・mat
 */
import { aabbCenter, type AABB } from '../../../math/aabb.ts';
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pNum, type PartContext } from '../../part.ts';

interface CollapseState { mode: number; t: number; phase: number[]; drop: number[]; last: number; [k: string]: Json | undefined }

function tilesOf(ctx: PartContext): number[][] {
  const v = ctx.spec.params.tiles;
  return Array.isArray(v) ? (v as number[][]) : [];
}

function tileBox(r: number[], y: number, th: number): AABB {
  return { min: [r[0]!, y - th, r[1]!], max: [r[2]!, y, r[3]!] };
}

/** 崩れの始まりから床板の真ん中までの距離 */
function distOf(ctx: PartContext, r: number[]): number {
  const o = ctx.spec.params.origin as number[];
  return Math.hypot((r[0]! + r[2]!) / 2 - o[0]!, (r[1]! + r[3]!) / 2 - o[1]!);
}

definePart<CollapseState>({
  type: 'collapseFloor',
  outputs: ['active', 'fallen', 'triggered'],
  init(ctx) {
    const tiles = tilesOf(ctx);
    const y = pNum(ctx.spec, 'y', 0), th = pNum(ctx.spec, 'thick', 0.12);
    tiles.forEach((r, i) => ctx.setCollider(`t${i}`, tileBox(r, y, th)));
    ctx.setInteractable(pAabb(ctx.spec, 'device'), 2.4);
    return { mode: 0, t: 0, phase: tiles.map(() => 0), drop: tiles.map(() => 0), last: 0 };
  },
  step(s, ctx) {
    const tiles = tilesOf(ctx);
    const y = pNum(ctx.spec, 'y', 0), th = pNum(ctx.spec, 'thick', 0.12);
    const speed = pNum(ctx.spec, 'waveSpeed', 4.5), delay = pNum(ctx.spec, 'delaySec', 0.25), shake = pNum(ctx.spec, 'shakeSec', 0.35);
    const device = pAabb(ctx.spec, 'device');
    let triggered = 0;
    if (s.mode === 0 && ctx.interactedBy()) {
      s.mode = 1; s.t = 0; triggered = 1;
      ctx.cue('collapse.trigger', aabbCenter(device));
    }
    if (s.mode >= 1) {
      s.t += ctx.dt;
      let falling = 0, fx = 0, fz = 0, shaking = 0, sx = 0, sz = 0, done = 0;
      for (let i = 0; i < tiles.length; i++) {
        const r = tiles[i]!;
        const start = delay + distOf(ctx, r) / speed;
        if (s.phase[i] === 0 && s.t >= start) { s.phase[i] = 1; shaking++; sx += (r[0]! + r[2]!) / 2; sz += (r[1]! + r[3]!) / 2; }
        if (s.phase[i] === 1 && s.t >= start + shake) {
          s.phase[i] = 2;
          ctx.setCollider(`t${i}`, null);
          falling++; fx += (r[0]! + r[2]!) / 2; fz += (r[1]! + r[3]!) / 2;
          s.last = s.t;
        }
        if (s.phase[i] === 2) { s.drop[i] = s.drop[i]! + ctx.dt * (2 + s.drop[i]! * 4); done++; }
      }
      // 音: その tick に揺れ始めた・落ちた床板の真ん中で 1 つずつ
      if (shaking) ctx.cue('collapse.shake', [sx / shaking, y, sz / shaking] as Vec3, { n: shaking });
      if (falling) ctx.cue('collapse.fall', [fx / falling, y, fz / falling] as Vec3, { n: falling });
      if (done === tiles.length) {
        s.mode = 2;
        if (s.t - s.last >= pNum(ctx.spec, 'restoreSec', 8)) {
          tiles.forEach((r, i) => { s.phase[i] = 0; s.drop[i] = 0; ctx.setCollider(`t${i}`, tileBox(r, y, th)); });
          s.mode = 0; s.t = 0;
          ctx.cue('collapse.restore', aabbCenter(device));
        }
      }
    }
    ctx.output('active', s.mode >= 1 ? 1 : 0);
    ctx.output('fallen', tiles.length ? s.phase.filter((p) => p === 2).length / tiles.length : 0);
    ctx.output('triggered', triggered);
  },
});
