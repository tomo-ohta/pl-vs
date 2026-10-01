/**
 * AudioEvent — 確率再生の一発音、または特定 Portal へ誘導する定常音源（U14 / U19 / R08）。
 * params: mode('oneShot' | 'beacon'), sound, interval(秒), portalId, chance(0..1), gain。
 *
 *   oneShot（U19 children 20 s / R08 pageTurn 12 s）:
 *     現在部屋に居る間だけ、平均 interval 秒（±40% ジッタ）ごとに確率 chance（既定 0.7）で 1 発。
 *     位置は footprint のランダムな壁際（壁から 0.6 m 内側・高さ 1.2 m）で、プレイヤーから 3 m 以上離れた点を優先する。
 *     ランタイム乱数は Math.random（進行に影響しない）。
 *   beacon（U14 phoneRing）:
 *     誘導先 Portal（params.portalId、無ければ「戻り以外・非施錠・行き先未訪問」の出口から node.seed の Rng で決定論的に 1 つ）
 *     のソケット世界座標 + 高さ 1.2 m で ctx.audio.beacon(sound, pos) をループ再生。Portal の選択は modifierState に保存する。
 *     その Portal を通過（開口から 1.1 m 以内に入る、または退室時に一番近い出口がそれ）したら停止し done = true を保存（再訪時は鳴らさない）。
 *     全出口が訪問済みなら鳴らさない。
 *   update フックで管理し onExit で停止。update は現在部屋にだけ効く（1 hop 先では鳴らさない。ボイス予算のため）。
 *   未知の sound 名は AudioEngine が beep にフォールバックする（world.log にも残す）。
 */
import { Rng } from '../../core/rng';
import type { Portal, RoomInstance, Vec3 } from '../../core/types';
import { toWorld } from '../../core/types';
import type { SoundHandle } from '../../audio/AudioEngine';
import type { RoomLayout } from '../../generators/layout';
import type { ModifierImpl, ModifierParams, RuntimeContext } from '../types';
import { num, str } from '../util';

const ID = 'AudioEvent';
const KNOWN_SOUNDS = new Set(['phoneRing', 'children', 'pageTurn', 'beep', 'knock', 'chime', 'clank', 'drip', 'laugh', 'thud', 'shutter']);

interface BeaconState {
  portalId: string;
  done: boolean;
}

interface RoomState {
  /** oneShot: 次に鳴らす時刻（ctx.now 基準） */
  nextAt: number;
  handle: SoundHandle | null;
  /** beacon: 誘導先 */
  portal: Portal | null;
  loggedUnknown: boolean;
}

/** 部屋ごとのランタイム状態（入室で作り、退室で捨てる） */
const states = new Map<string, RoomState>();

function beaconStateOf(node: RoomInstance): BeaconState | null {
  const st = node.state.modifierState?.[ID] as Partial<BeaconState> | undefined;
  return st && typeof st.portalId === 'string' ? { portalId: st.portalId, done: !!st.done } : null;
}

function saveBeaconState(node: RoomInstance, b: BeaconState): void {
  (node.state.modifierState ??= {})[ID] = { ...b };
}

function isCurrent(ctx: RuntimeContext): boolean {
  return !ctx.game || ctx.game.currentRoomId === ctx.node.roomId;
}

function scheduleNext(now: number, interval: number, first = false): number {
  const jitter = 1 + (Math.random() * 2 - 1) * 0.4;
  return now + interval * jitter * (first ? 0.5 : 1);
}

/** footprint のランダムな壁際（壁から 0.6 m 内側）。プレイヤーから 3 m 以上を最大 8 回試す */
function wallPoint(L: RoomLayout, node: RoomInstance, player: Vec3): Vec3 | null {
  if (!node.placement || L.footprint.length === 0) return null;
  let best: Vec3 | null = null;
  for (let i = 0; i < 8; i++) {
    const r = L.footprint[Math.floor(Math.random() * L.footprint.length)];
    const inset = 0.6;
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    if (w < inset * 2 + 0.2 || d < inset * 2 + 0.2) continue;
    const edge = Math.floor(Math.random() * 4);
    const tx = r.x0 + inset + Math.random() * (w - inset * 2);
    const tz = r.z0 + inset + Math.random() * (d - inset * 2);
    const local: Vec3 = edge === 0 ? [tx, 1.2, r.z1 - inset] : edge === 1 ? [r.x1 - inset, 1.2, tz] : edge === 2 ? [tx, 1.2, r.z0 + inset] : [r.x0 + inset, 1.2, tz];
    const wpos = toWorld(node.placement, local);
    best = wpos;
    if (Math.hypot(wpos[0] - player[0], wpos[2] - player[2]) >= 3) return wpos;
  }
  return best;
}

