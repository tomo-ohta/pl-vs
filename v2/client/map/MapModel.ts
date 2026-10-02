/**
 * 1 フロアの地図の状態（自分の地図。純粋な TypeScript: DOM・three を使わない。Node の試験で使える）。
 *
 * 面白さ（docs/game-design.md）: 地図は「迷って、見つけて、埋める」道具。全部が最初から見えると探索がつまらないので、
 * 見た所だけ描く。地図の異変は「地図を信じていたのに」という驚き。
 *
 * - 見た区画（seen）: 入った区画と、開口から見えた区画（扉は開いている間だけ。出現型の隠しの壁は現れるまで向こうが見えない）。
 *   扉の無い開口は map.seen.hops 個までたどる。開口が視線の向き（map.seen.coneDeg）に入っていて、map.seen.distM より近いこと
 * - 入った区画（visited）: 図鑑の記録・地図の色に使う
 * - 調査率（N01）: 区画の床の升目のうち、歩いた所から map.survey.radiusM の升目を「調べた」にする。区画ごとに map.survey.cellFull
 *   を調べれば調べ終わり。フロアの調査率 = 調べ終わりの割合を床の面積で重み付けした平均（100% でフロアの記録が完成）
 * - 足跡（N06）: 歩いた跡を map.trail.stepM ごとに残す（地図に点で描く。地図が消えても足跡は残る）
 * - 地図が消える（N02 mapFx 'erase'）: その部屋に入ると、決めたやり方（全部・半分・遠く）で地図の区画が消える。
 *   調べた記録（調査率）は残り、消えた区画はもう一度見ると戻る
 * - 地図が回る（N03 mapFx 'rotate'）: その部屋の中で地図が回る（ゆれる）。部屋を出てもしばらく回ったまま（map.rotate.holdSec）
 * - 地図に記録されない区画（N08）: 入っても見ても地図に描かない（今いる間だけ破線で描く）。調査率に数えない
 * - 写し（ghost）: 案内図・現在地の看板・他人の地図を読むと、その地図の形と書き込みが自分の地図に点線で入る（boards.ts）
 */
import type { Tuning } from '../../core/config/tuning.ts';
import { hashAll, Rng } from '../../core/math/rng.ts';
import type { Rect } from '../../core/world/footprint.ts';
import { cellAtPos, type MapCell, type MapFxInfo, type MapFxKind, type MapInfo, type MapPortal } from './MapInfo.ts';

export interface MapObservation {
  /** プレイヤーの足元 */
  pos: readonly [number, number, number];
  /** 視線の向き（yaw 0 で -Z） */
  yaw: number;
  dt: number;
  /** 扉の部品の開き具合（0..1） */
  doorAngle(id: string): number;
  /** 出現型の隠しの組が現れたか */
  revealed(group: string): boolean;
}

export type MapEvent =
  | { type: 'visit'; cell: string; first: boolean }
  | { type: 'see'; cell: string }
  | { type: 'complete' }
  | { type: 'fx'; fx: MapFxKind; cell: string; erased?: number };

export interface GhostMark { x: number; z: number; text: string; kind: 'here' | 'exit' | 'note' | 'x' | 'blank' }

/** 自分の地図に入った写し（案内図・現在地の看板・他人の地図） */
export interface Ghost {
  source: 'guide' | 'here' | 'note';
  id: string;
  /** 区画ごとの形（点線で描く） */
  cells: Rect[][];
  marks: GhostMark[];
  /** 誰かの歩いた跡（x, z の並び） */
  trail: number[];
  author?: string;
  /** 写しの層（無ければ全部の層に描く） */
  layer?: number;
}

/** 保存の形（liminal2.maps.v1 の 1 フロア分） */
export interface MapSave {
  v: 1;
  seen: string[];
  visited: string[];
  erased: string[];
  /** 区画 → 調べた升目（16 進の並び） */
  tiles: Record<string, string>;
  /** x, z, 層 の並び（0.1 m 単位の整数） */
  trail: number[];
  ghosts: Ghost[];
  read: string[];
  complete: boolean;
}

const smooth = (k: number): number => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const DEG = Math.PI / 180;

