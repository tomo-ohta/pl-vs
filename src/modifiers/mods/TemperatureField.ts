/**
 * TemperatureField — 温度スカラー場が方角情報になる（E19 温度座標迷宮）。params なし（defaults: cell 2, cold 8, hot 30, noise 1.2）。
 *
 * layout フック（決定論。乱数は渡された rng のみ）:
 *  - 部屋のローカル座標を cell（2 m）格子に割り、各セルの温度 T を「入口からの距離 − 最寄り出口への距離」の正規化値（0..1）に
 *    cold..hot を割り当て、セル固定のノイズ（±noise / 2）を足す。勾配の向きは rng で決める（出口へ向かって上がる 65 % / 下がる 35 %）。
 *    出口 = entry / hole 以外の全ソケット（施錠は layout 時点で未確定なので全て等価に数える）。
 *  - 照明: L.lights の色と天井パネル（lightPanel / lightWarm）の MatId を、その位置の温度で寒色（0x9fc8ff）〜暖色（0xffd9a0）に振り分ける。
 *    焼き込み（SurfaceLighting）は MatId の色を拾うので迷路の見た目にも勾配が出る。
 *  - 場は WeakMap<RoomLayout, Field> に置く（保存しない。layout 再生成のたびに同じ値になる）。
 * update フック: 現在部屋のときだけ 0.5 秒ごとに足元セルの温度を ctx.hud.hint に「18.4℃」として出す。HUD の #hud-hint が他の文字
 * （扉の操作案内・施錠ヒント）を表示中なら出さない。薄い色被せ・追加ライト・音は使わない。
 */
import type { Vec3 } from '../../core/types';
import { toLocal } from '../../core/types';
import type { LightSpec, MatId, RoomLayout } from '../../generators/layout';
import type { ModifierImpl, RuntimeContext } from '../types';
import { num } from '../util';
import { entrySocket, exitSockets, hash01, lerpColor } from './FakeSignage.common';

const COLD_COLOR = 0x9fc8ff;
const WARM_COLOR = 0xffd9a0;
/** 天井パネルとして扱う MatId（薄い非 solid 箱） */
const PANEL_MATS: ReadonlySet<string> = new Set(['lightPanel', 'lightWarm']);
const HINT_INTERVAL = 0.5;

export interface TemperatureFieldData {
  /** 格子の原点（ローカル）と一辺 */
  origin: [number, number];
  cell: number;
  nx: number;
  nz: number;
  /** セルごとの温度（℃）。index = ix + iz * nx */
  temp: Float32Array;
  cold: number;
  hot: number;
  /** true なら出口へ向かって上がる */
  hotExit: boolean;
}

const fields = new WeakMap<RoomLayout, TemperatureFieldData>();

/** 部屋の温度場（layout フックで作ったもの。無ければ null） */
export function temperatureFieldOf(L: RoomLayout): TemperatureFieldData | null {
  return fields.get(L) ?? null;
}

/** ローカル座標の温度（格子の外は最も近いセル） */
export function temperatureAt(f: TemperatureFieldData, x: number, z: number): number {
  const ix = Math.min(f.nx - 1, Math.max(0, Math.floor((x - f.origin[0]) / f.cell)));
  const iz = Math.min(f.nz - 1, Math.max(0, Math.floor((z - f.origin[1]) / f.cell)));
  return f.temp[ix + iz * f.nx];
}

