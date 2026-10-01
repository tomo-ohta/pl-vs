/**
 * ZoneThemeShuffle — ゾーンごとに材質・家具プリセットを seed で乱択する（L05 屋内学園都市 / L20 永久万博会場）。
 * params: zoneCount: number, presetPool: 'campus' | 'any'（または テーマ id のカンマ区切り）。
 *
 * layout フック（決定論。ジオメトリはここで確定）:
 *   1. ゾーン矩形: L.zones に kind 'theme' が既にあれば（Generator が multiZone を出した場合）それをそのまま使い、
 *      無ければ最大の footprint 矩形を zoneCount に近い行×列の不均等グリッド（各セル 6 m 以上）に分け、残りの矩形（翼）は 1 ゾーンずつ。
 *   2. 各ゾーンに presetPool からテーマを割り当てる（ZoneThemeShuffle.presets の THEMES / POOLS。重複を避けて巡回）。
 *   3. 外殻の床・壁・天井をゾーン境界で分割してテーマの材質へ（EraPreset.shellSplit）。
 *   4. 自前でゾーンを切った場合: 内装（shellCount 以降）と照明を捨て、ゾーンごとにテーマの家具パターンと lightGrid で作り直す。
 *      境界には床の色帯（0.3 m、非ソリッド）と高さ 2.2 m の間仕切り（各境界に 2.8 m の抜け道）を置き、最後に clearDoorways で扉前を空ける。
 *      Generator 由来のゾーンでは内装は触らず、材質・照明色・params.preset の付与だけ行う。
 *   5. 'pool' テーマのゾーンには水面箔と kind 'water' ゾーン（slow 0.55）を張る。
 *   6. 各 theme ゾーンの params に { preset, label, pool, audio, mod: 'ZoneThemeShuffle' } を書く（地図の内訳線・検証・将来の audioZones）。
 * Tier: 寸法・抽選・当たり判定は変えない。
 */
import type { Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { AABB } from '../../core/aabb';
import { WALL_T, box, snap, type MatId, type RoomLayout, type Zone } from '../../generators/layout';
import { rectArea, type Rect } from '../../generators/footprint';
import { clearDoorways, lightGrid, type FurnishCtx } from '../../generators/common';
import type { ModifierImpl } from '../types';
import { num, str } from '../util';
import { centerOf, recolorLights, recolorShell, rectIndexAt } from './EraPreset.shellSplit';
import { assignThemes, poolBasin, poolOf, type ThemeSpec } from './ZoneThemeShuffle.presets';

const MIN_CELL = 6.0;

interface ZoneRect {
  rect: Rect;
  /** 自前グリッドの主矩形内セルか（間仕切り・色帯・家具の対象） */
  cell: boolean;
}

/** 主矩形を zoneCount に近い行×列に分ける（各セル MIN_CELL 以上。不均等な割り位置は rng、0.5 m にスナップ） */
function gridCells(main: Rect, count: number, rng: Rng): Rect[] {
  const w = main.x1 - main.x0;
  const d = main.z1 - main.z0;
  const maxCols = Math.max(1, Math.floor(w / MIN_CELL));
  const maxRows = Math.max(1, Math.floor(d / MIN_CELL));
  let best: [number, number] = [1, 1];
  let bestScore = -Infinity;
  for (let cols = 1; cols <= maxCols; cols++) {
    for (let rows = 1; rows <= maxRows; rows++) {
      const n = cols * rows;
      if (n > count) continue;
      // セル数が多いほど良く、同数ならセルが正方形に近いほど良い
      const cellW = w / cols;
      const cellD = d / rows;
      const squareness = -Math.abs(Math.log(cellW / cellD));
      const score = n * 10 + squareness;
      if (score > bestScore) { bestScore = score; best = [cols, rows]; }
    }
  }
  const [cols, rows] = best;
  const splits = (lo: number, hi: number, n: number): number[] => {
    if (n <= 1) return [lo, hi];
    const weights = Array.from({ length: n }, () => rng.float(0.8, 1.25));
    const total = weights.reduce((a, b) => a + b, 0);
    const out = [lo];
    let acc = lo;
    for (let i = 0; i < n - 1; i++) {
      acc += ((hi - lo) * weights[i]) / total;
      let c = snap(acc);
      // 最小セル幅を守る
      c = Math.max(out[out.length - 1] + MIN_CELL - 0.5, Math.min(hi - (n - 1 - i) * (MIN_CELL - 0.5), c));
      out.push(c);
    }
    out.push(hi);
    return out;
  };
  const xs = splits(main.x0, main.x1, cols);
  const zs = splits(main.z0, main.z1, rows);
  const cells: Rect[] = [];
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) cells.push({ x0: xs[ix], z0: zs[iz], x1: xs[ix + 1], z1: zs[iz + 1] });
  }
  return cells;
}

