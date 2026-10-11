import * as THREE from 'three';
import type { SceneContext } from '../../scenes/types.ts';
import { bx } from './geo.ts';
import type { AABB, RoomKit, RoomSpec } from './interior.ts';
import { sunTravel } from './layout.ts';
import type { Court } from './mats.ts';
import { PC } from './props/court.ts';

/**
 * 部屋の中の光（3 回目の直し）: 参考画像の「くっきりした日なたと深い陰」を部屋の中にも持ち込む。
 * - 窓: 壁に本物の穴を開け、鋼の枠・方立て・無目・内と外の窓台・ガラス（内の面は外の明るさ = 照明なしの淡い色、
 *   外の面は暗いガラス）。外から見える窓の外の窓台の下には雨の垂れの筋（造りに従う汚れ）
 * - 日なた: 外に抜けた窓と光の筒は本物の日（中庭の日の影の地図）がそのまま通る。枠・方立て・窓の抱き・家具の影も本物。
 *   ガラスは影を落とさない。外が塊の窓（blind）で日の向きの窓だけ、窓の形を床へ落とした四角く硬い光だまり
 *   （ctx.addLamp の square・hard。照らす箱 = 床の薄い板）。日の入らない向きの窓は、窓の前の床に柔らかい空の明るさ
 * - 光の筒（屋根の明かり取り。ラ・トゥーレット修道院の「光の大砲」）: 天井の四角い穴から屋根の上面まで抜けた筒。
 *   上の端は外の明るさ（影を落とさないガラス）。日は筒を通って真下の床（日の向きにずれる）と筒の面に落ちる
 */

export type Side = 'n' | 's' | 'w' | 'e';

/** 内のガラスの明るさ（外の明るさ。照明なしの淡い色）・光の筒の上のガラス */
export const GLASS_IN = '#e3ece2';
export const SKY_IN = '#eef3ea';
/** 窓の鋼の枠（暗い灰緑の塗り） */
export const FRAME = '#4d5f5b';

/** 部屋の内側から見た壁の向き */
export interface WallFrame {
  /** 壁が x に沿う（n / s の壁） */
  along: boolean;
  /** 壁の芯の座標（n / s なら z、w / e なら x） */
  line: number;
  /** 壁の厚さ */
  t: number;
  /** 部屋の内側の向き（+z / +x なら 1） */
  inward: 1 | -1;
}

export function wallFrame(r: RoomSpec, side: Side): WallFrame {
  const t = r.t ?? 0.3;
  const [x0, z0, x1, z1] = r.rect;
  if (side === 'n') return { along: true, line: z0 - t / 2, t, inward: 1 };
  if (side === 's') return { along: true, line: z1 + t / 2, t, inward: -1 };
  if (side === 'w') return { along: false, line: x0 - t / 2, t, inward: 1 };
  return { along: false, line: x1 + t / 2, t, inward: -1 };
}

/** 壁の座標（u = 壁に沿う、y、d = 芯から内側への距離）の箱 */
function wbx(b: RoomKit['b'], mat: THREE.Material, f: WallFrame, u0: number, u1: number, y0: number, y1: number, d0: number, d1: number, shadow = true): void {
  const a = f.line + f.inward * d0;
  const c = f.line + f.inward * d1;
  const o = shadow ? {} : { shadow: false };
  if (f.along) bx(b, mat, u0, y0, Math.min(a, c), u1, y1, Math.max(a, c), o);
  else bx(b, mat, Math.min(a, c), y0, u0, Math.max(a, c), y1, u1, o);
}

/**
 * 窓の建具（壁の穴は呼ぶ側が開ける）。u0..u1・ya..yb（場面の高さ）の開口に、芯に鋼の枠と方立て・無目、内の窓台、
 * ガラス（内の面は明るく、blind でなければ外の面は暗い）、外の窓台と下の雨の垂れの筋（stain = 外の面の汚れの材質）
 */
