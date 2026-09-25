/**
 * デカール配置規則（担当 D）: テンプレート・部屋文脈から、DecalLayer が描く拡張アイテム（DecalItem）を決定論で生成する。
 * generateLayout の末尾（Modifier / wear の後）で呼ばれ、乱数は p.rng.fork('decals') だけを使う。純ロジック（DOM / three 非依存。
 * Node の seam-stats / レイアウト検査でもそのまま動く）。footprint・ソケット・箱・当たり判定は一切変えない。
 *
 * 出力: `L.decalItems`（RoomLayout の型には無いので LayoutWithDecals として読む）。既存の `L.decals`（DecalSpec。Wetness の水たまり等）は触らない。
 *
 * 分担（docs/decals.md）: 面全体の摩耗・環境汚れ（扉パネルの下端 / 取っ手、CorridorOffice の歩行帯、C02 の壁際の埃、R01 の水際）は
 * SurfaceAppearance（材質側）。局所の設備・貼り紙・シミ・扉下の汚れ・入隅・他テンプレートの壁際の埃はここ。
 *
 * 種類:
 *   設備: outlet（コンセント）/ switch（照明スイッチ）/ thermostat / exitSign（避難口誘導灯・発光）/ fireAlarm（発信機）/ extinguisherSign（消火器札）/
 *         pictoToilet / pictoNoSmoking / pictoExit（通路誘導の矢印札）
 *   紙:   paperNotice / paperMemo（A4 の貼り紙）/ paperCaution（黄色の注意札）/ poster（額装ポスター）
 *   汚れ: floorScuff（動線の擦れ）/ doorGrimeFloor（扉前の床）/ doorGrimeJamb（扉枠脇の壁 0.3 m）/ handSmudge（取っ手側の手垢）/
 *         dustFloor / dustWall（壁際の埃）/ cornerGrime（入隅の縦帯）/ ceilingJunction（壁と天井の入隅）/ ceilingStain（天井板のシミ）/ chairRub（椅子背の高さのこすれ）
 */
import type { Dir, Socket, Vec3 } from '../core/types';
import { dirVec } from '../core/types';
import type { Rng } from '../core/rng';
import { along, across, edgesOf, wallIntervals, wallSpans, inFootprint, type Rect } from './footprint';
import { WALL_T, type GenParams, type RoomLayout } from './layout';

export type DecalKind =
  | 'outlet' | 'switch' | 'thermostat' | 'exitSign' | 'fireAlarm' | 'extinguisherSign' | 'pictoToilet' | 'pictoNoSmoking' | 'pictoExit'
  | 'paperNotice' | 'paperMemo' | 'paperCaution' | 'poster'
  | 'floorScuff' | 'doorGrimeFloor' | 'doorGrimeJamb' | 'handSmudge' | 'dustFloor' | 'dustWall' | 'cornerGrime' | 'ceilingJunction' | 'ceilingStain' | 'chairRub';

export interface DecalItem {
  kind: DecalKind;
  /** 面上の中心（ローカル）。浮かせ量は offset（法線方向） */
  pos: Vec3;
  /** 面の法線（単位。壁は室内向き、床は +Y、天井は -Y） */
  normal: Vec3;
  /** テクスチャ u 方向（単位、normal に直交）。v = normal × tangent（壁では上向き） */
  tangent: Vec3;
  /** [u 方向の幅, v 方向の高さ]（m） */
  size: [number, number];
  /** 面からの浮かせ量（m）。既定 0.004。腰壁などの帯の上に貼るときは帯の出 + 0.004 */
  offset?: number;
  /** アトラス内のバリエーション */
  variant?: number;
  /** u を左右反転して貼る（汚れの向き） */
  flip?: boolean;
  /** 透明度の倍率（0..1） */
  alpha?: number;
  /** 汚れ系（Tier の decals=false なら省略） */
  grime?: boolean;
  /** 発光（誘導灯） */
  emissive?: boolean;
  /** このソケットの Portal が戻り側（isReturn）なら、ソケット中心を通る面（法線 = tangent）で鏡像にする（取っ手側の判定） */
  mirrorIfReturn?: string;
}

export type LayoutWithDecals = RoomLayout & { decalItems?: DecalItem[] };

/** 描画側の読み出し用 */
export function decalItemsOf(L: RoomLayout): DecalItem[] {
  return (L as LayoutWithDecals).decalItems ?? [];
}

// ---------------------------------------------------------------- プロファイル（テンプレート別の種類と密度）

type PaperKind = 'paperNotice' | 'paperMemo' | 'paperCaution';
type Picto = 'pictoToilet' | 'pictoNoSmoking';

interface Profile {
  /** コンセントの間隔（m）。0 で無し */
  outletPitch: number;
  outletY: number;
  /** 廊下: 片側だけ */
  oneSide: boolean;
  switches: boolean;
  thermostat: boolean;
  fireAlarm: number;
  extinguisherSign: number;
  pictos: Picto[];
  /** 扉 1 枚あたりの貼り紙枚数 [min, max] */
  papers: [number, number];
  paperKinds: PaperKind[];
  /** 廊下の長い壁のポスター間隔（m）。0 で無し */
  posterPitch: number;
  exitSigns: boolean;
  /** 汚れの強さ（0 で無し） */
  scuff: number;
  doorGrime: number;
  handSmudge: number;
  dust: number;
  corner: number;
  stains: [number, number];
  chairRub: boolean;
}

const CORRIDOR: Profile = {
  outletPitch: 6, outletY: 0.28, oneSide: true, switches: false, thermostat: false, fireAlarm: 1, extinguisherSign: 1, pictos: ['pictoToilet'],
  papers: [0, 1], paperKinds: ['paperNotice'], posterPitch: 0, exitSigns: true,
  scuff: 0.8, doorGrime: 0.9, handSmudge: 0.8, dust: 0.9, corner: 0.8, stains: [0, 2], chairRub: false,
};
const ROOM: Profile = {
  outletPitch: 5, outletY: 0.28, oneSide: false, switches: true, thermostat: true, fireAlarm: 1, extinguisherSign: 1, pictos: [],
  papers: [1, 2], paperKinds: ['paperNotice', 'paperMemo'], posterPitch: 0, exitSigns: true,
  scuff: 0.7, doorGrime: 0.9, handSmudge: 0.8, dust: 0.9, corner: 0.9, stains: [0, 3], chairRub: false,
};
const NONE: Profile = {
  outletPitch: 0, outletY: 0.28, oneSide: false, switches: false, thermostat: false, fireAlarm: 0, extinguisherSign: 0, pictos: [],
  papers: [0, 0], paperKinds: ['paperNotice'], posterPitch: 0, exitSigns: false,
  scuff: 0, doorGrime: 0, handSmudge: 0, dust: 0, corner: 0, stains: [0, 0], chairRub: false,
};
const INDUSTRIAL: Profile = {
  ...ROOM, outletPitch: 8, outletY: 0.45, thermostat: false, extinguisherSign: 2, pictos: ['pictoNoSmoking'],
  papers: [1, 2], paperKinds: ['paperCaution', 'paperNotice'], scuff: 1, doorGrime: 1, dust: 1, corner: 1, stains: [1, 3],
};

