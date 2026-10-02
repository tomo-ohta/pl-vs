/**
 * パズル（4.7 のパズル）その 1: 行き止まりの部屋。解くと隠しの扉が現れる（出現型・必ず付ける。手本は secret.ts の puzzleRoom）。
 * 手がかりは同じフロアの別の部屋に置ける（GimmickContext.clueCells。v2-plan.md 4.7 の最後）。無ければ同じ部屋の壁。
 *
 * - dialLock PZ01 数字錠: 扉の横に 3 桁のダイヤル（調べると 1 進む）。別の部屋の壁に、同じ色の枠の 3 桁の番号（部屋番号の札）
 * - colorMix PZ02 色の照明: 暗い部屋に赤・緑・青の灯りと、3 つのスイッチ。灯りの混ざった色を、決まった色（別の部屋の、色の扉の絵）にする
 * - clockRoom PZ03 時計: 部屋の壁の時計がばらばらの時刻。調べると 1 時間進む。全部を同じ時刻に（別の部屋に時計があれば、その時刻に）
 * - bellOrder PZ07 鐘: 大きさの違う鐘。調べると鳴る。音の低い順（大きい順）に鳴らす。間違えると最初から
 * - bulbOrder PZ11 電球の順: 壁の吊り灯りの受け口が空。色の電球がフロアのあちこちに。別の部屋の古い写真の色の順に差す
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext, type GimmickSlot } from '../types.ts';
import { innerRect } from '../util.ts';
import { placeFar } from './keys.ts';
import { aabbJ, addClueBox, clueWall, type ClueWall, digitBoxes, freeSpans, keepClueFront, offer, onMainWall, roomLamp, wallBox, wallPoint } from './util.ts';

/** パズルの部屋: 行き止まり（開口 1 つ）。隠しの扉は入口の向かいの壁（無ければほかの壁） */
export function puzzleBase(ctx: GimmickContext, need = 1.6): { y: number; r: ReturnType<typeof innerRect>; ent: GimmickSlot['openings'][number]; door: { d: Dir; at: number; a0: number; a1: number } } | null {
  const s = ctx.slot;
  const ent = s.openings[0]!;
  const r = innerRect(s);
  const opp = ((ent.dir + 2) % 4) as Dir;
  for (const d of [opp, ...ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((x) => x !== opp))]) {
    const sp = freeSpans(r, s.openings, d, need, 0.8)[0];
    if (sp) return { y: s.cell.floorY, r, ent, door: { d, ...sp } };
  }
  return null;
}

const deadEnd = (s: GimmickSlot): boolean => s.openings.length === 1 && s.openings.every((o) => onMainWall(s, o));

/** 手がかりの板（枠の材質 frame）を壁 w に貼る: 幅 hw の板 */
function cluePlate(ctx: GimmickContext, w: ClueWall, hw: number, y0: number, y1: number, frame: MatId): void {
  addClueBox(ctx, w, wallBox(w.rect, w.dir, w.at, hw + 0.04, y0 - 0.04, y1 + 0.04, 0.015, frame));
  addClueBox(ctx, w, wallBox(w.rect, w.dir, w.at, hw, y0, y1, 0.02, 'screenDark'));
  keepClueFront(ctx, w, hw);
}

// ---------------------------------------------------------------- PZ01 数字錠
defineGimmick({
  id: 'dialLock', name: '数字錠', axes: ['puzzle'], kinds: ['room'], minSize: [3.6, 3.8], weight: 0.2, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 2.8);
    if (!b) return;
    const { y, r, door } = b;
    const frame = ctx.rng.pick<MatId>(['goldTrim', 'plasticRed', 'plasticBlue', 'lightGreen']);
    const code = [ctx.rng.int(1, 9), ctx.rng.int(0, 9), ctx.rng.int(0, 9)];
    // ダイヤル: 扉の横（扉の中心から 0.85 m〜）
    const side = door.at + 1.55 <= door.a1 ? 1 : -1;
    const right = door.d === 2 || door.d === 1 ? 1 : -1;
    const dials: string[] = [];
    ctx.addBox(wallBox(r, door.d, door.at + side * 1.05, 0.46, y + 1.08, y + 1.48, 0.02, frame));
    for (let i = 0; i < 3; i++) {
      const at = door.at + side * 1.05 + right * (i - 1) * 0.3;
      const bx = wallBox(r, door.d, at, 0.09, y + 1.15, y + 1.41, 0.06, 'metalDark');
      dials.push(ctx.addEntity(`dial${i}`, { type: 'dial', params: { box: aabbJ(bx), n: 10, start: 0, mode: 'digit', dir: door.d } }));
    }
    const ok = code.map((c, i) => ctx.addEntity(`is${i}`, { type: 'valueIs', params: { value: c }, inputs: { in: `${dials[i]}.value` } }));
    const all = ctx.addEntity('open', { type: 'and', params: {}, inputs: { a: `${ok[0]}.out`, b: `${ok[1]}.out`, c: `${ok[2]}.out` } });
    // 手がかり: 別の部屋の壁の番号の札（同じ色の枠）
    const w = clueWall(ctx, 0.9, { avoidDirs: [door.d, b.ent.dir] });
    if (!w) return;
    cluePlate(ctx, w, 0.36, w.y + 1.75, w.y + 2.1, frame);
    const rr = w.dir === 2 || w.dir === 1 ? 1 : -1;
    code.forEach((c, i) => { for (const bx of digitBoxes(w, w.at + rr * (i - 1) * 0.2, w.y + 1.8, c, 0.11, 'signEmissive', 0.022)) addClueBox(ctx, w, bx); });
    offer(ctx, { hook: 'puzzle.dial', modes: ['appear'], weight: 1, required: true, revealOutput: `${all}.out`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: '数字錠の枠の色' });
  },
});

