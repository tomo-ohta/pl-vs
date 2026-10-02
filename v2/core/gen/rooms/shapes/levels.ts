/**
 * 上下に広がる形: 半円の劇場（S09）・ロフト付き（S20）・足場の部屋（S22）・一つの部屋が何層も（S27）・階段だけの部屋（S29）・
 * 天井から下がる階段（S19）。上の段・台へは段（kind 'roomStep'。手すり付き。上の台は 'landing'）で上がり、どこからでも下りられる。
 * - 劇場: 舞台（0.7 m）・幕・足元の灯り・舞台を囲む半円の座席。舞台の奥の扉の向こうに楽屋（鏡と電球・衣装掛け）。空きが無ければ開かない扉
 * - ロフト: 壁際の 1.5〜1.9 m の台の上に寝床。急な段で上がり、天井が低いのでしゃがんで入る。台の下は家具が置ける
 * - 足場: 壁沿いの鉄骨の足場（高さ 2.15 m の通路）。両端に段があり、上って回って下りられる。筋交い・作業灯
 * - 何層も: 同じ部屋を 2〜3 層に重ねた空間（天井を上げる）。どの層にも同じ家具・同じ扉（上の層の扉は開かない）。段で上の層へ
 * - 階段だけ: 壁際に折り返して上る階段の塔（宙に浮く段）。上りきると開かない扉。どこへも行かない階段・天井に逆さの階段・壁を横に走る階段
 * - 天井から下がる階段: 天井の口から急な階段が下がり、上は屋根裏（切妻の屋根・古い箱・裸電球・小さな窓）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { doorPanel, makeCell, opening, portal, portalAabb } from '../../../world/build.ts';
import { box, DOOR_W, WALL_T, type Box, type MatId } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import { chair } from '../../dress/furniture.ts';
import { fillRects, wallFrame, type WallFrame } from '../../gimmicks/util.ts';
import { defineRoomShape, type RoomShapeContext } from '../types.ts';
import type { Stair } from '../util.ts';
import {
  clearCeilingLights, clearOfDoors, cutCeiling, doorZonesOf, footOf, freeWalls, isWallBox, lift, lightGridAt, raiseCeiling, railing, rbox, reachMark, rectD, rectsHit, rectW, reshell, snap,
  stairs, stepCount, subDress, unionRect, useDress,
} from '../util.ts';

const LOOK = ['dark', 'fog', 'tint'] as const;
const inRect = (r: Rect, x: number, z: number): boolean => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/** 壁の座標系 F で、u の正の向きの Dir（d が 0/2 なら x、1/3 なら z の向き） */
const uDir = (d: Dir, sign: 1 | -1): Dir => (d === 0 || d === 2 ? (sign > 0 ? 1 : 3) : (sign > 0 ? 0 : 2));
/** 壁 d の室内向き（v の正の向き）の Dir */
const vDir = (d: Dir): Dir => ((d + 2) % 4) as Dir;

/** 区画の外に、ほかの区画と重ならない空きがあるか（y0..y1） */
function spaceFree(ctx: RoomShapeContext, r: Rect, y0: number, y1: number): boolean {
  return !ctx.world.cells.some((g) => {
    const b = g.cell.bounds;
    return b.max[1] > y0 + 0.02 && b.min[1] < y1 - 0.02 && rectsHit(r, footOf(b), 0.02);
  });
}

/** 開かない扉（壁の室内面に板・枠。調べると鍵が掛かっている） */
function lockedDoor(ctx: RoomShapeContext, name: string, d: Dir, at: number, y: number, wallFace: number): void {
  const ax: 'x' | 'z' = d === 1 || d === 3 ? 'x' : 'z';
  const sg = d === 0 || d === 1 ? -1 : 1;
  const p0 = wallFace + sg * 0.005, p1 = wallFace + sg * 0.055;
  const panel = ax === 'x' ? { min: [Math.min(p0, p1), y, at - 0.45], max: [Math.max(p0, p1), y + 2.0, at + 0.45] } : { min: [at - 0.45, y, Math.min(p0, p1)], max: [at + 0.45, y + 2.0, Math.max(p0, p1)] };
  ctx.addEntity(name, { type: 'door', params: { panel, axis: ax, mat: ctx.cell.palette.door, locked: true, autoCloseSec: 0 } });
  const q0 = wallFace, q1 = wallFace + sg * 0.07;
  const fr = (a0: number, a1: number, y0: number, y1: number): Box => (ax === 'x' ? box([Math.min(q0, q1), y0, a0], [Math.max(q0, q1), y1, a1], 'trim', false) : box([a0, y0, Math.min(q0, q1)], [a1, y1, Math.max(q0, q1)], 'trim', false));
  ctx.addBox(fr(at - 0.53, at - 0.46, y, y + 2.07));
  ctx.addBox(fr(at + 0.46, at + 0.53, y, y + 2.07));
  ctx.addBox(fr(at - 0.53, at + 0.53, y + 2.0, y + 2.07));
}

/** 壁 d の室内面の座標 */
const wallFaceOf = (r: Rect, d: Dir): number => (d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0);

/** 上の台の床板（歩く人が上の面として見る kind 'landing'） */
function deck(ctx: RoomShapeContext, r: Rect, top: number, mat: MatId, thick = 0.08): void {
  const b = rbox(r, top - thick, top, mat);
  b.kind = 'landing';
  ctx.addBox(b);
}

// ---------------------------------------------------------------- S09 半円の劇場

