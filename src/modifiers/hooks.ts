/**
 * Modifier のフックを WorldManager に配線する（Game.registerWorldHooks と tools/seam-stats.mjs が共用。DOM 非依存）。
 *
 * - nodeHooks: ノード生成直後に notifyNodeCreated（onNodeCreated。localFlags / modifierState の初期化）。
 * - connectHooks: 接続抽選の直前に collectConnectDirective（onConnect）を呼び、modifiers/types.ts の ConnectDirective を
 *   WorldManager の ConnectDirective へ写す（prefer は 'room' / 'corridor' だけ、lock / skip は施錠、far は targetExisting / seam に含意）。
 * - エレベーター籠 Adapter（kind 'elevatorCar'）の 'end' は、籠を出した部屋（paletteFrom）の定義で onConnect を呼ぶ
 *   （RepeatDestination U18: 籠の先を同じ定義に固定して反復）。他の Modifier は Adapter からの呼び出しを想定していないので
 *   RepeatDestination を持つ定義に限定する。
 */
import { Rng } from '../core/rng';
import type { ConnectDirective as WorldDirective, WorldManager } from '../world/WorldManager';
import { collectConnectDirective, hasModifier, notifyNodeCreated } from './index';

export function installWorldHooks(world: WorldManager): void {
  world.nodeHooks.push((node, def, w) => notifyNodeCreated(node, def, w));
  world.connectHooks.push((ctx) => {
    let def = ctx.def;
    if (!def && ctx.node.isAdapter && ctx.node.adapter?.kind === 'elevatorCar' && ctx.world.graph.has(ctx.node.adapter.paletteFrom)) {
      const parentDef = ctx.world.definitionOf(ctx.world.graph.get(ctx.node.adapter.paletteFrom));
      if (hasModifier(parentDef, 'RepeatDestination')) def = parentDef;
    }
    if (!def) return;
    const socket = ctx.world.socketOf(ctx.node, ctx.portal.socketId);
    const rng = new Rng(ctx.node.seed).fork(`connect:${ctx.portal.portalId}`);
    const d = collectConnectDirective({ world: ctx.world, node: ctx.node, def, portal: ctx.portal, socket, depth: ctx.depth, rng });
    if (!d) return;
    const out: WorldDirective = {};
    if (d.forceDefinitionId) out.forceDefinitionId = d.forceDefinitionId;
    const prefer = d.prefer?.find((x) => x === 'room' || x === 'corridor');
    if (prefer) out.prefer = prefer;
    if (d.seam) out.seam = true;
    if (d.lock || d.skip) out.lock = true;
    if (d.smallOnly) out.smallOnly = true;
    if (d.roomLikeOnly) out.roomLikeOnly = true;
    if (d.role) out.role = d.role;
    if (d.targetExisting) out.targetExisting = d.targetExisting;
    if (d.repeat !== undefined) out.repeat = d.repeat;
    return out;
  });
}
