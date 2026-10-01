/**
 * RepeatDestination — 進行用扉の先を同じ定義へ repeatCount 回つないでから解放する（U18 反復エレベーター / R17 無限病棟）。
 * params: repeatCount。
 *
 * onConnect:
 *   R17（廊下）: 進行用扉 'end'（LoopTopology.shared.forwardSocket）で node.repeat（0 起点。WorldManager が RoomInstance に保存）を見て、
 *     残り回数があれば { forceDefinitionId: 自分の定義, role: 'repeat', repeat: index + 1 }。回数を超えたら指示なし（通常抽選 = 解放）。
 *     側面の扉は通常接続（= 節目の分岐）。物理配置は通常フロー（置けなければ前室 → 施錠で反復はそこで終わる）。
 *   U18（primaryPortal elevator）: 部屋自身の扉には指示を出さず、エレベーター籠 Adapter（adapter.kind 'elevatorCar'、paletteFrom = U18 の roomId）の
 *     'end' 接続で親 U18 の repeat を見て同じ指示を出す。※ Game.registerWorldHooks は Adapter（def null）で hook を呼ばないので、
 *     籠の 'end' で def を paletteFrom の部屋から解決してもらう依頼を phase2-requests.md に記載（それまで U18 は通常接続）。
 * 番号サイン: layout フックで入口脇に SignSpec（id 'rd:num'）を置き、build / update で反復回数に応じた文字に差し替える
 *   （R17 「病室 301〜320」→「321〜340」…、U18 「3 F」→「4 F」…。正解階のメカニクスは無い = D1/D2）。
 *   連番の初期値は鎖の先頭ノード（role 'repeat' でない同定義の祖先）の seed から決め、node.state.modifierState.RepeatDestination に
 *   { index, base, headRoomId } として保存する（再生成・ロード後も同じ）。ジオメトリは layout で確定、build / update は文字だけ変える。
 */
import type { RoomDefinition, RoomInstance } from '../../core/types';
import { Rng } from '../../core/rng';
import type { BuiltRoom } from '../../render/RoomBuilder';
import type { WorldManager } from '../../world/WorldManager';
import type { ModifierImpl } from '../types';
import { num } from '../util';
import { isForwardPortal, modState, saveModState, signBesideSocket } from './LoopTopology.shared';

const ID = 'RepeatDestination';
export const SIGN_ID = 'rd:num';

/** 保存する状態（JSON 化可能） */
export interface RepeatState {
  /** 何回目の反復か（0 = 先頭） */
  index: number;
  /** 番号の基数（先頭ノードの seed から。階 2〜7） */
  base: number;
  headRoomId: string;
}

/** 番号の基数（階数として 2〜7） */
function numberBase(headSeed: number): number {
  return new Rng(headSeed).fork('mod:RepeatDestination:base').int(2, 7);
}

/** サインの文字。U18 系（エレベーター）は階表示、病棟は病室番号帯、その他は通し番号 */
export function signText(def: RoomDefinition | null, base: number, index: number): string {
  if (def?.primaryPortal === 'elevator' || def?.generator === 'VerticalGenerator') return `${base + index} F`;
  if (def && /病/.test(def.category ?? '')) {
    const b = base * 100 + 1 + 20 * index;
    return `病室 ${b}〜${b + 19}`;
  }
  return `No. ${base * 100 + 1 + index}`;
}

/** 鎖の先頭（role 'repeat' でない同定義の祖先。Adapter は飛ばす） */
function headOf(world: WorldManager, node: RoomInstance): RoomInstance {
  let cur = node;
  const seen = new Set<string>([node.roomId]);
  while (cur.role === 'repeat') {
    let pid = cur.parentRoomId;
    let parent: RoomInstance | undefined;
    while (pid && !seen.has(pid) && world.graph.has(pid)) {
      seen.add(pid);
      const p = world.graph.get(pid);
      if (!p.isAdapter) { parent = p; break; }
      pid = p.parentRoomId;
    }
    if (!parent || parent.definitionId !== cur.definitionId) break;
    cur = parent;
  }
  return cur;
}

/** 状態を確定して保存する（既にあればそれを返す） */
function ensureState(world: WorldManager, node: RoomInstance): RepeatState {
  const st = modState<RepeatState>(node, ID);
  if (st && typeof st.base === 'number' && typeof st.index === 'number') return st;
  const head = headOf(world, node);
  const next: RepeatState = { index: node.repeat ?? 0, base: numberBase(head.seed), headRoomId: head.roomId };
  saveModState(node, ID, next);
  return next;
}

/** 文字を確定済みの構築（update で毎フレーム差し替えない） */
const applied = new WeakSet<BuiltRoom>();

const RepeatDestination: ModifierImpl = {
  id: ID,
  defaults: { repeatCount: 3 },

  onConnect(ctx) {
    const repeatCount = Math.max(0, Math.round(num(ctx.params.repeatCount, 3)));
    let parent: RoomInstance;
    let forward: boolean;
    if (ctx.node.isAdapter) {
      // エレベーター籠の 'end'（def は Game 側で paletteFrom の部屋から解決される前提）
      if (ctx.node.adapter?.kind !== 'elevatorCar') return;
      const pid = ctx.node.adapter.paletteFrom;
      if (!pid || !ctx.world.graph.has(pid)) return;
      parent = ctx.world.graph.get(pid);
      if (parent.definitionId !== ctx.def.id) return;
      forward = ctx.portal.portalId === 'end' && !ctx.portal.isReturn;
    } else {
      parent = ctx.node;
      // エレベーター部屋は籠の 'end' で反復する（壁の扉は通常接続 = 分岐）
      if (ctx.def.primaryPortal === 'elevator') return;
      forward = isForwardPortal(ctx);
    }
    if (!forward) return;
    const st = ensureState(ctx.world, parent);
    const index = parent.repeat ?? st.index;
    if (index >= repeatCount) return;
    return { forceDefinitionId: ctx.def.id, role: 'repeat', repeat: index + 1 };
  },

  layout(L, p, _params, rng) {
    const entry = L.sockets.find((s) => s.id === 'entry');
    if (!entry) return;
    // GenParams.node は統合側の任意拡張（あれば反復回数を初期文字に反映。無くても build / update で差し替える）
    const node = (p as { node?: RoomInstance }).node;
    const base = rng.int(2, 7);
    const kind = p.def.primaryPortal === 'elevator' ? 'emissive' : 'plate';
    const sign = signBesideSocket(L, entry, SIGN_ID, signText(p.def, base, node?.repeat ?? 0), kind, 1.2, 1.75);
    if (!sign) return;
    L.signs = [...(L.signs ?? []), sign];
  },

  build(built, _L, ctx) {
    const st = modState<RepeatState>(ctx.node, ID);
    const base = st?.base ?? numberBase(ctx.node.seed);
    const index = ctx.node.repeat ?? st?.index ?? 0;
    if (built.updateSign(SIGN_ID, signText(ctx.def, base, index)) && st) applied.add(built);
  },

  update(_dt, ctx) {
    const built = ctx.built;
    if (!built || applied.has(built)) return;
    const st = ensureState(ctx.world, ctx.node);
    built.updateSign(SIGN_ID, signText(ctx.def ?? null, st.base, ctx.node.repeat ?? st.index));
    applied.add(built);
  },
};

export default RepeatDestination;
