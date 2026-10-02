/**
 * I01 水を運ぶ [WS] + BI01 一滴もこぼさず満杯で運ぶ → 台が沈んで扉。
 *
 * 部屋の入口の近くの壁に蛇口と流し、その前に空のバケツ。向こうの壁際に、上に皿の付いた石の台（満水の線が引いてある）。
 * - 遊び方: バケツを拾って蛇口の下に立つと満ちる。台の上に置くと水が注がれ、バケツは蛇口の下へ戻る（何度でもやり直せる）。
 *   台の皿に溜まった量が見える（少し足りない、が分かる）。運ばなくても部屋は普通に通れる（空でも到着できる）
 * - 規則（見て分かる）: 速く歩くと水がこぼれる（しずくと音）。跳ぶと大きくこぼれる。走るとあっという間に減る
 * - 隠し（出現型）: 満杯のまま（一滴もこぼさず）注ぐと、台が沈んで台の横の壁に扉が現れる。こぼさずに運ぶには、しゃがみ歩き
 *   （か、スマホなら少しだけ倒した移動）でゆっくり運ぶ
 */
import type { Dir } from '../../../math/vec.ts';
import { box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { innerRect } from '../util.ts';
import { aabbJ, addItem, freeSpans, idOf, offer, onMainWall, wallBox, wallPoint } from './util.ts';

defineGimmick({
  id: 'carryWater', name: '水を運ぶ', axes: ['carry'], kinds: ['room', 'hall'], minSize: [4.4, 6], weight: 0.45, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance!;
    // 蛇口の壁（入口に近い区間）と台の壁（蛇口から遠い区間。扉を横に開けられる長さ）を選ぶ
    type Pick = { tapD: Dir; tapAt: number; standD: Dir; standAt: number; doorAt: number; score: number };
    let best: Pick | null = null;
    for (const td of [0, 1, 2, 3] as Dir[]) for (const ts of freeSpans(r, s.openings, td, 1.6, 0.7)) {
      const ea = td % 2 === 0 ? ent.pos[0] : ent.pos[2];
      const tapAt = Math.min(Math.max(ea, ts.a0 + 0.5), ts.a1 - 1.1);
      const tp = wallPoint(r, td, tapAt, 0.8, y);
      const toEnt = Math.hypot(tp[0] - ent.pos[0], tp[2] - ent.pos[2]);
      for (const sd of [0, 1, 2, 3] as Dir[]) for (const ss of freeSpans(r, s.openings, sd, 2.8, 0.7)) {
        if (sd === td && !(ss.a1 < ts.a0 - 0.5 || ss.a0 > ts.a1 + 0.5)) continue;
        for (const side of [-1, 1]) {
          const standAt = side < 0 ? ss.a0 + 0.55 : ss.a1 - 0.55;
          const doorAt = standAt - side * 1.4;
          if (doorAt - 0.6 < ss.a0 - 0.01 || doorAt + 0.6 > ss.a1 + 0.01) continue;
          const sp = wallPoint(r, sd, standAt, 0.6, y);
          const dist = Math.hypot(sp[0] - tp[0], sp[2] - tp[2]);
          if (dist < 4) continue;
          const score = dist - toEnt * 0.6;
          if (!best || score > best.score) best = { tapD: td, tapAt, standD: sd, standAt, doorAt, score };
        }
      }
    }
    if (!best) return;
    const { tapD, tapAt, standD, standAt, doorAt } = best;
    // 蛇口と流し（流しは低い。当たる）
    ctx.addBox(wallBox(r, tapD, tapAt, 0.04, y + 0.85, y + 1.3, 0.05, 'stainless'));
    ctx.addBox(wallBox(r, tapD, tapAt, 0.03, y + 1.12, y + 1.16, 0.28, 'stainless'));
    ctx.addBox(wallBox(r, tapD, tapAt, 0.025, y + 1.0, y + 1.12, 0.03, 'stainless', false, 0.25));
    ctx.addBox(wallBox(r, tapD, tapAt, 0.45, y, y + 0.32, 0.42, 'marbleWhite', true));
    ctx.addBox(wallBox(r, tapD, tapAt, 0.38, y + 0.3, y + 0.325, 0.34, 'aquariumBlue', false, 0.04));
    const fz = wallPoint(r, tapD, tapAt, 0, y), fz1 = wallPoint(r, tapD, tapAt, 1.45, y);
    const fillZone = tapD % 2 === 0
      ? { min: [tapAt - 0.85, y - 0.3, Math.min(fz[2], fz1[2])], max: [tapAt + 0.85, y + 2, Math.max(fz[2], fz1[2])] }
      : { min: [Math.min(fz[0], fz1[0]), y - 0.3, tapAt - 0.85], max: [Math.max(fz[0], fz1[0]), y + 2, tapAt + 0.85] };
    // 台（沈む動く箱）と、上の皿の受け
    const sc = wallPoint(r, standD, standAt, 0.6, y);
    const H = 0.62;
    const recv = ctx.addEntity('stand', { type: 'carryReceiver', params: { slots: [{ pos: [sc[0], y + H, sc[2]], r: 0.65, accept: ['bucket'] }], mark: false } });
    // 置いてから 0.9 秒で注ぎ終わり、バケツは蛇口の下へ戻る
    const pour = ctx.addEntity('pour', { type: 'timer', params: { onDelay: 0.9, offDelay: 0 }, inputs: { in: `${recv}.any` } });
    addItem(ctx, 'bucket', wallPoint(r, tapD, tapAt + 0.6, 0.62, y), {
      half: [0.16, 0.17, 0.16], kind: 'bucket', tag: 'bucket', mat: 'plasticBlue', fluid: true, fill: 0, fillZone,
      bounds: aabbJ({ min: [s.rect.x0, y - 1, s.rect.z0], max: [s.rect.x1, y + 3, s.rect.z1] }), persist: false, inputs: { reset: `${pour}.out` },
    });
    const level = ctx.addEntity('level', { type: 'carryLevel', params: { holdSec: 8, decay: 0.12, fullAt: 0.999, basin: aabbJ({ min: [sc[0] - 0.3, y + H, sc[2] - 0.3], max: [sc[0] + 0.3, y + H + 0.07, sc[2] + 0.3] }), follow: idOf(ctx, 'plinth') }, inputs: { value: `${recv}.fill`, hold: `${recv}.any` } });
    const sunk = ctx.addEntity('sunk', { type: 'latch', params: {}, inputs: { set: `${level}.full` } });
    ctx.addEntity('plinth', { type: 'mover', params: { box: aabbJ(box([sc[0] - 0.36, y, sc[2] - 0.36], [sc[0] + 0.36, y + H, sc[2] + 0.36], 'marbleWhite')), mat: 'marbleWhite', points: [[0, 0, 0], [0, -0.5, 0]], speed: 0.25, carry: false }, inputs: { target: `${sunk}.out` } });
    // 満水の線（台の正面）
    ctx.addBox(wallBox(r, standD, standAt, 0.3, y + H - 0.08, y + H - 0.065, 0.02, 'yellowLine', false, 0.96));
    // 水たまり（床が濡れている部屋）
    for (const k of [0.3, 0.55, 0.8]) {
      const x = fz1[0] + (sc[0] - fz1[0]) * k + (ctx.rng.next() - 0.5) * 0.8, z = fz1[2] + (sc[2] - fz1[2]) * k + (ctx.rng.next() - 0.5) * 0.8;
      const w = ctx.rng.float(0.35, 0.7), d = ctx.rng.float(0.3, 0.6);
      ctx.addBox(box([x - w / 2, y, z - d / 2], [x + w / 2, y + 0.004, z + d / 2], 'puddle', false));
    }
    offer(ctx, { hook: 'carry.water.full', modes: ['appear'], weight: 1.0, revealOutput: `${level}.full`, doorway: { dir: standD, at: doorAt, y, width: 1.0, height: 2.0 }, tell: '台の縁の満水の線' });
    // 家具を置かない: 台と扉の前・蛇口の前
    const k1 = wallPoint(r, standD, standAt, 1.8, y), k0 = wallPoint(r, standD, doorAt, 0, y);
    ctx.keepOut({ min: [Math.min(k0[0], k1[0], sc[0]) - 0.9, y - 0.1, Math.min(k0[2], k1[2], sc[2]) - 0.9], max: [Math.max(k0[0], k1[0], sc[0]) + 0.9, y + 2.6, Math.max(k0[2], k1[2], sc[2]) + 0.9] });
    ctx.keepOut({ min: [fillZone.min[0]! - 0.6, y - 0.1, fillZone.min[2]! - 0.6], max: [fillZone.max[0]! + 0.6, y + 2.6, fillZone.max[2]! + 0.6] });
  },
});
