/**
 * 効果音イベントログ（60 秒リング）。play() / footstep / door などの呼び出しを自動記録する。
 * E12 PastWindow「遠い過去音」（30 秒前の音を lowpass + -12 dB で再生）が読む。FutureAudio は実装しない（D8）。
 * Web Audio に依存しない。
 */
import type { Vec3 } from '../core/types';

export interface AudioEventRecord {
  kind: string;
  pos?: Vec3;
  roomId?: string;
  /** 記録時刻（AudioContext.currentTime 基準の秒） */
  t: number;
  gain?: number;
}

export class EventLog {
  readonly windowSec: number;
  private readonly items: AudioEventRecord[] = [];
  private readonly cap: number;

  constructor(windowSec = 60, cap = 600) {
    this.windowSec = windowSec;
    this.cap = cap;
  }

  push(ev: AudioEventRecord): void {
    this.items.push(ev);
    if (this.items.length > this.cap) this.items.splice(0, this.items.length - this.cap);
    this.prune(ev.t);
  }

  /** windowSec より古い記録を落とす */
  prune(now: number): void {
    const cutoff = now - this.windowSec;
    let i = 0;
    while (i < this.items.length && this.items[i].t < cutoff) i++;
    if (i > 0) this.items.splice(0, i);
  }

  /** now から sinceSec 秒以内の記録（古い順） */
  recent(now: number, sinceSec: number): AudioEventRecord[] {
    const cutoff = now - sinceSec;
    return this.items.filter((e) => e.t >= cutoff);
  }

  /** [now - fromSec, now - toSec] の範囲（E12: 30 秒前の 1 フレーム分など。fromSec > toSec） */
  between(now: number, fromSec: number, toSec: number): AudioEventRecord[] {
    const a = now - fromSec;
    const b = now - toSec;
    return this.items.filter((e) => e.t >= a && e.t < b);
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}
