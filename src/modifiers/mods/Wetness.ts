/**
 * Wetness — 濡れた床（U07 0.6 / U08 0.8 / U13 0.4 / L09 0.7）。
 * params: wetness(0..1), puddles(boolean), wallBand(boolean)
 *
 * layout フック（決定論）:
 *   - L.render.wetness = w。RoomBuilder が MaterialLibrary.wetnessOverrides（roughness ↓ / 色 ↓ / envMap ↑。uniform 差のみ）を全材質に掛ける。
 *   - 水たまり: 床上 0.004 m の 'water' 箔を decals に（面積/25 個、上限 40。ソケット・家具の足元を避ける）。Tier の decals=false なら RoomBuilder が省く。
 *   - 壁の濡れ跡: 外壁の内面 y 0〜(0.15+0.15w) の 'wallDark' 帯を decals に（開口は除く）。
 *   - 雨域連動（U07）: 同じ担当の ParticleDetail(rain) が L.particles.aabb に出した雨域があれば、その AABB 内だけを濡らす:
 *     部屋全体の render.wetness は付けず、雨域の床に 'water' の水溜まり箔（箱。Tier に依らず出す）と、雨域 + 1.5 m の範囲に水たまり decals。
 *     rooms.json の順序が ParticleDetail → Wetness なので雨域を読める（逆順なら雨域なしとして部屋全体を濡らす）。
 * 足音の wet 判定は Game.enterRoom が render.wetness / hasModifier で行う（既存配線）。
 */
import type { Socket } from '../../core/types';
import type { Rng } from '../../core/rng';
import { clearOfSockets, inFootprint, inner, rect, type Rect } from '../../generators/footprint';
import { box, WALL_T, type Box, type DecalSpec, type RoomLayout } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { bool, num } from '../util';
import { footprintOrBounds, insideInteriorSolid, rectArea2, rectIntersect, rectOfAabb, wallBandSegments, type WallBandSegment } from './ShallowWater.geom';

const PUDDLE_MAX = 40;

const Wetness: ModifierImpl = {
  id: 'Wetness',
  defaults: { wetness: 0.6, puddles: true, wallBand: true },
  layout(L, _p, params, rng) {
    const w = Math.min(1, Math.max(0, num(params.wetness, 0.6)));
    if (w <= 0) return;
    const rects = footprintOrBounds(L);
    const sockets = L.sockets;
    const decals: DecalSpec[] = [];
    const rain = L.particles?.type === 'rain' && L.particles.aabb ? rectOfAabb(L.particles.aabb) : null;

    if (rain) {
      // 雨域だけ濡らす: 漏水の真下に水溜まりの箔（常に出す）+ 周囲に水たまり
      const home = rects.find((r) => rain.x0 < r.x1 && rain.x1 > r.x0 && rain.z0 < r.z1 && rain.z1 > r.z0) ?? rects[0];
      const pool = rectIntersect(rect(rain.x0 + 0.3, rain.z0 + 0.3, rain.x1 - 0.3, rain.z1 - 0.3), inner(home, WALL_T + 0.1));
      if (pool) {
        const poolBox: Box = box([pool.x0, 0.004, pool.z0], [pool.x1, 0.012, pool.z1], 'water', false);
        L.boxes.push(poolBox);
      }
      if (bool(params.puddles, true)) {
        const region = rect(rain.x0 - 1.5, rain.z0 - 1.5, rain.x1 + 1.5, rain.z1 + 1.5);
        const count = Math.min(PUDDLE_MAX, Math.max(4, Math.round((rectArea2(region) / 6) * (0.5 + w))));
        decals.push(...puddles(L, [region], rects, sockets, count, rng, pool));
      }
    } else {
      L.render = { ...(L.render ?? {}), wetness: Math.max(L.render?.wetness ?? 0, w) };
      if (bool(params.puddles, true)) {
        const area = rects.reduce((a, r) => a + rectArea2(r), 0);
        const count = Math.min(PUDDLE_MAX, Math.max(3, Math.round((area / 25) * (0.6 + 0.6 * w))));
        decals.push(...puddles(L, rects, rects, sockets, count, rng, null));
      }
      if (bool(params.wallBand, true)) {
        const h = 0.15 + 0.15 * w;
        for (const seg of wallBandSegments(rects, sockets, 0.15)) decals.push(bandDecal(seg, h));
      }
    }
    if (decals.length) L.decals = [...(L.decals ?? []), ...decals];
  },
};

/** 水たまり decals。regions のどれかに一様に置き、足跡の内側・ソケット/家具から離れた位置だけ採用する */
function puddles(L: RoomLayout, regions: Rect[], rects: Rect[], sockets: Socket[], count: number, rng: Rng, avoid: Rect | null): DecalSpec[] {
  const out: DecalSpec[] = [];
  const weights = regions.map((r) => Math.max(0.01, rectArea2(r)));
  // 細い廊下では有効な位置が少ないので試行回数を多めに取る（採用数は count 以下）
  for (let i = 0; i < count * 10 && out.length < count; i++) {
    const r = rng.weighted(regions, (_r) => weights[regions.indexOf(_r)]);
    const x = rng.float(r.x0, r.x1);
    const z = rng.float(r.z0, r.z1);
    const sx = rng.float(0.5, 1.7);
    const sz = rng.float(0.4, 1.3);
    const yaw = rng.float(0, Math.PI);
    if (!inFootprint(rects, x, z, WALL_T + 0.45)) continue;
    if (!clearOfSockets(sockets, x, z, 1.1)) continue;
    if (insideInteriorSolid(L, x, z, 0.2)) continue;
    if (avoid && x > avoid.x0 - 0.2 && x < avoid.x1 + 0.2 && z > avoid.z0 - 0.2 && z < avoid.z1 + 0.2) continue;
    // 床穴の上には置かない
    if (L.holes.some((h) => x > h.min[0] - 0.8 && x < h.max[0] + 0.8 && z > h.min[2] - 0.8 && z < h.max[2] + 0.8)) continue;
    out.push({ mat: 'water', pos: [x, 0.004, z], size: [sx, sz], normal: 'y', yaw });
  }
  return out;
}

/** 壁の内面に貼る濡れ跡の帯（decal）。normal 'x' は pos.x〜pos.x+t、'z' は pos.z〜pos.z+t に描かれる（RoomBuilder.decalBox） */
function bandDecal(seg: WallBandSegment, h: number): DecalSpec {
  const t = 0.004;
  const gap = 0.002;
  const innerFace = seg.dir === 0 || seg.dir === 1 ? seg.coord - WALL_T : seg.coord + WALL_T;
  const lo = seg.dir === 0 || seg.dir === 1 ? innerFace - gap - t : innerFace + gap;
  const len = seg.a1 - seg.a0;
  const mid = (seg.a0 + seg.a1) / 2;
  if (seg.dir === 0 || seg.dir === 2) return { mat: 'wallDark', pos: [mid, h / 2, lo], size: [len, h], normal: 'z' };
  return { mat: 'wallDark', pos: [lo, h / 2, mid], size: [len, h], normal: 'x' };
}

export default Wetness;