function buildField(L: RoomLayout, o: { cell: number; cold: number; hot: number; noise: number; salt: number; hotExit: boolean }): TemperatureFieldData {
  const b = L.bounds;
  const cell = o.cell;
  const nx = Math.max(1, Math.ceil((b.max[0] - b.min[0]) / cell));
  const nz = Math.max(1, Math.ceil((b.max[2] - b.min[2]) / cell));
  const origin: [number, number] = [b.min[0], b.min[2]];
  const entry = entrySocket(L);
  const exits = exitSockets(L);
  const from: Vec3 = entry?.pos ?? [b.min[0], 0, b.min[2]];
  const to: Vec3[] = exits.length ? exits.map((s) => s.pos) : [[(b.min[0] + b.max[0]) / 2, 0, b.max[2]]];
  const phi = new Float32Array(nx * nz);
  let lo = Infinity;
  let hi = -Infinity;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = origin[0] + (ix + 0.5) * cell;
      const z = origin[1] + (iz + 0.5) * cell;
      const dEntry = Math.hypot(x - from[0], z - from[2]);
      let dExit = Infinity;
      for (const t of to) dExit = Math.min(dExit, Math.hypot(x - t[0], z - t[2]));
      const v = dEntry - dExit;
      phi[ix + iz * nx] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  const span = hi - lo > 1e-6 ? hi - lo : 1;
  const temp = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = ix + iz * nx;
      let t = (phi[i] - lo) / span;
      if (!o.hotExit) t = 1 - t;
      const n = (hash01(ix, iz, o.salt) - 0.5) * o.noise;
      temp[i] = o.cold + (o.hot - o.cold) * t + n;
    }
  }
  return { origin, cell, nx, nz, temp, cold: o.cold, hot: o.hot, hotExit: o.hotExit };
}

/** 温度 → 0..1（cold..hot） */
function warmth(f: TemperatureFieldData, x: number, z: number): number {
  return Math.min(1, Math.max(0, (temperatureAt(f, x, z) - f.cold) / (f.hot - f.cold)));
}

function tintLights(L: RoomLayout, f: TemperatureFieldData): void {
  const h = L.height;
  const start = L.shellCount ?? 0;
  for (let i = start; i < L.boxes.length; i++) {
    const b = L.boxes[i];
    if (b.solid || !PANEL_MATS.has(b.mat) || b.max[1] - b.min[1] > 0.12 || b.max[1] < h - 0.3) continue;
    const w = warmth(f, (b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2);
    const mat: MatId = w >= 0.5 ? 'lightWarm' : 'lightPanel';
    if (mat !== b.mat) L.boxes[i] = { ...b, mat };
  }
  L.lights = L.lights.map((l): LightSpec => ({ ...l, color: lerpColor(COLD_COLOR, WARM_COLOR, warmth(f, l.pos[0], l.pos[2])) }));
}

/** HUD のヒントが他の用途（扉の操作案内・施錠）で使われているか。Game の hud.busy() を優先し、無い環境では DOM を読む（DOM も無ければ false） */
function hintBusy(ctx: RuntimeContext): boolean {
  if (typeof ctx.hud.busy === 'function') return ctx.hud.busy();
  if (typeof document === 'undefined') return false;
  const el = document.getElementById('hud-hint');
  const t = el?.textContent ?? '';
  return t.length > 0 && !/℃$/.test(t);
}

const timers = new WeakMap<object, number>();

const TemperatureField: ModifierImpl = {
  id: 'TemperatureField',
  defaults: { cell: 2, cold: 8, hot: 30, noise: 1.2 },
  layout(L, _p, params, rng) {
    const cell = Math.max(1, num(params.cell, 2));
    const cold = num(params.cold, 8);
    const hot = Math.max(cold + 1, num(params.hot, 30));
    const noise = Math.max(0, num(params.noise, 1.2));
    const hotExit = rng.chance(0.65);
    const salt = rng.int(0, 0x7fffffff);
    const f = buildField(L, { cell, cold, hot, noise, salt, hotExit });
    fields.set(L, f);
    tintLights(L, f);
  },
  update(dt, ctx) {
    if (!ctx.game || ctx.game.currentRoomId !== ctx.node.roomId) return;
    const f = fields.get(ctx.layout);
    const p = ctx.node.placement;
    if (!f || !p) return;
    const acc = (timers.get(ctx.node) ?? HINT_INTERVAL) + dt;
    if (acc < HINT_INTERVAL) { timers.set(ctx.node, acc); return; }
    timers.set(ctx.node, 0);
    if (hintBusy(ctx)) return;
    const local = toLocal(p, ctx.player.pos);
    ctx.hud.hint(`${temperatureAt(f, local[0], local[2]).toFixed(1)}℃`);
  },
};

export default TemperatureField;
