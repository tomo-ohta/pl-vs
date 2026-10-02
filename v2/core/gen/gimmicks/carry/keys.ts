/**
 * 別の部屋から運んでくる物（3 種）。運ぶ物は同じフロアの別の区画に置く（GimmickContext.clueCells。実験室では同じ部屋の隅）。
 *
 * - keycardGate I05 鍵ではない鍵: 部屋の壁際に改札（腰の高さの機械 2 台・赤い読み取り口）。別の部屋に落ちている社員証・切符を持って
 *     改札の間に立つと、読み取り口が緑になって壁が開く（出現型・必ず付ける。行き先は近道になりやすい通り抜けを含む）
 * - lostItem I06 落とし物を届ける: 机の上に色の名札がある部屋。同じ色の札の付いた落とし物（傘・鞄・人形）が別の部屋に落ちている。
 *     届けて机の上に置くと、部屋の壁が開く（出現型・必ず付ける）
 * - bulbRoom I07 電球を付け替える: 照明が消えた暗い部屋（懐中電灯で進める）。真ん中の電気スタンドの受け口が空。
 *     別の部屋の電球を運んで差すと、部屋じゅうの照明がつく。隠し: 暗がりの壁の扉（存在型 = 最初からあるが暗くて見えない /
 *     出現型 = 明るくなると現れる）
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import { box } from '../../../world/layout.ts';
import { defineGimmick, type GimmickContext } from '../types.ts';
import { innerRect } from '../util.ts';
import { PARCEL_COLORS } from './parcels.ts';
import { addItem, clueFloorSpot, floorSpots, freeSpans, idOf, type ItemOpts, offer, onMainWall, roomLamp, wallBox, wallPoint } from './util.ts';

/** 運ぶ物を別の区画（無ければ自分の部屋の床）に置く。戻り値は部品の id */
export function placeFar(ctx: GimmickContext, name: string, o: ItemOpts, minHops = 2): { id: string; cell: string; pos: Vec3 } | null {
  const far = clueFloorSpot(ctx, { minHops, maxHops: 6 }) ?? clueFloorSpot(ctx, { minHops: 1, maxHops: 6 });
  if (far) {
    const p: Vec3 = [far.pos[0], far.pos[1], far.pos[2]];
    if (ctx.keepOutIn) ctx.keepOutIn(far.cell, { min: [p[0] - 0.6, p[1] - 0.1, p[2] - 0.6], max: [p[0] + 0.6, p[1] + 2, p[2] + 0.6] });
    return { id: addItem(ctx, name, p, { ...o, cell: far.cell }), cell: far.cell, pos: p };
  }
  const own = floorSpots(ctx, 1, { margin: 0.5, doorD: 1.8 });
  if (!own) return null;
  return { id: addItem(ctx, name, own[0]!, o), cell: ctx.slot.cell.id, pos: own[0]! };
}

