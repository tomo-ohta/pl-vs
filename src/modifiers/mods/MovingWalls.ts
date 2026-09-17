/**
 * MovingWalls — 動く壁（E18 動く壁紙区画 speed 0.2 / M07 動くマップタイル speed 0.5）。
 * params: speed(m/s), count(最大個数。上限 8), mode('auto' | 'lining' | 'blocks'), mat(MatId。省略時はモード既定)
 *
 * 方針（implementation-analysis「MovingWalls」/ v1.3 D25）: 外殻・ソケット・footprint・bounds は不動。動くのは室内の壁ブロックだけ。
 *   layout フック（決定論。渡された rng のみ）:
 *     - lining（廊下。footprint の全矩形の短辺 ≤ 4.5 m）: 外壁の内面から 0.14 m 離した壁紙パネル（幅 1.8〜3 m × 天井高、厚 ≤ 0.08）を
 *       壁沿いに置き、大半は壁に沿ってスライド（'slide' 三角波 0.6〜1.5 m）、一部は内側へ呼吸（'oscillate' ≤ 0.3 m）。
 *     - blocks（大部屋。M07 の LargeRoom 代替など）: 3 m 格子のセルに床から高さ min(天井 − 0.05, 3.0) の壁ブロック（2.4 × 0.3 m）を置き、
 *       長辺方向か直交方向へ 1.0〜1.8 m スライド（一部は正弦波）。blocks が 0 個なら lining にフォールバック。
 *     - 制約: 扉前（開口幅 + 両側 1.6 m × 奥行 1.8 m、穴は ±1.6 m）に掃引範囲が入らない。通路幅 1.2 m を常に確保
 *       （lining は「両側のパネルが最大に張り出しても内法 ≥ 1.2」で張り出し・呼吸振幅をクランプ、blocks は掃引 AABB と壁・家具・
 *       他ブロックの間隔 ≥ 1.2）。照明の点を含む位置には置かない。
 *     - 個数は Tier に依らず最大 8（描画は個別 Mesh なので draw call を抑える）。Generator が既に L.dynamics を出していれば追加しない（M07 本実装後）。
 *   build フック: RoomBuilder が構築した自分の可動要素（id 'MovingWalls:*'）の駆動を MovingWalls.drive の takeOverDynamics で引き取り、
 *     「次の位置がプレイヤーと重なるなら止まる」規則で動かす（RoomBuilder の時間駆動には挟み込み防止が無く、静止中のプレイヤーに
 *     食い込むと天井の上へ弾き出されるため）。位相は実時間で保存しない。
 */
