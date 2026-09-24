/**
 * LensPass — 撮像系（レンズと素子）の pass。OutputPass の**前**（線形 HDR）に置く。担当 F1a。
 * 効果: レンズ歪み / 半径依存の色収差 / 周辺減光 / 軟焦点 / 開口部の広いにじみ（第 2 ブルーム）とハレーション /
 * 控えめなレンズフレア / 接写のみの被写界深度 / オートフォーカスの迷い（入室直後） / 深度によるかすみ / 蛍光灯の全画面フリッカー /
 * 回転だけのモーションブラー / 露出とホワイトバランスのゆっくりした追従（平均輝度の読み戻し）。
 * PostFX との契約（公開 API。変えない）:
 *   - `params`（LensParams）を毎フレーム uniform に写す。`applyPreset(p)` で LENS_PRESETS の値を写す
 *   - `setDepthTexture(t)`: GTAO の深度（無ければ null。内部で半解像度の深度パスに代替する）
 *   - `setCameraMotion(yawRate, pitchRate)`: rad/s。回転ブラーの向きと量
 *   - `notifyRoomEnter()`: 入室直後のフォーカスの迷いを開始
 *   - `update(dt, frame)`: composer.render の直前に PostFX が呼ぶ（露出・AWB の追従、時間更新）
 *   - `exposureGain` / `luminance`: デバッグ HUD 用の読み取り
 *
 * 構成（render の順。強さ 0 の効果は RT の描画も uniform 分岐も飛ばす）:
 *   [深度] setDepthTexture が null で DoF / かすみが要るときだけ、scene を半解像度の DepthTexture 付き RT に MeshDepthMaterial で描く
 *   [1/4] 入力の箱型ダウンサンプル（にじみ・統計の共通入力）
 *   [1/8] 明部抽出 → 分離ガウス × 2 往復（にじみ。spread 1.5 で σ ≈ 30 px @1080p）→ [フレア 1/8] ストリーク + ゴースト
 *   [統計] 4 フレームごと: 1/4 → 32×18 層化平均 → 2×1（平均色・log 輝度・中央距離）→ readRenderTargetPixelsAsync（同期読みは使わない）
 *   [合成] 1 枚のフルスクリーンシェーダ（src/render/shaders/LensShader.ts の LensCompositeShader）
 * 方式・数値・計測は docs/film-lens.md。
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import type { FilmPreset } from './FilmPreset';
import { hideOverrideExcluded } from './OverridePassExclusion';
import {
  LensBlurShader, LensBrightShader, LensCompositeShader, LensDownsampleShader, LensFlareShader, LensReduceShader, LensStatShader,
} from './shaders/LensShader';

export interface LensParams {
  /** 樽型歪み k1（0〜0.04） */
  distortion: number;
  /** 色収差（端での R/B のずれ。1080p 基準 px。0〜0.8） */
  chroma: number;
  /** 周辺減光（0〜0.12） */
  vignette: number;
  /** 軟焦点（px。0〜0.7） */
  softFocus: number;
  /** 開口部の広いにじみ（第 2 ブルーム）の強度。ぼかした明部の超過分（輝度 − 0.8）に掛ける倍率（0〜0.6。0.35 で器具の周りにうっすら） */
  glow: number;
  /** ハレーション（にじみの暖色寄り。0〜1） */
  halation: number;
  /** レンズフレア（0〜1。0 で無効） */
  flare: number;
  /** 接写の被写界深度（0〜1。0 で無効） */
  dof: number;
  /** オートフォーカスの迷い（0〜1。0 で無効） */
  focusHunt: number;
  /** 深度によるかすみ（遠方の白へ 0〜0.08） */
  haze: number;
  /** 蛍光灯の全画面フリッカー（露出の揺れ 0〜0.02） */
  flicker: number;
  /** 回転モーションブラー（0〜1。0 で無効） */
  motionBlur: number;
  /** 露出の追従（0 = 固定 1.0、1 = 有効） */
  autoExposure: number;
  /** ホワイトバランスの追従（0 = 固定、1 = 有効） */
  autoWhiteBalance: number;
}

