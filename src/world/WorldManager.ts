/** 論理世界の生成・接続・物理配置（3.3 節）。
 *  - 入室時に全 Portal の接続先を確定し、1 hop 隣接を物理配置する
 *  - 部屋のサイズはバリアント（大→小）で空き空間に合わせる。干渉時は 小部屋再抽選 → 前室 Adapter → 施錠
 *  - stairs / ramp ソケット（部屋発）は階段 / スロープ Adapter を挿入。Adapter の先は必ず部屋
 *  - hole は真下に行き先の部屋を物理配置する（片方向。置けなければ穴を無くす）
 *  - 扉の外側に既存の部屋があれば直結し、配置後は隣接する部屋同士も直結する（ループ・密度）
 *  - elevator は籠 Adapter を別階層に置く閉扉 Seam
 *  - crawl 開口（Socket.crawl / sill > 0。E03 横倒し扉・R16 小型扉）の先には必ず 'crawl' Adapter を挟む
 *
 *  Seam の方針（v1.3 Q3 = B）:
 *  - 緊急 Seam フォールバック（座標テレポート）は廃止。進行用扉が全手段で置けないときは施錠して行き止まり
 *    （'WARN dead-end lock at <room>/<portal>' をログに残す。閉じ込めは許容）
 *  - Seam は意図的な用途にのみ使う: elevator / Legendary 巨大部屋の遠方配置 / ConnectHook の seam・targetExisting
 *    （FarLink, FakeExit, LoopTopology, MultiEdge, ObservationRewire, DynamicMapNode, VehicleRide, NonEuclideanVolume）
 *  - 側道扉（進行保証でない扉）には前室を挿入せず即施錠する（SEAM-1。3/4 は壁へ戻す prune は従来どおり）
 *  - 進行保証扉は 全候補の通常抽選（Variant 全段 + 直結） → 新設ソケット（未構築・未凍結の部屋のみ、最大 1 本）
 *    → 一段小さい定義（SmallRoom / Restroom）で再抽選 → 前室（4/6/8/3/2 m） → 施錠 の順（SEAM-2〜5）
 *
 *  統合担当向け: 呼び出し方
 *  - 接続フック: `world.connectHooks.push((ctx) => { ... return { forceDefinitionId: 'R16' } })`。
 *    ctx = { world, node, portal, def(親の RoomDefinition | null), depth(子の深度) }。connectPortal の先頭で全 hook を呼び、
 *    返された ConnectDirective を後勝ちでマージして rollRoomNode / link に反映する。
 *    - lock: 施錠して終わり / seam: 意図的 Seam（開けた時に resolveSeamTarget が forceDefinitionId 等を使って先を確定）
 *    - targetExisting: 既存部屋への一方通行 Seam（portal.seam = far = true, targetRoomId = 既存, targetPortalId = 'entry'。戻り Portal は追加しない）
 *    - forceDefinitionId / prefer / roomLikeOnly / smallOnly / role / repeat: 抽選に反映し RoomInstance.forcedDefinitionId / role / repeat に保存
 *    hook は決定論でなければならない（node.seed 由来の Rng.fork('mod:<id>') を使う）。例外は握って WARN ログにする。
 *  - `?force=<ROOM_ID>`: 次の部屋抽選をその定義に固定する開発用フック（RarityGenerator.setForcedRoomId。配置に成功した時点で解除。
 *    存在しない ID はコンソール警告のみ）。node.forcedDefinitionId に残るのでセーブ・再生成でも同じ定義になる。
 *  - Game.checkSeamCrossing / interact の Seam 分岐: 緊急 Seam が無くなったので、`portal.seam && type==='door'` は全て意図的 Seam
 *    （Legendary 前室の end / hook の seam / targetExisting / resolveSeamTarget 済み）。Game 側の処理はそのまま「意図的 Seam のみ」を扱うことになる。
 *    portal.far（一方通行の遠距離接続）は戻り Portal が無いので、遷移後は戻れない前提で扱う。portal.ride は resolveRide を呼ぶ。
 *  - resolveRide(node, portal): VehicleRide 用。'platform' Adapter を遠方に置いて先の部屋を確定し { platform, spawn, yaw } を返す（車内演出の後にテレポート）。
 *  - canRelayout(node): レイアウト変更（ソケット追加・Variant 変更）を許す条件。frozen（見えている・訪問済み）の部屋には絶対に開口を足さない。
 */
import { Rng, roomSeed } from '../core/rng';
import { aabbContains, aabbOverlap, aabbToWorld, type AABB } from '../core/aabb';
import {
  addDir, dirVec, toLocal, toWorld, type AdapterKind, type Dir, type EntryReq, type GeneratorContext, type Placement, type Portal, type RoomDefinition, type RoomInstance, type Socket, type Vec3,
} from '../core/types';
import { ROOM_BY_ID, TEMPLATE_BY_ID } from '../data';
import { generateLayout } from '../generators';
import { generateAdapter } from '../generators/AdapterGenerator';
import { across, along, socketOnSpan, wallSpans, type WallSpan } from '../generators/footprint';
import { DOOR_H, DOOR_W, HOLE_SIZE, VARIANTS, type RoomLayout } from '../generators/layout';
import { paletteFor } from '../generators/presets';
import { GridProjector, levelSpanOf } from '../map/GridProjector';
import { RoomGraph } from './RoomGraph';
import { clearForcedRoomId, peekForcedRoomId, pickDefinition, rollRarity, type PickOptions } from './RarityGenerator';

export const CLOSE_DELAY_SEC = 4;
const FLOOR = 3.6;

/** 前方ベクトル (-sin yaw, -cos yaw) が方向 d を向く yaw */
export function yawFor(d: Dir): number {
  return d === 0 ? Math.PI : d === 1 ? -Math.PI / 2 : d === 2 ? 0 : Math.PI / 2;
}

/** 扉として扱う開口（部屋を抽選して配置する対象。street / gate は幅広の常開扉） */
export function isDoorLike(type: Portal['type']): boolean {
  return type === 'door' || type === 'street' || type === 'gate';
}

/** しゃがみ開口（先に crawl Adapter を挟む） */
export function isCrawlSocket(s: Socket): boolean {
  return !!s.crawl || (s.sill ?? 0) > 0;
}

// ------------------------------------------------------------ 接続フック
export interface ConnectHookCtx {
  world: WorldManager;
  /** 接続元ノード */
  node: RoomInstance;
  portal: Portal;
  /** 接続元の定義（Adapter なら null） */
  def: RoomDefinition | null;
  /** 生成される子の深度 */
  depth: number;
}

export interface ConnectDirective {
  /** 抽選をこの定義に固定する */
  forceDefinitionId?: string;
  prefer?: 'room' | 'corridor';
  roomLikeOnly?: boolean;
  smallOnly?: boolean;
  /** 意図的 Seam（先は開けた時に resolveSeamTarget で確定） */
  seam?: boolean;
  /** 施錠して終わり */
  lock?: boolean;
  /** 子ノードの役割（'loop' / 'interior' / 'repeat' など） */
  role?: string;
  /** 既存部屋への一方通行 Seam 接続（FarLink / LoopTopology） */
  targetExisting?: string;
  /** RepeatDestination: 何回目の反復か */
  repeat?: number;
}

export type ConnectHook = (ctx: ConnectHookCtx) => ConnectDirective | void;
/** ノード生成直後（接続・配置の前）に呼ばれるフック。Modifier の onNodeCreated（localFlags / modifierState の初期化）用 */
export type NodeHook = (node: RoomInstance, def: RoomDefinition | null, world: WorldManager) => void;

/** connectPortal の試行モード（boolean は後方互換: false = 側道, true = 進行保証で全手段） */
export interface ConnectMode {
  /** 進行保証（失敗しても呼び出し側が WARN を出す） */
  mustSucceed: boolean;
  /** 通常抽選（直結 + 部屋 Variant 全段）を試す */
  tryRoom: boolean;
  /** SEAM-4: 小部屋で再抽選 */
  trySmall: boolean;
  /** SEAM-5: 前室を試す */
  tryVestibule: boolean;
}
const SIDE_MODE: ConnectMode = { mustSucceed: false, tryRoom: true, trySmall: false, tryVestibule: false };
const FULL_MODE: ConnectMode = { mustSucceed: true, tryRoom: true, trySmall: true, tryVestibule: true };

function normalizeMode(m: boolean | ConnectMode): ConnectMode {
  if (typeof m === 'boolean') return m ? FULL_MODE : SIDE_MODE;
  return m;
}

export interface RollOptions extends PickOptions {
  role?: string;
  repeat?: number;
}

