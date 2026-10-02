/**
 * 試験用の歩く人: 区画の開口をたどって、入口から目的の区画まで実際の移動（Sim）で歩く。瞬間移動はしない。
 * - 区画の中は、当たり判定から作った格子（0.125 m。点ごとに高さの違う面を持つ）で道を探す（穴・段・家具を避ける。
 *   穴の部屋では底・床板・梁が重なるので、足元の高さごとに別の状態として探す。頭の上の床板はくぐる）
 * - 動く歩道（歩く速さより強い force ゾーン）は向きのある道として探す（流れの向きにだけ進む）。流れの上では、流れの後ろに
 *   なった目標の点は飛ばす。流された・落ちた・道から外れたら道を引き直す
 * - 扉が閉まっていれば調べて開ける（開くのを待つ間も扉の手前までは歩く）。低い天井ではしゃがむ（頭がつかえたら）。
 *   残りの道のりが 10 秒縮まなければ失敗
 */
import { PLAYER, surfaceY } from '../../core/sim/player.ts';
import { pushBlockBox } from '../../core/sim/parts/move/mech.ts';
import type { Sim } from '../../core/sim/sim.ts';
import { IDLE_COMMAND, type InputCommand } from '../../core/sim/types.ts';
import { inRect } from '../../core/world/footprint.ts';
import type { CellLayout, FloorLayout, PortalSpec, Zone } from '../../core/world/layout.ts';
import { senseAdjust, senseDrive } from './sense-bot.ts';

export interface WalkResult { ok: boolean; reason: string; seconds: number; route: string[] }

/**
 * 仕掛けの解き方（部品の params.bot。手順の組 1 つか、その列。段階 4 の ground で足した）: 歩く人は、区画を出る前にこの手順をこなす
 * （棚を押す・箱を押す・印の上で待つ・円盤がそろうのを待つ）。遊び手と同じ操作だけを使う（移動・調べる・しゃがむ・待つ）。
 * - steps: 立つ所 at（足元）まで歩き、look があればそちらを調べ（E）、wait 秒と until（`部品.出力` が入るまで）待つ。crouch でしゃがんで待つ。
 *   through: 立つ所まで道を探さず、しゃがんでまっすぐ進む（腰の高さのバーの下をくぐる。道探しは立ったまま通れる所しか見ない）
 * - enterAt: この開口（外面の床の位置 [x, z]）から入ったときだけ（入口の向きで手順が違う仕掛け。無ければいつでも）
 * - only 'secret': 隠し場所（role 'secret' の区画）へ入るときだけ
 * - exitAt: この開口（外面の床の位置 [x, z]）から出るときだけ（スイッチで開く扉）
 * - doneIf: `部品.出力` が入っていれば手順を飛ばす（もう解けている）
 * - replanSec: この区画では道をこの間隔で引き直す（動く床）
 */
export interface BotStep { at: [number, number, number]; look?: [number, number, number]; wait?: number; until?: string; crouch?: boolean; through?: boolean }
export interface BotHint { steps: BotStep[]; enterAt?: [number, number]; exitAt?: [number, number]; only?: 'secret'; doneIf?: string; replanSec?: number }

const outputRef = (sim: Sim, ref: string): number => { const i = ref.lastIndexOf('.'); return sim.outputOf(ref.slice(0, i), ref.slice(i + 1)); };

/** 区画 cell を開口 exit から出る前にこなす手順（入ってきた開口 prev。区画の中から歩き始めるなら start） */
function hintSteps(floor: FloorLayout, cell: string, exit: PortalSpec, prev: PortalSpec | null, start: [number, number, number] | null): { step: BotStep; doneIf?: string }[] {
  const out: { step: BotStep; doneIf?: string }[] = [];
  const other = exit.cells[0] === cell ? exit.cells[1] : exit.cells[0];
  const toSecret = floor.cells.find((c) => c.id === other)?.role === 'secret';
  const hints = floor.entities.filter((e) => e.cell === cell && e.params.bot).flatMap((e) => (Array.isArray(e.params.bot) ? e.params.bot : [e.params.bot]) as unknown as BotHint[]).filter((h) => h.steps?.length && (h.only !== 'secret' || toSecret) && (!h.exitAt || Math.hypot(h.exitAt[0] - center(exit)[0], h.exitAt[1] - center(exit)[2]) < 1.2));
  const directed = hints.filter((h) => h.enterAt);
  let pickDirected: BotHint[] = [];
  if (prev) {
    const [px, , pz] = center(prev);
    pickDirected = directed.filter((h) => Math.hypot(h.enterAt![0] - px, h.enterAt![1] - pz) < 1.2);
  } else if (start && directed.length) {
    pickDirected = [directed.slice().sort((a, b) => Math.hypot(a.enterAt![0] - start[0], a.enterAt![1] - start[2]) - Math.hypot(b.enterAt![0] - start[0], b.enterAt![1] - start[2]))[0]!];
  }
  // 入ってきた向きの手順を先に（向こう岸から来たら、まず橋を架けて手前へ渡れるようにする）
  for (const h of [...pickDirected, ...hints.filter((x) => !x.enterAt)]) for (const s of h.steps) out.push(h.doneIf ? { step: s, doneIf: h.doneIf } : { step: s });
  return out;
}

/** 調べる用: 1 秒ごとに呼ばれる（区間・位置・残りの道のり） */
export const botDebug: { trace?: (msg: string) => void } = {};

function route(floor: FloorLayout, from: string, to: string): PortalSpec[] | null {
  // 隠し場所（role secret）は、行き先か出発点でなければ通らない道を先に探す（出現型の隠しは塞がっていて、遊ぶ人も知らない近道は使わない）。
  // 無ければ隠し場所も通る（隠しの奥・通り抜けを歩く試験）
  const secret = new Set(floor.cells.filter((c) => c.role === 'secret' && c.id !== from && c.id !== to).map((c) => c.id));
  // ほかの部品で開く扉（ボタンの扉など。inputs.open）は、ほかに道があればそちらを先に（向こう側のボタンを押さないと開かない）
  const remote = new Set(floor.entities.filter((e) => e.type === 'door' && e.inputs?.open).map((e) => e.id));
  return (remote.size ? routeAvoiding(floor, from, to, secret, remote) : null) ?? routeAvoiding(floor, from, to, secret) ?? routeAvoiding(floor, from, to, new Set());
}

function routeAvoiding(floor: FloorLayout, from: string, to: string, avoid: ReadonlySet<string>, avoidDoors: ReadonlySet<string> = new Set()): PortalSpec[] | null {
  const by = new Map<string, PortalSpec[]>();
  for (const p of floor.portals) for (const c of p.cells) by.set(c, [...(by.get(c) ?? []), p]);
  // 一方通行の扉（openSide のある扉）は cells[0] → cells[1] の向きだけ通れる（隠し通路の出口）
  const oneWay = new Set(floor.entities.filter((e) => e.type === 'door' && typeof e.params.openSide === 'number').map((e) => e.id));
  const prev = new Map<string, { cell: string; portal: PortalSpec } | null>([[from, null]]);
  const q = [from];
  for (let h = 0; h < q.length && !prev.has(to); h++) {
    for (const p of by.get(q[h]!) ?? []) {
      if (p.doorId && oneWay.has(p.doorId) && p.cells[1] === q[h]) continue;
      if (p.doorId && avoidDoors.has(p.doorId)) continue;
      // 段階 4（フロアの形）: 窓は通れない（見えるだけ）
      if (p.kind === 'window') continue;
      const o = p.cells[0] === q[h] ? p.cells[1] : p.cells[0];
      if (prev.has(o) || avoid.has(o)) continue;
      prev.set(o, { cell: q[h]!, portal: p });
      q.push(o);
    }
  }
  if (!prev.has(to)) return null;
  const out: PortalSpec[] = [];
  for (let c = to; prev.get(c); c = prev.get(c)!.cell) out.unshift(prev.get(c)!.portal);
  return out;
}

/**
 * 空間のゆがみの道（warp で足した）: 部品の params.warpLinks（{ from, to, at, interact? }）。区画 from の点 at へ行き、
 * 部品 interact を調べる（無ければ立って待つ）と区画 to へ移される（控え室の 3 枚目の扉・双子の部屋の扉 …）。
 * push（[x, z] の向き）があれば、着いたらその向きへ歩いて面をくぐる（光の枠）
 */
