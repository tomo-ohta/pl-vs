/**
 * ユーザー設定（音量 3 種・視点感度・品質 Tier）の永続化。localStorage 'liminal.settings.v1'。
 *
 * 統合担当向け: 呼び出し方
 *   const settings = Settings.load();                      // 起動時に 1 回
 *   settings.onChange((d) => { audio.setVolumes(d); input.sensitivityScale = d.lookSensitivity; });
 *   settings.set({ masterVolume: 0.5 });                   // 変更 → 即 save + onChange 通知
 *   settings.data.tier                                      // 'auto' | 'low' | 'mid' | 'high'（Game.bindMenu の #quality と同期させる）
 * DOM / Web Audio に依存しない（Node でも import できる）。
 */
import type { QualityTierId } from './types';

/** 描画効果（V07）: off = 直接描画（composer 無し）/ clean = Tier の GTAO・bloom・MSAA だけ / archival = clean + 控えめな古い撮像表現 */
export type PostFxPreset = 'off' | 'clean' | 'archival';
/** トーンマップ（開発用の切替。既定は docs/postfx.md の比較で採用したもの） */
export type ToneMappingId = 'aces' | 'agx';

export interface SettingsData {
  /** 0〜1 */
  masterVolume: number;
  /** 0〜1 */
  ambientVolume: number;
  /** 0〜1 */
  sfxVolume: number;
  /** 視点感度の倍率（0.3〜3。InputController の pcSensitivity / mobileSensitivity に掛ける） */
  lookSensitivity: number;
  /** 品質 Tier（'auto' は自動昇降） */
  tier: 'auto' | QualityTierId;
  /** 描画効果（ポスト処理 / 撮像プリセット。Tier とは独立） */
  postfx: PostFxPreset;
  /** トーンマップ */
  toneMapping: ToneMappingId;
}

export const SETTINGS_KEY = 'liminal.settings.v1';

export const DEFAULT_SETTINGS: Readonly<SettingsData> = {
  masterVolume: 0.8,
  ambientVolume: 1.0,
  sfxVolume: 1.0,
  lookSensitivity: 1.0,
  tier: 'auto',
  postfx: 'clean',
  toneMapping: 'agx',
};

type Listener = (data: Readonly<SettingsData>, changed: (keyof SettingsData)[]) => void;

export class Settings {
  private _data: SettingsData;
  private readonly listeners = new Set<Listener>();

  constructor(initial?: Partial<SettingsData>) {
    this._data = sanitize({ ...DEFAULT_SETTINGS, ...(initial ?? {}) });
  }

  /** localStorage から復元（壊れている・無い場合は既定値） */
  static load(storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage()): Settings {
    let parsed: Partial<SettingsData> = {};
    try {
      const raw = storage?.getItem(SETTINGS_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as unknown;
        if (obj && typeof obj === 'object') parsed = obj as Partial<SettingsData>;
      }
    } catch {
      parsed = {};
    }
    const s = new Settings(parsed);
    s.storage = storage;
    return s;
  }

  private storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage();

  get data(): Readonly<SettingsData> {
    return this._data;
  }

  /** 部分更新。値は範囲にクランプし、変化があれば保存して通知する */
  set(patch: Partial<SettingsData>): void {
    const next = sanitize({ ...this._data, ...patch });
    const changed = (Object.keys(next) as (keyof SettingsData)[]).filter((k) => next[k] !== this._data[k]);
    if (changed.length === 0) return;
    this._data = next;
    this.save();
    for (const l of this.listeners) l(this._data, changed);
  }

  reset(): void {
    this.set({ ...DEFAULT_SETTINGS });
  }

  save(): boolean {
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this._data));
      return true;
    } catch {
      return false;
    }
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function clamp01(v: unknown, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(1, Math.max(0, n));
}

function sanitize(d: SettingsData): SettingsData {
  const sens = typeof d.lookSensitivity === 'number' && Number.isFinite(d.lookSensitivity) ? d.lookSensitivity : DEFAULT_SETTINGS.lookSensitivity;
  const tier = d.tier === 'low' || d.tier === 'mid' || d.tier === 'high' || d.tier === 'auto' ? d.tier : 'auto';
  const postfx = d.postfx === 'off' || d.postfx === 'clean' || d.postfx === 'archival' ? d.postfx : DEFAULT_SETTINGS.postfx;
  const toneMapping = d.toneMapping === 'aces' || d.toneMapping === 'agx' ? d.toneMapping : DEFAULT_SETTINGS.toneMapping;
  return {
    masterVolume: clamp01(d.masterVolume, DEFAULT_SETTINGS.masterVolume),
    ambientVolume: clamp01(d.ambientVolume, DEFAULT_SETTINGS.ambientVolume),
    sfxVolume: clamp01(d.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    lookSensitivity: Math.min(3, Math.max(0.3, sens)),
    tier,
    postfx,
    toneMapping,
  };
}
