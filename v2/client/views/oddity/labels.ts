/**
 * 文字の札（oddRoom の fx 'labels'）: 番号の札（X03）・嘘の案内（X04）・名前の掲示（X05）・非常口の印（X13）。
 * 文字は描画の時に Canvas で書く（core の箱には文字が無い）。document の無い所（Node の試験）では作らない。
 *
 * items: { text, pos: [x, y, z]（板の中心）, dir: 0..3（貼る壁の外向き。板は室内を向く）か 'up'（床に貼る）/ 'down'（天井）,
 *          w, h（m）, fg, bg（色）, glow（光る札）, size（文字の大きさの倍率）}
 * 特別な文字: '{name}' は遊ぶ人の名前（名前の入力が無ければ「あなた」）、'#exit:L' / '#exit:R' は非常口の印（走る人の向き）、
 * '#arrow:L' / '#arrow:R' / '#arrow:U' は矢印だけの札
 */
import * as THREE from 'three';
import type { Json } from '../../../core/world/layout.ts';
import { defineFx } from './fx.ts';
import { num, str } from './util.ts';

/** 遊ぶ人の名前（?name= か、保存された名前 liminal2.playerName。無ければ既定の呼び名） */
export function playerName(): string {
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('name') : null;
    if (q && q.trim()) return q.trim().slice(0, 12);
    const s = typeof localStorage !== 'undefined' ? localStorage.getItem('liminal2.playerName') : null;
    if (s && s.trim()) return s.trim().slice(0, 12);
  } catch { /* 保存先が無い */ }
  return 'あなた';
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** 非常口の人（走る人と扉）。facing: 人の向き（-1 左 / 1 右） */
function exitPicto(g: CanvasRenderingContext2D, W: number, H: number, facing: number, fg: string): void {
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(facing, 1);
  g.translate(-W / 2, -H / 2);
  g.fillStyle = fg;
  g.strokeStyle = fg;
  g.lineCap = 'round';
  g.lineWidth = H * 0.12;
  // 扉の枠（右側）
  g.fillRect(W * 0.72, H * 0.12, W * 0.2, H * 0.76);
  g.clearRect(W * 0.76, H * 0.18, W * 0.12, H * 0.64);
  // 走る人（扉の方へ）
  const cx = W * 0.42, cy = H * 0.5;
  g.beginPath(); g.arc(cx + W * 0.06, cy - H * 0.28, H * 0.09, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx + W * 0.04, cy - H * 0.14); g.lineTo(cx - W * 0.03, cy + H * 0.1); g.stroke();
  g.beginPath(); g.moveTo(cx - W * 0.03, cy + H * 0.1); g.lineTo(cx + W * 0.09, cy + H * 0.34); g.stroke();
  g.beginPath(); g.moveTo(cx - W * 0.03, cy + H * 0.1); g.lineTo(cx - W * 0.16, cy + H * 0.3); g.stroke();
  g.beginPath(); g.moveTo(cx + W * 0.02, cy - H * 0.08); g.lineTo(cx + W * 0.15, cy + H * 0.02); g.stroke();
  g.beginPath(); g.moveTo(cx + W * 0.02, cy - H * 0.08); g.lineTo(cx - W * 0.12, cy - H * 0.02); g.stroke();
  g.restore();
}

function arrow(g: CanvasRenderingContext2D, W: number, H: number, d: string, fg: string): void {
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(d === 'L' ? Math.PI : d === 'U' ? -Math.PI / 2 : d === 'D' ? Math.PI / 2 : 0);
  g.fillStyle = fg;
  const s = Math.min(W, H) * 0.42;
  g.beginPath();
  g.moveTo(s, 0); g.lineTo(0, -s * 0.8); g.lineTo(0, -s * 0.32); g.lineTo(-s, -s * 0.32); g.lineTo(-s, s * 0.32); g.lineTo(0, s * 0.32); g.lineTo(0, s * 0.8);
  g.closePath();
  g.fill();
  g.restore();
}

/** 札の絵（Canvas）。document が無ければ null */
function labelTexture(text: string, w: number, h: number, fg: number, bg: number, size: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const ppm = 256;
  const W = Math.max(32, Math.round(w * ppm)), H = Math.max(32, Math.round(h * ppm));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  if (!g) return null;
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, W, H);
  const fgs = hex(fg);
  if (text.startsWith('#exit:')) exitPicto(g, W, H, text.endsWith('L') ? -1 : 1, fgs);
  else if (text.startsWith('#arrow:')) arrow(g, W, H, text.slice(7), fgs);
  else {
    const lines = text.replace(/\{name\}/g, playerName()).split('\n');
    const fs = Math.min(H / (lines.length * 1.25), (W / Math.max(1, Math.max(...lines.map((l) => l.length)))) * 1.1) * size;
    g.fillStyle = fgs;
    g.font = `bold ${Math.round(fs)}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * fs * 1.2));
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

defineFx('labels', ({ p, ctx }) => {
  const items = (p.items as { [k: string]: Json }[] | undefined) ?? [];
  const made: { m: THREE.Mesh; tex: THREE.Texture; mat: THREE.Material; geo: THREE.BufferGeometry }[] = [];
  for (const it of items) {
    const w = num(it.w, 0.4), h = num(it.h, 0.2);
    const tex = labelTexture(str(it.text, ''), w, h, num(it.fg, 0x202020), num(it.bg, 0xf2f0e8), num(it.size, 1));
    if (!tex) continue;
    const geo = new THREE.PlaneGeometry(w, h);
    const glow = it.glow === true;
    const mat = glow ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: true }) : new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 });
    const m = new THREE.Mesh(geo, mat);
    const pp = (it.pos as number[] | undefined) ?? [0, 0, 0];
    m.position.set(pp[0]!, pp[1]!, pp[2]!);
    const d = it.dir;
    if (d === 'up') m.rotation.x = -Math.PI / 2;
    else if (d === 'down') m.rotation.x = Math.PI / 2;
    else {
      // 壁の外向き dir（0: +z の壁）→ 室内を向く
      const k = typeof d === 'number' ? d : 0;
      m.rotation.y = k === 0 ? Math.PI : k === 1 ? -Math.PI / 2 : k === 2 ? 0 : Math.PI / 2;
    }
    if (typeof it.yaw === 'number') m.rotation.z = it.yaw;
    ctx.root.add(m);
    made.push({ m, tex, mat, geo });
  }
  if (!made.length) return null;
  return {
    update() {},
    dispose() { for (const x of made) { x.m.removeFromParent(); x.tex.dispose(); x.mat.dispose(); x.geo.dispose(); } },
  };
});