export interface WarpLink { from: string; to: string; at: [number, number, number]; interact?: string; push?: [number, number] }

export function warpLinks(floor: FloorLayout): WarpLink[] {
  const out: WarpLink[] = [];
  for (const e of floor.entities) {
    const ls = e.params.warpLinks;
    if (!Array.isArray(ls)) continue;
    for (const l of ls) {
      const o = l as { from?: unknown; to?: unknown; at?: unknown; interact?: unknown; push?: unknown };
      if (typeof o.from !== 'string' || typeof o.to !== 'string' || !Array.isArray(o.at)) continue;
      const link: WarpLink = { from: o.from, to: o.to, at: [Number(o.at[0]), Number(o.at[1]), Number(o.at[2])] };
      if (typeof o.interact === 'string') link.interact = o.interact;
      if (Array.isArray(o.push)) link.push = [Number(o.push[0]), Number(o.push[1])];
      out.push(link);
    }
  }
  return out;
}

type Step = { portal: PortalSpec; link?: undefined } | { link: WarpLink; portal?: undefined };

/** 開口と空間のゆがみの道をたどる道順（幅優先。窓は通らない・avoid の区画は通らない）。見つからなければ null */
function routeSteps(floor: FloorLayout, links: readonly WarpLink[], from: string, to: string, avoid: ReadonlySet<string>, avoidDoors: ReadonlySet<string> = new Set()): Step[] | null {
  const by = new Map<string, Step[]>();
  const oneWay = new Set(floor.entities.filter((e) => e.type === 'door' && typeof e.params.openSide === 'number').map((e) => e.id));
  for (const p of floor.portals) for (const c of p.cells) {
    if (p.doorId && oneWay.has(p.doorId) && p.cells[1] === c) continue;
    if (p.doorId && avoidDoors.has(p.doorId)) continue;
    if (p.kind === 'window') continue;
    by.set(c, [...(by.get(c) ?? []), { portal: p }]);
  }
  for (const l of links) by.set(l.from, [...(by.get(l.from) ?? []), { link: l }]);
  const prev = new Map<string, { cell: string; step: Step } | null>([[from, null]]);
  const q = [from];
  for (let h = 0; h < q.length && !prev.has(to); h++) {
    for (const st of by.get(q[h]!) ?? []) {
      const o = st.portal ? (st.portal.cells[0] === q[h] ? st.portal.cells[1] : st.portal.cells[0]) : st.link!.to;
      if (prev.has(o) || avoid.has(o)) continue;
      prev.set(o, { cell: q[h]!, step: st });
      q.push(o);
    }
  }
  if (!prev.has(to)) return null;
  const out: Step[] = [];
  for (let c = to; prev.get(c); c = prev.get(c)!.cell) out.unshift(prev.get(c)!.step);
  return out;
}

type Leg = { x: number; y: number; z: number; portal?: PortalSpec; via?: boolean; hint?: BotStep; doneIf?: string; press?: string; link?: WarpLink };

const center = (p: PortalSpec): [number, number, number] => [(p.aabb.min[0] + p.aabb.max[0]) / 2, p.aabb.min[1], (p.aabb.min[2] + p.aabb.max[2]) / 2];

/** 道を探す格子の間隔。幅 0.9 m の通り道（座席の列の脇など）でも、体の幅 + 余裕の範囲に格子点が必ず入るように細かく */
const G = 0.125;
/** 道の幅の判定に使う体の半径: プレイヤーの当たり判定（半辺 PLAYER.radius = 0.35 の箱）より少し太く。細いと角すれすれの道を選んで引っかかる */
const R = 0.36;
/** 余裕のある道の半幅（pathInCell が先に試す） */
const R_WIDE = 0.42;

/**
 * 点 (x, z) の半幅 S の正方形の下で立てる面の高さの一覧（当たり判定の箱の上面と面）。yTop + 0.36 より上は見ない。
 * 穴・溝の部屋では 1 つの点に、底・床板・梁のように高さの違う面が重なる
 */
