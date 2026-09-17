/**
 * MultiEdge — 多重扉室（M11, edgeCount 4）。見た目上複数の扉が同一の接続先を共有する。
 * params: edgeCount（主扉を含む扉の枚数。2〜4）。
 *
 * 主扉 1 枚だけ物理接続、他は Seam（仕様 3.3 / v1.3 D14）:
 *   layout    : 前進扉（entry・直結ソケット xN 以外の door）が edgeCount 枚に足りなければ placeExits で 'me<i>' ソケットを足し、
 *               外殻（床・天井・外壁）を buildShell で組み直す（L.boxes の先頭 shellCount 個を差し替え）。新しい戸口の前の家具は clearDoorways で除く。
 *               鏡像扉の戸口の外面には非ソリッドの黒い箔（'void'）を置く（開いたときに向こうが真っ暗に見える。壁厚の中なので配置判定に影響しない）。
 *   onConnect : 主扉 = ソケット順で最初の前進扉（exit0 が普通）。主扉は通常接続。鏡像扉（次の edgeCount-1 枚）は Portal.mirrorOf = 主扉 id を立て、
 *               主扉の接続が決まっていれば { targetExisting: 主扉の targetRoomId }（一方通行 Seam。着地は接続先の entry 内側）、
 *               まだ無ければ { lock: true }。主扉が SEAM-2〜5 の後段で接続できた場合は update で施錠の鏡像を Seam に遅延同期する（ジオメトリは変わらない）。
 *   update    : 鏡像扉の open を主扉の開閉状態に合わせる（見た目だけ。開いた鏡像を通り抜けると Game.checkSeamCrossing が接続先へ遷移）。
 *   canOpen   : 主扉が施錠なら鏡像も開かない。
 * 主扉 / 鏡像の選択はソケット順だけで決まる純関数（layout / onConnect の両方から同じ結果になる）。
 */
import type { Portal, RoomInstance, Socket, Vec3 } from '../../core/types';
import { dirVec } from '../../core/types';
import { clearDoorways, placeExits } from '../../generators/common';
import { buildShell } from '../../generators/footprint';
import { box, type Box, type RoomLayout } from '../../generators/layout';
import type { ModifierImpl } from '../types';
import { num } from '../util';

const ID = 'MultiEdge';
const MIRROR_PREFIX = 'me';

function edgeCountOf(v: unknown): number {
  return Math.max(2, Math.min(4, Math.floor(num(v, 4))));
}

/** 主扉と鏡像扉の id（ソケット順。entry・直結ソケット・穴・扉以外は対象外） */
export function edgesOf(sockets: readonly Socket[], extraIds: ReadonlySet<string>, edgeCount: number): { main: string | null; mirrors: string[] } {
  const doors = sockets.filter((s) => s.id !== 'entry' && s.type === 'door' && !extraIds.has(s.id));
  if (doors.length === 0) return { main: null, mirrors: [] };
  return { main: doors[0].id, mirrors: doors.slice(1, edgeCount).map((s) => s.id) };
}

/** 鏡像扉の戸口の外面に置く黒い箔（壁厚 0.15 の中、扉パネル 0.045〜0.105 の外側） */
function voidBacking(s: Socket): Box {
  const n = dirVec(s.dir);
  const cx = s.pos[0] - n[0] * 0.024;
  const cz = s.pos[2] - n[2] * 0.024;
  const half = s.width / 2 + 0.03;
  const y0 = s.pos[1] + (s.sill ?? 0);
  const y1 = y0 + s.height;
  const min: Vec3 = s.dir === 0 || s.dir === 2 ? [cx - half, y0, cz - 0.016] : [cx - 0.016, y0, cz - half];
  const max: Vec3 = s.dir === 0 || s.dir === 2 ? [cx + half, y1, cz + 0.016] : [cx + 0.016, y1, cz + half];
  return box(min, max, 'void', false);
}

function mainPortalOf(node: RoomInstance, mirror: Portal): Portal | undefined {
  return mirror.mirrorOf ? node.portals.find((x) => x.portalId === mirror.mirrorOf) : undefined;
}

