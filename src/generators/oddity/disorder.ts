/**
 * 奇妙さ生成: 乱れ（category 'disorder'。第17回）。規則的に並んだ部屋の中に「崩れた」「散らかった」「おかしく重なった」状態を、
 * その部屋にある物だけで作る（新しい物は持ち込まない。乱せる物の無い部屋では起きない）。
 *  - disorder.toppled 転倒: 物を倒す（横倒し 4 方向・逆さ・傾き・向きだけ変わる）。強いと 6 割（最大 60 個）、弱いと 3 割（最大 25 個）
 *  - disorder.scatter 散乱: 小さな物を元の場所から動かし、倒れた / 傾いた / 逆さの姿勢で床に散らす（強いと 10〜24 個を 6〜9 m 四方に）
 *  - disorder.pile    積み重なり: 小さな物を集めて無理な角度で積んだ山にする（互いに少し食い込む）
 *  - disorder.glitch  バグのような重なり: ずらした分身の残像・回した分身の貫通・床に半分沈む・壁に半分めり込む（箱の家具だけ。壁の内面で切る）
 *
 * 乱せる物（Thing）:
 *  - 家具のグループ（propGroup: 椅子・机・ロッカーの列・ベンチなど。植栽・扉・乗り物・展示品は除く）
 *  - 種類の付いた単体の家具（机・棚・箱・ゴミ箱・台車など）
 *  - 自販機・洗濯機・乾燥機（生成器の箱を描画側が家電の形に置き換える物。ApplianceFromBoxes で同じ形・色を求め、部品 'appliance' で倒す）
 *  - 並べて描く物（InstanceSpec の 1 個。ゲーム筐体・CRT・電話などの反復配置。植栽・麦・発光の飾りは除く）
 * 自由な角度の物は MonumentSpec（kind 'clutter'）の部品として描く（箱は軸に揃うので傾けられない）。当たり判定は外接箱（高さ 1 m まで）だけ
 */
import type { Dir } from '../../core/types';
import { partBounds } from '../monument/index';
import { chairParts, placeGroup } from '../monument/extra';
import type { MonumentPart } from '../monument/types';
import type { InstanceSpec } from '../layout';
import { appliancesFromBoxes } from '../../render/props/ApplianceFromBoxes';
import { lockerGroup } from '../../render/props/FurnitureShapes';
import {
  WALL_T, budgetOk, canPlace, inFocus, inner, isCorridor, mainRect, pick, propGroups, ODD_KIND,
  type Box, type Ctx, type MatId, type Oddity, type Rect, type Strength, type Vec3,
} from './shared';

// ---------------------------------------------------------------- 乱せる物

interface Thing {
  id: string;
  kind: string;
  min: Vec3;
  max: Vec3;
  /** 箱の家具の箱（壁へのめり込みで箱ごと切る）。家電・並べて描く物は無し */
  boxes?: Box[];
  /** 自分の箱（置けるかの判定で無視する。家電は描画側で置き換わる箱、並べて描く物は無し） */
  own: Box[];
  /** 長い列（ロッカー・棚）の区画: 同じ propGroup の箱はまとめて自分の側として扱う（区画を外すと列の箱が切り直されるため） */
  group?: string;
  /** 直立した姿勢の部品（原点 = 底面の中心。元の向き込み） */
  local: () => MonumentPart[];
  /** 取り除く（keepCollider: 元の当たり判定を見えない箱で残す） */
  remove: (c: Ctx, keepCollider: boolean) => void;
}

/** 動かさない kind（大文字小文字を問わない。廊下の装飾扉 'decorDoor' など） */
const EXCLUDED = /plant|door|vehicle|train|elevator|exhibit|monument|colliderOnly|emitOnly/i;
/** 壁に付いた薄い物（扉・掲示板・プレート）は kind に依らず動かさない（奥行き MIN_DEPTH m 未満） */
const MIN_DEPTH = 0.12;
/** 単体の家具として動かしてよい kind */
const SOLO_KINDS = /^(desk|table|cabinet|shelf|box|crate|bin|cart|bench|stool|sofa|bed|counter|drawer|chair|trolley|case)/;
const APPLIANCE_KINDS = new Set(['vending', 'washer', 'dryer']);
/** 長い列を区画に分けて乱す kind（ロッカー・棚。区画はおよそ SEGMENT m） */
const SEGMENT_KINDS = /locker|shelf|rack/;
const SEGMENT = 1.2;

function sizeOf(t: Thing): Vec3 { return [t.max[0] - t.min[0], t.max[1] - t.min[1], t.max[2] - t.min[2]]; }
function centerOf(t: Thing): [number, number] { return [(t.min[0] + t.max[0]) / 2, (t.min[2] + t.max[2]) / 2]; }

/** 箱の列を、原点（底面の中心 (cx, y0, cz)）まわりの部品の箱に */
function boxParts(boxes: Box[], cx: number, y0: number, cz: number): MonumentPart[] {
  return boxes.map((b) => ({ prim: 'box', mat: b.mat, pos: [(b.min[0] + b.max[0]) / 2 - cx, (b.min[1] + b.max[1]) / 2 - y0, (b.min[2] + b.max[2]) / 2 - cz] as Vec3, size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] as Vec3 }));
}

