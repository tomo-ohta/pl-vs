import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
// ゲーム（v2）の撮像効果をそのまま使う（複製しない。v2 の調整がこの検証ステージにも届く）
import { CameraRig, type CameraSubject } from '../../../../v2/client/camera/CameraRig.ts';
import { FILM_PRESET_IDS, isFilmPreset, type FilmPreset } from '../../../../v2/client/render/FilmPreset.ts';
import { LensPass } from '../../../../v2/client/render/LensPass.ts';
import { VIDEO_PRESETS, VideoPass } from '../../../../v2/client/render/VideoPass.ts';
import { RecOverlay } from '../../../../v2/client/ui/RecOverlay.ts';
import { NOISE_GLSL } from './glsl.ts';

/**
 * カメラ効果（v1 / v2 の「描画効果」= 家庭用ビデオ・VHS の撮像）。
 * - LensPass（v2/client/render/LensPass.ts）: 歪み・色収差・減光・軟焦点・にじみ・フレア・接写の DoF・かすみ・フリッカー・回転ブラー・露出 / WB の追従
 * - VideoPass（v2/client/render/VideoPass.ts）: 色のにじみ・暗部ノイズ・黒浮き・ニー・走査線・インタレース・テープの揺れ・ヘッド切替・間引きなど
 * - CameraRig（v2/client/camera/CameraRig.ts）: 手持ち感（歩調の上下動・ロール・呼吸・ふらつき・ズームのゆらぎ）と視線の遅れ
 * - RecOverlay（v2/client/ui/RecOverlay.ts）: ●REC とタイムコード
 *
 * 後処理の中の位置: 合成（線・色調整。sRGB にする前の線形）→ LensPass → sRGB へ → VideoPass → 画面。
 * 線は深度から引くので、レンズの歪みより前に描く（歪みで線と絵がずれないように）。
 *
 * この検証ステージでの違い:
 * - 描画効果 'off' のときは、手持ち感・視線の遅れ・REC も止める（参考画像との見比べの邪魔をしない）
 * - 露出 / ホワイトバランスの追従は既定で切る。ゲームの追従は暗い部屋（露出 0.55・AgX の前）向けの目標値なので、
 *   色を参考画像に合わせたこの場面では、明るい場面を暗く・青緑の場面を灰色へ寄せてしまう（設定で入れられる）
 */
export type FrameHoldId = 'off' | '30' | '24';

export interface FilmSettings {
  /** 描画効果（撮像プリセット） */
  preset: FilmPreset;
  /** VHS 効果の強さ（0〜2。1 = プリセットの値そのまま。v2 の既定は 2） */
  vhsStrength: number;
  /** 手持ち感（0〜1） */
  handheld: number;
  /** 視線の遅れ（50 ms） */
  cameraLag: boolean;
  /** 表示 fps の間引き */
  frameHold: FrameHoldId;
  /** REC・タイムコード表示 */
  rec: boolean;
  /** 露出の追従 */
  autoExposure: boolean;
  /** ホワイトバランスの追従 */
  autoWhiteBalance: boolean;
  /**
   * 元の色を残す（0〜1）。VHS の色調整（彩度低下・白の偏り）・ハイライトのニー・黒浮きで減った色差を、元の映像の色差へ戻す割合。
   * 走査線・揺れ・色のにじみと遅れ・ノイズ・明暗の寝かせ（輝度）はそのまま。0 = ゲーム（v2）と同じ掛かり方
   */
  colorKeep: number;
}

export const DEFAULT_FILM: Readonly<FilmSettings> = {
  preset: 'off',
  vhsStrength: 2,
  handheld: 0.6,
  cameraLag: true,
  frameHold: 'off',
  rec: true,
  autoExposure: false,
  autoWhiteBalance: false,
  colorKeep: 0.85,
};

export { FILM_PRESET_IDS };
export type { FilmPreset };

const STORAGE_KEY = 'vsl.film.v1';

