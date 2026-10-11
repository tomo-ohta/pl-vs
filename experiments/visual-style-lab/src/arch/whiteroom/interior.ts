import * as THREE from 'three';
import { Prop, shade, type PropMats, type PropSink } from '../../props/kit.ts';
import { chair, steelShelf, trashBin, extinguisher } from '../../props/lib/index.ts';
import type { Builder, PartOptions } from '../../scenes/Builder.ts';
import { wallWithHoles, type WallHole } from '../kit.ts';
import type { Doors } from './doors.ts';
import { bx } from './geo.ts';
import { fitWindow, roofLight, roofLightHoles, sunPatch, wallFrame, windowHoles, windowSun, type Side } from './light.ts';
import { sunTravel } from './layout.ts';
import type { Court, Mats } from './mats.ts';
import { PC } from './props/court.ts';
import { blackboard, bookcase, coatRail, cot, jar, keyBoard, lectern, longTable, noticeBoard, radiator, schoolDesk, servingCounter, sink, tableTop, toolWall, wallClock, wallCross, wallMap, workbench } from './props/rooms.ts';
import { slabBench } from './props/court.ts';

/**
 * 写っていない所の部屋（建物の塊をくり抜いて、壁・床・天井・扉・灯り・部屋の種類ごとの物を置く）。
 * 建物の塊は carve で「部屋の箱を除いた残り」を箱に分けて置く（見えない所は塊のまま。当たり判定つき）。
 * 部屋の壁は外の材質（中庭の壁）で作り、内側に 1 cm の内装の板（淡い漆喰）を重ねる。
 * 光: 部屋は屋根と壁で日が入らないので、天井の灯りの真下の床だけに四角い光だまり（ctx.addLamp。照らす箱 = 部屋の床の高さ）。
 * 壁・天井は灯りを受けない平らな塗り（灯りの縁のちぎれが壁の大きな白い雲に見えたため。統括の指摘 2026-10-11）。
 */

/** 棚の中身の色（場所の色の表から: 灰緑の箱・生成りの紙・暗い緑の綴じ込み） */
export const SHELF_COLORS = ['#8a978b', '#6d7d72', '#c9ccb6', '#5d7465', '#a9b8ad'];

export type AABB = [number, number, number, number, number, number];

/** 塊（AABB）から穴（AABB の列）を除いた残りを箱で置く */
export function carve(b: Builder, mat: THREE.Material, mass: AABB, holes: AABB[], o: PartOptions = {}): void {
  const hit = holes.filter((h) => h[0] < mass[3] - 1e-4 && h[3] > mass[0] + 1e-4 && h[1] < mass[4] - 1e-4 && h[4] > mass[1] + 1e-4 && h[2] < mass[5] - 1e-4 && h[5] > mass[2] + 1e-4);
  if (!hit.length) {
    bx(b, mat, mass[0], mass[1], mass[2], mass[3], mass[4], mass[5], { collide: true, ...o });
    return;
  }
  const [h, ...rest] = hit;
  const [x0, y0, z0, x1, y1, z1] = mass;
  const hx0 = Math.max(x0, h[0]);
  const hx1 = Math.min(x1, h[3]);
  const hy0 = Math.max(y0, h[1]);
  const hy1 = Math.min(y1, h[4]);
  const hz0 = Math.max(z0, h[2]);
  const hz1 = Math.min(z1, h[5]);
  const parts: AABB[] = [
    [x0, y0, z0, hx0, y1, z1],
    [hx1, y0, z0, x1, y1, z1],
    [hx0, y0, z0, hx1, hy0, z1],
    [hx0, hy1, z0, hx1, y1, z1],
    [hx0, hy0, z0, hx1, hy1, hz0],
    [hx0, hy0, hz1, hx1, hy1, z1],
  ];
  for (const p of parts) if (p[3] - p[0] > 1e-3 && p[4] - p[1] > 1e-3 && p[5] - p[2] > 1e-3) carve(b, mat, p, rest, o);
}

export type RoomKind = 'porter' | 'passage' | 'stair' | 'chapter' | 'library' | 'refectory' | 'workshop' | 'classroom' | 'store' | 'cell' | 'hall';

export interface DoorSpec {
  side: 'n' | 's' | 'w' | 'e';
  /** 壁に沿った開口の中心（場面の座標: n/s の壁なら x、w/e の壁なら z） */
  at: number;
  w: number;
  h: number;
  /** 床からの開口の下端（窓・高い所の扉） */
  y0?: number;
  /** 扉の板を付けない（通り抜け・開いた口） */
  open?: boolean;
  locked?: boolean;
  /** 扉の板が開く向き（+1 = 部屋の中へ） */
  inward?: boolean;
  /** 扉の板の色（既定 暗い灰緑） */
  color?: string;
}

export interface RoomSpec {
  id: string;
  label: string;
  kind: RoomKind;
  court: Court;
  /** 内側の寸法 [x0, z0, x1, z1] */
  rect: [number, number, number, number];
  y0: number;
  y1: number;
  t?: number;
  doors?: DoorSpec[];
  /** 壁の箱を作らない辺（別の物で閉じる。内装の板と扉の板は作る） */
  skip?: ('n' | 's' | 'w' | 'e')[];
  /** 何も作らない辺（吹き抜け・手すり） */
  open?: ('n' | 's' | 'w' | 'e')[];
  /** 天井を作らない（屋根が別にある・吹き抜け） */
  noCeiling?: boolean;
  /** 床の板を作らない（地面のまま） */
  noFloor?: boolean;
  /** 外の材質（壁の箱）。既定は中庭の壁 */
  outer?: string;
  /** 物を置かない */
  bare?: boolean;
  /** 窓（外の明るさの入る壁。3 回目の直し: どの部屋にも窓と日なた） */
  windows?: WinSpec[];
  /** 光の筒（屋根の明かり取り）: 中心 [x, z] の列・一辺・筒の上端（屋根の上面）の高さ */
  roofLights?: { at: [number, number][]; size: number; top: number };
}

