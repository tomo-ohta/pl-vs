/**
 * MapErase — 地図から部屋を消す（M02 未記録室）。表示側（DisplayedMap）だけを変え、RoomGraph・発見数（visitedCount）は触らない。
 * params: hidePolicy
 *   'self'                （既定。M02 の設定値）この部屋自身を消す。中にいる間はミニマップが破線の外形だけを描き、退室後は何も残らない。
 *   'visitedExceptCurrent' 現在の部屋以外の訪問済み部屋（Adapter を含む）を全部消す。
 *   'random50'             現在の部屋以外で未消去の訪問済み部屋の半分（切り上げ）を消す。抽選は node.seed の fork で決定論。
 *   'none'                 何もしない。
 *
 * onEnter : hidePolicy に従って消す部屋を決め、node.state.modifierState.MapErase = { policy, mapErased[], entries } に保存（union。消えたまま）。
 *           その上で ctx.game.mapView.hiddenRoomIds（新しい Set に差し替える。MapPanel は参照比較で再描画する）と
 *           各ノードの mapCell.hidden = true（保存に乗るので、ロード直後に M02 へ再入室しなくても消えたまま）に書く。
 *           入るたびに再評価するので、visitedExceptCurrent / random50 は再入室でさらに消える（消えた部屋が戻ることはない）。
 * onExit  : 戻さない。保存済みの集合をもう一度 mapView に適用するだけ（idempotent）。
 * ロード後: onEnter 時にグラフ内の全 M02 ノードの modifierState を union して復元する（mapView は newWorld / load で空に戻るため）。
 * ジオメトリ・接続・乱数列（レイアウト段階）には一切影響しない。
 */
import { Rng } from '../../core/rng';
import type { RoomInstance } from '../../core/types';
import type { ModifierImpl, RuntimeContext } from '../types';
import { str } from '../util';

const ID = 'MapErase';

type HidePolicy = 'self' | 'visitedExceptCurrent' | 'random50' | 'none';

/** modifierState.MapErase に保存する値（JSON 化可能な型のみ） */
interface EraseState {
  policy: HidePolicy;
  /** 消した部屋 id（union。戻さない） */
  mapErased: string[];
  /** onEnter の回数（random50 の乱数 fork に使う） */
  entries: number;
}

function policyOf(v: unknown): HidePolicy {
  const s = str(v, 'self');
  return s === 'visitedExceptCurrent' || s === 'random50' || s === 'none' ? s : 'self';
}

function readState(node: RoomInstance | undefined): EraseState | undefined {
  const s = node?.state?.modifierState?.[ID] as Partial<EraseState> | undefined;
  if (!s || !Array.isArray(s.mapErased)) return undefined;
  return { policy: policyOf(s.policy), mapErased: s.mapErased.filter((x): x is string => typeof x === 'string'), entries: typeof s.entries === 'number' ? s.entries : 0 };
}

function writeState(node: RoomInstance, st: EraseState): void {
  (node.state.modifierState ??= {})[ID] = { policy: st.policy, mapErased: [...st.mapErased], entries: st.entries };
}

/** 現在の部屋以外の訪問済み部屋（Adapter を含む）。順序は roomId 昇順で決定論 */
function visitedOthers(ctx: RuntimeContext): string[] {
  const out: string[] = [];
  for (const n of ctx.world.graph.nodes.values()) {
    if (n.roomId === ctx.node.roomId || !n.visited) continue;
    out.push(n.roomId);
  }
  return out.sort();
}

/** この入室で新たに消す部屋を決める */
function decide(ctx: RuntimeContext, policy: HidePolicy, already: ReadonlySet<string>, entries: number): string[] {
  switch (policy) {
    case 'self':
      return [ctx.node.roomId];
    case 'visitedExceptCurrent':
      return visitedOthers(ctx);
    case 'random50': {
      const pool = visitedOthers(ctx).filter((id) => !already.has(id));
      if (pool.length === 0) return [];
      const rng = new Rng(ctx.node.seed).fork(`mod:${ID}`).fork(entries);
      rng.shuffle(pool);
      return pool.slice(0, Math.ceil(pool.length / 2));
    }
    case 'none':
    default:
      return [];
  }
}

/** グラフ内の全 MapErase ノードの保存済み集合を union する（ロード直後の復元） */
function collectAllErased(ctx: RuntimeContext): Set<string> {
  const all = new Set<string>();
  for (const n of ctx.world.graph.nodes.values()) {
    const s = readState(n);
    if (!s) continue;
    for (const id of s.mapErased) all.add(id);
  }
  return all;
}

/** mapView.hiddenRoomIds と mapCell.hidden に反映する。既に消えている部屋は戻さない */
function applyHidden(ctx: RuntimeContext, ids: Iterable<string>): void {
  const mv = ctx.game?.mapView;
  const next = new Set<string>(mv?.hiddenRoomIds ?? []);
  let changed = !mv?.hiddenRoomIds;
  for (const id of ids) {
    if (!next.has(id)) {
      next.add(id);
      changed = true;
    }
    const n = ctx.world.graph.nodes.get(id);
    if (n?.mapCell && !n.mapCell.hidden) n.mapCell.hidden = true;
  }
  // 新しい Set に差し替える（MapPanel.setView は参照の変化で再描画する。ミニマップは毎フレーム参照する）
  if (mv && changed) mv.hiddenRoomIds = next;
}

const MapErase: ModifierImpl = {
  id: ID,
  defaults: { hidePolicy: 'self' },

  onEnter(ctx, params) {
    const node = ctx.node;
    const policy = policyOf(params.hidePolicy);
    const prev = readState(node);
    const st: EraseState = prev ?? { policy, mapErased: [], entries: 0 };
    st.policy = policy;
    const already = new Set(st.mapErased);
    for (const id of decide(ctx, policy, already, st.entries)) {
      if (!already.has(id)) {
        already.add(id);
        st.mapErased.push(id);
      }
    }
    st.entries += 1;
    writeState(node, st);
    // この部屋の分 + 他の M02 ノードの保存済み分（ロード直後の復元）
    const all = collectAllErased(ctx);
    for (const id of st.mapErased) all.add(id);
    applyHidden(ctx, all);
  },

  onExit(ctx) {
    // 戻さない。保存済みの集合を念のためもう一度適用する（消えたまま）
    applyHidden(ctx, collectAllErased(ctx));
  },
};

export default MapErase;