defineRoomShape({
  id: 'theater', idea: 'S09', name: '半円の劇場', kinds: ['room', 'hall'], minSize: [5.4, 6.4], minHeight: 2.85, weight: 1.0,
  anomalies: LOOK,
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner, R = ctx.rect;
    const free = freeWalls(ctx);
    const opp = ((ctx.entrance.dir + 2) % 4) as Dir;
    for (const sd of free.includes(opp) ? [opp, ...free.filter((d) => d !== opp)] : free) {
      const F = wallFrame(r, sd);
      const sdp = t['rooms.theater.stageD'], sh = t['rooms.theater.stageH'];
      const su0 = F.u0 + 0.3, su1 = F.u1 - 0.3;
      if (su1 - su0 < 3.2 || F.depth < sdp + 3.6) continue;
      // 舞台の前の段（両端）の分まで、開口の前に掛からない
      if (!clearOfDoors(ctx, F.rect(su0, 0, su1, sdp + 1.6), 1.6, 0.45)) continue;
      const uc = (su0 + su1) / 2;
      // 楽屋: 舞台の奥の壁の真ん中の扉（舞台の高さ）。壁の外に空きがあれば区画を足す（無ければ開かない扉）
      const bw = 3.0, bd = 2.6;
      const out = sd === 0 ? R.z1 : sd === 2 ? R.z0 : sd === 1 ? R.x1 : R.x0;
      const sg = sd === 0 || sd === 1 ? 1 : -1;
      const [bx, bz] = F.point(uc, 0);
      const along = sd === 0 || sd === 2;
      const brect: Rect = along ? { x0: snap(bx - bw / 2), x1: snap(bx + bw / 2), z0: Math.min(out, out + sg * bd), z1: Math.max(out, out + sg * bd) } : { z0: snap(bz - bw / 2), z1: snap(bz + bw / 2), x0: Math.min(out, out + sg * bd), x1: Math.max(out, out + sg * bd) };
      const by = fy + sh;
      const doorH = 2.0;
      const at = along ? bx : bz;
      if (h - sh - doorH >= 0.1 && spaceFree(ctx, brect, by - 0.3, by + 2.7)) {
        const pos: [number, number, number] = along ? [at, by, out] : [out, by, at];
        const mine = opening(`${cell.id}:${ctx.id}.back`, pos, sd, DOOR_W, doorH);
        ctx.geo.openings.push(mine);
        if (!reshell(ctx, cell.footprint)) return false;
        const bid = `${cell.id}x`;
        const bo = opening(`${bid}:${cell.id}`, pos, vDir(sd), DOOR_W, doorH);
        const pal = { ...themePalette('Theater'), wall: 'wallDark' as MatId, floor: 'floorWood' as MatId, lightColor: 0xffc890, lightIntensity: 0.6 };
        const bc = makeCell({ id: bid, role: 'secret', rects: [brect], height: 2.5, floorY: by, palette: pal, openings: [bo], lights: 'none', name: '楽屋', theme: 'Theater', audioPreset: cell.audioPreset ?? '静かな空調', materialKey: bid });
        furnishBackstage(bc.boxes, bc.lights, brect, by, sd);
        ctx.world.cells.push({ cell: bc, kind: 'secret', openings: [bo], node: -1 });
        ctx.skipDress(bid);
        const ax: 'x' | 'z' = along ? 'z' : 'x';
        const toward = sd === 0 || sd === 1 ? 1 : -1;
        const doorId = ctx.addEntity('backDoor', { type: 'door', params: { panel: (() => { const p = doorPanel(ax, out, at, DOOR_W, by, doorH); return { min: [...p.min], max: [...p.max] }; })(), axis: ax, mat: cell.palette.door, hinge: 1, swing: ax === 'x' ? toward : -toward, autoCloseSec: 6 } });
        ctx.world.portals.push(portal(`p:${cell.id}:${bid}`, cell.id, bid, portalAabb(ax, out, at, DOOR_W, by, doorH), sd, 'door', doorId));
      } else {
        lockedDoor(ctx, 'backDoor', sd, at, by, wallFaceOf(r, sd));
      }
      // 舞台（上面は kind 'landing'）・前の段（両端）
      const stage = F.rect(su0, 0, su1, sdp);
      const sb = rbox(stage, fy, by, 'woodPanel');
      sb.kind = 'landing';
      ctx.addBox(sb);
      const runS = stepCount(sh, 0.35) * 0.3;
      const steps: Rect[] = [];
      for (const [u, s2] of [[su0 + 0.55, -1], [su1 - 0.55, 1]] as const) {
        const [sx, sz] = F.point(u, sdp + runS);
        const st = stairs(ctx, { x: sx, z: sz, dir: sd, width: 0.9, y0: fy, y1: by, riseMax: 0.35, tread: 0.3, mat: 'woodPanel', rails: s2 < 0 ? 'left' : 'right', railMat: 'handrailWood' });
        steps.push(st.rect, F.rect(u - 0.45, sdp + runS, u + 0.45, sdp + runS + 0.9));
      }
      // 幕: 奥の幕（扉の所は開ける）・舞台の前の両脇の幕・上の幕。舞台の前の縁の足元の灯り
      const cur: MatId = ctx.rng.pick<MatId>(['seatRed', 'seatRed', 'upholstery']);
      for (const [a, b2] of [[su0, uc - 0.75], [uc + 0.75, su1]] as const) ctx.addBox(rbox(F.rect(a, 0, b2, 0.1), by, fy + h - 0.15, cur, false));
      for (const a of [su0, su1 - 0.55]) ctx.addBox(rbox(F.rect(a, sdp - 0.12, a + 0.55, sdp), by, fy + h - 0.1, cur, false));
      ctx.addBox(rbox(F.rect(su0, sdp - 0.12, su1, sdp), fy + h - 0.7, fy + h - 0.1, cur, false));
      for (let u = su0 + 0.8; u < su1 - 0.7; u += 0.6) ctx.addBox(rbox(F.rect(u - 0.06, sdp - 0.1, u + 0.06, sdp - 0.02), by, by + 0.05, 'lightWarm', false));
      // 半円の座席: 舞台の前の縁の真ん中を中心に、0.95 m ごとの弧。真ん中は通路。椅子は舞台の方を向く
      const C = F.point(uc, sdp);
      let seats = 0;
      const mat = ctx.rng.pick<MatId>(['seatRed', 'seatBlue', 'upholstery']);
      for (let i = 0; i < 6; i++) {
        const rad = 2.1 + i * 0.95;
        const n = Math.floor((Math.PI * 0.86 * rad) / 0.62);
        for (let k = 0; k <= n; k++) {
          const th = -Math.PI * 0.43 + (Math.PI * 0.86 * k) / Math.max(1, n);
          if (Math.abs(rad * Math.sin(th)) < 0.5) continue;
          const u = uc + rad * Math.sin(th), v = sdp + rad * Math.cos(th);
          const [x, z] = F.point(u, v);
          const q: Rect = { x0: x - 0.26, x1: x + 0.26, z0: z - 0.26, z1: z + 0.26 };
          if (q.x0 < r.x0 + 0.2 || q.x1 > r.x1 - 0.2 || q.z0 < r.z0 + 0.2 || q.z1 > r.z1 - 0.2) continue;
          if (!clearOfDoors(ctx, q, 1.7, 0.45) || steps.some((s) => rectsHit(s, q))) continue;
          const dx = C[0] - x, dz = C[1] - z;
          const facing: Dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 0 : 2);
          const B: Box[] = [];
          chair(B, x, z, facing, mat);
          lift(B, cell.id, fy);
          for (const b of B) { delete b.propGroup; ctx.addBox(b); }
          seats++;
        }
      }
      if (seats < 8) return false;
      // 灯り: 客席は暗め、舞台に暖かい灯り 2 つ
      for (const l of cell.lights) l.intensity *= 0.55;
      for (const u of [uc - (su1 - su0) / 4, uc + (su1 - su0) / 4]) {
        const [lx, lz] = F.point(u, sdp * 0.6);
        ctx.addLight({ pos: [lx, Math.min(fy + h - 0.4, by + 2.3), lz], color: 0xffcf96, intensity: cell.palette.lightIntensity * 1.1, distance: 5 });
      }
      ctx.skipDress();
      return true;
    }
    return false;
  },
});

