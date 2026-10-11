import * as THREE from 'three';
import { rng } from '../../scenes/Builder.ts';

/**
 * サーバールームの図柄（キャンバスに手続きで描く。参考画像は読まない）。
 * - 機器の前面（ラックの 19 インチの面 0.48 × 1.87 m = 42U）: 1U・2U のサーバー・スイッチ・ストレージ・パッチパネル・目隠し板・空き。
 *   色の図柄（暗い紺の箱・縁・ドライブの枠・ポート）と、光の図柄（LED の点・短い線。シアンが主で、白・緑・まれに橙と赤）を同じ割り付けで描く
 * - 機器の背面（ホットアイル）: 電源・ファン・ケーブルの束・縦の PDU（コンセントと表示の LED）
 * 1 枚の図柄は 128 × 512 画素（1 画素 = 約 3.7 mm）。前面 16 種・背面 16 種を 2048 × 1024 に並べる
 */

export const CELL_W = 128;
export const CELL_H = 512;
export const COLS = 16;
const U = CELL_H / 42;

export interface Atlas {
  map: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
  /** 図柄 i（0..15 前面・16..31 背面）の uv の範囲 [u0, v0, u1, v1] */
  uv(i: number): [number, number, number, number];
}

type Ctx = CanvasRenderingContext2D;

function tex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/** 機器の色（暗い紺〜青緑。参考画像のラックの中） */
const BODY = ['#0a2230', '#0c2735', '#081c28', '#0f2e3d', '#0b2431'];

const DEEP = '#030d14';

export function makeServerAtlas(seed = 7): Atlas {
  const W = CELL_W * COLS;
  const H = CELL_H * 2;
  const cd = document.createElement('canvas');
  cd.width = W;
  cd.height = H;
  const ce = document.createElement('canvas');
  ce.width = W;
  ce.height = H;
  const d = cd.getContext('2d')!;
  const e = ce.getContext('2d')!;
  e.fillStyle = '#000000';
  e.fillRect(0, 0, W, H);
  const r = rng(seed);
  for (let i = 0; i < COLS; i++) front(d, e, i * CELL_W, 0, r, i);
  for (let i = 0; i < COLS; i++) rear(d, e, i * CELL_W, CELL_H, r, i);
  return {
    map: tex(cd),
    emissive: tex(ce),
    uv: (i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      // 縁を半画素ずつ内へ（隣の図柄がにじまない）
      const u0 = (col * CELL_W + 0.5) / W;
      const u1 = ((col + 1) * CELL_W - 0.5) / W;
      const v1 = 1 - (row * CELL_H + 0.5) / H;
      const v0 = 1 - ((row + 1) * CELL_H - 0.5) / H;
      return [u0, v0, u1, v1];
    },
  };
}

/** LED の色（シアンが主） */
function ledColor(r: () => number, kind: number): string {
  const x = r();
  if (kind === 1) return x < 0.3 ? '#e6ffff' : x < 0.9 ? '#7ff4ff' : '#7dffc8';
  if (x < 0.8) return '#5feeff';
  if (x < 0.88) return '#b8fbff';
  if (x < 0.95) return '#7dffc8';
  if (x < 0.985) return '#ffc46a';
  return '#ff6a5a';
}

function led(e: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  e.fillStyle = col;
  e.fillRect(x, y, w, h);
}

