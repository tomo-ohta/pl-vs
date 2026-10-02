/**
 * 椅子の部屋（2 種）。椅子は持てる物（当たらない。通り道を塞がない）。
 *
 * - chairRoom 椅子を戻す [QR I04] + BI04 椅子を全部どかす → 床下収納:
 *     机の並んだ部屋に、椅子があちこちに散らばっている（向きもばらばら）。机の後ろの床に椅子の位置の印。
 *     遊び方: 椅子を拾って印に置く（吸い付いて机の方を向く）。全部そろうとチャイム（片付いた合図。報酬ではない）。
 *     隠し: 椅子を全部、部屋の外へ運び出す → 壁際の床の蓋が沈んで床下収納が開き、階段の下の壁に扉（存在型）
 * - alignChairs 向きのそろわない椅子 + BI05 物を全部同じ向きにそろえる → 壁の一部がずれる:
 *     待合室に椅子が並ぶが、向きがばらばら（1 脚だけ壁を向いている、など）。置くと持っていた人と同じ向きに置かれる。
 *     隠し（出現型）: 部屋の椅子を全部同じ向きにそろえると、壁の一部がずれて扉が現れる
 */
import type { Dir, Vec3 } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type MatId } from '../../../world/layout.ts';
import { defineGimmick } from '../types.ts';
import { doorZone, innerRect } from '../util.ts';
import { buildHatch, hatchSecret, planHatch } from './hatch.ts';
import { aabbJ, addItem, floorSpots, freeSpans, offer, onMainWall, snap } from './util.ts';

const CHAIR_HALF: Vec3 = [0.22, 0.43, 0.22];
const CHAIR_MATS: MatId[] = ['woodPanel', 'seatBlue', 'furnitureLight', 'plasticRed'];
const yawOfDir = (d: Dir): number => [Math.PI, -Math.PI / 2, 0, Math.PI / 2][d]!;

