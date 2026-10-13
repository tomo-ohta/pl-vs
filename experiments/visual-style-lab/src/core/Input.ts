/**
 * キーボード・マウス（ポインタロック）・タッチの入力。
 * タッチは Pointer Events で受ける（タブレット（src/tablet）の画面に当たった指は、タブレットが先に受け取って止めるので、
 * 見回し・移動に回らない。v2 の InputController と同じ受け方）
 */
export class Input {
  readonly keys = new Set<string>();
  lookDX = 0;
  lookDY = 0;
  /** 1 フレームだけ立つ押下（KeyboardEvent.code） */
  readonly pressed = new Set<string>();
  locked = false;
  /** タッチの移動（-1〜1。y は前が正） */
  moveX = 0;
  moveY = 0;
  /** マウスの左ボタンを押した / 離した瞬間（Pointer Lock 中だけ）・右ボタンを押した瞬間・ホイール（下へ +） */
  click = false;
  release = false;
  rightClick = false;
  wheel = 0;
  /** このフレームに押した数字キー（'0'〜'9'。順に） */
  digits = '';
  /** false の間は移動・見回し・キーを受けない（タブレットの写真から移る演出の間） */
  enabled = true;
  /** このフレームは効かせないキー（タブレットを持っている間の走る・跳ぶなど） */
  readonly suppress = new Set<string>();
  /** スマホ（指で操作する端末） */
  readonly mobile = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  private moveTouch: { id: number; x: number; y: number } | null = null;
  private lookTouch: { id: number; x: number; y: number } | null = null;

  constructor(el: HTMLElement) {
    el.style.touchAction = 'none';
    // タッチ: 画面の左半分をなぞると移動、右半分をなぞると見回す
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      if (e.clientX < window.innerWidth / 2 && !this.moveTouch) this.moveTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      else if (!this.lookTouch) this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') return;
      if (this.moveTouch?.id === e.pointerId) {
        this.moveX = Math.max(-1, Math.min(1, (e.clientX - this.moveTouch.x) / 60));
        this.moveY = Math.max(-1, Math.min(1, -(e.clientY - this.moveTouch.y) / 60));
      } else if (this.lookTouch?.id === e.pointerId) {
        this.lookDX += (e.clientX - this.lookTouch.x) * 1.6;
        this.lookDY += (e.clientY - this.lookTouch.y) * 1.6;
        this.lookTouch.x = e.clientX;
        this.lookTouch.y = e.clientY;
      }
    });
    const end = (e: PointerEvent): void => {
      if (this.moveTouch?.id === e.pointerId) {
        this.moveTouch = null;
        this.moveX = 0;
        this.moveY = 0;
      } else if (this.lookTouch?.id === e.pointerId) this.lookTouch = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!this.keys.has(e.code)) {
        this.pressed.add(e.code);
        const d = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
        if (d) this.digits += d[1];
      }
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab' || e.code === 'Backspace') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('click', () => {
      if (!this.locked && !this.mobile) void el.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX;
      this.lookDY += e.movementY;
    });
    // マウスのボタン・ホイール（Pointer Lock 中だけ。タブレットの指のカーソル・シャッター・戻る）
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.click = true;
      else if (e.button === 2) this.rightClick = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (this.locked && e.button === 0) this.release = true;
    });
    document.addEventListener('wheel', (e) => {
      if (this.locked) this.wheel += e.deltaY * (e.deltaMode === 1 ? 33 : 1);
    }, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(...codes: string[]): boolean {
    if (!this.enabled) return false;
    return codes.some((c) => this.keys.has(c) && !this.suppress.has(c));
  }

  hit(code: string): boolean {
    if (!this.enabled || this.suppress.has(code)) return false;
    return this.pressed.has(code);
  }

  endFrame(): void {
    this.pressed.clear();
    this.lookDX = 0;
    this.lookDY = 0;
    this.click = false;
    this.release = false;
    this.rightClick = false;
    this.wheel = 0;
    this.digits = '';
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}
