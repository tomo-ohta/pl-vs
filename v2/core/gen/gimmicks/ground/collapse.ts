/**
 * 崩れていく帰り道（collapseRun）[QR G03]・帰らずに奥へ（BG02）。
 *
 * 行き止まりの部屋の床ほぼ全部が深い穴（ground.collapse.depthM）の上の床板。普段はただの床で、奥の台の上に光る装置がある。
 * 装置に触れると（E / タップ）警報が鳴って照明が赤くなり、装置の足元から入口へ向かって床が崩れてくる。
 * - 目標: 入口の床まで逃げ切る。崩れの前線の速さは、走れば間に合い・歩くと捕まるように部屋の奥行きから決める（ground.collapse.margin）
 * - 失敗: 底の見えない穴へ落ちる（14 章）。1 つ下の階へ。しばらくで床板は戻る
 * - 隠し（collapse.deep）: 装置の下の穴の底の壁（入口と向かいの壁）に扉。存在型 = 最初からある（床板の下で見えない。落ちれば歩いて行ける）/
 *   出現型 = 帰らずに装置の近くに居続け、崩れる床と一緒に装置の下へ落ちると現れる（帰らずに奥へ進むと、崩れた先の下へ）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, DOOR_W } from '../../../world/layout.ts';
import { buildPit, catwalkSecret, planCatwalk, planPit } from '../pit.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson, rectGap, unreachableSpot } from '../util.ts';
import { botHint, gridTiles, linkRoomLights } from './common.ts';

defineGimmick({
  id: 'collapseRun', name: '崩れていく帰り道', axes: ['floor'], kinds: ['room', 'hall'], minSize: [4.4, 6.4], minHeight: 2.4, weight: 0.8, intensity: 2, offersSecret: true, onMainPath: false,
  // 行き止まりの部屋（開口が 1 つ）: 装置に触れたら入口へ逃げる
  fits: (s) => s.openings.length === 1 && !!s.entrance,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const depth = t['ground.collapse.depthM'];
    const plan = planPit(ctx, { depth, preferAlongEntry: true, drop: true });
    if (!plan) return;
    const F = plan.frame;
    const landD = t['gimmick.pit.landingM'];
    // 装置の台: 奥の壁から 1.5 m（台と奥の壁の間を、落ちた人が通れる）。階段・細い床から離す
    const vp = F.depth - 1.5;
    if (vp - landD < 2.4) return;
    const P = 0.25;
    const um = (F.u0 + F.u1) / 2;
    let ped: Rect | null = null;
    for (const du of [0, 0.8, -0.8, 1.6, -1.6]) {
      const up = um + du;
      if (up - P < F.u0 + 0.9 || up + P > F.u1 - 0.9) continue;
      const r = F.rect(up - P, vp - P, up + P, vp + P);
      if (plan.solidTop.some((q) => rectGap(q, r) < 0.9)) continue;
      if (!plan.drop && unreachableSpot(plan.hole, [...plan.bottomBlocks, r], plan.foot) !== null) continue;
      ped = r;
      break;
    }
    if (!ped) return;
    const up = F.u(ped.x0, ped.z0) + (F.u(ped.x1, ped.z1) - F.u(ped.x0, ped.z0)) / 2;
    // 下の細い足場（BG02「帰らずに奥へ」）: 装置の手前の下（帰らずに装置のそばに居ると、崩れる床と一緒に足場の上へ落ちる）。
    // 行き止まりの部屋の奥の報酬なので、落ちる穴では必ず置く（置けない・装置の台に当たるなら、この部屋には組まない）
    if (plan.drop) {
      plan.catwalk = planCatwalk(ctx, plan.hole, F, landD, F.depth - 0.4, plan.landings.map((l) => l.rect), up, { force: true, va: vp - 2.6, vb: vp - 0.6 });
      if (!plan.catwalk || plan.catwalk.rects.some((r) => rectGap(r, ped!) < 0.3)) return;
    }
    // 照明: 普段の照明（崩れている間は消える）と、警報の赤い灯り（崩れている間だけ点く）。穴の底の灯り（buildPit）は結び付けない
    const normal = ctx.addEntity('lightNormal', { type: 'lamp', params: { on: true, rate: 6 }, inputs: { on: { from: `${ctx.id}.floor.active`, invert: true } } });
    linkRoomLights(ctx, normal);
    buildPit(ctx, plan);
    const alarm = ctx.addEntity('lightAlarm', { type: 'lamp', params: { on: false, rate: 10 }, inputs: { on: `${ctx.id}.floor.active` } });
    const [pcx, pcz] = F.point(up, vp);
    s.cell.lights.push({ pos: [pcx, y + s.cell.height - 0.5, pcz], color: 0xff2a14, intensity: 0.9, distance: Math.max(7, F.depth * 1.2), lampId: alarm });
    const [ecx, ecz] = F.point(up, landD + 0.6);
    s.cell.lights.push({ pos: [ecx, y + s.cell.height - 0.5, ecz], color: 0xff2a14, intensity: 0.6, distance: 6, lampId: alarm });
    const red = box([pcx - 0.18, y + s.cell.height - 0.12, pcz - 0.18], [pcx + 0.18, y + s.cell.height - 0.02, pcz + 0.18], 'neonRed', false);
    red.kind = `lamp:${alarm}`;
    ctx.addBox(red);
    // 台（穴の底から立つ柱）と、上の装置
    ctx.addBox(box([ped.x0, y - depth, ped.z0], [ped.x1, y + 0.95, ped.z1], 'metalDark'));
    ctx.addBox(box([ped.x0 - 0.05, y + 0.95, ped.z0 - 0.05], [ped.x1 + 0.05, y + 1.0, ped.z1 + 0.05], 'metal'));
    const device = { min: [pcx - 0.16, y + 1.0, pcz - 0.16], max: [pcx + 0.16, y + 1.3, pcz + 0.16] };
    // 床板（穴の上。固い床・台を除く）
    const tileM = t['ground.collapse.tileM'];
    const gap = 0.03;
    const tiles = gridTiles(plan.hole, [...plan.solidTop, { x0: ped.x0 - 0.02, x1: ped.x1 + 0.02, z0: ped.z0 - 0.02, z1: ped.z1 + 0.02 }], tileM)
      .map((r) => [r.x0 + gap, r.z0 + gap, r.x1 - gap, r.z1 - gap]);
    // 崩れの前線の速さ: 装置の手前（装置から 0.8 m）から入口の床の縁まで a m を、走れば間に合い歩くと捕まるように決める。
    // 前線が来てから ds 秒で落ちる。歩く人（3 m/s）を捕まえる最小の速さ vw と、走る人（5 m/s・出だし 0.2 秒）を捕まえない最大の速さ vd の間
    // （margin: 0 = 歩く人をぎりぎり捕まえる / 1 = 走る人をぎりぎり逃がす）。歩く人は、足元の床板の真ん中が 0.5 m 先にある（いちばん遅く落ちる）とみなし、
    // 入口の床の手前 0.3 m までに捕まえる
    const L = vp - landD;
    const delay = t['ground.collapse.delaySec'], shake = t['ground.collapse.shakeSec'];
    const ds = delay + shake, a = L - 0.8, aw = a - 0.3;
    const vw = aw / 3 > ds + 0.05 ? (1.3 + aw) / (aw / 3 - ds) : t['ground.collapse.speedMax'];
    const vd = (L - 0.3) / Math.max(0.05, 0.2 + a / 5 - ds);
    const speed = Math.min(t['ground.collapse.speedMax'], Math.max(t['ground.collapse.speedMin'], vw <= vd ? vw + (vd - vw) * t['ground.collapse.margin'] : vd));
    const tileMat = ctx.rng.pick((['floorTile', 'floorLino', 'floorWood', 'marbleFloor'] as const).filter((m) => m !== s.cell.palette.floor));
    // 隠し: 奥の壁の底（台の横 1.2 m 前後。階段・柱に掛からない所）
    const far = ((F.d + 2) % 4) as Dir;
    const blocks = [...plan.bottomBlocks, ped].filter((r) => Math.max(F.v(r.x0, r.z0), F.v(r.x1, r.z1)) > F.depth - 1.2);
    let at: number | null = null;
    for (const du of [1.25, -1.25, 1.8, -1.8, 2.4, -2.4]) {
      const a = up + du;
      if (a - DOOR_W / 2 < F.u0 + 0.35 || a + DOOR_W / 2 > F.u1 - 0.35) continue;
      if (blocks.some((r) => { const a0 = Math.min(F.u(r.x0, r.z0), F.u(r.x1, r.z1)), a1 = Math.max(F.u(r.x0, r.z0), F.u(r.x1, r.z1)); return a + DOOR_W / 2 + 0.3 > a0 && a - DOOR_W / 2 - 0.3 < a1; })) continue;
      at = a;
      break;
    }
    const floor = ctx.addEntity('floor', {
      type: 'collapseFloor',
      params: {
        tiles, y, thick: 0.12, origin: [pcx, pcz], device: aabbJson({ min: [device.min[0]!, device.min[1]!, device.min[2]!], max: [device.max[0]!, device.max[1]!, device.max[2]!] }),
        waveSpeed: speed, delaySec: delay, shakeSec: shake, restoreSec: t['ground.collapse.restoreSec'], mat: tileMat,
        // 隠しへ行く歩く人: 装置の手前で装置に触れ、崩れる床と一緒に落ちる
        bot: botHint([{ at: [...(() => { const p = F.point(up, vp - 0.8); return [p[0], y, p[1]] as [number, number, number]; })()], look: [pcx, y + 1.15, pcz], wait: 2.5 }], { only: 'secret' }),
      },
    });
    if (plan.drop) {
      // 落ちる穴: 運よく下の細い足場に落ちれば、その先の壁の扉へ（落ちなければ 1 つ下の階）
      if (plan.catwalk) ctx.offerSecret(catwalkSecret(plan.catwalk, 'collapse.deep', '装置の下の床板の隙間から、冷たい風'));
    } else if (at !== null) {
      // 出現型: 崩れているとき、装置の近く（奥の壁から 2.6 m）の穴の底へ落ちる
      const zone = F.rect(F.u0, F.depth - 2.6, F.u1, F.depth);
      const fell = ctx.addEntity('fellDeep', { type: 'fallSensor', params: { aabb: aabbJson({ min: [zone.x0, y - depth - 0.2, zone.z0], max: [zone.x1, y - 0.6, zone.z1] }), minSpeed: 2.0 } });
      const deep = ctx.addEntity('deep', { type: 'and', params: {}, inputs: { a: `${fell}.done`, b: `${floor}.active` } });
      const latch = ctx.addEntity('deepLatch', { type: 'latch', params: {}, inputs: { set: `${deep}.out` } });
      ctx.offerSecret({ hook: 'collapse.deep', modes: ['present', 'appear'], weight: 1.3, revealOutput: `${latch}.out`, doorway: { dir: far, at, y: y - depth, width: 1.0, height: 2.0 }, tell: '装置の下の床板の隙間から、冷たい風' });
    }
    ctx.keepOut({ min: [plan.hole.x0, y - depth, plan.hole.z0], max: [plan.hole.x1, y + 3, plan.hole.z1] });
  },
});