/** 線形の色を sRGB にする（VideoPass の入力は表示域）。LensPass の前に掛けた倍率を戻す */
const ENCODE_FS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uRes; uniform float uScale; varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec3 c = clamp(texture2D(tSrc, vUv).rgb / uScale, 0.0, 1.0);
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  c += (sl_hash12(vUv * uRes * 1.37) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Film {
  readonly settings: FilmSettings;
  readonly lens: LensPass;
  readonly video: VideoPass;
  readonly rig: CameraRig;
  readonly rec: RecOverlay;
  private readonly rtLinear: THREE.WebGLRenderTarget;
  private readonly rtLens: THREE.WebGLRenderTarget;
  private readonly rtDisplay: THREE.WebGLRenderTarget;
  private readonly encode: FullScreenQuad;
  private frame = 0;
  // 手持ち感の入力（歩幅の積算・静止の秒数）
  private strideAcc = 0;
  private strideCount = 0;
  private stillSec = 0;
  private readonly lastPos = new THREE.Vector3();
  private lastYaw = 0;
  private lastPitch = 0;
  private hasLast = false;
  onChange: (() => void) | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, recParent: HTMLElement | null, persist = true) {
    this.settings = { ...DEFAULT_FILM, ...(persist ? load() : {}) };
    this.persist = persist;
    this.lens = new LensPass(scene, camera);
    this.video = new VideoPass();
    this.video.renderToScreen = true;
    this.adaptVideoShader();
    this.rig = new CameraRig(camera);
    this.rec = new RecOverlay(recParent);
    const rt = (name: string): THREE.WebGLRenderTarget => {
      const t = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false });
      t.texture.name = name;
      t.texture.colorSpace = THREE.NoColorSpace;
      t.texture.generateMipmaps = false;
      return t;
    };
    this.rtLinear = rt('Film.linear');
    this.rtLens = rt('Film.lens');
    this.rtDisplay = rt('Film.display');
    this.encode = new FullScreenQuad(
      new THREE.ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: ENCODE_FS,
        uniforms: { tSrc: { value: null }, uRes: { value: new THREE.Vector2() }, uScale: { value: 1 } },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.apply();
  }
  private readonly persist: boolean;

  /**
   * LensPass へ渡す前に掛ける倍率（後で戻す）。ゲームの LensPass は露出を掛ける前の暗い HDR（壁 0.2〜0.5）を前提に、
   * にじみのしきい値（線形 0.8）を決めている。この場面の色は表示の明るさのまま（白い壁で 0.8〜0.9）なので、
   * そのままだと明るい面がすべてにじんで白く飛ぶ。0.5 倍してゲームと同じ明るさの帯に揃える（光る板だけがにじむ）
   */
  inputScale = 0.5;

  /**
   * テープの明部の滲み（smear）が始まる明るさ。ゲームの VideoPass は 0.55（表示域）で、暗い部屋（トーンマップ後の壁 0.3〜0.5）で
   * 器具の周りだけが滲む値。この場面は淡い色（壁 0.8〜0.95）なので、そのままでは画面全体が滲みで白く浮く。
   * 「白に近い所だけが滲む」ようにこの場面では 0.9 にする（シェーダーは v2 の物を、この検証ステージの中でだけ書き換える）
   */
  readonly smearKnee = { value: 0.9 };

  /** 元の色を残す割合（VideoShader の色段に足した uniform。settings.colorKeep を写す） */
  private readonly colorKeepU = { value: 0.85 };

  /** 描画効果が入っているか（'off' なら後処理は今まで通り画面へ直接描く） */
  get active(): boolean {
    return this.settings.preset !== 'off';
  }

  /** 合成の出力先（線形）。active のときだけ使う */
  get linearTarget(): THREE.WebGLRenderTarget {
    return this.rtLinear;
  }

  /** 設定を変える。save = false なら保存しない（URL で一時的に指定したとき） */
  set(patch: Partial<FilmSettings>, save_ = true): void {
    Object.assign(this.settings, patch);
    if (!isFilmPreset(this.settings.preset)) this.settings.preset = 'off';
    this.settings.vhsStrength = THREE.MathUtils.clamp(this.settings.vhsStrength, 0, 2);
    this.settings.handheld = THREE.MathUtils.clamp(this.settings.handheld, 0, 1);
    this.settings.colorKeep = THREE.MathUtils.clamp(Number.isFinite(this.settings.colorKeep) ? this.settings.colorKeep : DEFAULT_FILM.colorKeep, 0, 1);
    this.apply();
    if (this.persist && save_) save(this.settings);
    this.onChange?.();
  }

  /** 設定を各 pass とカメラに写す（v1 Game.applyCameraSettings と同じ扱い） */
  private apply(): void {
    const s = this.settings;
    this.lens.applyPreset(s.preset);
    this.lens.params.autoExposure = s.autoExposure ? this.lens.params.autoExposure : 0;
    this.lens.params.autoWhiteBalance = s.autoWhiteBalance ? this.lens.params.autoWhiteBalance : 0;
    this.video.applyPreset(s.preset);
    this.video.strength = s.vhsStrength;
    const preset = VIDEO_PRESETS[s.preset];
    this.video.params.frameHold = s.frameHold === 'off' ? preset.frameHold : Number(s.frameHold);
    this.video.params.frameBlend = this.video.params.frameHold > 0 ? Math.max(preset.frameBlend, 0.06) : preset.frameBlend;
    // 元の色を残す: 色差を戻す割合と、色を薄める掛かり方を弱める量（keep = 1 で）
    // - 色のにじみの幅: 最大 4 割細く（にじみが広いと小さな色の物の色が周りに薄まる）
    // - 黒浮き: 最大 6 割弱く（暗い色が灰色の膜になる）。ニー: 最大 5 割弱く（淡い色の差が潰れる）
    // - 行ごとの色相ずれ: 最大 5 割弱く（虹色の縞が元の色を上書きする）
    // 走査線・揺れ・ヘッド切替・トラッキング帯・ノイズ・色の遅れ・滲み・リンギング・輝度の甘さはそのまま
    // - 四隅の減光: 最大 5 割弱く。走査線: 縞の濃さはそのまま、暗い行だけでなく明るい行も作って平均の明るさを保つ（シェーダー側）
    // VideoPass は params × 強さ（上限あり）で効くので、上限を通した後の値を弱めてから強さで割って戻す
    const k = s.colorKeep;
    const st = Math.max(s.vhsStrength, 1e-3);
    const soften = (v: number, cap: number, by: number): number => (Math.min(cap, v * st) * (1 - by * k)) / st;
    this.colorKeepU.value = k;
    this.video.params.chromaBlur = soften(preset.chromaBlur, 24, 0.4);
    this.video.params.blackLift = soften(preset.blackLift, 0.12, 0.6);
    this.video.params.knee = soften(preset.knee, 1, 0.5);
    this.video.params.chromaNoise = soften(preset.chromaNoise, 2, 0.5);
    this.video.params.vignette = soften(preset.vignette, 0.55, 0.5);
    this.rig.feel.handheld = this.active ? s.handheld : 0;
    this.rig.feel.lag = this.active && s.cameraLag;
    this.rig.feel.preset = s.preset;
    this.rec.setVisible(this.active && s.rec);
  }

  /**
   * VideoPass の材質のシェーダーを、この検証ステージの中でだけ書き換える（v2 のファイルは変えない。見つからなければ v2 のまま）。
   * - 滲みのしきい値を uniform に（smearKnee）
   * - 元の色を残す（colorKeep）: 色段の最後（黒浮きの後・DCT の前）で、色調整・ニー・黒浮きの後の輝度はそのままに、
   *   色差（Cb・Cr）を「にじませて遅らせた元の色差」（cc）へ戻す。色のにじみ・遅れ・行ごとの色相ずれは cc に入っているので残る
   */
  private adaptVideoShader(): void {
    const v = this.video as unknown as Record<string, THREE.ShaderMaterial | undefined>;
    const KEEP = `// 検証ステージ: 元の色を残す（Film.colorKeep）。輝度は VHS の処理のまま、色差を元の映像の色差へ戻す
      if (colorKeep > 0.0) {
        float yk = dot(rgb, LUMA);
        // 黒浮きで明るくなった暗部は、明るくなった分だけ色差も増やす（暗い青緑が灰色の膜にならないように。最大 1.5 倍）
        float lift = clamp(yk / max(y, 0.02), 1.0, 1.5);
        vec2 ck = mix(vec2(dot(rgb, CB), dot(rgb, CR)), cc * mix(1.0, lift, 0.7), colorKeep);
        rgb = vec3(yk + 1.402 * ck.y, yk - 0.344136 * ck.x - 0.714136 * ck.y, yk + 1.772 * ck.x);
      }
      // 10. DCT ブロックの気配`;
    for (const key of ['singleMaterial', 'colorMaterial', 'finalMaterial']) {
      const m = v[key];
      if (!m) continue;
      let fs = m.fragmentShader;
      const a = fs.replace('max(l - 0.55, 0.0)', 'max(l - smearKnee, 0.0)');
      if (a !== fs) {
        fs = a.replace('uniform float smear;', 'uniform float smear;\nuniform float smearKnee;');
        m.uniforms.smearKnee = this.smearKnee;
      } else if (key === 'singleMaterial') console.warn('[Film] VideoShader の滲みのしきい値が見つからない（v2 のまま使う）');
      // 走査線: 暗い行（奇数）だけでなく、元の色を残す割合だけ明るい行（偶数）も作る（縞の濃さは同じ・平均の明るさを保つ）
      const sl = fs.replace(
        'rgb *= 1.0 - scanlines * 0.15 * float(ip.y & 1u);',
        'rgb *= 1.0 - scanlines * 0.15 * (float(ip.y & 1u) - 0.5 * colorKeep);',
      );
      if (sl === fs && key === 'finalMaterial') console.warn('[Film] VideoShader の走査線が見つからない（平均の明るさを保たない）');
      fs = sl;
      const b = fs.replace('// 10. DCT ブロックの気配', KEEP);
      if (b !== fs) {
        fs = b.replace('uniform float smear;', 'uniform float smear;\nuniform float colorKeep;');
        m.uniforms.colorKeep = this.colorKeepU;
      } else if (key === 'singleMaterial') console.warn('[Film] VideoShader の色段が見つからない（元の色を残す は効かない）');
      if (fs !== m.fragmentShader) {
        m.fragmentShader = fs;
        m.needsUpdate = true;
      }
    }
  }

  setSize(w: number, h: number): void {
    for (const t of [this.rtLinear, this.rtLens, this.rtDisplay]) t.setSize(w, h);
    this.lens.setSize(w, h);
    this.video.setSize(w, h);
    (this.encode.material as THREE.ShaderMaterial).uniforms.uRes.value.set(w, h);
  }

  setDepthTexture(t: THREE.Texture | null): void {
    this.lens.setDepthTexture(t);
  }

  /** 参考画像の視点へ移ったとき: 視線の遅れを跨がせない・基準の画角を合わせる */
  snap(camera: THREE.PerspectiveCamera, yaw: number, pitch: number): void {
    this.rig.baseFov = camera.fov;
    this.rig.snap(this.subject(0, new THREE.Vector3(), yaw, pitch, 1.6, true, false, 0));
    this.hasLast = false;
  }

  /**
   * 歩行の後に毎フレーム: プレイヤーの状態から手持ち感の入力を作り、表示カメラを動かす。
   * active でなければカメラには触らない（Player が置いたまま）
   */
  updateCamera(dt: number, p: { pos: THREE.Vector3; yaw: number; pitch: number; eye: number; onGround: boolean; crouching: boolean }): void {
    const moved = this.hasLast ? Math.hypot(p.pos.x - this.lastPos.x, p.pos.z - this.lastPos.z) : 0;
    const speed = dt > 0 ? moved / dt : 0;
    const turning = this.hasLast && (Math.abs(p.yaw - this.lastYaw) + Math.abs(p.pitch - this.lastPitch)) / Math.max(dt, 1e-3) > 0.05;
    this.stillSec = speed < 0.05 && !turning ? this.stillSec + dt : 0;
    const stride = speed > 2.4 ? 1.1 : 0.75; // v2 の PLAYER.strideDash / strideWalk
    this.strideAcc += moved;
    while (this.strideAcc >= stride) {
      this.strideAcc -= stride;
      this.strideCount++;
    }
    // 回転の速さ（回転ブラー）
    if (this.hasLast && dt > 0) this.lens.setCameraMotion((p.yaw - this.lastYaw) / dt, (p.pitch - this.lastPitch) / dt);
    this.lastPos.copy(p.pos);
    this.lastYaw = p.yaw;
    this.lastPitch = p.pitch;
    this.hasLast = true;
    this.video.setStillness(this.stillSec);
    this.video.setAudioNoise(0.2);
    if (!this.active) return;
    this.rig.update(dt, this.subject(speed, p.pos, p.yaw, p.pitch, p.eye, p.onGround, p.crouching, stride));
    this.rig.camera.updateMatrixWorld();
  }

  private subject(speed: number, pos: THREE.Vector3, yaw: number, pitch: number, eye: number, onGround: boolean, crouching: boolean, stride: number): CameraSubject {
    return {
      pos: [pos.x, pos.y, pos.z],
      eye,
      yaw,
      pitch,
      onGround,
      crouching,
      moveRank: speed < 0.1 ? 'still' : stride > 1 ? 'dash' : 'walk',
      strideAcc: this.strideAcc,
      strideCount: this.strideCount,
      horizontalSpeed: speed,
      stillSec: this.stillSec,
    };
  }

  /** 毎フレーム（描画の直前）: 時間の更新・追従・確率イベント */
  update(dt: number): void {
    this.frame++;
    this.lens.update(dt, this.frame);
    this.video.update(dt, this.frame);
    this.rec.update(dt);
  }

  /** 合成が rtLinear に描いた後: レンズ → sRGB → ビデオ → 画面 */
  render(renderer: THREE.WebGLRenderer): void {
    this.lens.render(renderer, this.rtLens, this.rtLinear);
    const em = this.encode.material as THREE.ShaderMaterial;
    em.uniforms.tSrc.value = this.rtLens.texture;
    em.uniforms.uScale.value = this.inputScale;
    renderer.setRenderTarget(this.rtDisplay);
    this.encode.render(renderer);
    this.video.render(renderer, this.rtLens, this.rtDisplay);
  }

  /** 撮影用: ノイズの種を固定する（null で毎フレーム） */
  freezeNoise(seed: number | null): void {
    this.video.frozenSeed = seed;
  }

  dispose(): void {
    this.lens.dispose();
    this.video.dispose();
    this.rec.dispose();
    this.rtLinear.dispose();
    this.rtLens.dispose();
    this.rtDisplay.dispose();
    this.encode.dispose();
  }
}

function load(): Partial<FilmSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<FilmSettings>) : {};
  } catch {
    return {};
  }
}

function save(s: FilmSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // 保存できない環境（プライベートモードなど）では保存しない
  }
}
