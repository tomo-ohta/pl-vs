/**
 * ユーザー設定（音量 3 種・視点感度・品質 Tier・撮像プリセット・カメラ挙動）の永続化（v1 core/Settings.ts から移植）。
 * localStorage 'liminal2.settings.v1'（v1 の liminal.* と同じ公開元に置くので名前を分ける。client/env.ts の STORAGE_PREFIX）。
 *
 * v2 での変更: v1 の旧キー（liminal.settings.v1 / v2 / v3）からの移行と、旧値 'archival'（描画効果）の読み替えは持たない（v2 は新しく始める）。
 * 項目・既定値・値の丸め方（sanitize）は v1 と同じ。
 *
 * 統合担当向け: 呼び出し方
 *   const settings = Settings.load();                      // 起動時に 1 回
 *   settings.onChange((d, changed) => { input.sensitivityScale = d.lookSensitivity; if (changed.includes('tier')) applyTier(d.tier); });
 *   settings.set({ masterVolume: 0.5 });                   // 変更 → 即 save + onChange 通知（AudioEngine は自分で購読する）
 *   settings.data.tier                                      // 'auto' | 'low' | 'mid' | 'high'（SettingsPanel の「品質」で変わる）
 * DOM / Web Audio に依存しない（Node でも import できる。tests/settings-store.test.ts）。
 *
 * カメラ挙動（v1 docs/film-camera.md）: postfx は撮像プリセット（FilmPreset）、handheld / cameraLag は表示カメラだけに効く
 * （判定・移動方向・保存される yaw / pitch は変わらない）。recOverlay は REC・タイムコードの DOM 表示（ui/RecOverlay.ts）、
 * frameHold は VideoPass の表示フレームレートの間引き（'off' = プリセット値のまま。tape 以外でも指定できる）。
 */
import { STORAGE_PREFIX } from '../env.ts';
import { isFilmPreset, type FilmPreset } from '../render/FilmPreset.ts';
import type { QualityTierId } from '../render/quality.ts';

/** 描画効果（撮像プリセット） */
export type PostFxPreset = FilmPreset;
/** 表示フレームレートの間引き（VideoPass.params.frameHold）。'off' = プリセット値のまま */
export type FrameHoldId = 'off' | '30' | '24';
/** トーンマップ（開発用の切替。既定は v1 docs/postfx.md の比較で採用したもの） */
export type ToneMappingId = 'aces' | 'agx';
/** タブレットのカメラの写真の見た目: clean タブレットのカメラらしい（ビデオのにじみ・走査線・レンズの癖なし）/ video 画面と同じビデオ調 */
export type PhotoLookId = 'clean' | 'video';

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
  /** 手持ち感（0〜1。0 で歩行の上下動・ロール・呼吸・ふらつき・ズームのゆらぎが完全に無効） */
  handheld: number;
  /** 視線の遅れ（マウス / スワイプ入力に対する表示 yaw / pitch の 50 ms の追従） */
  cameraLag: boolean;
  /** REC・タイムコード表示 */
  recOverlay: boolean;
  /** 表示フレームレートの間引き */
  frameHold: FrameHoldId;
  /** VHS 効果の強さ（0〜2。1 = プリセットの値そのまま。VideoPass の各効果に掛かる） */
  vhsStrength: number;
  /** トーンマップ */
  toneMapping: ToneMappingId;
  /** 遊ぶ人の名前（12 文字まで。部屋の異変「自分の名前」の掲示・名札に出る。空なら既定の呼び名） */
  playerName: string;
  /** タブレットのカメラの写真の見た目 */
  photoLook: PhotoLookId;
}

/** 保存名（liminal2.settings.v1）。項目の意味を変えたら版を上げる */
export const SETTINGS_KEY = `${STORAGE_PREFIX}settings.v1`;

export const DEFAULT_SETTINGS: Readonly<SettingsData> = {
  masterVolume: 0.25,
  ambientVolume: 1.0,
  sfxVolume: 1.0,
  lookSensitivity: 1.0,
  tier: 'auto',
  postfx: 'tape',
  handheld: 0.6,
  cameraLag: true,
  recOverlay: true,
  vhsStrength: 2.0,
  frameHold: 'off',
  toneMapping: 'agx',
  playerName: '',
  photoLook: 'clean',
};

/** 保存先（localStorage の一部。テストでは差し替える） */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

type Listener = (data: Readonly<SettingsData>, changed: (keyof SettingsData)[]) => void;

export class Settings {
  private _data: SettingsData;
  private readonly listeners = new Set<Listener>();

  constructor(initial?: Partial<SettingsData>) {
    this._data = sanitize({ ...DEFAULT_SETTINGS, ...(initial ?? {}) });
  }

  /** localStorage から復元（壊れている・無い場合は既定値）。storage を渡すとそこから読み、そこへ保存する */
  static load(storage: SettingsStorage | null = defaultStorage()): Settings {
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

  private storage: SettingsStorage | null = defaultStorage();

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

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** 撮像プリセット。知らない値は既定（tape） */
function filmPreset(v: unknown): FilmPreset {
  return isFilmPreset(v) ? v : DEFAULT_SETTINGS.postfx;
}

/** 保存値・部分更新の値を範囲と選択肢に丸める（型が違う・範囲外・知らない選択肢は既定値かクランプ） */
export function sanitize(d: SettingsData): SettingsData {
  const sens = typeof d.lookSensitivity === 'number' && Number.isFinite(d.lookSensitivity) ? d.lookSensitivity : DEFAULT_SETTINGS.lookSensitivity;
  const tier = d.tier === 'low' || d.tier === 'mid' || d.tier === 'high' || d.tier === 'auto' ? d.tier : 'auto';
  const frameHold: FrameHoldId = d.frameHold === 'off' || d.frameHold === '30' || d.frameHold === '24' ? d.frameHold : DEFAULT_SETTINGS.frameHold;
  const toneMapping = d.toneMapping === 'aces' || d.toneMapping === 'agx' ? d.toneMapping : DEFAULT_SETTINGS.toneMapping;
  return {
    masterVolume: clamp01(d.masterVolume, DEFAULT_SETTINGS.masterVolume),
    ambientVolume: clamp01(d.ambientVolume, DEFAULT_SETTINGS.ambientVolume),
    sfxVolume: clamp01(d.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    lookSensitivity: Math.min(3, Math.max(0.3, sens)),
    tier,
    postfx: filmPreset(d.postfx),
    handheld: clamp01(d.handheld, DEFAULT_SETTINGS.handheld),
    cameraLag: bool(d.cameraLag, DEFAULT_SETTINGS.cameraLag),
    recOverlay: bool(d.recOverlay, DEFAULT_SETTINGS.recOverlay),
    frameHold,
    vhsStrength: typeof d.vhsStrength === 'number' && Number.isFinite(d.vhsStrength) ? Math.min(2, Math.max(0, d.vhsStrength)) : DEFAULT_SETTINGS.vhsStrength,
    toneMapping,
    playerName: cleanName(d.playerName),
    photoLook: d.photoLook === 'video' ? 'video' : 'clean',
  };
}

/** 名前: 文字列で、制御文字を除き、前後の空白を落として 12 文字まで */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return [...v.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 12).join('');
}
