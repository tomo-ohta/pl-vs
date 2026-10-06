/**
 * 光・音・視線・時間の部屋まるごとの異変（段階 4・担当 sense）。どれも家具が無くても成り立つ（椅子が動く部屋だけは椅子が要る）。
 *
 * - rgbRoom 色の照明 [L11]: 照明が赤・緑・青に 1 色ずつ切り替わる。壁の色の印（手形・矢印・数え線）は、同じ色の光の下では消え、
 *     ほかの色の光の下では黒く浮かぶ（どの色の光でも見えない印がある）
 * - walkingShadow 影だけ動く [L12]: 誰もいないのに、人の影が壁を歩いて往復する（足音も）。じっと見ると止まって薄れる
 * - sunbeam 窓の光の向き [L15]: 窓の外は夜なのに、窓から日の光が差し込み、床の日だまりが早回しのように動く
 * - lightning 雷 [L16]: 窓の無い暗い部屋に稲光が走る（照明が一瞬だけ青白く点く）。少し遅れて雷鳴
 * - silence 完全な無音 [A03]: 壁と天井が吸音の楔で覆われ、部屋に入ると一切の音が消える（自分の足音も）
 * - lateSteps 足音が遅れて聞こえる [A05]: 足音が 0.45 秒遅れて聞こえ、床の足跡も遅れて現れる
 * - turningChairs 見ていない間に動く家具 [O06]: 椅子は、見ていない間に向きを変え、振り返ると全部こちらを向いている
 * - edgeFigure 視界の端の人影 [O12]: 視界の端にだけ人影が立つ。そちらを見ると消える
 * - slowTime 遅い部屋 [T06]: 部屋の中では動きが遅く、足音が低くゆっくり聞こえ、塵がゆっくり舞う
 */
import { along } from '../../../../world/footprint.ts';
import type { Dir } from '../../../../math/vec.ts';
import { box, WALL_T, type Box, type LightSpec } from '../../../../world/layout.ts';
import { innerFaces, type Face } from '../../../dress/geom.ts';
import { defineAnomaly, type AnomalyContext } from '../../types.ts';
import { bbOf, interiorSolids, isCeilingPanel, objectGroups } from '../../util.ts';

/** 壁の面 f の上で、本物の開口（± pad）を除いた区間 */
function freeSpans(ctx: AnomalyContext, f: Face, pad: number): [number, number][] {
  const cuts = ctx.geo.openings
    .filter((o) => o.dir === f.dir && Math.abs((o.dir === 0 || o.dir === 2 ? o.pos[2] : o.pos[0]) - f.coord) < 0.05)
    .map((o) => { const t = along(o.dir, o.pos[0], o.pos[2]); return [t - o.width / 2 - pad, t + o.width / 2 + pad] as [number, number]; })
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = f.a0 + WALL_T + 0.08;
  const end = f.a1 - WALL_T - 0.08;
  for (const [p, q] of cuts) { if (p > cur) out.push([cur, Math.min(p, end)]); cur = Math.max(cur, q); }
  if (end > cur) out.push([cur, end]);
  return out.filter(([p, q]) => q - p > 0.3);
}

/** 壁の空いた区間（長い順）: 面の向き dir・面の座標 face・内向き inward・区間 a0..a1 */
interface Span { dir: Dir; face: number; inward: 1 | -1; a0: number; a1: number }
function wallSpans(ctx: AnomalyContext, pad = 0.5): Span[] {
  const out: Span[] = [];
  for (const f of innerFaces(ctx.cell.footprint)) for (const [a0, a1] of freeSpans(ctx, f, pad)) out.push({ dir: f.dir, face: f.face, inward: f.inward, a0, a1 });
  return out.sort((p, q) => (q.a1 - q.a0) - (p.a1 - p.a0));
}

/** 区画の立てる範囲（部品の zone） */
function regionOf(ctx: AnomalyContext): { min: number[]; max: number[] } {
  const fy = ctx.cell.floorY;
  const r = ctx.rects;
  return { min: [Math.min(...r.map((q) => q.x0)), fy - 0.5, Math.min(...r.map((q) => q.z0))], max: [Math.max(...r.map((q) => q.x1)), fy + ctx.cell.height, Math.max(...r.map((q) => q.z1))] };
}

