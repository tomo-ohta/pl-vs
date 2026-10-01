/**
 * Modifier 実装の共通インタフェース（設計表 06 シート「Modifier」の実装単位）。
 * 1 Modifier = src/modifiers/mods/<Id>.ts（default export で ModifierImpl）。レジストリは index.ts。
 *
 * フックはすべて任意。呼ばれる順番と場所:
 *   layout        generateLayout 直後の決定論 post-pass（generators/index.ts）。RoomLayout を書き換える唯一の場所。
 *                 乱数は渡された rng（p.rng.fork(`mod:${id}`)）だけを使い、ジオメトリを変える処理はここで完結させる。
 *   onNodeCreated WorldManager がノードを作った直後（localFlags / modifierState の初期化。接続前）。
 *   onConnect     Portal の接続先を抽選する直前。ConnectDirective で抽選に指示を出す（WorldManager.connectHooks）。
 *   build         RoomBuilder.build の末尾。BuiltRoom.effects に RoomEffect を追加する（ジオメトリの追加は可、layout の変更は不可）。
 *   onEnter/onExit Game.enterRoom（現在部屋が変わったとき）。
 *   update        毎フレーム。現在部屋 + 可視部屋（RoomStreamingManager.built）に対して呼ばれる。uniform・位置・可視性のみ動かす。
 *   canOpen       扉をインタラクトした / ヒント表示のとき。{ ok:false, hint } で施錠扱い。
 */
import type * as THREE from 'three';
import type { Rng } from '../core/rng';
import type { ModifierRef, Portal, QualityTier, RoomDefinition, RoomInstance, Socket, Vec3 } from '../core/types';
import type { GenParams, RoomLayout } from '../generators/layout';
import type { BuiltRoom, RoomEffect } from '../render/RoomBuilder';
import type { MaterialLibrary } from '../render/MaterialLibrary';
import type { WorldManager } from '../world/WorldManager';
import type { AudioEngine } from '../audio/AudioEngine';
import type { PlayerProxy } from '../player/PlayerProxy';
import type { PlayerRide } from '../player/PlayerRide';
import type { SnapshotService } from '../render/SnapshotService';
export type AudioEngineLike = AudioEngine;

/** 地図の表示状態（MapRotation / MapErase が書き、Game が Minimap / MapPanel に渡す。Game が 1 つ所有し参照を共有する） */
export interface MapViewState {
  /** ラジアン。画面上で時計回り正 */
  rotation: number;
  /** 描かない部屋（mapCell.hidden = true でも同じ効果） */
  hiddenRoomIds?: Set<string>;
}

/** Game が Modifier に貸し出すサービス（RuntimeContext.game）。Phase 2 の Modifier はここから取る */
export interface GameServices {
  proxy: PlayerProxy;
  snapshots: SnapshotService;
  ride: PlayerRide;
  materials: MaterialLibrary;
  renderer: THREE.WebGLRenderer;
  mapView: MapViewState;
  readonly currentRoomId: string | null;
  readonly inputMode: 'pc' | 'mobile';
  /** 乗車（VehicleRide）を開始する。到着で world.resolveRide の platform へ遷移する。乗車中は false */
  startRide(node: RoomInstance, portal: Portal, opts?: { path?: Vec3[]; durationSec?: number; allowSkipAfterSec?: number; shake?: number }): boolean;
  /** 部屋の接続先を確定して構築する（開いた扉の向こう = ensurePrepared 相当。WaterWall の常時開の先など。state 'playing' のときだけ） */
  prepare(roomId: string): void;
  /** フェード付きの座標遷移（state 'playing' のときだけ実行される） */
  transition(fn: () => void): void;
  /** spawn へテレポートして roomId に入室する（transition の中で呼ぶ） */
  enterRoomAt(roomId: string, spawn: Vec3, yaw: number): void;
}

export type ModifierParams = Record<string, unknown>;