defineGimmick({
  id: 'chairRoom', name: '椅子を戻す', axes: ['carry'], kinds: ['room', 'hall'], minSize: [5.4, 6.4], weight: 0.4, intensity: 1, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    const plan = planHatch(ctx);
    if (!plan) return;
    const H = plan.hole;
    // 机の並び: 部屋の真ん中（床の蓋・開口の前を避ける）。机は前（黒板の壁）を向く
    const front = ((s.entrance!.dir + 2) % 4) as Dir;
    const faceYaw = yawOfDir(front);
    const fx = -Math.sin(faceYaw), fz = -Math.cos(faceYaw);
    const zones = s.openings.map((o) => doorZone(o, y, 1.6, 0.5));
    const desks: Rect[] = [];
    const slots: { pos: number[]; r: number; yaw: number; accept: string[] }[] = [];
    const nx = Math.floor((r.x1 - r.x0 - 1.6) / 1.4), nz = Math.floor((r.z1 - r.z0 - 1.6) / 1.6);
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const cx = snap(r.x0 + 0.8 + (i + 0.5) * ((r.x1 - r.x0 - 1.6) / nx)), cz = snap(r.z0 + 0.8 + (k + 0.5) * ((r.z1 - r.z0 - 1.6) / nz));
      const desk: Rect = { x0: cx - 0.3, x1: cx + 0.3, z0: cz - 0.3, z1: cz + 0.3 };
      // 椅子の印: 机の後ろ 0.5 m
      const sx = cx - fx * 0.55, sz = cz - fz * 0.55;
      const all: Rect = { x0: Math.min(desk.x0, sx - 0.3), x1: Math.max(desk.x1, sx + 0.3), z0: Math.min(desk.z0, sz - 0.3), z1: Math.max(desk.z1, sz + 0.3) };
      if (zones.some((z) => all.x0 < z.max[0] && all.x1 > z.min[0] && all.z0 < z.max[2] && all.z1 > z.min[2])) continue;
      if (all.x0 < H.x1 + 0.6 && all.x1 > H.x0 - 0.6 && all.z0 < H.z1 + 0.6 && all.z1 > H.z0 - 0.6) continue;
      desks.push(desk);
      slots.push({ pos: [sx, y, sz], r: 0.55, yaw: faceYaw, accept: ['chair'] });
    }
    if (slots.length < 3) return;
    const n = Math.min(6, slots.length);
    const used = ctx.rng.shuffle(slots.map((_, i) => i)).slice(0, n).sort((a, b) => a - b);
    // 机（当たる）
    for (const i of used) {
      const d = desks[i]!;
      ctx.addBox(box([d.x0, y + 0.7, d.z0], [d.x1, y + 0.74, d.z1], 'furnitureLight'));
      ctx.addBox(box([d.x0 + 0.03, y, d.z0 + 0.03], [d.x1 - 0.03, y + 0.7, d.z1 - 0.03], 'metalDark'));
    }
    const mySlots = used.map((i) => slots[i]!);
    const seats = ctx.addEntity('seats', { type: 'carryReceiver', params: { slots: mySlots, need: n, markMat: 'yellowLine' } });
    ctx.addEntity('tidy', { type: 'carryChime', params: { name: 'carry.chime', pos: [(r.x0 + r.x1) / 2, y + 2, (r.z0 + r.z1) / 2] }, inputs: { in: `${seats}.full` } });
    // 椅子: 床のあちこちに（机・印・床の蓋を避ける）。向きはばらばら
    const avoid: Rect[] = [...used.map((i) => desks[i]!), ...mySlots.map((sl) => ({ x0: sl.pos[0]! - 0.4, x1: sl.pos[0]! + 0.4, z0: sl.pos[2]! - 0.4, z1: sl.pos[2]! + 0.4 })), H];
    const spots = floorSpots(ctx, n, { avoid, gap: 0.9, doorD: 1.6 });
    if (!spots) return;
    const mat = ctx.rng.pick(CHAIR_MATS);
    spots.forEach((p, i) => addItem(ctx, `chair${i}`, p, { half: CHAIR_HALF, kind: 'chair', tag: 'chair', mat, yaw: (ctx.rng.int(0, 3) * Math.PI) / 2, weight: 3 }));
    // 部屋の中の椅子の数（持っている物も）。0 になると床の蓋が開く
    const room = ctx.addEntity('room', { type: 'carryReceiver', params: { region: aabbJ({ min: [s.rect.x0, y - 0.5, s.rect.z0], max: [s.rect.x1, y + 3, s.rect.z1] }), accept: ['chair'], mark: false } });
    const empty = ctx.addEntity('empty', { type: 'threshold', params: { max: 0.5 }, inputs: { in: `${room}.present` } });
    buildHatch(ctx, plan, 'reveal', `${empty}.out`);
    offer(ctx, hatchSecret(plan, y, 'carry.chairs.cleared', '床の蓋の継ぎ目'));
    ctx.keepOut({ min: [r.x0, y - 3, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});

defineGimmick({
  id: 'alignChairs', name: '向きのそろわない椅子', axes: ['carry'], kinds: ['room', 'hall'], minSize: [4.4, 5.2], weight: 0.35, intensity: 0, offersSecret: true, onMainPath: true,
  fits: (s) => !!s.entrance && s.openings.every((o) => onMainWall(s, o)),
  build(ctx) {
    const s = ctx.slot;
    const y = s.cell.floorY;
    const r = innerRect(s);
    // 隠しの壁（ずれる壁）
    const walls = ctx.rng.shuffle([0, 1, 2, 3] as Dir[]).map((d) => ({ d, sp: freeSpans(r, s.openings, d, 1.6, 0.9)[0] })).filter((w) => w.sp);
    const wall = walls[0];
    if (!wall) return;
    // 椅子: 部屋の真ん中に 2 列（待合室）。向きはばらばら（全部同じにはしない）
    const n = ctx.rng.int(5, 7);
    const spots = floorSpots(ctx, n, { margin: 0.9, gap: 0.85, doorD: 1.7, tries: 600 });
    if (!spots) return;
    const yaws = spots.map(() => ctx.rng.int(0, 3));
    if (yaws.every((v) => v === yaws[0])) yaws[0] = (yaws[0]! + 1) % 4;
    const mat = ctx.rng.pick(CHAIR_MATS);
    spots.forEach((p, i) => addItem(ctx, `chair${i}`, p, { half: CHAIR_HALF, kind: 'chair', tag: 'chair', mat, yaw: (yaws[i]! * Math.PI) / 2, weight: 3 }));
    const room = ctx.addEntity('room', { type: 'carryReceiver', params: { region: aabbJ({ min: [s.rect.x0, y - 0.5, s.rect.z0], max: [s.rect.x1, y + 3, s.rect.z1] }), accept: ['chair'], need: n, alignDeg: 20, mark: false } });
    offer(ctx, { hook: 'carry.chairs.aligned', modes: ['appear'], weight: 1, revealOutput: `${room}.aligned`, doorway: { dir: wall.d, at: wall.sp!.at, y, width: 1.0, height: 2.0 }, tell: '1 脚だけ壁を向いた椅子' });
    ctx.keepOut({ min: [r.x0, y - 0.1, r.z0], max: [r.x1, y + 2.6, r.z1] });
  },
});