/** 箱を取り除く（ソリッドは残すなら見えない当たり判定 colliderOnly に） */
function removeBoxes(c: Ctx, boxes: Box[], keepCollider: boolean): void {
  const own = new Set(boxes);
  const next: Box[] = [];
  for (const b of c.L.boxes) {
    if (!own.has(b)) { next.push(b); continue; }
    if (keepCollider && b.solid) next.push({ ...b, propGroup: undefined, kind: 'colliderOnly', mat: 'void' });
  }
  c.L.boxes = next;
}

/** 椅子の座面の材質（金属の脚以外で最も多い材質） */
function seatMatOf(boxes: Box[]): MatId {
  const n = new Map<MatId, number>();
  for (const b of boxes) if (!/^metal|stainless/.test(b.mat)) n.set(b.mat, (n.get(b.mat) ?? 0) + (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]));
  let best: MatId = 'plasticRed', v = -1;
  for (const [m, a] of n) if (a > v) { v = a; best = m; }
  return best;
}

/** 箱から家電の形を求める（描画側の ApplianceFromBoxes と同じ規則・同じ色） */
function applianceThing(c: Ctx, id: string, kind: string, boxes: Box[], neighbors: Box[]): Thing | null {
  const r = mainRect(c);
  const conv = appliancesFromBoxes([...boxes, ...neighbors], [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]);
  const sp = conv.specs[0], tr = sp?.transforms[0];
  if (!sp || !tr || !sp.shape) return null;
  const replaced = conv.replaced;
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of replaced) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); }
  const shape = sp.shape;
  return {
    id, kind, min, max, own: replaced,
    local: () => [{ prim: 'appliance', mat: sp.mat, pos: [0, 0, 0], rot: [0, tr.yaw, 0], size: sp.size as Vec3, appliance: { shape, accent: sp.accent, screen: sp.screen } }],
    remove: (cc, keep) => removeBoxes(cc, replaced, keep),
  };
}

function removeInstance(c: Ctx, sp: InstanceSpec, tr: InstanceSpec['transforms'][number], keep: boolean, min: Vec3, max: Vec3): void {
  const i = sp.transforms.indexOf(tr);
  if (i >= 0) sp.transforms.splice(i, 1);
  if (keep && sp.solid) c.L.boxes.push({ min, max, mat: 'void', solid: true, kind: 'colliderOnly' });
}

/** 箱を ax 方向の [a, b] で切り抜いた残り（0〜2 個） */
function cutOut(q: Box, ax: 0 | 2, a: number, b: number): Box[] {
  const out: Box[] = [];
  if (q.min[ax] < a - 0.005) { const mx = [...q.max] as Vec3; mx[ax] = a; out.push({ ...q, min: [...q.min] as Vec3, max: mx }); }
  if (q.max[ax] > b + 0.005) { const mn = [...q.min] as Vec3; mn[ax] = b; out.push({ ...q, min: mn, max: [...q.max] as Vec3 }); }
  return out;
}

/** 列の箱か（区画を外した残りは `元の id|番号` の列に付け直す） */
function inFamily(q: Box, id: string): boolean {
  return q.propGroup !== undefined && (q.propGroup === id || q.propGroup.split('|')[0] === id.split('|')[0]);
}

/**
 * 区画を外した後の列を、本体（kind の付いた箱）ごとの独立した列に付け直す。描画側（FurnitureShapes lockerGroup）は
 * 列の本体 1 つと前面の薄箔から扉を描き直すので、本体が 2 つ以上に切れたまま同じ列だと片方しか描かれない
 */
function relabel(boxes: Box[], id: string, kind: string, ax: 0 | 2): void {
  const fam = boxes.filter((q) => inFamily(q, id));
  const bodies = fam.filter((q) => q.kind === kind).sort((u, v) => u.min[ax] - v.min[ax]);
  if (bodies.length < 2) return;
  const root = id.split('|')[0];
  for (const q of fam) {
    const m = (q.min[ax] + q.max[ax]) / 2;
    let k = bodies.findIndex((bd) => m >= bd.min[ax] - 0.01 && m <= bd.max[ax] + 0.01);
    if (k < 0) k = bodies.reduce((best, bd, i) => (Math.abs((bd.min[ax] + bd.max[ax]) / 2 - m) < Math.abs((bodies[best].min[ax] + bodies[best].max[ax]) / 2 - m) ? i : best), 0);
    q.propGroup = `${root}|${bodies[k].min[ax].toFixed(2)}`;
  }
}

/**
 * 長い列（ロッカーの列・棚の列）を SEGMENT m ほどの区画に分けた物。区画の境目は小さな部品（扉 1 枚など）を割らない箱の縁に揃える。
 * 列をまたぐ長い箱（台座・天板）は区画の範囲で切る。外すと列の箱を切り直す（残りは立ったまま）
 */
