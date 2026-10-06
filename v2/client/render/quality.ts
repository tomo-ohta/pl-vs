/**
 * 描画の品質 Tier（v1 core/types.ts の QualityTier / QUALITY_TIERS / mobileTier から移植）。
 * クライアント専用（サーバーは描画しない）。
 */
export type QualityTierId = 'low' | 'mid' | 'high';
/** ポスト処理（EffectComposer）の Tier 別機能。gtao / bloom が false で msaa 0 なら直接描画（src/render/PostFX.ts） */
export interface PostFxTier {
  /** 画面空間の遮蔽（GTAOPass） */
  gtao: boolean;
  /** 控えめなブルーム（UnrealBloomPass） */
  bloom: boolean;
  /** composer の RenderTarget の MSAA サンプル数（0 = なし） */
  msaa: number;
  /** GTAO の解像度倍率（0.5 = 半解像度） */
  gtaoScale: number;
}
export interface QualityTier {
  id: QualityTierId;
  renderScale: number;
  /** ポスト処理（composer）使用時の devicePixelRatio 上限（直接描画は従来どおり 2）。HiDPI で GTAO / bloom / MSAA の負荷を抑える */
  maxPixelRatio: number;
  maxLights: number;
  /** 視程の上限（scene.fog.far のクランプ・チャンク表示・camera.far） */
  fogFar: number;
  /** 霧の既定値（Game.applyEnvironment。部屋別 fog / layout.fogFar / FogDepth が無いときの near / far。far ≤ fogFar） */
  fogNear: number;
  fogDefaultFar: number;
  /** 影を落とす可視 PointLight の数（プレイヤーに近い順。0 = 影なし）と影マップの一辺（px。PointLight はキューブの各面） */
  shadowLights: number;
  shadowMapSize: number;
  postfx: PostFxTier;
  /** RenderTarget（監視映像・スナップショット）の更新頻度（Hz）。0 は静止キャプチャのみ */
  rtUpdateHz: number;
  /** 照明の明滅アニメーションを許可 */
  flicker: boolean;
  /** 水たまり・デカールなどの装飾箔を出す */
  decals: boolean;
  /** InstancedMesh の個数倍率（0〜1） */
  instanceScale: number;
  /** パーティクル上限 */
  particleCap: number;
  /** 残響に Convolver を使う（false ならフィードバックディレイ） */
  convolver: boolean;
}
export const QUALITY_TIERS: Record<QualityTierId, QualityTier> = {
  low: {
    id: 'low', renderScale: 0.65, maxPixelRatio: 2, maxLights: 2, fogFar: 40, fogNear: 6, fogDefaultFar: 40, shadowLights: 0, shadowMapSize: 0,
    rtUpdateHz: 0, flicker: false, decals: false, instanceScale: 0.4, particleCap: 150, convolver: false,
    postfx: { gtao: false, bloom: false, msaa: 0, gtaoScale: 0.5 },
  },
  mid: {
    id: 'mid', renderScale: 0.8, maxPixelRatio: 2, maxLights: 4, fogFar: 60, fogNear: 6, fogDefaultFar: 44, shadowLights: 1, shadowMapSize: 512,
    rtUpdateHz: 15, flicker: true, decals: true, instanceScale: 0.7, particleCap: 400, convolver: true,
    postfx: { gtao: false, bloom: true, msaa: 2, gtaoScale: 0.5 },
  },
  high: {
    id: 'high', renderScale: 1.0, maxPixelRatio: 1.25, maxLights: 8, fogFar: 90, fogNear: 6, fogDefaultFar: 48, shadowLights: 1, shadowMapSize: 1024,
    rtUpdateHz: 60, flicker: true, decals: true, instanceScale: 1.0, particleCap: 1000, convolver: true,
    postfx: { gtao: true, bloom: true, msaa: 2, gtaoScale: 0.4 },
  },
};

/**
 * スマホ（pointer: coarse）で使う Tier の上書き。PC より小さい GPU で同じ部屋を描くための差分だけを持つ。
 * - 画素密度は CSS ピクセル 1:1 まで（HiDPI の 2〜3 倍は撮像効果の軟焦点・走査線で見分けられない）
 * - 影（PointLight のキューブ影 = シーンを 6 回追加描画）・MSAA・GTAO は切る。ブルームは mid 以上だけ残す
 * - 監視映像・スナップショットの RenderTarget 更新は 10 Hz まで
 */
export function mobileTier(t: QualityTier): QualityTier {
  return {
    ...t,
    renderScale: t.id === 'low' ? 0.75 : 1.0,
    maxPixelRatio: 1,
    shadowLights: 0,
    shadowMapSize: 0,
    rtUpdateHz: Math.min(t.rtUpdateHz, 10),
    postfx: { ...t.postfx, gtao: false, msaa: 0 },
  };
}