/** 窓の列: 壁 side・壁に沿った中心（場面の座標）の列・幅・床からの下端と上端。blind = 外は塊（光庭の曇りガラス。外の面を作らない） */
export interface WinSpec {
  side: Side;
  at: number[];
  w: number;
  y0: number;
  y1: number;
  blind?: boolean;
}

/** 日の入らない向きの窓か（日の水平の進みが窓の内向きに 0.2 より小さい） */
function softWindow(r: RoomSpec, side: Side): boolean {
  const [tx, tz] = sunTravel(r.court);
  const dn = side === 'w' ? tx : side === 'e' ? -tx : side === 'n' ? tz : -tz;
  return dn < 0.2;
}

/** 部屋の開口（扉と窓）を扉の形で（内装の板・巾木・柱型の避ける所） */
function openingsOf(r: RoomSpec, side: Side): DoorSpec[] {
  const ds = (r.doors ?? []).filter((d) => d.side === side);
  const ws = (r.windows ?? []).filter((w) => w.side === side).flatMap((w) => w.at.map((at): DoorSpec => ({ side, at, w: w.w, h: w.y1 - w.y0, y0: w.y0, open: true })));
  return [...ds, ...ws];
}

export function roomBox(r: RoomSpec): AABB {
  const t = r.t ?? 0.3;
  const [x0, z0, x1, z1] = r.rect;
  return [x0 - t, r.y0 - (r.y0 > 0.01 ? 0.3 : 0), z0 - t, x1 + t, r.y1 + (r.noCeiling ? 0 : 0.3), z1 + t];
}

/** 部屋を建物の塊からくり抜く箱（部屋の箱と光の筒） */
export function roomHoles(r: RoomSpec): AABB[] {
  return [roomBox(r), ...roofLightHoles(r), ...windowHoles(r)];
}

/** 局所の座標で形を作り、グループへ出す（扉の板など、まとめない物） */
export function groupSink(g: THREE.Group): PropSink {
  return {
    add: (geo, mat, shadow) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow === true || shadow === 'cast';
      m.receiveShadow = shadow === true || shadow === 'receive';
      g.add(m);
    },
    collide: () => {},
  };
}

/** 扉の板（吊り元が原点、+x へ幅 w） */
export function doorLeaf(pm: PropMats, w: number, h: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const p = new Prop(groupSink(g), pm, new THREE.Matrix4());
  p.box(color, [0.01, 0.01, -0.025], [w - 0.01, h - 0.01, 0.025], { r: 0.006 });
  // 鏡板（扉の色より少し暗い・少し出た板）
  p.box(shade(color, -0.25), [0.06, 0.08, 0.025], [w - 0.06, h - 0.08, 0.03], { shadow: false });
  p.box(PC.metal, [w - 0.14, 0.95, 0.03], [w - 0.09, 1.1, 0.04], { shadow: false });
  p.rod(PC.metal, [w - 0.17, 1.04, 0.07], [w - 0.06, 1.04, 0.07], 0.009, { shadow: false });
  p.box(PC.metal, [w - 0.14, 0.95, -0.04], [w - 0.09, 1.1, -0.03], { shadow: false });
  return g;
}

export interface RoomKit {
  b: Builder;
  m: Mats;
  pm: PropMats;
  doors: Doors;
  sink: PropSink;
}

