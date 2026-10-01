/**
 * EraPreset — 区画ごとに年代プリセット（床・壁・天井・扉帯・照明色・環境音）を切り替える（R11 年代混在ホテル / E02 年代階段）。
 * params: eras: string[]（'1960s' … '2020s'）, segmentLength: number（m。VerticalCore では 1 = 1 階ごと）。
 *
 * layout フック（決定論。ジオメトリはここで確定）:
 *   - 廊下 / 部屋（R11）: footprint の矩形列を入口から進行方向にたどり、segmentLength ごとに区画を切る。区画 i は eras[i % n]。
 *     外殻の箱を区画境界で分割して年代の材質に差し替え（EraPreset.shellSplit）、客室ドア帯（palette.door の内装箔）と
 *     発光パネル・LightSpec の色も年代のものへ。境目の床に 5 cm の trim 帯を置く。
 *   - VerticalCore（E02）: 2 レベル固定のまま seed で eras から 2 つ選ぶ（下が古い。v1.3 前提）。レベル = floor(y / 3.6)。
 *     壁は y = 3.6 で分割、床スラブは上面の高さ、天井は下面の高さでレベルを決める。
 *   - どちらも L.zones に kind 'theme'（params { era, index }）を書き出す（地図の内訳線・検証・音の切替に使う）。
 * onEnter / update: プレイヤーのいる区画の年代に応じて ctx.audio.overridePreset（現在部屋のときだけ。区画が変わった時にだけ呼ぶ）。
 *   E02 の audioPreset「年代別環境音」はメタ指定なので年代ラベルのみ、R11 は「元ラベル・年代ラベル」で重ねる。
 * Tier: 寸法・抽選は変えない（描画量も増やさない）。
 */
import type { Vec3 } from '../../core/types';
import { toLocal } from '../../core/types';
import type { Rng } from '../../core/rng';
import { WALL_T, type Box, type MatId, type RoomLayout, type Zone } from '../../generators/layout';
import type { Rect } from '../../generators/footprint';
import { mapPreset } from '../../audio/presetMap';
import type { ModifierImpl, RuntimeContext } from '../types';
import { num } from '../util';
import { centerOf, pickIndices, recolorLights, recolorShell, rectIndexAt, type ShellMats } from './EraPreset.shellSplit';

/** 年代プリセット（既存 MatId のみ。色温度の差で年代感を出す） */
export interface EraSpec extends ShellMats {
  door: MatId;
  light: MatId;
  lightColor: number;
  /** presetMap のキーワードで組んだ環境音ラベル */
  audio: string;
}

export const ERA_TABLE: Record<string, EraSpec> = {
  '1960s': { floor: 'floorTile', wall: 'wallGreen', ceiling: 'ceilingWhite', door: 'doorWood', light: 'lightWarm', lightColor: 0xffc27a, audio: '回線ノイズ・低いハム・時計' },
  '1970s': { floor: 'floorCarpetRed', wall: 'wallBeige', ceiling: 'ceilingWhite', door: 'doorWood', light: 'lightWarm', lightColor: 0xffd9a0, audio: '低いハム・遠いBGM' },
  '1980s': { floor: 'floorCarpetGrey', wall: 'wallCream', ceiling: 'ceilingTile', door: 'doorWood', light: 'lightPanel', lightColor: 0xf3ead0, audio: 'モニター・蛍光灯' },
  '1990s': { floor: 'floorLino', wall: 'wallWhite', ceiling: 'ceilingTile', door: 'doorWood', light: 'lightPanel', lightColor: 0xe9f0ff, audio: '蛍光灯・空調' },
  '2000s': { floor: 'floorTile', wall: 'wallWhite', ceiling: 'ceilingWhite', door: 'doorMetal', light: 'lightPanel', lightColor: 0xf2f6ff, audio: 'PCファン・電子音' },
  '2010s': { floor: 'floorWood', wall: 'wallDark', ceiling: 'ceilingDark', door: 'doorMetal', light: 'lightPanel', lightColor: 0xdfe8ff, audio: '空調・微かな電子表示音' },
  '2020s': { floor: 'floorConcrete', wall: 'wallWhite', ceiling: 'ceilingWhite', door: 'glass', light: 'ledBlue', lightColor: 0x9fc8ff, audio: '静かな空調' },
};