/** 壁の面の上の点（壁から out m） */
const facePoint = (s: Span, at: number, out: number): [number, number] => (s.dir === 0 || s.dir === 2 ? [at, s.face + s.inward * out] : [s.face + s.inward * out, at]);

/** 壁の区間 s の a0..a1 の前（壁から depth m・床から h m）に家具を置かせない（pre だけ） */
function keepBand(ctx: AnomalyContext, s: Span, a0: number, a1: number, depth: number, h: number): void {
  const fy = ctx.cell.floorY;
  const w0 = s.face, w1 = s.face + s.inward * depth;
  ctx.keepOut(s.dir === 0 || s.dir === 2 ? { min: [a0, fy, Math.min(w0, w1)], max: [a1, fy + h, Math.max(w0, w1)] } : { min: [Math.min(w0, w1), fy, a0], max: [Math.max(w0, w1), fy + h, a1] });
}

// ---------------------------------------------------------------- 色の照明
const RGB = [0xff3a30, 0x38ff4a, 0x3a5cff];
const PANEL_MAT = ['neonRed', 'lightGreen', 'neonBlue'] as const;

defineAnomaly({
  id: 'rgbRoom', name: '色の照明', weight: 0.4, intensity: 1, kinds: ['room', 'hall'], frontOnly: true,
  post(ctx) {
    const cell = ctx.cell, t = ctx.tuning, fy = cell.floorY;
    const T = t['sense.rgb.sec'];
    const phase = ctx.rng.float(0, 3 * T);
    const lamps = [0, 1, 2].map((k) => {
      const clock = ctx.addEntity(`clock${k}`, { type: 'pattern', params: { on: T, off: 2 * T, phase: phase - k * T } });
      return ctx.addEntity(`lamp${k}`, { type: 'lamp', params: { on: false, rate: 5 }, inputs: { on: `${clock}.out` } });
    });
    // 照明: 1 つの灯りを、同じ所の赤・緑・青の 3 つに
    const base: LightSpec[] = cell.lights.length ? cell.lights : [{ pos: [(ctx.rects[0]!.x0 + ctx.rects[0]!.x1) / 2, fy + cell.height - 0.4, (ctx.rects[0]!.z0 + ctx.rects[0]!.z1) / 2], color: 0xffffff, intensity: 1, distance: 8 }];
    cell.lights = base.flatMap((l) => [0, 1, 2].map((k) => ({ ...l, color: RGB[k]!, intensity: l.intensity * 1.25, lampId: lamps[k]! })));
    let i = 0;
    for (const b of cell.boxes) if (isCeilingPanel(cell, b) && !b.kind?.startsWith('lamp:')) { const k = i++ % 3; b.mat = PANEL_MAT[k]!; b.kind = `lamp:${lamps[k]}`; }
    cell.palette = { ...cell.palette, ambient: 0x0c0c0e };
    // 壁の色の印: 長い区間から、印 1〜2 個ずつ（色は順に）
    const solids = interiorSolids(cell);
    const marks: { dir: number; face: number; inward: number; at: number; y: number; kind: string; color: number; lamp: string }[] = [];
    const kinds = ['hand', 'arrow', 'tally'];
    const spans = wallSpans(ctx, 0.4);
    const tryMark = (s: (typeof spans)[number], at: number): void => {
      const y = fy + ctx.rng.float(1.15, 1.7);
      const [px, pz] = facePoint(s, at, 0.15);
      // 壁際の背の高い物に隠れる所は避ける
      if (solids.some((b) => b.max[1] > y - 0.3 && px > b.min[0] - 0.3 && px < b.max[0] + 0.3 && pz > b.min[2] - 0.3 && pz < b.max[2] + 0.3)) return;
      if (marks.some((m) => m.dir === s.dir && Math.abs(m.face - s.face) < 0.05 && Math.abs(m.at - at) < 0.6)) return;
      const c = marks.length % 3;
      marks.push({ dir: s.dir, face: s.face, inward: s.inward, at, y, kind: kinds[(marks.length + ctx.rng.int(0, 2)) % 3]!, color: c, lamp: lamps[c]! });
    };
    for (const s of spans.slice(0, 4)) {
      const n = s.a1 - s.a0 > 3 ? 2 : 1;
      for (let k = 0; k < n; k++) tryMark(s, s.a0 + ((s.a1 - s.a0) * (k + 1)) / (n + 1));
    }
    // 家具に隠れて 3 つに足りなければ、残りの壁と、壁の別の所（4 分の 1 ずつ）も見る（印が 1 色だけだと色の照明の意味が分からない）
    for (const s of spans) {
      for (const f of [0.25, 0.75, 0.5]) {
        if (marks.length >= 3) break;
        tryMark(s, s.a0 + (s.a1 - s.a0) * f);
      }
    }
    ctx.addEntity('marks', { type: 'senseFx', params: { fx: 'rgbMarks', marks } });
  },
});

