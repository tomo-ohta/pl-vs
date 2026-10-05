/**
 * 区画（CellLayout）の箱から「小物」を選び、描画用の区画の写しを作る。
 *
 * - 小物は v2 の中身（core/gen/dress）が propGroup を付けた家具・設備。種類は propGroup の id（`<区画>/<種類>@<位置>`）から読む
 * - 透明な箱（ガラス・水）と見えない当たり判定（colliderOnly）はスプラットにしない（ガラスは v2 のメッシュのまま残す）
 * - 柱・飾りの扉・非常口の表示・異変や仕掛けの部品は小物として扱わない（構造・演出なので v2 のまま）
 *
 * 写しでは小物の箱に「この検証専用の revealGroup」を付ける。v2 の FloorBuilder はそれを小物ごと・材質ごとの
 * 別のメッシュにして最初は隠すので、
 *   1. 部屋（床・壁・天井・それ以外の箱）は v2 と同じメッシュのまま描かれる
 *   2. 焼き込み陰影・ライトマップの遮蔽には小物がそのまま入る（床に落ちる小物の陰は v2 と同じ）
 *   3. 小物のメッシュは隠れた状態で手に入る（色を写し取る元・見比べ用）
 * 当たり判定（シミュレーション）は元の区画を使うので、この写しの影響を受けない。
 */
import type { Box, CellLayout, MatId } from '../../../v2/core/world/layout.ts';
import { SURFACES } from '../../../v2/client/render/MaterialLibrary.ts';

/** v2 の中身が作る家具・設備の種類（propGroup の id の種類の部分） */
export const PROP_TYPES: ReadonlySet<string> = new Set([
  'desk', 'chair', 'table', 'sofa', 'cabinet', 'fridge', 'kitchen', 'waterCooler', 'copier', 'bed', 'examBed', 'arcade',
  'shelf', 'plant', 'planter', 'bin', 'plinth', 'reception', 'counter', 'pallet', 'crate', 'cone', 'softBlock',
  'serverRack', 'seatRow', 'startBlock', 'lifeguard', 'lifeguardChair', 'cooler', 'vitrine', 'lockers', 'bench',
  'linkedSeats', 'vending', 'rollCage', 'urinal', 'washer', 'dryer', 'booths', 'sinks', 'rack', 'rug',
]);

/** この検証が付ける revealGroup の接頭辞 */
export const GROUP_PREFIX = 'splatprop:';

/** propGroup（`<区画>#<区域>/<印>-<種類>@<位置>:m` など）から種類を読む */
export function propTypeOf(group: string): string {
  let t = group.slice(group.lastIndexOf('/') + 1);
  t = t.split('@')[0]!.replace(/^([a-z0-9]+-)+/i, '');
  if (t.includes('.')) t = t.slice(t.lastIndexOf('.') + 1);
  return t;
}

/** スプラットにしない材質（透明・水・見えない物） */
export function keepAsMesh(mat: MatId): boolean {
  const s = SURFACES[mat];
  if (!s) return true;
  if (mat === 'void' || mat === 'shadowDecal' || mat === 'puddle') return true;
  return (s.opacity !== undefined && s.opacity < 1) || !!s.glass || !!s.water;
}

export interface PropInfo {
  /** この検証での小物の番号（revealGroup = GROUP_PREFIX + index） */
  index: number;
  group: string;
  type: string;
  /** スプラットにする箱（フロア座標。写しに入れた物と同じ並び） */
  boxes: Box[];
}

export interface SplitCell {
  /** 描画用の写し（小物の箱に revealGroup を付けた物） */
  cell: CellLayout;
  props: PropInfo[];
}

/** 区画から小物を選び、描画用の写しを作る（小物が無ければ props は空で、cell は元のまま） */
export function splitCell(cell: CellLayout): SplitCell {
  const groups = new Map<string, Box[]>();
  for (const b of cell.boxes) {
    if (!b.propGroup || b.kind === 'colliderOnly' || b.kind === 'emitOnly') continue;
    const list = groups.get(b.propGroup);
    if (list) list.push(b);
    else groups.set(b.propGroup, [b]);
  }
  const props: PropInfo[] = [];
  const tag = new Map<Box, string>();
  for (const [group, boxes] of groups) {
    const type = propTypeOf(group);
    if (!PROP_TYPES.has(type)) continue;
    // 出現型の隠し・傾けた箱・模様の写しを含む物は v2 の扱いが特別なので触らない
    if (boxes.some((b) => b.revealGroup || b.concealGroup || b.slope || b.uvFrame || b.kind?.startsWith('lamp:'))) continue;
    const solid = boxes.filter((b) => !keepAsMesh(b.mat) && b.max[0] - b.min[0] > 1e-4 && b.max[1] - b.min[1] > 1e-4 && b.max[2] - b.min[2] > 1e-4);
    if (!solid.length) continue;
    const index = props.length;
    props.push({ index, group, type, boxes: solid });
    for (const b of solid) tag.set(b, GROUP_PREFIX + index);
  }
  if (!props.length) return { cell, props };
  const boxes = cell.boxes.map((b) => {
    const g = tag.get(b);
    return g ? { ...b, revealGroup: g } : b;
  });
  return { cell: { ...cell, boxes }, props };
}
