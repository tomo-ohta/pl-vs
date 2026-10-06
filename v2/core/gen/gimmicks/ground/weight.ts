/**
 * 重りの床（weightBridge）[QR 天秤 G10]: 部屋を横切る溝の底に、重い鉄の床板が沈んでいる。手前の「重りの印」（黄色と黒の縁の板）に
 * 重さが載っている間だけ、床板が溝の縁までせり上がって橋になる。印から降りると、少しして沈む。
 * - 解き方は 2 つ: 印に乗ってから走って渡る（歩くと間に合わず、沈む床板と一緒に溝の底へ）/ 近くの重い箱を押して印に載せる（ずっと上がったまま）
 * - 溝の上は下がり天井（走って跳んでも越えられない）。落ちたら溝の階段で手前へ。箱は戻すボタンで戻る
 * - 帰り道: 向こう岸のボタンで、しばらく床板が上がる（出口の側から来た人）
 * - 行き止まりの部屋では、向こう岸の奥の壁に隠しの扉（weight.across: 存在型 / 出現型 = 向こう岸に渡ると現れる）
 */
import type { Dir } from '../../../math/vec.ts';
import { box, type Json } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { aabbJson } from '../util.ts';
import { botHint, buildTrench, enterAt, entranceFrame, onRectWall, planTrench, snap, soffit } from './common.ts';

