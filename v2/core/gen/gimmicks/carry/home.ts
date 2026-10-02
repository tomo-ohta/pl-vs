/**
 * 元の部屋のある物（2 変種）: 部屋の奥の台に、小さな物が 1 つ置いてある。
 * - morph（I11 運ぶと変わる物）: 持って歩くと、carry.home.stageM m ごとに少しずつ別の物になる（コップ → 花瓶 → 鳥の置物 → 鍵）。
 *     変わるたびに小さな鈴の音。最後の形（鍵）になってから元の台に戻すと、台の後ろの壁が開く（出現型）
 * - return（BI06 拾った物を元の部屋に戻す）: オルゴール。部屋の外へ持ち出してから、この部屋に戻して置くと、
 *     戻した部屋に新しい扉が現れる（出現型）。持ち出さずに置き直しても何も起きない
 */
import type { Dir } from '../../../math/vec.ts';
import { box } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { innerRect } from '../util.ts';
import { aabbJ, addItem, freeSpans, offer, onMainWall, wallBox, wallPoint } from './util.ts';

defineGimmick({
  id: 'homeObject', name: '元の部屋の物', axes: ['carry'], kinds: ['room', 'hall'], minSize: [3.8, 4.4], weight: 0.12, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const ent = s.entrance ?? s.openings[0]!;
    const opp = ((ent.dir + 2) % 4) as Dir;
    const walls = [opp, ...ctx.rng.shuffle(([0, 1, 2, 3] as Dir[]).filter((d) => d !== opp && d !== ent.dir))];
    const w = walls.map((d) => ({ d, sp: freeSpans(r, s.openings, d, 2.8, 0.8)[0] })).find((x) => x.sp);
    if (!w) return;
    const d = w.d, sp = w.sp!;
    const morph = ctx.rng.chance(0.5);
    // 台（当たる）と、台の後ろの壁の扉（台の横 1.3 m）
    const at = sp.at - 0.65, doorAt = sp.at + 0.65;
    ctx.addBox(wallBox(r, d, at, 0.25, y, y + 1.0, 0.5, 'woodPanel', true, 0.05));
    ctx.addBox(wallBox(r, d, at, 0.27, y + 1.0, y + 1.03, 0.54, 'goldTrim', true, 0.03));
    const top = wallPoint(r, d, at, 0.3, y + 1.03);
    const ped = ctx.addEntity('pedestal', { type: 'carryReceiver', params: { slots: [{ pos: top, r: 0.6 }], markMat: 'goldTrim', markM: 0.28 } });
    const home = aabbJ({ min: [s.rect.x0, y - 0.5, s.rect.z0], max: [s.rect.x1, y + 3, s.rect.z1] });
    if (morph) {
      const stages = 4;
      const item = addItem(ctx, 'thing', top, { half: [0.08, 0.1, 0.08], kind: 'morph', tag: 'morph', mat: 'paintWhite', forms: ['cup', 'vase', 'bird', 'key'], stages, stageM: t['carry.home.stageM'], yaw: 0, homeRegion: home });
      const last = ctx.addEntity('last', { type: 'valueIs', params: { value: stages - 1 }, inputs: { in: `${ped}.stage` } });
      const back = ctx.addEntity('back', { type: 'and', params: {}, inputs: { a: `${last}.out`, b: `${ped}.count` } });
      void item;
      offer(ctx, { hook: 'carry.home.morph', modes: ['appear'], weight: 1, revealOutput: `${back}.out`, doorway: { dir: d, at: doorAt, y, width: 1.0, height: 2.0 }, tell: '台の上の、鍵の形のくぼみ' });
      // くぼみ（台の上の鍵の形の印）
      ctx.addBox(box([top[0] - 0.06, top[1], top[2] - 0.02], [top[0] + 0.06, top[1] + 0.004, top[2] + 0.02], 'metalDark', false));
    } else {
      const item = addItem(ctx, 'thing', top, { half: [0.1, 0.07, 0.07], kind: 'box', tag: 'musicbox', mat: 'woodPanel', yaw: 0, homeRegion: home });
      offer(ctx, { hook: 'carry.home.returned', modes: ['appear'], weight: 1, revealOutput: `${item}.returned`, doorway: { dir: d, at: doorAt, y, width: 1.0, height: 2.0 }, tell: '台の上の、何かが長く置かれていた跡' });
    }
    const k0 = wallPoint(r, d, sp.at - 1.4, 0, y), k1 = wallPoint(r, d, sp.at + 1.4, 1.6, y);
    ctx.keepOut({ min: [Math.min(k0[0], k1[0]), y - 0.1, Math.min(k0[2], k1[2])], max: [Math.max(k0[0], k1[0]), y + 2.6, Math.max(k0[2], k1[2])] });
  },
});