const PROFILES: Record<string, Profile> = {
  CorridorOffice: { ...CORRIDOR, outletPitch: 5, pictos: ['pictoToilet', 'pictoNoSmoking'], scuff: 0 /* SurfaceAppearance の歩行帯 */ },
  CorridorSchool: { ...CORRIDOR, papers: [1, 2], paperKinds: ['paperNotice', 'paperMemo'], posterPitch: 8, pictos: ['pictoToilet', 'pictoNoSmoking'], stains: [0, 3] },
  CorridorHospital: { ...CORRIDOR, outletPitch: 4, posterPitch: 9, pictos: ['pictoToilet', 'pictoNoSmoking'], chairRub: true, dust: 0.6 },
  CorridorHotel: { ...CORRIDOR, outletPitch: 0, papers: [0, 0], pictos: [], dust: 0.7, stains: [0, 1] },
  CorridorEntertainment: { ...CORRIDOR, outletPitch: 0, papers: [0, 1], paperKinds: ['paperCaution'], posterPitch: 6, pictos: ['pictoNoSmoking'] },
  CorridorService: { ...CORRIDOR, outletPitch: 5, outletY: 0.45, switches: true, papers: [1, 2], paperKinds: ['paperCaution', 'paperNotice'], pictos: [], scuff: 1, doorGrime: 1, dust: 1, corner: 1, stains: [1, 3] },
  TransitCorridor: { ...CORRIDOR, outletPitch: 0, papers: [0, 0], posterPitch: 7, pictos: ['pictoToilet', 'pictoNoSmoking'], fireAlarm: 0, scuff: 0.9, dust: 0.8 },
  ApartmentCorridor: { ...CORRIDOR, outletPitch: 0, pictos: [], dust: 0.8 },
  GenericCorridor: CORRIDOR,
  Bridge: { ...NONE, scuff: 0.6 },
  LargeRoom: { ...ROOM, outletPitch: 6, posterPitch: 10 },
  SmallRoom: { ...ROOM, outletPitch: 4, fireAlarm: 0, extinguisherSign: 0, stains: [0, 2] },
  GenericRoom: { ...ROOM, outletPitch: 4.5 },
  OfficeGrid: { ...ROOM, outletPitch: 4.5 },
  Classroom: { ...ROOM, outletPitch: 6, papers: [2, 3], posterPitch: 8, fireAlarm: 0 },
  Restroom: { ...ROOM, outletPitch: 8, thermostat: false, papers: [1, 1], paperKinds: ['paperCaution', 'paperNotice'], pictos: ['pictoToilet'], fireAlarm: 0, extinguisherSign: 0, scuff: 0.4, dust: 0.7, stains: [1, 3] },
  LockerRoom: { ...ROOM, outletPitch: 8, thermostat: false, papers: [1, 2], paperKinds: ['paperCaution', 'paperNotice'], fireAlarm: 0, extinguisherSign: 0, scuff: 0.5, stains: [1, 2] },
  RetailRoom: { ...ROOM, outletPitch: 3.5, stains: [0, 2] },
  Theater: { ...NONE, fireAlarm: 1, extinguisherSign: 1, exitSigns: true, scuff: 0.3, doorGrime: 0.6, handSmudge: 0.5, dust: 0.6, corner: 0.6, stains: [0, 1] },
  Gallery: { ...NONE, outletPitch: 9, thermostat: true, fireAlarm: 1, extinguisherSign: 1, exitSigns: true, scuff: 0.3, doorGrime: 0.5, handSmudge: 0.4, dust: 0.5, corner: 0.5, stains: [0, 1] },
  PlayArea: { ...ROOM, outletPitch: 6, papers: [1, 1], paperKinds: ['paperCaution'], stains: [0, 2] },
  OrganicZone: { ...NONE, scuff: 0.5, doorGrime: 0.5 },
  ParkingGrid: { ...NONE, fireAlarm: 1, extinguisherSign: 2, pictos: ['pictoNoSmoking'], papers: [1, 1], paperKinds: ['paperCaution'], exitSigns: true, scuff: 0.5, doorGrime: 1, handSmudge: 0.7, dust: 1, corner: 1, stains: [1, 3] },
  WarehouseGrid: INDUSTRIAL,
  StorageGrid: INDUSTRIAL,
  ServiceMaze: INDUSTRIAL,
  ShelfGrid: { ...ROOM, outletPitch: 6, papers: [1, 1], scuff: 0.5, dust: 0.7, corner: 0.7, stains: [0, 1] },
  RetailGrid: { ...ROOM, outletPitch: 0, switches: false, thermostat: false, papers: [0, 1], scuff: 1, stains: [0, 2] },
  MazeGrid: { ...ROOM, papers: [0, 1], stains: [0, 2] },
  ServerGrid: { ...ROOM, papers: [0, 1], stains: [0, 2] },
  DynamicGrid: { ...ROOM, papers: [0, 1], stains: [0, 2] },
  AtriumLobby: { ...NONE, outletPitch: 9, fireAlarm: 1, extinguisherSign: 2, pictos: ['pictoToilet', 'pictoNoSmoking'], exitSigns: true, scuff: 0.7, doorGrime: 0.8, handSmudge: 0.6, dust: 0.7, corner: 0.7, stains: [0, 2] },
  Terminal: { ...NONE, outletPitch: 9, fireAlarm: 1, extinguisherSign: 2, pictos: ['pictoToilet', 'pictoNoSmoking'], exitSigns: true, scuff: 0.7, doorGrime: 0.8, handSmudge: 0.6, dust: 0.7, corner: 0.7, stains: [0, 2] },
  PoolCorridor: { ...NONE, extinguisherSign: 1, papers: [1, 1], paperKinds: ['paperCaution'], exitSigns: true, corner: 0.4, stains: [1, 2] },
  MegaAtrium: { ...NONE, outletPitch: 10, fireAlarm: 2, extinguisherSign: 2, pictos: ['pictoToilet', 'pictoNoSmoking'], papers: [0, 1], exitSigns: true, scuff: 0.5, doorGrime: 0.8, handSmudge: 0.6, dust: 0.8, corner: 0.7, stains: [1, 3] },
  MegaHall: { ...NONE, outletPitch: 10, fireAlarm: 2, extinguisherSign: 2, pictos: ['pictoNoSmoking'], papers: [0, 1], paperKinds: ['paperCaution'], exitSigns: true, scuff: 0.5, doorGrime: 0.8, handSmudge: 0.6, dust: 0.8, corner: 0.7, stains: [1, 3] },
  StreetGrid: NONE,
  RoadGraph: NONE,
  VerticalCore: NONE,
};

/** 上限（三角形 = 2 × アイテム。部屋あたり +2,000 三角形以内） */
const MAX_ITEMS = 900;
const MAX_GRIME = 700;
/** 帯状デカール 1 枚の最大長（アトラスのセル 1 枚を割り当てる長さ） */
const STRIP_LEN = 4;
/** 面からの基本浮かせ量 */
const LIFT = 0.004;
/** ArchitecturalDetails が壁箱ごとに自動で付ける巾木（高さ 0.015〜0.125、出 0.018）と廻り縁（上 0.055、出 0.009） */
const SKIRT_TOP = 0.125;
const SKIRT_OUT = 0.018;
const CROWN_H = 0.055;
const CROWN_OUT = 0.009;
/** 壁面に貼れない材質（窓・ガラス・虚空・掲示面・サイン板） */
const BLOCK_MATS = new Set(['windowDark', 'windowNight', 'windowLit', 'glass', 'void', 'noticeGreen', 'signPlate', 'signEmissive', 'water', 'waterShallow', 'waterWall', 'waterFilm', 'outsideView', 'skyDay', 'carGlass']);
/** 天井の器具（シミを避ける） */
const LUMINAIRE = /^(light|sodium|led|screenGlow|window|sky)/;

