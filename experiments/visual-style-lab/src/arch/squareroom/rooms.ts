import type * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import { slab, stairs, wallWithHoles } from '../kit.ts';
import type { Env } from './env.ts';

/**
 * 箱の中の部屋（参考画像には写らない所）。どれも世界の座標で、積んだ塊からこの空間を抜き（env.holes）、自分の壁で囲む。
 * - 階段室（水庭の南西の壁の中）: 折り返し階段 4 段で 12.7 m の屋上テラスへ。テラスは水庭の上へ張り出す（高い所）
 * - ポンプ室（D の南の回廊の奥）: 床が 1.5 m 下がる（低い所）。水位を調整するポンプ・配管・弁・制御盤
 * - 管理室（A の南の回廊の奥）: 机・椅子・棚・水位の記録
 * - 小部屋（C の西の歩廊の奥）: 何も無い立方体の部屋に細い窓と長椅子（住戸の 1 つ）
 */

export interface RoomDef {
  id: string;
  label: string;
  /** 内側の寸法 [x0, z0, x1, z1]・床・天井 */
  rect: [number, number, number, number];
  floor: number;
  ceil: number;
  /** 扉: 面（n = -z・s = +z・w = -x・e = +x）・辺の小さい座標の端からの中心・幅・高さ */
  doors: { side: 'n' | 's' | 'w' | 'e'; at: number; w: number; h: number; y?: number }[];
  /** 壁の厚さ */
  thick: number;
}

/** 階段室の北の壁の上の高窓の中心（世界の x）。外はテラス（テラスの壁の決まりはここを空ける） */
export const STAIR_CLERESTORY = [-13.5, -10.5, -7.5];

/** 屋上テラス（階段室の上・水庭の南の壁の上） */
export const TERRACE = { rect: [-17, 14.5, 2, 19.6] as [number, number, number, number], y: 12.7 };

export const ROOMS: RoomDef[] = [
  {
    id: 'stair',
    label: '階段室（屋上テラスへ）',
    rect: [-15, 19.6, -3, 23.0],
    floor: 0.3,
    ceil: 15.7,
    thick: 0.4,
    doors: [
      // 水庭の歩廊から（北の面。厚い壁を抜ける）・屋上テラスへ（北の面の 12.7 m）
      { side: 'n', at: 10.9, w: 1.8, h: 2.7 },
      { side: 'n', at: 10.9, w: 1.8, h: 2.6, y: TERRACE.y },
    ],
  },
  { id: 'pump', label: 'ポンプ室（床 -1.5 m）', rect: [-48, 19.8, -38, 28], floor: -1.5, ceil: 3.0, thick: 0.4, doors: [{ side: 'n', at: 4.8, w: 1.6, h: 2.4, y: 0.35 }] },
  { id: 'office', label: '管理室', rect: [28, 3.6, 36, 9.6], floor: 0.3, ceil: 3.4, thick: 0.4, doors: [{ side: 'n', at: 1.9, w: 1.4, h: 2.3 }] },
  { id: 'cell', label: '小部屋（住戸の 1 つ）', rect: [-22.6, -33, -17.6, -27], floor: 0.25, ceil: 3.2, thick: 0.4, doors: [{ side: 'e', at: 3.0, w: 1.2, h: 2.2 }] },
];

