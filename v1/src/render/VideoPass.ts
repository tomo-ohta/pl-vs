/**
 * VideoPass — 映像記録系（ビデオの質感）の pass。OutputPass の**後**（トーンマップ済み・sRGB の表示域）に置き、画面へ描く。担当 F1b。
 * 効果: 色調整（彩度・白の偏り）/ 色のにじみ（クロマサブサンプリング）/ 暗部ノイズ（音量連動）/ 黒レベルの浮きと圧縮 /
 * ハイライトのニー / 走査線・インタレースのコーミング / テープの揺れ（水平同期ずれ）/ ヘッド切替ノイズ / JPEG・DCT ブロックの気配 /
 * フレームレートの間引き（30 / 24 fps 表示 + フレームブレンド）。タイムコード・REC 表示は DOM（src/ui/RecOverlay.ts）。
 * シェーダは src/render/shaders/VideoShader.ts、方式と数値の記録は docs/film-video.md。
 *
 * 描画経路（render）:
 *   - 前フレームが要らない（interlace = 0 かつ frameHold = 0）: single 材質で tDiffuse → 画面。RT なし（homeVideo / clean）
 *   - 要る（tape）: 色段（color 材質。tDiffuse + 前フレーム RT → もう片方の RT）→ 最終段（final 材質。RT → 画面）。
 *     RT は出力と同解像度の UnsignedByte × 2（ping-pong。読み書きを分けるため）。frameHold 中の「保持フレーム」は色段を飛ばして
 *     最終段だけ描く（揺れ・走査線・粒子は毎フレーム動く。中身は保持）
 *
 * PostFX との契約（公開 API。変えない）:
 *   - `params`（VideoParams）を毎フレーム uniform に写す。`applyPreset(p)` で VIDEO_PRESETS の値を写す
 *   - `frozenSeed`: 数値ならノイズの種を固定（スクリーンショット用）。新しい確率イベント（揺れ・ヘッド切替）も起こさない
 *   - `setAudioNoise(x)`: 0〜1（AudioEngine.ambientLevel。実測 0.02〜0.6）。暗部ノイズの強さを 1.0〜1.6 倍に連動させる（0.25 s で追従）
 *   - `setStillness(sec)`: 静止している秒数。3 s を超えたら揺れ・ヘッド切替を止める（時間停止感: 粒子だけが動く）
 *   - `update(dt, frame)`: composer.render の直前に PostFX が呼ぶ
 * 確認用（追加の公開 API）: `forceJitter(frames)` / `forceHeadSwitch(frames)` で低確率イベントを即時に出す
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import type { FilmPreset } from './FilmPreset';
import { VideoShader, createVideoUniforms, STILLNESS_CALM_SEC, type VideoUniforms } from './shaders/VideoShader';

export interface VideoParams {
  /** 彩度低下（0〜0.2） */
  desaturate: number;
  /** 白の偏り（RGB ゲイン。1 が無偏） */
  tint: [number, number, number];
  /** 色のにじみ（色差の横ぼかし半径。1080p 基準 px。0〜4） */
  chromaBlur: number;
  /** 暗部ノイズ（0〜0.03。振幅の半値。音量で 1.0〜1.6 倍） */
  noise: number;
  /** 色ノイズの割合（0〜1） */
  colorNoise: number;
  /** 黒レベルの浮き（0〜0.06） */
  blackLift: number;
  /** ハイライトのニー（0 = なし、1 = 強く潰す） */
  knee: number;
  /** 走査線（0〜1） */
  scanlines: number;
  /** インタレースのコーミング（0〜1。奇数行に前フレームを混ぜる割合） */
  interlace: number;
  /** テープの揺れ（水平同期ずれの確率 0〜1。1 で 1 秒に 4 回程度） */
  jitter: number;
  /** ヘッド切替ノイズ（画面下端の帯の確率 0〜1。1 で 1 秒に 3 回程度） */
  headSwitch: number;
  /** DCT ブロックの気配（0〜1） */
  dctBlocks: number;
  /** 表示フレームレートの間引き（0 = なし、24 / 30 = その fps に落としてブレンド） */
  frameHold: number;
  /** フレーム間引きの切り替え時に前フレームを残す割合（残像。0〜0.5。frameHold = 0 なら無効） */
  frameBlend: number;
  /** 輝度の横ぼかし半径（1080p 基準 px。VHS の輝度帯域 ≈ 240 本の甘さ。0〜3） */
  lumaBlur: number;
  /** 色差を右へずらす量（1080p 基準 px。色が輪郭より遅れる。0〜4） */
  chromaShift: number;
  /** 明部が右へ引きずる（テープの滲み。0〜1） */
  smear: number;
  /** 輪郭のリンギング（強調回路の出過ぎで縁に明暗の線。0〜1） */
  ringing: number;
  /** 四隅の減光（表示域。0〜0.4） */
  vignette: number;
  /** 行ごとの横揺れ（トラッキングの甘さ。1080p 基準 px。0〜2） */
  lineJitter: number;
  /** スノーノイズ（暗部に白い点。0〜1） */
  snow: number;
  /** 画面下端の常時トラッキング帯（高さの目安 0〜1 → 0〜3%） */
  tracking: number;
  /** 行ごとの色相ずれ（色差ノイズ。0〜1） */
  chromaNoise: number;
}

