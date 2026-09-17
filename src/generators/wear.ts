/**
 * 全部屋共通の低確率の破れ（レイアウト側。担当 W）。generateLayout の末尾（Modifier の後）で呼ばれる。
 *
 * 単調さを消す「意味のある少数」: 1 部屋に最大 1 種、対象部屋の WEAR_CHANCE（38%）に何か 1 つ。
 *   flicker         器具 1 本だけが切れかけ（箔を lightYellow = 黄ばんだ管に差し替え、kind 'wear.flicker'。明滅はランタイム側 wearEffects.ts）
 *   lightOff        器具 1 本（同じ器具の管ペア込み）を消灯（lightOff 箔、対応する LightSpec を除く）
 *   ceilingMissing  天井板 1 枚が欠落（格子に揃えた 0.6 m 角の黒い箔を天井直下に。6 割で外れた板が 1 辺から垂れ下がる）
 *   ceilingStain    天井板 1 枚が黄ばむ（0.6 m 角の wainscotCream 箔を天井直下 5 mm に）
 *   signTilt        案内板 1 枚が 2〜4° 傾く（SignSpec に回転が無いので角度だけ記録し、RoomBuilder 後に wearEffects が Mesh を回す）
 *
 * 決定論: 乱数は p.rng.fork('wear') だけ。footprint・ソケット・ソリッド（当たり判定）は変えない（追加する箔はすべて非ソリッド）。
 * スキップ: Mythic / Legendary、LightingPhase 付き（照明演出が競合）、E03 ロール（箔の向きが変わる）、RenderStyle（材質が一律）。
 * 型は RoomLayout の拡張（`WearLayout`）として持つ（layout.ts は編集しない）。
 */
import type { Vec3 } from '../core/types';
import type { Rng } from '../core/rng';
import { box, type Box, type GenParams, type MatId, type RoomLayout, type SignSpec } from './layout';
import { inRect, type Rect } from './footprint';

export type WearKind = 'flicker' | 'lightOff' | 'ceilingMissing' | 'ceilingStain' | 'signTilt';

export interface WearPlan {
  kind: WearKind;
  /** 対象の中心（ローカル。集計・デバッグ用） */
  pos: Vec3;
  /** flicker: 対象の発光箔（L.boxes のインデックス。mat は lightYellow、kind 'wear.flicker'） */
  boxIndex?: number;
  /** flicker: 対応する PointLight（L.lights のインデックス。器具に点光源が無ければ -1） */
  lightIndex?: number;
  /** flicker: 同じ器具に明滅しない管が残る（管ペアの片方）→ 点光源の振幅は半分 */
  shared?: boolean;
  /** signTilt: 対象サイン（L.signs のインデックス）と傾き（度。正 = 面に向かって時計回り） */
  signIndex?: number;
  tiltDeg?: number;
}

/** RoomLayout + 破れの計画。RoomBuilder → wearEffects が読む */
export type WearLayout = RoomLayout & { wear?: WearPlan };

/** 対象部屋に何か 1 つ入る確率。スキップ対象（Mythic / Legendary / LightingPhase）を含めた全体で 3〜4 割になる値 */
export const WEAR_CHANCE = 0.38;
/** 種類の重み（指示の 25 / 15 / 20 / 20 / 10 %。適用できる種類の中で正規化） */
const WEIGHTS: Record<WearKind, number> = { flicker: 25, lightOff: 15, ceilingMissing: 20, ceilingStain: 20, signTilt: 10 };
/** 切れかけにできる箔（白 / 暖色の蛍光灯。lightYellow に差し替えても違和感が無い） */
const FLICKER_MATS: ReadonlySet<string> = new Set(['lightPanel', 'lightWarm']);
/** 消灯できる箔 */
const LIT_MATS: ReadonlySet<string> = new Set(['lightPanel', 'lightWarm', 'lightGreen', 'lightYellow', 'ledBlue']);
/** 天井板がある天井材（コンクリート・塗り天井には板が無い） */
const TILE_CEILINGS: ReadonlySet<string> = new Set(['ceilingTile', 'ceilingWhite']);
const TILE = 0.6;

export function applyWearLayout(L: RoomLayout, p: GenParams): void {
  const rng = p.rng.fork('wear');
  if (wearSkipped(L, p)) return;
  if (!rng.chance(WEAR_CHANCE)) return;
  const plan = planWear(L, rng);
  if (plan) (L as WearLayout).wear = plan;
}