/** 部屋の外側の空間（積んだ塊から抜く）。扉の前の厚い壁の抜け・テラスも */
export function roomHoles(): { min: V3; max: V3 }[] {
  const out: { min: V3; max: V3 }[] = [];
  for (const r of ROOMS) {
    const t = r.thick;
    out.push({ min: [r.rect[0] - t, r.floor - 0.6, r.rect[1] - t], max: [r.rect[2] + t, r.ceil + 0.4, r.rect[3] + t] });
  }
  // 階段室の扉の前（水庭の南の壁の面 z = 18 まで）
  out.push({ min: [-6.0, 0.25, 17.6], max: [-2.2, 3.1, 19.6] });
  // テラス（水庭の上へ張り出す床の上の空間）
  out.push({ min: [TERRACE.rect[0], TERRACE.y - 0.4, TERRACE.rect[1]], max: [TERRACE.rect[2], TERRACE.y + 6, TERRACE.rect[3]] });
  // ポンプ室の扉の前（D の回廊の奥の壁の厚み）
  out.push({ min: [-44.0, 0.3, 18.4], max: [-42.4, 2.8, 20.2] });
  // 管理室の扉の前（A の回廊の奥の壁の厚み）
  out.push({ min: [29.0, 0.3, 2.6], max: [30.8, 2.7, 4.0] });
  // 小部屋の扉の前（C の歩廊の奥の暗い壁）
  out.push({ min: [-17.7, 0.25, -30.8], max: [-17.0, 2.5, -29.2] });
  return out;
}

export interface RoomMats {
  wall: THREE.Material;
  floor: THREE.Material;
  dark: THREE.Material;
}