/** 扉の外側に「最小の前室」が入る枡（hasFreeExit） */
const EXIT_FRAME: AABB = { min: [-1.3, -0.1, 0], max: [1.3, 2.9, 3.2] };
/** Adapter の出口の外側に求める枡。部屋と同じ 2.6×3.2（最小の部屋 3.5×4 を求める 3.6×3.6 は施錠行き止まりが 52→41 に対し 41→52 と悪化したので採用しない。
 *  前室の末端が袋小路になるのは vestibuleChainLength（連鎖 2 まで）で抑える） */
const ADAPTER_EXIT_FRAME: AABB = { min: [-1.3, -0.1, 0], max: [1.3, 2.9, 3.2] };
/** 新設ソケット（SEAM-3）の外側に求める枡。大きい順に試す */
const NEW_EXIT_FRAMES: AABB[] = [
  { min: [-3.0, -0.1, 0], max: [3.0, 2.9, 7.5] },
  { min: [-2.2, -0.1, 0], max: [2.2, 2.9, 5.0] },
  { min: [-1.3, -0.1, 0], max: [1.3, 2.9, 3.6] },
];
/** 既存ソケットとの最小間隔（生成器 placeExits の tooClose 2.4〜3.5 m を上回らせ、再生成で出口が動かないようにする） */
const SOCKET_GAP = 3.6;

export class WorldManager {
  readonly layouts = new Map<string, RoomLayout>();
  readonly worldBounds = new Map<string, AABB>();
  readonly projector = new GridProjector();
  readonly log: string[] = [];
  /** レイアウトが変わり再構築が必要な部屋（部屋同士の直結で開口が増えた） */
  readonly dirty = new Set<string>();
  /** 既に見えている（構築済み・訪問済み）部屋。新しい開口の追加対象にしない */
  frozen = new Set<string>();
  /** 接続フック（Modifier が登録する。connectPortal の先頭で順に呼ぶ） */
  readonly connectHooks: ConnectHook[] = [];
  /** ノード生成直後のフック（rollRoomNode の末尾で呼ぶ。統合担当が modifiers.notifyNodeCreated を登録する） */
  readonly nodeHooks: NodeHook[] = [];
  /** 施錠行き止まりになった部屋（WARN を 1 回だけ出す）。runtime */
  readonly deadEndRooms = new Set<string>();

  constructor(public graph: RoomGraph) {
    for (const n of graph.nodes.values()) {
      if (n.placement) this.worldBounds.set(n.roomId, aabbToWorld(this.layoutFor(n).bounds, n.placement));
      if (n.mapCell) this.projector.restore(n.roomId, n.mapCell);
    }
  }

  // ------------------------------------------------------------ layout
  generatorOf(node: RoomInstance): string {
    if (node.isAdapter) return 'ADAPTER';
    if (node.fallback) return 'RoomGenerator';
    return ROOM_BY_ID.get(node.definitionId)?.generator ?? 'RoomGenerator';
  }

  definitionOf(node: RoomInstance): RoomDefinition | null {
    if (node.isAdapter) return null;
    return ROOM_BY_ID.get(node.definitionId) ?? null;
  }

  /** レイアウト変更（ソケット追加・Variant 変更・成長）を許す条件。不変条件「入室後に部屋が変わらない」をここで保証する */
  canRelayout(node: RoomInstance): boolean {
    return !this.frozen.has(node.roomId) && !node.visited && !node.isAdapter;
  }

  layoutFor(node: RoomInstance): RoomLayout {
    let L = this.layouts.get(node.roomId);
    if (L) return L;
    if (node.isAdapter && node.adapter) {
      const from = this.graph.nodes.get(node.adapter.paletteFrom);
      const palette = from ? this.layoutFor(from).palette : paletteFor(ROOM_BY_ID.get('C02')!, TEMPLATE_BY_ID.get('CorridorOffice')!, false);
      L = generateAdapter({
        kind: node.adapter.kind,
        entryType: node.entryReq?.type ?? 'door',
        entryWidth: node.entryReq?.width ?? 1.0,
        entryHeight: node.entryReq?.height,
        entrySill: node.entryReq?.sill,
        entryCrawl: node.entryReq?.crawl,
        direction: node.adapter.direction,
        length: node.adapter.length,
        turn: node.adapter.turn,
        palette,
      });
    } else {
      const def = ROOM_BY_ID.get(node.definitionId)!;
      const template = TEMPLATE_BY_ID.get(def.baseTemplate) ?? TEMPLATE_BY_ID.get('LargeRoom')!;
      const palette = paletteFor(def, template, node.fallback);
      const rng = new Rng(node.seed).fork('layout');
      L = generateLayout(
        {
          def,
          template: node.fallback ? TEMPLATE_BY_ID.get('LargeRoom')! : template,
          rng,
          entry: node.entryReq,
          exits: node.exitCount,
          variant: node.variant,
          palette,
          // 入口の案内板（部屋名・ID・レア度）は廃止。GenParams.label を渡さなければ labelAtEntry は何も置かない
          allowHole: node.depth >= 1 && node.entryReq?.type !== 'hole',
          extraSockets: node.extraSockets,
          removedSockets: node.removedSockets,
          mainRect: node.mainRect,
          holeLocal: node.holeLocal,
          role: node.role,
          node,
        },
        node.fallback,
      );
    }
    this.layouts.set(node.roomId, L);
    return L;
  }

  socketOf(node: RoomInstance, socketId: string): Socket {
    const s = this.layoutFor(node).sockets.find((x) => x.id === socketId);
    if (!s) throw new Error(`socket not found ${node.roomId}/${socketId}`);
    return s;
  }

  socketWorld(node: RoomInstance, socketId: string): { pos: Vec3; dir: Dir } {
    const s = this.socketOf(node, socketId);
    const p = node.placement!;
    return { pos: toWorld(p, s.pos), dir: addDir(s.dir, p.yawQ) };
  }

  /** 扉の開閉状態は所有側（isReturn=false 側）の Portal が持つ。扉パネル付きの床穴（Portal.covered。E03）も同じ扱い。それ以外の穴・開口は常に開いている */
  portalOpen(node: RoomInstance, p: Portal): boolean {
    if (p.type === 'hole') {
      const owner = p.isReturn ? this.ownerPortalOf(p) ?? p : p;
      return owner.covered ? owner.open : true;
    }
    if (p.type !== 'door') return true;
    if (!p.isReturn) return p.open;
    const t = this.ownerPortalOf(p);
    if (t) return t.open;
    void node;
    return p.open;
  }

  /** 戻り側 Portal の所有側（反対側の部屋の Portal）。無ければ undefined */
  private ownerPortalOf(p: Portal): Portal | undefined {
    if (p.targetRoomId && p.targetPortalId && this.graph.has(p.targetRoomId)) {
      return this.graph.get(p.targetRoomId).portals.find((x) => x.portalId === p.targetPortalId);
    }
    return undefined;
  }

  // ------------------------------------------------------------ context
  ctx(depth: number): GeneratorContext {
    return {
      worldSeed: this.graph.worldSeed,
      depth,
      recentRarities: this.graph.recentRarities,
      discoveredIds: this.graph.discoveredIds,
      visitedCount: this.graph.visitedCount,
      roomsSinceRare: this.graph.roomsSinceRare,
    };
  }

  // ------------------------------------------------------------ node creation
  private makePortals(layout: RoomLayout, entryIsReturn: boolean, parentId?: string, parentPortalId?: string): Portal[] {
    return layout.sockets.map((s) => {
      const isEntry = s.id === 'entry';
      const isReturn = isEntry && entryIsReturn;
      const p: Portal = {
        portalId: s.id,
        type: s.type,
        socketId: s.id,
        targetRoomId: isReturn ? parentId : undefined,
        targetPortalId: isReturn ? parentPortalId : undefined,
        // 天井穴（hole 入口）は戻れない
        locked: isEntry && s.type === 'hole',
        oneWay: s.type === 'hole',
        seam: s.type === 'elevator',
        open: s.type !== 'door',
        closeDelaySec: CLOSE_DELAY_SEC,
        isReturn,
        projected: true,
      };
      if (isCrawlSocket(s)) p.crawl = true;
      return p;
    });
  }

  private baseNode(roomId: string, definitionId: string, depth: number, entryReq: EntryReq | null): RoomInstance {
    return {
      roomId,
      definitionId,
      seed: roomSeed(this.graph.worldSeed, roomId),
      depth,
      portals: [],
      visited: false,
      isAdapter: false,
      entryReq,
      exitCount: 1,
      variant: 0,
      extraSockets: [],
      removedSockets: [],
      fallback: false,
      entryIsReturn: true,
      state: { openedDoors: [], localFlags: {} },
    };
  }

