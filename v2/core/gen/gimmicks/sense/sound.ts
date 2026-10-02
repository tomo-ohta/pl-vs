/**
 * 音の仕掛け（段階 4・担当 sense）。音は WebAudio の合成（クライアント）。音を消していても遊べるように、音の手がかりには光る印も付ける。
 *
 * - chimeOrder 音をつなぐ扉 [A02]: 行き止まりの部屋の壁に、高さの違う 5 つの鐘。入ると、鐘の並びの旋律が流れる（鳴る鐘が光る）。
 *     同じ順に鐘を鳴らすと隠しの扉が現れる（必ず付ける）。
 *     裏の振る舞い [BA03]: 逆の順に鳴らすと、別の壁に別の扉（出現型）
 * - loudGate マイクで開く扉 [A04]: 出口の扉に「音に反応する鍵」。扉の前で大きな音を出すと開く（マイクがあれば声。無ければ走る・跳んで着地する音）。
 *     マイクの音は外へ送らない（音量だけをその場で使う）
 * - quietGate 静かにすると開く [A10]: 出口の扉の前で、動かず音を立てずに 3 秒いると開く（マイクがあれば本当に静かに）
 * - extraSteps 足音が増える [A06]: 歩くと、自分の足音のすぐ後ろに、もう一人の足音（1.2 秒前の自分の位置をたどる）。
 *     裏の振る舞い [BA02]: しゃがんで音を立てずに歩き続けると、もう一人の足音だけが離れて壁まで歩き、壁を叩く。そこに隠しの扉
 * - paChase 遠くの館内放送 [A09]: 意味の取れない放送が壁のスピーカーから流れ、近づくと止んで、別のスピーカーから流れる。最後まで追うと、
 *     そのスピーカーの脇に隠しの扉（存在型・出現型）
 * - livingWall 壁の向こうの生活音 [A12]: 壁の向こうから食器・テレビ・話し声（くぐもった音）。
 *     裏の振る舞い [BA04]: その壁にもたれて（壁の前で止まって）4 秒いると、壁が扉になる（出現型。存在型 = 壁と同じ色の扉が最初からある）
 * - silentCorner 無音の隅 [BA01]: 暗い部屋。出口の前で小さな音が鳴る（音の道しるべ）。音と反対の隅は、一切の音が消える。
 *     その無音の隅で 3 秒止まると扉が現れる（出現型。存在型 = 暗がりに最初からある）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Box } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { aabbJson, doorZone, freeWallSpan, frontOf, innerRect } from '../util.ts';
import { darkenRoom, freeWalls, roomRegion, wallBox, wallPoint } from './util.ts';

/** 五音の高さ（鐘の音の高さの倍率） */
const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];