function segmentThings(id: string, kind: string, boxes: Box[], min: Vec3, max: Vec3): Thing[] {
  const ax: 0 | 2 = max[0] - min[0] >= max[2] - min[2] ? 0 : 2;
  const len = max[ax] - min[ax];
  const n = Math.max(2, Math.round(len / SEGMENT));
  const small = boxes.filter((b) => b.max[ax] - b.min[ax] < 1.0).map((b) => [b.min[ax] + 0.005, b.max[ax] - 0.005] as const);
  const edges = [...new Set(boxes.flatMap((b) => [b.min[ax], b.max[ax]]).map((v) => Math.round(v * 1000) / 1000))]
    .filter((e) => e > min[ax] + 0.3 && e < max[ax] - 0.3 && !small.some(([lo, hi]) => lo < e && e < hi))
    .sort((u, v) => u - v);
  const cuts = [min[ax]];
  for (let i = 1; i < n; i++) {
    const ideal = min[ax] + (len * i) / n;
    let best = NaN;
    for (const e of edges) if (e > cuts[cuts.length - 1] + 0.3 && (Number.isNaN(best) || Math.abs(e - ideal) < Math.abs(best - ideal))) best = e;
    if (!Number.isNaN(best) && Math.abs(best - ideal) < SEGMENT * 0.5) cuts.push(best);
  }
  cuts.push(max[ax]);
  const out: Thing[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1];
    if (b - a < 0.3) continue;
    const inside = boxes.filter((q) => q.min[ax] < b - 0.005 && q.max[ax] > a + 0.005);
    if (!inside.length) continue;
    const clipped = inside.map((q) => { const mn = [...q.min] as Vec3, mx = [...q.max] as Vec3; mn[ax] = Math.max(mn[ax], a); mx[ax] = Math.min(mx[ax], b); return { ...q, min: mn, max: mx }; });
    const smin: Vec3 = [Infinity, Infinity, Infinity], smax: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const q of clipped) for (let k = 0; k < 3; k++) { smin[k] = Math.min(smin[k], q.min[k]); smax[k] = Math.max(smax[k], q.max[k]); }
    const cx = (smin[0] + smax[0]) / 2, cz = (smin[2] + smax[2]) / 2, y0 = smin[1];
    out.push({
      id: `${id}@${i}`, kind, min: smin, max: smax, own: inside, group: id.split('|')[0],
      // ロッカーは描画側と同じ描き直し（扉・通気口・取っ手）で
      local: () => { const drawn: Box[] = []; return boxParts(kind === 'lockers' && lockerGroup(clipped, drawn) ? drawn : clipped, cx, y0, cz); },
      remove: (cc, keep) => {
        const next: Box[] = [];
        for (const q of cc.L.boxes) {
          if (!inFamily(q, id) || !(q.min[ax] < b - 0.005 && q.max[ax] > a + 0.005)) { next.push(q); continue; }
          next.push(...cutOut(q, ax, a, b));
          if (keep && q.solid) { const mn = [...q.min] as Vec3, mx = [...q.max] as Vec3; mn[ax] = Math.max(mn[ax], a); mx[ax] = Math.min(mx[ax], b); next.push({ min: mn, max: mx, mat: 'void', solid: true, kind: 'colliderOnly' }); }
        }
        cc.L.boxes = next;
        relabel(next, id, kind, ax);
      },
    });
  }
  return out;
}

/** 部屋の乱せる物（applicable と apply で何度も呼ばれるので、箱の配列と位置が変わらない間は使い回す） */
const thingCache = new WeakMap<Ctx, { boxes: Box[]; key: number; ts: Thing[] }>();
function things(c: Ctx): Thing[] {
  // 箱・並べて描く物の位置の簡単な和（他の奇妙さがその場で動かした・足した・消したら変わる）
  let key = c.L.boxes.length;
  for (const b of c.L.boxes) key += b.min[0] * 1.3 + b.min[1] * 2.7 + b.min[2] * 3.1 + b.max[0] * 5.3 + b.max[1] * 7.1 + b.max[2] * 11.3;
  for (const sp of c.L.instances ?? []) for (const tr of sp.transforms) key += 13 + tr.pos[0] * 1.7 + tr.pos[1] * 2.3 + tr.pos[2] * 4.1;
  const hit = thingCache.get(c);
  if (hit && hit.boxes === c.L.boxes && hit.key === key) return hit.ts;
  const ts = collectThings(c);
  thingCache.set(c, { boxes: c.L.boxes, key, ts });
  return ts;
}

