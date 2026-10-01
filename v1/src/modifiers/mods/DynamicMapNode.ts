/**
 * DynamicMapNode — 移動座標室（M03, swapIntervalSec 45）/ 動くマップタイル（M07, 20）。一定時間ごとにグラフ上の接続先を交換する。
 * params: swapIntervalSec。
 *
 * swap は Seam（仕様 3.3。swap 対象は未探索エッジのみ。戻りエッジと開始点への到達可能性は不変）:
 *   onConnect : 戻り以外の扉型 Portal を全て意図的 Seam にし、pending 定義（forceDefinitionId）を ctx.rng で事前抽選する
 *               （ObservationRewire と同じ仕組み。WorldManager が localFlags['seam:<portalId>'] に stash）。
 *   layout    : 各前進扉の上に電子サイン（emissive、id 'rewire:<socketId>'）。文字は build で pending の部屋名にする。
 *   update    : プレイヤーが部屋にいる間だけ計時し、swapIntervalSec ごとに「未通過（targetRoomId 無し）・閉扉・画面外」の Seam 扉が
 *               2 枚以上あれば fork(`swap:<n>`) で 2 枚選び pending 定義を交換（stash + サイン）。候補が足りない間は次のフレームで再試行する。
 *               通過済みの扉には targetRoomId が付くので以後 swap 対象外。地図表示は変えない（Seam 扉は元々「？」）。
 * pending / swapCount / log は node.state.modifierState.DynamicMapNode に保存（再生成・ロード後も同じ）。タイマーは保存しない（入室で 0 から）。
 * M07 は DynamicGridGenerator がスタブ（LargeRoom 代替）のまま同じ処理を動かす。MovingWalls は別担当。
 */
import type { RoomInstance } from '../../core/types';
import { Rng } from '../../core/rng';
import type { ModifierImpl } from '../types';
import { num } from '../util';
import {
  addDoorSigns, applyPendingSigns, definitionName, forwardDoorSockets, isDoorLikeType, modState, rollPendingDefinition, setSeamPending, signIdFor,
  unresolvedSeamDoors, viewOfDoor,
} from './ObservationRewire.seam';

const ID = 'DynamicMapNode';
const LOG_CAP = 64;

interface SwapLog {
  a: string;
  b: string;
  /** 秒（ctx.now を丸めたもの） */
  at: number;
}

interface SwapState extends Record<string, unknown> {
  pending: Record<string, string>;
  swapCount: number;
  log: SwapLog[];
}

const stateOf = (node: RoomInstance): SwapState => modState<SwapState>(node, ID, () => ({ pending: {}, swapCount: 0, log: [] }));

/** 滞在タイマー（runtime。秒） */
const timers = new WeakMap<RoomInstance, number>();

const DynamicMapNode: ModifierImpl = {
  id: ID,
  defaults: { swapIntervalSec: 45 },

  layout(L, p) {
    addDoorSigns(L, forwardDoorSockets(L, p), 'emissive');
  },

  onConnect(ctx) {
    const { portal, node } = ctx;
    if (portal.isReturn || !isDoorLikeType(portal.type)) return;
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
    timers.set(ctx.node, 0);
    applyPendingSigns(ctx.built, ctx.node, stateOf(ctx.node).pending);
  },

  onExit(ctx) {
    timers.delete(ctx.node);
  },

  update(dt, ctx, params) {
    const { node, world, camera } = ctx;
    if (ctx.game && ctx.game.currentRoomId !== node.roomId) return;
    const interval = Math.max(1, num(params.swapIntervalSec, 45));
    const doors = unresolvedSeamDoors(node);
    if (doors.length < 2) {
      timers.set(node, 0);
      return;
    }
    const t = (timers.get(node) ?? 0) + dt;
    if (t < interval) {
      timers.set(node, t);
      return;
    }
    // 候補: 閉扉かつ画面外。2 枚未満なら次のフレームで再試行（タイマーは interval で止める）
    const cands = doors.filter((p) => {
      if (p.open) return false;
      const v = viewOfDoor(world, node, p.socketId, camera);
      return !!v && !v.inFrustum;
    });
    if (cands.length < 2) {
      timers.set(node, interval);
      return;
    }
    const st = stateOf(node);
    const n = st.swapCount;
    const rng = new Rng(node.seed).fork(`swap:${n}`);
    const order = rng.shuffle([...cands].sort((x, y) => (x.portalId < y.portalId ? -1 : x.portalId > y.portalId ? 1 : 0)));
    const [a, b] = order;
    const pa = st.pending[a.portalId] ?? rollPendingDefinition(world, node.depth + 1, rng.fork('a')).id;
    const pb = st.pending[b.portalId] ?? rollPendingDefinition(world, node.depth + 1, rng.fork('b'), { exclude: pa }).id;
    st.pending[a.portalId] = pb;
    st.pending[b.portalId] = pa;
    st.swapCount = n + 1;
    st.log.push({ a: a.portalId, b: b.portalId, at: Math.round(ctx.now) });
    if (st.log.length > LOG_CAP) st.log.splice(0, st.log.length - LOG_CAP);
    setSeamPending(node, a.portalId, pb);
    setSeamPending(node, b.portalId, pa);
    ctx.built?.updateSign(signIdFor(a.socketId), definitionName(pb));
    ctx.built?.updateSign(signIdFor(b.socketId), definitionName(pa));
    timers.set(node, 0);
  },
};

export default DynamicMapNode;
