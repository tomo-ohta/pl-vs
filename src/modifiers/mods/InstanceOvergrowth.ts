/**
 * InstanceOvergrowth — 植生の反復配置（R07 地下温室 0.7 blocksPath / L14 温室都市 0.9 blocksPath / L03 倉庫内麦畑 wheat 1.0）。
 * params: density（内側面積 1 m² あたりの株数係数）, blocksPath（solid な生垣を作る）, propId（'wheat' | 既定 'foliage'）。
 *
 * layout フックだけで完結する決定論の post-pass:
 *  - 密度場: 内側を 0.5 m セルに切り、density × ソケットからの距離減衰（1.8 m 以内 0、6.3 m で 1.0）× 壁際ブースト × rng ノイズ。
 *    「出口方向ほど疎」（R07 の接続ルール）が自動で成立する。
 *  - 通路: ソケット前 ±1.6 m と入口→各出口の直線帯（植生 1.4 m / 麦 2.0 m = 農道）にはインスタンスも生垣も置かない。
 *  - 小片（葉の塊 'plant'、下草 'grass'、麦の茎 + 穂）は L.instances（InstancedMesh、非 solid）。
 *    麦は茎 = plasticYellow の薄い箔（幅 0.14 m × 高 1.05 m × 厚 0.04 m、yaw ランダム）、穂 = plasticYellow の小箱。遠目に「黄金色の面」として
 *    読ませるため（legendary.ts dressL03 が地面を yellowLine、高所灯を lightWarm にしている）。緑の 'grass' 茎（132 三角形 / 本）から
 *    箱（12 三角形 / 本）に変えたので三角形は 9,000 本で 1.2M → 0.16M に減る。他の propId（foliage）の草は変えない。
 *    RoomBuilder が tier.instanceScale で等間隔に間引くので transforms はシャッフル済み。
 *  - 大きな植栽ユニット（生垣の株・プランター）は solid な 'plant' 箱（RoomBuilder が球体に描く）。数と位置は Tier に依らない。
 *  - 麦畑（L03）は既存家具を捨てて全面を茎で埋め、農道（直線帯）を空ける。間隔は 0.35 m を基本に、上限 MAX_WHEAT 本で畑全体が埋まる値まで広げる
 *    （巨大な倉庫で最初の帯だけが埋まらないように）。Tier の間引き（RoomBuilder）と rng の消費順（セルごと 4 回）は従来どおり。
 */
import type { Vec3 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { rectArea, type Rect } from '../../generators/footprint';
import { box, type Box, type InstanceSpec, type RoomLayout } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { bool, num, str } from '../util';
import {
  boxBlocked, clamp, clearanceOf, innerRect, interiorBoxesOf, isFurniture, overlapsSolid, pointBlocked, pointInBoxXZ, pushInstances, removeInterior, type Clearance,
} from './PropRepetition.shared';

/** 1 spec あたりのインスタンス上限（巨大 footprint での暴走防止。Tier 間引きはこの後で RoomBuilder が行う） */
const MAX_PER_SPEC = 9000;
/** 麦の茎の上限。箱 12 三角形 / 本なので 9,000 本の草（132 三角形 / 本 = 1.2M）より少ない三角形で 3 倍以上置ける。畑全体に行き渡らせるため間隔を面積から決める */
const MAX_WHEAT = 30000;
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
  const c: Clearance = clearanceOf(L, 1.0); // 農道 2 m
  const solids = interiorBoxesOf(L).filter((b) => b.solid);
  // 間隔: 既定 0.35 m。巨大な倉庫（seed 7 の L03 は 197 × 113 m）では上限 MAX_WHEAT 本で畑全体を埋める間隔まで広げる
  // （以前は 9,000 本で最初の 10 m 幅の帯だけが埋まり、入口からは畑が見えなかった）
  const area = L.footprint.reduce((a, r) => a + rectArea(innerRect(r, 0.35)), 0);
  const pitch = Math.max(0.35 / Math.sqrt(clamp(density, 0.2, 2.5)), Math.sqrt((area * 1.02) / MAX_WHEAT));
  // 茎: 黄金色の薄い箔（yaw ランダムなので遠目には面として重なる。間隔が広いときは幅 0.16 m）。穂: 少し幅広の小箱を茎の上端に載せる
  const stalkW = pitch > 0.4 ? 0.16 : 0.14;
  const stalks: InstanceSpec = { mat: 'plasticYellow', size: [stalkW, 1.05, 0.04], transforms: [], solid: false };
  const heads: InstanceSpec = { mat: 'plasticYellow', size: [0.12, 0.16, 0.09], transforms: [], solid: false };
  const headEvery = pitch > 0.5 ? 1 : 2; // 疎な畑では全ての茎に穂（目線の高さの黄色を増やす）
  // 農道の縁（土手）: 直線帯の両側に低い solid 'furnitureDark' の畦は置かない（通路は完全に空ける）。麦だけ
  let cellIndex = 0;
  for (const r of L.footprint) {
    const ir = innerRect(r, 0.35);
    for (let x = ir.x0 + pitch / 2; x < ir.x1; x += pitch) {
      for (let z = ir.z0 + pitch / 2; z < ir.z1; z += pitch) {
        cellIndex++;
        const jx = rng.float(-0.12, 0.12);
        const jz = rng.float(-0.12, 0.12);
        const s = rng.float(0.8, 1.2);
        const yaw = rng.float(0, Math.PI * 2);
        if (stalks.transforms.length >= MAX_WHEAT) continue;
        if (pointBlocked(c, x + jx, z + jz, 0.02)) continue;
        if (solids.some((b) => pointInBoxXZ(b, x + jx, z + jz, 0.1))) continue;
        stalks.transforms.push({ pos: [x + jx, 0, z + jz], yaw, scale: s });
        if (cellIndex % headEvery === 0) heads.transforms.push({ pos: [x + jx, 0.96 * s, z + jz], yaw, scale: s });
      }
    }
  }
  pushInstances(L, rng, stalks);
  pushInstances(L, rng, heads);
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