/** 部屋の乱せる物をすべて集める */
function collectThings(c: Ctx): Thing[] {
  const out: Thing[] = [];
  const interior = c.L.boxes.slice(c.start);
  const thin = interior.filter((b) => !b.solid && Math.min(b.max[0] - b.min[0], b.max[2] - b.min[2]) < 0.08);
  // 家具のグループ（自販機・洗濯機・乾燥機のグループは家電の形で）
  for (const [id, g] of propGroups(c.L)) {
    const kind = g.kind ?? '';
    if (EXCLUDED.test(kind) || g.min[1] > 0.3) continue;
    const sx = g.max[0] - g.min[0], sy = g.max[1] - g.min[1], sz = g.max[2] - g.min[2];
    if (sy > 2.8 || Math.min(sx, sz) < MIN_DEPTH) continue;
    if (SEGMENT_KINDS.test(kind) && Math.max(sx, sz) > SEGMENT * 1.8 && Math.max(sx, sz) <= 40) { out.push(...segmentThings(id, kind, g.boxes, g.min, g.max)); continue; }
    if (Math.max(sx, sz) > 7) continue;
    if (APPLIANCE_KINDS.has(kind)) { const t = applianceThing(c, id, kind, g.boxes, []); if (t) out.push(t); continue; }
    const cx = (g.min[0] + g.max[0]) / 2, cz = (g.min[2] + g.max[2]) / 2, y0 = g.min[1];
    const chair = kind === 'chair' && Math.max(sx, sz) < 0.8 && sy < 1.2;
    const seat = chair ? seatMatOf(g.boxes) : 'plasticRed';
    out.push({
      id, kind, min: [...g.min] as Vec3, max: [...g.max] as Vec3, boxes: g.boxes, own: g.boxes,
      local: () => { const drawn: Box[] = []; return chair ? chairParts(1, seat) : boxParts(kind === 'lockers' && lockerGroup(g.boxes, drawn) ? drawn : g.boxes, cx, y0, cz); },
      remove: (cc, keep) => removeBoxes(cc, g.boxes, keep),
    });
  }
  // 単体の家具と、単体の自販機（前面の箔も一緒に）
  let n = 0;
  for (const b of interior) {
    if (!b.solid || b.propGroup || !b.kind || b.min[1] > 0.3) continue;
    const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
    if (sy > 2.8 || Math.max(sx, sz) > 4 || Math.min(sx, sz) < MIN_DEPTH || EXCLUDED.test(b.kind)) continue;
    if (b.kind === 'vending') { const t = applianceThing(c, `vend#${n++}`, 'vending', [b], thin); if (t) out.push(t); continue; }
    if (!SOLO_KINDS.test(b.kind)) continue;
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    out.push({ id: `solo#${n++}`, kind: b.kind, min: [...b.min] as Vec3, max: [...b.max] as Vec3, boxes: [b], own: [b], local: () => boxParts([b], cx, b.min[1], cz), remove: (cc, keep) => removeBoxes(cc, [b], keep) });
  }
  // 並べて描く物（InstanceSpec の 1 個）
  for (const sp of c.L.instances ?? []) {
    const deco = !sp.shape && (!sp.solid || sp.size[1] < 0.3 || /plant|grass|wheat|light|led|neon|screen/.test(sp.mat));
    if (deco || sp.shape === 'exhibit' || Math.min(sp.size[0], sp.size[2]) < MIN_DEPTH || /door/i.test(sp.mat)) continue;
    for (const tr of sp.transforms) {
      if (tr.pos[1] > 1.2) continue;
      const s = tr.scale ?? 1, [w, h, d] = sp.size;
      const cs = Math.abs(Math.cos(tr.yaw)), sn = Math.abs(Math.sin(tr.yaw));
      const hx = (cs * w + sn * d) / 2 * s, hz = (sn * w + cs * d) / 2 * s;
      const min: Vec3 = [tr.pos[0] - hx, tr.pos[1], tr.pos[2] - hz], max: Vec3 = [tr.pos[0] + hx, tr.pos[1] + h * s, tr.pos[2] + hz];
      const shape = sp.shape;
      out.push({
        id: `inst#${n++}`, kind: shape ?? `inst:${sp.mat}`, min, max, own: [],
        local: () => shape
          ? [{ prim: 'appliance', mat: sp.mat, pos: [0, 0, 0], rot: [0, tr.yaw, 0], size: [w * s, h * s, d * s], appliance: { shape, accent: sp.accent, screen: sp.screen, variant: sp.variant } }]
          : [{ prim: 'box', mat: sp.mat, pos: [0, h * s / 2, 0], rot: [0, tr.yaw, 0], size: [w * s, h * s, d * s] }],
        remove: (cc, keep) => removeInstance(cc, sp, tr, keep, min, max),
      });
    }
  }
  // 上に何かが載っている物（洗濯機の上の乾燥機・机の上の CRT など）は動かさない（載っている物が宙に浮く）
  // 低い物の上（寝椅子の座面 0.3 m の上の背もたれなど）も拾うよう、床から 0.1 m より上の物を見る
  const loose = interior.filter((b) => b.min[1] > 0.1);
  const tops = (c.L.instances ?? []).flatMap((sp) => sp.transforms.filter((tr) => tr.pos[1] > 0.1).map((tr) => tr.pos));
  return out.filter((t) => {
    const own = new Set(t.own);
    const y = t.max[1], x0 = t.min[0] + 0.05, x1 = t.max[0] - 0.05, z0 = t.min[2] + 0.05, z1 = t.max[2] - 0.05;
    if (loose.some((b) => !own.has(b) && !(t.group && inFamily(b, t.group)) && Math.abs(b.min[1] - y) < 0.06 && b.min[0] < x1 && b.max[0] > x0 && b.min[2] < z1 && b.max[2] > z0)) return false;
    // 並べて描く物は置いた点（底面の中心）で見る。端に載る物（寝椅子の背もたれ）を拾うよう外形は縮めない
    return !tops.some((q) => Math.abs(q[1] - y) < 0.06 && q[0] >= t.min[0] - 0.02 && q[0] <= t.max[0] + 0.02 && q[2] >= t.min[2] - 0.02 && q[2] <= t.max[2] + 0.02);
  });
}

/** 動かした物の種類の内訳（部屋のメモ `disorder kinds: washer×40 table×3`。tools/seam-stats.mjs が集計する） */
function kindsOf(ts: Thing[]): string {
  const n = new Map<string, number>();
  for (const t of ts) n.set(t.kind || '?', (n.get(t.kind || '?') ?? 0) + 1);
  return `disorder kinds: ${[...n].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')}`;
}

/** 小さな物（散乱・積み重なりの材料。一辺 1.5 m・高さ 1.3 m 以内） */
function small(t: Thing): boolean { const [sx, sy, sz] = sizeOf(t); return Math.max(sx, sz) <= 1.5 && sy <= 1.3; }

/** 入口から見える物を先に、残りは乱数順 */
function focusFirst(c: Ctx, ts: Thing[]): Thing[] {
  const sh = c.rng.shuffle(ts);
  return [...sh.filter((t) => inFocus(c, { min: t.min, max: t.max })), ...sh.filter((t) => !inFocus(c, { min: t.min, max: t.max }))];
}