/** 内側の境界線（主矩形内の x / z カット座標） */
function innerCuts(cells: Rect[], main: Rect): { x: number[]; z: number[] } {
  const xs = new Set<number>();
  const zs = new Set<number>();
  for (const c of cells) {
    if (c.x0 > main.x0 + 0.01) xs.add(c.x0);
    if (c.z0 > main.z0 + 0.01) zs.add(c.z0);
  }
  return { x: [...xs].sort((a, b) => a - b), z: [...zs].sort((a, b) => a - b) };
}

/** 隣接セル間の境界に、色帯と抜け道付きの間仕切りを置く */
function buildBoundaries(L: RoomLayout, cells: Rect[], rng: Rng, bandMat: MatId): void {
  const h = Math.min(2.2, L.height - 0.3);
  const t = 0.06;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i];
      const b = cells[j];
      // 垂直境界（x が接する）
      if (Math.abs(a.x1 - b.x0) < 0.01 || Math.abs(b.x1 - a.x0) < 0.01) {
        const x = Math.abs(a.x1 - b.x0) < 0.01 ? a.x1 : b.x1;
        const z0 = Math.max(a.z0, b.z0);
        const z1 = Math.min(a.z1, b.z1);
        if (z1 - z0 < 1.0) continue;
        L.boxes.push(box([x - 0.15, 0.0005, z0], [x + 0.15, 0.01, z1], bandMat, false));
        partition(L, 'x', x, z0, z1, h, t, rng);
      }
      // 水平境界（z が接する）
      if (Math.abs(a.z1 - b.z0) < 0.01 || Math.abs(b.z1 - a.z0) < 0.01) {
        const z = Math.abs(a.z1 - b.z0) < 0.01 ? a.z1 : b.z1;
        const x0 = Math.max(a.x0, b.x0);
        const x1 = Math.min(a.x1, b.x1);
        if (x1 - x0 < 1.0) continue;
        L.boxes.push(box([x0, 0.0005, z - 0.15], [x1, 0.01, z + 0.15], bandMat, false));
        partition(L, 'z', z, x0, x1, h, t, rng);
      }
    }
  }
}

/** 抜け道（2.8 m）を残した間仕切り。区間が短ければ間仕切りは置かない（抜け道だけ） */
function partition(L: RoomLayout, axis: 'x' | 'z', at: number, a0: number, a1: number, h: number, t: number, rng: Rng): void {
  const gapW = 2.8;
  const len = a1 - a0;
  if (len < gapW + 1.2) return;
  const gapC = snap(rng.float(a0 + 0.6 + gapW / 2, a1 - 0.6 - gapW / 2));
  const segs: [number, number][] = [[a0 + 0.1, gapC - gapW / 2], [gapC + gapW / 2, a1 - 0.1]];
  for (const [s0, s1] of segs) {
    if (s1 - s0 < 0.3) continue;
    if (axis === 'x') L.boxes.push(box([at - t, 0, s0], [at + t, h, s1], 'wallWhite'));
    else L.boxes.push(box([s0, 0, at - t], [s1, h, at + t], 'wallWhite'));
    // 上部の横桟（パビリオン感）
    if (axis === 'x') L.boxes.push(box([at - t - 0.04, h - 0.12, s0], [at + t + 0.04, h, s1], 'trim', false));
    else L.boxes.push(box([s0, h - 0.12, at - t - 0.04], [s1, h, at + t + 0.04], 'trim', false));
  }
}

function themeZone(rect: Rect, L: RoomLayout, theme: ThemeSpec, pool: string, index: number): Zone {
  return {
    kind: 'theme',
    aabb: { min: [rect.x0, L.bounds.min[1], rect.z0], max: [rect.x1, L.bounds.max[1], rect.z1] },
    params: { preset: theme.id, label: theme.label, pool, audio: theme.audio, index, mod: 'ZoneThemeShuffle' },
  };
}