/**
 * プリセット値の意図:
 *   - off: 全部 0（PostFX は film 'off' なら pass 自体を置かないので、実質デバッグ用）
 *   - clean: 撮像の癖は付けない。露出 / WB の追従と、遠方のごく弱いかすみ（1.5%）だけ
 *   - homeVideo: 保存状態の良い家庭用ビデオ。歪み 0.03（端の直線がわずかに曲がる）、色収差 0.7 px、減光 12%、軟焦点 0.6 px（3×3 テント）、
 *     にじみ 0.42 + 暖色 0.6（器具の周りがうっすら橙に、窓・出口の向こうが白く溶ける）、フレア 0.3（器具を斜めに見たときの横筋）、DoF 0.6（接写で背景 ≤ 1.8 px）、
 *     迷い 0.6（入室後 0.3 s、最大 1.5 px）、かすみ 2.5% @20 m、フリッカー 1%、回転ブラー 0.5（2 rad/s で約 12 px）
 *   - tape: homeVideo より一段強く（歪み 0.04、色収差 0.7 px、減光 10%、軟焦点 0.7 px、にじみ 0.45、フリッカー 1.5%、ブラー 0.6）。走査線等は VideoPass 側
 */
export const LENS_PRESETS: Record<FilmPreset, LensParams> = {
  off: { distortion: 0, chroma: 0, vignette: 0, softFocus: 0, glow: 0, halation: 0, flare: 0, dof: 0, focusHunt: 0, haze: 0, flicker: 0, motionBlur: 0, autoExposure: 0, autoWhiteBalance: 0 },
  clean: { distortion: 0, chroma: 0, vignette: 0, softFocus: 0, glow: 0, halation: 0, flare: 0, dof: 0, focusHunt: 0, haze: 0.015, flicker: 0, motionBlur: 0, autoExposure: 1, autoWhiteBalance: 1 },
  homeVideo: { distortion: 0.03, chroma: 0.7, vignette: 0.12, softFocus: 0.6, glow: 0.42, halation: 0.6, flare: 0.3, dof: 0.6, focusHunt: 0.6, haze: 0.025, flicker: 0.01, motionBlur: 0.5, autoExposure: 1, autoWhiteBalance: 1 },
  tape: { distortion: 0.04, chroma: 0.7, vignette: 0.1, softFocus: 0.7, glow: 0.45, halation: 0.8, flare: 0.3, dof: 0.6, focusHunt: 0.8, haze: 0.025, flicker: 0.015, motionBlur: 0.6, autoExposure: 1, autoWhiteBalance: 1 },
};

/** 調整値（docs/film-lens.md 2 章） */
export const LENS_TUNING = {
  /**
   * 暗い基準露出 .55 に合わせた目標の幾何平均輝度（線形、トーンマップ前）。
   * log 域の補正を 30% に抑え、暗室を明るく戻すゲインは最大 1.2。
   * 部屋ごとの明暗差を保ち、懐中電灯の照射部分だけが浮かぶようにする。
   */
  EXPOSURE_KEY: 0.032,
  EXPOSURE_ADAPT: 0.30,
  EXPOSURE_TAU: 1.7,
  GAIN_MIN: 0.6,
  GAIN_MAX: 1.2,
  /** WB: 灰色仮定の RGB ゲイン（log 域で WB_ADAPT の割合。暖色の部屋ばかりなので完全補正だと常に上限に張り付く）を ±WB_LIMIT に制限、時定数 WB_TAU s */
  WB_LIMIT: 0.08,
  WB_ADAPT: 0.6,
  WB_TAU: 3.0,
  /** 統計の読み戻し間隔（フレーム） */
  STAT_INTERVAL: 4,
  /**
   * にじみの明部抽出（線形輝度）と膝。C01（夜の学校廊下）の器具面は 1/4 解像度の平均で 1.46、壁は < 0.5 なので、閾値 0.8・膝 0.5
   * （0.3〜1.3 を二次で立ち上げる）で器具と窓だけが通る。ガウスは 1/8 で 2 往復、spread 1.5（σ ≈ 30 px @1080p、裾 ±90 px）
   */
  GLOW_THRESHOLD: 0.8,
  GLOW_KNEE: 0.5,
  GLOW_SPREAD: 1.5,
  /** フレアのストリーク間隔（1/8 texel。13 タップで ±18 texel = ±144 px @1080p。5.0 ではガウス σ 2.7 texel に対して粗く、コム状の段が見えた） */
  FLARE_STEP: 3.0,
  /** DoF: 視線中央がこの距離 [m] 未満なら有効、背景の最大錯乱円（1080p 基準 px）、フェード時定数、中央距離の急変（m / 統計間隔）で無効化する秒数 */
  DOF_NEAR: 0.9,
  DOF_MAX_PX: 3.0,
  DOF_TAU: 0.25,
  DOF_JUMP: 0.2,
  DOF_BLOCK_SEC: 0.35,
  DOF_TURN_RATE: 0.5,
  /** フォーカスの迷い: 長さ [s] と最大ぼかし（1080p 基準 px、focusHunt = 1 のとき） */
  HUNT_SEC: 0.3,
  HUNT_PX: 2.5,
  /** かすみ: この距離 [m] で haze の割合。上限は霧の far と HAZE_CLAMP_MAX の小さい方 */
  HAZE_DIST: 20,
  HAZE_CLAMP_MAX: 40,
  /** 回転ブラー: 露光時間 [s]（60i のシャッター）、上限 [px（1080p 基準）]、速度の平滑時定数 */
  SHUTTER_SEC: 1 / 60,
  MOTION_MAX_PX: 24,
  MOTION_TAU: 0.06,
  /** 深度が無いときの自前深度パスの解像度倍率 */
  DEPTH_SCALE: 0.5,
};

