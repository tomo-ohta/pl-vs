import * as THREE from 'three';
import { decalMaterial } from '../../render/Decal.ts';
import { createPaint, type FaceKey } from '../../render/PaintMaterial.ts';
import type { Lamp } from '../../render/Lamps.ts';
import { rng, type Builder } from '../../scenes/Builder.ts';
import type { LocalFrame } from './frame.ts';

/**
 * 小物と貼り物の道具（場面専用）。参考画像の小物は記号的（紙 = 白い長方形 + 灰色のくねった線）なので、掲示物・札は
 * 1 枚のキャンバスにまとめて描き、板ごとに升目を選んで貼る。光だまり（床の日の差し込み・窓の明るさ）は縁をちぎった貼り絵。
 * 灯り（ctx.addLamp）は照らす箱が部屋の内側から出ないように、壁の座標の部屋の箱から軸に沿った箱を求める。
 */

// ---------------------------------------------------------------- 掲示物の絵（8 × 4 の升目）
const COLS = 8;
const ROWS = 4;
const CELL = 128;
let noticeTexCache: THREE.CanvasTexture | null = null;
const noticeMats = new Map<string, THREE.ShaderMaterial>();

/** 場面を作り直すとき（読み込みのたび）に捨てる */
export function resetDressCache(): void {
  noticeTexCache = null;
  noticeMats.clear();
}

