/**
 * 画面の表示（DOM。ホログラム調）: 照準と「押す」の案内・押した数・方位・今いる部屋の札・通知・画面の縁の光・操作の案内
 */
export interface RoomInfo {
  label: string;
  difficulty: number;
  visited: boolean;
  solved: boolean;
  /** ヒントの段階（0〜3）と、この部屋の新着のヒントの数 */
  stage: number;
  unseen: number;
}

export type ToastKind = 'info' | 'solved' | 'wrong' | 'unlock' | 'discover';

const PX_PER_DEG = 4;

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class Hud {
  readonly el = h('div');
  private readonly crosshair = h('div', 'crosshair');
  private readonly prompt = h('div', 'prompt', '<kbd>CLICK</kbd>ボタンを押す');
  private readonly seq = h('div', 'sequence');
  private readonly compass = h('div', 'compass');
  private readonly track = h('div', 'compass-track');
  private readonly card = h('div', 'room-card holo-panel');
  private readonly toasts = h('div', 'toasts');
  private readonly flashEl = h('div', 'flash');
  private readonly keys = h('div', 'keys');
  private seqKey = '';

  constructor(parent: HTMLElement) {
    this.el.id = 'hud';
    // 方位: 15° ごとの目盛り、45° ごとに文字（-360〜720° を並べて回り込みを見せる）
    const names: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -360; d <= 720; d += 15) {
      const x = (d + 360) * PX_PER_DEG;
      const n = ((d % 360) + 360) % 360;
      const tick = h('b', n % 45 === 0 ? 'major' : '');
      tick.style.left = `${x}px`;
      this.track.append(tick);
      const label = names[n] ? h('span', '', names[n]) : n % 15 === 0 && n % 45 !== 0 ? h('span', 'minor', String(n)) : null;
      if (label) {
        label.style.left = `${x}px`;
        this.track.append(label);
      }
    }
    this.compass.append(this.track);
    this.keys.innerHTML = [
      ['WASD', '移動'],
      ['SHIFT', '走る'],
      ['TAB', 'タブレット'],
      ['1 / 2', 'タブ'],
      ['ESC', '一時停止・設定'],
      ['N', '次のヒント段階（デバッグ）'],
    ]
      .map(([k, v]) => `<span><kbd>${k}</kbd>${v}</span>`)
      .join('');
    this.el.append(this.flashEl, this.compass, this.card, this.crosshair, this.prompt, this.seq, this.toasts, this.keys);
    parent.append(this.el);
  }

  setRoom(r: RoomInfo | null): void {
    if (!r) {
      this.card.style.display = 'none';
      return;
    }
    this.card.style.display = '';
    const dia = [0, 1, 2].map((k) => `<i class="${k < r.difficulty ? 'on' : ''}"></i>`).join('');
    const level = r.stage > 0 ? `<b>HINT LV ${r.stage}</b>` : `<span>ヒント未解放</span>`;
    this.card.innerHTML = `
      <div class="label">CURRENT ROOM</div>
      <div class="id">${r.label}</div>
      <div class="row">
        <span class="diamonds" title="難易度 ${r.difficulty}">${dia}</span>
        <span class="chip ${r.visited ? 'visited' : ''}">${r.visited ? '踏破' : '未踏破'}</span>
        <span class="chip ${r.solved ? 'solved' : ''}">${r.solved ? '制圧済み' : '未制圧'}</span>
      </div>
      <div class="hint-level">${level}${r.unseen > 0 ? '<span class="chip new">NEW HINT</span>' : ''}</div>`;
  }

  /** 照準の先にボタンがあるか（solved: 制圧済みの部屋のボタン） */
  setTarget(on: boolean, solved = false): void {
    this.crosshair.classList.toggle('target', on && !solved);
    this.prompt.classList.toggle('on', on);
    this.prompt.innerHTML = solved ? '<kbd>OK</kbd>この部屋は制圧済み' : '<kbd>CLICK</kbd>ボタンを押す';
  }

  /** タブレットを出している間は照準と案内を消す */
  setTabletOpen(open: boolean): void {
    this.crosshair.classList.toggle('hidden', open);
    this.keys.classList.toggle('dim', open);
    if (open) this.setTarget(false);
  }

  /** 押した数（全部押すと判定）。total 1 以下・0 個押した間は出さない */
  setSequence(pressed: number, total: number, wrong: boolean): void {
    const key = `${pressed}/${total}/${wrong}`;
    if (key === this.seqKey) return;
    this.seqKey = key;
    this.seq.classList.toggle('on', total > 1 && (pressed > 0 || wrong));
    this.seq.classList.toggle('wrong', wrong);
    this.seq.innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < pressed ? 'on' : ''}"></i>`).join('');
  }

  setYaw(yaw: number): void {
    const deg = (((yaw * 180) / Math.PI) % 360 + 360) % 360;
    const w = this.compass.clientWidth || 460;
    this.track.style.transform = `translateX(${w / 2 - (deg + 360) * PX_PER_DEG}px)`;
  }

  toast(kind: ToastKind, tag: string, msg: string, sub = '', ms = 2600): void {
    // ヒントの解放は 1 つだけ出す（続けて解放したときは差し替える）
    if (kind === 'unlock') this.toasts.querySelectorAll('.toast.unlock').forEach((e) => e.remove());
    const t = h('div', `toast holo-panel ${kind}`);
    t.innerHTML = `<span class="tag">${tag}</span><span class="msg">${msg}</span>${sub ? `<span class="sub">${sub}</span>` : ''}`;
    if (kind === 'unlock') this.toasts.prepend(t);
    else this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 360);
    }, ms);
  }

  flash(color: string): void {
    this.flashEl.style.setProperty('--flash', color);
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }
}
