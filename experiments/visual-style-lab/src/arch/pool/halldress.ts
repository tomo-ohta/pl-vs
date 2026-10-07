import * as THREE from 'three';
import type { V3 } from '../../scenes/Builder.ts';
import type { ViewCam } from '../../scenes/pool/view.ts';
import type { HallEnv } from './hallkit.ts';
import { HALL, HALL_DOORS, type HallId } from './layout.ts';
import { doorsInRect, hallWallRect, holeHeight, type Side } from './walls.ts';

/**
 * ホールの外周の壁の作り込み（写っていない所の決まり）。参考画像の柱と梁の言葉で:
 * - 壁の柱型（3 m 前後おき・タイル張り・段々の柱頭）と、柱型の足元の青緑の台座
 * - プールサイドに面した壁の腰の青緑のタイルの帯（濡れる所）
 * - 天井の際の段々の蛇腹（2 段）
 * 参考画像の視点（cam）から見える所（水面の映り込みも）には置かない。日の影が視点に落ちる物は影を落とさない。
 */
export interface HallDressOpts {
  /** 柱型・蛇腹の材質（ホールの壁と同じタイル） */
  pier: THREE.Material;
  /** 天井の高さ（蛇腹の上端） */
  ceil: number;
  /** 参考画像の視点（区域の座標）と日の向き */
  cam?: ViewCam;
  sun: THREE.Vector3;
  /** 柱型の間隔 */
  pitch?: number;
  /** 作らない辺 */
  skip?: Side[];
  /** 柱型を作らない範囲（場面の座標の箱 x0, z0, x1, z1） */
  avoid?: [number, number, number, number][];
  /** 辺ごとの柱型の位置（場面の座標。省略時は pitch で等分） */
  positions?: Partial<Record<Side, number[]>>;
  /** 辺ごとの追加の開口（高窓など） */
  extra?: Partial<Record<Side, { a: number; b: number; top: number }[]>>;
  /** 腰の帯を作らない */
  noBand?: boolean;
  /** 蛇腹を作らない */
  noCornice?: boolean;
}

/**
 * 参考画像の視点（区域の座標の cam）から見えない所（映り込みも）だけに箱を置く道具。
 * 影が視点に落ちる箱は影を受けるだけにする。置けたら true
 */
export function unseenPlacer(env: HallEnv, id: HallId, cam: ViewCam | undefined, sunDir: THREE.Vector3): (mat: THREE.Material, a: V3, c: V3, cast?: boolean) => boolean {
  const k = env.k;
  const [ox, oz] = HALL[id].o;
  const sun = sunDir.clone().normalize();
  const fwd = cam ? cam.ray(728, 408) : null;
  const inImg = (p: V3): boolean => {
    if (!cam || !fwd) return false;
    for (const y of [p[1], -p[1]]) {
      const lp: V3 = [p[0] - ox, y, p[2] - oz];
      if ((lp[0] - cam.eye[0]) * fwd.x + (lp[1] - cam.eye[1]) * fwd.y + (lp[2] - cam.eye[2]) * fwd.z < 0.05) continue;
      const q = cam.proj(lp);
      if (q && q[0] > -90 && q[0] < 1546 && q[1] > -90 && q[1] < 906) return true;
    }
    return false;
  };
  const seen = (a: V3, c: V3): boolean => {
    for (let i = 0; i <= 2; i++)
      for (let j = 0; j <= 6; j++)
        for (let l = 0; l <= 2; l++) if (inImg([a[0] + ((c[0] - a[0]) * i) / 2, a[1] + ((c[1] - a[1]) * j) / 6, a[2] + ((c[2] - a[2]) * l) / 2])) return true;
    return false;
  };
  const shadowSeen = (a: V3, c: V3): boolean => {
    for (const x of [a[0], c[0]])
      for (const z of [a[2], c[2]])
        for (let s = 0; s <= 4; s++) {
          const y = a[1] + ((c[1] - a[1]) * s) / 4;
          for (const yf of [0, 0.15]) {
            const t = (yf - y) / sun.y;
            if (t >= 0 && inImg([x + sun.x * t, yf, z + sun.z * t])) return true;
          }
        }
    return false;
  };
  return (mat, a, c, cast = true) => {
    const mn: V3 = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])];
    const mx: V3 = [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])];
    if (seen(mn, mx)) return false;
    const sh = cast && !shadowSeen(mn, mx) ? true : 'receive';
    if (mn[1] < 0) k.box(mat, mn, mx, { shadow: sh });
    else k.b.boxMM(mat, mn, mx, { shadow: sh });
    return true;
  };
}