// ---------------------------------------------------------------- 影だけ動く
defineAnomaly({
  id: 'walkingShadow', name: '影だけ動く', weight: 0.45, intensity: 1, kinds: ['room', 'hall'],
  // 影の歩く壁を先に決めて、壁際に家具を置かせない（影が家具に隠れない）
  pre(ctx) {
    const s = wallSpans(ctx, 0.3).find((x) => x.a1 - x.a0 >= 2.6);
    if (!s) return false;
    ctx.memo.span = s;
    keepBand(ctx, s, s.a0, s.a1, 0.55, 2.1);
  },
  post(ctx) {
    const s = ctx.memo.span as Span;
    ctx.addEntity('shadow', { type: 'senseFx', params: { fx: 'shadow', dir: s.dir, face: s.face, inward: s.inward, a0: s.a0 + 0.4, a1: s.a1 - 0.4, y: ctx.cell.floorY, speed: ctx.tuning['sense.shadow.speed'], phase: ctx.rng.float(0, 20) } });
  },
});

// ---------------------------------------------------------------- 窓の光の向き
defineAnomaly({
  id: 'sunbeam', name: '窓の光の向き', weight: 0.45, intensity: 1, kinds: ['room', 'hall'], minHeight: 2.4,
  // 窓の壁を先に決めて、窓の前に家具を置かせない
  pre(ctx) {
    const s = wallSpans(ctx, 0.6).find((x) => x.a1 - x.a0 >= 2.0);
    if (!s) return false;
    ctx.memo.span = s;
    const at = (s.a0 + s.a1) / 2, w = Math.min(1.6, s.a1 - s.a0 - 0.4);
    keepBand(ctx, s, at - w / 2 - 0.3, at + w / 2 + 0.3, 0.9, ctx.cell.height);
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const s = ctx.memo.span as Span;
    const at = (s.a0 + s.a1) / 2, w = Math.min(1.6, s.a1 - s.a0 - 0.4);
    const y0 = fy + 0.95, y1 = fy + Math.min(2.15, cell.height - 0.25);
    // 窓の前の壁際の物（棚・掲示）と重ならない
    const [px, pz] = facePoint(s, at, 0.2);
    const hw = w / 2 + 0.1;
    const near = (b: Box): boolean => (s.dir % 2 === 0 ? b.min[0] < at + hw && b.max[0] > at - hw && Math.abs((b.min[2] + b.max[2]) / 2 - pz) < 0.45 : b.min[2] < at + hw && b.max[2] > at - hw && Math.abs((b.min[0] + b.max[0]) / 2 - px) < 0.45);
    if (cell.boxes.some((b) => b.max[1] > y0 && b.min[1] < y1 && near(b) && b.propGroup)) return false;
    const B: Box[] = [];
    const slab = (a0: number, a1: number, yy0: number, yy1: number, d0: number, d1: number, mat: Box['mat']): void => {
      const w0 = s.face + s.inward * d0, w1 = s.face + s.inward * d1;
      B.push(s.dir % 2 === 0 ? box([a0, yy0, Math.min(w0, w1)], [a1, yy1, Math.max(w0, w1)], mat, false) : box([Math.min(w0, w1), yy0, a0], [Math.max(w0, w1), yy1, a1], mat, false));
    };
    slab(at - w / 2, at + w / 2, y0, y1, 0.004, 0.012, 'windowNight');
    slab(at - w / 2 - 0.06, at - w / 2, y0 - 0.06, y1 + 0.06, 0, 0.06, 'trim');
    slab(at + w / 2, at + w / 2 + 0.06, y0 - 0.06, y1 + 0.06, 0, 0.06, 'trim');
    slab(at - w / 2 - 0.06, at + w / 2 + 0.06, y1, y1 + 0.06, 0, 0.06, 'trim');
    slab(at - w / 2 - 0.08, at + w / 2 + 0.08, y0 - 0.08, y0, 0, 0.14, 'trim');
    slab(at - 0.02, at + 0.02, y0, y1, 0.012, 0.04, 'trim');
    for (const b of B) { b.propGroup = `${cell.id}/a-sunWindow`; ctx.addBox(b); }
    ctx.addEntity('sun', { type: 'senseFx', params: { fx: 'sunbeam', dir: s.dir, face: s.face, inward: s.inward, at, w, y0, y1, y: fy, rects: ctx.rects.map((r) => [r.x0, r.z0, r.x1, r.z1]), phase: ctx.rng.float(0, 30) } });
  },
});

