/**
 * 光の床の部屋（段階 4・担当 sense）。部屋の床ほぼ全部が深い穴で、開口の前だけ固い床（入口と出口が向かい合う部屋は、壁沿いの帯の床）。
 * 穴の上の床は、光（か視線）が当たっている間だけある（部品 lightFloor）。落ちたら穴の底の階段で入口の床へ戻ってやり直し。
 * 隠し: 穴の底の壁の扉（落ちた人だけが見つける・存在型）。
 *
 * - beamFloor 照らした所だけある床 [L13]: 真っ暗な部屋。懐中電灯（R）で照らした床板だけが光って現れ、照らすのをやめると少しで消える。
 *     足元から目を離すと落ちる（止まるなら足元を照らす）。懐中電灯を消していると渡れない
 * - spotRide 動く光の中だけ床 [L03]: 真っ暗な部屋の天井から、光の円が入口の床と出口の床の間を往復する（両端で止まる。L 字に曲がることもある）。
 *     円の中だけ床がある。円が来るのを待ち、円と一緒に歩いて渡る
 * - lightBands 光の帯の上だけ歩ける [L18]: 天井の細い隙間から落ちる光の帯が、穴に橋を架ける。帯は 1 本ずつ点いては消える（消える前に瞬く）。
 *     点いたばかりの帯を選んで渡る（隣の帯へ乗り移ってもよい）。入口と出口が向かい合う部屋だけ
 * - lookBridge 見ている間だけある橋 [O07]: 穴に架かる 1 本の橋（L 字に曲がることもある）は、画面に映っている間だけある（目を離して少しで消える）。
 *     前を見て渡れば渡れる。振り返る・横を見続けると落ちる
 *
 * 部品の params.cross は渡る道（折れ線の列。入口の床の上 → 出口の床の上）。描画の手がかりと、試験の歩く人が使う
 */
import type { Rect } from '../../../world/footprint.ts';
import { aabbJson, frontOf, rectGap } from '../util.ts';
import { defineGimmick, type GimmickContext, type GimmickSlot } from '../types.ts';
import { pitSecret, planPit, type PitPlan } from '../pit.ts';
import { assistTiles, buildPit, darkenRoom, pitTiles } from './util.ts';

const kindsRoom = ['room', 'hall'] as const;
const facing = (s: GimmickSlot): boolean => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4;
/** 入口と出口が別の壁にある */
const apart = (s: GimmickSlot): boolean => !!s.entrance && !!s.exit && s.exit.dir !== s.entrance.dir;
/** 開口が入口と出口の 2 つだけ（道が入口と出口の間にしか無い仕掛け。ほかの開口の前の床が島にならないように） */
const onlyTwo = (s: GimmickSlot): boolean => s.openings.length === 2;

/** 穴の部屋の計画（まだ何も作らない）。向かい合う部屋は壁沿いの帯の床、そうでなければ開口の前の固い床 */
function planRoom(ctx: GimmickContext, depth: number): PitPlan | null {
  const s = ctx.slot;
  if (!apart(s)) return null;
  return planPit(ctx, { depth, strips: facing(s) });
}

/** 階段の通り（lane）を避けた、入口の壁に沿った範囲 */
function freeU(plan: PitPlan): [number, number] {
  const F = plan.frame;
  const lu = [F.u(plan.lane.x0, plan.lane.z0), F.u(plan.lane.x1, plan.lane.z1)].sort((a, b) => a - b) as [number, number];
  const lo = lu[0] <= F.u0 + 0.01 ? lu[1] + 0.25 : F.u0;
  const hi = lu[1] >= F.u1 - 0.01 ? lu[0] - 0.25 : F.u1;
  return [lo, hi];
}

/** 向かい合う部屋: 入口の真正面に近い、幅 w が階段に掛からない位置（入口の壁に沿った座標） */
function crossU(ctx: GimmickContext, plan: PitPlan, w: number): number | null {
  const [lo, hi] = freeU(plan);
  if (hi - lo < w + 0.2) return null;
  const e = ctx.slot.entrance!;
  const at = plan.frame.u(e.pos[0], e.pos[2]);
  return Math.min(Math.max(at, lo + w / 2 + 0.1), hi - w / 2 - 0.1);
}

