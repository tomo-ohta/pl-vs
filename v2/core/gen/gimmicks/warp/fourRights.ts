/**
 * 4 回曲がっても戻らない（fourRights: W13）。部品は warpRing（塊のまわりを回った角度）と swapSet（見ていない間の差し替え）。
 *
 * 遊び方: 扉を開けると、部屋の真ん中を天井までの大きな塊が占め、まわりをぐるりと通路が囲む部屋。塊の 4 面には同じ額。
 * 右へ 4 回曲がって塊を 1 周すると、入ってきた扉のあった所がただの壁になっている（戻らない。外から開けようとしても鍵の音）。
 * 隠しが付いていれば、向かいの壁に見たことのない扉が現れる（出現型。現れる所は見えない）。
 * 左へ 1 周すれば来た扉は戻る（右へ何周しても左へ 1 周で戻る）。ほかの開口はいつでも使える（閉じ込めない）。
 * 差し替えは塊の陰で見えない間だけ（半周を越えたところで決まり、扉が見えない間に壁で埋まる）。
 */
import { WARP_TUNING } from '../../../config/tuning/warp.ts';
import type { Dir, Vec3 } from '../../../math/vec.ts';
import { box, DOOR_H, DOOR_W, WALL_T, type Json } from '../../../world/layout.ts';
import type { SwapBox } from '../../../sim/parts/warp/swap.ts';
import { defineGimmick } from '../types.ts';
import { freeWallSpan, innerRect } from '../util.ts';
import { ceilingLight, makeFrame } from './pocket.ts';

const sb = (min: number[], max: number[], mat: string, solid = true): SwapBox => ({ min, max, mat, solid });