/** 前面の図柄 1 枚（42U） */
function front(d: Ctx, e: Ctx, x0: number, y0: number, r: () => number, idx: number): void {
  d.fillStyle = DEEP;
  d.fillRect(x0, y0, CELL_W, CELL_H);
  // 図柄ごとの性格: 0..3 密なサーバー、4..7 スイッチの多い、8..11 ストレージ、12..15 すかすか（空き・目隠し板が多い）
  const kind = Math.floor(idx / 4);
  // LED の縦の列（同じ型のサーバーを積むと、状態の LED が縦に点線のように並ぶ。参考画像のラックの点の列）
  ledCols = [];
  const nc = 2 + Math.floor(r() * 4);
  for (let k = 0; k < nc; k++) ledCols.push(8 + Math.floor(r() * (CELL_W - 22)));
  const ledKind = idx % 3 === 2 ? 1 : 0;
  let u = 0;
  const empty = kind === 3 ? 0.35 : 0.08;
  while (u < 42) {
    const p = r();
    let n = 1;
    let t: 'srv1' | 'srv2' | 'sw' | 'sto' | 'patch' | 'blank' | 'empty';
    if (r() < empty) {
      t = r() < 0.5 ? 'empty' : 'blank';
      n = 1 + Math.floor(r() * 3);
    } else if (kind === 0) {
      t = p < 0.55 ? 'srv1' : 'srv2';
      n = t === 'srv1' ? 1 : 2;
    } else if (kind === 1) {
      t = p < 0.5 ? 'sw' : p < 0.7 ? 'patch' : 'srv1';
      n = 1;
    } else if (kind === 2) {
      t = p < 0.6 ? 'sto' : 'srv2';
      n = t === 'sto' ? 2 + Math.floor(r() * 3) : 2;
    } else {
      t = p < 0.4 ? 'srv2' : p < 0.7 ? 'srv1' : 'sw';
      n = t === 'srv2' ? 2 : 1;
    }
    n = Math.min(n, 42 - u);
    const y = y0 + u * U;
    const h = n * U;
    unit(d, e, x0, y, CELL_W, h, t, r, ledKind);
    u += n;
  }
  // 縦のレール（左右の取り付けの柱）
  d.fillStyle = '#163c4d';
  d.fillRect(x0, y0, 5, CELL_H);
  d.fillRect(x0 + CELL_W - 5, y0, 5, CELL_H);
  d.fillStyle = '#0a1f2a';
  for (let k = 0; k < 42; k++) {
    d.fillRect(x0 + 1, y0 + k * U + U * 0.45, 3, 1);
    d.fillRect(x0 + CELL_W - 4, y0 + k * U + U * 0.45, 3, 1);
  }
}

/** 今の図柄の LED の縦の列（x の画素。図柄の左端から） */
let ledCols: number[] = [];

function unit(d: Ctx, e: Ctx, x: number, y: number, w: number, h: number, t: string, r: () => number, ledKind: number): void {
  const ix = x + 6;
  const iw = w - 12;
  if (t === 'empty') {
    d.fillStyle = DEEP;
    d.fillRect(ix, y, iw, h);
    // 奥のケーブルが少し見える
    d.fillStyle = '#081a24';
    for (let k = 0; k < 3; k++) d.fillRect(ix + r() * iw, y, 1.5, h);
    return;
  }
  const body = BODY[Math.floor(r() * BODY.length)];
  d.fillStyle = body;
  d.fillRect(ix, y + 0.5, iw, h - 1);
  // 上下の縁（明るい線）と境目（暗い線）。細かい縞にならないように、色は下地に近く
  d.fillStyle = '#163c4e';
  d.fillRect(ix, y + 0.5, iw, 1);
  d.fillStyle = '#081a24';
  d.fillRect(ix, y + h - 1, iw, 1);
  if (t === 'blank') {
    // 目隠し板: 横の通気の切れ込み
    d.fillStyle = '#0a2230';
    for (let k = 2; k < h - 2; k += 3) d.fillRect(ix + 10, y + k, iw - 20, 1);
    return;
  }
  if (t === 'srv1' || t === 'srv2') {
    // 取っ手（左右の耳）
    d.fillStyle = '#1e4a5d';
    d.fillRect(ix + 1, y + 2, 4, h - 4);
    d.fillRect(ix + iw - 5, y + 2, 4, h - 4);
    // ドライブの枠（2.5 インチを縦に並べる）
    const bays = t === 'srv1' ? 8 : 12;
    const bw = (iw - 30) / bays;
    for (let k = 0; k < bays; k++) {
      const bx = ix + 18 + k * bw;
      d.fillStyle = '#081c27';
      d.fillRect(bx, y + 2, bw - 1, h - 4);
      d.fillStyle = '#1a4255';
      d.fillRect(bx + 0.5, y + 2.5, bw - 2, 1);
      if (r() < 0.12) led(e, bx + 1, y + h - 4, 1.5, 1.5, ledColor(r, ledKind));
    }
    // 状態の LED（図柄の縦の列に合わせる）
    for (const cx of ledCols) {
      if (r() < 0.72) led(e, x + cx, y + h / 2 - 1, 2.2, 2.2, ledColor(r, ledKind));
      if (t === 'srv2' && r() < 0.5) led(e, x + cx, y + h / 2 + 4, 2.2, 2.2, ledColor(r, ledKind));
    }
    return;
  }
  if (t === 'sw') {
    // スイッチ: ポート 24 × 2 段と、ポートごとの LED（横に並ぶ短い線）
    const ports = 24;
    const pw = (iw - 26) / ports;
    for (let k = 0; k < ports; k++) {
      const px = ix + 20 + k * pw;
      d.fillStyle = '#040e14';
      d.fillRect(px, y + 3, pw - 1, 3);
      d.fillRect(px, y + 7, pw - 1, 3);
      if (r() < 0.45) led(e, px, y + 1.5, pw - 1.5, 1.2, ledColor(r, ledKind));
    }
    d.fillStyle = '#2a6276';
    d.fillRect(ix + 4, y + 3, 10, 6);
    led(e, ix + 5, y + 4, 3, 2, ledColor(r, ledKind));
    return;
  }
  if (t === 'patch') {
    d.fillStyle = '#2f6478';
    d.fillRect(ix + 8, y + 1.5, iw - 16, 2);
    for (let k = 0; k < 24; k++) {
      d.fillStyle = '#05121a';
      d.fillRect(ix + 8 + k * ((iw - 16) / 24), y + 5, (iw - 16) / 24 - 1.2, 4);
    }
    return;
  }
  if (t === 'sto') {
    // ストレージ: 縦長のドライブの升目と LED の縦の列
    const cols = 12;
    const rows = Math.max(1, Math.round(h / (U * 1.4)));
    const cw = (iw - 8) / cols;
    const rh = (h - 4) / rows;
    for (let j = 0; j < rows; j++) {
      for (let k = 0; k < cols; k++) {
        const bx = ix + 4 + k * cw;
        const by = y + 2 + j * rh;
        d.fillStyle = '#0a2230';
        d.fillRect(bx, by, cw - 1, rh - 1);
        d.fillStyle = '#1b4659';
        d.fillRect(bx, by, cw - 1, 1);
        if (r() < 0.3) led(e, bx + cw / 2 - 1, by + rh - 4, 2, 2, ledColor(r, ledKind));
      }
    }
  }
}

