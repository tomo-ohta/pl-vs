/**
 * 回転する部屋（turnRoom: W11）。部品は warpTurnRoom（筒の部屋を回し、中の人を一緒に回す）。
 *
 * 遊び方: 扉を開けると、部屋の真ん中に木の板張りの丸い部屋（筒）があり、ゆっくり回っている。筒の外の通路は 4 枚の仕切りで区切られ、
 * 向かいの扉へは筒の中を通るしかない。筒の入口（向かい合う 2 か所）が目の前に来たら乗り込み、反対側の扉の前に入口が来たら降りる。
 * 筒の中では床と一緒に回り（景色が回る）、真ん中から離れるほど外へ押される（真ん中にいれば立っていられる）。
 * 閉じ込めない: 筒の入口はどの区切りの前にも回ってくる（どの扉の前からも、いつかは乗り降りできる）。
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import type { Dir } from '../../../math/vec.ts';
import { box, type Json } from '../../../world/layout.ts';
import type { TurnItem } from '../../../sim/parts/warp/turn.ts';
import { defineGimmick } from '../types.ts';
import { frontOf, innerRect } from '../util.ts';

const WT = 0.12;

defineGimmick({
  id: 'turnRoom', name: '回転する部屋', axes: ['move', 'sight'], kinds: ['room'], minSize: [6.8, 6.8], minHeight: 2.4, weight: WARP_TUNING['warp.turnRoom.weight'].default, intensity: 2,
  onMainPath: true,
  fits: (s) => s.cell.footprint.length === 1 && s.openings.length >= 1,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const r = innerRect(s);
    const y = s.cell.floorY, H = s.cell.height;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const ring = t['warp.turnRoom.ringM'];
    const R = Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2 - ring - WT / 2;
    if (R < 2.0) return;
    const outer = R + WT / 2;
    // 開口の前（0.6 m）は筒の外
    if (s.openings.some((o) => { const p = frontOf(o, 0.6); return Math.hypot(p[0] - cx, p[2] - cz) < outer + 0.35; })) return;
    // ほかの仕掛けの当たる箱が部屋の中に無いこと
    if (s.cell.boxes.some((b) => b.solid && b.min[1] > y + 0.05 && b.max[1] < y + H - 0.05 && b.min[0] > r.x0 - 0.01 && b.max[0] < r.x1 + 0.01 && b.min[2] > r.z0 - 0.01 && b.max[2] < r.z1 + 0.01)) return;
    // ---- 筒の外の通路の仕切り: 4 つの壁から筒へ 1 枚ずつ（壁に直角。扉の前を切らず、筒の真ん中に近い所）。
    // 仕切りの筒の側の端は、筒の外面から 4 cm 空ける（仕切りの角が筒にいちばん近い所で）
    const Ro = outer + 0.04;
    const cuts: Dir[] = [];
    for (const d of [1, 0, 3, 2] as Dir[]) {
      const alongX = d === 0 || d === 2; // 壁が x に沿う（仕切りは z の向き）
      const mid = alongX ? cx : cz;
      const ok = (at: number): boolean => !s.openings.some((o) => o.dir === d && Math.abs((alongX ? o.pos[0] : o.pos[2]) - at) < o.width / 2 + 0.75);
      let at: number | null = null;
      for (let k = 0; k <= 30 && at === null; k++) for (const sg of k ? [1, -1] : [1]) { const c = mid + sg * k * 0.1; if (Math.abs(c - mid) < Ro - 0.45 && ok(c)) { at = c; break; } }
      if (at === null) continue;
      const off = Math.max(0, Math.abs(at - mid) - 0.06);
      const reach = Math.sqrt(Ro * Ro - off * off);
      if (d === 1) ctx.addBox(box([cx + reach, y, at - 0.06], [r.x1, y + H, at + 0.06], s.cell.palette.wall));
      else if (d === 3) ctx.addBox(box([r.x0, y, at - 0.06], [cx - reach, y + H, at + 0.06], s.cell.palette.wall));
      else if (d === 0) ctx.addBox(box([at - 0.06, y, cz + reach], [at + 0.06, y + H, r.z1], s.cell.palette.wall));
      else ctx.addBox(box([at - 0.06, y, r.z0], [at + 0.06, y + H, cz - reach], s.cell.palette.wall));
      cuts.push(d);
    }
    // ---- 筒の部屋: 壁の高さ・入口（向かい合う 2 か所）・家具（angle = 0 のときの箱）
    const wallH = Math.min(H - 0.02, 2.75);
    const half = (t['warp.turnRoom.gapM'] / 2) / R;
    const g0 = ctx.rng.next() * Math.PI * 2;
    const gaps = [{ at: g0, half }, { at: (g0 + Math.PI) % (2 * Math.PI), half }];
    const items: TurnItem[] = [];
    const I = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: string, solid: boolean, rot: number): void => {
      items.push({ min: [cx + x0, y + y0, cz + z0], max: [cx + x1, y + y1, cz + z1], mat, solid, rot });
    };
    // 肘掛け椅子（真ん中を向く）を入口と入口の間に 2 脚ずつ・床置きの灯り・壁の額。
    // 当たり判定は家具ごとに真ん中の小さな四角 1 つ（回した箱を囲む箱が大きくならないように）
    const rc = R - WT / 2 - 0.55;
    for (const side of [0, Math.PI]) {
      for (const off of [-0.45, 0.45]) {
        const a = g0 + side + Math.PI / 2 + off;
        I(rc - 0.35, 0.1, -0.38, rc + 0.35, 0.45, 0.38, 'upholstery', false, a);
        I(rc + 0.17, 0.45, -0.38, rc + 0.35, 0.92, 0.38, 'upholstery', false, a);
        I(rc - 0.35, 0.45, -0.38, rc + 0.17, 0.62, -0.27, 'upholstery', false, a);
        I(rc - 0.35, 0.45, 0.27, rc + 0.17, 0.62, 0.38, 'upholstery', false, a);
        I(rc - 0.3, 0, -0.33, rc + 0.3, 0.1, 0.33, 'furnitureDark', false, a);
        I(rc - 0.27, 0, -0.27, rc + 0.27, 0.92, 0.27, 'colliderOnly', true, a);
      }
      const la = g0 + side + Math.PI / 2;
      I(rc + 0.1, 0, -0.05, rc + 0.2, 1.45, 0.05, 'metalDark', true, la);
      I(rc - 0.05, 1.45, -0.18, rc + 0.35, 1.7, 0.18, 'lightWarm', false, la);
      // 額（入口と入口の間の壁の内側。椅子の上）
      const pa = g0 + side + Math.PI / 2 + 0.9;
      const wr = R - WT / 2;
      I(wr - 0.03, 1.35, -0.42, wr, 1.95, 0.42, 'goldTrim', false, pa);
      I(wr - 0.042, 1.42, -0.35, wr - 0.03, 1.88, 0.35, 'skyDusk', false, pa);
    }
    ctx.addEntity('turn', {
      type: 'warpTurnRoom',
      params: {
        center: [cx, cz], radius: R, wallT: WT, floorY: y, height: wallH, segs: Math.max(48, Math.round((2 * Math.PI * R) / 0.24)),
        gaps: gaps as unknown as Json, omega: ((ctx.rng.next() < 0.5 ? -1 : 1) * 2 * Math.PI) / t['warp.turnRoom.periodSec'],
        drift: t['warp.turnRoom.drift'], calm: 0.6, items: items as unknown as Json,
        wallMat: 'woodPanel', floorMat: 'floorCarpetRed', rugMat: 'carpetPattern', trimMat: 'trim', cuts: cuts as unknown as Json,
      },
    });
    ctx.noDress?.();
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + H, r.z1] });

  },
});