/** 升目の調べた / まだを 16 進の文字列に */
export function bitsToHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 4) s += ((b[i] ? 1 : 0) | (b[i + 1] ? 2 : 0) | (b[i + 2] ? 4 : 0) | (b[i + 3] ? 8 : 0)).toString(16);
  return s;
}
export function hexToBits(s: string, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = parseInt(s[i >> 2] ?? '0', 16);
    if (Number.isFinite(v) && (v >> (i & 3)) & 1) out[i] = 1;
  }
  return out;
}

export class FloorMap {
  readonly info: MapInfo;
  readonly t: Tuning;
  readonly seen = new Set<string>();
  readonly visited = new Set<string>();
  /** 消えた区画（N02。もう一度見ると戻る） */
  readonly erased = new Set<string>();
  /** 消えている途中の区画と、消え始めた時刻（秒） */
  readonly erasing = new Map<string, number>();
  readonly tiles = new Map<string, Uint8Array>();
  /** 足跡（x, z, 層 の並び） */
  trail: number[] = [];
  ghosts: Ghost[] = [];
  readonly read = new Set<string>();
  /** 今いる区画（区画の外なら null） */
  current: string | null = null;
  complete = false;
  /** 地図の回転（ラジアン。画面の上で時計回りが正。N03） */
  rotation = 0;
  /** 経過秒 */
  time = 0;
  private lastTrail: [number, number] | null = null;
  private eraseCount = 0;
  private rot = { phase: 'idle' as 'idle' | 'in' | 'hold' | 'out', from: 0, target: 0, t: 0, since: 0, hold: 0, cell: '' as string, drift: 0, period: 24 };
  private fxByCell = new Map<string, MapFxInfo[]>();
  private surveyCache = -1;

  constructor(info: MapInfo, t: Tuning, save?: MapSave | null) {
    this.info = info;
    this.t = t;
    for (const f of info.fx) this.fxByCell.set(f.cell, [...(this.fxByCell.get(f.cell) ?? []), f]);
    for (const [id, tl] of info.tiles) this.tiles.set(id, new Uint8Array(tl.xs.length));
    if (save) this.load(save);
  }

  // ---------------------------------------------------------------- 進める
  update(o: MapObservation): MapEvent[] {
    const ev: MapEvent[] = [];
    this.time += o.dt;
    const here = cellAtPos(this.info, o.pos);
    const prev = this.current;
    this.current = here?.id ?? null;
    // 出た区画の異変を先に終える（回る部屋から回る部屋へ続けて入ったとき、入った方が勝つように）
    if (prev && prev !== this.current) for (const f of this.fxByCell.get(prev) ?? []) if (f.fx === 'rotate') this.leaveRotate(prev);
    if (here && here.id !== prev) {
      const first = !this.visited.has(here.id);
      this.visited.add(here.id);
      if (!here.hidden) { this.erased.delete(here.id); this.erasing.delete(here.id); this.seen.add(here.id); }
      ev.push({ type: 'visit', cell: here.id, first });
      for (const f of this.fxByCell.get(here.id) ?? []) this.enterFx(f, o, ev);
    }
    // 見た区画
    if (here) {
      for (const id of this.visibleFrom(here, o)) {
        const c = this.info.byId.get(id);
        if (!c || c.hidden) continue;
        if (!this.seen.has(id) || this.erased.has(id)) {
          this.seen.add(id);
          this.erased.delete(id);
          this.erasing.delete(id);
          ev.push({ type: 'see', cell: id });
        }
      }
    }
    // 調査
    if (here && here.counted) {
      const tl = this.info.tiles.get(here.id);
      const bits = this.tiles.get(here.id);
      if (tl && bits) {
        const R = this.t['map.survey.radiusM'], R2 = R * R;
        let changed = false;
        for (let i = 0; i < tl.xs.length; i++) {
          if (bits[i]) continue;
          const dx = tl.xs[i]! - o.pos[0], dz = tl.zs[i]! - o.pos[2];
          if (dx * dx + dz * dz <= R2) { bits[i] = 1; changed = true; }
        }
        if (changed) {
          this.surveyCache = -1;
          if (!this.complete && this.survey() >= 0.9995) { this.complete = true; ev.push({ type: 'complete' }); }
        }
      }
    }
    // 足跡
    const layer = here?.layer ?? 0;
    if (!this.lastTrail || Math.hypot(o.pos[0] - this.lastTrail[0], o.pos[2] - this.lastTrail[1]) >= this.t['map.trail.stepM']) {
      if (here && !here.hidden) {
        this.trail.push(Math.round(o.pos[0] * 10), Math.round(o.pos[2] * 10), layer);
        const max = this.t['map.trail.max'] * 3;
        if (this.trail.length > max) this.trail.splice(0, this.trail.length - max);
      }
      this.lastTrail = [o.pos[0], o.pos[2]];
    }
    this.stepRotation(o.dt);
    // 消え終わった区画
    for (const [id, at] of this.erasing) if (this.time - at > 1.6) this.erasing.delete(id);
    return ev;
  }