const FLOOR_H = 3.6;
const ERA_ORDER = Object.keys(ERA_TABLE);

/** 年代ラベルをテーブルのキーに正規化する（'1975' → '1970s'。不明なら null） */
export function normalizeEra(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (ERA_TABLE[s]) return s;
  const m = /(\d{4})/.exec(s);
  if (m) {
    const decade = `${Math.floor(parseInt(m[1], 10) / 10) * 10}s`;
    if (ERA_TABLE[decade]) return decade;
    // 範囲外は最も近い年代
    const y = parseInt(m[1], 10);
    return ERA_ORDER.reduce((best, k) => (Math.abs(parseInt(k, 10) - y) < Math.abs(parseInt(best, 10) - y) ? k : best), ERA_ORDER[0]);
  }
  return null;
}

function parseEras(params: Record<string, unknown>, fallback: string[]): string[] {
  const raw = Array.isArray(params.eras) ? params.eras : [];
  const out = raw.map(normalizeEra).filter((e): e is string => !!e);
  return out.length ? out : fallback;
}

// ---------------------------------------------------------------- 進行軸に沿った区画（廊下 / 部屋）

interface PathSeg {
  rect: Rect;
  /** 進行軸（0 = x / 2 = z） */
  axis: 0 | 2;
  /** 進行方向の符号 */
  sign: 1 | -1;
  /** 進行方向の開始座標 */
  start: number;
  /** この矩形の始点までの累積距離 */
  t0: number;
  length: number;
}

/** footprint の矩形列を入口から順にたどる（CorridorGenerator の segments 順。部屋なら主矩形を +Z 方向に） */
export function pathSegments(rects: readonly Rect[]): PathSeg[] {
  const segs: PathSeg[] = [];
  let t0 = 0;
  const eps = 0.05;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    let axis: 0 | 2 = 2;
    let sign: 1 | -1 = 1;
    if (i > 0) {
      const prev = rects[i - 1];
      if (Math.abs(prev.x1 - r.x0) < eps) { axis = 0; sign = 1; }
      else if (Math.abs(prev.x0 - r.x1) < eps) { axis = 0; sign = -1; }
      else if (Math.abs(prev.z1 - r.z0) < eps) { axis = 2; sign = 1; }
      else if (Math.abs(prev.z0 - r.z1) < eps) { axis = 2; sign = -1; }
      else {
        // 接していない（翼など）: 長辺方向を +
        axis = r.x1 - r.x0 > r.z1 - r.z0 ? 0 : 2;
        sign = 1;
      }
    }
    const lo = axis === 0 ? r.x0 : r.z0;
    const hi = axis === 0 ? r.x1 : r.z1;
    const length = hi - lo;
    segs.push({ rect: r, axis, sign, start: sign > 0 ? lo : hi, t0, length });
    t0 += length;
  }
  return segs;
}

/** 座標 → 累積距離 */
function distanceAlong(seg: PathSeg, coord: number): number {
  return seg.t0 + (seg.sign > 0 ? coord - seg.start : seg.start - coord);
}

/** セグメント内の区画境界（進行軸の座標） */
function cutsOf(seg: PathSeg, segLen: number): number[] {
  const out: number[] = [];
  const kStart = Math.floor(seg.t0 / segLen) + 1;
  for (let k = kStart; k * segLen < seg.t0 + seg.length - 0.3; k++) {
    const d = k * segLen - seg.t0;
    if (d < 0.3) continue;
    out.push(seg.sign > 0 ? seg.start + d : seg.start - d);
  }
  return out;
}

