/**
 * ポスト処理（EffectComposer）と描画時間の計測。Game が 1 つ所有する。
 *
 * パイプライン（すべて three.js 付属の addons。外部パッケージなし）:
 *   RenderPass（scene → HalfFloat RT、MSAA samples = Tier.postfx.msaa）
 *   → GTAOPass（画面空間の遮蔽。Tier.postfx.gtaoScale の解像度で計算し、乗算合成）
 *   → UnrealBloomPass（閾値高め・弱い強度。発光箔だけが滲む）
 *   → LensPass（撮像プリセット off 以外。線形 HDR: レンズ歪み・色収差・軟焦点・かすみ・露出 / WB 追従など。src/render/LensPass.ts）
 *   → OutputPass（renderer.toneMapping + sRGB 変換を **ここで 1 回だけ**）
 *   → VideoPass（撮像プリセット off 以外。表示域: 色調整・色のにじみ・暗部ノイズ・走査線など。画面へ描く。src/render/VideoPass.ts）
 *
 * トーンマップの二重適用について: three.js は RenderTarget へ描く材質のトーンマップと出力色空間変換を自動で無効化する
 * （WebGLRenderer.getProgram の toneMapping / outputColorSpace は画面描画時だけ有効）。renderer.toneMapping は
 * 直接描画（composer 無し）では材質側で、composer 使用時は OutputPass だけで働く。
 *
 * gtao / bloom が false・msaa = 0・撮像プリセット 'off' なら composer を作らず renderer.render で直接描画する（設定 'off'、low Tier の 'clean'）。
 * resize / DPR / Tier 変更は setSize / configure で RenderTarget を作り直す。dispose で全て解放。
 *
 * 既知の制約: composer 使用時は toneMapped = false の材質（SignAtlas の板サインなど）も OutputPass でトーンマップされる。
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { LensPass } from './LensPass';
import { VideoPass } from './VideoPass';
import type { FilmPreset } from './FilmPreset';

export type ToneMappingId = 'aces' | 'agx';
export const TONE_MAPPINGS: Record<ToneMappingId, THREE.ToneMapping> = {
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
};
/** 露出（旧 1.25。焼き込み側で「器具直下 : 器具の間 : 突き当たり ≈ 1 : 0.45 : 0.15」に調整する前提で下げる） */
export const DEFAULT_EXPOSURE = 1.0;

export interface PostFXConfig {
  gtao: boolean;
  bloom: boolean;
  /** RenderTarget の MSAA サンプル数（0 = なし） */
  msaa: number;
  /** GTAO の解像度倍率（0.5 = 半解像度） */
  gtaoScale: number;
  /** 撮像プリセット（LensPass / VideoPass。'off' で両 pass を置かない） */
  film: FilmPreset;
}

/** GTAO の調整値（屋内 2.4〜3 m の天井、机・椅子の接地の陰） */
export const GTAO_PARAMS = {
  radius: 0.28,
  distanceExponent: 1,
  thickness: 1,
  distanceFallOff: 1,
  scale: 1.0,
  samples: 12,
  blendIntensity: 0.45, // ライトマップに半球 AO が入ったので、画面空間の遮蔽は接地の補助程度に
  denoise: { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 2, rings: 2, samples: 12 },
};

/** ブルーム（閾値は線形 HDR の輝度。発光箔 emission 2.3〜2.8 だけが超え、壁面 < 1 は滲まない。scale: 明部抽出〜ミップの基準解像度 = 実解像度 × scale / 2） */
export const BLOOM_PARAMS = { strength: 0.12, radius: 0.3, threshold: 1.5, scale: 0.5 }; // 閾値を上げて黒い穴・消灯した器具・窓の夜景が灰色に浮かないようにする

interface Stats { median: number; p95: number; max: number; n: number }

/**
 * 1 フレームの CPU 時間（renderFrame の呼び出し時間）と GPU 時間（EXT_disjoint_timer_query_webgl2。無ければ null）。
 * 直近 120 フレームの中央値 / p95 / 最大を返す
 */
export class FrameTimer {
  private readonly gl: WebGL2RenderingContext | null;
  private readonly ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private active: WebGLQuery | null = null;
  private readonly pending: WebGLQuery[] = [];
  private cpuStart = 0;
  readonly cpu: number[] = [];
  readonly gpu: number[] = [];
  static WINDOW = 120;