  /** 今いる区画から開口をたどって見える区画 */
  visibleFrom(here: MapCell, o: MapObservation): string[] {
    const out: string[] = [];
    const dist = this.t['map.seen.distM'];
    const cone = Math.cos(this.t['map.seen.coneDeg'] * DEG);
    const hops = this.t['map.seen.hops'];
    const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw);
    const visible = (p: MapPortal): boolean => {
      if (p.doorId && o.doorAngle(p.doorId) < this.t['map.seen.doorOpen']) return false;
      if (p.conceal && !o.revealed(p.conceal)) return false;
      const dx = p.x - o.pos[0], dz = p.z - o.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > dist) return false;
      if (d < 2) return true;
      return (dx * fx + dz * fz) / d >= cone;
    };
    const seen = new Set([here.id]);
    let frontier: { id: string; door: boolean }[] = [{ id: here.id, door: false }];
    for (let h = 0; h < hops && frontier.length; h++) {
      const next: { id: string; door: boolean }[] = [];
      for (const f of frontier) {
        if (f.door) continue; // 扉の向こうの先はたどらない
        for (const p of this.info.byCell.get(f.id) ?? []) {
          const other = p.cells[0] === f.id ? p.cells[1] : p.cells[0];
          if (seen.has(other) || !visible(p)) continue;
          seen.add(other);
          out.push(other);
          next.push({ id: other, door: !!p.doorId || p.kind !== 'opening' });
        }
      }
      frontier = next;
    }
    return out;
  }

  // ---------------------------------------------------------------- 地図の異変
  private enterFx(f: MapFxInfo, o: MapObservation, ev: MapEvent[]): void {
    if (f.fx === 'erase') {
      const policy = typeof f.params.policy === 'string' ? f.params.policy : 'all';
      const pool = [...this.seen].filter((id) => id !== f.cell).sort();
      let pick: string[] = [];
      if (policy === 'half') pick = new Rng(hashAll(this.info.key, 'erase', this.eraseCount)).shuffle(pool).slice(0, Math.ceil(pool.length / 2));
      else if (policy === 'far') {
        const farM = this.t['map.erase.farM'];
        pick = pool.filter((id) => {
          const c = this.info.byId.get(id)!;
          const b = c.bounds;
          const x = Math.max(b.min[0], Math.min(o.pos[0], b.max[0])), z = Math.max(b.min[2], Math.min(o.pos[2], b.max[2]));
          return Math.hypot(x - o.pos[0], z - o.pos[2]) > farM;
        });
      } else pick = pool;
      this.eraseCount++;
      for (const id of pick) { this.erased.add(id); this.erasing.set(id, this.time); }
      ev.push({ type: 'fx', fx: 'erase', cell: f.cell, erased: pick.length });
      return;
    }
    if (f.fx === 'rotate') {
      const angle = typeof f.params.angle === 'number' ? f.params.angle * DEG : Math.PI / 2;
      this.rot = { ...this.rot, phase: 'in', from: this.rotation, target: angle, t: 0, since: 0, cell: f.cell, drift: this.t['map.rotate.driftDeg'] * DEG, period: this.t['map.rotate.driftSec'] };
      ev.push({ type: 'fx', fx: 'rotate', cell: f.cell });
      return;
    }
    ev.push({ type: 'fx', fx: 'hide', cell: f.cell });
  }

  private leaveRotate(cell: string): void {
    if (this.rot.phase !== 'in' || this.rot.cell !== cell) return;
    this.rot = { ...this.rot, phase: 'hold', hold: 0, from: this.rotation };
  }

  private stepRotation(dt: number): void {
    const r = this.rot;
    const ease = this.t['map.rotate.easeSec'];
    if (r.phase === 'in') {
      r.t += dt;
      r.since += dt;
      const k = smooth(r.t / ease);
      const drift = Math.sin((r.since / r.period) * Math.PI * 2) * r.drift;
      this.rotation = r.from + (r.target - r.from) * k + drift * k;
    } else if (r.phase === 'hold') {
      r.hold += dt;
      if (r.hold >= this.t['map.rotate.holdSec']) { r.phase = 'out'; r.t = 0; r.from = this.rotation; }
    } else if (r.phase === 'out') {
      r.t += dt;
      const k = smooth(r.t / Math.max(ease, 2.5));
      this.rotation = r.from * (1 - k);
      if (k >= 1) { this.rotation = 0; r.phase = 'idle'; }
    }
  }

  /** 回転の状態（試験・表示用） */
  get rotationPhase(): 'idle' | 'in' | 'hold' | 'out' { return this.rot.phase; }

  // ---------------------------------------------------------------- 調査率
  /** 区画の調べた割合（0..1。升目の面積で） */
  cellCoverage(id: string): number {
    const tl = this.info.tiles.get(id), bits = this.tiles.get(id);
    if (!tl || !bits || tl.total <= 0) return 0;
    let a = 0;
    for (let i = 0; i < bits.length; i++) if (bits[i]) a += tl.area[i]!;
    return a / tl.total;
  }

  /** 区画を調べ終わった割合（0..1。cellFull で 1） */
  cellSurvey(id: string): number {
    return Math.min(1, this.cellCoverage(id) / this.t['map.survey.cellFull']);
  }

  /** フロアの調査率（0..1） */
  survey(): number {
    if (this.surveyCache >= 0) return this.surveyCache;
    if (this.info.surveyArea <= 0) return (this.surveyCache = 0);
    let s = 0;
    for (const [id, tl] of this.info.tiles) s += this.cellSurvey(id) * tl.total;
    this.surveyCache = Math.min(1, s / this.info.surveyArea);
    return this.surveyCache;
  }

  // ---------------------------------------------------------------- 写し
  /** 写しを足す（同じ物は 1 回だけ）。足したら true */
  addGhost(g: Ghost): boolean {
    if (this.read.has(g.id)) return false;
    this.read.add(g.id);
    this.ghosts.push(g);
    return true;
  }

  /** 地図に描く区画か（見た・消えていない・記録される） */
  drawn(id: string): boolean {
    const c = this.info.byId.get(id);
    return !!c && !c.hidden && this.seen.has(id) && !this.erased.has(id);
  }

  // ---------------------------------------------------------------- 保存
  save(): MapSave {
    const tiles: Record<string, string> = {};
    for (const [id, b] of this.tiles) if (b.some((x) => x)) tiles[id] = bitsToHex(b);
    return {
      v: 1, seen: [...this.seen].sort(), visited: [...this.visited].sort(), erased: [...this.erased].sort(), tiles,
      trail: this.trail.slice(), ghosts: this.ghosts.map((g) => JSON.parse(JSON.stringify(g)) as Ghost), read: [...this.read].sort(), complete: this.complete,
    };
  }

  private load(s: MapSave): void {
    if (!s || s.v !== 1) return;
    const ok = (id: unknown): id is string => typeof id === 'string' && this.info.byId.has(id);
    for (const id of s.seen ?? []) if (ok(id) && !this.info.byId.get(id)!.hidden) this.seen.add(id);
    for (const id of s.visited ?? []) if (ok(id)) this.visited.add(id);
    for (const id of s.erased ?? []) if (ok(id)) this.erased.add(id);
    for (const [id, hex] of Object.entries(s.tiles ?? {})) {
      const b = this.tiles.get(id);
      if (b && typeof hex === 'string') this.tiles.set(id, hexToBits(hex, b.length));
    }
    if (Array.isArray(s.trail)) this.trail = s.trail.filter((v) => typeof v === 'number').slice(-this.t['map.trail.max'] * 3);
    this.trail.length -= this.trail.length % 3;
    if (Array.isArray(s.ghosts)) for (const g of s.ghosts) if (g && typeof g.id === 'string') { this.ghosts.push(g); this.read.add(g.id); }
    for (const id of s.read ?? []) if (typeof id === 'string') this.read.add(id);
    this.complete = !!s.complete;
    this.surveyCache = -1;
  }
}
