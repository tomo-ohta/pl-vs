/**
 * FarLink — グラフ距離の遠い既訪ノードへ一方通行の Seam で直結する（M08 不可能なショートカット。v1.3 D18 で使用部屋は M08 のみ）。
 * params: minGraphDistance（既定 30）。
 *
 * 行き先の選定（グラフ状態に依存するので 1 回だけ決めて node.state.modifierState.FarLink に保存。再生成・ロード後も同じ）:
 *   候補 = visited かつ Adapter でなく配置済みのノード（自分と直近の親を除く）。world.graph.undirectedDistances(自分)（無向） で
 *   距離 >= minGraphDistance → 無ければ >= 10 → 無ければ最遠（距離 2 以上）の順に絞り、Rng(node.seed).fork('mod:FarLink:target') で 1 つ選ぶ。
 *   ノード生成直後（onNodeCreated）はまだ親と繋がっておらず距離が測れないので、最初の onConnect（親と繋がり配置済み）で確定する。
 * onConnect（進行用扉 = 入口から最遠の扉。LoopTopology.shared.forwardSocket）: { targetExisting, seam, far }。
 *   WorldManager が portal.seam = far = true, targetRoomId = 行き先, targetPortalId = 'entry', projected = false（地図は「？」）にする。
 *   扉を開けると Game が resolveSeamTarget → spawnPointOf(行き先) へフェード遷移。戻り Portal は無い（既訪部屋は frozen で開口を増やせない。
 *   行き先は既訪なので通常経路で歩いて戻れる）。候補が無ければ指示なし = 通常接続。側面の扉は通常接続。
 */
import { Rng } from '../../core/rng';
import type { RoomInstance } from '../../core/types';
import type { WorldManager } from '../../world/WorldManager';
import type { ModifierImpl } from '../types';
import { num } from '../util';
import { isForwardPortal, modState, saveModState } from './LoopTopology.shared';

const ID = 'FarLink';

/** 保存する状態（JSON 化可能） */
export interface FarLinkState {
  /** 行き先を決めたか（候補無しでも true にして再抽選しない） */
  resolved: boolean;
  /** 行き先 roomId（候補無しは null） */
  targetRoomId: string | null;
  /** 選んだときのグラフ距離 */
  distance?: number;
  /** Seam 化した Portal id */
  portalId?: string;
}

/** 行き先を選ぶ（候補が無ければ null） */
export function pickFarTarget(world: WorldManager, node: RoomInstance, minGraphDistance: number): { roomId: string; distance: number } | null {
  const cands: { roomId: string; distance: number }[] = [];
  // 無向距離（一方通行の Seam・穴も逆向きに辿る。有向 BFS では Legendary 遠方配置の手前へ戻れず候補が近いものだけになった）
  const dist = world.graph.undirectedDistances(node.roomId);
  for (const n of world.graph.nodes.values()) {
    if (n.roomId === node.roomId || n.isAdapter || !n.visited || !n.placement) continue;
    const d = dist.get(n.roomId) ?? Infinity;
    if (!Number.isFinite(d) || d < 2) continue;
    cands.push({ roomId: n.roomId, distance: d });
  }
  if (cands.length === 0) return null;
  let pool = cands.filter((c) => c.distance >= minGraphDistance);
  if (pool.length === 0) pool = cands.filter((c) => c.distance >= 10);
  if (pool.length === 0) {
    const far = Math.max(...cands.map((c) => c.distance));
    pool = cands.filter((c) => c.distance === far);
  }
  // roomId 順に並べてから抽選（Map の走査順に依存しない）
  pool.sort((a, b) => (a.roomId < b.roomId ? -1 : a.roomId > b.roomId ? 1 : 0));
  return new Rng(node.seed).fork('mod:FarLink:target').pick(pool);
}

const FarLink: ModifierImpl = {
  id: ID,
  defaults: { minGraphDistance: 30 },

  onNodeCreated(node) {
    if (!modState<FarLinkState>(node, ID)) saveModState(node, ID, { resolved: false, targetRoomId: null } satisfies FarLinkState);
  },

  onConnect(ctx) {
    if (!isForwardPortal(ctx)) return;
    const minD = Math.max(1, Math.round(num(ctx.params.minGraphDistance, 30)));
    let st = modState<FarLinkState>(ctx.node, ID);
    if (!st || !st.resolved) {
      const picked = pickFarTarget(ctx.world, ctx.node, minD);
      st = { resolved: true, targetRoomId: picked?.roomId ?? null, distance: picked?.distance, portalId: ctx.portal.portalId };
      saveModState(ctx.node, ID, st);
    }
    if (!st.targetRoomId || !ctx.world.graph.has(st.targetRoomId) || st.targetRoomId === ctx.node.roomId) return;
    return { targetExisting: st.targetRoomId, seam: true, far: true };
  },
};

export default FarLink;