import type { AABB } from '../../core/aabb';
import type { Dir, Socket, Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { inner, rect, wallSpans, type Rect, type WallSpan } from '../../generators/footprint';
import { box, WALL_T, type Box, type DynamicSpec, type MatId } from '../../generators/layout';
import type { RoomEffect } from '../../render/RoomBuilder';
import type { ModifierImpl } from '../types';
import { interiorBoxes, num, str } from '../util';
import { advanceTimed, takeOverDynamics } from './MovingWalls.drive';

const ID = 'MovingWalls';
/** 常に確保する通路幅（m） */
const PASSAGE = 1.2;
/** 扉前に確保する奥行（m。仕様 1.6 + 余白）と横の余白（m） */
const DOOR_DEPTH = 1.8;
const DOOR_SIDE = 1.6;
/** lining: 壁の内面からパネル裏面までの隙間（偽扉 0.03 + 幕板 0.06 + 壁灯 0.12 より外側）と厚さ */
const LINING_INSET = 0.14;
const LINING_THICK = 0.08;
/** blocks: ブロック寸法と格子 */
const BLOCK_LEN = 2.4;
const BLOCK_THICK = 0.3;
const BLOCK_CELL = 3.0;
/** blocks: ブロックの最大高さ（m）。天井が高い部屋では天井まで届かない「タイル」にする */
const BLOCK_MAX_H = 3.0;
const MAX_COUNT = 8;

type Mode = 'lining' | 'blocks';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function rectsOverlapXZ(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

function expandRect(r: Rect, d: number): Rect {
  return { x0: r.x0 - d, z0: r.z0 - d, x1: r.x1 + d, z1: r.z1 + d };
}

function rectInside(r: Rect, outer: Rect): boolean {
  return r.x0 >= outer.x0 && r.x1 <= outer.x1 && r.z0 >= outer.z0 && r.z1 <= outer.z1;
}

function rectOfBoxXZ(b: Box | AABB): Rect {
  return rect(b.min[0], b.min[2], b.max[0], b.max[2]);
}

/** 扉前・穴周りの禁止領域（XZ） */
function doorZones(sockets: Socket[]): Rect[] {
  const out: Rect[] = [];
  for (const s of sockets) {
    const [px, , pz] = s.pos;
    if (s.type === 'hole') {
      out.push(rect(px - DOOR_SIDE, pz - DOOR_SIDE, px + DOOR_SIDE, pz + DOOR_SIDE));
      continue;
    }
    const half = s.width / 2 + DOOR_SIDE;
    switch (s.dir) {
      case 0: out.push(rect(px - half, pz - DOOR_DEPTH, px + half, pz)); break;
      case 2: out.push(rect(px - half, pz, px + half, pz + DOOR_DEPTH)); break;
      case 1: out.push(rect(px - DOOR_DEPTH, pz - half, px, pz + half)); break;
      default: out.push(rect(px, pz - half, px + DOOR_DEPTH, pz + half)); break;
    }
  }
  return out;
}

/** 掃引範囲（XZ）と静的な障害（扉前・ソリッド内装・照明）の衝突判定 */
interface Obstacles {
  zones: Rect[];
  solids: Rect[];
  lights: Vec3[];
}

function blockedBy(swept: Rect, o: Obstacles, solidGap: number, lightGap: number): boolean {
  if (o.zones.some((z) => rectsOverlapXZ(z, swept))) return true;
  const grown = expandRect(swept, solidGap);
  if (o.solids.some((s) => rectsOverlapXZ(s, grown))) return true;
  if (!Number.isFinite(lightGap)) return false;
  const lg = expandRect(swept, lightGap);
  return o.lights.some((l) => l[0] > lg.x0 && l[0] < lg.x1 && l[2] > lg.z0 && l[2] < lg.z1);
}

/** 壁の内面の座標と、辺に沿った区間 [t0, t1] × 内面から奥行 [d0, d1] の矩形（XZ） */
function wallBandRect(span: WallSpan, t0: number, t1: number, d0: number, d1: number): Rect {
  const c = span.edge.coord;
  switch (span.edge.dir) {
    case 0: return rect(t0, c - WALL_T - d1, t1, c - WALL_T - d0);
    case 2: return rect(t0, c + WALL_T + d0, t1, c + WALL_T + d1);
    case 1: return rect(c - WALL_T - d1, t0, c - WALL_T - d0, t1);
    default: return rect(c + WALL_T + d0, t0, c + WALL_T + d1, t1);
  }
}

function alongAxis(dir: Dir): Vec3 {
  return dir === 0 || dir === 2 ? [1, 0, 0] : [0, 0, 1];
}

function inwardAxis(dir: Dir): Vec3 {
  switch (dir) {
    case 0: return [0, 0, -1];
    case 2: return [0, 0, 1];
    case 1: return [-1, 0, 0];
    default: return [1, 0, 0];
  }
}

interface LiningCand {
  span: WallSpan;
  t: number;
  width: number;
  breathe: boolean;
  amp: number;
  thick: number;
  swept: Rect;
}

/** lining: 外壁沿いの壁紙パネル */
function liningPanels(rects: Rect[], h: number, o: Obstacles, speed: number, count: number, rng: Rng, mat: MatId): DynamicSpec[] {
  const spans = wallSpans(rects).filter((sp) => sp.a1 - sp.a0 >= 4);
  const cands: LiningCand[] = [];
  for (const sp of spans) {
    const r = sp.edge.rect;
    const acrossInner = (sp.edge.dir === 0 || sp.edge.dir === 2 ? r.z1 - r.z0 : r.x1 - r.x0) - 2 * WALL_T;
    // 両側のパネルが最大に張り出しても内法 ≥ PASSAGE
    const protrusion = Math.min(LINING_INSET + LINING_THICK, (acrossInner - PASSAGE) / 2);
    const thick = protrusion - LINING_INSET;
    if (thick < 0.03) continue;
    const breatheMax = Math.max(0, (acrossInner - PASSAGE) / 2 - protrusion);
    // 区間の両端 0.5 m は空ける（角で直交する壁のパネルと重ならない: 張り出し ≤ 0.22 + 0.14）
    let t = sp.a0 + 0.5 + rng.float(0, 1.0);
    while (t < sp.a1 - 0.5) {
      const width = rng.float(1.8, 3.0);
      const breathe = breatheMax >= 0.08 && rng.chance(0.35);
      const amp = breathe ? Math.min(0.3, breatheMax) : rng.float(0.6, 1.5);
      const sweepLen = width + (breathe ? 0 : amp);
      if (t + sweepLen > sp.a1 - 0.5) break;
      const swept = wallBandRect(sp, t, t + sweepLen, 0, protrusion + (breathe ? amp : 0));
      if (!blockedBy(swept, o, 0.3, 0.2)) cands.push({ span: sp, t, width, breathe, amp, thick, swept });
      t += sweepLen + rng.float(0.5, 1.5);
    }
  }
  const picked = cands.length > count ? rng.shuffle(cands.map((c, i) => ({ c, i }))).slice(0, count).sort((a, b) => a.i - b.i).map((x) => x.c) : cands;
  return picked.map((c, i) => {
    const b = wallBandRect(c.span, c.t, c.t + c.width, LINING_INSET, LINING_INSET + c.thick);
    const panel = box([b.x0, 0, b.z0], [b.x1, h - 0.02, b.z1], mat, true);
    const motion: DynamicSpec['motion'] = c.breathe
      ? { kind: 'oscillate', axis: inwardAxis(c.span.edge.dir), amplitude: c.amp, period: Math.max(6, (4 * c.amp) / speed), phase: rng.next() }
      : { kind: 'slide', axis: alongAxis(c.span.edge.dir), amplitude: c.amp, period: Math.max(2, (2 * c.amp) / speed), phase: rng.next() };
    return { id: `${ID}:${i}`, box: panel, motion, solid: true };
  });
}

interface BlockCand {
  box: Box;
  axis: Vec3;
  amp: number;
  swept: Rect;
}

/** blocks: 室内の自立した壁ブロック */
function freeBlocks(rects: Rect[], h: number, o: Obstacles, speed: number, count: number, rng: Rng, mat: MatId): DynamicSpec[] {
  const cands: BlockCand[] = [];
  const top = Math.min(h - 0.05, BLOCK_MAX_H);
  // 照明（h - 0.4）に届く高さのときだけ照明の点を避ける
  const lightGap = top > h - 0.45 ? 0.3 : -Infinity;
  for (const r of rects) {
    const ir = inner(r, WALL_T + PASSAGE);
    const w = ir.x1 - ir.x0;
    const d = ir.z1 - ir.z0;
    if (w < BLOCK_LEN + 0.6 || d < BLOCK_LEN + 0.6) continue;
    const nx = Math.max(1, Math.floor(w / BLOCK_CELL));
    const nz = Math.max(1, Math.floor(d / BLOCK_CELL));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = ir.x0 + ((i + 0.5) * w) / nx;
        const cz = ir.z0 + ((j + 0.5) * d) / nz;
        const alongX = (i + j) % 2 === 0;
        const perpendicular = rng.chance(0.5);
        const amp = rng.float(1.0, 1.8);
        // スライド軸（正方向）。掃引範囲がセル中心に来るよう位相 0 の箱を -amp/2 ずらす
        const slideX = alongX !== perpendicular;
        const axis: Vec3 = slideX ? [1, 0, 0] : [0, 0, 1];
        const hx = alongX ? BLOCK_LEN / 2 : BLOCK_THICK / 2;
        const hz = alongX ? BLOCK_THICK / 2 : BLOCK_LEN / 2;
        const bx = cx - (slideX ? amp / 2 : 0);
        const bz = cz - (slideX ? 0 : amp / 2);
        const b = box([bx - hx, 0, bz - hz], [bx + hx, top, bz + hz], mat, true);
        const swept = rect(b.min[0], b.min[2], b.max[0] + (slideX ? amp : 0), b.max[2] + (slideX ? 0 : amp));
        if (!rectInside(swept, ir)) continue;
        if (blockedBy(swept, o, PASSAGE, lightGap)) continue;
        cands.push({ box: b, axis, amp, swept });
      }
    }
  }
  const chosen: BlockCand[] = [];
  for (const c of rng.shuffle(cands)) {
    if (chosen.length >= count) break;
    if (chosen.some((k) => rectsOverlapXZ(expandRect(k.swept, PASSAGE), c.swept))) continue;
    chosen.push(c);
  }
  return chosen.map((c, i) => ({
    id: `${ID}:${i}`,
    box: c.box,
    motion: { kind: rng.chance(0.75) ? 'slide' : 'oscillate', axis: c.axis, amplitude: c.amp, period: Math.max(2, (2 * c.amp) / speed), phase: rng.next() },
    solid: true,
  }));
}

