import type { LBox } from './author.ts';

/**
 * 箱の引き算（軸に沿った箱 a から穴 h を抜いた残りを、最大 6 つの箱で返す）。
 * 積み上げた壁・詰め物の塊に、部屋・階段室・テラスの空間を空ける（部屋は rooms.ts が自分の壁で囲む）。
 */
export function subtract(a: LBox, h: { min: number[]; max: number[] }): LBox[] {
  for (let i = 0; i < 3; i++) if (a.max[i] <= h.min[i] + 1e-4 || a.min[i] >= h.max[i] - 1e-4) return [a];
  const out: LBox[] = [];
  const min = [...a.min] as [number, number, number];
  const max = [...a.max] as [number, number, number];
  // x の左右・z の前後・y の上下の順に切り出す
  for (const ax of [0, 2, 1]) {
    if (min[ax] < h.min[ax]) {
      const m2 = [...max] as [number, number, number];
      m2[ax] = h.min[ax];
      out.push({ ...a, min: [...min] as [number, number, number], max: m2 });
      min[ax] = h.min[ax];
    }
    if (max[ax] > h.max[ax]) {
      const n2 = [...min] as [number, number, number];
      n2[ax] = h.max[ax];
      out.push({ ...a, min: n2, max: [...max] as [number, number, number] });
      max[ax] = h.max[ax];
    }
  }
  return out.filter((b) => b.max[0] - b.min[0] > 0.01 && b.max[1] - b.min[1] > 0.01 && b.max[2] - b.min[2] > 0.01);
}

/** 箱の並びから穴を全部抜く */
export function carve(list: LBox[], holes: { min: number[]; max: number[] }[]): LBox[] {
  let cur = list;
  for (const h of holes) cur = cur.flatMap((b) => subtract(b, h));
  return cur;
}
