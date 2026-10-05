/**
 * 見本の部屋の追加の 2 部屋（layout.ts の buildShowroom から呼ぶ）。
 *
 * - 設備の部屋（service）: v2 の設備の小物 — 壁掛けの洗面器・ブースの便器・流し台（流し・水栓・コンロ）・自販機の見本・
 *   掲示板の紙・壁の灯り・消火器の台・診察台の枕とカーテン・体育館のリングと網・机の上の食器（異変の「さっきまで誰かいた」）
 * - 持てる物の部屋（carry）: v2 の仕掛けの持てる物（carryItem / carryBody の kind ごと）と、ボールプール
 * v2 の箱の作り（家具・壁・枠）はそのまま置き、作り込む物だけを形の関数にする。持てる物の見比べは v2 の buildShape（v2Shapes）
 */
import type { AABB } from '../../../../v2/core/math/aabb.ts';
import type { Dir } from '../../../../v2/core/math/vec.ts';
import { Rng } from '../../../../v2/core/math/rng.ts';
import type { Rect } from '../../../../v2/core/world/footprint.ts';
import { box, type Box, type Json, type MatId } from '../../../../v2/core/world/layout.ts';
import { SURFACES } from '../../../../v2/client/render/MaterialLibrary.ts';
import type { Face } from '../../../../v2/core/gen/dress/geom.ts';
import { desk, examBed, kitchenette } from '../../../../v2/core/gen/dress/props.ts';
import { booths, longTable, sinkRow, vending } from '../../../../v2/core/gen/dress/furniture.ts';
import { board, extinguisher as v2extinguisher, papers, sconce as v2sconce } from '../../../../v2/core/gen/dress/decor.ts';
import type { Exhibit, V2Shape } from './layout.ts';
import { place, type Rand, type Surfels, type V3 } from './surfel.ts';
import { kitchenTop, sconce, toilet, wallBasin } from './gen/fixtures.ts';
import { pinnedSheet } from './gen/paper.ts';
import { curtain, pillow } from './gen/fabric.ts';
import { vendingDisplay } from './gen/goods.ts';
import { ballPit, extinguisherStand, hoop, plate } from './gen/objects.ts';
import { bucketWater, CARRY_GEN, cup, type CarryColors } from './gen/carry.ts';


export interface ExtraApi {
  rooms: Record<string, { rect: Rect; theme: string; height: number }>;
  put: (room: string, ...boxes: Box[]) => void;
  add: (e: Exhibit) => void;
  look: (pos: [number, number], target: V3) => Exhibit['view'];
  core: (x: number, z: number, r: number, y0: number, y1: number, rz?: number) => AABB;
  take: (B: Box[], from: number, pred: (b: Box) => boolean) => Box[];
  plain: (b: Box, dy?: number) => Box;
  faceOf: (r: Rect, dir: Dir) => Face;
  seed: number;
}

const aabb = (min: V3, max: V3): AABB => ({ min: [...min], max: [...max] });
/** 壁の面 f の位置 at（面に沿う座標）から out だけ室内へ・高さ y の点 */
const fp = (f: Face, at: number, out: number, y: number): V3 => (f.horizontal ? [at, y, f.face + f.inward * out] : [f.face + f.inward * out, y, at]);
/** 壁の面の室内向き → place の向き（局所 +z が室内） */
const yawIn = (f: Face): number => { const front = (f.dir + 2) % 4; return front === 0 ? 0 : front === 1 ? Math.PI / 2 : front === 2 ? Math.PI : -Math.PI / 2; };

/** 箱 b から、xz の穴（hole）の所を y0 より上だけ抜いた箱の組（流しの下の空間を作る。描画の写しだけで使う） */
export function cutHole(b: Box, hole: { x0: number; x1: number; z0: number; z1: number }, y0: number): Box[] {
  const out: Box[] = [];
  const mk = (min: V3, max: V3): void => { if (max[0] - min[0] > 1e-4 && max[1] - min[1] > 1e-4 && max[2] - min[2] > 1e-4) out.push({ ...b, min, max }); };
  const [X0, Y0, Z0] = b.min, [X1, Y1, Z1] = b.max;
  const hx0 = Math.max(X0, hole.x0), hx1 = Math.min(X1, hole.x1), hz0 = Math.max(Z0, hole.z0), hz1 = Math.min(Z1, hole.z1);
  mk([X0, Y0, Z0], [X1, y0, Z1]);
  mk([X0, y0, Z0], [X1, Y1, hz0]);
  mk([X0, y0, hz1], [X1, Y1, Z1]);
  mk([X0, y0, hz0], [hx0, Y1, hz1]);
  mk([hx1, y0, hz0], [X1, Y1, hz1]);
  return out;
}

