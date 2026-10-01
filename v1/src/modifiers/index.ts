/**
 * Modifier レジストリ。src/modifiers/mods/*.ts を import.meta.glob で自動登録する（index.ts を編集せずに追加できる）。
 *
 * 統合担当向け: 呼び出し方
 * - generators/index.ts の generateLayout 末尾で applyLayoutModifiers(L, p) が呼ばれる（済）。
 * - RoomBuilder.build の末尾で applyBuildModifiers(built, L, ctx) が呼ばれる（済）。
 * - WorldManager: ノード生成直後に notifyNodeCreated(node, world)、接続抽選前に collectConnectDirective(ctx) を呼ぶ
 *   （F3 の connectHooks 配列に `collectConnectDirective` を登録する形でよい）。
 * - Game.enterRoom: runEnter(ctx) / runExit(ctx)。Game.step: runUpdate(dt, ctx)（現在部屋 + streaming.built の各部屋）。
 * - 扉のインタラクト / ヒント: checkCanOpen(portal, ctx) → { ok, hint }。ok=false なら開けない。
 * - 除外部屋（E10, M05, M06, M10, M15, M20）は OMITTED_ROOMS。抽選側で除外する（RarityGenerator は F3）。
 * - オミット Modifier（RewindState / DiscoveryGate / FutureAudio）は登録されていても modifiersOf が無視する。
 */
import type { Rng } from '../core/rng';
import type { ModifierRef, Portal, RoomDefinition, RoomInstance } from '../core/types';
import type { GenParams, RoomLayout } from '../generators/layout';
import type { BuiltRoom } from '../render/RoomBuilder';
import type { WorldManager } from '../world/WorldManager';
import type { BuildContext, CanOpenResult, ConnectContext, ConnectDirective, ModifierImpl, ModifierParams, RuntimeContext } from './types';

export type * from './types';

/** 生成対象から除外する部屋（v1.3 決定。ID は欠番として残す） */
export const OMITTED_ROOMS: ReadonlySet<string> = new Set(['E10', 'M05', 'M06', 'M10', 'M15', 'M20']);
/** 実装しない Modifier */
export const OMITTED_MODIFIERS: ReadonlySet<string> = new Set(['RewindState', 'DiscoveryGate', 'FutureAudio']);

const registry = new Map<string, ModifierImpl>();

/** 手動登録（テスト / Node 実行用。通常は glob で自動登録される） */
export function registerModifier(impl: ModifierImpl): void {
  registry.set(impl.id, impl);
}

export function getModifier(id: string): ModifierImpl | undefined {
  return registry.get(id);
}

export function registeredModifierIds(): string[] {
  return [...registry.keys()].sort();
}

// 自動登録。Vite が静的に展開する。Node 直実行など import.meta.glob が無い環境では空のまま（手動登録を使う）
try {
  const modules = import.meta.glob<{ default?: ModifierImpl }>('./mods/*.ts', { eager: true });
  for (const [path, mod] of Object.entries(modules)) {
    const fileId = path.replace(/^.*\/(.+)\.ts$/, '$1');
    // 補助ファイル（`<Id>.<name>.ts`。例 ShallowWater.geom.ts / FakeSignage.build.ts）は登録対象外（default export を持たない）
    if (fileId.includes('.')) continue;
    const impl = mod?.default;
    if (!impl || typeof impl.id !== 'string') {
      console.warn(`[modifiers] ${path}: default export が ModifierImpl ではありません`);
      continue;
    }
    if (fileId !== impl.id) console.warn(`[modifiers] ${path}: id '${impl.id}' がファイル名と一致しません`);
    registry.set(impl.id, impl);
  }
} catch {
  /* import.meta.glob が使えない環境 */
}

/** 定義の Modifier 参照（実装済み・非オミットのものだけ）。順序は rooms.json の順 */
export function modifiersOf(def: RoomDefinition | null | undefined): { ref: ModifierRef; impl: ModifierImpl }[] {
  if (!def) return [];
  const out: { ref: ModifierRef; impl: ModifierImpl }[] = [];
  for (const ref of def.modifiers ?? []) {
    if (OMITTED_MODIFIERS.has(ref.id)) continue;
    const impl = registry.get(ref.id);
    if (impl) out.push({ ref, impl });
  }
  return out;
}

