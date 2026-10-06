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
 * - InputState.map: M キー / スマホの地図ボタン（押した瞬間）。drop / flashlight はスマホの「置く」「ライト」ボタンでも立つ（段階 4）。
 *   map は menu と同じく、無効の間（メニュー中）も届く
 * - 視点感度は `sensitivityScale = settings.data.lookSensitivity`（Settings.onChange で追従させる）。
 * - PC で Ctrl+W / Ctrl+D 等のブラウザ既定動作は preventDefault できない（Pointer Lock 中も）。C キーを主、Ctrl を副として案内する。
 * - キーの割り当ては `keymap`（input/keymap.ts。既定は DEFAULT_KEYMAP）。差し替えるとその割り当てで読む（将来の設定のため）。
 * - タブレット（client/tablet）: tablet（Tab / スマホの端末ボタン。押した瞬間）・tabletBack（Backspace）・tabletEnter（Enter）・
 *   数字キー（digits）・マウスの左ボタン（click / release / mouseHeld）・右ボタン（back）・ホイール（wheel）。どれも Pointer Lock 中だけ
 */
import { IS_MOBILE } from '../device.ts';
import { actionsOf, copyKeymap, type KeyAction, type KeyMap } from './keymap.ts';

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
  /** Q キーの押下（そのフレームだけ true）。持っている物を置く・投げる */
  drop: boolean;
  menu: boolean;
  /** M キー / 地図ボタンの押下（そのフレームだけ true）。地図を開く（メニューの地図のタブ）。無効の間も届く */
  map: boolean;
  /** タップによるインタラクト（画面座標 NDC）。無ければ null */
  tap: { x: number; y: number } | null;
  /** タブレットを出す・しまう（Tab / 端末ボタン。押した瞬間）。無効の間も届かない */
  tablet: boolean;
  /** 戻る（右クリック・Backspace。押した瞬間） */
  back: boolean;
  /** Backspace（押した瞬間。back と一緒に立つ。数字を消すのに使う） */
  backspace: boolean;
  /** 決める（Enter。押した瞬間） */
  enter: boolean;
  /** マウスの左ボタンを押した / 離した瞬間・押している間（Pointer Lock 中） */
  click: boolean;
  release: boolean;
  mouseHeld: boolean;
  /** ホイール（下へ + 。1 段 ≈ 100） */
  wheel: number;
  /** 押した数字キー（順に。'0'〜'9'） */
  digits: string;
}

export type InputMode = 'pc' | 'mobile';

