import type { Portal, Rarity, RoomInstance } from '../core/types';

/** 訪問ログの上限（AmbientCarryover / GraphReference past が参照する） */
export const VISIT_LOG_MAX = 64;

export interface RoomGraphSave {
  worldSeed: number;
  nextId: number;
  nodes: RoomInstance[];
  visitedCount: number;
  discoveredIds: string[];
  recentRarities: Rarity[];
  roomsSinceRare: number;
  /** 訪問順の roomId（再訪を含む。連続同一は 1 つ。上限 VISIT_LOG_MAX）。省略可（version 1 のまま） */
  visitLog?: string[];
  /** 直前にいた部屋（現在の部屋の 1 つ前）。省略可 */
  prevRoomId?: string;
}

/** LogicalRoomGraph。探索構造の正本。 */
export class RoomGraph {
  readonly nodes = new Map<string, RoomInstance>();
  nextId = 1;
  visitedCount = 0;
  readonly discoveredIds = new Set<string>();
  recentRarities: Rarity[] = [];
  roomsSinceRare = 0;
  /** 訪問順（入室ごと。Adapter も含む）。末尾が現在の部屋 */
  visitLog: string[] = [];
  /** 直前にいた部屋 id（末尾の 1 つ前） */
  prevRoomId?: string;

  constructor(public worldSeed: number) {}

  newRoomId(): string {
    return `r${this.nextId++}`;
  }

  get(id: string): RoomInstance {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`room not found: ${id}`);
    return n;
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  add(node: RoomInstance): RoomInstance {
    this.nodes.set(node.roomId, node);
    return node;
  }

  portal(roomId: string, portalId: string): Portal {
    const p = this.get(roomId).portals.find((x) => x.portalId === portalId);
    if (!p) throw new Error(`portal not found: ${roomId}/${portalId}`);
    return p;
  }

  /** 物理配置された隣接ノード（seam を除く） */
  placedNeighbors(roomId: string): string[] {
    const n = this.get(roomId);
    const out: string[] = [];
    for (const p of n.portals) {
      if (p.targetRoomId && !p.seam && this.nodes.get(p.targetRoomId)?.placement) out.push(p.targetRoomId);
    }
    return out;
  }

  /** 訪問ログを更新する（markVisited から呼ばれる。再訪も記録し、連続同一は 1 つにまとめる） */
  logVisit(roomId: string): void {
    const last = this.visitLog[this.visitLog.length - 1];
    if (last === roomId) return;
    if (last !== undefined) this.prevRoomId = last;
    this.visitLog.push(roomId);
    if (this.visitLog.length > VISIT_LOG_MAX) this.visitLog.splice(0, this.visitLog.length - VISIT_LOG_MAX);
  }

  /** 部屋間の最短ホップ数（Portal の向きは無視。到達不能なら Infinity）。FarLink リゾルバ用 */
  /**
   * 無向のグラフ距離（Portal を両方向に辿る）。from から到達できる全ノードの距離（from 自身は 0）。
   * bfsDistance は Portal の向きだけを辿るため、片方向の Seam（Legendary 遠方配置の entry / 穴）を逆向きに越えられず
   * 手前の部屋が候補から切れる（M08 FarLink で距離 5 が選ばれた）。一括計算なので候補ごとに呼ばなくてよい
   */
  undirectedDistances(from: string, maxDepth = 64): Map<string, number> {
    const adj = new Map<string, string[]>();
    const link = (a: string, b: string) => {
      const l = adj.get(a);
      if (l) l.push(b); else adj.set(a, [b]);
    };
    for (const n of this.nodes.values()) {
      for (const p of n.portals) {
        const t = p.targetRoomId;
        if (!t || t === n.roomId || !this.nodes.has(t)) continue;
        link(n.roomId, t);
        link(t, n.roomId);
      }
    }
    const dist = new Map<string, number>([[from, 0]]);
    let frontier = [from];
    for (let d = 1; d <= maxDepth && frontier.length > 0; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const t of adj.get(id) ?? []) {
          if (dist.has(t)) continue;
          dist.set(t, d);
          next.push(t);
        }
      }
      frontier = next;
    }
    return dist;
  }

  bfsDistance(from: string, to: string, maxDepth = 64): number {
    if (from === to) return 0;
    const seen = new Set<string>([from]);
    let frontier = [from];
    for (let d = 1; d <= maxDepth && frontier.length > 0; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        const n = this.nodes.get(id);
        if (!n) continue;
        for (const p of n.portals) {
          const t = p.targetRoomId;
          if (!t || seen.has(t) || !this.nodes.has(t)) continue;
          if (t === to) return d;
          seen.add(t);
          next.push(t);
        }
      }
      frontier = next;
    }
    return Infinity;
  }

  /** 訪問を記録する。戻り値: 新規発見（visitedCount が増えた）なら true */
  markVisited(roomId: string, definitionId: string, rarity: Rarity | null): boolean {
    const n = this.get(roomId);
    this.logVisit(roomId);
    if (n.visited) return false;
    n.visited = true;
    if (n.isAdapter) return false;
    this.visitedCount++;
    this.discoveredIds.add(definitionId);
    if (rarity) {
      this.recentRarities.push(rarity);
      if (this.recentRarities.length > 5) this.recentRarities.shift();
      if (rarity === 'Common' || rarity === 'Uncommon') this.roomsSinceRare++;
      else this.roomsSinceRare = 0;
    }
    return true;
  }

  toJSON(): RoomGraphSave {
    return {
      worldSeed: this.worldSeed,
      nextId: this.nextId,
      nodes: [...this.nodes.values()].map((n) => ({ ...n, portals: n.portals.map((p) => ({ ...p, passedAt: undefined })) })),
      visitedCount: this.visitedCount,
      discoveredIds: [...this.discoveredIds],
      recentRarities: this.recentRarities,
      roomsSinceRare: this.roomsSinceRare,
      visitLog: [...this.visitLog],
      prevRoomId: this.prevRoomId,
    };
  }

  static fromJSON(s: RoomGraphSave): RoomGraph {
    const g = new RoomGraph(s.worldSeed);
    g.nextId = s.nextId;
    for (const n of s.nodes) g.nodes.set(n.roomId, n);
    g.visitedCount = s.visitedCount;
    for (const d of s.discoveredIds) g.discoveredIds.add(d);
    g.recentRarities = s.recentRarities;
    g.roomsSinceRare = s.roomsSinceRare;
    g.visitLog = Array.isArray(s.visitLog) ? s.visitLog.slice(-VISIT_LOG_MAX) : [];
    g.prevRoomId = typeof s.prevRoomId === 'string' ? s.prevRoomId : undefined;
    return g;
  }
}
