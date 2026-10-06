/**
 * タブレットのカメラで撮った写真の保存（ブラウザの中。IndexedDB `liminal2.photos`）。
 * 情報と小さい写真（一覧用）は 'meta'、元の大きさの写真は 'image' に分けて持つ（一覧を出すときに大きい写真を読まない）。
 * IndexedDB が使えない（Node の試験・保存を拒むブラウザの設定）ときは、ページを開いている間だけ覚える（memory）
 */
import { STORAGE_PREFIX } from '../env.ts';

export interface PhotoMeta {
  id: number;
  /** 撮った時刻（現実の日時。ms） */
  takenAt: number;
  /** 撮った部屋のルーム ID（番号の無い所・フロアで撮ったときは null） */
  roomId: number | null;
  /** 世界の seed（ルーム ID は seed ごとに違う） */
  seed: number;
  /** 撮った所の名前（B6F・B6F 裏） */
  place: string;
  w: number;
  h: number;
  /** 写真の見た目（settings.photoLook） */
  look: 'clean' | 'video';
}

interface MetaRow extends PhotoMeta { thumb: Blob }

const DB_NAME = `${STORAGE_PREFIX}photos`;
const DB_VERSION = 1;

export class PhotoStore {
  private db: Promise<IDBDatabase | null> | null = null;
  /** IndexedDB が使えないときの入れ物 */
  private readonly memory = new Map<number, { meta: MetaRow; image: Blob }>();
  private nextId = 1;
  /** 変わったとき（ギャラリーが描き直す） */
  onChange: (() => void) | null = null;

  private readonly useIdb: boolean;

  // パラメータプロパティは使わない（Node の型ストリップで読めるように）
  constructor(useIdb = typeof indexedDB !== 'undefined') {
    this.useIdb = useIdb;
  }

  private open(): Promise<IDBDatabase | null> {
    if (!this.useIdb) return Promise.resolve(null);
    this.db ??= new Promise((res) => {
      try {
        const rq = indexedDB.open(DB_NAME, DB_VERSION);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id', autoIncrement: true });
          if (!db.objectStoreNames.contains('image')) db.createObjectStore('image');
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => { console.warn('[写真] IndexedDB を開けません。開いている間だけ覚えます', rq.error); res(null); };
        rq.onblocked = () => res(null);
      } catch (e) {
        console.warn('[写真] IndexedDB を使えません。開いている間だけ覚えます', e);
        res(null);
      }
    });
    return this.db;
  }

  /** 写真を足す（id を付けて返す） */
  async add(meta: Omit<PhotoMeta, 'id'>, image: Blob, thumb: Blob): Promise<PhotoMeta> {
    const db = await this.open();
    if (!db) {
      const id = this.nextId++;
      this.memory.set(id, { meta: { ...meta, id, thumb }, image });
      this.onChange?.();
      return { ...meta, id };
    }
    const id = await new Promise<number>((res, rej) => {
      const tx = db.transaction(['meta', 'image'], 'readwrite');
      const rq = tx.objectStore('meta').add({ ...meta, thumb });
      rq.onsuccess = () => {
        const key = rq.result as number;
        tx.objectStore('image').put(image, key);
        tx.oncomplete = () => res(key);
      };
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
    this.onChange?.();
    return { ...meta, id };
  }

  /** 全部の写真の情報と小さい写真（新しい順） */
  async list(): Promise<(PhotoMeta & { thumb: Blob })[]> {
    const db = await this.open();
    let rows: MetaRow[];
    if (!db) rows = [...this.memory.values()].map((x) => x.meta);
    else {
      rows = await new Promise<MetaRow[]>((res, rej) => {
        const rq = db.transaction('meta', 'readonly').objectStore('meta').getAll();
        rq.onsuccess = () => res(rq.result as MetaRow[]);
        rq.onerror = () => rej(rq.error);
      });
    }
    return rows.sort((a, b) => b.takenAt - a.takenAt || b.id - a.id);
  }

  /** 元の大きさの写真（無ければ null） */
  async image(id: number): Promise<Blob | null> {
    const db = await this.open();
    if (!db) return this.memory.get(id)?.image ?? null;
    return new Promise((res, rej) => {
      const rq = db.transaction('image', 'readonly').objectStore('image').get(id);
      rq.onsuccess = () => res((rq.result as Blob | undefined) ?? null);
      rq.onerror = () => rej(rq.error);
    });
  }

  /** 写真を消す */
  async remove(id: number): Promise<void> {
    const db = await this.open();
    if (!db) { this.memory.delete(id); this.onChange?.(); return; }
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(['meta', 'image'], 'readwrite');
      tx.objectStore('meta').delete(id);
      tx.objectStore('image').delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    this.onChange?.();
  }
}
