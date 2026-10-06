/**
 * 図鑑（v1 ui/FloorCodex.ts の作り直し）: 見つけた仕掛け・異変・レア部屋・隠しと、歩いたフロアの記録（調査率）。
 * 世界をまたいで残る（v1 と同じ）。保存はクライアントの localStorage 'liminal2.codex.v1'（Settings と同じく保存先を差し替えられる）。
 * DOM・three に依存しない（Node の試験で使える）。v1 の画像（IndexedDB）は持たない。
 *
 * - find(kind, id, label): 初めて見つけたら true（図鑑に「記録」と出す）。label は図鑑に出す名前（隠しは仕掛けの名前と目印）
 * - recordFloor / setSurvey: フロアの記録（初めて入った時刻・入った回数・調査率・完成・隠しの数）
 * 統合担当向け: client/map/MapController.ts が区画に入るたびに呼ぶ。表示は client/ui/CodexPanel.ts
 */
import { STORAGE_PREFIX } from '../env.ts';

export const CODEX_KEY = `${STORAGE_PREFIX}codex.v1`;

/** gimmick 仕掛け / anomaly 異変 / rare レア部屋 / secret 隠し（隠しの元 hook ごと）/ dest 隠しの行き先 */
export type CodexKind = 'gimmick' | 'anomaly' | 'rare' | 'secret' | 'dest';
export const CODEX_KINDS: readonly CodexKind[] = ['gimmick', 'anomaly', 'rare', 'secret', 'dest'];

export interface CodexFound {
  /** 初めて見つけた時刻（ISO） */
  first: string;
  /** 見つけた回数（フロアをまたいで） */
  count: number;
  /** 図鑑に出す名前（見つけたときの名前。隠しは仕掛けの名前と目印） */
  label?: string;
  /** 初めて見つけたフロア */
  floor?: string;
}

export interface FloorRecord {
  /** 世界の seed とフロアの id（例 '1:3.0'） */
  key: string;
  /** 表示名（B4F・B4F 裏） */
  label: string;
  rarity?: string;
  family?: string;
  first: string;
  visits: number;
  /** 調査率（0..1） */
  survey: number;
  complete: boolean;
  /** 隠しの数（見つけた / フロアにある）。全体の数は調査が完成すると図鑑に出る */
  secrets?: { found: number; total: number };
}

export interface CodexData {
  v: 1;
  found: Record<CodexKind, Record<string, CodexFound>>;
  floors: Record<string, FloorRecord>;
}

export type CodexStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** 覚えておくフロアの記録の数（古いものから忘れる） */
const MAX_FLOORS = 300;

