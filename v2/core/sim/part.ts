/**
 * 仕掛けの部品（v2-plan.md 4・gimmicks-and-structures.md 4.5）。
 *
 * 部品は「感じる部品（Sensor）・判断の部品（Logic）・起きること（Actuator）」をすべて同じ形で表す。
 * - 出力（outputs）は数値（0/1 の真偽か、0..1 などの量）。入力（inputs）は別の部品の出力に配線する（EntitySpec.inputs）
 * - 状態（state）は JSON にできる値だけ（保存・同期にそのまま使う）。物理の剛体は番号（handle）で持つ
 * - 演出（音・光り方）は ctx.cue でイベントを出すだけ。見た目はクライアントの view が state を読んで作る
 *
 * 部品を足すときは parts/ にファイルを置き、definePart で登録する（parts/index.ts から import）。
 */
import type { AABB } from '../math/aabb.ts';
import type { Rng } from '../math/rng.ts';
import type { Vec3 } from '../math/vec.ts';
import type { EntitySpec, FloorLayout, Json, SupportSurface, Zone } from '../world/layout.ts';
import type { Tuning } from '../config/tuning.ts';
import type { PhysicsWorld } from '../physics/world.ts';
import type { PlayerState, SimEvent } from './types.ts';
import type { ColliderIndex } from './collision.ts';

/** 部品の状態（JSON にできる値の入れ物） */
export type PartState = { [k: string]: Json | undefined };

export interface PartContext {
  readonly tick: number;
  readonly dt: number;
  /** シミュレーション開始からの秒数 */
  readonly time: number;
  readonly id: string;
  readonly spec: EntitySpec;
  readonly floor: FloorLayout;
  readonly tuning: Tuning;
  readonly players: readonly PlayerState[];
  /** 物理（剛体を使う部品のあるフロアだけ。無ければ null） */
  readonly physics: PhysicsWorld | null;
  /** 入力の値（配線が無ければ fallback） */
  input(name: string, fallback?: number): number;
  /** 入力が配線されているか */
  wired(name: string): boolean;
  output(name: string, value: number): void;
  /** この tick に、この部品を調べた（E キー / タップ）プレイヤー */
  interactedBy(): PlayerState | null;
  /** 動く当たり判定を置く・外す（key は部品の中で一意） */
  setCollider(key: string, aabb: AABB | null): void;
  /** 動くゾーンを置く・外す */
  setZone(key: string, zone: Zone | null): void;
  /** 動く面（傾く床・動く坂）を置く・外す */
  setSurface(key: string, surface: SupportSurface | null): void;
  /** 調べられる範囲を置く・外す（E キーの視線で当てる箱と、届く距離） */
  setInteractable(aabb: AABB | null, range?: number): void;
  /** 出現型の隠しの組を現す（Box.revealGroup。描画と当たり判定に入る） */
  reveal(group: string): void;
  revealed(group: string): boolean;
  /** 演出のイベント（音・光の Cue）。data は JSON の値 */
  cue(name: string, pos?: Vec3, data?: SimEvent['data']): void;
  /** この部品のこの tick の乱数（決定論。呼ぶたびに違う値） */
  random(): number;
  /** 部品ごとの乱数列（init でだけ使う。生成の決定論のため） */
  rng(): Rng;
  /** 別の部品の状態（読むだけ） */
  stateOf(id: string): Readonly<PartState> | null;
  /** プレイヤーを戻す（落下・危険）。位置を省略するとチェックポイント */
  respawn(player: PlayerState, at?: { pos: Vec3; yaw: number }): void;
  /**
   * プレイヤーを pos へ移す（向き yaw。省略は今の向き）。seamless（既定 true）なら速度を保ち、クライアントは継ぎ目なく見せる。
   * 同じ形の場所どうしで移すこと（くり返す廊下・離れた部屋へつながる扉）
   */
  warp(player: PlayerState, pos: Vec3, yaw?: number, seamless?: boolean): void;
  /** チェックポイントを変える */
  setRespawn(player: PlayerState, at: { pos: Vec3; yaw: number }): void;
  /** 段階 4（carry）: 当たり判定（静的な箱と、部品が置いた動く箱。読むだけ）。置く物の支え・投げた物の当たりに使う */
  readonly colliders: ColliderIndex;
}

export interface PartDef<S extends PartState = PartState> {
  type: string;
  /** 出力の名前（初期値 0） */
  outputs?: readonly string[];
  /** 入力の名前（説明と検査用） */
  inputs?: readonly string[];
  /** Rapier を使うか（使う部品があるフロアだけ物理を読み込む） */
  physics?: boolean;
  /** 状態を作る（当たり判定・剛体の登録もここで） */
  init(ctx: PartContext): S;
  /** 毎 tick。プレイヤーの移動の前に呼ぶ（感じる部品は前の tick のプレイヤーを見る） */
  step?(s: S, ctx: PartContext): void;
  /** 物理を進めた後に呼ぶ（剛体の位置を状態に写す） */
  post?(s: S, ctx: PartContext): void;
}

const REGISTRY = new Map<string, PartDef>();

export function definePart<S extends PartState>(def: PartDef<S>): PartDef<S> {
  if (REGISTRY.has(def.type)) throw new Error(`部品の種類が重複しています: ${def.type}`);
  REGISTRY.set(def.type, def as unknown as PartDef);
  return def;
}

export function partDef(type: string): PartDef | undefined {
  return REGISTRY.get(type);
}

export function partTypes(): string[] {
  return [...REGISTRY.keys()].sort();
}

// ---------------------------------------------------------------- params の読み取り（部品の実装を短くする）
export function pNum(spec: EntitySpec, key: string, fallback: number): number {
  const v = spec.params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function pBool(spec: EntitySpec, key: string, fallback: boolean): boolean {
  const v = spec.params[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function pStr(spec: EntitySpec, key: string, fallback: string): string {
  const v = spec.params[key];
  return typeof v === 'string' ? v : fallback;
}

export function pVec(spec: EntitySpec, key: string, fallback?: Vec3): Vec3 {
  const v = spec.params[key];
  if (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number')) return [v[0] as number, v[1] as number, v[2] as number];
  if (fallback) return [...fallback];
  throw new Error(`${spec.id}: params.${key} に [x, y, z] が要ります`);
}

/** params の AABB（{ min: [..], max: [..] }） */
export function pAabb(spec: EntitySpec, key: string): AABB {
  const v = spec.params[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as { [k: string]: Json };
    const min = o.min, max = o.max;
    if (Array.isArray(min) && Array.isArray(max) && min.length === 3 && max.length === 3) {
      return { min: [min[0] as number, min[1] as number, min[2] as number], max: [max[0] as number, max[1] as number, max[2] as number] };
    }
  }
  throw new Error(`${spec.id}: params.${key} に { min, max } が要ります`);
}

export function aabbJson(a: AABB): Json {
  return { min: [...a.min], max: [...a.max] };
}

/** プレイヤーの足元が AABB の中か */
export function playerIn(p: PlayerState, a: AABB, margin = 0): boolean {
  const x = p.pos[0], y = p.pos[1] + 0.1, z = p.pos[2];
  return x >= a.min[0] - margin && x <= a.max[0] + margin && y >= a.min[1] - margin && y <= a.max[1] + margin && z >= a.min[2] - margin && z <= a.max[2] + margin;
}
