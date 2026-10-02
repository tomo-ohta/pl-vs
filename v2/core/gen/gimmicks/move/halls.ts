/**
 * 長い部屋の仕掛け（2 種）。どちらも入口と出口が向かい合う細長い部屋（廊下も）。
 * - backwardHall 後ろ向きでしか進めない通路 [M42・QR の後ろ向き課題の発展]: 奥の壁に大きな目。前（奥）を向いていると見えない力で
 *     入口の方へ押し戻される。後ろ向きに歩けば進める（向いている度合いで押す強さが変わる）。床には後ろ向きに歩いた足跡
 * - stretchHall 歩くと伸びる廊下 [M41]: 柱と照明が同じ間隔で並ぶ廊下。歩いて真ん中の境目を越えると、1 区切り手前へ継ぎ目なく
 *     戻される（出口だけが遠のく）。立ち止まると廊下が縮むように前へ滑っていく（普通でない振る舞い = 止まることで進む）
 */
import { lightPanel } from '../../../world/build.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson } from '../util.ts';
import { hallAabb, hallBox, hallOf, hallPoint, removeLightsIn } from './common.ts';

const opposite = (s: { entrance: { dir: number } | null; exit: { dir: number } | null }): boolean => !!s.entrance && !!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4;

defineGimmick({
  id: 'backwardHall', name: '後ろ向きの通路', axes: ['body', 'sight'], kinds: ['room', 'hall', 'corridor'], minSize: [1.8, 6.5], weight: 0.6, intensity: 1, onMainPath: true,
  fits: opposite,
  build(ctx) {
    const H = hallOf(ctx.slot);
    if (!H || H.L < 6.5) return;
    const t = ctx.tuning;
    const land0 = 1.2, land1 = 1.2;
    ctx.addEntity('push', {
      type: 'facingPush', params: {
        aabb: aabbJson(hallAabb(H, H.F.u0, land0, H.F.u1, H.L - land1, -0.1, H.h)), fwd: H.fwd,
        push: t['move.backward.push'], cone: Math.cos((t['move.backward.coneDeg'] * Math.PI) / 180),
      },
    });
    // 奥の壁の大きな目（出口の扉の上・両脇）
    const cu = H.exitU ?? (H.F.u0 + H.F.u1) / 2;
    const ey = Math.min(H.h - 0.35, 2.45);
    for (const side of [-1, 1]) {
      const u = cu + side * Math.min(0.75, H.W / 4);
      ctx.addBox(hallBox(H, u - 0.32, H.L - 0.03, u + 0.32, H.L, ey - 0.16, ey + 0.16, 'paintWhite', false));
      ctx.addBox(hallBox(H, u - 0.1, H.L - 0.045, u + 0.1, H.L - 0.03, ey - 0.1, ey + 0.1, 'neonRed', false));
    }
    // 後ろ向きに歩いた足跡（つま先が入口を向く）
    let left = true;
    for (let v = land0 + 0.4; v < H.L - land1; v += 0.55) {
      const u = (H.entU + (H.exitU ?? H.entU)) / 2 + (left ? -0.13 : 0.13);
      const b = ctx.addBox(hallBox(H, u - 0.05, v, u + 0.05, v + 0.24, 0, 0.004, 'shadowDecal', false));
      b.kind = 'footprint';
      left = !left;
    }
    ctx.keepOut(hallAabb(H, H.F.u0, land0, H.F.u1, H.L, -0.1, H.h));
  },
});

defineGimmick({
  id: 'stretchHall', name: '伸びる廊下', axes: ['move', 'sight'], kinds: ['room', 'hall', 'corridor'], minSize: [1.8, 8], weight: 0.6, intensity: 1, onMainPath: true,
  fits: opposite,
  build(ctx) {
    const s = ctx.slot;
    const H = hallOf(s);
    if (!H || H.L < 8) return;
    const t = ctx.tuning;
    const P = t['move.stretch.periodM'];
    const land0 = 1.2, land1 = 1.2;
    // 境目は真ん中の区切り。前後に 1 区切り以上の同じ形の廊下
    const k = Math.floor((H.L - land0 - land1) / P);
    if (k < 2) return;
    const T = land0 + Math.ceil(k / 2) * P + 0.0001;
    // 照明を作り直す（区切りごとに 1 つ。継ぎ目なく戻しても照明の位置が同じ）
    removeLightsIn(ctx, (x, z) => { const v = H.F.v(x, z); return v > 0.2 && v < H.L - 0.2; });
    const cu = (H.F.u0 + H.F.u1) / 2;
    const pal = s.cell.palette;
    for (let k = -20; k <= 20; k++) {
      const v = T + k * P;
      if (v < land0 - 0.3 || v > H.L - land1 + 0.3) continue;
      // 柱（両側の壁から少し張り出す）
      for (const hi of [false, true]) {
        const u = hi ? H.F.u1 : H.F.u0;
        ctx.addBox(hallBox(H, hi ? u - 0.18 : u, v - 0.15, hi ? u : u + 0.18, v + 0.15, 0, H.h, 'columnConcrete'));
      }
      const lv = v + P / 2;
      if (lv < H.L - land1) {
        const c = hallPoint(H, cu, lv, H.h);
        lightPanel(s.cell.boxes, c[0], c[2], 0.5, 0.5, H.y + H.h, pal.light);
        s.cell.lights.push({ pos: [c[0], H.y + H.h - 0.4, c[2]], color: pal.lightColor, intensity: pal.lightIntensity * 0.8, distance: P * 2.6 });
      }
    }
    // 入口と出口の前の照明（区切りの外）
    for (const v of [0.6, H.L - 0.6]) {
      const c = hallPoint(H, cu, v, H.h);
      lightPanel(s.cell.boxes, c[0], c[2], 0.5, 0.5, H.y + H.h, pal.light);
      s.cell.lights.push({ pos: [c[0], H.y + H.h - 0.4, c[2]], color: pal.lightColor, intensity: pal.lightIntensity * 0.7, distance: 4 });
    }
    ctx.addEntity('stretch', {
      type: 'stretchWarp', params: {
        aabb: aabbJson(hallAabb(H, H.F.u0, land0, H.F.u1, H.L - land1, -0.1, H.h)), fwd: H.fwd, origin: hallPoint(H, cu, T),
        period: P, stillSec: t['move.stretch.stillSec'], glide: t['move.stretch.glide'],
      },
    });
    ctx.keepOut(hallAabb(H, H.F.u0, 0, H.F.u1, H.L, -0.1, H.h));
  },
});
