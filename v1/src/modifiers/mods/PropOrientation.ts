/**
 * PropOrientation — 家具の向き（U10 壁向き教室。facing: 'wall' | 'oneWay' | 'random'）。
 *  - 'wall'   : ソケット（入口・出口）が 1 つも無い最長の壁を向く（全辺にあればソケット最少の辺）= 「机方向が出口候補と逆を指す」。
 *  - 'oneWay' : seed で 1 方向。
 *  - 'random' : 机ごとに 4 方向乱択（黒板は既定の北壁）。
 *
 * layout フックの決定論 post-pass。RoomGenerator の Classroom は机を連続スラブ（patternRows）で出すため向きが表現できないので、
 * シェル以降の机スラブ（furnitureLight 高さ 0.6〜0.85）と黒板（wallGreen 非 solid）を捨て、
 *  - 机ユニット（机 0.6×0.5×0.72 solid + 椅子の座面 0.4×0.4×0.45 + 背 0.4×0.06×0.45、非 solid）を格子に個別配置し、
 *    細長い箱の長軸を向きに揃える（x/z 寸法を入れ替える）+ 椅子の背で向きを示す。
 *  - 黒板・教卓・時計サイン（SignSpec kind 'clock'）を向いた壁へ移す。
 * 通路（ソケット前 ±1.6 m、入口→各出口の直線帯 1.2 m）には机を置かない。Tier に依らず同一。
 */
import type { AABB } from '../../core/aabb';
import type { Dir, Vec3 } from '../../core/types';
import { across, along, wallSpans } from '../../generators/footprint';
import { box, WALL_T, type RoomLayout } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { str } from '../util';
import { boxBlocked, clearanceOf, dirXZ, innerRect, overlapsSolid, removeInterior, socketFreeWallDir, type Clearance } from './PropRepetition.shared';

type Facing = 'wall' | 'oneWay' | 'random';

const DESK_W = 0.6; // 向きに対して横
const DESK_D = 0.5; // 向きに対して奥行き
const DESK_H = 0.72;
const CHAIR = 0.4;
const PITCH_ACROSS = 1.15;
const PITCH_ALONG = 1.5;

const PropOrientation: ModifierImpl = {
  id: 'PropOrientation',
  defaults: { facing: 'wall' },
  layout(L, _p, params, rng) {
    const facing = (['wall', 'oneWay', 'random'].includes(str(params.facing, 'wall')) ? str(params.facing, 'wall') : 'wall') as Facing;
    if (L.footprint.length === 0) return;
    const c = clearanceOf(L);
    // 既存の机列と黒板を捨てる
    removeInterior(L, (b) => {
      const h = b.max[1] - b.min[1];
      if (b.solid && b.mat === 'furnitureLight' && b.min[1] < 0.05 && h > 0.6 && h < 0.86) return true;
      if (!b.solid && b.mat === 'wallGreen') return true;
      return false;
    });
    const dir: Dir = facing === 'oneWay' ? rng.pick([0, 1, 2, 3] as Dir[]) : facing === 'random' ? 0 : socketFreeWallDir(L);
    // 黒板 → 教卓 → 机
    const boardAlong = placeBoard(L, c, dir);
    placeDesks(L, c, rng, dir, facing, boardAlong !== null);
  },
};

export default PropOrientation;

/** 向いた壁の内面に黒板（wallGreen）+ 時計サイン + 教卓。黒板を置けたらその中心の壁沿い座標を返す */
function placeBoard(L: RoomLayout, c: Clearance, dir: Dir): number | null {
  const r = L.footprint[0];
  // この矩形の dir 辺のうち実際に外壁である区間から、ソケット周り（±(w/2 + 0.5)）を除く
  const spans = wallSpans(L.footprint).filter((sp) => sp.edge.rect === r && sp.edge.dir === dir);
  if (spans.length === 0) return null;
  const coord = spans[0].edge.coord;
  const cuts = L.sockets
    .filter((s) => s.type !== 'hole' && s.dir === dir && Math.abs(across(dir, s.pos[0], s.pos[2]) - coord) < 0.05)
    .map((s) => [along(dir, s.pos[0], s.pos[2]) - s.width / 2 - 0.5, along(dir, s.pos[0], s.pos[2]) + s.width / 2 + 0.5] as [number, number]);
  let best: [number, number] | null = null;
  for (const sp of spans) {
    let cur = sp.a0;
    const sorted = cuts.filter(([p, q]) => q > sp.a0 && p < sp.a1).sort((p, q) => p[0] - q[0]);
    const free: [number, number][] = [];
    for (const [p, q] of sorted) {
      if (p > cur) free.push([cur, Math.min(p, sp.a1)]);
      cur = Math.max(cur, q);
    }
    if (sp.a1 > cur) free.push([cur, sp.a1]);
    for (const f of free) if (!best || f[1] - f[0] > best[1] - best[0]) best = f;
  }
  if (!best || best[1] - best[0] < 2.0) return null;
  const width = Math.min(7, best[1] - best[0] - 0.6);
  const mid = (best[0] + best[1]) / 2;
  // 壁の内面: dir 0/1 は coord - WALL_T、dir 2/3 は coord + WALL_T
  const inFace = dir === 0 || dir === 1 ? coord - WALL_T : coord + WALL_T;
  const nrm = dirXZ(dir); // 外向き
  const boardMin: Vec3 = dir === 0 || dir === 2 ? [mid - width / 2, 0.9, inFace - nrm[1] * 0.035] : [inFace - nrm[0] * 0.035, 0.9, mid - width / 2];
  const boardMax: Vec3 = dir === 0 || dir === 2 ? [mid + width / 2, 2.1, inFace - nrm[1] * 0.005] : [inFace - nrm[0] * 0.005, 2.1, mid + width / 2];
  L.boxes.push(box(boardMin, boardMax, 'wallGreen', false));
  // 時計（黒板の上）。表面は室内側 = dir の逆
  if (L.height >= 2.7) {
    if (!L.signs) L.signs = [];
    const sp: Vec3 = dir === 0 || dir === 2 ? [mid, 2.42, inFace - nrm[1] * 0.02] : [inFace - nrm[0] * 0.02, 2.42, mid];
    L.signs.push({ id: 'PropOrientation.clock', text: '10:08', pos: sp, dir: ((dir + 2) % 4) as Dir, width: 0.7, kind: 'clock' });
  }
  // 教卓（壁から 1.0 m、黒板の中央）。通路に掛かれば置かない
  const tx = dir === 0 || dir === 2 ? mid : inFace - nrm[0] * 1.0;
  const tz = dir === 0 || dir === 2 ? inFace - nrm[1] * 1.0 : mid;
  const hx = dir === 0 || dir === 2 ? 0.7 : 0.35;
  const hz = dir === 0 || dir === 2 ? 0.35 : 0.7;
  const desk: AABB = { min: [tx - hx, 0, tz - hz], max: [tx + hx, 0.76, tz + hz] };
  if (!boxBlocked(c, desk, 0.1) && !overlapsSolid(L, desk)) L.boxes.push(box(desk.min, desk.max, 'furnitureDark'));
  return mid;
}