/** 楽屋の中身: 奥の壁の化粧台（鏡と周りの電球）・椅子・衣装掛け・灯り。d は劇場から楽屋へ入る向き */
function furnishBackstage(B: Box[], L: { pos: [number, number, number]; color: number; intensity: number; distance: number }[], r: Rect, y: number, d: Dir): void {
  const F: WallFrame = wallFrame({ x0: r.x0 + WALL_T, z0: r.z0 + WALL_T, x1: r.x1 - WALL_T, z1: r.z1 - WALL_T }, d);
  const fbox = (u0: number, v0: number, u1: number, v1: number, y0: number, y1: number, mat: MatId, solid = true): void => { const q = F.rect(u0, v0, u1, v1); B.push(box([q.x0, y + y0, q.z0], [q.x1, y + y1, q.z1], mat, solid)); };
  const mid = (F.u0 + F.u1) / 2;
  // F の v = 0 は奥の壁（入る向き d の先の壁）
  fbox(mid - 0.8, 0, mid + 0.8, 0.45, 0.72, 0.76, 'furnitureLight');
  fbox(mid - 0.78, 0.02, mid - 0.74, 0.43, 0, 0.72, 'furnitureLight', false);
  fbox(mid + 0.74, 0.02, mid + 0.78, 0.43, 0, 0.72, 'furnitureLight', false);
  fbox(mid - 0.6, 0, mid + 0.6, 0.02, 1.0, 1.75, 'stainless', false);
  for (let i = 0; i < 6; i++) {
    const u = mid - 0.66 + (1.32 * i) / 5;
    fbox(u - 0.035, 0.02, u + 0.035, 0.06, 1.8, 1.87, 'lightWarm', false);
  }
  for (let i = 0; i < 4; i++) {
    const yy = 1.05 + (0.65 * i) / 3;
    fbox(mid - 0.68, 0.02, mid - 0.64, 0.06, yy, yy + 0.07, 'lightWarm', false);
    fbox(mid + 0.64, 0.02, mid + 0.68, 0.06, yy, yy + 0.07, 'lightWarm', false);
  }
  fbox(mid - 0.2, 0.65, mid + 0.2, 1.05, 0.42, 0.46, 'upholstery');
  // 衣装掛け（横の壁沿い）
  const u0 = F.u0 + 0.3;
  fbox(u0, 0.6, u0 + 0.04, 1.8, 1.6, 1.64, 'metalDark', false);
  const cloth: MatId[] = ['seatRed', 'plasticYellow', 'whiteFabric', 'seatBlue', 'upholstery'];
  for (let i = 0; i < 5; i++) {
    const v = 0.7 + i * 0.22;
    fbox(u0 - 0.2, v, u0 + 0.24, v + 0.08, 0.7, 1.58, cloth[i]!, false);
  }
  const [lx, lz] = F.point(mid, 0.6);
  L.push({ pos: [lx, y + 2.0, lz], color: 0xffc890, intensity: 0.6, distance: 4.5 });
}

// ---------------------------------------------------------------- S20 ロフト付き

defineRoomShape({
  id: 'loft', idea: 'S20', name: 'ロフト付き', kinds: ['room', 'hall'], minSize: [3.8, 4.6], minHeight: 2.6, weight: 1.0,
  anomalies: ['dark', 'fog', 'tint', 'clocks', 'tiny', 'scatter'],
  build(ctx) {
    const fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const hl = snap(Math.min(1.95, Math.max(1.45, h - 1.15)));
    if (h - hl < 0.95) return false;
    for (const d of ctx.rng.shuffle(freeWalls(ctx))) {
      const F = wallFrame(r, d);
      const n = stepCount(hl, 0.25), run = n * 0.24, sw = 0.62;
      const len = F.u1 - F.u0;
      const ll = snap(Math.min(3.2, len - run - 1.0));
      if (ll < 2.2) continue;
      const ldp = 1.5;
      const fromStart = ctx.rng.chance(0.5);
      // ロフトは壁の端の角に、段はロフトの端の先（壁沿い、ロフトの方へ上る）
      const lu0 = fromStart ? F.u0 : F.u1 - ll, lu1 = lu0 + ll;
      const su = fromStart ? lu1 + run : lu0 - run; // 段の上り始め（下の端）
      const loft = F.rect(lu0, 0, lu1, ldp);
      const sr = F.rect(Math.min(su, fromStart ? lu1 : lu0), 0, Math.max(su, fromStart ? lu1 : lu0), sw);
      const foot = F.rect(fromStart ? su : su - 0.9, 0, fromStart ? su + 0.9 : su, sw);
      if (!clearOfDoors(ctx, unionRect([loft, sr, foot]), 1.6, 0.45)) continue;
      // 台（床板は kind 'landing'）・前の 2 本の柱・前の縁の低い手すり（段の側は開ける）
      deck(ctx, loft, fy + hl, 'woodPanel', 0.15);
      for (const u of [lu0 + 0.06, lu1 - 0.06]) {
        const [x, z] = F.point(u, ldp - 0.06);
        ctx.addBox(box([x - 0.05, fy, z - 0.05], [x + 0.05, fy + hl - 0.15, z + 0.05], 'woodPanel'));
      }
      const [ax, az] = F.point(lu0, ldp), [bx, bz] = F.point(lu1, ldp);
      railing(ctx, ax, az, bx, bz, fy + hl, { h: 0.45, mat: 'woodPanel', posts: 0.8 });
      const endU = fromStart ? lu1 : lu0;
      const [ex0, ez0] = F.point(endU, sw + 0.45), [ex1, ez1] = F.point(endU, ldp);
      railing(ctx, ex0, ez0, ex1, ez1, fy + hl, { h: 0.45, mat: 'woodPanel', posts: 0.8 });
      // 寝床: 布団・枕・毛布・小さな灯り・本
      const bu0 = lu0 + 0.15, bu1 = Math.min(lu1 - 0.15, bu0 + 2.0);
      ctx.addBox(rbox(F.rect(bu0, 0.1, bu1, 1.0), fy + hl, fy + hl + 0.18, 'whiteFabric', false));
      ctx.addBox(rbox(F.rect(fromStart ? bu0 + 0.05 : bu1 - 0.45, 0.2, fromStart ? bu0 + 0.45 : bu1 - 0.05, 0.9), fy + hl + 0.18, fy + hl + 0.3, 'paintWhite', false));
      ctx.addBox(rbox(F.rect(fromStart ? bu0 + 0.6 : bu0, 0.08, fromStart ? bu1 : bu1 - 0.6, 1.02), fy + hl + 0.18, fy + hl + 0.24, ctx.rng.pick<MatId>(['seatBlue', 'upholstery', 'seatRed']), false));
      const lampU = fromStart ? Math.min(lu1 - 0.25, bu1 + 0.2) : Math.max(lu0 + 0.25, bu0 - 0.2);
      const [lx, lz] = F.point(lampU, 0.3);
      ctx.addBox(box([lx - 0.08, fy + hl, lz - 0.08], [lx + 0.08, fy + hl + 0.25, lz + 0.08], 'lightWarm', false));
      ctx.addLight({ pos: [lx, fy + hl + 0.5, lz], color: 0xffc27a, intensity: 0.4, distance: 3 });
      for (let i = 0; i < 4; i++) {
        const [kx, kz] = F.point(lampU + (fromStart ? -1 : 1) * (0.25 + i * 0.07), 1.25);
        ctx.addBox(box([kx - 0.03, fy + hl, kz - 0.1], [kx + 0.03, fy + hl + 0.22, kz + 0.1], ctx.rng.pick<MatId>(['bookshelfWood', 'seatRed', 'noticeGreen']), false));
      }
      // 急な段（壁沿い、ロフトの方へ上る。上の段から台へ。天井が低いのでしゃがんで上がる）
      const [sx, sz] = F.point(su, sw / 2);
      stairs(ctx, { x: sx, z: sz, dir: uDir(d, fromStart ? -1 : 1), width: sw, y0: fy, y1: fy + hl, riseMax: 0.25, tread: 0.24, mat: 'woodPanel', rails: 'both', railMat: 'handrailWood' });
      // 段の足元まで床から歩いて行けるように（家具を置かない・つながりを確かめる目印）
      reachMark(ctx, d, fromStart ? su + 0.45 : su - 0.45);
      ctx.keepOut({ min: [Math.min(sr.x0, foot.x0) - 0.2, fy, Math.min(sr.z0, foot.z0) - 0.2], max: [Math.max(sr.x1, foot.x1) + 0.2, fy + h, Math.max(sr.z1, foot.z1) + 0.2] });
      return true;
    }
    return false;
  },
});

