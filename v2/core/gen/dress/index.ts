/**
 * 部屋の中身の窓口: 区画のテーマ（cell.theme。v1 のテンプレート名と同じ語）と種類（kind）から作り方（DressKit）を選んで置く。
 *
 *   dressCell(r) … フロアの生成が区画ごとに呼ぶ。置いた物は r.cell.boxes（と水面のゾーンは r.cell.zones）に足される
 *
 * - テーマごとに「廊下の装い・曲がり角の物・部屋・広間・手すり・隠し部屋の系統」を表（THEME_KITS）で持つ。
 *   廊下のテーマの部屋（入口の部屋など）・部屋のテーマの廊下も、表の組み合わせで自然な中身になる
 * - 表に無いテーマは汎用（GenericRoom と同じ）
 * - どの作り方も ctx.kit で包むので、扉前・keepOut・足跡の外には当たる物を置かず、最後に開口どうしの到達を確かめる
 */
import type { MatId } from '../../world/layout.ts';
import { kit, type DressCtx } from './ctx.ts';
import { CORRIDOR_STYLES, dressCorridor, dressExit, dressJunction, dressStairs, type CorridorProp } from './kits/corridor.ts';
import { library, mazeRoom, server, storage, supermarket, warehouse } from './kits/grids.ts';
import { gallery, lobby, parking, playArea, pool, poolCorridor, terminal, theater } from './kits/halls.ts';
import {
  apartment, arcadeHall, classroom, clinic, genericRoom, hotelRoom, karaoke, largeRoom, lockerRoom, office, restroom, retail, serviceRoom, smallRoom, waiting,
} from './kits/rooms.ts';
import { cornerPlants } from './kits/common.ts';
import { secretRoom, type SecretStyle } from './kits/secret.ts';
import { patternIslands, patternPartitions } from './patterns.ts';
import { planter } from './props.ts';
import type { DressKind, DressKit, DressRoom } from './types.ts';

export type { DressKind, DressKit, DressRoom } from './types.ts';
export type { DressCtx } from './ctx.ts';

type RoomFn = (c: DressCtx) => void;

/** テーマごとの中身の作り方 */
export interface ThemeKit {
  /** 廊下・曲がり角の装い（CORRIDOR_STYLES のキー。'pool' はプールの回廊） */
  corridor: string;
  /** 曲がり角に置きやすい物 */
  junction: CorridorProp[];
  room: RoomFn;
  hall: RoomFn;
  /** 階段・出口の手すりの材質 */
  rail: MatId;
  /** 隠し部屋の系統 */
  secret: SecretStyle;
}

const T = (corridor: string, junction: CorridorProp[], room: RoomFn, hall: RoomFn, rail: MatId, secret: SecretStyle): ThemeKit => ({ corridor, junction, room, hall, rail, secret });

/** テーマ（v1 のテンプレート名 = core/world/palettes.ts の THEME_PALETTES のキー）→ 作り方 */
export const THEME_KITS: Record<string, ThemeKit> = {
  // 廊下のテーマ（その系統の部屋・広間も持つ）
  CorridorOffice: T('office', ['vending', 'waterCooler', 'plant', 'bin'], office, office, 'metal', 'office'),
  CorridorHotel: T('hotel', ['plant', 'cabinet'], hotelRoom, lobby, 'handrailWood', 'hotel'),
  CorridorSchool: T('school', ['vending', 'bin', 'lockers'], classroom, classroom, 'handrailWood', 'school'),
  CorridorHospital: T('hospital', ['seats', 'plant', 'waterCooler'], clinic, waiting, 'handrailWood', 'hospital'),
  CorridorService: T('service', ['rollCage', 'cabinet', 'bin'], serviceRoom, warehouse, 'metal', 'service'),
  TransitCorridor: T('transit', ['bench', 'bin', 'vending'], terminal, terminal, 'metal', 'plain'),
  ApartmentCorridor: T('apartment', ['bin', 'plant'], apartment, largeRoom, 'metal', 'home'),
  CorridorEntertainment: T('entertainment', ['vending', 'bin'], karaoke, arcadeHall, 'metal', 'plain'),
  GenericCorridor: T('generic', ['bench', 'plant', 'bin'], genericRoom, lobby, 'handrailWood', 'plain'),
  // 部屋のテーマ
  LargeRoom: T('office', ['plant', 'bin'], largeRoom, largeRoom, 'metal', 'plain'),
  SmallRoom: T('generic', ['plant', 'bin', 'vending'], smallRoom, largeRoom, 'handrailWood', 'plain'),
  GenericRoom: T('generic', ['plant', 'bin'], genericRoom, largeRoom, 'handrailWood', 'plain'),
  OfficeGrid: T('office', ['vending', 'waterCooler', 'plant'], office, office, 'metal', 'office'),
  Classroom: T('school', ['bin', 'lockers'], classroom, classroom, 'handrailWood', 'school'),
  Restroom: T('tiled', ['bin'], restroom, restroom, 'metal', 'plain'),
  LockerRoom: T('tiled', ['bench', 'bin'], lockerRoom, lockerRoom, 'metal', 'school'),
  RetailRoom: T('mall', ['plant', 'bench', 'bin'], retail, retail, 'metal', 'plain'),
  RetailGrid: T('mall', ['plant', 'bin'], supermarket, supermarket, 'metal', 'plain'),
  Theater: T('entertainment', ['bin'], theater, theater, 'handrailWood', 'hotel'),
  Gallery: T('gallery', ['bench', 'plant'], gallery, gallery, 'handrailWood', 'plain'),
  PlayArea: T('generic', ['bench', 'bin'], playArea, playArea, 'handrailWood', 'school'),
  ParkingGrid: T('service', ['bin'], parking, parking, 'metal', 'service'),
  WarehouseGrid: T('service', ['rollCage', 'bin'], warehouse, warehouse, 'metal', 'service'),
  ShelfGrid: T('gallery', ['bench', 'plant'], library, library, 'handrailWood', 'plain'),
  StorageGrid: T('service', ['rollCage', 'cabinet'], storage, storage, 'metal', 'service'),
  ServerGrid: T('service', ['cabinet', 'bin'], server, server, 'metal', 'service'),
  ServiceMaze: T('service', ['rollCage'], (c) => mazeRoom(c, true), (c) => mazeRoom(c, true), 'metal', 'service'),
  MazeGrid: T('backrooms', [], (c) => mazeRoom(c, false), (c) => mazeRoom(c, false), 'metal', 'plain'),
  AtriumLobby: T('mall', ['plant', 'bench'], lobby, lobby, 'metal', 'hotel'),
  Terminal: T('transit', ['bench', 'bin'], terminal, terminal, 'metal', 'plain'),
  PoolCorridor: T('pool', [], pool, pool, 'metal', 'plain'),
  // palettes.ts にある残りのテーマ（v1 の特殊な生成器のテンプレート。v2 のフロアの系統にはまだ無い）
  OrganicZone: T('gallery', ['plant'], organic, organic, 'metal', 'plain'),
  Bridge: T('service', [], serviceRoom, warehouse, 'metal', 'service'),
  VerticalCore: T('service', ['bin'], serviceRoom, warehouse, 'metal', 'service'),
  DynamicGrid: T('office', ['plant', 'bin'], office, office, 'metal', 'office'),
};

