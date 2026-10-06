/**
 * ルーム ID をアドレスとタブの名前に出す（docs/endless-world.md 15 章）: 番号の違う部屋に入ったら、ページを読み込み直さずに
 * アドレスを `?id=1234` に（history.replaceState。戻るの履歴は増やさない）、タブの名前を `Room 1234` にする。
 *
 * ブラウザは短い間に何度も書き換えると止める（Safari は 30 秒に 100 回まで）ので、前に書き換えてから minMs たつまでは、
 * 最後の番号だけを後で書く（扉の前を行き来しても書き換えは間引く）
 */

/** アドレスに残す指定（開発用の調整など）。始める場所の指定（id・深さ・表と裏）は外す */
const START_KEYS = ['id', 'depth', 'variant'];

/** 部屋の番号の付いたアドレス（今のアドレスの開発用の指定は残す） */
export function roomUrl(id: number | string, search = location.search): string {
  const q = new URLSearchParams(search);
  const out = new URLSearchParams({ id: String(id) });
  for (const [k, v] of q) if (!START_KEYS.includes(k)) out.append(k, v);
  return `${location.pathname}?${out.toString()}`;
}

/** トップページのアドレス（世界の seed・開発用の調整は残す） */
export function topUrl(search = location.search): string {
  const q = new URLSearchParams(search);
  const out = new URLSearchParams();
  for (const [k, v] of q) if (!START_KEYS.includes(k)) out.append(k, v);
  const s = out.toString();
  return `${location.pathname}${s ? `?${s}` : ''}`;
}

export const roomTitle = (id: number | string): string => `Room ${id}`;

export class RoomAddress {
  private shown: number | null = null;
  private want: number | null = null;
  private lastAt = -Infinity;
  private timer = 0;
  private readonly minMs: number;

  constructor(o: { minMs?: number; current?: number | null } = {}) {
    this.minMs = o.minMs ?? 400;
    this.shown = o.current ?? null;
  }

  /** 今いる部屋の番号（番号の無い所では呼ばない） */
  set(id: number): void {
    if (id === this.want) return;
    this.want = id;
    clearTimeout(this.timer);
    const wait = this.lastAt + this.minMs - performance.now();
    if (wait > 0) this.timer = window.setTimeout(() => this.apply(), wait);
    else this.apply();
  }

  private apply(): void {
    const id = this.want;
    if (id === null) return;
    document.title = roomTitle(id);
    if (id === this.shown) return;
    this.shown = id;
    this.lastAt = performance.now();
    try {
      history.replaceState(history.state, '', roomUrl(id));
    } catch (e) {
      // 書き換えすぎで止められた: 次に部屋が変わったときにまた書く
      console.warn('[ルーム ID] アドレスを書き換えられません', e);
      this.shown = null;
    }
  }
}
