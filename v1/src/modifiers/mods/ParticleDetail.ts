/**
 * ParticleDetail — 少数のスプライトパーティクル（U07 rain 0.5 / U12 steam 0.3 / R19 steam 0.2 / L09 mist 0.5 / L19 snow 0.3）。
 * params: type('steam'|'mist'|'rain'|'snow'|'dust'), density(0..1 の強さ), respawn(無視。全 type ループ再生), size(m), color
 *
 * layout フックで L.particles にスロット（ParticleSpec）を 1 つ入れるだけ。同じ type の既存スロットは置き換え、別 type（Generator / ドレッシングが
 * 足した L09 の浴槽ごとの steam など）は残す（generators/particles.ts の replaceParticles）。RoomBuilder がスロットごとに Points
 * （頂点シェーダで移動・領域内ラップ）を作り、部屋合計の粒数を Tier の particleCap に収める。ParticleSpec.density は「1 m³ あたりの粒数」なので、
 * ここで目標粒数 / 発生領域の体積 に換算する。
 *   - rain: 天井の漏水域。最大矩形の内側から 1 か所（辺 3 + 6·density m、3〜8 m）を rng で選び、床〜天井を落下。
 *           雨域は rain スロットの aabb に残り、同じ担当の Wetness が particleList(L) から読んで床をその範囲だけ濡らす。
 *   - steam: 発生源 = 内装のソリッド箱で天板が 0.7〜1.3 m のもの（カウンター / 卓 / カップ）。rng で 1 つ選び 5 m 以内の同類をまとめた
 *            天板から +1.2 m の領域。無ければ主矩形中央の 2×2 m。粒数 20〜60。
 *   - mist: 床上 0〜0.6 m を漂う大きな柔らかい粒（size 2.2）。粒数 40〜120。
 *   - snow: 部屋全体から降下 + 横揺れ。粒数は面積 × (0.4 + 2·density)。床に 'snow' の薄い箔（シェル側）。
 *   - dust: 部屋全体、面積 × (0.3 + density)。
 */
import type { AABB } from '../../core/aabb';
import type { Rng } from '../../core/rng';
import { inner, rect, rectArea, type Rect } from '../../generators/footprint';
import { box, type Box, type ParticleSpec, type ParticleType, type RoomLayout } from '../../generators/layout';
import { replaceParticles } from '../../generators/particles';
import type { ModifierImpl } from '../types';
import { interiorBoxes, num, parseColor, str } from '../util';
import { footprintOrBounds, rectIntersect } from './ShallowWater.geom';

const TYPES: ReadonlySet<string> = new Set(['steam', 'mist', 'rain', 'snow', 'dust']);

function volumeOf(a: AABB): number {
  return Math.max(0.001, (a.max[0] - a.min[0]) * (a.max[1] - a.min[1]) * (a.max[2] - a.min[2]));
}

