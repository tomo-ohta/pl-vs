/**
 * 壁・天井・床の造作（当たり判定の無い薄い箱）: 腰壁・巾木・手すりの帯、開かない装飾の扉、掲示板・額・壁の窓、
 * 非常口の灯り、吊り看板、天井のダクト（v1 CorridorGenerator の decorate と common.wallBands を移植）。
 *
 * - 文字のサイン（SignSpec）は v2 にまだ無いので、文字の無い板（signPlate / signEmissive）で表す
 * - 開口の前は帯・扉を切る（freeRuns / slots）。置くのは ctx.addDecor（足跡と高さの範囲だけ見る）
 */
import type { Rng } from '../../math/rng.ts';
import { along } from '../../world/footprint.ts';
import { box, type Box, type MatId } from '../../world/layout.ts';
import { placeUnit, type DressCtx } from './ctx.ts';
import { gid, tagGroup } from './furniture.ts';
import { alongFace, freeRuns, onFace, type Face } from './geom.ts';

/** 当たり判定の無い飾りを 1 単位として足す（足跡・高さの外の箱があれば足さない） */
export function addDecor(c: DressCtx, boxes: Box[]): boolean {
  if (!boxes.length) return false;
  for (const b of boxes) b.solid = false;
  return placeUnit(c, boxes);
}

/** 壁の帯: y0..y1、壁面からの出 depth（既定 0.02） */
export interface Band {
  y0: number;
  y1: number;
  mat: MatId;
  depth?: number;
}

/**
 * 壁の内面に帯（腰壁・巾木・手すり・廻り縁）を貼る（v1 common.wallBands）。開口（幅 + 0.08）は避ける。
 * 壁際に置く家具の離れ（c.standoff）を、腰の高さまでの帯の出より前に更新する
 */
export function wallBands(c: DressCtx, bands: readonly Band[], faces: readonly Face[] = c.faces): void {
  const B: Box[] = [];
  for (const f of faces) {
    for (const [p, q] of freeRuns(f, c.openings, 0.08, 0)) {
      for (const b of bands) {
        const d = b.depth ?? 0.02;
        const y1 = Math.min(b.y1, c.h - 0.01);
        if (y1 - b.y0 < 0.005) continue;
        B.push(alongFace(f, p, q - p, 0, d, b.y0, y1, b.mat, false));
      }
    }
  }
  for (const b of bands) if (b.y0 < 1.9) c.standoff = Math.max(c.standoff, (b.depth ?? 0.02) + 0.01);
  addDecor(c, B);
}

/**
 * 壁に沿った等間隔の位置（中央寄せ。v1 CorridorGenerator.slots）。隅 margin と、同じ壁の開口 ± pad を避ける。
 * i は等間隔の番号（役割の交代に使う）
 */
export function slots(c: DressCtx, f: Face, pitch: number, halfW: number, margin: number, pad = 1.6): { t: number; i: number }[] {
  const usable = f.a1 - f.a0 - 2 * (margin + halfW);
  if (usable < 0) return [];
  const n = Math.floor(usable / pitch) + 1;
  const start = f.a0 + margin + halfW + (usable - (n - 1) * pitch) / 2;
  const cuts = c.openings.filter((s) => onFace(f, s)).map((s) => {
    const t = along(s.dir, s.pos[0], s.pos[2]);
    return [t - s.width / 2, t + s.width / 2] as const;
  });
  const out: { t: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = start + i * pitch;
    if (cuts.some(([p, q]) => t + halfW > p - pad && t - halfW < q + pad)) continue;
    out.push({ t, i });
  }
  return out;
}

/** 装飾の扉（開かない）: 枠（frame）の上に 5 cm 浮かせた扉の板 + レバー（v1 decorDoor と同じ寸法） */
export function decorDoor(B: Box[], f: Face, t: number, mat: MatId, dw = 0.9, dh = 2.05, frame: MatId = 'trim'): void {
  const from = B.length;
  B.push(alongFace(f, t - dw / 2 - 0.065, dw + 0.13, 0, 0.05, 0, dh + 0.065, frame, false));
  B.push(alongFace(f, t - dw / 2, dw, 0.05, 0.08, 0.01, dh, mat, false));
  B.push(alongFace(f, t + dw / 2 - 0.16, 0.11, 0.08, 0.13, 0.99, 1.02, 'metal', false));
  tagGroup(B, from, gid('decorDoor', f.dir, t, f.face), 'decorDoor', from + 1);
}

/** 扉の脇の番号 / 室名の板（文字は無い。高さ 1.55 m） */
export function doorPlate(B: Box[], f: Face, t: number, dw = 0.9, width = 0.26, mat: MatId = 'signPlate'): void {
  const a = t + dw / 2 + 0.065 + 0.08;
  B.push(alongFace(f, a, width, 0, 0.012, 1.48, 1.62, mat, false));
}

