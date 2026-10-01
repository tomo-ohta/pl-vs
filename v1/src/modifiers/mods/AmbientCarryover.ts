/**
 * AmbientCarryover — 直前に訪問した部屋の環境（fog / ambient / 照明色 / 環境音）を写す（M18 天候記憶室）。
 * params: source: 'lastVisited'（既定。「直前に訪問した Rare 以上 → 無ければ直前訪問部屋」）| 既存の roomId（固定指定）。
 *
 * onNodeCreated（M18 ノード生成時 = 親に入室した時点）: world.graph.visitLog を新しい順に走査してコピー元を決め、
 *   コピー元の palette（light / lightColor / lightIntensity / ambient / fog）・render.fog（FogDepth）・audioPreset を
 *   node.state.modifierState.AmbientCarryover に JSON で固定する（再生成・ロード後も同じ。以後プレイヤーが別の部屋を訪れても変わらない）。
 * layout フック: GenParams に node が渡されていれば（統合担当への依頼: docs/phase2-requests.md）保存値を読んで L.palette / L.lights / 発光パネル /
 *   L.render.fog / L.fogFar を差し替える（SurfaceLighting の焼き込みにも反映）。床・壁・天井は SmallRoom のまま（観測室の形は保つ）。
 * build フック（フォールバック）: layout フックで適用できていなければ、同じ差し替えをキャッシュ済み RoomLayout と BuiltRoom に対して行う
 *   （palette.ambient / fog → Game.applyEnvironment、built.fog、PointLight の色。頂点の焼き込み色だけは反映されない）。
 * onEnter: ctx.audio.overridePreset(コピー元の audioPreset)。
 */
import type { RoomDefinition, RoomInstance } from '../../core/types';
import { RARITIES } from '../../core/types';
import type { MatId, RoomLayout } from '../../generators/layout';
import type { BuiltRoom } from '../../render/RoomBuilder';
import type { WorldManager } from '../../world/WorldManager';
import type { ModifierImpl, ModifierParams } from '../types';
import { str } from '../util';
import { LIGHT_MATS } from './EraPreset.shellSplit';

export const CARRYOVER_KEY = 'AmbientCarryover';

/** modifierState.AmbientCarryover に保存する値（JSON 化可能な型のみ） */
export interface CarryoverState {
  sourceRoomId: string;
  sourceDefinitionId: string;
  rarity: string;
  audioPreset: string;
  palette: { light: MatId; lightColor: number; lightIntensity: number; ambient: number; fog: number };
  fog?: { color: number; near: number; far: number };
  fogFar?: number;
  /** コピー元を決めた根拠（'rare' = 直前の Rare 以上 / 'last' = 直前訪問部屋 / 'param' = params.source の固定指定） */
  reason: 'rare' | 'last' | 'param';
}

function isRareOrAbove(def: RoomDefinition | null): boolean {
  return !!def && RARITIES.indexOf(def.rarity) >= RARITIES.indexOf('Rare');
}

/** コピー元を決める（visitLog を新しい順に。Adapter と自分自身は飛ばす） */
export function pickSource(node: RoomInstance, params: ModifierParams, world: WorldManager): { node: RoomInstance; def: RoomDefinition; reason: CarryoverState['reason'] } | null {
  const source = str(params.source, 'lastVisited');
  if (source !== 'lastVisited' && world.graph.has(source)) {
    const n = world.graph.get(source);
    const d = world.definitionOf(n);
    if (d) return { node: n, def: d, reason: 'param' };
  }
  const log = world.graph.visitLog;
  let last: { node: RoomInstance; def: RoomDefinition } | null = null;
  for (let i = log.length - 1; i >= 0; i--) {
    const id = log[i];
    if (id === node.roomId) continue;
    const n = world.graph.nodes.get(id);
    if (!n || n.isAdapter) continue;
    const d = world.definitionOf(n);
    if (!d) continue;
    if (isRareOrAbove(d)) return { node: n, def: d, reason: 'rare' };
    if (!last) last = { node: n, def: d };
  }
  return last ? { ...last, reason: 'last' } : null;
}

