/**
 * 見本の部屋（v2 の FloorLayout）。v2 の部屋の作り（makeCell・テーマの配色・天井の照明）と v2 の家具（core/gen/dress の関数）で作り、
 * 「スプラットにする物」（CLASSIFICATION.md）を展示物として置く。
 *
 *          ┌──────── 寝室 ────────┬──────── トイレ ───────┐  z = −20
 *          │ ベッド・ソファ・布団 │ 洗面・小便器          │
 *          └────────┤    ├────────┴────────┤    ├────────┘  z = −12
 *   ┌── 書庫 ──┬──────────── 展示ホール ────────────┬── 売り場 ──┐
 *   │ 本・紙   ═  植物・ぬいぐるみ・展示物・設備     ═  商品      │
 *   └──────────┴─────────────── 入口 ────────────────┴────────────┘  z = 0
 *   x = −16    −7                0                   7          16
 *
 * 展示物ごとに: スプラットの作り方（gen）・v2 の箱の作り（compare。P で見比べる）・深さの代役（proxy）・当たり判定・見る位置。
 * - v2 の箱（compare）は部屋の箱に revealGroup `cmp:<id>` で入れる（最初は隠れている。main.ts が P で出し入れする）。
 *   部屋の焼き込み照明は v2 の箱が有るものとして焼く（スプラットの物もそこに有るので、床・棚板の接触の陰は同じ）
 * - 深さの代役（proxy）は revealGroup `proxy:<id>`。色を書かず深さだけ書く（GTAO が物の後ろの隅の陰を粒に掛けないように）。
 *   粒で覆われる内側にだけ置く（外へはみ出すと、後ろの壁が描かれず穴になる）
 */
import { aabbUnion, type AABB } from '../../../../v2/core/math/aabb.ts';
import type { Dir } from '../../../../v2/core/math/vec.ts';
import { Rng } from '../../../../v2/core/math/rng.ts';
import { makeCell, opening, portal, portalAabb } from '../../../../v2/core/world/build.ts';
import type { Rect } from '../../../../v2/core/world/footprint.ts';
import { box, type Box, type CellLayout, type FloorLayout, type Json, type MatId } from '../../../../v2/core/world/layout.ts';
import { extraRooms } from './layoutExtra.ts';
import { themePalette } from '../../../../v2/core/world/palettes.ts';
import { innerFaces, type Face } from '../../../../v2/core/gen/dress/geom.ts';
import { bed, cabinet, cone as v2cone, desk, lamp as v2lamp, lowTable, officeChair, plant as v2plant, planter as v2planter, plinth, shelfIsland, sofa, vitrine, wallShelf, waterCooler, type ShelfFill } from '../../../../v2/core/gen/dress/props.ts';
import { bench, counter, sinkRow, urinalRow, vending } from '../../../../v2/core/gen/dress/furniture.ts';
import { place, type Rand, type Surfels, type V3 } from './surfel.ts';
import { dracaena, ficus, pothos, sansevieria, shrub, succulent } from '../../../../v2/client/props/gen/plants.ts';
import { bear, cat, rabbit } from '../../../../v2/client/props/gen/plush.ts';
import { bookRow, openBook } from '../../../../v2/client/props/gen/books.ts';
import { goodsRow, type GoodsKind } from '../../../../v2/client/props/gen/goods.ts';
import { cushion, curtain, duvet, futon, pillow, throwBlanket, towelStack } from '../../../../v2/client/props/gen/fabric.ts';
import { binTrash, paperStack, scattered } from '../../../../v2/client/props/gen/paper.ts';
import { cone, coolerBottle, deskLamp, extinguisher, sculpture, toiletRoll, trophy, vaseFlowers, wallClock } from '../../../../v2/client/props/gen/objects.ts';
import { urinal, vesselSink } from '../../../../v2/client/props/gen/porcelain.ts';

export interface Exhibit {
  id: string;
  name: string;
  /** 置いた部屋（区画の id） */
  room: string;
  /** 分類（CLASSIFICATION.md の見出し） */
  group: string;
  /** 見どころ（パネルに出す） */
  note: string;
  gen: (S: Surfels, R: Rand) => void;
  /** 物の外接の箱（見る位置の目安・一覧の表示） */
  own: AABB;
  /** 深さの代役（物の内側の箱。粒で覆われる所だけ） */
  proxy: AABB[];
  /** 当たり判定（描かない箱） */
  collider?: AABB;
  /** v2 の箱の作り（P で見比べる） */
  compare: Box[];
  /** v2 の持てる物の形（v2 の buildShape で作って見比べる。持てる物の展示だけ） */
  v2Shapes?: V2Shape[];
  /** 見る位置（立つ床の点）と見る点 */
  view: { pos: V3; target: V3 };
}

/** v2 の持てる物（carryItem）の見た目: v2 の buildShape(kind, half, mat, params) を中心 at・向き yaw に置く */
export interface V2Shape { kind: string; half: V3; mat: MatId; params: Record<string, Json>; at: V3; yaw: number }

export interface Showroom {
  floor: FloorLayout;
  exhibits: Exhibit[];
}

export const ROOM_NAMES: Record<string, string> = { hall: '展示ホール', library: '書庫', store: '売り場', bedroom: '寝室', restroom: 'トイレ', service: '設備の部屋', carry: '持てる物の部屋' };