// ---------------------------------------------------------------- 部品の姿勢

function boundsOf(parts: MonumentPart[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) { const b = partBounds(p); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); } }
  return { min, max };
}

/** 部品の組を底が y になるよう上下にずらす */
function settle(parts: MonumentPart[], y: number): MonumentPart[] {
  const dy = y - boundsOf(parts).min[1];
  return parts.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] + dy, p.pos[2]] as Vec3 }));
}

/** 乱れた姿勢（横倒し 4 方向・傾き・向きだけ、背の低い物は逆さも） */
function fallenPose(c: Ctx, tall: boolean, yawJitter = Math.PI): Vec3 {
  const yaw = c.rng.float(-yawJitter, yawJitter);
  const poses: Vec3[] = [[Math.PI / 2, yaw, 0], [-Math.PI / 2, yaw, 0], [0, yaw, Math.PI / 2], [0, yaw, -Math.PI / 2], [c.rng.float(-0.35, 0.35), yaw, c.rng.float(-0.35, 0.35)], [0, yaw, 0]];
  if (!tall) poses.push([0, yaw, Math.PI]);
  return pick(c.rng, poses);
}

/** 物を姿勢 pose で (x, z) に置いた部品（底 = y） */
function posed(t: Thing, pose: Vec3, x: number, z: number, y: number): MonumentPart[] {
  return settle(placeGroup(t.local(), pose, [x, 0, z]), y);
}

/** 倒した後の高さが自然か（長い物を縦に立てない。天井に届かない） */
function heightOk(c: Ctx, t: Thing, b: { min: Vec3; max: Vec3 }): boolean {
  const h = b.max[1] - b.min[1];
  return h <= Math.max(sizeOf(t)[1], 2.0) + 0.02 && b.max[1] <= c.h - 0.2;
}

/** 壁を越えた分だけ部屋の内側へずらす（壁際の物は部屋の側へ倒れる） */
function keepInside(c: Ctx, parts: MonumentPart[]): MonumentPart[] {
  const r = inner(mainRect(c), WALL_T + 0.08), b = boundsOf(parts);
  const mx = (b.min[0] + b.max[0]) / 2, mz = (b.min[2] + b.max[2]) / 2;
  if (mx < r.x0 || mx > r.x1 || mz < r.z0 || mz > r.z1) return parts; // 主矩形の外（L 字の袖など）はそのまま
  const shift = (lo: number, hi: number, a0: number, a1: number) => (hi - lo > a1 - a0 ? 0 : lo < a0 ? a0 - lo : hi > a1 ? a1 - hi : 0);
  const dx = shift(b.min[0], b.max[0], r.x0, r.x1), dz = shift(b.min[2], b.max[2], r.z0, r.z1);
  if (!dx && !dz) return parts;
  return parts.map((p) => ({ ...p, pos: [p.pos[0] + dx, p.pos[1], p.pos[2] + dz] as Vec3 }));
}

/** 部品の組の床の足跡（当たり判定。高さ 1 m まで） */
function footprintBox(parts: MonumentPart[]): Box {
  const b = boundsOf(parts);
  return { min: [b.min[0] + 0.03, Math.max(0, b.min[1]), b.min[2] + 0.03], max: [b.max[0] - 0.03, Math.max(0.1, Math.min(1.0, b.max[1])), b.max[2] - 0.03], mat: 'void', solid: true, kind: 'colliderOnly' };
}

function pushClutter(c: Ctx, parts: MonumentPart[]): void {
  if (!parts.length) return;
  (c.L.monuments ??= []).push({ id: `clutter:${c.L.monuments?.length ?? 0}`, kind: 'clutter', pos: [0, 0, 0], yaw: 0, parts });
}

/** 物を置く範囲: 強いと入口正面（focus）、弱いと主矩形のどこか（一辺 side m） */
function areaFor(c: Ctx, strength: Strength, side: number): Rect | null {
  const r = inner(mainRect(c), WALL_T + 0.6);
  if (r.x1 - r.x0 < 2.5 || r.z1 - r.z0 < 2.5) return null;
  const s = Math.min(side, r.x1 - r.x0, r.z1 - r.z0);
  const f = strength === 'strong' ? c.focus : r;
  const cx0 = Math.max(r.x0 + s / 2, Math.min(r.x1 - s / 2, strength === 'strong' ? (f.x0 + f.x1) / 2 : c.rng.float(r.x0 + s / 2, r.x1 - s / 2)));
  const cz0 = Math.max(r.z0 + s / 2, Math.min(r.z1 - s / 2, strength === 'strong' ? (f.z0 + f.z1) / 2 : c.rng.float(r.z0 + s / 2, r.z1 - s / 2)));
  return { x0: cx0 - s / 2, z0: cz0 - s / 2, x1: cx0 + s / 2, z1: cz0 + s / 2 };
}

/** 足跡が置けるか: 扉前・壁（と廊下の動線）を避ける。ignoreSolids なら他のソリッドの家具にも重なってよい（折り重なる） */
function footOk(c: Ctx, foot: Box, ignoreSolids: boolean, ignore?: (q: Box) => boolean, lanes = isCorridor(c)): boolean {
  return canPlace(c, foot, { margin: WALL_T + 0.05, gap: 0.0, lanes, ignore: (q) => (ignore?.(q) ?? false) || (ignoreSolids && q.solid) });
}

