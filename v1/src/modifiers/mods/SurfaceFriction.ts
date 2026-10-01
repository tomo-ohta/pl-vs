/**
 * SurfaceFriction — 滑る床（C11 体育館更衣室 0.6 / U08 湿ったホテル廊下 0.5 / L19 凍結リゾート 0.2）。
 * params: friction(0..1。小さいほど滑る), zone('all' | 'ice')。
 *
 * layout フックで L.zones に kind 'friction' の AABB を置くだけ（PlayerController が加減速を ×friction² にする。17.5 節: ペナルティ無し）。
 *   - zone 'all'（既定。C11 / U08）: 部屋全体（bounds）を 1 ゾーンにする。データに zone 指定が無いため全室適用。
 *   - zone 'ice'（L19 は既定で ice）: 'ice' MatId の床帯にだけゾーンを置く。
 *       既にレイアウトに 'ice' の箱があればそれを使う（将来の MegaStructureGenerator 本実装向け）。
 *       無ければ（現状の LargeRoom 代替）自分で氷面を作る: 主矩形の中央に凍結プール（リンク）、各扉口からリンクへ向かう
 *       氷の帯（幅 2.4 m。壁からリンクの縁まで。リンクが無い / 帯が届かなければ矩形の反対側の壁まで）。
 *       氷は床上 0〜0.03 m の非ソリッド箔（ParticleDetail の 'snow' 箔 0.02 m より上に出る）。ジオメトリはここで確定する。
 * ランタイム処理・保存状態は無い。Tier 差も無い。
 */
import type { AABB } from '../../core/aabb';
import type { Socket } from '../../core/types';
import { inner, type Rect } from '../../generators/footprint';
import { box, WALL_T, type Box, type RoomLayout, type Zone } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { num, str } from '../util';

/** 氷帯の幅（m） */
const BAND_W = 2.4;
/** 氷箔の厚さ（m）。ParticleDetail の snow 箔（0.02）より上 */
const ICE_TOP = 0.03;
/** リンクにする矩形の最小寸法（m） */
const RINK_MIN = 8;
/** ゾーンの高さ方向（足元判定は pos.y + 0.1） */
const ZONE_Y0 = -0.3;
const ZONE_Y1 = 1.2;

function frictionZone(aabb: AABB, friction: number): Zone {
  return { kind: 'friction', aabb, params: { friction } };
}

function zoneOverBox(b: Box, friction: number): Zone {
  return frictionZone({ min: [b.min[0], b.min[1] + ZONE_Y0, b.min[2]], max: [b.max[0], b.max[1] + ZONE_Y1, b.max[2]] }, friction);
}

function overlapsXZ(a: Box, b: Box, eps = 0.05): boolean {
  return a.min[0] < b.max[0] - eps && a.max[0] > b.min[0] + eps && a.min[2] < b.max[2] - eps && a.max[2] > b.min[2] + eps;
}

function rectOf(rects: Rect[], x: number, z: number): Rect | undefined {
  return rects.find((r) => x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && z >= r.z0 - 0.05 && z <= r.z1 + 0.05);
}

/** 中央リンク: 主矩形の内側を 15%（最低 2 m）縮めた矩形。矩形が小さければ無し */
function rinkOf(main: Rect): Rect | null {
  const w = main.x1 - main.x0;
  const d = main.z1 - main.z0;
  if (w < RINK_MIN || d < RINK_MIN) return null;
  const mx = Math.max(2, w * 0.15);
  const mz = Math.max(2, d * 0.15);
  return { x0: main.x0 + mx, z0: main.z0 + mz, x1: main.x1 - mx, z1: main.z1 - mz };
}

/** 扉口から部屋の内側へ向かう氷の帯。rink の縁で止める（届かなければ矩形の反対側の壁まで） */
function bandFromSocket(s: Socket, r: Rect, rink: Rect | null): Box | null {
  const ir = inner(r, WALL_T);
  const half = BAND_W / 2;
  // dir は外向き。内向きへ帯を伸ばす
  if (s.dir === 0 || s.dir === 2) {
    const x0 = Math.max(ir.x0, s.pos[0] - half);
    const x1 = Math.min(ir.x1, s.pos[0] + half);
    if (x1 - x0 < 0.8) return null;
    let z0: number, z1: number;
    if (s.dir === 2) {
      // 壁は z0 側。+Z へ伸ばす
      z0 = ir.z0;
      z1 = ir.z1;
      if (rink && x1 > rink.x0 && x0 < rink.x1 && rink.z0 > z0 + 0.5) z1 = rink.z0;
    } else {
      z1 = ir.z1;
      z0 = ir.z0;
      if (rink && x1 > rink.x0 && x0 < rink.x1 && rink.z1 < z1 - 0.5) z0 = rink.z1;
    }
    if (z1 - z0 < 0.8) return null;
    return box([x0, 0, z0], [x1, ICE_TOP, z1], 'ice', false);
  }
  const z0 = Math.max(ir.z0, s.pos[2] - half);
  const z1 = Math.min(ir.z1, s.pos[2] + half);
  if (z1 - z0 < 0.8) return null;
  let x0: number, x1: number;
  if (s.dir === 3) {
    x0 = ir.x0;
    x1 = ir.x1;
    if (rink && z1 > rink.z0 && z0 < rink.z1 && rink.x0 > x0 + 0.5) x1 = rink.x0;
  } else {
    x1 = ir.x1;
    x0 = ir.x0;
    if (rink && z1 > rink.z0 && z0 < rink.z1 && rink.x1 < x1 - 0.5) x0 = rink.x1;
  }
  if (x1 - x0 < 0.8) return null;
  return box([x0, 0, z0], [x1, ICE_TOP, z1], 'ice', false);
}

