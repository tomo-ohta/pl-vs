/**
 * 撮像プリセット（設定「描画効果」）。
 * - off: composer 無し（Tier の GTAO / bloom / MSAA も含めて直接描画）
 * - clean: Tier の GTAO / bloom / MSAA + 露出・ホワイトバランスの追従と弱い色調整だけ（撮像の癖は付けない）
 * - homeVideo: 保存状態の良い古い家庭用ビデオ（過去案の 8 項目: 色調整・ハイライトのにじみ・色のにじみ・暗部ノイズ・周辺減光・レンズ歪み・露出追従・手持ち感）
 * - tape: homeVideo に走査線・テープの揺れ・ヘッド切替ノイズ・フレーム間引きなどの露骨な効果を足す
 * 各 pass の数値は LensPass.LENS_PRESETS / VideoPass.VIDEO_PRESETS、カメラ挙動は PlayerController 側の CAMERA_PRESETS
 */
export type FilmPreset = 'off' | 'clean' | 'homeVideo' | 'tape';
export const FILM_PRESET_IDS: readonly FilmPreset[] = ['off', 'clean', 'homeVideo', 'tape'];
export function isFilmPreset(v: unknown): v is FilmPreset {
  return v === 'off' || v === 'clean' || v === 'homeVideo' || v === 'tape';
}