  constructor(renderer: THREE.WebGLRenderer) {
    const gl = renderer.getContext();
    this.gl = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? gl : null;
    this.ext = (this.gl?.getExtension('EXT_disjoint_timer_query_webgl2') as FrameTimer['ext']) ?? null;
  }

  get gpuAvailable(): boolean { return this.ext !== null; }

  begin(): void {
    this.cpuStart = performance.now();
    if (!this.gl || !this.ext || this.active) return;
    this.poll();
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end(): void {
    this.push(this.cpu, performance.now() - this.cpuStart);
    if (!this.gl || !this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** 結果が出た GPU クエリを取り込む */
  poll(): void {
    const gl = this.gl;
    const ext = this.ext;
    if (!gl || !ext) return;
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
      if (disjoint) {
        for (const p of this.pending) gl.deleteQuery(p);
        this.pending.length = 0;
        break;
      }
      this.push(this.gpu, (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6);
      gl.deleteQuery(q);
      this.pending.shift();
    }
  }

  /** 保留中の GPU クエリが全て解決するまで待つ（計測スクリプト用） */
  async flush(timeoutMs = 2000): Promise<void> {
    const t0 = performance.now();
    while (this.pending.length && performance.now() - t0 < timeoutMs) {
      this.poll();
      if (this.pending.length) await new Promise((r) => setTimeout(r, 4));
    }
  }

  reset(): void {
    this.cpu.length = 0;
    this.gpu.length = 0;
  }

  stats(): { cpu: Stats | null; gpu: Stats | null } {
    return { cpu: summarize(this.cpu), gpu: summarize(this.gpu) };
  }

  dispose(): void {
    if (this.gl) {
      if (this.active) this.gl.deleteQuery(this.active);
      for (const q of this.pending) this.gl.deleteQuery(q);
    }
    this.active = null;
    this.pending.length = 0;
  }

  private push(arr: number[], v: number): void {
    arr.push(v);
    if (arr.length > FrameTimer.WINDOW) arr.splice(0, arr.length - FrameTimer.WINDOW);
  }
}

function summarize(a: number[]): Stats | null {
  if (a.length === 0) return null;
  const s = [...a].sort((x, y) => x - y);
  return { median: s[s.length >> 1], p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], max: s[s.length - 1], n: s.length };
}

/** scene.background（Color）を法線 / 深度パスの間だけ外す（GTAOPass は「法線なし」を 0x7777ff のクリア色で表すが、背景色のクリアがそれを上書きする） */
class RoomGTAOPass extends GTAOPass {
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
    const bg = this.scene.background;
    this.scene.background = null;
    try {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    } finally {
      this.scene.background = bg;
    }
  }
}

/**
 * MSAA をシーン描画だけに限定する RenderPass。composer の ping-pong バッファは非マルチサンプル（HalfFloat・深度なし）にし、
 * シーンは自前の MSAA RenderTarget に描いてから readBuffer へ 1 回だけコピー（= resolve）する。
 * 従来は composer の両バッファが MSAA だったため、後段の全 pass（GTAO 合成・bloom 合成・Lens・Output・Video）が
 * 描くたびに resolve が走り、1080p で 2.5〜4 ms を無駄にしていた（担当 F1b の計測）
 */
class MsaaRenderPass extends RenderPass {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly copy: FullScreenQuad;
  private readonly copyMat: THREE.ShaderMaterial;
  constructor(scene: THREE.Scene, camera: THREE.Camera, samples: number) {
    super(scene, camera);
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.max(1, samples | 0), depthBuffer: true, stencilBuffer: false });
    this.target.texture.name = 'PostFX.msaa';
    this.copyMat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader, depthTest: false, depthWrite: false });
    this.copy = new FullScreenQuad(this.copyMat);
  }
  override setSize(width: number, height: number): void { this.target.setSize(width, height); }
  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
    if (this.renderToScreen) { super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive); return; }
    super.render(renderer, writeBuffer, this.target, deltaTime, maskActive);
    // MSAA → 単一サンプルへ（テクスチャとして読む時点で three が blit で resolve する）
    this.copyMat.uniforms.tDiffuse.value = this.target.texture;
    renderer.setRenderTarget(readBuffer);
    this.copy.render(renderer);
  }
  override dispose(): void { super.dispose(); this.target.dispose(); this.copyMat.dispose(); this.copy.dispose(); }
}

