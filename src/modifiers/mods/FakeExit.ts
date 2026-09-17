/**
 * FakeExit — 進行用扉の先を「開始部屋風」の部屋にし、到着時に偽エンディングの一言を HUD に出す（M04 偽帰還口）。
 * params: returnDepth（データ互換のため受け取るが v1.3 では未使用。行き先は開始部屋の定義に固定）, showEndingOverlay。
 *
 * onConnect（進行用扉 = 入口から最遠の扉。LoopTopology.shared.forwardSocket）:
 *   { forceDefinitionId: 開始部屋の定義（world.graph の最初の部屋ノード。通常 r1 = C02）, role: 'fakeStart' }。
 *   物理配置は通常フロー（Seam ではない）。到着先は新しい RoomNode なので発見数に数える。側面の扉は通常接続。
 * 演出（showEndingOverlay）: 終了条件は無い（D3）ので HUD ヒントだけ。到着先（role 'fakeStart'）の定義は FakeExit を持たないため
 *   onEnter は M04 側でしか走らない。そこで M04 の update（到着直後は M04 が 1 hop の可視部屋として残る）で
 *   game.currentRoomId が自分の子の 'fakeStart' 部屋になった瞬間を検出し、約 3 秒「— 終 —」、続けて 2.5 秒「発見 N 部屋 — 探索は続く」を出す。
 *   1 回だけ（node.state.modifierState.FakeExit.shown に保存。ロード後も再表示しない）。
 */
import type { RoomInstance } from '../../core/types';
import { ROOM_BY_ID } from '../../data';
import type { WorldManager } from '../../world/WorldManager';
import type { ModifierImpl } from '../types';
import { bool } from '../util';
import { isForwardPortal, modState, saveModState } from './LoopTopology.shared';

const ID = 'FakeExit';
const START_FALLBACK = 'C02';
const PHASE1_SEC = 3.0;
const PHASE2_SEC = 2.5;

/** 保存する状態（JSON 化可能） */
export interface FakeExitState {
  /** 偽出口にした Portal id */
  portalId?: string;
  /** 偽エンディングを表示済み */
  shown?: boolean;
}

/** 開始部屋の定義 ID（world.graph の最初の部屋ノード。ロード後も Map の挿入順 = 保存順で r1 が先頭） */
export function startDefinitionId(world: WorldManager): string {
  const r1 = world.graph.nodes.get('r1');
  if (r1 && !r1.isAdapter && ROOM_BY_ID.has(r1.definitionId)) return r1.definitionId;
  for (const n of world.graph.nodes.values()) {
    if (!n.isAdapter && ROOM_BY_ID.has(n.definitionId)) return n.definitionId;
  }
  return START_FALLBACK;
}

/** 表示中の演出（runtime。roomId → 開始時刻） */
const showing = new Map<string, number>();

/** 今いる部屋が「この M04 の子の偽開始部屋」か */
function arrivedFakeStart(world: WorldManager, node: RoomInstance, currentRoomId: string | null | undefined): RoomInstance | null {
  if (!currentRoomId || currentRoomId === node.roomId || !world.graph.has(currentRoomId)) return null;
  const cur = world.graph.get(currentRoomId);
  if (cur.role !== 'fakeStart') return null;
  // 親（Adapter を挟む場合は先の部屋）が自分か
  let pid = cur.parentRoomId;
  const seen = new Set<string>();
  while (pid && !seen.has(pid) && world.graph.has(pid)) {
    seen.add(pid);
    const p = world.graph.get(pid);
    if (!p.isAdapter) return p.roomId === node.roomId ? cur : null;
    pid = p.parentRoomId;
  }
  return null;
}

const FakeExit: ModifierImpl = {
  id: ID,
  defaults: { returnDepth: 3, showEndingOverlay: true },

  onConnect(ctx) {
    if (!isForwardPortal(ctx)) return;
    const defId = startDefinitionId(ctx.world);
    const st = modState<FakeExitState>(ctx.node, ID) ?? {};
    saveModState(ctx.node, ID, { ...st, portalId: ctx.portal.portalId } satisfies FakeExitState);
    return { forceDefinitionId: defId, role: 'fakeStart' };
  },

  update(_dt, ctx, params) {
    if (!bool(params.showEndingOverlay, true)) return;
    const key = ctx.node.roomId;
    const started = showing.get(key);
    if (started === undefined) {
      const st = modState<FakeExitState>(ctx.node, ID) ?? {};
      if (st.shown) return;
      if (!arrivedFakeStart(ctx.world, ctx.node, ctx.game?.currentRoomId)) return;
      saveModState(ctx.node, ID, { ...st, shown: true } satisfies FakeExitState);
      showing.set(key, ctx.now);
      ctx.hud.hint('— 終 —');
      return;
    }
    const t = ctx.now - started;
    if (t < PHASE1_SEC) {
      ctx.hud.hint('— 終 —');
    } else if (t < PHASE1_SEC + PHASE2_SEC) {
      ctx.hud.hint(`発見 ${ctx.world.graph.visitedCount} 部屋 — 探索は続く`);
    } else {
      showing.delete(key);
    }
  },
};

export default FakeExit;
