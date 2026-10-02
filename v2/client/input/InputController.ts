/**
 * 操作（v1 input/InputController.ts から移植。v1 企画 17 章 操作仕様）。PC（キーボード + Pointer Lock）とスマホ
 * （スワイプ視点 + 左下スティック + 右下ボタン）を同じ InputState にまとめる。
 *
 * v2 での変更（入力の読み方・数値は v1 と同じ）:
 *   - 要素は ui/dom.ts の mountUi が作る（`new InputController(canvas, ui.input)`）。v1 は index.html の固定の要素
 *   - スマホの判定は client/device.ts の IS_MOBILE（v1 と同じ `pointer: coarse`）
 *   - dispose() で登録したリスナーをすべて外せる
 *   - InputState は v1 のまま。シミュレーションの命令（連番・tick 付き）への変換と、tap（画面座標）を「この扉を開けたい」に
 *     変える処理は client/game 側で行う（継承計画 3 章）
 *
 * 統合担当向け: 呼び出し方
 * - 毎フレーム `poll()` で InputState を受け取る（lookDX / lookDY と「押した瞬間」の値は poll ごとにリセット）。
 * - `enabled = false`（メニュー中・遷移中）の間は移動・視点・動作を 0 にする。menu（Esc / メニューボタン）だけは届く。
 * - PC は開始・再開のクリック（ユーザージェスチャ内）で `requestLock()`、メニューを開くときは `exitLock()`。
 *   Esc で Pointer Lock が外れると menu が立つ（メニューを開く合図）。`?nolock=1` で Pointer Lock を使わない（埋め込みブラウザ・自動テスト）。
 * - InputState.crouch: PC は左 Ctrl または C を押している間 true。スマホはしゃがむボタンのタップでトグル（active クラスで点灯）。
 * - `resetCrouchToggle()` でスマホのトグルを解除できる（乗車開始や遷移で姿勢を戻したいとき）。
 * - 視点感度は `sensitivityScale = settings.data.lookSensitivity`（Settings.onChange で追従させる）。
 * - PC で Ctrl+W / Ctrl+D 等のブラウザ既定動作は preventDefault できない（Pointer Lock 中も）。C キーを主、Ctrl を副として案内する。
 */
import { IS_MOBILE } from '../device.ts';

export interface InputState {
  /** x: 右(+) / y: 前(+)。-1..1 */
  moveX: number;
  moveY: number;
  /** 視点変化（ラジアン）。poll ごとにリセット */
  lookDX: number;
  lookDY: number;
  jump: boolean;
  dash: boolean;
  /** しゃがみ（PC: 押している間 / スマホ: トグル） */
  crouch: boolean;
  interact: boolean;
  /** R キーの押下（そのフレームだけ true）。懐中電灯のオン / オフ */
  flashlight: boolean;
  menu: boolean;
  /** タップによるインタラクト（画面座標 NDC）。無ければ null */
  tap: { x: number; y: number } | null;
}

export type InputMode = 'pc' | 'mobile';

/** スマホの操作に使う要素（ui/dom.ts の mountUi が作る UiRefs.input をそのまま渡せる） */
export interface InputUi {
  /** スマホの操作の入れ物（PC では hidden） */
  touchRoot: HTMLElement;
  stick: HTMLElement;
  knob: HTMLElement;
  jump: HTMLElement;
  dash: HTMLElement;
  menu: HTMLElement;
  /** しゃがみトグルボタン（省略可。無ければスマホのしゃがみは無効） */
  crouch?: HTMLElement;
}

export class InputController {
  mode: InputMode = 'pc';
  locked = false;
  enabled = true;
  pcSensitivity = 0.002;
  /** デバッグ用: Pointer Lock を使わない（?nolock=1）。埋め込みブラウザや自動テスト向け */
  useLock = !new URLSearchParams(location.search).has('nolock');
  mobileSensitivity = 0.004;
  /** 設定パネルの視点感度倍率（Settings.lookSensitivity）。pcSensitivity / mobileSensitivity に掛ける */
  sensitivityScale = 1;
  onModeChange: ((m: InputMode) => void) | null = null;

  private readonly canvas: HTMLCanvasElement;
  private readonly ui: InputUi;
  /** dispose で全リスナーを外すための合図 */
  private readonly listeners = new AbortController();
  private keys = new Set<string>();
  private lookDX = 0;
  private lookDY = 0;
  private jumpEdge = false;
  private interactEdge = false;
  private flashlightEdge = false;
  private menuEdge = false;
  private tap: { x: number; y: number } | null = null;
  private stick = { active: false, id: -1, x: 0, y: 0, cx: 0, cy: 0 };
  private lookPointer = { id: -1, x: 0, y: 0, moved: 0, t: 0, last: 0 };
  private touchDash = false;
  private touchJump = false;
  /** スマホのしゃがみトグル状態 */
  private touchCrouch = false;

