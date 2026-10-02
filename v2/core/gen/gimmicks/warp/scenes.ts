/**
 * 見ていない間に差し替える物（swapSet の組）の小さな場面。局所の座標（makeFrame: u = 奥の壁から手前へ、v = 左）で書き、
 * フロアの座標の箱（SwapBox）の列を返す。高さは frame の原点の y（床）から。
 */
import type { MatId } from '../../../world/layout.ts';
import type { SwapBox } from '../../../sim/parts/warp/swap.ts';
import type { Frame } from './pocket.ts';

export type SceneId = 'lounge' | 'desk' | 'figure' | 'boxes' | 'plant' | 'chairWall' | 'tv' | 'bed' | 'empty';
export const SCENES: readonly SceneId[] = ['lounge', 'desk', 'figure', 'boxes', 'plant', 'chairWall', 'tv', 'bed', 'empty'];

/** 場面の箱。d: 奥行き（奥の壁から）・w: 幅（v は ±w/2） */
export function scene(f: Frame, id: SceneId, d: number, w: number): SwapBox[] {
  const out: SwapBox[] = [];
  const B = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, mat: MatId, solid = false): void => {
    const b = f.box(u0, y0, v0, u1, y1, v1, mat, solid);
    out.push({ min: [...b.min], max: [...b.max], mat: b.mat, solid: b.solid });
  };
  const hw = w / 2;
  switch (id) {
    case 'lounge': {
      // 肘掛け椅子（手前を向く）と床置きの灯り
      B(0.1, 0.1, -0.42, 0.85, 0.45, 0.42, 'upholstery', true);
      B(0.1, 0.45, -0.42, 0.28, 0.95, 0.42, 'upholstery', true);
      B(0.28, 0.45, -0.42, 0.85, 0.65, -0.3, 'upholstery', true);
      B(0.28, 0.45, 0.3, 0.85, 0.65, 0.42, 'upholstery', true);
      B(0.25, 0, Math.min(hw - 0.25, 0.75) - 0.04, 0.33, 1.45, Math.min(hw - 0.25, 0.75) + 0.04, 'metalDark');
      B(0.12, 1.45, Math.min(hw - 0.25, 0.75) - 0.2, 0.46, 1.7, Math.min(hw - 0.25, 0.75) + 0.2, 'lightWarm');
      break;
    }
    case 'desk': {
      // 机（壁際）・画面・壁を向いた椅子
      B(0.05, 0.7, -0.7, 0.75, 0.75, 0.7, 'furnitureLight', true);
      B(0.08, 0, -0.66, 0.14, 0.7, -0.6, 'metal');
      B(0.08, 0, 0.6, 0.14, 0.7, 0.66, 'metal');
      B(0.12, 0.75, -0.3, 0.17, 1.15, 0.3, 'screenDark');
      B(0.95, 0, -0.22, 1.35, 0.45, 0.22, 'metalDark', true);
      B(1.3, 0.45, -0.22, 1.36, 0.95, 0.22, 'metalDark', true);
      break;
    }
    case 'figure': {
      // 白い人の形（手前を向いて立つ）
      const c = Math.min(d - 0.3, 0.6);
      B(c - 0.06, 0, -0.12, c + 0.06, 0.85, -0.02, 'whiteFabric');
      B(c - 0.06, 0, 0.02, c + 0.06, 0.85, 0.12, 'whiteFabric');
      B(c - 0.11, 0.85, -0.2, c + 0.11, 1.45, 0.2, 'whiteFabric');
      B(c - 0.08, 1.45, -0.1, c + 0.08, 1.68, 0.1, 'marbleWhite');
      B(c - 0.05, 0.8, -0.28, c + 0.05, 1.42, -0.2, 'whiteFabric');
      B(c - 0.05, 0.8, 0.2, c + 0.05, 1.42, 0.28, 'whiteFabric');
      // 当たり判定だけの箱（描かない: mat 'colliderOnly'）
      { const b = f.box(c - 0.2, 0, -0.3, c + 0.2, 1.7, 0.3, 'whiteFabric', true); out.push({ min: [...b.min], max: [...b.max], mat: 'colliderOnly', solid: true }); }
      break;
    }
    case 'boxes': {
      // 段ボールの山
      B(0.05, 0, -0.6, 0.65, 0.55, -0.05, 'boxCardboard', true);
      B(0.05, 0, 0.05, 0.6, 0.5, 0.6, 'boxCardboard', true);
      B(0.1, 0.55, -0.45, 0.6, 1.0, 0.05, 'boxCardboard', true);
      B(0.7, 0, -0.2, 1.1, 0.4, 0.25, 'boxCardboard', true);
      break;
    }
    case 'plant': {
      // 長椅子と鉢植え
      B(0.1, 0, -0.75, 0.5, 0.42, 0.45, 'furnitureDark', true);
      B(0.1, 0.42, -0.75, 0.5, 0.46, 0.45, 'woodPanel', true);
      B(0.1, 0, 0.55, 0.5, 0.42, 0.95 > hw - 0.05 ? hw - 0.05 : 0.95, 'furnitureDark', true);
      B(0.0, 0.5, 0.45, 0.6, 1.3, Math.min(hw - 0.02, 1.05), 'plantLeaf');
      break;
    }
    case 'chairWall': {
      // 壁を向いた椅子が 1 脚
      B(0.45, 0, -0.22, 0.85, 0.45, 0.22, 'furnitureDark', true);
      B(0.39, 0.45, -0.22, 0.45, 0.95, 0.22, 'furnitureDark', true);
      break;
    }
    case 'tv': {
      // 台と、光る画面（砂嵐の色）
      B(0.05, 0, -0.6, 0.5, 0.5, 0.6, 'furnitureDark', true);
      B(0.15, 0.5, -0.45, 0.25, 1.15, 0.45, 'metalDark', true);
      B(0.25, 0.56, -0.4, 0.26, 1.09, 0.4, 'screenGlow');
      break;
    }
    case 'bed': {
      // 寝台（壁に頭を付けて手前へ）
      B(0.05, 0, -0.5, Math.min(d - 0.1, 1.9), 0.45, 0.5, 'whiteFabric', true);
      B(0.05, 0.45, -0.45, 0.45, 0.55, 0.45, 'whiteFabric');
      B(0.0, 0, -0.55, 0.06, 0.9, 0.55, 'furnitureDark', true);
      break;
    }
    case 'empty':
    default:
      break;
  }
  return out;
}
