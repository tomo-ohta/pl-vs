/**
 * 床の仕掛け（段階 3 の 10 種のうち 3 種）。どれも閉じ込めない: 落ちた先から歩いて戻れる。
 * - crumbleFloor 崩れる床 [QR][WS G02]: 部屋の真ん中の浅い穴（0.7 m）の上に、乗ると崩れる床板を敷く。落ちても段で上がれる
 * - bouncePad 弾む床 [QR][WS M04]: 高い棚の手前の弾む床。跳ねて棚に乗れる（棚の上に小さな物）
 * - appearPath 立ち止まると見える道 [WS G08]: 深い溝（2 m）を渡る見えない橋。光の四角で 1.5 秒止まると現れる。落ちたら階段で戻る
 */
import { box, type Box } from '../../world/layout.ts';
import type { Rect } from '../../world/footprint.ts';
import { defineGimmick } from './types.ts';
import { aabbJson, cutFloorSlab, hitsDoorZones, innerRect, mainAxis, pitBoxes, rectD, rectW } from './util.ts';

const snap = (v: number): number => Math.round(v * 20) / 20;

defineGimmick({
  id: 'crumbleFloor', name: '崩れる床', axes: ['floor'], kinds: ['room', 'hall'], minSize: [5.5, 6], weight: 0.8, intensity: 2, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    // 穴: 内側から 1.4 m（開口の前を空ける）。開口の前と重なるなら諦める
    const r = innerRect(s, 1.4);
    if (rectW(r) < 2.4 || rectD(r) < 2.4 || hitsDoorZones(s, r, 1.35)) return;
    const hole: Rect = { x0: snap(r.x0), z0: snap(r.z0), x1: snap(r.x1), z1: snap(r.z1) };
    const depth = 0.7;
    cutFloorSlab(s, hole);
    for (const b of pitBoxes(s, hole, depth)) ctx.addBox(b);
    // 穴から上がる段（四辺の真ん中に 2 段）
    const mx = (hole.x0 + hole.x1) / 2, mz = (hole.z0 + hole.z1) / 2;
    for (const [x, z, alongX] of [[mx, hole.z0 + 0.15, true], [mx, hole.z1 - 0.15, true], [hole.x0 + 0.15, mz, false], [hole.x1 - 0.15, mz, false]] as const) {
      for (let k = 0; k < 2; k++) {
        const top = y - depth + 0.35 * (k + 1);
        const off = 0.3 * (2 - k);
        const sgnZ = z < mz ? 1 : -1, sgnX = x < mx ? 1 : -1;
        ctx.addBox(alongX
          ? box([x - 0.6, y - depth, Math.min(z, z + sgnZ * off)], [x + 0.6, top, Math.max(z, z + sgnZ * off)], s.cell.palette.floor)
          : box([Math.min(x, x + sgnX * off), y - depth, z - 0.6], [Math.max(x, x + sgnX * off), top, z + 0.6], s.cell.palette.floor));
      }
    }
    // 床板（0.9 m 角、隙間 0.04）
    const tile = 0.9;
    const nx = Math.floor(rectW(hole) / tile), nz = Math.floor(rectD(hole) / tile);
    const ox = hole.x0 + (rectW(hole) - nx * tile) / 2, oz = hole.z0 + (rectD(hole) - nz * tile) / 2;
    const mat = ctx.rng.pick([s.cell.palette.floor, 'floorTile', 'floorLino'] as const);
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        const b = { min: [ox + i * tile + 0.02, y - 0.12, oz + k * tile + 0.02], max: [ox + (i + 1) * tile - 0.02, y, oz + (k + 1) * tile - 0.02] };
        ctx.addEntity(`t${i}_${k}`, { type: 'crumbleTile', params: { box: { min: b.min, max: b.max }, mat, standSec: ctx.rng.float(0.25, 0.5), shakeSec: ctx.rng.float(0.6, 1.1), respawnSec: 9 } });
      }
    }
    ctx.keepOut({ min: [hole.x0, y - depth, hole.z0], max: [hole.x1, y + 3, hole.z1] });
  },
});

defineGimmick({
  id: 'bouncePad', name: '弾む床', axes: ['body', 'move'], kinds: ['hall', 'room'], minSize: [5, 5], minHeight: 3.6, weight: 0.6, intensity: 1, onMainPath: true,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    // 棚: 開口の無い壁に沿って（高さ 2.2〜2.6 m、奥行き 1.4 m、長さ 3 m）
    const walls = ([0, 1, 2, 3] as const).filter((d) => !s.openings.some((o) => o.dir === d));
    if (!walls.length) return;
    const d = ctx.rng.pick(walls);
    const ledgeY = y + Math.min(s.cell.height - 1.9, ctx.rng.float(2.2, 2.6));
    if (ledgeY - y < 1.8) return;
    const len = Math.min(3.2, (d === 0 || d === 2 ? rectW(r) : rectD(r)) - 0.6);
    const depth = 1.4;
    const c = d === 0 || d === 2 ? (r.x0 + r.x1) / 2 : (r.z0 + r.z1) / 2;
    const wall = d === 0 ? r.z1 : d === 2 ? r.z0 : d === 1 ? r.x1 : r.x0;
    const sg = d === 0 || d === 1 ? -1 : 1; // 内向き
    const w0 = Math.min(wall, wall + sg * depth), w1 = Math.max(wall, wall + sg * depth);
    ctx.addBox(d === 0 || d === 2 ? box([c - len / 2, ledgeY - 0.15, w0], [c + len / 2, ledgeY, w1], 'metal') : box([w0, ledgeY - 0.15, c - len / 2], [w1, ledgeY, c + len / 2], 'metal'));
    // 棚の上の小さな物（見つけた印）
    const tx = d === 0 || d === 2 ? c : (w0 + w1) / 2, tz = d === 0 || d === 2 ? (w0 + w1) / 2 : c;
    ctx.addBox(box([tx - 0.12, ledgeY, tz - 0.12], [tx + 0.12, ledgeY + 0.3, tz + 0.12], 'goldTrim', false));
    // 弾む床: 棚の手前 1.4 m
    const px = d === 0 || d === 2 ? c : (d === 1 ? w0 - 1.4 : w1 + 1.4), pz = d === 0 || d === 2 ? (d === 0 ? w0 - 1.4 : w1 + 1.4) : c;
    const pad: Box = box([px - 0.6, y, pz - 0.6], [px + 0.6, y + 0.08, pz + 0.6], 'plasticYellow', false);
    pad.kind = 'bouncePad';
    ctx.addBox(pad);
    const v = Math.sqrt(2 * 9.8 * (ledgeY - y + 0.7));
    ctx.addEntity('pad', { type: 'bouncePad', params: { aabb: aabbJson({ min: [px - 0.6, y - 0.1, pz - 0.6], max: [px + 0.6, y + 0.4, pz + 0.6] }), speed: v } });
    ctx.keepOut({ min: [px - 1.2, y, pz - 1.2], max: [px + 1.2, y + 3, pz + 1.2] });
  },
});

