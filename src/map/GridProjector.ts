/** 地図の投影ルール（9.4 節 / D6）。
 *  物理配置された部屋は実座標から 4m セルへ投影する。端点をそれぞれ丸めるので、隣接する部屋のセル境界は一致する。
 *  同階層の重なりは丸め誤差に限られるため「？」にはしない。投影不能（projected=false）は Seam 接続だけ（位置は実座標）。
 *
 *  統合担当向け: 呼び出し方
 *   - assign(roomId, wb, parentCell, dir, seam?, opts?) の第 6 引数 opts.levelSpan（多層の巨大部屋が占めるフロア数）を
 *     渡すと MapCell.levelSpan に入る。省略時は従来どおり（単層）。levelSpanOf(wb) は天井高から階数を出す補助
 *     （吹き抜けの高い単層ホールも 2 になるので、Generator / 定義側が多層と分かっている部屋にだけ使う）。
 *   - MAX_CELLS は 80（320 m）。Legendary 巨大部屋（Mega 60〜160 m / Street 64 m〜）が矩形外に浮かない（Q2-B）。
 *   - footprintToCells / rotateAround / rotatedBounds は Minimap / Map3D が使う純関数（DOM 非依存。Node で検証可）。 */
import type { AABB } from '../core/aabb';
import type { Dir, MapCell, Placement } from '../core/types';
import { toWorld } from '../core/types';
import type { Rect } from '../generators/footprint';

export const CELL = 4; // 1 セル = 4m
/** 1 部屋の最大セル数（1 辺）。仕様の 16 から Legendary 実寸表示のため 80 に緩和 */
export const MAX_CELLS = 80;
/** 階高（m）。WorldManager の FLOOR と同じ値 */
export const FLOOR_H = 3.6;

/** セル座標の矩形（gx, gy が左上。w, h はセル数。小数もあり得る＝ゾーン内訳線） */
export interface CellRect {
  gx: number;
  gy: number;
  w: number;
  h: number;
}

export interface AssignOptions {
  /** 多層の巨大部屋が占めるフロア数（既定 1） */
  levelSpan?: number;
}

/** ワールド AABB の高さから階数を出す（3.6 m 刻み。+0.5 m の余裕で天井の厚みを吸収）。単層は 1 */
export function levelSpanOf(wb: AABB): number {
  const h = wb.max[1] - wb.min[1];
  return Math.max(1, Math.floor((h + 0.5) / FLOOR_H));
}

/** 高さ y（m）のフロア番号 */
export function levelOfY(y: number): number {
  return Math.round(y / FLOOR_H);
}

/**
 * ワールド座標の区間 [a, b]（m）を assign と同じ丸めでセル区間 [g0, g1) にする。
 * 幅が 1 セル未満で潰れるとき（細い廊下）は中心を含むセル 1 つにする。
 */
export function snapSpan(a: number, b: number): [number, number] {
  const g0 = Math.round(a / CELL);
  const g1 = Math.round(b / CELL);
  if (g1 > g0) return [g0, g1];
  const c = Math.floor((a + b) / 2 / CELL);
  return [c, c + 1];
}

/** ローカル矩形を配置でワールドへ回し、xz の範囲（m）を返す */
export function rectToWorld(r: Rect, p: Placement): { x0: number; z0: number; x1: number; z1: number } {
  const a = toWorld(p, [r.x0, 0, r.z0]);
  const b = toWorld(p, [r.x1, 0, r.z1]);
  return { x0: Math.min(a[0], b[0]), z0: Math.min(a[2], b[2]), x1: Math.max(a[0], b[0]), z1: Math.max(a[2], b[2]) };
}

/** セル区間 [g0, g1) を [c0, c1) の内側に収める（交わらなければ 1 セルだけ内側へ寄せる） */
function clampSpan(g0: number, g1: number, c0: number, c1: number): [number, number] {
  const a = Math.max(g0, c0);
  const b = Math.min(g1, c1);
  if (b > a) return [a, b];
  const s = Math.min(Math.max(g0, c0), c1 - 1);
  return [s, s + 1];
}