const MultiEdge: ModifierImpl = {
  id: ID,
  defaults: { edgeCount: 4 },

  layout(L: RoomLayout, p, params, rng) {
    const edgeCount = edgeCountOf(params.edgeCount);
    const extra = new Set(p.extraSockets.map((s) => s.id));
    const doors = L.sockets.filter((s) => s.id !== 'entry' && s.type === 'door' && !extra.has(s.id));
    // 施錠で壁に戻された前進扉（removedSockets）も枚数に数える: 接続確定後の再生成で新しいソケットが現れないようにする。
    // 自分が足した 'me' ソケットは placeExits を最初と同じ枚数で呼び直してから除くので数えない（残りの me の位置が変わらない）
    const removedFwd = p.removedSockets.filter((id) => id !== 'hole' && !extra.has(id) && !id.startsWith(MIRROR_PREFIX));
    const need = edgeCount - doors.length - removedFwd.length;
    // 扉が足りなければ足す（外殻を組み直せる Generator だけ: shellCount あり・天井穴なし）。M11（AtriumLobby）は常に 4 枚以上あるので通常は通らない
    if (need > 0 && L.footprint.length > 0 && L.shellCount !== undefined && p.entry?.type !== 'hole') {
      const added = placeExits(L.footprint, L.sockets, rng, { count: need, minGap: 3.5 }, MIRROR_PREFIX).filter((s) => !p.removedSockets.includes(s.id));
      if (added.length > 0) {
        L.sockets.push(...added);
        const shell = L.boxes.slice(0, L.shellCount);
        const floorMat = shell.find((b) => b.max[1] <= 0.001)?.mat ?? L.palette.floor;
        const ceilingMat = shell.find((b) => b.min[1] >= L.height - 0.001)?.mat ?? L.palette.ceiling;
        const wallMat = shell.find((b) => b.min[1] > -0.001 && b.max[1] < L.height + 0.001 && b.max[1] - b.min[1] > 0.5)?.mat ?? L.palette.wall;
        const fresh: Box[] = [];
        buildShell(fresh, L.footprint, L.height, L.sockets, { floor: floorMat, wall: wallMat, ceiling: ceilingMat, floorHoles: L.holes });
        L.boxes.splice(0, L.shellCount, ...fresh);
        L.shellCount = fresh.length;
        clearDoorways(L, added, L.shellCount);
      }
    }
    // 鏡像扉の戸口の奥は黒
    const edges = edgesOf(L.sockets, extra, edgeCount);
    for (const id of edges.mirrors) {
      const s = L.sockets.find((x) => x.id === id);
      if (s) L.boxes.push(voidBacking(s));
    }
  },

  onConnect(ctx) {
    const { portal, node, world } = ctx;
    if (portal.isReturn || portal.type !== 'door') return;
    const edgeCount = edgeCountOf(ctx.params.edgeCount);
    const edges = edgesOf(world.layoutFor(node).sockets, new Set(node.extraSockets.map((s) => s.id)), edgeCount);
    if (!edges.main || portal.portalId === edges.main) return;
    if (!edges.mirrors.includes(portal.portalId)) return;
    portal.mirrorOf = edges.main;
    const main = node.portals.find((x) => x.portalId === edges.main);
    if (main?.targetRoomId && world.graph.has(main.targetRoomId)) return { targetExisting: main.targetRoomId };
    // 主扉がまだ接続されていない（側道抽選に失敗して後段待ち）: 施錠。後段で主扉が繋がれば update で Seam に同期する
    return { lock: true };
  },

  update(_dt, ctx) {
    const { node, world } = ctx;
    for (const p of node.portals) {
      if (p.isReturn || !p.mirrorOf) continue;
      const main = mainPortalOf(node, p);
      if (!main) continue;
      if (p.locked && !p.targetRoomId && main.targetRoomId && world.graph.has(main.targetRoomId)) {
        p.locked = false;
        p.seam = true;
        p.far = true;
        p.targetRoomId = main.targetRoomId;
        p.targetPortalId = 'entry';
        p.projected = false;
        p.open = false;
      }
      if (!p.seam || !p.targetRoomId) continue;
      // 開閉状態は主扉が持ち、鏡像は見た目だけ追従する（自動閉扉も主扉側に任せる）
      p.open = world.portalOpen(node, main);
      p.passedAt = undefined;
    }
  },

  canOpen(portal, ctx) {
    if (portal.isReturn || !portal.mirrorOf) return;
    const main = mainPortalOf(ctx.node, portal);
    if (!main || main.locked) return { ok: false };
    return { ok: true };
  },
};

export default MultiEdge;
