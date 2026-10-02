/**
 * 閉じた輪の廊下（loopHall: W06・BX02）。
 *
 * 遊び方: 部屋の 3 枚目の扉（ほかの扉が閉じているときだけ開く。控え室 anteroom.ts）の向こうに、まっすぐな長い廊下。
 * 歩いても歩いても、同じ椅子・同じ扉・同じ照明が 12 m ごとにくり返す（霧で先は見えない）。前へ lapsOut 周すると輪がほどけ、
 * 廊下の奥の扉が霧の中から現れる。開けると、最初の部屋（の双子）に出る — まっすぐ進んだのに元の場所に戻っている。
 * 1 周したあとは後ろへ戻っても輪の中（輪が閉じる）。後ろへ lapsBack 周すると後ろの輪がほどけ、廊下の入口の壁に隠しの扉が現れる（BX02）。
 * 閉じ込めない: 輪が閉じる前は来た扉へ戻れる。giveUpSec 秒で前も後ろもほどける。双子の部屋の扉はいつでも元の部屋へ戻す。
 *
 * 作り: 廊下は 1 つの区画（別の空間）。くり返す所の外の霧（render.fog）で、戻される前と後の見える範囲がまったく同じになる
 * （前の面 front から period 戻すとき、[front − period − 霧, front + 霧] がくり返しの中）。部品は warpTreadmill。
 */
import { DOOR_H, DOOR_W, WALL_T, type CellLayout, type MatId, type WallOpening } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import { familyById } from '../../floor/themes.ts';
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import { opening } from '../../../world/build.ts';
import { defineGimmick } from '../types.ts';
import { attachToPod, buildAnteroom, planAnteroom } from './anteroom.ts';
import { addPocketCell, axisOf, ceilingLight, doorSpec, makeFrame, pocketCell, safePalette, splitAlong, type Frame } from './pocket.ts';

/** 区画の箱を、局所の座標で足す */
const put = (cell: CellLayout, f: Frame, u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, mat: MatId, solid = true): void => {
  cell.boxes.push(f.box(u0, y0, v0, u1, y1, v1, mat, solid));
};

/** くり返しの 1 つ分の物（u0 から period）。左右の壁の内側は ±(W/2 − 壁) */
function period(cell: CellLayout, f: Frame, u0: number, W: number, H: number): void {
  const iw = W / 2 - WALL_T;
  for (const du of [1.5, 4.5, 7.5, 10.5]) ceilingLight(cell, f, u0 + du, 0, H, true, du === 1.5 || du === 7.5, 1, 6);
  // 長椅子（左の壁際）
  put(cell, f, u0 + 5.2, 0, iw - 0.42, u0 + 6.8, 0.4, iw, 'metalDark');
  put(cell, f, u0 + 5.2, 0.4, iw - 0.45, u0 + 6.8, 0.46, iw, 'noticeGreen');
  // 壁を向いた椅子（右の壁際。くり返すたびに同じ椅子がある）
  const cu = u0 + 6.0, cv = -iw + 0.3;
  put(cell, f, cu - 0.22, 0, cv - 0.22, cu - 0.18, 0.45, cv - 0.18, 'metal');
  put(cell, f, cu + 0.18, 0, cv - 0.22, cu + 0.22, 0.45, cv - 0.18, 'metal');
  put(cell, f, cu - 0.22, 0, cv + 0.18, cu - 0.18, 0.45, cv + 0.22, 'metal');
  put(cell, f, cu + 0.18, 0, cv + 0.18, cu + 0.22, 0.45, cv + 0.22, 'metal');
  put(cell, f, cu - 0.24, 0.45, cv - 0.24, cu + 0.24, 0.5, cv + 0.24, 'plasticBlue');
  put(cell, f, cu - 0.24, 0.5, cv - 0.24 - 0.0, cu + 0.24, 0.95, cv - 0.2, 'plasticBlue');
  // 掲示（右の壁）と、床の線
  put(cell, f, u0 + 2.6, 1.1, -iw, u0 + 3.4, 1.9, -iw + 0.02, 'signPlate', false);
  put(cell, f, u0 + 2.7, 1.2, -iw + 0.02, u0 + 3.3, 1.5, -iw + 0.03, 'plasticRed', false);
  put(cell, f, u0, 0, -0.04, u0 + 12, 0.004, 0.04, 'yellowLine', false);
}

