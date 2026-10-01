/**
 * ColorMissing — 色欠損フロア（E20）。
 * params: channel('red' | 'green' | 'blue')、または mask([r, g, b] の乗算マスク。channel より優先)。
 *
 * layout フックで RoomLayout.render.colorMask を設定するだけ。
 *   - RoomBuilder が render.colorMask を MaterialLibrary.variant の colorMask（uniform のみ。新規シェーダプログラム無し）に渡し、
 *     部屋の全材質（床・壁・天井・家具・扉パネル・枠）の diffuse に乗算する。
 *   - 欠損は「部屋の材質の性質」なので HUD / ミニマップ / 隣室には影響しない（隣室は通常色のままで、扉口で色が戻る境界が見える）。
 *   - 隣室へ漏れる PointLight の色も整合させるため、L.lights[].color と palette.lightColor の欠損チャンネルを 0 にする
 *     （palette.ambient / fog は触らない: hemi・scene.fog は全体に効くので隣室を汚さない）。
 *   - 発光箔（lightPanel 等）の emissive は MaterialLibrary 側でマスクされない（phase2-requests.md に依頼済み）。
 */
import type { ModifierImpl } from '../types';
import { str } from '../util';

type Mask = [number, number, number];

const CHANNEL_MASK: Record<string, Mask> = {
  red: [0, 1, 1],
  green: [1, 0, 1],
  blue: [1, 1, 0],
};

/** params → 乗算マスク。mask 配列があればそれを 0..1 にクランプして使う。無効なら赤欠損 */
export function colorMaskOf(params: Record<string, unknown>): Mask {
  const m = params.mask;
  if (Array.isArray(m) && m.length === 3 && m.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    return [clamp01(m[0]), clamp01(m[1]), clamp01(m[2])];
  }
  const ch = str(params.channel, 'red').toLowerCase();
  return CHANNEL_MASK[ch] ?? CHANNEL_MASK.red;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 0xRRGGBB にマスクを掛ける */
export function applyColorMask(color: number, mask: Mask): number {
  const r = Math.round(((color >> 16) & 255) * mask[0]);
  const g = Math.round(((color >> 8) & 255) * mask[1]);
  const b = Math.round((color & 255) * mask[2]);
  return (r << 16) | (g << 8) | b;
}

const ColorMissing: ModifierImpl = {
  id: 'ColorMissing',
  defaults: { channel: 'red' },
  layout(L, _p, params) {
    const mask = colorMaskOf(params);
    L.render = { ...(L.render ?? {}), colorMask: mask };
    // 動的光の色も欠損させる（隣室へ漏れる光が部屋の性質と矛盾しないように）
    for (const l of L.lights) l.color = applyColorMask(l.color, mask);
    L.palette = { ...L.palette, lightColor: applyColorMask(L.palette.lightColor, mask) };
    // サインの文字色・地色（あれば）
    if (L.signs) {
      for (const s of L.signs) {
        if (s.color !== undefined) s.color = applyColorMask(s.color, mask);
        if (s.background !== undefined) s.background = applyColorMask(s.background, mask);
      }
    }
  },
};

export default ColorMissing;
