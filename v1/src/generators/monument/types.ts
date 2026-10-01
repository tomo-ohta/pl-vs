/**
 * 謎の物体（モニュメント）の仕様。レイアウト側は部品列（プリミティブ + 位置・回転・寸法・材質）だけを持ち、
 * 描画側（src/render/MonumentGeometry.ts）が three.js のプリミティブで形を組み立てて材質ごとに結合する。
 * 当たり判定は `colliders`（軸に揃った箱。基壇と主要部品の外接箱だけ）。浮いた部品の下は通れる。
 * 座標はモニュメント・ローカル（基壇中心 = 原点、y 上、正面 = −Z）。配置時に yaw（π/2 の倍数）と pos で部屋座標へ写す。
 */
import type { Vec3 } from '../../core/types';
import type { Box, MatId } from '../layout';

export type MonumentKind = 'officeTotem' | 'stoneFrame' | 'ribbon' | 'cubeCluster' | 'colorStack' | 'steel'
  // 第17回の追加（extra.ts）。colossus は広い部屋の中央専用（通常の抽選には入れない）
  | 'monolith' | 'chairTower' | 'doorRing' | 'lampGrove' | 'colossus'
  // 散らかった物の山（奇妙さ生成 disorder.ts。部品の自由な回転を使うため MonumentSpec で描く。抽選・統計の対象外）
  | 'clutter';
/** 通常の抽選に使う種類（colossus を除く） */
/** モニュメントの刻印（SignSpec.id の頭。NonEuclideanVolume が組み直しで捨てる目印） */
export const MONUMENT_SIGN_PREFIX = 'monument:';

export const MONUMENT_KINDS: readonly MonumentKind[] = ['officeTotem', 'stoneFrame', 'ribbon', 'cubeCluster', 'colorStack', 'steel', 'monolith', 'chairTower', 'doorRing', 'lampGrove'];

/**
 * プリミティブと size の意味:
 *  box       [w, h, d]
 *  cylinder  [radius, height, radiusTop?]（radiusTop 省略 = radius。0 で円錐）
 *  sphere    [radius]
 *  ring      [outerRadius, tubeRadius, arc?]（トーラス。arc 省略 = 全周。無回転で XY 平面 = 既に立っている。寝かせるときは rot pitch π/2）
 *  stairs    [width, totalHeight, depth]（段高 ≈ 0.18 m で段数を決め、−Z から +Z へ上がる）
 *  frame     [w, h, bar]（口の字の枢。bar = 桟の太さ = 奥行き。XY 平面に立つ）
 *  ribbon    [width, thickness]（`path` の曲線に沿って矩形断面を押し出した帯）
 *  tube      [radius]（`path` の曲線に沿う円管）
 *  plate     [w, h, thickness]（薄板。XY 平面に立つ。文字は signs 側）
 *  knot      [radius, tube, p × 10 + q]（トーラスノット。p・q 省略 = 2, 3。無回転で XY 平面に広がる）
 *  rock      [w, h, d]（不規則な塊: 歪ませた正二十面体。形は位置から決まる）
 *  lathe     [0, 0, 0]（y 軸の回転体。path の [半径, 高さ, _] を下 → 上に）
 *  appliance [w, h, d]（コード生成の家電 1 台。pos は底面の中心。形は appliance。乱れ（disorder.ts）が自販機・ゲーム機などを倒すとき）
 */
export type MonumentPrim = 'box' | 'cylinder' | 'sphere' | 'ring' | 'stairs' | 'frame' | 'ribbon' | 'tube' | 'plate' | 'knot' | 'rock' | 'lathe' | 'appliance';

export interface MonumentPart {
  prim: MonumentPrim;
  mat: MatId;
  /** 中心（ローカル）。stairs は基部中央、cylinder / box は幾何中心 */
  pos: Vec3;
  /** 回転 [pitch(X), yaw(Y), roll(Z)] rad。省略 = 無回転 */
  rot?: Vec3;
  size: Vec3;
  /** ribbon / tube の制御点（ローカル。CatmullRom で滑らかに通る） */
  path?: Vec3[];
  /** prim 'appliance' の形（src/render/props/ApplianceGeometry.ts。mat = 本体の材質） */
  appliance?: { shape: 'vending' | 'washer' | 'dryer' | 'crtPc' | 'arcade' | 'exhibit'; accent?: MatId; screen?: number; variant?: string };
}

/** 刻印板の文字（SignAtlas の plate）。pos はローカル、dir は文字面が向く方向のローカル Dir（0 = −Z 正面 … 配置時に回す） */
export interface MonumentSign {
  text: string;
  sub?: string;
  pos: Vec3;
  /** 0: 正面（−Z 向き）, 1: +X, 2: +Z, 3: −X */
  face: 0 | 1 | 2 | 3;
  width: number;
  color?: number;
  background?: number;
}

export interface MonumentBuild {
  parts: MonumentPart[];
  /** 当たり判定（ローカル。省略時は基壇のみ = 呼び出し側が作る） */
  colliders?: Box[];
  signs?: MonumentSign[];
}

export interface MonumentOptions {
  /** 全体の目標高さ（m。天井 −0.3 か屋外 8〜15） */
  height: number;
  /** 足跡の許容半径（m） */
  radius: number;
  /** 屋外（街路・中庭・広場）か */
  outdoor: boolean;
  /** 歪みの度合い 0〜1（傾き・食い込み・寸法のずれ） */
  distort: number;
}

/** 配置済みのモニュメント（部屋レイアウトに入る） */
export interface MonumentSpec {
  id: string;
  kind: MonumentKind;
  /** 基壇中心の部屋座標（床の高さ） */
  pos: Vec3;
  /** π/2 の倍数（0〜3 × π/2） */
  yaw: number;
  parts: MonumentPart[];
}
