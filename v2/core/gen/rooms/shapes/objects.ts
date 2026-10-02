/**
 * 部屋の中の構造物: 部屋の中の小屋（S21）。部屋の真ん中に、別の場所にあるはずの小さな建物がある。
 * - 電話ボックス: ガラスの箱の中に電話。上の灯りだけが点いている
 * - プレハブ: 波板の小屋（扉の穴と窓）。中に机・椅子・電気スタンド・暦。小屋の中に入れる
 * - 屋台: 赤白の幕の屋根・提灯・カウンター・丸椅子。誰もいない
 * 小屋の周りは歩いて回れる（開口どうしのつながりを確かめる）。家具は小屋に重ねない
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box, type MatId } from '../../../world/layout.ts';
import { defineRoomShape, type RoomShapeContext } from '../types.ts';
import { clearOfDoors, frontPt, rectD, rectW, snap } from '../util.ts';

type Kind = 'booth' | 'prefab' | 'stall';

/** 小屋の足跡（向き: 正面が向く向き）を、部屋の真ん中の近くで、開口の前に掛からず周りを 1 m 空けられる所に */
function spot(ctx: RoomShapeContext, w: number, d: number): { r: Rect; face: Dir } | null {
  const r = ctx.inner;
  const [ex, ez] = frontPt(ctx.entrance, 1.0);
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  // 正面は入口の方（扉を開けると正面が見える）
  const face: Dir = Math.abs(ex - cx) > Math.abs(ez - cz) ? (ex > cx ? 1 : 3) : (ez > cz ? 0 : 2);
  const [sw, sd] = face === 0 || face === 2 ? [w, d] : [d, w];
  for (const [ox, oz] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [0.6, 0.6], [-0.6, -0.6], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) {
    const q: Rect = { x0: snap(cx + ox! - sw / 2), x1: snap(cx + ox! + sw / 2), z0: snap(cz + oz! - sd / 2), z1: snap(cz + oz! + sd / 2) };
    if (q.x0 < r.x0 + 1.0 || q.x1 > r.x1 - 1.0 || q.z0 < r.z0 + 1.0 || q.z1 > r.z1 - 1.0) continue;
    if (!clearOfDoors(ctx, { x0: q.x0 - 0.3, x1: q.x1 + 0.3, z0: q.z0 - 0.3, z1: q.z1 + 0.3 }, 1.7, 0.45)) continue;
    return { r: q, face };
  }
  return null;
}

/** 正面 face の側の辺に沿った座標（u: 辺に沿って 0..len、v: 正面から奥へ 0..dep）→ xz */
function local(q: Rect, face: Dir): { len: number; dep: number; at(u: number, v: number): [number, number]; rect(u0: number, v0: number, u1: number, v1: number): Rect } {
  const alongX = face === 0 || face === 2;
  const len = alongX ? rectW(q) : rectD(q), dep = alongX ? rectD(q) : rectW(q);
  const at = (u: number, v: number): [number, number] => {
    switch (face) {
      case 0: return [q.x0 + u, q.z1 - v];
      case 2: return [q.x1 - u, q.z0 + v];
      case 1: return [q.x1 - v, q.z1 - u];
      default: return [q.x0 + v, q.z0 + u];
    }
  };
  const rect = (u0: number, v0: number, u1: number, v1: number): Rect => {
    const [ax, az] = at(u0, v0), [bx, bz] = at(u1, v1);
    return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz) };
  };
  return { len, dep, at, rect };
}

