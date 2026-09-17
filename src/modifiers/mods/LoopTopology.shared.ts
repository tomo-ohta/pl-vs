/**
 * 接続系 Modifier（LoopTopology / RepeatDestination / FarLink / FakeExit。担当 M-connect）の共通ヘルパ。
 * default export を持たない補助ファイル（レジストリには登録されない）。乱数は使わず、引数（レイアウト・グラフ）だけで決まる。
 */
import { addDir, dirVec, type Dir, type RoomDefinition, type RoomInstance, type Socket, type Vec3 } from '../../core/types';
import { ROOM_BY_ID } from '../../data';
import { inFootprint } from '../../generators/footprint';
import { WALL_T, type RoomLayout, type SignSpec } from '../../generators/layout';
import type { WorldManager } from '../../world/WorldManager';
import type { ConnectContext } from '../types';

/** 部屋を抽選して配置する開口（WorldManager.isDoorLike と同じ。street / gate は幅広の常開扉） */
export function isDoorLikeType(type: Socket['type']): boolean {
  return type === 'door' || type === 'street' || type === 'gate';
}

/**
 * 「進行用扉」のソケット: 廊下は 'end'、それ以外は入口から最も遠い扉型ソケット（entry / hole / elevator / stairs / ramp を除く）。
 * 乱数を使わないので、connectPortal が同じ扉に何度呼ばれても（SEAM-2〜5 の再試行）同じ答えになる
 */
export function forwardSocket(L: RoomLayout): Socket | null {
  const cands = L.sockets.filter((s) => s.id !== 'entry' && isDoorLikeType(s.type));
  if (cands.length === 0) return null;
  const end = cands.find((s) => s.id === 'end');
  if (end) return end;
  const entry = L.sockets.find((s) => s.id === 'entry');
  if (!entry) return cands[0];
  let best = cands[0];
  let bestD = -1;
  for (const s of cands) {
    const dx = s.pos[0] - entry.pos[0];
    const dz = s.pos[2] - entry.pos[2];
    const d = dx * dx + dz * dz;
    if (d > bestD) { bestD = d; best = s; }
  }
  return best;
}

/** この接続が「進行用扉」のものか（Adapter は対象外） */
export function isForwardPortal(ctx: ConnectContext): boolean {
  if (ctx.node.isAdapter || ctx.portal.isReturn) return false;
  if (!isDoorLikeType(ctx.socket.type)) return false;
  const fwd = forwardSocket(ctx.world.layoutFor(ctx.node));
  return !!fwd && fwd.id === ctx.socket.id;
}

/**
 * parentRoomId を steps 段（Adapter は数えない）登った祖先の部屋。
 * 鎖が短ければ最上位（開始部屋）を返す。祖先が 1 つも無ければ null
 */
export function ancestorOf(world: WorldManager, node: RoomInstance, steps: number): RoomInstance | null {
  let cur: RoomInstance | undefined = node;
  let last: RoomInstance | null = null;
  let climbed = 0;
  const seen = new Set<string>([node.roomId]);
  while (cur && climbed < steps) {
    const pid: string | undefined = cur.parentRoomId;
    if (!pid || seen.has(pid) || !world.graph.has(pid)) break;
    seen.add(pid);
    cur = world.graph.get(pid);
    if (cur.isAdapter) continue;
    last = cur;
    climbed++;
  }
  return last;
}

/** 部屋の定義（Adapter は null） */
export function roomDefOf(node: RoomInstance): RoomDefinition | null {
  if (node.isAdapter) return null;
  return ROOM_BY_ID.get(node.definitionId) ?? null;
}

/** node.state.modifierState[id] を読む（無ければ null） */
export function modState<T>(node: RoomInstance, id: string): T | null {
  const s = node.state.modifierState?.[id];
  return s && typeof s === 'object' ? (s as T) : null;
}

/** node.state.modifierState[id] に保存する（JSON 化可能な値のみ） */
export function saveModState(node: RoomInstance, id: string, value: unknown): void {
  if (!node.state.modifierState) node.state.modifierState = {};
  node.state.modifierState[id] = value;
}

/** 壁内面と同一平面にならないよう室内側へ出す量 */
const FACE_OFFSET = 0.012;

/**
 * 入口ソケットの脇（同じ壁の内面、床から y）にサインを置く SignSpec を作る。
 * 部屋名ラベル（common.labelAtEntry は入口の真上 y≈2.35）と重ならないように横へ避ける。
 * 足跡の中に収まる側を選び、どちらにも収まらなければ null
 */
/**
 * サインの面（幅 width、高さ width/4。SignAtlas のセル比）が内装の箱（shellCount 以降。偽扉の板・枠・幅木など）に隠れないか。
 * 面の手前 0.3 m と壁面の少し奥までを見る（R17 で入口脇のサインが側壁の装飾偽扉と同位置になり扉枠に隠れた）
 */