  /** 開始部屋を作る（オフィス廊下 C02 固定。深度 0） */
  createStartRoom(): RoomInstance {
    const id = this.graph.newRoomId();
    const node = this.baseNode(id, 'C02', 0, null);
    node.exitCount = 2;
    node.entryIsReturn = false;
    node.variant = 1;
    const layout = this.layoutFor(node);
    node.portals = this.makePortals(layout, false);
    node.placement = { position: [0, 0, 0], yawQ: 0 };
    this.graph.add(node);
    this.worldBounds.set(id, aabbToWorld(layout.bounds, node.placement));
    node.mapCell = this.projector.assign(node.roomId, this.worldBounds.get(id)!, null, 0);
    return node;
  }

  /** 部屋ノードを抽選する（配置はしない）。forceDefinitionId / smallOnly / role / repeat は RoomInstance に保存して決定論・セーブ整合を保つ */
  rollRoomNode(depth: number, entryReq: EntryReq | null, entryIsReturn: boolean, seedTag: string, opts: RollOptions = {}): RoomInstance {
    const id = this.graph.newRoomId();
    const rng = new Rng(roomSeed(this.graph.worldSeed, id)).fork(seedTag);
    const rarity = rollRarity(rng, this.ctx(depth));
    const forced = opts.forceDefinitionId ?? peekForcedRoomId() ?? undefined;
    const pick = pickDefinition(rng, rarity, this.ctx(depth), { ...opts, forceDefinitionId: forced });
    const node = this.baseNode(id, pick.def.id, depth, entryReq);
    node.fallback = pick.fallback;
    node.entryIsReturn = entryIsReturn;
    if (forced && pick.def.id === forced) node.forcedDefinitionId = forced;
    if (opts.role) node.role = opts.role;
    if (opts.repeat !== undefined) node.repeat = opts.repeat;
    const total = rng.int(pick.def.minExits, pick.def.maxExits);
    node.exitCount = opts.smallOnly ? 1 : Math.max(1, Math.min(4, total - 1 + (rng.chance(0.5) ? 1 : 0)));
    for (const hook of this.nodeHooks) {
      try {
        hook(node, pick.def, this);
      } catch (e) {
        this.log.push(`WARN node hook failed at ${node.roomId}: ${(e as Error).message}`);
      }
    }
    return node;
  }

  private adapterNode(kind: AdapterKind, depth: number, entryReq: EntryReq, paletteFrom: string, direction: 1 | -1 | 0, turn: 0 | 1 | 3, length: number): RoomInstance {
    const id = this.graph.newRoomId();
    const node = this.baseNode(id, 'ADAPTER', depth, entryReq);
    node.isAdapter = true;
    node.adapter = { kind, direction, turn, length, paletteFrom };
    return node;
  }

  private entryReqOf(socket: Socket): EntryReq {
    const req: EntryReq = { type: socket.type, width: socket.width };
    if (isCrawlSocket(socket) || socket.height < DOOR_H - 0.05) req.height = socket.height;
    if (socket.sill) req.sill = socket.sill;
    if (socket.crawl) req.crawl = true;
    return req;
  }

  // ------------------------------------------------------------ placement
  private placementFor(anchorPos: Vec3, anchorDir: Dir, entry: Socket): Placement {
    const yawQ = addDir(anchorDir, 2 - entry.dir);
    const rotated = toWorld({ position: [0, 0, 0], yawQ }, entry.pos);
    return { position: [anchorPos[0] - rotated[0], anchorPos[1] - rotated[1], anchorPos[2] - rotated[2]], yawQ };
  }

  private fits(bounds: AABB, ignore: Set<string>): boolean {
    for (const [id, b] of this.worldBounds) {
      if (ignore.has(id)) continue;
      if (aabbOverlap(bounds, b)) return false;
    }
    return true;
  }

  private variantCount(node: RoomInstance): number {
    if (node.isAdapter) return 1;
    // VARIANTS 未登録の Generator（スタブ = generateRoom 委譲）は RoomGenerator と同じ段数を試す
    return VARIANTS[this.generatorOf(node)] ?? VARIANTS.RoomGenerator ?? 8;
  }

  /** ノードを anchor（親ソケットのワールド位置/向き）に接続して配置。大きいバリアントから順に試す */
  private tryPlace(node: RoomInstance, anchorPos: Vec3, anchorDir: Dir, ignore: Set<string>): boolean {
    const n = this.variantCount(node);
    for (let v = 0; v < n; v++) {
      node.variant = v;
      this.layouts.delete(node.roomId);
      const layout = this.layoutFor(node);
      const entry = layout.sockets.find((x) => x.id === 'entry')!;
      const placement = this.placementFor(anchorPos, anchorDir, entry);
      const wb = aabbToWorld(layout.bounds, placement);
      if (this.fits(wb, ignore) && this.hasFreeExit(layout, placement, node)) {
        node.placement = placement;
        this.worldBounds.set(node.roomId, wb);
        return true;
      }
    }
    this.layouts.delete(node.roomId);
    node.variant = 0;
    return false;
  }

  /** hole の落下先: 穴の真下に天井穴を合わせて配置する */
  private tryPlaceBelow(node: RoomInstance, holePos: Vec3, ignore: Set<string>): boolean {
    const anchor: Vec3 = [holePos[0], holePos[1] - 0.25, holePos[2]];
    const n = this.variantCount(node);
    const rng = new Rng(node.seed).fork('below');
    const dirs = rng.shuffle([0, 1, 2, 3] as Dir[]);
    for (let v = 0; v < n; v++) {
      node.variant = v;
      this.layouts.delete(node.roomId);
      const layout = this.layoutFor(node);
      const entry = layout.sockets.find((x) => x.id === 'entry')!;
      for (const d of dirs) {
        const placement = this.placementFor(anchor, d, entry);
        const wb = aabbToWorld(layout.bounds, placement);
        if (this.fits(wb, ignore) && this.hasFreeExit(layout, placement, node)) {
          node.placement = placement;
          this.worldBounds.set(node.roomId, wb);
          return true;
        }
      }
    }
    this.layouts.delete(node.roomId);
    node.variant = 0;
    return false;
  }

  /** 出口ソケットのうち少なくとも 1 つは、扉の外側に前室（Adapter なら最小の部屋）が置ける空きがあるか、既存の部屋の壁に面していること */
  private hasFreeExit(layout: RoomLayout, placement: Placement, node: RoomInstance): boolean {
    const selfId = node.roomId;
    const exits = layout.sockets.filter((s) => s.id !== 'entry' && (isDoorLike(s.type) || s.type === 'stairs' || s.type === 'ramp'));
    // 扉・階段の出口が無い部屋は、他の進行手段（床穴・エレベーター・乗り物など entry 以外のソケット）が無ければ行き止まり確定なので置かない
    if (exits.length === 0) return layout.sockets.some((s) => s.id !== 'entry');
    const ignore = new Set<string>([selfId]);
    const frame = node.isAdapter ? ADAPTER_EXIT_FRAME : EXIT_FRAME;
    for (const s of exits) {
      const local = aabbToWorld(frame, { position: s.pos, yawQ: s.dir });
      const world = aabbToWorld(local, placement);
      if (this.fits(world, ignore)) return true;
      const sw = toWorld(placement, s.pos);
      const wdir = addDir(s.dir, placement.yawQ);
      if (s.type === 'door' && this.findWallBehind(selfId, sw, wdir, placement.position[1])) return true;
    }
    return false;
  }

  /** seam 先など、anchor 付近の自由な位置に置く（y を階層単位でずらして探す）。wide = true なら遠方（〜240 m）まで探す */
  private tryPlaceFree(node: RoomInstance, near: Vec3, ignore: Set<string>, wide = false): boolean {
    const layout = this.layoutFor(node);
    const entry = layout.sockets.find((x) => x.id === 'entry')!;
    const offsets: Vec3[] = [];
    for (const dy of [-FLOOR, FLOOR, -2 * FLOOR, 2 * FLOOR, -3 * FLOOR, 3 * FLOOR, -4 * FLOOR, 4 * FLOOR]) {
      offsets.push([0, dy, 0], [12, dy, 0], [-12, dy, 0], [0, dy, 12], [0, dy, -12], [24, dy, 0], [-24, dy, 0], [0, dy, 24], [0, dy, -24]);
    }
    if (wide) {
      for (const r of [60, 120, 180, 240]) {
        for (const dy of [0, -FLOOR, FLOOR, -2 * FLOOR, 2 * FLOOR]) {
          offsets.push([r, dy, 0], [-r, dy, 0], [0, dy, r], [0, dy, -r], [r, dy, r], [-r, dy, r], [r, dy, -r], [-r, dy, -r]);
        }
      }
    }
    for (const off of offsets) {
      for (const dir of [0, 1, 2, 3] as Dir[]) {
        const anchor: Vec3 = [near[0] + off[0], near[1] + off[1], near[2] + off[2]];
        const placement = this.placementFor(anchor, dir, entry);
        const wb = aabbToWorld(layout.bounds, placement);
        if (this.fits(wb, ignore)) {
          node.placement = placement;
          this.worldBounds.set(node.roomId, wb);
          return true;
        }
      }
    }
    return false;
  }