/** 部屋を作る: 壁（開口つき）・内装の板・床・天井・扉の板・灯り・物 */
export function buildRoom(k: RoomKit, r: RoomSpec): void {
  const { b, m } = k;
  const ctx = b.ctx;
  const t = r.t ?? 0.3;
  const [x0, z0, x1, z1] = r.rect;
  const outer = m.get(r.court, r.outer ?? 'wall');
  const inWall = m.get(r.court, 'inWall');
  const inFloor = m.get(r.court, 'inFloor', { brush: 'floor' });
  const inCeil = m.get(r.court, 'inCeil');
  const H = r.y1 - r.y0;
  // 床・天井
  if (!r.noFloor) bx(b, inFloor, x0 - t, r.y0 - 0.3, z0 - t, x1 + t, r.y0, z1 + t, { collide: true });
  else bx(b, inFloor, x0, r.y0, z0, x1, r.y0 + 0.01, z1, {});
  if (!r.noCeiling) carve(b, inCeil, [x0 - t, r.y1, z0 - t, x1 + t, r.y1 + 0.3, z1 + t], roofLightHoles(r), { collide: true, shadow: 'cast' });
  for (const [cx, cz] of r.roofLights?.at ?? []) roofLight(k, r, cx, cz);
  // 壁（外の材質の箱）と内装の板
  const sides: { k: 'n' | 's' | 'w' | 'e'; a: [number, number]; c: [number, number]; len0: number }[] = [
    { k: 'n', a: [x0 - t, z0 - t / 2], c: [x1 + t, z0 - t / 2], len0: x0 - t },
    { k: 's', a: [x0 - t, z1 + t / 2], c: [x1 + t, z1 + t / 2], len0: x0 - t },
    { k: 'w', a: [x0 - t / 2, z0], c: [x0 - t / 2, z1], len0: z0 },
    { k: 'e', a: [x1 + t / 2, z0], c: [x1 + t / 2, z1], len0: z0 },
  ];
  for (const s of sides) {
    if (r.open?.includes(s.k)) continue;
    const ds = (r.doors ?? []).filter((d) => d.side === s.k);
    const os = openingsOf(r, s.k);
    const holes: WallHole[] = os.map((d) => ({ at: d.at - s.len0, width: d.w, bottom: r.y0 + (d.y0 ?? 0), top: r.y0 + (d.y0 ?? 0) + d.h }));
    if (!r.skip?.includes(s.k)) wallWithHoles(b, outer, s.a, s.c, r.y0, r.y1, t, holes);
    // 日の入らない向きの窓の列は、空の明るさを列全体で 1 つの柔らかい光だまりに（灯りの数を増やさない）
    for (const w of (r.windows ?? []).filter((q) => q.side === s.k && q.at.length > 1 && softWindow(r, s.k)))
      windowSun(k, r, s.k, Math.min(...w.at) - w.w / 2, Math.max(...w.at) + w.w / 2, w.y0, w.y1, w.blind);
    // 窓の建具と、窓から入る日なた
    for (const w of (r.windows ?? []).filter((q) => q.side === s.k))
      for (const at of w.at) {
        fitWindow(k, r.court, wallFrame(r, s.k), at - w.w / 2, at + w.w / 2, r.y0 + w.y0, r.y0 + w.y1, { blind: w.blind, stain: w.blind ? null : m.get(r.court, 'stain', { brush: false }) });
        if (w.at.length === 1 || !softWindow(r, s.k)) windowSun(k, r, s.k, at - w.w / 2, at + w.w / 2, w.y0, w.y1, w.blind);
        // 窓の下の放熱器（腰の低い窓。階段室は無し）
        if (w.y0 >= 0.55 && r.kind !== 'stair') {
          const fr = wallFrame(r, s.k);
          const face = fr.line + fr.inward * (fr.t / 2);
          const yaw = s.k === 'n' ? 0 : s.k === 's' ? Math.PI : s.k === 'w' ? Math.PI / 2 : -Math.PI / 2;
          const pos: [number, number, number] = fr.along ? [at, r.y0, face] : [face, r.y0, at];
          radiator(Prop.at(k.sink, k.pm, pos, yaw, Math.round(at * 10)), Math.min(1.2, w.w - 0.15), Math.min(0.62, w.y0 - 0.22));
        }
      }
    // 内装の板（壁の内側の面に 1 cm）: 開口を避けて
    const along = s.k === 'n' || s.k === 's';
    const lo = along ? x0 : z0;
    const hi = along ? x1 : z1;
    const face = s.k === 'n' ? z0 : s.k === 's' ? z1 : s.k === 'w' ? x0 : x1;
    const sign = s.k === 'n' || s.k === 'w' ? 1 : -1;
    // 内装の板: 腰壁（床から 1.1 m。暗い塗り）と上の漆喰
    const inDado = m.get(r.court, 'inDado');
    const plate1 = (mat: THREE.Material, u0: number, u1: number, v0: number, v1: number): void => {
      if (u1 - u0 < 0.01 || v1 - v0 < 0.01) return;
      if (along) bx(b, mat, u0, v0, Math.min(face, face + sign * 0.01), u1, v1, Math.max(face, face + sign * 0.01), {});
      else bx(b, mat, Math.min(face, face + sign * 0.01), v0, u0, Math.max(face, face + sign * 0.01), v1, u1, {});
    };
    const plate = (u0: number, u1: number, v0: number, v1: number): void => {
      const yd = r.y0 + 1.1;
      plate1(inDado, u0, u1, v0, Math.min(v1, yd));
      plate1(inWall, u0, u1, Math.max(v0, yd), v1);
    };
    let u = lo;
    for (const d of [...os].sort((p, q) => p.at - q.at)) {
      const a0 = d.at - d.w / 2;
      const a1 = d.at + d.w / 2;
      const yb = r.y0 + (d.y0 ?? 0);
      plate(u, a0, r.y0, r.y1);
      plate(a0, a1, r.y0, yb);
      plate(a0, a1, yb + d.h, r.y1);
      u = a1;
    }
    plate(u, hi, r.y0, r.y1);
    // 扉の板（近づくと開く）と枠
    for (const d of ds) {
      if (d.open) continue;
      const yb = r.y0 + (d.y0 ?? 0);
      const wallLine = s.k === 'n' ? z0 - t / 2 : s.k === 's' ? z1 + t / 2 : s.k === 'w' ? x0 - t / 2 : x1 + t / 2;
      // 吊り元: 開口の小さい座標の端。板は開口の大きい座標の向きへ伸びる
      const pivot: [number, number, number] = along ? [d.at - d.w / 2, yb, wallLine] : [wallLine, yb, d.at - d.w / 2];
      // 局所の +x を壁に沿わせる: n/s の壁は yaw 0、w/e の壁は yaw = -π/2（局所 +x → 場面 +z）
      const yaw = along ? 0 : -Math.PI / 2;
      // 開く向き: 部屋の中へ（n の壁なら +z、s なら -z、w なら +x、e なら -x）
      const into = s.k === 'n' ? 1 : s.k === 's' ? -1 : s.k === 'w' ? -1 : 1;
      // 板の回転（rotation.y）は正で局所の -z の側へ回るので、局所の +z の側（into）へは負
      const swing = -((d.inward ?? true) ? 1 : -1) * into * 1.4;
      k.doors.add({ leaf: doorLeaf(k.pm, d.w, d.h, d.color ?? PC.doorDark), pivot, yaw, swing, locked: d.locked });
    }
  }
  // 灯り（天井の灯りの下の光だまり。4 m おきの升目に置き、間は暗い。照らす箱 = 部屋の内側）
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const nx = Math.max(1, Math.round((x1 - x0) / 4.2));
  const nz = Math.max(1, Math.round((z1 - z0) / 4.2));
  const lamps: [number, number][] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const px = x0 + ((x1 - x0) * (i + 0.5)) / nx;
      const pz = z0 + ((z1 - z0) * (j + 0.5)) / nz;
      lamps.push([px, pz]);
      // 床だけを照らす（照らす箱を床の高さに絞る。壁・天井は平らな塗りのまま）。器具の真下の四角く硬い光だまり
      // 灯りの中心は床から 1.8 m（四角の高さの重みで光だまりが消えないように。天井の高い部屋でも同じ大きさ）
      ctx.addLamp({ pos: [px, r.y0 + 1.8, pz], radius: 2.1, intensity: 0.6, box: [x0, r.y0 - 0.1, z0, x1, r.y0 + 0.12, z1], down: true, shadow: 0.2, square: true, hard: true });
    }
  // 天井の灯りの器具（吊り下げの笠）
  if (!r.noCeiling && H > 2.4) {
    for (const [px, pz] of lamps) {
      const p = Prop.at(k.sink, k.pm, [px, r.y1, pz], 0, 1);
      p.rod(PC.metal, [0, 0, 0], [0, -0.45, 0], 0.008, { shadow: false });
      p.lathe(PC.metal, [[0, 0.0], [0.04, 0.0], [0.2, -0.12], [0.21, -0.13], [0, -0.06]], [0, -0.45, 0], { seg: 16, shadow: false });
      p.ball(PC.lampGlass, [0, -0.56, 0], 0.05, { kind: 'glow', shadow: false });
    }
  }
  void cx;
  void cz;
  dress(k, r);
  if (!r.bare) furnish(k, r);
}

