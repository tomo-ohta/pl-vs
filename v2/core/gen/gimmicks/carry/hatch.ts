/**
 * 床下収納（床の扉）: 壁際の床の下に、階段で下りる深い穴を作り、上を床と同じ蓋で塞ぐ。穴の底の壁に隠しの入口（存在型）。
 * BI04 椅子を全部どかす・I10 重さで開く が使う。
 *
 * - 穴（壁 d に沿った u0..u0+Lu、壁から Lv）: 部屋の側に壁と平行な階段（1 段 rise ≤ 0.3 m。体が登れる 0.35 m より低い）、
 *   底の壁際に扉の前の床。穴から出るには階段を上る（閉じ込めない）
 * - 蓋: 'reveal'（一度開いたら戻らない。concealGroup の床板。開くと沈んで消える）/
 *   'mover'（入力で開け閉めする動く床板。開くと穴の中へ沈んで横へずれる）/ 'open'（蓋の無い穴）
 * - 開口の前（1.6 m）・部屋の壁の半分より長くは取らない（穴が開いても開口どうしは歩いてつながる）
 */
import type { Dir } from '../../../math/vec.ts';
import type { Rect } from '../../../world/footprint.ts';
import { box, type Box } from '../../../world/layout.ts';
import type { GimmickContext, SecretOffer } from '../types.ts';
import { pitShell } from '../pit.ts';
import { cutFloorSlab, doorZone, innerRect, wallFrame } from '../util.ts';
import { aabbJ, freeSpans } from './util.ts';

export interface HatchPlan {
  d: Dir;
  hole: Rect;
  depth: number;
  steps: { rect: Rect; top: number }[];
  /** 穴の底の扉（壁 d の at） */
  doorAt: number;
  /** 蓋の範囲（穴と同じ） */
  cover: Rect;
  /** 底の中心（扉の前） */
  bottom: [number, number, number];
}

/** 床下収納の計画（置けなければ null）。avoid の矩形（家具・台）とは重ねない */
export function planHatch(ctx: GimmickContext, o: { avoid?: Rect[]; walls?: Dir[] } = {}): HatchPlan | null {
  const s = ctx.slot;
  const t = ctx.tuning;
  const y = s.cell.floorY;
  const r = innerRect(s);
  const depth = t['carry.hatch.depthM'];
  const rise = depth / (Math.ceil(depth / 0.3));
  const n = Math.round(depth / rise) - 1;
  const tread = 0.28;
  const run = n * tread;
  const Lu = run + 1.35, Lv = 2.05;
  const zones = s.openings.map((op) => doorZone(op, y, 1.6, 0.5));
  for (const d of ctx.rng.shuffle((o.walls ?? [0, 1, 2, 3]) as Dir[])) {
    const F = wallFrame(r, d);
    if (F.depth < Lv + 2.2 || F.u1 - F.u0 < 2 * Lu) continue;
    for (const sp of freeSpans(r, s.openings, d, Lu + 0.3, 1.2)) {
      for (const side of ctx.rng.shuffle([-1, 1])) {
        const u0 = side < 0 ? sp.a0 + 0.15 : sp.a1 - 0.15 - Lu;
        const hole = F.rect(u0, 0, u0 + Lu, Lv);
        if (zones.some((z) => hole.x0 < z.max[0] && hole.x1 > z.min[0] && hole.z0 < z.max[2] && hole.z1 > z.min[2])) continue;
        if ((o.avoid ?? []).some((a) => hole.x0 < a.x1 + 0.4 && hole.x1 > a.x0 - 0.4 && hole.z0 < a.z1 + 0.4 && hole.z1 > a.z0 - 0.4)) continue;
        // 階段: 部屋の側（v = Lv - 1.0 .. Lv）。上の端は穴の端（u の小さい方か大きい方）
        const down = ctx.rng.chance(0.5) ? 1 : -1;
        const uTop = down > 0 ? u0 : u0 + Lu;
        const steps = [...Array(n).keys()].map((j) => {
          const a = uTop + down * j * tread, b = uTop + down * (j + 1) * tread;
          return { rect: F.rect(Math.min(a, b), Lv - 1.0, Math.max(a, b), Lv), top: y - rise * (j + 1) };
        });
        const doorU = down > 0 ? u0 + run + (Lu - run) / 2 : u0 + (Lu - run) / 2;
        const bottom = F.point(doorU, 0.5);
        return { d, hole, depth, steps, doorAt: doorU, cover: hole, bottom: [bottom[0], y - depth, bottom[1]] };
      }
    }
  }
  return null;
}