/** 実行時コンテキスト（onEnter / onExit / update / canOpen） */
export interface RuntimeContext {
  world: WorldManager;
  node: RoomInstance;
  /** 未構築なら null（onExit 直後など） */
  built: BuiltRoom | null;
  layout: RoomLayout;
  player: { pos: Vec3; yaw: number; crouching: boolean };
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  tier: QualityTier;
  audio?: AudioEngineLike;
  hud: {
    hint(text: string): void;
    /** HUD のヒント欄が扉・エレベーターの操作案内（施錠ヒント含む）に使われているか（TemperatureField などが遠慮する） */
    busy?(): boolean;
  };
  /** 秒（performance.now() / 1000） */
  now: number;
  /** canOpen がユーザー操作（E / タップ）から呼ばれたとき true。ヒント表示（毎フレーム）の呼び出しでは undefined */
  interacting?: boolean;
  /** 部屋の定義（Adapter は null） */
  def?: RoomDefinition | null;
  /** Game が貸し出すサービス（proxy / snapshots / ride / mapView / startRide / transition） */
  game?: GameServices;
}

/** RoomBuilder.build 末尾のコンテキスト */
export interface BuildContext {
  node: RoomInstance;
  def: RoomDefinition | null;
  params: ModifierParams;
  tier: QualityTier;
  materials: MaterialLibrary;
  /** 構築用の決定論乱数（node.seed から fork） */
  rng: Rng;
}

/** 接続抽選の直前に渡されるコンテキスト（WorldManager.connectHooks） */
export interface ConnectContext {
  world: WorldManager;
  node: RoomInstance;
  def: RoomDefinition;
  params: ModifierParams;
  portal: Portal;
  socket: Socket;
  /** 接続先の depth */
  depth: number;
  rng: Rng;
}

/** 接続抽選への指示。複数 Modifier の指示は WorldManager が後勝ちで合成する */
export interface ConnectDirective {
  /** 定義 ID を固定する（RepeatDestination / FarLink など） */
  forceDefinitionId?: string;
  /** 優先したい Generator / 定義 ID / テンプレート ID の候補 */
  prefer?: string[];
  /** Seam 接続にする（意図的な用途のみ） */
  seam?: boolean;
  /** 施錠する */
  lock?: boolean;
  /** 小さい定義だけを候補にする */
  smallOnly?: boolean;
  /** 遠距離接続（Portal.far） */
  far?: boolean;
  /** 接続先ノードの役割（RoomInstance.role） */
  role?: string;
  /** 一方通行 */
  oneWay?: boolean;
  /** この Portal は接続しない（壁に戻す）。WorldManager 側では施錠として扱う */
  skip?: boolean;
  /** 既存部屋への一方通行 Seam（FarLink / LoopTopology）。portal.far = seam = true */
  targetExisting?: string;
  /** RepeatDestination: 何回目の反復か */
  repeat?: number;
  /** 部屋型（Room-like）の Generator だけを候補にする */
  roomLikeOnly?: boolean;
}

export interface CanOpenResult {
  ok: boolean;
  /** 開かないときの HUD ヒント。省略時は「この扉は開かなそうだ」 */
  hint?: string;
}

export interface ModifierImpl {
  /** 設計表の Modifier ID（ファイル名と一致） */
  id: string;
  /** params の既定値（def.modifiers[].params で上書き） */
  defaults?: ModifierParams;
  layout?(L: RoomLayout, p: GenParams, params: ModifierParams, rng: Rng): void;
  onNodeCreated?(node: RoomInstance, def: RoomDefinition, params: ModifierParams, world: WorldManager): void;
  onConnect?(ctx: ConnectContext): ConnectDirective | void;
  build?(built: BuiltRoom, L: RoomLayout, ctx: BuildContext): void;
  onEnter?(ctx: RuntimeContext, params: ModifierParams): void;
  onExit?(ctx: RuntimeContext, params: ModifierParams): void;
  update?(dt: number, ctx: RuntimeContext, params: ModifierParams): void;
  canOpen?(portal: Portal, ctx: RuntimeContext, params: ModifierParams): CanOpenResult | void;
}

export type { ModifierRef, RoomEffect };