/**
 * 部屋の建物の部材と壁の小物（どの部屋にも同じ決まりで）: 壁の柱型（3 m おき）と天井の梁・巾木・扉の枠・
 * 扉の横のスイッチ・高い所の換気口・壁の額。参考画像の「深い抱き・柱型・ひさし」の語彙を部屋の中にも
 */
function dress(k: RoomKit, r: RoomSpec): void {
  const { b, m } = k;
  const [x0, z0, x1, z1] = r.rect;
  const y0 = r.y0;
  const y1 = r.y1;
  const pil = m.get(r.court, 'inTrim');
  const beamM = m.get(r.court, 'inTrim');
  const base = m.get(r.court, 'door', { brush: false });
  const cap = m.get(r.court, 'inTrim', { brush: false });
  const conduit = k.pm.get(PC.metal);
  const sides: { k: 'n' | 's' | 'w' | 'e'; lo: number; hi: number; face: number; sign: number; along: boolean }[] = [
    { k: 'n', lo: x0, hi: x1, face: z0, sign: 1, along: true },
    { k: 's', lo: x0, hi: x1, face: z1, sign: -1, along: true },
    { k: 'w', lo: z0, hi: z1, face: x0, sign: 1, along: false },
    { k: 'e', lo: z0, hi: z1, face: x1, sign: -1, along: false },
  ];
  const put = (along: boolean, face: number, sign: number, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number, mat: THREE.Material): void => {
    const f0 = face + sign * d0;
    const f1 = face + sign * d1;
    if (along) bx(b, mat, u0, v0, Math.min(f0, f1), u1, v1, Math.max(f0, f1), {});
    else bx(b, mat, Math.min(f0, f1), v0, u0, Math.max(f0, f1), v1, u1, {});
  };
  const tall = y1 - y0;
  const pilPos: { k: string; u: number }[] = [];
  for (const s of sides) {
    if (r.open?.includes(s.k)) continue;
    const ds = (r.doors ?? []).filter((d) => d.side === s.k);
    const os = openingsOf(r, s.k);
    const blocked = (u: number, w: number): boolean => os.some((d) => Math.abs(u - d.at) < d.w / 2 + w / 2 + 0.25);
    // 柱型（3 m おき。開口を避ける。部屋の高さの壁なら天井まで）
    const len = s.hi - s.lo;
    const n = Math.floor(len / 3.0);
    for (let i = 1; i <= n; i++) {
      const u = s.lo + (len * i) / (n + 1);
      if (blocked(u, 0.32)) continue;
      put(s.along, s.face, s.sign, u - 0.18, u + 0.18, y0, y1, 0.01, 0.2, pil);
      pilPos.push({ k: s.k, u });
    }
    // 巾木（暗い帯）と腰壁の見切り（1.1 m の笠木。塗りの腰壁と漆喰の境）。開口を避ける
    const runs = (yLo: number, yHi: number, d1: number, mat: THREE.Material, pad: number): void => {
      let u = s.lo;
      for (const d of [...os].sort((p, q) => p.at - q.at)) {
        const b0 = y0 + (d.y0 ?? 0);
        if (b0 > yHi || b0 + d.h < yLo) continue;
        put(s.along, s.face, s.sign, u, d.at - d.w / 2 - pad, yLo, yHi, 0.01, d1, mat);
        u = d.at + d.w / 2 + pad;
      }
      put(s.along, s.face, s.sign, u, s.hi, yLo, yHi, 0.01, d1, mat);
    };
    runs(y0, y0 + 0.11, 0.025, base, 0.08);
    runs(y0 + 1.1, y0 + 1.15, 0.035, cap, 0.06);
    // 扉の枠（内側の面）と横のスイッチの板
    for (const d of ds) {
      const yb = y0 + (d.y0 ?? 0);
      const a0 = d.at - d.w / 2;
      const a1 = d.at + d.w / 2;
      put(s.along, s.face, s.sign, a0 - 0.08, a0, yb, yb + d.h + 0.08, 0.01, 0.04, base);
      put(s.along, s.face, s.sign, a1, a1 + 0.08, yb, yb + d.h + 0.08, 0.01, 0.04, base);
      put(s.along, s.face, s.sign, a0, a1, yb + d.h, yb + d.h + 0.08, 0.01, 0.04, base);
      if (d.h > 1.8 && !blocked(a1 + 0.35, 0.1)) {
        put(s.along, s.face, s.sign, a1 + 0.28, a1 + 0.36, yb + 1.15, yb + 1.27, 0.01, 0.025, base);
        // 露出の配管（打ち放しの壁は電線を埋められないので、スイッチから天井まで細い管を壁の面に這わせる）と上の継ぎ箱
        put(s.along, s.face, s.sign, a1 + 0.31, a1 + 0.33, yb + 1.27, y1 - 0.12, 0.01, 0.028, conduit);
        put(s.along, s.face, s.sign, a1 + 0.27, a1 + 0.37, y1 - 0.2, y1 - 0.1, 0.01, 0.045, conduit);
      }
    }
    // 額長押（2.4 m。背の高い部屋の壁を一周する細い木の見切り。開口を避ける）
    if (tall > 3.2) runs(y0 + 2.4, y0 + 2.44, 0.03, cap, 0.06);
  }
  // 扉の上の時計（集会室・寝室・階段室の他）
  if (r.kind !== 'stair' && r.kind !== 'cell' && r.kind !== 'chapter') {
    const d = (r.doors ?? []).find((q) => !q.open && q.h > 1.8 && (q.y0 ?? 0) < 0.1 && y0 + q.h + 0.75 < y1 - 0.2);
    if (d) {
      const s = sides.find((q) => q.k === d.side)!;
      const yaw = s.k === 'n' ? 0 : s.k === 's' ? Math.PI : s.k === 'w' ? Math.PI / 2 : -Math.PI / 2;
      const pos: [number, number, number] = s.along ? [d.at, y0, s.face] : [s.face, y0, d.at];
      wallClock(Prop.at(k.sink, k.pm, pos, yaw, Math.round(d.at * 7)), d.h + 0.45);
    }
  }
  // 天井の格子（梁の間に小梁。打ち放しの格天井）
  if (!r.noCeiling && tall <= 5) {
    const lx = x1 - x0;
    const lz = z1 - z0;
    const nxb = Math.max(1, Math.round(lx / 1.5));
    const nzb = Math.max(1, Math.round(lz / 1.5));
    for (let i = 1; i < nxb; i++) bx(b, beamM, x0 + (lx * i) / nxb - 0.06, y1 - 0.16, z0, x0 + (lx * i) / nxb + 0.06, y1, z1, {});
    for (let j = 1; j < nzb; j++) bx(b, beamM, x0, y1 - 0.16, z0 + (lz * j) / nzb - 0.06, x1, y1, z0 + (lz * j) / nzb + 0.06, {});
  }
  // 天井の梁（短い向きに渡す。柱型の位置）
  if (!r.noCeiling && tall <= 5) {
    const shortX = x1 - x0 < z1 - z0;
    for (const p of pilPos) {
      if (shortX && p.k === 'w') bx(b, beamM, x0, y1 - 0.4, p.u - 0.18, x1, y1, p.u + 0.18, {});
      if (!shortX && p.k === 'n') bx(b, beamM, p.u - 0.18, y1 - 0.4, z0, p.u + 0.18, y1, z1, {});
    }
  }
  // 壁の上下を照らす筒形の灯り（窓の無い壁の柱型の間。部屋に 2 つまで）: 器具の上と下の壁に細い筋の硬い光（器具の口の幅）
  if (tall > 2.6 && r.kind !== 'stair') {
    let nSc = 0;
    for (const s of sides) {
      if (nSc >= 2 || r.open?.includes(s.k) || (r.windows ?? []).some((w) => w.side === s.k)) continue;
      const os = openingsOf(r, s.k);
      const us = [s.lo, ...pilPos.filter((q) => q.k === s.k).map((q) => q.u), s.hi].sort((a, b) => a - b);
      for (let i = 0; i < us.length - 1 && nSc < 2; i++) {
        const u = (us[i] + us[i + 1]) / 2;
        if (us[i + 1] - us[i] < 1.6 || os.some((d) => Math.abs(u - d.at) < d.w / 2 + 0.6)) continue;
        const yl = y0 + 2.15;
        const pos: [number, number, number] = s.along ? [u, yl, s.face] : [s.face, yl, u];
        const yaw = s.k === 'n' ? 0 : s.k === 's' ? Math.PI : s.k === 'w' ? Math.PI / 2 : -Math.PI / 2;
        const p = Prop.at(k.sink, k.pm, pos, yaw, Math.round(u * 5));
        p.box(PC.metal, [-0.04, -0.06, 0], [0.04, 0.06, 0.02], { shadow: false });
        p.cyl(PC.metal, [0, 0, 0.09], 0.05, 0.24, { seg: 14, shadow: false });
        p.cyl(PC.lampGlass, [0, 0.121, 0.09], 0.04, 0.004, { seg: 14, kind: 'glow', shadow: false });
        p.cyl(PC.lampGlass, [0, -0.121, 0.09], 0.04, 0.004, { seg: 14, kind: 'glow', shadow: false });
        // 上と下の光（壁の面の薄い箱。上は天井まで、下は腰の笠木まで）
        const n: [number, number, number] = s.along ? [0, 0, s.sign] : [s.sign, 0, 0];
        const wbox = (ua: number, ub: number, ya: number, yb: number): AABB =>
          s.along ? [ua, ya, s.face - 0.04, ub, yb, s.face + 0.04] : [s.face - 0.04, ya, ua, s.face + 0.04, yb, ub];
        // 細い筋の光（筒の口の幅。上 0.6 m・下は腰の笠木まで）
        sunPatch(b.ctx, wbox(u - 0.07, u + 0.07, yl + 0.13, Math.min(y1 - 0.02, yl + 0.75)), n, 0.75);
        sunPatch(b.ctx, wbox(u - 0.09, u + 0.09, y0 + 1.16, yl - 0.13), n, 0.75);
        nSc++;
      }
    }
  }
  // 高い所の換気口（暗い格子）と、壁の額（掲示）: 一番長い壁に
  const longW = x1 - x0 >= z1 - z0 ? 'n' : 'w';
  const s = sides.find((q) => q.k === longW)!;
  if (!r.open?.includes(s.k) && tall > 2.6) {
    const um = (s.lo + s.hi) / 2;
    put(s.along, s.face, s.sign, um - 0.25, um + 0.25, y1 - 0.55, y1 - 0.33, 0.01, 0.03, base);
    put(s.along, s.face, s.sign, s.lo + 0.9, s.lo + 1.5, y0 + 1.35, y0 + 1.8, 0.01, 0.03, base);
    put(s.along, s.face, s.sign, s.lo + 0.94, s.lo + 1.46, y0 + 1.39, y0 + 1.76, 0.03, 0.035, m.get(r.court, 'inCeil', { brush: false }));
  }
}