// ---------------------------------------------------------------- PZ02 色の照明を混ぜる
const RGB: { mat: MatId; color: number }[] = [{ mat: 'neonRed', color: 0xff3a30 }, { mat: 'lightGreen', color: 0x40ff50 }, { mat: 'neonBlue', color: 0x4060ff }];

defineGimmick({
  id: 'colorMix', name: '色の照明を混ぜる', axes: ['puzzle', 'light'], kinds: ['room'], minSize: [3.6, 4.2], weight: 0.2, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 1.6);
    if (!b) return;
    const s = ctx.slot;
    const { y, r, door, ent } = b;
    // 部屋の照明は消えている（色の灯りだけ）
    roomLamp(ctx, 'dark', false);
    const want = ctx.rng.pick([[1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]]);
    // スイッチ: 扉の壁と入口の壁以外の壁（無ければ入口の壁）
    const sw = ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => d !== door.d)).map((d) => ({ d, sp: freeSpans(r, s.openings, d, 1.4, 0.6)[0] })).find((x) => x.sp);
    if (!sw) return;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const top = y + s.cell.height;
    const buttons = RGB.map((c, i) => {
      const at = sw.sp!.at + (i - 1) * 0.5;
      const bx = wallBox(r, sw.d, at, 0.07, y + 1.1, y + 1.3, 0.06, 'metalDark');
      ctx.addBox(wallBox(r, sw.d, at, 0.05, y + 1.36, y + 1.44, 0.02, c.mat));
      const btn = ctx.addEntity(`switch${i}`, { type: 'button', params: { box: aabbJ(bx), mat: 'metalDark' } });
      const lamp = ctx.addEntity(`lamp${i}`, { type: 'lamp', params: { on: false, rate: 6 }, inputs: { on: `${btn}.on` } });
      // 色の灯り（天井の 3 つ。少しずらして重ねる）
      const a = (i * Math.PI * 2) / 3;
      const lx = cx + Math.cos(a) * 0.5, lz = cz + Math.sin(a) * 0.5;
      s.cell.lights.push({ pos: [lx, top - 0.3, lz], color: c.color, intensity: 1.1, distance: 7, lampId: lamp });
      const glow = box([lx - 0.12, top - 0.06, lz - 0.12], [lx + 0.12, top - 0.01, lz + 0.12], c.mat, false);
      glow.kind = `lamp:${lamp}`;
      ctx.addBox(glow);
      return btn;
    });
    const ok = ctx.addEntity('mix', { type: 'matchBits', params: { want }, inputs: { a: `${buttons[0]}.on`, b: `${buttons[1]}.on`, c: `${buttons[2]}.on` } });
    // 手がかり: 決まった色の扉の絵（別の部屋の壁。無ければこの部屋の扉の上）
    const color = (want[0] ? 0xff3a30 : 0) | (want[1] ? 0x40ff50 : 0) | (want[2] ? 0x4060ff : 0);
    const w = clueWall(ctx, 0.7, { avoidDirs: [ent.dir, sw.d] });
    if (!w) return;
    cluePlate(ctx, w, 0.3, w.y + 1.4, w.y + 2.1, 'goldTrim');
    const p = wallPoint(w.rect, w.dir, w.at, 0.03, w.y + 1.75);
    ctx.addEntity('swatch', { type: 'carryDecor', cell: w.cell, params: { view: 'doorPicture', color, at: p, dir: w.dir, w: 0.3, h: 0.55 } });
    offer(ctx, { hook: 'puzzle.color', modes: ['appear'], weight: 1, required: true, revealOutput: `${ok}.out`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: '色の付いた扉の絵' });
  },
});