/** 線分 p → q（軸に沿う）を幅 w に太らせた矩形 */
function segRect(p: number[], q: number[], w: number): Rect {
  const h = w / 2;
  return { x0: Math.min(p[0]!, q[0]!) - h, x1: Math.max(p[0]!, q[0]!) + h, z0: Math.min(p[1]!, q[1]!) - h, z1: Math.max(p[1]!, q[1]!) + h };
}

/**
 * 渡る道: 入口の床の上（壁から inset m）→ 出口の床の上の折れ線。向かい合う部屋はまっすぐ、隣り合う壁なら L 字。
 * 幅 w の道が、階段・ほかの開口の前の床に掛からないこと。置けなければ null
 */
function crossPath(ctx: GimmickContext, plan: PitPlan, w: number, inset: number): number[][] | null {
  const s = ctx.slot;
  const F = plan.frame;
  if (facing(s)) {
    const u = crossU(ctx, plan, w);
    return u === null ? null : [F.point(u, inset), F.point(u, F.depth - inset)];
  }
  const e = s.entrance!, x = s.exit!;
  const A = frontOf(e, inset), B = frontOf(x, inset);
  const C = e.dir % 2 === 0 ? [A[0], B[2]] : [B[0], A[2]];
  const pts = [[A[0], A[2]], C, [B[0], B[2]]];
  const blockers: Rect[] = [plan.lane, ...(plan.ledge ? [plan.ledge] : []), ...plan.landings.filter((l) => l.o !== e && l.o !== x).map((l) => l.rect)];
  for (let i = 1; i < pts.length; i++) {
    const r = segRect(pts[i - 1]!, pts[i]!, w + 0.3);
    if (blockers.some((b) => rectGap(b, r) < 0.05)) return null;
  }
  return pts;
}

/** 点 (x, z) から折れ線までの距離 */
function distToPath(pts: number[][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const ex = b[0]! - a[0]!, ez = b[1]! - a[1]!;
    const l2 = ex * ex + ez * ez;
    const k = l2 > 1e-9 ? Math.min(1, Math.max(0, ((x - a[0]!) * ex + (z - a[1]!) * ez) / l2)) : 0;
    best = Math.min(best, Math.hypot(a[0]! + ex * k - x, a[1]! + ez * k - z));
  }
  return best;
}

/** 穴の上の床板のうち、開口の前の固い床に中心が入るものを除く */
const overPit = (plan: PitPlan, r: number[]): boolean => {
  const cx = (r[0]! + r[2]!) / 2, cz = (r[1]! + r[3]!) / 2;
  return !plan.solidTop.some((q) => cx > q.x0 && cx < q.x1 && cz > q.z0 && cz < q.z1);
};

/** 組めると決まってから: 部屋の照明を消し（dark）、穴を作る（穴の底の灯りは照明を消した後に足すので点いたまま） */
function begin(ctx: GimmickContext, plan: PitPlan, dark: boolean): void {
  if (dark) darkenRoom(ctx);
  buildPit(ctx, plan);
}