export const VIDEO_PRESETS: Record<FilmPreset, VideoParams> = {
  off: { desaturate: 0, tint: [1, 1, 1], chromaBlur: 0, noise: 0, colorNoise: 0, blackLift: 0, knee: 0, scanlines: 0, interlace: 0, jitter: 0, headSwitch: 0, dctBlocks: 0, frameHold: 0, frameBlend: 0, lumaBlur: 0, chromaShift: 0, smear: 0, ringing: 0, vignette: 0, lineJitter: 0, snow: 0, tracking: 0, chromaNoise: 0 },
  clean: { desaturate: 0.05, tint: [1, 1, 1], chromaBlur: 0, noise: 0, colorNoise: 0, blackLift: 0, knee: 0, scanlines: 0, interlace: 0, jitter: 0, headSwitch: 0, dctBlocks: 0, frameHold: 0, frameBlend: 0, lumaBlur: 0, chromaShift: 0, smear: 0, ringing: 0, vignette: 0.12, lineJitter: 0, snow: 0, tracking: 0, chromaNoise: 0 },
  homeVideo: { desaturate: 0.12, tint: [1.0, 1.0, 0.97], chromaBlur: 3.3, noise: 0.019, colorNoise: 0.4, blackLift: 0.012, knee: 0.45, scanlines: 0.2, interlace: 0.12, jitter: 0.025, headSwitch: 0.035, dctBlocks: 0, frameHold: 0, frameBlend: 0, lumaBlur: 0.8, chromaShift: 1.0, smear: 0.25, ringing: 0.2, vignette: 0.2, lineJitter: 0.3, snow: 0.05, tracking: 0, chromaNoise: 0.15 },
  // tape = バックルームズ映像でよく見る VHS の質感。輝度の横方向の甘さ・色の遅れとにじみ・明部の右への滲み・縁のリンギング・
  // 行ごとの横揺れ・ドロップアウトの白い筋・スノー・常時のトラッキング帯を重ね、コントラストは黒浮きとニーで寝かせる。残像（frameBlend）は控えめ
  tape: { desaturate: 0.24, tint: [1.03, 1.0, 0.93], chromaBlur: 10, noise: 0.046, colorNoise: 0.6, blackLift: 0.045, knee: 0.85, scanlines: 0.7, interlace: 0.4, jitter: 0.45, headSwitch: 0.5, dctBlocks: 0.2, frameHold: 30, frameBlend: 0.06, lumaBlur: 3.2, chromaShift: 4.5, smear: 1.0, ringing: 0.8, vignette: 0.32, lineJitter: 2.0, snow: 0.15, tracking: 0.85, chromaNoise: 0.75 },
};

/**
 * 音量連動: setAudioNoise(x) の x は AudioEngine.ambientLevel（実測: 無音の部屋 0.02 / 環境音 1 本 0.41 / 3 本 0.57。1.0 には届かない）。
 * gain = 1 + clamp((x − FLOOR) / SPAN, 0, 1) × GAIN → x = 0.02 で 1.0 倍、≈0.45 で 1.4 倍、≥0.6 で 1.6 倍（F2 の指定）
 */
const AUDIO_NOISE_FLOOR = 0.02;
const AUDIO_NOISE_SPAN = 0.58;
const AUDIO_NOISE_GAIN = 0.6;
/** 1 秒あたりの期待イベント数（params × これ） */
const JITTER_RATE = 4;
const HEAD_RATE = 3;
/** ノイズの種の周期（フレーム）。uint ハッシュなので周期は見えない。float uniform の精度のために小さく保つ */
const SEED_PERIOD = 4096;