/** 参考画像の視点（区域の座標の cam）から箱が見えるか（映り込みも。遮る物は考えない） */
export function viewSees(id: HallId, cam: ViewCam): (a: V3, c: V3) => boolean {
  const [ox, oz] = HALL[id].o;
  const fwd = cam.ray(728, 408);
  const inImg = (p: V3): boolean => {
    for (const y of [p[1], -p[1]]) {
      const lp: V3 = [p[0] - ox, y, p[2] - oz];
      if ((lp[0] - cam.eye[0]) * fwd.x + (lp[1] - cam.eye[1]) * fwd.y + (lp[2] - cam.eye[2]) * fwd.z < 0.05) continue;
      const q = cam.proj(lp);
      if (q[0] > -90 && q[0] < 1546 && q[1] > -90 && q[1] < 906) return true;
    }
    return false;
  };
  return (a, c) => {
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= 4; j++) for (let l = 0; l <= 2; l++) if (inImg([a[0] + ((c[0] - a[0]) * i) / 2, a[1] + ((c[1] - a[1]) * j) / 4, a[2] + ((c[2] - a[2]) * l) / 2])) return true;
    return false;
  };
}

let bandMat: THREE.Material | null = null;
let plinthMat: THREE.Material | null = null;

export function hallDress(env: HallEnv, id: HallId, o: HallDressOpts): void {
  const { k } = env;
  const b = k.b;
  const m = b.ctx.mat;
  bandMat ??= m({ name: 'hall-band', color: '#74a79f', shade: '#456f6b', dark: '#365e5c', hi: '#84b4ab', tiles: { size: 0.25, line: 0.016, color: '#5f8f88', jitter: 0.04 } });
  plinthMat ??= m({ name: 'hall-plinth', color: '#7fb1a8', shade: '#4f807c', dark: '#3d6966', hi: '#8cbcb2', tiles: { size: 0.25, line: 0.01, color: '#6c9f97' } });
  const [ox, oz] = HALL[id].o;
  const [x0, z0, x1, z1] = HALL[id].rect;
  const cam = o.cam;
  const sun = o.sun.clone().normalize();
  const fwd = cam ? cam.ray(728, 408) : null;
  const inImg = (p: V3): boolean => {
    if (!cam || !fwd) return false;
    for (const y of [p[1], -p[1]]) {
      const lp: V3 = [p[0] - ox, y, p[2] - oz];
      // カメラの後ろは見えない（proj は後ろの点も画面へ写すので先に除く）
      if ((lp[0] - cam.eye[0]) * fwd.x + (lp[1] - cam.eye[1]) * fwd.y + (lp[2] - cam.eye[2]) * fwd.z < 0.05) continue;
      const q = cam.proj(lp);
      if (q && q[0] > -90 && q[0] < 1546 && q[1] > -90 && q[1] < 906) return true;
    }
    return false;
  };
  // 箱が視点から見えるか（箱の中の点を細かく調べる。遮る物は考えない = 控えめ）
  const seen = (a: V3, c: V3): boolean => {
    for (let i = 0; i <= 2; i++)
      for (let j = 0; j <= 6; j++)
        for (let l = 0; l <= 2; l++) {
          const p: V3 = [a[0] + ((c[0] - a[0]) * i) / 2, a[1] + ((c[1] - a[1]) * j) / 6, a[2] + ((c[2] - a[2]) * l) / 2];
          if (inImg(p)) return true;
        }
    return false;
  };
  // 箱の影が視点に落ちるか（上の角から日の向きに床・水面の高さまで）
  const shadowSeen = (a: V3, c: V3): boolean => {
    for (const x of [a[0], c[0]])
      for (const z of [a[2], c[2]])
        for (let s = 0; s <= 4; s++) {
          const y = a[1] + ((c[1] - a[1]) * s) / 4;
          for (const yf of [0, 0.15]) {
            const t = (yf - y) / sun.y;
            if (t < 0) continue;
            if (inImg([x + sun.x * t, yf, z + sun.z * t])) return true;
          }
        }
    return false;
  };
  const put = (mat: THREE.Material, a: V3, c: V3, cast = true): boolean => {
    const mn: V3 = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])];
    const mx: V3 = [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])];
    if (seen(mn, mx)) return false;
    const sh = cast && !shadowSeen(mn, mx) ? true : 'receive';
    if (mn[1] < 0) k.box(mat, mn, mx, { shadow: sh });
    else b.boxMM(mat, mn, mx, { shadow: sh });
    return true;
  };
  // 壁ぞいにすでに置いた物（掲示・ベンチ・植木・柱など）。柱型はこれを避ける
  const items: THREE.Box3[] = [];
  b.root.updateMatrixWorld(true);
  b.root.traverse((ob) => {
    const mesh = ob as THREE.Mesh;
    if (!mesh.isMesh || mesh.name.startsWith('gobo')) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    items.push(bb);
  });
  const pitch = o.pitch ?? 3.0;
  const PW = 0.6;
  const PD = 0.3;
  const top = o.ceil;
  for (const side of ['n', 's', 'w', 'e'] as Side[]) {
    if (o.skip?.includes(side)) continue;
    const ns = side === 'n' || side === 's';
    const line = side === 'n' ? z0 : side === 's' ? z1 : side === 'w' ? x0 : x1;
    const sg = side === 'n' || side === 'w' ? 1 : -1;
    const [lo, hi] = ns ? [x0, x1] : [z0, z1];
    // 壁の開口（部屋の扉・ホールどうしの開口）
    const ops: { a: number; b: number; top: number; bottom?: number; win?: boolean }[] = [];
    for (const d of doorsInRect(hallWallRect(id, side))) {
      const t = ns ? d.at[0] : d.at[1];
      const hh = holeHeight(d.def, d.floor);
      ops.push({ a: t - d.width / 2, b: t + d.width / 2, top: hh.top + (d.def.kind === 'auto' ? 0.25 : 0), bottom: hh.bottom, win: d.def.kind === 'window' });
    }
    for (const h of HALL_DOORS) {
      if ((h.wall === 'x') !== ns) continue;
      if (Math.abs((ns ? h.at[1] : h.at[0]) - (line - sg * 0.5)) > 0.6) continue;
      const t = ns ? h.at[0] : h.at[1];
      if (t < lo - 1 || t > hi + 1) continue;
      ops.push({ a: t - h.width / 2, b: t + h.width / 2, top: h.top + (h.kind === 'auto' ? 0.25 : 0), bottom: h.bottom, win: h.kind === 'window' });
    }
    for (const e of o.extra?.[side] ?? []) ops.push(e);
    const blocked = (a: number, c: number): boolean => ops.some((op) => c > op.a - 0.65 && a < op.b + 0.65);
    // 壁の面から 0.7 m 以内の小さな物（壁そのもの・床のような大きな箱は除く）
    const near: [number, number][] = [];
    const nearBox: THREE.Box3[] = [];
    for (const bb of items) {
      const along0 = ns ? bb.min.x : bb.min.z;
      const along1 = ns ? bb.max.x : bb.max.z;
      const d0 = ns ? bb.min.z : bb.min.x;
      const d1 = ns ? bb.max.z : bb.max.x;
      const dn = sg > 0 ? d0 - line : line - d1;
      const thick = d1 - d0;
      if (along1 - along0 > 5 || thick > 3 || dn > 0.7 || (sg > 0 ? d1 < line - 0.01 : d0 > line + 0.01)) continue;
      // 壁そのもの（壁の厚さの中の箱）は除く
      if (thick > 0.3 && (sg > 0 ? d1 <= line + 0.02 : d0 >= line - 0.02)) continue;
      if (bb.max.y < 0.1 || bb.min.y > top) continue;
      near.push([along0 - 0.15, along1 + 0.15]);
      nearBox.push(bb);
    }
    const crowded = (a: number, c: number): boolean => near.some(([p, q]) => c > p && a < q);
    const avoid = (t: number): boolean => (o.avoid ?? []).some((r) => {
      const x = ns ? t : line + sg * 0.3;
      const z = ns ? line + sg * 0.3 : t;
      return x > r[0] && x < r[2] && z > r[1] && z < r[3];
    });
    const at = (t0: number, t1: number, ya: number, yb: number, d0: number, d1: number): [V3, V3] =>
      ns ? [[t0, ya, line + sg * d0], [t1, yb, line + sg * d1]] : [[line + sg * d0, ya, t0], [line + sg * d1, yb, t1]];
    // 扉・開口の段々の額縁（2 段に張り出すタイルの塊。D のアーチの段と同じ言葉）
    for (const op of ops) {
      if (op.bottom === undefined || op.bottom < 0 || op.top > top - 0.7) continue;
      const y0 = op.win ? op.bottom - 0.12 : 0.15;
      for (const [w, d, up] of [[0.3, 0.22, 0.3], [0.55, 0.11, 0.55]] as [number, number, number][]) {
        const [a1, c1] = at(op.a - w, op.a, y0, op.top + up, 0, d);
        put(o.pier, a1, c1);
        const [a2, c2] = at(op.b, op.b + w, y0, op.top + up, 0, d);
        put(o.pier, a2, c2);
        // 上の横木は、扉の上の表示（非常口・案内の板）があれば省く
        const sign = nearBox.some((bb) => bb.max.y > op.top - 0.05 && bb.min.y < op.top + up && (ns ? bb.max.x > op.a - w && bb.min.x < op.b + w : bb.max.z > op.a - w && bb.min.z < op.b + w));
        const [a3, c3] = at(op.a - w, op.b + w, op.top, op.top + up, 0, d);
        if (!sign) put(o.pier, a3, c3);
      }
      if (op.win) {
        const [a4, c4] = at(op.a - 0.3, op.b + 0.3, op.bottom - 0.12, op.bottom, 0, 0.3);
        put(o.pier, a4, c4);
      }
    }
    // 柱型
    const n = Math.max(1, Math.round((hi - lo) / pitch));
    const piers: number[] = [];
    const list = o.positions?.[side] ?? Array.from({ length: n }, (_, i) => lo + ((i + 0.5) * (hi - lo)) / n);
    for (const t of list) {
      if (blocked(t - PW / 2, t + PW / 2) || avoid(t) || crowded(t - PW / 2 - 0.25, t + PW / 2 + 0.25)) continue;
      const [a, c] = at(t - PW / 2, t + PW / 2, -2, top - 0.5, 0, PD);
      if (!put(o.pier, a, c)) continue;
      piers.push(t);
      // 柱頭（2 段に広がって天井の蛇腹へ）
      const [a1, c1] = at(t - PW / 2 - 0.125, t + PW / 2 + 0.125, top - 0.5, top - 0.25, 0, PD + 0.125);
      put(o.pier, a1, c1);
      const [a2, c2] = at(t - PW / 2 - 0.25, t + PW / 2 + 0.25, top - 0.25, top + 0.01, 0, PD + 0.25);
      put(o.pier, a2, c2);
      // 足元の台座（プールサイドの上だけ。水の中は柱の段の色のまま）
      const f = ns ? k.hf.at(t, line + sg * 0.5) : k.hf.at(line + sg * 0.5, t);
      if (f >= 0) {
        const [a3, c3] = at(t - PW / 2 - 0.06, t + PW / 2 + 0.06, 0.15, 0.4, 0, PD + 0.06);
        put(plinthMat, a3, c3, false);
      }
    }
    // 腰の帯（プールサイドに面した所だけ。開口・柱型は空ける）と、蛇腹（2 段）
    const step = 0.5;
    for (let t = lo; t < hi - 1e-3; t += step) {
      const t1 = Math.min(hi, t + step);
      const tm = (t + t1) / 2;
      const nearPier = piers.some((p) => Math.abs(p - tm) < PW / 2 + 0.01);
      const dry = (ns ? k.hf.at(tm, line + sg * 0.4) : k.hf.at(line + sg * 0.4, tm)) >= 0;
      if (!o.noBand && dry && !nearPier && !blocked(t + 0.3, t1 - 0.3) && !avoid(tm)) {
        const [a, c] = at(t, t1, 0.15, 1.05, 0, 0.025);
        put(bandMat, a, c, false);
      }
      if (!o.noCornice && !ops.some((op) => t1 > op.a && t < op.b && op.top > top - 0.6)) {
        const [a, c] = at(t, t1, top - 0.22, top + 0.01, 0, 0.25);
        put(o.pier, a, c, false);
        const [a2, c2] = at(t, t1, top - 0.42, top - 0.22, 0, 0.12);
        put(o.pier, a2, c2, false);
      }
    }
  }
}