defineGimmick({
  id: 'weightBridge', name: '重りの床', axes: ['floor', 'puzzle'], kinds: ['room', 'hall'], minSize: [5.0, 6.4], minHeight: 2.4, weight: 1.1, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && (s.openings.length === 1 || (!!s.exit && s.exit.dir === (s.entrance.dir + 2) % 4)),
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const y = s.cell.floorY;
    const ent = s.entrance!;
    const ex = s.openings.length === 1 ? null : s.exit!;
    if (!s.openings.every((o) => onRectWall(s, o))) return;
    const F = entranceFrame(s);
    const W = t['ground.weight.trenchM'], depth = t['ground.weight.depthM'];
    // 手前: 重りの印の行（入口の壁沿い 0.1〜1.3 m。入口の扉の前からは横へずらす）+ 印から溝の縁まで 1.7 m（印に乗ったまま床板には乗れない）
    const vt0 = 3.0, vt1 = vt0 + W;
    if (F.depth - vt1 < (ex ? 1.6 : 1.3)) return;
    for (const o of s.openings) if (o !== ent && o !== ex && F.v(o.pos[0], o.pos[2]) > vt0 - 1.4) return;
    const ue = ex ? F.u(ex.pos[0], ex.pos[2]) : (F.u0 + F.u1) / 2;
    // 床板の列（u = up）・その手前の重りの印（同じ列）・印の横の箱（up + side × 1.2。外側から印の方へ押す）の置き方を、出口に近い順に試す。
    // 印に乗ってから床板へまっすぐ走れば渡れる（箱は横なので邪魔にならない）。印・箱・箱を押す所は入口の扉の前を塞がない。
    // 溝の階段は床板の列から遠い方の端（床板が階段に当たらない）
    const PW = 1.2, c = 1.2;
    const uEnt = F.u(ent.pos[0], ent.pos[2]);
    type Lay = { up: number; side: -1 | 1; uPlate: number; uCrate: number; plan: NonNullable<ReturnType<typeof planTrench>> };
    let lay: Lay | null = null;
    const cands: number[] = [];
    for (let u = F.u0 + 0.8 + PW / 2; u <= F.u1 - 0.8 - PW / 2 + 1e-6; u += 0.3) cands.push(snap(u));
    cands.sort((a, b) => Math.abs(a - ue) - Math.abs(b - ue));
    for (const up of cands) {
      for (const side of [up - F.u0 > F.u1 - up ? -1 : 1, up - F.u0 > F.u1 - up ? 1 : -1] as (-1 | 1)[]) {
        const uPlate = up, uCrate = up + side * c;
        if (uCrate - c / 2 < F.u0 + 0.15 || uCrate + c / 2 > F.u1 - 0.15 || uCrate + side * 1.4 < F.u0 + 0.3 || uCrate + side * 1.4 > F.u1 - 0.3) continue;
        if ([uPlate, uCrate, uCrate + side * 1.15].some((u) => Math.abs(u - uEnt) < c / 2 + ent.width / 2 + 0.2)) continue;
        const stairSide: -1 | 1 = up - F.u0 > F.u1 - up ? -1 : 1;
        const plan = planTrench(ctx, { v0: vt0, v1: vt1, depth, stairSide });
        if (!plan) continue;
        const st = [F.u(plan.stairs.x0, plan.stairs.z0), F.u(plan.stairs.x1, plan.stairs.z1)].sort((a, b) => a - b) as [number, number];
        if (up - PW / 2 < st[1] + 0.4 && up + PW / 2 > st[0] - 0.4) continue;
        lay = { up, side, uPlate, uCrate, plan };
        break;
      }
      if (lay) break;
    }
    if (!lay) return;
    const { up, side, uPlate, uCrate, plan } = lay;
    buildTrench(ctx, plan);
    soffit(ctx, F.rect(F.u0, vt0 - 0.8, F.u1, vt1 + 0.8), t['ground.weight.soffitM']);
    // 床板（溝の底 → 縁の高さ）
    const pr = F.rect(up - PW / 2, vt0 + 0.02, up + PW / 2, vt1 - 0.02);
    const plat = { min: [pr.x0, y - depth, pr.z0], max: [pr.x1, y - depth + 0.2, pr.z1] };
    const vPlate = 0.1 + c / 2;
    const plateR = F.rect(uPlate - c / 2 + 0.05, vPlate - c / 2 + 0.05, uPlate + c / 2 - 0.05, vPlate + c / 2 - 0.05);
    ctx.addBox(box([plateR.x0, y, plateR.z0], [plateR.x1, y + 0.02, plateR.z1], 'metalDark', false));
    for (const [a0, b0, a1, b1] of [[0, 0, 1, 0.08], [0, 0.92, 1, 1], [0, 0, 0.08, 1], [0.92, 0, 1, 1]] as const) {
      const r = F.rect(uPlate - c / 2 + 0.05 + a0 * (c - 0.1), vPlate - c / 2 + 0.05 + b0 * (c - 0.1), uPlate - c / 2 + 0.05 + a1 * (c - 0.1), vPlate - c / 2 + 0.05 + b1 * (c - 0.1));
      ctx.addBox(box([r.x0, y + 0.02, r.z0], [r.x1, y + 0.025, r.z1], 'yellowLine', false));
    }
    // 箱の升目: 箱の升と印の升の 1 行（箱は印へ押すか、床板の列の方へ戻すだけ）
    const g0 = F.rect(Math.min(uCrate, uPlate) - c / 2, vPlate - c / 2, Math.max(uCrate, uPlate) + c / 2, vPlate + c / 2);
    const alongX = F.d % 2 === 0;
    const nx = alongX ? 2 : 1, nz = alongX ? 1 : 2;
    const rows: string[] = [];
    for (let k = 0; k < nz; k++) rows.push('.'.repeat(nx));
    const grid = { x0: g0.x0, z0: g0.z0, c, rows };
    const ik = (u: number, v: number): [number, number] => { const p = F.point(u, v); return [Math.floor((p[0] - g0.x0) / c), Math.floor((p[1] - g0.z0) / c)]; };
    const crateStart = ik(uCrate, vPlate);
    const reset = ctx.addEntity('reset', { type: 'button', params: { box: (() => { const p = F.point(Math.min(F.u1 - 0.3, Math.max(F.u0 + 0.3, F.u(ent.pos[0], ent.pos[2]) + (side < 0 ? -1.0 : 1.0))), 0.04); return aabbJson({ min: [p[0] - 0.1, y + 1.05, p[1] - 0.1], max: [p[0] + 0.1, y + 1.3, p[1] + 0.1] }); })(), mat: 'plasticYellow' } });
    const crateId = `${ctx.id}.crate`;
    ctx.addEntity('crate', { type: 'crate', params: { grid, start: crateStart, half: c / 2 - 0.08, h: 0.9, y, peers: [crateId], mat: 'metalDark', weight: 1, slideSec: 0.5 }, inputs: { reset: `${reset}.pressed` } });
    const plateId = ctx.addEntity('plate', { type: 'loadPlate', params: { aabb: aabbJson({ min: [plateR.x0, y - 0.1, plateR.z0], max: [plateR.x1, y + 1.0, plateR.z1] }), crates: [crateId], need: 1 } });
    // 帰り道のボタン（向こう岸）・床板を上げる配線（印に重さ / ボタンから 6 秒）。降りてから holdSec 秒で沈む
    const inputs: string[] = [`${plateId}.pressed`];
    let farBtn: string | null = null;
    let farStand: [number, number] | null = null, farAt: [number, number] | null = null;
    if (ex) {
      const bu = Math.min(Math.max(up - side * 1.3, F.u0 + 0.3), F.u1 - 0.3);
      farAt = F.point(bu, vt1 + 0.9);
      farStand = F.point(bu, vt1 + 1.7);
      ctx.addBox(box([farAt[0] - 0.08, y, farAt[1] - 0.08], [farAt[0] + 0.08, y + 0.95, farAt[1] + 0.08], 'metalDark'));
      farBtn = ctx.addEntity('farButton', { type: 'button', params: { box: aabbJson({ min: [farAt[0] - 0.11, y + 0.95, farAt[1] - 0.11], max: [farAt[0] + 0.11, y + 1.12, farAt[1] + 0.11] }), mat: 'plasticRed', range: 1.6, solid: true } });
      const hold = ctx.addEntity('farHold', { type: 'timer', params: { onDelay: 0, offDelay: t['ground.weight.buttonSec'] }, inputs: { in: `${farBtn}.pressed` } });
      inputs.push(`${hold}.out`);
    }
    const want = ctx.addEntity('want', { type: 'timer', params: { onDelay: 0, offDelay: t['ground.weight.holdSec'] }, inputs: { in: { from: inputs } } });
    const plank = ctx.addEntity('platform', { type: 'mover', params: { box: aabbJson({ min: [plat.min[0]!, plat.min[1]!, plat.min[2]!], max: [plat.max[0]!, plat.max[1]!, plat.max[2]!] }), mat: 'metal', points: [[0, 0, 0], [0, depth - 0.2, 0]], speed: t['ground.weight.speed'] }, inputs: { target: `${want}.out` } });
    const upOut = ctx.addEntity('up', { type: 'threshold', params: { min: 0.98 }, inputs: { in: `${plank}.t` } });
    // 渡れた（向こう岸に入った）
    const zr = F.rect(F.u0, vt1 + 0.3, F.u1, Math.min(F.depth, vt1 + 1.4));
    const crossed = ctx.addEntity('crossedZone', { type: 'zoneSensor', params: { aabb: aabbJson({ min: [zr.x0, y - 0.1, zr.z0], max: [zr.x1, y + 2, zr.z1] }) } });
    const latch = ctx.addEntity('crossed', { type: 'latch', params: {}, inputs: { set: `${crossed}.in` } });
    // 歩く人: 箱を印へ押してから、床板が上がるのを待つ / 向こうからはボタン
    const cs = F.point(uCrate + side * (c - 0.05), vPlate), cc = F.point(uCrate, vPlate);
    const hints: Json[] = [botHint([{ at: [cs[0], y, cs[1]], look: [cc[0], y + 0.5, cc[1]], wait: 1.0, until: `${upOut}.out` }], { enterAt: enterAt(ent), doneIf: `${plateId}.crateLoad` })];
    if (ex && farStand && farAt) hints.push(botHint([{ at: [farStand[0], y, farStand[1]], look: [farAt[0], y + 1.04, farAt[1]], wait: 0.5, until: `${upOut}.out` }], { enterAt: enterAt(ex) }));
    ctx.addEntity('hints', { type: 'constant', params: { value: 0, bot: hints } });
    if (!ex) {
      const fd = ((F.d + 2) % 4) as Dir;
      const p = F.point(up, F.depth);
      ctx.offerSecret({ hook: 'weight.across', modes: ['present', 'appear'], weight: 1.0, revealOutput: `${latch}.out`, doorway: { dir: fd, at: fd % 2 === 0 ? p[0] : p[1], y, width: 1.0, height: 2.0 }, tell: '溝の底の床板に、向こうの壁の扉の形の錆' });
    }
    const keep = F.rect(F.u0, 0, F.u1, F.depth);
    ctx.keepOut({ min: [keep.x0, y - depth, keep.z0], max: [keep.x1, y + 3, keep.z1] });
  },
});