export function readState(node: RoomInstance | undefined | null): CarryoverState | null {
  const s = node?.state?.modifierState?.[CARRYOVER_KEY] as CarryoverState | undefined;
  return s && typeof s.sourceRoomId === 'string' && s.palette ? s : null;
}

/** 保存値を RoomLayout に写す（palette の光・霧、LightSpec の色、発光パネルの材質、部屋固有 fog） */
export function applyToLayout(L: RoomLayout, s: CarryoverState): void {
  const prevLight = L.palette.light;
  L.palette = { ...L.palette, light: s.palette.light, lightColor: s.palette.lightColor, lightIntensity: s.palette.lightIntensity, ambient: s.palette.ambient, fog: s.palette.fog };
  for (const l of L.lights) l.color = s.palette.lightColor;
  for (let i = 0; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.mat === prevLight || (LIGHT_MATS.has(b.mat) && b.mat !== s.palette.light)) L.boxes[i] = { ...b, mat: s.palette.light };
  }
  if (s.fog) {
    L.render = { ...(L.render ?? {}), fog: { ...s.fog } };
    L.fogFar = s.fogFar ?? s.fog.far;
  } else if (s.fogFar) {
    L.fogFar = s.fogFar;
  }
}

/** layout フックで適用済みのレイアウト（build フォールバックの重複適用を避ける） */
const appliedLayouts = new WeakSet<RoomLayout>();

const AmbientCarryover: ModifierImpl = {
  id: 'AmbientCarryover',
  defaults: { source: 'lastVisited' },

  onNodeCreated(node, _def, params, world) {
    const picked = pickSource(node, params, world);
    node.state.modifierState ??= {};
    if (!picked) {
      // コピー元なし（開始直後など）。保存しないので既定のパレットで生成される
      delete node.state.modifierState[CARRYOVER_KEY];
      return;
    }
    let L: RoomLayout | null = null;
    try {
      L = world.layoutFor(picked.node);
    } catch {
      L = null;
    }
    const pal = L?.palette;
    const state: CarryoverState = {
      sourceRoomId: picked.node.roomId,
      sourceDefinitionId: picked.def.id,
      rarity: picked.def.rarity,
      audioPreset: picked.def.audioPreset,
      palette: {
        light: pal?.light ?? 'lightPanel',
        lightColor: pal?.lightColor ?? 0xdfe8ff,
        lightIntensity: pal?.lightIntensity ?? 1.0,
        ambient: pal?.ambient ?? 0x8a90a0,
        fog: pal?.fog ?? 0x0b0d14,
      },
      reason: picked.reason,
    };
    if (L?.render?.fog) state.fog = { ...L.render.fog };
    if (L?.fogFar !== undefined) state.fogFar = L.fogFar;
    node.state.modifierState[CARRYOVER_KEY] = state;
  },

  layout(L, p) {
    // GenParams.node（統合担当への依頼）があれば保存値を読む。無ければ build フックのフォールバックに任せる
    const node = (p as { node?: RoomInstance }).node;
    const s = readState(node);
    if (!s) return;
    applyToLayout(L, s);
    appliedLayouts.add(L);
  },

  build(built: BuiltRoom, L, ctx) {
    const s = readState(ctx.node);
    if (!s || appliedLayouts.has(L)) return;
    // フォールバック: キャッシュ済みレイアウト（Game.applyEnvironment が palette.ambient / fog を読む）と BuiltRoom に直接写す
    applyToLayout(L, s);
    appliedLayouts.add(L);
    if (s.fog) built.fog = { ...s.fog };
    for (const light of built.lights) light.color.setHex(s.palette.lightColor);
  },

  onEnter(ctx) {
    const s = readState(ctx.node);
    if (!s || !ctx.audio) return;
    ctx.audio.overridePreset(s.audioPreset);
  },
};

export default AmbientCarryover;

/** 検証用: 保存値の要約 */
export function describeCarryover(node: RoomInstance): string {
  const s = readState(node);
  if (!s) return 'no source';
  return `${s.sourceRoomId} (${s.sourceDefinitionId} ${s.rarity}, ${s.reason}) light=#${s.palette.lightColor.toString(16)} fog=#${s.palette.fog.toString(16)} audio=${s.audioPreset}`;
}