/** 部屋の種類ごとの置く物（壁ぞい・扉の前は空ける） */
function furnish(k: RoomKit, r: RoomSpec): void {
  const m0 = k.m;
  const [x0, z0, x1, z1] = r.rect;
  const W = x1 - x0;
  const D = z1 - z0;
  const y = r.y0;
  const at = (x: number, z: number, yaw: number, seed: number): Prop => Prop.at(k.sink, k.pm, [x, y, z], yaw, seed);
  const seed = Math.round(Math.abs(x0 * 13 + z0 * 7)) + 1;
  // 扉の前（開口の中心から 1.2 m）を避ける
  const nearDoor = (x: number, z: number, rad = 1.2): boolean =>
    (r.doors ?? []).some((d) => {
      const dx = d.side === 'n' || d.side === 's' ? d.at : d.side === 'w' ? x0 : x1;
      const dz = d.side === 'w' || d.side === 'e' ? d.at : d.side === 'n' ? z0 : z1;
      return Math.hypot(x - dx, z - dz) < rad + d.w / 2;
    });
  // 窓の前（背の高い物を置かない）
  const underWin = (side: 'n' | 's' | 'w' | 'e', u: number, w: number): boolean =>
    (r.windows ?? []).some((q) => q.side === side && q.at.some((a) => Math.abs(a - u) < q.w / 2 + w / 2 + 0.1));
  // 壁ぞいに物を並べる（辺 side、物の幅 w、奥行き d、間隔 gap）。tall = 背の高い物（窓の前に置かない）
  const alongWall = (side: 'n' | 's' | 'w' | 'e', w: number, d: number, gap: number, fn: (p: Prop, i: number) => void, max = 99, tall = true): void => {
    const horiz = side === 'n' || side === 's';
    const len = horiz ? W : D;
    const n = Math.min(max, Math.floor((len - 0.4 + gap) / (w + gap)));
    const start = (horiz ? x0 : z0) + (len - (n * w + (n - 1) * gap)) / 2 + w / 2;
    for (let i = 0; i < n; i++) {
      const u = start + i * (w + gap);
      const px = horiz ? u : side === 'w' ? x0 + d / 2 + 0.02 : x1 - d / 2 - 0.02;
      const pz = horiz ? (side === 'n' ? z0 + d / 2 + 0.02 : z1 - d / 2 - 0.02) : u;
      if (nearDoor(px, pz) || (tall && underWin(side, u, w))) continue;
      // 正面（+z）を部屋の中へ
      const yaw = side === 'n' ? 0 : side === 's' ? Math.PI : side === 'w' ? Math.PI / 2 : -Math.PI / 2;
      fn(at(px, pz, yaw, seed + i * 7), i);
    }
  };
  switch (r.kind) {
    case 'porter': {
      longTable(at(x0 + W * 0.5, z0 + 0.9, 0, seed), Math.min(1.6, W - 1), 0.7, 0.74);
      tableTop(at(x0 + W * 0.5, z0 + 0.9, 0, seed).sub([0, 0.74, 0]), 1.2, 0.5);
      chair(at(x0 + W * 0.5, z0 + 1.6, Math.PI, seed + 1), { seat: '#6d7d72', frame: '#3b4f4a' });
      alongWall('e', 1.0, 0.45, 0.4, (p) => steelShelf(p, { w: 1.0, d: 0.45, h: 1.8, load: ['binders', 'paper', 'cardboard', 'binders'], frame: '#4d5f5b', colors: SHELF_COLORS }), 2);
      alongWall('w', 1.4, 0.1, 0.6, (p) => coatRail(p, 1.4, 2), 1);
      noticeBoard(at(x0 + W * 0.5, z1 - 0.03, Math.PI, seed + 3));
      trashBin(at(x1 - 0.4, z1 - 0.4, 0, seed + 4), { body: '#7f938a', lid: '#4d5f5b' });
      // 鍵の板（北の壁）と、回廊への受付の小窓の台（内と外へ出る板）
      keyBoard(at(x0 + W * 0.5 + 1.25, z0 + 0.01, 0, seed + 7));
      for (const d of (r.doors ?? []).filter((q) => q.open && (q.y0 ?? 0) > 0.5)) {
        const fx = d.side === 'e' ? x1 : x0;
        const sg = d.side === 'e' ? 1 : -1;
        const top = m0.get(r.court, 'inTrim', { brush: false });
        bx(k.b, top, Math.min(fx - sg * 0.35, fx + sg * 0.55), y + (d.y0 ?? 1) - 0.05, d.at - d.w / 2 - 0.05, Math.max(fx - sg * 0.35, fx + sg * 0.55), y + (d.y0 ?? 1), d.at + d.w / 2 + 0.05, { collide: true });
      }
      break;
    }
    case 'passage': {
      alongWall('n', 2.0, 0.42, 0.8, (p) => slabBench(p, 2.0, { legs: 'post', dark: '#4a5a52', top: '#6d7d72' }), 2);
      alongWall('s', 1.4, 0.1, 0.6, (p) => coatRail(p, 1.4, 3), 2);
      noticeBoard(at(x0 + W * 0.3, z1 - 0.03, Math.PI, seed + 5), 1.2, 0.8);
      extinguisher(at(x1 - 0.4, z0 + 0.3, 0, seed + 6), { red: '#6b4f48', metal: '#9fb2a7' });
      break;
    }
    case 'chapter': {
      // 集会室: 正面（北）の低い壇と書見台・壁の十字架、壇を向く椅子の列（真ん中に通路）、後ろの壁ぎわに長椅子
      const dais = m0.get(r.court, 'inTrim', { brush: false });
      bx(k.b, dais, x0 + 0.6, y, z0 + 0.02, x1 - 0.6, y + 0.18, z0 + 1.7, { collide: true });
      lectern(at(x0 + W / 2, z0 + 0.9, 0, seed + 11).sub([0, 0.18, 0]));
      wallCross(at(x0 + W / 2, z0 + 0.01, 0, seed + 12));
      const per = Math.max(2, Math.floor((W / 2 - 0.9) / 0.55));
      for (let row = 0; row < 12; row++) {
        const z = z0 + 2.7 + row * 0.95;
        if (z > z1 - 1.6) break;
        for (const side of [-1, 1])
          for (let c = 0; c < per; c++) {
            const x = x0 + W / 2 + side * (0.6 + c * 0.55);
            if (nearDoor(x, z, 0.9)) continue;
            chair(at(x, z, Math.PI, seed + row * 13 + c * 3 + side), { seat: '#5b6d63', frame: '#3b4f4a' });
          }
      }
      slabBench(at(x0 + W / 2, z1 - 0.3, Math.PI, seed + 31), Math.min(3.2, W - 2.0), { dark: '#4a5a52', top: '#6d7d72' });
      break;
    }
    case 'library': {
      alongWall('w', 1.2, 0.32, 0.15, (p) => bookcase(p, 1.2, 2.0, 0.32));
      alongWall('n', 1.2, 0.32, 0.15, (p) => bookcase(p, 1.2, 2.0, 0.32), 3);
      const n = Math.max(1, Math.floor((D - 3) / 3.2));
      for (let i = 0; i < n; i++) {
        const z = z0 + 2.4 + i * 3.2;
        const x = x0 + W * 0.62;
        longTable(at(x, z, 0, seed + i), 2.4, 0.85, 0.75);
        tableTop(at(x, z, 0, seed + i * 3).sub([0, 0.75, 0]), 2.2, 0.7);
        for (const dz of [-0.75, 0.75]) for (const dx of [-0.7, 0.7]) chair(at(x + dx, z + dz, dz > 0 ? Math.PI : 0, seed + i * 5 + dx * 3), { seat: '#6d7d72', frame: '#3b4f4a' });
      }
      lectern(at(x1 - 0.8, z1 - 1.2, Math.PI, seed + 21));
      break;
    }
    case 'refectory': {
      const n = Math.max(1, Math.floor((W - 1.2) / 2.2));
      for (let i = 0; i < n; i++) {
        const x = x0 + 1.4 + i * 2.2;
        if (x > x1 - 1) break;
        longTable(at(x, (z0 + z1) / 2, Math.PI / 2, seed + i), Math.min(4.2, D - 2.4), 0.8, 0.75);
        tableTop(at(x, (z0 + z1) / 2, Math.PI / 2, seed + i * 3).sub([0, 0.75, 0]), Math.min(4.0, D - 2.6), 0.6);
        for (const s of [-1, 1]) slabBench(at(x + s * 0.65, (z0 + z1) / 2, Math.PI / 2, seed + i + s), Math.min(4.0, D - 2.6), { dark: '#4a5a52', top: '#6d7d72' });
      }
      // 配膳の台（東の壁）・流しと棚（西の壁）
      alongWall('e', 2.4, 0.6, 0.4, (p) => servingCounter(p, 2.4), 1);
      alongWall('w', 1.0, 0.5, 0.4, (p, i) => (i % 2 ? steelShelf(p, { w: 1.0, d: 0.45, h: 1.8, load: ['bottles', 'bins', 'bottles', 'linen'], frame: '#4d5f5b', colors: SHELF_COLORS }) : sink(p, 0.9)), 3);
      break;
    }
    case 'workshop': {
      workbench(at(x0 + W * 0.5, z0 + D * 0.45, 0, seed), Math.min(2.4, W - 1.6));
      // 壁ぎわの作業台と、その上の道具の壁（窓の無い壁）
      for (const side of ['s', 'w'] as const) {
        if ((r.windows ?? []).some((q) => q.side === side) || (r.doors ?? []).some((q) => q.side === side)) continue;
        const horiz = side === 's';
        const len = horiz ? W : D;
        const u = (horiz ? x0 : z0) + len * 0.55;
        const px = horiz ? u : x0 + 0.4;
        const pz = horiz ? z1 - 0.4 : u;
        const yaw = horiz ? Math.PI : Math.PI / 2;
        workbench(at(px, pz, yaw, seed + 41), Math.min(2.0, len - 1.6));
        toolWall(at(horiz ? u : x0 + 0.01, horiz ? z1 - 0.01 : u, yaw, seed + 42), Math.min(1.8, len - 1.8));
        break;
      }
      alongWall('n', 1.0, 0.45, 0.3, (p) => steelShelf(p, { w: 1.0, d: 0.45, h: 1.8, load: ['cardboard', 'bins', 'bottles', 'cardboard'], frame: '#4d5f5b', colors: SHELF_COLORS }), 3);
      alongWall('e', 0.4, 0.4, 0.25, (p, i) => jar(p, 0.35 + (i % 3) * 0.12), 5);
      sink(at(x0 + 0.6, z1 - 0.4, Math.PI, seed + 9));
      for (let i = 0; i < 2; i++) chair(at(x0 + W * 0.4 + i * 0.9, z0 + D * 0.45 + 0.75, Math.PI, seed + 13 + i), { kind: 'stack', seat: '#6d7d72', frame: '#3b4f4a' });
      break;
    }
    case 'classroom': {
      blackboard(at(x0 + W / 2, z0, 0, seed), Math.min(3.0, W - 1.5));
      // 扉の壁の外套掛けと掲示板（扉を避けて）
      for (const side of ['w', 'e'] as const) {
        if (!(r.doors ?? []).some((d) => d.side === side)) continue;
        alongWall(side, 1.4, 0.1, 1.6, (p, i) => (i % 2 ? noticeBoard(p, 1.0, 0.7) : coatRail(p, 1.4, 3)), 2, false);
      }
      // 後ろの壁の地図（扉・窓を避けて）
      if (!(r.windows ?? []).some((q) => q.side === 's') && !nearDoor(x0 + W / 2, z1, 1.0)) wallMap(at(x0 + W / 2, z1 - 0.01, Math.PI, seed + 2));
      longTable(at(x0 + W / 2, z0 + 1.3, 0, seed + 1), 1.4, 0.65, 0.75);
      const cols = Math.max(1, Math.floor((W - 1.2) / 1.1));
      const rows = Math.max(1, Math.floor((D - 3.0) / 1.25));
      for (let rr = 0; rr < rows; rr++)
        for (let c = 0; c < cols; c++) {
          const x = x0 + 0.9 + c * 1.1 + (W - 1.2 - cols * 1.1) / 2;
          const z = z0 + 2.6 + rr * 1.25;
          if (nearDoor(x, z, 1.0)) continue;
          schoolDesk(at(x, z, 0, seed + rr * 11 + c));
        }
      break;
    }
    case 'store': {
      alongWall('n', 1.2, 0.45, 0.1, (p, i) => steelShelf(p, { w: 1.2, d: 0.45, h: 1.8, load: i % 2 ? ['cardboard', 'cardboard', 'bins', 'cardboard'] : ['linen', 'linen', 'bins', 'paper'], frame: '#4d5f5b', colors: SHELF_COLORS }));
      alongWall('w', 0.4, 0.4, 0.2, (p, i) => jar(p, 0.4 + (i % 2) * 0.15), 6);
      break;
    }
    case 'cell': {
      cot(at(x0 + 0.55, z0 + 1.1, 0, seed));
      wallCross(at(x0 + 0.01, z0 + 1.1, Math.PI / 2, seed + 3), 0.5, 1.4);
      longTable(at(x1 - 0.5, z0 + 0.6, Math.PI / 2, seed + 1), 0.9, 0.55, 0.74);
      chair(at(x1 - 1.0, z0 + 0.6, -Math.PI / 2, seed + 2), { seat: '#6d7d72', frame: '#3b4f4a' });
      break;
    }
    case 'hall':
      break;
    case 'stair': {
      // 階段室: 1 階の壁ぎわの掲示板・消火器・傘立て代わりの壺
      alongWall('n', 1.0, 0.1, 1.0, (p) => noticeBoard(p, 1.0, 0.7), 1, false);
      extinguisher(at(x1 - 0.3, z0 + 0.3, -Math.PI / 2, seed + 3), { red: '#6b4f48', metal: '#9fb2a7' });
      jar(at(x1 - 0.35, z0 + 0.9, 0, seed + 4), 0.5);
      break;
    }
  }
}