/** 物の箱か（置けるかの判定で無視する）。区画に分けた列は propGroup ごと */
function ownerTest(ts: Thing[]): (q: Box) => boolean {
  const boxes = new Set(ts.flatMap((t) => t.own));
  const groups = new Set(ts.flatMap((t) => (t.group ? [t.group] : [])));
  return (q) => boxes.has(q) || (q.propGroup !== undefined && groups.has(q.propGroup.split('|')[0]));
}

/**
 * 物どうしの外形（立っている物・動かした物）。並べて描く物は箱の当たり判定に出てこないので、乱れの置き場所はここでも見る。
 * tol m 以上重なると当たり（接して並んだ物どうしは当たらない）
 */
class Occupancy {
  private m: Map<Thing, { min: Vec3; max: Vec3 }>;
  constructor(ts: Thing[]) { this.m = new Map(ts.map((t) => [t, { min: t.min, max: t.max }])); }
  hits(self: Thing | null, b: { min: Vec3; max: Vec3 }, tol = 0.04): boolean {
    for (const [o, q] of this.m) {
      if (o === self) continue;
      if (b.min[0] < q.max[0] - tol && b.max[0] > q.min[0] + tol && b.min[1] < q.max[1] - tol && b.max[1] > q.min[1] + tol && b.min[2] < q.max[2] - tol && b.max[2] > q.min[2] + tol) return true;
    }
    return false;
  }
  set(t: Thing, b: { min: Vec3; max: Vec3 }): void { this.m.set(t, b); }
}

// ---------------------------------------------------------------- 1. 転倒

const toppled: Oddity = {
  id: 'disorder.toppled', category: 'disorder', weight: 5, theme: true,
  applicable(c) { return things(c).length >= 2; },
  apply(c, strength) {
    const movedThings: Thing[] = [];
    const all = focusFirst(c, things(c));
    const want = Math.min(strength === 'strong' ? 60 : 25, Math.max(1, Math.round(all.length * (strength === 'strong' ? 0.6 : 0.3))));
    // 物どうしは貫通させない（立っている隣の物・先に倒した物）。物の箱はソリッド判定から外し、Occupancy で見る
    const occ = new Occupancy(all);
    const isThing = ownerTest(all), extra = new Set<Box>();
    const ignore = (q: Box) => isThing(q) || extra.has(q);
    const clutter: MonumentPart[] = [];
    let done = 0, nHit = 0, nFoot = 0;
    for (const t of all) {
      if (done >= want || !budgetOk(c, 1)) break;
      const [cx, cz] = centerOf(t);
      // 倒れた先が壁・扉前・隣の物に掛かりやすいので姿勢を数回試す。倒れた物は元の外形の一辺を軸に倒れた位置へもずらして試す（列の物は空いた側へ倒れる）
      let parts: MonumentPart[] = [], foot: Box | null = null;
      for (let tries = 0; tries < 6 && !foot; tries++) {
        // 初めは元の向きの近くで倒す。だめなら向きも崩す
        const base = posed(t, fallenPose(c, sizeOf(t)[1] > 1.3, tries < 4 ? 0.3 : Math.PI), cx, cz, t.min[1] + 0.004);
        const b0 = boundsOf(base);
        const ex = Math.max(0, (b0.max[0] - b0.min[0] - (t.max[0] - t.min[0])) / 2), ez = Math.max(0, (b0.max[2] - b0.min[2] - (t.max[2] - t.min[2])) / 2);
        const shifts: [number, number][] = [[0, 0], ...c.rng.shuffle<[number, number]>([[ex, 0], [-ex, 0], [0, ez], [0, -ez]])];
        for (const [dx, dz] of shifts) {
          const moved = keepInside(c, dx || dz ? base.map((p) => ({ ...p, pos: [p.pos[0] + dx, p.pos[1], p.pos[2] + dz] as Vec3 })) : base);
          const f = footprintBox(moved);
          if (!heightOk(c, t, boundsOf(moved)) || occ.hits(t, boundsOf(moved))) { nHit++; continue; }
          // 背の高い物（ロッカー・自販機・筐体）は入口→出口の動線に倒さない（通路をふさがない）
          if (!footOk(c, f, false, ignore, isCorridor(c) || sizeOf(t)[1] > 1.3)) { nFoot++; continue; }
          parts = moved; foot = f;
          break;
        }
      }
      if (!foot) continue;
      t.remove(c, false);
      occ.set(t, boundsOf(parts));
      if (Math.max(foot.max[0] - foot.min[0], foot.max[2] - foot.min[2]) >= 0.4) { c.L.boxes.push(foot); extra.add(foot); }
      clutter.push(...parts);
      done++;
      movedThings.push(t);
    }
    if (!done) { c.note(`toppled: none of ${all.length} (hit ${nHit} / blocked ${nFoot})`); return false; }
    pushClutter(c, clutter);
    c.note(`toppled: ${done}/${all.length} things`); c.note(kindsOf(movedThings));
    return true;
  },
};

// ---------------------------------------------------------------- 2. 散乱