/** 掲示板・額装ポスター（枠 + 面） */
export function board(B: Box[], f: Face, t: number, w: number, y0: number, y1: number, faceMat: MatId = 'noticeGreen', frame: MatId = 'trim'): void {
  B.push(alongFace(f, t - w / 2 - 0.04, w + 0.08, 0, 0.02, y0 - 0.04, y1 + 0.04, frame, false));
  B.push(alongFace(f, t - w / 2, w, 0.02, 0.032, y0, y1, faceMat, false));
}

/** 掲示板の上の紙（白い小さな板を数枚。位置と大きさは渡された乱数で揺らす） */
export function papers(B: Box[], rng: Rng, f: Face, t: number, w: number, y0: number, y1: number, n: number): void {
  const ph = 0.297;
  for (let k = 0; k < n; k++) {
    const pw = rng.float(0.21, 0.3);
    const a = t - w / 2 + 0.05 + (w - pw - 0.1) * ((k + 0.5) / n) + rng.float(-0.03, 0.03);
    const y = y0 + 0.08 + Math.max(0, y1 - y0 - ph - 0.16) * rng.next();
    B.push(alongFace(f, a, pw, 0.032, 0.036, y, y + ph, 'signPlate', false));
  }
}

/** 黒板（緑の面 + 木枠 + 粉受け） */
export function chalkboard(B: Box[], f: Face, t: number, w: number, y0 = 0.9, y1 = 2.1): void {
  B.push(alongFace(f, t - w / 2 - 0.05, w + 0.1, 0, 0.025, y0 - 0.05, y1 + 0.05, 'trim', false));
  B.push(alongFace(f, t - w / 2, w, 0.025, 0.035, y0, y1, 'chalkboard', false));
  B.push(alongFace(f, t - w / 2, w, 0.025, 0.09, y0 - 0.06, y0 - 0.03, 'trim', false));
}

/** 白板（白い面 + 金属枠） */
export function whiteboard(B: Box[], f: Face, t: number, w: number, y0 = 0.9, y1 = 1.9): void {
  B.push(alongFace(f, t - w / 2 - 0.03, w + 0.06, 0, 0.02, y0 - 0.03, y1 + 0.03, 'metal', false));
  B.push(alongFace(f, t - w / 2, w, 0.02, 0.028, y0, y1, 'paintWhite', false));
  B.push(alongFace(f, t - w / 2 + 0.1, w * 0.4, 0.02, 0.07, y0 - 0.05, y0 - 0.03, 'metal', false));
}

/** 壁の時計（白い文字盤 + 黒い縁 + 針） */
export function wallClock(B: Box[], f: Face, t: number, y: number, size = 0.32): void {
  const s = size / 2;
  B.push(alongFace(f, t - s, size, 0, 0.03, y - s, y + s, 'metalDark', false));
  B.push(alongFace(f, t - s + 0.02, size - 0.04, 0.03, 0.035, y - s + 0.02, y + s - 0.02, 'signPlate', false));
  B.push(alongFace(f, t - 0.006, 0.012, 0.035, 0.04, y - 0.01, y + s * 0.7, 'metalDark', false));
  B.push(alongFace(f, t - 0.006, s * 0.55, 0.035, 0.042, y - 0.01, y + 0.005, 'metalDark', false));
}

/** 壁の灯り（暖色の小さな箔） */
export function sconce(B: Box[], f: Face, t: number, y = 1.6, mat: MatId = 'lightWarm'): void {
  B.push(alongFace(f, t - 0.07, 0.14, 0.03, 0.11, y, y + 0.22, mat, false));
  B.push(alongFace(f, t - 0.05, 0.1, 0, 0.03, y + 0.06, y + 0.16, 'goldTrim', false));
}

/** 消火器の箱（赤い箱 + 白い帯） */
export function extinguisher(B: Box[], f: Face, t: number): void {
  B.push(alongFace(f, t - 0.22, 0.44, 0, 0.16, 0.0, 0.65, 'plasticRed', false));
  B.push(alongFace(f, t - 0.18, 0.36, 0.16, 0.165, 0.42, 0.5, 'paintWhite', false));
}

/**
 * 壁の窓（壁は抜かない）: 外の夜景 'windowNight' を壁面すぐ前に貼り、枠・方立て・窓台を付ける。
 * 区画の中身からは壁を抜けないので、抜いたように見せる（ガラスは無い。当たり判定は壁が持つ）
 */
export function wallWindow(B: Box[], f: Face, t0: number, t1: number, y0: number, y1: number, frame: MatId = 'trim', pitch = 1.8): void {
  const len = t1 - t0;
  if (len < 0.5 || y1 - y0 < 0.3) return;
  B.push(alongFace(f, t0, len, 0.004, 0.01, y0, y1, 'windowNight', false));
  B.push(alongFace(f, t0 - 0.04, len + 0.08, 0, 0.09, y0 - 0.03, y0, frame, false));
  B.push(alongFace(f, t0 - 0.04, len + 0.08, 0, 0.04, y1, y1 + 0.04, frame, false));
  const n = Math.max(1, Math.round(len / pitch));
  for (let k = 0; k <= n; k++) {
    const a = t0 + (len * k) / n;
    B.push(alongFace(f, Math.min(t1 - 0.02, Math.max(t0 - 0.02, a - 0.025)), 0.05, 0, 0.045, y0, y1, frame, false));
  }
  B.push(alongFace(f, t0, len, 0, 0.03, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, frame, false));
}