// ---------------------------------------------------------------- S22 足場の部屋

defineRoomShape({
  id: 'scaffold', idea: 'S22', name: '足場の部屋', kinds: ['room', 'hall'], minSize: [4.8, 6.0], minHeight: 2.4, weight: 0.9,
  anomalies: ['dark', 'fog', 'tint', 'clocks', 'tiny', 'scatter'],
  build(ctx) {
    const fy = ctx.fy, r = ctx.inner;
    const free = freeWalls(ctx);
    if (!free.length) return false;
    const L1 = 2.15, dd = 1.2, sw = 0.85;
    const n = stepCount(L1, 0.22), run = n * 0.26;
    for (const d of ctx.rng.shuffle(free.slice())) {
      const F = wallFrame(r, d);
      // 足場の範囲: 壁に沿って、開口の前（段の分まで）に掛からない最も長い区間
      const zones = doorZonesOf(ctx, 1.7, 0.45);
      const cuts: [number, number][] = [];
      for (const z of zones) {
        const q = footOf(z);
        if (!rectsHit(q, F.rect(F.u0, 0, F.u1, dd + sw + 0.9))) continue;
        const a = F.u(q.x0, q.z0), b = F.u(q.x1, q.z1);
        cuts.push([Math.min(a, b), Math.max(a, b)]);
      }
      cuts.sort((p, q) => p[0] - q[0]);
      let best: [number, number] | null = null, cur = F.u0;
      for (const [a, b] of [...cuts, [F.u1, F.u1] as [number, number]]) {
        if (a - cur > (best ? best[1] - best[0] : 0)) best = [cur, Math.min(a, F.u1)];
        cur = Math.max(cur, b);
      }
      if (!best || best[1] - best[0] < 2 * sw + 1.6) continue;
      const [a0, a1] = best;
      // 段の置き方: 長い壁なら足場の前の縁沿い（両端の方へ上る）、短ければ足場の両端から部屋の奥へ直角に（壁の方へ上る）
      const along = a1 - a0 >= 2 * run + 1.8;
      if (!along && F.depth < dd + run + 1.0 + 1.2) continue;
      // 直角の段とその足元が開口の前に掛からない
      if (!along && (!clearOfDoors(ctx, F.rect(a0, dd, a0 + sw, dd + run + 0.95), 1.6, 0.45) || !clearOfDoors(ctx, F.rect(a1 - sw, dd, a1, dd + run + 0.95), 1.6, 0.45))) continue;
      if (ctx.h < 4.3 && !raiseCeiling(ctx, snap(ctx.rng.float(4.6, 5.2)))) return false;
      const H = ctx.cell.height;
      const deckR = F.rect(a0, 0, a1, dd);
      deck(ctx, deckR, fy + L1, 'woodPanel', 0.05);
      const mkStair = (u: number, v: number, dir: Dir): Stair => stairs(ctx, { x: F.point(u, v)[0], z: F.point(u, v)[1], dir, width: sw, y0: fy, y1: fy + L1, riseMax: 0.22, tread: 0.26, mat: 'shelfMetal', rails: 'both', railMat: 'metal' });
      let st1: Stair, st2: Stair, s1u: number, s2u: number;
      const gaps: [number, number][] = [];
      if (along) {
        // 足場の前の縁沿い、両端の方へ上る（上の段から横へ足場に出る）。足元は足場の下の壁際から行ける
        s1u = a0 + 0.2 + run; s2u = a1 - 0.2 - run;
        st1 = mkStair(s1u, dd + sw / 2, uDir(d, -1));
        st2 = mkStair(s2u, dd + sw / 2, uDir(d, 1));
        reachMark(ctx, d, s1u + 0.45);
        reachMark(ctx, d, s2u - 0.45);
        gaps.push([a0 + 0.2, a0 + 1.4], [a1 - 1.4, a1 - 0.2]);
      } else {
        // 両端から直角に: 部屋の奥（足元）から壁の方（足場の前の縁）へ上る
        s1u = a0 + sw / 2; s2u = a1 - sw / 2;
        st1 = mkStair(s1u, dd + run, d);
        st2 = mkStair(s2u, dd + run, d);
        const ends: [number, Dir][] = [[a0, uDir(d, -1)], [a1, uDir(d, 1)]];
        for (const [e, side] of ends) if (Math.abs(e - F.u0) < 0.05 || Math.abs(e - F.u1) < 0.05) reachMark(ctx, side, F.point(0, dd + run + 0.45)[d === 0 || d === 2 ? 1 : 0]);
        gaps.push([a0, a0 + sw + 0.05], [a1 - sw - 0.05, a1]);
      }
      // 足場の前の縁の手すり（段の上る所は開ける）・開いた両端の手すり
      const rail = (p: number, q: number): void => { if (q - p > 0.15) { const [x0, z0] = F.point(p, dd), [x1, z1] = F.point(q, dd); railing(ctx, x0, z0, x1, z1, fy + L1, { mat: 'shelfMetal', posts: 1.8 }); } };
      rail(gaps[0]![1], gaps[1]![0]);
      if (gaps[0]![0] - a0 > 0.15) rail(a0, gaps[0]![0]);
      if (a1 - gaps[1]![1] > 0.15) rail(gaps[1]![1], a1);
      for (const e of [a0, a1]) if (Math.abs(e - F.u0) > 0.05 && Math.abs(e - F.u1) > 0.05) { const [x0, z0] = F.point(e, 0), [x1, z1] = F.point(e, dd); railing(ctx, x0, z0, x1, z1, fy + L1, { mat: 'shelfMetal' }); }
      // 鉄骨: 前と奥の柱（1.8 m ごと）・横の管・筋交い・巾木。作業灯 2 つ
      const nPost = Math.max(2, Math.round((a1 - a0) / 1.8));
      for (let i = 0; i <= nPost; i++) {
        const u = a0 + 0.05 + ((a1 - a0 - 0.1) * i) / nPost;
        for (const v of [0.08, dd - 0.04]) { const [x, z] = F.point(u, v); ctx.addBox(box([x - 0.025, fy, z - 0.025], [x + 0.025, Math.min(fy + H - 0.05, fy + L1 + 1.05), z + 0.025], 'shelfMetal', false)); }
        if (i < nPost) {
          // 筋交い（前の面。柱の間を斜めに。向きを交互に）
          const u2 = a0 + 0.05 + ((a1 - a0 - 0.1) * (i + 1)) / nPost;
          const [x0, z0] = F.point(Math.min(u, u2), dd - 0.04), [x1, z1] = F.point(Math.max(u, u2), dd - 0.04);
          const rising = i % 2 === 1;
          const yb = rising ? fy + 0.15 : fy + L1 - 0.25;
          const brace = box([Math.min(x0, x1) - 0.012, yb, Math.min(z0, z1) - 0.012], [Math.max(x0, x1) + 0.012, yb + 0.04, Math.max(z0, z1) + 0.012], 'shelfMetal', false);
          brace.slope = { axis: d === 0 || d === 2 ? 'x' : 'z', rise: (rising ? 1 : -1) * (L1 - 0.4) };
          ctx.addBox(brace);
        }
      }
      for (const y of [L1 - 0.1, L1 + 0.5]) { const [x0, z0] = F.point(a0, 0.08), [x1, z1] = F.point(a1, 0.08); ctx.addBox(box([Math.min(x0, x1), fy + y, Math.min(z0, z1) - 0.02], [Math.max(x0, x1), fy + y + 0.04, Math.max(z0, z1) + 0.02], 'shelfMetal', false)); }
      ctx.addBox(rbox(F.rect(a0, dd - 0.03, a1, dd), fy + L1, fy + L1 + 0.15, 'woodPanel', false));
      for (const u of [a0 + (a1 - a0) * 0.3, a0 + (a1 - a0) * 0.7]) {
        const [x, z] = F.point(u, dd - 0.1);
        ctx.addBox(box([x - 0.12, fy + L1 + 0.8, z - 0.06], [x + 0.12, fy + L1 + 0.98, z + 0.06], 'lightYellow', false));
        ctx.addLight({ pos: [x, fy + L1 + 0.6, z], color: 0xffd28a, intensity: 0.55, distance: 5 });
      }
      const all = along ? unionRect([deckR, st1.rect, st2.rect, F.rect(s1u, dd, s1u + 0.9, dd + sw), F.rect(s2u - 0.9, dd, s2u, dd + sw)]) : unionRect([deckR, st1.rect, st2.rect, F.rect(a0, dd + run, a1, dd + run + 0.9)]);
      ctx.keepOut({ min: [all.x0 - 0.3, fy, all.z0 - 0.3], max: [all.x1 + 0.3, fy + H, all.z1 + 0.3] });
      return true;
    }
    return false;
  },
});

