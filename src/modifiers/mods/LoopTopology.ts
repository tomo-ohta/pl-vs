/**
 * LoopTopology — 進行用扉を祖先の部屋へ戻る意図的 Seam にする（E01 閉ループ廊下 / L08 終着しない空港 / L11 環状モノレール都市）。
 * params: loopLength（登る段数。1 は自己ループ = 環状 footprint で表現するので何もしない）。
 *
 * onConnect（進行用扉 = 廊下 'end' / 入口から最遠の扉。LoopTopology.shared.forwardSocket）:
 *   parentRoomId を loopLength 段（Adapter は数えない）登った部屋を targetExisting にする（鎖が短ければ開始部屋）。
 *   WorldManager は portal.seam = far = true, targetRoomId = 祖先, targetPortalId = 'entry' にし物理配置しない。
 *   扉を開けた瞬間に Game が resolveSeamTarget → spawnPointOf(祖先) へフェード遷移する（閉ループ: 直進で開始点側へ戻る）。
 *   側面の扉は通常接続（= ループ外の扉）。祖先が 1 つも無い（自分が開始部屋）ときは指示なし（自己 Seam は WorldManager が拒否する）。
 * 決定論: 乱数を使わない（レイアウトとグラフの祖先だけで決まる）。選んだ扉と行き先は node.state.modifierState.LoopTopology に保存する。
 * L11（loopLength 1）は MegaStructure の環状 footprint そのもので満たし、グラフ辺の自己接続は作らない（implementation-analysis 前提）。
 */
import type { ModifierImpl } from '../types';
import { num } from '../util';
import { ancestorOf, isForwardPortal, saveModState } from './LoopTopology.shared';

const ID = 'LoopTopology';

/** 保存する状態（JSON 化可能） */
export interface LoopState {
  /** ループ辺にした Portal id */
  loopEdgeId: string;
  /** 戻り先（祖先）の roomId */
  targetRoomId: string;
  /** 実際に登れた段数 */
  climbed: number;
}

const LoopTopology: ModifierImpl = {
  id: ID,
  defaults: { loopLength: 3 },

  onConnect(ctx) {
    const loopLength = Math.max(0, Math.round(num(ctx.params.loopLength, 3)));
    // loopLength 1（L11）: 環状 footprint 側の表現。自己ループの Seam は作らない
    if (loopLength <= 1) return;
    if (!isForwardPortal(ctx)) return;
    const target = ancestorOf(ctx.world, ctx.node, loopLength);
    if (!target || target.roomId === ctx.node.roomId || !ctx.world.graph.has(target.roomId)) return;
    // 祖先の入口が無い（あり得ないが hole 入口の部屋は spawnPointOf が直下に出すので可）
    const st: LoopState = { loopEdgeId: ctx.portal.portalId, targetRoomId: target.roomId, climbed: Math.max(1, Math.min(loopLength, ctx.node.depth - target.depth)) };
    saveModState(ctx.node, ID, st);
    return { targetExisting: target.roomId, seam: true, far: true };
  },
};

export default LoopTopology;