function applyAlongPath(L: RoomLayout, eras: string[], segLen: number): void {
  const rects = L.footprint.length ? L.footprint : [{ x0: L.bounds.min[0], z0: L.bounds.min[2], x1: L.bounds.max[0], z1: L.bounds.max[2] }];
  const segs = pathSegments(rects);
  const cutsBySeg = segs.map((s) => cutsOf(s, segLen));
  const zoneIndexAt = (x: number, z: number): number => {
    const si = rectIndexAt(rects, x, z);
    const seg = segs[si];
    const coord = seg.axis === 0 ? x : z;
    return Math.max(0, Math.floor(distanceAlong(seg, coord) / segLen));
  };
  const eraOf = (zone: number): EraSpec => ERA_TABLE[eras[zone % eras.length]];
  const origDoor = L.palette.door;

  recolorShell(
    L,
    (b) => {
      const c = centerOf(b);
      const si = rectIndexAt(rects, c[0], c[2]);
      const cuts = cutsBySeg[si];
      return segs[si].axis === 0 ? { x: cuts } : { z: cuts };
    },
    (piece) => { const c = centerOf(piece); return zoneIndexAt(c[0], c[2]); },
    (zone) => eraOf(zone),
  );
  // 客室ドア帯（内装の palette.door 箔）を年代の扉材質へ
  for (let i = L.shellCount ?? 0; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.mat !== origDoor) continue;
    const c = centerOf(b);
    L.boxes[i] = { ...b, mat: eraOf(zoneIndexAt(c[0], c[2])).door };
  }
  recolorLights(L, (pos) => zoneIndexAt(pos[0], pos[2]), (zone) => ({ mat: eraOf(zone).light, color: eraOf(zone).lightColor }));

  // 境目の trim 帯（床、非ソリッド）と theme ゾーン
  const zones: Zone[] = [];
  const y0 = L.bounds.min[1];
  const y1 = L.bounds.max[1];
  segs.forEach((seg, si) => {
    const r = seg.rect;
    const cuts = cutsBySeg[si];
    for (const c of cuts) {
      const strip: Box = seg.axis === 0
        ? { min: [c - 0.025, 0.0005, r.z0 + WALL_T], max: [c + 0.025, 0.012, r.z1 - WALL_T], mat: 'trim', solid: false }
        : { min: [r.x0 + WALL_T, 0.0005, c - 0.025], max: [r.x1 - WALL_T, 0.012, c + 0.025], mat: 'trim', solid: false };
      L.boxes.push(strip);
    }
    const lo = seg.axis === 0 ? r.x0 : r.z0;
    const hi = seg.axis === 0 ? r.x1 : r.z1;
    const edges = [lo, ...cuts.slice().sort((a, b) => a - b), hi];
    for (let k = 0; k < edges.length - 1; k++) {
      const a = edges[k];
      const b = edges[k + 1];
      if (b - a < 0.05) continue;
      const mid = (a + b) / 2;
      const idx = seg.axis === 0 ? zoneIndexAt(mid, (r.z0 + r.z1) / 2) : zoneIndexAt((r.x0 + r.x1) / 2, mid);
      const aabb = seg.axis === 0
        ? { min: [a, y0, r.z0] as Vec3, max: [b, y1, r.z1] as Vec3 }
        : { min: [r.x0, y0, a] as Vec3, max: [r.x1, y1, b] as Vec3 };
      const era = eras[idx % eras.length];
      zones.push({ kind: 'theme', aabb, params: { era, index: idx, door: ERA_TABLE[era].door, mod: 'EraPreset' } });
    }
  });
  L.zones = [...(L.zones ?? []), ...zones];
}

// ---------------------------------------------------------------- レベルごとの区画（VerticalCore）