  constructor(canvas: HTMLCanvasElement, ui: InputUi) {
    this.canvas = canvas;
    this.ui = ui;
    this.bindKeyboard();
    this.bindPointerLock();
    this.bindTouch();
    if (IS_MOBILE) this.setMode('mobile');
  }

  setMode(m: InputMode): void {
    if (this.mode === m) return;
    this.mode = m;
    this.ui.touchRoot.hidden = m !== 'mobile';
    this.onModeChange?.(m);
  }

  /** 登録したリスナーをすべて外す（Pointer Lock も解除する）。以後この入力は何も受け取らない */
  dispose(): void {
    this.listeners.abort();
    this.exitLock();
    this.keys.clear();
  }

  // ---------------------------------------------------------------- PC
  private bindKeyboard(): void {
    const { signal } = this.listeners;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpEdge = true;
      if (e.code === 'KeyE') this.interactEdge = true;
      if (e.code === 'KeyR' && !e.repeat) this.flashlightEdge = true;
      if (e.code === 'Escape') this.menuEdge = true;
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      // しゃがみ中の Ctrl+移動キーがブラウザのショートカットになるのを可能な範囲で抑える（Ctrl+W 等は抑止不可）
      if (e.ctrlKey && ['KeyA', 'KeyS', 'KeyD', 'KeyE'].includes(e.code)) e.preventDefault();
      this.setMode('pc');
    }, { signal });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), { signal });
    window.addEventListener('blur', () => this.keys.clear(), { signal });
  }

  private bindPointerLock(): void {
    const { signal } = this.listeners;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.mode === 'pc' && this.enabled && this.useLock) this.menuEdge = true; // Esc で解除 → メニュー
    }, { signal });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX * this.pcSensitivity * this.sensitivityScale;
      this.lookDY += e.movementY * this.pcSensitivity * this.sensitivityScale;
    }, { signal });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.mode !== 'pc') return;
      if (this.locked) { this.interactEdge = true; return; }
      // Esc でメニューを閉じた直後は（ユーザー操作扱いにならず）Pointer Lock を取り直せないので、クリックで取り直す
      if (this.enabled && this.useLock) void this.requestLock();
    }, { signal });
  }

  /** Pointer Lock を要求する。取得できれば true（Esc 直後などユーザー操作扱いにならない呼び出しはブラウザが拒否する） */
  async requestLock(): Promise<boolean> {
    if (this.mode !== 'pc' || !this.useLock) return true;
    try {
      await this.canvas.requestPointerLock();
    } catch {
      /* ブラウザが拒否した場合は無視 */
    }
    return this.locked || document.pointerLockElement === this.canvas;
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ---------------------------------------------------------------- Touch
  private bindTouch(): void {
    const { signal } = this.listeners;
    const { stick, knob, jump, dash, menu, crouch } = this.ui;
    const R = 66;
    const setKnob = (dx: number, dy: number) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener('pointerdown', (e) => {
      this.setMode('mobile');
      const r = stick.getBoundingClientRect();
      this.stick = { active: true, id: e.pointerId, x: 0, y: 0, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      stick.setPointerCapture(e.pointerId);
      e.preventDefault();
    }, { signal });
    stick.addEventListener('pointermove', (e) => {
      if (!this.stick.active || e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.cx;
      let dy = e.clientY - this.stick.cy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx *= R / len;
        dy *= R / len;
      }
      setKnob(dx, dy);
      const dead = 0.1;
      const nx = dx / R;
      const ny = dy / R;
      const mag = Math.hypot(nx, ny);
      if (mag < dead) {
        this.stick.x = 0;
        this.stick.y = 0;
      } else {
        const k = (mag - dead) / (1 - dead) / mag;
        this.stick.x = nx * k;
        this.stick.y = -ny * k;
      }
    }, { signal });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.active = false;
      this.stick.x = 0;
      this.stick.y = 0;
      setKnob(0, 0);
    };
    stick.addEventListener('pointerup', endStick, { signal });
    stick.addEventListener('pointercancel', endStick, { signal });

    const hold = (el: HTMLElement, on: () => void, off: () => void) => {
      el.addEventListener('pointerdown', (e) => {
        this.setMode('mobile');
        el.classList.add('active');
        on();
        e.preventDefault();
      }, { signal });
      const end = () => {
        el.classList.remove('active');
        off();
      };
      el.addEventListener('pointerup', end, { signal });
      el.addEventListener('pointercancel', end, { signal });
      el.addEventListener('pointerleave', end, { signal });
    };
    hold(dash, () => (this.touchDash = true), () => (this.touchDash = false));
    hold(jump, () => {
      this.touchJump = true;
      this.jumpEdge = true;
    }, () => (this.touchJump = false));
    menu.addEventListener('pointerdown', (e) => {
      this.setMode('mobile');
      this.menuEdge = true;
      e.preventDefault();
    }, { signal });
    // しゃがみはトグル（押している間だと親指が塞がるため）。active クラスで点灯
    if (crouch) {
      crouch.addEventListener('pointerdown', (e) => {
        this.setMode('mobile');
        this.touchCrouch = !this.touchCrouch;
        crouch.classList.toggle('active', this.touchCrouch);
        crouch.setAttribute('aria-pressed', String(this.touchCrouch));
        e.preventDefault();
      }, { signal });
    }

    // 画面スワイプで視点。短いタップはインタラクト。
    // 視点の指は 1 本だけ追う。その指の終了（pointerup / pointercancel / lostpointercapture）を取りこぼすと lookPointer.id が
    // 残って以後のスワイプを全て無視してしまうので、canvas で pointer capture を取り、終了は window（capture 段）でも拾う。
    // さらに新しい指が来たとき、追っている指がもう画面に無ければ（activeTouches に無い）新しい指へ乗り換える
    const activeTouches = new Set<number>();
    window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') activeTouches.add(e.pointerId); }, { capture: true, signal });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.setMode('mobile');
      // 追っている指が 2 秒以上何も送ってこなければ、終了の通知ごと失われたとみなして乗り換える
      const now = performance.now();
      const tracking = this.lookPointer.id !== -1 && activeTouches.has(this.lookPointer.id) && now - this.lookPointer.last < 2000;
      if (tracking && this.lookPointer.id !== e.pointerId) return;
      this.lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, t: now, last: now };
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* 既に離れた指 */ }
      e.preventDefault();
    }, { signal });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer.id) return;
      // 高頻度の入力は getCoalescedEvents に分かれているが、差分は最後の座標との差で足りる
      const dx = e.clientX - this.lookPointer.x;
      const dy = e.clientY - this.lookPointer.y;
      this.lookPointer.x = e.clientX;
      this.lookPointer.y = e.clientY;
      this.lookPointer.moved += Math.abs(dx) + Math.abs(dy);
      this.lookPointer.last = performance.now();
      this.lookDX += dx * this.mobileSensitivity * this.sensitivityScale;
      this.lookDY += dy * this.mobileSensitivity * this.sensitivityScale;
    }, { signal });
    const endLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookPointer.id) return;
      const dt = performance.now() - this.lookPointer.t;
      if (e.type === 'pointerup' && this.lookPointer.moved < 12 && dt < 350) {
        this.tap = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
      }
      this.lookPointer.id = -1;
    };
    const endTouch = (e: PointerEvent) => {
      activeTouches.delete(e.pointerId);
      endLook(e);
    };
    this.canvas.addEventListener('lostpointercapture', endLook, { signal });
    window.addEventListener('pointerup', endTouch, { capture: true, signal });
    window.addEventListener('pointercancel', endTouch, { capture: true, signal });
    // iOS Safari は touch-action: none でも、canvas 以外から始まったピンチ / ダブルタップで拡大することがあるので止める
    this.canvas.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false, signal });
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { signal });
  }

  /** スマホのしゃがみトグルを解除する（乗車開始・リスポーン時など） */
  resetCrouchToggle(): void {
    this.touchCrouch = false;
    this.ui.crouch?.classList.remove('active');
    this.ui.crouch?.setAttribute('aria-pressed', 'false');
  }

  /** 現在しゃがみ入力が立っているか（poll せずに参照したいとき用） */
  get crouchHeld(): boolean {
    if (this.mode === 'pc') return this.keys.has('ControlLeft') || this.keys.has('KeyC');
    return this.touchCrouch;
  }

  // ---------------------------------------------------------------- poll
  poll(): InputState {
    let moveX = 0;
    let moveY = 0;
    if (this.mode === 'pc') {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveY += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveY -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
      const len = Math.hypot(moveX, moveY);
      if (len > 1) {
        moveX /= len;
        moveY /= len;
      }
    } else {
      moveX = this.stick.x;
      moveY = this.stick.y;
    }
    const st: InputState = {
      moveX,
      moveY,
      lookDX: this.lookDX,
      lookDY: this.lookDY,
      jump: this.jumpEdge,
      dash: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchDash,
      crouch: this.crouchHeld,
      interact: this.interactEdge,
      flashlight: this.flashlightEdge,
      menu: this.menuEdge,
      tap: this.tap,
    };
    this.lookDX = 0;
    this.lookDY = 0;
    this.jumpEdge = false;
    this.interactEdge = false;
    this.flashlightEdge = false;
    this.menuEdge = false;
    this.tap = null;
    void this.touchJump;
    if (!this.enabled) {
      return { ...st, moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, jump: false, dash: false, crouch: false, interact: false, flashlight: false, tap: null };
    }
    return st;
  }
}
