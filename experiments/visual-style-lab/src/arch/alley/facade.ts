import * as THREE from 'three';
import type { Builder } from '../../scenes/Builder.ts';
import type { LocalFrame } from './frame.ts';
import { glassQuad } from './glass.ts';

/**
 * 校舎の外壁を本当の形で作る（場面専用）。
 * - 壁: 外形（下端〜屋根の線。道路斜線の所は斜め）に窓の穴を空けた板を、厚さ thick だけ押し出す（窓の抱き・まぐさ・窓台が本当の面になる）
 * - 柱型: 壁から外へ出た縦の柱
 * - 窓: 穴の奥（glassW）にガラス、まわりに鉄の枠、縦の桟・横の桟、下に水切り
 * - 扉: 穴だけ空けて、扉は呼ぶ側が作る（近づくと開く扉など）
 * 形は壁の座標（u: 壁に沿って、y: 高さ、w: 外へ）で決めて、LocalFrame で場面へ置く。
 */

export interface Opening {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  /** 縦の桟の u（端は含めない） */
  mull?: number[];
  /** 太い縦の桟の u */
  heavy?: number[];
  /** 横の桟の y */
  trans?: number[];
  /** 'door' は穴だけ（ガラス・枠を作らない） */
  kind?: 'window' | 'door';
  /** 部屋の区画 [u0, u1, 床, 天井] と [奥行き, 種類, 種, 見せ方]（glass.ts） */
  cell?: [number, number, number, number];
  room?: [number, number, number, number];
  /** 水切り（窓台）を付けない */
  noSill?: boolean;
}

export interface Pier {
  u: number;
  width: number;
  /** 壁から外へ出る長さ */
  out: number;
  y0: number;
  /** 上端（省略で屋根の線） */
  y1?: number;
}

export interface FacadeMats {
  wall: THREE.Material;
  pier: THREE.Material;
  frame: THREE.Material;
  sill: THREE.Material;
  glass: THREE.Material;
  /** 透明のガラス（入れる部屋） */
  glassClear?: THREE.Material;
  coping?: THREE.Material;
}

export interface FacadeSpec {
  fr: LocalFrame;
  u0: number;
  u1: number;
  /** 壁の下端・厚さ */
  bottom: number;
  thick: number;
  /** ガラスの面（w。負） */
  glassW: number;
  /** 屋根の線（パラペットの上端） */
  top: (u: number) => number;
  /** 屋根の線が折れる u（斜線の始まり） */
  kinks?: number[];
  openings: Opening[];
  piers?: Pier[];
  /** 当たり判定を付ける高さ（0 で付けない）。扉の穴は空ける */
  collideTo?: number;
  /** 笠木（屋根の線の上の細い縁） */
  coping?: boolean;
  /** 壁の両端の小口を作らない（隣の壁とつながる） */
  open?: boolean;
  /** 階ごとの水平の帯（床の高さの庇・水切り。少し外へ出る）。材質は水切りと同じ（日なたも同じ） */
  belts?: number[];
  /** 窓台の下の雨だれの筋（縁をちぎった半透明の貼り絵。写っていない壁だけに使う） */
  streaks?: THREE.Material;
  /** 雨だれの種 */
  seed?: number;
}

/** 壁の外形と穴（u, y）を作って押し出す */
function wallGeo(s: FacadeSpec, holes: Opening[]): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(s.u0, s.bottom);
  shape.lineTo(s.u1, s.bottom);
  const ks = [...(s.kinks ?? [])].filter((k) => k > s.u0 && k < s.u1).sort((a, b) => b - a);
  shape.lineTo(s.u1, s.top(s.u1));
  for (const k of ks) shape.lineTo(k, s.top(k));
  shape.lineTo(s.u0, s.top(s.u0));
  shape.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h.u0, h.y0);
    p.lineTo(h.u0, h.y1);
    p.lineTo(h.u1, h.y1);
    p.lineTo(h.u1, h.y0);
    p.closePath();
    shape.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: s.thick, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -s.thick);
  return g;
}

/** 窓が屋根の線の下に収まるか */
function fits(s: FacadeSpec, o: Opening): boolean {
  return o.y1 < Math.min(s.top(o.u0), s.top(o.u1)) - 0.35 && o.u0 >= s.u0 - 1e-6 && o.u1 <= s.u1 + 1e-6;
}