/** スマホの操作に使う要素（ui/dom.ts の mountUi が作る UiRefs.input をそのまま渡せる） */
export interface InputUi {
  /** タブレットのボタン（省略可。押すと tablet。Tab キーと同じ） */
  tablet?: HTMLElement;
  /** スマホの操作の入れ物（PC では hidden） */
  touchRoot: HTMLElement;
  stick: HTMLElement;
  knob: HTMLElement;
  jump: HTMLElement;
  dash: HTMLElement;
  menu: HTMLElement;
  /** しゃがみトグルボタン（省略可。無ければスマホのしゃがみは無効） */
  crouch?: HTMLElement;
  /** 地図ボタン（省略可。押すと map） */
  map?: HTMLElement;
  /** 懐中電灯ボタン（省略可。押すと flashlight。R キーと同じ） */
  flashlight?: HTMLElement;
  /** 置く・投げるボタン（省略可。押すと drop。Q キーと同じ） */
  drop?: HTMLElement;
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
  /** キーの割り当て（差し替えてよい） */
  keymap: KeyMap = copyKeymap();
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
  private dropEdge = false;
  private menuEdge = false;
  private mapEdge = false;
  private tabletEdge = false;
  private backEdge = false;
  private backspaceEdge = false;
  private enterEdge = false;
  private clickEdge = false;
  private releaseEdge = false;
  private mouseHeld = false;
  private wheel = 0;
  private digits = '';
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
      const acts = actionsOf(this.keymap, e.code);
      const on = (a: KeyAction): boolean => acts.includes(a);
      if (on('jump')) this.jumpEdge = true;
      if (on('interact')) this.interactEdge = true;
      if (on('flashlight')) this.flashlightEdge = true;
      if (on('drop')) this.dropEdge = true;
      if (on('menu')) this.menuEdge = true;
      if (on('map')) this.mapEdge = true;
      if (on('tablet')) this.tabletEdge = true;
      if (on('tabletBack')) { this.backEdge = true; this.backspaceEdge = true; }
      if (on('tabletEnter')) this.enterEdge = true;
      const dm = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (dm) this.digits += dm[1];
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      // 遊んでいる間の Tab（フォーカスの移動）・Backspace は止める（メニューの入力欄では止めない）
      if (this.enabled && (on('tablet') || on('tabletBack')) && !(e.target instanceof HTMLInputElement)) e.preventDefault();
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
      if (!this.locked) this.mouseHeld = false;
      if (!this.locked && this.mode === 'pc' && this.enabled && this.useLock) this.menuEdge = true; // Esc で解除 → メニュー
    }, { signal });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX * this.pcSensitivity * this.sensitivityScale;
      this.lookDY += e.movementY * this.pcSensitivity * this.sensitivityScale;
    }, { signal });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.mode !== 'pc') return;
      if (e.button === 2) { this.backEdge = true; return; }
      if (e.button !== 0) return;
      if (this.locked) { this.interactEdge = true; this.clickEdge = true; this.mouseHeld = true; return; }
      // Esc でメニューを閉じた直後は（ユーザー操作扱いにならず）Pointer Lock を取り直せないので、クリックで取り直す
      if (this.enabled && this.useLock) void this.requestLock();
    }, { signal });
    document.addEventListener('mouseup', (e) => {
      if (e.button !== 0 || !this.mouseHeld) return;
      this.mouseHeld = false;
      this.releaseEdge = true;
    }, { signal });
    // 右クリックはタブレットの「戻る」（メニューを出さない）
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.wheel += e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      e.preventDefault();
    }, { signal, passive: false });
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
    const { stick, knob, jump, dash, menu, crouch, map, flashlight, drop, tablet } = this.ui;
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
    // 地図・懐中電灯・置く: 押した瞬間だけ（PC の M / R / Q と同じ）
    const edge = (btn: HTMLElement | undefined, set: () => void): void => {
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        this.setMode('mobile');
        btn.classList.add('active');
        set();
        e.preventDefault();
      }, { signal });
      const end = (): void => btn.classList.remove('active');
      btn.addEventListener('pointerup', end, { signal });
      btn.addEventListener('pointercancel', end, { signal });
      btn.addEventListener('pointerleave', end, { signal });
    };
    edge(map, () => (this.mapEdge = true));
    edge(flashlight, () => (this.flashlightEdge = true));
    edge(drop, () => (this.dropEdge = true));
    edge(tablet, () => (this.tabletEdge = true));
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
    if (this.mode === 'pc') return this.held('crouch');
    return this.touchCrouch;
  }

  /** 操作 a のキーのどれかを押しているか */
  private held(a: KeyAction): boolean {
    return this.keymap[a].some((k) => this.keys.has(k));
  }

  // ---------------------------------------------------------------- poll
  poll(): InputState {
    let moveX = 0;
    let moveY = 0;
    if (this.mode === 'pc') {
      if (this.held('forward')) moveY += 1;
      if (this.held('back')) moveY -= 1;
      if (this.held('right')) moveX += 1;
      if (this.held('left')) moveX -= 1;
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
      dash: this.held('dash') || this.touchDash,
      crouch: this.crouchHeld,
      interact: this.interactEdge,
      flashlight: this.flashlightEdge,
      drop: this.dropEdge,
      menu: this.menuEdge,
      map: this.mapEdge,
      tap: this.tap,
      tablet: this.tabletEdge,
      back: this.backEdge,
      backspace: this.backspaceEdge,
      enter: this.enterEdge,
      click: this.clickEdge,
      release: this.releaseEdge,
      mouseHeld: this.mouseHeld,
      wheel: this.wheel,
      digits: this.digits,
    };
    this.lookDX = 0;
    this.lookDY = 0;
    this.jumpEdge = false;
    this.interactEdge = false;
    this.flashlightEdge = false;
    this.dropEdge = false;
    this.menuEdge = false;
    this.mapEdge = false;
    this.tabletEdge = false;
    this.backEdge = false;
    this.backspaceEdge = false;
    this.enterEdge = false;
    this.clickEdge = false;
    this.releaseEdge = false;
    this.wheel = 0;
    this.digits = '';
    this.tap = null;
    void this.touchJump;
    if (!this.enabled) {
      return { ...st, moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, jump: false, dash: false, crouch: false, interact: false, flashlight: false, drop: false, tap: null, tablet: false, back: false, backspace: false, enter: false, click: false, release: st.release, mouseHeld: false, wheel: 0, digits: '' };
    }
    return st;
  }
}