function surfacesAt(sim: Sim, x: number, z: number, yTop: number, S: number, yLow = yTop - 14): number[] {
  const out: number[] = [];
  for (const b of sim.colliders.query(x - S, yLow, z - S, x + S, yTop + 0.4, z + S)) {
    if (b.max[1] > yTop + 0.36) continue; // 上にある物は足場にならない
    if (b.max[0] <= x - S || b.min[0] >= x + S || b.max[2] <= z - S || b.min[2] >= z + S) continue;
    out.push(b.max[1]);
  }
  for (const s of sim.surfaces) if (inRect(s.rect, x, z)) { const y = surfaceY(s, x, z); if (y <= yTop + 0.36) out.push(y); }
  return [...new Set(out.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
}

/** 道の幅の判定に使う体の半径（ふだんは R。道が見つからないときだけ、プレイヤーの当たり判定ちょうどで探し直す） */
let bodyR = R;

/** 体（足元 g から高さ h）が箱に当たるか */
function bodyBlocked(sim: Sim, x: number, z: number, g: number, h: number): boolean {
  for (const b of sim.colliders.query(x - bodyR, g + 0.37, z - bodyR, x + bodyR, g + h, z + bodyR)) {
    if (b.min[1] < g + h && b.max[1] > g + 0.37) return true;
  }
  return false;
}

/** 歩く速さより強い流れ（動く歩道）。これに逆らう向き・横切る向きには進めないとして道を探す */
const STRONG = 0.8 * PLAYER.walk;

/** 点（足元 y）に掛かる外力（force ゾーンの合計。プレイヤーと同じく足元 + 0.1 m で見る） */
function forceAt(zones: readonly Zone[], x: number, y: number, z: number): [number, number] {
  let fx = 0, fz = 0;
  const py = y + 0.1;
  for (const zn of zones) {
    const a = zn.aabb;
    if (x < a.min[0] || x > a.max[0] || py < a.min[1] || py > a.max[1] || z < a.min[2] || z > a.max[2]) continue;
    const v = zn.vector!;
    const l = Math.hypot(v[0], v[1], v[2]);
    if (l < 1e-6) continue;
    const k = (zn.params?.speed ?? 1) / l;
    fx += v[0] * k; fz += v[2] * k;
  }
  return [fx, fz];
}

/**
 * 区画の中で from → to の道（格子 G の幅優先。状態は点と足元の高さ）。見つからなければ null。
 * - 隣の点へは、その点で今の足元 + 0.36 m 以下のいちばん高い面に乗る（段は上れる・穴へは落ちる・頭の上の床板はくぐる）
 * - 強い流れ（動く歩道）の上では流れの向きにしか進めない。流れの外から入るときも流れの向きに
 */
export function pathInCell(sim: Sim, cell: CellLayout, from: [number, number, number], to: [number, number, number]): [number, number][] | null {
  // 段階 4（フロアの形の担当が足した）: まず家具の角から余裕を持った道（体の半幅 + 7 cm）。家具の角すれすれの道は、
  // 曲がり角で少し内側を回っただけで角に体が掛かって止まる
  bodyR = R_WIDE;
  let p: [number, number][] | null;
  try { p = pathInCellR(sim, cell, from, to); } finally { bodyR = R; }
  if (p) return p;
  p = pathInCellR(sim, cell, from, to);
  if (p) return p;
  // 段階 4（フロアの形の担当が足した）: 体の幅ぎりぎりの所（家具の塔のすき間など）は、当たり判定の半幅ちょうどで探し直す
  bodyR = PLAYER.radius - 0.01;
  try { return pathInCellR(sim, cell, from, to); } finally { bodyR = R; }
}

function pathInCellR(sim: Sim, cell: CellLayout, from: [number, number, number], to: [number, number, number]): [number, number][] | null {
  const b = cell.bounds;
  const nx = Math.ceil((b.max[0] - b.min[0]) / G) + 1, nz = Math.ceil((b.max[2] - b.min[2]) / G) + 1;
  if (nx * nz > 160000) return null;
  const idx = (i: number, k: number): number => k * nx + i;
  // 足場として見る高さの上限: 床から 0.5 m（階段・踊り場のある区画はその上面まで）。壁・天井の上面を足場にしない
  const stairTop = Math.max(-Infinity, ...cell.boxes.filter((x) => x.kind === 'stairStep' || x.kind === 'landing').map((x) => x.max[1]));
  const top = Math.max(cell.floorY + 0.15, Number.isFinite(stairTop) ? stairTop : -Infinity, from[1] + 0.05) - 0.36 + 0.5;
  // 段階 4（フロアの形）: 足場を探す下の端（区画の底まで。階段室は 2 階分下りることがある）
  // warp: 4 階ぶん積んだ階段室もあるので 14 m 下まで
  const low = Math.min(top - 14, b.min[1] - 0.5);
  const zones = [...sim.zones].filter((zn) => zn.kind === 'force' && zn.vector && (zn.params?.speed ?? 0) >= STRONG && zn.aabb.max[0] >= b.min[0] && zn.aabb.min[0] <= b.max[0] && zn.aabb.max[2] >= b.min[2] && zn.aabb.min[2] <= b.max[2]);
  const lifts = liftsOf(sim, b);
  /** 点 (x, z) へ足元 gc から上がれる高さ（縦につなぐ物の柱の中で、下端に届くなら上端。ほかは gc） */
  const liftAt = (x: number, z: number, gc: number): number => {
    let h = gc;
    for (const l of lifts) if (x >= l.x0 && x <= l.x1 && z >= l.z0 && z <= l.z1 && l.base <= gc + 0.36 && l.top > h) h = l.top;
    return h;
  };
  const cellOf = (x: number, z: number): [number, number] => [Math.round((x - b.min[0]) / G), Math.round((z - b.min[2]) / G)];
  // 点ごとの面: 体の真ん中の下（±0.05 m。真ん中が面の上に無い道、つまり梁・床の縁を体の端だけで歩く道は選ばない。
  // 体の端だけで乗っていると、少しずれただけで落ちる）と、体の下全体（±0.35 m。実際に立つ高さ）
  const surf = new Map<number, [number[], number[]]>();
  // 足跡の内側（壁の厚み 0.15 m を除く）。段階 4（フロアの形）: 複数の矩形の足跡（輪の部屋）は、矩形のつなぎ目を壁と見ない
  const inFoot = (x: number, z: number): boolean => cell.footprint.some((r) => inRect(r, x, z));
  const inside = (x: number, z: number): boolean => cell.footprint.length === 1 ? inRect(cell.footprint[0]!, x, z, 0.15) : inFoot(x, z) && inFoot(x - 0.15, z) && inFoot(x + 0.15, z) && inFoot(x, z - 0.15) && inFoot(x, z + 0.15);
  const surfAt = (i: number, k: number): [number[], number[]] => {
    const j = idx(i, k);
    let v = surf.get(j);
    if (!v) {
      const x = b.min[0] + i * G, z = b.min[2] + k * G;
      v = inside(x, z) ? [surfacesAt(sim, x, z, top, 0.05, low), surfacesAt(sim, x, z, top, PLAYER.radius, low)] : [[], []];
      surf.set(j, v);
    }
    return v;
  };
  const blockedCache = new Map<string, boolean>();
  // 面をくぐると移す部品（warpGate: 光の枠）の面は、道に使わない（くぐるのは空間のゆがみの道 push のときだけ。warp）
  const gates = sim.floor.entities.filter((e) => e.type === 'warpGate').map((e) => {
    const a = e.params.box as { min: number[]; max: number[] };
    const ax = (Number(e.params.dir) & 1) === 1 ? 0 : 2;
    return { a, ax, c: (a.min[ax]! + a.max[ax]!) / 2 };
  }).filter((q) => q.a.max[0]! >= b.min[0] && q.a.min[0]! <= b.max[0] && q.a.max[2]! >= b.min[2] && q.a.min[2]! <= b.max[2] && q.a.max[1]! >= b.min[1] && q.a.min[1]! <= b.max[1]);
  const onGate = (x: number, z: number, g: number): boolean => gates.some((q) => {
    const p = [x, g + 0.1, z];
    const lat = q.ax === 0 ? 2 : 0;
    return Math.abs(p[q.ax]! - q.c) < 0.15 && p[lat]! > q.a.min[lat]! - 0.3 && p[lat]! < q.a.max[lat]! + 0.3 && p[1]! > q.a.min[1]! && p[1]! < q.a.max[1]!;
  });
  const blocked = (i: number, k: number, g: number): boolean => {
    const key = `${idx(i, k)}|${g}`;
    let v = blockedCache.get(key);
    // 枠の面の上に移されて着いたとき（今いる所）は塞がない（塞ぐと道が無く、まっすぐ歩いて枠をくぐり直してしまう）
    if (v === undefined) { v = bodyBlocked(sim, b.min[0] + i * G, b.min[2] + k * G, g, 0.85) || (gates.length > 0 && onGate(b.min[0] + i * G, b.min[2] + k * G, g) && Math.hypot(b.min[0] + i * G - from[0], b.min[2] + k * G - from[2]) > 0.35); blockedCache.set(key, v); }
    return v;
  };
  /**
   * 足元 gc から点 (i, k) へ進んだときに立つ高さ: 体の下の面のうち gc + 0.36 m 以下でいちばん高い面（段は上る・穴へは落ちる）。
   * 真ん中の下の面がそれより 0.6 m 以上低い（体の端だけが縁に掛かっている）なら 'edge'。立てなければ null
   */
  const standAt = (i: number, k: number, gc: number): number | 'edge' | null => {
    const [center, full] = surfAt(i, k);
    const pick = (lim: number): [number, number] => {
      let p = -Infinity, c = -Infinity;
      for (const v of full) if (v <= lim && v > p) p = v;
      for (const v of center) if (v <= lim && v > c) c = v;
      return [p, c];
    };
    let [gp, gs] = pick(gc + 0.36);
    // 段階 4（移動と身体）: 縦につなぐ物（はしご・上昇気流・弾む床）の柱の中では、その上端まで上がれる
    // （体の下に高い面があれば、その高さへ上がる。縁に掛かっていても、上がりながら前へ出るので縁の判定はしない）
    const reach = liftAt(b.min[0] + i * G, b.min[2] + k * G, gc);
    if (reach > gc + 0.01) {
      // 体の幅より少し広く見る（体が面の縁に触れる所でも、上の面へ上がれる）
      let lp = -Infinity;
      for (const v of surfacesAt(sim, b.min[0] + i * G, b.min[2] + k * G, top, R + 0.08)) if (v <= reach + 0.36 && v > lp) lp = v;
      if (lp > -Infinity && lp >= gp && !blocked(i, k, lp)) return lp;
    }
    if (gp === -Infinity) return null;
    if (gs === -Infinity || gp > gs + 0.6) return 'edge';
    return blocked(i, k, gp) ? null : gp;
  };
  const [si, sk] = cellOf(from[0], from[2]);
  const [ti, tk] = cellOf(to[0], to[2]);
  const start = idx(Math.min(nx - 1, Math.max(0, si)), Math.min(nz - 1, Math.max(0, sk)));
  const goal = idx(Math.min(nx - 1, Math.max(0, ti)), Math.min(nz - 1, Math.max(0, tk)));
  // 状態: 点 j と足元の高さ g。鍵は `${j}|${g}`
  const prev = new Map<string, string>();
  const startKey = `${start}|${from[1]}`;
  prev.set(startKey, '');
  const q: [number, number][] = [[start, from[1]]];
  let found: string | null = null;
  for (let h = 0; h < q.length && !found; h++) {
    const [c, gc] = q[h]!;
    const ci = c % nx, ck = Math.floor(c / nx);
    const ck0 = `${c}|${gc}`;
    const fc = zones.length ? forceAt(zones, b.min[0] + ci * G, gc, b.min[2] + ck * G) : [0, 0];
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      let i = ci + di, k = ck + dk;
      if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
      let gs = standAt(i, k, gc);
      // 縁: 体の端だけが掛かっている所は通り過ぎる（同じ向きに 0.6 m まで進むと、体が縁から外れて下へ落ちる）。
      // 落ちる先は今より低い所だけ（縁を渡って同じ高さの別の床へ移る道は、少しずれただけで落ちるので選ばない）
      if (gs === 'edge') {
        for (let m = 0; gs === 'edge' && m < 5; m++) {
          if (i + di < 0 || k + dk < 0 || i + di >= nx || k + dk >= nz) { gs = null; break; }
          i += di; k += dk;
          gs = standAt(i, k, gc);
        }
        if (gs === 'edge' || (typeof gs === 'number' && gs > gc - 0.36)) gs = null;
      }
      const j = idx(i, k);
      const gn = gs ?? -Infinity;
      if (j === goal) {
        // 目標の点（開口の手前など）は、足元が届く高さなら着いたことにする（穴の底と、その真上の床板は別）
        const ok = (gn > -Infinity && Math.abs(gn - to[1]) < 1.2) || (gs === null && to[1] - 0.05 - gc <= 0.36 && Math.abs(gc - to[1]) < 1.2);
        if (ok) { found = `${j}|${gn > -Infinity ? gn : to[1]}`; prev.set(found, ck0); break; }
      }
      if (gs === null) continue;
      // 強い流れ: 流れの上・流れへ入るときは流れの向きにだけ進む。流れから出るときは逆向きでなければよい
      if (zones.length) {
        const fn = forceAt(zones, b.min[0] + i * G, gn, b.min[2] + k * G);
        const ln = Math.hypot(fn[0], fn[1]), lc = Math.hypot(fc[0], fc[1]);
        if (ln >= STRONG && (di * fn[0] + dk * fn[1]) / ln < 0.5) continue;
        if (lc >= STRONG && ln < STRONG && (di * fc[0] + dk * fc[1]) / lc < -0.1) continue;
      }
      const key = `${j}|${gn}`;
      if (prev.has(key)) continue;
      prev.set(key, ck0);
      q.push([j, gn]);
    }
  }
  if (!found) return start === goal ? [] : null;
  const pts: [number, number][] = [];
  for (let key = found; key !== startKey; key = prev.get(key)!) {
    const c = Number(key.split('|')[0]);
    pts.unshift([b.min[0] + (c % nx) * G, b.min[2] + Math.floor(c / nx) * G]);
  }
  // 間引き: 向きが変わる所だけ
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i - 1], p = pts[i]!, n = pts[i + 1];
    if (!a || !n || Math.sign(p[0] - a[0]) !== Math.sign(n[0] - p[0]) || Math.sign(p[1] - a[1]) !== Math.sign(n[1] - p[1])) out.push(p);
  }
  return out;
}