defineGimmick({
  id: 'loopHall', name: '閉じた輪の廊下', axes: ['move', 'sight'], kinds: ['room'], minSize: [3.8, 3.8], weight: WARP_TUNING['warp.loopHall.weight'].default, intensity: 1,
  offersSecret: true, onMainPath: true,
  build(ctx) {
    const t = ctx.tuning;
    const plan = planAnteroom(ctx);
    if (!plan) return;
    const ante = buildAnteroom(ctx, plan);
    const P = t['warp.loopHall.periodM'], F = t['warp.loopHall.fogFarM'];
    // くり返しは、戻す前と後の見える範囲（霧まで）が両方くり返しの中に入る数（(M − 1)·P ≥ 2·霧）
    const M = Math.max(t['warp.loopHall.periods'], Math.ceil((2 * F) / P) + 1);
    const W = t['warp.loopHall.widthM'], H = t['warp.loopHall.heightM'];
    const a0 = 4, endLen = 4;
    const Lh = a0 + M * P + endLen;
    const R1 = ante.entry;
    const f = makeFrame(R1.podOut.pos, plan.pod.dir);
    const y = R1.cell.floorY;
    const fam = familyById(ctx.floor.family);
    const pal = safePalette({ ...themePalette(fam.corridor), fog: 0x07080a });
    const id = `${plan.host.id}~hall`;
    const ops: WallOpening[] = [opening(`${id}:in`, f.p(0, 0, 0), f.dir(2), DOOR_W, DOOR_H), opening(`${id}:out`, f.p(Lh, 0, 0), f.dir(0), DOOR_W, DOOR_H)];
    // 飾りの扉（くり返しごとに左右 1 枚ずつ。開かない）
    const doorMat: MatId = pal.door;
    const fakes: { u: number; v: number; side: 1 | 3; name: string }[] = [];
    for (let k = 0; k < M; k++) {
      fakes.push({ u: a0 + k * P + 3, v: W / 2, side: 1, name: `fake${k}l` });
      fakes.push({ u: a0 + k * P + 9, v: -W / 2, side: 3, name: `fake${k}r` });
    }
    for (const fk of fakes) ops.push(opening(`${id}:${fk.name}`, f.p(fk.u, 0, fk.v), f.dir(fk.side), DOOR_W, DOOR_H));
    const cell = pocketCell({ id, pocket: ctx.id, rects: [f.rect(0, -W / 2, Lh, W / 2)], height: H, floorY: y, palette: pal, openings: ops, theme: fam.corridor, name: '廊下', materialKey: `${ctx.id}:hall`, audio: fam.corridorAudio });
    cell.render = { fog: { color: pal.fog, near: 1.5, far: F } };
    for (const fk of fakes) {
      const pos = f.p(fk.u, 0, fk.v), dir = f.dir(fk.side), axis = axisOf(dir);
      ctx.addEntity(fk.name, { ...doorSpec(axis, axis === 'x' ? pos[0] : pos[2], axis === 'x' ? pos[2] : pos[0], y, doorMat, { locked: true, autoCloseSec: 0 }), cell: id });
    }
    // 入口の所（くり返しの外）・くり返し・奥の所
    ceilingLight(cell, f, 1.6, 0, H, true, true, 0.8, 6);
    for (let k = 0; k < M; k++) period(cell, f, a0 + k * P, W, H);
    ceilingLight(cell, f, Lh - 2.2, 0, H, true, true, 0.8, 6);
    // 奥の扉の上の非常口の灯り
    put(cell, f, Lh - WALL_T - 0.05, DOOR_H + 0.12, -0.25, Lh - WALL_T, DOOR_H + 0.26, 0.25, 'lightGreen', false);
    // 床・天井・壁をくり返しの切れ目で切る（くり返しごとに箱の分け方を同じにする。入口の所の隠しの穴が、くり返しの壁を切らない）
    splitAlong(cell, f, Array.from({ length: M + 1 }, (_, k) => a0 + k * P));
    addPocketCell(ctx, cell, 'corridor', ops);
    attachToPod(ctx, R1, id);
    // 奥の扉の先: 最初の部屋の双子（pod を廊下の奥の扉に重ねる。向きは逆）
    const Q = ante.addCopy({ from: plan.pod.pos, to: f.p(Lh, 0, 0), q: 2 }, 'a2');
    attachToPod(ctx, Q, id);
    const tread = ctx.addEntity('loop', {
      type: 'warpTreadmill', cell: id,
      params: {
        origin: f.p(0, 0, 0), fwd: plan.pod.dir,
        box: (() => { const a = f.aabb(0.2, -0.5, -W / 2, Lh - 0.2, 3.0, W / 2); return { min: [...a.min], max: [...a.max] }; })(),
        period: P, front: a0 + M * P - F, back: a0 + F,
        lapsOut: t['warp.loopHall.lapsOut'], lapsBack: t['warp.loopHall.lapsBack'], giveUpSec: t['warp.loopHall.giveUpSec'],
      },
    });
    // 隠し（BX02）: 後ろの輪をほどくと、入口の所の左の壁に扉が現れる（出現型）
    const sd = f.dir(1);
    const sp = f.p(2.4, 0, W / 2);
    ctx.offerSecret({ hook: 'loop.backward', modes: ['appear'], weight: t['warp.loopHall.secretWeight'], revealOutput: `${tread}.back`, doorway: { dir: sd, at: axisOf(sd) === 'x' ? sp[2] : sp[0], y, width: 1.0, height: 2.0 }, cell: id, tell: '入口の壁だけ、霧が薄い' });
    ante.finish();
  },
});
