/**
 * E17 NoiseGate（マイク扉）用の音量源。0〜1 の値を返す。
 *   - requestMic(): getUserMedia + AnalyserNode。E17 の扉操作時に呼ばれる想定（ユーザージェスチャ内）。
 *     許可が無い / 非 HTTPS / 未対応のときは false を返し、以後は movementLoudness の代替値を使う。
 *   - level(): マイクが有効ならマイク音量、無ければプレイヤーの移動から作る疑似音量。
 *   - マイクの許可状態や音量は localStorage に保存しない。
 */

export type MovementRank = 'still' | 'walk' | 'dash' | 'jump';

export class LoudnessSource {
  private readonly getCtx: () => AudioContext | null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private buf: Float32Array | null = null;
  private mic = 0;
  private movement = 0;
  private requesting: Promise<boolean> | null = null;
  /** 最後の requestMic の失敗理由（'insecure' | 'unsupported' | 'denied' | null） */
  lastError: 'insecure' | 'unsupported' | 'denied' | null = null;

  constructor(getCtx: () => AudioContext | null) {
    this.getCtx = getCtx;
  }

  get micAvailable(): boolean {
    return this.analyser !== null;
  }

  /** マイクの利用を要求する（ユーザージェスチャ内で呼ぶ）。二重呼び出しは同じ Promise を返す */
  requestMic(): Promise<boolean> {
    if (this.analyser) return Promise.resolve(true);
    if (this.requesting) return this.requesting;
    this.requesting = this.doRequest().finally(() => { this.requesting = null; });
    return this.requesting;
  }

  private async doRequest(): Promise<boolean> {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') { this.lastError = 'unsupported'; return false; }
    if (!window.isSecureContext) { this.lastError = 'insecure'; return false; }
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) { this.lastError = 'unsupported'; return false; }
    const ctx = this.getCtx();
    if (!ctx) { this.lastError = 'unsupported'; return false; }
    try {
      const stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, video: false });
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      // 出力先へは接続しない（自分の声を再生しない）
      this.stream = stream;
      this.source = source;
      this.analyser = analyser;
      this.buf = new Float32Array(analyser.fftSize);
      this.lastError = null;
      return true;
    } catch {
      this.lastError = 'denied';
      return false;
    }
  }

  /** マイクを止めて権限使用表示を消す */
  releaseMic(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.buf = null;
    this.mic = 0;
  }

  /** 毎フレーム。マイク RMS を更新し、移動由来の疑似音量を減衰させる */
  update(dt: number): void {
    if (this.analyser && this.buf) {
      const b = this.buf as Float32Array<ArrayBuffer>;
      this.analyser.getFloatTimeDomainData(b);
      let sum = 0;
      for (let i = 0; i < b.length; i++) sum += b[i] * b[i];
      const rms = Math.sqrt(sum / b.length);
      // -50 dBFS → 0、-10 dBFS → 1 に写像
      const db = 20 * Math.log10(Math.max(1e-6, rms));
      const target = Math.min(1, Math.max(0, (db + 50) / 40));
      this.mic += (target - this.mic) * Math.min(1, dt * (target > this.mic ? 20 : 4));
    }
    this.movement = Math.max(0, this.movement - dt * 1.5);
  }

  /**
   * マイク代替: プレイヤーの移動ランクと着地から疑似音量を作る。
   * still 0 / walk 0.35 / dash 0.7 / jump 0.5、着地（jumped）で 1.0 のピーク。毎フレーム呼んでよい
   */
  movementLoudness(rank: MovementRank, jumped = false): number {
    const base = rank === 'dash' ? 0.7 : rank === 'walk' ? 0.35 : rank === 'jump' ? 0.5 : 0;
    if (jumped) this.movement = 1;
    this.movement = Math.max(this.movement, base);
    return this.movement;
  }

  /** 現在の音量（0〜1） */
  level(): number {
    return this.analyser ? this.mic : this.movement;
  }

  dispose(): void {
    this.releaseMic();
  }
}
