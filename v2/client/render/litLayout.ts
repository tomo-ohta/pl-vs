/**
 * 焼き込み照明（SurfaceLighting）が読む区画のデータ。v1 の RoomLayout の代わり（v2 の CellLayout から必要な所だけを取る）。
 * - bounds: 床の高さ（min[1] + 0.2 が床面）・器具の向き・Worker の遮蔽体グリッドの範囲
 * - footprint: 壁のプレート（壁灯・非常口サイン）が室内側を向く判定
 * - boxes: 発光箱 → 器具、遮蔽体
 * - lights: 発光箱が 1 つも無いときの点光源
 * - palette: 環境光（ambient）と器具の色温度（lightColor）
 * - lighting: 平行光・空の環境光・遮蔽判定・面発光箱の上書き（SurfaceLighting の既定の opts）
 * - height: 天井の高さ。SurfaceLighting 自体は読まない（同じ値を MaterialLibrary.forRoom の部屋別 envMap の高さに渡すため、区画の形として持つ）
 * 座標は箱と同じ空間（v2 はフロア座標）なら何でもよい。CellLayout はそのまま渡せる
 */
import type { CellLayout } from '../../core/world/layout.ts';

export type LitLayout = Pick<CellLayout, 'bounds' | 'footprint' | 'height' | 'boxes' | 'lights' | 'palette' | 'lighting'>;
