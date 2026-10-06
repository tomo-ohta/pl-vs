/**
 * タブレットの決まり（DOM・three.js を使わない。Node の試験 tests/tablet-logic.test.ts で確かめる）: アプリの一覧と、探索のダイアル。
 */

/** ホーム画面のアプリ（並び順どおり） */
export const APPS = [
  { id: 'camera', label: 'カメラ' },
  { id: 'explore', label: '探索' },
  { id: 'map', label: 'マップ' },
  { id: 'sns', label: 'SNS' },
  { id: 'gallery', label: 'ギャラリー' },
  { id: 'settings', label: '設定' },
] as const;

export type AppId = 'home' | (typeof APPS)[number]['id'];

/** 探索のダイアルの桁の数（ルーム ID は 4〜9 桁ほど。前の 0 は薄く出す） */
export const DIAL_DIGITS = 9;

/**
 * 探索のダイアル: 桁ごとに回す（step）・数字キーで入れる（電卓のように右から入る。数を入れた・回した後の最初の数字は入れ直し）・1 文字消す
 */
export class DialModel {
  /** 上の桁から */
  readonly digits: number[] = new Array<number>(DIAL_DIGITS).fill(0);
  /** 次に数字キーを押したら、今の数を消して入れ直す（数字キーで続けて入れている間だけ false） */
  fresh = true;

  constructor(value = 0) {
    this.set(value);
  }

  /** 数を入れる（入りきらない上の桁は捨てる。負・数でない物は 0） */
  set(value: number): void {
    let v = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    for (let i = DIAL_DIGITS - 1; i >= 0; i--) { this.digits[i] = v % 10; v = Math.floor(v / 10); }
    this.fresh = true;
  }

  get value(): number {
    return this.digits.reduce((a, d) => a * 10 + d, 0);
  }

  /** 前の 0 を除いた数字（0 なら '0'） */
  get text(): string {
    return String(this.value);
  }

  /** 桁 i が前の 0（薄く出す）か */
  leading(i: number): boolean {
    for (let k = 0; k <= i; k++) if (this.digits[k] !== 0) return false;
    return i < DIAL_DIGITS - 1;
  }

  /** 桁 i を d 回す（0〜9 で回る） */
  step(i: number, d: number): void {
    if (i < 0 || i >= DIAL_DIGITS || !d) return;
    this.digits[i] = (((this.digits[i]! + d) % 10) + 10) % 10;
    this.fresh = true;
  }

  /** 数字キー: 右から入れる（一番上の桁は押し出す） */
  type(ch: string): void {
    if (!/^\d$/.test(ch)) return;
    if (this.fresh) { this.digits.fill(0); this.fresh = false; }
    this.digits.shift();
    this.digits.push(Number(ch));
  }

  /** 1 文字消す（右の桁を消して右へずらす） */
  backspace(): void {
    this.digits.pop();
    this.digits.unshift(0);
    this.fresh = false;
  }
}

/** 撮影日時の表示（2026/10/06 14:32 と、秒まで） */
export function formatTaken(ms: number, seconds = false): string {
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}${seconds ? `:${p(d.getSeconds())}` : ''}`;
}