function build(ctx: RoomShapeContext, kind: Kind): boolean {
  const fy = ctx.fy, h = ctx.h;
  const size: Record<Kind, [number, number, number]> = { booth: [1.0, 1.0, 2.3], prefab: [snap(ctx.rng.float(2.4, 3.0)), snap(ctx.rng.float(1.8, 2.2)), 2.35], stall: [2.2, 1.5, 2.25] };
  const [w, d, hh] = size[kind];
  if (hh > h - 0.25) return false;
  const s = spot(ctx, w, d);
  if (!s) return false;
  const L = local(s.r, s.face);
  const put = (u0: number, v0: number, u1: number, v1: number, y0: number, y1: number, mat: MatId, solid = true, kindTag?: string): Box => {
    const q = L.rect(u0, v0, u1, v1);
    const b = box([q.x0, fy + y0, q.z0], [q.x1, fy + y1, q.z1], mat, solid);
    if (kindTag) b.kind = kindTag;
    ctx.addBox(b);
    return b;
  };
  const t = 0.08;
  if (kind === 'booth') {
    const frame: MatId = ctx.rng.pick<MatId>(['plasticRed', 'metal', 'plasticYellow']);
    // ガラスの 3 面（当たる見えない板 + 当たらないガラス）。正面は開いている（折れ戸を開けた所）
    for (const [u0, v0, u1, v1] of [[0, d - t, w, d], [0, 0, t, d], [w - t, 0, w, d]] as const) {
      put(u0, v0, u1, v1, 0.1, hh - 0.15, 'glass', false);
      put(u0, v0, u1, v1, 0, hh - 0.15, frame, true, 'colliderOnly');
    }
    for (const [u, v] of [[0, 0], [w, 0], [0, d], [w, d]] as const) put(Math.max(0, u - 0.05), Math.max(0, v - 0.05), Math.min(w, u + 0.05) || 0.05, Math.min(d, v + 0.05) || 0.05, 0, hh, frame);
    put(0, 0, w, d, 0, 0.1, frame, false);
    put(-0.04, -0.04, w + 0.04, d + 0.04, hh - 0.15, hh, frame);
    put(0.15, 0.15, w - 0.15, d - 0.15, hh - 0.17, hh - 0.15, 'lightPanel', false);
    // 電話（奥の面）と受話器
    put(w / 2 - 0.12, d - t - 0.14, w / 2 + 0.12, d - t, 1.0, 1.35, 'metalDark', false);
    put(w / 2 - 0.1, d - t - 0.2, w / 2 - 0.02, d - t - 0.14, 1.1, 1.32, 'plasticRed', false);
    put(w / 2 - 0.2, d - t - 0.3, w / 2 + 0.2, d - t, 0.85, 0.88, 'metalDark', false);
    const [lx, lz] = L.at(w / 2, d / 2);
    ctx.addLight({ pos: [lx, fy + hh - 0.4, lz], color: 0xfff2d8, intensity: 0.55, distance: 3.2 });
  } else if (kind === 'prefab') {
    const wall: MatId = ctx.rng.pick<MatId>(['sidingMetal', 'sidingWood']);
    const dw = 0.9, du = snap(ctx.rng.float(0.35, Math.max(0.36, w - dw - 0.35)));
    // 正面の壁（扉の穴）・奥と横の壁（窓）・屋根
    put(0, 0, du, t, 0, hh, wall);
    put(du + dw, 0, w, t, 0, hh, wall);
    put(du, 0, du + dw, t, 2.0, hh, wall);
    put(du - 0.04, -0.02, du, t + 0.02, 0, 2.0, 'trim', false);
    put(du + dw, -0.02, du + dw + 0.04, t + 0.02, 0, 2.0, 'trim', false);
    put(0, d - t, w, d, 0, hh, wall);
    // 横の壁の窓（穴 + ガラス + 見えない当たり）
    const wy0 = 1.0, wy1 = 1.8, wv0 = d / 2 - 0.45, wv1 = d / 2 + 0.45;
    for (const [u0, u1] of [[0, t], [w - t, w]] as const) {
      put(u0, t, u1, wv0, 0, hh, wall);
      put(u0, wv1, u1, d - t, 0, hh, wall);
      put(u0, wv0, u1, wv1, 0, wy0, wall);
      put(u0, wv0, u1, wv1, wy1, hh, wall);
      put(u0, wv0, u1, wv1, wy0, wy1, 'glass', false);
      put(u0, wv0, u1, wv1, wy0, wy1, wall, true, 'colliderOnly');
    }
    put(-0.08, -0.08, w + 0.08, d + 0.08, hh, hh + 0.08, wall);
    put(t, t, w - t, d - t, 0, 0.02, 'floorLino', false);
    // 中: 机・椅子・電気スタンド・暦
    put(w - t - 1.1, d - t - 0.6, w - t - 0.05, d - t - 0.02, 0.7, 0.74, 'furnitureLight');
    put(w - t - 1.08, d - t - 0.58, w - t - 1.04, d - t - 0.05, 0, 0.7, 'metalDark', false);
    put(w - t - 0.11, d - t - 0.58, w - t - 0.07, d - t - 0.05, 0, 0.7, 'metalDark', false);
    put(w - t - 0.75, d - t - 1.05, w - t - 0.35, d - t - 0.65, 0.42, 0.46, 'seatBlue');
    put(w - t - 0.75, d - t - 1.07, w - t - 0.35, d - t - 1.03, 0.46, 0.85, 'seatBlue');
    put(w - t - 0.3, d - t - 0.3, w - t - 0.2, d - t - 0.2, 0.74, 1.1, 'metalDark', false);
    put(w - t - 0.36, d - t - 0.36, w - t - 0.14, d - t - 0.14, 1.1, 1.2, 'lightWarm', false);
    put(t + 0.3, d - t - 0.01, t + 0.75, d - t, 1.2, 1.8, 'paintWhite', false);
    const [lx, lz] = L.at(w - t - 0.25, d - t - 0.25);
    ctx.addLight({ pos: [lx, fy + 1.3, lz], color: 0xffc890, intensity: 0.45, distance: 3.5 });
  } else {
    // 屋台: カウンター（正面）・奥の棚・屋根の幕（4 本の柱）・提灯・丸椅子
    const cloth: MatId[] = ['plasticRed', 'whiteFabric'];
    put(0.1, 0.4, w - 0.1, 0.95, 0, 0.95, 'woodPanel');
    put(0.05, 0.35, w - 0.05, 1.0, 0.95, 1.0, 'furnitureDark');
    put(0.2, d - 0.35, w - 0.2, d - 0.05, 0, 1.4, 'woodPanel');
    for (const [u, v] of [[0.05, 0.3], [w - 0.05, 0.3], [0.05, d - 0.05], [w - 0.05, d - 0.05]] as const) put(u - 0.04, v - 0.04, u + 0.04, v + 0.04, 0, hh, 'woodPanel');
    const n = 8;
    for (let i = 0; i < n; i++) put(-0.1 + ((w + 0.2) * i) / n, 0.1, -0.1 + ((w + 0.2) * (i + 1)) / n, d + 0.05, hh, hh + 0.06, cloth[i % 2]!, false);
    for (let i = 0; i < n; i++) put(-0.1 + ((w + 0.2) * i) / n, 0.08, -0.1 + ((w + 0.2) * (i + 1)) / n, 0.12, hh - 0.35, hh, cloth[i % 2]!, false);
    for (const u of [0.45, w / 2, w - 0.45]) {
      put(u - 0.012, 0.2, u + 0.012, 0.23, hh - 0.6, hh - 0.35, 'metalDark', false);
      put(u - 0.13, 0.08, u + 0.13, 0.34, hh - 0.95, hh - 0.6, 'neonRed', false);
    }
    // 丸椅子（カウンターの前）
    for (const u of [0.45, w / 2, w - 0.45]) {
      put(u - 0.17, -0.38, u + 0.17, -0.04, 0.6, 0.66, 'plasticRed');
      put(u - 0.03, -0.24, u + 0.03, -0.18, 0, 0.6, 'metalDark', false);
    }
    const [lx, lz] = L.at(w / 2, 0.3);
    ctx.addLight({ pos: [lx, fy + hh - 1.0, lz], color: 0xff7a50, intensity: 0.6, distance: 4 });
  }
  // 小屋の周り（0.3 m）には家具を置かない
  const q = s.r;
  ctx.keepOut({ min: [q.x0 - 0.45, fy, q.z0 - 0.45], max: [q.x1 + 0.45, fy + hh + 0.1, q.z1 + 0.45] });
  return true;
}

defineRoomShape({
  id: 'hut', idea: 'S21', name: '部屋の中の小屋', kinds: ['room', 'hall'], minSize: [3.6, 4.2], minHeight: 2.55, weight: 1.0,
  anomalies: ['dark', 'fog', 'tint', 'clocks', 'tiny', 'scatter'],
  build(ctx) {
    const r = ctx.inner;
    const kinds: Kind[] = [];
    if (Math.min(rectW(r), rectD(r)) >= 3.4) kinds.push('booth');
    if (Math.min(rectW(r), rectD(r)) >= 4.2 && Math.max(rectW(r), rectD(r)) >= 4.8 && ctx.h >= 2.65) kinds.push('prefab', 'prefab');
    if (Math.min(rectW(r), rectD(r)) >= 3.6 && Math.max(rectW(r), rectD(r)) >= 4.4) kinds.push('stall');
    for (const k of [...new Set(ctx.rng.shuffle(kinds))]) if (build(ctx, k)) return true;
    return false;
  },
});
