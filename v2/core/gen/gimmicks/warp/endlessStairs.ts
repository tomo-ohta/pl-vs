/**
 * 終わらない階段（endlessStairs: W14。階段の数）。部品は warpStairs。
 *
 * 遊び方: 控え室のもう 1 枚の扉の先は、折り返し階段の階段室の踊り場（扉の横に階の札）。上ると同じ扉・同じ札の踊り場に着く。
 * もう 1 階上っても、また同じ札（上っても上っても同じ踊り場）。goal 回上ると、次の踊り場の札が 1 つ上の階になり、扉の先は最初の部屋の双子
 * （元の部屋へ戻る扉がある）。下りれば、上った回数だけ下りたところで来た扉に着く（閉じ込めない）。150 秒で必ず上へ抜けられる。
 *
 * 作り（局所の座標 u: もう 1 枚の扉の外向き = 上りの向き、v: 左）: 1 つの区画に 4 階ぶん（高さ rise = 3 m）を積む。
 * 階ごとに 踊り場 L（扉の壁の前）→ 右の段（v < 0）を前へ 1.5 m 上る → 中の踊り場 M → 左の段（v > 0）を後ろへ 1.5 m 上る → 次の階の L。
 * 右と左の段の間は壁（吹き抜けなし）なので、段の途中から見えるのは上下 1 階ぶんだけ。2 階目の右の段の途中で 1 階ぶん下へ移す（真下へ
 * ずらすだけ。箱は uvFrame で 1 階目と同じ模様にする）。一番上の階の扉の先が、最初の部屋の真上（9 m 上）の双子の部屋
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import { opening } from '../../../world/build.ts';
import { box, DOOR_W, WALL_T, type Box, type MatId, type Palette, type WallOpening } from '../../../world/layout.ts';
import { themePalette } from '../../../world/palettes.ts';
import { familyById } from '../../floor/themes.ts';
import { defineGimmick } from '../types.ts';
import { attachToPod, buildAnteroom, anteroomFits, planAnteroom } from './anteroom.ts';
import { addPocketCell, axisOf, carveDoorway, doorSpec, makeFrame, pocketCell, safePalette, splitAt } from './pocket.ts';

const STEPS = 9, TREAD = 0.28, LD = 1.6, LM = 1.6, LANE = 1.3, SEP = 0.15, SLAB = 0.2, STEP_T = 0.45;

defineGimmick({
  id: 'endlessStairs', name: '階段の数', axes: ['move', 'sight'], kinds: ['room'], minSize: [3.8, 3.8], weight: WARP_TUNING['warp.stairs.weight'].default, intensity: 1,
  fits: (s) => anteroomFits(s),
  onMainPath: true,
  build(ctx) {
    const t = ctx.tuning;
    const plan = planAnteroom(ctx);
    if (!plan) return;
    const ante = buildAnteroom(ctx, plan);
    const R1 = ante.entry;
    const f = makeFrame(R1.podOut.pos, plan.pod.dir);
    const y0 = R1.cell.floorY;
    const rise = 3, floors = 4;
    const W = 2 * LANE + SEP + 2 * WALL_T;
    const run = STEPS * TREAD, len = LD + run + LM;
    // 天井: 一番上の階の中の踊り場の上の床（ほかの階の M の上と同じ高さ）の上
    const height = floors * rise + rise / 2 + 0.1;
    const fam = familyById(ctx.floor.family);
    const base = themePalette(fam.corridor);
    // 壁は 1 m の模様（真下へ 3 m ずらしても揃う）。床・天井は真下へずらすだけなので何でもよい
    const pal: Palette = { ...safePalette(base), wall: ['wallBeige', 'wallWhite', 'wallCream', 'wallGreen'].includes(base.wall) ? base.wall : 'wallCream', fog: 0x08090a };
    const id = `${plan.host.id}~stairs`;
    const vA0 = -W / 2 + WALL_T, vA1 = -SEP / 2, vB0 = SEP / 2, vB1 = W / 2 - WALL_T;
    // 扉の壁（u = 0）: 階ごとの扉の開口
    const ops: WallOpening[] = [];
    for (let k = 0; k < floors; k++) ops.push(opening(`${id}:f${k}`, f.p(0, k * rise, 0), f.dir(2)));
    // 同じ壁に高さの違う扉の穴を重ねる（外壁の作り方は 1 つの壁の穴を縦に重ねられないので、壁を作ってから穴を切る）
    const cell = pocketCell({ id, pocket: ctx.id, rects: [f.rect(0, -W / 2, len, W / 2)], height, floorY: y0, palette: pal, openings: [], theme: fam.corridor, name: '階段室', materialKey: `${ctx.id}:stairs`, audio: fam.corridorAudio });
    for (const o of ops) carveDoorway(cell, o.pos, o.dir);
    // 1 階ぶん（k = 0 の形）を作り、各階へ真下からずらして写す（模様は 0 階と同じ。0 階だけは段の下を埋める）
    const storey = (k: number): Box[] => {
      const B: Box[] = [];
      const yb = k * rise;
      // kind: 段は 'stairStep'・踊り場は 'landing'（歩く人の道探しが段の上面を足場として見る。geometry.ts の階段と同じ）
      const P = (u0: number, a0: number, v0: number, u1: number, a1: number, v1: number, mat: MatId, solid = true, kind?: string): void => { const b = f.box(u0, a0, v0, u1, a1, v1, mat, solid); if (kind) b.kind = kind; B.push(b); };
      const r = rise / 2 / STEPS;
      if (k > 0) P(0, yb - SLAB, -W / 2 + WALL_T, LD, yb, W / 2 - WALL_T, pal.floor, true, 'landing');
      const top = k === floors - 1;
      // 一番上の階の上にも、ほかの階と同じ高さに踊り場の床の裏（天井）を付ける（見える範囲の形と照明をどの階も同じにする）
      if (top) {
        P(0, yb + rise - SLAB, -W / 2 + WALL_T, LD, yb + rise, W / 2 - WALL_T, pal.floor);
        P(LD + run, yb + rise + rise / 2 - SLAB, -W / 2 + WALL_T, len - WALL_T, yb + rise + rise / 2, W / 2 - WALL_T, pal.floor);
      }
      for (let i = 0; i < STEPS; i++) {
        const ya = yb + (i + 1) * r;
        P(LD + i * TREAD, k === 0 ? 0 : ya - STEP_T, vA0, LD + (i + 1) * TREAD, ya, vA1, pal.floor, true, 'stairStep');
        // 一番上の階の左の段は無い（上の階は無い）
        if (top) continue;
        const yB = yb + rise / 2 + (i + 1) * r;
        P(LD + run - (i + 1) * TREAD, k === 0 ? 0 : yB - STEP_T, vB0, LD + run - i * TREAD, yB, vB1, pal.floor, true, 'stairStep');
      }
      P(LD + run, k === 0 ? 0 : yb + rise / 2 - SLAB, -W / 2 + WALL_T, len - WALL_T, yb + rise / 2, W / 2 - WALL_T, pal.floor, true, 'landing');
      // 手すり（外の壁沿い・段の上 0.9 m。傾けた箱 Box.slope。当たらない）: u の a 側の高さ ya から b 側の高さ yb2 へ
      const rail = (ua: number, ya: number, ub: number, yb2: number, v0: number, v1: number): void => {
        const box0 = f.box(Math.min(ua, ub), 0, v0, Math.max(ua, ub), 0.06, v1, 'handrailWood', false);
        const ax: 0 | 2 = Math.abs(box0.max[0] - box0.min[0]) > Math.abs(box0.max[2] - box0.min[2]) ? 0 : 2;
        // 低い端の箱: 軸の小さい側（min）の高さを元に、反対側までの高さの差を rise に
        const pa = f.p(ua, 0, 0)[ax], pb = f.p(ub, 0, 0)[ax];
        const yMin = pa < pb ? ya : yb2, yMax = pa < pb ? yb2 : ya;
        box0.min[1] = yMin + 0.86; box0.max[1] = yMin + 0.92;
        box0.slope = { axis: ax === 0 ? 'x' : 'z', rise: yMax - yMin };
        B.push(box0);
      };
      rail(LD, yb, LD + run, yb + rise / 2, vA0, vA0 + 0.05);
      if (!top) rail(LD + run, yb + rise / 2, LD, yb + rise, vB1 - 0.05, vB1);
      // 右と左の段の間の壁（この階の床から次の階の床まで）
      P(LD, yb, vA1, LD + run, yb + rise, vB0, pal.wall);
      // 照明: 踊り場 L の天井（次の階の床の裏）・中の踊り場 M の天井（次の階の M の裏）
      const lamp = (u: number, yy: number): void => {
        const a = f.aabb(u - 0.3, yy - 0.04, -0.6, u + 0.3, yy - 0.005, 0.6);
        B.push(box(a.min, a.max, pal.light, false));
        const c = f.p(u, yy - 0.4, 0);
        cell.lights.push({ pos: c, color: pal.lightColor, intensity: pal.lightIntensity * 0.75, distance: 5 });
      };
      lamp(LD / 2, yb + rise - SLAB);
      lamp(LD + run + LM / 2, yb + rise + rise / 2 - SLAB);
      return B;
    };
    // 外の壁を階の境目で切り、1 階より上の壁の模様を 0 階と同じ基準にする（どの階も箱の分け方と模様が同じ）
    splitAt(cell, 1, Array.from({ length: floors }, (_, k) => y0 + (k + 1) * rise));
    for (const b of cell.boxes) {
      const k = Math.floor((b.min[1] - y0 + 1e-6) / rise);
      if (k > 0 && k < floors) b.uvFrame = { offset: [0, k * rise, 0], q: 0 };
    }
    for (let k = 0; k < floors; k++) {
      const bs = storey(k);
      for (const b of bs) if (k > 0) b.uvFrame = { offset: [0, k * rise, 0], q: 0 };
      cell.boxes.push(...bs);
    }
    // 一番上の中の踊り場の先（左の段の所）は壁で行き止まり（上の階の段は無い）
    cell.boxes.push(f.box(LD, (floors - 1) * rise + rise / 2, vB0, LD + run, height, vB1, pal.wall));
    addPocketCell(ctx, cell, 'stairs', ops);
    attachToPod(ctx, R1, id);
    // 階の扉と札: 0 階は来た扉（R' の扉）、1・2 階は開かない扉、3 階（一番上）は出口（最初の部屋の真上の双子の部屋）
    const doorMat = (plan.a.door.params.mat as MatId | undefined) ?? pal.door;
    const here = `B${ctx.floor.depth + 1}F`, upper = ctx.floor.depth > 0 ? `B${ctx.floor.depth}F` : '1F';
    for (let k = 0; k < floors; k++) {
      const pos = f.p(0, k * rise, 0), axis = axisOf(f.dir(2));
      if (k > 0 && k < floors - 1) ctx.addEntity(`fake${k}`, { ...doorSpec(axis, axis === 'x' ? pos[0] : pos[2], axis === 'x' ? pos[2] : pos[0], pos[1], doorMat, { locked: true, autoCloseSec: 0, hinge: (plan.a.door.params.hinge as number) ?? 1 }), cell: id });
      const sp = f.p(WALL_T + 0.02, k * rise + 1.55, DOOR_W / 2 + 0.45);
      ctx.addEntity(`sign${k}`, { type: 'warpSign', cell: id, params: { pos: sp, dir: f.dir(0), w: 0.42, h: 0.24, lines: [k === floors - 1 ? upper : here], style: 'plate' } });
    }
    const Q = ante.addCopy({ from: [0, 0, 0], to: [0, plan.rise + (floors - 1) * rise, 0], q: 0 }, 'sq');
    attachToPod(ctx, Q, id);
    // 上の面: 2 階の右の段の途中（前へ上る）。下の面: 1 階の右の段の途中（後ろへ下る）
    const mid = LD + run / 2;
    const gate = (k: number, local: 0 | 2) => {
      const c = f.p(mid, k * rise, (vA0 + vA1) / 2);
      const a = f.aabb(LD, k * rise - 0.2, vA0, LD + run, k * rise + rise / 2 + 2.2, vA1);
      return { center: c, dir: f.dir(local), box: { min: [...a.min], max: [...a.max] } };
    };
    const area = f.aabb(0, -0.5, -W / 2, len, height, W / 2);
    ctx.addEntity('stairs', { type: 'warpStairs', cell: id, params: { up: gate(2, 0), down: gate(1, 2), rise, goal: t['warp.stairs.goal'], giveUpSec: t['warp.stairs.giveUpSec'], area: { min: [...area.min], max: [...area.max] } } });
    ante.finish();
  },
});
