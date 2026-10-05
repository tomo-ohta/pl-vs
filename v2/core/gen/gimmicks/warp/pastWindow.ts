/**
 * 窓の向こうの自分（pastWindow: W08・BX08。v1 PastWindow の発展）。部品は warpPastWindow（delay 秒前の自分）。
 *
 * 遊び方: 部屋の壁に大きな窓。向こうには、この部屋とそっくりの部屋が見え、少し前の自分がそこを歩いている（窓に近づけば、向こうの自分も
 * 遅れて向こうの窓へ近づき、こちらに背を向けて立つ）。窓の向こうは「この部屋を向かいの壁の外から見た所」（client/views/warp/past.ts）。
 * BX08: 窓の前でじっと 18 秒立っていると、向こうの自分は真似をやめて振り返り、部屋の別の壁へ歩いて 3 回叩く。
 * 本当の部屋のその壁から音がし、隠しの扉が現れる（出現型）。
 * 閉じ込めない: 窓は壁の中の絵（通れない）。部屋の開口はそのまま。
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { freeWallSpan, innerRect } from '../util.ts';
import { canPocket, isBSide, makeFrame } from './pocket.ts';

const WW = 2.0, WH = 1.2, SILL = 0.9;

defineGimmick({
  id: 'pastWindow', name: '窓の向こうの自分', axes: ['sight', 'time'], kinds: ['room'], minSize: [4.4, 4.8], minHeight: 2.4, weight: WARP_TUNING['warp.pastWindow.weight'].default, intensity: 1,
  offersSecret: true, onMainPath: true,
  fits: (s) => s.cell.footprint.length === 1 && !!s.entrance,
  build(ctx) {
    if (!canPocket(ctx) || isBSide(ctx)) return;
    const s = ctx.slot;
    const r = innerRect(s);
    const y = s.cell.floorY;
    const ent = s.entrance!;
    // 窓の壁: 入口の向かい（無ければ横）の、開口の無い 2.8 m 以上の所
    const order: Dir[] = [((ent.dir + 2) % 4) as Dir, ((ent.dir + 1) % 4) as Dir, ((ent.dir + 3) % 4) as Dir];
    let wd: Dir | null = null, at = 0;
    for (const d of order) { const sp = freeWallSpan(s, d, WW + 0.8, 0.9); if (sp) { wd = d; at = sp.at; break; } }
    if (wd === null) return;
    // 窓の局所の座標: 原点は窓の壁の内面の窓の真ん中、u = 部屋の中へ・v = 左
    const wallC = wd === 0 ? r.z1 : wd === 2 ? r.z0 : wd === 1 ? r.x1 : r.x0;
    const o: Vec3 = wd === 0 || wd === 2 ? [at, y, wallC] : [wallC, y, at];
    const f = makeFrame(o, ((wd + 2) % 4) as Dir);
    const depth = wd === 0 || wd === 2 ? r.z1 - r.z0 : r.x1 - r.x0;
    // 窓枠・窓台（部屋の中へ 4 cm）
    const T = 0.06;
    ctx.addBox(f.box(0, SILL - T, -WW / 2 - T, 0.04, SILL, WW / 2 + T, 'trim', false));
    ctx.addBox(f.box(0, SILL + WH, -WW / 2 - T, 0.04, SILL + WH + T, WW / 2 + T, 'trim', false));
    ctx.addBox(f.box(0, SILL, -WW / 2 - T, 0.04, SILL + WH, -WW / 2, 'trim', false));
    ctx.addBox(f.box(0, SILL, WW / 2, 0.04, SILL + WH, WW / 2 + T, 'trim', false));
    ctx.addBox(f.box(0, SILL - T - 0.03, -WW / 2 - 0.12, 0.16, SILL - T, WW / 2 + 0.12, 'woodPanel', true));
    const keep = f.aabb(0, -0.1, -WW / 2 - 0.4, 1.6, 3, WW / 2 + 0.4);
    ctx.keepOut({ min: [...keep.min], max: [...keep.max] });
    // 窓の前（立つ所）と部屋の中
    const stand = f.aabb(0.2, -0.3, -WW / 2, 1.6, 2.5, WW / 2);
    const room = { min: [r.x0, y - 0.3, r.z0], max: [r.x1, y + 2.5, r.z1] };
    // BX08 の隠し: 窓の壁と入口の壁でない壁（無ければ入口の壁）の空いた所
    const pid = `${ctx.id}.past`;
    let spot: number[] | null = null;
    for (const d of [((wd + 1) % 4) as Dir, ((wd + 3) % 4) as Dir, ((wd + 2) % 4) as Dir]) {
      const sp = freeWallSpan(s, d, 1.0 + 1.2, 0.9);
      if (!sp) continue;
      const wc = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
      const inn = d === 0 || d === 1 ? -0.6 : 0.6;
      const p: Vec3 = d === 0 || d === 2 ? [sp.at, y, wc + inn] : [wc + inn, y, sp.at];
      // 壁を向く向き（yaw: 視線 (-sin, -cos)）
      const fv = d === 0 ? [0, 1] : d === 2 ? [0, -1] : d === 1 ? [1, 0] : [-1, 0];
      spot = [p[0], p[1], p[2], Math.atan2(-fv[0]!, -fv[1]!)];
      ctx.offerSecret({ hook: 'past.knock', modes: ['appear'], weight: ctx.tuning['warp.pastWindow.secretWeight'], revealOutput: `${pid}.reveal`, doorway: { dir: d, at: sp.at, y, width: 1.0, height: 2.0 }, tell: '窓の前でじっとしていると、向こうの自分が叩く壁' });
      break;
    }
    ctx.addEntity('past', {
      type: 'warpPastWindow',
      params: {
        room: room as unknown as Json, stand: { min: [...stand.min], max: [...stand.max] }, delay: ctx.tuning['warp.pastWindow.delaySec'], every: 6,
        stillSec: ctx.tuning['warp.pastWindow.stillSec'], ...(spot ? { spot } : {}),
        // 描画: 窓の板（真ん中・向き・大きさ）と、窓の向こうの部屋（この部屋を、向かいの壁の外から見る写し方）
        window: { center: f.p(0, SILL + WH / 2, 0), dir: f.dir(0), w: WW, h: WH, depth },
      },
    });
  },
});