/**
 * footprint（ローカル矩形の集合）を配置でワールドへ回し、セル矩形へ投影する。
 * 端点を CELL で丸めるので assign の外接矩形と境界が一致し、隣室とも境界が揃う。
 * 折れ廊下・翼付き部屋・巨大部屋が実形で描ける。空の footprint は空配列（呼び出し側が mapCell へ代替）。
 * @param clampTo 外接セル（mapCell）。細い矩形の丸めが外接からはみ出さないように収める
 */
export function footprintToCells(rects: readonly Rect[], p: Placement, clampTo?: CellRect): CellRect[] {
  const out: CellRect[] = [];
  for (const r of rects) {
    const w = rectToWorld(r, p);
    let [gx0, gx1] = snapSpan(w.x0, w.x1);
    let [gy0, gy1] = snapSpan(w.z0, w.z1);
    if (clampTo) {
      [gx0, gx1] = clampSpan(gx0, gx1, clampTo.gx, clampTo.gx + clampTo.w);
      [gy0, gy1] = clampSpan(gy0, gy1, clampTo.gy, clampTo.gy + clampTo.h);
    }
    out.push({ gx: gx0, gy: gy0, w: gx1 - gx0, h: gy1 - gy0 });
  }
  return out;
}

/** ローカル矩形を丸めずにセル単位へ投影する（ゾーン内訳線など、細かい区画向け） */
export function rectToCellsExact(r: Rect, p: Placement): CellRect {
  const w = rectToWorld(r, p);
  return { gx: w.x0 / CELL, gy: w.z0 / CELL, w: (w.x1 - w.x0) / CELL, h: (w.z1 - w.z0) / CELL };
}

/** 点 (x, y) を中心 (cx, cy) の回りに angle（ラジアン。画面上＝y 下向き座標で時計回り正）回す */
export function rotateAround(x: number, y: number, cx: number, cy: number, angle: number): [number, number] {
  if (angle === 0) return [x, y];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** 矩形 [minX, maxX] × [minY, maxY] を中心回りに angle 回したときの外接矩形（フィット計算用） */
export function rotatedBounds(minX: number, minY: number, maxX: number, maxY: number, angle: number): { minX: number; minY: number; maxX: number; maxY: number } {
  if (angle === 0) return { minX, minY, maxX, maxY };
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pts = [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]].map(([x, y]) => rotateAround(x, y, cx, cy, angle));
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

/** 度 → ラジアン（MapRotation の angle 90 などをそのまま渡せる） */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export class GridProjector {
  readonly cells = new Map<string, MapCell>();

  restore(roomId: string, cell: MapCell): void {
    this.cells.set(roomId, cell);
  }

  /**
   * @param parentCell 親のセル（Seam 先の仮置きに使う）
   * @param dir 親ソケットのワールド方向（現在は未使用。将来のずらし処理用）
   * @param seam Seam 先は接続が物理的に連続しないので投影不能の印を付ける（位置は実座標）
   * @param opts levelSpan: 多層の巨大部屋が占めるフロア数（省略時は単層）
   */
  assign(roomId: string, wb: AABB, parentCell: MapCell | null, dir: Dir, seam = false, opts?: AssignOptions): MapCell {
    void dir;
    const level = levelOfY(wb.min[1]);
    const gx = Math.round(wb.min[0] / CELL);
    const gy = Math.round(wb.min[2] / CELL);
    const gx1 = Math.round(wb.max[0] / CELL);
    const gy1 = Math.round(wb.max[2] / CELL);
    const w = Math.max(1, Math.min(MAX_CELLS, gx1 - gx));
    const h = Math.max(1, Math.min(MAX_CELLS, gy1 - gy));
    // Seam 先も物理配置はされているので、実座標から投影する（親の隣に仮置きすると自分の位置が地図の部屋と一致しなくなる）。
    // 「投影不能」の印（projected=false → 破線・「？」）だけ残す
    void parentCell;
    const cell: MapCell = { gx, gy, w, h, rot: 0, projected: !seam, level };
    const span = opts?.levelSpan;
    if (span !== undefined && span > 1) cell.levelSpan = Math.floor(span);
    this.cells.set(roomId, cell);
    return cell;
  }
}