const aabb = (min: V3, max: V3): AABB => ({ min: [...min], max: [...max] });
export const faceOf = (r: Rect, dir: Dir): Face => innerFaces([r]).find((f) => f.dir === dir)!;
/** 箱の列 B の from 以降で、条件に合う箱を取り出す（棚の中身・ベッドの掛け布団など v2 の作りの一部を外す） */
export function take(B: Box[], from: number, pred: (b: Box) => boolean): Box[] {
  const out: Box[] = [];
  for (let i = B.length - 1; i >= from; i--) if (pred(B[i]!)) out.unshift(...B.splice(i, 1));
  return out;
}
/** 見比べ用の箱にする（当たり判定・意味タグを外す。dy だけ上下にずらす） */
export function plain(b: Box, dy = 0): Box {
  const { kind: _k, propGroup: _g, solid: _s, ...rest } = b;
  return { ...rest, solid: false, min: [b.min[0], b.min[1] + dy, b.min[2]], max: [b.max[0], b.max[1] + dy, b.max[2]] };
}
/** 棚の段の高さ（v2 の shelfLevels と同じ式。v2 では非公開） */
export function shelfLevels(h: number, step: number): number[] {
  const n = Math.max(2, Math.round((h - 0.1) / step));
  const s = (h - 0.12) / n;
  return Array.from({ length: n }, (_, i) => 0.1 + i * s);
}
/** v2 の棚で中身だけ（fill の箱）を作る: 中身ありと中身なしの差（枠の箱は乱数を使わないので同じ位置になる） */
function shelfFillBoxes(make: (B: Box[], fill: ShelfFill) => void, fill: ShelfFill): Box[] {
  const A: Box[] = [], N: Box[] = [];
  make(A, fill);
  make(N, 'none');
  const key = (b: Box): string => `${b.min.map((v) => v.toFixed(3))}|${b.max.map((v) => v.toFixed(3))}|${b.mat}`;
  const frame = new Set(N.map(key));
  return A.filter((b) => !frame.has(key(b)) && b.kind !== 'colliderOnly').map((b) => plain(b));
}
/** 局所の向き yaw（place の約束: 局所 +z が前）を、壁の面の室内向きから */
export const yawOf = (front: Dir): number => (front === 0 ? 0 : front === 1 ? Math.PI / 2 : front === 2 ? Math.PI : -Math.PI / 2);