// ---------------------------------------------------------------- 壁モデル

interface Hug {
  t0: number; t1: number; y0: number; y1: number;
  /** 壁面からの出（m） */
  prot: number;
  mat: string;
  solid: boolean;
  kind?: string;
}

interface Opening { t: number; w: number; sill: number; h: number; s: Socket }

interface Wall {
  dir: Dir;
  /** 壁の室内面の座標（across） */
  face: number;
  /** 使える区間（両端の直交壁の厚みを除く） */
  a0: number; a1: number;
  /** 区間の元の端（矩形の辺の座標） */
  e0: number; e1: number;
  inward: 1 | -1;
  n: Vec3;
  u: Vec3;
  /** along 座標が u 方向に増えるか */
  uSign: 1 | -1;
  openings: Opening[];
  hugs: Hug[];
  rect: Rect;
  /** 矩形の長辺側の壁か */
  longSide: boolean;
}

const INWARD: Record<Dir, 1 | -1> = { 0: -1, 1: -1, 2: 1, 3: 1 };

function inwardVec(d: Dir): Vec3 {
  const v = dirVec(d);
  return [-v[0], 0, -v[2]];
}

/** u = up × n（壁に向かって立つ人の右手） */
function tangentOf(n: Vec3): Vec3 {
  return [n[2], 0, -n[0]];
}

function wallPoint(w: Wall, t: number, y: number): Vec3 {
  return w.dir === 0 || w.dir === 2 ? [t, y, w.face] : [w.face, y, t];
}

function buildWalls(L: RoomLayout): Wall[] {
  const rects = L.footprint;
  const out: Wall[] = [];
  for (const sp of wallSpans(rects)) {
    const e = sp.edge;
    const inward = INWARD[e.dir];
    const face = e.coord + inward * WALL_T;
    const n = inwardVec(e.dir);
    const axis = e.dir === 0 || e.dir === 2 ? 2 : 0;
    const alongAxis = axis === 2 ? 0 : 2;
    const openings: Opening[] = L.sockets
      .filter((s) => s.type !== 'hole' && s.dir === e.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - e.coord) < 0.05)
      .map((s) => ({ t: along(s.dir, s.pos[0], s.pos[2]), w: s.width, sill: s.pos[1] + (s.sill ?? 0), h: s.height, s }))
      .filter((o) => o.t + o.w / 2 > sp.a0 && o.t - o.w / 2 < sp.a1);
    // 壁面に接している箱（帯・装飾扉・家具）。出 prot と壁面座標の矩形
    const hugs: Hug[] = [];
    for (const b of L.boxes) {
      // 床・天井のスラブ（壁の高さ範囲に無い）は壁付きの箱ではない
      if (b.max[1] <= 0.01 || b.min[1] >= L.height - 0.01) continue;
      const near = inward > 0 ? b.min[axis] : b.max[axis];
      const far = inward > 0 ? b.max[axis] : b.min[axis];
      const gap = inward > 0 ? near - face : face - near;
      const prot = inward > 0 ? far - face : face - far;
      if (prot <= 0.002 || gap > 0.2) continue;
      const t0 = b.min[alongAxis], t1 = b.max[alongAxis];
      if (t1 < sp.a0 - 0.01 || t0 > sp.a1 + 0.01) continue;
      hugs.push({ t0, t1, y0: b.min[1], y1: b.max[1], prot, mat: b.mat, solid: b.solid, kind: b.kind });
    }
    const w = e.rect.x1 - e.rect.x0, d = e.rect.z1 - e.rect.z0;
    const longSide = (e.dir === 1 || e.dir === 3) ? d >= w : w > d;
    out.push({ dir: e.dir, face, a0: sp.a0 + WALL_T, a1: sp.a1 - WALL_T, e0: sp.a0, e1: sp.a1, inward, n, u: tangentOf(n), uSign: e.dir === 1 || e.dir === 2 ? 1 : -1, openings, hugs, rect: e.rect, longSide });
  }
  return out;
}

interface PlacedRect { t0: number; t1: number; y0: number; y1: number }

/** 壁面の矩形 [t0,t1]×[y0,y1] が空いているか。空いていれば浮かせ量（帯の出 + LIFT）を返す。
 *  opts.placed: 同じ壁に既に置いた設備・紙（重ねない） */
function wallFree(L: RoomLayout, w: Wall, t0: number, t1: number, y0: number, y1: number, opts: { ignoreOpening?: Socket; placed?: PlacedRect[] } = {}): number | null {
  // a0 / a1 は直交壁の厚みを除いた室内側の端なので、端に接する矩形は許す
  if (t0 < w.a0 - 0.005 || t1 > w.a1 + 0.005) return null;
  if (opts.placed?.some((r) => t1 > r.t0 - 0.03 && t0 < r.t1 + 0.03 && y1 > r.y0 - 0.03 && y0 < r.y1 + 0.03)) return null;
  if (y0 < 0.02 || y1 > L.height - 0.02) return null;
  // 開口（枡・ケーシングの余白 0.11 m）
  for (const o of w.openings) {
    if (o.s === opts.ignoreOpening) continue;
    if (t1 > o.t - o.w / 2 - 0.11 && t0 < o.t + o.w / 2 + 0.11 && y1 > o.sill - 0.02 && y0 < o.sill + o.h + 0.11) return null;
  }
  let prot = 0;
  for (const h of w.hugs) {
    if (t1 <= h.t0 + 0.005 || t0 >= h.t1 - 0.005 || y1 <= h.y0 + 0.005 || y0 >= h.y1 - 0.005) continue;
    if (h.prot > 0.03 || BLOCK_MATS.has(h.mat)) return null;
    prot = Math.max(prot, h.prot);
  }
  // サイン（同じ壁、幅 × 幅/4）とラベル
  const facing = ((w.dir + 2) % 4) as Dir;
  for (const s of L.signs ?? []) {
    if (s.dir !== facing) continue;
    if (Math.abs(across(w.dir, s.pos[0], s.pos[2]) - w.face) > 0.12) continue;
    const st = along(w.dir, s.pos[0], s.pos[2]), hw = s.width / 2 + 0.03, hh = s.width / 8 + 0.03;
    if (t1 > st - hw && t0 < st + hw && y1 > s.pos[1] - hh && y0 < s.pos[1] + hh) return null;
  }
  for (const lb of L.labels) {
    if (lb.dir !== facing || Math.abs(across(w.dir, lb.pos[0], lb.pos[2]) - w.face) > 0.12) continue;
    const st = along(w.dir, lb.pos[0], lb.pos[2]), hw = lb.width / 2 + 0.03, hh = lb.width / 8 + 0.03;
    if (t1 > st - hw && t0 < st + hw && y1 > lb.pos[1] - hh && y0 < lb.pos[1] + hh) return null;
  }
  // 自動の巾木・廻り縁（wall* 材質の外壁にだけ付く）
  if (/^wall/.test(L.palette.wall) && L.height > 2) {
    if (y0 < SKIRT_TOP) prot = Math.max(prot, SKIRT_OUT);
    if (y1 > L.height - CROWN_H) prot = Math.max(prot, CROWN_OUT);
  }
  return prot + LIFT;
}

