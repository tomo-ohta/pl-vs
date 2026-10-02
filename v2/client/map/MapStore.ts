/**
 * フロアの地図の保存（localStorage 'liminal2.maps.v1'）。フロアごとに自分の地図（MapModel の MapSave）を覚えておく。
 * 同じフロアに戻ったとき（前の階に戻る輪・裏のフロア・読み直し）に、見た所・調べた所・足跡・写しが残っている。
 * 鍵は MapInfo.key（フロア・生成器・調整表の版。どれかが変われば別のフロア）。覚えておく数は map.save.floors（古いものから忘れる）。
 * DOM・three に依存しない（保存先を差し替えられる。Node の試験で使える）。
 */
import { STORAGE_PREFIX } from '../env.ts';
import type { MapSave } from './MapModel.ts';

export const MAPS_KEY = `${STORAGE_PREFIX}maps.v1`;

export type MapStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface Stored { v: 1; order: string[]; floors: Record<string, MapSave> }

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class MapStore {
  private data: Stored = { v: 1, order: [], floors: {} };
  private storage: MapStorage | null = null;
  max = 12;

  static load(storage: MapStorage | null = defaultStorage(), max = 12): MapStore {
    const s = new MapStore();
    s.storage = storage;
    s.max = Math.max(1, max);
    try {
      const raw = storage?.getItem(MAPS_KEY);
      if (raw) {
        const o = JSON.parse(raw) as Partial<Stored>;
        if (o && o.v === 1 && o.floors && typeof o.floors === 'object') {
          const order = Array.isArray(o.order) ? o.order.filter((k): k is string => typeof k === 'string' && !!o.floors![k]) : Object.keys(o.floors);
          s.data = { v: 1, order, floors: {} };
          for (const k of order) s.data.floors[k] = o.floors[k]!;
        }
      }
    } catch {
      s.data = { v: 1, order: [], floors: {} };
    }
    return s;
  }

  get(key: string): MapSave | null {
    const f = this.data.floors[key];
    return f && f.v === 1 ? f : null;
  }

  keys(): string[] { return this.data.order.slice(); }

  /** 覚える（新しい順の先頭へ）。保存できなければ false（容量不足など。次の機会に持ち越す） */
  put(key: string, save: MapSave): boolean {
    this.data.floors[key] = save;
    this.data.order = [key, ...this.data.order.filter((k) => k !== key)];
    while (this.data.order.length > this.max) delete this.data.floors[this.data.order.pop()!];
    try {
      this.storage?.setItem(MAPS_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      // 容量不足: 古い地図を半分忘れてもう一度
      const drop = this.data.order.splice(Math.ceil(this.data.order.length / 2));
      for (const k of drop) if (k !== key) delete this.data.floors[k];
      try { this.storage?.setItem(MAPS_KEY, JSON.stringify(this.data)); return true; } catch { return false; }
    }
  }
}
