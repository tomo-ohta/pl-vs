/**
 * 17 章 操作仕様。PC（キーボード + Pointer Lock）とスマホ（スワイプ視点 + 左下スティック + 右下ボタン）を統一する。
 *
 * 統合担当向け: 呼び出し方
 * - コンストラクタの ui に `crouch: document.getElementById('btn-crouch')!` を追加する（省略可。無ければスマホのしゃがみボタンは無効）。
 * - InputState.crouch: PC は左 Ctrl または C を押している間 true。スマホは #btn-crouch のタップでトグル（active クラスで点灯）。
 * - `resetCrouchToggle()` でスマホのトグルを解除できる（乗車開始や部屋遷移で姿勢を戻したいとき）。
 * - PC で Ctrl+W / Ctrl+D 等のブラウザ既定動作は preventDefault できない（Pointer Lock 中も）。C キーを主、Ctrl を副として案内する。
 */

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

  private keys = new Set<string>();
  private lookDX = 0;
  private lookDY = 0;
  private jumpEdge = false;
  private interactEdge = false;
  private flashlightEdge = false;
  private menuEdge = false;
  private tap: { x: number; y: number } | null = null;
  private stick = { active: false, id: -1, x: 0, y: 0, cx: 0, cy: 0 };
  private lookPointer = { id: -1, x: 0, y: 0, moved: 0, t: 0 };
  private touchDash = false;
  private touchJump = false;
  /** スマホのしゃがみトグル状態 */
  private touchCrouch = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ui: {
      touchRoot: HTMLElement;
      stick: HTMLElement;
      knob: HTMLElement;
      jump: HTMLElement;
      dash: HTMLElement;
      menu: HTMLElement;
      /** しゃがみトグルボタン（省略可） */
      crouch?: HTMLElement;
    },
  ) {
    this.bindKeyboard();
    this.bindPointerLock();
    this.bindTouch();
    if (window.matchMedia('(pointer: coarse)').matches) this.setMode('mobile');
  }

  setMode(m: InputMode): void {
    if (this.mode === m) return;
    this.mode = m;
    this.ui.touchRoot.hidden = m !== 'mobile';
    this.onModeChange?.(m);
  }

  // ---------------------------------------------------------------- PC
  private bindKeyboard(): void {
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
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private bindPointerLock(): void {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.mode === 'pc' && this.enabled && this.useLock) this.menuEdge = true; // Esc で解除 → メニュー
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX * this.pcSensitivity * this.sensitivityScale;
      this.lookDY += e.movementY * this.pcSensitivity * this.sensitivityScale;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.mode !== 'pc') return;
      if (this.locked) { this.interactEdge = true; return; }
      // Esc でメニューを閉じた直後は（ユーザー操作扱いにならず）Pointer Lock を取り直せないので、クリックで取り直す
      if (this.enabled && this.useLock) void this.requestLock();
    });
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
    });
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
    });
    const endStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.active = false;
      this.stick.x = 0;
      this.stick.y = 0;
      setKnob(0, 0);
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);

    const hold = (el: HTMLElement, on: () => void, off: () => void) => {
      el.addEventListener('pointerdown', (e) => {
        this.setMode('mobile');
        el.classList.add('active');
        on();
        e.preventDefault();
      });
      const end = () => {
        el.classList.remove('active');
        off();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
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
    });
    // しゃがみはトグル（押している間だと親指が塞がるため）。active クラスで点灯
    if (crouch) {
      crouch.addEventListener('pointerdown', (e) => {
        this.setMode('mobile');
        this.touchCrouch = !this.touchCrouch;
        crouch.classList.toggle('active', this.touchCrouch);
        e.preventDefault();
      });
    }

    // 画面スワイプで視点。短いタップはインタラクト
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.setMode('mobile');
      if (this.lookPointer.id !== -1) return;
      this.lookPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer.id) return;
      const dx = e.clientX - this.lookPointer.x;
      const dy = e.clientY - this.lookPointer.y;
      this.lookPointer.x = e.clientX;
      this.lookPointer.y = e.clientY;
      this.lookPointer.moved += Math.abs(dx) + Math.abs(dy);
      this.lookDX += dx * this.mobileSensitivity * this.sensitivityScale;
      this.lookDY += dy * this.mobileSensitivity * this.sensitivityScale;
    });
    const endLook = (e: PointerEvent) => {
      if (e.pointerId !== this.lookPointer.id) return;
      const dt = performance.now() - this.lookPointer.t;
      if (this.lookPointer.moved < 12 && dt < 350) {
        this.tap = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
      }
      this.lookPointer.id = -1;
    };
    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);
  }

  /** スマホのしゃがみトグルを解除する（乗車開始・リスポーン時など） */
  resetCrouchToggle(): void {
    this.touchCrouch = false;
    this.ui.crouch?.classList.remove('active');
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
