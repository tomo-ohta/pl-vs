/**
 * 視線と観測の部品（段階 4・担当 sense）。
 * - daruma: だるまさんがころんだ。鬼（pos・壁を向く yaw）は数え歌（chant 秒。周期ごとに seed から長さが変わる）の間は壁を向き、歌が終わると振り返って
 *     watch 秒こちらを見る。見られている間に区画 region の中（safe の矩形 = 開口の前は除く）で動く（見られた所から tol m 以上・速さ 0.8 m/s 以上）と捕まり、
 *     入口 to へ戻される。catchesToCorner 回目からは隅 corner へ連れて行かれる（隠しの扉の前）。
 *     状態: phase（0 歌 / 1 振り返る / 2 見ている / 3 戻る）・t（phase の経過秒）・dur（phase の長さ）。出力 watching・caught・corner
 */
import { hashAll, Rng } from '../../../math/rng.ts';
import type { Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { definePart, pAabb, pBool, pNum, playerIn, type PartContext } from '../../part.ts';
import { blockedIn, inCone, onScreen } from './common.ts';

interface DarumaState { phase: number; t: number; dur: number; cycle: number; caught: number; corner: number; anchor: { [id: string]: Json }; [k: string]: Json | undefined }

/** 周期 cycle の歌・見る時間（seed から決まる） */
export function darumaDurations(seed: number, cycle: number, p: { chantMin: number; chantMax: number; watchMin: number; watchMax: number }): { chant: number; watch: number } {
  const r = new Rng(hashAll(seed, 'daruma', cycle));
  return { chant: r.float(p.chantMin, p.chantMax), watch: r.float(p.watchMin, p.watchMax) };
}

const durParams = (ctx: PartContext): { chantMin: number; chantMax: number; watchMin: number; watchMax: number } => ({
  chantMin: pNum(ctx.spec, 'chantMin', 2.5), chantMax: pNum(ctx.spec, 'chantMax', 5), watchMin: pNum(ctx.spec, 'watchMin', 2), watchMax: pNum(ctx.spec, 'watchMax', 3.5),
});

const inSafe = (safe: number[][], x: number, z: number): boolean => safe.some((r) => x >= r[0]! && x <= r[2]! && z >= r[1]! && z <= r[3]!);

definePart<DarumaState>({
  type: 'daruma',
  outputs: ['watching', 'caught', 'corner'],
  init(ctx) {
    const d = darumaDurations(pNum(ctx.spec, 'seed', 1), 0, durParams(ctx));
    return { phase: 0, t: 0, dur: d.chant, cycle: 0, caught: 0, corner: 0, anchor: {} };
  },
  step(s, ctx) {
    const turn = pNum(ctx.spec, 'turnSec', 0.35);
    const seed = pNum(ctx.spec, 'seed', 1);
    s.t += ctx.dt;
    if (s.t >= s.dur) {
      s.t -= s.dur;
      s.phase = (s.phase + 1) % 4;
      if (s.phase === 0) { s.cycle++; s.dur = darumaDurations(seed, s.cycle, durParams(ctx)).chant; ctx.cue('daruma.chant', undefined, { dur: s.dur }); }
      else if (s.phase === 2) { s.dur = darumaDurations(seed, s.cycle, durParams(ctx)).watch; s.anchor = {}; ctx.cue('daruma.look', pOf(ctx)); }
      else s.dur = turn;
    }
    const watching = s.phase === 2;
    if (watching) {
      const region = pAabb(ctx.spec, 'region');
      const safe = (ctx.spec.params.safe as number[][] | undefined) ?? [];
      const tol = pNum(ctx.spec, 'tol', 0.15);
      for (const p of ctx.players) {
        if (!playerIn(p, region) || inSafe(safe, p.pos[0], p.pos[2])) { delete s.anchor[p.id]; continue; }
        const a = s.anchor[p.id] as number[] | undefined;
        if (!a) { s.anchor[p.id] = [p.pos[0], p.pos[2]]; continue; }
        const moved = Math.hypot(p.pos[0] - a[0]!, p.pos[2] - a[1]!) > tol || Math.hypot(p.vel[0], p.vel[2]) > 0.8;
        if (!moved) continue;
        s.caught++;
        ctx.cue('daruma.caught', [p.pos[0], p.pos[1] + 1, p.pos[2]]);
        const corner = ctx.spec.params.corner as number[] | undefined;
        if (corner && s.caught >= pNum(ctx.spec, 'catchesToCorner', 3)) {
          s.corner = 1;
          ctx.respawn(p, { pos: [corner[0]!, corner[1]!, corner[2]!], yaw: corner[3] ?? 0 });
        } else {
          const to = ctx.spec.params.to as number[];
          ctx.respawn(p, { pos: [to[0]!, to[1]!, to[2]!], yaw: pNum(ctx.spec, 'toYaw', 0) });
        }
        delete s.anchor[p.id];
      }
    }
    ctx.output('watching', s.phase === 1 || s.phase === 2 ? 1 : 0);
    ctx.output('caught', s.caught);
    ctx.output('corner', s.corner);
  },
});

const pOf = (ctx: PartContext): Vec3 => {
  const p = ctx.spec.params.pos as number[];
  return [p[0]!, p[1]! + 1.4, p[2]!];
};

// ---------------------------------------------------------------- 見ていない間だけ進む時計
interface ClockState { hand: number; seen: number; unseen: number; [k: string]: Json | undefined }

/**
 * watchClock: 壁の時計（中心 pos）は、見られていない間だけ進む（12 時間で cycleSec 秒）。見ている = 時計が画面に映っている。
 * 出力: twelve（針が 12 時の前後 window 時間の中）・seen・hand（時。0..12）・unseen（見られずに続いた秒数。隠しの元）
 */
definePart<ClockState>({
  type: 'watchClock',
  outputs: ['twelve', 'seen', 'hand', 'unseen'],
  init: (ctx) => ({ hand: pNum(ctx.spec, 'start', 4), seen: 0, unseen: 0 }),
  step(s, ctx) {
    const c = ctx.spec.params.pos as number[];
    const pos: Vec3 = [c[0]!, c[1]!, c[2]!];
    const region = pAabb(ctx.spec, 'region');
    const inside = ctx.players.filter((p) => playerIn(p, region));
    // 見ている = 部屋の中の人の画面に映っている（時計は壁の高い所にあり、前は家具を置かないので、遮りは見ない）
    const seen = inside.some((p) => onScreen(p, pos, 48, 32, 16));
    if (!seen) s.hand = (s.hand + (12 / pNum(ctx.spec, 'cycleSec', 30)) * ctx.dt) % 12;
    s.seen = seen ? 1 : 0;
    s.unseen = inside.length && !seen ? s.unseen + ctx.dt : 0;
    const w = pNum(ctx.spec, 'window', 0.3);
    ctx.output('twelve', s.hand < w || s.hand > 12 - w ? 1 : 0);
    ctx.output('seen', s.seen);
    ctx.output('hand', s.hand);
    ctx.output('unseen', s.unseen);
  },
});

// ---------------------------------------------------------------- 見つめる
/**
 * gazeSensor: 区画 region の中の人が、点 target を見つめている（視線から deg 度以内・maxDist 以内・遮られない）時間が sec に達したら done（入ったまま）。
 * still なら、動かず視線も止めている間だけ数える（立ち止まって見つめる = 撮像のズーム）。
 * mode 'down': 下を見て（pitch が downPitch より下）動かずにいる = 目を閉じる（target は見ない）。出力 done・progress・gazing
 */
definePart<{ t: number; done: number }>({
  type: 'gazeSensor',
  outputs: ['done', 'progress', 'gazing'],
  init: () => ({ t: 0, done: 0 }),
  step(s, ctx) {
    const region = pAabb(ctx.spec, 'region');
    const still = pBool(ctx.spec, 'still', true);
    const down = ctx.spec.params.mode === 'down';
    const t = ctx.spec.params.target as number[] | undefined;
    const target: Vec3 = t ? [t[0]!, t[1]!, t[2]!] : [0, 0, 0];
    const deg = pNum(ctx.spec, 'deg', 6), maxDist = pNum(ctx.spec, 'maxDist', 30);
    const gazing = ctx.players.some((p) => {
      if (!playerIn(p, region)) return false;
      if (still && (p.moveRank !== 'still' || p.stillSec < pNum(ctx.spec, 'stillSec', 0.4))) return false;
      if (down) return p.pitch < pNum(ctx.spec, 'downPitch', -1.0);
      return inCone(p, target, deg, maxDist) && !blockedIn(ctx.floor, ctx.spec.cell ?? '', [p.pos[0], p.pos[1] + p.eye, p.pos[2]], target, 0.15);
    });
    s.t = gazing ? s.t + ctx.dt : 0;
    if (s.t >= pNum(ctx.spec, 'sec', 1.5)) s.done = 1;
    ctx.output('done', s.done);
    ctx.output('progress', Math.min(1, s.t / pNum(ctx.spec, 'sec', 1.5)));
    ctx.output('gazing', gazing ? 1 : 0);
  },
});

// ---------------------------------------------------------------- 記念撮影の機械
/** photoCam: 調べる（E / タップ）と写真を撮る（三脚のカメラ box）。出力 taken（一度でも撮った）・shots（撮った回数）。cue 'photo.shot' */
definePart<{ shots: number }>({
  type: 'photoCam',
  outputs: ['taken', 'shots'],
  init(ctx) {
    ctx.setInteractable(pAabb(ctx.spec, 'box'), 2.4);
    return { shots: 0 };
  },
  step(s, ctx) {
    if (ctx.interactedBy()) {
      s.shots++;
      ctx.cue('photo.shot', ctx.spec.params.eye ? (ctx.spec.params.eye as number[]).slice(0, 3) as Vec3 : undefined, { n: s.shots });
    }
    ctx.output('taken', s.shots > 0 ? 1 : 0);
    ctx.output('shots', s.shots);
  },
});