defineGimmick({
  id: 'keycardGate', name: '鍵ではない鍵', axes: ['carry'], kinds: ['room', 'hall', 'corridor'], minSize: [2.6, 5], weight: 0.35, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: true,
  fits: (s) => s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const wall = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).map((d) => ({ d, sp: freeSpans(r, s.openings, d, 2.4, 0.8)[0] })).find((w) => w.sp && (w.d % 2 === 0 ? r.z1 - r.z0 : r.x1 - r.x0) >= 2.4);
    if (!wall) return;
    const at = wall.sp!.at, d = wall.d;
    // 改札の機械（当たる）と読み取り口・閉じた扉の板（現れたら消える）
    for (const sg of [-1, 1]) {
      ctx.addBox(wallBox(r, d, at + sg * 0.66, 0.14, y, y + 1.0, 1.1, 'stainless', true));
      ctx.addBox(wallBox(r, d, at + sg * 0.66, 0.1, y + 1.0, y + 1.06, 0.3, 'screenDark', false, 0.6));
    }
    const lamp = ctx.addEntity('reader', { type: 'lamp', params: { on: false, rate: 6, pos: wallPoint(r, d, at, 0.9, y + 1.1) }, inputs: { on: `${idOf(ctx, 'gate')}.match` } });
    for (const sg of [-1, 1]) { const b = wallBox(r, d, at + sg * 0.66, 0.05, y + 1.06, y + 1.1, 0.12, 'lightGreen', false, 0.75); b.kind = `lamp:${lamp}`; ctx.addBox(b); }
    ctx.addBox(wallBox(r, d, at + 0.66, 0.05, y + 1.06, y + 1.1, 0.08, 'neonRed', false, 0.92));
    const group = `${ctx.id}.flaps`;
    for (const sg of [-1, 1]) { const f = wallBox(r, d, at + sg * 0.27, 0.25, y + 0.55, y + 0.95, 0.03, 'plasticRed', false, 0.55); f.concealGroup = group; ctx.addBox(f); }
    ctx.addBox(wallBox(r, d, at, 0.7, y + 2.2, y + 2.4, 0.03, 'signPlate'));
    // 読み取る範囲: 機械の間（壁から 0.2〜1.2 m）
    const p0 = wallPoint(r, d, at - 0.45, 0.2, y), p1 = wallPoint(r, d, at + 0.45, 1.25, y);
    const zone = { min: [Math.min(p0[0], p1[0]), y - 0.3, Math.min(p0[2], p1[2])], max: [Math.max(p0[0], p1[0]), y + 2, Math.max(p0[2], p1[2])] };
    const sensor = ctx.addEntity('gate', { type: 'carrySensor', params: { aabb: zone, want: ['card', 'ticket'], sec: 0.4, latch: true } });
    ctx.addEntity('flaps', { type: 'reveal', params: { group, pos: wallPoint(r, d, at, 0.6, y + 0.8), style: 'fadeIn' }, inputs: { show: `${sensor}.match` } });
    // 鍵になる物: 社員証か切符（別の部屋に落ちている）
    const ticket = ctx.rng.chance(0.5);
    const key = placeFar(ctx, 'key', ticket
      ? { half: [0.05, 0.004, 0.03], kind: 'ticket', tag: 'ticket', mat: 'paintWhite', label: 'plasticBlue', yaw: ctx.rng.float(-3, 3) }
      : { half: [0.045, 0.004, 0.065], kind: 'card', tag: 'card', mat: 'paintWhite', label: 'plasticRed', yaw: ctx.rng.float(-3, 3) });
    if (!key) return;
    offer(ctx, { hook: 'carry.keycard', modes: ['appear'], weight: 1, required: true, revealOutput: `${sensor}.match`, doorway: { dir: d, at, y, width: 1.0, height: 2.0 }, tell: '改札の向こうから吹く風' });
    const k0 = wallPoint(r, d, at - 1.0, 0, y), k1 = wallPoint(r, d, at + 1.0, 1.9, y);
    ctx.keepOut({ min: [Math.min(k0[0], k1[0]), y - 0.1, Math.min(k0[2], k1[2])], max: [Math.max(k0[0], k1[0]), y + 2.6, Math.max(k0[2], k1[2])] });
  },
});

const LOST_KINDS: { kind: string; half: Vec3 }[] = [
  { kind: 'umbrella', half: [0.12, 0.42, 0.12] }, { kind: 'bag', half: [0.2, 0.17, 0.09] }, { kind: 'toy', half: [0.12, 0.17, 0.1] },
];