const MovingWalls: ModifierImpl = {
  id: ID,
  defaults: { speed: 0.3, count: MAX_COUNT, mode: 'auto' },
  layout(L, _p, params, rng) {
    // Generator（DynamicGrid 本実装など）が既に可動要素を出していれば追加しない
    if (L.dynamics?.length) return;
    const speed = clamp(num(params.speed, 0.3), 0.05, 2.0);
    const count = clamp(Math.round(num(params.count, MAX_COUNT)), 1, MAX_COUNT);
    const rects = L.footprint.length ? L.footprint : [rect(L.bounds.min[0], L.bounds.min[2], L.bounds.max[0], L.bounds.max[2])];
    const h = L.height;
    const modeParam = str(params.mode, 'auto');
    const corridorLike = rects.every((r) => Math.min(r.x1 - r.x0, r.z1 - r.z0) <= 4.5);
    const mode: Mode = modeParam === 'lining' || modeParam === 'blocks' ? modeParam : corridorLike ? 'lining' : 'blocks';
    const o: Obstacles = {
      zones: doorZones(L.sockets),
      solids: interiorBoxes(L).filter((b) => b.solid && b.max[1] > 0.05).map(rectOfBoxXZ),
      lights: L.lights.map((l) => l.pos),
    };
    // エレベーター籠・上階の踊り場なども避ける
    for (const e of L.elevators) o.zones.push(expandRect(rectOfBoxXZ(e.volume), 0.6));
    const matParam = params.mat;
    const mat: MatId = typeof matParam === 'string' ? (matParam as MatId) : mode === 'blocks' ? 'wallWhite' : L.palette.wall;
    let specs = mode === 'blocks' ? freeBlocks(rects, h, o, speed, count, rng.fork('blocks'), mat) : liningPanels(rects, h, o, speed, count, rng.fork('lining'), mat);
    if (specs.length === 0 && mode === 'blocks') specs = liningPanels(rects, h, o, speed, count, rng.fork('lining'), L.palette.wall);
    if (specs.length === 0) return;
    L.dynamics = [...(L.dynamics ?? []), ...specs];
  },
  build(built, _L, ctx) {
    const placement = ctx.node.placement;
    if (!placement) return;
    const blocks = takeOverDynamics(built, placement, (id) => id.startsWith(`${ID}:`), ID);
    if (blocks.length === 0) return;
    const effect: RoomEffect = {
      update(dt, rc) {
        advanceTimed(blocks, dt, placement, rc.player);
      },
      dispose() { /* クローン Mesh は RoomBuilder.dispose の traverse で解放（geometry / material は RoomBuilder 側と共有） */ },
    };
    built.effects.push(effect);
  },
};

export default MovingWalls;