  /** 遠方配置を Variant 全段で試す（Legendary 巨大部屋） */
  private tryPlaceFarVariants(node: RoomInstance, near: Vec3): boolean {
    const n = this.variantCount(node);
    for (let v = 0; v < n; v++) {
      node.variant = v;
      this.layouts.delete(node.roomId);
      if (this.tryPlaceFree(node, near, new Set(), true)) return true;
    }
    this.layouts.delete(node.roomId);
    node.variant = 0;
    return false;
  }

  private link(from: RoomInstance, fromPortal: Portal, to: RoomInstance): void {
    fromPortal.targetRoomId = to.roomId;
    fromPortal.targetPortalId = 'entry';
    to.parentRoomId = from.roomId;
    to.entryPortalId = fromPortal.portalId;
  }

  private lockPortal(portal: Portal): void {
    portal.locked = true;
    portal.open = false;
  }

  /** 地図の階数（MapCell.levelSpan）。多層の巨大部屋（Mega / Street）だけ 2 以上を返す（単層の吹き抜けホールも
   *  世界 AABB の高さでは 2 になり得るので Generator で限定し、Generator が `layout.levels` を出していればそれを優先する） */
  private levelSpanFor(node: RoomInstance, wb: AABB): number {
    if (node.isAdapter) return 1;
    const gen = this.generatorOf(node);
    if (gen !== 'MegaStructureGenerator' && gen !== 'StreetGenerator') return 1;
    const levels = this.layoutFor(node).levels;
    return levels && levels >= 1 ? Math.floor(levels) : levelSpanOf(wb);
  }

  private finalize(node: RoomInstance, parent: RoomInstance | null, parentPortal: Portal | null, entryIsReturn: boolean): void {
    const layout = this.layoutFor(node);
    node.portals = this.makePortals(layout, entryIsReturn, parent?.roomId, parentPortal?.portalId);
    // 床穴の位置は Portal を作った時点で固定する（以後の再生成で動かない・消えない）
    const hs = layout.sockets.find((s) => s.id === 'hole' && s.type === 'hole');
    if (hs) {
      node.holeLocal = [hs.pos[0], hs.pos[1], hs.pos[2]];
      // キャッシュを捨て、以後の layoutFor が保存ノード（holeLocal あり）からの再生成と同じ経路を通るようにする
      this.layouts.delete(node.roomId);
    }
    this.graph.add(node);
    const wb = this.worldBounds.get(node.roomId)!;
    const parentCell = parent?.mapCell ?? null;
    const dir = parent && parentPortal && parent.placement ? this.socketWorld(parent, parentPortal.socketId).dir : 0;
    const span = this.levelSpanFor(node, wb);
    node.mapCell = this.projector.assign(node.roomId, wb, parentCell, dir, false, span > 1 ? { levelSpan: span } : undefined);
    if (parentPortal) parentPortal.projected = node.mapCell.projected;
    // ?force= で固定した部屋を配置し終えたら解除
    if (node.forcedDefinitionId && node.forcedDefinitionId === peekForcedRoomId()) clearForcedRoomId();
    if (!node.isAdapter) this.addAdjacencyLinks(node);
  }

  /**
   * 入室時の処理: 現在の部屋の接続先を確定し、さらに隣接部屋（1 hop）の接続先も確定して 2 hop 先まで配置する。
   * これにより、隣の部屋に入った時点でその部屋のレイアウトは確定済み（入室後に扉や家具が変わらない）。
   */
  prepareRoom(roomId: string): string[] {
    const created = this.ensureNeighbors(roomId);
    for (const nid of this.graph.placedNeighbors(roomId)) {
      created.push(...this.ensureNeighbors(nid));
    }
    return created;
  }

  /**
   * 全 Portal の接続先を確定し、1 hop を物理配置する。
   * 側道扉は通常抽選のみ（失敗なら施錠）。進行保証（未探索方向 1 本）は段階的に全手段を試す。
   * 戻り値: 新規作成したノード id
   */
  ensureNeighbors(roomId: string): string[] {
    const node = this.graph.get(roomId);
    if (!node.placement) return [];
    const created: string[] = [];
    // レイアウトに存在しないソケットの Portal は取り除く（安全弁）
    const socketIds = new Set(this.layoutFor(node).sockets.map((s) => s.id));
    node.portals = node.portals.filter((p) => socketIds.has(p.socketId) || p.targetRoomId);
    const pending = node.portals.filter((p) => !p.isReturn && !p.targetRoomId && !p.locked && !p.seam);
    for (const portal of pending) this.connectPortal(node, portal, created, SIDE_MODE);
    const hasForward = () => node.portals.some((p) => !p.isReturn && !p.locked && (p.targetRoomId || p.seam));
    const cands = () => node.portals.filter((p) => !p.isReturn && p.locked && !p.targetRoomId && !p.seam && (isDoorLike(p.type) || p.type === 'stairs' || p.type === 'ramp') && !node.removedSockets.includes(p.socketId));
    const pass = (mode: ConnectMode) => {
      for (const portal of cands()) {
        portal.locked = false;
        if (this.connectPortal(node, portal, created, mode)) return true;
      }
      return false;
    };
    if (!hasForward()) {
      // SEAM-2: 全候補を通常抽選（直結 + Variant 全段）で試し切る
      pass({ mustSucceed: true, tryRoom: true, trySmall: false, tryVestibule: false });
    }
    if (!hasForward() && this.canRelayout(node)) {
      // SEAM-3: 未構築・未凍結の部屋にだけ新設ソケット（最大 1 本）
      this.tryNewExit(node, created);
    }
    if (!hasForward()) {
      // SEAM-4: 一段小さい定義で再抽選
      pass({ mustSucceed: true, tryRoom: false, trySmall: true, tryVestibule: false });
    }
    if (!hasForward()) {
      // SEAM-5: 前室（4/6/8/3/2 m、転回あり）
      pass({ mustSucceed: true, tryRoom: false, trySmall: false, tryVestibule: true });
    }
    if (!hasForward() && !this.deadEndRooms.has(roomId)) {
      // Q3 = B: Seam 化せず施錠して行き止まり（閉じ込めは許容）。WARN は部屋ごとに 1 回
      this.deadEndRooms.add(roomId);
      const cs = cands();
      if (cs.length > 0) this.log.push(`WARN dead-end lock at ${roomId}/${cs.map((p) => p.portalId).join(',')}`);
      else this.log.push(`WARN forward portal not guaranteed at ${roomId} (no candidate)`);
    }
    // 行き先を置けなかった扉の多くは壁に戻す（施錠扉は 1/4 だけ残す）
    // 扉ごとに固定の乱数で判定する（呼び出し回数に依らず同じ結果になる）
    // 扉パネルを持たない開口（stairs / ramp / street / gate）は施錠しても塞ぐものが無く「向こうに何も無い開口」になるので、確率に依らず常に壁へ戻す
    const removable = node.portals.filter((p) => {
      if (p.isReturn || !p.locked || p.targetRoomId || p.seam || node.removedSockets.includes(p.socketId)) return false;
      if (p.type === 'door') return new Rng(node.seed).fork(`prune:${p.socketId}`).chance(0.75);
      return p.type === 'stairs' || p.type === 'ramp' || p.type === 'street' || p.type === 'gate';
    });
    if (removable.length > 0 && !node.isAdapter) {
      for (const p of removable) node.removedSockets.push(p.socketId);
      node.portals = node.portals.filter((p) => !removable.includes(p));
      this.layouts.delete(node.roomId);
      this.dirty.add(node.roomId);
    }
    return created;
  }

