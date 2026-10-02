/**
 * 仕掛けの定義（gimmicks-and-structures.md 4.5・v2-plan.md 4 章）。
 *
 * 仕掛け = 区画（slot）に箱と部品（EntitySpec）を足す処理。部品の配線で動きを作る（core/sim/parts）。
 * - 置ける区画の種類・大きさ・作用の軸（同じ部屋に同じ軸を重ねない）・重み・強さを持つ
 * - 隠し発見の元（SecretHook）を差し出せる。フロアの隠しの数と照らして、隠しの仕組み（core/gen/secrets）が選ぶ
 * - 閉じ込めない: 仕掛けの最悪の状態（床が崩れた・扉が閉じた）でも、区画の開口どうしは歩いてつながること（生成時に検査）
 * 仕掛けを足すときは gimmicks/ にファイルを置き、defineGimmick で登録して gimmicks/index.ts から import する。
 */
import type { Tuning } from '../../config/tuning.ts';
import type { AABB } from '../../math/aabb.ts';
import type { Rng } from '../../math/rng.ts';
import type { Dir, Vec3 } from '../../math/vec.ts';
import type { Rect } from '../../world/footprint.ts';
import type { Box, CellLayout, EntitySpec, PortalSpec, WallOpening, Zone } from '../../world/layout.ts';
import type { DressKind } from '../dress/types.ts';
import type { Rarity } from '../floor/profile.ts';

/** 作用の軸（gimmicks-and-structures.md 4.5）。同じ区画では軸が重ならない仕掛けを組み合わせる */
export type GimmickAxis = 'move' | 'floor' | 'light' | 'sound' | 'sight' | 'time' | 'gravity' | 'body' | 'carry' | 'puzzle';

/** 仕掛けを置く場所（区画） */
export interface GimmickSlot {
  cell: CellLayout;
  kind: DressKind;
  /** 区画の開口（扉・廊下とのつなぎ目） */
  openings: WallOpening[];
  /** 本道（入口 → 出口）の上か */
  main: boolean;
  /** プレイヤーが入ってくる開口（本道の上なら入口側。無ければ最初の開口） */
  entrance: WallOpening | null;
  /** 出ていく開口（本道の上なら出口側） */
  exit: WallOpening | null;
  /** 主の矩形（足跡の最大の矩形） */
  rect: Rect;
  /** 段階 4（carry）: 選んだ仕掛けだけの見本のフロア（?try / ?group）に置いている（行き止まりにしか置かない仕掛けを、脇の部屋にも置いて見られるように） */
  showcase?: boolean;
}

export interface GimmickContext {
  readonly slot: GimmickSlot;
  readonly rng: Rng;
  readonly tuning: Tuning;
  /** variant: 裏のフロア（1 以上）。果てしない階の区域は id が区域の id なので、裏かどうかはこれで見る */
  readonly floor: { id: string; seed: number; depth: number; rarity: Rarity; family: string; variant?: number };
  /** この仕掛けの id（部品の id の頭に付ける） */
  readonly id: string;
  /** 箱を区画に足す */
  addBox(b: Box): Box;
  /** 部品を足す。id は `${仕掛けの id}.${名前}`。戻り値は id */
  addEntity(name: string, e: Omit<EntitySpec, 'id' | 'cell'> & { cell?: string }): string;
  addZone(z: Zone): void;
  /** 中身の家具を置かない範囲 */
  keepOut(a: AABB): void;
  /** 開口の前（区画の内側へ depth m）の点 */
  frontOf(o: WallOpening, depth?: number): Vec3;
  /** 隠し発見の元を差し出す（選ばれるかどうかは隠しの仕組みが決める） */
  offerSecret(offer: SecretOffer): void;
  /** 区画の開口に付いている扉の部品（書き換えてよい）。無ければ null */
  doorAt(o: WallOpening): EntitySpec | null;
  /** 区画の箱を取り除く（照明のパネルを外すなど） */
  removeBoxes(pred: (b: Box) => boolean): void;
  /** 到達判定のときだけ床として扱う箱（部品が作る傾く床・動く床の代わり。描画・当たり判定には入らない） */
  reachAssist(b: Box): void;
  /**
   * 段階 4（carry）: 同じフロアの別の区画で、手がかり・運ぶ物を置ける所（v2-plan.md 4.7 の最後。フロア単位の生成の利点）。
   * 置く順がもう過ぎて仕掛けの無い区画・入口と出口の部屋・曲がり角だけ（後から仕掛けで作り変わらない）。近い順。
   * 無い（実験室）ときは undefined。使う側は自分の区画に置いて済ませる
   */
  clueCells?(): ClueCell[];
  /** 段階 4（carry）: 別の区画に箱を足す（手がかり）。取り消しのときは一緒に戻る */
  addToCell?(cell: string, b: Box): Box;
  /** 段階 4（carry）: 別の区画の、中身の家具を置かない範囲 */
  keepOutIn?(cell: string, a: AABB): void;
  // ---- 段階 4（warp）で足した: 仕掛けが区画を足す（継ぎ目の無い移動の別の空間）。取り消すと足した区画・開口も消える
  /** 区画を足す（kind は中身の作り方の種類。openings は区画の壁の開口） */
  addCell?(cell: CellLayout, kind: DressKind, openings: WallOpening[]): void;
  /** 区画どうしの開口を足す */
  addPortal?(p: PortalSpec): void;
  /** フロアの区画（読むだけ。別の空間の置き場所を決めるのに使う） */
  cells?(): readonly CellLayout[];
  /** 区画の中身（家具）を置かない（省略は仕掛けの区画）。双子の区画の見た目を揃えるため */
  noDress?(cellId?: string): void;
}

