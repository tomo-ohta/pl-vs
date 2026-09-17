/**
 * 壁面サイン（SignSpec）を 1 枚の CanvasTexture に詰める。部屋あたりのテクスチャ数を抑え（アトラス 1 枚 = 16 セル、部屋あたり最大 4 枚 = 64 サイン）、
 * updateSign(id, text) でセル単位に再描画できる（DuplicateNumber / FakeSignage の時計・番号更新、TemperatureField の表示）。
 *
 * 統合担当向け: RoomBuilder が内部で使う。Game 側は BuiltRoom.updateSign(id, text) を呼ぶだけでよい。
 */
import * as THREE from 'three';
import type { SignSpec } from '../generators/layout';

export const SIGN_CELL_W = 512;
export const SIGN_CELL_H = 128;
const COLS = 2;
const ROWS = 8;
export const SIGNS_PER_ATLAS = COLS * ROWS;
/** 部屋あたりのアトラス上限 */
export const MAX_ATLASES_PER_ROOM = 4; // L04（無限グランドホテル）の客室番号板 110 枚超に備え 3 → 4（64 サイン）

interface Cell { index: number; spec: SignSpec; text: string; sub?: string }

export class SignAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  /** 銘板用（照明を受ける）と発光用（無照明）の 2 材質を共有 */
  readonly plateMaterial: THREE.MeshStandardMaterial;
  readonly emissiveMaterial: THREE.MeshBasicMaterial;
  private readonly cells: Cell[] = [];
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIGN_CELL_W * COLS;
    this.canvas.height = SIGN_CELL_H * ROWS;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    // 板サイン: 暗い部屋（R20 倉庫など）でも読めるよう弱い自己発光を持たせ、天井灯の白い反射点で潰れないよう金属感は無し
    this.plateMaterial = new THREE.MeshStandardMaterial({ map: this.texture, roughness: .7, metalness: 0, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: .28 });
    this.emissiveMaterial = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
  }

  get full(): boolean { return this.cells.length >= SIGNS_PER_ATLAS; }

  /** セルを確保して描き、そのセルの UV 範囲を持つ平面ジオメトリを返す */
  add(spec: SignSpec): { geometry: THREE.PlaneGeometry; material: THREE.Material; cellIndex: number } {
    const index = this.cells.length;
    const cell: Cell = { index, spec, text: spec.text, sub: spec.sub };
    this.cells.push(cell);
    this.draw(cell);
    const geometry = new THREE.PlaneGeometry(spec.width, spec.width * (SIGN_CELL_H / SIGN_CELL_W));
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    const col = index % COLS, row = Math.floor(index / COLS);
    const u0 = col / COLS, u1 = (col + 1) / COLS;
    // canvas の y は下向き、UV の v は上向き
    const v1 = 1 - row / ROWS, v0 = 1 - (row + 1) / ROWS;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    uv.needsUpdate = true;
    // 面取りの隙間対策: 背景色で 1 px のパディングをセル内に持たせる（draw 側）
    return { geometry, material: spec.kind === 'plate' ? this.plateMaterial : this.emissiveMaterial, cellIndex: index };
  }

  /** 文字を差し替えて再描画 */
  update(cellIndex: number, text: string, sub?: string): void {
    const cell = this.cells[cellIndex];
    if (!cell) return;
    cell.text = text;
    if (sub !== undefined) cell.sub = sub;
    this.draw(cell);
    this.texture.needsUpdate = true;
  }

  private draw(cell: Cell): void {
    const ctx = this.ctx;
    const x = (cell.index % COLS) * SIGN_CELL_W;
    const y = Math.floor(cell.index / COLS) * SIGN_CELL_H;
    const s = cell.spec;
    const defaults = s.kind === 'plate'
      ? { bg: '#f0f0e8', fg: '#20232a', sub: '#5a5f6a', font: 'bold 44px sans-serif' }
      : s.kind === 'emissive'
        ? { bg: '#0d2a18', fg: '#7dff9a', sub: '#4bd070', font: 'bold 52px sans-serif' }
        : { bg: '#101010', fg: '#ff4a3a', sub: '#a03028', font: 'bold 64px "Courier New", monospace' };
    const bg = s.background !== undefined ? hex(s.background) : defaults.bg;
    const fg = s.color !== undefined ? hex(s.color) : defaults.fg;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, SIGN_CELL_W, SIGN_CELL_H);
    ctx.clip();
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, SIGN_CELL_W, SIGN_CELL_H);
    if (s.mirror) { ctx.translate(x + SIGN_CELL_W, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.font = defaults.font;
    const hasSub = !!cell.sub;
    fitText(ctx, cell.text, SIGN_CELL_W - 32);
    ctx.fillText(cell.text, x + SIGN_CELL_W / 2, y + (hasSub ? 48 : SIGN_CELL_H / 2), SIGN_CELL_W - 32);
    if (hasSub) {
      ctx.font = '26px sans-serif';
      ctx.fillStyle = defaults.sub;
      ctx.fillText(cell.sub!, x + SIGN_CELL_W / 2, y + 96, SIGN_CELL_W - 32);
    }
    if (s.kind === 'emissive') {
      // 枠線（非常口サイン風）
      ctx.strokeStyle = fg;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 6, y + 6, SIGN_CELL_W - 12, SIGN_CELL_H - 12);
    }
    ctx.restore();
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.plateMaterial.dispose();
    this.emissiveMaterial.dispose();
  }
}

function hex(c: number): string {
  return `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** 幅に収まるようフォントサイズを縮める */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): void {
  for (let i = 0; i < 6; i++) {
    if (ctx.measureText(text).width <= maxW) return;
    const m = /(\d+)px/.exec(ctx.font);
    if (!m) return;
    const size = Math.max(18, Math.floor(+m[1] * .85));
    ctx.font = ctx.font.replace(/\d+px/, `${size}px`);
  }
}
