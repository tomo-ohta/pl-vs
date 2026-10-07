import * as THREE from 'three';
import { rng } from '../Builder.ts';

/**
 * 突き当たりの明るい高い建物の壁面（キャンバスに描く）。
 * 階ごとに横長の窓の帯（明るいガラスと桟）、その間は少し暗い腰壁。下ほど少し暗い。
 * 1 画素 = 1/16 m。w・h は m。
 */
export function makeFarFacade(w: number, h: number, o: { storey: number; glass: [number, number]; mullion: number; top: string; bottom: string; glassTop: string; glassBottom: string; frame: string }): THREE.CanvasTexture {
  const P = 16;
  const c = document.createElement('canvas');
  c.width = Math.round(w * P);
  c.height = Math.round(h * P);
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, o.top);
  grad.addColorStop(1, o.bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const r = rng(7);
  const gg = g.createLinearGradient(0, 0, 0, c.height);
  gg.addColorStop(0, o.glassTop);
  gg.addColorStop(1, o.glassBottom);
  for (let y0 = o.storey; y0 < h; y0 += o.storey) {
    // ガラスの帯（下から glass[0]〜glass[1] m）
    const top = c.height - (y0 + o.glass[1]) * P;
    const bot = c.height - (y0 + o.glass[0]) * P;
    g.fillStyle = gg;
    g.fillRect(0, top, c.width, bot - top);
    // 桟
    g.fillStyle = o.frame;
    for (let x = 0; x < w; x += o.mullion) {
      const wide = r() < 0.25;
      g.fillRect(x * P, top, wide ? 3 : 2, bot - top);
    }
    g.fillRect(0, top + (bot - top) * 0.32, c.width, 2);
    g.fillRect(0, top, c.width, 2);
    g.fillRect(0, bot - 2, c.width, 2);
    // ところどころ暗い窓・明るい窓
    for (let x = 0; x < w; x += o.mullion) {
      const q = r();
      if (q < 0.12) {
        g.fillStyle = 'rgba(70,110,100,0.35)';
        g.fillRect(x * P + 2, top + (bot - top) * 0.32 + 2, o.mullion * P - 4, (bot - top) * 0.68 - 4);
      } else if (q > 0.9) {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x * P + 2, top + 2, o.mullion * P - 4, (bot - top) * 0.32 - 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