/** 点 (x, z) から線分 a-b までの距離 */
function distToSegment(x: number, z: number, a: [number, number], b: [number, number]): number {
  const ex = b[0] - a[0], ez = b[1] - a[1];
  const l2 = ex * ex + ez * ez;
  const k = l2 > 1e-9 ? Math.min(1, Math.max(0, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)) : 0;
  return Math.hypot(a[0] + ex * k - x, a[1] + ez * k - z);
}

/**
 * 段階 4（移動と身体）: 進む向き (dx, dz) の 0.8 m 先が振り子の板の払う所（板の面の前後 0.45 m）に入るなら、渡り切るまでの間
 * （歩く速さで払う所を抜ける時間）の板の位置を、振り子の式（params の周期・位相・振れ幅）で先読みし、体に当たるなら true（待つ）。
 * 払う所の中にいるなら止まらない
 */
function pendulumAhead(sim: Sim, p: { pos: number[] }, dx: number, dz: number): boolean {
  const dl = Math.hypot(dx, dz);
  if (dl < 1e-6) return false;
  const ux = dx / dl, uz = dz / dl;
  const time = sim.tick * sim.dt;
  for (const e of sim.floor.entities) {
    if (e.type !== 'pendulum') continue;
    const piv = e.params.pivot as number[], sw = e.params.swing as number[], half = e.params.half as number[];
    if (Math.hypot(piv[0]! - p.pos[0]!, piv[2]! - p.pos[2]!) > 4) continue;
    const ax = -sw[2]!, az = sw[0]!;
    const slab = Math.abs(ax) * half[0]! + Math.abs(az) * half[2]! + 0.45;
    const now = Math.abs((p.pos[0]! - piv[0]!) * ax + (p.pos[2]! - piv[2]!) * az);
    const ahead = Math.abs((p.pos[0]! + ux * 0.4 - piv[0]!) * ax + (p.pos[2]! + uz * 0.4 - piv[2]!) * az);
    if (now < slab || ahead >= slab) continue;
    const len = Number(e.params.len), amp = Number(e.params.amp), period = Number(e.params.period), phase = Number(e.params.phase ?? 0);
    const across = Math.abs(sw[0]!) * half[0]! + Math.abs(sw[2]!) * half[2]! + PLAYER.radius + 0.1;
    const me = (p.pos[0]! - piv[0]!) * sw[0]! + (p.pos[2]! - piv[2]!) * sw[2]!;
    // 払う所を抜けるまでの時間（歩き出しの遅れを足す）
    const T = (now + slab) / PLAYER.walk + 0.12;
    for (let k = 0; k * 0.04 <= T; k++) {
      const th = amp * Math.sin(((time + k * 0.04) / period) * Math.PI * 2 + phase);
      if (Math.abs(Math.sin(th) * len - me) < across) return true;
    }
  }
  return false;
}

/**
 * 段階 4（移動と身体）: 縦につなぐ物の柱（足元の範囲 x0..z1・下端 base・上がれる高さ top）。
 * はしご（climb ゾーン: 上端まで）・上昇気流（force の上向き: 上端 + 抜けてからの惰性）・弾む床（bouncePad: 跳ね上がる高さ）。
 * 柱の範囲は少し内側（端では柱から外れて上がれない）。高い面は柱の中の点で、体の幅より少し広く探す（standAt）
 */
export function liftsOf(sim: Sim, b: { min: number[]; max: number[] }): { x0: number; z0: number; x1: number; z1: number; base: number; top: number }[] {
  const out: { x0: number; z0: number; x1: number; z1: number; base: number; top: number }[] = [];
  const near = (a: { min: number[]; max: number[] }): boolean => a.max[0]! >= b.min[0]! - 1 && a.min[0]! <= b.max[0]! + 1 && a.max[2]! >= b.min[2]! - 1 && a.min[2]! <= b.max[2]! + 1;
  for (const z of sim.zones) {
    if (!near(z.aabb)) continue;
    if (z.kind === 'climb') out.push({ x0: z.aabb.min[0] + 0.1, z0: z.aabb.min[2] + 0.1, x1: z.aabb.max[0] - 0.1, z1: z.aabb.max[2] - 0.1, base: z.aabb.min[1], top: z.aabb.max[1] - 0.3 });
    // 深い水（泳ぐ）: 底から、水面から這い上がれる高さまで
    else if (z.kind === 'swim') out.push({ x0: z.aabb.min[0], z0: z.aabb.min[2], x1: z.aabb.max[0], z1: z.aabb.max[2], base: z.aabb.min[1], top: Number(z.params?.surface ?? z.aabb.max[1]) + 0.6 });
    else if (z.kind === 'force' && z.vector && z.vector[1] > 0.5) {
      const v = (z.params?.speed ?? 1) * z.vector[1] / Math.hypot(z.vector[0], z.vector[1], z.vector[2]);
      out.push({ x0: z.aabb.min[0] + 0.1, z0: z.aabb.min[2] + 0.1, x1: z.aabb.max[0] - 0.1, z1: z.aabb.max[2] - 0.1, base: z.aabb.min[1], top: z.aabb.max[1] + (v * v) / (2 * PLAYER.gravity) - 0.2 });
    }
  }
  for (const e of sim.floor.entities) {
    if (e.type !== 'bouncePad') continue;
    const a = e.params.aabb as { min: number[]; max: number[] };
    if (!near(a)) continue;
    const v = Number(e.params.speed ?? 7.2);
    out.push({ x0: a.min[0]! + 0.05, z0: a.min[2]! + 0.05, x1: a.max[0]! - 0.05, z1: a.max[2]! - 0.05, base: a.min[1]!, top: a.min[1]! + 0.1 + (v * v) / (2 * PLAYER.gravity) - 0.4 });
  }
  return out;
}