/** 背面の図柄 1 枚（ホットアイル）: 電源・ファン・ケーブルの束・縦の PDU */
function rear(d: Ctx, e: Ctx, x0: number, y0: number, r: () => number, idx: number): void {
  d.fillStyle = '#06141c';
  d.fillRect(x0, y0, CELL_W, CELL_H);
  let u = 0;
  while (u < 42) {
    const n = Math.min(42 - u, r() < 0.5 ? 1 : 2);
    const y = y0 + u * U;
    const h = n * U;
    if (r() < 0.12 + (idx % 4) * 0.05) {
      u += n;
      continue;
    }
    d.fillStyle = BODY[Math.floor(r() * BODY.length)];
    d.fillRect(x0 + 6, y + 0.5, CELL_W - 12, h - 1);
    // ファン（丸）と電源（右）
    const fans = n === 2 ? 4 : 3;
    for (let k = 0; k < fans; k++) {
      const cx = x0 + 16 + k * 18;
      d.strokeStyle = '#1d4b5e';
      d.lineWidth = 1;
      d.beginPath();
      d.arc(cx, y + h / 2, Math.min(h / 2 - 1.5, 7), 0, Math.PI * 2);
      d.stroke();
    }
    d.fillStyle = '#183f50';
    d.fillRect(x0 + CELL_W - 36, y + 1.5, 26, h - 3);
    led(e, x0 + CELL_W - 14, y + 2.5, 2, 2, r() < 0.8 ? '#7dffc8' : '#ffc46a');
    if (r() < 0.6) led(e, x0 + 20 + r() * 50, y + 2, 2, 1.5, '#6ff0ff');
    u += n;
  }
  // 機器の背から出る色つきのパッチケーブル（青・黄・灰・赤。ホットアイルの賑やかさ）と、横へ流れる束
  const PATCH = ['#2f8ad0', '#3aa0e0', '#d8c25a', '#7f9aa4', '#c8575c', '#4fb08a', '#0a1a22'];
  for (let k = 0; k < 34; k++) {
    d.strokeStyle = PATCH[Math.floor(r() * PATCH.length)];
    d.lineWidth = 0.8 + r() * 1.4;
    const yy = y0 + 10 + r() * (CELL_H - 20);
    const xa = x0 + 14 + r() * (CELL_W - 40);
    d.beginPath();
    d.moveTo(xa, yy);
    // 横へ出て、横の束（左右の縦の管理の溝）へ垂れる
    const side = r() < 0.5 ? x0 + 10 : x0 + CELL_W - 12;
    d.bezierCurveTo(xa + (side - xa) * 0.5, yy + 4 + r() * 10, side, yy + 6, side + (r() - 0.5) * 3, yy + 20 + r() * 40);
    d.stroke();
  }
  // 太い黒い電源のケーブルの束（縦）
  d.strokeStyle = '#030b10';
  for (let k = 0; k < 8; k++) {
    d.lineWidth = 1.5 + r() * 2;
    const x = x0 + 20 + r() * (CELL_W - 40);
    d.beginPath();
    d.moveTo(x, y0);
    d.bezierCurveTo(x + (r() - 0.5) * 30, y0 + CELL_H * 0.3, x + (r() - 0.5) * 30, y0 + CELL_H * 0.6, x + (r() - 0.5) * 20, y0 + CELL_H);
    d.stroke();
  }
  // 縦の PDU（左右）: コンセントの並び・差し込んだ電源の線・表示（数字の赤い LED）
  for (const px of [x0 + 1, x0 + CELL_W - 9]) {
    d.fillStyle = '#16384a';
    d.fillRect(px, y0, 8, CELL_H);
    for (let k = 0; k < 24; k++) {
      d.fillStyle = '#05121a';
      d.fillRect(px + 1.5, y0 + 30 + k * 18, 5, 6);
      if (r() < 0.75) {
        d.fillStyle = '#0a1a22';
        d.fillRect(px + 2.5, y0 + 31 + k * 18, 3, 4);
        led(e, px + 6.5, y0 + 31 + k * 18, 1, 1, '#7dffc8');
      }
    }
    d.fillStyle = '#081820';
    d.fillRect(px + 0.5, y0 + 8, 7, 14);
    led(e, px + 1.5, y0 + 10, 5, 3, idx % 2 ? '#ff6a5a' : '#6ff0ff');
    led(e, px + 1.5, y0 + 15, 5, 3, idx % 2 ? '#ff6a5a' : '#6ff0ff');
  }
  // 穴あきの扉の穴（細かい点の格子。背の扉越しに見える）
  d.fillStyle = 'rgba(3, 12, 18, 0.55)';
  for (let yy = y0 + 2; yy < y0 + CELL_H; yy += 4) for (let xx = x0 + ((yy / 4) % 2 ? 2 : 4); xx < x0 + CELL_W; xx += 4) d.fillRect(xx, yy, 1.4, 1.4);
}

