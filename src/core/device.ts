/**
 * 端末の判定（Node ハーネスでは window が無いので全て false）。
 * - IS_MOBILE: タッチが主入力の端末（pointer: coarse）。InputController の初期モードと同じ判定
 * - SMALL_TEXTURES: スマホ向けの縮小テクスチャ（public/cc0/materials-sm/・textures/liminal-sm/。tools/build-mobile-textures.mjs）を読む。
 *   `?tex=sm` / `?tex=full` で上書きできる
 */
const hasWindow = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export const IS_MOBILE = hasWindow && window.matchMedia('(pointer: coarse)').matches;

const texParam = hasWindow ? new URLSearchParams(window.location.search).get('tex') : null;
export const SMALL_TEXTURES = texParam === 'sm' ? true : texParam === 'full' ? false : IS_MOBILE;