/** 破れの対象外の部屋か（Mythic / Legendary、LightingPhase 付き、E03 ロール、RenderStyle） */
export function wearSkipped(L: RoomLayout, p: GenParams): boolean {
  if (p.def.rarity === 'Mythic' || p.def.rarity === 'Legendary') return true;
  if (p.def.modifiers?.some((m) => m.id === 'LightingPhase')) return true;
  if (L.roll || L.render?.style) return true;
  return false;
}

/** 適用できる種類の一覧（部屋の器具・天井材・サインから） */
export function wearCandidates(L: RoomLayout): WearKind[] {
  const h = L.height;
  const start = L.shellCount ?? 0;
  const fixtures = fixtureIndices(L, start, h);
  const kinds: WearKind[] = [];
  if (fixtures.some((i) => FLICKER_MATS.has(L.boxes[i].mat))) kinds.push('flicker');
  if (fixtures.length) kinds.push('lightOff');
  if (TILE_CEILINGS.has(L.palette.ceiling) && hasCeiling(L, start, h)) kinds.push('ceilingMissing', 'ceilingStain');
  if (tiltableSigns(L).length) kinds.push('signTilt');
  return kinds;
}

/** 破れを 1 つ計画して L に適用する（確率判定の後）。適用できる種類から重み付きで選び、置けなければ（天井板の空きが無いなど）次の候補へ */
export function planWear(L: RoomLayout, rng: Rng): WearPlan | null {
  const h = L.height;
  const start = L.shellCount ?? 0;
  const fixtures = fixtureIndices(L, start, h);
  const flickerable = fixtures.filter((i) => FLICKER_MATS.has(L.boxes[i].mat));
  const signs = tiltableSigns(L);
  let kinds = wearCandidates(L);
  while (kinds.length) {
    const kind = rng.weighted(kinds, (k) => WEIGHTS[k]);
    const plan = kind === 'flicker' ? planFlicker(L, rng, flickerable)
      : kind === 'lightOff' ? planLightOff(L, rng, fixtures)
      : kind === 'signTilt' ? planSignTilt(L, rng, signs)
      : planCeiling(L, rng, kind, h, start);
    if (plan) return plan;
    kinds = kinds.filter((k) => k !== kind);
  }
  return null;
}

// ---------------------------------------------------------------- 器具

/** 頭上の薄い水平の発光箔（トロファー / 露出管 / ダウンライト / 吊り灯の発光面）。壁灯・自販機の前面・天窓帯は除く */
function isFixture(b: Box, h: number): boolean {
  if (b.solid || !LIT_MATS.has(b.mat)) return false;
  const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
  if (sy >= 0.12) return false;
  if (b.min[1] < 1.9 || b.min[1] < h - 1.6) return false;
  const area = sx * sz;
  return Math.min(sx, sz) >= 0.08 && Math.max(sx, sz) <= 1.6 && area >= 0.01 && area <= 1.5;
}

function fixtureIndices(L: RoomLayout, start: number, h: number): number[] {
  const out: number[] = [];
  for (let i = start; i < L.boxes.length; i++) if (isFixture(L.boxes[i], h)) out.push(i);
  return out;
}

function center(b: Box): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

/** 器具の中心に最も近い点光源（水平 0.7 m・高さ 1.2 m 以内）。無ければ -1 */
function nearestLight(L: RoomLayout, c: Vec3): number {
  let best = -1;
  let bestD = 0.7;
  L.lights.forEach((l, i) => {
    const d = Math.hypot(l.pos[0] - c[0], l.pos[2] - c[2]);
    if (d < bestD && Math.abs(l.pos[1] - c[1]) < 1.2) { bestD = d; best = i; }
  });
  return best;
}

/** 同じ器具の他の管（同じ高さで水平 0.3 m 以内の発光箔） */
function siblings(L: RoomLayout, fixtures: number[], i: number): number[] {
  const c = center(L.boxes[i]);
  return fixtures.filter((j) => {
    if (j === i) return false;
    const o = center(L.boxes[j]);
    return Math.abs(o[1] - c[1]) < 0.05 && Math.hypot(o[0] - c[0], o[2] - c[2]) < 0.3;
  });
}

