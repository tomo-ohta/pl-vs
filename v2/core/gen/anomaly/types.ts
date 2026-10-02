/**
 * 部屋まるごとの異変（docs/game-design.md 3 章）の型。
 *
 * 扉を開けた瞬間に「部屋全体がおかしい」と分かる変化（浸水・巨大な家具・増殖・逆さま・暗闇 …）。
 * フロアの生成（core/gen/floor/index.ts）が、仕掛けと隠しを置いたあとに planAnomalies で部屋を選び、2 段で掛ける:
 *   pre  … 区画の中身（家具）を置く前。照明・パレット・テーマ・ゾーン・部品を変える。部屋を自分で埋めるなら skipDress()
 *   post … 区画の中身を置いた後。ctx.furniture（中身が足した箱）を変形する（大きさ・位置・向き・積み上げ）
 * どちらの後でも、区画の開口どうしが歩いてつながっていること（だめなら取り消す。runner が確かめる）。
 * pre / post が false を返したら「この部屋には掛けられない」として取り消す（部屋は普通の部屋に戻る）。
 * 部屋 ID の直書きは禁止。数値は調整表（anomaly.*）。
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import type { Rng } from '../../math/rng.ts';
import type { Rect } from '../../world/footprint.ts';
import type { Box, CellLayout, EntitySpec, WallOpening, Zone } from '../../world/layout.ts';
import type { DressKind } from '../dress/types.ts';
import type { GeoCell } from '../floor/geometry.ts';
import type { Rarity } from '../floor/profile.ts';

export interface AnomalyFloor { id: string; seed: number; depth: number; rarity: Rarity; family: string }

export interface AnomalyContext {
  readonly geo: GeoCell;
  readonly cell: CellLayout;
  readonly rng: Rng;
  readonly tuning: Tuning;
  readonly floor: AnomalyFloor;
  /** この異変の id（部品の id の頭に付ける）: `a:${def.id}:${cell.id}` */
  readonly id: string;
  /** プレイヤーが入ってくる開口（本道なら前の区画の側。脇道なら扉のある開口）。向き（こちらを向く物）に使う */
  readonly entrance: WallOpening;
  /** 本道（入口 → 出口）の上か */
  readonly main: boolean;
  /** 壁の内側の矩形（足跡の矩形ごと。フロア座標） */
  readonly rects: Rect[];
  /** post のときだけ: 区画の中身（家具）が足した箱。書き換えてよい（cell.boxes の中の同じ物） */
  readonly furniture: Box[];
  /** pre と post で受け渡す値（pre で決めた水深を post で使う など） */
  readonly memo: Record<string, unknown>;
  /** 箱を区画に足す（フロア座標） */
  addBox(b: Box): Box;
  /** 区画の箱を取り除く（家具の箱なら furniture からも外す） */
  removeBoxes(pred: (b: Box) => boolean): void;
  /** 部品を足す。id は `${ctx.id}.${name}`。戻り値は id */
  addEntity(name: string, e: Omit<EntitySpec, 'id' | 'cell'> & { cell?: string }): string;
  addZone(z: Zone): void;
  /** pre のときだけ: 区画の中身を置かない（この異変が部屋を自分で埋める） */
  skipDress(): void;
  /** pre のときだけ: 区画の中身の家具を置かない範囲（フロア座標） */
  keepOut(a: AABB): void;
  /**
   * 今の箱で、区画の開口どうしが歩いてつながるか（この段の前より悪くなっていないか）。
   * 立ったまま通れること（底が 1.8 m より低い宙の箱は、床まである壁として見る）も確かめる。少しずつ置く異変が途中で確かめる
   */
  reachOk(): boolean;
}

export interface AnomalyDef {
  id: string;
  /** 図鑑・案内に出す名前 */
  name: string;
  /** 出やすさ（相対。調整表 anomaly.w.<id> があればそちらが優先） */
  weight: number;
  /** 強さ 0..3（緩急。仕掛けと同じ目盛り） */
  intensity: 0 | 1 | 2 | 3;
  /** 置ける区画の種類 */
  kinds: DressKind[];
  /** 主の矩形の最小の寸法（幅・奥行きの小さい方 / 大きい方） */
  minSize?: [number, number];
  minHeight?: number;
  /** 床面積の上限（m²。物で埋める異変の箱・剛体の数を抑える） */
  maxArea?: number;
  /** これより珍しいフロアにだけ出る */
  minRarity?: Rarity;
  /** 物理を使う（フロアの上限 gimmick.physicsMax を仕掛けと分け合う） */
  physics?: boolean;
  /** 区画の中身（家具）が無いと成り立たない（post で家具が無ければ取り消す） */
  needsFurniture?: boolean;
  /**
   * 表のフロアだけ（裏のフロアの調子 floor/bside.ts が霧・照明の色を区画ごとに上書きするので、裏では効かない異変）
   */
  frontOnly?: boolean;
  /** 置けるか（区画とフロアの性質で。大きさ・高さ・珍しさは上の項目で見る） */
  fits?(geo: GeoCell, floor: AnomalyFloor): boolean;
  pre?(ctx: AnomalyContext): void | boolean;
  post?(ctx: AnomalyContext): void | boolean;
}

const REGISTRY = new Map<string, AnomalyDef>();

export function defineAnomaly(def: AnomalyDef): AnomalyDef {
  if (REGISTRY.has(def.id)) throw new Error(`異変の id が重複しています: ${def.id}`);
  REGISTRY.set(def.id, def);
  return def;
}

export function anomalyDefs(): AnomalyDef[] {
  return [...REGISTRY.values()];
}

export function anomalyDef(id: string): AnomalyDef | undefined {
  return REGISTRY.get(id);
}