// ---------------------------------------------------------------- 本体

interface Ctx {
  L: RoomLayout;
  p: GenParams;
  rng: Rng;
  prof: Profile;
  walls: Wall[];
  items: DecalItem[];
  grimeCount: number;
  h: number;
  tid: string;
  defId: string;
  corridor: boolean;
  /** ソケット（hole 以外・通常扉）ごとに「この部屋の戻り側かもしれない」印は付けず、mirrorIfReturn で描画側に委ねる */
  doorSockets: Socket[];
  /** 壁ごとに置いた設備・紙の矩形（同士を重ねない） */
  placed: Map<Wall, PlacedRect[]>;
  /** 床の擦れで既に覆った軸平行区間（経路の重なりを 1 枚にする） */
  scuffCovered: { axis: 0 | 2; cross: number; a0: number; a1: number }[];
}

function push(c: Ctx, item: DecalItem): boolean {
  if (c.items.length >= MAX_ITEMS) return false;
  if (item.grime) {
    if (c.grimeCount >= MAX_GRIME) return false;
    c.grimeCount++;
  }
  c.items.push(item);
  return true;
}

function wallItem(c: Ctx, w: Wall, kind: DecalKind, t: number, y: number, size: [number, number], offset: number, extra: Partial<DecalItem> = {}): boolean {
  const ok = push(c, { kind, pos: wallPoint(w, t, y), normal: w.n, tangent: w.u, size, offset, ...extra });
  if (ok && !extra.grime) {
    let list = c.placed.get(w);
    if (!list) c.placed.set(w, list = []);
    list.push({ t0: t - size[0] / 2, t1: t + size[0] / 2, y0: y - size[1] / 2, y1: y + size[1] / 2 });
  }
  return ok;
}

/** 設備・紙用: 壁面が空いていて、既に置いた設備・紙とも重ならない */
function fixtureFree(c: Ctx, w: Wall, t0: number, t1: number, y0: number, y1: number, ignoreOpening?: Socket): number | null {
  return wallFree(c.L, w, t0, t1, y0, y1, { ignoreOpening, placed: c.placed.get(w) });
}

/** 取っ手側（ソケット局所 +X を dir で回した向き）の along 符号。戻り側の Portal では描画側が鏡像にする */
function handleSign(dir: Dir): 1 | -1 {
  return dir === 0 || dir === 3 ? 1 : -1;
}

function wallOfSocket(c: Ctx, s: Socket): Wall | undefined {
  const t = along(s.dir, s.pos[0], s.pos[2]);
  return c.walls.find((w) => w.dir === s.dir && Math.abs(w.face - (across(s.dir, s.pos[0], s.pos[2]) + INWARD[s.dir] * WALL_T)) < 0.02 && t >= w.e0 - 0.01 && t <= w.e1 + 0.01);
}

export function applyDecalRules(L: RoomLayout, p: GenParams): void {
  const out = L as LayoutWithDecals;
  out.decalItems = undefined;
  if (L.render?.style || L.roll || !L.footprint.length) return;
  const tid = p.template.id;
  const prof = PROFILES[tid] ?? (p.def.generator === 'CorridorGenerator' ? CORRIDOR : ROOM);
  if (prof === NONE) return;
  const rng = p.rng.fork('decals');
  const walls = buildWalls(L);
  const doorSockets = L.sockets.filter((s) => s.type === 'door' && !s.crawl && !(s.sill && s.sill > 0.05));
  const c: Ctx = { L, p, rng, prof, walls, items: [], grimeCount: 0, h: L.height, tid, defId: p.def.id, corridor: p.def.generator === 'CorridorGenerator', doorSockets, placed: new Map(), scuffCovered: [] };

  // 設備・紙（現実の頻度。Tier に依らず描く）
  placeExitSigns(c);
  placeSwitches(c);
  placeOutlets(c);
  placeThermostat(c);
  placeFireAlarms(c);
  placeExtinguisherSigns(c);
  placePictos(c);
  placePapers(c);
  placePosters(c);
  // 汚れ（意味のある場所だけ。Tier low で省略）
  placeDoorGrime(c);
  placeFloorScuff(c);
  placeDust(c);
  placeCornerGrime(c);
  placeChairRub(c);
  placeCeilingStains(c);

  if (c.items.length) out.decalItems = c.items;
}

// ---------------------------------------------------------------- 設備

function placeExitSigns(c: Ctx): void {
  if (!c.prof.exitSigns) return;
  const sw = 0.40, sh = 0.15;
  // 誘導灯は避難経路の扉だけ: 'end'（廊下の突き当たり）を優先し、部屋あたり最大 3 枚
  let budget = 3;
  const order = [...c.L.sockets].sort((a, b) => (b.id === 'end' ? 1 : 0) - (a.id === 'end' ? 1 : 0));
  for (const s of order) {
    if (budget <= 0) break;
    if (s.id === 'entry' || s.type === 'hole' || s.crawl) continue;
    if (s.type !== 'door' && s.type !== 'stairs' && s.type !== 'ramp') continue;
    const w = wallOfSocket(c, s);
    if (!w) continue;
    const t = along(s.dir, s.pos[0], s.pos[2]);
    const top = s.pos[1] + (s.sill ?? 0) + s.height;
    let y = top + 0.15 + sh / 2;
    if (y + sh / 2 > c.h - 0.06) y = c.h - 0.06 - sh / 2;
    if (y - sh / 2 < top + 0.1) continue; // 天井までの余白が無い（高い開口）
    // 既存の発光サイン（C17 の非常口など）の近くには重ねない
    if ((c.L.signs ?? []).some((g) => g.kind === 'emissive' && Math.hypot(g.pos[0] - s.pos[0], g.pos[2] - s.pos[2]) < 0.9 && Math.abs(g.pos[1] - y) < 0.4)) continue;
    const off = fixtureFree(c, w, t - sw / 2, t + sw / 2, y - sh / 2, y + sh / 2, s);
    if (off === null) continue;
    if (wallItem(c, w, 'exitSign', t, y, [sw, sh], off, { emissive: true, variant: 0 })) budget--;
  }
}

function placeSwitches(c: Ctx): void {
  if (!c.prof.switches) return;
  const pw = 0.10, ph = 0.16;
  for (const s of c.doorSockets) {
    const w = wallOfSocket(c, s);
    if (!w) continue;
    const t = along(s.dir, s.pos[0], s.pos[2]) + handleSign(s.dir) * (s.width / 2 + 0.1 + 0.15 + pw / 2);
    const y = 1.2;
    const off = fixtureFree(c, w, t - pw / 2, t + pw / 2, y - ph / 2, y + ph / 2);
    if (off === null) continue;
    wallItem(c, w, 'switch', t, y, [pw, ph], off, { variant: c.rng.int(0, 1), mirrorIfReturn: s.id });
  }
}

/** 廊下で片側だけに置くときの「採用する壁の向き」 */
function pickSide(c: Ctx): (w: Wall) => boolean {
  const side = c.rng.int(0, 1);
  return (w) => {
    if (!w.longSide) return false;
    const alongZ = w.rect.z1 - w.rect.z0 >= w.rect.x1 - w.rect.x0;
    return alongZ ? w.dir === (side ? 1 : 3) : w.dir === (side ? 0 : 2);
  };
}

