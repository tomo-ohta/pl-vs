/**
 * 回る・動く床と壁の部屋（4 種）。
 *
 * - spinFloor 回る床 [QR M11]: 部屋の真ん中に大きな円盤。上に立つと一緒に回され、円盤の上の柱も回って押してくる。
 *     渡るには回りに合わせて斜めに歩く。隠し turntable.rim [BM09]（出現型）: 円盤の縁に乗り続けて 1 周すると、外周の壁に扉が開く
 * - revolvingDoor 回転扉 [M34]: 部屋を仕切る厚い壁の真ん中に、4 枚の羽の回転扉。羽を押すと回り、手を離しても勢いで回り続ける。
 *     扉の横の 2 つの口は別の通路（一方は入口の側へ、もう一方は出口の側へ戻る）。走って押すと勢いが付き、横の通路へ出てしまう
 * - pushWall 押せる壁 [M35]: 部屋を仕切る壁の板が数枚並ぶ。1 枚だけ押すとゆっくり動き、道が開く（床の擦り傷が目印）。
 *     反対の側から押せば反対へ動く（どちらから来ても通れる）
 * - slantRoom 傾いていく部屋 [QR M37]: 床の上にいる間、床がだんだん横へ傾き、高い側の家具が滑ってきて低い側の壁で止まる。
 *     吊り下がった照明だけはまっすぐ下を向いたまま（傾いているのは床の方だと分かる）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, WALL_T, type MatId } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, cutFloorSlab, fillRects, innerRect } from '../util.ts';
import { hallAabb, hallBox, hallOf, hallPoint } from './common.ts';

const opposite = (s: { entrance: { dir: number } | null; exit: { dir: number } | null }): boolean => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4;

// ---------------------------------------------------------------- 回る床
defineGimmick({
  id: 'spinFloor', name: '回る床', axes: ['move'], kinds: ['room', 'hall'], minSize: [5.0, 5.0], weight: 0.45, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning, y = s.cell.floorY;
    const r = innerRect(s);
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    let R = t['move.turn.radiusMaxM'];
    for (const d of [0, 1, 2, 3] as Dir[]) {
      const dist = d === 0 ? r.z1 - cz : d === 2 ? cz - r.z0 : d === 1 ? r.x1 - cx : cx - r.x0;
      R = Math.min(R, dist - (s.openings.some((o) => o.dir === d) ? 1.35 : 0.45));
    }
    if (R < 1.9) return;
    const omega = t['move.turn.omega'] * (ctx.rng.chance(0.5) ? 1 : -1);
    // 円盤の上の柱（腰の高さ）: 真ん中と縁の間に等間隔
    const n = R >= 2.6 ? 3 : 2;
    const a0 = ctx.rng.float(0, Math.PI * 2);
    const posts = [...Array(n).keys()].map((i) => [R * 0.52, a0 + (i * Math.PI * 2) / n, 0.2, 1.05]);
    const rimSec = Math.max(t['move.turn.rimSec'], 0);
    const id = ctx.addEntity('disc', {
      type: 'spinFloor', params: { center: [cx, y, cz], radius: R, omega, posts, rimR: R - 0.65, rimSec },
    });
    // 円盤の真ん中の上の照明（回っているのが分かる、輪の形の照明は描画が作る）
    ctx.keepOut({ min: [cx - R - 0.3, y - 0.1, cz - R - 0.3], max: [cx + R + 0.3, y + s.cell.height, cz + R + 0.3] });
    // 隠し（出現型）: 開口の無い壁を選ぶ（無ければ開口から遠い所）
    const walls = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).filter((d) => !s.openings.some((o) => o.dir === d));
    for (const d of walls) {
      const at = d === 0 || d === 2 ? cx : cz;
      ctx.offerSecret({ hook: 'turntable.rim', modes: ['appear'], weight: 1.0, revealOutput: `${id}.done`, doorway: { dir: d, at, y, width: 1.0, height: 2.0 }, tell: '円盤の縁にだけ、すり減った足跡の輪がある' });
      break;
    }
  },
});

// ---------------------------------------------------------------- 回転扉
defineGimmick({
  id: 'revolvingDoor', name: '回転扉', axes: ['move'], kinds: ['room', 'hall'], minSize: [4.0, 7.0], minHeight: 2.4, weight: 0.6, intensity: 1, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const H = hallOf(s, false);
    if (!H) return;
    const Rd = t['move.revolve.radiusM'];
    if (H.W < 2 * Rd + 0.3 || H.L < 2 * Rd + 3.0) return;
    const vc = H.L / 2;
    const cu = Math.min(H.F.u1 - Rd, Math.max(H.F.u0 + Rd, (H.entU + (H.exitU ?? H.entU)) / 2));
    const bv0 = vc - Rd, bv1 = vc + Rd;
    // 仕切りの帯の範囲に横の開口があれば置かない
    if (s.openings.some((o) => o !== s.entrance && (() => { const v = H.F.v(o.pos[0], o.pos[2]); return v > bv0 - o.width / 2 - 0.8 && v < bv1 + o.width / 2 + 0.8; })())) return;
    const wallMat: MatId = s.cell.palette.wall;
    const h = H.h;
    const CW = 1.1, cv0 = vc - 0.55, cv1 = vc + 0.55;
    // 横の通路: 左（u0 側）は入口の側へ、右（u1 側）は出口の側へ折れて戻る
    const leftOK = cu - Rd - H.F.u0 >= CW + 0.2, rightOK = H.F.u1 - (cu + Rd) >= CW + 0.2;
    const fill = (u0: number, u1: number, holes: { u0: number; v0: number; u1: number; v1: number }[]): void => {
      if (u1 - u0 < 0.02) return;
      const area = H.F.rect(u0, bv0, u1, bv1);
      for (const q of fillRects(area, holes.map((x) => H.F.rect(x.u0, x.v0, x.u1, x.v1)))) ctx.addBox(box([q.x0, H.y, q.z0], [q.x1, H.y + h, q.z1], wallMat));
    };
    fill(H.F.u0, cu - Rd, leftOK ? [{ u0: H.F.u0, v0: cv0, u1: cu - Rd, v1: cv1 }, { u0: H.F.u0, v0: bv0, u1: H.F.u0 + CW, v1: cv0 }] : []);
    fill(cu + Rd, H.F.u1, rightOK ? [{ u0: cu + Rd, v0: cv0, u1: H.F.u1, v1: cv1 }, { u0: H.F.u1 - CW, v0: cv1, u1: H.F.u1, v1: bv1 }] : []);
    // 扉の筒: 四隅の柱（ガラスの壁の枠）。開いた口の幅は 2 × 0.62 × Rd
    const k = 0.62;
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const ua = cu + su * k * Rd, ub = cu + su * Rd, va = vc + sv * k * Rd, vb = vc + sv * Rd;
      ctx.addBox(hallBox(H, Math.min(ua, ub), Math.min(va, vb), Math.max(ua, ub), Math.max(va, vb), 0, h, 'metalDark'));
    }
    // 横の口に通路が無ければ、口を壁で塞ぐ
    if (!leftOK) ctx.addBox(hallBox(H, cu - Rd, vc - k * Rd, cu - Rd + 0.12, vc + k * Rd, 0, h, 'glass'));
    if (!rightOK) ctx.addBox(hallBox(H, cu + Rd - 0.12, vc - k * Rd, cu + Rd, vc + k * Rd, 0, h, 'glass'));
    // 通路の照明（暗い通路の先に灯り）
    for (const [ok, u] of [[leftOK, H.F.u0 + CW / 2], [rightOK, H.F.u1 - CW / 2]] as const) {
      if (!ok) continue;
      const p = hallPoint(H, u, vc, h - 0.4);
      s.cell.lights.push({ pos: p, color: 0xffe0b0, intensity: 0.35, distance: 3.5 });
    }
    ctx.addEntity('door', {
      type: 'revolvingDoor', params: {
        center: hallPoint(H, cu, vc), radius: Rd, height: h, angle0: Math.PI / 4,
        walkW: t['move.revolve.walkW'], runW: t['move.revolve.runW'], damp: t['move.revolve.damp'], share: 0.55,
      },
    });
    ctx.keepOut(hallAabb(H, H.F.u0, bv0 - 0.9, H.F.u1, bv1 + 0.9, -0.1, h));
  },
});

// ---------------------------------------------------------------- 押せる壁
defineGimmick({
  id: 'pushWall', name: '押せる壁', axes: ['move', 'sight'], kinds: ['room', 'hall'], minSize: [3.0, 7.0], weight: 0.5, intensity: 1, onMainPath: true,
  fits: (s) => !!s.entrance && !!s.exit,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const H = hallOf(s, false);
    if (!H) return;
    const T = 0.3, PW = 1.1;
    const travel = t['move.push.travelM'];
    const vp = Math.min(H.L - travel - T - 1.6, Math.max(travel + 0.9, H.L * 0.45));
    if (vp < travel + 0.9 - 1e-6 || vp + T + travel + 1.4 > H.L) return;
    // 仕切りの範囲に横の開口があれば置かない（仕切りで開口が塞がる）
    if (s.openings.some((o) => o !== s.entrance && Math.abs(H.F.v(o.pos[0], o.pos[2]) - (vp + T / 2)) < o.width / 2 + 0.4)) return;
    // 板の並び: 壁に沿って PW の板を等間隔に。押せるのは 1 枚（入口と出口の間のどこか）
    const n = Math.floor((H.W - 0.2) / (PW + 0.25));
    if (n < 1) return;
    const span = n * PW + (n - 1) * 0.25;
    const us = [...Array(n).keys()].map((i) => H.F.u0 + (H.W - span) / 2 + i * (PW + 0.25) + PW / 2);
    const mid = (H.entU + (H.exitU ?? H.entU)) / 2;
    const order = us.map((u, i) => ({ u, i })).sort((a, b) => Math.abs(a.u - mid) - Math.abs(b.u - mid));
    const pick = order[ctx.rng.int(0, Math.min(order.length, 3) - 1)]!;
    const pal = s.cell.palette;
    // 仕切りの壁（押せる板の所だけ空ける）。ほかの板は壁の前に貼った飾り
    const pu = pick.u;
    const area = H.F.rect(H.F.u0, vp, H.F.u1, vp + T);
    for (const q of fillRects(area, [H.F.rect(pu - PW / 2, vp, pu + PW / 2, vp + T)])) ctx.addBox(box([q.x0, H.y, q.z0], [q.x1, H.y + H.h, q.z1], pal.wall));
    for (const u of us) {
      if (u === pu) continue;
      for (const side of [-1, 1]) {
        const v = side < 0 ? vp - 0.02 : vp + T;
        ctx.addBox(hallBox(H, u - PW / 2, v, u + PW / 2, v + 0.02, 0, H.h - 0.02, 'woodPanel', false));
      }
    }
    // 押せる板の前後の床の擦り傷（目印）
    for (const side of [-1, 1]) {
      for (const du of [-0.35, 0, 0.35]) {
        const v0 = side < 0 ? vp - 1.2 : vp + T + 0.1, v1 = side < 0 ? vp - 0.1 : vp + T + 1.2;
        const b = ctx.addBox(hallBox(H, pu + du - 0.015, v0, pu + du + 0.015, v1, 0, 0.003, 'shadowDecal', false));
        b.kind = 'scuff';
      }
    }
    const blk = hallAabb(H, pu - PW / 2 + 0.01, vp, pu + PW / 2 - 0.01, vp + T, 0, H.h - 0.02);
    const ax = Math.abs(H.fwd[0]) > 0.5 ? 0 : 2;
    ctx.addEntity('wall', {
      type: 'pushBlock', params: { box: aabbJson(blk), axis: ax, travel, min: -travel, max: travel, speed: t['move.push.speed'], mat: 'woodPanel' },
    });
    ctx.keepOut(hallAabb(H, H.F.u0, vp - travel - 0.9, H.F.u1, vp + T + travel + 0.9, -0.1, H.h));
  },
});

// ---------------------------------------------------------------- 傾いていく部屋
defineGimmick({
  id: 'slantRoom', name: '傾いていく部屋', axes: ['move', 'sight'], kinds: ['room', 'hall'], minSize: [4.2, 6.0], minHeight: 2.6, weight: 1.0, intensity: 2, onMainPath: true,
  fits: (s) => opposite(s) && s.openings.length === 2,
  build(ctx) {
    const s = ctx.slot, t = ctx.tuning;
    const H = hallOf(s);
    if (!H || H.W < 4.2 || H.W > 9 || H.L < 6) return;
    const uc = (H.F.u0 + H.F.u1) / 2;
    if (Math.abs(H.entU - uc) > 0.6 || Math.abs((H.exitU ?? uc) - uc) > 0.6) return;
    const maxDeg = t['move.tilt.maxDeg'];
    const land = 1.2;
    const deck: Rect = H.F.rect(H.F.u0, land, H.F.u1, H.L - land);
    const depth = Math.tan((maxDeg * Math.PI) / 180) * (H.W / 2) + 0.35;
    cutFloorSlab(s, deck);
    // 穴の底と側壁。部屋の壁に接する辺は壁の厚みの中、入口・出口の床に接する辺は床の下（穴の内側に縁を残さない）
    const inner = innerRect(s), mat = s.cell.palette.wall;
    ctx.addBox(box([deck.x0, H.y - depth - 0.2, deck.z0], [deck.x1, H.y - depth, deck.z1], s.cell.palette.floor));
    const ex = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3;
    const x0 = ex(deck.x0, inner.x0) ? [deck.x0 - WALL_T, deck.x0] : [deck.x0 - 0.15, deck.x0];
    const x1 = ex(deck.x1, inner.x1) ? [deck.x1, deck.x1 + WALL_T] : [deck.x1, deck.x1 + 0.15];
    const z0 = ex(deck.z0, inner.z0) ? [deck.z0 - WALL_T, deck.z0] : [deck.z0 - 0.15, deck.z0];
    const z1 = ex(deck.z1, inner.z1) ? [deck.z1, deck.z1 + WALL_T] : [deck.z1, deck.z1 + 0.15];
    const yb = H.y - depth - 0.2;
    ctx.addBox(box([x0[0]!, yb, z0[0]!], [x0[1]!, H.y, z1[1]!], mat));
    ctx.addBox(box([x1[0]!, yb, z0[0]!], [x1[1]!, H.y, z1[1]!], mat));
    ctx.addBox(box([x0[1]!, yb, z0[0]!], [x1[0]!, H.y, z0[1]!], mat));
    ctx.addBox(box([x0[1]!, yb, z1[0]!], [x1[0]!, H.y, z1[1]!], mat));
    ctx.reachAssist(box([deck.x0, H.y - 0.1, deck.z0], [deck.x1, H.y, deck.z1], s.cell.palette.floor));
    const alongX = Math.abs(H.fwd[0]) > 0.5;
    const ca = alongX ? 2 : 0;
    // 低い側（u1 側なら lowHi）。down は世界の座標の向き（傾きの軸に垂直な座標の正の側が下がるなら +1）
    const lowHi = ctx.rng.chance(0.5);
    const down = Math.sign(H.side[ca]) * (lowHi ? 1 : -1);
    // 家具: 高い側に、奥行きの違う所へ（滑る道がぶつからない）
    const kinds: { w: number; d: number; h: number; mat: MatId }[] = [
      { w: 0.5, d: 0.5, h: 0.9, mat: 'furnitureLight' }, { w: 0.7, d: 1.1, h: 0.75, mat: 'woodPanel' },
      { w: 0.5, d: 0.9, h: 1.2, mat: 'furnitureDark' }, { w: 0.55, d: 0.55, h: 0.45, mat: 'boxCardboard' },
    ];
    const items: { min: number[]; max: number[]; mat: MatId }[] = [];
    const limits: number[] = [];
    let v = land + 0.6;
    const hiU0 = lowHi ? H.F.u0 + 0.15 : uc + 0.75, hiU1 = lowHi ? uc - 0.75 : H.F.u1 - 0.15;
    while (v < H.L - land - 0.8 && items.length < 4) {
      const k = kinds[ctx.rng.int(0, kinds.length - 1)]!;
      if (v + k.d > H.L - land - 0.4 || hiU1 - hiU0 < k.w) break;
      const u0 = lowHi ? hiU0 + ctx.rng.float(0, Math.max(0, hiU1 - hiU0 - k.w) * 0.4) : hiU1 - k.w - ctx.rng.float(0, Math.max(0, hiU1 - hiU0 - k.w) * 0.4);
      const a = hallAabb(H, u0, v, u0 + k.w, v + k.d, 0, k.h);
      items.push({ min: [...a.min], max: [...a.max], mat: k.mat });
      // 低い側の壁まで
      const lim = down > 0 ? (ca === 0 ? deck.x1 : deck.z1) - a.max[ca] - 0.04 : a.min[ca] - (ca === 0 ? deck.x0 : deck.z0) - 0.04;
      limits.push(Math.max(0, lim));
      v += k.d + ctx.rng.float(0.5, 1.0);
    }
    ctx.addEntity('floor', {
      type: 'tiltDeck', params: {
        rect: { x0: deck.x0, z0: deck.z0, x1: deck.x1, z1: deck.z1 }, axis: alongX ? 0 : 2, y: H.y, down, maxDeg, rate: t['move.tilt.rate'],
        push: t['move.tilt.push'], items, limits, mu: 0.09, mat: s.cell.palette.floor, depth,
      },
    });
    // 吊り下がった照明（傾いても、まっすぐ下を向いたまま）
    for (const k of [0.3, 0.7]) {
      const p = hallPoint(H, uc, land + (H.L - 2 * land) * k);
      const len = Math.min(0.9, H.h - 2.15);
      if (len < 0.2) continue;
      ctx.addBox(box([p[0] - 0.01, H.y + H.h - len, p[2] - 0.01], [p[0] + 0.01, H.y + H.h, p[2] + 0.01], 'metalDark', false));
      ctx.addBox(box([p[0] - 0.2, H.y + H.h - len - 0.18, p[2] - 0.2], [p[0] + 0.2, H.y + H.h - len, p[2] + 0.2], 'lightWarm', false));
      s.cell.lights.push({ pos: [p[0], H.y + H.h - len - 0.3, p[2]], color: 0xffd8a0, intensity: 0.5, distance: 5 });
    }
    ctx.keepOut(hallAabb(H, H.F.u0, 0, H.F.u1, H.L, -0.1, H.h));
  },
});