/** 植栽の空間（v1 OrganicZone: 植物の島 + 大きい部屋は植物の間仕切り）。植物の葉は通り抜けられる */
function organic(c: DressCtx): void {
  patternIslands(c, 1 / 18, ['plant'], 'plant', (B, x, z, sx, sz) => planter(B, c.rng, x - Math.min(sx, 0.9), z - Math.min(sz, 0.9), x + Math.min(sx, 0.9), z + Math.min(sz, 0.9), 0.45, 'columnConcrete'), { gap: 1.0 });
  if (c.area > 150) patternPartitions(c, 2, 1.6, 'plant');
  cornerPlants(c, 4, 0.7, 1.8, 'columnConcrete');
}

/** 表に無いテーマの作り方（汎用） */
export const FALLBACK_KIT: ThemeKit = THEME_KITS['GenericRoom']!;

/** 覆っているテーマの名前 */
export const DRESS_THEMES: readonly string[] = Object.keys(THEME_KITS);
/** 覆っている区画の種類 */
export const DRESS_KINDS: readonly DressKind[] = ['room', 'hall', 'corridor', 'junction', 'stairs', 'exit', 'secret'];

/** テーマと種類から中身の作り方（ctx を受け取る関数）を選ぶ */
export function dressFn(theme: string, kind: DressKind): RoomFn {
  const t = THEME_KITS[theme] ?? FALLBACK_KIT;
  switch (kind) {
    case 'room': return t.room;
    case 'hall': return t.hall;
    case 'corridor': {
      if (t.corridor === 'pool') return poolCorridor;
      const st = CORRIDOR_STYLES[t.corridor] ?? CORRIDOR_STYLES['generic']!;
      return (c) => dressCorridor(c, st);
    }
    case 'junction': {
      if (t.corridor === 'pool') return poolCorridor;
      const st = CORRIDOR_STYLES[t.corridor] ?? CORRIDOR_STYLES['generic']!;
      return (c) => dressJunction(c, st, t.junction);
    }
    case 'stairs': return (c) => dressStairs(c, t.rail);
    case 'exit': return (c) => dressExit(c, t.rail);
    case 'secret': return (c) => secretRoom(c, t.secret);
  }
}

const KITS = new Map<string, DressKit>();

/** テーマと種類の DressKit（同じ組は同じ関数を返す） */
export function kitFor(theme: string, kind: DressKind): DressKit {
  const key = `${THEME_KITS[theme] ? theme : '?'}|${kind}`;
  let k = KITS.get(key);
  if (!k) KITS.set(key, (k = kit(dressFn(theme, kind))));
  return k;
}

/** 区画の中身を置く（フロアの生成が区画ごとに呼ぶ） */
export function dressCell(r: DressRoom): void {
  kitFor(r.cell.theme ?? '', r.kind)(r);
}