/** 吹き出しの床（穴あきの床板）: 透明の地に暗い切れ込み（長い穴の並び）。256 × 256 = 0.6 m 角 */
export function makeGrille(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);
  // 2 段の切れ込みの帯（参考画像: 横長の穴が 2 段 × 16 本ほど）
  g.fillStyle = 'rgba(12, 40, 56, 0.95)';
  for (const [y0, y1] of [
    [62, 118],
    [138, 194],
  ]) {
    for (let k = 0; k < 18; k++) {
      const x = 22 + k * 12;
      g.fillRect(x, y0, 6, y1 - y0);
    }
  }
  // 板の縁のねじ
  g.fillStyle = 'rgba(30, 70, 90, 0.8)';
  for (const [x, y] of [
    [14, 14],
    [242, 14],
    [14, 242],
    [242, 242],
  ])
    g.fillRect(x - 2, y - 2, 4, 4);
  const t = tex(c);
  return t;
}

/**
 * ガラス扉の映り込み（縦の明るい筋）。128 × 256 に 4 枚分（扉ごとに 1 列ずつ使う）。
 * 地は灰色・半透明（材質の色と不透明度に掛かる）、筋は白・不透明に近い
 */
export function makeGlassStreaks(seed = 3): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  g.fillStyle = 'rgba(205,215,220,0.72)';
  g.fillRect(0, 0, 128, 256);
  for (let col = 0; col < 4; col++) {
    const x0 = col * 32;
    // 広い淡い映り込み（通路の明るさがガラスに映る面）
    const bx = x0 + r() * 16;
    const bw = 8 + r() * 14;
    const gb = g.createLinearGradient(0, 0, 0, 256);
    gb.addColorStop(0, 'rgba(240,252,255,0.95)');
    gb.addColorStop(0.6, 'rgba(225,245,255,0.8)');
    gb.addColorStop(1, 'rgba(240,252,255,0.95)');
    g.fillStyle = gb;
    g.fillRect(bx, 0, bw, 256);
    for (let k = 0; k < 3; k++) {
      const x = x0 + 3 + r() * 24;
      const w = 0.8 + r() * 3.5;
      const grd = g.createLinearGradient(0, 0, 0, 256);
      const a = 0.45 + r() * 0.5;
      grd.addColorStop(0, `rgba(235,250,255,${a})`);
      grd.addColorStop(0.45 + r() * 0.2, `rgba(220,245,255,${a * 0.35})`);
      grd.addColorStop(1, `rgba(235,250,255,${a * 0.75})`);
      g.fillStyle = grd;
      g.fillRect(x, 0, w, 256);
    }
  }
  return tex(c);
}