/** 段階 4（移動と身体）: 部品 type の範囲（params.aabb）に足元が入っているか */
function moveRegion(floor: FloorLayout, type: string, p: readonly number[]): FloorLayout['entities'][number] | null {
  for (const e of floor.entities) {
    if (e.type !== type) continue;
    const a = e.params.aabb as { min: number[]; max: number[] } | undefined;
    if (a && p[0]! >= a.min[0]! && p[0]! <= a.max[0]! && p[1]! + 0.1 >= a.min[1]! && p[1]! + 0.1 <= a.max[1]! && p[2]! >= a.min[2]! && p[2]! <= a.max[2]!) return e;
  }
  return null;
}

export function cellAtPos(floor: FloorLayout, p: [number, number, number]): CellLayout | null {
  let best: CellLayout | null = null;
  // 段階 4（フロアの形）: 上下に重なる区画（階・天井裏）では、足元がその区画の床から天井の間にある区画を先に（床の高い方）
  const stand = (c: CellLayout): boolean => p[1] >= c.floorY - 1.0 && p[1] <= c.floorY + c.height;
  for (const c of floor.cells) {
    const b = c.bounds;
    if (p[0] < b.min[0] || p[0] > b.max[0] || p[2] < b.min[2] || p[2] > b.max[2] || p[1] < b.min[1] - 3 || p[1] > b.max[1]) continue;
    if (best && stand(best) !== stand(c)) { if (stand(c)) best = c; continue; }
    if (best && stand(c) && Math.abs(c.floorY - best.floorY) > 0.5) { if (c.floorY > best.floorY) best = c; continue; }
    if (!best || (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]) < (best.bounds.max[0] - best.bounds.min[0]) * (best.bounds.max[2] - best.bounds.min[2])) best = c;
  }
  return best;
}

/** 区画 from から targetCell までの区間の目標（開口の手前 → 開口の先、仕掛けの手順・ボタン・点検口・空間のゆがみの道） */
function buildLegs(sim: Sim, floor: FloorLayout, from: string, targetCell: string, goal?: [number, number, number]): { legs: Leg[]; ids: string[] } | null {
  const links = warpLinks(floor);
  // 道順: 空間のゆがみの道が無ければ開口だけ（隠し場所を避ける route）。あれば開口とゆがみの道（warp）
  let steps: Step[] | null;
  if (!links.length) steps = route(floor, from, targetCell)?.map((portal): Step => ({ portal })) ?? null;
  else {
    const secret = new Set(floor.cells.filter((c) => c.role === 'secret' && c.id !== from && c.id !== targetCell).map((c) => c.id));
    const remote = new Set(floor.entities.filter((e) => e.type === 'door' && e.inputs?.open).map((e) => e.id));
    steps = (remote.size ? routeSteps(floor, links, from, targetCell, secret, remote) : null) ?? routeSteps(floor, links, from, targetCell, secret) ?? routeSteps(floor, links, from, targetCell, new Set());
  }
  if (!steps) return null;
  // 区間の目標: 開口の手前（扉なら調べる）→ 開口の先（空間のゆがみの道は、調べて移されるのを待つ）
  const legs: Leg[] = [];
  let cell = from;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i]!;
    if (st.link) { legs.push({ x: st.link.at[0], y: st.link.at[1], z: st.link.at[2], link: st.link }); cell = st.link.to; continue; }
    const p = st.portal;
    // 仕掛けの解き方の手順（params.bot）を、区画を出る開口の前に挟む
    for (const h of hintSteps(floor, cell, p, steps[i - 1]?.portal ?? null, i === 0 ? sim.players[0]!.pos : null)) legs.push({ x: h.step.at[0], y: h.step.at[1], z: h.step.at[2], hint: h.step, ...(h.doneIf ? { doneIf: h.doneIf } : {}) });
    const [x, y, z] = center(p);
    // 段階 4（試験の歩く人の追加）: スイッチで開く扉（扉の open が同じ区画のボタンの仕掛けにつながる）は、先にボタンを押しに行く
    const dspec = p.doorId ? floor.entities.find((e) => e.id === p.doorId) : undefined;
    const wire = dspec?.inputs?.open;
    const src = typeof wire === 'string' ? wire.split('.').slice(0, -2).join('.') : null;
    const btn = src ? floor.entities.find((e) => e.type === 'button' && e.id.startsWith(`${src}.`) && e.cell === cell) : undefined;
    const bc = btn ? floor.cells.find((c) => c.id === cell) : undefined;
    if (btn && bc) {
      const bb = btn.params.box as { min: number[]; max: number[] };
      const c = [(bb.min[0]! + bb.max[0]!) / 2, (bb.min[2]! + bb.max[2]!) / 2];
      const thinX = bb.max[0]! - bb.min[0]! < bb.max[2]! - bb.min[2]!;
      const mid = [(bc.bounds.min[0] + bc.bounds.max[0]) / 2, (bc.bounds.min[2] + bc.bounds.max[2]) / 2];
      const sx = thinX ? Math.sign(mid[0]! - c[0]!) : 0, sz = thinX ? 0 : Math.sign(mid[1]! - c[1]!);
      legs.push({ x: c[0]! + sx * 0.8, y: bc.floorY, z: c[1]! + sz * 0.8, press: btn.id });
    }
    const forward = p.cells[0] === cell ? 1 : -1;
    const d = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.dir]!;
    // 段階 4（フロアの形）: 天井の点検口（portal 'hole'。cells[0] が下の部屋、dir は梯子段を上る向き）。
    // 上るときは梯子段のいちばん上へ行き、そのまま上の通路へ。下りるときは穴の手前から穴へ踏み出して、梯子段の上へ落ちる
    if (p.kind === 'hole') {
      const half = (p.dir % 2 === 0 ? p.aabb.max[2] - p.aabb.min[2] : p.aabb.max[0] - p.aabb.min[0]) / 2;
      const yHigh = p.aabb.max[1];
      if (forward > 0) {
        legs.push({ x: x + d[0]! * (half - 0.15), y: yHigh, z: z + d[1]! * (half - 0.15), portal: p });
        legs.push({ x: x + d[0]! * (half + 0.9), y: yHigh, z: z + d[1]! * (half + 0.9), via: true });
      } else {
        legs.push({ x: x + d[0]! * (half + 0.45), y: yHigh, z: z + d[1]! * (half + 0.45), portal: p });
        legs.push({ x: x - d[0]! * 0.4, y: p.aabb.min[1], z: z - d[1]! * 0.4, via: true });
      }
      cell = p.cells[0] === cell ? p.cells[1] : p.cells[0];
      continue;
    }
    const prev = steps[i - 1]?.portal, next = steps[i + 1]?.portal;
    // 段階 4（フロアの形）: 階段室の上下の扉のように、同じ所の高さの違う開口どうしも離れているとみなす（高さも距離に入れる）
    const gap = (q: PortalSpec | undefined): number => { if (!q) return Infinity; const [qx, qy, qz] = center(q); return Math.hypot(qx - x, qy - y, qz - z) / 2; };
    const kb = Math.min(0.9, gap(prev)) * forward, ka = Math.min(0.9, gap(next)) * forward;
    legs.push({ x: x - d[0]! * kb, y, z: z - d[1]! * kb, portal: p });
    legs.push({ x: x + d[0]! * ka, y, z: z + d[1]! * ka, via: true });
    cell = p.cells[0] === cell ? p.cells[1] : p.cells[0];
  }
  if (goal) legs.push({ x: goal[0], y: goal[1], z: goal[2] });
  return { legs, ids: steps.map((x) => x.portal ? x.portal.id : `warp:${x.link!.from}>${x.link!.to}`) };
}