function finish(ctx: GimmickContext, plan: PitPlan, hook: string, tell: string): void {
  const offer = pitSecret(ctx, plan, hook, tell);
  if (offer) ctx.offerSecret(offer);
  const y = plan.y;
  ctx.keepOut({ min: [plan.hole.x0, y - plan.depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
}

defineGimmick({
  id: 'beamFloor', name: '照らした所だけある床', axes: ['light', 'floor'], kinds: [...kindsRoom], minSize: [4.8, 6], minHeight: 2.4, weight: 0.35, intensity: 2, offersSecret: true, onMainPath: true,
  fits: apart,
  build(ctx) {
    const t = ctx.tuning;
    const plan = planRoom(ctx, t['sense.lightPit.depthM']);
    if (!plan) return;
    const F = plan.frame, landD = t['gimmick.pit.landingM'];
    const tiles = pitTiles(plan, t['sense.beamFloor.tileM'], F.u0, F.u1, 0, F.depth).map((x) => x.r);
    const cross = crossPath(ctx, plan, 1.2, landD - 0.6);
    if (tiles.length < 6 || !cross) return;
    begin(ctx, plan, true);
    ctx.addEntity('floor', { type: 'lightFloor', params: { mode: 'beam', tiles, cross: [cross], y: plan.y, thick: 0.1, grace: t['sense.beamFloor.graceSec'], beamDeg: t['sense.beamFloor.deg'], beamRange: t['sense.beamFloor.rangeM'], color: 0xbfe6ff } });
    assistTiles(ctx, tiles, plan.y);
    finish(ctx, plan, 'beam.fall', '照らした床板の隙間から、底の灯り');
  },
});

defineGimmick({
  id: 'spotRide', name: '動く光の中だけ床', axes: ['light', 'floor'], kinds: [...kindsRoom], minSize: [4.8, 6], minHeight: 2.4, weight: 0.3, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => apart(s) && onlyTwo(s),
  build(ctx) {
    const t = ctx.tuning;
    const plan = planRoom(ctx, t['sense.lightPit.depthM']);
    if (!plan) return;
    const F = plan.frame, landD = t['gimmick.pit.landingM'];
    const R = t['sense.spotRide.radiusM'];
    // 光の円の道: 入口の床の縁に少し掛かる所から、出口の床の縁に少し掛かる所まで
    const path = crossPath(ctx, plan, 2 * R + 0.2, landD - R * 0.55);
    if (!path) return;
    const tiles = pitTiles(plan, t['sense.spotRide.tileM'], F.u0, F.u1, 0, F.depth).map((x) => x.r).filter((r) => distToPath(path, (r[0]! + r[2]!) / 2, (r[1]! + r[3]!) / 2) <= R + 0.5);
    if (tiles.length < 4) return;
    begin(ctx, plan, true);
    ctx.addEntity('floor', {
      type: 'lightFloor',
      params: { mode: 'spot', tiles, cross: [path], y: plan.y, thick: 0.1, grace: 0.05, spotPath: path, spotSpeed: t['sense.spotRide.speed'], spotPause: t['sense.spotRide.pauseSec'], spotRadius: R, spotPhase: ctx.rng.float(0, 4), ceilingY: plan.y + ctx.slot.cell.height, color: 0xfff0c8 },
    });
    assistTiles(ctx, tiles, plan.y);
    finish(ctx, plan, 'spot.fall', '光の円の外の暗がりの底に、細い灯り');
  },
});

defineGimmick({
  id: 'lightBands', name: '光の帯の橋', axes: ['light', 'floor', 'time'], kinds: [...kindsRoom], minSize: [4.8, 6], minHeight: 2.4, weight: 0.3, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => facing(s) && onlyTwo(s),
  build(ctx) {
    const t = ctx.tuning;
    const plan = planRoom(ctx, t['sense.lightPit.depthM']);
    if (!plan) return;
    const F = plan.frame, landD = t['gimmick.pit.landingM'];
    const [lo, hi] = freeU(plan);
    const bw = t['sense.lightBands.widthM'], gap = t['sense.lightBands.gapM'];
    const n = Math.min(4, Math.floor((hi - lo - 0.3 + gap) / (bw + gap)));
    if (n < 2) return;
    const used = n * bw + (n - 1) * gap;
    const start = (lo + hi) / 2 - used / 2;
    const tiles: number[][] = [];
    const cross: number[][][] = [];
    for (let i = 0; i < n; i++) {
      const u0 = start + i * (bw + gap);
      cross.push([F.point(u0 + bw / 2, landD - 0.6), F.point(u0 + bw / 2, F.depth - landD + 0.6)]);
      const rr = F.rect(u0, landD, u0 + bw, F.depth - landD);
      tiles.push([rr.x0, rr.z0, rr.x1, rr.z1]);
    }
    // 位相: 帯ごとに周期を n 等分してずらす（いつもどれかが点いている。並びは乱数）
    // 点いている長さ: 1 本の帯を歩いて渡り切れる長さより長く（長い穴でも乗り移らずに渡れる）
    const crossLen = F.depth - 2 * landD;
    const on = Math.max(t['sense.lightBands.onSec'], crossLen / 2.6 + 1.2), off = t['sense.lightBands.offSec'];
    const order = ctx.rng.shuffle([...Array(n).keys()]);
    const phase = order.map((k) => ((on + off) * k) / n);
    begin(ctx, plan, true);
    ctx.addEntity('floor', { type: 'lightFloor', params: { mode: 'bands', tiles, cross, band: tiles.map((_r, i) => i), y: plan.y, thick: 0.1, grace: 0.05, onSec: on, offSec: off, warnSec: t['sense.lightBands.warnSec'], phase, ceilingY: plan.y + ctx.slot.cell.height, color: 0xfff6dc } });
    assistTiles(ctx, tiles, plan.y);
    finish(ctx, plan, 'bands.fall', '帯の消えた暗がりの底に、細い灯り');
  },
});

defineGimmick({
  id: 'lookBridge', name: '見ている間だけある橋', axes: ['sight', 'floor'], kinds: [...kindsRoom], minSize: [4.8, 6], minHeight: 2.4, weight: 0.35, intensity: 2, offersSecret: true, onMainPath: true,
  fits: (s) => apart(s) && onlyTwo(s),
  build(ctx) {
    const t = ctx.tuning;
    const plan = planRoom(ctx, t['sense.lightPit.depthM']);
    if (!plan) return;
    const landD = t['gimmick.pit.landingM'];
    const w = t['sense.lookBridge.widthM'];
    const path = crossPath(ctx, plan, w, landD - 0.6);
    if (!path) return;
    // 橋の板: 0.6 m ごと（目を離した所から消える）。開口の前の固い床の上には置かない
    const tiles: number[][] = [];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!, b = path[i]!;
      const len = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!);
      const n = Math.max(1, Math.round(len / 0.6));
      for (let k = 0; k < n; k++) {
        const p = [a[0]! + ((b[0]! - a[0]!) * k) / n, a[1]! + ((b[1]! - a[1]!) * k) / n], q = [a[0]! + ((b[0]! - a[0]!) * (k + 1)) / n, a[1]! + ((b[1]! - a[1]!) * (k + 1)) / n];
        // 道の向きには伸ばさず、横にだけ幅 w。曲がり角の板（最初・最後）は角を埋めるよう w / 2 だけ伸ばす
        const alongX = Math.abs(b[0]! - a[0]!) > Math.abs(b[1]! - a[1]!);
        const ext0 = k === 0 && i > 1 ? w / 2 : 0, ext1 = k === n - 1 && i < path.length - 1 ? w / 2 : 0;
        const lo = alongX ? Math.min(p[0]!, q[0]!) : Math.min(p[1]!, q[1]!), hi = alongX ? Math.max(p[0]!, q[0]!) : Math.max(p[1]!, q[1]!);
        const forward = alongX ? Math.sign(b[0]! - a[0]!) : Math.sign(b[1]! - a[1]!);
        const s0 = lo - (forward > 0 ? ext0 : ext1), s1 = hi + (forward > 0 ? ext1 : ext0);
        const c = alongX ? a[1]! : a[0]!;
        const rr = alongX ? [s0, c - w / 2, s1, c + w / 2] : [c - w / 2, s0, c + w / 2, s1];
        if (overPit(plan, rr)) tiles.push(rr);
      }
    }
    if (tiles.length < 2) return;
    begin(ctx, plan, false);
    ctx.addEntity('floor', { type: 'lightFloor', params: { mode: 'seen', tiles, cross: [path], y: plan.y, thick: 0.12, grace: t['sense.lookBridge.graceSec'], hdeg: 50, vdeg: 34, seenRange: 16, color: 0xd8e4f0, region: aabbJson({ min: [plan.hole.x0, plan.y - plan.depth, plan.hole.z0], max: [plan.hole.x1, plan.y + 3, plan.hole.z1] }) } });
    assistTiles(ctx, tiles, plan.y);
    finish(ctx, plan, 'look.fall', '橋の下の底に、細い灯り');
  },
});
