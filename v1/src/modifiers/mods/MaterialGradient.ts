/**
 * MaterialGradient — 進行軸に沿って 2 材質をブレンド（R15 絨毯化する設備通路）。
 * params: from / to（テクスチャ族名 'concrete' | 'carpet' | ... または MatId）、axis('forward' | 'x' | '-x' | 'z' | '-z' | [x, y, z])、
 *         lightFrom / lightTo（照明色の遷移。省略時は 冷白 0xe9f0ff → palette.lightColor）。
 *
 * layout フックで
 *   - L.path が無ければ footprint（廊下のセグメント矩形列）と entry / end ソケットから進行軸の折れ線を作って L.path に置く
 *     （TemperatureField / VehicleRide など他 Modifier の共有情報。'forward' 軸はこの path の始点→終点方向）
 *   - L.render.gradient = { from, to, axis } を設定する。RoomBuilder が bounds を axis に投影した range を付けて
 *     MaterialLibrary.variant の gradient 族に渡し、材質側で t = (dot(pos, axis) - range0) / (range1 - range0) に沿って
 *     diffuse を from の色 → to の色の比で連続的にブレンドする（部屋の全材質に同じ比が掛かるので「コンクリ→絨毯」の色味に寄る）
 *   - 照明の遷移: 発光パネル箔は t < 0.5 で lightPanel、t ≥ 0.5 で lightWarm（bakedLight も追従）。PointLight の色は t で lerp
 *   - 天井配管（非ソリッドの 'metal' 箔）は t > 0.6 の区間で取り除く（設備通路 → ホテル側で配管が消える）
 * onConnect フックで、部屋の奥側（t ≥ 0.5）の扉には prefer: ['room']（部屋型を優先 = ホテル系への接続確率増の拡張点）。
 * ジオメトリ寸法・ソケット・コライダは変えない（配管は非ソリッドのみ削除）。
 */
import type { Vec3 } from '../../core/types';
import type { AABB } from '../../core/aabb';
import type { MatId, RoomLayout } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { num, str, progressAxis } from '../util';

/** テクスチャ族名 → 代表 MatId（gradient の色の基準） */
const FAMILY_MAT: Record<string, MatId> = {
  concrete: 'floorConcrete',
  carpet: 'floorCarpetRed',
  carpetred: 'floorCarpetRed',
  carpetgrey: 'floorCarpetGrey',
  wood: 'floorWood',
  tile: 'floorTile',
  lino: 'floorLino',
  linoleum: 'floorLino',
  wallpaper: 'wallBeige',
  beige: 'wallBeige',
  cream: 'wallCream',
  white: 'wallWhite',
  dark: 'wallDark',
  green: 'wallGreen',
  metal: 'metal',
  asphalt: 'floorAsphalt',
  brick: 'wallBrick',
  ice: 'ice',
  snow: 'snow',
  grass: 'grass',
};

const MAT_IDS = new Set<string>([
  'floorCarpetRed', 'floorCarpetGrey', 'floorLino', 'floorConcrete', 'floorTile', 'floorWood',
  'wallBeige', 'wallWhite', 'wallCream', 'wallConcrete', 'wallGreen', 'wallDark',
  'ceilingWhite', 'ceilingDark', 'ceilingTile', 'doorWood', 'doorMetal', 'trim', 'glass', 'lightPanel', 'lightWarm', 'lightOff', 'ledBlue',
  'columnConcrete', 'furnitureDark', 'furnitureLight', 'metal', 'yellowLine', 'placeholder', 'void',
  'shelfMetal', 'boxCardboard', 'plant', 'water', 'carPaint', 'carGlass', 'rubber', 'upholstery',
  'lightGreen', 'lightYellow', 'screenGlow', 'skyOvercast', 'skyDusk', 'skyNoon', 'waterShallow', 'waterWall', 'waterFilm', 'outsideView', 'shadowDecal', 'untextured',
  'floorAsphalt', 'wallBrick', 'windowLit', 'windowDark', 'sodiumLight', 'signPlate', 'signEmissive', 'ice', 'snow', 'grass',
]);

/** 族名 / MatId → MatId。不明なら fallback */
export function gradientMatOf(v: unknown, fallback: MatId): MatId {
  const s = str(v, '').trim();
  if (!s) return fallback;
  if (MAT_IDS.has(s)) return s as MatId;
  return FAMILY_MAT[s.toLowerCase()] ?? fallback;
}

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n > 1e-6 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 1];
}

/** 連続セグメント矩形の接触部（共有辺 / 交差）の中心 = 曲がり角。離れていれば null。
 *  廊下のセグメントは辺で接する（交差しない）ので、接触は許容誤差付きで判定する */
function overlapCenter(a: { x0: number; z0: number; x1: number; z1: number }, b: { x0: number; z0: number; x1: number; z1: number }): Vec3 | null {
  const eps = 1e-3;
  const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1);
  const z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
  if (x1 < x0 - eps || z1 < z0 - eps) return null;
  if (x1 - x0 < eps && z1 - z0 < eps) return null; // 点接触は曲がり角にならない
  return [(x0 + x1) / 2, 0, (z0 + z1) / 2];
}