  /** ソケットの同一性（再生成で既存の出口が動いていないことの確認用） */
  private socketSig(s: Socket): string {
    return `${s.id}|${s.type}|${s.dir}|${s.pos[0].toFixed(3)},${s.pos[1].toFixed(3)},${s.pos[2].toFixed(3)}|${s.width}|${s.height}`;
  }

  /**
   * 部屋に壁面ソケットを追加し、レイアウトを再生成して既存ソケットが 1 つも動いていないことを確認する。
   * 動いた場合は取り消して false（接続済みの隣室とのずれを防ぐ）。成功時は dirty に入れる
   */
  private addExtraSocketStable(node: RoomInstance, s: Socket): boolean {
    const before = this.layoutFor(node).sockets.map((x) => this.socketSig(x));
    node.extraSockets.push(s);
    this.layouts.delete(node.roomId);
    const after = new Set(this.layoutFor(node).sockets.map((x) => this.socketSig(x)));
    const stable = before.every((sig) => after.has(sig)) && after.has(this.socketSig(s));
    if (!stable) {
      node.extraSockets.pop();
      this.layouts.delete(node.roomId);
      this.layoutFor(node);
      return false;
    }
    this.dirty.add(node.roomId);
    return true;
  }

  /** SEAM-3: 進行用扉を新設ソケットへ移す。未構築・未凍結（canRelayout）の部屋にのみ、扉 1 本まで */
  private tryNewExit(node: RoomInstance, created: string[]): boolean {
    if (!this.canRelayout(node) || !node.placement) return false;
    const lay = this.layoutFor(node);
    if (lay.footprint.length === 0) return false;
    const rng = new Rng(node.seed).fork('newexit');
    const spans = rng.shuffle(wallSpans(lay.footprint).filter((sp) => sp.a1 - sp.a0 >= 3.0));
    const p = node.placement;
    for (const frame of NEW_EXIT_FRAMES) {
      for (const sp of spans) {
        const ts: number[] = [];
        for (let t = Math.ceil((sp.a0 + 1.2) * 2) / 2; t <= sp.a1 - 1.2; t += 0.5) ts.push(t);
        for (const t of rng.shuffle(ts)) {
          const current = this.layoutFor(node);
          if (current.sockets.some((s) => s.dir === sp.edge.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - sp.edge.coord) < 0.08 && Math.abs(along(s.dir, s.pos[0], s.pos[2]) - t) < SOCKET_GAP)) continue;
          const sid = `x${node.extraSockets.length + 1}`;
          const s = socketOnSpan(sid, 'door', sp, t, DOOR_W, DOOR_H);
          const wpos = toWorld(p, s.pos);
          const wdir = addDir(s.dir, p.yawQ);
          if (!this.fits(aabbToWorld(frame, { position: wpos, yawQ: wdir }), new Set([node.roomId]))) continue;
          if (!this.addExtraSocketStable(node, s)) continue;
          const portal: Portal = {
            portalId: sid, type: 'door', socketId: sid, locked: false, oneWay: false, seam: false, open: false, closeDelaySec: CLOSE_DELAY_SEC, isReturn: false, projected: true,
          };
          node.portals.push(portal);
          const ok = this.connectPortal(node, portal, created, FULL_MODE);
          if (ok) {
            this.log.push(`INFO new exit ${node.roomId}/${sid}`);
            return true;
          }
          // 取り消し
          node.extraSockets = node.extraSockets.filter((x) => x !== s);
          node.portals = node.portals.filter((x) => x !== portal);
          this.layouts.delete(node.roomId);
        }
      }
    }
    return false;
  }

  /** 配置済みの部屋の主矩形を、隣の部屋や既存の占有に当たるまで 0.5m 刻みで成長させる（空間を埋め、壁を揃える）。
   *  廊下は直線（footprint 1 矩形）のみ、長手方向（z1）と幅（上限 5.0 m）を伸ばす（生成器が mainRect を読むことが前提。折れ廊下は対象外） */
  private growToFill(node: RoomInstance): void {
    const gen = this.generatorOf(node);
    const isCorridor = gen === 'CorridorGenerator';
    const def = ROOM_BY_ID.get(node.definitionId);
    const tid = def?.baseTemplate ?? '';
    // StreetGenerator は StreetGrid（単一矩形。mainRect から街区数・街路幅を逆算する）だけ対象。RoadGraph は廊下型で対象外
    const isStreetGrid = gen === 'StreetGenerator' && tid === 'StreetGrid';
    if (!isCorridor && !isStreetGrid && !['RoomGenerator', 'GridGenerator', 'AtriumGenerator', 'ParkingGenerator'].includes(gen)) return;
    // 天井穴で入る部屋は成長させない（主矩形が変わると天井穴の位置が上の穴とずれる）
    if (node.entryReq?.type === 'hole') return;
    // ScaleAnomaly(room) の部屋は成長させない（layout フックが footprint を ×s するので、成長後の主矩形を渡すと二重に拡大され fits() で取り消されるだけ）
    if (def?.modifiers?.some((m) => m.id === 'ScaleAnomaly' && ((m.params?.mode as string | undefined) ?? 'room') === 'room')) return;
    const layout = this.layoutFor(node);
    if (layout.footprint.length === 0 || !node.placement) return;
    if (isCorridor && layout.footprint.length !== 1) return;
    const p = node.placement;
    const ignore = new Set<string>([node.roomId]);
    const main = { ...layout.footprint[0] };
    const maxDim = ['SmallRoom', 'Restroom'].includes(tid) ? 12 : ['Classroom', 'LockerRoom', 'RetailRoom'].includes(tid) ? 22 : gen === 'RoomGenerator' ? 36 : isStreetGrid ? 64 : 44;
    const maxW = isCorridor ? 5.0 : maxDim;
    const maxD = isCorridor ? 30 : maxDim;
    const tryRect = (r: { x0: number; z0: number; x1: number; z1: number }) =>
      this.fits(aabbToWorld({ min: [r.x0, -0.2, r.z0], max: [r.x1, layout.height + 0.2, r.z1] }, p), ignore);
    let grown = false;
    const sides: ('x1' | 'x0' | 'z1')[] = isCorridor ? ['z1', 'x1', 'x0'] : ['x1', 'x0', 'z1'];
    for (const side of sides) {
      for (let i = 0; i < 24; i++) {
        const cand = { ...main };
        cand[side] += side === 'x0' ? -0.5 : 0.5;
        if (cand.x1 - cand.x0 > maxW || cand.z1 - cand.z0 > maxD) break;
        if (!tryRect(cand)) break;
        Object.assign(main, cand);
        grown = true;
      }
    }
    if (!grown) return;
    const prevRect = node.mainRect;
    node.mainRect = main;
    this.layouts.delete(node.roomId);
    const L2 = this.layoutFor(node);
    const wb = aabbToWorld(L2.bounds, p);
    if (this.fits(wb, ignore) && this.hasFreeExit(L2, p, node)) {
      this.worldBounds.set(node.roomId, wb);
    } else {
      node.mainRect = prevRect;
      this.layouts.delete(node.roomId);
      this.layoutFor(node);
    }
  }

  // ------------------------------------------------------------ 接続
  /** 全 hook を呼び、指示を後勝ちでマージする */
  private runHooks(node: RoomInstance, portal: Portal, depth: number): ConnectDirective {
    const merged: ConnectDirective = {};
    if (this.connectHooks.length === 0) return merged;
    const ctx: ConnectHookCtx = { world: this, node, portal, def: this.definitionOf(node), depth };
    for (const hook of this.connectHooks) {
      try {
        const d = hook(ctx);
        if (d) Object.assign(merged, d);
      } catch (e) {
        this.log.push(`WARN connect hook failed at ${node.roomId}/${portal.portalId}: ${(e as Error).message}`);
      }
    }
    return merged;
  }

  private pickOptsOf(d: ConnectDirective, base: RollOptions): RollOptions {
    const o: RollOptions = { ...base };
    if (d.forceDefinitionId) o.forceDefinitionId = d.forceDefinitionId;
    if (d.prefer) o.prefer = d.prefer;
    if (d.roomLikeOnly) o.roomLikeOnly = true;
    if (d.smallOnly) o.smallOnly = true;
    if (d.role) o.role = d.role;
    if (d.repeat !== undefined) o.repeat = d.repeat;
    return o;
  }

  /**
   * Portal の接続先を確定する。mode: false = 側道（通常抽選のみ。失敗は施錠）/ true = 進行保証（全手段）/ ConnectMode で段階指定。
   * 戻り値: 接続（または意図的 Seam）できたか。失敗時は施錠済み
   */
  connectPortal(node: RoomInstance, portal: Portal, created: string[], mode: boolean | ConnectMode = false): boolean {
    const m = normalizeMode(mode);
    const socket = this.socketOf(node, portal.socketId);
    const depth = node.isAdapter ? node.depth : node.depth + 1;
    const directive = this.runHooks(node, portal, depth);

    // hook の指示: 施錠 / 既存部屋への一方通行 Seam / 意図的 Seam
    if (directive.lock) {
      this.lockPortal(portal);
      return false;
    }
    if (directive.targetExisting && this.graph.has(directive.targetExisting) && directive.targetExisting !== node.roomId) {
      portal.seam = true;
      portal.far = true;
      portal.open = false;
      portal.targetRoomId = directive.targetExisting;
      portal.targetPortalId = 'entry';
      portal.projected = false;
      this.log.push(`INFO far link ${node.roomId}/${portal.portalId} -> ${directive.targetExisting}`);
      return true;
    }
    if (directive.seam) {
      portal.seam = true;
      portal.open = false;
      portal.projected = false;
      node.state.localFlags[`seam:${portal.portalId}`] = { ...directive };
      this.log.push(`INFO intentional seam ${node.roomId}/${portal.portalId}`);
      return true;
    }

    if (socket.type === 'hole') return this.connectHole(node, portal, created, directive);
    const { pos, dir } = this.socketWorld(node, portal.socketId);
    // 親も干渉判定に含める（折れ曲がった親の別セグメントと重ならないように）。接する面は許容差で通る
    const ignore = new Set<string>();
    const entryReq = this.entryReqOf(socket);
    const rng = new Rng(node.seed).fork(`portal:${portal.portalId}`);
    const paletteFrom = node.isAdapter ? node.adapter!.paletteFrom : node.roomId;

    // 0) しゃがみ開口 → crawl Adapter を必ず挟む（先は Adapter の end で通常扉として抽選される）
    if (isCrawlSocket(socket) && !(node.isAdapter && node.adapter?.kind === 'crawl')) {
      const ad = this.adapterNode('crawl', depth, entryReq, paletteFrom, 0, 0, 0);
      if (this.tryPlace(ad, pos, dir, ignore)) {
        this.link(node, portal, ad);
        this.finalize(ad, node, portal, true);
        created.push(ad.roomId);
        return true;
      }
      this.layouts.delete(ad.roomId);
      this.lockPortal(portal);
      return false;
    }

    // 1) 扉の外側に既存の部屋があれば直結（ループ・密度）
    if (m.tryRoom && socket.type === 'door' && this.tryLinkExisting(node, portal, pos, dir)) return true;

    // 2) stairs / ramp（部屋から出るとき）→ 階段/スロープ Adapter。Adapter の先は必ず部屋
    if ((socket.type === 'stairs' || socket.type === 'ramp') && !node.isAdapter) {
      if (m.tryRoom) {
        const dirs: (1 | -1)[] = rng.chance(0.5) ? [1, -1] : [-1, 1];
        for (const d of dirs) {
          const ad = this.adapterNode(socket.type, depth, entryReq, node.roomId, d, 0, 0);
          if (this.tryPlace(ad, pos, dir, ignore)) {
            this.link(node, portal, ad);
            this.finalize(ad, node, portal, true);
            created.push(ad.roomId);
            return true;
          }
          this.layouts.delete(ad.roomId);
        }
      }
      return this.fallbackChain(node, portal, pos, dir, ignore, created, m, rng, entryReq, depth, directive);
    }

    // 3) 部屋を抽選して配置（親が廊下なら部屋、部屋なら廊下をやや優先）
    if (m.tryRoom) {
      const gen = this.generatorOf(node);
      const prefer: PickOptions['prefer'] = node.isAdapter ? null : gen === 'CorridorGenerator' ? 'room' : 'corridor';
      const room = this.rollRoomNode(depth, entryReq, true, `room:${portal.portalId}`, this.pickOptsOf(directive, { prefer }));
      if (this.tryPlace(room, pos, dir, ignore)) {
        this.growToFill(room);
        this.link(node, portal, room);
        this.finalize(room, node, portal, true);
        created.push(room.roomId);
        return true;
      }
      this.layouts.delete(room.roomId);
      // 4) Legendary の巨大部屋: 周囲に入らないときは前室 Adapter + 意図的 Seam で遠方に配置（Legendary のみ Seam 許可、地図は「？」）
      const def = ROOM_BY_ID.get(room.definitionId);
      if (def?.rarity === 'Legendary' && this.tryPlaceLegendaryFar(node, portal, room, pos, dir, created, depth, entryReq, rng)) return true;
      this.layouts.delete(room.roomId);
    }
    return this.fallbackChain(node, portal, pos, dir, ignore, created, m, rng, entryReq, depth, directive);
  }

  /** 床穴: 真下に部屋を物理配置する。置けなければ穴そのものを無くす */
  private connectHole(node: RoomInstance, portal: Portal, created: string[], directive: ConnectDirective = {}): boolean {
    // 穴の位置を固定（以後、直結ソケットの追加などでレイアウトを再生成しても動かない）
    node.holeLocal = [...this.socketOf(node, portal.socketId).pos] as Vec3;
    const { pos } = this.socketWorld(node, portal.socketId);
    const room = this.rollRoomNode(node.depth + 1, { type: 'hole', width: HOLE_SIZE }, true, `hole:${portal.portalId}`, this.pickOptsOf(directive, { roomLikeOnly: true }));
    if (this.tryPlaceBelow(room, pos, new Set())) {
      this.growToFill(room);
      this.link(node, portal, room);
      this.finalize(room, node, portal, true);
      created.push(room.roomId);
      return true;
    }
    this.layouts.delete(room.roomId);
    // 真下に置けない場合は穴そのものを無くす（床は塞がる）。蓋付きの穴は作らない
    node.holeLocal = undefined;
    node.removedSockets.push(portal.socketId);
    node.portals = node.portals.filter((p) => p !== portal);
    this.layouts.delete(node.roomId);
    this.dirty.add(node.roomId);
    return false;
  }

  /** node から親方向に連続する前室 Adapter の数（node 自身を含む） */
  private vestibuleChainLength(node: RoomInstance): number {
    let n = 0;
    let cur: RoomInstance | undefined = node;
    while (cur && cur.isAdapter && cur.adapter?.kind === 'vestibule' && n < 8) {
      n++;
      cur = cur.parentRoomId ? this.graph.nodes.get(cur.parentRoomId) : undefined;
    }
    return n;
  }

  /** 通常抽選が失敗した後の段階: 小部屋再抽選（SEAM-4）→ 前室（SEAM-5）→ 施錠。Seam 化はしない（Q3 = B） */
  private fallbackChain(node: RoomInstance, portal: Portal, pos: Vec3, dir: Dir, ignore: Set<string>, created: string[], m: ConnectMode, rng: Rng, entryReq: EntryReq, depth: number, directive: ConnectDirective): boolean {
    const paletteFrom = node.isAdapter ? node.adapter!.paletteFrom : node.roomId;
    if (m.trySmall && entryReq.type === 'door') {
      const room = this.rollRoomNode(depth, entryReq, true, `small:${portal.portalId}`, this.pickOptsOf(directive, { smallOnly: true }));
      if (this.tryPlace(room, pos, dir, ignore)) {
        this.growToFill(room);
        this.link(node, portal, room);
        this.finalize(room, node, portal, true);
        created.push(room.roomId);
        this.log.push(`INFO small reroll ${node.roomId}/${portal.portalId}`);
        return true;
      }
      this.layouts.delete(room.roomId);
    }
    // 前室の連鎖は 2 つまで（前室の末端がまた前室になる連鎖は Seam の主因だった。今は施錠で終わるが空間の無駄を防ぐ）
    if (m.tryVestibule && this.vestibuleChainLength(node) < 2) {
      const turns: (0 | 1 | 3)[] = rng.shuffle([0, 1, 3]);
      for (const len of [4, 6, 8, 3, 2]) {
        for (const turn of turns) {
          const ad = this.adapterNode('vestibule', depth, entryReq, paletteFrom, 0, turn, len);
          if (this.tryPlace(ad, pos, dir, ignore)) {
            this.link(node, portal, ad);
            this.finalize(ad, node, portal, true);
            created.push(ad.roomId);
            return true;
          }
          this.layouts.delete(ad.roomId);
        }
      }
    }
    this.lockPortal(portal);
    return false;
  }

  /**
   * Legendary 巨大部屋の遠方配置: 扉の外に前室（4/3/2 m）を置き、その end を意図的 Seam にして部屋を遠方（tryPlaceFree 広域）へ置く。
   * 前室も入らなければ扉そのものを Seam にする。部屋の entry は戻りではない（一方通行。部屋の entry 扉は通常の出口として抽選される）
   */
  private tryPlaceLegendaryFar(node: RoomInstance, portal: Portal, room: RoomInstance, pos: Vec3, dir: Dir, created: string[], depth: number, entryReq: EntryReq, rng: Rng): boolean {
    const paletteFrom = node.isAdapter ? node.adapter!.paletteFrom : node.roomId;
    let via: RoomInstance | null = null;
    const turns: (0 | 1 | 3)[] = rng.shuffle([0, 1, 3]);
    outer: for (const len of [4, 3, 2]) {
      for (const turn of turns) {
        const ad = this.adapterNode('vestibule', depth, entryReq, paletteFrom, 0, turn, len);
        if (this.tryPlaceAdapterNoExitCheck(ad, pos, dir)) {
          via = ad;
          break outer;
        }
        this.layouts.delete(ad.roomId);
      }
    }
    const near = via ? toWorld(via.placement!, this.socketOf(via, 'end').pos) : pos;
    if (!this.tryPlaceFarVariants(room, [near[0], near[1], near[2]])) {
      if (via) {
        this.worldBounds.delete(via.roomId);
        this.layouts.delete(via.roomId);
      }
      return false;
    }
    let seamPortal = portal;
    let owner = node;
    if (via) {
      this.link(node, portal, via);
      this.finalize(via, node, portal, true);
      created.push(via.roomId);
      seamPortal = via.portals.find((p) => p.portalId === 'end')!;
      owner = via;
    }
    room.entryIsReturn = false;
    room.parentRoomId = owner.roomId;
    room.entryPortalId = seamPortal.portalId;
    const layout = this.layoutFor(room);
    room.portals = this.makePortals(layout, false);
    const hs = layout.sockets.find((s) => s.id === 'hole' && s.type === 'hole');
    if (hs) {
      room.holeLocal = [hs.pos[0], hs.pos[1], hs.pos[2]];
      this.layouts.delete(room.roomId);
    }
    this.graph.add(room);
    {
      // 遠方配置でも多層の Mega / Street には levelSpan を付ける（上階出口の先の部屋が地図で浮かないように。finalize と同じ）
      const wb = this.worldBounds.get(room.roomId)!;
      const span = this.levelSpanFor(room, wb);
      room.mapCell = this.projector.assign(room.roomId, wb, owner.mapCell ?? null, 0, true, span > 1 ? { levelSpan: span } : undefined);
    }
    seamPortal.seam = true;
    seamPortal.open = false;
    seamPortal.targetRoomId = room.roomId;
    seamPortal.targetPortalId = 'entry';
    seamPortal.projected = false;
    created.push(room.roomId);
    this.log.push(`INFO legendary far placement ${owner.roomId}/${seamPortal.portalId} -> ${room.roomId} (${room.definitionId}${via ? ', via vestibule' : ''})`);
    return true;
  }

  /** Adapter を hasFreeExit 無しで配置する（end が Seam になる前室用） */
  private tryPlaceAdapterNoExitCheck(ad: RoomInstance, anchorPos: Vec3, anchorDir: Dir): boolean {
    this.layouts.delete(ad.roomId);
    const layout = this.layoutFor(ad);
    const entry = layout.sockets.find((x) => x.id === 'entry')!;
    const placement = this.placementFor(anchorPos, anchorDir, entry);
    const wb = aabbToWorld(layout.bounds, placement);
    if (!this.fits(wb, new Set())) return false;
    ad.placement = placement;
    this.worldBounds.set(ad.roomId, wb);
    return true;
  }

  // ------------------------------------------------------------ 部屋同士の直結
  /** ワールド点 pos から dir 方向 0.3m 先に、同じ階の別の部屋（レイアウト変更可）の外壁があるか */
  private findWallBehind(selfId: string, pos: Vec3, dir: Dir, floorY: number): { node: RoomInstance; span: WallSpan; t: number; localDir: Dir } | null {
    const dv = dirVec(dir);
    const probe: Vec3 = [pos[0] + dv[0] * 0.3, floorY + 1.0, pos[2] + dv[2] * 0.3];
    for (const [id, b] of this.worldBounds) {
      if (id === selfId || !aabbContains(b, probe)) continue;
      const other = this.graph.get(id);
      if (other.isAdapter || !other.placement) return null;
      if (!this.canRelayout(other)) return null;
      if (Math.abs(other.placement.position[1] - floorY) > 0.3) return null;
      const lay = this.layoutFor(other);
      if (lay.footprint.length === 0) return null;
      const local = toLocal(other.placement, pos);
      const localDir = addDir(addDir(dir, 2), -other.placement.yawQ);
      const spans = wallSpans(lay.footprint);
      const t = along(localDir, local[0], local[2]);
      const c = across(localDir, local[0], local[2]);
      const span = spans.find((sp) => sp.edge.dir === localDir && Math.abs(sp.edge.coord - c) < 0.08 && t >= sp.a0 + 0.7 && t <= sp.a1 - 0.7);
      if (!span) return null;
      // 既存ソケットとの間隔は生成器の tooClose（〜3.5 m）より広く取り、再生成で既存の出口が動かないようにする
      const clash = lay.sockets.some((s) => s.dir === localDir && Math.abs(across(localDir, s.pos[0], s.pos[2]) - c) < 0.08 && Math.abs(along(localDir, s.pos[0], s.pos[2]) - t) < SOCKET_GAP);
      if (clash) return null;
      return { node: other, span, t, localDir };
    }
    return null;
  }

  /** node の扉ソケットの外側に既存の部屋があれば、その壁に開口を作って直結する */
  private tryLinkExisting(node: RoomInstance, portal: Portal, pos: Vec3, dir: Dir): boolean {
    const hit = this.findWallBehind(node.roomId, pos, dir, node.placement!.position[1]);
    if (!hit) return false;
    const other = hit.node;
    if (other.roomId === node.parentRoomId) return false;
    if (node.portals.some((p) => p.targetRoomId === other.roomId)) return false;
    const sid = `x${other.extraSockets.length + 1}`;
    const s = socketOnSpan(sid, 'door', hit.span, hit.t, DOOR_W, DOOR_H);
    if (!this.addExtraSocketStable(other, s)) return false;
    other.portals.push({
      portalId: sid, type: 'door', socketId: sid, targetRoomId: node.roomId, targetPortalId: portal.portalId,
      locked: false, oneWay: false, seam: false, open: false, closeDelaySec: CLOSE_DELAY_SEC, isReturn: true, projected: true,
    });
    portal.targetRoomId = other.roomId;
    portal.targetPortalId = sid;
    return true;
  }

  /** 配置直後の部屋について、隣接する既存の部屋と壁を共有していれば扉で直結する（最大 2 本） */
  private addAdjacencyLinks(node: RoomInstance): void {
    const lay = this.layoutFor(node);
    if (lay.footprint.length === 0 || !node.placement) return;
    const rng = new Rng(node.seed).fork('adjacency');
    let added = 0;
    const spans = rng.shuffle(wallSpans(lay.footprint).filter((sp) => sp.a1 - sp.a0 >= 3.0));
    for (const sp of spans) {
      if (added >= 2) break;
      if (!rng.chance(0.6)) continue;
      const t = rng.float(sp.a0 + 1.2, sp.a1 - 1.2);
      const localPos: Vec3 = sp.edge.dir === 0 || sp.edge.dir === 2 ? [t, 0, sp.edge.coord] : [sp.edge.coord, 0, t];
      const current = this.layoutFor(node);
      if (current.sockets.some((s) => s.dir === sp.edge.dir && Math.abs(across(s.dir, s.pos[0], s.pos[2]) - sp.edge.coord) < 0.08 && Math.abs(along(s.dir, s.pos[0], s.pos[2]) - t) < SOCKET_GAP)) continue;
      const wpos = toWorld(node.placement, localPos);
      const wdir = addDir(sp.edge.dir, node.placement.yawQ);
      const hit = this.findWallBehind(node.roomId, wpos, wdir, node.placement.position[1]);
      if (!hit) continue;
      const other = hit.node;
      if (other.roomId === node.parentRoomId || node.portals.some((p) => p.targetRoomId === other.roomId)) continue;
      if (other.portals.some((p) => p.targetRoomId === node.roomId)) continue;
      const mine = `x${node.extraSockets.length + 1}`;
      const theirs = `x${other.extraSockets.length + 1}`;
      // 相手側は既に接続済みの出口があるので、再生成で動かないことを確認してから足す
      const theirSocket = socketOnSpan(theirs, 'door', hit.span, hit.t, DOOR_W, DOOR_H);
      if (!this.addExtraSocketStable(other, theirSocket)) continue;
      // 自分側も既存の出口（Portal 済み）が消えたり動いたりしないことを確認する
      if (!this.addExtraSocketStable(node, socketOnSpan(mine, 'door', sp, t, DOOR_W, DOOR_H))) {
        other.extraSockets = other.extraSockets.filter((x) => x !== theirSocket);
        this.layouts.delete(other.roomId);
        continue;
      }
      node.portals.push({
        portalId: mine, type: 'door', socketId: mine, targetRoomId: other.roomId, targetPortalId: theirs,
        locked: false, oneWay: false, seam: false, open: false, closeDelaySec: CLOSE_DELAY_SEC, isReturn: false, projected: true,
      });
      other.portals.push({
        portalId: theirs, type: 'door', socketId: theirs, targetRoomId: node.roomId, targetPortalId: mine,
        locked: false, oneWay: false, seam: false, open: false, closeDelaySec: CLOSE_DELAY_SEC, isReturn: true, projected: true,
      });
      this.layouts.delete(node.roomId);
      this.dirty.add(node.roomId);
      this.dirty.add(other.roomId);
      added++;
    }
  }

  // ------------------------------------------------------------ seam transitions
  /**
   * 意図的 Seam 扉の先を確定して配置する（hook の seam / Legendary 前室 / targetExisting / FarLink）。
   * 既に targetRoomId があればそこへ。無ければ hook が残した指示（forceDefinitionId / role / repeat）と opts で抽選し遠方に置く
   */
  resolveSeamTarget(node: RoomInstance, portal: Portal, opts: RollOptions = {}): { target: RoomInstance; spawn: Vec3; yaw: number } {
    if (portal.targetRoomId && this.graph.has(portal.targetRoomId)) {
      const t = this.graph.get(portal.targetRoomId);
      if (!t.placement) this.tryPlaceFarVariants(t, this.socketWorld(node, portal.socketId).pos);
      return { target: t, ...this.spawnPointOf(t) };
    }
    const stash = (node.state.localFlags[`seam:${portal.portalId}`] ?? {}) as ConnectDirective;
    const roll = this.pickOptsOf(stash, { ...opts });
    const room = this.rollRoomNode(node.depth + 1, { type: 'door', width: 1.0 }, false, `seam:${portal.portalId}`, roll);
    const near = this.socketWorld(node, portal.socketId).pos;
    if (!this.tryPlaceFree(room, near, new Set())) {
      if (!this.tryPlaceFree(room, near, new Set(), true)) this.tryPlaceFree(room, [near[0] + 200, near[1], near[2] + 200], new Set(), true);
    }
    room.entryIsReturn = false;
    this.graph.add(room);
    const layout = this.layoutFor(room);
    room.portals = this.makePortals(layout, false);
    room.parentRoomId = node.roomId;
    room.entryPortalId = portal.portalId;
    portal.targetRoomId = room.roomId;
    portal.targetPortalId = 'entry';
    {
      const wb = this.worldBounds.get(room.roomId)!;
      const span = this.levelSpanFor(room, wb);
      room.mapCell = this.projector.assign(room.roomId, wb, node.mapCell ?? null, 0, true, span > 1 ? { levelSpan: span } : undefined);
    }
    portal.projected = false;
    return { target: room, ...this.spawnPointOf(room) };
  }

  /** 部屋内の安全な出現位置（entry ソケットから 1.5m 内側。天井穴なら直下） */
  spawnPointOf(node: RoomInstance): { spawn: Vec3; yaw: number } {
    const p = node.placement!;
    const layout = this.layoutFor(node);
    let s = layout.sockets.find((x) => x.id === 'entry');
    if (!s) {
      // 開始部屋などで entry ソケットが取り除かれている場合: 最初のソケット、無ければ主矩形の中央
      s = layout.sockets.find((x) => x.type !== 'hole') ?? layout.sockets[0];
      if (!s) {
        const r = layout.footprint[0];
        const w = toWorld(p, [(r.x0 + r.x1) / 2, 0.05, (r.z0 + r.z1) / 2]);
        return { spawn: w, yaw: yawFor(addDir(0, p.yawQ)) };
      }
    }
    if (s.type === 'hole') {
      const w = toWorld(p, [s.pos[0], 0.05, s.pos[2]]);
      return { spawn: w, yaw: yawFor(addDir(0, p.yawQ)) };
    }
    const inward: Vec3 = [-(s.dir === 1 ? 1 : s.dir === 3 ? -1 : 0), 0, -(s.dir === 0 ? 1 : s.dir === 2 ? -1 : 0)];
    const local: Vec3 = [s.pos[0] + inward[0] * 1.5, s.pos[1] + 0.05, s.pos[2] + inward[2] * 1.5];
    const w = toWorld(p, local);
    const wdir = addDir(s.dir, p.yawQ);
    return { spawn: w, yaw: yawFor(addDir(wdir, 2)) };
  }

  /** エレベーター: 籠 Adapter + 先の部屋を別階層に配置する（閉扉 Seam） */
  resolveElevator(node: RoomInstance, portal: Portal): { car: RoomInstance; spawn: Vec3; yaw: number } {
    if (portal.targetRoomId && this.graph.has(portal.targetRoomId)) {
      const car = this.graph.get(portal.targetRoomId);
      return { car, ...this.spawnPointOf(car) };
    }
    const rng = new Rng(node.seed).fork(`elev:${portal.portalId}`);
    const { pos, dir } = this.socketWorld(node, portal.socketId);
    const car = this.adapterNode('elevatorCar', node.depth + 1, { type: 'elevator', width: 1.2 }, node.roomId, 1, 0, 0);
    const levels = rng.shuffle([1, -1, 2, -2, 3, -3]);
    let placed = false;
    for (const k of levels) {
      const anchor: Vec3 = [pos[0], pos[1] + k * FLOOR, pos[2]];
      const layout = this.layoutFor(car);
      const entry = layout.sockets.find((x) => x.id === 'entry')!;
      const placement = this.placementFor(anchor, dir, entry);
      const wb = aabbToWorld(layout.bounds, placement);
      if (this.fits(wb, new Set())) {
        car.placement = placement;
        this.worldBounds.set(car.roomId, wb);
        placed = true;
        break;
      }
    }
    if (!placed) this.tryPlaceFree(car, pos, new Set());
    this.link(node, portal, car);
    this.finalize(car, node, portal, true);
    const back = car.portals.find((p) => p.portalId === 'entry')!;
    back.seam = true;
    back.open = true;
    portal.projected = false;
    this.ensureNeighbors(car.roomId);
    return { car, ...this.spawnPointOf(car) };
  }

  /**
   * 乗り物（VehicleRide, Q5 = C）: 乗車 Portal の先に 'platform' Adapter（到着ホーム）を遠方に置き、その先の部屋を確定する。
   * 呼び出し側（Modifier）が durationSec の車内演出の後に spawn へテレポートする。乗車 Portal は一方通行の Seam（far / ride）
   */
  resolveRide(node: RoomInstance, portal: Portal): { platform: RoomInstance; spawn: Vec3; yaw: number } {
    if (portal.targetRoomId && this.graph.has(portal.targetRoomId)) {
      const platform = this.graph.get(portal.targetRoomId);
      return { platform, ...this.spawnPointOf(platform) };
    }
    const socket = this.socketOf(node, portal.socketId);
    const { pos } = this.socketWorld(node, portal.socketId);
    const platform = this.adapterNode('platform', node.depth + 1, { type: socket.type, width: socket.width, height: socket.height }, node.roomId, 0, 0, 0);
    if (!this.tryPlaceFree(platform, [pos[0] + 120, pos[1], pos[2] + 120], new Set(), true)) this.tryPlaceFree(platform, [pos[0] + 300, pos[1], pos[2] - 300], new Set(), true);
    this.link(node, portal, platform);
    this.finalize(platform, node, portal, true);
    const back = platform.portals.find((p) => p.portalId === 'entry')!;
    // ホーム側の乗降口は戻れない（乗り物は去る）
    back.seam = true;
    back.locked = true;
    back.open = false;
    portal.seam = true;
    portal.far = true;
    portal.ride = true;
    portal.projected = false;
    this.ensureNeighbors(platform.roomId);
    this.log.push(`INFO ride ${node.roomId}/${portal.portalId} -> ${platform.roomId}`);
    return { platform, ...this.spawnPointOf(platform) };
  }
}