function placeOutlets(c: Ctx): void {
  const pitch = c.prof.outletPitch;
  if (pitch <= 0) return;
  const pw = 0.10, ph = 0.16, y = c.prof.outletY;
  const accept = c.corridor && c.prof.oneSide ? pickSide(c) : () => true;
  for (const w of c.walls) {
    if (!accept(w)) continue;
    const len = w.a1 - w.a0;
    if (len < 1.6) continue;
    const n = Math.max(1, Math.floor(len / pitch));
    const step = len / n;
    for (let k = 0; k < n; k++) {
      const t = w.a0 + step * (k + 0.5) + c.rng.float(-0.3, 0.3) * Math.min(1, step / 4);
      // 開口・ソケットから 0.6 m 以上
      if (w.openings.some((o) => Math.abs(o.t - t) < o.w / 2 + 0.6 + pw / 2)) continue;
      const off = fixtureFree(c, w, t - pw / 2, t + pw / 2, y - ph / 2, y + ph / 2);
      if (off === null) continue;
      wallItem(c, w, 'outlet', t, y, [pw, ph], off, { variant: c.rng.int(0, 1) });
    }
  }
}

/** ソケット脇（取っ手側 side=+1 / 反対側 -1）の壁面に size の板を置く。距離 dist は枡の外端から */
function besideDoor(c: Ctx, s: Socket, side: 1 | -1, dist: number, y: number, size: [number, number]): { w: Wall; t: number; off: number } | null {
  const w = wallOfSocket(c, s);
  if (!w) return null;
  const t = along(s.dir, s.pos[0], s.pos[2]) + side * handleSign(s.dir) * (s.width / 2 + 0.1 + dist + size[0] / 2);
  const off = fixtureFree(c, w, t - size[0] / 2, t + size[0] / 2, y - size[1] / 2, y + size[1] / 2);
  return off === null ? null : { w, t, off };
}

function placeThermostat(c: Ctx): void {
  if (!c.prof.thermostat) return;
  const size: [number, number] = [0.16, 0.16];
  const y = 1.5;
  const entry = c.doorSockets.find((s) => s.id === 'entry');
  const order = [...(entry ? [entry] : []), ...c.doorSockets.filter((s) => s !== entry)];
  for (const s of order) {
    for (const [side, dist] of [[1, 0.9], [-1, 0.9], [1, 1.6]] as [1 | -1, number][]) {
      const r = besideDoor(c, s, side, dist, y, size);
      if (!r) continue;
      wallItem(c, r.w, 'thermostat', r.t, y, size, r.off, { mirrorIfReturn: s.id });
      return;
    }
  }
}

function placeFireAlarms(c: Ctx): void {
  let want = c.prof.fireAlarm;
  if (want <= 0) return;
  const size: [number, number] = [0.16, 0.20];
  const y = 1.35;
  const exits = c.doorSockets.filter((s) => s.id !== 'entry');
  for (const s of exits) {
    const r = besideDoor(c, s, -1, 0.35, y, size);
    if (!r) continue;
    wallItem(c, r.w, 'fireAlarm', r.t, y, size, r.off, { mirrorIfReturn: s.id });
    if (--want <= 0) return;
  }
}

function placeExtinguisherSigns(c: Ctx): void {
  let want = c.prof.extinguisherSign;
  if (want <= 0) return;
  const size: [number, number] = [0.14, 0.40];
  // 既存の消火器プロップ（kind 'extinguisher'）の真上に
  for (const w of c.walls) {
    for (const h of w.hugs) {
      if (h.kind !== 'extinguisher' || want <= 0) continue;
      const t = (h.t0 + h.t1) / 2, y = Math.min(c.h - 0.4, h.y1 + 0.35 + size[1] / 2);
      const off = fixtureFree(c, w, t - size[0] / 2, t + size[0] / 2, y - size[1] / 2, y + size[1] / 2);
      if (off === null) continue;
      wallItem(c, w, 'extinguisherSign', t, y, size, off);
      want--;
    }
  }
  if (want <= 0) return;
  // 無ければ入口 → 出口の順で扉の脇（反対側 = 発信機と同じ側の外側）
  const y = 1.75;
  const order = [...c.doorSockets.filter((s) => s.id === 'entry'), ...c.doorSockets.filter((s) => s.id !== 'entry')];
  for (const s of order) {
    const r = besideDoor(c, s, -1, 0.75, y, size);
    if (!r) continue;
    wallItem(c, r.w, 'extinguisherSign', r.t, y, size, r.off, { mirrorIfReturn: s.id });
    if (--want <= 0) return;
  }
}

function placePictos(c: Ctx): void {
  if (!c.prof.pictos.length) return;
  const size: [number, number] = [0.22, 0.22];
  const y = 1.75;
  const exits = c.doorSockets.filter((s) => s.id !== 'entry');
  for (const kind of c.prof.pictos) {
    if (!c.rng.chance(0.55)) continue;
    // 出口扉の脇（貼り紙と競合しない高さ 1.75）。無ければ長い壁の中央付近
    let done = false;
    for (const s of c.rng.shuffle([...exits])) {
      const r = besideDoor(c, s, 1, 0.45, y, size);
      if (!r) continue;
      wallItem(c, r.w, kind, r.t, y, size, r.off, { mirrorIfReturn: s.id });
      done = true;
      break;
    }
    if (done) continue;
    for (const w of c.rng.shuffle(c.walls.filter((x) => x.a1 - x.a0 > 3))) {
      const t = (w.a0 + w.a1) / 2 + c.rng.float(-1, 1);
      const off = fixtureFree(c, w, t - size[0] / 2, t + size[0] / 2, y - size[1] / 2, y + size[1] / 2);
      if (off === null) continue;
      wallItem(c, w, kind, t, y, size, off);
      break;
    }
  }
  // 廊下: 通路誘導の矢印札（end へ向かう向き）を長い壁に 1 枚
  if (c.corridor && c.rng.chance(0.5)) {
    const end = c.L.sockets.find((s) => s.id === 'end');
    if (!end) return;
    const w = c.rng.pick(c.walls.filter((x) => x.longSide && x.a1 - x.a0 > 4));
    if (!w) return;
    const t = c.rng.float(w.a0 + 1, w.a1 - 1);
    const ps: [number, number] = [0.40, 0.15];
    const off = fixtureFree(c, w, t - ps[0] / 2, t + ps[0] / 2, 2.0 - ps[1] / 2, 2.0 + ps[1] / 2);
    if (off === null) return;
    // 矢印の向き: end のこの壁に沿った座標が t より u 方向で先か
    const endT = along(w.dir, end.pos[0], end.pos[2]);
    const toRight = (endT - t) * w.uSign > 0;
    wallItem(c, w, 'pictoExit', t, 2.0, ps, off, { variant: toRight ? 2 : 1, emissive: true });
  }
}

// ---------------------------------------------------------------- 紙

