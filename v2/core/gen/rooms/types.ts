/**
 * 部屋の形（gimmicks-and-structures.md 2.2 S01〜S30）の型と登録。
 *
 * 部屋の形 = 扉の向こうの部屋の「作り」そのもの（柱の林・段々の床・低すぎる天井・円形の壁 …）。
 * 仕掛け（挑戦）・異変（驚き）とは別の層で、主な役目は「普通の部屋」（docs/game-design.md 2 章のくじで約 35%）の見た目の幅を
 * 大きくすること。扉を開けた瞬間に「こういう部屋か」と分かる形にする。
 *
 * フロアの生成（core/gen/floor/index.ts）が、仕掛けと異変（pre）を決めた後・区画の中身（家具）を置く前に、shapeRooms（index.ts）で
 * 部屋を選んで形を掛ける。仕掛けの部屋（仕掛けが部屋の形を作る）には掛けない。異変の部屋には、その異変と重ねてよい形（anomalies）だけ。
 * 掛けた後に、区画の開口どうしが歩いてつながること・開口の前が平らな床のまま空いていることを確かめ、だめなら取り消す（部屋は元に戻る）。
 * 数値は調整表（core/config/tuning/rooms.ts の rooms.*）。部屋 ID の直書きは禁止。
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import type { Rng } from '../../math/rng.ts';
import type { Rect } from '../../world/footprint.ts';
import type { Box, CellLayout, EntitySpec, LightSpec, WallOpening, Zone } from '../../world/layout.ts';
import type { DressKind } from '../dress/types.ts';
import type { FloorGeometry, GeoCell } from '../floor/geometry.ts';
import type { Rarity } from '../floor/profile.ts';

export interface RoomFloor { id: string; seed: number; depth: number; rarity: Rarity; family: string; variant: number }

export interface RoomShapeContext {
  readonly geo: GeoCell;
  readonly cell: CellLayout;
  /** フロアの形（区画・開口・部品）。区画を足す形（劇場の楽屋）だけが使う */
  readonly world: FloorGeometry;
  readonly rng: Rng;
  readonly tuning: Tuning;
  readonly floor: RoomFloor;
  /** この形の id（部品の id の頭）: `s:${def.id}:${cell.id}` */
  readonly id: string;
  /** プレイヤーが入ってくる開口（本道なら前の区画の側。そうでなければ扉のある開口） */
  readonly entrance: WallOpening;
  /** 出ていく開口（本道なら次の区画の側。そうでなければ入口から遠い開口。開口が 1 つなら null） */
  readonly exit: WallOpening | null;
  readonly main: boolean;
  /** この部屋に掛かる異変（post だけの異変。無ければ null） */
  readonly anomaly: string | null;
  /** 主の矩形（足跡の最大の矩形）と、その壁の内側 */
  readonly rect: Rect;
  readonly inner: Rect;
  /** 床の高さ・天井の高さ（形を掛ける前） */
  readonly fy: number;
  readonly h: number;
  addBox(b: Box): Box;
  /** 区画の箱を取り除く */
  removeBoxes(pred: (b: Box) => boolean): void;
  /** 部品を足す。id は `${ctx.id}.${name}` */
  addEntity(name: string, e: Omit<EntitySpec, 'id' | 'cell'> & { cell?: string }): string;
  addZone(z: Zone): void;
  addLight(l: LightSpec): void;
  /** 区画の中身の家具を置かない範囲（フロア座標） */
  keepOut(a: AABB): void;
  /** 区画の中身を置かない（この形が部屋を自分で埋める） */
  skipDress(): void;
  /**
   * 区画の外形を上下に広げる（床を下げる・天井を上げる・屋根裏）。範囲 r（既定は主の矩形）の y0..y1 に、ほかの区画が無ければ
   * cell.bounds を広げて true。あれば false（その形は掛けない）
   */
  claim(y0: number, y1: number, r?: Rect): boolean;
  /** 今の箱で、区画の開口どうしが歩いてつながるか（形を掛ける前より悪くなっていないか） */
  reachOk(): boolean;
}

export interface RoomShapeDef {
  id: string;
  /** 案の番号（S01 …） */
  idea: string;
  /** 図鑑・案内に出す名前 */
  name: string;
  /** 置ける区画の種類 */
  kinds: DressKind[];
  /** 主の矩形の最小の寸法（幅・奥行きの小さい方 / 大きい方） */
  minSize?: [number, number];
  /** 主の矩形の最大の寸法（小さい方 / 大きい方） */
  maxSize?: [number, number];
  /** 天井の高さの下限・上限（形を掛ける前） */
  minHeight?: number;
  maxHeight?: number;
  /** これより珍しいフロアにだけ出る */
  minRarity?: Rarity;
  /** 出やすさ（相対。調整表 rooms.w.<id> があればそちら） */
  weight: number;
  /**
   * 重ねてよい異変（post だけの異変の id）。無ければ異変の部屋には掛けない。
   * 区画の中身を自分で置く形（skipDress）は、家具の要らない異変（暗闇・霧・色）だけにする
   */
  anomalies?: readonly string[];
  /** 表のフロアだけ（裏のフロアは霧と照明の色を区画ごとに上書きするので、霧で見せる形は効かない） */
  frontOnly?: boolean;
  /** 水を使う（屋内プールのフロアは水を床に沈めた浅い水槽に入れる決まりなので掛けない） */
  water?: boolean;
  /** 追加の条件 */
  fits?(g: GeoCell, floor: RoomFloor): boolean;
  /** 形を掛ける。false なら掛けられない（取り消す） */
  build(ctx: RoomShapeContext): boolean | void;
}

const REGISTRY = new Map<string, RoomShapeDef>();

export function defineRoomShape(def: RoomShapeDef): RoomShapeDef {
  if (REGISTRY.has(def.id)) throw new Error(`部屋の形の id が重複しています: ${def.id}`);
  REGISTRY.set(def.id, def);
  return def;
}

export function roomShapeDefs(): RoomShapeDef[] {
  return [...REGISTRY.values()];
}

export function roomShapeDef(id: string): RoomShapeDef | undefined {
  return REGISTRY.get(id);
}

/** 案の番号から形を引く（?try=S08 のように番号でも見本に置けるように） */
export function roomShapeByIdea(idea: string): RoomShapeDef | undefined {
  return [...REGISTRY.values()].find((d) => d.idea === idea);
}