// ---------------------------------------------------------------- S27 一つの部屋が何層も

defineRoomShape({
  id: 'layers', idea: 'S27', name: '一つの部屋が何層も', kinds: ['room', 'hall'], minSize: [4.2, 5.6], minHeight: 2.3, maxHeight: 3.2, weight: 0.9,
  anomalies: LOOK,
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    const slab = 0.2, step = h + slab;
    const sw = 1.15, riseMax = 0.2, tread = 0.27;
    const ns = stepCount(step, riseMax), run = ns * tread;
    // 段を沿わせる壁: 長い辺の 2 枚（向かい合う）。0 → 1 層は 1 枚目、1 → 2 層は向かいの壁
    const alongX = rectW(r) >= rectD(r);
    const walls: Dir[] = alongX ? [2, 0] : [3, 1];
    const plan: { F: WallFrame; d: Dir; su: number; dir: Dir; rect: Rect; foot: Rect; top: Rect; wide: Rect }[] = [];
    for (const d of ctx.rng.chance(0.5) ? walls : walls.slice().reverse()) {
      const F = wallFrame(r, d);
      if (F.u1 - F.u0 < run + 1.2) continue;
      const up = ctx.rng.chance(0.5);
      const su = up ? F.u0 + 1.0 : F.u1 - 1.0; // 上り始め
      const rect = F.rect(Math.min(su, su + (up ? run : -run)), 0, Math.max(su, su + (up ? run : -run)), sw);
      const wide = F.rect(Math.min(su, su + (up ? run : -run)) - 0.05, 0, Math.max(su, su + (up ? run : -run)) + 0.05, sw + 0.55);
      const foot = F.rect(up ? su - 0.95 : su, 0, up ? su : su + 0.95, sw);
      // 0 層の段は開口の前に掛からない
      if (!plan.length && !clearOfDoors(ctx, unionRect([rect, foot]), 1.6, 0.45)) continue;
      if (plan.some((p) => rectsHit(p.wide, wide) || rectsHit(p.foot, wide) || rectsHit(p.top, wide))) continue;
      // 上りきった先（上の層で段から下りる所）も空ける
      const top = F.rect(up ? su + run : su - run - 1.1, 0, up ? su + run + 1.1 : su - run, sw + 0.3);
      plan.push({ F, d, su, dir: uDir(d, up ? 1 : -1), rect, foot, top, wide });
    }
    if (!plan.length) return false;
    // 0 層の段の足元まで歩いて行ける目印（上の層の段の足元は、写した家具が 0 層と同じ所を空けるので同じく行ける）
    for (const p of plan) {
      const upward = p.dir === uDir(p.d, 1);
      reachMark(ctx, p.d, upward ? p.su - 0.45 : p.su + 0.45);
      const ta = upward ? p.su + run + 0.6 : p.su - run - 0.6;
      if (ta > p.F.u0 + 0.5 && ta < p.F.u1 - 0.5) reachMark(ctx, p.d, ta);
    }
    // 0 層の家具（段・穴の所は空ける）。上の層へ写す
    const keep = plan.flatMap((p) => [p.wide, p.foot, p.top]).map((q) => ({ min: [q.x0 - 0.25, fy, q.z0 - 0.25] as [number, number, number], max: [q.x1 + 0.25, fy + h, q.z1 + 0.25] as [number, number, number] }));
    const d0 = subDress(ctx, { rects: cell.footprint, openings: ctx.geo.openings, keepOut: keep, tag: 'L0', noHung: true });
    const n = plan.length >= 2 && h <= 2.85 && d0.boxes.length * 3 < t['rooms.maxBoxes'] - 200 ? 3 : 2;
    if (d0.boxes.length * n > t['rooms.maxBoxes'] - 150) return false;
    if (!raiseCeiling(ctx, n * step - slab)) return false;
    clearCeilingLights(cell);
    for (let k = 1; k < n; k++) {
      // 穴は段の開いた側に 0.45 m 広く（段の縁に体が掛かったまま上の床に乗って、下りられなくならないように）
      const holeX: Rect = plan[k - 1]!.wide;
      const y = fy + k * step;
      for (const q of fillRects(r, [holeX])) {
        ctx.addBox(rbox(q, y - slab, y - 0.06, cell.palette.ceiling));
        const top = rbox(q, y - 0.06, y, cell.palette.floor);
        top.kind = 'landing';
        ctx.addBox(top);
      }
      // 穴の縁（段の上の端と壁の側は除く）
      const p = plan[k - 1]!;
      const F = p.F;
      const lowU = p.su, highU = p.su + (p.dir === uDir(p.d, 1) ? run : -run);
      // 長い辺は低い縁だけ（手すりにすると、下の段を上る人の頭が当たる）。段の下の端の側に手すり
      const curb = F.rect(Math.min(lowU, highU), sw + 0.5, Math.max(lowU, highU), sw + 0.55);
      ctx.addBox(rbox(curb, y, y + 0.08, 'trim', false));
      const [bx0, bz0] = F.point(lowU, 0), [bx1, bz1] = F.point(lowU, sw + 0.5);
      railing(ctx, bx0, bz0, bx1, bz1, y);
    }
    // 段（k 層 → k + 1 層）
    for (let k = 0; k + 1 < n; k++) {
      const p = plan[k]!;
      const [sx, sz] = p.F.point(p.su, sw / 2);
      stairs(ctx, { x: sx, z: sz, dir: p.dir, width: sw, y0: fy + k * step, y1: fy + (k + 1) * step, riseMax, tread, mat: cell.palette.floor, rails: 'both', railMat: 'handrailWood' });
    }
    // 層ごとの天井の照明（穴の上は除く）
    for (let k = 0; k < n; k++) {
      const ceil = fy + (k + 1) * step - slab;
      const before = cell.boxes.length;
      lightGridAt(ctx, [r], ceil, 3.0, 0.9);
      const hole = k + 1 < n ? plan[k]!.wide : null;
      if (hole) {
        const added = cell.boxes.slice(before);
        const bad = new Set(added.filter((b) => rectsHit(footOf(b), hole)));
        cell.boxes = cell.boxes.filter((b) => !bad.has(b));
        cell.lights = cell.lights.filter((l) => !(Math.abs(l.pos[1] - (ceil - 0.4)) < 1e-3 && inRect(hole, l.pos[0], l.pos[2])));
      }
    }
    // 家具: 0 層の物をどの層にも（上の層の扉の所には開かない扉）
    for (let k = 1; k < n; k++) {
      const dy = k * step;
      const copies = d0.boxes.map((b) => ({ ...b, min: [b.min[0], b.min[1] + dy, b.min[2]] as [number, number, number], max: [b.max[0], b.max[1] + dy, b.max[2]] as [number, number, number], ...(b.propGroup ? { propGroup: b.propGroup.replace(`${cell.id}/`, `${cell.id}/L${k}-`) } : {}) }));
      for (const b of copies) ctx.addBox(b);
      ctx.geo.openings.forEach((o, i) => {
        if (Math.abs(o.pos[1] - fy) > 0.05) return;
        const at = o.dir === 0 || o.dir === 2 ? o.pos[0] : o.pos[2];
        lockedDoor(ctx, `L${k}door${i}`, o.dir, at, fy + dy, wallFaceOf(r, o.dir));
      });
    }
    useDress(ctx, d0);
    return true;
  },
});

