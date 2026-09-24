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
import { hitsZone, insideRects } from '../furniture';

const OUTDOOR_TEMPLATES = /Street|Plaza|Expo|Suburb|Danchi|City|Campus|Courtyard|RoadGraph|Parking/;

function isOutdoor(c: Ctx): boolean {
  const t = `${c.p.template.id} ${c.p.def.generator ?? ''} ${c.p.def.layoutHints ?? ''}`;
  return OUTDOOR_TEMPLATES.test(t) || c.h >= 7;
}

/** 開発用: `?monument=<kind>` で抽選する種類を固定（撮影・確認用） */
const FORCED_KIND: MonumentKind | null = (() => {
  if (typeof location === 'undefined') return null;
  const k = new URLSearchParams(location.search).get('monument');
  return k && (MONUMENT_KINDS as readonly string[]).includes(k) ? (k as MonumentKind) : null;
})();

function kindFor(c: Ctx, outdoor: boolean): MonumentKind {
  if (FORCED_KIND) return FORCED_KIND;
  const pal = c.L.palette;
  const floor = String(pal.floor), wall = String(pal.wall);
  const pool: MonumentKind[] = [];
  if (/Carpet|Office|Lino/i.test(floor) || /Beige|Cream|Wallpaper/i.test(wall)) pool.push('officeTotem', 'officeTotem', 'cubeCluster', 'chairTower', 'doorRing');
  if (/Concrete|Asphalt/i.test(floor) || /Concrete|Dark/i.test(wall)) pool.push('steel', 'cubeCluster', 'stoneFrame', 'monolith', 'lampGrove');
  if (/marble|Tile|White/i.test(floor) || /White|Tile/i.test(wall)) pool.push('stoneFrame', 'ribbon', 'monolith', 'doorRing');
  if (/Wood|Retail|Lino/i.test(floor)) pool.push('colorStack', 'chairTower', 'doorRing');
  if (outdoor) pool.push('stoneFrame', 'ribbon', 'cubeCluster', 'steel', 'colorStack', 'monolith', 'lampGrove', 'doorRing');
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

/** 動く床・水・乗り物の帯（L.zones）と、シェル側のソリッド（柱など。canPlace は内装しか見ない）に掛かるか */
/** ゾーンに掛かるか（inWater: 水・滑る床の上には置いてよい = 巨大モニュメントが湯船・水盤に立つ） */
function blockedByZones(c: Ctx, b: Box, inWater = false): boolean {
  return (c.L.zones ?? []).some((z) => z.kind !== 'theme' && !(inWater && (z.kind === 'water' || z.kind === 'friction')) && z.aabb.min[0] < b.max[0] && z.aabb.max[0] > b.min[0] && z.aabb.min[2] < b.max[2] && z.aabb.max[2] > b.min[2]);
}

function blockedBeyondInterior(c: Ctx, b: Box, inWater = false): boolean {
  const over = (a: { min: readonly number[]; max: readonly number[] }) => a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[2] < b.max[2] && a.max[2] > b.min[2];
  if (blockedByZones(c, b, inWater)) return true;
  for (let i = 0; i < c.start; i++) {
    const q = c.L.boxes[i];
    if (q.solid && q.max[1] > 0.05 && q.min[1] < c.h - 0.3 && over(q) && q.min[1] < b.max[1]) return true;
  }
  return false;
}

/**
 * 足跡（XZ の外接矩形 + pad）に掛かる家具と柱を取り除いて広場にする（巨大モニュメント用）。壁・床・天井・扉まわりは残す。
 * 柱 = 水平 4 m 以内・高さ 2 m 以上のソリッド（シェル側も含む。シェルから抜いた数だけ shellCount を減らす）
 */
function clearPlaza(c: Ctx, x0: number, z0: number, x1: number, z1: number): number {
  const L = c.L;
  const shell = L.shellCount ?? 0;
  const keep: Box[] = [];
  let removedShell = 0, removed = 0;
  L.boxes.forEach((b, i) => {
    const over = b.min[0] < x1 && b.max[0] > x0 && b.min[2] < z1 && b.max[2] > z0;
    const floorOrCeil = b.max[1] <= 0.08 || b.min[1] >= c.h - 0.6;
    const column = b.solid && b.max[0] - b.min[0] <= 4 && b.max[2] - b.min[2] <= 4 && b.max[1] - b.min[1] >= 2;
    const furniture = i >= shell && b.min[1] < 3 && !b.kind?.startsWith('door');
    if (over && !floorOrCeil && (column || furniture) && insideRects(c.rects, b, WALL_T + 0.5)) {
      removed++;
      if (i < shell) removedShell++;
      return;
    }
    keep.push(b);
  });
  L.boxes = keep;
  if (removedShell) L.shellCount = shell - removedShell;
  return removed;
}

/** 1 基を置く。基壇の足跡が置けなければ false。giant: 動線（入口 → 出口の直線）に掛かってもよく、足跡の家具と柱は取り除く */
export function placeMonument(c: Ctx, kind: MonumentKind, center: [number, number], o: MonumentOptions, q: number, giant = false): boolean {
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
  if (giant) {
    // 足跡が部屋に収まり、扉前・ゾーンに掛からないことを先に確かめてから、広場を空ける
    for (const b of colliders) if (!insideRects(c.rects, b, WALL_T + 0.5) || hitsZone(c.zones, b) || blockedByZones(c, b, true)) return false;
    const ux0 = Math.min(...colliders.map((b) => b.min[0])) - 1.2, uz0 = Math.min(...colliders.map((b) => b.min[2])) - 1.2;
    const ux1 = Math.max(...colliders.map((b) => b.max[0])) + 1.2, uz1 = Math.max(...colliders.map((b) => b.max[2])) + 1.2;
    const n = clearPlaza(c, ux0, uz0, ux1, uz1);
    if (n) c.note(`giant plaza: removed ${n} boxes`);
  }
  for (const b of colliders) if (!canPlace(c, b, { margin: WALL_T + 0.2, lanes: !giant }) || blockedBeyondInterior(c, b, giant)) return false;
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
  id: 'space.monument', category: 'space', weight: 7, theme: true,
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
      // 屋外系は仕上げ（fitEnvelope）で高さの 1.12 倍まで伸びるので、天井 −0.3 を 1.12 で割った値まで
      const height = outdoor ? Math.min(c.rng.float(6, 15), (c.h - 0.3) / 1.12) : Math.max(1.8, c.h - 0.3 - c.rng.float(0, 0.4));
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

// ---------------------------------------------------------------- 空き地・巨大モニュメント（第17回）

/** 空き地の正方形（中心と一辺 m） */
interface OpenSquare { cx: number; cz: number; side: number }

/**
 * 1 m 格子で「何も置かれていない床」を求め、大きい順に正方形を返す（重ならない）。塞ぐもの: 箱（床の薄板・天井より上は除く）、
 * 反復配置（インスタンス）、ゾーン（水・動く床・乗り物）、扉前、入口 → 出口の動線、床穴、足跡の縁 1 m
 */
export function openSquares(c: Ctx, minSide: number, max = 3): OpenSquare[] {
  const cell = 1;
  const bx0 = Math.min(...c.rects.map((r) => r.x0)), bz0 = Math.min(...c.rects.map((r) => r.z0));
  const bx1 = Math.max(...c.rects.map((r) => r.x1)), bz1 = Math.max(...c.rects.map((r) => r.z1));
  const W = Math.max(1, Math.floor((bx1 - bx0) / cell)), Hn = Math.max(1, Math.floor((bz1 - bz0) / cell));
  if (W * Hn > 250000) return [];
  const free = new Uint8Array(W * Hn);
  const pad = WALL_T + 1.0;
  for (let j = 0; j < Hn; j++) for (let i = 0; i < W; i++) {
    const x = bx0 + (i + 0.5) * cell, z = bz0 + (j + 0.5) * cell;
    free[j * W + i] = c.rects.some((r) => x > r.x0 + pad && x < r.x1 - pad && z > r.z0 + pad && z < r.z1 - pad) ? 1 : 0;
  }
  const block = (x0: number, z0: number, x1: number, z1: number, m: number) => {
    const i0 = Math.max(0, Math.floor((x0 - m - bx0) / cell)), i1 = Math.min(W - 1, Math.floor((x1 + m - bx0) / cell));
    const j0 = Math.max(0, Math.floor((z0 - m - bz0) / cell)), j1 = Math.min(Hn - 1, Math.floor((z1 + m - bz0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) free[j * W + i] = 0;
  };
  for (const b of c.L.boxes) {
    if (b.max[1] <= 0.08 || b.min[1] >= Math.min(2.6, c.h - 0.2)) continue; // 床の薄板・天井から吊る物は妨げない
    block(b.min[0], b.min[2], b.max[0], b.max[2], 0.6);
  }
  for (const sp of c.L.instances ?? []) {
    const hr = Math.max(sp.size[0], sp.size[2]) / 2;
    for (const t of sp.transforms) { const r = hr * (t.scale ?? 1); block(t.pos[0] - r, t.pos[2] - r, t.pos[0] + r, t.pos[2] + r, 0.5); }
  }
  for (const z of c.L.zones ?? []) if (z.kind !== 'theme') block(z.aabb.min[0], z.aabb.min[2], z.aabb.max[0], z.aabb.max[2], 0.8);
  for (const z of c.zones) block(z.min[0], z.min[2], z.max[0], z.max[2], 1.0);
  for (const h of c.L.holes) block(h.min[0], h.min[2], h.max[0], h.max[2], 1.0);
  for (const l of c.lanes) {
    const n = Math.ceil(Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) / 0.5);
    for (let k = 0; k <= n; k++) { const t = k / Math.max(1, n); const x = l.a[0] + (l.b[0] - l.a[0]) * t, z = l.a[1] + (l.b[1] - l.a[1]) * t; block(x, z, x, z, 1.4); }
  }
  const out: OpenSquare[] = [];
  const need = Math.ceil(minSide / cell);
  for (let round = 0; round < max; round++) {
    // 最大の空き正方形（動的計画法: dp = 右下隅で終わる正方形の一辺）
    const dp = new Uint16Array(W * Hn);
    let best = 0, bi = 0, bj = 0;
    for (let j = 0; j < Hn; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (!free[k]) continue;
      const v = i === 0 || j === 0 ? 1 : 1 + Math.min(dp[k - 1], dp[k - W], dp[k - W - 1]);
      dp[k] = v;
      if (v > best) { best = v; bi = i; bj = j; }
    }
    if (best < need) break;
    const x1 = bx0 + (bi + 1) * cell, z1 = bz0 + (bj + 1) * cell;
    out.push({ cx: x1 - (best * cell) / 2, cz: z1 - (best * cell) / 2, side: best * cell });
    block(x1 - best * cell, z1 - best * cell, x1, z1, 2);
  }
  return out;
}

/** 希少度ごとの空き地モニュメントの確率と最大数 */
const OPEN_SPACE: Record<string, { chance: number; max: number }> = {
  Common: { chance: 0.45, max: 1 }, Uncommon: { chance: 0.5, max: 1 }, Rare: { chance: 0.55, max: 2 },
  Epic: { chance: 0.6, max: 2 }, Legendary: { chance: 0.75, max: 3 }, Mythic: { chance: 0.3, max: 1 },
};

/**
 * 広く空いた床（一辺 7 m 以上の正方形）にモニュメントを置く（主題・添え物の抽選とは別枠。applyOddity の最後）。
 * 大きさは空き地に合わせる（半径 = 一辺の 0.36 倍、4.5 m まで。高さは天井 −0.3、屋外系は 6〜15 m）
 */
export function fillOpenSpace(c: Ctx): number {
  const rule = OPEN_SPACE[c.p.def.rarity] ?? OPEN_SPACE.Common;
  if (isCorridor(c) || c.h < 2.6 || (c.L.monuments ?? []).filter((m) => m.kind !== 'clutter').length >= 3) return 0;
  const rng = c.rng.fork('open-monument');
  if (!rng.chance(rule.chance)) return 0;
  const outdoor = isOutdoor(c);
  const squares = openSquares(c, 7, rule.max);
  let placed = 0;
  for (const [i, sq] of squares.entries()) {
    if (i > 0 && sq.side < 9) break; // 2 基目以降はさらに広い所だけ
    const radius = Math.min(4.5, sq.side * 0.36);
    const height = outdoor ? Math.min(rng.float(6, 15), (c.h - 0.3) / 1.12) : Math.max(1.8, Math.min(c.h - 0.3 - rng.float(0, 0.4), radius * 3.2));
    const o: MonumentOptions = { height, radius, outdoor, distort: rng.float(0.25, 0.7) };
    const kind = kindFor({ ...c, rng } as Ctx, outdoor);
    if (placeMonument(c, kind, [sq.cx, sq.cz], o, rng.int(0, 3))) placed++;
  }
  if (placed) c.note(`open-space monuments: ${placed} (squares ${squares.map((q) => q.side).join(',')})`);
  return placed;
}

/**
 * 広い部屋の中央に巨大モニュメント（colossus）を 1 基。Legendary は主矩形の短辺 16 m 以上・天井 6 m 以上なら必ず、
 * それ以外（Mythic を除く）は短辺 30 m 以上・天井 8 m 以上で 5 割。中央が動線に掛かれば半径の半分ずつずらし、それでも駄目なら縮める。
 * 周りに展示光（見えない面光源）を 4 灯足す
 */
export function placeGiantMonument(c: Ctx): boolean {
  const r = mainRect(c);
  const short = Math.min(r.x1 - r.x0, r.z1 - r.z0);
  const rarity = c.p.def.rarity;
  const rng = c.rng.fork('giant-monument');
  const eligible = rarity === 'Legendary' ? short >= 16 && c.h >= 6 : rarity !== 'Mythic' && short >= 30 && c.h >= 8 && rng.chance(0.5);
  if (!eligible || isCorridor(c)) return false;
  const height = Math.min((c.h - 0.6) / 1.12, 30);
  const cx0 = (r.x0 + r.x1) / 2, cz0 = (r.z0 + r.z1) / 2;
  for (const shrink of [1, 0.75, 0.55]) {
    const radius = Math.min(12, short / 4, Math.max(3, height * 0.65)) * shrink;
    const o: MonumentOptions = { height: height * (0.8 + 0.2 * shrink), radius, outdoor: true, distort: rng.float(0.3, 0.6) };
    const offs: [number, number][] = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [ox, oz] of offs) {
      const cx = cx0 + ox * radius, cz = cz0 + oz * radius;
      if (!placeMonument(c, 'colossus', [cx, cz], o, rng.int(0, 3), true)) continue;
      const ly = Math.min(c.h - 0.1, o.height * 0.7);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4, lx = cx + Math.cos(a) * radius * 1.25, lz = cz + Math.sin(a) * radius * 1.25;
        c.L.boxes.push({ ...oddBox([lx - 0.35, ly - 0.04, lz - 0.35], [lx + 0.35, ly, lz + 0.35], 'lightWarm', false), kind: 'emitOnly' });
      }
      // 正面と背後の点光源（暗い大空間でも輪郭が読めるように。門の中心の高さ、半径の 1.3 倍の距離）
      for (const s of [-1, 1]) c.L.lights.push({ pos: [cx, Math.min(c.h - 0.5, o.height * 0.45), cz + s * radius * 1.3], color: s < 0 ? 0xffd9a8 : 0x9fc4ff, intensity: 1.4, distance: radius * 4 });
      c.note(`giant monument r=${radius.toFixed(1)} h=${o.height.toFixed(1)} at (${cx.toFixed(1)}, ${cz.toFixed(1)})`);
      return true;
    }
  }
  return false;
}