export function buildShowroom(seed = 7): Showroom {
  const rooms: Record<string, { rect: Rect; theme: string; height: number }> = {
    hall: { rect: { x0: -7, z0: -12, x1: 7, z1: 0 }, theme: 'LargeRoom', height: 3.0 },
    library: { rect: { x0: -16, z0: -12, x1: -7, z1: 0 }, theme: 'ShelfGrid', height: 2.8 },
    store: { rect: { x0: 7, z0: -12, x1: 16, z1: 0 }, theme: 'RetailGrid', height: 3.0 },
    bedroom: { rect: { x0: -7, z0: -20, x1: 0, z1: -12 }, theme: 'SmallRoom', height: 2.6 },
    restroom: { rect: { x0: 0, z0: -20, x1: 7, z1: -12 }, theme: 'Restroom', height: 2.6 },
    // 入口の後ろ（南）: 設備（洗面・便器・流し台・自販機・壁の小物・体育館のリング）と、持てる物（仕掛けの物）の部屋
    service: { rect: { x0: -9, z0: 0, x1: 0, z1: 10 }, theme: 'CorridorHospital', height: 3.6 },
    carry: { rect: { x0: 0, z0: 0, x1: 9, z1: 10 }, theme: 'PlayArea', height: 2.8 },
  };
  // 開口（pos は壁の外面の床の点、dir は外向き。隣どうしで同じ位置・逆向き）
  const cells: Record<string, CellLayout> = {};
  const mk = (id: string, openings: ReturnType<typeof opening>[]): void => {
    const r = rooms[id]!;
    cells[id] = makeCell({ id, role: id === 'hall' ? 'hub' : 'side', name: ROOM_NAMES[id]!, theme: r.theme, audioPreset: '空調・微かなBGM', rects: [r.rect], height: r.height, palette: themePalette(r.theme), openings, lightSpacing: 2.2 });
  };
  mk('hall', [opening('o-lib', [-7, 0, -6], 3, 2.4, 2.4), opening('o-sto', [7, 0, -6], 1, 2.4, 2.4), opening('o-bed', [-3.5, 0, -12], 2, 2.0, 2.2), opening('o-wc', [3.5, 0, -12], 2, 2.0, 2.2), opening('o-svc', [-3.5, 0, 0], 0, 2.0, 2.4), opening('o-car', [3.5, 0, 0], 0, 2.0, 2.4)]);
  mk('service', [opening('o-svc', [-3.5, 0, 0], 2, 2.0, 2.4)]);
  mk('carry', [opening('o-car', [3.5, 0, 0], 2, 2.0, 2.4)]);
  mk('library', [opening('o-lib', [-7, 0, -6], 1, 2.4, 2.4)]);
  mk('store', [opening('o-sto', [7, 0, -6], 3, 2.4, 2.4)]);
  mk('bedroom', [opening('o-bed', [-3.5, 0, -12], 0, 2.0, 2.2)]);
  mk('restroom', [opening('o-wc', [3.5, 0, -12], 0, 2.0, 2.2)]);

  const ex: Exhibit[] = [];
  /** 部屋の箱を足す */
  const put = (room: string, ...boxes: Box[]): void => { cells[room]!.boxes.push(...boxes); };
  /** 展示物を足す（v2 の箱・代役・当たり判定の箱も部屋へ） */
  const add = (e: Exhibit): void => {
    ex.push(e);
    for (const c of e.compare) { const b = plain(c); b.revealGroup = `cmp:${e.id}`; put(e.room, b); }
    for (const p of e.proxy) { const b = box(p.min, p.max, 'untextured', false); b.revealGroup = `proxy:${e.id}`; put(e.room, b); }
    if (e.collider) { const c = box(e.collider.min, e.collider.max, 'metalDark', true); c.kind = 'colliderOnly'; put(e.room, c); }
  };
  const look = (pos: [number, number], target: V3): Exhibit['view'] => ({ pos: [pos[0], 0, pos[1]], target });
  /** 中心 (x, z)・半幅 r（奥行き rz）・高さ y0..y1 の箱 */
  const core = (x: number, z: number, r: number, y0: number, y1: number, rz = r): AABB => aabb([x - r, y0, z - rz], [x + r, y1, z + rz]);

  // ================================================================ 展示ホール
  const hall = rooms.hall!.rect;
  // 台座の上の展示物（v2 は台座の上に箱 1 つ）
  const onPlinth = (id: string, name: string, x: number, z: number, h: number, gen: (S: Surfels, R: Rand, xf: (p: V3) => V3) => void, size: V3, compareObj: MatId, note: string, proxy: [number, number, number] | null): void => {
    const B: Box[] = [];
    plinth(B, x, z, 0.6, h, 'marbleWhite', compareObj, 0.24);
    const obj = take(B, 0, (b) => b.mat === compareObj);
    put('hall', ...B);
    const own = aabb([x - size[0] / 2, h, z - size[2] / 2], [x + size[0] / 2, h + size[1], z + size[2] / 2]);
    add({ id, name, room: 'hall', group: '展示物', note, gen: (S, R) => gen(S, R, place([x, h, z], 0)), own, proxy: proxy ? [core(x, z, proxy[0], h + proxy[1], h + proxy[2])] : [], compare: obj, view: look([x + 0.35, z + 1.15], [x, h + size[1] * 0.45, z]) });
  };
  onPlinth('vase', '花瓶と花', -3.2, -4.2, 0.9, vaseFlowers, [0.34, 0.66, 0.34], 'goldTrim', '曲面の花瓶（釉薬のつや）と、1 枚ずつの花びら・葉。v2 は金色の箱 1 つ', [0.04, 0.02, 0.17]);
  onPlinth('sculpture', '彫刻（ブロンズ）', 0, -4.2, 1.0, sculpture, [0.32, 0.36, 0.32], 'metal', '結び目の形の金属。見る向きで映り込みが動く', null);
  onPlinth('trophy', 'トロフィー', 3.2, -4.2, 1.0, trophy, [0.24, 0.3, 0.16], 'goldTrim', '金の杯と取っ手・大理石の台', [0.045, 0.005, 0.05]);
  onPlinth('succulent', '多肉植物の寄せ植え', 3.2, -7.4, 0.85, succulent, [0.16, 0.12, 0.16], 'plantLeaf', '肉厚の葉のロゼット（先がほんのり赤い）', [0.035, 0.005, 0.07]);
  // ショーケースの中のクマ（v2 は金色の箱 1 つ）
  {
    const B: Box[] = [];
    vitrine(B, -3.2, -7.4, 0.8, 0.6, 'woodPanel', 'goldTrim');
    const obj = take(B, 0, (b) => b.mat === 'goldTrim');
    put('hall', ...B);
    const x = -3.2, y = 0.905, z = -7.42;
    add({ id: 'bear', name: 'ぬいぐるみ（クマ）', room: 'hall', group: 'ぬいぐるみ', note: '毛羽立った布・縫い目・つやのある目・リボン。ガラス越しの見え方も', gen: (S, R) => bear(S, R, place([x, y, z], 0)), own: aabb([x - 0.16, y, z - 0.14], [x + 0.16, y + 0.42, z + 0.14]), proxy: [core(x, z, 0.065, y + 0.04, y + 0.23, 0.055), core(x, z + 0.01, 0.05, y + 0.27, y + 0.35, 0.045)], compare: obj, view: look([x + 0.35, z + 1.1], [x, 1.1, z]) });
  }
  // 植物（壁際の四隅。v2 は鉢の箱 + 葉の箱 2 つ）
  const potted = (id: string, name: string, x: number, z: number, gen: (S: Surfels, R: Rand, xf: (p: V3) => V3) => void, size: number, h: number, pot: [number, number], note: string, viewOff: [number, number]): void => {
    const B: Box[] = [];
    v2plant(B, x, z, size, h);
    const [r0, ph] = pot;
    add({ id, name, room: 'hall', group: '植物', note, gen: (S, R) => gen(S, R, place([x, 0, z], 0)), own: aabb([x - size, 0, z - size], [x + size, h, z + size]), proxy: [core(x, z, r0 * 0.66, 0.02, ph * 0.85)], collider: core(x, z, r0 + 0.04, 0, 0.42), compare: B, view: look([x + viewOff[0] * 0.8, z + viewOff[1] * 0.8], [x, h * 0.55, z]) });
  };
  potted('dracaena', '観葉植物（ドラセナ）', hall.x0 + 0.75, -1.0, dracaena, 0.5, 1.5, [0.14, 0.36], '幹の上に細長い葉のロゼット。葉の両面・中央の明るい筋・垂れ方', [1.6, -1.2]);
  potted('sansevieria', 'サンセベリア', hall.x0 + 0.75, -11.0, sansevieria, 0.4, 1.1, [0.12, 0.3], '剣のように立つ葉の横縞と黄色い縁', [1.5, 1.4]);
  potted('ficus', 'ベンジャミン（木）', hall.x1 - 0.85, -11.0, ficus, 0.6, 1.9, [0.18, 0.42], '編んだ幹・枝・小さな葉の樹冠', [-1.8, 1.5]);
  // ローテーブルの上のポトス
  {
    const x = hall.x1 - 0.7, z = -1.0, top = 0.45;
    const B: Box[] = [];
    lowTable(B, x, z, 0.7, 0.6, top);
    put('hall', ...B);
    const C: Box[] = [];
    v2plant(C, x, z, 0.36, 0.7);
    add({ id: 'pothos', name: 'ポトス（つる植物）', room: 'hall', group: '植物', note: 'ハート形の斑入りの葉と、縁から垂れるつる', gen: (S, R) => pothos(S, R, place([x, top, z], 0)), own: aabb([x - 0.3, top, z - 0.3], [x + 0.3, top + 0.55, z + 0.3]), proxy: [core(x, z, 0.07, top + 0.02, top + 0.21)], compare: C.map((b) => plain(b, top)), view: look([x - 0.9, z - 1.0], [x, top + 0.25, z]) });
  }
  // 植え込み（縁は v2 の箱、茂みはスプラット。v2 は葉の箱）
  {
    const B: Box[] = [];
    v2planter(B, new Rng(seed + 3), -1.5, -11.65, 1.5, -10.75, 0.5);
    const leaves = take(B, 0, (b) => b.mat === 'plantLeaf');
    put('hall', ...B);
    const bushes: [V3, V3][] = [[[-0.85, 0.82, -11.2], [0.48, 0.32, 0.34]], [[0.15, 0.9, -11.22], [0.5, 0.42, 0.36]], [[1.0, 0.78, -11.18], [0.4, 0.28, 0.32]]];
    add({ id: 'shrubs', name: '植え込みの低木', room: 'hall', group: '植物', note: '刈り込んだ丸い茂み。小さな葉を表面にびっしり', gen: (S, R) => { for (const [c, r] of bushes) shrub(S, R, place([0, 0, 0]), c, r); }, own: aabb([-1.5, 0.5, -11.65], [1.5, 1.35, -10.75]), proxy: bushes.map(([c, r]) => aabb([c[0] - r[0] * 0.5, Math.max(0.53, c[1] - r[1] * 0.5), c[2] - r[2] * 0.5], [c[0] + r[0] * 0.5, c[1] + r[1] * 0.5, c[2] + r[2] * 0.5])), compare: leaves, view: look([0.3, -9.0], [0, 0.9, -11.2]) });
  }
  // カラーコーン・消火器・時計・給水機
  {
    const x = 2.2, z = -1.8;
    const C: Box[] = [];
    v2cone(C, x, z);
    add({ id: 'cone', name: 'カラーコーン', room: 'hall', group: '丸い物・設備', note: '円すいと白い反射帯（光沢のあるプラスチック）', gen: (S, R) => cone(S, R, place([x, 0, z], 0.3)), own: aabb([x - 0.2, 0, z - 0.2], [x + 0.2, 0.7, z + 0.2]), proxy: [core(x, z, 0.06, 0.04, 0.3)], collider: core(x, z, 0.15, 0, 0.5), compare: C, view: look([x + 0.7, z + 0.9], [x, 0.3, z]) });
  }
  {
    const f = faceOf(hall, 1), x = f.face - 0.17, z = -3.4;
    add({ id: 'extinguisher', name: '消火器', room: 'hall', group: '丸い物・設備', note: 'つやのある赤い円筒・レバー・圧力計・ホース', gen: (S, R) => extinguisher(S, R, place([x, 0, z], -Math.PI / 2)), own: aabb([x - 0.12, 0, z - 0.12], [x + 0.12, 0.58, z + 0.12]), proxy: [core(x, z, 0.045, 0.02, 0.42)], collider: core(x, z, 0.09, 0, 0.5), compare: [box([x - 0.08, 0, z - 0.08], [x + 0.08, 0.55, z + 0.08], 'plasticRed', false)], view: look([x - 1.0, z + 0.5], [x, 0.3, z]) });
  }
  {
    const z = faceOf(hall, 2).face;
    add({ id: 'clock', name: '壁掛け時計', room: 'hall', group: '丸い物・設備', note: '丸い枠・目盛り・針・ガラスの映り込み', gen: (S, R) => wallClock(S, R, place([0, 2.2, z], 0)), own: aabb([-0.18, 2.02, z], [0.18, 2.38, z + 0.05]), proxy: [], compare: [box([-0.16, 2.04, z], [0.16, 2.36, z + 0.03], 'paintWhite', false)], view: look([0.6, z + 3.0], [0, 2.2, z]) });
  }
  {
    const f = faceOf(hall, 3), at = -3.6;
    const B: Box[] = [];
    waterCooler(B, f, at, 0.04);
    const bottle = take(B, 0, (b) => b.mat === 'aquariumBlue');
    put('hall', ...B);
    const bx = f.face + 0.04 + 0.16, bz = at + 0.16;
    add({ id: 'cooler', name: '給水機のボトル', room: 'hall', group: '丸い物・設備', note: '逆さにした透ける青い容器と中の水（溝つき）', gen: (S, R) => coolerBottle(S, R, place([bx, 1.0, bz], 0)), own: aabb([bx - 0.14, 1.0, bz - 0.14], [bx + 0.14, 1.46, bz + 0.14]), proxy: [], compare: bottle, view: look([bx + 1.4, bz + 0.9], [bx, 1.15, bz]) });
  }
  { const B: Box[] = []; bench(B, true, 0, -8.6, 2.0); put('hall', ...B); }

  // ================================================================ 書庫
  const lib = rooms.library!.rect;
  /** 壁付けの棚（枠は v2 の箱）と段ごとの本の列 */
  const wallBooks = (id: string, name: string, f: Face, at: number, len: number, depth: number, h: number, mat: MatId, fill: ShelfFill, note: string, viewPos: [number, number]): void => {
    const B: Box[] = [];
    const rs = seed + Math.round(at * 100);
    wallShelf(B, new Rng(rs), f, at, len, depth, h, mat, 'none');
    put('library', ...B);
    const compare = shelfFillBoxes((A, fl) => wallShelf(A, new Rng(rs), f, at, len, depth, h, mat, fl), fill);
    const levels = shelfLevels(h, 0.4);
    const front = ((f.dir + 2) % 4) as Dir;
    // 局所 x = 0 は前から見た棚の左端
    const lx0 = front === 0 || front === 3 ? at : at + len;
    const d0 = f.face + f.inward * 0.02;
    const origin = (y: number): V3 => (f.horizontal ? [lx0, y, d0] : [d0, y, lx0]);
    const dz0 = Math.min(f.face, f.face + f.inward * (depth + 0.03)), dz1 = Math.max(f.face, f.face + f.inward * (depth + 0.03));
    const own = f.horizontal ? aabb([at, 0, dz0], [at + len, h, dz1]) : aabb([dz0, 0, at], [dz1, h, at + len]);
    const c: V3 = [(own.min[0] + own.max[0]) / 2, h * 0.5, (own.min[2] + own.max[2]) / 2];
    add({
      id, name, room: 'library', group: '本棚の中身', note,
      gen: (S, R) => levels.forEach((y, i) => {
        const room = (i + 1 < levels.length ? levels[i + 1]! - 0.02 : h - 0.025) - y;
        bookRow(S, R, place(origin(y), yawOf(front)), { x0: 0.03, x1: len - 0.03, zBack: 0.025, zFront: depth - 0.005, maxH: room - 0.012, binders: fill === 'binders' && i % 2 === 1 });
      }),
      own, proxy: [], compare, view: look(viewPos, c),
    });
  };
  const libW = faceOf(lib, 3), libN = faceOf(lib, 2);
  wallBooks('books1', '本棚（ハードカバーと文庫）', libW, -11.3, 2.2, 0.32, 2.0, 'bookshelfWood', 'books', '1 冊ずつの本（背の帯・題名・平積み・傾いた本・シリーズ）。棚の枠は v2 の箱のまま', [lib.x0 + 2.4, -9.0]);
  wallBooks('books2', '本棚（雑誌・ファイル）', libW, -8.8, 2.2, 0.32, 2.0, 'bookshelfWood', 'binders', 'リングファイル（ラベルの窓・指を掛ける穴）と雑誌・本', [lib.x0 + 2.4, -6.5]);
  wallBooks('books3', '低い本棚', libN, -14.6, 1.6, 0.3, 1.2, 'furnitureLight', 'books', '腰の高さの棚。上から見た本の天と、手前に出た本', [-13.4, lib.z0 + 2.0]);
  // 島の書架（両面）
  {
    const x0 = -13.6, x1 = -10.6, z0 = -4.75, z1 = -4.05, h = 1.6;
    const B: Box[] = [];
    shelfIsland(B, new Rng(seed + 11), x0, z0, x1, z1, h, 'bookshelfWood', 'none');
    put('library', ...B);
    const compare = shelfFillBoxes((A, fl) => shelfIsland(A, new Rng(seed + 11), x0, z0, x1, z1, h, 'bookshelfWood', fl), 'books');
    const levels = shelfLevels(h, 0.42);
    const cm = (z0 + z1) / 2;
    add({
      id: 'books4', name: '島の書架（両面）', room: 'library', group: '本棚の中身', note: '両面の本の列。通路から見た奥行き',
      gen: (S, R) => levels.forEach((y, i) => {
        const room = (i + 1 < levels.length ? levels[i + 1]! - 0.025 : h - 0.03) - y - 0.02;
        bookRow(S, R, place([x0 + 0.03, y, cm + 0.015], 0), { x0: 0.02, x1: x1 - x0 - 0.08, zBack: 0.005, zFront: z1 - cm - 0.02, maxH: room - 0.01 });
        bookRow(S, R, place([x1 - 0.03, y, cm - 0.015], Math.PI), { x0: 0.02, x1: x1 - x0 - 0.08, zBack: 0.005, zFront: cm - z0 - 0.02, maxH: room - 0.01 });
      }),
      own: aabb([x0, 0, z0], [x1, h, z1]), proxy: [], compare, view: look([-11.0, -2.5], [-12.1, 0.8, -4.4]),
    });
  }
  // 机（v2）と机の上・足元
  {
    const cx = -10.2, cz = -9.6, top = 0.72;
    const B: Box[] = [];
    desk(B, cx, cz, 2, { screen: null, drawers: true });
    officeChair(B, cx, cz + 0.7, 2, 'seatBlue');
    put('library', ...B);
    const L: Box[] = [];
    v2lamp(L, cx + 0.5, cz - 0.12, top);
    const ps: V3 = [cx - 0.42, top, cz - 0.05];
    add({ id: 'deskItems', name: '机の上（書類・本・電気スタンド）', room: 'library', group: '紙・小物', note: '1 枚ずつずれた書類の束、開いた本、光る電気スタンド', gen: (S, R) => { paperStack(S, R, place([0, 0, 0]), ps, 90, 0.12); openBook(S, R, place([cx - 0.02, top, cz + 0.1], 0.08)); deskLamp(S, R, place([cx + 0.5, top, cz - 0.12], 0.5)); }, own: aabb([cx - 0.7, top, cz - 0.35], [cx + 0.7, top + 0.5, cz + 0.35]), proxy: [], compare: [...L, box([cx - 0.53, top, cz - 0.2], [cx - 0.31, top + 0.03, cz + 0.1], 'paintWhite', false)], view: look([cx + 0.3, cz + 1.5], [cx, top + 0.12, cz]) });
    // 口の開いたごみ箱（v2 の材質の薄い箱 5 枚）と中のごみ
    const bx = cx - 1.05, bz = cz - 0.1, s = 0.36, bh = 0.62, t = 0.012;
    put('library',
      box([bx - s / 2, 0, bz - s / 2], [bx + s / 2, 0.02, bz + s / 2], 'metalDark', false),
      box([bx - s / 2, 0, bz - s / 2], [bx - s / 2 + t, bh, bz + s / 2], 'metalDark', false), box([bx + s / 2 - t, 0, bz - s / 2], [bx + s / 2, bh, bz + s / 2], 'metalDark', false),
      box([bx - s / 2 + t, 0, bz - s / 2], [bx + s / 2 - t, bh, bz - s / 2 + t], 'metalDark', false), box([bx - s / 2 + t, 0, bz + s / 2 - t], [bx + s / 2 - t, bh, bz + s / 2], 'metalDark', false));
    const cb = box([bx - s / 2, 0, bz - s / 2], [bx + s / 2, bh, bz + s / 2], 'metalDark', true); cb.kind = 'colliderOnly'; put('library', cb);
    add({ id: 'trash', name: 'ごみ箱の中身', room: 'library', group: '紙・小物', note: '丸めた紙（しわ）と空き缶。ごみ箱は v2 の材質の箱', gen: (S, R) => binTrash(S, R, place([0, 0, 0]), [bx, 0, bz], s, bh), own: aabb([bx - s / 2, 0.3, bz - s / 2], [bx + s / 2, bh + 0.08, bz + s / 2]), proxy: [], compare: [box([bx - s / 2 + t, bh - 0.08, bz - s / 2 + t], [bx + s / 2 - t, bh - 0.04, bz + s / 2 - t], 'paintWhite', false)], view: look([bx - 0.4, bz + 1.2], [bx, 0.45, bz]) });
    add({ id: 'scattered', name: '床に散らばった紙', room: 'library', group: '紙・小物', note: '反った紙の重なり（文字の行・裏表）', gen: (S, R) => scattered(S, R, place([0, 0, 0]), [-12.4, 0, -7.6], 6, 0.45), own: aabb([-13.1, 0, -8.3], [-11.7, 0.03, -6.9]), proxy: [], compare: [box([-12.9, 0, -8.0], [-11.9, 0.004, -7.2], 'paintWhite', false)], view: look([-11.6, -6.3], [-12.4, 0, -7.6]) });
  }

  // ================================================================ 売り場
  const sto = rooms.store!.rect;
  {
    const x0 = 9.4, x1 = 13.6, z0 = -4.8, z1 = -4.0, h = 1.6;
    const B: Box[] = [];
    shelfIsland(B, new Rng(seed + 21), x0, z0, x1, z1, h, 'shelfMetal', 'none', 'metalDark');
    put('store', ...B);
    const compare = shelfFillBoxes((A, fl) => shelfIsland(A, new Rng(seed + 21), x0, z0, x1, z1, h, 'shelfMetal', fl, 'metalDark'), 'goods');
    const levels = shelfLevels(h, 0.42);
    const kinds: GoodsKind[] = ['cans', 'drinks', 'cartons', 'snacks'];
    const cm = (z0 + z1) / 2;
    add({
      id: 'goods1', name: '陳列棚の商品（両面）', room: 'store', group: '棚の商品', note: 'ペットボトル（透ける本体と中身）・缶・紙パック・袋菓子。棚は v2 の箱',
      gen: (S, R) => levels.forEach((y, i) => {
        const room = (i + 1 < levels.length ? levels[i + 1]! - 0.025 : h - 0.03) - y - 0.02;
        goodsRow(S, R, place([x0 + 0.04, y, cm + 0.015], 0), { x0: 0.02, x1: x1 - x0 - 0.1, zFront: z1 - cm - 0.03, maxH: room, kind: kinds[i % kinds.length]! });
        goodsRow(S, R, place([x1 - 0.04, y, cm - 0.015], Math.PI), { x0: 0.02, x1: x1 - x0 - 0.1, zFront: cm - z0 - 0.03, maxH: room, kind: kinds[(i + 2) % kinds.length]! });
      }),
      own: aabb([x0, 0, z0], [x1, h, z1]), proxy: [], compare, view: look([11.6, -2.5], [11.5, 0.75, -4.4]),
    });
  }
  {
    const f = faceOf(sto, 1), at = -10.6, len = 2.4, depth = 0.42, h = 1.8;
    const B: Box[] = [];
    wallShelf(B, new Rng(seed + 31), f, at, len, depth, h, 'shelfMetal', 'none');
    put('store', ...B);
    const compare = shelfFillBoxes((A, fl) => wallShelf(A, new Rng(seed + 31), f, at, len, depth, h, 'shelfMetal', fl), 'goods');
    const levels = shelfLevels(h, 0.4);
    const kinds: GoodsKind[] = ['drinks', 'drinks', 'cans', 'mixed', 'snacks'];
    const ox = f.face + f.inward * 0.02;
    add({
      id: 'goods2', name: '飲み物の棚', room: 'store', group: '棚の商品', note: 'ボトルの列（お茶・水・ジュース・コーラ）。ラベルとふたの色',
      gen: (S, R) => levels.forEach((y, i) => {
        const room = (i + 1 < levels.length ? levels[i + 1]! - 0.02 : h - 0.025) - y;
        goodsRow(S, R, place([ox, y, at], -Math.PI / 2), { x0: 0.03, x1: len - 0.03, zFront: depth - 0.005, maxH: room - 0.01, kind: kinds[i % kinds.length]! });
      }),
      own: aabb([f.face - depth - 0.03, 0, at], [f.face, h, at + len]), proxy: [], compare, view: look([sto.x1 - 2.4, at + len / 2 + 0.7], [f.face - 0.2, 0.9, at + len / 2]),
    });
  }
  { const B: Box[] = []; vending(B, faceOf(sto, 2), 11.6); put('store', ...B); }

  // ================================================================ 寝室
  const bdr = rooms.bedroom!.rect;
  {
    const f = faceOf(bdr, 3), at = -18.7, w = 1.4, len = 2.0;
    const B: Box[] = [];
    bed(B, f, at, w, len, 'furnitureDark', 'seatBlue');
    // 掛け布団と枕（非ソリッドの箱）は v2 の箱から外す（スプラットにする）
    const soft = take(B, 0, (b) => !b.solid);
    put('bedroom', ...B);
    // マットレスの上面: 頭 hx から長さ L（+x）、幅 W（z0 .. z0 + W）、高さ 0.56
    const hx = f.face + 0.02 + 0.08, z0 = at + 0.03, W = w - 0.06, L = len - 0.11, top = 0.56;
    // 局所: x = 幅（世界の −z へ）、z = 長さ（頭 → 足 = 世界の +x）
    const xf = place([hx, 0, z0 + W], Math.PI / 2);
    add({ id: 'bedding', name: 'ベッドの掛け布団と枕', room: 'bedroom', group: '布もの', note: '縁が垂れた掛け布団・折り返したシーツ・ふくらんだ枕。枠とマットレスは v2 の箱', gen: (S, R) => { duvet(S, R, xf, { x0: 0, x1: W, z0: 0, z1: L, top, color: 0x5a7aa8, pattern: true }); pillow(S, R, xf, [W * 0.28, top + 0.062, 0.25], 0.52, 0.36); pillow(S, R, xf, [W * 0.74, top + 0.062, 0.24], 0.52, 0.36, 0xe8e2d4); }, own: aabb([hx, 0.3, at], [hx + len, 0.75, at + w]), proxy: [], compare: soft, view: look([hx + len + 0.9, at + w + 1.1], [hx + 0.9, 0.6, at + w / 2]) });
    const rz = z0 + W * 0.5, rxl = 0.66, k = 0.95;
    add({ id: 'rabbit', name: 'ぬいぐるみ（ウサギ）', room: 'bedroom', group: 'ぬいぐるみ', note: '白い毛足・長い耳（内側は桃色）・丸いしっぽ', gen: (S, R) => rabbit(S, R, (p) => xf([W * 0.5 + p[0] * k, top + 0.06 + p[1] * k, rxl + p[2] * k])), own: aabb([hx + rxl - 0.15, top, rz - 0.13], [hx + rxl + 0.15, top + 0.5, rz + 0.13]), proxy: [aabb([hx + rxl - 0.065, top + 0.1, rz - 0.06], [hx + rxl + 0.045, top + 0.23, rz + 0.06])], compare: [box([hx + rxl - 0.1, top + 0.04, rz - 0.09], [hx + rxl + 0.1, top + 0.36, rz + 0.09], 'whiteFabric', false)], view: look([hx + 1.9, at + w + 0.5], [hx + rxl, top + 0.2, rz]) });
    // ナイトテーブル（v2）と電気スタンド
    const C: Box[] = [];
    cabinet(C, f, at - 0.62, 0.5, 0.42, 0.55, 'furnitureDark');
    put('bedroom', ...C);
    const lx = f.face + 0.25, lz = at - 0.37;
    const L2: Box[] = []; v2lamp(L2, lx, lz, 0.55);
    add({ id: 'lamp', name: '電気スタンド', room: 'bedroom', group: '丸い物・設備', note: '丸い台・曲がる軸・内側が光る笠', gen: (S, R) => deskLamp(S, R, place([lx, 0.55, lz], Math.PI / 2), 0x8a2a2a), own: aabb([lx - 0.2, 0.55, lz - 0.2], [lx + 0.2, 1.0, lz + 0.2]), proxy: [], compare: L2, view: look([lx + 1.4, lz + 0.8], [lx, 0.8, lz]) });
  }
  {
    const len = 1.9, hd = 0.425, cx = faceOf(bdr, 1).face - 0.02 - hd, cz = -16.0;
    const B: Box[] = [];
    sofa(B, cx, cz, len, 3, 'upholstery');
    put('bedroom', ...B);
    // 向き 3（座る人は −x を向く）: 背もたれの前の面 x = cx + hd − 0.22、座面の上 0.5、肘掛けは z = cz ± (len/2 − 0.18 .. len/2)、高さ 0.62
    const backFront = cx + hd - 0.22, seatX = cx - 0.12;
    const cu = (dz: number): ((p: V3) => V3) => place([backFront - 0.1, 0, cz + dz], -Math.PI / 2);
    add({ id: 'cushions', name: 'ソファのクッションとひざ掛け', room: 'bedroom', group: '布もの', note: 'ふくらんだクッション（縁のパイピング・中央のくぼみ）と、肘掛けに掛けた毛布。ソファは v2 の箱', gen: (S, R) => {
      cushion(S, R, cu(0.42), [0, 0.72, 0], 0.42, 0xb84a3a, -0.3);
      cushion(S, R, cu(-0.4), [0, 0.71, 0], 0.4, 0xd8c070, -0.25, true);
      throwBlanket(S, R, place([cx - 0.35, 0, cz - len / 2 + 0.18], Math.PI / 2), { x: 0.05, z0: 0, z1: 0.5, top: 0.62, inner: 0, outer: 0.08, color: 0x6a8a6a, innerDrop: 0.1 });
    }, own: aabb([cx - hd, 0.4, cz - len / 2 - 0.05], [cx + hd, 1.0, cz + len / 2]), proxy: [], compare: [box([backFront - 0.12, 0.5, cz + 0.21], [backFront, 0.92, cz + 0.63], 'seatRed', false), box([backFront - 0.12, 0.5, cz - 0.6], [backFront, 0.9, cz - 0.2], 'plasticYellow', false), box([cx - 0.35, 0.62, cz - len / 2 - 0.01], [cx + 0.15, 0.64, cz - len / 2 + 0.19], 'noticeGreen', false)], view: look([cx - 2.1, cz + 0.5], [cx - 0.1, 0.65, cz]) });
    add({ id: 'cat', name: 'ぬいぐるみ（ネコ）', room: 'bedroom', group: 'ぬいぐるみ', note: 'トラ猫の縞・三角の耳・長いしっぽ・ひげ', gen: (S, R) => cat(S, R, place([seatX, 0.5, cz + 0.02], -Math.PI / 2)), own: aabb([seatX - 0.15, 0.5, cz - 0.2], [seatX + 0.15, 0.85, cz + 0.2]), proxy: [aabb([seatX - 0.05, 0.54, cz - 0.04], [seatX + 0.05, 0.66, cz + 0.08])], compare: [box([seatX - 0.09, 0.5, cz - 0.08], [seatX + 0.09, 0.8, cz + 0.12], 'furnitureLight', false)], view: look([cx - 1.5, cz + 1.0], [seatX, 0.62, cz]) });
  }
  {
    // 窓（v2 の夜景の箔）とカーテン（奥の壁）
    const z = faceOf(bdr, 2).face;
    put('bedroom', box([-4.4, 0.9, z - 0.01], [-1.9, 2.2, z + 0.005], 'windowNight', false));
    add({ id: 'curtain', name: 'カーテン', room: 'bedroom', group: '布もの', note: 'ひだのある布（両面）とレール', gen: (S, R) => { const xf = place([0, 0, 0]); curtain(S, R, xf, { x0: -4.7, x1: -3.65, y0: 0.06, y1: 2.32, z: z + 0.08, color: 0xc8b48a }); curtain(S, R, xf, { x0: -2.65, x1: -1.6, y0: 0.06, y1: 2.32, z: z + 0.08, color: 0xc8b48a }); }, own: aabb([-4.8, 0, z], [-1.5, 2.4, z + 0.16]), proxy: [], compare: [box([-4.7, 0.06, z + 0.04], [-3.65, 2.32, z + 0.08], 'whiteFabric', false), box([-2.65, 0.06, z + 0.04], [-1.6, 2.32, z + 0.08], 'whiteFabric', false)], view: look([-3.2, z + 3.0], [-3.2, 1.3, z]) });
  }
  {
    const f = faceOf(bdr, 0), at = -6.4, len = 1.2, h = 1.2, depth = 0.4;
    const B: Box[] = [];
    wallShelf(B, new Rng(seed + 41), f, at, len, depth, h, 'furnitureLight', 'none');
    put('bedroom', ...B);
    const levels = shelfLevels(h, 0.4);
    const zf = f.face + f.inward * (0.02 + depth / 2 + 0.01);
    const stacks = levels.flatMap((y, i): [number, number, number][] => [[at + 0.32, y, 3 + (i % 2)], [at + 0.86, y, 4 - (i % 2)]]);
    add({ id: 'towels', name: 'たたんだタオル', room: 'bedroom', group: '布もの', note: 'パイル地のざらつき・角の丸み・色違いの重なり。棚は v2 の箱', gen: (S, R) => { for (const [x, y, n] of stacks) towelStack(S, R, place([0, 0, 0]), [x, y, zf], n); }, own: aabb([at, 0, f.face - depth - 0.05], [at + len, h, f.face]), proxy: stacks.map(([x, y, n]) => aabb([x - 0.12, y + 0.01, zf - 0.08], [x + 0.12, y + n * 0.04 - 0.008, zf + 0.08])), compare: shelfFillBoxes((A, fl) => wallShelf(A, new Rng(seed + 41), f, at, len, depth, h, 'furnitureLight', fl), 'boxes'), view: look([at + 0.6, f.face - 1.9], [at + 0.6, 0.6, f.face - 0.2]) });
  }
  {
    const c: V3 = [-3.0, 0, -16.6];
    add({ id: 'futon', name: '床の布団', room: 'bedroom', group: '布もの', note: '綴じのくぼみのある敷布団・半分たたんだ掛け布団・そば殻の枕', gen: (S, R) => futon(S, R, place([0, 0, 0]), c), own: aabb([c[0] - 0.5, 0, c[2] - 0.97], [c[0] + 0.5, 0.25, c[2] + 0.97]), proxy: [aabb([c[0] - 0.4, 0.01, c[2] - 0.85], [c[0] + 0.4, 0.07, c[2] + 0.85])], collider: aabb([c[0] - 0.48, 0, c[2] - 0.95], [c[0] + 0.48, 0.1, c[2] + 0.95]), compare: [box([c[0] - 0.48, 0, c[2] - 0.95], [c[0] + 0.48, 0.09, c[2] + 0.95], 'whiteFabric', false), box([c[0] - 0.5, 0.09, c[2] - 0.1], [c[0] + 0.5, 0.16, c[2] + 0.9], 'seatBlue', false)], view: look([c[0] + 0.4, c[2] + 2.1], [c[0], 0.1, c[2]]) });
  }

  // ================================================================ トイレ
  const wc = rooms.restroom!.rect;
  {
    const f = faceOf(wc, 1), at = -18.8, len = 2.2, top = 0.85;
    const B: Box[] = [];
    counter(B, f, at, len, 0.55, top, 'woodPanel', 'marbleWhite');
    put('restroom', ...B, box([f.face - 0.02, 1.1, at + 0.1], [f.face, 1.9, at + len - 0.1], 'carGlass', false), box([f.face - 0.025, 1.08, at + 0.08], [f.face, 1.1, at + len - 0.08], 'metalDark', false));
    // v2 は壁掛けの洗面器（高さ 0.72〜0.9）。ここでは天板の上に載る高さへずらして見比べる
    const A: Box[] = [];
    sinkRow(A, f, at + 0.35, 2);
    const compare = A.filter((b) => b.mat === 'marbleWhite' || (b.mat === 'metal' && b.min[1] >= 0.9)).map((b) => plain(b, top - 0.72));
    const sx = f.face - 0.3;
    const zs = [at + 0.35 + 0.375, at + 0.35 + 0.75 + 0.375];
    add({ id: 'sinks', name: '洗面ボウルと蛇口', room: 'restroom', group: '陶器の設備', note: 'くぼみのある白い陶器（釉薬のつや）・排水口・金属の蛇口', gen: (S, R) => { for (const z of zs) vesselSink(S, R, place([sx, top, z], -Math.PI / 2)); }, own: aabb([f.face - 0.6, top, at], [f.face, top + 0.45, at + len]), proxy: [], compare, view: look([f.face - 1.7, at + 1.6], [sx, top + 0.1, at + 1.1]) });
  }
  {
    const f = faceOf(wc, 2);
    const xs = [2.0, 2.75, 3.5];
    for (const x of xs.slice(0, -1)) put('restroom', box([x + 0.36, 0.6, f.face], [x + 0.39, 1.5, f.face + 0.45], 'furnitureLight', false));
    const A: Box[] = [];
    urinalRow(A, f, xs[0]! - 0.375, 3);
    const compare = A.filter((b) => b.mat !== 'furnitureLight');
    add({ id: 'urinals', name: '小便器', room: 'restroom', group: '陶器の設備', note: '前の開いた白い陶器の器と洗浄の管。仕切りは v2 の箱', gen: (S, R) => { for (const x of xs) urinal(S, R, place([x, 0, f.face], 0)); }, own: aabb([xs[0]! - 0.2, 0.5, f.face], [xs[2]! + 0.2, 1.55, f.face + 0.4]), proxy: [], compare, view: look([3.3, f.face + 2.4], [2.75, 0.95, f.face]) });
  }
  {
    const f = faceOf(wc, 3), z = -15.0;
    add({ id: 'toiletRoll', name: 'トイレットペーパー', room: 'restroom', group: '紙・小物', note: '巻いた紙の円筒と垂れた端・金具', gen: (S, R) => toiletRoll(S, R, place([f.face + 0.08, 0.75, z], Math.PI / 2)), own: aabb([f.face, 0.6, z - 0.1], [f.face + 0.16, 0.85, z + 0.1]), proxy: [aabb([f.face + 0.05, 0.72, z - 0.035], [f.face + 0.11, 0.78, z + 0.035])], compare: [box([f.face, 0.7, z - 0.06], [f.face + 0.11, 0.81, z + 0.06], 'whiteFabric', false)], view: look([f.face + 1.2, z + 0.5], [f.face + 0.08, 0.72, z]) });
  }

  // ================================================================ 設備の部屋・持てる物の部屋（layoutExtra.ts）
  extraRooms({ rooms, put, add, look, core, take, plain, faceOf, seed });

  // ================================================================ フロア
  const all = Object.values(cells);
  const bounds = all.map((c) => c.bounds).reduce((a, b) => aabbUnion(a, b));
  const floor: FloorLayout = {
    id: 'splat-showroom',
    seed,
    genVersion: 'splat-showroom-1',
    tuningVersion: 'default',
    bounds: { min: [bounds.min[0], -1, bounds.min[2]], max: bounds.max },
    cells: all,
    portals: [
      portal('p-lib', 'hall', 'library', portalAabb('x', -7, -6, 2.4, 0, 2.4), 3, 'opening'),
      portal('p-sto', 'hall', 'store', portalAabb('x', 7, -6, 2.4, 0, 2.4), 1, 'opening'),
      portal('p-bed', 'hall', 'bedroom', portalAabb('z', -12, -3.5, 2.0, 0, 2.2), 2, 'opening'),
      portal('p-wc', 'hall', 'restroom', portalAabb('z', -12, 3.5, 2.0, 0, 2.2), 2, 'opening'),
      portal('p-svc', 'hall', 'service', portalAabb('z', 0, -3.5, 2.0, 0, 2.4), 0, 'opening'),
      portal('p-car', 'hall', 'carry', portalAabb('z', 0, 3.5, 2.0, 0, 2.4), 0, 'opening'),
    ],
    entities: [],
    surfaces: [],
    spawn: { pos: [0, 0.02, -1.2], yaw: 0, cell: 'hall' },
    exits: [],
    fog: { color: 0x0b0d14, near: 9, far: 48 },
  };
  return { floor, exhibits: ex };
}