const empty = (): CodexData => ({ v: 1, found: { gimmick: {}, anomaly: {}, rare: {}, secret: {}, dest: {} }, floors: {} });

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class Codex {
  private data: CodexData = empty();
  private storage: CodexStorage | null = null;
  private readonly listeners = new Set<() => void>();
  /** 時刻（試験で差し替える） */
  now: () => string = () => new Date().toISOString();

  static load(storage: CodexStorage | null = defaultStorage()): Codex {
    const c = new Codex();
    c.storage = storage;
    try {
      const raw = storage?.getItem(CODEX_KEY);
      if (raw) c.data = sanitizeCodex(JSON.parse(raw) as unknown);
    } catch {
      c.data = empty();
    }
    return c;
  }

  get snapshot(): Readonly<CodexData> { return this.data; }

  has(kind: CodexKind, id: string): boolean { return !!this.data.found[kind][id]; }
  get(kind: CodexKind, id: string): CodexFound | undefined { return this.data.found[kind][id]; }
  count(kind: CodexKind): number { return Object.keys(this.data.found[kind]).length; }

  /** 見つけた。初めてなら true */
  find(kind: CodexKind, id: string, label?: string, floor?: string): boolean {
    const r = this.data.found[kind][id];
    if (r) { r.count++; this.save(); return false; }
    const rec: CodexFound = { first: this.now(), count: 1 };
    if (label) rec.label = label;
    if (floor) rec.floor = floor;
    this.data.found[kind][id] = rec;
    this.save();
    this.emit();
    return true;
  }

  floor(key: string): FloorRecord | undefined { return this.data.floors[key]; }
  floors(): FloorRecord[] { return Object.values(this.data.floors).sort((a, b) => (a.first < b.first ? 1 : a.first > b.first ? -1 : 0)); }

  /** フロアに入った（初めてなら記録を作る。入った回数を数える） */
  recordFloor(key: string, label: string, extra: { rarity?: string; family?: string; secretsTotal?: number } = {}): FloorRecord {
    let r = this.data.floors[key];
    if (!r) {
      r = { key, label, first: this.now(), visits: 0, survey: 0, complete: false };
      if (extra.rarity) r.rarity = extra.rarity;
      if (extra.family) r.family = extra.family;
      this.data.floors[key] = r;
      this.prune();
    }
    r.visits++;
    if (extra.secretsTotal !== undefined) r.secrets = { found: r.secrets?.found ?? 0, total: extra.secretsTotal };
    this.save();
    this.emit();
    return r;
  }

  /** 調査率を書く（下がらない）。完成したら true を返す（初めての完成のときだけ） */
  setSurvey(key: string, survey: number, secretsFound?: number): boolean {
    const r = this.data.floors[key];
    if (!r) return false;
    const s = Math.max(r.survey, Math.min(1, Math.max(0, survey)));
    const was = r.complete;
    const changed = s !== r.survey || (secretsFound !== undefined && r.secrets && secretsFound > r.secrets.found);
    r.survey = s;
    if (s >= 0.9995) r.complete = true;
    if (secretsFound !== undefined && r.secrets) r.secrets.found = Math.max(r.secrets.found, secretsFound);
    if (changed || r.complete !== was) { this.save(); if (r.complete !== was) this.emit(); }
    return !was && r.complete;
  }

  onChange(f: () => void): () => void {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }

  save(): boolean {
    try {
      this.storage?.setItem(CODEX_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  private emit(): void { for (const f of this.listeners) f(); }

  private prune(): void {
    const all = Object.values(this.data.floors);
    if (all.length <= MAX_FLOORS) return;
    all.sort((a, b) => (a.first < b.first ? -1 : 1));
    for (const r of all.slice(0, all.length - MAX_FLOORS)) delete this.data.floors[r.key];
  }
}

/** 保存値を丸める（壊れた値・知らない項目は捨てる） */
export function sanitizeCodex(raw: unknown): CodexData {
  const out = empty();
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Partial<CodexData>;
  if (o.v !== 1) return out;
  for (const k of CODEX_KINDS) {
    const src = o.found?.[k];
    if (!src || typeof src !== 'object') continue;
    for (const [id, f] of Object.entries(src)) {
      if (!f || typeof f !== 'object' || typeof f.first !== 'string') continue;
      const rec: CodexFound = { first: f.first, count: typeof f.count === 'number' && f.count > 0 ? Math.floor(f.count) : 1 };
      if (typeof f.label === 'string') rec.label = f.label;
      if (typeof f.floor === 'string') rec.floor = f.floor;
      out.found[k][id] = rec;
    }
  }
  for (const [key, f] of Object.entries(o.floors ?? {})) {
    if (!f || typeof f !== 'object' || typeof f.label !== 'string' || typeof f.first !== 'string') continue;
    const r: FloorRecord = {
      key, label: f.label, first: f.first, visits: typeof f.visits === 'number' ? Math.max(0, Math.floor(f.visits)) : 0,
      survey: typeof f.survey === 'number' && Number.isFinite(f.survey) ? Math.min(1, Math.max(0, f.survey)) : 0, complete: f.complete === true,
    };
    if (typeof f.rarity === 'string') r.rarity = f.rarity;
    if (typeof f.family === 'string') r.family = f.family;
    if (f.secrets && typeof f.secrets.found === 'number' && typeof f.secrets.total === 'number') r.secrets = { found: f.secrets.found, total: f.secrets.total };
    out.floors[key] = r;
  }
  return out;
}
