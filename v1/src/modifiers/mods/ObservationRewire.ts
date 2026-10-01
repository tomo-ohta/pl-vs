/**
 * ObservationRewire — 観測依存廊下（E07）。カメラ外になった扉の接続先を再抽選する。
 * params: rewireRate（観測→非観測の遷移 1 回あたりの再配線確率。既定 0.5）, maxRewires（1 扉あたりの上限。既定 3）。
 *
 * 再配線は Seam（仕様 3.3）:
 *   onConnect : 戻り以外の扉型 Portal を全て意図的 Seam にする（物理隣接は置かない）。pending 定義を ctx.rng で 1 つ抽選し
 *               { seam: true, forceDefinitionId } を返す → WorldManager が localFlags['seam:<portalId>'] に stash する。
 *               行き先ノードは作らない（resolveSeamTarget が初回通過時に pending 定義で抽選・配置する）。
 *   layout    : 各前進扉の上に銘板サイン（id 'rewire:<socketId>'）。文字は build で pending の部屋名に差し替える。
 *   update    : プレイヤーがこの部屋にいる間、未通過の Seam 扉ごとに「画面内 → 画面外かつ背後」の遷移を追跡し、
 *               遷移した瞬間に fork(`rewire:<portalId>:<k>`).chance(rewireRate) で再配線判定（k = その扉の判定回数）。
 *               成立なら pending 定義を差し替え（stash の forceDefinitionId + サイン）、modifierState.log に記録する。
 *               通過済み（targetRoomId あり）の扉は対象外。物理配置済みのサブツリーは削除しない。
 * グラフ状態に依存する pending / 判定回数 / 再配線回数は node.state.modifierState.ObservationRewire に保存（再生成・ロード後も同じ）。
 * 乱数はレイアウト・接続段階では渡された rng、update の判定は node.seed 由来の fork のみ（観測のタイミングだけがプレイヤー依存）。
 */
import type { RoomInstance } from '../../core/types';
import { Rng } from '../../core/rng';
import type { ModifierImpl } from '../types';
import { num } from '../util';
import {
  addDoorSigns, applyPendingSigns, definitionName, forwardDoorSockets, isDoorLikeType, modState, rollPendingDefinition, setSeamPending, signIdFor,
  unresolvedSeamDoors, viewOfDoor,
} from './ObservationRewire.seam';

const ID = 'ObservationRewire';
const LOG_CAP = 64;

interface RewireLog {
  portalId: string;
  from: string;
  to: string;
  /** 秒（ctx.now を丸めたもの。演出ログなので決定論の対象外） */
  at: number;
}

interface RewireState extends Record<string, unknown> {
  /** portalId → pending 定義 id（Seam 初回通過時の forceDefinitionId と一致） */
  pending: Record<string, string>;
  /** portalId → 再配線判定を行った回数（乱数 fork のタグ） */
  attempts: Record<string, number>;
  /** portalId → 成立した再配線回数（maxRewires で打ち止め） */
  rewires: Record<string, number>;
  log: RewireLog[];
}

const stateOf = (node: RoomInstance): RewireState => modState<RewireState>(node, ID, () => ({ pending: {}, attempts: {}, rewires: {}, log: [] }));

/** 観測追跡（runtime。ノードごとに portalId → 直前フレームで観測中だったか） */
const observed = new WeakMap<RoomInstance, Map<string, boolean>>();

const ObservationRewire: ModifierImpl = {
  id: ID,
  defaults: { rewireRate: 0.5, maxRewires: 3 },

  layout(L, p) {
    addDoorSigns(L, forwardDoorSockets(L, p), 'plate');
  },

  onConnect(ctx) {
    const { portal, node } = ctx;
    if (portal.isReturn || !isDoorLikeType(portal.type)) return;
    // 直結で後から足された壁面ソケット（xN）は物理接続のまま
    if (node.extraSockets.some((s) => s.id === portal.socketId)) return;
    const st = stateOf(node);
    const prefer = ctx.def.generator === 'CorridorGenerator' ? 'room' : 'corridor';
    const defId = st.pending[portal.portalId] ?? rollPendingDefinition(ctx.world, ctx.depth, ctx.rng, { prefer }).id;
    st.pending[portal.portalId] = defId;
    return { seam: true, forceDefinitionId: defId };
  },

  build(built, _L, ctx) {
    applyPendingSigns(built, ctx.node, stateOf(ctx.node).pending);
  },

  onEnter(ctx) {
    observed.delete(ctx.node);
    applyPendingSigns(ctx.built, ctx.node, stateOf(ctx.node).pending);
  },

  update(_dt, ctx, params) {
    const { node, world, camera } = ctx;
    if (ctx.game && ctx.game.currentRoomId !== node.roomId) return;
    const doors = unresolvedSeamDoors(node);
    if (doors.length === 0) return;
    const rate = Math.min(1, Math.max(0, num(params.rewireRate, 0.5)));
    const maxRewires = Math.max(0, Math.floor(num(params.maxRewires, 3)));
    let seen = observed.get(node);
    if (!seen) {
      seen = new Map();
      observed.set(node, seen);
    }
    const st = stateOf(node);
    for (const p of doors) {
      const view = viewOfDoor(world, node, p.socketId, camera);
      if (!view) continue;
      // 「画面外かつ背後」だけを非観測とみなす
      const isObserved = view.inFrustum || !view.behind;
      const was = seen.get(p.portalId);
      seen.set(p.portalId, isObserved);
      if (was === undefined || !was || isObserved) continue;
      if (p.open) continue;
      // 観測 → 非観測の遷移: 判定は 1 遷移につき 1 回。乱数列は node.seed 由来なので同じ回数目なら同じ結果
      const k = st.attempts[p.portalId] ?? 0;
      st.attempts[p.portalId] = k + 1;
      if ((st.rewires[p.portalId] ?? 0) >= maxRewires) continue;
      const rng = new Rng(node.seed).fork(`rewire:${p.portalId}:${k}`);
      if (!rng.chance(rate)) continue;
      const from = st.pending[p.portalId] ?? '';
      const prefer = ctx.def?.generator === 'CorridorGenerator' ? 'room' : 'corridor';
      const def = rollPendingDefinition(world, node.depth + 1, rng.fork('def'), { prefer, exclude: from });
      if (def.id === from) continue;
      st.pending[p.portalId] = def.id;
      st.rewires[p.portalId] = (st.rewires[p.portalId] ?? 0) + 1;
      st.log.push({ portalId: p.portalId, from, to: def.id, at: Math.round(ctx.now) });
      if (st.log.length > LOG_CAP) st.log.splice(0, st.log.length - LOG_CAP);
      setSeamPending(node, p.portalId, def.id);
      ctx.built?.updateSign(signIdFor(p.socketId), definitionName(def.id));
    }
  },
};

export default ObservationRewire;