/** beacon の誘導先を決める。params.portalId → 保存済み → 未訪問の行き先を持つ非施錠出口から決定論で 1 つ */
function chooseBeaconPortal(ctx: RuntimeContext, params: ModifierParams): Portal | null {
  const node = ctx.node;
  const wanted = str(params.portalId, '');
  if (wanted) {
    const p = node.portals.find((x) => x.portalId === wanted || x.socketId === wanted);
    if (p) return p;
  }
  const saved = beaconStateOf(node);
  if (saved) {
    const p = node.portals.find((x) => x.portalId === saved.portalId);
    if (p) return p;
  }
  const graph = ctx.world.graph;
  const cands = node.portals
    .filter((p) => !p.isReturn && !p.locked && p.type !== 'hole' && !(p.targetRoomId && graph.has(p.targetRoomId) && graph.get(p.targetRoomId).visited))
    .sort((a, b) => (a.portalId < b.portalId ? -1 : a.portalId > b.portalId ? 1 : 0));
  if (cands.length === 0) return null;
  const rng = new Rng(node.seed).fork(`mod:${ID}`).fork('beacon');
  return cands[rng.int(0, cands.length - 1)];
}

function beaconPos(ctx: RuntimeContext, portal: Portal): Vec3 | null {
  if (!ctx.node.placement || !ctx.layout.sockets.some((s) => s.id === portal.socketId)) return null;
  const { pos } = ctx.world.socketWorld(ctx.node, portal.socketId);
  return [pos[0], pos[1] + 1.2, pos[2]];
}

function stopState(roomId: string): void {
  const st = states.get(roomId);
  if (!st) return;
  st.handle?.stop(0.3);
  st.handle = null;
  states.delete(roomId);
}

function logUnknown(ctx: RuntimeContext, st: RoomState, sound: string): void {
  if (st.loggedUnknown || KNOWN_SOUNDS.has(sound)) return;
  st.loggedUnknown = true;
  ctx.world.log.push(`WARN AudioEvent ${ctx.node.roomId}: sound '${sound}' はレイヤー / アセット名として解釈（無ければ beep）`);
}

const AudioEvent: ModifierImpl = {
  id: ID,
  defaults: { mode: 'oneShot', sound: 'beep', interval: 15, chance: 0.7, gain: 0.9 },

  onEnter(ctx, params) {
    stopState(ctx.node.roomId);
    const mode = str(params.mode, 'oneShot');
    const st: RoomState = { nextAt: 0, handle: null, portal: null, loggedUnknown: false };
    states.set(ctx.node.roomId, st);
    if (mode === 'beacon') {
      const saved = beaconStateOf(ctx.node);
      if (saved?.done) return; // 通過済み: 再訪時は鳴らさない
      const portal = chooseBeaconPortal(ctx, params);
      if (!portal) return; // 全出口が訪問済み
      saveBeaconState(ctx.node, { portalId: portal.portalId, done: false });
      st.portal = portal;
      const pos = beaconPos(ctx, portal);
      if (!pos || !ctx.audio) return;
      const sound = str(params.sound, 'phoneRing');
      logUnknown(ctx, st, sound);
      st.handle = ctx.audio.beacon(sound, pos, Math.max(0, num(params.gain, 0.9)));
    } else {
      st.nextAt = scheduleNext(ctx.now, Math.max(2, num(params.interval, 15)), true);
    }
  },

  update(_dt, ctx, params) {
    const st = states.get(ctx.node.roomId);
    if (!st || !isCurrent(ctx)) return;
    const mode = str(params.mode, 'oneShot');
    if (mode === 'beacon') {
      const portal = st.portal;
      if (!portal) return;
      // 誘導先の開口に入った（1.1 m 以内）→ 通過とみなして停止・保存
      const pos = beaconPos(ctx, portal);
      if (!pos) return;
      const d = Math.hypot(pos[0] - ctx.player.pos[0], pos[2] - ctx.player.pos[2]);
      if (d < 1.1) {
        saveBeaconState(ctx.node, { portalId: portal.portalId, done: true });
        st.handle?.stop(0.4);
        st.handle = null;
        st.portal = null;
      }
      return;
    }
    if (ctx.now < st.nextAt) return;
    const interval = Math.max(2, num(params.interval, 15));
    st.nextAt = scheduleNext(ctx.now, interval);
    if (Math.random() >= Math.min(1, Math.max(0, num(params.chance, 0.7)))) return;
    if (!ctx.audio) return;
    const pos = wallPoint(ctx.layout, ctx.node, ctx.player.pos);
    if (!pos) return;
    const sound = str(params.sound, 'beep');
    logUnknown(ctx, st, sound);
    // 遠い子どもの声は残響を深く、ページ音は乾いた近い音
    const send = sound === 'children' ? 0.75 : 0.35;
    ctx.audio.play(sound, { pos, gain: Math.max(0, num(params.gain, 0.9)), send, roomId: ctx.node.roomId });
  },

  onExit(ctx, params) {
    const st = states.get(ctx.node.roomId);
    if (st && str(params.mode, 'oneShot') === 'beacon' && st.portal) {
      // 退室時にいちばん近い出口が誘導先なら通過とみなす
      const pos = beaconPos(ctx, st.portal);
      if (pos && Math.hypot(pos[0] - ctx.player.pos[0], pos[2] - ctx.player.pos[2]) < 2.2) {
        saveBeaconState(ctx.node, { portalId: st.portal.portalId, done: true });
      }
    }
    stopState(ctx.node.roomId);
  },
};

export default AudioEvent;
