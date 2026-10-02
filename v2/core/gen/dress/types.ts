/**
 * 部屋の中身（家具・設備・照明以外の造作）を置く仕組みの窓口。
 * フロアの生成（core/gen/floor）が区画（部屋・廊下・広間）を作ったあと、区画ごとに dressCell を呼ぶ。
 *
 * - 置く物はすべて cell.boxes に足す（座標はフロア座標。高さは cell.floorY からの値に floorY を足して入れる）
 * - 開口（openings）の前と keepOut の範囲には置かない（通り道を塞がない）。置いた後に reachOpenings で全部の開口が
 *   歩いてつながっていること（v1 と同じ取り消しの考え方: だめなら置いた物を外す）
 * - 部屋 ID の直書きは禁止。違いは theme（施設のテーマ。v1 のテンプレート名と同じ語）と kind・大きさ・乱数で出す
 */
import type { AABB } from '../../math/aabb.ts';
import type { Rng } from '../../math/rng.ts';
import type { CellLayout, WallOpening } from '../../world/layout.ts';

/** 区画の種類（生成器が決める） */
export type DressKind = 'room' | 'hall' | 'corridor' | 'junction' | 'stairs' | 'exit' | 'secret';

export interface DressRoom {
  /** 箱を足す先。footprint・floorY・height・palette・theme を読む */
  cell: CellLayout;
  kind: DressKind;
  /** この区画の壁の開口（扉・廊下とのつなぎ目）。前を空ける */
  openings: WallOpening[];
  /** そのほかの空けておく範囲（仕掛けの場所・通り道。フロア座標） */
  keepOut: AABB[];
  rng: Rng;
  /** 物の多さ 0..1（0.5 が標準。廃墟・空き室は小さく） */
  density: number;
}

/** テーマごとの中身の作り方 */
export type DressKit = (r: DressRoom) => void;