// ---------------------------------------------------------------- S29 階段だけの部屋

defineRoomShape({
  id: 'stairsOnly', idea: 'S29', name: '階段だけの部屋', kinds: ['room', 'hall'], minSize: [4.6, 5.6], minHeight: 2.4, weight: 0.9,
  anomalies: LOOK,
  build(ctx) {
    const cell = ctx.cell, fy = ctx.fy, r = ctx.inner;
    const free = freeWalls(ctx);
    if (!free.length) return false;
    const d = free.slice().sort((a, b) => { const fa = wallFrame(r, a), fb = wallFrame(r, b); return (fb.u1 - fb.u0) - (fa.u1 - fa.u0); })[0]!;
    const F = wallFrame(r, d);
    const len = F.u1 - F.u0;
    const sw = 0.9, riseMax = 0.2, tread = 0.27, pad = 1.0;
    const fh = 1.2; // 1 本の階段で上がる高さ
    const nps = stepCount(fh, riseMax), run = nps * tread;
    if (len < run + 2 * pad + 0.4) return false;
    // 折り返しの数: 部屋の奥行きと天井で（外の帯から壁の方へ、1 本ごとに 1 帯ずつ壁へ寄る）
    const m = Math.max(2, Math.min(4, Math.floor((F.depth - 2.0) / sw)));
    const top = fy + m * fh;
    const H = Math.max(ctx.h, snap(top - fy + 2.2));
    const span = F.rect(F.u0, 0, F.u1, m * sw + 0.2);
    if (!clearOfDoors(ctx, span, 1.6, 0.45)) return false;
    if (H > ctx.h + 1e-3 && !raiseCeiling(ctx, H)) return false;
    const u0 = F.u0 + pad + 0.2, u1 = u0 + run;
    for (let j = 0; j < m; j++) {
      const band = m - 1 - j; // 外の帯から
      const v = band * sw + sw / 2;
      const up = j % 2 === 0;
      const su = up ? u0 : u1;
      const [sx, sz] = F.point(su, v);
      stairs(ctx, { x: sx, z: sz, dir: uDir(d, up ? 1 : -1), width: sw, y0: fy + j * fh, y1: fy + (j + 1) * fh, riseMax, tread, mat: cell.palette.floor, thin: j === 0 ? undefined : 0.18, rails: 'both', railMat: 'metal' });
      // 踊り場（次の帯へ渡る。最後は壁際の台）
      const pu0 = up ? u1 : u0 - pad, pu1 = up ? u1 + pad : u0;
      const pv0 = Math.max(0, band - 1) * sw, pv1 = (band + 1) * sw;
      const pr = F.rect(pu0, j === m - 1 ? 0 : pv0, pu1, j === m - 1 ? sw : pv1);
      deck(ctx, pr, fy + (j + 1) * fh, cell.palette.floor, 0.15);
    }
    // 上りきった所: 壁に開かない扉
    const lastUp = (m - 1) % 2 === 0;
    const du = lastUp ? u1 + pad / 2 : u0 - pad / 2;
    lockedDoor(ctx, 'topDoor', d, du, top, wallFaceOf(r, d));
    // どこへも行かない階段（部屋の真ん中寄り。宙で終わる）
    const opp = ((d + 2) % 4) as Dir;
    const G = wallFrame(r, opp);
    const runF = stepCount(2.2, riseMax) * tread;
    for (const gu of ctx.rng.shuffle([G.u0 + 0.6, G.u1 - 0.6 - sw])) {
      // 部屋の真ん中寄りから壁の方へ上り、壁の手前 0.3 m の宙で終わる
      const q = G.rect(gu, 0, gu + sw, runF + 1.3);
      if (!clearOfDoors(ctx, q, 1.6, 0.45) || rectsHit(q, span)) continue;
      const [sx, sz] = G.point(gu + sw / 2, runF + 0.3);
      stairs(ctx, { x: sx, z: sz, dir: opp, width: sw, y0: fy, y1: fy + 2.2, riseMax, tread, mat: cell.palette.floor, rails: 'both', railMat: 'metal' });
      break;
    }
    // 天井に逆さの階段・壁を横に走る階段（描画だけ）
    const Hc = cell.height;
    const [cx, cz] = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
    const ax: 'x' | 'z' = d === 0 || d === 2 ? 'x' : 'z';
    for (let i = 0; i < 8; i++) {
      const a = -1.2 + i * 0.3;
      const y1 = fy + Hc, y0 = y1 - 0.2 * (i + 1);
      ctx.addBox(ax === 'x' ? box([cx + a, y0, cz - 0.45], [cx + a + 0.3, y1, cz + 0.45], cell.palette.floor, false) : box([cx - 0.45, y0, cz + a], [cx + 0.45, y1, cz + a + 0.3], cell.palette.floor, false));
    }
    const wf = wallFaceOf(r, opp), sg2 = opp === 0 || opp === 1 ? -1 : 1;
    for (let i = 0; i < 7; i++) {
      const y = fy + 2.6 + i * 0.27 * 0.6;
      const a = (G.u0 + G.u1) / 2 - 1.0 + i * 0.3;
      const [px, pz] = G.point(a, 0);
      const d0 = wf, d1 = wf + sg2 * (0.2 * (i + 1));
      if (y + 0.3 > fy + Hc) break;
      ctx.addBox(opp === 1 || opp === 3 ? box([Math.min(d0, d1), y, pz], [Math.max(d0, d1), y + 0.27, pz + 0.3], cell.palette.floor, false) : box([px, y, Math.min(d0, d1)], [px + 0.3, y + 0.27, Math.max(d0, d1)], cell.palette.floor, false));
    }
    ctx.skipDress();
    return true;
  },
});