defineGimmick({
  id: 'chimeOrder', name: '音をつなぐ扉', axes: ['sound', 'puzzle'], kinds: ['room'], minSize: [4, 4.5], weight: 0.35, intensity: 1, offersSecret: true, requiresSecret: true, onMainPath: false,
  fits: (s) => s.openings.length === 1,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const ent = s.openings[0]!;
    // 扉の壁（入口の向かい）と、鐘の壁（残りの 2〜3 面）
    const opp = ((ent.dir + 2) % 4) as Dir;
    const doorSpan = freeWallSpan(s, opp, 1.6, 0.8);
    if (!doorSpan) return;
    const walls = ([0, 1, 2, 3] as const).filter((d) => d !== ent.dir);
    const slots: { d: Dir; at: number }[] = [];
    for (const d of walls) {
      const span = freeWallSpan(s, d, 1.0, 0.6);
      if (!span) continue;
      // 扉の壁では扉の場所を避ける
      const avoid = d === opp ? [doorSpan.at] : [];
      const n = d === opp ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const at = span.a0 + ((span.a1 - span.a0) * (i + 1)) / (n + 1);
        if (avoid.some((a) => Math.abs(a - at) < 1.0)) continue;
        slots.push({ d, at });
      }
    }
    if (slots.length < 5) {
      // 足りなければ、扉の壁の扉の両脇
      for (const sg of [-1, 1]) { const at = doorSpan.at + sg * 1.1; if (at > doorSpan.a0 - 0.3 && at < doorSpan.a1 + 0.3) slots.push({ d: opp, at }); }
    }
    if (slots.length < 5) return;
    const use = slots.slice(0, 5);
    const B: Box[] = [];
    const chimes: string[] = [];
    const positions: number[][] = [];
    use.forEach((c, i) => {
      // 壁から出た腕と、吊った鐘（調べる箱）
      B.push(wallBox(ctx, c.d, c.at, 0.02, y + 1.9, y + 1.94, 0, 0.32, 'metalDark'));
      B.push(wallBox(ctx, c.d, c.at, 0.006, y + 1.62, y + 1.9, 0.29, 0.302, 'metalDark'));
      const bell = wallBox(ctx, c.d, c.at, 0.12, y + 1.38, y + 1.62, 0.18, 0.42, 'goldTrim', false);
      B.push(bell);
      chimes.push(ctx.addEntity(`chime${i}`, { type: 'chime', params: { box: aabbJson(bell), note: i, pitch: PENTA[i]! } }));
      positions.push([(bell.min[0] + bell.max[0]) / 2, (bell.min[1] + bell.max[1]) / 2, (bell.min[2] + bell.max[2]) / 2]);
    });
    for (const b of B) ctx.addBox(b);
    const order = ctx.rng.shuffle([0, 1, 2, 3, 4]);
    ctx.addEntity('melody', { type: 'melody', params: { region: roomRegion(s), order, positions, interval: ctx.tuning['sense.chime.intervalSec'], period: ctx.tuning['sense.chime.periodSec'], pitches: PENTA } });
    const seq = (name: string, ord: number[]): string => {
      const inputs: { [k: string]: string } = {};
      ord.forEach((k, i) => { inputs[`s${i + 1}`] = `${chimes[k]}.rung`; });
      return ctx.addEntity(name, { type: 'sequence', params: { count: 5, resetOnWrong: true }, inputs });
    };
    const fwd = seq('order', order), rev = seq('reverse', order.slice().reverse());
    ctx.offerSecret({ hook: 'chime.order', modes: ['appear'], weight: 1, required: true, revealOutput: `${fwd}.done`, doorway: { dir: opp, at: doorSpan.at, y, width: 1.0, height: 2.0 }, tell: '旋律と同じ順の鐘' });
    // 逆の順（BA03）: 鐘の無い所の壁
    for (const d of walls.filter((x) => x !== opp)) {
      const span = freeWallSpan(s, d, 1.6, 0.8);
      if (!span) continue;
      // 鐘から 0.9 m 以上離れた所
      let at: number | null = null;
      for (let a = span.a0 + 0.6; a <= span.a1 - 0.6 && at === null; a += 0.2) if (!use.some((c) => c.d === d && Math.abs(c.at - a) < 0.9)) at = a;
      if (at === null) continue;
      ctx.offerSecret({ hook: 'chime.reverse', modes: ['appear'], weight: 0.8, revealOutput: `${rev}.done`, doorway: { dir: d, at, y, width: 1.0, height: 2.0 }, tell: '旋律を逆に辿る' });
      break;
    }
    ctx.addEntity('glow', { type: 'senseFx', params: { fx: 'chimes', chimes, positions, pitches: PENTA } });
  },
});

/** 音で開く扉（loud / quiet）。出口の扉に鍵を掛け、扉の前の音量で開ける */
function gate(ctx: GimmickContext, mode: 'loud' | 'quiet'): void {
  const s = ctx.slot, t = ctx.tuning;
  const y = s.cell.floorY;
  const door = ctx.doorAt(s.exit!);
  if (!door) return;
  const zone = doorZone(s.exit!, y, 2.4, 0.7);
  const g = ctx.addEntity('gate', { type: 'noiseGate', params: { zone: aabbJson(zone), mode, level: mode === 'loud' ? t['sense.gate.loudLevel'] : t['sense.gate.quietLevel'], sec: t['sense.gate.quietSec'] } });
  const closed = ctx.addEntity('closed', { type: 'not', params: {}, inputs: { in: `${g}.open` } });
  const inside = ctx.addEntity('inside', { type: 'zoneSensor', params: { aabb: roomRegion(s) } });
  const lock = ctx.addEntity('lock', { type: 'and', params: {}, inputs: { a: `${closed}.out`, b: `${inside}.in` } });
  door.inputs = { ...(door.inputs ?? {}), lock: `${lock}.out` };
  // 扉の脇の、音量の目盛り（描画）と、スピーカーの格子
  const ex = s.exit!;
  const along = ex.dir % 2 === 0 ? ex.pos[0] : ex.pos[2];
  const r = innerRect(s);
  const lo = ex.dir % 2 === 0 ? r.x0 : r.z0, hi = ex.dir % 2 === 0 ? r.x1 : r.z1;
  const side = along - lo > hi - along ? -1 : 1;
  const mAt = along + side * (ex.width / 2 + 0.45);
  ctx.addBox(wallBox(ctx, ex.dir, mAt, 0.14, y + 1.15, y + 1.85, 0, 0.03, 'metalDark'));
  ctx.addBox(wallBox(ctx, ex.dir, mAt, 0.09, y + 1.95, y + 2.12, 0, 0.025, mode === 'loud' ? 'plasticRed' : 'signPlate'));
  const [mx, mz] = wallPoint(ctx, ex.dir, mAt, 0.032);
  ctx.addEntity('meter', { type: 'senseFx', params: { fx: 'gateMeter', gate: g, door: door.id, mode, pos: [mx, y + 1.5, mz], dir: ex.dir, level: mode === 'loud' ? t['sense.gate.loudLevel'] : t['sense.gate.quietLevel'] } });
  ctx.keepOut(doorZone(ex, y, 2.4, 0.8));
}