// ---------------------------------------------------------------- PZ03 時計
defineGimmick({
  id: 'clockRoom', name: '時計を合わせる', axes: ['puzzle', 'time'], kinds: ['room'], minSize: [3.6, 4.2], weight: 0.2, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 1.6);
    if (!b) return;
    const s = ctx.slot;
    const { y, r, door } = b;
    const n = ctx.rng.int(4, 5);
    // 時計の置き場所: 壁ごとの開口の無い区間に、0.9 m おき（扉の前は避ける）
    const spots: { d: Dir; at: number }[] = [];
    for (const d of ctx.rng.shuffle([0, 1, 2, 3] as Dir[])) for (const sp of freeSpans(r, s.openings, d, 0.6, 0.5)) {
      for (let a = sp.a0 + 0.3; a <= sp.a1 - 0.3 + 1e-6; a += 0.9) {
        if (d === door.d && Math.abs(a - door.at) < 0.95) continue;
        spots.push({ d, at: a });
      }
    }
    if (spots.length < n) return;
    const used = ctx.rng.shuffle(spots).slice(0, n);
    const hours = ctx.rng.shuffle([...Array(12).keys()]).slice(0, n);
    const clocks = used.map((c, i) => {
      const bx = wallBox(r, c.d, c.at, 0.16, y + 1.62, y + 1.94, 0.05, 'paintWhite');
      return ctx.addEntity(`clock${i}`, { type: 'dial', params: { box: aabbJ(bx), n: 12, start: hours[i]!, mode: 'clock', dir: c.d } });
    });
    // 別の部屋の時計（止まっている）があれば、その時刻にそろえる
    const w = clueWall(ctx, 0.5, { avoidDirs: [door.d] });
    let target: number | null = null;
    if (w && !w.own) {
      target = ctx.rng.int(0, 11);
      if (hours.every((h) => h === target)) target = (target + 1) % 12;
      const p = wallPoint(w.rect, w.dir, w.at, 0.03, w.y + 1.85);
      ctx.addEntity('master', { type: 'carryDecor', cell: w.cell, params: { view: 'clock', hour: target, at: p, dir: w.dir } });
      keepClueFront(ctx, w, 0.25);
    }
    const inputs: { [k: string]: string } = {};
    clocks.forEach((c, i) => { inputs['abcdefgh'[i]!] = `${c}.value`; });
    const same = ctx.addEntity('same', { type: 'sameValue', params: target === null ? {} : { target }, inputs });
    offer(ctx, { hook: 'puzzle.clocks', modes: ['appear'], weight: 1, required: true, revealOutput: `${same}.out`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: target === null ? '1 つだけ秒針の止まった時計' : '別の部屋の止まった時計' });
  },
});

// ---------------------------------------------------------------- PZ07 鐘
const SCALE = [0, 2, 4, 7, 9, 12];

