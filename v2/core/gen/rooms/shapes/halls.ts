/**
 * 広い空間の形 [QR の空間の型]: 柱林（S01）・大広間（S02）・縦長ホール（S03）。
 * - 柱林: 部屋いっぱいに太い柱が格子に並ぶ。柱の陰で先が見えず、柱の間を縫って進む（地下の貯水槽のよう）
 * - 大広間: 天井が高く、壁際に列柱。真ん中に絨毯の道とシャンデリア（広間だけ）
 * - 縦長ホール: 部屋の幅の 2 倍以上の高さ。壁の縦の光の筋・高い所の窓・届かない高さの扉・長い吊り照明
 */
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_W, type Box, type MatId } from '../../../world/layout.ts';
import { decorDoor } from '../../dress/decor.ts';
import { alongFace, freeRuns, innerFaces, type Face } from '../../dress/geom.ts';
import { defineRoomShape, type RoomShapeContext } from '../types.ts';
import {
  clearCeilingLights, clearOfDoors, column, frontPt, MAZE_THEMES, raiseCeiling, rectD, rectsHit, rectW, snap,
} from '../util.ts';

/** テーマに合う柱の材質 */
function columnMat(ctx: RoomShapeContext): MatId {
  const th = ctx.cell.theme ?? '';
  if (/Gallery|AtriumLobby|Hotel|Theater/.test(th)) return ctx.rng.pick<MatId>(['marbleWhite', 'columnConcrete']);
  if (/Pool|Restroom|LockerRoom|Transit|Terminal/.test(th)) return ctx.rng.pick<MatId>(['floorTile', 'columnConcrete']);
  return ctx.rng.pick<MatId>(['columnConcrete', 'columnConcrete', ctx.cell.palette.wall]);
}

/** 区画の壁の室内面（足跡から。開口は openings で避ける） */
const facesOf = (ctx: RoomShapeContext): Face[] => innerFaces(ctx.cell.footprint);

/**
 * S01 柱林: 部屋いっぱいの柱の格子（太さ 0.45〜0.75 m、柱の間は体の幅より広い 1.25 m 以上）。柱の頭は少し広がった台輪。
 * 照明は柱の間の升目ごと（柱に照明が埋まらない）。家具は壁際だけ（柱の林の中は空ける）
 */