export class VideoPass extends Pass {
  readonly params: VideoParams = { ...VIDEO_PRESETS.off, tint: [1, 1, 1] };
  /** 数値ならノイズの種を固定（スクリーンショット用）。null なら毎フレーム更新 */
  frozenSeed: number | null = null;
  /** VHS 効果の強さ（設定スライダー。0〜2、1 = params そのまま）。frameHold 以外の全効果に掛かる（上限あり） */
  strength = 1;
  private readonly eff: VideoParams = { ...VIDEO_PRESETS.off, tint: [1, 1, 1] };

  /** params × strength（各効果の上限でクランプ）。update / render はこちらを読む */
  private effective(): VideoParams {
    const p = this.params, k = this.strength, e = this.eff;
    const c = (v: number, max: number) => Math.min(max, v * k);
    e.desaturate = c(p.desaturate, 0.6);
    e.tint = [1 + (p.tint[0] - 1) * k, 1 + (p.tint[1] - 1) * k, 1 + (p.tint[2] - 1) * k];
    e.chromaBlur = c(p.chromaBlur, 24);
    e.noise = c(p.noise, 0.12);
    e.colorNoise = Math.min(1, p.colorNoise);
    e.blackLift = c(p.blackLift, 0.12);
    e.knee = c(p.knee, 1);
    e.scanlines = c(p.scanlines, 1);
    // コーミングは 1.0 にすると奇数行が前フレームのまま更新されず「焼き付き」になるので 0.8 が上限
    e.interlace = c(p.interlace, 0.6);
    e.jitter = c(p.jitter, 1);
    e.headSwitch = c(p.headSwitch, 1);
    e.dctBlocks = c(p.dctBlocks, 1);
    e.frameHold = p.frameHold;
    e.frameBlend = c(p.frameBlend, 0.2);
    e.lumaBlur = c(p.lumaBlur, 8);
    e.chromaShift = c(p.chromaShift, 12);
    e.smear = c(p.smear, 2.5);
    e.ringing = c(p.ringing, 2);
    e.vignette = c(p.vignette, 0.55);
    e.lineJitter = c(p.lineJitter, 5);
    e.snow = c(p.snow, 0.5);
    e.tracking = c(p.tracking, 1.2);
    e.chromaNoise = c(p.chromaNoise, 2);
    return e;
  }
  private readonly uniforms: VideoUniforms;
  private readonly singleMaterial: THREE.ShaderMaterial;
  private readonly colorMaterial: THREE.ShaderMaterial;
  private readonly finalMaterial: THREE.ShaderMaterial;
  private readonly fsQuad: FullScreenQuad;
  private width = 1;
  private height = 1;
  /** 前フレーム保持の ping-pong RT（要るときだけ確保） */
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  /** targets のうち最新の処理済みフレームを持つ側 */
  private readIndex = 0;
  private prevValid = false;
  private audioNoise = 0;
  private audioSmooth = 0;
  private stillness = 0;
  private time = 0;
  private holdAcc = 0;
  private captureThisFrame = true;
  private jitterLeft = 0;
  private readonly jitterState = { y0: 0, y1: 0, shift: 0 };
  private headLeft = 0;
  private readonly headState = { height: 0.025, shift: 0, flicker: 1 };
  /** force* で出したイベントは静止（calm）でも止めない（確認用） */
  private forced = false;
  private rngState = 0x9e3779b9;