const ParticleDetail: ModifierImpl = {
  id: 'ParticleDetail',
  defaults: { type: 'dust', density: 0.3, respawn: true },
  layout(L, _p, params, rng) {
    const type = (TYPES.has(str(params.type, 'dust')) ? str(params.type, 'dust') : 'dust') as ParticleType;
    const density = Math.min(1, Math.max(0.05, num(params.density, 0.3)));
    const rects = footprintOrBounds(L);
    if (rects.length === 0) return;
    const h = L.height;
    const largest = rects.reduce((a, r) => (rectArea(r) > rectArea(a) ? r : a), rects[0]);
    const area = rects.reduce((a, r) => a + rectArea(r), 0);
    const b = L.bounds;
    const whole: AABB = { min: [b.min[0] + 0.3, 0.1, b.min[2] + 0.3], max: [b.max[0] - 0.3, Math.max(0.5, h - 0.1), b.max[2] - 0.3] };

    let aabb: AABB;
    let count: number;
    let size: number | undefined;
    switch (type) {
      case 'rain': {
        const side = Math.min(8, Math.max(3, 3 + 6 * density));
        const zone = inner(largest, 3.0);
        const cx = zone.x1 - zone.x0 > 0.5 ? rng.float(zone.x0, zone.x1) : (largest.x0 + largest.x1) / 2;
        const cz = zone.z1 - zone.z0 > 0.5 ? rng.float(zone.z0, zone.z1) : (largest.z0 + largest.z1) / 2;
        const r = rectIntersect(rect(cx - side / 2, cz - side / 2, cx + side / 2, cz + side / 2), inner(largest, 0.6)) ?? inner(largest, 0.6);
        aabb = { min: [r.x0, 0.05, r.z0], max: [r.x1, Math.max(0.5, h - 0.05), r.z1] };
        count = Math.round(rectArea(r) * 14 * (0.5 + density));
        break;
      }
      case 'steam': {
        const r = steamSource(L, largest, rng);
        aabb = r;
        count = Math.min(60, Math.max(20, Math.round(20 + 40 * density)));
        break;
      }
      case 'mist': {
        aabb = { min: [whole.min[0], 0.0, whole.min[2]], max: [whole.max[0], 0.6, whole.max[2]] };
        count = Math.min(120, Math.max(40, Math.round(40 + 160 * density)));
        size = 2.2;
        break;
      }
      case 'snow': {
        aabb = whole;
        count = Math.min(1500, Math.round(area * (0.4 + 2.0 * density)));
        // 床の積雪（薄い箔。シェル側に入れて shellCount を進める）
        const snow: Box[] = rects.map((r) => box([r.x0 + 0.02, 0.0, r.z0 + 0.02], [r.x1 - 0.02, 0.02, r.z1 - 0.02], 'snow', false));
        const shellCount = L.shellCount ?? L.boxes.length;
        L.boxes.splice(shellCount, 0, ...snow);
        L.shellCount = shellCount + snow.length;
        break;
      }
      default: {
        aabb = whole;
        count = Math.min(1500, Math.round(area * (0.3 + density)));
        break;
      }
    }
    if (count <= 0) return;
    const spec: ParticleSpec = { type, density: count / volumeOf(aabb), aabb };
    const sz = num(params.size, size ?? NaN);
    if (Number.isFinite(sz) && sz > 0) spec.size = sz;
    if (params.color !== undefined) spec.color = parseColor(params.color, 0xffffff);
    replaceParticles(L, type, spec);
  },
};

/** 湯気の発生源: 天板 0.7〜1.3 m のソリッド内装箱を 1 つ選び、5 m 以内の同類をまとめる。無ければ主矩形中央 2×2 m */
function steamSource(L: RoomLayout, main: Rect, rng: Rng): AABB {
  const cands = interiorBoxes(L).filter((bx) => bx.solid && bx.max[1] >= 0.7 && bx.max[1] <= 1.3 && (bx.max[0] - bx.min[0]) * (bx.max[2] - bx.min[2]) >= 0.4);
  if (cands.length === 0) {
    const cx = (main.x0 + main.x1) / 2;
    const cz = (main.z0 + main.z1) / 2;
    return { min: [cx - 1, 0.9, cz - 1], max: [cx + 1, 2.1, cz + 1] };
  }
  const seed = rng.pick(cands);
  const sc: [number, number] = [(seed.min[0] + seed.max[0]) / 2, (seed.min[2] + seed.max[2]) / 2];
  const group = cands.filter((bx) => Math.hypot((bx.min[0] + bx.max[0]) / 2 - sc[0], (bx.min[2] + bx.max[2]) / 2 - sc[1]) <= 5);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const bx of group) {
    min[0] = Math.min(min[0], bx.min[0]); min[2] = Math.min(min[2], bx.min[2]); min[1] = Math.min(min[1], bx.max[1]);
    max[0] = Math.max(max[0], bx.max[0]); max[2] = Math.max(max[2], bx.max[2]); max[1] = Math.max(max[1], bx.max[1]);
  }
  return { min: [min[0] - 0.15, min[1], min[2] - 0.15], max: [max[0] + 0.15, max[1] + 1.2, max[2] + 0.15] };
}

export default ParticleDetail;