defineGimmick({
  id: 'loudGate', name: 'マイクで開く扉', axes: ['sound'], kinds: ['room', 'hall'], minSize: [3.6, 4], weight: 0.3, intensity: 0, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build: (ctx) => gate(ctx, 'loud'),
});

defineGimmick({
  id: 'quietGate', name: '静かにすると開く', axes: ['sound', 'time'], kinds: ['room', 'hall'], minSize: [3.6, 4], weight: 0.3, intensity: 0, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build: (ctx) => gate(ctx, 'quiet'),
});

defineGimmick({
  id: 'extraSteps', name: '足音が増える', axes: ['sound'], kinds: ['room', 'hall'], minSize: [4.5, 6.5], weight: 0.3, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const w = freeWalls(ctx, 1.6)[0];
    if (!w) return;
    const [tx, tz] = wallPoint(ctx, w.d, w.at, 0.5);
    const ghost = ctx.addEntity('ghost', { type: 'ghostSteps', params: { region: roomRegion(s), lagSec: 1.2, sneakSec: t['sense.steps.sneakSec'], target: [tx, y, tz] } });
    ctx.offerSecret({ hook: 'steps.sneak', modes: ['present', 'appear'], weight: 1, revealOutput: `${ghost}.knocked`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '音を立てずに歩くと、もう一人の足音が向かう壁' });
    const [fx, fz] = wallPoint(ctx, w.d, w.at, 0.9);
    ctx.keepOut({ min: [fx - 0.9, y, fz - 0.9], max: [fx + 0.9, y + 2.5, fz + 0.9] });
  },
});

defineGimmick({
  id: 'paChase', name: '遠くの館内放送', axes: ['sound'], kinds: ['hall', 'room'], minSize: [6, 8], weight: 0.3, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    // スピーカー: 壁の高い所に 4 つ（入口から遠い所を最後に。次のスピーカーは前のものから遠く）
    const cands: { d: Dir; at: number; p: [number, number] }[] = [];
    for (const d of [0, 1, 2, 3] as const) {
      const span = freeWallSpan(s, d, 0.8, 0.5);
      if (!span) continue;
      for (const f of [0.2, 0.5, 0.8]) { const at = span.a0 + (span.a1 - span.a0) * f; cands.push({ d, at, p: wallPoint(ctx, d, at, 0.1) }); }
    }
    const e = frontOf(s.entrance!, 1.0);
    // 最後（隠しの扉の脇）: 開口の無い壁で、入口から遠い所
    const last = freeWalls(ctx, 2.8)[0];
    if (!last || cands.length < 4) return;
    const doorAt = last.at, spAt = Math.min(last.a1 - 0.2, doorAt + 1.0);
    const final = { d: last.d, at: spAt, p: wallPoint(ctx, last.d, spAt, 0.1) };
    const order: typeof cands = [];
    let prev: [number, number] = [e[0], e[2]];
    const pool = cands.filter((c) => Math.hypot(c.p[0] - final.p[0], c.p[1] - final.p[1]) > 2.5);
    for (let k = 0; k < 3 && pool.length; k++) {
      pool.sort((a, b) => Math.hypot(b.p[0] - prev[0], b.p[1] - prev[1]) - Math.hypot(a.p[0] - prev[0], a.p[1] - prev[1]));
      const c = pool.splice(Math.min(pool.length - 1, ctx.rng.int(0, 1)), 1)[0]!;
      order.push(c);
      prev = c.p;
    }
    order.push(final);
    if (order.length < 3) return;
    const sy = y + Math.min(2.35, s.cell.height - 0.35);
    for (const c of order) ctx.addBox(wallBox(ctx, c.d, c.at, 0.16, sy - 0.1, sy + 0.1, 0, 0.08, 'metalDark'));
    const speakers = order.map((c) => [c.p[0], sy, c.p[1]]);
    const pa = ctx.addEntity('pa', { type: 'paChase', params: { speakers, region: roomRegion(s), near: 2.4, period: ctx.tuning['sense.pa.periodSec'] } });
    ctx.offerSecret({ hook: 'pa.chase', modes: ['present', 'appear'], weight: 1, revealOutput: `${pa}.found`, doorway: { dir: last.d, at: doorAt, y, width: 1.0, height: 2.0 }, tell: '最後のスピーカーの脇' });
    const [fx, fz] = wallPoint(ctx, last.d, doorAt, 0.9);
    ctx.keepOut({ min: [fx - 1.2, y, fz - 1.2], max: [fx + 1.2, y + 2.5, fz + 1.2] });
  },
});