export function fitWindow(k: RoomKit, court: Court, f: WallFrame, u0: number, u1: number, ya: number, yb: number, o: { blind?: boolean; stain?: THREE.Material | null } = {}): void {
  const { b, m, pm } = k;
  const ht = f.t / 2;
  const frame = pm.get(FRAME);
  // ガラスは影を落とさない（外に抜けた窓は本物の日が通る）。外に抜けた窓は透けるガラス（部屋から外の景色が見え、
  // 外からは暗い部屋の中が見える）。外が塊の窓（blind）は外の明るさの曇りガラス
  if (o.blind) wbx(b, m.flat(GLASS_IN), f, u0, u1, ya, yb, 0.004, 0.012, false);
  else {
    // 内の面: 外の明るさの靄（9 割）に外の景色がかすかに透ける。外の面: 暗いガラス。どちらも片面だけの 1 枚
    // （部屋の中からは靄だけ、外からは暗いガラスだけが見える）
    const pane = (mat: THREE.Material, d: number, face: 1 | -1): void => {
      const g = new THREE.PlaneGeometry(u1 - u0, yb - ya);
      const dir = f.inward * face;
      g.rotateY(f.along ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const c = f.line + f.inward * d;
      const um = (u0 + u1) / 2;
      g.translate(f.along ? um : c, (ya + yb) / 2, f.along ? c : um);
      b.mesh(g, mat, [0, 0, 0], { shadow: false });
    };
    pane(m.haze(GLASS_IN, 0.9), 0.008, 1);
    pane(pm.get(PC.glassDark), -0.008, -1);
  }
  // 枠（見付け 5 cm）・方立て（0.6 m おき）・無目（高い窓は上から 3 割の所）
  const fw = 0.05;
  wbx(b, frame, f, u0, u1, ya, ya + fw, -0.03, 0.035);
  wbx(b, frame, f, u0, u1, yb - fw, yb, -0.03, 0.035);
  wbx(b, frame, f, u0, u0 + fw, ya, yb, -0.03, 0.035);
  wbx(b, frame, f, u1 - fw, u1, ya, yb, -0.03, 0.035);
  const np = Math.max(1, Math.round((u1 - u0) / 0.6));
  for (let i = 1; i < np; i++) {
    const u = u0 + ((u1 - u0) * i) / np;
    wbx(b, frame, f, u - 0.018, u + 0.018, ya, yb, -0.025, 0.03);
  }
  if (yb - ya > 1.4) {
    const y = ya + (yb - ya) * 0.7;
    wbx(b, frame, f, u0, u1, y - 0.02, y + 0.02, -0.025, 0.03);
  }
  // 内の窓台（打ち放しの淡い台。部屋の中へ 6 cm 出る）
  const sill = m.get(court, 'inTrim', { brush: false });
  wbx(b, sill, f, u0 - 0.06, u1 + 0.06, ya - 0.035, ya + 0.02, 0.035, ht + 0.06);
  if (!o.blind) {
    // 外の窓台（水切り）と、その下の雨の垂れの筋（窓台の端から下へ細くなる 2 段の板）
    wbx(b, m.get(court, 'inTrim', { brush: false }), f, u0 - 0.05, u1 + 0.05, ya - 0.04, ya + 0.015, -ht - 0.05, -0.035);
    if (o.stain) {
      const w = u1 - u0;
      wbx(b, o.stain, f, u0 + w * 0.12, u1 - w * 0.12, ya - 0.7, ya - 0.04, -ht - 0.004, -ht - 0.002);
      wbx(b, o.stain, f, u0 + w * 0.3, u1 - w * 0.35, ya - 1.6, ya - 0.7, -ht - 0.004, -ht - 0.002);
    }
  }
}

/**
 * 日なた（四角い光だまり）。box = 照らす面の薄い箱、n = 面の向き。hard で縁を硬く（日なた）、false で柔らかく（空の明るさ）。
 * 灯りの中心を面から少し離して置き、箱の全体が四角の中に入る大きさにする（箱そのものが日なたの形になる）
 */
export function sunPatch(ctx: SceneContext, box: AABB, n: [number, number, number], intensity: number, hard = true): void {
  const c: [number, number, number] = [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2];
  const off = hard ? 1.5 : 0.5;
  const pos: [number, number, number] = [c[0] + n[0] * off, c[1] + n[1] * off, c[2] + n[2] * off];
  const ex = Math.abs(n[0]) * off + (box[3] - box[0]) / 2;
  const ey = Math.abs(n[1]) * off + (box[4] - box[1]) / 2;
  const ez = Math.abs(n[2]) * off + (box[5] - box[2]) / 2;
  // 硬い縁: 箱の隅でも灯りの四角の内側（att ≥ 0.3）。柔らかい: 箱の縁で 0 に近づく
  const radius = hard ? Math.max(ex, ez, ey * 0.5) / 0.6 + 0.05 : Math.max(ex, ez, ey * 0.5) / 0.92;
  ctx.addLamp({ pos, radius, intensity, box, square: true, hard, shadow: 0 });
}

/**
 * 窓（u0..u1、床から ha..hb）から部屋の床へ落ちる日なた。日の水平の進みが窓の内向きに 0.2 より小さい窓（日の入らない向き）は、
 * 窓の前の床に柔らかい空の明るさ。斜めに入る日は 2 段に分けて平行四辺形に近づける（影の升目のような段）
 */
export function windowSun(k: RoomKit, r: RoomSpec, side: Side, u0: number, u1: number, ha: number, hb: number, blind = false, floorY = r.y0): void {
  const ctx = k.b.ctx;
  const [tx, tz] = sunTravel(r.court);
  const [x0, z0, x1, z1] = r.rect;
  const nx = side === 'w' ? 1 : side === 'e' ? -1 : 0;
  const nz = side === 'n' ? 1 : side === 's' ? -1 : 0;
  const along = side === 'n' || side === 's';
  const dn = tx * nx + tz * nz;
  const da = along ? tx : tz;
  const face = side === 'n' ? z0 : side === 's' ? z1 : side === 'w' ? x0 : x1;
  const D = along ? z1 - z0 : x1 - x0;
  const lo = along ? x0 : z0;
  const hi = along ? x1 : z1;
  // 床の上の点（壁に沿う u・壁からの深さ d）の箱
  const floorBox = (ua: number, ub: number, d0: number, d1: number, y: number, th = 0.03): AABB => {
    const pa = face + (along ? nz : nx) * d0;
    const pb = face + (along ? nz : nx) * d1;
    return along ? [ua, y - th, Math.min(pa, pb), ub, y + th, Math.max(pa, pb)] : [Math.min(pa, pb), y - th, ua, Math.max(pa, pb), y + th, ub];
  };
  if (dn < 0.2) {
    const d1 = Math.min(D - 0.1, 1.9);
    sunPatch(ctx, floorBox(Math.max(lo, u0 - 0.35), Math.min(hi, u1 + 0.35), 0.02, d1, floorY), [0, 1, 0], 0.5, false);
    return;
  }
  // 外に抜けた窓は本物の日が通る（灯りは要らない）
  if (!blind) return;
  const slices = Math.abs(da * (hb - ha)) > 0.35 ? 2 : 1;
  for (let i = 0; i < slices; i++) {
    const h0 = ha + ((hb - ha) * i) / slices;
    const h1 = ha + ((hb - ha) * (i + 1)) / slices;
    const hm = (h0 + h1) / 2;
    const d0 = h0 * dn;
    const d1 = h1 * dn;
    const ua = Math.max(lo + 0.02, u0 + hm * da);
    const ub = Math.min(hi - 0.02, u1 + hm * da);
    if (ub - ua < 0.05) continue;
    if (d0 < D - 0.03) sunPatch(ctx, floorBox(ua, ub, Math.max(0.02, d0), Math.min(d1, D - 0.03), floorY), [0, 1, 0], 0.95);
    if (d1 > D) {
      // 向かいの壁に上る日なた（壁の面の薄い箱）
      const ya = floorY + Math.max(0, h0 - D / dn);
      const yb = floorY + h1 - D / dn;
      const sh = (D / dn) * da;
      const wa = Math.max(lo + 0.02, u0 + sh);
      const wb = Math.min(hi - 0.02, u1 + sh);
      if (yb - ya > 0.05 && wb - wa > 0.05) {
        const fd = face + (along ? nz : nx) * D;
        const box: AABB = along ? [wa, ya, fd - 0.04, wb, yb, fd + 0.04] : [fd - 0.04, ya, wa, fd + 0.04, yb, wb];
        sunPatch(ctx, box, [-nx, 0, -nz], 0.95);
      }
    }
  }
}

/** 光の筒の外形（天井と上の塊をくり抜く箱） */
export function roofLightHoles(r: RoomSpec): AABB[] {
  const rl = r.roofLights;
  if (!rl) return [];
  return rl.at.map(([cx, cz]): AABB => [cx - rl.size / 2, r.y1 - 0.02, cz - rl.size / 2, cx + rl.size / 2, rl.top + 0.02, cz + rl.size / 2]);
}

/** 外に抜ける窓の穴（部屋の壁の外の塊を窓の形にくり抜く。外から 2 m まで） */
export function windowHoles(r: RoomSpec): AABB[] {
  const t = r.t ?? 0.3;
  const [x0, z0, x1, z1] = r.rect;
  return (r.windows ?? [])
    .filter((w) => !w.blind)
    .flatMap((w) =>
      w.at.map((at): AABB => {
        const ya = r.y0 + w.y0;
        const yb = r.y0 + w.y1;
        const u0 = at - w.w / 2;
        const u1 = at + w.w / 2;
        if (w.side === 'n') return [u0, ya, z0 - t - 2, u1, yb, z0 - t + 0.01];
        if (w.side === 's') return [u0, ya, z1 + t - 0.01, u1, yb, z1 + t + 2];
        if (w.side === 'w') return [x0 - t - 2, ya, u0, x0 - t + 0.01, yb, u1];
        return [x1 + t - 0.01, ya, u0, x1 + t + 2, yb, u1];
      }),
    );
}

/**
 * 光の筒（天井の四角い穴から屋根の上面まで。筒の面は天井と上の塊をくり抜いた面がそのままなる）: 上の端に明るいガラス、
 * 天井の縁に見切りの枠、真下の床（日の向きにずれる）と筒の中の日の当たる面に日なた
 */
export function roofLight(k: RoomKit, r: RoomSpec, cx: number, cz: number): void {
  const rl = r.roofLights!;
  const { b, m } = k;
  const s = rl.size;
  const h = s / 2;
  bx(b, m.flat(SKY_IN), cx - h, rl.top - 0.03, cz - h, cx + h, rl.top - 0.015, cz + h, { shadow: false });
  // 天井の見切り（暗い枠）
  const trim = m.get(r.court, 'inTrim', { brush: false });
  const y = r.y1;
  bx(b, trim, cx - h - 0.08, y - 0.05, cz - h - 0.08, cx + h + 0.08, y - 0.005, cz - h, {});
  bx(b, trim, cx - h - 0.08, y - 0.05, cz + h, cx + h + 0.08, y - 0.005, cz + h + 0.08, {});
  bx(b, trim, cx - h - 0.08, y - 0.05, cz - h, cx - h, y - 0.005, cz + h, {});
  bx(b, trim, cx + h, y - 0.05, cz - h, cx + h + 0.08, y - 0.005, cz + h, {});
  // 日は筒を通って本物の影で床と筒の面に落ちる（灯りは要らない）
}
