/**
 * キーボードとマウス（Pointer Lock）の入力。キーは KeyboardEvent.code で読む。
 * fake（URL の ?test=1）: Pointer Lock を使わずに「固定した」ことにする（自動の確かめ用。Esc で外す）
 */
export class Input {
  readonly keys = new Set<string>();
  /** このフレームに押したキー */
  readonly pressed = new Set<string>();
  lookDX = 0;
  lookDY = 0;
  click = false;
  wheel = 0;
  locked = false;
  private readonly el: HTMLElement;
  /** Pointer Lock が外れた / 付いたとき */
  onLockChange: (locked: boolean) => void = () => {};

  private readonly fake: boolean;

  constructor(el: HTMLElement, fake = false) {
    this.el = el;
    this.fake = fake;
    window.addEventListener('keydown', (e) => {
      if (this.fake && this.locked && e.code === 'Escape') this.unlock();
      // Tab（タブレット）・Space で画面が動かないように
      if (this.locked && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX;
      this.lookDY += e.movementY;
    });
    el.addEventListener('mousedown', (e) => {
      if (this.locked && e.button === 0) this.click = true;
    });
    el.addEventListener(
      'wheel',
      (e) => {
        if (!this.locked) return;
        this.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
    if (fake) return;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (!this.locked) this.keys.clear();
      this.onLockChange(this.locked);
    });
  }

  lock(): void {
    if (this.locked) return;
    if (this.fake) {
      this.locked = true;
      this.onLockChange(true);
      return;
    }
    // 外した直後は少し待たないと付かないことがある（その場合は何もしない）
    const r = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
    r?.catch?.(() => {});
  }

  unlock(): void {
    if (!this.locked) return;
    if (this.fake) {
      this.locked = false;
      this.keys.clear();
      this.onLockChange(false);
    } else document.exitPointerLock();
  }

  down(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  hit(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  /** フレームの終わりに、そのフレームだけの入力を消す */
  endFrame(): void {
    this.pressed.clear();
    this.lookDX = 0;
    this.lookDY = 0;
    this.click = false;
    this.wheel = 0;
  }
}