function planFlicker(L: RoomLayout, rng: Rng, candidates: number[]): WearPlan | null {
  // 点光源を持つ器具を優先（壁・床にも明滅が出る）
  const withLight = candidates.filter((i) => nearestLight(L, center(L.boxes[i])) >= 0);
  const pool = withLight.length && rng.chance(0.8) ? withLight : candidates;
  const i = rng.pick(pool);
  const b = L.boxes[i];
  const c = center(b);
  L.boxes[i] = { ...b, mat: 'lightYellow', kind: 'wear.flicker' };
  const shared = siblings(L, candidates, i).length > 0;
  return { kind: 'flicker', pos: c, boxIndex: i, lightIndex: nearestLight(L, c), shared };
}

function planLightOff(L: RoomLayout, rng: Rng, fixtures: number[]): WearPlan | null {
  const i = rng.pick(fixtures);
  const c = center(L.boxes[i]);
  for (const j of [i, ...siblings(L, fixtures, i)]) L.boxes[j] = { ...L.boxes[j], mat: 'lightOff' };
  // 器具の点光源を全て除く（Modifier が同じ位置に重ねた光源も含む）
  L.lights = L.lights.filter((l) => !(Math.hypot(l.pos[0] - c[0], l.pos[2] - c[2]) < 0.7 && Math.abs(l.pos[1] - c[1]) < 1.2));
  return { kind: 'lightOff', pos: c };
}

// ---------------------------------------------------------------- 天井板

function hasCeiling(L: RoomLayout, start: number, h: number): boolean {
  for (let i = 0; i < start; i++) {
    const b = L.boxes[i];
    if (b.solid && b.min[1] >= h - 0.01 && b.max[1] <= h + 0.3) return true;
  }
  return false;
}

function overlapsXZ(b: Box, x0: number, z0: number, x1: number, z1: number, pad: number): boolean {
  return b.min[0] < x1 + pad && b.max[0] > x0 - pad && b.min[2] < z1 + pad && b.max[2] > z0 - pad;
}

/** 天井格子（0.6 m。ローカル座標の倍数）に揃えた 1 枚の板の位置を探す。器具・天井穴・壁際・穴ソケットを避ける */
function pickTile(L: RoomLayout, rng: Rng, h: number, start: number): { x0: number; z0: number; r: Rect } | null {
  const rects = L.footprint.filter((r) => r.x1 - r.x0 >= 2.4 && r.z1 - r.z0 >= 2.4);
  if (!rects.length) return null;
  // 天井付近の内装（器具・トレイ・吊り看板・ダクト）。天井穴は hole ソケットで避ける。
  // 発光する器具からは少なくとも一方の軸で 0.7 m 離す（露出過多のトロファーに隣接するとブルームの滲みで黒い穴・黄ばみが灰色に浮く）
  const ceilingBoxes = L.boxes.filter((b, i) => i >= start && b.max[1] > h - 1.2);
  const lit = ceilingBoxes.filter((b) => LIT_MATS.has(b.mat) || b.mat === 'lightOff');
  const nearLit = (x0: number, z0: number, x1: number, z1: number): boolean => lit.some((b) => {
    const gx = Math.max(b.min[0] - x1, x0 - b.max[0], 0);
    const gz = Math.max(b.min[2] - z1, z0 - b.max[2], 0);
    return Math.max(gx, gz) < 0.7;
  });
  for (let attempt = 0; attempt < 24; attempt++) {
    const r = rng.weighted(rects, (q) => (q.x1 - q.x0) * (q.z1 - q.z0));
    const kx0 = Math.ceil((r.x0 + 0.6) / TILE), kx1 = Math.floor((r.x1 - 0.6) / TILE) - 1;
    const kz0 = Math.ceil((r.z0 + 0.6) / TILE), kz1 = Math.floor((r.z1 - 0.6) / TILE) - 1;
    if (kx1 < kx0 || kz1 < kz0) continue;
    const x0 = rng.int(kx0, kx1) * TILE, z0 = rng.int(kz0, kz1) * TILE;
    const x1 = x0 + TILE, z1 = z0 + TILE;
    if (!inRect(r, x0, z0, 0.5) || !inRect(r, x1, z1, 0.5)) continue;
    if (ceilingBoxes.some((b) => overlapsXZ(b, x0, z0, x1, z1, 0.15))) continue;
    if (nearLit(x0, z0, x1, z1)) continue;
    if (L.sockets.some((s) => s.type === 'hole' && Math.hypot(s.pos[0] - (x0 + x1) / 2, s.pos[2] - (z0 + z1) / 2) < 1.6)) continue;
    return { x0, z0, r };
  }
  return null;
}