const scatter: Oddity = {
  id: 'disorder.scatter', category: 'disorder', weight: 6, theme: true,
  applicable(c) { const r = mainRect(c); return !isCorridor(c) && Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 3.5 && things(c).filter(small).length >= 4; },
  apply(c, strength) {
    const movedThings: Thing[] = [];
    const area = areaFor(c, strength, strength === 'strong' ? c.rng.float(6, 9) : c.rng.float(3.5, 5));
    if (!area) return false;
    const every = things(c);
    const occ = new Occupancy(every);
    const stock = focusFirst(c, every.filter(small));
    const n = Math.min(stock.length, strength === 'strong' ? c.rng.int(10, 24) : c.rng.int(4, 9));
    const parts: MonumentPart[] = [];
    let placed = 0;
    for (const t of stock) {
      if (placed >= n || !budgetOk(c, 2)) break;
      const own = ownerTest([t]);
      for (let tries = 0; tries < 4; tries++) {
        // 中心に寄せた分布（端ほど疎）
        const u = (c.rng.float(0, 1) + c.rng.float(0, 1)) / 2, v = (c.rng.float(0, 1) + c.rng.float(0, 1)) / 2;
        const moved = posed(t, fallenPose(c, false), area.x0 + u * (area.x1 - area.x0), area.z0 + v * (area.z1 - area.z0), 0.004);
        const foot = footprintBox(moved);
        // 散らした先では他の家具・先に散らした物に重ねない（元の自分は無視）
        if (!heightOk(c, t, boundsOf(moved)) || occ.hits(t, boundsOf(moved)) || !footOk(c, foot, false, own)) continue;
        t.remove(c, false);
        occ.set(t, boundsOf(moved));
        if (Math.max(foot.max[0] - foot.min[0], foot.max[2] - foot.min[2]) >= 0.4) c.L.boxes.push(foot);
        parts.push(...moved);
        placed++;
        movedThings.push(t);
        break;
      }
    }
    // 動かした物は元の場所から抜いてあるので、少なくても散らした分は描く
    pushClutter(c, parts);
    if (placed < 3) return placed > 0;
    c.note(`scatter: ${placed} things from the room`); c.note(kindsOf(movedThings));
    return true;
  },
};

// ---------------------------------------------------------------- 3. 積み重なり

const pile: Oddity = {
  id: 'disorder.pile', category: 'disorder', weight: 4, theme: true,
  applicable(c) { const r = mainRect(c); return !isCorridor(c) && Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 4 && c.h >= 2.4 && things(c).filter(small).length >= 6; },
  apply(c, strength) {
    const movedThings: Thing[] = [];
    const R = strength === 'strong' ? c.rng.float(1.2, 1.9) : c.rng.float(0.8, 1.2);
    const topMax = Math.min(c.h - 0.4, R * 1.6 + 0.8);
    const every = things(c);
    const stock = focusFirst(c, every.filter(small)).slice(0, strength === 'strong' ? c.rng.int(12, 22) : c.rng.int(6, 11));
    if (stock.length < 6) return false;
    const inStock = new Set(stock);
    const others = new Occupancy(every.filter((t) => !inStock.has(t)));
    const stockBoxes = ownerTest(stock);
    // 置き場所: 入口正面の左右（動線の横）→ 主矩形のどこか。材料以外のソリッド（ロッカー・柱・机）・扉前・動線・壁に掛からない所
    const r = inner(mainRect(c), WALL_T + 0.6);
    const f = c.focus, fx = (f.x0 + f.x1) / 2, fz = (f.z0 + f.z1) / 2;
    const cands: [number, number][] = [];
    if (strength === 'strong') for (const s2 of [1, -1]) cands.push([fx + s2 * (R + 1.4), fz], [fx, fz + s2 * (R + 1.4)]);
    for (let i = 0; i < 10; i++) cands.push([c.rng.float(r.x0 + R, Math.max(r.x0 + R, r.x1 - R)), c.rng.float(r.z0 + R, Math.max(r.z0 + R, r.z1 - R))]);
    const probe = (x: number, z: number): Box => ({ min: [x - R, 0, z - R], max: [x + R, topMax, z + R], mat: 'void', solid: true, kind: 'colliderOnly' });
    const spot = cands.find(([x, z]) => !others.hits(null, probe(x, z), 0) && canPlace(c, probe(x, z), { margin: WALL_T + 0.1, gap: 0.02, ignore: stockBoxes }));
    if (!spot) return false;
    const [cx, cz] = spot;
    const placed: { min: Vec3; max: Vec3 }[] = [];
    const parts: MonumentPart[] = [];
    stock.forEach((t, i) => {
      const k = i / stock.length;
      const rr = R * (1 - k * 0.75) * Math.sqrt(c.rng.float(0, 1));
      const a = c.rng.float(0, Math.PI * 2);
      const local = posed(t, fallenPose(c, false), cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, 0);
      const bb0 = boundsOf(local);
      // 下にある物の上に載せる（天面の 85% の高さ = 少し食い込む）
      let base = 0;
      for (const q of placed) if (q.min[0] < bb0.max[0] && q.max[0] > bb0.min[0] && q.min[2] < bb0.max[2] && q.max[2] > bb0.min[2]) base = Math.max(base, q.min[1] + (q.max[1] - q.min[1]) * 0.85);
      const moved = settle(local, base);
      const bb = boundsOf(moved);
      if (bb.max[1] > topMax || Math.hypot((bb.min[0] + bb.max[0]) / 2 - cx, (bb.min[2] + bb.max[2]) / 2 - cz) > R + 0.3) return;
      t.remove(c, false);
      placed.push(bb);
      movedThings.push(t);
      parts.push(...moved);
    });
    if (!placed.length) return false;
    const all = boundsOf(parts);
    c.L.boxes.push({ min: [cx - R * 0.6, 0, cz - R * 0.6], max: [cx + R * 0.6, Math.min(2.2, all.max[1]), cz + R * 0.6], mat: 'void', solid: true, kind: 'colliderOnly' });
    pushClutter(c, parts);
    c.note(`pile: ${placed.length} things from the room, h=${all.max[1].toFixed(1)}`); c.note(kindsOf(movedThings));
    return true;
  },
};

