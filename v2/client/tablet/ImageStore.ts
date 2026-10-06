/**
 * 写真の入れ物（ブラウザの中。IndexedDB）: 情報と小さい写真（一覧用）は 'meta'、元の大きさの写真は 'image' に分けて持つ
 * （一覧を出すときに大きい写真を読まない）。ギャラリーの写真（PhotoStore）と SNS の投稿（PostStore）が使う。
 * IndexedDB が使えない（Node の試験・保存を拒むブラウザの設定）ときは、ページを開いている間だけ覚える（memory）
 */

type Row<M> = M & { thumb: Blob };

export class ImageStore<M extends { id: number }> {
  private db: Promise<IDBDatabase | null> | null = null;
  /** IndexedDB が使えないときの入れ物 */
  private readonly memory = new Map<number, { meta: Row<M>; image: Blob }>();
  private nextId = 1;
  private readonly dbName: string;
  private readonly useIdb: boolean;
  private readonly order: (a: M, b: M) => number;
  /** 変わったとき（一覧を描き直す） */
  onChange: (() => void) | null = null;

  // パラメータプロパティは使わない（Node の型ストリップで読めるように）
  constructor(dbName: string, order: (a: M, b: M) => number, useIdb = typeof indexedDB !== 'undefined') {
    this.dbName = dbName;
    this.order = order;
    this.useIdb = useIdb;
  }

  private open(): Promise<IDBDatabase | null> {
    if (!this.useIdb) return Promise.resolve(null);
    this.db ??= new Promise((res) => {
      try {
        const rq = indexedDB.open(this.dbName, 1);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id', autoIncrement: true });
          if (!db.objectStoreNames.contains('image')) db.createObjectStore('image');
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => { console.warn(`[${this.dbName}] IndexedDB を開けません。開いている間だけ覚えます`, rq.error); res(null); };
        rq.onblocked = () => res(null);
      } catch (e) {
        console.warn(`[${this.dbName}] IndexedDB を使えません。開いている間だけ覚えます`, e);
        res(null);
      }
    });
    return this.db;
  }

  /** 足す（id を付けて返す） */
  async add(meta: Omit<M, 'id'>, image: Blob, thumb: Blob): Promise<M> {
    const db = await this.open();
    if (!db) {
      const id = this.nextId++;
      const m = { ...meta, id } as M;
      this.memory.set(id, { meta: { ...m, thumb }, image });
      this.onChange?.();
      return m;
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
    return { ...meta, id } as M;
  }

  /** 全部の情報と小さい写真（決めた順） */
  async list(): Promise<Row<M>[]> {
    const db = await this.open();
    let rows: Row<M>[];
    if (!db) rows = [...this.memory.values()].map((x) => x.meta);
    else {
      rows = await new Promise<Row<M>[]>((res, rej) => {
        const rq = db.transaction('meta', 'readonly').objectStore('meta').getAll();
        rq.onsuccess = () => res(rq.result as Row<M>[]);
        rq.onerror = () => rej(rq.error);
      });
    }
    return rows.sort(this.order);
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

  /** 消す */
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