defineGimmick({
  id: 'fourRights', name: '4 回曲がっても戻らない', axes: ['sight', 'move'], kinds: ['room'], minSize: [5.0, 5.0], weight: WARP_TUNING['warp.fourRights.weight'].default, intensity: 1,
  offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && s.openings.length >= 2 && s.cell.footprint.length === 1,
  build(ctx) {
    const s = ctx.slot;
    const t = ctx.tuning;
    const ent = s.entrance!;
    const door = ctx.doorAt(ent);
    // 来た扉に鍵を配線する（ほかの仕掛けがもう配線していたら置かない）
    if (!door || door.inputs?.lock || door.inputs?.open) return;
    const r = innerRect(s);
    const cw = t['warp.fourRights.ringM'];
    const blk = { x0: r.x0 + cw, z0: r.z0 + cw, x1: r.x1 - cw, z1: r.z1 - cw };
    if (blk.x1 - blk.x0 < 1.2 || blk.z1 - blk.z0 < 1.2) return;
    const y = s.cell.floorY, H = s.cell.height;
    // 開口の前の通路が塊でふさがらない（開口の前 1.2 m は通路の中）
    if (s.openings.some((o) => { const p = ctx.frontOf(o, 1.2); return p[0] > blk.x0 && p[0] < blk.x1 && p[2] > blk.z0 && p[2] < blk.z1; })) return;
    // 隠しの扉の置き場所: 来た扉の向かいの壁（なければ横の壁）の空いた所
    const opp: Dir[] = [((ent.dir + 2) % 4) as Dir, ((ent.dir + 1) % 4) as Dir, ((ent.dir + 3) % 4) as Dir];
    let sec: { dir: Dir; at: number } | null = null;
    for (const d of opp) { const sp = freeWallSpan(s, d, DOOR_W + 1.0, 1.0); if (sp) { sec = { dir: d, at: sp.at }; break; } }
    if (!sec) return;
    // 真ん中の塊（天井まで）と、4 面の額
    ctx.addBox(box([blk.x0, y, blk.z0], [blk.x1, y + H, blk.z1], s.cell.palette.wall));
    const cx = (blk.x0 + blk.x1) / 2, cz = (blk.z0 + blk.z1) / 2;
    for (const [x0, z0, x1, z1] of [[cx - 0.4, blk.z1, cx + 0.4, blk.z1 + 0.03], [cx - 0.4, blk.z0 - 0.03, cx + 0.4, blk.z0], [blk.x1, cz - 0.4, blk.x1 + 0.03, cz + 0.4], [blk.x0 - 0.03, cz - 0.4, blk.x0, cz + 0.4]] as const) {
      ctx.addBox(box([x0, y + 1.3, z0], [x1, y + 1.9, z1], 'woodPanel', false));
    }
    // 塊の上の照明は外し（塊の中に埋まる）、通路の 4 辺の真ん中の天井に付け直す
    const inBlk = (x: number, z: number): boolean => x > blk.x0 - 0.65 && x < blk.x1 + 0.65 && z > blk.z0 - 0.65 && z < blk.z1 + 0.65;
    ctx.removeBoxes((b) => !b.solid && b.mat === s.cell.palette.light && inBlk((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2));
    const had = s.cell.lights.length;
    s.cell.lights = s.cell.lights.filter((l) => !inBlk(l.pos[0], l.pos[2]));
    if (s.cell.lights.length < had || had === 0) {
      const f = makeFrame([0, y, 0], 0);
      for (const [x, z, alongX] of [[cx, (r.z0 + blk.z0) / 2, true], [cx, (r.z1 + blk.z1) / 2, true], [(r.x0 + blk.x0) / 2, cz, false], [(r.x1 + blk.x1) / 2, cz, false]] as const) {
        // makeFrame(fwd 0 = +z): u = z・v = x（左 = +x）
        ceilingLight(s.cell, f, z, x, H, !alongX, true, 0.6, 5);
      }
    }
    // 差し替え 0: 来た扉の穴を、こちら側の壁の厚みで埋める（無し / 有り）。面は壁の内面から 5 mm だけ手前（重なってちらつかない）
    const pos = ent.pos;
    const inner = ent.dir === 0 ? pos[2] - WALL_T : ent.dir === 2 ? pos[2] + WALL_T : ent.dir === 1 ? pos[0] - WALL_T : pos[0] + WALL_T;
    const sg = ent.dir === 0 || ent.dir === 1 ? 1 : -1; // 内面から外へ
    const n0 = inner - sg * 0.005, n1 = inner + sg * (WALL_T - 0.035);
    const [a0, a1] = [Math.min(n0, n1), Math.max(n0, n1)];
    const hw = ent.width / 2 + 0.01;
    const cover: SwapBox = ent.dir === 0 || ent.dir === 2
      ? sb([pos[0] - hw, y, a0], [pos[0] + hw, y + DOOR_H + 0.01, a1], s.cell.palette.wall)
      : sb([a0, y, pos[2] - hw], [a1, y + DOOR_H + 0.01, pos[2] + hw], s.cell.palette.wall);
    const region = (p: Vec3, dir: Dir): Json => {
      const c = ctx.frontOf({ ...ent, pos: [p[0], y, p[2]], dir }, 0.25);
      return { min: [c[0] - 0.7, y + 0.1, c[2] - 0.7], max: [c[0] + 0.7, y + 2.1, c[2] + 0.7] };
    };
    const secPos: Vec3 = sec.dir === 0 ? [sec.at, y, s.rect.z1] : sec.dir === 2 ? [sec.at, y, s.rect.z0] : sec.dir === 1 ? [s.rect.x1, y, sec.at] : [s.rect.x0, y, sec.at];
    const ringId = `${ctx.id}.ring`;
    // 差し替え 1: 箱は無く、見ていない間だけ 0 → 1 に変わる留め金（隠しの扉を現す合図。現れる所は見えない）
    const swap = ctx.addEntity('swap', {
      type: 'swapSet',
      params: {
        slots: [
          { region: region(pos, ent.dir), variants: [[], [cover]], init: 0 },
          { region: region(secPos, sec.dir), variants: [[], []], init: 0 },
        ] as unknown as Json,
        mode: 'input', minUnseen: 0.25, every: 2, sound: 'none',
      },
      inputs: { t0: `${ringId}.a`, t1: `${ringId}.n` },
    });
    ctx.addEntity('ring', {
      type: 'warpRing',
      params: { center: [cx, cz], door: door.id, box: { min: [r.x0, y - 0.5, r.z0], max: [r.x1, y + 3, r.z1] } },
      inputs: { a: `${swap}.v0` },
    });
    // 来た扉は、壁で埋めている間は開かない（外から開けても壁が重ならない。開けようとすると鍵の音）
    door.inputs = { ...(door.inputs ?? {}), lock: `${swap}.v0` };
    ctx.offerSecret({ hook: 'ring.right', modes: ['appear'], weight: t['warp.fourRights.secretWeight'], revealOutput: `${swap}.v1`, doorway: { dir: sec.dir, at: sec.at, y, width: 1.0, height: 2.0 }, tell: '右へ 1 周回ると、見たことのない扉' });
    ctx.noDress?.();
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + H, r.z1] });
  },
});
