/**
 * 自由に遊べるミニゲーム（2.15）その 2。本道でない脇の部屋。いつでも入口から出られる。報酬は置かない。
 *
 * - cartLoop U07 カートの坂: 部屋を回る台車（動く床）。途中で坂を上って下る。乗ると運ばれる。隠し: 降りずに 3 周乗り続けると、
 *     乗り場の横の壁が開く（出現型）
 * - targetGallery U08 的当て: 手前の線の後ろの籠に球 3 つ。奥の壁の的 4 枚を、投げて（走りながら・上を向いて Q）倒す。
 *     全部倒れると起き直る。隠し（反則）: 線を越えて的の下の棚の杯に、球を手で置くと扉（出現型。投げて入っても開く）
 * - memoryRoom U09 記憶の部屋: 台の上に物が 4 つ。入ると 10 秒見せて、照明が消え、物が床に散らばる。暗い中で元の台に戻すと照明がつく。
 *     部屋を出ると最初から。隠し: 暗い間に物に触れず、20 秒じっとしていると扉が現れる（出現型）
 * - shadowPose U10 影絵（光と自分の影を合わせる）: 床の低い強い灯りが、向かいの白い壁に自分の影を映す。壁に人の形の線が 2 つ
 *     （立った形・しゃがんだ形）。床の印の上で、その形の姿勢で立つと線が灯る。隠し: 印の無い所で、影がちょうど扉の線の大きさに
 *     なる位置に立つと、影が扉になる（出現型）
 * - pianoFloor U11 音合わせ（ピアノの床）: 床の鍵盤 8 つ。踏むと鳴る（WebAudio の合成）。壁に楽譜。
 *     隠し: 楽譜の旋律を踏むと扉が現れる（出現型。間違えると最初から）
 * - ringRoom U12 無重力で輪をくぐる: 体の軽い部屋（gravity ゾーン）に、宙に浮かぶ輪が 4 つ。光る順にくぐると鈴の音。
 *     隠し: 逆の順（最後の輪から）にくぐると扉が現れる（出現型）
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext, type GimmickSlot } from '../types.ts';
import { doorZone, innerRect, wallFrame } from '../util.ts';
import { aabbJ, addItem, floorSpots, freeSpans, idOf, offer, onMainWall, roomLamp, snap, wallBox, wallPoint } from './util.ts';

const sideRoom = (s: GimmickSlot): boolean => !!s.entrance && s.openings.every((o) => onMainWall(s, o));

function secretWall(ctx: GimmickContext, need = 1.4, avoid: Dir[] = []): { d: Dir; at: number; a0: number; a1: number } | null {
  const r = innerRect(ctx.slot);
  for (const d of ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((x) => !avoid.includes(x)))) { const sp = freeSpans(r, ctx.slot.openings, d, need, 0.9)[0]; if (sp) return { d, ...sp }; }
  return null;
}

// ---------------------------------------------------------------- U07 カートの坂
defineGimmick({
  id: 'cartLoop', name: 'カートの坂', axes: ['move'], kinds: ['room', 'hall'], minSize: [6.4, 7], minHeight: 2.7, weight: 0.25, intensity: 0, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const m = 2.0;
    const x0 = r.x0 + m, x1 = r.x1 - m, z0 = r.z0 + m, z1 = r.z1 - m;
    if (x1 - x0 < 2.4 || z1 - z0 < 2.8) return;
    // 台車の通り道: 部屋の真ん中を回る四角。長い一辺の中ほどで坂を上り（0.5 m）、下る
    const longX = x1 - x0 >= z1 - z0;
    const H = 0.5;
    const pts: number[][] = longX
      ? [[x0, 0, z0], [x0 + (x1 - x0) * 0.2, 0, z0], [x0 + (x1 - x0) * 0.45, H, z0], [x0 + (x1 - x0) * 0.55, H, z0], [x0 + (x1 - x0) * 0.8, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]]
      : [[x0, 0, z0], [x0, 0, z0 + (z1 - z0) * 0.2], [x0, H, z0 + (z1 - z0) * 0.45], [x0, H, z0 + (z1 - z0) * 0.55], [x0, 0, z0 + (z1 - z0) * 0.8], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0]];
    const track = pts.map((p) => [p[0]!, y + p[1]!, p[2]!]);
    // 線路（床の線）
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      const lx0 = Math.min(a[0]!, b[0]!) - 0.04, lx1 = Math.max(a[0]!, b[0]!) + 0.04, lz0 = Math.min(a[2]!, b[2]!) - 0.04, lz1 = Math.max(a[2]!, b[2]!) + 0.04;
      ctx.addBox(box([lx0, y, lz0], [lx1, y + 0.006, lz1], 'metalDark', false));
    }
    const cart = ctx.addEntity('cart', { type: 'cartTrack', params: { points: track, half: [0.5, 0.15, 0.5], speed: ctx.tuning['carry.cart.speed'], mat: 'plasticYellow' } });
    const laps = ctx.addEntity('laps', { type: 'threshold', params: { min: ctx.tuning['carry.cart.laps'] - 1e-6 }, inputs: { in: `${cart}.laps` } });
    const w = secretWall(ctx, 1.4);
    if (w) offer(ctx, { hook: 'game.cart.laps', modes: ['appear'], weight: 1, revealOutput: `${laps}.out`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '乗り場の床の、すり減った線' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- U08 的当て
defineGimmick({
  id: 'targetGallery', name: '的当て', axes: ['carry'], kinds: ['room', 'hall'], minSize: [4.2, 6], weight: 0.25, intensity: 0, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    const F = wallFrame(r, ent.dir);
    if (F.depth < 5.5) return;
    const back = ((ent.dir + 2) % 4) as Dir;
    const sp = freeSpans(r, s.openings, back, 2.6, 0.6)[0];
    if (!sp) return;
    // 線（入口から 1.8 m）と籠
    const line = F.rect(F.u0, 1.8, F.u1, 1.86);
    ctx.addBox(box([line.x0, y, line.z0], [line.x1, y + 0.008, line.z1], 'neonRed', false));
    const eu = F.u(ent.pos[0], ent.pos[2]);
    const bu = Math.min(F.u1 - 0.6, Math.max(F.u0 + 0.6, eu + (eu < (F.u0 + F.u1) / 2 ? 1.2 : -1.2)));
    const basket = F.point(bu, 1.2);
    ctx.addBox(box([basket[0] - 0.3, y, basket[1] - 0.3], [basket[0] + 0.3, y + 0.35, basket[1] + 0.3], 'woodPanel'));
    const bounds = aabbJ({ min: [s.rect.x0, y - 1, s.rect.z0], max: [s.rect.x1, y + 3, s.rect.z1] });
    for (let i = 0; i < 3; i++) addItem(ctx, `ball${i}`, [basket[0] + (i - 1) * 0.16, y + 0.35, basket[1]], { half: [0.07, 0.07, 0.07], kind: 'ball', tag: 'ball.throw', mat: ['plasticRed', 'plasticBlue', 'plasticYellow'][i] as MatId, yaw: 0, bounds, persist: false });
    // 的: 奥の壁の前（高さいろいろ）。杯: 的の下の棚（手で置ける高さ）
    const targets: { min: number[]; max: number[] }[] = [];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const at = sp.at + (i - (n - 1) / 2) * Math.min(0.7, (sp.a1 - sp.a0 - 0.4) / n);
      const h = y + 1.1 + ((i * 7) % 3) * 0.35;
      const b = wallBox(r, back, at, 0.17, h - 0.17, h + 0.17, 0.2, 'paintWhite', false, 0.02);
      targets.push({ min: [...b.min], max: [...b.max] });
    }
    const tg = ctx.addEntity('targets', { type: 'throwTarget', params: { targets, dir: back } });
    ctx.addEntity('all', { type: 'carryChime', params: { name: 'carry.chime' }, inputs: { in: `${tg}.all` } });
    const shelf = wallBox(r, back, sp.at, 0.5, y + 0.7, y + 0.74, 0.3, 'woodPanel', true);
    ctx.addBox(shelf);
    const cupAt = wallPoint(r, back, sp.at, 0.15, y + 0.74);
    ctx.addBox(box([cupAt[0] - 0.09, y + 0.74, cupAt[2] - 0.09], [cupAt[0] + 0.09, y + 0.76, cupAt[2] + 0.09], 'goldTrim', false));
    const cup = ctx.addEntity('cup', { type: 'carryReceiver', params: { slots: [{ pos: cupAt, r: 0.3, accept: ['ball.throw'] }], markMat: 'goldTrim', markM: 0.22 } });
    const w = secretWall(ctx, 1.4, [back, ent.dir]) ?? secretWall(ctx, 1.4, [ent.dir]);
    if (w && !(w.d === back && Math.abs(w.at - sp.at) < 1.8)) offer(ctx, { hook: 'game.target.cup', modes: ['appear'], weight: 1, revealOutput: `${cup}.count`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '的の下の金の杯' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- U09 記憶の部屋
const MEMO: { kind: string; half: Vec3; mat: MatId }[] = [
  { kind: 'cup', half: [0.05, 0.06, 0.05], mat: 'plasticRed' }, { kind: 'vase', half: [0.08, 0.13, 0.08], mat: 'plasticBlue' },
  { kind: 'toy', half: [0.1, 0.14, 0.08], mat: 'plasticYellow' }, { kind: 'book', half: [0.11, 0.025, 0.15], mat: 'lightGreen' }, { kind: 'bird', half: [0.08, 0.1, 0.08], mat: 'paintWhite' },
];

defineGimmick({
  id: 'memoryRoom', name: '記憶の部屋', axes: ['carry', 'light'], kinds: ['room'], minSize: [4, 4.5], weight: 0.25, intensity: 0, offersSecret: true, onMainPath: false,
  fits: (s) => sideRoom(s) && s.openings.length === 1,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const n = 4;
    const kinds = ctx.rng.shuffle(MEMO.slice()).slice(0, n);
    const peds = floorSpots(ctx, n, { margin: 0.7, gap: 1.2, doorD: 1.8 });
    if (!peds) return;
    const H = 0.85;
    const slots = peds.map((p, i) => {
      ctx.addBox(box([p[0] - 0.18, y, p[2] - 0.18], [p[0] + 0.18, y + H, p[2] + 0.18], 'marbleWhite'));
      return { pos: [p[0], y + H, p[2]], r: 0.4, accept: ['memo'], want: [`memo.${kinds[i]!.kind}`] };
    });
    const board = ctx.addEntity('board', { type: 'carryReceiver', params: { slots, mark: false } });
    // 散らばる所: 床（台から離して）
    const avoid = peds.map((p) => ({ x0: p[0] - 0.5, x1: p[0] + 0.5, z0: p[2] - 0.5, z1: p[2] + 0.5 }));
    const spots = floorSpots(ctx, 8, { margin: 0.5, gap: 0.6, doorD: 1.5, avoid });
    if (!spots) return;
    const scatter = spots.map((p) => [p[0], y, p[2], ctx.rng.float(-3, 3)]);
    const game = idOf(ctx, 'game');
    const items = kinds.map((k, i) => addItem(ctx, `thing${i}`, slots[i]!.pos as Vec3, { half: k.half, kind: k.kind, tag: `memo.${k.kind}`, mat: k.mat, yaw: 0, scatter, scatterSlot: i * 2, persist: false, inputs: { scatter: `${game}.scatter`, reset: `${game}.reset` } }));
    ctx.addEntity('game', { type: 'memoryGame', params: { room: aabbJ({ min: [r.x0, y - 0.3, r.z0], max: [r.x1, y + 2.5, r.z1] }), items, showSec: ctx.tuning['carry.memory.showSec'], patientSec: ctx.tuning['carry.memory.patientSec'], resetSec: 6 }, inputs: { ok: `${board}.ok` } });
    roomLamp(ctx, 'lights', true, { on: `${game}.lights` }, 4);
    const w = secretWall(ctx, 1.4);
    if (w) offer(ctx, { hook: 'game.memory.patient', modes: ['appear'], weight: 1, revealOutput: `${game}.patient`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '暗くなると、壁にぼんやり光る四角' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- U10 自分の影絵
defineGimmick({
  id: 'shadowPose', name: '影絵（自分の影）', axes: ['light', 'body'], kinds: ['room', 'hall'], minSize: [4.2, 6], weight: 0.25, intensity: 0, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    // 影の壁: 奥行き 5.5 m 以上・幅 3.6 m 以上の開口の無い区間。灯りは向かいの壁の手前（扉の正面）
    let pick: { d: Dir; at: number; D: number } | null = null;
    for (const d of ctx.rng.shuffle([0, 1, 2, 3] as Dir[])) {
      const F = wallFrame(r, d);
      if (F.depth < 5.5) continue;
      const sp = freeSpans(r, s.openings, d, 3.6, 0.8)[0];
      if (!sp) continue;
      const D = F.depth - 0.4;
      const lp = wallPoint(r, d, sp.at, D, y);
      if (s.openings.some((o) => { const z = doorZone(o, y, 1.4, 0.6); return lp[0] > z.min[0] && lp[0] < z.max[0] && lp[2] > z.min[2] && lp[2] < z.max[2]; })) continue;
      pick = { d, at: sp.at, D };
      break;
    }
    if (!pick) return;
    const { d, at, D } = pick;
    const lampH = y + 0.06;
    const lp = wallPoint(r, d, at, D, y);
    ctx.addBox(box([lp[0] - 0.18, y, lp[2] - 0.18], [lp[0] + 0.18, y + 0.12, lp[2] + 0.18], 'lightWarm', false));
    s.cell.lights.push({ pos: [lp[0], y + 0.25, lp[2]], color: 0xfff0d0, intensity: 1.3, distance: D + 2 });
    // 影の大きさ: 灯りから壁まで D、灯りから人まで d なら、影の高さ ≒ 体の高さ × D / d。人の形の線は ±1.25 m 横
    const hStand = 1.65, hCrouch = 0.8;
    const distFor = (shadowH: number, bodyH: number): number => D * bodyH / shadowH;
    const shapes = [
      { off: 1.25, h: 2.3, crouch: false, body: hStand },
      { off: -1.25, h: 1.5, crouch: true, body: hCrouch },
      { off: 0, h: 2.0, crouch: false, body: hStand },
    ];
    const marks = shapes.map((sh) => {
      const dd = distFor(sh.h, sh.body);
      // 人の横の位置: 影の位置 = 灯り + (人 − 灯り) × D / d
      const u = at + sh.off * (dd / D);
      const p = wallPoint(r, d, u, D - dd, y);
      return { pos: [snap(p[0]), y, snap(p[2])], r: 0.32, crouch: sh.crouch, h: sh.h, off: sh.off };
    });
    // 床の印（立った形・しゃがんだ形だけ。扉の形の所には印が無い）
    for (const m of marks.slice(0, 2)) ctx.addBox(box([m.pos[0]! - 0.25, y, m.pos[2]! - 0.25], [m.pos[0]! + 0.25, y + 0.006, m.pos[2]! + 0.25], m.crouch ? 'neonBlue' : 'yellowLine', false));
    // 壁の人の形の線（四角で近づける: 幅は高さの 0.36）
    for (const m of marks.slice(0, 2)) {
      const w = m.h * 0.36, a0 = at + m.off - w / 2, a1 = at + m.off + w / 2;
      for (const [b0, b1, c0, c1] of [[a0, a1, y + m.h - 0.03, y + m.h], [a0, a0 + 0.03, y, y + m.h], [a1 - 0.03, a1, y, y + m.h]] as const) ctx.addBox(wallBox(r, d, (b0 + b1) / 2, (b1 - b0) / 2, c0, c1, 0.006, 'yellowLine'));
    }
    // 扉の形の線（薄い）
    for (const [b0, b1, c0, c1] of [[at - 0.5, at + 0.5, y + 1.98, y + 2.0], [at - 0.5, at - 0.48, y, y + 2.0], [at + 0.48, at + 0.5, y, y + 2.0]] as const) ctx.addBox(wallBox(r, d, (b0 + b1) / 2, (b1 - b0) / 2, c0, c1, 0.004, 'paintWhite'));
    const pose = ctx.addEntity('pose', { type: 'shadowPose', params: { marks: marks.map((m) => ({ pos: m.pos, r: m.r, crouch: m.crouch })), sec: 1.5, lamp: [lp[0], lampH, lp[2]], wall: d, face: wallPoint(r, d, at, 0.005, y), outline: marks.map((m) => [m.off, m.h]), at } });
    ctx.addEntity('both', { type: 'and', params: {}, inputs: { a: `${pose}.m0`, b: `${pose}.m1` } });
    ctx.addEntity('chime', { type: 'carryChime', params: { name: 'carry.chime' }, inputs: { in: `${idOf(ctx, 'both')}.out` } });
    offer(ctx, { hook: 'game.shadow.door', modes: ['appear'], weight: 1, revealOutput: `${pose}.m2`, doorway: { dir: d, at, y, width: 1.0, height: 2.0 }, tell: '壁の薄い扉の形の線' });
    const k0 = wallPoint(r, d, at - 2.0, 0, y), k1 = wallPoint(r, d, at + 2.0, D + 0.4, y);
    ctx.keepOut({ min: [Math.min(k0[0], k1[0]), y - 0.1, Math.min(k0[2], k1[2])], max: [Math.max(k0[0], k1[0]), y + 2.6, Math.max(k0[2], k1[2])] });
  },
});

// ---------------------------------------------------------------- U11 ピアノの床
const SCALE8 = [0, 2, 4, 5, 7, 9, 11, 12];

defineGimmick({
  id: 'pianoFloor', name: 'ピアノの床', axes: ['sound', 'floor'], kinds: ['room', 'hall'], minSize: [4.2, 5.4], weight: 0.25, intensity: 0, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    const N = 8, C = 0.5;
    // 鍵盤: 入口と平行に、部屋の真ん中（入口から 2.2 m 奥）
    const F = wallFrame(r, ent.dir);
    if (F.u1 - F.u0 < N * C + 0.6 || F.depth < 4.4) return;
    const alongX = ent.dir % 2 === 0;
    const mid = F.point((F.u0 + F.u1) / 2, Math.min(2.6, F.depth / 2));
    const o: Vec3 = alongX ? [snap(mid[0] - (N * C) / 2), y, snap(mid[1] - C / 2)] : [snap(mid[0] - C / 2), y, snap(mid[1] - (N * C) / 2)];
    // stepPattern の升目は x の向きに並ぶ（alongX でないときは z の向きに 1 列 → nx = 1・nz = N）
    const nx = alongX ? N : 1, nz = alongX ? 1 : N;
    for (let i = 0; i < N; i++) {
      const x0 = alongX ? o[0] + i * C : o[0], z0 = alongX ? o[2] : o[2] + i * C;
      ctx.addBox(box([x0 + 0.02, y, z0 + 0.02], [x0 + C - 0.02, y + 0.012, z0 + C - 0.02], 'paintWhite', false));
    }
    const notes = [...Array(N).keys()].map((i) => SCALE8[i]!);
    // 旋律: 5 音（同じ鍵を続けない）
    const melody: number[] = [];
    while (melody.length < 5) { const k = ctx.rng.int(0, N - 1); if (melody[melody.length - 1] !== k) melody.push(k); }
    const keys = ctx.addEntity('keys', { type: 'stepPattern', params: { origin: [...o], cell: C, nx, nz, pattern: melody, notes, baseNote: 0 } });
    // 楽譜（奥の壁）
    const back = ((ent.dir + 2) % 4) as Dir;
    const sp = freeSpans(r, s.openings, back, 1.2, 0.6)[0];
    if (!sp) return;
    ctx.addBox(wallBox(r, back, sp.at, 0.5, y + 1.15, y + 1.75, 0.015, 'woodPanel'));
    ctx.addEntity('sheet', { type: 'carryDecor', params: { view: 'canvas', draw: 'sheet', at: wallPoint(r, back, sp.at, 0.02, y + 1.45), dir: back, w: 0.9, h: 0.5, melody, keys: N } });
    const w = secretWall(ctx, 1.4, [ent.dir]);
    if (w && !(w.d === back && Math.abs(w.at - sp.at) < 1.3)) offer(ctx, { hook: 'game.piano.melody', modes: ['appear'], weight: 1, revealOutput: `${keys}.done`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '楽譜の終わりの、扉の形の記号' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- U12 無重力で輪をくぐる
defineGimmick({
  id: 'ringRoom', name: '浮かぶ輪', axes: ['gravity', 'body'], kinds: ['hall', 'room'], minSize: [5, 6], minHeight: 3.2, weight: 0.25, intensity: 0, offersSecret: true, onMainPath: false,
  fits: sideRoom,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const top = s.cell.height;
    // 重さ: 跳ぶと天井の 0.7 m 下まで届く
    const apex = top - 0.7 - 0.0;
    const scale = Math.min(0.9, Math.max(0.15, (4.2 * 4.2) / (2 * 9.8 * apex)));
    ctx.addZone({ kind: 'gravity', aabb: { min: [r.x0, y - 0.2, r.z0], max: [r.x1, y + top, r.z1] }, params: { scale } });
    // 輪: 4 つ。高さ 1.2〜（天井 − 1.0）。向きは x か z
    const spots = floorSpots(ctx, 4, { margin: 1.2, gap: 1.8, doorD: 2.0 });
    if (!spots) return;
    const rings = spots.map((p, i) => {
      const h = y + 1.1 + ((top - 2.0) * ((i * 5) % 4)) / 3;
      const n = ctx.rng.chance(0.5) ? [1, 0, 0] : [0, 0, 1];
      return { c: [p[0], Math.min(h, y + top - 0.9), p[2]], n, r: 0.62 };
    });
    const ringS = ctx.addEntity('rings', { type: 'ringSensor', params: { rings } });
    ctx.addEntity('done', { type: 'carryChime', params: { name: 'carry.chime' }, inputs: { in: `${ringS}.forward` } });
    const w = secretWall(ctx, 1.4);
    if (w) offer(ctx, { hook: 'game.rings.reverse', modes: ['appear'], weight: 1, revealOutput: `${ringS}.reverse`, doorway: { dir: w.d, at: w.at, y, width: 1.0, height: 2.0 }, tell: '最後の輪の内側の、逆向きの矢印' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + top, r.z1] });
  },
});