function placePapers(c: Ctx): void {
  const [lo, hi] = c.prof.papers;
  if (hi <= 0) return;
  const size: [number, number] = [0.24, 0.33];
  for (const s of c.doorSockets) {
    const n = c.rng.int(lo, hi);
    for (let k = 0; k < n; k++) {
      const y = c.rng.float(1.4, 1.6);
      // 取っ手側の反対（スイッチと競合しない）から、外へ 0.28 m ごと
      const side: 1 | -1 = k % 2 === 0 ? -1 : 1;
      const dist = 0.18 + Math.floor(k / 2) * 0.30;
      const r = besideDoor(c, s, side, dist, y, size);
      if (!r) continue;
      const kind = c.rng.pick(c.prof.paperKinds);
      wallItem(c, r.w, kind, r.t, y, size, r.off, { variant: c.rng.int(0, 3), mirrorIfReturn: s.id });
    }
  }
}

function placePosters(c: Ctx): void {
  const pitch = c.prof.posterPitch;
  if (pitch <= 0) return;
  if (c.defId === 'C19') return; // 地下歩道は生成側の額装ポスターがある
  const size: [number, number] = [0.56, 0.78];
  const y = 1.55;
  for (const w of c.walls) {
    if (!w.longSide) continue;
    const len = w.a1 - w.a0;
    if (len < pitch * 0.7) continue;
    const n = Math.max(1, Math.floor(len / pitch));
    const step = len / n;
    for (let k = 0; k < n; k++) {
      const t = w.a0 + step * (k + 0.5) + c.rng.float(-0.8, 0.8);
      const off = fixtureFree(c, w, t - size[0] / 2, t + size[0] / 2, y - size[1] / 2, y + size[1] / 2);
      if (off === null) continue;
      wallItem(c, w, 'poster', t, y, size, off, { variant: c.rng.int(0, 2) });
    }
  }
}

// ---------------------------------------------------------------- 汚れ

function placeDoorGrime(c: Ctx): void {
  const g = c.prof.doorGrime, hs = c.prof.handSmudge;
  if (g <= 0 && hs <= 0) return;
  for (const s of c.doorSockets) {
    const w = wallOfSocket(c, s);
    if (!w) continue;
    const t = along(s.dir, s.pos[0], s.pos[2]);
    const inward = inwardVec(s.dir);
    if (g > 0) {
      // 床: 扉前 0.6 m。濃い側（v=1）が敷居
      const depth = 0.6, width = s.width + 0.5;
      const v = dirVec(s.dir);
      const u: Vec3 = [-v[2], 0, v[0]]; // u = v × n（n = +Y）。描画側の v = n × u が敷居側を向く
      const center: Vec3 = [s.pos[0] + inward[0] * depth / 2, s.pos[1] + 0, s.pos[2] + inward[2] * depth / 2];
      if (inFootprint(c.L.footprint, center[0], center[2], 0.05)) {
        push(c, { kind: 'doorGrimeFloor', pos: center, normal: [0, 1, 0], tangent: u, size: [width, depth], offset: LIFT, alpha: g, grime: true, variant: c.rng.int(0, 1), flip: c.rng.chance(0.5) });
      }
      // 壁: 枡の両脇 0.25 × 0.35（濃い側 = 枡側 = u 反転で合わせる）
      const jw = 0.25, jh = 0.35;
      for (const side of [1, -1] as const) {
        const jt = t + side * (s.width / 2 + 0.1 + jw / 2);
        const off = wallFree(c.L, w, jt - jw / 2, jt + jw / 2, 0.02, jh, { ignoreOpening: s });
        if (off === null) continue;
        // 濡れ側（枡）は中心から見て -side 方向。セルは u=1 が濃いので、枡が u=1 側に来ないとき反転
        const frameSign = -side;
        wallItem(c, w, 'doorGrimeJamb', jt, jh / 2 + 0.005, [jw, jh], off, { alpha: g, grime: true, flip: frameSign * w.uSign < 0 });
      }
    }
    if (hs > 0) {
      const size: [number, number] = [0.35, 0.45];
      const y = 1.05;
      const ht = t + handleSign(s.dir) * (s.width / 2 + 0.1 + size[0] / 2 - 0.05);
      const off = wallFree(c.L, w, ht - size[0] / 2 + 0.06, ht + size[0] / 2, y - size[1] / 2, y + size[1] / 2, { ignoreOpening: s });
      if (off !== null) wallItem(c, w, 'handSmudge', ht, y, size, off, { alpha: hs, grime: true, variant: c.rng.int(0, 1), mirrorIfReturn: s.id });
    }
  }
}

/** 矩形 i と j が辺で接しているときの共有区間の中点（無ければ null） */
function sharedMid(a: Rect, b: Rect): [number, number] | null {
  const eps = 0.02;
  const ov = (p0: number, p1: number, q0: number, q1: number) => [Math.max(p0, q0), Math.min(p1, q1)] as [number, number];
  if (Math.abs(a.x1 - b.x0) < eps || Math.abs(a.x0 - b.x1) < eps) {
    const [z0, z1] = ov(a.z0, a.z1, b.z0, b.z1);
    if (z1 - z0 > 0.6) return [Math.abs(a.x1 - b.x0) < eps ? a.x1 : a.x0, (z0 + z1) / 2];
  }
  if (Math.abs(a.z1 - b.z0) < eps || Math.abs(a.z0 - b.z1) < eps) {
    const [x0, x1] = ov(a.x0, a.x1, b.x0, b.x1);
    if (x1 - x0 > 0.6) return [(x0 + x1) / 2, Math.abs(a.z1 - b.z0) < eps ? a.z1 : a.z0];
  }
  return null;
}

function rectAt(rects: Rect[], x: number, z: number): number {
  let best = -1, bestD = Infinity;
  rects.forEach((r, i) => {
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = i; }
  });
  return bestD < 0.3 ? best : -1;
}

/** 矩形内の 2 点を結ぶ L 字（最初の辺は矩形の長軸に沿う） */
function manhattan(r: Rect, a: [number, number], b: [number, number]): [number, number][] {
  const alongZ = r.z1 - r.z0 >= r.x1 - r.x0;
  const corner: [number, number] = alongZ ? [a[0], b[1]] : [b[0], a[1]];
  const pts: [number, number][] = [a];
  if (Math.hypot(corner[0] - a[0], corner[1] - a[1]) > 0.2 && Math.hypot(corner[0] - b[0], corner[1] - b[1]) > 0.2) pts.push(corner);
  pts.push(b);
  return pts;
}