/** 掲示物・札の絵。升目の番号 0〜31: 0〜15 = 縦の紙、16〜23 = 横の紙、24〜27 = 室名札、28〜31 = 標識 */
export function noticeTexture(): THREE.CanvasTexture {
  if (noticeTexCache) return noticeTexCache;
  const c = document.createElement('canvas');
  c.width = COLS * CELL;
  c.height = ROWS * CELL;
  const g = c.getContext('2d')!;
  const r = rng(404);
  const papers = ['#a9d6c3', '#9cc9b6', '#b3dfcb', '#93c0ae', '#a2cfbc', '#8fbcaa'];
  const inks = ['#386b6f', '#27535c', '#386b6f', '#1f454d'];
  const squiggle = (x0: number, y: number, len: number, amp: number, col: string, w: number): void => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y);
    for (let x = x0; x < x0 + len; x += 3) g.lineTo(x, y + Math.sin(x * 0.55 + r() * 2) * amp);
    g.stroke();
  };
  for (let i = 0; i < COLS * ROWS; i++) {
    const cx = (i % COLS) * CELL;
    const cy = Math.floor(i / COLS) * CELL;
    g.save();
    g.translate(cx, cy);
    const ink = inks[i % inks.length];
    if (i < 24) {
      // 紙: 地の色・見出しの太い線・本文のくねった線・ところどころ写真の四角・赤い印
      g.fillStyle = papers[i % papers.length];
      g.fillRect(0, 0, CELL, CELL);
      const kind = i % 4;
      squiggle(14, 18, CELL - 28, 1.5, ink, 5);
      if (kind === 1) {
        g.fillStyle = ['#386b6f', '#5f9790', '#27535c'][i % 3];
        g.fillRect(16, 30, CELL - 32, 40);
      }
      if (kind === 2) {
        // 表（時間割・当番表）
        g.strokeStyle = ink;
        g.lineWidth = 1.5;
        for (let y = 32; y < CELL - 10; y += 14) g.strokeRect(12, y, CELL - 24, 14);
        for (let x = 12; x < CELL - 12; x += 20) g.strokeRect(x, 32, 20, CELL - 44);
      }
      const y0 = kind === 1 ? 82 : kind === 2 ? CELL : 34;
      for (let y = y0; y < CELL - 10; y += 9) squiggle(14, y, (CELL - 28) * (0.55 + r() * 0.45), 1.2, ink, 2);
      if (kind === 3 || r() < 0.25) {
        g.fillStyle = '#9a5a54';
        g.beginPath();
        g.arc(CELL - 24, CELL - 22, 8, 0, Math.PI * 2);
        g.fill();
      }
    } else if (i < 28) {
      // 室名札（白い板に黒い字のくねり）
      g.fillStyle = '#a9d6c3';
      g.fillRect(0, 0, CELL, CELL);
      g.strokeStyle = '#386b6f';
      g.lineWidth = 6;
      g.strokeRect(3, 3, CELL - 6, CELL - 6);
      squiggle(22, CELL * 0.5, CELL - 44, 4, '#2a3c3c', 10);
    } else {
      // 標識: 28 = 消火器（赤）、29 = 禁煙（白に赤い丸）、30 = 非常口（緑）、31 = 注意（黄）
      const bg = ['#b8504a', '#e8eee8', '#4fb88f', '#d8c25a'][i - 28];
      g.fillStyle = bg;
      g.fillRect(0, 0, CELL, CELL);
      g.fillStyle = i === 29 ? '#b8504a' : '#f2f5ee';
      if (i === 29) {
        g.lineWidth = 10;
        g.strokeStyle = '#b8504a';
        g.beginPath();
        g.arc(CELL / 2, CELL / 2, 40, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(CELL / 2 - 28, CELL / 2 + 28);
        g.lineTo(CELL / 2 + 28, CELL / 2 - 28);
        g.stroke();
      } else {
        squiggle(18, CELL * 0.5, CELL - 36, 4, i === 31 ? '#2a3c3c' : '#f2f5ee', 12);
      }
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  noticeTexCache = t;
  return t;
}

/** 掲示物の材質（face = 紙の面の向き） */
export function noticeMat(face: FaceKey, fog = 0.4): THREE.ShaderMaterial {
  const key = `${face}|${fog}`;
  let m = noticeMats.get(key);
  if (!m) {
    m = createPaint({ color: '#cfdcd4', map: noticeTexture(), mapFace: face, fog });
    noticeMats.set(key, m);
  }
  return m;
}

/** 世界の法線から PaintMaterial の面の名前 */
export function faceOf(n: THREE.Vector3): FaceKey {
  const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
  if (a[0] >= a[1] && a[0] >= a[2]) return n.x > 0 ? 'px' : 'nx';
  if (a[1] >= a[2]) return n.y > 0 ? 'py' : 'ny';
  return n.z > 0 ? 'pz' : 'nz';
}

/**
 * 壁の座標の板。plane 'w' は w = at の面（u が a0〜a1）で法線 ±N、plane 'u' は u = at の面（w が a0〜a1）で法線 ±T。
 * uv は 0〜1（cell を渡すと掲示物の升目へ）
 */
export function frameQuad(fr: LocalFrame, plane: 'w' | 'u', at: number, a0: number, a1: number, y0: number, y1: number, sign: 1 | -1, cell = -1): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(Math.abs(a1 - a0), y1 - y0);
  // 局所の座標: X = u, Y = y, Z = w。PlaneGeometry は +Z 向き
  if (plane === 'w') {
    if (sign < 0) g.rotateY(Math.PI);
    g.translate((a0 + a1) / 2, (y0 + y1) / 2, at);
  } else {
    g.rotateY(sign > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(at, (y0 + y1) / 2, (a0 + a1) / 2);
  }
  if (cell >= 0) {
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const cu = (cell % COLS) / COLS;
    const cv = 1 - (Math.floor(cell / COLS) + 1) / ROWS;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, cu + (uv.getX(k) * 0.96 + 0.02) / COLS, cv + (uv.getY(k) * 0.96 + 0.02) / ROWS);
  }
  return fr.place(g);
}

/** 掲示物を貼る（plane・at・sign は frameQuad と同じ。face は法線の世界の向きから自動） */
export function notice(b: Builder, fr: LocalFrame, plane: 'w' | 'u', at: number, a0: number, a1: number, y0: number, y1: number, sign: 1 | -1, cell: number, fog = 0.4): void {
  const n = (plane === 'w' ? fr.N : fr.T).clone().multiplyScalar(sign);
  b.mesh(frameQuad(fr, plane, at, a0, a1, y0, y1, sign, cell), noticeMat(faceOf(n), fog), [0, 0, 0], { shadow: false });
}

// ---------------------------------------------------------------- 光だまり・しみの貼り絵
const decals = new Map<string, THREE.ShaderMaterial>();
export function resetDecalCache(): void {
  decals.clear();
}

/** 縁をちぎった貼り絵の材質（同じ指定は使い回す） */
export function patchMat(color: THREE.ColorRepresentation, o: { rag?: number; scale?: number; opacity?: number; step?: number } = {}): THREE.ShaderMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${o.rag ?? 0.12}|${o.scale ?? 3}|${o.opacity ?? 1}|${o.step ?? 0}`;
  let m = decals.get(key);
  if (!m) {
    m = decalMaterial({ color, rag: o.rag ?? 0.12, scale: o.scale ?? 3, opacity: o.opacity ?? 1, step: o.step ?? 0 });
    decals.set(key, m);
  }
  return m;
}

/** 床の上の貼り絵（壁の座標の長方形 u0〜u1 × w0〜w1、高さ y） */
export function floorPatch(b: Builder, fr: LocalFrame, mat: THREE.Material, u0: number, u1: number, w0: number, w1: number, y: number): void {
  const g = new THREE.PlaneGeometry(Math.abs(u1 - u0), Math.abs(w1 - w0));
  g.rotateX(-Math.PI / 2);
  g.translate((u0 + u1) / 2, y, (w0 + w1) / 2);
  b.mesh(fr.place(g), mat, [0, 0, 0], { shadow: false });
}

/** 床の上の貼り絵（世界の座標の軸に沿った長方形） */
export function floorPatchXZ(b: Builder, mat: THREE.Material, x0: number, z0: number, x1: number, z1: number, y: number, rot = 0): void {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  g.rotateX(-Math.PI / 2);
  if (rot) g.rotateY(rot);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  b.mesh(g, mat, [0, 0, 0], { shadow: false });
}

// ---------------------------------------------------------------- 灯り
/**
 * 壁の座標の部屋の中の灯り。照らす箱は部屋の内側（u・w の範囲）を壁の向きに回した箱（Lamp.yaw）。
 * 斜めの西棟でも箱が壁の向こうへ出ない
 */
export function frameLamp(add: (l: Lamp) => Lamp, fr: LocalFrame, u: number, y: number, w: number, room: { u: [number, number]; w: [number, number]; y: [number, number] }, l: Omit<Lamp, 'pos' | 'box' | 'yaw'>): Lamp {
  const c = fr.w((room.u[0] + room.u[1]) / 2, 0, (room.w[0] + room.w[1]) / 2);
  const hu = Math.abs(room.u[1] - room.u[0]) / 2;
  const hw = Math.abs(room.w[1] - room.w[0]) / 2;
  // 局所の x = 壁に沿う向き（T）、局所の z = 外向き（N）になる回し方（Object3D.rotation.y と同じ向き）
  const yaw = Math.atan2(-fr.T.z, fr.T.x);
  const box: [number, number, number, number, number, number] = [c[0] - hu, room.y[0], c[2] - hw, c[0] + hu, room.y[1], c[2] + hw];
  return add({ ...l, pos: fr.w(u, y, w), box, yaw });
}

/** 雨だれの筋（下の縁だけを深くちぎった半透明の暗い貼り絵。縁のノイズが細かいので、垂れた筋の形になる） */
export function streakMat(): THREE.ShaderMaterial {
  const key = 'streak';
  let m = decals.get(key);
  if (!m) {
    m = decalMaterial({ color: '#06121a', rag: 0.55, scale: 7, edges: [0.15, 0.15, 1, 0], opacity: 0.32 });
    decals.set(key, m);
  }
  return m;
}

/** 接地の影（物の下の 1 段暗い、縁をちぎった平らな影。参考画像の分電盤の足元・廊下の床の接地影と同じ描き方） */
export function contactMat(): THREE.ShaderMaterial {
  return patchMat('#050f14', { rag: 0.07, scale: 5, opacity: 0.55 });
}

/** 世界の軸に沿った接地の影（物の足元の長方形を少し広げた形） */
export function contact(b: Builder, x0: number, z0: number, x1: number, z1: number, pad = 0.12, y = 0.003): void {
  floorPatchXZ(b, contactMat(), Math.min(x0, x1) - pad, Math.min(z0, z1) - pad, Math.max(x0, x1) + pad, Math.max(z0, z1) + pad, y);
}

/** 壁の座標の接地の影 */
export function contactF(b: Builder, fr: LocalFrame, u0: number, w0: number, u1: number, w1: number, pad = 0.1, y = 0.003): void {
  floorPatch(b, fr, contactMat(), Math.min(u0, u1) - pad, Math.max(u0, u1) + pad, Math.min(w0, w1) - pad, Math.max(w0, w1) + pad, y);
}
