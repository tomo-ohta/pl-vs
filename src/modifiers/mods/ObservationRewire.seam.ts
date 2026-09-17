/**
 * M-rewire 担当（ObservationRewire / DynamicMapNode / MultiEdge）の共通ヘルパ。
 * 「再配線は Seam」（仕様 3.3）: 対象部屋の前進扉を意図的 Seam にし、行き先は pending 定義（forceDefinitionId）の差し替えだけで変える。
 *   - pending 定義は WorldManager が stash する node.state.localFlags['seam:<portalId>'].forceDefinitionId を書き換える
 *     （resolveSeamTarget が初回通過時にこの値で rollRoomNode する。生成済みノードは forcedDefinitionId に残るので再生成・ロードでも同じ）。
 *   - 扉上のサイン（L.signs、id 'rewire:<socketId>'）は layout で場所だけ確定し、文字は build / update で built.updateSign する。
 *   - 観測判定: 扉の AABB がカメラの視錐台と交差していれば「画面内」。「背後」は扉中心がカメラ前方ベクトルの負側。
 * ModifierImpl ではないので default export は無い。
 */
import * as THREE from 'three';
import type { Portal, PortalType, RoomDefinition, RoomInstance, Socket, Vec3 } from '../../core/types';
import { dirVec } from '../../core/types';
import type { Rng } from '../../core/rng';
import { ROOM_BY_ID } from '../../data';
import { WALL_T, type GenParams, type RoomLayout, type SignSpec } from '../../generators/layout';
import type { BuiltRoom } from '../../render/RoomBuilder';
import type { WorldManager } from '../../world/WorldManager';
import { pickDefinition, rollRarity } from '../../world/RarityGenerator';

/** 扉上サインの id 接頭辞（他 Modifier のサイン id と衝突しないように） */
export const SIGN_PREFIX = 'rewire:';
export const SIGN_W = 1.0;
/** SignAtlas のセル比（512×128）から決まるサインの高さ */
export const SIGN_H = SIGN_W / 4;
/** サインの初期文字（pending が決まる前。build で差し替わる） */
export const SIGN_PLACEHOLDER = '－－－';

export function signIdFor(socketId: string): string {
  return `${SIGN_PREFIX}${socketId}`;
}

/** 部屋を抽選して配置する対象の開口（WorldManager.isDoorLike と同じ。循環 import を避けて再定義） */
export function isDoorLikeType(type: PortalType): boolean {
  return type === 'door' || type === 'street' || type === 'gate';
}

/** 再配線の対象になる前進扉ソケット（entry・直結で後から足された壁面ソケット・穴は除く） */
export function forwardDoorSockets(L: RoomLayout, p: Pick<GenParams, 'extraSockets'>): Socket[] {
  const extra = new Set(p.extraSockets.map((s) => s.id));
  return L.sockets.filter((s) => s.id !== 'entry' && isDoorLikeType(s.type) && !extra.has(s.id));
}

/** 各扉の上（壁の内面）にサインを置く。room の高さが足りなければ天井直下に寄せる */
export function addDoorSigns(L: RoomLayout, sockets: Socket[], kind: SignSpec['kind'], text = SIGN_PLACEHOLDER): void {
  if (sockets.length === 0) return;
  L.signs ??= [];
  for (const s of sockets) {
    if (L.signs.some((x) => x.id === signIdFor(s.id))) continue;
    const inward = dirVec(((s.dir + 2) % 4) as Socket['dir']);
    const depth = WALL_T + 0.012;
    const top = s.pos[1] + (s.sill ?? 0) + s.height;
    const y = Math.min(top + 0.05 + SIGN_H / 2, L.height - 0.06 - SIGN_H / 2);
    const pos: Vec3 = [s.pos[0] + inward[0] * depth, y, s.pos[2] + inward[2] * depth];
    L.signs.push({ id: signIdFor(s.id), text, pos, dir: ((s.dir + 2) % 4) as Socket['dir'], width: SIGN_W, kind, color: kind === 'emissive' ? 0xd8f0ff : undefined, background: kind === 'emissive' ? 0x101820 : undefined });
  }
}