/** v2 の材質の色（持てる物の色に使う） */
export const matHex = (m: MatId | undefined, fallback = 0xcccccc): number => (m && SURFACES[m] ? (SURFACES[m].emissiveColor ?? SURFACES[m].color) : fallback);

export function extraRooms(api: ExtraApi): void {
  service(api);
  carry(api);
}

// ---------------------------------------------------------------- 設備の部屋
function service(api: ExtraApi): void {
  const { rooms, put, add, look, take, faceOf } = api;
  const r = rooms.service!.rect;
  const fN = faceOf(r, 2), fS = faceOf(r, 0), fW = faceOf(r, 3), fE = faceOf(r, 1);

  // 壁掛けの洗面器 2 つ（v2 の sinkRow。鏡と枠は v2 のまま、器・水栓・排水管を形の関数に）
  {
    const B: Box[] = [];
    sinkRow(B, fW, 1.0, 2);
    const cmp = take(B, 0, (b) => b.mat === 'marbleWhite' || b.mat === 'metal');
    put('service', ...B);
    const zs = [1.375, 2.125];
    add({ id: 'basins', name: '壁掛けの洗面器', room: 'service', group: '陶器の設備', note: 'くぼみのある白い陶器・平らな縁・排水口・水栓・下の S 字の排水管。鏡は v2 の箱', gen: (S, R) => { for (const z of zs) wallBasin(S, R, place(fp(fW, z, 0, 0), yawIn(fW))); }, own: aabb([fW.face, 0.4, 1.0], [fW.face + 0.5, 1.15, 2.5]), proxy: [], compare: cmp, view: look([fW.face + 1.6, 1.75], [fW.face + 0.25, 0.85, 1.75]) });
  }
  // 掲示板と画鋲の紙（v2 の board + papers。紙だけ形の関数）
  {
    const B: Box[] = [];
    const t = 4.2, w = 1.3, y0 = 1.15, y1 = 1.85;
    board(B, fW, t, w, y0, y1, 'noticeGreen');
    put('service', ...B);
    const P: Box[] = [];
    papers(P, new Rng(api.seed + 51), fW, t, w, y0, y1, 4);
    // 紙ごとの中心と大きさ（v2 の箱から）。板の面は壁から 0.032
    const sheets = P.map((b) => ({ c: (b.min[2] + b.max[2]) / 2, y: (b.min[1] + b.max[1]) / 2, w: b.max[2] - b.min[2], h: b.max[1] - b.min[1] }));
    const o = fp(fW, 0, 0.032, 0);
    add({ id: 'papers', name: '掲示板の紙', room: 'service', group: '紙・小物', note: '画鋲で留めた紙。下の角が浮いて反る・文字の行・色の画鋲', gen: (S, R) => { for (const s of sheets) pinnedSheet(S, R, place(o, yawIn(fW)), -s.c, s.y, s.w, s.h); }, own: aabb([fW.face, y0, t - w / 2], [fW.face + 0.06, y1, t + w / 2]), proxy: [], compare: P, view: look([fW.face + 1.4, t + 0.3], [fW.face, 1.5, t]) });
  }
  // 壁の灯り 2 つ（v2 の sconce: 光る箔は焼き込みの光源として残る）
  {
    const ts = [6.2, 8.2];
    const C: Box[] = [];
    for (const t of ts) v2sconce(C, fW, t, 1.6);
    add({ id: 'sconce', name: '壁の灯り', room: 'service', group: '丸い物・設備', note: '金色の座金と腕・チューリップ形の乳白ガラス（中が光る）', gen: (S, R) => { for (const t of ts) sconce(S, R, place(fp(fW, t, 0, 1.6), yawIn(fW))); }, own: aabb([fW.face, 1.6, 6.0], [fW.face + 0.15, 1.85, 8.4]), proxy: [], compare: C, view: look([fW.face + 1.5, 7.2], [fW.face + 0.08, 1.7, 7.2]) });
  }
  // トイレのブース 2 つ（扉は外して中を見せる）と便器
  {
    const B: Box[] = [];
    const a0 = -8.7;
    booths(B, fS, a0, 2, 1.4);
    take(B, 0, (b) => { const along = b.max[0] - b.min[0]; return Math.abs(along - 0.68) < 0.01 || (Math.abs(along - 0.05) < 0.005 && b.min[1] > 0.95 && b.max[1] < 1.1); });
    const cmp = take(B, 0, (b) => b.mat === 'marbleWhite');
    put('service', ...B);
    const xs = [a0 + 0.45, a0 + 0.9 + 0.45];
    add({ id: 'toilets', name: '洋式便器（ブースの中）', room: 'service', group: '陶器の設備', note: '台座・器・便座・ふた（開いた物と閉じた物）・タンク・洗浄レバー。ブースは v2 の箱（扉は外してある）', gen: (S, R) => { xs.forEach((x, i) => toilet(S, R, place(fp(fS, x, 0, 0), yawIn(fS)), i === 0)); }, own: aabb([a0, 0, fS.face - 0.7], [a0 + 1.8, 0.85, fS.face]), proxy: [], compare: cmp, view: look([a0 + 0.9, fS.face - 2.4], [a0 + 0.9, 0.45, fS.face - 0.3]) });
  }
  // 診察台の枕と、仕切りのカーテン（v2 の examBed + 布の箱）
  {
    const B: Box[] = [];
    const at = -5.6;
    examBed(B, fS, at, 0.18);
    const pil = take(B, 0, (b) => b.mat === 'whiteFabric' && b.min[1] > 0.64);
    put('service', ...B);
    const y1 = 2.4;
    const cur = [box([at - 0.1, 0.3, fS.face - 1.08], [at + 2.0, y1 - 0.06, fS.face - 1.05], 'whiteFabric', false), box([at - 0.1, y1 - 0.06, fS.face - 1.09], [at + 2.0, y1, fS.face - 1.04], 'metal', false)];
    const pc: V3 = [at + 0.25, 0, fS.face - 0.53];
    add({ id: 'clinic', name: '診察台の枕と仕切りのカーテン', room: 'service', group: '布もの', note: '白い枕と、ひだのある白いカーテン（レール付き）。診察台は v2 の箱', gen: (S, R) => { pillow(S, R, place(pc, Math.PI / 2), [0, 0.685, 0], 0.46, 0.36); curtain(S, R, place([0, 0, 0]), { x0: at - 0.1, x1: at + 2.0, y0: 0.3, y1: y1 - 0.06, z: fS.face - 1.065, color: 0xe8e6e0 }); }, own: aabb([at - 0.1, 0.3, fS.face - 1.1], [at + 2.0, y1, fS.face]), proxy: [], compare: [...pil, ...cur], view: look([at + 0.9, fS.face - 3.0], [at + 0.9, 1.2, fS.face - 1.0]) });
  }
  // 流し台（v2 の kitchenette。天板・流し・水栓・コンロを形の関数に。台の箱は流しの下だけ抜く）
  {
    const B: Box[] = [];
    const at = 5.8, len = 1.8, depth = 0.62;
    kitchenette(B, fE, at, len, 0.02);
    const sinkW = Math.min(0.7, len * 0.4);
    const s0 = len - sinkW - 0.15, s1 = len - 0.15;
    const cmp = take(B, 0, (b) => b.mat === 'stainless' || (b.mat === 'metalDark' && b.min[1] > 0.84 && b.max[1] < 0.9) || (b.mat === 'metal' && b.min[1] >= 0.85 && b.max[1] <= 1.13));
    const body = take(B, 0, (b) => b.solid && b.mat === 'furnitureLight' && b.max[1] < 0.83);
    // 流しの穴（部屋の座標。東の壁: 局所 x = 壁に沿う z、局所 z = 壁からの距離 → x = 面 − 距離）
    const hole = { x0: fE.face - (depth - 0.1), x1: fE.face - 0.12, z0: at + s0, z1: at + s1 };
    put('service', ...B, ...body.flatMap((b) => cutHole(b, hole, 0.82 - 0.18)));
    add({ id: 'kitchen', name: '流し台（流し・水栓・コンロ）', room: 'service', group: '丸い物・設備', note: 'ヘアラインのステンレスの天板、深い流しと排水口、曲がった水栓、コンロの五徳。台と吊り戸棚は v2 の箱', gen: (S, R) => kitchenTop(S, R, place([fE.face, 0.85, at], yawIn(fE)), { len, depth, sink: [s0, s1], hobs: [0.36, 0.71] }), own: aabb([fE.face - 0.7, 0.8, at], [fE.face, 1.15, at + len]), proxy: [], compare: cmp, view: look([fE.face - 1.5, at + 0.9], [fE.face - 0.35, 0.85, at + 0.9]) });
  }
  // 自販機の見本の列（v2 の vending の光る面の前。v2 には見本が無い）
  {
    const B: Box[] = [];
    const at = 2.2;
    vending(B, fE, at);
    put('service', ...B);
    const o = fp(fE, at + 0.41, 0.85 + 0.012, 0);
    add({ id: 'vending', name: '自販機の見本', room: 'service', group: '棚の商品', note: '光る面の前の見本（缶・ペットボトル）・値札・押しボタン・段の棚。自販機の本体は v2 の箱', gen: (S, R) => vendingDisplay(S, R, place(o, yawIn(fE)), { width: 0.62, rows: [1.2, 1.46], perRow: 6 }), own: aabb([o[0] - 0.1, 1.15, at], [o[0], 1.7, at + 0.9]), proxy: [], compare: [], view: look([fE.face - 2.0, at + 0.45], [o[0], 1.35, at + 0.45]) });
  }
  // 消火器の台（v2 の extinguisher の赤い箱の所）
  {
    const t = -1.6;
    const C: Box[] = [];
    v2extinguisher(C, fN, t);
    add({ id: 'extStand', name: '消火器と台', room: 'service', group: '丸い物・設備', note: '赤い鉄板の台（「消火器」の帯）に立つ消火器', gen: (S, R) => extinguisherStand(S, R, place(fp(fN, t, 0, 0), yawIn(fN))), own: aabb([t - 0.22, 0, fN.face], [t + 0.22, 0.65, fN.face + 0.2]), proxy: [], compare: C, view: look([t + 0.4, fN.face + 1.4], [t, 0.35, fN.face + 0.1]) });
  }
  // 体育館のリングと網（v2 の板と的は箱のまま、リングの板を形の関数に）
  {
    const t = -7.0;
    const B: Box[] = [
      box(fp(fN, t - 0.9, 0.02, 2.9), fp(fN, t + 0.9, 0.06, 3.95), 'paintWhite', false),
      box(fp(fN, t - 0.3, 0.06, 3.05), fp(fN, t + 0.3, 0.07, 3.45), 'plasticRed', false),
    ];
    put('service', ...B);
    const ring = [box(fp(fN, t - 0.23, 0.07, 3.03), fp(fN, t + 0.23, 0.5, 3.05), 'plasticRed', false)];
    add({ id: 'hoop', name: 'バスケットのリングと網', room: 'service', group: '丸い物・設備', note: '金属のリングと、すぼまって斜めに交わる網。v2 は平らな板', gen: (S, R) => hoop(S, R, place(fp(fN, t, 0.06, 3.04), yawIn(fN))), own: aabb([t - 0.3, 2.6, fN.face], [t + 0.3, 3.1, fN.face + 0.55]), proxy: [], compare: ring, view: look([t + 0.6, fN.face + 2.4], [t, 2.85, fN.face + 0.3]) });
  }
  // 机の上の食器（異変「さっきまで誰かいた」のマグと皿）
  {
    const B: Box[] = [];
    const cx = -4.6, cz = 5.2, top = 0.72;
    desk(B, cx, cz, 2, { screen: null });
    put('service', ...B);
    const C = [box([cx + 0.2, top, cz - 0.05], [cx + 0.28, top + 0.1, cz + 0.03], 'paintWhite', false), box([cx - 0.35, top, cz - 0.12], [cx - 0.11, top + 0.02, cz + 0.12], 'paintWhite', false)];
    add({ id: 'leftovers', name: '机の上のマグと皿', room: 'service', group: '丸い物・設備', note: '取っ手のあるマグ（内側・底）と縁に帯のある皿', gen: (S, R) => { cup(S, R, place([cx + 0.24, top + 0.06, cz - 0.01], 0.6), [0.045, 0.055, 0.045], { main: 0xf2f0ea, label: 0, glass: 0, dots: 0 }); plate(S, R, place([cx - 0.23, top, cz], 0)); }, own: aabb([cx - 0.4, top, cz - 0.2], [cx + 0.35, top + 0.15, cz + 0.2]), proxy: [], compare: C, view: look([cx + 0.1, cz + 1.0], [cx, top + 0.05, cz]) });
  }
}