/**
 * 計画どおりに穴・階段・蓋を作る。kind 'reveal' は trigger（`部品.出力`）が入ると開く（戻らない）、
 * 'mover' は trigger が入っている間だけ開く（open の入力）。戻り値は蓋の部品の id
 */
export function buildHatch(ctx: GimmickContext, p: HatchPlan, kind: 'reveal' | 'mover' | 'open', trigger: string): string {
  const s = ctx.slot;
  const y = s.cell.floorY;
  cutFloorSlab(s, p.hole);
  pitShell(ctx, p.hole, p.depth);
  for (const st of p.steps) ctx.addBox(box([st.rect.x0, y - p.depth, st.rect.z0], [st.rect.x1, st.top, st.rect.z1], s.cell.palette.floor));
  // 穴の底の灯り（開けたとき中が見える）
  s.cell.lights.push({ pos: [p.bottom[0], y - p.depth + 1.6, p.bottom[2]], color: 0xd8c8a8, intensity: 0.3, distance: 4 });
  const h = p.cover;
  // 蓋の継ぎ目（床に細い線。目印）
  const seam = (x0: number, z0: number, x1: number, z1: number): Box => box([x0, y, z0], [x1, y + 0.004, z1], 'metalDark', false);
  ctx.addBox(seam(h.x0, h.z0, h.x1, h.z0 + 0.025));
  ctx.addBox(seam(h.x0, h.z1 - 0.025, h.x1, h.z1));
  ctx.addBox(seam(h.x0, h.z0, h.x0 + 0.025, h.z1));
  ctx.addBox(seam(h.x1 - 0.025, h.z0, h.x1, h.z1));
  // 'open': 蓋の無い穴（ピンボールの落とし穴）。縁に黄色い線
  if (kind === 'open') {
    for (const b of s.cell.boxes.slice(-4)) b.mat = 'yellowLine';
    return '';
  }
  if (kind === 'reveal') {
    const group = `${ctx.id}.hatch`;
    const lid = box([h.x0, y - 0.15, h.z0], [h.x1, y, h.z1], s.cell.palette.floor);
    lid.concealGroup = group;
    ctx.addBox(lid);
    // 継ぎ目も蓋と一緒に消える
    for (const b of s.cell.boxes.slice(-5, -1)) b.concealGroup = group;
    return ctx.addEntity('hatch', { type: 'reveal', params: { group, pos: [(h.x0 + h.x1) / 2, y, (h.z0 + h.z1) / 2], style: 'slideOpen' }, inputs: { show: trigger } });
  }
  // 動く蓋: 左右 2 枚。開くと 0.22 m 沈んで、穴の両端の床の下へずれる（壁の向こうへ出ない）
  const F = wallFrame(innerRect(s), p.d);
  const ua = F.u(h.x0, h.z0), ub = F.u(h.x1, h.z1);
  const u0 = Math.min(ua, ub), u1 = Math.max(ua, ub), um = (u0 + u1) / 2;
  const e0 = F.point(u0, 0), e1 = F.point(u1, 0);
  const ux = (e1[0] - e0[0]) / Math.max(1e-6, u1 - u0), uz = (e1[1] - e0[1]) / Math.max(1e-6, u1 - u0);
  const half = (a: number, b: number, sg: number, name: string): string => {
    const q = F.rect(a, F.v(h.x0, h.z0), b, F.v(h.x1, h.z1));
    const L = (b - a) + 0.05;
    // hatch: true（床の蓋。歩く人の試験は開いたままにして、穴の底の隠しへ行けることを確かめる）
    return ctx.addEntity(name, { type: 'mover', params: { box: aabbJ({ min: [q.x0, y - 0.12, q.z0], max: [q.x1, y, q.z1] }), mat: s.cell.palette.floor, points: [[0, 0, 0], [0, -0.22, 0], [sg * ux * L, -0.22, sg * uz * L]], speed: 1.6, carry: true, hatch: true }, inputs: { target: trigger } });
  };
  const first = half(u0, um, -1, 'hatchA');
  half(um, u1, 1, 'hatchB');
  return first;
}

/** 穴の底の壁の隠しの入口（存在型。蓋を開けた人だけが見つける） */
export function hatchSecret(p: HatchPlan, y: number, hook: string, tell: string): SecretOffer {
  return { hook, modes: ['present'], weight: 1.1, doorway: { dir: p.d, at: p.doorAt, y: y - p.depth, width: 1.0, height: 2.0 }, tell };
}