/** node.state.modifierState[id] を取得（無ければ init で作る。欠けたキーは init で補う） */
export function modState<T extends Record<string, unknown>>(node: RoomInstance, id: string, init: () => T): T {
  node.state.modifierState ??= {};
  const cur = node.state.modifierState[id] as Partial<T> | undefined;
  const base = init();
  if (cur && typeof cur === 'object' && Object.keys(base).every((k) => k in cur)) return cur as T;
  const merged = { ...base, ...(cur ?? {}) } as T;
  node.state.modifierState[id] = merged;
  return merged;
}

/** Seam 扉の pending 定義（resolveSeamTarget が読む forceDefinitionId）を書き換える */
export function setSeamPending(node: RoomInstance, portalId: string, defId: string): void {
  const key = `seam:${portalId}`;
  const cur = (node.state.localFlags[key] ?? { seam: true }) as Record<string, unknown>;
  node.state.localFlags[key] = { ...cur, seam: true, forceDefinitionId: defId };
}

/** Seam 扉の pending 定義 id（無ければ undefined） */
export function seamPendingOf(node: RoomInstance, portalId: string): string | undefined {
  const cur = node.state.localFlags[`seam:${portalId}`] as { forceDefinitionId?: string } | undefined;
  return cur?.forceDefinitionId;
}

/** 通常抽選と同じ手順（レア度 → 定義）で pending 定義を 1 つ選ぶ。exclude と同じ定義は数回まで避ける */
export function rollPendingDefinition(world: WorldManager, depth: number, rng: Rng, opts: { prefer?: 'room' | 'corridor' | null; exclude?: string } = {}): RoomDefinition {
  const ctx = world.ctx(depth);
  let def = pickDefinition(rng, rollRarity(rng, ctx), ctx, { prefer: opts.prefer ?? null }).def;
  for (let i = 0; i < 4 && opts.exclude && def.id === opts.exclude; i++) {
    def = pickDefinition(rng, rollRarity(rng, ctx), ctx, { prefer: opts.prefer ?? null }).def;
  }
  return def;
}

export function definitionName(defId: string | undefined): string {
  if (!defId) return '？';
  return ROOM_BY_ID.get(defId)?.name ?? defId;
}

/** pending 定義の名前を扉上のサインへ反映する */
export function applyPendingSigns(built: BuiltRoom | null, node: RoomInstance, pending: Record<string, string>): void {
  if (!built) return;
  for (const p of node.portals) {
    if (p.isReturn) continue;
    const defId = pending[p.portalId];
    if (!defId) continue;
    built.updateSign(signIdFor(p.socketId), definitionName(defId));
  }
}

/** 未通過（行き先未確定）の意図的 Seam 扉。施錠・戻り・乗り物は除く */
export function unresolvedSeamDoors(node: RoomInstance): Portal[] {
  return node.portals.filter((p) => !p.isReturn && p.seam && !p.targetRoomId && !p.locked && !p.ride && p.type === 'door');
}

// ---------------------------------------------------------------- 観測判定
const _m = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _box = new THREE.Box3();
const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();

export interface DoorView {
  /** 扉の AABB がカメラの視錐台と交差する（画面内） */
  inFrustum: boolean;
  /** 扉の中心がカメラの背後 */
  behind: boolean;
}

/** 扉（ソケット）のワールド AABB とカメラの関係。placement が無ければ null */
export function viewOfDoor(world: WorldManager, node: RoomInstance, socketId: string, camera: THREE.Camera): DoorView | null {
  if (!node.placement) return null;
  const s = world.socketOf(node, socketId);
  const { pos, dir } = world.socketWorld(node, socketId);
  const out = dirVec(dir);
  const y0 = pos[1] + (s.sill ?? 0);
  const cx = pos[0] - out[0] * 0.075;
  const cz = pos[2] - out[2] * 0.075;
  const half = s.width / 2 + 0.05;
  if (dir === 0 || dir === 2) {
    _box.min.set(cx - half, y0, cz - 0.25);
    _box.max.set(cx + half, y0 + s.height, cz + 0.25);
  } else {
    _box.min.set(cx - 0.25, y0, cz - half);
    _box.max.set(cx + 0.25, y0 + s.height, cz + half);
  }
  camera.updateMatrixWorld();
  _m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_m);
  const inFrustum = _frustum.intersectsBox(_box);
  camera.getWorldDirection(_fwd);
  _box.getCenter(_to).sub(camera.position);
  return { inFrustum, behind: _to.dot(_fwd) < 0 };
}