/**
 * 屋根のある歩廊（回廊・ロッジア・門の通路）の決まり: 3 m おきに天井の梁（短い向きに渡す）、6 m おきに天井の灯り
 * （光だまり。照らす箱 = 歩廊の内側）と、奥の壁の腕木の灯り。暗い歩廊の中にも形と明暗の段を付ける
 */
export function dressWalk(k: RoomKit, court: Court, rect: [number, number, number, number], y0: number, y1: number, along: 'x' | 'z', wallSide?: 'n' | 's' | 'w' | 'e', beamKey = 'inCeil', lamps = true): void {
  const { b, m } = k;
  // 参考画像の視点から開口越しに見える歩廊は、梁も暗い材質（beamKey）にする
  const beam = m.get(court, beamKey, { brush: false });
  const [x0, z0, x1, z1] = rect;
  const len = along === 'x' ? x1 - x0 : z1 - z0;
  const n = Math.max(1, Math.round(len / 3.0));
  for (let i = 1; i < n; i++) {
    const u = (along === 'x' ? x0 : z0) + (len * i) / n;
    if (along === 'x') bx(b, beam, u - 0.15, y1 - 0.38, z0, u + 0.15, y1, z1, {});
    else bx(b, beam, x0, y1 - 0.38, u - 0.15, x1, y1, u + 0.15, {});
  }
  const nl = lamps ? Math.max(1, Math.round(len / 6.0)) : 0;
  for (let i = 0; i < nl; i++) {
    const u = (along === 'x' ? x0 : z0) + (len * (i + 0.5)) / nl;
    const cx = along === 'x' ? u : (x0 + x1) / 2;
    const cz = along === 'x' ? (z0 + z1) / 2 : u;
    b.ctx.addLamp({ pos: [cx, y1 - 0.5, cz], radius: 2.4, intensity: 0.55, box: [x0, y0 - 0.1, z0, x1, y0 + 0.12, z1], down: true, shadow: 0.3, square: true, hard: true });
    if (wallSide) {
      const wx = wallSide === 'w' ? x0 : wallSide === 'e' ? x1 : cx;
      const wz = wallSide === 'n' ? z0 : wallSide === 's' ? z1 : cz;
      const yaw = wallSide === 'n' ? 0 : wallSide === 's' ? Math.PI : wallSide === 'w' ? Math.PI / 2 : -Math.PI / 2;
      const p = Prop.at(k.sink, k.pm, [wx, y0 + Math.min(2.4, y1 - y0 - 0.5), wz], yaw, 7 + i);
      p.box(PC.metal, [-0.06, -0.09, -0.01], [0.06, 0.09, 0.015], { r: 0.008, shadow: false });
      p.rod(PC.metal, [0, 0, 0.01], [0, 0.03, 0.18], 0.012, { shadow: false });
      p.lathe(PC.metal, [[0, 0.04], [0.07, 0.0], [0.09, -0.05], [0.085, -0.055], [0, -0.01]], [0, 0.04, 0.2], { seg: 14, shadow: false });
      p.ball(PC.lampGlass, [0, -0.02, 0.2], 0.04, { kind: 'glow', shadow: false });
    }
  }
}