  constructor() {
    super();
    this.uniforms = createVideoUniforms();
    const make = (defines: Record<string, string>) => new THREE.ShaderMaterial({
      name: `VideoShader[${Object.keys(defines).join('+')}]`,
      uniforms: this.uniforms as unknown as Record<string, THREE.IUniform>,
      defines,
      vertexShader: VideoShader.vertexShader,
      fragmentShader: VideoShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    // uniform オブジェクトは 3 材質で共有（three は .value を読むだけ）。描く直前に tDiffuse / tPrev / mix を差し替える
    this.singleMaterial = make({ COLOR_STAGE: '', FINAL_STAGE: '' });
    this.colorMaterial = make({ COLOR_STAGE: '', HAS_PREV: '' });
    this.finalMaterial = make({ FINAL_STAGE: '' });
    this.fsQuad = new FullScreenQuad(this.singleMaterial);
  }

  applyPreset(p: FilmPreset): void {
    const v = VIDEO_PRESETS[p];
    Object.assign(this.params, v, { tint: [...v.tint] as [number, number, number] });
  }

  setAudioNoise(x: number): void { this.audioNoise = Math.max(0, Math.min(1, x)); }
  setStillness(sec: number): void { this.stillness = Math.max(0, sec); }

  /** 確認用: テープの揺れを frames フレーム出す（帯は画面中央寄り、右へ 4 px） */
  forceJitter(frames = 30): void {
    this.jitterState.y0 = 0.42;
    this.jitterState.y1 = 0.5;
    this.jitterState.shift = 4;
    this.jitterLeft = Math.max(1, frames | 0);
    this.forced = true;
  }

  /** 確認用: ヘッド切替ノイズを frames フレーム出す */
  forceHeadSwitch(frames = 30): void {
    this.headState.height = 0.025;
    this.headState.shift = 8;
    this.headState.flicker = 1;
    this.headLeft = Math.max(1, frames | 0);
    this.forced = true;
  }

  /** composer.render の直前に PostFX が呼ぶ。params → uniform、音量・静止の連動、確率イベント、フレーム間引きの判定 */
  update(dt: number, frame: number): void {
    const p = this.effective();
    const u = this.uniforms;
    this.time += dt;
    const frozen = this.frozenSeed !== null;
    const rawSeed = frozen ? Math.floor(this.frozenSeed as number) : frame;
    u.seed.value = ((rawSeed % SEED_PERIOD) + SEED_PERIOD) % SEED_PERIOD;

    // 音量連動: 0.25 s で追従（無音の部屋は静か、空調の大きい部屋はざらつく）。ambientLevel の実測域 0.02〜0.6 を 1.0〜1.6 倍に写す
    this.audioSmooth += (this.audioNoise - this.audioSmooth) * Math.min(1, dt * 4);
    const level = Math.max(0, Math.min(1, (this.audioSmooth - AUDIO_NOISE_FLOOR) / AUDIO_NOISE_SPAN));
    u.noiseAmp.value = p.noise * (1 + AUDIO_NOISE_GAIN * level);

    // 揺れ・ヘッド切替: 静止 3 s 超は止める（force* で出したものは除く）。frozenSeed 中は新しいイベントを起こさない
    const calm = this.stillness > STILLNESS_CALM_SEC;
    if (this.forced && this.jitterLeft <= 0 && this.headLeft <= 0) this.forced = false;
    if (calm && !this.forced) {
      this.jitterLeft = 0;
      this.headLeft = 0;
    } else if (!calm && !frozen) {
      if (this.jitterLeft <= 0 && p.jitter > 0 && this.rng() < p.jitter * JITTER_RATE * dt) this.startJitter();
      if (this.headLeft <= 0 && p.headSwitch > 0 && this.rng() < p.headSwitch * HEAD_RATE * dt) this.startHeadSwitch();
    }
    if (this.jitterLeft > 0) {
      u.jitterBand.value.set(this.jitterState.y0, this.jitterState.y1, this.jitterState.shift, 1);
      this.jitterLeft--;
    } else {
      u.jitterBand.value.w = 0;
    }
    if (this.headLeft > 0) {
      u.headBand.value.set(this.headState.height, this.headState.shift, 1, this.headState.flicker);
      this.headLeft--;
    } else {
      u.headBand.value.z = 0;
    }

    // フレーム間引き: 表示は frameHold fps。周期の 3/4 を超えたら取り込む（60 Hz で 30 → 2 フレームごと、24 → 2, 3, 2, 3…）
    if (p.frameHold > 0) {
      const period = 1 / p.frameHold;
      this.holdAcc += dt;
      if (this.holdAcc >= period * 0.75) {
        this.captureThisFrame = true;
        this.holdAcc = Math.min(this.holdAcc - period, period);
      } else {
        this.captureThisFrame = false;
      }
    } else {
      this.captureThisFrame = true;
      this.holdAcc = 0;
    }

    u.desaturate.value = p.desaturate;
    u.tint.value.set(p.tint[0], p.tint[1], p.tint[2]);
    u.chromaBlur.value = p.chromaBlur;
    u.colorNoise.value = p.colorNoise;
    u.blackLift.value = p.blackLift;
    u.knee.value = p.knee;
    u.scanlines.value = p.scanlines;
    u.dctBlocks.value = p.dctBlocks;
    u.blockSeed.value = Math.floor(this.time * 2) % SEED_PERIOD;
    // VHS の追加項目（静止中はドロップアウトと行揺れを止める。粒子とスノーは残す）
    u.lumaBlur.value = p.lumaBlur;
    u.chromaShift.value = p.chromaShift;
    u.smear.value = p.smear;
    u.ringing.value = p.ringing;
    u.vignette.value = p.vignette;
    u.lineJitter.value = calm && !this.forced ? p.lineJitter * 0.3 : p.lineJitter;
    u.snow.value = p.snow;
    u.tracking.value = p.tracking;
    u.chromaNoise.value = p.chromaNoise;
    u.timeSec.value = this.time;
  }

  override setSize(width: number, height: number): void {
    this.width = Math.max(1, width | 0);
    this.height = Math.max(1, height | 0);
    this.uniforms.resolution.value.set(this.width, this.height);
    if (this.targets) {
      for (const t of this.targets) t.setSize(this.width, this.height);
      this.prevValid = false;
    }
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const p = this.effective();
    const u = this.uniforms;
    const out = this.renderToScreen ? null : writeBuffer;
    const needsPrev = p.interlace > 0 || p.frameHold > 0;
    if (!needsPrev) {
      this.releaseTargets();
      u.tDiffuse.value = readBuffer.texture;
      u.interlaceMix.value = 0;
      u.frameBlend.value = 0;
      this.draw(renderer, this.singleMaterial, out, this.clear);
      return;
    }
    const targets = this.ensureTargets();
    if (this.captureThisFrame || !this.prevValid) {
      const prev = targets[this.readIndex];
      const write = targets[1 - this.readIndex];
      u.tDiffuse.value = readBuffer.texture;
      u.tPrev.value = prev.texture;
      u.interlaceMix.value = this.prevValid ? p.interlace : 0;
      u.frameBlend.value = this.prevValid && p.frameHold > 0 ? p.frameBlend : 0;
      this.draw(renderer, this.colorMaterial, write, false);
      this.readIndex = 1 - this.readIndex;
      this.prevValid = true;
    }
    u.tDiffuse.value = targets[this.readIndex].texture;
    this.draw(renderer, this.finalMaterial, out, this.clear);
  }

  override dispose(): void {
    this.releaseTargets();
    this.singleMaterial.dispose();
    this.colorMaterial.dispose();
    this.finalMaterial.dispose();
    this.fsQuad.dispose();
  }

  // ------------------------------------------------------------ 内部

  private draw(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear: boolean): void {
    renderer.setRenderTarget(target);
    if (target && clear) renderer.clear();
    this.fsQuad.material = material;
    this.fsQuad.render(renderer);
  }

  private ensureTargets(): [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] {
    if (this.targets) return this.targets;
    const make = (i: number) => {
      const rt = new THREE.WebGLRenderTarget(this.width, this.height, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        colorSpace: THREE.NoColorSpace,
      });
      rt.texture.name = `VideoPass.prev${i}`;
      return rt;
    };
    this.targets = [make(0), make(1)];
    this.readIndex = 0;
    this.prevValid = false;
    return this.targets;
  }

  private releaseTargets(): void {
    if (!this.targets) return;
    for (const t of this.targets) t.dispose();
    this.targets = null;
    this.prevValid = false;
    this.uniforms.tPrev.value = null;
  }

  private startJitter(): void {
    const h = 0.02 + this.rng() * 0.1;
    this.jitterState.y0 = this.rng() * (1 - h);
    this.jitterState.y1 = this.jitterState.y0 + h;
    this.jitterState.shift = (2 + this.rng() * 4) * (this.rng() < 0.5 ? -1 : 1);
    this.jitterLeft = this.rng() < 0.4 ? 2 : 1;
  }

  private startHeadSwitch(): void {
    this.headState.height = 0.02 + this.rng() * 0.01;
    this.headState.shift = 4 + this.rng() * 8;
    this.headState.flicker = 0.6 + this.rng() * 0.4;
    this.headLeft = 2 + Math.floor(this.rng() * 4);
  }

  /** mulberry32。イベントの確率判定用（Math.random を使わず再現しやすくする） */
  private rng(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