function signClear(L: RoomLayout, pos: Vec3, dir: Dir, width: number): boolean {
  if (L.shellCount === undefined) return true; // 外殻と内装の境界が無い生成器では判定しない（壁箱と常に重なる）
  const from = L.shellCount;
  const n = dirVec(dir);
  const alongX = dir === 0 || dir === 2;
  const h = width / 4;
  const min: Vec3 = [alongX ? pos[0] - width / 2 - 0.1 : Math.min(pos[0], pos[0] + n[0] * 0.3) - 0.05, pos[1] - h / 2 - 0.1, alongX ? Math.min(pos[2], pos[2] + n[2] * 0.3) - 0.05 : pos[2] - width / 2 - 0.1];
  const max: Vec3 = [alongX ? pos[0] + width / 2 + 0.1 : Math.max(pos[0], pos[0] + n[0] * 0.3) + 0.05, pos[1] + h / 2 + 0.1, alongX ? Math.max(pos[2], pos[2] + n[2] * 0.3) + 0.05 : pos[2] + width / 2 + 0.1];
  for (let i = from; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.min[0] < max[0] && b.max[0] > min[0] && b.min[1] < max[1] && b.max[1] > min[1] && b.min[2] < max[2] && b.max[2] > min[2]) return false;
  }
  return true;
}

export function signBesideSocket(L: RoomLayout, s: Socket, id: string, text: string, kind: SignSpec['kind'], width = 1.2, y = 1.75): SignSpec | null {
  if (s.type === 'hole' || s.type === 'elevator') return null;
  const inward: Dir = addDir(s.dir, 2);
  const n = dirVec(inward);
  const face: Vec3 = [s.pos[0] + n[0] * (WALL_T + FACE_OFFSET), y, s.pos[2] + n[2] * (WALL_T + FACE_OFFSET)];
  const alongX = s.dir === 0 || s.dir === 2;
  const offset = s.width / 2 + 0.3 + width / 2;
  for (const side of [1, -1]) {
    const pos: Vec3 = alongX ? [face[0] + side * offset, y, face[2]] : [face[0], y, face[2] + side * offset];
    // サインの両端が足跡の中（壁の内側 0.3 m の余裕）にあるか
    const probe = (t: number): boolean => {
      const px = alongX ? pos[0] + t : pos[0] + n[0] * 0.3;
      const pz = alongX ? pos[2] + n[2] * 0.3 : pos[2] + t;
      return L.footprint.length === 0 || inFootprint(L.footprint, px, pz, WALL_T);
    };
    if (probe(-width / 2) && probe(width / 2) && signClear(L, pos, inward, width)) return { id, text, pos, dir: inward, width, kind };
  }
  // 入口の壁が狭い（廊下）: 入口の直ぐ内側の側壁に置く（入口の法線に沿って 0.9 m + 幅/2 入った位置。装飾と重なれば 0.7 m ずつ奥へ）
  const ix = s.pos[0] + n[0] * 0.5;
  const iz = s.pos[2] + n[2] * 0.5;
  const rect = L.footprint.find((r) => inFootprint([r], ix, iz, 0));
  if (!rect) return null;
  for (let step = 0; step < 6; step++) {
    const found = signOnSideWall(L, s, rect, n, alongX, 0.9 + width / 2 + step * 0.7, id, text, kind, width, y);
    if (found) return found;
  }
  return null;
}

/** 廊下の側壁（入口から depth 入った位置）にサインを置く。両側を試し、開口・装飾と重なれば null */
function signOnSideWall(L: RoomLayout, s: Socket, rect: { x0: number; z0: number; x1: number; z1: number }, n: Vec3, alongX: boolean, depth: number, id: string, text: string, kind: SignSpec['kind'], width: number, y: number): SignSpec | null {
  const cx = s.pos[0] + n[0] * depth;
  const cz = s.pos[2] + n[2] * depth;
  // 側壁: 入口が Z 方向の壁なら X の両端、X 方向の壁なら Z の両端
  const sides: { pos: Vec3; dir: Dir }[] = alongX
    ? [
        { pos: [rect.x0 + WALL_T + FACE_OFFSET, y, cz], dir: 1 },
        { pos: [rect.x1 - WALL_T - FACE_OFFSET, y, cz], dir: 3 },
      ]
    : [
        { pos: [cx, y, rect.z0 + WALL_T + FACE_OFFSET], dir: 0 },
        { pos: [cx, y, rect.z1 - WALL_T - FACE_OFFSET], dir: 2 },
      ];
  for (const side of sides) {
    // サインの両端が同じ矩形の中にあり、その側壁の他の開口（ソケット）と重ならないか
    const a0 = alongX ? side.pos[2] - width / 2 : side.pos[0] - width / 2;
    const a1 = a0 + width;
    const inside = alongX ? a0 >= rect.z0 + WALL_T && a1 <= rect.z1 - WALL_T : a0 >= rect.x0 + WALL_T && a1 <= rect.x1 - WALL_T;
    if (!inside) continue;
    const wallCoord = alongX ? (side.dir === 1 ? rect.x0 : rect.x1) : (side.dir === 0 ? rect.z0 : rect.z1);
    const blocked = L.sockets.some((o) => {
      if (o.id === s.id || o.type === 'hole') return false;
      const onWall = alongX ? Math.abs(o.pos[0] - wallCoord) < WALL_T * 2 + 0.01 : Math.abs(o.pos[2] - wallCoord) < WALL_T * 2 + 0.01;
      if (!onWall) return false;
      const oc = alongX ? o.pos[2] : o.pos[0];
      return oc + o.width / 2 + 0.2 > a0 && oc - o.width / 2 - 0.2 < a1;
    });
    if (!blocked && signClear(L, side.pos, side.dir, width)) return { id, text, pos: side.pos, dir: side.dir, width, kind };
  }
  return null;
}
