/**
 * 曲がると変わる景色（cornerSwap: W07）。部品は swapSet（見ていない間の差し替え。順に回す）。
 *
 * 遊び方: 扉を開けると、目の前に天井までの仕切りの壁。仕切りと扉の壁の間の細い通路を歩き、端の切れ目を曲がって部屋の奥へ出る。
 * 角を曲がって振り返ると、通ってきた切れ目は壁になっていて、反対の端に切れ目がある。のぞくと、来た通路は別の部屋
 * （ロッカーの並ぶ更衣室・本棚と赤い絨毯の書斎・椅子の並ぶ待合）になっている。出て戻るたびに、通路は次の部屋に変わる。
 * 来た扉はいつも同じ所にある（通路は必ずどちらかの切れ目から入れる。閉じ込めない）。
 * 差し替えは、通路と切れ目のどちらも見えていない間だけ（通路の中に人がいる間は変えない）。
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import type { Dir } from '../../../math/vec.ts';
import type { Box, Json, MatId } from '../../../world/layout.ts';
import type { SwapBox } from '../../../sim/parts/warp/swap.ts';
import { reachOpenings } from '../../reach.ts';
import { defineGimmick } from '../types.ts';
import { innerRect } from '../util.ts';
import { ceilingLight, makeFrame } from './pocket.ts';

const PT = 0.12;
const LIN = 0.02;

interface Look { wall: MatId | null; floor: MatId | null; wainscot?: MatId }
const LOOKS: Look[] = [
  { wall: null, floor: null },
  { wall: 'wallConcrete', floor: 'floorConcrete' },
  { wall: 'woodPanel', floor: 'floorCarpetRed' },
  { wall: 'wallGreen', floor: 'floorLino', wainscot: 'wainscotCream' },
];

defineGimmick({
  id: 'cornerSwap', name: '曲がると変わる景色', axes: ['sight'], kinds: ['room', 'hall'], minSize: [5.2, 6.4], minHeight: 2.4, weight: WARP_TUNING['warp.cornerSwap.weight'].default, intensity: 1,
  onMainPath: true,
  fits: (s) => !!s.entrance && s.cell.footprint.length === 1,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const ent = s.entrance!;
    const r = innerRect(s);
    const y = s.cell.floorY, H = s.cell.height;
    const D = t['warp.cornerSwap.passageM'], G = t['warp.cornerSwap.gapM'];
    // 局所の座標: u = 扉の壁の内面から部屋の奥へ・v = 壁に沿って（左）。原点は扉の壁の内面の真ん中
    const fwd = ((ent.dir + 2) % 4) as Dir;
    const alongX = ent.dir === 0 || ent.dir === 2;
    const o: [number, number, number] = ent.dir === 0 ? [(r.x0 + r.x1) / 2, y, r.z1] : ent.dir === 2 ? [(r.x0 + r.x1) / 2, y, r.z0] : ent.dir === 1 ? [r.x1, y, (r.z0 + r.z1) / 2] : [r.x0, y, (r.z0 + r.z1) / 2];
    const f = makeFrame(o, fwd);
    const hw = (alongX ? r.x1 - r.x0 : r.z1 - r.z0) / 2;
    const depth = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
    if (hw * 2 < 2 * G + 2.4 || depth < D + PT + 3.0) return;
    // 開口の局所の座標（u, v）と、どの壁か（0: 扉の壁 / 1: 奥の壁 / ±: 横の壁）
    const loc = (p: readonly number[]): [number, number] => {
      const dx = p[0]! - o[0], dz = p[2]! - o[2];
      const fu = f.p(1, 0, 0), fv = f.p(0, 0, 1);
      const ux = fu[0] - o[0], uz = fu[2] - o[2], vx = fv[0] - o[0], vz = fv[2] - o[2];
      return [dx * ux + dz * uz, dx * vx + dz * vz];
    };
    const ops = s.openings.map((op) => {
      const [u, v] = loc(op.pos);
      const wall = op.dir === ent.dir ? 'near' : op.dir === ((ent.dir + 2) % 4) ? 'far' : v > 0 ? 'left' : 'right';
      return { op, u, v, wall };
    });
    // 横の壁の開口は仕切りの線から離れていること（通路の中か、仕切りの奥）
    if (ops.some((x) => (x.wall === 'left' || x.wall === 'right') && x.u + x.op.width / 2 > D - 0.25 && x.u - x.op.width / 2 < D + PT + 0.25)) return;
    // 仕切りの線に、ほかの仕掛けの当たる箱が無いこと
    const strip = f.aabb(D - 0.3, 0.05, -hw + 0.05, D + PT + 0.3, H - 0.05, hw - 0.05);
    if (s.cell.boxes.some((b) => b.solid && b.min[0] < strip.max[0] && b.max[0] > strip.min[0] && b.min[2] < strip.max[2] && b.max[2] > strip.min[2] && b.min[1] < strip.max[1] && b.max[1] > strip.min[1])) return;
    // 仕切りの真ん中（いつもある）
    ctx.addBox(f.box(D, 0, -hw + G, D + PT, H, hw - G, s.cell.palette.wall));
    // 照明: 仕切りの線に掛かる物は外し、通路と奥に付け直す
    const inStrip = (x: number, z: number): boolean => { const [u] = loc([x, 0, z]); return u > D - 0.45 && u < D + PT + 0.45; };
    ctx.removeBoxes((b) => !b.solid && b.mat === s.cell.palette.light && inStrip((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2));
    s.cell.lights = s.cell.lights.filter((l) => !inStrip(l.pos[0], l.pos[2]));
    const lit = (u0: number, u1: number): boolean => s.cell.lights.some((l) => { const [u] = loc(l.pos); return u > u0 && u < u1; });
    if (!lit(0, D)) ceilingLight(s.cell, f, D / 2, 0, H, false, true, 0.7, 5);
    if (!lit(D + PT, depth)) ceilingLight(s.cell, f, (D + PT + depth) / 2, 0, H, false, true, 1, 6);

    // ---- 差し替える組: 切れ目の塞ぎ（左右の端）と通路の見た目
    const near = ops.filter((x) => x.wall === 'near');
    const sideIn = ops.filter((x) => (x.wall === 'left' || x.wall === 'right') && x.u < D);
    const toSwap = (b: Box): SwapBox => ({ min: [...b.min], max: [...b.max], mat: b.mat, solid: b.solid });
    // 入口から遠い端の切れ目から始める
    const far = Math.abs(loc(ent.pos)[1] - -hw) > Math.abs(loc(ent.pos)[1] - hw) ? -1 : 1;
    const plug = (end: -1 | 1, look: Look): Box[] => {
      const [v0, v1] = end < 0 ? [-hw, -hw + G] : [hw - G, hw];
      const out = [f.box(D, 0, v0, D + PT, H, v1, s.cell.palette.wall)];
      if (look.wall) out.push(f.box(D - LIN, 0, v0, D, H, v1, look.wall, false));
      return out;
    };
    /** 面（u0..u1 × v0..v1）を、開口の穴を空けて張る。holes は [a0, a1, 高さ] */
    const panel = (put: (a0: number, a1: number, y0: number, y1: number) => void, a0: number, a1: number, holes: [number, number, number][]): void => {
      let cur = a0;
      for (const [h0, h1, hh] of holes.sort((p, q) => p[0] - q[0])) {
        if (h0 > cur) put(cur, h0, 0, H);
        put(Math.max(cur, h0), Math.min(a1, h1), hh, H);
        cur = Math.max(cur, h1);
      }
      if (a1 > cur) put(cur, a1, 0, H);
    };
    const lining = (look: Look): Box[] => {
      const out: Box[] = [];
      if (!look.wall) return out;
      const wallMat = look.wall;
      const layers = (put: (y0: number, y1: number, mat: MatId) => void, y0: number, y1: number): void => {
        if (look.wainscot && y0 < 1.0) { put(y0, Math.min(1.0, y1), look.wainscot); if (y1 > 1.0) put(1.0, y1, wallMat); } else put(y0, y1, wallMat);
      };
      // 扉の壁
      panel((a0, a1, y0, y1) => layers((p, q, m) => out.push(f.box(0, p, a0, LIN, q, a1, m, false)), y0, y1), -hw, hw, near.map((x) => [x.v - x.op.width / 2 - 0.01, x.v + x.op.width / 2 + 0.01, (x.op.sill ?? 0) + x.op.height + 0.01]));
      // 仕切りの通路側（真ん中）
      layers((p, q, m) => out.push(f.box(D - LIN, p, -hw + G, D, q, hw - G, m, false)), 0, H);
      // 横の壁（通路と切れ目の厚みまで）
      for (const sg of [-1, 1] as const) {
        const holes = sideIn.filter((x) => Math.sign(x.v) === sg).map((x) => [x.u - x.op.width / 2 - 0.01, x.u + x.op.width / 2 + 0.01, (x.op.sill ?? 0) + x.op.height + 0.01] as [number, number, number]);
        const v0 = sg < 0 ? -hw : hw - LIN, v1 = sg < 0 ? -hw + LIN : hw;
        panel((a0, a1, y0, y1) => layers((p, q, m) => out.push(f.box(a0, p, v0, a1, q, v1, m, false)), y0, y1), LIN, D + PT, holes);
      }
      if (look.floor) out.push(f.box(LIN, 0, -hw + LIN, D - LIN, 0.012, hw - LIN, look.floor, false));
      return out;
    };
    // 家具: 仕切りの通路側に沿って、両端の切れ目の前を空けた区間に（扉の向かいでも、扉の前に 1.1 m 以上空く奥行きの物だけ）
    const free: [number, number][] = [[-hw + G + 0.5, hw - G - 0.5]];
    const pics: [number, number][] = [];
    {
      let cur = -hw + 0.4;
      const blocked = near.map((x) => [x.v - x.op.width / 2 - 0.4, x.v + x.op.width / 2 + 0.4] as [number, number]).sort((p, q) => p[0] - q[0]);
      for (const [p, q] of blocked) { if (p > cur) pics.push([cur, p]); cur = Math.max(cur, q); }
      if (hw - 0.4 > cur) pics.push([cur, hw - 0.4]);
    }
    const furniture = (k: number): Box[] => {
      const out: Box[] = [];
      for (const [a0, a1] of free) {
        const len = a1 - a0;
        if (len < 0.6) continue;
        if (k === 1) {
          // 更衣室: ロッカーの列（0.5 m 幅）と、扉の線
          const n = Math.floor(len / 0.5);
          const c0 = (a0 + a1) / 2 - (n * 0.5) / 2;
          for (let i = 0; i < n; i++) {
            const v0 = c0 + i * 0.5;
            out.push(f.box(D - LIN - 0.48, 0, v0 + 0.01, D - LIN, 1.9, v0 + 0.49, 'lockerGreen', true));
            out.push(f.box(D - LIN - 0.49, 1.55, v0 + 0.12, D - LIN - 0.48, 1.6, v0 + 0.38, 'metalDark', false));
          }
        } else if (k === 2) {
          // 書斎: 本棚（2 m まで）
          const l = Math.min(len, 2.0);
          const c = (a0 + a1) / 2;
          out.push(f.box(D - LIN - 0.36, 0, c - l / 2, D - LIN, 2.0, c + l / 2, 'bookshelfWood', true));
          for (const hy of [0.45, 0.9, 1.35, 1.8]) out.push(f.box(D - LIN - 0.37, hy, c - l / 2 + 0.03, D - LIN - 0.36, hy + 0.3, c + l / 2 - 0.03, 'furnitureDark', false));
        } else if (k === 3) {
          // 待合: 扉の壁を向いた椅子の列
          const n = Math.floor(len / 0.6);
          const c0 = (a0 + a1) / 2 - (n * 0.6) / 2;
          for (let i = 0; i < n; i++) {
            const v0 = c0 + i * 0.6 + 0.08;
            out.push(f.box(D - LIN - 0.46, 0.42, v0, D - LIN - 0.04, 0.47, v0 + 0.44, 'seatBlue', true));
            out.push(f.box(D - LIN - 0.08, 0.47, v0, D - LIN - 0.03, 0.9, v0 + 0.44, 'seatBlue', true));
            out.push(f.box(D - LIN - 0.42, 0, v0 + 0.02, D - LIN - 0.38, 0.42, v0 + 0.06, 'metal', false));
            out.push(f.box(D - LIN - 0.42, 0, v0 + 0.38, D - LIN - 0.38, 0.42, v0 + 0.42, 'metal', false));
          }
        }
      }
      // 扉の壁の額（書斎・待合）
      if (k === 2 || k === 3) {
        const sp = pics.slice().sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
        if (sp && sp[1] - sp[0] >= 0.9) {
          const c = (sp[0] + sp[1]) / 2;
          out.push(f.box(LIN, 1.35, c - 0.4, LIN + 0.03, 1.95, c + 0.4, k === 2 ? 'goldTrim' : 'woodPanel', false));
          out.push(f.box(LIN + 0.03, 1.42, c - 0.33, LIN + 0.042, 1.88, c + 0.33, k === 2 ? 'skyDusk' : 'noticeGreen', false));
        }
      }
      return out;
    };
    // 組: 0 = 遠い端が切れ目（ふつう）・1 = 近い端・2 = 遠い端・3 = 近い端（出て戻るたびに次の組）
    const variants: SwapBox[][] = [];
    const allOps = s.openings;
    for (let k = 0; k < LOOKS.length; k++) {
      const look = LOOKS[k]!;
      const gapAt = k % 2 === 0 ? far : (-far as -1 | 1);
      const plugged = (-gapAt) as -1 | 1;
      let boxes = [...plug(plugged, look), ...lining(look)];
      const furn = furniture(k);
      // 家具を置いても、全部の開口へ歩けること（切れ目を通って）
      const reach = reachOpenings({ footprint: s.cell.footprint, floorY: y, boxes: [...s.cell.boxes, ...boxes, ...furn] }, allOps, 0.1);
      if (!reach || !reach.blocked.length) boxes = [...boxes, ...furn];
      variants.push(boxes.map(toSwap));
    }
    // 見え方を調べる範囲: 通路（仕切りの厚みまで）と、両端の塞ぎの部屋側の面
    const passage = f.aabb(0, 0.1, -hw, D + PT, 2.3, hw);
    const face = (end: -1 | 1) => { const [v0, v1] = end < 0 ? [-hw, -hw + G] : [hw - G, hw]; return f.aabb(D + PT, 0.1, v0, D + PT + 0.35, 2.3, v1); };
    const js = (a: { min: number[]; max: number[] }): Json => ({ min: [...a.min], max: [...a.max] });
    ctx.addEntity('swap', {
      type: 'swapSet',
      params: {
        slots: [{ region: js(passage), also: [js(face(-1)), js(face(1))], variants, init: 0, stayOut: true }] as unknown as Json,
        mode: 'random', order: 'cycle', chance: 1, minUnseen: t['warp.cornerSwap.unseenSec'], every: 3, sound: 'none',
      },
    });
    // 中身（家具）は通路と切れ目の前に置かない
    const keep = f.aabb(0, -0.1, -hw, D + PT + 2.2, 3, hw);
    ctx.keepOut({ min: [...keep.min], max: [...keep.max] });
  },
});