const STAT_W = 32;
const STAT_H = 18;
const _v2 = new THREE.Vector2();

function hash01(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export class LensPass extends Pass {
  readonly params: LensParams = { ...LENS_PRESETS.off };
  /** 露出追従の現在値（トーンマップ前の線形ゲイン。デバッグ HUD 用） */
  exposureGain = 1;
  /** 直近の平均輝度（読み戻し。線形の幾何平均。デバッグ HUD 用） */
  luminance = 0;
  /** WB ゲインの現在値（デバッグ用） */
  readonly whiteBalance = new THREE.Vector3(1, 1, 1);
  /** 直近の視線中央の距離 [m]（深度が無ければ Infinity。デバッグ用） */
  centerDistance = Infinity;
  /** 統計の読み戻しの回数 / 失敗回数（デバッグ用） */
  statReads = 0;
  statErrors = 0;

  private readonly material: THREE.ShaderMaterial;
  private readonly downMat: THREE.ShaderMaterial;
  private readonly brightMat: THREE.ShaderMaterial;
  private readonly blurMat: THREE.ShaderMaterial;
  private readonly flareMat: THREE.ShaderMaterial;
  private readonly statMat: THREE.ShaderMaterial;
  private readonly reduceMat: THREE.ShaderMaterial;
  private readonly depthMat: THREE.MeshDepthMaterial;
  private readonly fsQuad: FullScreenQuad;

  private readonly rtQuarter: THREE.WebGLRenderTarget;
  private readonly rtEighthA: THREE.WebGLRenderTarget;
  private readonly rtEighthB: THREE.WebGLRenderTarget;
  private readonly rtFlare: THREE.WebGLRenderTarget;
  private readonly rtStat: THREE.WebGLRenderTarget;
  /** 読み戻し用 2×1。Float が色描画できる環境（EXT_color_buffer_float）なら Float32、無ければ HalfFloat を CPU で復号。renderer が要るので render() で作る */
  private rtReduce: THREE.WebGLRenderTarget | null = null;
  private rtDepth: THREE.WebGLRenderTarget | null = null;
  private reduceIsFloat = true;
  private readBuf: Float32Array | Uint16Array = new Float32Array(8);

  private width = 1;
  private height = 1;
  private externalDepth: THREE.Texture | null = null;
  private time = 0;
  private frame = 0;
  private yawRate = 0;
  private pitchRate = 0;
  private readonly motionPx = new THREE.Vector2();
  private huntT = -1;
  private logGain = 0;
  private flickPhase = 0;
  private meanColor = new THREE.Vector3(0, 0, 0);
  private statValid = false;
  private readPending = false;
  private disposed = false;
  private centerRaw = Infinity;
  private dofBlock = 0;
  private dofAmount = 0;
  private dofFocus = 1;
  /** 直前フレームで深度を使えたか（DoF の判断用） */
  private depthReady = false;

  constructor(readonly scene: THREE.Scene, readonly camera: THREE.PerspectiveCamera) {
    super();
    const mk = (s: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string; name: string }) =>
      new THREE.ShaderMaterial({ name: s.name, uniforms: THREE.UniformsUtils.clone(s.uniforms), vertexShader: s.vertexShader, fragmentShader: s.fragmentShader, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    this.material = mk(LensCompositeShader);
    this.downMat = mk(LensDownsampleShader);
    this.brightMat = mk(LensBrightShader);
    this.blurMat = mk(LensBlurShader);
    this.flareMat = mk(LensFlareShader);
    this.statMat = mk(LensStatShader);
    this.reduceMat = mk(LensReduceShader);
    this.fsQuad = new FullScreenQuad(this.material);
    // 自前深度パス用。色は書かず DepthTexture だけ使う。殻の内側面が BackSide でも落ちないよう両面
    this.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking, side: THREE.DoubleSide });
    this.depthMat.colorWrite = false;
    this.depthMat.blending = THREE.NoBlending;

    const hdr = (name: string) => {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
      rt.texture.name = name;
      return rt;
    };
    this.rtQuarter = hdr('LensPass.quarter');
    this.rtEighthA = hdr('LensPass.eighthA');
    this.rtEighthB = hdr('LensPass.eighthB');
    this.rtFlare = hdr('LensPass.flare');
    this.rtStat = new THREE.WebGLRenderTarget(STAT_W, STAT_H, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
    this.rtStat.texture.name = 'LensPass.stat';
    this.material.uniforms.tGlow.value = this.rtEighthA.texture;
    this.material.uniforms.tFlare.value = this.rtFlare.texture;
    this.statMat.uniforms.cell.value.set(1 / STAT_W, 1 / STAT_H);
    this.reduceMat.uniforms.statTexel.value.set(1 / STAT_W, 1 / STAT_H);
    this.reduceMat.uniforms.tStat.value = this.rtStat.texture;
  }

  applyPreset(p: FilmPreset): void { Object.assign(this.params, LENS_PRESETS[p]); }

  setDepthTexture(t: THREE.Texture | null): void { this.externalDepth = t; }

  setCameraMotion(yawRate: number, pitchRate: number): void {
    this.yawRate = Number.isFinite(yawRate) ? yawRate : 0;
    this.pitchRate = Number.isFinite(pitchRate) ? pitchRate : 0;
  }

  /** 入室直後: フォーカスの迷いを開始し、扉をくぐった直後の DoF を止める */
  notifyRoomEnter(): void {
    this.huntT = 0;
    this.dofBlock = Math.max(this.dofBlock, LENS_TUNING.DOF_BLOCK_SEC);
  }

  override setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    const q = (s: number) => Math.max(1, Math.round(s));
    this.rtQuarter.setSize(q(this.width / 4), q(this.height / 4));
    this.rtEighthA.setSize(q(this.width / 8), q(this.height / 8));
    this.rtEighthB.setSize(q(this.width / 8), q(this.height / 8));
    this.rtFlare.setSize(q(this.width / 8), q(this.height / 8));
    if (this.rtDepth) this.rtDepth.setSize(q(this.width * LENS_TUNING.DEPTH_SCALE), q(this.height * LENS_TUNING.DEPTH_SCALE));
    this.material.uniforms.resolution.value.set(this.width, this.height);
    this.material.uniforms.aspect.value = this.width / this.height;
    this.flareMat.uniforms.aspect.value = this.width / this.height;
  }

  /** composer.render の直前。時間・統計からの追従・uniform の更新（GPU には触らない） */
  update(dt: number, frame: number): void {
    dt = Math.max(0, Math.min(0.1, dt));
    this.time += dt;
    this.frame = frame;
    const p = this.params;
    const u = this.material.uniforms;
    const T = LENS_TUNING;
    const pxScale = this.height / 1080; // 1080p 基準 px → 実 px
    const aspect = this.width / this.height;

    // 1. 歪み: 四隅（rc² = (aspect² + 1) / 4）がちょうど元画像の隅を読むスケール補正
    const k1 = Math.max(0, p.distortion);
    u.distortion.value = k1;
    u.distScale.value = 1 / (1 + k1 * (aspect * aspect + 1) * 0.25);
    // 2. 色収差: 端（四隅）で chroma px。(src − 0.5) の長さは四隅で 0.707 なので、対角 px 長で正規化する
    const chromaPx = Math.max(0, p.chroma) * pxScale;
    u.chromaK.value = chromaPx > 0 ? chromaPx * 2 / Math.hypot(this.width, this.height) : 0;
    // 3. 周辺減光
    u.vignette.value = Math.max(0, p.vignette);

    // 8. フォーカスの迷い: 0.3 s に |sin| で 2 山、振幅は線形に減衰（前後 1 往復して落ち着く）
    let hunt = 0;
    if (this.huntT >= 0) {
      this.huntT += dt;
      if (this.huntT >= T.HUNT_SEC || p.focusHunt <= 0) this.huntT = -1;
      else hunt = p.focusHunt * T.HUNT_PX * pxScale * Math.abs(Math.sin(2 * Math.PI * this.huntT / T.HUNT_SEC)) * (1 - this.huntT / T.HUNT_SEC);
    }
    // 11. 回転ブラー: 角速度 × 露光時間 × 焦点距離 [px]。並進は入れない
    const focalPx = 0.5 * this.height / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) * 0.5);
    const kMotion = 1 - Math.exp(-dt / T.MOTION_TAU);
    this.motionPx.x += (this.yawRate * T.SHUTTER_SEC * focalPx - this.motionPx.x) * kMotion;
    this.motionPx.y += (this.pitchRate * T.SHUTTER_SEC * focalPx - this.motionPx.y) * kMotion;
    let motionLen = p.motionBlur > 0 ? Math.min(T.MOTION_MAX_PX * pxScale, this.motionPx.length() * p.motionBlur) : 0;
    if (motionLen < 0.4 * pxScale) motionLen = 0;
    const dirA = _v2.copy(this.motionPx);
    if (motionLen > 0 && dirA.lengthSq() > 1e-8) dirA.normalize(); else dirA.set(1, 0);
    const soft = Math.max(0, p.softFocus) * pxScale + hunt;
    u.blurDirA.value.copy(dirA);
    u.blurDirB.value.set(-dirA.y, dirA.x);
    u.blurA.value.copy(dirA).multiplyScalar(soft + motionLen * 0.5);
    u.blurB.value.set(-dirA.y, dirA.x).multiplyScalar(soft);

    // 7. 接写 DoF: 中央距離（統計の読み戻し）が DOF_NEAR 未満、急変や回転中でなければ有効。フェードは DOF_TAU
    this.dofBlock = Math.max(0, this.dofBlock - dt);
    const turning = Math.abs(this.yawRate) + Math.abs(this.pitchRate) > T.DOF_TURN_RATE;
    const wantDof = p.dof > 0 && this.depthReady && this.centerRaw < T.DOF_NEAR && this.dofBlock <= 0 && !turning ? Math.min(1, p.dof) : 0;
    this.dofAmount += (wantDof - this.dofAmount) * (1 - Math.exp(-dt / T.DOF_TAU));
    if (wantDof > 0) this.dofFocus += (this.centerRaw - this.dofFocus) * (1 - Math.exp(-dt / 0.15));
    if (this.dofAmount < 0.01) this.dofAmount = 0;
    u.dofAmount.value = this.dofAmount;
    u.dofFocus.value = Math.max(0.1, this.dofFocus);
    u.dofMaxPx.value = T.DOF_MAX_PX * pxScale;
    u.blurOn.value = soft > 0.01 || motionLen > 0 || this.dofAmount > 0 ? 1 : 0;

    // 5. 6. にじみ / ハレーション / フレア
    u.glow.value = Math.max(0, p.glow);
    u.halation.value = THREE.MathUtils.clamp(p.halation, 0, 1);
    u.flare.value = Math.max(0, p.flare);

    // 9. かすみ: 上限は霧の far（FogDepth の部屋は霧が別に掛かる）と HAZE_CLAMP_MAX の小さい方。灰の明るさは部屋の平均輝度に比例
    u.haze.value = Math.max(0, p.haze);
    const fog = this.scene.fog;
    const fogFar = fog && (fog as THREE.Fog).isFog ? (fog as THREE.Fog).far : T.HAZE_CLAMP_MAX;
    u.hazeClamp.value = Math.max(1, Math.min(fogFar, T.HAZE_CLAMP_MAX));
    u.hazeLevel.value = this.statValid ? THREE.MathUtils.clamp(this.luminance * 4, 0.02, 0.8) : 0.4;

    // 12. 露出: 幾何平均輝度 → 目標ゲイン（log 域で ADAPT の割合）を EXPOSURE_TAU で追う。統計が無いか autoExposure 0 なら 1 へ戻る
    const kExp = 1 - Math.exp(-dt / T.EXPOSURE_TAU);
    let logTarget = 0;
    if (p.autoExposure > 0 && this.statValid && this.luminance > 0) {
      const full = THREE.MathUtils.clamp(Math.pow(T.EXPOSURE_KEY / this.luminance, T.EXPOSURE_ADAPT), T.GAIN_MIN, T.GAIN_MAX);
      logTarget = Math.log(full) * Math.min(1, p.autoExposure);
    }
    this.logGain += (logTarget - this.logGain) * kExp;
    this.exposureGain = Math.exp(this.logGain);

    // 13. WB: 平均色の灰色仮定。輝度を変えないよう正規化し ±WB_LIMIT に制限、WB_TAU で追う
    const kWb = 1 - Math.exp(-dt / T.WB_TAU);
    let tr = 1, tg = 1, tb = 1;
    if (p.autoWhiteBalance > 0 && this.statValid) {
      const m = this.meanColor;
      const L = 0.2126 * m.x + 0.7152 * m.y + 0.0722 * m.z;
      if (L > 1e-5) {
        const adapt = (mean: number) => Math.pow(L / Math.max(mean, 1e-5), T.WB_ADAPT);
        let gr = adapt(m.x), gg = adapt(m.y), gb = adapt(m.z);
        // 輝度を変えないよう正規化してから制限する（先に制限すると正規化で青が −11% まで出た: R06）
        const gl = 0.2126 * gr + 0.7152 * gg + 0.0722 * gb;
        const lim = (g: number) => THREE.MathUtils.clamp(g / gl, 1 - T.WB_LIMIT, 1 + T.WB_LIMIT);
        gr = lim(gr); gg = lim(gg); gb = lim(gb);
        const w = Math.min(1, p.autoWhiteBalance);
        tr = 1 + (gr - 1) * w; tg = 1 + (gg - 1) * w; tb = 1 + (gb - 1) * w;
      }
    }
    const wb = this.whiteBalance;
    wb.x += (tr - wb.x) * kWb;
    wb.y += (tg - wb.y) * kWb;
    wb.z += (tb - wb.z) * kWb;

    // 10. フリッカー: 60 Hz の sin に乱数の位相ゆらぎ（フレームレートとの折り返しで一定値に張り付かないように）+ フレームごとの小さな乱数
    let flick = 1;
    if (p.flicker > 0) {
      this.flickPhase += (hash01(frame * 0.618 + 0.13) - 0.5) * 1.2;
      const s = Math.sin(2 * Math.PI * 60 * this.time + this.flickPhase);
      flick = 1 + p.flicker * (0.7 * s + 0.6 * (hash01(frame * 1.37 + 7.31) - 0.5));
    }
    u.gain.value.set(this.exposureGain * flick * wb.x, this.exposureGain * flick * wb.y, this.exposureGain * flick * wb.z);
    u.cameraNear.value = this.camera.near;
    u.cameraFar.value = this.camera.far;
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const p = this.params;
    const T = LENS_TUNING;
    const needDepth = p.dof > 0 || p.haze > 0;
    const needBright = p.glow > 0 || p.flare > 0;
    const needStats = p.autoExposure > 0 || p.autoWhiteBalance > 0 || p.haze > 0 || p.dof > 0;
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    // 深度: GTAO のもの、無ければ自前の半解像度パス（DoF / かすみが要るときだけ）
    let depthTex: THREE.Texture | null = this.externalDepth;
    if (!depthTex && needDepth) depthTex = this.renderOwnDepth(renderer);
    this.depthReady = depthTex !== null;
    this.material.uniforms.tDepth.value = depthTex;
    this.material.uniforms.depthMode.value = depthTex ? 1 : 0;

    // 1/4 の箱型ダウンサンプル（にじみと統計の共通入力）
    if (needBright || needStats) {
      this.downMat.uniforms.tDiffuse.value = readBuffer.texture;
      this.downMat.uniforms.texel.value.set(1 / this.width, 1 / this.height);
      this.draw(renderer, this.downMat, this.rtQuarter);
    }
    // 明部抽出（1/8）→ ガウス 2 往復 → フレア
    if (needBright) {
      const qw = this.rtQuarter.width, qh = this.rtQuarter.height;
      const ew = this.rtEighthA.width, eh = this.rtEighthA.height;
      this.brightMat.uniforms.tDiffuse.value = this.rtQuarter.texture;
      this.brightMat.uniforms.texel.value.set(1 / qw, 1 / qh);
      this.brightMat.uniforms.threshold.value = T.GLOW_THRESHOLD;
      this.brightMat.uniforms.knee.value = T.GLOW_KNEE;
      this.draw(renderer, this.brightMat, this.rtEighthA);
      this.blurMat.uniforms.texel.value.set(1 / ew, 1 / eh);
      this.blurMat.uniforms.spread.value = T.GLOW_SPREAD;
      for (let i = 0; i < 2; i++) {
        this.blurMat.uniforms.tDiffuse.value = this.rtEighthA.texture;
        this.blurMat.uniforms.direction.value.set(1, 0);
        this.draw(renderer, this.blurMat, this.rtEighthB);
        this.blurMat.uniforms.tDiffuse.value = this.rtEighthB.texture;
        this.blurMat.uniforms.direction.value.set(0, 1);
        this.draw(renderer, this.blurMat, this.rtEighthA);
        // フレアは 1 往復目の後（光源の形と強さが残っている段階）に作る。2 往復目はにじみ用に更に広げる
        if (i === 0 && p.flare > 0) {
          this.flareMat.uniforms.tDiffuse.value = this.rtEighthA.texture;
          this.flareMat.uniforms.texel.value.set(1 / ew, 1 / eh);
          this.flareMat.uniforms.streakStep.value = T.FLARE_STEP;
          this.draw(renderer, this.flareMat, this.rtFlare);
        }
      }
    }
    // 統計（STAT_INTERVAL フレームごと、読み戻しが宙に浮いていないとき）
    if (needStats && !this.readPending && this.statErrors < 3 && this.frame % T.STAT_INTERVAL === 0) {
      const rtReduce = this.ensureReduceTarget(renderer);
      this.statMat.uniforms.tDiffuse.value = this.rtQuarter.texture;
      this.draw(renderer, this.statMat, this.rtStat);
      const ru = this.reduceMat.uniforms;
      ru.tDepth.value = depthTex;
      ru.depthMode.value = depthTex ? 1 : 0;
      ru.cameraNear.value = this.camera.near;
      ru.cameraFar.value = this.camera.far;
      this.draw(renderer, this.reduceMat, rtReduce);
      this.readPending = true;
      renderer.readRenderTargetPixelsAsync(rtReduce, 0, 0, 2, 1, this.readBuf).then(
        (buf) => { this.readPending = false; if (!this.disposed) this.onStats(buf as Float32Array | Uint16Array); },
        (e: unknown) => {
          this.readPending = false;
          this.statErrors++;
          if (this.statErrors === 1) console.warn('[LensPass] 統計の読み戻しに失敗（露出 / WB の追従を止める）', e);
        },
      );
    }

    // 合成
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.fsQuad.material = this.material;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
    this.fsQuad.render(renderer);
    renderer.autoClear = oldAutoClear;
  }

  private ensureReduceTarget(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
    if (this.rtReduce) return this.rtReduce;
    this.reduceIsFloat = renderer.extensions.has('EXT_color_buffer_float');
    this.readBuf = this.reduceIsFloat ? new Float32Array(8) : new Uint16Array(8);
    const rt = new THREE.WebGLRenderTarget(2, 1, { type: this.reduceIsFloat ? THREE.FloatType : THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
    rt.texture.name = 'LensPass.reduce';
    this.rtReduce = rt;
    return rt;
  }

  private draw(renderer: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget): void {
    this.fsQuad.material = mat;
    renderer.setRenderTarget(target);
    this.fsQuad.render(renderer);
  }

  /** 自前の深度パス（半解像度、DepthTexture）。scene.background は外し、overrideMaterial で全 Mesh を描く（DoorLeak の装飾クワッドは onBeforeRender で自ら抜ける） */
  private renderOwnDepth(renderer: THREE.WebGLRenderer): THREE.Texture {
    if (!this.rtDepth) {
      const w = Math.max(1, Math.round(this.width * LENS_TUNING.DEPTH_SCALE));
      const h = Math.max(1, Math.round(this.height * LENS_TUNING.DEPTH_SCALE));
      const depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedInt248Type);
      depthTexture.format = THREE.DepthStencilFormat;
      depthTexture.name = 'LensPass.depth';
      this.rtDepth = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, stencilBuffer: false, depthTexture });
      this.rtDepth.texture.name = 'LensPass.depthColor';
    }
    const scene = this.scene;
    const bg = scene.background;
    const override = scene.overrideMaterial;
    scene.background = null;
    scene.overrideMaterial = this.depthMat;
    const restore = hideOverrideExcluded();
    try {
      renderer.setRenderTarget(this.rtDepth);
      renderer.clear(true, true, false);
      renderer.render(scene, this.camera);
    } finally {
      restore();
      scene.overrideMaterial = override;
      scene.background = bg;
    }
    return this.rtDepth.depthTexture!;
  }

  /** 読み戻した統計: px0 = 平均色 (rgb) + log2 輝度の平均 (a)、px1 = 中央距離 min / mean */
  private onStats(buf: Float32Array | Uint16Array): void {
    const v = (i: number) => (this.reduceIsFloat ? (buf as Float32Array)[i] : THREE.DataUtils.fromHalfFloat((buf as Uint16Array)[i]));
    const r = v(0), g = v(1), b = v(2), logL = v(3), dmin = v(4);
    if (![r, g, b, logL].every(Number.isFinite)) return;
    this.statReads++;
    this.meanColor.set(Math.max(0, r), Math.max(0, g), Math.max(0, b));
    this.luminance = Math.pow(2, logL);
    this.statValid = true;
    const prev = this.centerRaw;
    this.centerRaw = Number.isFinite(dmin) && dmin < 1e3 ? dmin : Infinity;
    this.centerDistance = this.centerRaw;
    // 中央距離の急変 = 移動中（並進は PostFX から来ないので深度で判断）。しばらく DoF を止める
    if (Number.isFinite(prev) && Number.isFinite(this.centerRaw) && Math.abs(this.centerRaw - prev) > LENS_TUNING.DOF_JUMP) {
      this.dofBlock = Math.max(this.dofBlock, LENS_TUNING.DOF_BLOCK_SEC);
    }
  }

  override dispose(): void {
    this.disposed = true;
    this.material.dispose();
    this.downMat.dispose();
    this.brightMat.dispose();
    this.blurMat.dispose();
    this.flareMat.dispose();
    this.statMat.dispose();
    this.reduceMat.dispose();
    this.depthMat.dispose();
    this.fsQuad.dispose();
    this.rtQuarter.dispose();
    this.rtEighthA.dispose();
    this.rtEighthB.dispose();
    this.rtFlare.dispose();
    this.rtStat.dispose();
    this.rtReduce?.dispose();
    this.rtReduce = null;
    if (this.rtDepth) {
      this.rtDepth.depthTexture?.dispose();
      this.rtDepth.dispose();
      this.rtDepth = null;
    }
  }
}
