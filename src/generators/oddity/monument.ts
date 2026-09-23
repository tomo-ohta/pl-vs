/**
 * 奇妙さ生成: 謎の物体（モニュメント）を置く（category 'space'、主題可）。
 * 屋内: 部屋の中央（入口正面）に 1 基、高さは天井 −0.3 m。屋外系（街路・中庭・広場）: 8〜15 m の大型を 1〜3 基。
 * 種類は部屋の質感で選ぶ（事務系は officeTotem、コンクリート / 駐車場は steel・cubeCluster、大理石 / 白は stoneFrame・ribbon、店舗・遊園は colorStack）。
 * 当たり判定は基壇 + 主要部品の外接箱を kind 'colliderOnly' の箱（描かない）で L.boxes に入れる。刻印は SignAtlas の板サイン。
 */
import type { Dir } from '../../core/types';
import { buildMonument, partBounds } from '../monument/index';
import { MONUMENT_KINDS, type MonumentBuild, type MonumentKind, type MonumentOptions, type MonumentSpec } from '../monument/types';
import { WALL_T, budgetOk, canPlace, inner, isCorridor, mainRect, oddBox, pick, pushSign, type Box, type Ctx, type Oddity, type Rect, type Vec3 } from './shared';

const OUTDOOR_TEMPLATES = /Street|Plaza|Expo|Suburb|Danchi|City|Campus|Courtyard|RoadGraph|Parking/;

function isOutdoor(c: Ctx): boolean {
  const t = `${c.p.template.id} ${c.p.def.generator ?? ''} ${c.p.def.layoutHints ?? ''}`;
  return OUTDOOR_TEMPLATES.test(t) || c.h >= 7;
}

function kindFor(c: Ctx, outdoor: boolean): MonumentKind {
  const pal = c.L.palette;
  const floor = String(pal.floor), wall = String(pal.wall);
  const pool: MonumentKind[] = [];
  if (/Carpet|Office|Lino/i.test(floor) || /Beige|Cream|Wallpaper/i.test(wall)) pool.push('officeTotem', 'officeTotem', 'cubeCluster');
  if (/Concrete|Asphalt/i.test(floor) || /Concrete|Dark/i.test(wall)) pool.push('steel', 'cubeCluster', 'stoneFrame');
  if (/marble|Tile|White/i.test(floor) || /White|Tile/i.test(wall)) pool.push('stoneFrame', 'ribbon');
  if (/Wood|Retail|Lino/i.test(floor)) pool.push('colorStack');
  if (outdoor) pool.push('stoneFrame', 'ribbon', 'cubeCluster', 'steel', 'colorStack');
  return pool.length ? pick(c.rng, pool) : pick(c.rng, MONUMENT_KINDS);
}

/** ローカル → 部屋座標（yaw は π/2 の倍数 q） */
function toRoom(local: Vec3, q: number, origin: Vec3): Vec3 {
  let [x, y, z] = local;
  for (let i = 0; i < q; i++) { const nx = z, nz = -x; x = nx; z = nz; } // Y 軸まわり +90° 回転（three の makeRotationY(π/2): x' = z, z' = −x。M2 の指摘で修正）
  return [x + origin[0], y + origin[1], z + origin[2]];
}

function rotBox(b: Box, q: number, origin: Vec3): Box {
  const a = toRoom(b.min, q, origin), d = toRoom(b.max, q, origin);
  return { ...b, min: [Math.min(a[0], d[0]), Math.min(a[1], d[1]), Math.min(a[2], d[2])], max: [Math.max(a[0], d[0]), Math.max(a[1], d[1]), Math.max(a[2], d[2])] };
}