// ---------------------------------------------------------------- 持てる物の部屋
function carry(api: ExtraApi): void {
  const { rooms, put, add, look } = api;
  const r = rooms.carry!.rect;
  void r;
  /** 持てる物 1 つ（v2 の carryItem の kind・half・mat・params と同じ） */
  interface Item { kind: string; half: V3; mat: MatId; params?: Record<string, Json>; at: V3; yaw?: number }
  const colorsOf = (it: Item): CarryColors => ({
    main: matHex(it.mat), label: matHex(it.params?.label as MatId | undefined, 0xd23a34), glass: matHex((it.params?.glass as MatId | undefined) ?? 'lightWarm', 0xffd29a), dots: Number(it.params?.dots ?? 1),
  });
  const genOf = (items: Item[]) => (S: Surfels, R: Rand): void => {
    for (const it of items) {
      const f = CARRY_GEN[it.kind];
      if (!f) continue;
      const xf = place(it.at, it.yaw ?? 0);
      f(S, R, xf, it.half, colorsOf(it));
      // バケツの水（v2 の水の高さの式: 中心 −hy + 0.02 + fill × hy × 1.7。展示は fill 0.6）
      if (it.kind === 'bucket') bucketWater(S, R, (p) => xf([p[0], -it.half[1] + 0.02 + 0.6 * it.half[1] * 1.7 + p[1], p[2]]), it.half);
    }
  };
  const shapes = (items: Item[]): V2Shape[] => items.map((it) => ({ kind: it.kind, half: it.half, mat: it.mat, params: { ...(it.params ?? {}), ...(it.kind === 'bucket' ? { fill: 0.6 } : {}) }, at: it.at, yaw: it.yaw ?? 0 }));
  const own = (items: Item[]): AABB => {
    const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const it of items) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k]!, it.at[k]! - it.half[k]!); max[k] = Math.max(max[k]!, it.at[k]! + it.half[k]!); }
    return { min, max };
  };
  const exhibit = (id: string, name: string, note: string, items: Item[], viewPos: [number, number]): void => {
    const o = own(items);
    const c: V3 = [(o.min[0] + o.max[0]) / 2, (o.min[1] + o.max[1]) / 2, (o.min[2] + o.max[2]) / 2];
    add({ id, name, room: 'carry', group: '持てる物', note, gen: genOf(items), own: o, proxy: [], compare: [], v2Shapes: shapes(items), view: look(viewPos, c) });
  };
  /** 机の上（高さ top）に中心を置く */
  const on = (x: number, z: number, top: number, half: V3): V3 => [x, top + half[1], z];

  // 机 2 台（v2 の longTable）
  const T1: Box[] = [], T2: Box[] = [];
  longTable(T1, 2.4, 2.0, true, 2.6, 0.75, 0.72);
  longTable(T2, 2.4, 4.0, true, 2.6, 0.75, 0.72);
  put('carry', ...T1, ...T2);
  const top = 0.72;

  const cupH: V3 = [0.05, 0.06, 0.05], vaseH: V3 = [0.08, 0.13, 0.08], birdH: V3 = [0.08, 0.1, 0.08], boxH: V3 = [0.1, 0.07, 0.07], bookH: V3 = [0.11, 0.025, 0.15];
  exhibit('cCup', 'コップ（運ぶと変わる物の 1 段目）', '取っ手のあるマグ・内側・底', [{ kind: 'cup', half: cupH, mat: 'paintWhite', at: on(1.4, 2.0, top, cupH), yaw: 0.5 }], [1.6, 3.0]);
  exhibit('cVase', '花瓶（小）', '膨らんだ胴と細い首・口の縁', [{ kind: 'vase', half: vaseH, mat: 'plasticBlue', at: on(1.8, 2.0, top, vaseH) }], [1.9, 3.0]);
  exhibit('cBird', '鳥の置物', '陶器の胴・頭・くちばし・羽・尾・台', [{ kind: 'bird', half: birdH, mat: 'paintWhite', at: on(2.2, 2.0, top, birdH), yaw: 0.4 }], [2.2, 3.0]);
  exhibit('cKey', '鍵', '輪・軸・歯（金色）', [{ kind: 'key', half: birdH, mat: 'goldTrim', at: on(2.6, 2.0, top, birdH) }], [2.6, 3.0]);
  exhibit('cBox', 'オルゴールの箱', '木目の箱・ふたの合わせ目・角の金具・巻きねじ', [{ kind: 'box', half: boxH, mat: 'woodPanel', at: on(3.0, 2.0, top, boxH), yaw: -0.3 }], [3.0, 3.0]);
  exhibit('cBook', '本（集める本）', '表紙・丸い背・小口の紙の層', [{ kind: 'book', half: bookH, mat: 'seatRed', at: on(3.45, 2.0, top, bookH), yaw: 0.2 }, { kind: 'book', half: bookH, mat: 'seatBlue', at: [3.45, top + 0.075, 2.0], yaw: -0.15 }], [3.4, 3.0]);
  const bulbH: V3 = [0.06, 0.09, 0.06];
  exhibit('cBulb', '電球（色違い）', '洋なし形の光るガラス・ねじの口金（色で見分ける）', (['lightWarm', 'neonRed', 'neonBlue', 'lightGreen'] as MatId[]).map((g, i) => ({ kind: 'bulb', half: bulbH, mat: 'metal', params: { glass: g }, at: on(1.3 + i * 0.22, 4.0, top, bulbH) })), [1.7, 5.0]);
  const toyH: V3 = [0.12, 0.17, 0.1], plantH: V3 = [0.12, 0.18, 0.12];
  exhibit('cToy', 'ぬいぐるみ（落とし物・おもちゃ）', '小さなクマ（毛の色は材質の色）', [{ kind: 'toy', half: toyH, mat: 'plasticYellow', at: on(2.4, 4.0, top, toyH) }, { kind: 'toy', half: [0.1, 0.14, 0.08], mat: 'seatBlue', at: on(2.75, 4.0, top, [0.1, 0.14, 0.08]), yaw: -0.4 }], [2.6, 5.0]);
  exhibit('cPlant', '小さな鉢植え', '色の鉢と細長い葉の茂み', [{ kind: 'plant', half: plantH, mat: 'plantLeaf', at: on(3.25, 4.0, top, plantH) }], [3.25, 5.0]);

  // 床の物
  const parcelH: V3 = [0.2, 0.15, 0.17];
  exhibit('cParcel', '荷物の箱（色の札）と重い木箱', '段ボールの面・ガムテープ・色の帯と伝票（どの受けに合うか）。木箱は重い荷物', [
    ...(['plasticRed', 'plasticBlue', 'plasticYellow', 'lightGreen'] as MatId[]).map((l, i): Item => ({ kind: 'parcel', half: parcelH, mat: 'boxCardboard', params: { label: l }, at: [0.75, parcelH[1], 5.6 + i * 0.6], yaw: 0.1 * i })),
    { kind: 'parcel', half: [0.3, 0.27, 0.3], mat: 'woodPanel', params: { label: 'metalDark' }, at: [0.8, 0.27, 8.6] },
  ], [2.4, 7.0]);
  const bucketH: V3 = [0.16, 0.17, 0.16], stoolH: V3 = [0.18, 0.3, 0.18];
  exhibit('cBucket', 'バケツ（水入り）', 'すぼまった筒・巻いた縁・針金の取っ手・水面（運ぶと水の高さが変わる）', [{ kind: 'bucket', half: bucketH, mat: 'plasticBlue', at: [2.6, bucketH[1], 6.4] }], [3.2, 7.4]);
  exhibit('cStool', '丸い腰掛け', '木の座・3 本の脚・足掛けの輪', [{ kind: 'stool', half: stoolH, mat: 'plasticRed', at: [2.6, stoolH[1], 7.6] }], [3.4, 8.4]);
  const mirrorH: V3 = [0.2, 0.32, 0.06], lampH: V3 = [0.17, 0.6, 0.17], umbH: V3 = [0.12, 0.42, 0.12], bagH: V3 = [0.2, 0.17, 0.09];
  exhibit('cMirror', '立てる鏡', '楕円の枠・映り込む鏡の面・脚と台', [{ kind: 'mirror', half: mirrorH, mat: 'metalDark', at: [3.3, mirrorH[1], 9.3], yaw: Math.PI }], [3.3, 8.0]);
  exhibit('cLamp', '電気スタンド（床置き）', '丸い台・柱・布の笠', [{ kind: 'lamp', half: lampH, mat: 'whiteFabric', at: [2.2, lampH[1], 9.3] }], [2.4, 7.8]);
  exhibit('cUmbrella', '傘（落とし物）', 'ひだのある布・留め帯・軸・曲がった柄', [{ kind: 'umbrella', half: umbH, mat: 'seatBlue', at: [4.3, umbH[1], 9.4] }], [4.3, 8.3]);
  exhibit('cBag', '手提げの鞄（落とし物）', '角の丸い胴・持ち手・金具', [{ kind: 'bag', half: bagH, mat: 'plasticRed', at: [5.0, bagH[1], 9.4], yaw: Math.PI }], [5.0, 8.4]);
  // ボウリング（ピン 6 本と玉）と投げる玉・大きな玉
  const pinH: V3 = [0.06, 0.19, 0.06];
  const pins: Item[] = [];
  for (let row = 0; row < 3; row++) for (let k = 0; k <= row; k++) pins.push({ kind: 'pin', half: pinH, mat: 'paintWhite', at: [7.6 + (k - row / 2) * 0.24, pinH[1], 1.4 + row * 0.22] });
  exhibit('cBowling', 'ボウリングのピンと玉', '白いピン（首の赤い帯）・つやのある玉', [...pins, { kind: 'ball', half: [0.11, 0.11, 0.11], mat: 'plasticBlue', at: [6.4, 0.11, 1.8] }], [7.0, 3.2]);
  exhibit('cBall', '投げる玉・大きな玉', '2 色の帯の模様の玉', [
    ...(['plasticRed', 'plasticBlue', 'plasticYellow'] as MatId[]).map((m, i): Item => ({ kind: 'ball', half: [0.07, 0.07, 0.07], mat: m, at: [5.2 + i * 0.25, 0.07, 1.5] })),
    { kind: 'ball', half: [0.22, 0.22, 0.22], mat: 'plasticRed', at: [8.1, 0.22, 3.6] },
  ], [6.4, 3.4]);
  exhibit('cWeight', '鉄の重り（点の数が重さ）', '角の丸い鉄の塊・取っ手・上の白い点', [0.13, 0.15, 0.17, 0.19].map((s, i): Item => ({ kind: 'weight', half: [s, 0.8 * s, s], mat: 'metalDark', params: { dots: i + 1 }, at: [8.25, 0.8 * s, 5.4 + i * 0.75] })), [7.0, 6.5]);
  // ボールプール（v2 の囲いと色の層。玉を形の関数に）
  {
    const x = 5.4, z = 6.6, s = 1.2, t = 0.15, hh = 0.55;
    for (const [x0, z0, x1, z1] of [[x - s, z - s, x + s, z - s + t], [x - s, z + s - t, x + s, z + s], [x - s, z - s + t, x - s + t, z + s - t], [x + s - t, z - s + t, x + s, z + s - t]] as const) put('carry', box([x0, 0, z0], [x1, hh, z1], 'plasticBlue', true));
    const layers = (['plasticRed', 'plasticYellow', 'plasticBlue'] as MatId[]).map((m, k) => box([x - s + t + 0.01, k * 0.11, z - s + t + 0.01], [x + s - t - 0.01, k * 0.11 + 0.12, z + s - t - 0.01], m, false));
    const w = 2 * (s - t) - 0.02;
    add({ id: 'ballPit', name: 'ボールプール', room: 'carry', group: '持てる物', note: '色とりどりの小さな球（上から見える層）。v2 は色の板 3 枚', gen: (S, R) => ballPit(S, R, place([x, 0, z]), w, w, 0.34), own: aabb([x - s, 0, z - s], [x + s, hh, z + s]), proxy: [], compare: layers, view: look([x - 1.6, z - 2.0], [x, 0.3, z]) });
  }
}