// ---------------------------------------------------------------- 雷
defineAnomaly({
  id: 'lightning', name: '雷', weight: 0.4, intensity: 1, kinds: ['room', 'hall'], frontOnly: true,
  post(ctx) {
    const cell = ctx.cell, t = ctx.tuning;
    const storm = ctx.addEntity('storm', { type: 'lightning', params: { min: t['sense.lightning.minSec'], max: t['sense.lightning.maxSec'] } });
    const lamp = ctx.addEntity('flash', { type: 'lamp', params: { on: false, rate: 40 }, inputs: { on: `${storm}.out` } });
    for (const b of cell.boxes) if (isCeilingPanel(cell, b) && !b.kind?.startsWith('lamp:')) b.kind = `lamp:${lamp}`;
    cell.lights = cell.lights.map((l) => ({ ...l, color: 0xdfe8ff, intensity: l.intensity * 1.4, lampId: lamp }));
    cell.palette = { ...cell.palette, ambient: 0x07080b, lightIntensity: cell.palette.lightIntensity * 0.3 };
    ctx.addEntity('thunder', { type: 'senseFx', params: { fx: 'thunder', storm } });
  },
});

// ---------------------------------------------------------------- 完全な無音
defineAnomaly({
  id: 'silence', name: '完全な無音', weight: 0.4, intensity: 1, kinds: ['room', 'hall'],
  // 楔の前（壁から 0.35 m）に家具を置かせない
  pre(ctx) {
    for (const s of wallSpans(ctx, 0.15)) keepBand(ctx, s, s.a0, s.a1, 0.35, ctx.cell.height);
  },
  post(ctx) {
    const cell = ctx.cell;
    const faces = wallSpans(ctx, 0.15).map((s) => ({ dir: s.dir, face: s.face, inward: s.inward, a0: s.a0, a1: s.a1 }));
    if (!faces.length) return false;
    ctx.addEntity('foam', { type: 'senseFx', params: { fx: 'anechoic', faces, y: cell.floorY, h: cell.height, rects: ctx.rects.map((r) => [r.x0, r.z0, r.x1, r.z1]), zone: regionOf(ctx) } });
  },
});

// ---------------------------------------------------------------- 足音が遅れて聞こえる
defineAnomaly({
  id: 'lateSteps', name: '足音が遅れて聞こえる', weight: 0.45, intensity: 0, kinds: ['room', 'hall'],
  post(ctx) {
    ctx.addEntity('late', { type: 'senseFx', params: { fx: 'lateSteps', zone: regionOf(ctx), delay: ctx.tuning['sense.late.delaySec'], y: ctx.cell.floorY } });
  },
});