/** 矩形の集合から床穴（+ 余白 0.3 m）を引く（穴ごとに最大 4 分割） */
function subtractHoles(rects: Rect[], holes: AABB[]): Rect[] {
  let cur = rects;
  for (const h of holes) {
    const hx0 = h.min[0] - 0.3, hx1 = h.max[0] + 0.3, hz0 = h.min[2] - 0.3, hz1 = h.max[2] + 0.3;
    const next: Rect[] = [];
    for (const r of cur) {
      if (hx1 <= r.x0 || hx0 >= r.x1 || hz1 <= r.z0 || hz0 >= r.z1) { next.push(r); continue; }
      if (hz0 > r.z0) next.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: hz0 });
      if (hz1 < r.z1) next.push({ x0: r.x0, z0: hz1, x1: r.x1, z1: r.z1 });
      const z0 = Math.max(r.z0, hz0), z1 = Math.min(r.z1, hz1);
      if (hx0 > r.x0) next.push({ x0: r.x0, z0, x1: hx0, z1 });
      if (hx1 < r.x1) next.push({ x0: hx1, z0, x1: r.x1, z1 });
    }
    cur = next;
  }
  return cur;
}

/** 氷面を生成して L.boxes に足す（既存の 'ice' 箱が無いときだけ呼ぶ）。戻り値は追加した箱 */
function makeIce(L: RoomLayout): Box[] {
  const rects = L.footprint;
  if (!rects.length) return [];
  const main = rects[0];
  const rink = rinkOf(main);
  const out: Box[] = [];
  // リンクは床穴を避けて分割する（穴の周囲 0.3 m を空ける）
  if (rink) for (const r of subtractHoles([rink], L.holes)) if (r.x1 - r.x0 > 1 && r.z1 - r.z0 > 1) out.push(box([r.x0, 0, r.z0], [r.x1, ICE_TOP, r.z1], 'ice', false));
  for (const s of L.sockets) {
    if (s.type === 'hole' || (s.sill ?? 0) > 0) continue;
    const r = rectOf(rects, s.pos[0], s.pos[2]);
    if (!r) continue;
    const band = bandFromSocket(s, r, r === main ? rink : null);
    if (!band) continue;
    // 既存の氷（リンク / 他の帯）と重なる部分が大きければ置かない（同一材質の重なりによるちらつき防止）
    if (out.some((o) => overlapsXZ(o, band, 0.6))) continue;
    // 床穴の上には置かない
    if (L.holes.some((h) => band.min[0] < h.max[0] + 0.3 && band.max[0] > h.min[0] - 0.3 && band.min[2] < h.max[2] + 0.3 && band.max[2] > h.min[2] - 0.3)) continue;
    out.push(band);
  }
  L.boxes.push(...out);
  return out;
}

const SurfaceFriction: ModifierImpl = {
  id: 'SurfaceFriction',
  // zone は defaults に置かない（L19 の既定 'ice' を部屋 ID で決めるため。params.zone があればそれが優先）
  defaults: { friction: 0.35 },
  layout(L, p, params) {
    const friction = Math.min(1, Math.max(0.05, num(params.friction, 0.35)));
    const zone = str(params.zone, p.def.id === 'L19' ? 'ice' : 'all');
    L.zones ??= [];
    if (zone === 'ice') {
      let ice = L.boxes.filter((b) => b.mat === 'ice');
      if (ice.length === 0) ice = makeIce(L);
      if (ice.length > 0) {
        for (const b of ice) L.zones.push(zoneOverBox(b, friction));
        return;
      }
      // 氷面が作れない（極小の足跡）: 全室適用へフォールバック
    }
    const b = L.bounds;
    L.zones.push(frictionZone({ min: [b.min[0], ZONE_Y0, b.min[2]], max: [b.max[0], L.height + 0.5, b.max[2]] }, friction));
  },
};

export default SurfaceFriction;