export function buildFacade(b: Builder, s: FacadeSpec, m: FacadeMats): { holes: Opening[] } {
  const fr = s.fr;
  const holes = s.openings.filter((o) => fits(s, o));
  b.mesh(fr.place(wallGeo(s, holes)), m.wall, [0, 0, 0], { shadow: false });
  const box = (mat: THREE.Material, u0: number, y0: number, w0: number, u1: number, y1: number, w1: number): void => {
    if (u1 - u0 < 1e-4 || y1 - y0 < 1e-4 || Math.abs(w1 - w0) < 1e-4) return;
    b.mesh(fr.boxGeo([u0, y0, w0], [u1, y1, w1]), mat, [0, 0, 0], { shadow: false });
  };
  const gw = s.glassW;
  for (const o of holes) {
    if (o.kind === 'door') continue;
    // 鉄の窓の枠は細く浅い（見付け 3〜5 cm・見込み 3 cm）。斜めから見ても太く見えすぎない
    const fw = 0.045;
    const fd0 = gw - 0.015;
    const fd1 = gw + 0.015;
    box(m.frame, o.u0, o.y0, fd0, o.u1, o.y0 + fw, fd1);
    box(m.frame, o.u0, o.y1 - fw, fd0, o.u1, o.y1, fd1);
    box(m.frame, o.u0, o.y0, fd0, o.u0 + fw, o.y1, fd1);
    box(m.frame, o.u1 - fw, o.y0, fd0, o.u1, o.y1, fd1);
    for (const u of o.mull ?? []) box(m.frame, u - 0.017, o.y0, fd0, u + 0.017, o.y1, fd1 - 0.004);
    for (const u of o.heavy ?? []) box(m.frame, u - 0.04, o.y0, fd0 - 0.01, u + 0.04, o.y1, fd1 + 0.01);
    for (const y of o.trans ?? []) box(m.frame, o.u0, y - 0.02, fd0, o.u1, y + 0.02, fd1 - 0.004);
    // 水切り（少し外へ出る）
    if (!o.noSill) box(m.sill, o.u0 - 0.03, o.y0 - 0.04, gw, o.u1 + 0.03, o.y0 + 0.004, 0.035);
    // ガラス
    const cell = o.cell ?? [o.u0, o.u1, o.y0 - 0.9, o.y1 + 0.3];
    const room = o.room ?? [3, 0, 0, 0];
    const mat = room[3] === 1 && m.glassClear ? m.glassClear : m.glass;
    // 板の大きさ（縦の桟の間隔・横の桟で分けた段の高さ）
    const nu = (o.mull?.length ?? 0) + 1;
    const nv = (o.trans?.length ?? 0) + 1;
    const pane: [number, number] = [(o.u1 - o.u0) / nu, (o.y1 - o.y0) / nv];
    b.mesh(glassQuad(fr, o.u0, o.y0, o.u1, o.y1, gw, cell, room, pane), mat, [0, 0, 0], { shadow: false });
  }
  // 階ごとの水平の帯（窓の穴を避けて、窓の間だけ。窓の上下の枠に重ねない）
  for (const y of s.belts ?? []) {
    const cuts = holes.filter((o) => o.y0 < y + 0.25 && o.y1 > y - 0.05).sort((a, c) => a.u0 - c.u0);
    let u = s.u0 + 0.05;
    const yTop = Math.min(s.top(s.u0), s.top(s.u1));
    if (y > yTop - 0.6) continue;
    for (const o of [...cuts, { u0: s.u1 - 0.05, u1: s.u1 } as Opening]) {
      if (o.u0 - u > 0.2) box(m.sill, u, y - 0.18, -0.01, o.u0, y, 0.07);
      u = Math.max(u, o.u1);
    }
  }
  // 雨だれ（窓台の下。長さは窓ごとに違う）
  if (s.streaks) {
    let k = (s.seed ?? 1) * 7.31;
    const rnd = (): number => {
      k = (k * 9301 + 49297) % 233280;
      return k / 233280;
    };
    for (const o of holes) {
      if (o.kind === 'door' || o.y0 < 0.6) continue;
      const len = 0.5 + rnd() * 1.4;
      const y1 = o.y0 - 0.05;
      const y0 = Math.max(s.bottom + 0.1, y1 - len);
      if (y1 - y0 < 0.2) continue;
      const g = new THREE.PlaneGeometry(o.u1 - o.u0 + 0.04, y1 - y0);
      g.translate((o.u0 + o.u1) / 2, (y0 + y1) / 2, 0.004);
      b.mesh(fr.place(g), s.streaks, [0, 0, 0], { shadow: false });
    }
  }
  // 柱型
  for (const p of s.piers ?? []) {
    const top = p.y1 ?? Math.min(s.top(p.u - p.width / 2), s.top(p.u + p.width / 2));
    box(m.pier, p.u - p.width / 2, p.y0, -0.01, p.u + p.width / 2, top, p.out);
  }
  // 笠木（屋根の線に沿った細い縁）
  if (s.coping && m.coping) {
    const pts = [s.u0, ...(s.kinks ?? []).filter((k) => k > s.u0 && k < s.u1).sort((a, c) => a - c), s.u1];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const c = pts[i + 1];
      const ya = s.top(a);
      const yc = s.top(c);
      const len = Math.hypot(c - a, yc - ya);
      const g = new THREE.BoxGeometry(len, 0.08, s.thick + 0.12);
      g.rotateZ(Math.atan2(yc - ya, c - a));
      g.translate((a + c) / 2, (ya + yc) / 2 + 0.03, -s.thick / 2 + 0.03);
      b.mesh(fr.place(g), m.coping, [0, 0, 0], { shadow: false });
    }
  }
  // 当たり判定（扉の穴は空ける）。壁の上端（屋根の線）まで付ける: 低い所で切ると、壁の上（厚さ 30 cm の帯）が
  // 「歩ける床」になり、外階段の踊り場などから壁の上を歩いて屋根へ渡れてしまう
  if (s.collideTo && s.collideTo > s.bottom) {
    const roofTop = Math.max(s.top(s.u0), s.top(s.u1), ...(s.kinks ?? []).map((k) => s.top(k)));
    const cTop = Math.max(s.collideTo, roofTop + 0.5);
    const doors = holes.filter((o) => o.kind === 'door' && o.y0 < cTop - 0.5).sort((a, c) => a.u0 - c.u0);
    let u = s.u0;
    for (const d of doors) {
      if (d.u0 > u) fr.collide(b.ctx.colliders, [u, s.bottom, -s.thick], [d.u0, cTop, 0.02]);
      // 扉の上
      fr.collide(b.ctx.colliders, [d.u0, d.y1, -s.thick], [d.u1, cTop, 0.02]);
      u = d.u1;
    }
    if (u < s.u1) fr.collide(b.ctx.colliders, [u, s.bottom, -s.thick], [s.u1, cTop, 0.02]);
  }
  return { holes };
}

/** 等しい間隔の縦の桟の位置（端を含めない） */
export function evenMull(u0: number, u1: number, n: number): number[] {
  return Array.from({ length: n - 1 }, (_, i) => u0 + ((u1 - u0) * (i + 1)) / n);
}
