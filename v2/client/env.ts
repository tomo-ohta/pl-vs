/**
 * クライアントの環境設定。
 * - ASSET_BASE: 素材（cc0 / textures / audio / basis）の配信元。本番は v1 と同じ /pl-vs/ を指して素材を二重に置かない（継承計画 2 章）
 * - STORAGE_PREFIX: v1（liminal.*）と同じ公開元に置くので、保存領域の名前を分ける
 * Node（テスト）では import.meta.env が無いので '/' にする。
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env;

export const ASSET_BASE: string = env?.VITE_ASSET_BASE ?? env?.BASE_URL ?? '/';
export const STORAGE_PREFIX = 'liminal2.';
export const assetUrl = (path: string): string => ASSET_BASE.replace(/\/?$/, '/') + path.replace(/^\//, '');
