/**
 * 裏のフロア（variant ≥ 1。v2-plan.md 4.6「裏のフロア」）: 表のフロアと同じ配置で、照明・材質・霧が違う。
 * 形（骨組み・区画・扉）は表と同じものを作り（index.ts）、仕掛け・隠し・中身は裏の seed で置き直す。
 * ここでは見た目を変える: 「調子」を 1 つ引き、器具の色・消えている照明・材質・霧を置き換える。
 * 仕掛けの照明（lamp:…）と隠し部屋はそのまま（仕掛けが働き、隠し部屋は表と同じ温かさで目立つ）。
 */
import type { Rng } from '../../math/rng.ts';
import type { CellLayout, FloorLayout, MatId } from '../../world/layout.ts';

export interface BSideTone {
  id: string;
  name: string;
  /** 器具の色温度（palette.lightColor。焼き込みの器具の色に掛かる） */
  lightColor: number;
  /** 消えている照明の割合（区画ごとに 1 つは残す） */
  offRatio: number;
  /** 点光源の明るさの倍率 */
  lightMul: number;
  ambient: number;
  fog: { color: number; near: number; far: number };
  /** 材質の置き換え */
  mats: Partial<Record<MatId, MatId>>;
}

/** 調子の一覧（増やすときはここに足す） */
export const BSIDE_TONES: readonly BSideTone[] = [
  {
    id: 'emergency', name: '非常灯', lightColor: 0xff6a55, offRatio: 0.55, lightMul: 0.6, ambient: 0x1a0808,
    fog: { color: 0x120404, near: 3, far: 28 },
    mats: { wallWhite: 'wallConcrete', wallCream: 'wallConcrete', ceilingWhite: 'ceilingDark', ceilingTile: 'ceilingDark' },
  },
  {
    id: 'green', name: '緑の灯り', lightColor: 0x9cffb4, offRatio: 0.35, lightMul: 0.7, ambient: 0x0a160d,
    fog: { color: 0x08120a, near: 4, far: 32 },
    mats: { wallBeige: 'wallGreen', wallCream: 'wallGreen', wallWhite: 'wallGreen', floorCarpetRed: 'floorCarpetGrey' },
  },
  {
    id: 'night', name: '消灯後', lightColor: 0x8fa6ff, offRatio: 0.65, lightMul: 0.45, ambient: 0x060914,
    fog: { color: 0x04060c, near: 3, far: 26 },
    mats: { floorCarpetRed: 'floorCarpetGrey', wallBeige: 'wallDark', ceilingWhite: 'ceilingDark' },
  },
  {
    id: 'sodium', name: '夕暮れ色', lightColor: 0xffb060, offRatio: 0.3, lightMul: 0.8, ambient: 0x160d05,
    fog: { color: 0x120a04, near: 4, far: 34 },
    mats: { wallWhite: 'wallConcrete', wallBeige: 'wallConcrete', floorTile: 'floorConcrete', floorLino: 'floorConcrete' },
  },
];

const isPanel = (cell: CellLayout, mat: MatId, kind?: string): boolean => mat === cell.palette.light && !kind?.startsWith('lamp:');

/** 裏の調子をフロアに掛ける（区画の配列は表と同じもの。表のフロアの物は共有していない前提） */
export function applyBSide(floor: FloorLayout, rng: Rng): BSideTone {
  const tone = rng.pick(BSIDE_TONES);
  for (const cell of floor.cells) {
    if (cell.role === 'secret') continue;
    const r = rng.fork(`bside:${cell.id}`);
    const old = cell.palette;
    const swap = (m: MatId): MatId => tone.mats[m] ?? m;
    // 消える照明: 仕掛けの照明は除く。区画ごとに 1 つは残す
    const panels = cell.boxes.filter((b) => isPanel(cell, b.mat, b.kind));
    const off = new Set(r.shuffle(panels.slice()).slice(0, Math.min(panels.length - 1, Math.round(panels.length * tone.offRatio))));
    for (const b of cell.boxes) {
      if (off.has(b)) b.mat = 'lightOff';
      else if (b.mat !== old.light) b.mat = swap(b.mat);
    }
    // 点光源: いちばん近い器具が消えていれば外す。残りは色と明るさを変える（仕掛けの照明は色だけ）
    const offPanels = [...off];
    cell.lights = cell.lights.filter((l) => {
      const near = panels.reduce<{ d: number; off: boolean } | null>((a, b) => {
        const d = Math.hypot((b.min[0] + b.max[0]) / 2 - l.pos[0], (b.min[2] + b.max[2]) / 2 - l.pos[2]);
        return !a || d < a.d ? { d, off: offPanels.includes(b) } : a;
      }, null);
      return !(near && near.d < 1.6 && near.off && !l.lampId);
    });
    for (const l of cell.lights) {
      l.color = tone.lightColor;
      if (!l.lampId) l.intensity *= tone.lightMul;
    }
    cell.palette = { ...old, floor: swap(old.floor), wall: swap(old.wall), ceiling: swap(old.ceiling), lightColor: tone.lightColor, lightIntensity: old.lightIntensity * tone.lightMul, ambient: tone.ambient, fog: tone.fog.color };
    if (cell.render?.fog) cell.render = { ...cell.render, fog: { ...tone.fog } };
  }
  floor.fog = { ...tone.fog };
  return tone;
}