defineGimmick({
  id: 'livingWall', name: '壁の向こうの生活音', axes: ['sound'], kinds: ['room', 'hall'], minSize: [4, 4.5], weight: 0.3, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const w = freeWalls(ctx, 1.6)[0];
    if (!w) return;
    // 音の出る所: 壁の 1 m 向こう
    const [bx, bz] = wallPoint(ctx, w.d, w.at, -1.0);
    const [fx, fz] = wallPoint(ctx, w.d, w.at, 0.45);
    const lean = ctx.addEntity('lean', { type: 'dwellSensor', params: { aabb: aabbJson(w.d % 2 === 0 ? { min: [fx - 0.6, y - 0.1, fz - 0.45], max: [fx + 0.6, y + 2, fz + 0.45] } : { min: [fx - 0.45, y - 0.1, fz - 0.6], max: [fx + 0.45, y + 2, fz + 0.6] }), sec: t['sense.living.leanSec'], still: true } });
    ctx.addEntity('sounds', { type: 'senseFx', params: { fx: 'living', pos: [bx, y + 1.2, bz], lean } });
    ctx.offerSecret({ hook: 'living.lean', modes: ['present', 'appear'], weight: 1, revealOutput: `${lean}.done`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '壁の向こうの食器とテレビの音' });
    const [kx, kz] = wallPoint(ctx, w.d, w.at, 0.9);
    ctx.keepOut({ min: [kx - 0.9, y, kz - 0.9], max: [kx + 0.9, y + 2.5, kz + 0.9] });
  },
});

defineGimmick({
  id: 'silentCorner', name: '無音の隅', axes: ['sound', 'light'], kinds: ['room', 'hall'], minSize: [4.5, 5.5], weight: 0.3, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const y = s.cell.floorY;
    const ex = s.exit!;
    // 無音の隅: 出口（音）からいちばん遠い、開口の無い壁
    const xp = ex.pos;
    const w = freeWalls(ctx, 1.6)
      .map((x) => { const q = wallPoint(ctx, x.d, x.at, 0); return { ...x, far: Math.hypot(q[0] - xp[0], q[1] - xp[2]) }; })
      .sort((a, b) => b.far - a.far)[0];
    if (!w || w.far < 4) return;
    darkenRoom(ctx);
    const f = frontOf(ex, 0.6);
    ctx.addEntity('beacon', { type: 'soundBeacon', params: { pos: [f[0], y + 1.2, f[2]], kind: ctx.rng.pick(['chime', 'drip', 'phoneRing']), period: ctx.rng.float(2.0, 3.0) } });
    const g = frontOf(ex, 0.05);
    ctx.addBox(box([g[0] - 0.2, y + 2.15, g[2] - 0.2], [g[0] + 0.2, y + 2.25, g[2] + 0.2], 'lightGreen', false));
    const [cx, cz] = wallPoint(ctx, w.d, w.at, 0.8);
    const zone = { min: [cx - 1.0, y - 0.1, cz - 1.0], max: [cx + 1.0, y + 2.4, cz + 1.0] };
    ctx.addEntity('silence', { type: 'senseFx', params: { fx: 'silence', zone } });
    const still = ctx.addEntity('still', { type: 'dwellSensor', params: { aabb: zone, sec: t['sense.silent.sec'], still: true } });
    ctx.offerSecret({ hook: 'silent.corner', modes: ['present', 'appear'], weight: 1, revealOutput: `${still}.done`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '音の道しるべと反対の、音の消える隅' });
    ctx.keepOut({ min: [cx - 1.0, y, cz - 1.0], max: [cx + 1.0, y + 2.5, cz + 1.0] });
  },
});