defineGimmick({
  id: 'lostItem', name: '落とし物を届ける', axes: ['carry'], kinds: ['room'], minSize: [3.6, 4.2], weight: 0.3, intensity: 0, offersSecret: true, requiresSecret: true, onMainPath: false,
  fits: (s) => s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance ?? s.openings[0]!;
    const opp = ((ent.dir + 2) % 4) as Dir;
    // 机（入口の向かいの壁際）と、別の壁の隠しの入口
    const deskW = freeSpans(r, s.openings, opp, 1.6, 0.8)[0];
    if (!deskW) return;
    const doorW = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).filter((d) => d !== opp).map((d) => ({ d, sp: freeSpans(r, s.openings, d, 1.4, 0.8)[0] })).find((w) => w.sp);
    const color = ctx.rng.pick(PARCEL_COLORS);
    ctx.addBox(wallBox(r, opp, deskW.at, 0.6, y, y + 0.72, 0.6, 'furnitureDark', true));
    ctx.addBox(wallBox(r, opp, deskW.at, 0.62, y + 0.72, y + 0.76, 0.62, 'woodPanel', true));
    // 名札（色）: 机の上の立て札と、壁の札
    ctx.addBox(wallBox(r, opp, deskW.at + 0.4, 0.09, y + 0.76, y + 0.86, 0.02, color.mat, false, 0.12));
    ctx.addBox(wallBox(r, opp, deskW.at, 0.25, y + 1.5, y + 1.65, 0.02, color.mat));
    const slot = wallPoint(r, opp, deskW.at - 0.15, 0.32, y + 0.76);
    const desk = ctx.addEntity('desk', { type: 'carryReceiver', params: { slots: [{ pos: slot, r: 0.7, accept: ['lost'], want: [`lost.${color.id}`] }], markMat: color.mat } });
    const lk = ctx.rng.pick(LOST_KINDS);
    const item = placeFar(ctx, 'lost', { half: lk.half, kind: lk.kind, tag: `lost.${color.id}`, mat: color.mat, label: color.mat, yaw: ctx.rng.float(-3, 3) }, 2);
    if (!item || !doorW) return;
    offer(ctx, { hook: 'carry.lost.returned', modes: ['appear'], weight: 1, required: true, revealOutput: `${desk}.ok`, doorway: { dir: doorW.d, at: doorW.sp!.at, y, width: 1.0, height: 2.0 }, tell: '机の上の名札' });
    const k0 = wallPoint(r, opp, deskW.at - 0.8, 0, y), k1 = wallPoint(r, opp, deskW.at + 0.8, 1.6, y);
    ctx.keepOut({ min: [Math.min(k0[0], k1[0]), y - 0.1, Math.min(k0[2], k1[2])], max: [Math.max(k0[0], k1[0]), y + 2.6, Math.max(k0[2], k1[2])] });
  },
});

defineGimmick({
  id: 'bulbRoom', name: '電球を付け替える', axes: ['carry', 'light'], kinds: ['room', 'hall'], minSize: [4.2, 5], weight: 0.35, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    // 電気スタンド: 部屋の真ん中寄り（開口の前を避ける）
    const at = floorSpots(ctx, 1, { margin: 1.2, doorD: 1.8 })?.[0];
    if (!at) return;
    const top = y + 1.45;
    ctx.addBox(box([at[0] - 0.22, y, at[2] - 0.22], [at[0] + 0.22, y + 0.05, at[2] + 0.22], 'metalDark'));
    ctx.addBox(box([at[0] - 0.025, y + 0.05, at[2] - 0.025], [at[0] + 0.025, top, at[2] + 0.025], 'metalDark'));
    ctx.addBox(box([at[0] - 0.05, top, at[2] - 0.05], [at[0] + 0.05, top + 0.05, at[2] + 0.05], 'metal', false));
    const socket = ctx.addEntity('socket', { type: 'carryReceiver', params: { slots: [{ pos: [at[0], top + 0.05, at[2]], r: 0.6, accept: ['bulb'] }], mark: false } });
    // 部屋の照明（消えている）は、電球が入ると全部つく。スタンドの灯りも
    const lit = ctx.addEntity('lit', { type: 'threshold', params: { min: 0.5 }, inputs: { in: `${socket}.count` } });
    const lamp = roomLamp(ctx, 'lights', false, { on: `${lit}.out` }, 1.5);
    s.cell.lights.push({ pos: [at[0], top + 0.3, at[2]], color: 0xffd8a0, intensity: 0.9, distance: 6, lampId: lamp });
    const bulb = placeFar(ctx, 'bulb', { half: [0.06, 0.09, 0.06], kind: 'bulb', tag: 'bulb', mat: 'metal', yaw: 0 }, 1);
    if (!bulb) return;
    // 暗がりの壁の隠し（存在型 = 暗くて見えない / 出現型 = 明るくなると現れる）
    const wall = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).map((d) => ({ d, sp: freeSpans(r, s.openings, d, 1.4, 0.9)[0] })).find((w) => w.sp);
    if (wall) offer(ctx, { hook: 'carry.bulb.lit', modes: ['present', 'appear'], weight: 1, revealOutput: `${lit}.out`, doorway: { dir: wall.d, at: wall.sp!.at, y, width: 1.0, height: 2.0 }, tell: '空の電球の受け口' });
    ctx.keepOut({ min: [at[0] - 0.8, y - 0.1, at[2] - 0.8], max: [at[0] + 0.8, y + 2.6, at[2] + 0.8] });
  },
});
