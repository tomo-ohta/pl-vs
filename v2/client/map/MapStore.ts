/**
 * フロアの地図の保存（localStorage）。フロアごとに自分の地図（MapModel の MapSave）を覚えておく。
 * 同じフロアに戻ったとき（前の階に戻る輪・裏のフロア・読み直し）に、見た所・調べた所・足跡・写しが残っている。
 * - 'liminal2.maps.v1' = 覚えているフロアの鍵の並び（新しい順）。フロアの中身は 'liminal2.maps.v1:<鍵>'（歩いている間の保存で、
 *   今のフロアの分だけを書く。スマホでも重くならないように）
 * - 鍵は MapInfo.key（フロア・生成器・調整表の版。どれかが変われば別のフロア）。覚えておく数は map.save.floors（古いものから忘れる）
 * DOM・three に依存しない（保存先を差し替えられる。Node の試験で使える）。
 */
import { STORAGE_PREFIX } from '../env.ts';
import type { MapSave } from './MapModel.ts';

export const MAPS_KEY = `${STORAGE_PREFIX}maps.v1`;
const floorKey = (key: string): string => `${MAPS_KEY}:${key}`;

export type MapStorage = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class MapStore {
  private order: string[] = [];
  /** 読んだ・書いたフロアの中身（保存先が無いときもここに残る） */
  private cache = new Map<string, MapSave>();
  private storage: MapStorage | null = null;
  max = 12;

  static load(storage: MapStorage | null = defaultStorage(), max = 12): MapStore {
    const s = new MapStore();
    s.storage = storage;
    s.max = Math.max(1, max);
    try {
      const raw = storage?.getItem(MAPS_KEY);
      if (raw) {
        const o = JSON.parse(raw) as { v?: number; order?: unknown };
        if (o && o.v === 1 && Array.isArray(o.order)) s.order = o.order.filter((k): k is string => typeof k === 'string');
      }
    } catch {
      s.order = [];
    }
    return s;
  }

  get(key: string): MapSave | null {
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (!this.order.includes(key)) return null;
    try {
      const raw = this.storage?.getItem(floorKey(key));
      const f = raw ? (JSON.parse(raw) as MapSave) : null;
      if (f && f.v === 1) { this.cache.set(key, f); return f; }
    } catch { /* 壊れた保存は無かったことに */ }
    return null;
  }

  keys(): string[] { return this.order.slice(); }

  /** 覚える（新しい順の先頭へ）。保存できなければ false（容量不足など。次の機会に持ち越す） */
  put(key: string, save: MapSave): boolean {
    this.cache.set(key, save);
    this.order = [key, ...this.order.filter((k) => k !== key)];
    const drop: string[] = [];
    while (this.order.length > this.max) drop.push(this.order.pop()!);
    for (const k of drop) this.forget(k);
    const write = (): void => {
      this.storage?.setItem(floorKey(key), JSON.stringify(save));
      this.storage?.setItem(MAPS_KEY, JSON.stringify({ v: 1, order: this.order }));
    };
    try {
      write();
      return true;
    } catch {
      // 容量不足: 古い地図を半分忘れてもう一度
      for (const k of this.order.splice(Math.max(1, Math.ceil(this.order.length / 2)))) if (k !== key) this.forget(k);
      try { write(); return true; } catch { return false; }
    }
  }

  /** 果てしない階の、階の地図の区域（地図の鍵の並び。古い順） */
  storyRegions(story: string): string[] {
    try {
      const raw = this.storage?.getItem(`${MAPS_KEY}:story:${story}`);
      const o = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(o) ? o.filter((k): k is string => typeof k === 'string' && this.order.includes(k)) : [];
    } catch {
      return [];
    }
  }

  /** 階の地図に区域を足す（max を超えたら古い区域から外す） */
  addStoryRegion(story: string, key: string, max: number): void {
    const list = [...this.storyRegions(story).filter((k) => k !== key), key].slice(-Math.max(1, max));
    try { this.storage?.setItem(`${MAPS_KEY}:story:${story}`, JSON.stringify(list)); } catch { /* 入らなくてもよい（写しを描かないだけ） */ }
  }

  private forget(k: string): void {
    this.cache.delete(k);
    try {
      if (this.storage?.removeItem) this.storage.removeItem(floorKey(k));
      else this.storage?.setItem(floorKey(k), '');
    } catch { /* 消せなくてもよい（並びから外れていれば読まない） */ }
  }
}
