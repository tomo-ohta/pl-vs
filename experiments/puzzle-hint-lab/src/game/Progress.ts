/**
 * 進行（部屋ごとの踏破・制圧のフラグ、ヒントの段階、ヒントの新着）と保存（localStorage。seed ごと）
 */
import { HINT_THRESHOLDS, hintStage, nextTarget, percent, pickDebugSolves } from '../gen/progress.ts';
import { makeRng } from '../gen/rng.ts';
import type { World } from '../gen/world.ts';

export interface Pose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

interface SaveData {
  v: 1;
  visited: string;
  solved: string;
  seen: number[];
  pose: Pose | null;
}

export type ProgressEvent =
  | { kind: 'visit'; room: number }
  | { kind: 'solve'; room: number }
  /** ヒントの段階が上がった（from → to） */
  | { kind: 'stage'; from: number; to: number }
  /** まとめて変わった（デバッグ・初期化） */
  | { kind: 'bulk' };

const bits = (xs: readonly boolean[]): string => xs.map((v) => (v ? '1' : '0')).join('');

export class Progress {
  readonly visited: boolean[];
  readonly solved: boolean[];
  /** 部屋ごとに、ヒントのタブで見たヒントの段階（それより上の解放は新着） */
  readonly seen: number[];
  readonly thresholds: readonly number[];
  private readonly world: World;
  private readonly key: string;
  private readonly listeners: ((e: ProgressEvent) => void)[] = [];
  private visitedN = 0;
  private solvedN = 0;
  private debugSeed = 1;

  constructor(world: World, thresholds: readonly number[] = HINT_THRESHOLDS) {
    this.world = world;
    this.thresholds = thresholds;
    const n = world.rooms.length;
    this.visited = new Array(n).fill(false);
    this.solved = new Array(n).fill(false);
    this.seen = new Array(n).fill(0);
    this.key = `phl.progress.v1.${world.seed}`;
  }

  get total(): number {
    return this.world.rooms.length;
  }
  get visitedCount(): number {
    return this.visitedN;
  }
  get solvedCount(): number {
    return this.solvedN;
  }
  get visitedPct(): number {
    return percent(this.visitedN, this.total);
  }
  get solvedPct(): number {
    return percent(this.solvedN, this.total);
  }
  /** 解放したヒントの段階（0〜3） */
  get stage(): number {
    return hintStage(this.solvedN, this.thresholds);
  }
  /** 次のヒントの境目（制圧の部屋の数。全部越えたら null） */
  get nextThreshold(): number | null {
    const s = this.stage;
    return s < this.thresholds.length ? this.thresholds[s] : null;
  }

  on(f: (e: ProgressEvent) => void): void {
    this.listeners.push(f);
  }

  private emit(e: ProgressEvent): void {
    for (const f of this.listeners) f(e);
  }

  /** 部屋に入った（初めてなら true） */
  visit(room: number): boolean {
    if (room < 0 || this.visited[room]) return false;
    this.visited[room] = true;
    this.visitedN++;
    this.emit({ kind: 'visit', room });
    return true;
  }

  /** 部屋を制圧した（初めてなら true）。制圧した部屋は踏破も立てる */
  solve(room: number): boolean {
    if (this.solved[room]) return false;
    const before = this.stage;
    if (!this.visited[room]) {
      this.visited[room] = true;
      this.visitedN++;
    }
    this.solved[room] = true;
    this.solvedN++;
    this.emit({ kind: 'solve', room });
    if (this.stage !== before) this.emit({ kind: 'stage', from: before, to: this.stage });
    return true;
  }

  /** 部屋の新着のヒント（見た段階より上で、解放済みの物）の数 */
  unseen(room: number): number {
    return Math.max(0, this.stage - this.seen[room]);
  }

  markSeen(room: number): void {
    this.seen[room] = Math.max(this.seen[room], this.stage);
  }

  /**
   * デバッグ: 次のヒントの境目まで制圧を進める。未制圧の部屋を難易度の低い順に（今いる部屋は後回し）。
   * 制圧にした部屋の添字を返す
   */
  debugNextStage(current: number): number[] {
    const target = nextTarget(this.solvedN, this.total, this.thresholds);
    if (target === null) return [];
    const before = this.stage;
    const picked = pickDebugSolves(
      this.world.rooms.map((r) => r.difficulty),
      this.solved,
      target - this.solvedN,
      current,
      makeRng(this.world.seed + 7919 * this.debugSeed++),
    );
    for (const i of picked) {
      if (!this.visited[i]) {
        this.visited[i] = true;
        this.visitedN++;
      }
      this.solved[i] = true;
      this.solvedN++;
    }
    this.emit({ kind: 'bulk' });
    if (this.stage !== before) this.emit({ kind: 'stage', from: before, to: this.stage });
    return picked;
  }

  /** デバッグ: 全部屋を踏破にする */
  debugVisitAll(): void {
    this.visited.fill(true);
    this.visitedN = this.total;
    this.emit({ kind: 'bulk' });
  }

  reset(): void {
    this.visited.fill(false);
    this.solved.fill(false);
    this.seen.fill(0);
    this.visitedN = 0;
    this.solvedN = 0;
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* 保存できない環境 */
    }
    this.emit({ kind: 'bulk' });
  }

  save(pose: Pose | null): void {
    const data: SaveData = { v: 1, visited: bits(this.visited), solved: bits(this.solved), seen: this.seen, pose };
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      /* 保存できない環境（プライベートブラウズなど）では、開いている間だけ */
    }
  }

  /** 保存から戻す（保存した位置を返す） */
  load(): Pose | null {
    let data: SaveData | null = null;
    try {
      const raw = localStorage.getItem(this.key);
      data = raw ? (JSON.parse(raw) as SaveData) : null;
    } catch {
      data = null;
    }
    if (!data || data.v !== 1 || data.visited.length !== this.total) return null;
    for (let i = 0; i < this.total; i++) {
      this.visited[i] = data.visited[i] === '1';
      this.solved[i] = data.solved[i] === '1';
      this.seen[i] = data.seen?.[i] ?? 0;
    }
    this.visitedN = this.visited.filter(Boolean).length;
    this.solvedN = this.solved.filter(Boolean).length;
    return data.pose;
  }
}
