import type { RoomDefinition } from '../core/types';

export class Hud {
  private readonly room = document.getElementById('hud-room')!;
  private readonly count = document.getElementById('hud-count')!;
  private readonly hint = document.getElementById('hud-hint')!;
  private readonly debug = document.getElementById('debug')!;
  /** 左上の部屋名・レア度・発見数はデバッグ HUD がオンのときだけ出す（操作案内 hud-hint は常に出す） */
  private readonly info = [this.room, this.count];
  private lastRoom = '';
  private lastCount = -1;
  private lastHint = '';

  constructor() {
    this.syncInfo();
  }

  setRoom(def: RoomDefinition | null, adapter: boolean, fallback: boolean): void {
    const key = def ? def.id + (fallback ? '!' : '') : adapter ? 'adapter' : '';
    if (key === this.lastRoom) return;
    this.lastRoom = key;
    if (!def) {
      this.room.innerHTML = adapter ? '<span style="color:#9aa3b2">通路</span>' : '';
      return;
    }
    this.room.innerHTML = `${escapeHtml(def.name)}<span class="rar">${def.rarity} ${def.id}</span>${fallback ? '<span class="rar" style="color:#b46cff">TODO</span>' : ''}` +
      (def.effectLabel && def.effectLabel !== '特になし' ? `<div style="font-size:11px;color:#9aa3b2">${escapeHtml(def.effectLabel)}</div>` : '');
  }

  setCount(n: number): void {
    if (n === this.lastCount) return;
    this.lastCount = n;
    this.count.textContent = `発見した部屋: ${n}`;
  }

  setHint(text: string): void {
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.hint.textContent = text;
  }

  setDebug(text: string): void {
    this.debug.textContent = text;
  }

  toggleDebug(): boolean {
    this.debug.hidden = !this.debug.hidden;
    this.syncInfo();
    return !this.debug.hidden;
  }

  /** 左上の部屋名・レア度・発見数は常に表示（第17回でユーザー指示により、デバッグ HUD 限定から戻した） */
  private syncInfo(): void {
    for (const el of this.info) el.hidden = false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