function applyByLevel(L: RoomLayout, erasAll: string[], rng: Rng): void {
  const levels = Math.max(1, Math.round(L.height / FLOOR_H));
  // seed で levels 個を選ぶ（下が古い = ERA_TABLE の順序で昇順）
  const chosenIdx = pickIndices(rng, erasAll.length, levels);
  const chosen = chosenIdx.map((i) => erasAll[i]).sort((a, b) => ERA_ORDER.indexOf(a) - ERA_ORDER.indexOf(b));
  while (chosen.length < levels) chosen.push(chosen[chosen.length - 1] ?? erasAll[0]);
  const eraOf = (level: number): EraSpec => ERA_TABLE[chosen[Math.max(0, Math.min(levels - 1, level))]];
  const levelOfY = (y: number): number => Math.max(0, Math.min(levels - 1, Math.floor((y + 0.01) / FLOOR_H)));
  const yCuts = Array.from({ length: levels - 1 }, (_, k) => (k + 1) * FLOOR_H);

  recolorShell(
    L,
    (_b, role) => (role === 'wall' ? { y: yCuts } : {}),
    (piece, role) => {
      // 床スラブは上面、天井は下面、壁は中心でレベルを決める
      if (role === 'floor') return levelOfY(piece.max[1]);
      if (role === 'ceiling') return levelOfY(piece.min[1] - 0.02);
      return levelOfY((piece.min[1] + piece.max[1]) / 2);
    },
    (level) => eraOf(level),
  );
  recolorLights(L, (pos) => levelOfY(pos[1] - 0.02), (level) => ({ mat: eraOf(level).light, color: eraOf(level).lightColor }));

  const zones: Zone[] = [];
  for (let k = 0; k < levels; k++) {
    zones.push({
      kind: 'theme',
      aabb: { min: [L.bounds.min[0], k === 0 ? L.bounds.min[1] : k * FLOOR_H, L.bounds.min[2]], max: [L.bounds.max[0], k === levels - 1 ? L.bounds.max[1] : (k + 1) * FLOOR_H, L.bounds.max[2]] },
      params: { era: chosen[k], index: k, level: k, door: ERA_TABLE[chosen[k]].door, mod: 'EraPreset' },
    });
  }
  L.zones = [...(L.zones ?? []), ...zones];
}

// ---------------------------------------------------------------- ランタイム（音）

/** roomId → 直近に適用した年代ラベル */
const applied = new Map<string, string>();

function eraAt(ctx: RuntimeContext): string | null {
  const zones = ctx.layout.zones?.filter((z) => z.kind === 'theme' && z.params?.mod === 'EraPreset') ?? [];
  if (!zones.length || !ctx.node.placement) return null;
  const local = toLocal(ctx.node.placement, ctx.player.pos);
  const p: Vec3 = [local[0], local[1] + 0.3, local[2]];
  for (const z of zones) {
    const a = z.aabb;
    if (p[0] >= a.min[0] - 0.3 && p[0] <= a.max[0] + 0.3 && p[1] >= a.min[1] - 0.05 && p[1] <= a.max[1] + 0.05 && p[2] >= a.min[2] - 0.3 && p[2] <= a.max[2] + 0.3) {
      return typeof z.params?.era === 'string' ? z.params.era : null;
    }
  }
  return typeof zones[0].params?.era === 'string' ? zones[0].params.era : null;
}

function audioLabelFor(ctx: RuntimeContext, era: string): string {
  const spec = ERA_TABLE[era];
  const base = ctx.def?.audioPreset ?? '';
  if (!base || mapPreset(base).meta) return spec.audio;
  return `${base}・${spec.audio}`;
}

function syncAudio(ctx: RuntimeContext, force: boolean): void {
  if (!ctx.audio) return;
  if (ctx.game && ctx.game.currentRoomId !== ctx.node.roomId) return;
  const era = eraAt(ctx);
  if (!era) return;
  const label = audioLabelFor(ctx, era);
  if (!force && applied.get(ctx.node.roomId) === label) return;
  applied.set(ctx.node.roomId, label);
  ctx.audio.overridePreset(label);
}

const EraPreset: ModifierImpl = {
  id: 'EraPreset',
  defaults: { eras: ['1970s', '1990s', '2010s'], segmentLength: 8 },
  layout(L, p, params, rng) {
    const eras = parseEras(params, ['1970s', '1990s', '2010s']);
    const segLen = Math.max(3, num(params.segmentLength, 8));
    if (p.template.generator === 'VerticalGenerator' || (L.footprint.length === 0 && L.height > FLOOR_H * 1.5)) {
      applyByLevel(L, eras, rng);
    } else {
      applyAlongPath(L, eras, segLen);
    }
  },
  onEnter(ctx) {
    syncAudio(ctx, true);
  },
  update(_dt, ctx) {
    syncAudio(ctx, false);
  },
  onExit(ctx) {
    applied.delete(ctx.node.roomId);
  },
};

export default EraPreset;