function planCeiling(L: RoomLayout, rng: Rng, kind: 'ceilingMissing' | 'ceilingStain', h: number, start: number): WearPlan | null {
  const t = pickTile(L, rng, h, start);
  if (!t) return null;
  const { x0, z0 } = t;
  const x1 = x0 + TILE, z1 = z0 + TILE;
  if (kind === 'ceilingStain') {
    // 板全体の黄ばみ: 天井直下 5 mm に黄褐色の薄い箔（担当 D のシミのデカールとは役割を分ける）
    L.boxes.push(box([x0 + 0.01, h - 0.009, z0 + 0.01], [x1 - 0.01, h - 0.005, z1 - 0.01], 'wainscotCream', false));
    return { kind, pos: [(x0 + x1) / 2, h, (z0 + z1) / 2] };
  }
  // 欠落: 天井面の 6 mm 下に黒い箔（上端は天井スラブの中に埋めて側面を隠す）= 暗い天井裏の穴に見える
  L.boxes.push(box([x0 + 0.01, h - 0.006, z0 + 0.01], [x1 - 0.01, h + 0.05, z1 - 0.01], 'void', false));
  // 外れた板が 1 辺から垂れ下がる（縦の薄板。頭上 1.9 m 以上に収まる部屋だけ）
  if (h - 0.62 >= 1.95 && rng.chance(0.6)) {
    const side = rng.int(0, 3);
    const tileMat: MatId = L.palette.ceiling;
    const y0 = h - 0.61, y1 = h - 0.012;
    switch (side) {
      case 0: L.boxes.push(box([x0 + 0.02, y0, z1 - 0.024], [x1 - 0.02, y1, z1 - 0.012], tileMat, false)); break;
      case 1: L.boxes.push(box([x1 - 0.024, y0, z0 + 0.02], [x1 - 0.012, y1, z1 - 0.02], tileMat, false)); break;
      case 2: L.boxes.push(box([x0 + 0.02, y0, z0 + 0.012], [x1 - 0.02, y1, z0 + 0.024], tileMat, false)); break;
      default: L.boxes.push(box([x0 + 0.012, y0, z0 + 0.02], [x0 + 0.024, y1, z1 - 0.02], tileMat, false)); break;
    }
  }
  return { kind, pos: [(x0 + x1) / 2, h, (z0 + z1) / 2] };
}

// ---------------------------------------------------------------- 案内板

/** 傾けられるサイン: 幅 0.4 m 以上で、吊り下げ板（背面に signPlate の箔がある）ではないもの */
function tiltableSigns(L: RoomLayout): number[] {
  const out: number[] = [];
  (L.signs ?? []).forEach((s: SignSpec, i) => {
    if (s.width < 0.4) return;
    const backed = L.boxes.some((b) => b.mat === 'signPlate' && Math.abs((b.min[1] + b.max[1]) / 2 - s.pos[1]) < 0.3
      && Math.abs((b.min[0] + b.max[0]) / 2 - s.pos[0]) < 0.3 && Math.abs((b.min[2] + b.max[2]) / 2 - s.pos[2]) < 0.3);
    if (!backed) out.push(i);
  });
  return out;
}

function planSignTilt(L: RoomLayout, rng: Rng, signs: number[]): WearPlan | null {
  const i = rng.weighted(signs, (k) => L.signs![k].width);
  const tilt = (rng.chance(0.5) ? 1 : -1) * rng.float(2, 4);
  return { kind: 'signTilt', pos: [...L.signs![i].pos], signIndex: i, tiltDeg: tilt };
}

// ---------------------------------------------------------------- 集計・検証用

/** 破れの計画を読む（無ければ undefined）。RoomBuilder 側（wearEffects）と集計ツールが使う */
export function wearOf(L: RoomLayout): WearPlan | undefined {
  return (L as WearLayout).wear;
}
