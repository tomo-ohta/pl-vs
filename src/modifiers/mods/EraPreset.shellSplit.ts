/**
 * EraPreset / ZoneThemeShuffle 共用: 外殻（床・壁・天井）の箱を区画境界で分割して材質を差し替える純データ処理。
 * layout フックからだけ呼ぶ（ジオメトリの確定はレイアウト段階。RoomBuilder は材質ごとに結合するので分割数が増えても draw call は増えない）。
 */
import type { Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { Box, MatId, Palette, RoomLayout } from '../../generators/layout';
import type { Rect } from '../../generators/footprint';

export type ShellRole = 'floor' | 'wall' | 'ceiling';

/** 区画ごとの外殻材質 */
export interface ShellMats {
  floor: MatId;
  wall: MatId;
  ceiling: MatId;
}

/** 発光パネルの材質（照明プリセットの差し替え対象。lightOff は消灯なので対象外） */
export const LIGHT_MATS: ReadonlySet<MatId> = new Set<MatId>(['lightPanel', 'lightWarm', 'ledBlue', 'lightGreen', 'lightYellow', 'sodiumLight']);

/** 箱の役割を材質からパレットと比較して判定する（外殻以外の箱には null） */
export function roleOf(b: Box, pal: Palette): ShellRole | null {
  if (b.mat === pal.floor) return 'floor';
  if (b.mat === pal.wall) return 'wall';
  if (b.mat === pal.ceiling) return 'ceiling';
  return null;
}

export function centerOf(b: Box): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

/** 箱を axis（0 = x / 1 = y / 2 = z）の座標 cuts で分割する。箱の内側に無いカットは無視 */
export function splitBoxAt(b: Box, axis: 0 | 1 | 2, cuts: readonly number[]): Box[] {
  const inside = [...new Set(cuts.filter((c) => c > b.min[axis] + 0.01 && c < b.max[axis] - 0.01))].sort((a, c) => a - c);
  if (inside.length === 0) return [b];
  const out: Box[] = [];
  let lo = b.min[axis];
  for (const c of [...inside, b.max[axis]]) {
    const min: Vec3 = [b.min[0], b.min[1], b.min[2]];
    const max: Vec3 = [b.max[0], b.max[1], b.max[2]];
    min[axis] = lo;
    max[axis] = c;
    out.push({ min, max, mat: b.mat, solid: b.solid });
    lo = c;
  }
  return out;
}

/** 複数軸のカットを順に適用する */
export function splitBoxXZ(b: Box, cutsX: readonly number[], cutsZ: readonly number[]): Box[] {
  return splitBoxAt(b, 0, cutsX).flatMap((piece) => splitBoxAt(piece, 2, cutsZ));
}

/** 点 (x, z) を含む矩形のインデックス（壁は矩形の内側 WALL_T にあるので中心で判定できる）。無ければ最も近い矩形 */
export function rectIndexAt(rects: readonly Rect[], x: number, z: number): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x0 - 0.01 && x <= r.x1 + 0.01 && z >= r.z0 - 0.01 && z <= r.z1 + 0.01) return i;
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dz = Math.max(r.z0 - z, 0, z - r.z1);
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * 外殻の箱（先頭 shellCount 個。無ければ役割材質を持つ全箱）を区画で分割して材質を差し替える。
 *   cutsFor(box)  … その箱に適用する x / z / y のカット座標
 *   zoneOf(piece) … 分割後の各箔が属する区画のインデックス（-1 で変更なし）
 *   matsOf(zone)  … 区画の外殻材質
 * 戻り値は新しい shellCount。L.boxes は先頭の外殻部分だけ差し替える（内装の箱の順序は保つ）
 */
export function recolorShell(
  L: RoomLayout,
  cutsFor: (b: Box, role: ShellRole) => { x?: readonly number[]; y?: readonly number[]; z?: readonly number[] },
  zoneOf: (piece: Box, role: ShellRole) => number,
  matsOf: (zone: number) => ShellMats | null,
): number {
  const pal = L.palette;
  const shellCount = L.shellCount ?? L.boxes.length;
  const head = L.boxes.slice(0, shellCount);
  const tail = L.boxes.slice(shellCount);
  const out: Box[] = [];
  for (const b of head) {
    const role = roleOf(b, pal);
    if (!role) { out.push(b); continue; }
    const cuts = cutsFor(b, role);
    let pieces: Box[] = [b];
    if (cuts.x?.length) pieces = pieces.flatMap((p) => splitBoxAt(p, 0, cuts.x!));
    if (cuts.y?.length) pieces = pieces.flatMap((p) => splitBoxAt(p, 1, cuts.y!));
    if (cuts.z?.length) pieces = pieces.flatMap((p) => splitBoxAt(p, 2, cuts.z!));
    for (const piece of pieces) {
      const zi = zoneOf(piece, role);
      const mats = zi >= 0 ? matsOf(zi) : null;
      out.push(mats ? { ...piece, mat: mats[role] } : piece);
    }
  }
  L.boxes = out.concat(tail);
  // shellCount を持たない旧式 Generator（VerticalGenerator）の出力では undefined のまま（「内装なし」と誤認させない）
  if (L.shellCount !== undefined) L.shellCount = out.length;
  return out.length;
}

/** 発光パネル（LIGHT_MATS）の材質と LightSpec の色を区画ごとに差し替える */
export function recolorLights(L: RoomLayout, zoneAt: (pos: Vec3) => number, lightOf: (zone: number) => { mat: MatId; color: number } | null): void {
  for (let i = 0; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (!LIGHT_MATS.has(b.mat)) continue;
    const zi = zoneAt(centerOf(b));
    const spec = zi >= 0 ? lightOf(zi) : null;
    if (spec && spec.mat !== b.mat) L.boxes[i] = { ...b, mat: spec.mat };
  }
  for (const l of L.lights) {
    const zi = zoneAt(l.pos);
    const spec = zi >= 0 ? lightOf(zi) : null;
    if (spec) l.color = spec.color;
  }
}

/** 決定論的に配列から k 個の相異なるインデックスを選ぶ（順序は昇順） */
export function pickIndices(rng: Rng, n: number, k: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  rng.shuffle(idx);
  return idx.slice(0, Math.min(k, n)).sort((a, b) => a - b);
}