/** 定義の Modifier パラメータ（impl.defaults ← def.modifiers[].params の順に上書き）。参照が無ければ null */
export function modParams(def: RoomDefinition | null | undefined, id: string): ModifierParams | null {
  const ref = def?.modifiers?.find((m) => m.id === id);
  if (!ref) return null;
  return { ...(registry.get(id)?.defaults ?? {}), ...(ref.params ?? {}) };
}

/** 定義がその Modifier を持つか */
export function hasModifier(def: RoomDefinition | null | undefined, id: string): boolean {
  return !!def?.modifiers?.some((m) => m.id === id) && !OMITTED_MODIFIERS.has(id);
}

function paramsOf(ref: ModifierRef, impl: ModifierImpl): ModifierParams {
  return { ...(impl.defaults ?? {}), ...(ref.params ?? {}) };
}

// ---------------------------------------------------------------- フック実行

/** generateLayout の末尾。Modifier ごとに rng を fork するので順序と乱数が決定論になる */
export function applyLayoutModifiers(L: RoomLayout, p: GenParams): void {
  for (const { ref, impl } of modifiersOf(p.def)) {
    if (!impl.layout) continue;
    const rng: Rng = p.rng.fork(`mod:${impl.id}`);
    try {
      impl.layout(L, p, paramsOf(ref, impl), rng);
    } catch (e) {
      console.warn(`[modifiers] ${impl.id}.layout failed for ${p.def.id}`, e);
    }
  }
}

/** RoomBuilder.build の末尾 */
export function applyBuildModifiers(built: BuiltRoom, L: RoomLayout, ctx: Omit<BuildContext, 'params'>): void {
  for (const { ref, impl } of modifiersOf(ctx.def)) {
    if (!impl.build) continue;
    try {
      impl.build(built, L, { ...ctx, params: paramsOf(ref, impl), rng: ctx.rng.fork(`mod:${impl.id}`) });
    } catch (e) {
      console.warn(`[modifiers] ${impl.id}.build failed for ${ctx.node.roomId}`, e);
    }
  }
}

/** WorldManager: ノード生成直後 */
export function notifyNodeCreated(node: RoomInstance, def: RoomDefinition | null, world: WorldManager): void {
  if (!def) return;
  for (const { ref, impl } of modifiersOf(def)) impl.onNodeCreated?.(node, def, paramsOf(ref, impl), world);
}

/** WorldManager: 接続抽選の直前。各 Modifier の指示を後勝ちで合成する */
export function collectConnectDirective(ctx: Omit<ConnectContext, 'params'>): ConnectDirective | null {
  let merged: ConnectDirective | null = null;
  for (const { ref, impl } of modifiersOf(ctx.def)) {
    if (!impl.onConnect) continue;
    const d = impl.onConnect({ ...ctx, params: paramsOf(ref, impl), rng: ctx.rng.fork(`mod:${impl.id}`) });
    if (d) merged = { ...(merged ?? {}), ...d };
  }
  return merged;
}

export function runEnter(ctx: RuntimeContext, def: RoomDefinition | null): void {
  for (const { ref, impl } of modifiersOf(def)) impl.onEnter?.(ctx, paramsOf(ref, impl));
}

export function runExit(ctx: RuntimeContext, def: RoomDefinition | null): void {
  for (const { ref, impl } of modifiersOf(def)) impl.onExit?.(ctx, paramsOf(ref, impl));
}

export function runUpdate(dt: number, ctx: RuntimeContext, def: RoomDefinition | null): void {
  for (const { ref, impl } of modifiersOf(def)) impl.update?.(dt, ctx, paramsOf(ref, impl));
}

export const DEFAULT_LOCKED_HINT = 'この扉は開かなそうだ';

/** 扉を開けられるか。最初に ok=false を返した Modifier のヒントを使う */
export function checkCanOpen(portal: Portal, ctx: RuntimeContext, def: RoomDefinition | null): CanOpenResult {
  for (const { ref, impl } of modifiersOf(def)) {
    const r = impl.canOpen?.(portal, ctx, paramsOf(ref, impl));
    if (r && !r.ok) return { ok: false, hint: r.hint ?? DEFAULT_LOCKED_HINT };
  }
  return { ok: true };
}

// 共通ヘルパ（parseColor / num / str / vec3 / interiorBoxes ...）は ./util.ts。mods/ からは '../util' を import する（index との循環回避）
export * from './util';