const ZoneThemeShuffle: ModifierImpl = {
  id: 'ZoneThemeShuffle',
  defaults: { zoneCount: 6, presetPool: 'any' },
  layout(L, _p, params, rng) {
    const zoneCount = Math.max(1, Math.min(16, Math.round(num(params.zoneCount, 6))));
    const poolName = str(params.presetPool, 'any');
    const pool = poolOf(poolName);
    const h = L.height;

    // 1. ゾーン矩形
    const existing = (L.zones ?? []).filter((z) => z.kind === 'theme');
    let zoneRects: ZoneRect[];
    let mainCuts: { x: number[]; z: number[] } = { x: [], z: [] };
    let mainRect: Rect | null = null;
    if (existing.length) {
      zoneRects = existing.map((z) => ({ rect: { x0: z.aabb.min[0], z0: z.aabb.min[2], x1: z.aabb.max[0], z1: z.aabb.max[2] }, cell: false }));
    } else {
      const rects = L.footprint.length ? L.footprint : [{ x0: L.bounds.min[0], z0: L.bounds.min[2], x1: L.bounds.max[0], z1: L.bounds.max[2] }];
      let mainIdx = 0;
      for (let i = 1; i < rects.length; i++) if (rectArea(rects[i]) > rectArea(rects[mainIdx])) mainIdx = i;
      mainRect = rects[mainIdx];
      const wings = rects.filter((_, i) => i !== mainIdx);
      const cells = gridCells(mainRect, Math.max(1, zoneCount - wings.length), rng);
      mainCuts = innerCuts(cells, mainRect);
      zoneRects = [...cells.map((r) => ({ rect: r, cell: true })), ...wings.map((r) => ({ rect: r, cell: false }))];
    }
    const zoneRectList = zoneRects.map((z) => z.rect);
    const zoneAt = (x: number, z: number): number => rectIndexAt(zoneRectList, x, z);

    // 2. テーマ割当
    const themes = assignThemes(rng.fork('themes'), pool, zoneRects.length);

    // 3. 外殻の材質
    recolorShell(
      L,
      (b) => {
        if (!mainRect) return {};
        const c = centerOf(b);
        const inMain = c[0] >= mainRect.x0 - 0.01 && c[0] <= mainRect.x1 + 0.01 && c[2] >= mainRect.z0 - 0.01 && c[2] <= mainRect.z1 + 0.01;
        return inMain ? mainCuts : {};
      },
      (piece) => { const c = centerOf(piece); return zoneAt(c[0], c[2]); },
      (zi) => themes[zi] ?? null,
    );

    if (existing.length) {
      // Generator 由来のゾーン: 内装は触らず、照明色と params だけ
      recolorLights(L, (pos) => zoneAt(pos[0], pos[2]), (zi) => (themes[zi] ? { mat: themes[zi].light, color: themes[zi].lightColor } : null));
      for (let i = 0; i < existing.length; i++) {
        const t = themes[i];
        existing[i].params = { ...(existing[i].params ?? {}), preset: t.id, label: t.label, pool: poolName, audio: t.audio, index: i, mod: 'ZoneThemeShuffle' };
      }
      return;
    }

    // 4. 内装と照明を作り直す
    const shellCount = L.shellCount ?? L.boxes.length;
    L.boxes = L.boxes.slice(0, shellCount);
    L.lights = [];
    const sockets = L.sockets;
    const zones: Zone[] = [...(L.zones ?? [])];
    const bandMat: MatId = poolName === 'campus' ? 'trim' : 'yellowLine';
    const cells = zoneRects.filter((z) => z.cell).map((z) => z.rect);
    buildBoundaries(L, cells, rng.fork('bounds'), bandMat);

    zoneRects.forEach((zr, i) => {
      const theme = themes[i];
      const zrng = rng.fork(`zone${i}`);
      const r = zr.rect;
      const ctx: FurnishCtx = { L, rects: [r], h, rng: zrng, keep: sockets, landing: null };
      const zone = themeZone(r, L, theme, poolName, i);
      // 床穴があるゾーンには水を張らない（穴の上に水面が乗ると落下が見えない）
      const hasHole = L.holes.some((hh) => { const cx = (hh.min[0] + hh.max[0]) / 2; const cz = (hh.min[2] + hh.max[2]) / 2; return cx >= r.x0 && cx <= r.x1 && cz >= r.z0 && cz <= r.z1; });
      if (theme.water && !hasHole) {
        const basin = poolBasin(L, r);
        if (basin) {
          const water: AABB = { min: [basin.x0, -0.1, basin.z0], max: [basin.x1, 0.6, basin.z1] };
          zones.push({ kind: 'water', aabb: water, params: { slow: 0.55, depth: 0.25 } });
        }
      } else if (!theme.water) {
        theme.furnish(ctx, r);
      }
      zones.push(zone);
      // 照明: ゾーンごとの材質・色
      const inset: Rect = { x0: r.x0 + WALL_T, z0: r.z0 + WALL_T, x1: r.x1 - WALL_T, z1: r.z1 - WALL_T };
      lightGrid(L, [inset], h, 4.5, theme.dim, zrng, theme.light, theme.lightColor, theme.lightIntensity, 2);
    });
    L.zones = zones;
    // 5. 扉前を空ける（間仕切り・家具が入口・出口を塞がないように）
    clearDoorways(L, sockets, shellCount);
  },
};

export default ZoneThemeShuffle;

/** 検証用: ゾーンの中心一覧（Node ハーネス） */
export function zoneCenters(L: RoomLayout): Vec3[] {
  return (L.zones ?? []).filter((z) => z.kind === 'theme').map((z) => [(z.aabb.min[0] + z.aabb.max[0]) / 2, 0, (z.aabb.min[2] + z.aabb.max[2]) / 2] as Vec3);
}
