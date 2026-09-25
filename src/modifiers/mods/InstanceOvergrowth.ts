/**
 * InstanceOvergrowth — 植生の反復配置（R07 地下温室 0.7 blocksPath / L14 温室都市 0.9 blocksPath / L03 倉庫内麦畑 wheat 1.0）。
 * params: density（内側面積 1 m² あたりの株数係数）, blocksPath（solid な生垣を作る）, propId（'wheat' | 既定 'foliage'）。
 *
 * layout フックだけで完結する決定論の post-pass:
 *  - 密度場: 内側を 0.5 m セルに切り、density × ソケットからの距離減衰（1.8 m 以内 0、6.3 m で 1.0）× 壁際ブースト × rng ノイズ。
 *    「出口方向ほど疎」（R07 の接続ルール）が自動で成立する。
 *  - 通路: ソケット前 ±1.6 m と入口→各出口の直線帯（植生 1.4 m / 麦 2.0 m = 農道）にはインスタンスも生垣も置かない。
 *  - 小片（葉の塊 'plant'、下草 'grass'、麦の茎 + 穂）は L.instances（InstancedMesh、非 solid）。
 *    麦は株 = mat 'wheat'（茎 9 本・葉・穂・芒を描いた切り抜きの板 3 枚の交差、風で揺れる。src/render/Wheat.ts。1 株 12 三角形）。
 *    旧: 茎 = plasticYellow の薄い箔 + 穂の小箱（箱の柱が並んで麦に見えなかった）。他の propId（foliage）の草は変えない。
 *    RoomBuilder が tier.instanceScale で等間隔に間引くので transforms はシャッフル済み。
 *  - 大きな植栽ユニット（生垣の株・プランター）は solid な 'plant' 箱（RoomBuilder が球体に描く）。数と位置は Tier に依らない。
 *  - 麦畑（L03）は既存家具を捨て、畑の区画（農道の格子の間の低い草の箔）の中だけを区画の辺に揃えた格子で株で埋める（第22回。旧: 床全体を斜めの帯からの距離で間引き、
 *    三角・菱形の畑になっていた）。間隔は 0.42 m を基本に、入口から遠い区画ほど粗く（上限 MAX_WHEAT 株に収まるまで）
 *    区画の縁 0.6 m の株は背丈を低く（踏み分けの段）。Tier の間引き（RoomBuilder）は従来どおり。
 */