defineRoomShape({
  id: 'pillars', idea: 'S01', name: '柱林', kinds: ['room', 'hall'], minSize: [4.6, 5.2], minHeight: 2.4, weight: 1.2,
  anomalies: ['dark', 'fog', 'tint', 'clocks', 'giant', 'tiny', 'scatter', 'multiply'],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, h = ctx.h, r = ctx.inner;
    // 太さと間（広い部屋ほど太く、間も揺らす）。柱が 4 本以上並ばなければ細く・詰めてもう一度
    let size = snap(ctx.rng.float(t['rooms.pillars.sizeMin'], Math.max(t['rooms.pillars.sizeMin'], t['rooms.pillars.sizeMax'])));
    let gap = t['rooms.pillars.gapM'] + ctx.rng.float(0, 0.6);
    const along = (len: number): number[] => {
      const n = Math.floor((len - gap) / (size + gap));
      if (n < 1) return [];
      const g = (len - n * size) / (n + 1);
      return [...Array(n).keys()].map((i) => g * (i + 1) + size * (i + 0.5));
    };
    let xs = along(rectW(r)).map((v) => r.x0 + v), zs = along(rectD(r)).map((v) => r.z0 + v);
    if (xs.length * zs.length < 4) {
      size = t['rooms.pillars.sizeMin'];
      gap = t['rooms.pillars.gapM'];
      xs = along(rectW(r)).map((v) => r.x0 + v);
      zs = along(rectD(r)).map((v) => r.z0 + v);
    }
    if (xs.length * zs.length < 4) return false;
    const mat = columnMat(ctx);
    const cap: MatId = mat === 'marbleWhite' ? 'goldTrim' : mat === 'floorTile' ? 'trim' : mat;
    let made = 0;
    const cols: Rect[] = [];
    for (const x of xs) for (const z of zs) {
      const c: Rect = { x0: x - size / 2, z0: z - size / 2, x1: x + size / 2, z1: z + size / 2 };
      if (!clearOfDoors(ctx, c, 1.5, 0.35)) continue;
      column(ctx, x, z, size, fy, fy + h, mat, null);
      // 柱の頭の広がり（茸のような台輪）と根元
      ctx.addBox(box([x - size / 2 - 0.12, fy + h - 0.22, z - size / 2 - 0.12], [x + size / 2 + 0.12, fy + h, z + size / 2 + 0.12], cap, false));
      ctx.addBox(box([x - size / 2 - 0.05, fy, z - size / 2 - 0.05], [x + size / 2 + 0.05, fy + 0.1, z + size / 2 + 0.05], cap, false));
      cols.push(c);
      made++;
    }
    if (made < 3) return false;
    // 照明: 柱の間の升目の真ん中（2 つに 1 つ点光源）
    clearCeilingLights(cell);
    const mids = (vs: number[], lo: number, hi: number): number[] => {
      const a = [lo, ...vs, hi];
      return a.slice(1).map((v, i) => (a[i]! + v) / 2);
    };
    const mx = mids(xs, r.x0, r.x1), mz = mids(zs, r.z0, r.z1);
    let k = 0;
    for (const x of mx) for (const z of mz) {
      const pw = Math.min(0.9, gap - 0.2);
      const p: Rect = { x0: x - pw / 2, z0: z - pw / 2, x1: x + pw / 2, z1: z + pw / 2 };
      if (cols.some((c) => rectsHit(c, p))) continue;
      ctx.addBox(box([p.x0, fy + h - 0.035, p.z0], [p.x1, fy + h - 0.005, p.z1], cell.palette.light, false));
      if (k++ % 2 === 0 && cell.lights.length < t['rooms.maxLights']) ctx.addLight({ pos: [x, fy + h - 0.4, z], color: cell.palette.lightColor, intensity: cell.palette.lightIntensity, distance: 6 });
    }
    // 家具は壁際だけ（柱の林の中は空ける）
    if (rectW(r) > 2.2 && rectD(r) > 2.2) ctx.keepOut({ min: [r.x0 + 1.0, fy, r.z0 + 1.0], max: [r.x1 - 1.0, fy + h, r.z1 - 1.0] });
    return true;
  },
});

/**
 * S02 大広間: 広間と大きな部屋（7 m 以上）。天井が元の 1.8 倍（上限 10 m）。壁から 1.5 m の所に列柱（扉の前は空ける）、真ん中に絨毯の道、天井からシャンデリア。
 * 腰板と天井の縁の帯。家具は列柱の外（壁際）と、道の脇の長椅子だけ（広い床を空ける）
 */