/** 1 基を置く。基壇の足跡が置けなければ false */
export function placeMonument(c: Ctx, kind: MonumentKind, center: [number, number], o: MonumentOptions, q: number): boolean {
  const rng = c.rng.fork(`monument:${kind}:${center[0].toFixed(1)}:${center[1].toFixed(1)}`);
  const build: MonumentBuild = buildMonument(kind, rng, o);
  if (!build.parts.length) return false;
  const origin: Vec3 = [center[0], 0, center[1]];
  // 当たり判定: 文法が返した箱、無ければ主要部品（体積 0.1 m³ 以上で床から 2.2 m 以下に掛かるもの）の外接箱
  const localColliders = build.colliders ?? build.parts.map(partBounds).filter((b) => {
    const v = (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
    return v >= 0.1 && b.min[1] < 2.2;
  });
  const colliders = localColliders.map((b) => rotBox(b, q, origin));
  for (const b of colliders) if (!canPlace(c, b, { margin: WALL_T + 0.2 })) return false;
  if (!budgetOk(c, colliders.length + 2)) return false;
  const spec: MonumentSpec = { id: `${kind}:${c.L.monuments?.length ?? 0}`, kind, pos: origin, yaw: (q * Math.PI) / 2, parts: build.parts };
  (c.L.monuments ??= []).push(spec);
  for (const b of colliders) c.L.boxes.push({ ...b, mat: 'void', solid: true, kind: 'colliderOnly' });
  // 真上に見えない光源（その物だけ少し明るい「展示」）
  const top = Math.min(c.h - 0.05, o.height + 0.3);
  // 展示光は小さく（1.2 m 角では近距離で白飛びして形が潰れた。M1 の指摘）
  c.L.boxes.push({ ...oddBox([origin[0] - 0.22, top - 0.04, origin[2] - 0.22], [origin[0] + 0.22, top, origin[2] + 0.22], 'lightWarm', false), kind: 'emitOnly' });
  for (const s of build.signs ?? []) {
    const pos = toRoom(s.pos, q, origin);
    const dir = ((s.face + 2 + q) % 4) as Dir; // face 0 = −Z 正面 → Dir 2（−Z）を q 回転
    pushSign(c, { text: s.text, sub: s.sub, pos, dir, width: s.width, kind: 'plate', color: s.color, background: s.background });
  }
  c.note(`monument: ${kind} h=${o.height.toFixed(1)} parts=${build.parts.length} colliders=${colliders.length}`);
  return true;
}

export const monument: Oddity = {
  id: 'space.monument', category: 'space', weight: 4, theme: true,
  applicable(c) {
    const r = mainRect(c);
    return !isCorridor(c) && Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 6 && c.h >= 2.6;
  },
  apply(c, strength) {
    const outdoor = isOutdoor(c);
    const r: Rect = inner(mainRect(c), WALL_T + 1.0);
    const kind = kindFor(c, outdoor);
    const q = c.rng.int(0, 3);
    const n = outdoor && strength === 'strong' ? c.rng.int(1, 3) : 1;
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const height = outdoor ? c.rng.float(6, Math.min(15, c.h - 0.3)) : Math.max(1.8, c.h - 0.3 - c.rng.float(0, 0.4));
      // 足跡の半径: 屋内は高さの 0.45 倍（steel の脚の広がりが 0.38 では収まらない。M1 の指摘）、部屋の短辺の 1/3 を超えない
      // 足跡の半径: 部屋の短辺の 1/2.4 まで使い、高さの 0.6 倍を目安に（広がりのある形にする。増幅の持ち出しはこの 1.2〜2 倍まで伸びる）
      const radius = Math.min(4.5, Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2.4, Math.max(1.2, height * (outdoor ? 0.4 : 0.6)));
      const o: MonumentOptions = { height, radius, outdoor, distort: strength === 'strong' ? c.rng.float(0.35, 0.8) : c.rng.float(0.1, 0.4) };
      // 位置: 1 基目は正面（focus）の中央、以降は主矩形の中でランダム
      let ok = false;
      for (let t = 0; t < 12 && !ok; t++) {
        const f = i === 0 && t < 6 ? c.focus : r;
        const cx = t === 0 ? (f.x0 + f.x1) / 2 : c.rng.float(f.x0 + radius, Math.max(f.x0 + radius, f.x1 - radius));
        const cz = t === 0 ? (f.z0 + f.z1) / 2 : c.rng.float(f.z0 + radius, Math.max(f.z0 + radius, f.z1 - radius));
        ok = placeMonument(c, i === 0 ? kind : kindFor(c, outdoor), [cx, cz], o, (q + i) % 4);
      }
      if (ok) placed++;
    }
    return placed > 0;
  },
};