/** 机ユニットを格子に置く。dir = 机が向く方向（生徒は dir の壁を見る）。random は机ごとに乱択 */
function placeDesks(L: RoomLayout, c: Clearance, rng: { pick<T>(a: readonly T[]): T; float(a: number, b: number): number }, dir: Dir, facing: Facing, hasBoard: boolean): void {
  const alongZ = dir === 0 || dir === 2; // 向きが z 軸
  for (let ri = 0; ri < L.footprint.length; ri++) {
    const r = L.footprint[ri];
    const ir = innerRect(r, 1.3);
    // 前方（黒板側）は教卓のために 2.6 m 空ける（主矩形のみ）
    if (ri === 0 && hasBoard) {
      if (dir === 0) ir.z1 -= 2.6;
      else if (dir === 2) ir.z0 += 2.6;
      else if (dir === 1) ir.x1 -= 2.6;
      else ir.x0 += 2.6;
    }
    const pitchX = alongZ ? PITCH_ACROSS : PITCH_ALONG;
    const pitchZ = alongZ ? PITCH_ALONG : PITCH_ACROSS;
    const nx = Math.floor((ir.x1 - ir.x0) / pitchX);
    const nz = Math.floor((ir.z1 - ir.z0) / pitchZ);
    if (nx < 1 || nz < 1) continue;
    const ox = ir.x0 + ((ir.x1 - ir.x0) - nx * pitchX) / 2 + pitchX / 2;
    const oz = ir.z0 + ((ir.z1 - ir.z0) - nz * pitchZ) / 2 + pitchZ / 2;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const d: Dir = facing === 'random' ? rng.pick([0, 1, 2, 3] as Dir[]) : dir;
        const cx = ox + ix * pitchX;
        const cz = oz + iz * pitchZ;
        if (!deskUnit(L, c, cx, cz, d)) continue;
      }
    }
  }
}

/** 机 1 台 + 椅子（座面・背）。置けたら true */
function deskUnit(L: RoomLayout, c: Clearance, cx: number, cz: number, d: Dir): boolean {
  const f = dirXZ(d); // 前（向く方向）
  const zAxis = d === 0 || d === 2;
  // 机（長軸を向きに対して横に）
  const dw = zAxis ? DESK_W : DESK_D;
  const dd = zAxis ? DESK_D : DESK_W;
  const desk = box([cx - dw / 2, 0, cz - dd / 2], [cx + dw / 2, DESK_H, cz + dd / 2], 'furnitureLight');
  // 椅子: 机の後ろ（-f）
  const gap = DESK_D / 2 + 0.06 + CHAIR / 2;
  const sx = cx - f[0] * gap;
  const sz = cz - f[1] * gap;
  const seat = box([sx - CHAIR / 2, 0, sz - CHAIR / 2], [sx + CHAIR / 2, 0.45, sz + CHAIR / 2], 'furnitureDark', false);
  const bkOff = CHAIR / 2 - 0.03;
  const bx = sx - f[0] * bkOff;
  const bz = sz - f[1] * bkOff;
  const back = zAxis
    ? box([bx - CHAIR / 2, 0.45, bz - 0.03], [bx + CHAIR / 2, 0.9, bz + 0.03], 'furnitureDark', false)
    : box([bx - 0.03, 0.45, bz - CHAIR / 2], [bx + 0.03, 0.9, bz + CHAIR / 2], 'furnitureDark', false);
  // ユニット全体で通路・既存 solid と判定
  const unit: AABB = {
    min: [Math.min(desk.min[0], back.min[0]), 0, Math.min(desk.min[2], back.min[2])],
    max: [Math.max(desk.max[0], back.max[0]), 1.0, Math.max(desk.max[2], back.max[2])],
  };
  if (boxBlocked(c, unit, 0.15) || overlapsSolid(L, unit)) return false;
  L.boxes.push(desk, seat, back);
  return true;
}