import type { Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { rect, rectArea, type Rect } from '../../generators/footprint';
import { box, type Box, type InstanceSpec, type RoomLayout } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { bool, num, str } from '../util';
import {
  boxBlocked, clamp, clearanceOf, innerRect, interiorBoxesOf, isFurniture, overlapsSolid, pointBlocked, pointInBoxXZ, pushInstances, removeInterior, type Clearance,
} from './PropRepetition.shared';

/** 1 spec あたりのインスタンス上限（巨大 footprint での暴走防止。Tier 間引きはこの後で RoomBuilder が行う） */
const MAX_PER_SPEC = 9000;
/** 麦の株の上限。株 = 板 3 枚 12 三角形（36,000 株で 43 万三角形）。畑全体に行き渡らせるため間隔を面積から決める */
const MAX_WHEAT = 36000;
const CELL = 0.5;

const InstanceOvergrowth: ModifierImpl = {
  id: 'InstanceOvergrowth',
  defaults: { density: 0.7, blocksPath: false, propId: 'foliage' },
  layout(L, _p, params, rng) {
    const density = clamp(num(params.density, 0.7), 0, 2.5);
    const blocksPath = bool(params.blocksPath, false);
    const propId = str(params.propId, 'foliage');
    if (density <= 0) return;
    if (propId === 'wheat') layoutWheat(L, density, rng);
    else layoutFoliage(L, density, blocksPath, rng);
  },
};

export default InstanceOvergrowth;

// ---------------------------------------------------------------- 共通

/** 最も近い壁面ソケット（hole 以外）までの 2D 距離 */
function socketDistance(L: RoomLayout, x: number, z: number): number {
  let d = Infinity;
  for (const s of L.sockets) {
    if (s.type === 'hole') continue;
    d = Math.min(d, Math.hypot(s.pos[0] - x, s.pos[2] - z));
  }
  return d;
}

/** 矩形の縁（壁）までの距離 */
function edgeDistance(r: Rect, x: number, z: number): number {
  return Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
}

/** セルの床面: 上に低い箱があればその天面（棚・島の上に載せる）。高い箱・柱の中なら null */
function floorAt(solids: Box[], x: number, z: number): number | null {
  let y = 0;
  for (const b of solids) {
    if (!pointInBoxXZ(b, x, z)) continue;
    if (b.mat === 'columnConcrete' || b.mat.startsWith('wall')) return null;
    const top = b.max[1];
    if (top > 1.35) return null;
    y = Math.max(y, top);
  }
  return y;
}

// ---------------------------------------------------------------- 植生（R07 / L14）

function layoutFoliage(L: RoomLayout, density: number, blocksPath: boolean, rng: Rng): void {
  const c = clearanceOf(L, 0.7);
  const area = L.footprint.reduce((a, r) => a + rectArea(r), 0);

  // (1) 生垣（blocksPath）: 主矩形を横切る solid な株の列。1.4 m の抜け道 + 通路帯は必ず空く
  const hedgeBoxes: Box[] = [];
  if (blocksPath && L.footprint.length > 0) {
    const r = L.footprint[0];
    const ir = innerRect(r, 0.6);
    const count = area > 150 ? 3 : 2;
    const alongX = rng.chance(0.5);
    for (let i = 1; i <= count; i++) {
      const span = alongX ? ir.z1 - ir.z0 : ir.x1 - ir.x0;
      if (span < 6) break;
      const t = (alongX ? ir.z0 : ir.x0) + (span * i) / (count + 1) + rng.float(-0.8, 0.8);
      const a0 = alongX ? ir.x0 : ir.z0;
      const a1 = alongX ? ir.x1 : ir.z1;
      if (a1 - a0 < 4) continue;
      const gapAt = rng.float(a0 + 1.5, a1 - 1.5);
      const height = rng.float(1.6, 2.2);
      for (let a = a0 + 0.35; a + 0.35 <= a1; a += 0.62) {
        if (Math.abs(a - gapAt) < 0.7 + 0.35) continue; // 抜け道 1.4 m
        const hh = clamp(height + rng.float(-0.15, 0.15), 1.2, L.height - 0.3);
        const half = 0.36;
        const min: Vec3 = alongX ? [a - half, 0, t - half] : [t - half, 0, a - half];
        const max: Vec3 = alongX ? [a + half, hh, t + half] : [t + half, hh, a + half];
        const b = box(min, max, 'plant');
        if (boxBlocked(c, b, 0.1) || overlapsSolid(L, b)) continue;
        L.boxes.push(b);
        hedgeBoxes.push(b);
      }
    }
  }

  // (2) 大きな植栽ユニット（プランター）: solid な 'plant' 箱を面積に応じて散らす
  const planters = Math.round((area / 55) * density);
  for (let i = 0, tries = 0; i < planters && tries < planters * 6; tries++) {
    const r = rng.pick(L.footprint);
    const ir = innerRect(r, 0.8);
    if (ir.x1 - ir.x0 < 2 || ir.z1 - ir.z0 < 2) continue;
    const w = rng.float(0.9, 1.6);
    const d = rng.float(0.9, 1.6);
    const hgt = rng.float(1.0, Math.min(2.2, L.height - 0.5));
    const x = rng.float(ir.x0 + w / 2, ir.x1 - w / 2);
    const z = rng.float(ir.z0 + d / 2, ir.z1 - d / 2);
    const b = box([x - w / 2, 0, z - d / 2], [x + w / 2, hgt, z + d / 2], 'plant');
    if (boxBlocked(c, b, 0.2) || overlapsSolid(L, b)) continue;
    L.boxes.push(b);
    i++;
  }

  // (3) 密度場 → 小片インスタンス（葉の塊 + 下草）
  const solids = interiorBoxesOf(L).filter((b) => b.solid);
  const foliage: InstanceSpec = { mat: 'plant', size: [0.55, 0.5, 0.55], transforms: [], solid: false };
  const grass: InstanceSpec = { mat: 'grass', size: [0.35, 0.22, 0.35], transforms: [], solid: false };
  for (const r of L.footprint) {
    const ir = innerRect(r, 0.15);
    for (let x = ir.x0 + CELL / 2; x < ir.x1; x += CELL) {
      for (let z = ir.z0 + CELL / 2; z < ir.z1; z += CELL) {
        const noise = rng.float(0.5, 1.5); // セルごとに 1 回消費（配置の有無で乱数列がずれない）
        if (foliage.transforms.length >= MAX_PER_SPEC) continue;
        if (pointBlocked(c, x, z, 0.15)) continue;
        const y = floorAt(solids, x, z);
        if (y === null) continue;
        const ds = socketDistance(L, x, z);
        const falloff = ds < 1.8 ? 0 : Math.min(1, 0.15 + (0.85 * (ds - 1.8)) / 4.5);
        if (falloff <= 0) continue;
        const wallBoost = edgeDistance(r, x, z) < 0.9 ? 1.6 : 1.0;
        const onTop = y > 0.05 ? 0.7 : 1.0;
        const expected = density * CELL * CELL * falloff * wallBoost * onTop * noise;
        // 葉の塊
        let n = Math.floor(expected);
        if (rng.chance(expected - n)) n++;
        n = Math.min(n, 2);
        for (let k = 0; k < n; k++) {
          const px = x + rng.float(-0.2, 0.2);
          const pz = z + rng.float(-0.2, 0.2);
          if (pointBlocked(c, px, pz, 0.05)) continue;
          foliage.transforms.push({ pos: [px, y - (y > 0.05 ? 0.12 : 0), pz], yaw: rng.float(0, Math.PI * 2), scale: rng.float(0.6, 1.35) });
        }
        // 下草（床のみ。葉より多め）
        if (y < 0.05) {
          const eg = expected * 1.5;
          let m = Math.floor(eg);
          if (rng.chance(eg - m)) m++;
          m = Math.min(m, 2);
          for (let k = 0; k < m; k++) {
            const px = x + rng.float(-0.22, 0.22);
            const pz = z + rng.float(-0.22, 0.22);
            if (pointBlocked(c, px, pz, 0.05)) continue;
            grass.transforms.push({ pos: [px, 0, pz], yaw: rng.float(0, Math.PI * 2), scale: rng.float(0.7, 1.3) });
          }
        }
      }
    }
  }
  // 生垣の上にも葉を重ねる（見た目の連続感。当たり判定は株の箱）
  for (const hb of hedgeBoxes) {
    if (foliage.transforms.length >= MAX_PER_SPEC) break;
    const cx = (hb.min[0] + hb.max[0]) / 2;
    const cz = (hb.min[2] + hb.max[2]) / 2;
    foliage.transforms.push({ pos: [cx + rng.float(-0.15, 0.15), hb.max[1] - 0.3, cz + rng.float(-0.15, 0.15)], yaw: rng.float(0, Math.PI * 2), scale: rng.float(0.8, 1.2) });
  }
  pushInstances(L, rng, foliage);
  pushInstances(L, rng, grass);
}

// ---------------------------------------------------------------- 麦畑（L03）

function layoutWheat(L: RoomLayout, density: number, rng: Rng): void {
  // 倉庫の家具は捨てる（柱・壁・照明は残す）
  removeInterior(L, (b) => isFurniture(b));
  const c: Clearance = clearanceOf(L, 1.0); // 農道 2 m（木箱の目印の置き場の判定だけに使う）
  const solids = interiorBoxesOf(L).filter((b) => b.solid);
  // 第22回: 株は畑の区画（生成器が農道の格子の間に敷く低い草の箔 = L03 では黄土色）の中だけに、区画の辺に揃えた格子で植える。
  // 以前は床全体の格子を「入口 → 出口の斜めの帯」からの距離で間引いていたので、斜めの帯に沿った三角・菱形の麦畑になり、
  // 農道や区画の四角を無視していた。区画が無い部屋は床の矩形（壁から 2.5 m 内側）を 1 区画とする
  const plots = L.boxes.filter((b) => !b.solid && (b.mat === 'grass' || b.mat === 'yellowLine') && b.max[1] <= 0.3 && b.min[1] < 0.05
    && (b.max[0] - b.min[0]) >= 3 && (b.max[2] - b.min[2]) >= 3).map((b) => rect(b.min[0], b.min[2], b.max[0], b.max[2]));
  if (!plots.length) for (const r of L.footprint) { const ir = innerRect(r, 2.5); if (ir.x1 - ir.x0 >= 3 && ir.z1 - ir.z0 >= 3) plots.push(ir); }
  const entry = L.sockets.find((s) => s.id === 'entry') ?? L.sockets[0];
  const ex = entry?.pos[0] ?? 0, ez = entry?.pos[2] ?? 0;
  const basePitch = 0.42 / Math.sqrt(clamp(density, 0.2, 2.5));
  // 区画ごとの間隔: 入口に近い区画は basePitch、遠い区画ほど粗く（区画の中は一様。境目は農道なので段差が見えない）。
  // 株の総数が MAX_WHEAT に収まる near を二分探索で決める（粗い区画は株を大きくして隙間を埋める）
  const info = plots.map((r) => {
    const d = Math.hypot(clamp(ex, r.x0, r.x1) - ex, clamp(ez, r.z0, r.z1) - ez);
    return { r, d, area: Math.max(0, r.x1 - r.x0 - 0.6) * Math.max(0, r.z1 - r.z0 - 0.6) };
  }).sort((p1, p2) => p1.d - p2.d);
  const MAX_COARSE = 1.9;
  const pitchOf = (d: number, near: number) => basePitch * clamp(Math.sqrt(Math.max(d, 1) / near), 1, MAX_COARSE);
  const expected = (near: number) => info.reduce((acc, q) => acc + q.area / pitchOf(q.d, near) ** 2, 0);
  let near = 400;
  if (expected(near) > MAX_WHEAT) {
    let lo = 0.5, hi = 400;
    for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (expected(m) > MAX_WHEAT) hi = m; else lo = m; }
    near = lo;
  }
  const clumps: InstanceSpec = { mat: 'wheat', size: [0.62, 1.05, 0.62], transforms: [], solid: false };
  for (const q of info) {
    const pitch = pitchOf(q.d, near);
    const grow = Math.min(1.45, pitch / basePitch);
    const { r } = q;
    // 区画の縁から 0.3 m 内側（縁は ±0.12 m 揺らして定規で引いた線に見せない）
    const nx = Math.max(1, Math.floor((r.x1 - r.x0 - 0.6) / pitch)), nz = Math.max(1, Math.floor((r.z1 - r.z0 - 0.6) / pitch));
    const x0 = (r.x0 + r.x1) / 2 - ((nx - 1) * pitch) / 2, z0 = (r.z0 + r.z1) / 2 - ((nz - 1) * pitch) / 2;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const jx = rng.float(-0.3, 0.3) * pitch;
      const jz = rng.float(-0.3, 0.3) * pitch;
      const sc = rng.float(0.82, 1.18);
      const yaw = rng.float(0, Math.PI * 2);
      const ragged = rng.float(-0.12, 0.12);
      if (clumps.transforms.length >= MAX_WHEAT) break;
      const x = x0 + i * pitch + jx, z = z0 + j * pitch + jz;
      const edge = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
      if (edge < 0.3 + ragged) continue;
      if (socketDistance(L, x, z) < 2.2) continue;
      if (solids.some((b) => pointInBoxXZ(b, x, z, 0.1))) continue;
      // 区画の縁 0.6 m は背丈を少し低く（踏み分けの段）
      const edgeScale = edge < 0.9 ? 0.78 + 0.22 * clamp((edge - 0.3) / 0.6, 0, 1) : 1;
      clumps.transforms.push({ pos: [x, 0, z], yaw, scale: sc * grow * edgeScale });
    }
  }
  pushInstances(L, rng, clumps);
  // 農道の交差点に目印（solid な木箱 = 倉庫の名残り）: 各出口の帯の外側に 1 つずつ
  for (const s of L.sockets) {
    if (s.type === 'hole' || s.id === 'entry') continue;
    const inward = s.dir === 0 ? [0, -1] : s.dir === 1 ? [-1, 0] : s.dir === 2 ? [0, 1] : [1, 0];
    const side = s.dir === 0 || s.dir === 2 ? [1, 0] : [0, 1];
    const cx = s.pos[0] + inward[0] * 3.2 + side[0] * 2.2;
    const cz = s.pos[2] + inward[1] * 3.2 + side[1] * 2.2;
    const b = box([cx - 0.5, 0, cz - 0.5], [cx + 0.5, 0.9, cz + 0.5], 'boxCardboard');
    if (!L.footprint.some((r) => cx > r.x0 + 0.8 && cx < r.x1 - 0.8 && cz > r.z0 + 0.8 && cz < r.z1 - 0.8)) continue;
    if (boxBlocked(c, b, 0.1) || overlapsSolid(L, b)) continue;
    L.boxes.push(b);
  }
}