/** 段階 4（carry）: 手がかりを置ける区画 */
export interface ClueCell {
  cell: CellLayout;
  kind: DressKind;
  openings: WallOpening[];
  /** 仕掛けの区画から開口をいくつたどるか */
  hops: number;
}

export interface GimmickDef {
  id: string;
  /** 図鑑・調整用の名前 */
  name: string;
  axes: GimmickAxis[];
  /** 置ける区画の種類 */
  kinds: DressKind[];
  /** 主の矩形の最小の寸法（幅・奥行きの小さい方 / 大きい方） */
  minSize?: [number, number];
  minHeight?: number;
  /** 出やすさ（相対） */
  weight: number;
  /** 強さ 0..3（緩急の並べ方に使う） */
  intensity: 0 | 1 | 2 | 3;
  /** これより珍しいフロアにだけ出る */
  minRarity?: Rarity;
  /** 物理（Rapier）を使うか */
  physics?: boolean;
  /** 隠しが無いと成り立たない（謎のパズル）。フロアの隠しの数に空きがあるときだけ置き、置いたらすぐ隠しを付ける */
  requiresSecret?: boolean;
  /** 隠し発見の元を差し出す仕掛けか（隠しの数に空きがある間は選ばれやすくする） */
  offersSecret?: boolean;
  /** 本道の上に置いてよいか（崩れる床など、本道を塞ぎうる物は false。脇道・広間に置く） */
  onMainPath?: boolean;
  /** 追加の条件 */
  fits?(slot: GimmickSlot): boolean;
  build(ctx: GimmickContext): void;
}

// ---------------------------------------------------------------- 隠し発見（v2-plan.md 4 章）
export type SecretMode = 'present' | 'appear';

/**
 * 仕掛けが差し出す隠し発見の元。隠しの仕組みが選んだら attach が呼ばれ、隠し場所への入口（壁の開口・床の穴）を作る。
 * - present（存在型）: 入口は最初からある（見えにくいだけ）。reveal は不要
 * - appear（出現型）: 入口は concealGroup の箱で塞いでおき、裏の振る舞い（reveal の出力）で消す
 */
export interface SecretOffer {
  /** 隠しの元の id（調整・図鑑用） */
  hook: string;
  modes: SecretMode[];
  weight: number;
  /** 出現型のときに、隠しの入口を現す出力（`部品ID.出力名`） */
  revealOutput?: string;
  /** 隠し場所への入口の候補 */
  doorway: SecretDoorway;
  /** 目印（調整・図鑑用。すきま風・光漏れ …） */
  tell?: string;
  /** 必ず付ける（謎のパズルのように、隠しが無いと仕掛けが成り立たないもの）。予算の外で付け、置けなければ仕掛けごと取り消す */
  required?: boolean;
  /** 隠し場所の床の高さ（無ければ入口の y） */
  floorY?: number;
  /** 隠しの入口を付ける区画（省略は仕掛けの区画。warp の別の空間の区画に付けるとき。段階 4 で足した） */
  cell?: string;
  /**
   * 入口の扉は仕掛けが自分で置く（故障中の自動扉・警報の鋼鉄の扉）: その部品の id（出力 angle で開き具合を出すこと）。
   * 隠しの仕組みは入口に扉を足さず、入口の開口の扉をこの部品にする（足すと仕掛けの扉の後ろにもう 1 枚扉が並ぶ）。
   * 出現型の壁（concealGroup）はそのまま置く
   */
  ownDoor?: string;
}

/** 隠し場所への入口: 区画の壁（向き dir）の位置 at（壁に沿った座標）・高さ y に開口を開けて、壁の向こうに隠し部屋を置く */
export interface SecretDoorway { dir: Dir; at: number; y: number; width: number; height: number }

const REGISTRY = new Map<string, GimmickDef>();

export function defineGimmick(def: GimmickDef): GimmickDef {
  if (REGISTRY.has(def.id)) throw new Error(`仕掛けの id が重複しています: ${def.id}`);
  REGISTRY.set(def.id, def);
  return def;
}

export function gimmickDefs(): GimmickDef[] {
  return [...REGISTRY.values()];
}

export function gimmickDef(id: string): GimmickDef | undefined {
  return REGISTRY.get(id);
}