export function walkTo(sim: Sim, targetCell: string, goal?: [number, number, number], maxSec = 300): WalkResult {
  const floor = sim.floor;
  // 今いる区画から（初めは出てくる区画）
  const from = cellAtPos(floor, sim.players[0]!.pos)?.id ?? floor.spawn.cell;
  const planned = buildLegs(sim, floor, from, targetCell, goal);
  if (!planned) return { ok: false, reason: '道順がありません', seconds: 0, route: [] };
  let legs = planned.legs;
  let routeIds = planned.ids;
  const hasLinks = warpLinks(floor).length > 0;
  let waitWarp = 0, lastCell = from;
  const player = sim.players[0]!;
  let leg = 0;
  let path: [number, number][] = [];
  // 進み具合は「残りの道のり」（道を引いた所から目標まで）で測る。迷路・帯の回り道で目標から離れても止まったとみなさない
  let stuck = 0, bestD = Infinity, waitDoor = 0, crouch = 0, planY = player.pos[1], legT = 0, idle = 0, pushedFor = 0, pushDone = -1;
  let segFrom: [number, number] = [player.pos[0], player.pos[2]];
  const remaining = (): number => {
    let d = Math.hypot(path[0]![0] - player.pos[0], path[0]![1] - player.pos[2]);
    for (let i = 1; i < path.length; i++) d += Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]);
    return d;
  };
  const replan = (): void => { path = []; bestD = Infinity; };
  // 仕掛けの解き方の手順: 立つ所に着いてからの秒数（-1 は歩いている）・調べたか。動く床の区画の道の引き直しの間隔
  let hintT = -1, hintPressed = false, replanEvery = 0;
  let hold: [number, number][] | null = null;
  const ticks = Math.round(maxSec / sim.dt);
  for (let n = 0; n < ticks; n++) {
    const L = legs[leg];
    if (!L) return { ok: true, reason: '', seconds: n * sim.dt, route: routeIds };
    if (L.hint && hintT < 0 && L.doneIf && outputRef(sim, L.doneIf) > 0.5) { leg++; path = []; stuck = 0; bestD = Infinity; legT = 0; continue; }
    if (L.hint && hintT >= 0) {
      const h = L.hint;
      const hc: InputCommand = { ...IDLE_COMMAND, yaw: player.yaw, pitch: player.pitch, crouch: !!h.crouch };
      if (h.look && !hintPressed) {
        const ex = h.look[0] - player.pos[0], ez = h.look[2] - player.pos[2], ey = h.look[1] - (player.pos[1] + player.eye);
        hc.yaw = Math.atan2(-ex, -ez);
        hc.pitch = Math.atan2(ey, Math.hypot(ex, ez));
        hc.interact = { yaw: hc.yaw, pitch: hc.pitch };
        hintPressed = true;
      }
      sim.step([hc]);
      hintT += sim.dt;
      if ((hintT >= (h.wait ?? 0) && (!h.until || outputRef(sim, h.until) > 0.5)) || hintT > 60) { leg++; hintT = -1; hintPressed = false; stuck = 0; bestD = Infinity; legT = 0; path = []; }
      continue;
    }
    if (n % 15 === 0) {
      const c = cellAtPos(floor, player.pos);
      replanEvery = c ? Math.max(0, ...floor.entities.filter((e) => e.cell === c.id && e.params.bot).flatMap((e) => (Array.isArray(e.params.bot) ? e.params.bot : [e.params.bot]) as unknown as BotHint[]).map((h) => Number(h.replanSec ?? 0))) : 0;
    }
    if (replanEvery > 0 && n % Math.max(1, Math.round(replanEvery / sim.dt)) === 0) path = [];
    legT += sim.dt;
    // 段階 4: 重力の向きが回っている（筒の通路）: 筒は軸のまわりに回るので、軸に沿ってまっすぐ進む（道は引き直さない）。
    // 軸に沿う向きは回した座標でも同じ。向きの成分の大きい方の軸だけを使う
    if (player.grav) {
      const ax = player.grav.axis === 'x' ? 0 : 2;
      const d = (ax === 0 ? L.x - player.pos[0] : L.z - player.pos[2]);
      const yaw = ax === 0 ? Math.atan2(-Math.sign(d), 0) : Math.atan2(0, -Math.sign(d));
      const before = player.pos[ax]!;
      sim.step([{ ...IDLE_COMMAND, yaw, moveY: Math.abs(d) > 0.1 ? 1 : 0 }]);
      if (Math.abs(player.pos[ax]! - before) > 0.002) stuck = 0; else stuck++;
      if (stuck * sim.dt > 10) return { ok: false, reason: `止まった（重力の向きが回った中）: 位置 (${player.pos.map((v) => v.toFixed(2)).join(', ')})`, seconds: n * sim.dt, route: routeIds };
      path = [];
      continue;
    }
    // ボタンの前に着いた: ボタンを見て調べる（押す）
    if (L.press && Math.hypot(L.x - player.pos[0], L.z - player.pos[2]) < 0.45) {
      const bb = floor.entities.find((e) => e.id === L.press)!.params.box as { min: number[]; max: number[] };
      const ex = (bb.min[0]! + bb.max[0]!) / 2 - player.pos[0], ez = (bb.min[2]! + bb.max[2]!) / 2 - player.pos[2];
      const ey = (bb.min[1]! + bb.max[1]!) / 2 - (player.pos[1] + player.eye);
      const yaw = Math.atan2(-ex, -ez), pitch = Math.atan2(ey, Math.hypot(ex, ez));
      sim.step([{ ...IDLE_COMMAND, yaw, pitch, interact: { yaw, pitch } }]);
      for (let i = 0; i < 5; i++) sim.step([{ ...IDLE_COMMAND, yaw, pitch }]);
      leg++; stuck = 0; legT = 0; replan();
      continue;
    }
    if (botDebug.trace && n % 60 === 0) botDebug.trace(`t=${(n * sim.dt).toFixed(0)} leg ${leg}/${legs.length} pos ${player.pos.map((v) => v.toFixed(2)).join(',')} path ${path.length} best ${bestD.toFixed(2)} stuck ${stuck}`);
    // 段階 4: 押せる壁が端まで動いたら、道を引き直す（動かし終えた壁は避けて通る）
    let pd = 0;
    for (const e of floor.entities) if (e.type === 'pushBlock' && sim.outputOf(e.id, 'done') > 0.5) pd++;
    if (pd !== pushDone) { pushDone = pd; replan(); }
    // 光・音・視線・時間の仕掛け（sense-bot.ts）が歩き方を決める間は、その操作で進める（道探しをしない・止まったと数えない）
    const sc = senseDrive(sim, [L.x, L.y, L.z]);
    if (sc) { sim.step([sc]); path = []; bestD = Infinity; stuck = 0; continue; }
    // 区画の中の道を引き直す（区間の始まり・止まったとき・流された・落ちたとき）
    if (L.hint?.through) crouch = Math.max(crouch, 0.25);
    // 回転する部屋（warpTurnRoom）: 壁が動くので道を 1/3 秒ごとに引き直す。目標まで道が無ければ、筒の真ん中へ行って（行けなければその場で）待つ（warp）
    const tc = cellAtPos(floor, player.pos);
    const turn = tc ? floor.entities.find((e) => e.type === 'warpTurnRoom' && e.cell === tc.id) : undefined;
    if (turn && n % 20 === 0) { path = []; hold = null; }
    if (!turn) hold = null;
    if (!path.length) {
      // 段階 4（移動と身体）: 道を引くときは振り子の板を見ない（払う所の前で待つ。板の当たり判定は次の tick に部品が置き直す）
      for (const e of floor.entities) if (e.type === 'pendulum') sim.colliders.setDynamic(`${e.id}:bob`, null);
      // 段階 4: 回る床の柱（毎 tick 置き直される）と、まだ動かせる押せる壁も見ない（押して進む。押せる壁は道を引いたら戻す）
      const pushed: [string, ReturnType<typeof pushBlockBox>][] = [];
      for (const e of floor.entities) {
        if (e.type === 'spinFloor') ((e.params.posts as unknown[] | undefined) ?? []).forEach((_, i) => sim.colliders.setDynamic(`${e.id}:post${i}`, null));
        // ゴンドラの箱も見ない（行き来するので、乗らずに穴の底の階段を歩く）
        if (e.type === 'cableCar') for (const k of ['floor', 'sideA', 'sideB', 'gateA', 'gateB']) sim.colliders.setDynamic(`${e.id}:${k}`, null);
        if (e.type === 'pushBlock' && sim.outputOf(e.id, 'done') < 0.5) { pushed.push([`${e.id}:block`, pushBlockBox(e, sim.outputOf(e.id, 'off'))]); sim.colliders.setDynamic(`${e.id}:block`, null); }
      }
      const c = cellAtPos(floor, player.pos);
      const direct = c && !L.via && !L.hint?.through ? pathInCell(sim, c, player.pos, [L.x, L.y, L.z]) : null;
      path = direct ?? [];
      for (const [k, a] of pushed) sim.colliders.setDynamic(k, a);
      path.push([L.x, L.z]);
      segFrom = [player.pos[0], player.pos[2]];
      planY = player.pos[1];
      const inCell = !!c && L.x >= c.bounds.min[0] && L.x <= c.bounds.max[0] && L.z >= c.bounds.min[2] && L.z <= c.bounds.max[2];
      if (turn && c && !direct && inCell && !L.via) {
        const cc = turn.params.center as number[];
        const inside = Math.hypot(player.pos[0] - cc[0]!, player.pos[2] - cc[1]!) < Number(turn.params.radius) - 0.3;
        hold = inside ? [[cc[0]!, cc[1]!]] : (pathInCell(sim, c, player.pos, [cc[0]!, player.pos[1], cc[1]!]) ?? []);
      }
    }
    if (hold) {
      // 待つ: 筒の真ん中へ（道があれば）。着いたら立って待つ
      while (hold.length && Math.hypot(hold[0]![0] - player.pos[0], hold[0]![1] - player.pos[2]) < 0.3) hold.shift();
      const h = hold[0];
      const hx = h ? h[0] - player.pos[0] : 0, hz = h ? h[1] - player.pos[2] : 0;
      sim.step([{ ...IDLE_COMMAND, yaw: h ? Math.atan2(-hx, -hz) : player.yaw, pitch: 0, moveY: h ? 1 : 0 }]);
      stuck = 0; bestD = Infinity; legT = Math.max(0, legT - sim.dt);
      lastCell = cellAtPos(floor, player.pos)?.id ?? lastCell;
      continue;
    }
    // 強い流れ（動く歩道）の上: 流れの後ろになった目標の点は飛ばす（逆らって戻ろうとしない）
    const fz = player.zoneForce;
    const fl = Math.hypot(fz[0], fz[2]);
    while (fl >= STRONG && path.length > 1 && ((path[0]![0] - player.pos[0]) * fz[0] + (path[0]![1] - player.pos[2]) * fz[2]) / fl < -0.05) { segFrom = path.shift()!; }
    const tgt = path[0]!;
    const dx = tgt[0] - player.pos[0], dz = tgt[1] - player.pos[2];
    const dist = Math.hypot(dx, dz);
    const legD = Math.hypot(L.x - player.pos[0], L.z - player.pos[2]);
    // 弱い外力（部屋を吹き抜ける風など）は、押される分だけ逆へ向けて歩く（人と同じ。強い流れは上で別に扱う）
    let ax = dx, az = dz;
    if (fl > 1e-3 && fl < STRONG && dist > 1e-6) {
      const sp = PLAYER.walk * (player.crouching ? PLAYER.crouchSpeed : 1) * player.zoneSlow;
      ax = (dx / dist) * sp - fz[0]; az = (dz / dist) * sp - fz[2];
    }
    const cmd: InputCommand = { ...IDLE_COMMAND, yaw: Math.atan2(-ax, -az), pitch: 0, moveY: dist > 0.15 ? 1 : 0, crouch: crouch > 0 };
    if (waitDoor > 0) waitDoor -= sim.dt;
    if (crouch > 0) crouch -= sim.dt;
    // 同じ区画のマネキンからは目を離さない: マネキンの方を向いたまま、目標へ横歩きする（実際の遊び手と同じ）
    for (const e of floor.entities) {
      if (e.type !== 'mannequin') continue;
      const mp = sim.stateOf(e.id)?.pos as number[] | undefined;
      if (!mp || Math.hypot(mp[0]! - player.pos[0], mp[2]! - player.pos[2]) > 12) continue;
      const yaw = Math.atan2(-(mp[0]! - player.pos[0]), -(mp[2]! - player.pos[2]));
      const f = [-Math.sin(yaw), -Math.cos(yaw)], rr = [Math.cos(yaw), -Math.sin(yaw)];
      const dl = Math.max(1e-6, dist);
      const d = [dx / dl, dz / dl];
      cmd.yaw = yaw;
      cmd.pitch = -0.05;
      cmd.moveY = dist > 0.15 ? d[0]! * f[0]! + d[1]! * f[1]! : 0;
      cmd.moveX = dist > 0.15 ? d[0]! * rr[0]! + d[1]! * rr[1]! : 0;
    }
    // 段階 4（移動と身体）: 前を向くと押し戻される通路（facingPush）では、後ろ向きに歩く（向きを反対にして、後ろへ進む操作）
    // （入る少し手前から。向いている向きで決める: マネキンを見ながら横歩きしている時も同じ）
    const dl0 = Math.max(1e-6, dist);
    const push = moveRegion(floor, 'facingPush', player.pos) ?? moveRegion(floor, 'facingPush', [player.pos[0] + (dx / dl0) * 0.6, player.pos[1], player.pos[2] + (dz / dl0) * 0.6]);
    const pf = push?.params.fwd as number[] | undefined;
    if (pf && -Math.sin(cmd.yaw) * pf[0]! - Math.cos(cmd.yaw) * pf[2]! > 0) { cmd.yaw += Math.PI; cmd.moveY = -cmd.moveY; cmd.moveX = -cmd.moveX; }
    // 段階 4: 回転扉の筒の中では、目標の向きへ回るように羽を横へ押す（真ん中へ向かって押しても回らない）
    for (const e of floor.entities) {
      if (e.type !== 'revolvingDoor') continue;
      const c = e.params.center as number[], Rd = Number(e.params.radius);
      const ex = player.pos[0] - c[0]!, ez = player.pos[2] - c[2]!;
      if (Math.hypot(ex, ez) > Rd + 0.1 || Math.abs(player.pos[1] - c[1]!) > 1) continue;
      // 道が筒から出る所（道の点のうち筒の外の最初の点。無ければ区間の目標）の向きへ回す
      const out = path.find((q) => Math.hypot(q[0] - c[0]!, q[1] - c[2]!) > Rd + 0.3) ?? [L.x, L.z];
      const tx = out[0] - c[0]!, tz = out[1] - c[2]!;
      if (Math.hypot(tx, tz) < Rd + 0.3) continue;
      const phi = Math.atan2(ez, ex);
      let d = Math.atan2(tz, tx) - phi;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 0.35) {
        const sg = Math.sign(d);
        const vx = -Math.sin(phi) * sg, vz = Math.cos(phi) * sg;
        cmd.yaw = Math.atan2(-vx, -vz); cmd.moveY = 1; cmd.moveX = 0;
      }
    }
    // 段階 4: 押せる壁（pushBlock）の面に体が付いていて、目標が壁の向こうなら、壁の動く向きへまっすぐ押す
    for (const e of floor.entities) {
      if (e.type !== 'pushBlock' || sim.outputOf(e.id, 'done') > 0.5) continue;
      const ax = Number(e.params.axis), la = ax === 0 ? 2 : 0;
      const bb = pushBlockBox(e, sim.outputOf(e.id, 'off'));
      const r = PLAYER.radius;
      if (player.pos[la]! + r < bb.min[la]! + 0.1 || player.pos[la]! - r > bb.max[la]! - 0.1 || player.pos[1] > bb.max[1]! - 0.3) continue;
      const tgtA = ax === 0 ? L.x : L.z;
      const front = player.pos[ax]! + r <= bb.min[ax]! + 0.05 && player.pos[ax]! + r > bb.min[ax]! - 0.6 && tgtA > bb.max[ax]!;
      const back = player.pos[ax]! - r >= bb.max[ax]! - 0.05 && player.pos[ax]! - r < bb.max[ax]! + 0.6 && tgtA < bb.min[ax]!;
      if (!front && !back) continue;
      // 壁の動く向きへ押しながら、横は壁の真ん中へ寄る（壁の端で押すと、隣の動かない壁に体が掛かる）
      const v = front ? 1 : -1;
      const lat = Math.max(-0.8, Math.min(0.8, ((bb.min[la]! + bb.max[la]!) / 2 - player.pos[la]!) * 1.5));
      const wx = ax === 0 ? v : lat, wz = ax === 0 ? lat : v;
      cmd.yaw = Math.atan2(-wx, -wz);
      cmd.moveY = 1; cmd.moveX = 0;
    }
    // 段階 4: 歩くと伸びる廊下（stretchWarp）で進めなくなったら、しばらく立ち止まる（立ち止まると前へ滑る）
    if (idle > 0) { idle -= sim.dt; cmd.moveX = 0; cmd.moveY = 0; }
    // 段階 4: 振り子（pendulum）の払う所へ入る前は、板が通り過ぎて離れていくまで待つ（待つ間は止まったと数えない）
    const waiting = pendulumAhead(sim, player, dx, dz);
    if (waiting) { cmd.moveX = 0; cmd.moveY = 0; }
    // 空間のゆがみの道: 着いたら調べて（調べる物が無ければ立って）移されるのを待つ（warp）
    if (L.link && legD < 0.45 && path.length <= 1) {
      cmd.moveY = 0; cmd.moveX = 0;
      // 面をくぐる道: その向きへ歩く（移されるまで）
      if (L.link.push) { cmd.yaw = Math.atan2(-L.link.push[0], -L.link.push[1]); cmd.moveY = 1; }
      if (waitWarp <= 0 && L.link.interact) {
        const ent = floor.entities.find((e) => e.id === L.link!.interact);
        const pn = ent?.params.panel as { min: number[]; max: number[] } | undefined;
        const c = pn ? [(pn.min[0]! + pn.max[0]!) / 2, pn.min[1]! + 1.0, (pn.min[2]! + pn.max[2]!) / 2] : [L.x, L.y + 1.0, L.z];
        const ex = c[0]! - player.pos[0], ez = c[2]! - player.pos[2], ey = c[1]! - (player.pos[1] + player.eye);
        cmd.yaw = Math.atan2(-ex, -ez);
        cmd.pitch = Math.atan2(ey, Math.hypot(ex, ez));
        cmd.interact = { yaw: cmd.yaw, pitch: cmd.pitch };
        waitWarp = 1.5;
      }
    }
    if (waitWarp > 0) waitWarp -= sim.dt;
    const door = L.portal?.doorId;
    if (door && legD < 0.7 && Math.abs(player.pos[1] - L.y) < 1.2 && sim.outputOf(door, 'open') < 0.5 && waitDoor <= 0) {
      waitDoor = 1.0;
      const [px, py, pz] = center(L.portal!);
      const ex = px - player.pos[0], ez = pz - player.pos[2], ey = py + 1.0 - (player.pos[1] + player.eye);
      cmd.yaw = Math.atan2(-ex, -ez);
      cmd.pitch = Math.atan2(ey, Math.hypot(ex, ez));
      cmd.interact = { yaw: cmd.yaw, pitch: cmd.pitch };
      cmd.moveY = 0;
    }
    // 扉が開くのを待つ間も、扉の手前の目標までは歩く（崩れる床・動く歩道の上で立ち止まらない）
    senseAdjust(sim, cmd);
    const before: [number, number, number] = [player.pos[0], player.pos[1], player.pos[2]];
    sim.step([cmd]);
    // 移された（継ぎ目の無い移動・戻された）: 区画が変わった・空間のゆがみのあるフロアなら、今の区画から道順を引き直す（warp）
    if (Math.hypot(player.pos[0] - before[0], player.pos[1] - before[1], player.pos[2] - before[2]) > 1.5) {
      const now = cellAtPos(floor, player.pos)?.id ?? lastCell;
      // 歩くと伸びる廊下（stretchWarp）の戻しは、道を引き直さない（立ち止まって前へ滑るのを待つ。move）
      const stretch = floor.entities.some((e) => e.type === 'stretchWarp' && e.cell === now);
      if ((hasLinks && !stretch) || now !== lastCell) {
        // 面をくぐって移された（光の枠）: くぐった勢いのまま少し進んでから道を引く（面の上で向きを変えると、くぐり直して戻される）
        if (L.link?.push) for (let k = 0; k < 18; k++) sim.step([{ ...IDLE_COMMAND, yaw: player.yaw, moveY: 1 }]);
        const np = buildLegs(sim, floor, cellAtPos(floor, player.pos)?.id ?? now, targetCell, goal);
        if (np) { legs = np.legs; routeIds = np.ids; leg = 0; stuck = 0; legT = 0; waitWarp = 0; }
        lastCell = now;
        replan();
        continue;
      }
    }
    lastCell = cellAtPos(floor, player.pos)?.id ?? lastCell;
    // 仕掛けの解き方の手順の立つ所に着いた: 次の tick から調べる・待つ
    if (L.hint && dist < 0.3 && path.length <= 1 && Math.abs(player.pos[1] - L.y) < 1.2) { hintT = 0; path = []; continue; }
    // 目標の点に着いた（区間の終わりは高さも合っていること: 穴の底の扉の真上の床板の上では着いていない）
    // 途中の曲がり角の点は 0.2 m まで寄る（家具の角を内側で回らない。structure）。押す力の中（坂・滑り台・流れ）や寄れずに止まっているときは 0.3 m（move の滑り台）
    // 段差（階段・坂）の途中の点は 0.3 m（上り下りで足元の高さが変わり、0.2 m まで寄れないことがある）
    const near = path.length > 1 && fl <= 1e-3 && stuck * sim.dt < 0.5 && Math.abs(player.pos[1] - planY) < 0.1 ? 0.2 : 0.3;
    if (dist < near && (path.length > 1 || Math.abs(player.pos[1] - L.y) < 1.2)) {
      segFrom = path.shift()!;
      if (!path.length && !(door && sim.outputOf(door, 'open') < 0.5) && !L.link) { leg++; stuck = 0; bestD = Infinity; legT = 0; }
      // 空間のゆがみの道は、着いても移されるまで区間を進めない（warp）
      if (!path.length && L.link) path = [[L.x, L.z]];
      continue;
    }
    // 落ちた（穴・溝）・道から 1.2 m 以上外れた（流された・押された）: 道を引き直す
    const segD = distToSegment(player.pos[0], player.pos[2], segFrom, tgt);
    if (player.pos[1] < planY - 0.8 || segD > 1.2) { botDebug.trace?.(`replan: y ${player.pos[1].toFixed(2)} planY ${planY.toFixed(2)} segD ${segD.toFixed(2)}`); replan(); continue; }
    const rem = remaining();
    // 段階 4（移動と身体）: 向かい風・人の流れに押し戻されている間は、止まったと数えない（しゃがむと遅くなって渡れない）。
    // ただし 6 秒続いたら数える（いつまでも逆らえない流れ = 滑り台を上ろうとしている）
    pushedFor = fl > PLAYER.walk * 0.9 && fz[0] * dx + fz[2] * dz < 0 ? pushedFor + sim.dt : 0;
    const pushedBack = pushedFor > 0 && pushedFor < 6;
    if (rem < bestD - 0.05 || waitDoor > 0 || pushedBack || waiting || (L.link && legD < 0.6)) { bestD = Math.min(bestD, rem); stuck = 0; } else stuck++;
    // 進めないとき: しゃがんでみる・跳んでみる → 道を引き直す（段階 4: 伸びる廊下では立ち止まってみる）
    if (stuck * sim.dt > 1.0 && idle <= 0 && moveRegion(floor, 'stretchWarp', player.pos)) { idle = 3.2; stuck = 0; }
    if (stuck * sim.dt > 1.0 && crouch <= 0) { crouch = 3; path = []; }
    if (Math.round(stuck * sim.dt * 60) % 90 === 89) { sim.step([{ ...cmd, jump: true, crouch: false }]); }
    if (stuck * sim.dt > 10 || legT > 150) return { ok: false, reason: `止まった: 区間 ${leg}/${legs.length}（${L.x.toFixed(2)}, ${L.z.toFixed(2)}）位置 (${player.pos.map((v) => v.toFixed(2)).join(', ')})${L.portal ? ` 開口 ${L.portal.id}` : ''}${L.link ? ` 移る道 ${L.link.from}>${L.link.to}` : ''}`, seconds: n * sim.dt, route: routeIds };
  }
  return { ok: false, reason: '時間切れ', seconds: maxSec, route: routeIds };
}
