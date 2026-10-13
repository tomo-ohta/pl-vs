/**
 * v2 の client/env.ts の代わり（vite.config.ts の labEnv が、v2 のファイルからの `../env.ts` をここへ差し替える）。
 * v2 のタブレットをそのまま読み込むが、写真・SNS・設定（投稿者の名前）・端末の id の保存先は、ゲーム（liminal2.*）と分ける。
 * GitHub Pages ではゲーム（/pl-vs/v2/）と同じ公開元なので、名前を変えないと同じ IndexedDB・localStorage を使ってしまう。
 * 書き出す物は v2 の env.ts と同じ（STORAGE_PREFIX だけ違う）
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env;

export const ASSET_BASE: string = env?.VITE_ASSET_BASE ?? env?.BASE_URL ?? '/';
/** 見た目の検証ステージの保存先（写真 `vsl.photos`・SNS `vsl.sns`・端末の id `vsl.playerId`・設定 `vsl.settings.v1`） */
export const STORAGE_PREFIX = 'vsl.';
export const assetUrl = (path: string): string => ASSET_BASE.replace(/\/?$/, '/') + path.replace(/^\//, '');