// ---------------------------------------------------------------- 見ていない間に動く家具
defineAnomaly({
  id: 'turningChairs', name: '見ていない間に動く家具', weight: 0.8, intensity: 1, kinds: ['room', 'hall'], needsFurniture: true,
  post(ctx) {
    const cell = ctx.cell;
    // 椅子と、小さな家具（床で 0.8 m 角まで・1.4 m より低い。斜めの箱・光る物の無いもの）。椅子を先に
    const small = objectGroups(ctx.furniture, cell).filter((g) => {
      const bb = bbOf(g.boxes);
      const chairish = g.key.includes('/chair@');
      return g.boxes.every((b) => !b.slope && !b.revealGroup && !b.concealGroup && !b.kind?.startsWith('lamp:') && b.kind !== 'emitOnly') &&
        bb.max[1] - cell.floorY < 1.4 && (chairish || (bb.max[0] - bb.min[0] <= 0.8 && bb.max[2] - bb.min[2] <= 0.8));
    }).sort((p, q) => (q.key.includes('/chair@') ? 1 : 0) - (p.key.includes('/chair@') ? 1 : 0));
    const list = small.slice(0, ctx.tuning['sense.chairs.max']).map((g) => g.boxes);
    if (list.length < 3) return false;
    const chairs = list.map((bs) => {
      const x0 = Math.min(...bs.map((b) => b.min[0])), x1 = Math.max(...bs.map((b) => b.max[0]));
      const z0 = Math.min(...bs.map((b) => b.min[2])), z1 = Math.max(...bs.map((b) => b.max[2]));
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // 背もたれ（いちばん高い箱）から座った人の向き（椅子でなければ 0）
      const back = bs.slice().sort((a, b) => b.max[1] - a.max[1])[0]!;
      const bx = (back.min[0] + back.max[0]) / 2 - cx, bz = (back.min[2] + back.max[2]) / 2 - cz;
      const facing = bs.some((b) => b.propGroup?.includes('/chair@')) && Math.hypot(bx, bz) > 0.05 ? Math.atan2(bx, bz) : 0;
      const boxes = bs.filter((b) => b.kind !== 'colliderOnly').map((b) => ({ min: [b.min[0] - cx, b.min[1], b.min[2] - cz], max: [b.max[0] - cx, b.max[1], b.max[2] - cz], mat: b.mat }));
      // 描画は部品が受け持つ（当たり判定はそのまま）
      for (const b of bs) b.kind = 'colliderOnly';
      return { c: [cx, cz], facing, boxes };
    });
    ctx.addEntity('chairs', { type: 'senseFx', params: { fx: 'chairs', chairs, y: cell.floorY } as never });
  },
});

// ---------------------------------------------------------------- 視界の端の人影
defineAnomaly({
  id: 'edgeFigure', name: '視界の端の人影', weight: 0.45, intensity: 1, kinds: ['room', 'hall'],
  // 人影の立つ所（壁際）を先に決めて、家具を置かせない
  pre(ctx) {
    const fy = ctx.cell.floorY;
    const spots: number[][] = [];
    for (const s of wallSpans(ctx, 0.5)) for (let a = s.a0 + 0.4; a <= s.a1 - 0.4 && spots.length < 16; a += 1.4) spots.push(facePoint(s, a, 0.45));
    if (spots.length < 3) return false;
    for (const [x, z] of spots) ctx.keepOut({ min: [x! - 0.4, fy, z! - 0.4], max: [x! + 0.4, fy + 2.0, z! + 0.4] });
    ctx.memo.spots = spots;
  },
  post(ctx) {
    const cell = ctx.cell, fy = cell.floorY;
    const solids = interiorSolids(cell);
    const spots = (ctx.memo.spots as number[][]).filter(([x, z]) => !solids.some((b) => b.max[1] > fy + 0.3 && x! > b.min[0] - 0.35 && x! < b.max[0] + 0.35 && z! > b.min[2] - 0.35 && z! < b.max[2] + 0.35));
    if (spots.length < 3) return false;
    ctx.addEntity('figure', { type: 'senseFx', params: { fx: 'edgeFigure', spots: spots.slice(0, 16), y: fy, show: ctx.tuning['sense.edge.showDeg'], hide: ctx.tuning['sense.edge.hideDeg'] } });
  },
});

// ---------------------------------------------------------------- 遅い部屋
defineAnomaly({
  id: 'slowTime', name: '遅い部屋', weight: 0.4, intensity: 1, kinds: ['room', 'hall'],
  post(ctx) {
    const fy = ctx.cell.floorY;
    for (const r of ctx.rects) ctx.addZone({ kind: 'water', aabb: { min: [r.x0, fy - 0.3, r.z0], max: [r.x1, fy + ctx.cell.height, r.z1] }, params: { slow: ctx.tuning['sense.slow.speed'], dry: true } });
    ctx.addEntity('slow', { type: 'senseFx', params: { fx: 'slowTime', zone: regionOf(ctx), rects: ctx.rects.map((r) => [r.x0, r.z0, r.x1, r.z1]), y: fy, h: ctx.cell.height, pitch: ctx.tuning['sense.slow.pitch'] } });
  },
});
