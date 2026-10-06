/**
 * 光と色の異変: 暗闇（照明が全部消え、遠くに小さな灯りが 1 つ）・霧（3〜4 m 先が見えない）・色の異変（真っ赤な照明 / 色が抜けた白い部屋）。
 * どれも家具が無くても成り立つ（post だけ。家具の要る異変が掛けられなかった部屋の掛け替え先にもなる）。
 */
import { box, type Box, type MatId } from '../../../world/layout.ts';
import { defineAnomaly } from '../types.ts';
import { interiorSolids, isCeilingPanel, KEEP_COLOR, LIGHT_OFF, mixColor } from '../util.ts';

/** 暗闇の小さな灯りの色（裸電球の暖色） */
const BULB = 0xffc27a;

/** 暗闇: 照明（天井のパネル・点光源・光る家具や画面）が全部消え、入口から遠い所に小さな灯りが 1 つ。懐中電灯（R）が要る */
defineAnomaly({
  id: 'dark', name: '暗闇', weight: 1, intensity: 2, kinds: ['room', 'hall'],
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY, h = cell.height;
    for (const b of cell.boxes) {
      if (b.kind?.startsWith('lamp:')) continue;
      const off = LIGHT_OFF[b.mat];
      if (off) b.mat = off;
    }
    cell.lights = [];
    cell.palette = { ...cell.palette, ambient: 0x030405, lightIntensity: cell.palette.lightIntensity * 0.2, fog: 0x020203 };
    // 遠くの灯り: 入口からいちばん遠い机の上の電気スタンド。無ければ天井から下がる裸電球
    const e = ctx.entrance.pos;
    const dist = (x: number, z: number): number => Math.hypot(x - e[0], z - e[2]);
    const tops = interiorSolids(cell).filter((b) => b.max[1] - b.min[1] < 0.12 && b.max[1] > fy + 0.55 && b.max[1] < fy + 1.15 && (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) > 0.25);
    const top = tops.sort((a, b) => dist((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2) - dist((a.min[0] + a.max[0]) / 2, (a.min[2] + a.max[2]) / 2))[0];
    const B: Box[] = [];
    let lx: number, lz: number, ly: number;
    if (top && dist((top.min[0] + top.max[0]) / 2, (top.min[2] + top.max[2]) / 2) > 2.5) {
      lx = (top.min[0] + top.max[0]) / 2; lz = (top.min[2] + top.max[2]) / 2;
      const y = top.max[1];
      B.push(box([lx - 0.07, y, lz - 0.07], [lx + 0.07, y + 0.03, lz + 0.07], 'metalDark', false));
      B.push(box([lx - 0.012, y + 0.03, lz - 0.012], [lx + 0.012, y + 0.32, lz + 0.012], 'metalDark', false));
      B.push(box([lx - 0.1, y + 0.32, lz - 0.1], [lx + 0.1, y + 0.45, lz + 0.1], 'lightWarm', false));
      ly = y + 0.38;
    } else {
      // 壁から 0.8 m 内側の点のうち、入口からいちばん遠い所（電球が棚などの背の高い物に埋まらない所）
      const by = fy + Math.min(2.3, Math.max(1.95, h - 0.8));
      const solids = interiorSolids(cell);
      const pts: [number, number][] = [];
      for (const r of ctx.rects) for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) pts.push([r.x0 + 0.8 + ((r.x1 - r.x0 - 1.6) * i) / 4, r.z0 + 0.8 + ((r.z1 - r.z0 - 1.6) * k) / 4]);
      pts.sort((a, b) => dist(b[0], b[1]) - dist(a[0], a[1]));
      const clear = (x: number, z: number): boolean => !solids.some((s) => s.max[1] > by - 0.3 && s.min[0] < x + 0.3 && s.max[0] > x - 0.3 && s.min[2] < z + 0.3 && s.max[2] > z - 0.3);
      [lx, lz] = pts.find(([x, z]) => clear(x, z)) ?? pts[0]!;
      B.push(box([lx - 0.006, by + 0.1, lz - 0.006], [lx + 0.006, fy + h, lz + 0.006], 'metalDark', false));
      B.push(box([lx - 0.05, by, lz - 0.05], [lx + 0.05, by + 0.1, lz + 0.05], 'lightWarm', false));
      ly = by;
    }
    for (const b of B) { b.propGroup = `${cell.id}/a-darkLamp`; ctx.addBox(b); }
    B[B.length - 1]!.kind = 'darkLamp';
    cell.lights.push({ pos: [lx, ly, lz], color: BULB, intensity: ctx.tuning['anomaly.dark.lampIntensity'], distance: 4.5 });
  },
});

/** 霧: 部屋の中だけ濃い霧（白く、3〜4 m 先が見えない）。扉を開けると白い壁のように見える */
defineAnomaly({
  id: 'fog', name: '霧', weight: 0.9, intensity: 2, kinds: ['room', 'hall'],
  post(ctx) {
    const cell = ctx.cell, t = ctx.tuning;
    const color = mixColor(0xc4c8cb, cell.palette.lightColor, 0.25);
    cell.render = { ...cell.render, fog: { color, near: t['anomaly.fog.near'], far: Math.max(t['anomaly.fog.near'] + 0.5, t['anomaly.fog.far']) } };
    cell.palette = { ...cell.palette, fog: color };
  },
});

/** 真っ赤な照明（非常灯）の色 */
const RED = 0xff3020;

/**
 * 色の異変: 真っ赤な照明（照明のパネルが赤く光り、部屋じゅうが赤い）か、色が抜けた部屋（光る物・水・ガラス以外が全部白い無地。
 * 描かれる前のような部屋）。どちらにするかは調整表 anomaly.tint.*
 */
defineAnomaly({
  id: 'tint', name: '色の異変', weight: 0.9, intensity: 1, kinds: ['room', 'hall'],
  post(ctx) {
    const cell = ctx.cell, t = ctx.tuning;
    const kind = ctx.rng.weighted(['red', 'white'] as const, (k) => (k === 'red' ? t['anomaly.tint.red'] : t['anomaly.tint.white']));
    ctx.memo.kind = kind;
    if (kind === 'red') {
      for (const b of cell.boxes) if (isCeilingPanel(cell, b)) b.mat = 'neonRed';
      cell.lights = cell.lights.map((l) => ({ ...l, color: RED }));
      cell.palette = { ...cell.palette, light: 'neonRed', lightColor: RED, ambient: 0x260404, fog: 0x1a0303 };
      cell.render = { ...cell.render, colorMask: [1, 0.55, 0.5] };
      return;
    }
    // 色が抜けた部屋: 床・壁・天井・家具を白い無地に（扉の板は部品なので元の色のまま）
    const white: MatId = 'untextured';
    for (const b of cell.boxes) if (!KEEP_COLOR.has(b.mat)) b.mat = white;
    cell.palette = { ...cell.palette, floor: white, wall: white, ceiling: white, lightColor: 0xffffff, ambient: 0x9a9a9a };
    cell.render = { ...cell.render, style: 'untextured' };
  },
});