/** 非常口の灯り（緑に光る板 + 暗い枠）。面 f の t の上 y に */
export function exitSign(B: Box[], f: Face, t: number, y: number, w = 0.5): void {
  const from = B.length;
  B.push(alongFace(f, t - w / 2 - 0.02, w + 0.04, 0, 0.05, y - 0.02, y + 0.18, 'metalDark', false));
  B.push(alongFace(f, t - w / 2, w, 0.05, 0.06, y, y + 0.16, 'signEmissive', false));
  tagGroup(B, from, gid('exitSign', f.dir, t, f.face), 'exitSign', from + 1);
}

/**
 * 天井から吊る案内板（文字の無い板 + 吊り棒 2 本）。alongX は板の伸びる向き。y は板の中心、h は天井の高さ
 */
export function hangingPlate(B: Box[], x: number, z: number, y: number, w: number, hgt: number, alongX: boolean, h: number, mat: MatId = 'signPlate', faceMat: MatId | null = null): void {
  const hw = w / 2, t = 0.02;
  B.push(alongX ? box([x - hw, y - hgt / 2, z - t], [x + hw, y + hgt / 2, z + t], mat, false) : box([x - t, y - hgt / 2, z - hw], [x + t, y + hgt / 2, z + hw], mat, false));
  if (faceMat) {
    const f = hgt * 0.32;
    B.push(alongX ? box([x - hw + 0.05, y - f, z - t - 0.004], [x + hw - 0.05, y + f, z + t + 0.004], faceMat, false) : box([x - t - 0.004, y - f, z - hw + 0.05], [x + t + 0.004, y + f, z + hw - 0.05], faceMat, false));
  }
  for (const o of [-hw * 0.7, hw * 0.7]) {
    B.push(alongX ? box([x + o - 0.01, y + hgt / 2, z - 0.01], [x + o + 0.01, h, z + 0.01], 'metalDark', false) : box([x - 0.01, y + hgt / 2, z + o - 0.01], [x + 0.01, h, z + o + 0.01], 'metalDark', false));
  }
}

/** 壁の画面（テレビ・案内表示）: 暗い枠 + 面（点いていれば光る） */
export function wallScreen(B: Box[], f: Face, t: number, w: number, y0: number, y1: number, on: MatId | null = null): void {
  B.push(alongFace(f, t - w / 2, w, 0.02, 0.07, y0, y1, 'screenDark', false));
  if (on) B.push(alongFace(f, t - w / 2 + 0.03, w - 0.06, 0.07, 0.075, y0 + 0.03, y1 - 0.03, on, false));
}

/** 床に沿った帯（点字ブロック・誘導線）: x0..x1 × z0..z1 の非ソリッドの薄い箔 */
export function floorStrip(B: Box[], x0: number, z0: number, x1: number, z1: number, mat: MatId = 'yellowLine', h = 0.007): void {
  B.push(box([Math.min(x0, x1), 0.0005, Math.min(z0, z1)], [Math.max(x0, x1), h, Math.max(z0, z1)], mat, false));
}


/** 壁の小さな設備（コンセント・換気口・火災報知器の箱）を n 個まで。開口の前後は避ける。置いた数を返す */
export function wallDetails(c: DressCtx, rng: Rng, n: number): number {
  let placed = 0;
  const faces = c.faces.filter((f) => f.a1 - f.a0 >= 1.2);
  for (let i = 0; i < n * 3 && placed < n && faces.length; i++) {
    const f = rng.pick(faces);
    const runs = freeRuns(f, c.openings, 0.4).filter(([p, q]) => q - p >= 0.6);
    if (!runs.length) continue;
    const [p, q] = rng.pick(runs);
    const t = rng.float(p + 0.2, q - 0.2);
    const B: Box[] = [];
    const kind = rng.int(0, 2);
    if (kind === 0) B.push(alongFace(f, t - 0.035, 0.07, 0, 0.012, 0.28, 0.4, 'signPlate', false));
    else if (kind === 1) {
      const y = Math.max(1.9, c.h - 0.4);
      B.push(alongFace(f, t - 0.22, 0.44, 0, 0.015, y, y + 0.2, 'metal', false));
      for (let k = 0; k < 4; k++) B.push(alongFace(f, t - 0.19, 0.38, 0.015, 0.02, y + 0.03 + k * 0.045, y + 0.05 + k * 0.045, 'metalDark', false));
    } else B.push(alongFace(f, t - 0.08, 0.16, 0, 0.05, 1.45, 1.6, 'plasticRed', false));
    if (addDecor(c, B)) placed++;
  }
  return placed;
}