// ---------------------------------------------------------------- S19 天井から下がる階段

defineRoomShape({
  id: 'atticStair', idea: 'S19', name: '天井から下がる階段', kinds: ['room', 'hall'], minSize: [3.8, 4.6], minHeight: 2.4, maxHeight: 3.4, weight: 0.9,
  anomalies: ['dark', 'fog', 'tint', 'clocks', 'tiny', 'scatter'],
  build(ctx) {
    const cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner, R = ctx.rect;
    const AH = snap(ctx.rng.float(1.5, 1.9));
    const af = fy + h + 0.25; // 屋根裏の床の上面
    const ridge = af + AH;
    const sw = 0.7, riseMax = 0.27, tread = 0.24;
    const n = stepCount(af - fy, riseMax), run = n * tread, rs = (af - fy) / n;
    // 階段は棟の下（長い向き、部屋の真ん中の線）: 上りきった所で屋根裏の天井がいちばん高い
    const alongX = rectW(R) >= rectD(R);
    const A0 = alongX ? r.x0 : r.z0, A1 = alongX ? r.x1 : r.z1;
    const c0 = alongX ? r.z0 : r.x0, c1 = alongX ? r.z1 : r.x1, cm = (c0 + c1) / 2;
    const stripe = (a: number, b: number, c: number, w: number): Rect => (alongX ? { x0: Math.min(a, b), x1: Math.max(a, b), z0: c - w / 2, z1: c + w / 2 } : { z0: Math.min(a, b), z1: Math.max(a, b), x0: c - w / 2, x1: c + w / 2 });
    for (const up of ctx.rng.shuffle([true, false])) {
      if (A1 - A0 < run + 1.0 + 0.8) break;
      const su = up ? A0 + 1.0 : A1 - 1.0;
      const hi = su + (up ? run : -run);
      const sc = cm + snap(ctx.rng.float(-0.3, 0.3));
      if (!clearOfDoors(ctx, stripe(up ? A0 - 0.2 : A1 - 1.0, up ? A0 + 1.0 : A1 + 0.2, sc, 1.8), 1.0, 0.3)) continue;
      const sr = stripe(su, hi, sc, sw);
      const foot = stripe(up ? su - 0.95 : su, up ? su : su + 0.95, sc, sw);
      if (!clearOfDoors(ctx, unionRect([sr, foot]), 1.6, 0.45)) continue;
      // 天井の口: 立った頭が天井に当たり始める段から、上の端まで（その先はすぐ屋根裏の床）
      const first = Math.max(0, Math.floor((h - 1.8) / rs) - 1);
      const hu0 = su + (up ? 1 : -1) * first * tread, hu1 = hi;
      const hatch = stripe(hu0, hu1, sc, sw + 0.2);
      if (!ctx.claim(fy + h, ridge + 0.25, unionRect(cell.footprint))) return false;
      cutCeiling(cell, hatch);
      clearCeilingLights(cell, (x, z) => inRect({ x0: hatch.x0 - 0.4, z0: hatch.z0 - 0.4, x1: hatch.x1 + 0.4, z1: hatch.z1 + 0.4 }, x, z));
      // 段の足元は端の壁際: 床から歩いて行ける目印
      reachMark(ctx, alongX ? (up ? 3 : 1) : (up ? 2 : 0), sc);
      // 急な階段（宙に浮いた薄い踏み板）と口の枠
      const [sx, sz] = alongX ? [su, sc] : [sc, su];
      stairs(ctx, { x: sx, z: sz, dir: alongX ? (up ? 1 : 3) : (up ? 0 : 2), width: sw, y0: fy, y1: af, riseMax, tread, mat: 'woodPanel', thin: 0.05, rails: 'both', railMat: 'handrailWood' });
      ctx.addBox(rbox({ x0: hatch.x0 - 0.06, z0: hatch.z0 - 0.06, x1: hatch.x1 + 0.06, z1: hatch.z1 + 0.06 }, fy + h - 0.03, fy + h, 'trim', false));
      // 屋根裏: 床板（口は開ける）・壁（壁の帯の上に板）・切妻の屋根（傾けた板と当たり判定）・てっぺんの板
      for (const q of fillRects(R, [hatch])) {
        const b = rbox(q, fy + h + 0.2, af, 'floorWood');
        b.kind = 'landing';
        ctx.addBox(b);
      }
      for (const b of cell.boxes.slice()) {
        if (!isWallBox(cell, b) || Math.abs(b.max[1] - (fy + h)) > 1e-3) continue;
        ctx.addBox(box([b.min[0], fy + h, b.min[2]], [b.max[0], ridge + 0.2, b.max[2]], 'woodPanel'));
      }
      const eave = af + 0.45;
      const axis: 'x' | 'z' = alongX ? 'z' : 'x';
      for (const [p, q] of [[c0, cm], [cm, c1]] as const) {
        const lowAtMin = p === c0;
        const y0 = lowAtMin ? eave : ridge;
        const roof = alongX ? box([r.x0, y0, p], [r.x1, y0 + 0.08, q], 'woodPanel', false) : box([p, y0, r.z0], [q, y0 + 0.08, r.z1], 'woodPanel', false);
        roof.slope = { axis, rise: lowAtMin ? ridge - eave : eave - ridge };
        ctx.addBox(roof);
        // 当たり判定: 屋根より上を段で塞ぐ
        const k = 6;
        for (let i = 0; i < k; i++) {
          const a = p + ((q - p) * i) / k, b2 = p + ((q - p) * (i + 1)) / k;
          const ya = lowAtMin ? eave + ((ridge - eave) * (a - c0)) / (cm - c0) : ridge - ((ridge - eave) * (a - cm)) / (c1 - cm);
          const yb = lowAtMin ? eave + ((ridge - eave) * (b2 - c0)) / (cm - c0) : ridge - ((ridge - eave) * (b2 - cm)) / (c1 - cm);
          const col = alongX ? box([r.x0, Math.min(ya, yb), a], [r.x1, ridge + 0.2, b2], 'woodPanel') : box([a, Math.min(ya, yb), r.z0], [b2, ridge + 0.2, r.z1], 'woodPanel');
          col.kind = 'colliderOnly';
          ctx.addBox(col);
        }
      }
      ctx.addBox(rbox(R, ridge + 0.2, ridge + 0.25, 'woodPanel'));
      // 屋根裏の物: 箱・旅行鞄・古い椅子・裸電球・切妻の小さな窓
      const items: [number, number, number, number, MatId][] = [];
      for (let i = 0; i < 6; i++) {
        const s = ctx.rng.float(0.35, 0.6);
        const along2 = ctx.rng.float(alongX ? r.x0 + 0.4 : r.z0 + 0.4, alongX ? r.x1 - 0.4 : r.z1 - 0.4);
        const near = ctx.rng.chance(0.5) ? c0 + 0.35 + s / 2 : c1 - 0.35 - s / 2;
        const [x, z] = alongX ? [along2, near] : [near, along2];
        if (inRect({ x0: hatch.x0 - 0.5, z0: hatch.z0 - 0.5, x1: hatch.x1 + 0.5, z1: hatch.z1 + 0.5 }, x, z)) continue;
        if (items.some(([ix, iz, is]) => Math.abs(ix - x) < (is + s) / 2 + 0.05 && Math.abs(iz - z) < (is + s) / 2 + 0.05)) continue;
        items.push([x, z, s, ctx.rng.float(0.3, Math.min(0.6, eave - af + 0.2)), ctx.rng.pick<MatId>(['boxCardboard', 'boxCardboard', 'furnitureDark', 'woodPanel'])]);
      }
      for (const [x, z, s, hh, m] of items) ctx.addBox(box([x - s / 2, af, z - s / 2], [x + s / 2, af + hh, z + s / 2], m));
      const [mx, mz] = alongX ? [(r.x0 + r.x1) / 2, cm] : [cm, (r.z0 + r.z1) / 2];
      ctx.addBox(box([mx - 0.005, ridge - 0.45, mz - 0.005], [mx + 0.005, ridge, mz + 0.005], 'metalDark', false));
      ctx.addBox(box([mx - 0.045, ridge - 0.55, mz - 0.045], [mx + 0.045, ridge - 0.45, mz + 0.045], 'lightWarm', false));
      ctx.addLight({ pos: [mx, ridge - 0.7, mz], color: 0xffc27a, intensity: 0.45, distance: Math.max(rectW(R), rectD(R)) * 0.8 });
      const gx = alongX ? r.x0 : mx, gz = alongX ? mz : r.z0;
      ctx.addBox(alongX ? box([gx, af + 0.55, gz - 0.3], [gx + 0.01, af + 1.05, gz + 0.3], 'windowNight', false) : box([gx - 0.3, af + 0.55, gz], [gx + 0.3, af + 1.05, gz + 0.01], 'windowNight', false));
      ctx.keepOut({ min: [Math.min(sr.x0, foot.x0) - 0.2, fy, Math.min(sr.z0, foot.z0) - 0.2], max: [Math.max(sr.x1, foot.x1) + 0.2, fy + h, Math.max(sr.z1, foot.z1) + 0.2] });
      return true;
    }
    return false;
  },
});