defineRoomShape({
  id: 'grandHall', idea: 'S02', name: '大広間', kinds: ['hall', 'room'], minSize: [7.2, 7.6], minHeight: 2.6, weight: 1.2,
  anomalies: ['dark', 'fog', 'clocks', 'tiny', 'scatter'],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, r = ctx.inner;
    let H = 0;
    for (const k of [1, 0.8, 0.65]) {
      const cand = snap(Math.min(t['rooms.grand.heightMaxM'], ctx.h * t['rooms.grand.heightMul']) * k);
      if (cand < ctx.h + 1.2) break;
      if (raiseCeiling(ctx, cand)) { H = cand; break; }
    }
    if (!H) return false;
    clearCeilingLights(cell);
    const mat = ctx.rng.pick<MatId>(['marbleWhite', 'columnConcrete', 'marbleWhite']);
    const cap: MatId = mat === 'marbleWhite' ? 'goldTrim' : 'trim';
    const off = 1.55, size = 0.7, pitch = t['rooms.grand.columnPitchM'];
    const ring: Rect = { x0: r.x0 + off, z0: r.z0 + off, x1: r.x1 - off, z1: r.z1 - off };
    const pts: [number, number][] = [];
    const line = (ax: number, az: number, bx: number, bz: number): void => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / pitch));
      for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
    };
    line(ring.x0, ring.z0, ring.x1, ring.z0); line(ring.x1, ring.z0, ring.x1, ring.z1); line(ring.x1, ring.z1, ring.x0, ring.z1); line(ring.x0, ring.z1, ring.x0, ring.z0);
    let made = 0;
    for (const [x, z] of pts) {
      const c: Rect = { x0: x - size / 2, z0: z - size / 2, x1: x + size / 2, z1: z + size / 2 };
      if (!clearOfDoors(ctx, c, 2.8, 0.6)) continue;
      column(ctx, x, z, size, fy, fy + H, mat, cap);
      made++;
    }
    if (made < 4) return false;
    // 腰板・天井の縁の帯（壁の室内面。開口は避ける）
    for (const f of facesOf(ctx)) {
      for (const [p, q] of freeRuns(f, ctx.geo.openings, 0.08, 0)) {
        ctx.addBox(alongFace(f, p, q - p, 0, 0.03, fy, fy + 1.1, 'woodPanel', false));
        ctx.addBox(alongFace(f, p, q - p, 0.03, 0.05, fy + 1.1, fy + 1.16, 'goldTrim', false));
      }
      ctx.addBox(alongFace(f, f.a0, f.a1 - f.a0, 0, 0.18, fy + H - 0.3, fy + H, 'trim', false));
    }
    // 絨毯の道: 入口の前から部屋の中心を通って出口の前へ（L 字にもなる）
    const [cx, cz] = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
    const rug = (ax: number, az: number, bx: number, bz: number): void => {
      const w = 1.0;
      const x0 = Math.min(ax, bx) - (ax === bx ? w : 0), x1 = Math.max(ax, bx) + (ax === bx ? w : 0);
      const z0 = Math.min(az, bz) - (az === bz ? w : 0), z1 = Math.max(az, bz) + (az === bz ? w : 0);
      ctx.addBox(box([x0, fy, z0], [x1, fy + 0.012, z1], 'floorCarpetRed', false));
    };
    for (const o of [ctx.entrance, ...(ctx.exit ? [ctx.exit] : [])]) {
      const [px, pz] = frontPt(o, 0.3);
      if (o.dir === 0 || o.dir === 2) { rug(px, pz, px, cz); rug(px, cz, cx, cz); } else { rug(px, pz, cx, pz); rug(cx, pz, cx, cz); }
    }
    // シャンデリア: 中心線に 1〜3。金の枠・小さな灯り 8 つ・天井からの鎖・点光源 1 つ
    const alongX = rectW(r) >= rectD(r);
    const nCh = Math.max(1, Math.min(3, Math.round((alongX ? rectW(r) : rectD(r)) / 8)));
    for (let i = 0; i < nCh; i++) {
      const u = (i + 0.5) / nCh;
      const x = alongX ? r.x0 + rectW(r) * u : cx, z = alongX ? cz : r.z0 + rectD(r) * u;
      const y = fy + Math.max(3.4, H - 2.0);
      const add = (b: Box): void => { ctx.addBox(b); };
      add(box([x - 0.02, y + 0.5, z - 0.02], [x + 0.02, fy + H, z + 0.02], 'metalDark', false));
      add(box([x - 0.12, y, z - 0.12], [x + 0.12, y + 0.5, z + 0.12], 'goldTrim', false));
      for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        add(box([x + sx * 0.75 - (sx ? 0.02 : 0.75), y + 0.08, z + sz * 0.75 - (sz ? 0.02 : 0.75)], [x + sx * 0.75 + (sx ? 0.02 : 0.75), y + 0.12, z + sz * 0.75 + (sz ? 0.02 : 0.75)], 'goldTrim', false));
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const bx = x + Math.cos(a) * 0.72, bz = z + Math.sin(a) * 0.72;
        add(box([bx - 0.05, y + 0.12, bz - 0.05], [bx + 0.05, y + 0.3, bz + 0.05], 'lightWarm', false));
      }
      ctx.addLight({ pos: [x, y - 0.1, z], color: 0xffd9a0, intensity: cell.palette.lightIntensity * t['rooms.grand.chandelier'], distance: Math.max(10, H * 1.6) });
    }
    // 広い床を空ける: 家具は列柱の外（壁際）だけ。道の脇に長椅子
    ctx.keepOut({ min: [ring.x0 - 0.2, fy, ring.z0 - 0.2], max: [ring.x1 + 0.2, fy + 3, ring.z1 + 0.2] });
    for (const s of [-1, 1]) {
      const bx = alongX ? cx : cx + s * 2.2, bz = alongX ? cz + s * 2.2 : cz;
      const len = 1.8;
      const seat: Rect = alongX ? { x0: bx - len / 2, x1: bx + len / 2, z0: bz - 0.22, z1: bz + 0.22 } : { x0: bx - 0.22, x1: bx + 0.22, z0: bz - len / 2, z1: bz + len / 2 };
      if (!clearOfDoors(ctx, seat, 2.0, 0.5) || seat.x0 < ring.x0 + 0.6 || seat.x1 > ring.x1 - 0.6 || seat.z0 < ring.z0 + 0.6 || seat.z1 > ring.z1 - 0.6) continue;
      const b1 = box([seat.x0, fy + 0.4, seat.z0], [seat.x1, fy + 0.46, seat.z1], 'woodPanel');
      ctx.addBox(b1);
      for (const e of [-1, 1]) {
        const lx = alongX ? bx + e * (len / 2 - 0.12) : bx, lz = alongX ? bz : bz + e * (len / 2 - 0.12);
        const leg = box([lx - (alongX ? 0.04 : 0.2), fy, lz - (alongX ? 0.2 : 0.04)], [lx + (alongX ? 0.04 : 0.2), fy + 0.4, lz + (alongX ? 0.2 : 0.04)], 'metalDark', false);
        ctx.addBox(leg);
      }
    }
    return true;
  },
});

