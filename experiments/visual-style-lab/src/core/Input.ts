/** キーボード・マウス（ポインタロック）の入力 */
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
  private moveTouch: { id: number; x: number; y: number } | null = null;
  private lookTouch: { id: number; x: number; y: number } | null = null;

  constructor(el: HTMLElement) {
    // タッチ: 画面の左半分をなぞると移動、右半分をなぞると見回す
    el.addEventListener('touchstart', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < window.innerWidth / 2 && !this.moveTouch) this.moveTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        else if (!this.lookTouch) this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (this.moveTouch?.id === t.identifier) {
          this.moveX = Math.max(-1, Math.min(1, (t.clientX - this.moveTouch.x) / 60));
          this.moveY = Math.max(-1, Math.min(1, -(t.clientY - this.moveTouch.y) / 60));
        } else if (this.lookTouch?.id === t.identifier) {
          this.lookDX += (t.clientX - this.lookTouch.x) * 1.6;
          this.lookDY += (t.clientY - this.lookTouch.y) * 1.6;
          this.lookTouch.x = t.clientX;
          this.lookTouch.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e: TouchEvent): void => {
      for (const t of Array.from(e.changedTouches)) {
        if (this.moveTouch?.id === t.identifier) {
          this.moveTouch = null;
          this.moveX = 0;
          this.moveY = 0;
        } else if (this.lookTouch?.id === t.identifier) this.lookTouch = null;
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('click', () => {
      if (!this.locked && !matchMedia('(pointer: coarse)').matches) void el.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX;
      this.lookDY += e.movementY;
    });
  }

  down(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  hit(code: string): boolean {
    return this.pressed.has(code);
  }

  endFrame(): void {
    this.pressed.clear();
    this.lookDX = 0;
    this.lookDY = 0;
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
}