defineGimmick({
  id: 'bellOrder', name: '鐘を鳴らす順', axes: ['puzzle', 'sound'], kinds: ['room'], minSize: [3.6, 4.2], weight: 0.2, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 1.6);
    if (!b) return;
    const s = ctx.slot;
    const { y, r, door, ent } = b;
    const n = ctx.rng.int(4, 5);
    // 鐘の台: 入口の向かいの壁でない、長い壁の前に一列（間隔 0.75 m）
    const row = ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => d !== ent.dir)).map((d) => ({ d, sp: freeSpans(r, s.openings, d, n * 0.75 + 0.2, 0.6)[0] })).find((x) => x.sp && !(x.d === door.d && Math.abs(x.sp.at - door.at) < n * 0.4 + 0.7));
    if (!row) return;
    const notes = SCALE.slice(0, n);
    const order = ctx.rng.shuffle([...Array(n).keys()]);
    const bells: string[] = [];
    order.forEach((ni, i) => {
      const at = row.sp!.at + (i - (n - 1) / 2) * 0.75;
      // 低い音ほど大きい鐘
      const size = 0.24 - ni * 0.03;
      ctx.addBox(wallBox(r, row.d, at, 0.2, y, y + 0.8, 0.4, 'woodPanel', true, 0.15));
      const p = wallPoint(r, row.d, at, 0.35, y + 0.8);
      const bx = { min: [p[0] - size, p[1], p[2] - size], max: [p[0] + size, p[1] + size * 1.4, p[2] + size] };
      bells[ni] = ctx.addEntity(`bell${i}`, { type: 'bell', params: { box: bx, freq: 392 * 2 ** (notes[ni]! / 12), size, dir: row.d } });
    });
    const inputs: { [k: string]: string } = {};
    for (let i = 0; i < n; i++) inputs[`s${i + 1}`] = `${bells[i]}.pressed`;
    const seq = ctx.addEntity('order', { type: 'sequence', params: { count: n, resetOnWrong: true }, inputs });
    offer(ctx, { hook: 'puzzle.bells', modes: ['appear'], weight: 1, required: true, revealOutput: `${seq}.done`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: 'いちばん大きな鐘の下の擦れた床' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

// ---------------------------------------------------------------- PZ11 電球を元の順に
const BULBS: { id: string; glass: MatId; color: number }[] = [
  { id: 'red', glass: 'neonRed', color: 0xff5040 }, { id: 'blue', glass: 'neonBlue', color: 0x5070ff }, { id: 'yellow', glass: 'lightYellow', color: 0xffe060 }, { id: 'green', glass: 'lightGreen', color: 0x60ff70 },
];

defineGimmick({
  id: 'bulbOrder', name: '電球を元の順に', axes: ['puzzle', 'carry', 'light'], kinds: ['room'], minSize: [3.6, 4.2], weight: 0.2, intensity: 1, offersSecret: true, onMainPath: false, requiresSecret: true,
  fits: deadEnd,
  build(ctx) {
    const b = puzzleBase(ctx, 1.6);
    if (!b) return;
    const s = ctx.slot;
    const { y, r, door, ent } = b;
    const n = ctx.rng.int(3, 4);
    const row = ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => d !== ent.dir && d !== door.d)).map((d) => ({ d, sp: freeSpans(r, s.openings, d, n * 0.7 + 0.2, 0.6)[0] })).find((x) => x.sp)
      ?? { d: door.d, sp: freeSpans(r, s.openings, door.d, n * 0.7 + 2.6, 0.6)[0] };
    if (!row.sp) return;
    const colors = ctx.rng.shuffle(BULBS.slice()).slice(0, n);
    const base = row.d === door.d ? (row.sp.at > door.at ? row.sp.a1 - n * 0.35 : row.sp.a0 + n * 0.35) : row.sp.at;
    const slots: { pos: number[]; r: number; accept: string[]; want: string[] }[] = [];
    for (let i = 0; i < n; i++) {
      const at = base + (i - (n - 1) / 2) * 0.7;
      const p = wallPoint(r, row.d, at, 0.3, y + 1.45);
      // 吊り灯り: 天井からの線と、受け口の皿（当たらない）
      ctx.addBox(box([p[0] - 0.01, y + 1.55, p[2] - 0.01], [p[0] + 0.01, y + s.cell.height, p[2] + 0.01], 'metalDark', false));
      ctx.addBox(box([p[0] - 0.09, y + 1.5, p[2] - 0.09], [p[0] + 0.09, y + 1.56, p[2] + 0.09], 'metal', false));
      slots.push({ pos: [p[0], y + 1.38, p[2]], r: 0.45, accept: ['bulb'], want: [`bulb.${colors[i]!.id}`] });
    }
    const sockets = ctx.addEntity('sockets', { type: 'carryReceiver', params: { slots, mark: false, glow: true } });
    // 電球: 同じフロアの別の部屋（近い部屋と、2 つ先の部屋）。置けなければこの部屋の床
    for (let i = 0; i < n; i++) {
      const c = colors[i]!;
      const opts = { half: [0.06, 0.09, 0.06] as Vec3, kind: 'bulb', tag: `bulb.${c.id}`, mat: 'metal' as MatId, glass: c.glass, yaw: 0 };
      if (!placeFar(ctx, `bulb${i}`, opts, i % 2 ? 1 : 2)) return;
    }
    // 手がかり: 別の部屋の古い写真（灯りが点いていた頃の色の並び）
    const w = clueWall(ctx, 0.9, { avoidDirs: [row.d, ent.dir] });
    if (!w) return;
    cluePlate(ctx, w, 0.4, w.y + 1.5, w.y + 1.95, 'woodPanel');
    const p = wallPoint(w.rect, w.dir, w.at, 0.03, w.y + 1.72);
    ctx.addEntity('photo', { type: 'carryDecor', cell: w.cell, params: { view: 'dots', colors: colors.map((c) => c.color), at: p, dir: w.dir, w: 0.7 } });
    offer(ctx, { hook: 'puzzle.bulbs', modes: ['appear'], weight: 1, required: true, revealOutput: `${sockets}.ok`, doorway: { dir: door.d, at: door.at, y, width: 1.0, height: 2.0 }, tell: '灯りの消えた受け口' });
  },
});