function placeFloorScuff(c: Ctx): void {
  const g = c.prof.scuff;
  if (g <= 0) return;
  const rects = c.L.footprint;
  const entry = c.L.sockets.find((s) => s.id === 'entry' && s.type !== 'hole');
  const exits = c.L.sockets.filter((s) => s.id !== 'entry' && s.type !== 'hole' && (s.type === 'door' || s.type === 'stairs' || s.type === 'ramp' || s.type === 'street' || s.type === 'gate')).slice(0, 6);
  if (!entry || !exits.length) return;
  // 矩形の隣接グラフ
  const adj: Map<number, { j: number; mid: [number, number] }[]> = new Map();
  rects.forEach((_, i) => adj.set(i, []));
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const m = sharedMid(rects[i], rects[j]);
    if (m) { adj.get(i)!.push({ j, mid: m }); adj.get(j)!.push({ j: i, mid: m }); }
  }
  const inPoint = (s: Socket): [number, number] => { const v = inwardVec(s.dir); return [s.pos[0] + v[0] * 0.35, s.pos[2] + v[2] * 0.35]; };
  const start = inPoint(entry);
  const startRect = rectAt(rects, start[0], start[1]);
  if (startRect < 0) return;
  const bandW = (r: Rect) => Math.max(0.8, Math.min(1.2, Math.min(r.x1 - r.x0, r.z1 - r.z0) * 0.32));
  for (const ex of exits) {
    const goal = inPoint(ex);
    const goalRect = rectAt(rects, goal[0], goal[1]);
    if (goalRect < 0) continue;
    // BFS
    const prev = new Map<number, { i: number; mid: [number, number] }>();
    const q = [startRect];
    const seen = new Set([startRect]);
    while (q.length) {
      const i = q.shift()!;
      if (i === goalRect) break;
      for (const { j, mid } of adj.get(i)!) if (!seen.has(j)) { seen.add(j); prev.set(j, { i, mid }); q.push(j); }
    }
    if (startRect !== goalRect && !prev.has(goalRect)) continue;
    // 矩形列と通過点
    const chain: { rect: number; enter: [number, number]; exit: [number, number] }[] = [];
    let cur = goalRect, exitPt = goal;
    while (cur !== startRect) {
      const pv = prev.get(cur)!;
      chain.unshift({ rect: cur, enter: pv.mid, exit: exitPt });
      exitPt = pv.mid;
      cur = pv.i;
    }
    chain.unshift({ rect: startRect, enter: start, exit: exitPt });
    for (const seg of chain) {
      const r = rects[seg.rect];
      const pts = manhattan(r, seg.enter, seg.exit);
      for (let k = 0; k + 1 < pts.length; k++) scuffSegment(c, pts[k], pts[k + 1], bandW(r), g, k === pts.length - 2 && seg.rect === goalRect, k === 0 && seg.rect === startRect);
    }
  }
}

function scuffSegment(c: Ctx, a: [number, number], b: [number, number], width: number, g: number, toDoor: boolean, fromDoor: boolean): void {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.5) return;
  const ux = dx / len, uz = dz / len;
  // 軸平行の区間として、既に別経路で覆った部分を除く（重ねて濃くしない）
  const axis: 0 | 2 = Math.abs(dx) >= Math.abs(dz) ? 0 : 2;
  const cross = axis === 0 ? a[1] : a[0];
  const lo = axis === 0 ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
  const hi = axis === 0 ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
  let pieces: [number, number][] = [[lo, hi]];
  for (const cv of c.scuffCovered) {
    if (cv.axis !== axis || Math.abs(cv.cross - cross) > width * 0.6) continue;
    pieces = pieces.flatMap(([p, q]): [number, number][] => (q <= cv.a0 || p >= cv.a1 ? [[p, q]] : [[p, Math.min(q, cv.a0)], [Math.max(p, cv.a1), q]])).filter(([p, q]) => q - p > 0.4);
  }
  c.scuffCovered.push({ axis, cross, a0: lo, a1: hi });
  const sign = axis === 0 ? Math.sign(dx) : Math.sign(dz);
  for (const [p, q] of pieces) {
    const n = Math.max(1, Math.ceil((q - p) / STRIP_LEN));
    const step = (q - p) / n;
    for (let k = 0; k < n; k++) {
      const s0 = p + k * step, s1 = p + (k + 1) * step;
      const mid = (s0 + s1) / 2;
      const cx = axis === 0 ? mid : a[0], cz = axis === 0 ? a[1] : mid;
      if (!inFootprint(c.L.footprint, cx, cz, 0.2)) continue;
      if (c.L.holes.some((h) => cx > h.min[0] - 0.9 && cx < h.max[0] + 0.9 && cz > h.min[2] - 0.9 && cz < h.max[2] + 0.9)) continue;
      // 扉前 1.5 m は濃く: 経路の端に接する区間の alpha を上げる
      const endA = sign > 0 ? lo : hi, endB = sign > 0 ? hi : lo;
      const touchesA = Math.min(Math.abs(s0 - endA), Math.abs(s1 - endA)) < 0.01;
      const touchesB = Math.min(Math.abs(s0 - endB), Math.abs(s1 - endB)) < 0.01;
      const nearDoor = (toDoor && touchesB) || (fromDoor && touchesA);
      const alpha = Math.min(1, (0.55 + c.rng.float(0, 0.45)) * g * (nearDoor ? 1.6 : 1));
      push(c, { kind: 'floorScuff', pos: [cx, 0, cz], normal: [0, 1, 0], tangent: [ux, 0, uz], size: [s1 - s0, width], offset: LIFT, alpha, grime: true, variant: c.rng.int(0, 2), flip: c.rng.chance(0.5) });
    }
  }
}

/** 壁区間のうち、開口と壁付き家具（出 10 cm 超のソリッド）を除いた区間 */
function freeRanges(w: Wall, pad: number): [number, number][] {
  const cuts: [number, number][] = [
    ...w.openings.map((o) => [o.t - o.w / 2 - pad, o.t + o.w / 2 + pad] as [number, number]),
    ...w.hugs.filter((h) => h.solid && h.prot > 0.1 && h.y0 < 0.3 && h.y1 > 0.05).map((h) => [h.t0 - 0.05, h.t1 + 0.05] as [number, number]),
  ].sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = w.a0;
  for (const [p, q] of cuts) {
    if (p > cur + 0.01) out.push([cur, Math.min(p, w.a1)]);
    cur = Math.max(cur, q);
    if (cur >= w.a1) break;
  }
  if (w.a1 > cur + 0.01) out.push([cur, w.a1]);
  return out.filter(([p, q]) => q - p >= 0.6);
}

function splitStrip(p: number, q: number): [number, number][] {
  const n = Math.max(1, Math.ceil((q - p) / STRIP_LEN));
  const step = (q - p) / n;
  return Array.from({ length: n }, (_, k) => [p + k * step, p + (k + 1) * step] as [number, number]);
}

function placeDust(c: Ctx): void {
  const g = c.prof.dust;
  if (g <= 0) return;
  const singleC02 = c.defId === 'C02' && c.L.footprint.length === 1;
  const skirt = /^wall/.test(c.L.palette.wall) && c.h > 2 ? SKIRT_OUT : 0;
  for (const w of c.walls) {
    // C02 の単一矩形の長辺は SurfaceAppearance（材質側）が床の埃を出す
    if (singleC02 && w.longSide) continue;
    for (const [p, q] of freeRanges(w, 0.35)) {
      for (const [s0, s1] of splitStrip(p, q)) {
        const t = (s0 + s1) / 2, len = s1 - s0;
        // 床: 壁面（巾木の外面）から 0.22 m。濃い側（v=1）が壁 → v = 外向き、u = v × n
        const v = dirVec(w.dir);
        const u: Vec3 = [-v[2], 0, v[0]]; // u = v × n（n = +Y）。描画側の v = n × u が壁側を向く
        const depth = 0.22;
        const pos = wallPoint(w, t, 0);
        const center: Vec3 = [pos[0] + w.n[0] * (skirt + depth / 2), 0, pos[2] + w.n[2] * (skirt + depth / 2)];
        if (!push(c, { kind: 'dustFloor', pos: center, normal: [0, 1, 0], tangent: u, size: [len, depth], offset: LIFT, alpha: g * c.rng.float(0.7, 1), grime: true, variant: c.rng.int(0, 1), flip: c.rng.chance(0.5) })) return;
        // 壁: 巾木の上 0.13〜0.23 m
        const y0 = skirt ? SKIRT_TOP + 0.005 : 0.02, y1 = y0 + 0.1;
        const off = wallFree(c.L, w, s0 + 0.01, s1 - 0.01, y0, y1);
        if (off !== null) wallItem(c, w, 'dustWall', t, (y0 + y1) / 2, [len, y1 - y0], off, { alpha: g * 0.8, grime: true, variant: 0, flip: c.rng.chance(0.5) });
      }
    }
  }
}