/** 進行軸の折れ線: entry → セグメント矩形の曲がり角 → 進行用出口（'end' が無ければ最初の非 entry 扉） */
export function buildProgressPath(L: RoomLayout): Vec3[] | null {
  const entry = L.sockets.find((s) => s.id === 'entry');
  const end = L.sockets.find((s) => s.id === 'end') ?? L.sockets.find((s) => s.id !== 'entry' && s.type !== 'hole');
  if (!entry || !end) {
    const ax = progressAxis(L);
    return ax ? [ax.from, ax.to] : null;
  }
  const pts: Vec3[] = [[entry.pos[0], 0, entry.pos[2]]];
  for (let i = 1; i < L.footprint.length; i++) {
    const c = overlapCenter(L.footprint[i - 1], L.footprint[i]);
    if (c) pts.push(c);
  }
  pts.push([end.pos[0], 0, end.pos[2]]);
  return pts;
}

/** params.axis → 単位ベクトル（ローカル）。'forward' は path の始点→終点（水平） */
export function gradientAxisOf(axisParam: unknown, path: Vec3[] | null): Vec3 {
  if (Array.isArray(axisParam) && axisParam.length === 3 && axisParam.every((v) => typeof v === 'number')) {
    return normalize([axisParam[0], axisParam[1], axisParam[2]]);
  }
  const s = str(axisParam, 'forward').toLowerCase();
  switch (s) {
    case 'x': return [1, 0, 0];
    case '-x': return [-1, 0, 0];
    case 'z': return [0, 0, 1];
    case '-z': return [0, 0, -1];
    case 'y': return [0, 1, 0];
    default: {
      if (path && path.length >= 2) {
        const a = path[0], b = path[path.length - 1];
        const d: Vec3 = [b[0] - a[0], 0, b[2] - a[2]];
        if (Math.hypot(d[0], d[2]) > 0.5) return normalize(d);
      }
      return [0, 0, 1];
    }
  }
}

/** RoomBuilder.projectRange と同じ: bounds の 8 頂点を axis に投影した範囲 */
export function projectRange(bounds: AABB, axis: Vec3): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const d = x * axis[0] + y * axis[1] + z * axis[2];
    lo = Math.min(lo, d); hi = Math.max(hi, d);
  }
  return [lo, hi];
}

/** ローカル位置の進行度 t（0..1） */
export function gradientT(pos: Vec3, axis: Vec3, range: [number, number]): number {
  const d = pos[0] * axis[0] + pos[1] * axis[1] + pos[2] * axis[2];
  return Math.max(0, Math.min(1, (d - range[0]) / Math.max(0.001, range[1] - range[0])));
}

function lerpColor(a: number, b: number, t: number): number {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const COOL_WHITE = 0xe9f0ff;
const WARM = 0xffd9a0;

const MaterialGradient: ModifierImpl = {
  id: 'MaterialGradient',
  defaults: { from: 'concrete', to: 'carpet', axis: 'forward' },
  layout(L, _p, params) {
    const from = gradientMatOf(params.from, 'floorConcrete');
    const to = gradientMatOf(params.to, 'floorCarpetRed');
    // 進行軸（他 Modifier と共有）
    if (!L.path || L.path.length < 2) {
      const path = buildProgressPath(L);
      if (path) L.path = path;
    }
    const axis = gradientAxisOf(params.axis, L.path ?? null);
    L.render = { ...(L.render ?? {}), gradient: { from, to, axis } };

    const range = projectRange(L.bounds, axis);
    const tOf = (pos: Vec3) => gradientT(pos, axis, range);

    // 照明の遷移: 冷白 → 暖色（palette が暖色ならその色へ）
    const lightFrom = num(params.lightFrom, COOL_WHITE);
    const lightTo = num(params.lightTo, L.palette.light === 'lightWarm' ? L.palette.lightColor : WARM);
    for (const l of L.lights) l.color = lerpColor(lightFrom, lightTo, tOf(l.pos));

    // 内装（シェル以降）: パネル灯の MatId を閾値 0.5 で切替、天井配管（非ソリッド metal）は t > 0.6 で撤去
    const shell = L.shellCount ?? 0;
    const kept = L.boxes.slice(0, shell);
    for (const b of L.boxes.slice(shell)) {
      const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
      const t = tOf(c);
      if (b.mat === 'lightPanel' || b.mat === 'lightWarm') {
        b.mat = t < 0.5 ? 'lightPanel' : 'lightWarm';
      } else if (b.mat === 'metal' && !b.solid && b.min[1] > L.height - 0.6 && t > 0.6) {
        continue; // 配管を間引く
      }
      kept.push(b);
    }
    L.boxes = kept;
    L.palette = { ...L.palette, lightColor: lightTo };
  },
  onConnect(ctx) {
    // 部屋の奥側 50% の扉は部屋型（ホテル系）を優先する拡張点
    const L = ctx.world.layoutFor(ctx.node);
    const g = L.render?.gradient;
    if (!g || ctx.portal.isReturn) return;
    const axis = normalize(g.axis);
    const t = gradientT(ctx.socket.pos, axis, projectRange(L.bounds, axis));
    if (t >= 0.5) return { prefer: ['room'] };
  },
};

export default MaterialGradient;
