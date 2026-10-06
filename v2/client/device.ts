/**
 * 端末の判定（v1 core/device.ts から移植。window が無い環境では全て false）。
 * - IS_MOBILE: タッチが主入力の端末（pointer: coarse）
 * - SMALL_TEXTURES: スマホ向けの縮小テクスチャ（shared/public/cc0/materials-sm/・textures/liminal-sm/）を読む。`?tex=sm` / `?tex=full` で上書き
 * - KTX2_TEXTURES: CC0 素材を KTX2 で読む。`?ktx=off` で JPEG に戻す
 */
const hasWindow = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export const IS_MOBILE = hasWindow && window.matchMedia('(pointer: coarse)').matches;

const params = hasWindow ? new URLSearchParams(window.location.search) : new URLSearchParams();
const texParam = params.get('tex');
export const SMALL_TEXTURES = texParam === 'sm' ? true : texParam === 'full' ? false : IS_MOBILE;
export const KTX2_TEXTURES = params.get('ktx') !== 'off';