function placeCornerGrime(c: Ctx): void {
  const g = c.prof.corner;
  if (g <= 0) return;
  const rects = c.L.footprint;
  const strip = 0.32;
  const hh = Math.min(c.h - 0.06, 3.0);
  const covered = (r: Rect, dir: Dir, at: number): boolean => {
    const e = edgesOf(r).find((x) => x.dir === dir)!;
    return wallIntervals(e, rects).some(([a0, a1]) => at >= a0 - 0.01 && at <= a1 + 0.01 && a1 - a0 > 0.5);
  };
  for (const r of rects) {
    // 4 隅: (x0,z0) (x1,z0) (x0,z1) (x1,z1)。両辺に壁があれば入隅
    const corners: { x: number; z: number; dx: Dir; dz: Dir }[] = [
      { x: r.x0, z: r.z0, dx: 3, dz: 2 }, { x: r.x1, z: r.z0, dx: 1, dz: 2 }, { x: r.x0, z: r.z1, dx: 3, dz: 0 }, { x: r.x1, z: r.z1, dx: 1, dz: 0 },
    ];
    for (const k of corners) {
      if (!covered(r, k.dx, k.z) || !covered(r, k.dz, k.x)) continue;
      // x 壁（dir 1/3、along = z）と z 壁（dir 0/2、along = x）
      for (const [dir, cornerAlong] of [[k.dx, k.z], [k.dz, k.x]] as [Dir, number][]) {
        const w = c.walls.find((x) => x.dir === dir && x.rect === r && cornerAlong >= x.e0 - 0.01 && cornerAlong <= x.e1 + 0.01);
        if (!w) continue;
        // 隅は区間の端（e0 か e1）。室内の入隅は直交壁の厚みぶん内側
        const atA1 = Math.abs(cornerAlong - w.e1) < Math.abs(cornerAlong - w.e0);
        const edge = atA1 ? w.a1 : w.a0;
        const t = edge + (atA1 ? -1 : 1) * strip / 2;
        const off = wallFree(c.L, w, t - strip / 2 + 0.01, t + strip / 2 - 0.01, 0.03, 0.03 + hh);
        if (off === null) continue;
        // 濃い側（u=1）が隅に来ないとき反転
        const sideSign = atA1 ? 1 : -1;
        if (!wallItem(c, w, 'cornerGrime', t, 0.03 + hh / 2, [strip, hh], off, { alpha: g, grime: true, flip: sideSign * w.uSign < 0 })) return;
      }
    }
  }
  // 壁と天井の入隅（高い部屋では省く）
  if (c.h > 4.2) return;
  const band = 0.25;
  for (const w of c.walls) {
    for (const [p, q] of freeRanges(w, 0.2)) {
      for (const [s0, s1] of splitStrip(p, q)) {
        const y1 = c.h - 0.03, y0 = y1 - band;
        const off = wallFree(c.L, w, s0 + 0.01, s1 - 0.01, y0, y1);
        if (off === null) continue;
        if (!wallItem(c, w, 'ceilingJunction', (s0 + s1) / 2, (y0 + y1) / 2, [s1 - s0, band], off, { alpha: g * 0.7, grime: true, flip: c.rng.chance(0.5) })) return;
      }
    }
  }
}

function placeChairRub(c: Ctx): void {
  if (!c.prof.chairRub) return;
  for (const w of c.walls) {
    for (const h of w.hugs) {
      if (!h.solid || h.prot < 0.1 || h.prot > 0.9) continue;
      if (!(h.kind === 'chair' || h.kind === 'sofa' || h.mat === 'seatBlue' || h.mat === 'upholstery')) continue;
      const t0 = Math.max(w.a0, h.t0 - 0.2), t1 = Math.min(w.a1, h.t1 + 0.2);
      if (t1 - t0 < 0.5) continue;
      // 背もたれの上端のすぐ上（0.8〜1.0 m 帯）
      const bh = 0.26, y = Math.min(1.05, h.y1 + 0.03 + bh / 2);
      if (y - bh / 2 < h.y1 - 0.02 || y < 0.6) continue;
      const off = wallFree(c.L, w, t0, t1, y - bh / 2, y + bh / 2);
      if (off === null) continue;
      for (const [s0, s1] of splitStrip(t0, t1)) {
        if (!wallItem(c, w, 'chairRub', (s0 + s1) / 2, y, [s1 - s0, bh], off, { alpha: 0.9, grime: true, variant: c.rng.int(0, 1), flip: c.rng.chance(0.5) })) return;
      }
    }
  }
}

function placeCeilingStains(c: Ctx): void {
  const [lo, hi] = c.prof.stains;
  if (hi <= 0) return;
  const n = c.rng.int(lo, hi);
  if (n <= 0) return;
  const h = c.h;
  const luminaires = c.L.boxes.filter((b) => LUMINAIRE.test(b.mat) && b.max[1] > h - 0.2);
  const ceilingHoles = c.L.sockets.filter((s) => s.type === 'hole' && s.pos[1] > h - 0.5);
  const rects = c.L.footprint;
  for (let i = 0, tries = 0; i < n && tries < n * 12; tries++) {
    const r = c.rng.weighted(rects, (x) => (x.x1 - x.x0) * (x.z1 - x.z0));
    const d = c.rng.float(0.6, 1.4);
    const x = c.rng.float(r.x0 + 0.5 + d / 2, r.x1 - 0.5 - d / 2);
    const z = c.rng.float(r.z0 + 0.5 + d / 2, r.z1 - 0.5 - d / 2);
    if (!(x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) continue;
    if (luminaires.some((b) => x + d / 2 > b.min[0] - 0.15 && x - d / 2 < b.max[0] + 0.15 && z + d / 2 > b.min[2] - 0.15 && z - d / 2 < b.max[2] + 0.15)) continue;
    if (ceilingHoles.some((s) => Math.hypot(s.pos[0] - x, s.pos[2] - z) < d / 2 + 1.2)) continue;
    // 他のシミと重ねない
    if (c.items.some((it) => it.kind === 'ceilingStain' && Math.hypot(it.pos[0] - x, it.pos[2] - z) < (it.size[0] + d) / 2 + 0.3)) continue;
    const rot = c.rng.float(0, Math.PI * 2);
    // 天井（法線 -Y）。u = 任意の回転、v = n × u
    const u: Vec3 = [Math.cos(rot), 0, Math.sin(rot)];
    push(c, { kind: 'ceilingStain', pos: [x, h, z], normal: [0, -1, 0], tangent: u, size: [d, d * c.rng.float(0.75, 1)], offset: LIFT, alpha: c.rng.float(0.6, 1), grime: true, variant: c.rng.int(0, 3) });
    i++;
  }
}