/**
 * S03 縦長ホール: 部屋の幅の 2 倍以上（9〜15 m）の高さ。長い壁に縦の光の筋、短い壁の高い所に窓（奥に別の部屋が見える）と、
 * 届かない高さの扉。天井から長さの違う吊り照明が下がる
 */
defineRoomShape({
  id: 'tallHall', idea: 'S03', name: '縦長ホール', kinds: ['room', 'hall'], minSize: [3.6, 4.8], minHeight: 2.4, maxHeight: 6, weight: 0.8,
  anomalies: ['fog', 'tint', 'clocks', 'giant', 'tiny', 'scatter', 'multiply'],
  fits: (g) => !MAZE_THEMES.has(g.cell.theme ?? ''),
  build(ctx) {
    const t = ctx.tuning, cell = ctx.cell, fy = ctx.fy, r = ctx.inner;
    const narrow = Math.min(rectW(r), rectD(r));
    let H = 0;
    const want = snap(Math.min(t['rooms.tall.heightMaxM'], Math.max(t['rooms.tall.heightMinM'], narrow * t['rooms.tall.ratio'])));
    for (const k of [1, 0.8, 0.65]) {
      const cand = snap(want * k);
      if (cand < ctx.h + 3) break;
      if (raiseCeiling(ctx, cand)) { H = cand; break; }
    }
    if (!H) return false;
    clearCeilingLights(cell);
    const alongX = rectW(r) >= rectD(r);
    const faces = facesOf(ctx);
    const longF = faces.filter((f) => f.horizontal === alongX && f.a1 - f.a0 > 2);
    const shortF = faces.filter((f) => f.horizontal !== alongX && f.a1 - f.a0 > 1.4);
    // 長い壁の縦の光の筋
    for (const f of longF) {
      for (const [p, q] of freeRuns(f, ctx.geo.openings, 0.5)) {
        const n = Math.floor((q - p) / 2.2);
        for (let i = 0; i < n; i++) {
          const at = p + ((q - p) * (i + 0.5)) / n;
          ctx.addBox(alongFace(f, at - 0.09, 0.18, 0, 0.025, fy + 2.6, fy + H - 1.0, 'lightPanel', false));
          ctx.addBox(alongFace(f, at - 0.14, 0.28, 0, 0.012, fy + 2.5, fy + H - 0.9, 'metalDark', false));
        }
      }
    }
    // 短い壁の高い所の窓（奥に別の部屋）と、届かない高さの扉（小さな張り出しの上）
    const doorF = shortF.length ? ctx.rng.pick(shortF) : longF[0];
    for (const f of shortF) {
      const mid = (f.a0 + f.a1) / 2;
      const y0 = fy + H * 0.62, y1 = Math.min(fy + H - 0.8, y0 + 1.5);
      if (f !== doorF) ctx.addBox(alongFace(f, mid - 0.6, 1.2, 0, 0.02, y0, y1, ctx.rng.chance(0.5) ? 'windowLit' : 'windowDark', false));
    }
    if (doorF) {
      const runs = freeRuns(doorF, ctx.geo.openings, 0.4).filter(([p, q]) => q - p > DOOR_W + 0.4);
      const run = runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
      if (run) {
        const at = (run[0] + run[1]) / 2, y = fy + snap(Math.min(H - 3, Math.max(4.5, H * 0.42)));
        const B: Box[] = [];
        decorDoor(B, doorF, at, cell.palette.door);
        for (const b of B) { b.min = [b.min[0], b.min[1] + y, b.min[2]]; b.max = [b.max[0], b.max[1] + y, b.max[2]]; ctx.addBox(b); }
        ctx.addBox(alongFace(doorF, at - 0.75, 1.5, 0, 0.45, y - 0.12, y, 'metalDark', false));
      }
    }
    // 吊り照明: 中心線に 3〜5、長さを変えて
    const n = Math.max(3, Math.min(5, Math.round((alongX ? rectW(r) : rectD(r)) / 1.8)));
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const x = alongX ? r.x0 + rectW(r) * u : (r.x0 + r.x1) / 2 + ctx.rng.float(-0.4, 0.4);
      const z = alongX ? (r.z0 + r.z1) / 2 + ctx.rng.float(-0.4, 0.4) : r.z0 + rectD(r) * u;
      const y = fy + snap(ctx.rng.float(2.9, Math.max(3.2, H * 0.6)));
      const add = (b: Box): void => { ctx.addBox(b); };
      add(box([x - 0.006, y + 0.3, z - 0.006], [x + 0.006, fy + H, z + 0.006], 'metalDark', false));
      add(box([x - 0.2, y + 0.18, z - 0.2], [x + 0.2, y + 0.3, z + 0.2], 'metalDark', false));
      add(box([x - 0.12, y, z - 0.12], [x + 0.12, y + 0.18, z + 0.12], 'lightWarm', false));
      ctx.addLight({ pos: [x, y - 0.1, z], color: 0xffd2a0, intensity: cell.palette.lightIntensity * 0.75, distance: 6 });
    }
    // 天井の真ん中に暗い灯り（見上げたときの目印）
    const [cx, cz] = [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
    ctx.addBox(box([cx - 0.3, fy + H - 0.035, cz - 0.3], [cx + 0.3, fy + H - 0.005, cz + 0.3], cell.palette.light, false));
    return true;
  },
});