// ---------------------------------------------------------------- 4. バグのような重なり

/** 箱を新しい範囲で作り直す（propGroup を外し kind を odd に） */
function remade(b: Box, min: Vec3, max: Vec3, solid = b.solid): Box {
  return { min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])], max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])], mat: b.mat, solid, kind: ODD_KIND };
}

function replaceBoxes(c: Ctx, from: Box[], next: Box[]): void {
  for (let i = 0; i < from.length; i++) {
    const at = c.L.boxes.indexOf(from[i]);
    if (at >= 0) c.L.boxes[at] = next[i];
  }
}

const glitch: Oddity = {
  id: 'disorder.glitch', category: 'disorder', weight: 4, theme: true,
  applicable(c) { return things(c).length >= 1; },
  apply(c, strength) {
    const movedThings: Thing[] = [];
    const all = focusFirst(c, things(c));
    const want = strength === 'strong' ? c.rng.int(6, 12) : c.rng.int(2, 5);
    const clutter: MonumentPart[] = [];
    let done = 0;
    for (const t of all) {
      if (done >= want || !budgetOk(c, 1)) break;
      const [cx, cz] = centerOf(t);
      const y0 = t.min[1];
      const op = c.rng.float(0, 1);
      if (op < 0.4) {
        // 残像: 元の物は残し、少しずつずらした分身 2〜4 個（当たり判定なし）。同じ面が近いのでちらつく
        const k = c.rng.int(2, 4), dir = c.rng.float(0, Math.PI * 2), step = c.rng.float(0.04, 0.18), dy = c.rng.chance(0.3) ? c.rng.float(0.02, 0.1) : 0;
        for (let s = 1; s <= k; s++) clutter.push(...placeGroup(t.local(), [0, 0, 0], [cx + Math.cos(dir) * step * s, y0 + dy * s, cz + Math.sin(dir) * step * s]));
      } else if (op < 0.6) {
        // 回した分身を同じ場所に（2 つが貫通する）
        clutter.push(...placeGroup(t.local(), [0, pick(c.rng, [Math.PI / 2, Math.PI / 4, -Math.PI / 3]), 0], [cx, y0, cz]));
      } else if (op < 0.82 || !t.boxes) {
        // 床に沈む（高さの 3〜6 割）: 見た目は部品で下げ、当たり判定は見えている分だけ
        const sink = sizeOf(t)[1] * c.rng.float(0.3, 0.6);
        const parts = placeGroup(t.local(), [0, 0, 0], [cx, y0 - sink, cz]);
        t.remove(c, false);
        const foot = footprintBox(parts);
        foot.min[1] = 0;
        foot.max[1] = Math.max(0.1, Math.min(1, boundsOf(parts).max[1]));
        c.L.boxes.push(foot);
        clutter.push(...parts);
      } else {
        // 壁にめり込む（箱の家具）: 最も近い壁の方向へ、壁を越えて奥行きの 4〜6 割。壁の内面で切る（向こうの部屋へ突き抜けない）
        const r = mainRect(c);
        const dists: [number, Dir][] = [[cz - r.z0, 2], [r.z1 - cz, 0], [cx - r.x0, 3], [r.x1 - cx, 1]];
        dists.sort((a, b) => a[0] - b[0]);
        const [dist, d] = dists[0];
        if (dist > 2.5) continue;
        const depth = d === 0 || d === 2 ? t.max[2] - t.min[2] : t.max[0] - t.min[0];
        const gapToWall = d === 0 ? r.z1 - WALL_T - t.max[2] : d === 2 ? t.min[2] - (r.z0 + WALL_T) : d === 1 ? r.x1 - WALL_T - t.max[0] : t.min[0] - (r.x0 + WALL_T);
        const push = Math.max(0, gapToWall) + depth * c.rng.float(0.4, 0.6);
        const [ox, oz] = d === 0 ? [0, push] : d === 2 ? [0, -push] : d === 1 ? [push, 0] : [-push, 0];
        const face = d === 0 ? r.z1 - WALL_T : d === 2 ? r.z0 + WALL_T : d === 1 ? r.x1 - WALL_T : r.x0 + WALL_T;
        const ax = d === 0 || d === 2 ? 2 : 0, far = d === 0 || d === 1;
        const boxes = t.boxes;
        replaceBoxes(c, boxes, boxes.map((b) => {
          const mn: Vec3 = [b.min[0] + ox, b.min[1], b.min[2] + oz], mx: Vec3 = [b.max[0] + ox, b.max[1], b.max[2] + oz];
          if (far) { mx[ax] = Math.min(mx[ax], face); mn[ax] = Math.min(mn[ax], face - 0.005); }
          else { mn[ax] = Math.max(mn[ax], face); mx[ax] = Math.max(mx[ax], face + 0.005); }
          return remade(b, mn, mx);
        }));
      }
      done++;
      movedThings.push(t);
    }
    if (!done) return false;
    pushClutter(c, clutter);
    c.note(`glitch: ${done} things`); c.note(kindsOf(movedThings));
    return true;
  },
};

export const DISORDER_ODDITIES: Oddity[] = [toppled, scatter, pile, glitch];
