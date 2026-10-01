/**
 * フロアの記録（第21回。メニューの「フロアリスト」）。世界をまたいで残る「踏破したフロア」の図鑑。
 *
 * - 記録: localStorage 'liminal.codex.v1' = { v: 1, floors: { [definitionId]: FloorRecord } }（数十 KB）
 * - 画像: IndexedDB 'liminal-codex' / store 'thumbs'（key = definitionId、value = JPEG の data URL。1 枚 8〜15 KB）。
 *   IndexedDB が使えない環境（プライベートブラウズ等）はメモリだけ（再読み込みで消える）
 * - Game が入室ごとに record()、初めての画像は入室の 2.5 s 後に setThumb()。旧いセーブで踏破済みの部屋は openMenu で mergeWorld() が拾う
 */
export interface FloorRecord {
  /** 初めて踏破した日時（ISO） */
  first: string;
  /** 入室した回数（世界をまたいで累計） */
  visits: number;
  /** 見つけた階（floorLabel の元の level）の最小・最大 */
  levelMin: number;
  levelMax: number;
  /** 画像があるか（実体は IndexedDB） */
  thumb?: boolean;
}

const KEY = 'liminal.codex.v1';
const DB = 'liminal-codex';
const STORE = 'thumbs';

export class FloorCodex {
  private floors = new Map<string, FloorRecord>();
  private thumbs = new Map<string, string>();
  private db: IDBDatabase | null = null;
  private readonly listeners = new Set<() => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** 画像を読み終えたか（読み終えるまで has は記録だけで答える） */
  ready: Promise<void>;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const j = JSON.parse(raw) as { v?: number; floors?: Record<string, FloorRecord> };
        if (j && j.v === 1 && j.floors) for (const [k, v] of Object.entries(j.floors)) this.floors.set(k, v);
      }
    } catch { /* 記録なし */ }
    this.ready = this.openDb().then(() => this.loadThumbs()).catch(() => undefined);
  }

  get size(): number { return this.floors.size; }
  get(id: string): FloorRecord | undefined { return this.floors.get(id); }
  thumb(id: string): string | undefined { return this.thumbs.get(id); }
  hasThumb(id: string): boolean { return this.thumbs.has(id); }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** 入室を記録する（新しいフロアなら true） */
  record(id: string, level: number): boolean {
    const r = this.floors.get(id);
    if (r) {
      r.visits++;
      r.levelMin = Math.min(r.levelMin, level);
      r.levelMax = Math.max(r.levelMax, level);
      this.scheduleSave();
      return false;
    }
    this.floors.set(id, { first: new Date().toISOString(), visits: 1, levelMin: level, levelMax: level });
    this.scheduleSave();
    this.emit();
    return true;
  }

  /** 旧いセーブ・記録前に踏破した部屋を拾う（visits は増やさない） */
  mergeWorld(entries: Iterable<{ id: string; level: number }>): void {
    let changed = false;
    for (const { id, level } of entries) {
      const r = this.floors.get(id);
      if (r) {
        if (level < r.levelMin || level > r.levelMax) { r.levelMin = Math.min(r.levelMin, level); r.levelMax = Math.max(r.levelMax, level); changed = true; }
        continue;
      }
      this.floors.set(id, { first: new Date().toISOString(), visits: 1, levelMin: level, levelMax: level });
      changed = true;
    }
    if (changed) { this.scheduleSave(); this.emit(); }
  }

  /** 画像を保存する（data URL） */
  setThumb(id: string, dataUrl: string): void {
    this.thumbs.set(id, dataUrl);
    const r = this.floors.get(id);
    if (r) r.thumb = true;
    this.scheduleSave();
    this.emit();
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(dataUrl, id);
    } catch { /* 保存できない環境はメモリだけ */ }
  }

  private emit(): void { for (const fn of this.listeners) fn(); }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const floors: Record<string, FloorRecord> = {};
        for (const [k, v] of this.floors) floors[k] = v;
        localStorage.setItem(KEY, JSON.stringify({ v: 1, floors }));
      } catch { /* 容量不足など: 次回に持ち越し */ }
    }, 400);
  }

  private openDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  private loadThumbs(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.db) { resolve(); return; }
      try {
        const tx = this.db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) { this.emit(); resolve(); return; }
          if (typeof cur.value === 'string') this.thumbs.set(String(cur.key), cur.value);
          cur.continue();
        };
        req.onerror = () => resolve();
      } catch { resolve(); }
    });
  }
}