/** 部屋の殻（床・壁・天井）と階段・テラスを置く */
/** 部屋の殻と階段・テラス。T = 屋外のテラスの床と手すり壁の材質（屋外の打ち放し。部屋の材質は間接光が小さい） */
export function buildRooms(env: Env, M: RoomMats, T: RoomMats = M): void {
  const b = env.b;
  for (const r of ROOMS) {
    const [x0, z0, x1, z1] = r.rect;
    const t = r.thick;
    slab(b, M.floor, [x0 - t, z0 - t, x1 + t, z1 + t], r.floor, 0.4);
    // 天井の板も影を落とす（階段室の上は空: 落とさないと日が天井を抜けて北の壁に当たった）
    slab(b, M.wall, [x0 - t, z0 - t, x1 + t, z1 + t], r.ceil + 0.4, 0.4, { shadow: true });
    const holes = (side: 'n' | 's' | 'w' | 'e', off: number) =>
      r.doors.filter((d) => d.side === side).map((d) => ({ at: d.at + off, width: d.w, bottom: d.y ?? r.floor, top: (d.y ?? r.floor) + d.h }));
    const h = t / 2;
    // 同じ面に高さの違う扉が 2 つ（階段室の北: 1 階と屋上）なら、壁を高さで分けて 1 つずつ空ける
    const nh = holes('n', t);
    if (nh.length > 1) {
      const ys = [r.floor, ...nh.slice(1).map((d) => d.bottom), r.ceil];
      for (let i = 0; i < nh.length; i++) wallWithHoles(b, M.wall, [x0 - t, z0 - h], [x1 + t, z0 - h], ys[i], ys[i + 1], t, [nh[i]]);
    } else wallWithHoles(b, M.wall, [x0 - t, z0 - h], [x1 + t, z0 - h], r.floor, r.ceil, t, nh);
    wallWithHoles(b, M.wall, [x0 - t, z1 + h], [x1 + t, z1 + h], r.floor, r.ceil, t, holes('s', t));
    wallWithHoles(b, M.wall, [x0 - h, z0], [x0 - h, z1], r.floor, r.ceil, t, holes('w', 0));
    wallWithHoles(b, M.wall, [x1 + h, z0], [x1 + h, z1], r.floor, r.ceil, t, holes('e', 0));
  }

  // ---------------- 部屋の壁の窪み（決まり: 扉の無い長い面に、1.8〜2.4 m ごとに奥まった暗い溝か棚の窪み・巾木の帯） ----------------
  for (const r of ROOMS) {
    if (r.id === 'stair') continue;
    const [x0, z0, x1, z1] = r.rect;
    const y = r.floor;
    const sides: { a: [number, number]; b: [number, number]; n: [number, number]; side: 'n' | 's' | 'w' | 'e' }[] = [
      { a: [x0, z0], b: [x1, z0], n: [0, 1], side: 'n' },
      { a: [x0, z1], b: [x1, z1], n: [0, -1], side: 's' },
      { a: [x0, z0], b: [x0, z1], n: [1, 0], side: 'w' },
      { a: [x1, z0], b: [x1, z1], n: [-1, 0], side: 'e' },
    ];
    let k = 0;
    for (const sd of sides) {
      const len = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]);
      const ux = (sd.b[0] - sd.a[0]) / len;
      const uz = (sd.b[1] - sd.a[1]) / len;
      const doors = r.doors.filter((d) => d.side === sd.side).map((d) => d.at);
      // 巾木の帯（壁の足元の濃い帯 0.12 m）
      const bx0 = Math.min(sd.a[0], sd.b[0]) + (sd.n[0] > 0 ? 0 : sd.n[0] < 0 ? -0.03 : 0);
      const bz0 = Math.min(sd.a[1], sd.b[1]) + (sd.n[1] > 0 ? 0 : sd.n[1] < 0 ? -0.03 : 0);
      b.boxMM(M.dark, [bx0 - (sd.n[0] === 0 ? 0 : 0), y, bz0], [bx0 + (sd.n[0] === 0 ? Math.abs(sd.b[0] - sd.a[0]) : 0.03), y + 0.12, bz0 + (sd.n[1] === 0 ? Math.abs(sd.b[1] - sd.a[1]) : 0.03)], { shadow: 'receive' });
      for (let t = 1.0; t + 1.0 < len; t += 2.1) {
        if (doors.some((a) => Math.abs(a - t) < 1.4)) continue;
        k++;
        const cx = sd.a[0] + ux * t;
        const cz = sd.a[1] + uz * t;
        const tall = k % 3 === 0;
        const ww = tall ? 0.18 : 0.9;
        const hh = tall ? 2.0 : 0.5;
        const yy = tall ? y + 0.4 : y + 1.5;
        const hx = Math.abs(ux) * ww / 2 + Math.abs(sd.n[0]) * 0.02;
        const hz = Math.abs(uz) * ww / 2 + Math.abs(sd.n[1]) * 0.02;
        b.boxMM(M.dark, [cx - hx + sd.n[0] * 0.005, yy, cz - hz + sd.n[1] * 0.005], [cx + hx + sd.n[0] * 0.005, yy + hh, cz + hz + sd.n[1] * 0.005], { shadow: 'receive' });
      }
    }
  }

  // ---------------- 戸口の額縁（決まり: 部屋の内と外の面に、幅 0.12 m・0.05 m 出る縦枠とまぐさ。床に沓摺り） ----------------
  for (const r of ROOMS) {
    const [x0, z0, x1, z1] = r.rect;
    const t = r.thick;
    for (const d of r.doors) {
      const y0 = d.y ?? r.floor;
      const y1 = y0 + d.h;
      const ns = d.side === 'n' || d.side === 's';
      const c = ns ? x0 + d.at : z0 + d.at;
      const faces = d.side === 'n' ? [z0, z0 - t] : d.side === 's' ? [z1, z1 + t] : d.side === 'w' ? [x0, x0 - t] : [x1, x1 + t];
      for (const fc of faces) {
        const out = Math.sign(fc - (d.side === 'n' ? z0 - t / 2 : d.side === 's' ? z1 + t / 2 : d.side === 'w' ? x0 - t / 2 : x1 + t / 2));
        const a = Math.min(fc, fc + out * 0.05);
        const bb = Math.max(fc, fc + out * 0.05);
        const put = (u0: number, u1: number, v0: number, v1: number): void => {
          if (ns) b.boxMM(M.dark, [u0, v0, a], [u1, v1, bb], { shadow: 'receive' });
          else b.boxMM(M.dark, [a, v0, u0], [bb, v1, u1], { shadow: 'receive' });
        };
        put(c - d.w / 2 - 0.12, c - d.w / 2, y0, y1 + 0.12);
        put(c + d.w / 2, c + d.w / 2 + 0.12, y0, y1 + 0.12);
        put(c - d.w / 2, c + d.w / 2, y1, y1 + 0.12);
      }
      // 沓摺り（戸口の床の金物）
      const m0 = d.side === 'n' ? z0 - t : d.side === 's' ? z1 : d.side === 'w' ? x0 - t : x1;
      if (ns) b.boxMM(M.dark, [c - d.w / 2, y0, m0], [c + d.w / 2, y0 + 0.015, m0 + t], { shadow: 'receive' });
      else b.boxMM(M.dark, [m0, y0, c - d.w / 2], [m0 + t, y0 + 0.015, c + d.w / 2], { shadow: 'receive' });
    }
  }

  // ---------------- 部屋の天井の梁（決まり: 長い向きを 3 つに分ける梁 2 本。背 0.4 m）と、天井ぎわの回り縁 ----------------
  for (const r of ROOMS) {
    if (r.id === 'stair') continue;
    const [x0, z0, x1, z1] = r.rect;
    const alongX = x1 - x0 >= z1 - z0;
    for (const t of [1 / 3, 2 / 3]) {
      if (alongX) {
        const x = x0 + (x1 - x0) * t;
        b.boxMM(M.wall, [x - 0.15, r.ceil - 0.4, z0], [x + 0.15, r.ceil, z1], { shadow: true });
      } else {
        const z = z0 + (z1 - z0) * t;
        b.boxMM(M.wall, [x0, r.ceil - 0.4, z - 0.15], [x1, r.ceil, z + 0.15], { shadow: true });
      }
    }
    b.boxMM(M.dark, [x0, r.ceil - 0.08, z0], [x1, r.ceil, z0 + 0.06], { shadow: 'receive' });
    b.boxMM(M.dark, [x0, r.ceil - 0.08, z1 - 0.06], [x1, r.ceil, z1], { shadow: 'receive' });
    b.boxMM(M.dark, [x0, r.ceil - 0.08, z0], [x0 + 0.06, r.ceil, z1], { shadow: 'receive' });
    b.boxMM(M.dark, [x1 - 0.06, r.ceil - 0.08, z0], [x1, r.ceil, z1], { shadow: 'receive' });
  }

  // ---------------- 階段室の踊り場の窓（西の壁）: 深い抱き（0.25 m）と窓台・まぐさ。窓の光る板は dress.ts ----------------
  {
    const [x0, z0, , z1] = ROOMS[0].rect;
    const zc = (z0 + z1) / 2;
    for (let k = 0; k < 4; k++) {
      const sy = ROOMS[0].floor + 3.1 * k + 1.0;
      b.boxMM(M.wall, [x0, sy - 0.1, zc - 0.45], [x0 + 0.25, sy, zc + 0.45], { shadow: true });
      b.boxMM(M.wall, [x0, sy + 1.8, zc - 0.45], [x0 + 0.25, sy + 2.0, zc + 0.45], { shadow: true });
      for (const sgn of [-1, 1]) b.boxMM(M.wall, [x0, sy, zc + sgn * 0.25 - (sgn > 0 ? 0 : 0.2)], [x0 + 0.25, sy + 1.8, zc + sgn * 0.25 + (sgn > 0 ? 0.2 : 0)], { shadow: true });
    }
  }

  // ---------------- 階段室の上の階: 北の壁の高窓 3 つ（外はテラス）・東の壁の窓・吹き抜けの上の天窓 ----------------
  {
    const r = ROOMS[0];
    const [, z0, x1, z1] = r.rect;
    const t = r.thick;
    const glow = env.glow('#d6e3e0');
    for (const x of STAIR_CLERESTORY) {
      const [w0, w1] = [x - 0.5, x + 0.5];
      const [y0, y1] = [13.5, 15.1];
      // 内: 光る窓と深い抱き（0.25 m）・窓台・まぐさ
      b.boxMM(glow, [w0, y0, z0 - 0.02], [w1, y1, z0], { shadow: 'receive' });
      b.boxMM(M.wall, [w0 - 0.15, y0 - 0.12, z0], [w1 + 0.15, y0, z0 + 0.25], { shadow: true });
      b.boxMM(M.wall, [w0 - 0.15, y1, z0], [w1 + 0.15, y1 + 0.15, z0 + 0.25], { shadow: true });
      b.boxMM(M.wall, [w0 - 0.15, y0, z0], [w0, y1, z0 + 0.25], { shadow: true });
      b.boxMM(M.wall, [w1, y0, z0], [w1 + 0.15, y1, z0 + 0.25], { shadow: true });
      // 外（テラスの側）: 暗い窓と窓台・額縁
      b.boxMM(env.voidMat, [w0, y0, z0 - t - 0.01], [w1, y1, z0 - t + 0.02], { shadow: 'receive' });
      b.boxMM(T.wall, [w0 - 0.18, y0 - 0.08, z0 - t - 0.16], [w1 + 0.18, y0, z0 - t], { shadow: true });
      b.boxMM(T.wall, [w0 - 0.12, y1, z0 - t - 0.08], [w1 + 0.12, y1 + 0.12, z0 - t], { shadow: true });
      // 光だまり（窓から斜めに差して、下の段と踊り場の床だけ。壁は照らさない）
      env.ctx.addLamp({ pos: [x, 13.6, z0 + 1.6], radius: 4.2, intensity: 1.2, color: '#e9efea', box: [w0 - 0.6, 9.4, z0 + 0.6, w1 + 0.6, 13.2, z1 - 0.2], shadow: 0 });
    }
    // 東の壁の上の窓
    b.boxMM(glow, [x1, 13.5, 20.8], [x1 + 0.02, 15.1, 21.8], { shadow: 'receive' });
    for (const [a, c, ya, yb] of [
      [20.65, 20.8, 13.5, 15.1],
      [21.8, 21.95, 13.5, 15.1],
      [20.65, 21.95, 13.38, 13.5],
      [20.65, 21.95, 15.1, 15.25],
    ] as [number, number, number, number][])
      b.boxMM(M.wall, [x1 - 0.25, ya, a], [x1, yb, c], { shadow: true });
    // 吹き抜けの上の天窓（天井に光る板と、深い枠）と、吹き抜けを下へ照らす光
    const xa0 = -10.6;
    const xa1 = -6.4;
    const za0 = 20.9;
    const za1 = 21.7;
    b.boxMM(glow, [xa0, r.ceil - 0.02, za0], [xa1, r.ceil, za1], { shadow: 'receive' });
    for (const [a, c, d, e] of [
      [xa0 - 0.15, xa1 + 0.15, za0 - 0.15, za0],
      [xa0 - 0.15, xa1 + 0.15, za1, za1 + 0.15],
      [xa0 - 0.15, xa0, za0, za1],
      [xa1, xa1 + 0.15, za0, za1],
    ] as [number, number, number, number][])
      b.boxMM(M.dark, [a, r.ceil - 0.3, d], [c, r.ceil, e], { shadow: 'receive' });
    // 照らす箱は階段室全体（吹き抜けで 1 つの空間。箱の縁が壁を横切らない）。届く半径と下向きの円錐で弱まる
    env.ctx.addLamp({ pos: [-8.5, r.ceil - 0.4, (za0 + za1) / 2], radius: 8, intensity: 1.0, color: '#e6eee9', box: [r.rect[0], r.floor - 0.2, z0, x1, r.ceil, z1], down: true, shadow: 0 });
  }

  // ---------------- 階段室: 折り返し階段（2 列 × 4 段落ち。1 段 0.172 m × 18・踏み面 0.28 m） ----------------
  {
    const [x0, z0, x1, z1] = ROOMS[0].rect;
    const laneN: [number, number] = [z0, z0 + 1.6];
    const laneS: [number, number] = [z1 - 1.6, z1];
    const xa = -5.96;
    const xb = -11.0;
    const rise = 3.1;
    const w = 1.6;
    const y0 = ROOMS[0].floor;
    // 1: 北の列を西へ（0.3 → 3.4）・2: 南の列を東へ（→ 6.5）・3: 北を西へ（→ 9.6）・4: 南を東へ（→ 12.7）
    stairs(b, M.floor, [xa, y0, (laneN[0] + laneN[1]) / 2], '-x', rise, w);
    stairs(b, M.floor, [xb, y0 + rise, (laneS[0] + laneS[1]) / 2], '+x', rise, w);
    stairs(b, M.floor, [xa, y0 + rise * 2, (laneN[0] + laneN[1]) / 2], '-x', rise, w);
    stairs(b, M.floor, [xb, y0 + rise * 3, (laneS[0] + laneS[1]) / 2], '+x', rise, w);
    // 踊り場（西 3.4・9.6、東 6.5・12.7）
    for (const [xx0, xx1, y] of [
      [x0, xb, y0 + rise],
      [x0, xb, y0 + rise * 3],
      [xa, x1, y0 + rise * 2],
      [xa, x1, y0 + rise * 4],
    ] as [number, number, number][]) {
      slab(b, M.floor, [xx0, z0, xx1, z1], y, 0.3);
    }
    // 2 つの列の間は吹き抜け（0.2 m。段の横の面が段々に見える）。手すりの柵は dress.ts。柵の当たり判定（段の勾配に沿って 4 つ）
    for (let k = 0; k < 4; k++) {
      const north = k % 2 === 0;
      const zc = north ? laneN[1] - 0.03 : laneS[0] + 0.03;
      for (let i = 0; i < 4; i++) {
        const xa0 = xa + ((xb - xa) * i) / 4;
        const xb0 = xa + ((xb - xa) * (i + 1)) / 4;
        const t = north ? (i + 1) / 4 : (4 - i) / 4;
        const yTop = y0 + rise * k + rise * t + 1.0;
        b.ctx.colliders.add({ x: Math.min(xa0, xb0), y: y0 + rise * k, z: zc - 0.03 }, { x: Math.max(xa0, xb0), y: yTop, z: zc + 0.03 });
      }
    }
  }
  // ---------------- テラス（12.7 m。水庭の上へ張り出す床と手すり壁） ----------------
  {
    const [tx0, tz0, tx1, tz1] = TERRACE.rect;
    const y = TERRACE.y;
    slab(b, T.floor, [tx0, tz0, tx1, tz1], y, 0.5);
    // 手すり壁（高さ 1.1 m・水庭の側と東西の端）
    wallWithHoles(b, T.wall, [tx0, tz0 + 0.1], [tx1, tz0 + 0.1], y, y + 1.1, 0.2, []);
    wallWithHoles(b, T.wall, [tx0 + 0.1, tz0], [tx0 + 0.1, tz1], y, y + 1.1, 0.2, []);
    wallWithHoles(b, T.wall, [tx1 - 0.1, tz0], [tx1 - 0.1, tz1], y, y + 1.1, 0.2, []);
    // 南の縁の階段室の両脇（下の積んだ箱の屋根へ降りられないように）
    const sx0 = ROOMS[0].rect[0] - ROOMS[0].thick;
    const sx1 = ROOMS[0].rect[2] + ROOMS[0].thick;
    wallWithHoles(b, T.wall, [tx0, tz1 - 0.1], [sx0, tz1 - 0.1], y, y + 1.1, 0.2, []);
    wallWithHoles(b, T.wall, [sx1, tz1 - 0.1], [tx1, tz1 - 0.1], y, y + 1.1, 0.2, []);
  }
  // ---------------- ポンプ室: 扉から下りる階段（0.35 → -1.5） ----------------
  {
    const r = ROOMS[1];
    stairs(b, M.floor, [-43.2, r.floor, r.rect[1] + 3.1], '-z', 1.85, 1.5, { riser: 0.168 });
  }
}