export class PostFX {
  composer: EffectComposer | null = null;
  gtaoPass: GTAOPass | null = null;
  bloomPass: UnrealBloomPass | null = null;
  lensPass: LensPass | null = null;
  videoPass: VideoPass | null = null;
  outputPass: OutputPass | null = null;
  private renderPass: RenderPass | null = null;
  config: PostFXConfig = { gtao: false, bloom: false, msaa: 0, gtaoScale: 0.5, film: 'off' };
  /** スクリーンショット用: 数値を入れるとノイズの種を固定する。null なら毎フレーム更新 */
  frozenSeed: number | null = null;
  private lastRenderAt = 0;
  private cameraMotion: [number, number] = [0, 0];
  private audioNoise = 0;
  private stillness = 0;
  readonly timer: FrameTimer;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private frame = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera) {
    this.timer = new FrameTimer(renderer);
  }

  /** composer を使っているか（false なら直接描画） */
  get active(): boolean { return this.composer !== null; }

  /** 構成を適用する。pass 構成か MSAA が変わるときだけ composer を作り直す */
  configure(cfg: PostFXConfig): void {
    const c = this.config;
    const same = this.composer !== null || !needsComposer(cfg)
      ? c.gtao === cfg.gtao && c.bloom === cfg.bloom && c.msaa === cfg.msaa && c.gtaoScale === cfg.gtaoScale && (c.film === 'off') === (cfg.film === 'off')
      : false;
    this.config = { ...cfg };
    if (same) {
      // pass 構成が同じでプリセットだけ変わった: 数値を写すだけ
      this.lensPass?.applyPreset(cfg.film);
      this.videoPass?.applyPreset(cfg.film);
      return;
    }
    this.disposeComposer();
    if (!needsComposer(cfg)) return;
    this.build();
  }

  private build(): void {
    const cfg = this.config;
    // MSAA はシーン描画だけ（MsaaRenderPass）。composer の ping-pong は非マルチサンプル・深度なし
    const msaa = Math.max(0, cfg.msaa | 0);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0, depthBuffer: msaa === 0, stencilBuffer: false });
    rt.texture.name = 'PostFX.rt1';
    const composer = new EffectComposer(this.renderer, rt);
    this.renderPass = msaa > 0 ? new MsaaRenderPass(this.scene, this.camera, msaa) : new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);
    if (cfg.gtao) {
      const g = new RoomGTAOPass(this.scene, this.camera, 1, 1);
      g.output = GTAOPass.OUTPUT.Default;
      g.blendIntensity = GTAO_PARAMS.blendIntensity;
      g.updateGtaoMaterial({ radius: GTAO_PARAMS.radius, distanceExponent: GTAO_PARAMS.distanceExponent, thickness: GTAO_PARAMS.thickness, distanceFallOff: GTAO_PARAMS.distanceFallOff, scale: GTAO_PARAMS.scale, samples: GTAO_PARAMS.samples, screenSpaceRadius: false });
      g.updatePdMaterial(GTAO_PARAMS.denoise);
      // composer は全 pass に実解像度を渡す。GTAO だけ倍率を掛けた解像度で計算し、合成時にバイリニアで拡大する
      const scale = Math.min(1, Math.max(0.25, cfg.gtaoScale || 1));
      const base = GTAOPass.prototype.setSize;
      g.setSize = (w: number, h: number) => base.call(g, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
      composer.addPass(g);
      this.gtaoPass = g;
      g.enabled = !this.aoSuppressed;
    }
    if (cfg.bloom) {
      const b = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_PARAMS.strength, BLOOM_PARAMS.radius, BLOOM_PARAMS.threshold);
      // 滲みは低周波なので、明部抽出とミップ鎖は実解像度 × scale（既定 1/2 → 基準ミップは 1/4 解像度）で十分。合成時にバイリニアで拡大する
      const baseB = UnrealBloomPass.prototype.setSize;
      const bs = BLOOM_PARAMS.scale;
      b.setSize = (w: number, h: number) => baseB.call(b, Math.max(2, Math.round(w * bs)), Math.max(2, Math.round(h * bs)));
      composer.addPass(b);
      this.bloomPass = b;
    }
    if (cfg.film !== 'off') {
      const lens = new LensPass(this.scene, this.camera);
      lens.applyPreset(cfg.film);
      lens.setDepthTexture(this.gtaoPass && !this.aoSuppressed ? this.gtaoPass.depthTexture : null);
      composer.addPass(lens);
      this.lensPass = lens;
    }
    this.outputPass = new OutputPass();
    composer.addPass(this.outputPass);
    if (cfg.film !== 'off') {
      const video = new VideoPass();
      video.applyPreset(cfg.film);
      composer.addPass(video);
      this.videoPass = video;
    }
    this.composer = composer;
    this.applySize();
  }

  /** CSS ピクセルの寸法と DPR（renderer.setPixelRatio に渡した値）。RenderTarget を作り直す */
  setSize(width: number, height: number, pixelRatio: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.pixelRatio = Math.max(0.1, pixelRatio);
    this.applySize();
  }

  private applySize(): void {
    if (!this.composer) return;
    // renderer.setSize と同じく整数ピクセルに丸める（375 css px × DPR 1.5 = 562.5 のような端数の RenderTarget を作らない）
    const pw = Math.max(1, Math.floor(this.width * this.pixelRatio));
    const ph = Math.max(1, Math.floor(this.height * this.pixelRatio));
    this.composer.setPixelRatio(1);
    this.composer.setSize(pw, ph);
  }

  /** 1 フレーム描画（composer か直接描画）。renderer.info は 1 フレーム分（影・G バッファ・全 pass）を合算する */
  render(): void {
    this.frame++;
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    const now = performance.now();
    const dt = this.lastRenderAt ? Math.min(0.1, (now - this.lastRenderAt) / 1000) : 1 / 60;
    this.lastRenderAt = now;
    if (this.lensPass) {
      this.lensPass.setCameraMotion(this.cameraMotion[0], this.cameraMotion[1]);
      this.lensPass.update(dt, this.frame);
    }
    if (this.videoPass) {
      this.videoPass.frozenSeed = this.frozenSeed;
      this.videoPass.setAudioNoise(this.audioNoise);
      this.videoPass.setStillness(this.stillness);
      this.videoPass.update(dt, this.frame);
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /**
   * 画面空間 AO（GTAO）の一時停止。`render.style === 'untextured'` の部屋（M13 未描画空間）は焼き込みの遮蔽も切って
   * 「影のない白い虚空」にしているので、GTAO が床際と隅に戻す薄い影も止める（担当 M の依頼）。configure() で作り直しても保持する
   */
  setAoSuppressed(on: boolean): void {
    this.aoSuppressed = on;
    if (this.gtaoPass) this.gtaoPass.enabled = !on;
    // GTAO が止まると深度も更新されないので、LensPass には null を渡して自前の深度パスへ切り替えさせる（担当 F1a の依頼）
    this.lensPass?.setDepthTexture(!on && this.gtaoPass ? this.gtaoPass.depthTexture : null);
  }
  private aoSuppressed = false;

  // ------------------------------------------------------------ 撮像 pass への入力（Game が毎フレーム / イベントで渡す）
  /** カメラの回転速度（rad/s。回転だけのモーションブラー） */
  setCameraMotion(yawRate: number, pitchRate: number): void { this.cameraMotion[0] = yawRate; this.cameraMotion[1] = pitchRate; }
  /** 環境音の大きさ（0〜1。暗部ノイズと連動） */
  setAudioNoise(x: number): void { this.audioNoise = Math.max(0, Math.min(1, x)); }
  /** プレイヤーが静止している秒数（時間停止感） */
  setStillness(sec: number): void { this.stillness = Math.max(0, sec); }
  /** 入室直後: オートフォーカスの迷い */
  notifyRoomEnter(): void { this.lensPass?.notifyRoomEnter(); }

  /** デバッグ HUD 用の 1 行 */
  describe(): string {
    if (!this.composer) return 'direct';
    const c = this.config;
    return [c.gtao ? `gtao×${c.gtaoScale}` : null, c.bloom ? 'bloom' : null, c.msaa ? `msaa${c.msaa}` : null, c.film !== 'off' ? `film:${c.film}` : null].filter(Boolean).join('+') || 'composer';
  }

  private disposeComposer(): void {
    this.gtaoPass?.dispose();
    this.bloomPass?.dispose();
    this.lensPass?.dispose();
    this.videoPass?.dispose();
    this.outputPass?.dispose();
    this.renderPass?.dispose();
    this.composer?.dispose();
    this.gtaoPass = null;
    this.bloomPass = null;
    this.lensPass = null;
    this.videoPass = null;
    this.outputPass = null;
    this.renderPass = null;
    this.composer = null;
  }

  dispose(): void {
    this.disposeComposer();
    this.timer.dispose();
  }
}

function needsComposer(cfg: PostFXConfig): boolean {
  return cfg.gtao || cfg.bloom || cfg.film !== 'off' || cfg.msaa > 0;
}