defineGimmick({
  id: 'appearPath', name: '立ち止まると見える道', axes: ['time', 'sight'], kinds: ['room', 'hall'], minSize: [5, 7], weight: 0.7, intensity: 2, onMainPath: false,
  // 溝で部屋が二つに分かれるので、開口が 1 つの行き止まりの部屋だけ（溝の向こうに開口があると、橋が現れるまで行けない）
  fits: (s) => s.openings.length === 1,
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const { axis } = mainAxis(s);
    const r = innerRect(s);
    // 溝: 入口から遠い半分を横切る（入口の前は空ける）。幅 2.2 m
    const ent = s.entrance;
    const far = ent ? (axis === 'x' ? (ent.pos[0] < (r.x0 + r.x1) / 2 ? 1 : -1) : (ent.pos[2] < (r.z0 + r.z1) / 2 ? 1 : -1)) : 1;
    const mid = axis === 'x' ? (r.x0 + r.x1) / 2 + far * rectW(r) * 0.12 : (r.z0 + r.z1) / 2 + far * rectD(r) * 0.12;
    const gap = 2.2;
    const hole: Rect = axis === 'x' ? { x0: snap(mid - gap / 2), x1: snap(mid + gap / 2), z0: r.z0, z1: r.z1 } : { x0: r.x0, x1: r.x1, z0: snap(mid - gap / 2), z1: snap(mid + gap / 2) };
    if (hitsDoorZones(s, hole, 1.35)) return;
    const depth = 2.0;
    cutFloorSlab(s, hole);
    for (const b of pitBoxes(s, hole, depth)) ctx.addBox(b);
    // 溝から戻る階段（端の壁沿い）
    const steps = Math.ceil(depth / 0.17);
    const tread = Math.min(0.28, (axis === 'x' ? rectD(hole) : rectW(hole)) / (steps + 1));
    for (let i = 0; i < steps; i++) {
      const top = y - depth + (i + 1) * (depth / steps);
      ctx.addBox(axis === 'x'
        ? box([hole.x0 + 0.15, y - depth, hole.z0 + 0.15 + i * tread], [hole.x1 - 0.15, top, hole.z0 + 0.15 + (i + 1) * tread], s.cell.palette.floor)
        : box([hole.x0 + 0.15 + i * tread, y - depth, hole.z0 + 0.15], [hole.x0 + 0.15 + (i + 1) * tread, top, hole.z1 - 0.15], s.cell.palette.floor));
    }
    // 見えない橋（出現型の箱）: 溝の真ん中を幅 1.0 m で渡す
    const group = `${ctx.id}.bridge`;
    const cc = axis === 'x' ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    const bridge: Box = axis === 'x' ? box([hole.x0, y - 0.1, cc - 0.5], [hole.x1, y, cc + 0.5], 'glass') : box([cc - 0.5, y - 0.1, hole.z0], [cc + 0.5, y, hole.z1], 'glass');
    bridge.revealGroup = group;
    ctx.addBox(bridge);
    // 光の四角（溝の手前 1.4 m）
    const near = axis === 'x' ? mid - far * (gap / 2 + 1.4) : mid - far * (gap / 2 + 1.4);
    const px = axis === 'x' ? near : cc, pz = axis === 'x' ? cc : near;
    const pad: Box = box([px - 0.5, y, pz - 0.5], [px + 0.5, y + 0.012, pz + 0.5], 'screenGlow', false);
    pad.kind = 'pad';
    ctx.addBox(pad);
    const dwell = ctx.addEntity('pad', { type: 'dwellSensor', params: { aabb: aabbJson({ min: [px - 0.5, y - 0.1, pz - 0.5], max: [px + 0.5, y + 1.5, pz + 0.5] }), sec: 1.5, still: true } });
    ctx.addEntity('reveal', { type: 'reveal', params: { group, pos: [axis === 'x' ? mid : cc, y, axis === 'x' ? cc : mid], style: 'fadeIn' }, inputs: { show: `${dwell}.done` } });
    ctx.keepOut({ min: [hole.x0 - 0.2, y - depth, hole.z0 - 0.2], max: [hole.x1 + 0.2, y + 3, hole.z1 + 0.2] });
    ctx.keepOut({ min: [px - 1, y, pz - 1], max: [px + 1, y + 3, pz + 1] });
  },
});
